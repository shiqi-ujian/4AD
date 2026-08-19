//  Init
// ============================================================
function init() {
  resizeCanvas();
  refreshTerrains();
  rebuildTerrainPalette();
  setTool('select');
  viewX = canvas.width / 2;
  viewY = canvas.height / 2;
  render();
  updateInfo();
  const cdn = window.__combatmapCDN || {};
  const missing = [];
  if (cdn.xlsx === false) missing.push('SheetJS');
  if (cdn.jszip === false) missing.push('JSZip');
  if (missing.length > 0) {
    const warn = document.getElementById('cdn-warning');
    if (warn) {
      warn.style.display = 'block';
      warn.textContent = `⚠️ 依赖未加载（${missing.join(', ')}）— xlsx 导出将降级，建议联网后刷新`;
    }
  }
  console.log(`⚔️ 通用战斗地图生成器 ${COMBATMAP_VERSION} 已就绪`);
  console.log('快捷键: V=选择 B=笔刷 W=墙壁 D=门 L=标签 E=擦除 R=区域 T=图片 G=线段 Delete=删除选中');
  console.log('新增: 区域/图片/线段图层 · 自定义地形(⚙️管理) · 智能区域模板 · 枭熊场景导出 · xlsx 颜色修复');
}

window.addEventListener('resize', resizeCanvas);
init();

