// ============================================================
//  Online — PeerJS P2P 实时同步（星型：主机=房主，客户端直连主机）
//  依赖: state.js/core.js/render.js/share.js
//  用法: 工具栏「🌐 在线」创建房间/加入房间；任一本地改动经过
//  render() 自动节流广播完整快照。主机收到客户端快照后应用并转播。
//  注意：DM 层/战雾/行动顺序随完整快照同步；若需要 DM 隐藏层
//  不对玩家公开，应后续加角色权限过滤（当前为全量 P2P 同步）。
// ============================================================

const PEER_CONFIG = {
  host: '0.peerjs.com',
  port: 443,
  path: '/',
  secure: true,
  debug: 0,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
};

let onlinePeer = null;
let onlineRoom = '';
let onlineConnections = [];   // DataConnection 列表
let onlineSync = false;
let onlineMseq = 0;
let onlineApplyRemote = false;
let onlineTimer = null;
let onlineIsPlayer = false;   // true = 加入房间的玩家；false = 创建房间的 DM
const LS_ONLINE_NAME_KEY = 'combatmap_online_name';
let onlineUserName = '';      // 参与者在房间内显示的昵称
let onlineRoster = [];        // 玩家端缓存的主机广播成员列表 [{id,name,role}]

function payloadForRole(payload, role) {
  if (role !== 'player') return payload;
  // 玩家只接收“玩家可见地图”：DM 隐藏层、战雾、行动顺序、DM 专用底图设置不下发
  const p = JSON.parse(JSON.stringify(payload || {}));
  delete p.dmData;
  delete p.fog;
  delete p.initiativeOrder;
  delete p.initiativeIndex;
  return p;
}

