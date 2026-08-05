// ======== Rendering ========
function hexToRGBA(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
      drawHexBase(q, r, allTerrains);
    }
  }

  // Pass 2: Region borders (between fills and roads)
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (!h.region) continue;
      const p = hexToPixel(q, r);
      const corners = hexCorners(p.x, p.y, HEX_SIZE);
      const parity = q & 1;
      const dirs = parity
        ? [[1,0],[0,-1],[-1,0],[-1,1],[0,1],[1,1]]
        : [[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[0,1]];
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        // 边 i→j 对应的邻居方向：偶数列用 dirs[(i+1)%6]，奇数列用 dirs[i]
        const [dq, dr] = dirs[(6 - i - parity) % 6];
        const nq = q + dq, nr = r + dr;
        const nh = getHex(nq, nr);
        let drawBorder = false;
        if (!nh.region) {
          // Wilderness border: this hex's region boundary to unclaimed land
          drawBorder = true;
        } else if (nh.region !== h.region && h.region < nh.region) {
          // Inter-region border: draw once per edge (alphabetical comparison)
          drawBorder = true;
        }
        if (drawBorder) {
          ctx.beginPath();
          ctx.moveTo(corners[i].x, corners[i].y);
          ctx.lineTo(corners[j].x, corners[j].y);
          ctx.strokeStyle = hexToRGBA(regions[h.region].color, 0.7);
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      }
    }
  }

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
      drawHexOverlay(q, r, allTerrains);
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

function drawHexBase(q, r, allTerrains) {
  const p = hexToPixel(q, r);
  const h = getHex(q, r);
  const corners = hexCorners(p.x, p.y, HEX_SIZE);

  // Fill
  ctx.beginPath();
  corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.closePath();

  // 1. Always draw terrain as base fill
  let fillColor = '#3a3a52';
  const hTerrainInfo = h.terrain ? allTerrains[h.terrain] : null;
  if (hTerrainInfo) fillColor = hTerrainInfo.color;
  ctx.fillStyle = fillColor;
  ctx.fill();

  // 2. Region layer: overlay semi-transparent region color on top of terrain
  if (h.region && regions[h.region]) {
    ctx.fillStyle = hexToRGBA(regions[h.region].color, 0.3);
    ctx.fill();
  }

  // Grid stroke
  if (showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawHexOverlay(q, r, allTerrains) {
  const p = hexToPixel(q, r);
  const h = getHex(q, r);

  // Coordinates
  if (showCoords) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.max(8, HEX_SIZE * 0.32)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${q},${r}`, p.x, p.y + HEX_SIZE * 0.4);
  }

  // Terrain icon (image or emoji) — always show terrain, regardless of layer
  const hOverlayTI = h.terrain ? allTerrains[h.terrain] : null;
  if (hOverlayTI) {
    if (hOverlayTI.imageUrl) {
      drawHexImage(p.x, p.y, HEX_SIZE * 1.1, hOverlayTI.imageUrl);
    } else {
      ctx.font = `${HEX_SIZE * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(hOverlayTI.icon, p.x, p.y - (h.label || h.settlement ? HEX_SIZE * 0.15 : 0));
    }
  }

  // Label
  if (h.label) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, HEX_SIZE * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(h.label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(p.x - tw/2 - 3, p.y - HEX_SIZE * 0.65, tw + 6, HEX_SIZE * 0.55);
    ctx.fillStyle = '#fff';
    ctx.fillText(h.label, p.x, p.y - HEX_SIZE * 0.2);
  }

  // Settlement marker
  if (h.settlement) {
    if (h.settlement.imageUrl) {
      drawHexImage(p.x, p.y + HEX_SIZE * 0.15, HEX_SIZE * 0.9, h.settlement.imageUrl);
    } else {
      const ratingIcons = {'-3':'🛖','-2':'🏕️','-1':'🏘️','0':'🏘️','1':'🏛️','2':'🏰','3':'🏙️'};
      const icon = ratingIcons[String(h.settlement.rating)] || '🏘️';
      ctx.font = `${HEX_SIZE * 0.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(icon, p.x, p.y + HEX_SIZE * 0.45);
    }

    // Settlement name & rating
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold ${Math.max(9, HEX_SIZE * 0.3)}px sans-serif`;
    ctx.textBaseline = 'top';
    const sname = h.settlement.name || '?';
    const srating = h.settlement.rating ?? 0;
    const stext = `${sname} (${srating >= 0 ? '+' : ''}${srating})`;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const sw = ctx.measureText(stext).width;
    ctx.fillRect(p.x - sw/2 - 3, p.y + HEX_SIZE * 0.3, sw + 6, HEX_SIZE * 0.38);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(stext, p.x, p.y + HEX_SIZE * 0.35);
  }
}

// Draw an image clipped to a hexagon shape
function drawHexImage(cx, cy, imgSize, imageUrl) {
  const img = getCachedImage(imageUrl);
  if (!img || !img.complete || img.naturalWidth === 0) {
    // Image not loaded yet, draw placeholder
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${HEX_SIZE * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🖼️', cx, cy);
    return;
  }
  ctx.save();
  // Hex clip path
  const corners = hexCorners(cx, cy, imgSize * 0.6);
  ctx.beginPath();
  corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.clip();
  // Draw image centered
  const s = imgSize;
  ctx.drawImage(img, cx - s/2, cy - s/2, s, s);
  ctx.restore();
  // Thin border
  ctx.beginPath();
  corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
