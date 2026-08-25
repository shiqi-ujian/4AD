// ============================================================
//  Token Library (🧺 单位库) — 可复用的单位 token 预设管理
//  依赖: state.js/render.js/ui.js/terrain.js
//  预设保存在 localStorage；点击预设 → 拿起 → 点地图放置
// ============================================================
const LS_TOKEN_LIB_KEY = 'combatmap_token_lib_v1';
let tokenPresets = [];

function loadTokenLibrary() {
  try {
    const raw = localStorage.getItem(LS_TOKEN_LIB_KEY);
    tokenPresets = raw ? JSON.parse(raw) : [];
  } catch (e) { tokenPresets = []; }
  if (!Array.isArray(tokenPresets)) tokenPresets = [];
}
function saveTokenLibrary() {
  try { localStorage.setItem(LS_TOKEN_LIB_KEY, JSON.stringify(tokenPresets)); } catch (e) { /* ignore */ }
}
function nextPresetId() {
  return 'pre_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 首装时的示例预设（可在库中编辑/删除）
function seedDefaultPresets() {
  if (tokenPresets.length) return;
  tokenPresets = [
    { id: nextPresetId(), name: '战士', kind: 'player', icon: '⚔️', color: '#3a7abd', hp: 24, maxHp: 24, tempHp: 0, ac: '16', speed: '30尺', status: [], w: 1, h: 1, imgData: '', notes: '' },
    { id: nextPresetId(), name: '法师', kind: 'player', icon: '🔮', color: '#7a5a9e', hp: 18, maxHp: 18, tempHp: 0, ac: '12', speed: '30尺', status: [], w: 1, h: 1, imgData: '', notes: '' },
    { id: nextPresetId(), name: '游侠', kind: 'player', icon: '🏹', color: '#4a8a4a', hp: 20, maxHp: 20, tempHp: 0, ac: '14', speed: '30尺', status: [], w: 1, h: 1, imgData: '', notes: '' },
    { id: nextPresetId(), name: '哥布林', kind: 'enemy', icon: '👺', color: '#6a8a3a', hp: 7, maxHp: 7, tempHp: 0, ac: '15', speed: '30尺', status: [], w: 1, h: 1, imgData: '', notes: '' },
    { id: nextPresetId(), name: '骷髅', kind: 'enemy', icon: '💀', color: '#8a8a9a', hp: 13, maxHp: 13, tempHp: 0, ac: '13', speed: '30尺', status: [], w: 1, h: 1, imgData: '', notes: '' },
    { id: nextPresetId(), name: '酒馆老板', kind: 'npc', icon: '🍺', color: '#b08a5a', hp: 10, maxHp: 10, tempHp: 0, ac: '', speed: '', status: [], w: 1, h: 1, imgData: '', notes: '' }
  ];
  saveTokenLibrary();
}
loadTokenLibrary();
seedDefaultPresets();

const KIND_SHORT = { player: 'pk', enemy: 'ek', npc: 'nk', ally: 'ak' };

// 用预设数据填充“待放置”状态，进入放置模式
function pickTokenPreset(id) {
  const p = tokenPresets.find(x => x.id === id);
  if (!p) return;
  _unitPending = {
    kind: p.kind || 'npc',
    name: p.name || '',
    icon: p.icon || '🧝',
    color: p.color || '#3a7abd',
    hp: (p.hp !== undefined && p.hp !== null) ? p.hp : 10,
    maxHp: (p.maxHp !== undefined && p.maxHp !== null) ? p.maxHp : 10,
    tempHp: p.tempHp || 0,
    ac: p.ac || '',
    speed: p.speed || '',
    notes: p.notes || '',
    status: p.status || [],
    w: p.w || 1, h: p.h || 1,
    imgData: p.imgData || '',
    img: null,
    sightRadius: p.sightRadius,
    visionSource: p.visionSource
  };
  if (_unitPending.imgData) {
    const im = new Image();
    im.src = _unitPending.imgData;
    _unitPending.img = im;
  }
  _hoverUnit = null;
  setTool('unit');
  showToast(`🧝 已拿起「${p.name || '单位'}」— 点击地图放置，按住 Shift 连放，Esc 取消`);
}

function deleteTokenPreset(id) {
  const p = tokenPresets.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`从单位库删除「${p.name || '单位'}」？地图上已放置的单位不受影响。`)) return;
  tokenPresets = tokenPresets.filter(x => x.id !== id);
  saveTokenLibrary();
  renderTokenLibrary();
  showToast('🗑️ 已从单位库删除');
}

