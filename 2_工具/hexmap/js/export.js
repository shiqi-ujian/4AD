// ======== 导出增强：当前视野 PNG + 紧凑分享/导入 ========
// 依赖: state.js/core.js/render.js 的渲染函数；generate.js 的
// buildImageRegistry/resolveImageRegistry/gzip* 帮助函数。
// 注意事项：本模块在 init.js 之后加载，事件用 DOMContentLoaded 绑定。

// ---------------- 当前视野导出 PNG ----------------
function exportCurrentViewPng() {
  const W = canvas.width, H = canvas.height;
  if (!W || !H) { showDiceResult('⚠️', '画布无尺寸'); return; }

  // 当前视野可见的六角格范围（含一圈边界，与 render() 一致）
  const margin = HEX_SIZE * 2;
  const topLeft = pixelToHex((-viewX - margin) / zoom, (-viewY - margin) / zoom);
  const botRight = pixelToHex((W - viewX + margin) / zoom, (H - viewY + margin) / zoom);
  const qMin = Math.floor(topLeft.q), qMax = Math.ceil(botRight.q);
  const rMin = Math.floor(topLeft.r), rMax = Math.ceil(botRight.r);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = W; exportCanvas.height = H;
  const g = exportCanvas.getContext('2d');

  g.fillStyle = '#2d2d44';
  g.fillRect(0, 0, W, H);
  g.save();
  g.translate(viewX, viewY);
  g.scale(zoom, zoom);

  const allTerrains = getAllTerrains();
  const _prevGrid = showGrid, _prevCoords = showCoords;

  // Pass 1: 地形 + 格线
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawHexBase(g, q, r, getHex(q, r), allTerrains);
    }
  }
  // Pass 2: 王国边境
  drawRegionBorders(g, qMin, qMax, rMin, rMax, getHex);
  // Pass 2.5: 河流
  drawRivers(g, qMin, qMax, rMin, rMax);
  // Pass 2.7: 道路
  g.strokeStyle = '#8B4513'; g.lineWidth = 3;
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (h.roads) {
        const p1 = hexToPixel(q, r);
        for (const rd of h.roads) {
          if (rd.q > q || (rd.q === q && rd.r > r)) {
            const p2 = hexToPixel(rd.q, rd.r);
            g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
          }
        }
      }
    }
  }
  // Pass 3: 覆盖层（图标/标签/定居点/坐标）
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      drawHexOverlay(g, q, r, getHex(q, r));
    }
  }
  // Pass 4: 王国名称
  drawRegionNames(g);
  g.restore();
  showGrid = _prevGrid; showCoords = _prevCoords;

  const link = document.createElement('a');
  link.download = 'hexmap_view_' + new Date().toISOString().slice(0, 10) + '.png';
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  showDiceResult('🎯 视野已导出', W + 'x' + H + ' (' + (qMax - qMin + 1) + '×' + (rMax - rMin + 1) + ' 格)');
}

// ---------------- Base64URL 帮助函数 ----------------
function b64UrlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function b64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function u8toAB(u8) { return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength); }

// 从当前地图生成紧凑数据串（可分享）：gzip(JSON) → Uint8Array → Base64URL
async function compactEncodeString() {
  cleanHexData();
  const ex = buildImageRegistry(hexData, customTerrains);
  const data = {
    hexData: ex.exportHex,
    imageRegistry: ex.registry,
    customTerrains: ex.exportCT,
    deletedTerrains,
    terrainOrder,
    generationRules,
    regions,
    regionOrder
  };
  const json = JSON.stringify(data);
  let bytes;
  if (gzipSupported()) {
    const blob = await gzipCompress(json);
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    bytes = new TextEncoder().encode(json);
  }
  return b64UrlEncode(bytes);
}

