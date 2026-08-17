// ======== Context Menu ========
function showContextMenu(cx, cy, mx, my) {
  const hex = hexAtPixel(mx, my);
  if (!hex) return;

  const menu = document.getElementById('ctx-menu');
  const closeMenu = () => { menu.style.display = 'none'; };

  menu.innerHTML = '';
  menu.style.display = 'block';
  menu.style.left = cx + 'px';
  menu.style.top = cy + 'px';

  const items = [
    { text: `📍 选中 (${hex.q}, ${hex.r})`, action: () => { selectedHex = hex; updateInfo(); render(); } },
    { text: '—' },
  ];

  // Terrain submenu
  const terrainCtxList = getAllTerrainIds();
  terrainCtxList.forEach(id => {
    const ctxTInfo = getTerrainInfo(id);
    if (!ctxTInfo) return;
    items.push({
      text: `${ctxTInfo.icon} ${ctxTInfo.name}`,
      action: () => { setHex(hex.q, hex.r, { terrain: id }); render(); updateInfo(); }
    });
  });

  items.push({ text: '—' });
  items.push({
    text: '🏘️ 设置定居点',
    action: () => { selectedHex = hex; showSettlementDialog(hex.q, hex.r); render(); }
  });
  items.push({
    text: '🏷️ 设置标签',
    action: () => { selectedHex = hex; showLabelDialog(hex.q, hex.r); render(); }
  });
  items.push({
    text: '🛤️ 切换道路',
    action: () => { selectedHex = hex; roadStart = hex; }
  });
  items.push({ text: '—' });
  items.push({
    text: '🧹 清除',
    action: () => { setHex(hex.q, hex.r, { terrain: null, label: '', settlement: null, roads: [], annotations: [] }); render(); updateInfo(); }
  });

  items.forEach(item => {
    if (item.text === '—') {
      const div = document.createElement('div');
      div.style.cssText = 'height:1px;background:#0f3460;margin:3px 8px;';
      menu.appendChild(div);
    } else {
      const btn = document.createElement('button');
      btn.textContent = item.text;
      btn.style.cssText = 'display:block;width:100%;padding:6px 12px;background:none;border:none;color:#e0e0e0;cursor:pointer;font-size:13px;text-align:left;';
      btn.addEventListener('mouseenter', () => btn.style.background = '#0f3460');
      btn.addEventListener('mouseleave', () => btn.style.background = 'none');
      btn.addEventListener('click', () => { item.action(); closeMenu(); });
      menu.appendChild(btn);
    }
  });

  // Click anywhere to close
  const closeHandler = (e) => {
    if (!menu.contains(e.target)) {
      menu.style.display = 'none';
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

// ======== Batch Selection Panel ========
function updateBatchPanel() {
  const panel = document.getElementById('batch-panel');
  const count = document.getElementById('batch-count');
  if (selectedHexes.size > 0) {
    panel.style.display = 'block';
    count.textContent = `已选 ${selectedHexes.size} 格`;
  } else {
    panel.style.display = 'none';
  }
}

function clearSelection() {
  selectedHexes = new Set();
  updateBatchPanel();
  render();
  updateInfo();
}

document.getElementById('btn-batch-clear-selection').addEventListener('click', clearSelection);

document.getElementById('btn-batch-terrain').addEventListener('click', () => {
  if (selectedHexes.size === 0) return;
  const terrainId = selectedTerrain;
  beginBatch();
  for (const key of selectedHexes) {
    const [q, r] = key.split(',').map(Number);
    if (!(isLocked && getHex(q, r).terrain)) {
      setHex(q, r, { terrain: terrainId });
    }
  }
  endBatch();
  showDiceResult('🏞️', `已批量设置地形 → ${getTerrainInfo(terrainId)?.name || terrainId} (${selectedHexes.size} 格)`);
  render();
  updateInfo();
});

document.getElementById('btn-batch-erase').addEventListener('click', () => {
  if (selectedHexes.size === 0) return;
  if (!confirm(`确认清除 ${selectedHexes.size} 个六角格的内容？`)) return;
  beginBatch();
  for (const key of selectedHexes) {
    const [q, r] = key.split(',').map(Number);
    const h = getHex(q, r);
    if (isLocked && (h.terrain || h.settlement || h.label || h.roads?.length || (h.annotations && h.annotations.length))) continue;
    setHex(q, r, { terrain: null, elev: null, moist: null, label: '', settlement: null, roads: [], annotations: [] });
    removeAllRiverEdges(q, r);
  }
  endBatch();
  showDiceResult('🧹', `已批量清除 ${selectedHexes.size} 格`);
  clearSelection();
  render();
  updateInfo();
});

document.getElementById('btn-batch-road').addEventListener('click', () => {
  if (selectedHexes.size < 2) { showDiceResult('⚠️', '需选中至少 2 个格子才能连道路'); return; }
  const keys = [...selectedHexes];
  beginBatch();
  let count = 0;
  // Connect selected hexes in sequence along the path
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const [q1, r1] = keys[i].split(',').map(Number);
      const [q2, r2] = keys[j].split(',').map(Number);
      // Check if adjacent
      if (neighbors(q1, r1).some(n => n.q === q2 && n.r === r2)) {
        if (!hasRoad(q1, r1, q2, r2)) {
          addRoad(q1, r1, q2, r2);
          count++;
        }
      }
    }
  }
  endBatch();
  showDiceResult('🛤️', `已连接 ${count} 条道路（选中格之间相邻的自动连接）`);
  render();
  updateInfo();
});

// ======== Dialogs ========
// (modal functions removed — settlement/label now use browser dialogs)

function showSettlementDialog(q, r) {
  const h = getHex(q, r);
  const existing = h.settlement;
  document.getElementById('settlement-modal-q').value = q;
  document.getElementById('settlement-modal-r').value = r;
  document.getElementById('settlement-modal-coord').textContent = `(${q}, ${r})`;
  document.getElementById('settlement-modal-name').value = existing?.name || randomName();
  const rating = existing?.rating ?? 0;
  document.getElementById('settlement-modal-rating').value = rating;
  document.getElementById('settlement-modal-rating-val').textContent = `${rating >= 0 ? '+' : ''}${rating}`;
  // Image
  const existingImg = existing?.imageUrl || '';
  document.getElementById('settlement-modal-img').value = existingImg;
  document.getElementById('settlement-modal-img-name').textContent = existingImg ? '✅ 已上传' : '';
  document.getElementById('settlement-modal-img-clear').style.display = existingImg ? 'inline' : 'none';
  document.getElementById('settlement-modal').style.display = 'block';
  setTimeout(() => document.getElementById('settlement-modal-name').focus(), 50);
}

function showLabelDialog(q, r) {
  const h = getHex(q, r);
  document.getElementById('label-modal-q').value = q;
  document.getElementById('label-modal-r').value = r;
  document.getElementById('label-modal-coord').textContent = `(${q}, ${r})`;
  document.getElementById('label-modal-text').value = h.label || '';
  rebuildAnnotationList();
  document.getElementById('ann-add-form').style.display = 'none';
  document.getElementById('ann-show-add-btn').style.display = 'block';
  document.getElementById('label-modal').style.display = 'block';
  setTimeout(() => document.getElementById('label-modal-text').focus(), 50);
}

function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function rebuildAnnotationList() {
  const q = parseInt(document.getElementById('label-modal-q').value);
  const r = parseInt(document.getElementById('label-modal-r').value);
  const h = getHex(q, r);
  const anns = h.annotations || [];
  const list = document.getElementById('ann-list');
  const count = document.getElementById('ann-count');
  if (count) count.textContent = `(${anns.length}条)`;

  if (!list) return;
  let html = '<div style="font-size:12px;color:#888;margin-bottom:6px;">详细标注 <span id="ann-count" style="color:#666;">(' + anns.length + '条)</span></div>';

  if (anns.length === 0) {
    html += '<div style="font-size:12px;color:#555;text-align:center;padding:10px;">暂无详细标注</div>';
  } else {
    anns.forEach(a => {
      const t = ANNOTATION_TYPES[a.type] || ANNOTATION_TYPES.note;
      const eye = a.visible ? '👁️' : '🙈';
      const visLabel = a.visible ? '显示' : '隐藏';
      html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;margin:4px 0;background:#1a1a2e;border-radius:4px;border-left:3px solid ' + t.color + ';">';
      html += '<span style="font-size:14px;line-height:1.4;">' + t.icon + '</span>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="font-size:11px;color:' + t.color + ';">' + t.name + '</div>';
      html += '<div style="font-size:13px;color:#e0e0e0;word-break:break-word;white-space:pre-wrap;">' + escHtml(a.text) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0;">';
      html += '<button class="ann-vis-btn" data-id="' + a.id + '" title="' + visLabel + '" style="padding:2px 6px;background:none;border:none;cursor:pointer;font-size:14px;">' + eye + '</button>';
      html += '<button class="ann-del-btn" data-id="' + a.id + '" title="删除" style="padding:2px 6px;background:none;border:none;cursor:pointer;font-size:14px;color:#e94560;">✕</button>';
      html += '</div></div>';
    });
  }

  list.innerHTML = html;

  // Visibility toggle
  list.querySelectorAll('.ann-vis-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = this.dataset.id;
      const h2 = getHex(q, r);
      const ann = h2.annotations?.find(a => a.id === id);
      if (ann) {
        updateAnnotation(q, r, id, { visible: !ann.visible });
        rebuildAnnotationList();
        render();
        updateInfo();
      }
    });
  });

  // Delete
  list.querySelectorAll('.ann-del-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (!confirm('删除此标注？')) return;
      removeAnnotation(q, r, this.dataset.id);
      rebuildAnnotationList();
      render();
      updateInfo();
    });
  });
}

