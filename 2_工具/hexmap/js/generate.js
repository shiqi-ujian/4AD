// ======== One-Click Map Generation ========

// Mulberry32 PRNG — deterministic, seedable
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Perlin noise — permutation table
let _perm = new Uint8Array(512);
function initPerm(seed) {
  const rng = mulberry32(seed);
  const p = [...Array(256).keys()];
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function grad2D(hash, x, y) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function noise2D(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = _perm[_perm[X] + Y], ab = _perm[_perm[X] + Y + 1];
  const ba = _perm[_perm[X + 1] + Y], bb = _perm[_perm[X + 1] + Y + 1];
  return lerp(
    lerp(grad2D(aa, xf, yf), grad2D(ba, xf - 1, yf), u),
    lerp(grad2D(ab, xf, yf - 1), grad2D(bb, xf - 1, yf - 1), u),
    v
  );
}

function fractalNoise(x, y, octaves) {
  let value = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, y * freq);
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value / max; // -1..1
}

// Unify the elevation/moisture → terrain classification chain (also returns the
// two noise values so callers can persist them). Single source of truth for the
// thresholds; the inline Web Worker re-implements it inline (workers can't call
// this), but must stay identical.
function classifyElevMoist(nx, ny, rng) {
  const elev = fractalNoise(nx, ny, 4);
  const moist = fractalNoise(nx + 100, ny + 100, 3);
  let terrain;
  if (elev < -0.20) terrain = 'water';
  else if (elev > 0.50 && moist < -0.05) terrain = 'snow';
  else if (elev > 0.40) terrain = 'mountain';
  else if (elev > 0.20) terrain = 'hill';
  else if (moist < -0.15) terrain = 'desert';
  else if (moist > 0.15 && elev < 0.30) terrain = 'forest';
  else if (elev < -0.05 && moist > 0.10) terrain = 'swamp';
  else terrain = generationRules.defaultTerrain || 'plain';
  return { elev, moist, terrain };
}

// Generate terrain for a bounded region (synchronous — kept for backward compat)
// ======== Web Worker for off-thread Perlin noise ========
let _noiseWorker = null;
let _noiseWorkerReady = false;
let _workerPending = null; // { resolve, reject }

function getNoiseWorker() {
  if (_noiseWorker) return _noiseWorker;
  if (typeof Blob === 'undefined' || typeof Worker === 'undefined') return null;

  // Inline worker — encapsulates all noise math, no DOM access
  const workerCode = [
    'var _perm=new Uint8Array(512);',
    'function m32(s){return function(){s|=0;s=s+0x6D2B79F5|0;var t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};',
    'function ip(s){var r=m32(s),p=[],i;for(i=0;i<256;i++)p[i]=i;for(i=255;i>0;i--){var j=Math.floor(r()*(i+1)),t=p[i];p[i]=p[j];p[j]=t;}for(i=0;i<512;i++)_perm[i]=p[i&255]};',
    'function f(t){return t*t*t*(t*(t*6-15)+10)};function l(a,b,t){return a+t*(b-a)};',
    'function g2(h,x,y){var u=(h&1?y:x),v=(h&2?y:x);return(h&1?-u:u)+(h&2?-v:v)};',
    'function n2(x,y){var X=Math.floor(x)&255,Y=Math.floor(y)&255,xf=x-Math.floor(x),yf=y-Math.floor(y),u=f(xf),v=f(yf);var aa=_perm[_perm[X]+Y],ab=_perm[_perm[X]+Y+1],ba=_perm[_perm[X+1]+Y],bb=_perm[_perm[X+1]+Y+1];return l(l(g2(aa,xf,yf),g2(ba,xf-1,yf),u),l(g2(ab,xf,yf-1),g2(bb,xf-1,yf-1),u),v)};',
    'function fn(x,y,o){var val=0,amp=1,freq=1,mx=0;for(var i=0;i<o;i++){val+=amp*n2(x*freq,y*freq);mx+=amp;amp*=0.5;freq*=2;}return val/mx};',
    'self.onmessage=function(e){var d=e.data,seed=d.seed,coords=d.coords,scale=d.scale;ip(seed);',
    'var res=[];for(var i=0;i<coords.length;i++){var c=coords[i],nx=c.px*0.005/scale,ny=c.py*0.005/scale;',
    'var elev=fn(nx,ny,4),moist=fn(nx+100,ny+100,3),t;',
    'if(elev<-0.20)t="water";else if(elev>0.50&&moist<-0.05)t="snow";else if(elev>0.40)t="mountain";else if(elev>0.20)t="hill";else if(moist<-0.15)t="desert";else if(moist>0.15&&elev<0.30)t="forest";else if(elev<-0.05&&moist>0.10)t="swamp";else t="plain";',
    'res.push({q:c.q,r:c.r,terrain:t,elev:elev,moist:moist});}',
    'self.postMessage({results:res,id:d.id});};'
  ].join('\n');

  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    _noiseWorker = new Worker(URL.createObjectURL(blob));
    _noiseWorkerReady = true;
    return _noiseWorker;
  } catch(e) {
    console.warn('Web Worker not available, using main thread for noise');
    _noiseWorkerReady = false;
    return null;
  }
}

