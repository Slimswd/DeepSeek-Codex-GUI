# DeepSeek Codex GUI — DEVELOPMENT_RULES.md

## 1. 变更前

1. 先阅读 `AGENTS.md`、`PROJECT_STATUS.md`、`ROADMAP.md` 和与任务直接相关的源码。
2. 先说明将修改的文件、原因、影响范围和回滚方式。
3. 涉及已有稳定功能时，先创建带时间戳的备份。
4. 超过 3 个源码文件，必须先做影响分析，不得直接大规模重构。
5. 优先修复现有实现，不要因为代码风格或目录结构进行无关重写。

## 2. 变更中

- 保持当前 Electron、preload context isolation 和 IPC 边界。
- 不改变已经验证的 Thread / Turn RPC 数据结构，除非先确认底层协议和完整调用链。
- 不把附件重新交给项目目录扫描；普通附件必须进入安全临时目录并把真实路径明确提供给 Codex。
- Windows 路径使用 Node 的 `path`、`os.homedir()` 和 UTF-8 文件读写；不得硬编码 `C:\Users\\JoyJo`。
- 不删除或隐藏最近项目、历史任务、搜索、重命名、删除和模型状态区域的入口。
- 任何 UI 恢复都必须同时检查 DOM 生成、事件绑定和 CSS 可见性/滚动边界。

## 2.1 多任务架构变更规则

- 不得通过新增 `currentThreadId2`、`currentTurnId2` 或其他编号变量扩展并发；必须使用可扩展的 `TaskRuntimeManager` 和 `Map<threadId, TaskState>`。
- 新增或修改 app-server 事件时，必须确认 `threadId`、`turnId`、`itemId` 的归属，并确保 renderer 不会把后台任务事件绘制到当前选中任务。
- Stop、Approval、Diff、命令活动、文件活动、Token 和附件临时文件必须按任务隔离。
- 并发上限、队列状态和任务状态变化必须可从任务列表观察；超过上限的任务不得静默丢弃。
- 同一项目并行任务目前只做风险提示；涉及自动隔离工作区时，必须单独设计 Git Worktree 方案，不得隐式改写用户项目。
- app-server 断线恢复只能恢复协议明确支持的 Thread 上下文，不得把未确认恢复的原 Turn 标记成继续执行。

## 3. 变更后自动检查

修改 JavaScript 后运行：

```powershell
node --check main.js
node --check preload.js
node --check renderer.js
```

涉及启动时运行：

```powershell
npm start
```

修改源码并需要测试打包程序时运行：

```powershell
npm run dist
```

检查失败时必须读取错误、修复并重新检查，不能把错误留给用户处理。

## 4. 必做回归范围

根据变更范围选择回归，但涉及核心链路时至少确认：

- 新建任务确实创建新 Thread
- 历史任务可恢复、搜索、重命名、删除
- 最近项目可打开和移除
- Enter/Shift+Enter 和中文输入法行为不回退
- 附件仍能真实传给 Codex 并读取
- 审批、Diff、活动卡片正常
- Stop Turn 后同一 Thread 可继续
- sidebar 历史区域独立滚动，底部模型状态区不被挤出
- 关闭并重新启动时使用的是最新源码/最新打包版本

## 5. 文档维护

每完成一个明确功能或修复：

1. 更新 `PROJECT_STATUS.md` 的已完成、当前状态、已知问题和变更记录。
2. 更新 `ROADMAP.md` 的勾选状态和下一步优先级。
3. 对架构边界有长期影响的改动同步到 `ARCHITECTURE.md`。
4. 将重要用户可见变化写入 `CHANGELOG.md`。

## 6. 模型选择原则

- 文档整理、单文件小修、局部 UI：中等推理强度即可。
- 跨文件功能、回归修复、打包和安装迁移：使用高推理强度。
- 模型不是稳定性的替代品；无论使用什么模型，都必须遵守先检查、备份、最小修改和自动验证。

## 7. 交付格式

完成后必须说明：

- 修改了哪些文件
- 解决了什么问题
- 自动检查结果
- 哪些仍需要人工 GUI 验证
- 当前最值得做的下一步及原因
