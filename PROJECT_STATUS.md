# DeepSeek Codex GUI — PROJECT_STATUS.md

最后更新：2026-08-12

## 1. 项目概述

**项目名称：** DeepSeek Codex GUI

**本地目录：**

`D:\AI工作室\DeepSeek Codex GUI`

**目标：**

开发一个 Windows Electron 桌面客户端，以 OpenAI Codex CLI / app-server 为底层 Agent，通过现有配置使用 DeepSeek V4 Flash，并让界面、任务流和 Agent 操作体验尽量接近 Codex 桌面端。

## 2. 主要代码文件

- `main.js`：Electron 主进程、Codex app-server、IPC、Thread / Turn 等
- `preload.js`：主进程与 renderer 的安全桥接
- `renderer.js`：前端交互、聊天、侧边栏、附件等
- `git-review-ui.js`：代码审查与 Git 操作中心界面
- `git-review-manager.js`：Git Diff、暂存、提交、安全存档和恢复
- `index.html`：界面结构与样式
- `recent-projects.js`：最近项目持久化
- `thread-history.js`：Thread 历史记录
- `package.json`：依赖、启动、打包配置

## 3. 已完成 / 已验证功能

### Agent 与会话
- Electron GUI 可正常启动
- DeepSeek V4 Flash 已接入 Codex
- `thread/start` 创建任务
- `thread/resume` 恢复历史任务
- “+ 新建任务”创建全新 Thread，不继承旧任务对话
- 当前 Turn 可停止 / 中断
- 停止后可以在同一 Thread 中继续对话

### 输入与聊天
- Enter 发送
- Shift+Enter 换行
- 中文输入法组合态不会误发送
- 用户 / Assistant 消息展示
- 历史 Thread 恢复时显示旧消息

### 项目管理
- 选择本地项目
- 最近项目列表
- 最近项目移除
- 项目名悬停显示完整路径

### 历史任务
- 历史任务恢复
- 搜索
- 今天 / 昨天 / 更早分组
- 重命名
- 删除

### Agent 操作体验
- 命令执行审批
- 文件修改 Diff 展示
- 执行活动卡片
- 当前执行步骤卡片：计划、当前操作、完成/停止/失败状态
- 顶部模型 / 连接状态
- 顶部 Turn 状态：空闲、Thinking、Running、等待审批、已完成、已停止、错误
- GUI 模型选择与 Low / Medium / High 推理强度设置

### 附件
- 输入区已有 `+` 附件按钮
- 可选择多个附件并显示附件标签
- 支持将本地文件拖入输入区
- 支持从浏览器或截图工具拖入没有本地路径的图片对象
- 支持从浏览器或聊天窗口拖入没有本地路径的 Excel、PDF、CSV、TXT 等普通文件
- 图片附件显示缩略图；普通附件显示扩展名和大小
- 显示附件数量与总大小，并支持一键清空全部附件
- 支持在输入区使用 Ctrl+V 粘贴 PNG、JPEG 或 WebP 图片
- 截至 2026-08-08，附件发送链路经 Codex 修复后，用户已实际验证可以读取上传附件
- renderer 发送消息时会同时传递当前附件数组
- preload 通过 IPC 将文本和附件一起交给 main 进程
- 图片使用 app-server 支持的 `localImage` 输入
- 普通文件复制到用户目录下的 `.deepseek-codex-attachments` 临时目录
- 临时文件名使用英文、数字和扩展名，并将临时文件绝对路径明确提供给 Codex
- 单个附件限制 20 MB，本次附件总大小限制 50 MB
- 不支持的类型、超限文件和附件状态同步失败会在界面提示
- Turn 完成或发送失败后清理本轮临时附件，启动时清理超过 24 小时的历史临时附件

历史问题包括：
- 只读项目目录，没有读本次附件
- Windows 中文路径变成 `???`
- Python/openpyxl 路径 `OSError: [Errno 22] Invalid argument`
- `UnicodeEncodeError: 'gbk' codec...`

后续修改附件功能时必须防止这些问题回归。

## 4. 打包状态

已经使用 `npx electron-builder --win --dir` 生成可运行的 unpacked EXE。

历史上 NSIS installer 构建曾因为网络 / TLS 下载 7zip 依赖失败，不代表应用代码失败。

图标定制暂缓。

## 5. 当前开发方式

项目已从“ChatGPT 给 PowerShell → 用户手工执行”的模式，转为：

**Codex 项目模式直接接管本地代码。**

目标工作流：

`用户描述需求 → Codex 读项目 → Codex 自己改代码 → 自己跑检查 → 自己修错误 → 用户只做必要 GUI 验证`

推荐模型：
- 日常功能开发：GPT-5.6 Luna Medium
- 较复杂跨文件问题：GPT-5.6 Luna High
- Luna 多次无法解决时再升级更强模型

## 6. 当前状态

附件链路已经由 Codex 修复，并由用户实际测试成功。

现在应从“补单个功能”逐步转向“完整 Agent 产品能力”建设。

本次长期规范整理新增：
- `ARCHITECTURE.md`：记录当前真实代码结构、IPC、Thread/Turn、附件和持久化链路。
- `DEVELOPMENT_RULES.md`：记录变更前检查、备份、回归和交付要求。
- `CHANGELOG.md`：记录重要用户可见变化和长期维护事项。

这些文档不替代 `AGENTS.md`、本文件和 `ROADMAP.md`；代码与已验证结果仍然优先。

本次交接检查结论：根目录交接文档与当前代码及已验证功能总体一致；未发现需要推翻既有功能记录的重大不一致。`recent-projects.js`、`thread-history.js` 未因附件修复而修改。

## 6.1 最近变更记录

### 2026-08-11 — 代码审查与 Git 操作中心

