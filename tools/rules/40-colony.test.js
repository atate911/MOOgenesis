// Colony economy vs the worked examples in research/04 §3 (Strategy Guide tutorial numbers, Let's-Play numbers, growth table).
module.exports = function (M, t) {
  const C = M.Sim.Colony;
  const mkE = (race, over) => Object.assign({
    id: 0, race: race || 'human', human: true, alive: true, bc: 0, tax: 0, security: 0, spyBudget: [0, 0, 0, 0, 0, 0],
    mods: { robotic: 2, factoryCost: 10, wasteScale: 10, ecoRestore: 2, terraform: 0, terraformCost: 0, incPopCost: 20, planetShield: 0, planetShieldCost: 0 },
    research: { tl: [1, 1, 1, 1, 1, 1], slider: [20, 10, 15, 15, 20, 20] },
  }, over || {});
  const mkP = (over) => Object.assign({
    id: 0, starId: 0, owner: 0, type: 'terran', typeIdx: 13, mp1: 100, mp2: 100, mp3: 100, maxPop: 100, growth: 'normal', special: 'normal',
    pop: 50, popFrac: 0, factories: 30, waste: 0, rebels: 0, unrest: 0, bank: 0, bases: 0, shield: 0, sliders: [0, 0, 100, 0, 0], lock: [false, false, false, false, false],
    acc: { ship: 0, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 }, build: 0, spendable: 0, gross: 0,
  }, over || {});
  const S = { settings: { diffIdx: 2 }, stars: [{ id: 0, nebula: false, name: 'X' }], planets: [], empires: [] };

  t.test('gross production at game start: human 30 factories + 26 = 56 BC; Klackon doubles the worker term = 82 BC', () => {
    t.eq(C.gross(S, mkE('human'), mkP()), 56);
    t.eq(C.gross(S, mkE('klackon'), mkP()), 82);
  });
  t.test('Psilon/Impossible start (pop 40): gross 51; with turn-1 upkeep 12 → spendable 38 (Let\'s-Play "38 (51)")', () => {
    const E = mkE('psilon'), p = mkP({ pop: 40 });
    const g = C.gross(S, E, p); t.eq(g, 51);
    const net = Math.max(1, g - 12), factor = Math.floor(net * 100 / g);
    t.eq(Math.floor(g * factor / 100), 38);
  });
  t.test('operated factories are limited by workers × robotic level', () => {
    const E = mkE('human'), p = mkP({ pop: 10, factories: 100 });
    t.eq(C.gross(S, E, p), 20 + Math.floor(10 * 53 / 100));          // min(100, 10*2) + 5
    E.mods.robotic = 4; t.eq(C.gross(S, E, p), 40 + 5);
    t.eq(C.gross(S, mkE('meklar', { mods: Object.assign({}, E.mods, { robotic: 2 }) }), p), 40 + 5);   // Meklar +2 per colonist
  });
  t.test('worker output scales with Planetology level: (3L+50)/100 per pop (L=17 → 1.01)', () => {
    const E = mkE('human'); E.research.tl[3] = 17;
    t.eq(C.gross(S, E, mkP({ pop: 100, factories: 0 })), Math.floor(100 * (3 * 17 + 50) / 100));
  });
  t.test('rebellion zeroes output; the planet bank can at most double it', () => {
    const E = mkE('human'); t.eq(C.gross(S, E, mkP({ unrest: 2 })), 0);
    t.eq(C.gross(S, E, mkP({ bank: 1000 })), 112);
    t.eq(C.gross(S, E, mkP({ bank: 10 })), 66);
  });

  t.test('factory costs: 10 base; Improved Industrial Tech steps; ×oper/2 for robotic controls; Meklar pays base only', () => {
    const E = mkE('human');
    t.eq(C.factoryCost(E), 10);
    E.mods.factoryCost = 9; E.mods.robotic = 3; t.eq(C.factoryCost(E), 13);       // 9*3/2 = 13 (integer)
    E.mods.factoryCost = 6; E.mods.robotic = 4; t.eq(C.factoryCost(E), 12);
    t.eq(C.factoryCost(mkE('meklar', { mods: { factoryCost: 6, robotic: 4 } })), 6);
    t.eq(C.maxFactories(mkE('human'), mkP()), 200);                               // 100-pop world holds 200 factories
  });

  t.test('slider greedy auto-balance: lowering/raising keeps index order, surplus goes to Tech', () => {
    const E = mkE('human'), p = mkP({ sliders: [0, 0, 100, 0, 0] });
    p.spendable = 0;                                                              // disable the ECO floor for this test
    C.setSlider(S, E, p, 0, 40); t.deep(p.sliders, [40, 0, 60, 0, 0]);
    C.setSlider(S, E, p, 4, 30); t.deep(p.sliders, [40, 0, 30, 0, 30]);          // Tech takes 30; Ind trimmed to fit
    C.setSlider(S, E, p, 2, 10); t.deep(p.sliders, [40, 0, 10, 0, 50]);         // surplus lands on the last slider (Tech)
    p.lock[0] = true; C.setSlider(S, E, p, 2, 80); t.deep(p.sliders, [40, 0, 60, 0, 0]);   // Ship locked at 40 → budget 60
  });

  t.test('ECO floor at game start: 30 factories → 15 BC cleanup of 43 spendable = 35%', () => {
    const E = mkE('human'), p = mkP({ spendable: 43 });
    t.eq(C.ecoFloorPct(S, E, p), 35);
    t.eq(C.ecoFloorPct(S, mkE('silicoid'), p), 0);                               // Silicoids never pollute
  });
  t.test('applyEcoFloor raises ECO and takes it from Ship/Def/Ind first, Tech last', () => {
    const E = mkE('human'), p = mkP({ spendable: 43, sliders: [0, 0, 100, 0, 0] });
    C.applyEcoFloor(S, E, p); t.eq(p.sliders[3], 35); t.eq(p.sliders[2], 65); t.eq(p.sliders.reduce((a, b) => a + b, 0), 100);
  });

  t.test('pop growth per turn matches the SG table (max 100): +0.2 @2, +0.9 @10, +1.6 @20, +2.1 @30, +2.4 @40, +2.5 @50 … +0.1 @99', () => {
    const E = mkE('human');
    const want = { 2: 2, 10: 9, 20: 16, 30: 21, 40: 24, 50: 25, 60: 24, 70: 21, 80: 16, 90: 9, 95: 4, 99: 1 };
    for (const pop in want) {
      const p = mkP({ pop: +pop, factories: 0, waste: 0 }); C.growPop(S, E, p, 0);
      const tenths = (p.pop - (+pop)) * 10 + p.popFrac; t.eq(tenths, want[pop], 'pop ' + pop);
    }
  });
  t.test('growth classes: hostile halves, fertile ×1.5, gaia ×2, Sakkra ×2; Silicoid uses half-rate ignoring class', () => {
    const base = p => { C.growPop(S, mkE('human'), p, 0); return (p.pop - 40) * 10 + p.popFrac; };
    const n = base(mkP({ pop: 40, factories: 0 }));                              // 24 tenths
    t.eq(n, 24);
    t.eq(base(mkP({ pop: 40, factories: 0, growth: 'hostile' })), Math.floor((30 * 40 + 5) / 100));   // v=60 → 30
    t.eq(base(mkP({ pop: 40, factories: 0, growth: 'fertile' })), Math.floor((90 * 40 + 5) / 100));   // v=60+30 = 90
    t.eq(base(mkP({ pop: 40, factories: 0, growth: 'gaia' })), Math.floor((120 * 40 + 5) / 100));
    const sk = mkP({ pop: 40, factories: 0 }); C.growPop(S, mkE('sakkra'), sk, 0); t.eq((sk.pop - 40) * 10 + sk.popFrac, Math.floor((120 * 40 + 5) / 100));
    const sl = mkP({ pop: 40, factories: 0, growth: 'hostile' }); C.growPop(S, mkE('silicoid'), sl, 0); t.eq((sl.pop - 40) * 10 + sl.popFrac, Math.floor((30 * 40 + 5) / 100));
  });
  t.test('growth is capped at max pop, shrinks when over capacity, and carries tenths', () => {
    const E = mkE('human');
    const a = mkP({ pop: 99, popFrac: 8 }); C.growPop(S, E, a, 0); t.ok(a.pop <= 100);
    const b = mkP({ pop: 100, waste: 20 }); C.growPop(S, E, b, 0); t.ok(b.pop < 100, 'waste pushes pop over capacity → shrink');
    const c = mkP({ pop: 10, popFrac: 9 }); C.growPop(S, E, c, 0); t.eq(c.pop * 10 + c.popFrac >= 109, true);
  });

  t.test('waste and cleanup: 30 factories add 30 waste, 2 waste cleaned per BC', () => {
    const E = mkE('human'), p = mkP({ spendable: 43, sliders: [0, 0, 65, 35, 0] });
    C.buildEco(S, E, p);
    t.eq(p.waste, 0);                                                            // 35% of 43 = 15 BC cleans exactly 30 waste
    const q = mkP({ spendable: 43, sliders: [0, 0, 100, 0, 0] }); C.buildEco(S, E, q); t.eq(q.waste, 30);
  });
  t.test('waste reduces effective max pop (displayed) but never below 10; Silicoid ignores it', () => {
    const E = mkE('human'); t.eq(C.maxPopDisplay(E, mkP({ waste: 40 })), 60); t.eq(C.maxPopDisplay(E, mkP({ waste: 99 })), 10);
    t.eq(C.maxPopDisplay(mkE('silicoid'), mkP({ waste: 40 })), 100);
  });

  t.test('soil enrichment increments follow the intended rule (ceil to 5, min 5): 100→+25/+50, 70→+20/+35, 45→+15/+25, 30→+10/+15', () => {
    const f = (m, k) => C.soilInc(m, k);
    t.eq(f(100, 'fertile'), 25); t.eq(f(100, 'gaia'), 50); t.eq(f(70, 'fertile'), 20); t.eq(f(70, 'gaia'), 35);
    t.eq(f(45, 'fertile'), 15); t.eq(f(45, 'gaia'), 25); t.eq(f(30, 'fertile'), 10); t.eq(f(30, 'gaia'), 15);
  });
  t.test('soil enrichment / atmospheric terraforming update max-pop variables and growth class', () => {
    const E = mkE('human', { mods: { terraform: 0, terraformCost: 5, soil: true, atmos: true } });
    const p = mkP({ growth: 'normal', mp1: 70, mp2: 70, mp3: 70, maxPop: 70 }); C.soilEnrich(S, E, p, 'fertile');
    t.eq(p.mp2, 90); t.eq(p.mp3, 90); t.eq(p.growth, 'fertile');
    const h = mkP({ type: 'radiated', typeIdx: 1, growth: 'hostile', mp1: 25, mp2: 25, mp3: 25 }); C.atmosTerraform(S, E, h);
    t.eq(h.type, 'minimal'); t.eq(h.mp1, 45); t.eq(h.growth, 'normal');
  });
  t.test('terraforming buys +1 max pop per tech cost (5 BC at +10) up to the tech level', () => {
    const E = mkE('human', { mods: { robotic: 2, factoryCost: 10, wasteScale: 10, ecoRestore: 2, terraform: 10, terraformCost: 5, incPopCost: 20 } });
    const p = mkP({ pop: 100, factories: 0, spendable: 100, sliders: [0, 0, 0, 100, 0], mp3: 100 }); p.mp2 = 100;
    C.buildEco(S, E, p); t.eq(p.mp3, 110, 'level 10 reached (50 BC)');
    const q = mkP({ pop: 100, factories: 0, spendable: 20, sliders: [0, 0, 0, 100, 0] }); C.buildEco(S, E, q); t.eq(q.mp3, 104, '20 BC → +4');
  });
  t.test('buying population: 20 BC per pop at start, capped at 25% of current pop per turn', () => {
    const E = mkE('human');
    const p = mkP({ pop: 10, factories: 0, spendable: 1000, sliders: [0, 0, 0, 100, 0], mp3: 100 }); const before = p.pop;
    C.buildEco(S, E, p); t.eq(p.pop - before >= 2 && p.pop - before <= 3, true, 'bought at most 25% of 10 pop');
  });

  t.test('richness multiplies Ship/Def/Ind spending only', () => {
    t.eq(C.richMul(mkP({ special: 'ultrarich' }), 100), 300); t.eq(C.richMul(mkP({ special: 'rich' }), 100), 200);
    t.eq(C.richMul(mkP({ special: 'poor' }), 100), 50); t.eq(C.richMul(mkP({ special: 'ultrapoor' }), 100), 33); t.eq(C.richMul(mkP({ special: 'normal' }), 100), 100);
  });
  t.test('industry: builds factories at the factory cost, caps at max, surplus goes to the reserve at 50%', () => {
    const E = mkE('human'), p = mkP({ pop: 50, factories: 30, spendable: 43, sliders: [0, 0, 100, 0, 0] });
    C.buildIndustry(S, E, p); t.eq(p.factories, 34); t.eq(p.acc.factory, 3);       // 43 BC → 4 factories (10 each) + 3 carried
    const q = mkP({ pop: 10, mp3: 10, factories: 20, spendable: 60, sliders: [0, 0, 100, 0, 0] }); const E2 = mkE('human');
    const maxed = C.buildIndustry(S, E2, q); t.eq(maxed, true); t.eq(q.factories, 20); t.eq(E2.bc, 30);
  });
  // ---- research/04 verification (1oom-checked rules) -------------------------------------------------------------------------------------------------------
  t.test('ECO floor update = the original: SHIP/DEF/IND each lose value*diff/100 (truncated), TECH is recomputed as the remainder (C3)', () => {
    const E = mkE('human'), p = mkP({ spendable: 43, sliders: [20, 0, 40, 0, 40] });
    C.applyEcoFloor(S, E, p); t.deep(p.sliders, [13, 0, 26, 35, 26], 'floor 35: SHIP 20-7, IND 40-14, TECH = 100-13-26-35');
    const q = mkP({ spendable: 43, sliders: [10, 0, 90, 0, 0] }); C.applyEcoFloor(S, E, q); t.deep(q.sliders, [7, 0, 59, 35, 0], 'truncation can leave the sum at 101 (original quirk)');
    const r = mkP({ spendable: 43, sliders: [0, 0, 50, 50, 10] }); C.applyEcoFloor(S, E, r); t.deep(r.sliders, [0, 0, 50, 50, 0], 'no floor raise, but TECH is still renormalised to the remainder, never below 0');
    const l = mkP({ spendable: 43, sliders: [0, 0, 100, 0, 0], lock: [false, false, true, false, false] }); C.applyEcoFloor(S, E, l); t.eq(l.sliders[2], 100, 'a locked slider is not reduced');
    const si = mkP({ spendable: 43, sliders: [0, 0, 60, 10, 40] }); C.applyEcoFloor(S, mkE('silicoid'), si); t.deep(si.sliders, [0, 0, 60, 10, 40], 'Silicoids are skipped entirely');
  });
  t.test('soil projects: atmosphere >= 200 then the leftover flows on; soil > 150 keeps 150 as progress, so normal -> fertile -> gaia costs 301 BC (C4)', () => {
    const E = mkE('human', { mods: { terraform: 0, terraformCost: 5, robotic: 2, factoryCost: 10, wasteScale: 10, ecoRestore: 2, incPopCost: 20, soil: true, advSoil: true, atmos: true } });
    const eco = (p, bc) => { p.spendable = bc; p.sliders = [0, 0, 0, 100, 0]; C.buildEco(S, E, p); };
    const p = mkP({ growth: 'normal', pop: 100, factories: 0 });
    eco(p, 200); t.eq(p.growth, 'fertile'); t.eq(p.acc.eco, 200, 'progress 150 kept + 50 leftover flowed into advanced soil');
    eco(p, 100); t.eq(p.growth, 'fertile', 'exactly 300 does not finish (strict >)'); t.eq(p.acc.eco, 300);
    eco(p, 1); t.eq(p.growth, 'gaia'); t.eq(p.acc.eco, 0);
    const h = mkP({ growth: 'hostile', type: 'radiated', typeIdx: 1, mp1: 25, mp2: 25, mp3: 25, maxPop: 25, pop: 25, factories: 0 });
    eco(h, 250); t.eq(h.growth, 'normal'); t.eq(h.type, 'minimal'); t.eq(h.acc.eco, 50, '>= 200 finishes the atmosphere; the 50 left starts soil enrichment in the same turn');
  });
  t.test('stargate completion: excess BC carries, the build item resets, a human SHIP percentage moves to TECH (sliders keep summing to 100)', () => {
    const E = mkE('human'), p = mkP({ spendable: 100, sliders: [100, 0, 0, 0, 0], build: -1, acc: { ship: 2950, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 } });
    C.buildShips(S, E, p, []); t.eq(p.stargate, true); t.eq(p.acc.ship, 50); t.eq(p.build, 0); t.deep(p.sliders, [0, 0, 0, 0, 100]);
    const a = mkP({ spendable: 100, sliders: [100, 0, 0, 0, 0], build: -1, acc: { ship: 2950, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 } });
    C.buildShips(S, mkE('human', { human: false }), a, []); t.deep(a.sliders, [100, 0, 0, 0, 0], 'AI sliders are not touched');
  });
  const withQuirks = (q, fn) => { const prev = M.Data.Config.QUIRKS; M.Data.Config.QUIRKS = Object.assign({}, prev, q); try { fn(); } finally { M.Data.Config.QUIRKS = prev; } };
  t.test('quirk defaults: popTenthsTwice / hiddenChildLabor classic, wasteSub1 / shipBonusBC / soilRounding fixed', () => {
    const Q = M.Data.Config.QUIRKS;
    t.eq(Q.popTenthsTwice, true); t.eq(Q.hiddenChildLabor, true); t.eq(Q.wasteSub1, false); t.eq(Q.shipBonusBC, false); t.eq(Q.soilRounding, false);
  });
  t.test('wasteSub1 (C8): +floor((100-waste%)*floor(op*oper/10)/100) after the cleanup cost; a funded cleanup wipes it, an unfunded one keeps it', () => {
    withQuirks({ wasteSub1: true }, () => {
      const E = mkE('human');
      const q = mkP({ spendable: 43, sliders: [0, 0, 100, 0, 0] }); C.buildEco(S, E, q); t.eq(q.waste, 34, '30 + (70*6)/100');
      const p = mkP({ spendable: 43, sliders: [0, 0, 65, 35, 0] }); C.buildEco(S, E, p); t.eq(p.waste, 0, 'fully funded cleanup wipes it');
    });
    const q = mkP({ spendable: 43, sliders: [0, 0, 100, 0, 0] }); C.buildEco(S, mkE('human'), q); t.eq(q.waste, 30, 'default: off');
  });
  t.test('shipBonusBC (C9): +1 BC to the ship accumulator whenever SHIP > 0 (after carry), nothing at SHIP 0', () => {
    const mk = sl => mkP({ spendable: 100, sliders: sl, build: 0, acc: { ship: 5, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 } });
    const E = mkE('human', { designs: [{ id: 0 }] }), des = M.Sim.Design, savedCost = des.cost; des.cost = () => 100000;
    try {
      let p = mk([10, 0, 90, 0, 0]); C.buildShips(S, E, p, []); const base = p.acc.ship;
      withQuirks({ shipBonusBC: true }, () => { p = mk([10, 0, 90, 0, 0]); C.buildShips(S, E, p, []); t.eq(p.acc.ship, base + 1);
        p = mk([0, 0, 100, 0, 0]); C.buildShips(S, E, p, []); t.eq(p.acc.ship, 5, 'no SHIP, no bonus'); });
    } finally { des.cost = savedCost; }
  });
  t.test('soilRounding (2.3): 1oom increments Fertile (m/20)*5 + (...%5 ? 5 : 0), Gaia with m/10; the default stays ceil-to-5', () => {
    withQuirks({ soilRounding: true }, () => {
      const f = (m, k) => C.soilInc(m, k);
      t.eq(f(20, 'fertile'), 10); t.eq(f(40, 'fertile'), 15); t.eq(f(60, 'fertile'), 20); t.eq(f(80, 'fertile'), 25); t.eq(f(105, 'fertile'), 25); t.eq(f(120, 'fertile'), 35);
      t.eq(f(55, 'gaia'), 25); t.eq(f(60, 'gaia'), 35); t.eq(f(70, 'gaia'), 40); t.eq(f(90, 'gaia'), 50); t.eq(f(105, 'gaia'), 50); t.eq(f(5, 'fertile'), 5, 'min 5');
    });
    t.eq(C.soilInc(20, 'fertile'), 5);
  });
  t.test('growth quirk (C7): the carried tenths are added twice — pop 2 -> 50 on a max-100 normal world takes 29 turns (46 with Data.Config.QUIRKS.popTenthsTwice = false)', () => {
    const E = mkE('human'), run = () => { const q = mkP({ pop: 2, popFrac: 0, mp3: 100, waste: 0, growth: 'normal', typeIdx: 13 }); let n = 0; while (q.pop < 50 && n < 200) { C.growPop(S, E, q, 0); n++; } return n; };
    t.eq(run(), 29, 'original behaviour is the default');
    const prev = M.Data.Config.QUIRKS; M.Data.Config.QUIRKS = { popTenthsTwice: false };
    try { t.eq(run(), 46, 'plain formula'); } finally { M.Data.Config.QUIRKS = prev; }
  });
};
