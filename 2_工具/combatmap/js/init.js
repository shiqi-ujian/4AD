//  Init
// ============================================================
function init() {
  resizeCanvas();
  refreshTerrains();
  try {
    const savedArt = localStorage.getItem('combatmap_artStyle');
    if (savedArt === 'handdrawn' || savedArt === 'classic') artStyle = savedArt;
  } catch(e) {}
  const artChk = document.getElementById('chk-art-style');
  if (artChk) artChk.checked = (artStyle === 'handdrawn');
  applyArtStyleClass();
  rebuildTerrainPalette();
  setTool('select');
  const dmCheck = document.getElementById('chk-dm');
  if (dmCheck) dmCheck.checked = showDmLayer;
  const fogCheck = document.getElementById('chk-fog');
  if (fogCheck) fogCheck.checked = showFogLayer;
  const coordCheck = document.getElementById('chk-coords');
  if (coordCheck) coordCheck.checked = showCoords;
  const visionCheck = document.getElementById('chk-vision');
  if (visionCheck) visionCheck.checked = (visionMode === 'auto');
  viewX = canvas.width / 2;
  viewY = canvas.height / 2;
  render();
  updateInfo();
  updateEmptyState();
  refreshBgAlignButton();
  if (typeof applyRoleViewUI === 'function') applyRoleViewUI();
  if (typeof renderTokenLibrary === 'function') renderTokenLibrary();
  // v0.97 图层 + 画笔 UI 初始化
  if (typeof bindBrushUI === 'function') bindBrushUI();
  if (typeof refreshBrushUI === 'function') refreshBrushUI();
  if (typeof renderLayerPanel === 'function') renderLayerPanel();
  if (typeof updateBgLockUI === 'function') updateBgLockUI();
  const cdn = window.__combatmapCDN || {};
  const missing = [];
  if (cdn.xlsx === false) missing.push('SheetJS');
  if (cdn.jszip === false) missing.push('JSZip');
  if (missing.length > 0) {
    const warn = document.getElementById('cdn-warning');
    if (warn) {
      warn.style.display = 'block';
      warn.textContent = `⚠️ 依赖未加载（${missing.join(', ')}）— xlsx 导出降级，建议联网后刷新`;
    }
  }
  console.log(`⚔️ 通用战斗地图生成器 ${COMBATMAP_VERSION} 已就绪`);
  console.log('快捷键: V=选择(即拖+空白平移) X=框选 B=笔刷 H=移动地图 W=墙壁 D=门 L=标签 E=擦除 T=图片 M=测量 U=单位库 Y=DM层 F=战雾 R=画笔矩形 G=画笔线段 O=画笔圆形 C=画笔锥形 Delete=删除选中');
  console.log('v0.81: 页签面板 · 网格对齐重做 · DM/玩家视图 · 单位库 · 摆放后自动回选择(Shift连放)');
  if (typeof initCombatShareUI === 'function') initCombatShareUI();
  if (typeof ensureScenes === 'function') ensureScenes();
  if (typeof renderSceneList === 'function') renderSceneList();
  if (typeof cloudInit === 'function') cloudInit();  // 云端持久化：URL mapid → 加载已保存地图，改动自动保存
}

window.addEventListener('resize', resizeCanvas);
init();

