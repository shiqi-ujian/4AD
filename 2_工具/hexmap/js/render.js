// ======== Rendering ========
// Hand-drawn art helpers -------------------------------------------------
function shadeHex(hex, amt) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0,2),16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2,4),16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4,6),16) + amt));
  return `rgb(${r},${g},${b})`;
}

function rng(seed) {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967295;
}

// Draw subtle hand-inked texture inside a hex. `g` must already have the hex
// path clipped or be called inside drawHexBase after fill.
function drawHandTexture(g, q, r, terrainId, color, corners) {
  const center = hexToPixel(q, r);
  const dark = shadeHex(color, -30);
  const light = shadeHex(color, 22);
  const random = (salt) => rng((q * 31 + r * 57 + salt * 131) | 0);

  g.save();
  g.beginPath();
  corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
  g.closePath();
  g.clip();

  // Confetti stipple: every hand-drawn terrain gets a few paper specks.
  for (let i = 0; i < 5; i++) {
    const ang = random(101 + i) * Math.PI * 2;
    const rad = Math.sqrt(random(201 + i)) * HEX_SIZE * 0.72;
    const px = center.x + Math.cos(ang) * rad;
    const py = center.y + Math.sin(ang) * rad;
    const rr = 0.5 + random(301 + i) * 1.3;
    g.fillStyle = i % 2 === 0 ? hexToRGBA(light, 0.35) : hexToRGBA('#000', 0.08);
    g.beginPath();
    g.arc(px, py, rr, 0, Math.PI * 2);
    g.fill();
  }

  if (terrainId === 'water' || terrainId === 'swamp') {
    g.strokeStyle = hexToRGBA(dark, 0.4);
    g.lineWidth = 1;
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const y = center.y - HEX_SIZE * 0.45 + i * HEX_SIZE * 0.26;
      g.beginPath();
      for (let x = center.x - HEX_SIZE * 0.55; x <= center.x + HEX_SIZE * 0.55; x += 6) {
        const yy = y + Math.sin((x * 0.25) + random(10 + i) * 6) * 1.4;
        if (x === center.x - HEX_SIZE * 0.55) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
  } else if (terrainId === 'plain' || terrainId === 'necromantic' || terrainId === 'snow') {
    g.strokeStyle = hexToRGBA(dark, 0.32);
    g.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ang = random(50 + i) * Math.PI * 2;
      const rad = Math.sqrt(random(60 + i)) * HEX_SIZE * 0.62;
      const px = center.x + Math.cos(ang) * rad;
      const py = center.y + Math.sin(ang) * rad;
      const dx = Math.cos(ang + 1.2) * 3.4;
      const dy = Math.sin(ang + 1.2) * 3.4;
      g.beginPath();
      g.moveTo(px - dx, py - dy);
      g.lineTo(px + dx, py + dy);
      g.stroke();
    }
  } else if (terrainId === 'mountain' || terrainId === 'hill' || terrainId === 'desert') {
    g.strokeStyle = hexToRGBA(dark, 0.30);
    g.lineWidth = 0.9;
    for (let i = -2; i <= 2; i++) {
      const y = center.y + i * HEX_SIZE * 0.22;
      g.beginPath();
      g.moveTo(center.x - HEX_SIZE * 0.66, y);
      g.lineTo(center.x + HEX_SIZE * 0.66, y - HEX_SIZE * 0.22);
      g.stroke();
    }
  } else if (terrainId === 'abyss' || terrainId === 'ruins' || terrainId === 'temple') {
    for (let i = 0; i < 12; i++) {
      const ang = random(500 + i) * Math.PI * 2;
      const rad = Math.sqrt(random(600 + i)) * HEX_SIZE * 0.6;
      g.fillStyle = hexToRGBA(dark, 0.22);
      g.beginPath();
      g.arc(center.x + Math.cos(ang) * rad, center.y + Math.sin(ang) * rad, 0.8, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const ang = random(700 + i) * Math.PI * 2;
      const rad = Math.sqrt(random(800 + i)) * HEX_SIZE * 0.62;
      const px = center.x + Math.cos(ang) * rad;
      const py = center.y + Math.sin(ang) * rad;
      g.fillStyle = i % 2 === 0 ? hexToRGBA(dark, 0.28) : hexToRGBA(light, 0.35);
      g.beginPath();
      g.arc(px, py, 0.7 + random(900 + i) * 1.2, 0, Math.PI * 2);
      g.fill();
    }
  }

  g.restore();
}

function applyArtStyleClass() {
  document.body.classList.toggle('art-handdrawn', artStyle === 'handdrawn');
}

// (bridge helpers injected below)

// Draw a road segment, optionally breaking across a river with a bridge.
function drawRoadSegment(g, p1, p2, isBridge) {
  const w = (p2.x - p1.x), h = (p2.y - p1.y);
  const mx = p1.x + w/2, my = p1.y + h/2;
  const gap = 6;
  const s1 = { x: p1.x + (w/2) * (0.5 - gap/100), y: p1.y + (h/2) * (0.5 - gap/100) };
  const s2 = { x: p2.x - (w/2) * (0.5 - gap/100), y: p2.y - (h/2) * (0.5 - gap/100) };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (isBridge) {
    // dark bridge slab across the river
    g.beginPath();
    g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y);
    g.strokeStyle = 'rgba(70,42,18,0.95)';
    g.lineWidth = 7;
    g.stroke();
    g.beginPath();
    g.moveTo(mx - 4, my); g.lineTo(mx + 4, my);
    g.strokeStyle = '#8a5a2a';
    g.lineWidth = 2.4;
    g.stroke();
  } else {
    // two-tone road
    g.beginPath();
    g.moveTo(s1.x, s1.y); g.lineTo(s2.x, s2.y);
    g.strokeStyle = 'rgba(70,42,18,0.9)';
    g.lineWidth = 5.5;
    g.stroke();
    g.beginPath();
    g.moveTo(s1.x, s1.y); g.lineTo(s2.x, s2.y);
    g.strokeStyle = '#c48a52';
    g.lineWidth = 2.6;
    g.stroke();
  }
  g.restore();
}

