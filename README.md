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

### hexmap — 六角格沙盒地图

开发**只改 [`2_工具/hexmap/`](2_工具/hexmap/) 模块化源码**（测试入口 [`index.html`](2_工具/hexmap/index.html)，含 AI 绘图功能）；发布版由 [`build.js`](2_工具/hexmap/build.js) 打包为 [`2_工具/hexmap.dist.html`](2_工具/hexmap.dist.html)。主要特性：

- **无限大地图**：拖拽平移 + 滚轮缩放
- **多种地形**：平原、森林、丘陵、山地、深渊、死灵之地、废墟、神庙、水域、沙漠、沼泽、雪地等
- **定居点系统**：放置带名称和评分的定居点（遵循《冒险者公会传说》规则 d6 定评分）
- **道路系统**：在相邻六角格之间建立连接
- **规则集成**：内置 d6/d10/d12/d20 骰子，支持随机地形生成（d6 查表）和道路探测（3d6 vs 距离）
- **AI 绘图**（模块化版）：AI 辅助生成定居点插画，支持数据持久化（localStorage）
- **数据持久化**：保存/加载 JSON，导出 PNG 截图
- **无需安装**：浏览器直接打开即可使用

### 其他地图工具

- **[citymap.html](2_工具/citymap.html)** — 城市地图编辑器
- **[squaremap.html](2_工具/squaremap.html)** — 方格地图编辑器


## 许可

本仓库仅用于个人学习和非商业用途。所有规则文本和扩展内容的版权归原作者 Andrea Sfiligoi 所有。
