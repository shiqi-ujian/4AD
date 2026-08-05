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
let currentLayer = 'region'; // 始终显示王国边境

// 王国边境配置 (一个六角格 = 一天路程)
const DEFAULT_REGIONS = {
  north:  { name: '北境王国', color: '#4a7fb5', icon: '❄️' },
  south:  { name: '南境王国', color: '#b58a4a', icon: '🏜️' },
  east:   { name: '东境王国', color: '#6ab54a', icon: '🌾' },
  west:   { name: '西境王国', color: '#b54a6a', icon: '⛰️' },
  central:{ name: '中央王国', color: '#c9a84c', icon: '👑' },
};
let regions = JSON.parse(JSON.stringify(DEFAULT_REGIONS));
let regionOrder = null; // array of region IDs in display order
let roadStart = null; // { q, r } for road drawing
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
    const eh = { terrain: h.terrain, label: h.label };
    if (h.settlement) {
      eh.settlement = { name: h.settlement.name, rating: h.settlement.rating };
      if (h.settlement.imageUrl) eh.settlement.imageHash = register(h.settlement.imageUrl);
    }
    if (h.roads && h.roads.length) eh.roads = h.roads.map(function(r) { return { q: r.q, r: r.r }; });
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
    const rh = { terrain: h.terrain, label: h.label };
    if (h.settlement) {
      rh.settlement = { name: h.settlement.name, rating: h.settlement.rating };
      const img = h.settlement.imageHash ? resolve(h.settlement.imageHash) : h.settlement.imageUrl;
      if (img) rh.settlement.imageUrl = img;
    }
    if (h.roads) rh.roads = h.roads;
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
