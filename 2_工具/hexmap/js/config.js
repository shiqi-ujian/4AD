// ======== Configuration ========
const TERRAIN = {
  plain:     { name: '平原', color: '#7ec850', icon: '⬟', travel: 1 },
  forest:    { name: '森林', color: '#2d6a2e', icon: '🌲', travel: 1 },
  hill:      { name: '丘陵', color: '#8b7a3a', icon: '⛰️', travel: 1 },
  mountain:  { name: '山地', color: '#6b5b4f', icon: '🏔️', travel: 2 },
  abyss:     { name: '深渊', color: '#3d1f2e', icon: '🕳️', travel: 2 },
  necromantic:{name: '死灵之地', color: '#4a2c5a', icon: '💀', travel: 1 },
  ruins:     { name: '废墟', color: '#7a5a3a', icon: '🏚️', travel: 1 },
  temple:    { name: '神庙', color: '#c9a84c', icon: '🛕', travel: 1 },
  water:     { name: '水域', color: '#3a7abd', icon: '🌊', travel: 3 },
  desert:    { name: '沙漠', color: '#d4b872', icon: '🏜️', travel: 2 },
  swamp:     { name: '沼泽', color: '#5a7a4a', icon: '🌿', travel: 2 },
  snow:      { name: '雪地', color: '#c8d8e8', icon: '❄️', travel: 2 },
};
const TERRAIN_LIST = Object.keys(TERRAIN);

// ======== Custom Terrain & Generation Rules Storage ========
let customTerrains = {};      // key: terrainId → { name, color, icon, travel } (overrides or new)
let deletedTerrains = {};     // key: terrainId → true (mark built-in as deleted)
let terrainOrder = null;      // array of terrain IDs in display order, null = default

// Default generation rules
const DEFAULT_GEN_RULES = {
  d6Threshold: 6,
  defaultTerrain: 'plain',
  specialTerrainChance: 0.05, // probability of injecting a special terrain per hex
  specialTable: [
    { terrainId: 'forest', weight: 3 },
    { terrainId: 'hill', weight: 2 },
    { terrainId: 'mountain', weight: 2 },
    { terrainId: 'necromantic', weight: 1 },
    { terrainId: 'temple', weight: 1 },
    { terrainId: 'abyss', weight: 1 },
    { terrainId: 'ruins', weight: 1 },
    { terrainId: 'plain', weight: 1 },
  ],
  // --- Rivers ---
  generateRivers: true,          // auto-derive river network from elevation on one-click gen
  streamThreshold: 25,           // accumulation needed for a stream (width 1) to appear
  riverThreshold: 140,           // accumulation needed for a river (width 2) to appear
  riverTravel: 0,                // extra movement cost to cross a river edge (0 = no game-rule effect)
};

// Pick a terrain from specialTable by weight (for noise-based generation)
function pickSpecialTerrain(rng) {
  var entries = generationRules.specialTable.filter(function(e) { return getAllTerrains()[e.terrainId]; });
  if (entries.length === 0) return null;
  var totalWeight = 0;
  for (var i = 0; i < entries.length; i++) totalWeight += entries[i].weight;
  var roll = rng() * totalWeight;
  for (var i = 0; i < entries.length; i++) {
    roll -= entries[i].weight;
    if (roll <= 0) return entries[i].terrainId;
  }
  return entries[0].terrainId;
}
let generationRules = JSON.parse(JSON.stringify(DEFAULT_GEN_RULES));

function getAllTerrainIds() {
  let ids = terrainOrder ? [...terrainOrder] : [...TERRAIN_LIST];
  // Add custom terrains not already in list
  for (const id of Object.keys(customTerrains)) {
    if (!ids.includes(id)) ids.push(id);
  }
  // Remove deleted
  ids = ids.filter(id => !deletedTerrains[id]);
  return ids;
}

function getAllTerrains() {
  const result = {};
  // Built-in
  for (const [id, t] of Object.entries(TERRAIN)) {
    if (!deletedTerrains[id]) {
      result[id] = { ...t };
    }
  }
  // Custom overrides
  for (const [id, t] of Object.entries(customTerrains)) {
    result[id] = { ...t };
  }
  return result;
}

function getTerrainInfo(id) {
  if (customTerrains[id]) return customTerrains[id];
  if (!deletedTerrains[id] && TERRAIN[id]) return TERRAIN[id];
  return null;
}

// localStorage persistence
function saveTerrainConfig() {
  try {
    localStorage.setItem('hexmap_terrainConfig', JSON.stringify({
      customTerrains, deletedTerrains, terrainOrder, generationRules
    }));
  } catch(e) { /* ignore quota errors */ }
}

function loadTerrainConfig() {
  try {
    const raw = localStorage.getItem('hexmap_terrainConfig');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.customTerrains) customTerrains = data.customTerrains;
      if (data.deletedTerrains) deletedTerrains = data.deletedTerrains;
      if (data.terrainOrder) terrainOrder = data.terrainOrder;
      if (data.generationRules) generationRules = { ...DEFAULT_GEN_RULES, ...data.generationRules };
    }
  } catch(e) { /* ignore */ }
}

function resetAllTerrains() {
  customTerrains = {};
  deletedTerrains = {};
  terrainOrder = null;
  generationRules = JSON.parse(JSON.stringify(DEFAULT_GEN_RULES));
  saveTerrainConfig();
}

// ======== Dynamic Terrain Palette ========
function rebuildTerrainPalette() {
  const palette = document.getElementById('terrain-palette');
  if (!palette) return;
  palette.innerHTML = '';
  const ids = getAllTerrainIds();
  const allTerrains = getAllTerrains();
  ids.forEach(id => {
    const t = allTerrains[id];
    if (!t) return;
    const btn = document.createElement('button');
    btn.className = 'tool-btn' + (id === selectedTerrain ? ' active' : '');
    btn.dataset.terrain = id;
    btn.title = t.name;
    const textColor = isLightColor(t.color) ? '#333' : '#fff';
    btn.style.cssText = `background:${t.color};color:${textColor};text-shadow:${textColor === '#fff' ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'}`;
    btn.innerHTML = `<span class="icon">${t.icon}</span><span class="label">${t.name}</span>`;
    btn.addEventListener('click', () => {
      selectedTerrain = id;
      document.querySelectorAll('.tool-btn[data-terrain]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (selectedTool !== 'paint') setTool('paint');
      else document.getElementById('coord-indicator').textContent = `🖌️ ${t.name} 笔刷`;
    });
    palette.appendChild(btn);
  });
}

function isLightColor(hex) {
  const c = hex.replace('#','');
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
