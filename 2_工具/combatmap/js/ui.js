//  Tool Switching
// ============================================================
function setTool(tool) {
  selectedTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  document.getElementById('erase-options').style.display = tool === 'erase' ? 'block' : 'none';

  const hint = document.getElementById('tool-hint');
  const coord = document.getElementById('coord-indicator');
  const cnt = document.getElementById('canvas-container');

  switch (tool) {
    case 'select':
      hint.innerHTML = '👆 点击格子查看信息；点击区域/线段/图片可拖动、缩放（8 手柄），双击或右键改属性，Delete 删除';
      coord.textContent = '⚪ 选择模式';
      cnt.style.cursor = 'default';
      break;
    case 'paint':
      const t = getTerrain(selectedTerrain);
      hint.innerHTML = `🖌️ 点击/拖拽涂上 <b>${t?.name || ''}</b>`;
      coord.textContent = `🖌️ ${t?.icon || ''} ${t?.name || ''}`;
      cnt.style.cursor = 'crosshair';
      break;
    case 'wall':
      hint.innerHTML = '🧱 点击<b>格子边</b>放置墙壁，<b>拖拽可连续画墙</b>。再次点击移除。拖拽空白平移';
      coord.textContent = '🧱 墙壁模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'door':
      hint.innerHTML = '🚪 点击<b>格子边</b>放置门，<b>拖拽可连续放门</b>。再次点击移除。拖拽空白平移';
      coord.textContent = '🚪 门模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'label':
      hint.innerHTML = '🏷️ 点击格子输入标注文字';
      coord.textContent = '🏷️ 标签模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'erase':
      hint.innerHTML = '🧹 点击/拖拽擦除。下拉菜单选择擦除内容';
      coord.textContent = '🧹 擦除模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'rect':
      hint.innerHTML = '▭ <b>拖拽</b>绘制矩形区域/灵气，完成后在"选择"工具下改颜色/透明度';
      coord.textContent = '▭ 区域模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'token':
      hint.innerHTML = _tokenPending ? '🖼️ 点击地图放置图片，右键/Esc 取消' : '🖼️ 点击按钮后选择图片文件，然后点击地图放置';
      coord.textContent = '🖼️ 图片模式';
      cnt.style.cursor = _tokenPending ? 'crosshair' : 'pointer';
      break;
    case 'line':
      hint.innerHTML = '📏 <b>拖拽</b>画任意角度线段（墙/视线阻挡/效果线），右键改颜色线宽';
      coord.textContent = '📏 线段模式';
      cnt.style.cursor = 'crosshair';
      break;
  }
  render();
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

// ============================================================
//  Terrain Palette
// ============================================================
function rebuildTerrainPalette() {
  const palette = document.getElementById('terrain-palette');
  if (!palette) return;
  palette.innerHTML = '';
  getTerrainList().forEach(id => {
    const t = getTerrain(id);
    const btn = document.createElement('button');
    btn.className = 'tool-btn' + (id === selectedTerrain ? ' active' : '');
    btn.dataset.terrain = id;
    btn.title = t.name + ' — ' + t.desc;
    const tc = isLightColor(t.color) ? '#333' : '#fff';
    btn.style.cssText = `background:${t.color};color:${tc};text-shadow:${tc === '#fff' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'}`;
    btn.innerHTML = `<span class="icon">${t.icon}</span><span class="label">${t.name}</span>`;
    btn.addEventListener('click', () => {
      selectedTerrain = id;
      document.querySelectorAll('.tool-btn[data-terrain]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (selectedTool !== 'paint') setTool('paint');
      const ti = getTerrain(id);
      document.getElementById('coord-indicator').textContent = `🖌️ ${ti.icon} ${ti.name}`;
    });
    palette.appendChild(btn);
  });
}

// ============================================================
//  Label Dialog
// ============================================================
function showLabelDialog(q, r) {
  const h = getCell(q, r);
  document.getElementById('label-modal-q').value = q;
  document.getElementById('label-modal-r').value = r;
  document.getElementById('label-modal-coord').textContent = `(${q}, ${r})`;
  document.getElementById('label-modal-text').value = h.label || '';
  document.getElementById('label-modal').style.display = 'block';
  setTimeout(() => document.getElementById('label-modal-text').focus(), 50);
}

function labelConfirm() {
  const q = parseInt(document.getElementById('label-modal-q').value);
  const r = parseInt(document.getElementById('label-modal-r').value);
  const text = document.getElementById('label-modal-text').value.trim();
  setCell(q, r, { label: text });
  document.getElementById('label-modal').style.display = 'none';
  render();
  updateInfo();
}

document.getElementById('label-modal-confirm').addEventListener('click', labelConfirm);
document.getElementById('label-modal-cancel').addEventListener('click', () => { document.getElementById('label-modal').style.display = 'none'; });
document.getElementById('label-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
document.getElementById('label-modal-text').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') labelConfirm();
  if (e.key === 'Escape') document.getElementById('label-modal').style.display = 'none';
});

// ============================================================
//  Shape Properties Modal（区域/图片）
// ============================================================
function openShapeModal(id) {
  const sh = shapes.find(s => s.id === id);
  if (!sh) return;
  document.getElementById('shape-id').value = id;
  document.getElementById('shape-name').value = sh.name || '';
  document.getElementById('shape-rect-fields').style.display = sh.type === 'rect' ? 'block' : 'none';
  if (sh.type === 'rect') {
    document.getElementById('shape-fill').value = sh.fill || '#e94560';
    document.getElementById('shape-alpha').value = Math.round((sh.fillAlpha ?? 0.4) * 100);
    document.getElementById('shape-alpha-val').textContent = Math.round((sh.fillAlpha ?? 0.4) * 100) + '%';
    document.getElementById('shape-stroke').value = sh.stroke || '#ffffff';
    document.getElementById('shape-sw').value = sh.strokeWidth ?? 2;
    document.getElementById('shape-sw-val').textContent = (sh.strokeWidth ?? 2) + 'px';
    document.getElementById('shape-dash').checked = !!sh.dash;
  }
  document.getElementById('shape-w').value = Math.round(sh.w * 10) / 10;
  document.getElementById('shape-h').value = Math.round(sh.h * 10) / 10;
  document.getElementById('shape-modal').style.display = 'block';
}

function shapeApply() {
  const id = document.getElementById('shape-id').value;
  const sh = shapes.find(s => s.id === id);
  if (!sh) return;
  pushUndoMeta();
  sh.name = document.getElementById('shape-name').value.trim();
  sh.w = Math.max(0.2, parseFloat(document.getElementById('shape-w').value) || sh.w);
  sh.h = Math.max(0.2, parseFloat(document.getElementById('shape-h').value) || sh.h);
  if (sh.type === 'rect') {
    sh.fill = document.getElementById('shape-fill').value;
    sh.fillAlpha = parseInt(document.getElementById('shape-alpha').value) / 100;
    sh.stroke = document.getElementById('shape-stroke').value;
    sh.strokeWidth = parseInt(document.getElementById('shape-sw').value);
    sh.dash = document.getElementById('shape-dash').checked;
  }
  document.getElementById('shape-modal').style.display = 'none';
  render(); updateInfo();
}

document.getElementById('shape-alpha').addEventListener('input', function() {
  document.getElementById('shape-alpha-val').textContent = this.value + '%';
});
document.getElementById('shape-sw').addEventListener('input', function() {
  document.getElementById('shape-sw-val').textContent = this.value + 'px';
});
document.getElementById('shape-confirm').addEventListener('click', shapeApply);
document.getElementById('shape-cancel').addEventListener('click', () => { document.getElementById('shape-modal').style.display = 'none'; });
document.getElementById('shape-delete').addEventListener('click', () => {
  const id = document.getElementById('shape-id').value;
  pushUndoMeta();
  shapes = shapes.filter(s => s.id !== id);
  if (selectedShape === id) selectedShape = null;
  document.getElementById('shape-modal').style.display = 'none';
  render(); updateInfo();
});
document.getElementById('shape-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// ============================================================
//  Line Properties Modal（自由线段）
// ============================================================
function openLineModal(id) {
  const ln = freeLines.find(l => l.id === id);
  if (!ln) return;
  document.getElementById('line-id').value = id;
  document.getElementById('line-name').value = ln.name || '';
  document.getElementById('line-color').value = ln.color || '#000000';
  document.getElementById('line-w').value = ln.width || 3;
  document.getElementById('line-w-val').textContent = (ln.width || 3) + 'px';
  document.getElementById('line-dash').checked = !!ln.dash;
  document.getElementById('line-modal').style.display = 'block';
}

function lineApply() {
  const id = document.getElementById('line-id').value;
  const ln = freeLines.find(l => l.id === id);
  if (!ln) return;
  pushUndoMeta();
  ln.name = document.getElementById('line-name').value.trim();
  ln.color = document.getElementById('line-color').value;
  ln.width = parseInt(document.getElementById('line-w').value) || 3;
  ln.dash = document.getElementById('line-dash').checked;
  document.getElementById('line-modal').style.display = 'none';
  render(); updateInfo();
}

document.getElementById('line-w').addEventListener('input', function() {
  document.getElementById('line-w-val').textContent = this.value + 'px';
});
document.getElementById('line-confirm').addEventListener('click', lineApply);
document.getElementById('line-cancel').addEventListener('click', () => { document.getElementById('line-modal').style.display = 'none'; });
document.getElementById('line-delete').addEventListener('click', () => {
  const id = document.getElementById('line-id').value;
  pushUndoMeta();
  freeLines = freeLines.filter(l => l.id !== id);
  if (selectedLine === id) selectedLine = null;
  document.getElementById('line-modal').style.display = 'none';
  render(); updateInfo();
});
document.getElementById('line-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// ============================================================
//  Info Panel
// ============================================================
function updateInfo() {
  const panel = document.getElementById('info-panel');
  if (!selectedCell) {
    panel.innerHTML = '<div class="row"><span class="label">💡 选择工具 → 操作格子 → 导出 Excel</span></div>';
    return;
  }
  const { q, r } = selectedCell;
  const h = getCell(q, r);
  const ti = h.terrain ? getTerrain(h.terrain) : null;
  const tName = h.terrain ? `${ti?.icon || ''} ${ti?.name || h.terrain}` : '未设置';
  const walls = h.walls || [0,0,0,0];
  const wallDescs = [];
  if (walls[0] === 1) wallDescs.push('上-墙'); else if (walls[0] === 2) wallDescs.push('上-门');
  if (walls[1] === 1) wallDescs.push('右-墙'); else if (walls[1] === 2) wallDescs.push('右-门');
  if (walls[2] === 1) wallDescs.push('下-墙'); else if (walls[2] === 2) wallDescs.push('下-门');
  if (walls[3] === 1) wallDescs.push('左-墙'); else if (walls[3] === 2) wallDescs.push('左-门');
  const wallStr = wallDescs.length > 0 ? wallDescs.join(', ') : '无';

  panel.innerHTML = `<div class="row">
    <span><span class="label">坐标:</span> <span class="val">(${q}, ${r})</span></span>
    <span><span class="label">地形:</span> <span class="val">${tName}</span></span>
    <span><span class="label">标签:</span> <span class="val">${h.label || '—'}</span></span>
    <span><span class="label">边界:</span> <span class="val">${wallStr}</span></span>
  </div>`;
}

// ============================================================


//  Toast / Notification
// ============================================================
function showToast(msg) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = `<div class="row" style="justify-content:center;"><span style="font-size:15px;font-weight:bold;color:#e94560;">${msg}</span></div>`;
}

// ============================================================

//  Clear
// ============================================================
function clearAll() {
  if (!confirm('⚠️ 确认清空所有数据（地形/图形/线段）？此操作可撤销。')) return;
  beginBatch();
  for (const key of Object.keys(combatData)) pushUndo(key);
  pushUndoMeta();
  combatData = {};
  shapes = [];
  freeLines = [];
  endBatch();
  selectedCell = null;
  selectedShape = null; selectedLine = null;
  render(); updateInfo();
  showToast('🗑️ 已清空');
}

// ============================================================

//  Keyboard Shortcuts
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveJSON(); return; }
  // Delete: 删除选中图形/线段
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedShape) {
      pushUndoMeta();
      shapes = shapes.filter(s => s.id !== selectedShape);
      selectedShape = null;
      render(); updateInfo();
      return;
    }
    if (selectedLine) {
      pushUndoMeta();
      freeLines = freeLines.filter(l => l.id !== selectedLine);
      selectedLine = null;
      render(); updateInfo();
      return;
    }
  }
  // Esc: 取消图片放置
  if (e.key === 'Escape' && _tokenPending) {
    _tokenPending = null; _hoverToken = null;
    setTool('select');
    render();
    return;
  }
  const km = { 'v':'select', 'b':'paint', 'w':'wall', 'd':'door', 'l':'label', 'e':'erase', 'r':'rect', 't':'token', 'g':'line' };
  if (km[e.key?.toLowerCase()]) { e.preventDefault(); setTool(km[e.key.toLowerCase()]); }
});

