import { app, dialog, ipcMain, shell, screen } from 'electron'
import type { DownloadItem } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type {
  AppState,
  DrawResult,
  EncodingName,
  FileReadResult,
  RuntimeInfo,
  UpdateInfo
} from '@shared/types'
import { RollEngine } from './engine/RollEngine'
import {
  cachePath,
  dataDir,
  ensureState,
  flushState,
  getState,
  logLine,
  onStateChange,
  patchState,
  resourcePath
} from './state/store'
import { ENCODINGS, VERSION, dedupeNames, makeBuiltinClass } from './state/defaults'
import { readNamesFile } from './io/names'
import { listFonts, recordsToCsv } from './io/export'
import { refreshRoster as fetchRoster } from './io/roster'
import { watchNamesFile } from './io/watch'
import { auditNames, fixNames } from './io/audit'
import { applyProxy, probeMirrors, netSession } from './net/mirrors'
import { checkUpdate, PROBE_URL } from './net/update'
import { broadcast, densityFor, createMainWindow, getMainWindow, setQuitting } from './windows/main'
import {
  createBallWindow,
  destroyBallWindow,
  moveBallBy,
  notifyBall,
  setBallExpanded,
  setBallVisible,
  settleBall,
  snapBall
} from './windows/ball'

let engine: RollEngine

function activeClass(state: AppState) {
  return state.classes.find((c) => c.id === state.activeClassId) ?? state.classes[0]
}

function toast(text: string, kind: 'ok' | 'warn' | 'err' = 'ok'): void {
  broadcast('app:toast', { text, kind })
}

export function initEngine(): RollEngine {
  const state = ensureState()
  const cls = activeClass(state)
  engine = new RollEngine({
    cumulativeOf: (name) => getState().cumulative[name] ?? 0,
    bumpCumulative: (name, delta) => {
      const s = getState()
      const next = Math.max(0, (s.cumulative[name] ?? 0) + delta)
      const cumulative = { ...s.cumulative }
      if (next === 0) delete cumulative[name]
      else cumulative[name] = next
      patchState({ cumulative })
      return next
    },
    onTick: (name) => broadcast('roll:tick', name),
    onResult: (r) => {
      commitResult(r)
      broadcast('roll:result', r)
    },
    onToast: (text, kind) => toast(text, kind)
  })
  engine.load(cls.names, cls.havenames, state.roll.noRepeat, state.roll.speed)
  return engine
}

function commitResult(r: DrawResult): void {
  const state = getState()
  const classes = state.classes.map((c) =>
    c.id === state.activeClassId
      ? { ...c, havenames: engine.havenamesList.filter((n) => c.names.includes(n)) }
      : c
  )
  const records = [
    ...state.records,
    {
      id: r.id,
      name: r.name,
      ts: r.at,
      classId: state.activeClassId,
      mode: r.mode,
      revoked: false
    }
  ].slice(-5000)
  patchState({ classes, records })
}

export function getEngine(): RollEngine {
  return engine
}

export function reloadEngineForClass(): void {
  const state = getState()
  const cls = activeClass(state)
  engine.load(cls.names, cls.havenames, state.roll.noRepeat, state.roll.speed)
}

/** 重读当前班级的本地文件（按钮与文件监听共用） */
function reloadActiveFile(): FileReadResult | null {
  const state = getState()
  const cls = activeClass(state)
  if (!cls.source.path || !fs.existsSync(cls.source.path)) {
    toast('当前班级不是本地文件', 'warn')
    return null
  }
  const read = readNamesFile(cls.source.path, cls.encoding)
  if (!read.names.length) {
    toast('重读失败：没有解析到姓名，检查编码', 'err')
    return read
  }
  const names = dedupeNames(read.names)
  const classes = state.classes.map((c) =>
    c.id === state.activeClassId
      ? {
          ...c,
          names,
          havenames: c.havenames.filter((n) => names.includes(n)),
          source: c.source.path === cls.source.path ? c.source : { type: 'local' as const, path: cls.source.path },
          path: cls.source.path
        }
      : c
  )
  patchState({ classes })
  reloadEngineForClass()
  return read
}

