# DeepSeek Codex GUI — ARCHITECTURE.md

## 文档目的

本文档记录当前已经实现并检查过的系统结构，帮助后续修改定位边界，避免为了单个功能重写稳定链路。代码和可复现验证结果优先于本文档；发现不一致时，先修正文档或代码，再继续开发。

## 1. 总体结构

```text
Electron BrowserWindow
        │
        ├─ renderer.js       界面、聊天、侧边栏、附件选择
        │       │
        │       └─ preload.js 安全 IPC 桥接
        │
        └─ main.js           IPC、状态、Thread/Turn、Codex app-server
                │
                ├─ recent-projects.js  最近项目持久化
                ├─ thread-history.js   历史任务持久化
                └─ codex app-server    Agent 执行、事件和审批
```

## 2. 文件职责

| 文件 | 职责 | 修改风险 |
|---|---|---|
| `main.js` | Electron 主进程、启动 Codex app-server、JSON-RPC、IPC、Thread/Turn、附件临时文件、审批 | 高 |
| `preload.js` | 在 context isolation 下暴露最小化的 `window.deepseekCodex` API | 高 |
| `renderer.js` | 聊天输入与消息、Agent 活动、审批/Diff、侧边栏、历史任务、附件 UI | 高 |
| `index.html` | 初始 DOM、基础 CSS、sidebar 布局、聊天布局 | 中 |
| `recent-projects.js` | 最近项目的加载、保存、添加、移除 | 中 |
| `thread-history.js` | Thread 历史记录的加载、保存、排序、恢复、重命名、删除 | 中 |
| `package.json` | 启动、依赖和 electron-builder 打包配置 | 中 |

## 3. 启动与状态流

1. `main.js` 启动 Electron 窗口并加载 `index.html`。
2. 主进程启动 Codex app-server，通过 stdin/stdout 交换 JSON-RPC 消息。
3. 主进程维护 `agentState`，包括状态、模型、推理强度和当前项目路径。
4. `preload.js` 将 IPC 调用安全暴露给 renderer。
5. renderer 首次加载时渲染状态、最近项目和历史任务；Agent 状态恢复后再次挂载侧边栏入口，避免启动时序导致入口消失。

## 4. 主要数据流

### 选择项目 / 最近项目

`renderer.js` → `preload.selectProject()` → `main.js` `select-project` → `recent-projects.add()` → `agent-state` → renderer 刷新项目和历史入口。

最近项目保存在用户目录下的 `.deepseek-codex-gui/recent-projects.json`，最多保留 10 个仍存在的项目路径。

### 新建任务与发送消息

`renderer.js` 点击新建任务后调用 `new-task`，主进程清空当前 Thread/Turn 标识；首次发送时 `ensureThread()` 调用 `thread/start` 创建全新 Thread。发送消息时主进程调用 `turn/start`，并将返回的 Thread/Turn 状态通过事件发送回 renderer。

### 恢复历史任务

`thread-history.js` 保存 Thread ID、项目路径、标题和时间；renderer 通过 `get-thread-history` 展示分组列表，点击后调用 `resume-thread`，主进程执行 `thread/resume` 并恢复当前项目和 Thread。

### 附件

1. renderer 选择附件并保存当前附件数组。
2. preload 通过 `set-pending-attachments` 同步状态，发送时通过 `sendMessage(text, attachments)` 一并传递。
3. main.js 校验文件类型、单文件 20 MB 和总计 50 MB。
4. 图片复制到 `C:\Users\\<当前用户>\\.deepseek-codex-attachments` 后使用 app-server 支持的 `localImage` 输入。
5. 普通文件复制到同一纯英文临时目录，并把绝对路径追加到发送给 Codex 的文本中。
6. Turn 完成、发送失败和启动清理会删除对应临时文件。

文件选择、拖拽和 Ctrl+V 粘贴最终都汇入同一个 `selectedAttachments` 数组和 `set-pending-attachments` IPC；有本地路径的拖拽文件由主进程校验，无本地路径的浏览器/截图图片由 `save-pasted-image` 保存，无本地路径的 Excel、PDF、CSV、TXT 等普通文件由 `save-dropped-file` 保存，再按普通附件发送，避免把 Blob 数据或中文原始路径直接交给 Codex。

附件标签在 renderer 中统一展示数量、总大小、文件扩展名和移除操作；图片通过 `get-attachment-preview` 读取受限大小的 Data URL 生成缩略图，普通附件不解析内容，避免预览功能改变实际发送链路。

不得改回“扫描项目目录猜附件”的实现，也不得把中文原始路径直接交给可能受系统编码影响的第三方工具。

### 审批、Diff 和活动卡片

Codex app-server 的请求/通知由 main.js 分流：命令或文件变更审批转为 renderer 卡片；Agent 消息、活动、Turn 状态和 Diff 通过 preload 监听器发送到 renderer。renderer 只负责展示和回传用户决定，不直接操作 app-server。

