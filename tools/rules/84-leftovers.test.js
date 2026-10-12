// Session-4 leftovers: DEAD_OWNER (transports of a dead empire), per-empire objective, save meta calendar year, human spy choice interrupts reachable through Turn.run,
// base / transport HP and ground gear from the LAST acquired tech (research/03-verification #6, G2).
module.exports = function (M, t) {
  const mk = o => M.Sim.Setup.create(Object.assign({ size: 'small', opponents: 2, race: 'human', seed: 'lo-1', difficulty: 'average' }, o));

  t.test('leftovers: Turn.checkDeaths removes the dead empire\'s transports; a dead owner\'s landing never invades (soak DEAD_OWNER)', () => {
    const S = mk(), A = S.empires[1], V = S.empires[2];
    const vp = S.planets.find(p => p.owner === V.id);
    for (const p of S.planets) if (p.owner === A.id) { p.owner = -1; p.pop = 0; }
    S.fleets = S.fleets.filter(f => f.owner !== A.id);
    const st = S.stars[vp.starId];
    S.trans = [{ id: 9001, owner: A.id, from: 0, to: vp.starId, n: 40, x: st.x, y: st.y, speed: 1 }];
    M.Sim.Turn.checkDeaths(S);
    t.eq(A.alive, false); t.eq(S.trans.length, 0, 'transports vanish with the empire');
    S.trans = [{ id: 9002, owner: A.id, from: 0, to: vp.starId, n: 40, x: st.x, y: st.y, speed: 1 }];      // one that slipped through
    const out = M.Sim.Fleet.landTransports(S, S.trans.slice());
    t.eq(out.length, 1); t.eq(out[0].kind, 'lost');
    t.ok(S.planets.every(p => p.owner < 0 || S.empires[p.owner].alive), 'no planet owned by a dead empire');
  });

  t.test('leftovers: Setup rolls the slot-0 objective when the AI plays it (playerAI), the human keeps 0', () => {
    let seen = {};
    for (let i = 0; i < 40; i++) { const S = mk({ seed: 'obj' + i, playerAI: true }); seen[S.empires[0].objective] = 1; t.ok(S.empires[0].objective >= 0 && S.empires[0].objective <= 5); }
    t.ok(Object.keys(seen).length > 1, 'AI-played slot 0 gets varied objectives');
    for (let i = 0; i < 10; i++) t.eq(mk({ seed: 'obj' + i }).empires[0].objective, 0);
    const a = mk({ seed: 'obj3', playerAI: true }), b = mk({ seed: 'obj3', playerAI: true });
    t.eq(a.empires[0].objective, b.empires[0].objective, 'deterministic');
  });

  t.test('leftovers: Save.meta stores the calendar year (Config.displayYear), not the S.year counter', () => {
    const S = mk(); S.year = 17;
    const m = M.Save.meta(S);
    t.eq(m.year, M.Data.Config.displayYear(S)); t.ok(m.year > 2000, 'calendar year');
    t.eq(m.turn, S.turn);
  });

  t.test('leftovers: a human spy network in Espionage mode reaches spyStealChoice / spySabotageChoice through Turn.run', () => {
    const got = {};
    for (const mode of [1, 2]) {
      const S = mk({ seed: 'spy-reach', opponents: 2 }), A = S.empires[0];
      for (const E of S.empires) { E.research.tl[0] = 20; E.security = 0; }
      for (let turn = 0; turn < 120 && !got[mode]; turn++) {
        for (const E of S.empires) if (E.id) { A.spies[E.id] = Math.max(A.spies[E.id] | 0, 12); A.spyMode[E.id] = mode; }
        const gen = M.Sim.Turn.run(S); let r = gen.next();
        while (!r.done) {
          const it = r.value; let ans;
          switch (it.type) {
            case 'aiPlan': ans = {}; for (const e of S.empires) if (e.alive && !e.human) ans[e.id] = M.AI.plan(S, e.id, M.AI.seedFor(S, e.id)); break;
            case 'battles': ans = { results: it.battles.map(b => M.Sim.Combat.resolve(b, M.RNG.fromState(M.RNG.seedState(S.seed + ':' + S.turn + ':' + b.star)))) }; break;
            case 'colonize': ans = true; break;
            case 'techChoice': ans = it.choices[0] ? it.choices[0].level : 0; break;
            case 'council': ans = M.Sim.Council.autoVote(S, it.info); break;
            case 'spyStealChoice': case 'spySabotageChoice': got[mode] = it.type; ans = 0; break;
          }
          r = gen.next(ans);
        }
        if (!A.alive || S.gameOver) break;
      }
    }
    t.eq(got[1], 'spyStealChoice'); t.eq(got[2], 'spySabotageChoice');
  });

  t.test('leftovers: base HP, transport HP and ground gear follow the LAST acquired tech, not the best tier', () => {
    const S = mk(), E = S.empires[0], R = M.Sim.Research, Tc = M.Data.Techs;
    const armor = lvl => R.grant(S, E, 1, lvl, 'test');
    armor(17);                                                                  // Zortium first ...
    t.eq(E.mods.baseHp, 2); t.eq(E.mods.ground.armor, 2);
    armor(10);                                                                  // ... then a lower tier acquired later (trade / theft): it overwrites
    t.eq(E.mods.baseHp, 1, 'base HP of the last acquired armour'); t.eq(E.mods.ground.armor, 1);
    t.eq(M.Sim.Ground.transportHp(E), M.Sim.Ground.TRANSPORT_HP[1]);
    t.eq(M.Sim.Design.baseLoadout(S, E).hp, 75);
    armor(26); t.eq(E.mods.baseHp, 3); t.eq(M.Sim.Design.baseLoadout(S, E).hp, 125);
    // a save without rs.seq falls back to ascending order = the best tier
    delete E.research.seq; R.recompute(E); t.eq(E.mods.baseHp, 3);
    t.ok(Tc);
  });
};
