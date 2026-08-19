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
    case 'unit':
      hint.innerHTML = _unitPending ? `🧝 点击地图放置 <b>${_unitPending.name || '单位'}</b>，Esc 取消` : '🧝 点击「放置单位」配置后点击地图放置，右键改属性';
      coord.textContent = '🧝 单位模式';
      cnt.style.cursor = _unitPending ? 'crosshair' : 'pointer';
      break;
    case 'line':
      hint.innerHTML = '📏 <b>拖拽</b>画任意角度线段（墙/视线阻挡/效果线），右键改颜色线宽';
      coord.textContent = '📏 线段模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'dm':
      hint.innerHTML = '🕵️ 点击格子添加 <b>DM 隐藏标记/说明</b>；勾选「显示 DM 层」查看，未勾选时玩家图完全不可见';
      coord.textContent = '🕵️ DM 层模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'fog':
      hint.innerHTML = '🌫️ 点击/拖拽 <b>遮住</b>格子，按住 <b>Alt</b> 或点击已遮格可以<b>揭示</b>；用「擦除→仅战雾」可批量清除';
      coord.textContent = '🌫️ 战雾模式';
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
  if (!confirm('⚠️ 确认清空所有数据（地形/图形/线段/单位/DM层/战雾/行动顺序）？此操作可撤销。')) return;
  beginBatch();
  for (const key of Object.keys(combatData)) pushUndo(key);
  pushUndoMeta();
  combatData = {};
  shapes = [];
  freeLines = [];
  tokens = [];
  dmData = {};
  fog = {};
  initiativeOrder = [];
  initiativeIndex = 0;
  endBatch();
  selectedCell = null;
  selectedShape = null; selectedLine = null; selectedToken = null;
  render(); updateInfo();
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
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
  // Delete: 删除选中图形/线段/单位
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedToken) {
      pushUndoMeta();
      tokens = tokens.filter(x => x.id !== selectedToken);
      selectedToken = null;
      render(); updateInfo();
      return;
    }
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
  // Esc: 取消图片/单位放置
  if (e.key === 'Escape' && (_tokenPending || _unitPending)) {
    _tokenPending = null; _hoverToken = null;
    _unitPending = null; _hoverUnit = null;
    setTool('select');
    render();
    return;
  }
  const km = { 'v':'select', 'b':'paint', 'w':'wall', 'd':'door', 'l':'label', 'e':'erase', 'r':'rect', 't':'token', 'g':'line', 'u':'unit', 'y':'dm', 'f':'fog' };
  if (km[e.key?.toLowerCase()]) { e.preventDefault(); setTool(km[e.key.toLowerCase()]); }
  // 分享弹窗：Esc 关闭
  if (e.key === 'Escape') {
    const shareModal = document.getElementById('share-modal');
    if (shareModal && shareModal.style.display === 'block') {
      if (typeof closeCombatShareModal === 'function') closeCombatShareModal();
      return;
    }
    const dmModal = document.getElementById('dm-modal');
    if (dmModal && dmModal.style.display === 'block') {
      closeDmModal();
      return;
    }
    const initModal = document.getElementById('initiative-modal');
    if (initModal && initModal.style.display === 'block') {
      closeInitiativeModal();
      return;
    }
  }
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
document.getElementById('chk-dm').addEventListener('change', (e) => { showDmLayer = e.target.checked; render(); });
document.getElementById('chk-fog').addEventListener('change', (e) => { showFogLayer = e.target.checked; render(); });

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

// 单位工具按钮：打开单位创建/编辑弹窗
document.querySelectorAll('.tool-btn[data-tool="unit"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!_unitPending) openUnitModal();
  });
});

// ============================================================
//  Unit Token Modal（单位层）
// ============================================================
const UNIT_STATUS_OPTIONS = [
  ['中毒', '☠️'], ['倒地', '🟥'], ['昏迷', '💫'], ['专注', '🎯'],
  ['减速', '🐢'], ['燃烧', '🔥'], ['冰冻', '🧊'], ['隐形', '👻']
];

