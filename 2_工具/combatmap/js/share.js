// ============================================================
//  Share / Import — 紧凑分享链接（含地图完整数据）
// 依赖: state.js/core.js/render.js/ui.js/terrain.js
// 用法: 工具栏「🔗 分享」打开弹窗 → 复制链接/数据串 → 对方打开自动导入
// ============================================================

// ---------------- Base64URL 帮助函数 ----------------
function b64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function u8toAB(u8) { return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }

// ---------------- 压缩（优先 CompressionStream，兜底无压缩） ----------------
function compressionSupported() {
  try {
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  } catch (e) { return false; }
}

async function shareCompress(text) {
  if (compressionSupported()) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  }
  return new TextEncoder().encode(text);
}

async function shareDecompress(bytes) {
  if (compressionSupported() && bytes.length > 1 && bytes[0] === 0x1F && bytes[1] === 0x8B) {
    const stream = new Blob([u8toAB(bytes)], { type: 'application/gzip' }).stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return new TextDecoder().decode(out);
  }
  return new TextDecoder().decode(bytes);
}

// ---------------- 数据打包 / 解包 ----------------
function buildCombatPayload() {
  cleanData();
  return {
    combatData,
    shapes: shapes.map(s => { const c = { ...s }; delete c.img; return c; }),
    freeLines,
    tokens: tokens.map(t => { const c = { ...t }; delete c.img; return c; }),
    viewX, viewY, zoom,
    customTerrains,
    terrainOverrides
  };
}

function applyCombatData(data) {
  if (!data || typeof data !== 'object') throw new Error('空数据或格式错误');
  combatData = data.combatData || {};
  shapes = (data.shapes || []).map(sh => {
    if (sh.type === 'image' && sh.imgData && !sh.img) {
      const img = new Image();
      img.src = sh.imgData;
      img.onload = () => render();
      sh.img = img;
    }
    return sh;
  });
  freeLines = data.freeLines || [];
  restoreTokens(data.tokens || []);
  if (data.customTerrains || data.terrainOverrides) {
    customTerrains = data.customTerrains || {};
    terrainOverrides = data.terrainOverrides || {};
    saveCustomTerrains();
    refreshTerrains();
    rebuildTerrainPalette();
  }
  _shapeSeq = Math.max(_shapeSeq, ...shapes.map(s => parseInt(String(s.id).replace('sh','')) || 0)) + 1;
  _lineSeq = Math.max(_lineSeq, ...freeLines.map(l => parseInt(String(l.id).replace('ln','')) || 0)) + 1;
  _tokenSeq = Math.max(_tokenSeq, ...tokens.map(t => parseInt(String(t.id).replace('tk','')) || 0)) + 1;
  undoStack = []; redoStack = []; updateUndoButtons();
  viewX = data.viewX || 0; viewY = data.viewY || 0; zoom = data.zoom || 1;
  const zi = document.getElementById('zoom-indicator');
  if (zi) zi.textContent = '🔍 ' + Math.round(zoom * 100) + '%';
  render(); updateInfo();
  return Object.keys(combatData).length;
}

// 从用户粘贴的文本里取出紧凑串：接受完整链接、纯串、带 #m=/compact: 前缀
function extractCombatShareText(raw) {
  let s = (raw || '').trim();
  if (s.indexOf('#') !== -1) {
    const frag = s.split('#')[1] || '';
    const m = frag.match(/m=([A-Za-z0-9_-]+)/);
    if (m) s = m[1];
  }
  if (s.startsWith('compact:')) s = s.slice('compact:'.length);
  if (s.startsWith('m=')) s = s.slice(2);
  return s.trim();
}

async function combatEncodeString() {
  const json = JSON.stringify(buildCombatPayload());
  const bytes = await shareCompress(json);
  return b64UrlEncode(bytes);
}

async function decodeCombatText(raw) {
  const body = extractCombatShareText(raw);
  if (!body) throw new Error('空数据');
  const bytes = b64UrlDecode(body);
  const text = await shareDecompress(bytes);
  return JSON.parse(text);
}

