import type { NameAudit } from '@shared/types'

const MAX_LEN = 12 // 超过这个长度在舞台上要缩字，先给个提示

const SUSPICIOUS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^\d+$/, reason: '纯数字' },
  { pattern: /^[A-Za-z]$/, reason: '单个字母' },
  { pattern: /[<>/\\|*?"]/, reason: '含特殊符号' },
  { pattern: /[，,。.；;：:、]/, reason: '含标点' }
]

/** 体检：不修改数据，只报告问题 + 给出"修完会变成什么" */
export function auditNames(names: string[]): NameAudit {
  const counts = new Map<string, number>()
  let empties = 0
  const tooLong: { name: string; length: number }[] = []
  const suspicious: { name: string; reason: string }[] = []

  for (const raw of names) {
    const name = typeof raw === 'string' ? raw.trim() : ''
    if (!name) {
      empties += 1
      continue
    }
    counts.set(name, (counts.get(name) ?? 0) + 1)
    if ([...name].length > MAX_LEN) tooLong.push({ name, length: [...name].length })
    for (const rule of SUSPICIOUS) {
      if (rule.pattern.test(name)) {
        suspicious.push({ name, reason: rule.reason })
        break
      }
    }
  }

  const duplicates = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .map(([name, count]) => ({ name, count }))

  const fixed = fixNames(names)

  return {
    total: names.length,
    unique: counts.size,
    duplicates,
    empties,
    tooLong,
    suspicious,
    fixedNames: fixed,
    fixable: names.length - fixed.length
  }
}

/** 明显不是姓名的条目：纯数字、单个字母、没有任何文字 */
function isJunk(name: string): boolean {
  if (/^\d+$/.test(name)) return true
  if (/^[A-Za-z]$/.test(name)) return true
  return !/[\p{L}]/u.test(name)
}

/** 一键修复：去空行 → 删掉明显不是姓名的条目 → 去首尾空白/换行 → 有序去重 → 超长截断到 32 */
export function fixNames(names: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    if (typeof raw !== 'string') continue
    let name = raw.replace(/[\r\n\t]+/g, ' ').trim()
    if (!name || isJunk(name)) continue
    const chars = [...name]
    if (chars.length > 32) name = chars.slice(0, 32).join('')
    if (seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}
