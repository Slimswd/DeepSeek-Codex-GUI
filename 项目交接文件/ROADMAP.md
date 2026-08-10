# DeepSeek Codex GUI — ROADMAP.md

这是产品路线图，不是必须一次全部实现的任务清单。

排序原则：**用户价值 > Agent 完整性 > 稳定性 > 开发成本 > 视觉优化**

## Stage A — 核心 Agent 闭环
- [x] Codex app-server 接入
- [x] DeepSeek V4 Flash
- [x] Thread 创建
- [x] Thread 恢复
- [x] 新建独立 Thread
- [x] Turn 中断
- [x] 命令执行
- [x] 审批
- [x] Diff
- [x] 历史任务
- [x] 附件选择
- [x] 附件真实发送与读取

## Stage B — 输入与多模态体验
- [ ] 文件拖拽上传
- [ ] Ctrl+V 粘贴截图 / 图片
- [ ] 附件预览
- [ ] 文件大小 / 类型校验
- [ ] 附件错误反馈
- [ ] 临时附件自动清理
- [ ] 发送前附件状态明确

## Stage C — Agent 状态与控制
- [ ] 更清晰的 Running / Thinking / Tool / Approval / Error 状态
- [ ] 当前执行步骤展示
- [ ] 失败任务重试
- [ ] 命令失败详情
- [ ] 取消与恢复体验
- [ ] 长任务状态反馈

## Stage D — 模型与上下文
- [ ] GUI 模型选择
- [ ] 推理强度 Low / Medium / High
- [ ] 项目级默认模型
- [ ] Context 使用情况
- [ ] Token / 额度可视化（在底层能够可靠提供数据的前提下）
- [ ] 会话上下文管理

## Stage E — 项目 / Git 能力
- [ ] Git 状态
- [ ] 当前修改文件
- [ ] Commit checkpoint
- [ ] Diff 文件导航
- [ ] 回退入口
- [ ] Project settings

## Stage F — 会话与知识管理
- [ ] Thread 导出 Markdown
- [ ] 搜索增强
- [ ] 收藏 / Pin 任务
- [ ] 项目级长期说明
- [ ] 任务摘要
- [ ] 历史任务更多筛选

## Stage G — 稳定性
- [ ] 日志系统
- [ ] Diagnostics 页面
- [ ] app-server 崩溃自动重连
- [ ] GUI 崩溃恢复
- [ ] 未发送输入草稿恢复
- [ ] 状态持久化
- [ ] 性能 / 内存检查

## Stage H — Windows 正式产品化
- [ ] 正式 NSIS 安装包
- [ ] 产品图标
- [ ] 快捷方式设置
- [ ] 自动更新
- [ ] 版本号与更新日志
- [ ] 设置导入导出
- [ ] 用户数据备份恢复

## 每完成一项后

Codex 应：

1. 运行必要检查
2. 说明哪些是自动验证通过
3. 明确哪些仍需要用户 GUI 验证
4. 更新 `PROJECT_STATUS.md`
5. 更新本路线图勾选状态
6. 根据当前状态重新推荐下一项，而不是机械按顺序执行
