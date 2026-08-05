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
  var keys = Object.keys(hexData);
  if (keys.length === 0) { showDiceResult('⚠️', '没有数据'); return; }
  var minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(','); var q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  var tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  var mapW = br.x - tl.x + HEX_SIZE * 2;
  var mapH = br.y - tl.y + HEX_SIZE * 2;
  var pad = 40;
  var sx = (canvas.width - pad * 2) / mapW;
  var sy = (canvas.height - pad * 2) / mapH;
  zoom = Math.max(0.02, Math.min(3, Math.min(sx, sy)));
  viewX = canvas.width / 2 - (tl.x + br.x) / 2 * zoom;
  viewY = canvas.height / 2 - (tl.y + br.y) / 2 * zoom;
  document.getElementById('zoom-indicator').textContent = '🔍 ' + Math.round(zoom * 100) + '%';
  render();
}

var _lastMinimapRender = 0;

// Minimap: draws all hexes at tiny scale with a viewport rect overlay
function renderMinimap(force) {
  var enabled = document.getElementById('chk-minimap').checked;
  if (!enabled) { minimapCanvas.style.display = 'none'; return; }
  if (!force && Date.now() - _lastMinimapRender < 200) return; // throttle to 5fps
  _lastMinimapRender = Date.now();
  var keys = Object.keys(hexData);
  if (keys.length === 0) { minimapCanvas.style.display = 'none'; return; }
  minimapCanvas.style.display = 'block';
  var w = minimapCanvas.width = 180 * (window.devicePixelRatio || 1);
  var h = minimapCanvas.height = 135 * (window.devicePixelRatio || 1);
  var ctxM = minimapCtx;
  ctxM.clearRect(0, 0, w, h);

  // Compute bounding box
  var minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(','); var q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  var tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  var fullW = br.x - tl.x + HEX_SIZE * 2;
  var fullH = br.y - tl.y + HEX_SIZE * 2;
  var scale = Math.min((w - 8) / fullW, (h - 8) / fullH);
  var offX = (w - fullW * scale) / 2 - tl.x * scale + HEX_SIZE * scale;
  var offY = (h - fullH * scale) / 2 - tl.y * scale + HEX_SIZE * scale;

  // Fill hex cells (sample every Nth hex on very large maps for performance)
  var allTerrains = getAllTerrains();
  var step = keys.length > 50000 ? Math.ceil(keys.length / 40000) : 1;
  for (var i = 0; i < keys.length; i++) {
    if (i % step !== 0) continue;
    var hd = hexData[keys[i]];
    if (!hd || !hd.terrain) continue;
    var parts = keys[i].split(','); var q = +parts[0], r = +parts[1];
    var px = hexToPixel(q, r);
    var cx = offX + px.x * scale, cy = offY + px.y * scale;
    var sz = HEX_SIZE * scale * 0.95;
    var terrainInfo = hd.terrain ? allTerrains[hd.terrain] : null;
    ctxM.fillStyle = terrainInfo ? terrainInfo.color : '#3a3a52';
    ctxM.fillRect(cx - sz, cy - sz * 0.75, sz * 2, sz * 1.5);
  }

  // Draw viewport rect
  var vpLeft = -viewX / zoom, vpTop = -viewY / zoom;
  var vpW = canvas.width / zoom, vpH = canvas.height / zoom;
  ctxM.strokeStyle = '#fff';
  ctxM.lineWidth = 1.5;
  ctxM.strokeRect(offX + vpLeft * scale, offY + vpTop * scale, vpW * scale, vpH * scale);
}

// Minimap click → pan to position
minimapCanvas.addEventListener('click', function(e) {
  var keys = Object.keys(hexData);
  if (keys.length === 0) return;
  var rect = minimapCanvas.getBoundingClientRect();
  var mx = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
  var my = (e.clientY - rect.top) * (window.devicePixelRatio || 1);

  // Compute same bounding box + scale as renderMinimap
  var minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  for (var i = 0; i < keys.length; i++) {
    var parts = keys[i].split(','); var q = +parts[0], r = +parts[1];
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  var tl = hexToPixel(minQ, minR), br = hexToPixel(maxQ, maxR);
  var fullW = br.x - tl.x + HEX_SIZE * 2, fullH = br.y - tl.y + HEX_SIZE * 2;
  var w = minimapCanvas.width, h = minimapCanvas.height;
  var scale = Math.min((w - 8) / fullW, (h - 8) / fullH);
  var offX = (w - fullW * scale) / 2 - tl.x * scale + HEX_SIZE * scale;
  var offY = (h - fullH * scale) / 2 - tl.y * scale + HEX_SIZE * scale;

  // Convert click to world coords
  var worldX = (mx - offX) / scale;
  var worldY = (my - offY) / scale;

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
  return hexData[k] || { terrain: null, label: '', settlement: null, roads: [], region: null };
}

let settlementIndex = []; // [{q, r}] — fast lookup for rankSettlementLocation

// Low-level write without undo tracking. Used by bulk generation functions.
// Returns the merged hex data, or null if the key was deleted (empty).
function writeHexData(key, data) {
  const old = hexData[key];
  const merged = { ...(old || { terrain: null, label: '', settlement: null, roads: [], region: null }), ...data };
  if (!merged.terrain && !merged.label && !merged.settlement && !merged.region && (!merged.roads || merged.roads.length === 0)) {
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

// Remove hexes with no terrain, label, settlement, or roads
function cleanHexData() {
  for (const key of Object.keys(hexData)) {
    const h = hexData[key];
    if (!h.terrain && !h.label && !h.settlement && !h.region && (!h.roads || h.roads.length === 0)) {
      delete hexData[key];
    }
  }
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

function neighbors(q, r) {
  const parity = q & 1;
  const dirs = parity ? [
    [1,0],[0,-1],[-1,0],[-1,1],[0,1],[1,1]
  ] : [
    [1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]
  ];
  return dirs.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}
