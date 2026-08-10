# DeepSeek Codex GUI — PROJECT_STATUS.md

最后更新：2026-08-08

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
- 顶部模型 / 连接状态

### 附件
- 输入区已有 `+` 附件按钮
- 可选择多个附件并显示附件标签
- 截至 2026-08-08，附件发送链路经 Codex 修复后，用户已实际验证可以读取上传附件

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

## 7. 下一步优先级

### P0
1. 附件体验完善：拖拽上传、Ctrl+V 粘贴图片、附件类型/大小提示、失败反馈、临时附件清理
2. Agent 运行状态完善：Thinking / Running / Tool / Approval / Error 等更清晰
3. 模型与推理强度设置：GUI 切换模型、Low/Medium/High、项目级默认值

### P1
4. Token / Context 使用情况
5. Thread 导出
6. 项目级设置
7. Git 状态与变更集成
8. 更好的 Diff 浏览
9. 错误日志与诊断页
10. 崩溃恢复

### P2
11. 正式安装包
12. 自定义图标
13. 自动更新
14. 设置迁移
15. 数据备份 / 恢复
16. 性能与内存优化

## 8. 下次 Codex 接手时

1. 阅读 `AGENTS.md`
2. 阅读本文件
3. 阅读 `ROADMAP.md`
4. 检查 `git status`
5. 阅读与当前任务直接相关的源码
6. 不要重新实现已经验证通过的功能
7. 完成任务后更新项目状态
8. 主动给出下一步 1～3 个优先建议
