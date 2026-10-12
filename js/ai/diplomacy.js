// AI step 80 — diplomacy glue: intentionally EMPTY.  Treaty / war decisions, AI<->AI diplomacy, AI->human proposals, council voting and the tactical battle AI live in the engines
// (Sim.Diplo, Sim.Council, Sim.Combat.aiTurn).  The only diplomatic act a fleet planner takes — breaking a NAP/alliance before attacking a partner's planet (research/08 §3.7) — is emitted
// by js/ai/military.js as a `diplomacy breakTreaty` order.  This file exists so the manifest entry resolves (no 404 at boot); add glue here only if a future rule needs it.
MOO.def(function (M) {
  'use strict';
  M.AI.GLUE_DIPLOMACY = false;
});
