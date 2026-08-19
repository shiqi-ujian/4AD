//  Input Handling
// ============================================================
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  if (e.button === 2) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, mx, my);
    return;
  }

  if (e.button === 0) {
    const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;

    // --- 选择工具：单位/图形/线段优先 ---
    if (selectedTool === 'select') {
      // 单位缩放手柄
      const th = tokenHandleAt(wx, wy);
      if (th) {
        _dragMode = 'token-resize'; _dragTokenId = selectedToken; _dragHandle = th;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        return;
      }
      // 单位主体（最顶层优先）
      const tk = hitTestToken(wx, wy);
      if (tk) {
        selectedToken = tk.id; selectedShape = null; selectedLine = null; selectedCell = null;
        _dragMode = 'token-move'; _dragTokenId = tk.id;
        _dragOffX = wx - tk.x * CELL_SIZE; _dragOffY = wy - tk.y * CELL_SIZE;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        render(); updateInfo();
        return;
      }
      // 选中图形的缩放手柄
      const handle = shapeHandleAt(wx, wy);
      if (handle) {
        _dragMode = 'shape-resize'; _dragShapeId = selectedShape; _dragHandle = handle;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        return;
      }
      // 线段端点
      const endHit = lineEndAt(wx, wy);
      if (endHit) {
        _dragMode = 'line-drag'; _dragLineId = selectedLine; _dragHandle = endHit;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        return;
      }
      // 图形主体（顶层优先）
      const sh = hitTestShape(wx, wy);
      if (sh) {
        selectedShape = sh.id; selectedLine = null; selectedCell = null;
        _dragMode = 'shape-move'; _dragShapeId = sh.id;
        _dragOffX = wx - sh.x * CELL_SIZE; _dragOffY = wy - sh.y * CELL_SIZE;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        render(); updateInfo();
        return;
      }
      // 线段主体
      const ln = hitTestLine(wx, wy);
      if (ln) {
        selectedLine = ln.id; selectedShape = null; selectedCell = null;
        _dragMode = 'line-move'; _dragLineId = ln.id;
        _lineInit = { x1: ln.x1, y1: ln.y1, x2: ln.x2, y2: ln.y2 };
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        render(); updateInfo();
        return;
      }
      selectedShape = null; selectedLine = null;
    }

    // --- 墙/门：点击 toggle + 拖拽连续绘制 ---
    if (selectedTool === 'wall' || selectedTool === 'door') {
      const edge = getEdgeAtPixel(mx, my);
      if (edge) {
        handleEdgeClick(edge);
        _dragMode = 'wall-drag';
        _wallDragLast = `${edge.q},${edge.r},${edge.edge}`;
        isDragging = true;
        beginBatch();
        return;
      }
      // 未命中边缘：平移
      isDragging = true;
      _dragMode = 'pan';
      dragStartX = mx; dragStartY = my;
      viewStartX = viewX; viewStartY = viewY;
      return;
    }

    // --- 区域矩形：拖拽绘制 ---
    if (selectedTool === 'rect') {
      const c = pixelToCell(wx, wy);
      _drawStart = { x: wx / CELL_SIZE, y: wy / CELL_SIZE };
      _dragMode = 'rect-draw';
      isDragging = true;
      return;
    }

    // --- 自由线段：拖拽绘制 ---
    if (selectedTool === 'line') {
      _drawStart = { x: wx / CELL_SIZE, y: wy / CELL_SIZE };
      _dragMode = 'line-draw';
      isDragging = true;
      return;
    }

    // --- 单位 token：点击放置 ---
    if (selectedTool === 'unit') {
      if (_unitPending) {
        const c = pixelToCell(wx, wy);
        const t = {
          id: 'tk' + (_tokenSeq++),
          kind: _unitPending.kind || 'npc',
          name: _unitPending.name || '',
          x: c.q - _unitPending.w / 2, y: c.r - _unitPending.h / 2,
          w: _unitPending.w, h: _unitPending.h,
          icon: _unitPending.icon || '🧝',
          color: _unitPending.color || '#3a7abd',
          hp: _unitPending.hp, maxHp: _unitPending.maxHp,
          status: _unitPending.status || [],
          imgData: _unitPending.imgData || '', img: _unitPending.img || null,
          ownerId: ''
        };
        pushUndoMeta();
        tokens.push(t);
        selectedToken = t.id; selectedShape = null; selectedLine = null; selectedCell = null;
        render(); updateInfo();
        showToast(`🧝 已放置 ${t.name || '单位'}，右键编辑属性`);
        return;
      }
      return;
    }

    // --- 图片 token：点击放置 ---
    if (selectedTool === 'token') {
      if (_tokenPending) {
        const c = pixelToCell(wx, wy);
        const sh = {
          id: 'sh' + (_shapeSeq++), type: 'image',
          x: c.q - _tokenPending.w / 2, y: c.r - _tokenPending.h / 2,
          w: _tokenPending.w, h: _tokenPending.h,
          imgData: _tokenPending.imgData, img: _tokenPending.img,
          stroke: '#fff', strokeWidth: 2, dash: false, name: ''
        };
        pushUndoMeta();
        shapes.push(sh);
        selectedShape = sh.id; selectedLine = null; selectedCell = null;
        render(); updateInfo();
        showToast(`🖼️ 已放置图片，拖动/缩放调整`);
        return;
      }
      return;
    }

    const cell = cellAtPixel(mx, my);
    if (cell) {
      handleCellClick(cell.q, cell.r, e);
      if (selectedTool === 'paint' || selectedTool === 'erase') {
        _dragMode = selectedTool;
        isDragging = true;
        dragStartX = mx; dragStartY = my;
      }
      if (selectedTool === 'select') {
        _dragMode = 'pan';
        isDragging = true;
        dragStartX = mx; dragStartY = my;
        viewStartX = viewX; viewStartY = viewY;
      }
      return;
    }

    _dragMode = 'pan';
    isDragging = true;
    dragStartX = mx; dragStartY = my;
    viewStartX = viewX; viewStartY = viewY;
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;

  // token 放置预览跟随（单位）
  if (selectedTool === 'unit' && _unitPending) {
    const c = pixelToCell(wx, wy);
    _hoverUnit = c;
    render();
  }

  // token 放置预览跟随
  if (selectedTool === 'token' && _tokenPending) {
    const c = pixelToCell(wx, wy);
    _hoverToken = c;
    render();
  }

  if (!isDragging) {
    // 悬停光标反馈
    if (selectedTool === 'select') {
      const th = tokenHandleAt(wx, wy);
      const h = shapeHandleAt(wx, wy);
      const end = lineEndAt(wx, wy);
      if (th) {
        canvas.style.cursor = 'nwse-resize';
      } else if (h) {
        const diag1 = (h === 'nw' || h === 'se');
        const diag2 = (h === 'ne' || h === 'sw');
        canvas.style.cursor = diag1 ? 'nwse-resize' : diag2 ? 'nesw-resize' : (h === 'n' || h === 's') ? 'ns-resize' : 'ew-resize';
      } else if (end) {
        canvas.style.cursor = 'crosshair';
      } else if (hitTestToken(wx, wy) || hitTestShape(wx, wy) || hitTestLine(wx, wy)) {
        canvas.style.cursor = 'move';
      } else {
        canvas.style.cursor = 'default';
      }
    }
    return;
  }

  if (_dragMode === 'paint') {
    const cell = cellAtPixel(mx, my);
    if (cell) {
      const k = cellKey(cell.q, cell.r);
      const h = getCell(cell.q, cell.r);
      if (h.terrain !== selectedTerrain) {
        setCell(cell.q, cell.r, { terrain: selectedTerrain });
        render();
      }
    }
  } else if (_dragMode === 'erase') {
    const cell = cellAtPixel(mx, my);
    if (cell) {
      const k = cellKey(cell.q, cell.r);
      if (_eraseDragLast.has(k)) return;
      _eraseDragLast.add(k);
      const mode = document.getElementById('erase-mode').value;
      if (mode === 'all') {
        setCell(cell.q, cell.r, { terrain: null, label: '', walls: [0,0,0,0] });
      } else if (mode === 'terrain') {
        setCell(cell.q, cell.r, { terrain: null });
      } else if (mode === 'walls') {
        const cur = getCell(cell.q, cell.r);
        for (let i = 0; i < 4; i++) {
          if (cur.walls[i] !== 0) setWall(cell.q, cell.r, i, 0);
        }
      } else if (mode === 'label') {
        setCell(cell.q, cell.r, { label: '' });
      }
      render();
    }
  } else if (_dragMode === 'wall-drag') {
    const edge = getEdgeAtPixel(mx, my);
    if (edge) {
      const ek = `${edge.q},${edge.r},${edge.edge}`;
      if (ek !== _wallDragLast) {
        _wallDragLast = ek;
        // 拖拽放置（不 toggle）：目标值 = 已有同类型则跳过，不同类型则替换
        const cur = getCell(edge.q, edge.r).walls[edge.edge];
        const target = selectedTool === 'wall' ? 1 : 2;
        if (cur !== target) setWall(edge.q, edge.r, edge.edge, target);
        render();
      }
    }
  } else if (_dragMode === 'token-move') {
    const t = tokens.find(x => x.id === _dragTokenId);
    if (t) {
      t.x = (wx - _dragOffX) / CELL_SIZE;
      t.y = (wy - _dragOffY) / CELL_SIZE;
      render();
    }
  } else if (_dragMode === 'token-resize') {
    const t = tokens.find(x => x.id === _dragTokenId);
    if (t) {
      const x0 = t.x * CELL_SIZE, y0 = t.y * CELL_SIZE;
      const x1 = (t.x + t.w) * CELL_SIZE, y1 = (t.y + t.h) * CELL_SIZE;
      let nx0 = x0, ny0 = y0, nx1 = x1, ny1 = y1;
      const h = _dragHandle;
      if (h.includes('w')) nx0 = Math.min(wx, x1 - CELL_SIZE * 0.5);
      if (h.includes('e')) nx1 = Math.max(wx, x0 + CELL_SIZE * 0.5);
      if (h.includes('n')) ny0 = Math.min(wy, y1 - CELL_SIZE * 0.5);
      if (h.includes('s')) ny1 = Math.max(wy, y0 + CELL_SIZE * 0.5);
      t.x = nx0 / CELL_SIZE; t.y = ny0 / CELL_SIZE;
      t.w = (nx1 - nx0) / CELL_SIZE; t.h = (ny1 - ny0) / CELL_SIZE;
      render();
    }
  } else if (_dragMode === 'shape-move') {
    const sh = shapes.find(s => s.id === _dragShapeId);
    if (sh) {
      sh.x = (wx - _dragOffX) / CELL_SIZE;
      sh.y = (wy - _dragOffY) / CELL_SIZE;
      render();
    }
  } else if (_dragMode === 'shape-resize') {
    const sh = shapes.find(s => s.id === _dragShapeId);
    if (sh) {
      const x0 = sh.x * CELL_SIZE, y0 = sh.y * CELL_SIZE;
      const x1 = (sh.x + sh.w) * CELL_SIZE, y1 = (sh.y + sh.h) * CELL_SIZE;
      let nx0 = x0, ny0 = y0, nx1 = x1, ny1 = y1;
      const h = _dragHandle;
      if (h.includes('w')) nx0 = Math.min(wx, x1 - CELL_SIZE * 0.2);
      if (h.includes('e')) nx1 = Math.max(wx, x0 + CELL_SIZE * 0.2);
      if (h.includes('n')) ny0 = Math.min(wy, y1 - CELL_SIZE * 0.2);
      if (h.includes('s')) ny1 = Math.max(wy, y0 + CELL_SIZE * 0.2);
      sh.x = nx0 / CELL_SIZE; sh.y = ny0 / CELL_SIZE;
      sh.w = (nx1 - nx0) / CELL_SIZE; sh.h = (ny1 - ny0) / CELL_SIZE;
      render();
    }
  } else if (_dragMode === 'line-move') {
    const ln = freeLines.find(l => l.id === _dragLineId);
    if (ln) {
      const dx = (wx - dragStartX) / CELL_SIZE, dy = (wy - dragStartY) / CELL_SIZE;
      const ox = ln.x1 - dx, oy = ln.y1 - dy;
      // 用初始位置计算
      ln.x1 = _lineInit.x1 + dx; ln.y1 = _lineInit.y1 + dy;
      ln.x2 = _lineInit.x2 + dx; ln.y2 = _lineInit.y2 + dy;
      render();
    }
  } else if (_dragMode === 'line-drag') {
    const ln = freeLines.find(l => l.id === _dragLineId);
    if (ln) {
      if (_dragHandle === 'start') { ln.x1 = wx / CELL_SIZE; ln.y1 = wy / CELL_SIZE; }
      else { ln.x2 = wx / CELL_SIZE; ln.y2 = wy / CELL_SIZE; }
      render();
    }
  } else if (_dragMode === 'rect-draw') {
    const sx = _drawStart.x, sy = _drawStart.y;
    const cx = wx / CELL_SIZE, cy = wy / CELL_SIZE;
    _rectPreview = {
      x: Math.min(sx, cx), y: Math.min(sy, cy),
      w: Math.abs(cx - sx), h: Math.abs(cy - sy)
    };
    render();
  } else if (_dragMode === 'line-draw') {
    _linePreview = {
      x1: _drawStart.x, y1: _drawStart.y,
      x2: wx / CELL_SIZE, y2: wy / CELL_SIZE
    };
    render();
  } else if (_dragMode === 'pan') {
    viewX = viewStartX + (mx - dragStartX);
    viewY = viewStartY + (my - dragStartY);
    render();
  }
});

