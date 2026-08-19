# 四战黑 项目指南

## 项目结构

- `0_规则书/` — 规则文档
- `1_翻译/` — 翻译文件
- `2_工具/` — 工具文件（如 hexmap.dist.html）
- `3_术语与数据/` — 术语表与数据文件

> **工具定位**：`2_工具/` 里的地图工具已从「四战黑专属」转为**通用 TRPG / 跑团地图工具**，不局限于任何特定规则或世界观——更好奇地，始终用「通用沙盒地图工具」的中性称呼对待它们，不要假设它们只服务四战黑。地形、王国/定居点命名为中性的奇幻通用内容。

> **开发重心**：目前地图工具的**新开发集中在 `2_工具/hexmap/` 与 `2_工具/combatmap/` 两个主力工具**。`squaremap.html` / `citymap.html` 已霜冻（不主动改）。citymap / squaremap 里已具备、但主力工具还没有的能力（如需）应迁移到主力工具，而不是继续在旧工具里加。

> 🔑 **GitHub 自动化能力（重要）**：本环境可通过 `C:\Program Files\Git\mingw64\bin\git-credential-manager.exe get` 读取用户的 GitHub PAT，用 Bearer token 调用 REST API：
> - 创建 PR：`POST /repos/shiqi-ujian/4AD/pulls`（`head` 分支 → `base=main`）
> - 合并 PR：`PUT /repos/shiqi-ujian/4AD/pulls/{number}/merge`（可用 `squash`）
> - 用户网络不稳定时，可以直接替用户完成 PR 创建/合并，不需要手动操作。
> - 注意：token 敏感，不要写入公开文档/输出；调用前先用 Process 给 GCM 喂 `protocol=https\nhost=github.com\n\n` 读取。

## hexmap — 六角格沙盒地图（当前唯一开发目标）

**源码位于 `2_工具/hexmap/`（模块化）**：`index.html`(HTML+CSS) + `js/*.js`（config/state/core/render/interact/ui/generate/stats/init/ai）。Canvas 渲染，无外部依赖。**测试入口 = `2_工具/hexmap/index.html`。**

**发布产物 = `2_工具/hexmap.dist.html`**，由 `2_工具/hexmap/build.js` 打包生成（内联所有 js 模块 + 语法校验）。**绝不手改产物**——只改源码，发布时才跑 `node build.js` 重新生成。

### 文件结构

| 文件 | 作用 |
|-------|-------|
| `hexmap/index.html` | HTML + CSS + script 标签 |
| `hexmap/js/config.js` | 配置（TERRAIN, ELEVATION_RAMP, 生成规则） |
| `hexmap/js/state.js` | 全局状态、撤销、图层开关、region 数据 |
| `hexmap/js/core.js` | 数据 CRUD、邻接、路径、边境绘制 |
| `hexmap/js/render.js` | 主渲染（drawHexBase / drawHexOverlay / drawRivers） |
| `hexmap/js/interact.js` | 鼠标/触摸/滚轮事件 |
| `hexmap/js/ui.js` | 面板、对话框、工具切换 |
| `hexmap/js/generate.js` | 生成 + 一键生成 + 导出 PNG + 部分事件绑定 |
| `hexmap/js/stats.js` | 地图统计面板 |
| `hexmap/js/init.js` | 初始化 |
| `hexmap/js/ai.js` | AI 绘图（自然语言描述 → 地图） |
| `hexmap/build.js` | 打包脚本（生成 hexmap.dist.html） |

| Lines | Section |
|-------|---------|
| 1-289 | HTML + CSS |
| 290-291 | `<script>` 开始 |
| 292-390 | 配置（TERRAIN, 自定义地形, 撤销系统） |
| 392-540 | 工具函数（坐标转换、几何计算、图片缓存） |
| 542-930 | 核心逻辑（CRUD、邻接、路径、渲染） |
| 931-1160 | 事件绑定（鼠标/触摸/滚轮） |
| 1162-1250 | `handleHexClick` — 主交互逻辑 |
| 1253-1450 | 菜单/对话框 |
| 1453-1690 | 工具切换、地形编辑器 |
| 1690-1810 | 生成规则编辑 |
| 1810-1910 | 对话框事件绑定 |
| 1910-2110 | 骰子动画、地形/定居点/道路生成 |
| 2110-2170 | 保存/加载（JSON） |
| 2170-2320 | 导出 PNG |
| 2320-2380 | 清空、开关、信息面板、初始化 |