### Turn 状态显示

renderer 复用现有事件维护顶部状态胶囊：发送后进入 Thinking，收到 `turn/started` 或工具活动进入 Running，收到审批请求进入等待审批，Turn 完成/中断/失败分别显示已完成/已停止/错误。该显示层不改变底层 RPC 和停止逻辑。

计划更新、命令执行、文件修改、Diff、错误和 Turn 生命周期事件同时驱动“当前执行步骤”卡片。卡片只负责汇总当前任务的计划、完成数量和实时操作提示，原有活动卡片仍保留完整命令输出和 Diff 细节。

模型设置面板通过 IPC 读取/保存模型和推理强度；主进程将模型传给 `thread/start`、`thread/resume` 和 `turn/start`，将 Low/Medium/High 映射为 `turn/start.effort`。设置变更不修改历史消息和 Thread 数据。

诊断链路由主进程统一记录 RPC 错误、超时、Codex stderr/退出、Turn 通知错误和发送失败；日志以 JSONL 保存到用户目录并做凭据脱敏。renderer 通过 IPC 读取诊断快照，不直接读取日志文件。

### 停止 Turn

renderer 调用 `interrupt-turn`，main.js 使用当前 Thread/Turn ID 发送 `turn/interrupt`。停止后保留当前 Thread，允许用户继续对话；不要把停止实现成删除历史或重新创建 Thread。

### 失败任务重试

失败后 renderer 在原失败消息旁提供重试入口，重试沿用当前 Thread ID。main.js 为本次文字和附件创建一次安全快照；Turn 成功完成后清理快照，失败时保留给下一次重试，避免附件临时文件已清理导致重试失效。

### 项目级模型设置

全局模型设置保存于 `model-settings.json`；项目覆盖保存于 `project-model-settings.json`，键为规范化后的项目绝对路径。切换项目或恢复历史任务时，主进程先加载项目覆盖，没有覆盖时回退到全局默认，再将当前模型和推理强度用于后续 Thread/Turn。

### Context / Token 使用

main.js 接收 app-server 的 `thread/tokenUsage/updated` 通知，将 `tokenUsage` 放入 `agentState` 并发送给 renderer。renderer 使用 `last.inputTokens / modelContextWindow` 显示本轮上下文百分比，同时展示本轮和 Thread 累计 Token；没有协议数据时不做估算。

### app-server 自动重连

main.js 监听 app-server 的进程退出和初始化失败。连接中断时拒绝挂起 RPC、清理失效审批、逐个标记受影响任务，并使用 1/2/4/8/16/30 秒的指数退避持续重连。重连初始化成功后，Task Runtime 会逐个调用 `thread/resume`；恢复失败的任务保留在运行时和历史记录中并显示错误，下一条消息仍可沿用该任务继续发送。无法确认恢复中的原 Turn 时不会伪造继续执行。应用退出时会取消重连计时器并终止子进程。

### Git 状态

renderer 通过 preload 调用 main.js 的 `get-git-status`。主进程使用 `execFile("git", ...)` 和 `--porcelain=v1 --branch --untracked-files=all` 读取分支、同步状态和文件状态码，不经过 shell，也不执行任何 Git 写操作。非 Git 仓库、Git 未安装或读取失败时返回明确状态并写入诊断日志。

### 主题皮肤

主题由 renderer 通过 CSS 变量、`data-theme` 和 `character-theme` 状态统一控制，包含四套基础配色和 12 套七龙珠高级角色主题。preload 暴露主题读取和保存 IPC，main.js 只接受 `THEME_CATALOG` 白名单中的主题，并把选择保存到用户目录的 `theme-settings.json`。

每个角色主题在目录中保存角色名、英文签名、主题短句、编号、方形缩略图路径和横版主视觉路径。`assets/dragonball-premium/` 保存主题面板与主题坞缩略图，`assets/dragonball-hero/` 保存 12 张 1586×992 水墨横版主视觉。renderer 切换主题时同时更新角色舞台、标题强调色、主题坞、主题预览卡和全局色彩变量；欢迎页快捷卡点击后只负责向输入框填入提示词。主题面板、主题坞和主视觉属于纯显示层，切换不改变 Thread、Turn、附件、审批、Diff、历史任务或 Agent 状态逻辑。

首页固定欢迎标题由 `index.html` 和 `renderer.js` 的新建任务回退模板统一加载 `assets/hero-title-reference-transparent.png`。该图片直接取自用户参考图左侧标题区域，保留原始毛笔字形和飞白，并通过透明通道去除截图背景；因此不依赖目标电脑安装的字体，也不会把参考图中的侧边栏、卡片或输入框烙进页面。`<img>` 容器使用响应式宽度约束，真实页面交互仍由原有 DOM 提供。旧的 `assets/hero-title.svg` 可从备份恢复，但不再参与首页标题渲染。`package.json` 的打包文件规则排除 `backup-*`、`design-qa` 和 `dist`，避免开发备份进入 `app.asar`。

