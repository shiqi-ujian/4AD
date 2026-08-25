# combatmap 竞品调研报告

> 本文档调研市面主流跑团在线地图工具（枭熊 Owlbear Rodeo、FVTT Foundry VTT，顺带 Roll20 作对照），
> 对照 combatmap v0.84 现状，识别差距并按「一期一期」排期给出改进路线图。
> 本文档为**研究/规划文档**，不替代 `CHANGELOG.md`（记录已落地改动）。
>
> 撰写：2026-XX-XX　基线版本：`COMBATMAP_VERSION = 'v0.84'`

---

## 0. 调研目的与范围

- **目的**：明确 combatmap 相对主流工具的能力差距，找出对「跑团地图体验」影响最大的短板，给出可分期落地的路线。
- **范围**：聚焦**地图 / 场景 / 战雾 / 视线 / token / 协作**这些地图桌核心维度；角色卡、规则系统、骰子自动化等「非地图」能力仅作为定位讨论，不作为本阶段目标。
- **前提约束**：combatmap 是**单文件、零后端、PeerJS P2P、浏览器内压缩分享**的轻量地图桌。因此路线对齐「轻量地图桌」（枭熊路线），不硬扛 FVTT 的一站式全功能。

---

## 1. 参考工具概览

### 1.1 枭熊 Owlbear Rodeo —「极简地图桌」

- **定位**：浏览器即开即用，主打轻量、免费。核心只做「地图 + token」，角色卡/规则交给外部工具（如 DnD Beyond）。
- **核心能力**：
  - 网格地图、**测量工具**（距离自动算）
  - token 管理与 **Fog of War**
  - **Attachments**：把手绘 / 图片 / Handout 贴在场景上
  - **先攻条**、基础 dice
  - **扩展（Extensions）插件生态**：付费/免费插件可加装功能
- **战雾是迭代重点（最值得借鉴）**：
  - 早期：手动逐格战雾（与 combatmap 现状相同）
  - 官方 **Dynamic Fog 扩展**：把战雾从「手动抹」升级为「**基于 token 视线自动揭示**」——token 有视野半径，墙体/物体遮挡，DM 设定灯光，玩家看到的就是 token 视角所见
  - 2.3 加入 **Realtime Dynamic Fog**（实时动态雾）
- **优点**：上手零门槛、免费、纯地图桌、不绑架规则系统。
- **缺点**：无角色卡 / 无规则自动化、在线协作简单、复杂光照/效果要靠插件，深度有限。

