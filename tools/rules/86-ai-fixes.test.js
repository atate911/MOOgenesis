// Regression tests for the AI planner fixes of the October 2026 review (tools/handoff/review-2026-10.md #11–#13):
//   #11 js/ai/military.js  defend/idle ping-pong — stacks in flight count as force, the exact reverse move is refused for Mil.MOVE_MEMORY turns (AI.FIXES.defendStaging)
//   #12 js/ai/designs.js   scrapping live fleets — the age scrap keeps a design flying > 10 % of the hulls, the forced removal takes the cheapest loss (AI.FIXES.designKeepFleet)
//   #13 js/ai/ai.js        step exceptions surface as {t:'aiLog'} → S.aiLog (bounded) and the soak counts them (AI_ERRORS)
//   + js/ai/economy.js     trans_own never sends pop to a colony the sim refuses transports to (hostile environment not yet colonisable)
module.exports = function (M, t) {
  const AI = M.AI, Mil = AI.Military, Sim = M.Sim, F = Sim.Fleet, Dz = Sim.Design, Dp = Sim.Diplo, C = Sim.Colony, Geo = Sim.Geo, O = Sim.Orders;
  const SCOUT = 0, FIGHTER = 1, DESTROYER = 2, BOMBER = 3, COLONY = 4;               // start-design slots
  const TYPES = ['none', 'radiated', 'toxic', 'inferno', 'dead', 'tundra', 'barren', 'minimal', 'desert', 'steppe', 'arid', 'ocean', 'jungle', 'terran'];

  // ---- fixtures (the 82-ai-military shapes: empire 1 plans, empire 2 is the foe) ---------------------------------------------------------------------------
  function world(seed) {
    const S = Sim.Setup.create({ size: 'medium', opponents: 2, seed, playerAI: true, race: 'human', difficulty: 'average' }), me = S.empires[1];
    me.mods.fuel = 6; me.race = 'meklar';
    const P = S.planets[me.capital];
    const near = S.planets.filter(q => q.id !== P.id && !S.empires.some(e => e.capital === q.id) && q.id !== S.orion).sort((a, b) => Geo.unitDist(S, P.starId, a.starId) - Geo.unitDist(S, P.starId, b.starId) || a.id - b.id);
    for (const e of S.empires) if (e.id !== 1) S.planets[e.capital].typeIdx = 1;
    F.updateRange(S);
    return { S, me, P, near };
  }
  function colony(S, q, e, o) {
    o = o || {};
    q.typeIdx = o.typeIdx || 11; q.type = TYPES[q.typeIdx]; q.special = 'normal'; q.maxPop = 80; q.growth = 'normal'; q.mp1 = q.mp2 = q.mp3 = 80;
    C.found(S, S.empires[e], q, 2);
    q.pop = o.pop === undefined ? 10 : o.pop; q.bases = o.bases || 0; q.shield = 0; q.factories = 10; q.sliders = [0, 0, 100, 0, 0];
    return q;
  }
  const ships = (S, owner, star, slot, n) => F.addShips(S, owner, star, slot, n);
  function moving(S, owner, from, to, slot, n) {
    const A = S.stars[from], f = { id: S.nextId++, owner, star: -1, from, to, x: A.x, y: A.y, speed: 3, ships: [0, 0, 0, 0, 0, 0] };
    f.ships[slot] = n; S.fleets.push(f); return f;
  }
  const fakeR = dflt => ({ int: (a) => (dflt !== undefined ? dflt : a), chance: () => false });
  const step = name => AI.steps.find(s => s.name === name);
  function run(w, o) {
    o = o || {}; const S = w.S;
    for (const E of S.empires) Dz.refresh(S, E);
    const ctx = AI.ctx(S, 1, o.seed === undefined ? 7 : o.seed);
    step('intel').fn(ctx);
    ctx.shared.fronts = o.fronts || [{ anchor: w.P.id, star: w.P.starId, value: 0, enemy: 2 }];
    ctx.R = fakeR(1);
    step('military').fn(ctx);
    ctx.finish();
    return ctx;
  }
  // two colonies A, B of mine next to my capital P; `first` is the one the original defend rule picks (lowest planet index)
  function defScene(seed, o) {
    o = o || {};
    const w = world(seed);
    const A = colony(w.S, w.near[0], 1, { bases: o.basesA || 0 }), B = colony(w.S, w.near[1], 1, { bases: o.basesB || 0 });
    w.me.mods.fuel = 30; F.updateRange(w.S);
    const first = Math.min(A.id, B.id), second = Math.max(A.id, B.id);
    return Object.assign(w, { A, B, first, second, F1: w.S.planets[first], F2: w.S.planets[second] });
  }
  const withFix = (name, v, fn) => { const old = AI.FIXES[name]; AI.FIXES[name] = v; try { fn(); } finally { AI.FIXES[name] = old; } };
  const patchOf = ctx => { const o = ctx.orders.filter(x => x.t === 'aiState').pop(); return o ? o.patch : null; };

  t.test('fixes table: AI.FIXES.defendStaging / designKeepFleet default to true, ctx.fix() follows the table and options.aiClassic turns every fix off', () => {
    t.eq(AI.FIXES.defendStaging, true); t.eq(AI.FIXES.designKeepFleet, true);
    const mk = classic => Sim.Setup.create({ size: 'small', opponents: 2, race: 'human', seed: 'fx-classic', playerAI: true, options: classic ? { aiClassic: true } : {} });
    const c1 = AI.ctx(mk(true), 1, 0), c0 = AI.ctx(mk(false), 1, 0);
    for (const k in AI.FIXES) { t.eq(c1.fix(k), false, 'classic ' + k); t.eq(c0.fix(k), AI.FIXES[k] !== false, 'default ' + k); }
    withFix('defendStaging', false, () => t.eq(AI.ctx(mk(false), 1, 0).fix('defendStaging'), false));
  });

  // ---- #11 defend / idle ping-pong -------------------------------------------------------------------------------------------------------------------------------
  t.test('defend: a stack of mine already in flight toward an unguarded colony is its garrison — the next stack goes to the other colony (original: both colonies are "unguarded")', () => {
    const mk = () => { const w = defScene('fx-inb'); moving(w.S, 1, w.P.starId, w.F1.starId, FIGHTER, 10); ships(w.S, 1, w.P.starId, FIGHTER, 100); return w; };
    let w = mk();
    let d = run(w).shared.mil.defends;
    t.eq(d.length, 1); t.eq(d[0].to, w.F2.starId, 'the colony without an inbound stack');
    withFix('defendStaging', false, () => { w = mk(); d = run(w).shared.mil.defends; t.eq(d.length, 1); t.eq(d[0].to, w.F1.starId, 'original: the first list planet'); });
  });
  t.test('defend: Mil.inboundForce sums my moving stacks × design threat per destination; a stack this plan dispatched counts too', () => {
    const w = defScene('fx-inb2'); moving(w.S, 1, w.P.starId, w.A.starId, DESTROYER, 3); moving(w.S, 1, w.P.starId, w.A.starId, FIGHTER, 2); moving(w.S, 2, w.P.starId, w.B.starId, DESTROYER, 9);
    for (const E of w.S.empires) Dz.refresh(w.S, E);
    const ctx = AI.ctx(w.S, 1, 1); step('intel').fn(ctx); const plan = Mil.newPlan(ctx), th = Mil.threatOf(plan, 1);
    const inb = Mil.inboundForce(plan);
    t.eq(inb[w.A.starId], 3 * th[DESTROYER] + 2 * th[FIGHTER]); t.eq(inb[w.B.starId], undefined, 'other empires\' stacks are not mine');
    ships(w.S, 1, w.P.starId, FIGHTER, 5); const ctx2 = AI.ctx(w.S, 1, 1); step('intel').fn(ctx2); const plan2 = Mil.newPlan(ctx2);
    AI.Intel.send(ctx2, w.P.starId, w.B.starId);
    t.eq(Mil.inboundForce(plan2)[w.B.starId], 5 * th[FIGHTER], 'dispatched this plan');
  });
  t.test('defend: the exact reverse of a move made < MOVE_MEMORY turns ago is refused (the stack takes the next list planet); an older one is allowed again', () => {
    t.eq(Mil.MOVE_MEMORY, 8);
    const mk = age => { const w = defScene('fx-rev'); ships(w.S, 1, w.P.starId, FIGHTER, 100); w.me.ai = { milMoves: { [w.F1.starId + '>' + w.P.starId]: w.S.turn - age } }; return w; };
    let w = mk(1), d = run(w).shared.mil.defends;
    t.eq(d.length, 1); t.eq(d[0].to, w.F2.starId, 'F1 → P happened last turn: P → F1 is refused');
    w = mk(7); t.eq(run(w).shared.mil.defends[0].to, w.F2.starId, '7 turns ago: still refused');
    w = mk(8); t.eq(run(w).shared.mil.defends[0].to, w.F1.starId, '8 turns ago: allowed');
    withFix('defendStaging', false, () => { w = mk(1); t.eq(run(w).shared.mil.defends[0].to, w.F1.starId, 'original: no memory'); });
  });
  t.test('defend: the move is remembered through the aiState patch (E.ai.milMoves {"from>to": turn}); entries outside the window are pruned; nothing is patched when nothing changed', () => {
    const w = defScene('fx-mem'); ships(w.S, 1, w.P.starId, FIGHTER, 100);
    w.me.ai = { milMoves: { '7>9': w.S.turn - 20, '3>4': w.S.turn - 2 } };
    const ctx = run(w), p = patchOf(ctx);
    t.ok(p && p.milMoves, 'patched'); t.eq(p.milMoves[w.P.starId + '>' + w.F1.starId], w.S.turn); t.eq(p.milMoves['3>4'], w.S.turn - 2); t.eq(p.milMoves['7>9'], undefined, 'pruned');
    const w2 = defScene('fx-mem2', { basesA: 5, basesB: 5 }); w2.P.bases = 5; w2.me.ai = { milMoves: { '3>4': w2.S.turn - 2 } };
    t.eq(patchOf(run(w2)), null, 'no move, nothing stale: no patch');
    t.eq(JSON.stringify(w.me.ai.milMoves), JSON.stringify({ '7>9': w.S.turn - 20, '3>4': w.S.turn - 2 }), 'the planner never writes E.ai itself');
  });
  t.test('idle: a staged stack does not go straight back to the front it just left; the next-best front is taken instead', () => {
    const mk = age => {
      const w = defScene('fx-idle', { basesA: 5, basesB: 5 }); w.P.bases = 5;                                  // nothing is unguarded: defend sends nothing
      ships(w.S, 1, w.A.starId, FIGHTER, 100);
      if (age !== undefined) w.me.ai = { milMoves: { [w.P.starId + '>' + w.A.starId]: w.S.turn - age } };
      return w;
    };
    const fronts = w => [{ anchor: w.P.id, star: w.P.starId, value: 0, enemy: 2 }, { anchor: w.B.id, star: w.B.starId, value: 100, enemy: 2 }];
    let w = mk(); let ctx = run(w, { fronts: fronts(w) });
    t.eq(ctx.shared.mil.idles.length, 1); t.eq(ctx.shared.mil.idles[0].to, w.P.starId, 'no memory: the cheapest front');
    w = mk(2); ctx = run(w, { fronts: fronts(w) });
    t.eq(ctx.shared.mil.idles.length, 1); t.eq(ctx.shared.mil.idles[0].to, w.B.starId, 'P → A two turns ago: A → P refused, B taken');
    t.eq(patchOf(ctx).milMoves[w.A.starId + '>' + w.B.starId], w.S.turn, 'idle moves are remembered too');
    w = mk(9); ctx = run(w, { fronts: fronts(w) }); t.eq(ctx.shared.mil.idles[0].to, w.P.starId, 'old enough: allowed');
  });
  t.test('ping-pong measured: over 60 turns of a medium game no empire sends a defend/idle stack straight back within MOVE_MEMORY turns', () => {
    const S = Sim.Setup.create({ size: 'medium', opponents: 4, seed: 'fx-pp', playerAI: true, race: 'human', difficulty: 'hard' });
    const hist = {}; let reversals = 0, moves = 0;
    const st = step('military'), fn = st.fn;
    st.fn = function (ctx) {
      fn(ctx); const mil = ctx.shared.mil; if (!mil) return;
      const h = hist[ctx.id] || (hist[ctx.id] = []);
      for (const k of ['defends', 'idles']) for (const d of mil[k]) { moves++; h.push({ turn: ctx.S.turn, from: d.from, to: d.to }); }
    };
    try { for (let i = 0; i < 60; i++) Sim.autoTurn(S); } finally { st.fn = fn; }
    for (const e in hist) { const h = hist[e]; for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length && h[j].turn - h[i].turn < Mil.MOVE_MEMORY; j++) if (h[j].from === h[i].to && h[j].to === h[i].from && h[j].turn > h[i].turn) reversals++; }
    t.ok(moves > 0, 'some staging moves happened (' + moves + ')'); t.eq(reversals, 0, 'reversals among ' + moves + ' moves');
  });

  // ---- #12 scrapping live fleets ------------------------------------------------------------------------------------------------------------------------------------
  const fresh = seed => Sim.newGame({ size: 'medium', difficulty: 'average', opponents: 3, race: 'human', seed: 'fx86-' + seed, playerAI: true });
  const counts = (S, e) => { const n = [0, 0, 0, 0, 0, 0]; for (const f of S.fleets) if (f.owner === e) for (let i = 0; i < 6; i++) n[i] += f.ships[i]; return n; };
  const scraps = (S, e) => AI.plan(S, e, 1).filter(o => o.t === 'scrapDesign').map(o => o.slot);
  t.test('forced removal (> 4 designs with ships) takes the design with the lowest ships × cost, not the oldest (original takes the oldest: AI.FIXES.designKeepFleet off)', () => {
    const S = fresh('cheap'), E = S.empires[1], star = S.planets[E.capital].starId;
    S.year = 10; E.ai.p2 = 1; E.ai.dyear = [0, 5, 5, 5, 5, 0];
    for (const f of S.fleets) if (f.owner === 1) f.ships = [0, 0, 0, 0, 0, 0];
    ships(S, 1, star, SCOUT, 50); ships(S, 1, star, FIGHTER, 30); ships(S, 1, star, DESTROYER, 4); ships(S, 1, star, BOMBER, 1); ships(S, 1, star, COLONY, 1);
    const n = counts(S, 1), cost = i => Dz.stats(S, E, i).cost;
    t.eq(n.filter(x => x > 0).length, 5, 'five designs hold ships');
    let best = -1, bv = Infinity; for (let i = 0; i < 5; i++) { const v = n[i] * cost(i); if (v < bv) { bv = v; best = i; } }
    t.eq(best, BOMBER, 'the fixture\'s cheapest loss is the single bomber (' + n.map((x, i) => x * cost(i)).join('/') + ')');
    t.deep(scraps(S, 1), [BOMBER]);
    withFix('designKeepFleet', false, () => t.deep(scraps(S, 1), [SCOUT], 'original: the oldest design, 50 ships gone'));
  });
  t.test('age scrap keeps a design flying more than 10 % of the empire\'s hulls; one flying 10 % or less goes; with five loaded designs the forced removal still frees a slot', () => {
    const S = fresh('age10'), E = S.empires[1], star = S.planets[E.capital].starId;
    S.year = 60; E.ai.p2 = 1; E.ai.dyear = [0, 0, 0, 0, 0, 0];                                          // every design is 60 turns old: all aged
    for (const f of S.fleets) if (f.owner === 1) f.ships = [0, 0, 0, 0, 0, 0];
    ships(S, 1, star, SCOUT, 30); ships(S, 1, star, FIGHTER, 30); ships(S, 1, star, DESTROYER, 30); ships(S, 1, star, BOMBER, 9); ships(S, 1, star, COLONY, 1);   // 100 hulls
    let sc = scraps(S, 1);
    t.ok(sc.includes(COLONY) && sc.includes(BOMBER), 'the 1 % and 9 % designs are aged out: ' + sc.join());
    t.ok(!sc.includes(SCOUT) && !sc.includes(FIGHTER) && !sc.includes(DESTROYER), 'the 30 % designs stay: ' + sc.join());
    const S2 = fresh('age10b'), E2 = S2.empires[1], star2 = S2.planets[E2.capital].starId;
    S2.year = 60; E2.ai.p2 = 1; E2.ai.dyear = [0, 0, 0, 0, 0, 0];
    for (const f of S2.fleets) if (f.owner === 1) f.ships = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) ships(S2, 1, star2, i, 20);                                            // five designs at 20 % each: no age scrap, one forced removal
    sc = scraps(S2, 1); t.eq(sc.length, 1, 'exactly one slot freed: ' + sc.join());
    const n = counts(S2, 1), v = i => n[i] * Dz.stats(S2, E2, i).cost; let best = 0; for (let i = 1; i < 5; i++) if (v(i) < v(best)) best = i;
    t.eq(sc[0], best, 'the cheapest loss');
    withFix('designKeepFleet', false, () => { const o = scraps(S, 1); t.ok(o.length >= 3, 'original: aged designs go whatever they fly (' + o.join() + ')'); });
  });
  t.test('scrapped ships measured: 120 turns of a medium game lose far fewer live hulls to the AI\'s own scrapDesign than the original rule', () => {
    const play = fixOn => {
      let lost = 0, built = 0;
      const S = Sim.Setup.create({ size: 'medium', opponents: 3, seed: 'fx-scrap', playerAI: true, race: 'human', difficulty: 'hard' });
      const aa = O.applyAll;
      O.applyAll = function (St, eid, orders) { const res = aa(St, eid, orders); res.forEach((r, i) => { if (orders[i].t === 'scrapDesign' && r.ok && r.ships > 0) lost += r.ships; }); return res; };
      try { withFix('designKeepFleet', fixOn, () => { for (let i = 0; i < 120; i++) Sim.autoTurn(S); }); } finally { O.applyAll = aa; }
      for (const f of S.fleets) built += f.ships.reduce((a, b) => a + b, 0);
      return { lost, alive: built };
    };
    const a = play(true), b = play(false);
    t.ok(a.lost < b.lost / 2 || a.lost === 0, 'fixed ' + JSON.stringify(a) + ' vs original ' + JSON.stringify(b));
  });

  // ---- #13 aiLog -------------------------------------------------------------------------------------------------------------------------------------------------------
  const quiet = fn => { const w = console.warn; let n = 0; console.warn = () => { n++; }; try { fn(); } finally { console.warn = w; } return n; };
  const withStep = (fn, body) => { AI.step('boom86', 99, fn); try { body(); } finally { AI.steps = AI.steps.filter(s => s.name !== 'boom86'); } };
  t.test('a step that throws ends the plan with ONE {t:"aiLog", errors:[{step,msg}]} order (the other steps still ran); a clean plan has none', () => {
    const S = fresh('log'); t.eq(AI.plan(S, 1, 1).some(o => o.t === 'aiLog'), false);
    withStep(() => { throw new Error('kaboom'); }, () => {
      const orders = AI.plan(S, 1, 1), logs = orders.filter(o => o.t === 'aiLog');
      t.eq(logs.length, 1); t.eq(orders[orders.length - 1].t, 'aiLog', 'the last order');
      t.eq(logs[0].errors.length, 1); t.eq(logs[0].errors[0].step, 'boom86'); t.ok(/kaboom/.test(logs[0].errors[0].msg));
      t.ok(orders.some(o => o.t === 'sliders' || o.t === 'aiState' || o.t === 'researchSet'), 'the plan still carries the other steps\' orders');
    });
  });
  t.test('the aiLog handler keeps S.aiLog = {n, last[≤ 50]} (plain JSON, survives a save round trip), warns on the console for the first 20 only', () => {
    const S = fresh('log2');
    const warned = quiet(() => {
      for (let k = 0; k < 60; k++) { const r = O.apply(S, 1, { t: 'aiLog', errors: [{ step: 'x', msg: 'err ' + k }] }); t.ok(r.ok, 'accepted'); }
      t.eq(S.aiLog.n, 60); t.eq(S.aiLog.last.length, AI.LOG_MAX); t.eq(S.aiLog.last[0].msg, 'err 10'); t.eq(S.aiLog.last[49].msg, 'err 59');
      t.eq(S.aiLog.last[0].empire, 1); t.eq(S.aiLog.last[0].turn, S.turn); t.eq(S.aiLog.last[0].step, 'x');
    });
    t.eq(warned, AI.LOG_WARN);
    t.deep(JSON.parse(JSON.stringify(S.aiLog)), S.aiLog);
    t.ok(O.apply(S, 1, { t: 'aiLog' }).ok, 'no errors field: accepted, nothing logged'); t.eq(S.aiLog.n, 60);
  });
  t.test('a throwing planner is visible end to end: the orders are applied by the turn pipeline and the soak counts S.aiLog as AI_ERRORS', () => {
    const S = fresh('log3');
    withStep(() => { throw new Error('every turn'); }, () => { quiet(() => { for (let i = 0; i < 3; i++) Sim.autoTurn(S); }); });
    const ais = S.empires.filter(e => e.alive && !e.human).length;
    t.eq(S.aiLog.n, 3 * ais, 'one entry per AI empire per turn');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'soak-worker.js'), 'utf8');
    t.ok(/AI_ERRORS/.test(src) && /S\.aiLog/.test(src), 'tools/soak-worker.js reports S.aiLog as AI_ERRORS');
  });

  // ---- trans_own vs the sim's transport gate -------------------------------------------------------------------------------------------------------------------------------
  t.test('trans_own: no pop transport to a colony of mine the sim refuses (environment not yet colonisable) — the order would be rejected', () => {
    const w = world('fx-trans'), S = w.S, E = w.me;
    const d = colony(S, w.near[0], 1, { typeIdx: 1, pop: 5 }), s = colony(S, w.near[1], 1, { pop: 70 });   // d: radiated, nearly empty; s: full, the only source
    E.mods.colonyFor = 7; w.P.pop = 5;                                                                         // the capital is empty too (a valid destination)
    for (const E2 of S.empires) Dz.refresh(S, E2);
    t.eq(F.canTransportTo(S, E, s, d.starId).ok, false);
    const ctx = AI.ctx(S, 1, 3); step('intel').fn(ctx); step('economy').fn(ctx);
    const tr = ctx.orders.filter(o => o.t === 'trans');
    t.ok(tr.every(o => o.to !== d.starId), 'no transport to the radiated colony: ' + JSON.stringify(tr));
    for (const o of tr) t.ok(O.apply(JSON.parse(JSON.stringify(S)), 1, o).ok, 'accepted: ' + JSON.stringify(o));
  });

  // ---- purity / determinism with the fixes on ---------------------------------------------------------------------------------------------------------------------------
  t.test('with the fixes on AI.plan is still pure and deterministic over 30 turns (state hash unchanged, same orders twice, snapshot plan = live plan)', () => {
    const S = Sim.Setup.create({ size: 'small', opponents: 3, seed: 'fx-pure', playerAI: true, race: 'human', difficulty: 'average' });
    for (let i = 0; i < 30; i++) {
      if (i % 6 === 0) for (const e of S.empires) {
        if (!e.alive) continue;
        const h = JSON.stringify(S), seed = AI.seedFor(S, e.id), o1 = AI.plan(S, e.id, seed);
        t.eq(JSON.stringify(S), h, 'mutation at turn ' + S.turn);
        t.eq(JSON.stringify(AI.plan(S, e.id, seed)), JSON.stringify(o1), 'nondeterministic at turn ' + S.turn);
        t.eq(JSON.stringify(AI.plan(JSON.parse(h), e.id, seed)), JSON.stringify(o1), 'snapshot plan differs at turn ' + S.turn);
      }
      Sim.autoTurn(S);
    }
    t.eq(S.aiLog === undefined || S.aiLog.n === 0, true, 'no step threw');
  });
};
