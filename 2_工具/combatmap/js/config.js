//  Configuration
// ============================================================
const COMBATMAP_VERSION = 'v0.101';

// 云端持久化后端（combatmap 会 fetch 这里的 /api/map/<id> 保存/加载整张地图）。
// 默认走 chmweb 主站后端；可通过 URL `?apibase=` 覆盖（本地调试）。
const MAP_API_BASE = 'https://chmweb.cn';

// 单位类型 → 环颜色（画布 token 渲染 / 单位库角标统一使用）
const TOKEN_KIND_COLORS = {
  player: '#4caf50',   // 玩家绿
  enemy:  '#e53935',   // 敌人红
  npc:    '#42a5f5',   // NPC 蓝
  ally:   '#ffb300',   // 盟友金
};

const COMBAT_TERRAIN = {
  floor:        { name: '普通地面', color: '#d4c5a9', icon: '⬜', desc: '正常移动' },
  wall_cell:    { name: '墙壁(填充)', color: '#4a4a4a', icon: '🧱', desc: '不可通行' },
  difficult:    { name: '困难地形', color: '#8b6914', icon: '🔸', desc: '移动×2' },
  water:        { name: '水域', color: '#4a90d9', icon: '🌊', desc: '游泳检定' },
  elevated:     { name: '高台/高地', color: '#c9a84c', icon: '📶', desc: '远程优势' },
  cover_half:   { name: '半身掩体', color: '#7a9a5a', icon: '🛡️', desc: 'AC+2' },
  cover_full:   { name: '四分之三掩护', color: '#5a7a3a', icon: '🛡️', desc: 'AC+5' },
  hazard_fire:  { name: '火焰', color: '#d94a4a', icon: '🔥', desc: '火焰伤害' },
  hazard_acid:  { name: '酸液', color: '#4ad94a', icon: '🧪', desc: '强酸伤害' },
  hazard_spike: { name: '尖刺', color: '#a0a0a0', icon: '📌', desc: '穿刺伤害' },
  door_cell:    { name: '门(填充)', color: '#8b5a2b', icon: '🚪', desc: '可开关' },
  stairs:       { name: '楼梯', color: '#a09080', icon: '🪜', desc: '层级连接' },
  pit:          { name: '深渊/陷坑', color: '#1a1a1a', icon: '🕳️', desc: '坠落伤害' },
};

// 扩展图例库（常用 DM 图例，可在"⚙️ 管理"中删除或修改属性）
const EXTRA_TERRAIN = {
  trap:         { name: '陷阱', color: '#8b3a3a', icon: '⚔️', desc: '陷阱' },
  altar:        { name: '祭坛', color: '#7a5a9e', icon: '🛐', desc: '祭坛' },
  chest:        { name: '宝箱', color: '#c9a84c', icon: '🧰', desc: '宝箱' },
  portal:       { name: '传送门', color: '#6a3a9e', icon: '🌀', desc: '传送' },
  campfire:     { name: '篝火', color: '#e07a3a', icon: '🏕️', desc: '休息点' },
  ice:          { name: '冰面', color: '#9ad4f0', icon: '🧊', desc: '滑行/困难' },
  lava:         { name: '岩浆', color: '#e05020', icon: '🌋', desc: '火焰伤害' },
  grass:        { name: '草丛', color: '#5a9a3a', icon: '🌿', desc: '潜行掩体' },
  rubble:       { name: '碎石', color: '#8a8a8a', icon: '🪨', desc: '困难地形' },
  web:          { name: '蛛网', color: '#c0c0d0', icon: '🕸️', desc: '被困检定' },
  poison:       { name: '毒雾', color: '#4ad95a', icon: '☠️', desc: '毒素伤害' },
  shrine:       { name: '神殿', color: '#d4c56a', icon: '⛪', desc: '祝福' },
  throne:       { name: '王座', color: '#9e6a3a', icon: '👑', desc: '首领区域' },
  teleport:     { name: '传送点', color: '#3a9ed9', icon: '🔮', desc: '传送' },
  fog:          { name: '浓雾', color: '#a0a8b0', icon: '🌫️', desc: '遮蔽视线' },
  darkness:     { name: '黑暗', color: '#2a2a3a', icon: '🌑', desc: '黑暗区域' },
  barricade:    { name: '路障', color: '#6a5a4a', icon: '🪵', desc: '掩体/阻挡' },
  crop:         { name: '田地', color: '#c9b46a', icon: '🌾', desc: '田野' },
};

// ============================================================