function openUnitModal(token) {
  const modal = document.getElementById('unit-modal');
  const isEdit = !!token;
  document.getElementById('unit-modal-title').textContent = isEdit ? '编辑' : '新建';
  document.getElementById('unit-id').value = token?.id || '';
  document.getElementById('unit-name').value = token?.name || '';
  document.getElementById('unit-kind').value = token?.kind || 'player';
  document.getElementById('unit-icon').value = token?.icon || '🧝';
  document.getElementById('unit-color').value = token?.color || '#3a7abd';
  document.getElementById('unit-hp').value = token?.hp ?? 10;
  document.getElementById('unit-maxhp').value = token?.maxHp ?? 10;
  document.getElementById('unit-w').value = token?.w ?? 1;
  document.getElementById('unit-h').value = token?.h ?? 1;
  document.getElementById('unit-delete').style.display = isEdit ? 'block' : 'none';
  // 状态复选框
  const ck = document.getElementById('unit-status-checkboxes');
  ck.innerHTML = '';
  UNIT_STATUS_OPTIONS.forEach(([label, icon]) => {
    const lid = 'st-' + label;
    const lab = document.createElement('label');
    lab.style.cssText = 'display:inline-flex;align-items:center;gap:2px;background:#1a1a2e;border:1px solid #0f3460;border-radius:4px;padding:2px 5px;cursor:pointer;';
    lab.innerHTML = `<input type="checkbox" id="${lid}" value="${label}" style="width:auto;"> ${icon} ${label}`;
    const cb = lab.querySelector('input');
    cb.checked = (token?.status || []).includes(label);
    ck.appendChild(lab);
  });
  modal.style.display = 'block';
}

function closeUnitModal() {
  document.getElementById('unit-modal').style.display = 'none';
}

function saveUnitModal() {
  const id = document.getElementById('unit-id').value;
  const status = [];
  document.querySelectorAll('#unit-status-checkboxes input:checked').forEach(cb => status.push(cb.value));
  const data = {
    name: document.getElementById('unit-name').value.trim(),
    kind: document.getElementById('unit-kind').value,
    icon: document.getElementById('unit-icon').value.trim() || '🧝',
    color: document.getElementById('unit-color').value,
    hp: Math.max(0, parseInt(document.getElementById('unit-hp').value) || 0),
    maxHp: Math.max(1, parseInt(document.getElementById('unit-maxhp').value) || 1),
    w: Math.max(0.2, parseInt(document.getElementById('unit-w').value) || 1),
    h: Math.max(0.2, parseInt(document.getElementById('unit-h').value) || 1),
    status
  };
  if (id) {
    const t = tokens.find(x => x.id === id);
    if (t) {
      pushUndoMeta();
      Object.assign(t, data);
      closeUnitModal();
      render(); updateInfo();
      showToast('✅ 单位已更新');
      return;
    }
  }
  // 新建：进入放置模式
  _unitPending = { ...data, imgData: '', img: null };
  setTool('unit');
  closeUnitModal();
  showToast('🧝 点击地图放置单位');
}

function deleteUnitConfirm() {
  const id = document.getElementById('unit-id').value;
  if (!id) return;
  pushUndoMeta();
  tokens = tokens.filter(x => x.id !== id);
  if (selectedToken === id) selectedToken = null;
  closeUnitModal();
  render(); updateInfo();
  showToast('🗑️ 已删除单位');
}

