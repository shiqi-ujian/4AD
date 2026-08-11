// ======== Vector Icon System ========
// Replaces emoji terrain/settlement/annotation icons with hand-drawn vector art.
// Icons are defined as a small list of primitives in a 24x24 normalized viewbox:
//   { t:'c', x, y, r }            circle (filled)
//   { t:'r', x, y, w, h }         rectangle (filled)
//   { t:'p', d:'M...L...Z' }      closed polygon (filled)  — only M/L/Z supported
//   { t:'l', d:'M...L...' }       open polyline (stroked)
//
// Primitives are drawn on ANY canvas context (live render + PNG export), scaled
// by size/24. Each shape gets its fill color plus a subtle dark outline for
// legibility against colored hexes. iconStyle ('vector' | 'emoji', in state.js)
// decides whether these are used; when vector is off we fall back to emoji text.

const ICONS = {
  // ---------- Terrain (key = terrain id in config.js TERRAIN) ----------
  plain: [  // grass blades
    { t:'p', d:'M7 20 L9.5 12 L12 20 Z' },
    { t:'p', d:'M11 20 L12.4 13 L13.8 20 Z' },
    { t:'p', d:'M15 20 L17.5 11 L20 20 Z' }
  ],
  forest: [  // three conifers
    { t:'p', d:'M12 4 L16.5 12 L7.5 12 Z' }, { t:'r', x:11.2, y:12, w:1.6, h:3.5 },
    { t:'p', d:'M5.5 13 L8.8 7 L12 13 Z' }, { t:'r', x:7.6, y:13, w:1.3, h:3 },
    { t:'p', d:'M18.5 13 L15.2 7 L12 13 Z' }, { t:'r', x:14.4, y:13, w:1.3, h:3 }
  ],
  hill: [  // rounded mounds
    { t:'p', d:'M3 20 Q12 5 21 20 Z' },
    { t:'p', d:'M0.5 20 Q6 12 12 20 Z' }
  ],
  mountain: [  // peaks
    { t:'p', d:'M4 20 L12 5 L20 20 Z' },
    { t:'p', d:'M1.5 20 L6.5 11 L10.5 20 Z' },
    { t:'p', d:'M13.5 20 L18.5 9 L22.5 20 Z' }
  ],
  abyss: [  // pit (concentric)
    { t:'c', x:12, y:13, r:6 },
    { t:'c', x:12, y:13, r:2.6 }
  ],
  necromantic: [  // dark rune cross
    { t:'l', d:'M12 4 V20' },
    { t:'l', d:'M6 8 H18' },
    { t:'l', d:'M9 16 H15' },
    { t:'c', x:12, y:12, r:1.4 }
  ],
  ruins: [  // broken columns
    { t:'r', x:6, y:7, w:4.5, h:10 },
    { t:'r', x:14.5, y:9, w:3.5, h:8 },
    { t:'p', d:'M5 6.5 H11.5 L14 3.5 L16 6.5 H19' },
    { t:'r', x:5, y:16.5, w:14, h:2 }
  ],
  temple: [  // facade + columns
    { t:'p', d:'M12 4 L2.5 12 H21.5 Z' },
    { t:'r', x:4.5, y:12, w:15, h:8 },
    { t:'r', x:6.5, y:14.5, w:3.2, h:5.5 },
    { t:'r', x:10.6, y:14.5, w:2.8, h:5.5 },
    { t:'r', x:14.6, y:14.5, w:3.2, h:5.5 }
  ],
  water: [  // waves
    { t:'l', d:'M3 9 L7 6 L11 9 L15 6 L19 9' },
    { t:'l', d:'M3 14 L7 11 L11 14 L15 11 L19 14' },
    { t:'l', d:'M5 19 L9 16 L13 19 L17 16 L20 19' }
  ],
  desert: [  // sun + dunes
    { t:'c', x:8, y:7, r:3 },
    { t:'p', d:'M3.5 20 Q12 12 20.5 20 Z' },
    { t:'p', d:'M10 20 Q15 16.5 21 19 Z' }
  ],
  swamp: [  // cattails + reeds
    { t:'r', x:6.5, y:13, w:1.1, h:7 }, { t:'c', x:7, y:11.5, r:1.9 },
    { t:'r', x:11.4, y:12, w:1.2, h:8 }, { t:'c', x:12, y:9.8, r:2.3 },
    { t:'r', x:16.4, y:13, w:1.1, h:7 }, { t:'c', x:17, y:11.5, r:1.9 },
    { t:'l', d:'M2 20 H22' }
  ],
  snow: [  // snowflake
    { t:'l', d:'M12 4 V20' },
    { t:'l', d:'M4 8 V16' },
    { t:'l', d:'M20 8 V16' },
    { t:'c', x:12, y:12, r:1.8 }
  ],

  // ---------- Settlements (key = SETTLEMENT_ICON_KEYS[rating]) ----------
  hut: [  // shack
    { t:'p', d:'M4 20 V14 L12 9 L20 14 V20 Z' },
    { t:'r', x:8, y:14, w:8, h:6 },
    { t:'r', x:11, y:16, w:2, h:4 }
  ],
  camp: [  // tent
    { t:'p', d:'M4 19 L12 8 L20 19 Z' },
    { t:'p', d:'M6 19 H18' },
    { t:'r', x:11, y:13.5, w:2, h:3.5 }
  ],
  hamlet: [  // two small houses
    { t:'p', d:'M3 17 L7.5 11 L12 17 Z' }, { t:'r', x:4.3, y:17, w:6.4, h:4 },
    { t:'p', d:'M13.5 18 L17.5 13.5 L21.5 18 Z' }, { t:'r', x:14.7, y:18, w:5.6, h:3 }
  ],
  village: [  // three houses
    { t:'p', d:'M2.5 18 L6.5 12 L10.5 18 Z' }, { t:'r', x:3.8, y:18, w:5.4, h:3.5 },
    { t:'p', d:'M9 19 L12.8 14.5 L16.6 19 Z' }, { t:'r', x:10.2, y:19, w:5.2, h:2.8 },
    { t:'p', d:'M14 18.5 L17.5 14 L21 18.5 Z' }, { t:'r', x:15.2, y:18.5, w:4.6, h:3 }
  ],
  town: [  // walled buildings
    { t:'r', x:4, y:10, w:16, h:9 },
    { t:'p', d:'M4 10 L4 6 H8 V10' }, { t:'p', d:'M11 10 V6 H13 V10' }, { t:'p', d:'M16 10 V6 H20 V10' },
    { t:'p', d:'M6 19 L6 13 H11 L11 19 Z' }, { t:'p', d:'M13 19 V14 H18 V19 Z' },
    { t:'r', x:2, y:19, w:20, h:1.5 }
  ],
  castle: [  // towers + keep
    { t:'r', x:5, y:8, w:14, h:11 },
    { t:'r', x:6.5, y:4.5, w:3.2, h:5 }, { t:'r', x:14.3, y:4.5, w:3.2, h:5 },
    { t:'r', x:9, y:13, w:2.4, h:6 },
    { t:'p', d:'M6.5 4.5 V3 H9.7 V4.5 M14.3 4.5 V3 H17.5 V4.5 M5 8 H3.5 V10 H5 M20 8 H21.5 V10 H20' },
    { t:'r', x:2, y:19, w:20, h:1.5 }
  ],
  city: [  // skyline
    { t:'r', x:3.5, y:11, w:3.5, h:9 }, { t:'r', x:7.8, y:8, w:3.2, h:12 },
    { t:'r', x:11.8, y:12, w:3.4, h:8 }, { t:'r', x:16, y:7, w:3.6, h:13 },
    { t:'r', x:19.5, y:12, w:2.5, h:8 },
    { t:'r', x:3.5, y:20, w:18.5, h:1.5 }
  ],

  // ---------- Annotations (key = ANNOTATION_TYPES id in core.js) ----------
  poi: [  // landmark pin
    { t:'c', x:12, y:8, r:5 },
    { t:'p', d:'M8.5 11 L12 20 L15.5 11 Z' }
  ],
  hazard: [  // warning triangle + !
    { t:'p', d:'M12 5 L21 19 H3 Z' },
    { t:'r', x:11, y:11, w:2, h:4 },
    { t:'c', x:12, y:17, r:1.2 }
  ],
  lore: [  // scroll
    { t:'r', x:6, y:6, w:12, h:12 },
    { t:'c', x:6, y:6, r:2 }, { t:'c', x:18, y:6, r:2 },
    { t:'c', x:6, y:18, r:2 }, { t:'c', x:18, y:18, r:2 },
    { t:'l', d:'M9 11 H15 M9 14 H15' }
  ],
  note: [  // paper with writing
    { t:'r', x:6, y:4, w:12, h:16 },
    { t:'p', d:'M14 4 V8 H18 Z' },
    { t:'l', d:'M9 11 H14 M9 14 H15 M9 17 H13' }
  ],
  marker: [  // flag + pole
    { t:'l', d:'M6.5 3 V21' },
    { t:'p', d:'M6.5 4 H18 L15 7.5 L18 11 H6.5 Z' }
  ]
};

