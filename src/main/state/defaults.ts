import { THEME_PALETTE } from '../../shared/theme'
import type {
  AppState,
  BallSettings,
  ClassData,
  DrawRecord,
  EncodingName,
  NetSettings,
  RollSettings,
  SoundSettings,
  UiSettings,
  UpdateSettings
} from '@shared/types'

export const FALLBACK_NAMES = [
  '张三',
  '李四',
  '王五',
  '赵六',
  '孙七',
  '周八',
  '吴九',
  '郑十',
  '陈一',
  '林二'
]

export const ENCODINGS: EncodingName[] = [
  '自动',
  'UTF-8',
  'UTF-8-SIG',
  'UTF-16',
  'UTF-16 LE',
  'UTF-16 BE',
  'GB18030',
  'GB2312',
  'BIG5'
]

export const VERSION = [0, 2, 0, 0] as number[]

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.min(max, Math.max(min, v))
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim().length > 0 ? v : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function hex(v: unknown, fallback: string): string {
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase()
  if (typeof v === 'string' && /^#[0-9a-fA-F]{3}$/.test(v)) {
    return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase()
  }
  return fallback
}

/** 有序去重：保留首次出现位置，丢弃空白项 */
export function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of names) {
    const n = String(raw).trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

export function defaultUi(): UiSettings {
  return {
    fullscreen: false,
    uiScale: 1,
    density: 'auto',
    theme: 'light',
    fontFamily: 'Microsoft YaHei',
    fontSize: 220,
    autoFit: true,
    background: THEME_PALETTE.light.background,
    buttonbg: THEME_PALETTE.light.buttonbg,
    nameColor: THEME_PALETTE.light.nameColor,
    alpha: 0.96,
    topmost: false,
    slim: false,
    autoCenter: true,
    perfMode: false,
    lang: 'zh',
    migrated: 3
  }
}

export function defaultRoll(): RollSettings {
  return { speed: 60, extractAnimation: true, noRepeat: false, add1Tip: true }
}

export function defaultSound(): SoundSettings {
  return { click: 0.7, bgm: 0, bgmFile: null, tts: false, voice: '', rate: 1 }
}

export function defaultNet(): NetSettings {
  return {
    onlineEnabled: false,
    proxyMode: 'system',
    proxyRules: '',
    mirrorOrder: ['direct', 'ghproxy', 'gh-proxy', 'kkgithub', 'jsdelivr'],
    preferredMirror: null,
    rosterSources: [],
    rosterRefreshHours: 24
  }
}

export function defaultUpdate(): UpdateSettings {
  return { checkOnStart: true, skippedVersions: [] }
}

export function defaultBall(): BallSettings {
  return { enabled: true, side: 'right', size: 112, focusable: false }
}

export function makeBuiltinClass(names: string[]): ClassData {
  return {
    id: 'builtin',
    name: '默认名单',
    locked: false,
    source: { type: 'builtin' },
    encoding: '自动',
    names: dedupeNames(names.length ? names : FALLBACK_NAMES),
    havenames: []
  }
}

export function defaultState(names: string[]): AppState {
  const cls = makeBuiltinClass(names)
  return {
    schema: 3,
    ui: defaultUi(),
    roll: defaultRoll(),
    sound: defaultSound(),
    net: defaultNet(),
    update: defaultUpdate(),
    ball: defaultBall(),
    classes: [cls],
    activeClassId: cls.id,
    cumulative: {},
    records: [],
    historyFiles: [],
    onboarded: false,
    version: VERSION
  }
}

function normalizeClass(raw: any, index: number): ClassData | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw.source && typeof raw.source === 'object' ? raw.source : { type: 'local' }
  const type = source.type === 'builtin' || source.type === 'online' ? source.type : 'local'
  const names = Array.isArray(raw.names) ? dedupeNames(raw.names.map(String)) : []
  if (!names.length) return null
  return {
    id: str(raw.id, `class-${index}`),
    name: str(raw.name, `班级 ${index + 1}`),
    locked: bool(raw.locked, false),
    source: {
      type,
      path: typeof source.path === 'string' ? source.path : undefined,
      url: typeof source.url === 'string' ? source.url : undefined
    },
    encoding: ENCODINGS.includes(raw.encoding) ? raw.encoding : '自动',
    names,
    havenames: Array.isArray(raw.havenames)
      ? raw.havenames.filter((n: unknown) => typeof n === 'string' && names.includes(n))
      : []
  }
}

