// Verification-gap closures (HANDOFF item 3): Data.Config.QUIRKS.{wasteSub1, shipBonusBC, soilRounding, factoryRefit, transportBC}, diplo dispatch clearing diplo_type,
// Intel.designThreat on tech levels. Sources: research/04-verification (C8, C9, C10, B8, B9), research/05-verification (CORRECTION 9), research/08 §4.1.
module.exports = function (M, t) {
  const C = M.Sim.Colony, Cfg = M.Data.Config;
  const mkE = (race, over) => Object.assign({
    id: 0, race: race || 'human', human: true, alive: true, bc: 0, tax: 0, security: 0, spyBudget: [0, 0, 0, 0, 0, 0],
    mods: { robotic: 2, factoryCost: 10, wasteScale: 10, ecoRestore: 2, terraform: 0, terraformCost: 0, incPopCost: 20, planetShield: 0, planetShieldCost: 0 },
    research: { tl: [1, 1, 1, 1, 1, 1], slider: [20, 10, 15, 15, 20, 20] },
  }, over || {});
  const mkP = over => Object.assign({
    id: 0, starId: 0, owner: 0, type: 'terran', typeIdx: 13, mp1: 100, mp2: 100, mp3: 100, maxPop: 100, growth: 'normal', special: 'normal',
    pop: 50, popFrac: 0, factories: 30, waste: 0, rebels: 0, unrest: 0, bank: 0, bases: 0, shield: 0, sliders: [0, 0, 100, 0, 0], lock: [false, false, false, false, false],
    acc: { ship: 0, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 }, build: 0, spendable: 0, gross: 0, operTier: 2,
  }, over || {});
  const S = { settings: { diffIdx: 2 }, stars: [{ id: 0, nebula: false, name: 'X' }], planets: [], empires: [] };
  const withQ = (q, fn) => { const prev = Cfg.QUIRKS; Cfg.QUIRKS = Object.assign({}, prev, q); try { return fn(); } finally { Cfg.QUIRKS = prev; } };

  t.test('QUIRKS table: the three new opt-in quirks default off, transportBC on; Config.quirk() reads opt-ins only', () => {
    t.eq(Cfg.quirk('wasteSub1'), false); t.eq(Cfg.quirk('shipBonusBC'), false); t.eq(Cfg.quirk('soilRounding'), false); t.eq(Cfg.quirk('factoryRefit'), false);
    t.eq(Cfg.QUIRKS.transportBC, true); t.eq(Cfg.quirk('nonexistent'), false);
    withQ({ wasteSub1: true }, () => t.eq(Cfg.quirk('wasteSub1'), true));
  });

  // ---- C8 waste second term -------------------------------------------------------------------------------------------------------------------
  t.test('wasteSub1 (C8): +floor((100-waste%)*floor(operating*oper/10)/100) after the cleanup need is computed; fully funded cleanup wipes it, an under-funded one keeps it', () => {
    const E = mkE('human');
    const base = () => mkP({ pop: 50, factories: 30, spendable: 100, sliders: [0, 0, 0, 100, 0] });
    const q = base(); C.buildEco(S, E, q); t.eq(q.waste, 0, 'plain: funded cleanup');
    // under-funded: ECO 0 -> nothing cleaned; waste after = term1 (30) [+ term2 floor(30*2/10)=6 at 100-0% -> 6]
    const a = mkP({ spendable: 100, sliders: [0, 0, 100, 0, 0] }); C.buildEco(S, E, a); t.eq(a.waste, 30);
    withQ({ wasteSub1: true }, () => {
      const b = mkP({ spendable: 100, sliders: [0, 0, 100, 0, 0] }); C.buildEco(S, E, b); t.eq(b.waste, 30 + Math.floor((100 - Math.floor(30 * 100 / 100)) * 6 / 100), 'second term added (about +20 % of the new waste)');
      t.ok(b.waste > a.waste);
      const c = base(); C.buildEco(S, E, c); t.eq(c.waste, 0, 'funded cleanup wipes the extra term');
    });
  });

  // ---- C9 SHIP +1 BC -----------------------------------------------------------------------------------------------------------------------------
  t.test('shipBonusBC (C9): +1 BC whenever the SHIP slider is > 0 (after the richness multiplier), nothing at 0', () => {
    const E = mkE('human', { designs: [] }), run = (slider, quirk) => withQ({ shipBonusBC: quirk }, () => { const p = mkP({ spendable: 100, sliders: [slider, 0, 100 - slider, 0, 0], build: -1 }); C.buildShips(S, E, p, []); return p.acc.ship; });
    t.eq(run(20, false), 20); t.eq(run(20, true), 21); t.eq(run(0, true), 0); t.eq(run(100, true), 101);
    const rich = withQ({ shipBonusBC: true }, () => { const p = mkP({ spendable: 100, special: 'rich', sliders: [50, 0, 50, 0, 0], build: -1 }); C.buildShips(S, E, p, []); return p.acc.ship; });
    t.eq(rich, 101, 'x2 first, then +1');
  });

  // ---- B8 soil rounding --------------------------------------------------------------------------------------------------------------------------
  t.test('soilRounding (B8): (m/20)*5 + ((m/20)%5 ? 5 : 0) for Fertile, (m/10)*5 + ((m/10)%5 ? 5 : 0) for Gaia (integer division, min 5) — the table of research/04 §2.3', () => {
    withQ({ soilRounding: true }, () => {
      const fert = { 20: 10, 40: 15, 60: 20, 80: 25, 105: 25, 110: 25, 115: 25, 120: 35 }, gaia = { 55: 25, 60: 35, 70: 40, 80: 45, 90: 50, 105: 50 };
      for (const m in fert) t.eq(C.soilInc(+m, 'fertile'), fert[m], 'fertile ' + m);
      for (const m in gaia) t.eq(C.soilInc(+m, 'gaia'), gaia[m], 'gaia ' + m);
      t.eq(C.soilInc(10, 'fertile'), 5, 'minimum 5');
    });
    t.eq(C.soilInc(20, 'fertile'), 5, 'intended rule by default'); t.eq(C.soilInc(60, 'gaia'), 30);
  });

  // ---- B9 factory refit / overflow ---------------------------------------------------------------------------------------------------------------
  t.test('factoryRefit (B9): flat (oper - tier - Meklar2) * floor(factoryBase/2) once new factories would exceed pop*tier; then the tier rises', () => {
    withQ({ factoryRefit: true }, () => {
      const E = mkE('human', { mods: Object.assign(mkE().mods, { robotic: 3 }) });          // empire operates 3 per colonist, the planet is still tier 2
      const p = mkP({ pop: 10, factories: 20, mp3: 100, spendable: 100, sliders: [0, 0, 100, 0, 0], operTier: 2 });
      const cost = C.factoryCost(E);                                                          // 10*3/2 = 15
      t.eq(C.buildIndustry(S, E, p), false);
      t.eq(p.operTier, 3, 'refit paid, tier raised'); t.eq(p.acc.refit, 0);
      const rc = 1 * Math.floor(10 / 2);
      const spend = 100 - rc, n = Math.floor(spend / cost);
      t.eq(p.factories, 20 + n); t.eq(p.acc.factory, spend - n * cost);
      // a small budget is swallowed by the refit and carried
      const q = mkP({ pop: 10, factories: 21, mp3: 100, spendable: 3, sliders: [0, 0, 100, 0, 0], operTier: 2 }); q.acc.factory = 0;
      C.buildIndustry(S, E, q); t.eq(q.factories, 21); t.eq(q.acc.refit, 3); t.eq(q.operTier, 2);
      C.buildIndustry(S, E, q); t.eq(q.operTier, 3, 'second turn pays the 5 BC refit');
      // below pop*tier no refit is needed
      const r = mkP({ pop: 50, factories: 20, mp3: 100, spendable: 30, sliders: [0, 0, 100, 0, 0], operTier: 2 }); C.buildIndustry(S, E, r); t.eq(r.operTier, 2); t.eq(r.factories, 22);
    });
  });
  t.test('factoryRefit (B9): whole factories above the maximum go to the reserve at floor(excess*cost/2); the remainder BC stays in the accumulator', () => {
    withQ({ factoryRefit: true }, () => {
      const E = mkE('human'), cost = C.factoryCost(E), p = mkP({ pop: 50, mp3: 100, factories: 195, spendable: 100, sliders: [0, 0, 100, 0, 0], operTier: 2 });   // max = 100*2 = 200
      const maxed = C.buildIndustry(S, E, p);
      t.eq(maxed, true); t.eq(p.factories, 200);
      const whole = Math.floor(100 / cost);
      t.eq(E.bc, Math.floor((whole - 5) * cost / 2)); t.eq(p.acc.factory, 100 - whole * cost);
      const E2 = mkE('human'), q = mkP({ pop: 50, mp3: 100, factories: 200, spendable: 100, sliders: [0, 0, 100, 0, 0], operTier: 2 });
      C.buildIndustry(S, E2, q); t.eq(E2.bc, Math.floor(whole * cost / 2), 'already maxed: only whole factories count'); t.eq(q.acc.factory, 100 - whole * cost);
    });
    const E = mkE('human'), p = mkP({ pop: 50, mp3: 100, factories: 200, spendable: 100, sliders: [0, 0, 100, 0, 0] }); C.buildIndustry(S, E, p); t.eq(E.bc, 50, 'default: floor(bc/2)');
  });

  // ---- C10 transport cost timing -------------------------------------------------------------------------------------------------------------------
  t.test('transportBC: launching deducts 1 BC per pop from the planet\'s spendable output (SG); QUIRKS.transportBC = false reproduces 1oom (no deduction)', () => {
    const mk = () => {
      const G = M.Sim.Setup.create({ size: 'small', opponents: 1, race: 'human', seed: 'trans', difficulty: 'average' });
      const E = G.empires[0], home = G.planets[E.capital];
      const hs = G.stars[home.starId], dist = p => Math.hypot(G.stars[p.starId].x - hs.x, G.stars[p.starId].y - hs.y);
      const other = G.planets.filter(p => p.owner < 0 && p.id !== home.id).sort((a, b) => dist(a) - dist(b))[0];
      other.typeIdx = 13; E.explored[other.starId] = true; E.mods.fuel = 99; E.mods.colonyFor = 1;
      M.Sim.Colony.found(G, E, other, 2);
      home.trans = { to: other.starId, n: 5 };
      return { G, E, home, other };
    };
    let f = mk(); const spBefore = (() => { M.Sim.Econ.stepProduction(f.G); return f.home.spendable; })();
    M.Sim.Fleet.launchTransports(f.G); t.eq(f.home.transCost, 5); M.Sim.Econ.stepProduction(f.G);
    t.ok(f.home.spendable <= spBefore, 'spendable not larger');
    withQ({ transportBC: false }, () => {
      const g = mk(); M.Sim.Fleet.launchTransports(g.G); t.eq(g.home.transCost, 0);
    });
  });

  // ---- diplo: dispatch / callToArms clear diplo_type (05-verification CORRECTION 9) -----------------------------------------------------------------
  t.test('diplo dispatch: the quiet-turn branch (sub2) clears a recorded diplo_type unless an allied call to arms queues 76', () => {
    const D = M.Sim.Diplo; if (!D || !D._ || !D._.dispatch) t.skip('no Diplo._.dispatch');
    const S2 = { v: 1, seed: 'dd', rs: M.RNG.seedState('dd'), turn: 3, year: 50, settings: { difficulty: 'average', diffIdx: 2 }, playerId: 0, stars: [{ id: 0, name: 'A', x: 0, y: 0 }, { id: 1, name: 'B', x: 20, y: 0 }],
      planets: [{ id: 0, starId: 0, owner: 0, pop: 40, gross: 50 }, { id: 1, starId: 1, owner: 1, pop: 40, gross: 50 }], empires: [], fleets: [], trans: [], ev: [], nextId: 1 };
    const R0 = M.RNG.bind(S2.rs);
    for (let e = 0; e < 2; e++) {
      const E = { id: e, race: e ? 'mrrshan' : 'human', name: 'e' + e, plural: 'es', leader: 'L', human: e === 0, alive: true, personality: 3, objective: 0, bc: 0, mods: { fuel: 99 }, designs: [null, null, null, null, null, null],
        flow: {}, spyMode: [0, 0, 0, 0, 0, 0], spyBudget: [0, 0, 0, 0, 0, 0], spies: [0, 0, 0, 0, 0, 0], relations: [] };
      M.Sim.Research.init(S2, E, R0); S2.empires.push(E);
    }
    D.init(S2);
    const seq = vals => { let i = 0; return { int(lo, hi) { const v = i < vals.length ? vals[i++] : hi; return Math.max(lo, Math.min(hi, v)); }, dice() { return 3; }, next() { return 0.5; } }; };
    const r = S2.empires[0].relations[1];
    Object.assign(r, { contact: true, met: 2, dipType: 2, dipVal: 0, treaty: 0, hatred: 0 }); Object.assign(S2.empires[1].relations[0], { contact: true, met: 2 });
    const out = [];
    D._.dispatch(S2, seq([]), S2.empires[0], S2.empires[1], out);
    t.eq(r.dipType, 0, 'a recorded "thanks" type does not survive a quiet turn');
    Object.assign(r, { dipType: 1, treaty: 2 });                                                  // allied, but the 1-in-10 call-to-arms roll fails
    D._.dispatch(S2, seq([]), S2.empires[0], S2.empires[1], out);
    t.eq(r.dipType, 0, 'alliance without a successful call to arms still clears it');
  });

  // ---- intel.js designThreat on tech levels (tools/handoff/ai-military.md patch 3) ------------------------------------------------------------------
  t.test('Intel.designThreat uses weapon / special TECH LEVELS and agrees with Military.designThreat; the standalone fallback gives the same numbers', () => {
    const AI = M.AI; if (!AI || !AI.Intel || !AI.Military) t.skip('no AI');
    const G = M.Sim.Setup.create({ size: 'small', opponents: 1, race: 'human', seed: 'thr', difficulty: 'average' }), E = G.empires[0];
    const K = M.Data.Components, I = K.idx, Dz = M.Sim.Design;
    for (const key of ['laser', 'heavy-laser']) if (I.weapons[key] === undefined) t.skip('weapon missing');
    const d = Dz.blank(2); d.engine = 0; d.weapons[0] = { type: I.weapons['laser'], count: 3 }; d.weapons[1] = { type: I.weapons['heavy-laser'], count: 2 };
    E.designs[5] = d; Dz.refresh(G, E);
    const want = 3 * K.WEAPONS[I.weapons['laser']].tech.l + 2 * K.WEAPONS[I.weapons['heavy-laser']].tech.l;
    const th = AI.Intel.designThreat(G, E, 5), st = Dz.stats(G, E, 5);
    t.ok(th >= want, 'at least the weapon-level sum');
    t.eq(th, want + Math.floor(((d.shield >= 0 ? d.shield + 1 : 0) + 10) * (st.hp | 0) / 50), 'weapons by tech level + (shield+10)*hp/50');
    t.eq(th, AI.Military.designThreat(G, E, 5, { held: false, ended: false }));
    const orig = AI.Military.designThreat; AI.Military.designThreat = null;
    try { t.eq(AI.Intel.designThreat(G, E, 5), th, 'fallback identical'); } finally { AI.Military.designThreat = orig; }
  });
};