// Classify terrain from noise using the worker (async). Falls back to sync if no worker.
function classifyBatchWithWorker(seed, coords, scale) {
  return new Promise(function(resolve) {
    const w = getNoiseWorker();
    if (!w) {
      // Fallback: compute on main thread
      initPerm(seed);
      const results = [];
      for (let i = 0; i < coords.length; i++) {
        const c = coords[i];
        const nx = c.px * 0.005 / scale, ny = c.py * 0.005 / scale;
        const em = classifyElevMoist(nx, ny);
        results.push({ q: c.q, r: c.r, terrain: em.terrain, elev: em.elev, moist: em.moist });
      }
      resolve(results);
      return;
    }

    const msgId = Date.now() + Math.random();
    const handler = function(e) {
      if (e.data.id === msgId) {
        w.removeEventListener('message', handler);
        resolve(e.data.results);
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ id: msgId, seed: seed, coords: coords, scale: scale });
  });
}

function generateTerrainRegion(seed, centerQ, centerR, width, height, scale) {
  initPerm(seed);
  const rng = mulberry32(seed + 1);
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const allTerrains = getAllTerrains();
  const ids = [];

  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      ids.push({ q, r });
    }
  }

  // Shuffle for varied processing order (avoids bias)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  for (const { q, r } of ids) {
    const p = hexToPixel(q, r);
    const nx = p.x * 0.005 / scale;
    const ny = p.y * 0.005 / scale;

    const em = classifyElevMoist(nx, ny, rng);
    const elev = em.elev, moist = em.moist;
    let terrainId = em.terrain;

    // Special terrain injection
    const chance = generationRules.specialTerrainChance != null ? generationRules.specialTerrainChance : 0.05;
    if (rng() < chance) {
      const special = pickSpecialTerrain(rng);
      if (special) terrainId = special;
    }

    writeHexData(hexKey(q, r), { terrain: terrainId, elev, moist });
  }
}

// Async chunked version — use for large maps to keep UI responsive
async function generateTerrainRegionAsync(seed, centerQ, centerR, width, height, scale, onProgress) {
  const rng = mulberry32(seed + 1);
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // Build coord list with pixel positions
  const coords = [];
  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      const p = hexToPixel(q, r);
      coords.push({ q, r, px: p.x, py: p.y });
    }
  }

  // Shuffle
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = coords[i]; coords[i] = coords[j]; coords[j] = tmp;
  }

  const total = coords.length;
  const CHUNK = getNoiseWorker() ? 20000 : 5000; // bigger chunks with worker since noise is off-thread
  for (let ci = 0; ci < total; ci += CHUNK) {
    const end = Math.min(ci + CHUNK, total);
    const batch = coords.slice(ci, end);

    // Step 1: Classify terrain (worker if available, else inline)
    const results = await classifyBatchWithWorker(seed, batch, scale);

    // Step 2: Special terrain injection (main thread, needs generationRules)
    for (let ri = 0; ri < results.length; ri++) {
      const res = results[ri];
      let terrainId = res.terrain;
      const chance = generationRules.specialTerrainChance != null ? generationRules.specialTerrainChance : 0.05;
      if (rng() < chance) {
        const special = pickSpecialTerrain(rng);
        if (special) terrainId = special;
      }
      writeHexData(hexKey(res.q, res.r), { terrain: terrainId, elev: res.elev, moist: res.moist });
    }
    if (onProgress) onProgress(end, total);
    render();
    await new Promise(function(resolve) { requestAnimationFrame(resolve); });
  }
}

// A* pathfinding with terrain travel cost
// Binary min-heap for A* priority queue
function MinHeap() { this.heap = []; }
MinHeap.prototype.push = function(key, score) {
  this.heap.push({ key, score });
  let i = this.heap.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (this.heap[p].score <= this.heap[i].score) break;
    const tmp = this.heap[p]; this.heap[p] = this.heap[i]; this.heap[i] = tmp;
    i = p;
  }
};
MinHeap.prototype.pop = function() {
  if (this.heap.length === 0) return null;
  const top = this.heap[0];
  const last = this.heap.pop();
  if (this.heap.length > 0) {
    this.heap[0] = last;
    let i = 0, n = this.heap.length;
    while (true) {
      const left = (i << 1) + 1, right = left + 1;
      let smallest = i;
      if (left < n && this.heap[left].score < this.heap[smallest].score) smallest = left;
      if (right < n && this.heap[right].score < this.heap[smallest].score) smallest = right;
      if (smallest === i) break;
      const t = this.heap[i]; this.heap[i] = this.heap[smallest]; this.heap[smallest] = t;
      i = smallest;
    }
  }
  return top;
};
MinHeap.prototype.size = function() { return this.heap.length; };

