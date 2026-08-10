# 自动更新与自动发布

应用使用 GitHub Releases 作为更新源：`Slimswd/DeepSeek-Codex-GUI`。

## 用户更新流程

- 正式安装版会检查 GitHub Releases 的最新版本。
- 用户确认后下载更新，界面显示下载进度。
- 下载完成后可立即重启安装。
- 开发环境不会触发自动更新。

## 自动发布流程

工作流文件：`.github/workflows/release-windows.yml`。

1. 更新 `package.json` 和 `package-lock.json` 中的版本号。
2. 提交并推送代码。
3. 创建并推送同版本标签，例如 `v1.0.8`。
4. GitHub Actions 在 Windows runner 上自动下载固定版本的 Codex CLI。
5. Actions 自动检查 JavaScript、生成 NSIS 安装包，并创建 GitHub Release。
6. Release 自动上传安装包、`latest.yml` 和 `.blockmap`。

标签必须与 `package.json` 版本一致，否则工作流会主动失败，避免发布错误版本。
