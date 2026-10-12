// AI military + espionage planners (js/ai/military.js, js/ai/spy.js) against research/08 §3–§5, §10, §13–§17 and research/07 §2.11, §2.13, §8.4–8.5.
// Hand-built war fixtures on top of Setup.create (three AI empires: 0 / 1 = the planner "me" / 2 = the foe), the real Diplo for treaties, a fake RNG where a roll must be forced,
// Monte-Carlo checks (>= 10 000 draws) of every random gate, and whole-plan determinism / purity / performance checks.
module.exports = function (M, t) {
  const AI = M.AI, Mil = AI.Military, Geo = M.Sim.Geo, F = M.Sim.Fleet, Dz = M.Sim.Design, Dp = M.Sim.Diplo, C = M.Sim.Colony, K = M.Data.Components;
  const SCOUT = 0, FIGHTER = 1, DESTROYER = 2, BOMBER = 3, COLONY = 4;                 // start-design slots: threat 0 / 1 / 7 / 5 / 0

  // ---------------------------------------------------------------------------------------------------------------------------------------------------------
  // fixtures
  // ---------------------------------------------------------------------------------------------------------------------------------------------------------
  function game(seed, o) {
    o = o || {};
    return M.Sim.Setup.create({ size: o.size || 'medium', opponents: o.opponents || 2, seed, playerAI: true, race: 'human', difficulty: o.difficulty || 'average' });
  }
  function meRange(S, fuel) { S.empires[1].mods.fuel = fuel || 30; F.updateRange(S); }
  // the world: empire 1 plans, empire 2 is the foe; `near` = every other planet ordered by distance from my capital (ties by id)
  function world(seed, o) {
    o = o || {};
    const S = game(seed, o), me = S.empires[1], foe = S.empires[2], third = S.empires[0];
    me.mods.fuel = 6;                                                                     // wide fuel range: every fixture planet near my capital is range-flag 1
    me.race = o.race || 'meklar'; foe.race = 'psilon'; third.race = 'klackon';
    const P = S.planets[me.capital];
    const near = S.planets.filter(q => q.id !== P.id && !S.empires.some(e => e.capital === q.id) && q.id !== S.orion).sort((a, b) => Geo.unitDist(S, P.starId, a.starId) - Geo.unitDist(S, P.starId, b.starId) || a.id - b.id);
    S.planets[foe.capital].typeIdx = 1; S.planets[third.capital].typeIdx = 1;           // other capitals are radiated: never an attack target of these fixtures
    F.updateRange(S);
    return { S, me, foe, third, P, near };
  }
  // turn planet q into a colony of empire `e` (pop/bases/special/type overridable)
  const TYPES = ['none', 'radiated', 'toxic', 'inferno', 'dead', 'tundra', 'barren', 'minimal', 'desert', 'steppe', 'arid', 'ocean', 'jungle', 'terran'];
  function colony(S, q, e, o) {
    o = o || {};
    q.typeIdx = o.typeIdx || 11; q.type = TYPES[q.typeIdx];
    q.special = o.special || 'normal'; q.maxPop = o.maxPop || 80; q.growth = 'normal'; q.mp1 = q.mp2 = q.mp3 = q.maxPop;
    C.found(S, S.empires[e], q, 2);
    q.pop = o.pop === undefined ? 30 : o.pop; q.bases = o.bases || 0; q.shield = o.shield || 0; q.factories = o.factories === undefined ? 10 : o.factories;
    q.sliders = [0, 0, 100, 0, 0];
    return q;
  }
  const war = (S, a, b, treaty) => Dp.setTreaty(S, a, b, treaty === undefined ? 3 : treaty);
  const contact = (S, a, b) => { S.empires[a].relations[b].contact = true; S.empires[b].relations[a].contact = true; };
  const ships = (S, owner, star, slot, n) => F.addShips(S, owner, star, slot, n);
  function moving(S, owner, from, to, slot, n) {
    const A = S.stars[from], f = { id: S.nextId++, owner, star: -1, from, to, x: A.x, y: A.y, speed: 3, ships: [0, 0, 0, 0, 0, 0] };
    f.ships[slot] = n; S.fleets.push(f); return f;
  }
  const fakeR = (seq, dflt) => { let i = 0; return { int: (a, b) => (i < seq.length ? seq[i++] : dflt !== undefined ? dflt : a), chance: () => false, used: () => i }; };
  const step = name => AI.steps.find(s => s.name === name);
  const refresh = S => { for (const E of S.empires) Dz.refresh(S, E); };
  // full step 30 (after the real intel step) for empire `eid`; o: shared (overrides after intel), R (fake rng), obj, fronts ('P' = a single front anchored at my capital)
  function run(w, o) {
    o = o || {}; const S = w.S;
    refresh(S);
    const ctx = AI.ctx(S, o.eid === undefined ? 1 : o.eid, o.seed === undefined ? 7 : o.seed);
    step('intel').fn(ctx);
    if (o.fronts === 'P') ctx.shared.fronts = [{ anchor: w.P.id, star: w.P.starId, value: 0, enemy: 2 }];
    if (o.shared) Object.assign(ctx.shared, o.shared);
    if (o.R) ctx.R = o.R;
    if (o.obj !== undefined) ctx.obj = o.obj;
    step('military').fn(ctx);
    return ctx;
  }
  // a plan object (military.newPlan) on top of the real intel overlay, with ONE front anchored at my capital unless keepFronts
  function mkPlan(w, o) {
    o = o || {}; refresh(w.S);
    const ctx = AI.ctx(w.S, 1, o.seed === undefined ? 1 : o.seed);
    step('intel').fn(ctx);
    if (o.shared) Object.assign(ctx.shared, o.shared);
    if (o.obj !== undefined) ctx.obj = o.obj;
    ctx.R = o.R || fakeR([], 1);
    const plan = Mil.newPlan(ctx);
    if (!o.keepFronts) plan.fronts = [{ anchor: w.P.id, star: w.P.starId, value: 0, enemy: 2 }];
    return plan;
  }
  const ord = (ctx, type) => ctx.orders.filter(o => o.t === type);
  // a standard attack scene: my stack of `n` fighters at my capital, foe colony T with `k` destroyers and `b` bases, at war and in contact
  function scene(seed, o) {
    o = o || {};
    const w = world(seed, o), T = colony(w.S, w.near[0], 2, { pop: o.pop === undefined ? 30 : o.pop, bases: o.bases || 0, special: o.special });
    war(w.S, 1, 2, o.treaty); contact(w.S, 1, 2);
    if (o.fighters) ships(w.S, 1, w.P.starId, FIGHTER, o.fighters);
    if (o.destroyers) ships(w.S, 2, T.starId, DESTROYER, o.destroyers);
    return Object.assign(w, { T });
  }
  const withQuirk = (name, v, fn) => { const old = AI.QUIRKS[name]; AI.QUIRKS[name] = v; try { fn(); } finally { AI.QUIRKS[name] = old; } };

  // =========================================================================================================================================================
  // rule helpers
  // =========================================================================================================================================================
  t.test('best speed S = best engine tech level (6,12,…,48) + 3: 3 at the start, 9 with the Nuclear Engine, 51 with all; non-engine levels do not count', () => {
    const E = { research: { completed: [[1], [1], [1], [1], [1, 3, 5, 7], [1]] } };
    t.eq(Mil.bestSpeed(E), 3);
    E.research.completed[4] = [1, 3, 5, 6]; t.eq(Mil.bestSpeed(E), 9);
    E.research.completed[4] = [1, 6, 12, 18, 24]; t.eq(Mil.bestSpeed(E), 27);
    E.research.completed[4] = [1, 6, 12, 18, 24, 30, 36, 42, 48]; t.eq(Mil.bestSpeed(E), 51);
    E.research.completed[4] = [1, 7, 13, 49]; t.eq(Mil.bestSpeed(E), 3, 'only the engine techs count');
    t.eq(Mil.bestSpeed({}), 3);
  });
  t.test('colonisable-type threshold: 7 Minimal by default, follows E.mods.colonyFor (6..1), Silicoids settle everything', () => {
    t.eq(Mil.colonyThreshold({ race: 'human', mods: {} }), 7);
    for (let v = 1; v <= 7; v++) t.eq(Mil.colonyThreshold({ race: 'human', mods: { colonyFor: v } }), v);
    t.eq(Mil.colonyThreshold({ race: 'silicoid', mods: { colonyFor: 7 } }), 1);
    t.eq(Mil.colonyThreshold({ race: 'human', mods: { colonyFor: 0 } }), 7, 'garbage falls back to Minimal');
  });
  t.test('design threat of the start designs: Scout 0, Fighter 1, Destroyer 7, Bomber 5 (bombs add nothing), Colony Ship 0', () => {
    const { S, me } = world('thr-start');
    Dz.refresh(S, me);
    t.deep([0, 1, 2, 3, 4, 5].map(i => Mil.designThreat(S, me, i, {})), [0, 1, 7, 5, 0, 0]);
  });
  t.test('design threat formula: Σ weapon TECH LEVEL × count + (shield index+10)·hp/50 + 2·tech level of specials ≥ Battle Scanner', () => {
    const { S, me } = world('thr-formula'), I = K.idx;
    const mk = (hull, weapons, shield, specials) => { const d = Dz.blank(hull); d.engine = 0; d.shield = shield; weapons.forEach((w, i) => { d.weapons[i] = { type: I.weapons[w[0]], count: w[1] }; }); specials.forEach((s, i) => { d.specials[i] = I.specials[s]; }); return d; };
    const th = d => { me.designs[5] = d; Dz.refresh(S, me); return Mil.designThreat(S, me, 5, {}); };
    t.eq(th(mk(2, [['laser', 10]], -1, [])), 30, '10 lasers (level 1) on a Large hull (100 hp): 10 + (0+10)·100/50');
    t.eq(th(mk(2, [['laser', 10]], 0, [])), 32, 'Class I = index 1: (1+10)·100/50 = 22');
    t.eq(th(mk(2, [['laser', 10]], 6, [])), 44, 'Class VII = index 7: 34');
    t.eq(th(mk(2, [['hyper-v', 3]], -1, [])), 12 + 20, 'Hyper-V: enum 6 but tech level 4');
    t.eq(th(mk(2, [['heavy-laser', 2]], -1, [])), 2 + 20, 'Heavy Laser: enum 5, level 1');
    t.eq(th(mk(2, [['phasor', 1]], -1, [])), 26 + 20, 'Phasor: enum 33, level 26');
    t.eq(th(mk(2, [['nuclear-bomb', 4]], 0, [])), 0, 'bombs contribute nothing, so no shield term either');
    t.eq(th(mk(2, [['death-spores', 4]], 0, [])), 0, 'biological weapons are flagged as bombs');
    t.eq(th(mk(2, [['laser', 2], ['nuclear-bomb', 4]], -1, [])), 2 + 20);
    t.eq(th(mk(2, [['laser', 1]], -1, ['battle-scanner'])), 1 + 20 + 2, 'Battle Scanner: enum 9, level 1 → 2');
    t.eq(th(mk(2, [['laser', 1]], -1, ['anti-missile-rockets'])), 1 + 20 + 12, 'level 6 → 12');
    t.eq(th(mk(2, [['laser', 1]], -1, ['reserve-fuel-tanks'])), 1 + 20, 'enum 1 < Battle Scanner');
    t.eq(th(mk(2, [], -1, ['battle-scanner'])), 2, 'the special term needs no weapon');
  });
  t.test('design threat doubles for AI designs after the first council election and again once the game ended; humans never double; threat16 wraps at 65536', () => {
    const { S, me } = world('thr-mult');
    Dz.refresh(S, me);
    t.eq(Mil.designThreat(S, me, DESTROYER, { held: true }), 14);
    t.eq(Mil.designThreat(S, me, DESTROYER, { held: true, ended: true }), 28);
    t.eq(Mil.designThreat(S, me, DESTROYER, { ended: true }), 14);
    me.human = true; t.eq(Mil.designThreat(S, me, DESTROYER, { held: true, ended: true }), 7);
    me.human = false;
    const d = Dz.blank(3); d.engine = 0; d.weapons[0] = { type: K.idx.weapons['laser'], count: 99 }; me.designs[5] = d; Dz.refresh(S, me);
    const full = Mil.designThreat(S, me, 5, { held: true, ended: true });
    t.eq(full, (99 + Math.floor(10 * 600 / 50)) * 4);
    t.eq(Mil.designThreat(S, me, 5, { held: true, ended: true, mask16: true }), full & 0xffff);
    const big = Dz.blank(3); big.engine = 0; big.weapons[0] = { type: K.idx.weapons['death-ray'], count: 99 }; big.weapons[1] = { type: K.idx.weapons['plasma-cannon'], count: 99 }; me.designs[5] = big; Dz.refresh(S, me);
    const huge = Mil.designThreat(S, me, 5, { held: true, ended: true });
    t.eq(Mil.designThreat(S, me, 5, { held: true, ended: true, mask16: true }), huge & 0xffff);
  });
  t.test('planet rating: pop − 10·bases + 30·special − 20 (ultra-poor −20, poor 10, normal 40, artifacts 70, rich 100, ultra-rich 130, 4X 160); own planets pay 5 per base', () => {
    const want = { ultrapoor: -20, poor: 10, normal: 40, artifacts: 70, rich: 100, ultrarich: 130, orion: 160 };
    for (const k in want) {
      t.eq(Mil.planetWeight({ owner: 2, pop: 0, bases: 0, special: k }, false), want[k], k);
      t.eq(Mil.planetWeight({ owner: 2, pop: 30, bases: 3, special: k }, false), 30 - 30 + want[k], k + ' with pop and bases');
      t.eq(Mil.planetWeight({ owner: 1, pop: 30, bases: 3, special: k }, true), 30 - 15 + want[k], k + ' own');
    }
    t.eq(Mil.planetWeight({ owner: -1, pop: 99, bases: 9, special: 'normal' }, false), 40, 'an unowned planet has neither population nor bases');
  });
  t.test('strategic retreat helper: the nearest OTHER planet I own, −1 when none (the §5.3 rule Combat applies)', () => {
    const { S, P, near } = world('retreat');
    t.eq(Mil.retreatTarget(S, 1, P.starId), -1, 'one planet only: the ships are lost');
    const q1 = colony(S, near[2], 1), q2 = colony(S, near[0], 1);
    t.eq(Mil.retreatTarget(S, 1, P.starId), Geo.parsecs(S, P.starId, q1.starId) < Geo.parsecs(S, P.starId, q2.starId) ? q1.starId : q2.starId);
    t.ok(Mil.retreatTarget(S, 1, q2.starId) !== q2.starId, 'never the battle planet itself');
  });
  t.test('bubble sort quirk: the "swapped" flag is reset at every comparison, so a pass ending without a swap stops the sort early', () => {
    const mk = ws => ws.map((w, i) => ({ weight: w, planet: i }));
    t.deep(Mil.bubbleDesc(mk([1, 2, 3, 0])).map(x => x.weight), [2, 3, 1, 0], 'unsorted result of the original loop');
    t.deep(Mil.bubbleDesc(mk([5, 4, 3, 2])).map(x => x.weight), [5, 4, 3, 2]);
    t.deep(Mil.bubbleDesc(mk([2, 3, 4, 5])).map(x => x.weight), [4, 5, 3, 2], 'the second pass ends without a swap in its LAST comparison and quits');
    t.deep(Mil.bubbleDesc(mk([3, 3, 3])).map(x => x.planet), [0, 1, 2], 'ties are never swapped');
  });

  // =========================================================================================================================================================
  // target list (planet_w)
  // =========================================================================================================================================================
  const targetsOf = (w, shared) => { const ctx = AI.ctx(w.S, 1, 1); step('intel').fn(ctx); if (shared) Object.assign(ctx.shared, shared); return Mil.newPlan(ctx).targets; };
  t.test('targets: an enemy planet of an empire I am at war with, inside fuel range, type ≥ threshold, enters the list; peace, NAP, alliance → empty', () => {
    const w = scene('tg-basic', { fighters: 3 });
    t.deep(targetsOf(w).map(x => x.planet), [w.T.id]);
    for (const tr of [0, 1, 2]) { war(w.S, 1, 2, tr); t.eq(targetsOf(w).length, 0, 'treaty ' + tr); }
  });
  t.test('targets: need_conquer opens NAP / alliance / no-treaty empires\' planets; the game having ended (final war) does too', () => {
    for (const tr of [0, 1, 2]) {
      const w = scene('tg-need' + tr, { fighters: 1, treaty: tr });
      t.eq(targetsOf(w).length, 0, 'treaty ' + tr + ' without need');
      t.eq(targetsOf(w, { needConquer: true }).length, 1, 'treaty ' + tr + ' with need');
      t.eq(targetsOf(w, { ended: true }).length, 1, 'treaty ' + tr + ' game ended');
    }
  });
  t.test('targets: planet type must reach the colonisable threshold (Minimal = 7 at the start); Silicoids accept every type; type 0 never', () => {
    const w = scene('tg-type', { fighters: 1 });
    w.T.typeIdx = 6; w.T.type = 'barren'; t.eq(targetsOf(w).length, 0, 'barren < minimal');
    w.T.typeIdx = 7; t.eq(targetsOf(w).length, 1, 'minimal');
    w.S.empires[1].mods.colonyFor = 5; w.T.typeIdx = 5; t.eq(targetsOf(w).length, 1, 'tundra with Controlled Tundra');
    w.T.typeIdx = 4; t.eq(targetsOf(w).length, 0);
    w.S.empires[1].race = 'silicoid'; w.T.typeIdx = 1; t.eq(targetsOf(w).length, 1, 'Silicoid: radiated is fine');
    w.T.typeIdx = 0; t.eq(targetsOf(w).length, 0, 'no planet at all');
  });
  t.test('targets: only planets with range flag 1 (inside plain fuel range); flag 2 (tank range) and 0 are not eligible', () => {
    const w = scene('tg-range', { fighters: 1 }), E = w.S.empires[1];
    t.eq(E.frange[w.T.starId], 1); t.eq(targetsOf(w).length, 1);
    E.frange[w.T.starId] = 2; t.eq(targetsOf(w).length, 0);
    E.frange[w.T.starId] = 0; t.eq(targetsOf(w).length, 0);
  });
  t.test('targets: Orion is excluded until year 121; afterwards an ordinary candidate (weight = pop + 160)', () => {
    const w = scene('tg-orion', { fighters: 1 }), o = w.S.planets[w.S.orion];
    colony(w.S, o, 2, { typeIdx: 13, special: 'orion', pop: 30 }); w.S.guardian.alive = false; meRange(w.S);
    w.S.year = 120; t.eq(targetsOf(w).some(x => x.planet === o.id), false, 'year 120');
    w.S.year = 121; t.eq(targetsOf(w).some(x => x.planet === o.id), true, 'year 121');
    t.eq(targetsOf(w).find(x => x.planet === o.id).weight, 30 + 160);
  });
  t.test('targets: my own planets never appear; weights follow pop − 10·bases + special bonus; sorted descending, ties by planet index', () => {
    const w = scene('tg-order', { fighters: 1 });
    const a = w.near[0], b = colony(w.S, w.near[1], 2, { pop: 50, special: 'rich' }), c = colony(w.S, w.near[2], 2, { pop: 50, bases: 2, special: 'rich' }), d = colony(w.S, w.near[3], 2, { pop: 30, special: 'normal' });
    colony(w.S, w.near[4], 1, { pop: 40 }); meRange(w.S);                          // my own colony: never a target
    const tg = targetsOf(w);
    t.deep(tg.map(x => [x.planet, x.weight]), [[b.id, 150], [c.id, 130], [a.id, 70], [d.id, 70]].sort((p, q) => q[1] - p[1] || p[0] - q[0]));
    t.eq(tg.some(x => x.planet === w.near[4].id), false);
  });
  t.test('targets: an UNOWNED planet with foreign ships over it counts as owned by the lowest-index such empire (the treaty with THAT empire decides)', () => {
    const w = world('tg-unowned'), q = w.near[0];
    q.typeIdx = 11; q.type = 'ocean'; q.owner = -1; q.special = 'rich'; contact(w.S, 1, 2); contact(w.S, 1, 0);
    ships(w.S, 2, q.starId, DESTROYER, 1);
    t.eq(targetsOf(w).length, 0, 'no war');
    war(w.S, 1, 2); t.eq(targetsOf(w).length, 1);
    t.deep([targetsOf(w)[0].owner, targetsOf(w)[0].real, targetsOf(w)[0].weight], [2, -1, 100], 'effective owner 2, planet unowned, weight = special bonus only');
    ships(w.S, 0, q.starId, DESTROYER, 1);                                          // empire 0 has the lower index: it becomes the effective owner
    t.eq(targetsOf(w).length, 0, 'treaty with empire 0 (none)');
    war(w.S, 1, 0); t.eq(targetsOf(w)[0].owner, 0);
    const w2 = world('tg-unowned2'); w2.near[0].typeIdx = 11; ships(w2.S, 1, w2.near[0].starId, FIGHTER, 3);
    t.eq(targetsOf(w2).length, 0, 'my own ships do not count as another empire');
  });
  t.test('targets: the sort quirk targetSortEarlyStop reproduces the original\'s partially sorted list when enabled', () => {
    const w = scene('tg-bubble', { fighters: 1 });
    const q = [w.near[1], w.near[2], w.near[3]]; q.forEach((p, i) => colony(w.S, p, 2, { pop: [10, 20, 30][i] })); w.T.pop = 0; meRange(w.S);   // list in index order: weights vary
    const normal = targetsOf(w).map(x => x.weight);
    t.deep(normal.slice().sort((a, b) => b - a), normal, 'fixed: fully sorted');
    withQuirk('targetSortEarlyStop', true, () => { const ws = targetsOf(w).map(x => x.weight); t.eq(ws.length, normal.length); t.deep(ws.slice().sort((a, b) => b - a).join(), normal.join()); });
  });

  // =========================================================================================================================================================
  // send_attack
  // =========================================================================================================================================================
  t.test('defender weight D = Σ other empires\' ships × design threat + (weaponTech%·5 + (planetaryShield+10)·10) · missile bases', () => {
    const w = scene('d-formula', { fighters: 1, destroyers: 4, bases: 3 });
    w.foe.research.tl[5] = 20; w.foe.mods.planetShield = 10;
    ships(w.S, 0, w.T.starId, FIGHTER, 5);                                         // a third empire's ships over the same star count too (1 each)
    t.eq(Mil.defenderWeight(mkPlan(w), w.T.starId), 4 * 7 + 5 * 1 + (20 * 5 + (10 + 10) * 10) * 3);
    w.foe.mods.planetShield = 0; w.foe.research.tl[5] = 1;
    t.eq(Mil.defenderWeight(mkPlan(w), w.T.starId), 28 + 5 + (5 + 100) * 3);
    w.T.bases = 0; t.eq(Mil.defenderWeight(mkPlan(w), w.T.starId), 33, 'no bases, no base term');
  });
  t.test('defender weight: my own ships never count; monsters weigh 1800; an unowned target carries no base term', () => {
    const w = scene('d-misc', { fighters: 2, destroyers: 2 });
    ships(w.S, 1, w.T.starId, DESTROYER, 9);                                       // mine, over the target: ignored
    t.eq(Mil.defenderWeight(mkPlan(w), w.T.starId), 14);
    w.S.monsters = [{ id: 1, star: w.T.starId, gone: false, killer: -1 }];
    t.eq(Mil.defenderWeight(mkPlan(w), w.T.starId), 14 + 1800);
    w.S.monsters = [];
    const q = w.near[1]; q.owner = -1; q.bases = 9; ships(w.S, 2, q.starId, DESTROYER, 3);
    t.eq(Mil.defenderWeight(mkPlan(w), q.starId), 21, 'stale base count of an unowned planet is ignored');
  });
  t.test('attack commits the WHOLE stack (every design incl. scouts and colony ships) in one fleetSend, strictly greater force required', () => {
    const w = scene('a-whole', { fighters: 30, destroyers: 3 });                   // D = 21
    ships(w.S, 1, w.P.starId, SCOUT, 2); ships(w.S, 1, w.P.starId, COLONY, 1); ships(w.S, 1, w.P.starId, DESTROYER, 4);
    const ctx = run(w, { R: fakeR([], 1) });
    const sends = ord(ctx, 'fleetSend');
    t.eq(sends.length, 1);
    t.deep(sends[0].counts, F.at(w.S, w.P.starId, 1).ships.slice()); t.ok(sends[0].counts[SCOUT] >= 4 && sends[0].counts[COLONY] >= 2, 'scouts and colony ships went too'); t.eq(sends[0].from, w.P.starId); t.eq(sends[0].to, w.T.starId);
    t.eq(ctx.shared.mil.attacks[0].force, 30 + 4 * 7); t.eq(ctx.shared.mil.attacks[0].defenders, 21);
  });
  t.test('attack boundary: force == D does not attack, force == D + 1 does ("strictly greater")', () => {
    const w = scene('a-bound', { destroyers: 4, bases: 2 });                        // D = 28 + 2·105 = 238
    ships(w.S, 1, w.P.starId, FIGHTER, 238);
    let ctx = run(w, { R: fakeR([], 1) });
    t.eq(ord(ctx, 'fleetSend').length, 0, 'force 238 == D 238');
    t.eq(ctx.shared.mil.used[w.T.id], undefined, 'not even marked used');
    ships(w.S, 1, w.P.starId, FIGHTER, 1);
    ctx = run(w, { R: fakeR([], 1) });
    t.eq(ord(ctx, 'fleetSend').length, 1, 'force 239 > D 238');
    t.eq(ctx.shared.mil.used[w.T.id], true);
  });
  t.test('attack range: the target must be strictly closer than fuel·15 map units from the anchor planet', () => {
    const w = scene('a-range', { fighters: 50 }), d = Geo.unitDist(w.S, w.P.starId, w.T.starId);
    const plan = mkPlan(w);
    plan.range = d; Mil.attack(plan); t.eq(ord(plan.ctx, 'fleetSend').length, 0, 'distance == range');
    plan.range = d + 1; Mil.attack(plan); t.eq(ord(plan.ctx, 'fleetSend').length, 1, 'distance == range − 1');
    w.me.range = 1; t.eq(Mil.newPlan(AI.ctx(w.S, 1, 1)).range, 15, 'range = fuel · 15');
  });
  t.test('the 40 % gate: d100 < 40 passes (39 of 100 rolls); Monte-Carlo over 20 000 turns with two targets; a lone target needs no roll', () => {
    const w = scene('a-gate', { fighters: 50 });
    colony(w.S, w.near[1], 2, { pop: 1 }); meRange(w.S);                           // second target (weaker → listed second) so the list has ≥ 2 entries
    const plan = mkPlan(w), ctx = plan.ctx, sh = ctx.shared;
    t.eq(plan.targets.length, 2);
    const base = sh.orbit[w.P.starId].slice(), front = plan.force[w.P.starId];
    const reset = () => { ctx.orders.length = 0; plan.used = {}; sh.orbit[w.P.starId] = base.slice(); plan.force[w.P.starId] = front; sh.inFlight = 0; sh.galaxyMoving = 0; sh.moving.length = 0; plan.out.attacks.length = 0; };
    ctx.R = M.RNG.create('gate-mc');
    let first = 0, second = 0, none = 0; const N = 20000;
    for (let i = 0; i < N; i++) {
      reset(); Mil.attack(plan);
      const s = ord(ctx, 'fleetSend')[0];
      if (!s) none++; else if (s.to === plan.targets[0].star) first++; else second++;
    }
    t.near(first / N, 0.39, 0.012); t.near(second / N, 0.61 * 0.39, 0.012); t.near(none / N, 0.61 * 0.61, 0.012);
    const only = scene('a-gate1', { fighters: 50 });
    t.eq(ord(run(only, { R: fakeR([100, 100, 100]), fronts: 'P' }), 'fleetSend').length, 1, 'a lone target ignores the roll even when it would fail');
    t.eq(ord(run(scene('a-gate1b', { fighters: 50 }), { R: fakeR([40, 40, 40]), fronts: 'P' }), 'fleetSend').length, 1, 'lone target');
  });
  t.test('the 40 % gate boundary: a roll of 39 passes, 40 fails (d100 < 40) when the list has two entries', () => {
    const w = scene('a-gate-edge', { fighters: 50 }); colony(w.S, w.near[1], 2, { pop: 1 }); meRange(w.S);
    t.eq(ord(run(w, { R: fakeR([39]), fronts: 'P' }), 'fleetSend').length, 1, 'roll 39');
    t.eq(ord(run(w, { R: fakeR([40, 40]), fronts: 'P' }), 'fleetSend').length, 0, 'rolls 40, 40');
    t.eq(ord(run(w, { R: fakeR([40, 39]), fronts: 'P' }), 'fleetSend').length, 1, 'rolls 40, 39 → second target');
  });
  t.test('the walk continues: a target that fails the roll or is too strong is skipped, the next one is attacked; a chosen target ends the walk for that front', () => {
    const w = scene('a-walk', { fighters: 60, destroyers: 20, bases: 1 });          // T: D = 140 + 105 = 245 > 60: too strong
    const T2 = colony(w.S, w.near[1], 2, { pop: 5 }); meRange(w.S);                // weaker planet, nothing there: D = 0
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
    t.deep(ord(ctx, 'fleetSend').map(o => o.to), [T2.starId], 'T skipped (60 ≤ 245), T2 attacked');
    t.eq(ctx.shared.mil.used[w.T.id], undefined); t.eq(ctx.shared.mil.used[T2.id], true);
    const w2 = scene('a-walk2', { fighters: 60 }), T3 = colony(w2.S, w2.near[1], 2, { pop: 5 }); meRange(w2.S);
    const c2 = run(w2, { R: fakeR([99, 1]), fronts: 'P' });
    t.deep(ord(c2, 'fleetSend').map(o => o.to), [T3.starId], 'first roll 99 fails, second 1 passes');
  });
  t.test('targets are marked used per turn: a second front cannot attack the target the first front took', () => {
    const w = scene('a-used', { fighters: 40 });
    const Q = colony(w.S, w.near[1], 2, { pop: 10 }), A2 = colony(w.S, w.near[2], 1, { pop: 10 }); meRange(w.S);
    ships(w.S, 1, A2.starId, FIGHTER, 40);
    const plan = mkPlan(w);
    plan.fronts = [{ anchor: w.P.id, star: w.P.starId, value: 0 }, { anchor: A2.id, star: A2.starId, value: 0 }];
    Mil.attack(plan);
    const dest = ord(plan.ctx, 'fleetSend').map(o => o.to);
    t.eq(dest.length, 2); t.eq(new Set(dest).size, 2, 'two different targets');
    t.eq(dest[0], w.T.starId); t.eq(dest[1], Q.starId);
  });
  t.test('no double use: ships committed by the attack are gone for defend / idle; no star ever sends more than it holds', () => {
    const w = scene('a-nodouble', { fighters: 40, destroyers: 1 });
    colony(w.S, w.near[1], 1, { pop: 3 }); meRange(w.S);                            // an unguarded colony of mine (flat threat 50) next door
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
    const from = {};
    for (const o of ord(ctx, 'fleetSend')) { const a = from[o.from] = from[o.from] || [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6; i++) a[i] += o.counts[i]; }
    for (const s in from) { const f = F.at(w.S, +s, 1); for (let i = 0; i < 6; i++) t.ok(from[s][i] <= (f ? f.ships[i] : 0), 'never more than exists at ' + s); }
    t.eq(ord(ctx, 'fleetSend').filter(o => o.from === w.P.starId).length, 1, 'one dispatch from the capital');
    t.eq(ctx.shared.mil.defends.length, 0, 'the stack that attacked cannot also garrison the colony');
  });
  t.test('unowned target with a foreign fleet over it: the whole stack goes without any treaty branch', () => {
    const w = world('a-unowned'), q = w.near[0];
    q.typeIdx = 11; q.owner = -1; q.special = 'normal';
    contact(w.S, 1, 2); war(w.S, 1, 2); ships(w.S, 2, q.starId, DESTROYER, 2); ships(w.S, 1, w.P.starId, FIGHTER, 40);
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
    t.eq(ord(ctx, 'fleetSend').length, 1); t.eq(ord(ctx, 'diplomacy').length, 0);
  });
  // Monte-Carlo harness for the treaty branches: the attack on a NAP/alliance partner's planet on a need_conquer turn
  function breakMC(treaty, obj, seedName) {
    const w = scene(seedName, { fighters: 80, treaty });
    const plan = mkPlan(w, { shared: { needConquer: true }, obj }), sh = plan.ctx.shared;
    t.eq(plan.targets.length, 1);
    const base = sh.orbit[w.P.starId].slice(), front = plan.force[w.P.starId]; plan.ctx.R = M.RNG.create(seedName);
    let breaks = 0, sent = 0, used = 0, last = null; const N = 20000;
    for (let i = 0; i < N; i++) {
      plan.ctx.orders.length = 0; plan.used = {}; sh.orbit[w.P.starId] = base.slice(); plan.force[w.P.starId] = front; plan.out.breaks.length = 0;
      Mil.attack(plan);
      const d = ord(plan.ctx, 'diplomacy'); breaks += d.length; if (d.length) last = d[0]; sent += ord(plan.ctx, 'fleetSend').length; used += plan.used[w.T.id] ? 1 : 0;
    }
    return { breaks: breaks / N, sent, used: used / N, order: last, N };
  }
  t.test('alliance partner\'s planet on a need_conquer turn: break order with probability 1/4 (5/8 for an Expansionist), never a fleet that turn, target used either way — Monte-Carlo 20 000', () => {
    const a = breakMC(2, 0, 'mc-ally-0'), b = breakMC(2, 2, 'mc-ally-2');
    t.near(a.breaks, 0.25, 0.012); t.eq(a.sent, 0); t.eq(a.used, 1);
    t.near(b.breaks, 0.625, 0.012); t.eq(b.sent, 0); t.eq(b.used, 1);
    t.deep([a.order.t, a.order.act, a.order.to, a.order.expand, a.order.cap], ['diplomacy', 'breakTreaty', 2, true, 30]);
  });
  t.test('NAP partner\'s planet on a need_conquer turn: break order with probability 1/2, always for an Expansionist; the order carries expand:true and the relation cap 20 — Monte-Carlo 20 000', () => {
    const a = breakMC(1, 0, 'mc-nap-0'), b = breakMC(1, 2, 'mc-nap-2');
    t.near(a.breaks, 0.5, 0.012); t.eq(a.sent, 0); t.eq(a.used, 1);
    t.eq(b.breaks, 1); t.eq(b.sent, 0);
    t.deep([a.order.act, a.order.expand, a.order.cap], ['breakTreaty', true, 20]);
  });
  t.test('treaty-break draws: alliance = d4==0 || (d2==0 && Expansionist); NAP = d2==0 || Expansionist (forced sequences)', () => {
    const go = (treaty, obj, seq, dflt) => ord(run(scene('brk-seq' + treaty + obj + seq.join(), { fighters: 80, treaty }), { shared: { needConquer: true }, obj, R: fakeR(seq, dflt), fronts: 'P' }), 'diplomacy').length;
    t.eq(go(2, 0, [0], 9), 1, 'alliance: first draw 0'); t.eq(go(2, 0, [1], 0), 0, 'first draw 1 → fails, then a draw of 0 cannot save a non-Expansionist');
    t.eq(go(2, 2, [1, 0], 9), 1, 'Expansionist: second draw 0'); t.eq(go(2, 2, [1, 1], 9), 0);
    t.eq(go(1, 0, [0], 9), 1, 'NAP: draw 0'); t.eq(go(1, 0, [1], 9), 0, 'NAP: draw 1, not Expansionist'); t.eq(go(1, 2, [1], 9), 1, 'NAP: Expansionist always');
  });
  t.test('the break order is executed by the Diplo engine: treaty NONE afterwards, relation capped at 30, no war in the same call', () => {
    const w = scene('a-brk', { fighters: 80, treaty: 2 });
    Dp.setRel(w.S, 1, 2, 90);
    const ctx = run(w, { shared: { needConquer: true }, obj: 2, R: fakeR([0], 0), fronts: 'P' });
    const o = ord(ctx, 'diplomacy')[0], res = M.Sim.Orders.apply(w.S, 1, o);
    t.eq(res.ok, true); t.eq(Dp.treaty(w.S, 1, 2), 0); t.ok(w.S.empires[1].relations[2].rel1 <= 30);
    t.eq(Dp.atWar(w.S, 1, 2), false, 'no war declared');
  });
  t.test('Classic keeps the second attack pass dead (stacks over enemy planets stay put); with attackPhaseBDead=false they hop to the next target (60 % roll, 3/2·force > hull weights)', () => {
    const w = scene('a-phaseb', {}), Q = colony(w.S, w.near[1], 2, { pop: 20 }); meRange(w.S);
    ships(w.S, 1, w.T.starId, FIGHTER, 30); ships(w.S, 1, w.P.starId, DESTROYER, 100);   // a stack over the enemy planet T and a big navy at home (force_own_sum > 0)
    const fromT = c => ord(c, 'fleetSend').filter(o => o.from === w.T.starId);
    let ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
    t.eq(fromT(ctx).length, 0, 'default: the besieging stack stays');
    withQuirk('attackPhaseBDead', false, () => {
      ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
      const s = fromT(ctx);
      t.eq(s.length, 1); t.eq(s[0].to, Q.starId);
      ctx = run(w, { R: fakeR([60], 60), fronts: 'P' });
      t.eq(fromT(ctx).length, 0, 'a roll of 60 fails (d100 < 60)');
    });
  });
  t.test('quirk attackDesignBound: the original summed other empires\' ships only over the AI\'s OWN design count', () => {
    const w = scene('a-bound2', { fighters: 1 });
    const d = Dz.blank(1); d.name = 'X'; d.engine = 0; d.weapons[0] = { type: K.idx.weapons['laser'], count: 2 }; w.foe.designs[5] = d;
    ships(w.S, 2, w.T.starId, 5, 10); Dz.refresh(w.S, w.foe);
    const dw = () => Mil.defenderWeight(mkPlan(w), w.T.starId), full = dw();
    t.ok(full >= 50, 'ten ships of the sixth design count');
    withQuirk('attackDesignBound', true, () => { t.eq(dw(), 0, 'I own five designs → the foe\'s sixth is ignored'); });
    t.eq(dw(), full);
  });
  t.test('no attack without force at the anchor, without fronts or without war; nothing is ever sent from or to the same star', () => {
    const w = scene('a-none', {});
    t.eq(ord(run(w, { R: fakeR([], 1), fronts: 'P' }), 'fleetSend').length, 0, 'no ships');
    ships(w.S, 1, w.P.starId, FIGHTER, 50);
    t.eq(ord(run(w, { R: fakeR([], 1), shared: { fronts: [] } }), 'fleetSend').filter(o => o.to === w.T.starId).length, 0, 'no fronts');
    war(w.S, 1, 2, 0);
    t.eq(ord(run(w, { R: fakeR([], 1), fronts: 'P' }), 'fleetSend').filter(o => o.to === w.T.starId).length, 0, 'no war, no need_conquer');
    t.ok(ord(run(w, { R: fakeR([], 1), fronts: 'P' }), 'fleetSend').every(o => o.from !== o.to));
  });
  t.test('range flag 2 targets are never attacked', () => {
    const w = scene('a-flag2', { fighters: 40 });
    w.S.empires[1].frange[w.T.starId] = 2;
    t.eq(ord(run(w, { R: fakeR([], 1), fronts: 'P' }), 'fleetSend').filter(o => o.to === w.T.starId).length, 0, 'flag 2 is not within_frange == 1');
  });
  t.test('the 208-fleet table limit stops all dispatches', () => {
    const w = scene('a-208', { fighters: 40 });
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P', pre: null, shared: { galaxyMoving: 208 } });
    t.eq(ord(ctx, 'fleetSend').length, 0);
  });

  // =========================================================================================================================================================
  // send_defend
  // =========================================================================================================================================================
  const defScene = (seed, o) => {
    o = o || {};
    const w = world(seed);
    const A = colony(w.S, w.near[0], 1, { pop: 10, bases: o.basesA || 0 }), B = colony(w.S, w.near[1], 1, { pop: 10, bases: o.basesB || 0 });
    meRange(w.S);
    return Object.assign(w, { A, B, first: Math.min(A.id, B.id) });
  };
  t.test('defend: every colony with < 5 bases and no ship over it has a flat threat of 50 and is on the defend list; the stack goes to the FIRST list planet, not the nearest', () => {
    const w = defScene('d-flat');
    ships(w.S, 1, w.P.starId, FIGHTER, 100);
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' }), d = ctx.shared.mil.defends;
    t.eq(d.length, 1); t.eq(d[0].threat, 50); t.eq(d[0].to, w.first, 'lowest planet index among the list planets');
    t.eq(ord(ctx, 'fleetSend')[0].counts[FIGHTER], 100);
  });
  t.test('defend: 5 or more missile bases, or any ship over the planet, lift the flat threat; 4 bases do not', () => {
    const w = defScene('d-lift', { basesA: 5 });
    ships(w.S, 1, w.P.starId, FIGHTER, 100); ships(w.S, 1, w.B.starId, FIGHTER, 1);
    t.eq(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.length, 0, 'A has 5 bases, B has a ship');
    const w2 = defScene('d-lift2', { basesA: 4 }); ships(w2.S, 1, w2.P.starId, FIGHTER, 100);
    t.eq(run(w2, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends[0].to, w2.first, '4 bases is not enough');
  });
  t.test('defend sends only if threat·5/3 < force: with threat 50 the stack needs force ≥ 84 (83.33)', () => {
    for (const [n, expect] of [[83, 0], [84, 1]]) {
      const w = defScene('d-5-3-' + n); ships(w.S, 1, w.P.starId, FIGHTER, n);
      t.eq(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.length, expect, 'force ' + n);
    }
  });
  t.test('defend: a planet is "defended" while force·4/3 ≥ threat; a guarded planet with a small inbound fleet is not on the list', () => {
    const w = defScene('d-4-3', { basesA: 6, basesB: 5 });
    moving(w.S, 2, w.near[5].starId, w.A.starId, DESTROYER, 3);                     // threat 15 on A
    ships(w.S, 1, w.A.starId, FIGHTER, 11);                                         // force 11 → 11·4/3 = 14 < 15 → on the list
    ships(w.S, 1, w.P.starId, FIGHTER, 100);
    contact(w.S, 1, 2);
    t.deep(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.map(x => x.to), [w.A.starId]);
    const w2 = defScene('d-4-3b', { basesA: 6, basesB: 5 }); moving(w2.S, 2, w2.near[5].starId, w2.A.starId, DESTROYER, 3); ships(w2.S, 1, w2.A.starId, FIGHTER, 12); ships(w2.S, 1, w2.P.starId, FIGHTER, 100); contact(w2.S, 1, 2);
    t.eq(run(w2, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.length, 0, 'force 12 → 16 ≥ 15: defended');
  });
  t.test('defend: en-route hostile fleets add Σ ships × hull weight and hostile transports pop × 5 to a planet that has ≥ 5 bases or a ship; the flat 50 overwrites for the unguarded', () => {
    const w = defScene('d-inc', { basesA: 6, basesB: 5 });
    moving(w.S, 2, w.near[5].starId, w.A.starId, DESTROYER, 4);                     // 4 Medium hulls = 20
    w.S.trans.push({ id: 900, owner: 2, from: w.near[5].starId, to: w.A.starId, n: 7, x: 0, y: 0, speed: 1 });   // 7·5 = 35
    ships(w.S, 1, w.P.starId, FIGHTER, 200); contact(w.S, 1, 2);
    const dA = run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.find(x => x.to === w.A.starId);
    t.ok(dA, 'A is threatened'); t.eq(dA.threat, 20 + 35);
    const w2 = defScene('d-inc2'); moving(w2.S, 2, w2.near[5].starId, w2.B.starId, DESTROYER, 9); ships(w2.S, 1, w2.P.starId, FIGHTER, 200);
    t.ok(run(w2, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.every(x => x.threat === 50), 'the unguarded planet\'s threat is the flat 50, whatever is inbound');
    const w3 = defScene('d-inc3', { basesA: 6, basesB: 5 }), big = Dz.blank(3); big.name = 'H'; big.engine = 0; w3.foe.designs[5] = big; Dz.refresh(w3.S, w3.foe);
    moving(w3.S, 2, w3.near[5].starId, w3.A.starId, 5, 2); ships(w3.S, 1, w3.P.starId, FIGHTER, 500);
    t.eq(run(w3, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.find(x => x.to === w3.A.starId).threat, 250, 'two Huge hulls (125 each)');
    const w4 = defScene('d-inc4', { basesA: 6, basesB: 5 }), lg = Dz.blank(2); lg.name = 'L'; lg.engine = 0; w4.foe.designs[5] = lg; Dz.refresh(w4.S, w4.foe);
    moving(w4.S, 2, w4.near[5].starId, w4.A.starId, 5, 3); ships(w4.S, 1, w4.P.starId, FIGHTER, 500);
    t.eq(run(w4, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.find(x => x.to === w4.A.starId).threat, 75, 'three Large hulls (25 each)');
  });
  t.test('defend: allied fleets are ignored by default and counted with the Classic quirk threatCountsAllies', () => {
    const mk = () => { const w = defScene('d-ally', { basesA: 6, basesB: 5 }); moving(w.S, 2, w.near[5].starId, w.A.starId, DESTROYER, 4); ships(w.S, 1, w.P.starId, FIGHTER, 200); war(w.S, 1, 2, 2); return w; };
    let w = mk(); t.eq(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.some(x => x.to === w.A.starId), false);
    withQuirk('threatCountsAllies', true, () => { w = mk(); t.eq(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.some(x => x.to === w.A.starId), true); });
  });
  t.test('defend: a star with a threat of its own never sends; after one send the planet\'s threat is huge so no second stack goes there', () => {
    const w = defScene('d-once'), C2 = colony(w.S, w.near[2], 1, { pop: 10 }); meRange(w.S);
    ships(w.S, 1, w.P.starId, FIGHTER, 200); ships(w.S, 1, C2.starId, FIGHTER, 200);
    moving(w.S, 2, w.near[6].starId, w.P.starId, DESTROYER, 3); contact(w.S, 1, 2);   // the capital: threat 15 but guarded → not on the list; it HAS a threat → cannot send
    const d = run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends;
    t.ok(d.every(x => x.from !== w.P.starId), 'the threatened capital keeps its fleet');
    t.eq(d.length, 1, 'one send only: the first list planet is taken, the second sender is stuck on it'); t.eq(d[0].from, C2.starId); t.eq(d[0].to, w.first);
  });
  t.test('defend reach: 30·S+20 map units from the sender (S = 3 at the start → 110), strict', () => {
    const w = defScene('d-reach'); ships(w.S, 1, w.P.starId, FIGHTER, 300);
    const plan = mkPlan(w); t.eq(plan.bs, 3);
    const dist = Geo.unitDist(w.S, w.P.starId, w.S.planets[w.first].starId);
    plan.bs = 0; Mil.defend(plan); t.eq(plan.out.defends.length, dist < 20 ? 1 : 0, 'reach 20');
    const p2 = mkPlan(w); p2.bs = (dist - 20) / 30; if (Number.isInteger(p2.bs)) { Mil.defend(p2); t.eq(p2.out.defends.length, 0, 'reach == distance'); }
    const p3 = mkPlan(w); p3.bs = Math.ceil((dist - 19) / 30); Mil.defend(p3); t.eq(p3.out.defends.length, 1, 'reach > distance');
  });
  t.test('defend takes the first list planet in range and does NOT try the next one when the 5/3 test fails', () => {
    const w = defScene('d-first', { basesA: 6 });
    const big = Dz.blank(3); big.name = 'H'; big.engine = 0; w.foe.designs[5] = big; Dz.refresh(w.S, w.foe);
    // make A the first list planet (swap ids is impossible → give B the lower threat but keep A first by giving B 5 bases when A.id < B.id)
    const firstIsA = w.A.id < w.B.id;
    if (!firstIsA) { w.B.bases = 6; w.A.bases = 0; }
    const hot = firstIsA ? w.A : w.B;
    moving(w.S, 2, w.near[6].starId, hot.starId, 5, 10); contact(w.S, 1, 2);        // threat 1250 on the first list planet
    ships(w.S, 1, w.P.starId, FIGHTER, 150);                                         // 150 < 1250·5/3; the second planet (flat 50) would have been fine
    t.eq(run(w, { R: fakeR([], 1), fronts: 'P' }).shared.mil.defends.length, 0, 'the sender is stuck on the first planet in range');
  });

  // =========================================================================================================================================================
  // send_idle
  // =========================================================================================================================================================
  t.test('idle: only with fewer than 8 fleets in flight (counted including the fleets already sent this plan)', () => {
    for (const [n, expect] of [[7, true], [8, false]]) {
      const w = world('i-gate' + n); contact(w.S, 1, 2);
      const q = colony(w.S, w.near[0], 1, { pop: 10 }); meRange(w.S);
      ships(w.S, 1, q.starId, FIGHTER, 5);
      for (let i = 0; i < n; i++) moving(w.S, 1, w.near[3].starId, w.near[4 + (i % 4)].starId, SCOUT, 1);
      const plan = mkPlan(w); t.eq(plan.sh.inFlight, n);
      Mil.idle(plan); t.eq(plan.out.idles.length > 0, expect, n + ' in flight');
    }
    // fleets sent earlier in the same plan count: 7 in flight + one send = 8 → idle is skipped
    const w = scene('i-gate-plan', { fighters: 50 }), q = colony(w.S, w.near[1], 1, { pop: 10 }); meRange(w.S);
    ships(w.S, 1, q.starId, FIGHTER, 5);
    for (let i = 0; i < 7; i++) moving(w.S, 1, w.near[3].starId, w.near[4 + (i % 4)].starId, SCOUT, 1);
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' });
    t.eq(ord(ctx, 'fleetSend').length, 1, 'the attack went out'); t.eq(ctx.shared.mil.idles.length, 0, 'now 8 in flight → no idle moves');
  });
  t.test('idle: fleets at a front anchor stay; stacks with force < force_own_sum stay; the sum is Σ force/25 and halves after an election and again in the final war', () => {
    const w = world('i-thr'); contact(w.S, 1, 2);
    const q = colony(w.S, w.near[0], 1, { pop: 10 }), r = colony(w.S, w.near[1], 1, { pop: 10 }); meRange(w.S);
    ships(w.S, 1, q.starId, FIGHTER, 20); ships(w.S, 1, r.starId, FIGHTER, 80); ships(w.S, 1, w.P.starId, FIGHTER, 100);     // Σ = 200 → 8
    let plan = mkPlan(w); t.eq(plan.forceSum, 200); t.eq(plan.forceOwnSum, 8);
    Mil.idle(plan);
    t.deep(plan.out.idles.map(x => x.from).sort((a, b) => a - b), [q.starId, r.starId].sort((a, b) => a - b));
    t.eq(ord(plan.ctx, 'fleetSend').some(o => o.from === w.P.starId), false, 'the anchor stack is left alone');
    w.S.council.held = true; plan = mkPlan(w); t.deep([plan.forceSum, plan.forceOwnSum], [400, 8], 'AI threats double, the threshold halves');
    w.S.council.finalWar = { refusers: [0], winner: 2, year: 5 }; plan = mkPlan(w); t.deep([plan.forceSum, plan.forceOwnSum], [800, 8], 'threats ×4, threshold ÷4');
    delete w.S.council.finalWar; w.S.council.held = false;
    ships(w.S, 1, r.starId, FIGHTER, 1000);                                           // Σ = 1200 → 48: the 20-stack is below it
    plan = mkPlan(w); t.eq(plan.forceOwnSum, 48); Mil.idle(plan);
    t.eq(plan.out.idles.some(x => x.from === q.starId), false, 'force 20 < 48 stays where it is'); t.eq(plan.out.idles.some(x => x.from === r.starId), true);
  });
  t.test('idle picks the front minimising dist·10/(20·S+20) + front value (first minimum on ties) and sends the whole stack there', () => {
    const w = world('i-pick');
    const q = colony(w.S, w.near[0], 1, { pop: 10 }), r = colony(w.S, w.near[3], 1, { pop: 10 }), s = colony(w.S, w.near[6], 1, { pop: 10 }); meRange(w.S);
    ships(w.S, 1, s.starId, FIGHTER, 9); ships(w.S, 1, s.starId, SCOUT, 2);
    const plan = mkPlan(w), div = plan.bs * 20 + 20;
    plan.fronts = [{ anchor: q.id, star: q.starId, value: 5 }, { anchor: r.id, star: r.starId, value: 0 }]; plan.forceOwnSum = 0;
    Mil.idle(plan);
    const v0 = Math.floor(Geo.unitDist(w.S, s.starId, q.starId) * 10 / div) + 5, v1 = Math.floor(Geo.unitDist(w.S, s.starId, r.starId) * 10 / div);
    const mine = plan.out.idles.filter(x => x.from === s.starId); t.eq(mine.length, 1); t.eq(mine[0].front, v1 < v0 ? 1 : 0);
    const p2 = mkPlan(w); p2.fronts = [{ anchor: q.id, star: q.starId, value: -500 }, { anchor: r.id, star: r.starId, value: 0 }]; p2.forceOwnSum = 0; Mil.idle(p2);
    t.eq(p2.out.idles.find(x => x.from === s.starId).front, 0, 'a hated neighbour (very negative value) attracts');
    t.deep(ord(p2.ctx, 'fleetSend').find(o => o.from === s.starId).counts, [2, 9, 0, 0, 0, 0], 'the whole stack, scouts too');
    const p3 = mkPlan(w); p3.fronts = [{ anchor: q.id, star: q.starId, value: 0 }, { anchor: q.id, star: q.starId, value: 0 }]; p3.forceOwnSum = 0; Mil.idle(p3); t.eq(p3.out.idles.find(x => x.from === s.starId).front, 0, 'ties go to the first front');
  });
  t.test('idle moves nothing when there is no front, or when the front is out of range (flag 0)', () => {
    const w = world('i-none'); const q = colony(w.S, w.near[0], 1, { pop: 10 }); meRange(w.S); ships(w.S, 1, q.starId, FIGHTER, 9);
    const plan = mkPlan(w); plan.fronts = []; Mil.idle(plan); t.eq(plan.out.idles.length, 0);
    const p2 = mkPlan(w); p2.forceOwnSum = 0; p2.fronts = [{ anchor: w.P.id, star: w.P.starId, value: 0 }]; w.S.empires[1].frange[w.P.starId] = 0; Mil.idle(p2); t.eq(p2.out.idles.length, 0);
  });

  // =========================================================================================================================================================
  // trans_en
  // =========================================================================================================================================================
  const transScene = (seed, o) => {
    o = o || {};
    const w = scene(seed, { pop: o.targetPop === undefined ? 40 : o.targetPop, bases: 0 });
    w.P.pop = o.pop === undefined ? 60 : o.pop; w.P.mp3 = w.P.maxPop = 100; w.P.unrest = 0;
    ships(w.S, 1, w.T.starId, FIGHTER, 1);                                            // my ship already orbits the enemy planet
    M.Sim.Vis.explore(w.S, w.me, w.T.starId);
    ships(w.S, 1, w.P.starId, DESTROYER, 10);                                         // a real navy at home: force_own_sum > 0, so the stack over the enemy planet is left alone
    return w;
  };
  const trans = w => ord(run(w, { R: fakeR([], 1), fronts: 'P' }), 'trans');
  t.test('invasion transports: a source with pop ≥ max/2 AND pop > 20 sends exactly pop/2 (integer) to an enemy planet where I already have a ship; the sim accepts the order', () => {
    const w = transScene('t-basic', { pop: 61 }), tr = trans(w);
    t.eq(tr.length, 1); t.deep([tr[0].planet, tr[0].to, tr[0].n], [w.P.id, w.T.starId, 30]);
    t.eq(M.Sim.Orders.apply(w.S, 1, tr[0]).ok, true);
    t.deep([w.P.trans.to, w.P.trans.n], [w.T.starId, 30]);
  });
  t.test('invasion transports: pop exactly max/2 qualifies, one below does not; pop must exceed 20 even for a small planet (pop 20 no, 21 yes)', () => {
    const base = (pop, mp3) => { const w = transScene('t-edge' + pop + '-' + mp3, { pop }); w.P.mp3 = mp3; return trans(w).length; };
    t.eq(base(50, 100), 1, 'pop == max/2'); t.eq(base(49, 100), 0, 'pop < max/2');
    t.eq(base(21, 40), 1, 'pop 21 of 40'); t.eq(base(20, 40), 0, 'pop 20 is not > 20');
    t.eq(base(21, 43), 1, 'floor(43/2) = 21'); t.eq(base(21, 44), 0, 'max/2 = 22 > 21');
  });
  t.test('invasion transports need my ship in orbit at the enemy planet; none there (or the stack already left in this plan) → no transport', () => {
    const w = transScene('t-orbit');
    w.S.fleets = w.S.fleets.filter(f => !(f.owner === 1 && f.star === w.T.starId));
    t.eq(trans(w).length, 0);
    const w2 = transScene('t-orbit2'), plan = mkPlan(w2); plan.sh.orbit[w2.T.starId] = [0, 0, 0, 0, 0, 0]; Mil.invade(plan);
    t.eq(ord(plan.ctx, 'trans').length, 0);
  });
  t.test('invasion transports skip allied owners, a human holding a ceasefire, types below my threshold and targets with a transport of mine on the way; no war needed (NAP or no treaty is fine)', () => {
    let w = transScene('t-ally'); war(w.S, 1, 2, 2); t.eq(trans(w).length, 0, 'allied');
    w = transScene('t-nowar'); war(w.S, 1, 2, 0); t.eq(trans(w).length, 1, 'no treaty at all: still invaded (no war requirement)');
    w = transScene('t-nap'); war(w.S, 1, 2, 1); t.eq(trans(w).length, 1, 'NAP partner too');
    w = transScene('t-cf'); w.foe.human = true; w.foe.relations[1].ceasefire = 5; w.me.relations[2].ceasefire = 5;
    t.eq(trans(w).length, 0, 'ceasefire with a human');
    w.foe.relations[1].ceasefire = 0; w.me.relations[2].ceasefire = 0; t.eq(trans(w).length, 1, 'ceasefire over');
    w = transScene('t-type'); w.T.typeIdx = 5; t.eq(trans(w).length, 0, 'tundra < minimal');
    w = transScene('t-dup'); w.S.trans.push({ id: 700, owner: 1, from: w.P.starId, to: w.T.starId, n: 5, x: 0, y: 0, speed: 1 }); t.eq(trans(w).length, 0, 'already targeted');
    w = transScene('t-dup2'); w.S.trans.push({ id: 701, owner: 2, from: w.P.starId, to: w.T.starId, n: 5, x: 0, y: 0, speed: 1 }); t.eq(trans(w).length, 1, 'a foreign transport does not block');
  });
  t.test('invasion transports: every target takes the NEAREST unused source; a source sends once per turn; a source beyond 30·S+30 units does not send', () => {
    const w = transScene('t-near', { pop: 10 });
    const S2 = colony(w.S, w.near[1], 1, { pop: 60, maxPop: 100 }), S3 = colony(w.S, w.near[2], 1, { pop: 80, maxPop: 100 });
    meRange(w.S);
    const T2 = colony(w.S, w.near[3], 2, { pop: 20 }); ships(w.S, 1, T2.starId, FIGHTER, 1); M.Sim.Vis.explore(w.S, w.me, T2.starId);
    const tr = trans(w);
    t.eq(tr.length, 2, 'two targets, two sources'); t.eq(new Set(tr.map(o => o.planet)).size, 2, 'a source is spent after one dispatch');
    t.deep(tr.map(o => o.planet).sort((a, b) => a - b), [S2.id, S3.id].sort((a, b) => a - b), 'the weak capital (pop 10) is no source');
    const first = tr.find(o => o.to === (Math.min(w.T.id, T2.id) === w.T.id ? w.T.starId : T2.starId)), dA = Geo.unitDist(w.S, S2.starId, first.to), dB = Geo.unitDist(w.S, S3.starId, first.to);
    t.eq(first.planet, dA <= dB ? S2.id : S3.id, 'the first target (lowest planet index) gets its nearest source');
    const w2 = transScene('t-reach'), p2 = mkPlan(w2); p2.bs = 0; Mil.invade(p2);
    t.eq(ord(p2.ctx, 'trans').length, Geo.unitDist(w2.S, w2.P.starId, w2.T.starId) < 30 ? 1 : 0, 'reach 30 units');
  });
  t.test('invasion transports: quirk transNoWarRequired=false demands war / need_conquer / game ended for the owner of the target', () => {
    const w = transScene('t-nowar2'); war(w.S, 1, 2, 0);
    withQuirk('transNoWarRequired', false, () => { t.eq(trans(w).length, 0, 'peace: no transports'); war(w.S, 1, 2, 3); t.eq(trans(w).length, 1, 'war'); war(w.S, 1, 2, 0); const ctx = run(w, { R: fakeR([], 1), fronts: 'P', shared: { needConquer: true } }); t.eq(ord(ctx, 'trans').length, 1, 'need_conquer'); });
  });
  t.test('invasion transports: planets in rebellion do not launch (fixed); the Classic quirk transFromRebellion lets them', () => {
    const w = transScene('t-reb'); w.P.unrest = 2;
    t.eq(trans(w).length, 0);
    withQuirk('transFromRebellion', true, () => { t.eq(trans(w).length, 1); });
  });

  // =========================================================================================================================================================
  // spies and security
  // =========================================================================================================================================================
  const spyScene = (seed, o) => {
    o = o || {};
    const w = world(seed, { difficulty: o.difficulty }); w.S.year = o.year === undefined ? 40 : o.year; w.S.turn = w.S.year - 1;
    contact(w.S, 1, 2); contact(w.S, 1, 0);
    return w;
  };
  const runSpy = (S, eid, R) => { const ctx = AI.ctx(S, eid, 3); if (R) ctx.R = R; step('spy').fn(ctx); return ctx; };
  t.test('spy planner is silent until the year is > 30 (T > 30)', () => {
    for (const y of [1, 20, 30]) { const w = spyScene('s-year' + y, { year: y, difficulty: 'impossible' }); t.eq(runSpy(w.S, 1).orders.length, 0, 'year ' + y); }
    const w = spyScene('s-year31', { year: 31, difficulty: 'impossible' }); t.ok(ord(runSpy(w.S, 1, fakeR([], 1)), 'security').length > 0, 'year 31 sets the security slider');
  });
  t.test('security = 8·difficulty per mille (0, 8, 16, 24, 32) when nobody has spies on me; capped at 100', () => {
    ['simple', 'easy', 'average', 'hard', 'impossible'].forEach((d, i) => {
      const w = spyScene('s-sec' + d, { difficulty: d }), ctx = runSpy(w.S, 1, fakeR([], 1));
      t.eq(ctx.shared.spy.security, 8 * i, d);
      const o = ord(ctx, 'security'); t.eq(o.length, i === 0 ? 0 : 1); if (o.length) t.eq(o[0].value, 8 * i);
    });
    t.eq(AI.Spy.security(4, 500, 1), 100); t.eq(AI.Spy.security(2, 7, 1), 16 + 7); t.eq(AI.Spy.security(2, 7, 0), 16); t.eq(AI.Spy.security(2, 0, 1), 16, 'no spies → the coin flip is irrelevant');
  });
  t.test('security: with enemy spies on me a coin flip multiplies their number — only contacted empires count; the coin is drawn only when spies exist', () => {
    const w = spyScene('s-sec2'); w.S.empires[2].spies[1] = 5; w.S.empires[0].spies[1] = 3;
    t.eq(runSpy(w.S, 1, fakeR([1], 1)).shared.spy.security, 16 + 8, 'coin 1 → both empires\' spies');
    t.eq(runSpy(w.S, 1, fakeR([0], 1)).shared.spy.security, 16, 'coin 0');
    w.S.empires[0].relations[1].contact = false; w.S.empires[1].relations[0].contact = false;      // empire 0 is out of contact: its spies are not counted
    t.eq(runSpy(w.S, 1, fakeR([1], 1)).shared.spy.security, 16 + 5);
    const w2 = spyScene('s-sec3'), r = fakeR([], 1); runSpy(w2.S, 1, r);
    const w3 = spyScene('s-sec4'); w3.S.empires[2].spies[1] = 200; t.eq(runSpy(w3.S, 1, fakeR([1], 1)).shared.spy.security, 100, 'capped at 100');
  });
  t.test('spy modes: at war → Sabotage (no dice); relation ≥ 0 never Espionage; otherwise Espionage iff d200 > 200 + 2·relation1 (draw order: coin, d200, activation, budget)', () => {
    const w = spyScene('s-modes'); war(w.S, 1, 2); Dp.setRel(w.S, 1, 0, -50);
    let ctx = runSpy(w.S, 1, fakeR([1, 150, 0, 1, 0, 1], 0));
    t.eq(ctx.shared.spy.planned[2], 2, 'at war with empire 2 → sabotage'); t.eq(ctx.shared.spy.planned[0], 1, 'espionage vs the disliked empire (150 > 100)');
    t.deep(ctx.shared.spy.applied.map(a => [a.target, a.mode, a.budget]), [[0, 1, 6], [2, 2, 6]], 'both activated (1-in-3 draws were 0), budget draw 1 → 6');
    ctx = runSpy(w.S, 1, fakeR([1, 100], 0)); t.eq(ctx.shared.spy.planned[0], 0, 'd200 == 200 + 2·rel is not greater');
    ctx = runSpy(w.S, 1, fakeR([1, 101], 0)); t.eq(ctx.shared.spy.planned[0], 1, '101 > 100');
    Dp.setRel(w.S, 1, 0, 0); ctx = runSpy(w.S, 1, fakeR([], 200)); t.eq(ctx.shared.spy.planned[0], 0, 'relation 0: d200 never exceeds 200');
    Dp.setRel(w.S, 1, 0, 40); ctx = runSpy(w.S, 1, fakeR([], 200)); t.eq(ctx.shared.spy.planned[0], 0, 'friendly: never spied on');
  });
  t.test('espionage probability: −relation1/100 on a coin flip (50 %) → −rel/200; Darlok always rolls → −rel/100 — Monte-Carlo 20 000', () => {
    for (const [race, mult] of [['meklar', 0.5], ['darlok', 1]]) {
      const w = spyScene('s-esp' + race); w.me.race = race; Dp.setRel(w.S, 1, 0, -60);
      const ctx = AI.ctx(w.S, 1, 3); ctx.R = M.RNG.create('esp-' + race);
      let esp = 0; const N = 20000;
      for (let i = 0; i < N; i++) { ctx.orders.length = 0; step('spy').fn(ctx); if (ctx.shared.spy.planned[0] === 1) esp++; }
      t.near(esp / N, 0.6 * mult, 0.012, race);
    }
  });
  t.test('activation: a human target is always funded, an AI target only one turn in three; budget = d5 + 5 per mille (6..10, uniform) — Monte-Carlo 20 000', () => {
    const w = spyScene('s-act'); Dp.setRel(w.S, 1, 0, -100); Dp.setRel(w.S, 1, 2, -100); w.me.race = 'darlok'; w.S.empires[0].human = true;
    const ctx = AI.ctx(w.S, 1, 3); ctx.R = M.RNG.create('act');
    const N = 20000; let on0 = 0, on2 = 0; const bud = new Array(11).fill(0);
    for (let i = 0; i < N; i++) {
      ctx.orders.length = 0; step('spy').fn(ctx);
      for (const a of ctx.shared.spy.applied) { if (a.target === 0 && a.mode) { on0++; bud[a.budget]++; } if (a.target === 2 && a.mode) { on2++; bud[a.budget]++; } }
    }
    t.eq(on0, N, 'human: always (Darlok, relation −100 → espionage every time)'); t.near(on2 / N, 1 / 3, 0.012, 'AI: 1 in 3');
    for (let b = 0; b < 6; b++) t.eq(bud[b], 0, 'budget ' + b + ' never');
    const tot = bud.reduce((a, b) => a + b, 0);
    for (let b = 6; b <= 10; b++) t.near(bud[b] / tot, 0.2, 0.015, 'budget ' + b);
  });
  t.test('spy orders: spyMode / spyBudget only where something changes; a target out of contact is cleared; the Spy engine accepts every order', () => {
    const w = spyScene('s-orders'); Dp.setRel(w.S, 1, 0, -100); Dp.setRel(w.S, 1, 2, -100); w.me.race = 'darlok'; w.S.empires[0].human = true;
    const ctx = runSpy(w.S, 1, fakeR([], 1));
    t.ok(ord(ctx, 'spyMode').length >= 1 && ord(ctx, 'spyBudget').length >= 1);
    for (const o of ctx.orders) { const r = M.Sim.Orders.apply(w.S, 1, o); t.eq(r.ok, true, JSON.stringify(o) + ' → ' + (r.msg || '')); }
    t.eq(w.me.spyMode[0], 1); t.ok(w.me.spyBudget[0] >= 1);
    t.eq(ord(runSpy(w.S, 1, fakeR([], 1)), 'spyMode').filter(o => o.target === 0).length, 0, 'unchanged → no order');
    w.me.spyMode[2] = 1; w.me.spyBudget[2] = 9; w.S.empires[2].relations[1].contact = false; w.S.empires[1].relations[2].contact = false;
    const c3 = runSpy(w.S, 1, fakeR([], 1));
    t.deep(ord(c3, 'spyMode').filter(o => o.target === 2).map(o => o.mode), [0]); t.deep(ord(c3, 'spyBudget').filter(o => o.target === 2).map(o => o.value), [0]);
    for (const o of c3.orders) t.eq(M.Sim.Orders.apply(w.S, 1, o).ok, true);
    t.deep([w.me.spyMode[2], w.me.spyBudget[2]], [0, 0]);
  });
  t.test('a human holding a ceasefire is never spied on (fixed index); the Classic quirk spyCeasefireIndex lets the spies work anyway', () => {
    const w = spyScene('s-cf'); Dp.setRel(w.S, 1, 0, -100); w.me.race = 'darlok'; w.S.empires[0].human = true;
    w.S.empires[0].relations[1].ceasefire = 6; w.S.empires[1].relations[0].ceasefire = 6;
    t.eq(runSpy(w.S, 1, fakeR([], 1)).shared.spy.planned[0], 0, 'hides');
    withQuirk('spyCeasefireIndex', true, () => { t.eq(runSpy(w.S, 1, fakeR([], 1)).shared.spy.planned[0], 1, 'v1.3 bug: ceasefire[e][e] is always 0'); });
    w.S.empires[0].relations[1].ceasefire = 0; w.S.empires[1].relations[0].ceasefire = 0;
    t.eq(runSpy(w.S, 1, fakeR([], 1)).shared.spy.planned[0], 1, 'ceasefire over');
  });
  t.test('war → Sabotage; an ally with high relation is left alone; personality and objective play no part', () => {
    const w = spyScene('s-war'); war(w.S, 1, 2, 3); war(w.S, 1, 0, 2); Dp.setRel(w.S, 1, 0, 100);
    for (const per of [0, 3, 5]) for (const obj of [0, 1, 2, 5]) {
      w.me.personality = per; w.me.objective = obj;
      const ctx = runSpy(w.S, 1, fakeR([], 1)); t.eq(ctx.shared.spy.planned[2], 2); t.eq(ctx.shared.spy.planned[0], 0);
    }
  });

  // =========================================================================================================================================================
  // whole plans: determinism, purity, orders applied for real, performance
  // =========================================================================================================================================================
  t.test('determinism: the same snapshot and seed give identical orders; different seeds change the dice (war scene with many gates)', () => {
    const w = scene('det', { fighters: 200, destroyers: 2 });
    for (let i = 3; i < 8; i++) colony(w.S, w.near[i], 2, { pop: 10 + i });
    meRange(w.S); refresh(w.S);
    t.eq(JSON.stringify(AI.plan(w.S, 1, 11)), JSON.stringify(AI.plan(w.S, 1, 11)));
    const seen = new Set(); for (let s = 0; s < 12; s++) seen.add(JSON.stringify(AI.plan(w.S, 1, 100 + s)));
    t.ok(seen.size > 1, 'the 40 % roll makes plans vary with the seed');
  });
  t.test('purity: military, intel and spy never mutate the snapshot (JSON hash before == after, step by step) in a war scene and in a mid-game', () => {
    const w = scene('pure', { fighters: 100, destroyers: 2, bases: 1 });
    ships(w.S, 1, w.T.starId, FIGHTER, 2); w.P.pop = 60; w.S.year = 50; refresh(w.S);
    const guard = S => { const h0 = JSON.stringify(S); for (let e = 0; e < S.empires.length; e++) { const ctx = AI.ctx(S, e, 5); for (const nm of ['intel', 'military', 'spy']) { step(nm).fn(ctx); if (JSON.stringify(S) !== h0) throw new Error(nm + ' mutated the snapshot (empire ' + e + ')'); } } };
    guard(w.S);
    const S = game('pure2', { size: 'small' }); for (let i = 0; i < 40; i++) M.Sim.autoTurn(S);
    refresh(S); guard(S);
  });
  t.test('purity of the whole plan: AI.plan leaves the snapshot untouched (reports the first step that mutates)', () => {
    const S = game('pure3', { size: 'small' }); for (let i = 0; i < 45; i++) M.Sim.autoTurn(S);
    refresh(S);
    for (const E of S.empires) {
      const ctx = AI.ctx(S, E.id, 9), h0 = JSON.stringify(S);
      for (const st of AI.steps) { try { st.fn(ctx); } catch (e) { /* planner errors are another test's business */ } if (JSON.stringify(S) !== h0) throw new Error('step "' + st.name + '" mutated the snapshot (empire ' + E.id + ')'); }
    }
  });
  t.test('orders of a war plan apply cleanly through Orders.apply: fleetSend and trans are accepted and the whole stack leaves', () => {
    const w = scene('apply', { fighters: 200, destroyers: 2 });
    ships(w.S, 1, w.T.starId, FIGHTER, 1); w.P.pop = 60; w.P.mp3 = 100; M.Sim.Vis.explore(w.S, w.me, w.T.starId);
    const ctx = run(w, { R: fakeR([], 1), fronts: 'P' }), kinds = {};
    for (const o of ctx.orders) { const r = M.Sim.Orders.apply(w.S, 1, o); kinds[o.t] = (kinds[o.t] || 0) + 1; t.eq(r.ok, true, o.t + ' ' + JSON.stringify(o) + ' ' + (r.msg || '')); }
    t.ok(kinds.fleetSend >= 1 && kinds.trans === 1, JSON.stringify(kinds));
    const f = F.at(w.S, w.P.starId, 1); t.ok(!f || f.ships.reduce((a, b) => a + b, 0) === 0, 'the whole stack left');
    t.eq(w.S.fleets.some(g => g.owner === 1 && g.star < 0 && g.to === w.T.starId), true);
  });
  t.test('end to end: a forced war runs through the real engines (move, battle, bombard, transports) without a planner exception', () => {
    const w = scene('e2e', {});
    ships(w.S, 1, w.P.starId, DESTROYER, 80); w.P.pop = 70; w.P.mp3 = 100; w.T.pop = 20; w.T.bases = 0;
    let errors = 0; const origPlan = AI.plan;
    AI.plan = function (S, e, s) { const ctx = AI.ctx(S, e, s); for (const st of AI.steps) { try { st.fn(ctx); } catch (err) { errors++; } } return ctx.finish(); };
    try { for (let i = 0; i < 25; i++) M.Sim.autoTurn(w.S); } finally { AI.plan = origPlan; }
    t.eq(errors, 0, 'no step threw');
    t.ok(w.S.planets[w.T.id].owner === 1 || w.S.planets[w.T.id].pop < 20 || w.S.fleets.some(f => f.owner === 1 && f.star === w.T.starId), 'my fleet reached the target and pressed the attack');
  });
  t.test('performance: military + spy ≤ 2 ms median and a full AI.plan ≤ 5 ms median on a 108-star, 6-empire mid-game at war', () => {
    const S = M.Sim.Setup.create({ size: 'huge', opponents: 5, seed: 'perf-mil', playerAI: true, race: 'human', difficulty: 'hard' });
    for (let i = 0; i < 70; i++) M.Sim.autoTurn(S);
    refresh(S);
    for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) { Dp.setTreaty(S, a, b, 3); contact(S, a, b); }
    const full = [], mine = [];
    for (let rep = 0; rep < 5; rep++) for (const E of S.empires) {
      let t0 = process.hrtime.bigint(); AI.plan(S, E.id, rep); full.push(Number(process.hrtime.bigint() - t0) / 1e6);
      const ctx = AI.ctx(S, E.id, rep); step('intel').fn(ctx);
      t0 = process.hrtime.bigint(); step('military').fn(ctx); step('spy').fn(ctx); mine.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    full.sort((a, b) => a - b); mine.sort((a, b) => a - b);
    const mf = full[full.length >> 1], mm = mine[mine.length >> 1];
    t.ok(mm <= 2, 'median military+spy ' + mm.toFixed(2) + ' ms');
    t.ok(mf <= 5, 'median full plan ' + mf.toFixed(2) + ' ms');
  });
};
