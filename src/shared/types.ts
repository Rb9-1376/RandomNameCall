/** 主进程 / 预加载 / 渲染进程共享的数据契约 */

export type Density = 'compact' | 'normal' | 'comfort' | 'large'
export type ThemeName = 'dark' | 'light' | 'contrast'
export type EncodingName =
  | '自动'
  | 'UTF-8'
  | 'UTF-8-SIG'
  | 'UTF-16'
  | 'UTF-16 LE'
  | 'UTF-16 BE'
  | 'GB18030'
  | 'GB2312'
  | 'BIG5'

export interface UiSettings {
  fullscreen: boolean
  uiScale: number
  density: Density | 'auto'
  theme: ThemeName
  fontFamily: string
  fontSize: number
  autoFit: boolean
  background: string
  buttonbg: string
  nameColor: string
  alpha: number
  topmost: boolean
  slim: boolean
  autoCenter: boolean
  /** 低配模式：关闭毛玻璃/重动画/渐变，适配学校老电脑 */
  perfMode: boolean
  /** 界面语言（zh/en/ru/ko/ja/ar/es/hi/fr/bo/ug/mn/ii） */
  lang: string
  /** 2 = 已做过"默认浅色"迁移；3 = 已做"默认窗口化"迁移；老文件缺省按 0 处理 */
  migrated?: number
}

export interface RollSettings {
  speed: number
  extractAnimation: boolean
  noRepeat: boolean
  add1Tip: boolean
}

export interface SoundSettings {
  click: number
  bgm: number
  bgmFile: string | null
  tts: boolean
  voice: string
  rate: number
}

export interface NetSettings {
  onlineEnabled: boolean
  proxyMode: 'system' | 'custom' | 'none'
  proxyRules: string
  mirrorOrder: string[]
  preferredMirror: string | null
  rosterSources: string[]
  rosterRefreshHours: number
}

export interface UpdateSettings {
  checkOnStart: boolean
  skippedVersions: string[]
}

export interface ClassSource {
  type: 'builtin' | 'local' | 'online'
  path?: string
  url?: string
}

export interface ClassData {
  id: string
  name: string
  locked: boolean
  source: ClassSource
  encoding: EncodingName
  names: string[]
  havenames: string[]
}

export interface DrawRecord {
  id: string
  name: string
  ts: number
  classId: string
  mode: 'draw' | 'roll'
  revoked: boolean
}

export interface BallSettings {
  enabled: boolean
  side: 'left' | 'right'
  size: number
  focusable: boolean
}

export interface AppState {
  schema: 3
  ui: UiSettings
  roll: RollSettings
  sound: SoundSettings
  net: NetSettings
  update: UpdateSettings
  ball: BallSettings
  classes: ClassData[]
  activeClassId: string
  cumulative: Record<string, number>
  records: DrawRecord[]
  historyFiles: string[]
  /** 首次启动向导是否已走完 */
  onboarded?: boolean
  version: number[]
}

export interface DrawResult {
  id: string
  name: string
  poolLeft: number
  total: number
  cumulative: number
  at: number
  mode: 'draw' | 'roll'
}

export interface RuntimeInfo {
  version: string
  dataDir: string
  density: Density
  scaleFactor: number
  screen: { width: number; height: number }
  platform: string
  ballSide: 'left' | 'right'
  ballEnabled: boolean
}

export interface MirrorProbe {
  id: string
  label: string
  ms: number | null
}

export interface UpdateInfo {
  latest: string
  notes: string
  downloads: { label: string; url: string }[]
  /** 安装包直链（一键更新用，取 Release 第一个 exe 资产） */
  downloadUrl: string
  /** GitHub Release 页面（手动下载方案） */
  htmlUrl: string
  forced: boolean
}

export interface UpdateProgress {
  received: number
  total: number
}

export interface FileReadResult {
  path: string
  encoding: string
  names: string[]
  warnings: string[]
}

export interface RosterResult {
  ok: boolean
  added: number
  updated: number
  fromCache: boolean
  message: string
  at: number
}

/** 名单体检结果 */
export interface NameAudit {
  total: number
  unique: number
  duplicates: { name: string; count: number }[]
  empties: number
  tooLong: { name: string; length: number }[]
  suspicious: { name: string; reason: string }[]
  fixedNames: string[]
  /** 一键修复会改掉多少条 */
  fixable: number
}

export interface InfoPayload {
  title: string
  body: string
  kind?: 'info' | 'error' | 'help'
}

export interface Api {
  getState(): Promise<AppState>
  getRuntime(): Promise<RuntimeInfo>
  patchState(patch: Partial<AppState>): Promise<AppState>

  draw(): Promise<DrawResult | null>
  startRoll(): Promise<boolean>
  stopRoll(): Promise<DrawResult | null>
  undo(): Promise<DrawResult | null>
  resetPool(): Promise<void>
  bumpWeight(name: string): Promise<{ name: string; weight: number }>
  setClass(id: string): Promise<AppState>

  pickNamesFile(): Promise<FileReadResult | null>
  readNames(path: string, encoding: EncodingName): Promise<FileReadResult>
  reloadActiveClass(): Promise<FileReadResult | null>
  importBuiltin(): Promise<AppState>
  openNames(path: string): Promise<FileReadResult>
  clearHistory(): Promise<AppState>
  clearCumulative(): Promise<AppState>
  auditNames(): Promise<NameAudit>
  applyNameFix(): Promise<AppState>
  pickBgm(): Promise<string | null>
  openDataDir(): Promise<void>
  listFonts(): Promise<string[]>

  refreshRoster(): Promise<RosterResult>
  testMirrors(): Promise<MirrorProbe[]>
  checkUpdate(manual: boolean): Promise<UpdateInfo | null>
  downloadUpdate(): Promise<string | null>
  installUpdate(downloadPath: string): Promise<void>
  openReleasePage(): Promise<void>

  exportRecords(): Promise<string | null>
  saveText(defaultName: string, content: string): Promise<boolean>

  setFullscreen(v: boolean): Promise<void>
  setOpacity(v: number): Promise<void>
  setAlwaysOnTop(v: boolean): Promise<void>
  minimize(): Promise<void>
  hideMain(): Promise<void>
  quit(): Promise<void>

  ballShow(): Promise<void>
  ballHide(): Promise<void>
  ballSetSide(side: 'left' | 'right'): Promise<void>
  ballExpand(v: boolean): Promise<void>

  openExternal(url: string): Promise<void>
  logError(message: string): Promise<void>

  onTick(cb: (name: string) => void): () => void
  onResult(cb: (r: DrawResult) => void): () => void
  onState(cb: (s: AppState) => void): () => void
  onToast(cb: (t: { text: string; kind?: 'ok' | 'warn' | 'err' }) => void): () => void
}