// Draw a road as a two-tone hand-inked path between two hex centers.
function drawHandRoad(g, x1, y1, x2, y2) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokeStyle = 'rgba(70,42,18,0.9)';
  g.lineWidth = 5.5;
  g.stroke();
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.strokeStyle = '#c48a52';
  g.lineWidth = 2.6;
  g.stroke();
}

// River edges are now drawn by drawRiverPath (bezier centerline). This helper is kept
// only as a stump so old exports/calls don't throw; it routes to the new path.
function drawHandRiver(g, x1, y1, x2, y2, width) {
  drawRiverPath(g, { q1: 0, r1: 0, q2: 0, r2: 0, width: width || 1 });
}

function hexToRGBA(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Elevation color ramp (deep water → lowland → highland → peak) with RGB stops.
const ELEVATION_RAMP = [
  { t: -0.5, c: '#16255c' },
  { t: -0.25, c: '#2a4a7a' },
  { t: 0, c: '#4a6a3a' },
  { t: 0.3, c: '#8a7a3a' },
  { t: 0.6, c: '#9a9a9a' },
  { t: 0.9, c: '#e8e8e8' }
];

// Map an elevation float to a color by lerping between the two surrounding stops.
function elevationColor(elev) {
  const v = Math.max(-0.5, Math.min(0.9, elev));
  let a = ELEVATION_RAMP[0], b = ELEVATION_RAMP[ELEVATION_RAMP.length - 1];
  for (let i = 0; i < ELEVATION_RAMP.length - 1; i++) {
    if (v >= ELEVATION_RAMP[i].t && v <= ELEVATION_RAMP[i + 1].t) { a = ELEVATION_RAMP[i]; b = ELEVATION_RAMP[i + 1]; break; }
  }
  const f = b.t === a.t ? 0 : (v - a.t) / (b.t - a.t);
  const ca = a.c.replace('#','').match(/.{2}/g).map(x => parseInt(x, 16));
  const cb = b.c.replace('#','').match(/.{2}/g).map(x => parseInt(x, 16));
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * f);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * f);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

// Draw the shared-edge segment between two adjacent hexes (for rivers).
function riverEdgeSegment(p1, nOff, p2) {
  const a = hexCorners(p1.x, p1.y, HEX_SIZE);
  const b = hexCorners(p2.x, p2.y, HEX_SIZE);
  // Find the two corners shared by both hexes
  const shared = [];
  for (const ca of a) {
    for (const cb of b) {
      if (Math.abs(ca.x - cb.x) < 0.01 && Math.abs(ca.y - cb.y) < 0.01) shared.push(ca);
    }
  }
  if (shared.length >= 2) return [shared[0], shared[1]];
  // Fallback: middle of the two centers
  return [{ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }];
}

