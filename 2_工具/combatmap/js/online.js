// ============================================================
//  Online — WebSocket 服务器中继 hub（星型：所有成员连 chm-web /ws）
//  依赖: state.js/core.js/render.js/share.js
//  用法: 工具栏「🌐 在线」创建房间/加入房间；DM 本地改动经过
//  render() 节流广播完整快照，服务器转发给房间内其它成员。
//  玩家只读（DM 权威）；DM 刷新后可重连恢复。服务器缓存 DM 权威快照，
//  新加入/重连成员立即补发，房间不因单人刷新而散；
//  成员名单由服务器统一广播，两端计数一致，不再出现「1 人 / 2 人」分裂。
// ============================================================

const WS_PATH = '/ws';
const HEARTBEAT_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000;

let onlineWS = null;           // 到服务器的 WebSocket（每个成员一条）
let onlineRoom = '';
let onlineSelfId = '';         // 服务器分配的成员 id
let onlineIsPlayer = false;    // true = 加入房间的玩家（只读）；false = 创建房间的 DM（权威）
let onlineSync = false;
let onlineMseq = 0;
let onlineApplyRemote = false;
let onlineTimer = null;
let onlineHeartbeatTimer = null;
let onlineReconnectTimer = null;
let onlineLastPong = 0;
let onlineRetryCount = 0;
let onlineIntentionalLeave = false;
let onlineRoster = [];         // 服务器广播的成员列表 [{id,name,role}]
const LS_ONLINE_NAME_KEY = 'combatmap_online_name';
let onlineUserName = '';       // 参与者在房间内显示的昵称

function payloadForRole(payload, role) {
  if (role !== 'player') return payload;
  // 玩家只接收「玩家可见地图」：DM 隐藏层、战雾、行动顺序、DM 专用底图设置不下发
  const p = JSON.parse(JSON.stringify(payload || {}));
  delete p.dmData;
  delete p.fog;
  delete p.initiativeOrder;
  delete p.initiativeIndex;
  return p;
}

function applyOnlineRoleUI() {
  const isPlayer = onlineIsPlayer && !!onlineWS;
  if (isPlayer) {
    showDmLayer = false;
    const dmChk = document.getElementById('chk-dm');
    if (dmChk) dmChk.checked = false;
    if (selectedTool === 'dm' || selectedTool === 'fog') setTool('select');
  }
  if (typeof applyRoleViewUI === 'function') applyRoleViewUI();
}

function setOnlineStatus(msg) {
  const el = document.getElementById('online-status');
  if (el) el.textContent = msg || '';
  const st = document.getElementById('btn-online-status');
  if (st) {
    st.textContent = onlineWS ? (onlineSync ? (onlineIsPlayer ? '玩家' : 'DM') : '连接中…') : '未连接';
    st.disabled = !onlineWS;
    st.style.opacity = onlineWS ? '1' : '0.4';
    st.style.background = onlineSync ? (onlineIsPlayer ? '#3a7abd' : '#2d6a2e') : '#3a3a5e';
    st.style.color = onlineWS ? '#fff' : '#aaa';
  }
  if (typeof renderRoster === 'function') renderRoster();
}

function sanitizeRoom(s) {
  s = (s || '').trim().toLowerCase();
  s = s.replace(/[^a-z0-9-]/g, '');
  return s.slice(0, 48);
}
function onlineGetName() {
  let n = (document.getElementById('online-name')?.value || '').trim();
  if (!n) { try { n = localStorage.getItem(LS_ONLINE_NAME_KEY) || ''; } catch (e) { /* ignore */ } }
  if (!n) n = onlineIsPlayer ? '玩家' : 'DM';
  return n.slice(0, 16);
}
function onlineSetName() {
  const n = onlineGetName();
  onlineUserName = n;
  try { localStorage.setItem(LS_ONLINE_NAME_KEY, n); } catch (e) { /* ignore */ }
  return n;
}

