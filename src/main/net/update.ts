import type { NetSettings, UpdateInfo } from '@shared/types'
import { VERSION } from '../state/defaults'
import { applyProxy, fetchWithMirrors } from '../net/mirrors'

/**
 * 更新源：GitHub Releases API（爬仓库 Rb9-1376/RandomNameCall 的发行版安装程序）。
 * 内网/自建镜像可以用 RNC_UPDATE_URL 覆盖（指向自己静态服务器上的同格式 JSON）。
 */
export const UPDATE_URL =
  process.env.RNC_UPDATE_URL ||
  'https://api.github.com/repos/Rb9-1376/RandomNameCall/releases/latest'

/** 线路测速用的稳定小文件（update.json 未发布时也能判断通路是否可用） */
export const PROBE_URL =
  'https://raw.githubusercontent.com/Rb9-1376/RandomNameCall/main/names.txt'

/** 只认 0.x 系列（Electron 版）；旧 Python 版的 1.x Release 不参与提醒 */
function isElectronSeries(v: string): boolean {
  return /^v?0\./.test(v.trim())
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map((n) => parseInt(n, 10))
    .map((n) => (Number.isFinite(n) ? n : 0))
}

export function compareVersion(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

interface ReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface RemoteRelease {
  tag_name?: string
  name?: string
  body?: string
  html_url?: string
  assets?: ReleaseAsset[]
}

export async function checkUpdate(cfg: NetSettings, url = UPDATE_URL): Promise<UpdateInfo | null> {
  await applyProxy(cfg)
  const { text } = await fetchWithMirrors(url, cfg, 5000)
  const doc = JSON.parse(text) as RemoteRelease
  const latest = String(doc.tag_name || doc.name || '').trim()
  if (!latest) return null
  if (!isElectronSeries(latest)) return null
  const current = VERSION.join('.')
  if (compareVersion(latest, current) <= 0) return null

  const assets = Array.isArray(doc.assets) ? doc.assets : []
  // 一键更新：按当前进程架构优先选择对应安装包（x64 / x86），回退第一个 .exe
  const archPattern = process.arch === 'ia32' ? /(x86|i386|ia32)/i : /(x64|amd64)/i
  const exeAssets = assets.filter((a) => a && a.name && /\.exe$/i.test(a.name) && a.browser_download_url)
  const setup = exeAssets.find((a) => archPattern.test(String(a.name))) ?? exeAssets[0]
  const downloads = assets
    .filter((a): a is ReleaseAsset => Boolean(a && a.browser_download_url))
    .map((a) => ({
      label: String(a.name || '下载'),
      url: String(a.browser_download_url)
    }))

  return {
    latest,
    notes: String(doc.body || '').trim(),
    downloads,
    downloadUrl: setup?.browser_download_url
      ? String(setup.browser_download_url)
      : downloads[0]?.url || '',
    htmlUrl: String(doc.html_url || `https://github.com/Rb9-1376/RandomNameCall/releases`),
    forced: false
  }
}