// ============================================================

//  Button Bindings
// ============================================================
document.getElementById('btn-export-excel').addEventListener('click', exportToExcel);
document.getElementById('btn-export-img').addEventListener('click', exportPNG);
document.getElementById('btn-export-legend').addEventListener('click', exportLegendPNG);
document.getElementById('btn-export-owlbear').addEventListener('click', exportOwlbearScene);
document.getElementById('btn-save').addEventListener('click', saveJSON);
document.getElementById('btn-load').addEventListener('click', loadJSON);
document.getElementById('btn-clear').addEventListener('click', clearAll);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('chk-grid').addEventListener('change', (e) => { showGrid = e.target.checked; render(); });
document.getElementById('chk-coords').addEventListener('change', (e) => { showCoords = e.target.checked; render(); });

// ============================================================

//  Token 图片选择（T 工具）
// ============================================================
function pickTokenImage() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // 默认 2×2 格，保持原比例
        const scale = Math.min(2 / (img.width / 48), 2 / (img.height / 48), 6);
        _tokenPending = {
          imgData: ev.target.result,
          img,
          w: Math.max(1, Math.min(4, (img.width / 48) * scale)),
          h: Math.max(1, Math.min(4, (img.height / 48) * scale))
        };
        _hoverToken = null;
        setTool('token');
        showToast('🖼️ 点击地图放置图片，Esc 取消');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// 图片工具按钮：点击选择文件
