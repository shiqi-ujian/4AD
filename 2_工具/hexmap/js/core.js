const HEX_SIZE = 36;
const SQRT3 = Math.sqrt(3);

// Canvas
const container = document.getElementById('canvas-container');
const canvas = document.getElementById('hex-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// Fit view to show all hex content
function fitToContent() {
  const keys = Object.keys(hexData);
  if (keys.length === 0) { showDiceResult('⚠️', '没有数据'); return; }
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const parts = keys[i].split(','); const q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  const tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  const mapW = br.x - tl.x + HEX_SIZE * 2;
  const mapH = br.y - tl.y + HEX_SIZE * 2;
  const pad = 40;
  const sx = (canvas.width - pad * 2) / mapW;
  const sy = (canvas.height - pad * 2) / mapH;
  zoom = Math.max(0.02, Math.min(3, Math.min(sx, sy)));
  viewX = canvas.width / 2 - (tl.x + br.x) / 2 * zoom;
  viewY = canvas.height / 2 - (tl.y + br.y) / 2 * zoom;
  document.getElementById('zoom-indicator').textContent = '🔍 ' + Math.round(zoom * 100) + '%';
  render();
}

let _lastMinimapRender = 0;

// Minimap: draws all hexes at tiny scale with a viewport rect overlay
function renderMinimap(force) {
  const enabled = document.getElementById('chk-minimap').checked;
  if (!enabled) { minimapCanvas.style.display = 'none'; return; }
  if (!force && Date.now() - _lastMinimapRender < 200) return; // throttle to 5fps
  _lastMinimapRender = Date.now();
  const keys = Object.keys(hexData);
  if (keys.length === 0) { minimapCanvas.style.display = 'none'; return; }
  minimapCanvas.style.display = 'block';
  const w = minimapCanvas.width = 180 * (window.devicePixelRatio || 1);
  const h = minimapCanvas.height = 135 * (window.devicePixelRatio || 1);
  const ctxM = minimapCtx;
  ctxM.clearRect(0, 0, w, h);

  // Compute bounding box
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const parts = keys[i].split(','); const q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  const tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  const fullW = br.x - tl.x + HEX_SIZE * 2;
  const fullH = br.y - tl.y + HEX_SIZE * 2;
  const scale = Math.min((w - 8) / fullW, (h - 8) / fullH);
  const offX = (w - fullW * scale) / 2 - tl.x * scale + HEX_SIZE * scale;
  const offY = (h - fullH * scale) / 2 - tl.y * scale + HEX_SIZE * scale;

  // Fill hex cells (sample every Nth hex on very large maps for performance)
  const allTerrains = getAllTerrains();
  const step = keys.length > 50000 ? Math.ceil(keys.length / 40000) : 1;
  for (let i = 0; i < keys.length; i++) {
    if (i % step !== 0) continue;
    const hd = hexData[keys[i]];
    if (!hd || !hd.terrain) continue;
    const parts = keys[i].split(','); const q = +parts[0], r = +parts[1];
    const px = hexToPixel(q, r);
    const cx = offX + px.x * scale, cy = offY + px.y * scale;
    const sz = HEX_SIZE * scale * 0.95;
    const terrainInfo = hd.terrain ? allTerrains[hd.terrain] : null;
    ctxM.fillStyle = terrainInfo ? terrainInfo.color : '#3a3a52';
    ctxM.fillRect(cx - sz, cy - sz * 0.75, sz * 2, sz * 1.5);
  }

  // Draw viewport rect
  const vpLeft = -viewX / zoom, vpTop = -viewY / zoom;
  const vpW = canvas.width / zoom, vpH = canvas.height / zoom;
  ctxM.strokeStyle = '#fff';
  ctxM.lineWidth = 1.5;
  ctxM.strokeRect(offX + vpLeft * scale, offY + vpTop * scale, vpW * scale, vpH * scale);
}

// Minimap click → pan to position
minimapCanvas.addEventListener('click', function(e) {
  const keys = Object.keys(hexData);
  if (keys.length === 0) return;
  const rect = minimapCanvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
  const my = (e.clientY - rect.top) * (window.devicePixelRatio || 1);

  // Compute same bounding box + scale as renderMinimap
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (let i = 0; i < keys.length; i++) {
    const parts = keys[i].split(','); const q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  const tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  const fullW = br.x - tl.x + HEX_SIZE * 2, fullH = br.y - tl.y + HEX_SIZE * 2;
  const w = minimapCanvas.width, h = minimapCanvas.height;
  const scale = Math.min((w - 8) / fullW, (h - 8) / fullH);
  const offX = (w - fullW * scale) / 2 - tl.x * scale + HEX_SIZE * scale;
  const offY = (h - fullH * scale) / 2 - tl.y * scale + HEX_SIZE * scale;

  // Convert click to world coords
  const worldX = (mx - offX) / scale;
  const worldY = (my - offY) / scale;

  // Pan so that clicked point is at center of viewport
  viewX = canvas.width / 2 - worldX * zoom;
  viewY = canvas.height / 2 - worldY * zoom;
  render();
});

// ======== Hex math (odd-r offset, flat-top) ========
function hexToPixel(q, r) {
  const w = HEX_SIZE * 2;
  const h = HEX_SIZE * SQRT3;
  const x = w * 3/4 * q;
  const y = h * (r + 0.5 * (q & 1));
  return { x, y };
}

function pixelToHex(px, py) {
  const size = HEX_SIZE;
  const q = (2/3 * px) / size;
  const r = (-1/3 * px + SQRT3/3 * py) / size;
  return cubeRound(q, r, -q - r);
}

function cubeRound(q, r, s) {
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // convert to odd-r offset
  const col = rq;
  const row = rr + (rq - (rq & 1)) / 2;
  return { q: Math.round(col), r: Math.round(row) };
}

function hexCorners(cx, cy, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i);
    corners.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle)
    });
  }
  return corners;
}