// A* pathfinding with binary heap — fast even for large open sets
// Returns path array or null. Capped at maxSteps explored nodes.
function aStarPathfind(q1, r1, q2, r2, maxSteps) {
  if (q1 === q2 && r1 === r2) return [{ q: q1, r: r1 }];
  if (!maxSteps) maxSteps = 5000;
  const startKey = hexKey(q1, r1);
  const goalKey = hexKey(q2, r2);
  const allTerrains = getAllTerrains();
  const h = (q, r) => hexDistance(q, r, q2, r2);

  const openHeap = new MinHeap();
  openHeap.push(startKey, h(q1, r1));
  const cameFrom = {};
  const gScore = {}; gScore[startKey] = 0;
  const closedSet = new Set();
  let steps = 0;

  while (openHeap.size() > 0) {
    const entry = openHeap.pop();
    const current = entry.key;
    if (closedSet.has(current)) continue; // skip stale entries
    if (current === goalKey) {
      const path = [];
      let c = current;
      while (c) { const parts = c.split(','); path.unshift({ q: +parts[0], r: +parts[1] }); c = cameFrom[c]; }
      return path;
    }
    closedSet.add(current);
    steps++;
    if (steps > maxSteps) return null; // give up on very long paths

    const coords = current.split(','); const cq = +coords[0], cr = +coords[1];
    const nbrs = neighbors(cq, cr);
    for (let ni = 0; ni < nbrs.length; ni++) {
      const n = nbrs[ni];
      const nk = hexKey(n.q, n.r);
      if (closedSet.has(nk)) continue;
      const hData = getHex(n.q, n.r);
      const tInfo = hData.terrain ? allTerrains[hData.terrain] : null;
      const moveCost = tInfo ? tInfo.travel : 1;
      const waterPenalty = hData.terrain === 'water' ? 10 : 0;
      const riverPenalty = (generationRules.riverTravel > 0 && hasRiver(cq, cr, n.q, n.r)) ? generationRules.riverTravel : 0;
      const totalCost = moveCost + waterPenalty + riverPenalty;
      const tentativeG = gScore[current] + totalCost;
      if (gScore[nk] === undefined || tentativeG < gScore[nk]) {
        cameFrom[nk] = current;
        gScore[nk] = tentativeG;
        openHeap.push(nk, tentativeG + h(n.q, n.r));
      }
    }
  }
  return null;
}

// Rebuild settlementIndex from hexData (called after map load)
function rebuildSettlementIndex() {
  settlementIndex = [];
  for (const key of Object.keys(hexData)) {
    if (hexData[key] && hexData[key].settlement) {
      const [q, r] = key.split(',').map(Number);
      settlementIndex.push({ q, r });
    }
  }
}

// Score a hex for settlement placement
function rankSettlementLocation(q, r) {
  const h = getHex(q, r);
  if (!h.terrain) return -Infinity;
  if (h.terrain === 'water' || h.terrain === 'mountain') return -Infinity;

  let score = 0;
  if (h.terrain === 'plain') score += 10;
  else if (h.terrain === 'hill') score += 5;
  else if (h.terrain === 'forest') score += 4;
  else if (h.terrain === 'swamp' || h.terrain === 'desert') score -= 5;
  else if (h.terrain === 'snow') score -= 10;

  // Water proximity
  const nbrs = neighbors(q, r);
  for (const n of nbrs) {
    const nh = getHex(n.q, n.r);
    if (nh.terrain === 'water') score += 6;
    if (nh.terrain && (nh.terrain === 'temple' || nh.terrain === 'ruins')) score += 3;
  }

  // Penalty for mountains nearby
  for (const n of nbrs) {
    const nh = getHex(n.q, n.r);
    if (nh.terrain === 'mountain') score -= 4;
  }

  // Distance from other settlements — use fast settlementIndex instead of scanning all hexData
  for (const s of settlementIndex) {
    const dist = hexDistance(q, r, s.q, s.r);
    if (dist < 4) score -= (4 - dist) * 15;
    if (dist < 2) score -= 100; // way too close
  }

  return score;
}

// Place settlements using greedy scoring
function placeSettlements(count, _seed, centerQ, centerR, width, height) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);
  const rng = mulberry32(_seed + 2);
  const candidates = [];

  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      const key = hexKey(q, r);
      if (!hexData[key]) continue;
      const score = rankSettlementLocation(q, r);
      if (score > -Infinity) candidates.push({ q, r, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const placed = [];
  for (const cand of candidates) {
    if (placed.length >= count) break;
    let tooClose = false;
    for (const p of placed) {
      if (hexDistance(cand.q, cand.r, p.q, p.r) < 4) { tooClose = true; break; }
    }
    if (!tooClose) {
      const ratingMap = { 0: -3, 1: -2, 2: -1, 3: 0, 4: 1, 5: 2, 6: 3 };
      // Use the existing randomName function and generate rating based on d6
      // But we're deterministic so use rng() * 6;
      const d6 = Math.floor(rng() * 6 + 1);
      const rating = ratingMap[d6] || 0;
      const name = randomName();
      setHex(cand.q, cand.r, { settlement: { name, rating } });
      placed.push({ q: cand.q, r: cand.r });
    }
  }

  return placed;
}

// Build road network using A* + Minimum Spanning Tree (Kruskal's)
function buildRoadNetwork(settlements) {
  if (settlements.length < 2) return 0;

  // Compute A* path costs between all pairs (with distance cap for large maps)
  const n = settlements.length;
  const MAX_PAIR_DIST = 200;

  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = hexDistance(settlements[i].q, settlements[i].r, settlements[j].q, settlements[j].r);
      if (d > MAX_PAIR_DIST) continue; // skip very distant pairs
      const path = aStarPathfind(settlements[i].q, settlements[i].r, settlements[j].q, settlements[j].r, 5000);
      if (path) {
        edges.push({ i, j, cost: path.length, path });
      }
    }
  }

  // Union-find to track connectivity across all settlements
  const parent = []; for (let k = 0; k < n; k++) parent[k] = k;
  function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
  function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; }

  // Sort edges by cost for Kruskal-style MST
  edges.sort(function(a, b) { return a.cost - b.cost; });

  const mstEdges = [];
  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    if (find(e.i) !== find(e.j)) {
      union(e.i, e.j);
      mstEdges.push(e);
    }
  }

  let roadsBuilt = 0;
  for (let mi = 0; mi < mstEdges.length; mi++) {
    const p = mstEdges[mi].path;
    for (let k = 0; k < p.length - 1; k++) {
      addRoad(p[k].q, p[k].r, p[k + 1].q, p[k + 1].r);
      roadsBuilt++;
    }
  }
  return roadsBuilt;
}

