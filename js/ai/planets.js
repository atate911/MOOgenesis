// AI step 50 — planet spending sliders (original "p3"; research/07 §2.3–§2.7, §11.1, §12 P50 · research/01 §5.4). Pure planner: emits `sliders` orders + an `aiState` countdown patch.
// Every 2–6 turns each planet's sliders are re-rolled: ECO is forced to the waste-neutralising percentage, SHIP/DEF/IND/TECH get the fixed floors (gated on ECO), young planets IND 50, the race and
// planet-special adds, and the rest is dealt in 3..10 % chunks by the objective's weight row (the War row while at war). Every turn a planet that has maxed its factories moves its industry share
// to defence and research, and a planet with many missile bases and a good shield turns its defence share into ships.
//
// QUIRKS (AI.QUIRKS.<name>; true = the original v1.3 behaviour, false = fixed; options.aiClassic switches ALL of them on).  Defaults in brackets.
//   sliderOverspend      [false] §2.3 g: the allocation is NOT clamped — young planets with ECO > 15, Meklar and Rich/Artifacts planets can total > 100 % for the turn (a free over-spend).
//                        Fixed: the five sliders always total exactly 100 (TECH, IND, DEF, SHIP are trimmed in that order; ECO never).  When ON the planner emits the over-100 vector as a
//                        `slidersRaw` order (registered below, AI empires only) and, at the next plan, applies the ORIGINAL END-OF-TURN NORMALISER (§2.7, game_update_eco_on_waste):
//                        TECH := max(0, 100 − SHIP − DEF − IND − ECO).  SHIP/DEF/IND/ECO are never trimmed, so a planet whose other four sliders total more than 100 keeps that total (TECH 0) until
//                        the next rebalance.  (Sim note: Colony.applyEcoFloor's final `TECH += 100 − sum` can drive TECH negative in that state — see the notes file.)
//   fleetCheatBug        [false] §2.5: base saturation (> 4 bases, bases·3 ≥ pop/(5−d), shield up to date) does SHIP += SHIP (the slider doubles every turn, 16-bit wrap → 0) and DEF = 0;
//                        fixed (Classic+): SHIP += DEF, DEF = 0.  ON uses `slidersRaw` as well.
//   ecoWeightIsIndustry  [true]  §2.3 (3) / §11.5 #6: the ecology chunk threshold re-uses the INDUSTRY column (w_eco = w_ind + c2); column 3 of the table is never read.  OFF: w_eco = w_ind + c3.
//   silicoidEcoRatchet   [true]  §2.3 (2) / §11.5 #9: Silicoids have no waste, so the "force ECO to the waste percentage" step (and the end-of-turn normaliser) skips them: their ECO is never reset and
//                        accumulates over the rebalances.  OFF: Silicoid planets are treated like every other race (ECO reset to 0 + chunks).  Unverified strength effect — see the notes.
//
// STATE  E.ai.countdown  rebalance countdown (setup.js: 15..20 / 25..30 turns; afterwards rnd(5)+1 = 2..6).  It is decremented first and the rebalance runs when the result is ≤ 0.
// SHARED ctx.sliders()/setSliders() overlay: panic mode (economy.js, step 40) edits the sliders first; this step starts from the planned values.   ctx.shared.rawSliders = {planetId: vector}.
// EXPORTS AI.Planets = { W, thresholds, allocate, trim, normalise, tweak, rebalanceRow }  (for tests and tools).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, O = M.Sim.Orders;
  AI.QUIRKS = AI.QUIRKS || {};
  const QDEF = { sliderOverspend: false, fleetCheatBug: false, ecoWeightIsIndustry: true, silicoidEcoRatchet: true };
  for (const q in QDEF) if (AI.QUIRKS[q] === undefined) AI.QUIRKS[q] = QDEF[q];

  // weight rows c0..c3 = ship, def, ind, eco, indexed by objective 0..5 (diplomat … ecologist) + 6 = War (research/07 §2.4; the research columns live in research.js)
  const W = [[1, 2, 4, 1], [4, 1, 2, 1], [2, 4, 1, 1], [1, 2, 3, 1], [1, 2, 4, 1], [1, 1, 2, 4], [4, 1, 1, 1]];
  AI.PLANET_WEIGHTS = W;
  const SHIP = 0, DEF = 1, IND = 2, ECO = 3, TECH = 4;
  const sum5 = v => v[0] + v[1] + v[2] + v[3] + v[4];

  // cumulative chunk thresholds of a row: r1 = rnd(13); r1 ≤ ship → SHIP, ≤ def → DEF, ≤ ind → IND, ≤ eco → ECO, else TECH
  function thresholds(T, ecoIsInd) {
    const ship = T[0], def = ship + T[1], ind = def + T[2];
    return [ship, def, ind, ind + (ecoIsInd ? T[2] : T[3])];
  }

  // The allocation of one planet at a rebalance (research/07 §2.3 steps 4a–4g).  `eco0` = ECO after the forcing step.  p needs pop, mp2, mp3, special; am = Data.Races ai hooks.
  // Returns [ship, def, ind, eco, tech] — NOT clamped to 100 (a total above 100 is the original's free over-spend).
  function allocate(R, T, p, am, eco0, ecoIsInd) {
    am = am || {};
    let ship = 0, def = 0, ind = 0, tech = 0, eco = eco0;
    if (eco < 96) ship = 5;
    if (eco < 91) def = 5;
    if (eco < 81) ind = 10;
    if (eco < 71) tech = 25;
    if (p.pop < Math.floor(p.mp3 * 3 / 4)) ind = 50;                                     // young planet: factories first (replaces the floor)
    const es = am.ecoSlider;
    if (es && es.add && (!es.belowMp2 || p.pop < p.mp2)) eco += es.add;                     // Bulrathi/Sakkra +10, Klackon +15 while still growing
    ind += am.indSlider | 0; tech += am.techSlider | 0; ship += am.shipSlider | 0;          // Meklar IND +20, Psilon TECH +20, Mrrshan SHIP +15
    if (p.special === 'artifacts' || p.special === 'orion') tech += 20;
    if (p.special === 'rich' || p.special === 'ultrarich' || p.special === 'orion') { ind += 20; ship += 10; }
    const th = thresholds(T, ecoIsInd);
    let left = 100 - ship - def - ind - eco - tech;
    while (left > 0) {
      const r1 = R.int(1, 13), r2 = Math.min(R.int(1, 8) + 2, left); left -= r2;
      if (r1 <= th[0]) ship += r2; else if (r1 <= th[1]) def += r2; else if (r1 <= th[2]) ind += r2; else if (r1 <= th[3]) eco += r2; else tech += r2;
    }
    return [ship, def, ind, eco, tech];
  }

  // fixed behaviour: integer sliders totalling exactly 100.  Too much → trim TECH, IND, DEF, SHIP in that order (ECO never); too little → the rest goes to TECH (= the end-of-turn normaliser).
  function trim(v) {
    v = v.map(x => (x > 0 ? Math.trunc(x) : 0)); v[ECO] = Math.min(v[ECO], 100);
    let sum = sum5(v);
    for (const i of [TECH, IND, DEF, SHIP]) { if (sum <= 100) break; const d = Math.min(v[i], sum - 100); v[i] -= d; sum -= d; }
    if (sum < 100) v[TECH] += 100 - sum;
    return v;
  }
  // the original end-of-turn normaliser (§2.7) applied to a vector: clamps, then TECH := max(0, 100 − the other four).  The total may stay above 100.
  function normalise(v) {
    v = v.map(x => (x > 0 ? Math.trunc(x) : 0)); v[ECO] = Math.min(v[ECO], 100);
    v[TECH] = Math.max(0, 100 - v[SHIP] - v[DEF] - v[IND] - v[ECO]);
    return v;
  }

  // the every-turn tweaks on a slider vector (mutates it).  p: the planet; E: the empire; oper = factories per colonist; diff = difficulty index; cheat = the fleetCheatBug quirk.
  function tweak(s, p, E, oper, diff, cheat) {
    if (p.factories >= p.pop * oper && s[IND] > 0) {                                      // factories maxed: half of IND to defence, the rest (odd unit included) to research
      const half = Math.floor(s[IND] / 2); s[DEF] += half; s[TECH] += s[IND] - half; s[IND] = 0;
    }
    if (p.bases > 4 && p.bases * 3 >= Math.floor(p.pop / (5 - diff)) && (p.shield | 0) >= ((E.mods && E.mods.planetShield) | 0)) {   // missile-base saturation
      if (cheat) { s[SHIP] = (((s[SHIP] * 2) << 16) >> 16); if (s[SHIP] < 0) s[SHIP] = 0; } else s[SHIP] += s[DEF];
      s[DEF] = 0;
    }
    return s;
  }

  const rebalanceRow = (ctx, atWar) => (atWar ? 6 : ctx.obj);

  // ---- raw (over-100) vectors: the quirk path ----------------------------------------------------------------------------------------------------------------
  // ctx.finish() only knows `sliders` (sum must be 100).  A raw vector is therefore kept in the overlay (so later steps see it) and swapped into a `slidersRaw` order when the plan is finished.
  function setRaw(ctx, p, v) {
    const sh = ctx.shared, raw = sh.rawSliders || (sh.rawSliders = {});
    raw[p.id] = v.slice();
    ctx.setSliders(p, v);
    if (sh.rawWrapped) return;
    sh.rawWrapped = true;
    const fin = ctx.finish;
    ctx.finish = function () {
      const orders = fin.call(ctx);
      for (let i = 0; i < orders.length; i++) { const o = orders[i]; if (o.t === 'sliders' && raw[o.planet]) orders[i] = { t: 'slidersRaw', planet: o.planet, values: raw[o.planet] }; }
      return orders;
    };
  }
  function commit(ctx, p, v, overspend) {
    if (!overspend) { ctx.setSliders(p, trim(v)); return; }
    v = v.map(x => (x > 0 ? Math.trunc(x) : 0)); v[ECO] = Math.min(v[ECO], 100);
    if (sum5(v) === 100) ctx.setSliders(p, v); else setRaw(ctx, p, v);
  }

  AI.step('planets', 50, function (ctx) {
    const S = ctx.S, E = ctx.E, R = ctx.R, mine = ctx.mine();
    if (!mine.length) return;
    const Colony = M.Sim.Colony, oper = Colony.oper(E), diff = ctx.diff, am = ctx.aiMod || {};
    const overspend = ctx.quirk('sliderOverspend'), cheat = ctx.quirk('fleetCheatBug'), ecoIsInd = ctx.quirk('ecoWeightIsIndustry'), ratchet = ctx.quirk('silicoidEcoRatchet');
    const sil = E.race === 'silicoid';
    const atWar = ctx.enemies().length > 0;
    const T = W[rebalanceRow(ctx, atWar)];
    let countdown = (ctx.state.countdown === undefined ? 1 : ctx.state.countdown) - 1;
    const realloc = countdown <= 0;
    if (realloc) countdown = R.int(1, 5) + 1;
    ctx.patch({ countdown });

    for (const p of mine) {
      let s = ctx.sliders(p), changed = false;                                                      // starts from what earlier steps (panic mode, event cranks) planned
      if (overspend) {                                                                              // the end-of-turn normaliser of the original (research/07 §2.7), one plan late
        const n = normalise(s);
        if (n[TECH] !== s[TECH]) { s = n; changed = true; }
      }
      if (realloc) {
        const eco0 = sil && ratchet ? s[ECO] : Colony.ecoFloorPct(S, E, p);                          // force ECO to the waste-neutralising percentage (Silicoids: left as it was)
        s = allocate(R, T, p, am, eco0, ecoIsInd); changed = true;
      }
      const before = s.slice();
      tweak(s, p, E, oper, diff, cheat);
      if (s.some((x, i) => x !== before[i])) changed = true;
      if (changed) commit(ctx, p, s, overspend);
    }
  });

  // ---- order: raw sliders (AI empires only; the over-100 allocations of the original) --------------------------------------------------------------------------
  // {t:'slidersRaw', planet, values[5]}  — sets the five sliders WITHOUT the sum-100 rule or the ECO-floor lift (the original's end-of-turn normaliser does that).  Validated like a human
  // order would be: own planet, AI empire, integers 0..32767.
  O.register('slidersRaw', function (S, E, o) {
    const p = S.planets[o.planet];
    if (!p || p.owner !== E.id) return O.fail('not your planet');
    if (E.human) return O.fail('AI empires only');
    const v = (o.values || []).map(x => Math.round(x));
    if (v.length !== 5 || v.some(x => !(x >= 0 && x <= 32767))) return O.fail('bad slider values');
    p.sliders = v; return O.ok();
  });

  AI.Planets = { W, thresholds, allocate, trim, normalise, tweak, rebalanceRow, QDEF };
});