// —— WebSocket 地址 ——
// 优先 localStorage.combatmap_ws_url（部署后可覆盖），否则取当前页面同源 /ws。
function wsUrl() {
  try {
    const o = localStorage.getItem('combatmap_ws_url');
    if (o && /^wss?:\/\//i.test(o)) return o;
  } catch (e) { /* ignore */ }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return proto + '//' + location.host + WS_PATH;
}

function openOnlineModal() {
  const modal = document.getElementById('online-modal');
  if (!modal) return;
  if (typeof WebSocket === 'undefined') {
    setOnlineStatus('⚠️ 当前浏览器不支持 WebSocket');
    return;
  }
  const inp = document.getElementById('online-room');
  if (!inp.value) inp.value = 'dm-' + Date.now().toString(36).slice(-6);
  const nameInp = document.getElementById('online-name');
  if (nameInp && !nameInp.value) {
    try { nameInp.value = localStorage.getItem(LS_ONLINE_NAME_KEY) || ''; } catch (e) { /* ignore */ }
  }
  modal.style.display = 'block';
  setOnlineStatus(onlineWS
    ? `已连接房间 ${onlineRoom}，${onlineRoster.length} 人在线`
    : '创建房间或加入已有房间');
}

function closeOnlineModal() {
  const modal = document.getElementById('online-modal');
  if (modal) modal.style.display = 'none';
}

function buildOnlineSnapshot() {
  return {
    type: 'snapshot',
    seq: ++onlineMseq,
    ts: Date.now(),
    data: buildCombatPayload()
  };
}

function onlineSend(payload) {
  if (!onlineWS || onlineWS.readyState !== WebSocket.OPEN) return;
  try { onlineWS.send(JSON.stringify(payload)); } catch (e) { /* ignore */ }
}

function broadcastSnapshot() {
  if (!onlineSync || onlineIsPlayer) return; // 玩家只读，不广播
  onlineSend(buildOnlineSnapshot());
}

function scheduleOnlineSnapshot() {
  if (!onlineSync || onlineApplyRemote || onlineIsPlayer) return;
  clearTimeout(onlineTimer);
  onlineTimer = setTimeout(() => broadcastSnapshot(), 120);
}

// 包装 render：本地每次渲染后触发节流广播；远端应用期间不转播。
const __combatmapOriginalRender = render;
render = function () {
  __combatmapOriginalRender();
  scheduleOnlineSnapshot();
};

function applyRemoteSnapshot(msg) {
  if (!msg || msg.type !== 'snapshot' || !msg.data) return;
  if (!onlineSync) onlineSync = true;
  onlineApplyRemote = true;
  try {
    const data = payloadForRole(msg.data, onlineIsPlayer ? 'player' : 'dm');
    const n = applyCombatData(data);
    showToast(`🌐 已同步远端地图 ${n} 格 / ${tokens.length} 单位`);
  } catch (e) {
    console.error('远端同步失败', e);
    showToast('⚠️ 远端同步失败: ' + (e && e.message));
  }
  onlineApplyRemote = false;
  render();
}

function handleOnlineMessage(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'joined') {
    onlineSelfId = msg.id;
  } else if (msg.type === 'roster') {
    onlineRoster = msg.members || [];
    renderRoster();
  } else if (msg.type === 'snapshot') {
    applyRemoteSnapshot(msg);
  } else if (msg.type === 'pong') {
    onlineLastPong = Date.now();
  } else if (msg.type === 'error') {
    setOnlineStatus('⚠️ ' + (msg.error || '房间错误'));
  }
}

function onlineConnect(room, role) {
  const url = wsUrl();
  onlineIntentionalLeave = false;
  onlineWS = new WebSocket(url);
  onlineRoom = room;
  onlineIsPlayer = role !== 'dm';
  onlineSync = false;

  onlineWS.onopen = () => {
    onlineLastPong = Date.now();
    onlineRetryCount = 0;
    onlineSetName();
    onlineRoster = [];
    viewRole = onlineIsPlayer ? 'player' : 'dm';
    applyOnlineRoleUI();
    onlineSend({ type: 'join', room, role, name: onlineUserName });
    onlineStartHeartbeat();
    setOnlineStatus('✅ 已进入房间 ' + room + '，等待成员…');
    // 主机（DM）就绪即广播一份权威快照，让在座/新加入者立刻有图
    if (!onlineIsPlayer) { onlineSync = true; setTimeout(() => broadcastSnapshot(), 300); }
  };
  onlineWS.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    handleOnlineMessage(msg);
  };
  onlineWS.onerror = () => {
    setOnlineStatus('⚠️ 连接错误');
  };
  onlineWS.onclose = () => {
    onlineStopHeartbeat();
    onlineSync = false;
    if (onlineIntentionalLeave || !onlineRoom) return;
    setOnlineStatus('⚠️ 与服务器断开，尝试重连…');
    onlineScheduleReconnect();
  };
}

