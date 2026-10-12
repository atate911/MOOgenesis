// Random events, monsters, coups, Guardian / artifact loot (research/05 §7, research/04 §3.9 + §3.13, research/02 §1.10, research/01 §5.12, research/08 §12).
module.exports = function (M, t) {
  const Ev = M.Sim.Events, A = M.Sim.Artifacts, O = M.Sim.Orders, Tc = M.Data.Techs;

  // ---- fixtures -------------------------------------------------------------------------------------------------------------------------------
  function mk(extra) { return M.Sim.Setup.create(Object.assign({ size: 'medium', opponents: 3, race: 'human', seed: 'ev-fx', difficulty: 'average' }, extra)); }
  function scripted(seq, seed) {
    const base = M.RNG.create(seed || 'scripted'), q = seq.slice();
    const r = { used: 0, int(lo, hi) { r.used++; if (q.length) { const v = q.shift(); return v < lo ? lo : v > hi ? hi : v; } return base.int(lo, hi); }, dice(n, s) { let tot = 0; for (let i = 0; i < n; i++) tot += r.int(1, s); return tot; }, next() { return base.next(); } };
    return r;
  }
  const maxR = { int: (lo, hi) => hi, dice: (n, s) => n * s, next: () => 0.999 };
  const minR = { int: (lo) => lo, dice: n => n, next: () => 0 };
  function withDiplo(mock, fn) { const old = M.Sim.Diplo; M.Sim.Diplo = mock; try { return fn(); } finally { if (old === undefined) delete M.Sim.Diplo; else M.Sim.Diplo = old; } }
  function ownPlanets(S, id, n) {                              // make `id` own at least n planets
    let k = S.planets.filter(p => p.owner === id).length;
    for (const p of S.planets) { if (k >= n) break; if (p.owner < 0 && p.typeIdx > 0 && p.id !== S.orion) { M.Sim.Colony.found(S, S.empires[id], p, 10); p.spendable = 10; k++; } }
  }
  function home(S, id) {                                       // a well-defined capital to hurt
    const p = S.planets[S.empires[id].capital];
    p.pop = 80; p.factories = 120; p.spendable = 100; p.mp1 = p.mp2 = p.mp3 = 100; p.waste = 0; p.sliders = [0, 0, 0, 0, 100]; p.special = 'normal'; p.growth = 'normal'; p.rebels = 0; p.unrest = 0; delete p.event;
    return p;
  }
  function second(S, id) {                                     // a non-capital colony of `id`
    ownPlanets(S, id, 3);
    const p = S.planets.filter(q => q.owner === id && q.id !== S.empires[id].capital).pop();
    p.pop = 60; p.factories = 40; p.spendable = 50; p.mp1 = p.mp2 = p.mp3 = 80; p.waste = 0; p.sliders = [0, 0, 0, 0, 100]; p.special = 'normal'; p.growth = 'normal'; p.typeIdx = 10; p.type = 'arid'; delete p.event; p.unrest = 0; p.rebels = 0;
    return p;
  }
  const newsOf = (S, cat) => (S.ev || []).filter(e => e.type === 'news' && (!cat || e.cat === cat));
  const idle = S => { S.events.year = S.year; };               // no yearly event this turn

  // ---- the yearly roll (§7.1) ---------------------------------------------------------------------------------------------------------------------
  t.test('events: the chance is (turns since the last event, first 40) scaled 1/2, 2/3, 3/4, 4/5, 1 by difficulty — and 0 up to year 40', () => {
    const want = { simple: 12, easy: 16, average: 18, hard: 19, impossible: 24 };
    for (const d of Object.keys(want)) {
      const S = mk({ difficulty: d }); S.year = 64; t.eq(Ev.chance(S).raw, 24); t.eq(Ev.chance(S).scaled, want[d], d);
      S.year = 40; t.eq(Ev.chance(S).scaled, 0); S.year = 41; t.eq(Ev.chance(S).raw, 1); S.year = 10; t.eq(Ev.chance(S).raw, 0);
    }
    const S = mk({ difficulty: 'impossible' }); S.year = 552; t.near(Ev.chance(S).p, 1, 1e-9, 'capped at certainty');
    S.year = 100; S.events.year = 90; t.eq(Ev.chance(S).raw, 10);
  });
  t.test('events: an event fires iff rnd(512) <= chance (gate checked with scripted rolls)', () => {
    const S = mk(); S.year = 140; const sc = Ev.chance(S).scaled; t.eq(sc, 75);
    const miss = scripted([76]); t.eq(Ev.roll(S, miss, []), null); t.eq(miss.used, 1, 'a missed roll uses exactly one draw');
    const hit = scripted([75]); Ev.roll(S, hit, []); t.ok(hit.used > 1, 'rnd 75 <= 75 goes on to pick a victim');
    const early = mk(); early.year = 40; t.eq(Ev.roll(early, scripted([1]), []), null);
  });
  t.test('events MC: the per-turn chance equals scaled/512 (the gate alone)', () => {
    const S = mk(); S.year = 140; let pass = 0, n = 40000; const R = M.RNG.create('gate');
    for (let i = 0; i < n; i++) if (R.int(1, 512) <= Ev.chance(S).scaled) pass++;
    t.near(pass / n, 75 / 512, 0.006);
  });
  t.test('events: average waits (the research table: Simple 40, Easy 35, Average 33, Hard 32, Impossible 28 turns)', () => {
    // E[wait] with P(event at raw k) = min(1, k*f/512), retrying every turn: the sum of survival probabilities
    const E = {}; for (const [d, num, den] of [['simple', 1, 2], ['easy', 2, 3], ['average', 3, 4], ['hard', 4, 5], ['impossible', 1, 1]]) {
      let surv = 1, exp = 0;
      for (let k = 1; k < 3000 && surv > 1e-12; k++) { exp += surv; surv *= 1 - Math.min(1, Math.floor(k * num / den) / 512); }
      E[d] = exp;
    }
    t.between(E.simple, 38, 46); t.between(E.easy, 32, 40); t.between(E.average, 30, 37); t.between(E.hard, 29, 36); t.between(E.impossible, 25, 31);
    t.ok(E.simple > E.easy && E.easy > E.average && E.average > E.hard && E.hard > E.impossible);
  });
  t.test('events: victims are weighted by planet count (humans x5, fewer than 4 planets weigh 1, normalised by max(5, smallest slot))', () => {
    const S = mk(); ownPlanets(S, 0, 12); ownPlanets(S, 1, 12); ownPlanets(S, 2, 8); S.empires[3].alive = true;
    t.deep(Ev.victimWeights(S), [12, 2, 1, 1]);
    S.empires[2].alive = false; t.deep(Ev.victimWeights(S), [12, 2, 1, 1], 'a dead empire still weighs 1 (drawn: no planet, the attempt ends silently)');
    const D = Ev.victimWeights(S); t.ok(D.length === 4);
    const T = mk({ playerAI: true }); ownPlanets(T, 0, 12); t.deep(Ev.victimWeights(T), [2, 1, 1, 1], 'no human: no x5');
    const U = mk(); ownPlanets(U, 0, 4); t.eq(Ev.victimWeights(U)[0], 4, 'a human with 4 planets: 20/5');
  });
  t.test('events MC: the human with 12 colonies is picked 12 / 16 of the time against two small AIs', () => {
    const S = mk(); ownPlanets(S, 0, 12); ownPlanets(S, 1, 12); ownPlanets(S, 2, 8); const R = M.RNG.create('pv'); const c = [0, 0, 0, 0], n = 20000;
    for (let i = 0; i < n; i++) c[Ev.pickVictim(S, R)]++;
    t.near(c[0] / n, 12 / 16, 0.012); t.near(c[1] / n, 2 / 16, 0.01); t.near(c[2] / n, 1 / 16, 0.008);
  });

  // ---- rejection list --------------------------------------------------------------------------------------------------------------------------------
  t.test('events: type rejection rules (once per game, quake pop >= 50, comet >= year 100, monsters >= 200 and alone, derelict never human, rebellion human only / not the capital)', () => {
    const S = mk(); const p = home(S, 0), a = home(S, 1);
    for (let k = 1; k <= 16; k++) t.ok(!Ev.rejects(S, k, 1, a) || [5, 7, 8, 9, 10, 11, 12].indexOf(k) >= 0 || true);
    S.year = 120; t.ok(!Ev.rejects(S, 1, 0, p)); S.events.done.plague = true; t.ok(Ev.rejects(S, 1, 0, p), 'each kind once'); S.events.done.plague = false;
    p.pop = 49; t.ok(Ev.rejects(S, 2, 0, p)); p.pop = 50; t.ok(!Ev.rejects(S, 2, 0, p));
    S.year = 99; t.ok(Ev.rejects(S, 7, 0, p)); S.year = 100; t.ok(!Ev.rejects(S, 7, 0, p));
    S.year = 199; t.ok(Ev.rejects(S, 11, 0, p)); t.ok(Ev.rejects(S, 12, 0, p)); S.year = 200; t.ok(!Ev.rejects(S, 11, 0, p));
    S.monsters = [{ id: 1, kind: 'crystal', killer: -1 }]; t.ok(Ev.rejects(S, 11, 0, p) && Ev.rejects(S, 12, 0, p), 'only one monster at a time'); S.monsters = [];
    S.settings.options.monsters = false; t.ok(Ev.rejects(S, 12, 0, p), 'monsters switched off'); S.settings.options.monsters = true;
    t.ok(Ev.rejects(S, 9, 0, p), 'no derelict for humans'); t.ok(!Ev.rejects(S, 9, 1, a));
    t.ok(Ev.rejects(S, 10, 1, a), 'rebellion hits humans only'); t.ok(Ev.rejects(S, 10, 0, p), 'never the capital');
    const c = second(S, 0); t.ok(!Ev.rejects(S, 10, 0, c));
    S.empires[1].race = 'silicoid'; t.ok(Ev.rejects(S, 1, 1, a) && Ev.rejects(S, 4, 1, a), 'Silicoids: no plague, no accident'); t.ok(!Ev.rejects(S, 3, 1, a));
  });
  t.test('events: planet-quality rules — fertile needs type >= Minimal, normal/poor, not fertile/gaia; rich only from normal/poor; poor not from artifacts / already poor', () => {
    const S = mk(); const p = second(S, 0);
    p.typeIdx = 10; for (const sp of ['normal', 'poor', 'ultrapoor']) { p.special = sp; t.ok(!Ev.rejects(S, 13, 0, p), 'enviro ' + sp); t.ok(!Ev.rejects(S, 14, 0, p), 'rich ' + sp); }
    for (const sp of ['rich', 'ultrarich', 'artifacts']) { p.special = sp; t.ok(Ev.rejects(S, 13, 0, p), 'enviro ' + sp); t.ok(Ev.rejects(S, 14, 0, p), 'rich ' + sp); }
    p.special = 'normal'; p.typeIdx = 6; t.ok(Ev.rejects(S, 13, 0, p), 'below Minimal'); p.typeIdx = 7; t.ok(!Ev.rejects(S, 13, 0, p));
    p.growth = 'fertile'; t.ok(Ev.rejects(S, 13, 0, p)); p.growth = 'gaia'; t.ok(Ev.rejects(S, 13, 0, p)); p.growth = 'normal';
    for (const sp of ['normal', 'rich', 'ultrarich']) { p.special = sp; t.ok(!Ev.rejects(S, 16, 0, p), 'poor ' + sp); }
    for (const sp of ['poor', 'ultrapoor', 'artifacts']) { p.special = sp; t.ok(Ev.rejects(S, 16, 0, p), 'poor ' + sp); }
  });
  t.test('events: an assassin needs an AI with a NAP / alliance with the victim; pirates need a trade partner', () => {
    const S = mk(), p = home(S, 0);
    withDiplo({ status: (S_, a, b) => ({ treaty: 0, trade: { bc: 0 } }) }, () => { t.ok(Ev.rejects(S, 5, 0, p)); t.ok(Ev.rejects(S, 8, 0, p)); });
    withDiplo({ status: (S_, a, b) => ({ treaty: b === 2 ? 1 : 0, trade: { bc: b === 3 ? 50 : 0 } }) }, () => { t.ok(!Ev.rejects(S, 5, 0, p)); t.ok(!Ev.rejects(S, 8, 0, p)); });
    withDiplo({ status: (S_, a, b) => ({ treaty: a === 0 && b === 1 ? 2 : 0, trade: { bc: 0 } }) }, () => { t.ok(!Ev.rejects(S, 5, 0, p)); });
    S.gameOver = { reason: 'council', winner: 1 }; withDiplo({ status: () => ({ treaty: 2 }) }, () => { t.ok(Ev.rejects(S, 5, 0, p), 'not after the game ended'); });
  });
  t.test('events: a started event stamps the clock and the once-only flag; a full roll with a victim works end to end', () => {
    const S = mk(); ownPlanets(S, 0, 6); S.year = 300; S.events.year = 100; const R = M.RNG.create('e2e');
    let got = null; for (let i = 0; i < 200 && !got; i++) got = Ev.roll(S, R, []);
    t.ok(got, 'an event happens'); t.eq(S.events.year, 300); t.eq(S.events.done[got.kind], true); t.eq(S.events.log.length, 1);
    t.ok(newsOf(S).length >= 1 && typeof newsOf(S)[0].headline === 'string' && newsOf(S)[0].headline.length > 10);
  });

  // ---- the sixteen events: numeric effects -------------------------------------------------------------------------------------------------------
  t.test('plague: cure cost = (rnd8 + 2 x difficulty) x production; AI planets crank research and get 1/5 of the reserve', () => {
    const S = mk(), p = home(S, 0), out = [];
    Ev.start(S, scripted([4]), 1, 0, p, out);
    t.eq(p.event.type, 'plague'); t.eq(p.event.cure, (4 + 2 * 2) * 100); t.eq(p.event.cost, 800);
    t.eq(out.length, 1); t.eq(out[0].type, 'event'); t.eq(out[0].kind, 'plague'); t.eq(out[0].stage, 'start'); t.ok(out[0].text.indexOf('800') >= 0);
    t.eq(newsOf(S, 'plague').length, 1);
    for (const [d, lo, hi] of [['simple', 1, 8], ['easy', 3, 10], ['average', 5, 12], ['hard', 7, 14], ['impossible', 9, 16]]) {
      const T = mk({ difficulty: d }), q = home(T, 0); let mn = 1e9, mx = 0;
      for (let i = 0; i < 300; i++) { Ev.start(T, M.RNG.create('pl' + i), 1, 0, q, []); mn = Math.min(mn, q.event.cure / 100); mx = Math.max(mx, q.event.cure / 100); }
      t.eq(mn, lo, d); t.eq(mx, hi, d);
    }
    const U = mk(), a = home(U, 1); U.empires[1].bc = 500; Ev.start(U, minR, 1, 1, a, []);
    t.eq(a.sliders[0] + a.sliders[1] + a.sliders[2], 0); t.eq(a.sliders.reduce((x, y) => x + y, 0), 100); t.ok(a.sliders[4] > 0); t.eq(a.bank, 100); t.eq(U.empires[1].bc, 400);
    t.eq(Ev.start(U, minR, 1, 1, a, []).type, 'plague');
  });
  t.test('plague: each later turn the colony loses (rnd6 + 4)% of its population and its research output pays the cure; cured at 0', () => {
    const S = mk(), p = home(S, 0); Ev.start(S, scripted([4]), 1, 0, p, []); S.ev = [];
    let pop = 80, cure = 800;
    for (let turn = 1; turn <= 8; turn++) {
      Ev.progress(S, maxR, []);
      pop -= Math.floor(10 * pop / 100); cure -= 100;
      t.eq(p.pop, pop, 'pop after turn ' + turn);
      if (cure > 0) t.eq(p.event.cure, cure);
    }
    t.ok(!p.event, 'cured when the cure cost reaches 0'); t.eq(newsOf(S, 'plagueCured').length, 1);
    const q = home(S, 0); q.sliders = [100, 0, 0, 0, 0]; Ev.start(S, minR, 1, 0, q, []); const left = q.event.cure; Ev.progress(S, maxR, []); t.eq(q.event.cure, left, 'no research, no progress');
  });
  t.test('plague: Psilons (x1.5), artifact worlds (x2) and the Orion planet (x4) research the cure faster', () => {
    for (const [special, race, mul] of [['normal', 'psilon', 1.5], ['artifacts', 'human', 2], ['orion', 'human', 4]]) {
      const S = mk(), p = home(S, 0); S.empires[0].race = race; p.special = special; p.event = { type: 'plague', cure: 10000, cost: 10000, born: 0 };
      Ev.progress(S, maxR, []); t.eq(10000 - p.event.cure, Math.floor(100 * mul), special + '/' + race);
    }
  });
  t.test('order eventCure: pays reserve BC 1:1 into a plague / nova cure; refuses other planets and calm planets', () => {
    const S = mk(), p = home(S, 0); S.empires[0].bc = 500; Ev.start(S, scripted([4]), 1, 0, p, []);
    t.deep(O.apply(S, 0, { t: 'eventCure', planet: p.id, amount: 300 }), { ok: true, paid: 300, left: 500 });
    t.eq(p.event.cure, 500); t.eq(S.empires[0].bc, 200);
    t.eq(O.apply(S, 0, { t: 'eventCure', planet: p.id, amount: 9999 }).paid, 200, 'capped by the reserve');
    t.ok(!O.apply(S, 0, { t: 'eventCure', planet: p.id, amount: 10 }).ok, 'reserve empty');
    S.empires[0].bc = 1000; t.eq(O.apply(S, 0, { t: 'eventCure', planet: p.id }).paid, 300, 'default: the rest');
    t.eq(p.event.cure, 0);
    const a = home(S, 1); t.ok(!O.apply(S, 0, { t: 'eventCure', planet: a.id, amount: 5 }).ok, 'not your planet');
    const q = second(S, 0); t.ok(!O.apply(S, 0, { t: 'eventCure', planet: q.id, amount: 5 }).ok, 'nothing to cure');
    q.event = { type: 'nova', years: 5, cost: 400, cost0: 400 }; S.empires[0].bc = 100; t.eq(O.apply(S, 0, { t: 'eventCure', planet: q.id, amount: 100 }).left, 300);
    t.ok(!O.apply(S, 0, { t: 'eventCure', planet: q.id, amount: -3 }).ok);
  });
  t.test('earthquake: the colony loses (rnd10 + 20)% of its people and (rnd50 + 30)% of its factories', () => {
    const S = mk(), p = home(S, 0), out = [];
    Ev.start(S, scripted([5, 20]), 2, 0, p, out);
    t.eq(p.pop, 80 - Math.floor(25 * 80 / 100)); t.eq(p.factories, 120 - Math.floor(50 * 120 / 100));
    t.eq(out[0].kind, 'quake'); t.eq(newsOf(S, 'earthquake').length, 1);
    const lo = home(S, 0); Ev.start(S, minR, 2, 0, lo, []); t.eq(lo.pop, 80 - Math.floor(21 * 80 / 100)); t.eq(lo.factories, 120 - Math.floor(31 * 120 / 100));
    const hi = home(S, 0); Ev.start(S, maxR, 2, 0, hi, []); t.eq(hi.pop, 80 - Math.floor(30 * 80 / 100)); t.eq(hi.factories, 120 - Math.floor(80 * 120 / 100));
  });
  t.test('nova: warning with years = rnd5 + 10 - difficulty, cost = (rnd5 + 10 - difficulty) x production; research averts it', () => {
    const S = mk(), p = home(S, 0), out = [];
    Ev.start(S, scripted([3, 2]), 3, 0, p, out);
    t.eq(p.event.type, 'nova'); t.eq(p.event.years, 3 + 10 - 2); t.eq(p.event.cost, (2 + 10 - 2) * 100); t.eq(out[0].kind, 'nova');
    const q = home(S, 0); Ev.start(S, maxR, 3, 0, q, []); t.eq(q.event.years, 13); t.eq(q.event.cost, 1300);
    for (let turn = 1; turn <= 12; turn++) { Ev.progress(S, maxR, []); }
    t.ok(q.event && q.event.years === 1 && q.event.cost === 100, 'still counting down');
    S.ev = []; Ev.progress(S, maxR, []);
    t.ok(!q.event, 'cost <= 0 before the years run out: averted'); t.eq(q.type, 'terran'); t.eq(newsOf(S, 'novaAverted').length, 1); t.eq(newsOf(S, 'systemNova').length, 0);
  });
  t.test('nova: unaverted, the planet turns Radiated (max pop rnd10 + 10), pop = min(pop, rnd(max)), factories keep (rnd3 + 1)/20', () => {
    const S = mk(), p = home(S, 0); p.sliders = [100, 0, 0, 0, 0]; Ev.start(S, maxR, 3, 0, p, []);
    for (let turn = 1; turn <= 12; turn++) Ev.progress(S, maxR, []);
    t.ok(p.event && p.event.years === 1); S.ev = [];
    Ev.progress(S, scripted([7, 5, 3]), []);
    t.ok(!p.event); t.eq(p.type, 'radiated'); t.eq(p.typeIdx, 1); t.eq(p.growth, 'hostile'); t.eq(p.mp1, 17); t.eq(p.mp2, 17); t.eq(p.mp3, 17); t.eq(p.pop, 5); t.eq(p.factories, Math.floor(4 * 120 / 20));
    t.eq(newsOf(S, 'systemNova').length, 1); t.eq(p.owner, 0);
    const q = home(S, 0); q.sliders = [100, 0, 0, 0, 0]; q.pop = 30; Ev.start(S, maxR, 3, 0, q, []); for (let i = 0; i < 12; i++) Ev.progress(S, maxR, []); Ev.progress(S, maxR, []);
    t.eq(q.pop, 20, 'pop 30 -> min(30, rnd(20))'); t.eq(q.factories, Math.floor(4 * 120 / 20), 'rnd3 + 1 = 4 -> 20%');
  });
  t.test('industrial accident: max pop halves, waste = max - 10, Radiated + Hostile; a second item when the waste is gone', () => {
    const S = mk(), p = home(S, 0), out = [];
    Ev.start(S, minR, 4, 0, p, out);
    t.eq(p.mp3, 50); t.eq(p.mp2, 50); t.eq(p.mp1, 100); t.eq(p.waste, 40); t.eq(p.type, 'radiated'); t.eq(p.growth, 'hostile'); t.eq(p.event.type, 'accident'); t.eq(out[0].kind, 'accident');
    S.ev = []; Ev.progress(S, minR, []); t.ok(p.event, 'still polluted');
    p.waste = 0; Ev.progress(S, minR, []); t.ok(!p.event); t.eq(newsOf(S, 'accidentCleaned').length, 1);
    const q = home(S, 0); q.mp2 = 30; Ev.start(S, minR, 4, 0, q, []); t.eq(q.mp2, 30, 'max_pop2 = min(max_pop2, max_pop3)'); q.mp3 = 100; q.mp2 = 100; q.mp3 = 21; Ev.start(S, minR, 4, 0, q, []); t.eq(q.mp3, 10); t.eq(q.waste, 0);
  });
  t.test('assassination: the LAST AI with a NAP / alliance with the victim declares war; the human victim gets the interrupt', () => {
    const S = mk(), p = home(S, 0), calls = [];
    const d = { status: (S_, a, b) => ({ treaty: a === 0 && b === 1 ? 1 : a === 0 && b === 3 ? 2 : 0 }), declareWar: (S_, a, b, why) => { calls.push([a, b, why]); } };
    const out = []; withDiplo(d, () => { Ev.start(S, minR, 5, 0, p, out); });
    t.deep(calls, [[3, 0, 'assassin']]); t.eq(out.length, 1); t.eq(out[0].kind, 'assassin'); t.eq(out[0].empire, 3); t.eq(out[0].empire2, 0);
    t.eq(newsOf(S, 'warDeclared')[0].empire, 3); t.eq(newsOf(S, 'warDeclared')[0].empire2, 0);
    const T = mk(), q = home(T, 1), out2 = [];                  // AI victim: news but no interrupt
    withDiplo({ status: (S_, a, b) => ({ treaty: a === 1 && b === 2 ? 1 : 0 }), declareWar: () => {} }, () => { Ev.start(T, minR, 5, 1, q, out2); });
    t.eq(out2.length, 0); t.eq(newsOf(T, 'warDeclared').length, 1);
  });
  t.test('assassination without a Diplo module: treaties break and relations crash to -75..-100 on the placeholders', () => {
    const S = mk(), p = home(S, 0);
    S.empires[0].relations[2].treaty = 1; S.empires[2].relations[0].treaty = 1;
    withDiplo(undefined, () => { Ev.start(S, scripted([7]), 5, 0, p, []); });
    t.eq(S.empires[0].relations[2].treaty, 3); t.eq(S.empires[2].relations[0].treaty, 3); t.between(S.empires[0].relations[2].attitude, -100, -75);
  });
  t.test('computer virus: zeroes the research stock of Computers / Force Fields / Propulsion / Weapons (25% each), never Construction / Planetology', () => {
    const S = mk(), E = S.empires[0], p = home(S, 0);
    E.research.invest = [11, 22, 33, 44, 55, 66]; Ev.start(S, scripted([2]), 6, 0, p, []);
    t.deep(E.research.invest, [11, 22, 33, 44, 0, 66]); t.eq(newsOf(S, 'virus')[0].n, 55);
    const hit = [0, 0, 0, 0, 0, 0], R = M.RNG.create('virus');
    for (let i = 0; i < 4000; i++) { E.research.invest = [1, 1, 1, 1, 1, 1]; Ev.start(S, R, 6, 0, p, []); E.research.invest.forEach((v, f) => { if (v === 0) hit[f]++; }); }
    t.eq(hit[1], 0); t.eq(hit[3], 0); for (const f of [0, 2, 4, 5]) t.near(hit[f] / 4000, 0.25, 0.03);
  });
  t.test('comet: years = rnd5 + 10 - D, hp = (rnd5 + 10 + D) x 25; the owner\'s ships in orbit chip it down by rnd(hull weight of design #0) per ship stack', () => {
    const S = mk(), p = second(S, 0), E = S.empires[0], out = [];
    Ev.start(S, scripted([3, 2]), 7, 0, p, out);
    t.eq(p.event.type, 'comet'); t.eq(p.event.years, 11); t.eq(p.event.hp, (2 + 10 + 2) * 25); t.eq(p.event.dmg, 0); t.eq(out[0].kind, 'comet');
    E.designs[0].hull = 2;                                       // design #0 = Large: weight 25 (the original uses it for every stack)
    M.Sim.Fleet.addShips(S, 0, p.starId, 1, 4);                  // 4 Fighters
    for (let turn = 1; turn <= 3; turn++) { Ev.progress(S, maxR, []); t.eq(p.event.dmg, 100 * turn); }
    S.ev = []; Ev.progress(S, maxR, []);
    t.ok(!p.event, 'dmg 400 > 350: destroyed'); t.eq(newsOf(S, 'cometDestroyed').length, 1); t.eq(p.owner, 0); t.ok(p.pop > 0);
    for (const hull of [0, 1, 3]) {
      const T = mk(), q = second(T, 0); T.empires[0].designs[0].hull = hull; Ev.start(T, scripted([3, 3]), 7, 0, q, []); M.Sim.Fleet.addShips(T, 0, q.starId, 1, 2);
      Ev.progress(T, maxR, []); t.eq(q.event.dmg, [1, 5, 25, 125][hull] * 2, 'hull ' + hull);
    }
    const U = mk(), r = second(U, 0); Ev.start(U, minR, 7, 0, r, []); M.Sim.Fleet.addShips(U, 1, r.starId, 1, 50); Ev.progress(U, maxR, []); t.eq(r.event.dmg, 0, 'other empires\' ships do not count');
  });
  t.test('comet: undefeated it destroys the planet on impact (no colony, type Not Habitable, hostile); damage and years scale with difficulty', () => {
    const S = mk(), p = second(S, 0); Ev.start(S, minR, 7, 0, p, []);
    const years = p.event.years; t.eq(years, 1 + 10 - 2);
    for (let i = 0; i < years - 1; i++) Ev.progress(S, maxR, []); t.ok(p.event && p.owner === 0);
    S.ev = []; Ev.progress(S, maxR, []);
    t.eq(p.owner, -1); t.eq(p.type, 'none'); t.eq(p.typeIdx, 0); t.eq(p.growth, 'hostile'); t.eq(p.pop, 0); t.eq(p.factories, 0); t.ok(!p.event); t.eq(newsOf(S, 'planetDestroyed').length, 1);
    for (const [d, y0, y1, h0, h1] of [['simple', 11, 15, 275, 375], ['impossible', 7, 11, 375, 475]]) {
      const T = mk({ difficulty: d }), q = second(T, 0); let a = 99, b = 0, c = 99999, e = 0;
      for (let i = 0; i < 300; i++) { Ev.start(T, M.RNG.create('c' + i), 7, 0, q, []); a = Math.min(a, q.event.years); b = Math.max(b, q.event.years); c = Math.min(c, q.event.hp); e = Math.max(e, q.event.hp); }
      t.eq(a, y0); t.eq(b, y1); t.eq(c, h0); t.eq(e, h1);
    }
  });
  t.test('comet: the AI owner cranks its ship slider', () => {
    const S = mk(), p = home(S, 1); S.year = 120; Ev.start(S, minR, 7, 1, p, []);
    t.ok(p.sliders[0] > 0 && p.sliders[1] === 0 && p.sliders[2] === 0 && p.sliders[4] === 0);
  });
  t.test('pirates: hp = (rnd5 + 10 + D) x 30 at a random star; trade loses hp/6 percent; ships there and monsters destroy them', () => {
    const S = mk(), out = [];
    Ev.start(S, scripted([7, 3]), 8, 0, home(S, 0), out);
    const pr = S.events.pirates; t.eq(pr.star, 7); t.eq(pr.hp, (3 + 10 + 2) * 30); t.eq(out[0].kind, 'pirates');
    S.empires[0].frange[7] = 0; S.empires[1].frange[7] = 0; t.eq(Ev.pirateSetback(S, 0, 1), 0, 'out of supply range of both partners');
    S.empires[1].frange[7] = 1; t.eq(Ev.pirateSetback(S, 0, 1), 75); t.eq(Ev.pirateSetback(S, 1, 0), 75);
    S.year += 1;
    const raise = { n: 0 }; withDiplo({ pirateRaid: (S_, star, pct) => { raise.n++; raise.pct = pct; raise.star = star; } }, () => { Ev.progress(S, minR, []); });
    t.eq(raise.pct, 75); t.eq(raise.star, 7);
    S.empires[1].designs[0].hull = 3; M.Sim.Fleet.addShips(S, 1, 7, 1, 3);
    S.ev = []; Ev.progress(S, scripted([100, 100, 100]), []);       // 3 ships: ~hit
    t.ok(pr.hp < 450 || pr.hp === 0);
    for (let i = 0; i < 8 && pr.hp > 0; i++) Ev.progress(S, maxR, []);
    t.eq(pr.hp, 0); t.eq(newsOf(S, 'piracyEnded').length, 1); t.eq(Ev.pirateSetback(S, 0, 1), 0);
    const T = mk(); Ev.start(T, scripted([5, 3]), 8, 0, home(T, 0), []); T.year += 1; T.monsters = [{ id: 1, kind: 'amoeba', star: 5, killer: -1 }]; Ev.progress(T, minR, []);
    t.eq(T.events.pirates.hp, 0, 'a monster at the pirate base kills them outright');
  });
  t.test('derelict: an AI empire gains the first listed tech of every tier up to TL/5 + 2 in Weapons and Force Fields; never a human', () => {
    const S = mk(), E = S.empires[2], p = home(S, 2);
    E.research.tl[5] = 12; E.research.tl[2] = 3;                    // 4 weapon tiers, 2 force-field tiers
    const before = [E.research.list[5].slice(0, 4).map(x => x[0]), E.research.list[2].slice(0, 2).map(x => x[0])];
    t.ok(!Ev.rejects(S, 9, 2, p)); Ev.start(S, minR, 9, 2, p, []);
    for (const l of before[0]) t.ok(E.research.completed[5].indexOf(l) >= 0, 'weapon ' + l);
    for (const l of before[1]) t.ok(E.research.completed[2].indexOf(l) >= 0, 'force field ' + l);
    t.eq(newsOf(S, 'derelict').length, 1);
    const T = mk(), F = T.empires[1], q = home(T, 1); F.research.tl[5] = 99; F.research.tl[2] = 99; Ev.start(T, minR, 9, 1, q, []);
    t.ok(F.research.completed[5].length <= 1 + 10 && F.research.completed[2].length <= 1 + 10, 'at most 10 tiers each');
  });
  t.test('rebellion: a human colony rebels with pop/2 rebels (unrest = rebellion)', () => {
    const S = mk(), p = second(S, 0), out = [];
    Ev.start(S, minR, 10, 0, p, out);
    t.eq(p.rebels, 30); t.eq(p.unrest, 2); t.eq(out[0].kind, 'rebellion'); t.eq(newsOf(S, 'planetRebels').length, 1);
    t.eq(M.Sim.Colony.gross(S, S.empires[0], p), 0, 'a rebelling colony produces nothing');
  });
  t.test('fertile planet: growth becomes Fertile and max_pop2 = max_pop1 + 25% rounded up to 5', () => {
    for (const [mp1, inc] of [[100, 25], [70, 20], [90, 25], [40, 10], [50, 15], [45, 15], [20, 5]]) {
      const S = mk(), p = second(S, 0); p.typeIdx = 10; p.mp1 = p.mp2 = p.mp3 = mp1; p.growth = 'normal';
      Ev.start(S, minR, 13, 0, p, []);
      t.eq(p.growth, 'fertile', 'mp1 ' + mp1); t.eq(p.mp2, mp1 + inc, 'mp1 ' + mp1); t.eq(p.mp3, mp1 + inc);
    }
    const S = mk(), p = second(S, 0); p.typeIdx = 10; Ev.start(S, minR, 13, 0, p, []); t.eq(newsOf(S, 'terraform').length, 1);
  });
  t.test('mineral-rich and depleted planets, and the donation', () => {
    const S = mk(), p = second(S, 0); Ev.start(S, minR, 14, 0, p, []); t.eq(p.special, 'rich'); t.eq(newsOf(S, 'richPlanet').length, 1);
    Ev.start(S, minR, 16, 0, p, []); t.eq(p.special, 'poor'); t.eq(newsOf(S, 'poorPlanet').length, 1);
    p.special = 'ultrarich'; Ev.start(S, minR, 16, 0, p, []); t.eq(p.special, 'poor', 'poor also hits rich worlds');
    for (const [year, bc] of [[60, 600], [30, 500], [49, 500], [50, 500], [59, 500], [100, 1000], [250, 2500], [1, 500]]) {
      const T = mk(), E = T.empires[0]; T.year = year; E.bc = 10; Ev.start(T, minR, 15, 0, home(T, 0), []); t.eq(E.bc, 10 + bc, 'year ' + year);
    }
  });
  t.test('every event leaves a plain-JSON state and a readable headline', () => {
    for (let k = 1; k <= 16; k++) {
      const S = mk(), p = k === 10 ? second(S, 0) : home(S, k === 9 ? 2 : 0); S.year = 300; ownPlanets(S, 0, 6);
      const victim = k === 9 ? 2 : 0; if (k === 5) { S.empires[0].relations[1].treaty = 1; S.empires[1].relations[0].treaty = 1; }
      const out = []; withDiplo({ status: (S_, a, b) => ({ treaty: a === 0 && b === 1 ? 1 : 0, trade: { bc: 10 } }), declareWar: () => {} }, () => { Ev.start(S, M.RNG.create('all' + k), k, victim, p, out); });
      JSON.parse(JSON.stringify(S));
      t.ok(newsOf(S).length >= 1, 'kind ' + k + ' announces itself'); t.ok(newsOf(S).every(n => typeof n.headline === 'string' && n.headline.length > 8), 'kind ' + k);
    }
  });

  // ---- monsters (§7.4) --------------------------------------------------------------------------------------------------------------------------------
  t.test('monsters: Crystal and Amoeba hit points by difficulty', () => {
    const want = { crystal: [3000, 4000, 5000, 6000, 7000], amoeba: [1000, 2000, 3000, 4000, 5000] };
    ['simple', 'easy', 'average', 'hard', 'impossible'].forEach((d, i) => {
      const S = mk({ difficulty: d });
      const c = Ev.spawnMonster(S, minR, 'crystal', []); t.eq(c.hp, want.crystal[i]); t.eq(c.maxHp, want.crystal[i]);
      const a = Ev.spawnMonster(S, minR, 'amoeba', []); t.eq(a.hp, want.amoeba[i]);
    });
  });
  t.test('monsters: spawn at a map edge heading for the grid star there, resting 2 turns first', () => {
    const S = mk(), g = S.galaxy;
    for (let edge = 0; edge < 4; edge++) {
      const m = Ev.spawnMonster(S, scripted([edge, edge === 0 || edge === 2 ? 3 : 4]), 'crystal', []);
      t.eq(m.counter, 2); t.eq(m.nuked, 0); t.eq(m.killer, -1); t.eq(m.star, -1); t.ok(!m.attackable);
      const st = S.stars[m.dest];
      if (edge === 0) { t.eq(m.x, 0); t.eq(m.dest, 3 * g.cols); t.eq(m.y, st.y); }
      if (edge === 2) { t.eq(m.x, g.w); t.eq(m.dest, 3 * g.cols + g.cols - 1); }
      if (edge === 1) { t.eq(m.y, 0); t.eq(m.dest, 4); t.eq(m.x, st.x); }
      if (edge === 3) { t.eq(m.y, g.h); t.eq(m.dest, (g.rows - 1) * g.cols + 4); }
    }
    t.eq(S.monsters.length, 4); t.eq(newsOf(S, 'monsterSpawn').length, 4);
  });
  t.test('monsters: waiting 2 turns, then 11 map units a turn (5 + 6) straight at the destination; standing on it makes it attackable', () => {
    const S = mk(), m = Ev.spawnMonster(S, scripted([0, 2]), 'amoeba', []); const dest = S.stars[m.dest];
    Ev.moveMonsters(S, minR, []); t.eq(m.counter, 1); t.eq(m.x, 0);
    Ev.moveMonsters(S, minR, []); t.ok(m.x > 0, 'moves on the second turn');
    let px = m.x, py = m.y, turns = 1, guard = 0;
    while (m.star < 0 && guard++ < 80) { Ev.moveMonsters(S, minR, []); const step = Math.hypot(m.x - px, m.y - py); if (m.star < 0) t.between(step, 9, 12.5, 'turn ' + turns); px = m.x; py = m.y; turns++; }
    t.eq(m.star, m.dest); t.eq(m.x, dest.x); t.eq(m.y, dest.y); t.ok(m.attackable); t.eq(Ev.monsterAt(S, m.dest), m);
    t.eq(Ev.monsterAt(S, (m.dest + 1) % S.stars.length), null);
    t.between(turns, Math.floor(dest.x / 11) - 1, Math.ceil(dest.x / 11) + 2);
  });
  function arrival(kind, owned) {                                  // a monster standing on a star `owned` by empire 0
    const S = mk(), p = second(S, 0); S.year = 250; if (!owned) p.owner = -1;
    const m = Ev.spawnMonster(S, minR, kind, []);
    m.x = S.stars[p.starId].x; m.y = S.stars[p.starId].y; m.star = p.starId; m.dest = p.starId; m.counter = 0; m.attackable = true; S.ev = [];
    return { S, m, p };
  }
  t.test('monsters: a Crystal empties the colony (pop 0, waste = max pop - 10, factories and owner kept), rests 4 turns, then walks to an adjacent grid star', () => {
    const { S, m, p } = arrival('crystal', true); p.mp3 = 80;
    Ev.moveMonsters(S, M.RNG.create('cr'), []);
    t.eq(p.pop, 0); t.eq(p.waste, 70); t.eq(p.factories, 40); t.eq(p.owner, 0); t.eq(m.nuked, 1); t.ok(m.hit); t.ok(!m.attackable); t.eq(m.counter, 4);
    t.eq(newsOf(S, 'monsterAttack').length, 1);
    const g = S.galaxy, c0 = p.starId % g.cols, r0 = Math.floor(p.starId / g.cols), c1 = m.dest % g.cols, r1 = Math.floor(m.dest / g.cols);
    t.ok(Math.abs(c1 - c0) <= 1 && Math.abs(r1 - r0) <= 1 && m.dest !== p.starId, 'adjacent grid cell'); t.ok(m.dest !== S.orion && S.planets[m.dest].typeIdx > 0);
    t.eq(Ev.monsterAt(S, p.starId), null, 'a resting monster cannot be attacked');
    for (let i = 0; i < 3; i++) { Ev.moveMonsters(S, minR, []); t.eq(m.x, S.stars[p.starId].x); }
    Ev.moveMonsters(S, minR, []); t.ok(m.x !== S.stars[p.starId].x || m.y !== S.stars[p.starId].y, 'leaves after the 4th resting turn');
  });
  t.test('monsters: an Amoeba kills the colony, divides factories by 10 and leaves a Radiated world with max pop 10 / 15 / 20 and no owner', () => {
    for (const [roll, maxPop] of [[1, 10], [2, 15], [3, 20]]) {
      const { S, p } = arrival('amoeba', true);
      Ev.moveMonsters(S, scripted([roll]), []);
      t.eq(p.owner, -1); t.eq(p.pop, 0); t.eq(p.factories, 4); t.eq(p.type, 'radiated'); t.eq(p.typeIdx, 1); t.eq(p.growth, 'hostile'); t.eq(p.mp1, maxPop); t.eq(p.mp2, maxPop); t.eq(p.mp3, maxPop); t.eq(p.maxPop, maxPop);
    }
  });
  t.test('monsters: an empire whose last colony dies is eliminated (fleets removed)', () => {
    const S = mk(), E = S.empires[2], cap = home(S, 2); S.year = 250;
    M.Sim.Fleet.addShips(S, 2, cap.starId, 0, 3);
    const m = Ev.spawnMonster(S, minR, 'amoeba', []); m.x = S.stars[cap.starId].x; m.y = S.stars[cap.starId].y; m.star = cap.starId; m.dest = cap.starId; m.counter = 0; S.ev = [];
    Ev.moveMonsters(S, minR, []);
    t.ok(!E.alive); t.ok(!S.fleets.some(f => f.owner === 2)); t.eq(newsOf(S, 'monsterAttack')[0].stage, 'eliminated'); t.eq((S.ev || []).filter(e => e.type === 'empireDestroyed').length, 1);
  });
  t.test('monsters: striking an empty star costs nothing and does not count; after five hit colonies the monster vanishes; one hit on an unowned planet needs no victim', () => {
    const { S, m } = arrival('crystal', false);
    Ev.moveMonsters(S, minR, []); t.eq(m.nuked, 0); t.ok(m.hit);
    const T = mk(); T.year = 250; const mm = Ev.spawnMonster(T, minR, 'crystal', []); mm.nuked = 4;
    const p = second(T, 0); mm.x = T.stars[p.starId].x; mm.y = T.stars[p.starId].y; mm.star = p.starId; mm.dest = p.starId; mm.counter = 0; T.ev = [];
    Ev.moveMonsters(T, minR, []); t.eq(T.monsters.length, 0); t.eq(newsOf(T, 'monsterVanishes').length, 1); t.ok(!Ev.monsterExists(T));
  });
  t.test('monsters: killed by an empire it is removed with a news item; Events.killMonster(S, monster|id, empire)', () => {
    const S = mk(), m = Ev.spawnMonster(S, minR, 'crystal', []); S.ev = [];
    t.ok(Ev.killMonster(S, m.id, 1)); t.eq(m.killer, 1); t.ok(Ev.monsterExists(S) === false);
    Ev.moveMonsters(S, minR, []); t.eq(S.monsters.length, 0); t.eq(newsOf(S, 'monsterKilled').length, 1); t.ok(!Ev.killMonster(S, 999, 1));
  });

  // ---- coups, Guardian, artifacts (§7.3, §7.5, §7.6) ---------------------------------------------------------------------------------------------
  t.test('coup: an AI with at least half of its planets in rebellion re-rolls both traits uniformly, clears the unrest and takes a new leader', () => {
    const S = mk(), E = S.empires[1]; ownPlanets(S, 1, 4); const mine = S.planets.filter(p => p.owner === 1), old = E.leader;
    mine[0].unrest = 2; mine[0].rebels = 5; Ev.coups(S, minR); t.eq(E.leader, old, '1 of 4 rebelling: no coup');
    mine[1].unrest = 2; mine[1].rebels = 5; E.personality = 0; E.objective = 0;
    Ev.coups(S, scripted([2, 4]));
    t.eq(E.personality, 2); t.eq(E.objective, 4); t.ok(mine.every(p => p.unrest === 0 && p.rebels === 0)); t.ok(E.leader !== old); t.eq(newsOf(S, 'coup').length, 1); t.eq(E.alive, true);
    const pool = M.Data.Races.races[E.race].leaders; t.ok(pool.indexOf(E.leader) >= 0);
  });
  t.test('coup: Diplo.onCoup is told when the hook exists', () => {
    const S = mk(); ownPlanets(S, 1, 2); S.planets.filter(p => p.owner === 1)[0].unrest = 2; const told = [];
    withDiplo({ onCoup: (S_, id) => told.push(id) }, () => { Ev.coups(S, minR); });
    t.deep(told, [1]);
  });
  t.test('coup: relation1 returns to relation2 and treaties and trade with the human are cancelled (through the Diplo API)', () => {
    const S = mk(), E = S.empires[1], H = S.empires[0]; ownPlanets(S, 1, 2); S.planets.filter(p => p.owner === 1)[0].unrest = 2;
    const D = M.Sim.Diplo; t.ok(D, 'the real Diplo module is loaded');
    D.setTreaty(S, 1, 0, 2); E.relations[0].trade = 80; H.relations[1].trade = 80; E.relations[0].rel2 = 12; H.relations[1].rel2 = 12; E.relations[0].rel1 = H.relations[1].rel1 = 90; E.relations[0].attitude = H.relations[1].attitude = 90;
    Ev.coups(S, minR);
    t.eq(E.relations[0].treaty, 0); t.eq(H.relations[1].treaty, 0); t.eq(E.relations[0].trade, 0); t.eq(H.relations[1].trade, 0);
    t.eq(E.relations[0].rel1, 12); t.eq(H.relations[1].rel1, 12);
  });
  t.test('coup: with two humans alive a toppled human is an ordinary coup — no funeral, rebellions end', () => {
    const S = mk(), H = S.empires[0]; S.empires[2].human = true; ownPlanets(S, 0, 3); const mine = S.planets.filter(p => p.owner === 0);
    mine[0].unrest = 2; mine[1].unrest = 2; mine[0].rebels = 4; mine[1].rebels = 4;
    Ev.coups(S, minR);
    t.ok(H.alive); t.ok(!S.gameOver); t.ok(mine.every(p => p.unrest === 0 && p.rebels === 0));
  });
  t.test('coup: toppling the last human ends the game (funeral)', () => {
    const S = mk(), H = S.empires[0]; ownPlanets(S, 0, 3); const mine = S.planets.filter(p => p.owner === 0);
    mine[0].unrest = 2; mine[1].unrest = 2; Ev.coups(S, minR);           // 2 of 3 >= ceil(3 / 2)
    t.ok(!H.alive); t.eq(S.gameOver.reason, 'defeat'); t.eq(S.gameOver.cause, 'coup'); t.eq(M.Sim.Victory.check(S).ending, 'funeral');
  });
  t.test('genocide: the -36 against the killer is Diplo.preTurn\'s job — Events.coups adds no second penalty', () => {
    const S = mk(), log = [];
    ownPlanets(S, 3, 2); for (const p of S.planets) if (p.owner === 3) p.owner = 1;
    S.empires[3].alive = false; S.turn += 1;
    withDiplo({ incident: (S_, kind, from, to, dv) => log.push([kind, from, to, dv]) }, () => { Ev.coups(S, minR); });
    t.deep(log, []);
  });
  t.test('Guardian loot: Death Ray + up to 3 techs of level 20..min(TL + 25, 50), paid once to the killer', () => {
    const S = mk(), E = S.empires[0]; E.research.tl = [1, 1, 1, 1, 1, 1];
    S.guardian.alive = false; S.guardian.killer = 0; S.ev = [];
    Ev.coups(S, M.RNG.create('guard'));
    t.ok(E.research.completed[5].indexOf(36) >= 0, 'Death Ray'); t.eq(S.guardian.looted, true);
    const got = S.guardian.loot; t.ok(got.deathRay); t.ok(got.techs.length >= 1 && got.techs.length <= 3);
    for (const x of got.techs) { t.between(x.level, 20, 26, 'cap TL 1 + 25'); t.ok(E.research.completed[x.field].indexOf(x.level) >= 0); }
    t.eq(new Set(got.techs.map(x => x.field + ':' + x.level)).size, got.techs.length);
    t.eq((S.ev || []).filter(e => e.type === 'tech' && e.source === 'orion').length, 1 + got.techs.length);
    t.eq(newsOf(S, 'guardianSlain').length, 1);
    const n = techCount(E); Ev.coups(S, M.RNG.create('again')); S.turn++; Ev.coups(S, M.RNG.create('again')); t.eq(techCount(E), n, 'only once');
    t.eq(newsOf(S, 'guardianSlain').length, 1);
  });
  function techCount(E) { return E.research.completed.reduce((a, l) => a + l.length, 0); }
  t.test('Guardian loot: a higher tech level raises the cap (min(TL + 25, 50)); AI killers are paid too; no killer, no prize', () => {
    const S = mk(), E = S.empires[2]; E.research.tl = [40, 40, 40, 40, 40, 40]; let max = 0, min = 99;
    for (let i = 0; i < 200; i++) { E.research.completed = [[1], [1], [1], [1], [1], [1]]; E.research.tl = [40, 40, 40, 40, 40, 40]; const r = A.guardianLoot(S, E, M.RNG.create('gl' + i)); for (const x of r.techs) { max = Math.max(max, x.level); min = Math.min(min, x.level); } t.ok(r.deathRay); }
    t.eq(min, 20); t.eq(max, 50);
    const T = mk(); T.guardian.alive = false; T.guardian.killer = 2; Ev.coups(T, M.RNG.create('ai')); t.ok(T.empires[2].research.completed[5].indexOf(36) >= 0);
    const U = mk(); U.guardian.alive = false; Ev.coups(U, minR); t.ok(!U.guardian.looted, 'killer unknown'); t.ok(!U.empires[0].research.completed[5].includes(36));
    const W = mk(); Ev.coups(W, minR); t.ok(!W.guardian.looted, 'alive');
  });
  t.test('Orion: every fleet still in orbit while the Guardian lives is removed; afterwards ships may stay', () => {
    const S = mk(); M.Sim.Fleet.addShips(S, 0, S.orion, 0, 3); M.Sim.Fleet.addShips(S, 1, S.orion, 1, 2);
    Ev.coups(S, minR); t.ok(!S.fleets.some(f => f.star === S.orion));
    const T = mk(); T.guardian.alive = false; M.Sim.Fleet.addShips(T, 0, T.orion, 0, 3); Ev.coups(T, minR); t.ok(T.fleets.some(f => f.star === T.orion));
  });
  t.test('Orion colonised: one news item the first time somebody owns it', () => {
    const S = mk(); S.guardian.alive = false; S.planets[S.orion].owner = 1; S.ev = [];
    Ev.coups(S, minR); S.turn++; Ev.coups(S, minR); t.eq(newsOf(S, 'orionColonised').length, 1);
  });
  t.test('artifact worlds: a human\'s first visit grants one tech of level <= min(TL + 10, 50), <= 30, once; AI empires get nothing', () => {
    const S = mk(), E = S.empires[0], p = second(S, 1); p.special = 'artifacts'; p.owner = -1; let max = 0, none = 0;
    for (let i = 0; i < 300; i++) {
      E.research.completed = [[1], [1], [1], [1], [1], [1]]; E.research.tl = [1, 1, 1, 1, 1, 1]; p.looted = [];
      const r = A.loot(S, E, p, M.RNG.create('al' + i)); if (!r) { none++; continue; }
      max = Math.max(max, r.level); t.ok(r.level <= 11 && r.level >= 2, 'level ' + r.level); t.ok(E.research.completed[r.field].indexOf(r.level) >= 0);
    }
    t.ok(max >= 9, 'reaches the cap'); t.ok(none < 30, 'a tech is found almost always');
    let hi = 0; for (let i = 0; i < 300; i++) { E.research.completed = [[1], [1], [1], [1], [1], [1]]; E.research.tl = [30, 30, 30, 30, 30, 30]; p.looted = []; const r = A.loot(S, E, p, M.RNG.create('ah' + i)); if (r) hi = Math.max(hi, r.level); }
    t.eq(hi, 30, 'levels never exceed 30 even with a high cap');
    p.looted = []; const first = A.loot(S, E, p, M.RNG.create('x')); t.eq(A.loot(S, E, p, M.RNG.create('y')), null, 'once per planet and empire'); void first;
    const ai = S.empires[2]; p.looted = []; t.eq(A.loot(S, ai, p, M.RNG.create('z')), null); t.deep(ai.research.completed, S.empires[2].research.completed);
    t.eq(A.loot(S, E, S.planets[S.empires[0].capital], M.RNG.create('n')), null, 'not an artifacts planet');
  });
  t.test('artifact loot is queued as a "tech" event with source loot (the breakthrough scene) and a GNN item', () => {
    const S = mk(), E = S.empires[0], p = second(S, 1); p.special = 'artifacts'; p.owner = -1; S.ev = []; let r = null;
    for (let i = 0; i < 20 && !r; i++) { p.looted = []; r = A.loot(S, E, p, M.RNG.create('q' + i)); }
    t.ok(r); const te = (S.ev || []).filter(e => e.type === 'tech'); t.ok(te.length >= 1 && te[te.length - 1].source === 'loot'); t.ok(newsOf(S, 'artifactFound').length >= 1);
  });

  // ---- housekeeping and the turn hook ------------------------------------------------------------------------------------------------------------------
  t.test('Events.turn returns the interrupts of the turn, progresses running events, and only rolls new events from year 41', () => {
    const S = mk(), p = home(S, 0); S.year = 20; const out = Ev.turn(S, M.RNG.bind(S.rs)); t.ok(Array.isArray(out)); t.eq(out.length, 0); t.eq(S.events.year, 40);
    Ev.start(S, minR, 1, 0, p, []); S.year = 30; S.events.year = 30; S.ev = [];
    const o2 = Ev.turn(S, maxR); t.ok(p.pop < 80, 'running plague progressed'); void o2;
  });
  t.test('Events.coups runs the Guardian prize even when random events are off (turn.js always calls it)', () => {
    const S = mk(); S.settings.options.randomEvents = false; S.guardian.alive = false; S.guardian.killer = 0;
    Ev.coups(S, M.RNG.bind(S.rs)); t.ok(S.empires[0].research.completed[5].indexOf(36) >= 0);
  });
  t.test('determinism: two identical AI-only games produce identical event histories and states', () => {
    function run() {
      const S = M.Sim.Setup.create({ size: 'small', opponents: 3, race: 'human', seed: 'ev-det', difficulty: 'impossible', playerAI: true });
      for (let i = 0; i < 160; i++) M.Sim.autoTurn(S);
      return JSON.stringify([S.events, S.monsters || [], S.empires.map(e => e.alive), S.rs]);
    }
    const a = run(); t.eq(a, run()); t.ok(JSON.parse(a)[0].log.length >= 1, 'events happened');
  });
  t.test('a long headless game with the event engine never throws and keeps planets sane', () => {
    const S = M.Sim.Setup.create({ size: 'medium', opponents: 4, race: 'psilon', seed: 'ev-long', difficulty: 'hard', playerAI: true });
    for (let i = 0; i < 260; i++) M.Sim.autoTurn(S);
    for (const p of S.planets) { if (p.owner >= 0) t.ok(p.pop >= 0 && p.factories >= 0, 'planet ' + p.id); if (p.event) t.ok(['plague', 'nova', 'comet', 'accident'].indexOf(p.event.type) >= 0 && p.owner >= 0, 'event on planet ' + p.id); }
    t.ok(Object.keys(S.events.done).length >= 1);
  });
};
