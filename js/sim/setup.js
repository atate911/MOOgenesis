// New game creation (research/01 §2, §5.1; research/04 §1.12). Worker-safe. Needs Data.Races, Data.Config, Sim.Galaxy/Colony/Research/Design/Vis/Fleet.
//   const S = MOO.Sim.Setup.create({size, difficulty, opponents, race, banner, leader, homeworld, seed, options, playerAI})
// Empire 0 is the human (or an AI too when settings.playerAI — used by soak tests).
MOO.def(function (M) {
  'use strict';
  const Su = M.Sim.Setup = {};
  const Cfg = () => M.Data.Config;
  const RACES = () => M.Data.Races;
  const DIFF = ['simple', 'easy', 'average', 'hard', 'impossible'];
  Su.BANNERS = ['blue', 'green', 'purple', 'red', 'white', 'yellow'];

  Su.create = function (settings) {
    const st = Object.assign({ size: 'large', difficulty: 'average', opponents: 3, race: 'human', banner: 0, seed: String(Date.now()), options: {} }, settings || {});
    const diffIdx = Math.max(0, DIFF.indexOf(st.difficulty));
    const players = Math.max(2, Math.min(6, (st.opponents | 0) + 1));
    const S = {
      v: M.SAVE_VERSION, seed: String(st.seed), rs: M.RNG.seedState(st.seed), turn: 0, year: 1,
      settings: { size: st.size, difficulty: DIFF[diffIdx], diffIdx, opponents: players - 1, options: Object.assign({ randomEvents: true, council: true, monsters: true, fogOfWar: true, tactical: true }, st.options), playerAI: !!st.playerAI },
      playerId: 0, empires: [], fleets: [], trans: [], nextId: 1, ev: [], news: [], newsLog: [],
      council: { held: false, lastYear: 0, emperor: -1 }, events: { year: Cfg().EVENT_FIRST_YEAR, done: {} }, guardian: null,
    };
    const R = M.RNG.bind(S.rs);
    M.Sim.Galaxy.generate(S, st.size, players);

    // ---- who plays: race / banner / leader per empire ----
    const order = RACES().ORDER.slice();
    const usedRaces = new Set([st.race]), usedBanners = new Set([st.banner | 0]);
    const raceFor = [st.race], bannerFor = [st.banner | 0];
    for (let i = 1; i < players; i++) {
      const free = order.filter(r => !usedRaces.has(r)); const r = free[R.int(0, free.length - 1)]; usedRaces.add(r); raceFor.push(r);
      const fb = [0, 1, 2, 3, 4, 5].filter(b => !usedBanners.has(b)); const b = fb[R.int(0, fb.length - 1)]; usedBanners.add(b); bannerFor.push(b);
    }
    // homeworld stars assigned in random order
    const homes = S.homeCandidates.slice(); R.shuffle(homes); delete S.homeCandidates;
    const usedLeaders = new Set();
    for (let i = 0; i < players; i++) {
      const rd = RACES().races[raceFor[i]];
      let leader = i === 0 && st.leader ? st.leader : null;
      if (!leader) { for (let k = 0; k < 50; k++) { const c = rd.leaders[R.int(0, rd.leaders.length - 1)]; if (!usedLeaders.has(c.toLowerCase())) { leader = c; break; } } leader = leader || rd.leaders[0]; }
      usedLeaders.add(leader.toLowerCase());
      const E = {
        id: i, race: rd.id, name: rd.name, plural: rd.plural, leader, color: bannerFor[i], human: i === 0 && !st.playerAI, alive: true, capital: homes[i],
        bc: 0, tax: 0, security: 0, spyBudget: [0, 0, 0, 0, 0, 0], spies: [0, 0, 0, 0, 0, 0], spyMode: [0, 0, 0, 0, 0, 0],
        personality: RACES().rollPersonality(R, rd.id), objective: i === 0 ? 0 : RACES().rollObjective(R, rd.id),
        designs: [null, null, null, null, null, null], dstats: [], stats: {}, flow: {}, relations: [], ai: null,
      };
      S.empires.push(E);
    }
    // ---- homeworlds, tech, designs, fleets ----
    for (const E of S.empires) {
      const rd = RACES().races[E.race], star = E.capital;
      const hwName = E.id === 0 && st.homeworld ? st.homeworld : rd.homeworld;
      M.Sim.Galaxy.makeHomeworld(S, star, hwName);
      const p = S.planets[star];
      M.Sim.Research.init(S, E, R);
      M.Sim.Design.startDesigns(E);
      M.Sim.Vis.init(S, E);
      M.Sim.Colony.found(S, E, p, 0);
      p.pop = Cfg().START_POP[diffIdx]; p.factories = Cfg().START_FACTORIES; p.mp1 = p.mp2 = p.mp3 = 100; p.maxPop = 100; p.operTier = 2;
      p.name = hwName; E.capital = star;
      M.Sim.Fleet.addShips(S, E.id, star, 0, Cfg().START_SCOUTS);                // slot 0 = Scout
      M.Sim.Fleet.addShips(S, E.id, star, 4, Cfg().START_COLONY_SHIPS);          // slot 4 = Colony Ship
      M.Sim.Vis.explore(S, E, star);
      E.relations = S.empires.map((o, j) => ({ with: j, contact: false, treaty: 0, trade: 0, attitude: E.id === j ? 0 : RACES().RELATIONS[RACES().ORDER.indexOf(E.race)][RACES().ORDER.indexOf(o.race)] }));
    }
    // diplomacy state + AI personality-driven initial settings
    if (M.Sim.Diplo && M.Sim.Diplo.init) M.Sim.Diplo.init(S);
    for (const E of S.empires) { initAllocation(S, E, R); }
    // human default research sliders (20/10/15/15/20/20) come from Research.init; economy numbers for the first screen
    for (const E of S.empires) { M.Sim.Research.recompute(E); }
    M.Sim.Fleet.updateRange(S);
    M.Sim.Vis.update(S);
    M.Sim.Econ.refresh(S);
    M.Sim.Econ.stepResearchTotal(S);
    return S;
  };

  // AI initial planet/research allocation (research/01 §5.1 step 8); humans keep Industry 100% + ECO floor
  function initAllocation(S, E, R) {
    const p = S.planets[E.capital];
    if (E.human) { M.Sim.Colony.applyEcoFloor(S, E, p); return; }
    let n = 0;                                                                      // the home planet itself counts (distance 0): n > 1 = at least one OTHER habitable planet nearby
    for (let j = 0; j < S.stars.length; j++) if (S.planets[j].typeIdx >= 7 && M.Sim.Geo.unitDist(S, p.starId, j) <= 30) n++;
    const rs = E.research;
    E.ai = { countdown: n > 1 ? R.int(1, 6) + 14 : R.int(1, 6) + 24, p2: R.int(1, 10), crowded: n > 1 };             // p2 = rnd(10) = 1..10 (research/07 §2.1)
    if (n > 1) { p.sliders = [10, 0, 90, 0, 0]; rs.slider = [20, 20, 0, 40, 20, 0]; }
    else { p.sliders = [0, 0, 60, 10, 30]; rs.slider = [0, 0, 0, 0, 100, 0]; }     // isolated: the original starts at 60/10/40 (=110) and its first end-of-turn normalisation trims TECH to 30 — we start normalised
    for (let f = 0; f < 6; f++) M.Sim.Research.aiFirst(S, E, f, R);                  // first project per field: uniform tier-1 pick, original quirk cost = level² × 50 for every race
    M.Sim.Colony.applyEcoFloor(S, E, p);
  }
});