/** 只监听"本地文件"菜单；内置/在线班级不挂监听 */
function armNamesWatcher(): void {
  const cls = activeClass(getState())
  watchNamesFile(cls.source.type === 'local' ? cls.source.path : null, () => {
    const read = reloadActiveFile()
    if (read) toast(`名单文件已更新，自动重载 ${read.names.length} 人`, 'ok')
  })
}

/** 把某个文件载入当前班级（对话框与历史下拉共用） */
function loadNamesIntoActiveClass(file: string): FileReadResult {
  const state = getState()
  const cls = activeClass(state)
  const read = readNamesFile(file, cls.encoding)
  if (!read.names.length) {
    toast('没有读到姓名，检查一下编码', 'warn')
    return read
  }
  const names = dedupeNames(read.names)
  const historyFiles = [file, ...state.historyFiles.filter((f) => f !== file)].slice(0, 15)
  const classes = state.classes.map((c) =>
    c.id === state.activeClassId
      ? {
          ...c,
          path: file,
          source: { type: 'local' as const, path: file },
          names,
          havenames: []
        }
      : c
  )
  patchState({ classes, historyFiles })
  reloadEngineForClass()
  armNamesWatcher()
  toast(`已载入 ${names.length} 个姓名（${read.encoding}）`)
  return read
}

export function startNamesWatcher(): void {
  armNamesWatcher()
}

