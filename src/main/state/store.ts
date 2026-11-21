import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AppState } from '@shared/types'
import { defaultState, migrateLegacy, normalize } from './defaults'
import { readNamesFile } from '../io/names'

let state: AppState | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<(s: AppState) => void>()

const MAX_BACKUPS = 14

export function resourcePath(name: string): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(app.getAppPath(), 'resources')
  return path.join(base, name)
}

export function dataDir(): string {
  return path.join(app.getPath('userData'), 'data')
}

export function statePath(): string {
  return path.join(dataDir(), 'data.json')
}

export function cachePath(name: string): string {
  return path.join(dataDir(), name)
}

function ensureDirs(): void {
  for (const sub of ['', 'backups', 'logs']) {
    fs.mkdirSync(path.join(dataDir(), sub), { recursive: true })
  }
}

function builtinNames(): string[] {
  try {
    return readNamesFile(resourcePath('names.txt'), '自动').names
  } catch {
    return []
  }
}

function findLegacyFile(): string | null {
  const candidates = [
    path.join(app.getPath('userData'), 'data.json'),
    path.join(process.cwd(), 'data.json'),
    path.join(app.getAppPath(), 'data.json')
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
    } catch {
      /* ignore */
    }
  }
  return null
}

function readJsonFile(file: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

export function ensureState(): AppState {
  if (state) return state
  ensureDirs()
  const names = builtinNames()
  const file = statePath()

  let raw: any = null
  if (fs.existsSync(file)) {
    raw = readJsonFile(file)
    if (!raw) {
      const bak = readJsonFile(file + '.bak')
      if (bak) {
        raw = bak
        logLine('warn', '主配置损坏，已从 .bak 恢复')
      }
    }
  } else {
    const legacy = findLegacyFile()
    if (legacy) {
      raw = readJsonFile(legacy)
      if (raw) logLine('info', `发现旧版配置：${legacy}`)
    }
  }

  const migrated = raw ? migrateLegacy(raw, names) : null
  state = migrated ?? normalize(raw, names)
  if (!migrated && !raw) state = defaultState(names)

  dailyBackup()
  persistNow()
  return state
}

export function getState(): AppState {
  return ensureState()
}

function persistNow(): void {
  if (!state) return
  const file = statePath()
  const tmp = file + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
    if (fs.existsSync(file)) {
      try {
        fs.copyFileSync(file, file + '.bak')
      } catch {
        /* ignore */
      }
    }
    fs.renameSync(tmp, file)
  } catch (err) {
    logLine('error', `保存失败：${String(err)}`)
  }
}

export function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    persistNow()
  }, 250)
}

export function flushState(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  persistNow()
}

export function patchState(patch: Partial<AppState>): AppState {
  const cur = ensureState()
  const next = normalize({ ...cur, ...patch }, builtinNames())
  state = next
  scheduleSave()
  for (const cb of listeners) cb(next)
  return next
}

export function replaceState(next: AppState): void {
  state = normalize(next, builtinNames())
  scheduleSave()
  for (const cb of listeners) cb(state)
}

export function onStateChange(cb: (s: AppState) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function dailyBackup(): void {
  try {
    const dir = path.join(dataDir(), 'backups')
    const stamp = new Date().toISOString().slice(0, 10)
    const target = path.join(dir, `data-${stamp}.json`)
    const src = statePath()
    if (!fs.existsSync(target) && fs.existsSync(src)) {
      fs.copyFileSync(src, target)
    }
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
    while (files.length > MAX_BACKUPS) {
      const victim = files.shift()!
      try {
        fs.unlinkSync(path.join(dir, victim))
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* 备份失败不影响启动 */
  }
}

export function logLine(level: 'info' | 'warn' | 'error', message: string): void {
  try {
    ensureDirs()
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
    fs.appendFileSync(path.join(dataDir(), 'logs', 'app.log'), line, 'utf8')
  } catch {
    /* ignore */
  }
}