// 地图上的单位 → 预设对象（保留 imgData）
function presetFromToken(t) {
  return {
    id: nextPresetId(),
    name: t.name || '',
    kind: t.kind || 'npc',
    icon: t.icon || '🧝',
    color: t.color || '#3a7abd',
    hp: (t.hp !== undefined && t.hp !== null) ? t.hp : 10,
    maxHp: (t.maxHp !== undefined && t.maxHp !== null) ? t.maxHp : 10,
    tempHp: t.tempHp || 0,
    ac: t.ac || '',
    speed: t.speed || '',
    status: t.status || [],
    w: t.w || 1, h: t.h || 1,
    imgData: t.imgData || '',
    notes: t.notes || '',
    sightRadius: t.sightRadius,
    visionSource: t.visionSource
  };
}

function saveTokenToLibrary(t, silent) {
  const p = presetFromToken(t);
  // 同名且同类型时视为同一预设：更新而不是无限堆积
  const dup = tokenPresets.find(x => x.name === p.name && x.kind === p.kind);
  if (dup) Object.assign(dup, { ...p, id: dup.id });
  else tokenPresets.push(p);
  saveTokenLibrary();
  renderTokenLibrary();
  if (!silent) showToast(`📥 已存入单位库：${p.name || '单位'}`);
}

// 渲染单位库卡片网格
function renderTokenLibrary() {
  const list = document.getElementById('token-library-list');
  if (!list) return;
  list.innerHTML = '';
  if (!tokenPresets.length) {
    list.innerHTML = '<div style="grid-column:1/-1;color:#888;font-size:11px;text-align:center;padding:10px 4px;">单位库为空。点「➕ 新建预设」创建，或在地图上右键单位「📥 存入单位库」。</div>';
    return;
  }
  tokenPresets.forEach(p => {
    const card = document.createElement('div');
    card.className = 'tlib-card';
    card.title = `${p.name || '未命名'} · ${p.ac ? 'AC ' + p.ac + ' ' : ''}${p.speed ? p.speed + ' ' : ''}${p.notes ? '—— ' + p.notes : ''}（点击拿起放置）`;

    const kind = document.createElement('span');
    kind.className = 'tlib-kind ' + (KIND_SHORT[p.kind] || 'nk');
    kind.textContent = p.kind === 'player' ? '玩' : p.kind === 'enemy' ? '敌' : p.kind === 'ally' ? '盟' : 'NPC';

    const ava = document.createElement('div');
    ava.className = 'tlib-ava';
    ava.style.background = p.color || '#3a7abd';
    if (p.imgData) {
      const im = document.createElement('img');
      im.src = p.imgData;
      ava.appendChild(im);
    } else {
      ava.textContent = p.icon || '🧝';
    }

    const name = document.createElement('div');
    name.className = 'tlib-name';
    name.textContent = p.name || '未命名';

    const ops = document.createElement('div');
    ops.className = 'tlib-ops';
    const btnEdit = document.createElement('button');
    btnEdit.textContent = '✏️';
    btnEdit.title = '编辑预设';
    btnEdit.addEventListener('click', (e) => { e.stopPropagation(); editTokenPreset(p.id); });
    const btnDel = document.createElement('button');
    btnDel.textContent = '🗑️';
    btnDel.title = '删除预设';
    btnDel.addEventListener('click', (e) => { e.stopPropagation(); deleteTokenPreset(p.id); });
    ops.appendChild(btnEdit); ops.appendChild(btnDel);

    card.appendChild(kind); card.appendChild(ava); card.appendChild(name); card.appendChild(ops);
    card.addEventListener('click', () => pickTokenPreset(p.id));
    list.appendChild(card);
  });
}

// 编辑预设：复用单位弹窗（mode=lib）
function editTokenPreset(id) {
  const p = tokenPresets.find(x => x.id === id);
  if (!p) return;
  openUnitModal({ id: p.id, ...p }, 'lib');
}

function openTokenLibrarySection() {
  if (typeof switchPanel === 'function') switchPanel('lib');
  renderTokenLibrary();
  const sec = document.getElementById('sec-tokenlib');
  if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 新建预设：打开单位弹窗（mode=lib，空表单）
function newTokenPreset() {
  openUnitModal(null, 'lib');
}

// 把当前选中的地图单位存入单位库
function saveSelectedTokenToLibrary() {
  const ids = selectedTokens && selectedTokens.size ? Array.from(selectedTokens) : (selectedToken ? [selectedToken] : []);
  if (!ids.length) { showToast('⚠️ 请先在「选择」工具下点选一个单位'); return; }
  const t = tokens.find(x => x.id === ids[0]);
  if (!t) { showToast('⚠️ 未找到选中的单位'); return; }
  saveTokenToLibrary(t, false);
  openTokenLibrarySection();
}

// ============================================================
//  Bindings
// ============================================================
function initTokenLibraryUI() {
  const btnNew = document.getElementById('btn-tokenlib-new');
  if (btnNew) btnNew.addEventListener('click', newTokenPreset);
  const btnSaveSel = document.getElementById('btn-tokenlib-save-sel');
  if (btnSaveSel) btnSaveSel.addEventListener('click', saveSelectedTokenToLibrary);
  renderTokenLibrary();
}

initTokenLibraryUI();
