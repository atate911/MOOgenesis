// Tactical combat — pure rule maths, snapshots, battle set-up, initiative, movement, targeting and hit chances (research/03 §4.1–4.5).
// The fixtures exported below (module.exports.fixtures) are shared with 50-combat-fire.test.js and 50-combat-flow.test.js.
function fixtures(M) {
  const D = M.Sim.Design, C = M.Sim.Combat;
  C.CONFIG.debug = true;
  const mkE = (id, race, o) => Object.assign({
    id, race: race || 'human', name: race || 'human', plural: (race || 'human') + 's', human: false, alive: true, bc: 0, leader: 'L' + id,
    designs: [null, null, null, null, null, null], dstats: [], mods: { baseHp: 0, baseComp: 1, baseEcm: 0, baseShield: 1, baseMissile: 1, baseScatter: 0, planetShield: 0, antidote: 0, interdictor: false },
    research: { tl: [1, 1, 1, 1, 1, 1], completed: [[1], [1], [1], [1], [1], [1]] }, grants: {},
  }, o || {});
  const setDesign = (E, slot, draft) => { E.designs[slot] = D.normalize(draft); E.dstats[slot] = null; return E.designs[slot]; };
  // a side from a fleet spec: {empire, race, role, human, tl, fleet:[{draft, n}]}
  function mkSide(spec) {
    const E = mkE(spec.empire || 0, spec.race || 'human');
    if (spec.tl) E.research.tl = spec.tl.slice();
    const ships = [0, 0, 0, 0, 0, 0], designs = [null, null, null, null, null, null];
    (spec.fleet || []).forEach((f, i) => { setDesign(E, i, f.draft); ships[i] = f.n; });
    for (let i = 0; i < 6; i++) if (ships[i]) designs[i] = C.snapshotDesign({}, E, i);
    return { empire: E.id, fleetId: -1, ships, designs, role: spec.role || 'defender', race: E.race, name: E.plural, human: !!spec.human, mod: C.raceMod(E.race), tl: E.research.tl.slice(),
      autoWeight: C.raceWeight(E.race), antidote: spec.antidote | 0 };
  }
  const mkPlanet = o => Object.assign({ id: 0, owner: 0, name: 'Sol', pop: 50, factories: 30, bases: 3, shield: 0, type: 'terran', special: 'normal', maxPop: 100, baseHp: 50, comp: 1, ecm: 0, absorb: 1,
    weapon: 'nuclear-missile', weapon2: 'nuclear-missile', interdictor: false, antidote: 0 }, o || {});
  const mkBattle = (L, R, o) => Object.assign({ v: 1, star: 0, starName: 'Test', planet: null, sides: [L, R], planetSide: -1, nebula: false, bg: 1, rocks: 'none', attacker: R.empire, defender: L.empire,
    human: false, diff: 2, seed: 'seed' }, o || {});
  function arena(leftSpec, rightSpec, o) {
    o = o || {};
    const L = mkSide(Object.assign({ role: 'defender', empire: 0, human: !o.ai }, leftSpec)), R = mkSide(Object.assign({ role: 'attacker', empire: 1, human: !o.ai }, rightSpec));
    const battle = mkBattle(L, R, o.battle || {});
    if (o.planet) { battle.planet = mkPlanet(o.planet); battle.planetSide = o.planetSide === undefined ? 0 : o.planetSide; battle.planet.owner = battle.sides[battle.planetSide].empire; }
    return C.create(null, battle, M.RNG.create(o.seed || 'arena'));
  }
  // make unit `id` the active unit regardless of the initiative order (isolates one action from the rest of the battle)
  function activate(B, id) {
    const u = B.units[id];
    B.order = B.order.filter(x => x !== id); B.active = id; B.phase = 'turn'; B.pend.length = 0;
    u.st.canRetaliate = true; u.st.begun = true; u.actman = Math.max(0, u.speed - u.unman);
    return u;
  }
  const place = (B, id, x, y) => { const u = B.units[id]; u.x = x; u.y = y; return u; };
  const sumEv = (ev, type, key) => ev.filter(e => e.type === type).reduce((a, e) => a + (e[key] || 0), 0);
  // a world for findBattles / applyResults
  function mkWorld(o) {
    o = o || {};
    const n = o.stars || 4;
    const S = { seed: 'w', turn: 7, year: 8, rs: M.RNG.seedState('w'), settings: { diffIdx: o.diff === undefined ? 2 : o.diff, options: {} }, stars: [], planets: [], empires: [], fleets: [], nextId: 1000, ev: [],
      orion: -1, guardian: { alive: false, star: -1 }, monsters: [] };
    for (let i = 0; i < n; i++) {
      S.stars.push({ id: i, name: 'S' + i, x: 20 + i * 30, y: 20 + (i % 2) * 10, nebula: false, color: 'yellow' });
      S.planets.push({ id: i, starId: i, name: 'P' + i, owner: -1, type: 'terran', typeIdx: 13, special: 'normal', rocks: 'none', bg: 1, pop: 0, factories: 0, bases: 0, shield: 0, mp1: 100, mp2: 100, mp3: 100, maxPop: 100 });
    }
    const ne = o.empires || 2;
    for (let e = 0; e < ne; e++) S.empires.push(mkE(e, (o.races || [])[e] || 'human'));
    return S;
  }
  const own = (S, planet, owner, o) => Object.assign(S.planets[planet], { owner, pop: 40, factories: 20, bases: 0, shield: 0, mp1: 100, mp2: 100, mp3: 100, sliders: [0, 0, 100, 0, 0], build: 0 }, o || {});
  const fleet = (S, owner, star, ships) => { const f = { id: S.nextId++, owner, star, from: star, to: -1, x: S.stars[star].x, y: S.stars[star].y, speed: 0, ships: ships.slice() }; S.fleets.push(f); return f; };
  // temporary Diplo stub: treaties(a,b) → 0 none, 1 NAP, 2 alliance, 3 war
  function withDiplo(treaties, fn) {
    const saved = M.Sim.Diplo;
    M.Sim.Diplo = { isAllied: (S, a, b) => a !== b && treaties(a, b) === 2, atWar: (S, a, b) => { const c = treaties(a, b); return c === 3 || c === 4; }, status: (S, a, b) => ({ treaty: treaties(a, b) }) };
    try { return fn(); } finally { M.Sim.Diplo = saved; }
  }
  // common drafts
  const LASER = n => ({ hull: 2, comp: 'mark-1-computer', shield: 'class-1-shield', armor: 'titanium-armor', engine: 'retro-engine', man: 0, weapons: [{ type: 'laser', count: n }] });
  const DUMMY = { hull: 3, engine: 'retro-engine', man: 0, armor: 'titanium-armor' };             // 600 HP, no weapons, no shield, defense = 0 + (-1) + 0 + 1 = 0
  return { D, C, mkE, setDesign, mkSide, mkPlanet, mkBattle, arena, activate, place, sumEv, mkWorld, own, fleet, withDiplo, LASER, DUMMY };
}

