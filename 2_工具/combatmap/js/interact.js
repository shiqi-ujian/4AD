//  Input Handling
// ============================================================
// 平移：按住空格 + 左键拖拽，或中键拖拽（任意工具）
let panKey = false;
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) panKey = true; });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') panKey = false; });

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  if (e.button === 2) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, mx, my);
    return;
  }

  // 中键 或 按住空格+左键 = 平移（不干扰选择/绘制）
  if (e.button === 1 || (e.button === 0 && panKey)) {
    e.preventDefault();
    _dragMode = 'pan';
    dragStartX = mx; dragStartY = my;
    viewStartX = viewX; viewStartY = viewY;
    isDragging = true;
    return;
  }

  if (e.button === 0) {
    const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;

    // --- 底图对齐模式：点击采集参考点 / 拖拽底图 / 缩放手柄 ---
    if (_bgAlignRefs) {
      if (!backgroundMap) { _bgAlignRefs = null; render(); }
      else {
        const bm = backgroundMap;
        const x0 = bm.x * CELL_SIZE, y0 = bm.y * CELL_SIZE;
        const x1 = (bm.x + bm.cols) * CELL_SIZE, y1 = (bm.y + bm.rows) * CELL_SIZE;
        const hs = 10 / zoom;
        if (Math.abs(wx - x1) <= hs && Math.abs(wy - y1) <= hs) {
          _bgDragMode = 'bg-resize-corner'; dragStartX = wx; dragStartY = wy; isDragging = true;
          return;
        }
        if (Math.abs(wx - x0) <= hs && Math.abs(wy - y0) <= hs) {
          _bgDragMode = 'bg-move'; _dragOffX = wx - x0; _dragOffY = wy - y0; isDragging = true;
          return;
        }
        if (Math.abs(wx - x1) <= hs && Math.abs(wy - y0) <= hs) {
          _bgDragMode = 'bg-resize-e'; dragStartX = wx; dragStartY = wy; isDragging = true;
          return;
        }
        if (Math.abs(wx - x0) <= hs && Math.abs(wy - y1) <= hs) {
          _bgDragMode = 'bg-resize-s'; dragStartX = wx; dragStartY = wy; isDragging = true;
          return;
        }
        // 点击采集参考点
        _bgAlignRefs.pts = _bgAlignRefs.pts || [];
        if (_bgAlignRefs.pts.length < 3) {
          _bgAlignRefs.pts.push({
            world: { x: wx, y: wy },
            snappedGrid: pixelToCell(wx, wy),
            originX: e.clientX - rect.left,
            originY: e.clientY - rect.top
          });
          render();
          if (typeof updateBgAlignBar === 'function') updateBgAlignBar();
          // 不再自动完成，等用户点“完成”
        }
        return;
      }
    }

    // --- 移动/平移工具：左键拖拽即移动整张地图（v0.101 按钮已并入「选择」，仅存 H 快捷键兜底） ---
    if (selectedTool === 'pan') {
      _dragMode = 'pan';
      dragStartX = mx; dragStartY = my;
      viewStartX = viewX; viewStartY = viewY;
      isDragging = true;
      return;
    }

    // --- 框选工具（v0.101 独立按钮，对齐六角格 select-rect）：拖拽框选多个单位 ---
    if (selectedTool === 'marquee') {
      const overBg = backgroundMap && !_bgAlignRefs && hitTestBackground(wx, wy);
      _marqueeStart = { wx, wy, shift: !!(e.shiftKey || e.ctrlKey || e.metaKey), overBg };
      _dragMode = 'marquee';
      isDragging = true; dragStartX = mx; dragStartY = my;
      return;
    }

    // --- 选择工具：单位/图形/线段/底图/平移优先（框选已独立为「框选」按钮） ---
    if (selectedTool === 'select') {
      // 单位缩放手柄
      const th = tokenHandleAt(wx, wy);
      if (th) {
        const tSel = tokens.find(x => x.id === selectedToken);
        if (inOnlinePlayerMode() && tSel && !canEditToken(tSel)) return; // 非自己的 token 不可缩放
        _dragMode = 'token-resize'; _dragTokenId = selectedToken; _dragHandle = th;
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        return;
      }
      // 单位主体（最顶层优先）
      const tk = hitTestToken(wx, wy);
      if (tk) {
        // Shift/Ctrl 点选切换多选；切换时不立即拖动，方便继续点选
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          if (selectedTokens.has(tk.id)) {
            selectedTokens.delete(tk.id);
            selectedToken = selectedTokens.size ? Array.from(selectedTokens).pop() : null;
          } else {
            selectedToken = tk.id;
            selectedTokens.add(tk.id);
          }
          selectedShape = null; selectedLine = null; selectedCell = null; selectedBackground = false;
          render(); updateInfo();
          return;
        }
        selectedToken = tk.id; selectedShape = null; selectedLine = null; selectedCell = null; selectedBackground = false;
        selectedTokens.add(tk.id);
        // 玩家可视但只读：非自己 token 只选中、不进入拖动
        if (inOnlinePlayerMode() && !canEditToken(tk)) { render(); updateInfo(); return; }
        const dragIds = tokenDragIds(tk.id);
        _selDragOff = new Map();
        for (const id of dragIds) {
          const tt = tokens.find(x => x.id === id);
          if (tt) _selDragOff.set(id, { offX: wx - tt.x * CELL_SIZE, offY: wy - tt.y * CELL_SIZE, nx: tt.x, ny: tt.y });
        }
        _dragMode = 'token-move'; _dragTokenId = tk.id;
        dragStartX = wx; dragStartY = wy;
        isDragging = true;
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
        selectedToken = null; selectedTokens = new Set(); selectedBackground = false;
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
        selectedToken = null; selectedTokens = new Set(); selectedBackground = false;
        _dragMode = 'line-move'; _dragLineId = ln.id;
        _lineInit = { x1: ln.x1, y1: ln.y1, x2: ln.x2, y2: ln.y2 };
        isDragging = true; dragStartX = wx; dragStartY = wy;
        pushUndoMeta();
        render(); updateInfo();
        return;
      }
      // 底图：未锁定 → 直接在底图上拖拽即移动（一步到位，与 token 一致）；锁定时点击=选中、拖拽=框选
      const overBg = backgroundMap && !_bgAlignRefs && hitTestBackground(wx, wy);
      if (overBg && !bgLocked()) {
        selectedBackground = true; selectedToken = null; selectedTokens = new Set();
        selectedShape = null; selectedLine = null;
        _bgDragMode = 'bg-move';
        _dragOffX = wx - backgroundMap.x * CELL_SIZE;
        _dragOffY = wy - backgroundMap.y * CELL_SIZE;
        _dragMode = 'bg-move';
        dragStartX = wx; dragStartY = wy;
        isDragging = true;
        pushUndoMeta();
        render(); updateInfo();
        return;
      }
      // 其余：空白处拖拽 = 平移地图（与六角格 select 一致：选中即拖 + 空白拖平移；框选改用「🔲 框选(X)」按钮）
      clearSelection();
      selectedBackground = false;
      _dragMode = 'pan';
      dragStartX = mx; dragStartY = my;
      viewStartX = viewX; viewStartY = viewY;
      isDragging = true;
      const cell = cellAtPixel(mx, my);
      if (cell) handleCellClick(cell.q, cell.r, e);
      return;
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

    // --- 画笔（v0.97 合并区域/线段）：按子模式绘制 矩形/圆形/锥形/线段 ---
    if (selectedTool === 'brush') {
      const sx = wx / CELL_SIZE, sy = wy / CELL_SIZE;
      if (brush.shape === 'line') {
        _drawStart = { x: sx, y: sy };
        _dragMode = 'line-draw';
        isDragging = true;
        return;
      }
      if (brush.shape === 'rect' || brush.shape === 'circle') {
        _drawStart = { x: sx, y: sy };
        _dragMode = 'rect-draw';   // 矩形/圆形共用矩形拖拽（按 brush.shape 决定绘制形状）
        isDragging = true;
        return;
      }
      if (brush.shape === 'cone') {
        _coneStart = { wx, wy };
        _dragMode = 'cone-draw';
        isDragging = true;
        return;
      }
    }

    // --- 测量：拖拽画出测距线（持续显示距离/困难地形） ---
    if (selectedTool === 'measure') {
      _measure = { x1: wx / CELL_SIZE, y1: wy / CELL_SIZE, x2: wx / CELL_SIZE, y2: wy / CELL_SIZE };
      _dragMode = 'measure-draw';
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
          tempHp: _unitPending.tempHp || 0,
          ac: _unitPending.ac || '', speed: _unitPending.speed || '', notes: _unitPending.notes || '',
          status: _unitPending.status || [],
          imgData: _unitPending.imgData || '', img: _unitPending.img || null,
          sightRadius: _unitPending.sightRadius, visionSource: _unitPending.visionSource,
          layer: _unitPending.layer || 'creature',
          ownerId: inOnlinePlayerMode() ? onlineSelfId : ''
        };
        normalizeToken(t);
        pushUndoMeta();
        tokens.push(t);
        if (inOnlinePlayerMode()) onlineSendTokenPlace(t);
        selectedToken = t.id; selectedShape = null; selectedLine = null; selectedCell = null;
        render(); updateInfo();
        if (e.shiftKey) {
          showToast(`🧝 已放置 ${t.name || '单位'}（按住 Shift 可继续连放）`);
        } else {
          _unitPending = null; _hoverUnit = null;
          setTool('select');
          showToast(`🧝 已放置 ${t.name || '单位'} — 可直接拖动，右键编辑`);
        }
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
          stroke: '#fff', strokeWidth: 2, dash: false, name: '', layer: 'painting'
        };
        pushUndoMeta();
        shapes.push(sh);
        selectedShape = sh.id; selectedLine = null; selectedCell = null;
        render(); updateInfo();
        if (e.shiftKey) {
          showToast('🖼️ 已放置图片（Shift 连放中）');
        } else {
          _tokenPending = null; _hoverToken = null;
          setTool('select');
          showToast('🖼️ 已放置图片，拖动/缩放调整');
        }
        return;
      }
      return;
    }

    // --- DM 层：点击编辑/新建隐藏标记 ---
    if (selectedTool === 'dm') {
      const cell = cellAtPixel(mx, my);
      if (cell) showDmModal(cell.q, cell.r);
      return;
    }

    // --- 战雾：点击切换遮住/揭示，拖拽连续涂/擦 ---
    if (selectedTool === 'fog') {
      const cell = cellAtPixel(mx, my);
      if (cell) {
        beginBatch();
        // 战雾：点击切换遮住/揭示，拖拽连续涂/擦
        //  目标值 true=遮住 false=揭示；Alt 按住或处于「揭示」模式 → 强制揭示，与界面提示一致
        _fogPaintTarget = !(e.altKey || fogMode === 'reveal');
        setFogCell(cell.q, cell.r, _fogPaintTarget);
        _dragMode = 'fog';
        _eraseDragLast = new Set([cellKey(cell.q, cell.r)]);
        isDragging = true;
        render(); updateInfo();
        return;
      }
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

  // DM 层悬停预览 / 鼠标样式
  if (selectedTool === 'dm') {
    canvas.style.cursor = 'crosshair';
  }
  if (selectedTool === 'fog') {
    canvas.style.cursor = 'crosshair';
  }

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
        setDmCell(cell.q, cell.r, { mark: '', label: '' });
      } else if (mode === 'terrain') {
        setCell(cell.q, cell.r, { terrain: null });
      } else if (mode === 'walls') {
        const cur = getCell(cell.q, cell.r);
        for (let i = 0; i < 4; i++) {
          if (cur.walls[i] !== 0) setWall(cell.q, cell.r, i, 0);
        }
      } else if (mode === 'label') {
        setCell(cell.q, cell.r, { label: '' });
      } else if (mode === 'dm') {
        removeDmCell(cell.q, cell.r);
      } else if (mode === 'fog') {
        setFogCell(cell.q, cell.r, false);
      }
      render();
    }
  } else if (_dragMode === 'fog') {
    const cell = cellAtPixel(mx, my);
    if (cell) {
      const k = cellKey(cell.q, cell.r);
      if (_eraseDragLast.has(k)) return;
      _eraseDragLast.add(k);
      setFogCell(cell.q, cell.r, _fogPaintTarget === true);
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
      if (_selDragOff && _selDragOff.size) {
        const deltaX = wx - dragStartX, deltaY = wy - dragStartY;
        const moves = new Map();
        for (const [id, off] of _selDragOff) {
          const tt = tokens.find(x => x.id === id);
          if (tt) moves.set(id, { nx: off.nx + deltaX / CELL_SIZE, ny: off.ny + deltaY / CELL_SIZE });
        }
        moveTokensByOffsets(moves);
      } else {
        t.x = (wx - _dragOffX) / CELL_SIZE;
        t.y = (wy - _dragOffY) / CELL_SIZE;
      }
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
  } else if (_dragMode === 'marquee') {
    const sx = _marqueeStart.wx / CELL_SIZE, sy = _marqueeStart.wy / CELL_SIZE;
    const cx = wx / CELL_SIZE, cy = wy / CELL_SIZE;
    _marquee = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy), shift: _marqueeStart.shift };
    render();
  } else if (_dragMode === 'cone-draw') {
    const ox = _coneStart.wx, oy = _coneStart.wy;
    const dx = wx - ox, dy = wy - oy;
    const len = Math.max(0.5, Math.hypot(dx, dy) / CELL_SIZE);
    const angle = Math.atan2(dy, dx);
    _conePreview = { x: ox / CELL_SIZE, y: oy / CELL_SIZE, angle, length: len, spread: brush.spread };
    render();
  } else if (_dragMode === 'measure-draw') {
    _measure.x2 = wx / CELL_SIZE;
    _measure.y2 = wy / CELL_SIZE;
    render();
  } else if (_dragMode === 'pan') {
    viewX = viewStartX + (mx - dragStartX);
    viewY = viewStartY + (my - dragStartY);
    render();
  } else if (_dragMode === 'bg-move') {
    if (backgroundMap) {
      backgroundMap.x = (wx - _dragOffX) / CELL_SIZE;
      backgroundMap.y = (wy - _dragOffY) / CELL_SIZE;
      render();
    }
  } else if (_dragMode === 'bg-resize-corner') {
    if (backgroundMap && _bgAlignRefs) {
      const bm = backgroundMap;
      const x0 = bm.x * CELL_SIZE, y0 = bm.y * CELL_SIZE;
      bm.cols = Math.max(0.5, (wx - x0) / CELL_SIZE);
      bm.rows = Math.max(0.5, (wy - y0) / CELL_SIZE);
      render();
    }
  } else if (_dragMode === 'bg-resize-e') {
    if (backgroundMap && _bgAlignRefs) {
      const bm = backgroundMap;
      const x0 = bm.x * CELL_SIZE;
      bm.cols = Math.max(0.5, (wx - x0) / CELL_SIZE);
      render();
    }
  } else if (_dragMode === 'bg-resize-s') {
    if (backgroundMap && _bgAlignRefs) {
      const bm = backgroundMap;
      const y0 = bm.y * CELL_SIZE;
      bm.rows = Math.max(0.5, (wy - y0) / CELL_SIZE);
      render();
    }
  }
});

