// Galaxy generation (research/04 §1): jittered-grid star placement with spacing rejection, star colours, planet types per colour,
// max-population rolls, mineral specials, artifacts, rocks, nebulae, Orion, homeworld selection.
// ONE planet per star (S.planets[i] belongs to S.stars[i]). Worker-safe.
MOO.def(function (M) {
  'use strict';
  const G = M.Sim.Galaxy = {};
  const Geo = M.Sim.Geo;

  // grid cells (W x H) = star count. 'colossal' is a remake extension beyond the original's 108.
  G.SIZES = {
    small:    { w: 6,  h: 4,  stars: 24,  nebulae: [0, 1] },
    medium:   { w: 8,  h: 6,  stars: 48,  nebulae: [1, 3] },
    large:    { w: 10, h: 7,  stars: 70,  nebulae: [2, 3] },
    huge:     { w: 12, h: 9,  stars: 108, nebulae: [2, 4] },
    colossal: { w: 16, h: 10, stars: 160, nebulae: [3, 5] },
  };
  // planet type order (index = code used by the rules; 0 = no planet). 'gaia' is a growth class shown as a 14th label, never rolled.
  G.TYPES = ['none', 'radiated', 'toxic', 'inferno', 'dead', 'tundra', 'barren', 'minimal', 'desert', 'steppe', 'arid', 'ocean', 'jungle', 'terran'];
  G.SPECIALS = ['ultrapoor', 'poor', 'normal', 'artifacts', 'rich', 'ultrarich', 'orion'];   // index 0..6
  G.COLORS = ['yellow', 'red', 'green', 'blue', 'white', 'purple'];                              // purple = neutron star
  const T = { none: 0, radiated: 1, toxic: 2, inferno: 3, dead: 4, tundra: 5, barren: 6, minimal: 7, desert: 8, steppe: 9, arid: 10, ocean: 11, jungle: 12, terran: 13 };

  // roll (1..20, minus 4 inside a nebula) -> type, by star colour. Each entry [lastRollInclusive, typeIndex]; first match wins; unlisted => none.
  const TYPE_TABLE = {
    yellow: [[-1, 1], [0, 2], [1, 3], [2, 5], [3, 6], [4, 7], [5, 8], [6, 9], [8, 10], [10, 11], [12, 12], [20, 13]],
    red:    [[1, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [10, 8], [12, 9], [15, 10], [17, 11], [19, 12], [20, 13]],
    green:  [[1, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [9, 8], [11, 9], [13, 10], [15, 11], [17, 12], [20, 13]],
    white:  [[2, 0], [3, 1], [5, 2], [7, 3], [9, 4], [11, 5], [13, 6], [15, 7], [17, 8], [18, 9], [19, 10], [20, 11]],
    blue:   [[3, 0], [5, 1], [7, 2], [9, 3], [11, 4], [13, 5], [15, 6], [17, 7], [18, 8], [19, 9], [20, 10]],
    purple: [[4, 0], [9, 1], [12, 2], [15, 3], [17, 4], [18, 5], [19, 6], [20, 7]],
  };
  function rollType(color, r) {
    const tab = TYPE_TABLE[color];
    if (color === 'yellow' && r < -1) return 0;
    for (let i = 0; i < tab.length; i++) if (r <= tab[i][0]) return tab[i][1];
    return 0;
  }

  // nebula rectangle sets: type -> 4 pieces [x0,y0,x1,y1] (inclusive offsets from the nebula origin)
  const NEB = [
    [[20, 5, 40, 20], [7, 18, 28, 39], [15, 12, 31, 27], [31, 2, 36, 4]],
    [[10, 17, 26, 37], [20, 13, 38, 24], [27, 13, 41, 16], [30, 5, 41, 16]],
    [[9, 2, 22, 25], [3, 8, 25, 21], [23, 18, 41, 32], [26, 15, 35, 36]],
    [[25, 12, 30, 28], [8, 15, 28, 29], [10, 9, 22, 15], [16, 7, 23, 9]],
    [[7, 2, 25, 19], [15, 15, 37, 28], [21, 22, 41, 35], [25, 35, 41, 39]],
    [[3, 14, 35, 20], [8, 21, 36, 35], [14, 2, 26, 31], [9, 10, 34, 15]],
    [[13, 3, 27, 33], [9, 11, 34, 32], [19, 33, 27, 37], [5, 22, 8, 30]],
    [[8, 8, 37, 25], [15, 24, 34, 31], [28, 2, 35, 7], [37, 10, 39, 18]],
    [[8, 6, 35, 31], [5, 1, 12, 8], [5, 12, 9, 21], [27, 3, 37, 10]],
    [[4, 2, 42, 18], [8, 18, 38, 30], [13, 14, 38, 33], [37, 17, 41, 29]],
  ];

  function maxPopBase(type, R) {
    switch (type) {
      case 0: return 10;
      case 1: case 2: case 3: return R.int(1, 7) * 5 + 5;
      case 4: case 5: return R.int(1, 7) * 5 + 15;
      case 6: case 7: return R.int(1, 5) * 5 + 25;
      case 8: return R.int(1, 4) * 5 + 30;
      case 9: return R.int(1, 4) * 5 + 40;
      case 10: return R.int(1, 4) * 5 + 50;
      case 11: return R.int(1, 4) * 5 + 60;
      case 12: return R.int(1, 4) * 5 + 70;
      default: return R.int(1, 4) * 5 + 80;
    }
  }

  function genStars(S, R, size) {
    const W = size.w, H = size.h, n = W * H, px = [], py = [];
    for (let h = 0; h < H; h++) for (let w = 0; w < W; w++) {
      const idx = h * W + w;
      let x, y, tries = 0;
      for (;;) {
        x = R.int(1, 43) + 28 * w + 9; y = R.int(1, 51) + 32 * h + 7;
        let bad = false;
        if (tries++ < 400) {
          for (let i = 0; i < idx; i++) {
            const d = Geo.distFast(px[i] - x, py[i] - y);
            if ((px[i] < x || py[i] < y) ? d < 20 : d < 10) { bad = true; break; }
          }
        }
        if (!bad) break;
      }
      px.push(x); py.push(y);
    }
    let maxx = 0, maxy = 0;
    S.stars = [];
    for (let i = 0; i < n; i++) {
      const s = { id: i, name: '', x: px[i] + 4, y: py[i] + 4, color: 'yellow', look: 0, frame: 0, nebula: false };
      maxx = Math.max(maxx, s.x); maxy = Math.max(maxy, s.y);
      S.stars.push(s);
    }
    S.galaxy = { cols: W, rows: H, w: maxx + 27, h: maxy + 25, maxx0: (W - 1) * 28 + 20, maxy0: (H - 1) * 32 + 16 };
  }

  function genNebulae(S, R, size) {
    const g = S.galaxy; S.nebulae = [];
    const want = R.int(size.nebulae[0], size.nebulae[1]);
    let attempts = 0;
    while (S.nebulae.length < want && attempts++ < 200) {
      const type = R.int(0, 9), ox = R.int(1, Math.max(1, g.maxx0 - 70)) + 4, oy = R.int(1, Math.max(1, g.maxy0 - 70)) + 4;
      let ok = true;
      for (const o of S.nebulae) { if (o.type === type || (Math.abs(o.ox - ox) < 60 && Math.abs(o.oy - oy) < 60)) { ok = false; break; } }
      if (ok) S.nebulae.push({ type, ox, oy, rects: NEB[type].map(r => [ox + r[0], oy + r[1], ox + r[2], oy + r[3]]) });
    }
  }
  const inNebula = (S, x, y) => S.nebulae.some(n => n.rects.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]));

  // combat-terrain rocks (research/04 verification C2): d100, -20 ultra-rich / -10 rich, -(15 - type); MANY below 15, SOME below 40 (strict, as in 1oom; the Strategy Guide's percentages fit <=)
  G.rocksFor = function (roll, special, type) {
    let d = roll; if (special === 5) d -= 20; else if (special === 4) d -= 10; d -= (15 - type);
    return d < 15 ? 'many' : d < 40 ? 'some' : 'none';
  };

  function genPlanets(S, R) {
    S.planets = [];
    for (const s of S.stars) {
      const roll = R.int(0, 19);
      s.color = roll <= 2 ? 'yellow' : roll <= 8 ? 'red' : roll <= 13 ? 'green' : roll <= 16 ? 'blue' : roll <= 18 ? 'white' : 'purple';
      s.look = R.int(0, 1) * 6; s.frame = R.int(0, 49); R.int(0, 3);
      s.nebula = inNebula(S, s.x, s.y);
      const r = R.int(1, 20) - (s.nebula ? 4 : 0);
      const type = rollType(s.color, r);
      let pop = maxPopBase(type, R);
      if (type > 0) {                                            // d10 of 1 or 10 (20%) adjusts by ∓/±20 and re-rolls (a chain)
        let d = R.int(1, 10);
        while (d === 1 || d === 10) { if (d === 1) pop -= 20; else pop += 20; pop = Math.max(pop, 10); d = R.int(1, 10); }
      }
      pop = Math.min(pop, 120);
      const bg = s.nebula ? 0 : R.int(1, 4);
      let special = 2;                                            // normal
      if (type >= T.steppe) {
        const m = s.color === 'red' ? 4 : s.color === 'green' ? 2 : 0;
        const d1 = R.int(1, 20) - m; if (d1 <= 2) special = 1;
        const d2 = R.int(1, 20) - m; if (d2 <= 5 && special === 1) special = 0;
      }
      const n = (s.nebula ? 8 : 0) + (s.color === 'blue' ? 2 : s.color === 'purple' ? 5 : 0);
      if (type > 0) {
        const d3 = R.int(1, 20) - n; if ((9 - type) > d3) special = 4;
        const d4 = R.int(1, 20) - n; if (d4 < 6 && special === 4) special = 5;
        if (type >= T.minimal && type <= T.ocean && special === 2 && R.int(1, 10) === 1) special = 3;
      }
      let growth = 'normal';
      if (type > 0 && type < T.minimal) growth = 'hostile';
      else if (type > T.desert && R.int(1, 12) === 1) { growth = 'fertile'; pop += ((pop / 20) | 0) * 5; }
      if (type === 0) { growth = 'normal'; special = 2; pop = 10; }
      const rocks = G.rocksFor(R.int(1, 100), special, type);
      S.planets.push({
        id: s.id, starId: s.id, type: G.TYPES[type], typeIdx: type, maxPop: pop, special: G.SPECIALS[special], growth, rocks, bg,
        gfx: R.int(0, 5), owner: -1, name: '',
      });
    }
  }

  function placeOrion(S, R) {
    const i = R.int(0, S.stars.length - 1), p = S.planets[i];
    p.type = 'terran'; p.typeIdx = T.terran; p.maxPop = 120; p.growth = 'normal'; p.special = 'orion';
    S.orion = i; S.stars[i].orion = true; S.stars[i].name = 'Orion';
  }

  // Pick homeworld stars for `count` empires. Rules: interior cells (not on the map edge), never Orion, spaced >= `spacing` map units
  // apart, and at least one other colonisable (type >= minimal) non-Orion planet within 29 units. Spacing relaxes if the map is tight.
  G.chooseHomeworlds = function (S, R, count) {
    const W = S.galaxy.cols, H = S.galaxy.rows, n = S.stars.length;
    // (spacing in map units, allow edge cells): relax gradually so crowded small maps still get a legal layout
    for (const [spacing, edges] of [[80, false], [72, false], [64, false], [56, false], [56, true], [48, true], [40, true], [32, true]]) {
      for (let attempt = 0; attempt < 200; attempt++) {
        const picks = [];
        let ok = true;
        for (let k = 0; k < count && ok; k++) {
          let idx = -1;
          for (let t = 0; t < 60; t++) {
            const c = !edges && (n > 24 || count <= 3) ? R.int(1, W - 2) + R.int(1, H - 2) * W : R.int(0, n - 1);
            if (c === S.orion || picks.includes(c)) continue;
            if (S.planets[c].special === 'orion') continue;
            const row = Math.floor(c / W), col = c % W;
            if (!edges && (row === 0 || row === H - 1 || col === 0 || col === W - 1)) continue;   // not on the edge
            idx = c; break;
          }
          if (idx < 0) { ok = false; break; }
          for (const p of picks) if (Geo.unitDist(S, p, idx) < spacing) { ok = false; break; }
          if (!ok) break;
          let near = false;
          for (let j = 0; j < n; j++) if (j !== idx && j !== S.orion && S.planets[j].typeIdx >= T.minimal && Geo.unitDist(S, idx, j) <= 29) { near = true; break; }
          if (!near) { ok = false; break; }
          picks.push(idx);
        }
        if (ok && picks.length === count) return picks;
      }
    }
    return null;
  };

  // Turn a chosen star into a standard homeworld: yellow star, Terran planet, max pop 100, normal growth/minerals.
  G.makeHomeworld = function (S, starId, name) {
    const s = S.stars[starId], p = S.planets[starId];
    s.color = 'yellow'; s.name = name;
    p.type = 'terran'; p.typeIdx = T.terran; p.maxPop = 100; p.growth = 'normal'; p.special = 'normal'; p.name = name;
  };

  // Build the whole map into S (S.rs must be seeded). Returns S. `players` = number of empires (2..6) so homeworld selection can be validated.
  G.generate = function (S, sizeId, players) {
    const size = G.SIZES[sizeId] || G.SIZES.large, R = M.RNG.bind(S.rs);
    for (let regen = 0; regen < 20; regen++) {
      genStars(S, R, size); genNebulae(S, R, size); genPlanets(S, R); placeOrion(S, R);
      S.homeCandidates = G.chooseHomeworlds(S, R, players);
      if (S.homeCandidates) break;
    }
    if (!S.homeCandidates) throw new Error('could not place homeworlds');
    // names: from the name pool (main thread data); fall back to numbered names in workers/tests
    const pool = (M.Data.names && M.Data.names.stars) ? M.Data.names.stars.filter(x => x !== 'Orion') : [];
    const names = pool.slice(); R.shuffle(names);
    S.stars.forEach((s, i) => { if (!s.name) s.name = names[i] || ('Star ' + (i + 1)); S.planets[i].name = S.planets[i].name || s.name; });
    S.planets[S.orion].name = 'Orion';
    S.guardian = { alive: true, star: S.orion };
    return S;
  };

  G.isHostile = p => p.typeIdx >= 1 && p.typeIdx <= 6;
  G.isStandard = p => p.typeIdx >= 7;
});
