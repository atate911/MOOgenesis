// Map geometry: integer "map units" and the parsec-step distance model (research/04 §1.2, verified against 1oom util_math.c — rules/numbers only).
// Worker-safe. Distances between stars in PARSECS are what fuel range, scanner range, contact, ETA and travel use.
// A parsec is ONE double step (5 units, then 6 units if the target is not yet reached) along a heading quantised to whole degrees, with every axis component
// TRUNCATED: exactly 11 units on an axis, but only ~9 units when the heading is a few degrees off an axis and ~9.9 on a diagonal (so parsecs >= ceil(euclid/11)).
MOO.def(function (M) {
  'use strict';
  const Geo = M.Sim.Geo = {};

  // dist_fast: cheap octagonal distance in map units (used for star spacing, scanner radii inside systems, homeworld checks)
  Geo.distFast = function (dx, dy) {
    dx = dx < 0 ? -dx : dx; dy = dy < 0 ? -dy : dy;
    return dx > dy ? dx + ((dy / 2) | 0) : dy + ((dx / 2) | 0);
  };

  // floor(256*tan(deg)) for degrees 0-21 / 22-44 / 45-66 / 67-89 (the original's four first-quadrant slope tables)
  const TAN0 = [0, 4, 8, 13, 17, 22, 26, 31, 35, 40, 45, 49, 54, 59, 63, 68, 73, 78, 83, 88, 93, 98];
  const TAN22 = [103, 108, 113, 119, 124, 130, 136, 141, 147, 153, 159, 166, 172, 179, 185, 192, 200, 207, 214, 222, 230, 238, 247];
  const TAN45 = [256, 265, 274, 284, 294, 305, 316, 327, 339, 352, 365, 379, 394, 409, 426, 443, 461, 481, 502, 524, 548, 574];
  const TAN67 = [603, 633, 666, 703, 743, 787, 837, 892, 955, 1026, 1108, 1204, 1317, 1451, 1616, 1821, 2085, 2435, 2926, 3661, 4885, 7331, 14669];

  // heading (whole degrees 0..90) of a first-quadrant vector. Quirks kept: the last 22-44 bucket answers 43, a vertical-ish slope >= 14669 answers 90, dx = 0 answers 90.
  function headingQ1(dx, dy) {
    if (dx === 0) return 90;
    const slope = Math.trunc(dy * 256 / dx);
    if (slope < 256) {
      if (slope >= 103) { for (let i = 0; i < TAN22.length; i++) if (slope < TAN22[i]) return 21 + i; return 43; }
      for (let i = 0; i < TAN0.length; i++) if (slope < TAN0[i]) return i - 1;
      return 21;
    }
    if (slope >= 600) { for (let i = 0; i < TAN67.length; i++) if (slope < TAN67[i]) return 66 + i; return 90; }
    for (let i = 0; i < TAN45.length; i++) if (slope < TAN45[i]) return 44 + i;
    return 66;
  }
  // 0 = +x, 90 = +y (down); the quadrant is folded onto the first one (a heading of exactly 0 in quadrant IV is 360, as in the original)
  function angle(dx, dy) {
    if (dx >= 0) return dy >= 0 ? headingQ1(dx, dy) : 360 - headingQ1(dx, -dy);
    return dy >= 0 ? 180 - headingQ1(-dx, dy) : 180 + headingQ1(-dx, -dy);
  }
  Geo.angle = angle;

  // 65536*sin / cos per whole degree. The original's sin table is the nearest integer and its cos table the floor; the two exact-half entries differ by one
  // (sin 30° = 32768 but cos 60° = 32767), which decides 6*sin(30°) = 3 vs 6*cos(60°) = 2.
  const SIN = [], COS = [];
  for (let a = 0; a <= 90; a++) { SIN[a] = Math.floor(65536 * Math.sin(a * Math.PI / 180) + 0.06); COS[a] = Math.floor(65536 * Math.cos(a * Math.PI / 180) + 1e-6); }
  COS[60] = 32767;
  // signed whole-unit components of a step of `dist` along heading `a` (magnitude truncated, then the sign applied)
  function stepX(a, dist) {
    let neg = false;
    if (a < 91) { /* quadrant I */ } else if (a < 181) { a = 180 - a; neg = true; } else if (a < 271) { a -= 180; neg = true; } else a = 360 - a;
    const r = a === 0 ? dist : Math.trunc(dist * COS[a] / 65536);
    return neg ? -r : r;
  }
  function stepY(a, dist) {
    let neg = false;
    if (a < 91) { /* quadrant I */ } else if (a < 181) a = 180 - a; else if (a < 271) { a -= 180; neg = true; } else { a = 360 - a; neg = true; }
    const r = a === 90 ? dist : Math.trunc(dist * SIN[a] / 65536);
    return neg ? -r : r;
  }

  // Advance (x,y) toward (x1,y1) by `dist` map units along a whole-degree heading, never overshooting either coordinate. Returns [x,y].
  // Vectors longer than 255 on an axis are halved (toward zero) before the heading is taken; the overshoot clamp uses the sign of that (possibly halved) vector.
  Geo.goLine = function (x, y, x1, y1, dist) {
    if (!(dist > 0) || (x === x1 && y === y1)) return [x, y];
    let dx = x1 - x, dy = y1 - y;
    if (Math.abs(dx) > 255 || Math.abs(dy) > 255) { dx = Math.trunc(dx / 2); dy = Math.trunc(dy / 2); }
    const a = angle(dx, dy);
    let nx = x + stepX(a, dist), ny = y + stepY(a, dist);
    if (dx >= 0) { if (nx > x1) nx = x1; } else if (nx < x1) nx = x1;
    if (dy >= 0) { if (ny > y1) ny = y1; } else if (ny < y1) ny = y1;
    return [nx, ny];
  };

  // Parsec distance between two points: count 5+6 unit double-steps along the line until reaching the target.
  Geo.parsecsXY = function (ax, ay, bx, by) {
    let x = ax, y = ay, n = 0, guard = 0;
    while ((x !== bx || y !== by) && guard++ < 400) {
      let p = Geo.goLine(x, y, bx, by, 5); x = p[0]; y = p[1];
      if (x !== bx || y !== by) { p = Geo.goLine(x, y, bx, by, 6); x = p[0]; y = p[1]; }
      n++;
    }
    return n;
  };

  // cached symmetric star-to-star parsec table (per stars array identity; rebuilt automatically for new snapshots).
  // Like the original, every pair is measured once from the LOWER star id to the higher one and mirrored.
  const cache = new WeakMap();
  function table(S) {
    let t = cache.get(S.stars);
    if (!t) { t = { n: S.stars.length, d: new Uint8Array(S.stars.length * S.stars.length).fill(255) }; cache.set(S.stars, t); }
    return t;
  }
  Geo.parsecs = function (S, a, b) {
    if (a === b) return 0;
    const t = table(S), i = a * t.n + b;
    let v = t.d[i];
    if (v === 255) {
      const lo = a < b ? a : b, hi = a < b ? b : a, A = S.stars[lo], B = S.stars[hi];
      v = Math.min(254, Geo.parsecsXY(A.x, A.y, B.x, B.y));
      t.d[i] = v; t.d[b * t.n + a] = v;
    }
    return v;
  };
  // map-unit distance helper
  Geo.unitDist = function (S, a, b) { const A = S.stars[a], B = S.stars[b]; return Geo.distFast(B.x - A.x, B.y - A.y); };
  // ids of stars within `pc` parsecs of star `a` (excluding itself), nearest first
  Geo.within = function (S, a, pc) {
    const out = [];
    for (let i = 0; i < S.stars.length; i++) { if (i === a) continue; const d = Geo.parsecs(S, a, i); if (d <= pc) out.push(i); }
    return out.sort((p, q) => Geo.parsecs(S, a, p) - Geo.parsecs(S, a, q));
  };
});
