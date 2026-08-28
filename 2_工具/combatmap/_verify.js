// combatmap feature verification via CDP real-interaction driving
// Usage: node _verify.js
const { launch, CDP, sleep, ART } = require('./_cdp');
const path = require('path');

let c; // CDP session
let results = [];

function record(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  | ' + extra : ''}`);
}

async function evalJSON(expr) { return await c.eval(expr); }

// Recompute viewport-relative page coords of grid cell (q,r) center
async function cellInfo() {
  return await c.eval(`(() => {
    const cv = document.querySelector('canvas');
    const rect = cv.getBoundingClientRect();
    const sx = rect.width / cv.width, sy = rect.height / cv.height;
    return { left: rect.left, top: rect.top, sx, sy, viewX, viewY, zoom };
  })()`);
}
async function cellPage(q, r) {
  const I = await cellInfo();
  const CELL = 48;
  // NOTE: cells are CENTERED on (q*48, r*48) and pixelToCell rounds to nearest center,
  // so the clickable center of grid cell (q,r) is exactly (q*48, r*48).
  const wx = q * CELL, wy = r * CELL;
  return {
    x: I.left + (I.viewX + wx * I.zoom) * I.sx,
    y: I.top + (I.viewY + wy * I.zoom) * I.sy
  };
}
async function clickCell(q, r) {
  const p = await cellPage(q, r);
  await c.click(Math.round(p.x), Math.round(p.y));
}
// drag across cells (for painting / fog)
async function dragCells(q1, r1, q2, r2) {
  const a = await cellPage(q1, r1), b = await cellPage(q2, r2);
  await c.drag(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y));
}
async function shot(name) { return await c.shot(name); }

// Read-only state snapshots
const readState = () => evalJSON(`({
  cellCount: Object.keys(combatData).length,
  tokenCount: tokens.length,
  fogCount: Object.keys(fog).length,
  dmCount: Object.keys(dmData).length,
  initCount: initiativeOrder.length,
  shapeCount: shapes.length,
  lineCount: freeLines.length,
  selectedTool
})`);