// ---------------- 分享弹窗 UI ----------------
function setCombatShareStatus(msg) {
  const el = document.getElementById('share-status');
  if (el) el.textContent = msg || '';
}
function openCombatShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  modal.style.display = 'block';
  setCombatShareStatus('点击「生成分享」创建数据串，或粘贴已有数据后导入。');
  document.getElementById('share-text').value = '';
  document.getElementById('share-loading').style.display = 'none';
}
function closeCombatShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.style.display = 'none';
}
function combatShareLinkFor(code) {
  return location.origin + location.pathname + '?m=1#m=' + encodeURIComponent(code);
}
function combatGenerateShare() {
  const box = document.getElementById('share-text');
  const loading = document.getElementById('share-loading');
  loading.style.display = 'block';
  setCombatShareStatus('⏳ 编码中…');
  combatEncodeString().then(code => {
    box.value = combatShareLinkFor(code);
    loading.style.display = 'none';
    setCombatShareStatus('✅ 已生成 ' + (code.length / 1024).toFixed(1) + ' KB，可复制链接或数据串。');
  }).catch(err => {
    loading.style.display = 'none';
    setCombatShareStatus('⚠️ 编码失败: ' + (err && err.message));
  });
}
function combatCopyText(value) {
  if (!value) { setCombatShareStatus('⚠️ 请先生成分享内容'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(value).then(() => setCombatShareStatus('✅ 已复制'), () => fallbackCombatCopy(value));
  } else {
    fallbackCombatCopy(value);
  }
}
function fallbackCombatCopy(text) {
  const box = document.getElementById('share-text');
  box.value = text;
  box.select();
  try { document.execCommand('copy'); setCombatShareStatus('✅ 已复制'); } catch(e) { setCombatShareStatus('⚠️ 复制失败，请手动复制文本框内容'); }
}
function combatCopyData(v) {
  if (!v) { setCombatShareStatus('⚠️ 请先生成分享内容'); return; }
  const code = extractCombatShareText(v);
  if (!code) { setCombatShareStatus('⚠️ 未识别到数据串'); return; }
  combatCopyText(code);
}
function combatImportFromBox() {
  const raw = document.getElementById('share-text').value.trim();
  if (!raw) { setCombatShareStatus('⚠️ 请先粘贴数据串或完整 JSON'); return; }
  setCombatShareStatus('⏳ 解压并导入中…');
  decodeCombatText(raw).then(data => {
    const n = applyCombatData(data);
    setCombatShareStatus('✅ 已导入 ' + n + ' 个格子');
    closeCombatShareModal();
  }).catch(() => {
    // 回退：直接粘贴完整 JSON
    try {
      const data = JSON.parse(raw);
      const n = applyCombatData(data);
      setCombatShareStatus('✅ 已导入 ' + n + ' 个格子');
      closeCombatShareModal();
    } catch (err2) {
      setCombatShareStatus('⚠️ 导入失败: ' + (err2 && err2.message));
    }
  });
}

function initCombatShareUI() {
  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.addEventListener('click', openCombatShareModal);
  const btnClose = document.getElementById('share-btn-close');
  if (btnClose) btnClose.addEventListener('click', closeCombatShareModal);
  const modal = document.getElementById('share-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeCombatShareModal(); });
  const btnGen = document.getElementById('share-btn-generate');
  if (btnGen) btnGen.addEventListener('click', combatGenerateShare);
  const btnCopyLink = document.getElementById('share-btn-copy-link');
  if (btnCopyLink) btnCopyLink.addEventListener('click', () => {
    const v = document.getElementById('share-text').value.trim();
    if (!v.includes('#')) combatGenerateShare();
    else combatCopyText(v);
  });
  const btnCopyData = document.getElementById('share-btn-copy-data');
  if (btnCopyData) btnCopyData.addEventListener('click', () => {
    combatCopyData(document.getElementById('share-text').value.trim());
  });
  const btnImport = document.getElementById('share-btn-import');
  if (btnImport) btnImport.addEventListener('click', combatImportFromBox);
  // URL 分享地图自动导入在 init() 后调用（export.js 里没有重复监听）
  setTimeout(loadCombatMapFromUrlShare, 0);
}

// ---------------- URL 自动导入 ----------------
function loadCombatMapFromUrlShare() {
  const mIndex = location.hash.indexOf('m=');
  if (mIndex === -1) return;
  const code = decodeURIComponent(location.hash.slice(mIndex + 2));
  if (!code) return;
  showToast('🔗 检测到分享地图，正在导入…');
  decodeCombatText(code).then(data => {
    const n = applyCombatData(data);
    showToast('🔗 已导入 ' + n + ' 个格子');
    if (history.replaceState) {
      const clean = location.origin + location.pathname + location.search;
      try { history.replaceState(null, '', clean); } catch (e) { /* ignore */ }
    }
  }).catch(err => showToast('⚠️ 分享地图导入失败: ' + ((err && err.message) || '数据无效')));
}