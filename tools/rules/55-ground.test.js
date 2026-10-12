// Ground war vs the verified specs: research/03 §5.2–5.3 (bombardment, bio weapons, antidotes), §7 (gauntlet, land combat, conquest), research/02 §5 + §1.10 (force, tech capture),
// research/01 §4.5 (Bulrathi), research/04 §6.2 (transports, 300 cap), research/05 §4.2.3 + §5.4–5.5 (incidents, candidates, incite).
module.exports = function (M, t) {
  const G = M.Sim.Ground, K = M.Data.Components, I = K.idx, D = M.Sim.Design, Rs = M.Sim.Research;

  // ---- fixtures ---------------------------------------------------------------------------------------------------------------------------
  const game = (seed, race) => M.Sim.Setup.create({ size: 'small', opponents: 2, race: race || 'human', seed: seed || 'ground', difficulty: 'average' });
  // empire 0 (human) attacks the capital of empire 1 (AI, 50 pop, 30 factories, no bases); empire 2 is a bystander
  function fx(seed, over) {
    const S = game(seed, over && over.race), att = S.empires[0], def = S.empires[1], p = S.planets[def.capital];
    def.race = (over && over.defRace) || 'meklar'; S.empires[2].race = 'darlok';          // races without a ground bonus, whatever the seed rolled
    if (over && over.planet) Object.assign(p, over.planet);
    return { S, att, def, p, R: M.RNG.bind(S.rs), other: S.empires[2] };
  }
  const land = (f, n) => ({ kind: 'invade', empire: 0, target: 1, planet: f.p.id, n });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const rules = (r, fn) => { G.useRules(r); try { fn(); } finally { G.useRules(); } };
  const W = (id, count, slot) => {                                // a weapon entry exactly as Design.stats() lists it
    const idx = I.weapons[id], w = K.WEAPONS[idx];
    return { slot: slot | 0, type: idx, id, n: w.n, name: w.name, kind: w.kind, count, dmg: w.dmg.slice(), range: w.range, rof: w.rof, ammo: w.ammo, speed: w.speed, acc: w.acc, racks: w.racks,
      warheads: w.warheads, mul: w.mul, heavy: w.heavy, flags: Object.assign({}, w.flags), tl: w.tech.l };
  };
  // temporarily replace Design.stats for (empire, slot) pairs: { '0:5': {weapons:[…], compLevel} }
  function withDesigns(map, fn) {
    const orig = D.stats;
    D.stats = (S, E, slot) => { const m = map[E.id + ':' + slot]; return m ? Object.assign({ valid: true, weapons: [], compLevel: 0, attack: 0, armed: true, bombs: 0, bio: 0, weaponCount: 0 }, m) : orig(S, E, slot); };
    try { fn(); } finally { D.stats = orig; }
  }
  const fleet = (f, owner, slot, n) => M.Sim.Fleet.addShips(f.S, owner, f.p.starId, slot, n);
  const evs = (S, type, cat) => (S.ev || []).filter(e => e.type === type && (cat === undefined || e.cat === cat || e.kind === cat));
  const bomberFx = (seed, over) => { const f = fx(seed, over); fleet(f, 0, 3, 10); return f; };       // 10 Bombers: 2 Nuclear Bombs (bank 0) + 2 Lasers (bank 1), no computer
  const bioFx = (seed, weapon, count) => { const f = fx(seed, { planet: { pop: 1000, factories: 100, mp3: 1000 } }); fleet(f, 0, 5, 10); f.designs = { '0:5': { weapons: [W(weapon, count, 0)] } }; return f; };

  // =================================================================================================================================
  // force
  // =================================================================================================================================
  t.test('force: every armor/suit/shield/weapon tier × Bulrathi × defender combination follows 5a+10s+10f+5w′(+25)(+5)', () => {
    let n = 0;
    for (let ar = 0; ar <= 6; ar++) for (let su = 0; su <= 3; su++) for (let sh = 0; sh <= 3; sh++) for (let w = 0; w <= 5; w++) for (const bul of [0, 1]) for (const def of [0, 1]) {
      const E = { race: bul ? 'bulrathi' : 'human', mods: { ground: { armor: ar, suit: su, shield: sh, weapon: w } } };
      const want = 5 * ar + 10 * su + 10 * sh + 5 * (w <= 2 ? w : w + 1) + (bul ? 25 : 0) + (def ? 5 : 0);
      if (G.force(null, E, !!def) !== want) throw new Error(`tiers ${ar}/${su}/${sh}/${w} bul=${bul} def=${def}: ${G.force(null, E, !!def)} != ${want}`);
      n++;
    }
    t.eq(n, 7 * 4 * 4 * 6 * 4);
  });
  t.test('force: weapon tiers give +5/+10/+20/+25/+30, armor +5…+30, suits +10…+30, shields +10…+30; the maximum is 150', () => {
    const w = k => G.force(null, { race: 'human', mods: { ground: { weapon: k } } }, false);
    t.deep([1, 2, 3, 4, 5].map(w), [5, 10, 20, 25, 30]);
    t.deep([1, 2, 3, 4, 5, 6].map(k => G.force(null, { race: 'human', mods: { ground: { armor: k } } }, false)), [5, 10, 15, 20, 25, 30]);
    t.deep([1, 2, 3].map(k => G.force(null, { race: 'human', mods: { ground: { suit: k } } }, false)), [10, 20, 30]);
    t.deep([1, 2, 3].map(k => G.force(null, { race: 'human', mods: { ground: { shield: k } } }, false)), [10, 20, 30]);
    t.eq(G.force(null, { race: 'bulrathi', mods: { ground: { armor: 6, suit: 3, shield: 3, weapon: 5 } } }, true), 150);
    t.eq(G.force(null, { race: 'human', mods: {} }, false), 0); t.eq(G.force(null, { race: 'human', mods: {} }, true), 5);
    t.eq(G.force(null, { race: 'silicoid', mods: {} }, false), 0, 'only Bulrathi has a ground bonus');
    const parts = G.forceParts(null, { race: 'bulrathi', mods: { ground: { armor: 2, suit: 1, shield: 0, weapon: 3 } } }, true);
    t.deep([parts.armor, parts.suit, parts.shield, parts.weapon, parts.race, parts.defender, parts.total], [10, 10, 0, 20, 25, 5, 70]);
  });
  t.test('force from real research: Duralloy + Battle Suits + Personal Deflector + Hand Lasers = +30; matches Data.Techs.groundBonus', () => {
    const f = fx('force'), E = f.att;
    t.eq(G.force(f.S, E, false), 0);
    Rs.grant(f.S, E, 1, 10, 'test'); t.eq(G.force(f.S, E, false), 5);     // Duralloy armor
    Rs.grant(f.S, E, 1, 11, 'test'); t.eq(G.force(f.S, E, false), 15);    // Battle Suits
    Rs.grant(f.S, E, 2, 8, 'test'); t.eq(G.force(f.S, E, false), 25);     // Personal Deflector
    Rs.grant(f.S, E, 5, 2, 'test'); t.eq(G.force(f.S, E, false), 30);     // Hand Lasers
    Rs.grant(f.S, E, 5, 24, 'test'); t.eq(G.force(f.S, E, false), 45);    // Fusion Rifle (tier 3 counts as 4 → +20 instead of +5)
    t.eq(M.Data.Techs.groundBonus(E.mods.ground), 45);
    Rs.grant(f.S, E, 1, 17, 'test'); t.eq(G.force(f.S, E, true), 55);       // Zortium (armor tier 2: +10 instead of +5) + defender +5
  });
  t.test('Bulrathi: +25 whether attacking or defending (research/01 §4.5)', () => {
    const f = fx('bul', { race: 'bulrathi' });
    t.eq(G.force(f.S, f.att, false), 25); t.eq(G.force(f.S, f.att, true), 30);
    t.eq(G.force(f.S, f.def, false), 0); t.eq(G.force(f.S, f.def, true), 5);
  });

  // =================================================================================================================================
  // the exchange / the fight
  // =================================================================================================================================
  const OSG = { 0: 1, 5: 1.25, 10: 1.5, 15: 1.8, 20: 2.15, 25: 2.6, 30: 3.1, 35: 3.75, 40: 4.55, 45: 5.6, 50: 7, 55: 8.8, 60: 11.35, 65: 15.1, 70: 20.2, 75: 30.15 };
  t.test('exchange odds reproduce the OSG kill-ratio table (Table 8-11) within 5% (ties go to the defender)', () => {
    for (const A in OSG) {
      const e = G.exchange(+A, 0), ratio = e.pa / (e.pd + e.pt);
      t.between(ratio / OSG[A], 0.95, 1.05, `advantage ${A}: ratio ${ratio.toFixed(3)} vs ${OSG[A]}`);
    }
  });
  t.test('exchange: probabilities sum to 1 and a tie costs the attacker', () => {
    for (const [fa, fd] of [[0, 0], [25, 5], [0, 30], [30, 0], [150, 0], [0, 150]]) {
      const e = G.exchange(fa, fd); t.near(e.pa + e.pt + e.pd, 1, 1e-12);
    }
    const e = G.exchange(0, 0); t.near(e.pa, 0.495, 1e-12); t.near(e.pt, 0.01, 1e-12);
    t.near(G.exchange(0, 99).pa, 0, 1e-12); t.near(G.exchange(0, 99).pt, 0.0001, 1e-12);       // the defender is 99 ahead: only a 100 against a 1 ties
    t.near(G.exchange(99, 0).pa, 0.9999, 1e-12); t.near(G.exchange(99, 0).pd, 0, 1e-12); t.near(G.exchange(150, 0).pa, 1, 1e-12);
  });
  t.test('Monte-Carlo kill ratio: Bulrathi attacking (+25 vs defender +5 → advantage 20) ≈ 2.1:1 (OSG 2.15); equal forces ≈ 1:1', () => {
    const R = M.RNG.create('ratio'), N = 20000;
    const kills = (fa, fd) => { const r = G.fight(N, N, fa, fd, R, { rounds: false }); return (N - r.d) / (N - r.a); };
    t.between(kills(25, 5), 1.98, 2.2);
    t.between(kills(0, 0), 0.94, 1.03);
    t.between(kills(0, 30), 0.30, 0.345, 'Bulrathi DEFENDING against an untechnical attacker: 1 : 3.1');
    t.between(kills(60, 0), 10.5, 12.5, 'advantage 60 ≈ 11.35:1');
  });
  t.test('ties: defender wins them by default; "both" kills one each; v1.3 "classic" flips when a human is involved', () => {
    const R = M.RNG.create('ties'), N = 40000;
    const wins = opts => { let a = 0; for (let i = 0; i < N; i++) { const r = G.fight(1, 1, 0, 0, R, Object.assign({ rounds: false }, opts)); if (r.a === 1) a++; } return a / N; };
    t.between(wins({}), 0.485, 0.505);                                    // 0.495
    t.between(wins({ tie: 'classic', human: true }), 0.495, 0.515);         // 0.505
    t.between(wins({ tie: 'classic', human: false }), 0.485, 0.505);
    let both = 0; for (let i = 0; i < N; i++) { const r = G.fight(1, 1, 0, 0, R, { tie: 'both', rounds: false }); if (r.a === 0 && r.d === 0) both++; }
    t.between(both / N, 0.006, 0.014);                                    // one exchange in a hundred is a tie
  });
  t.test('odds() (exact DP) agrees with Monte-Carlo fights', () => {
    const R = M.RNG.create('odds');
    for (const [fa, fd, nA, nD] of [[10, 0, 40, 30], [0, 5, 30, 30], [25, 5, 12, 25], [0, 30, 100, 20]]) {
      const o = G.odds(fa, fd, nA, nD); let w = 0, sa = 0; const N = 3000;
      for (let i = 0; i < N; i++) { const r = G.fight(nA, nD, fa, fd, R, { rounds: false }); if (r.d === 0) { w++; sa += r.a; } }
      t.near(w / N, o.pWin, 0.03, `pWin ${fa}/${fd} ${nA}v${nD}`);
      if (w > 200) t.near(sa / w, o.expAttackers / o.pWin, Math.max(0.8, nA * 0.03), 'expected survivors');
    }
    const o = G.odds(0, 0, 1, 1); t.near(o.pWin, 0.495, 1e-9);
    t.near(G.odds(0, 0, 1, 1, { tie: 'both' }).pWin, 0.495, 1e-9);        // a mutual kill is no victory
    t.ok(G.odds(0, 0, 30, 30, { tie: 'both' }).pWin > G.odds(0, 0, 30, 30).pWin - 0.2);
    t.near(G.odds(40, 0, 10, 0).pWin, 1, 1e-12); t.near(G.odds(40, 0, 0, 10).pWin, 0, 1e-12);
  });
  t.test('fight record: sampled rounds start with both armies, end with the result, never exceed 160 entries and never grow', () => {
    const R = M.RNG.create('rounds');
    const big = G.fight(300, 300, 0, 0, R);
    t.ok(big.rounds.length <= 160 && big.rounds.length >= 100, 'length ' + big.rounds.length);
    t.deep(big.rounds[0], { a: 300, d: 300 }); t.deep(big.rounds[big.rounds.length - 1], { a: big.a, d: big.d });
    for (let i = 1; i < big.rounds.length; i++) t.ok(big.rounds[i].a <= big.rounds[i - 1].a && big.rounds[i].d <= big.rounds[i - 1].d);
    t.ok(big.a === 0 || big.d === 0); t.eq(big.exchanges, 600 - big.a - big.d);
    const small = G.fight(5, 3, 20, 0, R); t.eq(small.rounds.length, small.exchanges + 1);
    t.ok(G.fight(5, 3, 20, 0, R, { rounds: false }).rounds === null);
  });
  t.test('fight is deterministic for a seed', () => {
    const a = G.fight(120, 90, 10, 5, M.RNG.create('det')), b = G.fight(120, 90, 10, 5, M.RNG.create('det'));
    t.deep(a, b);
  });

  // =================================================================================================================================
  // the transports' gauntlet
  // =================================================================================================================================
  t.test('transport hit points: (armor tier + 1) × 15 → 15…105 (guide table available as a rule)', () => {
    t.deep(G.TRANSPORT_HP, [15, 30, 45, 60, 75, 90, 105]);
    t.deep([0, 1, 2, 3, 4, 5, 6].map(k => G.transportHp({ mods: { baseHp: k } })), [15, 30, 45, 60, 75, 90, 105]);
    rules({ transportHp: 'guide' }, () => t.deep([0, 1, 2, 3, 4, 5, 6].map(k => G.transportHp({ mods: { baseHp: k } })), [15, 22, 30, 37, 45, 52, 60]));
  });
  t.test('gauntlet vs missile bases: 24 shots per base, L = (computer − speed)·2 + 12 clamped 1..20, hits add the missile damage, killed = damage / hp', () => {
    const f = fx('gaunt', { planet: { bases: 10 } });                          // 10 Nuclear-Missile bases, defender computer Mark I
    let g = G.gauntlet(f.S, land(f, 100));
    t.eq(g.level, 12); t.eq(g.comp, 1); t.eq(g.hp, 15); t.eq(g.killed, 38.4); t.eq(g.survivors, 61.6);   // 240 shots × 12/20 × 4 dmg / 15 hp
    f.att.mods.transportSpeed = 3; g = G.gauntlet(f.S, land(f, 100));
    t.eq(g.level, 8); t.eq(g.killed, 25.6);                                    // bases are not scaled by speed — the accuracy drops instead
    f.att.mods.transportSpeed = 1; f.att.mods.baseHp = 2; g = G.gauntlet(f.S, land(f, 100));
    t.eq(g.hp, 45); t.eq(g.killed, 12.8);
    f.att.mods.baseHp = 6; g = G.gauntlet(f.S, land(f, 100)); t.eq(g.hp, 105); t.near(g.killed, 5.5, 0.05);
    t.eq(G.gauntlet(f.S, land(f, 3)).survivors, 0, 'a handful of transports is wiped out');
  });
  t.test('gauntlet survival rises with transport speed and with armor tier', () => {
    const f = fx('gaunt2', { planet: { bases: 20 } });
    const surv = (speed, tier) => { f.att.mods.transportSpeed = speed; f.att.mods.baseHp = tier; return G.gauntlet(f.S, land(f, 200)).survivors; };
    let prev = -1; for (let s = 1; s <= 8; s++) { const v = surv(s, 0); t.ok(v >= prev, 'speed ' + s); prev = v; }
    prev = -1; for (let a = 0; a <= 6; a++) { const v = surv(1, a); t.ok(v > prev, 'armor ' + a); prev = v; }
    t.ok(surv(7, 0) === surv(8, 0), 'accuracy bottoms out at 1/20');
  });
  t.test('gauntlet Monte-Carlo mean matches the expectation (bases)', () => {
    const f = fx('gaunt3', { planet: { bases: 10 } }), R = M.RNG.create('gmc'), ks = [];
    for (let i = 0; i < 400; i++) ks.push(G.runGauntlet(f.S, land(f, 100), R).killed);
    t.near(mean(ks), 38.4, 0.8);
    t.ok(ks.every(k => k >= 0 && k <= 100 && Number.isInteger(k)));
  });
  t.test('gauntlet vs warships in orbit: ammo −1 counts 4, shots scale (v·2)/speed, beams hit L/20 for 1..4, bombs and bio are ignored, the Death Ray too', () => {
    const f = fx('gaunt4');
    fleet(f, 1, 1, 30);                                                         // 30 Fighters: 1 Laser each, no computer → L = 10 at speed 1
    let g = G.gauntlet(f.S, land(f, 200));
    t.eq(g.level, 10); t.eq(g.killed, 20);                                      // 240 shots → 120 hits × 2.5 = 300 dmg / 15
    f.att.mods.transportSpeed = 2; g = G.gauntlet(f.S, land(f, 200));
    t.eq(g.level, 8); t.eq(g.killed, 8);                                        // 120 shots → 48 hits × 2.5 = 120 / 15
    f.att.mods.transportSpeed = 1;
    f.S.fleets = []; fleet(f, 1, 3, 10);                                        // 10 Bombers: the Nuclear Bombs do nothing, only the 2 Lasers shoot
    g = G.gauntlet(f.S, land(f, 200)); t.eq(g.shooters.length, 1); t.near(g.killed, 13.3, 0.05);
    f.S.fleets = []; fleet(f, 1, 5, 4);
    withDesigns({ '1:5': { weapons: [W('death-spores', 3, 0), W('nuclear-bomb', 2, 1), W('death-ray', 1, 2)] } }, () => {
      g = G.gauntlet(f.S, land(f, 100)); t.eq(g.killed, 0); t.eq(g.shooters.length, 0);
    });
  });
  t.test('gauntlet: torpedoes count half, scatter packs multiply by their warheads, missile racks use their ammo', () => {
    const f = fx('gaunt5');
    fleet(f, 1, 5, 5);
    withDesigns({ '1:5': { weapons: [W('anti-matter-torpedo', 4, 0)] } }, () => {      // 5·4·4 = 80 → halved 40 → ×2 = 80 shots × 10/20 × 30 dmg = 1200 → 80 transports
      t.eq(G.gauntlet(f.S, land(f, 200)).killed, 80);
    });
    withDesigns({ '1:5': { weapons: [W('nuclear-missile', 4, 0)] } }, () => {          // 5·4·2 = 40 → ×2 = 80 shots × 10/20 × 4 = 160 → 10.7
      t.near(G.gauntlet(f.S, land(f, 200)).killed, 10.7, 0.05);
    });
    withDesigns({ '1:5': { weapons: [W('scatter-pack-v', 1, 0)] } }, () => {           // 5·1·2·5 = 50 → ×2 = 100 shots × 10/20 × 6 = 300 → 20
      t.eq(G.gauntlet(f.S, land(f, 200)).killed, 20);
    });
    withDesigns({ '1:5': { weapons: [W('laser', 1, 0)] , compLevel: 4 } }, () => {      // a better computer raises the level: (4−1)·2+12 = 18
      t.eq(G.gauntlet(f.S, land(f, 200)).level, 18);
    });
  });
  t.test('gauntlet: only hostile ships shoot — the invader\'s own ships, allies and NAP partners of the invader do not', () => {
    const f = fx('gaunt6'), saved = M.Sim.Diplo;
    fleet(f, 2, 1, 30); fleet(f, 0, 1, 30);
    try {
      M.Sim.Diplo = { isAllied: () => false, atWar: () => false, status: () => ({ treaty: 'none' }) };
      t.eq(G.gauntlet(f.S, land(f, 200)).killed, 20, 'a bystander with no treaty fires; the invader\'s own Fighters never do');
      M.Sim.Diplo = { isAllied: (S, a, b) => (a === 2 && b === 0) || (a === 0 && b === 2), atWar: () => false, status: () => ({ treaty: 'alliance' }) };
      t.eq(G.gauntlet(f.S, land(f, 200)).killed, 0, 'allies of the invader stay out of it');
      M.Sim.Diplo = { isAllied: () => false, atWar: () => false, status: (S, a, b) => ({ treaty: 'non-aggression pact' }) };
      t.eq(G.gauntlet(f.S, land(f, 200)).killed, 0, 'NAP partners of the invader stay out of it');
    } finally { M.Sim.Diplo = saved; if (!saved) delete M.Sim.Diplo; }
  });
  t.test('Combat Transporters: every lost transport lands with 1/2, 1/4 against a Subspace Interdictor (v1.3 bug: only vs an interdictor, 62.5%)', () => {
    const f = fx('gaunt7', { planet: { bases: 20 } }), R = M.RNG.create('ct');
    const frac = () => { let k = 0, r = 0; for (let i = 0; i < 300; i++) { const g = G.runGauntlet(f.S, land(f, 400), R); k += g.killed; r += g.recovered; } return r / k; };
    t.near(frac(), 0, 0, 'no tech, no recovery');
    f.att.mods.combatTransporter = true; t.between(frac(), 0.47, 0.53);
    f.def.mods.interdictor = true; t.between(frac(), 0.22, 0.28);
    t.eq(G.gauntlet(f.S, land(f, 400)).recovered > 0, true);
    rules(G.CLASSIC_RULES, () => { t.between(frac(), 0.60, 0.65); f.def.mods.interdictor = false; t.near(frac(), 0, 0); });
  });
  t.test('a living monster or the Guardian at the planet kills every transport', () => {
    const f = fx('gaunt8');
    t.eq(G.gauntlet(f.S, land(f, 80)).survivors, 80);
    f.S.guardian = { alive: true, star: f.p.starId }; let g = G.gauntlet(f.S, land(f, 80));
    t.eq(g.survivors, 0); t.eq(g.monster, 'guardian'); f.S.guardian = { alive: false, star: f.p.starId };
    f.S.monsters = [{ star: f.p.starId, kind: 'amoeba', exists: true }]; g = G.gauntlet(f.S, land(f, 80)); t.eq(g.survivors, 0); t.eq(g.monster, 'monster');
    f.S.monsters = [{ star: f.p.starId, kind: 'amoeba', exists: true, killer: 1 }]; t.eq(G.gauntlet(f.S, land(f, 80)).survivors, 80);
  });

  // =================================================================================================================================
  // invasion bookkeeping
  // =================================================================================================================================
  t.test('conquest: owner, pop = survivors ≤ max pop, factories kept, bases/shield/stargate/queues/rebels gone, sliders 100% Industry, operTier 1, news + war incident', () => {
    const f = fx('conq', { planet: { pop: 20, factories: 77, bases: 3, shield: 10, stargate: true, rebels: 5, unrest: 1, bank: 33, trans: { to: 0, n: 3 }, mp3: 40, build: 2, reloc: 0 } });
    f.p.acc.ship = 50;
    const rec = G.invade(f.S, land(f, 250), f.R);
    t.ok(rec.success && rec.survivors > 40, 'overwhelming landing wins: ' + JSON.stringify([rec.landed, rec.survivors]));
    t.eq(f.p.owner, 0); t.eq(f.p.pop, 40, 'clamped to the maximum population'); t.eq(f.p.factories, 77); t.eq(rec.captured.factories, 77);
    t.eq(f.p.bases, 0); t.eq(f.p.shield, 0); t.eq(f.p.stargate, false); t.eq(f.p.rebels, 0); t.eq(f.p.unrest, 0); t.eq(f.p.bank, 0); t.eq(f.p.trans, null); t.eq(f.p.acc.ship, 0);
    t.deep(f.p.sliders, [0, 0, 100, 0, 0]); t.eq(f.p.operTier, 1); t.eq(f.p.reloc, f.p.starId); t.ok(f.att.designs[f.p.build]);
    t.eq(rec.attacker, 0); t.eq(rec.defender, 1); t.eq(rec.planet, f.p.id); t.eq(rec.defenders, 20); t.eq(rec.defendersLeft, 0);
    const n = evs(f.S, 'news', 'invasionSuccess'); t.eq(n.length, 1); t.eq(n[0].empire, 0); t.eq(n[0].empire2, 1); t.eq(n[0].planet, f.p.id);
    const inc = evs(f.S, 'incident', 'capture'); t.eq(inc.length, 1); t.ok(inc[0].from === 0 && inc[0].to === 1 && inc[0].planet === f.p.id, JSON.stringify(inc));
    t.eq(rec.visible, true); t.eq(rec.attackerHuman, true); t.eq(rec.defenderHuman, false);
    t.ok(f.S.empires[1].alive, 'a colony ship in flight keeps the defender alive'); t.eq(rec.eliminated, false);
  });
  t.test('conquest by an AI of an AI planet is an "aiGround" incident (Diplo charges 4+rnd 4), never a capture', () => {
    const f = fx('conq2'); const E2 = f.other;
    t.eq(G.invade(JSON.parse(JSON.stringify(f.S)), { kind: 'invade', empire: 2, target: 1, planet: f.p.id, n: 200 }, M.RNG.create('q')), null, 'AI-vs-AI fights are not shown to the human: invade() returns null unless asked');
    const rec = G.invade(f.S, { kind: 'invade', empire: 2, target: 1, planet: f.p.id, n: 200 }, f.R, true);
    t.ok(rec.success); t.eq(f.p.owner, 2); t.eq(rec.visible, false); t.eq(f.S.groundLog.length, 1); t.eq(f.S.groundLog[0].success, true); t.eq(f.S.groundLog[0].attacker, 2);
    t.eq(evs(f.S, 'incident', 'aiGround').length, 1); t.eq(evs(f.S, 'incident', 'capture').length, 0); t.ok(E2.alive);
  });
  t.test('a failed landing: defenders keep the planet minus their losses, news "repelled" from the defender\'s side, a popKilled incident carrying the pop killed (Diplo: −(5+rnd 5) each)', () => {
    const f = fx('fail'), before = f.p.pop;
    const rec = G.invade(f.S, land(f, 8), f.R);
    t.eq(rec.success, false); t.eq(rec.survivors, 0); t.eq(f.p.owner, 1); t.ok(f.p.pop < before && f.p.pop === rec.defendersLeft && rec.defendersLeft > 0);
    const n = evs(f.S, 'news', 'invasionRepelled'); t.eq(n.length, 1); t.eq(n[0].empire, 1); t.eq(n[0].empire2, 0);
    const killed = before - f.p.pop, inc = evs(f.S, 'incident', 'popKilled')[0];
    if (killed > 0) t.eq(inc.magnitude, killed); else t.ok(!inc);
    t.eq(evs(f.S, 'news', 'invasionSuccess').length, 0);
  });
  t.test('an invasion fleet shot to pieces by the bases lands nothing and says so', () => {
    const f = fx('gone', { planet: { bases: 40 } });
    const rec = G.invade(f.S, land(f, 20), f.R);
    t.eq(rec.landed, 0); t.eq(rec.success, false); t.eq(rec.rounds.length, 1); t.eq(f.p.pop, 50); t.eq(f.p.owner, 1);
    t.eq(evs(f.S, 'news', 'invasionRepelled').length, 1);
  });
  t.test('at most 300 troops land per planet per turn per attacker; the excess is lost; later landings share the same room', () => {
    const f = fx('cap', { planet: { pop: 5 } });
    let rec = G.resolve(f.S, land(f, 400), f.R); t.eq(rec.arrived, 400); t.eq(rec.landed, 300); t.eq(rec.overflow, 100);
    const g = fx('cap2', { planet: { pop: 280, mp3: 300 } });
    const r1 = G.invade(g.S, land(g, 200), g.R); t.eq(r1.landed, 200); t.eq(r1.success, false);
    const r2 = G.invade(g.S, land(g, 200), g.R); t.eq(r2.landed, 100); t.eq(r2.overflow, 100);
    g.S.turn += 1; const r3 = G.resolve(g.S, land(g, 200), g.R); t.eq(r3.landed, 200, 'a new turn resets the room');
  });
  t.test('resolve() is pure: S is untouched and the result is what invade() then applies', () => {
    const f = fx('pure', { planet: { factories: 300 } });
    const before = JSON.stringify(f.S), st = f.S.rs.slice();
    const a = G.resolve(f.S, land(f, 120), M.RNG.create('x'));
    t.eq(JSON.stringify(f.S), before); t.deep(f.S.rs, st);
    const b = G.resolve(f.S, land(f, 120), M.RNG.create('x')); t.deep(a, b, 'same seed → same war');
    const c = JSON.parse(JSON.stringify(f.S)), R = M.RNG.create('x');
    const applied = G.invade(c, land(f, 120), R); t.deep(applied, a);
  });
  t.test('a landing on a planet the invader already owns (taken earlier in the turn) simply reinforces it', () => {
    const f = fx('twice');
    const r1 = G.invade(f.S, land(f, 250), f.R); t.ok(r1.success); const pop = f.p.pop;
    const r2 = G.invade(f.S, land(f, 10), f.R); t.eq(r2, null); t.eq(f.p.pop, Math.min(pop + 10, f.p.mp3));
    const lost = G.invade(f.S, { kind: 'invade', empire: 0, target: -1, planet: S_unowned(f).id, n: 5 }, f.R); t.eq(lost, null);
    function S_unowned(fx_) { return fx_.S.planets.find(q => q.owner < 0 && q.typeIdx > 0); }
  });
  t.test('eliminating an empire: last planet taken and no colony ship left → genocide incident and the death check fires', () => {
    const f = fx('elim'); f.S.fleets = f.S.fleets.filter(fl => fl.owner !== 1);
    const rec = G.invade(f.S, land(f, 250), f.R);
    t.ok(rec.success); t.eq(rec.eliminated, true); t.eq(f.def.alive, false);
    t.eq(evs(f.S, 'empireDestroyed').length, 1); t.eq(evs(f.S, 'incident', 'genocide').length, 0, 'the genocide penalty belongs to Events.coups');
  });
  t.test('relations incidents only concern AI victims: nothing for a human defender; bio is still reported (it offends every other AI)', () => {
    const f = fx('hum'), land2 = n => ({ kind: 'invade', empire: 1, target: 0, planet: f.S.planets[f.att.capital].id, n });
    const rec = G.invade(f.S, land2(250), f.R); t.ok(rec.success); t.eq(rec.defenderHuman, true); t.eq(evs(f.S, 'incident').length, 0);
    const g = bioFx('hum2', 'bio-terminator', 5); g.def.human = true; g.S.empires[0].human = false;
    withDesigns(g.designs, () => { g.S.bombard = [{ empire: 0, planet: g.p.id, yes: true }]; G.bombard(g.S, g.R); });
    const bio = evs(g.S, 'incident', 'bio'); t.eq(bio.length, 1); t.ok(bio[0].from === 0 && bio[0].to === 1);
  });
  t.test('an owned planet without population (the work of a Space Crystal) falls to the first troops that land', () => {
    const f = fx('empty', { planet: { pop: 0, factories: 40 } });
    const rec = G.invade(f.S, land(f, 5), f.R);
    t.eq(rec.success, true); t.eq(rec.defenders, 0); t.eq(rec.exchanges, 0); t.eq(rec.survivors, 5); t.eq(f.p.owner, 0); t.eq(f.p.pop, 5); t.eq(f.p.factories, 40);
  });
  t.test('the real diplomacy engine drains the incidents: a human taking an AI planet costs 51..100 DP and starts a war; bio costs every AI 10', () => {
    const Dp = M.Sim.Diplo; if (!Dp || !Dp.turn) t.skip('no diplomacy module');
    const f = fx('diplo'), before = Dp.status(f.S, 1, 0).attitude;
    t.eq(Dp.status(f.S, 1, 0).atWar, false);
    const rec = G.invade(f.S, land(f, 250), f.R); t.ok(rec.success);
    Dp.turn(f.S, f.R);
    const st = Dp.status(f.S, 1, 0); t.eq(st.atWar, true, 'the AI declares war on the conqueror'); t.ok(st.attitude <= Math.min(before, -25), 'attitude ' + before + ' → ' + st.attitude);
    t.eq(evs(f.S, 'incident').length, 0, 'drained');
    const g = bioFx('diplo2', 'bio-terminator', 5);
    withDesigns(g.designs, () => { g.S.bombard = [{ empire: 0, planet: g.p.id, yes: true }]; G.bombard(g.S, g.R); });
    const a0 = Dp.status(g.S, 2, 0).attitude; Dp.turn(g.S, g.R);
    t.ok(Dp.status(g.S, 2, 0).attitude < a0, 'bio bombing offends a bystander too');
  });
  t.test('allied or unowned targets: the transports are lost, no fight', () => {
    const f = fx('ally'), saved = M.Sim.Diplo;
    try {
      M.Sim.Diplo = { isAllied: (S, a, b) => a !== b, atWar: () => false, status: () => ({ treaty: 'alliance' }) };
      t.eq(G.resolve(f.S, land(f, 50), f.R), null);
      t.eq(G.invade(f.S, land(f, 50), f.R), null); t.eq(f.p.owner, 1);
      t.eq(evs(f.S, 'notice', 'transportLost').length, 1);
    } finally { if (saved) M.Sim.Diplo = saved; else delete M.Sim.Diplo; }
  });
  t.test('a human victim gets a notice about the bombardment; the record carries the numbers for the bombardment scene', () => {
    const f = bomberFx('note'); f.S.empires[0].human = false; f.def.human = true;
    f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; const ev = G.bombard(f.S, f.R);
    t.eq(ev.length, 1); t.eq(ev[0].victimHuman, true); t.eq(ev[0].attackerHuman, false);
    const n = evs(f.S, 'notice', 'bombarded'); t.eq(n.length, 1); t.eq(n[0].empire, 1); t.eq(n[0].by, 0); t.eq(n[0].popKilled, ev[0].popKilled);
    for (const k of ['popBefore', 'popKilled', 'factoriesBefore', 'factoriesKilled', 'popLeft', 'factoriesLeft', 'destroyed', 'ineffective', 'planetName', 'shield', 'comp']) t.ok(k in ev[0], k);
  });
  t.test('estimate(): gauntlet expectation + forces + exact odds for a landing that has not happened yet', () => {
    const f = fx('est', { planet: { bases: 10 } });
    const e = G.estimate(f.S, 0, f.p.id, 200);
    t.eq(e.gauntlet.killed, 38.4); t.eq(e.landed, 162); t.eq(e.defenders, 50); t.deep(e.force, { a: 0, d: 5 });
    t.near(e.pWin, G.odds(0, 5, 162, 50).pWin, 1e-12); t.ok(e.pWin > 0.99);
    t.ok(G.estimate(f.S, 0, f.p.id, 40).pWin < 0.1, '40 transports against 50 defenders, bases first: hopeless');
  });
  t.test('the Turn pipeline lands the transports, yields a ground interrupt and the news reaches GNN', () => {
    const f = fx('turn'), st = f.S.stars[f.p.starId];
    f.S.trans.push({ id: 991, owner: 0, from: f.att.capital, to: f.p.starId, n: 70, x: st.x, y: st.y, speed: 1 });
    const rep = M.Sim.autoTurn(f.S);
    t.ok(rep.events.indexOf('ground') >= 0, rep.events.join(','));
    t.eq(f.p.owner, 0); t.eq(f.S.trans.length, 0);
    t.ok(f.S.newsLog.some(n => n.cat === 'invasionSuccess'));
  });

  // =================================================================================================================================
  // tech capture
  // =================================================================================================================================
  const give = (S, E, list) => { for (const [fl, lv] of list) Rs.grant(S, E, fl, lv, 'test'); };
  const RICH = [[0, 5], [0, 8], [0, 10], [1, 10], [1, 17], [2, 4], [2, 12], [3, 2], [3, 5], [4, 6], [4, 12], [5, 4], [5, 8], [5, 11], [5, 36]];
  t.test('capture rolls: one 1-in-50 chance per captured factory (mean F/50, P(≥1) = 1 − 0.98^F)', () => {
    const R = M.RNG.create('theft'), N = 4000;
    for (const F of [0, 30, 50, 100]) {
      const xs = []; for (let i = 0; i < N; i++) xs.push(G.theftRolls(F, R));
      t.near(mean(xs), F / 50, 0.07, 'mean at ' + F);
      t.near(xs.filter(x => x > 0).length / N, 1 - Math.pow(0.98, F), 0.03, 'P(≥1) at ' + F);
    }
  });
  t.test('invade(): a 30-factory conquest steals ≥1 tech 45% of the time; at most 6 per conquest; stolen techs are granted to the conqueror', () => {
    const f = fx('thief', { planet: { factories: 30 } }); give(f.S, f.def, RICH);
    const R = M.RNG.create('tt'); let any = 0; const N = 500;
    for (let i = 0; i < N; i++) { const rec = G.resolve(f.S, land(f, 250), R); t.ok(rec.success); if (rec.captured.techs.length) any++; t.ok(rec.captured.techs.length <= 6); }
    t.near(any / N, 1 - Math.pow(0.98, 30), 0.07);
    const g = fx('thief2', { planet: { factories: 2700 } }); give(g.S, g.def, RICH);
    const rec = G.invade(g.S, land(g, 250), g.R);
    t.eq(rec.captured.techs.length, 6); t.eq(new Set(rec.captured.techs.map(x => x.id)).size, 6);
    for (const tc of rec.captured.techs) { t.ok(g.att.research.completed[tc.field].indexOf(tc.level) >= 0, 'granted ' + tc.id); t.ok(g.def.research.completed[tc.field].indexOf(tc.level) >= 0); }
    t.eq(evs(g.S, 'tech').filter(e => e.empire === 0).length, 6);
  });
  t.test('techCandidates: only techs the victim has and the thief lacks; ≤ 6; no level-1 techs; deterministic; Death Ray is worth 30000', () => {
    const f = fx('cand'); give(f.S, f.def, RICH);
    const c = G.techCandidates(f.S, 0, 1, M.RNG.create('c')), c2 = G.techCandidates(f.S, 0, 1, M.RNG.create('c'));
    t.deep(c, c2); t.eq(c.length, 6); t.eq(new Set(c.map(x => x.id)).size, 6);
    for (const x of c) { t.ok(x.level > 1); t.ok(f.def.research.completed[x.field].indexOf(x.level) >= 0); t.ok(f.att.research.completed[x.field].indexOf(x.level) < 0); t.ok(x.value > 0); }
    const all = G.techCandidates(f.S, 0, 1, M.RNG.create('c'), { max: 99 }); t.ok(all.length > 6 && all.length <= RICH.length);
    const dr = all.find(x => x.id === 'we-36-death-ray'); t.ok(dr && dr.value === 30000);
    t.ok(G.techCandidates(f.S, 0, 1, M.RNG.create('c'), { max: 99, maxLevel: 10 }).every(x => x.level <= 10));
    t.eq(G.techCandidates(f.S, 1, 0, M.RNG.create('c')).length, 0, 'nothing to take from somebody who knows less');
  });
  t.test('techCandidates: a thief owning an equal-or-higher tier of a group (robotic controls, shields, …) cannot take the lower tiers; equal level is worthless', () => {
    const f = fx('group'); give(f.S, f.def, [[0, 8], [0, 18], [0, 28], [2, 8], [2, 21]]); give(f.S, f.att, [[0, 18], [2, 21]]);
    const ids = G.techCandidates(f.S, 0, 1, M.RNG.create('g'), { max: 99 }).map(x => x.id);
    t.ok(ids.indexOf('cm-28-robotic-controls-5') >= 0, 'higher tier is stealable');
    t.ok(ids.indexOf('cm-08-robotic-controls-3') < 0 && ids.indexOf('cm-18-robotic-controls-4') < 0, 'lower or equal robotic tier is not');
    t.ok(ids.indexOf('ff-08-personal-deflector') < 0 && ids.indexOf('ff-21-personal-absorption-shield') < 0, 'personal shields: thief has the better one');
  });
  t.test('techCandidates: a Silicoid thief never receives waste / environment / eco techs', () => {
    const f = fx('sil'); f.att.race = 'silicoid'; give(f.S, f.def, [[1, 5], [1, 15], [3, 3], [3, 5], [3, 16], [1, 10], [0, 5]]);
    const ids = G.techCandidates(f.S, 0, 1, M.RNG.create('s'), { max: 99 }).map(x => x.id);
    t.ok(ids.length > 0 && ids.indexOf('cn-10-duralloy-armor') >= 0 && ids.indexOf('cm-05-battle-computer-2') >= 0);
    for (const bad of ['cn-05-', 'cn-15-', 'pl-03-', 'pl-05-', 'pl-16-']) t.ok(!ids.some(i => i.indexOf(bad) === 0), bad);
  });
  t.test('stealTechs grants through Research.grant with the given source', () => {
    const f = fx('steal'); give(f.S, f.def, RICH);
    const got = G.stealTechs(f.S, 0, 1, 3, M.RNG.create('st'), 'spy');
    t.eq(got.length, 3); t.eq(evs(f.S, 'tech').filter(e => e.source === 'spy' && e.empire === 0).length, 3);
    for (const x of got) t.ok(f.att.research.completed[x.field].indexOf(x.level) >= 0);
  });

  // =================================================================================================================================
  // orbital bombardment
  // =================================================================================================================================
  const expectFP = (dmg, fact, pop, bio) => {                                                          // the spec's divisors, written out
    let sf = 0, sp = 0;
    for (let k = 41; k <= 60; k++) sf += Math.min(fact, Math.floor(dmg / k));
    for (let k = 161; k <= 240; k++) sp += Math.min(pop, Math.floor(dmg / k) + (bio || 0));
    return { fact: sf / 20, pop: sp / 80 };
  };
  t.test('bombard: shots, computer and damage rolls — Bombers: 200 bomb + 600 laser shots, no computer → 4/20 hits; 40 bomb rolls of 3..12 and 120 halved-laser rolls', () => {
    const f = bomberFx('b1');
    const pv = G.bombPreview(f.S, 0, f.p.id);
    t.eq(pv.canBomb, true); t.eq(pv.comp, 4); t.eq(pv.ships, 10); t.eq(pv.pop, 50); t.eq(pv.factories, 30);
    t.eq(pv.expected.damage, 420);                                           // 40·7.5 + 120·1.0
    const e = expectFP(420, 30, 50, 0); t.near(pv.expected.factoriesKilled, e.fact, 0.06); t.near(pv.expected.popKilled, e.pop, 0.06);
    t.eq(pv.expected.bioKilled, 0); t.eq(pv.bio, false); t.eq(pv.bombs, true); t.deep(pv.expectedKills, { pop: pv.expected.popKilled, factories: pv.expected.factoriesKilled, bio: 0 });
  });
  t.test('bombard Monte-Carlo: mean pop and factory losses follow total damage / (41..60) and / (161..240)', () => {
    const f = bomberFx('b2'), F0 = 30, P0 = 50, fs = [], ps = [];
    for (let i = 0; i < 500; i++) {
      f.p.pop = P0; f.p.factories = F0; f.p.mp3 = 100; f.S.ev = []; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }];
      const ev = G.bombard(f.S, f.R)[0]; fs.push(ev.factoriesKilled); ps.push(ev.popKilled);
      t.ok(ev.type === 'bombard' && ev.popLeft === f.p.pop && ev.factoriesLeft === f.p.factories);
    }
    const e = expectFP(420, F0, P0, 0);
    t.near(mean(fs), e.fact, 0.35); t.near(mean(ps), e.pop, 0.2);
  });
  t.test('bombard: the divisors — for a known total damage each loss lies in floor(D/60)..floor(D/41) and floor(D/240)..floor(D/161)', () => {
    const f = bomberFx('b3');
    for (let i = 0; i < 200; i++) {
      f.p.pop = 50; f.p.factories = 30; f.S.ev = []; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }];
      const ev = G.bombard(f.S, f.R)[0], D_ = ev.damage;
      t.between(ev.factoriesKilled, Math.min(30, Math.floor(D_ / 60)), Math.min(30, Math.floor(D_ / 41)));
      t.between(ev.popKilled, Math.min(50, Math.floor(D_ / 240)), Math.min(50, Math.floor(D_ / 161)));
    }
  });
  t.test('bombard: computer attack level → hits in 20 = clamp((Mark − 1)·2 + 6, 1, 20): Mark I 6, V 14, VIII 20, XI 20; none → 4', () => {
    const f = bomberFx('b4');
    const comp = lvl => { let r; withDesigns({ '0:3': { weapons: [W('nuclear-bomb', 2, 0)], compLevel: lvl } }, () => { r = G.canBombard(f.S, 0, f.p.id).comp; }); return r; };
    t.deep([0, 1, 2, 5, 8, 11].map(comp), [4, 6, 8, 14, 20, 20]);
  });
  t.test('bombard: computer bonus counts the ships in orbit (v1.3: the best computer of ANY design)', () => {
    const f = bomberFx('b5');
    withDesigns({ '0:3': { weapons: [W('nuclear-bomb', 2, 0)], compLevel: 1 }, '0:4': { weapons: [], compLevel: 7 } }, () => {
      t.eq(G.canBombard(f.S, 0, f.p.id).comp, 6);
      rules(G.CLASSIC_RULES, () => t.eq(G.canBombard(f.S, 0, f.p.id).comp, 18));
    });
  });
  t.test('bombard: the planetary shield is deducted from every bomb/beam roll (Class V: 2.8 per Nuclear Bomb roll; beams ≤ 2 do nothing) and Class XX stops Nuclear Bombs', () => {
    const f = bomberFx('b6');
    f.p.shield = 5; let pv = G.bombPreview(f.S, 0, f.p.id); t.eq(pv.shield, 5); t.eq(pv.expected.damage, 112);        // 40 rolls × (0+0+0+1+…+7)/10
    f.p.shield = 20; pv = G.bombPreview(f.S, 0, f.p.id); t.eq(pv.expected.damage, 0); t.eq(pv.ineffective, true);
    f.S.stars[f.p.starId].nebula = true; pv = G.bombPreview(f.S, 0, f.p.id); t.eq(pv.shield, 0, 'shields do not work inside a nebula'); t.eq(pv.expected.damage, 420);
  });
  t.test('bombard: torpedoes are halved against planets (v1.3: plain missiles), scatter packs multiply, the shield is subtracted once; ammo −1 counts 30 shots, racks their ammo', () => {
    const f = bomberFx('b7');
    const dmg = (weapons, comp) => { let r; withDesigns({ '0:3': { weapons, compLevel: comp || 0 } }, () => { r = G.bombPreview(f.S, 0, f.p.id).expected.damage; }); return r; };
    t.eq(dmg([W('anti-matter-torpedo', 1, 0)]), 900);        // 10·1·30 = 300 shots → 10 rolls × 30 × 4/20 × (30/2)
    t.eq(dmg([W('nuclear-missile', 1, 0)]), 16);              // 10·1·2 = 20 shots → 10 × 2 × 4/20 × 4
    t.eq(dmg([W('scatter-pack-v', 1, 0)]), 120);              // 20 shots → 10 × 2 × 0.2 × (6 × 5)
    f.p.shield = 5; t.eq(dmg([W('scatter-pack-v', 1, 0)]), 100);   // (30 − 5) once per hit
    f.p.shield = 20; t.eq(dmg([W('nuclear-missile', 1, 0)]), 0);
    f.p.shield = 0;
    rules(G.CLASSIC_RULES, () => { t.eq(dmg([W('anti-matter-torpedo', 1, 0)]), 1800); t.eq(dmg([W('nuclear-missile', 1, 0)]), 8); });
  });
  t.test('bombard: all four weapon banks count (v1.3: the first three); the Death Ray and monster weapons never bombard', () => {
    const f = bomberFx('b8');
    withDesigns({ '0:3': { weapons: [W('nuclear-bomb', 2, 3)] } }, () => {
      t.eq(G.canBombard(f.S, 0, f.p.id).ok, true);
      rules(G.CLASSIC_RULES, () => { const c = G.canBombard(f.S, 0, f.p.id); t.eq(c.ok, false); t.eq(c.reason, 'no armed ships'); });
    });
    withDesigns({ '0:3': { weapons: [W('death-ray', 1, 0), W('crystal-ray', 1, 1)] } }, () => t.eq(G.canBombard(f.S, 0, f.p.id).ok, false));
  });
  t.test('bio weapons: expected kills per weapon and antidote (Death Spores 0-1, Doom Virus 0-2, Bio Terminator 0-3 minus the antidote per hit)', () => {
    const want = { 'death-spores': [25, 0, 0], 'doom-virus': [50, 50 / 3, 0], 'bio-terminator': [75, 37.5, 12.5] };      // 10 rolls × 25 × (4/20) × E[max(0, k − antidote)]
    for (const id in want) {
      const f = bioFx('bio-' + id, id, 5);
      withDesigns(f.designs, () => {
        for (let a = 0; a <= 2; a++) {
          f.def.mods.antidote = a; const pv = G.bombPreview(f.S, 0, f.p.id);
          t.near(pv.expected.bioKilled, want[id][a], 0.06, id + ' antidote ' + a); t.eq(pv.antidote, a); t.eq(pv.bio, true);
          t.near(pv.expected.maxPopLoss, want[id][a], 0.06);
        }
      });
    }
  });
  t.test('bio weapons: Monte-Carlo kills with and without antidotes; they ignore planetary shields and never hurt factories', () => {
    const f = bioFx('bio-mc', 'doom-virus', 5);
    withDesigns(f.designs, () => {
      f.p.shield = 20;
      for (const [a, want] of [[0, 50], [1, 50 / 3], [2, 0]]) {
        f.def.mods.antidote = a; const ks = [];
        for (let i = 0; i < 500; i++) {
          f.p.pop = 1000; f.p.factories = 100; f.p.mp3 = 1000; f.S.ev = []; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }];
          const ev = G.bombard(f.S, f.R)[0]; ks.push(ev.bioKilled);
          t.eq(ev.factoriesKilled, 0); t.eq(f.p.factories, 100); t.eq(f.p.pop, 1000 - ev.popKilled); t.eq(ev.popKilled, ev.bioKilled);
        }
        t.near(mean(ks), want, a === 0 ? 3.5 : 2.5, 'antidote ' + a);
        if (a === 2) t.ok(ks.every(k => k === 0));
      }
    });
  });
  t.test('bio weapons shrink the maximum population by the kills but never below 10 (and never raise a smaller maximum)', () => {
    const f = bioFx('bio-max', 'bio-terminator', 5);
    withDesigns(f.designs, () => {
      f.p.mp3 = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }];
      let ev = G.bombard(f.S, f.R)[0]; for (let i = 0; i < 30 && !(ev.maxPopLost > 0); i++) { f.p.mp3 = 1000; f.p.pop = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; ev = G.bombard(f.S, f.R)[0]; }
      t.ok(ev.maxPopLost > 0); t.eq(f.p.mp3, 1000 - ev.maxPopLost);
      f.p.mp3 = 12;
      for (let i = 0; i < 40 && f.p.mp3 > 10; i++) { f.p.pop = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; G.bombard(f.S, f.R); }
      t.eq(f.p.mp3, 10);
      for (let i = 0; i < 10; i++) { f.p.mp3 = 8; f.p.pop = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; G.bombard(f.S, f.R); t.eq(f.p.mp3, 8); }
    });
  });
  t.test('bombardment of a planet cancelled by the human leaves it alone (v1.3: the bio max-pop loss still happened)', () => {
    const f = bioFx('bio-cancel', 'bio-terminator', 5);
    withDesigns(f.designs, () => {
      for (let i = 0; i < 20; i++) { f.p.mp3 = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: false }]; t.eq(G.bombard(f.S, f.R).length, 0); t.eq(f.p.pop, 1000); t.eq(f.p.mp3, 1000); }
      rules(G.CLASSIC_RULES, () => {
        let shrank = false;
        for (let i = 0; i < 30 && !shrank; i++) { f.p.mp3 = 1000; f.S.bombard = [{ empire: 0, planet: f.p.id, yes: false }]; t.eq(G.bombard(f.S, f.R).length, 0); shrank = f.p.mp3 < 1000; t.eq(f.p.pop, 1000); }
        t.ok(shrank, 'the v1.3 bug: cancelled, yet the maximum population shrank');
      });
    });
  });
  t.test("bombardment incidents: one 'bio' incident (bio kills + pop lost) or one 'combat' incident (pop lost), plus news bombardment", () => {
    const f = bioFx('inc', 'bio-terminator', 5);
    withDesigns(f.designs, () => {
      f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; const ev = G.bombard(f.S, f.R)[0];
      t.ok(ev.bioKilled > 0);
      const bio = evs(f.S, 'incident', 'bio'); t.eq(bio.length, 1);
      t.ok(bio[0].from === 0 && bio[0].to === 1 && bio[0].bio === ev.bioKilled && bio[0].popLost === ev.popKilled && bio[0].planet === f.p.id, JSON.stringify(bio));
      t.eq(evs(f.S, 'incident', 'combat').length, 0);
      const n = evs(f.S, 'news', 'bombardment'); t.eq(n.length, 1); t.eq(n[0].empire, 0); t.eq(n[0].empire2, 1);
    });
    const g = bomberFx('inc2'); g.S.bombard = [{ empire: 0, planet: g.p.id, yes: true }]; const e2 = G.bombard(g.S, g.R)[0];
    const conv = evs(g.S, 'incident', 'combat'); if (e2.popKilled > 0) { t.eq(conv.length, 1); t.eq(conv[0].popLost, e2.popKilled); t.eq(conv[0].bio, 0); } else t.eq(conv.length, 0);
    t.eq(evs(g.S, 'incident', 'bio').length, 0);
  });
  t.test('bombarding to zero population destroys the planet: unowned and empty, news + war incident; the empire dies when it was the last planet and nothing can recolonise', () => {
    const f = bomberFx('dead', { planet: { pop: 1, factories: 10, bases: 2 } });
    f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }];
    withDesigns({ '0:3': { weapons: [W('neutronium-bomb', 10, 0)], compLevel: 8 } }, () => { const ev = G.bombard(f.S, f.R)[0]; t.eq(ev.destroyed, true); });
    t.eq(f.p.owner, -1); t.eq(f.p.pop, 0); t.eq(f.p.factories, 0); t.eq(f.p.bases, 0);
    t.eq(evs(f.S, 'news', 'planetDestroyed').length, 1); const inc = evs(f.S, 'incident', 'depopulate'); t.eq(inc.length, 1); t.ok(inc[0].from === 0 && inc[0].to === 1);
    t.eq(f.def.alive, true, 'the colony ship keeps them alive');
    const g = bomberFx('dead2', { planet: { pop: 1 } }); g.S.fleets = g.S.fleets.filter(fl => fl.owner !== 1); fleet(g, 0, 3, 10);
    g.S.bombard = [{ empire: 0, planet: g.p.id, yes: true }];
    withDesigns({ '0:3': { weapons: [W('neutronium-bomb', 10, 0)], compLevel: 8 } }, () => G.bombard(g.S, g.R));
    t.eq(g.def.alive, false); t.eq(evs(g.S, 'empireDestroyed').length, 1);
  });
  t.test('bombardment kills rebels too: rebels −= pop lost / 2 + 1 (never above the remaining pop)', () => {
    const f = bioFx('reb', 'bio-terminator', 5); f.p.rebels = 40; f.p.unrest = 1;
    withDesigns(f.designs, () => {
      f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; const ev = G.bombard(f.S, f.R)[0];
      t.ok(ev.popKilled > 0); t.eq(f.p.rebels, Math.max(0, 40 - (Math.floor(ev.popKilled / 2) + 1)));
    });
  });
  t.test('the human is asked: unanswered entries stay pending, answers come through the `bombard` order, AI empires decide by pop vs inbound transports', () => {
    const f = bomberFx('ask');
    f.S.bombard = [{ empire: 0, planet: f.p.id }];
    t.eq(G.bombard(f.S, f.R).length, 0); t.eq(f.S.bombard.length, 1, 'still pending');
    const pend = G.pending(f.S, 0); t.eq(pend.length, 1); t.eq(pend[0].preview.pop, 50);
    t.eq(M.Sim.Orders.apply(f.S, 0, { t: 'bombard', planet: f.p.id, yes: true }).ok, true);
    t.eq(f.S.bombard[0].yes, true); t.eq(G.pending(f.S, 0).length, 0);
    const ev = G.bombard(f.S, f.R); t.eq(ev.length, 1); t.eq(ev[0].empire, 0); t.eq(f.S.bombard.length, 0);
    // parked fleets are discovered even without a combat entry
    f.S.bombard = undefined; t.eq(G.pending(f.S, 0).length, 1);
    rules({ humanBombard: 'yes' }, () => t.eq(G.bombard(f.S, f.R).length, 1));
    rules({ humanBombard: 'no' }, () => t.eq(G.bombard(f.S, f.R).length, 0));
    t.eq(M.Sim.Orders.apply(f.S, 0, { t: 'bombard', planet: 0, yes: true }).ok, M.Sim.Fleet.at(f.S, 0, 0) !== null && f.S.planets[0].owner > 0, 'only where the fleet really sits');
  });
  t.test('AI bombing: bombs while pop > its own transports arriving this turn × invasion estimate (Bulrathi ×1.2); never a NAP partner', () => {
    const f = fx('ai'); fleet(f, 2, 3, 10);                         // empire 2 (AI) parks 10 Bombers over empire 1's capital
    const st = f.S.stars[f.p.starId], tr = n => { f.S.trans = [{ id: 7, owner: 2, from: 0, to: f.p.starId, n, x: st.x, y: st.y, speed: 1 }]; };
    f.p.pop = 45; tr(40); t.eq(G.inbound(f.S, 2, f.p), 40); t.eq(G.aiBombs(f.S, f.other, f.p), true);
    f.other.race = 'bulrathi'; t.eq(G.aiBombs(f.S, f.other, f.p), false, '45 > 40 × 1.2 is false'); f.p.pop = 49; t.eq(G.aiBombs(f.S, f.other, f.p), true);
    f.other.race = 'human'; f.p.pop = 30; t.eq(G.aiBombs(f.S, f.other, f.p), false); tr(0); t.eq(G.aiBombs(f.S, f.other, f.p), true);
    f.S.trans = [{ id: 7, owner: 2, from: 0, to: f.p.starId, n: 99, x: st.x + 40, y: st.y, speed: 1 }]; t.eq(G.inbound(f.S, 2, f.p), 99, 'transports still in flight count too (1oom game_turn_bomb)');
    f.S.trans = [{ id: 7, owner: 2, from: 0, to: f.p.starId, n: 10, x: st.x + 40, y: st.y, speed: 1 }, { id: 8, owner: 2, from: 0, to: f.p.starId, n: 15, x: st.x, y: st.y, speed: 1 }, { id: 9, owner: 2, from: 0, to: f.p.starId + 1, n: 50, x: st.x, y: st.y, speed: 1 }, { id: 10, owner: 0, from: 0, to: f.p.starId, n: 7, x: st.x, y: st.y, speed: 1 }];
    t.eq(G.inbound(f.S, 2, f.p), 25, 'all of this bomber\'s transports to this planet, nobody else\'s, none heading elsewhere');
    f.S.trans = []; f.p.pop = 30; f.S.bombard = undefined;
    t.eq(G.bombard(f.S, f.R, true).filter(e => e.empire === 2).length, 1, 'AI fleets in orbit bomb without being asked');
    f.p.pop = 30; f.S.bombard = undefined; t.eq(G.bombard(f.S, f.R).length, 0, 'AI-vs-AI bombardments are not reported to the human');
    const saved = M.Sim.Diplo;
    try {
      M.Sim.Diplo = { isAllied: () => false, atWar: () => false, status: () => ({ treaty: 'non-aggression pact' }) }; f.p.pop = 30; f.S.bombard = undefined;
      t.eq(G.bombard(f.S, f.R, true).filter(e => e.empire === 2).length, 0, 'AI keeps the pact');
      M.Sim.Diplo = { isAllied: (S, a, b) => a !== b, atWar: () => false, status: () => ({ treaty: 'alliance' }) };
      t.eq(G.canBombard(f.S, 2, f.p.id).ok, false); t.eq(G.canBombard(f.S, 2, f.p.id).reason, 'allied planet');
    } finally { if (saved) M.Sim.Diplo = saved; else delete M.Sim.Diplo; }
  });
  t.test('an AI never bombs a HUMAN it holds a ceasefire with (research/03-verification 2.9); with the ceasefire over it bombs again', () => {
    const f = fx('cf'); fleet(f, 2, 3, 10); f.def.human = true; f.p.pop = 30; f.S.bombard = undefined;
    const saved = M.Sim.Diplo;
    try {
      let cf = 5;
      M.Sim.Diplo = { isAllied: () => false, atWar: () => false, status: () => ({ treaty: 'none' }), ceasefire: () => cf };
      t.eq(G.bombard(f.S, f.R, true).filter(e => e.empire === 2).length, 0, 'ceasefire: no bombardment');
      cf = 0; f.S.bombard = undefined;
      t.eq(G.bombard(f.S, f.R, true).filter(e => e.empire === 2).length, 1, 'no ceasefire: bombs');
    } finally { if (saved) M.Sim.Diplo = saved; else delete M.Sim.Diplo; f.def.human = false; }
  });
  t.test('bombTargets lists what an empire can bomb; bombPreview explains why not', () => {
    const f = bomberFx('tg');
    t.deep(G.bombTargets(f.S, 0).map(x => x.planet), [f.p.id]); t.eq(G.bombTargets(f.S, 0)[0].bombs, true);
    t.deep(G.bombTargets(f.S, 2), []);
    const pv = G.bombPreview(f.S, 2, f.p.id); t.eq(pv.canBomb, false); t.eq(pv.reason, 'no ships in orbit');
    t.eq(G.bombPreview(f.S, 0, f.S.planets[f.att.capital].id).reason, 'not an enemy planet');
  });
  t.test('bombard is deterministic: same seed, same events and state', () => {
    const run = () => { const f = bomberFx('same'); f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; const e = G.bombard(f.S, f.R); return JSON.stringify([e, f.S.ev, f.p]); };
    t.eq(run(), run());
  });

  // =================================================================================================================================
  // rebellion, coups
  // =================================================================================================================================
  t.test('rebellion state: calm / unrest / rebellion; startRebellion puts half the pop in revolt and reports it', () => {
    const f = fx('rb1'), p = f.p;
    t.eq(G.rebelState(p), 'calm'); p.pop = 41; G.startRebellion(f.S, p);
    t.eq(p.unrest, 2); t.eq(p.rebels, 20); t.eq(G.rebelState(p), 'rebellion'); t.eq(G.rebels(p), 20); t.eq(G.unrest(p), 2);
    t.eq(evs(f.S, 'news', 'planetRebels').length, 1); t.eq(evs(f.S, 'news', 'planetRebels')[0].empire, 1);
    p.unrest = 1; t.eq(G.rebelState(p), 'unrest');
  });
  t.test('incite: rebels accumulate, the planet rebels once they reach half of the population (rebels = pop/2)', () => {
    const f = fx('rb2'), p = f.p; p.pop = 40;
    G.incite(f.S, p, 8); t.eq(p.rebels, 8); t.eq(p.unrest, 1);
    G.incite(f.S, p, 8); t.eq(p.rebels, 16); t.eq(p.unrest, 1);
    G.incite(f.S, p, 8); t.eq(p.rebels, 20); t.eq(p.unrest, 2);
    const before = p.rebels; G.incite(f.S, p, 50); t.eq(p.rebels, before, 'already in rebellion');
  });
  t.test('coupCheck: an empire is toppled when at least half of its planets rebel; applyCoup ends the rebellions and re-rolls an AI leader', () => {
    const f = fx('coup'), mine = f.S.planets.filter(q => q.owner < 0 && q.typeIdx > 0).slice(0, 3);
    for (const q of mine) { q.owner = 1; q.pop = 10; q.rebels = 0; q.unrest = 0; }
    t.deep(G.coupCheck(f.S), []);
    mine[0].unrest = 2; mine[0].rebels = 5;                     // 1 of 4 planets
    t.deep(G.coupCheck(f.S), []);
    mine[1].unrest = 2; mine[1].rebels = 5;                     // 2 of 4
    const c = G.coupCheck(f.S); t.eq(c.length, 1); t.deep([c[0].empire, c[0].rebelling, c[0].planets, c[0].human], [1, 2, 4, false]);
    const old = f.def.leader, R = M.RNG.create('cp'), out = G.applyCoup(f.S, 1, R);
    t.eq(out.gameOver, false); t.ok(out.newLeader !== old); t.between(f.def.personality, 0, 5); t.between(f.def.objective, 0, 5);
    t.ok(mine.every(q => q.unrest === 0 && q.rebels === 0)); t.deep(G.coupCheck(f.S), []);
    f.att.alive = true; const own = f.S.planets[f.att.capital]; own.unrest = 2; own.rebels = 5;
    const h = G.coupCheck(f.S).find(x => x.empire === 0); t.ok(h && h.human);
    const ho = G.applyCoup(f.S, 0, R); t.eq(ho.gameOver, true); t.eq(f.att.leader, ho.newLeader);
  });
  t.test('reclaim: loyal transports fight the rebels one-on-one — win: pop = pop − rebels + survivors; lose: the surviving rebels stay', () => {
    const f = fx('rcl'), p = f.S.planets[f.att.capital];
    p.pop = 60; p.rebels = 25; p.unrest = 2; p.mp3 = 100;
    const rec = G.reclaim(f.S, { empire: 0, planet: p.id, n: 80 }, f.R);
    t.eq(rec.rebellion, true); t.eq(rec.attacker, 0); t.eq(rec.defender, 0); t.eq(rec.defenders, 25); t.eq(rec.success, true);
    t.eq(p.rebels, 0); t.eq(p.unrest, 0); t.eq(p.pop, Math.min(100, 60 - 25 + rec.survivors)); t.deep(rec.force, { a: 0, d: 5 });
    p.pop = 60; p.rebels = 40; p.unrest = 2;
    const lose = G.reclaim(f.S, { empire: 0, planet: p.id, n: 3 }, f.R);
    t.eq(lose.success, false); t.eq(p.unrest, 2); t.eq(p.rebels, lose.defendersLeft); t.eq(p.pop, 60 - (40 - lose.defendersLeft));
    t.eq(G.reclaim(f.S, { empire: 1, planet: p.id, n: 3 }, f.R), null, 'not the owner');
  });
  t.test('transports that arrive on their own rebelling planet fight the rebels in bombard() before Fleet.landTransports adds anything', () => {
    const f = fx('rcl2'), p = f.S.planets[f.att.capital], st = f.S.stars[p.starId];
    p.pop = 60; p.rebels = 20; p.unrest = 2; p.mp3 = 100;
    const tr = { id: 55, owner: 0, from: f.p.starId, to: p.starId, n: 70, x: st.x, y: st.y, speed: 1 }; f.S.trans.push(tr);
    const out = G.bombard(f.S, f.R); const g = out.find(e => e.type === 'ground');
    t.ok(g && g.result.rebellion && g.result.success); t.eq(tr.n, 0); t.eq(p.unrest, 0); t.eq(p.rebels, 0);
    const pop = p.pop, landed = M.Sim.Fleet.landTransports(f.S, [tr]); t.eq(landed[0].kind, 'reinforce'); t.eq(p.pop, pop, 'nothing added twice');
    t.eq(G.invade(f.S, { empire: 0, planet: p.id, n: 5 }, f.R), null);
  });

  // =================================================================================================================================
  // the rule switches and determinism of whole wars
  // =================================================================================================================================
  t.test('useRules: defaults are the intended behaviour, CLASSIC_RULES the v1.3 quirks, useRules() restores the defaults', () => {
    t.eq(G.RULES.tie, 'defender'); t.eq(G.RULES.orbitalBanks, 4); t.eq(G.RULES.combatTransportersFixed, true);
    G.useRules(G.CLASSIC_RULES); t.eq(G.RULES.tie, 'classic'); t.eq(G.RULES.orbitalBanks, 3); t.eq(G.RULES.gauntletBaseComp, 'transport');
    G.useRules(); t.deep(G.RULES, G.DEFAULT_RULES);
  });
  t.test('classic gauntlet quirks: bases shoot with the TRANSPORT owner\'s computer; only the last design above the speed counts', () => {
    const f = fx('cl', { planet: { bases: 10 } });
    f.att.mods.baseComp = 5; f.def.mods.baseComp = 1;
    t.eq(G.gauntlet(f.S, land(f, 100)).comp, 1);
    rules(G.CLASSIC_RULES, () => { t.eq(G.gauntlet(f.S, land(f, 100)).comp, 5); t.eq(G.gauntlet(f.S, land(f, 100)).level, 20); });
  });
  t.test('a whole war is deterministic: two identical games, same invasions, bombardments and rebellions → identical state and events', () => {
    const run = () => {
      const f = bomberFx('war', { planet: { bases: 6, factories: 120 } }); give(f.S, f.def, RICH);
      const out = [];
      f.S.bombard = [{ empire: 0, planet: f.p.id, yes: true }]; out.push(G.bombard(f.S, f.R));
      out.push(G.invade(f.S, land(f, 150), f.R)); out.push(G.invade(f.S, land(f, 90), f.R));
      return JSON.stringify([out, f.S.ev, f.S.planets, f.S.groundTurn, f.S.rs]);
    };
    t.eq(run(), run());
  });
};