function hexKey(q, r) { return `${q},${r}`; }

function getHex(q, r) {
  const k = hexKey(q, r);
  return hexData[k] || { terrain: null, label: '', settlement: null, roads: [], region: null, annotations: [], rivers: [] };
}

let settlementIndex = []; // [{q, r}] — fast lookup for rankSettlementLocation

// Low-level write without undo tracking. Used by bulk generation functions.
// Returns the merged hex data, or null if the key was deleted (empty).
function writeHexData(key, data) {
  const old = hexData[key];
  const base = { terrain: null, label: '', settlement: null, roads: [], region: null, annotations: [], rivers: [] };
  const merged = { ...(old || base), ...data };
  if (!merged.terrain && !merged.label && !merged.settlement && !merged.region && (!merged.roads || merged.roads.length === 0) && (!merged.annotations || merged.annotations.length === 0) && (!merged.rivers || merged.rivers.length === 0)) {
    delete hexData[key];
    // Update settlementIndex if old had a settlement
    if (old && old.settlement) {
      const [oq, or_] = key.split(',').map(Number);
      settlementIndex = settlementIndex.filter(s => !(s.q === oq && s.r === or_));
    }
    return null;
  } else {
    hexData[key] = merged;
    // Update settlementIndex
    if (old && old.settlement && !merged.settlement) {
      const [oq, or_] = key.split(',').map(Number);
      settlementIndex = settlementIndex.filter(s => !(s.q === oq && s.r === or_));
    } else if ((!old || !old.settlement) && merged.settlement) {
      const [nq, nr] = key.split(',').map(Number);
      if (!settlementIndex.some(s => s.q === nq && s.r === nr)) {
        settlementIndex.push({ q: nq, r: nr });
      }
    }
    return merged;
  }
}

function setHex(q, r, data) {
  const key = hexKey(q, r);
  pushUndo(key);
  writeHexData(key, data);
}

