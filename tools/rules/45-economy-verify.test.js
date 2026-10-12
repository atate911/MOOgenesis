// research/04 verification (04-verification.md): rules re-derived from the 1oom source that are not covered by the colony / galaxy files.
module.exports = function (M, t) {
  const G = M.Sim.Galaxy, V = M.Sim.Vis;

  t.test('rocks: d100 - 20 (ultra rich) / - 10 (rich) - (15 - type); MANY below 15, SOME below 40 (strict) (C2)', () => {
    t.eq(G.rocksFor(16, 2, 13), 'many'); t.eq(G.rocksFor(17, 2, 13), 'some', 'terran: roll 17 -> 15 is not "many"');
    t.eq(G.rocksFor(41, 2, 13), 'some'); t.eq(G.rocksFor(42, 2, 13), 'none');
    t.eq(G.rocksFor(28, 2, 1), 'many'); t.eq(G.rocksFor(29, 2, 1), 'some', 'radiated: rolls 1..28 = MANY (28%)');
    t.eq(G.rocksFor(26, 4, 13), 'many', 'rich: -10'); t.eq(G.rocksFor(37, 5, 13), 'some', 'ultra rich: -20 -> 15');
  });

  t.test('planet scanners belong to OWN planets only: an ally\'s colony extends fuel range but not the scan (C7)', () => {
    const Dp = M.Sim.Diplo, saved = Dp && Dp.isAllied;
    try {
      if (Dp) Dp.isAllied = () => true;
      const stars = [{ id: 0, x: 0, y: 0 }, { id: 1, x: 150, y: 0 }, { id: 2, x: 161, y: 0 }];
      const planets = stars.map((s, i) => ({ id: i, starId: i, owner: i === 0 ? 0 : i === 2 ? 1 : -1, pop: 5, bases: 0, factories: 0 }));
      const S = { stars, planets, fleets: [], turn: 1, empires: [{ id: 0, alive: true, mods: { scan: 3 } }, { id: 1, alive: true, mods: { scan: 3 } }] };
      for (const E of S.empires) V.init(S, E);
      V.update(S);
      t.eq(S.empires[0].scanned[1], 0, 'star 1 is next to the ally\'s planet only');
      t.eq(S.empires[1].scanned[1], 1, 'the ally itself scans it');
      t.eq(S.empires[0].scanned[0], 1);
    } finally { if (Dp) Dp.isAllied = saved; }
  });

  t.test('turn order: production is recomputed once more after ecology/research/trade, before defence/ships/industry (1oom hidden child labor) (C5)', () => {
    const Sim = M.Sim, Cfg = M.Data.Config, orig = {}, log = [];
    for (const k of ['stepProduction', 'stepEco', 'stepResearchTotal', 'stepDefense', 'stepShips', 'stepIndustry']) { orig[k] = Sim.Econ[k]; Sim.Econ[k] = function () { log.push(k); return orig[k].apply(this, arguments); }; }
    const savedQ = Cfg.QUIRKS;
    try {
      const S = Sim.Setup.create({ size: 'small', opponents: 1, race: 'human', seed: 'hcl-order', difficulty: 'average' });
      const run = () => { log.length = 0; Sim.autoTurn(S); return log.slice(0, log.indexOf('stepIndustry') + 1).join(' '); };
      t.eq(run(), 'stepProduction stepEco stepResearchTotal stepProduction stepDefense stepShips stepIndustry');
      Cfg.QUIRKS = { hiddenChildLabor: false };
      t.eq(run(), 'stepProduction stepEco stepResearchTotal stepDefense stepShips stepIndustry', 'the switch restores the single pass');
    } finally { for (const k in orig) Sim.Econ[k] = orig[k]; Cfg.QUIRKS = savedQ; }
  });

  t.test('Econ.refresh keeps E.research.total current after a slider change (no stale value until the next turn)', () => {
    const Sim = M.Sim;
    const S = Sim.Setup.create({ size: 'small', opponents: 1, race: 'human', seed: 'refresh-rp', difficulty: 'average' });
    Sim.Econ.refresh(S);
    const E = S.empires[S.playerId], p = S.planets.find(q => q.owner === E.id);
    p.lock = [false, false, false, false, false]; p.sliders = [0, 0, 100, 0, 0]; Sim.Econ.refresh(S);
    const before = E.research.total;
    Sim.Colony.setSlider(S, E, p, 4, 100); Sim.Econ.refresh(S);
    t.ok(E.research.total > before, 'research total follows the slider: ' + before + ' -> ' + E.research.total);
  });

  t.test('Q.hints: a human with 0 RP gets the noResearch tip until a Tech slider is raised', () => {
    const Sim = M.Sim, S = Sim.Setup.create({ size: 'small', opponents: 1, race: 'human', seed: 'hint-rp', difficulty: 'average' });
    const E = S.empires[S.playerId], p = S.planets.find(q => q.owner === E.id);
    p.lock = [false, false, false, false, false]; p.sliders = [0, 0, 100, 0, 0]; Sim.Econ.refresh(S);
    t.eq(Sim.Q.hints(S).map(h => h.id).join(), 'noResearch');
    Sim.Colony.setSlider(S, E, p, 4, 100); Sim.Econ.refresh(S);
    t.eq(Sim.Q.hints(S).length, 0);
  });
};
