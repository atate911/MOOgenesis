// Small fixes: Econ.refresh keeps research.total current, breakthrough scene precedes the next-project choice, news templates for event categories, Setup objective.
module.exports = function (M, t) {
  const mk = extra => M.Sim.Setup.create(Object.assign({ size: 'small', opponents: 2, race: 'human', seed: 'polish', difficulty: 'average' }, extra));

  t.test('econ: refresh() recomputes research.total after a slider change', () => {
    const S = mk(), E = S.empires[0], p = S.planets[E.capital];
    M.Sim.Colony.setSlider(S, E, p, 4, 60);
    M.Sim.Econ.refresh(S);
    const a = E.research.total;
    M.Sim.Colony.setSlider(S, E, p, 4, 0);
    M.Sim.Econ.refresh(S);
    t.ok(a > E.research.total, 'less Tech slider, fewer RP (' + a + ' > ' + E.research.total + ')');
    t.eq(E.research.total, S.planets.filter(q => q.owner === 0).reduce((s, q) => s + M.Sim.Research.planetRP(E, q, q.spendable), 0));
  });

  t.test('turn: the breakthrough scene (tech) comes before the techChoice of the same turn', () => {
    const S = mk({ seed: 'polish-order' }), E = S.empires[0];
    for (const p of S.planets) if (p.owner === 0) { p.sliders = [0, 0, 0, 0, 100]; }
    E.research.slider = [20, 10, 15, 15, 20, 20]; M.Sim.Econ.refresh(S);
    let both = 0;
    for (let turn = 0; turn < 80 && both === 0; turn++) {
      const gen = M.Sim.Turn.run(S), seq = []; let r = gen.next();
      while (!r.done) {
        const it = r.value; let ans;
        if (it.type === 'aiPlan') ans = {}; else if (it.type === 'techChoice') ans = it.choices[0].level; else if (it.type === 'battles') ans = { results: it.battles.map(b => M.Sim.Combat.resolve(b, M.RNG.create('x' + turn))) }; else if (it.type === 'colonize') ans = true;
        seq.push(it.type); r = gen.next(ans);
      }
      const i = seq.indexOf('tech'), j = seq.indexOf('techChoice');
      if (i >= 0 && j >= 0) { both++; t.ok(i < j, 'tech before techChoice: ' + seq.join(',')); }
    }
    t.ok(both > 0, 'saw a breakthrough and a choice in the same turn');
  });

  t.test('news: event categories without Data.text templates still get a template line', () => {
    const S = mk(), R = M.RNG.create('news');
    for (const cat of ['earthquake', 'novaWarning', 'virus', 'comet', 'richPlanet', 'donation', 'plagueCured', 'piracyEnded', 'coup', 'orionColonised', 'genocide']) {
      const line = M.Sim.News.line(S, R, cat, { empire: 0, empire2: 1, star: 0, planet: 0, n: 5, field: 'Computers', headline: 'FALLBACK' });
      t.ok(line && line !== 'FALLBACK' && !/\{\w+\}/.test(line), cat + ': ' + line);
    }
    t.eq(M.Sim.News.line(S, R, 'noSuchCat', { headline: 'HEAD' }), 'HEAD');
    t.eq(M.Sim.News.line(S, R, 'noSuchCat', {}), null);
  });

  t.test('setup: the human objective is 0 unless named; an AI-played slot 0 rolls one', () => {
    t.eq(mk().empires[0].objective, 0);
    t.eq(mk({ objective: 'technologist' }).empires[0].objective, 3);
    t.eq(mk({ objective: 4 }).empires[0].objective, 4);
    const ai = mk({ playerAI: true }).empires[0].objective;
    t.ok(ai >= 0 && ai < 6, 'rolled ' + ai);
  });
};
