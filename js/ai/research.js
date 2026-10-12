// AI step 60 — research allocation (original "p3" research part; research/07 §4.1–§4.3, §12 P60 · research/01 §5.5 · research/02 §6). Pure planner: emits `researchSet`.
// Staggered: each AI re-targets only on years where (year % 10) == its empire index.  All six fields get 5 %; exactly one field gets 75 %:
//   • before year 30, half the time Propulsion (explore first);
//   • else a 25 % "racial focus" roll (Bulrathi/Mrrshan Weapons, Darlok Computers, Meklar Construction-or-Planetology, Alkari Propulsion, Sakkra Planetology — Data.Races ai.researchFocusFields);
//   • else a d16 weighted by the objective's research columns (the War row while at war with anyone).
// The tech picked INSIDE a field is Research.aiPick's job (Turn.run; harder AIs lean towards the highest-tier entry; the game-start picks are Research.aiFirst).
//
// QUIRKS (AI.QUIRKS.<name>; true = original reading, false = alternative)
//   researchSwap78  [false]  §4.3: the original's table columns c7/c8 are *commented* "planetology, propulsion" but the code uses c8 for Propulsion and c7 for Planetology (so the Ecologist row
//                   favours Propulsion 5/16 and Planetology 1/16).  OFF = the literal code reading (default).  ON swaps the two columns (matches the manual: Ecologist Planetology 5/16).
//
// EXPORTS AI.Research = { RW, pick(R, row, race|aiMod, year, swap) }  (for tests and tools).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI;
  AI.QUIRKS = AI.QUIRKS || {};
  if (AI.QUIRKS.researchSwap78 === undefined) AI.QUIRKS.researchSwap78 = false;
  // columns: computers (c4), construction (c5), force fields (c6), planetology (c7), propulsion (c8), (weapons = 16 − sum) — rows: diplomat, militarist, expansionist, technologist, industrialist, ecologist, war
  const RW = [[2, 2, 4, 2, 3], [3, 1, 4, 2, 1], [1, 1, 3, 5, 2], [4, 2, 3, 2, 2], [1, 5, 4, 1, 2], [1, 2, 4, 1, 5], [2, 2, 4, 2, 1]];
  AI.RESEARCH_WEIGHTS = RW;
  const CM = 0, CN = 1, FF = 2, PL = 3, PR = 4, WE = 5;
  // the racial focus fields when the hook is missing (Data.Races ai.researchFocusFields is the source of truth)
  const FOCUS = { bulrathi: [WE], mrrshan: [WE], darlok: [CM], meklar: [CN, PL], alkari: [PR], sakkra: [PL] };

  // the whole field decision of one re-roll: returns the field that gets 75 %.  `ai` = Data.Races ai hooks (researchFocusFields) or null; race only used when the hook is absent.
  function pick(R, T, ai, race, year, swap) {
    if (year < 30 && R.int(0, 1) !== 0) return PR;
    const focus = R.int(0, 3) === 0;                                                       // the roll is always drawn, whatever the race
    if (focus) {
      const f = ai && ai.researchFocusFields && ai.researchFocusFields.length ? ai.researchFocusFields : FOCUS[race];
      if (f && f.length) return f.length === 1 ? f[0] : (R.int(0, 1) ? f[0] : f[1]);        // Meklar: rnd0(2) ? Construction : Planetology
    }
    const r = R.int(1, 16);
    const cm = T[0], cn = cm + T[1], ff = cn + T[2], pr = ff + (swap ? T[3] : T[4]), pl = pr + (swap ? T[4] : T[3]);     // cumulative order CM, CN, FF, PR, PL, then weapons
    return r <= cm ? CM : r <= cn ? CN : r <= ff ? FF : r <= pr ? PR : r <= pl ? PL : WE;
  }

  AI.step('research', 60, function (ctx) {
    if ((ctx.year % 10) !== (ctx.id % 10)) return;
    const atWar = ctx.enemies().length > 0;
    const field = pick(ctx.R, RW[atWar ? 6 : ctx.obj], ctx.aiMod, ctx.race, ctx.year, ctx.quirk('researchSwap78'));
    const v = [5, 5, 5, 5, 5, 5]; v[field] = 75;
    ctx.order({ t: 'researchSet', values: v });
  });

  AI.Research = { RW, pick, FOCUS };
});
