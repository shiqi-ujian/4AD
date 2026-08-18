// ======== Rendering ========
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
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (h.roads) {
        const p1 = hexToPixel(q, r);
        for (const rd of h.roads) {
          // Draw each road once (only if q,r < rd in some ordering)
          if (rd.q > q || (rd.q === q && rd.r > r)) {
            const p2 = hexToPixel(rd.q, rd.r);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
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
    g.fillStyle = hTerrainInfo ? hTerrainInfo.color : '#3a3a52';
    g.fill();
    if (elevActive) { g.fillStyle = hexToRGBA(elevationColor(h.elev), 0.55); g.fill(); }
    if (regionActive) { g.fillStyle = hexToRGBA(regions[h.region].color, 0.2); g.fill(); }
  } else if (activeCount === 1) {
    const solo = terrainActive ? hTerrainInfo.color
      : (elevActive ? elevationColor(h.elev) : regions[h.region].color);
    g.fillStyle = solo; g.fill();
  } else {
    g.fillStyle = '#3a3a52'; g.fill();
  }

  // Grid stroke
  if (showGrid) {
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    g.stroke();
  }
}

// Draw all river edges in the visible range. Rivers are drawn along the shared
// edge between adjacent hexes (like roads but inset to the edge line).
function drawRivers(ctx, qMin, qMax, rMin, rMax) {
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (!h.rivers || !h.rivers.length) continue;
      const p1 = hexToPixel(q, r);
      for (const rd of h.rivers) {
        // Draw each river edge once (only when q,r < rd in some ordering)
        if (rd.q > q || (rd.q === q && rd.r > r)) {
          const p2 = hexToPixel(rd.q, rd.r);
          const seg = riverEdgeSegment(p1, null, p2);
          if (seg.length < 2) continue;
          const width = rd.width || 1;
          ctx.beginPath();
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = width >= 2 ? '#1f4fa0' : '#2f6fd0';
          ctx.lineWidth = width >= 2 ? 6 : 3;
          ctx.moveTo(seg[0].x, seg[0].y);
          ctx.lineTo(seg[1].x, seg[1].y);
          ctx.stroke();
        }
      }
    }
  }
}

function drawHexOverlay(g, q, r, h) {
  const p = hexToPixel(q, r);
  const allTerrains = getAllTerrains();
  if (!h) h = getHex(q, r);

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
