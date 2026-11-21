; ============================================================
;  随机点名 RandomNameCall 标准安装程序
;  架构：x64 / x86 通过预处理器变量 Arch 区分
;  编译：ISCC.exe /DArch=x64 setup.iss
;        ISCC.exe /DArch=x86 setup.iss
; ============================================================

#ifndef Arch
  #define Arch "x64"
#endif

#define MyAppName "随机点名"
#define MyAppVersion "0.2.0.0"
#define MyAppPublisher "Rb9-1376"
#define MyAppURL "https://github.com/Rb9-1376/RandomNameCall"
#define MyAppExeName "RandomNameCall.exe"
#define MyAppId "{{8F3C2B91-7D4A-4E5C-9A1B-6C2D8E4F0A73}"

#if Arch == "x64"
  #define SrcDir "..\dist-x64\win-unpacked"
  #define OutName "RandomNameCall-Setup-0.2.0.0-x64"
  #define ArchAllowed "x64compatible"
  #define ArchLabel "64 位"
#else
  #define SrcDir "..\dist-x86\win-ia32-unpacked"
  #define OutName "RandomNameCall-Setup-0.2.0.0-x86"
  #define ArchAllowed "x86compatible"
  #define ArchLabel "32 位"
#endif

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion} ({#ArchLabel})
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
VersionInfoVersion=0.2.0.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} 安装程序
VersionInfoCopyright=Copyright © 2026 Rb9-1376

; —— 安装位置：per-user，免管理员权限，减少杀软拦截 ——
DefaultDirName={localappdata}\Programs\RandomNameCall
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
UsePreviousAppDir=yes
; 位数限制：32 位包不能装到不支持的系统
ArchitecturesAllowed={#ArchAllowed}
MinVersion=10.0

; —— 许可协议页 ——
LicenseFile=..\LICENSE.txt

; —— 输出 ——
OutputDir=..\installer
OutputBaseFilename={#OutName}
SetupIconFile=..\resources\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}
CreateUninstallRegKey=yes

; —— 压缩与外观 ——
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=110
; 关闭安装中的程序，避免文件占用
CloseApplications=yes
RestartApplications=no

; —— 日志：安装过程写日志，便于排障 ——
SetupLogging=yes
Uninstallable=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: checkedonce

[Components]
Name: "main"; Description: "主程序（必需）"; Types: full compact custom; Flags: fixed
Name: "names"; Description: "示例名单（25 人）"; Types: full
Name: "docs"; Description: "说明文档（README / 维护指南 / 迁移说明）"; Types: full

[Files]
; 主程序与全部运行时（Electron 本体 + 资源）
Source: "{#SrcDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; 附加：示例名单
Source: "..\resources\names.txt"; DestDir: "{app}\docs"; DestName: "示例名单.txt"; Components: names; Flags: ignoreversion
; 附加：文档
Source: "..\README.md"; DestDir: "{app}\docs"; Components: docs; Flags: ignoreversion
Source: "..\MAINTENANCE.md"; DestDir: "{app}\docs"; Components: docs; Flags: ignoreversion
Source: "..\MIGRATION.md"; DestDir: "{app}\docs"; Components: docs; Flags: ignoreversion
Source: "..\LICENSE.txt"; DestDir: "{app}\docs"; Components: docs; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; 安装标记（供应用与更新器识别安装路径/版本）
Root: HKCU; Subkey: "Software\Rb9-1376\随机点名"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Rb9-1376\随机点名"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Rb9-1376\随机点名"; ValueType: string; ValueName: "Arch"; ValueData: "{#ArchLabel}"; Flags: uninsdeletevalue

[Run]
; 完成页：立即启动（可选）
Filename: "{app}\{#MyAppExeName}"; Description: "立即运行 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; 清理缓存与日志（保留 data.json 用户数据与 backups 备份）
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\Cache"
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\Code Cache"
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\GPUCache"
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\blob_storage"
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\logs"
Type: filesandordirs; Name: "{localappdata}\RandomNameCall\Crashpad"

[Code]
const
  UNINST_KEY = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppId}_is1';

// —— 预检查：是否已安装（升级引导） ——
function InitializeSetup(): Boolean;
var
  PrevVersion: String;
begin
  Result := True;
  if RegQueryStringValue(HKCU, UNINST_KEY, 'DisplayVersion', PrevVersion) then
  begin
    if MsgBox('检测到已安装「{#MyAppName}」版本 ' + PrevVersion + '。' + #13#10#13#10 +
      '继续安装将覆盖旧文件，用户数据（名单/设置）会保留。' + #13#10 +
      '是否继续？', mbConfirmation, MB_YESNO) = IDNO then
      Result := False;
  end;
end;

// —— 卸载前：结束正在运行的程序，释放文件句柄 ——
function InitializeUninstall(): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#MyAppExeName}', '',
    SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := True;
end;

// —— 卸载：询问是否保留用户数据（名单/设置） ——
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\RandomNameCall');
    if DirExists(DataDir) and FileExists(DataDir + '\data.json') then
    begin
      if MsgBox('检测到你的点名数据与设置（data.json、backups）。' + #13#10 +
        '是否一并删除？' + #13#10#13#10 +
        '选择「否」将保留，重新安装后可继续使用。' + #13#10 +
        '（静默卸载默认保留）', mbConfirmation, MB_YESNO) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
