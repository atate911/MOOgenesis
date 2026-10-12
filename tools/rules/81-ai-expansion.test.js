// AI expansion: intel (centres, fronts, anchors), scouting + need_conquer, free colony ships, dispatch with escorts, the quirks, AI.onColonized
// — checked against research/07 §3 (colonisation), §8.1 (scouts), §1.3 (flag_send_colony), §6.1 (difficulty rows 6/7), research/08 §3.5/§4.2 (need_conquer, fronts).
// The behavioural section plays whole AI-only games (set MOO_LONG=1 for the full 6 seeds × 5 difficulties × 150 turns matrix; the default is a reduced but still meaningful sample).
module.exports = function (M, t) {
  const AI = M.AI, Sim = M.Sim, I = AI.Intel, C = AI.Colonize;
  const TYPE = ['none', 'radiated', 'toxic', 'inferno', 'dead', 'tundra', 'barren', 'minimal', 'desert', 'steppe', 'arid', 'ocean', 'jungle', 'terran'];
  const stepFn = name => AI.steps.find(s => s.name === name).fn;
  const sends = ctx => ctx.orders.filter(o => o.t === 'fleetSend');
  const conj = ctx => ctx.orders.filter(o => o.t === 'aiColonyShip');
  const count = (ships, slot) => ships[slot];

  function game(seed, diff, opts) {
    return Sim.Setup.create(Object.assign({ size: 'large', difficulty: diff || 'average', opponents: 3, race: 'human', seed, playerAI: true }, opts || {}));
  }
  function setType(p, idx, extra) {
    Object.assign(p, { typeIdx: idx, type: TYPE[idx], maxPop: idx ? 50 : 10, mp1: idx ? 50 : 10, mp2: idx ? 50 : 10, mp3: idx ? 50 : 10, special: 'normal', growth: idx && idx < 7 ? 'hostile' : 'normal' }, extra || {});
  }
  // A controlled galaxy: 24 stars on one line `spacing` map units apart (16 units = 2 parsecs: stars ±1 and ±2 are inside the fuel range of 3, ±3 and ±4 only with Reserve Fuel Tanks),
  // every free planet is Desert (type 8) unless a test changes it, Orion = star 23, empire e's homeworld = star homes[e] with the standard start fleet (2 scouts, 1 colony ship).
  function mini(o) {
    o = Object.assign({ spacing: 16, diff: 'average', empires: 2, seed: 'mini', homes: [12, 22], race: 'human', type: 8, xy: {} }, o || {});
    const S = Sim.Setup.create({ size: 'small', difficulty: o.diff, opponents: o.empires - 1, race: o.race, seed: o.seed, playerAI: true });
    S.nebulae = [];
    S.stars = S.stars.map((s, i) => Object.assign({}, s, { nebula: false, orion: i === 23, x: o.xy[i] ? o.xy[i][0] : 20 + o.spacing * i, y: o.xy[i] ? o.xy[i][1] : 60 }));
    for (const p of S.planets) if (p.owner >= 0) Sim.Colony.abandon(S, p);
    S.fleets = [];
    S.planets.forEach(p => setType(p, o.type));
    S.orion = 23; S.planets[23].special = 'orion'; S.guardian = { alive: true, star: 23 };
    S.empires.forEach((E, e) => {
      const hs = o.homes[e], p = S.planets[hs];
      setType(p, 13, { maxPop: 100, mp1: 100, mp2: 100, mp3: 100 });
      E.capital = hs; Sim.Vis.init(S, E); Sim.Colony.found(S, E, p, 0);
      p.pop = 50; p.factories = 30; p.name = 'Home' + e;
      Sim.Fleet.addShips(S, e, hs, 0, 2); Sim.Fleet.addShips(S, e, hs, 4, 1);
      Sim.Vis.explore(S, E, hs);
    });
    Sim.Fleet.updateRange(S); Sim.Vis.update(S); Sim.Econ.refresh(S);
    return S;
  }
  const colonise = (S, e, star, pop) => { const p = S.planets[star]; Sim.Colony.found(S, S.empires[e], p, pop || 2); Sim.Vis.explore(S, S.empires[e], star); return p; };
  const refresh = S => { Sim.Fleet.updateRange(S); Sim.Vis.update(S); };
  function run(S, e, names, seed) { const ctx = AI.ctx(S, e, seed === undefined ? 1 : seed); for (const n of names) stepFn(n)(ctx); return ctx; }
  const withQuirk = (name, val, fn) => { const old = AI.QUIRKS[name]; AI.QUIRKS[name] = val; try { return fn(); } finally { AI.QUIRKS[name] = old; } };
  // stand-in for the diplomacy engine (contact + attitude), so these tests keep working whatever Sim.Diplo does
  function withDiplo(stub, fn) {
    const old = Sim.Diplo; Sim.Diplo = Object.assign({ hasContact: () => false, status: () => ({ attitude: 0, treaty: 'none' }) }, stub);
    try { return fn(); } finally { Sim.Diplo = old; }
  }
  const mc = (n, f) => { let k = 0; for (let i = 0; i < n; i++) if (f(i)) k++; return k / n; };
  const tol = (p, n) => 4.5 * Math.sqrt(Math.max(p * (1 - p), 1e-9) / n) + 1e-9;
  const giveDesign = (S, e, slot, draft, grants) => {
    const E = S.empires[e]; Object.assign(E.grants, grants || {});
    const r = Sim.Orders.apply(S, e, { t: 'design', slot, design: draft });
    if (!r.ok) throw new Error('fixture design failed: ' + r.msg);
    return r;
  };
  const colonyDraft = (baseId, tanks, hull) => {                                       // (a Large hull cannot carry base + tanks at start technology: tank designs use the Huge hull)
    const K = M.Data.Components.idx, d = Sim.Design.blank(hull === undefined ? 2 : hull);
    d.name = 'Colonist'; d.engine = 0; d.specials[0] = K.specials[baseId]; if (tanks) d.specials[1] = K.specials['reserve-fuel-tanks'];
    return d;
  };

  // ============================== registry & determinism ==============================
  t.test('the three steps are registered in the original order (10 intel, 20 scouts, 25 colonize) and the quirks default to FIXED', () => {
    const o = n => (AI.steps.find(s => s.name === n) || {}).order;
    t.eq(o('intel'), 10); t.eq(o('scouts'), 20); t.eq(o('colonize'), 25);
    for (const q of ['fourthColonyShip', 'colonyDesignIndex', 'staleColonyOrbit', 'colonyRangeCap']) t.eq(AI.QUIRKS[q], false, q);
    t.ok(Sim.Orders.types().indexOf('aiColonyShip') >= 0, 'order aiColonyShip registered');
    t.eq(typeof AI.onColonized, 'function');
  });

  t.test('AI.plan is deterministic (same snapshot + seed → identical orders) and pure (the snapshot is untouched)', () => {
    const S = game('det1', 'average'); Sim.autoPlay(S, 30);
    const before = JSON.stringify(S);
    for (const e of S.empires) {
      if (!e.alive) continue;
      const a = JSON.stringify(AI.plan(S, e.id, 77)), b = JSON.stringify(AI.plan(S, e.id, 77));
      t.eq(a, b, 'empire ' + e.id);
      AI.plan(S, e.id, 78);
    }
    t.ok(JSON.stringify(S) === before, 'AI.plan mutated the snapshot');
  });

  t.test('purity also holds mid-game with fleets in flight and colony ships around', () => {
    const S = game('pure2', 'hard', { size: 'medium' }); Sim.autoPlay(S, 60);
    const before = JSON.stringify(S);
    for (const e of S.empires) for (let k = 0; k < 3; k++) if (e.alive) AI.plan(S, e.id, k);
    t.ok(JSON.stringify(S) === before, 'AI.plan mutated the snapshot');
  });

  t.test('the first plan of every empire is accepted by the sim (every fleetSend / aiColonyShip order applies)', () => {
    const S = game('apply1', 'average');
    for (const e of S.empires) {
      const orders = AI.plan(S, e.id, 3), res = Sim.Orders.applyAll(S, e.id, orders);
      orders.forEach((o, i) => { if (o.t === 'fleetSend' || o.t === 'aiColonyShip') t.ok(res[i].ok, o.t + ': ' + res[i].msg); });
    }
  });

  // ============================== intel ==============================
  t.test('territory centre = integer mean of the empire\'s planet coordinates; (0,0) for an empire without planets', () => {
    const S = mini({ homes: [12, 22] });
    colonise(S, 0, 14); colonise(S, 0, 17);
    const c = I.centres(S), xs = [12, 14, 17].map(i => S.stars[i].x);
    t.eq(c[0].x, Math.trunc((xs[0] + xs[1] + xs[2]) / 3)); t.eq(c[0].y, 60);
    t.eq(c[1].x, S.stars[22].x);
    Sim.Colony.abandon(S, S.planets[22]);
    t.deep(I.centres(S)[1], { x: 0, y: 0 });
  });

  t.test('"best speed" = best engine tech level in {6,12,…,48} + 3 (3 with only the Retro engine; other propulsion levels do not count)', () => {
    const S = mini(), E = S.empires[0];
    const bs = levels => { E.research.completed[4] = levels; return run(S, 0, ['intel']).shared.bestSpeed; };
    t.eq(bs([1]), 3); t.eq(bs([1, 3]), 3); t.eq(bs([1, 6]), 9); t.eq(bs([1, 6, 12, 18]), 21); t.eq(bs([1, 5, 6, 12, 48]), 51);
  });

  t.test('colonisable threshold follows the Planetology techs (7 Minimal … 1 Radiated); Silicoids settle every type from turn one', () => {
    const S = mini(), E = S.empires[0];
    const want = { 3: 6, 6: 5, 9: 4, 12: 3, 15: 2, 18: 1 };
    t.eq(I.colonyFor(AI.ctx(S, 0, 1)), 7);
    for (const lv of [3, 6, 9, 12, 15, 18]) {
      E.research.completed[3] = [1].concat([3, 6, 9, 12, 15, 18].filter(x => x <= lv)); Sim.Research.recompute(E);
      t.eq(I.colonyFor(AI.ctx(S, 0, 1)), want[lv], 'planetology level ' + lv);
    }
    const S2 = mini({ race: 'silicoid' }); t.eq(S2.empires[0].race, 'silicoid'); t.eq(I.colonyFor(AI.ctx(S2, 0, 1)), 1);
  });

  t.test('colonisable scan: unowned planets of type ≥ threshold; Orion only after the Guardian is dead; "in range" list = planets inside fuel range', () => {
    const S = mini(); setType(S.planets[23], 13, { special: 'orion' });
    for (let i = 0; i < 24; i++) if (i !== 12 && i !== 22 && i !== 23) setType(S.planets[i], 6);                // barren: below Minimal
    setType(S.planets[10], 7); setType(S.planets[16], 9); setType(S.planets[2], 11);                          // minimal in range, steppe at range 2, ocean far away
    let r = I.scanColonizable(AI.ctx(S, 0, 1));
    t.eq(r.have, true); t.deep(r.list, [10, 16]);                                                              // 2 is out of range, Orion hidden by the Guardian
    setType(S.planets[2], 6); r = I.scanColonizable(AI.ctx(S, 0, 1)); t.deep(r.list, [10, 16]); t.eq(r.have, true);
    for (const i of [10, 16]) setType(S.planets[i], 6);
    r = I.scanColonizable(AI.ctx(S, 0, 1)); t.eq(r.have, false, 'only the guarded Orion planet is left');
    S.guardian.alive = false; r = I.scanColonizable(AI.ctx(S, 0, 1)); t.eq(r.have, true);
    t.ok(r.list.length === 0, 'Orion is far away: not in range');
    setType(S.planets[10], 8); t.deep(I.scanColonizable(AI.ctx(S, 0, 1)).list, [10]);
    S.planets[10].owner = 1;                                                                                   // an owned planet is never "free"
    t.deep(I.scanColonizable(AI.ctx(S, 0, 1)).list, []);
  });

  t.test('fronts: an empire with no contact gets ONE dummy front at its own centre (relation +80), anchored at its nearest planet', () => {
    const S = mini();
    const ctx = run(S, 0, ['intel']), f = ctx.shared.fronts;
    t.eq(f.length, 1); t.eq(f[0].enemy, -1); t.eq(f[0].rel, 80); t.eq(f[0].anchor, 12); t.eq(f[0].star, 12);
    t.eq(f[0].x, ctx.shared.centre[0].x); t.eq(f[0].y, 60); t.eq(f[0].dist, 0);
    t.eq(ctx.shared.inFlight, 0);
  });

  t.test('fronts: with contact the front point lies 40 % of the way toward the rival centre (integer arithmetic); relation = min(relation, 0)', () => {
    const S = mini({ homes: [12, 14] });
    withDiplo({ hasContact: () => true, status: () => ({ attitude: -36 }) }, () => {
      const f = run(S, 0, ['intel']).shared.fronts, cx = S.stars[12].x, rx = S.stars[14].x;
      t.eq(f.length, 1); t.eq(f[0].enemy, 1); t.eq(f[0].x, Math.trunc((rx * 4 + cx * 6) / 10)); t.eq(f[0].y, 60); t.eq(f[0].rel, -36); t.deep(f[0].enemies, [1]);
    });
    withDiplo({ hasContact: () => true, status: () => ({ attitude: 48 }) }, () => {
      t.eq(run(S, 0, ['intel']).shared.fronts[0].rel, 0, 'friendly neighbours weigh 0');
    });
  });

  t.test('fronts: a rival whose front point lies within 10·BS+10 map units of an earlier front is dropped (not summed); beyond that it gets its own front', () => {
    // BS = 3 → merge range 40. e1's front point x = 224; e2 at x=343 gives 264 → distance 40 (dropped), e2 at x=344.. gives 40.4 → trunc 264? use explicit coordinates
    // e1 front point = trunc((244*4 + 212*6)/10) = 224 ; e2 at x=343 → trunc((343*4 + 1272)/10) = 264 → |264-224| = 40 ≤ 40 → dropped (enemies stays [1])
    const near = mini({ empires: 3, homes: [12, 14, 20], xy: { 20: [343, 60] } });
    withDiplo({ hasContact: () => true, status: () => ({ attitude: -12 }) }, () => {
      const f = run(near, 0, ['intel']).shared.fronts;
      t.eq(f.length, 1); t.deep(f[0].enemies, [1], 'distance exactly 40 is dropped, not merged'); t.eq(f[0].rel, -12);
    });
    // e2 at x=347 → point 266 → distance 42 > 40 → a second front; with a single planet both fronts share the anchor and are merged (enemies [1,2], relations add)
    const far = mini({ empires: 3, homes: [12, 14, 20], xy: { 20: [347, 60] } });
    withDiplo({ hasContact: () => true, status: () => ({ attitude: -12 }) }, () => {
      const ctx = run(far, 0, ['intel']), f = ctx.shared.fronts;
      t.eq(ctx.shared.bestSpeed, 3);
      t.eq(f.length, 1); t.deep(f[0].enemies, [1, 2], 'distance 42 survives as a second front (then merged by the shared anchor)'); t.eq(f[0].rel, -24);
      colonise(far, 0, 17); refresh(far);                                                                     // a second planet near the second front point gives it its own anchor
      const g = run(far, 0, ['intel']).shared.fronts;
      t.eq(g.length, 2); t.deep(g.map(x => x.enemy), [1, 2]); t.deep(g.map(x => x.anchor), [12, 17]);
    });
  });

  t.test('fronts that share an anchor planet are merged and their relation weights add (original: 5 merge passes)', () => {
    // only one planet → every front is anchored there; rivals on both sides give two distinct points 64 apart
    const S = mini({ empires: 3, homes: [12, 7, 17] });
    withDiplo({ hasContact: () => true, status: (s, a, b) => ({ attitude: b === 1 ? -12 : -24 }) }, () => {
      const ctx = run(S, 0, ['intel']), f = ctx.shared.fronts;
      t.eq(f.length, 1); t.eq(f[0].rel, -36); t.deep(f[0].enemies, [1, 2]); t.eq(f[0].enemy, 1);
    });
    withDiplo({ hasContact: () => true, status: (s, a, b) => ({ attitude: b === 1 ? 24 : -24 }) }, () => {
      t.eq(run(S, 0, ['intel']).shared.fronts[0].rel, -24, 'friendly relation counts 0');
    });
  });

  t.test('front anchor: nearest owned planet; a missile base or exactly ONE ship in the first non-empty stack makes a planet "defended" and overrides it (2+ ships do not)', () => {
    const S = mini(); colonise(S, 0, 8); colonise(S, 0, 16);            // home 12 sits at the centre of 8,12,16
    const anchor = () => run(S, 0, ['intel']).shared.fronts[0].anchor;
    t.eq(anchor(), 12, 'nearest to the centre; the home stack has 2 scouts (not defended)');
    S.planets[8].bases = 1; t.eq(anchor(), 8, 'a missile base');
    S.planets[8].bases = 0;
    Sim.Fleet.addShips(S, 0, 16, 1, 2); t.eq(anchor(), 12, 'two fighters are not "defended" (the original tests defence == 1)');
    S.fleets.find(f => f.owner === 0 && f.star === 16).ships[1] = 1; t.eq(anchor(), 16, 'exactly one ship');
    S.fleets.find(f => f.owner === 0 && f.star === 12).ships = [1, 0, 0, 0, 1, 0]; t.eq(anchor(), 12, 'home now holds a single scout (first stack = 1): defended and nearest');
    S.planets[8].bases = 3; t.eq(anchor(), 12, 'nearest of several defended planets wins');
  });

  t.test('contact falls back to the geometric rule without the diplomacy engine (a planet within max fuel range of a rival planet)', () => {
    if (Sim.Diplo && Sim.Diplo.hasContact) t.skip('real Diplo present');
    const S = mini({ homes: [12, 14] });
    t.eq(I.contactWith(S, 0, 1), true);
    t.eq(I.contactWith(mini({ homes: [12, 22] }), 0, 1), false);
  });

  t.test('Intel.send: every design in the orbit leaves (escorts too); range flag 2 lets only tank designs go; flag 0 sends nothing; bookkeeping follows', () => {
    const S = mini();
    Sim.Fleet.addShips(S, 0, 12, 1, 5);                                          // five fighters (no tanks) join 2 scouts + colony ship
    let ctx = run(S, 0, ['intel']);
    const star = x => ctx.range(x);
    t.eq(star(10), 1); t.eq(star(9), 2); t.eq(star(0), 0);
    t.eq(ctx.shared.inFlight, 0);
    t.deep(I.send(ctx, 12, 10), [2, 5, 0, 0, 1, 0]);
    t.deep(ctx.shared.orbit[12], [0, 0, 0, 0, 0, 0]); t.eq(ctx.shared.inFlight, 1); t.eq(ctx.shared.moving[0].to, 10);
    t.eq(I.send(ctx, 12, 11), null, 'nothing left');
    ctx = run(S, 0, ['intel']);
    t.deep(I.send(ctx, 12, 9), [2, 0, 0, 0, 0, 0]); t.deep(ctx.shared.orbit[12], [0, 5, 0, 0, 1, 0]);
    t.eq(I.send(ctx, 12, 0), null, 'out of range');
    t.eq(I.send(ctx, 12, 12), null);
    const o = sends(ctx); t.eq(o.length, 1); t.eq(o[0].t, 'fleetSend'); t.eq(o[0].from, 12); t.eq(o[0].to, 9);
  });

  t.test('"fleets in flight" starts as my number of moving fleets and the shared counter grows with every dispatch', () => {
    const S = mini();
    Sim.Fleet.addShips(S, 0, 12, 1, 4);
    S.fleets.push({ id: 900, owner: 0, star: -1, from: 12, to: 10, x: 100, y: 60, speed: 2, ships: [0, 2, 0, 0, 0, 0] }, { id: 901, owner: 1, star: -1, from: 22, to: 21, x: 330, y: 60, speed: 2, ships: [0, 1, 0, 0, 0, 0] });
    const ctx = run(S, 0, ['intel']);
    t.eq(ctx.shared.inFlight, 1); t.eq(ctx.shared.galaxyMoving, 2);
    stepFn('scouts')(ctx);
    t.eq(ctx.shared.inFlight, 1 + sends(ctx).length); t.ok(sends(ctx).length >= 1);
  });

  // ============================== scouts ==============================
  t.test('turn 1: the two scouts go to the two lowest-index unexplored in-range planets (one ship each); the colony ship — the only ship left — is dispatched as the third "scout"', () => {
    const S = mini();                                                           // in range: stars 8, 9 (flag 2, tanks needed), 10, 11, 13, 14 (flag 1), 15, 16 (flag 2)
    const ctx = run(S, 0, ['intel', 'scouts']), o = sends(ctx);
    t.eq(o.length, 3);
    t.deep(o.map(x => x.to), [8, 9, 10]);
    t.deep(o[0].counts, [1, 0, 0, 0, 0, 0]); t.deep(o[1].counts, [1, 0, 0, 0, 0, 0]); t.deep(o[2].counts, [0, 0, 0, 0, 1, 0]);
    t.ok(o.every(x => x.from === 12));
    // when the next target is a range-2 planet the colony ship (no tanks) cannot go there and waits for the next range-1 target
    const S2 = mini(); for (const i of [8, 10]) S2.empires[0].explored[i] = 1;
    const o2 = sends(run(S2, 0, ['intel', 'scouts']));
    t.deep(o2.map(x => x.to), [9, 11, 13], 'scouts take 9 (flag 2) and 11, the colony ship the next target it can reach');
    t.deep(o2.map(x => x.counts.findIndex(c => c > 0)), [0, 0, 4]);
    const S3 = mini(); S3.fleets = []; Sim.Fleet.addShips(S3, 0, 12, 4, 1); for (const i of [10, 11]) S3.empires[0].explored[i] = 1; refresh(S3);
    const o3 = sends(run(S3, 0, ['intel', 'scouts']));
    t.deep(o3.map(x => x.to), [13], 'targets 8 and 9 are range-2 planets: the colony ship has no tanks and waits for the first range-1 target');
  });

  t.test('scouts skip explored planets, owned planets, the Orion star, planets under foreign (non-allied) ships and planets that already are the destination of my fleets', () => {
    const S = mini();
    S.empires[0].explored[10] = 1;                                              // explored → skipped
    colonise(S, 1, 11);                                                         // owned (by empire 1) → not a scout target
    Sim.Fleet.addShips(S, 1, 13, 1, 1);                                         // foreign ship over 13
    S.fleets.push({ id: 950, owner: 0, star: -1, from: 12, to: 14, x: 200, y: 60, speed: 2, ships: [0, 1, 0, 0, 0, 0] });   // my fleet heads for 14
    Sim.Fleet.addShips(S, 0, 12, 1, 3);
    refresh(S);
    const o = sends(run(S, 0, ['intel', 'scouts']));
    // in-range candidates are 10 (explored), 11 (owned), 13 (foreign ships), 14 (destination): nothing left at range 1; range-2 stars 9, 15 get the scouts
    t.ok(o.length >= 1 && o.every(x => ![10, 11, 13, 14].includes(x.to)), JSON.stringify(o.map(x => x.to)));
    S.orion = 9; S.planets[9].special = 'orion'; S.planets[23].special = 'normal';
    const o2 = sends(run(S, 0, ['intel', 'scouts']));
    t.ok(o2.every(x => x.to !== 9), 'Orion is never scouted');
    // a foreign ALLIED fleet does not block (ctx.allied)
    const S3 = mini(); Sim.Fleet.addShips(S3, 1, 10, 1, 1);
    withDiplo({ isAllied: (s, a, b) => a !== b }, () => { t.ok(sends(run(S3, 0, ['intel', 'scouts'])).some(x => x.to === 10), 'allied ships do not hide a planet'); });
    t.ok(!sends(run(S3, 0, ['intel', 'scouts'])).some(x => x.to === 10), 'non-allied ships do');
  });

  t.test('scout source = the nearest star where I have ANY ship (ties → lowest star index)', () => {
    const S = mini(); S.empires[0].explored.fill(1);
    Sim.Fleet.addShips(S, 0, 14, 0, 1);                                          // a parked scout two stars away
    S.empires[0].explored[13] = 0; refresh(S);
    let o = sends(run(S, 0, ['intel', 'scouts']));
    t.eq(o.length, 1); t.eq(o[0].to, 13); t.eq(o[0].from, 12, '13 is 16 from home and 16 from star 14: tie → lowest star index');
    S.empires[0].explored.fill(1); S.empires[0].explored[11] = 0; refresh(S);
    o = sends(run(S, 0, ['intel', 'scouts']));
    t.eq(o[0].to, 11); t.eq(o[0].from, 12, '11: home is 16 away, star 14 is 48 away');
    S.empires[0].explored.fill(1); S.empires[0].explored[15] = 0; refresh(S);
    o = sends(run(S, 0, ['intel', 'scouts']));
    t.eq(o[0].to, 15); t.eq(o[0].from, 14, '15: star 14 is 16 away, home 48 away');
  });

  t.test('scout design: the first design with Reserve Fuel Tanks that has ships, else the last design present; sends floor(n/4)+1 ships; local counts shrink', () => {
    const S = mini();
    S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 0, 8);
    let o = sends(run(S, 0, ['intel', 'scouts']));
    t.deep(o.map(x => x.counts[0]), [3, 2, 1, 1, 1], '8 scouts: floor(n/4)+1 each: 3, then 5→2, then 3→1, 2→1, 1→1');
    S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 1, 9); Sim.Fleet.addShips(S, 0, 12, 2, 3);
    o = sends(run(S, 0, ['intel', 'scouts']));
    t.deep(o.map(x => x.counts.map((c, i) => c ? i + ':' + c : '').join('')), ['2:1', '2:1', '2:1', '1:3'], 'no tanks: the LAST design present is used until it is gone');
    S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 1, 9); Sim.Fleet.addShips(S, 0, 12, 0, 1);
    o = sends(run(S, 0, ['intel', 'scouts']));
    t.eq(o[0].counts[0], 1, 'the scout (tanks) beats the fighters'); t.eq(o[1].counts[1], 3, 'then the fighters: 9/4+1');
  });

  t.test('scouts reach range-2 planets only with a tank design (fighters stay home), and take them in index order', () => {
    const S = mini();
    for (const i of [10, 11, 13, 14]) S.empires[0].explored[i] = 1;              // everything at range 1 is known
    S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 1, 3); refresh(S);
    t.eq(sends(run(S, 0, ['intel', 'scouts'])).length, 0, 'fighters cannot reach range-2 planets');
    Sim.Fleet.addShips(S, 0, 12, 0, 2); refresh(S);
    const o = sends(run(S, 0, ['intel', 'scouts']));
    t.deep(o.map(x => x.to), [8, 9], 'two scouts → the two lowest-index range-2 targets (8, 9)');
    t.ok(o.every(x => x.counts[1] === 0 && x.counts[0] === 1));
  });

  t.test('need_conquer: 1-in-(8−difficulty) per turn (Simple 1/8 … Impossible 1/4) when no colonisable planet exists anywhere', () => {
    const S = mini({ type: 6 });                                                 // every free planet is Barren: nothing colonisable at Minimal tech
    const n = 6000;
    for (const [d, p] of [[0, 1 / 8], [1, 1 / 7], [2, 1 / 6], [3, 1 / 5], [4, 1 / 4]]) {
      S.settings.diffIdx = d;
      const ctx = AI.ctx(S, 0, 40 + d);
      const f = mc(n, () => { ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx); C.scouts(ctx); return ctx.shared.needConquer; });
      t.near(f, p, tol(p, n), 'difficulty ' + d);
    }
  });

  t.test('need_conquer is cleared while a colonisable free planet exists anywhere (even out of range), and after the game has ended (final war)', () => {
    const S = mini({ type: 6 }); setType(S.planets[0], 9);                       // one steppe planet, far outside the fuel range
    S.settings.diffIdx = 4;
    const ctx = AI.ctx(S, 0, 5);
    t.eq(mc(1500, () => { ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx); C.scouts(ctx); return ctx.shared.needConquer; }), 0);
    setType(S.planets[0], 6);
    t.ok(mc(1500, () => { ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx); C.scouts(ctx); return ctx.shared.needConquer; }) > 0.15, 'back to the normal 1/4');
    S.council.finalWar = { refusers: [1], winner: 0, year: 1 };
    t.eq(mc(1500, () => { ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx); C.scouts(ctx); return ctx.shared.needConquer; }), 0, 'game ended');
  });

  // ============================== free colony ships ==============================
  const spawnRate = (S, e, n, tp) => {
    S.empires[e].flow.gross = tp;
    const ctx = AI.ctx(S, e, 11);
    return mc(n, () => { ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx); C.haveColonyShip(ctx); return conj(ctx).length > 0; });
  };

  t.test('spawn probability = clamp(floor(0.4·TP), 1, 500)/500 per turn (Average): TP 55 → 4.4 %, 100 → 8 %, 300 → 24 %, ≥ 1250 → every turn', () => {
    const S = mini(), n = 12000;
    for (const [tp, p] of [[55, 22 / 500], [100, 40 / 500], [300, 120 / 500], [800, 320 / 500]]) t.near(spawnRate(S, 0, n, tp), p, tol(p, n), 'TP ' + tp);
    t.eq(spawnRate(S, 0, 400, 1250), 1); t.eq(spawnRate(S, 0, 400, 99999), 1);
    t.near(spawnRate(S, 0, 20000, 2), 1 / 500, 0.004, 'TP 2 → prod floors to 0 → clamped to 1');
  });

  t.test('difficulty throttle: Simple keeps the roll 1/6 of the time, Easy 2/6, Average and up always (TP 300 → 24 % × factor)', () => {
    const n = 20000;
    for (const [d, k] of [[0, 1 / 6], [1, 2 / 6], [2, 1], [3, 1], [4, 1]]) {
      const S = mini({ diff: ['simple', 'easy', 'average', 'hard', 'impossible'][d] });
      t.eq(S.settings.diffIdx, d);
      const p = 0.24 * k; t.near(spawnRate(S, 0, n, 300), p, tol(p, n), 'difficulty ' + d);
    }
  });

  t.test('no ship is conjured without a colonisable free planet, without production, without fronts or without a colony design; existing ships still get dispatched (returns true)', () => {
    const S = mini({ type: 6 });                                                 // nothing colonisable
    t.eq(spawnRate(S, 0, 3000, 1250), 0);
    let ctx = run(S, 0, ['intel']); t.eq(C.haveColonyShip(ctx), true, 'the start colony ship exists → "send what exists"');
    const S2 = mini(); S2.empires[0].flow.gross = 0;
    t.eq(spawnRate(S2, 0, 500, 0), 0);
    ctx = run(S2, 0, ['intel']); t.eq(C.haveColonyShip(ctx), false, 'TP 0 → false');
    const S3 = mini(); S3.fleets = S3.fleets.filter(f => f.owner !== 0); S3.empires[0].flow.gross = 1250;
    ctx = run(S3, 0, ['intel']); t.eq(C.haveColonyShip(ctx), true, 'spawns (probability 1)'); t.eq(conj(ctx).length, 1);
    const S4 = mini(); S4.empires[0].designs[4] = null; S4.empires[0].dstats[4] = null; S4.fleets = [];
    ctx = run(S4, 0, ['intel']); t.eq(C.colonySlot(ctx), -1); t.eq(C.haveColonyShip(ctx), false, 'no colony design');
    const S5 = mini(); S5.empires[0].flow.gross = 1250; ctx = run(S5, 0, ['intel']); ctx.shared.fronts = [];
    t.eq(C.haveColonyShip(ctx), false, 'no fronts');
  });

  t.test('the conjured ship appears at a UNIFORMLY random front anchor (one roll per turn), in the colony design slot, and counts immediately in the planned orbit', () => {
    const S = mini({ homes: [12, 22] }); colonise(S, 0, 14); colonise(S, 0, 16);
    S.empires[0].flow.gross = 1250;
    const ctx = AI.ctx(S, 0, 9), hits = { 12: 0, 14: 0, 16: 0 }, n = 9000;
    for (let i = 0; i < n; i++) {
      ctx.shared = {}; ctx.orders.length = 0; stepFn('intel')(ctx);
      ctx.shared.fronts = [{ anchor: 12 }, { anchor: 14 }, { anchor: 16 }];
      C.haveColonyShip(ctx);
      const o = conj(ctx); t.eq(o.length, 1); t.eq(o[0].slot, 4);
      hits[o[0].planet]++;
      if (i === 0) t.eq(ctx.shared.orbit[o[0].planet][4], (o[0].planet === 12 ? 2 : 1), 'planned orbit includes the new ship');
    }
    for (const a of [12, 14, 16]) t.near(hits[a] / n, 1 / 3, tol(1 / 3, n), 'anchor ' + a);
  });

  // ============================== dispatch ==============================
  const stackCtx = (S, e) => run(S, e, ['intel']);

  t.test('dispatch: candidates are served in planet-index order; the nearest colony-ship stack takes the target and the WHOLE orbit (escorts too) leaves, once per source per turn', () => {
    const S = mini(); S.fleets = [];
    Sim.Fleet.addShips(S, 0, 12, 4, 2); Sim.Fleet.addShips(S, 0, 12, 1, 5);      // 2 colony ships + 5 fighters at home
    S.planets[10].typeIdx = 6; S.planets[10].type = 'barren';                      // 10 is not colonisable by the standard base → first candidate is 11
    refresh(S);
    const ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    const o = sends(ctx);
    t.eq(o.length, 1, 'one source stack serves exactly one target per turn'); t.eq(o[0].to, 11); t.eq(o[0].from, 12);
    t.deep(o[0].counts, [0, 5, 0, 0, 2, 0]);
  });

  t.test('dispatch: with two stacks each target takes the NEAREST one (distance in map units; ties → lowest index); a served stack is refreshed (fixed) so the next target uses the other stack', () => {
    const S = mini(); S.fleets = [];
    Sim.Fleet.addShips(S, 0, 12, 4, 1); Sim.Fleet.addShips(S, 0, 17, 4, 1);
    refresh(S);
    const ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    const o = sends(ctx), by = to => o.find(x => x.to === to);
    t.eq(o.length, 2);
    t.eq(by(10).from, 12, 'candidate 10 (lowest index) → home stack');
    t.eq(by(11).from, 17, 'candidate 11: the home stack is gone, so the other one (the fixed variant refreshes the local copy)');
  });

  t.test('quirk staleColonyOrbit: Classic does not refresh the source count, so the second candidate picks the emptied stack again and gets nothing', () => {
    const S = mini(); S.fleets = [];
    Sim.Fleet.addShips(S, 0, 12, 4, 1); Sim.Fleet.addShips(S, 0, 15, 4, 1); refresh(S);
    let ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    t.deep(sends(ctx).map(x => x.to + '<' + x.from), ['10<12', '11<15'], 'fixed: the emptied home stack is refreshed, so candidate 11 takes the other stack');
    withQuirk('staleColonyOrbit', true, () => {
      ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
      t.deep(sends(ctx).map(x => x.to + '<' + x.from), ['10<12', '14<15'], 'Classic: candidates 11 and 13 find the stale (emptied) home stack nearest and get nothing; 14 is nearer to the other stack');
    });
  });

  t.test('quirk colonyRangeCap: Classic only sends when the nearest stack is within fuel·15 = 45 map units; the fixed default sends anywhere inside the fuel range', () => {
    const S = mini(); S.fleets = []; colonise(S, 0, 17);                          // two planets: 12 and 17; planet 15 is inside the fuel range of 17 but 48 units from the stack at 12
    for (let i = 0; i < 24; i++) if (![12, 17, 22, 23].includes(i)) setType(S.planets[i], 6);
    setType(S.planets[15], 8); Sim.Fleet.addShips(S, 0, 12, 4, 1); refresh(S);
    t.eq(S.empires[0].frange[15], 1);
    let ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    t.deep(sends(ctx).map(x => x.to), [15], 'fixed default: sent although 48 > 45');
    withQuirk('colonyRangeCap', true, () => { ctx = stackCtx(S, 0); C.sendColonyShips(ctx); t.eq(sends(ctx).length, 0, 'Classic: 48 map units > 45 → stays home'); });
    setType(S.planets[15], 6); setType(S.planets[14], 8); refresh(S);
    withQuirk('colonyRangeCap', true, () => { ctx = stackCtx(S, 0); C.sendColonyShips(ctx); t.deep(sends(ctx).map(x => x.to), [14], '32 units ≤ 45 → sent'); });
  });

  t.test('dispatch threshold comes from the colony DESIGN: Standard base → Minimal+; a Barren colony base also settles Barren; Silicoids settle every type', () => {
    const S = mini(); S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 4, 1);
    for (let i = 0; i < 24; i++) if (![12, 22, 23].includes(i)) setType(S.planets[i], 3);     // inferno everywhere
    setType(S.planets[10], 6); setType(S.planets[11], 7); refresh(S);                           // barren (10) and minimal (11) in range
    let ctx = stackCtx(S, 0); C.sendColonyShips(ctx); t.deep(sends(ctx).map(x => x.to), [11], 'standard base skips barren 10');
    giveDesign(S, 0, 5, colonyDraft('barren-colony-base', false), { 'special:barren-colony-base': true });
    S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 5, 1);
    ctx = stackCtx(S, 0); t.eq(C.colonySlot(ctx), 5, 'the LAST design with a colony base is the colony design');
    C.sendColonyShips(ctx); t.deep(sends(ctx).map(x => x.to), [10], 'barren base reaches planet 10 first (index order)');
    const SS = mini({ race: 'silicoid' }); SS.fleets = []; Sim.Fleet.addShips(SS, 0, 12, 4, 1);
    for (let i = 0; i < 24; i++) if (![12, 22, 23].includes(i)) setType(SS.planets[i], 1);
    refresh(SS); ctx = stackCtx(SS, 0); C.sendColonyShips(ctx); t.deep(sends(ctx).map(x => x.to), [10], 'Silicoid goes to a Radiated planet with a standard base');
  });

  t.test('targets already approached by a fleet that carries colony ships are ignored (a fleet without colony ships does not block)', () => {
    const S = mini(); S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 4, 1);
    S.fleets.push({ id: 910, owner: 0, star: -1, from: 12, to: 10, x: 200, y: 60, speed: 2, ships: [0, 0, 0, 0, 1, 0] });
    S.fleets.push({ id: 911, owner: 0, star: -1, from: 12, to: 11, x: 200, y: 60, speed: 2, ships: [1, 0, 0, 0, 0, 0] });
    refresh(S);
    const ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    t.deep(sends(ctx).map(x => x.to), [11]);
  });

  t.test('Orion is never a colony target while the Guardian lives; afterwards it is an ordinary candidate (index order)', () => {
    const S = mini({ homes: [21, 3] }); S.fleets = []; Sim.Fleet.addShips(S, 0, 21, 4, 1);          // Orion (star 23) is two stars from the home: inside the fuel range
    for (let i = 0; i < 24; i++) if (![21, 3, 23].includes(i)) setType(S.planets[i], 6);
    setType(S.planets[23], 13, { special: 'orion' }); refresh(S);
    let ctx = stackCtx(S, 0); t.eq(ctx.range(23), 1); C.sendColonyShips(ctx); t.eq(sends(ctx).length, 0, 'the Guardian lives');
    S.guardian.alive = false;
    ctx = stackCtx(S, 0); C.sendColonyShips(ctx); t.deep(sends(ctx).map(x => x.to), [23]);
  });

  t.test('range-2 targets need Reserve Fuel Tanks on the colony design; escorts without tanks stay behind when the stack goes', () => {
    const S = mini(); S.fleets = [];
    for (const i of [8, 9, 10, 11, 13, 14, 15, 16]) setType(S.planets[i], 6);
    setType(S.planets[9], 8); refresh(S);
    Sim.Fleet.addShips(S, 0, 12, 4, 1); Sim.Fleet.addShips(S, 0, 12, 1, 2);
    let ctx = stackCtx(S, 0); C.sendColonyShips(ctx); t.eq(sends(ctx).length, 0, 'no tanks → a range-2 planet is out of reach');
    giveDesign(S, 0, 5, colonyDraft('standard-colony-base', true, 3));
    S.empires[0].designs[4] = null; S.empires[0].dstats[4] = null; S.fleets = [];
    Sim.Fleet.addShips(S, 0, 12, 5, 1); Sim.Fleet.addShips(S, 0, 12, 1, 2); Sim.Fleet.addShips(S, 0, 12, 0, 1);
    ctx = stackCtx(S, 0); C.sendColonyShips(ctx);
    const o = sends(ctx); t.eq(o.length, 1); t.eq(o[0].to, 9);
    t.deep(o[0].counts, [1, 0, 0, 0, 0, 1], 'colony ship + scout (tanks) go; the two fighters stay');
    t.deep(ctx.shared.orbit[12], [0, 2, 0, 0, 0, 0]);
  });

  // ============================== flag_send_colony ==============================
  const contactAll = fn => withDiplo({ hasContact: () => true }, fn);
  function youngEmpire(obj) {
    const S = mini({ homes: [12, 14] });
    S.empires[1].human = true;                                                       // a human in contact (stubbed below)
    S.empires[0].objective = obj; S.empires[0].flow.gross = 1250;
    colonise(S, 0, 10); colonise(S, 0, 11); colonise(S, 0, 13);                      // three fresh colonies (pop 2): all of them "developing"
    refresh(S); return S;
  }
  t.test('flag_send_colony: a non-Expansionist with > half of its planets developing stops DISPATCHING while a human has contact — but still conjures ships', () => {
    const S2 = youngEmpire(1); S2.empires[0].explored.fill(1);                       // Militarist; nothing to scout
    contactAll(() => {
      const c2 = run(S2, 0, ['intel', 'scouts', 'colonize']);
      t.eq(c2.shared.humanContact, true); t.eq(C.sendAllowed(c2), false);
      t.eq(conj(c2).length, 1, 'the free ship is still conjured'); t.eq(sends(c2).length, 0, 'but nothing is sent');
    });
  });

  t.test('flag_send_colony: Expansionists are exempt; so is everybody when no human is in contact or the colonies have grown', () => {
    contactAll(() => {
      const S = youngEmpire(2); S.empires[0].explored.fill(1);
      let c = run(S, 0, ['intel', 'scouts', 'colonize']); t.eq(c.shared.humanContact, true); t.eq(C.sendAllowed(c), true); t.ok(sends(c).length >= 1, 'Expansionist dispatches');
      const S2 = youngEmpire(1); S2.empires[0].explored.fill(1); S2.empires[1].human = false;
      c = run(S2, 0, ['intel', 'scouts', 'colonize']); t.eq(c.shared.humanContact, false); t.eq(C.sendAllowed(c), true); t.ok(sends(c).length >= 1, 'no human contact → no throttle');
      const S3 = youngEmpire(1); S3.empires[0].explored.fill(1);
      for (const p of S3.planets) if (p.owner === 0) { p.pop = Math.floor(p.mp3 * 0.8); p.bases = 0; }
      c = run(S3, 0, ['intel', 'scouts', 'colonize']); t.eq(C.sendAllowed(c), true, 'grown colonies are not "developing" (pop ≥ 2/3 max)');
      const S4 = youngEmpire(1); for (const p of S4.planets) if (p.owner === 0) p.bases = 99;
      t.eq(C.sendAllowed(run(S4, 0, ['intel'])), true, 'planets with enough missile bases are not "developing"');
    });
  });

  // ============================== quirks ==============================
  const fourColonyShips = () => { const S = mini(); S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 4, 4); S.empires[0].explored.fill(1); S.empires[0].flow.gross = 1250; refresh(S); return S; };
  t.test('quirk fourthColonyShip: with more than 3 colony ships the original neither conjures nor dispatches; the fixed default sends what exists and conjures nothing', () => {
    const S = fourColonyShips();
    let ctx = run(S, 0, ['intel', 'scouts', 'colonize']);
    t.eq(conj(ctx).length, 0, 'fixed: no spawn above 3'); t.deep(sends(ctx).map(x => x.to), [10], 'fixed: the stack is dispatched');
    withQuirk('fourthColonyShip', true, () => { ctx = run(S, 0, ['intel', 'scouts', 'colonize']); t.eq(conj(ctx).length, 0); t.eq(sends(ctx).length, 0, 'the curse: nothing leaves'); });
    const S3 = fourColonyShips(); Sim.Fleet.addShips(S3, 0, 12, 4, -1);                // 3 ships: not cursed
    withQuirk('fourthColonyShip', true, () => { ctx = run(S3, 0, ['intel', 'scouts', 'colonize']); t.eq(conj(ctx).length, 1, '3 colony ships → still conjures'); t.ok(sends(ctx).length >= 1); });
  });

  t.test('quirk fourthColonyShip counts colony ships EVERYWHERE (orbits and fleets in flight)', () => {
    const S = mini(); S.fleets = []; Sim.Fleet.addShips(S, 0, 12, 4, 2);
    S.fleets.push({ id: 920, owner: 0, star: -1, from: 12, to: 10, x: 200, y: 60, speed: 2, ships: [0, 0, 0, 0, 2, 0] });
    S.empires[0].explored.fill(1); S.empires[0].flow.gross = 1250; refresh(S);
    withQuirk('fourthColonyShip', true, () => { const ctx = run(S, 0, ['intel', 'scouts', 'colonize']); t.eq(conj(ctx).length, 0); t.eq(sends(ctx).length, 0); });
  });

  t.test('quirk colonyDesignIndex: before the first p2 run the colony role points at design slot 1 (the Fighter): no dispatch of the real colony ship, a "free colony ship" is a Fighter', () => {
    const S = mini(); S.empires[0].explored.fill(1); S.empires[0].flow.gross = 1250; refresh(S);
    let ctx = run(S, 0, ['intel']); t.eq(C.colonySlot(ctx), 4, 'fixed: detected from turn one');
    withQuirk('colonyDesignIndex', true, () => {
      ctx = run(S, 0, ['intel']); t.eq(C.colonySlot(ctx), 1);
      ctx = run(S, 0, ['intel', 'scouts', 'colonize']);
      t.eq(conj(ctx).length, 1); t.eq(conj(ctx)[0].slot, 1, 'a Fighter is conjured');
      t.ok(!sends(ctx).some(x => x.counts[4] > 0 && x.counts[1] === 0), 'the real colony ship does not leave as a colony ship');
      S.empires[0].ai.p2Done = true;                                             // set by the design planner at its first run
      ctx = run(S, 0, ['intel']); t.eq(C.colonySlot(ctx), 4, 'after the first p2 the role is detected');
    });
  });

  t.test('quirk colonyDesignIndex falls back to "first p2 has surely run by turn 10" when the design planner leaves no flag', () => {
    const S = mini(); S.turn = 10;
    withQuirk('colonyDesignIndex', true, () => t.eq(C.colonySlot(run(S, 0, ['intel'])), 4));
  });

  // ============================== the conjure order ==============================
  t.test('order aiColonyShip: adds one ship of the colony design to the stationary fleet at an owned planet — AI empires only, once per turn, own planet, colony designs only', () => {
    const S = mini(); colonise(S, 0, 14);                                         // planet 14 has no fleet yet
    const at = (star, slot) => { const f = Sim.Fleet.at(S, star, 0); return f ? f.ships[slot] : 0; };
    t.eq(at(12, 4), 1);
    const r1 = Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 12 });
    t.ok(r1.ok, r1.msg); t.eq(at(12, 4), 2); t.eq(r1.slot, 4);
    const r2 = Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 14 }); t.eq(r2.ok, false, 'one free ship per turn'); t.eq(at(14, 4), 0);
    S.turn++;
    const r3 = Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 14, slot: 4 }); t.ok(r3.ok, r3.msg); t.eq(at(14, 4), 1, 'a new stationary fleet is created');
    S.turn++;
    t.eq(Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 8 }).ok, false, 'not an owned planet');
    t.eq(Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 22 }).ok, false, 'someone else\'s planet');
    t.eq(Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 12, slot: 1 }).ok, false, 'a Fighter is not a colony design');
    t.eq(Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 12, slot: 5 }).ok, false, 'empty slot');
    S.empires[0].human = true;
    t.eq(Sim.Orders.apply(S, 0, { t: 'aiColonyShip', planet: 12 }).ok, false, 'humans cannot conjure ships');
  });

  t.test('order aiColonyShip defaults to the LAST colony-base design and a planned spawn is applied before the dispatch that uses it', () => {
    const S = mini(); S.fleets = []; S.empires[0].explored.fill(1); S.empires[0].flow.gross = 1250; refresh(S);
    const ctx = run(S, 0, ['intel', 'scouts', 'colonize']);
    t.eq(conj(ctx).length, 1);
    const s = sends(ctx); t.eq(s.length, 1, 'the conjured ship leaves in the same plan'); t.eq(s[0].counts[4], 1);
    t.ok(ctx.orders.indexOf(conj(ctx)[0]) < ctx.orders.indexOf(s[0]), 'conjure comes first');
    const res = Sim.Orders.applyAll(S, 0, ctx.orders.filter(o => o.t === 'aiColonyShip' || o.t === 'fleetSend'));
    t.ok(res.every(r => r.ok), JSON.stringify(res));
    t.eq(S.fleets.filter(f => f.owner === 0 && f.star < 0).length, 1);
  });

  // ============================== AI.onColonized ==============================
  t.test('AI.onColonized gives a new AI colony the §2.2 defaults (pop 2, IND 100 / others 0, builds slot 0, rally = itself) and leaves human colonies alone', () => {
    const S = mini(), E = S.empires[0];
    const p = colonise(S, 0, 10);
    p.sliders = [20, 20, 20, 20, 20]; p.build = 3; p.reloc = 5; p.trans = { to: 12, n: 1 };
    AI.onColonized(S, E, p);
    t.deep(p.sliders, [0, 0, 100, 0, 0]); t.eq(p.build, 0); t.eq(p.reloc, p.starId); t.eq(p.trans, null); t.eq(p.pop, 2); t.eq(p.factories, 0);
    E.human = true; p.sliders = [20, 20, 20, 20, 20];
    AI.onColonized(S, E, p); t.deep(p.sliders, [20, 20, 20, 20, 20], 'humans keep their own settings');
  });

  t.test('a dispatched colony ship founds the colony on arrival and the hook runs (whole-turn integration on the controlled galaxy)', () => {
    const S = mini({ seed: 'integration' });
    let founded = -1;
    for (let k = 0; k < 8 && founded < 0; k++) { Sim.autoTurn(S); if (S.planets[13].owner === 0 || S.planets[14].owner === 0 || S.planets[10].owner === 0 || S.planets[11].owner === 0) founded = S.turn; }
    t.ok(founded > 0 && founded <= 6, 'a first colony within a few turns, got ' + founded);
    const p = S.planets.find(q => q.owner === 0 && q.id !== 12);
    t.ok(p && p.pop >= 2, 'colony has population'); t.eq(p.build, 0);
  });

  // ============================== whole games ==============================
  const DIFFS = ['simple', 'easy', 'average', 'hard', 'impossible'];
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  function sample(seeds, diffs, turns) {
    const marks = [25, 50, 100, 150].filter(m => m <= turns), out = {};
    for (const d of diffs) {
      out[d] = { all: {}, byObj: {}, ships: [] };
      for (const m of marks) out[d].all[m] = [];
      for (const seed of seeds) {
        const S = game('exp-' + seed, d, { opponents: 3, size: 'large' });
        Sim.autoPlay(S, turns, (rep, S2) => {
          if (marks.includes(S2.turn)) for (const e of Sim.stats(S2)) { out[d].all[S2.turn].push(e.colonies); if (S2.turn === marks[marks.length - 1]) (out[d].byObj[e.objective] = out[d].byObj[e.objective] || []).push(e.colonies); }
        });
      }
    }
    return { out, marks };
  }
  const LONG = !!process.env.MOO_LONG;
  t.test(LONG ? 'AI-only games, 6 seeds × 5 difficulties × 150 turns: everyone expands; Simple/Easy expand slower than Hard/Impossible' : 'AI-only games (reduced: 3 seeds × Simple/Hard/Impossible × 100 turns; MOO_LONG=1 for the full matrix): everyone expands; Simple expands slower than Hard/Impossible', () => {
    const seeds = LONG ? [1, 2, 3, 4, 5, 6] : [1, 2, 3], diffs = LONG ? DIFFS : ['simple', 'hard', 'impossible'], turns = LONG ? 150 : 100;
    const { out, marks } = sample(seeds, diffs, turns), T = marks[marks.length - 1];
    const rep = [];
    for (const d of diffs) rep.push(d + ' ' + marks.map(m => 'T' + m + ':' + median(out[d].all[m]) + '(' + mean(out[d].all[m]).toFixed(1) + ')').join(' '));
    if (process.env.MOO_VERBOSE) console.log('      expansion (median(mean) colonies): ' + rep.join(' | '));
    for (const d of diffs) { t.ok(median(out[d].all[T]) >= 3, d + ': median colonies at T' + T + ' = ' + median(out[d].all[T])); t.ok(out[d].all[T].filter(c => c <= 1).length <= out[d].all[T].length * 0.34, d + ': too many AIs stuck at one colony'); }
    const slow = mean(['simple', 'easy'].filter(d => out[d]).reduce((a, d) => a.concat(out[d].all[T]), []).concat(out.simple ? [] : [])), fast = mean(['hard', 'impossible'].reduce((a, d) => a.concat(out[d].all[T]), []));
    t.ok(slow < fast, 'Simple/Easy (' + slow.toFixed(2) + ') must expand slower than Hard/Impossible (' + fast.toFixed(2) + ') at T' + T);
  });
};