- 将原顶部只读 Git 小面板升级为完整审查中心，显示分支、同步状态、暂存、工作区、新文件和冲突统计。
- 支持按文件浏览带行号的已暂存 / 未暂存 Diff，并正确处理中文、空格文件名和大文件截断。
- 支持所选文件暂存、取消暂存和提交已暂存改动；提交不会自动推送到 GitHub。
- 新增项目安全存档点：使用独立临时索引和隐藏 Git ref 保存工作区，不改变当前分支或真实暂存区，也不会随普通推送上传。
- 支持恢复安全存档；恢复前自动再创建保护存档，较新的未跟踪文件不会被直接删除。
- 支持安全撤销所选文件：先自动存档，已跟踪文件恢复到 HEAD，新文件移入 Windows 回收站；冲突和重命名文件禁止单独撤销。
- 已通过 JavaScript 语法检查、真实临时 Git 仓库回归、应用启动检查，以及非 Git / Git 项目隔离视觉验收。

### 2026-08-08 — 附件真实发送链路完成

- 修复附件未进入 `turn/start` 的问题。
- 修复普通附件被复制到项目目录、中文文件名可能引发编码问题的问题。
- 使用 `.deepseek-codex-attachments` 作为安全临时目录。
- 已通过 JavaScript 语法检查和 `npm start` 启动检查。
- 用户已实际验证 Agent 可以读取上传附件。

### 2026-08-08 — 附件边界体验完善

- 增加主进程最终文件类型、单文件大小和总大小校验。
- 增加附件被拒绝、超限和同步失败时的界面反馈。
- 增加 Turn 完成、发送失败和应用启动时的临时附件清理。
- JavaScript 语法检查和 `npm start` 启动检查通过；真实边界场景仍需用户 GUI 验证。

### 2026-08-08 — 恢复侧边栏历史入口

- 对照现有稳定备份确认最近项目、历史任务、搜索、重命名和删除代码仍在。
- 在 renderer 完成加载后补充一次入口恢复，确保主进程恢复项目状态后动态侧边栏仍然挂载。
- 进一步绑定 Agent `ready` 状态，在主进程恢复最近项目后再次挂载最近项目和历史任务入口，修复首次渲染时序问题。
- 未修改 main.js、preload.js、附件发送链路或聊天逻辑。
- 已通过 JavaScript 语法检查、`npm start` 启动检查和运行态侧边栏检查。

### 2026-08-08 — Sidebar Regression Audit

- 审计确认最近项目、历史任务、搜索、菜单、重命名、删除代码仍存在，DOM 动态生成和事件绑定也仍存在。
- 审计确认 `index.html` 中的模型状态区域仍存在；主要缺口是 sidebar 缺少 `min-height: 0`、`overflow` 和底部区域固定约束，历史容器缺少独立滚动约束。
- 为 `.sidebar` 增加布局边界，为 `.sidebar-bottom` 增加不可压缩约束，为 `.thread-history-container` 增加独立滚动和 Flex 占位。
- 保留附件真实发送、聊天、Thread、DeepSeek、审批、Diff、停止任务等功能。
- 已通过 JavaScript 语法检查、`npm start` 和实际窗口侧边栏元素检查。

### 2026-08-08 — Sidebar menu visibility follow-up
- 运行时检查确认最近项目与历史任务的菜单按钮和事件绑定仍在，但默认 `opacity: 0`，导致用户未悬停时看不到入口。
- 将两个 `⋯` 入口恢复为始终可见；保留现有的项目移除、任务重命名和任务删除逻辑，不改附件、聊天和 DeepSeek 链路。
- 备份：`backup-sidebar-visible-20260808-025805`。

### 2026-08-08 — Windows 打包版本更新
- 重新生成最新的 `dist\win-unpacked\DeepSeek Codex.exe` 和 `dist\DeepSeek Codex Setup 1.0.0.exe`。
- 已验证关闭后再次启动打包程序，最近项目、历史任务、搜索框、10 个菜单入口和底部模型状态均正常加载。
- 旧打包目录备份：`backup-dist-before-rebuild-20260808-032017`。

### 2026-08-08 — 附件输入效率优化
- 增加输入区文件拖拽上传。
- 增加 Ctrl+V 粘贴图片，图片由主进程保存到安全临时目录后进入现有发送链路。
- 拖拽文件复用主进程类型、大小和总量校验；粘贴图片限制为 PNG、JPEG、WebP，并复用 20 MB 单文件限制。
- 粘贴生成的临时图片支持在移除附件、发送后和过期清理时回收。
- 备份：`backup-attachment-drag-paste-20260808-0340`、`backup-status-before-drag-paste-record-20260808-0345`。

### 2026-08-08 — 拖拽图片兼容性修复
- 修复浏览器、截图工具或聊天窗口拖入图片时没有本地路径而被拒绝的问题。
- 有本地路径的文件继续使用主进程校验；无路径的图片按 Blob 数据保存到安全临时目录后进入同一发送链路。
- 备份：`backup-drag-image-blob-fix-20260808-0350`。

### 2026-08-08 — 无路径普通附件兼容修复
- 修复从浏览器或聊天窗口拖入 Excel 等普通文件时显示“无法读取拖入内容”的问题。
- 新增普通 Blob 文件临时保存链路，按原始扩展名重新校验后提供给 Codex。
- 保留中文路径、本地路径文件和图片拖拽的既有处理方式。
- 备份：`backup-drag-file-blob-fix-20260808-0400`。

### 2026-08-08 — Agent 运行状态完善
- 复用现有 Turn、命令、文件修改、计划、Diff、审批和错误事件。
- 在顶部增加当前 Turn 状态提示，区分 Thinking、Running、等待审批、已完成、已停止和错误。
- 未修改 app-server RPC、附件链路、Thread、停止按钮和审批协议。
- 备份：`backup-agent-status-20260808-0410`、`backup-status-before-agent-status-record-20260808-0415`。

