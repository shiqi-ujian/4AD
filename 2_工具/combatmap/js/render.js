//  Rendering
// ============================================================
function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#2d2d44';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(viewX, viewY);
  ctx.scale(zoom, zoom);

  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;

  // Pass 1: Cell fills + grid
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawCellBase(q, r);
    }
  }

  // Pass 2: Wall boundaries (edges between cells)
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawWallEdges(q, r);
    }
  }

  // Pass 3: Overlays (icons, labels)
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawCellOverlay(q, r);
    }
  }

  // Pass 4: Free lines (任意角度线段)
  drawFreeLines();

  // Pass 5: Shapes (矩形/图片图层)
  drawShapes();

  // Pass 6: Units (token 层)
  drawTokens();

  // Pass 7: Selection boxes
  drawSelectionOverlay();

  // 绘制预览（矩形/线段）
  if (_rectPreview) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#e94560';
    ctx.fillRect(_rectPreview.x * CELL_SIZE, _rectPreview.y * CELL_SIZE, _rectPreview.w * CELL_SIZE, _rectPreview.h * CELL_SIZE);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(_rectPreview.x * CELL_SIZE, _rectPreview.y * CELL_SIZE, _rectPreview.w * CELL_SIZE, _rectPreview.h * CELL_SIZE);
    ctx.setLineDash([]);
  }
  if (_linePreview) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.moveTo(_linePreview.x1 * CELL_SIZE, _linePreview.y1 * CELL_SIZE);
    ctx.lineTo(_linePreview.x2 * CELL_SIZE, _linePreview.y2 * CELL_SIZE);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Token 放置预览
  if (_tokenPending && _hoverToken) {
    const hx = _hoverToken.q, hy = _hoverToken.r;
    const p = cellToPixel(hx, hy);
    ctx.globalAlpha = 0.5;
    if (_tokenPending.img) {
      ctx.drawImage(_tokenPending.img, p.x - _tokenPending.w * CELL_SIZE / 2, p.y - _tokenPending.h * CELL_SIZE / 2, _tokenPending.w * CELL_SIZE, _tokenPending.h * CELL_SIZE);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(p.x - _tokenPending.w * CELL_SIZE / 2, p.y - _tokenPending.h * CELL_SIZE / 2, _tokenPending.w * CELL_SIZE, _tokenPending.h * CELL_SIZE);
    ctx.setLineDash([]);
  }

  // 单位放置预览
  if (_unitPending && _hoverUnit) {
    const c = _hoverUnit;
    const p = cellToPixel(c.q, c.r);
    const w = _unitPending.w * CELL_SIZE, h = _unitPending.h * CELL_SIZE;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(p.x - w/2 + w/2, p.y - h/2 + h/2, w/2, h/2, 0, 0, Math.PI * 2);
    ctx.fillStyle = _unitPending.color || '#3a7abd';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(p.x - w/2, p.y - h/2, w, h);
    ctx.setLineDash([]);
    if (_unitPending.icon) {
      ctx.globalAlpha = 0.8;
      ctx.font = `${Math.min(w, h) * 0.55}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(_unitPending.icon, p.x, p.y);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

function drawSelectionOverlay() {
  // 格子选择框
  if (selectedCell) {
    const p = cellToPixel(selectedCell.q, selectedCell.r);
    const half = CELL_SIZE / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3 / zoom;
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(p.x - half, p.y - half, CELL_SIZE, CELL_SIZE);
    ctx.setLineDash([]);
  }
  // 单位选择框（最高优先级）
  if (selectedToken) {
    const t = tokens.find(x => x.id === selectedToken);
    if (t) {
      const p = cellToPixel(t.x, t.y);
      const w = t.w * CELL_SIZE, h = t.h * CELL_SIZE;
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(p.x - 3 / zoom, p.y - 3 / zoom, w + 6 / zoom, h + 6 / zoom);
      ctx.setLineDash([]);
      const hs = 6 / zoom;
      ctx.fillStyle = '#ffe066';
      [[p.x, p.y], [p.x + w, p.y], [p.x, p.y + h], [p.x + w, p.y + h]].forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });
    }
  }
  if (selectedShape) {
    const sh = shapes.find(s => s.id === selectedShape);
    if (sh) {
      const p = cellToPixel(sh.x, sh.y);
      const w = sh.w * CELL_SIZE, h = sh.h * CELL_SIZE;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(p.x, p.y, w, h);
      ctx.setLineDash([]);
      // 8 个缩放手柄
      const hs = 6 / zoom;
      const handles = [
        [p.x, p.y], [p.x + w / 2, p.y], [p.x + w, p.y],
        [p.x, p.y + h / 2], [p.x + w, p.y + h / 2],
        [p.x, p.y + h], [p.x + w / 2, p.y + h], [p.x + w, p.y + h]
      ];
      ctx.fillStyle = '#fff';
      handles.forEach(([hx, hy]) => {
        ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
      });
    }
  }
  if (selectedLine) {
    const ln = freeLines.find(l => l.id === selectedLine);
    if (ln) {
      const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
      ctx.strokeStyle = '#4af';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.setLineDash([]);
      const hs = 6 / zoom;
      ctx.fillStyle = '#4af';
      ctx.fillRect(p1.x - hs / 2, p1.y - hs / 2, hs, hs);
      ctx.fillRect(p2.x - hs / 2, p2.y - hs / 2, hs, hs);
    }
  }
}

function drawShapes() {
  for (const sh of shapes) {
    const p = cellToPixel(sh.x, sh.y);
    const w = sh.w * CELL_SIZE, h = sh.h * CELL_SIZE;
    if (sh.type === 'rect') {
      ctx.globalAlpha = Math.max(0, Math.min(1, sh.fillAlpha));
      ctx.fillStyle = sh.fill || '#e94560';
      ctx.fillRect(p.x, p.y, w, h);
      ctx.globalAlpha = 1;
      if (sh.strokeWidth > 0) {
        ctx.strokeStyle = sh.stroke || '#fff';
        ctx.lineWidth = sh.strokeWidth / zoom;
        ctx.setLineDash(sh.dash ? [6 / zoom, 4 / zoom] : []);
        ctx.strokeRect(p.x, p.y, w, h);
        ctx.setLineDash([]);
      }
      if (sh.name) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `bold ${Math.max(10, 13 / zoom)}px sans-serif`;
        const tw = ctx.measureText(sh.name).width;
        const ty = Math.max(2 / zoom, p.y - 4 / zoom);
        ctx.fillRect(p.x, ty - 12 / zoom, tw + 6 / zoom, 14 / zoom);
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(sh.name, p.x + 3 / zoom, ty - 5 / zoom);
      }
    } else if (sh.type === 'image' && sh.img) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, w, h);
      ctx.clip();
      ctx.drawImage(sh.img, p.x, p.y, w, h);
      ctx.restore();
      if (sh.strokeWidth > 0) {
        ctx.strokeStyle = sh.stroke || '#fff';
        ctx.lineWidth = sh.strokeWidth / zoom;
        ctx.setLineDash(sh.dash ? [6 / zoom, 4 / zoom] : []);
        ctx.strokeRect(p.x, p.y, w, h);
        ctx.setLineDash([]);
      }
      if (sh.name) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.font = `bold ${Math.max(10, 13 / zoom)}px sans-serif`;
        const tw = ctx.measureText(sh.name).width;
        const ty = Math.max(2 / zoom, p.y - 4 / zoom);
        ctx.fillRect(p.x, ty - 12 / zoom, tw + 6 / zoom, 14 / zoom);
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(sh.name, p.x + 3 / zoom, ty - 5 / zoom);
      }
    }
  }
}

function drawFreeLines() {
  for (const ln of freeLines) {
    const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
    ctx.strokeStyle = ln.color || '#000';
    ctx.lineWidth = (ln.width || 3) / zoom;
    ctx.setLineDash(ln.dash ? [8 / zoom, 5 / zoom] : []);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawTokens() {
  for (const t of tokens) {
    const p = cellToPixel(t.x, t.y);
    const w = t.w * CELL_SIZE, h = t.h * CELL_SIZE;
    const r = Math.min(8, w / 5);

    // 圆形底座
    ctx.beginPath();
    ctx.ellipse(p.x + w / 2, p.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = t.color || '#3a7abd';
    ctx.fill();
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();

    // 图片或 emoji
    if (t.imgData) {
      if (!t.img) {
        t.img = new Image();
        t.img.src = t.imgData;
        t.img.onload = () => render();
      }
      if (t.img && t.img.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(p.x + w / 2, p.y + h / 2, w / 2 - 3 / zoom, h / 2 - 3 / zoom, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(t.img, p.x + 3 / zoom, p.y + 3 / zoom, w - 6 / zoom, h - 6 / zoom);
        ctx.restore();
      }
    } else if (t.icon) {
      ctx.font = `${Math.min(w, h) * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, p.x + w / 2, p.y + h / 2 + 1 / zoom);
    }

    // 顶部名称条
    if (t.name) {
      ctx.font = `bold ${Math.max(9, 11 / zoom)}px sans-serif`;
      const tw = ctx.measureText(t.name).width + 8 / zoom;
      const by = Math.max(2 / zoom, p.y - 10 / zoom);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(p.x + w / 2 - tw / 2, by, tw, 14 / zoom);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.name, p.x + w / 2, by + 7 / zoom);
    }

    // 血条
    if (typeof t.maxHp === 'number' && t.maxHp > 0) {
      const hp = Math.max(0, Math.min(t.maxHp, t.hp ?? t.maxHp));
      const barW = Math.max(w * 0.8, 20 / zoom);
      const barH = 4 / zoom;
      const bx = p.x + w / 2 - barW / 2;
      const by = p.y + h - 2 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#a33';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = hp / t.maxHp > 0.5 ? '#3c3' : (hp / t.maxHp > 0.25 ? '#cc3' : '#e33');
      ctx.fillRect(bx, by, barW * hp / t.maxHp, barH);
    }

    // 状态角标
    if (t.status && t.status.length) {
      const icons = { '中毒': '☠️', '倒地': '🟥', '昏迷': '💫', '专注': '🎯', '减速': '🐢', '燃烧': '🔥', '冰冻': '🧊' };
      for (let i = 0; i < t.status.length; i++) {
        const st = icons[t.status[i]] || '⚠️';
        ctx.font = `${Math.max(9, 11 / zoom)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(st, p.x + w - 6 / zoom + i * 12 / zoom, p.y + 6 / zoom);
      }
    }
  }
}

function drawCellBase(q, r) {
  const p = cellToPixel(q, r);
  const h = getCell(q, r);
  const half = CELL_SIZE / 2;

  let fillColor = '#3a3a52';
  if (h.terrain && getTerrain(h.terrain)) {
    fillColor = getTerrain(h.terrain).color;
  }
  ctx.fillStyle = fillColor;
  ctx.fillRect(p.x - half, p.y - half, CELL_SIZE, CELL_SIZE);

  if (showGrid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(p.x - half, p.y - half, CELL_SIZE, CELL_SIZE);
  }
}

function drawWallEdges(q, r) {
  const h = getCell(q, r);
  if (!h.walls) return;
  const p = cellToPixel(q, r);
  const half = CELL_SIZE / 2;

  for (let edge = 0; edge < 4; edge++) {
    const state = h.walls[edge];
    if (state === 0) continue;

    let x1, y1, x2, y2;
    if (edge === 0) { // top
      x1 = p.x - half; y1 = p.y - half; x2 = p.x + half; y2 = p.y - half;
    } else if (edge === 1) { // right
      x1 = p.x + half; y1 = p.y - half; x2 = p.x + half; y2 = p.y + half;
    } else if (edge === 2) { // bottom
      x1 = p.x - half; y1 = p.y + half; x2 = p.x + half; y2 = p.y + half;
    } else { // left
      x1 = p.x - half; y1 = p.y - half; x2 = p.x - half; y2 = p.y + half;
    }

    if (state === 1) {
      // Wall: thick solid line
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      // Inner highlight
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (state === 2) {
      // Door: dashed line + icon
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Door icon at center of edge
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      ctx.fillStyle = '#8b5a2b';
      ctx.font = `${Math.max(8, CELL_SIZE * 0.22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Offset icon perpendicular to edge
      let ox = 0, oy = 0;
      if (edge === 0) oy = 1;
      else if (edge === 2) oy = -1;
      else if (edge === 1) ox = -1;
      else ox = 1;
      ctx.fillText('🚪', mx + ox * 2, my + oy * 2);
    }
  }
}

function drawCellOverlay(q, r) {
  const p = cellToPixel(q, r);
  const h = getCell(q, r);
  const half = CELL_SIZE / 2;

  // Coordinates
  if (showCoords) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = `${Math.max(8, CELL_SIZE * 0.18)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${q},${r}`, p.x, p.y + CELL_SIZE * 0.30);
  }

  // Terrain icon
  const tInfo = h.terrain ? getTerrain(h.terrain) : null;
  if (tInfo) {
    ctx.font = `${CELL_SIZE * 0.32}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isLightColor(tInfo.color) ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)';
    ctx.fillText(tInfo.icon, p.x, p.y - (h.label ? CELL_SIZE * 0.12 : 0));
  }

  // Label
  if (h.label) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(8, CELL_SIZE * 0.26)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const tw = ctx.measureText(h.label).width;
    const lh = CELL_SIZE * 0.30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const by = p.y - CELL_SIZE * 0.38;
    ctx.fillRect(p.x - tw/2 - 3, by, tw + 6, lh);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(h.label, p.x, by + lh - 1);
  }
}

// ============================================================
//  Hit Testing
// ============================================================
function cellAtPixel(px, py) {
  const wx = (px - viewX) / zoom;
  const wy = (py - viewY) / zoom;
  const c = pixelToCell(wx, wy);
  const p = cellToPixel(c.q, c.r);
  const half = CELL_SIZE / 2;
  if (wx >= p.x - half && wx <= p.x + half && wy >= p.y - half && wy <= p.y + half) {
    return c;
  }
  return null;
}

function getEdgeAtPixel(px, py) {
  const wx = (px - viewX) / zoom;
  const wy = (py - viewY) / zoom;
  const c = pixelToCell(wx, wy);
  if (!c) return null;
  const p = cellToPixel(c.q, c.r);
  const half = CELL_SIZE / 2;

  const distTop = Math.abs(wy - (p.y - half));
  const distBottom = Math.abs(wy - (p.y + half));
  const distLeft = Math.abs(wx - (p.x - half));
  const distRight = Math.abs(wx - (p.x + half));

  const threshold = CELL_SIZE * 0.28;
  const minDist = Math.min(distTop, distBottom, distLeft, distRight);
  if (minDist > threshold) return null;

  if (minDist === distTop) return { q: c.q, r: c.r, edge: 0 };
  if (minDist === distRight) return { q: c.q, r: c.r, edge: 1 };
  if (minDist === distBottom) return { q: c.q, r: c.r, edge: 2 };
  return { q: c.q, r: c.r, edge: 3 };
}

// ============================================================
//  Shape / Line Hit Testing（世界坐标）
// ============================================================
function worldPos(mx, my) {
  return { x: (mx - viewX) / zoom, y: (my - viewY) / zoom };
}

// 命中 shape（顶层优先），返回 shape 或 null
function hitTestShape(wx, wy) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const sh = shapes[i];
    if (wx >= sh.x * CELL_SIZE && wx <= (sh.x + sh.w) * CELL_SIZE &&
        wy >= sh.y * CELL_SIZE && wy <= (sh.y + sh.h) * CELL_SIZE) return sh;
  }
  return null;
}

// 命中 shape 缩放手柄（需已选中），返回 'nw','n','ne','e','se','s','sw','w' 或 null
const SHAPE_HANDLES = ['nw','n','ne','e','se','s','sw','w'];
function shapeHandleAt(wx, wy) {
  const sh = shapes.find(s => s.id === selectedShape);
  if (!sh) return null;
  const x0 = sh.x * CELL_SIZE, y0 = sh.y * CELL_SIZE;
  const x1 = (sh.x + sh.w) * CELL_SIZE, y1 = (sh.y + sh.h) * CELL_SIZE;
  const hs = 8 / zoom;
  const pts = {
    nw: [x0, y0], n: [(x0 + x1) / 2, y0], ne: [x1, y0],
    e: [x1, (y0 + y1) / 2], se: [x1, y1], s: [(x0 + x1) / 2, y1],
    sw: [x0, y1], w: [x0, (y0 + y1) / 2]
  };
  for (const h of SHAPE_HANDLES) {
    const [hx, hy] = pts[h];
    if (Math.abs(wx - hx) <= hs && Math.abs(wy - hy) <= hs) return h;
  }
  return null;
}

// 点到线段距离（世界坐标，像素）
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// 命中线段，返回 line 或 null
function hitTestLine(wx, wy) {
  for (let i = freeLines.length - 1; i >= 0; i--) {
    const ln = freeLines[i];
    const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
    const d = distToSegment(wx, wy, p1.x, p1.y, p2.x, p2.y);
    if (d <= Math.max(8 / zoom, (ln.width || 3) / zoom + 4 / zoom)) return ln;
  }
  return null;
}

// 线段端点命中（需已选中），返回 'start'|'end'|null
function lineEndAt(wx, wy) {
  const ln = freeLines.find(l => l.id === selectedLine);
  if (!ln) return null;
  const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
  const hs = 8 / zoom;
  if (Math.abs(wx - p1.x) <= hs && Math.abs(wy - p1.y) <= hs) return 'start';
  if (Math.abs(wx - p2.x) <= hs && Math.abs(wy - p2.y) <= hs) return 'end';
  return null;
}

// 单位 token 命中（最顶层优先）
function hitTestToken(wx, wy) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (wx >= t.x * CELL_SIZE && wx <= (t.x + t.w) * CELL_SIZE &&
        wy >= t.y * CELL_SIZE && wy <= (t.y + t.h) * CELL_SIZE) return t;
  }
  return null;
}

// 单位缩放手柄（需已选中）
const TOKEN_HANDLES = ['nw','ne','se','sw'];
function tokenHandleAt(wx, wy) {
  const t = tokens.find(x => x.id === selectedToken);
  if (!t) return null;
  const x0 = t.x * CELL_SIZE, y0 = t.y * CELL_SIZE;
  const x1 = (t.x + t.w) * CELL_SIZE, y1 = (t.y + t.h) * CELL_SIZE;
  const hs = 8 / zoom;
  const pts = { nw: [x0, y0], ne: [x1, y0], se: [x1, y1], sw: [x0, y1] };
  for (const h of TOKEN_HANDLES) {
    const [hx, hy] = pts[h];
    if (Math.abs(wx - hx) <= hs && Math.abs(wy - hy) <= hs) return h;
  }
  return null;
}

// ============================================================