// ======== River auto-generation ========
// Derives a river network from per-hex elevation (D8-style flow accumulation on
// the hex grid). Deterministic — driven purely by the seeded Perlin elev floats,
// no PRNG drift. Strictly downhill (each hex flows to a strictly lower neighbor)
// so the flow field is acyclic; rivers carve naturally as downstream cells
// accumulate upstream area.
function generateRivers(seed, centerQ, centerR, width, height) {
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // Clear existing auto rivers in this region only (one-click = fresh map).
  // Hand-drawn rivers outside the region are untouched.
  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      const h = getHex(q, r);
      if (h.rivers && h.rivers.length) removeAllRiverEdges(q, r);
    }
  }

  // Nodes = hexes that have stored elevation in the region
  const nodes = new Map();
  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      const h = getHex(q, r);
      if (typeof h.elev === 'number') nodes.set(hexKey(q, r), { q, r, elev: h.elev, flowTo: null, acc: 0 });
    }
  }

  // PASS 1: flow field — each hex drains to its lowest strictly-lower neighbor
  for (const [, me] of nodes) {
    let best = null, bestKey = null;
    const nbrs = neighbors(me.q, me.r);
    for (const nb of nbrs) {
      const nk = hexKey(nb.q, nb.r);
      const dn = nodes.get(nk);
      if (!dn) continue;
      if (dn.elev < me.elev && (best === null || dn.elev < best || (dn.elev === best && nk < bestKey))) {
        best = dn.elev; bestKey = nk; best = dn.elev;
      }
    }
    me.flowTo = bestKey;
  }

  // PASS 2: accumulation — process from highest to lowest (downstream is strictly
  // later than upstream because flow is strictly downhill), each node adds its
  // accumulated area to its downstream target.
  const sorted = [...nodes.values()];
  sorted.sort(function(a, b) { return b.elev - a.elev || (a.q - b.q) || (a.r - b.r); });
  for (const n of sorted) n.acc = 1;
  for (const n of sorted) {
    if (n.flowTo) {
      const dn = nodes.get(n.flowTo);
      if (dn) dn.acc += n.acc;
    }
  }

  // PASS 3: emit edges — one river edge per flow edge, width by downstream area.
  const streamThreshold = generationRules.streamThreshold != null ? generationRules.streamThreshold : 25;
  const riverThreshold = generationRules.riverThreshold != null ? generationRules.riverThreshold : 140;
  for (const n of sorted) {
    if (!n.flowTo) continue;
    const dn = nodes.get(n.flowTo);
    if (!dn) continue;
    if (dn.acc < streamThreshold) continue;
    const width = dn.acc >= riverThreshold ? 2 : 1;
    addRiver(n.q, n.r, dn.q, dn.r, width);
  }
}

// Sum the travel cost along a path (mirrors the aStar edge cost exactly, so
// riverTravel applies automatically). aStar returns only the path, not the sum.
function pathTravelCost(path) {
  if (!path || path.length < 2) return 0;
  const allTerrains = getAllTerrains();
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const hB = getHex(b.q, b.r);
    const tInfo = hB.terrain ? allTerrains[hB.terrain] : null;
    let c = tInfo ? tInfo.travel : 1;
    if (hB.terrain === 'water') c += 10;
    if (generationRules.riverTravel > 0 && hasRiver(a.q, a.r, b.q, b.r)) c += generationRules.riverTravel;
    cost += c;
  }
  return cost;
}

// Draw river edges on an arbitrary canvas context (used by PNG export).
// keys = array of "q,r" strings. Rivers drawn between the shared edge of hex
// pairs, each once (same ordering as roads).
function drawRiverEdgesOnContext(exportCtx, keys) {
  exportCtx.lineCap = 'round';
  exportCtx.lineJoin = 'round';
  for (const key of keys) {
    const h = hexData[key];
    if (!h.rivers || !h.rivers.length) continue;
    const [q1, r1] = key.split(',').map(Number);
    const p1 = hexToPixel(q1, r1);
    for (const rd of h.rivers) {
      if (rd.q > q1 || (rd.q === q1 && rd.r > r1)) {
        const p2 = hexToPixel(rd.q, rd.r);
        const seg = riverEdgeSegment(p1, null, p2);
        if (seg.length < 2) continue;
        const width = rd.width || 1;
        exportCtx.beginPath();
        exportCtx.strokeStyle = width >= 2 ? '#1f4fa0' : '#2f6fd0';
        exportCtx.lineWidth = width >= 2 ? 6 : 3;
        exportCtx.moveTo(seg[0].x, seg[0].y);
        exportCtx.lineTo(seg[1].x, seg[1].y);
        exportCtx.stroke();
      }
    }
  }
}

