// ======== 搜索定位面板 ========
// 按关键词搜索定居点 / 地名标签 / 王国 / 标注 / 坐标，点击结果定位到对应格子。
// 依赖: hexData, regions, getAllTerrains(), hexToPixel, render()

// 把视图中心移动到某格 (q, r)
function centerOnHex(q, r) {
  const p = hexToPixel(q, r);
  viewX = canvas.width / 2 - p.x * zoom;
  viewY = canvas.height / 2 - p.y * zoom;
  selectedHex = { q, r };
  render();
  updateInfo();
}

function openSearchModal() {
  const modal = document.getElementById('search-modal');
  if (!modal) return;
  const input = document.getElementById('search-input');
  modal.style.display = 'block';
  // 清空不聚焦，避免与快捷键冲突；聚焦方便直接输入
  setTimeout(function() { if (input) input.focus(); }, 50);
  runSearch();
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  if (modal) modal.style.display = 'none';
}

// 收集地图上的所有可搜索条目
function collectSearchEntries() {
  const entries = [];
  const fSettle = document.getElementById('search-f-settle').checked;
  const fLabel = document.getElementById('search-f-label').checked;
  const fRegion = document.getElementById('search-f-region').checked;
  const fAnn = document.getElementById('search-f-ann').checked;
  const fTerrain = document.getElementById('search-f-terrain').checked;
  const allTerrains = getAllTerrains();

  const seenSettlements = new Set();
  for (const key of Object.keys(hexData)) {
    const parts = key.split(',');
    const q = +parts[0], r = +parts[1];
    const h = hexData[key];
    if (!h) continue;

    if (fSettle && h.settlement && h.settlement.name) {
      seenSettlements.add(key);
      const ti = h.terrain ? allTerrains[h.terrain] : null;
      entries.push({
        type: 'settle',
        q, r,
        title: h.settlement.name,
        detail: (ti ? ti.icon + ' ' + ti.name : '未知地形') + ' · 评级 ' + (h.settlement.rating >= 0 ? '+' : '') + (h.settlement.rating ?? 0),
        icon: (function() { const ri = {'-3':'🛖','-2':'🏕️','-1':'🏘️','0':'🏘️','1':'🏛️','2':'🏰','3':'🏙️'}; return ri[String(h.settlement.rating)] || '🏘️'; })()
      });
    }

    if (fLabel && h.label) {
      entries.push({ type: 'label', q, r, title: h.label, sub: '地名标签', icon: '🏷️' });
    }

    if (fRegion && h.region && regions[h.region]) {
      entries.push({ type: 'region', q, r, title: regions[h.region].name, sub: '王国边境', icon: regions[h.region].icon || '👑' });
    }

    if (fAnn && h.annotations && h.annotations.length) {
      h.annotations.forEach(function(a) {
        if (!a || !a.text) return;
        const at = ANNOTATION_TYPES[a.type] || ANNOTATION_TYPES.note;
        entries.push({ type: 'ann', q, r, title: a.text, sub: '标注 · ' + (at.name || '标注'), icon: at.icon || '📍' });
      });
    }

    if (fTerrain) {
      const t = h.terrain ? allTerrains[h.terrain] : null;
      if (t) {
        entries.push({ type: 'coord', q, r, title: t.name, sub: '坐标 (' + q + ', ' + r + ')', icon: t.icon || '⬡' });
      }
    }
  }

  // 去重相邻条目（同一格多种属性合并显示，但保留 try 定位）
  // 按坐标排序，便于浏览
  entries.sort(function(a, b) { return a.q - b.q || a.r - b.r; });
  return entries;
}

function runSearch() {
  const input = document.getElementById('search-input');
  const box = document.getElementById('search-results');
  if (!box) return;
  const kw = (input.value || '').trim().toLocaleLowerCase();

  const all = collectSearchEntries();
  let list;
  if (!kw) {
    // 无关键词：列出全部，限制数量避免卡顿
    list = all.slice(0, 200);
    box.innerHTML = '<div style="color:#888;font-size:12px;margin-bottom:6px;">共 ' + all.length + ' 条，显示前 ' + list.length + ' 条' + (all.length > list.length ? '（输入关键词过滤）' : '') + '</div>';
  } else {
    list = all.filter(function(e) {
      const hay = (e.title + ' ' + (e.sub || '')).toLocaleLowerCase();
      return hay.indexOf(kw) !== -1;
    });
    if (list.length === 0) {
      box.innerHTML = '<div style="color:#888;font-size:12px;">没有匹配「' + input.value + '」的结果</div>';
      return;
    }
    box.innerHTML = '<div style="color:#888;font-size:12px;margin-bottom:6px;">找到 ' + list.length + ' 个结果</div>';
  }

  const rowsFrag = document.createDocumentFragment();
  list.forEach(function(e) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;border-bottom:1px solid #1a1a2e;';
    row.style.background = 'transparent';
    row.onmouseenter = function() { row.style.background = '#1a1a2e'; };
    row.ondragstart = function() {};
    row.addEventListener('mouseleave', function() { row.style.background = 'transparent'; });
    row.addEventListener('click', function() {
      centerOnHex(e.q, e.r);
      closeSearchModal();
    });

    const icon = document.createElement('span');
    icon.textContent = e.icon || '📍';
    icon.style.flex = '0 0 auto';

    const info = document.createElement('div');
    info.style.flex = '1';
    info.style.minWidth = '0';
    const t = document.createElement('div');
    t.textContent = e.title + '  (' + e.q + ', ' + e.r + ')';
    t.style.color = '#ffd700';
    t.style.fontSize = '13px';
    t.style.fontWeight = 'bold';
    t.style.whiteSpace = 'nowrap';
    t.style.overflow = 'hidden';
    t.style.textOverflow = 'ellipsis';
    const s = document.createElement('div');
    s.textContent = e.sub || '';
    s.style.color = '#aaa';
    s.style.fontSize = '11px';
    info.appendChild(t); info.appendChild(s);

    const go = document.createElement('span');
    go.textContent = '➞';
    go.style.flex = '0 0 auto';
    go.style.color = '#555';

    row.appendChild(icon); row.appendChild(info); row.appendChild(go);
    rowsFrag.appendChild(row);
  });
  box.innerHTML = '';
  box.appendChild(rowsFrag);
}

// 事件绑定
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('btn-search');
  if (btn) btn.addEventListener('click', openSearchModal);

  const input = document.getElementById('search-input');
  if (input) input.addEventListener('input', runSearch);

  const btnClear = document.getElementById('search-btn-clear');
  if (btnClear) btnClear.addEventListener('click', function() { input.value = ''; runSearch(); input.focus(); });

  const closeBtn = document.getElementById('search-btn-close');
  if (closeBtn) closeBtn.addEventListener('click', closeSearchModal);
  const closeX = document.getElementById('search-btn-close-x');
  if (closeX) closeX.addEventListener('click', closeSearchModal);

  // 过滤条件变化时重新搜索
  ['search-f-settle','search-f-label','search-f-region','search-f-ann','search-f-terrain'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', runSearch);
  });

  // 点击遮罩关闭
  const modal = document.getElementById('search-modal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeSearchModal(); });
  // Esc 关闭
  if (input) input.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeSearchModal(); });
});