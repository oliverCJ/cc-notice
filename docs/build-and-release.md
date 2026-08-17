# 构建和发布说明

## 版本规则

当前正式版本从 `1.1.1` 开始。后续常规功能和修复优先升级小版本号，例如 `1.1.2`、`1.1.3`；只有出现明确不兼容变更、发布策略重构或重大功能边界调整时，才升级中版本或大版本。

发版前必须同步以下位置的版本号：

- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` 中 `cc-notice` 包条目
- `src-tauri/tauri.conf.json`

## 基础构建

前端和 Tauri 生产构建仍使用现有命令：

```bash
npm run build
```

该命令只构建软件前端，不构建固件。

默认 Tauri 构建配置中的 `beforeBuildCommand` 是：

```bash
npm run build:app
```

该命令会先构建默认架构的 `cc-notice-relay` 并同步到 `src-tauri/assets/tools/cc-notice-relay`，再构建前端。这个默认链路适合本机开发构建，不用于 macOS 多架构发布包。Tauri 打包时会把 `src-tauri/assets/firmware` 中已经提交的固件资产作为资源打入安装包，但不会编译固件。

## macOS 发布包

macOS 发布包使用专用脚本：

```bash
npm run package:mac:x64
npm run package:mac:arm64
npm run package:mac:universal
npm run package:mac:all
```

命令含义：

- `package:mac:x64`：生成 Intel Mac 使用的 `x86_64-apple-darwin` 应用包。
- `package:mac:arm64`：生成 Apple Silicon 使用的 `aarch64-apple-darwin` 应用包。
- `package:mac:universal`：生成同时包含 `x86_64` 和 `arm64` 的 universal 应用包。
- `package:mac:all`：按顺序生成 x64、arm64、universal 三类 macOS 包。

## Windows 发布包

Windows 本机编译建议使用 Windows 10/11 x64 环境。需要先安装：

- Node.js 22 和 npm
- Rust stable，目标工具链使用默认 MSVC
- Visual Studio Build Tools，安装 `Desktop development with C++` 工作负载
- WebView2 Runtime。Windows 11 通常已内置；如果目标机器缺失，需要从 Microsoft 官方安装

首次拉取代码后安装依赖：

```powershell
npm ci
```

基础验证：

```powershell
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Windows 推荐发布包只构建 NSIS `.exe` 安装包：

```powershell
npm run package:win
```

该命令会先执行 `npm run build:relay:asset`，在本机生成 `cc-notice-relay.exe` 并同步到 `src-tauri/assets/tools/cc-notice-relay.exe`，再执行：

```powershell
npx tauri build --bundles nsis
```

`src-tauri/assets/tools/cc-notice-relay.exe` 是 Windows 本机构建产物，不提交到源码仓库。用户自行构建软件时由本机脚本生成，CI 发布时由 Windows runner 生成。

Windows 安装包产物位于：

```text
src-tauri/target/release/bundle/nsis/
```

当前 Windows NSIS 配置见 `src-tauri/tauri.windows.conf.json`：

```json
{
  "bundle": {
    "targets": ["nsis"],
    "windows": {
      "nsis": {
        "installMode": "both"
      }
    }
  }
}
```

`installMode: "both"` 会让安装器提供当前用户/所有用户安装选择，并进入安装路径相关流程；选择所有用户安装时会触发管理员权限。当前不把 MSI 作为默认 Windows 发布资产。

## relay 打包规则

`cc-notice-relay` 是 Hook 独立执行的命令行工具，安装后位于：

```bash
~/.cc-notice/bin/cc-notice-relay
```

macOS 发布包中的 relay 统一使用 universal 二进制，不随 App 主程序 target 缩窄为单架构。也就是说：

- x64 App 包：主程序为 `x86_64`，relay 为 `x86_64 arm64` universal。
- arm64 App 包：主程序为 `arm64`，relay 为 `x86_64 arm64` universal。
- universal App 包：主程序和 relay 都是 `x86_64 arm64` universal。

这样可以避免在 Intel 和 Apple Silicon 机器之间安装或开发构建时，`~/.cc-notice/bin/cc-notice-relay` 被单架构 relay 覆盖后无法运行。

## 安装和覆盖行为

macOS 安装包本身不会在安装阶段主动写入 `~/.cc-notice/bin`。

应用启动时会调用 `ToolBinService::ensure_relay_installed()`：

