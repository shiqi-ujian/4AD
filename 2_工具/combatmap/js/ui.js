//  Tool Switching
// ============================================================
function setTool(tool) {
  // 玩家视图下禁止使用 DM 专属工具
  if ((tool === 'dm' || tool === 'fog') && viewRoleIsPlayer()) {
    showToast('👁️ 玩家视图下不可使用 DM 工具');
    return;
  }
  // 切换工具时清理未放置的拾取状态，避免"摆放过一次就卡在放置模式"
  if (tool !== 'unit') { _unitPending = null; _hoverUnit = null; }
  if (tool !== 'token') { _tokenPending = null; _hoverToken = null; }
  if (tool !== 'measure') { _measure = null; }  // 离开测量工具清除测距叠加层

  selectedTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  document.getElementById('erase-options').style.display = tool === 'erase' ? 'block' : 'none';
  const fogOpts = document.getElementById('fog-options');
  if (fogOpts) fogOpts.style.display = tool === 'fog' ? 'block' : 'none';

  const hint = document.getElementById('tool-hint');
  const coord = document.getElementById('coord-indicator');
  const cnt = document.getElementById('canvas-container');

  switch (tool) {
    case 'select':
      hint.innerHTML = '👆 点击格子查看信息；点击区域/线段/图片可拖动、缩放（8 手柄），双击或右键改属性，Delete 删除；Shift/Ctrl 点单位可多选，Ctrl+D 复制';
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
      hint.innerHTML = _tokenPending ? '🖼️ 点击地图放置图片，按住 Shift 可连放，Esc 取消' : '🖼️ 点击按钮后选择图片文件，然后点击地图放置';
      coord.textContent = '🖼️ 图片模式';
      cnt.style.cursor = _tokenPending ? 'crosshair' : 'pointer';
      break;
    case 'unit':
      hint.innerHTML = _unitPending ? `🧝 点击地图放置 <b>${_unitPending.name || '单位'}</b>，按住 Shift 连放，Esc 取消` : '🧝 从「单位库」选择预设拿起后放置，或点「➕ 新建预设」';
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
      hint.innerHTML = fogMode === 'reveal'
        ? '✨ 点击/拖拽 <b>揭示</b>已遮格子；切回「🌫️ 遮住」涂雾，按住 <b>Alt</b> 可临时揭示'
        : '🌫️ 点击/拖拽 <b>遮住</b>格子；切到 <b>✨ 揭示</b> 揭开已遮格，按住 <b>Alt</b> 临时揭示；「擦除→仅战雾」可批量清除';
      coord.textContent = fogMode === 'reveal' ? '✨ 揭示模式' : '🌫️ 遮住模式';
      cnt.style.cursor = 'crosshair';
      break;
    case 'measure':
      hint.innerHTML = '📏 在画布上<b>按住并拖拽</b>测距：显示距离(格/英尺)与沿线的慢速地形等效移动';
      coord.textContent = '📏 测量模式';
      cnt.style.cursor = 'crosshair';
      break;
  }
  render();
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

// ============================================================
//  Fog Mode Switcher (🌫️ 遮住 / ✨ 揭示) — 明确替代隐蔽的 Alt 快捷键
// ============================================================
function setFogMode(mode) {
  fogMode = (mode === 'reveal') ? 'reveal' : 'cover';
  const cover = document.getElementById('fog-mode-cover');
  const reveal = document.getElementById('fog-mode-reveal');
  if (cover) cover.classList.toggle('active', fogMode === 'cover');
  if (reveal) reveal.classList.toggle('active', fogMode === 'reveal');
  if (selectedTool === 'fog') setTool('fog');  // 刷新提示/状态
  else render();
}
const fogModeCover = document.getElementById('fog-mode-cover');
if (fogModeCover) fogModeCover.addEventListener('click', () => setFogMode('cover'));
const fogModeReveal = document.getElementById('fog-mode-reveal');
if (fogModeReveal) fogModeReveal.addEventListener('click', () => setFogMode('reveal'));

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
      const badge = document.getElementById('terrain-selected');
      if (badge) { badge.textContent = `${ti.icon} ${ti.name}`; badge.title = ti.desc || ''; }
    });
    palette.appendChild(btn);
  });
  const badge = document.getElementById('terrain-selected');
  if (badge) {
    const ti = getTerrain(selectedTerrain);
    if (ti) { badge.textContent = `${ti.icon} ${ti.name}`; badge.title = ti.desc || ''; }
  }
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
  _unitPending = null; _hoverUnit = null;
  _tokenPending = null; _hoverToken = null;
  render(); updateInfo();
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
  updateEmptyState();
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
  // Ctrl/Cmd+D: 复制选中单位
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault();
    duplicateTokens();
    return;
  }
  // Delete: 删除选中图形/线段/单位（多选优先）
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedTokens && selectedTokens.size > 0) {
      const ids = Array.from(selectedTokens).filter(id => tokens.some(t => t.id === id));
      if (ids.length) {
        pushUndoMeta();
        tokens = tokens.filter(t => !ids.includes(t.id));
        ids.forEach(id => clearInitiativeTokenRefs(id));
        selectedTokens = new Set();
        selectedToken = null;
        pruneGroups();
        render(); updateInfo();
        if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
        return;
      }
    }
    if (selectedToken) {
      pushUndoMeta();
      if (viewSourceTokenId === selectedToken) viewSourceTokenId = null;
      tokens = tokens.filter(x => x.id !== selectedToken);
      clearInitiativeTokenRefs(selectedToken);
      selectedToken = null;
      pruneGroups();
      render(); updateInfo();
      if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
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

  // Esc: 取消图片/单位放置 / 清空多选
  if (e.key === 'Escape' && (_tokenPending || _unitPending)) {
    _tokenPending = null; _hoverToken = null;
    _unitPending = null; _hoverUnit = null;
    setTool('select');
    render();
    return;
  }
  if (e.key === 'Escape' && selectedTokens && selectedTokens.size > 1) {
    clearSelection();
    render(); updateInfo();
    return;
  }
  if (e.key === 'Escape' && selectedToken && (!selectedTokens || selectedTokens.size <= 1)) {
    clearSelection();
    render(); updateInfo();
    return;
  }
  // Esc: 清除测距叠加层 / 恢复全部视角源
  if (e.key === 'Escape' && _measure) {
    _measure = null;
    render();
    return;
  }
  if (e.key === 'Escape' && viewSourceTokenId) {
    viewSourceTokenId = null;
    render();
    showToast('👁️ 已恢复全部视野源');
    return;
  }
  // U：打开单位库（token 管理）
  if (e.key === 'u' || e.key === 'U') {
    e.preventDefault();
    if (_unitPending) {
      _unitPending = null; _hoverUnit = null;
      setTool('select');
      showToast('✕ 已取消单位放置');
    } else {
      openTokenLibrarySection();
    }
    return;
  }
  const km = { 'v':'select', 'b':'paint', 'w':'wall', 'd':'door', 'l':'label', 'e':'erase', 'r':'rect', 't':'token', 'g':'line', 'y':'dm', 'f':'fog', 'm':'measure' };
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

//  Button Bindings（用懒包装调用 export.js 里的函数，保证 dev 多文件模式也可用）
// ============================================================
document.getElementById('btn-export-excel').addEventListener('click', () => exportToExcel());
document.getElementById('btn-export-img').addEventListener('click', () => exportPNG());
document.getElementById('btn-export-legend').addEventListener('click', () => exportLegendPNG());
document.getElementById('btn-export-owlbear').addEventListener('click', () => exportOwlbearScene());
document.getElementById('btn-save').addEventListener('click', () => saveJSON());
document.getElementById('btn-load').addEventListener('click', () => loadJSON());
document.getElementById('btn-cloud-save').addEventListener('click', () => { if (typeof manualCloudSave === 'function') manualCloudSave(); });
document.getElementById('btn-cloud-new').addEventListener('click', () => { if (typeof newCloudMap === 'function') newCloudMap(); });
document.getElementById('btn-clear').addEventListener('click', clearAll);
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// ============================================================
//  Scenes UI (🎬 多场景切换)
// ============================================================
function renderSceneList() {
  const list = document.getElementById('scene-list');
  if (!list) return;
  ensureScenes();
  list.innerHTML = '';
  scenes.forEach(s => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:3px;padding:4px 6px;margin:2px 0;border-radius:5px;cursor:pointer;font-size:12px;background:' + (s.id === activeSceneId ? 'rgba(122,74,158,0.35)' : '#1a1a2e') + ';border:1px solid ' + (s.id === activeSceneId ? '#b98ae0' : '#0f3460') + ';';
    const name = document.createElement('span');
    name.textContent = s.name || '未命名';
    name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (s.id === activeSceneId ? '#fff' : '#ccc') + ';';
    name.title = (s.data && Object.keys(s.data.combatData || {}).length ? Object.keys(s.data.combatData).length : 0) + ' 格';
    row.appendChild(name);
    row.addEventListener('click', () => switchScene(s.id));
    const bits = [
      ['✏️', () => { const n = prompt('重命名场景', s.name); if (n) renameScene(s.id, n); }],
      ['🧬', () => duplicateScene(s.id)],
      ['🗑️', () => { if (confirm('删除场景「' + (s.name || '') + '」？')) deleteScene(s.id); }]
    ];
    bits.forEach(([icon, fn]) => {
      const b = document.createElement('button');
      b.textContent = icon;
      b.style.cssText = 'background:transparent;border:none;color:#aaa;cursor:pointer;font-size:11px;padding:0 3px;';
      b.title = icon === '✏️' ? '重命名' : icon === '🧬' ? '复制' : '删除';
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      row.appendChild(b);
    });
    list.appendChild(row);
  });
}