// 单位弹窗事件绑定
document.getElementById('unit-confirm').addEventListener('click', saveUnitModal);
document.getElementById('unit-cancel').addEventListener('click', closeUnitModal);
document.getElementById('unit-delete').addEventListener('click', deleteUnitConfirm);
document.getElementById('unit-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });

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
//  DM Layer Modal（隐藏层标记）
// ============================================================
function showDmModal(q, r) {
  const d = getDmCell(q, r);
  document.getElementById('dm-modal-q').value = q;
  document.getElementById('dm-modal-r').value = r;
  document.getElementById('dm-modal-coord').textContent = `(${q}, ${r})`;
  document.getElementById('dm-modal-mark').value = d.mark || '';
  document.getElementById('dm-modal-label').value = d.label || '';
  document.getElementById('dm-modal').style.display = 'block';
  setTimeout(() => document.getElementById('dm-modal-mark').focus(), 50);
}

function closeDmModal() {
  document.getElementById('dm-modal').style.display = 'none';
}

function saveDmModal() {
  const q = parseInt(document.getElementById('dm-modal-q').value);
  const r = parseInt(document.getElementById('dm-modal-r').value);
  const mark = document.getElementById('dm-modal-mark').value.trim();
  const label = document.getElementById('dm-modal-label').value.trim();
  setDmCell(q, r, { mark, label });
  showDmLayer = true;
  const dmCheck = document.getElementById('chk-dm');
  if (dmCheck && !dmCheck.checked) dmCheck.checked = true;
  closeDmModal();
  selectedCell = { q, r };
  render(); updateInfo();
  showToast('🕵️ DM 层已保存（未勾选“显示 DM 层”时玩家不可见）');
}

document.getElementById('dm-modal-confirm').addEventListener('click', saveDmModal);
document.getElementById('dm-modal-cancel').addEventListener('click', closeDmModal);
document.getElementById('dm-modal-clear').addEventListener('click', () => {
  const q = parseInt(document.getElementById('dm-modal-q').value);
  const r = parseInt(document.getElementById('dm-modal-r').value);
  removeDmCell(q, r);
  closeDmModal();
  render(); updateInfo();
  showToast('🗑️ 已清除 DM 层标记');
});
document.getElementById('dm-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
document.getElementById('dm-modal-mark').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') saveDmModal();
  if (e.key === 'Escape') closeDmModal();
});

// ============================================================
//  Initiative / Turn Order Panel
// ============================================================
function initiativeEntryRow(item, idx) {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #0f3460;border-radius:4px;margin-bottom:4px;background:' + (idx === initiativeIndex ? 'rgba(45,106,46,0.35)' : '#1a1a2e') + ';';
  const marker = document.createElement('span');
  marker.textContent = idx === initiativeIndex ? '▶️' : (idx + 1);
  marker.style.cssText = 'width:22px;text-align:center;flex-shrink:0;color:#ffd700;font-size:12px;';
  const icon = document.createElement('span');
  icon.textContent = item.icon || '🧝';
  icon.style.cssText = 'font-size:15px;flex-shrink:0;';
  const name = document.createElement('span');
  name.textContent = item.name || '未命名';
  name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#fff;cursor:pointer;';
  name.title = '点击编辑 HP';
  name.addEventListener('click', () => editInitiativeEntry(idx));
  const hp = document.createElement('span');
  hp.textContent = (item.hp !== '' && item.hp !== undefined) ? `${item.hp}/${item.maxHp ?? ''}` : '';
  hp.style.cssText = 'font-size:11px;color:#aaa;min-width:38px;text-align:right;cursor:pointer;';
  hp.addEventListener('click', () => editInitiativeEntry(idx));
  const up = document.createElement('button');
  up.textContent = '↑';
  up.title = '上移';
  up.style.cssText = 'padding:2px 5px;background:#3a3a5e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
  up.addEventListener('click', () => moveInitiativeAt(idx, idx - 1));
  const down = document.createElement('button');
  down.textContent = '↓';
  down.title = '下移';
  down.style.cssText = 'padding:2px 5px;background:#3a3a5e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
  down.addEventListener('click', () => moveInitiativeAt(idx, idx + 1));
  const del = document.createElement('button');
  del.textContent = '✕';
  del.title = '删除';
  del.style.cssText = 'padding:2px 6px;background:#a33;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
  del.addEventListener('click', () => removeInitiativeAt(idx));
  div.appendChild(marker); div.appendChild(icon); div.appendChild(name); div.appendChild(hp); div.appendChild(up); div.appendChild(down); div.appendChild(del);
  return div;
}

function updateInitiativePanel() {
  const list = document.getElementById('initiative-list');
  if (!list) return;
  list.innerHTML = '';
  if (!initiativeOrder.length) {
    list.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;padding:8px;">暂无行动顺序条目。可从单位导入，或手动添加。</div>';
    return;
  }
  initiativeOrder.forEach((item, idx) => { list.appendChild(initiativeEntryRow(item, idx)); });
}