// Remove hexes with no terrain, label, settlement, roads, or annotations
function cleanHexData() {
  for (const key of Object.keys(hexData)) {
    const h = hexData[key];
    if (!h.terrain && !h.label && !h.settlement && !h.region && (!h.roads || h.roads.length === 0) && (!h.annotations || h.annotations.length === 0) && (!h.rivers || h.rivers.length === 0)) {
      delete hexData[key];
    }
  }
}

// ======== 遭遇表 (Encounter Tables) ========
// 按地形一张表，10条d10或20条d20；含'__all__'兜底表。
// GM 可编辑并持久化（localStorage: encounter_tables）。
let currentEncounterTerrain = '__all__'; // 当前面板选中的地形 id 或 '__all__'
let currentEncounterPick = 0;

// 内置默认表（中性奇幻通用内容，非 4AD 专属）
const encounterTables = {
  '__all__': [
    '一群野兽从灌木丛中窜出', '迷路的商队需要指引', '废弃的哨站冒起炊烟',
    '翻倒的货车散落货物', '远处的号角声此起彼伏', '一只独行的神秘旅人',
    '风化的墓碑群沿路延伸', '小群流寇在营地扎寨', '受伤的信使倒伏路旁',
    '一队巡逻卫兵盘查身份'
  ],
  'plain': [
    '野马群在草原狂奔', '游方艺人搭起临时戏台', '两个村落为水源争执',
    '骑士在训练场切磋', '无人看管的稻草人农田', '一群候鸟顺着风向迁徙',
    '落魄的农夫求购食物', '马蹄印直通地平线', '篝火晚会的欢歌', '独行的牧羊人'
  ],
  'forest': [
    '树根下的毒菇群', '破旧的木屋有炊烟', '警觉的鹿群四散奔逃',
    '盗猎者留下的捕兽夹', '迷路的林间小径', '巨大的熊掌印',
    '枝头的猫头鹰叫个不停', '石缝里的银币一闪', '踏青踩到陷阱', '林精的低语'
  ],
  'hill': [
    '山顶的信号狼烟', '滚落的山石堵路', '牧羊人驱赶群羊',
    '废弃的石砌瞭望塔', '野蜂群的窝', '蜿蜒的羊肠小路分岔',
    '山顶的风环着哨声', '猎人背着一头鹿', '雨后的小径泥泞', '山洞深处的回声'
  ],
  'mountain': [
    '山壁滑落的碎石', '山隘的强风', '冒热气的地缝',
    '雪崩后的残迹', '采矿队的棚屋', '悬崖上的猛禽巢',
    '沉重脚步在隧道回荡', '融雪汇成溪', '锈蚀的兵刃', '冻僵的行脚僧'
  ],
  'water': [
    '渔夫的小船在摆渡', '水中的浮标随波', '河岸边的孩童戏水',
    '渡口排起长队', '风掀起浪打湿堤岸', '搁浅的破船骨架',
    '渔船夜间点起的灯', '徒手抓鱼的渔翁', '潺潺溪边的青蛙', '远方地平线的帆影'
  ],
  'desert': [
    '沙丘后的一队骆驼', '干涸水井的围栏', '沙暴前的热浪',
    '金光反射的银币', '独行的商队守卫', '风化岩中的人影',
    '蜥蜴在岩块间窜动', '遥远的绿洲蜃景', '沙地上凌乱的足迹', '半埋的石像'
  ],
  'swamp': [
    '水洼冒出的气泡', '沼泽中的浮草桥', '远方的萤火微光',
    '陷入泥的货车轮', '枯木上的水鸟', '蛇的滑行痕迹',
    '泥潭里的粼粼银光', '萎缩的芦苇床', '湿滑的青苔石径', '隐约的沼泽低语'
  ],
  'snow': [
    '白雾遮住视线', '冰层在脚下呻吟', '风中裹着积雪的微粒',
    '雪丘上的窝棚门', '肩顶的绒羽猎人', '冰湖上的钓叟',
    '雪地里的凌乱兽印', '冻僵的松枝', '北方极光的微光', '篝火旁的一对旅人'
  ],
  'dead_land': [
    '翻开的墓穴旁', '枯骨堆中的戒指', '黑暗中的低语',
    '残塔的顶端吊着灯', '冻僵的人形轮廓', '坟场间游荡的雾气',
    '旧祭坛上的炭痕', '地衣爬满的石碑', '空荡的回廊回声', '仿佛被注视的感觉'
  ],
  'ruins': [
    '裂开的宫殿穹顶', '断壁间插着的火把', '沉睡的石门',
    '幽暗甬道里的水滴', '风穿过残窗的呜鸣', '苔藓覆盖的浮雕',
    '坍塌的拱门下压着箱', '柱廊间的回声', '无人认领的旧盔', '壁画残像流转'
  ],
  'nec': [
    '剥落的漆布从椁', '棺盖微微推开的痕迹', '染血的旧镣铐',
    '地窖里的湿霉', '挂满蛛网的夜灯', '零落的脱臼齿',
    '地面的凹痕', '灰烬中央的戒指', '半开的门后拖影', '寂谬的吊灯'
  ]
};

