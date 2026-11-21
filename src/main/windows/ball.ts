import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { app } from 'electron'
import { getState, patchState } from '../state/store'

let ballWindow: BrowserWindow | null = null

const MARGIN = 12
const MENU = 360

export function getBallWindow(): BrowserWindow | null {
  return ballWindow && !ballWindow.isDestroyed() ? ballWindow : null
}

function workArea(win: BrowserWindow) {
  return screen.getDisplayMatching(win.getBounds()).workArea
}

export function createBallWindow(): BrowserWindow {
  const existing = getBallWindow()
  if (existing) return existing
  const state = getState()
  const size = state.ball.size
  const wa = screen.getPrimaryDisplay().workArea
  const x = state.ball.side === 'right' ? wa.x + wa.width - size - MARGIN : wa.x + MARGIN
  const y = Math.round(wa.y + wa.height * 0.38)

  const win = new BrowserWindow({
    width: size,
    height: size,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: state.ball.focusable,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/index.html#/ball`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/ball' })
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    ballWindow = null
  })
  ballWindow = win
  return win
}

export function destroyBallWindow(): void {
  const win = getBallWindow()
  if (win) win.destroy()
  ballWindow = null
}

export function setBallVisible(visible: boolean): void {
  if (!visible) {
    destroyBallWindow()
    return
  }
  const win = createBallWindow()
  const state = getState()
  patchState({ ball: { ...state.ball, enabled: true } })
  win.show()
  snapBall(state.ball.side)
}

export function snapBall(side?: 'left' | 'right'): void {
  const win = getBallWindow()
  if (!win) return
  const state = getState()
  const bounds = win.getBounds()
  const wa = workArea(win)
  const target = side ?? (bounds.x + bounds.width / 2 < wa.x + wa.width / 2 ? 'left' : 'right')

  const x = target === 'right' ? wa.x + wa.width - bounds.width - MARGIN : wa.x + MARGIN
  const y = Math.min(
    Math.max(bounds.y, wa.y + MARGIN),
    wa.y + wa.height - bounds.height - MARGIN
  )
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: bounds.width, height: bounds.height })
  if (state.ball.side !== target) {
    patchState({ ball: { ...state.ball, side: target } })
  }
}

/** 拖动结束后按窗口中心落在屏幕哪一侧吸附 */
export function settleBall(): void {
  const win = getBallWindow()
  if (!win) return
  const bounds = win.getBounds()
  const wa = workArea(win)
  const center = bounds.x + bounds.width / 2
  const side = center < wa.x + wa.width / 2 ? 'left' : 'right'
  snapBall(side)
}

export function moveBallBy(dx: number, dy: number): void {
  const win = getBallWindow()
  if (!win) return
  const b = win.getBounds()
  const wa = workArea(win)
  const x = Math.min(Math.max(b.x + dx, wa.x - 8), wa.x + wa.width - b.width + 8)
  const y = Math.min(Math.max(b.y + dy, wa.y), wa.y + wa.height - b.height)
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: b.width, height: b.height })
}

/** 展开快捷菜单：窗口变大但球心保持原位 */
export function setBallExpanded(expanded: boolean): void {
  const win = getBallWindow()
  if (!win) return
  const b = win.getBounds()
  const wa = workArea(win)
  if (expanded) {
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    let x = Math.round(cx - MENU / 2)
    let y = Math.round(cy - MENU / 2)
    x = Math.min(Math.max(x, wa.x), wa.x + wa.width - MENU)
    y = Math.min(Math.max(y, wa.y), wa.y + wa.height - MENU)
    win.setBounds({ x, y, width: MENU, height: MENU })
  } else {
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const size = getState().ball.size
    win.setBounds({
      x: Math.round(cx - size / 2),
      y: Math.round(cy - size / 2),
      width: size,
      height: size
    })
    snapBall()
  }
}

export function notifyBall(payload: { expanded: boolean; side: 'left' | 'right' }): void {
  const win = getBallWindow()
  if (win) win.webContents.send('ball:state', payload)
}
