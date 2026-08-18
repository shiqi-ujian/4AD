# 四战黑 (Four Against Darkness) — 中文资源

《四战黑》（Four Against Darkness）是一款由 Andrea Sfiligoi 设计的纸笔地下城探索游戏中文资源合集。玩家控制一支由四名冒险者组成的队伍，只需要纸、笔和骰子就能进行游戏。

## 项目结构

```
四战黑/
├── 1_翻译/                        # 中文翻译（Markdown）
│   ├── 四战黑_基础规则工具书-自译版.md
│   ├── 四战黑_基础设定-沙盒模式索引_中文翻译.md
│   ├── 1_扩展规则_冒险者公会传说_中文翻译.md
│   ├── 四战黑_官方战役-四战渊lv5-9-自译版.md
│   ├── 四战黑_四战遗弃深渊_琉璃汉化.md
│   └── 四战黑_拓展模块-恋爱与生活_翻译.md
├── 2_工具/                        # 辅助工具
│   ├── hexmap.dist.html           # 六角格沙盒地图（发布版，由 build.js 打包）
│   ├── hexmap/                    # 六角格沙盒地图（模块化源码，测试用 index.html）
│   │   ├── index.html
│   │   ├── build.js
│   │   └── js/                    # config / core / render / generate / ai / …
│   ├── citymap.html               # 城市地图工具
│   ├── squaremap.html             # 方格地图工具
│   ├── brace_check.js             # JS 大括号平衡检查
│   ├── README.md                 # 工具说明文档
│   ├── _build_glossary.py         # 术语表构建脚本
│   ├── download_pymupdf.py
│   └── extract_pdf.py             # PDF 提取脚本
├── 3_术语与数据/                  # 术语对照表与结构化数据
│   ├── _术语对照表.md / .json
│   ├── _original_en.{json,txt}
│   ├── _self_translated.{json,txt}
│   ├── _tag_pdf.json / _tag_raw.txt
│   ├── _pdf_content.json / _pdf_raw.txt
│   └── _catalog.json
├── room_annotator.html            # 房间标注工具
├── CLAUDE.md                      # AI 辅助开发指南
├── README.md
└── 专家级神术私设 v0.2.docx       # 神术规则文档
```

## 地图工具

> **通用 TRPG 工具**：`2_工具/` 里的几个地图工具已从「四战黑专属」转向**通用跑团地图工具**，不限于任何特定规则或世界观。虽由四战黑项目孕育而生，但界面、地形、王国/定居点命名等都采用中性的奇幻题材通用内容，可服务于 DM 主持任何系统的冒险。工具相关文档请看 [`2_工具/README.md`](2_工具/README.md)。

### hexmap — 六角格沙盒地图（通用跑团地图，**当前唯一开发目标**）

**从这里开始**：本项目地图工具的**所有后续开发只围绕 [`2_工具/hexmap/`](2_工具/hexmap/) 模块化源码**（测试入口 [`index.html`](2_工具/hexmap/index.html)，含 AI 绘图功能）；发布版由 [`build.js`](2_工具/hexmap/build.js) 打包为 [`2_工具/hexmap.dist.html`](2_工具/hexmap.dist.html)。主要特性：

- **无限大地图**：拖拽平移 + 滚轮缩放
- **多种地形**：平原、森林、丘陵、山地、深渊、死灵之地、废墟、神庙、水域、沙漠、沼泽、雪地等
- **定居点系统**：放置带名称和评分的定居点（评分用 d6 骰子随机定）
- **道路系统**：在相邻六角格之间建立连接
- **骰子工具**：内置 d6/d10/d12/d20，支持随机地形生成（d6 查表）和道路探测（3d6 vs 距离）
- **AI 绘图**（模块化版）：AI 辅助生成定居点插画，支持数据持久化（localStorage）
- **探索迷雾（Fog of War）**：用「探索(F)」工具逐步揭示未探索区，适合当面跑团隐藏剧情；迷雾状态随保存/分享一并保留
- **遭遇表**：按选中格地形自动挑遭遇表，d10/d20 随机遭遇，可编辑并持久化，结果可「📌 存入选中格」标注
- **数据持久化**：保存/加载 JSON，导出 PNG 截图
- **无需安装**：浏览器直接打开即可使用

### 其他地图工具（维护/冻结）

> ⚠️ **vanilla**：以下工具目前**不再主动开发**，仅保留为存量。所有新开发集中在 hexmap。若确有需要再动它们，先确认没有已在 hexmap 里实现的功能。

- **[citymap.html](2_工具/citymap.html)** — 城市地图编辑器（冻结）
- **[squaremap.html](2_工具/squaremap.html)** — 方格地图编辑器（冻结）


## 许可

本仓库仅用于个人学习和非商业用途。所有规则文本和扩展内容的版权归原作者 Andrea Sfiligoi 所有。
