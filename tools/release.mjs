#!/usr/bin/env node
/**
 * 发布辅助：算安装包 SHA256、生成根目录 update.json（应用启动后靠它判断有没有新版本）。
 *
 * 用法：
 *   node tools/release.mjs                        # 自动找 dist/*.exe
 *   node tools/release.mjs --notes "本次更新…"
 *   node tools/release.mjs --file dist/RandomNameCall-0.2.0.0-x64.exe
 *
 * 生成的 update.json 只做「有新版本」提醒，不含任何自动下载/安装逻辑。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const repo = 'Rb9-1376/RandomNameCall'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const notes = arg('notes', '')
let file = arg('file', '')

if (!file) {
  const dist = path.join(root, 'dist')
  const exe = fs.existsSync(dist)
    ? fs
        .readdirSync(dist)
        .filter((f) => f.toLowerCase().endsWith('.exe'))
        .map((f) => path.join(dist, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
    : null
  if (!exe) {
    console.error('没找到安装包：先跑 `pnpm dist`（需在 Windows 上），或用 --file 指定路径。')
    process.exit(1)
  }
  file = exe
}

const buf = fs.readFileSync(file)
const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
const sizeMb = (buf.length / 1024 / 1024).toFixed(1)
const base = path.basename(file)

const update = {
  schema: 1,
  latest: version,
  publishedAt: new Date().toISOString().slice(0, 10),
  notes:
    notes ||
    '修复与优化：白色主题成为默认外观、名单体检与一键整理、首次启动向导、状态实时同步。',
  downloads: [
    {
      label: `Windows x64 安装包（${sizeMb} MB）`,
      url: `https://github.com/${repo}/releases/download/v${version}/${base}`
    }
  ],
  sha256
}

const out = path.join(root, 'update.json')
fs.writeFileSync(out, `${JSON.stringify(update, null, 2)}\n`, 'utf8')

console.log(`安装包：${file}`)
console.log(`大小：${sizeMb} MB`)
console.log(`SHA256：${sha256}`)
console.log(`已写入：${out}`)
console.log('')
console.log('接下来：')
console.log(`  git tag v${version} && git push origin v${version}`)
console.log(`  gh release create v${version} "${file}" --title "v${version}" --notes-file 更新说明.md`)
console.log('  把 update.json 一起提交到 main 分支，客户端启动 8 秒后就会看到提醒。')