### 2026-08-08 — 附件预览与批量管理
- 图片附件增加缩略图预览。
- Excel、PDF、CSV、TXT 等普通附件显示扩展名和文件大小。
- 增加附件数量、总大小和“清空全部”操作。
- 预览只读取图片数据，不改变附件真实发送链路。
- 备份：`backup-attachment-preview-20260808-0420`、`backup-status-before-attachment-preview-record-20260808-0425`。

### 2026-08-08 — 当前执行步骤展示
- 复用已有计划、命令执行、文件修改、Diff、错误和 Turn 生命周期事件。
- 增加“当前执行步骤”卡片，显示计划步骤、完成数量和当前正在执行的操作。
- Turn 完成、停止或失败时自动收尾，不改变原有活动卡片和停止逻辑。
- 备份：`backup-status-before-progress-record-20260808-0430`。

### 2026-08-08 — 模型与推理强度设置
- 顶部模型状态入口增加设置面板。
- 模型列表优先从 app-server `model/list` 读取，无法读取时保留 DeepSeek V4 Flash 默认选项。
- 设置 `model` 和 `effort` 接入 `thread/start`、`thread/resume` 和 `turn/start`。
- 设置保存到用户目录下的 `.deepseek-codex-gui/model-settings.json`，下一条消息生效。
- 当前任务执行中禁止切换，避免影响正在运行的 Turn。
- 备份：`backup-model-settings-20260808-0440`、`backup-status-before-model-settings-record-20260808-0450`。

### 2026-08-08 — 错误日志与诊断页
- 主进程记录 RPC、Codex app-server、发送失败、超时和进程退出错误。
- 日志保存到用户目录 `.deepseek-codex-gui/error-log.jsonl`，最多保留 120 条，并对 API Key / Bearer Token 脱敏。
- 顶部增加“诊断”入口，显示运行环境、当前模型、项目、Thread/Turn 状态和最近错误。
- 支持刷新、复制诊断信息和清空日志，不改变聊天、附件、审批、Diff 或停止链路。
- 备份：`backup-diagnostics-before-20260808-0449`。

### 2026-08-08 — 消息复制与剪贴板体验
- 用户消息和 Agent 回复增加悬停显示的“一键复制”按钮。
- 复制优先使用系统 Clipboard API，并保留 Electron 环境下的兼容回退。
- 保留输入框原生 Ctrl+C / Ctrl+V、图片粘贴和附件拖拽链路。
- 备份：`backup-clipboard-before-20260808-0456`。

### 2026-08-08 — 输入框右键剪贴板菜单
- Electron 窗口为可编辑输入区域增加右键菜单。
- 支持复制、剪切、粘贴、删除和全选；粘贴图片继续进入已有图片附件流程。
- 备份：`backup-context-menu-before-20260808-0503`。

### 2026-08-08 — 失败任务一键重试
- 任务失败后在失败消息旁显示“重试”按钮。
- 重试复用当前 Thread，不新建任务、不删除历史上下文。
- 文字和附件请求都会保留一次安全重试快照，图片、Excel、PDF 等附件失败后仍可重试。
- 重试失败时保留新的错误信息和新的重试入口；成功完成后清理重试快照。
- 下一步推荐：项目级默认模型。

### 2026-08-08 — 项目级默认模型
- 模型设置增加“当前项目 / 全局默认 / 跟随全局默认”范围选择。
- 项目设置保存到 `.deepseek-codex-gui/project-model-settings.json`，按规范化项目路径区分。
- 切换项目、打开最近项目或恢复历史任务时自动加载对应模型和推理强度。
- 当前项目设置优先于全局默认；未覆盖的项目继续使用全局默认。
- 下一步推荐：Codex app-server 自动重连。

### 2026-08-08 — Context / Token 使用情况
- 顶部增加上下文使用入口，显示本轮输入占模型上下文窗口的百分比。
- 面板显示本轮输入、缓存输入、输出、推理输出、Thread 累计 Token 和模型上下文窗口。
- 数据来自 app-server `thread/tokenUsage/updated`，不做本地估算；无数据时显示等待状态。
- 下一步推荐：Git 状态与当前修改文件。

### 2026-08-08 — Codex app-server 自动重连
- app-server 进程退出或初始化失败后，主进程按指数退避自动重连，最长等待 30 秒并持续重试。
- 连接中断时立即结束挂起 RPC、清理失效审批，并将正在执行的 Turn 标记为失败，避免界面永久等待。
- 重连成功后自动尝试恢复当前 Thread；无法恢复时保留历史记录，并让下一条消息创建新的 Thread。
- 顶部状态显示“自动重连中”，正常恢复后回到“已连接”；应用退出时取消重连计时器。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — Git 状态与当前修改文件
- 顶部增加只读 Git 状态入口，按需显示当前分支、上游同步、暂存、修改、未跟踪和冲突文件数量。
- 面板列出当前项目的修改文件和 Git 状态码，支持刷新；切换项目时自动清空旧项目结果。
- 主进程通过 `execFile` 调用 Git，不经过 shell，不执行提交、暂存、回退或其他写操作。
- 当前项目不是 Git 仓库或系统没有 Git 时显示明确提示，并记录诊断信息。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — 主题皮肤系统
- 保留深色、浅色、海洋蓝、紫夜四套基础主题，并增加基于用户提供的七龙珠 Q 版拼图的 12 套角色主题：悟空、克林、龟仙人、桃白白、沙鲁、兰琪、琪琪、贝吉塔、人造人 18 号、布尔玛、魔人布欧、界王。
- 16 套主题统一覆盖主界面、侧边栏、聊天、附件、审批、Diff、执行卡片、诊断、Git 和 Token 面板。
- 顶部增加主题选择入口，切换后立即生效，不需要重启程序。
- 主题保存到用户目录 `.deepseek-codex-gui/theme-settings.json`，程序重启后自动恢复。
- 12 位角色已拆分为项目内 `assets/dragonball-premium/*.jpg` 独立素材，不再使用整张拼图作为小型 CSS 精灵图，也不依赖开发机桌面路径。
- 角色主题升级为完整视觉皮肤：大幅角色主视觉、角色编号与英文签名、主题专属气场光效、标题强调色、玻璃卡片、输入区光效和高级主题选择面板会同步变化。
- 主题选择面板增加当前主题预览、基础主题分组、12 张角色卡片、选中状态与独立滚动区域。
- 已在真实 Electron 窗口中完成 1200×780 和最大化尺寸视觉检查，并验证悟空切换到贝吉塔后配色、角色图、签名和本地保存同步生效。
- 已重新生成 `dist\win-unpacked\DeepSeek Codex.exe` 与 `dist\DeepSeek Codex Setup 1.0.0.exe`，并从打包版本重新启动验证角色资源和 app-server 正常加载。
- 保留默认深色主题作为兼容基准，不改变聊天、附件、Thread、审批、Diff、停止任务和历史任务逻辑。
- 备份：`backup-dragonball-premium-redesign-before-20260808-0720`。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — 七龙珠主题参考图级重制

