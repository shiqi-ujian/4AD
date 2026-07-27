# 四战黑 (Four Against Darkness) — 中文资源

《四战黑》（Four Against Darkness）是一款纸笔地下城探索游戏的中文资源合集。

## 目录结构

```
四战黑/
├── 0_规则书/              # 官方规则书（PDF）
│   ├── 00_四战黑出版物目录.xlsx
│   ├── 0_四战黑_基础规则工具书-自译版.pdf
│   ├── 0_基础_Four Against Darkness.pdf
│   ├── 1_扩展规则_Tales from the Adventurers' Guild.pdf
│   └── 四战黑_基础设定-沙盒模式索引.pdf
├── 1_翻译/                # 中文翻译
│   ├── 1_扩展规则_冒险者公会传说_中文翻译.md
│   └── 四战黑_基础设定-沙盒模式索引_中文翻译.md
├── 2_工具/                # 辅助工具
│   ├── hexmap.html        # 六角格沙盒地图工具
│   ├── _build_glossary.py # 术语表构建脚本
│   ├── download_pymupdf.py
│   ├── extract_pdf.py     # PDF 提取脚本
│   └── pymupdf.whl        # PyMuPDF 离线安装包
├── 3_术语与数据/          # 翻译过程中产生的术语对照和结构化数据
│   ├── _术语对照表.md
│   ├── _术语对照表.json
│   ├── _original_en.{json,txt}
│   ├── _self_translated.{json,txt}
│   ├── _tag_pdf.json / _tag_raw.txt
│   ├── _pdf_content.json / _pdf_raw.txt
│   └── _catalog.json
└── README.md
```

## 六角格地图工具

[`2_工具/hexmap.html`](2_工具/hexmap.html) 是一个开箱即用的交互式六角格地图工具，专为《四战黑》沙盒战役设计：

- **无限大地图**：拖拽平移 + 滚轮缩放
- **12 种地形**：平原、森林、丘陵、山地、深渊、死灵之地、废墟、神庙、水域、沙漠、沼泽、雪地
- **定居点系统**：放置带名称和评分的定居点（遵循《冒险者公会传说》规则 d6 定评分）
- **道路系统**：在相邻六角格之间建立连接
- **规则集成**：内置 d6/d10/d12/d20 骰子，支持随机地形生成（d6 查表）和道路探测（3d6 vs 距离）
- **数据持久化**：保存/加载 JSON，导出 PNG 截图
- **无需安装**：浏览器直接打开即可使用

## 关于四战黑

《四战黑》（Four Against Darkness）是一款由 Andrea Sfiligoi 设计的纸笔地城探险游戏。玩家控制一支由四名冒险者组成的队伍，只需要纸、笔和骰子就能进行游戏。本合集收录了多部扩展的中文翻译和辅助工具。

## 许可

本仓库仅用于个人学习和非商业用途。所有规则文本和扩展内容的版权归原作者所有。