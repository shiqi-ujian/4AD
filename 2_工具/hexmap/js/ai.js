// ======== AI 绘图 ========
// --- Settings persistence ---
function loadAISettings() {
  try {
    const raw = localStorage.getItem('ai_draw_settings');
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return {
    provider: 'openai',
    apiKey: '',
    endpoint: '',
    model: ''
  };
}
function saveAISettings(settings) {
  localStorage.setItem('ai_draw_settings', JSON.stringify(settings));
  // Also sync UI
  const keyInput = document.getElementById('ai-api-key');
  if (keyInput) keyInput.value = settings.apiKey || '';
}
// --- Map context ---
function getScopeHexes(scope) {
  const keys = Object.keys(hexData);
  if (scope === 'all') return keys;
  if (scope === 'selected') {
    // Use box-selected hexes (selectedHexes Set) or single selected hex
    if (selectedHexes.size > 0) return [...selectedHexes];
    if (selectedHex) return [hexKey(selectedHex.q, selectedHex.r)];
    return [];
  }
  if (scope === 'view') {
    // Convert viewport corners to hex coordinates
    const topLeft = pixelToHex(-viewX / zoom, -viewY / zoom);
    const botRight = pixelToHex((canvas.width - viewX) / zoom, (canvas.height - viewY) / zoom);
    const result = [];
    for (let q = Math.floor(topLeft.q) - 1; q <= Math.ceil(botRight.q) + 1; q++) {
      for (let r = Math.floor(topLeft.r) - 1; r <= Math.ceil(botRight.r) + 1; r++) {
        const k = hexKey(q, r);
        if (hexData[k]) result.push(k);
      }
    }
    return result;
  }
  return [];
}
function getMapContext(scope) {
  const hexes = getScopeHexes(scope);
  const allTerrains = getAllTerrains?.() || {};
  // Collect unique terrain IDs and their names
  const terrainMap = {};
  for (const [id, info] of Object.entries(allTerrains)) {
    terrainMap[id] = info.name || id;
  }
  const hexList = hexes.map(k => {
    const [q, r] = k.split(',').map(Number);
    const h = hexData[k];
    if (!h) return null;
    const entry = { q, r, terrain: h.terrain || null };
    if (h.label) entry.label = h.label;
    if (h.settlement) entry.settlement = { name: h.settlement.name, rating: h.settlement.rating };
    if (h.roads && h.roads.length) entry.roads = h.roads;
    return entry;
  }).filter(Boolean);
  return {
    hexCount: hexList.length,
    terrains: terrainMap,
    hexes: hexList,
    scope
  };
}
// --- System prompt ---
function buildSystemPrompt() {
  const allT = getAllTerrains?.() || {};
  const terrainDesc = Object.entries(allT).map(([id, info]) =>
    `  - "${id}": ${info.name || id}${info.icon ? ' (' + info.icon + ')' : ''}`
  ).join('\n');
  const regionDesc = Object.entries(regions || {}).map(([id, r]) =>
    `  - "${id}": ${r.name || id}${r.icon ? ' (' + r.icon + ')' : ''}`
  ).join('\n');
  return `你是地图编辑AI。你通过JSON命令数组来控制六角格地图。

可用地形ID：
${terrainDesc}

命令格式（每行一个JSON对象）：
1. 涂色：{"action":"paint","q":<数字>,"r":<数字>,"terrain":"<地形ID>"}
2. 擦除：{"action":"erase","q":<数字>,"r":<数字>}
3. 标签：{"action":"label","q":<数字>,"r":<数字>,"text":"<文字>"}
4. 定居点：{"action":"settlement","q":<数字>,"r":<数字>,"name":"<名称>","rating":<-3到3的整数>}
5. 道路：{"action":"road","q1":<数字>,"r1":<数字>,"q2":<数字>,"r2":<数字>}
6. 矩形区域涂色：{"action":"paintRect","q1":<数字>,"r1":<数字>,"q2":<数字>,"r2":<数字>,"terrain":"<地形ID>"}
7. 标注：{"action":"annotate","q":<数字>,"r":<数字>,"type":"分类","text":"<文字>","visible":true或false}
   分类可选值: poi(地标), hazard(危险), lore(剧情), note(备注), marker(标记)
8. 设置王国：{"action":"setRegion","q":<数字>,"r":<数字>,"region":"<王国ID>"}
9. 矩形区域设置王国：{"action":"setRegionRect","q1":<数字>,"r1":<数字>,"q2":<数字>,"r2":<数字>,"region":"<王国ID>"}

可用王国ID：
${regionDesc}

重要规则：
- 坐标 (q, r) 使用 odd-r 六角格系统
- 只输出JSON数组，不要多余文字
- 用 \`\`\`json 包裹你的回复
- paintRect 的 q1/r1 和 q2/r2 定义矩形对角，会自动填充整个矩形区域
- 道路只能连接相邻（共边）的六角格！q1/r1 和 q2/r2 必须是 neighbors，不能跳格连路。如需连接非相邻格，请逐段铺设
- 每次返回完整的命令列表，包含所有需要绘制的格子`;
}

// --- System prompt for plan mode ---
function buildPlanSystemPrompt() {
  const allT = getAllTerrains?.() || {};
  const terrainDesc = Object.entries(allT).map(([id, info]) =>
    `  - "${id}": ${info.name || id}${info.icon ? " (" + info.icon + ")" : ""}`
  ).join('\n');
  const cb = "```";  // code block marker
  return `你是地图设计师AI。你通过输出"地图规划书"来控制程序化地图生成引擎。

可用地形ID：
${terrainDesc}

你需要输出一个JSON规划书，格式如下：
${cb}json
{
  "mode": "plan",
  "idea": "简短描述你的设计思路",
  "seed": <随机种子数字>,
  "width": <地图宽度，建议10-30>,
  "height": <地图高度，建议10-30>,
  "scale": <噪声缩放，0.5=大块地形 2.0=细碎地形，默认1.0>,
  "zones": [
    {"terrain": "<地形ID>", "at": "<方位>", "span": <半径>},
    {"terrain": "<地形ID>", "at": "<方位>", "span": <半径>}
  ],
  "settlementCount": <定居点数量，建议2-12，大地图可到50>,
  "buildRoads": true
}
${cb}

方位(at)可选值：center, north, south, east, west, northeast, northwest, southeast, southwest, all

设计原则：
- 每个zone定义一个区域。引擎会用噪声算法在区域内生成自然地形，边缘自动渐变过渡，不会生硬切割
- 不同zone可以部分重叠。后列出的zone优先级更高（可以覆盖前面的）
- 山脉(mountain)适合放在边缘（north/south/east/west），作为天然屏障
- 水域(water)适合沿海（east/west）或低洼处
- 平原(plain)和森林(forest)适合放在中心和平缓地带
- 定居点会自动选择最佳位置（靠近水、在平原或森林上、避开山脉），无需手动指定坐标
- 道路会自动用MST算法连通所有定居点，沿最优路径铺设
- 默认的纯噪声地形已经足够好，只需用zone指定你想要的"特殊结构"

只输出JSON规划书，用 ${cb}json 包裹。不要输出额外文字。`;
}

// --- Resolve zone position from compass direction ---
function resolveZonePosition(at, centerQ, centerR, halfW, halfH) {
  if (!at || at === 'all') return { q: centerQ, r: centerR, isAll: true };
  const dist = Math.floor(Math.max(1, Math.min(halfW, halfH)) * 0.55);
  const dirMap = {
    'center': [0, 0],
    'north': [0, -dist],
    'northeast': [Math.round(dist * 0.7), -Math.round(dist * 0.7)],
    'east': [dist, 0],
    'southeast': [Math.round(dist * 0.7), Math.round(dist * 0.7)],
    'south': [0, dist],
    'southwest': [-Math.round(dist * 0.7), Math.round(dist * 0.7)],
    'west': [-dist, 0],
    'northwest': [-Math.round(dist * 0.7), -Math.round(dist * 0.7)]
  };
  const [dq, dr] = dirMap[at] || [0, 0];
  return { q: centerQ + dq, r: centerR + dr, isAll: false };
}

// --- Classify terrain by Perlin noise (extracted from generateTerrainRegion) ---
function classifyTerrainByNoise(nx, ny, rng) {
  const elev = fractalNoise(nx, ny, 4);
  const moist = fractalNoise(nx + 100, ny + 100, 3);
  if (elev < -0.20) return 'water';
  if (elev > 0.50 && moist < -0.05) return 'snow';
  if (elev > 0.40) return 'mountain';
  if (elev > 0.20) return 'hill';
  if (moist < -0.15) return 'desert';
  if (moist > 0.15 && elev < 0.30) return 'forest';
  if (elev < -0.05 && moist > 0.10) return 'swamp';
  return generationRules.defaultTerrain || 'plain';
}

// --- Execute a map plan (AI-designed, procedurally generated) ---
async function executeMapPlan(plan) {
  const allTerrains = getAllTerrains?.() || {};
  let { seed, width, height, scale, zones, settlementCount, buildRoads, center } = plan;

  // Clamp dimensions
  width = Math.max(6, Math.min(200, width || 16));
  height = Math.max(6, Math.min(200, height || 16));
  scale = Math.max(0.3, Math.min(3.0, scale || 1.0));
  settlementCount = Math.max(0, Math.min(100, settlementCount || 0));
  if (!zones || !zones.length) zones = [];

  // Determine center
  let centerQ = 0, centerR = 0;
  if (center && typeof center.q === 'number') centerQ = center.q;
  if (center && typeof center.r === 'number') centerR = center.r;

  const halfW = Math.floor(width / 2);
  const halfH = Math.floor(height / 2);

  // Resolve zone positions
  const resolvedZones = zones.map(function(z) {
    const pos = resolveZonePosition(z.at, centerQ, centerR, halfW, halfH);
    return {
      terrain: z.terrain || 'plain',
      span: Math.max(1, Math.min(Math.max(halfW, halfH), z.span || 3)),
      q: pos.q,
      r: pos.r,
      isAll: pos.isAll
    };
  });

  // If a zone has isAll, it covers the whole region
  const bgZone = resolvedZones.find(function(z) { return z.isAll; });
  const overlayZones = resolvedZones.filter(function(z) { return !z.isAll; });

  initPerm(seed);
  const rng = mulberry32(seed + 1);

  // Collect all hexes in region
  const hexList = [];
  for (let q = centerQ - halfW; q <= centerQ + halfW; q++) {
    for (let r = centerR - halfH; r <= centerR + halfH; r++) {
      hexList.push({ q, r });
    }
  }

  // Shuffle for natural processing order
  for (let i = hexList.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [hexList[i], hexList[j]] = [hexList[j], hexList[i]];
  }

  // Process in chunks for large maps
  let painted = 0;
  const CHUNK = 5000;
  for (var ci = 0; ci < hexList.length; ci += CHUNK) {
    const end = Math.min(ci + CHUNK, hexList.length);
    for (var idx = ci; idx < end; idx++) {
      const { q, r } = hexList[idx];
      const p = hexToPixel(q, r);
      const nx = p.x * 0.005 / scale;
      const ny = p.y * 0.005 / scale;

      // Check overlay zones first (higher priority)
      let terrainId = null;
      for (var zi = overlayZones.length - 1; zi >= 0; zi--) {
        const zone = overlayZones[zi];
        const dz = hexDistance(q, r, zone.q, zone.r);
        if (dz <= zone.span) {
          const edgeFactor = dz / Math.max(1, zone.span);
          const noiseVal = fractalNoise(nx + 50, ny + 50, 2);
          if (edgeFactor > 0.65 && noiseVal > 0.35) continue;
          terrainId = zone.terrain;
          break;
        }
      }
      if (!terrainId && bgZone) terrainId = bgZone.terrain;
      if (!terrainId) terrainId = classifyTerrainByNoise(nx, ny, rng);

      var chance = generationRules.specialTerrainChance != null ? generationRules.specialTerrainChance : 0.05;
      if (rng() < chance && terrainId !== 'water' && terrainId !== 'mountain') {
        var special = pickSpecialTerrain(rng);
        if (special) terrainId = special;
      }

      writeHexData(hexKey(q, r), { terrain: terrainId });
      painted++;
    }
    render();
    await new Promise(function(resolve) { requestAnimationFrame(resolve); });
  }

  // Place settlements
  let placed = [];
  if (settlementCount > 0) {
    placed = placeSettlements(settlementCount, seed + 1, centerQ, centerR, width, height);
  }

  // Build road network
  let roadsBuilt = 0;
  if (buildRoads !== false && placed.length >= 2) {
    roadsBuilt = buildRoadNetwork(placed);
  }

  return { painted: painted, settlements: placed.length, roads: roadsBuilt };
}
// --- API call (streaming) ---
async function callAIAPI(systemPrompt, userMessage, onChunk, signal) {
  const settings = loadAISettings();
  if (!settings.apiKey) throw new Error('请先在AI绘图对话框中填写API Key');

  if (settings.provider === 'anthropic') {
    const endpoint = settings.endpoint || 'https://api.anthropic.com/v1/messages';
    const model = settings.model || 'claude-sonnet-4-20250514';
    const resp = await fetch(endpoint, {
      method: 'POST',
      signal: signal || null,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        stream: true
      })
    });
    if (!resp.ok) {
      let errText = '';
      try { const e = await resp.json(); errText = JSON.stringify(e); } catch (e) { errText = await resp.text(); }
      console.error('[AI API Error] HTTP ' + resp.status + ': ' + errText);
      throw new Error('API错误 (' + resp.status + '): ' + errText);
    }
    return await readAnthropicStream(resp, onChunk);
  } else {
    // OpenAI-compatible API
    const isOpenAI = settings.provider === 'openai';
    const defaultEndpoint = isOpenAI ? 'https://api.openai.com/v1/chat/completions' :
                           settings.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : '';
    const endpoint = settings.endpoint || defaultEndpoint;
    const model = settings.model || (isOpenAI ? 'gpt-4o' : '');
    if (!endpoint) throw new Error('请填写API Endpoint');
    if (!model) throw new Error('请填写模型名称');
    const resp = await fetch(endpoint, {
      method: 'POST',
      signal: signal || null,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + settings.apiKey
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 4096,
        stream: true
      })
    });
    if (!resp.ok) {
      let errText = '';
      try { const e = await resp.json(); errText = JSON.stringify(e); } catch (e) { errText = await resp.text(); }
      console.error('[AI API Error] HTTP ' + resp.status + ': ' + errText);
      throw new Error('API错误 (' + resp.status + '): ' + errText);
    }
    let result = await readOpenAIStream(resp, onChunk);
    // Fallback: if streaming returned empty, retry without stream
    if (!result || !result.trim()) {
      console.warn('[AI Stream] Streaming returned empty, retrying without stream...');
      const resp2 = await fetch(endpoint, {
        method: 'POST',
        signal: signal || null,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.apiKey
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: 4096
        })
      });
      if (!resp2.ok) {
        let errText = '';
        try { const e = await resp2.json(); errText = JSON.stringify(e); } catch (e) { errText = await resp2.text(); }
        console.error('[AI API Error] Non-stream HTTP ' + resp2.status + ': ' + errText);
        throw new Error('API错误 (' + resp2.status + '): ' + errText);
      }
      const data = await resp2.json();
      result = data.choices?.[0]?.message?.content || '';
      if (onChunk && result) onChunk(result, result);
    }
    return result;
  }
}