function currentEncounterTable() {
  const t = currentEncounterTerrain;
  if (t !== '__all__' && encounterCustomTables[t]) return encounterCustomTables[t];
  return encounterCustomTables['__all__'] || encounterTables['__all__'];
}
let _annIdCounter = 0;
function genAnnId() { return 'a' + (++_annIdCounter) + '_' + Date.now().toString(36); }

const ANNOTATION_TYPES = {
  poi:     { name: '地标',  icon: '📍', color: '#ffd700' },
  hazard:  { name: '危险',  icon: '⚠️', color: '#e94560' },
  lore:    { name: '剧情',  icon: '📜', color: '#c9a84c' },
  note:    { name: '备注',  icon: '📝', color: '#888' },
  marker:  { name: '标记',  icon: '🚩', color: '#4a7fb5' }
};

function addAnnotation(q, r, ann) {
  const key = hexKey(q, r);
  pushUndo(key);
  const h = hexData[key];
  if (!h) {
    hexData[key] = { terrain: null, label: '', settlement: null, roads: [], region: null, annotations: [ann] };
    return;
  }
  if (!h.annotations) h.annotations = [];
  h.annotations.push({ id: genAnnId(), type: 'note', visible: false, createdAt: Date.now(), ...ann });
}

function removeAnnotation(q, r, id) {
  const key = hexKey(q, r);
  pushUndo(key);
  const h = hexData[key];
  if (!h || !h.annotations) return;
  h.annotations = h.annotations.filter(a => a.id !== id);
  if (h.annotations.length === 0) { delete h.annotations; }
}

function updateAnnotation(q, r, id, updates) {
  const key = hexKey(q, r);
  pushUndo(key);
  const h = hexData[key];
  if (!h || !h.annotations) return;
  const idx = h.annotations.findIndex(a => a.id === id);
  if (idx === -1) return;
  h.annotations[idx] = { ...h.annotations[idx], ...updates };
}

function getVisibleAnnotationIcons(q, r) {
  const h = hexData[hexKey(q, r)];
  if (!h || !h.annotations) return [];
  return h.annotations.filter(a => a.visible).map(a => ANNOTATION_TYPES[a.type]?.icon || '📍');
}

function hasRoad(q1, r1, q2, r2) {
  return getHex(q1, r1).roads?.some(rr => rr.q === q2 && rr.r === r2) ?? false;
}

function addRoad(q1, r1, q2, r2) {
  const k1 = hexKey(q1, r1);
  const k2 = hexKey(q2, r2);
  if (!hexData[k1]) hexData[k1] = { terrain: null, label: '', settlement: null, roads: [], region: null };
  if (!hexData[k2]) hexData[k2] = { terrain: null, label: '', settlement: null, roads: [], region: null };
  pushUndo(k1);
  pushUndo(k2);
  const h1 = hexData[k1];
  const h2 = hexData[k2];
  if (!h1.roads) h1.roads = [];
  if (!h1.roads.some(r => r.q === q2 && r.r === r2)) h1.roads.push({ q: q2, r: r2 });
  if (!h2.roads) h2.roads = [];
  if (!h2.roads.some(r => r.q === q1 && r.r === r1)) h2.roads.push({ q: q1, r: r1 });
}

