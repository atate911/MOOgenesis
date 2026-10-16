// AI framework. An AI empire PLANS as a pure function over a read-only snapshot and returns plain orders (see DESIGN A2/A4):
//     orders = MOO.AI.plan(S, empireId, seed)         — S must be treated as read-only (it is the worker snapshot MOO.snap when run in a worker)
// The main thread applies the orders in empire order. Anything the AI must remember between turns goes into its `aiState` patch (E.ai).
// Sub-planners register themselves with  MOO.AI.step(name, order, function (ctx) { … ctx.order({t:'…'}) … })  and run in ascending `order` (the original p1 → p2 → p3 sequence):
//     10 intel (fronts, centres) · 20 scouts · 25 colonize · 30 military (attack/defend/idle/invasion transports) · 40 economy (pop transports, panic/developing funding, tax)
//     45 designs (p2) · 50 planets (p3 sliders) · 60 research · 70 spy (security/spies) · 80 diplomacy (glue only — treaty/war logic lives in Sim.Diplo)
// Each step should make its decisions from `ctx` helpers (see js/ai/ctx.js) and never throw (errors are caught per step and surfaced as one {t:'aiLog'} order → S.aiLog, see the end of this file).
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

  // worker op: { empire, seed } → orders[] (+ errors surfaced as a final {t:'aiLog', errors:[{step,msg}]} order, see below)
  M.Ops.aiPlan = function (p) { return AI.plan(M.snap, p.empire, p.seed); };

  // {t:'aiLog', errors:[{step, msg}]} — the step exceptions ctx.finish() collected.  The handler keeps a bounded log in the state, S.aiLog = { n: total so far, last: [≤ LOG_MAX of
  // {turn, empire, step, msg}] } (plain JSON, saved with the game), and warns on the console for the first LOG_WARN of them, so a planner that throws every turn is visible
  // (tools/soak-worker.js reports S.aiLog as the AI_ERRORS sanity item).  Orders.js loads before this module (js/manifest.js).
  AI.LOG_MAX = 50; AI.LOG_WARN = 20;
  if (M.Sim && M.Sim.Orders && M.Sim.Orders.register) {
    M.Sim.Orders.register('aiLog', function (S, E, o) {
      const errs = Array.isArray(o.errors) ? o.errors : [];
      let log = S.aiLog;
      if (!log || typeof log !== 'object' || !Array.isArray(log.last)) log = S.aiLog = { n: 0, last: [] };
      for (const e of errs) {
        const step = String(e && e.step !== undefined ? e.step : '?'), msg = String(e && e.msg !== undefined ? e.msg : e).slice(0, 600);
        log.n = (log.n | 0) + 1;
        log.last.push({ turn: S.turn | 0, empire: E.id, step, msg });
        if (log.last.length > AI.LOG_MAX) log.last.splice(0, log.last.length - AI.LOG_MAX);
        if (log.n <= AI.LOG_WARN && typeof console !== 'undefined' && console.warn) console.warn('[AI ' + E.id + ' ' + step + '] turn ' + S.turn + ': ' + msg.split('\n')[0]);
      }
      return M.Sim.Orders.ok({ logged: errs.length });
    });
  }
});
