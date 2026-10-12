// Galactic Council + victory checks (research/05 §6 + §8, research/08 §11, research/01 §5.10): schedule, vote weights, 2/3 maths, AI ballots, accept/defy, Final War, endings.
module.exports = function (M, t) {
  const C = M.Sim.Council, V = M.Sim.Victory;

  // ---- fixtures -------------------------------------------------------------------------------------------------------------------------------
  function mk(extra) { return M.Sim.Setup.create(Object.assign({ size: 'medium', opponents: 3, race: 'human', seed: 'cn-fx', difficulty: 'average', playerAI: true }, extra)); }
  function scripted(seq, seed) {
    const base = M.RNG.create(seed || 'scripted'), q = seq.slice();
    const r = { int(lo, hi) { if (q.length) { const v = q.shift(); return v < lo ? lo : v > hi ? hi : v; } return base.int(lo, hi); }, dice(n, s) { let tot = 0; for (let i = 0; i < n; i++) tot += r.int(1, s); return tot; }, next() { return base.next(); } };
    return r;
  }
  // a fake Diplo: attitudes/treaties from tables, every incident recorded
  function mockDiplo(opt) {
    opt = opt || {}; const log = [], calls = { finalWar: [] };
    const rel = opt.rel || {}, tr = opt.treaty || {};
    const d = {
      log, calls,
      status: (S, a, b) => ({ attitude: (rel[a + '>' + b] | 0), treaty: (tr[a + '>' + b] | 0) }),
      isAllied: (S, a, b) => (tr[a + '>' + b] | 0) === 2,
      atWar: (S, a, b) => (tr[a + '>' + b] | 0) >= 3,
      hasContact: () => true,
      incident: (S, kind, from, to, dv, info) => { log.push({ kind, from, to, dv, info }); },
      finalWar: (S, refusers) => { calls.finalWar.push(refusers.slice()); },
    };
    return d;
  }
  function withDiplo(mock, fn) { const old = M.Sim.Diplo; M.Sim.Diplo = mock; try { return fn(mock); } finally { if (old === undefined) delete M.Sim.Diplo; else M.Sim.Diplo = old; } }   // mock === undefined: run WITHOUT a Diplo module
  // give every empire exactly `votes[i]` votes (pop = 100 x votes) and colonise enough stars for a council
  function setup(S, votes) {
    S.empires.forEach((E, i) => { const p = S.planets[E.capital]; p.pop = (votes[i] || 0) * 100; p.unrest = 0; p.rebels = 0; E.race = 'psilon'; });
    let n = S.planets.filter(p => p.owner >= 0).length;
    for (const p of S.planets) { if (n >= C.threshold(S)) break; if (p.owner < 0 && p.id !== S.orion) { p.owner = 0; p.pop = 0; p.unrest = 0; n++; } }
    S.year = 25; S.council = { held: false, lastYear: 0, emperor: -1 };
    return S;
  }
  const tally = info => info.ballots.map(b => b.empire + '>' + b.choice).join(' ');
  const techs = E => E.research.completed.reduce((a, l) => a + l.length, 0);

  // ---- arithmetic -----------------------------------------------------------------------------------------------------------------------------
  t.test('council: the winner needs ((total + 1) x 2) / 3 votes (14 -> 10)', () => {
    t.eq(C.need(14), 10); t.eq(C.need(3), 2); t.eq(C.need(2), 2); t.eq(C.need(30), 20); t.eq(C.need(31), 21); t.eq(C.need(1), 1);
    for (let n = 1; n < 300; n++) t.eq(C.need(n), Math.floor((n + 1) * 2 / 3));
  });
  t.test('council: first session needs 2/3 of the stars colonised — 16 / 32 / 46 / 72 stars on small / medium / large / huge', () => {
    for (const [size, want] of [['small', 16], ['medium', 32], ['large', 46], ['huge', 72]]) {
      const S = M.Sim.Setup.create({ size, opponents: 3, race: 'human', seed: 'thr', playerAI: true });
      t.eq(C.threshold(S), want, size);
    }
  });
  t.test('council: vote weight = ceil(population of non-rebelling planets / 100), eliminated empires 0', () => {
    const S = mk(); setup(S, [0, 0, 0, 0]);
    const set = (id, pop) => { S.planets[S.empires[id].capital].pop = pop; };
    set(0, 1); t.eq(C.electorate(S)[0].votes, 1); set(0, 100); t.eq(C.electorate(S)[0].votes, 1); set(0, 101); t.eq(C.electorate(S)[0].votes, 2);
    set(0, 250); t.eq(C.electorate(S)[0].votes, 3); set(0, 0); t.eq(C.electorate(S)[0].votes, 0);
    // fractions of different planets add up before the rounding
    const mine = S.planets.filter(p => p.owner === 0); mine.forEach(p => { p.pop = 0; }); mine[0].pop = 60; mine[1].pop = 60; t.eq(C.electorate(S)[0].votes, 2);
    mine[1].unrest = 2; t.eq(C.electorate(S)[0].votes, 1, 'rebelling planets do not vote');
    S.empires[0].alive = false; t.eq(C.electorate(S)[0].votes, 0);
  });

  // ---- schedule -------------------------------------------------------------------------------------------------------------------------------
  t.test('council.due: needs 2/3 colonised, 3+ empires alive and (never held or year % 25 == 0)', () => {
    const S = setup(mk(), [5, 4, 3, 2]);
    t.ok(C.due(S), 'first session at once when 2/3 are colonised, any year'); S.year = 13; t.ok(C.due(S));
    for (const p of S.planets) if (p.owner >= 0 && p.id !== S.empires[0].capital && p.id !== S.empires[1].capital && p.id !== S.empires[2].capital && p.id !== S.empires[3].capital) p.owner = -1;
    t.ok(!C.due(S), 'not enough colonised stars');
    setup(S, [5, 4, 3, 2]); S.empires[3].alive = false; t.ok(C.due(S), 'three empires alive is enough'); S.empires[2].alive = false; t.ok(!C.due(S), 'two empires: no council');
  });
  t.test('council.due: later sessions only on years divisible by 25, never twice in a year, never after a verdict', () => {
    const S = setup(mk(), [5, 4, 3, 2]); const R = M.RNG.bind(S.rs);
    const info = C.convene(S, R); t.ok(S.council.held); t.eq(S.council.lastYear, 25);
    t.ok(!C.due(S), 'same year');
    S.year = 26; t.ok(!C.due(S)); S.year = 49; t.ok(!C.due(S)); S.year = 50; t.ok(C.due(S)); S.year = 75; t.ok(C.due(S)); S.year = 100; t.ok(C.due(S));
    void info; S.gameOver = { reason: 'council', winner: 0 }; t.ok(!C.due(S), 'game over');
    delete S.gameOver; S.council.finalWar = { refusers: [0] }; t.ok(!C.due(S), 'final war: no more councils');
  });

  // ---- convening --------------------------------------------------------------------------------------------------------------------------------
  t.test('council.convene: the two biggest empires are the candidates (ties keep empire order), electorate and need are reported', () => {
    const S = setup(mk(), [3, 7, 5, 5]), R = M.RNG.bind(S.rs);
    const info = C.convene(S, R);
    t.deep(info.candidates, [1, 2]); t.eq(info.total, 20); t.eq(info.need, 14); t.eq(info.electorate.length, 4); t.eq(info.electorate[1].votes, 7);
    t.ok(info.first); t.eq(info.humans.length, 0); t.deep(info.order, [0, 1, 2, 3]);
    t.deep(info.choices.map(c => c.empire), [1, 2, -1]);
    const T2 = setup(mk({ seed: 'cn-tie' }), [4, 4, 4, 1]); t.deep(C.convene(T2, M.RNG.bind(T2.rs)).candidates, [0, 1]);
  });
  t.test('council.convene: an AI leader with a human runner-up lists the human first; the human votes last', () => {
    const S = setup(mk({ playerAI: false }), [5, 3, 8, 1]), R = M.RNG.bind(S.rs);
    const info = C.convene(S, R);
    t.deep(info.candidates, [0, 2], 'human (5 votes) is listed before the AI leader (8)');
    t.deep(info.order, [1, 2, 3, 0]); t.deep(info.humans, [{ empire: 0, votes: 5 }]);
    t.eq(info.ballots.length, 3); t.ok(info.ballots.every(b => !b.human && b.empire !== 0));
  });
  t.test('council.convene: zero-vote empires abstain', () => {
    const S = setup(mk(), [5, 5, 5, 0]), info = C.convene(S, M.RNG.bind(S.rs));
    const b = info.ballots.filter(x => x.empire === 3)[0]; t.eq(b.votes, 0); t.eq(b.choice, -1);
  });

  // ---- AI ballots (§6.3) -------------------------------------------------------------------------------------------------------------------------------
  t.test('council AI vote: a candidate votes for itself; allies back their ally; enemies vote for the other candidate', () => {
    const S = setup(mk(), [5, 5, 5, 5]), R = M.RNG.bind(S.rs);
    withDiplo(mockDiplo({ treaty: { '2>0': 2, '3>1': 3 } }), () => {
      t.eq(C.aiVote(S, S.empires[0], [0, 1], R), 0); t.eq(C.aiVote(S, S.empires[1], [0, 1], R), 1);
      t.eq(C.aiVote(S, S.empires[2], [0, 1], R), 0, 'allied with candidate 0');
      t.eq(C.aiVote(S, S.empires[3], [0, 1], R), 0, 'at war with candidate 1: the other one');
    });
    withDiplo(mockDiplo({ treaty: { '2>1': 2, '3>0': 3 } }), () => {
      t.eq(C.aiVote(S, S.empires[2], [0, 1], R), 1); t.eq(C.aiVote(S, S.empires[3], [0, 1], R), 1);
    });
    withDiplo(mockDiplo({ treaty: { '2>0': 2, '2>1': 3 } }), () => { t.eq(C.aiVote(S, S.empires[2], [0, 1], R), 0, 'ally check comes first'); });
  });
  function freq(S, voter, cand, d, n, seed) {
    const R = M.RNG.create(seed || 'f'), out = { a: 0, b: 0, abs: 0 };
    withDiplo(d, () => { for (let i = 0; i < n; i++) { const v = C.aiVote(S, S.empires[voter], cand, R); if (v === cand[0]) out.a++; else if (v === cand[1]) out.b++; else out.abs++; } });
    out.a /= n; out.b /= n; out.abs /= n; return out;
  }
  t.test('council AI vote MC: liked candidate 1 (rel +40) wins the ballot with chance (rel/4 - 1)% = 9%, the rest abstain at neutral', () => {
    const S = setup(mk(), [5, 5, 5, 5]);
    const f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 40 } }), 30000);
    t.near(f.a, 0.09, 0.008); t.near(f.b, 0, 0.0001); t.near(f.abs, 0.91, 0.008);
  });
  t.test('council AI vote MC: relation tests — c1 hated (-40) feeds c2 with (-rel/4 - 1)%; c2 hated gives c1 only (-rel/5 - 1)%; c2 liked works like c1', () => {
    const S = setup(mk(), [5, 5, 5, 5]);
    let f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': -40 } }), 30000);
    t.near(f.b, 0.09, 0.008); t.near(f.a, 0, 0.0001);
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>1': -40 } }), 30000);
    t.near(f.a, 0.07, 0.008); t.near(f.b, 0, 0.0001);                                   // -(-40)/5 = 8 -> 7%
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>1': 80 } }), 30000);
    t.near(f.b, 0.19, 0.01);                                                            // 80/4 = 20 -> 19%
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 100, '3>1': 100 } }), 30000);
    t.near(f.a, 0.24, 0.01); t.near(f.b, (1 - 0.24) * 0.24, 0.012);                    // 25 -> 24%; the second test only runs when the first fails
  });
  t.test('council AI vote MC: weights — +20 Orion owner, +20 Human race (race table councilBonus), +40 same candidate as last time', () => {
    const S = setup(mk(), [5, 5, 5, 5]);
    S.planets[S.orion].owner = 0;
    let f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 40 } }), 30000);
    t.near(f.a, 0.29, 0.01);                                                             // 10 + 20 - 1
    S.planets[S.orion].owner = -1; S.empires[0].race = 'human';
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 40 } }), 30000);
    t.near(f.a, 0.29, 0.01);
    S.empires[0].race = 'psilon'; S.council.voted = [-1, -1, -1, 0];
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 40 } }), 30000);
    t.near(f.a, 0.49, 0.01);
    S.planets[S.orion].owner = 0; S.empires[0].race = 'human';
    f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': 40 } }), 30000);
    t.near(f.a, 0.89, 0.01);                                                             // 10 + 80 - 1
    S.planets[S.orion].owner = -1;
  });
  t.test('council AI vote: the weights of the OTHER candidate feed the hate branch (c1 hated + c2 Human race -> 29%, then c2 is tested on its own)', () => {
    const S = setup(mk(), [5, 5, 5, 5]); S.empires[1].race = 'human';
    const f = freq(S, 3, [0, 1], mockDiplo({ rel: { '3>0': -40 } }), 30000);
    t.near(f.b, 0.29 + 0.71 * 0.19, 0.012);                                              // first test: 10 + w(c2 = Human race 20) - 1 = 29%; failing that, c2's own test (rel 0): 20 - 1 = 19%
  });
  t.test('council AI vote works from the placeholder E.relations when Diplo is absent', () => {
    const S = setup(mk(), [5, 5, 5, 5]);
    withDiplo(undefined, () => {
      S.empires[2].relations[0].treaty = 2; t.eq(C.aiVote(S, S.empires[2], [0, 1], M.RNG.create('p')), 0);
      S.empires[2].relations[0].treaty = 0; S.empires[2].relations[1].treaty = 3; t.eq(C.aiVote(S, S.empires[2], [0, 1], M.RNG.create('p')), 0);
    });
  });

  // ---- resolving a vote -------------------------------------------------------------------------------------------------------------------------------
  function conveneWith(S, choices, seed) {                   // convene, then overwrite the AI ballots with `choices` ({empire: choice})
    const info = C.convene(S, M.RNG.create(seed || 'cv')); for (const b of info.ballots) if (choices[b.empire] !== undefined) b.choice = choices[b.empire];
    return info;
  }
  t.test('council.resolve: tally by vote weights, winner needs 2/3 — candidate 0 is checked first', () => {
    const S = setup(mk(), [6, 5, 2, 1]);                      // total 14, need 10
    const info = conveneWith(S, { 0: 0, 1: 1, 2: 0, 3: 0 });
    const res = withDiplo(mockDiplo(), () => C.resolve(S, info, -1, M.RNG.create('r1')));
    t.deep(info.candidates, [0, 1]); t.eq(res.total, 14); t.eq(res.need, 10);
    t.eq(res.votes[0], 9); t.eq(res.votes[1], 5); t.eq(res.winner, -1); t.ok(res.noWinner); t.ok(!res.gameOver);
    const S2 = setup(mk({ seed: 'cn-fx2' }), [6, 5, 2, 1]);
    const i2 = conveneWith(S2, { 0: 0, 1: 1, 2: 0, 3: 0 });
    // candidate 1's own ballot goes to candidate 0 as well -> 6 + 5 + 2 + 1 = 14 >= 10
    i2.ballots.filter(b => b.empire === 1)[0].choice = 0;
    const r2 = withDiplo(mockDiplo(), () => C.resolve(S2, i2, -1, M.RNG.create('r2')));
    t.eq(r2.votes[0], 14); t.eq(r2.winner, 0); t.eq(S2.council.history.length, 1);
  });
  t.test('council.resolve: exactly 2/3 of the votes (10 of 14) wins, 9 does not', () => {
    for (const [mine, win] of [[10, true], [9, false]]) {
      const S = setup(mk({ seed: 'cn-' + mine }), [mine, 14 - mine, 0, 0]);
      const info = conveneWith(S, { 0: 0, 1: 1 });
      const res = withDiplo(mockDiplo(), () => C.resolve(S, info, -1, M.RNG.create('x')));
      t.eq(res.winner >= 0, win, 'votes ' + mine);
    }
  });
  t.test('council.resolve: a candidate\'s winning margin of one vote above 2/3 when abstentions shrink nothing (the total counts every empire)', () => {
    const S = setup(mk(), [9, 4, 1, 0]);                     // total 14: need 10; the abstaining 1 + 0 still count in the total
    const info = conveneWith(S, { 0: 0, 1: -1, 2: -1, 3: -1 });
    const res = withDiplo(mockDiplo(), () => C.resolve(S, info, -1, M.RNG.create('x')));
    t.eq(res.votes[0], 9); t.eq(res.winner, -1);
  });
  t.test('council.resolve: relation effects +24 for the candidate voted for, -12 for the other, -6 / -6 for abstaining', () => {
    const S = setup(mk(), [6, 5, 2, 1]);
    const info = conveneWith(S, { 0: 0, 1: 0, 2: -1, 3: 1 });
    const d = mockDiplo();
    withDiplo(d, () => C.resolve(S, info, -1, M.RNG.create('x')));
    const by = (from, to) => d.log.filter(l => l.from === from && l.to === to).map(l => l.dv);
    t.deep(by(1, 0), [24]); t.deep(by(3, 1), [24]); t.deep(by(3, 0), [-12]); t.deep(by(1, 1), [], 'a candidate has no opinion of itself');
    t.deep(by(2, 0), [-6]); t.deep(by(2, 1), [-6]);
    t.deep(by(0, 1), [-12], 'candidate 0 voted for itself: -12 towards the rival, nothing towards itself'); t.deep(by(0, 0), []);
    t.ok(d.log.every(l => l.kind === 'councilVote'));
    t.deep(S.council.voted, [0, 0, -1, 1], 'remembered for next time (+40 weight)');
  });
  t.test('council.resolve: a human ballot — candidate id, -1 / garbage = abstain; zero votes abstain automatically', () => {
    for (const [vote, want] of [[0, 0], [1, 1], [-1, -1], [2, -1], [null, -1], [undefined, -1], ['x', -1], [{ empire: 1 }, 1]]) {
      const S = setup(mk({ playerAI: false, seed: 'cn-h' }), [5, 5, 3, 3]);
      const info = C.convene(S, M.RNG.create('h'));
      const res = withDiplo(mockDiplo(), () => C.resolve(S, info, vote, M.RNG.create('x')));
      t.eq(res.ballots.filter(b => b.human)[0].choice, want, 'vote ' + JSON.stringify(vote));
    }
    const S = setup(mk({ playerAI: false, seed: 'cn-h0' }), [0, 5, 5, 3]);
    const info = C.convene(S, M.RNG.create('h')), res = withDiplo(mockDiplo(), () => C.resolve(S, info, 1, M.RNG.create('x')));
    t.eq(res.ballots.filter(b => b.human)[0].choice, -1);
  });
  t.test('council: autoVote answers for the human with the AI rules (a candidate id or -1), deterministically', () => {
    const S = setup(mk({ playerAI: false }), [5, 6, 7, 1]); const info = C.convene(S, M.RNG.create('a'));
    const v = withDiplo(mockDiplo({ treaty: { '0>2': 2 } }), () => C.autoVote(S, info));
    t.ok(info.candidates.indexOf(v) >= 0 || v === -1); t.eq(v, 2, 'allied with candidate 2');
    const S2 = setup(mk({ seed: 'cn-av' }), [5, 6, 7, 1]); const i2 = C.convene(S2, M.RNG.create('a')); t.eq(C.autoVote(S2, i2), -1, 'no human: nothing to vote');
  });

  // ---- accept / defy and the endings ---------------------------------------------------------------------------------------------------------------
  function elected(winnerId, extra) {                       // a council that elects `winnerId` with everybody's vote
    const S = setup(mk(Object.assign({ playerAI: false }, extra || {})), winnerId === 0 ? [8, 4, 2, 0] : [4, 8, 2, 0]);
    const info = C.convene(S, M.RNG.create('e'));
    for (const b of info.ballots) b.choice = winnerId;
    const res = C.resolve(S, info, winnerId, M.RNG.create('x'));
    return { S, info, res };
  }
  t.test('council: electing the human asks accept / defy; accepting = the good ending (reason "council")', () => {
    const { S, info, res } = withDiplo(mockDiplo(), () => elected(0));
    t.eq(res.winner, 0); t.deep(res.needsAnswer, ['accept', 'defy']); t.ok(!res.gameOver); t.ok(res.humanElected);
    t.eq(S.council.pending.winner, 0);
    const same = C.finish(S, info, true);
    t.eq(same, res, 'finish() mutates the very object turn.js holds'); t.ok(res.gameOver); t.eq(res.reason, 'council'); t.eq(res.winner, 0); t.eq(res.accepted, true); t.eq(res.needsAnswer, null);
    t.deep(V.check(S), { ending: 'good', reason: 'council', winner: 0, council: true, year: 25 });
    t.ok(!S.council.pending); t.eq(S.council.emperor, 0);
  });
  t.test('council: an AI elected and accepted = the exile ending; result.finish() is the same call', () => {
    const { S, res } = withDiplo(mockDiplo(), () => elected(1));
    t.ok(res.needsAnswer); res.finish('accept');
    t.ok(res.gameOver); t.eq(res.reason, 'exile'); t.eq(res.winner, 1);
    t.eq(V.check(S).ending, 'exile'); t.eq(V.check(S).winner, 1);
    const p = V.payload(S, V.check(S)); t.eq(p.type, 'gameover'); t.eq(p.reason, 'exile'); t.eq(p.winnerRace, S.empires[1].race); t.ok(!p.playerWon);
  });
  t.test('council: with no human alive every ruling is accepted at once (soak games end by council)', () => {
    const S = setup(mk(), [8, 4, 2, 0]), info = C.convene(S, M.RNG.create('e'));
    for (const b of info.ballots) b.choice = 0;
    const res = withDiplo(mockDiplo(), () => C.resolve(S, info, -1, M.RNG.create('x')));
    t.eq(res.needsAnswer, null); t.ok(res.gameOver); t.eq(res.reason, 'council'); t.eq(res.winner, 0); t.eq(S.gameOver.winner, 0);
    t.ok(!S.council.pending);
  });
  t.test('council: defying the ruling starts the Final War — refusers vs everybody, the others allied; a human winner hands the throne to the other candidate', () => {
    const d = mockDiplo();
    const { S, info, res } = withDiplo(d, () => elected(0));
    withDiplo(d, () => { C.finish(S, info, false); });
    t.ok(!res.gameOver); t.ok(res.finalWar); t.eq(res.accepted, false); t.eq(res.winner, 1, 'the other candidate becomes the High Master');
    t.deep(S.council.finalWar, { refusers: [0], winner: 1, year: 25 }); t.ok(C.isFinalWar(S)); t.deep(C.refusers(S), [0]);
    t.deep(d.calls.finalWar[0], [0]);
    t.ok(!S.gameOver); t.eq(S.council.emperor, 1);
    t.ok(!C.due(S), 'no more councils in the Final War'); t.eq(V.check(S), null);
  });
  t.test('council: defying an AI ruling keeps that AI as the winner; the Final War also works on the placeholder relations', () => {
    const { S, info, res } = withDiplo(undefined, () => elected(1));
    withDiplo(undefined, () => { C.finish(S, info, 'defy'); });
    t.eq(res.winner, 1); t.ok(res.finalWar);
    const r = S.empires[0].relations, q = S.empires[2].relations;
    t.eq(r[1].treaty, 4); t.eq(r[1].attitude, -100); t.eq(q[1].treaty, 2); t.eq(q[1].attitude, 100); t.eq(q[3].treaty, 2); t.eq(q[0].treaty, 4);
  });
  t.test('council: in the Final War the non-refusers pool every technology (dead empires included), refusers get nothing', () => {
    const d = mockDiplo();
    const { S, info } = withDiplo(d, () => elected(1));
    const E = S.empires, T = M.Data.Techs;
    M.Sim.Research.grant(S, E[1], 0, 8, 't'); M.Sim.Research.grant(S, E[2], 1, 3, 't'); M.Sim.Research.grant(S, E[3], 4, 6, 't'); M.Sim.Research.grant(S, E[0], 2, 4, 't');
    E[3].alive = false;                                       // known 1oom bug reproduced: the dead keep contributing
    const human0 = techs(E[0]);
    withDiplo(d, () => { C.finish(S, info, false); });
    for (const id of [1, 2]) { t.ok(E[id].research.completed[0].indexOf(8) >= 0, 'cm 8 on ' + id); t.ok(E[id].research.completed[1].indexOf(3) >= 0); t.ok(E[id].research.completed[4].indexOf(6) >= 0); }
    t.ok(E[0].research.completed[0].indexOf(8) < 0 && techs(E[0]) === human0, 'the refuser neither gives nor receives');
    t.ok(E[1].research.completed[2].indexOf(4) < 0, 'the refuser gave nothing');
    // new techs keep flowing every turn
    M.Sim.Research.grant(S, E[1], 5, 5, 't'); withDiplo(d, () => C.finalWarTurn(S));
    t.ok(E[2].research.completed[5].indexOf(5) >= 0);
    void T;
  });
  t.test('council: with Diplo.finalWar + finalWarShare present the Council only notifies them (no second pooling)', () => {
    const d = mockDiplo(); let shared = 0; d.finalWarShare = () => { shared++; return 0; };
    const { S, info } = withDiplo(d, () => elected(1));
    M.Sim.Research.grant(S, S.empires[1], 0, 8, 't');
    withDiplo(d, () => { C.finish(S, info, false); C.finalWarTurn(S); C.finalWarTurn(S); });
    t.eq(shared, 1, 'once at the defiance; Diplo.economyTurn does the rest'); t.deep(d.calls.finalWar[0], [0]);
    t.ok(S.empires[2].research.completed[0].indexOf(8) < 0, 'the Council itself pooled nothing');
  });
  t.test('council: an unanswered ruling is accepted automatically at the next due() (ESC = yes)', () => {
    const { S, res } = withDiplo(mockDiplo(), () => elected(1));
    t.ok(res.needsAnswer && !res.gameOver);
    S.year = 50; t.ok(!C.due(S), 'the verdict ends the council era');
    t.ok(res.gameOver === false, 'the stale result object cannot know'); t.eq(S.gameOver.reason, 'exile'); t.ok(S.council.over); t.ok(!S.council.pending);
  });
  t.test('council: no winner leaves everything as it was and the next session waits for a year divisible by 25', () => {
    const S = setup(mk({ playerAI: false }), [4, 4, 4, 4]), info = C.convene(S, M.RNG.create('n'));
    for (const b of info.ballots) b.choice = -1;
    const res = withDiplo(mockDiplo(), () => C.resolve(S, info, -1, M.RNG.create('x')));
    t.eq(res.winner, -1); t.ok(res.noWinner); t.eq(res.needsAnswer, null); t.ok(!res.gameOver); t.ok(!S.gameOver); t.ok(!S.council.pending);
    S.year = 26; t.ok(!C.due(S)); S.year = 50; t.ok(C.due(S));
  });
  t.test('council: determinism — same state and seed give the same ballots and result', () => {
    function run() {
      const S = setup(mk({ playerAI: false, seed: 'cn-det' }), [5, 6, 4, 3]);
      const d = mockDiplo({ rel: { '2>0': 30, '2>1': -20, '3>0': -50, '3>1': 60 } });
      return withDiplo(d, () => { const info = C.convene(S, M.RNG.bind(S.rs)); const res = C.resolve(S, info, 0, M.RNG.bind(S.rs)); return JSON.stringify([info.ballots, res.tally, res.winner, S.council.voted, d.log]); });
    }
    t.eq(run(), run());
  });
  t.test('council: the whole state stays JSON-safe', () => {
    const { S, info } = withDiplo(mockDiplo(), () => elected(0));
    JSON.parse(JSON.stringify(S)); JSON.parse(JSON.stringify(info)); C.finish(S, info, false); JSON.parse(JSON.stringify(S));
  });

  // ---- victory & defeat (§8.1) ---------------------------------------------------------------------------------------------------------------------
  t.test('victory: one empire owning every planet = conquest (the tyrant ending)', () => {
    const S = setup(mk({ playerAI: false }), [5, 5, 5, 5]);
    for (const p of S.planets) if (p.owner >= 0) p.owner = 2;
    const v = V.check(S); t.eq(v.reason, 'conquest'); t.eq(v.winner, 2); t.eq(v.ending, 'tyrant');
    const p = V.payload(S, v); t.eq(p.type, 'gameover'); t.eq(p.ending, 'tyrant'); t.ok(!p.playerWon);
    for (const q of S.planets) if (q.owner === 2) q.owner = 0; t.eq(V.check(S).winner, 0); t.ok(V.payload(S, V.check(S)).playerWon);
  });
  t.test('victory: the human owning no non-rebelling planet = funeral; AI-only games never end that way', () => {
    const S = setup(mk({ playerAI: false }), [5, 5, 5, 5]);
    t.eq(V.check(S), null);
    for (const p of S.planets) if (p.owner === 0) p.unrest = 2;
    let v = V.check(S); t.eq(v.reason, 'defeat'); t.eq(v.ending, 'funeral');
    for (const p of S.planets) if (p.owner === 0) { p.unrest = 0; p.owner = -1; }
    v = V.check(S); t.eq(v.reason, 'defeat');
    const A = setup(mk({ playerAI: true, seed: 'cn-ai' }), [5, 5, 5, 5]);
    for (const p of A.planets) if (p.owner === 0) p.owner = -1;
    t.eq(V.check(A), null, 'no human, no funeral');
  });
  t.test('victory: a stored council verdict wins over the planet counts', () => {
    const S = setup(mk(), [5, 5, 5, 5]); S.gameOver = { reason: 'exile', winner: 3 };
    t.eq(V.check(S).reason, 'exile'); t.eq(V.check(S).ending, 'exile');
  });
};
