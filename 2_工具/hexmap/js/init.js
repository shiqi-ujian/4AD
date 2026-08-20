// ======== Init ========
cleanHexData();
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Set initial view to center
viewX = canvas.width / 2;
viewY = canvas.height / 2;

// Load terrain config and rebuild dynamic palette
loadTerrainConfig();
rebuildTerrainPalette();
const allIds = getAllTerrainIds();
if (!getTerrainInfo(selectedTerrain) && allIds.length > 0) selectedTerrain = allIds[0];

// Load icon style preference and sync the toggle
try {
  const saved = localStorage.getItem('hexmap_iconStyle');
  if (saved === 'vector' || saved === 'emoji') iconStyle = saved;
} catch(err) {}
const iconChk = document.getElementById('chk-icon-style');
if (iconChk) iconChk.checked = (iconStyle === 'vector');

// Load art style preference and sync the toggle
try {
  const savedArt = localStorage.getItem('hexmap_artStyle');
  if (savedArt === 'handdrawn' || savedArt === 'classic') artStyle = savedArt;
} catch(err) {}
const artChk = document.getElementById('chk-art-style');
if (artChk) artChk.checked = (artStyle === 'handdrawn');
applyArtStyleClass();

// Normalize any legacy/one-sided river data before first render.
normalizeAllRivers();

// Build region palette
rebuildRegionPalette();

// Fog of War UI: checkbox toggle + reveal-all / reset buttons
const fogChk = document.getElementById('chk-fog');
if (fogChk) {
  fogChk.checked = isFog;
  fogChk.addEventListener('change', (e) => { isFog = e.target.checked; render(); });
}
const fogReveal = document.getElementById('btn-fog-reveal-all');
if (fogReveal) fogReveal.addEventListener('click', () => { revealAll(); render(); updateInfo(); });
const fogHide = document.getElementById('btn-fog-hide-all');
if (fogHide) fogHide.addEventListener('click', () => { concealfogAll(); render(); updateInfo(); });

// 若 URL 带分享地图(如 ?m=1#m=…)，启动即自动导入（刷新/扫码后直达地图）
// 注意：export.js 在 init.js 之后加载，因此挂到 DOMContentLoaded 再执行。
function loadMapDataFromUrlShare() {
  const mIndex = location.hash.indexOf('m=');
  if (mIndex === -1) return;
  const code = decodeURIComponent(location.hash.slice(mIndex + 2));
  if (!code) return;
  showDiceResult('🔗', '检测到分享地图，正在导入…');
  decodeCompactText(code).then(function(data) {
    const n = applyMapData(data);
    showDiceResult('🔗 导入成功', '共 ' + n + ' 个六角格');
    if (history.replaceState) {
      const clean = location.origin + location.pathname + location.search;
      try { history.replaceState(null, '', clean); } catch (e) { /* ignore */ }
    }
  }).catch(function(err) {
    showDiceResult('⚠️ 导入失败', (err && err.message) || '数据无效');
  });
}
document.addEventListener('DOMContentLoaded', loadMapDataFromUrlShare);

// Set initial tool — shows hints and updates coord display
setTool('select');
render();
updateInfo();

console.log('🏗️ 六角格沙盒地图已加载');
console.log('快捷键: V=选择 X=框选 B=笔刷 S=定居点 R=道路 W=河流 L=标签 E=擦除 F=探索揭示 Ctrl+Z=撤销');