document.getElementById('btn-scene-new').addEventListener('click', () => newScene());
if (typeof ensureScenes === 'function') ensureScenes();
if (typeof renderSceneList === 'function') renderSceneList();
document.getElementById('chk-grid').addEventListener('change', (e) => { showGrid = e.target.checked; render(); });
document.getElementById('chk-coords').addEventListener('change', (e) => { showCoords = e.target.checked; render(); });
document.getElementById('chk-dm').addEventListener('change', (e) => { showDmLayer = e.target.checked; dmLayerPref = e.target.checked; render(); });
document.getElementById('chk-fog').addEventListener('change', (e) => { showFogLayer = e.target.checked; render(); });
document.getElementById('chk-vision').addEventListener('change', (e) => { visionMode = e.target.checked ? 'auto' : 'manual'; render(); });
document.getElementById('chk-art-style').addEventListener('change', (e) => { setArtStyle(e.target.checked ? 'handdrawn' : 'classic'); });

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

// 图片工具按钮：点击选择文件；已有待放置图片时点击=取消
document.querySelectorAll('.tool-btn[data-tool="token"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (_tokenPending) {
      _tokenPending = null; _hoverToken = null;
      setTool('select');
      showToast('✕ 已取消图片放置');
      return;
    }
    pickTokenImage();
  });
});