参考：
- [Owlbear Rodeo Guide](https://groupfinder.gg/library/owlbear-rodeo)
- [New Player's Guide](https://startplaying.games/blog/virtual-table-tops/the-new-players-guide-to-owlbear-rodeo)
- [Dynamic Fog 扩展](https://extensions.owlbear.rodeo/dynamic-fog) · [Dynamic Fog 文档](https://docs.owlbear.rodeo/extensions/reference/dynamic-fog/)
- [2.3 Realtime Dynamic Fog](https://blog.owlbear.rodeo/owlbear-rodeo-2-3-release-week-day-3/) · [2.0 Dev Log 3](https://blog.owlbear.rodeo/owlbear-rodeo-2-0-dev-log-3/)
- 中文指南 [油盐板·枭熊 2.0 简明指南](https://www.yystv.cn/n/994175)

### 1.2 FVTT (Foundry VTT) —「一站式全功能 VTT」

- **定位**：买断 + 自托管（或云托管），全功能桌，靠模块生态扩展。
- **核心能力（地图/场景向）**：
  - **场景（Scene）管理**：一个战役多张地图，切换 / 光照 / 天气初始化
  - **格子系统**：多种网格类型、格线颜色/坐标定位
  - **token 视野/光照**：每个 token 配 `sight`（dim / bright / darkvision）与 `light` 发光半径/颜色，光源可叠加
  - **墙体（Walls）**：真正**阻挡视线 / 移动 / 声音**，分普通墙 / 门 / 窗 / 地形，支持高度、动画
  - **动态光照 + 探索雾**：基于 token 视野**自动揭示**（explored / unexplored / visible），配合光照、黑暗、颜色
  - **tiles / 动画 / 环境音 / 天气**：地图动画、火把光、下雨下雪、环境音效
  - **角色卡 + 自动骰子 + 聊天 + 战斗追踪**：系统化（如 DnD 5e）的 actor sheet、攻击/伤势/状态效果自动化、combat tracker
  - **模块生态**：数千个 module（macro、脚本、增强视觉如 [Perfect Vision](https://github.com/dev7355608/perfect-vision) 等）
- **优点**：功能天花板最高、深度最足、生态最全。
- **缺点**：学习曲线陡、需自托管、**性能对低配机 / 大量光源敏感**、DM 配置成本高。

参考：
- [Walls](https://foundryvtt.com/article/walls/) · [Foundry Wiki·Walls](https://foundryvtt.wiki/en/basics/Walls)
- [Lighting System](https://deepwiki.com/foundryvtt/foundryvtt/3.3-lighting-system) · [Tokens and Actors](https://deepwiki.com/foundryvtt/foundryvtt/3.2-tokens-and-actors) · [Walls and Tiles](https://deepwiki.com/foundryvtt/foundryvtt/3.4-walls-and-tiles) · [Core Game Environment](https://deepwiki.com/foundryvtt/foundryvtt/3-core-game-environment)
- [官方 features.csv](https://gitlab.com/foundrynet/foundryvtt/-/blob/a55353e3c09cb66b7197a57e561e2e461a1ed6f2/_static/features.csv)

### 1.3 Roll20（对照，不展开）

老牌 Web VTT，功能介于两者之间：有动态光照/视野与角色卡，但界面偏重、免费档限制多。作为「功能丰富但体验偏重」的对照锚点。

---

## 2. combatmap v0.84 现状（基准）

| 已有能力 | 实现方式 |
|---|---|
| 地形格 | 30+ 地形（wall_cell / difficult / cover_* / hazard_* / door 等），手绘质感 |
| 单位 token | HP / AC / 速度 / 临时 HP / 状态 / 头像；多选 / 复制 / 编组 / 单位库 |
| 战雾 | ⚠️ **逐格手动涂抹** `fog = {"q,r":1}`，DM 拖拽遮/揭 |
| 墙体 | ⚠️ 只是地形 / 视觉，**不参与视线计算** |
| DM 隐藏层 | 逐格隐藏标记 / 说明，仅 DM 本地可见 |
| 行动顺序 | 先攻条 + HP 双向联动 |
| 在线房间 | PeerJS P2P **全量快照同步** + 角色过滤（DM 层 / 战雾 / 先攻不下发玩家） |
| 导入底图 / 网格对齐 | ⚠️ **v0.83 临时禁用** |
| 导出 | PNG / XLSX / JSON / gzip 分享链接 |

**一句话现状**：基础（token、地形、先攻、P2P、分享）已经成型，是一个「**轻量地图桌雏形**」；但**战雾是全局手工抹，没有任何基于单位视野的自动揭示**——这是与枭熊 / FVTT 差距最大、对跑团体验影响最大的一点。

---

## 3. 关键差距对比矩阵

| 维度 | 枭熊 | FVTT | combatmap v0.84 | 优先级 |
|---|---|---|---|---|
| 战雾机制 | 手动 + Dynamic Fog 自动 | token 视野自动揭示 | ⚠️ **仅手动逐格** | **P0** |
| 视野 / 视线遮挡（LOS） | 插件支持 | walls 挡视 / 挡声 / 挡移动 | ❌ 无，墙仅挡移动 | **P0** |
| 单位视野半径 / 暗视 / 发光 | 插件 | sight / light 全套 | ❌ 无 | P0 |
| 测量工具（ruler） | ✅ | ✅ | ❌ 无 | **P1** |
| 导入底图 + 网格对齐 | ✅ | ✅ | ⚠️ **v0.83 临时禁用** | **P1（先修）** |
| 场景 / 多地图管理 | scene | scene 列表 | ❌ 无 | P1 |
| 玩家独立视角 | 玩家各自 token 视角 | 每玩家看自己 token | ⚠️ 仅 DM / 玩家单视图 | P1 |
| 效果 / 动画 / 音效 / 天气 | 部分插件 | 全套 | ❌ 无 | P2 |
| 角色卡 / 规则 / 骰子自动化 | 无（外接） | 系统化 | ❌ 无 | 视定位（可能超范围） |

---

## 4. 分阶段路线图（一期一期来）

> 原则：对齐「轻量地图桌」（枭熊），优先补齐**地图桌体验及格线**，不朝 FVTT 的规则/角色卡方向堆。
> 每期是「可独立上线」的小步，落地后同步更新 `CHANGELOG.md` 与 `COMBATMAP_VERSION`。

### 第一期 **P0 · 单位视野驱动的自动战雾 + 墙体遮挡 LOS**

这是从「画图工具」跨到「跑团桌」的**决定性一步**，收益最大。

- 给 token 加 `sightRadius`（视野半径），映射到网格：
  - **可见性 = 距 token ⩽ 视野半径 且 未被墙体遮挡**（视线射线 / 网格 Bresenham + 墙体阻挡）
  - 玩家端只渲染「玩家侧 token 可见」的格子，DM 端渲染全图；实现枭熊 Dynamic Fog 的「基于 token 视线自动揭示」
- 复用现有 `wall_cell` / `cover_full` 作为**视线遮挡物**（现在只挡移动），不必新造墙类型
- 落地后：手动逐格战雾保留为「DM 后备/覆写」，作为自动战雾之上的细调手段

### 第二期 **P1 · 修复并恢复「导入底图 + 网格对齐」**

底图是地图桌的**核心输入**（玩家上传图），枭熊 / FVTT 都以此为基础；v0.83 禁用等于砍掉半条命。

- 优先修复网格对齐 bug（参考 v0.8 重写的坐标换算经验），评估后恢复功能
- 恢复后让底图 + 对齐结果参与战雾 / 导出 / 分享链路

### 第三期 **P1 · 测量工具**

- 拖拽画线段自动显示格 / 英尺距离；困难地形额外消耗；射程 / 移动一次说完
- 与「单位移动」「范围法术模板」可复用底层测距

### 第四期 **P1 · 场景 / 多地图管理**

- 一个战役多张地图切换，每张地图独立战雾 / 光照 / 地形
- save/load 已是 JSON，顺势扩展成 scene 列表

### 第五期 **P1 · 玩家独立视角**

- 当前是「DM/玩家单视图 + 角色约定」；受限于纯 P2P，先做「DM 指定玩家可见 token → 按这些 token 的视野合成玩家视图」
- 真正 per-player 身份签发需服务端，超出当前零后端范围，留待后续

### 第六期 **P2 · 效果 / 动画 / 音效（可选、锦上添花）**

- 火把光闪烁、法术模版、环境音；单文件内用 Canvas 动画做轻量版即可

---

## 5. 技术可行性评估（针对「单文件、零后端、P2P」）

| 项目 | 可行性 | 关键点 |
|---|---|---|
| 逐格视线遮挡（LOS） | ✅ 高 | 网格 Bresenham / 射线 + 格子 `wall_cell` / `cover_full` 判定，单文件可做，成本低 |
| 单位视野半径 | ✅ 高 | 给 token 加 `sightRadius` 字段，随 JSON / 分享 / 在线同步携带 |
| 自动战雾（基于 token） | ✅ 中高 | 需要「玩家侧 token 集」概念；纯 P2P 下用「DM 指定的玩家 token」作为玩家视野代理 |
| 探索状态（explored/visible） | 🟡 中 | 需区分「曾探索」与「当前可见」两态，数据结构从 `fog` 升级，注意与在线/分享/撤销兼容 |
| 掩体 / 光线叠加 | 🟡 中 | 多光源叠加、暗视、dim/bright 分档，复杂度上升，建议放在自动战雾稳定后再做 |
| 底图网格对齐 | 🟡 中 | 坐标换算已知坑（工具格/画布像素/图像像素），v0.8 已有重做经验，需回归验证 |
| 性能 | ✅ | 格子数中等时逐格射线可接受；注意在线/撤销快照体积 |

---

## 6. 结论

1. combatmap 已定位为「轻量地图桌」，**不应**朝 FVTT 的规则 / 角色卡方向硬堆。
2. **最大且优先的短板 = 没有基于单位视野的自动战雾 / 视线遮挡**。这是枭熊「Dynamic Fog」价值和跑团体验的核心，也是本报告的 P0。
3. 其次是恢复底图导入（P1）、测量（P1）、场景管理（P1）、玩家独立视角（P1）。
4. 推荐的落地顺序：**P0 自动战雾 → P1 底图恢复 → P1 测量 → P1 场景 → P1 独立视角 → P2 效果**。

> 本报告为研究与规划文档，不承诺具体时间点；每期落地后在 `CHANGELOG.md` 追加记录。
