import sys

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find drawWalls
start = None
for i, line in enumerate(lines):
    if 'function drawWalls' in line:
        start = i
        break

if start is None:
    print('FAIL: drawWalls not found')
    sys.exit(1)

# Count braces to find end
bc = 0
end = start
for i in range(start, len(lines)):
    for ch in lines[i]:
        if ch == '{': bc += 1
        if ch == '}': bc -= 1
    if bc == 0 and i > start:
        end = i
        break

print(f'drawWalls: lines {start+1}-{end+1}')

# Read the actual content from the file to see template literal style
actual = ''.join(lines[start:end+1])

# Check if backtick template literals are used
if '`bold ${towerSize}px sans-serif`' in actual:
    print('Using backtick template literals')
else:
    print('NOT using backtick template literals')

if '`bold ${HEX_SIZE * 0.3}px sans-serif`' in actual:
    print('Using backtick template literals for gate label')
else:
    print('NOT using backtick template literals for gate label')

new_code = '''function drawWalls(qMin, qMax, rMin, rMax) {
  const wallHexes = [], gateHexes = [];
  for (let q = qMin; q <= qMax; q++) {
    for (let r = rMin; r <= rMax; r++) {
      const h = getHex(q, r);
      if (h.wall) wallHexes.push({ q, r });
      if (h.wallGate) gateHexes.push({ q, r });
    }
  }
  if (wallHexes.length === 0 && gateHexes.length === 0) return;

  const wallSet = new Set(wallHexes.map(h => hexKey(h.q, h.r)));
  const gateSet = new Set(gateHexes.map(h => hexKey(h.q, h.r)));
  const allWallSet = new Set([...wallSet, ...gateSet]);

  const dirs = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];

  // Fill wall hexes solid (no mortar lines between them)
  for (const { q, r } of wallHexes) {
    const p = hexToPixel(q, r);
    const c = hexCorners(p.x, p.y, HEX_SIZE);
    ctx.beginPath();
    c.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fillStyle = '#5A4A3A';
    ctx.fill();
  }

  // Collect outer edges (where neighbor is not wall/gate)
  const segs = [];
  for (const { q, r } of wallHexes) {
    const p = hexToPixel(q, r);
    const c = hexCorners(p.x, p.y, HEX_SIZE);
    for (let i = 0; i < 6; i++) {
      if (!allWallSet.has(hexKey(q + dirs[i][0], r + dirs[i][1]))) {
        segs.push({ x1: c[i].x, y1: c[i].y, x2: c[(i + 1) % 6].x, y2: c[(i + 1) % 6].y });
      }
    }
  }
  if (segs.length < 3) return;

  // Build endpoint adjacency map, walk into connected polylines
  const adj = new Map();
  function epk(x, y) { return Math.round(x * 1000) + ',' + Math.round(y * 1000); }
  for (let i = 0; i < segs.length; i++) {
    const k1 = epk(segs[i].x1, segs[i].y1), k2 = epk(segs[i].x2, segs[i].y2);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(i);
    adj.get(k2).push(i);
  }

  const visited = new Set();
  const polylines = [];
  for (let start = 0; start < segs.length; start++) {
    if (visited.has(start)) continue;
    visited.add(start);
    const pts = [{ x: segs[start].x1, y: segs[start].y1 }, { x: segs[start].x2, y: segs[start].y2 }];
    // Forward from tail
    let tail = epk(segs[start].x2, segs[start].y2);
    let more = true;
    while (more) {
      more = false;
      for (const ci of adj.get(tail) || []) {
        if (visited.has(ci)) continue;
        visited.add(ci);
        const s = segs[ci];
        if (epk(s.x1, s.y1) === tail) { tail = epk(s.x2, s.y2); pts.push({ x: s.x2, y: s.y2 }); }
        else { tail = epk(s.x1, s.y1); pts.push({ x: s.x1, y: s.y1 }); }
        more = true; break;
      }
    }
    // Backward from head
    let head = epk(segs[start].x1, segs[start].y1);
    more = true;
    while (more) {
      more = false;
      for (const ci of adj.get(head) || []) {
        if (visited.has(ci)) continue;
        visited.add(ci);
        const s = segs[ci];
        if (epk(s.x1, s.y1) === head) { head = epk(s.x2, s.y2); pts.unshift({ x: s.x2, y: s.y2 }); }
        else { head = epk(s.x1, s.y1); pts.unshift({ x: s.x1, y: s.y1 }); }
        more = true; break;
      }
    }
    if (pts.length > 1) polylines.push(pts);
  }

  // Draw each polyline as one continuous path
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const poly of polylines) {
    // Shadow
    ctx.beginPath();
    ctx.moveTo(poly[0].x + 1.5, poly[0].y + 2);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x + 1.5, poly[i].y + 2);
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 13;
    ctx.stroke();
    // Wall body
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 11;
    ctx.stroke();
    // Highlight
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y - 1);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y - 1);
    ctx.strokeStyle = '#A0896C';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Gates
  for (const { q, r } of gateHexes) {
    const p = hexToPixel(q, r);
    const corners = hexCorners(p.x, p.y, HEX_SIZE);
    // Glow fill
    ctx.fillStyle = 'rgba(255, 200, 50, 0.25)';
    ctx.beginPath();
    corners.forEach((c, i) => i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y));
    ctx.closePath();
    ctx.fill();
    // Pillars on outward edges
    for (let i = 0; i < 6; i++) {
      if (!wallSet.has(hexKey(q + dirs[i][0], r + dirs[i][1])) && !gateSet.has(hexKey(q + dirs[i][0], r + dirs[i][1]))) {
        const c1 = corners[i], c2 = corners[(i + 1) % 6];
        ctx.strokeStyle = '#8B7355';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c1.x + (c2.x - c1.x) * 0.15, c1.y + (c2.y - c1.y) * 0.15);
        ctx.moveTo(c2.x, c2.y);
        ctx.lineTo(c2.x - (c2.x - c1.x) * 0.15, c2.y - (c2.y - c1.y) * 0.15);
        ctx.stroke();
      }
    }
    const ts = HEX_SIZE * 0.45;
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${ts}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u{1F3DB}\uFE0F', p.x, p.y - 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
    ctx.font = `bold ${HEX_SIZE * 0.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('\u57CE\u95E8', p.x, p.y + HEX_SIZE * 0.45);
  }
}
'''

lines[start:end+1] = [new_code + '\n']

with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('SUCCESS')