document.querySelectorAll('.tool-btn[data-tool="token"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!_tokenPending) pickTokenImage();
  });
});

// ============================================================

//  Terrain Manage Modal（自定义地形）
// ============================================================
let _terrainEditId = null;  // null = 新增

function openTerrainModal() {
  _terrainEditId = null;
  document.getElementById('terrain-edit').style.display = 'none';
  renderTerrainList();
  document.getElementById('terrain-modal').style.display = 'block';
}

function renderTerrainList() {
  const list = document.getElementById('terrain-list');
  list.innerHTML = '';
  const entries = [];
  getTerrainList().forEach(id => {
    const t = getTerrain(id);
    const isCustom = !!customTerrains[id];
    entries.push({ id, t, isCustom });
  });
  entries.forEach(({ id, t, isCustom }) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border-bottom:1px solid #0f3460;font-size:12px;';
    const sw = document.createElement('span');
    sw.style.cssText = `display:inline-block;width:18px;height:18px;border-radius:3px;background:${t.color};border:1px solid #888;flex-shrink:0;`;
    const info = document.createElement('span');
    info.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    info.textContent = `${t.icon} ${t.name}${isCustom ? ' ✏️' : ''}`;
    info.title = t.desc || '';
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑';
    editBtn.style.cssText = 'padding:2px 8px;background:#3a7abd;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    editBtn.addEventListener('click', () => { _terrainEditId = id; showTerrainEditForm(t); });
    row.appendChild(sw); row.appendChild(info); row.appendChild(editBtn);
    if (isCustom) {
      const delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.style.cssText = 'padding:2px 8px;background:#a33;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
      delBtn.addEventListener('click', () => {
        if (!confirm(`删除自定义地形「${t.name}」？地图上使用它的格子将变为普通地面。`)) return;
        delete customTerrains[id];
        // 地图上的格子转地面（批量撤销）
        beginBatch();
        for (const k of Object.keys(combatData)) {
          if (combatData[k].terrain === id) {
            pushUndo(k);
            combatData[k].terrain = null;
          }
        }
        endBatch();
        if (selectedTerrain === id) selectedTerrain = 'floor';
        saveCustomTerrains(); refreshTerrains();
        rebuildTerrainPalette(); renderTerrainList(); render();
        showToast(`🗑️ 已删除地形「${t.name}」`);
      });
      row.appendChild(delBtn);
    }
    list.appendChild(row);
  });
}