- 以用户确认的 1586×992 悟空概念图作为像素级视觉目标，重新制作深蓝黑水墨底、橙色笔触、右侧角色主视觉、图标功能卡、宽幅输入区和底部主题坞。
- 为悟空、克林、龟仙人、桃白白、沙鲁、兰琪、琪琪、贝吉塔、人造人 18 号、布尔玛、魔人布欧、界王生成 12 张独立 1586×992 高清水墨主视觉，保存于 `assets/dragonball-hero/*.png`。
- 角色主舞台改用独立横版主视觉；原有 `assets/dragonball-premium/*.jpg` 继续作为主题面板、Logo 与主题坞缩略图，避免拉伸或方形硬裁切。
- 引入本地 Phosphor 图标库，四张欢迎页功能卡改为真实图标和箭头；点击卡片会把对应任务提示填入输入框。
- 欢迎页增加可直接切换的底部主题坞，提供悟空、贝吉塔、龟仙人、沙鲁和“更多主题”入口；切换仍复用原主题 IPC 和持久化文件。
- 欢迎页期间精简顶部辅助入口；进入对话后诊断、Token、Git、主题和 Turn 状态入口自动恢复，现有功能没有删除。
- 已完成 1586×992 与 1200×780 实机视觉对照；悟空与贝吉塔已实际点击切换并验证 `theme-settings.json` 持久化。
- 已通过 `main.js`、`preload.js`、`renderer.js` 语法检查，12 张主视觉尺寸检查、app-server 启动检查和 `app.asar` 资源检查。
- 已重新生成 `dist\win-unpacked\DeepSeek Codex.exe` 与 `dist\DeepSeek Codex Setup 1.0.0.exe`，并从打包版启动完成最终截图验收。
- 本次只修改主题目录、欢迎页显示层、图标依赖和项目文档；聊天、附件、Thread、历史任务、审批、Diff、停止任务和 DeepSeek 调用链路未重构。
- 备份：`backup-theme-reference-match-before-20260808-070104`。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — 欢迎标题毛笔字体匹配

- 将欢迎标题从依赖本机系统楷体改为项目内置的 `MaShanZheng-Regular.ttf`，安装到其他 Windows 电脑后仍保持一致笔触。
- 字体和 `SIL Open Font License 1.1` 许可文件保存在 `assets/fonts/`，并已确认同时进入 `app.asar`。
- 按参考图校准标题字号、字距、行高、细描边和橙色“开发”的轻微笔触角度；普通界面文字保持原有清晰字体。
- 已完成 1586×992 参考图对照、1200×780 紧凑窗口检查和最终打包版截图验收，标题无换行、裁切或字体回退。
- `package.json` 增加打包排除规则，不再把 `backup-*` 和 `design-qa` 开发资料放入安装包，避免备份文件导致安装包异常膨胀。
- 已通过 `main.js`、`preload.js`、`renderer.js` 语法检查，重新生成并启动 `dist\win-unpacked\DeepSeek Codex.exe` 与 `dist\DeepSeek Codex Setup 1.0.0.exe`。
- 备份：`backup-theme-font-match-before-20260808-074321`。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — 角色主题品牌头像统一

- 修复左上角蓝紫色渐变 `D` 与水墨角色主题风格不一致的问题。
- 新增项目内真实透明素材 `assets/brand/deepseek-codex-ink-mark.png`：黑色水墨印章、橙色手绘外圈、象牙白毛笔 `D` 和克制的蓝色笔触。
- 新头像只覆盖 12 套角色主题；四套基础主题及品牌文字、侧边栏布局和所有功能逻辑保持不变。
- 已完成透明边缘、42px 小尺寸、1586×992、1200×780 和最终打包版检查；没有绿边、裁切、模糊或布局位移。
- 已确认最终头像素材进入 `app.asar`，中间生成文件已移入备份目录，不进入安装包。
- 已通过 `main.js`、`preload.js`、`renderer.js` 语法检查，并重新生成、启动最新 Windows 安装包和 unpacked EXE。
- 本次修改的是应用内品牌头像，不等同于 Windows EXE / 安装包图标；路线图中的“产品图标”仍待完成。
- 备份：`backup-brand-avatar-before-20260808-080130`。
- 下一步推荐：Thread 导出 Markdown。

### 2026-08-08 — 长期开发文档固化
- 按项目长期维护提示词补充 `ARCHITECTURE.md`、`DEVELOPMENT_RULES.md` 和 `CHANGELOG.md`。
- 未修改业务代码、附件链路、聊天、Thread、审批、Diff、停止任务或侧边栏逻辑。
- 现有规范文件已备份到 `backup-docs-before-long-term-rules-20260808-0330`。

