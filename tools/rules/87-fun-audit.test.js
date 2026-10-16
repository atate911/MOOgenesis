// Regression tests for the fun audit (tools/handoff/fun-audit-2026-10.md): the GNN news policy (what is broadcast vs archived, ready-made
// headlines) and the original's end-of-turn planet reports (population maximum, planetary shield, eco projects, stargate).
module.exports = function (M, t) {
  const Sim = M.Sim, N = Sim.News, C = Sim.Colony, Ev = Sim.Ev;
  const game = (seed, o) => Sim.Setup.create(Object.assign({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: seed || 'fun' }, o || {}));
  const me = S => S.empires[S.playerId];
  const R = S => M.RNG.bind(S.rs);
  const notices = (S, kind) => (S.ev || []).filter(e => e.type === 'notice' && e.kind === kind);

  t.test('GNN: AI-vs-AI fleet kills, battles, first contacts, colonies and treaties are archived, never broadcast; wars are', () => {
    const S = game('gnn1');
    Ev.push(S, { type: 'news', cat: 'fleetDestroyed', empire: 1, empire2: 2, star: 0, ships: 3 });
    Ev.push(S, { type: 'news', cat: 'battleWon', empire: 1, empire2: 2, star: 0 });
    Ev.push(S, { type: 'news', cat: 'firstContact', empire: 1, empire2: 2 });
    Ev.push(S, { type: 'news', cat: 'colonyFounded', empire: 1, planet: 0 });
    Ev.push(S, { type: 'news', cat: 'napSigned', empire: 1, empire2: 2 });
    t.eq(N.compile(S, R(S)), null, 'nothing to broadcast');
    t.eq((S.newsLog || []).length, 5, 'all five archived');
    Ev.push(S, { type: 'news', cat: 'warDeclared', empire: 1, empire2: 2 });
    Ev.push(S, { type: 'news', cat: 'fleetDestroyed', empire: 2, empire2: 1, star: 1, ships: 1 });
    const g = N.compile(S, R(S));
    t.ok(g && g.type === 'gnn', 'a war is news');
    t.eq(g.items.length, 1, 'the archived skirmish does not ride along'); t.eq(g.items[0].cat, 'warDeclared'); t.eq(g.items[0].importance, 2);
    t.eq(S.newsLog.length, 7, 'both archived');
  });

  t.test('GNN: an AI-vs-AI conquest is news, a conquest the human is party to is not (the ground scene already showed it)', () => {
    const S = game('gnn2');
    Ev.push(S, { type: 'news', cat: 'invasionSuccess', empire: 1, empire2: 0, planet: me(S).capital });
    t.eq(N.compile(S, R(S)), null);
    Ev.push(S, { type: 'news', cat: 'invasionSuccess', empire: 1, empire2: 2, planet: S.empires[2].capital });
    const g = N.compile(S, R(S)); t.ok(g && g.items.length === 1 && g.items[0].cat === 'invasionSuccess');
  });

  t.test('GNN: a category without a template uses the ready-made headline (random events of other empires reach the news)', () => {
    const S = game('gnn3');
    Ev.push(S, { type: 'news', cat: 'earthquake', kind: 'quake', headline: 'An earthquake devastates Altair IV.', empire: 1, planet: S.empires[1].capital, importance: 1 });
    const g = N.compile(S, R(S));
    t.ok(g && g.items.length === 1); t.eq(g.items[0].headline, 'An earthquake devastates Altair IV.');
    t.ok(!M.Data.text.news.earthquake, 'no template exists for it');
  });

  t.test('GNN: an explicit importance 0 (the human victim already saw the event card) archives without a broadcast', () => {
    const S = game('gnn4');
    Ev.push(S, { type: 'news', cat: 'plague', empire: 0, planet: me(S).capital, importance: 0 });
    t.eq(N.compile(S, R(S)), null); t.eq(S.newsLog.length, 1);
  });

  t.test('events: a human victim gets the card and the news item is archived; another empire\'s event is broadcast', () => {
    const S = game('evt'), out = [];
    S.ev = []; S.newsLog = [];
    Sim.Events.start(S, R(S), 13, 0, S.planets[me(S).capital], out);                       // 13 = fertile soil ("enviro") on the human's homeworld
    t.eq(out.length, 1, 'the human sees the event card'); t.eq(out[0].type, 'event');
    const mine = S.ev.filter(e => e.type === 'news'); t.eq(mine.length, 1); t.eq(mine[0].importance, 0, 'archived, not broadcast again');
    t.eq(N.compile(S, R(S)), null); t.eq(S.newsLog.length, 1);
    const out2 = [];
    Sim.Events.start(S, R(S), 14, 1, S.planets[S.empires[1].capital], out2);              // 14 = rich minerals found on an AI homeworld
    t.eq(out2.length, 0, 'no card for another empire\'s event');
    const g = N.compile(S, R(S));
    t.ok(g && g.items.length === 1, 'but it is news'); t.ok(/mineral|rich/i.test(g.items[0].headline), g.items[0].headline);
  });

  t.test('report: a colony filling up reports its population maximum once (the turn it crosses)', () => {
    const S = game('pop'), E = me(S), p = S.planets[E.capital];
    S.ev = []; p.mp3 = 50; p.pop = 49; p.popFrac = 9; p.waste = 0;
    C.growPop(S, E, p, 0);
    t.eq(p.pop, 50); t.eq(notices(S, 'popMax').length, 1); t.eq(notices(S, 'popMax')[0].planet, p.id);
    C.growPop(S, E, p, 0);
    t.eq(notices(S, 'popMax').length, 1, 'not repeated while it stays full');
    const A = S.empires[1], q = S.planets[A.capital]; q.mp3 = 50; q.pop = 49; q.popFrac = 9; q.waste = 0;
    C.growPop(S, A, q, 0); t.eq(notices(S, 'popMax').length, 1, 'AI colonies report nothing');
  });

  t.test('report: a finished planetary shield, a soil project and a stargate are reported', () => {
    const S = game('sh'), E = me(S), p = S.planets[E.capital];
    S.ev = []; E.mods.planetShield = 5; E.mods.planetShieldCost = E.mods.planetShieldCost || 500; p.sliders = [0, 100, 0, 0, 0]; p.spendable = 5000; p.acc.base = 0; p.acc.shield = 0; p.bases = 0;
    C.buildDefense(S, E, p);
    t.eq(p.shield, 5); t.eq(notices(S, 'shieldDone').length, 1); t.eq(notices(S, 'shieldDone')[0].shield, 5);
    C.soilEnrich(S, E, p, 'fertile');
    t.eq(p.growth, 'fertile'); t.eq(notices(S, 'ecoDone').length, 1); t.eq(notices(S, 'ecoDone')[0].growth, 'fertile');
    p.build = -1; p.acc.ship = 3000; p.sliders = [0, 0, 100, 0, 0]; p.spendable = 0;
    C.buildShips(S, E, p, []);
    t.ok(p.stargate, 'stargate built'); t.eq(notices(S, 'stargate').length, 1);
    t.ok((S.ev || []).every(e => e.type !== 'planet'), 'no orphan planet events are left behind');
  });
};