function showDiceResult(line1, line2) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = `<div class="row"><span style="font-size:20px;font-weight:bold;color:#e94560;">${line1}</span></div>
    <div class="row"><span style="color:#aaa;">${line2 || ''}</span></div>`;
}

function setGenButtonsDisabled(disabled) {
  const btns = ['btn-roll', 'btn-gen-terrain', 'btn-gen-settlement', 'btn-gen-road'];
  btns.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = disabled;
  });
}

// ======== Random Generation Tools ========
const SURNAMES = ['风谷','铁砧','石桥','橡木','银溪','黑沼','金崖','霜峰','红柳','白杨','鹿角','鹰巢','狼牙','龙鳞','鸦羽'];
const PREFIXES = ['北','南','东','西','上','下','大','小','新','旧','高','低'];
const NAMES = ['维里安','迪拉姆','艾尔多','布雷顿','卡斯托','法尔文','格林','哈肯','伊斯塔','加罗','凯尔','洛瑞','米兰达','诺温','奥瑞克'];

function randomName() {
  const use = Math.random() > 0.5;
  if (use) return PREFIXES[Math.floor(Math.random() * PREFIXES.length)] + SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + '镇';
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  // Undo/Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    if (e.shiftKey) { redo(); } else { undo(); }
    e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { redo(); e.preventDefault(); return; }
  const keyMap = { 'v': 'select', 'x': 'select-rect', 'b': 'paint', 's': 'settlement', 'r': 'road', 'w': 'river', 'm': 'measure', 'l': 'label', 'e': 'erase' };
  if (keyMap[e.key?.toLowerCase()]) {
    setTool(keyMap[e.key.toLowerCase()]);
    e.preventDefault();
  }
});