function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  render();
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(viewX, viewY);
  ctx.scale(zoom, zoom);

  // Determine visible hex range
  const margin = HEX_SIZE * 2;
  const topLeft = pixelToHex((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToHex((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);

  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;
  const allTerrains = getAllTerrains();

  // Pass 1: Draw hex fills and grid only
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawHexBase(ctx, q, r, undefined, allTerrains);
    }
  }

  // Pass 2: Region borders (between fills and roads)
  drawRegionBorders(ctx, qMin, qMax, rMin, rMax, getHex);

  // Pass 2.5: Rivers (under roads/labels/settlements)
  drawRivers(ctx, qMin, qMax, rMin, rMax);

  // Pass 3: Draw roads (between hexes)
  if (artStyle !== 'handdrawn') {
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
  }
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (h.roads) {
        const p1 = hexToPixel(q, r);
        for (const rd of h.roads) {
          // Draw each road once (only if q,r < rd in some ordering)
          if (rd.q > q || (rd.q === q && rd.r > r)) {
            const p2 = hexToPixel(rd.q, rd.r);
            const crossesRiver = hasRiver(q, r, rd.q, rd.r);
            if (artStyle === 'handdrawn') {
              drawRoadSegment(ctx, p1, p2, crossesRiver);
            } else {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  // Pass 3: Draw overlays (icons, labels, settlements) — on top of everything
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawHexOverlay(ctx, q, r);
    }
  }

  // Pass 4: Region names (Worldbox style — center of territory)
  drawRegionNames(ctx);

  if (isFog) {
    ctx.fillStyle = '#23233a';
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        if (hexIsFogged(q, r)) {
          const p = hexToPixel(q, r);
          const corners = hexCorners(p.x, p.y, HEX_SIZE);
          ctx.beginPath();
          corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Draw selection outline
  if (selectedHex) {
    const p = hexToPixel(selectedHex.q, selectedHex.r);
    const corners = hexCorners(p.x, p.y, HEX_SIZE);
    ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw road start indicator
  if (roadStart) {
    const p = hexToPixel(roadStart.q, roadStart.r);
    const corners = hexCorners(p.x, p.y, HEX_SIZE + 4);
    ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw river start indicator (blue)
  if (riverStart) {
    const p = hexToPixel(riverStart.q, riverStart.r);
    const corners = hexCorners(p.x, p.y, HEX_SIZE + 4);
    ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.strokeStyle = '#2f6fd0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw measure start + path overlay
  if (measureStart) {
    const p = hexToPixel(measureStart.q, measureStart.r);
    const corners = hexCorners(p.x, p.y, HEX_SIZE + 4);
    ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (measurePath && measurePath.length > 1) {
    ctx.beginPath();
    const sp = hexToPixel(measurePath[0].q, measurePath[0].r);
    ctx.moveTo(sp.x, sp.y);
    for (let i = 1; i < measurePath.length; i++) {
      const pp = hexToPixel(measurePath[i].q, measurePath[i].r);
      ctx.lineTo(pp.x, pp.y);
    }
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw box-selected hex highlights
  if (selectedHexes.size > 0) {
    for (const key of selectedHexes) {
      const [sq, sr] = key.split(',').map(Number);
      const p = hexToPixel(sq, sr);
      const corners = hexCorners(p.x, p.y, HEX_SIZE);
      ctx.beginPath();
      corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // Inner glow
      ctx.fillStyle = 'rgba(0, 200, 255, 0.08)';
      ctx.fill();
    }
  }

  // Draw selection rectangle (during box-select drag)
  if (selectionRect) {
    const { x1, y1, x2, y2 } = selectionRect;
    const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    ctx.restore(); // temporarily exit hex coordinate transform
    ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(zoom, zoom);
  }

  ctx.restore();
  renderMinimap();
}

// Draw a single hex's fill + grid on any 2D context `g` (the global ctx shadows
// as default). `h` is the hex data (defaults to getHex(q,r)). Sharing this with
// PNG export keeps the two renders identical.
function drawHexBase(g, q, r, h, allTerrains) {
  if (!h) h = getHex(q, r);
  if (!allTerrains) allTerrains = getAllTerrains();
  const p = hexToPixel(q, r);
  const corners = hexCorners(p.x, p.y, HEX_SIZE);

  // Fill
  g.beginPath();
  corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
  g.closePath();

  // Layer composition: terrain (base) + elevation tint + region tint.
  // - 0 layers on  -> neutral dark gray base (#3a3a52), grid still visible
  // - exactly 1 on -> opaque main color fills the whole hex (single-layer mode)
  // - 2+ on        -> previous semi-transparent stacking (terrain base + translucent overlays)
  const hTerrainInfo = h.terrain ? allTerrains[h.terrain] : null;
  const terrainActive = !!(showTerrainLayer && hTerrainInfo);
  const elevActive = !!(showElevationLayer && typeof h.elev === 'number');
  const regionActive = !!(showRegionLayer && h.region && regions[h.region]);
  const activeCount = (terrainActive ? 1 : 0) + (elevActive ? 1 : 0) + (regionActive ? 1 : 0);

  if (activeCount >= 2) {
    g.beginPath();
    corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
    g.closePath();
    g.fillStyle = hTerrainInfo ? hTerrainInfo.color : '#3a3a52';
    g.fill();
    if (artStyle === 'handdrawn' && hTerrainInfo) drawHandTexture(g, q, r, h.terrain, hTerrainInfo.color, corners);
    if (elevActive) { g.fillStyle = hexToRGBA(elevationColor(h.elev), 0.55); g.fill(); }
    if (regionActive) { g.fillStyle = hexToRGBA(regions[h.region].color, 0.2); g.fill(); }
  } else if (activeCount === 1) {
    const solo = terrainActive ? hTerrainInfo.color
      : (elevActive ? elevationColor(h.elev) : regions[h.region].color);
    g.beginPath();
    corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
    g.closePath();
    g.fillStyle = solo; g.fill();
    if (terrainActive && artStyle === 'handdrawn' && hTerrainInfo) drawHandTexture(g, q, r, h.terrain, hTerrainInfo.color, corners);
  } else {
    g.beginPath();
    corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
    g.closePath();
    g.fillStyle = '#3a3a52'; g.fill();
  }

  // Grid stroke
  if (showGrid) {
    if (artStyle === 'handdrawn') {
      g.strokeStyle = 'rgba(60,42,26,0.28)';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(corners[0].x, corners[0].y);
      for (let i = 0; i < corners.length; i++) {
        const c = corners[i];
        const cn = corners[(i + 1) % corners.length];
        const mx = (c.x + cn.x) / 2;
        const my = (c.y + cn.y) / 2;
        const off = 0.7;
        const wx = mx + (rng((q * 11 + r * 13 + i * 29) | 0) - 0.5) * off * 2;
        const wy = my + (rng((q * 17 + r * 19 + i * 31) | 0) - 0.5) * off * 2;
        g.lineTo(wx, wy);
        g.lineTo(cn.x, cn.y);
      }
      g.closePath();
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
}

// Draw one river edge as a smooth centerline brush (quadratic bezier through
// the shared edge midpoint). Shared by live canvas + PNG export.
function drawRiverPath(g, e) {
  const { q1, r1, q2, r2, width } = e;
  const line = riverCenterline(q1, r1, q2, r2, HEX_SIZE);
  const w = (width || 1) >= 2 ? 5 : 3.2;
  const c1 = width && width >= 2 ? '#1f4fa0' : '#2f6fd0';
  const c2 = width && width >= 2 ? '#4a9bd8' : '#6fb3e0';
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(line.p1.x, line.p1.y);
  g.quadraticCurveTo(line.ctrl.x, line.ctrl.y, line.p2.x, line.p2.y);
  g.strokeStyle = 'rgba(10,30,80,0.85)';
  g.lineWidth = w + 0.8;
  g.stroke();
  g.beginPath();
  g.moveTo(line.p1.x, line.p1.y);
  g.quadraticCurveTo(line.ctrl.x, line.ctrl.y, line.p2.x, line.p2.y);
  g.strokeStyle = c1;
  g.lineWidth = w;
  g.stroke();
  g.beginPath();
  g.moveTo(line.p1.x, line.p1.y);
  g.quadraticCurveTo(line.ctrl.x, line.ctrl.y, line.p2.x, line.p2.y);
  g.strokeStyle = c2;
  g.lineWidth = Math.max(1, w * 0.45);
  g.stroke();
  g.restore();
}

// Smooth river centerline: hexA center → shared edge midpoint → hexB center.
function riverCenterline(q1, r1, q2, r2, size) {
  size = size || HEX_SIZE;
  const p1 = hexToPixel(q1, r1), p2 = hexToPixel(q2, r2);
  let mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const cornersA = hexCorners(p1.x, p1.y, size);
  const cornersB = hexCorners(p2.x, p2.y, size);
  for (const ca of cornersA) {
    for (const cb of cornersB) {
      if (Math.abs(ca.x - cb.x) < 0.01 && Math.abs(ca.y - cb.y) < 0.01) {
        mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
        break;
      }
    }
  }
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const bend = size * 0.18;
  const ctrl = { x: mid.x + nx * bend, y: mid.y + ny * bend };
  return { p1, ctrl, p2 };
}

// Draw small rounded node at hex centers where ≥2 river edges meet (junction).
function drawRiverJunction(ctx, qMin, qMax, rMin, rMax) {
  const edgesMap = new Map(); // hexKey -> max width among incident edges
  for (const [key, h] of Object.entries(hexData)) {
    if (!h.rivers || h.rivers.length < 2) continue;
    const [q, r] = key.split(',').map(Number);
    const maxW = Math.max.apply(Math, h.rivers.map(x => x.width || 1));
    edgesMap.set(key, maxW);
  }
  for (const [key, maxW] of edgesMap) {
    const [q, r] = key.split(',').map(Number);
    if (q < qMin || q > qMax || r < rMin || r > rMax) continue;
    const p = hexToPixel(q, r);
    ctx.beginPath();
    ctx.arc(p.x, p.y, (maxW >= 2 ? 3.6 : 2.4), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,50,110,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, (maxW >= 2 ? 2.0 : 1.2), 0, Math.PI * 2);
    ctx.fillStyle = '#7fc0e8';
    ctx.fill();
  }
}

// Draw all river edges in the visible range (dedupe via canonical edge key).
function drawRivers(ctx, qMin, qMax, rMin, rMax) {
  const edges = getAllRiverEdges();
  const vis = edges.filter(e =>
    (e.q1 >= qMin && e.q1 <= qMax && e.r1 >= rMin && e.r1 <= rMax) ||
    (e.q2 >= qMin && e.q2 <= qMax && e.r2 >= rMin && e.r2 <= rMax)
  );
  for (const e of vis) drawRiverPath(ctx, e);
  drawRiverJunction(ctx, qMin, qMax, rMin, rMax);
}

function drawHexOverlay(g, q, r, h) {
  const p = hexToPixel(q, r);
  const allTerrains = getAllTerrains();
  if (!h) h = getHex(q, r);

  // Hand-drawn shadow / highlight under overlays — skip hexes that carry a
  // river so the waterline is not smeared by the paper shadow.
  if (artStyle === 'handdrawn' && !(h.rivers && h.rivers.length)) {
    g.save();
    g.globalAlpha = 0.10;
    g.fillStyle = '#000';
    g.beginPath();
    const sc = hexCorners(p.x + 1, p.y + 1, HEX_SIZE);
    sc.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
    g.closePath();
    g.fill();
    g.restore();
  }

  // Coordinates
  if (showCoords) {
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.font = `${Math.max(8, HEX_SIZE * 0.32)}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${q},${r}`, p.x, p.y + HEX_SIZE * 0.4);
  }

  // Terrain icon (vector or emoji) — hidden when the terrain layer is off
  const hOverlayTI = h.terrain ? allTerrains[h.terrain] : null;
  if (showTerrainLayer && hOverlayTI) {
    if (hOverlayTI.imageUrl) {
      drawHexImage(g, p.x, p.y, HEX_SIZE * 1.1, hOverlayTI.imageUrl);
    } else {
      drawIconOrEmoji(g, {
        key: h.terrain, emoji: hOverlayTI.icon,
        x: p.x, y: p.y - (h.label || h.settlement || (h.annotations && h.annotations.some(a => a.visible)) ? HEX_SIZE * 0.15 : 0),
        size: HEX_SIZE * 0.62, color: '#f4f4f4',
        outline: 'rgba(0,0,0,0.55)', textBaseline: 'middle'
      });
    }
  }

  // Annotation icons (visible ones)
  if (h.annotations && h.annotations.length) {
    const visibleAnn = h.annotations.filter(a => a.visible);
    if (visibleAnn.length) {
      // Draw small icons in top-right corner of hex
      const startX = p.x + HEX_SIZE * 0.3;
      const startY = p.y - HEX_SIZE * 0.55;
      visibleAnn.forEach((a, idx) => {
        const at = ANNOTATION_TYPES[a.type] || ANNOTATION_TYPES.note;
        drawIconOrEmoji(g, {
          key: a.type, emoji: at.icon,
          x: startX + (idx + 0.5) * (HEX_SIZE * 0.5) - (visibleAnn.length > 1 ? HEX_SIZE * 0.15 : 0),
          y: startY,
          size: HEX_SIZE * 0.4, color: at.color || '#fff',
          outline: 'rgba(0,0,0,0.65)',
          textBaseline: 'middle'
        });
      });
    }
  }

  // Label
  if (h.label) {
    g.fillStyle = '#fff';
    g.font = `bold ${Math.max(9, HEX_SIZE * 0.38)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    const tw = g.measureText(h.label).width;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(p.x - tw/2 - 3, p.y - HEX_SIZE * 0.65, tw + 6, HEX_SIZE * 0.55);
    g.fillStyle = '#fff';
    g.fillText(h.label, p.x, p.y - HEX_SIZE * 0.2);
  }

  // Settlement marker
  if (h.settlement) {
    if (h.settlement.imageUrl) {
      drawHexImage(g, p.x, p.y + HEX_SIZE * 0.15, HEX_SIZE * 0.9, h.settlement.imageUrl);
    } else {
      const ratingIcons = {'-3':'🛖','-2':'🏕️','-1':'🏘️','0':'🏘️','1':'🏛️','2':'🏰','3':'🏙️'};
      const icon = ratingIcons[String(h.settlement.rating)] || '🏘️';
      drawIconOrEmoji(g, {
        key: SETTLEMENT_ICON_KEYS[String(h.settlement.rating)], emoji: icon,
        x: p.x, y: p.y + HEX_SIZE * 0.45,
        size: HEX_SIZE * 0.78, color: '#ffd98a',
        outline: 'rgba(0,0,0,0.55)', textBaseline: 'bottom'
      });
    }

    // Settlement name & rating
    g.fillStyle = '#ffd700';
    g.font = `bold ${Math.max(9, HEX_SIZE * 0.3)}px sans-serif`;
    g.textBaseline = 'top';
    const sname = h.settlement.name || '?';
    const srating = h.settlement.rating ?? 0;
    const stext = `${sname} (${srating >= 0 ? '+' : ''}${srating})`;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    const sw = g.measureText(stext).width;
    g.fillRect(p.x - sw/2 - 3, p.y + HEX_SIZE * 0.68, sw + 6, HEX_SIZE * 0.38);
    g.fillStyle = '#ffd700';
    g.fillText(stext, p.x, p.y + HEX_SIZE * 0.72);
  }
}

// Draw an image clipped to a hexagon shape on any context `g`.
function drawHexImage(g, cx, cy, imgSize, imageUrl) {
  const img = getCachedImage(imageUrl);
  if (!img || !img.complete || img.naturalWidth === 0) {
    // Image not loaded yet, draw placeholder
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.font = `${HEX_SIZE * 0.5}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🖼️', cx, cy);
    return;
  }
  g.save();
  // Hex clip path
  const corners = hexCorners(cx, cy, imgSize * 0.6);
  g.beginPath();
  corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
  g.closePath();
  g.clip();
  // Draw image centered
  const s = imgSize;
  g.drawImage(img, cx - s/2, cy - s/2, s, s);
  g.restore();
  // Thin border
  g.beginPath();
  corners.forEach((c, i) => i === 0 ? g.moveTo(c.x, c.y) : g.lineTo(c.x, c.y));
  g.closePath();
  g.strokeStyle = 'rgba(255,255,255,0.15)';
  g.lineWidth = 1;
  g.stroke();
}
