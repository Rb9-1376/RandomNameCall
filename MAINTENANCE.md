# 随机点名 0.2.0.0 · 维护与编译指南

当前项目为 **Electron 45 + Vue 3 + TypeScript** 重构版，版本 `0.2.0.0`。
旧版（Python/tkinter，V1.1.3.1）已完整归档至 `legacy/` 文件夹。

---

## 一、环境要求

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 22（本机已装 v26） | https://nodejs.org/ |
| pnpm | ≥ 9（本机已装 v12） | `npm i -g pnpm` |
| Windows | 打包用 | 装好即可；Linux 上打包需另装 wine |

国内首次装依赖建议配置 Electron 镜像，加速 234MB 运行时下载：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
pnpm install
```

> 也可以永久写入 package.json 的 `build.electronDownload.mirror`（已配好 npmmirror）。

## 二、日常开发（改代码时）

```bash
pnpm install      # 首次/依赖变化后安装依赖
pnpm dev          # 开发模式：热更新，改 .vue/.ts 立即生效
pnpm typecheck    # 类型检查（提交前必跑，vue-tsc）
pnpm build        # 构建到 out/（main/preload/renderer 三段）
pnpm start        # 跑 out/ 构建产物
```

VSCode 里等价操作：`Ctrl+Shift+B` 或「终端 → 运行任务」直接选 `安装依赖 / 开发运行 / 类型检查 / 构建`（任务已配好在 `.vscode/tasks.json`）。

## 三、代码地图（改哪里看这里）

```
src/
  shared/types.ts          ← IPC 契约、全部类型定义（改接口先看这）
  main/                    ← 主进程（Node 环境，能碰文件系统/网络/窗口）
    index.ts               启动、单实例、异常兜底、静默更新检查
    ipc.ts                 全部 IPC 处理 + 引擎装配
    engine/RollEngine.ts   抽签状态机：加权随机/滚动缓停/不重复/撤回
    state/defaults.ts      默认值 + normalize 校验 + 旧版 data.json 迁移
    state/store.ts         data.json 原子写/备份/日志
    io/names.ts            编码识别 + txt/csv/xlsx 解析
    io/roster.ts           在线名单 + 缓存 + locked
    io/watch.ts            名单文件热重载
    io/audit.ts            名单体检 + 一键修复
    io/export.ts           系统字体枚举 + CSV 导出
    net/mirrors.ts         五线路镜像竞速 + 代理 + 冷却
    net/update.ts          版本提醒（读 update.json，只提醒不下载）
    windows/main.ts        主窗
    windows/ball.ts        悬浮球（吸附/展开）
  preload/index.ts         contextBridge 白名单（window.api / window.extra）
  renderer/                ← 界面（Vue 3，无 UI 框架）
    views/MainView.vue     主界面（舞台/顶栏/触控条/快捷键/长按）
    views/BallView.vue     悬浮球
    components/SettingsDrawer.vue   设置抽屉（最大组件）
    composables/useApp.ts  全局状态 + 音效 + TTS
    styles/app.css         设计令牌 + 全部样式
resources/                 names.txt / click.wav / icon.ico / ball.png
tools/release.mjs         发版脚本（算 SHA256 + 生成 update.json）
update.json               客户端唯一联网读取的版本清单
```

## 四、数据文件（运行时）

程序数据在 `%APPDATA%\RandomNameCall\data\`：

```
data.json            全部设置 + 班级 + 点名记录（schema 3，原子写）
data.json.bak        上一次副本（主文件损坏自动恢复）
roster-cache.json    在线名单缓存
logs/app.log         运行日志（排查问题先看这）
backups/             每日备份，保留 14 份
```

用户也可以改数据目录（设置 → 数据 → 打开数据目录）。

## 五、发布新版本（完整流程）

1. **改版本号**（三处，保持一致）：

   ```bash
   # ① package.json  → "version": "0.2.0.0"
   # ② src/main/state/defaults.ts → VERSION = [0, 2, 0, 0]
   # ③ 发布时再更新 update.json（第 5 步自动生成）
   ```

2. **类型检查 + 构建 + 打包安装包**（在 Windows 上）：

   ```bash
   pnpm typecheck
   pnpm dist          # 产出 dist/RandomNameCall-0.2.0.0-x64.exe（NSIS per-user 安装包）
   ```

   只想快速出免安装目录（验证用）：`pnpm dist:dir` → `dist/win-unpacked/`。

3. **生成更新清单**（算 SHA256 + 写根目录 update.json）：

   ```bash
   node tools/release.mjs --notes "本次更新内容…"
   ```

4. **提交 + 打 tag + 发 GitHub Release**：

   ```bash
   git add update.json && git commit -m "release: v0.2.0.0"
   git tag v0.2.0.0 && git push origin v0.2.0.0
   gh release create v0.2.0.0 dist/RandomNameCall-0.2.0.0-x64.exe --title v0.2.0.0
   ```

   没有 gh 也可以用 GitHub 网页：Releases → Draft a new release → 填 `v0.2.0.0` → 上传安装包 → Publish。

5. **客户端怎么收到更新**：程序启动 8 秒后静默读一次仓库根目录 `update.json`（`latest` > 当前版本时右下角弹卡片）。只提醒、不自动下载。`RNC_UPDATE_URL` 环境变量可把清单指向内网静态服务器。

## 六、常见问题

| 现象 | 处理 |
| --- | --- |
| 界面卡顿（老电脑/核显） | 设置 → 外观 → 打开「低配模式」；系统开启"减少动态效果"也会自动降级 |
| 想全屏上课 | 顶栏全屏按钮或 `F11`，`Esc` 退出全屏 |
| 启动报 `TypeError: Cannot read properties of undefined (reading 'setName')` | 终端环境带有 `ELECTRON_RUN_AS_NODE=1`（常见于某些 IDE 内嵌终端/代理宿主的 shell），Electron 被切成纯 Node 模式。执行 `Remove-Item Env:ELECTRON_RUN_AS_NODE` 或换个干净终端再跑 |
| `pnpm install` 卡在下载 Electron | 设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 重试 |
| `pnpm dist` 报 `spawn wine ENOENT` | Linux 上需要装 wine；Windows 上不会有此问题 |
| 安装包被 SmartScreen 拦 | 未做代码签名，「更多信息 → 仍要运行」；分发时附 SHA256（`node tools/release.mjs` 会输出） |
| 360/火绒拦截 | per-user 安装到 `%LOCALAPPDATA%\Programs\RandomNameCall`，添加信任即可 |
| 改完名单不生效 | 热重载只监听"当前班级的本地文件"；在线/内置班级需手动「重新读取」 |
| 语音播报没声音 | 走系统 speechSynthesis，需系统装有中文语音包；设置里默认关闭 |
| 想回退旧 Python 版 | 见 `legacy/`（源码 zip + 安装包 exe 都在） |

## 七、提交规范建议

- 提交前必跑 `pnpm typecheck`
- 功能改动同步更新 `README.md` 与 `MIGRATION.md`
- 版本号三处（package.json / defaults.ts / update.json）保持同步