// ======== UI Setup ========
function setTool(tool) {
  selectedTool = tool;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  // Show erase mode picker only when erase tool is active
  document.getElementById('erase-options').style.display = tool === 'erase' ? 'block' : 'none';
  // Hide batch panel when not in select-rect
  if (tool !== 'select-rect') {
    if (selectedHexes.size > 0) clearSelection();
    document.getElementById('batch-panel').style.display = 'none';
  } else {
    updateBatchPanel();
  }
  if (tool !== 'road') roadStart = null;
  if (tool !== 'river') riverStart = null;
  if (tool !== 'measure') { measureStart = null; measurePath = null; }
  const hint = document.getElementById('tool-hint');
  const coord = document.getElementById('coord-indicator');
  switch (tool) {
    case 'select':
      hint.innerHTML = '👆 点击六角格查看信息';
      coord.textContent = '⚪ 选择模式';
      break;
    case 'select-rect':
      hint.innerHTML = '🔲 在画布上<b>拖拽</b>框选多个六角格，然后使用批量操作按钮';
      coord.textContent = `🔲 已选 ${selectedHexes.size} 格`;
      break;
    case 'paint':
      const paintT = getTerrainInfo(selectedTerrain);
      hint.innerHTML = `🖌️ 点击格子涂上 <b>${paintT?.name || ''}</b>，或按住拖拽连续涂色`;
      coord.textContent = `🖌️ ${paintT?.name || ''} 笔刷`;
      break;
    case 'settlement':
      hint.innerHTML = '🏘️ 点击六角格 → 弹出窗口填写名称和评分';
      coord.textContent = '🏘️ 点击放置定居点';
      break;
    case 'road':
      hint.innerHTML = '🛤️ <b>点击第一个六角格</b>设为起点(橙色高亮)，再<b>点击相邻格</b>连线。再次点击起点可取消';
      coord.textContent = roadStart ? `🛤️ 起点 (${roadStart.q}, ${roadStart.r})` : '🛤️ 点击选择道路起点';
      break;
    case 'river':
      hint.innerHTML = '🌊 <b>点击第一个六角格</b>设为起点(蓝色高亮)，再<b>点击相邻格</b>画河。再次点击起点可取消';
      coord.textContent = riverStart ? `🌊 起点 (${riverStart.q}, ${riverStart.r})` : '🌊 点击选择河流起点';
      break;
    case 'measure':
      hint.innerHTML = '📏 点击两个六角格，显示直线距离、最短路径和旅行消耗';
      coord.textContent = measureStart ? `📏 起点 (${measureStart.q}, ${measureStart.r})` : '📏 点击选择起点';
      break;
    case 'label':
      hint.innerHTML = '🏷️ 点击六角格 → 弹出窗口输入地标名称（如：古墓、龙巢）';
      coord.textContent = '🏷️ 点击添加标签';
      break;
    case 'erase':
      hint.innerHTML = '🧹 点击擦除，从下拉菜单选择擦除内容：全部/仅地形/仅定居点/仅标签/仅河流/仅道路。拖拽连续擦除';
      coord.textContent = '🧹 擦除模式';
      break;
    case 'paint-region':
      const regionInfo = selectedRegion ? regions[selectedRegion] : null;
      hint.innerHTML = `👑 点击格子涂上王国 <b>${regionInfo?.name || ''}</b>，或按住拖拽连续涂色`;
      coord.textContent = `👑 ${regionInfo?.name || ''} 王国笔刷`;
      break;
  }
  render();
}

document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

// ======== Terrain Editor ========
function openTerrainEditor() {
  const modal = document.getElementById('terrain-editor-modal');
  rebuildTerrainEditorList();
  modal.style.display = 'block';
}

function rebuildTerrainEditorList() {
  const list = document.getElementById('terrain-editor-list');
  list.innerHTML = '';
  const allTerrains = getAllTerrains();
  const ids = getAllTerrainIds();
  ids.forEach(id => {
    const t = allTerrains[id];
    if (!t) return;
    const isBuiltin = !!TERRAIN[id] && !customTerrains[id];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;margin:2px 0;background:#1a1a2e;border-radius:4px;font-size:12px;';
    const cpreview = document.createElement('span');
    cpreview.style.cssText = 'display:inline-block;width:20px;height:20px;border-radius:3px;background:' + t.color + ';border:1px solid rgba(255,255,255,0.2);flex-shrink:0;';
    row.appendChild(cpreview);
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;color:#fff;';
    nameSpan.textContent = t.icon + ' ' + t.name + ' (' + id + ')';
    if (isBuiltin) {
      const badge = document.createElement('span');
      badge.style.cssText = 'color:#888;font-size:10px;margin-left:4px;';
      badge.textContent = '\u5185\u7f6e';
      nameSpan.appendChild(badge);
    }
    row.appendChild(nameSpan);
    // Image thumbnail (if any)
    if (t.imageUrl) {
      const thumb = document.createElement('img');
      thumb.src = t.imageUrl;
      thumb.style.cssText = 'width:24px;height:24px;border-radius:3px;object-fit:cover;border:1px solid rgba(255,255,255,0.2);';
      row.appendChild(thumb);
    }
    // Image upload button
    const imgBtn = document.createElement('button');
    imgBtn.textContent = '\uD83D\uDDBC\uFE0F';
    imgBtn.style.cssText = 'padding:2px 6px;background:#3a3a5e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    imgBtn.title = '\u4e0a\u4f20\u56fe\u7247\u4ee3\u66ff\u56fe\u6807';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', function() {
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(ev) {
          const compressed = await compressImage(ev.target.result);
          if (!customTerrains[id]) customTerrains[id] = { ...t };
          customTerrains[id].imageUrl = compressed;
          saveTerrainConfig();
          rebuildTerrainPalette();
          rebuildTerrainEditorList();
          render();
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
    });
    imgBtn.appendChild(fileInput);
    imgBtn.addEventListener('click', function() { fileInput.click(); });
    row.appendChild(imgBtn);
    const travelSpan = document.createElement('span');
    travelSpan.style.cssText = 'color:#aaa;font-size:11px;margin-right:4px;';
    travelSpan.textContent = String.fromCodePoint(0x1F6B6) + t.travel;
    row.appendChild(travelSpan);
    const editBtn = document.createElement('button');
    editBtn.textContent = String.fromCodePoint(0x270F, 0xFE0F);
    editBtn.style.cssText = 'padding:2px 6px;background:#0f3460;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    editBtn.title = '\u7f16\u8f91';
    editBtn.addEventListener('click', function() { editTerrain(id); });
    row.appendChild(editBtn);
    if (!isBuiltin || customTerrains[id]) {
      const delBtn = document.createElement('button');
      delBtn.textContent = String.fromCodePoint(0x1F5D1, 0xFE0F);
      delBtn.style.cssText = 'padding:2px 6px;background:#5a1a2e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
      delBtn.title = '\u5220\u9664';
      delBtn.addEventListener('click', function() {
        let tname = t.name;
        if (confirm('\u786e\u8ba4\u5220\u9664\u5730\u5f62\u300c' + tname + '\u300d\uff1f\u5df2\u4f7f\u7528\u8be5\u5730\u5f62\u7684\u683c\u5b50\u4f1a\u663e\u793a\u4e3a\u672a\u77e5\u3002')) {
          if (TERRAIN[id]) {
            deletedTerrains[id] = true;
            delete customTerrains[id];
          } else {
            delete customTerrains[id];
          }
          if (selectedTerrain === id) selectedTerrain = getAllTerrainIds()[0] || 'plain';
          saveTerrainConfig();
          rebuildTerrainPalette();
          rebuildTerrainEditorList();
          render();
        }
      });
      row.appendChild(delBtn);
    }
    list.appendChild(row);
  });
}

