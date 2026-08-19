//  State
// ============================================================
const CELL_SIZE = 48;
let combatData = {};       // key: "q,r" → { terrain, label, walls: [top,right,bottom,left] }
let dmData = {};           // key: "q,r" → { mark, label }，DM 隐藏层内容（默认不对玩家显示）
let fog = {};              // key: "q,r" → 1，表示被战雾遮蔽的格子
let backgroundMap = null;  // 底图: { id, imgData, img, x, y, cols, rows, opacity }  // 导入图片地图的底图/背景层
let shapes = [];           // 图形图层: { id, type:'rect'|'image', x,y,w,h(格), fill, fillAlpha, stroke, strokeWidth, dash, name, imgData }
let freeLines = [];        // 自由线段: { id, x1,y1,x2,y2(格), color, width, dash, name }
let tokens = [];           // 单位层: { id, kind, name, x,y,w,h(格), icon, color, hp,maxHp,tempHp,ac,speed,notes,status[],imgData,img }
let selectedShape = null;  // 当前选中 shape id
let selectedLine = null;   // 当前选中 line id
let selectedToken = null;  // 当前选中 token id（主轴/最近选中的单位）
let selectedTokens = new Set(); // 多选单位 id 集（Shift/Ctrl 点选；选中主轴 selectedToken 一定在集内）
let groups = [];           // 编组: { id, name, color, tokenIds[] } —— 拖动任一成员时整组移动
let customUnitStatuses = []; // 自定义状态: { name, icon }
let selectedTool = 'select';
let selectedTerrain = 'floor';
let selectedCell = null;
let viewRole = 'dm';        // 'dm' | 'player' — 手动视图切换：玩家视图预览玩家所见（DM 专属功能禁用）
function viewRoleIsPlayer() {
  return viewRole === 'player' || (typeof onlineIsPlayer === 'boolean' && onlineIsPlayer && !!onlinePeer);
}
let viewX = 0, viewY = 0;
let zoom = 1;
let isDragging = false, dragStartX, dragStartY, viewStartX, viewStartY;
let showGrid = true, showCoords = true;
let showDmLayer = false;   // 是否显示 DM 层（标记/说明）
let showFogLayer = true;   // 是否显示战雾遮罩
let initiativeOrder = [];  // 行动顺序条目: { id, tokenId?, name, icon, kind, hp, maxHp }
let initiativeIndex = 0;
let _eraseDragLast = new Set();
let _shapeSeq = 1;
let _lineSeq = 1;
let _tokenSeq = 1;
let _dragMode = null;      // 'pan' | 'paint' | 'erase' | 'shape-move' | 'shape-resize' | 'line-move' | 'line-drag' | 'wall-drag' | 'rect-draw' | 'line-draw' | 'token-place' | 'token-move' | 'token-resize' | 'unit-place' | 'dm' | 'fog'
let _dragShapeId = null, _dragHandle = null, _dragLineId = null, _dragTokenId = null;
let _selDragOff = new Map(); // 多选/编组拖动初始偏移: tokenId -> { offX, offY }
let _dragOffX = 0, _dragOffY = 0;
let _wallDragLast = null;  // 墙/门拖拽去重: "q,r,edge"
let _drawStart = null;     // rect/line 绘制的起点(格坐标)
let _rectPreview = null;   // 矩形绘制预览
let _linePreview = null;   // 线段绘制预览
let _lineInit = null;      // 线段移动初始位置
let _tokenPending = null;  // 待放置的图片 token { imgData, w, h, img }
let _hoverToken = null;    // 放置预览位置（图片）
let _unitPending = null;   // 待放置的单位 token { name, icon, color, kind, hp, maxHp, tempHp, ac, speed, notes, w, h, imgData?, img? }
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

