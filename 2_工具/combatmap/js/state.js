//  State
// ============================================================
const CELL_SIZE = 48;
let combatData = {};       // key: "q,r" → { terrain, label, walls: [top,right,bottom,left] }
let dmData = {};           // key: "q,r" → { mark, label }，DM 隐藏层内容（默认不对玩家显示）
let fog = {};              // key: "q,r" → 1，表示被战雾遮蔽的格子
let backgroundMap = null;  // 底图: { id, imgData, img, x, y, cols, rows, opacity }  // 导入图片地图的底图/背景层
let shapes = [];           // 图形图层: { id, type:'rect'|'image', x,y,w,h(格), fill, fillAlpha, stroke, strokeWidth, dash, name, imgData }
let freeLines = [];        // 自由线段: { id, x1,y1,x2,y2(格), color, width, dash, name }
let tokens = [];           // 单位层: { id, kind, name, x,y,w,h(格), icon, color, hp,maxHp,status[], imgData }
let selectedShape = null;  // 当前选中 shape id
let selectedLine = null;   // 当前选中 line id
let selectedToken = null;  // 当前选中 token id
let selectedTool = 'select';
let selectedTerrain = 'floor';
let selectedCell = null;
let viewX = 0, viewY = 0;
let zoom = 1;
let isDragging = false, dragStartX, dragStartY, viewStartX, viewStartY;
let showGrid = true, showCoords = true;
let showDmLayer = false;   // 是否显示 DM 层（标记/说明）
let showFogLayer = true;   // 是否显示战雾遮罩
let initiativeOrder = [];  // 行动顺序条目: { id, name, icon, kind, hp, maxHp }
let initiativeIndex = 0;
let _eraseDragLast = new Set();
let _shapeSeq = 1;
let _lineSeq = 1;
let _tokenSeq = 1;
let _dragMode = null;      // 'pan' | 'paint' | 'erase' | 'shape-move' | 'shape-resize' | 'line-move' | 'line-drag' | 'wall-drag' | 'rect-draw' | 'line-draw' | 'token-place' | 'token-move' | 'token-resize' | 'unit-place' | 'dm' | 'fog'
let _dragShapeId = null, _dragHandle = null, _dragLineId = null, _dragTokenId = null;
let _dragOffX = 0, _dragOffY = 0;
let _wallDragLast = null;  // 墙/门拖拽去重: "q,r,edge"
let _drawStart = null;     // rect/line 绘制的起点(格坐标)
let _rectPreview = null;   // 矩形绘制预览
let _linePreview = null;   // 线段绘制预览
let _lineInit = null;      // 线段移动初始位置
let _tokenPending = null;  // 待放置的图片 token { imgData, w, h, img }
let _hoverToken = null;    // 放置预览位置（图片）
let _unitPending = null;   // 待放置的单位 token { name, icon, color, kind, hp, maxHp, w, h, imgData?, img? }
let _hoverUnit = null;     // 单位放置预览位置
let _fogPaintTarget = null; // 战雾拖拽目标值：true=遮住 false=揭示
let _bgAlignRefs = null;   // 底图对齐参考点/参考线: { pts:[{world:{x,y}, snappedGrid:{q,r}, horizontal?}], mode }
let _bgDragMode = null;    // 'bg-move' | 'bg-resize-w' | 'bg-resize-e' | 'bg-resize-n' | 'bg-resize-s' | 'bg-resize-corner' | 'bg-origin'

// Undo/Redo
const MAX_UNDO = 50;
let undoStack = [];
let redoStack = [];
let undoBatch = null;

// ============================================================
//  Undo/Redo System
// ============================================================
function snapshotCell(key) {
  return combatData[key] ? JSON.parse(JSON.stringify(combatData[key])) : null;
}