canvas.addEventListener('mouseup', () => {
  if (_dragMode === 'wall-drag') endBatch();

  if (_dragMode === 'rect-draw' && _rectPreview && (_rectPreview.w > 0.15 || _rectPreview.h > 0.15)) {
    const sh = {
      id: 'sh' + (_shapeSeq++), type: 'rect',
      x: _rectPreview.x, y: _rectPreview.y,
      w: Math.max(_rectPreview.w, 0.2), h: Math.max(_rectPreview.h, 0.2),
      fill: '#e94560', fillAlpha: 0.4,
      stroke: '#ffffff', strokeWidth: 2, dash: false, name: ''
    };
    pushUndoMeta();
    shapes.push(sh);
    selectedShape = sh.id; selectedLine = null; selectedCell = null;
    showToast('▭ 已创建区域，可在"选择"工具下拖动/缩放，右键或双击改属性');
  }
  _rectPreview = null;

  if (_dragMode === 'line-draw' && _linePreview) {
    const dx = _linePreview.x2 - _linePreview.x1, dy = _linePreview.y2 - _linePreview.y1;
    if (Math.hypot(dx, dy) > 0.1) {
      const ln = {
        id: 'ln' + (_lineSeq++),
        x1: _linePreview.x1, y1: _linePreview.y1,
        x2: _linePreview.x2, y2: _linePreview.y2,
        color: '#000000', width: 3, dash: false, name: ''
      };
      pushUndoMeta();
      freeLines.push(ln);
      selectedLine = ln.id; selectedShape = null; selectedCell = null;
      showToast('📏 已创建线段，右键改颜色/线宽/虚线');
    }
  }
  _linePreview = null;

  isDragging = false;
  _dragMode = null;
  _dragShapeId = null; _dragHandle = null; _dragLineId = null; _dragTokenId = null;
  _dragTokenId = null;
  _wallDragLast = null;
  _eraseDragLast = new Set();
  render();
  updateInfo();
});

