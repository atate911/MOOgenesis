// Hooks of the expansion techs (js/data/techs-x.js, the Tech Lab experiment). Worker-safe. Every helper returns at once for an empire that owns none of the
// expansion techs (their effect keys are simply absent from E.mods), so a classic game runs exactly as before — no extra RNG draws, no changed numbers.
//
// MOO.Sim.XTech
//   m(E, key) → number            effect value from E.mods (0 when absent)
//   count(S, key, amount)          lab telemetry: only when S.xstats exists (tools/techlab sets it); never written in a normal game
//   improve(S, E, p) / improveAll(S, E)    permanent planet improvements (arcology / domes / smallWorld): max population +pct of the base (≥ 5), once per planet
//                                  and kind (p.xi = {kind: amount}); a captured planet keeps them. Called by Research.grant, Colony.found, Ground.capture.
//   grossPct(S, E, p)              production bonus of the planet (asteroid fields)
//   combatMod(E) → xm | null       the ship / base modifiers a battle side carries (sim/combat.js empireSide)
//   weightPct(xm, ss) / planetWeightPct(xm) / MINE_FACTOR(xm)   their worth in the AI-vs-AI weight model (percent of a design's / the planet's weight)
//   preApply(S, res) / postApply(S, res, R)   battle results: escape (before casualties), salvage + reverse engineering (after)
//   evacuate(S, E, p, pop)         lifeboats: part of `pop` lands on the nearest own colony with room
//   siegeFloor(S, p) → pop         the population bombardment / battle collateral may not push the colony below
//   warpFor(S, E, from, to, warp)  fleet speed with slipstream drives and navigation beacons
MOO.def(function (M) {
  'use strict';
  const X = M.Sim.XTech = {};
  const MAX_POP = 300;
  const mods = E => (E && E.mods) || {};
  X.m = (E, k) => mods(E)[k] || 0;

  // ---- lab telemetry --------------------------------------------------------------------------------------------------------------------------------
  X.count = function (S, key, amount) {
    const st = S && S.xstats; if (!st) return;
    const o = st[key] || (st[key] = { n: 0, sum: 0 });
    o.n++; o.sum += amount || 0;
  };

  // ---- permanent planet improvements --------------------------------------------------------------------------------------------------------------------
  const round5 = v => Math.max(5, Math.ceil(v / 5) * 5);
  const IMPROVE = {
    arcology: () => true,
    domes: p => p.typeIdx >= 1 && p.typeIdx <= 6,                               // the hostile types (Galaxy.isHostile)
    smallWorld: p => (p.maxPop | 0) > 0 && (p.maxPop | 0) <= 40,
  };
  X.improve = function (S, E, p) {
    const m = mods(E); let any = 0;
    if (!p || p.typeIdx <= 0) return 0;
    for (const k in IMPROVE) {
      const pct = m[k];
      if (!pct || !IMPROVE[k](p) || (p.xi && p.xi[k])) continue;
      const a = round5((p.mp1 || p.maxPop || 0) * pct / 100);
      (p.xi || (p.xi = {}))[k] = a;
      p.mp1 = Math.min(MAX_POP, (p.mp1 | 0) + a); p.mp2 = Math.min(MAX_POP, (p.mp2 | 0) + a); p.mp3 = Math.min(MAX_POP, (p.mp3 | 0) + a);
      X.count(S, k, a); any++;
    }
    return any;
  };
  X.improveAll = function (S, E) { let n = 0; for (const p of S.planets) if (p.owner === E.id) n += X.improve(S, E, p); return n; };

  // ---- production ---------------------------------------------------------------------------------------------------------------------------------------
  X.grossPct = function (S, E, p) {
    const a = mods(E).asteroid; if (!a) return 0;
    return p.rocks === 'many' ? 2 * a : p.rocks === 'some' ? a : 0;
  };

  // ---- combat -------------------------------------------------------------------------------------------------------------------------------------------
  X.combatMod = function (E) {
    const m = mods(E);
    const xm = { comp: m.xcomp | 0, def: m.xdef | 0, mdef: m.xmdef | 0, absorb: m.xabsorb | 0, hpPct: m.xhpPct | 0, repair: m.xrepair | 0, misshield: m.xmisshield | 0,
      speed: m.xspeed | 0, init: m.xinit | 0, warhead: m.warheadPct | 0, mines: m.mines | 0, baseComp: m.baseCompX | 0, baseHpPct: m.baseHpPct | 0, pshield: m.pshieldX | 0 };
    for (const k in xm) if (xm[k]) return xm;
    return null;
  };
  // AI-vs-AI weights (research/03 §4.12 has no term for any of these): percent of the design weight per unit of effect. Calibrated against the tactical
  // engine by tools/techlab/combat.js (the same fleets fought out with and without the effect); see tools/techlab/REPORT.md.
  // round 1 (tools/out/techlab/combat-r1.json, 92 fleet + 21 planet battles, 32 fights per condition): +1 attack ≈ +17 % ships, +2 ≈ +36 %; +1 beam defence ≈ +5 %;
  // +2 missile defence ≈ +17 %; +1 / +2 absorption ≈ +13 / +25 % of a shielded design; +15 % hit points ≈ +5.6 %; 5 % repair ≈ +2.4 %; 20 % interception ≈ +5 %;
  // +1 speed and +2 initiative ≈ +12.7 %; +25 % warheads ≈ +16 % of a missile design; bases: +2 attack ≈ +21 %, +50 % hit points ≈ +40 %, +5 planetary shield ≈ 0;
  // minefields of 8 % ≈ the defence worth 12 % more bases, i.e. the attacker's weight × 0.89.
  X.WEIGHT = { comp: 17.5, def: 5, mdef: 8.5, absorb: 12.5, hpPct: 0.37, repair: 0.48, misshield: 0.25, speed: 10, init: 1.35, warhead: 0.63 };
  X.PLANET_WEIGHT = { baseComp: 10.6, baseHpPct: 0.79, pshield: 0 };
  X.MINE_WEIGHT = 1.35;
  X.weightPct = function (xm, ss) {
    if (!xm || !ss) return 0;
    const W = X.WEIGHT;
    let pct = W.comp * xm.comp + W.def * xm.def + W.mdef * xm.mdef + W.hpPct * xm.hpPct + W.speed * xm.speed + W.init * xm.init;
    if (xm.absorb && (ss.absorb | 0) > 0) pct += W.absorb * xm.absorb;
    if (xm.repair > (ss.repair | 0)) pct += W.repair * (xm.repair - (ss.repair | 0));
    if (xm.misshield > (ss.misshield | 0)) pct += W.misshield * (xm.misshield - (ss.misshield | 0));
    if (xm.warhead && (ss.weapons || []).some(w => w.kind === 'missile' || w.kind === 'torpedo')) pct += W.warhead * xm.warhead;
    return pct;
  };
  X.planetWeightPct = function (xm) { if (!xm) return 0; const W = X.PLANET_WEIGHT; return W.baseComp * xm.baseComp + W.baseHpPct * xm.baseHpPct + W.pshield * xm.pshield; };
  X.mineFactor = xm => (xm && xm.mines ? Math.max(0, 100 - X.MINE_WEIGHT * xm.mines) / 100 : 1);

  // before the casualties of a battle are applied: emergency warp saves part of the LOSER's losses (the survivors then retreat as usual)
  X.preApply = function (S, res) {
    if (!res || !res.sides || res.winner === undefined) return;
    const l = res.sides[1 - res.winner];
    if (!l || l.empire < 0 || !l.lost) return;
    const esc = X.m(S.empires[l.empire], 'escape'); if (!esc) return;
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const r = Math.floor((l.lost[k] | 0) * esc / 100);
      if (r <= 0) continue;
      l.lost[k] -= r; if (l.survivors) l.survivors[k] = (l.survivors[k] | 0) + r; n += r;
    }
    if (n) { l.escaped = n; l.destroyed = false; X.count(S, 'escape', n); }
  };
  // after the casualties: salvage and reverse engineering for the WINNER
  X.postApply = function (S, res, R) {
    if (!res || !res.sides || res.winner === undefined) return;
    const w = res.sides[res.winner], l = res.sides[1 - res.winner];
    if (!w || !l || w.empire < 0 || l.empire < 0) return;
    const W = S.empires[w.empire], L = S.empires[l.empire];
    let lost = 0; for (let k = 0; k < 6; k++) lost += l.lost ? l.lost[k] | 0 : 0;
    if (!W || !L || lost <= 0) return;
    const sv = X.m(W, 'salvage');
    if (sv) {
      let val = 0;
      for (let k = 0; k < 6; k++) if ((l.lost[k] | 0) > 0 && L.designs && L.designs[k]) val += l.lost[k] * M.Sim.Design.cost(S, L, k);
      const bc = Math.floor(val * sv / 100);
      if (bc > 0) { W.bc = (W.bc | 0) + bc; X.count(S, 'salvage', bc); if (W.human && M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'salvage', empire: W.id, star: res.star, bc }); }
    }
    const re = X.m(W, 'reverseEng');
    if (re && R && R.int(1, 100) <= re && M.Sim.Ground && M.Sim.Ground.techCandidates) {
      const tl = W.research.tl, cand = M.Sim.Ground.techCandidates(S, W, L, R, { max: 6 }).filter(c => c.level <= (tl[c.field] | 0) + 5);
      if (cand.length) {
        cand.sort((a, b) => b.value - a.value);
        const c = cand[0];
        if (M.Sim.Research.grant(S, W, c.field, c.level, 'loot')) {
          X.count(S, 'reverseEng', 1);
          if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'news', cat: 'reverseEngineered', empire: W.id, empire2: L.id, star: res.star, tech: c.name, importance: 0,
            headline: (W.plural || W.name) + ' engineers reverse-engineer ' + c.name + ' from ' + (L.name || 'enemy') + ' wrecks' });
        }
      }
    }
  };

  // ---- sieges and lost colonies ----------------------------------------------------------------------------------------------------------------------------
  X.siegeFloor = function (S, p) {
    if (!p || p.owner < 0) return 0;
    const f = X.m(S.empires[p.owner], 'siegeFloor');
    return f ? Math.max(1, Math.floor((p.mp3 | 0) * f / 100)) : 0;
  };
  // part of `pop` (the colony's population before it fell) lands on E's nearest colony with room
  X.evacuate = function (S, E, p, pop) {
    const ev = X.m(E, 'evacuate'); if (!ev || !E.alive) return 0;
    let n = Math.floor((pop | 0) * ev / 100); if (n <= 0) return 0;
    const A = S.stars[p.starId];
    let best = null, bd = Infinity;
    for (const q of S.planets) {
      if (q.owner !== E.id || q.id === p.id || (q.pop | 0) >= (q.mp3 | 0)) continue;
      const B = S.stars[q.starId], d = Math.hypot(B.x - A.x, B.y - A.y);
      if (d < bd) { bd = d; best = q; }
    }
    if (!best) return 0;
    n = Math.min(n, (best.mp3 | 0) - (best.pop | 0));
    best.pop += n;
    X.count(S, 'evacuate', n);
    if (E.human && M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'evacuated', empire: E.id, planet: best.id, from: p.id, n });
    return n;
  };

  // ---- movement --------------------------------------------------------------------------------------------------------------------------------------------
  X.warpFor = function (S, E, from, to, warp) {
    let w = warp + X.m(E, 'warpBonus');
    const b = X.m(E, 'beaconWarp');
    if (b && S.planets[from] && S.planets[to] && S.planets[from].owner === E.id && S.planets[to].owner === E.id) w += b;
    return w;
  };
});
