import fs from 'node:fs'
import path from 'node:path'
import iconv from 'iconv-lite'
import jschardet from 'jschardet'
import * as XLSX from 'xlsx'
import type { EncodingName, FileReadResult } from '@shared/types'
import { dedupeNames } from '../state/defaults'

const ICONV_MAP: Record<string, string> = {
  'UTF-8': 'utf8',
  'UTF-8-SIG': 'utf8',
  UTF16: 'utf16le',
  'UTF-16': 'utf16le',
  'UTF-16 LE': 'utf16le',
  'UTF-16 BE': 'utf16-be',
  GB18030: 'gb18030',
  GB2312: 'gb18030',
  GBK: 'gb18030',
  ANSI: 'gb18030',
  BIG5: 'big5'
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}

function looksBroken(text: string): boolean {
  const bad = (text.match(/\uFFFD/g) || []).length
  return bad > 0 && bad / Math.max(1, text.length) > 0.01
}

function decode(buffer: Buffer, encoding: EncodingName): { text: string; used: string; notes: string[] } {
  const notes: string[] = []

  if (encoding === 'UTF-8-SIG') {
    return { text: stripBom(buffer.toString('utf8')), used: 'UTF-8-BOM', notes }
  }
  if (encoding === 'UTF-16') {
    const le = buffer[0] === 0xff && buffer[1] === 0xfe
    const be = buffer[0] === 0xfe && buffer[1] === 0xff
    const enc = be ? 'utf16-be' : 'utf16le'
    return { text: iconv.decode(buffer, enc), used: be ? 'UTF-16 BE' : 'UTF-16 LE', notes }
  }
  if (encoding === '自动') {
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return { text: stripBom(buffer.toString('utf8')), used: 'UTF-8 (BOM)', notes }
    }
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return { text: iconv.decode(buffer, 'utf16le'), used: 'UTF-16 LE', notes }
    }
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      return { text: iconv.decode(buffer, 'utf16-be'), used: 'UTF-16 BE', notes }
    }
    const asciiOnly = !buffer.some((b) => b > 0x7f)
    if (asciiOnly) {
      return { text: buffer.toString('utf8'), used: 'ASCII', notes }
    }
    const guess = jschardet.detect(buffer)
    const conf = guess.confidence ?? 0
    const name = (guess.encoding || '').toUpperCase()
    notes.push(`自动识别：${guess.encoding || '未知'} (${Math.round(conf * 100)}%)`)

    if (name.includes('UTF-8') && conf > 0.5) {
      const text = buffer.toString('utf8')
      if (!looksBroken(text)) return { text: stripBom(text), used: 'UTF-8', notes }
    }
    if (name.includes('GB') || name.includes('BIG5') || name.includes('WINDOWS-1252')) {
      const enc = name.includes('BIG5') ? 'big5' : 'gb18030'
      const text = iconv.decode(buffer, enc)
      if (!looksBroken(text)) return { text, used: enc, notes }
    }
    const utf8 = buffer.toString('utf8')
    if (!looksBroken(utf8)) return { text: stripBom(utf8), used: 'UTF-8(回退)', notes }
    const gb = iconv.decode(buffer, 'gb18030')
    notes.push('编码置信度低，已按 GB18030 回退')
    return { text: gb, used: 'GB18030(回退)', notes }
  }

  const key = ICONV_MAP[encoding] || 'utf8'
  const text = key === 'utf8' ? buffer.toString('utf8') : iconv.decode(buffer, key)
  return { text: stripBom(text), used: key, notes }
}

function parseText(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.split(/[,，;；\t]/)[0] ?? '')
    .map((s) => s.replace(/^\d+[.、)\s]+/, '').trim())
    .filter((s) => s.length > 0 && s.length <= 32)
}

function readSheet(file: string): { names: string[]; used: string } {
  const wb = XLSX.readFile(file, { cellDates: false })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { names: [], used: '空工作簿' }
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false })
  const header = (rows[0] || []).map((c) => String(c ?? ''))
  let col = header.findIndex((h) => /姓名|名字|学生|name/i.test(h))
  const from = col >= 0 ? 1 : 0
  if (col < 0) col = 0
  const names: string[] = []
  for (let i = from; i < rows.length; i++) {
    const cell = rows[i]?.[col]
    if (cell != null && String(cell).trim()) names.push(String(cell).trim())
  }
  return { names, used: `工作表「${wb.SheetNames[0]}」第 ${col + 1} 列` }
}

export function readNamesFile(file: string, encoding: EncodingName): FileReadResult {
  const warnings: string[] = []
  if (!fs.existsSync(file)) {
    return { path: file, encoding: String(encoding), names: [], warnings: ['文件不存在'] }
  }
  const ext = path.extname(file).toLowerCase()
  if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
    const { names, used } = readSheet(file)
    const list = dedupeNames(names)
    if (!list.length) warnings.push('表格里没有读到姓名')
    return { path: file, encoding: used, names: list, warnings }
  }

  const buffer = fs.readFileSync(file)
  const { text, used, notes } = decode(buffer, encoding)
  warnings.push(...notes)
  const raw = parseText(text)
  const names = dedupeNames(raw)
  if (raw.length !== names.length) warnings.push(`已去除 ${raw.length - names.length} 个重复/空行`)
  if (!names.length) warnings.push('没有解析到姓名，请检查编码或文件内容')
  if (names.length > 2000) warnings.push(`名单较大（${names.length} 人），抽签动画可能略有卡顿`)
  return { path: file, encoding: used, names, warnings }
}
