// Galaxy generation vs the published distributions (research/04 §1; StrategyWiki-era tables are encoded in the generator).
module.exports = function (M, t) {
  const G = M.Sim.Galaxy, Geo = M.Sim.Geo;
  function gen(size, seed, players) {
    const S = { rs: M.RNG.seedState(seed) };
    G.generate(S, size, players || 4);
    return S;
  }

  t.test('star counts per size', () => {
    t.eq(gen('small', 1).stars.length, 24); t.eq(gen('medium', 1).stars.length, 48);
    t.eq(gen('large', 1).stars.length, 70); t.eq(gen('huge', 1).stars.length, 108); t.eq(gen('colossal', 1).stars.length, 160);
  });

  t.test('deterministic from seed', () => {
    const a = gen('large', 'abc'), b = gen('large', 'abc'), c = gen('large', 'abd');
    t.eq(JSON.stringify(a.stars), JSON.stringify(b.stars)); t.eq(JSON.stringify(a.planets), JSON.stringify(b.planets));
    t.ok(JSON.stringify(a.stars) !== JSON.stringify(c.stars));
  });

  t.test('star spacing: no two stars closer than 10 units, most >= 20', () => {
    const S = gen('huge', 7); let close = 0;
    for (let i = 0; i < S.stars.length; i++) for (let j = i + 1; j < S.stars.length; j++) {
      const d = Geo.unitDist(S, i, j); t.ok(d >= 10, 'stars ' + i + ',' + j + ' at ' + d); if (d < 20) close++;
    }
    t.ok(close < S.stars.length * 0.6, 'too many close pairs: ' + close);
  });

  t.test('star colour shares ≈ 15/30/25/15/10/5 (yellow/red/green/blue/white/purple) over many galaxies', () => {
    const c = { yellow: 0, red: 0, green: 0, blue: 0, white: 0, purple: 0 }; let n = 0;
    for (let i = 0; i < 120; i++) { const S = gen('huge', 'col' + i, 2); S.stars.forEach((s, k) => { if (!S.homeCandidates.includes(k)) { c[s.color]++; n++; } }); }
    t.near(c.yellow / n, 0.15, 0.015, 'yellow'); t.near(c.red / n, 0.30, 0.02, 'red'); t.near(c.green / n, 0.25, 0.02, 'green');
    t.near(c.blue / n, 0.15, 0.015, 'blue'); t.near(c.white / n, 0.10, 0.012, 'white'); t.near(c.purple / n, 0.05, 0.01, 'purple');
  });

  t.test('planet type shares by star colour (yellow terran 40%, red none 5%, blue none 15%, purple none 20%) in normal space', () => {
    const tally = {}; const cnt = {};
    for (let i = 0; i < 160; i++) {
      const S = gen('huge', 'pt' + i, 2);
      S.stars.forEach((s, k) => {
        if (s.nebula || k === S.orion || S.homeCandidates.includes(k)) return;
        const p = S.planets[k]; cnt[s.color] = (cnt[s.color] || 0) + 1; const key = s.color + ':' + p.type; tally[key] = (tally[key] || 0) + 1;
      });
    }
    const share = (c, ty) => (tally[c + ':' + ty] || 0) / cnt[c];
    t.near(share('yellow', 'terran'), 0.40, 0.03, 'yellow terran'); t.near(share('red', 'none'), 0.05, 0.015, 'red none');
    t.near(share('blue', 'none'), 0.15, 0.02, 'blue none'); t.near(share('purple', 'none'), 0.20, 0.04, 'purple none');
    t.near(share('green', 'terran'), 0.15, 0.03, 'green terran'); t.near(share('white', 'minimal'), 0.10, 0.025, 'white minimal');
    t.eq(share('yellow', 'none'), 0, 'yellow never has no planet in normal space');
  });

  t.test('max pop ranges by type', () => {
    const lim = { radiated: [10, 40], toxic: [10, 40], inferno: [10, 40], dead: [20, 50], tundra: [20, 50], barren: [30, 50], minimal: [30, 50] };
    for (let i = 0; i < 30; i++) {
      const S = gen('huge', 'mp' + i, 2);
      S.planets.forEach(p => {
        if (p.id === S.orion) { t.eq(p.maxPop, 120); return; }
        t.between(p.maxPop, 10, 150);          // generation cap 120, +25% fertile bonus can reach 150
        if (p.type === 'none') t.eq(p.maxPop, 10);
      });
    }
    // with the ±20 chain disabled in expectation the base ranges hold for the vast majority
    let inRange = 0, tot = 0;
    for (let i = 0; i < 40; i++) { const S = gen('huge', 'mr' + i, 2); S.planets.forEach(p => { const L = lim[p.type]; if (L) { tot++; if (p.maxPop >= L[0] && p.maxPop <= L[1]) inRange++; } }); }
    t.ok(inRange / tot > 0.78, 'base-range share ' + (inRange / tot));
  });

  t.test('orion: exactly one, terran 120 max pop, special orion, never a homeworld', () => {
    for (let i = 0; i < 40; i++) {
      const S = gen('large', 'or' + i, 5), o = S.planets[S.orion];
      t.eq(S.planets.filter(p => p.special === 'orion').length, 1); t.eq(o.type, 'terran'); t.eq(o.maxPop, 120); t.eq(S.stars[S.orion].name, 'Orion');
      t.ok(!S.homeCandidates.includes(S.orion));
    }
  });

  t.test('homeworld candidates: count, distinct, spaced, not Orion, a colonisable neighbour within 29 units', () => {
    for (const [size, players] of [['small', 3], ['medium', 4], ['large', 5], ['huge', 6], ['small', 6]]) {
      for (let i = 0; i < 12; i++) {
        const S = gen(size, 'hw' + size + i, players), h = S.homeCandidates;
        t.eq(h.length, players); t.eq(new Set(h).size, players);
        let min = 1e9; for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) min = Math.min(min, Geo.unitDist(S, h[a], h[b]));
        t.ok(min >= 32, size + ' min spacing ' + min);
        h.forEach(id => { t.ok(id !== S.orion); let near = false; for (let j = 0; j < S.stars.length; j++) if (j !== id && j !== S.orion && S.planets[j].typeIdx >= 7 && Geo.unitDist(S, id, j) <= 29) near = true; t.ok(near, 'no habitable neighbour'); });
      }
    }
  });

  t.test('makeHomeworld produces yellow star + terran 100', () => {
    const S = gen('medium', 3, 3), id = S.homeCandidates[0];
    G.makeHomeworld(S, id, 'Mentar');
    t.eq(S.stars[id].color, 'yellow'); t.eq(S.planets[id].type, 'terran'); t.eq(S.planets[id].maxPop, 100); t.eq(S.planets[id].name, 'Mentar');
  });

  t.test('nebula counts per size and star membership', () => {
    const ranges = { small: [0, 1], medium: [1, 3], large: [2, 3], huge: [2, 4], colossal: [3, 5] };
    for (const size in ranges) for (let i = 0; i < 25; i++) { const S = gen(size, 'nb' + size + i, 2); t.between(S.nebulae.length, 0, ranges[size][1]); }
    let maxSeen = 0; for (let i = 0; i < 40; i++) maxSeen = Math.max(maxSeen, gen('huge', 'nbx' + i, 2).nebulae.length); t.ok(maxSeen >= 3);
    const S = gen('huge', 'nbm', 2);
    S.stars.forEach(s => { const inside = S.nebulae.some(n => n.rects.some(r => s.x >= r[0] && s.x <= r[2] && s.y >= r[1] && s.y <= r[3])); t.eq(s.nebula, inside); });
  });

  t.test('parsec distances: symmetric, zero on self, between euclid/11 (exact on an axis) and ~euclid/9 (truncated components, research/04 verification C1)', () => {
    const S = gen('large', 11, 4);
    for (let i = 0; i < 25; i++) for (let j = 0; j < 25; j++) {
      const d = Geo.parsecs(S, i, j); t.eq(d, Geo.parsecs(S, j, i));
      if (i === j) t.eq(d, 0); else {
        const e = Math.hypot(S.stars[i].x - S.stars[j].x, S.stars[i].y - S.stars[j].y);
        t.ok(d >= Math.ceil(e / 11 - 1e-9) && d <= e / 8.8 + 1.5, `pair ${i},${j}: d=${d} euclid=${e.toFixed(1)}`);
      }
    }
  });
  t.test('parsec step model (1oom util_math): 5+6 unit double steps, whole-degree headings, truncated axis components', () => {
    const pc = Geo.parsecsXY;
    t.eq(pc(0, 0, 22, 0), 2, '22 units on an axis = 2 parsecs'); t.eq(pc(0, 0, 100, 0), 10); t.eq(pc(0, 0, 0, 100), 10); t.eq(pc(50, 50, 50, 50), 0);
    t.deep(Geo.goLine(0, 0, 30, 10, 5), [4, 1], 'heading 18 degrees: 5*cos = 4.75 -> 4, 5*sin = 1.54 -> 1 (truncated, not rounded)');
    t.eq(pc(0, 0, 30, 10), 4, 'hand-simulated with the 1oom tables: 4 parsecs for a 31.6-unit line (round-to-nearest would give 3)');
    t.eq(pc(0, 0, 100, 2), 12, 'a nearly horizontal line only gains 4+5 units per parsec (heading 1 degree)'); t.eq(pc(100, 2, 0, 0), 12, 'same from the other end');
    t.deep(Geo.goLine(0, 0, 100, 0, 6), [6, 0]); t.deep(Geo.goLine(0, 0, 3, 0, 6), [3, 0], 'never overshoots the target');
    t.deep(Geo.goLine(10, 10, 0, 0, 5), [7, 7], 'a 45-degree step of 5 moves 3 on each axis');
    t.deep(Geo.goLine(0, 0, 100, 100, 6), [4, 4], '6*cos(45) = 4.24 -> 4');
    t.eq(Geo.angle(1, 0), 0); t.eq(Geo.angle(0, 1), 90); t.eq(Geo.angle(-1, 0), 180); t.eq(Geo.angle(0, -1), 270); t.eq(Geo.angle(100, 100), 45, 'slope 256 = the tan(45) table entry');
    t.eq(Geo.angle(256, 255), 43, 'the last 22-44 bucket answers 43 (original off-by-one)'); t.eq(Geo.angle(1, 60), 90, 'slopes >= 14669 answer 90');
  });

  t.test('rich/ultra-rich frequency rises on blue/neutron stars and in nebulae', () => {
    let rich = { yellow: [0, 0], blue: [0, 0], purple: [0, 0] };
    for (let i = 0; i < 80; i++) { const S = gen('huge', 'rich' + i, 2); S.stars.forEach((s, k) => { if (!rich[s.color] || S.homeCandidates.includes(k)) return; rich[s.color][1]++; if (S.planets[k].special === 'rich' || S.planets[k].special === 'ultrarich') rich[s.color][0]++; }); }
    const r = c => rich[c][0] / rich[c][1];
    t.ok(r('blue') > r('yellow'), 'blue > yellow'); t.ok(r('purple') > r('blue'), 'purple > blue');
  });
};