async function readOpenAIStream(resp, onChunk) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let rawChunksLogged = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        const s = buffer.trim();
        if (s.startsWith('data: ') && s !== 'data: [DONE]') {
          try {
            const json = JSON.parse(s.slice(6));
            const content = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || '';
            if (content) fullText += content;
          } catch(e) {}
        }
      }
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    // Debug: log first 3 raw chunks
    if (rawChunksLogged < 3) {
      console.log('[AI Stream Debug] Raw chunk #' + (rawChunksLogged + 1) + ':', JSON.stringify(chunk.slice(0, 300)));
      rawChunksLogged++;
    }
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data: ')) continue;
      const data = s.slice(6);
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content
                     || json.choices?.[0]?.message?.content
                     || '';
        if (content) {
          fullText += content;
          if (onChunk) onChunk(content, fullText);
        }
      } catch (e) {
        console.warn('[AI Stream Debug] Failed to parse data line:', data.slice(0, 100));
      }
    }
  }
  if (!fullText) {
    console.warn('[AI Stream] Empty response — stream finished with no content.');
    console.warn('[AI Stream] Check provider/endpoint/model. For DeepSeek, endpoint should be: https://api.deepseek.com/chat/completions');
  }
  return fullText;
}

async function readAnthropicStream(resp, onChunk) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('data: ')) continue;
      const data = s.slice(6);
      try {
        const json = JSON.parse(data);
        const delta = json.delta;
        if (delta && delta.text) {
          fullText += delta.text;
          if (onChunk) onChunk(delta.text, fullText);
        }
      } catch (e) { /* skip malformed chunks */ }
    }
  }
  return fullText;
}
// --- Parse AI response ---
function parseAIResponse(text) {
  console.log('[AI Raw Response]', text);
  let content = text.trim();

  // Strategy 1: Extract from markdown code block (```json ... ``` or ``` ... ```)
  const codeBlock = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlock) content = codeBlock[1].trim();

  // Strategy 2: Direct JSON parse
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch (e) { /* continue */ }

  // Strategy 3: Extract JSON array [...] from text
  const arrMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrMatch) {
    try {
      const parsed = JSON.parse(arrMatch[0]);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch (e) { /* continue */ }
  }

  // Strategy 4: Line-by-line JSONL (each line is a complete {…} object)
  const jsonlLines = content.split('\n').filter(function(l) {
    var t = l.trim();
    return t.startsWith('{') && t.endsWith('}');
  });
  if (jsonlLines.length) {
    var commands = [];
    for (var i = 0; i < jsonlLines.length; i++) {
      try { commands.push(JSON.parse(jsonlLines[i].trim())); } catch (e2) { /* skip */ }
    }
    if (commands.length) return commands;
  }

  // Strategy 5: Extract all {...} objects from anywhere in the text
  var objRegex = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g;
  var objMatches = content.match(objRegex);
  if (objMatches && objMatches.length) {
    var cmds = [];
    for (var j = 0; j < objMatches.length; j++) {
      try { cmds.push(JSON.parse(objMatches[j])); } catch (e2) { /* skip */ }
    }
    if (cmds.length) return cmds;
  }

  throw new Error('无法解析AI返回的JSON (前300字): ' + content.slice(0, 300));
}
// --- Execute commands ---
function executeOneAICommand(cmd) {
  // Each command is its own undo batch
  beginBatch();
  try {
    const { action, q, r, terrain, text, name, rating, q1, r1, q2, r2, type, visible, region } = cmd;
    let count = 0;
    if (action === 'paint' && q !== undefined && r !== undefined && terrain) {
      const key = hexKey(q, r);
      pushUndo(key);
      if (!hexData[key]) hexData[key] = {};
      hexData[key].terrain = terrain;
      count++;
    } else if (action === 'erase' && q !== undefined && r !== undefined) {
      const key = hexKey(q, r);
      pushUndo(key);
      delete hexData[key];
      count++;
    } else if (action === 'label' && q !== undefined && r !== undefined && text !== undefined) {
      const key = hexKey(q, r);
      pushUndo(key);
      if (!hexData[key]) hexData[key] = {};
      if (text) hexData[key].label = text;
      else delete hexData[key].label;
      count++;
    } else if (action === 'settlement' && q !== undefined && r !== undefined && name) {
      const key = hexKey(q, r);
      pushUndo(key);
      if (!hexData[key]) hexData[key] = {};
      hexData[key].settlement = { name, rating: rating || 0 };
      count++;
    } else if (action === 'annotate' && q !== undefined && r !== undefined && text !== undefined) {
      const key = hexKey(q, r);
      pushUndo(key);
      if (!hexData[key]) hexData[key] = {};
      if (!hexData[key].annotations) hexData[key].annotations = [];
      hexData[key].annotations.push({
        id: genAnnId(),
        type: type || 'note',
        text: text,
        visible: visible !== undefined ? visible : false,
        createdAt: Date.now()
      });
      if (text) count++;
    } else if (action === 'road' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined) {
      // If not adjacent, auto-pathfind and build road segment by segment
      if (!neighbors(q1, r1).some(n => n.q === q2 && n.r === r2)) {
        const path = hexPathfind(q1, r1, q2, r2);
        if (path && path.length > 1) {
          let built = 0;
          for (let pi = 0; pi < path.length - 1; pi++) {
            const a = path[pi], b = path[pi + 1];
            const ak = hexKey(a.q, a.r), bk = hexKey(b.q, b.r);
            pushUndo(ak); if (!hexData[ak]) hexData[ak] = {};
            if (!hexData[ak].roads) hexData[ak].roads = [];
            if (!hexData[ak].roads.some(r => r.q === b.q && r.r === b.r)) hexData[ak].roads.push({ q: b.q, r: b.r });
            pushUndo(bk); if (!hexData[bk]) hexData[bk] = {};
            if (!hexData[bk].roads) hexData[bk].roads = [];
            if (!hexData[bk].roads.some(r => r.q === a.q && r.r === a.r)) hexData[bk].roads.push({ q: a.q, r: a.r });
            built++;
          }
          return built;
        }
        return 0;
      }
      const k1 = hexKey(q1, r1), k2 = hexKey(q2, r2);
      pushUndo(k1);
      if (!hexData[k1]) hexData[k1] = {};
      if (!hexData[k1].roads) hexData[k1].roads = [];
      if (!hexData[k1].roads.some(r => r.q === q2 && r.r === r2)) {
        hexData[k1].roads.push({ q: q2, r: r2 });
      }
      pushUndo(k2);
      if (!hexData[k2]) hexData[k2] = {};
      if (!hexData[k2].roads) hexData[k2].roads = [];
      if (!hexData[k2].roads.some(r => r.q === q1 && r.r === r1)) {
        hexData[k2].roads.push({ q: q1, r: r1 });
      }
      count++;
    } else if (action === 'paintRect' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined && terrain) {
      // Safety cap: limit rect to 100×100 to prevent accidental map-wide fills
      let minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
      let minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
      if (Math.abs(maxQ - minQ) > 100) {
        console.warn('AI paintRect capped: q range ' + (maxQ - minQ) + ' → 100');
        if (q1 < q2) maxQ = minQ + 100; else minQ = maxQ - 100;
      }
      if (Math.abs(maxR - minR) > 100) {
        console.warn('AI paintRect capped: r range ' + (maxR - minR) + ' → 100');
        if (r1 < r2) maxR = minR + 100; else minR = maxR - 100;
      }
      for (let qq = minQ; qq <= maxQ; qq++) {
        for (let rr = minR; rr <= maxR; rr++) {
          const key = hexKey(qq, rr);
          pushUndo(key);
          if (!hexData[key]) hexData[key] = {};
          hexData[key].terrain = terrain;
          count++;
        }
      }
    } else if (action === 'setRegion' && q !== undefined && r !== undefined && region) {
      const key = hexKey(q, r);
      pushUndo(key);
      if (!hexData[key]) hexData[key] = {};
      hexData[key].region = region;
      count++;
    } else if (action === 'setRegionRect' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined && region) {
      let minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
      let minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
      if (Math.abs(maxQ - minQ) > 100) {
        if (q1 < q2) maxQ = minQ + 100; else minQ = maxQ - 100;
      }
      if (Math.abs(maxR - minR) > 100) {
        if (r1 < r2) maxR = minR + 100; else minR = maxR - 100;
      }
      for (let qq = minQ; qq <= maxQ; qq++) {
        for (let rr = minR; rr <= maxR; rr++) {
          const key = hexKey(qq, rr);
          pushUndo(key);
          if (!hexData[key]) hexData[key] = {};
          hexData[key].region = region;
          count++;
        }
      }
    }
    return count;
  } finally {
    endBatch();
  }
}