function editTerrain(id) {
  let t = getTerrainInfo(id);
  if (!t) return;
  let name = prompt('\u7f16\u8f91\u5730\u5f62\u300c' + id + '\u300d\u7684\u540d\u79f0\uff1a', t.name);
  if (name === null) return;
  let icon = prompt('\u7f16\u8f91\u5730\u5f62\u300c' + id + '\u300d\u7684\u56fe\u6807 (emoji)\uff1a', t.icon);
  if (icon === null) return;
  let color = prompt('\u7f16\u8f91\u5730\u5f62\u300c' + id + '\u300d\u7684\u989c\u8272 (hex)\uff1a', t.color);
  if (color === null) return;
  let travelStr = prompt('\u7f16\u8f91\u5730\u5f62\u300c' + id + '\u300d\u7684\u65c5\u884c\u6d88\u8017 (1-10)\uff1a', String(t.travel));
  if (travelStr === null) return;
  let travel = Math.max(1, Math.min(10, parseInt(travelStr) || 1));
  customTerrains[id] = { name: name.trim() || t.name, icon: icon.trim() || t.icon, color: color.trim() || t.color, travel: travel };
  saveTerrainConfig();
  rebuildTerrainPalette();
  rebuildTerrainEditorList();
  render();
}

document.getElementById('btn-manage-terrains').addEventListener('click', openTerrainEditor);

document.getElementById('te-btn-add').addEventListener('click', function() {
  let id = document.getElementById('te-new-id').value.trim();
  let name = document.getElementById('te-new-name').value.trim();
  let icon = document.getElementById('te-new-icon').value.trim();
  let color = document.getElementById('te-new-color').value;
  let travel = parseInt(document.getElementById('te-new-travel').value) || 1;
  if (!id || !name || !icon) { alert('\u8bf7\u586b\u5199\u5730\u5f62ID\u3001\u540d\u79f0\u548c\u56fe\u6807'); return; }
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(id)) { alert('\u5730\u5f62ID\u53ea\u80fd\u5305\u542b\u82f1\u6587\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u4e0b\u5212\u7ebf\uff0c\u4e14\u5fc5\u987b\u4ee5\u5b57\u6bcd\u5f00\u5934'); return; }
  if (deletedTerrains[id]) delete deletedTerrains[id];
  customTerrains[id] = { name: name, icon: icon, color: color, travel: Math.max(1, Math.min(10, travel)) };
  saveTerrainConfig();
  document.getElementById('te-new-id').value = '';
  document.getElementById('te-new-name').value = '';
  document.getElementById('te-new-icon').value = '';
  rebuildTerrainPalette();
  rebuildTerrainEditorList();
});

document.getElementById('te-btn-reset').addEventListener('click', function() {
  if (!confirm('\u786e\u8ba4\u6062\u590d\u6240\u6709\u5730\u5f62\u5230\u9ed8\u8ba4\u8bbe\u7f6e\uff1f\u5c06\u5220\u9664\u6240\u6709\u81ea\u5b9a\u4e49\u5730\u5f62\u548c\u4fee\u6539\u3002')) return;
  resetAllTerrains();
  if (!getTerrainInfo(selectedTerrain)) selectedTerrain = getAllTerrainIds()[0] || 'plain';
  rebuildTerrainPalette();
  rebuildTerrainEditorList();
  render();
});

document.getElementById('te-btn-close').addEventListener('click', function() {
  document.getElementById('terrain-editor-modal').style.display = 'none';
});

// ======== Generation Rules Editor ========
function openGenRulesEditor() {
  let modal = document.getElementById('gen-rules-modal');
  document.getElementById('gr-threshold').value = String(generationRules.d6Threshold);
  const chanceVal = Math.round((generationRules.specialTerrainChance || 0.05) * 100);
  document.getElementById('gr-special-chance').value = chanceVal;
  document.getElementById('gr-special-chance-val').textContent = chanceVal + '%';
  document.getElementById('gr-river-travel').value = generationRules.riverTravel != null ? generationRules.riverTravel : 0;
  document.getElementById('gr-gen-rivers').checked = generationRules.generateRivers !== false;
  let defaultSelect = document.getElementById('gr-default-terrain');
  defaultSelect.innerHTML = '';
  let ids = getAllTerrainIds();
  let allTerrains = getAllTerrains();
  ids.forEach(function(id) {
    let t = allTerrains[id];
    if (!t) return;
    let opt = document.createElement('option');
    opt.value = id;
    opt.textContent = t.icon + ' ' + t.name;
    if (id === generationRules.defaultTerrain) opt.selected = true;
    defaultSelect.appendChild(opt);
  });
  rebuildWeightTable();
  modal.style.display = 'block';
}

