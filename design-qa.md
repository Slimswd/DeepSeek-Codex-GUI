# Release Notes 网页视觉验收

## Source visual truth

- `C:\Users\JoyJo\AppData\Local\Temp\codex-clipboard-2d3da9cf-58de-4429-954d-bad460dca8e3.png`
- 来源：用户确认的 DeepSeek Codex GUI 龙珠主题参考截图。
- 原始像素：3182 × 992。
- 说明：该截图是客户端主界面参考，不是更新日志网页的逐像素页面稿；本次用于比较深色水墨、悟空主视觉、橙色强调、玻璃卡片、品牌标识和字体气质。

## Rendered implementation

- 页面：`http://127.0.0.1:8765/release-notes.html`
- 文件：`release-notes.html`
- 浏览器渲染截图：`release-notes-qa-1280x720.png`
- CSS 视口：1280 × 720。
- 截图像素：1265 × 712（浏览器内容区实际输出）。
- 密度归一化：未做缩放；源图作为视觉风格参考，页面截图按浏览器实际内容区记录。
- 状态：默认悟空主题、页面顶部、全部版本、全部类别、无搜索关键词。

## Full-view comparison evidence

- 页面顶部使用本地 DeepSeek Codex 品牌印章、深蓝黑背景、橙色强调线和悟空横版主视觉，与参考客户端的核心视觉语言一致。
- Hero 区采用象牙白 / 橙色本地毛笔字体，配合右侧角色画面，延续客户端的武侠水墨与能量色气质。
- 更新日志采用深色玻璃卡片、橙色时间线节点和左侧 Archive 导航，保持客户端的卡片边框、圆角和密度语言，同时为发布页增加阅读层级。
- 与源截图不同的页面结构（更新记录、筛选工具、路线图侧栏）属于发布页所需的信息架构，不是视觉回退。

## Focused region comparison evidence

- Hero / 品牌区：检查了本地品牌图、悟空主视觉、橙色强调色、毛笔字体和卡片边界；未发现 P0/P1/P2 级资产替换或明显断裂。
- 筛选工具区：检查搜索框、类别下拉、版本按钮的层级、对比度和可读性；交互后结果计数正常更新。
- 主题区：检查角色缩略图、当前主题预览和主题切换后的强调色；悟空与贝吉塔切换均正常。

## Primary interactions tested

- 搜索 `Thread`：显示 7 条更新。
- 版本筛选 `2026.08.09`：显示 2 条更新。
- 恢复“全部版本”：恢复完整记录。
- 切换悟空 → 贝吉塔 → 悟空：当前主题、强调色和选中状态正确更新。
- 浏览器控制台 warning / error：无。
- 响应式视口 820 × 900：Hero、导航、统计卡和更新区保持可见且无结构性溢出。

## Required fidelity surfaces

- Fonts and typography：使用项目内 `MaShanZheng-Regular.ttf` 作为标题字体，正文使用稳定系统回退；标题层级、橙色强调和小字号标签均清晰。
- Spacing and layout rhythm：桌面采用侧栏 + 主内容 + 主题侧栏结构；窄屏时侧栏转为顶部导航，主要卡片与统计区保持间距。
- Colors and visual tokens：以深蓝黑、象牙白、橙色和角色主题强调色为主；未使用运行时渐变替代核心资产。
- Image quality and asset fidelity：悟空主视觉、品牌印章、12 个角色缩略图均使用项目现有本地素材，没有用占位形状、Emoji 或自绘替代。
- Copy and content：更新记录覆盖 `CHANGELOG.md` 当前 24 条重要记录，版本日期与项目状态保持一致。

## Findings

- 没有发现可阻塞发布的 P0/P1/P2 问题。
- P3：项目根目录的 HTML 仍依赖相对路径；已通过 `release-notes-web-v1.1.0.zip` 把 HTML、字体、图标 CSS 和主题图片完整打包，跨电脑使用时应发送该压缩包。

## Comparison history

### Pass 1