function showTerrainEditForm(t) {
  const form = document.getElementById('terrain-edit');
  document.getElementById('terrain-edit-name').value = t.name;
  document.getElementById('terrain-edit-icon').value = t.icon;
  document.getElementById('terrain-edit-color').value = t.color;
  document.getElementById('terrain-edit-desc').value = t.desc || '';
  form.style.display = 'block';
  document.getElementById('terrain-edit-name').focus();
}

function saveTerrainEdit() {
  const name = document.getElementById('terrain-edit-name').value.trim();
  const icon = document.getElementById('terrain-edit-icon').value.trim() || '❓';
  const color = document.getElementById('terrain-edit-color').value;
  const desc = document.getElementById('terrain-edit-desc').value.trim();
  if (!name) { showToast('⚠️ 请输入地形名称'); return; }
  if (_terrainEditId === null) {
    // 新增：生成唯一 id
    let id = 'custom_' + Date.now().toString(36);
    customTerrains[id] = { name, icon, color, desc };
  } else {
    const id = _terrainEditId;
    if (customTerrains[id]) {
      customTerrains[id] = { name, icon, color, desc };
    } else {
      // 覆盖内置地形属性
      terrainOverrides[id] = { name, icon, color, desc };
    }
  }
  saveCustomTerrains(); refreshTerrains();
  rebuildTerrainPalette(); renderTerrainList(); render();
  document.getElementById('terrain-edit').style.display = 'none';
  showToast('✅ 地形已保存');
}

