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
  // 玩家只接收「玩家可见地图」：剔除 DM 隐藏层/行动顺序，但**保留 fog**——
  // fog 是玩家看到「已揭示区域」的依据，删掉就会整图“无迷雾/看不见揭示”。
  const p = JSON.parse(JSON.stringify(payload || {}));
  delete p.dmData;
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

// —— 稳定玩家身份 ——
// 用于 token 归属（ownerId）：同一浏览器刷新后保持不变，刷新/重连不掉归属。
function onlinePlayerId() {
  let id = '';
  try { id = localStorage.getItem('combatmap_player_id') || ''; } catch (e) { /* ignore */ }
  if (!id || !/^[a-z0-9-]{1,32}$/.test(id)) {
    id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    try { localStorage.setItem('combatmap_player_id', id); } catch (e) { /* ignore */ }
  }
  return id;
}

// 当前是否处于「在线玩家」身份（真玩家；不含 DM 手动预览模式）
function inOnlinePlayerMode() {
  return onlineIsPlayer && !!onlineWS;
}

// 在线玩家允许使用的工具（枭熊式宽松：动自己 token + 画标记；地形/墙/门/战雾/DM层禁用）
const PLAYER_TOOLS = new Set(['select', 'pan', 'measure', 'brush', 'unit']);

// 玩家绘制层显隐（GM 可关）——渲染时据此过滤带 author 的 shapes/lines
let showPlayerDrawLayer = true;
function togglePlayerDrawLayer(v) { showPlayerDrawLayer = v ? true : false; render(); }