- Earlier findings：无 P0/P1/P2；初次实现已满足主题方向和页面功能要求。
- Fixes made：无必要修复。
- Post-fix evidence：默认主题 1280 × 720 截图、窄屏 820 × 900 截图，以及搜索 / 版本 / 主题交互结果。

## Implementation checklist

- [x] 页面可直接从项目根目录打开。
- [x] 全量更新记录已整理。
- [x] 搜索、类别、版本筛选已验证。
- [x] 12 套角色主题入口已验证。
- [x] 响应式布局已验证。
- [x] 控制台无 warning / error。
- [x] 已导出包含全部素材的独立离线网页包，并通过本地 HTTP 预览验证资源加载。

final result: passed

## NSIS 高 DPI 资源适配（1.0.3）

### Source visual truth

- 用户问题：另一台电脑上安装界面显示变糊、分辨率变低。
- 参考基线：`design-qa/installer-1.0.3-welcome-circle-fix-final.png`。
- 状态：安装器欢迎页；重点检查侧栏水墨背景、Logo、圆环和顶部进度图。

### Rendered implementation

- 最终安装包：`dist/DeepSeek Codex Setup 1.0.3.exe`
- 欢迎页截图：`design-qa/installer-1.0.3-welcome-hdpi-package-final.png`
- 安装位置页截图：`design-qa/installer-1.0.3-location-hdpi-package-final.png`
- 前后聚焦对比：`design-qa/installer-hdpi-before-after-final.png`
- 实际窗口像素：585 × 501；欢迎页与安装位置页均在同一台 Windows 主机、同一窗口状态下复核。
- 资源像素：侧栏 `492×942`，顶部进度图 `450×171`；均保持原有 `164×314` 与 `150×57` 的显示比例。

### Findings and fix

- [P2] 原安装器使用低分辨率 BMP，Windows 在另一台电脑的 125% / 150% 显示缩放下放大位图，水墨纹理和 Logo 细节容易变糊。
- 修复：所有 NSIS 品牌位图改为 3 倍源尺寸，Logo、光晕、进度节点和细线同步按 3 倍绘制；原生窗口尺寸、字体和布局不变。
- 复核结果：窗口没有被资源尺寸撑大，欢迎页与安装位置页排版保持一致，侧栏纹理和 Logo 边缘清晰度提升。

### Required fidelity surfaces

- 字体与排版：未修改 `Microsoft YaHei UI`、字号、行距和窗口文案。
- 间距与布局：MUI 原生侧栏和顶部进度区域的显示比例保持不变。
- 颜色与视觉令牌：保留黑蓝水墨、橙色笔触、米白 `D` 和现有橙色进度强调。
- 图像质量与资产一致性：继续使用项目现有正式水墨源图，仅提高 NSIS 位图源分辨率。
- 文案与内容：未修改安装说明、路径提示和按钮文案。

### Interaction checks

- [x] 实际双击启动重新打包后的安装器。
- [x] 欢迎页窗口尺寸和高清侧栏显示正常。
- [x] “下一步”进入安装位置页。
- [x] 安装位置页路径输入、浏览、上一步、安装和取消控件完整显示。

final result: passed

## NSIS 侧栏圆形标志修正（1.0.3）

### Source visual truth

- 用户反馈截图：`C:\Users\JoyJo\AppData\Local\Temp\codex-clipboard-a8da7901-062e-444e-a06d-71a9dacab57c.png`
- 状态：安装器欢迎页；红色标注区域指向左侧正式水墨 `D` 圆环。
- 源图像素：544 × 410。

### Rendered implementation

- 最终安装包：`dist/DeepSeek Codex Setup 1.0.3.exe`
- 欢迎页截图：`design-qa/installer-1.0.3-welcome-circle-fix-final.png`
- 安装位置页截图：`design-qa/installer-1.0.3-location-circle-fix-final.png`
- 并排聚焦对比：`design-qa/installer-circle-reference-vs-fix-final.png`
- 安装器窗口像素：585 × 501；CSS / 原生窗口尺寸按实际截图记录；本次没有额外密度缩放，源图与实现图均来自同一台 Windows 主机。
- 欢迎页状态：默认安装欢迎页，未执行安装；聚焦裁剪分别取源图左侧 194 × 410 与实现图侧栏 191 × 410。

