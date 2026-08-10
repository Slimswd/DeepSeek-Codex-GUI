# 自动更新说明

应用使用 GitHub Releases 作为更新源。

- 发布配置：`Slimswd/DeepSeek-Codex-GUI`
- 打包会生成安装包、`latest.yml` 和 blockmap 文件。
- 已安装的正式版本启动后会检查新版本。
- 用户确认后下载更新，下载完成后可立即重启安装。
- 开发环境不会触发更新检查。

发布新版本时，需要把同一版本的安装包、`latest.yml` 和 `.blockmap` 一起上传到 GitHub Release。
