// The GNN broadcast filter (js/sim/news.js broadcastFilter): only what changes the player's game interrupts them; everything is archived.
module.exports = function (M, t) {
  const Sim = M.Sim, N = Sim.News, D = Sim.Diplo, Ev = Sim.Ev;
  const game = (seed, o) => Sim.Setup.create(Object.assign({ size: 'medium', difficulty: 'average', opponents: 4, race: 'human', seed: seed || 'np' }, o || {}));
  const R = S => M.RNG.bind(S.rs);
  const meetAll = S => { for (const a of S.empires) for (const b of S.empires) if (a.id !== b.id) D.rec(S, a.id, b.id).contact = true; };
  const cats = g => (g ? g.items.map(i => i.cat) : []);

  t.test('war and peace between the same AI pair in one turn: no newscast (net state unchanged), both archived', () => {
    const S = game('np1'); meetAll(S); S.newsLog = [];
    D.startWar(S, 1, 2, 'test'); D.stopWar(S, 1, 2);
    t.eq(N.compile(S, R(S)), null);
    t.ok(S.newsLog.some(n => n.cat === 'warDeclared') && S.newsLog.some(n => n.cat === 'peaceTreaty'), 'archived');
  });

  t.test('war then an instant alliance in the same turn: no war on the news', () => {
    const S = game('np2'); meetAll(S);
    D.startWar(S, 1, 2, 'test'); D.setTreaty ? D.setTreaty(S, 1, 2, D.T.ALLIANCE) : (D.rec(S, 1, 2).treaty = D.rec(S, 2, 1).treaty = D.T.ALLIANCE);
    t.eq(cats(N.compile(S, R(S))).indexOf('warDeclared'), -1);
  });

  t.test('a lasting AI-vs-AI war between empires the player has met is news; once per pair per cool-down', () => {
    const S = game('np3'); meetAll(S);
    D.startWar(S, 1, 2, 'test');
    t.eq(cats(N.compile(S, R(S))).join(','), 'warDeclared');
    D.stopWar(S, 1, 2); N.compile(S, R(S));
    S.turn += 3; D.startWar(S, 1, 2, 'again');
    t.eq(N.compile(S, R(S)), null, 'the same pair again within the cool-down: archived');
    D.stopWar(S, 1, 2); N.compile(S, R(S));
    S.turn += N.POLICY.WAR_COOLDOWN; D.startWar(S, 1, 2, 'later');
    t.eq(cats(N.compile(S, R(S))).join(','), 'warDeclared', 'after the cool-down it is news again');
  });

  t.test('at most WAR_MAX new wars per bulletin (alliance call-ups cascade)', () => {
    const S = game('np4'); meetAll(S);
    D.startWar(S, 1, 2, 'a'); D.startWar(S, 3, 2, 'b'); D.startWar(S, 4, 2, 'c');
    t.eq(cats(N.compile(S, R(S))).filter(c => c === 'warDeclared').length, N.POLICY.WAR_MAX);
  });

  t.test('wars between empires the player has not met, and wars the player is party to, are archived', () => {
    const S = game('np5');
    D.startWar(S, 1, 2, 'unknown');
    t.eq(N.compile(S, R(S)), null, 'no contact with them');
    meetAll(S); S.turn += 1;
    D.startWar(S, 3, S.playerId, 'on you');
    t.eq(N.compile(S, R(S)), null, 'the audience already told the player');
  });

  t.test('AI alliances, peace, treaties and Council outcomes are archived; an empire destroyed and a nova are news', () => {
    const S = game('np6'); meetAll(S);
    Ev.push(S, { type: 'news', cat: 'allianceFormed', empire: 1, empire2: 2 });
    Ev.push(S, { type: 'news', cat: 'emperorElected', empire: 1 });
    Ev.push(S, { type: 'news', cat: 'coup', kind: 'coup', stage: 'ai', empire: 2, headline: 'A coup in the AI empire.' });
    t.eq(N.compile(S, R(S)), null);
    Ev.push(S, { type: 'news', cat: 'systemNova', kind: 'nova', stage: 'end', empire: 2, planet: S.empires[2].capital, importance: 2, headline: 'The star has gone nova!' });
    Ev.push(S, { type: 'news', cat: 'plague', kind: 'plague', stage: 'start', empire: 3, planet: S.empires[3].capital, importance: 1, headline: 'Plague strikes.' });
    t.eq(cats(N.compile(S, R(S))).join(','), 'systemNova', 'the nova only; the AI plague is archived');
  });

  t.test('a colony wiped out in a war is archived (late wars produced 10-25 a stretch); a comet strike still airs', () => {
    const S = game('np7'); meetAll(S);
    Ev.push(S, { type: 'news', cat: 'planetDestroyed', empire: 1, empire2: 2, planet: S.empires[2].capital, star: S.empires[2].capital });
    t.eq(N.compile(S, R(S)), null, 'war wipe archived');
    Ev.push(S, { type: 'news', cat: 'planetDestroyed', kind: 'comet', stage: 'end', empire: 3, planet: S.empires[3].capital, importance: 2, headline: 'The comet strikes.' });
    t.eq(cats(N.compile(S, R(S))).join(','), 'planetDestroyed', 'the comet strike airs');
  });
};