canvas.addEventListener('mouseleave', () => {
  if (_dragMode === 'wall-drag') endBatch();
  isDragging = false;
  _dragMode = null;
  _rectPreview = null;
  _linePreview = null;
  _wallDragLast = null;
  _eraseDragLast = new Set();
  render();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.15, Math.min(5, zoom * delta));
  viewX = mx - (mx - viewX) * (newZoom / zoom);
  viewY = my - (my - viewY) * (newZoom / zoom);
  zoom = newZoom;
  document.getElementById('zoom-indicator').textContent = `🔍 ${Math.round(zoom * 100)}%`;
  render();
});

// Touch support
let touchDist = 0;
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.touches[0].clientX - rect.left;
    const my = e.touches[0].clientY - rect.top;
    // 单位放置（触摸）
    if (selectedTool === 'unit' && _unitPending) {
      const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;
      const c = pixelToCell(wx, wy);
      const t = {
        id: 'tk' + (_tokenSeq++),
        kind: _unitPending.kind || 'npc',
        name: _unitPending.name || '',
        x: c.q - _unitPending.w / 2, y: c.r - _unitPending.h / 2,
        w: _unitPending.w, h: _unitPending.h,
        icon: _unitPending.icon || '🧝',
        color: _unitPending.color || '#3a7abd',
        hp: _unitPending.hp, maxHp: _unitPending.maxHp,
        status: _unitPending.status || [],
        imgData: _unitPending.imgData || '', img: _unitPending.img || null,
        ownerId: ''
      };
      pushUndoMeta();
      tokens.push(t);
      selectedToken = t.id; selectedShape = null; selectedLine = null; selectedCell = null;
      render(); updateInfo();
      return;
    }
    // 图片放置（触摸）
    if (selectedTool === 'token' && _tokenPending) {
      const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;
      const c = pixelToCell(wx, wy);
      const sh = {
        id: 'sh' + (_shapeSeq++), type: 'image',
        x: c.q - _tokenPending.w / 2, y: c.r - _tokenPending.h / 2,
        w: _tokenPending.w, h: _tokenPending.h,
        imgData: _tokenPending.imgData, img: _tokenPending.img,
        stroke: '#fff', strokeWidth: 2, dash: false, name: ''
      };
      pushUndoMeta();
      shapes.push(sh);
      selectedShape = sh.id; selectedLine = null; selectedCell = null;
      render(); updateInfo();
      return;
    }
    const cell = cellAtPixel(mx, my);
    if (cell) { handleCellClick(cell.q, cell.r, {}); isDragging = false; return; }
    isDragging = true;
    dragStartX = mx; dragStartY = my;
    viewStartX = viewX; viewStartY = viewY;
  } else if (e.touches.length === 2) {
    touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 1 && isDragging) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.touches[0].clientX - rect.left;
    const my = e.touches[0].clientY - rect.top;
    viewX = viewStartX + (mx - dragStartX);
    viewY = viewStartY + (my - dragStartY);
    render();
  } else if (e.touches.length === 2) {
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const scale = dist / touchDist;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    const newZoom = Math.max(0.15, Math.min(5, zoom * scale));
    viewX = mx - (mx - viewX) * (newZoom / zoom);
    viewY = my - (my - viewY) * (newZoom / zoom);
    zoom = newZoom;
    document.getElementById('zoom-indicator').textContent = `🔍 ${Math.round(zoom * 100)}%`;
    touchDist = dist;
    render();
  }
}, { passive: false });

