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

// Set initial tool — shows hints and updates coord display
setTool('select');
render();
updateInfo();

console.log('🏗️ 四战黑六角格地图已加载');
console.log('快捷键: V=选择 X=框选 B=笔刷 S=定居点 R=道路 L=标签 E=擦除 Ctrl+Z=撤销');