module.exports = function (M, t) {
  const F = fixtures(M), C = F.C, D = F.D;

  // ---------------------------------------------------------------------------------------------------------------- to-hit maths (§4.5)
  t.test('to-hit table: miss thresholds 95(cap) 90 80 70 60 50 40 30 20 10 <=0 for attack-defense -5 .. +5', () => {
    const want = { '-9': 95, '-5': 95, '-4': 90, '-3': 80, '-2': 70, '-1': 60, '0': 50, '1': 40, '2': 30, '3': 20, '4': 10, '5': 0, '6': -10, '9': -40 };
    for (const k in want) t.eq(C.missThreshold(+k + 3, 3), want[k], 'd=' + k);
  });
  t.test('to-hit table: P(hit) = 6 11 21 31 41 51 61 71 81 91 100 percent (6% floor, 100% from +5)', () => {
    const want = { '-8': 6, '-5': 6, '-4': 11, '-3': 21, '-2': 31, '-1': 41, '0': 51, '1': 61, '2': 71, '3': 81, '4': 91, '5': 100, '6': 100, '12': 100 };
    for (const k in want) t.eq(Math.round(C.hitProb(C.missThreshold(+k + 4, 4)) * 100), want[k], 'd=' + k);
  });
  t.test('hitProb: exact fractions at the edges (miss 95 -> 6/100, miss 100 -> 1/100, miss <= 1 -> certain)', () => {
    t.near(C.hitProb(95), 0.06, 1e-12); t.near(C.hitProb(100), 0.01, 1e-12); t.eq(C.hitProb(1), 1); t.eq(C.hitProb(0), 1); t.eq(C.hitProb(-40), 1); t.eq(C.hitProb(101), 0);
  });
  t.test('cloaked targets add +50 to the miss threshold, blocked beams +30, both are capped at 95 BEFORE the accuracy bonus', () => {
    t.eq(C.missThreshold(5, 3, { cloak: true }), 80);
    t.eq(C.missThreshold(5, 3, { rock: true }), 60);
    t.eq(C.missThreshold(5, 3, { rock: true, cloak: true }), 95);
    t.eq(C.missThreshold(1, 1, { cloak: true }), 95);
    t.eq(C.missThreshold(5, 3, { cloak: true, acc: 3 }), 50);                   // 80 - 30
    t.eq(C.missThreshold(1, 9, { rock: true, cloak: true, acc: 3 }), 65);       // capped 95, then -30
  });
  t.test('v1.3 "precap" quirk: a missile with accuracy bonus b hits 6% + 10%*b against any hopeless defense (Plasma +7 -> 76%, Zeon/Proton/Hellfire +6 -> 66%, Hercular +5 -> 56%)', () => {
    const p = acc => Math.round(C.hitProb(C.missThreshold(1, 30, { acc })) * 100);
    t.eq(p(7), 76); t.eq(p(6), 66); t.eq(p(5), 56); t.eq(p(4), 46); t.eq(p(3), 36); t.eq(p(2), 26); t.eq(p(1), 16); t.eq(p(0), 6);
  });
  t.test('beam damage interpolation: the OSG example (Heavy Laser 1-7, miss 50, roll 75) is 4; roll == miss gives the minimum, roll 100 the maximum', () => {
    t.eq(C.beamDamage(50, 75, 1, 7), 4);
    for (const miss of [95, 80, 50, 30, 10, 1, 0, -10, -40]) for (const [lo, hi] of [[1, 4], [1, 7], [3, 15], [10, 40], [20, 100], [200, 1000], [4, 16]]) {
      t.eq(C.beamDamage(miss, Math.max(miss, 1), lo, hi) >= lo, true);
      t.eq(C.beamDamage(miss, 100, lo, hi), hi, 'max ' + miss + ' ' + lo + '-' + hi);
    }
    t.eq(C.beamDamage(95, 95, 1, 4), 1); t.eq(C.beamDamage(50, 50, 3, 15), 3);
  });
  t.test('beam damage is monotone in the roll and a negative threshold starts above the minimum (+6: ~10% of the range cut)', () => {
    let prev = -1;
    for (let r = 50; r <= 100; r++) { const d = C.beamDamage(50, r, 5, 40); t.ok(d >= prev); prev = d; }
    t.eq(C.beamDamage(-10, 1, 0, 1000), 100);                                  // (1+10)/(110) = 10% of 1000
    t.eq(C.beamDamage(-40, 1, 0, 1400), 410);                                  // 41/140 of 1400
    t.eq(C.beamDamage(0, 1, 0, 100) <= 1, true);
  });
  t.test('shield: absorb is subtracted per hit, halved (rounded down) by shield-halving weapons, and never heals', () => {
    t.eq(C.afterShield(10, 3, false), 7); t.eq(C.afterShield(10, 5, true), 8); t.eq(C.afterShield(3, 5, true), 1); t.eq(C.afterShield(2, 5, false), 0); t.eq(C.afterShield(1, 15, true), 0);
    t.eq(C.afterShield(10, 1, true), 10);                                      // 1/2 rounds down to 0
  });

  // ---------------------------------------------------------------------------------------------------------------- snapshots from the Design module
  t.test('design snapshot of the start Fighter: small hull, 3 hp, beam defense 3 (R1 + size 2), combat speed 1, one Laser', () => {
    const E = F.mkE(0, 'human'); D.startDesigns(E);
    const s = C.snapshotDesign({}, E, 1);
    t.eq(s.hull, 0); t.eq(s.hp, 3); t.eq(s.beamDef, 3); t.eq(s.missDef, 3); t.eq(s.combatSpeed, 1); t.eq(s.weapons.length, 1); t.eq(s.weapons[0].id, 'laser'); t.eq(s.weapons[0].count, 1);
    t.eq(s.hullW, 1); t.eq(s.attack, 0); t.eq(s.absorb, 0);
  });
  t.test('design snapshot of the start Destroyer: medium hull 18 hp, defense 2, Nuclear Missile + 3 Lasers; weight indexes carry the first weapon enum', () => {
    const E = F.mkE(0, 'human'); D.startDesigns(E);
    const s = C.snapshotDesign({}, E, 2);
    t.eq(s.hp, 18); t.eq(s.beamDef, 2); t.eq(s.weapons.map(w => w.id + 'x' + w.count).join(), 'nuclear-missilex1,laserx3');
    t.eq(s.wt.w0, 3); t.eq(s.wt.shield, 0); t.eq(s.wt.armor, 0); t.eq(s.hullW, 5);
  });
  t.test('snapshots are self-contained JSON (no functions, survive a JSON round trip unchanged)', () => {
    const E = F.mkE(0, 'human'); D.startDesigns(E);
    for (let i = 0; i < 5; i++) { const s = C.snapshotDesign({}, E, i); t.deep(JSON.parse(JSON.stringify(s)), s); }
  });
  t.test('race modifiers: Mrrshan +4 attack level (+4 initiative through it), Alkari +3 beam & missile defense and +3 initiative', () => {
    const m = C.raceMod('mrrshan'), a = C.raceMod('alkari'), h = C.raceMod('human');
    t.eq(m.compLevel, 4); t.eq(m.initiative, 4); t.eq(a.defense, 3); t.eq(a.misDefense, 3); t.eq(a.initiative, 3); t.eq(h.compLevel + h.defense + h.initiative, 0);
    t.eq(C.raceWeight('mrrshan'), 15); t.eq(C.raceWeight('alkari'), 15); t.eq(C.raceWeight('human'), 0);
  });

  // ---------------------------------------------------------------------------------------------------------------- battle set-up (§4.2)
  t.test('set-up: groups start in column 0 (left) / 9 (right) on rows 3,4,2,5,1,6 in design order; ids run planet, left, right', () => {
    const fl = n => ({ draft: F.LASER(1), n });
    const B = F.arena({ fleet: [fl(1), fl(2), fl(3), fl(4), fl(5), fl(6)] }, { fleet: [fl(7), fl(8)] });
    t.eq(B.units.length, 8);
    const rows = [3, 4, 2, 5, 1, 6];
    for (let i = 0; i < 6; i++) { t.eq(B.units[i].x, 0); t.eq(B.units[i].y, rows[i]); t.eq(B.units[i].side, 0); t.eq(B.units[i].count, i + 1); }
    t.eq(B.units[6].x, 9); t.eq(B.units[6].y, 3); t.eq(B.units[7].y, 4); t.eq(B.units[6].side, 1);
    t.eq(B.round, 1); t.eq(B.phase, 'turn'); t.ok(B.active !== null);
  });
  t.test('set-up: a planet with bases is unit 0 at (1,3) when the left side owns it and at (8,3) when the right side does', () => {
    const a = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 4 }, planetSide: 0 });
    t.eq(a.units[0].kind, 'planet'); t.eq(a.units[0].x, 1); t.eq(a.units[0].y, 3); t.eq(a.units[0].count, 4); t.eq(a.units[0].side, 0);
    const b = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 4 }, planetSide: 1 });
    t.eq(b.units[0].x, 8); t.eq(b.units[0].side, 1); t.eq(b.planet.side, 1);
  });
  t.test('set-up: a monster is one group on the right in row 3', () => {
    const L = F.mkSide({ empire: 0, fleet: [{ draft: F.LASER(1), n: 2 }] });
    const R = { empire: -1, fleetId: -1, ships: [1, 0, 0, 0, 0, 0], designs: [C.monsterStats('crystal', 2), null, null, null, null, null], role: 'attacker', race: 'monster', name: 'Space Crystal', human: false,
      mod: { compLevel: 0, initiative: 0, defense: 0, misDefense: 0 }, tl: [1, 1, 1, 1, 1, 1], autoWeight: 0, antidote: 0, monster: { kind: 'crystal' } };
    const B = C.create(null, F.mkBattle(L, R, { attacker: -1 }), M.RNG.create('m'));
    const m = B.units[B.units.length - 1];
    t.eq(m.kind, 'monster'); t.eq(m.x, 9); t.eq(m.y, 3); t.eq(m.count, 1); t.eq(m.hp1, 5000); t.eq(m.comp, 10); t.eq(m.speed, 2);
  });
  t.test('rocks: none = 0, some = 1..4, many = at most 7 (distinct); x in 2..8, never orthogonally adjacent, never within 1 of the planet', () => {
    for (let s = 0; s < 120; s++) {
      for (const [kind, lo, hi] of [['none', 0, 0], ['some', 1, 4], ['many', 1, 7]]) {
        const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 1 }, planetSide: s % 2, seed: 'r' + s, battle: { rocks: kind } });
        t.between(B.rocks.length, lo, hi, kind);
        const pu = B.units[0];
        for (const r of B.rocks) {
          t.between(r.x, 2, 8); t.between(r.y, 0, 7);
          t.ok(Math.max(Math.abs(r.x - pu.x), Math.abs(r.y - pu.y)) > 1, 'planet clearance');
          for (const q of B.rocks) if (q !== r) t.ok(Math.abs(q.x - r.x) + Math.abs(q.y - r.y) !== 1, 'orthogonal neighbours');
        }
      }
    }
  });
  t.test('rocks: "many" really produces 5-7 rolls (several distinct rocks on most seeds)', () => {
    let sum = 0; const n = 100;
    for (let s = 0; s < n; s++) sum += F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'm' + s, battle: { rocks: 'many' } }).rocks.length;
    t.between(sum / n, 4, 7);
  });
  t.test('nebula: shields (ships and the planet) are off', () => {
    const d = Object.assign(F.LASER(1), { shield: 'class-5-shield' });
    const n = F.arena({ fleet: [{ draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }] }, { planet: { bases: 2, shield: 10, absorb: 5 }, planetSide: 0, battle: { nebula: true } });
    t.eq(n.units[0].absorb, 0); t.eq(n.units[1].absorb, 0); t.eq(n.units[2].absorb, 0);
    const c = F.arena({ fleet: [{ draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }] }, { planet: { bases: 2, shield: 10, absorb: 5 }, planetSide: 0 });
    t.eq(c.units[0].absorb, 15); t.eq(c.units[1].absorb, 5);
  });
  t.test('planet unit: attack level = base computer + 1 (+4 Mrrshan), beam defense 1, missile defense = ECM + 1, two missile slots of 3 launchers per base, unlimited ammo', () => {
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 5, comp: 3, ecm: 2, weapon: 'hyper-v', weapon2: 'scatter-pack-v', baseHp: 100 }, planetSide: 0 });
    const p = B.units[0];
    t.eq(p.comp, 4); t.eq(p.def, 1); t.eq(p.mdef, 3); t.eq(p.hp1, 100); t.eq(p.weapons.length, 2); t.eq(p.weapons[0].id, 'hyper-v'); t.eq(p.weapons[1].id, 'scatter-pack-v');
    t.eq(p.weapons[0].count, 3); t.eq(p.weapons[1].shots, -1); t.eq(p.weapons[0].range, 40);
    const m = F.arena({ fleet: [{ draft: F.LASER(1), n: 1, race: 'mrrshan' }], race: 'mrrshan' }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 1, comp: 1 }, planetSide: 0 });
    t.eq(m.units[0].comp, 6);
  });
  t.test('unit stats: Mrrshan ships fight 4 attack levels better, Alkari ships are 3 harder to hit by beams and missiles', () => {
    const B = F.arena({ race: 'mrrshan', fleet: [{ draft: F.LASER(1), n: 1 }] }, { race: 'alkari', fleet: [{ draft: F.LASER(1), n: 1 }] });
    const mr = B.units[0], al = B.units[1], base = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] });
    t.eq(mr.comp, base.units[0].comp + 4); t.eq(al.def, base.units[1].def + 3); t.eq(al.mdef, base.units[1].mdef + 3); t.eq(al.comp, base.units[1].comp);
  });

  // ---------------------------------------------------------------------------------------------------------------- initiative (§4.3)
  const prioOf = (race, extra) => {
    const draft = Object.assign({ hull: 1, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor' }, extra || {});
    const B = F.arena({ race, fleet: [{ draft, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    return C.priority(B.units[0]);
  };
  t.test('initiative = attack level + combat speed (+3 Battle Scanner, which also gives +1 attack) (+3 Alkari) (+4 Mrrshan through the attack level)', () => {
    t.eq(prioOf('human'), 1 + 1);                                                            // Mark I + speed 1
    t.eq(prioOf('human', { specials: ['battle-scanner'] }), 2 + 1 + 3);                      // (1+1 scanner) + 1 + 3
    t.eq(prioOf('mrrshan'), 5 + 1);
    t.eq(prioOf('alkari'), 1 + 1 + 3);
    t.eq(prioOf('mrrshan', { specials: ['battle-scanner'] }), 6 + 1 + 3);
    t.eq(prioOf('human', { engine: 'impulse-engine', man: 4 }), 1 + 3);                      // maneuver rating 5 -> combat speed 3
    t.eq(prioOf('human', { engine: 'impulse-engine', man: 4, specials: ['inertial-stabilizer'] }), 1 + 4);
  });
  t.test('initiative: a planet with bases acts like a scanner ship (attack level + 1 + 3), a ready teleporter acts first (+1000), a slowed group loses speed', () => {
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 1, comp: 2 }, planetSide: 0 });
    t.eq(C.priority(B.units[0]), 3 + 3);
    const T = F.arena({ fleet: [{ draft: Object.assign(F.LASER(1), { engine: 'sub-light-engine', specials: ['sub-space-teleporter'] }), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] });
    t.ok(C.priority(T.units[0]) >= 1000); t.eq(T.active, 0);
    T.units[0].st.subspace = -1; t.ok(C.priority(T.units[0]) < 1000);
    const U = B.units[1]; const p = C.priority(U); U.unman = 1; t.eq(C.priority(U), p - 1);
  });
  t.test('initiative order: highest first; ties go to the higher unit id (right side before left, later design before earlier)', () => {
    const d = F.LASER(1);
    const B = F.arena({ fleet: [{ draft: d, n: 1 }, { draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }, { draft: d, n: 1 }] });
    t.deep([B.active].concat(B.order), [3, 2, 1, 0]);
    const M2 = F.arena({ race: 'mrrshan', fleet: [{ draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }] });
    t.deep([M2.active].concat(M2.order), [0, 1]);                                             // Mrrshan act first despite being on the left
    const A = F.arena({ fleet: [{ draft: d, n: 1 }] }, { race: 'alkari', fleet: [{ draft: d, n: 1 }] });
    t.deep([A.active].concat(A.order), [1, 0]);
  });
  t.test('a round starts with round-start + turn-start events pending for the first call, and every unit acts once per round', () => {
    const d = F.LASER(1);
    const B = F.arena({ fleet: [{ draft: d, n: 1 }, { draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }] });
    t.eq(B.pend.map(e => e.type).join(), 'round-start,turn-start');
    const seen = [];
    let guard = 0;
    while (B.round === 1 && guard++ < 10) {
      if (B.active === null) break;
      seen.push(B.active);
      const ev = C.act(B, B.active, { type: 'done' });
      t.ok(ev.ok !== false);
    }
    t.deep(seen.slice().sort(), [0, 1, 2]); t.eq(B.active, null); t.eq(B.phase, 'roundEnd');
    const ev = C.endRound(B);
    t.eq(B.round, 2); t.eq(ev[0].type, 'round-end'); t.ok(ev.some(e => e.type === 'round-start')); t.ok(B.active !== null);
  });

  // ---------------------------------------------------------------------------------------------------------------- movement (§4.2, §4.4)
  const runner = extra => Object.assign({ hull: 1, comp: 'mark-1-computer', engine: 'nuclear-engine', man: 1, armor: 'titanium-armor' }, extra || {});    // combat speed 2
  t.test('movement: Chebyshev distance, a diagonal costs 1 — a speed-2 group can reach exactly the cells within 2 squares', () => {
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    const u = F.activate(B, 0);
    t.eq(u.speed, 2);
    const mv = C.legalMoves(B, 0);
    t.eq(mv.length, 14);                                                                       // x 0..2, y 1..5 = 15 cells minus its own
    t.eq(mv.filter(m => m.cost === 1).length, 5); t.eq(mv.filter(m => m.cost === 2).length, 9);
    t.ok(mv.some(m => m.x === 2 && m.y === 5 && m.cost === 2));
    t.ok(!mv.some(m => m.x === 3));
  });
  t.test('movement: rocks and the planet block, other groups can be passed through but not stood on', () => {
    const B = F.arena({ fleet: [{ draft: runner({ engine: 'sub-light-engine', man: 2 }), n: 1 }, { draft: F.DUMMY, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { planet: { bases: 1 }, planetSide: 0 });
    // units: 0 planet (1,3), 1 runner (0,3), 2 dummy (0,4), 3 enemy (9,3)
    const u = F.activate(B, 1);
    B.rocks = [{ x: 2, y: 3 }];
    t.eq(u.speed, 2);
    const mv = C.legalMoves(B, 1);
    t.ok(!mv.some(m => m.x === 1 && m.y === 3), 'planet cell');
    t.ok(!mv.some(m => m.x === 2 && m.y === 3), 'rock cell');
    t.ok(!mv.some(m => m.x === 0 && m.y === 4), 'occupied cell');
    t.ok(mv.some(m => m.x === 0 && m.y === 5 && m.cost === 2), 'through the friendly group');
    t.ok(mv.some(m => m.x === 2 && m.y === 2 && m.cost === 2), 'around the planet');
  });
  t.test('movement: act move walks step by step (one move event per square), spends movement and is refused beyond reach or onto a rock', () => {
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    const u = F.activate(B, 0); B.rocks = [{ x: 0, y: 5 }];
    let ev = C.act(B, 0, { type: 'move', x: 2, y: 5 });
    t.eq(ev.filter(e => e.type === 'move').length, 2); t.eq(u.x, 2); t.eq(u.y, 5); t.eq(u.actman, 0);
    ev = C.act(B, 0, { type: 'move', x: 3, y: 5 });
    t.eq(ev.ok, false); t.eq(ev[ev.length - 1].type, 'invalid');
    F.activate(B, 0); u.x = 0; u.y = 3;
    ev = C.act(B, 0, { type: 'move', x: 0, y: 5 }); t.eq(ev.ok, false);
    ev = C.act(B, 0, { type: 'move', x: 5, y: 3 }); t.eq(ev.ok, false);
  });
  t.test('movement: only the active unit may act; a bad action or unit is answered with an invalid event', () => {
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    const other = B.units.find(u => u.id !== B.active).id;
    t.eq(C.act(B, other, { type: 'done' }).ok, false);
    t.eq(C.act(B, 99, { type: 'done' }).ok, false);
    t.eq(C.act(B, B.active, { type: 'dance' }).ok, false);
    t.eq(C.act(B, B.active, null).ok, false);
  });
  t.test('movement: a Sub Space Teleporter jumps to any empty square, spends all movement once per turn and may then fire', () => {
    const B = F.arena({ fleet: [{ draft: runner({ engine: 'sub-light-engine', specials: ['sub-space-teleporter'], weapons: [{ type: 'laser', count: 2 }] }), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    t.eq(B.active, 0);
    const mv = C.legalMoves(B, 0);
    t.ok(mv.some(m => m.x === 8 && m.y === 3 && m.tele === true));
    t.ok(!mv.some(m => m.x === 9 && m.y === 3), 'occupied');
    const ev = C.act(B, 0, { type: 'move', x: 8, y: 3 });
    t.eq(ev.filter(e => e.type === 'teleport').length, 1); t.eq(B.units[0].x, 8); t.eq(B.units[0].actman, 0);
    t.ok(C.targets(B, 0).some(x => x.id === 1), 'fires after teleporting');
    t.eq(C.legalMoves(B, 0).length, 0);
  });
  t.test('movement: a Subspace Interdictor over the planet cancels every teleporter when the attackers own one', () => {
    const tele = runner({ engine: 'sub-light-engine', specials: ['sub-space-teleporter'] });
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: tele, n: 1 }] }, { planet: { bases: 1, interdictor: true }, planetSide: 0 });
    t.eq(B.units[2].st.subspace, -1); t.ok(C.priority(B.units[2]) < 1000);
    const C2 = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: tele, n: 1 }] }, { planet: { bases: 1, interdictor: false }, planetSide: 0 });
    t.eq(C2.units[2].st.subspace, 1);
  });

  // ---------------------------------------------------------------------------------------------------------------- targets & hit chances (§4.4–4.5)
  t.test('targets: only enemies in weapon reach are listed; hitChance equals the to-hit table value', () => {
    const att = { hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 2 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    F.activate(B, 0);
    t.eq(C.targets(B, 0).length, 0);                                                           // 9 squares away, laser range 1
    F.place(B, 1, 1, 3);
    const tg = C.targets(B, 0);
    t.eq(tg.length, 1); t.eq(tg[0].id, 1); t.eq(tg[0].range, 1); t.eq(tg[0].type, 'ship');
    // attack 5 vs defense 0: d = +5 -> certain hit
    t.eq(B.units[0].comp, 5); t.eq(B.units[1].def, 0); t.eq(tg[0].hitChance, 1);
    B.units[1].def = 3;                                                                        // d = +2 -> miss 30 -> 71%
    t.near(C.targets(B, 0)[0].hitChance, 0.71, 1e-12);
    t.near(C.hitChance(B, 0, 1), 0.71, 1e-12);
    t.near(C.targets(B, 0)[0].hit.beam, 0.71, 1e-12);
  });
  t.test('targets: missiles use the missile defense (ECM) and their own accuracy; modes filter the weapon kinds; ranges gate', () => {
    const att = { hull: 2, comp: 'mark-2-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }, { type: 'hyper-x', count: 2 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    F.activate(B, 0);
    F.place(B, 1, 5, 3);
    t.eq(C.targets(B, 0, 'beam').length, 0);
    const tg = C.targets(B, 0, 'missile');
    t.eq(tg.length, 1); t.deep(tg[0].weapons, [1]);
    B.units[1].mdef = 4;                                                                       // attack 2 vs 4: d=-2 -> miss 70; hyper-x +1 -> 60 -> 41%
    t.near(C.targets(B, 0, 'missile')[0].hitChance, 0.41, 1e-12);
    t.eq(C.targets(B, 0, 'bomb').length, 0);
    F.place(B, 1, 8, 3);                                                                       // hyper-x range is 7
    t.eq(C.targets(B, 0, 'missile').length, 0);
    F.place(B, 1, 7, 3); t.eq(C.targets(B, 0, 'missile').length, 1);
  });
  t.test('targets: accuracy bonuses accumulate over the slots of one attack (quirk) — Megabolt (+3) before a Laser also sharpens the Laser', () => {
    const mk = order => ({ hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: order });
    const run = order => {
      const B = F.arena({ fleet: [{ draft: mk(order), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
      F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].def = 3;                              // d = +2: miss 30
      return C.targets(B, 0)[0].chances;
    };
    const a = run([{ type: 'megabolt-cannon', count: 1 }, { type: 'laser', count: 1 }]);
    t.eq(a.length, 2); t.eq(a[0].hit, 1); t.eq(a[1].hit, 1);
    const b = run([{ type: 'laser', count: 1 }, { type: 'megabolt-cannon', count: 1 }]);
    t.near(b[0].hit, 0.71, 1e-12); t.eq(b[1].hit, 1);
  });
  t.test('targets: attack 3 vs defense 3 is 51%; +30 with a rock in between (21%); a cloaked target caps at 95 (6%)', () => {
    const att = { hull: 2, comp: 'mark-3-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'heavy-laser', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    F.activate(B, 0); F.place(B, 0, 3, 3); F.place(B, 1, 5, 3); B.units[1].def = 3;
    t.near(C.targets(B, 0)[0].hitChance, 0.51, 1e-12);
    B.rocks = [{ x: 4, y: 3 }];
    t.near(C.targets(B, 0)[0].hitChance, 0.21, 1e-12);
    t.eq(C.lineBlocked(B, B.units[0], B.units[1]), true);
    B.rocks = [{ x: 4, y: 5 }];
    t.eq(C.lineBlocked(B, B.units[0], B.units[1]), false);
    B.units[1].st.cloak = 1;
    t.near(C.targets(B, 0)[0].hitChance, 0.06, 1e-12);                                         // 50 + 50 + 30(no: the rock moved) = 100 -> capped 95 -> 6%
    t.eq(C.targets(B, 0)[0].cloaked, true);
  });
  t.test('errata 4: the rock +30 needs the LAST obstruction on the line to be a rock — ships never count, the planet\'s square overwrites an earlier rock', () => {
    const att = { hull: 2, comp: 'mark-3-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'heavy-laser', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] });
    F.activate(B, 0); F.place(B, 0, 1, 3); F.place(B, 1, 7, 3);
    B.rocks = [{ x: 3, y: 3 }]; t.eq(C.lineBlocked(B, B.units[0], B.units[1]), true, 'plain rock');
    B.units.push({ kind: 'planet', x: 5, y: 3 });                                           // a planet square between the shooter and the target
    t.eq(C.lineBlocked(B, B.units[0], B.units[1]), false, 'rock then planet square: overwritten');
    B.rocks = [{ x: 3, y: 3 }, { x: 6, y: 3 }]; t.eq(C.lineBlocked(B, B.units[0], B.units[1]), true, 'planet then rock: blocked');
  });

  // ---------------------------------------------------------------------------------------------------------------- Monte-Carlo agreement of the real shots with the numbers shown
  const volleys = (B, id, target, n) => {
    let shots = 0, hits = 0, dmg = 0;
    for (let i = 0; i < n; i++) {
      for (const w of B.units[id].weapons) w.numfire = w.rof;
      const ev = C.act(B, id, { type: 'fire', target, weapons: 'beams' });
      for (const e of ev) if (e.type === 'beam') { shots += e.shots; hits += e.hits; dmg += e.damage; }
      F.activate(B, id);
    }
    return { shots, hits, dmg };
  };
  t.test('real beam shots hit at the announced rate (attack 3 vs defense 3 -> 51%, 20000 shots)', () => {
    const att = { hull: 2, comp: 'mark-3-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1000 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { seed: 'mc1' });
    F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].def = 3; B.units[1].absorb = 0; B.units[1].hp1 = B.units[1].hp2 = 1e9;
    const r = volleys(B, 0, 1, 20);
    t.eq(r.shots, 20000);
    t.near(r.hits / r.shots, 0.51, 0.015);
  });
  t.test('real beam damage averages the interpolated value (miss 50, Laser 1-4: ~2.5 per hit before shields; Class III shield 3 leaves ~0.17)', () => {
    const att = { hull: 2, comp: 'mark-3-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'heavy-ion-cannon', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: att, n: 1000 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { seed: 'mc2' });
    F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].def = 3; B.units[1].absorb = 0; B.units[1].hp1 = B.units[1].hp2 = 1e9;
    const r = volleys(B, 0, 1, 20);
    let e = 0, n = 0; for (let roll = 50; roll <= 100; roll++) { e += C.beamDamage(50, roll, 3, 15); n++; }
    t.near(r.dmg / r.hits, e / n, 0.15);
  });
  t.test('the cumulative accuracy quirk is real: Laser after Megabolt (+3) hits 100% at d=+2 where it alone would hit 71%', () => {
    const d = { hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'megabolt-cannon', count: 1 }, { type: 'laser', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: d, n: 500 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { seed: 'mc3' });
    F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].def = 3; B.units[1].absorb = 0; B.units[1].hp1 = B.units[1].hp2 = 1e9;
    let laserHits = 0, laserShots = 0, megaHits = 0, megaShots = 0;
    for (let i = 0; i < 10; i++) {
      for (const w of B.units[0].weapons) w.numfire = w.rof;
      const ev = C.act(B, 0, { type: 'fire', target: 1 });
      for (const e of ev) if (e.type === 'beam') { if (e.weapon === 'laser') { laserHits += e.hits; laserShots += e.shots; } else { megaHits += e.hits; megaShots += e.shots; } }
      F.activate(B, 0);
    }
    t.near(laserHits / laserShots, 1, 1e-12);
    t.near(megaHits / megaShots, 1, 1e-12);
    const d2 = { hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }, { type: 'megabolt-cannon', count: 1 }] };
    const B2 = F.arena({ fleet: [{ draft: d2, n: 500 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { seed: 'mc4' });
    F.activate(B2, 0); F.place(B2, 1, 1, 3); B2.units[1].def = 3; B2.units[1].absorb = 0; B2.units[1].hp1 = B2.units[1].hp2 = 1e9;
    let lh = 0, ls = 0;
    for (let i = 0; i < 10; i++) {
      for (const w of B2.units[0].weapons) w.numfire = w.rof;
      for (const e of C.act(B2, 0, { type: 'fire', target: 1 })) if (e.type === 'beam' && e.weapon === 'laser') { lh += e.hits; ls += e.shots; }
      F.activate(B2, 0);
    }
    t.near(lh / ls, 0.71, 0.03);
  });
};
module.exports.fixtures = fixtures;
