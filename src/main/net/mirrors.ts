import { session, net } from 'electron'
import type { MirrorProbe, NetSettings } from '@shared/types'

export interface Mirror {
  id: string
  label: string
  build: (url: string) => string
}

/** 公共加速通道：只改写 URL，不触碰目标内容 */
export const MIRRORS: Mirror[] = [
  { id: 'direct', label: '直连', build: (u) => u },
  { id: 'ghproxy', label: 'ghproxy.net', build: (u) => `https://ghproxy.net/${u}` },
  { id: 'gh-proxy', label: 'gh-proxy.com', build: (u) => `https://gh-proxy.com/${u}` },
  {
    id: 'kkgithub',
    label: 'kkgithub',
    build: (u) =>
      u.replace('https://raw.githubusercontent.com/', 'https://raw.kkgithub.com/').replace(
        'https://github.com/',
        'https://kkgithub.com/'
      )
  },
  {
    id: 'jsdelivr',
    label: 'jsDelivr',
    build: (u) => {
      const m = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(u)
      if (!m) return u
      return `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}`
    }
  }
]

const PARTITION = 'persist:rnc-net'
const DOWN_COOLDOWN = 10 * 60 * 1000
const OK_TTL = 6 * 60 * 60 * 1000

const downUntil = new Map<string, number>()
let bestMirror: { id: string; at: number } | null = null

export function netSession() {
  return session.fromPartition(PARTITION)
}

export async function applyProxy(cfg: Pick<NetSettings, 'proxyMode' | 'proxyRules'>): Promise<void> {
  const ses = netSession()
  if (cfg.proxyMode === 'custom' && cfg.proxyRules.trim()) {
    await ses.setProxy({ proxyRules: cfg.proxyRules.trim(), proxyBypassRules: '<local>' })
  } else if (cfg.proxyMode === 'none') {
    await ses.setProxy({ mode: 'direct' })
  } else {
    await ses.setProxy({ mode: 'system' })
  }
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      }
    )
  })
}

async function fetchOnce(url: string, ms: number): Promise<string> {
  const ses = netSession()
  const res = await timeout(ses.fetch(url, { cache: 'no-store' }), ms)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.text()
}

/** 按设置里的镜像顺序竞速，4s 单线路超时，胜者缓存 6 小时 */
export async function fetchWithMirrors(
  url: string,
  cfg: NetSettings,
  ms = 4000
): Promise<{ text: string; mirror: string }> {
  const order = cfg.mirrorOrder.length ? cfg.mirrorOrder : MIRRORS.map((m) => m.id)
  const mirrors = order
    .map((id) => MIRRORS.find((m) => m.id === id))
    .filter((m): m is Mirror => Boolean(m))

  const preferred = cfg.preferredMirror
  const now = Date.now()
  const healthy = mirrors.filter((m) => (downUntil.get(m.id) ?? 0) < now)
  const ranked = [
    ...healthy.filter((m) => m.id === (bestMirror && now - bestMirror.at < OK_TTL ? bestMirror.id : preferred)),
    ...healthy.filter((m) => m.id !== (bestMirror?.id ?? preferred))
  ]
  const candidates = ranked.length ? ranked : mirrors

  const attempts = candidates.map(async (m) => {
    const target = m.build(url)
    try {
      const text = await fetchOnce(target, ms)
      bestMirror = { id: m.id, at: Date.now() }
      downUntil.delete(m.id)
      return { text, mirror: m.id }
    } catch (err) {
      downUntil.set(m.id, Date.now() + DOWN_COOLDOWN)
      throw err
    }
  })

  try {
    return await Promise.any(attempts)
  } catch {
    throw new Error('所有线路都不可达')
  }
}

export async function probeMirrors(url: string, cfg: NetSettings): Promise<MirrorProbe[]> {
  await applyProxy(cfg)
  const results = await Promise.all(
    MIRRORS.map(async (m) => {
      const t0 = Date.now()
      try {
        const res = await timeout(netSession().fetch(m.build(url), { method: 'HEAD' }), 4000)
        return { id: m.id, label: m.label, ms: res.ok ? Date.now() - t0 : null }
      } catch {
        return { id: m.id, label: m.label, ms: null }
      }
    })
  )
  return results
}

export function resetMirrorCache(): void {
  bestMirror = null
  downUntil.clear()
}

export function netOnline(): boolean {
  return net.isOnline()
}