// One-click generate orchestrator (async)
async function oneClickGenerate(config) {
  if (isGenerating) return;
  isGenerating = true;
  setGenButtonsDisabled(true);

  const { seed, width, height, scale, settlementCount, buildRoads, pos } = config;

  let centerQ = 0, centerR = 0;
  if (pos === 'center' && selectedHex) {
    centerQ = selectedHex.q;
    centerR = selectedHex.r;
  }

  // Step 0: Randomly pick kingdoms for this map
  const newRegions = pickRandomKingdoms(seed, width, height);
  Object.keys(regions).forEach(function(k) { delete regions[k]; });
  Object.assign(regions, newRegions);
  regionOrder = Object.keys(newRegions);
  rebuildRegionPalette();

  const totalHexes = width * height;
  showProgress('🏗️', '生成地形中', 0, totalHexes);

  beginBatch();

  // Step 1: Generate terrain (async chunked for large maps)
  await generateTerrainRegionAsync(seed, centerQ, centerR, width, height, scale,
    function(done, total) { showProgress('🏗️', '生成地形中', done, total); }
  );

  // Step 1.5: Assign kingdoms (Voronoi tessellation from random centers)
  showProgress('👑', '分配王国边境...', 0, 1);
  await new Promise(function(resolve) { setTimeout(resolve, 20); });
  assignRegions(seed, centerQ, centerR, width, height);
  render();

  // Step 1.6: Derive rivers from elevation (one-click = fresh map, so clear any
  // auto rivers already in THIS region only — hand-drawn rivers elsewhere are kept)
  if (generationRules.generateRivers) {
    showProgress('🌊', '生成河流...', 0, 1);
    await new Promise(function(resolve) { setTimeout(resolve, 20); });
    generateRivers(seed, centerQ, centerR, width, height);
    render();
  }

  showProgress('🏘️', '放置定居点...', 0, 1);

  // Step 2: Place settlements (fast enough to run sync, but yield for UI)
  await new Promise(function(resolve) { setTimeout(resolve, 20); });
  const settlements = placeSettlements(settlementCount, seed + 1, centerQ, centerR, width, height);
  render();

  if (buildRoads && settlements.length >= 2) {
    showProgress('🛤️', '修建道路...', 0, 1);

    // Step 3: Build roads
    await new Promise(function(resolve) { setTimeout(resolve, 20); });
    buildRoadNetwork(settlements);
    render();
  }

  endBatch();

  const stats = Object.keys(hexData).length;
  showStepResult('✅', '生成完成！', stats + ' 格 · ' + settlements.length + ' 定居点');
  isGenerating = false;
  setGenButtonsDisabled(false);
  updateInfo();
}

// Event bindings — One-click modal
document.getElementById('btn-oneclick-gen').addEventListener('click', () => {
  document.getElementById('oc-seed').value = Math.floor(Math.random() * 99999) + 1;
  document.getElementById('oneclick-modal').style.display = 'block';
});

// Slider live values + two-way sync with number inputs
function ocSetWidth(val) {
  val = Math.max(10, Math.min(600, parseInt(val) || 30));
  document.getElementById('oc-width').value = Math.min(val, 100);
  document.getElementById('oc-width-num').value = val;
  document.getElementById('oc-width-val').textContent = val;
  document.getElementById('oc-size-warning').style.display = (val * (parseInt(document.getElementById('oc-height-num').value) || 30) > 8000) ? 'block' : 'none';
}
function ocSetHeight(val) {
  val = Math.max(10, Math.min(600, parseInt(val) || 30));
  document.getElementById('oc-height').value = Math.min(val, 100);
  document.getElementById('oc-height-num').value = val;
  document.getElementById('oc-height-val').textContent = val;
  document.getElementById('oc-size-warning').style.display = ((parseInt(document.getElementById('oc-width-num').value) || 30) * val > 8000) ? 'block' : 'none';
}

['oc-scale', 'oc-settle'].forEach(function(id) {
  const input = document.getElementById(id);
  const valSpan = document.getElementById(id + '-val');
  if (input && valSpan) {
    input.addEventListener('input', function() {
      if (id === 'oc-scale') valSpan.textContent = (input.value / 10).toFixed(1);
      else valSpan.textContent = input.value;
    });
  }
});

document.getElementById('oc-width').addEventListener('input', function() {
  ocSetWidth(this.value);
});
document.getElementById('oc-width-num').addEventListener('input', function() {
  ocSetWidth(this.value);
});
document.getElementById('oc-height').addEventListener('input', function() {
  ocSetHeight(this.value);
});
document.getElementById('oc-height-num').addEventListener('input', function() {
  ocSetHeight(this.value);
});

// Preset buttons
document.querySelectorAll('.oc-preset').forEach(function(btn) {
  btn.addEventListener('click', function() {
    ocSetWidth(this.dataset.w);
    ocSetHeight(this.dataset.h);
  });
});

document.getElementById('oc-random-seed').addEventListener('click', () => {
  document.getElementById('oc-seed').value = Math.floor(Math.random() * 99999) + 1;
});

document.getElementById('oc-btn-cancel').addEventListener('click', () => {
  document.getElementById('oneclick-modal').style.display = 'none';
});

document.getElementById('oc-btn-confirm').addEventListener('click', function() {
  const seed = parseInt(document.getElementById('oc-seed').value) || Date.now();
  const width = parseInt(document.getElementById('oc-width-num').value) || parseInt(document.getElementById('oc-width').value);
  const height = parseInt(document.getElementById('oc-height-num').value) || parseInt(document.getElementById('oc-height').value);
  const scale = parseInt(document.getElementById('oc-scale').value) / 10;
  const settlementCount = parseInt(document.getElementById('oc-settle').value);
  const buildRoads = document.getElementById('oc-build-roads').checked;
  const pos = document.getElementById('oc-position').value;

  document.getElementById('oneclick-modal').style.display = 'none';

  oneClickGenerate({ seed: seed, width: width, height: height, scale: scale, settlementCount: settlementCount, buildRoads: buildRoads, pos: pos });
});

// Click background to close
document.getElementById('oneclick-modal').addEventListener('click', function(e) {
  if (e.target === e.currentTarget) this.style.display = 'none';
});

