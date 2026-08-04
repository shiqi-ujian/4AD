// ======== Hit testing ========
function hexAtPixel(px, py) {
  // Transform screen → world
  const wx = (px - viewX) / zoom;
  const wy = (py - viewY) / zoom;
  const h = pixelToHex(wx, wy);
  // Verify distance
  const p = hexToPixel(h.q, h.r);
  const corners = hexCorners(p.x, p.y, HEX_SIZE);
  // Point-in-polygon test
  let inside = false;
  for (let i = 0, j = 5; i < 6; j = i++) {
    const xi = corners[i].x, yi = corners[i].y;
    const xj = corners[j].x, yj = corners[j].y;
    if ((yi > wy) !== (yj > wy) && wx < (xj - xi) * (wy - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside ? h : null;
}

// ======== Input Handling ========
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  if (e.button === 2) { // Right click
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, mx, my);
    return;
  }

  if (e.button === 0) {
    // Box-select mode: start selection rect on any click
    if (selectedTool === 'select-rect') {
      isBoxSelecting = true;
      selectionRect = { x1: mx, y1: my, x2: mx, y2: my };
      return;
    }

    const hex = hexAtPixel(mx, my);

    if (hex) {
      handleHexClick(hex.q, hex.r, e);
      // Select 模式下点击格子后仍可拖拽平移地图
      if (selectedTool === 'select') {
        isDragging = true;
        dragStartX = mx;
        dragStartY = my;
        viewStartX = viewX;
        viewStartY = viewY;
      }
      // Paint mode: still enable drag for continuous painting across hexes
      if (selectedTool === 'paint') {
        isDragging = true;
        dragStartX = mx;
        dragStartY = my;
        // Don't save viewStart - we don't want to pan
      }
      // Erase mode: drag across hexes to erase continuously
      if (selectedTool === 'erase') {
        isDragging = true;
        dragStartX = mx;
        dragStartY = my;
        _eraseDragLast = new Set();
        _eraseDragLast.add(hexKey(hex.q, hex.r));
      }
      return;
    }

    // Only start drag-pan mode when clicking on empty space
    isDragging = true;
    dragStartX = mx;
    dragStartY = my;
    viewStartX = viewX;
    viewStartY = viewY;
  }
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // Box-select: draw live selection rectangle
  if (isBoxSelecting && selectedTool === 'select-rect') {
    selectionRect.x2 = mx;
    selectionRect.y2 = my;
    render();
    return;
  }

  if (isDragging) {
    // Paint tool: drag across hexes to paint continuously
    if (selectedTool === 'paint') {
      const hex = hexAtPixel(mx, my);
      if (hex) {
        const k = hexKey(hex.q, hex.r);
        const h = getHex(hex.q, hex.r);
        // Skip if locked and hex already has terrain
        if (h.terrain !== selectedTerrain && !(isLocked && h.terrain)) {
          setHex(hex.q, hex.r, { terrain: selectedTerrain });
          render();
        }
      }
    } else if (selectedTool === 'erase') {
      const hex = hexAtPixel(mx, my);
      if (hex) {
        const k = hexKey(hex.q, hex.r);
        if (_eraseDragLast.has(k)) return; // skip same hex
        _eraseDragLast.add(k);
        const h = getHex(hex.q, hex.r);
        if (isLocked && (h.terrain || h.settlement || h.label || h.roads?.length)) return;
        const mode = document.getElementById('erase-mode').value;
        if (mode === 'all') {
          setHex(hex.q, hex.r, { terrain: null, label: '', settlement: null, roads: [] });
        } else if (mode === 'terrain') {
          setHex(hex.q, hex.r, { terrain: null });
        } else if (mode === 'settlement') {
          setHex(hex.q, hex.r, { settlement: null });
        } else if (mode === 'label') {
          setHex(hex.q, hex.r, { label: '' });
        } else if (mode === 'roads') {
          const cur = getHex(hex.q, hex.r);
          if (cur.roads) {
            for (const rd of cur.roads) {
              const nh = getHex(rd.q, rd.r);
              if (nh.roads) {
                setHex(rd.q, rd.r, { roads: nh.roads.filter(r => !(r.q === hex.q && r.r === hex.r)) });
              }
            }
          }
          setHex(hex.q, hex.r, { roads: [] });
        }
        render();
      }
    } else {
      // Pan the view
      viewX = viewStartX + (mx - dragStartX);
      viewY = viewStartY + (my - dragStartY);
      render();
    }
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
  _eraseDragLast = new Set();
  if (isBoxSelecting) {
    isBoxSelecting = false;
    // Find hexes within the selection rectangle
    selectedHexes = new Set();
    if (selectionRect) {
      const { x1, y1, x2, y2 } = selectionRect;
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
      // Estimate hex range from corners
      const topLeft = pixelToHex((minX - viewX) / zoom, (minY - viewY) / zoom);
      const botRight = pixelToHex((maxX - viewX) / zoom, (maxY - viewY) / zoom);
      for (let q = Math.floor(topLeft.q) - 1; q <= Math.ceil(botRight.q) + 1; q++) {
        for (let r = Math.floor(topLeft.r) - 1; r <= Math.ceil(botRight.r) + 1; r++) {
          const p = hexToPixel(q, r);
          const sx = p.x * zoom + viewX;
          const sy = p.y * zoom + viewY;
          if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
            selectedHexes.add(hexKey(q, r));
          }
        }
      }
    }
    selectionRect = null;
    updateBatchPanel();
    render();
    updateInfo();
  }
});
canvas.addEventListener('mouseleave', () => { isDragging = false; _eraseDragLast = new Set(); });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.15, Math.min(5, zoom * delta));

  // Zoom toward mouse position
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

    const hex = hexAtPixel(mx, my);
    if (hex) {
      handleHexClick(hex.q, hex.r, { shiftKey: false, ctrlKey: false });
      isDragging = false;
      return;
    }

    isDragging = true;
    dragStartX = mx; dragStartY = my;
    viewStartX = viewX; viewStartY = viewY;
  } else if (e.touches.length === 2) {
    touchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
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
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
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

// ======== Hex Click Handler ========
function handleHexClick(q, r, e) {
  selectedHex = { q, r };

  if (selectedTool === 'paint') {
    if (isLocked && getHex(q, r).terrain) { /* locked, skip */ } else {
      setHex(q, r, { terrain: selectedTerrain });
      render();
      updateInfo();
    }
  } else if (selectedTool === 'settlement') {
    showSettlementDialog(q, r);
  } else if (selectedTool === 'road') {
    const hint = document.getElementById('tool-hint');
    if (!roadStart) {
      roadStart = { q, r };
      hint.innerHTML = `🛤️ 起点已选 <b>(${q}, ${r})</b>，点击相邻六角格连线。再次点击起点可取消`;
      document.getElementById('coord-indicator').textContent = `🛤️ 起点 (${q}, ${r})`;
    } else {
      if (roadStart.q === q && roadStart.r === r) {
        roadStart = null;
        hint.innerHTML = '🛤️ <b>点击第一个六角格</b>设为起点(橙色高亮)，再<b>点击相邻格</b>连线';
        document.getElementById('coord-indicator').textContent = '🛤️ 点击选择道路起点';
      } else {
        // Check if adjacent
        const nbrs = neighbors(q, r);
        if (nbrs.some(n => n.q === roadStart.q && n.r === roadStart.r)) {
          // Toggle road
          if (hasRoad(q, r, roadStart.q, roadStart.r)) {
            removeRoad(q, r, roadStart.q, roadStart.r);
            hint.innerHTML = `🛤️ 已移除道路 [(${roadStart.q},${roadStart.r}) ⇄ (${q},${r})]`;
          } else {
            addRoad(q, r, roadStart.q, roadStart.r);
            hint.innerHTML = `🛤️ ✅ 已建立道路 [(${roadStart.q},${roadStart.r}) ⇄ (${q},${r})]`;
          }
          roadStart = null;
          document.getElementById('coord-indicator').textContent = '🛤️ 点击选择道路起点';
        } else {
          // Not adjacent — move start
          roadStart = { q, r };
          hint.innerHTML = `🛤️ ⚠️ 不相邻！重新设起点为 <b>(${q}, ${r})</b>，点击相邻格连线`;
          document.getElementById('coord-indicator').textContent = `🛤️ 起点 (${q}, ${r})`;
        }
      }
      render();
      updateInfo();
      return; // skip extra render below
    }
  } else if (selectedTool === 'label') {
    showLabelDialog(q, r);
  } else if (selectedTool === 'erase') {
    const mode = document.getElementById('erase-mode').value;
    const h = getHex(q, r);
    // Locked: don't erase hexes with any content
    if (isLocked && (h.terrain || h.settlement || h.label || h.roads?.length)) {
      showDiceResult('🔒', '已锁定，取消勾选锁定后擦除');
      return;
    }
    if (mode === 'all') {
      setHex(q, r, { terrain: null, label: '', settlement: null, roads: [] });
    } else if (mode === 'terrain') {
      setHex(q, r, { terrain: null });
    } else if (mode === 'settlement') {
      // Keep roads to/from this hex when removing settlement
      setHex(q, r, { settlement: null });
    } else if (mode === 'label') {
      setHex(q, r, { label: '' });
    } else if (mode === 'roads') {
      // Remove all roads from this hex and corresponding roads from neighbors
      beginBatch();
      if (h.roads) {
        for (const rd of h.roads) {
          const nh = getHex(rd.q, rd.r);
          if (nh.roads) {
            const filtered = nh.roads.filter(r => !(r.q === q && r.r === r));
            setHex(rd.q, rd.r, { roads: filtered });
          }
        }
      }
      setHex(q, r, { roads: [] });
      endBatch();
    }
    render();
    updateInfo();
  } else {
    // Select — just update info
    updateInfo();
    render();
  }
}
