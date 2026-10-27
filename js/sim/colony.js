// Colony economy (research/04 §3): production, the five spending sliders, waste & ecology, terraforming, population growth, defence, ships, factories.
// Every function takes (S, E, p) = state, owning empire, planet. Worker-safe.
//
// planet colony fields (present when planet.owner >= 0):
//   pop (int millions), popFrac (tenths carried 0..9), waste, factories, operTier, rebels, unrest, bank (planet reserve), bases, shield (0|5|10|15|20), stargate,
//   sliders [ship,def,ind,eco,tech] (sum 100, 4% steps in the UI), lock [5 bool], acc {ship, factory, base, baseUpg, shield, eco, refit} (carried BC),
//   build (design slot 0..5, or -1 = stargate), reloc (star id), trans {to, n}, gross, spendable (computed each turn), baseCostPaid
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Colony = {};
  const SHIP = 0, DEF = 1, IND = 2, ECO = 3, TECH = 4;
  C.SLIDERS = ['ship', 'def', 'ind', 'eco', 'tech'];
  const MAX_POP = 300, MAX_FACTORIES = 2700;
  const RICH = { ultrapoor: [1, 3], poor: [1, 2], normal: [1, 1], artifacts: [1, 1], rich: [2, 1], ultrarich: [3, 1], orion: [1, 1] };
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // ---- empire-level constants derived from techs/race ---------------------------------------------------------------
  C.oper = E => ((E.mods && E.mods.robotic) || 2) + (E.race === 'meklar' ? 2 : 0);
  C.factoryBase = E => (E.mods && E.mods.factoryCost) || 10;
  C.factoryCost = E => (E.race === 'meklar' ? C.factoryBase(E) : Math.floor(C.factoryBase(E) * C.oper(E) / 2));
  C.wasteScale = E => (E.race === 'silicoid' ? 0 : (E.mods.wasteScale === undefined ? 10 : E.mods.wasteScale));
  C.ecoN = E => E.mods.ecoRestore || 2;                       // waste units removed per BC
  C.plLevel = E => E.research.tl[3];
  C.maxFactories = (E, p) => Math.min(MAX_FACTORIES, p.mp3 * C.oper(E));
  C.richMul = (p, bc) => { const r = RICH[p.special] || [1, 1]; return Math.floor(bc * r[0] / r[1]); };
  C.maxPopDisplay = (E, p) => (E && E.race === 'silicoid' ? p.mp3 : Math.max(10, p.mp3 - (p.waste | 0)));

  // ---- founding / losing colonies ------------------------------------------------------------------------------------
  C.found = function (S, E, p, colonists) {
    p.owner = E.id; p.pop = colonists || 2; p.popFrac = 0; p.waste = 0; p.factories = 0; p.operTier = 2; p.rebels = 0; p.unrest = 0; p.bank = 0;
    p.bases = 0; p.shield = 0; p.stargate = false; p.sliders = [0, 0, 100, 0, 0]; p.lock = [false, false, false, false, false];
    p.acc = { ship: 0, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 }; p.build = 0; p.reloc = p.starId; p.trans = null;
    p.gross = 0; p.spendable = 0; p.baseCostPaid = 0; p.mp2 = p.mp2 || p.maxPop; p.mp3 = p.mp3 || p.maxPop; p.mp1 = p.mp1 || p.maxPop;
    if (!p.name) p.name = S.stars[p.starId].name;
    // expansion: prefabricated modules, Gaia seeding and permanent planet improvements (no-ops unless owned)
    const xm = E.mods || {};
    if (colonists > 0 && (xm.colonyPop || xm.colonyFac)) { p.pop = Math.min(p.mp3 || p.pop, p.pop + (xm.colonyPop | 0)); p.factories = xm.colonyFac | 0; }
    if (colonists > 0 && xm.seedFertile && p.growth === 'normal' && E.race !== 'silicoid') C.soilEnrich(S, E, p, 'fertile', true);
    if (M.Sim.XTech) M.Sim.XTech.improve(S, E, p);
    C.applyEcoFloor(S, E, p);
  };
  C.abandon = function (S, p) { p.owner = -1; p.pop = 0; p.factories = 0; p.bases = 0; p.shield = 0; p.stargate = false; p.waste = 0; p.rebels = 0; p.unrest = 0; p.trans = null; };

  // ---- production --------------------------------------------------------------------------------------------------------
  // Gross BC of one planet BEFORE empire-wide upkeep/tax. (§3.2)
  C.gross = function (S, E, p) {
    if (p.unrest === 2) return 0;                                         // rebellion: nothing
    const oper = C.oper(E), workers = Math.max(0, p.pop - (p.rebels | 0));
    const opFact = Math.min(p.factories, workers * oper);
    let perPop = Math.floor(p.pop * (3 * C.plLevel(E) + 50) / 100);
    if (E.race === 'klackon') perPop *= 2;
    const xm = E.mods || {};
    if (xm.workerPct) perPop = Math.floor(perPop * (100 + xm.workerPct) / 100);       // expansion: Biomass Reactors
    let g = opFact + perPop;
    if (xm.asteroid && M.Sim.XTech) { const a = M.Sim.XTech.grossPct(S, E, p); if (a) g = Math.floor(g * (100 + a) / 100); }   // expansion: Asteroid Mining
    if (!E.human) g = Math.floor(g * (M.Data.Config ? M.Data.Config.aiProdFactor(S.settings.diffIdx | 0, S) : 1));
    g += Math.min(p.bank | 0, g);                                         // transferred reserve can at most double output
    return g;
  };

  // ---- sliders -------------------------------------------------------------------------------------------------------------
  // Greedy auto-balance (research/06 §4.5): budget = 100 - locked; moved slider clamped to budget; others keep value in index order until budget runs out;
  // leftover goes to the last unlocked slider (normally TECH); if the moved slider IS the last unlocked, to the first unlocked.
  C.setSlider = function (S, E, p, idx, value) {
    const s = p.sliders, lk = p.lock;
    if (lk[idx]) return;
    let budget = 100; for (let i = 0; i < 5; i++) if (lk[i]) budget -= s[i];
    budget = Math.max(0, budget);
    const others = []; for (let i = 0; i < 5; i++) if (!lk[i] && i !== idx) others.push(i);
    if (!others.length) { s[idx] = budget; C.applyEcoFloor(S, E, p); return; }
    s[idx] = clamp(Math.round(value), 0, budget);
    let rem = budget - s[idx];
    for (const i of others) { const keep = Math.min(s[i], rem); s[i] = keep; rem -= keep; }   // others keep their value in index order while budget lasts
    if (rem > 0) {                                                                      // surplus → last unlocked slider (Tech); if that is the moved one → first unlocked
      let last = 4; while (last >= 0 && lk[last]) last--;
      s[last === idx ? others[0] : last] += rem;
    }
    C.applyEcoFloor(S, E, p);
  };

  // Minimum ECO % needed to keep the planet clean this turn (§3.4). Silicoids have none.
  C.ecoFloorPct = function (S, E, p) {
    if (E.race === 'silicoid' || !(p.spendable > 0)) return 0;
    const operating = Math.min(p.factories, Math.max(0, p.pop - (p.rebels | 0)) * C.oper(E));
    const newWaste = Math.floor(operating * C.wasteScale(E) / 10);
    const need = Math.floor((newWaste + (p.waste | 0)) / C.ecoN(E));       // BC to clear this turn's and old waste
    return clamp(Math.ceil(100 * need / p.spendable), 0, 100);
  };
  // The original's end-of-turn "eco on waste" update (research/04 verification C3): when ECO is below the floor it is raised to it and SHIP / DEF / IND each lose
  // value*diff/100 (integer division — NOT a share of the increase); TECH is then ALWAYS recomputed as the remainder 100 - SHIP - DEF - IND - ECO (never below 0, so the
  // total can be 101-102 after the truncations). Silicoids are skipped entirely. Locked sliders are respected (a remake option; the original ignores locks here).
  C.applyEcoFloor = function (S, E, p) {
    if (E.race === 'silicoid') return;
    const s = p.sliders, lk = p.lock;
    let f = C.ecoFloorPct(S, E, p), locked = 0;
    for (let i = 0; i < 5; i++) if (lk[i] && i !== ECO) locked += s[i];
    f = Math.min(f, 100 - locked);
    if (s[ECO] < f) {
      const diff = f - s[ECO];
      s[ECO] = f;
      for (const i of [SHIP, DEF, IND]) if (!lk[i]) s[i] -= Math.trunc(s[i] * diff / 100);
    }
    for (const i of [SHIP, DEF, IND]) if (s[i] < 0) s[i] = 0;
    s[ECO] = clamp(s[ECO], 0, 100);
    if (!lk[TECH]) s[TECH] = Math.max(0, 100 - s[SHIP] - s[DEF] - s[IND] - s[ECO]);
    else {
      // TECH cannot absorb the remainder: the raise must come out of the unlocked SHIP / DEF / IND (largest first) so the planet never spends > 100 %
      // (it did: [0,0,60,0,40] + locked TECH + floor 35 gave 114 %, and the next setSlider then wrote a negative slider); a shortfall goes to ECO
      let sum = s[SHIP] + s[DEF] + s[IND] + s[ECO] + s[TECH];
      while (sum > 100) {
        let best = -1; for (const i of [SHIP, DEF, IND]) if (!lk[i] && s[i] > 0 && (best < 0 || s[i] > s[best])) best = i;
        if (best < 0) break;
        const cut = Math.min(s[best], sum - 100); s[best] -= cut; sum -= cut;
      }
      if (sum < 100) s[ECO] += 100 - sum;
    }
  };

  // ---- one-turn phases (called by Econ.turn in the documented order) ---------------------------------------------------
  // WASTE → CLEANUP → ONE-TIME PROJECTS → TERRAFORM → BUY POP (§3.6), then population growth (§3.7). Returns events pushed to S.ev.
  C.buildEco = function (S, E, p) {
    const sil = E.race === 'silicoid';
    let eco = Math.floor(p.spendable * p.sliders[ECO] / 100);
    const operating = Math.min(p.factories, Math.max(0, p.pop - (p.rebels | 0)) * C.oper(E));
    if (!sil) {
      const newWaste = Math.floor(operating * C.wasteScale(E) / 10);
      const pct = Math.floor((p.waste | 0) * 100 / Math.max(1, p.mp2));
      p.waste = (p.waste | 0) + Math.floor((100 - pct) * newWaste / 100);
      if (p.unrest === 2) p.waste = 0;
      const n = C.ecoN(E), need = Math.floor(p.waste / n);
      // classic second term (Data.Config.QUIRKS.wasteSub1, research/04 C8): added AFTER the cleanup cost is known; a fully funded cleanup still wipes it
      const Q = M.Data.Config.QUIRKS;
      if (Q && Q.wasteSub1 === true) p.waste += Math.floor((100 - Math.floor(p.waste * 100 / Math.max(1, p.mp2))) * Math.floor(operating * C.oper(E) / 10) / 100);
      if (eco >= need) { eco -= need; p.waste = 0; } else { p.waste -= n * eco; eco = 0; }
      p.waste = clamp(p.waste, 0, Math.max(0, p.mp2 - 10));
    } else p.waste = 0;

    // one-time planet projects use the ECO budget first: three SEQUENTIAL blocks sharing one accumulator (research/04 verification C4) — a project finished this turn lets the
    // leftover flow into the next block. Atmospheric terraforming (hostile): at >= 200 BC. Soil enrichment (normal): at > 150 BC; the progress, capped at 150, is KEPT as the
    // start of advanced soil, so normal -> fertile -> gaia costs 300 in all. Advanced soil (normal or fertile): at > 300 BC, accumulator reset.
    if (!sil) {
      if (eco > 0 && E.mods.atmos && p.growth === 'hostile') {
        p.acc.eco += eco;
        if (p.acc.eco >= 200) { eco = p.acc.eco - 200; p.acc.eco = 0; C.atmosTerraform(S, E, p); } else eco = 0;
      }
      if (eco > 0 && E.mods.soil && p.growth === 'normal') {
        p.acc.eco += eco;
        if (p.acc.eco > 150) { eco = p.acc.eco - 150; p.acc.eco = Math.min(p.acc.eco, 150); C.soilEnrich(S, E, p, 'fertile'); } else eco = 0;
      }
      if (eco > 0 && E.mods.advSoil && (p.growth === 'normal' || p.growth === 'fertile')) {
        p.acc.eco += eco;
        if (p.acc.eco > 300) { eco = p.acc.eco - 300; p.acc.eco = 0; C.soilEnrich(S, E, p, 'gaia'); } else eco = 0;
      }
    }
    // terraforming increments
    const level = E.mods.terraform || 0, cost = Math.max(1, (E.mods.terraformCost || 5) - ((E.mods.terraformCostDelta | 0)));      // expansion: Terraforming Nanites
    if (eco > 0 && level > 0 && p.mp3 - p.mp2 < level && p.mp3 < MAX_POP) {
      const room = Math.min(level - (p.mp3 - p.mp2), MAX_POP - p.mp3);
      const inc = Math.min(room, Math.floor(eco / cost));
      if (inc > 0) { p.mp3 += inc; eco -= inc * cost; }
    }
    // buy population
    let boughtTenths = 0;
    if (eco > 0 && p.pop > 0) {
      let cpp = E.mods.incPopCost || 20; if (E.race === 'sakkra') cpp = Math.max(1, Math.floor(cpp * 2 / 3));
      let tenths = Math.floor(eco * 10 / cpp); if (sil) tenths = Math.floor(tenths / 2); if (E.race === 'sakkra') tenths *= 2;
      boughtTenths = Math.min(tenths, Math.floor(p.pop * 10 / 4));
    }
    C.growPop(S, E, p, boughtTenths);
  };

  // growth in tenths of a million (§3.7)
  C.growPop = function (S, E, p, boughtTenths) {
    if (p.pop <= 0 || p.typeIdx === 0) return;
    let v;
    if (E.race === 'silicoid') v = Math.trunc((100 - Math.floor(p.pop * 100 / p.mp3)) / 2);        // C integer division: toward zero when over capacity
    else {
      v = 100 - Math.floor(((p.pop + (p.waste | 0)) * 100) / p.mp3);
      switch (p.growth === 'hostile' && E.mods && E.mods.hostileGrowth ? 'normal' : p.growth) {     // expansion: Adaptive Genetics
        case 'hostile': v = v >= 0 ? Math.floor(v / 2) : v * 2; break;
        case 'fertile': v = v >= 0 ? v + Math.floor(v / 2) : Math.trunc(v * 2 / 3); break;
        case 'gaia': v = v >= 0 ? v * 2 : Math.trunc(v / 2); break;
        default: break;
      }
      if (E.race === 'sakkra') v *= 2;
    }
    if (v > 0 && E.mods && E.mods.growthPct) v = Math.floor(v * (100 + E.mods.growthPct) / 100);      // expansion: Accelerated Gestation / Hyper-Fertility
    let natural = Math.trunc((v * p.pop + 5) / 100);
    // original v1.3 quirk (research/04-verification C7): the carried tenths are added to the natural growth AND again to the total — small colonies grow ~2× faster than the
    // plain formula (pop 2 → 50 on a max-100 world takes 29 turns instead of 46). Switch off with Data.Config.QUIRKS.popTenthsTwice = false.
    if (!(M.Data.Config.QUIRKS && M.Data.Config.QUIRKS.popTenthsTwice === false)) natural += (p.popFrac | 0);
    if (v > 0 && natural < 1) natural = 1;
    const total = natural + (boughtTenths | 0) + (p.popFrac | 0);
    const dp = Math.floor(total / 10);                       // floor keeps the carried tenths in 0..9 even when shrinking
    const before = p.pop;
    p.pop += dp; p.popFrac = total - dp * 10;
    p.pop = clamp(p.pop, 0, p.mp3);
    if (p.pop === p.mp3) p.popFrac = 0;
    // the original's "population maximum" notice: the turn the colony fills up (Econ.autoSwitch then moves its surplus ECO share to TECH at the end of the turn)
    if (p.pop === p.mp3 && before < p.mp3 && E.human && M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'popMax', empire: E.id, planet: p.id, pop: p.pop });
  };

  C.soilInc = function (mp1, kind) {
    const Q = M.Data.Config.QUIRKS;
    if (Q && Q.soilRounding === true) {                         // 1oom v1.3: Fertile (m/20)*5 + ((m/20)%5 ? 5 : 0), Gaia with m/10; integer division, min 5
      const q = Math.floor(mp1 / (kind === 'gaia' ? 10 : 20));
      return Math.max(5, q * 5 + (q % 5 ? 5 : 0));
    }
    const step = v => Math.max(5, Math.ceil(v / 5) * 5);
    return kind === 'gaia' ? step(mp1 * 0.5) : step(mp1 * 0.25);
  };
  C.soilEnrich = function (S, E, p, kind, quiet) {
    const inc = C.soilInc(p.mp1, kind), oldMp2 = p.mp2;
    p.mp2 = p.mp1 + inc; p.mp3 += (p.mp2 - oldMp2);
    p.mp3 = Math.min(p.mp3, (E.mods.terraform || 0) + p.mp2, MAX_POP);
    p.growth = kind;
    if (!quiet && M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'ecoDone', empire: E.id, planet: p.id, growth: kind });       // "<planet> has terraformed to a fertile / Gaia environment" (research/05 §11.5)
  };
  C.atmosTerraform = function (S, E, p) {
    const inc = p.typeIdx <= 3 ? 20 : p.typeIdx <= 5 ? 10 : 0;
    p.type = 'minimal'; p.typeIdx = 7; p.growth = 'normal';
    p.mp1 += inc; p.mp2 += inc; p.mp3 += inc;
    if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'atmosDone', empire: E.id, planet: p.id });
  };

  // ---- defence: upgrade existing bases → planetary shield → new bases (§3.4/3.10) -----------------------------------
  C.shieldLevel = (S, p) => p.shield | 0;
  C.buildDefense = function (S, E, p) {
    let bc = C.richMul(p, Math.floor(p.spendable * p.sliders[DEF] / 100)) + p.acc.base;
    p.acc.base = 0;
    if (bc <= 0) return;
    const Dz = M.Sim.Design, baseCost = Dz ? Dz.baseCost(S, E) : 250;
    // 1. upgrade existing bases to current cost
    if (p.bases > 0 && baseCost > p.baseCostPaid) {
      const need = (baseCost - p.baseCostPaid) * p.bases;
      if (bc >= need) { bc -= need; p.baseCostPaid = baseCost; } else { p.baseCostPaid += Math.floor(bc / p.bases); bc = bc % p.bases; }
    }
    // 2. planetary shield (not inside nebulae)
    const maxShield = E.mods.planetShield || 0, shieldCost = E.mods.planetShieldCost || 0;
    if (maxShield > 0 && p.shield < maxShield && !S.stars[p.starId].nebula) {
      const need = Math.max(0, shieldCostFor(E, maxShield) - shieldCostFor(E, p.shield) - p.acc.shield);
      const put = Math.min(bc, need); bc -= put; p.acc.shield += put;
      const paidTotal = shieldCostFor(E, p.shield) + p.acc.shield;       // cumulative cost: 500 / 1000 / 1500 / 2000 for Class V / X / XV / XX
      let lvl = p.shield; for (const L of [5, 10, 15, 20]) if (L <= maxShield && L > p.shield && paidTotal >= shieldCostFor(E, L)) lvl = L;
      if (lvl > p.shield) { p.acc.shield = paidTotal - shieldCostFor(E, lvl); p.shield = lvl; if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'shieldDone', empire: E.id, planet: p.id, shield: lvl }); }     // "<planet> has finished a planetary shield <n>"
    }
    // 3. new missile bases
    if (bc > 0 && baseCost > 0) {
      const n = Math.floor(bc / baseCost); if (n > 0) { p.bases += n; bc -= n * baseCost; p.baseCostPaid = baseCost; }
    }
    p.acc.base = bc;
  };
  function shieldCostFor(E, level) { return level <= 0 ? 0 : (level / 5) * 500; }

  // ---- ships ------------------------------------------------------------------------------------------------------------------
  // a finished item switches its slider off by moving the percentage to TECH (human planets only, locks respected) — the sliders must keep summing to 100
  C.shipToTech = function (E, p) {
    if (!E.human || p.lock[SHIP] || p.lock[TECH]) return;
    p.sliders[TECH] += p.sliders[SHIP]; p.sliders[SHIP] = 0;
  };
  C.buildShips = function (S, E, p, out) {
    let bc = C.richMul(p, Math.floor(p.spendable * p.sliders[SHIP] / 100)) + p.acc.ship;
    if (p.sliders[SHIP] > 0 && M.Data.Config.QUIRKS && M.Data.Config.QUIRKS.shipBonusBC === true) bc += 1;   // original bug (research/04 C9): +1 BC after carry and richness
    p.acc.ship = bc;
    if (p.sliders[SHIP] === 0 && bc <= 0) return;
    if (p.build === -1) {                                            // stargate (original: excess BC carry, build item resets to design 0, a human's SHIP percentage moves to TECH)
      if (p.stargate) { C.shipToTech(E, p); p.build = 0; return; }
      if (p.acc.ship >= 3000) { p.stargate = true; p.acc.ship -= 3000; p.build = 0; C.shipToTech(E, p); M.Sim.Ev && M.Sim.Ev.push(S, { type: 'notice', kind: 'stargate', empire: E.id, planet: p.id }); }
      return;
    }
    const d = E.designs[p.build]; if (!d) return;
    const cost = Math.max(1, M.Sim.Design.cost(S, E, p.build));
    const n = Math.min(32000, Math.floor(p.acc.ship / cost));
    if (n > 0) { p.acc.ship -= n * cost; out.push({ planet: p.id, design: p.build, count: n }); }
  };

  // ---- industry (factories) ---------------------------------------------------------------------------------------------
  C.buildIndustry = function (S, E, p) {
    let bc = C.richMul(p, Math.floor(p.spendable * p.sliders[IND] / 100)) + p.acc.factory;
    const max = C.maxFactories(E, p), cost = Math.max(1, C.factoryCost(E));
    if (p.factories >= max) { E.bc += Math.floor(bc / 2); p.acc.factory = 0; return true; }       // surplus at 50% to the reserve
    const n = Math.min(Math.floor(bc / cost), max - p.factories);
    p.factories += n; bc -= n * cost;
    if (p.factories >= max) { E.bc += Math.floor(bc / 2); bc = 0; return true; }
    p.acc.factory = bc; return false;
  };

  // ---- queries used by the UI ---------------------------------------------------------------------------------------------
  // "readouts" shown next to each slider (research/06 §4.5)
  C.readouts = function (S, E, p) {
    const sp = p.spendable | 0, s = p.sliders, R = C.richMul;
    const out = {};
    const shipBC = R(p, Math.floor(sp * s[SHIP] / 100));
    const d = E.designs[p.build], cost = d ? M.Sim.Design.cost(S, E, p.build) : 0;
    out.ship = shipBC <= 0 ? { text: 'NONE' } : p.build === -1 ? { text: Math.ceil(Math.max(0, 3000 - p.acc.ship) / shipBC) + ' Y' } : { text: Math.max(1, Math.ceil((cost - p.acc.ship) / shipBC)) + ' Y', years: Math.ceil(cost / shipBC) };
    const defBC = R(p, Math.floor(sp * s[DEF] / 100));
    out.def = defBC <= 0 ? { text: 'NONE' } : { text: Math.max(1, Math.ceil((M.Sim.Design.baseCost(S, E)) / defBC)) + ' Y' };
    const indBC = R(p, Math.floor(sp * s[IND] / 100)), max = C.maxFactories(E, p);
    out.ind = p.factories >= max ? { text: 'MAX' } : indBC <= 0 ? { text: 'NONE' } : { text: (Math.round(indBC / Math.max(1, C.factoryCost(E)) * 10) / 10) + '/Y', perYear: indBC / C.factoryCost(E) };
    const floor = C.ecoFloorPct(S, E, p);
    out.eco = s[ECO] < floor ? { text: 'WASTE' } : (p.waste > 0 ? { text: 'CLEAN' } : { text: 'CLEAN' });
    out.tech = { text: Math.floor(sp * s[TECH] / 100) + ' RP', rp: Math.floor(sp * s[TECH] / 100) };
    return out;
  };
});