function removeRoad(q1, r1, q2, r2) {
  const k1 = hexKey(q1, r1);
  const k2 = hexKey(q2, r2);
  const h1 = getHex(q1, r1);
  if (h1.roads) {
    pushUndo(k1);
    h1.roads = h1.roads.filter(r => !(r.q === q2 && r.r === r2));
  }
  const h2 = getHex(q2, r2);
  if (h2.roads) {
    pushUndo(k2);
    h2.roads = h2.roads.filter(r => !(r.q === q1 && r.r === r1));
  }
}

// ======== Rivers API (edge-based, mirrors roads) ========
// Each hex stores `rivers: [{q, r, width}]` where {q,r} is a neighboring hex
// and width is 1 (溪流) or 2 (河). Stored bidirectionally like roads.

function hasRiver(q1, r1, q2, r2) {
  return getHex(q1, r1).rivers?.some(rr => rr.q === q2 && rr.r === r2) ?? false;
}

function getRiverWidth(q1, r1, q2, r2) {
  const rr = getHex(q1, r1).rivers?.find(r => r.q === q2 && r.r === r2);
  return rr ? (rr.width || 1) : null;
}

function addRiver(q1, r1, q2, r2, width) {
  const w = width || 1;
  const k1 = hexKey(q1, r1);
  const k2 = hexKey(q2, r2);
  if (!hexData[k1]) hexData[k1] = { terrain: null, label: '', settlement: null, roads: [], region: null, annotations: [], rivers: [] };
  if (!hexData[k2]) hexData[k2] = { terrain: null, label: '', settlement: null, roads: [], region: null, annotations: [], rivers: [] };
  pushUndo(k1);
  pushUndo(k2);
  const h1 = hexData[k1];
  const h2 = hexData[k2];
  if (!h1.rivers) h1.rivers = [];
  if (!h1.rivers.some(r => r.q === q2 && r.r === r2)) h1.rivers.push({ q: q2, r: r2, width: w });
  else h1.rivers.find(r => r.q === q2 && r.r === r2).width = w;
  if (!h2.rivers) h2.rivers = [];
  if (!h2.rivers.some(r => r.q === q1 && r.r === r1)) h2.rivers.push({ q: q1, r: r1, width: w });
  else h2.rivers.find(r => r.q === q1 && r.r === r1).width = w;
}

function removeRiver(q1, r1, q2, r2) {
  const k1 = hexKey(q1, r1);
  const k2 = hexKey(q2, r2);
  const h1 = getHex(q1, r1);
  if (h1.rivers && h1.rivers.length) {
    pushUndo(k1);
    h1.rivers = h1.rivers.filter(r => !(r.q === q2 && r.r === r2));
  }
  const h2 = getHex(q2, r2);
  if (h2.rivers && h2.rivers.length) {
    pushUndo(k2);
    h2.rivers = h2.rivers.filter(r => !(r.q === q1 && r.r === r1));
  }
}

// Remove all river edges touching (q,r) — strips this hex from each neighbor's
// rivers, then clears its own. Used by erase to avoid dangling references.
function removeAllRiverEdges(q, r) {
  const h = getHex(q, r);
  if (h.rivers) {
    pushUndo(hexKey(q, r));
    const refs = [...h.rivers];
    h.rivers = [];
    for (const rd of refs) {
      const nh = getHex(rd.q, rd.r);
      if (nh.rivers) {
        pushUndo(hexKey(rd.q, rd.r));
        nh.rivers = nh.rivers.filter(r => !(r.q === q && r.r === r));
      }
    }
  }
}