document.getElementById('btn-terrain-manage').addEventListener('click', openTerrainModal);
document.getElementById('terrain-add').addEventListener('click', () => {
  _terrainEditId = null;
  showTerrainEditForm({ name: '', icon: '❓', color: '#808080', desc: '' });
});
document.getElementById('terrain-edit-save').addEventListener('click', saveTerrainEdit);
document.getElementById('terrain-edit-cancel').addEventListener('click', () => { document.getElementById('terrain-edit').style.display = 'none'; });
document.getElementById('terrain-modal-close').addEventListener('click', () => { document.getElementById('terrain-modal').style.display = 'none'; });
document.getElementById('terrain-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// Template buttons
document.getElementById('btn-template-room').addEventListener('click', () => { document.getElementById('room-modal').style.display = 'block'; });
document.getElementById('btn-template-corridor').addEventListener('click', () => { document.getElementById('corridor-modal').style.display = 'block'; });
document.getElementById('btn-template-cave').addEventListener('click', () => { document.getElementById('cave-modal').style.display = 'block'; });
document.getElementById('btn-template-open').addEventListener('click', () => { document.getElementById('open-modal').style.display = 'block'; });

// Template: Room modal
['room-w','room-h'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = this.value;
  });
});
function getGenPos(posSelectId) {
  const pos = document.getElementById(posSelectId).value;
  if (pos === 'center' && selectedCell) return { q: selectedCell.q, r: selectedCell.r };
  return { q: 0, r: 0 };
}
document.getElementById('room-cancel').addEventListener('click', () => { document.getElementById('room-modal').style.display = 'none'; });
document.getElementById('room-confirm').addEventListener('click', () => {
  const w = parseInt(document.getElementById('room-w').value);
  const h = parseInt(document.getElementById('room-h').value);
  const { q, r } = getGenPos('room-pos');
  document.getElementById('room-modal').style.display = 'none';
  generateRoom(q, r, w, h);
  render(); updateInfo();
  showToast(`🏠 已生成 ${w}×${h} 房间`);
});
document.getElementById('room-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// Template: Corridor modal
['corr-len'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = this.value;
  });
});
document.getElementById('corr-w').addEventListener('input', function() {
  document.getElementById('corr-w-val').textContent = this.value;
});
document.getElementById('corr-cancel').addEventListener('click', () => { document.getElementById('corridor-modal').style.display = 'none'; });
document.getElementById('corr-confirm').addEventListener('click', () => {
  const type = document.getElementById('corr-type').value;
  const len = parseInt(document.getElementById('corr-len').value);
  const wid = parseInt(document.getElementById('corr-w').value);
  const { q, r } = getGenPos('corr-pos');
  document.getElementById('corridor-modal').style.display = 'none';
  generateCorridor(q, r, type, len, wid);
  render(); updateInfo();
  showToast(`🛤️ 已生成${type}走廊`);
});
document.getElementById('corridor-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// Template: Cave modal
['cave-w','cave-h'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = this.value;
  });
});
document.getElementById('cave-d').addEventListener('input', function() {
  document.getElementById('cave-d-val').textContent = this.value + '%';
});
document.getElementById('cave-cancel').addEventListener('click', () => { document.getElementById('cave-modal').style.display = 'none'; });
document.getElementById('cave-confirm').addEventListener('click', () => {
  const w = parseInt(document.getElementById('cave-w').value);
  const h = parseInt(document.getElementById('cave-h').value);
  const d = parseInt(document.getElementById('cave-d').value);
  const { q, r } = getGenPos('cave-pos');
  document.getElementById('cave-modal').style.display = 'none';
  generateCave(q, r, w, h, d);
  render(); updateInfo();
  showToast(`🕳️ 已生成 ${w}×${h} 洞窟`);
});
document.getElementById('cave-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// Template: Open Field modal
['open-w','open-h'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = this.value;
  });
});
document.getElementById('open-scatter').addEventListener('input', function() {
  document.getElementById('open-scatter-val').textContent = this.value + '%';
});
document.getElementById('open-cancel').addEventListener('click', () => { document.getElementById('open-modal').style.display = 'none'; });
document.getElementById('open-confirm').addEventListener('click', () => {
  const w = parseInt(document.getElementById('open-w').value);
  const h = parseInt(document.getElementById('open-h').value);
  const s = parseInt(document.getElementById('open-scatter').value);
  const { q, r } = getGenPos('open-pos');
  document.getElementById('open-modal').style.display = 'none';
  generateOpenField(q, r, w, h, s);
  render(); updateInfo();
  showToast(`🌿 已生成 ${w}×${h} 空地`);
});
document.getElementById('open-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// ============================================================

//  Template: Zone（智能区域模板，新人友好范例）
// ============================================================
function generateZone(centerQ, centerR, type, w, h, density, wallBorder) {
  beginBatch();
  const seed = Date.now() + 3;
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seed);
  const halfW = Math.floor(w / 2), halfH = Math.floor(h / 2);

  const setAt = (q, r, terrain) => setCell(centerQ + q, centerR + r, { terrain });

  for (let q = -halfW; q < w - halfW; q++) {
    for (let r = -halfH; r < h - halfH; r++) {
      const edge = q === -halfW || q === w - halfW - 1 || r === -halfH || r === h - halfH - 1;
      switch (type) {
        case 'difficult':
          if (edge) { setAt(q, r, 'floor'); break; }
          if (rng() < density / 100) setAt(q, r, 'difficult');
          else if (rng() < 0.08) setAt(q, r, rng() < 0.5 ? 'cover_half' : 'cover_full');
          else setAt(q, r, 'floor');
          break;
        case 'water':
          if (edge) { setAt(q, r, 'floor'); break; }
          if (rng() < density / 100) setAt(q, r, 'water');
          else if (rng() < 0.12) setAt(q, r, 'difficult'); // 浅滩
          else setAt(q, r, 'floor');
          break;
        case 'fire':
          if (edge) { setAt(q, r, 'floor'); break; }
          if (rng() < density / 100) setAt(q, r, 'hazard_fire');
          else setAt(q, r, 'floor');
          break;
        case 'acid':
          if (edge) { setAt(q, r, 'floor'); break; }
          if (rng() < density / 100) setAt(q, r, 'hazard_acid');
          else setAt(q, r, 'floor');
          break;
        case 'spike':
          if (edge) { setAt(q, r, 'floor'); break; }
          if (rng() < density / 100) setAt(q, r, 'hazard_spike');
          else setAt(q, r, 'floor');
          break;
        case 'elevated':
          if (edge) { setAt(q, r, 'wall_cell'); break; }
          setAt(q, r, 'elevated');
          if (rng() < 0.1) setAt(q, r, 'cover_half'); // 城垛
          break;
        case 'teach': {
          // 教学示例：中间墙柱 + 困难带 + 水池 + 火焰 + 高台 + 掩体
          if (edge) { setAt(q, r, 'floor'); break; }
          const dx = Math.abs(q), dy = Math.abs(r);
          if (dx === 2 && dy === 2) { setAt(q, r, 'wall_cell'); break; }           // 四角墙柱
          if (q === 0 && r === 0) { setAt(q, r, 'wall_cell'); break; }             // 中心柱
          if (dx === 0 && dy <= 2) { setAt(q, r, 'water'); break; }                // 中央水池
          if (dy === 0 && dx <= 2) { setAt(q, r, 'water'); break; }
          if (dx === 1 || dy === 1) { setAt(q, r, 'difficult'); break; }           // 困难带
          if (dx === 3 && dy === 3) { setAt(q, r, 'hazard_fire'); break; }         // 四角火焰
          if (rng() < 0.15) setAt(q, r, 'cover_half');
          else setAt(q, r, 'floor');
          break;
        }
      }
    }
  }

  // 边缘加墙
  if (wallBorder && type !== 'elevated') {
    const lastQ = w - halfW - 1, lastR = h - halfH - 1;
    for (let q = -halfW; q <= lastQ; q++) {
      setWall(centerQ + q, centerR - halfH, 0, 1);
      setWall(centerQ + q, centerR + lastR, 2, 1);
    }
    for (let r = -halfH; r <= lastR; r++) {
      setWall(centerQ - halfW, centerR + r, 3, 1);
      setWall(centerQ + lastQ, centerR + r, 1, 1);
    }
  }
  endBatch();
}

document.getElementById('btn-template-zone').addEventListener('click', () => { document.getElementById('zone-modal').style.display = 'block'; });
['zone-w','zone-h'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    document.getElementById(id + '-val').textContent = this.value;
  });
});
document.getElementById('zone-d').addEventListener('input', function() {
  document.getElementById('zone-d-val').textContent = this.value + '%';
});
document.getElementById('zone-cancel').addEventListener('click', () => { document.getElementById('zone-modal').style.display = 'none'; });
document.getElementById('zone-confirm').addEventListener('click', () => {
  const type = document.getElementById('zone-type').value;
  const w = parseInt(document.getElementById('zone-w').value);
  const h = parseInt(document.getElementById('zone-h').value);
  const d = parseInt(document.getElementById('zone-d').value);
  const wall = document.getElementById('zone-wall').checked;
  const { q, r } = getGenPos('zone-pos');
  document.getElementById('zone-modal').style.display = 'none';
  generateZone(q, r, type, w, h, d, wall);
  render(); updateInfo();
  showToast(`🧩 已生成区域「${document.getElementById('zone-type').selectedOptions[0].textContent.trim()}」`);
});
document.getElementById('zone-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

// ============================================================