function applyOnlineRoleUI() {
  const isPlayer = onlineIsPlayer && !!onlinePeer;
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
    st.textContent = onlinePeer ? (onlineSync ? (onlineIsPlayer ? '玩家' : 'DM') : '连接中…') : '未连接';
    st.disabled = !onlinePeer;
    st.style.opacity = onlinePeer ? '1' : '0.4';
    st.style.background = onlineSync ? (onlineIsPlayer ? '#3a7abd' : '#2d6a2e') : '#3a3a5e';
    st.style.color = onlinePeer ? '#fff' : '#aaa';
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

function openOnlineModal() {
  const modal = document.getElementById('online-modal');
  if (!modal) return;
  if (typeof Peer === 'undefined' || (window.__combatmapCDN && window.__combatmapCDN.peerjs === false)) {
    setOnlineStatus('⚠️ PeerJS 未加载：请联网后刷新（在线功能依赖 CDN）');
    return;
  }
  const inp = document.getElementById('online-room');
  if (!inp.value) inp.value = 'dm-' + Date.now().toString(36).slice(-6);
  const nameInp = document.getElementById('online-name');
  if (nameInp && !nameInp.value) {
    try { nameInp.value = localStorage.getItem(LS_ONLINE_NAME_KEY) || ''; } catch (e) { /* ignore */ }
  }
  modal.style.display = 'block';
  setOnlineStatus(onlinePeer
    ? `已连接房间 ${onlineRoom}，${onlineConnections.length + 1} 人在线`
    : '创建房间或加入已有房间');
}

function closeOnlineModal() {
  const modal = document.getElementById('online-modal');
  if (modal) modal.style.display = 'none';
}

// cleanMetaRefs 已并入 share.js buildCombatPayload
function buildOnlineSnapshot() {
  return {
    type: 'snapshot',
    seq: ++onlineMseq,
    ts: Date.now(),
    data: buildCombatPayload()
  };
}

function sendTo(conn, payload) {
  if (!conn || !conn.open) return;
  try { conn.send(JSON.stringify(payload)); } catch (e) { /* ignore */ }
}

function broadcastSnapshot(excludeConn) {
  if (!onlineSync) return;
  const payload = buildOnlineSnapshot();
  for (const conn of onlineConnections) {
    if (conn === excludeConn) continue;
    sendTo(conn, payloadForRole(payload, conn._combatRole || 'player'));
  }
}

function onlineSendSnapshotTo(conn) {
  sendTo(conn, payloadForRole(buildOnlineSnapshot(), conn._combatRole || 'player'));
}

function scheduleOnlineSnapshot() {
  if (!onlineSync || onlineApplyRemote) return;
  clearTimeout(onlineTimer);
  onlineTimer = setTimeout(() => broadcastSnapshot(), 120);
}

// 包装 render：本地每次渲染后触发节流广播；远端应用期间不转播。
const __combatmapOriginalRender = render;
render = function () {
  __combatmapOriginalRender();
  scheduleOnlineSnapshot();
};

// 数据同步由 buildCombatPayload/applyCombatData 统一处理（已含 DM 层/战雾/行动顺序）
function applyRemoteSnapshot(msg) {
  if (!msg || msg.type !== 'snapshot' || !msg.data) return;
  // 新加入客户端收到主机首个快照后，才放开同步，避免空图盖掉全屋地图
  if (onlinePeer && onlineRoom && !onlineSync) onlineSync = true;
  onlineApplyRemote = true;
  try {
    const n = applyCombatData(msg.data);
    showToast(`🌐 已同步远端地图 ${n} 格 / ${tokens.length} 单位`);
  } catch (e) {
    console.error('远端同步失败', e);
    showToast('⚠️ 远端同步失败: ' + (e && e.message));
  }
  onlineApplyRemote = false;
  render();
}

function handleOnlineData(conn, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  if (!msg || !msg.type) return;
  if (msg.type === 'snapshot') {
    applyRemoteSnapshot(msg);
    // 主机收到客户端快照后应用，并转播给其他连接
    if (onlineRoom && onlineConnections.length > 0) broadcastSnapshot(conn);
  } else if (msg.type === 'hello') {
    // 新客户端请求首次快照；先按该连接声明的角色发送，并记录其昵称
    conn._combatRole = msg.role === 'dm' ? 'dm' : 'player';
    conn._combatName = (msg.name || '').slice(0, 16) || (conn._combatRole === 'dm' ? 'DM' : '玩家');
    onlineSendSnapshotTo(conn);
    setOnlineStatus(`🎭 ${conn._combatName} 已连接，当前在线 ${onlineConnections.length + 1}`);
    if (!onlineIsPlayer) broadcastRoster();
  } else if (msg.type === 'role') {
    conn._combatRole = msg.role === 'dm' ? 'dm' : 'player';
    conn._combatName = (msg.name || '').slice(0, 16) || (conn._combatRole === 'dm' ? 'DM' : '玩家');
    onlineSendSnapshotTo(conn);
    setOnlineStatus(`🎭 ${conn._combatName} 已连接，当前在线 ${onlineConnections.length + 1}`);
    if (!onlineIsPlayer) broadcastRoster();
  } else if (msg.type === 'roster') {
    // 玩家端接收主机广播的成员列表
    onlineRoster = msg.members || [];
    renderRoster();
  } else if (msg.type === 'ping') {
    sendTo(conn, { type: 'pong', ts: Date.now() });
  }
}

function onlineAddConn(conn) {
  if (onlineConnections.some(c => c === conn)) return;
  onlineConnections.push(conn);
  conn._combatRole = 'player'; // 默认玩家，先不给 DM 层；收到 hello/role 后更新
  conn._combatName = '';
  conn.on('data', (raw) => handleOnlineData(conn, raw));
  conn.on('close', () => {
    onlineConnections = onlineConnections.filter(c => c !== conn);
    setOnlineStatus(`↗️ 有成员离开，当前在线 ${onlineConnections.length + 1}`);
    if (!onlineIsPlayer) broadcastRoster();
  });
  setOnlineStatus(`🎉 新成员加入，当前在线 ${onlineConnections.length + 1}`);
  if (!onlineIsPlayer) broadcastRoster();
  render();
}

function onlineCreateRoom() {
  if (onlinePeer) { setOnlineStatus('⚠️ 已在房间中，请先离开'); return; }
  if (typeof Peer === 'undefined') { setOnlineStatus('⚠️ PeerJS 未加载'); return; }
  const roomId = sanitizeRoom(document.getElementById('online-room')?.value || '');
  if (!roomId) { setOnlineStatus('⚠️ 请输入房间名'); return; }
  onlineSetName();
  onlineRoster = [];
  onlineRoom = roomId;
  onlineSync = false;
  try {
    onlinePeer = new Peer(roomId, PEER_CONFIG);
  } catch (e) {
    setOnlineStatus('⚠️ 创建失败: ' + e.message);
    return;
  }
  onlinePeer.on('open', () => {
    onlineSync = true;
    onlineIsPlayer = false;
    viewRole = 'dm';
    applyOnlineRoleUI();
    broadcastRoster();
    setOnlineStatus('✅ 房间已创建：' + roomId + ' · 分享邀请链接给玩家');
    closeOnlineModal();
    showToast('🌐 房间已创建：' + roomId + '（DM ' + onlineUserName + '）');
  });
  onlinePeer.on('connection', (conn) => {
    conn.on('open', () => {
      onlineAddConn(conn);
      onlineSendSnapshotTo(conn);
      broadcastRoster();
    });
  });
  onlinePeer.on('error', (err) => {
    console.error(err);
    setOnlineStatus('⚠️ 创建失败: ' + ((err && err.type) || '房间名可能被占用'));
  });
}

function onlineJoinRoom(roomRaw) {
  if (onlinePeer) { setOnlineStatus('⚠️ 已在房间中，请先离开'); return; }
  const roomId = sanitizeRoom(roomRaw);
  if (!roomId) { setOnlineStatus('⚠️ 房间名不能为空'); return; }
  if (typeof Peer === 'undefined') { setOnlineStatus('⚠️ PeerJS 未加载'); return; }
  onlineSync = false;
  try {
    onlinePeer = new Peer(undefined, PEER_CONFIG);
  } catch (e) {
    setOnlineStatus('⚠️ 加入失败: ' + e.message);
    return;
  }
  const conn = onlinePeer.connect(roomId, { reliable: true });
  onlineConnections = [conn];

  conn.on('open', () => {
    onlineRoom = roomId;
    onlineIsPlayer = true;
    onlineSetName();
    onlineRoster = [];
    viewRole = 'player';
    applyOnlineRoleUI();
    // 先不发本地快照，等主机回传；声明自己为玩家，避免收到 DM 隐藏层
    setOnlineStatus('✅ 已加入 ' + roomId + '，正在接收主机地图…');
    closeOnlineModal();
    showToast('🌐 已加入房间 ' + roomId + '（玩家 ' + onlineUserName + '）');
    sendTo(conn, { type: 'hello', ts: Date.now(), role: 'player', name: onlineUserName });
  });
  conn.on('data', (raw) => handleOnlineData(conn, raw));
  conn.on('close', () => {
    onlineSync = false;
    setOnlineStatus('⚠️ 与主机连接断开');
  });
  onlinePeer.on('error', (err) => {
    console.error(err);
    setOnlineStatus('⚠️ 加入失败: ' + ((err && err.type) || err.message || '房间不存在'));
  });
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

function onlineLeave() {
  if (!onlinePeer) { setOnlineStatus('未连接'); return; }
  try { onlinePeer.destroy(); } catch (e) { /* ignore */ }
  onlinePeer = null;
  onlineRoom = '';
  onlineSync = false;
  onlineConnections = [];
  onlineIsPlayer = false;
  onlineRoster = [];
  viewRole = 'dm';
  applyOnlineRoleUI();
  setOnlineStatus('已离开房间');
  showToast('🚪 已离开在线房间');
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
function buildRosterPayload() {
  const members = [{ id: 'me', name: onlineUserName || (onlineIsPlayer ? '玩家' : 'DM'), role: onlineIsPlayer ? 'player' : 'dm' }];
  onlineConnections.forEach((c) => {
    members.push({ id: c.peer, name: c._combatName || (c._combatRole === 'dm' ? 'DM' : '玩家'), role: c._combatRole || 'player' });
  });
  return members;
}
function broadcastRoster() {
  if (!onlinePeer) return;
  const members = buildRosterPayload();
  onlineConnections.forEach((c) => sendTo(c, { type: 'roster', members }));
  if (!onlineIsPlayer) onlineRoster = members; // 主机本地视角
  renderRoster();
}
function rosterMembers() {
  if (!onlinePeer || !onlineRoom) return [];
  if (onlineIsPlayer) {
    // 玩家：用主机广播的成员列表，标记自己
    const selfId = onlinePeer && onlinePeer.id;
    return (onlineRoster || []).map((m) => ({ ...m, me: m.id === selfId }));
  }
  // 主机：本地产物
  return buildRosterPayload().map((m) => ({ ...m, me: m.id === 'me' }));
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