// Research rules checked against the primary source (1oom game rules, via the verification pass research/02-verification.md) — everything here is a rule the research
// document either left open or got subtly wrong; tests in 20-techs.test.js cover the document's own tables and formulas.
//   * Research.start (replacing a project wipes the pile) · Research.aiFirst (the AI's first project) · the AI start allocation (home planet counts as a neighbour)
//   * Turn: the next project is chosen in the SAME turn a project completes · Vis.canSee: transit detection radii
module.exports = function (M, t) {
  const T = M.Data.Techs, Rs = M.Sim.Research, V = M.Sim.Vis;
  const CODES = ['CM', 'CN', 'FF', 'PL', 'PR', 'WE'];
  const CMLIKE = [[2, 4, 5], [7, 8, 10], [12, 13, 15], [17, 18, 20], [22, 23, 25], [27, 28, 30], [32, 34, 35], [37, 38, 40], [42, 45], [46, 47, 48]];

  function fresh(race, diff, seed, human) {
    const S = { turn: 1, settings: { diffIdx: diff === undefined ? 2 : diff } }, E = { id: 0, race: race || 'human', human: human !== false, alive: true };
    Rs.init(S, E, M.RNG.create(seed || 'rules-22'));
    return { S, E, rs: E.research };
  }

  // ---------------------------------------------------------------------------------------------------------------------------------- Research.start
  t.test('research.start: replacing a project under way wipes the pile; the same project or an idle field keeps it (original game_tech_start_next)', () => {
    const { S, E, rs } = fresh('human', 2, 'start-reset');
    rs.list[0] = CMLIKE.map(x => x.slice());
    rs.invest[0] = 500;                                                    // RP that flowed into a field without a project
    t.eq(Rs.start(S, E, 0, 2), true); t.eq(rs.project[0], 2); t.eq(rs.invest[0], 500); t.eq(rs.cost[0], T.costHuman(2, 'human', 0, 2));
    rs.invest[0] = 800;
    t.eq(Rs.start(S, E, 0, 2), true); t.eq(rs.invest[0], 800, 'picking the running project again changes nothing');
    t.eq(Rs.start(S, E, 0, 4), true); t.eq(rs.project[0], 4); t.eq(rs.invest[0], 0, 'switching projects throws the pile away'); t.eq(rs.cost[0], T.costHuman(4, 'human', 0, 2));
    t.eq(Rs.start(S, E, 0, 50), false); t.eq(rs.project[0], 4); t.eq(rs.invest[0], 0);               // not on offer: nothing happens
    rs.invest[0] = 123; t.eq(Rs.start(S, E, 0, 50), false); t.eq(rs.invest[0], 123);
    // the order refuses to replace a funded project unless forced, and a forced switch also wipes the pile
    rs.project[0] = 4; rs.invest[0] = 900; rs.cost[0] = 800;
    t.eq(M.Sim.Orders.apply({ empires: [E], settings: S.settings }, 0, { t: 'researchPick', field: 0, level: 5 }).ok, false);
    t.eq(rs.project[0], 4); t.eq(rs.invest[0], 900);
    t.eq(M.Sim.Orders.apply({ empires: [E], settings: S.settings }, 0, { t: 'researchPick', field: 0, level: 5, force: true }).ok, true);
    t.eq(rs.project[0], 5); t.eq(rs.invest[0], 0);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- soil flags, Silicoid overrides
  t.test('recompute: Advanced Soil Enrichment alone does not unlock plain Soil Enrichment — a Normal planet goes straight to Gaia for 300 BC (1oom have_soil_enrich = level 16 only)', () => {
    const { E, rs } = fresh('human', 2, 'soil-direct');
    rs.completed[3] = [1, 30]; Rs.recompute(E);
    t.eq(E.mods.advSoil, true); t.eq(E.mods.soil, undefined);
    const S = { settings: { diffIdx: 2 }, stars: [{ id: 0, nebula: false, name: 'X' }], planets: [], empires: [] };
    const planet = growth => ({
      id: 0, starId: 0, owner: 0, type: 'terran', typeIdx: 13, mp1: 100, mp2: 100, mp3: 100, maxPop: 100, growth, special: 'normal', pop: 50, popFrac: 0, factories: 0, waste: 0, rebels: 0,
      unrest: 0, bank: 0, bases: 0, shield: 0, sliders: [0, 0, 0, 100, 0], lock: [false, false, false, false, false], acc: { ship: 0, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 },
      build: 0, spendable: 301, gross: 0,
    });
    const p = planet('normal'); M.Sim.Colony.buildEco(S, E, p);
    t.eq(p.growth, 'gaia'); t.eq(p.mp2, 150);
    rs.completed[3] = [1, 16, 30]; Rs.recompute(E);                           // with both techs the plain project still comes first (150 BC → Fertile)
    const q = planet('normal'); q.spendable = 200; M.Sim.Colony.buildEco(S, E, q);      // (301 BC in ONE turn would finish both: the projects are sequential blocks, 04-verification C4)
    t.eq(q.growth, 'fertile'); t.eq(q.mp2, 125);
    const r = planet('normal'); M.Sim.Colony.buildEco(S, E, r);
    t.eq(r.growth, 'gaia'); t.eq(r.mp2, 150);
  });

  t.test('recompute: Silicoids always colonise down to Radiated and never get soil / atmosphere projects, whatever they own; other races keep the tech values', () => {
    const s = fresh('silicoid', 2, 'sil-mods');
    t.eq(s.E.mods.colonyFor, 1, 'from the first turn');
    for (let f = 0; f < 6; f++) s.rs.completed[f] = [1].concat(T.researchTable[f].reduce((a, tr) => a.concat(tr), []));     // everything, even what they are never offered
    Rs.recompute(s.E);
    t.eq(s.E.mods.colonyFor, 1); t.eq(s.E.mods.soil, undefined); t.eq(s.E.mods.advSoil, undefined); t.eq(s.E.mods.atmos, undefined);
    t.eq(s.E.mods.terraform, 120); t.eq(s.E.mods.ecoRestore, 20);             // the rest of the tech effects still apply
    const h = fresh('human'); t.eq(h.E.mods.colonyFor, 7);
    for (let f = 0; f < 6; f++) h.rs.completed[f] = [1].concat(T.researchTable[f].reduce((a, tr) => a.concat(tr), []));
    Rs.recompute(h.E); t.eq(h.E.mods.colonyFor, 1); t.eq(h.E.mods.soil, true); t.eq(h.E.mods.advSoil, true); t.eq(h.E.mods.atmos, true);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- Research.aiFirst
  // The quirk (Config.QUIRKS.aiFirstTechCost) is OFF by default (ai_first_tech_cost_fix); these tests pin the original behaviour by switching it on for their duration.
  const withFirstCostQuirk = (on, fn) => { const Q = M.Data.Config.QUIRKS, was = Q.aiFirstTechCost; Q.aiFirstTechCost = on; try { fn(); } finally { Q.aiFirstTechCost = was; } };
  t.test('research.aiFirst: uniform pick among the tier-1 entries at every difficulty, cost = level² × 50 for every race (original quirk, flag ON)', () => withFirstCostQuirk(true, () => {
    for (const d of [0, 2, 4]) {
      const { S, E, rs } = fresh('human', d, 'ai-first', false);
      rs.list[0] = CMLIKE.map(x => x.slice());
      const R = M.RNG.create('ai-first-dice'), N = 6000, seen = { 2: 0, 4: 0, 5: 0 };
      for (let i = 0; i < N; i++) {
        rs.project[0] = 0; rs.invest[0] = 0;
        const lvl = Rs.aiFirst(S, E, 0, R);
        t.ok(lvl === 2 || lvl === 4 || lvl === 5, 'level ' + lvl); seen[lvl]++;
        t.eq(rs.project[0], lvl); t.eq(rs.cost[0], lvl * lvl * 50);
      }
      for (const l of [2, 4, 5]) t.near(seen[l] / N, 1 / 3, 0.03, 'difficulty ' + d + ' level ' + l);
    }
    // a race with a research bonus does not change the first-project cost
    const m = fresh('psilon', 2, 'ai-first-psilon', false); m.rs.list[3] = CMLIKE.map(x => x.slice());
    const lvl = Rs.aiFirst(m.S, m.E, 3, M.RNG.create('x')); t.eq(m.rs.cost[3], lvl * lvl * 50); t.ok(m.rs.cost[3] !== T.costAI(lvl, 'psilon', 3));
    // an empty field offers nothing
    const e = fresh('human', 2, 'ai-first-empty', false); e.rs.list[0] = CMLIKE.map(x => x.slice());
    e.rs.completed[0] = [1].concat(CMLIKE.reduce((a, tr) => a.concat(tr), []), [55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
    t.eq(Rs.aiFirst(e.S, e.E, 0, M.RNG.create(1)), 0);
  }));

  t.test('research.aiFirst: default (fixed) charges the normal AI cost Techs.costAI; options.aiClassic forces the level² × 50 quirk back', () => {
    t.eq(M.Data.Config.QUIRKS.aiFirstTechCost, false, 'decision: fixed by default (tools/balance/REPORT.md)');
    for (const race of ['human', 'psilon', 'silicoid']) {
      const m = fresh(race, 2, 'ai-first-fixed-' + race, false); m.rs.list[3] = CMLIKE.map(x => x.slice());
      const lvl = Rs.aiFirst(m.S, m.E, 3, M.RNG.create('x')); t.eq(m.rs.cost[3], T.costAI(lvl, race, 3));
      t.ok(m.rs.cost[3] <= lvl * lvl * 25, race + ': normal cost (<= 125 %) is cheaper than level² × 50');
    }
    const c = fresh('human', 2, 'ai-first-classic', false); c.S.settings.options = { aiClassic: true }; c.rs.list[3] = CMLIKE.map(x => x.slice());
    const lvl = Rs.aiFirst(c.S, c.E, 3, M.RNG.create('x')); t.eq(c.rs.cost[3], lvl * lvl * 50);
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- AI start allocation
  t.test('setup: AI start allocation — "crowded" means at least ONE other habitable planet within 30 map units (the home planet counts in n); first projects are tier-1, cost level² × 50 (aiClassic)', () => {
    if (!M.Sim.Setup || !M.Data.Races) t.skip('Setup not available');
    let ais = 0, nTwo = 0;
    for (let s = 0; s < 6; s++) {
      const S = M.Sim.Setup.create({ size: 'small', difficulty: 'average', opponents: 3, race: 'human', seed: 'crowd-' + s, options: { aiClassic: true } });
      for (const E of S.empires) {
        const rs = E.research;
        if (E.human) { t.deep(rs.project, [0, 0, 0, 0, 0, 0]); t.deep(rs.cost, [0, 0, 0, 0, 0, 0]); continue; }
        ais++;
        const home = S.stars[E.capital]; let n = 0;
        for (let j = 0; j < S.stars.length; j++) {
          const st = S.stars[j];
          if (S.planets[j].typeIdx >= 7 && M.Sim.Geo.distFast(st.x - home.x, st.y - home.y) <= 30) n++;       // dist 0 → the (Terran) home planet itself is counted
        }
        if (n === 2) nTwo++;
        t.eq(E.ai.crowded, n > 1, 'seed ' + s + ' empire ' + E.id + ' n=' + n);
        if (n > 1) { t.deep(rs.slider, [20, 20, 0, 40, 20, 0]); t.between(E.ai.countdown, 15, 20); }
        else { t.deep(rs.slider, [0, 0, 0, 0, 100, 0]); t.between(E.ai.countdown, 25, 30); }
        for (let f = 0; f < 6; f++) {
          const lvl = rs.project[f];
          t.ok(lvl > 0 && T.researchTable[f][0].indexOf(lvl) >= 0 && rs.list[f][0].indexOf(lvl) >= 0, CODES[f] + ' first project ' + lvl + ' must be on its tier-1 list');
          t.eq(rs.cost[f], lvl * lvl * 50, CODES[f]);
        }
      }
    }
    t.ok(ais >= 12);
    t.ok(nTwo > 0, 'the sample must contain starts with exactly one neighbour — the case the off-by-one used to misclassify');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- the same-turn next project
  t.test('turn: a project that completes is replaced in the SAME turn — the human is asked at once (techChoice), an AI picks at once; the pile starts again at 1', () => {
    if (!M.Sim.Setup || !M.Sim.Turn || !M.Data.Races) t.skip('Setup / Turn not available');
    const S = M.Sim.Setup.create({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: 'same-turn' });
    const prompts = [];
    const drive = () => {                                                  // answers every interrupt with the dullest choice; AI planners are switched off (empty plans)
      const gen = M.Sim.Turn.run(S); let r = gen.next();
      while (!r.done) {
        const it = r.value; let ans;
        if (it && it.type === 'techChoice') { prompts.push(it); ans = it.choices[0].level; }
        else if (it && it.type === 'colonize') ans = true;
        else if (it && it.type === 'aiPlan') ans = {};
        else if (it && it.type === 'battles') ans = { results: [] };
        r = gen.next(ans);
      }
    };
    drive();                                                               // turn 0: the human picks a first project for every field
    t.ok(prompts.length >= 1 && prompts.every(p => p.empire === 0));
    const lvl0 = [S.empires[0], S.empires[1]].map(E => E.research.project[0]);
    t.ok(lvl0[0] > 0 && lvl0[1] > 0);
    for (const E of [S.empires[0], S.empires[1]]) {                        // all research into Computers, project nearly done with a huge pile → completes with certainty
      const rs = E.research;
      rs.slider = [100, 0, 0, 0, 0, 0]; rs.invest[0] = 10000000; rs.cost[0] = 10;
      for (const p of S.planets) if (p.owner === E.id) p.sliders = [0, 0, 0, 0, 100];
    }
    prompts.length = 0;
    drive();
    for (const E of [S.empires[0], S.empires[1]]) {
      const rs = E.research;
      t.eq(rs.completed[0].length, 2, 'empire ' + E.id + ' finished its Computers project'); t.ok(rs.completed[0].indexOf(lvl0[E.id]) >= 0);
      t.ok(rs.project[0] > 0 && rs.project[0] !== lvl0[E.id], 'empire ' + E.id + ' must already have a NEW project');
      t.eq(rs.invest[0], 1, 'the pile restarts at 1');
      t.eq(rs.cost[0], E.human ? T.costHuman(rs.project[0], E.race, 0, 2) : T.costAI(rs.project[0], E.race, 0));
    }
    const asked = prompts.filter(p => p.empire === 0 && p.field === 0);
    t.eq(asked.length, 1, 'the human was asked once, in the turn the tech arrived');
    t.ok(asked[0].choices.length > 0 && asked[0].choices.every(c => c.level !== lvl0[0]));
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- artifact worlds
  t.test('turn: an artifact world pays only the very first explorer — an AI that arrives first wastes it; simultaneous arrivals go to the lower empire index', () => {
    if (!M.Sim.Setup || !M.Sim.Turn || !M.Sim.Artifacts || !M.Data.Races) t.skip('Setup / Turn / Artifacts not available');
    const S = M.Sim.Setup.create({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: 'artifact-race' });
    const free = S.stars.filter(s => S.planets[s.id].owner < 0 && S.planets[s.id].typeIdx > 0 && S.empires.every(e => !e.explored[s.id])).slice(0, 3);
    t.eq(free.length, 3);
    const [X, Y, Z] = free.map(s => s.id);
    for (const id of [X, Y, Z]) S.planets[id].special = 'artifacts';
    const H = S.empires[0], techs = () => H.research.completed.reduce((a, l) => a + l.length, 0);
    const turn = () => { const gen = M.Sim.Turn.run(S); let r = gen.next(); while (!r.done) { const it = r.value; r = gen.next(it && it.type === 'techChoice' ? it.choices[0].level : it && it.type === 'colonize' ? false : it && it.type === 'aiPlan' ? {} : it && it.type === 'battles' ? { results: [] } : undefined); } };
    const t0 = techs();
    M.Sim.Fleet.addShips(S, 1, X, 0, 1);                                   // turn 1: the AI reaches X ...
    M.Sim.Fleet.addShips(S, 0, Y, 0, 1);                                   // ... and the human reaches Y (control: nobody was there before)
    turn();
    t.eq(techs(), t0 + 1, 'the first explorer of Y got one technology');
    t.ok(S.empires[1].explored[X] && H.explored[Y]);
    M.Sim.Fleet.addShips(S, 0, X, 0, 1);                                   // turn 2: the human follows the AI to X → nothing left to find
    const t1 = techs(); turn();
    t.ok(H.explored[X], 'the human did explore X'); t.eq(techs(), t1, 'X was spoiled by the AI');
    M.Sim.Fleet.addShips(S, 1, Z, 0, 1); M.Sim.Fleet.addShips(S, 0, Z, 0, 1);   // turn 3: both reach Z in the same turn (the AI fleet is listed first) → empire 0 comes first
    const t2 = techs(); turn();
    t.eq(techs(), t2 + 1, 'the lower empire index takes the simultaneous find');
  });

  // ---------------------------------------------------------------------------------------------------------------------------------- transit detection
  t.test('vis.canSee: fleets in transit are seen within 10 x scan units of an owned planet, within 5 x scan − 15 units of own ships (orbiting or in transit)', () => {
    const savedDiplo = M.Sim.Diplo; M.Sim.Diplo = null;                    // the mock state below has no diplomacy data
    try { visChecks(); } finally { M.Sim.Diplo = savedDiplo; }
  });
  function visChecks() {
    const star = (x, y) => ({ x, y });
    const mk = scan => ({
      S: { stars: [star(0, 0), star(200, 0), star(0, 300)], planets: [{ owner: 0, starId: 0 }, { owner: -1, starId: 1 }, { owner: -1, starId: 2 }],
        fleets: [{ owner: 0, star: 1, x: 200, y: 0, ships: [1, 0, 0, 0, 0, 0] }, { owner: 0, star: -1, x: 100, y: 100, ships: [1, 0, 0, 0, 0, 0] }] },
      E: { id: 0, mods: { scan }, scanned: [1, 0, 0] },
    });
    const enemy = (x, y) => ({ owner: 1, star: -1, x, y });
    // planet radius: 30 / 50 / 70 / 90
    for (const [scan, reach] of [[3, 30], [5, 50], [7, 70], [9, 90]]) {
      const { S, E } = mk(scan);
      t.eq(V.planetReach(E), reach); t.eq(V.canSee(S, E, enemy(0, reach)), true, 'scan ' + scan + ' at ' + reach); t.eq(V.canSee(S, E, enemy(reach, 0)), true);
      t.eq(V.canSee(S, E, enemy(0, reach + 2)), false, 'scan ' + scan + ' just outside');
    }
    // small ship radius around own ships: 0 / 10 / 20 / 30 (around the orbiting stack at (200,0) and the own fleet in transit at (100,100))
    for (const [scan, reach] of [[3, 0], [5, 10], [7, 20], [9, 30]]) {
      const { S, E } = mk(scan);
      t.eq(V.shipReach(E), reach); t.eq(V.transitRange(E), reach / 10);
      t.eq(V.canSee(S, E, enemy(200 + reach, 0)), true, 'scan ' + scan + ' near the orbiting stack');
      t.eq(V.canSee(S, E, enemy(200 + reach + 2, 0)), false);
      t.eq(V.canSee(S, E, enemy(100, 100 + reach)), true, 'scan ' + scan + ' near the fleet in transit');
      t.eq(V.canSee(S, E, enemy(100 + reach + 2, 100)), false);
    }
    // far away from everything: invisible; own fleets and in-orbit enemies follow the scanned flags
    const { S, E } = mk(9);
    t.eq(V.canSee(S, E, enemy(150, 250)), false);
    t.eq(V.canSee(S, E, { owner: 0, star: -1, x: 999, y: 999 }), true);
    t.eq(V.canSee(S, E, { owner: 1, star: 0, x: 0, y: 0 }), true); t.eq(V.canSee(S, E, { owner: 1, star: 2, x: 0, y: 300 }), false);
  }
};