canvas.addEventListener('mouseup', () => {
  if (_dragMode === 'wall-drag' || _dragMode === 'fog') endBatch();
  _bgDragMode = null;

  // 画笔：矩形/圆形提交（采用画笔样式，归绘画层）
  if (_dragMode === 'rect-draw' && _rectPreview && (_rectPreview.w > 0.15 || _rectPreview.h > 0.15)) {
    const type = (brush.shape === 'circle') ? 'circle' : 'rect';
    const sh = {
      id: 'sh' + (_shapeSeq++), type,
      x: _rectPreview.x, y: _rectPreview.y,
      w: Math.max(_rectPreview.w, 0.2), h: Math.max(_rectPreview.h, 0.2),
      fill: brush.fill, fillAlpha: brush.fillAlpha,
      stroke: brush.stroke, strokeWidth: brush.strokeWidth, dash: brush.dash, name: '',
      layer: 'painting',
      author: onlineSelfId
    };
    pushUndoMeta();
    shapes.push(sh);
    if (inOnlinePlayerMode()) onlineSendShapeDraw(sh);
    selectedShape = sh.id; selectedLine = null; selectedCell = null; selectedToken = null;
    showToast(type === 'circle' ? '⭕ 已创建圆形区域，可在"选择"工具下拖动/缩放，右键或双击改属性' : '▭ 已创建区域，可在"选择"工具下拖动/缩放，右键或双击改属性');
  }
  _rectPreview = null;

  // 画笔：锥形提交
  if (_dragMode === 'cone-draw' && _conePreview) {
    const sh = {
      id: 'sh' + (_shapeSeq++), type: 'cone',
      x: _conePreview.x, y: _conePreview.y,
      length: Math.max(0.5, _conePreview.length), spread: Math.max(0.1, _conePreview.spread || brush.spread), angle: _conePreview.angle || 0,
      fill: brush.fill, fillAlpha: brush.fillAlpha,
      stroke: brush.stroke, strokeWidth: brush.strokeWidth, dash: brush.dash, name: '',
      layer: 'painting',
      author: onlineSelfId
    };
    pushUndoMeta();
    shapes.push(sh);
    if (inOnlinePlayerMode()) onlineSendShapeDraw(sh);
    selectedShape = sh.id; selectedLine = null; selectedCell = null; selectedToken = null;
    showToast('📐 已创建攻击锥，可在"选择"工具下点选，右键改角度/长度/颜色');
  }
  _conePreview = null;

  // 画笔：线段提交（归线段层）
  if (_dragMode === 'line-draw' && _linePreview) {
    const dx = _linePreview.x2 - _linePreview.x1, dy = _linePreview.y2 - _linePreview.y1;
    if (Math.hypot(dx, dy) > 0.1) {
      const ln = {
        id: 'ln' + (_lineSeq++),
        x1: _linePreview.x1, y1: _linePreview.y1,
        x2: _linePreview.x2, y2: _linePreview.y2,
        color: brush.lineColor, width: brush.lineWidth, dash: brush.dash, name: '',
        layer: 'line',
        author: onlineSelfId
      };
      pushUndoMeta();
      freeLines.push(ln);
      if (inOnlinePlayerMode()) onlineSendLineDraw(ln);
      selectedLine = ln.id; selectedShape = null; selectedCell = null; selectedToken = null;
      showToast('📏 已创建线段，右键改颜色/线宽/虚线');
    }
  }
  _linePreview = null;

  // 框选结算：拖动=框选；点击=选中底图或取消选中
  if (_dragMode === 'marquee') {
    const moved = _marquee && (_marquee.w > 0.15 || _marquee.h > 0.15);
    if (!moved) {
      if (!_marqueeStart.shift) {
        if (_marqueeStart.overBg) { selectedBackground = true; selectedToken = null; }
        else clearSelection();
      }
    } else {
      const ids = tokens.filter(t => tokenRectOverlap(t, _marquee)).map(t => t.id);
      if (_marqueeStart.shift) {
        ids.forEach(id => selectedTokens.add(id));
        if (ids.length) selectedToken = ids[ids.length - 1];
        selectedBackground = false;
      } else {
        clearSelection();
        selectedTokens = new Set(ids);
        selectedToken = ids.length ? ids[ids.length - 1] : null;
        if (selectedToken) selectedTokens.add(selectedToken);
      }
    }
    _marquee = null; _marqueeStart = null;
  }

  // 玩家移动/缩放了「自己的 token」→ 发增量（仅玩家身份；DM 走整图快照）
  if (_dragMode === 'token-move' || _dragMode === 'token-resize') {
    const ids = new Set();
    if (_dragMode === 'token-move') {
      try { tokenDragIds(_dragTokenId).forEach(id => ids.add(id)); } catch (e) { /* ignore */ }
      if (_dragTokenId) ids.add(_dragTokenId);
    } else if (_dragTokenId) {
      ids.add(_dragTokenId);
    }
    for (const id of ids) {
      const tt = tokens.find(x => x.id === id);
      if (!tt || (inOnlinePlayerMode() && !canEditToken(tt))) continue;
      onlineSendTokenEdit(id, { x: tt.x, y: tt.y, w: tt.w, h: tt.h });
    }
  }

  isDragging = false;
  _dragMode = null;
  _dragShapeId = null; _dragHandle = null; _dragLineId = null; _dragTokenId = null;
  _selDragOff = new Map();
  _wallDragLast = null;
  _eraseDragLast = new Set();
  _coneStart = null;
  render();
  updateInfo();
});