// Road detection
document.getElementById('btn-gen-road').addEventListener('click', () => {
  if (isGenerating) return;
  if (!selectedHex) { showDiceResult('⚠️', '请先选中一个定居点六角格'); return; }
  const h = getHex(selectedHex.q, selectedHex.r);
  if (!h.settlement) { showDiceResult('⚠️', '当前六角格没有定居点'); return; }
  isGenerating = true;
  setGenButtonsDisabled(true);

  animateDiceRoll('3d6', 700, (result) => {
    // Find nearby settlements — each compared with independent 3d6 roll
    let roadsBuilt = 0;
    let checked = 0;
    beginBatch();
    for (const [key, data] of Object.entries(hexData)) {
      if (!data.settlement) continue;
      const [oq, or] = key.split(',').map(Number);
      if (oq === selectedHex.q && or === selectedHex.r) continue;
      checked++;
      const dist = hexDistance(selectedHex.q, selectedHex.r, oq, or);
      // Each settlement rolls its own 3d6
      const roll3d6 = Math.floor(Math.random() * 6) + 1
                    + Math.floor(Math.random() * 6) + 1
                    + Math.floor(Math.random() * 6) + 1;
      if (roll3d6 > dist) {
        // Find a path along adjacent hexes and build roads segment by segment
        const path = hexPathfind(selectedHex.q, selectedHex.r, oq, or);
        if (path && path.length > 1) {
          for (let i = 0; i < path.length - 1; i++) {
            addRoad(path[i].q, path[i].r, path[i + 1].q, path[i + 1].r);
          }
          roadsBuilt++;
        }
      }
    }
    endBatch();
    showStepResult('🛤️', `3d6投完`, `检查了${checked}个定居点`, roadsBuilt > 0 ? `发现 ${roadsBuilt} 条道路连接` : '未发现道路');
    render();
    isGenerating = false;
    setGenButtonsDisabled(false);
  });
});

function hexDistance(q1, r1, q2, r2) {
  // Convert to cube
  const x1 = q1, z1 = r1 - (q1 - (q1 & 1)) / 2, y1 = -x1 - z1;
  const x2 = q2, z2 = r2 - (q2 - (q2 & 1)) / 2, y2 = -x2 - z2;
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2), Math.abs(z1 - z2));
}

// Compass direction from one hex to another (odd-r flat-top, x→E, y→N).
function measureDirection(q1, r1, q2, r2) {
  const p1 = hexToPixel(q1, r1);
  const p2 = hexToPixel(q2, r2);
  const dx = p2.x - p1.x, dy = p1.y - p2.y; // screen-y is down, so N is -y
  const ang = Math.atan2(dx, dy) * 180 / Math.PI; // 0 = N, + = E
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  let i = Math.round(ang / 45);
  if (i < 0) i += 8;
  if (i === 8) i = 0;
  return dirs[i];
}

// Assign kingdoms (regions) to hexes using Voronoi tessellation
function assignRegions(seed, centerQ, centerR, width, height) {
  const regionIds = regionOrder || Object.keys(regions);
  if (regionIds.length === 0) return;

  const rng = mulberry32(seed + 999);
  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // Generate random center points for each region
  const centers = [];
  for (let ri = 0; ri < regionIds.length; ri++) {
    let cq, cr, retries = 0;
    do {
      cq = centerQ + Math.floor(rng() * width - halfW);
      cr = centerR + Math.floor(rng() * height - halfH);
      retries++;
    } while (retries < 5 && getHex(cq, cr).terrain === 'water');
    centers.push({ q: cq, r: cr, id: regionIds[ri] });
  }

  // Assign each hex to its nearest region center (skip water)
  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      const key = hexKey(q, r);
      const h = getHex(q, r);
      if (!h.terrain || h.terrain === 'water') continue;
      let bestDist = Infinity, bestId = null;
      for (let ci = 0; ci < centers.length; ci++) {
        const d = hexDistance(q, r, centers[ci].q, centers[ci].r);
        if (d < bestDist) { bestDist = d; bestId = centers[ci].id; }
      }
      writeHexData(key, { region: bestId });
    }
  }
}

// Pick random kingdoms from the template pool based on map size
function pickRandomKingdoms(seed, mapWidth, mapHeight) {
  const total = mapWidth * mapHeight;
  let count;
  if (total < 400) count = 3 + (seed % 2);       // <20×20: 3~4
  else if (total < 1600) count = 4 + (seed % 3); // 20~40: 4~6
  else count = 5 + (seed % 3);                   // >40: 5~7

  const rng = mulberry32(seed + 888);
  const pool = REGION_TEMPLATES.slice(); // copy
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  const picked = pool.slice(0, Math.min(count, pool.length));
  const result = {};
  picked.forEach(function(t) { result[t.id] = { name: t.name, color: t.color, icon: t.icon }; });
  return result;
}

// Undo/Redo buttons
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// Save/Load
// gzip helpers for save/load
function gzipSupported() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function gzipCompress(str) {
  const blob = new Blob([str]);
  const compressed = blob.stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(compressed).blob();
}

async function gzipDecompress(blob) {
  const decompressed = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressed).text();
}

