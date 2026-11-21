# 安装程序说明（双架构 + 防误报）

## 一、产物

| 文件 | 架构 | 运行时 |
|---|---|---|
| `installer\RandomNameCall-Setup-0.2.0.0-x64.exe` | 64 位（x64） | Electron 45.4.1 |
| `installer\RandomNameCall-Setup-0.2.0.0-x86.exe` | 32 位（x86） | Electron 43.3.0（官方最后一个提供 ia32 运行时的 43 系） |

> Electron 从 v23 起不再随官方发布 32 位运行时；x86 包使用 43.3.0 ia32 运行时，代码与 x64 完全一致，已实测可正常运行。

## 二、标准安装流程（与总纲逐项对应）

| 总纲条目 | 实现 |
|---|---|
| 欢迎页 | Inno 向导首页：软件名、版本、架构标识 |
| 许可协议页 | `LicenseFile=LICENSE.txt`，必须同意才能继续 |
| 组件勾选页 | 主程序（必需）/ 示例名单 / 说明文档，对应「完整版/精简版」 |
| 选择安装路径页 | 默认 `%LOCALAPPDATA%\Programs\RandomNameCall`，可改 |
| 预检查 | 系统版本 ≥ Win10（`MinVersion=10.0`）、32/64 位匹配（`ArchitecturesAllowed`）、磁盘空间（Inno 内置）、已安装检测（注册表卸装项，提示覆盖升级） |
| 确认页 | Inno「准备安装」汇总页 |
| 执行阶段 | 解压拷贝、写注册表（`HKCU\Software\Rb9-1376\随机点名`）、创建快捷方式、写入卸载项、生成日志（`SetupLogging=yes`） |
| 初始化配置 | 应用首次运行自动创建 data.json（已有逻辑） |
| 完成页 | 「立即运行」勾选启动 |
| 回滚机制 | Inno 内置：安装中途失败自动撤销已释放文件、注册表、快捷方式 |
| 卸载体系 | 控制面板卸载项 + 开始菜单卸载快捷方式；卸载时清理缓存/日志（Cache、GPUCache、logs 等），询问是否删除用户数据（默认保留 data.json/backups） |

## 三、防杀软误报策略（已落实）

1. **不用 UPX、不加壳**：Electron 本体原样打包，`Compression=lzma2/max` 为标准 LZMA 压缩。
2. **per-user 安装，不申请管理员权限**：装到 `%LOCALAPPDATA%`，免 UAC 提权，规避「静默提权」启发式。
3. **不落地临时 exe、不隐藏执行**：安装过程就是标准文件释放，没有「解压到 temp 再拉起」的免杀特征。
4. **应用内更新不再 spawn 子进程**：`update:install` 改为 `shell.openPath()` 由系统外壳打开安装包（可见的交互式安装），消除「后台静默启动子进程」这一常见误报特征。
5. **无计划任务/服务/驱动/开机自启写入**：只写 HKCU 注册表与开始菜单/桌面快捷方式。
6. **无网络后台上报**：应用只在你点击「检查更新」时访问 GitHub API。
7. **输出 SHA256**：见 `installer\SHA256SUMS.txt`，分发时可核对完整性。

### 关于「报毒」的边界说明

- **SmartScreen**：安装包未做代码签名，首次运行会提示「未知发布者」。这是信誉提示，不是病毒判定。消除方式：购买代码签名证书（OV/EV）后在 ISCC 里加 `SignTool`。
- **杀软启发式误报**：极少数杀软会把 NSIS/Inno 引导壳误判，可用上面的产物直接给用户「添加信任」；如仍有误报，可提交样本给杀软厂商加白（免费）。
- 自签名证书对 SmartScreen 无效且更容易触发拦截，不建议使用。

## 四、静默安装 / 日志 / 校验

```powershell
# 静默安装（无界面）
RandomNameCall-Setup-0.2.0.0-x64.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="%TEMP%\rnc-setup.log"

# 静默卸载
"%LOCALAPPDATA%\Programs\RandomNameCall\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES

# 校验
Get-FileHash .\RandomNameCall-Setup-0.2.0.0-x64.exe -Algorithm SHA256
```

## 五、重新编译

```powershell
# 1) 构建两套 unpacked
pnpm build
npx electron-builder --win --x64 --dir --config.directories.output=dist-x64
npx electron-builder --win --ia32 --dir --config.directories.output=dist-x86 --config.electronVersion=43.3.0

# 2) 编译安装包（ISCC 路径按本机安装位置）
$iscc = "C:\Users\<你>\AppData\Local\Programs\Inno Setup 6\ISCC.exe"
& $iscc /DArch=x64 installer\setup.iss
& $iscc /DArch=x86 installer\setup.iss
```

> 注意：`setup.iss` 与 `LICENSE.txt` 必须保存为 UTF-8 **带 BOM**，否则中文乱码导致编译报错。
