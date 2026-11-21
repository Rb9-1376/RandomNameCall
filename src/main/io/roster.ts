import fs from 'node:fs'
import type { ClassData, NetSettings, RosterResult } from '@shared/types'
import { cachePath } from '../state/store'
import { applyProxy, fetchWithMirrors } from '../net/mirrors'
import { dedupeNames } from '../state/defaults'

interface RosterClass {
  id: string
  name: string
  names: string[]
  locked?: boolean
}

interface RosterDoc {
  schema?: number
  updatedAt?: string
  classes: RosterClass[]
}

interface RosterCache {
  etag?: string
  fetchedAt: number
  source: string
  classes: RosterClass[]
}

const CACHE_FILE = 'roster-cache.json'

export function readCache(): RosterCache | null {
  try {
    const raw = fs.readFileSync(cachePath(CACHE_FILE), 'utf8')
    const parsed = JSON.parse(raw) as RosterCache
    if (!parsed || !Array.isArray(parsed.classes)) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(cache: RosterCache): void {
  try {
    fs.writeFileSync(cachePath(CACHE_FILE), JSON.stringify(cache, null, 2), 'utf8')
  } catch {
    /* 缓存失败不影响主流程 */
  }
}

function parseRoster(text: string): RosterClass[] {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    const doc = JSON.parse(trimmed) as RosterDoc
    const classes = Array.isArray(doc.classes) ? doc.classes : []
    return classes
      .filter((c) => c && typeof c.id === 'string' && Array.isArray(c.names))
      .map((c) => ({
        id: c.id,
        name: typeof c.name === 'string' && c.name ? c.name : c.id,
        names: dedupeNames(c.names.map(String)),
        locked: Boolean(c.locked)
      }))
      .filter((c) => c.names.length > 0)
  }
  const names = dedupeNames(
    trimmed
      .split(/\r\n|\r|\n/)
      .map((l) => l.split(/[,，;；\t]/)[0] ?? '')
      .map((s) => s.trim())
  )
  return names.length
    ? [{ id: 'online-default', name: '在线名单', names, locked: false }]
    : []
}

/**
 * 拉取在线名单并合并进本地班级：
 * - locked 班级不被覆盖
 * - 远端消失的班级只标灰（在 UI 层），这里保留数据
 * - 失败时回落到缓存
 */
export async function refreshRoster(
  cfg: NetSettings,
  classes: ClassData[]
): Promise<RosterResult> {
  const sources = cfg.rosterSources.filter(Boolean)
  if (!cfg.onlineEnabled || !sources.length) {
    const cached = readCache()
    return {
      ok: false,
      added: 0,
      updated: 0,
      fromCache: Boolean(cached),
      message: cfg.onlineEnabled ? '还没有配置在线名单地址' : '在线名单未启用',
      at: Date.now()
    }
  }

  await applyProxy(cfg)
  let lastError = ''
  for (const source of sources) {
    try {
      const { text } = await fetchWithMirrors(source, cfg, 6000)
      const remote = parseRoster(text)
      if (!remote.length) {
        lastError = '远端没有解析到班级'
        continue
      }
      writeCache({ fetchedAt: Date.now(), source, classes: remote })

      let added = 0
      let updated = 0
      for (const rc of remote) {
        const local = classes.find((c) => c.id === rc.id && c.source.type === 'online')
        if (!local) {
          classes.push({
            id: rc.id,
            name: rc.name,
            locked: Boolean(rc.locked),
            source: { type: 'online', url: source },
            encoding: '自动',
            names: rc.names,
            havenames: []
          })
          added++
        } else if (!local.locked) {
          local.names = rc.names
          local.name = rc.name
          local.havenames = local.havenames.filter((n) => rc.names.includes(n))
          updated++
        }
      }
      return {
        ok: true,
        added,
        updated,
        fromCache: false,
        message: `在线名单已更新：新增 ${added}，更新 ${updated}`,
        at: Date.now()
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  const cached = readCache()
  if (cached) {
    return {
      ok: false,
      added: 0,
      updated: 0,
      fromCache: true,
      message: `在线更新失败（${lastError}），已使用 ${new Date(cached.fetchedAt).toLocaleString('zh-CN')} 的缓存`,
      at: cached.fetchedAt
    }
  }
  return {
    ok: false,
    added: 0,
    updated: 0,
    fromCache: false,
    message: `在线名单拉取失败：${lastError}`,
    at: Date.now()
  }
}
