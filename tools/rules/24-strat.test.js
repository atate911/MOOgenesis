// Strategic choices (js/sim/strat.js, js/ai/strat.js): an option, off by default — colony focus, galactic projects, research pacts.
module.exports = function (M, t) {
  const St = M.Sim.Strat, C = M.Sim.Colony, O = M.Sim.Orders, D = M.Sim.Diplo;
  const game = (seed, on) => M.Sim.Setup.create({ size: 'medium', opponents: 3, race: 'human', seed: seed || 'st', difficulty: 'average', options: on === false ? {} : { strategic: true } });
  const home = (S, E) => S.planets[E.capital];
  const ticks = (S, n) => { const R = M.RNG.create('tk'); for (let i = 0; i < n; i++) St.turn(S, R); };

  t.test('strat: off by default — orders refused, no menu entry, no state', () => {
    const S = game('off', false), E = S.empires[0];
    t.eq(St.on(S), false);
    t.eq(O.apply(S, E.id, { t: 'focus', planet: E.capital, focus: 'industry' }).ok, false);
    t.eq(O.apply(S, E.id, { t: 'project', id: 'cartography' }).ok, false);
    const m = D.menu(S, 0, 1); t.ok(!m.actions[0].options.some(o => o.id === 'research'));
    t.eq(home(S, E).focus, undefined); t.eq(E.projects, undefined);
  });

  t.test('strat: focus needs retooling, then changes production, growth, research and defence', () => {
    const S = game('foc'), E = S.empires[0], p = home(S, E);
    t.eq(O.apply(S, E.id, { t: 'focus', planet: p.id, focus: 'bogus' }).ok, false);
    t.eq(O.apply(S, E.id, { t: 'focus', planet: S.planets.find(q => q.owner !== E.id).id, focus: 'industry' }).ok, false, 'only your own colonies');
    t.ok(O.apply(S, E.id, { t: 'focus', planet: p.id, focus: 'industry' }).ok);
    t.eq(p.focusT, St.RETOOL); t.eq(St.prodPct(p), 0, 'nothing while retooling');
    ticks(S, St.RETOOL); t.eq(p.focusT, 0); t.eq(St.prodPct(p), 10);
    const g = C.gross(S, E, p), f = p.focus; delete p.focus; const g0 = C.gross(S, E, p); p.focus = f;
    t.eq(g, Math.floor(g0 * 110 / 100));
    p.focus = 'science'; t.eq(M.Sim.Research.planetRP(E, p, 1000), Math.floor(Math.floor(1000 * p.sliders[4] / 100) * 130 / 100));
    p.focus = 'growth'; p.pop = 10; p.popFrac = 0; p.waste = 0;
    const grow = () => { const q = JSON.parse(JSON.stringify(p)); C.growPop(S, E, q, 0); return q.pop * 10 + (q.popFrac | 0); };
    const gg = grow(); delete p.focus; const g1 = grow(); t.ok(gg > g1, 'growth focus grows faster');
    p.focus = 'fortress'; p.spendable = 400; p.sliders = [0, 100, 0, 0, 0]; p.acc.base = 0; p.bases = 0; p.baseCostPaid = 0;
    const q = JSON.parse(JSON.stringify(p)); delete q.focus; C.buildDefense(S, E, q); C.buildDefense(S, E, p);
    t.ok(p.bases * M.Sim.Design.baseCost(S, E) + p.acc.base > q.bases * M.Sim.Design.baseCost(S, E) + q.acc.base, 'fortress spends 50% more on defence');
    t.eq(St.ground(p), 15);
    t.ok(O.apply(S, E.id, { t: 'focus', planet: p.id, focus: null }).ok); t.eq(p.focus, undefined);
  });

  t.test('strat: projects are gated by tech level and reserve, bought once, and do what they say', () => {
    const S = game('prj'), E = S.empires[0];
    E.bc = 10000;
    t.ok(/tech level/.test(St.canBuy(S, E, 'cartography')), 'locked at the start');
    E.research.tl = [20, 20, 20, 20, 20, 20];
    E.bc = 10; t.ok(/reserve/.test(St.canBuy(S, E, 'cartography'))); E.bc = 10000;
    const r = O.apply(S, E.id, { t: 'project', id: 'cartography' });
    t.ok(r.ok); t.eq(E.bc, 10000 - 150); t.ok(E.explored.every(x => x === 1), 'every star charted');
    t.eq(O.apply(S, E.id, { t: 'project', id: 'cartography' }).ok, false, 'only once');
    const p = home(S, E), mp = p.mp3;
    t.ok(O.apply(S, E.id, { t: 'project', id: 'habitats' }).ok); t.ok(p.mp3 >= Math.min(300, mp + 3), 'max population raised'); t.ok(p.xi && p.xi.habitats >= 3);
    E.research.total = 200; E.research.slider = [100, 0, 0, 0, 0, 0]; const inv = E.research.invest[0] | 0;
    t.ok(O.apply(S, E.id, { t: 'project', id: 'archive' }).ok); t.eq(E.research.invest[0], inv + 600);
    for (const X of S.empires) if (X.id !== E.id) { E.relations[X.id].contact = true; X.relations[E.id].contact = true; }
    const before = S.empires[1].relations[0].rel1;
    t.ok(O.apply(S, E.id, { t: 'project', id: 'envoys' }).ok); t.ok(S.empires[1].relations[0].rel1 > before, 'relations improved');
  });

  t.test('strat: research pacts — proposed in the audience, +5% research each, ended by war', () => {
    const S = game('pct'), H = S.empires[0];
    const r = H.relations[1], ra = S.empires[1].relations[0];
    r.contact = ra.contact = true; r.rel1 = ra.rel1 = 60; r.moodTech = ra.moodTech = 200; r.trust = 50;
    t.ok(D.menu(S, 0, 1).actions[0].options.some(o => o.id === 'research' && o.enabled));
    let res = null; for (let i = 0; i < 20 && !(res && res.accepted); i++) { r.moodTech = 200; res = D.propose(S, 0, 1, { kind: 'research' }); }
    t.ok(res && res.accepted, 'a friendly empire signs'); t.ok(St.hasPact(S, 0, 1) && St.hasPact(S, 1, 0));
    t.eq(D.propose(S, 0, 1, { kind: 'research' }).ok, false, 'not twice');
    M.Sim.Econ.stepResearchTotal(S); const withPact = H.research.total;
    St.setPact(S, 0, 1, false); M.Sim.Econ.stepResearchTotal(S); const without = H.research.total; St.setPact(S, 0, 1, true);
    t.eq(withPact, Math.floor(without * 105 / 100));
    D.startWar(S, 1, 0, 'test'); t.ok(!St.hasPact(S, 0, 1), 'war ends it');
    // AI ↔ AI: friends form pacts on their own
    const a = S.empires[2].relations[3], b = S.empires[3].relations[2];
    a.contact = b.contact = true; a.rel1 = b.rel1 = 80;
    ticks(S, 200); t.ok(St.hasPact(S, 2, 3));
    a.rel1 = -50; ticks(S, 1); t.ok(!St.hasPact(S, 2, 3), 'a soured relation ends it');
  });

  t.test('strat: the AI picks a focus for its colonies', () => {
    const S = game('ai'), E = S.empires[1];
    const orders = M.AI.plan(S, E.id).filter(o => o.t === 'focus');
    t.ok(orders.some(o => o.planet === E.capital && o.focus === 'industry'), 'capital → industry');
    const S2 = game('ai', false); t.eq(M.AI.plan(S2, 1).filter(o => o.t === 'focus' || o.t === 'project').length, 0, 'nothing when the option is off');
  });
};
