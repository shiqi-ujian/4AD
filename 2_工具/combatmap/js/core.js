//  Coordinate System
// ============================================================
function cellToPixel(q, r) {
  return { x: q * CELL_SIZE, y: r * CELL_SIZE };
}

function pixelToCell(px, py) {
  return { q: Math.floor((px + CELL_SIZE / 2) / CELL_SIZE), r: Math.floor((py + CELL_SIZE / 2) / CELL_SIZE) };
}

function cellKey(q, r) { return `${q},${r}`; }

function neighbors(q, r) {
  return [[0,-1],[1,0],[0,1],[-1,0]].map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

// Opposite edge indices: top↔bottom(0↔2), right↔left(1↔3)
const OPPOSITE_EDGE = [2, 3, 0, 1];
const EDGE_DELTA = [[0,-1],[1,0],[0,1],[-1,0]]; // dq,dr for each edge direction

// ============================================================
//  Data CRUD
// ============================================================
function getCell(q, r) {
  const key = cellKey(q, r);
  if (!combatData[key]) return { terrain: null, label: '', walls: [0, 0, 0, 0] };
  return combatData[key];
}

function setCell(q, r, data) {
  const key = cellKey(q, r);
  pushUndo(key);
  const existing = getCell(q, r);
  const merged = { ...existing, ...data };
  // Auto-clean empty cells
  if (!merged.terrain && !merged.label && merged.walls.every(w => w === 0)) {
    delete combatData[key];
  } else {
    combatData[key] = merged;
  }
  onlineMarkSync();
}

function setWall(q, r, edge, value) {
  // Set wall on this cell
  const key = cellKey(q, r);
  pushUndo(key);
  const cell = getCell(q, r);
  // Ensure cell exists in combatData
  const exists = !!combatData[key];
  cell.walls[edge] = value;
  combatData[key] = cell;

  // Sync with neighbor
  const [dq, dr] = EDGE_DELTA[edge];
  const nq = q + dq, nr = r + dr;
  const nKey = cellKey(nq, nr);
  const nCell = getCell(nq, nr);
  const nExists = !!combatData[nKey];
  pushUndo(nKey);
  nCell.walls[OPPOSITE_EDGE[edge]] = value;
  combatData[nKey] = nCell;

  // Clean up if both cells became empty
  if (!cell.terrain && !cell.label && cell.walls.every(w => w === 0) && exists) {
    delete combatData[key];
  }
  if (!nCell.terrain && !nCell.label && nCell.walls.every(w => w === 0) && nExists) {
    delete combatData[nKey];
  }
  onlineMarkSync();
}

function cleanData() {
  for (const key of Object.keys(combatData)) {
    const h = combatData[key];
    if (!h.terrain && !h.label && h.walls.every(w => w === 0)) {
      delete combatData[key];
    }
  }
}

// ============================================================
//  Vision / Line of Sight（P0 单位视野驱动自动战雾）
//  可见性 = 距视野源 ⩽ sightRadius 且 未被墙体遮挡
//  遮挡物：复用现有地形 wall_cell / cover_full，不新造墙类型
// ============================================================
function isVisionBlocker(q, r) {
  const d = getCell(q, r);
  return d.terrain === 'wall_cell' || d.terrain === 'cover_full';
}

// x/y 均为“格单位”坐标（格子中心 = (q,r)，格子跨 [q-0.5, q+0.5]）
// 判定从 (x0,y0) 到 (x1,y1) 的视线是否被墙体中途遮挡。
// 目标格 (tq,tr) 本身可见（即使它是墙）；只有“起点与目标之间”的格会阻挡。
function losClear(x0, y0, x1, y1, tq, tr) {
  const dq = x1 - x0, dr = y1 - y0;
  const len = Math.hypot(dq, dr);
  if (len < 0.01) return true;
  const numPts = Math.max(1, Math.ceil(len / 0.15));
  for (let i = 1; i < numPts; i++) {
    const t = i / numPts;
    const q = Math.round(x0 + dq * t), r = Math.round(y0 + dr * t);
    if (q === tq && r === tr) continue; // 目标格本身，不判为遮挡
    if (isVisionBlocker(q, r)) return false;
  }
  return true;
}

// 当前视角的视野源 token 列表：若指定了单视角源则只用它，否则用全部视野源
function visionSourceTokens() {
  if (viewSourceTokenId) {
    const t = tokens.find(x => x.id === viewSourceTokenId);
    return t ? [t] : [];
  }
  return tokens.filter(t => t.visionSource && (t.sightRadius || 0) > 0);
}

// 返回“玩家可见”格子集合（视图由 visionSourceTokens() 决定）
function computeVisibleCells() {
  const vis = new Set();
  for (const t of visionSourceTokens()) {
    if (!t.visionSource) continue;
    const sr = (typeof t.sightRadius === 'number' && isFinite(t.sightRadius)) ? t.sightRadius : 0;
    if (sr <= 0) continue;
    const x0 = t.x + t.w / 2, y0 = t.y + t.h / 2;
    const R = sr + 0.5; // 微扩，保证边界格包含
    const qMin = Math.floor(x0 - R), qMax = Math.ceil(x0 + R);
    const rMin = Math.floor(y0 - R), rMax = Math.ceil(y0 + R);
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        if (Math.hypot(q - x0, r - y0) > R) continue;
        if (losClear(x0, y0, q, r, q, r)) vis.add(cellKey(q, r));
      }
    }
  }
  return vis;
}

// ============================================================
//  Measurement（🎯 测量工具）
// ============================================================
// 两点（格单位坐标）的直线距离 + 英尺 + 沿路径的困难地形等效移动
function measureInfo(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const FT_PER_CELL = 5;
  // 沿直线采样，统计被穿过的“慢速地形”格数（不含端点）
  let slow = 0;
  if (dist > 0.01) {
    const numPts = Math.max(1, Math.ceil(dist / 0.25));
    const seen = new Set();
    for (let i = 1; i < numPts; i++) {
      const t = i / numPts;
      const q = Math.round(x1 + dx * t), r = Math.round(y1 + dy * t);
      const k = cellKey(q, r);
      if (seen.has(k)) continue;
      seen.add(k);
      const terr = getCell(q, r).terrain;
      if (terr === 'difficult' || terr === 'water' || terr === 'rubble' || terr === 'web' || terr === 'grass' || terr === 'ice') slow++;
    }
  }
  const ft = dist * FT_PER_CELL;
  const effCells = dist + slow;      // 每格慢速地形额外 +1（移动×2）
  const effFt = effCells * FT_PER_CELL;
  return { dist, ft, slow, effCells, effFt };
}

// ============================================================
//  Color Utilities
// ============================================================
function isLightColor(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function hexToARGB(hex) {
  return 'FF' + hex.replace('#','').toUpperCase();
}

// ============================================================
//  Canvas Setup
// ============================================================
const container = document.getElementById('canvas-container');
const canvas = document.getElementById('grid-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}

// ============================================================
