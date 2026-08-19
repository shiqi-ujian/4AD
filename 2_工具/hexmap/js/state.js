// ======== 探索迷雾 (Fog of War) ========
// isFog: 迷雾图层主开关；explored: 已揭示六角格 key 集合（"q,r"）
// 未在 explored 中的格子在 isFog 开启时被深色雾覆盖，随探索逐步揭示。
let isFog = false;
let explored = new Set();

function hexIsFogged(q, r) {
  return isFog && !explored.has(hexKey(q, r));
}
function revealHex(q, r) { if (explored.add(hexKey(q, r))) dirtyFog = true; }
function concealfog(q, r) { explored.delete(hexKey(q, r)); dirtyFog = true; }
function revealAll() {
  explored = new Set(Object.keys(hexData));
  dirtyFog = true;
}
function concealfogAll() { explored.clear(); dirtyFog = true; }
// 供导出：序列化迷雾状态
function exportFogData() { return { fog: isFog, explored: [...explored] }; }
// 供导入：应用迷雾状态（缺失字段则保持默认）
function importFogData(d) {
  if (!d) return;
  if (typeof d.fog === 'boolean') isFog = d.fog;
  if (Array.isArray(d.explored)) explored = new Set(d.explored);
  dirtyFog = true;
}
let dirtyFog = false;

// ======== State ========
let hexData = {}; // key: "q,r" -> { terrain, label, settlement, road, color }
let selectedTool = 'select';
let selectedTerrain = 'plain';
let selectedHex = null; // { q, r }
let isLocked = false;
let viewX = 0, viewY = 0;
let zoom = 1;
let isDragging = false, dragStartX, dragStartY, viewStartX, viewStartY;

// Undo/Redo
const MAX_UNDO = 50;
let undoStack = [];
let redoStack = [];
let undoBatch = null;

function snapshotHex(key) {
  return hexData[key] ? JSON.parse(JSON.stringify(hexData[key])) : null;
}

function updateUndoButtons() {
  const btnU = document.getElementById('btn-undo');
  const btnR = document.getElementById('btn-redo');
  if (btnU) { btnU.disabled = undoStack.length === 0; btnU.style.opacity = undoStack.length === 0 ? '0.4' : '1'; }
  if (btnR) { btnR.disabled = redoStack.length === 0; btnR.style.opacity = redoStack.length === 0 ? '0.4' : '1'; }
}

function pushUndo(key) {
  const entry = { key, before: snapshotHex(key) };
  if (undoBatch !== null) {
    undoBatch.push(entry);
  } else {
    undoStack.push([entry]); // wrapped in array for uniform batch handling
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
}

function beginBatch() { undoBatch = []; }

function endBatch() {
  if (undoBatch && undoBatch.length) {
    // Merge consecutive entries for the same key into one (last write wins)
    const latest = new Map();
    for (const e of undoBatch) {
      latest.set(e.key, e);
    }
    const merged = [...latest.values()];
    undoStack.push(merged);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }
  undoBatch = null;
  updateUndoButtons();
}

function applyUndoEntry(entries) {
  const redoEntries = [];
  for (const { key, before } of entries) {
    redoEntries.push({ key, before: snapshotHex(key) });
    if (before) {
      hexData[key] = before;
    } else {
      delete hexData[key];
    }
  }
  return redoEntries;
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  const redoEntries = applyUndoEntry(entry);
  redoStack.push(redoEntries);
  render();
  updateInfo();
  updateUndoButtons();
}

function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  const undoEntries = applyUndoEntry(entry);
  undoStack.push(undoEntries);
  render();
  updateInfo();
  updateUndoButtons();
}
let showGrid = true, showCoords = true;
let showTerrainLayer = true; // 地形图层可见性开关
let showRegionLayer = true; // 王国图层可见性开关
let regionBorderOpacity = 0.85; // 王国边境不透明度 (0~1)
let showRegionNames = true;     // 是否显示王国名称（领土中心浮动标签）
let showElevationLayer = false; // 海拔图层可见性开关（默认关，旧图观感不变）
let iconStyle = 'vector';       // 图标风格：'vector'（手绘矢量）| 'emoji'（原始系统 emoji）

// 王国边境配置 (一个六角格 = 一天路程)
const DEFAULT_REGIONS = {
  north:  { name: '北境王国', color: '#4a7fb5', icon: '❄️' },
  south:  { name: '南境王国', color: '#b58a4a', icon: '🏜️' },
  east:   { name: '东境王国', color: '#6ab54a', icon: '🌾' },
  west:   { name: '西境王国', color: '#b54a6a', icon: '⛰️' },
  central:{ name: '中央王国', color: '#c9a84c', icon: '👑' },
};

