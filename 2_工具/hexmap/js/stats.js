// ======== Map Statistics Panel ========

// Compute aggregate stats over all hexData.
function computeMapStats() {
  const allT = getAllTerrains();
  const total = Object.keys(hexData).length;
  // 迷雾覆盖统计：已揭示 vs 未揭示（仅当迷雾开启时有效）
  let fogged = 0, revealed = 0;
  for (const key of Object.keys(hexData)) {
    const [q, r] = key.split(',').map(Number);
    if (hexIsFogged(q, r)) fogged++; else revealed++;
  }
  const terrainCount = {};   // terrainId -> count
  const regionArea = {};     // regionId -> count
  let settlements = 0;
  let roadEdges = 0;
  let riverStream = 0, riverWide = 0;
  let annotations = 0;
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  let minElev = Infinity, maxElev = -Infinity, hasElev = false;
  const seenRoads = new Set();
  const seenRivers = new Set();

  for (const [key, h] of Object.entries(hexData)) {
    const [q, r] = key.split(',').map(Number);
    if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
    if (r < minR) minR = r; if (r > maxR) maxR = r;

    if (h.terrain) terrainCount[h.terrain] = (terrainCount[h.terrain] || 0) + 1;
    if (h.region) regionArea[h.region] = (regionArea[h.region] || 0) + 1;
    if (h.settlement) settlements++;
    if (h.annotations) annotations += h.annotations.length;
    if (typeof h.elev === 'number') {
      hasElev = true;
      if (h.elev < minElev) minElev = h.elev;
      if (h.elev > maxElev) maxElev = h.elev;
    }

    if (h.roads) {
      for (const rd of h.roads) {
        const a = q + ',' + r, b = rd.q + ',' + rd.r;
        const rk = a < b ? a + '-' + b : b + '-' + a;
        if (!seenRoads.has(rk)) { seenRoads.add(rk); roadEdges++; }
      }
    }
    if (h.rivers) {
      for (const rv of h.rivers) {
        const rk = edgeKey(q, r, rv.q, rv.r);
        if (!seenRivers.has(rk)) {
          seenRivers.add(rk);
          if ((rv.width || 1) >= 2) riverWide++; else riverStream++;
        }
      }
    }
  }

  return {
    total,
    fogged, revealed,
    terrainCount,
    regionArea,
    settlements,
    roadEdges,
    riverStream,
    riverWide,
    riverEdges: riverStream + riverWide,
    annotations,
    bounds: (total === 0) ? null : { minQ, maxQ, minR, maxR },
    elevationRange: hasElev ? { min: minElev, max: maxElev } : null
  };
}

// Render stats into the modal body and open it.
function openStatsModal() {
  const s = computeMapStats();
  const body = document.getElementById('stats-body');
  if (!body) return;

  const allT = getAllTerrains();
  const terrainIds = getAllTerrainIds();

  let html = '';
  if (s.total === 0) {
    html = '<div style="font-size:13px;color:#888;text-align:center;padding:24px 0;">地图为空，尚未生成任何六角格。</div>';
  } else {
    html += `<div style="margin-bottom:10px;">
      <span style="font-size:15px;font-weight:bold;color:#e94560;">总格数 ${s.total}</span>
      <span style="color:#aaa;font-size:12px;"> · 坐标 q[${s.bounds.minQ}..${s.bounds.maxQ}] r[${s.bounds.minR}..${s.bounds.maxR}]</span>
    </div>`;

    // Terrain distribution
    html += '<div style="margin-bottom:10px;"><div style="font-size:12px;color:#888;margin-bottom:4px;">🗺️ 地形分布</div>';
    for (const id of terrainIds) {
      const t = allT[id];
      if (!t) continue;
      const n = s.terrainCount[id] || 0;
      if (n === 0) continue;
      const pct = (n / s.total * 100).toFixed(1);
      html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px;">
        <span style="width:22px;height:14px;border-radius:3px;background:${t.color};display:inline-block;flex-shrink:0;"></span>
        <span style="color:#ddd;flex:1;">${iconLegendHTML(id, t.icon, t.color, t.name)}</span>
        <span style="color:#aaa;">${n} 格</span>
        <span style="color:#666;width:42px;text-align:right;">${pct}%</span>
      </div>`;
    }
    html += '</div>';

    // Region area
    const regionIds = regionOrder || Object.keys(regions);
    html += '<div style="margin-bottom:10px;"><div style="font-size:12px;color:#888;margin-bottom:4px;">👑 王国面积</div>';
    let regionRow = '';
    for (const id of regionIds) {
      const r = regions[id];
      if (!r) continue;
      const n = s.regionArea[id] || 0;
      if (n === 0) continue;
      regionRow += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px;">
        <span style="width:22px;height:14px;border-radius:3px;background:${r.color};display:inline-block;flex-shrink:0;"></span>
        <span style="color:#ddd;flex:1;">${iconLegendHTML(null, r.icon, r.color, r.name)}</span>
        <span style="color:#aaa;">${n} 格 (${(n / s.total * 100).toFixed(1)}%)</span>
      </div>`;
    }
    html += regionRow || '<div style="font-size:12px;color:#555;">尚未分配王国</div>';
    html += '</div>';

    // Counts
    html += `<div style="margin-bottom:6px;font-size:12px;color:#ccc;">
      <div style="padding:2px 0;">🏘️ 定居点：<span style="color:#fff;">${s.settlements}</span></div>
      <div style="padding:2px 0;">🛤️ 道路：<span style="color:#fff;">${s.roadEdges}</span> 条边</div>
      <div style="padding:2px 0;">🌊 河流：<span style="color:#fff;">${s.riverStream} 溪流 + ${s.riverWide} 河 = ${s.riverEdges}</span> 条边</div>
      <div style="padding:2px 0;">📋 详细标注：<span style="color:#fff;">${s.annotations}</span> 条</div>
      <div style="padding:2px 0;">⛰️ 海拔范围：<span style="color:#fff;">${s.elevationRange ? `${s.elevationRange.min.toFixed(2)} ~ ${s.elevationRange.max.toFixed(2)}` : '—'}</span></div>
      ${isFog ? `<div style="padding:2px 0;">🌫️ 探索迷雾：<span style="color:#fff;">已揭示 ${s.revealed} 格 · 未揭示 ${s.fogged} 格</span> (${(100 * s.revealed / s.total).toFixed(0)}% 已探索)</div>` : ''}
    </div>`;
  }

  body.innerHTML = html;
  document.getElementById('stats-modal').style.display = 'block';
}

// Button wire
document.getElementById('btn-stats')?.addEventListener('click', openStatsModal);
document.getElementById('stats-close')?.addEventListener('click', function() {
  document.getElementById('stats-modal').style.display = 'none';
});
document.getElementById('stats-modal')?.addEventListener('click', function(e) {
  if (e.target === e.currentTarget) this.style.display = 'none';
});