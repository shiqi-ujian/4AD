//  Template: Room
// ============================================================
function generateRoom(centerQ, centerR, w, h) {
  beginBatch();
  for (let q = centerQ; q < centerQ + w; q++) {
    for (let r = centerR; r < centerR + h; r++) {
      setCell(q, r, { terrain: 'floor' });
      // Set walls on perimeter
      if (r === centerR) setWall(q, r, 0, 1);       // top edge
      if (r === centerR + h - 1) setWall(q, r, 2, 1); // bottom edge
      if (q === centerQ) setWall(q, r, 3, 1);        // left edge
      if (q === centerQ + w - 1) setWall(q, r, 1, 1); // right edge
    }
  }
  endBatch();
}

// ============================================================
//  Template: Corridor
// ============================================================
function generateCorridor(centerQ, centerR, type, length, width) {
  beginBatch();
  const halfW = Math.floor(width / 2);

  function fillSegment(q1, r1, q2, r2) {
    const minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        setCell(q, r, { terrain: 'floor' });
      }
    }
  }

  function wallSegment(q1, r1, q2, r2) {
    // Wall the sides of a segment
    const minQ = Math.min(q1, q2), maxQ = Math.max(q1, q2);
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    for (let q = minQ; q <= maxQ; q++) {
      for (let r = minR; r <= maxR; r++) {
        if (r === minR) setWall(q, r, 0, 1);
        if (r === maxR) setWall(q, r, 2, 1);
        if (q === minQ) setWall(q, r, 3, 1);
        if (q === maxQ) setWall(q, r, 1, 1);
      }
    }
  }

  const q0 = centerQ, r0 = centerR;

  if (type === 'straight') {
    fillSegment(q0 - halfW, r0, q0 + halfW, r0 + length - 1);
    wallSegment(q0 - halfW, r0, q0 + halfW, r0 + length - 1);
  } else if (type === 'lshape') {
    const halfLen = Math.floor(length / 2);
    fillSegment(q0 - halfW, r0, q0 + halfW, r0 + halfLen);
    wallSegment(q0 - halfW, r0, q0 + halfW, r0 + halfLen);
    fillSegment(q0 - halfW, r0 + halfLen, q0 + halfLen, r0 + halfLen + halfW);
    wallSegment(q0 - halfW, r0 + halfLen, q0 + halfLen, r0 + halfLen + halfW);
    // Remove wall at junction
    for (let i = -halfW; i <= halfW; i++) {
      setWall(q0 + i, r0 + halfLen, 2, 0);
    }
    for (let j = -halfW; j <= halfW; j++) {
      setWall(q0 - halfW, r0 + halfLen + j, 3, 0);
    }
  } else if (type === 'tshape') {
    const halfLen = Math.floor(length / 2);
    // Vertical stem
    fillSegment(q0 - halfW, r0, q0 + halfW, r0 + halfLen);
    wallSegment(q0 - halfW, r0, q0 + halfW, r0 + halfLen);
    // Horizontal bar at bottom
    fillSegment(q0 - halfLen, r0 + halfLen - halfW, q0 + halfLen, r0 + halfLen + halfW);
    wallSegment(q0 - halfLen, r0 + halfLen - halfW, q0 + halfLen, r0 + halfLen + halfW);
    // Remove walls at junction
    for (let i = -halfW; i <= halfW; i++) {
      setWall(q0 + i, r0 + halfLen, 2, 0);
    }
  } else if (type === 'cross') {
    const halfLen = Math.floor(length / 2);
    // Vertical
    fillSegment(q0 - halfW, r0 - halfLen, q0 + halfW, r0 + halfLen);
    wallSegment(q0 - halfW, r0 - halfLen, q0 + halfW, r0 + halfLen);
    // Horizontal
    fillSegment(q0 - halfLen, r0 - halfW, q0 + halfLen, r0 + halfW);
    wallSegment(q0 - halfLen, r0 - halfW, q0 + halfLen, r0 + halfW);
    // Remove walls at junction
    for (let i = -halfW; i <= halfW; i++) {
      setWall(q0 + i, r0 - halfW, 0, 0);
      setWall(q0 + i, r0 + halfW, 2, 0);
    }
  }
  endBatch();
}

// ============================================================
//  Template: Cave (cellular automata)
// ============================================================
function generateCave(centerQ, centerR, w, h, density) {
  beginBatch();
  const seed = Date.now();

  // Mulberry32 PRNG
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seed);

  // Initialize grid: 0=floor, 1=wall
  const grid = [];
  const halfW = Math.floor(w / 2), halfH = Math.floor(h / 2);
  for (let q = 0; q < w; q++) {
    grid[q] = [];
    for (let r = 0; r < h; r++) {
      // Border always wall
      if (q === 0 || q === w - 1 || r === 0 || r === h - 1) {
        grid[q][r] = 1;
      } else {
        grid[q][r] = rng() < (density / 100) ? 1 : 0;
      }
    }
  }

  // Cellular automata iterations
  for (let iter = 0; iter < 4; iter++) {
    const next = [];
    for (let q = 0; q < w; q++) {
      next[q] = [];
      for (let r = 0; r < h; r++) {
        // Count wall neighbors (8-directional)
        let wallCount = 0;
        for (let dq = -1; dq <= 1; dq++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (dq === 0 && dr === 0) continue;
            const nq = q + dq, nr = r + dr;
            if (nq < 0 || nq >= w || nr < 0 || nr >= h) { wallCount++; continue; }
            if (grid[nq][nr] === 1) wallCount++;
          }
        }
        next[q][r] = wallCount >= 5 ? 1 : (wallCount <= 2 ? 0 : grid[q][r]);
      }
    }
    for (let q = 0; q < w; q++) {
      for (let r = 0; r < h; r++) {
        grid[q][r] = next[q][r];
      }
    }
  }

  // Apply to combat data
  for (let q = 0; q < w; q++) {
    for (let r = 0; r < h; r++) {
      const mq = centerQ - halfW + q;
      const mr = centerR - halfH + r;
      if (grid[q][r] === 1) {
        setCell(mq, mr, { terrain: 'wall_cell' });
      } else {
        setCell(mq, mr, { terrain: 'floor' });
      }
    }
  }

  endBatch();
}

// ============================================================
//  Template: Open Field
// ============================================================
function generateOpenField(centerQ, centerR, w, h, scatter) {
  beginBatch();
  const seed = Date.now() + 1;
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(seed);
  const halfW = Math.floor(w / 2), halfH = Math.floor(h / 2);
  const scatterTerrains = ['difficult', 'cover_half', 'cover_full', 'water', 'elevated'];

  for (let q = -halfW; q < w - halfW; q++) {
    for (let r = -halfH; r < h - halfH; r++) {
      const mq = centerQ + q, mr = centerR + r;
      if (rng() < (scatter / 100)) {
        const t = scatterTerrains[Math.floor(rng() * scatterTerrains.length)];
        setCell(mq, mr, { terrain: t });
      } else {
        setCell(mq, mr, { terrain: 'floor' });
      }
    }
  }
  endBatch();
}

// ============================================================