document.getElementById('btn-save').addEventListener('click', async function() {
  cleanHexData();
  const hexCount = Object.keys(hexData).length;
  showProgress('💾', '保存中...', 0, 1);
  await new Promise(function(resolve) { setTimeout(resolve, 20); });

  const ex = buildImageRegistry(hexData, customTerrains);
  const data = { hexData: ex.exportHex, imageRegistry: ex.registry, viewX, viewY, zoom, customTerrains: ex.exportCT, deletedTerrains, terrainOrder, generationRules, regions, regionOrder };
  const json = JSON.stringify(data);

  let blob;
  let ext;
  if (gzipSupported()) {
    blob = await gzipCompress(json);
    ext = '.hexmap';
  } else {
    blob = new Blob([json], { type: 'application/json' });
    ext = '.json';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hexmap_' + new Date().toISOString().slice(0,10) + ext;
  a.click();
  URL.revokeObjectURL(url);

  const sizeMB = (blob.size / 1024 / 1024).toFixed(2);
  showDiceResult('💾 已保存', hexCount + ' 格 · ' + sizeMB + ' MB' + (ext === '.hexmap' ? ' (gzip)' : ''));
});

document.getElementById('btn-load').addEventListener('click', function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.hexmap';
  input.onchange = async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showProgress('📂', '加载中...', 0, 1);

      let text;
      // Check for gzip magic bytes (1f 8b)
      const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
      if (header[0] === 0x1F && header[1] === 0x8B) {
        // gzip compressed
        text = await gzipDecompress(file);
      } else {
        // plain JSON (backward compat)
        text = await file.text();
      }

      const data = JSON.parse(text);
      if (data.imageRegistry) {
        const resolved = resolveImageRegistry(data.hexData || {}, data.customTerrains || {}, data.imageRegistry);
        hexData = resolved.resultHex;
        customTerrains = resolved.resultCT;
      } else {
        hexData = data.hexData || {};
        if (data.customTerrains) customTerrains = data.customTerrains;
      }
      rebuildSettlementIndex();
      undoStack = []; redoStack = []; updateUndoButtons();
      viewX = data.viewX || 0;
      viewY = data.viewY || 0;
      zoom = data.zoom || 1;
      if (data.customTerrains) customTerrains = data.customTerrains;
      if (data.deletedTerrains) deletedTerrains = data.deletedTerrains;
      if (data.terrainOrder) terrainOrder = data.terrainOrder;
      if (data.generationRules) generationRules = { ...DEFAULT_GEN_RULES, ...data.generationRules };
      if (data.regions) regions = data.regions;
      if (data.regionOrder) regionOrder = data.regionOrder;
      rebuildRegionPalette();
      saveTerrainConfig();
      rebuildTerrainPalette();
      document.getElementById('zoom-indicator').textContent = '🔍 ' + Math.round(zoom * 100) + '%';
      render();
      updateInfo();
      showDiceResult('📂 已加载', '共 ' + Object.keys(hexData).length + ' 个六角格');
    } catch(err) {
      showDiceResult('⚠️ 加载失败', '文件格式错误');
      console.error(err);
    }
  };
  input.click();
});

// Export PNG
document.getElementById('btn-export-img').addEventListener('click', () => {
  cleanHexData();
  const keys = Object.keys(hexData);
  if (keys.length === 0) { showDiceResult('⚠️', '没有数据可导出'); return; }
  // Compute bounding box
  let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
  keys.forEach(k => {
    const [q, r] = k.split(',').map(Number);
    if (q < minQ) minQ = q;
    if (q > maxQ) maxQ = q;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  });
  const topLeft = hexToPixel(minQ, minR);
  const botRight = hexToPixel(maxQ, maxR);
  const size = HEX_SIZE;
  const padding = size * 2;
  let w = Math.ceil(botRight.x - topLeft.x + size * 2 + padding * 2);
  let h = Math.ceil(botRight.y - topLeft.y + size * 1.5 + padding * 2);
  const MAX_DIM = 8000;
  let exportScale = 1;
  let scaleNote = '';
  if (w > MAX_DIM || h > MAX_DIM) {
    exportScale = MAX_DIM / Math.max(w, h);
    w = Math.ceil(w * exportScale);
    h = Math.ceil(h * exportScale);
    scaleNote = ' (已缩放至 ' + Math.round(exportScale * 100) + '%)';
  }
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = Math.max(w, 640);
  exportCanvas.height = Math.max(h, 480);
  const exportCtx = exportCanvas.getContext('2d');
  exportCtx.fillStyle = '#2d2d44';
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.save();
  const offsetX = (exportCanvas.width / exportScale - (botRight.x - topLeft.x + size * 2 + padding * 2)) / 2 - topLeft.x + padding;
  const offsetY = (exportCanvas.height / exportScale - (botRight.y - topLeft.y + size * 1.5 + padding * 2)) / 2 - topLeft.y + padding;
  exportCtx.translate(offsetX * exportScale, offsetY * exportScale);
  exportCtx.scale(exportScale, exportScale);
  const allTerrains = getAllTerrains();
  // Export ignores coordinate labels and always keeps the grid (as before), so
  // pin those globals for the duration of this render and restore afterward.
  const _prevGrid = showGrid, _prevCoords = showCoords;
  showGrid = true; showCoords = false;
  // Draw hex fills + grid (Pass 1) — reused from render.js so live view and PNG
  // export stay pixel-identical.
  for (const key of keys) {
    const [q, r] = key.split(',').map(Number);
    drawHexBase(exportCtx, q, r, hexData[key], allTerrains);
  }
  // Region borders (shared function)
  drawRegionBorders(exportCtx, minQ - 1, maxQ + 1, minR - 1, maxR + 1, (q, r) => hexData[hexKey(q, r)] || { region: null });
  // Rivers (Pass 2.5, under roads)
  drawRiverEdgesOnContext(exportCtx, keys);
  // Draw roads (Pass 2)
  exportCtx.strokeStyle = '#8B4513';
  exportCtx.lineWidth = 3;
  for (const key of keys) {
    const h = hexData[key];
    if (h.roads && h.roads.length) {
      const [q1, r1] = key.split(',').map(Number);
      const p1 = hexToPixel(q1, r1);
      for (const rd of h.roads) {
        if (rd.q > q1 || (rd.q === q1 && rd.r > r1)) {
          const p2 = hexToPixel(rd.q, rd.r);
          exportCtx.beginPath();
          exportCtx.moveTo(p1.x, p1.y);
          exportCtx.lineTo(p2.x, p2.y);
          exportCtx.stroke();
        }
      }
    }
  }
  // Draw overlays (Pass 3) — icons, labels, settlements; reused from render.js
  for (const key of keys) {
    const [q, r] = key.split(',').map(Number);
    drawHexOverlay(exportCtx, q, r, hexData[key]);
  }
  // Region names (Pass 3.5)
  drawRegionNames(exportCtx);
  exportCtx.restore();
  showGrid = _prevGrid; showCoords = _prevCoords;
  const link = document.createElement("a");
  link.download = "hexmap_" + new Date().toISOString().slice(0,10) + ".png";
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
  showDiceResult("🖼️ 已导出", exportCanvas.width + "x" + exportCanvas.height + " (" + keys.length + " 格)" + scaleNote);
});