function rebuildWeightTable() {
  let container = document.getElementById('gr-weight-list');
  container.innerHTML = '';
  let allTerrains = getAllTerrains();
  let ids = getAllTerrainIds();
  generationRules.specialTable.forEach(function(entry, idx) {
    let row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:3px 4px;margin:1px 0;background:#1a1a2e;border-radius:3px;font-size:12px;';
    let sel = document.createElement('select');
    sel.style.cssText = 'flex:1;padding:2px;background:#1a1a2e;color:#fff;border:1px solid #0f3460;border-radius:3px;font-size:11px;';
    ids.forEach(function(id) {
      let t = allTerrains[id];
      if (!t) return;
      let opt = document.createElement('option');
      opt.value = id;
      opt.textContent = t.icon + ' ' + t.name;
      if (id === entry.terrainId) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function() {
      generationRules.specialTable[idx].terrainId = sel.value;
      saveTerrainConfig();
    });
    row.appendChild(sel);
    let wInput = document.createElement('input');
    wInput.type = 'number';
    wInput.min = 0;
    wInput.max = 20;
    wInput.value = entry.weight;
    wInput.style.cssText = 'width:45px;padding:2px;background:#1a1a2e;color:#fff;border:1px solid #0f3460;border-radius:3px;font-size:11px;text-align:center;';
    wInput.addEventListener('change', function() {
      generationRules.specialTable[idx].weight = Math.max(0, parseInt(wInput.value) || 0);
      saveTerrainConfig();
      updateWeightTotal();
    });
    row.appendChild(wInput);
    let delBtn = document.createElement('button');
    delBtn.textContent = '\u2715';
    delBtn.style.cssText = 'padding:2px 6px;background:#5a1a2e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    delBtn.addEventListener('click', function() {
      generationRules.specialTable.splice(idx, 1);
      rebuildWeightTable();
      saveTerrainConfig();
    });
    row.appendChild(delBtn);
    container.appendChild(row);
  });
  let addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;align-items:center;gap:4px;padding:3px 4px;';
  let addBtn = document.createElement('button');
  addBtn.textContent = String.fromCodePoint(0x2795) + ' \u6dfb\u52a0\u6761\u76ee';
  addBtn.style.cssText = 'padding:3px 8px;background:#2d6a2e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
  addBtn.addEventListener('click', function() {
    generationRules.specialTable.push({ terrainId: ids[0] || 'plain', weight: 1 });
    rebuildWeightTable();
    saveTerrainConfig();
  });
  addRow.appendChild(addBtn);
  let totalSpan = document.createElement('span');
  totalSpan.id = 'gr-weight-total';
  totalSpan.style.cssText = 'color:#aaa;font-size:11px;margin-left:8px;';
  addRow.appendChild(totalSpan);
  container.appendChild(addRow);
  updateWeightTotal();
}

function updateWeightTotal() {
  let total = generationRules.specialTable.reduce(function(s, e) { return s + e.weight; }, 0);
  let el = document.getElementById('gr-weight-total');
  if (el) el.textContent = '\u603b\u6743\u91cd: ' + total;
}

document.getElementById('btn-gen-rules').addEventListener('click', openGenRulesEditor);

document.getElementById('gr-threshold').addEventListener('change', function(e) {
  generationRules.d6Threshold = parseInt(e.target.value);
  saveTerrainConfig();
});

document.getElementById('gr-default-terrain').addEventListener('change', function(e) {
  generationRules.defaultTerrain = e.target.value;
  saveTerrainConfig();
});

document.getElementById('gr-special-chance').addEventListener('input', function(e) {
  generationRules.specialTerrainChance = parseInt(e.target.value) / 100;
  document.getElementById('gr-special-chance-val').textContent = e.target.value + '%';
  saveTerrainConfig();
});

document.getElementById('gr-river-travel').addEventListener('change', function(e) {
  generationRules.riverTravel = Math.max(0, Math.min(20, parseInt(e.target.value) || 0));
  saveTerrainConfig();
  render();
});

document.getElementById('gr-gen-rivers').addEventListener('change', function(e) {
  generationRules.generateRivers = e.target.checked;
  saveTerrainConfig();
});

document.getElementById('gr-btn-reset').addEventListener('click', function() {
  generationRules = JSON.parse(JSON.stringify(DEFAULT_GEN_RULES));
  saveTerrainConfig();
  rebuildWeightTable();
  document.getElementById('gr-threshold').value = generationRules.d6Threshold;
  document.getElementById('gr-special-chance').value = Math.round((generationRules.specialTerrainChance || 0.05) * 100);
  document.getElementById('gr-special-chance-val').textContent = document.getElementById('gr-special-chance').value + '%';
  document.getElementById('gr-river-travel').value = generationRules.riverTravel != null ? generationRules.riverTravel : 0;
  document.getElementById('gr-gen-rivers').checked = generationRules.generateRivers !== false;
  render();
  let defaultSelect = document.getElementById('gr-default-terrain');
  [].slice.call(defaultSelect.options).forEach(function(opt) {
    opt.selected = opt.value === generationRules.defaultTerrain;
  });
});

document.getElementById('gr-btn-close').addEventListener('click', function() {
  document.getElementById('gen-rules-modal').style.display = 'none';
});

