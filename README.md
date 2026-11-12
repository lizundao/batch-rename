# 批量重命名

基于 Tauri 2 + React 的本地批量文件重命名工具，由 [墨点 inkdot](https://inkdot.cn) 出品，采用 MIT 许可开源。

## 文档

| 文档 | 说明 |
|------|------|
| [简介](docs/简介.md) | 产品概述、系统要求、获取方式、安全边界 |
| [使用教程](docs/教程.md) | 五种模式、快捷键、操作流程 |
| [常见问题](docs/常见问题.md) | 安装、WebView2、撤销、正则等 FAQ |
| [产品原则](PRINCIPLES.md) | 开源 · 离线 · 安全 · 方便 · 绿色 |
| [功能列表](FEATURES.md) | 开发功能清单与架构说明 |
| [LICENSE](LICENSE) | MIT 许可证（英文，具效力） |
| [LICENSE.zh-CN.md](LICENSE.zh-CN.md) | MIT 许可证中文参考译本 |

## 产品原则

| | |
|---|---|
| **开源** | MIT 许可，源码公开，可自由使用与分发 |
| **离线** | 本地运行，断网也能用 |
| **安全** | 数据不出设备，不收集、不上传 |
| **方便** | 即装即用，轻巧顺手 |
| **绿色** | 无广告、无捆绑、无后台骚扰 |

## 安全设计

- 新文件名只能是「一个文件名」：拒绝路径分隔符、`..`、Windows 非法字符、保留设备名（CON / NUL / COM1…）与超长名称。
- 源与目标必须位于同一个已解析（canonicalize）的目录内；回滚记录同样校验，防止伪造路径跨目录移动。
- 目标已存在、批次内重名一律跳过，绝不覆盖文件；交换（A↔B）与链式（A→B→C）改名通过临时名两阶段事务完成，失败项自动放回原名。
- 单批上限 5000 个文件；目录遍历为迭代式，深度上限 32 层、文件上限 20000，不跟随符号链接 / junction。
- 预览在 Web Worker 中计算，带超时与崩溃重建；高风险正则写法被静态拒绝，不会冻结界面。
- Tauri 启用严格 CSP、`withGlobalTauri: false`，capabilities 仅开放窗口、对话框与打开链接所需权限。

## 开发

```bash
npm install
npm run tauri dev
```

校验：

```bash
npm run typecheck        # TypeScript 类型检查
npm run test:regression  # 文件名校验、序号边界、预览/冲突回归
cargo test --manifest-path src-tauri/Cargo.toml --lib  # Rust 文件操作回归
```

## 构建与打包

### 仅编译（安装包 + 可执行文件）

```bash
npm run build:release
```

产物位于 `src-tauri/target/release/`：

- **安装程序**：`bundle/nsis/*-setup.exe`
- **主程序**：`batch-rename.exe`

### 完整打包（编译 + 便携 ZIP）

```bash
npm run package:all
```

### 只重新打包便携 ZIP（不重编译）

```bash
npm run package:portable
```

两种脚本都会生成：

- **便携版目录**：`release/batch-rename-0.1.0-windows-x64-portable/`
- **便携 ZIP**：`release/batch-rename-0.1.0-windows-x64-portable.zip`（解压即用，非安装包）

便携包内含 `batch-rename.exe`、`docs/`、许可证与使用说明。打包脚本会检查 `tauri build` 退出码和 exe 时间戳，编译失败或产物过旧都会直接报错，不会把旧 exe 打进新包。

### 更新应用图标

```bash
npm run icons
```

### 发布

推送 `v*` tag 会触发 GitHub Actions 的三平台构建，并生成草稿 Release，产物统一为 ASCII 命名：

- `BatchRename-0.1.0-setup-win-x64.exe`
- `BatchRename-0.1.0-portable-win-x64.zip`
- `BatchRename-0.1.0-aarch64.dmg`
- `BatchRename-0.1.0-aarch64.app.zip`

macOS 产物未签名，首次打开若被 Gatekeeper 拦截，可执行 `xattr -dr com.apple.quarantine /Applications/BatchRename.app`。

## 技术栈

- 前端：React + TypeScript + Vite，预览计算在 Web Worker
- 后端：Rust + Tauri 2，文件操作在 `spawn_blocking` 后台线程
- 数据：纯本地，无网络依赖

## 许可

MIT License — 详见 [LICENSE](LICENSE) 与应用内「许可证」页。
