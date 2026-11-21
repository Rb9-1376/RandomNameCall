import { app, BrowserWindow, Menu, net, powerSaveBlocker, protocol, screen } from 'electron'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { initEngine, registerIpc, startNamesWatcher } from './ipc'
import { broadcast, createMainWindow, getMainWindow, setQuitting } from './windows/main'
import { createBallWindow } from './windows/ball'
import { ensureState, flushState, getState, logLine } from './state/store'
import { applyProxy } from './net/mirrors'
import { checkUpdate } from './net/update'

app.setName('RandomNameCall')
app.setAppUserModelId('cn.rb9.randomrollcall')

// 本地背景音乐：渲染层用 rnc://bgm 播放用户自选文件，避免把音频塞进包体
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'rnc',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

process.on('uncaughtException', (err) => {
  logLine('error', `未捕获异常：${err.stack || String(err)}`)
})
process.on('unhandledRejection', (reason) => {
  logLine('error', `未处理的 Promise 拒绝：${String(reason)}`)
})

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  let blocker = 0

  const bootstrap = async (): Promise<void> => {
    const state = ensureState()

    protocol.handle('rnc', async (req) => {
      const url = new URL(req.url)
      if (url.hostname !== 'bgm') return new Response(null, { status: 404 })
      const file = getState().sound.bgmFile
      if (!file || !fs.existsSync(file)) return new Response(null, { status: 404 })
      try {
        return await net.fetch(pathToFileURL(file).toString())
      } catch {
        return new Response(null, { status: 500 })
      }
    })

    initEngine()
    registerIpc()
    startNamesWatcher()

    try {
      await applyProxy(state.net)
    } catch (err) {
      logLine('warn', `代理设置失败：${String(err)}`)
    }

    createMainWindow()
    if (state.ball.enabled) createBallWindow()

    // 课堂场景：抽签期间不允许息屏
    blocker = powerSaveBlocker.start('prevent-display-sleep')

    screen.on('display-metrics-changed', () => {
      const display = screen.getPrimaryDisplay()
      broadcast('ui:metrics', {
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor
      })
    })

    if (state.net.onlineEnabled) {
      void (async () => {
        const { refreshRoster } = await import('./io/roster')
        const s = getState()
        const res = await refreshRoster(s.net, s.classes)
        if (res.ok) logLine('info', res.message)
      })()
    }

    if (state.update.checkOnStart) {
      setTimeout(() => {
        void checkUpdate(getState().net)
          .then((info) => {
            if (!info) return
            if (getState().update.skippedVersions.includes(info.latest)) return
            broadcast('update:available', info)
          })
          .catch((err) => logLine('warn', `静默更新检查失败：${String(err)}`))
      }, 8000)
    }
  }

  // 输入框右键菜单：剪切/复制/粘贴/删除/全选（渲染层不引入额外依赖）
  app.on('web-contents-created', (_e, contents) => {
    contents.on('context-menu', (_evt, params) => {
      if (!params.isEditable && !params.selectionText) return
      const items: Electron.MenuItemConstructorOptions[] = []
      if (params.isEditable) {
        items.push(
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'delete', label: '删除' },
          { type: 'separator' },
          { role: 'selectAll', label: '全选' }
        )
      } else {
        items.push({ role: 'copy', label: '复制' }, { role: 'selectAll', label: '全选' })
      }
      Menu.buildFromTemplate(items).popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined })
    })
  })

  app.whenReady().then(bootstrap).catch((err) => {
    logLine('error', `启动失败：${String(err)}`)
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      flushState()
      app.quit()
    }
  })

  app.on('before-quit', () => {
    setQuitting(true) // 放行主窗口 close，让 app.quit 能真正退出
    flushState()
    if (blocker) powerSaveBlocker.stop(blocker)
  })
}