function clickSel(sel) {
  return c.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el){throw new Error('missing '+${JSON.stringify(sel)});} el.click(); return true; })()`);
}

async function waitReady() {
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    try {
      const ok = await c.eval(`typeof render==='function' && typeof clearSelection==='function' && typeof setTool==='function'`);
      if (ok) return true;
    } catch (e) {}
  }
  return false;
}

function reset() {
  return c.eval(`(() => {
    combatData = {}; tokens = []; fog = {}; dmData = {};
    initiativeOrder = []; initiativeIndex = 0; shapes = []; freeLines = [];
    customUnitStatuses = [];
    clearSelection(); groups = [];
    backgroundMap = null; selectedBackground = false;
    layerVisibility.background = true; layerVisibility.terrain = true; layerVisibility.painting = true; layerVisibility.line = true;
    layerVisibility.mount = true; layerVisibility.creature = true; layerVisibility.item = true;
    layerLocks.background = true; layerLocks.terrain = false; layerLocks.painting = false; layerLocks.line = false;
    layerLocks.mount = false; layerLocks.creature = false; layerLocks.item = false;
    brush.shape = 'rect';
    _measure = null; _rectPreview = null; _linePreview = null; _conePreview = null;
    _marquee = null; _marqueeStart = null; _tokenPending = null; _unitPending = null;
    // close any open modal overlay so it cannot intercept canvas clicks
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    const om = document.getElementById('online-modal');
    if (om) om.style.display = 'none';
    render(); updateInfo(); updateEmptyState();
    return true;
  })()`);
}
async function dismissEmpty() {
  await c.eval(`(() => { const b=document.getElementById('empty-dismiss'); if(b) b.click(); return true; })()`);
}

// ---------------- tests ----------------
async function t_paint() {
  await reset();
  await clickSel('.tool-btn[data-tool="paint"]');
  await clickSel('.tool-btn[data-terrain="wall_cell"]');
  await dismissEmpty();
  await clickCell(2, 2);
  await clickCell(3, 2);
  await sleep(200);
  const st = await readState();
  const cell = await evalJSON(`combatData['2,2'] || null`);
  const tool = await evalJSON(`selectedTool`);
  await shot('verify-paint.png');
  const ok = st.cellCount >= 2 && cell && cell.terrain === 'wall_cell' && tool === 'paint';
  record('地形绘制(笔刷→墙壁,点击2格)', ok, `cells=${st.cellCount} cell(2,2)=${JSON.stringify(cell)} tool=${tool}`);
}

async function t_paintDrag() {
  await reset();
  await clickSel('.tool-btn[data-tool="paint"]');
  await clickSel('.tool-btn[data-terrain="water"]');
  await dismissEmpty();
  await dragCells(1, 4, 4, 4);
  await sleep(150);
  const st = await readState();
  const row = await evalJSON("['1,4','2,4','3,4','4,4'].map(k=>combatData[k]&&combatData[k].terrain)");
  await shot('verify-paint-drag.png');
  record('地形绘制(拖拽连涂水域)', row.every(t => t === 'water'), `row=${JSON.stringify(row)}`);
}

async function t_token() {
  await reset();
  await dismissEmpty();
  await c.eval('openTokenLibrarySection(); true');       // open unit library preset mode
  await sleep(120);
  await clickSel('#token-library-list .tlib-card');      // pick up first preset (战士)
  await sleep(80);
  const pending = await evalJSON(`(_unitPending && _unitPending.name) || '(no pending)'`);
  await clickCell(5, 5);
  await sleep(150);
  const st = await readState();
  const tk = await evalJSON("tokens[0] ? {name:tokens[0].name,kind:tokens[0].kind,hp:tokens[0].hp,x:tokens[0].x,y:tokens[0].y} : null");
  await shot('verify-token.png');
  record('单位 token(拿起预设→放置)', st.tokenCount === 1 && !!tk && tk.name === '战士' && tk.kind === 'player', `pending=${pending} token=${JSON.stringify(tk)}`);
}

async function t_tokenMulti() {
  // place 2 tokens, then select tool and multi-select them via clicking cells? Simpler: place 2, verify.
  await reset();
  await dismissEmpty();
  await c.eval('openTokenLibrarySection(); true');
  await sleep(100);
  await clickSel('#token-library-list .tlib-card');
  await sleep(60);
  await clickCell(6, 5);
  await sleep(60);
  // pick second preset (法师)
  await c.eval('openTokenLibrarySection(); true');
  await sleep(60);
  await c.eval(`(()=>{const cards=document.querySelectorAll('#token-library-list .tlib-card'); if(cards[1])cards[1].click(); return true;})()`);
  await sleep(60);
  await clickCell(7, 6);
  await sleep(150);
  const st = await readState();
  const names = await evalJSON("tokens.map(t=>t.name)");
  await shot('verify-token-multi.png');
  record('单位 token(放置2个不同预设)', st.tokenCount === 2, `names=${JSON.stringify(names)}`);
}

async function t_fog() {
  await reset();
  await dismissEmpty();
  await clickSel('.tool-btn[data-tool="fog"]');
  await sleep(80);
  const fogChk = await evalJSON("document.getElementById('chk-fog').checked");
  await dragCells(0, 0, 5, 5);
  await sleep(200);
  const st = await readState();
  await shot('verify-fog.png');
  record('战雾(拖拽遮住 + 面板已勾选)', st.fogCount > 0 && fogChk === true, `fogCells=${st.fogCount} showFog=${fogChk}`);
}

async function t_dm() {
  await reset();
  await dismissEmpty();
  await clickSel('.tool-btn[data-tool="dm"]');
  await sleep(60);
  await clickCell(3, 3);
  await sleep(200);
  const modalOpen = await evalJSON(`document.getElementById('dm-modal').style.display === 'block'`);
  await c.eval(`document.getElementById('dm-modal-mark').value='🔑'; true`);
  await clickSel('#dm-modal-confirm'); await sleep(150);
  const st = await readState();
  const dm = await evalJSON(`dmData['3,3'] || null`);
  await shot('verify-dm.png');
  record('DM 层(点格子→弹窗→填标记→保存)', modalOpen && st.dmCount === 1 && !!dm && dm.mark === '🔑', `modalOpen=${modalOpen} dm(3,3)=${JSON.stringify(dm)}`);
}

async function t_initiative() {
  await reset();
  await dismissEmpty();
  // place 2 tokens via real clicks
  await c.eval('openTokenLibrarySection(); true'); await sleep(80);
  await clickSel('#token-library-list .tlib-card'); await sleep(50); await clickCell(4, 4);
  await sleep(60);
  await c.eval('openTokenLibrarySection(); true'); await sleep(50);
  await c.eval(`(()=>{const cards=document.querySelectorAll('#token-library-list .tlib-card'); if(cards[1])cards[1].click(); return true;})()`); await sleep(50);
  await clickCell(5, 4); await sleep(100);
  // import all into initiative via the app function the UI uses
  const tkAfter = await evalJSON(`tokens.map(t=>({n:t.name,x:t.x,y:t.y}))`);
  await evalJSON(`addAllTokensToInitiative(); true`);
  await sleep(60);
  const st = await readState();
  const init = await evalJSON(`initiativeOrder.map(e=>e.name)`);
  // open initiative modal and screenshot
  await clickSel('#btn-initiative'); await sleep(250);
  await shot('verify-init.png');
  record('行动顺序(放置2单位→导入先攻条)', st.tokenCount === 2 && st.initCount === 2, `tokens=${JSON.stringify(tkAfter)} init=${JSON.stringify(init)}`);
}

async function t_template() {
  await reset();
  await dismissEmpty();
  // select an anchor cell (in select mode) so the room anchors there
  await clickCell(4, 4);
  await sleep(80);
  await clickSel('#btn-template-room'); await sleep(120);
  await clickSel('#room-confirm'); await sleep(250);
  const st = await readState();
  const hasFloor = await evalJSON("Object.values(combatData).some(d=>d.terrain==='floor')");
  const hasEdgeWall = await evalJSON("Object.values(combatData).some(d=>d.walls && d.walls.some(w=>w))");
  await shot('verify-template.png');
  record('模板生成(一键房间)', st.cellCount > 10 && hasFloor && hasEdgeWall, `cells=${st.cellCount} floor=${hasFloor} edgeWall=${hasEdgeWall}`);
}

async function t_undo() {
  await reset();
  await clickSel('.tool-btn[data-tool="paint"]');
  await clickSel('.tool-btn[data-terrain="hazard_fire"]');
  await dismissEmpty();
  await clickCell(2, 3); await sleep(80);
  const before = (await readState()).cellCount;
  await clickSel('#btn-undo'); await sleep(120);
  const after = (await readState()).cellCount;
  record('撤销/重做(涂1格→撤销)', before === 1 && after === 0, `before=${before} after=${after}`);
}

async function t_export_data() {
  // Verify payload + share link generation
  await reset();
  await dismissEmpty();
  await clickSel('.tool-btn[data-tool="paint"]');
  await clickSel('.tool-btn[data-terrain="wall_cell"]');
  await clickCell(2, 2); await sleep(80);
  const payload = await evalJSON(`(() => {
    const p = buildCombatPayload();
    return { hasTerrain: !!p.combatData && Object.keys(p.combatData).length > 0, keys: Object.keys(p) };
  })()`);
  const share = await evalJSON(`(async () => { try {
      const code = await combatEncodeString();
      const link = combatShareLinkFor(code);
      return { len: code.length, linkOk: link === (location.origin + location.pathname + '?m=1#m=' + encodeURIComponent(code)) };
    } catch(e) { return { err: e.message }; } })()`);
  const png = await evalJSON(`(() => { try {
      const r = renderMapCanvas();
      return r ? { w: r.canvas.width, h: r.canvas.height, prefix: r.canvas.toDataURL('image/png').slice(0, 22) } : null;
    } catch(e) { return { err: e.message }; } })()`);
  await shot('verify-export.png');
  record('数据打包/分享/PNG导出', payload.hasTerrain === true && share.len > 0 && png && png.prefix.startsWith('data:image/png'), `share=${JSON.stringify(share)} png=${JSON.stringify(png)}`);
}

async function t_online() {
  await reset();
  await dismissEmpty();
  await clickSel('#btn-online'); await sleep(250);
  const onlineOpen = await evalJSON(`(()=>{const m=document.getElementById('online-modal'); return m? (m.style.display==='block'||getComputedStyle(m).display!=='none') : false;})()`);
  await shot('verify-online.png');
  record('在线房间(打开在线模态框)', onlineOpen === true, `open=${onlineOpen}`);
}

async function t_wall() {
  await reset();
  await dismissEmpty();
  await clickSel('.tool-btn[data-tool="wall"]');
  await sleep(80);
  const toolAfter = await evalJSON(`selectedTool`);
  const a = await cellPage(4, 4), b = await cellPage(5, 4);
  const ex = Math.round((a.x + b.x) / 2), ey = Math.round(a.y);
  // DEBUG: what does the app compute for these mx,my?
  const debug = await c.eval(`(() => {
    const rect = canvas.getBoundingClientRect();
    const mx = ${ex} - rect.left, my = ${ey} - rect.top;
    const edge = getEdgeAtPixel(mx, my);
    return { mx, my, edge };
  })()`);
  await c.click(ex, ey); await sleep(150);
  const hint = await evalJSON(`document.getElementById('tool-hint').textContent`);
  const walls = await evalJSON("(()=>{let n=0,edge=null;for(const k in combatData){const d=combatData[k];if(d.walls&&d.walls.some(w=>w)){n++;const q=+k.split(',')[0],r=+k.split(',')[1];edge={q,r,walls:d.walls};}}return {count:n,edge};})()");
  await shot('verify-wall.png');
  record('墙壁(点击格子边放置)', toolAfter === 'wall' && walls.count > 0, `tool=${toolAfter} debug=${JSON.stringify(debug)} hint="${hint}" walls=${JSON.stringify(walls)}`);
}

// ---------------- P0/P1 feature walkthrough ----------------
async function t_vision() {
  await reset();
  await c.eval(`(()=>{
    combatData={};
    for(let r=0;r<=10;r++) for(let q=0;q<=10;q++){
      const terr=(q===6)?'wall_cell':'floor';
      combatData[q+','+r]={terrain:terr,label:'',walls:[0,0,0,0]};
    }
    tokens=[{id:'tkV',kind:'player',name:'战士',x:2,y:5,w:1,h:1,icon:'⚔️',color:'#3a7abd',hp:10,maxHp:10,sightRadius:6,visionSource:true}];
    fog={}; viewRole='dm'; visionMode='auto'; viewSourceTokenId=null; showFogLayer=true;
    render(); updateEmptyState(); const b=document.getElementById('empty-dismiss'); if(b)b.click(); return true;
  })()`); await sleep(100);
  const v = await c.eval(`(()=>{const s=computeVisibleCells();return {own:s.has('2,5'),near:s.has('1,5'),behindWall:s.has('8,5'),wallCell:s.has('6,5'),match:true};})()`);
  record('P0 视野(LOS+墙遮挡)', v.own && v.near && !v.behindWall && v.wallCell, JSON.stringify(v));
}

async function t_basemap() {
  await reset();
  await c.eval(`(()=>{
    const cv=document.createElement('canvas'); cv.width=400; cv.height=400; const g=cv.getContext('2d');
    g.fillStyle='#ddd'; g.fillRect(0,0,400,400); g.strokeStyle='#333'; g.lineWidth=3;
    for(let k=0;k<=4;k++){g.beginPath();g.moveTo(k*100,0);g.lineTo(k*100,400);g.stroke();g.beginPath();g.moveTo(0,k*100);g.lineTo(400,k*100);g.stroke();}
    const img=new Image(); img.src=cv.toDataURL('image/png');
    backgroundMap={id:'bgt',imgData:cv.toDataURL('image/png'),img,x:0,y:0,cols:8,rows:8,opacity:0.85};
    render(); updateEmptyState(); if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(80);
  const aligned = await c.eval(`(()=>{
    startBgAlign(); const CELL=48, wfx=(P)=>(P/400)*8*CELL;
    _bgAlignRefs.snap={x:0,y:0,cols:8,rows:8};
    _bgAlignRefs.pts=[
      {world:{x:wfx(100),y:wfx(100)},snappedGrid:{q:2,r:2},originX:0,originY:0},
      {world:{x:wfx(300),y:wfx(100)},snappedGrid:{q:6,r:2},originX:0,originY:0},
      {world:{x:wfx(100),y:wfx(300)},snappedGrid:{q:2,r:6},originX:0,originY:0}
    ];
    document.getElementById('bg-align-cells').value=2;
    finishBgAlign();
    return {cols:backgroundMap.cols,rows:backgroundMap.rows,x:backgroundMap.x,y:backgroundMap.y};
  })()`);
  const ok = Math.abs(aligned.cols-4)<0.01 && Math.abs(aligned.rows-4)<0.01 && Math.abs(aligned.x-1.5)<0.01 && Math.abs(aligned.y-1.5)<0.01;
  record('P1 底图导入+网格对齐', ok, JSON.stringify(aligned));
}

async function t_measure() {
  await reset();
  await c.eval(`(()=>{combatData={};for(let r=0;r<=10;r++)for(let q=0;q<=10;q++){combatData[q+','+r]={terrain:(q===3&&r>=2&&r<=5)?'difficult':'floor',label:'',walls:[0,0,0,0]};}tokens=[];fog={};render();updateEmptyState();if(document.getElementById('empty-dismiss'))document.getElementById('empty-dismiss').click();return true;})()`); await sleep(80);
  await clickSel('.tool-btn[data-tool="measure"]'); await sleep(60);
  const a = await cellPage(2,2), b = await cellPage(5,5);
  await c.drag(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y)); await sleep(120);
  const info = await evalJSON(`measureInfo(_measure.x1,_measure.y1,_measure.x2,_measure.y2)`);
  record('P1 测量工具(距离/英尺/慢速地形)', Math.abs(info.dist-4.24)<0.05 && Math.abs(info.ft-21.2)<0.2 && info.slow>=1, JSON.stringify({dist:+info.dist.toFixed(2),ft:+info.ft.toFixed(1),slow:info.slow,eff:+info.effCells.toFixed(2)}));
}