### 常见问题：大括号不匹配

**现象**：右侧地图空白，不显示六边形。浏览器控制台报 SyntaxError。

**原因**：编辑时添加/删除了 `{}` 导致 JS 大括号不平衡。JS 解析失败 → 所有代码不执行 → Canvas 没有任何绘制。

#### 诊断

```bash
node -e "
const fs = require('fs');
let html = fs.readFileSync('2_工具/hexmap.dist.html', 'utf8');
let lines = html.split('\n');
// 找到 JS 起始行
let s = lines.findIndex(l => l.trim().startsWith('<script') && !l.trim().startsWith('</script'));
console.log('Script starts at HTML line:', s + 1);
let bc = 0, lastZero = -1, inStr=false, ch=null, inBC=false;
for (let i = s; i < lines.length; i++) {
  let line = lines[i], j = 0;
  while (j < line.length) {
    let c = line[j], n = line[j+1]||'';
    if (inBC) { if (c==='*'&&n==='/') { inBC=false; j+=2; } else j++; continue; }
    if (!inStr && c==='/'&&n==='*') { inBC=true; j+=2; continue; }
    if (!inStr && c==='/'&&n==='/') break;
    if (inStr) { if (c==='\\\\') j+=2; else if (c===ch) inStr=false; j++; continue; }
    if (c==='\"'||c===\"'\"||c==='\`') { inStr=true; ch=c; j++; continue; }
    if (c==='{') bc++; if (c==='}') bc--;
    j++;
  }
  if (bc === 0) lastZero = i;
}
console.log('Brace count:', bc, '| Last zero at HTML line:', lastZero + 1);
// 如果有不匹配，找到最后一个不归零的位置之后的所有 '{'
"
```

或者直接运行 `node 2_工具/brace_check.js`（见下）。

#### 常见不匹配位置

1. **导出 PNG 回调**（`btn-export-img` 的 click handler，在 `js/generate.js`）：内部有多个 for 循环 + `if(h.settlement)`，容易少一个 `}`。症状：brace count = 1。
2. **`handleHexClick`**（在 `js/interact.js`）：函数很大，包含 paint/erase/road 多个分支，结尾容易少 `}`。
3. **渲染循环**（render → drawHexOverlay，在 `js/render.js`）：多层嵌套，增删代码时容易破坏平衡。

#### 修复步骤

1. 运行 `brace_check.js` 确认 brace count
2. 如果 count ≠ 0，查看最后归零的行（lastZero）之后的所有新增/修改的代码段
3. 检查每个 `{` 是否有对应的 `}`
4. 修复后重新运行 brace_check 确认 count = 0
5. 刷新浏览器验证

### 关键约定

- **每次实质改动后，在 `2_工具/hexmap/CHANGELOG.md` 顶格追加入口**（倒序，最新在上），与源码一并提交
- 改 hex 只动 `2_工具/hexmap/` 源码（index.html + js/*.js），**绝不手改 `hexmap.dist.html` 产物**；要发布才在 `hexmap/` 下跑 `node build.js`
- 改 JS 后跑 `node --check` 或用 build 的 `new Function` 校验语法（build.js 已内置）
- 撤销系统：`beginBatch()` / `endBatch()` 包裹批量操作，不可嵌套
- 六角格坐标：odd-r flat-top 系统，`neighbors()` 函数分 even/odd 列
- 图层开关变量在 `js/state.js`（showTerrainLayer/showRegionLayer/showElevationLayer/showGrid…）
- 导出 PNG 有三段式渲染：fill pass → road pass → overlay pass