export function registerIpc(): void {
  // 状态一变就广播：主窗/悬浮球两个渲染进程都能立刻同步（热重载、在线名单、撤回）
  onStateChange((s) => broadcast('app:state', s))

  ipcMain.handle('app:getState', () => getState())

  ipcMain.handle('app:getRuntime', (): RuntimeInfo => {
    const state = getState()
    const display = screen.getPrimaryDisplay()
    return {
      version: VERSION.join('.'),
      dataDir: dataDir(),
      density: densityFor(display.size.width * display.scaleFactor),
      scaleFactor: display.scaleFactor,
      screen: { width: display.size.width, height: display.size.height },
      platform: process.platform,
      ballSide: state.ball.side,
      ballEnabled: state.ball.enabled
    }
  })

  ipcMain.handle('app:patchState', (_e, patch: Partial<AppState>): AppState => {
    const before = getState()
    const next = patchState(patch)
    if (patch.roll && before.roll.noRepeat !== next.roll.noRepeat) {
      engine.setNoRepeat(next.roll.noRepeat)
    }
    if (patch.roll && before.roll.speed !== next.roll.speed) {
      engine.setSpeed(next.roll.speed)
    }
    if (patch.ui) {
      const win = getMainWindow()
      if (win) {
        if (before.ui.alpha !== next.ui.alpha) win.setOpacity(next.ui.alpha)
        if (before.ui.topmost !== next.ui.topmost) {
          win.setAlwaysOnTop(next.ui.topmost, 'floating')
        }
        if (before.ui.fullscreen !== next.ui.fullscreen) win.setFullScreen(next.ui.fullscreen)
        if (before.ui.background !== next.ui.background) win.setBackgroundColor(next.ui.background)
      }
    }
    if (patch.ball) {
      if (before.ball.enabled !== next.ball.enabled) setBallVisible(next.ball.enabled)
      if (before.ball.side !== next.ball.side) snapBall(next.ball.side)
    }
    if (patch.net) void applyProxy(next.net)
    return next
  })

  ipcMain.handle('roll:draw', (): DrawResult | null => engine.draw())
  ipcMain.handle('roll:start', (): boolean => engine.start())
  ipcMain.handle('roll:stop', (): DrawResult | null => engine.stop())
  ipcMain.handle('roll:undo', (): DrawResult | null => {
    const r = engine.undo()
    if (!r) return null
    const state = getState()
    const classes = state.classes.map((c) =>
      c.id === state.activeClassId
        ? { ...c, havenames: engine.havenamesList.filter((n) => c.names.includes(n)) }
        : c
    )
    const records = state.records.map((rec) =>
      rec.id === r.id ? { ...rec, revoked: true } : rec
    )
    patchState({ classes, records })
    return r
  })
  ipcMain.handle('roll:resetPool', () => {
    const state = getState()
    const classes = state.classes.map((c) =>
      c.id === state.activeClassId ? { ...c, havenames: [] } : c
    )
    patchState({ classes, records: state.records })
    engine.load(activeClass(getState()).names, [], state.roll.noRepeat, state.roll.speed)
  })

  ipcMain.handle('roll:bump', (_e, name: string) => {
    const weight = engine.bump(name)
    return { name, weight }
  })

  ipcMain.handle('class:set', (_e, id: string) => {
    const state = patchState({ activeClassId: id })
    engine.load(
      activeClass(state).names,
      activeClass(state).havenames,
      state.roll.noRepeat,
      state.roll.speed
    )
    armNamesWatcher()
    return state
  })

  ipcMain.handle('names:pick', async (): Promise<FileReadResult | null> => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: '选择姓名文件',
      properties: ['openFile'],
      filters: [
        { name: '名单文件', extensions: ['txt', 'csv', 'xlsx', 'xls'] },
        { name: '全部文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths.length) return null
    return loadNamesIntoActiveClass(result.filePaths[0])
  })

  ipcMain.handle('names:open', (_e, file: string): FileReadResult => {
    if (!fs.existsSync(file)) {
      const read: FileReadResult = { path: file, encoding: '自动', names: [], warnings: ['文件不存在'] }
      toast('这个文件已经不在了，请重新选择', 'warn')
      return read
    }
    return loadNamesIntoActiveClass(file)
  })

  ipcMain.handle('roll:clearCumulative', () => {
    const state = patchState({ cumulative: {} })
    return state
  })

  ipcMain.handle('names:clearHistory', () => {
    const state = patchState({ historyFiles: [] })
    return state
  })

  ipcMain.handle('names:read', (_e, file: string, encoding: EncodingName) => {
    if (!fs.existsSync(file)) return { path: file, encoding, names: [], warnings: ['文件不存在'] }
    return readNamesFile(file, encoding)
  })

  ipcMain.handle('names:reload', (): FileReadResult | null => {
    const read = reloadActiveFile()
    if (read && read.names.length) toast(`名单已重新读取（${read.names.length} 人）`)
    return read
  })

  ipcMain.handle('names:audit', () => {
    const state = getState()
    const cls = state.classes.find((c) => c.id === state.activeClassId) ?? state.classes[0]
    return auditNames(cls.names)
  })

  ipcMain.handle('names:fix', () => {
    const state = getState()
    const classes = state.classes.map((c) => {
      if (c.id !== state.activeClassId) return c
      const names = fixNames(c.names)
      return {
        ...c,
        names,
        havenames: c.havenames.filter((n) => names.includes(n))
      }
    })
    const next = patchState({ classes })
    reloadEngineForClass()
    toast(`名单已整理：${next.classes.find((c) => c.id === next.activeClassId)?.names.length ?? 0} 人`)
    return next
  })

  ipcMain.handle('names:importBuiltin', () => {
    const state = getState()
    const names = readNamesFile(resourcePath('names.txt'), '自动').names
    const cls = makeBuiltinClass(names)
    const classes = state.classes.some((c) => c.id === 'builtin')
      ? state.classes.map((c) => (c.id === 'builtin' ? { ...cls, id: 'builtin' } : c))
      : [...state.classes, cls]
    patchState({ classes, activeClassId: 'builtin' })
    reloadEngineForClass()
    armNamesWatcher()
    return getState()
  })

  ipcMain.handle('fonts:list', () => listFonts())

  ipcMain.handle('sound:pickBgm', async (): Promise<string | null> => {
    const win = getMainWindow()
    const picked = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择背景音乐',
      properties: ['openFile'],
      filters: [
        { name: '音频', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] },
        { name: '全部文件', extensions: ['*'] }
      ]
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const file = picked.filePaths[0]
    const state = getState()
    patchState({ sound: { ...state.sound, bgmFile: file, bgm: Math.max(state.sound.bgm, 0.35) } })
    return file
  })

  ipcMain.handle('app:openDataDir', async () => {
    const dir = dataDir()
    fs.mkdirSync(dir, { recursive: true })
    await shell.openPath(dir)
  })

  ipcMain.handle('roster:refresh', async () => {
    const state = getState()
    const result = await fetchRoster(state.net, state.classes)
    if (result.ok) {
      patchState({ classes: state.classes })
      reloadEngineForClass()
    }
    toast(result.message, result.ok ? 'ok' : 'warn')
    return result
  })

  ipcMain.handle('net:probe', async () => {
    const state = getState()
    return probeMirrors(PROBE_URL, state.net)
  })

  ipcMain.handle('update:check', async (_e, manual: boolean): Promise<UpdateInfo | null> => {
    const state = getState()
    try {
      const info = await checkUpdate(state.net)
      if (info) broadcast('update:available', info)
      else if (manual) toast(`已是最新版本 v${VERSION.join('.')}`)
      return info
    } catch (err) {
      logLine('warn', `更新检查失败：${String(err)}`)
      if (manual) toast('检查失败：网络不可达或线路被拦截', 'err')
      return null
    }
  })

  // 一键更新：后台下载安装包（进度通过 update:progress 广播）
  ipcMain.handle('update:download', async (): Promise<string | null> => {
    const info = await checkUpdate(getState().net)
    if (!info || !info.downloadUrl) {
      toast('没有可下载的更新', 'warn')
      return null
    }
    const target = path.join(app.getPath('temp'), `RandomNameCall-${info.latest}-setup.exe`)
    const ses = netSession()
    try {
      const item = await new Promise<DownloadItem>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('下载超时')), 15000)
        const handler = (_e: Electron.Event, dl: DownloadItem): void => {
          clearTimeout(timer)
          ses.removeListener('will-download', handler)
          resolve(dl)
        }
        ses.on('will-download', handler)
        void ses.downloadURL(info.downloadUrl)
      })
      item.setSavePath(target)
      item.on('updated', (_e, state) => {
        if (state === 'progressing') {
          broadcast('update:progress', {
            received: item.getReceivedBytes(),
            total: item.getTotalBytes()
          })
        }
      })
      let ok = false
      await new Promise<void>((resolve) => {
        item.once('done', (_e, state) => {
          if (state === 'completed') {
            ok = true
            broadcast('update:downloaded', { path: target, latest: info.latest })
          } else {
            broadcast('update:download-failed', { reason: state })
          }
          resolve()
        })
      })
      return ok ? target : null
    } catch (err) {
      logLine('warn', `下载更新失败：${String(err)}`)
      broadcast('update:download-failed', { reason: String(err) })
      return null
    }
  })

  // 下载完成后：启动安装程序并退出当前应用
  ipcMain.handle('update:install', async (_e, downloadPath: string) => {
    if (!downloadPath || !fs.existsSync(downloadPath) || !/\.exe$/i.test(downloadPath)) {
      toast('安装包不存在，请重新下载', 'err')
      return
    }
    logLine('info', `启动更新安装包：${downloadPath}`)
    // 用系统外壳打开安装包（前台可见的交互式安装），避免直接 spawn 子进程触发杀软启发式
    const err = await shell.openPath(downloadPath)
    if (err) {
      toast(`无法启动安装包：${err}`, 'err')
      return
    }
    flushState()
    setQuitting(true)
    app.quit()
  })

  // 方案二：打开 GitHub Release 下载页让用户手动下载
  ipcMain.handle('update:openPage', async () => {
    const info = await checkUpdate(getState().net)
    const url = info?.htmlUrl || 'https://github.com/Rb9-1376/RandomNameCall/releases'
    await shell.openExternal(url)
  })

  ipcMain.handle('records:export', async (): Promise<string | null> => {
    const state = getState()
    const win = getMainWindow()
    const names: Record<string, string> = {}
    for (const c of state.classes) names[c.id] = c.name
    const csv = recordsToCsv(state.records, names)
    const stamp = new Date().toISOString().slice(0, 10)
    // 自动化测试可以用 RNC_EXPORT_TO 指定路径，跳过保存对话框
    const preset = process.env.RNC_EXPORT_TO
    const result = preset
      ? { canceled: false, filePath: preset }
      : await dialog.showSaveDialog(win!, {
          title: '导出点名记录',
          defaultPath: path.join(app.getPath('documents'), `点名记录-${stamp}.csv`),
          filters: [{ name: 'CSV', extensions: ['csv'] }]
        })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, csv, 'utf8')
    toast('记录已导出')
    return result.filePath
  })

  ipcMain.handle('info:saveText', async (_e, defaultName: string, content: string) => {
    const win = getMainWindow()
    const result = await dialog.showSaveDialog(win!, {
      title: '保存文本',
      defaultPath: path.join(app.getPath('documents'), defaultName)
    })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, content, 'utf8')
    return true
  })

  ipcMain.handle('window:fullscreen', (_e, v: boolean) => {
    const win = getMainWindow()
    win?.setFullScreen(v)
    const state = getState()
    patchState({ ui: { ...state.ui, fullscreen: v } })
  })
  ipcMain.handle('window:opacity', (_e, v: number) => {
    const win = getMainWindow()
    win?.setOpacity(Math.min(1, Math.max(0.35, v)))
  })
  ipcMain.handle('window:alwaysOnTop', (_e, v: boolean) => {
    const win = getMainWindow()
    win?.setAlwaysOnTop(v, 'floating')
  })
  ipcMain.handle('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.handle('window:hide', () => getMainWindow()?.hide())
  ipcMain.handle('app:quit', () => {
    flushState()
    app.quit()
  })
  ipcMain.handle('app:log', (_e, message: string) => logLine('error', String(message)))

  ipcMain.handle('ball:show', () => {
    setBallVisible(true)
    createBallWindow()
  })
  ipcMain.handle('ball:hide', () => setBallVisible(false))
  ipcMain.handle('ball:side', (_e, side: 'left' | 'right') => snapBall(side))
  ipcMain.handle('ball:expand', (_e, v: boolean) => {
    setBallExpanded(v)
    const state = getState()
    notifyBall({ expanded: v, side: state.ball.side })
  })
  ipcMain.on('ball:move', (_e, dx: number, dy: number) => moveBallBy(dx, dy))
  ipcMain.on('ball:settle', () => settleBall())
  ipcMain.on('ball:action', (_e, action: string) => {
    setBallExpanded(false)
    // 主窗被系统 X 收起后是隐藏而非销毁；若真被销毁（异常路径）则重建
    const win = getMainWindow() ?? createMainWindow()
    if (action === 'show') {
      win.show()
      win.focus()
    } else if (action === 'draw') {
      win.show()
      engine.draw()
    } else if (action === 'roll') {
      win.show()
      engine.start()
    } else if (action === 'settings') {
      win.show()
      win.focus()
      const send = (): void => broadcast('ui:openSettings', true)
      if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
      else send()
    } else if (action === 'hide') {
      win.hide()
    }
    notifyBall({ expanded: false, side: getState().ball.side })
  })

  ipcMain.handle('shell:open', (_e, url: string) => {
    if (/^https?:/i.test(url)) return shell.openExternal(url)
    return undefined
  })

  ipcMain.on('app:flush', () => flushState())
}

export { cachePath, destroyBallWindow }