canvas.addEventListener('touchend', () => { isDragging = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 双击：编辑选中的图形/线段属性
canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;
  const tk = hitTestToken(wx, wy);
  if (tk) { openUnitModal(tk); return; }
  const sh = hitTestShape(wx, wy);
  if (sh) { openShapeModal(sh.id); return; }
  const ln = hitTestLine(wx, wy);
  if (ln) { openLineModal(ln.id); return; }
});

// ============================================================
//  Cell Click Handler
// ============================================================
function handleCellClick(q, r, e) {
  selectedCell = { q, r };

  if (selectedTool === 'paint') {
    setCell(q, r, { terrain: selectedTerrain });
    render();
    updateInfo();
  } else if (selectedTool === 'label') {
    showLabelDialog(q, r);
  } else if (selectedTool === 'erase') {
    const mode = document.getElementById('erase-mode').value;
    if (mode === 'all') {
      setCell(q, r, { terrain: null, label: '', walls: [0,0,0,0] });
    } else if (mode === 'terrain') {
      setCell(q, r, { terrain: null });
    } else if (mode === 'walls') {
      const cur = getCell(q, r);
      for (let i = 0; i < 4; i++) {
        if (cur.walls[i] !== 0) setWall(q, r, i, 0);
      }
    } else if (mode === 'label') {
      setCell(q, r, { label: '' });
    }
    render();
    updateInfo();
  } else {
    // Select
    updateInfo();
    render();
  }
}

