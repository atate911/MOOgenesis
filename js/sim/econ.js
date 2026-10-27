// Empire-level economy + the ordered production phases of a turn (research/04 §3.3, §7). Worker-safe.
// Phases (called by sim/turn.js in this order):  stepProduction → stepEco → stepResearchTotal → stepDefense → stepShips → stepReserve → stepIndustry … refresh
MOO.def(function (M) {
  'use strict';
  const X = M.Sim.Econ = {};
  const C = M.Sim.Colony, F = M.Sim.Fleet, Ev = M.Sim.Ev, O = M.Sim.Orders;
  const owned = (S, e) => S.planets.filter(p => p.owner === e);

  // difficulty production factor for AI empires (percent). See data/config.js (Data.Config.aiProdFactor); default neutral.
  // ---- (6) update production: gross → upkeep/tax/security → spendable per planet ------------------------------------------------------------
  X.stepProduction = function (S) {
    for (const E of S.empires) {
      if (!E.alive) continue;
      const ps = owned(S, E.id);
      let G = 0, bases = 0, gates = 0;
      for (const p of ps) { p.gross = C.gross(S, E, p); G += p.gross; bases += p.bases | 0; if (p.stargate) gates++; }
      const upk = (E.mods && E.mods.shipUpkeepPct) || 100;                 // expansion: Orbital Drydocks
      const shipM = Math.min(32000, Math.floor(F.shipValue(S, E) * upk / 5000)) + 100 * gates;
      const baseM = Math.floor(bases * M.Sim.Design.baseCost(S, E) / 50);
      const trade = M.Sim.Diplo && M.Sim.Diplo.tradeIncome ? M.Sim.Diplo.tradeIncome(S, E) : 0;
      const spying = (E.spyBudget || []).reduce((a, b) => a + (b | 0), 0);
      let net = Math.floor(G * (1000 - (E.security | 0) - spying) / 1000) + trade - shipM - baseM - Math.floor(G * (E.tax | 0) / 1000);
      net = Math.max(1, net);
      const factor = G > 0 ? Math.floor(net * 100 / G) : 100;
      for (const p of ps) { p.spendable = Math.max(0, Math.floor(p.gross * factor / 100) - (p.transCost | 0)); }
      E.flow = { gross: G, shipM, baseM, trade, net, factor, tax: Math.floor(G * (E.tax | 0) / 1000), taxToReserve: Math.floor(G * (E.tax | 0) / 2000), security: Math.floor(G * (E.security | 0) / 1000), spying: Math.floor(G * spying / 1000) };
    }
  };

  // ---- (7) ecology & growth ------------------------------------------------------------------------------------------------------------------
  X.stepEco = function (S) {
    for (const p of S.planets) { if (p.owner < 0) continue; C.buildEco(S, S.empires[p.owner], p); }
  };

  // ---- (8) total research points per empire ---------------------------------------------------------------------------------------------------
  X.stepResearchTotal = function (S) {
    for (const E of S.empires) {
      if (!E.alive) continue;
      let t = 0;
      for (const p of owned(S, E.id)) { if (p.event && (p.event.type === 'plague' || p.event.type === 'nova')) continue; t += M.Sim.Research.planetRP(E, p, p.spendable); }
      const rt = E.mods && E.mods.rpTreaty;                                  // expansion: Scientific Exchange Protocols — +rt % per pact / alliance partner (≤ 4)
      if (rt && t > 0) {
        let n = 0;
        for (const r of E.relations || []) if (r.with !== E.id && (r.treaty === 1 || r.treaty === 2) && S.empires[r.with] && S.empires[r.with].alive) n++;
        if (n) t = Math.min(32767, Math.floor(t * (100 + rt * Math.min(4, n)) / 100));
      }
      const St = M.Sim.Strat, pp = St && t > 0 ? St.researchPct(S, E) : 0;                // Strategic choices: research pacts
      if (pp) t = Math.min(32767, Math.floor(t * (100 + pp) / 100));
      E.research.total = t;
    }
  };

  // ---- (12) defence, (13) ships, (14) reserve, (15) industry ---------------------------------------------------------------------------------------
  X.stepDefense = function (S) { for (const p of S.planets) if (p.owner >= 0) C.buildDefense(S, S.empires[p.owner], p); };

  X.stepShips = function (S) {
    const built = [];
    if (F.fixReloc) F.fixReloc(S);                                       // rally lines to a lost planet point home again before ships are dispatched
    for (const E of S.empires) if (E.alive && M.Sim.Design.refresh) M.Sim.Design.refresh(S, E);
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      const E = S.empires[p.owner], out = [];
      C.buildShips(S, E, p, out);
      for (const b of out) {
        const f = F.addShips(S, E.id, p.starId, b.design, b.count);
        built.push({ empire: E.id, planet: p.id, design: b.design, count: b.count });
        if (Ev) Ev.push(S, { type: 'built', empire: E.id, planet: p.id, design: b.design, count: b.count });
        if (p.reloc >= 0 && p.reloc !== p.starId && S.planets[p.reloc] && S.planets[p.reloc].owner === E.id) {
          const counts = [0, 0, 0, 0, 0, 0]; counts[b.design] = b.count;
          const r = F.send(S, E, p.starId, p.reloc, counts); void f; void r;     // out-of-range rally points simply leave the ships in orbit
        }
      }
    }
    return built;
  };

  X.stepReserve = function (S) {
    for (const E of S.empires) {
      if (!E.alive) continue;
      for (const p of owned(S, E.id)) p.bank = Math.max(0, (p.bank | 0) - Math.floor(p.spendable / 2));
      E.bc += E.flow ? E.flow.taxToReserve : 0;
      const ri = E.mods && E.mods.reserveInterest;                           // expansion: Galactic Banking Network — at most a tenth of gross production
      if (ri && E.bc > 0) { const i = Math.min(Math.floor(E.bc * ri / 100), Math.floor(((E.flow && E.flow.gross) | 0) / 10)); if (i > 0) { E.bc += i; if (M.Sim.XTech) M.Sim.XTech.count(S, 'reserveInterest', i); } }
    }
  };

  X.stepIndustry = function (S) {
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      const E = S.empires[p.owner];
      const maxed = C.buildIndustry(S, E, p);
      if (maxed && p.sliders[2] > 0 && E.human && Ev) {
        Ev.push(S, { type: 'notice', kind: 'industryMax', empire: E.id, planet: p.id, factories: p.factories });
      }
    }
  };

  // ---- end-of-turn tidy: auto-switch finished sliders (human planets), recompute ECO floor and next turn's numbers ------------------------------
  X.autoSwitch = function (S) {
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      const E = S.empires[p.owner]; if (!E.human) continue;
      const s = p.sliders;
      if (s[2] > 0 && p.factories >= C.maxFactories(E, p)) { s[4] += s[2]; s[2] = 0; }                 // factories maxed → Tech
      const floor = C.ecoFloorPct(S, E, p);
      const atMax = p.pop >= p.mp3 && !(E.mods.terraform > 0 && p.mp3 - p.mp2 < E.mods.terraform) && p.growth !== 'hostile';
      if (atMax && s[3] > floor + 7) { s[4] += s[3] - floor; s[3] = floor; }
    }
  };
  X.refresh = function (S) {
    X.stepProduction(S);
    for (const p of S.planets) if (p.owner >= 0) C.applyEcoFloor(S, S.empires[p.owner], p);
    X.stepResearchTotal(S);                                  // slider changes (and the ECO floor) alter the RP: keep E.research.total current between turns
  };

  // ---- orders: sliders, build item, tax, security, reserve transfer ---------------------------------------------------------------------------------
  O.register('slider', function (S, E, o) {
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    const idx = O.int(o.index, 0, 4), v = O.num(o.value, 0, 100); if (idx === null || v === null) return O.fail('bad slider');
    C.setSlider(S, E, p, idx, v); return O.ok();
  });
  // set all five planet sliders at once (AI planners; values must sum to 100). The ECO floor then lifts ECO if the planet would pollute.
  O.register('sliders', function (S, E, o) {
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    const v = (Array.isArray(o.values) ? o.values : []).map(x => (Number.isFinite(x) ? Math.max(0, Math.round(x)) : NaN));
    if (v.length !== 5 || v.some(x => !Number.isFinite(x)) || v.reduce((a, b) => a + b, 0) !== 100) return O.fail('sliders must sum to 100');
    p.sliders = v; C.applyEcoFloor(S, E, p); return O.ok();
  });
  // AI memory lives in E.ai; planners are pure, so they return patches that the main thread merges
  O.register('aiState', function (S, E, o) { E.ai = Object.assign(E.ai || {}, o.patch || {}); return O.ok(); });
  O.register('sliderLock', function (S, E, o) {
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    const idx = O.int(o.index, 0, 4); if (idx === null) return O.fail('bad slider');
    p.lock[idx] = !!o.locked; return O.ok();
  });
  O.register('build', function (S, E, o) {
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    if (o.design === -1) { if (!E.mods.stargate) return O.fail('no stargate technology'); if (p.stargate) return O.fail('already has a stargate'); p.build = -1; return O.ok(); }
    const d = O.int(o.design, 0, 5); if (d === null || !E.designs[d]) return O.fail('no such design');     // a non-integer key ('length') used to throw inside the turn
    p.build = d; return O.ok();
  });
  O.register('rename', function (S, E, o) {
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    const n = String(o.name || '').replace(/[^\w \-']/g, '').trim().slice(0, 11); if (!n) return O.fail('empty name');
    p.name = n; return O.ok();
  });
  O.register('tax', function (S, E, o) { const v = O.num(o.value, 0, 200); if (v === null) return O.fail('bad value'); E.tax = Math.round(v); return O.ok(); });
  O.register('security', function (S, E, o) { const v = O.num(o.value, 0, 200); if (v === null) return O.fail('bad value'); E.security = Math.round(v); return O.ok(); });
  O.register('transfer', function (S, E, o) {   // reserve → planet bank (planet can spend up to 2× its output with it)
    const p = S.planets[o.planet]; if (!p || p.owner !== E.id) return O.fail('not your planet');
    const want = O.num(o.amount, 0, 1e9); if (want === null) return O.fail('bad amount');
    const amt = Math.max(0, Math.min(Math.floor(want), E.bc)); E.bc -= amt; p.bank = (p.bank | 0) + amt; return O.ok({ moved: amt });
  });
});