function onlineCreateRoom() {
  if (onlineWS) { setOnlineStatus('⚠️ 已在房间中，请先离开'); return; }
  const roomId = sanitizeRoom(document.getElementById('online-room')?.value || '');
  if (!roomId) { setOnlineStatus('⚠️ 请输入房间名'); return; }
  onlineSetName();
  onlineConnect(roomId, 'dm');
  closeOnlineModal();
  showToast('🌐 房间已创建：' + roomId + '（DM ' + onlineUserName + '）');
}

function onlineJoinRoom(roomRaw) {
  if (onlineWS) { setOnlineStatus('⚠️ 已在房间中，请先离开'); return; }
  const roomId = sanitizeRoom(roomRaw);
  if (!roomId) { setOnlineStatus('⚠️ 房间名不能为空'); return; }
  onlineSetName();
  onlineConnect(roomId, 'player');
  closeOnlineModal();
  showToast('🌐 已加入房间 ' + roomId + '（玩家 ' + onlineUserName + '）');
}

function onlineLeave() {
  onlineIntentionalLeave = true;
  if (onlineWS) {
    try { onlineWS.send(JSON.stringify({ type: 'leave' })); } catch (e) { /* ignore */ }
    try { onlineWS.close(); } catch (e) { /* ignore */ }
  }
  onlineStopHeartbeat();
  clearTimeout(onlineReconnectTimer);
  onlineWS = null;
  onlineRoom = '';
  onlineIsPlayer = false;
  onlineSelfId = '';
  onlineSync = false;
  onlineRoster = [];
  viewRole = 'dm';
  applyOnlineRoleUI();
  setOnlineStatus('已离开房间');
  showToast('🚪 已离开在线房间');
}

function onlineStartHeartbeat() {
  onlineStopHeartbeat();
  onlineHeartbeatTimer = setInterval(onlineHeartbeatTick, HEARTBEAT_MS);
}
function onlineStopHeartbeat() {
  if (onlineHeartbeatTimer) { clearInterval(onlineHeartbeatTimer); onlineHeartbeatTimer = null; }
}
function onlineHeartbeatTick() {
  if (!onlineWS || onlineWS.readyState !== WebSocket.OPEN) return;
  try { onlineWS.send(JSON.stringify({ type: 'ping', ts: Date.now() })); } catch (e) { /* ignore */ }
  if (onlineLastPong && Date.now() - onlineLastPong > HEARTBEAT_TIMEOUT_MS) {
    try { onlineWS.close(); } catch (e) { /* ignore */ } // 触发 onclose → 自动重连
  }
}

function onlineScheduleReconnect() {
  clearTimeout(onlineReconnectTimer);
  if (!onlineRoom) return;
  const room = onlineRoom;
  const isP = onlineIsPlayer;
  const delay = Math.min(1000 * Math.pow(2, Math.min(onlineRetryCount, 5)), 20000);
  onlineRetryCount++;
  setOnlineStatus(`⚠️ 连接断开，${Math.round(delay / 1000)}s 后自动重连…`);
  onlineReconnectTimer = setTimeout(() => {
    onlineLeave();
    onlineConnect(room, isP ? 'player' : 'dm');
  }, delay);
}

function onlineCopyInvite() {
  if (!onlineRoom) { setOnlineStatus('⚠️ 先创建/加入房间'); return; }
  const url = location.origin + location.pathname + '?room=' + encodeURIComponent(onlineRoom) + '&online=1';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => setOnlineStatus('📋 邀请链接已复制'), () => fallbackCopyOnline(url));
  } else fallbackCopyOnline(url);
}

function fallbackCopyOnline(text) {
  const el = document.createElement('input');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); setOnlineStatus('📋 邀请链接已复制'); } catch (e) { setOnlineStatus('请手动复制：' + text); }
  el.remove();
}

function initOnlineUI() {
  const modal = document.getElementById('online-modal');
  if (!modal) return;
  document.getElementById('btn-online').addEventListener('click', openOnlineModal);
  document.getElementById('online-btn-create').addEventListener('click', onlineCreateRoom);
  document.getElementById('online-btn-join').addEventListener('click', () => onlineJoinRoom(document.getElementById('online-room').value));
  document.getElementById('online-btn-copy').addEventListener('click', onlineCopyInvite);
  document.getElementById('online-btn-leave').addEventListener('click', onlineLeave);
  document.getElementById('online-btn-close').addEventListener('click', closeOnlineModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeOnlineModal(); });

  // 从 ?room= 自动加入（玩家）
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (room && params.get('online') === '1') {
    setTimeout(() => {
      const inp = document.getElementById('online-room');
      if (inp) inp.value = room;
      onlineJoinRoom(room);
    }, 600);
  }
}