function handleEdgeClick(edgeInfo) {
  const { q, r, edge } = edgeInfo;
  const currentState = getCell(q, r).walls[edge];
  const hint = document.getElementById('tool-hint');

  if (selectedTool === 'wall') {
    if (currentState === 0) {
      setWall(q, r, edge, 1);
      hint.innerHTML = '🧱 已放置墙壁';
    } else if (currentState === 1) {
      setWall(q, r, edge, 0);
      hint.innerHTML = '🧱 已移除墙壁';
    } else if (currentState === 2) {
      setWall(q, r, edge, 1);
      hint.innerHTML = '🧱 门已替换为墙壁';
    }
  } else if (selectedTool === 'door') {
    if (currentState === 0) {
      setWall(q, r, edge, 2);
      hint.innerHTML = '🚪 已放置门';
    } else if (currentState === 2) {
      setWall(q, r, edge, 0);
      hint.innerHTML = '🚪 已移除门';
    } else if (currentState === 1) {
      setWall(q, r, edge, 2);
      hint.innerHTML = '🚪 墙壁已替换为门';
    }
  }
  render();
  updateInfo();
}

// ============================================================
//  Context Menu
// ============================================================
function showContextMenu(cx, cy, mx, my) {
  const cell = cellAtPixel(mx, my);
  const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;
  const tkHit = hitTestToken(wx, wy);
  const shHit = hitTestShape(wx, wy);
  const lnHit = hitTestLine(wx, wy);
  if (!cell && !tkHit && !shHit && !lnHit) return;

  // Simple inline context menu using a floating div
  let menu = document.getElementById('ctx-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'ctx-menu';
    menu.style.cssText = 'display:none;position:fixed;z-index:50;background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:4px 0;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
    document.body.appendChild(menu);
  }
  menu.innerHTML = '';
  menu.style.display = 'block';
  menu.style.left = cx + 'px';
  menu.style.top = cy + 'px';

  const closeMenu = () => { menu.style.display = 'none'; };

  const addItem = (text, action) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = 'display:block;width:100%;padding:6px 14px;background:none;border:none;color:#e0e0e0;cursor:pointer;font-size:12px;text-align:left;white-space:nowrap;';
    btn.addEventListener('mouseenter', () => btn.style.background = '#0f3460');
    btn.addEventListener('mouseleave', () => btn.style.background = 'none');
    btn.addEventListener('click', () => { action(); closeMenu(); });
    menu.appendChild(btn);
  };

  const sep = () => {
    const d = document.createElement('div');
    d.style.cssText = 'height:1px;background:#0f3460;margin:3px 8px;';
    menu.appendChild(d);
  };

  // 单位操作（若命中，优先于图形/格子菜单）
  if (tkHit) {
    selectedToken = tkHit.id; selectedShape = null; selectedLine = null; selectedCell = null;
    render(); updateInfo();
    addItem('🧝 编辑单位属性', () => { openUnitModal(tkHit); });
    addItem('🗑️ 删除单位', () => {
      pushUndoMeta();
      tokens = tokens.filter(x => x.id !== tkHit.id);
      if (selectedToken === tkHit.id) selectedToken = null;
      render(); updateInfo();
    });
    sep();
  }
  // 图形操作（若命中，优先于格子菜单）
  if (shHit) {
    selectedShape = shHit.id; selectedLine = null; selectedCell = null;
    render(); updateInfo();
    addItem('▭ 编辑图形属性', () => { openShapeModal(shHit.id); });
    addItem('🗑️ 删除图形', () => {
      pushUndoMeta();
      shapes = shapes.filter(s => s.id !== shHit.id);
      if (selectedShape === shHit.id) selectedShape = null;
      render(); updateInfo();
    });
    sep();
  }
  if (lnHit) {
    selectedLine = lnHit.id; selectedShape = null; selectedCell = null;
    render(); updateInfo();
    addItem('📏 编辑线段属性', () => { openLineModal(lnHit.id); });
    addItem('🗑️ 删除线段', () => {
      pushUndoMeta();
      freeLines = freeLines.filter(l => l.id !== lnHit.id);
      if (selectedLine === lnHit.id) selectedLine = null;
      render(); updateInfo();
    });
    sep();
  }

  // 格子操作
  if (cell) {
    addItem(`📍 选中 (${cell.q}, ${cell.r})`, () => { selectedCell = cell; updateInfo(); render(); });
    sep();

    // Terrain submenu
    getTerrainList().forEach(id => {
      const t = getTerrain(id);
      addItem(`${t.icon} 设为${t.name}`, () => { setCell(cell.q, cell.r, { terrain: id }); render(); updateInfo(); });
    });

    sep();
    addItem('🏷️ 添加标签', () => { selectedCell = cell; showLabelDialog(cell.q, cell.r); render(); });
    addItem('🧹 清除格子', () => { setCell(cell.q, cell.r, { terrain: null, label: '', walls: [0,0,0,0] }); render(); updateInfo(); });
  }

  const closeHandler = (e) => {
    if (!menu.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', closeHandler); }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

// ============================================================