角色主题左上角品牌头像使用 `assets/brand/deepseek-codex-ink-mark.png` 透明 PNG，并由最终角色主题样式覆盖旧的渐变背景。它只属于显示层，不参与主题持久化、项目选择、Thread、Turn 或 Agent 状态；四套基础主题继续保留原有标识。该素材不是 Windows 可执行文件图标。

## 4.1 多 Thread Task Runtime（2026-08-09）

当前运行时不再把活动任务保存在单一的全局 Thread / Turn 变量中。`main.js` 创建一个 `TaskRuntimeManager({ maxConcurrent: 2 })`，内部维护：

```text
Map<threadId, TaskState>
turnId -> threadId
itemId -> threadId
queue[]
```

每个 `TaskState` 独立保存：

- `threadId`、`currentTurnId`、`status`、`projectPath`、时间戳
- 用户消息、Assistant 流式输出和已完成消息
- 命令执行、审批、Diff、错误、Token 使用情况
- 本任务附件临时文件和失败重试附件
- 可供切换任务时重放的事件记录

### 任务启动与队列

renderer 发送消息时携带当前选中的 `threadId`。没有 Thread 时，main 先创建 `thread/start` 并建立 TaskState；随后根据活动任务数量决定直接启动 `turn/start` 或进入队列。第一版最多同时运行 2 个 `starting/running/waitingApproval/stopping` 任务；第三个及以后保持 `queued`，当活动任务结束、停止或失败时由 `drainTaskQueue()` 自动启动。

### 事件路由

main 从 app-server 通知中提取 `threadId`、`turnId`、`itemId`，通过 `TaskRuntimeManager.resolveContext()` 找到目标任务后再向 renderer 发送事件。所有 `agent-delta`、工具活动、审批、Diff、计划、Token、错误和 `turn-state` 事件都携带任务上下文。只有在运行时明确只有一个活动任务时，才允许兼容旧协议的无上下文事件回退；多任务同时运行时不会猜测归属。

### UI 聚焦与后台任务

`focusedThreadId` 只代表当前界面选中的任务，不代表唯一运行任务。renderer 只把选中任务的实时事件绘制到聊天区；后台任务继续由 main 保存状态，历史任务列表显示运行/排队/等待审批/失败标记。点击另一个历史任务不会中断原任务，切回时通过 TaskState 和事件记录恢复当前运行视图。

### Stop、Approval、Diff 和冲突提示

- Stop IPC 必须携带选中任务的 `threadId` / `turnId`，main 只发送对应的 `turn/interrupt`。
- Approval 记录保存 `threadId`、`turnId`、`itemId`，响应时校验上下文，防止一个任务误处理另一个任务的审批。
- Diff、命令活动和文件活动先写入所属 TaskState，再发送给当前选中的 renderer 视图。
- 同一规范化项目路径存在多个活动任务时发送非阻塞 `task-conflict-warning`；目前只提示风险，不自动创建 Git Worktree。

### 连接中断边界

app-server 重连时会逐个 `thread/resume` 已知任务。Thread 上下文恢复成功不等于原 Turn 可以伪造续跑；如果断线时任务正在执行，系统会将该任务明确标记失败并保留已收集的消息/事件，用户可以在同一任务中继续发送。

## 5. 持久化与路径

- 最近项目和历史任务：`os.homedir()/.deepseek-codex-gui/`
- 附件临时目录：`os.homedir()/.deepseek-codex-attachments/`
- Codex 配置目录：当前由 `agentState.codexHome` 指向 `os.homedir()/.codex-deepseek`
- 模型设置：`os.homedir()/.deepseek-codex-gui/model-settings.json`
- 项目模型设置：`os.homedir()/.deepseek-codex-gui/project-model-settings.json`
- 错误日志：`os.homedir()/.deepseek-codex-gui/error-log.jsonl`
- 主题设置：`os.homedir()/.deepseek-codex-gui/theme-settings.json`
- 所有用户路径必须使用运行时用户目录，不得写死当前开发机用户名。
- 文件读写使用 UTF-8；Windows 中文路径不能通过降级为 `???` 处理。

## 6. 当前已知边界

- 最近项目和历史任务的数据文件是 JSON，不是数据库。
- 历史任务列表当前展示最近 20 条。
- 模型与推理强度、项目级默认值已提供 GUI 设置。
- 图片附件预览与批量管理已实现；文件拖拽上传和 Ctrl+V 粘贴图片已经实现。
- 修改源码后必须重新生成打包版本；旧的 `dist` 可执行文件不会自动包含最新源码。

## 7. 维护原则

- 先定位现有链路，再做最小修改。
- 涉及 `main.js`、`preload.js`、`renderer.js` 的跨文件改动必须做 Thread、附件、停止、审批、Diff 和历史侧边栏回归检查。
- 只恢复或补充实际缺失的能力，不重做已经验证成功的功能。