// 该 token 是否可被当前用户编辑：DM 全权；玩家只能编辑自己（ownerId=自己）的
function canEditToken(t) {
  if (!inOnlinePlayerMode()) return true;
  return !!t && !!t.ownerId && t.ownerId === onlineSelfId;
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

function buildOnlineSync() {
  return { type: 'sync', data: buildCombatPayload() };
}

function onlineSend(payload) {
  if (!onlineWS || onlineWS.readyState !== WebSocket.OPEN) return;
  try { onlineWS.send(JSON.stringify(payload)); } catch (e) { /* ignore */ }
}

// —— 服务器权威内容发布（DM 端）——
// 地形/迷雾/DM层/底图/行动顺序等「内容」变更 → 标记 syncDirty，节流发布一次 sync（全量权威）。
// 实时 token/绘制走增量（见 onlineSendTokenXxx），不在此列。
let onlineSyncDirty = false;
function onlineMarkSync() { onlineSyncDirty = true; }
function onlinePublishSync() {
  if (!onlineWS || !onlineSync || onlineIsPlayer) return;
  onlineSyncDirty = false;
  onlineSend(buildOnlineSync());
}
function scheduleOnlinePublish() {
  if (!onlineWS || !onlineSync || onlineIsPlayer || !onlineSyncDirty) return;
  clearTimeout(onlineTimer);
  onlineTimer = setTimeout(() => { if (onlineSyncDirty) { onlineSyncDirty = false; onlinePublishSync(); } }, 300);
}

// 包装 render：DM 端仅当「内容确实变更」才发布权威 sync，摄像头/选中变化不触发。
const __combatmapOriginalRender = render;
render = function () {
  __combatmapOriginalRender();
  scheduleOnlinePublish();
};

function applyRemoteState(msg) {
  if (!msg || (msg.type !== 'model' && msg.type !== 'snapshot') || !msg.data) return;
  if (!onlineSync) onlineSync = true;
  onlineApplyRemote = true;
  const d = msg.data || {};
  // token 库是每用户本地的（不是地图数据），不随整图同步覆盖
  delete d.tokenPresets;
  // 保护「自己画的标记 / 自己拥有的单位」：陈旧同步可能还没带上它们，先记再回填
  const mineShapes = shapes.filter(s => s.author === onlineSelfId);
  const mineLines = freeLines.filter(l => l.author === onlineSelfId);
  const mineTokens = tokens.filter(t => t.ownerId === onlineSelfId);
  // 保留本地选中/撤销，避免整图同步反复清空（让玩家觉得“一直在重置”）
  const sel = { selectedToken, selectedShape, selectedLine, selectedCell, selectedTokens: new Set(selectedTokens), selectedBackground };
  const undo = undoStack.slice(), redo = redoStack.slice();
  try {
    const data = payloadForRole(d, onlineIsPlayer ? 'player' : 'dm');
    // 保持本地视角：不让远端同步重置摄像机
    data.viewX = viewX; data.viewY = viewY; data.zoom = zoom;
    const n = applyCombatData(data);
    // 回填自己画的/自己拥有的项（若被陈旧同步抹掉）
    if (inOnlinePlayerMode()) {
      for (const s of mineShapes) if (!shapes.some(x => x.id === s.id)) shapes.push(s);
      for (const l of mineLines) if (!freeLines.some(x => x.id === l.id)) freeLines.push(l);
      for (const t of mineTokens) if (!tokens.some(x => x.id === t.id)) tokens.push(t);
    }
    // 恢复本地选中/撤销
    selectedToken = sel.selectedToken; selectedShape = sel.selectedShape; selectedLine = sel.selectedLine;
    selectedCell = sel.selectedCell; selectedTokens = sel.selectedTokens; selectedBackground = sel.selectedBackground;
    undoStack = undo; redoStack = redo; if (typeof updateUndoButtons === 'function') updateUndoButtons();
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
    // 记忆当前房间与身份，刷新后自动回房
    try { localStorage.setItem('combatmap_room', onlineRoom); localStorage.setItem('combatmap_room_role', onlineIsPlayer ? 'player' : 'dm'); } catch (e) { /* ignore */ }
    // DM 就绪即发布一次权威全量（让服务器持有并广播给成员）
    if (!onlineIsPlayer) setTimeout(() => onlinePublishSync(), 300);
  } else if (msg.type === 'model' || msg.type === 'snapshot') {
    applyRemoteState(msg);
  } else if (msg.type === 'roster') {
    onlineRoster = msg.members || [];
    renderRoster();
  } else if (msg.type === 'settings') {
    applySettings(msg);
  } else if (msg.type === 'pong') {
    onlineLastPong = Date.now();
  } else if (msg.type === 'tokenEdit') {
    applyTokenEdit(msg);
  } else if (msg.type === 'tokenPlace') {
    applyTokenPlace(msg);
  } else if (msg.type === 'tokenDelete') {
    applyTokenDelete(msg);
  } else if (msg.type === 'shapeDraw') {
    applyShapeDraw(msg);
  } else if (msg.type === 'shapeEdit') {
    applyShapeEdit(msg);
  } else if (msg.type === 'shapeDelete') {
    applyShapeDelete(msg);
  } else if (msg.type === 'lineDraw') {
    applyLineDraw(msg);
  } else if (msg.type === 'lineEdit') {
    applyLineEdit(msg);
  } else if (msg.type === 'lineDelete') {
    applyLineDelete(msg);
  } else if (msg.type === 'fogEdit') {
    applyFogEdit(msg);
  } else if (msg.type === 'error') {
    setOnlineStatus('⚠️ ' + (msg.error || '房间错误'));
  }
}

// —— 玩家编辑增量：只同步「自己 token」的字段，避免覆盖 DM 隐藏层 ——
const TOKEN_EDITABLE = new Set(['x','y','w','h','rotation','name','kind','icon','color','hp','maxHp','tempHp','ac','speed','notes','status','imgData','img','layer','sightRadius','visionSource','visible']);
function applyTokenEdit(msg) {
  if (!msg || msg.id == null || !msg.patch) return;
  const t = tokens.find((x) => x.id === msg.id);
  if (!t) return;
  // 服务器已验证（玩家只能改自己的 token）；客户端直接应用增量
  let touched = false;
  for (const k in msg.patch) {
    if (!TOKEN_EDITABLE.has(k)) continue;
    t[k] = msg.patch[k];
    touched = true;
  }
  if (touched) { render(); updateInfo(); }
}
function applyTokenPlace(msg) {
  if (!msg || !msg.token || msg.token.id == null) return;
  if (tokens.some((x) => x.id === msg.token.id)) return;
  const t = msg.token;
  if (typeof normalizeToken === 'function') normalizeToken(t);
  t.ownerId = msg.owner || t.ownerId || '';
  tokens.push(t);
  render(); updateInfo();
}
// 发送「改名/移动/属性」增量：在线即发；玩家需权限且只能改自己的（服务器还会再校验）
function onlineSendTokenEdit(id, patch) {
  if (!onlineWS || !onlineSync) return;
  const t = tokens.find(x => x.id === id);
  if (!t) return;
  if (inOnlinePlayerMode() && (!onlinePerm.canEdit || !canEditToken(t))) return;
  onlineSend({ type: 'tokenEdit', id, owner: t.ownerId, patch });
}
function onlineSendTokenPlace(token) {
  if (!onlineWS || !onlineSync) return;
  if (inOnlinePlayerMode() && !onlinePerm.canPlace) return;
  onlineSend({ type: 'tokenPlace', owner: (inOnlinePlayerMode() ? onlineSelfId : (token.ownerId || '')), token });
}
function onlineSendTokenDelete(id, owner) {
  if (!onlineWS || !onlineSync) return;
  const t = tokens.find(x => x.id === id);
  const ow = owner != null ? owner : (t ? t.ownerId : '');
  if (inOnlinePlayerMode()) {
    if (!onlinePerm.canDelete) return;
    if (!canEditToken({ id, ownerId: ow })) return;
  }
  onlineSend({ type: 'tokenDelete', id, owner: ow });
}

// —— 房间权限（DM 下发，默认全开=枭熊式宽松）——
// 玩家可按 GM 开关做的事：移动/放置/编辑/删除自己 token、绘制/擦除。
let onlinePerm = { canMove: true, canPlace: true, canEdit: true, canDelete: true, canDraw: true, canErase: true };

// —— 玩家绘制：shapes/freeLines 带 author 标记，记录是谁画的 ——
const SHAPE_EDITABLE = new Set(['x','y','w','h','length','spread','angle','fill','fillAlpha','stroke','strokeWidth','dash','name','layer']);
const LINE_EDITABLE = new Set(['x1','y1','x2','y2','color','width','dash','name','layer']);
function canEditShape(s) { if (!inOnlinePlayerMode()) return true; return !!s && !!s.author && s.author === onlineSelfId; }
function canEditLine(l) { if (!inOnlinePlayerMode()) return true; return !!l && !!l.author && l.author === onlineSelfId; }

function applyTokenDelete(msg) {
  if (!msg || msg.id == null) return;
  const t = tokens.find((x) => x.id === msg.id);
  if (!t) return;
  if (typeof clearInitiativeTokenRefs === 'function') clearInitiativeTokenRefs(t.id);
  tokens = tokens.filter((x) => x.id !== t.id);
  if (selectedToken === t.id) selectedToken = null;
  selectedTokens.delete(t.id);
  if (typeof pruneGroups === 'function') pruneGroups();
  render(); updateInfo();
}
function applyShapeDraw(msg) {
  if (!msg || !msg.shape || msg.shape.id == null) return;
  if (shapes.some((s) => s.id === msg.shape.id)) return;
  const s = msg.shape;
  s.author = msg.author || s.author || '';
  shapes.push(s);
  render(); updateInfo();
}
function applyShapeEdit(msg) {
  if (!msg || msg.id == null || !msg.patch) return;
  const s = shapes.find((x) => x.id === msg.id);
  if (!s) return;
  for (const k in msg.patch) { if (SHAPE_EDITABLE.has(k)) s[k] = msg.patch[k]; }
  render(); updateInfo();
}
function applyShapeDelete(msg) {
  if (!msg || msg.id == null) return;
  const s = shapes.find((x) => x.id === msg.id);
  if (!s) return;
  shapes = shapes.filter((x) => x.id !== s.id);
  if (selectedShape === s.id) selectedShape = null;
  render(); updateInfo();
}
function applyLineDraw(msg) {
  if (!msg || !msg.line || msg.line.id == null) return;
  if (freeLines.some((l) => l.id === msg.line.id)) return;
  const l = msg.line;
  l.author = msg.author || l.author || '';
  freeLines.push(l);
  render(); updateInfo();
}
function applyLineEdit(msg) {
  if (!msg || msg.id == null || !msg.patch) return;
  const l = freeLines.find((x) => x.id === msg.id);
  if (!l) return;
  for (const k in msg.patch) { if (LINE_EDITABLE.has(k)) l[k] = msg.patch[k]; }
  render(); updateInfo();
}
function applyLineDelete(msg) {
  if (!msg || msg.id == null) return;
  const l = freeLines.find((x) => x.id === msg.id);
  if (!l) return;
  freeLines = freeLines.filter((x) => x.id !== l.id);
  if (selectedLine === l.id) selectedLine = null;
  render(); updateInfo();
}
function applySettings(msg) {
  if (!msg || !msg.perms) return;
  onlinePerm = Object.assign({ canMove: true, canPlace: true, canEdit: true, canDelete: true, canDraw: true, canErase: true }, msg.perms);
}

// —— 迷雾批量增量（仅 DM；拖拽/点涂时累积，防逐格刷屏）——
let onlineFogPending = {};
let onlineFogTimer = null;
function onlineQueueFog(q, r, hidden) {
  if (!onlineWS || !onlineSync || onlineIsPlayer) return;
  onlineFogPending[cellKey(q, r)] = hidden ? 1 : 0;
  clearTimeout(onlineFogTimer);
  onlineFogTimer = setTimeout(() => {
    const cells = onlineFogPending; onlineFogPending = {};
    onlineSend({ type: 'fogEdit', cells });
  }, 150);
}
function applyFogEdit(msg) {
  if (!msg || !msg.cells) return;
  for (const k in msg.cells) { if (msg.cells[k]) fog[k] = 1; else delete fog[k]; }
  if (Object.keys(fog).length === 0) fog = {};
  render(); updateInfo();
}

// —— 发送绘制/删除增量：在线即发；玩家需权限且只能动自己画的（服务器再校验）——
function onlineSendShapeDraw(shape) {
  if (!onlineWS || !onlineSync) return;
  if (inOnlinePlayerMode() && !onlinePerm.canDraw) return;
  onlineSend({ type: 'shapeDraw', author: shape.author || onlineSelfId, shape });
}
function onlineSendShapeEdit(id, patch) {
  if (!onlineWS || !onlineSync) return;
  const s = shapes.find((x) => x.id === id);
  if (!s) return;
  if (inOnlinePlayerMode() && (!onlinePerm.canEdit || !canEditShape(s))) return;
  onlineSend({ type: 'shapeEdit', id, author: s.author, patch });
}
function onlineSendShapeDelete(id) {
  if (!onlineWS || !onlineSync) return;
  const s = shapes.find((x) => x.id === id);
  if (!s) return;
  if (inOnlinePlayerMode() && (!onlinePerm.canErase || !canEditShape(s))) return;
  onlineSend({ type: 'shapeDelete', id, author: s.author });
}
function onlineSendLineDraw(line) {
  if (!onlineWS || !onlineSync) return;
  if (inOnlinePlayerMode() && !onlinePerm.canDraw) return;
  onlineSend({ type: 'lineDraw', author: line.author || onlineSelfId, line });
}
function onlineSendLineEdit(id, patch) {
  if (!onlineWS || !onlineSync) return;
  const l = freeLines.find((x) => x.id === id);
  if (!l) return;
  if (inOnlinePlayerMode() && (!onlinePerm.canEdit || !canEditLine(l))) return;
  onlineSend({ type: 'lineEdit', id, author: l.author, patch });
}
function onlineSendLineDelete(id) {
  if (!onlineWS || !onlineSync) return;
  const l = freeLines.find((x) => x.id === id);
  if (!l) return;
  if (inOnlinePlayerMode() && (!onlinePerm.canErase || !canEditLine(l))) return;
  onlineSend({ type: 'lineDelete', id, author: l.author });
}
function onlineSendSettings(perms) {
  if (!onlineWS || !onlineSync || inOnlinePlayerMode()) return; // 仅 DM 下发
  onlineSend({ type: 'settings', perms });
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
    onlineSend({ type: 'join', room, role, name: onlineUserName, id: onlinePlayerId() });
    onlineStartHeartbeat();
    setOnlineStatus('✅ 已进入房间 ' + room + '，等待成员…');
    // 主机（DM）就绪即广播一份权威快照，让在座/新加入者立刻有图 + 下发房间权限
    if (!onlineIsPlayer) {
      onlineSync = true;
      setTimeout(() => broadcastSnapshot(), 300);
      setTimeout(() => onlineSendSettings(onlinePerm), 350);
    }
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
  try { localStorage.removeItem('combatmap_room'); localStorage.removeItem('combatmap_room_role'); } catch (e) { /* ignore */ }
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
  // 不再「点弹窗外部即退出」——创建/加入房间时误点容易打断，只允许用按钮关闭。

  // 自动加入：优先 ?room= 链接，否则用上次记忆的房间（刷新后自动回房）
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  let autoRoom = '', autoRole = '';
  if (room && params.get('online') === '1') {
    autoRoom = room; autoRole = 'player';
  } else {
    try {
      autoRoom = localStorage.getItem('combatmap_room') || '';
      autoRole = localStorage.getItem('combatmap_room_role') || 'player';
    } catch (e) { /* ignore */ }
  }
  if (autoRoom) {
    setTimeout(() => {
      const inp = document.getElementById('online-room');
      if (inp) inp.value = autoRoom;
      if (autoRole === 'dm') onlineCreateRoom(); else onlineJoinRoom(autoRoom);
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