// Close modals on background click
document.getElementById('terrain-editor-modal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
document.getElementById('gen-rules-modal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
// ======== Settlement Modal ========
document.getElementById('settlement-modal-rating').addEventListener('input', function(e) {
  const val = parseInt(e.target.value);
  document.getElementById('settlement-modal-rating-val').textContent = `${val >= 0 ? '+' : ''}${val}`;
});

function settlementModalConfirm() {
  const q = parseInt(document.getElementById('settlement-modal-q').value);
  const r = parseInt(document.getElementById('settlement-modal-r').value);
  const name = document.getElementById('settlement-modal-name').value.trim() || '无名定居点';
  const rating = parseInt(document.getElementById('settlement-modal-rating').value);
  const imageUrl = document.getElementById('settlement-modal-img').value || undefined;
  const settlement = { name, rating };
  if (imageUrl) settlement.imageUrl = imageUrl;
  setHex(q, r, { settlement });
  document.getElementById('settlement-modal').style.display = 'none';
  render();
  updateInfo();
  showDiceResult('🏘️ 已保存', `${name} (${rating >= 0 ? '+' : ''}${rating})`);
}

document.getElementById('settlement-modal-confirm').addEventListener('click', settlementModalConfirm);
document.getElementById('settlement-modal-cancel').addEventListener('click', function() {
  document.getElementById('settlement-modal').style.display = 'none';
});
document.getElementById('settlement-modal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
document.getElementById('settlement-modal-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') settlementModalConfirm();
  if (e.key === 'Escape') document.getElementById('settlement-modal').style.display = 'none';
});

// Settlement image upload
document.getElementById('settlement-modal-img-btn').addEventListener('click', function() {
  document.getElementById('settlement-modal-img-input').click();
});
document.getElementById('settlement-modal-img-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(ev) {
    const compressed = await compressImage(ev.target.result);
    document.getElementById('settlement-modal-img').value = compressed;
    document.getElementById('settlement-modal-img-name').textContent = '✅ 已上传';
    document.getElementById('settlement-modal-img-clear').style.display = 'inline';
  };
  reader.readAsDataURL(file);
});
document.getElementById('settlement-modal-img-clear').addEventListener('click', function() {
  document.getElementById('settlement-modal-img').value = '';
  document.getElementById('settlement-modal-img-name').textContent = '';
  document.getElementById('settlement-modal-img-clear').style.display = 'none';
});
document.getElementById('settlement-modal-rating').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') settlementModalConfirm();
  if (e.key === 'Escape') document.getElementById('settlement-modal').style.display = 'none';
});

// ======== Label / Annotation Modal ========

// Quick label save
document.getElementById('label-modal-quick-save').addEventListener('click', function() {
  const q = parseInt(document.getElementById('label-modal-q').value);
  const r = parseInt(document.getElementById('label-modal-r').value);
  const text = document.getElementById('label-modal-text').value.trim();
  setHex(q, r, { label: text });
  showDiceResult('🏷️ 快捷标签已保存', text || '(空)');
  render();
  updateInfo();
});

// Show add form
document.getElementById('ann-show-add-btn').addEventListener('click', function() {
  document.getElementById('ann-add-form').style.display = 'block';
  this.style.display = 'none';
  document.getElementById('ann-add-text').focus();
});

// Cancel add
document.getElementById('ann-add-cancel').addEventListener('click', function() {
  document.getElementById('ann-add-form').style.display = 'none';
  document.getElementById('ann-show-add-btn').style.display = 'block';
  document.getElementById('ann-add-text').value = '';
});

// Confirm add
document.getElementById('ann-add-confirm').addEventListener('click', function() {
  const q = parseInt(document.getElementById('label-modal-q').value);
  const r = parseInt(document.getElementById('label-modal-r').value);
  const text = document.getElementById('ann-add-text').value.trim();
  if (!text) { alert('请输入标注文字'); return; }
  const type = document.getElementById('ann-add-type').value;
  const visible = document.getElementById('ann-add-visible').checked;
  addAnnotation(q, r, { type, text, visible });
  document.getElementById('ann-add-text').value = '';
  rebuildAnnotationList();
  render();
  updateInfo();
  showDiceResult('📋 已添加标注', (ANNOTATION_TYPES[type]?.icon || '') + ' ' + text.slice(0, 40));
});

document.getElementById('label-modal-cancel').addEventListener('click', function() {
  document.getElementById('label-modal').style.display = 'none';
});
document.getElementById('label-modal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});
document.getElementById('label-modal-text').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    const q = parseInt(document.getElementById('label-modal-q').value);
    const r = parseInt(document.getElementById('label-modal-r').value);
    const text = document.getElementById('label-modal-text').value.trim();
    setHex(q, r, { label: text });
    showDiceResult('🏷️ 快捷标签已保存', text || '(空)');
    render();
    updateInfo();
  }
  if (e.key === 'Escape') document.getElementById('label-modal').style.display = 'none';
});

// ======== 王国边境管理 ========
let selectedRegion = null;

function rebuildRegionPalette() {
  const palette = document.getElementById('region-palette');
  if (!palette) return;
  palette.innerHTML = '';
  const ids = regionOrder || Object.keys(regions);
  ids.forEach(id => {
    const r = regions[id];
    if (!r) return;
    const btn = document.createElement('button');
    btn.dataset.region = id;
    btn.title = r.name;
    const isActive = selectedRegion === id;
    btn.style.cssText = `background:${r.color};color:#fff;padding:4px 6px;border:${isActive ? '2px solid #fff' : '2px solid transparent'};border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:3px;`;
    btn.innerHTML = `<span>${r.icon}</span><span>${r.name}</span>`;
    btn.addEventListener('click', () => {
      selectedRegion = id;
      if (selectedTool !== 'paint-region') setTool('paint-region');
      else rebuildRegionPalette();
    });
    palette.appendChild(btn);
  });
}

// Paint-region 覆盖 hex click 处理王国涂色
const _origHandleHexClick = handleHexClick;
handleHexClick = function(q, r, e) {
  if (selectedTool === 'paint-region') {
    if (!selectedRegion) {
      showDiceResult('⚠️', '请先在王国面板中选择一个王国');
      return;
    }
    if (isLocked && getHex(q, r).region) { /* locked */ } else {
      setHex(q, r, { region: selectedRegion });
      render();
      updateInfo();
    }
    selectedHex = { q, r };
    return;
  }
  _origHandleHexClick(q, r, e);
};

// Region editor modal
function openRegionEditor() {
  const modal = document.getElementById('region-editor-modal');
  if (!modal) return;
  rebuildRegionEditorList();
  modal.style.display = 'block';
}

