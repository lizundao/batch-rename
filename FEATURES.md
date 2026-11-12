# 批量重命名 - 功能列表

> Tauri + React 桌面端，仅参考功能逻辑，UI 自行设计。
> 开发顺序：从上到下依次实现，完成一项勾选一项。
>
> **产品原则**：开源 · 离线 · 安全 · 方便 · 绿色 — 详见 [PRINCIPLES.md](./PRINCIPLES.md)

---

## 阶段 0：项目基础

- [x] 0.1 初始化 Tauri + React + TypeScript 项目
- [x] 0.2 定义核心数据类型（`FileItem`、重命名模式、各模式配置）
- [x] 0.3 预览计算引擎骨架（`computePreview`）
- [x] 0.4 全局状态管理（文件列表、当前模式、排序、配置）

---

## 阶段 1：文件列表管理

- [x] 1.1 添加文件（多选文件对话框）
- [x] 1.2 添加文件夹（可选是否递归）
- [x] 1.3 拖拽导入文件/文件夹
- [x] 1.4 从列表移除单个文件
- [x] 1.5 清空列表
- [x] 1.6 文件计数显示
- [x] 1.7 排序：按名称升序 / 降序
- [x] 1.8 排序：按修改时间（可选）
- [x] 1.9 文件列表 UI：原名 + 预览名 + 状态标识
- [x] 1.10 预览状态：未变更 / 将变更 / 冲突 / 非法

---

## 阶段 2：查找替换

- [x] 2.1 查找内容输入
- [x] 2.2 替换成输入（可为空，即删除匹配内容）
- [x] 2.3 是否替换文件扩展名（开关）
- [x] 2.4 多条替换规则，按顺序链式执行
- [x] 2.5 添加 / 删除替换规则
- [x] 2.6 实时预览更新
- [x] 2.7 （扩展）正则匹配
- [x] 2.8 （扩展）大小写敏感

---

## 阶段 3：插入内容

- [x] 3.1 内容类型：固定文本
- [x] 3.2 内容类型：序号（复用编号逻辑）
- [x] 3.3 内容类型：文件信息（创建时间、修改时间、大小）
- [x] 3.4 插入位置：开头 / 末尾 / 指定字符位置
- [x] 3.5 指定位置索引输入与越界处理
- [x] 3.6 实时预览更新
- [x] 3.7 （扩展）图片宽高（EXIF / 图片头）

---

## 阶段 4：自动编号

- [x] 4.1 序号前字符（前缀）
- [x] 4.2 开始序号
- [x] 4.3 固定位数（补零）
- [x] 4.4 序号后字符（后缀）
- [x] 4.5 序号类型：阿拉伯数字
- [x] 4.6 （扩展）序号类型：罗马数字 / 字母
- [x] 4.7 按当前列表排序顺序分配序号
- [x] 4.8 排序变化后重新计算预览
- [x] 4.9 保留原扩展名

---

## 阶段 5：手动编辑

- [x] 5.1 每行可编辑新文件名
- [x] 5.2 批量粘贴：剪贴板多行文本按行映射到文件列表
- [x] 5.3 粘贴行数与文件数不一致时的处理策略
- [x] 5.4 非法文件名字符校验
- [x] 5.5 实时预览 = 用户输入值

---

## 阶段 6：智能重命名

- [x] 6.1 模板占位符系统（`{stem}`、`{date}`、`{name}` 等）
- [x] 6.2 从文件名提取日期时间并格式化
- [x] 6.3 使用文件元数据填充模板
- [x] 6.4 预设模板列表
- [x] 6.5 （扩展）EXIF 拍摄时间（图片）
- [x] 6.6 （扩展）音频 ID3 标签

---

## 阶段 7：执行重命名

- [x] 7.1 执行前校验：非法字符、空文件名
- [x] 7.2 执行前校验：同目录新名冲突检测
- [x] 7.3 执行前二次确认
- [x] 7.4 Rust 命令：批量 `fs::rename`
- [x] 7.5 执行结果反馈（成功数 / 失败数 / 失败原因）
- [x] 7.6 失败策略：跳过并继续
- [x] 7.7 （扩展）失败全部回滚
- [x] 7.8 （扩展）操作历史与撤销

---

## 阶段 8：体验增强

- [x] 8.1 记住上次使用的模式与配置
- [x] 8.2 查找历史记录下拉
- [x] 8.3 深色 / 浅色主题（随系统）
- [x] 8.4 快捷键（添加文件、执行、清空等）
- [x] 8.5 多语言（中 / 英）

---

## 数据模型参考

```typescript
type RenameMode =
  | 'find-replace'
  | 'insert'
  | 'auto-number'
  | 'manual'
  | 'smart';

type FileStatus = 'unchanged' | 'changed' | 'conflict' | 'invalid';

interface FileItem {
  id: string;
  path: string;
  dir: string;
  originalName: string;
  stem: string;
  extension: string;
  previewName: string;
  status: FileStatus;
  error?: string;
  manualName?: string; // 手动编辑模式
}

interface FindReplaceRule {
  find: string;
  replace: string;
  replaceExtension: boolean;
}

interface AutoNumberConfig {
  prefix: string;
  start: number;
  padding: number;
  suffix: string;
  numberType: 'arabic' | 'roman' | 'alpha';
}

interface InsertConfig {
  contentType: 'text' | 'serial' | 'file-info';
  position: 'start' | 'end' | 'index';
  text: string;
  index: number;
  fileInfoField: 'created' | 'modified' | 'size' | 'width' | 'height' | 'dimensions' | 'exif-taken' | 'id3-title' | 'id3-artist' | 'id3-album' | 'id3-year';
}

interface SmartRenameConfig {
  template: string; // 如 "{date}_{stem}"
}
```

---

## Tauri Commands 规划

| Command | 阶段 | 状态 | 说明 |
|---------|------|------|------|
| `load_paths` | 1 | ✅ | 加载文件/文件夹路径 |
| `get_file_metadata` | 3/6 | — | 读取文件元数据（当前合并在 load_paths） |
| `validate_rename` | 7 | ✅ | 文件名与路径合法性校验（在 Rust 命令内完成，前端同步做预览校验） |
| `execute_rename` | 7 | ✅ | 执行批量重命名 |
| `rollback_rename` | 7 | ✅ | 回滚已成功的重命名 |

---

## 架构：功能与 UI 解耦

- [x] A.1 预览计算在 Web Worker 中执行，不阻塞 UI 主线程
- [x] A.2 预览请求防抖 + 取消过期任务，仅应用最新结果
- [x] A.3 文件加载 / 重命名在 Rust 后台线程（`spawn_blocking`）执行
- [x] A.4 任务状态独立管理（`TaskState`），UI 仅订阅状态展示进度
- [x] A.5 计算进行中保留上次预览，避免界面空白或卡顿
- [x] A.6 所有模式统一使用 Worker 预览，列表所见即执行所得
- [x] A.7 Worker 带超时与崩溃重建；高风险正则静态拒绝，取消的任务显式 settle
- [x] A.8 Rust 侧两阶段临时名事务：支持交换与链式改名，绝不覆盖目标，失败自动放回原名
- [x] A.9 严格 CSP、`withGlobalTauri: false`、`panic = "abort"`、渲染异常降级页

---

## 当前进度

**已完成：阶段 0 ~ 8 核心 + 扩展（含 EXIF/ID3、回滚与多语言）。**

**功能清单已全部完成。** 回归检查见 `npm run test:regression` 与
`cargo test --manifest-path src-tauri/Cargo.toml --lib`；后续可按需打磨 UI 或增加新能力。

运行开发环境：

```bash
npm run tauri dev
```
