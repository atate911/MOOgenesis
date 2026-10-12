// Espionage rules (research/05 §5, research/08 §10, research/01 §4.7, research/02 §1.10): hiring, roll tables (Monte-Carlo), tech candidates, missions, orders.
module.exports = function (M, t) {
  const Sp = M.Sim.Spy, O = M.Sim.Orders, Tc = M.Data.Techs;

  // ---- fixtures -------------------------------------------------------------------------------------------------------------------------------
  function mk(extra) {
    return M.Sim.Setup.create(Object.assign({ size: 'medium', opponents: 3, race: 'human', seed: 'spy-fx', difficulty: 'average' }, extra));
  }
  function scripted(seq, seed) {                               // R whose first int() calls return `seq` (clamped to the asked range), then a seeded stream
    const base = M.RNG.create(seed || 'scripted'), q = seq.slice();
    const r = {
      int(lo, hi) { if (q.length) { const v = q.shift(); return v < lo ? lo : v > hi ? hi : v; } return base.int(lo, hi); },
      dice(n, s) { let tot = 0; for (let i = 0; i < n; i++) tot += r.int(1, s); return tot; },
      next() { return base.next(); }, chance(p) { return base.chance(p); }, pick(a) { return base.pick(a); },
    };
    return r;
  }
  function withDiplo(mock, fn) {
    const old = M.Sim.Diplo; M.Sim.Diplo = mock;
    try { return fn(); } finally { if (old === undefined) delete M.Sim.Diplo; else M.Sim.Diplo = old; }
  }
  function mockDiplo(log, contact) {
    return { hasContact: () => (contact === undefined ? true : contact), incident: (S, kind, from, to, dv, info) => { log.push({ kind, from, to, dv, info }); } };
  }
  function grant(S, E, f, levels) { for (const l of levels) if (Tc.byFL[f][l]) M.Sim.Research.grant(S, E, f, l, 'test'); }
  // victim rich in techs: every level up to `max` in every field
  function enrich(S, E, max) { for (let f = 0; f < 6; f++) { const all = []; for (let l = 2; l <= max; l++) all.push(l); grant(S, E, f, all); } }
  function setTL(E, comp, weap) { E.research.tl[0] = comp; if (weap !== undefined) E.research.tl[5] = weap; }
  // one spy war pairing: A spies on T
  function pair(extra, spies, mode) {
    const S = mk(extra), A = S.empires[0], T = S.empires[1];
    A.race = 'human'; T.race = 'bulrathi';                      // no spy bonuses (Darlok) by accident of the seed
    A.spies[1] = spies === undefined ? 1 : spies; A.spyMode[1] = mode === undefined ? 1 : mode; A.spyBudget[1] = 0;
    setTL(A, 10, 10); setTL(T, 10, 10); T.security = 0;
    return { S, A, T };
  }
  const techCount = E => E.research.completed.reduce((a, l) => a + l.length, 0);
  const evs = (S, type) => (S.ev || []).filter(e => e.type === type);

  // ---- hiring (§5.1) -----------------------------------------------------------------------------------------------------------------------------
  t.test('spy: base cost = 2 x Computers TL + 25 (the Guide example: TL 13 = 51 BC)', () => {
    const S = mk(), E = S.empires[0];
    E.research.tl[0] = 13; t.eq(Sp.baseCost(S, E), 51);
    E.research.tl[0] = 1; t.eq(Sp.baseCost(S, E), 27);
    E.research.tl[0] = 50; t.eq(Sp.baseCost(S, E), 125);
  });
  t.test('spy: Darlok pay half (truncated)', () => {
    const S = mk(), E = S.empires[0]; E.race = 'darlok';
    E.research.tl[0] = 13; t.eq(Sp.baseCost(S, E), 25);
    E.research.tl[0] = 1; t.eq(Sp.baseCost(S, E), 13);
  });
  t.test('spy: buying doubles the price for every spy bought in the same turn', () => {
    t.deep(Sp.buyPlan(27, 100), { n: 2, rest: 19 });           // 27 + 54
    t.deep(Sp.buyPlan(27, 80), { n: 1, rest: 53 });
    t.deep(Sp.buyPlan(27, 26), { n: 0, rest: 26 });
    t.deep(Sp.buyPlan(10, 10 + 20 + 40 + 80), { n: 4, rest: 0 });
    t.deep(Sp.buyPlan(10, 10 + 20 + 40 + 80 + 159), { n: 4, rest: 159 });
  });
  t.test('spy: buildTurn spends budget (per-mille of gross) plus the carried fund, remainder carries over', () => {
    const S = mk(), A = S.empires[0]; A.flow = { gross: 2000 }; A.research.tl[0] = 1; A.spyBudget[1] = 40;
    withDiplo(mockDiplo([]), () => {
      Sp.buildTurn(S, M.RNG.bind(S.rs));                       // fund 80 -> 27 (+ 54 > 53 left)
      t.eq(A.spies[1], 1); t.eq(A.spyFund[1], 53);
      Sp.buildTurn(S, M.RNG.bind(S.rs));                       // 133 -> 27 + 54 = 81, rest 52
      t.eq(A.spies[1], 3); t.eq(A.spyFund[1], 52);
    });
  });
  t.test('spy: no budget, no spies; budget toward an empire out of contact is forced to 0 and the spies hide', () => {
    const S = mk(), A = S.empires[0]; A.flow = { gross: 5000 }; A.spyBudget[2] = 0; A.spyBudget[1] = 100; A.spyMode[1] = 2;
    withDiplo(mockDiplo([], false), () => { Sp.buildTurn(S, M.RNG.bind(S.rs)); });
    t.eq(A.spies[1], 0); t.eq(A.spies[2], 0); t.eq(A.spyBudget[1], 0); t.eq(A.spyMode[1], 0);
  });
  t.test('spy: a dead target takes its spies, budget and fund with it', () => {
    const S = mk(), A = S.empires[0]; A.spyFund = [0, 0, 0, 9, 0, 0]; A.spies[3] = 4; A.spyBudget[3] = 30; S.empires[3].alive = false;
    withDiplo(mockDiplo([]), () => { Sp.buildTurn(S, M.RNG.bind(S.rs)); });
    t.eq(A.spies[3], 0); t.eq(A.spyBudget[3], 0); t.eq(A.spyFund[3], 0);
  });

  // ---- orders ---------------------------------------------------------------------------------------------------------------------------------------
  t.test('spy orders: spyBudget and spyMode are registered at load and validate like human orders', () => {
    t.ok(O.types().indexOf('spyBudget') >= 0 && O.types().indexOf('spyMode') >= 0);
    const S = mk(), A = S.empires[0];
    withDiplo(mockDiplo([]), () => {
      t.deep(O.apply(S, 0, { t: 'spyBudget', target: 1, value: 40 }), { ok: true, value: 40 });
      t.eq(A.spyBudget[1], 40);
      t.eq(O.apply(S, 0, { t: 'spyBudget', target: 1, value: 250 }).value, 100);   // clamped to 10.0 %
      t.eq(O.apply(S, 0, { t: 'spyBudget', target: 1, value: -5 }).value, 0);
      t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 0, value: 10 }).ok, 'not on yourself');
      t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 9, value: 10 }).ok, 'unknown empire');
      t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 1 }).ok, 'value missing');
      t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 1, value: 'x' }).ok);
      t.eq(O.apply(S, 0, { t: 'spyMode', target: 1, mode: 'sabotage' }).mode, 2); t.eq(A.spyMode[1], 2);
      t.eq(O.apply(S, 0, { t: 'spyMode', target: 1, mode: 1 }).mode, 1);
      t.eq(O.apply(S, 0, { t: 'spyMode', target: 1, mode: 'Hide' }).mode, 0);
      t.ok(!O.apply(S, 0, { t: 'spyMode', target: 1, mode: 3 }).ok);
      t.ok(!O.apply(S, 0, { t: 'spyMode', target: 1, mode: 'stab' }).ok);
    });
    S.empires[2].alive = false;
    t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 2, value: 10 }).ok, 'dead target');
  });
  t.test('spy orders: no budget or active mode toward an empire out of contact', () => {
    const S = mk();
    withDiplo(mockDiplo([], false), () => {
      t.ok(!O.apply(S, 0, { t: 'spyBudget', target: 1, value: 10 }).ok);
      t.ok(O.apply(S, 0, { t: 'spyBudget', target: 1, value: 0 }).ok);
      t.ok(!O.apply(S, 0, { t: 'spyMode', target: 1, mode: 1 }).ok);
      t.ok(O.apply(S, 0, { t: 'spyMode', target: 1, mode: 0 }).ok);
    });
  });
  t.test('spy orders: AI empires use the same validation', () => {
    const S = mk(); withDiplo(mockDiplo([]), () => {
      t.ok(O.apply(S, 2, { t: 'spyBudget', target: 0, value: 8 }).ok); t.eq(S.empires[2].spyBudget[0], 8);
      t.ok(!O.apply(S, 2, { t: 'spyBudget', target: 2, value: 8 }).ok);
    });
  });

  // ---- the roll tables (§5.3) -----------------------------------------------------------------------------------------------------------------------
  t.test('spy: detection and infiltration edges (dt1 / dt2) incl. security, Darlok +30/+20 and the hide bonus', () => {
    const S = mk(), A = S.empires[0], T = S.empires[1];
    setTL(A, 30); setTL(T, 10); T.security = 0;
    t.deep(Sp.dts(S, A, T, 1), { dt1: 20, dt2: 0 });
    t.deep(Sp.dts(S, A, T, 0), { dt1: 50, dt2: 0 });           // hiding: +30 on the (unused) success roll
    setTL(A, 10); setTL(T, 30); T.security = 100;
    t.deep(Sp.dts(S, A, T, 1), { dt1: 0, dt2: 20 + 20 });      // 20 computer gap + security 100 / 5
    A.race = 'darlok'; t.deep(Sp.dts(S, A, T, 1), { dt1: 10 + 30 - 30 > 0 ? 10 + 30 - 30 : 0, dt2: Math.max(0, 30 - 40) + 20 });   // Darlok spy: 10+30 = 40 vs 30
    A.race = 'human'; T.race = 'darlok'; t.deep(Sp.dts(S, A, T, 1), { dt1: 0, dt2: (30 + 20 - 10) + 20 });   // Darlok defender: 30+20 vs 10
  });
  t.test('spy: analytic tables — infiltration (16 + dt1)%, frame dt1%, per-spy catch bands', () => {
    t.near(Sp.infiltrationChance(0), 0.16, 1e-9); t.near(Sp.infiltrationChance(30), 0.46, 1e-9); t.near(Sp.infiltrationChance(84), 1, 1e-9); t.near(Sp.infiltrationChance(200), 1, 1e-9);
    t.near(Sp.frameChance(0), 0, 1e-9); t.near(Sp.frameChance(40), 0.4, 1e-9);
    const o = Sp.catchOdds(0); t.near(o.confess, 0.01, 1e-9); t.near(o.eliminated, 0.29, 1e-9); t.near(o.stopped, 0.20, 1e-9); t.near(o.clear, 0.50, 1e-9);
    const p = Sp.catchOdds(20); t.near(p.confess, 0.21, 1e-9); t.near(p.eliminated, 0.29, 1e-9); t.near(p.stopped, 0.20, 1e-9); t.near(p.clear, 0.30, 1e-9);
  });
  function mc(extra, n, spies, mode, setup) {                  // run `n` single-turn missions, returns frequencies from the mission log
    const { S, A } = pair(extra, spies, mode); if (setup) setup(S, A, S.empires[1]);
    const R = M.RNG.bind(S.rs);
    let caught = 0, succ = 0, frame = 0, failed = 0, any = 0;
    withDiplo(mockDiplo([]), () => {
      for (let i = 0; i < n; i++) {
        A.spies[1] = spies === undefined ? 1 : spies;
        const out = Sp.turn(S, R); for (const it of out) it.answer(null);
        const e = S.spy.log[0]; caught += e.caught; failed += e.failed; if (e.success) succ++; if (e.frame) frame++; if (e.anyCaught) any++;
      }
    });
    return { caught: caught / n, failed: failed / n, success: succ / n, frame: frame / n, any: any / n };
  }
  t.test('spy MC: one spy on a mission at equal tech — caught 30%, survives-and-works 50% x 16% = 8% success', () => {
    const r = mc({ seed: 'mc1' }, 20000);
    t.near(r.caught, 0.30, 0.012); t.near(r.failed, 0.50, 0.012); t.near(r.success, 0.08, 0.008);
  });
  t.test('spy MC: a 30-point computer lead raises the infiltration chance to 46% of the surviving groups', () => {
    const r = mc({ seed: 'mc2' }, 20000, 1, 1, (S, A, T) => { setTL(A, 40, 10); setTL(T, 10, 10); });
    t.near(r.success, 0.5 * 0.46, 0.01); t.near(r.caught, 0.30, 0.012);
  });
  t.test('spy MC: a computer lead beyond 84 points makes infiltration certain and frame-ups likely', () => {
    const r = mc({ seed: 'mc3' }, 8000, 1, 1, (S, A, T) => { setTL(A, 99, 10); setTL(T, 10, 10); });
    t.near(r.success, 0.5 * 1.0 - 0.0, 0.015);                 // survives (r <= 50 only: the defender edge is 0)
    t.near(r.frame / r.success, 0.89, 0.02);                   // dt1 = 89: the frame roll rnd + 89 > 100 holds for rnd >= 12 -> 89%
  });
  t.test('spy MC: hiding spies are caught individually on rnd(100) + dt2 > 85 (15% at equal tech)', () => {
    const r = mc({ seed: 'mc4' }, 20000, 1, 0);
    t.near(r.caught, 0.15, 0.01); t.eq(r.success, 0);
    const q = mc({ seed: 'mc4b' }, 20000, 4, 0); t.near(q.caught, 0.60, 0.02);       // 4 spies: 4 x 15%
  });
  t.test('spy MC: security adds security/5 to the detection roll; a better defender computer adds the gap', () => {
    const r = mc({ seed: 'mc5' }, 20000, 1, 0, (S, A, T) => { T.security = 100; });                 // +20 -> 35%
    t.near(r.caught, 0.35, 0.012);
    const q = mc({ seed: 'mc6' }, 20000, 1, 0, (S, A, T) => { setTL(T, 30, 10); });                 // +20 gap -> 35%
    t.near(q.caught, 0.35, 0.012);
  });
  t.test('spy MC: Darlok spy rolls (+30 attack) and Darlok defence (+20)', () => {
    const r = mc({ seed: 'mc7' }, 20000, 1, 1, (S, A, T) => { A.race = 'darlok'; });                // dt1 = 30 -> 46% of the survivors
    t.near(r.success, 0.5 * 0.46, 0.01);
    const q = mc({ seed: 'mc8' }, 20000, 1, 1, (S, A, T) => { T.race = 'darlok'; });                // dt2 = 20 -> caught 50%, failed 70%
    t.near(q.caught, 0.50, 0.012); t.near(q.failed, 0.70, 0.012);
  });
  t.test('spy: a confession (roll > 99) loses the whole network and ends the mission', () => {
    const { S, A } = pair({ seed: 'conf' }, 5, 1);
    withDiplo(mockDiplo([]), () => {
      const out = Sp.turn(S, scripted([100]));
      t.eq(A.spies[1], 0); t.eq(S.spy.caught[1][0], 5); t.eq(S.spy.totals[1][0], 5); t.eq(out.length, 0);
      t.eq(S.spy.log[0].success, 0);
    });
  });
  t.test('spy: eliminated spies are lost, stopped spies survive but cannot work that turn', () => {
    const { S, A } = pair({ seed: 'elim' }, 3, 1);
    withDiplo(mockDiplo([]), () => {
      Sp.turn(S, scripted([80, 60, 10, 1]));                   // eliminated, stopped, clear; the group then fails to infiltrate (roll 1)
      t.eq(A.spies[1], 2); t.eq(S.spy.log[0].caught, 1); t.eq(S.spy.log[0].failed, 2); t.eq(S.spy.log[0].active, 1); t.eq(S.spy.log[0].success, 0);
    });
  });
  t.test('spy: needs a planet on both sides and a living target', () => {
    const { S, A } = pair({ seed: 'noplanet' }, 2, 1);
    for (const p of S.planets) if (p.owner === 1) p.owner = -1;
    withDiplo(mockDiplo([]), () => { Sp.turn(S, scripted([80])); });
    t.eq(A.spies[1], 2); t.eq(S.spy.log.length, 0);
  });

  // ---- candidate techs (§5.4, research/02 §1.10) ---------------------------------------------------------------------------------------------------
  t.test('spy: steal cap = best roll x the victim best TL / 100', () => {
    const S = mk(), T = S.empires[1]; T.research.tl = [10, 20, 30, 40, 25, 12];
    t.eq(Sp.stealCap(100, T), 40); t.eq(Sp.stealCap(50, T), 20); t.eq(Sp.stealCap(1, T), 0); t.eq(Sp.stealCap(37, T), 14);
  });
  t.test('spy: tech value = level^2, x10 singular, x6 robotic controls, x3 waste / eco restoration, /4 under a higher owned tier, Death Ray 30000', () => {
    const tier = {};
    t.eq(Sp.techValue(Tc.byFL[0][34], tier), 34 * 34 * 10);     // singular (hyperspace communications)
    t.eq(Sp.techValue(Tc.byFL[0][8], tier), 64 * 6);            // robotic controls III
    t.eq(Sp.techValue(Tc.byFL[1][5], tier), 25 * 3);            // reduced industrial waste
    t.eq(Sp.techValue(Tc.byFL[3][5], tier), 25 * 3);            // eco restoration
    t.eq(Sp.techValue(Tc.byFL[5][5], tier), 25);                // a beam weapon
    t.eq(Sp.techValue(Tc.byFL[5][36], tier), 30000);
    t.eq(Sp.techValue(Tc.byFL[5][5], { beam: Tc.byFL[5][20].gtier }), 6);   // floor(25/4) with a higher beam owned
    t.eq(Sp.techValue(Tc.byFL[5][20], { beam: Tc.byFL[5][20].gtier }), 0);  // the same tier = nothing to gain
  });
  t.test('spy: the 12 obsolescence groups are not stealable when an equal or higher tier is owned', () => {
    const S = mk(), A = S.empires[0], T = S.empires[1];
    grant(S, A, 0, [18]); grant(S, T, 0, [8, 28]);             // A owns robotic controls IV; T has III and V
    const cands = Sp.sample(S, A, T, M.RNG.create('g1'), 6).concat(Sp.sample(S, A, T, M.RNG.create('g2'), 6));
    t.ok(!cands.some(c => c.field === 0 && c.level === 8), 'level 8 (tier III) is below the owned tier IV');
    const tiers = {}; for (const l of A.research.completed[0]) { const x = Tc.byFL[0][l]; if (x && x.gtier) tiers[x.group] = Math.max(tiers[x.group] || 0, x.gtier); }
    t.ok(!Sp.stealable(A, Tc.byFL[0][8], tiers)); t.ok(Sp.stealable(A, Tc.byFL[0][28], tiers));
    // groups outside the 12 stay stealable (at a quarter of the value): older beam weapons
    grant(S, A, 5, [20]); const tb = {}; for (const l of A.research.completed[5]) { const x = Tc.byFL[5][l]; if (x && x.gtier) tb[x.group] = Math.max(tb[x.group] || 0, x.gtier); }
    t.ok(Sp.stealable(A, Tc.byFL[5][5], tb));
  });
  t.test('spy: a Silicoid thief never gets waste, controlled-environment, eco-restoration (or soil/atmosphere) techs; advanced and start techs are never stolen', () => {
    const S = mk(), A = S.empires[0], T = S.empires[1]; A.race = 'silicoid';
    for (const [f, l] of [[1, 5], [1, 15], [3, 3], [3, 5], [3, 6], [3, 13], [3, 16], [3, 22]]) t.ok(!Sp.stealable(A, Tc.byFL[f][l], {}), 'f' + f + ' l' + l);
    A.race = 'human'; for (const [f, l] of [[1, 5], [3, 3], [3, 5]]) t.ok(Sp.stealable(A, Tc.byFL[f][l], {}));
    t.ok(!Sp.stealable(A, Tc.byFL[0][55], {}), 'advanced'); t.ok(!Sp.stealable(A, Tc.byFL[2][1], {}), 'level-1 bundle');
    enrich(S, T, 30);
    A.race = 'silicoid';
    for (let i = 0; i < 30; i++) for (const c of Sp.sample(S, A, T, M.RNG.create('sil' + i), 6)) t.ok(!(c.tech.never && c.tech.never.indexOf('silicoid') >= 0) && ['waste', 'environment', 'eco-restoration'].indexOf(c.tech.group) < 0, c.tech.id);
  });
  t.test('spy: the sampler returns up to 6 distinct techs the victim has and the thief lacks', () => {
    const S = mk(), A = S.empires[0], T = S.empires[1]; enrich(S, T, 40);
    for (let i = 0; i < 20; i++) {
      const c = Sp.sample(S, A, T, M.RNG.create('smp' + i), 6), keys = c.map(x => x.field + ':' + x.level);
      t.eq(c.length, 6); t.eq(new Set(keys).size, 6);
      for (const x of c) { t.ok(T.research.completed[x.field].indexOf(x.level) >= 0); t.ok(A.research.completed[x.field].indexOf(x.level) < 0); }
    }
    const few = mk(), a2 = few.empires[0], t2 = few.empires[1]; grant(few, t2, 4, [3, 6]);
    t.ok(Sp.sample(few, a2, t2, M.RNG.create('few'), 6).length <= 2, 'only what exists');
  });
  t.test('spy: a human is offered at most one tech per field (best of 5 sampler rounds), all within the cap', () => {
    const S = mk(), A = S.empires[0], T = S.empires[1]; enrich(S, T, 40);
    const offer = Sp.offer(S, A, T, 25, M.RNG.create('off'));
    t.ok(offer.length >= 3 && offer.length <= 6);
    t.eq(new Set(offer.map(o => o.field)).size, offer.length);
    for (const o of offer) t.ok(o.level <= 25);
    t.eq(Sp.offer(S, A, T, 0, M.RNG.create('off0')).length, 0, 'cap 0: nothing qualifies');
  });

  // ---- the espionage mission ------------------------------------------------------------------------------------------------------------------------
  function stealFixture(human, extra) {
    const f = pair(Object.assign({ seed: 'steal' }, extra || {}), 2, 1);
    enrich(f.S, f.T, 40); f.T.research.tl = [60, 60, 60, 60, 60, 60]; setTL(f.A, 30, 10); setTL(f.T, 10, 10); f.T.research.tl = [10, 60, 60, 60, 60, 60];
    f.A.human = human; f.T.human = false; f.S.ev = [];
    return f;
  }
  t.test('spy: a human success returns a spyStealChoice interrupt; answering with an index grants that tech with source "spy"', () => {
    const { S, A, T } = stealFixture(true);
    const log = []; let it;
    withDiplo(mockDiplo(log), () => {
      const out = Sp.turn(S, scripted([1, 1, 70, 100]));       // both clear, infiltration 70 + 20 > 84, best steal roll 100
      t.eq(out.length, 1); it = out[0];
      t.eq(it.type, 'spyStealChoice'); t.eq(it.empire, 0); t.eq(it.target, 1); t.eq(it.n, 2); t.eq(it.cap, 60);
      t.ok(it.candidates.length >= 3);
      t.eq(it.fields.filter(Boolean).length, it.candidates.length);
      for (const c of it.candidates) { t.ok(c.level <= it.cap && c.name && c.desc !== undefined); t.eq(c.fieldName, Tc.FIELD_NAMES[c.field]); }
      const c0 = it.candidates[1], before = techCount(A);
      const res = it.answer(1);
      t.eq(res.granted.level, c0.level); t.eq(res.granted.field, c0.field);
      t.eq(techCount(A), before + 1); t.ok(A.research.completed[c0.field].indexOf(c0.level) >= 0);
      const te = evs(S, 'tech').filter(e => e.source === 'spy'); t.eq(te.length, 1); t.eq(te[0].empire, 0);
      t.eq(it.answer(0), res, 'idempotent: the first answer wins');
      t.eq(log.length, 0, 'nobody was caught: no diplomatic penalty');
    });
  });
  t.test('spy: answering by field, aborting with null, and the default (highest value) all work', () => {
    for (const mode of ['field', 'abort', 'default']) {
      const { S, A } = stealFixture(true, { seed: 'steal-' + mode });
      withDiplo(mockDiplo([]), () => {
        const it = Sp.turn(S, scripted([1, 1, 70, 100]))[0], before = techCount(A);
        if (mode === 'field') { const c = it.candidates[0]; const r = it.answer({ field: c.field }); t.eq(r.granted.field, c.field); t.eq(techCount(A), before + 1); }
        if (mode === 'abort') { const r = it.answer(null); t.ok(r.aborted && !r.granted); t.eq(techCount(A), before); t.eq(A.spies[1], 2, 'the spies stay'); }
        if (mode === 'default') { const r = it.answer(undefined); const best = Math.max.apply(null, it.candidates.map(c => c.value)); t.eq(it.candidates.filter(c => c.level === r.granted.level && c.field === r.granted.field)[0].value, best); }
      });
    }
  });
  t.test('spy: a driver that ignores the answer still gets the default pick when it moves past the interrupt', () => {
    const { S, A } = stealFixture(true, { seed: 'steal-iter' });
    withDiplo(mockDiplo([]), () => {
      const out = Sp.turn(S, scripted([1, 1, 70, 100])), before = techCount(A); let n = 0;
      for (const it of out) { n++; t.ok(!it.done); }           // what turn.js does: for (const ev of sp) yield ev;
      t.eq(n, 1); t.eq(techCount(A), before + 1); t.ok(out[0].done);
    });
  });
  t.test('spy: unanswered choices from an older turn are settled by the next flush', () => {
    const { S, A } = stealFixture(true, { seed: 'steal-flush' });
    withDiplo(mockDiplo([]), () => {
      const out = Sp.turn(S, scripted([1, 1, 70, 100])), before = techCount(A);
      t.eq(S.spy.pending.length, 1);
      Sp.flush(S, M.RNG.bind(S.rs)); t.eq(S.spy.pending.length, 0); t.eq(techCount(A), before + 1); t.ok(out[0].done);
    });
  });
  t.test('spy: an identified human spy costs the victim AI 5d12 relation points (dtype 4) — not when it frames somebody', () => {
    const { S, A } = stealFixture(true, { seed: 'steal-id' });
    const log = [];
    withDiplo(mockDiplo(log), () => {
      const it = Sp.turn(S, scripted([60, 1, 70, 100]))[0];     // one spy stopped (identified), the other works
      t.ok(it.anyCaught); it.answer(0);
      t.eq(log.length, 1); t.eq(log[0].kind, 'spyTheft'); t.eq(log[0].from, 0); t.eq(log[0].to, 1); t.between(log[0].dv, -60, -5); t.eq(log[0].info.dtype, 4);
    });
    // frame-up: infiltration roll 99 + dt1 20 > 100
    const f = stealFixture(true, { seed: 'steal-frame' }); const log2 = [];
    withDiplo(mockDiplo(log2), () => {
      const it = Sp.turn(f.S, scripted([60, 1, 99, 100]))[0];
      t.ok(it.frame && it.frameChoices.length === 2); t.eq(it.frameChoices.map(c => c.empire).sort().join(), '2,3');
      const r = it.answer({ index: 0, frame: 2 });
      t.eq(r.framed, 2); t.eq(log2.length, 1); t.eq(log2[0].kind, 'spyFrameTheft'); t.eq(log2[0].from, 2); t.eq(log2[0].to, 1); t.between(log2[0].dv, -24, -2); t.eq(log2[0].info.dtype, 5);
    });
  });
  t.test('spy: frame-up needs two other empires in contact with the victim; an answer naming a stranger is ignored', () => {
    const f = stealFixture(true, { seed: 'steal-nf' }); f.S.empires[3].alive = false;
    withDiplo(mockDiplo([]), () => {
      const it = Sp.turn(f.S, scripted([1, 1, 99, 100]))[0];
      t.ok(!it.frame && it.frameChoices.length === 0);
      t.eq(it.answer({ index: 0, frame: 2 }).framed, -1);
    });
  });
  t.test('spy: an AI thief takes the first candidate within the cap — no interrupt, one tech, source "spy"', () => {
    const { S, A, T } = stealFixture(false, { seed: 'steal-ai' });
    withDiplo(mockDiplo([]), () => {
      const before = techCount(A), out = Sp.turn(S, scripted([1, 1, 70, 100]));
      t.eq(out.length, 0); t.eq(techCount(A), before + 1);
      const te = evs(S, 'tech'); t.eq(te.length, 1); t.eq(te[0].source, 'spy'); t.eq(te[0].empire, 0);
      t.ok(T.research.completed[te[0].field].indexOf(te[0].level) >= 0, 'stolen from the victim');
      t.ok(te[0].level <= 60);
    });
  });
  t.test('spy: nothing above the cap is ever stolen', () => {
    const { S, A, T } = stealFixture(false, { seed: 'steal-cap' }); T.research.tl = [10, 10, 10, 10, 10, 10];
    withDiplo(mockDiplo([]), () => {
      for (let i = 0; i < 15; i++) { A.spies[1] = 2; Sp.turn(S, scripted([1, 1, 70, 40], 'cap' + i)); }   // best roll 40 -> cap 4
      for (const e of evs(S, 'tech')) t.ok(e.level <= 4, 'level ' + e.level);
    });
  });
  t.test('spy: an AI thief frames a random third empire when its infiltration roll exceeds 100, and a human victim sees "unknown spies" otherwise', () => {
    const { S, A, T } = stealFixture(false, { seed: 'steal-vn' }); T.human = true;
    withDiplo(mockDiplo([]), () => {
      Sp.turn(S, scripted([1, 1, 70, 100]));
      let n = evs(S, 'notice').filter(e => e.kind === 'techStolen'); t.eq(n.length, 1); t.eq(n[0].empire, 1); t.eq(n[0].by, -1);
      S.ev = []; A.spies[1] = 3; setTL(A, 30, 10);
      Sp.turn(S, scripted([60, 1, 1, 70, 100]));               // a stopped spy => identified
      n = evs(S, 'notice').filter(e => e.kind === 'techStolen'); t.eq(n[0].by, 0);
      S.ev = []; A.spies[1] = 2; setTL(A, 30, 10);
      Sp.turn(S, scripted([1, 1, 99, 100, 0, 0], 'fr'));       // frame-up: the notice names a third empire
      n = evs(S, 'notice').filter(e => e.kind === 'techStolen'); t.ok(n[0].by === 2 || n[0].by === 3, 'framed ' + n[0].by);
    });
  });
  t.test('spy: AI-vs-AI frame-ups blame a human with probability 1/2 (-(20+d20) to the human, dtype 5); an AI thief is otherwise never penalised', () => {
    const { S, A } = stealFixture(false, { seed: 'steal-ai-frame' });      // empire 0 = the AI thief, empire 2 = the only human (a candidate scapegoat)
    S.empires[2].human = true;
    const log = [];
    let blamed = 0, runs = 400;
    withDiplo(mockDiplo(log), () => {
      for (let i = 0; i < runs; i++) { A.spies[1] = 2; A.research.completed = A.research.completed.map(l => l.slice(0, 1)); setTL(A, 30, 10); Sp.turn(S, scripted([1, 1, 99, 100, 0], 'af' + i)); }
    });
    blamed = log.filter(l => l.kind === 'spyFrameTheft').length;
    t.between(blamed / runs, 0.42, 0.58);
    for (const l of log) { t.eq(l.from, 2); t.eq(l.to, 1); t.between(l.dv, -40, -21); }
    t.ok(!log.some(l => l.kind === 'spyTheft'), 'AI spies are not charged');
  });

  // ---- sabotage (§5.5) --------------------------------------------------------------------------------------------------------------------------------
  function sabFixture(human, victimHuman) {
    const f = pair({ seed: 'sab' }, 1, 2);
    setTL(f.A, 30, 31); setTL(f.T, 10, 10);                    // dt1 = 20 ; weapons 31 -> chances = (31 + 9) * 1 / 10 = 4
    f.A.human = human; f.T.human = victimHuman;
    const ps = f.S.planets.filter(p => p.owner === 1); f.p = ps[0]; f.p.factories = 40; f.p.bases = 12; f.p.pop = 60; f.p.unrest = 0; f.p.rebels = 0; f.S.ev = [];
    return f;
  }
  t.test('sabotage: strength = sum of d5 over (weapons TL + 9) x spies / 10 rolls', () => {
    const { S } = sabFixture(true, false);
    withDiplo(mockDiplo([]), () => {
      const it = Sp.turn(S, scripted([1, 80, 5, 5, 5, 5]))[0];
      t.eq(it.type, 'spySabotageChoice'); t.eq(it.chances, 4); t.eq(it.units, 20); t.eq(it.n, 1);
      t.ok(it.planets.length >= 1 && it.planets.every(p => typeof p.factories === 'number' && typeof p.canIncite === 'boolean'));
    });
    const g = sabFixture(true, false); setTL(g.A, 30, 95); g.A.spies[1] = 3;
    withDiplo(mockDiplo([]), () => { const it = Sp.turn(g.S, scripted([1, 1, 1, 80, 5, 5, 5]))[0]; t.eq(it.chances, Math.floor((95 + 9) * 3 / 10)); });
  });
  t.test('sabotage: a human destroys min(units, factories) factories', () => {
    const { S, p } = sabFixture(true, false);
    withDiplo(mockDiplo([]), () => {
      const it = Sp.turn(S, scripted([1, 80, 5, 5, 5, 5]))[0];
      const r = it.answer({ planet: p.id, action: 'factories' });
      t.eq(r.destroyed, 20); t.eq(p.factories, 20);
    });
    const g = sabFixture(true, false); g.p.factories = 7;
    withDiplo(mockDiplo([]), () => { const r = Sp.turn(g.S, scripted([1, 80, 5, 5, 5, 5]))[0].answer({ planet: g.p.id, action: 'factories' }); t.eq(r.destroyed, 7); t.eq(g.p.factories, 0); });
  });
  t.test('sabotage: a human destroys missile bases with 25% per unit (Monte-Carlo, never more than exist)', () => {
    let hits = 0, runs = 600;
    const { S: S0, A: A0, p: p0 } = sabFixture(true, false);
    withDiplo(mockDiplo([]), () => {
      for (let i = 0; i < runs; i++) {
        p0.bases = 100; A0.spies[1] = 1; setTL(A0, 30, 31);
        const it = Sp.turn(S0, scripted([1, 80, 5, 5, 5, 5], 'b' + i))[0]; hits += it.answer({ planet: p0.id, action: 'bases' }).destroyed;
      }
    });
    t.near(hits / runs, 5, 0.35);
    const { S, p } = sabFixture(true, false); p.bases = 1;
    withDiplo(mockDiplo([]), () => { const r = Sp.turn(S, scripted([1, 80, 5, 5, 5, 5]))[0].answer({ planet: p.id, action: 'bases' }); t.ok(r.destroyed <= 1); });
  });
  t.test('sabotage: incite revolt adds max(1, pop x units / 200) rebels; rebels >= pop/2 = rebellion; only on calm planets', () => {
    const { S, p } = sabFixture(true, false);
    withDiplo(mockDiplo([]), () => {
      const r = Sp.turn(S, scripted([1, 80, 5, 5, 5, 5]))[0].answer({ planet: p.id, action: 'revolt' });
      t.eq(r.rebels, Math.floor(60 * 20 / 200)); t.eq(p.rebels, 6); t.eq(p.unrest, 1); t.ok(!r.rebellion);
    });
    const g = sabFixture(true, false); g.p.pop = 10; g.p.rebels = 0;
    withDiplo(mockDiplo([]), () => {
      const r = Sp.turn(g.S, scripted([1, 80, 5, 5, 5, 5]))[0].answer({ planet: g.p.id, action: 'revolt' });
      t.eq(r.rebels, 1); t.ok(!r.rebellion);
    });
    const h = sabFixture(true, false); h.p.pop = 8; h.p.rebels = 0; h.A.research.tl[5] = 95; h.A.spies[1] = 5;
    withDiplo(mockDiplo([]), () => {
      const it = Sp.turn(h.S, scripted([1, 1, 1, 1, 1, 90].concat(new Array(40).fill(5))))[0];
      const r = it.answer({ planet: h.p.id, action: 'revolt' });
      t.ok(r.rebellion); t.eq(h.p.unrest, 2); t.eq(h.p.rebels, 4);
    });
    const k = sabFixture(true, false); k.p.unrest = 1;
    withDiplo(mockDiplo([]), () => { const r = Sp.turn(k.S, scripted([1, 80, 5, 5, 5, 5]))[0].answer({ planet: k.p.id, action: 'revolt' }); t.ok(r.none); t.eq(k.p.rebels, 0); });
  });
  t.test('sabotage: an AI saboteur hits a random planet — factories -units or bases -units/5 (50/50), 25% revolt against humans', () => {
    const f = sabFixture(false, false);
    withDiplo(mockDiplo([]), () => {
      Sp.turn(f.S, scripted([1, 80, 5, 5, 5, 5, 0, 0]));       // planet #0, action 0 = factories
      const tp = f.S.planets.filter(p => p.owner === 1)[0];
      t.eq(tp.factories, 20);
    });
    const g = sabFixture(false, false);
    withDiplo(mockDiplo([]), () => { Sp.turn(g.S, scripted([1, 80, 5, 5, 5, 5, 0, 1])); t.eq(g.p.bases, 12 - 4); });
    const h = sabFixture(false, true);
    withDiplo(mockDiplo([]), () => {
      Sp.turn(h.S, scripted([1, 80, 5, 5, 5, 5, 0, 10]));      // 10 <= 25: revolt, rebels = pop x (units/2) / 100
      t.eq(h.p.rebels, Math.floor(60 * 10 / 100)); t.eq(h.p.unrest, 1);
      const n = evs(h.S, 'notice').filter(e => e.kind === 'sabotage'); t.eq(n.length, 1); t.eq(n[0].empire, 1);
    });
    const k = sabFixture(false, true);
    withDiplo(mockDiplo([]), () => { Sp.turn(k.S, scripted([1, 80, 5, 5, 5, 5, 0, 90, 1])); t.eq(k.p.bases, 12 - 4); t.eq(k.p.rebels, 0); });   // 90 > 25: no revolt; action 1 = bases
  });
  t.test('sabotage: AI-vs-AI identified saboteurs cost 20+d20 (dtype 6); a human saboteur costs nothing (v1.3 quirk, kept) unless Sp.QUIRKS says otherwise', () => {
    const f = sabFixture(false, false), log = [];
    withDiplo(mockDiplo(log), () => { Sp.turn(f.S, scripted([60, 1, 80, 5, 5, 5, 5, 0, 0])); });   // note: 1 spy only -> make it 2
    t.eq(log.length, 0, 'the single stopped spy ended the mission');
    const g = sabFixture(false, false); g.A.spies[1] = 2; const log2 = [];
    withDiplo(mockDiplo(log2), () => { Sp.turn(g.S, scripted([60, 1, 80, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0])); });
    t.eq(log2.length, 1); t.eq(log2[0].kind, 'sabotage'); t.between(log2[0].dv, -40, -21); t.eq(log2[0].info.dtype, 6);
    const h = sabFixture(true, false); h.A.spies[1] = 2; const log3 = [];
    withDiplo(mockDiplo(log3), () => { Sp.turn(h.S, scripted([60, 1, 80, 5, 5, 5, 5, 5, 5, 5, 5]))[0].answer({ planet: h.p.id, action: 'factories' }); });
    t.eq(log3.length, 0);
    Sp.QUIRKS.humanSabotagePenalty = true;
    try {
      const k = sabFixture(true, false); k.A.spies[1] = 2; const log4 = [];
      withDiplo(mockDiplo(log4), () => { Sp.turn(k.S, scripted([60, 1, 80, 5, 5, 5, 5, 5, 5, 5, 5]))[0].answer({ planet: k.p.id, action: 'factories' }); });
      t.eq(log4.length, 1); t.between(log4[0].dv, -40, -21);
      const m = sabFixture(true, false); m.A.spies[1] = 2; const log5 = [];
      withDiplo(mockDiplo(log5), () => { Sp.turn(m.S, scripted([60, 1, 80, 5, 5, 5, 5, 5, 5, 5, 5]))[0].answer({ planet: m.p.id, action: 'revolt' }); });
      t.eq(log5.length, 0, 'incite revolt is never penalised');
    } finally { Sp.QUIRKS.humanSabotagePenalty = false; }
  });

  // ---- reports, bookkeeping, determinism -----------------------------------------------------------------------------------------------------------
  t.test('spy: the Spies-Caught overlay and the Report screen', () => {
    const { S, A, T } = pair({ seed: 'rep' }, 3, 1); A.flow = { gross: 100 }; A.security = 60;
    withDiplo(mockDiplo([]), () => {
      Sp.turn(S, scripted([80, 80, 80]));                       // all three eliminated
      const rep = Sp.reports(S, A), row = rep.rows.filter(r => r.empire === 1)[0];
      t.eq(row.yours, 3); t.eq(row.yoursTotal, 3); t.eq(row.theirs, 0); t.eq(row.spies, 0);
      t.eq(rep.security, 60); t.eq(rep.securityBonus, 12); t.eq(rep.cost, Sp.baseCost(S, A));
      const back = Sp.reports(S, T).rows.filter(r => r.empire === 0)[0]; t.eq(back.theirs, 3); t.eq(back.theirsTotal, 3);
      A.spies[1] = 2; Sp.turn(S, scripted([1, 1, 1]));
      const row2 = Sp.reports(S, A).rows.filter(r => r.empire === 1)[0];
      t.eq(row2.yours, 0, 'the overlay is per turn'); t.eq(row2.yoursTotal, 3);
      t.ok(row2.report && row2.report.fields.length === 6 && row2.report.year === S.year, 'a live spy keeps the report fresh');
      A.security = 0; A.race = 'darlok'; t.eq(Sp.reports(S, A).securityBonus, 20, 'Darlok show +20');
    });
  });
  t.test('spy: the state stays plain JSON (functions on interrupts are non-enumerable)', () => {
    const { S } = stealFixture(true, { seed: 'json' });
    withDiplo(mockDiplo([]), () => { const out = Sp.turn(S, scripted([1, 1, 70, 100])); t.ok(out.length === 1); JSON.parse(JSON.stringify(S)); out[0].answer(0); JSON.parse(JSON.stringify(S)); });
  });
  t.test('spy: determinism — the same seed gives the same spy war', () => {
    function run() {
      const f = stealFixture(false, { seed: 'det' }); f.A.spies[1] = 6; const R = M.RNG.bind(f.S.rs);
      withDiplo(mockDiplo([]), () => { for (let i = 0; i < 60; i++) { Sp.turn(f.S, R); if (f.A.spies[1] <= 0) f.A.spies[1] = 6; } });
      return JSON.stringify([f.A.spies, f.A.research.completed, f.S.spy.totals, f.S.rs]);
    }
    t.eq(run(), run());
  });
  t.test('spy: a full turn pipeline with spies does not throw (hire -> resolve -> reports) and leaves Econ income consistent', () => {
    const S = mk({ seed: 'pipe' }); const A = S.empires[0], T = S.empires[1];
    withDiplo(mockDiplo([]), () => {
      O.apply(S, 0, { t: 'spyBudget', target: 1, value: 100 }); O.apply(S, 0, { t: 'spyMode', target: 1, mode: 1 });
      M.Sim.Econ.stepProduction(S);
      const net0 = A.flow.net; t.ok(net0 > 0);
      for (let i = 0; i < 30; i++) { M.Sim.Econ.stepProduction(S); Sp.buildTurn(S, M.RNG.bind(S.rs)); const o = Sp.turn(S, M.RNG.bind(S.rs)); for (const it of o) it.answer(undefined); }
      t.ok(A.flow.spying > 0 && A.flow.spying <= Math.floor(A.flow.gross / 10), 'spying is 10% of gross at most');
      void T;
    });
  });
};
