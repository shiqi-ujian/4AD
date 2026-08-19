//  Init
// ============================================================
function init() {
  resizeCanvas();
  refreshTerrains();
  rebuildTerrainPalette();
  setTool('select');
  const dmCheck = document.getElementById('chk-dm');
  if (dmCheck) dmCheck.checked = showDmLayer;
  const fogCheck = document.getElementById('chk-fog');
  if (fogCheck) fogCheck.checked = showFogLayer;
  viewX = canvas.width / 2;
  viewY = canvas.height / 2;
  render();
  updateInfo();
  const cdn = window.__combatmapCDN || {};
  const missing = [];
  if (cdn.xlsx === false) missing.push('SheetJS');
  if (cdn.jszip === false) missing.push('JSZip');
  if (cdn.peerjs === false) missing.push('PeerJS');
  if (missing.length > 0) {
    const warn = document.getElementById('cdn-warning');
    if (warn) {
      warn.style.display = 'block';
      warn.textContent = `⚠️ 依赖未加载（${missing.join(', ')}）— xlsx 导出降级 / 在线功能不可用，建议联网后刷新`;
    }
  }
  console.log(`⚔️ 通用战斗地图生成器 ${COMBATMAP_VERSION} 已就绪`);
  console.log('快捷键: V=选择 B=笔刷 W=墙壁 D=门 L=标签 E=擦除 R=区域 T=图片 G=线段 U=单位 Y=DM层 F=战雾 Delete=删除选中');
  console.log('新增: 单位 Token/HP/状态 · DM 层 · 战雾 · 行动顺序 · PeerJS 实时在线房间 · 区域/图片/线段图层 · xlsx 颜色');
  if (typeof initCombatShareUI === 'function') initCombatShareUI();
}

window.addEventListener('resize', resizeCanvas);
init();