### 2026-08-08 — 首页 Hero 标题参考图背景素材化
- 将首页固定标题「今天想开发什么？」从运行时文本和字体渲染改为用户参考图提取的本地透明图片 `assets/hero-title-reference-transparent.png`。
- 标题字形、飞白、橙色「开发」和下划线直接来自用户提供的参考图；透明处理只去除原截图背景，不再由系统字体或通用字体重新绘制。
- `index.html` 的首次欢迎页和 `renderer.js` 的新建任务回退模板统一使用同一张本地图片，避免刷新或新建任务时出现两套标题。
- 悟空及其他角色的完整水墨主视觉仍由 `assets/dragonball-hero/*.png` 提供；图片只承载标题，不覆盖真实功能卡、输入框、附件和侧边栏交互。
- 标题容器保留响应式约束：常规窗口最大宽度 600px，紧凑高度下收窄到 480px；副标题、功能卡、输入框、侧边栏和全部 Agent 链路不变。
- 已通过 `main.js`、`preload.js`、`renderer.js` 语法检查，完成开发版与最新打包版 1586×992 / 1200×780 视觉检查；`app.asar` 已确认包含透明标题图片且不含开发备份；备份：`backup-hero-reference-background-before-20260808-131924`。
- 下一步推荐：Thread 导出 Markdown。

## 6.2 2026-08-09 — 多 Thread 并发运行时架构升级

本次核心架构升级已完成代码落地，新增 `task-runtime-manager.js`，将运行时从单一 `currentThreadId/currentTurnId` 改为可扩展的 `TaskRuntimeManager`：

- 每个 Thread 独立保存 `TaskState`，包含 Turn、状态、消息、流式输出、命令、审批、Diff、错误、Token、项目路径和附件临时文件。
- 第一版最大并发数为 2；超过上限的任务进入队列，前序 Turn 完成、停止或失败后自动取出下一项。
- app-server 的 Agent delta、工具活动、审批、Diff、计划、Token、错误和 Turn 生命周期事件按 `threadId` / `turnId` 路由，不再依赖第二套全局 ID。
- Stop 只向当前选中任务发送对应的 `threadId` / `turnId`；审批请求保存并校验所属 Thread / Turn；任务附件按 Thread 隔离清理。
- 切换历史任务不再因为其他任务运行而被阻止；后台任务继续运行，历史列表显示排队、执行中、等待审批和失败状态。
- 同一项目同时存在活动任务时显示非阻塞风险提示；当前版本不自动创建 Git Worktree，用户仍需自行避免并行编辑同一文件。
- app-server 重连时逐个恢复已知 Thread；无法伪造恢复正在执行的 Turn，会明确标记对应任务失败并保留上下文供继续发送。
- 历史 Thread 在后台运行期间切换回来时，会先恢复原历史消息，再叠加当前运行时输出、活动和审批；排队中的任务会锁定重复发送，避免覆盖队列内容。
- 修复 `turn/start` 返回与审批请求到达顺序交错时的状态竞态，避免等待审批被错误覆盖为 Running。
- 审批响应同时校验 `threadId`、`turnId` 和 `itemId`（协议提供时），进一步避免并发审批串线。

本次修改文件：

- `task-runtime-manager.js`
- `main.js`
- `preload.js`
- `renderer.js`
- `PROJECT_STATUS.md`
- `ROADMAP.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`
- `CHANGELOG.md`

本次备份：`backup-multitask-architecture-before-20260808-235445`、`backup-multitask-final-before-polish-20260809-0015`、`backup-multitask-before-approval-race-20260809-0055`、`backup-multitask-before-item-approval-check-20260809-0100`。当前目录不是 Git 仓库，因此以这些备份作为回滚点。

自动验证已通过：三个 JavaScript 语法检查、Task Runtime Manager 并发队列冒烟测试、`npm start` 启动检查和窗口级无白屏检查。真实的双任务并发、第三任务排队、切换后台任务、任务级 Stop / Approval / Diff 仍需 GUI 人工验收。

已知边界：并发任务运行状态当前以内存 TaskState 为主，应用完全退出后不会恢复尚未完成的运行态；Thread 历史数据仍由现有 JSON 文件维护。后续可再增加运行态持久化和 Git Worktree 隔离。

## 6.3 2026-08-09 — 全量更新日志网页版

新增项目根目录网页 `release-notes.html`，将当前 `CHANGELOG.md` 中已记录的 24 条重要更新整理成可直接浏览的发布页：

- 使用当前客户端的深色水墨、橙色能量线、悟空主视觉、玻璃卡片和本地毛笔字体，保持与龙珠主题客户端一致的视觉语言。
- 支持按关键词搜索、按类别筛选、按版本筛选，以及 12 套角色主题即时切换。
- 页面使用项目内本地素材，直接双击 HTML 即可查看；素材路径相对项目根目录解析，不涉及网络上传。
- 增加响应式布局，窄屏时侧栏自动转为顶部导航，更新记录和主题面板保持可读。
- 当前页面为独立静态网页，不改变 Electron 主程序的聊天、附件、Thread、审批、Diff、停止任务或 app-server 链路。

自动验证已通过：

- 页面内嵌 JavaScript 语法检查通过。
- 15 个本地资源引用全部存在。
- 浏览器 1280×720 默认视口和 820×900 窄屏视口检查通过。
- 搜索 `Thread` 返回 7 条记录；版本 `2026.08.09` 返回 1 条记录。
- 悟空 / 贝吉塔主题切换与默认主题恢复通过；浏览器控制台无 warning / error。

同时生成可携带离线包：`release-notes-web-v1.1.0.zip`，包含网页、字体、图标和 12 套角色视觉素材；视觉验收截图：`release-notes-qa-1280x720.png`；详细记录见 `design-qa.md`。

已知边界：项目根目录的 `release-notes.html` 依赖同目录 `assets/` 和本地 Phosphor 图标 CSS；跨电脑发送时使用已生成的 `release-notes-web-v1.1.0.zip`，解压后双击其中的 `release-notes.html` 即可。

## 7. 下一步优先级

### P0
1. 多 Thread 并发 GUI 真实验收

当前最推荐下一步：在真实 GUI 中验收双任务同时运行、第三任务排队、后台切换和任务级 Stop / Approval / Diff，确认核心架构升级没有回归。

