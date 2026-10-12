// AI framework. An AI empire PLANS as a pure function over a read-only snapshot and returns plain orders (see DESIGN A2/A4):
//     orders = MOO.AI.plan(S, empireId, seed)         — S must be treated as read-only (it is the worker snapshot MOO.snap when run in a worker)
// The main thread applies the orders in empire order. Anything the AI must remember between turns goes into its `aiState` patch (E.ai).
// Sub-planners register themselves with  MOO.AI.step(name, order, function (ctx) { … ctx.order({t:'…'}) … })  and run in ascending `order` (the original p1 → p2 → p3 sequence):
//     10 intel (fronts, centres) · 20 scouts · 25 colonize · 30 military (attack/defend/idle/invasion transports) · 40 economy (pop transports, panic/developing funding, tax)
//     45 designs (p2) · 50 planets (p3 sliders) · 60 research · 70 spy (security/spies) · 80 diplomacy (glue only — treaty/war logic lives in Sim.Diplo)
// Each step should make its decisions from `ctx` helpers (see js/ai/ctx.js) and never throw (errors are caught and logged per step).
// Worker-safe.
MOO.def(function (M) {
  'use strict';
  const AI = M.AI;
  AI.steps = [];
  AI.step = function (name, order, fn) {
    AI.steps = AI.steps.filter(s => s.name !== name);
    AI.steps.push({ name, order, fn });
    AI.steps.sort((a, b) => a.order - b.order);
  };
  AI.debug = false;
  AI.seedFor = (S, eid) => S.turn * 131 + eid;          // the ONE seed formula — headless (Sim.autoTurn) and browser (Game.endTurn) plan identically

  AI.plan = function (S, eid, seed) {
    const E = S.empires[eid];
    if (!E || !E.alive) return [];
    const ctx = AI.ctx(S, eid, seed === undefined ? S.turn * 131 + eid : seed);
    for (const st of AI.steps) {
      try { st.fn(ctx); }
      catch (err) { ctx.errors.push({ step: st.name, msg: String(err && err.stack || err) }); if (AI.debug && typeof console !== 'undefined') console.error('[AI ' + eid + ' ' + st.name + ']', err); }
    }
    return ctx.finish();
  };

  // worker op: { empire, seed } → orders[] (+ errors surfaced as a final {t:'aiLog'} no-op order for diagnostics)
  M.Ops.aiPlan = function (p) { return AI.plan(M.snap, p.empire, p.seed); };
});