function rebuildRegionEditorList() {
  const list = document.getElementById('region-editor-list');
  if (!list) return;
  list.innerHTML = '';
  const ids = regionOrder || Object.keys(regions);
  ids.forEach(id => {
    const r = regions[id];
    if (!r) return;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;margin:2px 0;background:#1a1a2e;border-radius:4px;font-size:12px;';
    const cpreview = document.createElement('span');
    cpreview.style.cssText = 'display:inline-block;width:20px;height:20px;border-radius:3px;background:' + r.color + ';border:1px solid rgba(255,255,255,0.2);flex-shrink:0;';
    row.appendChild(cpreview);
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;color:#fff;';
    nameSpan.textContent = r.icon + ' ' + r.name + ' (' + id + ')';
    row.appendChild(nameSpan);
    const editBtn = document.createElement('button');
    editBtn.textContent = '\u270F\uFE0F';
    editBtn.style.cssText = 'padding:2px 6px;background:#0f3460;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    editBtn.title = '\u7F16\u8F91';
    editBtn.addEventListener('click', function() { editRegion(id); });
    row.appendChild(editBtn);
    // \u5220\u9664\u6309\u94AE
    const delBtn = document.createElement('button');
    delBtn.textContent = '\uD83D\uDDD1\uFE0F';
    delBtn.style.cssText = 'padding:2px 6px;background:#5a1a2e;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;';
    delBtn.title = '\u5220\u9664';
    delBtn.addEventListener('click', function() {
      if (confirm('\u786E\u8BA4\u5220\u9664\u738B\u56FD\u300C' + r.name + '\u300D\uFF1F\u5DF2\u6D82\u8272\u7684\u683C\u5B50\u6570\u636E\u4E0D\u4F1A\u81EA\u52A8\u6E05\u9664\u3002')) {
        delete regions[id];
        if (selectedRegion === id) selectedRegion = null;
        rebuildRegionEditorList();
        rebuildRegionPalette();
        render();
      }
    });
    row.appendChild(delBtn);
    list.appendChild(row);
  });
}

function editRegion(id) {
  const r = regions[id];
  if (!r) return;
  let name = prompt('编辑王国「' + id + '」的名称：', r.name);
  if (name === null) return;
  let icon = prompt('编辑王国「' + id + '」的图标 (emoji)：', r.icon);
  if (icon === null) return;
  let color = prompt('编辑王国「' + id + '」的颜色 (hex)：', r.color);
  if (color === null) return;
  regions[id] = { name: name.trim() || r.name, icon: icon.trim() || r.icon, color: color.trim() || r.color };
  rebuildRegionEditorList();
  rebuildRegionPalette();
  render();
}

function addRegion() {
  const idInput = document.getElementById('re-new-id');
  const nameInput = document.getElementById('re-new-name');
  const iconInput = document.getElementById('re-new-icon');
  const colorInput = document.getElementById('re-new-color');
  if (!idInput || !idInput.value.trim()) {
    showDiceResult('⚠️', '请输入王国ID');
    return;
  }
  const id = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
  if (regions[id]) {
    showDiceResult('⚠️', '王国ID已存在');
    return;
  }
  regions[id] = {
    name: nameInput.value.trim() || id,
    icon: iconInput.value.trim() || '👑',
    color: colorInput.value || '#4a7fb5'
  };
  idInput.value = '';
  nameInput.value = '';
  iconInput.value = '';
  rebuildRegionEditorList();
  rebuildRegionPalette();
  render();
}

document.getElementById('re-btn-add')?.addEventListener('click', addRegion);
document.getElementById('re-btn-close')?.addEventListener('click', function() {
  document.getElementById('region-editor-modal').style.display = 'none';
});
document.getElementById('region-editor-modal')?.addEventListener('click', function(e) {
  if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
});

// 边境透明度控制
document.getElementById('border-opacity')?.addEventListener('input', function(e) {
  regionBorderOpacity = parseInt(e.target.value) / 100;
  document.getElementById('border-opacity-val').textContent = e.target.value + '%';
  render();
});

// 王国名称显示切换
document.getElementById('chk-region-names')?.addEventListener('change', function(e) {
  showRegionNames = e.target.checked;
  render();
});

// Roll dice — with animation
document.getElementById('btn-roll').addEventListener('click', () => {
  if (isGenerating) return;
  isGenerating = true;
  setGenButtonsDisabled(true);
  const formula = document.getElementById('dice-select').value;
  animateDiceRoll(formula, 500, (result) => {
    isGenerating = false;
    setGenButtonsDisabled(false);
    const detail = result.rolls.length > 1 ? `[${result.rolls.join(' + ')}]` : '';
    const label = result.n > 1 ? `${result.n}颗d${result.sides}` : `d${result.sides}`;
    showStepResult('🎲', `${label} →`, result.total, detail);
  });
});

// ======== Dice Roll Animation ========
function animateDiceRoll(formula, duration, onComplete) {
  const panel = document.getElementById('info-panel');
  const matches = formula.match(/^(\d*)d(\d+)$/i);
  const n = parseInt(matches[1]) || 1;
  const sides = parseInt(matches[2]);
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    if (elapsed < duration) {
      const currentN = [];
      for (let i = 0; i < n; i++) {
        currentN.push(Math.floor(Math.random() * sides) + 1);
      }
      const display = currentN.join(' ');
      const label = n > 1 ? `${n}颗d${sides}` : `d${sides}`;
      panel.innerHTML = `
        <div class="row" style="justify-content:center;">
          <span style="font-size:32px;font-weight:bold;color:#e94560;font-family:monospace,monospace;letter-spacing:4px;min-width:80px;text-align:center;">
            ${display}
          </span>
        </div>
        <div class="row" style="justify-content:center;">
          <span style="color:#aaa;font-size:13px;">🎲 投${label}中⋯</span>
        </div>`;
      requestAnimationFrame(tick);
    } else {
      const finalRolls = [];
      for (let i = 0; i < n; i++) {
        finalRolls.push(Math.floor(Math.random() * sides) + 1);
      }
      const finalTotal = finalRolls.reduce((a, b) => a + b, 0);
      onComplete({ rolls: finalRolls, total: finalTotal, sides, n });
    }
  }
  requestAnimationFrame(tick);
}

