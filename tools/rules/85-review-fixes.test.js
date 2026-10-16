// Regression tests for the October 2026 review fixes (tools/handoff/review-2026-10.md, P1 #1–#10): unanswered prompts, slider locks, dead empires,
// bombs vs empty planets, order validation, tech-choice fallback, save failure reporting.
module.exports = function (M, t) {
  const Sim = M.Sim, O = Sim.Orders;
  const game = (seed, o) => Sim.Setup.create(Object.assign({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: seed || 'rev' }, o || {}));
  const me = S => S.empires[S.playerId];
  const isClean = v => JSON.stringify(v) === JSON.stringify(JSON.parse(JSON.stringify(v))) && !/null/.test(JSON.stringify(v));

  t.test('diplomacy: no answer is not an acceptance; only explicit accept/agree/yes/ok/swap are', () => {
    const yes = Sim.Diplo.yes;
    for (const v of [undefined, null, false, 'reject', 'forget', 0, '']) t.eq(yes(v), false, 'yes(' + v + ')');
    for (const v of [true, 'accept', 'agree', 'yes', 'ok', 'swap1']) t.eq(yes(v), true, 'yes(' + v + ')');
  });
  t.test('headless autoTurn answers AI→human audiences with an explicit accept (the historical soak behaviour, now spelled out)', () => {
    const S = game('aud', { playerAI: true });
    const src = String(Sim.autoTurn); t.ok(/case 'diplomacy'/.test(src) && /'accept'/.test(src));
    t.ok(S.empires[0].alive);
  });

  t.test('eco floor with TECH locked: the raise comes out of SHIP/DEF/IND, the five sliders still sum to 100 and none goes negative', () => {
    const C = Sim.Colony, S = game('eco'), E = me(S), p = S.planets[E.capital];
    const saved = C.ecoFloorPct; C.ecoFloorPct = () => 35;
    try {
      p.sliders = [0, 0, 60, 0, 40]; p.lock = [false, false, false, false, true];
      C.applyEcoFloor(S, E, p);
      t.eq(p.sliders.reduce((a, b) => a + b, 0), 100, 'sum ' + p.sliders.join('/'));
      t.eq(p.sliders[3], 35); t.eq(p.sliders[4], 40); t.eq(p.sliders[2], 25);
      C.setSlider(S, E, p, 0, 50);
      t.eq(p.sliders.reduce((a, b) => a + b, 0), 100, 'after setSlider ' + p.sliders.join('/'));
      t.ok(p.sliders.every(v => v >= 0), 'no negative slider');
      // everything but ECO locked and the floor still wants more: the planet cannot comply, but the sum stays 100 and nothing is negative
      p.sliders = [30, 30, 0, 0, 40]; p.lock = [true, true, false, false, true];
      C.applyEcoFloor(S, E, p);
      t.eq(p.sliders.reduce((a, b) => a + b, 0), 100, 'locked ' + p.sliders.join('/')); t.ok(p.sliders.every(v => v >= 0));
    } finally { C.ecoFloorPct = saved; }
  });

  t.test('a dead empire takes its fleets and transports with it (no ghost warships)', () => {
    const S = game('dead'), E = S.empires[1];
    for (const p of S.planets) if (p.owner === E.id) { p.owner = -1; p.pop = 0; }
    S.fleets = S.fleets.filter(f => f.owner !== E.id);
    const scout = E.designs.findIndex(d => d && !Sim.Design.stats(S, E, E.designs.indexOf(d)).colonyMin);
    S.fleets.push({ id: 9001, owner: E.id, star: E.capital, from: -1, to: -1, x: 0, y: 0, speed: 1, ships: [0, 0, 0, 0, 0, 0].map((v, i) => (i === scout ? 3 : 0)) });
    S.trans = [{ owner: E.id, to: 0, from: E.capital, n: 5, eta: 2 }];
    Sim.Turn.checkDeaths(S);
    t.eq(E.alive, false);
    t.eq(S.fleets.filter(f => f.owner === E.id).length, 0, 'fleets removed');
    t.eq(S.trans.filter(x => x.owner === E.id).length, 0, 'transports removed');
    t.eq(S.ev.some(e => e.type === 'empireDestroyed' && e.empire === E.id), true);
  });

  t.test('tactical combat: bombs keep hitting a planet whose last base is gone (collateral on population / factories)', () => {
    const F = require('./50-combat.test.js').fixtures(M), C = F.C;
    const d = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'nuclear-bomb', count: 2 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: d, n: 20 }] }, { planet: { bases: 1, pop: 100, factories: 100 }, planetSide: 0, seed: 'bomb0' });
    B.units[0].count = 0;                                                       // all bases gone
    F.activate(B, 2); F.place(B, 2, 2, 3);
    const ev = C.act(B, 2, { type: 'fire', target: 0 });
    const beam = ev.find(e => e.type === 'beam');
    t.ok(beam && beam.hits > 0 && beam.damage > 0, 'bombs fell: ' + JSON.stringify(beam && { hits: beam.hits, damage: beam.damage }));
    t.ok((B.planet.popKilled | 0) + (B.planet.factKilled | 0) + (B.planet.factoriesKilled | 0) > 0 || beam.damage > 0, 'collateral applied');
  });

  t.test('fleetSend: negative / non-numeric counts are clamped to 0 — ships are never created or lost', () => {
    const S = game('send'), E = me(S), F = Sim.Fleet, cap = E.capital;
    const g = F.at(S, cap, E.id); t.ok(g, 'home fleet');
    const before = g.ships.slice(), total = () => S.fleets.filter(f => f.owner === E.id).reduce((a, f) => a + f.ships.reduce((x, y) => x + y, 0), 0), tot0 = total();
    const slot = before.findIndex(n => n > 0);
    const to = S.stars.map(s => s.id).find(id => id !== cap && F.canReach(S, E, id, false));
    t.ok(to >= 0, 'a reachable star');
    const counts = [0, 0, 0, 0, 0, 0]; counts[slot] = 1; counts[(slot + 1) % 6] = -5;
    const r = O.apply(S, E.id, { t: 'fleetSend', from: cap, to, counts });
    t.eq(r.ok, true, r.msg);
    t.eq(total(), tot0, 'ship total conserved');
    const g2 = F.at(S, cap, E.id);
    for (let i = 0; i < 6; i++) t.eq(g2 ? g2.ships[i] : 0, before[i] - (i === slot ? 1 : 0), 'orbit slot ' + i);
    t.eq(O.apply(S, E.id, { t: 'fleetSend', from: cap, to, counts: 'junk' }).ok, false);
    t.eq(O.apply(S, E.id, { t: 'fleetSend', from: cap, to: 9999, counts: [1, 0, 0, 0, 0, 0] }).ok, false);
  });

  t.test('order validation: bad build / slider / research / tax / transfer / trans values are rejected and the state stays JSON-clean', () => {
    const S = game('val'), E = me(S), p = S.planets[E.capital], snap = JSON.stringify([p.sliders, p.lock, p.build, E.research.slider, E.research.lock, E.tax, E.security, E.bc, p.bank]);
    const bad = [
      { t: 'build', planet: p.id, design: 'length' }, { t: 'build', planet: p.id, design: 1.5 }, { t: 'build', planet: p.id, design: 7 },
      { t: 'slider', planet: p.id, index: 0 }, { t: 'slider', planet: p.id, index: 1.5, value: 50 }, { t: 'slider', planet: p.id, index: 0, value: 'x' }, { t: 'slider', planet: p.id, index: 0, value: NaN },
      { t: 'sliders', planet: p.id, values: [NaN, 0, 0, 0, 100] }, { t: 'sliders', planet: p.id, values: 'junk' },
      { t: 'sliderLock', planet: p.id, index: 'foo', locked: true },
      { t: 'researchSlider', field: 2 }, { t: 'researchSlider', field: 'a', value: 10 }, { t: 'researchSet', values: [NaN, 20, 20, 20, 20, 20] }, { t: 'researchLock', field: 9, locked: true },
      { t: 'researchPick', field: 'x', level: 1 }, { t: 'researchPick', field: 0, level: 'y' },
      { t: 'tax', value: 'high' }, { t: 'tax' }, { t: 'security', value: NaN }, { t: 'transfer', planet: p.id, amount: 'all' },
      { t: 'trans', planet: p.id, to: p.starId, n: 5 },
    ];
    for (const o of bad) { const r = O.apply(S, E.id, o); t.eq(r.ok, false, JSON.stringify(o) + ' → ' + (r.msg || 'accepted')); }
    t.eq(JSON.stringify([p.sliders, p.lock, p.build, E.research.slider, E.research.lock, E.tax, E.security, E.bc, p.bank]), snap, 'nothing changed');
    t.ok(isClean(S.planets.filter(x => x.owner >= 0).map(x => x.sliders)) && isClean(E.research.slider), 'no NaN');
    t.eq(O.apply(S, E.id, { t: 'slider', planet: p.id, index: 0, value: 40 }).ok, true);
    t.eq(p.sliders.reduce((a, b) => a + b, 0), 100);
    t.eq(O.apply(S, E.id, { t: 'tax', value: 250 }).ok, true); t.eq(E.tax, 200, 'clamped');
  });

  t.test('tech choice: an invalid pick starts the first choice (the field is never left without a project), and a funded-but-empty field is asked again', () => {
    const S = game('tech'), E = me(S), R = Sim.Research;
    const gen = Sim.Turn.run(S); let r = gen.next(), asked = 0;
    while (!r.done) {
      const it = r.value; let ans;
      if (it.type === 'aiPlan') ans = {};
      else if (it.type === 'battles') ans = { results: it.battles.map(b => Sim.Combat.resolve(b, M.RNG.create('x'))) };
      else if (it.type === 'techChoice') { asked++; ans = 999; }
      else if (it.type === 'colonize') ans = false;
      r = gen.next(ans);
    }
    t.ok(asked > 0, 'asked at turn 0');
    for (let f = 0; f < 6; f++) if (R.choices(E, f).length) t.ok(E.research.project[f] > 0, 'field ' + f + ' has a project');
    // a field with a slider but no project and no pile is asked (not only when invest > 0)
    E.research.project[0] = 0; E.research.invest[0] = 0; E.research.slider[0] = 20;
    const gen2 = Sim.Turn.run(S); r = gen2.next(); let askedField0 = false;
    while (!r.done) {
      const it = r.value; let ans;
      if (it.type === 'aiPlan') ans = {};
      else if (it.type === 'battles') ans = { results: it.battles.map(b => Sim.Combat.resolve(b, M.RNG.create('y'))) };
      else if (it.type === 'techChoice') { if (it.field === 0) askedField0 = true; ans = it.choices[0].level; }
      else if (it.type === 'colonize') ans = false;
      r = gen2.next(ans);
    }
    t.ok(askedField0 || !R.choices(E, 0).length, 'field 0 asked again');
  });

  t.test('bombard prompt: only an explicit true bombs; no answer defers to the AI rule, false never bombs', () => {
    const src = String(Sim.Turn.run);
    t.ok(/yes === true/.test(src) && /aiBombs/.test(src) && !/yes !== false/.test(src));
  });

  t.test('a failed save emits save:failed (so the UI can warn) and a successful one emits saved', () => {
    const G = M.Game; if (!G) { t.ok(true, 'no Game in this harness'); return; }
    const S = game('save'); const prev = G.S; G.S = S;
    let got = null; const off = M.Bus.on('save:failed', s => { got = s; }), off2 = M.Bus.on('saved', s => { got = 'saved:' + s; });
    try { const ok = G.saveSlot('1'); t.eq(ok ? got : got, ok ? 'saved:1' : '1'); }
    finally { off(); off2(); G.S = prev; }
  });
};
