//  Rendering
// ============================================================
// Hand-drawn helpers -------------------------------------------------
function hexToRGBA(hex, alpha) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cellRng(seed) {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 15), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967295;
}

function shadeColor(hex, amt) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0,2),16) + amt));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2,4),16) + amt));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4,6),16) + amt));
  return `rgb(${r},${g},${b})`;
}

function drawCombatTexture(g, q, r, terrainId, color) {
  const half = CELL_SIZE / 2;
  const cx = q * CELL_SIZE, cy = r * CELL_SIZE;
  const dark = shadeColor(color, -34);
  const light = shadeColor(color, 26);
  const rnd = (salt) => cellRng((q * 41 + r * 73 + salt * 151) | 0);
  g.save();
  g.beginPath();
  g.rect(cx - half, cy - half, CELL_SIZE, CELL_SIZE);
  g.clip();
  for (let i = 0; i < 6; i++) {
    const px = cx - half + rnd(101 + i) * CELL_SIZE;
    const py = cy - half + rnd(201 + i) * CELL_SIZE;
    g.fillStyle = i % 2 === 0 ? hexToRGBA(light, 0.30) : hexToRGBA('#000', 0.07);
    g.beginPath();
    g.arc(px, py, 0.6 + rnd(301 + i), 0, Math.PI * 2);
    g.fill();
  }
  if (terrainId === 'water' || terrainId === 'hazard_acid' || terrainId === 'ice') {
    g.strokeStyle = hexToRGBA(dark, 0.4);
    g.lineWidth = 1;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const y = cy - half * 0.5 + i * CELL_SIZE * 0.28;
      g.beginPath();
      for (let x = cx - half * 0.8; x <= cx + half * 0.8; x += 3) {
        const yy = y + Math.sin(x * 0.4 + rnd(9 + i) * 6) * 1.2;
        if (x === cx - half * 0.8) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
  } else if (terrainId === 'wall_cell' || terrainId === 'cover_full' || terrainId === 'pit' || terrainId === 'darkness') {
    for (let i = 0; i < 12; i++) {
      const x = cx - half + rnd(500 + i) * CELL_SIZE;
      const y = cy - half + rnd(600 + i) * CELL_SIZE;
      g.fillStyle = hexToRGBA(dark, 0.2);
      g.beginPath();
      g.arc(x, y, 0.7, 0, Math.PI * 2);
      g.fill();
    }
  } else if (terrainId === 'floor' || terrainId === 'grass' || terrainId === 'crop' || terrainId === 'snow') {
    g.strokeStyle = hexToRGBA(dark, 0.28);
    g.lineWidth = 0.9;
    for (let i = 0; i < 8; i++) {
      const x = cx - half + rnd(700 + i) * CELL_SIZE;
      const y = cy - half + rnd(800 + i) * CELL_SIZE;
      const a = rnd(900 + i) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3);
      g.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const x = cx - half + rnd(1100 + i) * CELL_SIZE;
      const y = cy - half + rnd(1200 + i) * CELL_SIZE;
      g.fillStyle = hexToRGBA(i % 2 ? light : dark, 0.25);
      g.beginPath();
      g.arc(x, y, 0.5 + rnd(1300 + i), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

function applyArtStyleClass() {
  document.body.classList.toggle('art-handdrawn', artStyle === 'handdrawn');
}

function setArtStyle(style) {
  if (style !== 'handdrawn' && style !== 'classic') return;
  artStyle = style;
  try { localStorage.setItem('combatmap_artStyle', artStyle); } catch(e) {}
  const chk = document.getElementById('chk-art-style');
  if (chk) chk.checked = (style === 'handdrawn');
  applyArtStyleClass();
  render();
}

function drawCombatCellBase(g, q, r, hCell) {
  const p = cellToPixel(q, r);
  if (!hCell) hCell = getCell(q, r);
  const half = CELL_SIZE / 2;
  const hasTerrain = hCell.terrain && getTerrain(hCell.terrain);
  // 空地恒透明（透出 #3a3a52 底色，或底图覆盖的区域）；只有地形格才填地形色
  let fillColor = hasTerrain ? getTerrain(hCell.terrain).color : 'rgba(0,0,0,0)';
  g.beginPath();
  g.rect(p.x - half, p.y - half, CELL_SIZE, CELL_SIZE);
  g.fillStyle = fillColor;
  g.fill();
  if (artStyle === 'handdrawn' && hasTerrain) {
    drawCombatTexture(g, q, r, hCell.terrain, getTerrain(hCell.terrain).color);
  }
  // 格线改为单独叠加层 drawGridOverlay()（盖在底图之上），此处不再逐格画
}

// 格线叠加层：盖在地形/底图之上，清晰可见（不透明度比原来高很多）
function drawGridOverlay() {
  if (!showGrid) return;
  const W = canvas.width, H = canvas.height;
  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;
  const half = CELL_SIZE / 2;
  ctx.save();
  if (artStyle === 'handdrawn') {
    // 手绘：保留每格有机线条，明显加强清晰度
    ctx.strokeStyle = 'rgba(46,32,16,0.82)';
    ctx.lineWidth = 1.4 / zoom;
    ctx.beginPath();
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        const p = cellToPixel(q, r);
        const r2 = (salt) => cellRng(salt);
        for (let i = -1; i <= 1; i += 2) {
          const x = i > 0 ? p.x + half : p.x - half;
          const y0 = p.y - half + (r2((q * 3 + r * 7 + i * 11) | 0) - 0.5) * 0.8;
          const y1 = p.y + half + (r2((q * 5 + r * 9 + i * 13) | 0) - 0.5) * 0.8;
          ctx.moveTo(x, y0); ctx.lineTo(x, y1);
        }
        for (let i = -1; i <= 1; i += 2) {
          const y = i > 0 ? p.y + half : p.y - half;
          const x0 = p.x - half + (r2((q * 17 + r * 19 + i * 23) | 0) - 0.5) * 0.8;
          const x1 = p.x + half + (r2((q * 29 + r * 31 + i * 37) | 0) - 0.5) * 0.8;
          ctx.moveTo(x0, y); ctx.lineTo(x1, y);
        }
      }
    }
    ctx.stroke();
  } else {
    // 经典：连续格线（cell 边界在 (q+0.5)*48），深色底 + 白色亮线，任何底色都清晰
    const x0 = qMin * CELL_SIZE - half, x1 = qMax * CELL_SIZE + half;
    const y0 = rMin * CELL_SIZE - half, y1 = rMax * CELL_SIZE + half;
    // 深色底
    ctx.strokeStyle = 'rgba(28,22,18,0.85)';
    ctx.lineWidth = 1.6 / zoom;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += CELL_SIZE) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += CELL_SIZE) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    // 白色亮线
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.9 / zoom;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += CELL_SIZE) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0; y <= y1; y += CELL_SIZE) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // 画布底色恒定 #3a3a52（标准空格底色），无论是否有底图——保证底图外围空白区颜色一致
  ctx.fillStyle = '#3a3a52';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(viewX, viewY);
  ctx.scale(zoom, zoom);

  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;

  // Pass 0: 底图（背景层——最底层，画在一切之前）
  if (layerVisible('background')) drawBackgroundMap();

  // Pass 1: Cell fills（地形层，画在底图之上；空地不填充→透出底图）
  if (layerVisible('terrain')) {
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        drawCellBase(q, r);
      }
    }
  }

  // Pass 2.5: 格线叠加层（盖在底图/地形之上，清晰可见）
  drawGridOverlay();

  // Pass 3: Wall boundaries (edges between cells，归属地形层)
  if (layerVisible('terrain')) {
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        drawWallEdges(q, r);
      }
    }
  }

  // Pass 4: Overlays (icons, labels，归属地形层)
  if (layerVisible('terrain')) {
    for (let q = qMin; q <= qMax; q++) {
      for (let r = rMin; r <= rMax; r++) {
        drawCellOverlay(q, r);
      }
    }
  }

  // Pass 4.5: Hand-drawn floor shadows / warm accents
  if (artStyle === 'handdrawn') drawCombatAccents();

  // Pass 5: Free lines (任意角度线段，线段层)
  if (layerVisible('line')) drawFreeLines();

  // Pass 6: Shapes (矩形/圆形/锥形/图片，绘画层)
  if (layerVisible('painting')) drawShapes();

  // Pass 7: Units (单位层，按图层拆分：骑乘 → 生物 → 道具)
  if (layerVisible('mount')) drawTokens('mount');
  if (layerVisible('creature')) drawTokens('creature');
  if (layerVisible('item')) drawTokens('item');

  // Pass 8: DM 隐藏层（本地/仅 DM 查看）
  if (showDmLayer) drawDmOverlay();

  // Pass 9: 战雾遮罩（盖在地图/单位之上）
  if (showFogLayer) drawFogOverlay();

  // Pass 10: Selection boxes and previews
  drawSelectionOverlay();

  // 绘制预览（画笔：矩形/圆形/锥形/线段）
  if (_rectPreview && brush.shape !== 'cone') {
    const px = _rectPreview.x * CELL_SIZE, py = _rectPreview.y * CELL_SIZE;
    const pw = _rectPreview.w * CELL_SIZE, ph = _rectPreview.h * CELL_SIZE;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = brush.fill || '#e94560';
    if (brush.shape === 'circle') {
      ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = brush.stroke || '#fff';
    ctx.lineWidth = (brush.strokeWidth || 2) / zoom;
    ctx.setLineDash(brush.dash ? [4 / zoom, 4 / zoom] : []);
    if (brush.shape === 'circle') {
      ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeRect(px, py, pw, ph);
    }
    ctx.setLineDash([]);
  }
  if (_conePreview) {
    const len = (_conePreview.length || 3) * CELL_SIZE;
    const half = _conePreview.spread || brush.spread || 0.5;
    const a = _conePreview.angle || 0;
    const opx = _conePreview.x * CELL_SIZE, opy = _conePreview.y * CELL_SIZE;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = brush.fill || '#e94560';
    ctx.beginPath(); ctx.moveTo(opx, opy); ctx.arc(opx, opy, len, a - half, a + half); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = brush.stroke || '#fff';
    ctx.lineWidth = (brush.strokeWidth || 2) / zoom;
    ctx.setLineDash(brush.dash ? [4 / zoom, 4 / zoom] : []);
    ctx.beginPath(); ctx.moveTo(opx, opy); ctx.arc(opx, opy, len, a - half, a + half); ctx.closePath(); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (_linePreview) {
    ctx.strokeStyle = brush.lineColor || '#000';
    ctx.lineWidth = (brush.lineWidth || 3) / zoom;
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
    ctx.ellipse(p.x, p.y, w/2, h/2, 0, 0, Math.PI * 2);
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

  // 测量叠加层（测距工具）
  drawMeasure();

  ctx.restore();
  // 刷新底图锁定按钮（导入/移除/加载底图后同步启用状态与文案）
  if (typeof updateBgLockUI === 'function') updateBgLockUI();
}

function drawMeasure() {
  if (!_measure) return;
  const p1 = cellToPixel(_measure.x1, _measure.y1);
  const p2 = cellToPixel(_measure.x2, _measure.y2);
  ctx.save();
  // 测距线
  ctx.strokeStyle = 'rgba(74, 170, 255, 0.95)';
  ctx.lineWidth = 2.5 / zoom;
  ctx.setLineDash([8 / zoom, 6 / zoom]);
  ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  ctx.setLineDash([]);
  // 端点圆点
  ctx.fillStyle = '#4af';
  [[p1.x, p1.y], [p2.x, p2.y]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 5 / zoom, 0, Math.PI * 2); ctx.fill(); });
  // 标签：距离 + 困难地形等效移动
  const info = measureInfo(_measure.x1, _measure.y1, _measure.x2, _measure.y2);
  let txt = `📏 ${info.dist.toFixed(1)} 格 (${info.ft.toFixed(0)} ft)`;
  if (info.slow > 0) txt += ` · 慢速地形[${info.slow}格]→ 移动 ${info.effCells.toFixed(1)} 格 (${info.effFt.toFixed(0)} ft)`;
  ctx.font = `bold ${13 / zoom}px sans-serif`;
  const tw = ctx.measureText(txt).width + 16 / zoom;
  const lh = 22 / zoom;
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
  const lx = mx - tw / 2, ly = my - lh - 8 / zoom;
  ctx.fillStyle = 'rgba(10, 20, 40, 0.92)';
  ctx.strokeStyle = 'rgba(74, 170, 255, 0.8)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(lx, ly, tw, lh, 5 / zoom); else ctx.rect(lx, ly, tw, lh);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(txt, mx, ly + lh / 2);
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
  // 单位选择框（主轴黄色 + 多选蓝色 + 编组环提示）
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
  // 其余多选单位：蓝色虚线框
  if (selectedTokens && selectedTokens.size > 1) {
    for (const id of selectedTokens) {
      if (id === selectedToken) continue;
      const tt = tokens.find(x => x.id === id);
      if (!tt) continue;
      const p2 = cellToPixel(tt.x, tt.y);
      const w2 = tt.w * CELL_SIZE, h2 = tt.h * CELL_SIZE;
      ctx.strokeStyle = '#7fb0ff';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 3 / zoom]);
      ctx.strokeRect(p2.x - 2 / zoom, p2.y - 2 / zoom, w2 + 4 / zoom, h2 + 4 / zoom);
      ctx.setLineDash([]);
    }
  }
  // 编组环：主轴所属组其它成员（未被多选时）细色环
  if (selectedToken) {
    const g = getTokenGroup(selectedToken);
    if (g) {
      for (const id of g.tokenIds || []) {
        if (id === selectedToken || (selectedTokens && selectedTokens.has(id))) continue;
        const tt = tokens.find(x => x.id === id);
        if (!tt) continue;
        const p3 = cellToPixel(tt.x, tt.y);
        const w3 = tt.w * CELL_SIZE, h3 = tt.h * CELL_SIZE;
        ctx.strokeStyle = g.color || '#7fb0ff';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([3 / zoom, 2 / zoom]);
        ctx.strokeRect(p3.x - 3 / zoom, p3.y - 3 / zoom, w3 + 6 / zoom, h3 + 6 / zoom);
        ctx.setLineDash([]);
      }
    }
  }
  if (selectedShape) {
    const sh = shapes.find(s => s.id === selectedShape);
    if (sh) {
      const p = cellToPixel(sh.x, sh.y);
      const w = (sh.w || 0) * CELL_SIZE, h = (sh.h || 0) * CELL_SIZE;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      if (sh.type === 'circle') {
        ctx.beginPath(); ctx.ellipse(p.x + w / 2, p.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (sh.type === 'cone') {
        const len = (sh.length || 3) * CELL_SIZE, half = sh.spread || 0.5, a = sh.angle || 0;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, len, a - half, a + half); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 4 / zoom, p.y - 4 / zoom, 8 / zoom, 8 / zoom); // 原点手柄
      } else {
        ctx.strokeRect(p.x, p.y, w, h);
      }
      ctx.setLineDash([]);
      if (sh.type !== 'cone') {
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
  // 底图选中框 + 锁定提示
  if (selectedBackground && backgroundMap) {
    const bm = backgroundMap;
    const bx = bm.x * CELL_SIZE, by = bm.y * CELL_SIZE;
    const bw = bm.cols * CELL_SIZE, bh = bm.rows * CELL_SIZE;
    const locked = bgLocked();
    ctx.strokeStyle = locked ? '#ff9a3a' : '#4af';
    ctx.lineWidth = 3 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
    const label = locked ? '🔒 底图已锁定' : '底图（可拖动）';
    ctx.font = `bold ${12 / zoom}px sans-serif`;
    const tw = ctx.measureText(label).width + 12 / zoom;
    ctx.fillStyle = 'rgba(10,20,40,0.92)';
    ctx.fillRect(bx, by - 20 / zoom, tw, 16 / zoom);
    ctx.fillStyle = locked ? '#ffb300' : '#8cf';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 6 / zoom, by - 12 / zoom);
  }
  // 框选预览（选择工具拖拽空白）
  if (_marquee) {
    const mx0 = _marquee.x * CELL_SIZE, my0 = _marquee.y * CELL_SIZE;
    const mw = Math.max(1, _marquee.w * CELL_SIZE), mh = Math.max(1, _marquee.h * CELL_SIZE);
    ctx.fillStyle = 'rgba(74,170,255,0.12)';
    ctx.fillRect(mx0, my0, mw, mh);
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.strokeRect(mx0, my0, mw, mh);
    ctx.setLineDash([]);
  }
}

function drawShapes() {
  for (const sh of shapes) {
    if (layerOf(sh, 'painting') !== 'painting') continue;
    if (typeof showPlayerDrawLayer === 'boolean' && !showPlayerDrawLayer && sh.author) continue; // 玩家绘制层
    drawShape(sh);
  }
}

function drawShape(sh) {
  const p = cellToPixel(sh.x, sh.y);
  const w = (sh.w || 0) * CELL_SIZE, h = (sh.h || 0) * CELL_SIZE;
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
    drawShapeName(sh, p.x, p.y);
  } else if (sh.type === 'circle') {
    const cx = p.x + w / 2, cy = p.y + h / 2, rx = w / 2, ry = h / 2;
    ctx.globalAlpha = Math.max(0, Math.min(1, sh.fillAlpha));
    ctx.fillStyle = sh.fill || '#e94560';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (sh.strokeWidth > 0) {
      ctx.strokeStyle = sh.stroke || '#fff';
      ctx.lineWidth = sh.strokeWidth / zoom;
      ctx.setLineDash(sh.dash ? [6 / zoom, 4 / zoom] : []);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    drawShapeName(sh, p.x, p.y);
  } else if (sh.type === 'cone') {
    const len = (sh.length || 3) * CELL_SIZE;
    const half = sh.spread || 0.5;
    const a = sh.angle || 0;
    // 攻击锥（扇形）：原点在 p，向 angle 方向展开
    ctx.globalAlpha = Math.max(0, Math.min(1, sh.fillAlpha));
    ctx.fillStyle = sh.fill || '#e94560';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.arc(p.x, p.y, len, a - half, a + half);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    if (sh.strokeWidth > 0) {
      ctx.strokeStyle = sh.stroke || '#fff';
      ctx.lineWidth = sh.strokeWidth / zoom;
      ctx.setLineDash(sh.dash ? [6 / zoom, 4 / zoom] : []);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, len, a - half, a + half);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawShapeName(sh, p.x, p.y);
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
    drawShapeName(sh, p.x, p.y);
  }
}

function drawShapeName(sh, x, y) {
  if (!sh.name) return;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.font = `bold ${Math.max(10, 13 / zoom)}px sans-serif`;
  const tw = ctx.measureText(sh.name).width;
  const ty = Math.max(2 / zoom, y - 4 / zoom);
  ctx.fillRect(x, ty - 12 / zoom, tw + 6 / zoom, 14 / zoom);
  ctx.fillStyle = '#ffd700';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(sh.name, x + 3 / zoom, ty - 5 / zoom);
}

function drawFreeLines() {
  for (const ln of freeLines) {
    if (layerOf(ln, 'line') !== 'line') continue;
    if (typeof showPlayerDrawLayer === 'boolean' && !showPlayerDrawLayer && ln.author) continue; // 玩家绘制层
    const p1 = cellToPixel(ln.x1, ln.y1), p2 = cellToPixel(ln.x2, ln.y2);
    ctx.strokeStyle = ln.color || '#000';
    ctx.lineWidth = (ln.width || 3) / zoom;
    ctx.setLineDash(ln.dash ? [8 / zoom, 5 / zoom] : []);
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawTokens(layerFilter) {
  for (const t of tokens) {
    if (layerFilter) {
      // 分层渲染：只画属于指定子层（骑乘/生物/道具）的单位
      if (layerOf(t, 'creature') !== layerFilter) continue;
    }
    const p = cellToPixel(t.x, t.y);
    const w = t.w * CELL_SIZE, h = t.h * CELL_SIZE;
    const cx = p.x + w / 2, cy = p.y + h / 2;

    // 阴影 + 圆形底座
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6 / zoom;
    ctx.shadowOffsetY = 2 / zoom;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = t.color || '#3a7abd';
    ctx.fill();
    ctx.restore();

    // 类型色环（玩家绿 / 敌人红 / NPC 蓝 / 盟友金）
    const kindColor = TOKEN_KIND_COLORS[t.kind] || '#42a5f5';
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2 + 2 / zoom, h / 2 + 2 / zoom, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3 / zoom;
    ctx.strokeStyle = kindColor;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
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
        ctx.ellipse(cx, cy, w / 2 - 3 / zoom, h / 2 - 3 / zoom, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(t.img, p.x + 3 / zoom, p.y + 3 / zoom, w - 6 / zoom, h - 6 / zoom);
        ctx.restore();
      }
    } else if (t.icon) {
      ctx.font = `${Math.min(w, h) * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, cx, cy + 1 / zoom);
    }

    // 顶部名称条（圆角底牌 + 类型色描边）
    if (t.name) {
      ctx.font = `bold ${Math.max(9, 11 / zoom)}px sans-serif`;
      const tw = ctx.measureText(t.name).width + 10 / zoom;
      const nh = 15 / zoom;
      const by = p.y - 13 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.74)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - tw / 2, by, tw, nh, 4 / zoom);
      else ctx.rect(cx - tw / 2, by, tw, nh);
      ctx.fill();
      ctx.strokeStyle = kindColor;
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.name, cx, by + nh / 2);
    }

    // 血条（边框 + 临时 HP 蓝条）
    if (typeof t.maxHp === 'number' && t.maxHp > 0) {
      const hp = Math.max(0, Math.min(t.maxHp, t.hp ?? t.maxHp));
      const barW = Math.max(w * 0.8, 22 / zoom);
      const barH = 5 / zoom;
      const bx = cx - barW / 2;
      const by = p.y + h - 2 / zoom;
      const temp = Math.max(0, t.tempHp || 0);
      if (temp > 0) {
        const tempH = Math.max(3 / zoom, barH * 0.85);
        const tempY = by - tempH - 2 / zoom;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx - 1, tempY - 1, barW + 2, tempH + 2);
        ctx.fillStyle = '#42a5f5';
        ctx.fillRect(bx, tempY, barW * Math.min(1, temp / Math.max(1, t.maxHp)), tempH);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      const ratio = t.maxHp > 0 ? hp / t.maxHp : 0;
      ctx.fillStyle = ratio > 0.5 ? '#4caf50' : (ratio > 0.25 ? '#ffb300' : '#e53935');
      ctx.fillRect(bx, by, barW * ratio, barH);
    }

    // AC 角标（右下小徽标）
    if (t.ac !== undefined && t.ac !== null && String(t.ac).trim() !== '') {
      const txt = 'AC ' + String(t.ac).trim();
      ctx.font = "bold " + Math.max(8, 10 / zoom) + "px sans-serif";
      const tw2 = ctx.measureText(txt).width + 8 / zoom;
      const ah = 13 / zoom;
      const ay = p.y + h - ah / 2 - 1 / zoom;
      ctx.fillStyle = 'rgba(10,10,20,0.78)';
      ctx.fillRect(p.x + w - tw2 - 2 / zoom, ay, tw2, ah);
      ctx.fillStyle = '#ffd700';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, p.x + w - tw2 / 2 - 2 / zoom, ay + ah / 2 + 0.5 / zoom);
    }

    // 速度角标（左下角）
    if (t.speed !== undefined && t.speed !== null && String(t.speed).trim() !== '') {
      const spTxt = String(t.speed).trim();
      ctx.font = "bold " + Math.max(8, 10 / zoom) + "px sans-serif";
      const twS = ctx.measureText(spTxt).width + 8 / zoom;
      const ahS = 13 / zoom;
      const ayS = p.y + h - ahS / 2 - 1 / zoom;
      ctx.fillStyle = 'rgba(10,10,20,0.78)';
      ctx.fillRect(p.x + 2 / zoom, ayS, twS, ahS);
      ctx.fillStyle = '#8cf';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(spTxt, p.x + 2 / zoom + twS / 2, ayS + ahS / 2 + 0.5 / zoom);
    }

    // 状态角标
    if (t.status && t.status.length) {
      for (let i = 0; i < t.status.length; i++) {
        const st = statusIcon(t.status[i]);
        ctx.font = "bold " + Math.max(9, 11 / zoom) + "px sans-serif";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(st, p.x + w - 6 / zoom + i * 12 / zoom, p.y + 6 / zoom);
      }
    }
  }
}

function drawCellBase(q, r) {
  drawCombatCellBase(ctx, q, r, getCell(q, r));
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
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
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
//  DM Layer / Fog / BackgroundMap Rendering
// ============================================================
function drawCombatAccents() {
  const W = canvas.width, H = canvas.height;
  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getCell(q, r);
      if (!h) continue;
      const p = cellToPixel(q, r);
      const half = CELL_SIZE / 2;
      if (h.terrain === 'wall_cell' || h.terrain === 'cover_full' || h.terrain === 'pit' || h.terrain === 'hazard_fire' || h.terrain === 'hazard_acid') {
        ctx.save();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x - half + 2, p.y - half + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.restore();
      }
    }
  }
}

function drawBackgroundMap() {
  if (!backgroundMap || !backgroundMap.imgData) return;
  const bm = backgroundMap;
  const wPx = bm.cols * CELL_SIZE;
  const hPx = bm.rows * CELL_SIZE;
  ctx.save();
  // 对齐模式下以全不透明度显示，方便看清格线
  ctx.globalAlpha = _bgAlignRefs ? 1 : Math.max(0, Math.min(1, bm.opacity ?? 1));
  if (bm.img && bm.img.complete) {
    ctx.drawImage(bm.img, bm.x * CELL_SIZE, bm.y * CELL_SIZE, wPx, hPx);
  } else {
    if (!bm.img && bm.imgData) {
      bm.img = new Image();
      bm.img.src = bm.imgData;
      bm.img.onload = () => render();
    }
    ctx.fillStyle = 'rgba(80,80,100,0.5)';
    ctx.fillRect(bm.x * CELL_SIZE, bm.y * CELL_SIZE, wPx, hPx);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(bm.x * CELL_SIZE, bm.y * CELL_SIZE, wPx, hPx);
  }
  // 非对齐模式下：淡淡的虚线外框，提示底图可在选择工具下直接拖动移动
  if (!_bgAlignRefs) {
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#9ad';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([5 / zoom, 4 / zoom]);
    ctx.strokeRect(bm.x * CELL_SIZE, bm.y * CELL_SIZE, wPx, hPx);
    ctx.setLineDash([]);
    ctx.globalAlpha = Math.max(0, Math.min(1, bm.opacity ?? 1));
  }
  // 底图对齐模式：绘制底图外框 + 手柄 + 参考点 + 对齐网格预览
  if (_bgAlignRefs) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([6 / zoom, 3 / zoom]);
    ctx.strokeRect(bm.x * CELL_SIZE, bm.y * CELL_SIZE, wPx, hPx);
    ctx.setLineDash([]);
    // 外框手柄
    ctx.fillStyle = '#4af';
    const hs = 8 / zoom;
    [[bm.x * CELL_SIZE, bm.y * CELL_SIZE], [(bm.x + bm.cols) * CELL_SIZE, bm.y * CELL_SIZE],
     [bm.x * CELL_SIZE, (bm.y + bm.rows) * CELL_SIZE], [(bm.x + bm.cols) * CELL_SIZE, (bm.y + bm.rows) * CELL_SIZE]].forEach(([px, py]) => {
       ctx.fillRect(px - hs / 2, py - hs / 2, hs, hs);
     });
    // 对齐后的网格实时预览（≥2 点时）
    previewBgAlignGrid();
    // 参考点十字线
    if (_bgAlignRefs.pts) {
      _bgAlignRefs.pts.forEach((pt, i) => {
        const wx = pt.world.x, wy = pt.world.y;
        const color = i === 0 ? '#f80' : (i === 1 ? '#ff0' : '#0ff');
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.moveTo(wx - CELL_SIZE * 3, wy); ctx.lineTo(wx + CELL_SIZE * 3, wy);
        ctx.moveTo(wx, wy - CELL_SIZE * 3); ctx.lineTo(wx, wy + CELL_SIZE * 3);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(wx, wy, 5 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }
    // 提示对齐状态
    const valid = (_bgAlignRefs.pts || []).length >= 2;
    const cells = (typeof bgAlignCells === 'function') ? bgAlignCells() : 1;
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.font = `bold 14px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const tip = valid
      ? '🎯 已采集 ' + _bgAlignRefs.pts.length + ' 个点（每格 ' + cells + ' 格）：点「完成」应用或继续调整'
      : '🎯 第 1 点：点底图上一个格线交点；第 2 点：同线向右 ' + cells + ' 格的交点；第 3 点：向下 ' + cells + ' 格的交点';
    const tw = ctx.measureText(tip).width + 20;
    ctx.fillRect(_bgAlignRefs.originX || 10, _bgAlignRefs.originY || 10, tw, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(tip, (_bgAlignRefs.originX || 10) + 10, (_bgAlignRefs.originY || 10) + 18);
    ctx.restore();
    // 注：ctx.restore 两次保持外层状态安全
    return;
  }
  ctx.restore();
}

// 对齐网格实时预览：基于已采集的参考点 + 映射快照算出预期网格并叠加显示
function previewBgAlignGrid() {
  if (!_bgAlignRefs || !backgroundMap) return;
  const pts = _bgAlignRefs.pts || [];
  const snap = _bgAlignRefs.snap;
  if (pts.length < 2 || !snap) return;
  const img = backgroundMap.img;
  if (!img || !img.naturalWidth) return;
  const CS = CELL_SIZE;
  const toImg = (wx, wy) => ({
    x: ((wx / CS - snap.x) / snap.cols) * img.naturalWidth,
    y: ((wy / CS - snap.y) / snap.rows) * img.naturalHeight
  });
  const cells = (typeof bgAlignCells === 'function') ? bgAlignCells() : 1;
  const i0 = toImg(pts[0].world.x, pts[0].world.y);
  const i1 = toImg(pts[1].world.x, pts[1].world.y);
  const hPx = Math.max(2, Math.abs(i1.x - i0.x) / cells);
  let vPx = hPx;
  if (pts.length >= 3) {
    const i2 = toImg(pts[2].world.x, pts[2].world.y);
    vPx = Math.max(2, Math.abs(i2.y - i0.y) / cells);
  }
  const cols = img.naturalWidth / hPx, rows = img.naturalHeight / vPx;
  const t0x = Math.round(pts[0].world.x / CS), t0y = Math.round(pts[0].world.y / CS);
  const bx = t0x - i0.x / hPx, by = t0y - i0.y / vPx;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,160,255,0.32)';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  const maxLines = 400;
  const xStep = cols > maxLines ? Math.ceil(cols / maxLines) : 1;
  const yStep = rows > maxLines ? Math.ceil(rows / maxLines) : 1;
  for (let i = 0; i <= cols; i += xStep) {
    const x = (bx + i) * CS;
    ctx.moveTo(x, by * CS); ctx.lineTo(x, (by + rows) * CS);
  }
  for (let j = 0; j <= rows; j += yStep) {
    const y = (by + j) * CS;
    ctx.moveTo(bx * CS, y); ctx.lineTo((bx + cols) * CS, y);
  }
  ctx.stroke();
  // 基准交点高亮
  ctx.fillStyle = 'rgba(0,200,255,0.75)';
  ctx.fillRect(t0x * CS - 4 / zoom, t0y * CS - 4 / zoom, 8 / zoom, 8 / zoom);
  ctx.restore();
}

function drawDmOverlay() {
  const visible = visibleKeysFromDict(dmData);
  for (const key of visible) {
    const [q, r] = key.split(',').map(Number);
    const d = dmData[key];
    if (!d) continue;
    const p = cellToPixel(q, r);
    const half = CELL_SIZE / 2;

    // 半透明紫色底纹，表示这是 DM 隐藏信息
    ctx.fillStyle = 'rgba(180, 60, 220, 0.18)';
    ctx.fillRect(p.x - half, p.y - half, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = 'rgba(180, 60, 220, 0.55)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.strokeRect(p.x - half + 1 / zoom, p.y - half + 1 / zoom, CELL_SIZE - 2 / zoom, CELL_SIZE - 2 / zoom);
    ctx.setLineDash([]);

    if (d.mark) {
      ctx.font = `bold ${Math.max(12, CELL_SIZE * 0.4)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e0b0ff';
      ctx.fillText(d.mark, p.x, p.y - (d.label ? CELL_SIZE * 0.15 : 0));
    }
    if (d.label) {
      ctx.font = `bold ${Math.max(9, CELL_SIZE * 0.24)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const tw = ctx.measureText(d.label).width;
      const lh = CELL_SIZE * 0.28;
      const by = p.y - CELL_SIZE * 0.38;
      ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
      ctx.fillRect(p.x - tw / 2 - 3, by, tw + 6, lh);
      ctx.fillStyle = '#e0b0ff';
      ctx.fillText(d.label, p.x, by + lh - 1);
    }
  }
}

function drawFogOverlay() {
  const W = canvas.width, H = canvas.height;
  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 1, qMax = Math.ceil(botRight.q) + 1;
  const rMin = Math.floor(topLeft.r) - 1, rMax = Math.ceil(botRight.r) + 1;

  // P0 动态视野：玩家视图下按单位视野自动揭示；否则（DM 视图 / 手动模式）用手动战雾
  const hasVision = tokens.some(t => t.visionSource && (t.sightRadius || 0) > 0);
  const autoMask = visionMode === 'auto' && viewRoleIsPlayer() && hasVision;
  const vis = autoMask ? computeVisibleCells() : null;

  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      if (autoMask) {
        if (vis.has(cellKey(q, r))) continue; // 玩家可见，不遮
      } else {
        if (!isFogCell(q, r)) continue;
      }
      ctx.fillStyle = 'rgba(12, 12, 20, 0.82)';
      ctx.fillRect(q * CELL_SIZE - CELL_SIZE / 2, r * CELL_SIZE - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(q * CELL_SIZE - CELL_SIZE / 2, r * CELL_SIZE - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    }
  }
}

function visibleKeysFromDict(dict) {
  const keys = Object.keys(dict || {});
  if (!keys.length) return [];
  const W = canvas.width, H = canvas.height;
  const margin = CELL_SIZE * 2;
  const topLeft = pixelToCell((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToCell((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q) - 2, qMax = Math.ceil(botRight.q) + 2;
  const rMin = Math.floor(topLeft.r) - 2, rMax = Math.ceil(botRight.r) + 2;
  return keys.filter(key => {
    const [q, r] = key.split(',').map(Number);
    return q >= qMin && q <= qMax && r >= rMin && r <= rMax;
  });
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
function shapeBox(sh) {
  if (sh.type === 'cone') return coneBounds(sh);
  return {
    x0: sh.x * CELL_SIZE, y0: sh.y * CELL_SIZE,
    x1: (sh.x + (sh.w || 0)) * CELL_SIZE, y1: (sh.y + (sh.h || 0)) * CELL_SIZE
  };
}
function hitTestShape(wx, wy) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const sh = shapes[i];
    const b = shapeBox(sh);
    if (wx >= b.x0 && wx <= b.x1 && wy >= b.y0 && wy <= b.y1) return sh;
  }
  return null;
}

// 锥形包围盒（世界像素）：按 方向±半角 与 长度 求三个角的包围盒
function coneBounds(sh) {
  const len = (sh.length || 3) * CELL_SIZE, half = sh.spread || 0.5, a = sh.angle || 0;
  const ox = sh.x * CELL_SIZE, oy = sh.y * CELL_SIZE;
  let minX = ox, maxX = ox, minY = oy, maxY = oy;
  for (const ang of [a - half, a, a + half]) {
    const x = ox + Math.cos(ang) * len, y = oy + Math.sin(ang) * len;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { x0: minX, y0: minY, x1: maxX, y1: maxY };
}

// 命中 shape 缩放手柄（需已选中；锥形不支持手柄，右键改属性）
const SHAPE_HANDLES = ['nw','n','ne','e','se','s','sw','w'];
function shapeHandleAt(wx, wy) {
  const sh = shapes.find(s => s.id === selectedShape);
  if (!sh) return null;
  if (sh.type === 'cone') return null;
  const b = shapeBox(sh);
  const x0 = b.x0, y0 = b.y0, x1 = b.x1, y1 = b.y1;
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

// 命中底图范围（世界坐标）
function hitTestBackground(wx, wy) {
  if (!backgroundMap) return false;
  const bm = backgroundMap;
  return wx >= bm.x * CELL_SIZE && wx <= (bm.x + bm.cols) * CELL_SIZE &&
         wy >= bm.y * CELL_SIZE && wy <= (bm.y + bm.rows) * CELL_SIZE;
}

// 框选相交判定：token 包围盒（格单位）与框选盒（格单位）是否重叠
function tokenRectOverlap(t, box) {
  return t.x < box.x + box.w && t.x + t.w > box.x &&
         t.y < box.y + box.h && t.y + t.h > box.y;
}

// ============================================================