function initOnline() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOnlineUI);
  } else {
    initOnlineUI();
  }
}
initOnline();

// ============================================================
//  v0.96: 常驻可折叠玩家名册 + 帮助/快捷键速查入口
// ============================================================
function rosterMembers() {
  if (!onlineWS || !onlineRoom) return [];
  // 名册以服务器广播为准，两端一致；按服务器分配的 id 标记自己
  return (onlineRoster || []).map((m) => ({ ...m, me: m.id === onlineSelfId }));
}

function renderRoster() {
  const panel = document.getElementById('roster-panel');
  if (!panel) return;
  const body = document.getElementById('roster-body');
  const count = document.getElementById('roster-count');
  const members = rosterMembers();
  if (count) count.textContent = members.length ? `(${members.length})` : '离线';
  if (!body) return;
  body.innerHTML = '';
  if (members.length === 0) {
    body.innerHTML = '<div style="padding:4px 6px;font-size:11px;color:#888;">🌐 未连接房间</div>';
  } else {
    members.forEach((m) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 4px;margin:1px 0;border-radius:4px;background:rgba(255,255,255,0.04);';
      const roleChip = document.createElement('span');
      roleChip.textContent = m.role === 'dm' ? '🎲 DM' : '👤 玩家';
      roleChip.style.cssText = 'font-size:10px;padding:1px 5px;border-radius:4px;color:#fff;flex-shrink:0;background:' + (m.role === 'dm' ? '#2d6a2e' : '#3a7abd') + ';';
      const name = document.createElement('span');
      name.textContent = m.name + (m.me ? ' (你)' : '');
      name.style.cssText = 'flex:1;font-size:11px;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      row.appendChild(roleChip); row.appendChild(name);
      body.appendChild(row);
    });
  }
}

function toggleRoster() {
  const body = document.getElementById('roster-body');
  if (!body) return;
  const show = body.style.display !== 'block';
  body.style.display = show ? 'block' : 'none';
  const hdr = document.getElementById('roster-header');
  if (hdr) hdr.classList.toggle('expanded', show);
  renderRoster();
}

function openHelp() {
  const m = document.getElementById('help-modal');
  if (m) m.style.display = 'block';
}
function closeHelp() {
  const m = document.getElementById('help-modal');
  if (m) m.style.display = 'none';
}

const rosterHdr = document.getElementById('roster-header');
if (rosterHdr) rosterHdr.addEventListener('click', toggleRoster);
const helpBtn = document.getElementById('help-btn');
if (helpBtn) helpBtn.addEventListener('click', openHelp);
const helpCloseBtn = document.getElementById('help-close');
if (helpCloseBtn) helpCloseBtn.addEventListener('click', closeHelp);
const helpModal = document.getElementById('help-modal');
if (helpModal) {
  const sc = document.getElementById('help-shortcuts');
  if (sc) {
    sc.innerHTML = [
      ['🎯 基础工具', 'V 选择 · B 笔刷 · W 墙壁 · D 门 · L 标签 · E 擦除 · R 区域 · G 线段 · T 图片 · M 测量'],
      ['🧝 单位', 'U 打开单位库 · 点预设拿起 → 地图放置 · Shift 连放 · Esc 取消'],
      ['🎲 DM / 战雾', 'Y DM层 · F 战雾 · Shift 点选多选单位'],
      ['⬅️ 撤销 / 编辑', 'Ctrl+Z 撤销 · Ctrl+Y 重做 · Ctrl+D 复制选中 · Delete 删除'],
      ['🔍 视角', '滚轮缩放 · 拖拽(空白)平移 · 右键菜单'],
      ['🌐 在线', '「房间」页签创建/加入房间，玩家可看到在线成员名册'],
    ].map(([k, v]) => `<div style="margin-bottom:7px;"><b style="color:#e8b46a;">${k}</b><br><span style="color:#ddd;">${v}</span></div>`).join('');
  }
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });
}
renderRoster();
