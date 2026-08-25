// ============================================================
//  Cloud persistence (☁️ 云端地图，像枭熊 Owlbear)
//  机制：地图唯一 id 放进 URL `?mapid=<id>`；回访同一 URL 自动从服务端加载；
//        改动后防抖自动保存到服务端 + 手动「☁️ 保存」按钮兜底。
//  后端：chmweb 主站 /api/map/<id>（GET 读 / POST 写，能力式随机 id，无登录）。
// ============================================================
const Cloud = { mapId: null, dirty: false, timer: null, loadedOnce: false };

function cloudApiBase() {
  // 允许 ?apibase= 覆盖（本地调试 / 自定义后端）；默认 chmweb 主站
  const m = (window.location.search || '').match(/[?&]apibase=([^&]+)/);
  if (m) return decodeURIComponent(m[1]);
  return typeof MAP_API_BASE !== 'undefined' ? MAP_API_BASE : '';
}
function cloudActive() {
  return !!cloudApiBase() && /^https?:/i.test(window.location.protocol || '');
}
function cloudMakeId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'm' + s;
}
function cloudStatus(text, color) {
  const el = document.getElementById('cloud-status');
  if (el) { el.textContent = text || ''; el.style.color = color || '#aaa'; }
}
function cloudSetUrlMapId(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mapid', id);
    window.history.replaceState({}, '', url.toString());
  } catch (e) { /* file:// 等场景忽略 */ }
}

function cloudSaveNow() {
  if (!cloudActive() || !Cloud.mapId) return Promise.resolve(true);
  Cloud.dirty = false;
  cloudStatus('☁️ 保存中…', '#aaa');
  const payload = buildCombatPayload();
  return fetch(cloudApiBase() + '/api/map/' + encodeURIComponent(Cloud.mapId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json().then(j => ({ ok: r.ok && !!(j && j.ok) })).catch(() => ({ ok: false })))
    .then(({ ok }) => {
      if (ok) cloudStatus('☁️ 已保存 ' + new Date().toLocaleTimeString(), '#4caf50');
      else { cloudStatus('☁️ 保存失败', '#e94560'); Cloud.dirty = true; }
      return ok;
    })
    .catch(() => { cloudStatus('☁️ 保存失败（离线?）', '#e94560'); Cloud.dirty = true; return false; });
}
function cloudScheduleSave() {
  if (!cloudActive() || !Cloud.mapId) return;
  clearTimeout(Cloud.timer);
  Cloud.timer = setTimeout(() => { if (Cloud.dirty) cloudSaveNow(); }, 2500);
}
function markMapDirty() {
  if (!cloudActive() || !Cloud.mapId) return;
  Cloud.dirty = true;
  cloudScheduleSave();
}
function cloudInit() {
  if (!cloudActive()) return;
  const m = (window.location.search || '').match(/[?&]mapid=([^&]+)/);
  let id = m ? decodeURIComponent(m[1]) : null;
  if (!id) { id = cloudMakeId(); cloudSetUrlMapId(id); }
  Cloud.mapId = id;
  cloudStatus('☁️ 载入中…', '#aaa');
  fetch(cloudApiBase() + '/api/map/' + encodeURIComponent(id))
    .then(r => ({ status: r.status, j: r.status === 200 ? r.json() : Promise.resolve(null) }))
    .then(async (r) => {
      const j = r.status === 200 ? await r.j : null;
      if (j && j.ok && j.data) { applyCombatData(j.data); showToast('☁️ 已从云端载入地图'); cloudStatus('☁️ 已就绪（改动自动保存）', '#4caf50'); }
      else if (r.status === 404) { cloudStatus('☁️ 新地图（改动自动保存）', '#4caf50'); }  // 服务端还没有这张图
      else { cloudStatus('☁️ 载入失败', '#e94560'); }
      Cloud.loadedOnce = true;
    })
    .catch(() => { cloudStatus('☁️ 载入失败（离线?）', '#e94560'); Cloud.loadedOnce = true; });
}
function manualCloudSave() {
  if (!cloudActive() || !Cloud.mapId) { showToast('☁️ 云端未启用'); return; }
  Cloud.dirty = true;
  cloudSaveNow().then(ok => showToast(ok ? '✅ 已保存到云端' : '⚠️ 保存失败，请检查网络'));
}
function newCloudMap() {
  if (!cloudActive()) { showToast('☁️ 云端未启用'); return; }
  const id = cloudMakeId();
  Cloud.mapId = id; Cloud.dirty = false; clearTimeout(Cloud.timer);
  cloudSetUrlMapId(id);
  applyCombatData({
    combatData: {}, dmData: {}, fog: {},
    initiativeOrder: [], initiativeIndex: 0,
    shapes: [], freeLines: [], tokens: [], groups: [],
    backgroundMap: null, viewX: 0, viewY: 0, zoom: 1, visionMode: 'auto'
  });
  if (typeof renderSceneList === 'function') renderSceneList();
  cloudStatus('☁️ 新建 ' + id, '#aaa');
  showToast('🆕 已新建云端地图 ' + id);
}
