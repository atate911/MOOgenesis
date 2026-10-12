// Ship components + design maths vs research/03 §1–§3, §6, §8 and research/02 §3 / Appendix C, research/04 §3.10, §4.1–4.2.
//   node tools/rules-test.js design
module.exports = function (M, t) {
  const D = M.Sim.Design, K = M.Data.Components, O = M.Sim.Orders, I = K.idx;
  const ALL = [].concat(K.COMPUTERS, K.ECM, K.SHIELDS, K.ARMOR, K.ENGINES, K.SPECIALS, K.WEAPONS);
  const mkE = (tl, completed, id) => ({
    id: id || 0, alive: true, human: true, race: 'human', bc: 0,
    research: { tl: (tl || [1, 1, 1, 1, 1, 1]).slice(), completed: (completed || [[1], [1], [1], [1], [1], [1]]).map(a => a.slice()) },
    mods: {}, grants: {}, designs: [null, null, null, null, null, null], dstats: [],
  });
  const mkS = (...es) => ({ empires: es, fleets: [], planets: [], trans: [], settings: { diffIdx: 2 } });
  const w = (id, count) => ({ type: I.weapons[id], count });
  const sp = (...ids) => ids.map(id => I.specials[id]);
  const draft = (hull, o) => Object.assign(D.blank(hull), o || {});
  const levels = n => Array.from({ length: n }, (_, i) => i + 1);

  // ------------------------------------------------------------------------------------------------------------------------------ tables
  t.test('tables: counts and shape (4 hulls, 9 engines, 11 computers, 10 ECM, 11 shields, 14 armors, 30 specials, 63 weapons)', () => {
    t.eq(K.HULLS.length, 4); t.eq(K.ENGINES.length, 9); t.eq(K.COMPUTERS.length, 11); t.eq(K.ECM.length, 10);
    t.eq(K.SHIELDS.length, 11); t.eq(K.ARMOR.length, 14); t.eq(K.SPECIALS.length, 30); t.eq(K.WEAPONS.length, 63);
    t.eq(K.T50.length, 51); t.eq(K.T25.length, 51);
    for (const list of [K.COMPUTERS, K.ECM, K.SHIELDS, K.ARMOR, K.SPECIALS]) for (const it of list) {
      for (const f of ['power', 'space', 'cost']) if (it[f] !== undefined) t.ok(Array.isArray(it[f]) && it[f].length === 4, it.id + '.' + f + ' must be [4]');
    }
    t.deep(K.HULLS.map(h => h.cost), [60, 360, 2000, 12000]); t.deep(K.HULLS.map(h => h.space), [40, 200, 1000, 5000]);
    t.deep(K.HULLS.map(h => h.hits), [3, 18, 100, 600]); t.deep(K.HULLS.map(h => h.power), [2, 15, 100, 700]);
    t.deep(K.HULLS.map(h => h.defense), [2, 1, 0, -1]); t.deep(K.HULLS.map(h => h.w), [1, 5, 25, 125]);
    t.eq(D.SLOTS, 6); t.eq(D.BANKS, 4); t.eq(D.SPEC_SLOTS, 3); t.eq(D.NAME_LEN, 12);
  });

  t.test('tables: per-hull values never shrink from Small to Huge; level sequences are monotone', () => {
    for (const it of ALL) for (const f of ['power', 'space', 'cost']) {
      const a = it[f]; if (!Array.isArray(a)) continue;
      for (let h = 1; h < 4; h++) t.ok(a[h] >= a[h - 1], it.id + '.' + f + ' ' + a);
    }
    for (const list of [K.COMPUTERS, K.ECM, K.SHIELDS, K.ENGINES]) for (let i = 1; i < list.length; i++) {
      t.ok(list[i].tech.l > list[i - 1].tech.l, list[i].id + ' tech'); t.ok(list[i].cost[3] === undefined ? list[i].cost > list[i - 1].cost : list[i].cost[2] > list[i - 1].cost[2], list[i].id + ' cost');
    }
    t.deep(K.ENGINES.map(e => e.warp), [1, 2, 3, 4, 5, 6, 7, 8, 9]); t.deep(K.ENGINES.map(e => e.power), [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    t.deep(K.ENGINES.map(e => e.space), [10, 18, 26, 33, 36, 40, 44, 47, 50]); t.deep(K.ENGINES.map(e => e.cost), [20, 40, 60, 80, 100, 120, 140, 160, 180]);
    t.deep(K.ENGINES.map(e => e.tech.l), [1, 6, 12, 18, 24, 30, 36, 42, 48]);
    t.deep(K.COMPUTERS.map(c => c.level), levels(11)); t.deep(K.COMPUTERS.map(c => c.tech.l), [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    t.deep(K.ECM.map(c => c.level), levels(10)); t.deep(K.ECM.map(c => c.tech.l), [2, 7, 12, 17, 22, 27, 32, 37, 42, 47]);
    t.deep(K.SHIELDS.map(c => c.absorb), [1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15]);                    // no Class VIII / X / XII / XIV
    t.deep(K.SHIELDS.map(c => c.tech.l), [1, 4, 10, 14, 20, 24, 30, 34, 40, 44, 50]);
    t.deep(K.ARMOR.map(a => a.pct), [100, 150, 150, 225, 200, 300, 250, 375, 300, 450, 350, 525, 400, 600]);
    t.deep(K.ARMOR.map(a => a.tech.l), [1, 1, 10, 10, 17, 17, 26, 26, 34, 34, 42, 42, 50, 50]);
    t.deep(K.ARMOR.map(a => a.heavy), [false, true, false, true, false, true, false, true, false, true, false, true, false, true]);
    t.deep(K.COMPUTERS[0].power, [5, 10, 20, 100]); t.deep(K.COMPUTERS[0].cost, [40, 200, 1000, 5000]); t.deep(K.COMPUTERS[10].cost, [140, 600, 3000, 15000]);
    t.deep(K.SHIELDS[3].space, [20, 65, 150, 675]); t.deep(K.ARMOR[13].cost, [180, 900, 4500, 25000]); t.deep(K.ARMOR[1].space, [20, 80, 400, 2000]);
    t.deep(K.ECM[9].cost, [50, 285, 1900, 11875]);
    // research fields: computers/ECM = 0, armor = 1, shields = 2, engines = 4
    for (const c of K.COMPUTERS.concat(K.ECM)) t.eq(c.tech.f, 0); for (const a of K.ARMOR) t.eq(a.tech.f, 1);
    for (const s of K.SHIELDS) t.eq(s.tech.f, 2); for (const e of K.ENGINES) t.eq(e.tech.f, 4);
  });

  t.test('tables: the 30 special devices (groups, fields, levels, colony bases, fixed values x4)', () => {
    const grp = [1, 2, 2, 2, 2, 2, 2, 2, 3, 4, 5, 6, 7, 8, 4, 9, 10, 11, 12, 13, 7, 14, 15, 4, 16, 9, 17, 8, 20, 21];
    const fld = [1, 3, 3, 3, 3, 3, 3, 3, 0, 5, 2, 4, 4, 4, 2, 1, 2, 2, 5, 4, 4, 2, 4, 2, 5, 1, 0, 4, 0, 4];
    const lvl = [1, 1, 3, 6, 9, 12, 15, 18, 1, 6, 16, 20, 16, 10, 31, 14, 37, 27, 21, 34, 40, 43, 38, 46, 47, 36, 49, 46, 46, 50];
    K.SPECIALS.forEach((s, i) => { t.eq(s.n, i + 1); t.eq(s.group, grp[i], s.id + ' group'); t.eq(s.tech.f, fld[i], s.id + ' field'); t.eq(s.tech.l, lvl[i], s.id + ' level'); });
    t.deep(K.SPECIALS.slice(1, 8).map(s => s.colonyMin), [7, 6, 5, 4, 3, 2, 1]);
    t.deep(K.SPECIALS.slice(1, 8).map(s => s.cost[0] / 10), [350, 375, 400, 425, 450, 475, 500]);
    for (const s of K.SPECIALS.slice(1, 8)) { t.deep(s.space, [700, 700, 700, 700]); t.eq(s.cost[0], s.cost[3]); }
    t.eq(K.SPECIALS.filter(s => s.colonyMin > 0).length, 7); t.eq(K.SPECIALS.filter(s => s.tanks).length, 1);
    t.deep(K.SPECIALS[I.specials['battle-scanner']].cost, [300, 300, 300, 300]); t.deep(K.SPECIALS[I.specials['battle-scanner']].power, [50, 50, 50, 50]);
    t.deep(K.SPECIALS[I.specials['inertial-stabilizer']].cost, [20, 75, 500, 2700]); t.deep(K.SPECIALS[I.specials['lightning-shield']].cost, [200, 300, 400, 500]);
    t.eq(K.SPECIALS[I.specials['zyro-shield']].fx.misshield, 75); t.eq(K.SPECIALS[I.specials['anti-missile-rockets']].fx.misshield, 40);
    t.eq(K.SPECIALS[I.specials['inertial-nullifier']].fx.extraman, 4); t.eq(K.SPECIALS[I.specials['advanced-damage-control']].fx.repair, 30);
    t.eq(K.SPECIALS[I.specials['high-energy-focus']].fx.extrarange, 3); t.eq(K.SPECIALS[I.specials['ionic-pulsar']].fx.pulsar, 2);
    t.eq(new Set(K.SPECIALS.map(s => s.id)).size, 30);
  });

  t.test('tables: 63 weapons in 1oom enum order; racks, ammo, flags', () => {
    K.WEAPONS.forEach((x, i) => t.eq(x.n, i + 1, x.id));
    t.eq(new Set(K.WEAPONS.map(x => x.id)).size, 63);
    for (const x of ALL) t.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id), 'kebab id ' + x.id);
    const by = id => K.WEAPONS[I.weapons[id]];
    t.eq(by('nuclear-missile').racks, 2); t.eq(by('nuclear-missile-5').racks, 5); t.eq(by('nuclear-missile').ammo, 2); t.eq(by('nuclear-missile-5').ammo, 5);
    t.eq(K.WEAPONS.filter(x => x.kind === 'missile').length, 22); t.eq(K.WEAPONS.filter(x => x.kind === 'torpedo').length, 4); t.eq(K.WEAPONS.filter(x => x.kind === 'bomb').length, 5);
    t.eq(K.WEAPONS.filter(x => x.kind === 'bio').length, 3); t.eq(K.WEAPONS.filter(x => x.kind === 'special').length, 2); t.eq(K.WEAPONS.filter(x => x.kind === 'beam').length, 27);
    t.eq(K.WEAPONS.filter(x => x.heavy).length, 6);
    t.deep(K.WEAPONS.filter(x => x.kind === 'bio').map(x => x.tech.f), [3, 3, 3]);
    for (const x of K.WEAPONS.filter(x => x.kind !== 'bio')) t.eq(x.tech.f, 5, x.id);
    t.deep(K.WEAPONS.filter(x => x.flags.halfShield).map(x => x.id), ['neutron-pellet-gun', 'mass-driver', 'hard-beam', 'gauss-autocannon', 'particle-beam']);
    t.deep(K.WEAPONS.filter(x => x.flags.streaming).map(x => x.id), ['graviton-beam', 'tachyon-beam', 'amoeba-stream']);
    t.deep(K.WEAPONS.filter(x => x.flags.everyOtherRound).map(x => x.id), ['anti-matter-torpedo', 'hellfire-torpedo', 'proton-torpedo', 'plasma-torpedo']);
    t.deep(K.WEAPONS.filter(x => x.mul === 4).map(x => x.id), ['hellfire-torpedo', 'stellar-converter', 'crystal-ray']);
    const l = by('laser'); t.deep(l.dmg, [1, 4]); t.eq(l.cost, 30); t.eq(l.space, 10); t.eq(l.power, 25); t.eq(l.range, 1); t.eq(l.ammo, -1);
    const g = by('gauss-autocannon'); t.deep(g.dmg, [7, 10]); t.eq(g.rof, 4); t.eq(g.cost, 280); t.eq(g.space, 105); t.eq(g.power, 105);
    const m = by('megabolt-cannon'); t.eq(m.acc, 3); t.deep(by('proton-torpedo').dmg, [75, 75]); t.eq(by('proton-torpedo').speed, 8);
    t.eq(by('scatter-pack-x').warheads, 10); t.eq(by('scatter-pack-vii-5').warheads, 7); t.eq(by('death-ray').tech.l, 36); t.deep(by('death-ray').dmg, [200, 1000]);
    t.eq(by('nuclear-bomb').ammo, 10); t.eq(by('death-spores').ammo, 5); t.deep(by('bio-terminator').dmg, [0, 3]);
    for (const x of K.WEAPONS.filter(x => x.flags.monster)) t.eq(x.grant, '');
  });

  t.test('tables: miniaturisation tables identical to Data.Techs; endpoints', () => {
    t.eq(K.T50[0], 100); t.eq(K.T50[10], 50); t.eq(K.T50[20], 25); t.eq(K.T50[50], 3);
    t.eq(K.T25[0], 100); t.eq(K.T25[10], 75); t.eq(K.T25[20], 56); t.eq(K.T25[50], 24);
    for (let i = 1; i < 51; i++) { t.ok(K.T50[i] <= K.T50[i - 1]); t.ok(K.T25[i] <= K.T25[i - 1]); }
    if (!M.Data.Techs || !M.Data.Techs.T50) t.skip('Data.Techs not loaded');
    t.deep(K.T50, M.Data.Techs.T50); t.deep(K.T25, M.Data.Techs.T25);
  });

  t.test('tables: component ids and tech records agree with Data.Techs (GRANT_IDS, field, level)', () => {
    const T = M.Data.Techs;
    if (!T || !T.GRANT_IDS) t.skip('Data.Techs not loaded');
    for (const kind of Object.keys(T.GRANT_IDS)) for (const id of T.GRANT_IDS[kind]) t.ok(ALL.some(c => c.grant === kind + ':' + id), 'no component for grant ' + kind + ':' + id);
    for (const c of ALL) if (c.grant) { const p = c.grant.split(':'); t.ok(T.GRANT_IDS[p[0]] && T.GRANT_IDS[p[0]].indexOf(p[1]) >= 0, 'unknown grant ' + c.grant); }
    for (const tech of T.list) for (const g of (tech.grants || [])) {
      const comps = ALL.filter(c => c.grant === g.kind + ':' + g.id);
      t.ok(comps.length > 0, 'grant ' + g.kind + ':' + g.id + ' has no component');
      for (const c of comps) { t.eq(c.tech.f, tech.field, c.id + ' field'); t.eq(c.tech.l, tech.level, c.id + ' level'); }
    }
  });

  t.test('helpers: miniCost / miniSpace (50% cost and 75% space per 10 levels; weapon space follows T50)', () => {
    t.eq(K.miniCost(100, 0), 100); t.eq(K.miniCost(100, 10), 50); t.eq(K.miniSpace(100, 10, false), 75); t.eq(K.miniSpace(100, 10, true), 50);
    t.eq(K.miniCost(100, 20), 25); t.eq(K.miniSpace(100, 20, false), 56); t.eq(K.miniSpace(100, 20, true), 25);
    t.eq(K.miniCost(30, 50), 0); t.eq(K.miniSpace(10, 50, true), 1, 'a fitted item keeps at least 1 ton'); t.eq(K.miniSpace(0, 5, false), 0, 'free armor stays free');
    t.eq(K.miniCost(100, 99), 3, 'tm clamps at 50'); t.eq(K.miniCost(100, -4), 100, 'tm clamps at 0');
  });

  // ------------------------------------------------------------------------------------------------------------------------------ hull space
  t.test('hull space grows +2% of base per Construction level (Large at 1 -> 1020, Huge at 99 -> 14,900)', () => {
    t.eq(D.hullSpace(mkE(), 2), 1020); t.eq(D.hullSpace(mkE([1, 99, 1, 1, 1, 1]), 3), 14900);
    t.deep([0, 1, 2, 3].map(h => D.hullSpace(mkE(), h)), [40, 204, 1020, 5100]);
    t.deep([0, 1, 2, 3].map(h => D.hullSpace(mkE([1, 50, 1, 1, 1, 1]), h)), [80, 400, 2000, 10000]);
    t.eq(D.hullSpace(mkE([1, 99, 1, 1, 1, 1]), 2), 2980);
    const c = D.compute(null, mkE([1, 78, 1, 1, 1, 1]), draft(3)); t.eq(c.space, 12800, 'research/06 design-screen sample: TOTAL SPACE 12800');
    t.eq(D.compute(null, mkE(), draft(2, { engine: 0 })).space, 1020);
  });

  // ------------------------------------------------------------------------------------------------------------------------------ worked examples
  t.test('worked example: fighter-like small ship = 14 BC, 3 HP, beam defense 3, combat speed 1 (research/03 §2.9)', () => {
    const E = mkE(), c = D.compute(mkS(E), E, draft(0, { weapons: [w('laser', 1)] }));
    t.ok(c.valid, c.reason); t.eq(c.power, 27); t.eq(c.engines, 27); t.eq(c.space, 40); t.eq(c.spaceUsed, 37); t.eq(c.free, 3); t.eq(c.costTenths, 144); t.eq(c.cost, 14);
    t.eq(c.hp, 3); t.eq(c.beamDef, 3); t.eq(c.missDef, 3); t.eq(c.combatSpeed, 1); t.eq(c.warp, 1); t.eq(c.attack, 0); t.eq(c.weaponCount, 1); t.ok(c.armed);
  });

  t.test('worked example: colony ship = 570 BC (Large, Standard Colony Base, Retro; 800 of 1020 tons)', () => {
    const E = mkE(), c = D.compute(mkS(E), E, draft(2, { specials: sp('standard-colony-base') }));
    t.ok(c.valid, c.reason); t.eq(c.power, 100); t.eq(c.engines, 100); t.eq(c.spaceUsed, 800); t.eq(c.space, 1020); t.eq(c.free, 220); t.eq(c.costTenths, 5700); t.eq(c.cost, 570);
    t.eq(c.colonyMin, 7); t.eq(c.hp, 100); t.eq(c.tanks, false);
  });

  t.test('the five premade designs cost 8 / 14 / 74 / 65 / 570 BC by the formula and have the documented stats', () => {
    const E = mkE(), S = mkS(E); D.startDesigns(E);
    t.deep(E.designs.map(d => d && d.name), ['Scout', 'Fighter', 'Destroyer', 'Bomber', 'Colony Ship', null]);
    const c = E.designs.map(d => d && D.compute(S, E, d));
    t.deep(c.slice(0, 5).map(x => x.cost), [8, 14, 74, 65, 570]); t.eq(c[5], null);
    c.slice(0, 5).forEach(x => t.ok(x.valid, x.reason));
    t.deep(c.slice(0, 5).map(x => x.engines), [2, 27, 110, 85, 100]); t.deep(c.slice(0, 5).map(x => x.hp), [3, 3, 18, 18, 100]);
    t.deep(c.slice(0, 5).map(x => x.spaceUsed), [22, 37, 190, 185, 800]); t.deep(c.slice(0, 5).map(x => x.free), [18, 3, 14, 19, 220]);
    t.deep(c.slice(0, 5).map(x => x.weaponCount), [0, 1, 4, 4, 0]); t.deep(c.slice(0, 5).map(x => x.armed), [false, true, true, true, false]);
    t.deep(c.slice(0, 5).map(x => x.tanks), [true, false, false, false, false]); t.deep(c.slice(0, 5).map(x => x.colonyMin), [0, 0, 0, 0, 7]);
    t.deep(c[2].weapons.map(x => x.id + 'x' + x.count), ['nuclear-missilex1', 'laserx3']); t.deep(c[3].weapons.map(x => x.id + 'x' + x.count), ['nuclear-bombx2', 'laserx2']);
    t.eq(c[3].bombs, 2); t.eq(c[2].beamDef, 2); t.eq(c[0].combatSpeed, 1); t.deep(E.designs.slice(0, 5).map(d => d.hull), [0, 0, 1, 1, 2]);
    t.deep(E.designs.slice(0, 5).map(d => d.weapons.length), [4, 4, 4, 4, 4]); t.deep(E.designs[0].specials, [I.specials['reserve-fuel-tanks'], -1, -1]);
    const armedCol = mkE(); D.startDesigns(armedCol, { armedColony: true });
    t.ok(D.compute(null, armedCol, armedCol.designs[4]).armed); t.eq(armedCol.dstats[4].preset, undefined);
  });

  t.test('start designs carry the original PRESET costs 10/15/66/86/591 until the first refresh, then the formula applies', () => {
    t.deep(D.PRESET_COST, [10, 15, 66, 86, 591]);
    const E = mkE(), S = mkS(E); D.startDesigns(E);
    t.deep([0, 1, 2, 3, 4, 5].map(i => D.cost(S, E, i)), [10, 15, 66, 86, 591, 1]);
    t.deep(E.dstats.slice(0, 5).map(x => x.preset), [true, true, true, true, true]); t.deep(E.dstats.slice(0, 5).map(x => x.formulaCost), [8, 14, 74, 65, 570]);
    S.fleets.push({ id: 1, owner: 0, star: 0, from: 0, to: -1, x: 0, y: 0, speed: 0, ships: [2, 0, 0, 0, 1, 0] });
    t.eq(M.Sim.Fleet.shipValue(S, E), 611, 'turn-1 ship value 10+10+591'); t.eq(Math.floor(M.Sim.Fleet.shipValue(S, E) / 50), 12); t.eq(D.maintenance(S, E).ships, 12);
    t.eq(D.scrapRefund(S, E, 4, 1), 147);
    D.refresh(S, E);
    t.deep([0, 1, 2, 3, 4, 5].map(i => D.cost(S, E, i)), [8, 14, 74, 65, 570, 1]);
    t.deep(E.dstats.slice(0, 5).map(x => x.preset), [undefined, undefined, undefined, undefined, undefined]);
    t.eq(M.Sim.Fleet.shipValue(S, E), 586); t.eq(D.maintenance(S, E).ships, 11); t.eq(D.scrapRefund(S, E, 4, 1), 142); t.eq(D.scrapRefund(S, E, 0, 2), 4);
    t.eq(D.scrapRefund(S, E, 0, 0), 0); t.eq(D.scrapRefund(S, E, 5, 3), 0);
  });

  t.test('new game: Setup.create seeds the presets so turn-1 ship upkeep is 12 BC (gross 56 -> net 44, factor 78)', () => {
    if (!M.Sim.Setup || !M.Data.Races) t.skip('Setup not available');
    const S = M.Sim.Setup.create({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: 'design-test' }), E = S.empires[0];
    t.deep([0, 1, 2, 3, 4, 5].map(i => D.cost(S, E, i)), [10, 15, 66, 86, 591, 1]);
    t.eq(E.flow.shipM, 12); t.eq(E.flow.gross, 56); t.eq(E.flow.net, 44); t.eq(E.flow.factor, 78);
    D.refresh(S, E); t.deep([0, 1, 2, 3, 4].map(i => D.cost(S, E, i)), [8, 14, 74, 65, 570]);
  });

  // ------------------------------------------------------------------------------------------------------------------------------ miniaturisation inside designs
  t.test('miniaturisation: a laser at tm=10 costs 50% and takes 50% space (T50); floors max(item,5) and min 1 ton at tm=50', () => {
    const d = draft(0, { weapons: [w('laser', 1)] });
    const a = D.compute(null, mkE([1, 1, 1, 1, 1, 11]), d);
    t.eq(a.costTenths, 60 + 15 + 54); t.eq(a.cost, 13); t.eq(a.spaceUsed, 5 + 27); t.eq(a.free, 8); t.eq(a.power, 27, 'power never shrinks');
    const b = D.compute(null, mkE([1, 1, 1, 1, 1, 51]), d);
    t.eq(b.costTenths, 60 + 5 + 54, 'item cost floor 5'); t.eq(b.cost, 12); t.eq(b.spaceUsed, 1 + 27, 'fitted item keeps 1 ton');
    const c = D.compute(null, mkE([1, 1, 1, 1, 1, 6]), d);                   // tm 5: laser cost floor(30*71/100)=21, space floor(10*71/100)=7
    t.eq(c.costTenths, 60 + 21 + 54); t.eq(c.spaceUsed, 7 + 27);
  });

  t.test('miniaturisation: shields / armor / engines use the 50% cost and 25%/-75% space tables of their own field', () => {
    const d = draft(2, { shield: 0, armor: I.armor['zortium-armor'] });
    const c = D.compute(null, mkE([1, 27, 11, 1, 1, 1]), d);                 // shield tm 10 (F 11 - 1), armor tm 10 (K 27 - 17)
    t.eq(c.power, 160); t.eq(c.engines, 160);
    t.eq(c.costTenths, 2000 + 600 + 500 + 320); t.eq(c.cost, 342); t.eq(c.spaceUsed, 45 + 75 + 160); t.eq(c.space, 1540); t.eq(c.free, 1260);
    t.eq(c.hp, 200); t.eq(c.absorb, 1);
    const e = D.compute(null, mkE([1, 1, 1, 1, 21, 1]), draft(1, { engine: I.engines['nuclear-engine'], man: 1 }));        // engine tm 15 (R 21 - 6): cost 50% table only
    t.eq(e.warp, 2);
  });

  t.test('armor hit-point matrix (research/03 §2.6): hull hits x armor% / 100, integer', () => {
    const HP = [[3, 18, 100, 600], [4, 27, 150, 900], [4, 27, 150, 900], [6, 40, 225, 1350], [6, 36, 200, 1200], [9, 54, 300, 1800], [7, 45, 250, 1500], [11, 67, 375, 2250],
      [9, 54, 300, 1800], [13, 81, 450, 2700], [10, 63, 350, 2100], [15, 94, 525, 3150], [12, 72, 400, 2400], [18, 108, 600, 3600]];
    const E = mkE();
    HP.forEach((row, a) => row.forEach((hp, h) => t.eq(D.compute(null, E, draft(h, { armor: a })).hp, hp, K.ARMOR[a].id + ' on hull ' + h)));
  });

  t.test('combat speed (R 1..9 -> 1,2,2,3,3,4,4,5,5; +1 Inertial Stabilizer, +2 Nullifier) and beam / missile defense = R + size mod + inertial (+ ECM)', () => {
    const E = mkE(), base = [1, 2, 2, 3, 3, 4, 4, 5, 5];
    for (let R = 1; R <= 9; R++) {
      const d = draft(2, { engine: 8, man: R - 1 });
      const c0 = D.compute(null, E, d), c1 = D.compute(null, E, Object.assign({}, d, { specials: sp('inertial-stabilizer') })), c2 = D.compute(null, E, Object.assign({}, d, { specials: sp('inertial-nullifier') }));
      t.eq(c0.combatSpeed, base[R - 1], 'R ' + R); t.eq(c1.combatSpeed, base[R - 1] + 1); t.eq(c2.combatSpeed, base[R - 1] + 2);
      t.eq(c0.beamDef, R + 0 + 0); t.eq(c1.beamDef, R + 2); t.eq(c2.beamDef, R + 4); t.eq(c0.rating, R); t.eq(c1.extraman, 2); t.eq(c2.extraman, 4);
    }
    t.deep([0, 1, 2, 3].map(h => D.compute(null, E, draft(h)).beamDef), [3, 2, 1, 0], 'hull defense +2/+1/0/-1 at R=1');
    t.eq(D.compute(null, E, draft(2, { ecm: 4 })).missDef, 1 + 5, 'ECM level adds to missile defense only');
    t.eq(D.compute(null, E, draft(2, { ecm: 4 })).beamDef, 1);
    // maneuver rating is capped by the engine's warp
    t.eq(D.compute(null, E, draft(2, { engine: 0, man: 5 })).rating, 1); t.eq(D.compute(null, E, draft(2, { engine: 2, man: 5 })).rating, 3);
  });

  t.test('engines and power: engines = max(1, power / warp) tenths; engine cost 2 BC per 10 power; space follows the engine table', () => {
    const E = mkE(), d = { hull: 1, weapons: [w('nuclear-missile', 1), w('laser', 3)] };           // power 15 + 20 + 75 = 110
    const want = [110, 55, 36, 27, 22, 18, 15, 13, 12];
    want.forEach((n, i) => { const c = D.compute(null, E, Object.assign({ engine: i, man: 0 }, d)); t.eq(c.power, 110); t.eq(c.engines, n, K.ENGINES[i].id); t.eq(c.warp, i + 1); });
    const nuc = D.compute(null, E, Object.assign({ engine: 1 }, d));
    t.eq(nuc.spaceUsed, 50 + 30 + Math.floor(18 * 55 / 10)); t.eq(nuc.costTenths, 360 + 70 + 90 + Math.floor(40 * 55 / 10));
    t.eq(D.compute(null, E, { hull: 0, engine: 0 }).engines, 2); t.eq(D.compute(null, E, { hull: 0, engine: 8 }).engines, 1, 'never fewer than one tenth of an engine');
    t.eq(D.compute(null, E, { hull: 3, engine: 0, man: 0 }).engines, 700);
    // maneuver power per rating step: S 2, M 15, L 100, H 700
    t.deep([0, 1, 2, 3].map(h => D.compute(null, E, { hull: h, engine: 3, man: 3 }).power), [8, 60, 400, 2800]);
  });

  // ------------------------------------------------------------------------------------------------------------------------------ validity
  t.test('invalid when free space < 0; mandatory engine; maxCount finds the exact boundary', () => {
    const E = mkE(), S = mkS(E);
    const over = D.compute(S, E, draft(0, { weapons: [w('heavy-laser', 2)] }));
    t.ok(!over.valid); t.eq(over.free, 40 - (60 + 152)); t.ok(/space/i.test(over.reason), over.reason);
    t.ok(!D.compute(S, E, draft(1, { specials: sp('standard-colony-base') })).valid, 'a colony base does not fit a Medium hull');
    t.ok(D.compute(S, E, draft(2, { specials: sp('standard-colony-base') })).valid);
    const noEng = D.compute(S, E, { hull: 0 }); t.ok(!noEng.valid); t.ok(/engine/i.test(noEng.reason));
    t.ok(!D.compute(S, E, { hull: 7, engine: 0 }).valid); t.ok(!D.compute(S, E, { hull: 0, engine: 99 }).valid); t.ok(!D.compute(S, E, draft(0, { armor: 40 })).valid);
    t.ok(!D.compute(S, E, draft(0, { comp: 50 })).valid); t.ok(!D.compute(S, E, draft(0, { weapons: [{ type: 200, count: 1 }] })).valid);
    for (const [hull, n] of [[0, 1], [1, 5], [2, 26], [3, 99]]) {
      const d = draft(hull, { weapons: [w('laser', 1)] });
      t.eq(D.maxCount(S, E, d, 0, I.weapons.laser), n, 'max lasers on hull ' + hull);
      const fit = D.compute(S, E, draft(hull, { weapons: [w('laser', n)] })); t.ok(fit.valid && fit.free >= 0, 'n fits');
      if (n < 99) { const no = D.compute(S, E, draft(hull, { weapons: [w('laser', n + 1)] })); t.ok(!no.valid && no.free < 0, 'n+1 does not fit'); }
    }
    t.eq(D.maxCount(S, E, draft(0), 0, I.weapons['heavy-laser']), 0, 'nothing fits');
    // the 99 per bank limit is independent of space (Huge hull has the room)
    const c100 = D.compute(S, E, draft(3, { weapons: [w('laser', 100)] })); t.ok(c100.free > 0); t.ok(!c100.valid); t.ok(/99/.test(c100.reason), c100.reason);
    t.ok(D.compute(S, E, draft(3, { weapons: [w('laser', 99)] })).valid);
  });

  t.test('at most 4 weapon banks and 3 special devices', () => {
    const E = mkE(), S = mkS(E), l = w('laser', 1);
    t.ok(D.compute(S, E, draft(3, { weapons: [l, w('heavy-laser', 1), w('nuclear-bomb', 1), w('nuclear-missile', 1)] })).valid);
    const five = D.compute(S, E, draft(3, { weapons: [l, l, l, l, l] })); t.ok(!five.valid); t.ok(/4 weapon/.test(five.reason), five.reason);
    t.ok(D.compute(S, E, draft(3, { weapons: [l, l, l, l, { type: -1, count: 0 }] })).valid, 'an empty fifth entry is fine');
    t.ok(D.compute(S, E, draft(3, { specials: sp('reserve-fuel-tanks', 'battle-scanner', 'anti-missile-rockets') })).valid);
    const four = D.compute(S, E, draft(3, { specials: sp('reserve-fuel-tanks', 'battle-scanner', 'anti-missile-rockets', 'repulsor-beam') })); t.ok(!four.valid); t.ok(/3 special/.test(four.reason), four.reason);
    t.deep(D.normalize(draft(0, { weapons: [l] })).weapons.length, 4); t.eq(D.normalize({ specials: [] }).specials.length, 3);
  });

  t.test('special devices: one per exclusivity group (anti-missile family, pulsars, inertial, repair, colony bases); stream projectors may be combined', () => {
    const E = mkE(), S = mkS(E);
    const pairs = [['zyro-shield', 'lightning-shield'], ['anti-missile-rockets', 'zyro-shield'], ['anti-missile-rockets', 'lightning-shield'], ['energy-pulsar', 'ionic-pulsar'],
      ['inertial-stabilizer', 'inertial-nullifier'], ['automated-repair', 'advanced-damage-control'], ['standard-colony-base', 'barren-colony-base'], ['standard-colony-base', 'radiated-colony-base'],
      ['battle-scanner', 'battle-scanner'], ['tundra-colony-base', 'dead-colony-base']];
    for (const p of pairs) { const c = D.compute(S, E, draft(3, { specials: sp(p[0], p[1]) })); t.ok(!c.valid, p.join('+')); t.ok(/Only one device/.test(c.reason), c.reason); }
    for (const p of [['ion-stream-projector', 'neutron-stream-projector'], ['energy-pulsar', 'inertial-stabilizer'], ['zyro-shield', 'automated-repair', 'high-energy-focus'], ['standard-colony-base', 'reserve-fuel-tanks', 'battle-scanner']]) {
      const c = D.compute(S, E, draft(3, { specials: sp.apply(null, p) })); t.ok(c.valid, p.join('+') + ': ' + c.reason);
    }
  });

  // ------------------------------------------------------------------------------------------------------------------------------ derived stats
  t.test('derived stats of the research/06 late-game sample: attack 11, absorb 11, missile defense 13, 2400 HP, warp 5 / def 4, combat speed 3', () => {
    const E = mkE([78, 78, 78, 78, 78, 78]);
    const d = draft(3, { comp: I.computers['mark-10-computer'], shield: I.shields['class-11-shield'], ecm: I.ecm['ecm-9'], armor: I.armor['neutronium-armor'], engine: I.engines['impulse-engine'], man: 4,
      weapons: [w('death-ray', 2), w('proton-torpedo', 24), w('gauss-autocannon', 8)], specials: sp('lightning-shield', 'high-energy-focus', 'battle-scanner') });
    const c = D.compute(null, E, d);
    t.eq(c.attack, 11); t.eq(c.compLevel, 10); t.eq(c.absorb, 11); t.eq(c.missDef, 13); t.eq(c.beamDef, 4); t.eq(c.hp, 2400); t.eq(c.warp, 5); t.eq(c.combatSpeed, 3);
    t.eq(c.misshield, 100); t.eq(c.rangeBonus, 3); t.eq(c.scanner, true); t.eq(c.space, 12800); t.eq(c.weaponCount, 34); t.ok(c.armed);
    t.deep(c.specials, ['lightning-shield', 'high-energy-focus', 'battle-scanner']);
    t.deep(c.weapons.map(x => x.range), [4, 10, 4], 'High Energy Focus adds 3 to beams only');
    t.eq(c.power, 2 * 2000 + 24 * 400 + 8 * 105 + 700 * 5 + (1750 + 1000 + 50) + 550 + 810 + 1250); t.eq(c.engines, Math.floor(c.power / 5));
    t.eq(c.hullW, 125);
  });

  t.test('High Energy Focus: +3 range for beams (also heavy mounts and the Stellar Converter), none for missiles, torpedoes and bombs', () => {
    const E = mkE(), S = mkS(E);
    const mk = ids => D.compute(S, E, draft(3, { weapons: ids.map(id => w(id, 1)), specials: sp('high-energy-focus') })).weapons.map(x => x.range);
    t.deep(mk(['laser', 'heavy-laser', 'stellar-converter', 'nuclear-missile']), [4, 5, 6, 6]);
    t.deep(mk(['proton-torpedo', 'nuclear-bomb', 'death-spores', 'scatter-pack-x']), [10, 1, 1, 10]);
    t.deep(D.compute(S, E, draft(3, { weapons: [w('laser', 1), w('heavy-laser', 1)] })).weapons.map(x => x.range), [1, 2]);
  });

  t.test('colonyMin (7..1 per colony base) and tanks', () => {
    const E = mkE(), S = mkS(E), bases = ['standard', 'barren', 'tundra', 'dead', 'inferno', 'toxic', 'radiated'];
    bases.forEach((b, i) => { const c = D.compute(S, E, draft(2, { specials: sp(b + '-colony-base') })); t.ok(c.valid, c.reason); t.eq(c.colonyMin, 7 - i, b); t.eq(c.tanks, false); t.eq(c.cost, [570, 595, 620, 645, 670, 695, 720][i]); });
    const tk = D.compute(S, E, draft(0, { specials: sp('reserve-fuel-tanks') })); t.ok(tk.tanks); t.eq(tk.colonyMin, 0);
    t.eq(D.compute(S, E, draft(2, { specials: sp('standard-colony-base', 'reserve-fuel-tanks') })).tanks, true);
  });

  t.test('other special-device effects fold into the stats (repair, missile shield, pulsar, stream, cloak, teleport ...)', () => {
    const E = mkE(), S = mkS(E);
    const c = D.compute(S, E, draft(3, { specials: sp('automated-repair', 'ionic-pulsar', 'cloaking-device') })); t.eq(c.repair, 15); t.eq(c.pulsar, 2); t.eq(c.cloak, 5);
    const c2 = D.compute(S, E, draft(3, { specials: sp('advanced-damage-control', 'neutron-stream-projector', 'sub-space-teleporter') })); t.eq(c2.repair, 30); t.eq(c2.stream, 2); t.eq(c2.teleport, true);
    const c3 = D.compute(S, E, draft(3, { specials: sp('stasis-field', 'displacement-device', 'oracle-interface') })); t.eq(c3.stasis, true); t.eq(c3.displacement, 34); t.eq(c3.oracle, true);
    const c4 = D.compute(S, E, draft(3, { specials: sp('warp-dissipator', 'technology-nullifier', 'repulsor-beam') })); t.ok(c4.dissipator && c4.technull && c4.repulsor);
    const c5 = D.compute(S, E, draft(3, { specials: sp('black-hole-generator', 'anti-missile-rockets') })); t.ok(c5.blackhole); t.eq(c5.misshield, 40);
    const none = D.compute(S, E, draft(3)); t.eq(none.repair, 0); t.eq(none.misshield, 0); t.eq(none.pulsar, 0); t.eq(none.stream, 0); t.eq(none.cloak, 0); t.eq(none.attack, 0); t.eq(none.absorb, 0);
    t.eq(D.compute(S, E, draft(0, { comp: 0 })).attack, 1); t.eq(D.compute(S, E, draft(0, { comp: 0, specials: sp('battle-scanner') })).attack, 2);
    t.eq(D.compute(S, E, draft(0, { specials: sp('battle-scanner') })).attack, 1);
  });

  t.test('bombs and bio weapons are carried but do not make a ship "armed"', () => {
    const E = mkE(), S = mkS(E);
    const b = D.compute(S, E, draft(1, { weapons: [w('nuclear-bomb', 2)] })); t.ok(b.valid); t.ok(!b.armed); t.eq(b.bombs, 2); t.eq(b.weaponCount, 2);
    const v = D.compute(S, E, draft(2, { weapons: [w('death-spores', 3)] })); t.ok(!v.armed); t.eq(v.bio, 3);
  });

  t.test('item prices shown in the design popups: max(item,5) then (x+5)/10', () => {
    const E = mkE();
    t.deep(D.itemInfo(E, 'weapons', I.weapons.laser, 0), { id: 'laser', name: 'Laser', tm: 0, cost: 3, costTenths: 30, space: 10, power: 25 });
    t.eq(D.itemInfo(E, 'weapons', I.weapons['heavy-laser'], 2).cost, 9); t.eq(D.itemInfo(E, 'computers', 0, 0).cost, 4); t.eq(D.itemInfo(E, 'computers', 0, 3).space, 100);
    t.eq(D.itemInfo(E, 'armor', 0, 2).cost, 0); t.eq(D.itemInfo(E, 'armor', 1, 1).space, 80); t.eq(D.itemInfo(E, 'ecm', 0, 0).cost, 3);
    t.eq(D.itemInfo(E, 'specials', I.specials['standard-colony-base'], 2).cost, 350); t.eq(D.itemInfo(mkE([1, 1, 1, 1, 1, 11]), 'weapons', I.weapons.laser, 0).space, 5);
    t.eq(D.itemInfo(E, 'engines', 4, 0).power, 50); t.eq(D.itemInfo(E, 'nothing', 0, 0), null); t.eq(D.itemInfo(E, 'weapons', 999, 0), null);
  });

  // ------------------------------------------------------------------------------------------------------------------------------ missile bases
  t.test('missile-base price: 254 BC at game start (research/04 §3.10); AI difficulty discounts; never below 50', () => {
    const E = mkE(), S = mkS(E);
    t.eq(D.baseCost(S, E), 254);
    const b = D.baseLoadout(S, E); t.eq(b.comp, 0); t.eq(b.ecm, -1); t.eq(b.shield, 0); t.eq(b.armor, 0); t.eq(b.armorTier, 0); t.eq(b.weapon, I.weapons['nuclear-missile']); t.eq(b.weapon2, b.weapon); t.eq(b.hp, 50);
    const ai = mkE(); ai.human = false;
    [100, 90, 80, 70, 50].forEach((pct, di) => { S.settings.diffIdx = di; t.eq(D.baseCost(S, ai), Math.floor(254 * pct / 100), 'difficulty ' + di); });
    S.settings.diffIdx = 2;
    // mid game: C Mark III + ECM I, Class III shield, Duralloy, Hyper-X at TL 11 -> (86+54+92+74+54)*3/5 = 216
    const mid = mkE([11, 11, 11, 1, 1, 11], [[1, 2, 5, 10], [1, 10], [1, 4, 10], [1], [1], [1, 4, 8]]);
    t.eq(D.baseCost(S, mid), 216); const bm = D.baseLoadout(S, mid); t.eq(bm.armorTier, 1); t.eq(bm.hp, 75); t.eq(bm.weapon, I.weapons['hyper-x']); t.eq(bm.shield, 2); t.eq(bm.comp, 2); t.eq(bm.ecm, 0);
    mid.human = false; [216, 194, 172, 151, 108].forEach((v, di) => { S.settings.diffIdx = di; t.eq(D.baseCost(S, mid), v, 'mid difficulty ' + di); });
    S.settings.diffIdx = 2;
    // everything known at TL 50: floor(111 * 3 / 5) = 66; the AI discount can never push it under 50
    const all = mkE([50, 50, 50, 50, 50, 50], [levels(50), levels(50), levels(50), levels(50), levels(50), levels(50)]);
    t.eq(D.baseCost(S, all), 66); const ba = D.baseLoadout(S, all); t.eq(ba.armorTier, 6); t.eq(ba.hp, 200); t.eq(ba.weapon, I.weapons.zeon); t.eq(ba.weapon2, I.weapons['scatter-pack-x']);
    all.human = false; S.settings.diffIdx = 4; t.eq(D.baseCost(S, all), 50); S.settings.diffIdx = 2;
  });

  t.test('ship and base upkeep: floor(sum(count x cost) / 50) + floor(bases x baseCost / 50) + 100 per stargate', () => {
    const E = mkE(), S = mkS(E); D.startDesigns(E); D.refresh(S, E);
    S.fleets.push({ id: 1, owner: 0, star: 0, ships: [2, 3, 0, 0, 1, 0] }, { id: 2, owner: 0, star: -1, ships: [0, 0, 4, 0, 0, 0] }, { id: 3, owner: 1, star: 0, ships: [9, 9, 9, 9, 9, 9] });
    S.planets.push({ owner: 0, bases: 5, stargate: true }, { owner: 0, bases: 0 }, { owner: 1, bases: 50, stargate: true });
    const m = D.maintenance(S, E);
    t.eq(m.ships, Math.floor((2 * 8 + 3 * 14 + 1 * 570 + 4 * 74) / 50)); t.eq(m.bases, Math.floor(5 * 254 / 50)); t.eq(m.gates, 100); t.eq(m.total, m.ships + m.bases + m.gates);
  });

  // ------------------------------------------------------------------------------------------------------------------------------ availability
  t.test('available(): level-1 parts are free, the rest need the tech level in completed[field]; monster weapons never', () => {
    const E = mkE();
    const ids = (kind, list) => D.available(E, kind).map(i => list[i].id);
    t.deep(D.available(E, 'hulls'), [0, 1, 2, 3]);
    t.deep(ids('weapons', K.WEAPONS), ['nuclear-bomb', 'laser', 'nuclear-missile', 'nuclear-missile-5', 'heavy-laser']);
    t.deep(ids('computers', K.COMPUTERS), ['mark-1-computer']); t.deep(D.available(E, 'ecm'), []); t.deep(ids('shields', K.SHIELDS), ['class-1-shield']);
    t.deep(ids('armor', K.ARMOR), ['titanium-armor', 'titanium-armor-ii']); t.deep(ids('engines', K.ENGINES), ['retro-engine']);
    t.deep(ids('specials', K.SPECIALS), ['reserve-fuel-tanks', 'standard-colony-base', 'battle-scanner']);
    E.research.completed = [[1, 2, 5], [1, 10], [1, 4], [1, 3], [1, 6, 99], [1, 4, 36, 99]];
    t.deep(ids('weapons', K.WEAPONS), ['nuclear-bomb', 'laser', 'nuclear-missile', 'nuclear-missile-5', 'heavy-laser', 'hyper-v', 'hyper-v-5', 'death-ray']);
    t.deep(ids('computers', K.COMPUTERS), ['mark-1-computer', 'mark-2-computer']); t.deep(ids('ecm', K.ECM), ['ecm-1']); t.deep(ids('shields', K.SHIELDS), ['class-1-shield', 'class-2-shield']);
    t.deep(ids('armor', K.ARMOR), ['titanium-armor', 'titanium-armor-ii', 'duralloy-armor', 'duralloy-armor-ii']); t.deep(ids('engines', K.ENGINES), ['retro-engine', 'nuclear-engine']);
    t.ok(ids('specials', K.SPECIALS).indexOf('barren-colony-base') >= 0);
    t.ok(ids('weapons', K.WEAPONS).indexOf('crystal-ray') < 0); t.ok(ids('weapons', K.WEAPONS).indexOf('amoeba-stream') < 0);
    E.grants['weapon:gatling-laser'] = true; t.ok(ids('weapons', K.WEAPONS).indexOf('gatling-laser') >= 0, 'an E.grants key unlocks the part too');
    t.deep(D.available(E, 'weapon'), D.available(E, 'weapons')); t.deep(D.available(E, 'shield'), D.available(E, 'shields')); t.deep(D.available(E, 'bogus'), []);
  });

  t.test('check(): unresearched parts are reported', () => {
    const E = mkE();
    t.eq(D.check(E, draft(2, { weapons: [w('laser', 1)], specials: sp('standard-colony-base') })), '');
    t.ok(/Mark II/.test(D.check(E, draft(2, { comp: 1 })))); t.ok(/Class II/.test(D.check(E, draft(2, { shield: 1 })))); t.ok(/Nuclear/.test(D.check(E, draft(2, { engine: 1 }))));
    t.ok(/Hyper-V/.test(D.check(E, draft(2, { weapons: [w('hyper-v', 1)] })))); t.ok(/Duralloy/.test(D.check(E, draft(2, { armor: 2 })))); t.ok(/Zyro/.test(D.check(E, draft(2, { specials: sp('zyro-shield') }))));
    E.research.completed[0].push(5); t.eq(D.check(E, draft(2, { comp: 1 })), '');
  });

  // ------------------------------------------------------------------------------------------------------------------------------ orders
  t.test('order design: validates, stores a clean record, caches stats; six designs maximum; locked once ships exist', () => {
    const E = mkE(), S = mkS(E); D.startDesigns(E);
    const good = { name: 'Raider', hull: 2, engine: 0, weapons: [w('laser', 4), w('nuclear-missile', 2)], specials: sp('reserve-fuel-tanks') };
    let r = O.apply(S, 0, { t: 'design', slot: 5, design: good });
    t.ok(r.ok, r.msg); t.eq(r.slot, 5); t.eq(E.designs[5].name, 'Raider'); t.eq(E.designs[5].weapons.length, 4); t.eq(E.designs[5].specials.length, 3); t.eq(E.designs[5].hull, 2);
    t.eq(E.dstats[5].cost, r.cost); t.eq(D.cost(S, E, 5), D.compute(S, E, good).cost); t.ok(E.dstats[5].valid);
    t.eq(JSON.stringify(E.designs[5]), JSON.stringify(JSON.parse(JSON.stringify(E.designs[5]))), 'plain JSON');
    // all six slots used -> no free slot
    r = O.apply(S, 0, { t: 'design', design: { hull: 0, engine: 0 } }); t.ok(!r.ok); t.ok(/Six designs|scrap/i.test(r.msg), r.msg);
    // a slot with a design but no ships may be redesigned; with ships it is locked
    r = O.apply(S, 0, { t: 'design', slot: 5, design: { name: 'Raider2', hull: 1, engine: 0, weapons: [w('laser', 1)] } }); t.ok(r.ok, r.msg); t.eq(E.designs[5].name, 'Raider2');
    S.fleets.push({ id: 1, owner: 0, star: 0, ships: [0, 0, 0, 0, 0, 2] });
    r = O.apply(S, 0, { t: 'design', slot: 5, design: good }); t.ok(!r.ok); t.ok(/in use/.test(r.msg), r.msg); t.eq(E.designs[5].name, 'Raider2');
    r = O.apply(S, 0, { t: 'design', slot: 6, design: good }); t.ok(!r.ok);
    // rejected: over space, unresearched, too many banks / specials, exclusivity, no engine
    const E2 = mkE(), S2 = mkS(E2);
    const bad = [
      [{ hull: 0, engine: 0, weapons: [w('heavy-laser', 2)] }, /space/i], [{ hull: 2, engine: 0, comp: 1 }, /not researched/], [{ hull: 2, engine: 0, weapons: [w('laser', 1), w('laser', 1), w('laser', 1), w('laser', 1), w('laser', 1)] }, /weapon/],
      [{ hull: 3, engine: 0, specials: sp('reserve-fuel-tanks', 'battle-scanner', 'anti-missile-rockets', 'repulsor-beam') }, /special|researched/],
      [{ hull: 3, engine: 0, specials: sp('standard-colony-base', 'standard-colony-base') }, /Only one/], [{ hull: 0 }, /engine/i],
    ];
    for (const [d, re] of bad) { const x = O.apply(S2, 0, { t: 'design', design: d }); t.ok(!x.ok, JSON.stringify(d)); t.ok(re.test(x.msg), x.msg); t.ok(E2.designs.every(s => s === null), 'nothing stored'); }
    // first free slot, default name, free icon; string ids accepted
    const a = O.apply(S2, 0, { t: 'design', design: { hull: 'medium', engine: 'retro-engine', weapons: [{ id: 'laser', count: 2 }] } }); t.ok(a.ok, a.msg); t.eq(a.slot, 0);
    t.eq(E2.designs[0].name, 'Frigate'); t.eq(E2.designs[0].icon, 0);
    const b = O.apply(S2, 0, { t: 'design', design: { hull: 'medium', engine: 0 } }); t.ok(b.ok); t.eq(b.slot, 1); t.eq(E2.designs[1].name, 'Destroyer'); t.eq(E2.designs[1].icon, 1);
    t.eq(O.apply(S2, 0, { t: 'design', design: { name: 'ABCDEFGHIJKLMNOP', hull: 0, engine: 0 } }).ok, true); t.eq(E2.designs[2].name.length, 12);
    // man is clamped to the engine
    const c = O.apply(S2, 0, { t: 'design', design: { hull: 2, engine: 0, man: 7 } }); t.ok(c.ok); t.eq(E2.designs[c.slot].man, 0);
  });

  t.test('order scrapDesign: removes the empire\'s ships, repoints planets, refunds 25%, empties the slot', () => {
    const E = mkE(), E1 = mkE(null, null, 1), S = mkS(E, E1); D.startDesigns(E); D.startDesigns(E1); D.refresh(S, E); D.refresh(S, E1);
    S.fleets.push({ id: 1, owner: 0, star: 0, ships: [0, 0, 3, 0, 1, 0] }, { id: 2, owner: 1, star: 0, ships: [0, 0, 5, 0, 0, 0] }, { id: 3, owner: 0, star: -1, ships: [0, 0, 2, 0, 0, 0] });
    S.planets.push({ id: 0, owner: 0, build: 2 }, { id: 1, owner: 0, build: 1 }, { id: 2, owner: 1, build: 2 }, { id: 3, owner: 0, build: -1 });
    const r = O.apply(S, 0, { t: 'scrapDesign', slot: 2 });
    t.ok(r.ok, r.msg); t.eq(r.ships, 5); t.eq(r.refund, Math.floor(5 * 74 / 4)); t.eq(E.bc, 92);
    t.eq(E.designs[2], null); t.eq(E.dstats[2], null); t.eq(E1.designs[2].name, 'Destroyer', 'other empires keep their designs');
    t.eq(S.fleets.length, 2, 'emptied fleets are removed'); t.deep(S.fleets.map(f => f.id), [1, 2]); t.deep(S.fleets[0].ships, [0, 0, 0, 0, 1, 0]); t.deep(S.fleets[1].ships, [0, 0, 5, 0, 0, 0]);
    t.deep(S.planets.map(p => p.build), [0, 1, 2, -1], 'only own planets building the scrapped design are repointed to the first remaining valid one; stargate builds stay');
    t.eq(D.cost(S, E, 2), 1); t.ok(!D.stats(S, E, 2).valid);
    const bad = O.apply(S, 0, { t: 'scrapDesign', slot: 2 }); t.ok(!bad.ok); t.ok(!O.apply(S, 0, { t: 'scrapDesign', slot: 9 }).ok);
    // the freed slot can take a new design
    t.ok(O.apply(S, 0, { t: 'design', slot: 2, design: { hull: 1, engine: 0 } }).ok);
    // scrapping with presets still in force pays on the preset cost
    const E3 = mkE(), S3 = mkS(E3); D.startDesigns(E3); S3.fleets.push({ id: 1, owner: 0, star: 0, ships: [0, 0, 0, 0, 3, 0] });
    t.eq(O.apply(S3, 0, { t: 'scrapDesign', slot: 4 }).refund, Math.floor(3 * 591 / 4)); t.eq(S3.fleets.length, 0);
    // last design gone: planets fall back to slot 0 (nothing to build)
    const E4 = mkE(), S4 = mkS(E4); E4.designs[3] = D.blank(0); E4.designs[3].engine = 0; S4.planets.push({ id: 0, owner: 0, build: 3 });
    t.ok(O.apply(S4, 0, { t: 'scrapDesign', slot: 3 }).ok); t.eq(S4.planets[0].build, 0);
  });

  t.test('invariants over 400 random designs: used + free = space, engines = max(1, power / warp), hp, cost >= 1, tech only ever makes ships cheaper and roomier', () => {
    const R = M.RNG.create('design-props'), pick = n => R.int(0, n - 1);
    for (let k = 0; k < 400; k++) {
      const hull = pick(4), engine = pick(9);
      const d = { hull, engine, man: pick(engine + 1), comp: pick(12) - 1, ecm: pick(11) - 1, shield: pick(12) - 1, armor: pick(14), weapons: [], specials: [pick(31) - 1, pick(31) - 1, pick(31) - 1], icon: 0 };
      for (let b = 0; b < 4; b++) d.weapons.push({ type: pick(64) - 1, count: pick(6) });
      const tl = [0, 1, 2, 3, 4, 5].map(() => 1 + pick(60)), E = mkE(tl), lo = D.compute(null, E, d);
      t.ok(!lo.structural, JSON.stringify(d));
      t.eq(lo.spaceUsed + lo.free, lo.space); t.eq(lo.engines, Math.max(1, Math.floor(lo.power / lo.warp))); t.eq(lo.hp, Math.floor(K.HULLS[hull].hits * K.ARMOR[d.armor].pct / 100));
      t.ok(lo.cost >= 1 && Number.isInteger(lo.cost)); t.eq(lo.valid, lo.free >= 0 && lo.reason === ''); t.eq(lo.space, D.hullSpace(E, hull));
      t.eq(lo.cost, Math.max(1, Math.floor((lo.costTenths + 5) / 10)));
      const hi = D.compute(null, mkE(tl.map(v => v + 10)), d);
      t.ok(hi.costTenths <= lo.costTenths, 'cost must not rise with tech'); t.ok(hi.free >= lo.free, 'free space must not fall with tech'); t.eq(hi.power, lo.power, 'power never shrinks');
      t.eq(hi.hp, lo.hp); t.eq(hi.beamDef, lo.beamDef); t.eq(hi.combatSpeed, lo.combatSpeed);
    }
  });

  // ------------------------------------------------------------------------------------------------------------------------------ plumbing
  t.test('stats(): cached per slot, recomputed when the record changes, harmless for empty slots; compute() is pure and JSON-safe', () => {
    const E = mkE(), S = mkS(E); D.startDesigns(E); D.refresh(S, E);
    const e = D.stats(S, E, 5); t.eq(e.valid, false); t.eq(e.cost, 1); t.eq(e.warp, 1); t.eq(e.tanks, false); t.eq(e.colonyMin, 0); t.eq(D.cost(S, E, 5), 1);
    t.ok(D.stats(S, E, 1) === E.dstats[1], 'cached object');
    E.designs[1] = Object.assign(D.blank(1), { name: 'Swap', engine: 0, weapons: [w('laser', 2)] });            // direct assignment, no refresh
    t.eq(D.cost(S, E, 1), D.compute(S, E, E.designs[1]).cost, 'a changed record is noticed'); t.ok(D.stats(S, E, 1).cost > 14);
    delete E.dstats; t.eq(D.cost(S, E, 4), 570, 'lazy compute when the cache is missing'); t.ok(Array.isArray(E.dstats));
    D.refresh(S, E);                                                              // warm cache: from here on the read-only queries must not write anything
    const before = JSON.stringify([E, S]); const d = draft(2, { weapons: [w('laser', 3)], specials: sp('standard-colony-base') }); const dj = JSON.stringify(d);
    D.compute(S, E, d); D.itemInfo(E, 'weapons', 1, 2); D.maxCount(S, E, d, 0, 1); D.available(E, 'weapons'); D.baseCost(S, E); D.maintenance(S, E); D.check(E, d); D.stats(S, E, 2);
    t.ok(JSON.stringify([E, S]) === before, 'read-only queries mutated the state'); t.ok(JSON.stringify(d) === dj, 'draft untouched');
    t.deep(JSON.parse(JSON.stringify(E.dstats)), E.dstats, 'cache is plain JSON');
    const noRes = { id: 0, designs: [null, null, null, null, null, null] }; t.eq(D.compute(null, noRes, draft(0, { weapons: [w('laser', 1)] })).cost, 14, 'no research state = tech level 1');
    t.eq(D.baseCost({ settings: { diffIdx: 2 } }, noRes), 254);
  });

  t.test('normalize(): fixed 4 banks / 3 specials, string ids resolved, empty banks canonical, idempotent', () => {
    const n = D.normalize({ name: '  Long Name Indeed  ', hull: 'large', engine: 'retro-engine', comp: 'mark-2-computer', armor: 'duralloy-armor', weapons: [{ id: 'laser', count: 2 }, { type: 3, count: 0 }, null], specials: ['battle-scanner'] });
    t.eq(n.hull, 2); t.eq(n.engine, 0); t.eq(n.comp, 1); t.eq(n.armor, 2); t.eq(n.shield, -1); t.eq(n.ecm, -1); t.eq(n.name, 'Long Name In');
    t.deep(n.weapons, [{ type: I.weapons.laser, count: 2 }, { type: -1, count: 0 }, { type: -1, count: 0 }, { type: -1, count: 0 }]); t.deep(n.specials, [I.specials['battle-scanner'], -1, -1]);
    t.deep(D.normalize(n).weapons, n.weapons); t.eq(D.normalize(D.normalize({ weapons: [1, 2, 3, 4, 5].map(() => w('laser', 1)) })).extraBanks, 1);
    t.deep(D.normalize(null).weapons.length, 4); t.eq(D.normalize({ weapons: [{ type: 2, count: -4 }] }).weapons[0].type, -1);
    t.ok(!D.compute(null, mkE(), { hull: 0, engine: 0, weapons: [{ id: 'no-such-weapon', count: 1 }] }).valid);
    t.deep(D.blank(2).weapons, [0, 1, 2, 3].map(() => ({ type: -1, count: 0 }))); t.eq(D.blank(2).hull, 2); t.eq(D.blank(0).engine, 0); t.eq(D.defaultName(mkE(), 3), 'Dreadnought');
  });
};
