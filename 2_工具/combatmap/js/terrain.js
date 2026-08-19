//  Custom Terrain System (localStorage 持久化)
// ============================================================
const LS_TERRAIN_KEY = 'combatmap_custom_terrains_v2';
let customTerrains = {};
let terrainOverrides = {};   // 对内置/扩展地形属性的覆盖 { id: {name,icon,color,desc} }

function loadCustomTerrains() {
  try {
    const raw = localStorage.getItem(LS_TERRAIN_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    customTerrains = data.custom || {};
    terrainOverrides = data.overrides || {};
  } catch (e) { /* ignore */ }
}
function saveCustomTerrains() {
  try {
    localStorage.setItem(LS_TERRAIN_KEY, JSON.stringify({ custom: customTerrains, overrides: terrainOverrides }));
  } catch (e) { /* ignore */ }
}
function getAllTerrains() {
  const merged = {};
  Object.keys(COMBAT_TERRAIN).forEach(id => {
    merged[id] = { ...COMBAT_TERRAIN[id], ...(terrainOverrides[id] || {}), id };
  });
  Object.keys(EXTRA_TERRAIN).forEach(id => {
    merged[id] = { ...EXTRA_TERRAIN[id], ...(terrainOverrides[id] || {}), id };
  });
  Object.keys(customTerrains).forEach(id => {
    merged[id] = { ...customTerrains[id], id };
  });
  return merged;
}
const ALL_TERRAIN_CACHE = {};
let allTerrains = getAllTerrains();
function refreshTerrains() { allTerrains = getAllTerrains(); }
function getTerrain(id) { return allTerrains[id] || null; }
function getTerrainList() { return Object.keys(allTerrains); }
loadCustomTerrains();
refreshTerrains();

// ============================================================