canvas.addEventListener('mouseleave', () => {
  if (_dragMode === 'wall-drag' || _dragMode === 'fog') endBatch();
  isDragging = false;
  _dragMode = null;
  _selDragOff = new Map();
  _rectPreview = null;
  _linePreview = null;
  _conePreview = null; _coneStart = null;
  _marquee = null; _marqueeStart = null;
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
        tempHp: _unitPending.tempHp || 0,
        ac: _unitPending.ac || '', speed: _unitPending.speed || '', notes: _unitPending.notes || '',
        status: _unitPending.status || [],
        imgData: _unitPending.imgData || '', img: _unitPending.img || null,
        sightRadius: _unitPending.sightRadius, visionSource: _unitPending.visionSource,
        layer: _unitPending.layer || 'creature',
        ownerId: ''
      };
      normalizeToken(t);
      pushUndoMeta();
      tokens.push(t);
      if (inOnlinePlayerMode()) onlineSendTokenPlace(t);
      selectedToken = t.id; selectedShape = null; selectedLine = null; selectedCell = null;
      render(); updateInfo();
      _unitPending = null; _hoverUnit = null;
      setTool('select');
      showToast(`🧝 已放置 ${t.name || '单位'}`);
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
        stroke: '#fff', strokeWidth: 2, dash: false, name: '', layer: 'painting'
      };
      pushUndoMeta();
      shapes.push(sh);
      selectedShape = sh.id; selectedLine = null; selectedCell = null;
      render(); updateInfo();
      _tokenPending = null; _hoverToken = null;
      setTool('select');
      showToast('🖼️ 已放置图片');
      return;
    }
    // DM 层（触摸）
    if (selectedTool === 'dm') {
      const c = cellAtPixel(mx, my);
      if (c) showDmModal(c.q, c.r);
      return;
    }
    // 战雾（触摸：按当前模式 遮住/揭示）
    if (selectedTool === 'fog') {
      const c = cellAtPixel(mx, my);
      if (c) {
        setFogCell(c.q, c.r, fogMode === 'reveal' ? false : true);
        render(); updateInfo();
        return;
      }
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

canvas.addEventListener('touchend', () => {
  isDragging = false;
  if (_dragMode === 'fog') endBatch();
  _dragMode = null;
  _selDragOff = new Map();
  _eraseDragLast = new Set();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// 双击：编辑选中的图形/线段属性
canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const wx = (mx - viewX) / zoom, wy = (my - viewY) / zoom;
  const tk = hitTestToken(wx, wy);
  if (tk) {
    if (inOnlinePlayerMode() && !canEditToken(tk)) { showToast('👁️ 这是别人的单位，只能查看'); return; }
    openUnitModal(tk);
    return;
  }
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
      setDmCell(q, r, { mark: '', label: '' });
    } else if (mode === 'terrain') {
      setCell(q, r, { terrain: null });
    } else if (mode === 'walls') {
      const cur = getCell(q, r);
      for (let i = 0; i < 4; i++) {
        if (cur.walls[i] !== 0) setWall(q, r, i, 0);
      }
    } else if (mode === 'label') {
      setCell(q, r, { label: '' });
    } else if (mode === 'dm') {
      removeDmCell(q, r);
    } else if (mode === 'fog') {
      setFogCell(q, r, false);
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
    if (!selectedTokens.has(tkHit.id)) selectedTokens = new Set([tkHit.id]);
    render(); updateInfo();
    const targetIds = Array.from(selectedTokens).filter(id => tokens.some(x => x.id === id));
    const main = tokens.find(x => x.id === selectedToken) || tkHit;
    addItem('🧝 编辑单位属性（主轴）', () => { openUnitModal(main); });
    addItem('📥 存入单位库（可复用预设）', () => { saveTokenToLibrary(main, false); });
    addItem('👁️ 以该单位视角查看（玩家视图）', () => setViewSourceToken(main.id));
    if (viewSourceTokenId) addItem('👁️ 恢复全部视野源', () => resetViewSourceToken());
    addItem('💥 受伤 -1', () => { changeTokenHp(main.id, -1); });
    addItem('💥 受伤 -5', () => { changeTokenHp(main.id, -5); });
    addItem('💥 受伤（自定义）…', () => {
      const v = prompt('扣除多少伤害？', '');
      if (v === null) return;
      const dmg = parseInt(v, 10);
      if (isNaN(dmg) || dmg <= 0) return;
      const r = changeTokenHp(main.id, -dmg);
      showToast(r ? `💥 ${main.name || '单位'} -${dmg}，临时HP吸收 ${r.absorbed || 0}` : '⚠️ 未找到单位');
    });
    addItem('💚 治疗 +1', () => { changeTokenHp(main.id, 1); });
    addItem('💚 治疗 +5', () => { changeTokenHp(main.id, 5); });
    addItem('💚 治疗（自定义）…', () => {
      const v = prompt('自定义治疗量？', '');
      if (v === null) return;
      const dmg = parseInt(v, 10);
      if (isNaN(dmg) || dmg <= 0) return;
      changeTokenHp(main.id, dmg);
    });
    addItem('🩸 设置 HP…', () => {
      const v = prompt(`设置 ${main.name || '单位'} HP（当前/上限）：`, `${main.hp ?? ''}/${main.maxHp ?? ''}`);
      if (v === null) return;
      const parts = v.split('/');
      pushUndoMeta();
      if (parts.length >= 2) {
        main.hp = parts[0].trim() === '' ? '' : Math.max(0, parseInt(parts[0]) || 0);
        main.maxHp = parts[1].trim() === '' ? '' : Math.max(1, parseInt(parts[1]) || 1);
      } else {
        main.hp = v.trim() === '' ? '' : Math.max(0, parseInt(v) || 0);
      }
      syncTokenInitiative(main);
      render(); updateInfo();
    });
    if (targetIds.length >= 2) {
      addItem('🧩 创建编组（当前选中）…', () => {
        const name = prompt('编组名称：', '小队');
        if (name === null) return;
        const color = prompt('编组颜色（十六进制）：', '#7fb0ff');
        if (color === null) return;
        addTokenGroup(name, color, targetIds);
        render(); updateInfo();
      });
    }
    const curGroup = getTokenGroup(main.id);
    if (curGroup) {
      addItem(`🚫 移出编组「${curGroup.name || '编组'}」`, () => {
        removeTokenFromGroups(main.id);
        render(); updateInfo();
      });
    }
    addItem('🗑️ 删除选中单位' + (targetIds.length > 1 ? `（${targetIds.length} 个）` : ''), () => {
      pushUndoMeta();
      tokens = tokens.filter(x => !targetIds.includes(x.id));
      targetIds.forEach(id => clearInitiativeTokenRefs(id));
      selectedTokens = new Set();
      selectedToken = null;
      pruneGroups();
      render(); updateInfo();
      if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
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

    // DM 层快捷操作
    addItem('🕵️ 编辑 DM 层标记', () => { selectedCell = cell; showDmModal(cell.q, cell.r); render(); });
    addItem(isFogCell(cell.q, cell.r) ? '🌫️ 揭示此格' : '🌫️ 遮住此格', () => {
      toggleFogCell(cell.q, cell.r);
      render(); updateInfo();
    });
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