### P1
2. 运行态持久化与崩溃恢复
3. Git Worktree 项目隔离
4. 更新日志从 `CHANGELOG.md` 自动生成

### P2
5. 正式安装包与自动更新
6. 设置迁移与数据备份 / 恢复
7. 性能与内存优化

## 6.4 2026-08-09 — Thread 导出 Markdown

历史任务更多菜单新增“导出 Markdown”。导出内容包含任务标题、Thread ID、项目路径、时间信息，以及可获得的用户消息、Agent 回复、命令执行和文件修改记录。

- 当前驻留任务直接使用内存中的 TaskState 和历史 Thread 快照。
- 未驻留的历史任务会先通过 app-server 恢复 Thread，再生成导出文件。
- 文件通过系统保存对话框写入 UTF-8 Markdown，默认保存到用户 Downloads 目录。
- 导出失败会在界面中明确提示，不影响当前聊天和任务运行。
- 已补充任务最终状态、模型与推理强度、附件清单、审批记录、Token 使用和错误记录。

自动验证已通过：三个 JavaScript 语法检查、`npm start` 启动检查和 Windows unpacked / NSIS 打包。用户已完成真实 GUI 验收：应用重启后仍可从历史任务菜单成功导出 Markdown。

## 6.5 2026-08-09 — 右侧当前任务侧边栏

在主聊天区右侧空白区域增加按需打开的当前任务侧边栏：

- 展示当前 Thread、项目、模型、任务状态、最近执行步骤、文件变更、待审批和 Context 使用情况。
- 支持输入简短追问或补充说明，并发送到当前 Thread。
- Agent 完整回复仍显示在主聊天区，不复制 Thread、Turn 或 app-server 链路。
- 默认不占用主聊天空间，通过顶部按钮按需打开。
- 适配窄屏时自动铺满为浮层面板。
- 已完成三个 JavaScript 语法检查、`npm start` 启动检查和 Windows unpacked / NSIS 打包；真实交互仍需用户 GUI 验收。

## 6.6 2026-08-09 — 历史任务自动标题

- 用户首次发送消息后，历史任务会根据问题内容自动生成短标题。
- 自动标题会去除常见指令前缀，按首个完整句提取并限制长度，改善侧边栏浏览效率。
- 用户手动重命名后记录为手动标题，后续消息不会覆盖。
- 历史记录加载时会兼容迁移过去的过长自动标题，无需重新发送消息。
- 自动标题长度进一步收敛为约 16 个字符，改善窄侧边栏显示。
- 已完成 JavaScript 语法检查和 Windows unpacked / NSIS 打包。

## 6.7 2026-08-09 — 顶部当前会话标题

- 顶部原先显示项目路径名称的位置，现在显示当前 Thread 标题。
- 手动重命名标题和自动生成短标题与左侧历史任务保持一致。
- 未选择会话时才回退显示当前项目名称。

## 6.8 2026-08-09 — 电脑访问权限选择

- 输入框底部新增三档权限：每次询问、允许工作区修改、完全访问。
- 权限选择持久化到用户目录，应用重启后恢复最后一次选择。
- 当前选择随下一条消息传递给 `turn/start`，保留原有审批卡片链路。
- 已完成 JavaScript 语法检查和 Windows unpacked / NSIS 打包；权限行为仍需用户 GUI 验收。

## 6.9 2026-08-09 — 执行记录折叠

- 命令执行和文件修改卡片默认折叠，只显示执行摘要和状态。
- 点击卡片标题可展开命令、输出和文件详情，再次点击即可收起。
- 主对话气泡保持完整显示，降低长任务对话的视觉噪音。
- 执行记录集中到主对话前部，主对话消息保持在下方。
- 前部增加可展开的耗时摘要，显示本轮 Agent 执行持续时间。

## 6.10 2026-08-09 — 四星球任务状态指示器

- 在左侧模型状态卡加入四星球图标。
- Agent 执行中旋转并发橙色光晕，任务完成后停止旋转并发绿色光，失败显示红色光。
- 使用项目资源 `assets/dragonball-four-star.png`，已完成语法检查和 Windows unpacked / NSIS 打包；真实动画效果仍需 GUI 验收。

## 6.11 2026-08-09 — 执行步骤左对齐

- 执行记录容器、命令卡片和 Diff 改为靠左排列，与主对话内容边界对齐。

## 2026-08-11 — Git 远程操作中心（开发中）

- 代码审查中心新增“远程同步”视图，显示远程仓库、跟踪分支、领先/落后状态和本地分支。
- 增加获取更新、快进拉取、推送和安全切换分支；推送/拉取/切换均需要用户确认。
- 拉取使用快进合并，检测到冲突或未提交修改时拒绝继续，避免覆盖用户工作。
- 已通过 JavaScript 语法检查、Git smoke test、diff 检查和应用启动回归；真实远程网络操作仍需用户在 GUI 中验证。

## 8. 下次 Codex 接手时

1. 阅读 `AGENTS.md`
2. 阅读本文件
3. 阅读 `ROADMAP.md`
4. 检查 `git status`
5. 阅读与当前任务直接相关的源码
6. 不要重新实现已经验证通过的功能
7. 完成任务后更新项目状态
8. 主动给出下一步 1～3 个优先建议

## 9. 2026-08-12 — 1.0.14 主题恢复回归修复

- 根因确认：新增顶部控件后，旧的 Context / Token 按钮仍尝试插入旧的 `model-pill` 父节点，并以不属于该节点的诊断按钮作为参考节点，触发 DOM `NotFoundError`。
- 该异常发生在主题加载之前，因此用户保存的 `C:\Users\JoyJo\.deepseek-codex-gui\theme-settings.json` 虽然仍是 `goku`，页面却停留在基础深色主题。
- 已将上下文用量、Git 审查、主题、API、诊断和内置代理状态入口统一挂载到 `.topbar-actions`，并保留启动中的代理状态占位文案。
- 已通过 `node --check main.js`、`node --check preload.js`、`node --check renderer.js`、`npm test` 和 `git diff --check`。
- 已重新生成并安装 `dist\\DeepSeek-Codex-Setup-1.0.14.exe`；本机实际启动确认悟空主题、水墨 D 图标、悟空背景、主题选择栏和 `代理 · 运行中 :17890` 均正常。