function updateUndoButtons() {
  const btnU = document.getElementById('btn-undo');
  const btnR = document.getElementById('btn-redo');
  if (btnU) { btnU.disabled = undoStack.length === 0; btnU.style.opacity = undoStack.length === 0 ? '0.4' : '1'; }
  if (btnR) { btnR.disabled = redoStack.length === 0; btnR.style.opacity = redoStack.length === 0 ? '0.4' : '1'; }
}

function pushUndo(key) {
  const entry = { key, before: snapshotCell(key) };
  if (undoBatch !== null) {
    undoBatch.push(entry);
  } else {
    undoStack.push([entry]);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
}

// 图形/线段/单位/DM/战雾/行动顺序快照撤销（整个图层入栈；剥离 img 对象避免序列化问题）
function snapshotMeta() {
  return {
    shapes: JSON.parse(JSON.stringify(shapes.map(s => { const c = { ...s }; delete c.img; return c; }))),
    freeLines: JSON.parse(JSON.stringify(freeLines)),
    tokens: JSON.parse(JSON.stringify(tokens.map(t => { const c = { ...t }; delete c.img; return c; }))),
    dmData: JSON.parse(JSON.stringify(dmData)),
    fog: JSON.parse(JSON.stringify(fog)),
    initiativeOrder: JSON.parse(JSON.stringify(initiativeOrder)),
    initiativeIndex,
    backgroundMap: backgroundMap ? JSON.parse(JSON.stringify({ ...backgroundMap, img: undefined })) : null
  };
}

function restoreTokens(list) {
  tokens = (list || []).map(t => {
    if (t.imgData && !t.img) {
      const img = new Image();
      img.src = t.imgData;
      img.onload = () => render();
      t.img = img;
    }
    return t;
  });
}

function restoreMeta(before) {
  shapes = (before.shapes || []).map(sh => {
    if (sh.type === 'image' && sh.imgData && !sh.img) {
      const img = new Image();
      img.src = sh.imgData;
      img.onload = () => render();
      sh.img = img;
    }
    return sh;
  });
  freeLines = before.freeLines || [];
  restoreTokens(before.tokens || []);
  dmData = before.dmData || {};
  fog = before.fog || {};
  initiativeOrder = before.initiativeOrder || [];
  initiativeIndex = before.initiativeIndex || 0;
  if (before.backgroundMap) {
    backgroundMap = before.backgroundMap;
    if (backgroundMap.imgData && !backgroundMap.img) {
      const img = new Image();
      img.src = backgroundMap.imgData;
      img.onload = () => render();
      backgroundMap.img = img;
    }
  } else {
    backgroundMap = null;
  }
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function pushUndoMeta() {
  const entry = { key: '__meta__', before: snapshotMeta() };
  if (undoBatch !== null) {
    undoBatch.push(entry);
  } else {
    undoStack.push([entry]);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
}

function beginBatch() { undoBatch = []; }

function endBatch() {
  if (undoBatch && undoBatch.length) {
    const latest = new Map();
    for (const e of undoBatch) latest.set(e.key, e);
    undoStack.push([...latest.values()]);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }
  undoBatch = null;
  updateUndoButtons();
}

function applyUndoEntry(entries) {
  const redoEntries = [];
  for (const { key, before } of entries) {
    if (key === '__meta__') {
      redoEntries.push({ key, before: snapshotMeta() });
      restoreMeta(before);
      selectedShape = null; selectedLine = null; selectedToken = null;
    } else {
      redoEntries.push({ key, before: snapshotCell(key) });
      if (before) { combatData[key] = before; }
      else { delete combatData[key]; }
    }
  }
  return redoEntries;
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  redoStack.push(applyUndoEntry(entry));
  render();
  updateInfo();
  updateUndoButtons();
}

function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  undoStack.push(applyUndoEntry(entry));
  render();
  updateInfo();
  updateUndoButtons();
}

// ============================================================
//  DM Layer / Fog / Initiative Helpers
// ============================================================
function getDmCell(q, r) {
  const key = cellKey(q, r);
  return dmData[key] || { mark: '', label: '' };
}

function setDmCell(q, r, data, recordUndo = true) {
  if (recordUndo) pushUndoMeta();
  const key = cellKey(q, r);
  const existing = dmData[key] || {};
  dmData[key] = { ...existing, ...data };
  const d = dmData[key];
  if (!d.mark && !d.label) delete dmData[key];
}

function removeDmCell(q, r, recordUndo = true) {
  if (recordUndo) pushUndoMeta();
  delete dmData[cellKey(q, r)];
}

function isFogCell(q, r) {
  return !!fog[cellKey(q, r)];
}

function setFogCell(q, r, hidden, recordUndo = true) {
  if (recordUndo) pushUndoMeta();
  const key = cellKey(q, r);
  if (hidden) fog[key] = 1;
  else delete fog[key];
  if (Object.keys(fog).length === 0) fog = {};
}

function toggleFogCell(q, r, recordUndo = true) {
  setFogCell(q, r, !isFogCell(q, r), recordUndo);
}

function clearAllFog(recordUndo = true) {
  if (recordUndo) pushUndoMeta();
  fog = {};
}

function initiativeSnapshot() {
  return JSON.parse(JSON.stringify({ initiativeOrder, initiativeIndex }));
}

function addTokenToInitiative(token) {
  if (!token) return null;
  pushUndoMeta();
  initiativeOrder.push({
    id: token.id || ('init_' + Date.now().toString(36)),
    name: token.name || '未命名',
    icon: token.icon || '🧝',
    kind: token.kind || 'npc',
    hp: token.hp ?? '',
    maxHp: token.maxHp ?? ''
  });
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
  return initiativeOrder[initiativeOrder.length - 1];
}

function addAllTokensToInitiative() {
  if (!tokens.length) return;
  pushUndoMeta();
  tokens.forEach(t => {
    initiativeOrder.push({
      id: t.id || ('t_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)),
      name: t.name || '未命名',
      icon: t.icon || '🧝',
      kind: t.kind || 'npc',
      hp: t.hp ?? '',
      maxHp: t.maxHp ?? ''
    });
  });
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function clearInitiative(recordUndo = true) {
  if (recordUndo) pushUndoMeta();
  initiativeOrder = [];
  initiativeIndex = 0;
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function removeInitiativeAt(idx, recordUndo = true) {
  if (idx < 0 || idx >= initiativeOrder.length) return;
  if (recordUndo) pushUndoMeta();
  initiativeOrder.splice(idx, 1);
  if (initiativeIndex >= initiativeOrder.length) initiativeIndex = Math.max(0, initiativeOrder.length - 1);
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function moveInitiativeAt(from, to, recordUndo = true) {
  if (from < 0 || from >= initiativeOrder.length || to < 0 || to >= initiativeOrder.length || from === to) return;
  if (recordUndo) pushUndoMeta();
  const [item] = initiativeOrder.splice(from, 1);
  initiativeOrder.splice(to, 0, item);
  if (initiativeIndex === from) initiativeIndex = to;
  else if (initiativeIndex > from && initiativeIndex <= to) initiativeIndex--;
  else if (initiativeIndex < from && initiativeIndex >= to) initiativeIndex++;
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function nextInitiative() {
  if (!initiativeOrder.length) return;
  initiativeIndex = (initiativeIndex + 1) % initiativeOrder.length;
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

function prevInitiative() {
  if (!initiativeOrder.length) return;
  initiativeIndex = (initiativeIndex - 1 + initiativeOrder.length) % initiativeOrder.length;
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

// 清理 DM 层/战雾/行动顺序中不存在的单位引用（简单去孤儿）
function cleanMetaRefs() {
  const valid = new Set(tokens.map(t => t.id));
  initiativeOrder = (initiativeOrder || []).filter(e => !e.id || !String(e.id).startsWith('tk') || valid.has(e.id));
  // 保持索引不越界
  if (initiativeIndex >= initiativeOrder.length) initiativeIndex = Math.max(0, initiativeOrder.length - 1);
}

// ============================================================