function normalizeRecord(raw: any): DrawRecord | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.name !== 'string' || !raw.name) return null
  return {
    id: str(raw.id, `${raw.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    name: raw.name,
    ts: typeof raw.ts === 'number' ? raw.ts : Date.now(),
    classId: str(raw.classId, 'builtin'),
    mode: raw.mode === 'roll' ? 'roll' : 'draw',
    revoked: bool(raw.revoked, false)
  }
}

/** 任意来源（旧 data.json / 破损文件 / 未来版本）→ 当前 schema 的合法状态 */
export function normalize(raw: any, fallbackNames: string[]): AppState {
  const base = defaultState(fallbackNames)
  if (!raw || typeof raw !== 'object') return base

  const ui = raw.ui && typeof raw.ui === 'object' ? raw.ui : {}
  const roll = raw.roll && typeof raw.roll === 'object' ? raw.roll : {}
  const sound = raw.sound && typeof raw.sound === 'object' ? raw.sound : {}
  const net = raw.net && typeof raw.net === 'object' ? raw.net : {}
  const upd = raw.update && typeof raw.update === 'object' ? raw.update : {}
  const ball = raw.ball && typeof raw.ball === 'object' ? raw.ball : {}

  const uiOut: UiSettings = {
    fullscreen: bool(ui.fullscreen, base.ui.fullscreen),
    uiScale: clamp(ui.uiScale, 0.8, 1.6, 1),
    density: ['auto', 'compact', 'normal', 'comfort', 'large'].includes(ui.density)
      ? ui.density
      : 'auto',
    theme: ['dark', 'light', 'contrast'].includes(ui.theme) ? ui.theme : base.ui.theme,
    fontFamily: str(ui.fontFamily, base.ui.fontFamily),
    fontSize: clamp(ui.fontSize, 32, 480, base.ui.fontSize),
    autoFit: bool(ui.autoFit, true),
    background: hex(ui.background, base.ui.background),
    buttonbg: hex(ui.buttonbg, base.ui.buttonbg),
    nameColor: hex(ui.nameColor, base.ui.nameColor),
    alpha: clamp(ui.alpha, 0.35, 1, base.ui.alpha),
    topmost: bool(ui.topmost, false),
    slim: bool(ui.slim, false),
    autoCenter: bool(ui.autoCenter, true),
    perfMode: bool(ui.perfMode, false),
    lang: typeof ui.lang === 'string' && /^[a-z]{2}$/.test(ui.lang) ? ui.lang : 'zh',
    migrated: 3
  }

  // 0.2.0.0（浅色版）一次性迁移：老文件是深色主题 + 近白字，直接搬到白底会看不见。
  // 迁移只做一次（migrated < 2），之后用户自己选的深色不再被覆盖。
  const uiMigrated = typeof ui.migrated === 'number' ? ui.migrated : 0
  if (uiMigrated < 2) {
    if (ui.theme === 'dark') uiOut.theme = 'light'
    if (uiOut.nameColor === '#f4f7ff') uiOut.nameColor = THEME_PALETTE.light.nameColor
    if (uiOut.background === '#0b1020') uiOut.background = THEME_PALETTE.light.background
    if (uiOut.buttonbg === '#1c2740') uiOut.buttonbg = THEME_PALETTE.light.buttonbg
  }
  // 0.2.0.0 窗口化迁移：老数据默认全屏，一次性切回窗口模式；之后用户再开全屏不会被覆盖。
  if (uiMigrated < 3) {
    uiOut.fullscreen = false
  }

  const rollOut: RollSettings = {
    speed: clamp(roll.speed, 30, 400, base.roll.speed),
    extractAnimation: bool(roll.extractAnimation, true),
    noRepeat: bool(roll.noRepeat, false),
    add1Tip: bool(roll.add1Tip, true)
  }

  const soundOut: SoundSettings = {
    click: clamp(sound.click, 0, 1, base.sound.click),
    bgm: clamp(sound.bgm, 0, 1, base.sound.bgm),
    bgmFile: typeof sound.bgmFile === 'string' && sound.bgmFile ? sound.bgmFile : null,
    tts: bool(sound.tts, false),
    voice: typeof sound.voice === 'string' ? sound.voice : '',
    rate: clamp(sound.rate, 0.5, 2, 1)
  }

  const netOut: NetSettings = {
    onlineEnabled: bool(net.onlineEnabled, false),
    proxyMode: ['system', 'custom', 'none'].includes(net.proxyMode) ? net.proxyMode : 'system',
    proxyRules: typeof net.proxyRules === 'string' ? net.proxyRules : '',
    mirrorOrder: Array.isArray(net.mirrorOrder)
      ? net.mirrorOrder.filter((m: unknown) => typeof m === 'string')
      : base.net.mirrorOrder,
    preferredMirror:
      typeof net.preferredMirror === 'string' && net.preferredMirror ? net.preferredMirror : null,
    rosterSources: Array.isArray(net.rosterSources)
      ? net.rosterSources.filter((s: unknown) => typeof s === 'string' && s.trim())
      : [],
    rosterRefreshHours: clamp(net.rosterRefreshHours, 1, 168, 24)
  }

  const updOut: UpdateSettings = {
    checkOnStart: bool(upd.checkOnStart, true),
    skippedVersions: Array.isArray(upd.skippedVersions)
      ? upd.skippedVersions.filter((v: unknown) => typeof v === 'string')
      : []
  }

  const ballOut: BallSettings = {
    enabled: bool(ball.enabled, true),
    side: ball.side === 'left' ? 'left' : 'right',
    size: clamp(ball.size, 72, 160, 112),
    focusable: bool(ball.focusable, false)
  }

  const classesRaw: any[] = Array.isArray(raw.classes) ? raw.classes : []
  const classes = classesRaw
    .map((c, i) => normalizeClass(c, i))
    .filter((c): c is ClassData => c !== null)
  if (!classes.length) classes.push(base.classes[0])

  const cumulative: Record<string, number> = {}
  if (raw.cumulative && typeof raw.cumulative === 'object') {
    for (const [k, v] of Object.entries(raw.cumulative)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) cumulative[k] = Math.floor(v)
    }
  }

  const recordsRaw: unknown[] = Array.isArray(raw.records) ? (raw.records as unknown[]) : []
  const records = recordsRaw
    .map(normalizeRecord)
    .filter((r): r is DrawRecord => r !== null)
    .slice(-5000)

  const activeClassId = classes.some((c) => c.id === raw.activeClassId)
    ? raw.activeClassId
    : classes[0].id

  const historyRaw: unknown[] = Array.isArray(raw.historyFiles) ? (raw.historyFiles as unknown[]) : []
  const historyFiles = historyRaw
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .slice(0, 15)

  return {
    schema: 3,
    ui: uiOut,
    roll: rollOut,
    sound: soundOut,
    net: netOut,
    update: updOut,
    ball: ballOut,
    classes,
    activeClassId,
    cumulative,
    records,
    historyFiles,
    // 老文件没有这个字段：视为已用过，不再弹首次向导
    onboarded: typeof raw.onboarded === 'boolean' ? raw.onboarded : true,
    version: base.version
  }
}

/* ------------------------------------------------------------------ */
/* 旧版（PyQt data.json）迁移                                           */
/* ------------------------------------------------------------------ */

const LEGACY_ENCODING_MAP: Record<string, EncodingName> = {
  '0': 'UTF-8',
  '1': 'ANSI',
  '2': 'GB2312',
  '3': 'UTF-8-SIG',
  '4': 'UTF-16',
  '5': 'BIG5'
} as unknown as Record<string, EncodingName>

export function migrateLegacy(raw: any, fallbackNames: string[]): AppState | null {
  if (!raw || typeof raw !== 'object') return null
  const looksLegacy =
    'name_color' in raw || 'font_size' in raw || 'unrepeat' in raw || 'hide_unnecessary' in raw
  if (!looksLegacy) return null

  const state = defaultState(
    Array.isArray(raw.names) && raw.names.length ? raw.names : fallbackNames
  )
  const cls = state.classes[0]
  cls.names = dedupeNames(cls.names)
  cls.havenames = Array.isArray(raw.havenames)
    ? raw.havenames.filter((n: unknown) => typeof n === 'string' && cls.names.includes(n))
    : []
  state.cumulative = raw.cumulative && typeof raw.cumulative === 'object' ? raw.cumulative : {}

  state.ui = {
    ...state.ui,
    fontFamily: str(raw.font, state.ui.fontFamily),
    fontSize: clamp(raw.font_size, 32, 480, state.ui.fontSize),
    background: hex(raw.background, state.ui.background),
    buttonbg: hex(raw.buttonbg, state.ui.buttonbg),
    nameColor: hex(raw.name_color, state.ui.nameColor),
    alpha: clamp(raw.alpha, 0.35, 1, state.ui.alpha),
    topmost: bool(raw.topmost, false),
    slim: bool(raw.hide_unnecessary, false),
    autoCenter: bool(raw.window_auto_center, true)
  }
  state.roll = {
    ...state.roll,
    extractAnimation: bool(raw.extract_animation, true),
    noRepeat: bool(raw.unrepeat, false),
    add1Tip: bool(raw.add1_tip, true)
  }
  const legacyEncoding = raw.encoding
  if (typeof legacyEncoding === 'string' && ENCODINGS.includes(legacyEncoding as EncodingName)) {
    cls.encoding = legacyEncoding as EncodingName
  } else if (typeof legacyEncoding === 'string' && LEGACY_ENCODING_MAP[legacyEncoding]) {
    cls.encoding = LEGACY_ENCODING_MAP[legacyEncoding]
  }
  return normalize(state, fallbackNames)
}
