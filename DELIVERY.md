# 随机点名 v0.2.0.0 交付包

打包时间：2026-11-21
安装包：`dist/RandomNameCall-0.2.0.0-x64.exe`
SHA256：`7383018569609fa9c375e086de51d26ed2cb3867705821a719f985026b78a9a6`

## 一、这个包里有什么

```
README.md                  项目说明（安装、功能、快捷键、名单格式、在线名单、打包）
MIGRATION.md                与旧 Python 版的功能对照（F1–F55）、删改清单、验收记录
DELIVERY.md                本文件
update.json                版本清单：latest + 下载地址 + SHA256（客户端只读它做新版提醒）
package.json               依赖与打包配置（scripts: dev/build/typecheck/dist/dist:dir/release）
electron.vite.config.ts    主进程 / 预加载 / 渲染层三段构建配置
tsconfig.json
src/                       全部源码（见下）
resources/                 随包资源：names.txt、click.wav、icon.ico、ball.png
docs/                      README 用到的界面截图
tools/release.mjs          发版脚本：算 SHA256 + 生成 update.json
dist/
  RandomNameCall-0.2.0.0-x64.exe       ← Windows x64 安装包（123.7 MB）
  RandomNameCall-0.2.0.0-x64.exe.blockmap
out/                       最近一次构建产物（main / preload / renderer）
```

未包含：`node_modules/`（用 `pnpm install` 重装即可）、`dist/win-unpacked/`（未压缩的免安装目录，约 393 MB，需要时 `pnpm dist:dir` 重新生成）。

## 二、源码结构

```
src/
  shared/           主进程与渲染层共用
    types.ts        AppState / Api 等全部类型（IPC 契约在这）
    theme.ts        白色 / 深色 / 高对比三套配色
  main/             主进程
    index.ts        启动、rnc:// 协议、单实例、右键菜单、异常兜底、更新检查
    ipc.ts          全部 IPC：点名、名单、班级、导出、窗口、悬浮球…
    engine/RollEngine.ts  抽取引擎：加权随机、滚动动画、不重复、撤销、轮次重置
    state/          defaults.ts（默认值/迁移/校验）、store.ts（原子写/备份/日志）
    io/             names.ts（9 种编码识别、xlsx）、watch.ts（名单热重载）、
                    roster.ts（在线名单+缓存）、export.ts（字体枚举、CSV）、audit.ts（名单体检）
    net/            mirrors.ts（五线路竞速+冷却）、update.ts（版本提醒）
    windows/        main.ts（主窗）、ball.ts（悬浮球吸附）
  preload/index.ts  contextBridge 暴露 window.api / window.extra
  renderer/         Vue 3 界面
    views/MainView.vue          主界面（舞台、顶栏、触控条、快捷键、长按）
    views/BallView.vue          悬浮球（拖动、吸附、展开菜单）
    components/                 设置抽屉、帮助弹窗、向导、名单体检、图标
    composables/useApp.ts       全局状态与动作
    styles/app.css              设计令牌 + 全部样式
```

## 三、装到 Windows 上

1. 双击 `dist/RandomNameCall-0.2.0.0-x64.exe`；
2. 选「仅为我安装」（默认，不需要管理员权限，装到 `%LOCALAPPDATA%\Programs\RandomNameCall`）；
3. 首次运行会有 SmartScreen「未知发布者」提示（安装包未做代码签名），点「更多信息 → 仍要运行」；
4. 第一次启动弹出三步向导：看快捷键 → 选名单 → 挑外观；
5. 数据存在 `%APPDATA%\RandomNameCall\data\`，卸载不会自动删；要清干净就删这个目录。

安装前可用 PowerShell 核对安装包完整性：

```powershell
(Get-FileHash .\RandomNameCall-0.2.0.0-x64.exe -Algorithm SHA256).Hash.ToLower()
# 应为 7383018569609fa9c375e086de51d26ed2cb3867705821a719f985026b78a9a6
```

## 四、从源码跑起来

需要 Node 22+ 与 pnpm：

```bash
pnpm install
pnpm dev            # 开发模式（热更新）
pnpm typecheck      # 类型检查
pnpm build          # 构建到 out/
pnpm start          # 用构建产物启动
pnpm dist:dir       # 未压缩目录 dist/win-unpacked/
pnpm dist           # NSIS 安装包（Linux 上需 wine + wine32:i386，见 README）
```

首次 `pnpm install` 会下载 Electron 45 运行时（约 234 MB），国内可用
`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 加速。

## 五、已知边界

- 仅 Windows x64；未做代码签名。
- 语音播报走系统 `speechSynthesis`，系统没装中文语音包时没有声音（默认关闭）。
- 在线名单只读，班级被远端标 `locked` 后应用内不会覆盖它。
- 版本提醒只提示、不下载不安装；`update.json` 推上 GitHub 后才生效，`RNC_UPDATE_URL` 可指向内网。
- 安装包在 Linux + wine 下构建并做了结构校验（payload 77 个文件、图标版本号齐全），但完整点击安装流程建议在真机上再走一遍。
