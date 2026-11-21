import { BrowserWindow, screen, shell } from 'electron'
import path from 'node:path'
import { app } from 'electron'
import { getState, logLine } from '../state/store'

let mainWindow: BrowserWindow | null = null
// 整体退出标记：app.quit() 时放行 close；用户点系统 X 只隐藏不销毁
let quitting = false

export function setQuitting(v: boolean): void {
  quitting = v
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function densityFor(physicalWidth: number): 'compact' | 'normal' | 'comfort' | 'large' {
  if (physicalWidth <= 1400) return 'compact'
  if (physicalWidth <= 2200) return 'normal'
  if (physicalWidth <= 3000) return 'comfort'
  return 'large'
}

export function createMainWindow(): BrowserWindow {
  const existing = getMainWindow()
  if (existing) return existing

  const state = getState()
  const display = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    width: Math.min(1600, display.workAreaSize.width),
    height: Math.min(900, display.workAreaSize.height),
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: state.ui.background,
    title: '随机点名',
    icon: path.join(
      app.isPackaged ? path.join(process.resourcesPath, 'resources') : path.join(app.getAppPath(), 'resources'),
      'icon.ico'
    ),
    autoHideMenuBar: true,
    // 原生窗口框：系统标题栏负责拖动与最小化/最大化/关闭，避免隐藏标题栏时顶栏按钮被遮挡点不动
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  })

  if (state.ui.fullscreen) {
    win.setFullScreen(true)
  }
  if (state.ui.topmost) {
    win.setAlwaysOnTop(true, 'floating')
  }
  win.setOpacity(state.ui.alpha)

  win.once('ready-to-show', () => {
    win.show()
    if (state.ui.autoCenter) win.center()
  })

  // 系统 X / Alt+F4：收起进悬浮球（隐藏而非销毁），悬浮球可随时唤回；
  // 真正的退出走顶栏「关闭」按钮（app.quit，由 before-quit 置 quitting 放行）
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win.hide()
    }
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    logLine('error', `渲染进程崩溃：${details.reason}`)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/index.html#/main`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/main' })
  }

  mainWindow = win
  return win
}

export function broadcast(channel: string, payload: unknown): void {
  const win = getMainWindow()
  if (win) win.webContents.send(channel, payload)
}