async function t_scenes() {
  await reset();
  await c.eval(`(()=>{
    combatData={};for(let r=0;r<4;r++)for(let q=0;q<4;q++)combatData[q+','+r]={terrain:'floor',label:'',walls:[0,0,0,0]};
    render(); updateEmptyState(); if(document.getElementById('empty-dismiss'))document.getElementById('empty-dismiss').click(); return true;
  })()`); await sleep(60);
  const before = await c.eval(`(()=>{newScene('场景2');return {count:scenes.length,active:sceneById(activeSceneId).name,cells:Object.keys(combatData).length};})()`);
  const s1 = await c.eval(`scenes[0].id`);
  await c.eval(`switchScene(${JSON.stringify(s1)}); true`); await sleep(80);
  const back = await c.eval(`({cells:Object.keys(combatData).length, active:sceneById(activeSceneId).name})`);
  await c.eval(`duplicateScene(${JSON.stringify(s1)}); true`); await sleep(40);
  const dup = await c.eval(`scenes.length`);
  const dupId = await c.eval(`scenes[scenes.length-1].id`);
  await c.eval(`deleteScene(${JSON.stringify(dupId)}); true`); await sleep(40);
  const del = await c.eval(`scenes.length`);
  record('P1 多场景(新建/切换/复制/删除)', before.count===2 && before.active==='场景2' && before.cells===0 && back.cells===16 && back.active==='场景 1' && dup===3 && del===2, JSON.stringify({before,back,dup,del}));
}

