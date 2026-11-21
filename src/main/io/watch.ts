import fs from 'node:fs'
import { logLine } from '../state/store'

let watcher: fs.FSWatcher | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let currentPath: string | null = null

/**
 * 监听当前名单文件：老师在 Excel/记事本里改完保存，主界面自动重载。
 * 只监听单个文件、事件去抖 400ms，不轮询、不常驻扫描目录。
 */
export function watchNamesFile(file: string | null | undefined, onChange: () => void): void {
  const target = file && fs.existsSync(file) ? file : null
  if (target === currentPath) return
  closeWatcher()
  currentPath = target
  if (!target) return
  try {
    watcher = fs.watch(target, { persistent: false }, () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        try {
          onChange()
        } catch (err) {
          logLine('warn', `名单自动重载失败：${String(err)}`)
        }
      }, 400)
    })
    watcher.on('error', () => closeWatcher())
  } catch (err) {
    logLine('warn', `名单文件监听不可用：${String(err)}`)
  }
}

export function closeWatcher(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  watcher?.close()
  watcher = null
  currentPath = null
}