## 10. 2026-08-12 — 1.0.15 API 更换入口修复

- 根因确认：顶部“更换 API”按钮复用了 `.diagnostics-trigger`，在角色主题首页的欢迎状态下被统一隐藏；原生 `prompt` 也无法提供稳定一致的应用内体验。
- 已改为独立的 `api-key-trigger`，始终显示在顶部操作区，不受欢迎页诊断控件隐藏规则影响。
- 新增与主界面一致的深色 API 设置窗口，支持密码输入、取消、Esc 关闭、空值提示、保存 / 重连状态和失败重试。
- 保存仍通过现有 `configure-deepseek-api` IPC 写入本机专用配置、备份旧配置并触发 Codex 重连，不在界面显示完整 API Key。
- 已通过三个 JavaScript 语法检查、`npm test` 和 `git diff --check`；已重新生成并安装 `dist\\DeepSeek-Codex-Setup-1.0.15.exe`。
- 用户实际验证通过：顶部“更换 API”按钮可打开应用内设置窗口，更换 API Key 后可以成功重连并发送消息。

## 11. 2026-08-12 — 1.0.16 顶部网络状态简化

- 顶部状态从“代理 · 运行中 :17890”改为面向用户的“网络正常 / 联网失败”，不再暴露代理实现和端口。
- 通过本地连接组件建立 HTTPS CONNECT 隧道并访问 `api.deepseek.com`，以真实网络结果决定绿色或红色状态。
- 启动检测期间显示“网络检测中”；网络组件退出、探测超时或目标不可达时显示“联网失败”。
- 已保留现有 Codex 代理注入、自动重连和 API 更换功能，状态展示与底层实现解耦。
- 已通过三个 JavaScript 语法检查、`npm test` 和 `git diff --check`；本地安装包待重新生成并进行 GUI 验收。

## 12. 2026-08-12 — 1.0.17 顶部网络状态颜色修复

- 提高角色主题下网络状态选择器优先级，确保“网络正常”为绿色、“联网失败”为红色、“网络检测中”为琥珀色。
- 不改变真实 HTTPS 连通性探测、内置连接组件或 Codex 会话链路。
- 已通过三个 JavaScript 检查、`npm test` 和 `git diff --check`。
- 已重新生成并安装 `dist\\DeepSeek-Codex-Setup-1.0.17.exe`；本机 GUI 实际验收确认角色主题下“网络正常”为绿色，状态文字、主题和原有连接链路均正常。

## 13. 2026-08-12 — 1.0.18 API 识别信息与命名

- “更换 API”窗口新增当前连接信息卡，显示本机保存的名称和脱敏 Key，仅保留识别所需的头部与尾部。
- 更换 API 时支持填写名称；名称写入 `C:\Users\\<用户名>\\.deepseek-codex-gui\\api-key-profile.json`，不保存第二份完整 Key。
- API Key 仍由 Codex 配置文件保存，界面和日志不显示完整内容。
- 已通过三个 JavaScript 语法检查、`npm test` 和 `git diff --check`。
- 已重新生成并安装 `dist\\DeepSeek-Codex-Setup-1.0.18.exe`；客户端窗口可正常启动。更换 API 面板的视觉捕获因桌面自动化窗口句柄失效暂未完成，仍需人工打开面板确认。
- 用户已完成 API 名称与脱敏 Key 面板的实际 GUI 验收。
- 安装器欢迎页、完成页和首次启动引导已统一为“安装与使用无需额外代理软件，应用自动完成网络连接”，并移除旧的代理提示文案。
- 已重新生成最终 `dist\\DeepSeek-Codex-Setup-1.0.18.exe`。
- 已推送 `v1.0.18` 标签并完成 GitHub Actions 自动发布；EXE、blockmap 和 `latest.yml` 均已确认可下载。
## 6.12 2026-08-09 — 首次启动安装引导

- 安装包首次启动显示引导向导，依次说明 Codex CLI、DeepSeek API、连接检测和权限设置。
- 支持直接打开 `.codex-deepseek` 配置目录并重新检测当前连接状态。
- 完成或跳过后写入用户目录状态文件，不再重复弹出；不读取、不上传、不复制 API 密钥。
- 已通过三个 JavaScript 语法检查和 Windows NSIS 打包；首次启动流程仍需用户在另一台电脑 GUI 验收。
## 6.13 2026-08-09 — 半自动 API 配置引导

- 首次启动向导增加 Codex CLI 自动检查、现有配置识别和连接检测。
- 用户可直接粘贴 `sk-` API Key，应用自动备份旧配置、写入专用配置目录并触发重连。
- API Key 输入框使用密码样式，界面不显示完整密钥；配置写入仍由用户明确点击保存触发。
- 已通过 JavaScript 语法检查和 Windows NSIS 打包；仍需在另一台电脑实测 API 配置成功链路。
## 6.14 2026-08-09 — 内置 Codex CLI 安装组件

- 安装包内置官方 Codex CLI Windows x64 组件，首次启动可一键离线解压安装。
- 不再依赖 npm、临时下载或 Node.js；安装 Codex CLI 本身不需要代理。
- 安装完成后自动重新检测可执行文件并用于 app-server。
- 内置组件会显著增加安装包体积；当前仍需另一台 Windows x64 电脑实测安装和启动。
## 6.15 2026-08-09 — 升级后引导重新显示

- 引导完成状态现在绑定应用版本；新版本首次启动会重新显示引导。
- 用户目录中的 API 配置、权限设置、主题和历史任务不会因升级引导而删除。
- 版本升级至 1.0.1，已准备重新打包验证。
## 6.16 2026-08-09 — Windows 内置组件解压修复

