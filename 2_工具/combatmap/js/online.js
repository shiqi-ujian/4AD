// ============================================================
//  Online — PeerJS P2P 实时同步（星型：主机=房主，客户端直连主机）
//  依赖: state.js/core.js/render.js/share.js
//  用法: 工具栏「🌐 在线」创建房间/加入房间；任一本地改动经过
//  render() 自动节流广播完整快照。主机收到客户端快照后应用并转播。
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

function setOnlineStatus(msg) {
  const el = document.getElementById('online-status');
  if (el) el.textContent = msg || '';
  const st = document.getElementById('btn-online-status');
  if (st) {
    st.textContent = onlinePeer ? (onlineSync ? '在线' : '连接中…') : '未连接';
    st.disabled = !onlinePeer;
    st.style.opacity = onlinePeer ? '1' : '0.4';
    st.style.background = onlineSync ? '#2d6a2e' : '#3a3a5e';
    st.style.color = onlinePeer ? '#fff' : '#aaa';
  }
}

function sanitizeRoom(s) {
  s = (s || '').trim().toLowerCase();
  s = s.replace(/[^a-z0-9-]/g, '');
  return s.slice(0, 48);
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
  modal.style.display = 'block';
  setOnlineStatus(onlinePeer
    ? `已连接房间 ${onlineRoom}，${onlineConnections.length + 1} 人在线`
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

function sendTo(conn, payload) {
  if (!conn || !conn.open) return;
  try { conn.send(JSON.stringify(payload)); } catch (e) { /* ignore */ }
}

function broadcastSnapshot(excludeConn) {
  if (!onlineSync) return;
  const payload = buildOnlineSnapshot();
  for (const conn of onlineConnections) {
    if (conn === excludeConn) continue;
    sendTo(conn, payload);
  }
}

function onlineSendSnapshotTo(conn) {
  sendTo(conn, buildOnlineSnapshot());
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
    // 新客户端请求首次快照
    sendTo(conn, buildOnlineSnapshot());
  } else if (msg.type === 'ping') {
    sendTo(conn, { type: 'pong', ts: Date.now() });
  }
}

function onlineAddConn(conn) {
  if (onlineConnections.some(c => c === conn)) return;
  onlineConnections.push(conn);
  conn.on('data', (raw) => handleOnlineData(conn, raw));
  conn.on('close', () => {
    onlineConnections = onlineConnections.filter(c => c !== conn);
    setOnlineStatus(`↗️ 有成员离开，当前在线 ${onlineConnections.length + 1}`);
  });
  onlineSendSnapshotTo(conn);
  setOnlineStatus(`🎉 新成员加入，当前在线 ${onlineConnections.length + 1}`);
  render();
}

function onlineCreateRoom() {
  if (onlinePeer) { setOnlineStatus('⚠️ 已在房间中，请先离开'); return; }
  if (typeof Peer === 'undefined') { setOnlineStatus('⚠️ PeerJS 未加载'); return; }
  const roomId = sanitizeRoom(document.getElementById('online-room')?.value || '');
  if (!roomId) { setOnlineStatus('⚠️ 请输入房间名'); return; }
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
    setOnlineStatus('✅ 房间已创建：' + roomId + ' · 分享邀请链接给玩家');
    closeOnlineModal();
    showToast('🌐 房间已创建：' + roomId);
  });
  onlinePeer.on('connection', (conn) => {
    conn.on('open', () => onlineAddConn(conn));
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
    // 先不发本地快照，等主机回传
    setOnlineStatus('✅ 已加入 ' + roomId + '，正在接收主机地图…');
    closeOnlineModal();
    showToast('🌐 已加入房间 ' + roomId);
    sendTo(conn, { type: 'hello', ts: Date.now() });
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

  // 从 ?room= 自动加入
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