async function t_viewsource() {
  await reset();
  await c.eval(`(()=>{
    combatData={};for(let r=0;r<=14;r++)for(let q=0;q<=14;q++)combatData[q+','+r]={terrain:'floor',label:'',walls:[0,0,0,0]};
    tokens=[
      {id:'tkA',kind:'player',name:'甲',x:2,y:6,w:1,h:1,icon:'⚔️',color:'#3a7abd',hp:10,maxHp:10,sightRadius:6,visionSource:true},
      {id:'tkB',kind:'player',name:'乙',x:12,y:6,w:1,h:1,icon:'🛡️',color:'#4a8a4a',hp:10,maxHp:10,sightRadius:6,visionSource:true}
    ];
    fog={}; viewRole='dm'; visionMode='auto'; viewSourceTokenId=null;
    render(); updateEmptyState(); if(document.getElementById('empty-dismiss'))document.getElementById('empty-dismiss').click(); return true;
  })()`); await sleep(80);
  const all = await c.eval(`(()=>{viewRole='player';render();return {size:computeVisibleCells().size,a:computeVisibleCells().has('3,6'),b:computeVisibleCells().has('13,6')};})()`);
  const onlyA = await c.eval(`(()=>{viewSourceTokenId='tkA';render();return {size:computeVisibleCells().size,a:computeVisibleCells().has('3,6'),b:computeVisibleCells().has('13,6')};})()`);
  const resetOk = await c.eval(`(()=>{viewSourceTokenId=null;render();return viewSourceTokenId===null;})()`);
  record('P1 玩家独立视角(单源)', all.a && all.b && onlyA.a && !onlyA.b && resetOk, JSON.stringify({all:all.size,onlyA:onlyA.size,aInA:onlyA.a,bInA:onlyA.b}));
}

