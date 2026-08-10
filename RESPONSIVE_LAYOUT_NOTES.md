# 响应式布局修复记录

## 2026-08-08：紧凑窗口聊天框遮挡首页内容

- 根因：角色主题首页在窗口高度较小时，Hero、功能卡与较高聊天框的总高度没有同步压缩，第二排卡片被 `.chat` 边界截断，视觉上像被聊天框覆盖。
- 修复文件：`renderer.js`。
- 修复内容：欢迎页聊天区域保持可滚动；`max-height: 820px` 下压缩标题、说明文字、功能卡和纵向间距，让输入框与主题选择区拥有稳定空间。
- 保留：聊天、附件、Thread、审批、Diff、停止任务和主题切换逻辑均未改动。
- 备份：`backup-responsive-composer-before-20260808-135344`。
- 验证：`node --check main.js`、`node --check preload.js`、`node --check renderer.js` 通过；`npm run dist` 成功；最新 unpacked EXE 已启动。