- 打包环境只从 `app.asar.unpacked` 读取 Codex CLI 压缩包，避免把 Electron 虚拟 `app.asar` 路径交给系统解压工具。
- 移除 Windows 自带 `tar.exe` 不支持的 `--force-local` 参数；解压时切换到资源目录并使用纯文件名，规避盘符冒号兼容问题。
- 已使用打包后的真实资源完成解压冒烟测试，成功得到 `package/vendor/x86_64-pc-windows-msvc/bin/codex.exe`。
- 已重新通过三个 JavaScript 语法检查和 Windows NSIS 打包。

## 6.17 2026-08-09 — 正式产品图标与 1.0.2 安装包

- 用户最终确认继续使用现有水墨品牌标志：黑色墨面、橙色手绘圆环和米白 `D`。
- 由 512×512 透明高清源图生成包含 16～256 像素的 Windows 多尺寸 ICO。
- 应用窗口、任务栏、可执行文件、安装器和卸载器统一使用同一产品图标；网页入口同时补充品牌 favicon。
- 已将当前电脑桌面的 `DeepSeek Codex` 和旧版 `Codex DeepSeek V4 Flash` 快捷方式显式指向新 ICO，并通知 Windows 刷新桌面图标。
- 版本升级至 1.0.2，已生成 `dist/DeepSeek Codex Setup 1.0.2.exe`。
- 已从最终 unpacked EXE 提取并目视核对嵌入图标；Windows 仍可能因系统图标缓存短暂显示旧图标，重装或刷新缓存后生效。

## 6.18 2026-08-09 — 品牌化 NSIS 安装器与 1.0.3 安装包

- 按用户选定的方案 1 重做 Windows 安装界面：左侧使用黑蓝水墨与橙色笔触品牌区，正式水墨 `D` 标志保持原样；右侧使用深色内容区、米白文字与橙色强调。
- 新增 164×314 安装 / 卸载侧栏、150×57 四节点安装进度头图，并将简体中文安装字体改为 `Microsoft YaHei UI`，避免默认宋体与客户端界面割裂。
- 新增“欢迎 → 安装位置 → 安装 → 完成”可见流程；全新安装默认当前用户，升级时保留既有安装范围，安装位置页支持直接编辑路径和打开文件夹选择窗口。
- 欢迎页明确说明内置 Codex CLI、本地配置和常规安装无需代理；完成页说明首次启动后会继续自动检查 Codex CLI 与 API 配置。
- 桌面快捷方式改为安装 / 升级时始终维护，同时创建开始菜单入口；安装器、卸载器、EXE 与应用窗口继续使用统一正式图标。
- 版本升级至 1.0.3，最终安装包为 `dist/DeepSeek Codex Setup 1.0.3.exe`。
- 已实际打开最终安装器并验证欢迎页、下一步导航和自定义安装位置页；视觉对比见 `design-qa/installer-reference-vs-implementation.png`，详细验收记录见 `design-qa.md`。
- 已知边界：NSIS 原生窗口标题栏与导航按钮保留 Windows 原生交互，以保证键盘、缩放和安装稳定性；另一台 Windows x64 电脑上的完整安装、首次引导、CLI 解压和 API 连接仍待最终实机验收。

## 6.19 2026-08-09 — NSIS 侧栏圆形标志显示修正

- 修正 NSIS 欢迎页在当前字体缩放比例下将侧栏横向压窄的问题。
- 对侧栏中的正式水墨 `D` 标志和光晕做显示端反向补偿，保持原有背景和安装流程不变。
- 已重新打开最终安装器实测：欢迎页圆环恢复为接近正圆，下一步可进入安装位置页；复核截图见 `design-qa/installer-1.0.3-welcome-circle-fix.png` 与 `design-qa/installer-circle-reference-vs-fix.png`。

## 6.20 2026-08-09 — NSIS 安装器高 DPI 资源适配

- 将安装 / 卸载侧栏资源升级为 `492×942`，顶部进度图升级为 `450×171`，保持 MUI 原生布局比例不变。
- Logo、光晕、进度节点和细线均按 3 倍源尺寸绘制，减少 Windows 125% / 150% 显示缩放时的位图插值模糊。
- 已实际打开重新打包后的欢迎页和安装位置页，确认窗口尺寸、文字排版、圆环比例和导航流程保持稳定。
## 2026-08-10 工作区中心（进行中）

- 已加入按需展开的“项目工作区”入口，不占用主聊天区域。
- 当前支持项目文件列表、最近修改文件、文件名/路径搜索，以及调用系统打开文件。
- 已加入项目目录边界校验，避免工作区操作访问项目外路径。
- JavaScript 语法检查已通过；仍需用户进行 GUI 点击验收。
## 2026-08-10 GitHub Actions 自动发布

- 已新增 Windows 自动发布工作流，推送版本标签后自动构建并创建 GitHub Release。
- 工作流会从官方 npm 源下载固定版本的 Codex CLI Windows 组件，避免安装包缺少内置 CLI。
- 发布前自动校验标签与应用版本一致，并运行三个 JavaScript 语法检查。
- `v1.0.7` 首次运行已验证 CLI 下载、语法检查和安装包构建均成功；发现标签触发了 electron-builder 隐式上传并因缺少令牌失败。
- 已禁止构建阶段隐式发布，统一由 Actions Release 步骤上传文件；`v1.0.8` 用于第二次完整验证。
- `v1.0.8` 已完成真实云端验证：Windows 构建成功，GitHub Release 自动创建，EXE、blockmap 和 latest.yml 均已上传。

### 2026-08-11 — 自动更新弹窗视觉统一

- 更新提醒与下载完成提醒已从 Windows 原生弹窗迁移为应用内深色主题浮层。
- 当前已完成视觉与交互检查，本机安装包待重新生成并安装验证。
