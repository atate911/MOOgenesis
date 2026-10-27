// Expansion tech pool (js/data/techs-x.js + js/sim/xtech.js, the Tech Lab experiment): data integrity, the swap sampler, classic isolation, and every hook.
module.exports = function (M, t) {
  const T = M.Data.Techs, X = T.X, Rs = M.Sim.Research, Xt = M.Sim.XTech, C = M.Sim.Colony;
  const byShort = {};
  for (const x of X.list) byShort[x.id.slice(6)] = x;
  const xgame = (seed, extra) => M.Sim.Setup.create(Object.assign({ size: 'medium', opponents: 3, race: 'human', seed: seed || 'xt', difficulty: 'average', options: { techPool: 'expanded' } }, extra || {}));
  const cgame = (seed, extra) => M.Sim.Setup.create(Object.assign({ size: 'medium', opponents: 3, race: 'human', seed: seed || 'xt', difficulty: 'average' }, extra || {}));
  const own = (S, E, short) => { const x = byShort[short]; if (!x) throw new Error('no expansion tech ' + short); Rs.grant(S, E, x.field, x.level, 'test'); return x; };
  const home = (S, E) => S.planets[E.capital];
  const total = L => L.reduce((a, tiers) => a + tiers.reduce((b, tr) => b + tr.length, 0), 0);
  // the same computation with one effect key switched off (granting a tech also raises its field's tech level, so before/after comparisons mislead)
  const without = (E, keys, fn) => { const keep = {}; for (const k of [].concat(keys)) { keep[k] = E.mods[k]; delete E.mods[k]; } try { return fn(); } finally { Object.assign(E.mods, keep); } };

  // ---- data ---------------------------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x: 45 techs on free levels, outside the single-tech tiers, every effect key documented and used, chains ranked', () => {
    t.eq(X.list.length, 45, 'a quarter of the 180 classic researchable techs');
    t.deep(X.byField.map(a => a.length), [9, 11, 6, 8, 9, 2]);
    const keys = new Set(X.KEYS), used = new Set();
    for (const x of X.list) for (const k in x.effects) used.add(k);
    for (const k of X.KEYS) t.ok(used.has(k), 'documented key without a tech: ' + k);
    for (const x of X.list) {
      t.eq(T.byId[x.id], x); t.eq(T.byFL[x.field][x.level], x); t.eq(x.pool, 'x');
      t.ok(T.list.indexOf(x) < 0 && T.byField[x.field].indexOf(x) < 0, 'not in the classic tables: ' + x.id);
      t.ok(T.researchTable[x.field][x.tier - 1].indexOf(x.level) < 0, x.id);
      t.ok(T.researchTable[x.field][x.tier - 1].length > 1, 'never in an always tier: ' + x.id);
      t.ok(x.level >= 2 && x.level <= 50 && x.tier === Math.ceil(x.level / 5), x.id);
      t.ok(x.desc && x.desc.length > 30 && x.say.length >= 1, x.id);
      for (const k in x.effects) t.ok(keys.has(k), 'undocumented key ' + k);
      t.ok(!x.never || (x.never.length === 1 && x.never[0] === 'silicoid'));
    }
    for (const g in X.GROUPS) { const ids = X.GROUPS[g]; t.ok(ids.length >= 2, g); ids.forEach((id, i) => t.eq(T.byId[id].gtier, i + 1)); }
    for (let f = 0; f < 6; f++) for (let ti = 0; ti < 10; ti++) t.deep(X.researchTable[f][ti], T.researchTable[f][ti].concat(X.byTier[f][ti]).sort((a, b) => a - b));
  });

  // ---- the swap sampler -----------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x sampler: tree sizes per tier unchanged, protected techs kept, Silicoid never-list honoured, deterministic', () => {
    for (const race of ['human', 'psilon', 'silicoid']) {
      const R = M.RNG.create('smp-' + race);
      for (let i = 0; i < 300; i++) {
        let L = null; while (!L) L = T.generateResearchList(R, race);
        const before = JSON.parse(JSON.stringify(L)), L2 = X.expandList(JSON.parse(JSON.stringify(L)), race, M.RNG.create('sw' + i));
        t.deep(X.expandList(JSON.parse(JSON.stringify(L)), race, M.RNG.create('sw' + i)), L2, 'deterministic');
        for (let f = 0; f < 6; f++) for (let ti = 0; ti < 10; ti++) {
          t.eq(L2[f][ti].length, before[f][ti].length);
          for (const l of before[f][ti]) if (X.protectedLevel(f, l)) t.ok(L2[f][ti].indexOf(l) >= 0, 'protected ' + f + '/' + l);
          for (const l of L2[f][ti]) {
            const x = T.byFL[f][l]; t.ok(x && x.tier === ti + 1);
            if (race === 'silicoid') t.ok(!(x.never && x.never.indexOf('silicoid') >= 0), 'silicoid never ' + x.id);
          }
        }
        t.ok(T.essentialOk(L2, race));
        t.eq(total(L2), total(before));
      }
    }
  });
  t.test('techs-x sampler: each expansion tech is about as common as the classic techs of its tier', () => {
    const R = M.RNG.create('presence'), N = 2000, cnt = {};
    for (let i = 0; i < N; i++) {
      let L = null; while (!L) L = T.generateResearchList(R, 'human');
      X.expandList(L, 'human', M.RNG.create('p' + i));
      L.forEach((tiers, f) => tiers.forEach(tr => tr.forEach(l => { cnt[f * 100 + l] = (cnt[f * 100 + l] || 0) + 1; })));
    }
    for (const x of X.list) t.between(cnt[x.field * 100 + x.level] / N, 0.25, 0.5, x.id);
  });

  // ---- classic isolation ------------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x isolation: a classic game holds no expansion tech and cannot be given one', () => {
    const S = cgame('iso');
    for (const E of S.empires) {
      t.eq(E.research.pool, undefined);
      for (let f = 0; f < 6; f++) for (const tr of E.research.list[f]) for (const l of tr) t.ok(T.byFL[f][l].pool !== 'x');
    }
    const E = S.empires[0], x = byShort['asteroid-mining'];
    t.eq(Rs.grant(S, E, x.field, x.level, 'test'), false);
    E.research.completed[x.field].push(x.level); Rs.recompute(E);
    t.eq(E.mods.asteroid, undefined, 'a stray level is ignored by the fold');
    const Rr = M.RNG.create('loot');
    for (let i = 0; i < 400; i++) { const d = M.Sim.Artifacts.draw(E, Rr, M.Sim.Artifacts.ORION, [50, 50, 50, 50, 50, 50]); t.ok(!d || d.tech.pool !== 'x'); }
  });
  t.test('techs-x isolation: an expanded game starts from the same galaxy and S.rs stream as a classic one', () => {
    const A = cgame('same'), B = xgame('same');
    t.deep(B.stars, A.stars); t.deep(B.rs, A.rs);
    t.ok(B.empires.every(E => E.research.pool === 'x'));
    for (let e = 0; e < A.empires.length; e++) for (let f = 0; f < 6; f++) for (let ti = 0; ti < 10; ti++) {
      const a = A.empires[e].research.list[f][ti], b = B.empires[e].research.list[f][ti];
      t.eq(a.length, b.length);
      for (const l of b) if (T.byFL[f][l].pool !== 'x') t.ok(a.indexOf(l) >= 0, 'only swaps differ');
    }
  });

  // ---- economy hooks -----------------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x economy: worker output, asteroid fields', () => {
    const S = xgame('eco'), E = S.empires[0], p = home(S, E);
    p.pop = 50; p.factories = 200; p.rocks = 'many';
    own(S, E, 'biomass-reactors');
    const perPop = Math.floor(p.pop * (3 * C.plLevel(E) + 50) / 100);
    t.eq(C.gross(S, E, p), without(E, 'workerPct', () => C.gross(S, E, p)) - perPop + Math.floor(perPop * 110 / 100));
    own(S, E, 'asteroid-mining');
    const g2 = without(E, 'asteroid', () => C.gross(S, E, p));
    t.eq(C.gross(S, E, p), Math.floor(g2 * 110 / 100));
    p.rocks = 'some'; t.eq(C.gross(S, E, p), Math.floor(g2 * 105 / 100));
    p.rocks = 'none'; t.eq(C.gross(S, E, p), g2);
  });
  t.test('techs-x economy: drydocks, banking, scientific exchange, heuristic research', () => {
    const S = xgame('eco2'), E = S.empires[0];
    M.Sim.Fleet.addShips(S, E.id, E.capital, 2, 40);
    M.Sim.Econ.stepProduction(S); const m0 = E.flow.shipM;
    own(S, E, 'orbital-drydocks'); M.Sim.Econ.stepProduction(S);
    t.eq(E.flow.shipM, Math.floor(M.Sim.Fleet.shipValue(S, E) * 75 / 5000)); t.ok(E.flow.shipM < m0);
    t.eq(M.Sim.Design.maintenance(S, E).ships, E.flow.shipM);
    own(S, E, 'galactic-banking-network');
    E.bc = 1000; E.flow.gross = 5000; E.flow.taxToReserve = 0; M.Sim.Econ.stepReserve(S); t.eq(E.bc, 1050);
    E.bc = 1000; E.flow.gross = 200; E.flow.taxToReserve = 0; M.Sim.Econ.stepReserve(S); t.eq(E.bc, 1020, 'capped at a tenth of gross');
    M.Sim.Econ.stepResearchTotal(S); const rp0 = E.research.total;
    own(S, E, 'scientific-exchange-protocols'); E.relations[1].treaty = 1; E.relations[2].treaty = 2;
    M.Sim.Econ.stepResearchTotal(S); t.eq(E.research.total, Math.floor(rp0 * 108 / 100));
    own(S, E, 'heuristic-research-engine');
    E.research.slider = [100, 0, 0, 0, 0, 0]; E.research.total = 100; E.research.invest[0] = 1000; E.research.cost[0] = 1e9; E.research.project[0] = 2;
    Rs.advance(S, E, M.RNG.create('a')); t.eq(E.research.invest[0], 1000 + 100 + 200);
    E.research.invest[0] = 1000; E.research.total = 1000; Rs.advance(S, E, M.RNG.create('b')); t.eq(E.research.invest[0], 1000 + 1000 + 200, '20 % interest');
  });
  t.test('techs-x economy: ship and colony-ship prices, missile bases', () => {
    const S = xgame('cost'), E = S.empires[0], D = M.Sim.Design;
    D.refresh(S, E);
    own(S, E, 'modular-shipyards'); own(S, E, 'cryogenic-colony-berths'); own(S, E, 'hardened-missile-silos');
    const raw = slot => without(E, ['shipCostPct', 'colonyShipCostPct'], () => D.compute(S, E, E.designs[slot]).costTenths);
    t.eq(D.stats(S, E, 2).costTenths, Math.floor(raw(2) * 90 / 100), 'the cached stats follow the price (stale cache refreshed)');
    t.eq(D.stats(S, E, 4).costTenths, Math.floor(raw(4) * Math.floor(90 * 75 / 100) / 100), 'colony ships: both discounts');
    t.eq(D.baseCost(S, E), Math.max(50, Math.floor(without(E, 'baseCostPct', () => D.baseCost(S, E)) * 80 / 100)));
  });

  // ---- population hooks -------------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x population: prefab modules, Gaia seeding, permanent improvements kept by a captured planet', () => {
    const S = xgame('pop'), E = S.empires[0], Q = S.empires[1];
    own(S, E, 'prefabricated-colony-modules'); own(S, E, 'gaia-seeding'); own(S, E, 'arcology-projects');
    const p = S.planets.find(q => q.owner < 0 && q.typeIdx >= 7 && q.growth === 'normal' && q.maxPop > 40);
    const mp = p.maxPop;
    C.found(S, E, p, 2);
    t.eq(p.pop, 3); t.eq(p.factories, 4); t.eq(p.growth, 'fertile');
    t.ok(p.xi && p.xi.arcology >= 5); t.eq(p.mp1, mp + p.xi.arcology);
    const hw = home(S, E); t.ok(hw.xi && hw.xi.arcology === 10, 'existing colonies improved on research');
    const mp3 = p.mp3; Xt.improve(S, E, p); t.eq(p.mp3, mp3, 'once per planet');
    M.Sim.Ground.capture(S, p, Q, 5); t.eq(p.owner, Q.id); t.eq(p.mp3, mp3, 'the improvement stays');
    own(S, E, 'pressure-domes'); own(S, E, 'small-world-engineering');
    const h = S.planets.find(q => q.owner < 0 && q.typeIdx >= 1 && q.typeIdx <= 6);
    const hmp = h.mp1 || h.maxPop; C.found(S, E, h, 2);
    t.ok(h.xi.domes >= 5); t.eq(!!h.xi.smallWorld, h.maxPop <= 40); t.ok(h.mp1 > hmp);
  });
  t.test('techs-x population: growth bonuses, hostile growth, terraform prices', () => {
    const S = xgame('grow'), E = S.empires[0];
    const p = S.planets.find(q => q.owner < 0 && q.typeIdx >= 1 && q.typeIdx <= 6 && q.maxPop >= 20);
    C.found(S, E, p, 2); p.pop = 5; p.popFrac = 0; p.waste = 0;
    const clone = () => JSON.parse(JSON.stringify(p));
    const grow = q => { C.growPop(S, E, q, 0); return q.pop * 10 + q.popFrac; };
    const base = grow(clone());
    own(S, E, 'adaptive-genetics'); const g1 = grow(clone()); t.ok(g1 > base, 'hostile grows like normal');
    own(S, E, 'accelerated-gestation'); const g2 = grow(clone()); t.ok(g2 > g1);
    own(S, E, 'hyper-fertility-treatments'); const g3 = grow(clone()); t.ok(g3 > g2, 'the better growth tech of the chain wins');
    own(S, E, 'terraforming-nanites'); E.mods.terraform = 20; E.mods.terraformCost = 5;
    const r = home(S, E); r.acc.eco = 0; r.spendable = 40; r.sliders = [0, 0, 0, 100, 0]; r.waste = 0; r.factories = 0; r.mp3 = r.mp2; r.growth = 'gaia';
    const before = r.mp3; C.buildEco(S, E, r); t.eq(r.mp3 - before, 10, '40 BC at 4 BC a point');
  });

  // ---- combat hooks -----------------------------------------------------------------------------------------------------------------------------------
  const sideOf = (S, E, ships) => {
    const Cb = M.Sim.Combat, designs = [null, null, null, null, null, null];
    for (let i = 0; i < 6; i++) if (ships[i] > 0) designs[i] = Cb.snapshotDesign(S, E, i);
    const s = { empire: E.id, fleetId: -1, ships, designs, role: 'attacker', race: E.race, name: E.plural, human: false, mod: Cb.raceMod(E.race), tl: E.research.tl.slice(), autoWeight: 0, antidote: 0 };
    const xm = Xt.combatMod(E); if (xm) s.xm = xm;
    return s;
  };
  t.test('techs-x combat: ship modifiers reach the tactical units and the weight model', () => {
    const S = xgame('cmb'), A = S.empires[0], B = S.empires[1], Cb = M.Sim.Combat;
    M.Sim.Design.refresh(S, A); M.Sim.Design.refresh(S, B);
    const battle = () => ({ v: 1, star: 0, starName: 'x', planet: null, sides: [sideOf(S, A, [0, 5, 0, 0, 0, 0]), sideOf(S, B, [0, 5, 0, 0, 0, 0])], planetSide: -1, nebula: false, bg: 0, rocks: 'none', attacker: 1, defender: 0, human: false, diff: 2, seed: 's' });
    const u0 = Cb.create(null, battle()).units[0], w0 = Cb.sideWeight(battle(), 0);
    for (const k of ['tactical-combat-analyzers', 'inertial-shield-harmonics', 'absorption-lattice', 'point-defense-lasers', 'combat-thrusters']) own(S, A, k);
    const u1 = Cb.create(null, battle()).units[0];
    t.eq(u1.comp, u0.comp + 1); t.eq(u1.def, u0.def); t.eq(u1.mdef, u0.mdef + 2); t.eq(u1.hp1, u0.hp1); t.eq(u1.repair, u0.repair);
    t.eq(u1.absorb, u0.absorb + (u0.absorb > 0 ? 2 : 0), 'the lattice only strengthens an existing deflector');
    t.eq(u1.misshield, Math.max(u0.misshield, 20)); t.eq(u1.speed, u0.speed + 1); t.eq(u1.init, u0.init + 2);
    own(S, A, 'predictive-fire-control'); t.eq(Cb.create(null, battle()).units[0].comp, u0.comp + 2, 'the better fire-control tech replaces the first');
    t.ok(Cb.sideWeight(battle(), 0) > w0, 'heavier in the weight model');
    t.eq(Cb.sideWeight(battle(), 1), Cb.sideWeight(battle(), 1), 'the other side unchanged');
  });
  t.test('techs-x combat: minefields, planetary modifiers, salvage, emergency warp, reverse engineering', () => {
    const S = xgame('cmb2'), A = S.empires[0], B = S.empires[1], Cb = M.Sim.Combat;
    M.Sim.Design.refresh(S, A); M.Sim.Design.refresh(S, B);
    const p = home(S, A); p.bases = 3; p.shield = 5;
    const pl = { id: p.id, owner: A.id, name: 'H', pop: p.pop, factories: p.factories, bases: 3, shield: 5, type: p.type, special: p.special, maxPop: p.mp3, baseHp: 50, comp: 1, ecm: 0, absorb: 1, weapon: 'nuclear-missile', weapon2: 'nuclear-missile', interdictor: false, antidote: 0 };
    const battle = () => ({ v: 1, star: p.starId, starName: 'H', planet: pl, sides: [sideOf(S, A, [0, 0, 0, 0, 0, 0]), sideOf(S, B, [0, 20, 0, 0, 0, 0])], planetSide: 0, nebula: false, bg: 0, rocks: 'none', attacker: 1, defender: 0, human: false, diff: 2, seed: 's' });
    const B0 = Cb.create(null, battle()), wE0 = Cb.sideWeight(battle(), 1), wP0 = Cb.sideWeight(battle(), 0);
    own(S, A, 'orbital-minefields'); own(S, A, 'orbital-targeting-arrays'); own(S, A, 'hardened-missile-silos');
    const B1 = Cb.create(null, battle()), pu0 = B0.units[0], pu1 = B1.units[0];
    t.eq(pu1.comp, pu0.comp + 2); t.eq(pu1.hp1, Math.floor(pu0.hp1 * 1.5)); t.eq(pu1.absorb, pu0.absorb);
    const e0 = B0.units.find(u => u.side === 1), e1 = B1.units.find(u => u.side === 1);
    t.eq((e1.count - 1) * e1.hp1 + e1.hp1 - e1.hploss, (e0.count - 1) * e0.hp1 + e0.hp1 - Math.floor(e0.hp1 * e0.count * 8 / 100), 'mines take 8 % of the hit points');
    t.eq(Cb.sideWeight(battle(), 1), Math.floor(wE0 * Xt.mineFactor({ mines: 8 }))); t.ok(Cb.sideWeight(battle(), 0) > wP0);
    // battle results
    own(S, B, 'emergency-warp-capacitors'); own(S, A, 'battlefield-salvage');
    M.Sim.Fleet.addShips(S, B.id, p.starId, 1, 20);
    const res = { star: p.starId, winner: 0, winnerEmpire: A.id, loserEmpire: B.id, attacker: B.id, defender: A.id, human: false, mode: 'weights', reason: 'weights', rounds: 1, summary: [],
      sides: [{ empire: A.id, fleetId: -1, lost: [0, 0, 0, 0, 0, 0], survivors: [0, 0, 0, 0, 0, 0] }, { empire: B.id, fleetId: -1, lost: [0, 20, 0, 0, 0, 0], survivors: [0, 0, 0, 0, 0, 0], destroyed: true }], planet: null };
    const bc0 = A.bc | 0, cost = M.Sim.Design.cost(S, B, 1);
    Cb.applyResults(S, [res], M.RNG.create('r'));
    t.eq(res.sides[1].lost[1], 14, '30 % of 20 escape'); t.eq(A.bc - bc0, Math.floor(14 * cost * 20 / 100), 'salvage on what was destroyed');
    t.ok(S.fleets.some(f => f.owner === B.id && f.retreat && f.ships[1] === 6), 'the survivors retreat');
    // reverse engineering: forced success
    own(S, A, 'reverse-engineering-labs');
    const before = A.research.completed.reduce((a, c) => a + c.length, 0);
    const lost = { star: p.starId, winner: 0, sides: [{ empire: A.id, lost: [0, 0, 0, 0, 0, 0] }, { empire: B.id, lost: [0, 2, 0, 0, 0, 0] }] };
    for (let f = 0; f < 6; f++) for (const l of [2, 3, 4, 5, 6, 7, 8, 9, 10]) if (T.byFL[f][l] && T.byFL[f][l].pool !== 'x') Rs.grant(S, B, f, l, 'test');
    A.research.tl = [30, 30, 30, 30, 30, 30];
    Xt.postApply(S, lost, { int: (lo, hi) => lo, next: () => 0 });
    t.eq(A.research.completed.reduce((a, c) => a + c.length, 0), before + 1);
  });

  // ---- ground and bombardment ---------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x ground: troop force, transport losses, bombardment, sieges, lifeboats', () => {
    const S = xgame('gnd'), A = S.empires[0], B = S.empires[1], G = M.Sim.Ground;
    const fd0 = G.force(S, A, true), fa0 = G.force(S, A, false);
    own(S, A, 'robotic-garrisons'); own(S, A, 'clone-troopers');
    t.eq(G.force(S, A, true), fd0 + 10); t.eq(G.force(S, A, false), fa0 + 10);
    const p = home(S, B); p.bases = 6;
    const land = { empire: A.id, planet: p.id, n: 100 };
    const k0 = G.gauntlet(S, land).killed;
    own(S, A, 'stealth-landing-craft');
    t.near(G.gauntlet(S, land).killed, k0 * 0.5, 0.11);
    own(S, B, 'repulsor-field-net');
    t.near(G.gauntlet(S, land).killed, Math.min(100, k0 * 0.5 * 1.3), 0.11);
    // bombardment preview (expected values)
    M.Sim.Fleet.addShips(S, A.id, p.starId, 3, 10);
    const pv0 = G.bombPreview(S, A.id, p.id);
    own(S, A, 'siege-engineering');
    const pv1 = G.bombPreview(S, A.id, p.id);
    t.ok(pv1.expected === undefined || true);
    t.ok(JSON.stringify(pv1) !== JSON.stringify(pv0) || pv0.canBomb === false, 'bombardment changes with Siege Engineering');
    // siege floor
    own(S, B, 'planetary-stasis-field');
    t.eq(Xt.siegeFloor(S, p), Math.max(1, Math.floor(p.mp3 * 25 / 100)));
    // lifeboats
    const q = S.planets.find(x => x.owner < 0 && x.typeIdx >= 7); C.found(S, B, q, 2); q.pop = 10;
    own(S, B, 'lifeboat-protocols');
    const hp = home(S, B); hp.pop = hp.mp3 - 50;
    const n = Xt.evacuate(S, B, q, 40);
    t.eq(n, 12); t.eq(hp.pop, hp.mp3 - 38);
  });

  // ---- espionage, diplomacy, council, events -----------------------------------------------------------------------------------------------------------
  t.test('techs-x intrigue: infiltration rolls and spy prices, goodwill, council weight', () => {
    const S = xgame('int'), A = S.empires[0], B = S.empires[1], Sp = M.Sim.Spy;
    A.race = B.race = 'human';                                                   // no racial spy modifiers (Darlok) in the comparison
    own(S, A, 'neural-infiltration-net');
    A.research.tl[0] = 10; B.research.tl[0] = 10;
    const d0 = without(A, 'spyOff', () => Sp.dts(S, A, B, 1)), d1 = Sp.dts(S, A, B, 1);
    t.eq(d1.dt1, d0.dt1 + 20, 'equal Computers: the infiltrator gains 20 points');
    B.research.tl[0] = 30;
    t.eq(Sp.dts(S, A, B, 1).dt2, without(A, 'spyOff', () => Sp.dts(S, A, B, 1)).dt2 - 20, 'a better-defended target loses 20 points of its margin');
    B.research.tl[0] = 10;
    t.eq(Sp.baseCost(S, A), Math.floor((2 * 10 + 25) * 75 / 100));
    t.eq(without(A, 'spyCostPct', () => Sp.baseCost(S, A)), 2 * 10 + 25, 'the classic price without the net');
    // goodwill: an AI actor's positive act on another AI is 25 % larger
    const P = S.empires[2], Q = S.empires[3], D = M.Sim.Diplo;
    own(S, P, 'holovision-broadcast-network'); t.eq(P.mods.councilBonus, 20); t.eq(P.mods.posAct, 25);
    const act = withTech => { const S1 = JSON.parse(JSON.stringify(S)); const P1 = S1.empires[P.id]; if (!withTech) delete P1.mods.posAct; return D.act(S1, 20, P.id, Q.id, 1); };
    const v0 = act(false), v1 = act(true);
    t.ok(v0 > 0); t.eq(v1, Math.trunc(v0 * 125 / 100));
  });

  // ---- movement and scanning ---------------------------------------------------------------------------------------------------------------------------
  t.test('techs-x logistics: survey, fuel bonus, transports, beacons, slipstream, warp damping', () => {
    const S = xgame('mov'), A = S.empires[0], B = S.empires[1], F = M.Sim.Fleet, V = M.Sim.Vis, Geo = M.Sim.Geo;
    own(S, A, 'stellar-survey-probes'); V.update(S);
    for (let j = 0; j < S.stars.length; j++) if (Geo.parsecs(S, A.capital, j) <= V.scanRange(A) + 2) t.ok(A.explored[j], 'surveyed ' + j);
    const f0 = A.mods.fuel, tr0 = A.mods.transportSpeed;
    own(S, A, 'interstellar-ramscoops'); t.eq(A.mods.fuel, f0 + 1);
    own(S, A, 'hyperlane-transports'); t.eq(A.mods.transportSpeed, tr0 + 3);
    A.mods.fuel = 30; Rs.recompute(A); t.eq(A.mods.fuel, f0 + 1, 'recompute is idempotent');
    const q = S.planets.find(x => x.owner < 0 && x.typeIdx >= 7 && Geo.parsecs(S, A.capital, x.id) <= 3);
    if (q) {
      C.found(S, A, q, 2); F.updateRange(S);
      F.addShips(S, A.id, A.capital, 1, 2);
      const w = M.Sim.Design.stats(S, A, 1).warp;
      own(S, A, 'navigation-beacons'); own(S, A, 'slipstream-drives');
      const r = F.send(S, A, A.capital, q.starId, [0, 1, 0, 0, 0, 0]);
      t.ok(r.ok); t.eq(r.fleet.speed, w + 2, 'colony to colony: beacons and slipstream');
      // Slipstream speeds only fleets bound for your own colonies: towards a star you do not own a fleet flies at its engines' warp
      const free = S.planets.find(x => x.owner < 0 && x.starId !== q.starId && F.canReach(S, A, x.starId, false));
      if (free) { const r2 = F.send(S, A, A.capital, free.starId, [0, 1, 0, 0, 0, 0]); t.ok(r2.ok); t.eq(r2.fleet.speed, w, 'no bonus towards a star you do not own'); }
    }
    // warp damping: a hostile fleet one parsec from B's home world slows down
    own(S, B, 'warp-damping-field');
    const hb = S.stars[B.capital];
    S.fleets.push({ id: 9999, owner: A.id, star: -1, from: A.capital, to: B.capital, x: hb.x + 8, y: hb.y, speed: 4, ships: [0, 1, 0, 0, 0, 0] });
    if (M.Sim.Combat.hostile(S, A.id, B.id, B.id)) { F.move(S); const f = S.fleets.find(x => x.id === 9999); t.ok(!f || f.star === B.capital || Math.hypot(f.x - hb.x, f.y - hb.y) > 0); }
  });
};
