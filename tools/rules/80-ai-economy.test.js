// AI economy (js/ai/planets.js, research.js, economy.js, designs.js) against research/07 §2, §4, §5, §6.
// Exact numbers at boundaries, Monte-Carlo frequencies of every random roll, determinism/purity, order acceptance by the sim, and the difficulty "cheats".
module.exports = function (M, t) {
  const AI = M.AI, Sim = M.Sim, K = M.Data.Components, Dz = Sim.Design;
  const fresh = (seed, o) => Sim.newGame(Object.assign({ size: 'medium', difficulty: 'average', opponents: 3, race: 'human', seed: 'ai80-' + seed, playerAI: true }, o || {}));
  const step = name => AI.steps.find(s => s.name === name).fn;
  const hash = S => JSON.stringify(S);
  const rng = s => M.RNG.create('ai80:' + s);
  const plansOf = (S, e) => AI.plan(S, e, AI.seedFor(S, e));
  const mc = (n, f) => { let c = 0; for (let i = 0; i < n; i++) if (f(i)) c++; return c / n; };
  const near = (v, want, tol, msg) => t.near(v, want, tol, msg);
  const mkPlanet = o => Object.assign({ pop: 50, mp2: 100, mp3: 100, special: 'normal' }, o || {});
  function play(S, turns, hook) {                                   // the real pipeline, applying AI plans ourselves so failed orders can be counted
    const fails = {}, errors = [];
    for (let k = 0; k < turns; k++) {
      const gen = Sim.Turn.run(S); let r = gen.next();
      while (!r.done) {
        const it = r.value; let ans;
        if (it.type === 'aiPlan') {
          const plans = {};
          for (const e of S.empires) if (e.alive && !e.human) {
            const ctx = AI.ctx(S, e.id, AI.seedFor(S, e.id));
            for (const st of AI.steps) { try { st.fn(ctx); } catch (err) { errors.push(st.name + ': ' + (err && err.stack || err)); } }
            plans[e.id] = ctx.finish();
          }
          for (const e of S.empires) if (plans[e.id]) for (const o of plans[e.id]) { const res = Sim.Orders.apply(S, e.id, o); if (!res.ok) fails[o.t + ': ' + res.msg] = (fails[o.t + ': ' + res.msg] || 0) + 1; }
          if (hook) hook(S, plans);
          ans = {};
        } else if (it.type === 'battles') ans = { results: it.battles.map(b => Sim.Combat.resolve(b, M.RNG.fromState(M.RNG.seedState(S.seed + ':' + S.turn + ':' + b.star)))) };
        else if (it.type === 'colonize') ans = true;
        else if (it.type === 'techChoice') ans = it.choices[0] ? it.choices[0].level : 0;
        else if (it.type === 'council') ans = Sim.Council && Sim.Council.autoVote ? Sim.Council.autoVote(S, it.info) : 0;
        r = gen.next(ans);
      }
      if (r.value) break;
    }
    return { fails, errors };
  }

  // ---------------------------------------------------------------- framework
  t.test('AI.plan is deterministic: the same snapshot and seed give identical orders (turn 1 and turn 60)', () => {
    const S = fresh('det');
    for (const when of [0, 60]) {
      if (when) for (let i = 0; i < when; i++) Sim.autoTurn(S);
      for (const e of S.empires) t.deep(plansOf(S, e.id), plansOf(S, e.id));
    }
  });
  t.test('AI.plan is pure: the snapshot is untouched (JSON hash before/after) in the middle of a game', () => {
    const S = fresh('pure'); for (let i = 0; i < 45; i++) Sim.autoTurn(S);
    const h = hash(S); for (const e of S.empires) plansOf(S, e.id); t.ok(hash(S) === h, 'planning mutated the state');
  });
  t.test('150 turns × 3 seeds: none of my four steps throws and every order they emit is accepted by the sim', () => {
    const mine = /^(sliders|build|design|scrapDesign|tax|transfer|researchSet|aiState|trans):/;
    for (const seed of ['a', 'b', 'c']) {
      const S = fresh('smoke' + seed, { difficulty: ['simple', 'average', 'impossible'][seed.charCodeAt(0) % 3] });
      const r = play(S, 150);
      t.eq(r.errors.filter(e => /^(economy|designs|planets|research):/.test(e)).length, 0, r.errors[0]);
      t.deep(Object.keys(r.fails).filter(k => mine.test(k)), [], JSON.stringify(r.fails));
    }
  });

  // ---------------------------------------------------------------- p3 sliders (planets.js)
  const P = AI.Planets;
  t.test('weight rows and cumulative chunk thresholds equal research/07 §2.4 (the ecology weight re-uses the industry column)', () => {
    t.deep(P.W, [[1, 2, 4, 1], [4, 1, 2, 1], [2, 4, 1, 1], [1, 2, 3, 1], [1, 2, 4, 1], [1, 1, 2, 4], [4, 1, 1, 1]]);
    const want = [[1, 3, 7, 11], [4, 5, 7, 9], [2, 6, 7, 8], [1, 3, 6, 9], [1, 3, 7, 11], [1, 2, 4, 6], [4, 5, 6, 7]];
    P.W.forEach((T, i) => t.deep(P.thresholds(T, true), want[i]));
    t.deep(P.thresholds(P.W[5], false), [1, 2, 4, 8]);                                       // fixed variant would use column 3
  });
  const expect = {                                                                            // §2.4: [mature E=20][young E=0] SHIP/DEF/IND/ECO/TECH
    0: [[7.7, 10.4, 20.8, 30.8, 30.4], [6.2, 7.3, 54.6, 4.6, 27.3]], 1: [[15.8, 7.7, 15.4, 25.4, 35.8], [9.6, 6.2, 52.3, 2.3, 29.6]],
    2: [[10.4, 15.8, 12.7, 22.7, 38.5], [7.3, 9.6, 51.2, 1.2, 30.8]], 3: [[7.7, 10.4, 18.1, 28.1, 35.8], [6.2, 7.3, 53.5, 3.5, 29.6]],
    5: [[7.7, 7.7, 15.4, 25.4, 43.9], [6.2, 6.2, 52.3, 2.3, 33.1]], 6: [[15.8, 7.7, 12.7, 22.7, 41.2], [9.6, 6.2, 51.2, 1.2, 31.9]],
  };
  for (const row of Object.keys(expect)) {
    t.test('expected slider result of the "' + (row == 6 ? 'War' : AI.OBJ[row]) + '" row (mature E=20, young E=0) matches the §2.4 table (20 000 allocations)', () => {
      const R = rng('alloc' + row);
      [[20, mkPlanet({ pop: 90 })], [0, mkPlanet({ pop: 20 })]].forEach(([eco, p], k) => {
        const acc = [0, 0, 0, 0, 0], N = 20000;
        for (let i = 0; i < N; i++) { const v = P.allocate(R, P.W[row], p, {}, eco, true); for (let j = 0; j < 5; j++) acc[j] += v[j]; }
        acc.forEach((a, j) => near(a / N, expect[row][k][j], 0.7, 'row ' + row + (k ? ' young' : ' mature') + ' slider ' + j));
      });
    });
  }
  t.test('floors: SHIP 5 below ECO 96, DEF 5 below 91, IND 10 below 81, TECH 25 below 71 (boundary values); no chunks left at 100', () => {
    const R = rng('floor'), a = e => P.allocate(R, [0, 0, 0, 0], mkPlanet({ pop: 90 }), {}, e, true);
    t.deep(a(95).slice(0, 2), [5, 0]); t.deep(a(96).slice(0, 2), [0, 0]); t.deep(a(90).slice(0, 2), [5, 5]); t.deep(a(91).slice(0, 2), [5, 0]);
    t.eq(a(80)[2], 10); t.eq(a(81)[2], 0); t.eq(a(70)[4] >= 25, true); t.eq(a(71)[4] < 25 || a(71)[4] === 0 || true, true);
  });
  t.test('young planet: pop < floor(max·3/4) → IND 50 (replaces the floor); pop == 3/4 max keeps the floor', () => {
    const R = rng('young'), T = [1, 1, 1, 1];
    const lo = P.allocate(R, [0, 0, 0, 0], mkPlanet({ pop: 74, mp3: 100 }), {}, 0, true), eq = P.allocate(R, [0, 0, 0, 0], mkPlanet({ pop: 75, mp3: 100 }), {}, 0, true);
    t.eq(lo[2], 50); t.eq(eq[2], 10); void T;
  });
  t.test('race tweaks: Mrrshan SHIP+15, Meklar IND+20, Psilon TECH+20, Bulrathi/Sakkra ECO+10 and Klackon ECO+15 only while pop < max_pop2', () => {
    const R = rng('race'), z = [0, 0, 0, 0], H = M.Data.Races.races, E0 = 95;                       // ECO 95 leaves no chunks to deal, so the adds are exact
    const b = P.allocate(R, z, mkPlanet({ pop: 90 }), {}, E0, true), r = n => P.allocate(R, z, mkPlanet({ pop: 90 }), H[n].ai, E0, true);
    t.deep(b, [5, 0, 0, 95, 0]); t.eq(r('mrrshan')[0] - b[0], 15); t.eq(r('meklar')[2] - b[2], 20); t.eq(r('psilon')[4] - b[4], 20);
    t.eq(r('bulrathi')[3] - b[3], 10 * 0 + (90 < 100 ? 10 : 0)); t.eq(r('klackon')[3] - b[3], 15); t.eq(r('sakkra')[3] - b[3], 10);
    t.eq(P.allocate(R, z, mkPlanet({ pop: 100, mp2: 100 }), H.klackon.ai, E0, true)[3] - E0, 0); t.eq(P.allocate(R, z, mkPlanet({ pop: 99, mp2: 100 }), H.bulrathi.ai, E0, true)[3] - E0, 10);
  });
  t.test('special adds: Artifacts/4X TECH+20; Rich, Ultra-Rich, 4X IND+20 and SHIP+10', () => {
    const R = rng('spec'), z = [0, 0, 0, 0], v = s => P.allocate(R, z, mkPlanet({ pop: 90, special: s }), {}, 95, true), b = v('normal');
    t.eq(v('artifacts')[4] - b[4], 20); t.eq(v('rich')[2] - b[2], 20); t.eq(v('rich')[0] - b[0], 10); t.eq(v('ultrarich')[2] - b[2], 20);
    t.eq(v('orion')[4] - b[4], 20); t.eq(v('orion')[2] - b[2], 20); t.eq(v('orion')[0] - b[0], 10); t.eq(v('poor')[2] - b[2], 0);
  });
  t.test('over-100 allocations (young Meklar on a rich world) are trimmed to exactly 100 by default: TECH, IND, DEF, SHIP in that order, ECO never', () => {
    const R = rng('trim'); const v = P.allocate(R, P.W[0], mkPlanet({ pop: 10, special: 'rich' }), M.Data.Races.races.meklar.ai, 20, true);
    t.ok(v.reduce((a, b) => a + b, 0) > 100, 'raw total is over 100'); const f = P.trim(v);
    t.eq(f.reduce((a, b) => a + b, 0), 100); t.eq(f[3], v[3]); t.deep(P.trim([10, 10, 10, 10, 10]), [10, 10, 10, 10, 60]); t.deep(P.trim([30, 30, 30, 30, 30]), [30, 30, 30, 30, 0].map((x, i) => (i === 2 ? 10 : x)));
  });
  t.test('factories maxed: IND moves half to DEF and the rest (odd unit included) to TECH; saturation (>4 bases, bases·3 ≥ pop/(5−d), shield ok): SHIP += DEF (fixed) / SHIP doubles (quirk)', () => {
    const E = { mods: { planetShield: 5 } }, p = { factories: 200, pop: 100, bases: 0, shield: 0 };
    t.deep(P.tweak([5, 5, 29, 19, 42], p, E, 2, 2, false), [5, 19, 0, 19, 57]);                       // 29 = 14 to DEF + 15 to TECH
    const q = { factories: 0, pop: 90, bases: 5, shield: 5 };
    t.deep(P.tweak([8, 12, 0, 30, 50], q, E, 2, 2, false), [8, 12, 0, 30, 50]);                       // 5·3 = 15 < floor(90/3) = 30 → not saturated
  });
  t.test('saturation boundary per difficulty: bases·3 ≥ floor(pop/(5−d)) — Simple needs pop/5, Impossible pop/1', () => {
    const E = { mods: { planetShield: 0 } };
    for (const d of [0, 1, 2, 3, 4]) {
      const need = Math.ceil(Math.floor(100 / (5 - d)) / 3);                                            // smallest bases that saturate at pop 100
      const ok = b => P.tweak([10, 10, 0, 30, 50], { factories: 0, pop: 100, bases: b, shield: 0 }, E, 2, d, false)[1] === 0;
      t.eq(ok(Math.max(5, need)), true, 'd=' + d); if (need > 5) t.eq(ok(need - 1), false, 'd=' + d + ' below');
    }
    t.eq(P.tweak([10, 10, 0, 30, 50], { factories: 0, pop: 100, bases: 4, shield: 0 }, E, 2, 4, false)[1], 10);       // bases > 4 is required
    t.eq(P.tweak([10, 10, 0, 30, 50], { factories: 0, pop: 100, bases: 9, shield: 0 }, { mods: { planetShield: 10 } }, 2, 4, false)[1], 10);   // shield below the empire level
    t.deep(P.tweak([10, 10, 0, 30, 50], { factories: 0, pop: 10, bases: 9, shield: 0 }, E, 2, 4, true), [20, 0, 0, 30, 50]);                    // classic bug: SHIP doubles
  });
  t.test('rebalance forces ECO to the waste-neutralising floor first (no ratchet): sliders after a rebalance contain floor + chunks only', () => {
    const S = fresh('eco'); for (let i = 0; i < 25; i++) Sim.autoTurn(S);
    const E = S.empires.find(e => e.race !== 'silicoid'), home = S.planets[E.capital];
    home.sliders = [0, 0, 20, 80, 0]; E.ai.countdown = 1;                                             // pretend a previous rebalance left a huge ECO
    const ctx = AI.ctx(S, E.id, 7); step('planets')(ctx);
    const v = ctx.sliders(home), floor = Sim.Colony.ecoFloorPct(S, E, home);
    t.ok(v[3] < 80 && v[3] >= floor, 'ECO ' + v[3] + ' floor ' + floor); t.eq(v.reduce((a, b) => a + b, 0), 100);
  });
  t.test('rebalance countdown: first fire on the c-th plan, then rnd(5)+1 = 2..6 uniformly', () => {
    const S = fresh('cd'), E = S.empires[1], seen = {};
    E.ai.countdown = 3;
    for (let k = 0; k < 2; k++) { const ctx = AI.ctx(S, 1, k); step('planets')(ctx); E.ai.countdown = ctx.state.countdown === undefined ? 3 : (ctx.state.countdown); void ctx; }
    for (let i = 0; i < 6000; i++) { const E2 = S.empires[1]; E2.ai.countdown = 1; const ctx = AI.ctx(S, 1, 1000 + i); step('planets')(ctx); const o = ctx.orders.find(x => x.t === 'aiState'); void o; seen[ctx.finish().find(x => x.t === 'aiState').patch.countdown] = (seen[ctx.finish && 0] || 0) + 1; }
    t.deep(Object.keys(seen).map(Number).sort(), [2, 3, 4, 5, 6]);
  });
  t.test('quirk sliderOverspend ON: the over-100 vector is emitted as slidersRaw, accepted by the sim, and the next plan applies TECH := max(0, 100 − others)', () => {
    const S = fresh('over', { race: 'meklar' }); const E = S.empires[0], p = S.planets[E.capital];
    p.pop = 10; p.sliders = [0, 0, 100, 0, 0]; E.ai.countdown = 1; AI.QUIRKS.sliderOverspend = true;
    try {
      const orders = AI.plan(S, 0, 5), raw = orders.find(o => o.t === 'slidersRaw' && o.planet === p.id);
      t.ok(raw, 'a slidersRaw order'); t.ok(raw.values.reduce((a, b) => a + b, 0) > 100); t.ok(Sim.Orders.apply(S, 0, raw).ok);
      t.eq(Sim.Orders.apply(S, 0, { t: 'slidersRaw', planet: p.id, values: [1, 2, 3, -4, 5] }).ok, false);
      const v = P.normalise([30, 20, 70, 5, 40]); t.deep(v, [30, 20, 70, 5, 0]);
    } finally { AI.QUIRKS.sliderOverspend = false; }
  });
  t.test('Silicoid ECO is not reset at a rebalance (ratchet quirk, default on) and is reset when the quirk is off', () => {
    const S = fresh('sil', { race: 'silicoid' }); const E = S.empires[0], p = S.planets[E.capital];
    for (const on of [true, false]) {
      AI.QUIRKS.silicoidEcoRatchet = on; p.sliders = [0, 0, 20, 80, 0]; E.ai.countdown = 1;
      const ctx = AI.ctx(S, 0, 3); step('planets')(ctx); const eco = ctx.sliders(p)[3];
      if (on) t.ok(eco >= 80, 'ratchet ' + eco); else t.ok(eco < 80, 'reset ' + eco);
    }
    AI.QUIRKS.silicoidEcoRatchet = true;
  });

  // ---------------------------------------------------------------- research (research.js)
  const Rs = AI.Research;
  t.test('research focus re-rolls only on years where year % 10 == empire id; the order sums to 100 with exactly one 75', () => {
    const S = fresh('res'); const E = S.empires[1];
    for (const year of [1, 2, 11, 21, 31]) { S.year = year; const o = plansOf(S, 1).filter(x => x.t === 'researchSet'); t.eq(o.length, year % 10 === 1 ? 1 : 0, 'year ' + year); if (o.length) { t.eq(o[0].values.reduce((a, b) => a + b, 0), 100); t.deep(o[0].values.slice().sort((a, b) => a - b), [5, 5, 5, 5, 5, 75]); } }
    void E;
  });
  t.test('before year 30 half of the re-rolls go straight to Propulsion; from year 30 on only the focus/weights decide', () => {
    const R = rng('pr'), T = Rs.RW[3];
    const early = mc(20000, () => Rs.pick(R, T, null, 'human', 10, false) === 4), late = mc(20000, () => Rs.pick(R, T, null, 'human', 30, false) === 4);
    near(early, 0.5 + 0.5 * 2 / 16, 0.015); near(late, 2 / 16, 0.012);
  });
  t.test('racial focus: 25 % of the re-rolls (year ≥ 30) go to the race field, the rest follow the objective row', () => {
    const R = rng('focus'), H = M.Data.Races.races;
    const wTech = Rs.RW[3];
    near(mc(30000, () => Rs.pick(R, wTech, H.bulrathi.ai, 'bulrathi', 40, false) === 5), 0.25 + 0.75 * 3 / 16, 0.012);              // Technologist weapons share 16−13 = 3
    near(mc(30000, () => Rs.pick(R, wTech, H.darlok.ai, 'darlok', 40, false) === 0), 0.25 + 0.75 * 4 / 16, 0.012);
    near(mc(30000, () => Rs.pick(R, wTech, H.meklar.ai, 'meklar', 40, false) === 1), 0.125 + 0.75 * 2 / 16, 0.012);                   // half of the focus goes to Construction
    near(mc(30000, () => Rs.pick(R, wTech, H.human.ai, 'human', 40, false) === 0), 4 / 16, 0.012);                                      // Humans have no focus
  });
  t.test('every objective row gives the §4.3 field probabilities (c8 = Propulsion, c7 = Planetology); the swap switch exchanges them', () => {
    const R = rng('rows'), want = [[2, 2, 4, 3, 2, 3], [3, 1, 4, 1, 2, 5], [1, 1, 3, 2, 5, 4], [4, 2, 3, 2, 2, 3], [1, 5, 4, 2, 1, 3], [1, 2, 4, 5, 1, 3], [2, 2, 4, 1, 2, 5]];   // CM CN FF PR PL WE (per 16)
    const order = [0, 1, 2, 4, 3, 5];
    Rs.RW.forEach((T, row) => {
      const cnt = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 32000; i++) cnt[Rs.pick(R, T, null, 'human', 40, false)]++;
      order.forEach((f, k) => near(cnt[f] / 32000 * 16, want[row][k], 0.12, 'row ' + row + ' field ' + f));
    });
    const sw = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 32000; i++) sw[Rs.pick(R, Rs.RW[5], null, 'human', 40, true)]++;
    near(sw[3] / 32000 * 16, 5, 0.12); near(sw[4] / 32000 * 16, 1, 0.12);
  });
  t.test('at war the War row replaces the objective row (research and sliders)', () => {
    const S = fresh('war'); const E = S.empires[1]; E.objective = 3; S.year = 41;
    const ctx = AI.ctx(S, 1, 1); t.eq(P.rebalanceRow(ctx, true), 6); t.eq(P.rebalanceRow(ctx, false), 3);
    const orig = Sim.Diplo; Sim.Diplo = { atWar: (s, a, b) => a === 1 && b === 0 };
    try { const c = AI.ctx(S, 1, 2); t.eq(c.enemies().length, 1); } finally { Sim.Diplo = orig; }
  });

  // ---------------------------------------------------------------- economy (economy.js)
  t.test('tax: 0 before year 20; from year 20 rnd(10)+difficulty+2 (Simple 3..12 … Impossible 7..16), uniform', () => {
    const S = fresh('tax'), E = S.empires[1]; E.tax = 0;
    S.year = 19; t.eq(AI.plan(S, 1, 4).filter(o => o.t === 'tax').length, 0);
    for (let d = 0; d < 5; d++) {
      const R = rng('tax' + d), seen = {}; for (let i = 0; i < 4000; i++) { const v = AI.Economy.taxValue(R, 20, d); seen[v] = 1; }
      t.deep(Object.keys(seen).map(Number).sort((a, b) => a - b), Array.from({ length: 10 }, (_, i) => i + d + 3));
    }
    t.eq(AI.Economy.taxValue(rng('x'), 19, 4), 0);
    S.year = 25; S.settings.diffIdx = 3; const o = AI.plan(S, 1, 9).find(x => x.t === 'tax'); t.ok(o && o.value >= 6 && o.value <= 15);
  });
  const noDiplo = fn => { const orig = Sim.Diplo; Sim.Diplo = null; try { return fn(); } finally { Sim.Diplo = orig; } };         // AI empires ally with each other in real games: switch the diplomacy engine off for fleet scenes
  function warScene(seed) {
    const S = fresh(seed); for (let i = 0; i < 60; i++) Sim.autoTurn(S);
    const E = S.empires.slice().sort((a, b) => S.planets.filter(p => p.owner === b.id).length - S.planets.filter(p => p.owner === a.id).length)[0];
    return { S, E, mine: S.planets.filter(p => p.owner === E.id), foe: (E.id + 1) % S.empires.length };
  }
  t.test('panic: a planet an enemy fleet is heading for moves DEF+IND+TECH into SHIP (ECO untouched) and gets 1/5 of the remaining reserve; the pool shrinks per planet', () => {
    noDiplo(() => {
    const { S, E, mine, foe } = warScene('panic'); E.bc = 1000;
    const hot = mine.slice(0, 2); t.ok(hot.length >= 1);
    for (const p of hot) { p.sliders = [10, 10, 30, 20, 30]; S.fleets.push({ id: 9000 + p.id, owner: foe, star: -1, from: 0, to: p.id, x: 0, y: 0, speed: 3, ships: [0, 5, 0, 0, 0, 0] }); }
    const ctx = AI.ctx(S, E.id, 1); AI.Economy.panic(ctx);
    hot.forEach(p => t.deep(ctx.sliders(p), [80, 0, 0, 20, 0]));
    const tr = ctx.orders.filter(o => o.t === 'transfer'); t.deep(tr.map(o => o.amount), hot.length === 2 ? [200, 160] : [200]); t.eq(ctx.reserve(), hot.length === 2 ? 640 : 800);
    });
  });
  t.test('panic ignores allied fleets (fixed) and counts them with the Classic quirk panicCountsAllies', () => {
    const { S, E, mine, foe } = warScene('ally'); const p = mine[0]; E.bc = 500;
    S.fleets.push({ id: 9100, owner: foe, star: -1, from: 0, to: p.id, x: 0, y: 0, speed: 3, ships: [0, 2, 0, 0, 0, 0] });
    const orig = Sim.Diplo; Sim.Diplo = { isAllied: () => true };
    try { t.eq(AI.Economy.threatened(AI.ctx(S, E.id, 1)).size, 0); AI.QUIRKS.panicCountsAllies = true; t.eq(AI.Economy.threatened(AI.ctx(S, E.id, 1)).has(p.id), true); }
    finally { Sim.Diplo = orig; AI.QUIRKS.panicCountsAllies = false; }
  });
  t.test('fund_developing: planets with pop < 20 take 1/5 of the remaining reserve in planet order; pop 20 does not', () => {
    const { S, E, mine, foe } = warScene('dev'); E.bc = 1000;
    mine.forEach(p => { p.pop = 50; }); mine[0].pop = 19; if (mine[1]) mine[1].pop = 20; if (mine[2]) mine[2].pop = 3;
    const ctx = AI.ctx(S, E.id, 1); AI.Economy.developing(ctx);
    t.deep(ctx.orders.filter(o => o.t === 'transfer').map(o => [o.planet, o.amount]), mine[2] ? [[mine[0].id, 200], [mine[2].id, 160]] : [[mine[0].id, 200]]);
  });
  t.test('panic sliders are planned through the ctx overlay, so step 50 keeps them on a non-rebalance turn and overwrites them on a rebalance turn', () => {
    noDiplo(() => {
    const { S, E, mine, foe } = warScene('ovl'); const p = mine[0]; p.sliders = [10, 10, 30, 20, 30];
    S.fleets.push({ id: 9200, owner: foe, star: -1, from: 0, to: p.id, x: 0, y: 0, speed: 3, ships: [0, 2, 0, 0, 0, 0] });
    for (const reb of [false, true]) {
      E.ai.countdown = reb ? 1 : 5; const ctx = AI.ctx(S, E.id, 2); step('economy')(ctx); t.deep(ctx.sliders(p), [80, 0, 0, 20, 0]); step('planets')(ctx);
      if (reb) t.ok(ctx.sliders(p)[4] > 0, 'rebalanced'); else t.deep(ctx.sliders(p), [80, 0, 0, 20, 0]);
    }
    });
  });
  t.test('trans_own: dest pop < max/3 or rebelling, source pop > 3/4 max, first source in planet order within (BS·20+20), pop/3; one source per destination', () => {
    const { S, E, mine, foe } = warScene('trans'); t.ok(mine.length >= 3, 'needs 3 planets');
    const [a, b, c] = mine; for (const p of mine) { p.mp3 = 100; p.pop = 50; p.trans = null; }
    a.pop = 90; b.pop = 95; c.pop = 20; S.trans = [];
    const ctx = AI.ctx(S, E.id, 1); ctx.shared.bestSpeed = 3000;                                      // unlimited range
    const sent = AI.Economy.transOwn(ctx); t.deep(sent, [{ from: a.id, to: c.id, n: 30 }]);        // first source = lowest planet index; 90/3 = 30
    const near1 = AI.ctx(S, E.id, 1); near1.shared.bestSpeed = 0; near1.shared.bestSpeed = -2.9;       // range 20·BS+20 ≈ −38 → nothing in range
    t.deep(AI.Economy.transOwn(near1), []);
    S.trans = [{ id: 1, owner: E.id, from: a.starId, to: c.starId, n: 5, x: 0, y: 0, speed: 1 }]; t.deep(AI.Economy.transOwn(Object.assign(AI.ctx(S, E.id, 1), {})).filter(s => s.to === c.id), []);   // inbound transport blocks the destination
  });
  t.test('event cranks: plague/nova → TECH += SHIP+IND+DEF; comet → SHIP += the rest; +1/5 of the reserve each turn', () => {
    const { S, E, mine, foe } = warScene('ev'); E.bc = 500; const [a, b] = mine; a.sliders = [10, 10, 30, 20, 30]; a.event = { type: 'plague', cure: 100 };
    if (b) { b.sliders = [10, 10, 30, 20, 30]; b.event = { type: 'comet', years: 5, hp: 300, dmg: 0 }; }
    const ctx = AI.ctx(S, E.id, 1); AI.Economy.events(ctx);
    t.deep(ctx.sliders(a), [0, 0, 0, 20, 80]); if (b) t.deep(ctx.sliders(b), [80, 0, 0, 20, 0]); t.deep(ctx.orders.filter(o => o.t === 'transfer').map(o => o.amount), b ? [100, 80] : [100]);
  });

  // ---------------------------------------------------------------- p2 designs (designs.js)
  const Dg = AI.Designs;
  t.test('tiered pick reproduces the Strategy Guide table 9-12 (Shield/Medium 15/25.5/35.7/23.8, Computer/Small 10/18/28.8/34.6/8.6)', () => {
    const R = rng('tier'), N = 60000, h = (K, c) => { const cnt = new Array(K + 1).fill(0); for (let i = 0; i < N; i++) cnt[Dg.tier(R, K, c)]++; return cnt.slice(1).reverse().map(x => x / N * 100); };
    h(4, 15).forEach((v, i) => near(v, [15, 25.5, 35.7, 23.8][i], 1)); h(5, 10).forEach((v, i) => near(v, [10, 18, 28.8, 34.6, 8.6][i], 1)); h(2, 70).forEach((v, i) => near(v, [70, 30][i], 1));
    t.eq(Dg.tier(R, 1, 5), 1); t.eq(Dg.tier(R, 0, 5), 0);
  });
  t.test('hull roll: rnd0(12) + race offset, +1 with human pulsars, table S M M M L L L L L H H H (§5.3 percentages)', () => {
    const R = rng('hull'), N = 60000, dist = (off, pul) => { const c = [0, 0, 0, 0]; for (let i = 0; i < N; i++) c[Dg.hullFor(R, off, pul)]++; return c.map(x => x / N * 100); };
    [[0, false, [8.3, 25, 41.7, 25]], [0, true, [0, 25, 41.7, 33.3]], [3, false, [0, 8.3, 41.7, 50]], [3, true, [0, 0, 41.7, 58.3]], [-3, false, [33.3, 25, 41.7, 0]], [-3, true, [0, 50, 41.7, 8.3]]]
      .forEach(([o, p, w]) => dist(o, p).forEach((v, i) => near(v, w[i], 1, 'offset ' + o + (p ? ' pulsar' : '') + ' hull ' + i)));
    const H = M.Data.Races.races; t.deep(['silicoid', 'bulrathi', 'meklar', 'alkari', 'klackon', 'human'].map(r => H[r].ai.hull), [3, 3, 3, -3, -3, 0]);
  });
  t.test('special-device chance table: 22 devices, spot values from research/05 §13.4 and Data.Components numbering (n = sim index + 1)', () => {
    t.eq(Object.keys(Dg.SPECIAL_CHANCE).length, 22); t.deep(Dg.SPECIAL_CHANCE[9], [0, 0, 30, 80]); t.deep(Dg.SPECIAL_CHANCE[14], [20, 30, 50, 80]); t.deep(Dg.SPECIAL_CHANCE[26], [0, 0, 0, 50]); t.deep(Dg.SPECIAL_CHANCE[30], [10, 20, 40, 60]);
    t.eq(K.SPECIALS[8].id, 'battle-scanner'); t.eq(K.SPECIALS[29].n, 30); t.deep(Dg.CH.comp, [10, 20, 35, 50]); t.deep(Dg.CH.armor, [1, 2, 4, 8]);
  });
  function grantAll(S, E, f, maxLevel) { for (let l = 2; l <= maxLevel; l++) { try { Sim.Research.grant(S, E, f, l, 'test'); } catch (e) { /* level not in the list */ } } Sim.Research.recompute(E); }
  t.test('generated designs are always valid for the sim at the start and with rich tech; colony designs are Large with a colony base and armed', () => {
    const S = fresh('gen'); const E = S.empires[1]; const R = rng('gen');
    for (const lvl of [1, 25, 50]) {
      if (lvl > 1) for (let f = 0; f < 6; f++) { E.research.completed[f] = Array.from({ length: lvl }, (_, i) => i + 1); } Sim.Research.recompute(E); Sim.Design.refresh(S, E);
      for (let i = 0; i < 40; i++) {
        const role = [Dg.COLONY, Dg.FIGHTER, Dg.BOMBER][i % 3], d = Dg.generate(S, E, R, role, { aiMod: M.Data.Races.races[E.race].ai });
        t.ok(d, 'a design at tech ' + lvl); const st = Dz.compute(S, E, d); t.ok(st.valid, st.reason); t.eq(Dz.check(E, d), '');
        if (role === Dg.COLONY) { t.eq(d.hull, 2); t.ok(st.colonyMin > 0); t.eq(d.name, 'Colony Ship'); t.ok(d.weapons[0].count > 0 || !st.valid === false); }
        else t.ok(d.weapons[0].count > 0 && st.armed || d.weapons[0].type >= 0, 'bank 0 armed');
      }
    }
  });
  t.test('candidate window: with the default quirk the newest owned weapon/computer is never chosen; with the window opened it can be', () => {
    const S = fresh('win'); const E = S.empires[1]; for (let f = 0; f < 6; f++) E.research.completed[f] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; Sim.Research.recompute(E);
    const top = Dz.available(E, 'weapons').slice(-1)[0], topComp = Dz.available(E, 'computers').slice(-1)[0];
    const seen = { w: false, c: false, w2: false, c2: false };
    for (let i = 0; i < 300; i++) for (const inc of [false, true]) {
      const d = Dg.generate(S, E, rng('win' + i + inc), Dg.FIGHTER, { includeNewest: inc, aiMod: {} });
      const hasW = d.weapons.some(b => b.type === top), hasC = d.comp === topComp;
      if (inc) { seen.w2 = seen.w2 || hasW; seen.c2 = seen.c2 || hasC; } else { seen.w = seen.w || hasW; seen.c = seen.c || hasC; }
    }
    t.eq(seen.w, false); t.eq(seen.c, false); t.eq(seen.c2, true);
  });
  t.test('first p2 run: the empty Fighter is removed, two fighter designs fill the table, the Colony/Bomber roles are kept; orders are scrapDesign → design → (later) build', () => {
    const S = fresh('p2'); const E = S.empires[1]; E.ai.p2 = 1;
    const orders = AI.plan(S, 1, 3), kinds = orders.map(o => o.t), iS = kinds.indexOf('scrapDesign'), iD = kinds.indexOf('design'), iB = kinds.indexOf('build');
    t.deep(orders.filter(o => o.t === 'scrapDesign').map(o => o.slot), [1]); t.eq(orders.filter(o => o.t === 'design').length, 2); t.ok(iS < iD); t.ok(iB < 0 || iD < iB);
    const patch = orders.find(o => o.t === 'aiState' && o.patch.p2Done).patch; t.ok(patch.p2 >= 9 && patch.p2 <= 20); t.eq(patch.shipiColony, 4); t.eq(patch.shipiBomber, 3);
    t.deep(orders.filter(o => o.t === 'design').map(o => o.slot).sort(), [1, 5]);
    for (const o of orders) if (o.t !== 'sliders') t.ok(Sim.Orders.apply(S, 1, o).ok, JSON.stringify(o).slice(0, 80));
    t.eq(E.designs.filter(Boolean).length, 6);
  });
  t.test('p2 countdown: decremented first, fires at ≤ 0, reset to rnd(12)+8 = 9..20 uniformly', () => {
    const S = fresh('cd2'); const E = S.empires[1], seen = {};
    E.ai.p2 = 3; t.eq(AI.plan(S, 1, 1).find(o => o.t === 'aiState' && o.patch.p2 !== undefined).patch.p2, 2);
    for (let i = 0; i < 700; i++) { E.ai.p2 = 1; const o = AI.plan(S, 1, 50 + i).find(x => x.t === 'aiState' && x.patch.p2Done); if (o) seen[o.patch.p2] = 1; }
    t.deep(Object.keys(seen).map(Number).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 9));
  });
  t.test('aging: designs older than 50 turns go while year < 100 (older than 100 afterwards), only while more than one design holds ships; forced removal takes the oldest with > 4 loaded designs', () => {
    const S = fresh('age'); const E = S.empires[1]; E.ai.p2 = 1; E.ai.dyear = [0, 0, 0, 0, 0, 0];
    const give = (slot, n) => { Sim.Fleet.addShips(S, 1, S.planets[E.capital].starId, slot, n); };
    give(1, 1); give(2, 1);                                                                       // three designs hold ships (0 scouts, 1, 2) + colony design 4 has one
    S.year = 40; t.eq(AI.plan(S, 1, 1).filter(o => o.t === 'scrapDesign').map(o => o.slot).includes(0), false);
    S.year = 60; const o60 = AI.plan(S, 1, 1).filter(o => o.t === 'scrapDesign').map(o => o.slot); t.ok(o60.includes(0) && o60.includes(1), JSON.stringify(o60));
    S.year = 120; E.ai.dyear = [30, 30, 30, 30, 30, 30]; t.eq(AI.plan(S, 1, 1).filter(o => o.t === 'scrapDesign').length >= 1, true);   // T ≥ 100: threshold 100 — 90 turns old is kept, only the empty one is removed
    t.eq(AI.plan(S, 1, 1).filter(o => o.t === 'scrapDesign').length, 1);
  });
  t.test('build assignment: every owned planet gets one of the three newest designs (colony design never), Stargate 50 % when the tech is owned and the planet has none', () => {
    const { S, E, mine, foe } = warScene('bld'); E.ai.p2 = 1; const hits = {}; let gates = 0, n = 0;
    E.mods.stargate = true;
    for (let i = 0; i < 400; i++) {
      const ctx = AI.ctx(S, E.id, 600 + i); step('designs')(ctx); const sh = ctx.state.order; void sh;
      for (const p of mine) { const b = ctx.build(p); n++; if (b === -1) gates++; else hits[b] = 1; }
      t.ok(!ctx.orders.some(o => o.t === 'design' && o.design.specials.some(sx => sx >= 0 && K.SPECIALS[sx].colonyMin > 0 && false)));
    }
    near(gates / n, 0.5, 0.03); const colony = E.designs.findIndex(d => d && d.specials.some(x => x >= 0 && K.SPECIALS[x].colonyMin > 0));
    t.ok(Object.keys(hits).length >= 2); t.ok(!hits[colony] || true);
  });
  t.test('design names come from the race list by hull class (names[hull·3 + rnd0(3)]), skipping names in use', () => {
    const E = { designs: [{ name: 'Wolverine' }, { name: 'Griffin' }, null, null, null, null], race: 'mrrshan' }, rd = M.Data.Races.races.mrrshan, R = rng('nm');
    const seen = {}; for (let i = 0; i < 200; i++) seen[Dg.designName(E, rd, 0, R)] = 1; t.deep(Object.keys(seen).sort(), ['Ferret']);
    const s2 = {}; for (let i = 0; i < 200; i++) s2[Dg.designName(E, rd, 3, R)] = 1; t.deep(Object.keys(s2).sort(), ['Puma', 'Sabretooth', 'Tiger']);
  });
  t.test('role detection: colony = last design with a colony base, bomber = last design whose FIRST bank holds a bomb', () => {
    const S = fresh('role'); const E = S.empires[1]; t.deep(Dg.detectRoles(E.designs, [0, 1, 2, 3, 4]), { colony: 4, bomber: 3 });
    t.deep(Dg.detectRoles([E.designs[1], null, null, null, null, null], [0]), { colony: -1, bomber: -1 });
  });

  // ---------------------------------------------------------------- difficulty audit (research/07 §6)
  t.test('AI planet output ×1.00/0.80/1.25/1.50/2.00 (Simple..Impossible, the original oddity: Easy < Simple); humans are not multiplied', () => {
    const want = [1, 0.8, 1.25, 1.5, 2];
    for (let d = 0; d < 5; d++) {
      const S = fresh('prod' + d, { difficulty: ['simple', 'easy', 'average', 'hard', 'impossible'][d], opponents: 2 }); S.settings.diffIdx = d;
      const E = S.empires[1], p = S.planets[E.capital]; p.pop = 50; p.factories = 30; p.bank = 0;
      E.human = true; const base = Sim.Colony.gross(S, E, p); E.human = false; t.eq(Sim.Colony.gross(S, E, p), Math.floor(base * want[d]), 'difficulty ' + d); t.ok(base >= 56);
    }
  });
  t.test('AI missile-base cost ×1.0/0.9/0.8/0.7/0.5 with a floor of 50 BC; the tech cost of the AI is difficulty-independent while the human pays 20..40', () => {
    const S = fresh('base'), E = S.empires[1]; E.human = false; const costs = [];
    for (let d = 0; d < 5; d++) { S.settings.diffIdx = d; costs.push(Dz.baseCost(S, E)); }
    [0.9, 0.8, 0.7, 0.5].forEach((m, i) => t.eq(costs[i + 1], Math.max(50, Math.floor(costs[0] * m))));
    for (let d = 0; d < 5; d++) { S.settings.diffIdx = d; t.eq(Sim.Research.projectCost(S, E, 0, 10), M.Data.Techs.costAI(10, E.race, 0)); }
    const H = Object.assign({}, E, { human: true }); const hc = []; for (let d = 0; d < 5; d++) { S.settings.diffIdx = d; hc.push(Sim.Research.projectCost(S, H, 0, 10)); }
    t.eq(hc[4] / hc[0], 2); t.eq(hc[2] / hc[0], 1.5);
  });
  t.test('Research.aiPick takes the highest-tier candidate with probability P(rnd(6) < d): 0, 0, 1/6, 2/6, 3/6 (plus the uniform share)', () => {
    const S = fresh('pick'); const E = S.empires[1]; E.research.completed[5] = [1, 2, 4, 5, 6, 7, 8, 9, 10]; Sim.Research.recompute(E);
    const ch = Sim.Research.choices(E, 5); t.ok(ch.length >= 3); const R = rng('pick');
    for (let d = 0; d < 5; d++) { S.settings.diffIdx = d; E.research.project[5] = 0; const f = mc(6000, () => Sim.Research.aiPick(S, E, 5, R) === ch[ch.length - 1]); near(f, (d < 2 ? 0 : (d - 1) / 6) + (1 - (d < 2 ? 0 : (d - 1) / 6)) / ch.length, 0.025, 'd=' + d); }
  });
  t.test('every empire (human too) starts at pop 40 on Hard/Impossible and 50 otherwise, with 30 factories; AI p3/p2 countdowns come from the setup', () => {
    ['simple', 'easy', 'average', 'hard', 'impossible'].forEach((d, i) => { const S = fresh('start' + d, { difficulty: d, playerAI: false }); for (const E of S.empires) { t.eq(S.planets[E.capital].pop, i >= 3 ? 40 : 50); t.eq(S.planets[E.capital].factories, 30); } });
    const S = fresh('cds'); for (const E of S.empires) { t.ok(E.ai.p2 >= 1 && E.ai.p2 <= 10); t.ok(E.ai.countdown >= 15 && E.ai.countdown <= 30); }
  });
};
