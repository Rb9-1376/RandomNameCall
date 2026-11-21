import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { DrawRecord } from '@shared/types'

const COMMON = [
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  '微软雅黑',
  'SimHei',
  '黑体',
  'SimSun',
  '宋体',
  'KaiTi',
  '楷体',
  'DengXian',
  '等线',
  'Source Han Sans SC',
  'Noto Sans CJK SC',
  'PingFang SC',
  'HarmonyOS Sans SC',
  'Alibaba PuHuiTi',
  'Arial',
  'Segoe UI',
  'Consolas'
]

function fontDirs(): string[] {
  if (process.platform === 'win32') {
    const win = process.env.WINDIR || 'C:\\Windows'
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    return [path.join(win, 'Fonts'), path.join(local, 'Microsoft', 'Windows', 'Fonts')]
  }
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library', 'Fonts')]
  }
  return ['/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts')]
}

function humanize(file: string): string {
  return path
    .basename(file)
    .replace(/\.(ttf|otf|ttc|woff2?|fon)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(bold|italic|light|medium|regular|semibold|black|thin|condensed|oblique)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** 纯文件系统扫描，不调用系统 API、不起子进程 */
export function listFonts(): string[] {
  const found = new Set<string>()
  const walk = (dir: string, depth: number): void => {
    if (depth > 2) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full, depth + 1)
      } else if (/\.(ttf|otf|ttc)$/i.test(entry.name)) {
        const name = humanize(entry.name)
        if (name.length >= 2 && name.length <= 40) found.add(name)
      }
    }
  }
  for (const dir of fontDirs()) walk(dir, 0)
  for (const name of COMMON) found.add(name)
  const all = Array.from(found)
  const score = (n: string): number => {
    const idx = COMMON.findIndex((c) => c.toLowerCase() === n.toLowerCase())
    return idx >= 0 ? idx : COMMON.length + 1
  }
  all.sort((a, b) => score(a) - score(b) || a.localeCompare(b))
  return all.slice(0, 400)
}

const HEADER = ['时间', '姓名', '班级', '方式', '状态']

export function recordsToCsv(records: DrawRecord[], classNames: Record<string, string>): string {
  const rows = [HEADER.join(',')]
  for (const r of records) {
    const cells = [
      new Date(r.ts).toLocaleString('zh-CN'),
      r.name,
      classNames[r.classId] || r.classId,
      r.mode === 'roll' ? '滚动暂停' : '直接抽取',
      r.revoked ? '已撤回' : '有效'
    ]
    rows.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
  }
  return '\uFEFF' + rows.join('\r\n')
}