// 从用户粘贴的文本里取出紧凑串：接受完整链接、纯串、带 #m=/compact: 前缀
function extractCompactText(raw) {
  let s = (raw || '').trim();
  if (s.indexOf('#') !== -1) {
    const frag = s.split('#')[1] || '';
    const m = frag.match(/m=([A-Za-z0-9_-]+)/);
    if (m) s = m[1];
  }
  if (s.startsWith('compact:')) s = s.slice('compact:'.length);
  if (s.startsWith('m=')) s = s.slice(2);
  return s.trim();
}

// 解码紧凑串 → 地图数据对象
async function decodeCompactText(raw) {
  const body = extractCompactText(raw);
  if (!body) throw new Error('空数据');
  const bytes = b64UrlDecode(body);
  let text;
  if (gzipSupported() && bytes.length > 1 && bytes[0] === 0x1F && bytes[1] === 0x8B) {
    const blob = new Blob([u8toAB(bytes)], { type: 'application/gzip' });
    text = await gzipDecompress(blob);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return JSON.parse(text);
}

// 把地图数据对象应用到当前画布；返回导入的六角格数
function applyMapData(data) {
  if (!data) throw new Error('空数据');
  const resolved = resolveImageRegistry(data.hexData || {}, data.customTerrains || {}, data.imageRegistry || {});
  hexData = resolved.resultHex;
  customTerrains = resolved.resultCT;
  rebuildSettlementIndex();
  undoStack = []; redoStack = []; updateUndoButtons();
  if (data.deletedTerrains) deletedTerrains = data.deletedTerrains;
  if (data.terrainOrder) terrainOrder = data.terrainOrder;
  if (data.generationRules) generationRules = { ...DEFAULT_GEN_RULES, ...data.generationRules };
  if (data.regions) regions = data.regions;
  if (data.regionOrder) regionOrder = data.regionOrder;
  if (typeof data.viewX === 'number') viewX = data.viewX;
  if (typeof data.viewY === 'number') viewY = data.viewY;
  if (typeof data.zoom === 'number') zoom = data.zoom;
  rebuildRegionPalette();
  saveTerrainConfig();
  rebuildTerrainPalette();
  const zi = document.getElementById('zoom-indicator');
  if (zi) zi.textContent = '🔍 ' + Math.round(zoom * 100) + '%';
  render();
  updateInfo();
  return Object.keys(hexData).length;
}

// 完整 JSON（含图片 dataURL，无压缩）—— 供「完整JSON」复制
function buildFullJSON() {
  cleanHexData();
  const ex = buildImageRegistry(hexData, customTerrains);
  const data = { hexData: ex.exportHex, imageRegistry: ex.registry, customTerrains: ex.exportCT, deletedTerrains, terrainOrder, generationRules, regions, regionOrder };
  return JSON.stringify(data);
}

function setShareStatus(msg) {
  const s = document.getElementById('share-status');
  if (s) s.textContent = msg;
}

function openShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  modal.style.display = 'block';
  setShareStatus('⏳ 编码中…');
  document.getElementById('share-loading').style.display = 'block';
  document.getElementById('share-text').value = '';
  const box = document.getElementById('share-text');
  box.placeholder = '正在生成数据串…';
  box.setAttribute('data-ready', '0');

  setTimeout(async function() {
    try {
      const s = await compactEncodeString();
      const fullLink = location.origin + location.pathname + '?m=1#m=' + encodeURIComponent(s);
      box.value = s;
      box.setAttribute('data-ready', '1');
      document.getElementById('share-loading').style.display = 'none';
      setShareStatus('✅ 已生成 ' + (s.length / 1024).toFixed(0) + ' KB，可复制链接或数据串。链接形如: ' + fullLink.substring(0, 60) + '…');
    } catch (err) {
      document.getElementById('share-loading').style.display = 'none';
      setShareStatus('⚠️ 编码失败: ' + (err && err.message));
    }
  }, 30);
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
  const btnView = document.getElementById('btn-export-view');
  if (btnView) btnView.addEventListener('click', exportCurrentViewPng);

  const btnShare = document.getElementById('btn-share');
  if (btnShare) btnShare.addEventListener('click', openShareModal);

  const closeBtn = document.getElementById('share-btn-close');
  if (closeBtn) closeBtn.addEventListener('click', closeShareModal);
  const modal = document.getElementById('share-modal');
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeShareModal(); });

  const box = document.getElementById('share-text');

  // 复制数据串
  document.getElementById('share-btn-copy-data').addEventListener('click', function() {
    const val = box.value;
    if (!val) { setShareStatus('⚠️ 尚未生成数据'); return; }
    navigator.clipboard.writeText(val).then(function() { setShareStatus('✅ 数据串已复制'); }, function() {
      box.select(); document.execCommand('copy'); setShareStatus('✅ 数据串已复制');
    });
  });

  // 复制完整链接
  document.getElementById('share-btn-copy-link').addEventListener('click', function() {
    const val = box.value;
    if (!val) { setShareStatus('⚠️ 尚未生成数据'); return; }
    const link = location.origin + location.pathname + '?m=1#m=' + encodeURIComponent(val);
    navigator.clipboard.writeText(link).then(function() { setShareStatus('✅ 分享链接已复制（含完整地图数据）'); }, function() {
      box.select(); document.execCommand('copy'); setShareStatus('✅ 已复制（复制的是数据，请先拼接前缀）');
    });
  });

  // 复制完整 JSON（含图片）
  document.getElementById('share-btn-copy-all').addEventListener('click', function() {
    try {
      const json = buildFullJSON();
      navigator.clipboard.writeText(json).then(function() { setShareStatus('✅ 完整JSON已复制（含图片，较庞大）'); }, function() {
        box.value = json; box.select(); document.execCommand('copy'); setShareStatus('✅ 完整JSON已复制');
      });
    } catch (err) { setShareStatus('⚠️ 失败: ' + (err && err.message)); }
  });

  // 文本域里的复制按钮
  document.getElementById('share-btn-copy').addEventListener('click', function() {
    const val = box.value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(function() { setShareStatus('✅ 已复制'); }, function() { box.select(); document.execCommand('copy'); setShareStatus('✅ 已复制'); });
  });

  // 导入
  document.getElementById('share-btn-import').addEventListener('click', function() {
    const val = box.value.trim();
    if (!val) { setShareStatus('⚠️ 请先粘贴数据串'); return; }
    setShareStatus('⏳ 解压并导入中…');
    decodeCompactText(val).then(function(data) {
      const n = applyMapData(data);
      setShareStatus('✅ 已导入 ' + n + ' 个六角格');
      closeShareModal();
    }).catch(function(err) {
      // 回退：若用户直接粘贴了完整 JSON，尝试直接解析
      try {
        const data = JSON.parse(val);
        const n = applyMapData(data);
        setShareStatus('✅ 已导入 ' + n + ' 个六角格');
        closeShareModal();
      } catch (err2) {
        setShareStatus('⚠️ 导入失败: ' + (err && err.message));
      }
    });
  });
});

// 自动导入：若页面自带 #m= 参数，加载完成后提示导入
document.addEventListener('DOMContentLoaded', function() {
  const mIndex = location.hash.indexOf('m=');
  if (mIndex === -1) return;
  const code = decodeURIComponent(location.hash.slice(mIndex + 2));
  if (!code) return;
  showDiceResult('🔗', '检测到分享地图，正在导入…');
  decodeCompactText(code).then(function(data) {
    const n = applyMapData(data);
    showDiceResult('🔗 导入成功', '共 ' + n + ' 个六角格');
    // 尝试清理 URL 片段，避免刷新重复导入
    if (history.replaceState) {
      const clean = location.origin + location.pathname + location.search;
      try { history.replaceState(null, '', clean); } catch (e) { /* ignore */ }
    }
  }).catch(function(err) { showDiceResult('⚠️ 导入失败', (err && err.message) || '数据无效'); });
});