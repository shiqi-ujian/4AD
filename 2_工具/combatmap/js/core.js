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
