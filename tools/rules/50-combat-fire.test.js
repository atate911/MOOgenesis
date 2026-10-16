// Tactical combat — damage, shields, missiles/torpedoes in flight, planets & bases, special devices, repair, reaction fire (research/03 §4.4–4.10).
module.exports = function (M, t) {
  const F = require('./50-combat.test.js').fixtures(M), C = F.C, X = C._;
  const dummyHuge = B => { const u = B.units[1]; u.hp1 = u.hp2 = 1e9; u.absorb = 0; return u; };
  const stack = (B, o) => {
    const m = Object.assign({ id: B.mid++, shooter: 0, side: 0, target: 1, slot: 0, kind: 'missile', wid: 'nuclear-missile', name: 'Nuclear Missile', n: 10, px: 16, py: 84, spd: 96, budget: 96, fuel: 2,
      dmg: 4, mul: 1, acc: 0, half: false, tl: 1, fade: false, flown: 0, comp: 11, torp: false }, o || {});
    B.missiles.push(m); return m;
  };
  const impactOn = (B, idx, mo) => { const m = stack(B, mo), ev = []; X.impact(B, X.rngOf(B), m, B.units[idx], ev); ev.hit = ev.find(e => e.type === 'missile-hit'); return ev; };
  const MIS = n => ({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'nuclear-missile', count: n }] });
  const duel = (draft, n, o) => {
    const B = F.arena({ fleet: [{ draft, n }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, o);
    F.activate(B, 0); F.place(B, 1, o && o.dist !== undefined ? o.dist : 3, 3); return B;
  };

  // ---------------------------------------------------------------------------------------------------------------- stack damage (§4.6)
  t.test('stack damage: one shot kills at most one ship, the unclamped remainder stays on the next ship (hp 10: 35 damage kills 1, leaves 5 on the next)', () => {
    const s = { count: 5, hp1: 10, hploss: 0 };
    t.eq(X.hitStack(s, 35, 1), 1); t.eq(s.count, 4); t.eq(s.hploss, 5);
    const p = { count: 3, hp1: 10, hploss: 8 };
    t.eq(X.hitStack(p, 5, 1), 1); t.eq(p.count, 2); t.eq(p.hploss, 3);
    const q = { count: 3, hp1: 10, hploss: 0 };
    t.eq(X.hitStack(q, 9, 1), 0); t.eq(q.hploss, 9); t.eq(X.hitStack(q, 1, 1), 1); t.eq(q.hploss, 0); t.eq(q.count, 2);
  });
  t.test('stack damage: streaming weapons carry the excess over any number of ships; a destroyed stack has count 0', () => {
    const s = { count: 5, hp1: 10, hploss: 0 };
    t.eq(X.hitStack(s, 35, Infinity), 3); t.eq(s.count, 2); t.eq(s.hploss, 5);
    const d = { count: 2, hp1: 10, hploss: 0 };
    t.eq(X.hitStack(d, 100, Infinity), 2); t.eq(d.count, 0); t.eq(d.hploss, 0);
  });
  t.test('a volley of ten Maulers (20-100) at 100 small ships kills exactly ten; Graviton (streaming) kills far more than its shots', () => {
    const mk = w => ({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: w, count: 1 }] });
    for (const [w, test] of [['mauler-device', k => k === 10], ['graviton-beam', k => k > 10]]) {
      const B = duel(mk(w), 10, { seed: 's' + w, dist: 1 });
      const u = B.units[1]; u.count = 100; u.hp1 = u.hp2 = 3; u.absorb = 0; u.def = 0;
      const ev = C.act(B, 0, { type: 'fire', target: 1 });
      const beam = ev.find(e => e.type === 'beam');
      t.eq(beam.shots, 10); t.eq(beam.hits, 10);
      t.ok(test(100 - u.count), w + ' killed ' + (100 - u.count));
    }
  });
  t.test('shields: a Laser (1-4) cannot hurt a Class IV shield; halving weapons only lose half the shield (Hard Beam 8-12 vs absorb 12 still hurts)', () => {
    const mk = w => ({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: w, count: 1 }] });
    let B = duel(mk('laser'), 500, { seed: 'sh1', dist: 1 }); dummyHuge(B); B.units[1].absorb = 4;
    let ev = C.act(B, 0, { type: 'fire', target: 1 });
    t.eq(ev.find(e => e.type === 'beam').damage, 0); t.eq(ev.find(e => e.type === 'beam').hits, 500);
    B = duel(mk('hard-beam'), 500, { seed: 'sh2', dist: 1 }); dummyHuge(B); B.units[1].absorb = 12;
    ev = C.act(B, 0, { type: 'fire', target: 1 });
    const bm = ev.find(e => e.type === 'beam');
    t.ok(bm.damage >= 500 * 2 && bm.damage <= 500 * 6, 'hard beam per hit between 8-6=2 and 12-6=6');
    B = duel(mk('ion-cannon'), 500, { seed: 'sh3', dist: 1 }); dummyHuge(B); B.units[1].absorb = 12;
    ev = C.act(B, 0, { type: 'fire', target: 1 });
    t.eq(ev.find(e => e.type === 'beam').damage, 0);
    t.eq(ev.filter(e => e.type === 'shield-absorb').length, 1);
  });
  t.test('shield absorb is reported per volley (damage soaked) and the armor-hit event carries what got through', () => {
    const B = duel({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'fusion-beam', count: 1 }] }, 300, { seed: 'sh4', dist: 1 });
    dummyHuge(B); B.units[1].absorb = 3; B.units[1].hp1 = B.units[1].hp2 = 1e9;
    const ev = C.act(B, 0, { type: 'fire', target: 1 });
    const beam = ev.find(e => e.type === 'beam'), ab = ev.find(e => e.type === 'shield-absorb'), ar = ev.find(e => e.type === 'armor-hit');
    t.eq(beam.hits, 300); t.ok(ab.amount > 0 && ab.amount <= 900); t.eq(ar.damage, beam.damage);
    t.eq(B.units[1].hploss, beam.damage);
  });
  t.test('enveloping weapons (Hellfire, Stellar Converter, Crystal Ray) hit once but every one of the 4 attacks is reduced by the shield', () => {
    const B = duel(MIS(1), 1, { seed: 'env' });
    B.units[1].absorb = 5;
    const ev = impactOn(B, 1, { n: 10, kind: 'torpedo', torp: true, dmg: 25, mul: 4, acc: 6, tl: 40 });
    t.eq(ev.hit.hits, 10); t.eq(ev.hit.damage, 10 * (25 - 5) * 4);
    const S = duel({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'stellar-converter', count: 1 }] }, 400, { seed: 'env2' });   // range 3
    dummyHuge(S); S.units[1].absorb = 10;
    const e2 = C.act(S, 0, { type: 'fire', target: 1 });
    const bm = e2.find(x => x.type === 'beam');
    t.eq(bm.damage % 4, 0); t.ok(bm.damage > 0 && bm.damage <= 400 * 25 * 4);
    const cs = C.monsterStats('crystal', 0).weapons[0];
    t.eq(cs.mul, 4); t.deep(cs.dmg, [100, 300]); t.eq(cs.count, 10); t.eq(cs.range, 3);
  });
  t.test('a Displacement Device voids 34% of the missile VOLLEYS (one d100 < 35 roll per stack, as in the original); beams roll per hit', () => {
    const B = duel(MIS(1), 1, { seed: 'disp' }); dummyHuge(B);
    B.units[1].sp.disp = 34;
    let voided = 0; const N = 1500;
    for (let i = 0; i < N; i++) { const ev = impactOn(B, 1, { n: 5 }); t.eq(ev.hit.hits, 5); t.ok(ev.hit.damage === 0 || ev.hit.damage === 20); if (ev.hit.damage === 0) voided++; }
    t.near(voided / N, 0.34, 0.04);
    const S = duel({ hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'mauler-device', count: 1 }] }, 1000, { seed: 'disp2', dist: 1 });
    dummyHuge(S); S.units[1].sp.disp = 34;
    const bm = C.act(S, 0, { type: 'fire', target: 1 }).find(e => e.type === 'beam');
    t.eq(bm.hits, 1000); t.near(bm.damage / (1000 * 64), 0.66, 0.12);                               // roughly two thirds of the average Mauler hit gets through
  });

  // ---------------------------------------------------------------------------------------------------------------- missiles in flight (§4.7)
  t.test('missiles: a volley is ships x launchers x warheads, launched with fuel 2 and speed squares*32 px; certain hits do (damage - shield) per missile', () => {
    const B = duel(MIS(5), 4, { seed: 'ms1' });
    const tg = B.units[1]; tg.absorb = 1; tg.hp1 = tg.hp2 = 10; tg.count = 20;
    let ev = C.act(B, 0, { type: 'fire', target: 1 });
    const L = ev.find(e => e.type === 'missile-launch');
    t.eq(L.n, 20); t.eq(B.missiles.length, 1); t.eq(B.missiles[0].fuel, 2); t.eq(B.missiles[0].spd, 96); t.eq(B.units[0].weapons[0].shots, 1);
    F.activate(B, 1);
    ev = C.act(B, 1, { type: 'done' });
    const H = ev.find(e => e.type === 'missile-hit');
    t.eq(H.hits, 20); t.eq(H.intercepted, 0); t.eq(H.damage, 60);
    t.eq(tg.count, 14); t.eq(tg.hploss, 0); t.eq(B.missiles.length, 0);
  });
  t.test('missiles: a scatter pack launcher releases its warheads (Scatter Pack V = 5 per launcher); each rack holds 2 or 5 volleys', () => {
    const d = { hull: 2, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'scatter-pack-v', count: 3 }, { type: 'nuclear-missile-5', count: 1 }] };
    const B = duel(d, 2, { seed: 'sp' });
    t.eq(B.units[0].weapons[0].shots, 2); t.eq(B.units[0].weapons[1].shots, 5);
    const ev = C.act(B, 0, { type: 'fire', target: 1 });
    const ls = ev.filter(e => e.type === 'missile-launch');
    t.eq(ls.map(e => e.n).join(), '30,2');
    t.eq(B.units[0].weapons[0].shots, 1);
  });
  t.test('missiles: one volley per round (numfire), torpedoes only every second round', () => {
    const d = { hull: 2, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'proton-torpedo', count: 2 }, { type: 'nuclear-missile', count: 1 }] };
    const B = duel(d, 1, { seed: 'tq' });
    let ev = C.act(B, 0, { type: 'fire', target: 1 });
    t.eq(ev.filter(e => e.type === 'missile-launch').length, 2);
    ev = C.act(B, 0, { type: 'fire', target: 1 });
    t.eq(ev.ok, false);                                                                    // nothing left this round
    const w = B.units[0].weapons[0];
    t.eq(w.numfire, -1);
    // next round: min(-1 + 1, 1) = 0 -> still no torpedo; the round after: 1
    X.beginRound(B, []); t.eq(w.numfire, 0); X.beginRound(B, []); t.eq(w.numfire, 1);
    t.eq(B.units[0].weapons[1].shots, 1);                                                  // missile rack: 2 volleys, one used
  });
  t.test('missile flight: advances during the target\'s turn, uses its speed budget, loses 1 fuel per round in which it moved, hits on arrival', () => {
    const B = duel(MIS(2), 1, { seed: 'fl' });
    F.place(B, 1, 6, 3); dummyHuge(B);
    C.act(B, 0, { type: 'fire', target: 1 });
    const m = B.missiles[0];
    t.near(m.px, 16, 1e-9);
    F.activate(B, 1); let ev = C.act(B, 1, { type: 'done' });
    t.near(m.px, 16 + 96, 1e-9); t.eq(m.budget, 0); t.eq(ev.filter(e => e.type === 'missile-move').length, 1);
    C.endRound(B);
    t.eq(m.fuel, 1); t.near(m.budget, 96, 1e-9);
    F.activate(B, 1); ev = C.act(B, 1, { type: 'done' });
    t.ok(ev.some(e => e.type === 'missile-hit')); t.eq(B.missiles.length, 0);
  });
  t.test('missile flight: a stack that never moved keeps its fuel; one that spent its budget at fuel 1 vanishes at the end of the round', () => {
    const B = duel(MIS(1), 1, { seed: 'fu' });
    B.order = []; B.active = null;
    const a = stack(B, { fuel: 2, budget: 96 }), b = stack(B, { fuel: 1, budget: 0 });
    const ev = C.endRound(B);
    t.eq(a.fuel, 2); t.ok(B.missiles.includes(a)); t.ok(!B.missiles.includes(b));
    t.ok(ev.some(e => e.type === 'missile-lost' && e.mid === b.id && e.reason === 'fuel'));
  });
  t.test('missile flight: a target that runs to the far edge outlives the missile (3 squares/round x 2 rounds of fuel = 6 squares < 9): no hit, the stack dies of fuel', () => {
    const B = F.arena({ fleet: [{ draft: MIS(1), n: 1 }] }, { fleet: [{ draft: { hull: 1, engine: 'fusion-engine', man: 3, armor: 'titanium-armor' }, n: 1 }] }, { seed: 'run' });
    F.activate(B, 0); F.place(B, 1, 6, 3);
    C.act(B, 0, { type: 'fire', target: 1 });
    const tg = F.activate(B, 1);
    t.eq(tg.speed, 3);
    C.act(B, 1, { type: 'move', x: 9, y: 3 });
    let ev = C.act(B, 1, { type: 'done' });
    t.ok(!ev.some(e => e.type === 'missile-hit')); t.eq(B.missiles.length, 1);
    C.endRound(B); t.eq(B.missiles[0].fuel, 1);
    F.activate(B, 1); ev = C.act(B, 1, { type: 'done' });
    t.ok(!ev.some(e => e.type === 'missile-hit'));
    ev = C.endRound(B);
    t.eq(B.missiles.length, 0); t.ok(ev.some(e => e.type === 'missile-lost' && e.reason === 'fuel'));
  });
  t.test('missiles vanish when their target is destroyed; planet missiles are launched with 14 rounds of fuel', () => {
    const B = duel(MIS(1), 1, { seed: 'tl' });
    B.units[1].count = 1; B.units[1].hp1 = B.units[1].hp2 = 3;
    stack(B, { n: 1 }); stack(B, { n: 7 });
    const ev = impactOn(B, 1, { n: 5 });
    t.eq(B.units[1].count, 0); t.eq(B.missiles.filter(m => m.target === 1).length, 0);
    t.ok(ev.some(e => e.type === 'missile-lost' && e.reason === 'target-lost'));
    const P = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { planet: { bases: 2 }, planetSide: 0 });
    F.activate(P, 0); C.act(P, 0, { type: 'fire', target: 2 });
    t.eq(P.missiles[0].fuel, 14); t.eq(P.missiles[0].n, 6);
  });
  t.test('interception chance = max(0, misshield - weapon tech level): Anti-Missile 40, Zyro 75, Lightning 100', () => {
    const cases = [[40, 1, 0.39], [75, 1, 0.74], [100, 1, 0.99], [40, 4, 0.36], [75, 4, 0.71], [100, 50, 0.5], [40, 50, 0], [75, 50, 0.25], [100, 29, 0.71], [40, 41, 0]];
    for (const [ms, tl, want] of cases) {
      const B = duel(MIS(1), 1, { seed: 'ic' + ms + '_' + tl }); dummyHuge(B); B.units[1].misshield = ms;
      let hits = 0, ic = 0;
      for (let i = 0; i < 6; i++) { const ev = impactOn(B, 1, { n: 2000, tl }); hits += ev.hit.hits; ic += ev.hit.intercepted; }
      t.eq(hits, 12000);
      t.near(ic / hits, want, 0.02, 'misshield ' + ms + ' tech ' + tl);
    }
  });
  t.test('missile to-hit uses the missile defense, its own accuracy (precap quirk) and +50 when the target is cloaked', () => {
    const B = duel(MIS(1), 1, { seed: 'mh' }); dummyHuge(B);
    const t1 = B.units[1]; t1.mdef = 20;
    let hits = 0, n = 0;
    for (let i = 0; i < 6; i++) { const ev = impactOn(B, 1, { n: 2000, comp: 1, acc: 7 }); hits += ev.hit.hits; n += 2000; }
    t.near(hits / n, 0.76, 0.02);                                                          // Plasma Torpedo +7 against a hopeless defense
    hits = 0; for (let i = 0; i < 6; i++) hits += impactOn(B, 1, { n: 2000, comp: 1, acc: 0 }).hit.hits;
    t.near(hits / n, 0.06, 0.015);
    t1.mdef = 1; t1.st.cloak = 1; hits = 0;                                                // d = 0: miss 50 + 50 = 100 -> 95
    for (let i = 0; i < 6; i++) hits += impactOn(B, 1, { n: 2000, comp: 1, acc: 0 }).hit.hits;
    t.near(hits / n, 0.06, 0.015);
  });
  t.test('Plasma Torpedo loses 1 damage per 2 px flown (~16 per square) and fizzles below zero; torpedoes keep full damage otherwise', () => {
    const B = duel(MIS(1), 1, { seed: 'pt' }); dummyHuge(B);
    let ev = impactOn(B, 1, { n: 4, kind: 'torpedo', torp: true, dmg: 150, fade: true, flown: 192, acc: 7 });
    t.eq(ev.hit.damage, 4 * 54);
    ev = impactOn(B, 1, { n: 4, kind: 'torpedo', torp: true, dmg: 150, fade: true, flown: 400, acc: 7 });
    t.eq(ev.hit.damage, 0); t.eq(ev.hit.faded, true);
    ev = impactOn(B, 1, { n: 4, kind: 'torpedo', torp: true, dmg: 75, acc: 6 });
    t.eq(ev.hit.damage, 300);
  });
  t.test('asteroids eat missiles: flying through a rock square destroys a share of the stack by accuracy bonus (10% per 4 px sample at +0)', () => {
    const B = duel(MIS(1), 1, { seed: 'rk' }); dummyHuge(B);
    B.rocks = [{ x: 2, y: 3 }];
    F.place(B, 1, 5, 3);
    let total0 = 0, left0 = 0;
    for (let i = 0; i < 40; i++) {
      B.missiles.length = 0;
      const m = stack(B, { n: 1000, px: 16, py: 84, budget: 96 * 2, spd: 96 * 2 });
      const ev = []; X.flyMissile(B, X.rngOf(B), m, B.units[1], ev);
      total0 += 1000; left0 += m.n;
      t.ok(m.n <= 1000);
    }
    const surv = left0 / total0;
    t.ok(surv > 0.3 && surv < 0.7, 'survival through one rock square ' + surv);                // ~0.9^7 = 0.48
    B.rocks = [];
    const m2 = stack(B, { n: 1000, budget: 192, spd: 192 }); X.flyMissile(B, X.rngOf(B), m2, B.units[1], []); t.eq(m2.n, 1000);
    B.rocks = [{ x: 2, y: 3 }];
    let hi = 0; for (let i = 0; i < 40; i++) { const m = stack(B, { n: 1000, budget: 192, spd: 192, acc: 9 }); X.flyMissile(B, X.rngOf(B), m, B.units[1], []); hi += m.n; }
    t.ok(hi / 40000 > surv, 'higher accuracy bonus survives better');
  });

  t.test('rock +30 (verified #4): only when the LAST obstruction on the line is a rock; a planet cell behind it cancels it, shots at the planet never get it, ships do not count', () => {
    const B = duel(MIS(1), 1, { seed: 'lb' }); F.place(B, 0, 0, 3); F.place(B, 1, 5, 3);
    B.rocks = [{ x: 2, y: 3 }]; t.eq(C.lineBlocked(B, B.units[0], B.units[1]), true);
    B.rocks = [{ x: 2, y: 3 }, { x: 3, y: 3 }]; t.eq(C.lineBlocked(B, B.units[0], B.units[1]), true);
    const pl = { id: 99, kind: 'planet', x: 4, y: 3 }; B.units.unshift(pl);
    t.eq(C.lineBlocked(B, B.units[1], B.units[2]), false, 'planet cell is the last obstruction on the line');
    t.eq(C.lineBlocked(B, B.units[1], pl), false, 'never at the planet');
    B.units.shift();
  });
  t.test('bio weapons also run the bomb damage loop on the planet afterwards (verified #8): dmin 3 minus absorb hits bases / collateral', () => {
    const mk = { hull: 2, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'bio-terminator', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk, n: 30 }] }, { planet: { bases: 5, pop: 5000, factories: 500, antidote: 0 }, planetSide: 0, seed: 'bioloop' });
    B.units[0].absorb = 0; B.planet.popAcc = 0; B.planet.facAcc = 0;
    F.activate(B, 2); F.place(B, 2, 2, 3);
    const ev = C.act(B, 2, { type: 'fire', target: 0 });
    t.ok(B.planet.facAcc + B.planet.factoriesKilled * 50 > 0, 'collateral from the bomb loop');
    t.ok(!ev.some(e => e.type === 'beam' && e.weapon !== 'bio-terminator'), 'no duplicate beam event');
  });

  // ---------------------------------------------------------------------------------------------------------------- planets & bases (§4.8)
  t.test('planets: torpedoes do half damage, plain missiles full, beams half; the planet shield + deflector subtract afterwards', () => {
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: MIS(1), n: 1 }] }, { planet: { bases: 10, baseHp: 200, shield: 5, absorb: 0 }, planetSide: 0, seed: 'pl1' });
    const p = B.units[0];
    t.eq(p.absorb, 5); t.eq(p.hp1, 200);
    let ev = impactOn(B, 0, { side: 1, shooter: 2, target: 0, n: 1, kind: 'torpedo', torp: true, dmg: 75, acc: 6 });
    t.eq(ev.hit.damage, 37 - 5);
    ev = impactOn(B, 0, { side: 1, shooter: 2, target: 0, n: 1, dmg: 25, acc: 5 });
    t.eq(ev.hit.damage, 25 - 5);
    ev = impactOn(B, 0, { side: 1, shooter: 2, target: 0, n: 3, dmg: 4 });
    t.eq(ev.hit.damage, 0);
  });
  t.test('planets: beams do half damage to a planet (Mauler average ~half of its damage vs a ship)', () => {
    const mk = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'mauler-device', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk, n: 400 }] }, { planet: { bases: 4000, baseHp: 1e9, absorb: 0 }, planetSide: 0, seed: 'pl2' });
    const u = F.activate(B, 2); F.place(B, 2, 2, 3); void u;
    B.units[0].absorb = 0;
    const evP = C.act(B, 2, { type: 'fire', target: 0 });
    const planetDmg = evP.find(e => e.type === 'beam').damage / 400;
    const S = duel(mk, 400, { seed: 'pl3', dist: 1 }); dummyHuge(S);
    const shipDmg = C.act(S, 0, { type: 'fire', target: 1 }).find(e => e.type === 'beam').damage / 400;
    t.near(planetDmg / shipDmg, 0.5, 0.04);
  });
  t.test('planet collateral: with bases standing 400 damage = 1 pop and 100 = 1 factory; once the bases are gone 200 = 1 pop, 50 = 1 factory; remainders carry', () => {
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { planet: { bases: 3, pop: 50, factories: 30 }, planetSide: 0, seed: 'col' });
    const P = B.planet, pu = B.units[0];
    X.planetCollateral(B, 100, []); t.eq(P.popKilled, 0); t.eq(P.factoriesKilled, 1);
    X.planetCollateral(B, 300, []); t.eq(P.popKilled, 1); t.eq(P.factoriesKilled, 4);
    pu.count = 0;
    X.planetCollateral(B, 200, []); t.eq(P.popKilled, 2); t.eq(P.factoriesKilled, 8);
    X.planetCollateral(B, 49, []); t.eq(P.popKilled, 2); t.eq(P.factoriesKilled, 8);
    X.planetCollateral(B, 1, []); t.eq(P.factoriesKilled, 9);
    t.eq(P.pop, 48); t.eq(P.factories, 21);
    P.pop = 1; P.factories = 2; X.planetCollateral(B, 100000, []);
    t.eq(P.pop, 0); t.eq(P.factories, 0);
  });
  t.test('planet collateral through real fire: beams at a defended planet kill pop and factories at the halved rate', () => {
    const mk = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'mauler-device', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk, n: 50 }] }, { planet: { bases: 100, baseHp: 1e9, absorb: 0, pop: 100, factories: 200 }, planetSide: 0, seed: 'col2' });
    F.activate(B, 2); F.place(B, 2, 2, 3); B.units[0].absorb = 0;
    const ev = C.act(B, 2, { type: 'fire', target: 0 });
    const beam = ev.find(e => e.type === 'beam'), clamp = beam.damage;                      // hp1 is huge so nothing is clamped
    const half = Math.floor(clamp / 2);
    t.eq(B.planet.popKilled, Math.floor(half / 200)); t.eq(B.planet.factoriesKilled, Math.floor(half / 50));
    t.ok(B.planet.factoriesKilled > 0);
  });
  t.test('bombs hit the planet item only (range 1) and use missile defense; every bomb is a shot at bases and collateral damage', () => {
    const d = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'nuclear-bomb', count: 4 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: d, n: 25 }] }, { planet: { bases: 5, baseHp: 1e6, absorb: 0, pop: 50, factories: 30 }, planetSide: 0, seed: 'bomb' });
    F.activate(B, 2); F.place(B, 2, 5, 3);
    t.eq(C.targets(B, 2).length, 0);                                                         // not adjacent
    F.place(B, 2, 2, 3);
    const tg = C.targets(B, 2, 'bomb');
    t.eq(tg.length, 1); t.eq(tg[0].type, 'planet');
    t.eq(C.targets(B, 2, 'beam').length, 0);
    const ev = C.act(B, 2, { type: 'fire', target: 0 });
    const beam = ev.find(e => e.type === 'beam');
    t.eq(beam.shots, 100); t.eq(beam.hits, 100);
    t.eq(B.units[0].count, 5); t.eq(B.units[0].hploss, beam.damage % 1e6 === beam.damage ? beam.damage : B.units[0].hploss);
    t.eq(B.units[2].weapons[0].shots, 9);
    t.ok(B.planet.popKilled + B.planet.factoriesKilled > 0, 'collateral damage');
  });
  t.test('bio weapons never miss: each bomb kills max(0, rnd(0..max) - antidote) population; the sum also shrinks the maximum population', () => {
    const mk = w => ({ hull: 2, comp: 'mark-1-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: w, count: 1 }] });
    let B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk('death-spores'), n: 40 }] }, { planet: { bases: 1, pop: 50, antidote: 1 }, planetSide: 0, seed: 'bio1' });
    F.activate(B, 2); F.place(B, 2, 2, 3);
    C.act(B, 2, { type: 'fire', target: 0 });
    t.eq(B.planet.popKilled, 0); t.eq(B.planet.bio, 0);                                       // max 1 - antidote 1
    B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk('doom-virus'), n: 600 }] }, { planet: { bases: 1, pop: 5000, antidote: 1 }, planetSide: 0, seed: 'bio2' });
    F.activate(B, 2); F.place(B, 2, 2, 3);
    const ev = C.act(B, 2, { type: 'fire', target: 0 });
    const bioKilled = ev.find(e => e.type === 'bio-hit').popKilled;
    t.ok(bioKilled <= B.planet.popKilled, 'the bomb step that follows the spores keeps falling once the last base is gone and adds its own collateral kills');
    t.near(bioKilled / 600, 1 / 3, 0.07);
    t.eq(B.planet.bio, bioKilled);
    B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: mk('bio-terminator'), n: 30 }] }, { planet: { bases: 1, pop: 5000, antidote: 0 }, planetSide: 0, seed: 'bio3' });
    F.activate(B, 2); F.place(B, 2, 2, 3);
    C.act(B, 2, { type: 'fire', target: 0 });
    t.near(B.planet.popKilled / 30, 1.5, 0.6);
    t.eq(B.units[2].weapons[0].shots, 4);
  });
  t.test('a planet with no bases is a valid target only for bombs and bio weapons', () => {
    const d = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }, { type: 'nuclear-bomb', count: 1 }] };
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: d, n: 3 }] }, { planet: { bases: 1 }, planetSide: 0, seed: 'nb' });
    B.units[0].count = 0;                                                                    // all bases gone
    F.activate(B, 2); F.place(B, 2, 2, 3);
    const tg = C.targets(B, 2);
    t.eq(tg.length, 1); t.deep(tg[0].weapons, [1]);
    F.place(B, 2, 6, 3); t.eq(C.targets(B, 2).length, 0);
  });
  t.test('planet weapons: only ONE slot fires per round (bases x 3 launchers), the slot is chosen with planet-weapon, ammo is unlimited', () => {
    const B = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: F.DUMMY, n: 1 }] }, { planet: { bases: 4, weapon: 'nuclear-missile', weapon2: 'scatter-pack-v' }, planetSide: 0, seed: 'pw' });
    F.activate(B, 0);
    let ev = C.act(B, 0, { type: 'fire', target: 2 });
    t.eq(ev.filter(e => e.type === 'missile-launch').map(e => e.n).join(), '12');
    ev = C.act(B, 0, { type: 'fire', target: 2 }); t.eq(ev.ok, false);
    B.units[0].weapons.forEach(w => { w.numfire = 1; });
    C.act(B, 0, { type: 'planet-weapon', slot: 1 });
    ev = C.act(B, 0, { type: 'fire', target: 2 });
    t.eq(ev.filter(e => e.type === 'missile-launch').map(e => e.n).join(), '60');            // 4 bases x 3 launchers x 5 warheads
    t.eq(B.units[0].weapons[0].shots, -1);
    t.eq(C.act(B, 0, { type: 'move', x: 3, y: 3 }).ok, false);
  });

  // ---------------------------------------------------------------------------------------------------------------- special devices (§4.9)
  const withDevice = (id, extra) => Object.assign({ hull: 2, engine: 'retro-engine', man: 0, armor: 'titanium-armor', comp: 'mark-5-computer', specials: [id] }, extra || {});
  const foeStack = (B, o) => Object.assign(B.units[1], o);
  t.test('stasis field: freezes an adjacent ship, consumes the attack, the frozen group is skipped and thaws at the caster\'s next turn; missiles aimed at it vanish', () => {
    const B = F.arena({ fleet: [{ draft: withDevice('stasis-field', { weapons: [{ type: 'laser', count: 2 }] }), n: 3 }] }, { fleet: [{ draft: F.LASER(2), n: 2 }, { draft: F.LASER(1), n: 2 }] }, { seed: 'st' });
    F.activate(B, 0); F.place(B, 1, 1, 3);
    stack(B, { shooter: 2, side: 1, target: 1, n: 2 });
    t.eq(C.targets(B, 0, 'special')[0].devices.includes('stasis'), true);
    const ev = C.act(B, 0, { type: 'special', device: 'stasis', target: 1 });
    t.eq(ev.ok, true); t.eq(B.units[1].st.stasis, 1); t.eq(B.units[1].st.stasisBy, 0);
    t.ok(ev.some(e => e.type === 'missile-lost' && e.reason === 'stasis'));
    t.eq(C.act(B, 0, { type: 'fire', target: 1 }).ok, false);                                // the stasis action consumed the attack
    t.eq(C.act(B, 0, { type: 'special', device: 'stasis', target: 1 }).ok, false);           // once per turn
    // the frozen group's own turn is skipped
    B.order = [1]; const ev2 = C.act(B, 0, { type: 'done' });
    t.ok(ev2.some(e => e.type === 'frozen' && e.unit === 1));
    // thaw when the caster starts its next turn
    const u0 = B.units[0]; u0.st.begun = false; X.beginTurn(B, u0, []);
    t.eq(B.units[1].st.stasis, 0);
  });
  t.test('stasis field: cloaked ships, planets and monsters are immune; it needs an adjacent target', () => {
    const B = F.arena({ fleet: [{ draft: withDevice('stasis-field'), n: 2 }] }, { fleet: [{ draft: F.LASER(2), n: 2 }] }, { seed: 'st2', planet: { bases: 2 }, planetSide: 1 });
    // units: 0 planet (right), 1 left stasis ship, 2 right laser ship
    F.activate(B, 1); F.place(B, 2, 5, 3);
    t.eq(C.act(B, 1, { type: 'special', device: 'stasis', target: 2 }).ok, false);          // too far
    F.place(B, 2, 1, 3); B.units[2].st.cloak = 1;
    t.eq(C.act(B, 1, { type: 'special', device: 'stasis', target: 2 }).ok, false);
    B.units[2].st.cloak = 0; F.place(B, 1, 7, 3);
    t.eq(C.act(B, 1, { type: 'special', device: 'stasis', target: 0 }).ok, false);          // the planet
    B.units[2].kind = 'monster'; F.place(B, 2, 6, 3);
    t.eq(C.act(B, 1, { type: 'special', device: 'stasis', target: 2 }).ok, false);          // monsters
  });
  t.test('energy pulsar: every adjacent group (friend or foe) loses rnd(1..N/2+5) minus its shield from the max HP of each ship; v >= hp kills the whole group', () => {
    let killed = 0, hurt = 0, none = 0;
    for (let s = 0; s < 150; s++) {
      const B = F.arena({ fleet: [{ draft: withDevice('energy-pulsar'), n: 20 }, { draft: F.LASER(1), n: 3 }] }, { fleet: [{ draft: { hull: 1, engine: 'retro-engine', man: 0, armor: 'titanium-armor' }, n: 4 }] }, { seed: 'pu' + s });
      F.activate(B, 0); F.place(B, 1, 0, 4); F.place(B, 2, 1, 3);
      B.units[2].absorb = 3;                                                                 // foe: medium ships, 18 hp
      const ev = C.act(B, 0, { type: 'special', device: 'pulsar' });
      t.eq(ev.ok, true);
      const eff = ev.find(e => e.type === 'special-effect' && e.device === 'pulsar');
      const foe = eff.affected.find(a => a.target === 2), fr = eff.affected.find(a => a.target === 1);
      t.eq(eff.affected.length, 2);
      t.between(foe.damage, 0, 15 - 3); t.between(fr.damage, 0, 15);                          // 20/2 + 5 = 15 max
      if (foe.damage > 0) { t.eq(B.units[2].hp1, 18 - foe.damage); hurt++; } else { t.eq(B.units[2].hp1, 18); none++; }
      if (fr.damage >= 100) killed++;
      t.eq(B.units[1].hp1, 100 - fr.damage);
      t.eq(C.act(B, 0, { type: 'special', device: 'pulsar' }).ok, false);                      // once per turn
    }
    t.ok(hurt > 100 && none < 50); t.eq(killed, 0);
  });
  t.test('ionic pulsar: rnd(1..N+10); a group whose per-ship HP is not above the roll dies completely; against a planet the roll halves first', () => {
    let wiped = 0;
    for (let s = 0; s < 120; s++) {
      const B = F.arena({ fleet: [{ draft: withDevice('ionic-pulsar'), n: 30 }] }, { fleet: [{ draft: { hull: 0, engine: 'retro-engine', man: 0, armor: 'titanium-armor' }, n: 9 }] }, { seed: 'ip' + s });
      F.activate(B, 0); F.place(B, 1, 1, 3);
      const ev = C.act(B, 0, { type: 'special', device: 'pulsar' });
      const a = ev.find(e => e.type === 'special-effect').affected[0];
      t.between(a.damage, 0, 40);
      if (B.units[1].count === 0) { wiped++; t.ok(a.damage >= 3); t.eq(a.killed, 9); t.ok(ev.some(e => e.type === 'ship-destroyed' && e.n === 9)); } else t.eq(B.units[1].hp1, 3 - a.damage);
    }
    t.ok(wiped > 90);
    const P = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: withDevice('ionic-pulsar'), n: 30 }] }, { planet: { bases: 2, baseHp: 1000 }, planetSide: 0, seed: 'ipp' });
    let max = 0; for (let k = 0; k < 40; k++) { F.activate(P, 2); F.place(P, 2, 2, 3); P.units[2].st.used = {}; const e = C.act(P, 2, { type: 'special', device: 'pulsar' }); max = Math.max(max, e.find(x => x.type === 'special-effect').affected.find(a => a.target === 0).damage - 0); P.units[0].hp1 = 1000; }
    t.ok(max <= 20 - 1, 'planet roll is halved: max (40/2) - absorb 1 = 19');
  });
  t.test('stream projectors: Ion removes min(50, N/2+20)% and Neutron min(75, N/2+40)% of each target ship\'s HP (rounded up), range 2, never on monsters', () => {
    for (const [dev, n, pct] of [['ion-stream-projector', 10, 25], ['ion-stream-projector', 100, 50], ['neutron-stream-projector', 10, 45], ['neutron-stream-projector', 100, 75]]) {
      const B = F.arena({ fleet: [{ draft: withDevice(dev), n }] }, { fleet: [{ draft: { hull: 2, engine: 'retro-engine', man: 0, armor: 'titanium-armor' }, n: 5 }] }, { seed: 'sp' + dev + n });
      F.activate(B, 0); F.place(B, 1, 2, 3);
      const ev = C.act(B, 0, { type: 'special', device: 'stream', target: 1 });
      t.eq(ev.ok, true);
      const e = ev.find(x => x.type === 'special-effect');
      t.eq(e.percent, pct); t.eq(B.units[1].hp1, 100 - Math.ceil(100 * pct / 100));
    }
    const B = F.arena({ fleet: [{ draft: withDevice('ion-stream-projector'), n: 10 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'sp2' });
    F.activate(B, 0); F.place(B, 1, 4, 3);
    t.eq(C.act(B, 0, { type: 'special', device: 'stream', target: 1 }).ok, false);          // range 3 > 2
    F.place(B, 1, 2, 3); B.units[1].kind = 'monster';
    t.eq(C.act(B, 0, { type: 'special', device: 'stream', target: 1 }).ok, false);
  });
  t.test('black hole generator: a stack of n becomes (100-v)% of its size with v = rnd(1..75)+25-2*absorb; a single ship dies when d100 > v (v1.3 inversion)', () => {
    for (let s = 0; s < 40; s++) {
      const B = F.arena({ fleet: [{ draft: withDevice('black-hole-generator'), n: 3 }] }, { fleet: [{ draft: F.LASER(1), n: 400 }] }, { seed: 'bh' + s });
      F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].absorb = 2;
      const ev = C.act(B, 0, { type: 'special', device: 'blackhole', target: 1 });
      const e = ev.find(x => x.type === 'special-effect');
      t.between(e.strength, 26 - 4, 100 - 4);
      t.eq(B.units[1].count, Math.floor(400 * (100 - e.strength) / 100)); t.eq(e.killed, 400 - B.units[1].count);
    }
    const trial = bug => {
      C.CONFIG.bhBug = bug; let dead = 0; const n = 600;
      for (let s = 0; s < n; s++) {
        const B = F.arena({ fleet: [{ draft: withDevice('black-hole-generator'), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'bh1' + s });
        F.activate(B, 0); F.place(B, 1, 1, 3); B.units[1].absorb = 0;
        C.act(B, 0, { type: 'special', device: 'blackhole', target: 1 });
        if (B.units[1].count === 0) dead++;
      }
      return dead / n;
    };
    try { t.near(trial(true), 0.37, 0.06); t.near(trial(false), 0.63, 0.06); } finally { C.CONFIG.bhBug = true; }
  });
  t.test('warp dissipator: 50% to slow a target within 3 (speed -1, defenses -2, accumulating), nothing when the target has no movement left', () => {
    let ok = 0;
    for (let s = 0; s < 400; s++) {
      const B = F.arena({ fleet: [{ draft: withDevice('warp-dissipator'), n: 1 }] }, { fleet: [{ draft: { hull: 1, engine: 'fusion-engine', man: 3, armor: 'titanium-armor' }, n: 1 }] }, { seed: 'wd' + s });
      F.activate(B, 0); F.place(B, 1, 3, 3);
      const u = B.units[1], def0 = u.def, a0 = u.actman;
      const ev = C.act(B, 0, { type: 'special', device: 'dissipator', target: 1 });
      const e = ev.find(x => x.type === 'special-effect');
      if (e.success) { ok++; t.eq(u.unman, 1); t.eq(u.actman, a0 - 1); t.eq(u.def, def0 - 2); t.eq(u.mdef, def0 - 2 + 0); } else t.eq(u.unman, 0);
    }
    t.near(ok / 400, 0.5, 0.08);
    const B = F.arena({ fleet: [{ draft: withDevice('warp-dissipator'), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'wd2' });
    F.activate(B, 0); F.place(B, 1, 3, 3); B.units[1].actman = 0;
    for (let k = 0; k < 20; k++) { B.units[0].st.used = {}; C.act(B, 0, { type: 'special', device: 'dissipator', target: 1 }); }
    t.eq(B.units[1].unman, 0);
    F.place(B, 1, 5, 3); B.units[1].actman = 1;
    t.eq(C.act(B, 0, { type: 'special', device: 'dissipator', target: 1 }).ok, false);
  });
  t.test('warp dissipator accumulates: the second success removes the TOTAL unman from the remaining movement; defence -2 only while it can still move', () => {
    const B = F.arena({ fleet: [{ draft: withDevice('warp-dissipator'), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'wdc' });
    F.activate(B, 0); F.place(B, 1, 3, 3);
    const u = B.units[1]; u.actman = 5; u.unman = 1; u.def = 7; u.mdef = 7;
    let done = false;
    for (let k = 0; k < 40 && !done; k++) { B.units[0].st.used = {}; const ev = C.act(B, 0, { type: 'special', device: 'dissipator', target: 1 }); done = !!(ev.find(e => e.type === 'special-effect' && e.success)); }
    t.ok(done); t.eq(u.unman, 2); t.eq(u.actman, 3); t.eq(u.def, 5);
    u.actman = 2; u.unman = 1; u.def = 7; done = false;
    for (let k = 0; k < 40 && !done; k++) { B.units[0].st.used = {}; const ev = C.act(B, 0, { type: 'special', device: 'dissipator', target: 1 }); done = !!(ev.find(e => e.type === 'special-effect' && e.success)); }
    t.ok(done); t.eq(u.actman, 0); t.eq(u.def, 7, 'no movement left: no defence penalty');
  });
  t.test('technology nullifier: automatic hit, attack level -(2..6) (two d3), missile defense likewise but never below beam defense', () => {
    const drops = {};
    for (let s = 0; s < 300; s++) {
      const B = F.arena({ fleet: [{ draft: withDevice('technology-nullifier'), n: 1 }] }, { fleet: [{ draft: { hull: 2, engine: 'retro-engine', man: 0, comp: 'mark-9-computer', ecm: 'ecm-9', armor: 'titanium-armor' }, n: 1 }] }, { seed: 'tn' + s });
      F.activate(B, 0); F.place(B, 1, 4, 3);
      const u = B.units[1], c0 = u.comp, m0 = u.mdef, d0 = u.def;
      const ev = C.act(B, 0, { type: 'special', device: 'technull', target: 1 });
      const dr = ev.find(x => x.type === 'special-effect').drop;
      t.between(dr, 2, 6); t.eq(u.comp, c0 - dr); t.eq(u.mdef, Math.max(d0, m0 - dr)); drops[dr] = (drops[dr] || 0) + 1;
    }
    t.ok(drops[4] > drops[2] && drops[4] > drops[6], 'triangular distribution peaks at 4');
  });
  t.test('repulsor beam: pushes an adjacent enemy one square straight away, or to a flanking square; nothing when boxed in or at the edge', () => {
    const mk = () => F.arena({ fleet: [{ draft: withDevice('repulsor-beam'), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'rp' });
    let B = mk(); F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 5, 3);
    let ev = C.act(B, 0, { type: 'special', device: 'repulsor', target: 1 });
    t.eq(ev.ok, true); t.eq(B.units[1].x, 6); t.eq(B.units[1].y, 3);
    B = mk(); F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 5, 4);
    C.act(B, 0, { type: 'special', device: 'repulsor', target: 1 }); t.eq(B.units[1].x, 6); t.eq(B.units[1].y, 5);
    B = mk(); F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 5, 3); B.rocks = [{ x: 6, y: 3 }];
    C.act(B, 0, { type: 'special', device: 'repulsor', target: 1 });
    t.eq(B.units[1].x, 6); t.ok(B.units[1].y === 4 || B.units[1].y === 2);
    B = mk(); F.activate(B, 0); F.place(B, 0, 8, 3); F.place(B, 1, 9, 3);
    ev = C.act(B, 0, { type: 'special', device: 'repulsor', target: 1 });
    t.eq(B.units[1].x, 9); t.ok(ev.some(e => e.blocked));
  });
  t.test('repulsor beam: also triggers automatically on an enemy that steps next to a group that has it armed; it re-arms at the start of the group\'s turn', () => {
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: withDevice('repulsor-beam'), n: 1 }] }, { seed: 'rp2' });
    F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 6, 3); B.units[1].st.rep = true;
    const ev = C.act(B, 0, { type: 'move', x: 5, y: 3 });
    t.ok(ev.some(e => e.type === 'special-effect' && e.device === 'repulsor'));
    t.eq(B.units[0].x, 4); t.eq(B.units[1].st.rep, false);
    const u = B.units[1]; u.st.begun = false; X.beginTurn(B, u, []); t.eq(u.st.rep, true);
  });
  function runner() { return { hull: 1, comp: 'mark-1-computer', engine: 'nuclear-engine', man: 1, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 1 }] }; }
  t.test('cloaking device: +50 to be hit, no reaction fire while moving cloaked, decloaks to fire and recloaks after a whole turn without firing', () => {
    const cl = withDevice('cloaking-device', { weapons: [{ type: 'laser', count: 1 }], engine: 'nuclear-engine', man: 1 });
    const B = F.arena({ fleet: [{ draft: cl, n: 1 }] }, { fleet: [{ draft: { hull: 2, engine: 'retro-engine', man: 0, comp: 'mark-5-computer', armor: 'titanium-armor', weapons: [{ type: 'laser', count: 3 }] }, n: 1 }] }, { seed: 'cl' });
    const u = B.units[0], foe = B.units[1];
    t.eq(u.st.cloak, 1);
    F.activate(B, 0); F.place(B, 0, 5, 3); F.place(B, 1, 7, 3); foe.st.canRetaliate = true;
    let ev = C.act(B, 0, { type: 'move', x: 6, y: 3 });
    t.eq(ev.filter(e => e.type === 'beam').length, 0);                                       // cloaked mover: no reaction fire
    ev = C.act(B, 0, { type: 'fire', target: 1 });
    t.eq(u.st.cloak, 2); t.ok(ev.some(e => e.type === 'cloak' && e.state === 'off'));
    C.act(B, 0, { type: 'done' });
    t.eq(u.st.cloak, 2);                                                                      // fired this turn: stays visible
    u.st.begun = false; X.beginTurn(B, u, []); B.active = 0;
    C.act(B, 0, { type: 'done' });
    t.eq(u.st.cloak, 1);                                                                      // a full turn without firing
    const v = F.arena({ fleet: [{ draft: F.LASER(1), n: 1 }] }, { fleet: [{ draft: cl, n: 1 }] }, { seed: 'cl2' });
    t.eq(v.units[1].st.cloak, 1); F.activate(v, 0); F.place(v, 0, 1, 3); F.place(v, 1, 2, 3);
    t.eq(C.targets(v, 0)[0].cloaked, true);
  });
  t.test('repair: Automated Repair heals 15% and Advanced Damage Control 30% of ONE ship per own turn (integer), stripped armor (hp1) is restored first', () => {
    const B = F.arena({ fleet: [{ draft: withDevice('automated-repair'), n: 3 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'rep' });
    const u = B.units[0];
    t.eq(u.repair, 15);
    u.hp1 = u.hp2 = 100; u.hploss = 60; u.st.begun = false; X.beginTurn(B, u, []); t.eq(u.hploss, 45);
    u.st.begun = false; u.repair = 30; X.beginTurn(B, u, []); t.eq(u.hploss, 15);
    u.st.begun = false; X.beginTurn(B, u, []); t.eq(u.hploss, 0);
    u.hp1 = 80; u.hploss = 10; u.st.begun = false; u.repair = 15; X.beginTurn(B, u, []); t.eq(u.hp1, 95); t.eq(u.hploss, 10);
    u.st.begun = false; X.beginTurn(B, u, []); t.eq(u.hp1, 100);
    const s = F.arena({ fleet: [{ draft: Object.assign(withDevice('automated-repair'), { hull: 0 }), n: 1 }] }, { fleet: [{ draft: F.LASER(1), n: 1 }] }, { seed: 'rep2' });
    const sm = s.units[0]; sm.hploss = 2; sm.st.begun = false; X.beginTurn(s, sm, []); t.eq(sm.hploss, 2);   // 15% of 3 hp = 0
    t.eq(C.monsterStats('amoeba', 4).repair, 50);
  });
  t.test('wait: the turn moves to the end of the round once; a waiting group still gives reaction fire (1oom: can_retaliate is set when a group waits)', () => {
    const d = { hull: 1, engine: 'retro-engine', man: 0, comp: 'mark-1-computer', armor: 'titanium-armor', weapons: [{ type: 'laser', count: 2 }] };
    const B = F.arena({ fleet: [{ draft: d, n: 1 }, { draft: d, n: 1 }] }, { fleet: [{ draft: d, n: 1 }] }, { seed: 'wt' });
    const first = B.active, rest = B.order.slice();
    const ev = C.act(B, first, { type: 'wait' });
    t.ok(ev.some(e => e.type === 'turn-end' && e.waited));
    t.eq(B.active, rest[0]); t.eq(B.order[B.order.length - 1], first); t.eq(B.units[first].st.canRetaliate, true);
    // a second wait is a plain done
    C.act(B, B.active, { type: 'done' }); C.act(B, B.active, { type: 'done' });
    t.eq(B.active, first);
    C.act(B, first, { type: 'wait' });
    t.eq(B.phase, 'roundEnd');
  });
  t.test('reaction fire: a mover that steps into the range of a group that already started its turn is shot by its unspent beams (once per round); missiles and unstarted groups do not react', () => {
    const lasers = { hull: 2, comp: 'mark-5-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'laser', count: 4 }] };
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: lasers, n: 5 }, { draft: MIS(3), n: 5 }] }, { seed: 'rf' });
    F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 6, 3); F.place(B, 2, 6, 4);
    B.units[0].hp1 = B.units[0].hp2 = 1e6;
    // nobody has started a turn yet: no reaction
    B.units[1].st.canRetaliate = false; B.units[2].st.canRetaliate = false;
    let ev = C.act(B, 0, { type: 'move', x: 5, y: 3 });
    t.eq(ev.filter(e => e.type === 'beam').length, 0);
    // the laser group has acted this round: it fires at the next mover that comes into reach
    B.units[1].st.canRetaliate = true; B.units[2].st.canRetaliate = true;
    F.activate(B, 0); F.place(B, 0, 4, 3);
    ev = C.act(B, 0, { type: 'move', x: 5, y: 3 });
    const beams = ev.filter(e => e.type === 'beam');
    t.eq(beams.length, 1); t.eq(beams[0].unit, 1); t.eq(beams[0].shots, 20);
    t.eq(ev.filter(e => e.type === 'missile-launch').length, 0);
    F.activate(B, 0); F.place(B, 0, 4, 3);
    ev = C.act(B, 0, { type: 'move', x: 5, y: 3 });
    t.eq(ev.filter(e => e.type === 'beam').length, 0);                                        // the beams are spent for this round
  });
  t.test('reaction fire can destroy the mover and ends its move', () => {
    const lasers = { hull: 2, comp: 'mark-11-computer', engine: 'retro-engine', man: 0, armor: 'titanium-armor', weapons: [{ type: 'mauler-device', count: 4 }] };
    const B = F.arena({ fleet: [{ draft: runner(), n: 1 }] }, { fleet: [{ draft: lasers, n: 10 }] }, { seed: 'rf2' });
    F.activate(B, 0); F.place(B, 0, 4, 3); F.place(B, 1, 6, 3);
    B.units[1].st.canRetaliate = true; B.units[1].weapons[0].range = 9;
    B.units[0].count = 1; B.units[0].hp1 = B.units[0].hp2 = 5;
    const ev = C.act(B, 0, { type: 'move', x: 6, y: 5 });
    t.ok(ev.some(e => e.type === 'ship-destroyed'));
    t.eq(B.units[0].count, 0); t.ok(B.over, 'the last left group died');
  });
};
