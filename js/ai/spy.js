// AI step 70 — security and spies (the end of the original "p3": `turn_p3` + `turn_p3_sub1`). Pure planner (worker-safe).
// Spec: research/08 §10.1 (S1 settings), §13.1 row "AI security baseline", §13.4 (Darlok), §5.4 (ceasefire → spies hide) · research/07 §2.13 · research/05 §5.7 · research/01 §5.9, §4.7.
// Hiring (S2), mission rolls and which tech/planet an AI spy takes (S3) belong to Sim.Spy; this step only sets the three knobs through the orders  security / spyBudget / spyMode.
//
// EVERY TURN once the year is > 30 (T > 30; before that nothing is touched):
//   1. security (per mille of production, order `security`) = (coin flip ? Σ over CONTACTED empires of THEIR spies in my territory : 0) + 8·difficulty, capped at 100.
//      The coin flip is only drawn when somebody has spies on me.  Simple 0 · Easy 8 · Average 16 · Hard 24 · Impossible 32 baseline (0–3.2 % of production).
//   2. planned mode per other empire X (default Hide):
//        X is a human holding a ceasefire against me → Hide  (the original tests ceasefire[X][X] — always 0 — so it never hides: quirk spyCeasefireIndex);
//        else X in contact: treaty ≥ WAR → Sabotage;  else (Darlok always [ai.alwaysSpy], every other race on a coin flip) → Espionage iff d200 > 200 + 2·relation1 — i.e. with probability
//        −relation1/100 for relation1 < 0, never for relation1 ≥ 0 (the original's "Sabotage by relation" branch is unreachable and not implemented).
//   3. activation: for X in contact with a non-Hide mode: X not an AI (a human) → always;  X an AI → only 1 turn in 3  →  spyMode[X] = mode and spyBudget[X] = d5 + 5 (6..10 per mille =
//      0.6–1.0 % of gross production, order `spyBudget`); otherwise spyMode Hide and spyBudget 0.  So settings are re-rolled from scratch every turn.
// Draw order (as in the original): security coin flip → per target [mode coin flip → d200] → per target [1-in-3 → d5].  Personality and objective play no part (research/08 §13.2–13.3).
//
// QUIRK  AI.QUIRKS.spyCeasefireIndex  false = fixed: spies HIDE while a human's ceasefire against me runs (research/08 §5.4);  true = the v1.3 index bug (they never hide).
// ctx.shared.spy = { security, planned:[mode per empire], applied:[{target, mode, budget}], spiesOnMe }   (diagnostics / tests)
MOO.def(function (M) {
  'use strict';
  const AI = M.AI;
  const Q = AI.QUIRKS = AI.QUIRKS || {};
  if (Q.spyCeasefireIndex === undefined) Q.spyCeasefireIndex = false;
  const HIDE = 0, ESPIONAGE = 1, SABOTAGE = 2;
  const Sp = AI.Spy = {};

  // diplomatic contact: Diplo when present, else the geometric rule of Sim.Spy (the same rule the Spy engine uses to accept the orders)
  Sp.contact = function (S, a, b) {
    if (M.Sim.Spy && M.Sim.Spy.contact) { try { return !!M.Sim.Spy.contact(S, a, b); } catch (e) { return false; } }
    const D = M.Sim.Diplo;
    return !!(D && D.hasContact && D.hasContact(S, a, b));
  };
  // relation1 (attitude, −100..100) of me towards X: Diplo status when present, else the placeholder record created at setup
  Sp.relation = function (S, me, x) {
    const D = M.Sim.Diplo;
    if (D && D.status) { try { const st = D.status(S, me, x); if (st && typeof st.attitude === 'number') return st.attitude; } catch (e) { /* placeholder below */ } }
    const r = S.empires[me].relations && S.empires[me].relations[x];
    return r && typeof r.attitude === 'number' ? r.attitude : 0;
  };
  Sp.security = function (diff, spiesOnMe, coin) { return Math.min(100, (spiesOnMe > 0 ? coin * spiesOnMe : 0) + 8 * diff); };

  AI.step('spy', 70, function (ctx) {
    if (!(ctx.year > 30)) return;
    const S = ctx.S, E = ctx.E, R = ctx.R, me = ctx.id, always = !!(ctx.aiMod && ctx.aiMod.alwaysSpy) || ctx.race === 'darlok', classic = ctx.quirk('spyCeasefireIndex');
    const others = S.empires.filter(o => o.id !== me && o.alive);
    // 1. security
    let spies = 0;
    const contact = {};
    for (const o of others) { contact[o.id] = Sp.contact(S, me, o.id); if (contact[o.id]) spies += (o.spies && o.spies[me]) | 0; }
    const sec = Sp.security(ctx.diff, spies, spies > 0 ? R.int(0, 1) : 0);
    if ((E.security | 0) !== sec) ctx.order({ t: 'security', value: sec });
    // 2. planned modes
    const planned = {};
    for (const o of others) {
      let mode = HIDE;
      if (o.human && !classic && Sp.ceasefireAgainstMe(S, me, o.id) > 0) mode = HIDE;
      else if (contact[o.id]) {
        if (ctx.atWar(o.id)) mode = SABOTAGE;
        else if (always || R.int(0, 1) !== 0) { if (R.int(1, 200) > 200 + 2 * Sp.relation(S, me, o.id)) mode = ESPIONAGE; }
      }
      planned[o.id] = mode;
    }
    // 3. activation + budgets (re-rolled every turn; a human target is always funded, an AI target 1 turn in 3)
    const applied = [];
    for (const o of others) {
      let mode = HIDE, budget = 0;
      if (contact[o.id] && planned[o.id] !== HIDE && (o.human || R.int(0, 2) === 0)) { mode = planned[o.id]; budget = R.int(1, 5) + 5; }
      applied.push({ target: o.id, mode, budget });
      if (((E.spyMode && E.spyMode[o.id]) | 0) !== mode) ctx.order({ t: 'spyMode', target: o.id, mode });
      if (((E.spyBudget && E.spyBudget[o.id]) | 0) !== budget) ctx.order({ t: 'spyBudget', target: o.id, value: budget });
    }
    ctx.shared.spy = { security: sec, planned, applied, spiesOnMe: spies };
  });

  // turns of ceasefire the human X still holds against me (Diplo keeps it symmetric)
  Sp.ceasefireAgainstMe = function (S, me, x) {
    const D = M.Sim.Diplo;
    if (!D) return 0;
    try { if (D.ceasefire) return D.ceasefire(S, x, me) | 0; const st = D.status && D.status(S, me, x); return st && st.ceasefire ? st.ceasefire | 0 : 0; } catch (e) { return 0; }
  };
});