// 单位工具按钮：打开单位库选择预设（管理 token 的地方）；已拿起时点击=取消
document.querySelectorAll('.tool-btn[data-tool="unit"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (_unitPending) {
      _unitPending = null; _hoverUnit = null;
      setTool('select');
      showToast('✕ 已取消单位放置');
      return;
    }
    openTokenLibrarySection();
  });
});

// ============================================================
//  Unit Token Modal（单位层）
// ============================================================
const UNIT_STATUS_OPTIONS = [
  ['中毒', '☠️'], ['倒地', '🟥'], ['昏迷', '💫'], ['专注', '🎯'],
  ['减速', '🐢'], ['燃烧', '🔥'], ['冰冻', '🧊'], ['隐形', '👻']
];
const LS_UNIT_STATUS_KEY = 'combatmap_custom_unit_statuses_v1';
function loadCustomUnitStatuses() {
  try {
    const raw = localStorage.getItem(LS_UNIT_STATUS_KEY);
    if (raw) customUnitStatuses = JSON.parse(raw) || [];
  } catch (e) { /* ignore */ }
}
function saveCustomUnitStatuses() {
  try { localStorage.setItem(LS_UNIT_STATUS_KEY, JSON.stringify(customUnitStatuses || [])); } catch (e) { /* ignore */ }
}
loadCustomUnitStatuses();