- 如果 `~/.cc-notice/bin/cc-notice-relay` 不存在，会从 App 资源目录复制 relay。
- 如果已安装 relay 和 App 资源目录中的 relay 内容不同，会覆盖安装。
- 写 Hook 配置前也会再次确保 relay 已安装。

因此发布包必须保证随包资源中的 relay 是 universal。否则用户启动新版应用时，home 目录中的 relay 可能会被错误架构覆盖。

## 架构验证

构建后可以用以下命令检查架构：

```bash
file "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/CC Notice.app/Contents/MacOS/cc-notice"
file "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/CC Notice.app/Contents/Resources/assets/tools/cc-notice-relay"
file "src-tauri/target/universal-apple-darwin/release/bundle/macos/CC Notice.app/Contents/MacOS/cc-notice"
file "src-tauri/target/universal-apple-darwin/release/bundle/macos/CC Notice.app/Contents/Resources/assets/tools/cc-notice-relay"
```

预期：

- arm64 包主程序为 `Mach-O 64-bit executable arm64`。
- arm64 包内 relay 为 `Mach-O universal binary with 2 architectures`。
- universal 包主程序和 relay 均为 `Mach-O universal binary with 2 architectures`。

也可以逐个文件执行：

```bash
lipo -archs "<binary-path>"
```

universal relay 应输出：

```text
x86_64 arm64
```

## 验证命令

脚本配置测试：

```bash
npm run test -- src/test/packageScripts.test.ts
```

relay 安装/覆盖逻辑测试：

```bash
cargo test --manifest-path src-tauri/Cargo.toml app_services::tool_bin_service -- --nocapture
```

## 固件发布边界

app 仓库发布包继续内置 `src-tauri/assets/firmware` 目录下的固件产物和 `manifest.json`。用户构建软件时不需要安装 Arduino CLI、Pico SDK、STM32CubeProgrammer 等固件编译工具链；这些工具链只由维护者在本地构建固件时使用。

如果固件有变更，维护者需要先在本地固件工程完成构建和测试，再把生成后的固件产物同步到 `src-tauri/assets/firmware` 并随 app 仓库提交。GitHub Actions 的 CI 和 Release workflow 不运行固件构建脚本。

`npm run test` 中与固件相关的默认测试只检查 app 仓库内置的 `src-tauri/assets/firmware/manifest.json`、固件产物文件和 `src-tauri/templates/boards.yaml` 是否自洽。根目录 `firmware/` 源码 invariant 不属于 app 仓库 CI 边界。

## GitHub Actions

当前包含两个 workflow：

- `.github/workflows/ci.yml`：在 macOS、Windows、Linux 上执行 `npm ci`、`npm run test`、`npm run build` 和 `cargo check --manifest-path src-tauri/Cargo.toml`。
- `.github/workflows/release.yml`：在 tag `v*` 时构建 macOS Intel、macOS Apple Silicon 和 Windows 安装包，上传 workflow artifact，并创建 draft GitHub Release；手动触发时可选择 `all`、`windows` 或 `macos`，便于只验证指定平台安装包。

macOS Release 分别使用 `npm run package:mac:x64` 和 `npm run package:mac:arm64`，产出适配 Intel 芯片和 Apple Silicon 芯片的两个安装包；随包 relay 仍会先合成为 universal 二进制，确保辅助进程在两类芯片上都可运行。Windows Release 使用 `npx tauri build --bundles nsis`，只发布 NSIS `.exe` 安装包，并使用 `installMode: "both"` 让安装器提供当前用户/所有用户安装选择和安装路径相关流程；该模式会触发管理员权限。当前 Release 暂停 Linux 发布；恢复 Linux 发布前，需要先补齐 Linux 测试平台、Release workflow 和 README 说明。

## 注意事项

- 在开发机上构建 macOS 单架构 App 时，不能把单架构 relay 长期留在 `src-tauri/assets/tools/cc-notice-relay`。
- 当前 macOS 发布脚本会先分别构建 x64 和 arm64 relay，再用 `lipo -create` 合成 universal relay，并同步到资源目录。
- 如果发现 Hook 报 `Bad CPU type in executable` 或类似架构错误，先检查 `~/.cc-notice/bin/cc-notice-relay` 是否为 universal。
- 在 Windows 上构建后，不要把 `src-tauri/assets/tools/cc-notice-relay.exe` 加入 Git；它是平台相关生成物。