// rating -> vector icon key (map index + rating+3)
const SETTLEMENT_ICON_KEYS = { '-3':'hut', '-2':'camp', '-1':'hamlet', '0':'village', '1':'town', '2':'castle', '3':'city' };

function tracePath(ctx, d) {
  const toks = d.trim().split(/[\s,]+/);
  let i = 0;
  while (i < toks.length) {
    const cmd = toks[i++];
    if (cmd === 'Z' || cmd === 'z') { ctx.closePath(); continue; }
    const x = parseFloat(toks[i++]);
    const y = parseFloat(toks[i++]);
    if (cmd === 'M') ctx.moveTo(x, y);
    else if (cmd === 'L') ctx.lineTo(x, y);
  }
}

// Draw a vector icon on any 2D context. Returns true if drawn, false if no such key.
function drawIcon(ctx, key, x, y, size, color, opts) {
  const parts = ICONS[key];
  if (!parts) return false;
  opts = opts || {};
  const outline = opts.outline !== undefined ? opts.outline : 'rgba(0,0,0,0.5)';
  const lw = opts.lineWidth !== undefined ? opts.lineWidth : 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  for (const p of parts) {
    ctx.beginPath();
    if (p.t === 'c') ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    else if (p.t === 'r') ctx.rect(p.x, p.y, p.w, p.h);
    else tracePath(ctx, p.d);
    if (p.t === 'l') {
      ctx.strokeStyle = p.color || color;
      ctx.lineWidth = lw * 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color || color;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  ctx.restore();
  return true;
}

// Icon as an SVG data URI for <img> in DOM legends/palettes (same art as canvas).
function iconDataURI(key, color, size) {
  const parts = ICONS[key];
  if (!parts) return '';
  size = size || 18;
  const outline = 'rgba(0,0,0,0.5)';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">`;
  for (const p of parts) {
    if (p.t === 'c') {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.color || color}" stroke="${outline}" stroke-width="1"/>`;
    } else if (p.t === 'r') {
      svg += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.color || color}" stroke="${outline}" stroke-width="1"/>`;
    } else if (p.t === 'l') {
      svg += `<path d="${p.d}" fill="none" stroke="${p.color || color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      svg += `<path d="${p.d}" fill="${p.color || color}" stroke="${outline}" stroke-width="1"/>`;
    }
  }
  svg += '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Unified dispatch: vector if iconStyle==='vector' and a vector icon exists,
// otherwise falls back to emoji text (original look). Used by live render + PNG export.
function drawIconOrEmoji(ctx, opt) {
  const key = opt.key;
  const emoji = opt.emoji;
  const color = opt.color || '#fff';
  if (iconStyle === 'vector' && key && ICONS[key]) {
    return drawIcon(ctx, key, opt.x, opt.y, opt.size, color, opt);
  }
  // emoji fallback
  ctx.font = `${opt.size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = opt.textBaseline || 'middle';
  ctx.fillStyle = opt.fillStyle || 'rgba(255,255,255,0.85)';
  ctx.fillText(emoji, opt.x, opt.y);
  return true;
}

// Legend <span> helper for terrain/annotation lists: vector img or emoji text.
function iconLegendHTML(key, emoji, color, bodyHtml) {
  if (iconStyle === 'vector' && key && ICONS[key]) {
    return `<img src="${iconDataURI(key, color, 15)}" style="vertical-align:middle;margin-right:4px;"/>${bodyHtml || ''}`;
  }
  return `<span style="margin-right:4px;">${emoji}</span>${bodyHtml || ''}`;
}