function openUnitModal(token, mode) {
  mode = mode || '';
  const modal = document.getElementById('unit-modal');
  const isEdit = !!token;
  const isLib = mode === 'lib';
  document.getElementById('unit-modal-mode').value = mode;
  document.getElementById('unit-modal-title').textContent = isLib ? (isEdit ? '编辑预设' : '新建预设') : (isEdit ? '编辑' : '新建');
  document.getElementById('unit-id').value = token?.id || '';
  document.getElementById('unit-name').value = token?.name || '';
  document.getElementById('unit-kind').value = token?.kind || 'player';
  document.getElementById('unit-icon').value = token?.icon || '🧝';
  document.getElementById('unit-color').value = token?.color || '#3a7abd';
  document.getElementById('unit-hp').value = token?.hp ?? 10;
  document.getElementById('unit-maxhp').value = token?.maxHp ?? 10;
  document.getElementById('unit-temphp').value = token?.tempHp ?? 0;
  document.getElementById('unit-ac').value = token?.ac ?? '';
  document.getElementById('unit-speed').value = token?.speed ?? '';
  document.getElementById('unit-notes').value = token?.notes ?? '';
  document.getElementById('unit-w').value = token?.w ?? 1;
  document.getElementById('unit-h').value = token?.h ?? 1;
  document.getElementById('unit-sight').value = (typeof token?.sightRadius === 'number') ? token.sightRadius : 6;
  document.getElementById('unit-vision').checked = token?.visionSource ?? (token?.kind === 'player' || token?.kind === 'ally');
  const imgPreview = document.getElementById('unit-img-preview');
  if (imgPreview && token?.imgData) { imgPreview.src = token.imgData; imgPreview.style.display = 'block'; }
  if (imgPreview && !token?.imgData) { imgPreview.removeAttribute('src'); imgPreview.style.display = 'none'; }
  const delBtn = document.getElementById('unit-delete');
  delBtn.style.display = isEdit ? 'block' : 'none';
  delBtn.textContent = isLib ? '🗑️ 删除预设' : '🗑️ 删除';
  // 状态复选框（预设 + 自定义）
  const ck = document.getElementById('unit-status-checkboxes');
  ck.innerHTML = '';
  const allStatus = UNIT_STATUS_OPTIONS.slice();
  (customUnitStatuses || []).forEach(s => { if (!UNIT_STATUS_OPTIONS.some(([n]) => n === s.name)) allStatus.push([s.name, s.icon || '⚠️']); });
  allStatus.forEach(([label, icon]) => {
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
    tempHp: Math.max(0, parseInt(document.getElementById('unit-temphp').value) || 0),
    ac: document.getElementById('unit-ac').value.trim(),
    speed: document.getElementById('unit-speed').value.trim(),
    notes: document.getElementById('unit-notes').value.trim(),
    w: Math.max(0.2, parseInt(document.getElementById('unit-w').value) || 1),
    h: Math.max(0.2, parseInt(document.getElementById('unit-h').value) || 1),
    status,
    sightRadius: (() => { const v = parseFloat(document.getElementById('unit-sight').value); return isNaN(v) ? 6 : Math.max(0, v); })(),
    visionSource: document.getElementById('unit-vision').checked
  };
  const imgInput = document.getElementById('unit-img-file');
  if (imgInput && imgInput.files && imgInput.files[0]) {
    const file = imgInput.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      data.imgData = ev.target.result;
      data.img = new Image();
      data.img.src = data.imgData;
      finishUnitSave(id, data);
    };
    reader.readAsDataURL(file);
    return;
  }
  finishUnitSave(id, data);
}

function finishUnitSave(id, data) {
  const mode = document.getElementById('unit-modal-mode').value;
  // 单位库模式：保存/更新预设，不进入地图放置
  if (mode === 'lib') {
    const libData = { ...data };
    delete libData.img;  // 预设只存 dataURL，不存 Image 对象
    if (id) {
      const p = tokenPresets.find(x => x.id === id);
      if (p) Object.assign(p, libData);
      else tokenPresets.push({ ...libData, id });
    } else {
      tokenPresets.push({ ...libData, id: nextPresetId() });
    }
    saveTokenLibrary();
    renderTokenLibrary();
    closeUnitModal();
    showToast('✅ 单位库预设已保存');
    return;
  }
  if (id) {
    const t = tokens.find(x => x.id === id);
    if (t) {
      pushUndoMeta();
      Object.assign(t, data);
      syncTokenInitiative(t);
      closeUnitModal();
      render(); updateInfo();
      if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
      showToast('✅ 单位已更新');
      return;
    }
  }
  // 新建：进入放置模式
  _unitPending = { ...data, imgData: data.imgData || '', img: data.img || null };
  setTool('unit');
  closeUnitModal();
  showToast('🧝 点击地图放置单位（按住 Shift 连放，Esc 取消）');
}

function deleteUnitConfirm() {
  const id = document.getElementById('unit-id').value;
  const mode = document.getElementById('unit-modal-mode').value;
  if (mode === 'lib') {
    if (id) deleteTokenPreset(id);
    closeUnitModal();
    return;
  }
  if (!id) return;
  pushUndoMeta();
  if (viewSourceTokenId === id) viewSourceTokenId = null;
  tokens = tokens.filter(x => x.id !== id);
  clearInitiativeTokenRefs(id);
  if (selectedToken === id) selectedToken = null;
  selectedTokens.delete(id);
  pruneGroups();
  closeUnitModal();
  render(); updateInfo();
  if (typeof updateInitiativePanel === 'function') updateInitiativePanel();
  showToast('🗑️ 已删除单位');
}