function neighbors(q, r) {
  const parity = q & 1;
  const dirs = parity ? [
    [1,0],[0,-1],[-1,0],[-1,1],[0,1],[1,1]
  ] : [
    [1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]
  ];
  return dirs.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

// ======== Shared region border rendering (used by render.js and generate.js) ========

// Draw double-layered borders between regions/kingdoms.
//   ctx: canvas 2D context (already transformed to hex coordinate space)
//   hexDataSource(q, r): callback returning hex object { region, ... }
function drawRegionBorders(ctx, qMin, qMax, rMin, rMax, hexDataSource) {
  if (!showRegionLayer) return;
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = hexDataSource(q, r);
      if (!h || !h.region) continue;
      const p = hexToPixel(q, r);
      const corners = hexCorners(p.x, p.y, HEX_SIZE);
      const parity = q & 1;
      const dirs = parity
        ? [[1,0],[0,-1],[-1,0],[-1,1],[0,1],[1,1]]
        : [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        const [dq, dr] = dirs[(6 - i - parity) % 6];
        const nq = q + dq, nr = r + dr;
        const nh = hexDataSource(nq, nr) || { region: null };
        let isWildBorder = false;
        if (!nh.region) {
          isWildBorder = true;
        } else if (nh.region === h.region) {
          continue; // same region, skip
        } else if (h.region >= nh.region) {
          continue; // draw only once per edge (when h.region < nh.region)
        }
        const opacity = regionBorderOpacity;
        const color = regions[h.region].color;

        // Outer glow (wide, low opacity)
        ctx.beginPath();
        ctx.moveTo(corners[i].x, corners[i].y);
        ctx.lineTo(corners[j].x, corners[j].y);
        ctx.strokeStyle = hexToRGBA(color, opacity * 0.25);
        ctx.lineWidth = 6;
        ctx.setLineDash([]);
        ctx.stroke();

        // Main line
        ctx.beginPath();
        ctx.moveTo(corners[i].x, corners[i].y);
        ctx.lineTo(corners[j].x, corners[j].y);
        ctx.strokeStyle = hexToRGBA(color, opacity);
        ctx.lineWidth = 2.5;
        if (isWildBorder) {
          ctx.setLineDash([8, 6]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]); // reset dash after all border drawing
}

// Draw region/kingdom names at the center of each territory (Worldbox style).
//   ctx: canvas 2D context (already transformed to hex coordinate space)
function drawRegionNames(ctx) {
  if (!showRegionLayer || !showRegionNames) return;

  // Collect hex coordinates per region
  const regionHexes = {};
  for (const key of Object.keys(hexData)) {
    const h = hexData[key];
    if (h && h.region && regions[h.region]) {
      if (!regionHexes[h.region]) regionHexes[h.region] = [];
      const [q, r] = key.split(',').map(Number);
      const p = hexToPixel(q, r);
      regionHexes[h.region].push(p);
    }
  }

  // For each region, calculate center and draw label
  for (const [id, points] of Object.entries(regionHexes)) {
    if (points.length === 0) continue;
    const r = regions[id];
    if (!r) continue;

    // Calculate centroid
    let cx = 0, cy = 0;
    for (const pt of points) { cx += pt.x; cy += pt.y; }
    cx /= points.length;
    cy /= points.length;

    const label = `${r.icon} ${r.name}`;
    const fontSize = Math.max(14, Math.min(28, HEX_SIZE * 0.8));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Background pill
    const tw = ctx.measureText(label).width;
    const pad = fontSize * 0.6;
    const bw = tw + pad * 2;
    const bh = fontSize * 1.4;

    // Draw background with rounded rect approximation
    const rx = cx - bw / 2;
    const ry = cy - bh / 2;
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(rx + radius, ry);
    ctx.lineTo(rx + bw - radius, ry);
    ctx.quadraticCurveTo(rx + bw, ry, rx + bw, ry + radius);
    ctx.lineTo(rx + bw, ry + bh - radius);
    ctx.quadraticCurveTo(rx + bw, ry + bh, rx + bw - radius, ry + bh);
    ctx.lineTo(rx + radius, ry + bh);
    ctx.quadraticCurveTo(rx, ry + bh, rx, ry + bh - radius);
    ctx.lineTo(rx, ry + radius);
    ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();

    // Draw text
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, cy);
  }
}