// 图形/线段/单位/DM/战雾/行动顺序/编组/自定义状态快照撤销（整个图层入栈；剥离 img 对象避免序列化问题）
function snapshotMeta() {
  return {
    shapes: JSON.parse(JSON.stringify(shapes.map(s => { const c = { ...s }; delete c.img; return c; }))),
    freeLines: JSON.parse(JSON.stringify(freeLines)),
    tokens: JSON.parse(JSON.stringify(tokens.map(t => { const c = { ...t }; delete c.img; return c; }))),
    dmData: JSON.parse(JSON.stringify(dmData)),
    fog: JSON.parse(JSON.stringify(fog)),
    initiativeOrder: JSON.parse(JSON.stringify(initiativeOrder)),
    initiativeIndex,
    backgroundMap: backgroundMap ? JSON.parse(JSON.stringify({ ...backgroundMap, img: undefined })) : null,
    groups: JSON.parse(JSON.stringify(groups)),
    customUnitStatuses: JSON.parse(JSON.stringify(customUnitStatuses)),
    selectedToken: selectedToken || null,
    selectedTokens: Array.from(selectedTokens)
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
  groups = before.groups || [];
  customUnitStatuses = before.customUnitStatuses || [];
  selectedToken = before.selectedToken ?? selectedToken;
  selectedTokens = new Set((before.selectedTokens || Array.from(selectedTokens)).filter(id => tokens.some(t => t.id === id)));
  if (selectedToken && !tokens.some(t => t.id === selectedToken)) selectedToken = null;
  if (selectedToken && !selectedTokens.has(selectedToken)) selectedTokens.add(selectedToken);
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

// 预设状态图标（render/ui 共用；自定义状态也有 icon 字段）
const UNIT_STATUS_ICONS = {
  '中毒': '☠️', '倒地': '🟥', '昏迷': '💫', '专注': '🎯',
  '减速': '🐢', '燃烧': '🔥', '冰冻': '🧊', '隐形': '👻'
};

function statusIcon(status) {
  if (UNIT_STATUS_ICONS[status]) return UNIT_STATUS_ICONS[status];
  const cs = (customUnitStatuses || []).find(s => s.name === status);
  return cs?.icon || '⚠️';
}

function tokenInitiativeIds(tokenId) {
  return (initiativeOrder || [])
    .filter(e => (e.tokenId && e.tokenId === tokenId) || (!e.tokenId && e.id === tokenId))
    .map(e => e.id);
}

// 单位 HP 变更后同步先攻条对应条目（tokenId 优先，兼容旧 id 命名）
function syncTokenInitiative(token) {
  if (!token) return;
  (initiativeOrder || []).forEach(e => {
    const linked = e.tokenId ? e.tokenId === token.id : e.id === token.id;
    if (linked) {
      e.hp = token.hp ?? '';
      e.maxHp = token.maxHp ?? '';
    }
  });
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

// 单位删除后清对应先攻条目（tokenId 或旧式 tk id 均清除；手动条目不受影响）
function clearInitiativeTokenRefs(tokenId) {
  if (!tokenId) return;
  initiativeOrder = (initiativeOrder || []).filter(e => {
    if (e.tokenId) return e.tokenId !== tokenId;
    return String(e.id || '') !== String(tokenId);
  });
  if (initiativeIndex >= initiativeOrder.length) initiativeIndex = Math.max(0, initiativeOrder.length - 1);
}

// 扣血/治疗入口：负 delta=受伤（先吃临时HP），正 delta=治疗（先回血，溢出进临时HP）
function changeTokenHp(tokenId, delta) {
  const t = tokens.find(x => x.id === tokenId);
  if (!t || !delta) return null;
  pushUndoMeta();
  delta = Math.round(delta || 0);
  let absorbed = 0;
  if (delta < 0) {
    const dmg = -delta;
    if (t.tempHp > 0) {
      absorbed = Math.min(t.tempHp, dmg);
      t.tempHp = Math.max(0, (t.tempHp || 0) - absorbed);
    }
    const rest = dmg - absorbed;
    if (rest > 0) t.hp = Math.max(0, (t.hp ?? 0) - rest);
  } else {
    if (typeof t.hp === 'number' && typeof t.maxHp === 'number') {
      const missing = t.maxHp - t.hp;
      const heal = Math.min(missing, delta);
      t.hp += heal;
      t.tempHp = (t.tempHp || 0) + (delta - heal);
    } else {
      t.tempHp = (t.tempHp || 0) + delta;
    }
  }
  syncTokenInitiative(t);
  render();
  if (typeof updateInfo === 'function') updateInfo();
  return { hp: t.hp, tempHp: t.tempHp || 0, absorbed };
}

function addTokenToInitiative(token) {
  if (!token) return null;
  pushUndoMeta();
  const entry = {
    id: token.id || ('init_' + Date.now().toString(36)),
    tokenId: token.id || null,
    name: token.name || '未命名',
    icon: token.icon || '🧝',
    kind: token.kind || 'npc',
    hp: token.hp ?? '',
    maxHp: token.maxHp ?? ''
  };
  initiativeOrder.push(entry);
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
  return entry;
}

function addAllTokensToInitiative() {
  if (!tokens.length) return;
  pushUndoMeta();
  tokens.forEach(t => {
    initiativeOrder.push({
      id: t.id || ('t_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)),
      tokenId: t.id || null,
      name: t.name || '未命名',
      icon: t.icon || '🧝',
      kind: t.kind || 'npc',
      hp: t.hp ?? '',
      maxHp: t.maxHp ?? ''
    });
  });
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
}

// ---------------- 编组 / 多选 ----------------
function getTokenGroup(tokenId) {
  return (groups || []).find(g => (g.tokenIds || []).includes(tokenId)) || null;
}

function addTokenGroup(name, color, tokenIds) {
  const ids = (tokenIds || []).filter(id => tokens.some(t => t.id === id));
  if (!ids.length) return null;
  pushUndoMeta();
  const g = { id: 'grp_' + Date.now().toString(36), name: name || '编组', color: color || '#7fb0ff', tokenIds: ids };
  groups.push(g);
  return g;
}

function removeGroup(groupId) {
  if (!groups.some(g => g.id === groupId)) return;
  pushUndoMeta();
  groups = groups.filter(g => g.id !== groupId);
}

function removeTokenFromGroups(tokenId) {
  const hit = groups.some(g => (g.tokenIds || []).includes(tokenId));
  if (!hit) return;
  pushUndoMeta();
  groups.forEach(g => { g.tokenIds = (g.tokenIds || []).filter(id => id !== tokenId); });
  groups = groups.filter(g => (g.tokenIds || []).length > 0);
}

function pruneGroups() {
  const valid = new Set(tokens.map(t => t.id));
  groups = (groups || []).map(g => ({ ...g, tokenIds: (g.tokenIds || []).filter(id => valid.has(id)) }))
    .filter(g => (g.tokenIds || []).length > 0);
}

function clearSelection() {
  selectedToken = null;
  selectedTokens = new Set();
}

// 多选状态下该 token 是否随整体拖动；返回应跟随移动的 id 数组
function tokenDragIds(tokenId) {
  if (!tokenId) return [];
  // 多选优先：移动所有已选；否则小组内任一成员移动整组
  if (selectedTokens.has(tokenId)) {
    return Array.from(selectedTokens).filter(id => tokens.some(t => t.id === id) || id === tokenId);
  }
  const g = getTokenGroup(tokenId);
  if (g) return g.tokenIds.slice();
  return [tokenId];
}

function moveTokensByOffsets(offsets) {
  for (const [id, off] of (offsets || new Map())) {
    const t = tokens.find(x => x.id === id);
    if (t) { t.x = off.nx; t.y = off.ny; }
  }
}

function duplicateTokens(ids) {
  const list = (ids && ids.length ? ids : selectedTokens.size ? Array.from(selectedTokens) : (selectedToken ? [selectedToken] : []));
  if (!list.length) return [];
  pushUndoMeta();
  const created = [];
  for (const id of list) {
    const src = tokens.find(t => t.id === id);
    if (!src) continue;
    const copy = JSON.parse(JSON.stringify({ ...src, img: undefined }));
    copy.id = 'tk' + (_tokenSeq++);
    copy.imgData = src.imgData || '';
    copy.img = src.imgData ? (() => { const im = new Image(); im.src = src.imgData; return im; })() : null;
    copy.x = (src.x || 0) + 0.5;
    copy.y = (src.y || 0) + 0.5;
    tokens.push(copy);
    created.push(copy);
  }
  clearSelection();
  selectedToken = created.length ? created[created.length - 1].id : null;
  if (selectedToken) selectedTokens.add(selectedToken);
  render(); updateInfo();
  showToast(`📋 已复制 ${created.length} 个单位（副本不自动进先攻条）`);
  return created;
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
  initiativeOrder = (initiativeOrder || []).filter(e => {
    if (e.tokenId) return valid.has(e.tokenId);
    return !String(e.id || '').startsWith('tk') || valid.has(e.id);
  });
  // 保持索引不越界
  if (initiativeIndex >= initiativeOrder.length) initiativeIndex = Math.max(0, initiativeOrder.length - 1);
  pruneGroups();
}

// ============================================================