// 自定义状态：添加 / 删除
function addCustomUnitStatus() {
  const name = (document.getElementById('unit-status-custom-name')?.value || '').trim();
  const icon = (document.getElementById('unit-status-custom-icon')?.value || '').trim() || '⚠️';
  if (!name) { showToast('⚠️ 请输入状态名称'); return; }
  if (!customUnitStatuses.some(s => s.name === name)) {
    customUnitStatuses.push({ name, icon });
    saveCustomUnitStatuses();
    if (typeof refreshUnitStatusOptions === 'function') refreshUnitStatusOptions();
    const nameEl = document.getElementById('unit-status-custom-name');
    if (nameEl) nameEl.value = '';
  }
  const open = document.getElementById('unit-modal');
  if (open && open.style.display === 'block') {
    const mode = document.getElementById('unit-modal-mode').value;
    let t = null;
    if (mode === 'lib') {
      const pid = document.getElementById('unit-id').value;
      const p = tokenPresets.find(x => x.id === pid);
      if (p) t = { id: p.id, ...p };
    } else {
      t = tokens.find(t => t.id === document.getElementById('unit-id').value);
    }
    openUnitModal(t || null, mode);
  }
}

function refreshUnitStatusOptions() {
  // 在弹窗打开时重建状态选项（单位库模式编辑预设）
  const modal = document.getElementById('unit-modal');
  if (modal && modal.style.display === 'block') {
    const id = document.getElementById('unit-id').value;
    const mode = document.getElementById('unit-modal-mode').value;
    let t = null;
    if (mode === 'lib') {
      const p = tokenPresets.find(x => x.id === id);
      if (p) t = { id: p.id, ...p };
    } else {
      t = id ? tokens.find(x => x.id === id) : _unitPending;
    }
    openUnitModal(t || null, mode);
  }
}

function removeCustomUnitStatus(name) {
  if (!name) return;
  customUnitStatuses = (customUnitStatuses || []).filter(s => s.name !== name);
  saveCustomUnitStatuses();
  // 已使用该状态的单位保留字符串，图标回落到 ⚠️/预设；只从可选列表移除
  refreshUnitStatusOptions();
}

