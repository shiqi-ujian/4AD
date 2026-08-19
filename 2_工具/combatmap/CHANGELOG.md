# CHANGELOG

## [v0.4] — 开发中 (Unreleased)

### 新增
- **紧凑分享链接（🔗 分享）**：数据工具栏新增「🔗 分享」按钮 + 分享/导入弹窗。
  - 一键生成包含完整战斗数据（格子/墙壁/标签/区域/线段/图片 token/自定义地形）的分享链接或数据串。
  - 支持「📋 复制链接 / 📋 复制数据串 / 📂 粘贴导入」；纯浏览器内置 CompressionStream/gzip 压缩，无新增依赖。
  - 打开带 `#m=` 参数的分享链接自动导入地图（刷新/扫码后直达战斗图）。
  - 分享弹窗支持 Esc 关闭；新增 `js/share.js` 模块。
- 版本号提升为 v0.4（`COMBATMAP_VERSION`），README/UI 同步展示。

## [v0.3] — 2026-08-19

### 修复
- 修正 `生成空地` / `智能区域` 模板偶数宽度/高度时多生成 1 格的问题；边缘墙与区域边界随之对齐。
- 统一模板生成位置语义：房间/走廊以选中格为起点（左上/锚点），洞窟/空地/区域以选中格为中心；弹窗文案同步说明。
- 修复 `.xlsx` 导出异步链路：`exportMultiSheetXLSX` 返回 Promise，`exportToExcel` 改为 async 并 await，异常可正确降级到 `.xls`。
- 增加 CDN 加载失败检测：`onerror` 标记 SheetJS/JSZip，工具栏显示离线提示，导出降级路径更明确。

### 重构
- 单文件 `combatmap_v0.2.html` 拆分为 `2_工具/combatmap/` 模块化源码目录，与 hexmap 结构保持一致。
- 新增 `build.js` 打包脚本，产物为 `2_工具/combatmap.dist.html`；不允许手改产物。
- 内部统一版本常量 `COMBATMAP_VERSION = 'v0.3'`，替换所有硬编码 v0.2 文案。

### 新增
- 首次建立 `combatmap/CHANGELOG.md`，之后每次改动需要在顶部追加记录。