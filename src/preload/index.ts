import { contextBridge, ipcRenderer } from 'electron'
import type {
  NameAudit,
  AppState,
  DrawResult,
  EncodingName,
  FileReadResult,
  InfoPayload,
  MirrorProbe,
  RuntimeInfo,
  UpdateInfo,
  Api
} from '@shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: unknown, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler as never)
  return () => ipcRenderer.removeListener(channel, handler as never)
}

const api: Api = {
  getState: () => ipcRenderer.invoke('app:getState') as Promise<AppState>,
  getRuntime: () => ipcRenderer.invoke('app:getRuntime') as Promise<RuntimeInfo>,
  patchState: (patch) => ipcRenderer.invoke('app:patchState', patch) as Promise<AppState>,

  draw: () => ipcRenderer.invoke('roll:draw') as Promise<DrawResult | null>,
  startRoll: () => ipcRenderer.invoke('roll:start') as Promise<boolean>,
  stopRoll: () => ipcRenderer.invoke('roll:stop') as Promise<DrawResult | null>,
  undo: () => ipcRenderer.invoke('roll:undo') as Promise<DrawResult | null>,
  resetPool: () => ipcRenderer.invoke('roll:resetPool') as Promise<void>,
  bumpWeight: (name) =>
    ipcRenderer.invoke('roll:bump', name) as Promise<{ name: string; weight: number }>,
  setClass: (id) => ipcRenderer.invoke('class:set', id) as Promise<AppState>,

  pickNamesFile: () => ipcRenderer.invoke('names:pick') as Promise<FileReadResult | null>,
  readNames: (path, encoding: EncodingName) =>
    ipcRenderer.invoke('names:read', path, encoding) as Promise<FileReadResult>,
  reloadActiveClass: () =>
    ipcRenderer.invoke('names:reload') as Promise<FileReadResult | null>,
  importBuiltin: () => ipcRenderer.invoke('names:importBuiltin') as Promise<AppState>,
  openNames: (path) => ipcRenderer.invoke('names:open', path) as Promise<FileReadResult>,
  clearHistory: () => ipcRenderer.invoke('names:clearHistory') as Promise<AppState>,
  clearCumulative: () => ipcRenderer.invoke('roll:clearCumulative') as Promise<AppState>,
  auditNames: () => ipcRenderer.invoke('names:audit') as Promise<NameAudit>,
  applyNameFix: () => ipcRenderer.invoke('names:fix') as Promise<AppState>,
  pickBgm: () => ipcRenderer.invoke('sound:pickBgm') as Promise<string | null>,
  openDataDir: () => ipcRenderer.invoke('app:openDataDir') as Promise<void>,
  listFonts: () => ipcRenderer.invoke('fonts:list') as Promise<string[]>,

  refreshRoster: () => ipcRenderer.invoke('roster:refresh'),
  testMirrors: () => ipcRenderer.invoke('net:probe') as Promise<MirrorProbe[]>,
  checkUpdate: (manual) => ipcRenderer.invoke('update:check', manual) as Promise<UpdateInfo | null>,
  downloadUpdate: () => ipcRenderer.invoke('update:download') as Promise<string | null>,
  installUpdate: (downloadPath) =>
    ipcRenderer.invoke('update:install', downloadPath) as Promise<void>,
  openReleasePage: () => ipcRenderer.invoke('update:openPage') as Promise<void>,

  exportRecords: () => ipcRenderer.invoke('records:export') as Promise<string | null>,
  saveText: (defaultName, content) =>
    ipcRenderer.invoke('info:saveText', defaultName, content) as Promise<boolean>,

  setFullscreen: (v) => ipcRenderer.invoke('window:fullscreen', v) as Promise<void>,
  setOpacity: (v) => ipcRenderer.invoke('window:opacity', v) as Promise<void>,
  setAlwaysOnTop: (v) => ipcRenderer.invoke('window:alwaysOnTop', v) as Promise<void>,
  minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
  hideMain: () => ipcRenderer.invoke('window:hide') as Promise<void>,
  quit: () => ipcRenderer.invoke('app:quit') as Promise<void>,

  ballShow: () => ipcRenderer.invoke('ball:show') as Promise<void>,
  ballHide: () => ipcRenderer.invoke('ball:hide') as Promise<void>,
  ballSetSide: (side) => ipcRenderer.invoke('ball:side', side) as Promise<void>,
  ballExpand: (v) => ipcRenderer.invoke('ball:expand', v) as Promise<void>,

  openExternal: (url) => ipcRenderer.invoke('shell:open', url) as Promise<void>,
  logError: (message) => ipcRenderer.invoke('app:log', message) as Promise<void>,

  onTick: (cb) => subscribe<string>('roll:tick', cb),
  onResult: (cb) => subscribe<DrawResult>('roll:result', cb),
  onState: (cb) => subscribe<AppState>('app:state', cb),
  onToast: (cb) => subscribe<{ text: string; kind?: 'ok' | 'warn' | 'err' }>('app:toast', cb)
}

const extra = {
  onUpdate: (cb: (info: UpdateInfo) => void): (() => void) => subscribe('update:available', cb),
  onUpdateProgress: (
    cb: (p: { received: number; total: number }) => void
  ): (() => void) => subscribe('update:progress', cb),
  onUpdateDownloaded: (
    cb: (p: { path: string; latest: string }) => void
  ): (() => void) => subscribe('update:downloaded', cb),
  onUpdateDownloadFailed: (cb: (p: { reason: string }) => void): (() => void) =>
    subscribe('update:download-failed', cb),
  onOpenSettings: (cb: () => void): (() => void) =>
    subscribe<boolean>('ui:openSettings', () => cb()),
  onMetrics: (
    cb: (m: { width: number; height: number; scaleFactor: number }) => void
  ): (() => void) => subscribe('ui:metrics', cb),
  ballMove: (dx: number, dy: number): void => ipcRenderer.send('ball:move', dx, dy),
  ballSettle: (): void => ipcRenderer.send('ball:settle'),
  ballAction: (action: 'show' | 'draw' | 'roll' | 'settings' | 'hide'): void =>
    ipcRenderer.send('ball:action', action),
  onBallState: (cb: (s: { expanded: boolean; side: 'left' | 'right' }) => void): (() => void) =>
    subscribe('ball:state', cb),
  flush: (): void => ipcRenderer.send('app:flush')
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('extra', extra)

export type { Api, InfoPayload }