// 单位弹窗事件绑定
document.getElementById('unit-confirm').addEventListener('click', saveUnitModal);
document.getElementById('unit-cancel').addEventListener('click', closeUnitModal);
document.getElementById('unit-delete').addEventListener('click', deleteUnitConfirm);
document.getElementById('unit-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
document.getElementById('unit-img-file').addEventListener('change', function(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = document.getElementById('unit-img-preview');
    if (img) { img.src = ev.target.result; img.style.display = 'block'; }
  };
  reader.readAsDataURL(f);
});
document.getElementById('unit-status-add').addEventListener('click', addCustomUnitStatus);

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
  dmLayerPref = true;
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
  // 双向联动：带 tokenId 的条目回写单位
  const linkedToken = item.tokenId ? tokens.find(t => t.id === item.tokenId) : (!item.tokenId && String(item.id).startsWith('tk') ? tokens.find(t => t.id === item.id) : null);
  if (linkedToken) {
    linkedToken.hp = item.hp;
    linkedToken.maxHp = item.maxHp;
    render(); updateInfo();
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
//  Group Modal（编组）
// ============================================================
function openGroupModal() {
  const modal = document.getElementById('group-modal');
  if (!modal) return;
  renderGroupList();
  const btn = document.getElementById('group-create-selected');
  if (btn) {
    btn.disabled = !(selectedTokens && selectedTokens.size >= 2);
    btn.style.opacity = btn.disabled ? '0.4' : '1';
  }
  modal.style.display = 'block';
}
function closeGroupModal() {
  document.getElementById('group-modal').style.display = 'none';
}
function renderGroupList() {
  const list = document.getElementById('group-list');
  if (!list) return;
  list.innerHTML = '';
  if (!groups.length) {
    list.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;padding:8px;">暂无编组</div>';
    return;
  }
  groups.forEach(g => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid #0f3460;border-radius:4px;margin-bottom:4px;background:#1a1a2e;';
    const dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;flex-shrink:0;background:' + (g.color || '#7fb0ff') + ';';
    const name = document.createElement('span');
    name.textContent = (g.name || '编组') + ' · ' + (g.tokenIds || []).length + ' 个单位';
    name.style.cssText = 'flex:1;font-size:12px;color:#fff;';
    const del = document.createElement('button');
    del.textContent = '🗑️';
    del.style.cssText = 'padding:2px 6px;background:#a33;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    del.addEventListener('click', () => { removeGroup(g.id); renderGroupList(); render(); updateInfo(); });
    div.appendChild(dot); div.appendChild(name); div.appendChild(del);
    list.appendChild(div);
  });
}
document.getElementById('btn-group').addEventListener('click', openGroupModal);
document.getElementById('group-close').addEventListener('click', closeGroupModal);
document.getElementById('group-modal').addEventListener('click', function(e) { if (e.target === e.currentTarget) e.currentTarget.style.display = 'none'; });
document.getElementById('group-create-selected').addEventListener('click', () => {
  const ids = Array.from(selectedTokens).filter(id => tokens.some(t => t.id === id));
  if (ids.length < 2) return;
  const name = prompt('编组名称：', '小队');
  if (name === null) return;
  const color = prompt('编组颜色（十六进制）：', '#7fb0ff');
  if (color === null) return;
  addTokenGroup(name, color, ids);
  renderGroupList(); render(); updateInfo();
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
        // 导入后不强制进入设置/对齐模式：仅在提示条给出下一步引导
        const hint = document.getElementById('tool-hint');
        if (hint) hint.innerHTML = '🖼️ 已导入底图：若网格对不上，点 <b>「🎯 网格对齐」</b>（依次点图中格线交点）或「⚙️ 数值」微调';
        const coord = document.getElementById('coord-indicator');
        if (coord) coord.textContent = '🖼️ 底图已导入';
        render();
        updateEmptyState();
        refreshBgAlignButton();
        showToast(`🖼️ 已导入底图 ${img.width}×${img.height}px，默认 ${defCols}×${defRows} 格（可对齐修正）`);
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
  // 移除底图时同步退出对齐模式
  _bgAlignRefs = null;
  _bgDragMode = null;
  isDragging = false;
  const bar = document.getElementById('bg-align-bar');
  if (bar) bar.style.display = 'none';
  document.getElementById('map-settings-modal').style.display = 'none';
  render();
  updateEmptyState();
  refreshBgAlignButton();
  showToast('🗑️ 底图已移除');
}

function setBackgroundOpacityDisplay() {
  const v = document.getElementById('bg-settings-opacity').value;
  const el = document.getElementById('map-settings-opacity-val');
  if (el) el.textContent = v + '%';
}

function startBgAlign() {
  if (!backgroundMap) { showToast('⚠️ 请先导入底图'); return; }
  const size = bgNaturalSize();
  if (!size) { showToast('⚠️ 底图图片尚未加载完成，请稍后再试'); return; }
  // 记录开始对齐时的底图映射快照：之后所有参考点都基于该快照换算图像像素，
  // 因此「点间格数」调整 / 拖动微调后重新计算都是幂等的。
  _bgAlignRefs = {
    pts: [],
    mode: 'click',
    snap: { x: backgroundMap.x, y: backgroundMap.y, cols: backgroundMap.cols, rows: backgroundMap.rows }
  };
  const modal = document.getElementById('map-settings-modal');
  if (modal) modal.style.display = 'none';
  const bar = document.getElementById('bg-align-bar');
  if (bar) bar.style.display = 'flex';
  updateBgAlignBar();
  render();
}

// 底图自然像素尺寸（未加载完成时返回 null）
function bgNaturalSize() {
  if (backgroundMap && backgroundMap.img && backgroundMap.img.naturalWidth > 0) {
    return { w: backgroundMap.img.naturalWidth, h: backgroundMap.img.naturalHeight };
  }
  return null;
}

// 对齐条上的「点间格数」（第2/3点相对第1点跨越的格数）
function bgAlignCells() {
  const el = document.getElementById('bg-align-cells');
  const n = el ? parseInt(el.value, 10) : 1;
  return Math.max(1, isNaN(n) ? 1 : n);
}

function updateBgAlignStatus(text) {
  const el = document.getElementById('bg-align-status');
  if (el) el.textContent = text || '';
}

function updateBgAlignBar() {
  const n = (_bgAlignRefs && _bgAlignRefs.pts) ? _bgAlignRefs.pts.length : 0;
  const cells = bgAlignCells();
  if (n === 0) updateBgAlignStatus(`🎯 第 1 点：点击底图上一个格线交点（基准点）`);
  else if (n === 1) updateBgAlignStatus(`🎯 第 2 点：点击同一水平格线上、向右 ${cells} 格的交点`);
  else if (n === 2) updateBgAlignStatus(`🎯 第 3 点：点击向下 ${cells} 格的交点（可点「完成」用 2 点粗略对齐）`);
  else updateBgAlignStatus(`✅ 已收集 3 个点，点「完成」应用对齐`);
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
  const size = bgNaturalSize();
  const pxPerCell = size && backgroundMap && backgroundMap.cols > 0 ? Math.round(size.w / backgroundMap.cols) : 0;
  showToast(pxPerCell > 0 ? `✅ 底图对齐完成（约 ${pxPerCell}px/格）` : '✅ 底图对齐完成');
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
document.getElementById('empty-import').addEventListener('click', importBackgroundMapFromFile);
// 「点间格数」输入实时刷新标签 + 重渲染（预览按新值重算；不触碰参考点）
{
  const el = document.getElementById('bg-align-cells');
  if (el) el.addEventListener('input', function() {
    const v = document.getElementById('bg-align-cells-val');
    if (v) v.textContent = this.value + ' 格';
    render();
  });
}

function applyBgAlignFromRefs(recordUndo) {
  if (!_bgAlignRefs || !backgroundMap) return;
  const pts = _bgAlignRefs.pts;
  const snap = _bgAlignRefs.snap;
  if (!snap || pts.length < 2) return;
  const size = bgNaturalSize();
  if (!size) { showToast('⚠️ 底图图片尚未加载完成，请稍后再试'); return; }
  const imgW = size.w, imgH = size.h;
  const CS = CELL_SIZE;

  // 世界坐标（画布 px）→ 图像像素：基于开始对齐时的映射快照换算
  const toImg = (wx, wy) => ({
    x: ((wx / CS - snap.x) / snap.cols) * imgW,
    y: ((wy / CS - snap.y) / snap.rows) * imgH
  });

  const p0 = pts[0];
  const i0 = toImg(p0.world.x, p0.world.y);
  const cells = bgAlignCells();

  // 水平方向：第 2 点相对第 1 点跨越 cells 格 → 每格图像像素
  const p1 = pts[1];
  const i1 = toImg(p1.world.x, p1.world.y);
  const hPx = Math.max(2, Math.abs(i1.x - i0.x) / cells);
  // 垂直方向：有第 3 点则单独解算，否则假设正方形格子
  let vPx = hPx;
  if (pts.length >= 3) {
    const p2 = pts[2];
    const i2 = toImg(p2.world.x, p2.world.y);
    vPx = Math.max(2, Math.abs(i2.y - i0.y) / cells);
  }

  if (recordUndo !== false) pushUndoMeta();
  backgroundMap.cols = imgW / hPx;
  backgroundMap.rows = imgH / vPx;
  // 基准点 I0 落到最近的工具格线交点。注意：工具格线在 (q+0.5)*48（半整数），
  // 因此要吸附到半整数（round(x/CS - 0.5) + 0.5），不能直接 round(整数)否则偏半格导致“对不上”。
  const t0x = Math.round(p0.world.x / CS - 0.5) + 0.5;
  const t0y = Math.round(p0.world.y / CS - 0.5) + 0.5;
  backgroundMap.x = t0x - i0.x / hPx;
  backgroundMap.y = t0y - i0.y / vPx;
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

// 对齐条「点间格数」实时重算（幂等：基于开始对齐时的映射快照；不产生撤销记录） [DISABLED v0.83]
// document.getElementById('bg-align-cells').addEventListener('input', function() {
//   const label = document.getElementById('bg-align-cells-val');
//   if (label) label.textContent = (this.value || '1') + ' 格';
//   if (!_bgAlignRefs) return;
//   updateBgAlignBar();
//   applyBgAlignFromRefs(false);
//   render();
// });

// ============================================================
//  DM / 玩家视图切换
// ============================================================
function setViewRole(role) {
  viewRole = role;
  const dmBtn = document.getElementById('role-dm');
  const plBtn = document.getElementById('role-player');
  const banner = document.getElementById('player-banner');
  if (dmBtn) dmBtn.classList.toggle('active', role === 'dm');
  if (plBtn) plBtn.classList.toggle('active', role === 'player');
  if (banner) banner.style.display = role === 'player' ? 'block' : 'none';
  document.body.classList.toggle('player-view', role === 'player');
  applyRoleViewUI();
}

// 以某单位作为玩家视角源（独立视角预览：玩家视图只看这个单位看得见的地方）
function setViewSourceToken(id) {
  const t = tokens.find(x => x.id === id);
  if (!t) return;
  viewSourceTokenId = id;
  setViewRole('player');
  const hint = document.getElementById('tool-hint');
  if (hint) hint.innerHTML = '👁️ 当前视角源：<b>' + (t.name || '单位') + '</b> — 玩家视图只显示此单位视野；右键单位→恢复全部 / Esc 取消';
  showToast('👁️ 已设为视角源：' + (t.name || '单位'));
}
function resetViewSourceToken() {
  viewSourceTokenId = null;
  render();
  if (typeof updateEmptyState === 'function') updateEmptyState();
  showToast('👁️ 已恢复全部视野源');
}

function applyRoleViewUI() {
  const isPlayer = viewRoleIsPlayer();
  // DM 专属工具按钮：禁用 + 置灰
  document.querySelectorAll('.tool-btn.dm-tool').forEach(b => {
    b.disabled = isPlayer;
    b.classList.toggle('dm-locked', isPlayer);
    b.title = isPlayer ? '👁️ 玩家视图下不可用（DM 专属）' : (b.dataset.tool === 'dm' ? '画 DM 隐藏层：标记/信息只在 DM 本地显示 (Y)' : '涂战雾：遮住/揭示格子，跑团时逐步揭开 (F)');
  });
  // 地图区（导入底图/数值/网格对齐）为 DM 专属  [DISABLED v0.83] 按钮已移除
  // ['btn-import-map', 'btn-map-settings', 'btn-bg-align'].forEach(id => {
  //   const el = document.getElementById(id);
  //   if (el) { el.disabled = isPlayer; el.classList.toggle('dm-locked', isPlayer); }
  // });
  // 行动顺序（DM 专属）
  const initBtn = document.getElementById('btn-initiative');
  if (initBtn) { initBtn.disabled = isPlayer; initBtn.classList.toggle('dm-locked', isPlayer); }
  // DM 层显示：玩家视图强制关闭；切回 DM 视图时按用户之前的偏好恢复
  const dmChk = document.getElementById('chk-dm');
  if (dmChk) dmChk.disabled = isPlayer;
  if (isPlayer) {
    showDmLayer = false;
    if (dmChk) dmChk.checked = false;
    if (selectedTool === 'dm' || selectedTool === 'fog') setTool('select');
  } else {
    showDmLayer = dmLayerPref;
    if (dmChk) dmChk.checked = dmLayerPref;
  }
  refreshBgAlignButton();
  render();
}

document.getElementById('role-dm').addEventListener('click', () => setViewRole('dm'));
document.getElementById('role-player').addEventListener('click', () => setViewRole('player'));

// ============================================================
//  页签面板：左侧栏分成几个选项，每个子页独立滚动
// ============================================================
function switchPanel(name) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  document.querySelectorAll('.panel-page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  const page = document.getElementById('page-' + name);
  if (page) page.scrollTop = 0;
}
document.querySelectorAll('.panel-tab').forEach(t => {
  t.addEventListener('click', () => switchPanel(t.dataset.panel));
});

// ============================================================
//  空态引导 + 对齐按钮可用性
// ============================================================
const LS_EMPTY_DISMISS_KEY = 'combatmap_empty_dismissed_v1';
function updateEmptyState() {
  const el = document.getElementById('empty-hint');
  if (!el) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem(LS_EMPTY_DISMISS_KEY) === '1'; } catch (e) { /* ignore */ }
  const hasContent = Object.keys(combatData).length > 0 || tokens.length > 0 || shapes.length > 0 || freeLines.length > 0 || !!backgroundMap;
  el.style.display = (hasContent || dismissed) ? 'none' : 'flex';
}
function refreshBgAlignButton() {
  const el = document.getElementById('btn-bg-align');
  if (!el) return;
  const noBg = !backgroundMap;
  const locked = viewRoleIsPlayer();
  el.disabled = noBg || locked;
  el.title = noBg ? '请先「🖼️ 导入底图」再对齐网格' : (locked ? '👁️ 玩家视图下不可用' : '在地图上点 3 个格线交点让网格贴合底图');
  el.style.opacity = (noBg || locked) ? '0.4' : '1';
  el.style.cursor = (noBg || locked) ? 'not-allowed' : 'pointer';
}

// [DISABLED v0.83] empty-import 按钮已随导入底图功能移除
// document.getElementById('empty-import').addEventListener('click', () => {
//   document.getElementById('empty-hint').style.display = 'none';
//   importBackgroundMapFromFile();
// });
document.getElementById('empty-dismiss').addEventListener('click', () => {
  try { localStorage.setItem(LS_EMPTY_DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
  document.getElementById('empty-hint').style.display = 'none';
});

// ============================================================