// Clear
document.getElementById('btn-clear').addEventListener('click', () => {
  if (!confirm('⚠️ 确认清空所有六角格数据？')) return;
  beginBatch();
  for (const key of Object.keys(hexData)) pushUndo(key);
  hexData = {};
  endBatch();
  selectedHex = null;
  roadStart = null;
  render();
  updateInfo();
  showDiceResult('🗑️ 已清空', '');
});

// Fit-to-content button
document.getElementById('btn-fit').addEventListener('click', fitToContent);

// Grid/Coords/Lock toggles
document.getElementById('chk-grid').addEventListener('change', (e) => { showGrid = e.target.checked; render(); });
document.getElementById('chk-coords').addEventListener('change', (e) => { showCoords = e.target.checked; render(); });
document.getElementById('chk-minimap').addEventListener('change', () => render());
document.getElementById('chk-lock').addEventListener('change', (e) => { isLocked = e.target.checked; });
document.getElementById('chk-terrain').addEventListener('change', (e) => { showTerrainLayer = e.target.checked; render(); });
document.getElementById('chk-region-layer').addEventListener('change', (e) => { showRegionLayer = e.target.checked; render(); });
document.getElementById('chk-elevation').addEventListener('change', (e) => { showElevationLayer = e.target.checked; render(); });
document.getElementById('chk-icon-style').addEventListener('change', (e) => {
  iconStyle = e.target.checked ? 'vector' : 'emoji';
  try { localStorage.setItem('hexmap_iconStyle', iconStyle); } catch(err) {}
  render();
  rebuildTerrainPalette();
  const statsModal = document.getElementById('stats-modal');
  if (statsModal && statsModal.style.display !== 'none') openStatsModal();
});

// Manage regions button
document.getElementById('btn-manage-regions').addEventListener('click', openRegionEditor);

// Info panel
function updateInfo() {
  const panel = document.getElementById('info-panel');
  if (!selectedHex) {
    panel.innerHTML = '<div class="row"><span class="label">💡 选工具 → 看上方提示 → 点六角格操作</span></div>';
    return;
  }
  const { q, r } = selectedHex;
  const h = getHex(q, r);
  const hInfoTI = h.terrain ? getAllTerrains()[h.terrain] : null;
  const t = h.terrain ? `${hInfoTI?.icon || ''} ${hInfoTI?.name || h.terrain}` : '未探索';
  const settle = h.settlement ? `${h.settlement.name} (${h.settlement.rating >= 0 ? '+' : ''}${h.settlement.rating})` : '—';
  const regionInfo = h.region && regions[h.region] ? `${regions[h.region].icon} ${regions[h.region].name}` : '—';
  const roads = h.roads?.length || 0;
  const elevInfo = typeof h.elev === 'number' ? h.elev.toFixed(2) : '—';
  const rivers = h.rivers?.length || 0;
  const nbrs = neighbors(q, r);
  const annInfo = h.annotations && h.annotations.length ?
    h.annotations.map(a => {
      const t = ANNOTATION_TYPES[a.type] || ANNOTATION_TYPES.note;
      return (a.visible ? '' : '🙈') + t.icon + ' ' + escHtml(a.text);
    }).join('<br>') : '—';
  panel.innerHTML = `<div class="row">
    <span><span class="label">坐标:</span> <span class="val">(${q}, ${r})</span></span>
    <span><span class="label">地形:</span> <span class="val">${t}</span></span>
    <span><span class="label">海拔:</span> <span class="val">${elevInfo}</span></span>
    <span><span class="label">定居点:</span> <span class="val">${settle}</span></span>
    <span><span class="label">王国:</span> <span class="val">${regionInfo}</span></span>
    <span><span class="label">快捷标签:</span> <span class="val">${h.label || '—'}</span></span>
    <span><span class="label">道路:</span> <span class="val">${roads} 条连接</span></span>
    <span><span class="label">河流:</span> <span class="val">${rivers} 条边</span></span>
    <span><span class="label">标注 (${h.annotations ? h.annotations.length : 0}条):</span> <span class="val" style="font-size:11px;">${annInfo}</span></span>
  </div>`;
}