function executeAICommands(commands) {
  let total = 0;
  // All commands in one undo batch for legacy use (save/load etc.)
  beginBatch();
  try {
    for (const cmd of commands) {
      total += executeOneAICommandNoBatch(cmd);
    }
  } finally {
    endBatch();
  }
  return total;
}

// Internal: execute one command without beginBatch/endBatch (caller batches)
function executeOneAICommandNoBatch(cmd) {
  const { action, q, r, terrain, text, name, rating, q1, r1, q2, r2, type, visible, region } = cmd;
  let count = 0;
  if (action === 'paint' && q !== undefined && r !== undefined && terrain) {
    const key = hexKey(q, r);
    pushUndo(key);
    if (!hexData[key]) hexData[key] = {};
    hexData[key].terrain = terrain;
    count++;
  } else if (action === 'erase' && q !== undefined && r !== undefined) {
    const key = hexKey(q, r);
    pushUndo(key);
    delete hexData[key];
    count++;
  } else if (action === 'label' && q !== undefined && r !== undefined && text !== undefined) {
    const key = hexKey(q, r);
    pushUndo(key);
    if (!hexData[key]) hexData[key] = {};
    if (text) hexData[key].label = text;
    else delete hexData[key].label;
    count++;
  } else if (action === 'settlement' && q !== undefined && r !== undefined && name) {
    const key = hexKey(q, r);
    pushUndo(key);
    if (!hexData[key]) hexData[key] = {};
    hexData[key].settlement = { name, rating: rating || 0 };
    count++;
  } else if (action === 'annotate' && q !== undefined && r !== undefined && text !== undefined) {
    const key = hexKey(q, r);
    pushUndo(key);
    if (!hexData[key]) hexData[key] = {};
    if (!hexData[key].annotations) hexData[key].annotations = [];
    hexData[key].annotations.push({
      id: genAnnId(),
      type: type || 'note',
      text: text,
      visible: visible !== undefined ? visible : false,
      createdAt: Date.now()
    });
    if (text) count++;
  } else if (action === 'road' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined) {
    // If not adjacent, auto-pathfind
    if (!neighbors(q1, r1).some(n => n.q === q2 && n.r === r2)) {
      const path = hexPathfind(q1, r1, q2, r2);
      if (path && path.length > 1) {
        let built = 0;
        for (let pi = 0; pi < path.length - 1; pi++) {
          const a = path[pi], b = path[pi + 1];
          const ak = hexKey(a.q, a.r), bk = hexKey(b.q, b.r);
          pushUndo(ak); if (!hexData[ak]) hexData[ak] = {};
          if (!hexData[ak].roads) hexData[ak].roads = [];
          if (!hexData[ak].roads.some(r => r.q === b.q && r.r === b.r)) hexData[ak].roads.push({ q: b.q, r: b.r });
          pushUndo(bk); if (!hexData[bk]) hexData[bk] = {};
          if (!hexData[bk].roads) hexData[bk].roads = [];
          if (!hexData[bk].roads.some(r => r.q === a.q && r.r === a.r)) hexData[bk].roads.push({ q: a.q, r: a.r });
          built++;
        }
        return built;
      }
      return 0;
    }
    const k1 = hexKey(q1, r1), k2 = hexKey(q2, r2);
    pushUndo(k1);
    if (!hexData[k1]) hexData[k1] = {};
    if (!hexData[k1].roads) hexData[k1].roads = [];
    if (!hexData[k1].roads.some(r => r.q === q2 && r.r === r2)) {
      hexData[k1].roads.push({ q: q2, r: r2 });
    }
    pushUndo(k2);
    if (!hexData[k2]) hexData[k2] = {};
    if (!hexData[k2].roads) hexData[k2].roads = [];
    if (!hexData[k2].roads.some(r => r.q === q1 && r.r === r1)) {
      hexData[k2].roads.push({ q: q1, r: r1 });
    }
    count++;
  } else if (action === 'paintRect' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined && terrain) {
    // Safety cap: limit rect to 100×100
    let minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
    let minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    if (Math.abs(maxQ - minQ) > 100) {
      if (q1 < q2) maxQ = minQ + 100; else minQ = maxQ - 100;
    }
    if (Math.abs(maxR - minR) > 100) {
      if (r1 < r2) maxR = minR + 100; else minR = maxR - 100;
    }
    for (let qq = minQ; qq <= maxQ; qq++) {
      for (let rr = minR; rr <= maxR; rr++) {
        const key = hexKey(qq, rr);
        pushUndo(key);
        if (!hexData[key]) hexData[key] = {};
        hexData[key].terrain = terrain;
        count++;
      }
    }
  } else if (action === 'setRegion' && q !== undefined && r !== undefined && region) {
    const key = hexKey(q, r);
    pushUndo(key);
    if (!hexData[key]) hexData[key] = {};
    hexData[key].region = region;
    count++;
  } else if (action === 'setRegionRect' && q1 !== undefined && r1 !== undefined && q2 !== undefined && r2 !== undefined && region) {
    let minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
    let minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    if (Math.abs(maxQ - minQ) > 100) {
      if (q1 < q2) maxQ = minQ + 100; else minQ = maxQ - 100;
    }
    if (Math.abs(maxR - minR) > 100) {
      if (r1 < r2) maxR = minR + 100; else minR = maxR - 100;
    }
    for (let qq = minQ; qq <= maxQ; qq++) {
      for (let rr = minR; rr <= maxR; rr++) {
        const key = hexKey(qq, rr);
        pushUndo(key);
        if (!hexData[key]) hexData[key] = {};
        hexData[key].region = region;
        count++;
      }
    }
  }
  return count;
}
// Open AI dialog
  const btnAI = document.getElementById('btn-ai-draw');
  if (btnAI) {
    btnAI.addEventListener('click', () => {
      const modal = document.getElementById('ai-draw-modal');
      if (modal) modal.style.display = 'block';
      // Load saved settings
      const settings = loadAISettings();
      const providerSel = document.getElementById('ai-provider');
      const keyInput = document.getElementById('ai-api-key');
      const endpointInput = document.getElementById('ai-endpoint');
      const modelInput = document.getElementById('ai-model');
      if (providerSel) providerSel.value = settings.provider;
      if (keyInput) keyInput.value = settings.apiKey || '';
      if (endpointInput) endpointInput.value = settings.endpoint || '';
      if (modelInput) modelInput.value = settings.model || '';
      // Restore saved prompt
      const promptTa = document.getElementById('ai-prompt');
      if (promptTa) {
        try {
          const savedPrompt = localStorage.getItem('ai_draw_prompt');
          if (savedPrompt) promptTa.value = savedPrompt;
        } catch(e) {}
      }
      // Trigger provider change to show/hide fields
      if (providerSel) providerSel.dispatchEvent(new Event('change'));
    });
  }
  // Provider switch
  const providerSel = document.getElementById('ai-provider');  if (providerSel) {
    providerSel.addEventListener('change', () => {
      const val = providerSel.value;
      const endpointRow = document.getElementById('ai-endpoint-row');      const modelRow = document.getElementById('ai-model-row');      const epInput = document.getElementById('ai-endpoint');
      const modelInput = document.getElementById('ai-model');
      if (val === 'openai') {
        if (endpointRow) endpointRow.style.display = 'none';
        if (modelRow) modelRow.style.display = 'none';
        if (epInput) epInput.value = '';
        if (modelInput) modelInput.value = 'gpt-4o';
      } else if (val === 'anthropic') {
        if (endpointRow) endpointRow.style.display = 'none';
        if (modelRow) modelRow.style.display = 'block';
        if (epInput) epInput.value = '';
        if (modelInput) modelInput.value = 'claude-sonnet-4-20250514';
      } else if (val === 'openrouter') {
        if (endpointRow) endpointRow.style.display = 'none';
        if (modelRow) modelRow.style.display = 'block';
        if (epInput) epInput.value = '';
        if (modelInput) modelInput.value = '';
      } else { // custom
        if (endpointRow) endpointRow.style.display = 'block';
        if (modelRow) modelRow.style.display = 'block';
      }
    });
  }
  // Toggle API key visibility
  const toggleBtn = document.getElementById('ai-toggle-key');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = document.getElementById('ai-api-key');
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        toggleBtn.textContent = input.type === 'password' ? '👁️' : '🙈';
      }
    });
  }
  // Model default button
  const modelDefaultBtn = document.getElementById('ai-model-default');
  if (modelDefaultBtn) {
    modelDefaultBtn.addEventListener('click', () => {
      const provider = document.getElementById('ai-provider').value;
      const modelInput = document.getElementById('ai-model');
      if (!modelInput) return;
      const defaults = {
        'openai': 'gpt-4o',
        'anthropic': 'claude-sonnet-4-20250514',
        'openrouter': 'openai/gpt-4o',
        'custom': ''
      };
      modelInput.value = defaults[provider] || '';
    });
  }
  // Clear prompt
  const clearBtn = document.getElementById('ai-btn-clear-prompt');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const ta = document.getElementById('ai-prompt');
      if (ta) { ta.value = ''; ta.focus(); }
    });
  }
  // Add context - insert structured map summary into prompt
  const contextBtn = document.getElementById('ai-btn-add-context');
  if (contextBtn) {
    contextBtn.addEventListener('click', () => {
      const scopeSel = document.getElementById('ai-scope');
      const scope = scopeSel ? scopeSel.value : 'all';
      const context = getMapContext(scope);
      const ta = document.getElementById('ai-prompt');
      if (!ta) return;

      // Compute coordinate range
      let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
      for (const h of context.hexes) {
        if (h.q < minQ) minQ = h.q; if (h.q > maxQ) maxQ = h.q;
        if (h.r < minR) minR = h.r; if (h.r > maxR) maxR = h.r;
      }

      // Count terrain distribution (sorted by count desc)
      const byTerrain = {};
      for (const h of context.hexes) {
        const t = h.terrain || '未探索';
        byTerrain[t] = (byTerrain[t] || 0) + 1;
      }
      const terrainSummary = Object.entries(byTerrain)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => {
          const name = context.terrains[t] || t;
          return name + ' ' + n + '格';
        }).join(', ');

      // Road count
      let roadCount = 0;
      const seenRoads = new Set();
      for (const h of context.hexes) {
        if (h.roads) {
          for (const rd of h.roads) {
            const rk = h.q + ',' + h.r + '-' + rd.q + ',' + rd.r;
            const rk2 = rd.q + ',' + rd.r + '-' + h.q + ',' + h.r;
            if (!seenRoads.has(rk) && !seenRoads.has(rk2)) {
              seenRoads.add(rk);
              roadCount++;
            }
          }
        }
      }

      const lines = ['[当前地图状态]'];
      lines.push('格子总数: ' + context.hexCount + ' | 坐标范围: q[' + (isFinite(minQ) ? minQ : '?') + '..' + (isFinite(maxQ) ? maxQ : '?') + '] r[' + (isFinite(minR) ? minR : '?') + '..' + (isFinite(maxR) ? maxR : '?') + ']');
      lines.push('地形分布: ' + (terrainSummary || '无'));
      lines.push('已有道路: ' + roadCount + ' 条');

      // Settlements
      const settls = context.hexes.filter(function(h) { return h.settlement; });
      if (settls.length) {
        const sList = settls.map(function(h) {
          return h.settlement.name + ' (' + h.q + ',' + h.r + ') ' + (h.settlement.rating >= 0 ? '+' : '') + h.settlement.rating;
        }).join(', ');
        lines.push('定居点(' + settls.length + '): ' + sList);
      } else {
        lines.push('定居点: 无');
      }

      ta.value = (ta.value ? ta.value + '\n\n' : '') + lines.join('\n');
    });
  }
  // AI generation state
  let aiStopRequested = false;
  let aiAbortController = null;

  // Helper: update floating bar
  function setFloatingStatus(icon, text, showStop) {
    const bar = document.getElementById('ai-floating-bar');
    const iconEl = document.getElementById('ai-floating-icon');
    const statusEl = document.getElementById('ai-floating-status');
    const stopBtn = document.getElementById('ai-floating-stop');
    if (bar) bar.style.display = 'block';
    if (iconEl) iconEl.textContent = icon;
    if (statusEl) statusEl.innerHTML = text;
    if (stopBtn) stopBtn.style.display = showStop ? 'inline' : 'none';
  }
  function hideFloatingBar() {
    const bar = document.getElementById('ai-floating-bar');
    if (bar) bar.style.display = 'none';
  }

  // Confirm (execute AI generation: hide modal → floating bar → animate on map)
  const confirmBtn = document.getElementById('ai-btn-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      // Gather settings
      const provider = document.getElementById('ai-provider').value;
      const apiKey = document.getElementById('ai-api-key').value;
      const endpoint = document.getElementById('ai-endpoint').value;
      const model = document.getElementById('ai-model').value;
      const scope = document.getElementById('ai-scope').value;
      const prompt = document.getElementById('ai-prompt').value;
      if (!apiKey) { alert('请填写API Key'); return; }
      if (!prompt) { alert('请填写你的需求'); return; }
      // Save settings
      saveAISettings({ provider, apiKey, endpoint, model });

      // Auto-fallback: if scope is "selected" but nothing is selected, use "all"
      let actualScope = scope;
      let fallbackNote = '';
      if (scope === 'selected') {
        const selHexes = getScopeHexes('selected');
        if (!selHexes.length) {
          actualScope = 'all';
          fallbackNote = ' (未选中任何格子，已自动切换为全部地图)';
        }
      }

      // Build messages — pick mode
      const aiMode = document.getElementById('ai-mode').value;
      const isPlanMode = aiMode === 'plan';
      const mapContext = getMapContext(actualScope);

      // Compute coordinate range for plan mode context
      let minQ = 0, maxQ = 0, minR = 0, maxR = 0;
      if (isPlanMode && mapContext.hexes.length) {
        minQ = Infinity; maxQ = -Infinity; minR = Infinity; maxR = -Infinity;
        for (const h of mapContext.hexes) {
          if (h.q < minQ) minQ = h.q; if (h.q > maxQ) maxQ = h.q;
          if (h.r < minR) minR = h.r; if (h.r > maxR) maxR = h.r;
        }
      }

      const systemPrompt = isPlanMode ? buildPlanSystemPrompt() : buildSystemPrompt();
      let userMessage;
      if (isPlanMode) {
        userMessage = '当前地图信息:\n' +
          '- 范围: ' + actualScope + '\n' +
          '- 现有格子数: ' + mapContext.hexCount + '\n' +
          (mapContext.hexCount > 0 ? '- 现有坐标范围: q[' + minQ + '..' + maxQ + '] r[' + minR + '..' + maxR + ']\n' : '') +
          '- 建议地图尺寸: ' + Math.max(10, Math.min(30, Math.max(maxQ - minQ + 1, maxR - minR + 1, 16))) + '×' + Math.max(10, Math.min(30, Math.max(maxQ - minQ + 1, maxR - minR + 1, 16))) + '\n' +
          '\n用户需求:\n' + prompt;
      } else {
        userMessage = '当前地图范围: ' + actualScope + '\n格子数: ' + mapContext.hexCount + '\n\n用户需求:\n' + prompt;
      }
      aiStopRequested = false;

      // Create abort controller for stop button
      if (aiAbortController) aiAbortController.abort(); // cancel any previous request
      aiAbortController = new AbortController();

      // Record undo depth for one-click undo later
      aiUndoBefore = undoStack.length;

      // Hide undo button during generation
      const undoBtn = document.getElementById('ai-floating-undo');
      if (undoBtn) undoBtn.style.display = 'none';

      // Reset stop button
      const floatingStopBtn = document.getElementById('ai-floating-stop');
      if (floatingStopBtn) { floatingStopBtn.disabled = false; floatingStopBtn.textContent = '⏹ 停止'; }

      // Hide modal, show floating bar on the map (no backdrop!)
      const modal = document.getElementById('ai-draw-modal');
      if (modal) modal.style.display = 'none';
      setFloatingStatus('⏳', 'AI 思考中...' + (isPlanMode ? ' (规划模式)' : '') + fallbackNote, true);

      try {
        // Phase 1: Stream AI response — show text in floating bar
        const respText = await callAIAPI(systemPrompt, userMessage, function(chunk, fullText) {
          const statusEl = document.getElementById('ai-floating-status');
          if (statusEl) {
            const show = fullText.length > 400 ? '...' + fullText.slice(-400) : fullText;
            statusEl.innerHTML = '<span style="color:#a044ff;">⏳ 思考中</span> <span style="color:#888;font-size:10px;white-space:pre-wrap;">' + show.replace(/</g,'&lt;') + '</span>';
          }
        }, aiAbortController.signal);

        // Check if user clicked stop during streaming
        if (aiStopRequested) {
          setFloatingStatus('⏹', '<span style="color:#ffd700;">已停止</span>', false);
          setTimeout(hideFloatingBar, 10000);
          return;
        }

        // Phase 2: Parse response
        console.log('[AI Response] Length: ' + respText.length + ' chars');
        if (!respText || !respText.trim()) {
          throw new Error('AI 返回了空响应，请检查 API Key 和模型名是否正确，或查看控制台 [AI Stream] 日志');
        }
        const parsed = parseAIResponse(respText);
        if (!parsed.length) throw new Error('AI 没有返回有效内容');

        // Detect plan mode response (has "zones" field) vs command response (has "action" field)
        const isPlan = parsed.length === 1 && parsed[0].mode === 'plan' && parsed[0].zones;

        if (isPlan) {
          // Check stop before executing plan
          if (aiStopRequested) {
            setFloatingStatus('⏹', '<span style="color:#ffd700;">已停止</span>', false);
            setTimeout(hideFloatingBar, 10000);
            return;
          }
          // ===== Plan Mode: execute as single undo batch =====
          setFloatingStatus('🏗️', '<span style="color:#4ecdc4;">程序化生成中...</span>', true);
          const plan = parsed[0];
          console.log('[AI Plan]', plan.idea || '(no idea)');
          console.log('[AI Plan] Zones:', plan.zones.length, ' Size:', plan.width + '×' + plan.height, ' Settlements:', plan.settlementCount);

          beginBatch();
          let planResult;
          try {
            planResult = await executeMapPlan(plan);
          } finally {
            endBatch(); // always close batch even on error
          }
          render();
          updateInfo();

          const summary = '完成！' + planResult.painted + ' 格 · ' + planResult.settlements + ' 定居点 · ' + planResult.roads + ' 条道路';
          setFloatingStatus('✅', '<span style="color:#4ecdc4;">' + summary + '</span>', false);
          if (undoBtn && undoStack.length > aiUndoBefore) undoBtn.style.display = 'inline';
          setTimeout(hideFloatingBar, 20000);
        } else {
          // ===== Precise Mode: execute commands one by one =====
          setFloatingStatus('🔍', '<span style="color:#4ecdc4;">解析命令中...</span>', true);
          const commands = parsed;

          let executed = 0;
          for (let i = 0; i < commands.length; i++) {
            if (aiStopRequested) {
              setFloatingStatus('⏹', '<span style="color:#ffd700;">已停止。已执行 ' + (i + 1) + ' / ' + commands.length + ' 条命令</span>', false);
              if (undoBtn && undoStack.length > aiUndoBefore) undoBtn.style.display = 'inline';
              setTimeout(hideFloatingBar, 20000);
              break;
            }
            const cellCount = executeOneAICommand(commands[i]);
            executed += cellCount;
            render();
            if (i % 5 === 0 || i === commands.length - 1) {
              const pct = Math.round((i + 1) / commands.length * 100);
              setFloatingStatus('🎨', '<span style="color:#4ecdc4;">绘制中... ' + (i + 1) + ' / ' + commands.length + ' (' + pct + '%)</span>', true);
            }
            const delay = commands[i].action === 'paintRect' ? 20 : 60;
            await new Promise(function(resolve) { setTimeout(resolve, delay); });
          }

          updateInfo();
          if (!aiStopRequested) {
            setFloatingStatus('✅', '<span style="color:#4ecdc4;">完成！共执行 ' + commands.length + ' 条命令</span>', false);
            if (undoBtn && undoStack.length > aiUndoBefore) undoBtn.style.display = 'inline';
            setTimeout(hideFloatingBar, 15000);
          }
        }
      } catch (err) {
        // Aborted by user — show stopped message, not error
        if (err.name === 'AbortError') {
          setFloatingStatus('⏹', '<span style="color:#ffd700;">已停止</span>', false);
          setTimeout(hideFloatingBar, 10000);
          return;
        }
        // Log full error details to console for debugging
        console.error('[AI Draw Error] ' + err.message);
        console.error('[AI Draw Error] Full error:', err);
        if (err.stack) console.error('[AI Draw Error] Stack:', err.stack);
        setFloatingStatus('❌', '<span style="color:#e94560;">错误: ' + err.message + '</span>', false);
        if (undoBtn && undoStack.length > aiUndoBefore) undoBtn.style.display = 'inline';
        setTimeout(hideFloatingBar, 30000);
      }
    });
  }

  // Stop button (in floating bar)
  const floatingStopBtn = document.getElementById('ai-floating-stop');
  if (floatingStopBtn) {
    floatingStopBtn.addEventListener('click', function() {
      aiStopRequested = true;
      floatingStopBtn.disabled = true;
      floatingStopBtn.textContent = '⏹ 停止中...';
      // Abort in-flight API request
      if (aiAbortController) {
        try { aiAbortController.abort(); } catch(e) {}
      }
    });
  }

  // Undo button (in floating bar) — undo whole AI generation in one click
  let aiUndoBefore = 0;
  const floatingUndoBtn = document.getElementById('ai-floating-undo');
  if (floatingUndoBtn) {
    floatingUndoBtn.addEventListener('click', function() {
      while (undoStack.length > aiUndoBefore) {
        const entry = undoStack.pop();
        if (!entry) break;
        const redoEntries = applyUndoEntry(entry);
        redoStack.push(redoEntries);
      }
      updateUndoButtons();
      render();
      updateInfo();
      floatingUndoBtn.style.display = 'none';
      setFloatingStatus('↩', '<span style="color:#ffd700;">已撤销本次AI生成</span>', false);
      setTimeout(hideFloatingBar, 3000);
    });
  }

  // Template dropdown
  const templateSel = document.getElementById('ai-template');
  if (templateSel) {
    templateSel.addEventListener('change', function() {
      if (!templateSel.value) return;
      const ta = document.getElementById('ai-prompt');
      if (!ta) return;
      if (ta.value && !confirm('当前已有内容，是否替换？')) return;
      ta.value = templateSel.value;
      templateSel.value = '';
      ta.focus();
    });
  }

  // Auto-save prompt to localStorage on every keystroke
  const promptTextarea = document.getElementById('ai-prompt');
  if (promptTextarea) {
    promptTextarea.addEventListener('input', function() {
      try { localStorage.setItem('ai_draw_prompt', promptTextarea.value); } catch(e) {}
    });
  }

  // Cancel / Close X
  function closeAIModal() {
    const modal = document.getElementById('ai-draw-modal');
    if (modal) modal.style.display = 'none';
  }
  const cancelBtn = document.getElementById('ai-btn-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', closeAIModal);
  const closeXBtn = document.getElementById('ai-btn-close-x');
  if (closeXBtn) closeXBtn.addEventListener('click', closeAIModal);