function openInitiativeModal() {
  document.getElementById('initiative-modal').style.display = 'block';
  updateInitiativePanel();
}

function closeInitiativeModal() {
  document.getElementById('initiative-modal').style.display = 'none';
}

function editInitiativeEntry(idx) {
  const item = initiativeOrder[idx];
  if (!item) return;
  const hp = prompt(`条目 "${item.name || '未命名'}" 的 HP（当前/上限，留空表示无血条）：`, item.hp !== '' ? `${item.hp}/${item.maxHp ?? ''}` : '');
  if (hp === null) return;
  const parts = hp.split('/').map(s => s.trim());
  pushUndoMeta();
  if (parts.length >= 2) {
    item.hp = parts[0] === '' ? '' : Math.max(0, parseInt(parts[0]) || 0);
    item.maxHp = parts[1] === '' ? '' : Math.max(0, parseInt(parts[1]) || 0);
  } else {
    item.hp = hp === '' ? '' : Math.max(0, parseInt(hp) || 0);
    item.maxHp = item.maxHp ?? '';
  }
  updateInitiativePanel();
}

document.getElementById('btn-initiative').addEventListener('click', openInitiativeModal);
document.getElementById('initiative-close').addEventListener('click', closeInitiativeModal);
document.getElementById('initiative-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
document.getElementById('initiative-add').addEventListener('click', () => {
  const name = prompt('新条目名称：', '');
  if (name === null) return;
  pushUndoMeta();
  initiativeOrder.push({ id: 'init_' + Date.now().toString(36), name: name.trim() || '未命名', icon: '⚔️', kind: 'npc', hp: '', maxHp: '' });
  updateInitiativePanel();
});
document.getElementById('initiative-add-tokens').addEventListener('click', () => {
  const oldLen = initiativeOrder.length;
  addAllTokensToInitiative();
  updateInitiativePanel();
  showToast(`🧝 已导入 ${initiativeOrder.length - oldLen} 个单位到行动顺序`);
});
document.getElementById('initiative-clear').addEventListener('click', () => {
  if (!confirm('清空行动顺序？')) return;
  clearInitiative();
  updateInitiativePanel();
});
document.getElementById('initiative-next').addEventListener('click', () => {
  nextInitiative();
  updateInitiativePanel();
});
document.getElementById('initiative-prev').addEventListener('click', () => {
  prevInitiative();
  updateInitiativePanel();
});

// ============================================================
//  Import Background Map (图片底图 + 网格对齐)
// ============================================================
function importBackgroundMapFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // 默认按原始图片的宽高比铺到 20×? 格子区域，起点放在 0,0
        const defCols = Math.max(5, Math.round(img.width / 48));
        const defRows = Math.max(5, Math.round(img.height / 48));
        pushUndoMeta();
        backgroundMap = {
          id: 'bgmap_' + Date.now().toString(36),
          imgData: ev.target.result,
          img,
          x: 0, y: 0,
          cols: defCols,
          rows: defRows,
          opacity: 0.85
        };
        render();
        openMapSettingsModal();
        showToast(`🖼️ 已导入底图 ${img.width}×${img.height}px，默认 ${defCols}×${defRows} 格`);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function openMapSettingsModal() {
  const modal = document.getElementById('map-settings-modal');
  if (!modal) return;
  if (!backgroundMap) { showToast('⚠️ 请先导入底图'); return; }
  document.getElementById('bg-settings-x').value = backgroundMap.x;
  document.getElementById('bg-settings-y').value = backgroundMap.y;
  document.getElementById('bg-settings-cols').value = backgroundMap.cols;
  document.getElementById('bg-settings-rows').value = backgroundMap.rows;
  document.getElementById('bg-settings-opacity').value = Math.round((backgroundMap.opacity ?? 0.85) * 100);
  document.getElementById('map-settings-opacity-val').textContent = Math.round((backgroundMap.opacity ?? 0.85) * 100) + '%';
  document.getElementById('map-settings-img').style.display = backgroundMap.imgData ? 'block' : 'none';
  document.getElementById('map-settings-img').src = backgroundMap.imgData || '';
  modal.style.display = 'block';
}

function applyMapSettings() {
  if (!backgroundMap) return;
  pushUndoMeta();
  backgroundMap.x = parseFloat(document.getElementById('bg-settings-x').value) || 0;
  backgroundMap.y = parseFloat(document.getElementById('bg-settings-y').value) || 0;
  backgroundMap.cols = Math.max(1, parseFloat(document.getElementById('bg-settings-cols').value) || 8);
  backgroundMap.rows = Math.max(1, parseFloat(document.getElementById('bg-settings-rows').value) || 8);
  backgroundMap.opacity = Math.max(0, Math.min(1, (parseInt(document.getElementById('bg-settings-opacity').value) || 85) / 100));
  document.getElementById('map-settings-modal').style.display = 'none';
  render();
  showToast('⚙️ 底图设置已应用');
}

function removeBackgroundMap() {
  if (!backgroundMap) return;
  if (!confirm('移除当前底图？此操作可撤销。')) return;
  pushUndoMeta();
  backgroundMap = null;
  document.getElementById('map-settings-modal').style.display = 'none';
  render();
  showToast('🗑️ 底图已移除');
}

function setBackgroundOpacityDisplay() {
  const v = document.getElementById('bg-settings-opacity').value;
  const el = document.getElementById('map-settings-opacity-val');
  if (el) el.textContent = v + '%';
}

function startBgAlign() {
  if (!backgroundMap) { showToast('⚠️ 请先导入底图'); return; }
  _bgAlignRefs = { pts: [], mode: 'click' };
  const modal = document.getElementById('map-settings-modal');
  if (modal) modal.style.display = 'none';
  const bar = document.getElementById('bg-align-bar');
  if (bar) bar.style.display = 'flex';
  updateBgAlignBar();
  render();
}

function updateBgAlignStatus(text) {
  const el = document.getElementById('bg-align-status');
  if (el) el.textContent = text || '';
}

function updateBgAlignBar() {
  const n = (_bgAlignRefs && _bgAlignRefs.pts) ? _bgAlignRefs.pts.length : 0;
  if (n === 0) updateBgAlignStatus('🎯 第 1 点：点击图中一个格线交点（基准点）');
  else if (n === 1) updateBgAlignStatus('🎯 第 2 点：点击同一水平线上的格线交点');
  else if (n === 2) updateBgAlignStatus('🎯 第 3 点：点击向下方向上的格线交点（可点「完成」用 2 点结束）');
  else updateBgAlignStatus('✅ 已收集 3 个点，点「完成」应用对齐');
}

function cancelBgAlign() {
  _bgAlignRefs = null;
  _bgDragMode = null;
  isDragging = false;
  const bar = document.getElementById('bg-align-bar');
  if (bar) bar.style.display = 'none';
  render();
  showToast('✕ 已取消底图对齐');
}

function finishBgAlign() {
  if (!_bgAlignRefs) return;
  if (!_bgAlignRefs.pts || _bgAlignRefs.pts.length < 2) {
    showToast('⚠️ 至少需要点击 2 个参考点');
    return;
  }
  applyBgAlignFromRefs();
  finishBgAlignAfterApply();
  showToast('✅ 底图对齐完成');
}

// 已完成时从 applyBgAlignFromRefs 里也收起状态条
function finishBgAlignAfterApply() {
  const bar = document.getElementById('bg-align-bar');
  if (bar) bar.style.display = 'none';
  _bgAlignRefs = null;
  _bgDragMode = null;
  isDragging = false;
  render();
}

// 事件绑定：对齐模式 UI
document.getElementById('btn-bg-align').addEventListener('click', startBgAlign);
document.getElementById('map-settings-begin-align').addEventListener('click', startBgAlign);
document.getElementById('bg-align-finish').addEventListener('click', finishBgAlign);
document.getElementById('bg-align-cancel').addEventListener('click', cancelBgAlign);

function applyBgAlignFromRefs() {
  if (!_bgAlignRefs || !backgroundMap) return;
  const pts = _bgAlignRefs.pts;
  if (pts.length < 3) {
    // 不足 3 点时也允许用 2 点粗略对齐
    if (pts.length >= 2) {
      const p0 = pts[0], p1 = pts[1];
      const worldLen = Math.hypot(p1.world.x - p0.world.x, p1.world.y - p0.world.y);
      const gridLen = Math.hypot(p1.snappedGrid.q - p0.snappedGrid.q, p1.snappedGrid.r - p0.snappedGrid.r) * CELL_SIZE;
      if (worldLen > 0.5 && gridLen > 0.5) {
        const pxPerGrid = worldLen / gridLen;
        const imgPxW = (backgroundMap.img && backgroundMap.img.naturalWidth) || Math.max(1, backgroundMap.cols * CELL_SIZE);
        const imgPxH = (backgroundMap.img && backgroundMap.img.naturalHeight) || Math.max(1, backgroundMap.rows * CELL_SIZE);
        backgroundMap.cols = imgPxW / pxPerGrid;
        backgroundMap.rows = imgPxH / pxPerGrid;
        backgroundMap.x = p0.snappedGrid.q - (p0.world.x - backgroundMap.x * CELL_SIZE) / pxPerGrid;
        backgroundMap.y = p0.snappedGrid.r - (p0.world.y - backgroundMap.y * CELL_SIZE) / pxPerGrid;
      }
    }
    return;
  }
  // 3 点完整解算
  const p0 = pts[0], p1 = pts[1], p2 = pts[2];
  const g0 = p0.snappedGrid;
  const dWx = p1.world.x - p0.world.x, dWy = p1.world.y - p0.world.y;
  const dGx = p1.snappedGrid.q - g0.q, dGy = p1.snappedGrid.r - g0.r;
  const lenW = Math.hypot(dWx, dWy);
  const lenG = Math.hypot(dGx, dGy);
  if (lenW < 0.5 || lenG < 0.5) { return; }
  const pxPerGrid = lenW / lenG;
  const imgPxW = (backgroundMap.img && backgroundMap.img.naturalWidth) || Math.max(1, backgroundMap.cols * CELL_SIZE);
  const imgPxH = (backgroundMap.img && backgroundMap.img.naturalHeight) || Math.max(1, backgroundMap.rows * CELL_SIZE);
  backgroundMap.cols = imgPxW / pxPerGrid;
  backgroundMap.rows = imgPxH / pxPerGrid;
  backgroundMap.x = g0.q - (p0.world.x - backgroundMap.x * CELL_SIZE) / pxPerGrid;
  backgroundMap.y = g0.r - (p0.world.y - backgroundMap.y * CELL_SIZE) / pxPerGrid;
}

// Esc/右键离开对齐模式在交互层统一处理
// 实时预览：修改设置后立即应用到画布，方便网格对齐
['bg-settings-x','bg-settings-y'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    if (!backgroundMap) return;
    backgroundMap.x = parseFloat(document.getElementById('bg-settings-x').value) || 0;
    backgroundMap.y = parseFloat(document.getElementById('bg-settings-y').value) || 0;
    render();
  });
});
['bg-settings-cols','bg-settings-rows'].forEach(id => {
  document.getElementById(id).addEventListener('input', function() {
    if (!backgroundMap) return;
    backgroundMap.cols = Math.max(1, parseFloat(document.getElementById('bg-settings-cols').value) || 8);
    backgroundMap.rows = Math.max(1, parseFloat(document.getElementById('bg-settings-rows').value) || 8);
    render();
  });
});
document.getElementById('bg-settings-opacity').addEventListener('input', function() {
  setBackgroundOpacityDisplay();
  if (!backgroundMap) return;
  backgroundMap.opacity = Math.max(0, Math.min(1, (parseInt(this.value) || 85) / 100));
  render();
});

document.getElementById('btn-import-map').addEventListener('click', importBackgroundMapFromFile);
document.getElementById('btn-map-settings').addEventListener('click', openMapSettingsModal);
document.getElementById('map-settings-confirm').addEventListener('click', applyMapSettings);
document.getElementById('map-settings-remove').addEventListener('click', removeBackgroundMap);
document.getElementById('map-settings-close').addEventListener('click', () => { document.getElementById('map-settings-modal').style.display = 'none'; });
document.getElementById('map-settings-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) this.style.display = 'none'; });

// ============================================================
