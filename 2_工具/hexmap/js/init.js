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

// Set initial tool — shows hints and updates coord display
setTool('select');
render();
updateInfo();

console.log('🏗️ 六角格沙盒地图已加载');
console.log('快捷键: V=选择 X=框选 B=笔刷 S=定居点 R=道路 W=河流 L=标签 E=擦除 F=探索揭示 Ctrl+Z=撤销');

