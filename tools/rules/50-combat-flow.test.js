// Tactical combat — who fights whom, auto-resolve, the AI, retreat, monsters, applyResults bookkeeping, determinism, performance (research/03 §4.1, §4.11–4.15).
module.exports = function (M, t) {
  const F = require('./50-combat.test.js').fixtures(M), C = F.C, D = F.D;
  const LASER = F.LASER;
  const noDiplo = fn => { const saved = M.Sim.Diplo; M.Sim.Diplo = undefined; try { return fn(); } finally { M.Sim.Diplo = saved; } };
  const war = fn => F.withDiplo(() => 3, fn);
  // two empires, a few stars; slot-0 designs
  function world(o) {
    const S = F.mkWorld(o);
    F.setDesign(S.empires[0], 0, LASER(1)); F.setDesign(S.empires[1], 0, LASER(2));
    return S;
  }

  // ---------------------------------------------------------------------------------------------------------------- findBattles (§4.1)
  t.test('findBattles: hostile fleets at a star give ONE battle; the planet owner / lowest empire is the defender (left), the other the attacker (right)', () => {
    const S = world(); const f0 = F.fleet(S, 0, 1, [3, 0, 0, 0, 0, 0]), f1 = F.fleet(S, 1, 1, [2, 0, 0, 0, 0, 0]);
    const bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 1);
    const b = bs[0];
    t.eq(b.star, 1); t.eq(b.sides[0].empire, 0); t.eq(b.sides[0].role, 'defender'); t.eq(b.sides[1].empire, 1); t.eq(b.sides[1].role, 'attacker');
    t.eq(b.attacker, 1); t.eq(b.defender, 0); t.eq(b.human, false); t.eq(b.planet, null); t.eq(b.planetSide, -1);
    t.eq(b.sides[0].fleetId, f0.id); t.eq(b.sides[1].fleetId, f1.id); t.deep(b.sides[0].ships, [3, 0, 0, 0, 0, 0]); t.deep(b.sides[1].ships, [2, 0, 0, 0, 0, 0]);
    t.eq(b.sides[0].designs[0].weapons[0].id, 'laser'); t.eq(b.sides[1].designs[0].weapons[0].count, 2); t.eq(b.sides[0].designs[1], null);
    t.deep(JSON.parse(JSON.stringify(b)), b);
  });
  t.test('findBattles: the human is always the left side, whoever attacks; the planet follows its owner', () => {
    const S = world(); S.empires[0].human = true;
    own(S, 1, 1, { bases: 2 });
    F.fleet(S, 0, 1, [3, 0, 0, 0, 0, 0]);
    const bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 1);
    const b = bs[0];
    t.eq(b.sides[0].empire, 0); t.eq(b.sides[0].role, 'attacker'); t.eq(b.sides[1].empire, 1); t.eq(b.sides[1].role, 'defender'); t.eq(b.human, true);
    t.eq(b.planetSide, 1); t.eq(b.planet.owner, 1); t.eq(b.planet.bases, 2); t.eq(b.attacker, 0); t.eq(b.defender, 1);
    // the same star seen from the other side: the AI attacks the human's planet
    const S2 = world(); S2.empires[0].human = true; own(S2, 2, 0, { bases: 1 }); F.fleet(S2, 1, 2, [1, 0, 0, 0, 0, 0]);
    const b2 = war(() => C.findBattles(S2, null))[0];
    t.eq(b2.sides[0].empire, 0); t.eq(b2.planetSide, 0); t.eq(b2.sides[1].role, 'attacker');
  });
  function own(S, planet, owner, o) { return F.own(S, planet, owner, o); }
  t.test('findBattles: a planet with missile bases defends alone; a planet without bases (and no ships) is no party — the visitors bombard unopposed instead', () => {
    const S = world(); own(S, 1, 1, { bases: 3, pop: 30 }); F.fleet(S, 0, 1, [2, 0, 0, 0, 0, 0]);
    let bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 1); t.eq(bs[0].sides[0].empire, 1); t.deep(bs[0].sides[0].ships, [0, 0, 0, 0, 0, 0]); t.eq(bs[0].planet.bases, 3); t.eq(bs[0].planetSide, 0);
    t.deep(S.bombard, []);
    S.planets[1].bases = 0;
    bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 0);
    t.deep(S.bombard, [{ empire: 0, planet: 1, target: 1, star: 1 }]);
    S.planets[1].pop = 0;
    war(() => C.findBattles(S, null)); t.deep(S.bombard, []);
  });
  t.test('findBattles: unarmed visitors do not bombard; allies do not bombard; the owner\'s own ships make it a battle instead', () => {
    const S = world(); own(S, 1, 1, { bases: 0, pop: 30 });
    F.setDesign(S.empires[0], 1, { hull: 0, engine: 'retro-engine', man: 0, armor: 'titanium-armor' });      // a scout
    F.fleet(S, 0, 1, [0, 2, 0, 0, 0, 0]);
    war(() => C.findBattles(S, null)); t.deep(S.bombard, []);
    S.fleets[0].ships = [2, 0, 0, 0, 0, 0];
    F.withDiplo(() => 2, () => { C.findBattles(S, null); t.deep(S.bombard, []); });
    F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]);
    const bs = war(() => C.findBattles(S, null)); t.eq(bs.length, 1);
  });
  t.test('findBattles: without a Diplomacy module nobody is at war; alliances and pacts decide the rest (no treaty = hostile, NAP protects only third-party systems)', () => {
    const S = world(); F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]); F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]);
    t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);
    t.eq(F.withDiplo(() => 2, () => C.findBattles(S, null)).length, 0);
    t.eq(F.withDiplo(() => 0, () => C.findBattles(S, null)).length, 1);
    t.eq(F.withDiplo(() => 3, () => C.findBattles(S, null)).length, 1);
    t.eq(F.withDiplo(() => 4, () => C.findBattles(S, null)).length, 1);
    t.eq(F.withDiplo(() => 1, () => C.findBattles(S, null)).length, 0);                                    // NAP at a neutral star
    own(S, 1, 1, { bases: 0 });
    t.eq(F.withDiplo(() => 1, () => C.findBattles(S, null)).length, 1);                                    // ... but not at the owner's own planet
    const T = world(); F.fleet(T, 0, 1, [1, 0, 0, 0, 0, 0]); F.fleet(T, 1, 2, [1, 0, 0, 0, 0, 0]);
    t.eq(F.withDiplo(() => 3, () => C.findBattles(T, null)).length, 0);                                    // different stars
  });
  t.test('findBattles: fleets in flight, dead empires and empty fleets never fight; three parties give one battle (planet owner first)', () => {
    const S = world({ empires: 3 }); F.setDesign(S.empires[2], 0, LASER(1));
    F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]); const mv = F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]); mv.star = -1; mv.to = 2;
    t.eq(war(() => C.findBattles(S, null)).length, 0);
    mv.star = 1; mv.to = -1; S.empires[1].alive = false;
    t.eq(war(() => C.findBattles(S, null)).length, 0);
    S.empires[1].alive = true; F.fleet(S, 2, 1, [4, 0, 0, 0, 0, 0]); F.fleet(S, 0, 3, [0, 0, 0, 0, 0, 0]);
    own(S, 1, 2, { bases: 0 });
    const bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 1); t.eq(bs[0].sides[0].empire, 2); t.eq(bs[0].sides[0].role, 'defender'); t.eq(bs[0].sides[1].empire, 0);
  });
  t.test('findBattles: planet snapshot carries the owner\'s base tech — hit points by armor tier 50..200, best missile/scatter pack, computer, ECM, deflector, planetary shield, interdictor, antidote', () => {
    const hp = [50, 75, 100, 125, 150, 175, 200];
    for (let tier = 0; tier < 7; tier++) {
      const S = world(); own(S, 1, 1, { bases: 2, shield: 10 }); F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]);
      Object.assign(S.empires[1].mods, { baseHp: tier, baseMissile: 1 + tier, baseScatter: tier % 3 + 1, baseComp: tier + 2, baseEcm: tier, baseShield: tier + 1, interdictor: tier === 6, antidote: tier % 3 });
      const b = war(() => C.findBattles(S, null))[0], p = b.planet;
      t.eq(p.baseHp, hp[tier]); t.eq(p.weapon, ['nuclear-missile', 'hyper-v', 'hyper-x', 'merculite', 'stinger', 'pulson', 'hercular'][tier]);
      t.eq(p.weapon2, ['scatter-pack-v', 'scatter-pack-vii', 'scatter-pack-x'][tier % 3]); t.eq(p.comp, tier + 2); t.eq(p.ecm, tier); t.eq(p.absorb, tier + 1); t.eq(p.shield, 10);
      t.eq(p.interdictor, tier === 6); t.eq(p.antidote, tier % 3); t.eq(p.pop, 40); t.eq(p.factories, 20);
    }
    const S = world(); own(S, 1, 1, { bases: 2 }); F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]);
    const b = war(() => C.findBattles(S, null))[0];
    t.eq(b.planet.weapon, 'nuclear-missile'); t.eq(b.planet.weapon2, 'nuclear-missile'); t.eq(b.planet.baseHp, 50); t.eq(b.planet.comp, 1);
  });
  t.test('findBattles: nebula, backdrop and rocks come from the star; the seed is unique per star and turn', () => {
    const S = world(); F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]); F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]); F.fleet(S, 0, 2, [1, 0, 0, 0, 0, 0]); F.fleet(S, 1, 2, [1, 0, 0, 0, 0, 0]);
    S.stars[2].nebula = true; S.planets[2].rocks = 'many'; S.planets[2].bg = 3;
    const bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 2); t.eq(bs[0].nebula, false); t.eq(bs[1].nebula, true); t.eq(bs[1].rocks, 'many'); t.eq(bs[1].bg, 3); t.ok(bs[0].seed !== bs[1].seed);
  });
  t.test('findBattles: the Orion Guardian fights every empire party at Orion (one battle each, never empire vs empire); a dead Guardian is gone', () => {
    const S = world({ stars: 5 }); S.orion = 3; S.guardian = { alive: true, star: 3 }; S.settings.diffIdx = 3;
    F.fleet(S, 0, 3, [2, 0, 0, 0, 0, 0]); F.fleet(S, 1, 3, [3, 0, 0, 0, 0, 0]);
    const bs = war(() => C.findBattles(S, null));
    t.eq(bs.length, 2);
    for (const b of bs) {
      const m = b.sides[1];
      t.eq(m.empire, -1); t.eq(m.monster.kind, 'guardian'); t.eq(b.attacker, -1); t.eq(m.designs[0].hp, 8000); t.eq(m.role, 'attacker'); t.deep(m.ships, [1, 0, 0, 0, 0, 0]);
    }
    t.deep(bs.map(b => b.sides[0].empire), [0, 1]);
    S.guardian.alive = false;
    t.eq(war(() => C.findBattles(S, null)).length, 1);                                                      // only the empire-vs-empire fight is left
    S.guardian.alive = true; S.fleets.length = 0; F.fleet(S, 0, 2, [2, 0, 0, 0, 0, 0]);
    t.eq(war(() => C.findBattles(S, null)).length, 0);
  });
  t.test('findBattles: roaming monsters (S.monsters, Sim.Events model) attack colonies and fleets unless resting, gone, killed or in flight', () => {
    const S = world({ stars: 4 }); S.settings.diffIdx = 1;
    own(S, 2, 0, { bases: 2, pop: 20 });
    S.monsters = [{ id: 7, kind: 'amoeba', star: 2 }];
    let bs = noDiplo(() => C.findBattles(S, null));
    t.eq(bs.length, 1); t.eq(bs[0].sides[1].monster.kind, 'amoeba'); t.eq(bs[0].sides[1].monster.id, 7); t.eq(bs[0].sides[1].designs[0].hp, 2000); t.eq(bs[0].planetSide, 0); t.eq(bs[0].planet.bases, 2);
    S.monsters[0].attackable = false; t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);                      // resting after a strike (Sim.Events)
    S.monsters[0].attackable = true; S.monsters[0].gone = true; t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);
    S.monsters[0].gone = false; S.monsters[0].killer = 1; t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);
    S.monsters[0].killer = -1; S.monsters[0].star = -1; t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);
    S.monsters[0] = { id: 8, kind: 'crystal', star: 1 }; F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]);
    bs = noDiplo(() => C.findBattles(S, null));
    t.eq(bs.length, 1); t.eq(bs[0].sides[0].empire, 1); t.eq(bs[0].sides[1].monster.kind, 'crystal'); t.eq(bs[0].sides[1].designs[0].hp, 4000);
    S.settings.options.monsters = false; t.eq(noDiplo(() => C.findBattles(S, null)).length, 0);
  });

  // ---------------------------------------------------------------------------------------------------------------- the original's auto-resolve (§4.12)
  const HEAVY = { hull: 3, comp: 'mark-3-computer', shield: 'class-3-shield', armor: 'zortium-armor', engine: 'ion-engine', man: 2, specials: ['battle-scanner'], weapons: [{ type: 'laser', count: 4 }] };
  t.test('weights: (shield index*5 + computer index*5 + first weapon enum + armor index*10 + 2*sum(special enums) + Construction TL/2 [+15 Mrrshan/Alkari]) x hull weight', () => {
    // Class III = shield index 3, Mark III = 3, Laser = 2, Zortrium = armor index 4, Battle Scanner = 9, Construction TL 20 -> 10, Huge = 125
    const L = F.mkSide({ empire: 0, tl: [1, 20, 1, 1, 1, 1], fleet: [{ draft: HEAVY, n: 3 }] });
    const R = F.mkSide({ empire: 1, race: 'mrrshan', tl: [1, 20, 1, 1, 1, 1], fleet: [{ draft: HEAVY, n: 2 }] });
    const b = F.mkBattle(L, R);
    const w = (3 * 5 + 3 * 5 + 2 + 4 * 10 + 2 * 9 + 10) * 125;
    t.eq(C.sideWeight(b, 0), 3 * w);
    t.eq(C.sideWeight(b, 1), 2 * (w + 15 * 125));
    const A = F.mkSide({ empire: 1, race: 'alkari', tl: [1, 20, 1, 1, 1, 1], fleet: [{ draft: HEAVY, n: 1 }] });
    t.eq(C.sideWeight(F.mkBattle(L, A), 1), w + 15 * 125);
  });
  t.test('weights: small/medium/large/huge hulls weigh 1/5/25/125; slot 0 weapon only; specials count twice their enum', () => {
    const one = hull => C.sideWeight(F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: { hull, engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }] }, n: 1 }] }), F.mkSide({ empire: 1, fleet: [] })), 0);
    t.eq(one(0), 2); t.eq(one(1), 10); t.eq(one(2), 50); t.eq(one(3), 250);
    const sp = C.sideWeight(F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: { hull: 0, engine: 'retro-engine', man: 0, armor: 'titanium-armor', specials: ['reserve-fuel-tanks', 'stasis-field'] }, n: 1 }] }), F.mkSide({ empire: 1, fleet: [] })), 0);
    t.eq(sp, 2 * (1 + 17));
  });
  t.test('weights: the planet adds (Weapons TL + Force Field TL) * 75 per base to its owner; monsters weigh a fixed 100000 (Guardian) / 30000', () => {
    const L = F.mkSide({ empire: 0, tl: [1, 1, 12, 1, 1, 8], fleet: [] }), R = F.mkSide({ empire: 1, fleet: [{ draft: LASER(1), n: 1 }] });
    const b = F.mkBattle(L, R, { planet: F.mkPlanet({ bases: 6 }), planetSide: 0 });
    t.eq(C.sideWeight(b, 0), (8 + 12) * 75 * 6);
    t.eq(C.sideWeight(F.mkBattle(L, C.monsterSide({ kind: 'guardian' }, 2)), 1), 100000);
    t.eq(C.sideWeight(F.mkBattle(L, C.monsterSide({ kind: 'crystal' }, 2)), 1), 30000);
    t.eq(C.sideWeight(F.mkBattle(L, C.monsterSide({ kind: 'amoeba' }, 2)), 1), 30000);
  });
  t.test('weights: attrition loop exactly as written — each iteration the right side loses max(1, d10*WL/100) and the left max(1, d10*WR/100); survivors = count*remaining/W', () => {
    const mk = (nl, nr) => F.mkBattle(F.mkSide({ empire: 0, tl: [1, 20, 1, 1, 1, 1], fleet: [{ draft: HEAVY, n: nl }, { draft: LASER(1), n: nl * 2 }] }), F.mkSide({ empire: 1, role: 'attacker', tl: [1, 20, 1, 1, 1, 1], fleet: [{ draft: HEAVY, n: nr }] }));
    for (let s = 0; s < 40; s++) {
      const nl = 3 + s % 5, nr = 4 + s % 7, b = mk(nl, nr), WL = C.sideWeight(b, 0), WR = C.sideWeight(b, 1);
      const r = M.RNG.create('wt' + s); let wl = WL, wr = WR;
      while (wl > 0 && wr > 0) { wr -= Math.max(1, Math.floor(r.int(1, 10) * WL / 100)); wl -= Math.max(1, Math.floor(r.int(1, 10) * WR / 100)); }
      const res = C.resolve(b, M.RNG.create('wt' + s));
      t.eq(res.mode, 'weights'); t.eq(res.winner, wr > 0 ? 1 : 0);
      const winner = res.winner, rem = Math.max(0, winner === 1 ? wr : wl), W = winner === 1 ? WR : WL;
      for (let k = 0; k < 6; k++) {
        const n = b.sides[winner].ships[k];
        t.eq(res.sides[winner].survivors[k], Math.floor(n * rem / W)); t.eq(res.sides[winner].lost[k], n - Math.floor(n * rem / W));
        t.eq(res.sides[1 - winner].survivors[k], 0); t.eq(res.sides[1 - winner].lost[k], b.sides[1 - winner].ships[k]);
      }
      t.eq(res.sides[1 - winner].destroyed, true); t.eq(res.sides[1 - winner].retreated, false);
    }
  });
  t.test('weights: a double knock-out goes to the left (defender); the attacker wins only with weight left', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 10 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 10 }] }));
    const tens = { int: () => 10 };                       // both sides lose exactly 10% of the other's weight per iteration -> both hit zero together
    const res = C.resolve(b, tens);
    t.eq(res.winner, 0); t.eq(res.rounds, 10);
    const w = C.resolve(b, { int: () => 1 });             // 1% per iteration: equal sides, still a tie -> left
    t.eq(w.winner, 0);
    const big = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 1 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 30 }] }));
    t.eq(C.resolve(big, M.RNG.create('x')).winner, 1);
  });
  t.test('weights: lopsided fights are decided (20:1 always) with the big side keeping most of its ships; equal fleets split roughly evenly', () => {
    let bigWins = 0, kept = 0;
    for (let s = 0; s < 60; s++) {
      const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 1 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 20 }] }));
      const r = C.resolve(b, M.RNG.create('lop' + s));
      if (r.winner === 1) { bigWins++; kept += r.sides[1].survivors[0] / 20; }
    }
    t.eq(bigWins, 60); t.ok(kept / 60 > 0.9);
    let attWins = 0; const N = 300;
    for (let s = 0; s < N; s++) { const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 8 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 8 }] })); if (C.resolve(b, M.RNG.create('eq' + s)).winner === 1) attWins++; }
    t.between(attWins / N, 0.3, 0.6);                                                                       // ties go to the defender
  });
  t.test('weights: missile bases, population and factories are NOT touched by an AI-resolved battle; defending bases do add weight', () => {
    const L = F.mkSide({ empire: 0, tl: [1, 1, 10, 1, 10, 1], fleet: [] }), R = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 3 }] });
    const strongBase = F.mkBattle(L, R, { planet: F.mkPlanet({ bases: 50 }), planetSide: 0 });
    for (let s = 0; s < 20; s++) {
      const r = C.resolve(strongBase, M.RNG.create('pb' + s));
      t.eq(r.winner, 0); t.eq(r.planet.basesLost, 0); t.eq(r.planet.popKilled, 0); t.eq(r.planet.factoriesKilled, 0); t.eq(r.planet.basesLeft, 50);
    }
    const weakBase = F.mkBattle(L, F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 200 }] }), { planet: F.mkPlanet({ bases: 2 }), planetSide: 0 });
    const r = C.resolve(weakBase, M.RNG.create('pb2'));
    t.eq(r.winner, 1); t.eq(r.planet.basesLost, 0);
  });
  t.test('weights: the 32-bit overflow of the original ("doom stack" bug) is not reproduced by default; the switch brings back exactly count*remaining wrapped to 32 bits (negative = 32000)', () => {
    const huge = { hull: 3, comp: 'mark-11-computer', shield: 'class-15-shield', armor: 'neutronium-armor-ii', engine: 'hyperthrust-engine', man: 8, specials: ['sub-space-teleporter', 'displacement-device', 'cloaking-device'], weapons: [{ type: 'mauler-device', count: 8 }] };
    let tried = 0;
    for (let n = 600; n <= 3400; n += 200) {
      const b = F.mkBattle(F.mkSide({ empire: 0, tl: [50, 50, 50, 50, 50, 50], fleet: [{ draft: huge, n }] }), F.mkSide({ empire: 1, role: 'attacker', tl: [50, 50, 50, 50, 50, 50], fleet: [{ draft: huge, n: Math.floor(n / 10) }] }));
      const WL = C.sideWeight(b, 0), WR = C.sideWeight(b, 1), r0 = M.RNG.create('ovf' + n); let wl = WL, wr = WR;
      while (wl > 0 && wr > 0) { wr -= Math.max(1, Math.floor(r0.int(1, 10) * WL / 100)); wl -= Math.max(1, Math.floor(r0.int(1, 10) * WR / 100)); }
      const rem = Math.max(0, wl), sane = Math.floor(n * rem / WL);
      const r = C.resolve(b, M.RNG.create('ovf' + n));
      t.eq(r.winner, 0); t.eq(r.sides[0].survivors[0], sane); t.ok(sane > n * 0.8 && sane <= n);
      C.CONFIG.overflowBug = true;
      try {
        const q = C.resolve(b, M.RNG.create('ovf' + n));
        let v = Math.trunc(Math.imul(n, rem | 0) / WL); if (v < 0) v = 32000;
        t.eq(q.sides[0].survivors[0], Math.min(n, v));
        tried++;
      } finally { C.CONFIG.overflowBug = false; }
    }
    t.ok(tried > 5);
  });
  t.test('resolve: AI-vs-AI uses the weight model, a battle with a human on board (the Auto button) or opts.full runs the tactical simulation; the worker op is the same call', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(2), n: 4 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(2), n: 3 }] }));
    t.eq(C.resolve(b, M.RNG.create(1)).mode, 'weights');
    t.eq(C.resolve(b, M.RNG.create(1), { full: true }).mode, 'tactical');
    const h = Object.assign({}, b, { human: true });
    t.eq(C.resolve(h, M.RNG.create(1)).mode, 'tactical');
    t.deep(M.Ops.resolveBattle({ battle: b, seed: 'op' }), C.resolve(b, M.RNG.create('op')));
    t.deep(M.Ops.resolveBattle({ battle: b, seed: 'op', opts: { full: true } }), C.resolve(b, M.RNG.create('op'), { full: true }));
  });

  // ---------------------------------------------------------------------------------------------------------------- the engine's AI playing both sides (§4.13)
  const full = (b, seed) => C.resolve(b, M.RNG.create(seed || 's'), { full: true });
  t.test('tactical sim: the stronger fleet wins whichever side it is on, and the result is consistent (lost + survivors = fleet, one winner, summary lines)', () => {
    const strong = { hull: 2, comp: 'mark-5-computer', shield: 'class-3-shield', armor: 'zortium-armor', engine: 'ion-engine', man: 4, weapons: [{ type: 'fusion-beam', count: 4 }] };
    const weak = LASER(1);
    for (const swap of [false, true]) {
      const A = F.mkSide({ empire: 0, role: swap ? 'attacker' : 'defender', tl: [20, 20, 20, 20, 20, 20], fleet: [{ draft: strong, n: 4 }] }), B = F.mkSide({ empire: 1, role: swap ? 'defender' : 'attacker', fleet: [{ draft: weak, n: 6 }] });
      const b = swap ? F.mkBattle(B, A, { attacker: 0, defender: 1 }) : F.mkBattle(A, B);
      const r = full(b, 'str' + swap), si = swap ? 1 : 0;
      t.eq(r.winner, si); t.eq(r.mode, 'tactical');
      for (let i = 0; i < 2; i++) for (let k = 0; k < 6; k++) t.eq(r.sides[i].lost[k] + r.sides[i].survivors[k], b.sides[i].ships[k]);
      t.ok(r.sides[1 - si].destroyed || r.sides[1 - si].retreated); t.ok(r.sides[si].survivors[0] > 0); t.ok(r.rounds >= 1 && r.rounds <= 50); t.ok(r.summary.length >= 1);
      t.eq(r.reason, 'wiped');
    }
  });
  t.test('tactical sim: a planet with bases shoots and falls — bases lost, collateral pop/factory kills reported, bases stay at 0 or more', () => {
    const attackers = { hull: 2, comp: 'mark-5-computer', shield: 'class-3-shield', armor: 'zortium-armor', engine: 'fusion-engine', man: 3, weapons: [{ type: 'phasor', count: 8 }] };
    const L = F.mkSide({ empire: 0, fleet: [] }), R = F.mkSide({ empire: 1, role: 'attacker', tl: [20, 20, 20, 20, 20, 20], fleet: [{ draft: attackers, n: 10 }] });
    const b = F.mkBattle(L, R, { planet: F.mkPlanet({ bases: 4, pop: 60, factories: 80, shield: 0 }), planetSide: 0, rocks: 'none' });
    const r = full(b, 'plan');
    t.eq(r.winner, 1); t.eq(r.planet.basesLost, 4); t.eq(r.planet.basesLeft, 0);
    t.ok(r.planet.popKilled + r.planet.factoriesKilled > 0, 'collateral damage');
    t.ok(r.planet.popLeft === 60 - r.planet.popKilled && r.planet.factoriesLeft === 80 - r.planet.factoriesKilled);
    t.ok(r.sides[1].lost[0] >= 0 && r.sides[1].survivors[0] > 0);
  });
  t.test('tactical sim: a strong shield and planetary shield make a base immune to lasers (the attackers cannot win and leave)', () => {
    const L = F.mkSide({ empire: 0, fleet: [] }), R = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(4), n: 3 }] });
    const b = F.mkBattle(L, R, { planet: F.mkPlanet({ bases: 6, shield: 20, absorb: 5, comp: 5, baseHp: 200, weapon: 'hercular' }), planetSide: 0 });
    const r = full(b, 'imm');
    t.eq(r.planet.basesLost, 0); t.eq(r.winner, 0); t.eq(r.sides[1].destroyed || r.sides[1].retreated, true);
  });
  t.test('AI: unarmed ships on the AI side retreat at the first chance (flag, run, leave next round); on the human\'s automated side they stay at the start line', () => {
    const colony = { hull: 2, engine: 'retro-engine', man: 0, armor: 'titanium-armor', specials: ['standard-colony-base'] };
    const mk = side => {
      const armed = F.mkSide({ empire: 0, role: 'defender', fleet: [{ draft: LASER(3), n: 2 }] }), civ = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: colony, n: 3 }] });
      return side === 'right' ? F.mkBattle(armed, civ) : F.mkBattle(civ, armed, { attacker: 0, defender: 1 });
    };
    // colony ships on the right (AI): retreat
    let B = C.create(null, mk('right'), M.RNG.create('civ')); B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    let guard = 0, left = false;
    while (!B.over && guard++ < 60) { if (B.active === null) { C.endRound(B); continue; } for (const a of C.aiTurn(B, null)) if (a.events.some(e => e.type === 'warp-out')) left = true; }
    t.ok(B.over && left); t.eq(B.over.winner, 0);
    const r = C.finish(B);
    t.deep(r.sides[1].survivors, [3, 0, 0, 0, 0, 0]); t.deep(r.sides[1].voluntary, [3, 0, 0, 0, 0, 0]); t.eq(r.sides[1].retreated, true); t.eq(r.sides[1].destroyed, false); t.ok(r.rounds <= 4);
    // colony ships on the left (the human's side on Auto): never retreat, sit still
    B = C.create(null, mk('left'), M.RNG.create('civ2')); B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    const civ = B.units.find(u => u.side === 0 && u.slot === 0);
    for (let i = 0; i < 6 && !B.over; i++) { if (B.active === null) { C.endRound(B); continue; } C.aiTurn(B, null); }
    t.eq(civ.st.retreat, 0); t.eq(civ.x, 0);
  });
  t.test('AI: beam ships close in to point-blank range and open fire; missile ships stay at their launch range; the planet fires at the best target in range', () => {
    const beam = { hull: 1, comp: 'mark-3-computer', engine: 'ion-engine', man: 5, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 3 }] };
    const L = F.mkSide({ empire: 0, human: false, fleet: [{ draft: beam, n: 3 }] }), R = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 2 }] });
    const B = C.create(null, F.mkBattle(L, R), M.RNG.create('ai1')); B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    const u = B.units[0]; let fired = false;
    for (let i = 0; i < 40 && !fired && !B.over; i++) {
      if (B.active === null) { C.endRound(B); continue; }
      const acts = C.aiTurn(B, null);
      if (acts.some(a => a.unit === 0 && a.events.some(e => e.type === 'beam'))) fired = true;
    }
    t.ok(fired); t.ok(Math.max(Math.abs(u.x - B.units[1].x), Math.abs(u.y - B.units[1].y)) <= 1 || B.over);
    const missile = { hull: 2, comp: 'mark-3-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'hyper-v', count: 4 }] };
    const L2 = F.mkSide({ empire: 0, fleet: [{ draft: missile, n: 3 }] }), R2 = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: F.DUMMY, n: 1 }] });
    const B2 = C.create(null, F.mkBattle(L2, R2), M.RNG.create('ai2')); B2.sides[0].ctl = 'ai'; B2.sides[1].ctl = 'ai';
    B2.units[0].x = 0; B2.units[1].x = 9; B2.units[1].y = 3; B2.units[0].y = 3;
    B2.units[1].st.retreat = 0;
    for (let i = 0; i < 6 && !B2.over; i++) { if (B2.active === null) { C.endRound(B2); continue; } C.aiTurn(B2, 0); if (B2.active !== null && B2.units[B2.active].side === 1) C.act(B2, B2.active, { type: 'done' }); }
    t.ok(B2.log.some(l => /launches \d+ Hyper-V/.test(l)), 'missiles were launched');
    const P = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: LASER(2), n: 2 }, { draft: F.DUMMY, n: 1 }] }, { planet: { bases: 3, weapon: 'hyper-v', weapon2: 'scatter-pack-v' }, planetSide: 0, ai: true });
    P.sides[1].ctl = 'human'; F.activate(P, 0);
    const acts = C.aiTurn(P, 0);
    t.ok(acts.some(a => a.action.type === 'fire')); t.ok(P.missiles.length === 1 || P.missiles.length >= 1);
  });
  t.test('AI: aiTurn plays only the active unit of the asked side and always ends the turn; wrong side or nothing active gives no actions', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 1 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 1 }] }));
    const B = C.create(null, b, M.RNG.create('at')); B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    const active = B.active, side = B.units[active].side;
    t.deep(C.aiTurn(B, 1 - side), []);
    const acts = C.aiTurn(B, side);
    t.ok(acts.length >= 1); t.eq(acts[acts.length - 1].action.type, 'done'); t.ok(B.active !== active);
    while (B.active !== null && !B.over) C.aiTurn(B, null);
    t.deep(C.aiTurn(B, null), []);
  });
  t.test('AI: stasis is only used when at least two other enemy groups would stay free; pulsars only when they hurt more foes than friends', () => {
    const stasisShip = { hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', specials: ['stasis-field'], weapons: [{ type: 'laser', count: 1 }] };
    for (const [nFoes, expect] of [[2, false], [3, true]]) {
      const B = C.create(null, F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: stasisShip, n: 2 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: Array.from({ length: nFoes }, () => ({ draft: LASER(2), n: 2 })) })), M.RNG.create('sta' + nFoes));
      B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'human';
      B.units.forEach((u, i) => { if (u.side === 1) { u.x = 1; u.y = 2 + i; } });
      F.activate(B, 0); B.units[0].x = 0; B.units[0].y = 3;
      const acts = C.aiTurn(B, 0);
      t.eq(acts.some(a => a.action.device === 'stasis'), expect, nFoes + ' foes');
    }
  });
  t.test('AI: missile evasion — Simple/Easy never dodge, Impossible always when it can leave the danger radius, Average one time in three, Hard two in three', () => {
    const runner = { hull: 1, comp: 'mark-1-computer', engine: 'fusion-engine', man: 3, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }] };
    const rate = diff => {
      let moved = 0; const N = 300;
      for (let s = 0; s < N; s++) {
        const B = C.create(null, F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 1 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: runner, n: 1 }] }), { diff }), M.RNG.create('ev' + diff + '_' + s));
        B.sides[0].ctl = 'human'; B.sides[1].ctl = 'ai';
        const u = B.units[1]; F.activate(B, 1); F.place(B, 1, 5, 3); F.place(B, 0, 1, 3);
        B.missiles.push({ id: 90, shooter: 0, side: 0, target: 1, slot: 0, kind: 'missile', wid: 'x', name: 'x', n: 4, px: 48, py: 84, spd: 96, budget: 96, fuel: 2, dmg: 4, mul: 1, acc: 0, half: false, tl: 1, fade: false, flown: 0, comp: 5, torp: false });
        const acts = [];
        const did = C._ai.evade(B, u, a => { acts.push(a); return C.act(B, u.id, a); });
        if (did) { moved++; t.eq(acts[0].type, 'move'); t.ok(Math.hypot((u.x + 0.5) * 32 - 48, (u.y + 0.5) * 24 - 84) > 96 * 2 + 13, 'ends outside the danger radius'); }
      }
      return moved / N;
    };
    t.eq(rate(0), 0); t.eq(rate(1), 0); t.near(rate(2), 1 / 3, 0.09); t.near(rate(3), 2 / 3, 0.09); t.eq(rate(4), 1);
  });

  // ---------------------------------------------------------------------------------------------------------------- retreat & end conditions (§4.11)
  const open = (extra) => {
    const L = F.mkSide({ empire: 0, human: true, fleet: [{ draft: Object.assign(LASER(2), { engine: 'nuclear-engine', man: 1 }), n: 3 }, { draft: LASER(1), n: 2 }] }), R = F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(3), n: 3 }] });
    const B = C.create(null, F.mkBattle(L, R, extra), M.RNG.create('rt')); return B;
  };
  t.test('retreat: the Retreat button flags the group, it runs now (the enemy may shoot it) and leaves the field at its NEXT activation, keeping its survivors', () => {
    const B = open();
    const id = 0; F.activate(B, id);
    const ev = C.act(B, id, { type: 'retreat' });
    const u = B.units[0];
    t.ok(ev.some(e => e.type === 'retreat')); t.eq(u.st.retreat, 2); t.eq(B.over, null); t.ok(!u.gone);
    t.ok(u.x >= 0);
    // finish the round, then the group leaves when its turn comes
    let left = false, guard = 0;
    while (!left && guard++ < 40 && !B.over) {
      if (B.active === null) { for (const e of C.endRound(B)) if (e.type === 'warp-out' && e.unit === id) left = true; continue; }
      const evs = C.act(B, B.active, { type: 'done' });
      if (evs.some(e => e.type === 'warp-out' && e.unit === id)) left = true;
    }
    t.ok(left); t.eq(u.left, true); t.eq(u.gone, true); t.eq(u.count, 3);
    const r = C.finish(B);
    t.deep(r.sides[0].voluntary, [3, 0, 0, 0, 0, 0]); t.eq(r.sides[0].survivors[0], 3);
  });
  t.test('retreat: when every group of a side has left the other side wins and the leavers are the fleeing loser (retreated = true, nobody lost)', () => {
    const B = open();
    C.retreatAll(B, 0);
    t.ok(B.units.filter(u => u.side === 0).every(u => u.st.retreat === 1));
    let guard = 0;
    while (!B.over && guard++ < 60) { if (B.active === null) { C.endRound(B); continue; } C.aiTurn(B, 1); if (B.active !== null && B.units[B.active].side === 0) C.act(B, B.active, { type: 'done' }); }
    t.ok(B.over); t.eq(B.over.winner, 1); t.eq(B.over.reason, 'wiped');
    const r = C.finish(B);
    t.eq(r.winner, 1); t.eq(r.sides[0].retreated, true); t.eq(r.sides[0].destroyed, false); t.deep(r.sides[0].voluntary, [3, 2, 0, 0, 0, 0]);
    t.deep(r.sides[0].survivors.map((n, k) => n + r.sides[0].lost[k]), [3, 2, 0, 0, 0, 0]);
  });
  t.test('retreat: a stasis-frozen or fully slowed group cannot retreat; planets never do', () => {
    const B = open(); F.activate(B, 1);
    B.units[1].st.stasis = 1; t.eq(C.act(B, 1, { type: 'retreat' }).ok, false);
    B.units[1].st.stasis = 0; B.units[1].unman = B.units[1].speed; t.eq(C.act(B, 1, { type: 'retreat' }).ok, false);
    const P = F.arena({ fleet: [{ draft: LASER(1), n: 1 }] }, { fleet: [{ draft: LASER(1), n: 1 }] }, { planet: { bases: 1 }, planetSide: 0 });
    F.activate(P, 0); t.eq(C.act(P, 0, { type: 'retreat' }).ok, false);
  });
  t.test('retreat before the fight: the withdrawing side loses nothing, the other side wins without a round', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(1), n: 4 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 5 }] }));
    const r = C.retreatBeforeBattle(b, 1);
    t.eq(r.winner, 0); t.eq(r.rounds, 0); t.eq(r.sides[1].retreated, true); t.deep(r.sides[1].survivors, [5, 0, 0, 0, 0, 0]); t.deep(r.sides[1].lost, [0, 0, 0, 0, 0, 0]); t.deep(r.sides[0].survivors, [4, 0, 0, 0, 0, 0]);
  });
  t.test('end of battle: after 51 rounds (the original off-by-one) the planet owner\'s side wins, otherwise the right side (the attacker is forced to withdraw)', () => {
    const run = planet => {
      const B = F.arena({ fleet: [{ draft: F.DUMMY, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, planet ? { planet: { bases: 1 }, planetSide: 0 } : {});
      let guard = 0;
      while (!B.over && guard++ < 400) { if (B.active === null) { C.endRound(B); continue; } C.act(B, B.active, { type: 'done' }); }
      return B;
    };
    let B = run(false);
    t.eq(B.over.reason, 'timeout'); t.eq(B.over.winner, 1); t.eq(B.round, 51);
    B = run(true);
    t.eq(B.over.reason, 'timeout'); t.eq(B.over.winner, 0); t.eq(B.round, 51);
    const r = C.finish(B); t.eq(r.reason, 'timeout'); t.eq(r.rounds, 51); t.eq(r.sides[1].retreated, true);
  });
  t.test('AI retreat decision: needs HP on both sides; flees when it cannot hurt the enemy; otherwise when its loss rate exceeds v times the enemy\'s, v = (5-difficulty)*5+5 (+10/+20 planet) + d15', () => {
    t.eq(C.shouldRetreat(0, 100, 10, 10, 2, -1, 5), false); t.eq(C.shouldRetreat(100, 0, 10, 10, 2, -1, 5), false);
    t.eq(C.shouldRetreat(100, 100, 0, 50, 4, -1, 1), true);                                          // right side cannot hurt the left at all
    // equal hit points: loss rates are dToRight% and dToLeft%
    for (const [diff, v0] of [[0, 30], [1, 25], [2, 20], [3, 15], [4, 10]]) {
      for (const [ps, add] of [[-1, 0], [0, 10], [1, 20]]) {
        const v = v0 + add + 7;
        t.eq(C.shouldRetreat(100, 100, 10, 10 * v, diff, ps, 7), false, 'equal at the threshold diff ' + diff + ' planet ' + ps);
        t.eq(C.shouldRetreat(100, 100, 10, 10 * v + 1, diff, ps, 7), true, 'just above diff ' + diff + ' planet ' + ps);
      }
    }
    t.eq(C.shouldRetreat(200, 100, 10, 40, 2, -1, 1), (40 * 100 / 100) > (10 * 100 * 21 / 200));
  });
  t.test('AI retreat in play: a hopeless right-side fleet flags itself at the start of a round; a human right side never does', () => {
    const killer = { hull: 3, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'neutronium-armor', shield: 'class-15-shield', weapons: [{ type: 'mauler-device', count: 20 }] };
    const mk = (hum) => C.create(null, F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: killer, n: 10 }] }), F.mkSide({ empire: 1, role: 'attacker', human: hum, fleet: [{ draft: LASER(1), n: 2 }] })), M.RNG.create('ret'));
    const B = mk(false);
    t.ok(B.units.filter(u => u.side === 1).every(u => u.st.retreat >= 1), 'flagged in round 1');
    const H = mk(true);
    t.ok(H.units.filter(u => u.side === 1).every(u => u.st.retreat === 0));
    const r = full(F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: killer, n: 10 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(1), n: 2 }] })), 'ret2');
    t.eq(r.winner, 0); t.eq(r.sides[1].retreated, true); t.deep(r.sides[1].survivors, [2, 0, 0, 0, 0, 0]); t.deep(r.sides[1].lost, [0, 0, 0, 0, 0, 0]);
  });

  // ---------------------------------------------------------------------------------------------------------------- monsters (§4.15)
  t.test('monster tables: Crystal 3000..7000 hp, Amoeba 1000..5000, Guardian 2000..10000 with the documented defenses, shields and weapon counts per difficulty', () => {
    for (let d = 0; d < 5; d++) {
      const c = C.monsterStats('crystal', d), a = C.monsterStats('amoeba', d), g = C.monsterStats('guardian', d);
      t.eq(c.hp, 3000 + 1000 * d); t.eq(c.beamDef, 1 + d); t.eq(c.missDef, 1 + d); t.eq(c.absorb, 5); t.eq(c.misshield, 100); t.eq(c.attack, 10); t.eq(c.combatSpeed, 2); t.eq(c.blackhole, true); t.eq(c.hull, 3);
      t.eq(c.weapons.length, 1); t.eq(c.weapons[0].id, 'crystal-ray'); t.eq(c.weapons[0].count, 10);
      t.eq(a.hp, 1000 + 1000 * d); t.eq(a.beamDef, 1 + d); t.eq(a.absorb, 0); t.eq(a.misshield, 0); t.eq(a.repair, 50); t.eq(a.weapons[0].id, 'amoeba-stream'); t.eq(a.weapons[0].count, 1);
      t.eq(g.hp, 2000 + 2000 * d); t.eq(g.beamDef, [1, 3, 5, 7, 9][d]); t.eq(g.absorb, [5, 6, 7, 8, 9][d]); t.eq(g.misshield, 100); t.eq(g.attack, 10); t.eq(g.repair, [0, 0, 0, 15, 0][d]);
      t.deep(g.weapons.map(w => w.id), ['scatter-pack-x-5', 'death-ray', 'stellar-converter', 'plasma-torpedo']);
      t.deep(g.weapons.map(w => w.count), [[5, 25, 45, 65, 85][d], 1, [5, 15, 25, 35, 45][d], [6, 9, 12, 15, 18][d]]);
      t.eq(g.weapons[1].range, 4); t.eq(g.weapons[2].range, 6); t.eq(g.weapons[0].racks, 5); t.eq(g.weapons[0].warheads, 10);
    }
    C.CONFIG.guardianFix = true;
    try { t.eq(C.monsterStats('guardian', 3).repair, 15); t.eq(C.monsterStats('guardian', 4).repair, 30); } finally { C.CONFIG.guardianFix = false; }
  });
  t.test('Guardian fight: the same fleet wins at low difficulty and loses at high difficulty; the monster never retreats', () => {
    const huge = n => ({ hull: 3, comp: 'mark-8-computer', shield: 'class-7-shield', armor: 'tritanium-armor', engine: 'ion-engine', man: 3, weapons: [{ type: 'phasor', count: n }, { type: 'hercular', count: 6 }] });
    const fight = (diff, seed) => full(F.mkBattle(F.mkSide({ empire: 0, tl: [30, 30, 30, 30, 30, 30], fleet: [{ draft: huge(10), n: 20 }] }), C.monsterSide({ kind: 'guardian', id: -2 }, diff), { attacker: -1, diff }), 'g' + diff + seed);
    let w0 = 0, w4 = 0;
    for (let s = 0; s < 6; s++) { const a = fight(0, s), b = fight(4, s); if (a.winner === 0) w0++; if (b.winner === 0) w4++; t.eq(b.sides[1].retreated, false); }
    t.eq(w0, 6); t.eq(w4, 0);
    const r = fight(0, 0);
    t.eq(r.sides[1].destroyed, true); t.eq(r.sides[1].monster.kind, 'guardian'); t.eq(r.sides[1].lost[0], 1);
    const hard = fight(4, 0);
    t.eq(hard.sides[1].destroyed, false); t.eq(hard.sides[1].survivors[0], 1);
  });
  t.test('Guardian weights: a fleet outweighing 100000 beats it in the auto-resolve, a smaller one never does', () => {
    const big = F.mkBattle(F.mkSide({ empire: 0, tl: [30, 40, 30, 1, 30, 30], fleet: [{ draft: HEAVY, n: 400 }] }), C.monsterSide({ kind: 'guardian' }, 2), { attacker: -1 });
    const small = F.mkBattle(F.mkSide({ empire: 0, tl: [30, 40, 30, 1, 30, 30], fleet: [{ draft: HEAVY, n: 3 }] }), C.monsterSide({ kind: 'guardian' }, 2), { attacker: -1 });
    let a = 0, b = 0;
    for (let s = 0; s < 20; s++) { if (C.resolve(big, M.RNG.create('gw' + s)).winner === 0) a++; if (C.resolve(small, M.RNG.create('gw' + s)).winner === 0) b++; }
    t.eq(a, 20); t.eq(b, 0);
  });
  t.test('Amoeba regeneration (50% of its hit points a turn) defeats fleets that cannot out-damage it; the Crystal needs a bigger fleet than an Amoeba of the same difficulty', () => {
    const mk = n => ({ hull: 3, comp: 'mark-8-computer', shield: 'class-7-shield', armor: 'tritanium-armor', engine: 'ion-engine', man: 3, weapons: [{ type: 'phasor', count: n }] });
    const fight = (kind, ships, diff, seed) => full(F.mkBattle(F.mkSide({ empire: 0, tl: [30, 30, 30, 30, 30, 30], fleet: [{ draft: mk(10), n: ships }] }), C.monsterSide({ kind, id: 1 }, diff), { attacker: -1, diff }), kind + ships + seed);
    t.eq(fight('amoeba', 10, 0, 1).winner, 0); t.eq(fight('amoeba', 1, 0, 1).winner, 1);
    t.eq(fight('amoeba', 20, 4, 1).winner, 1); t.eq(fight('amoeba', 80, 4, 1).winner, 0);               // 2500 hp regenerated per turn
    t.eq(fight('amoeba', 20, 2, 1).winner, 0); t.eq(fight('crystal', 20, 2, 1).winner, 1);
    t.eq(fight('crystal', 10, 2, 1).winner, 1); t.eq(fight('crystal', 80, 2, 1).winner, 0);
  });
  t.test('the Crystal\'s Black Hole Generator and the Amoeba\'s streaming stream are used by the engine\'s AI (the monster kills big stacks fast)', () => {
    const swarm = { hull: 0, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }] };
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: swarm, n: 500 }] }), C.monsterSide({ kind: 'crystal', id: 1 }, 0), { attacker: -1 });
    const B = C.create(null, b, M.RNG.create('swarm')); B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    let bh = false, guard = 0;
    while (!B.over && guard++ < 200 && !bh) { if (B.active === null) { C.endRound(B); continue; } for (const a of C.aiTurn(B, null)) if (a.events.some(e => e.type === 'special-effect' && e.device === 'blackhole')) bh = true; }
    t.ok(bh);
  });

  // ---------------------------------------------------------------------------------------------------------------- the interactive loop and determinism
  t.test('interactive loop: driving a whole battle through create / aiTurn / endRound / finish yields the same result as resolve (same seed)', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(3), n: 4 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(2), n: 5 }] }), { rocks: 'some' });
    const R1 = M.RNG.create('loop'), B = C.create(null, b, R1);
    B.sides[0].ctl = 'ai'; B.sides[1].ctl = 'ai';
    let n = 0;
    while (!C.isOver(B) && n++ < 2000) { if (B.active === null) C.endRound(B); else C.aiTurn(B, null); }
    t.ok(C.isOver(B));
    const r1 = C.finish(B), r2 = C.resolve(b, M.RNG.create('loop'), { full: true });
    t.deep(r1, r2);
  });
  t.test('determinism: same battle + same seed = identical result and identical event stream; a different seed gives a different fight', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(3), n: 6 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(3), n: 6 }] }), { rocks: 'many' });
    t.deep(full(b, 'd1'), full(b, 'd1'));
    t.deep(C.resolve(b, M.RNG.create('d1')), C.resolve(b, M.RNG.create('d1')));
    const sig = seed => JSON.stringify(C.resolve(b, M.RNG.create(seed), { full: true }));
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f']; const set = new Set(seeds.map(sig));
    t.ok(set.size > 1);
    const log = seed => { const B = C.create(null, b, M.RNG.create(seed)); B.sides[0].ctl = B.sides[1].ctl = 'ai'; C.autoPlay(B); return JSON.stringify([B.log, B.rocks, B.round]); };
    t.eq(log('x'), log('x'));
  });
  t.test('B is plain JSON: a snapshot taken mid-battle continues exactly like the original (events included)', () => {
    const b = F.mkBattle(F.mkSide({ empire: 0, fleet: [{ draft: LASER(3), n: 6 }] }), F.mkSide({ empire: 1, role: 'attacker', fleet: [{ draft: LASER(3), n: 6 }] }), { rocks: 'some', planet: F.mkPlanet({ bases: 3 }), planetSide: 0 });
    const B = C.create(null, b, M.RNG.create('snap')); B.sides[0].ctl = B.sides[1].ctl = 'ai';
    for (let i = 0; i < 9 && !B.over; i++) { if (B.active === null) C.endRound(B); else C.aiTurn(B, null); }
    const copy = JSON.parse(JSON.stringify(B));
    t.deep(copy, B);
    const e1 = [], e2 = [];
    for (let i = 0; i < 30 && !B.over; i++) { const a = B.active === null ? C.endRound(B) : C.aiTurn(B, null); e1.push(JSON.stringify(a)); }
    for (let i = 0; i < 30 && !copy.over; i++) { const a = copy.active === null ? C.endRound(copy) : C.aiTurn(copy, null); e2.push(JSON.stringify(a)); }
    t.deep(e1, e2); t.deep(copy, B);
  });

  // ---------------------------------------------------------------------------------------------------------------- applyResults (§4.11)
  const res = (S, o) => Object.assign({ v: 1, mode: 'tactical', star: 1, starName: 'S1', planetId: 1, winner: 0, winnerEmpire: 0, loserEmpire: 1, rounds: 5, reason: 'wiped', human: false, attacker: 1, defender: 0,
    sides: [{ empire: 0, fleetId: -1, monster: null, lost: [0, 0, 0, 0, 0, 0], survivors: [3, 0, 0, 0, 0, 0], voluntary: [0, 0, 0, 0, 0, 0], retreated: false, retreatTo: -1, destroyed: false, apparentLost: 0 },
      { empire: 1, fleetId: -1, monster: null, lost: [1, 0, 0, 0, 0, 0], survivors: [1, 0, 0, 0, 0, 0], voluntary: [0, 0, 0, 0, 0, 0], retreated: true, retreatTo: -1, destroyed: false, apparentLost: 3 }], planet: null, summary: [] }, o || {});
  t.test('applyResults: casualties leave the fleets, empty fleets disappear, the winner stays in orbit', () => {
    const S = world(); const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [2, 0, 0, 0, 0, 0]); own(S, 3, 1);
    const r = res(S); r.sides[0].lost = [2, 0, 0, 0, 0, 0]; r.sides[0].fleetId = a.id; r.sides[1].fleetId = b.id; r.sides[1].lost = [2, 0, 0, 0, 0, 0]; r.sides[1].survivors = [0, 0, 0, 0, 0, 0]; r.sides[1].destroyed = true; r.sides[1].retreated = false;
    C.applyResults(S, [r], null);
    t.deep(a.ships, [3, 0, 0, 0, 0, 0]); t.ok(!S.fleets.includes(b)); t.eq(a.star, 1);
  });
  t.test('applyResults: the loser\'s survivors flee to the nearest OTHER planet it owns (slowest engine sets the speed); with no other planet they are lost', () => {
    const S = world({ stars: 5 }); own(S, 3, 1); own(S, 4, 1);
    F.setDesign(S.empires[1], 1, { hull: 1, engine: 'sub-light-engine', man: 0, armor: 'titanium-armor' });             // warp 3
    const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [2, 4, 0, 0, 0, 0]);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].fleetId = b.id; r.sides[1].lost = [1, 0, 0, 0, 0, 0]; r.sides[1].survivors = [1, 4, 0, 0, 0, 0];
    C.applyResults(S, [r], null);
    const f = S.fleets.find(x => x.owner === 1);
    t.ok(f); t.eq(f.star, -1); t.eq(f.from, 1); t.eq(f.to, 3); t.deep(f.ships, [1, 4, 0, 0, 0, 0]); t.eq(f.speed, 1); t.eq(r.sides[1].retreatTo, 3); t.eq(f.x, S.stars[1].x);
    t.eq(S.fleets.filter(x => x.owner === 1).length, 1);
    // the only other planet is gone: ships are lost
    const T = world({ stars: 3 }); const a2 = F.fleet(T, 0, 1, [5, 0, 0, 0, 0, 0]), b2 = F.fleet(T, 1, 1, [2, 0, 0, 0, 0, 0]);
    const q = res(T); q.sides[0].fleetId = a2.id; q.sides[1].fleetId = b2.id; q.sides[1].lost = [0, 0, 0, 0, 0, 0]; q.sides[1].survivors = [2, 0, 0, 0, 0, 0];
    C.applyResults(T, [q], null);
    t.ok(!T.fleets.some(x => x.owner === 1)); t.eq(q.sides[1].retreatTo, -1);
    t.ok(T.ev.some(e => e.type === 'news' && e.cat === 'fleetDestroyed' && e.empire === 1 && e.empire2 === 0 && e.ships === 2));
  });
  t.test('applyResults: warp speed of a retreating fleet is the slowest design\'s engine', () => {
    const S = world({ stars: 4 }); own(S, 3, 1);
    F.setDesign(S.empires[1], 0, { hull: 1, engine: 'fusion-engine', man: 0, armor: 'titanium-armor' });               // warp 4
    F.setDesign(S.empires[1], 1, { hull: 1, engine: 'nuclear-engine', man: 0, armor: 'titanium-armor' });              // warp 2
    const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [2, 3, 0, 0, 0, 0]);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].fleetId = b.id; r.sides[1].lost = [0, 0, 0, 0, 0, 0]; r.sides[1].survivors = [2, 3, 0, 0, 0, 0];
    C.applyResults(S, [r], null);
    t.eq(S.fleets.find(x => x.owner === 1).speed, 2);
  });
  t.test('applyResults: planet losses — bases, factories, population; bio damage lowers max population but never below 10; a wiped colony becomes empty land', () => {
    const S = world(); own(S, 1, 1, { bases: 5, pop: 40, factories: 25, mp3: 60 }); const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].survivors = [0, 0, 0, 0, 0, 0]; r.sides[1].lost = [2, 0, 0, 0, 0, 0]; r.sides[1].destroyed = true; r.sides[1].retreated = false;
    r.planet = { id: 1, owner: 1, basesLost: 3, basesLeft: 2, popKilled: 7, factoriesKilled: 9, bioDamage: 25, shieldBroken: false, popLeft: 33, factoriesLeft: 16 };
    C.applyResults(S, [r], null);
    const p = S.planets[1];
    t.eq(p.bases, 2); t.eq(p.pop, 33); t.eq(p.factories, 16); t.eq(p.mp3, 35); t.eq(p.owner, 1);
    r.planet.bioDamage = 90; C.applyResults(S, [r], null); t.eq(S.planets[1].mp3, 10);
    const T = world(); own(T, 1, 1, { bases: 1, pop: 4, factories: 10 }); const a3 = F.fleet(T, 0, 1, [5, 0, 0, 0, 0, 0]);
    const q = res(T); q.sides[0].fleetId = a3.id; q.sides[1].survivors = [0, 0, 0, 0, 0, 0]; q.sides[1].lost = [1, 0, 0, 0, 0, 0]; q.sides[1].destroyed = true; q.sides[1].retreated = false;
    q.planet = { id: 1, owner: 1, basesLost: 1, basesLeft: 0, popKilled: 4, factoriesKilled: 10, bioDamage: 0, shieldBroken: false, popLeft: 0, factoriesLeft: 0 };
    C.applyResults(T, [q], null);
    t.eq(T.planets[1].owner, -1); t.eq(T.planets[1].pop, 0); t.eq(T.planets[1].bases, 0);
    t.ok(T.ev.some(e => e.type === 'news' && e.cat === 'planetDestroyed' && e.empire === 0 && e.planet === 1));
  });
  t.test('applyResults: the winner at an enemy colony may bombard (S.bombard); not when it is unarmed, allied or the loser', () => {
    const S = world(); own(S, 1, 1, { bases: 0, pop: 30 }); const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].survivors = [0, 0, 0, 0, 0, 0]; r.sides[1].lost = [1, 0, 0, 0, 0, 0]; r.sides[1].destroyed = true; r.sides[1].retreated = false; r.planet = null;
    S.bombard = [];
    C.applyResults(S, [r], null);
    t.deep(S.bombard, [{ empire: 0, planet: 1, target: 1, star: 1 }]);
    const T = world(); own(T, 1, 0, { bases: 0, pop: 30 }); const b = F.fleet(T, 0, 1, [5, 0, 0, 0, 0, 0]); F.fleet(T, 1, 1, [1, 0, 0, 0, 0, 0]);
    const q = res(T); q.sides[0].fleetId = b.id; T.bombard = [];
    C.applyResults(T, [q], null); t.deep(T.bombard, []);                                                                   // the winner owns the planet
  });
  t.test('applyResults: the Guardian\'s death is recorded (alive=false, killer) and announced; if it wins the fleet dies and it lives', () => {
    const S = world({ stars: 5 }); S.orion = 3; S.guardian = { alive: true, star: 3 }; own(S, 4, 0);
    const a = F.fleet(S, 0, 3, [5, 0, 0, 0, 0, 0]);
    const r = res(S, { star: 3, planetId: 3, winner: 0, winnerEmpire: 0, loserEmpire: -1, attacker: -1 });
    r.sides[0].fleetId = a.id; r.sides[0].lost = [2, 0, 0, 0, 0, 0]; r.sides[0].survivors = [3, 0, 0, 0, 0, 0];
    r.sides[1] = { empire: -1, fleetId: -1, monster: { kind: 'guardian' }, lost: [1, 0, 0, 0, 0, 0], survivors: [0, 0, 0, 0, 0, 0], voluntary: [0, 0, 0, 0, 0, 0], retreated: false, retreatTo: -1, destroyed: true, apparentLost: 0 };
    C.applyResults(S, [r], null);
    t.eq(S.guardian.alive, false); t.eq(S.guardian.killer, 0);
    t.ok(S.ev.some(e => e.type === 'news' && e.cat === 'guardianSlain' && e.empire === 0 && e.star === 3));
    t.deep(a.ships, [3, 0, 0, 0, 0, 0]);
    // the monster wins
    const T = world({ stars: 5 }); T.orion = 3; T.guardian = { alive: true, star: 3 }; own(T, 4, 0);
    const b = F.fleet(T, 0, 3, [5, 0, 0, 0, 0, 0]);
    const q = res(T, { star: 3, planetId: 3, winner: 1, winnerEmpire: -1, loserEmpire: 0, attacker: -1 });
    q.sides[0].fleetId = b.id; q.sides[0].lost = [5, 0, 0, 0, 0, 0]; q.sides[0].survivors = [0, 0, 0, 0, 0, 0]; q.sides[0].destroyed = true;
    q.sides[1] = { empire: -1, fleetId: -1, monster: { kind: 'guardian' }, lost: [0, 0, 0, 0, 0, 0], survivors: [1, 0, 0, 0, 0, 0], voluntary: [0, 0, 0, 0, 0, 0], retreated: false, retreatTo: -1, destroyed: false, apparentLost: 0 };
    C.applyResults(T, [q], null);
    t.eq(T.guardian.alive, true); t.ok(!T.fleets.some(f => f.owner === 0 && f.star === 3));
    // nobody may sit at Orion while the Guardian lives
    const U = world({ stars: 5 }); U.orion = 3; U.guardian = { alive: true, star: 3 }; F.fleet(U, 0, 3, [2, 0, 0, 0, 0, 0]);
    C.applyResults(U, [], null);
    t.ok(!U.fleets.some(f => f.star === 3));
  });
  t.test('applyResults: a roaming monster that dies is flagged (killer, no longer attackable); a second result against an already dead monster is ignored', () => {
    const S = world({ stars: 3 }); S.monsters = [{ id: 7, kind: 'crystal', star: 1 }];
    const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [5, 0, 0, 0, 0, 0]); own(S, 2, 0); own(S, 0, 1);
    const mon = { empire: -1, fleetId: -1, monster: { kind: 'crystal', id: 7 }, lost: [1, 0, 0, 0, 0, 0], survivors: [0, 0, 0, 0, 0, 0], voluntary: [0, 0, 0, 0, 0, 0], retreated: false, retreatTo: -1, destroyed: true, apparentLost: 0 };
    const mk = (emp, fleet, lost) => { const r = res(S, { winner: 0, winnerEmpire: emp, loserEmpire: -1, attacker: -1 }); r.sides = [Object.assign({}, r.sides[0], { empire: emp, fleetId: fleet.id, lost: [lost, 0, 0, 0, 0, 0], survivors: [5 - lost, 0, 0, 0, 0, 0] }), Object.assign({}, mon)]; return r; };
    C.applyResults(S, [mk(0, a, 1), mk(1, b, 4)], null);
    t.eq(S.monsters[0].killer, 0); t.eq(S.monsters[0].attackable, false);
    t.deep(a.ships, [4, 0, 0, 0, 0, 0]); t.deep(b.ships, [5, 0, 0, 0, 0, 0]);
  });
  t.test('applyResults: pushes a battle event and the right news (battleWon / battleLost for the human / fleetDestroyed), and calls Diplo.incident with offense = max(5*pop, min(app,50), 10*bio)', () => {
    const S = world(); own(S, 1, 1, { bases: 2, pop: 20 }); own(S, 3, 1); S.empires[1].human = true;
    const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [3, 0, 0, 0, 0, 0]);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].fleetId = b.id; r.sides[1].lost = [2, 0, 0, 0, 0, 0]; r.sides[1].survivors = [1, 0, 0, 0, 0, 0]; r.sides[1].apparentLost = 6;
    r.planet = { id: 1, owner: 1, basesLost: 2, basesLeft: 0, popKilled: 3, factoriesKilled: 4, bioDamage: 0, shieldBroken: false, popLeft: 17, factoriesLeft: 16 };
    const calls = [];
    const saved = M.Sim.Diplo; M.Sim.Diplo = { isAllied: () => false, incident: (...args) => calls.push(args) };
    try { C.applyResults(S, [r], null); } finally { M.Sim.Diplo = saved; }
    const ev = S.ev.find(e => e.type === 'battle');
    t.ok(ev); t.eq(ev.star, 1); t.eq(ev.winner, 0); t.eq(ev.loser, 1); t.eq(ev.popKilled, 3); t.eq(ev.sides[1].lost, 2);
    t.ok(S.ev.some(e => e.type === 'news' && e.cat === 'battleLost' && e.empire === 1 && e.empire2 === 0 && e.ships === 2 && e.star === 1));
    t.eq(calls.length, 1); t.eq(calls[0][1], 'combat'); t.eq(calls[0][2], 0); t.eq(calls[0][3], 1); t.eq(calls[0][4], Math.max(5 * 3, 6, 0));
  });
  t.test('applyResults: a human winner gets a battleWon headline; a bio attack scales the offense by 10 per point', () => {
    const S = world(); own(S, 1, 1, { bases: 0, pop: 60 }); S.empires[0].human = true;
    const a = F.fleet(S, 0, 1, [5, 0, 0, 0, 0, 0]), b = F.fleet(S, 1, 1, [3, 0, 0, 0, 0, 0]); own(S, 3, 1);
    const r = res(S); r.sides[0].fleetId = a.id; r.sides[1].fleetId = b.id; r.sides[1].lost = [1, 0, 0, 0, 0, 0]; r.sides[1].survivors = [2, 0, 0, 0, 0, 0]; r.sides[1].apparentLost = 12;
    r.planet = { id: 1, owner: 1, basesLost: 0, basesLeft: 0, popKilled: 1, factoriesKilled: 0, bioDamage: 7, shieldBroken: false, popLeft: 59, factoriesLeft: 0 };
    const calls = [];
    const saved = M.Sim.Diplo; M.Sim.Diplo = { isAllied: () => false, incident: (...args) => calls.push(args) };
    try { C.applyResults(S, [r], null); } finally { M.Sim.Diplo = saved; }
    t.ok(S.ev.some(e => e.type === 'news' && e.cat === 'battleWon' && e.empire === 0 && e.empire2 === 1 && e.ships === 1));
    t.eq(calls[0][4], Math.max(5, 12, 70));
  });

  // ---------------------------------------------------------------------------------------------------------------- performance
  t.test('findBattles delegates the fight gate to Diplo.canFight(S, attacker, defender, starOwner) when the module offers it (attacker = the party that does not own the planet)', () => {
    const S = world(); own(S, 1, 1, { bases: 0 }); F.fleet(S, 0, 1, [1, 0, 0, 0, 0, 0]); F.fleet(S, 1, 1, [1, 0, 0, 0, 0, 0]);
    const saved = M.Sim.Diplo, calls = [];
    M.Sim.Diplo = { isAllied: () => false, atWar: () => true, canFight: (...a) => { calls.push(a.slice(1)); return false; } };
    try { t.eq(C.findBattles(S, null).length, 0); t.deep(calls, [[0, 1, 1]]); M.Sim.Diplo.canFight = () => true; t.eq(C.findBattles(S, null).length, 1); } finally { M.Sim.Diplo = saved; }
  });
  t.test('performance: 200 ships against 200 ships resolve in well under 150 ms (weight model and the full tactical simulation)', () => {
    const d1 = { hull: 2, comp: 'mark-5-computer', shield: 'class-3-shield', armor: 'zortium-armor', engine: 'ion-engine', man: 4, weapons: [{ type: 'fusion-beam', count: 6 }, { type: 'hercular', count: 2 }] };
    const d2 = { hull: 3, comp: 'mark-5-computer', shield: 'class-5-shield', armor: 'andrium-armor', engine: 'ion-engine', man: 3, weapons: [{ type: 'phasor', count: 12 }, { type: 'stinger', count: 4 }] };
    const d3 = { hull: 1, comp: 'mark-4-computer', ecm: 'ecm-3', armor: 'duralloy-armor', engine: 'fusion-engine', man: 3, weapons: [{ type: 'ion-cannon', count: 3 }, { type: 'merculite', count: 1 }] };
    const b = F.mkBattle(F.mkSide({ empire: 0, tl: [20, 20, 20, 20, 20, 20], fleet: [{ draft: d1, n: 70 }, { draft: d2, n: 30 }, { draft: d3, n: 100 }] }),
      F.mkSide({ empire: 1, role: 'attacker', tl: [20, 20, 20, 20, 20, 20], fleet: [{ draft: d1, n: 80 }, { draft: d2, n: 40 }, { draft: d3, n: 80 }] }), { rocks: 'some', planet: F.mkPlanet({ bases: 30 }), planetSide: 0 });
    for (const opts of [{}, { full: true }]) {
      let best = 1e9;
      for (let i = 0; i < 3; i++) { const t0 = process.hrtime.bigint(); C.resolve(b, M.RNG.create('perf' + i), opts); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); }
      t.ok(best < 150, (opts.full ? 'tactical ' : 'weights ') + best.toFixed(1) + ' ms');
    }
  });
};