### Comparison history

#### Pass 1 — 发现问题

- [P2] 侧栏圆环横向被压窄。
- 证据：原始实际欢迎页截图中，NSIS 将 164 × 314 侧栏位图拉伸到字体缩放后的窗口区域，圆环视觉上呈竖向椭圆。
- 影响：正式品牌标志失真，安装器与客户端品牌资产不一致。

#### Pass 2 — 修正后

- 修复：只对侧栏中的正式 `D` 标志与光晕做横向反向补偿，背景、文字、窗口尺寸和安装流程保持不变。
- 证据：`installer-circle-reference-vs-fix.png` 中右侧实现截图的圆环宽高已恢复到接近 1:1；实际窗口截图显示欢迎页保持完整，下一步进入安装位置页正常。
- 结果：没有剩余 P0/P1/P2 视觉问题。

### Required fidelity surfaces

- 字体与排版：未修改 `Microsoft YaHei UI`、欢迎页文案或行距。
- 间距与布局：未修改侧栏尺寸、内容区边界、导航按钮或安装位置页布局。
- 颜色与视觉令牌：保留黑蓝水墨、橙色笔触、米白 `D` 和现有光晕色彩。
- 图像质量与资产一致性：继续使用项目现有正式水墨 `D` 源图，只修正其在 NSIS 控件中的显示比例。
- 文案与内容：未改变安装提示、Codex CLI 说明或路径提示。

### Interaction checks

- [x] 实际双击启动 1.0.3 安装包。
- [x] 欢迎页圆环视觉复核。
- [x] “下一步”进入安装位置页。
- [x] 安装位置页路径、浏览、上一步、安装和取消控件完整显示。

final result: passed

---

# Windows NSIS 安装器视觉验收（1.0.3）

## Source visual truth

- 选定方向：`design-qa/installer-option-1-reference.png`
- 状态：欢迎页
- 核心视觉：左侧深蓝黑水墨品牌区、橙色笔触、正式 `D` 图标、深色内容区、四步安装旅程、米白文字与橙色强调。

## Rendered implementation

- 最终安装包：`dist/DeepSeek Codex Setup 1.0.3.exe`
- 欢迎页：`design-qa/installer-1.0.3-welcome-final.png`
- 安装位置页：`design-qa/installer-1.0.3-location-final-v3.png`
- 并排对比：`design-qa/installer-reference-vs-implementation.png`
- 实际窗口：585×501 像素，简体中文，Windows NSIS assisted installer。

## Comparison findings

- P0：无。安装器可构建并可实际打开，欢迎页和下一步导航正常。
- P1：无。品牌侧栏、正式图标、深色内容区、中文字体、安装路径输入和文件夹选择入口均完整显示。
- P2：无。未发现裁切、溢出、乱码、遮挡、错误字体或资源缺失。
- 平台差异：标题栏和底部导航按钮保留 Windows 原生样式；这是为键盘操作、系统缩放和安装稳定性保留的有意差异，不影响所选方案的品牌方向。

## Interaction checks

- [x] 实际双击 / 启动最终安装包
- [x] 欢迎页中文文案、品牌图和深色底正常
- [x] “下一步”进入安装位置页
- [x] 安装位置页显示默认路径
- [x] 安装位置输入框、浏览按钮、返回、安装、取消按钮完整可见
- [x] 未执行覆盖当前用户正式安装的破坏性验证

## Final assessment

实现保持 NSIS 安装引擎与原有升级链路，视觉上已把所选方案的水墨侧栏、深色界面、橙色强调、四步旅程和品牌图标落地到 Windows 原生安装器。跨电脑完整安装链路仍按路线图单独验收。

final result: passed