// ---------------- v0.97 新特性：框选 / 画笔 / 图层 / 底图锁定 ----------------
async function t_marquee() {
  await reset();
  await c.eval(`(()=>{
    tokens=[
      {id:'tkM1',kind:'enemy',name:'A',x:2,y:3,w:1,h:1,icon:'👹',color:'#e53935',hp:8,maxHp:8,layer:'creature'},
      {id:'tkM2',kind:'enemy',name:'B',x:4,y:3,w:1,h:1,icon:'👹',color:'#e53935',hp:8,maxHp:8,layer:'creature'},
      {id:'tkM3',kind:'enemy',name:'C',x:6,y:3,w:1,h:1,icon:'👹',color:'#e53935',hp:8,maxHp:8,layer:'creature'}
    ];
    selectedTool='marquee'; render(); updateEmptyState();
    if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(80);
  await dragCells(1, 1, 7, 5);   // 框选工具拖框覆盖 3 单位
  await sleep(120);
  const sel = await c.eval(`({ size: selectedTokens.size, bg: selectedBackground })`);
  await shot('verify-marquee.png');
  record('框选(框选工具拖框覆盖3单位)', sel.size === 3 && !sel.bg, JSON.stringify(sel));
  await clickCell(1, 1); await sleep(80);   // 点击空白取消选中
  const sel2 = await c.eval(`selectedTokens.size`);
  record('框选(点击空白取消选中)', sel2 === 0, `size=${sel2}`);
}

async function t_brush() {
  await reset();
  await dismissEmpty();
  await c.eval(`setBrushTool('circle'); true`); await sleep(40);
  await dragCells(2, 2, 5, 5); await sleep(100);
  const circle = await c.eval(`shapes.filter(s=>s.type==='circle').length`);
  await c.eval(`setBrushTool('cone'); true`); await sleep(40);
  await dragCells(2, 2, 5, 2); await sleep(100);
  const cone = await c.eval(`shapes.filter(s=>s.type==='cone').length`);
  await c.eval(`setBrushTool('line'); true`); await sleep(40);
  await dragCells(2, 7, 6, 8); await sleep(100);
  const line = await c.eval(`freeLines.length`);
  await c.eval(`setBrushTool('rect'); true`); await sleep(40);
  await dragCells(8, 2, 10, 4); await sleep(100);
  const rect = await c.eval(`shapes.filter(s=>s.type==='rect').length`);
  const lay = await c.eval(`(()=>{ const s=shapes[0]; return s ? {lay:s.layer, type:s.type} : null; })()`);
  await shot('verify-brush.png');
  record('画笔(圆形/锥形/线段/矩形+图层)', circle === 1 && cone === 1 && line >= 1 && rect === 1 && lay && lay.lay === 'painting', `circle=${circle} cone=${cone} line=${line} rect=${rect} lay=${JSON.stringify(lay)}`);
}

async function t_layers() {
  await reset();
  await c.eval(`(()=>{
    tokens=[
      {id:'tkMount',kind:'npc',name:'坐骑',x:3,y:3,w:1,h:1,icon:'🐎',color:'#b98a3a',hp:10,maxHp:10,layer:'mount'},
      {id:'tkCreature',kind:'enemy',name:'敌人',x:3,y:3,w:1,h:1,icon:'👹',color:'#e53935',hp:10,maxHp:10,layer:'creature'},
      {id:'tkItem',kind:'npc',name:'宝箱',x:3,y:3,w:1,h:1,icon:'🧰',color:'#c9a84c',hp:10,maxHp:10,layer:'item'}
    ];
    render(); if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(60);
  const lay = await c.eval(`({ m: tokens[0].layer, c: tokens[1].layer, i: tokens[2].layer, om: layerOf(tokens[0],'creature') })`);
  const hideOk = await c.eval(`(()=>{ layerVisibility.creature=false; render(); return layerVisibility.creature===false; })()`);
  const layerPanel = await c.eval(`(()=>{ if(typeof renderLayerPanel==='function') renderLayerPanel(); const list=document.getElementById('layer-list'); return list ? list.children.length : -1; })()`);
  await shot('verify-layers.png');
  record('图层(单位分层+显隐+面板)', lay.m==='mount' && lay.c==='creature' && lay.i==='item' && lay.om==='mount' && hideOk===true && layerPanel>=7, JSON.stringify({lay, hideOk, layerPanel}));
  await c.eval(`layerVisibility.creature=true; true`);
}

async function t_bglock() {
  await reset();
  // 模拟「导入底图」：新建 backgroundMap（不含 locked → 默认锁定）
  await c.eval(`(()=>{
    const cv=document.createElement('canvas'); cv.width=480; cv.height=480; const g=cv.getContext('2d');
    g.fillStyle='#ccc'; g.fillRect(0,0,480,480);
    const img=new Image(); img.src=cv.toDataURL('image/png');
    backgroundMap={id:'bgL',imgData:cv.toDataURL('image/png'),img,x:2,y:2,cols:6,rows:6,opacity:0.85};
    render(); if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(60);
  const lockedDefault = await c.eval(`bgLocked()`);
  // 真实点击「底图锁定」按钮解锁
  await c.eval(`document.getElementById('btn-bg-lock').click(); true`); await sleep(80);
  const afterUnlock = await c.eval(`({ locked: bgLocked(), btn: document.getElementById('btn-bg-lock').textContent })`);
  // 解锁后：选择工具下直接在底图上拖拽（无需先点选）应移动
  await c.eval(`selectedTool='select'; render(); true`); await sleep(30);
  const before = await c.eval(`backgroundMap.x`);
  const a = await cellPage(3,3), b = await cellPage(5,5);
  await c.drag(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y)); await sleep(100);
  const afterDrag = await c.eval(`backgroundMap.x`);
  // 再点回去锁定 → 拖拽应不动
  await c.eval(`document.getElementById('btn-bg-lock').click(); true`); await sleep(80);
  const relocked = await c.eval(`bgLocked()`);
  await c.eval(`selectedBackground=true; render(); true`); await sleep(30);
  const a2 = await cellPage(3,3), b2 = await cellPage(5,5);
  await c.drag(Math.round(a2.x), Math.round(a2.y), Math.round(b2.x), Math.round(b2.y)); await sleep(100);
  const afterLockedDrag = await c.eval(`backgroundMap.x`);
  await shot('verify-bglock.png');
  record('底图锁定(真实按钮解锁/锁定+一步拖拽)', lockedDefault===true && afterUnlock.locked===false && afterUnlock.btn.includes('未锁定') && Math.abs(afterDrag-before)>0.1 && relocked===true && Math.abs(afterLockedDrag-afterDrag)<0.01, JSON.stringify({lockedDefault,afterUnlock,before,afterDrag,relocked,afterLockedDrag}));
}

async function t_pan() {
  await reset();
  await dismissEmpty();
  await c.eval(`setTool('pan'); true`); await sleep(30);
  const v0 = await c.eval(`({ x: viewX, y: viewY })`);
  const a = await cellPage(2, 2), b = await cellPage(6, 5);
  await c.drag(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y)); await sleep(80);
  const v1 = await c.eval(`({ x: viewX, y: viewY })`);
  const tool = await c.eval(`selectedTool`);
  await shot('verify-pan.png');
  record('移动工具(拖拽平移地图)', tool === 'pan' && Math.abs(v1.x - v0.x) > 20 && Math.abs(v1.y - v0.y) > 10, JSON.stringify({ tool, v0, v1 }));
}

async function t_bgLayerOrder() {
  await reset();
  await c.eval(`(async ()=>{
    const cv=document.createElement('canvas'); cv.width=300; cv.height=300; const g=cv.getContext('2d');
    g.fillStyle='#ff0000'; g.fillRect(0,0,300,300);
    const img=new Image(); img.src=cv.toDataURL('image/png');
    await new Promise(r=>{ img.onload=()=>r(); if(img.complete) r(); });
    backgroundMap={id:'bgR',imgData:cv.toDataURL('image/png'),img,x:0,y:0,cols:6,rows:6,opacity:1};
    combatData={'2,2':{terrain:'water',label:'',walls:[0,0,0,0]}};
    artStyle='classic'; render(); if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(80);
  const px = await c.eval(`(()=>{
    const g=canvas.getContext('2d');
    const read=(wx,wy)=>{const sx=Math.round(viewX+wx*zoom), sy=Math.round(viewY+wy*zoom); const d=g.getImageData(sx,sy,1,1).data; return [d[0],d[1],d[2]];};
    return { terrain: read(2*48, 2*48), empty: read(3*48, 3*48) };
  })()`);
  await shot('verify-bg-layer.png');
  // 地形格应偏蓝(water #4a90d9)，空地应偏红(底图透出)
  const ok = px.terrain[2] > px.terrain[0] && px.empty[0] > 200 && px.empty[2] < 120;
  await c.eval(`artStyle='handdrawn'; true`);
  record('底图在底层(地形盖底图+空地透底图)', ok, JSON.stringify(px));
}

async function t_bgColorMatch() {
  await reset();
  await c.eval(`(async ()=>{
    const cv=document.createElement('canvas'); cv.width=192; cv.height=192; const g=cv.getContext('2d');
    // 渐变 + 网格色块，让源图颜色丰富可对比
    for(let y=0;y<192;y++) for(let x=0;x<192;x++){ g.fillStyle='rgb('+((x*255/192)|0)+','+((y*255/192)|0)+',128)'; g.fillRect(x,y,1,1); }
    const inter=[['#0aa','#a0a','#aa0','#a00'],['#00a','#0a0','#0aa','#aaa'],['#f00','#0f0','#00f','#ff0'],['#0ff','#f0f','#fff','#f80']];
    for(let ry=0;ry<4;ry++) for(let rx=0;rx<4;rx++){ g.fillStyle=inter[ry][rx]; g.fillRect(rx*48,ry*48,48,48); }
    const img=new Image(); img.src=cv.toDataURL('image/png');
    await new Promise(r=>{ img.onload=()=>r(); if(img.complete) r(); });
    backgroundMap={id:'bgC',imgData:cv.toDataURL('image/png'),img,x:0,y:0,cols:4,rows:4,opacity:1};
    combatData={}; artStyle='classic'; showGrid=false; render();
    if(document.getElementById('empty-dismiss')) document.getElementById('empty-dismiss').click();
    return true;
  })()`); await sleep(120);
  const off = await c.eval(`(()=>{
    const g=canvas.getContext('2d');
    const sc=document.createElement('canvas'); sc.width=backgroundMap.img.naturalWidth; sc.height=backgroundMap.img.naturalHeight;
    const sg=sc.getContext('2d'); sg.drawImage(backgroundMap.img,0,0);
    const src=sg.getImageData(0,0,sc.width,sc.height).data;
    let max=0, avg=0, n=0;
    for(let wy=2; wy<188; wy+=6) for(let wx=2; wx<188; wx+=6){
      const sx=Math.round(viewX+wx*zoom), sy=Math.round(viewY+wy*zoom);
      const d=g.getImageData(sx,sy,1,1).data; const si=(wy*sc.width+wx)*4;
      const df=Math.max(Math.abs(d[0]-src[si]),Math.abs(d[1]-src[si+1]),Math.abs(d[2]-src[si+2]));
      if(df>max) max=df; avg+=df; n++;
    }
    return { max, avg: avg/n };
  })()`);
  // 开启「手绘」网格后再测一次（密集采样，量化格线对照片底图的染色）
  await c.eval(`showGrid=true; artStyle='handdrawn'; render(); true`); await sleep(80);
  const on = await c.eval(`(()=>{
    const g=canvas.getContext('2d');
    const sc=document.createElement('canvas'); sc.width=backgroundMap.img.naturalWidth; sc.height=backgroundMap.img.naturalHeight;
    const sg=sc.getContext('2d'); sg.drawImage(backgroundMap.img,0,0);
    const src=sg.getImageData(0,0,sc.width,sc.height).data;
    let max=0, avg=0, n=0;
    for(let wy=1; wy<190; wy+=3) for(let wx=1; wx<190; wx+=3){
      const sx=Math.round(viewX+wx*zoom), sy=Math.round(viewY+wy*zoom);
      const d=g.getImageData(sx,sy,1,1).data; const si=(wy*sc.width+wx)*4;
      const df=Math.max(Math.abs(d[0]-src[si]),Math.abs(d[1]-src[si+1]),Math.abs(d[2]-src[si+2]));
      if(df>max) max=df; avg+=df; n++;
    }
    return { max, avg: +(avg/n).toFixed(1) };
  })()`);
  await shot('verify-bg-color.png');
  // 空白区一致性：底图外圈空白，有底图 vs 无底图颜色应一致（#3a3a52）
  const empty = await c.eval(`(()=>{
    const g=canvas.getContext('2d');
    const read=(wx,wy)=>{const sx=Math.round(viewX+wx*zoom), sy=Math.round(viewY+wy*zoom); const d=g.getImageData(sx,sy,1,1).data; return [d[0],d[1],d[2]];};
    const withBg = read(250, 30);           // 底图(0..192)外圈，有底图
    const bgSave = backgroundMap; backgroundMap = null; render();
    const noBg = read(250, 30);             // 同一位置，无底图
    backgroundMap = bgSave; render();
    const diff = Math.max(Math.abs(withBg[0]-noBg[0]), Math.abs(withBg[1]-noBg[1]), Math.abs(withBg[2]-noBg[2]));
    return { withBg, noBg, diff };
  })()`);
  await c.eval(`showGrid=true; artStyle='handdrawn'; true`);
  // 关网格应忠实还原(max≈0)；空白区有/无底图应一致(diff≈0)，且都接近 #3a3a52
  const nearBase = Math.abs(empty.withBg[0]-58) < 12 && Math.abs(empty.withBg[1]-58) < 12;
  record('底图颜色(关网格还原≈0 / 空白区有/无底图一致)', off.max <= 5 && on.avg <= 15 && empty.diff <= 2 && nearBase, `off=${JSON.stringify(off)} on=${JSON.stringify(on)} empty=${JSON.stringify(empty)}`);
}

async function main() {
  const file = 'file:///E:/yingren/4AD/2_%E5%B7%A5%E5%85%B7/combatmap.dist.html';
  const { proc, c: cdp } = await launch(9223, file);
  c = cdp;
  try {
    const ready = await waitReady();
    if (!ready) { console.error('FAIL to initialize page'); proc.kill(); return; }
    await dismissEmpty();
    await t_paint();
    await t_paintDrag();
    await t_token();
    await t_tokenMulti();
    await t_fog();
    await t_dm();
    await t_initiative();
    await t_template();
    await t_undo();
    await t_export_data();
    await t_online();
    await t_wall();
    await t_vision();
    await t_basemap();
    await t_measure();
    await t_scenes();
    await t_viewsource();
    await t_marquee();
    await t_brush();
    await t_layers();
    await t_bglock();
    await t_pan();
    await t_bgLayerOrder();
    await t_bgColorMatch();
  } catch (e) {
    console.error('EXCEPTION:', e.message);
    try { await shot('verify-exception.png'); } catch {}
  } finally {
    const pass = results.filter(r => r.ok).length;
    console.log('\n==== SUMMARY ====');
    results.forEach(r => console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}`));
    console.log(`  ${pass}/${results.length} passed`);
    proc.kill();
  }
}
main();