// 王国模板池 — 一键生成时随机抽取，每次阵容不同
const REGION_TEMPLATES = [
  { id: 'iron_keep',     name: '铁砧堡',     color: '#8b4513', icon: '⚒️' },
  { id: 'silver_crown',  name: '银冠领',     color: '#4a7fb5', icon: '👑' },
  { id: 'thorn_wild',    name: '棘林境',     color: '#2d5a2e', icon: '🌲' },
  { id: 'ash_marches',   name: '灰烬边疆',   color: '#8a3a2a', icon: '🔥' },
  { id: 'dusk_fen',      name: '暮沼',       color: '#5a4a3a', icon: '🌿' },
  { id: 'frost_teeth',   name: '霜牙隘',     color: '#b0c8e0', icon: '❄️' },
  { id: 'sands_end',     name: '沙尽城',     color: '#d4b872', icon: '🏜️' },
  { id: 'blood_rock',    name: '血岩要塞',   color: '#6b2a2a', icon: '🪨' },
  { id: 'mist_hold',     name: '雾隐之地',   color: '#6a6a8a', icon: '🌫️' },
  { id: 'shadow_blade',  name: '影刃荒野',   color: '#4a2a4a', icon: '⚔️' },
  { id: 'dragon_bones',  name: '龙骨山脉',   color: '#7a6a4a', icon: '🦴' },
  { id: 'wind_howl',     name: '风吼平原',   color: '#8aaa5a', icon: '🌬️' },
  { id: 'thunder_fall',  name: '雷殒堡',     color: '#8a7a2a', icon: '⚡' },
  { id: 'ember_mire',    name: '烬灭沼泽',   color: '#5a3a2a', icon: '🕳️' },
  { id: 'deep_spring',   name: '幽潭境',     color: '#2a5a6a', icon: '💧' },
  { id: 'crystal_spire', name: '晶辉峰',     color: '#7ab8c8', icon: '💎' },
  { id: 'black_port',    name: '黑港城',     color: '#4a4a5a', icon: '⚓' },
  { id: 'weeping_vale',  name: '泣谷之地',   color: '#6a5a4a', icon: '🕯️' },
  { id: 'gilded_ruin',   name: '金蚀废墟',   color: '#b8a84a', icon: '🏚️' },
  { id: 'hollow_keep',   name: '虚空堡',     color: '#3a2a5a', icon: '🔮' },
];
let regions = JSON.parse(JSON.stringify(DEFAULT_REGIONS));
let regionOrder = null; // array of region IDs in display order
let roadStart = null; // { q, r } for road drawing
let riverStart = null; // { q, r } for river drawing
let measureStart = null; // { q, r } for measure tool
let measurePath = null; // [{q,r},...] last measured path
let _eraseDragLast = new Set(); // dedup erase-drag per drag session
// Box select state
let selectedHexes = new Set(); // Set of "q,r" keys
let selectionRect = null; // { x1, y1, x2, y2 } screen coords during drag
let isBoxSelecting = false;
let isGenerating = false; // lock for generation buttons

// Image cache for custom terrain/settlement images
const imageCache = new Map();
function getCachedImage(url) {
  if (!url) return null;
  if (!imageCache.has(url)) {
    const img = new Image();
    img.onload = () => render();
    img.src = url;
    imageCache.set(url, img);
  }
  return imageCache.get(url);
}

// Simple string hash for image deduplication (DJB2-style)
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Compress image to maxSize x maxSize JPEG for storage efficiency
function compressImage(dataUrl, maxSize) {
  maxSize = maxSize || 256;
  return new Promise(function(resolve) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = function() { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

// Build an image registry from hex data + custom terrains, replacing imageUrl with imageHash
function buildImageRegistry(sourceHexData, sourceCustomTerrains) {
  const registry = {};
  function register(url) {
    if (!url || !url.startsWith('data:')) return url;
    const h = hashCode(url);
    if (!registry[h]) registry[h] = url;
    return h;
  }
  const exportHex = {};
  for (const [k, h] of Object.entries(sourceHexData)) {
    const eh = { terrain: h.terrain, label: h.label, annotations: h.annotations }; // annotations preserved in save
    if (typeof h.elev === 'number') eh.elev = h.elev;
    if (typeof h.moist === 'number') eh.moist = h.moist;
    if (h.region) eh.region = h.region;
    if (h.settlement) {
      eh.settlement = { name: h.settlement.name, rating: h.settlement.rating };
      if (h.settlement.imageUrl) eh.settlement.imageHash = register(h.settlement.imageUrl);
    }
    if (h.roads && h.roads.length) eh.roads = h.roads.map(function(r) { return { q: r.q, r: r.r }; });
    if (h.rivers && h.rivers.length) eh.rivers = h.rivers.map(function(r) { return { q: r.q, r: r.r, width: r.width }; });
    exportHex[k] = eh;
  }
  const exportCT = {};
  for (const [id, t] of Object.entries(sourceCustomTerrains)) {
    const et = { name: t.name, color: t.color, icon: t.icon, travel: t.travel };
    if (t.imageUrl) et.imageHash = register(t.imageUrl);
    exportCT[id] = et;
  }
  return { exportHex, exportCT, registry };
}

// Restore imageUrl from imageRegistry on load
function resolveImageRegistry(sourceHexData, sourceCustomTerrains, registry) {
  const reg = registry || {};
  function resolve(hash) {
    if (!hash) return undefined;
    if (hash.startsWith('data:')) return hash; // old format backward compat
    return reg[hash] || undefined;
  }
  const resultHex = {};
  for (const [k, h] of Object.entries(sourceHexData)) {
    const rh = { terrain: h.terrain, label: h.label, annotations: h.annotations };
    if (typeof h.elev === 'number') rh.elev = h.elev;
    if (typeof h.moist === 'number') rh.moist = h.moist;
    if (h.region) rh.region = h.region;
    if (h.settlement) {
      rh.settlement = { name: h.settlement.name, rating: h.settlement.rating };
      const img = h.settlement.imageHash ? resolve(h.settlement.imageHash) : h.settlement.imageUrl;
      if (img) rh.settlement.imageUrl = img;
    }
    if (h.roads) rh.roads = h.roads;
    if (h.rivers) rh.rivers = h.rivers;
    resultHex[k] = rh;
  }
  const resultCT = {};
  for (const [id, t] of Object.entries(sourceCustomTerrains || {})) {
    const rt = { name: t.name, color: t.color, icon: t.icon, travel: t.travel };
    const img = t.imageHash ? resolve(t.imageHash) : t.imageUrl;
    if (img) rt.imageUrl = img;
    resultCT[id] = rt;
  }
  return { resultHex, resultCT };
}