function showStepResult(icon, label, value, extra) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = `
    <div class="row" style="justify-content:center;">
      <span style="font-size:22px;font-weight:bold;color:#e94560;">
        ${icon} ${label} <span style="color:#fff;">${value}</span>
      </span>
    </div>
    ${extra ? `<div class="row" style="justify-content:center;margin-top:4px;"><span style="color:#aaa;font-size:15px;">${extra}</span></div>` : ''}`;
}

// Progress display with bar (for long-running async ops)
function showProgress(icon, label, done, total) {
  const panel = document.getElementById('info-panel');
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const barW = Math.max(0, Math.min(100, pct));
  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:4px;">
      <span style="font-size:16px;font-weight:bold;color:#e94560;">${icon} ${label}</span>
      <span style="font-size:13px;color:#ccc;"> ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)</span>
    </div>
    <div style="background:#1a1a2e;border-radius:4px;height:8px;overflow:hidden;max-width:400px;margin:0 auto;">
      <div style="background:linear-gradient(90deg,#e94560,#c23152);height:100%;width:${barW}%;transition:width 0.1s;"></div>
    </div>`;
}

// Random terrain — with roll animation (uses customizable rules)
document.getElementById('btn-gen-terrain').addEventListener('click', () => {
  if (isGenerating) return;
  if (!selectedHex) { showDiceResult('⚠️', '请先点击选择一个六角格'); return; }
  if (isLocked && getHex(selectedHex.q, selectedHex.r).terrain) {
    showDiceResult('🔒', '已锁定，取消勾选锁定后生成');
    return;
  }
  isGenerating = true;
  setGenButtonsDisabled(true);

  animateDiceRoll('d6', 500, (result) => {
    const d6 = result.total;
    const threshold = generationRules.d6Threshold;
    const defaultId = generationRules.defaultTerrain;
    const defaultT = getTerrainInfo(defaultId);
    const defaultName = defaultT?.name || defaultId;
    const defaultIcon = defaultT?.icon || '';

    if (d6 < threshold) {
      showStepResult('🎲', `投d6 → ${d6}`, '', `🏞️ ${defaultIcon} ${defaultName}`);
      setHex(selectedHex.q, selectedHex.r, { terrain: defaultId });
      render();
      isGenerating = false;
      setGenButtonsDisabled(false);
    } else {
      showStepResult('🎲', `投d6 → ${d6} 🎯`, '', '按权重表随机特殊地形⋯');
      const table = generationRules.specialTable;
      const totalWeight = table.reduce((s, e) => s + e.weight, 0);
      const dieFormula = 'd' + totalWeight;
      setTimeout(() => {
        animateDiceRoll(dieFormula, 500, (result2) => {
          const roll = result2.total - 1;
          let cumulative = 0;
          let chosen = table[0]?.terrainId || 'plain';
          for (const entry of table) {
            cumulative += entry.weight;
            if (roll < cumulative) { chosen = entry.terrainId; break; }
          }
          const t = getTerrainInfo(chosen);
          const ticon = t?.icon || '';
          const tname = t?.name || chosen;
          showStepResult('🎲', `抽中 → ${ticon} ${tname}`, '', `${dieFormula}示数:${result2.total}`);
          setHex(selectedHex.q, selectedHex.r, { terrain: chosen });
          render();
          isGenerating = false;
          setGenButtonsDisabled(false);
        });
      }, 600);
    }
  });
});

// Generate settlement (per 冒险者公会传说 rules) — with roll animation
document.getElementById('btn-gen-settlement').addEventListener('click', () => {
  if (isGenerating) return;
  if (!selectedHex) { showDiceResult('⚠️', '请先点击选择一个六角格'); return; }
  if (isLocked && getHex(selectedHex.q, selectedHex.r).settlement) {
    showDiceResult('🔒', '已有定居点，取消勾选锁定后生成');
    return;
  }
  isGenerating = true;
  setGenButtonsDisabled(true);

  animateDiceRoll('d6', 500, (result) => {
    const d6 = result.total;
    const ratingMap = { 1: -2, 2: -1, 3: 0, 4: 1, 5: 2, 6: 3 };
    const rating = ratingMap[d6];
    const name = randomName();
    const sign = rating >= 0 ? '+' : '';
    showStepResult('🏘️', '投d6 →', d6, `${name} 评分: ${sign}${rating}`);
    setHex(selectedHex.q, selectedHex.r, { terrain: generationRules.defaultTerrain, settlement: { name, rating } });
    render();
    isGenerating = false;
    setGenButtonsDisabled(false);
  });
});

// BFS pathfinding along hex grid — returns array of {q,r} from start to goal (inclusive)
// BFS pathfinding — uses index pointer instead of shift(), cameFrom instead of path copies
function hexPathfind(q1, r1, q2, r2) {
  if (q1 === q2 && r1 === r2) return [{ q: q1, r: r1 }];
  const startKey = hexKey(q1, r1);
  const goalKey = hexKey(q2, r2);
  const visited = new Set([startKey]);
  const cameFrom = {};
  const queue = [{ q: q1, r: r1 }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curKey = hexKey(cur.q, cur.r);
    const nbrs = neighbors(cur.q, cur.r);
    for (let ni = 0; ni < nbrs.length; ni++) {
      const n = nbrs[ni];
      const nk = hexKey(n.q, n.r);
      if (nk === goalKey) {
        // Reconstruct path
        const path = [{ q: n.q, r: n.r }];
        let ck = curKey;
        while (ck) {
          const parts = ck.split(','); path.unshift({ q: +parts[0], r: +parts[1] });
          ck = cameFrom[ck];
        }
        return path;
      }
      if (!visited.has(nk)) {
        visited.add(nk);
        cameFrom[nk] = curKey;
        queue.push({ q: n.q, r: n.r });
      }
    }
  }
  return null;
}

