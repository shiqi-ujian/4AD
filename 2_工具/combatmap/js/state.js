//  State
// ============================================================
const CELL_SIZE = 48;
let combatData = {};       // key: "q,r" → { terrain, label, walls: [top,right,bottom,left] }
let shapes = [];           // 图形图层: { id, type:'rect'|'image', x,y,w,h(格), fill, fillAlpha, stroke, strokeWidth, dash, name, imgData }
let freeLines = [];        // 自由线段: { id, x1,y1,x2,y2(格), color, width, dash, name }
let selectedShape = null;  // 当前选中 shape id
let selectedLine = null;   // 当前选中 line id
let selectedTool = 'select';
let selectedTerrain = 'floor';
let selectedCell = null;
let viewX = 0, viewY = 0;
let zoom = 1;
let isDragging = false, dragStartX, dragStartY, viewStartX, viewStartY;
let showGrid = true, showCoords = true;
let _eraseDragLast = new Set();
let _shapeSeq = 1;
let _lineSeq = 1;
let _dragMode = null;      // 'pan' | 'paint' | 'erase' | 'shape-move' | 'shape-resize' | 'line-move' | 'line-drag' | 'wall-drag' | 'rect-draw' | 'line-draw' | 'token-place'
let _dragShapeId = null, _dragHandle = null, _dragLineId = null;
let _dragOffX = 0, _dragOffY = 0;
let _wallDragLast = null;  // 墙/门拖拽去重: "q,r,edge"
let _drawStart = null;     // rect/line 绘制的起点(格坐标)
let _rectPreview = null;   // 矩形绘制预览
let _linePreview = null;   // 线段绘制预览
let _lineInit = null;      // 线段移动初始位置
let _tokenPending = null;  // 待放置的图片 { imgData, w, h, img }
let _hoverToken = null;    // 放置预览位置

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

// 图形/线段快照撤销（整个图层入栈；剥离 img 对象避免序列化问题）
function snapshotMeta() {
  return {
    shapes: JSON.parse(JSON.stringify(shapes.map(s => { const c = { ...s }; delete c.img; return c; }))),
    freeLines: JSON.parse(JSON.stringify(freeLines))
  };
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
      selectedShape = null; selectedLine = null;
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
