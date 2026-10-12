// Orders — the single write path for player and AI decisions (DESIGN.md A2).
//   const res = MOO.Sim.Orders.apply(S, empireId, {t:'researchSlider', field:0, value:40});   // → {ok:true} | {ok:false, msg:'…'}
// Feature modules register their own handlers:  Orders.register('type', function (S, E, order) { …validate, mutate…; return {ok:true}; })
// Orders are plain JSON so AI planners (running in workers) can return them as arrays and the main thread applies them in empire order.
MOO.def(function (M) {
  'use strict';
  const O = M.Sim.Orders = {};
  const handlers = {};

  O.register = function (type, fn) { handlers[type] = fn; };
  O.types = () => Object.keys(handlers);

  O.apply = function (S, empireId, order) {
    const E = S.empires[empireId];
    if (!E || !E.alive) return { ok: false, msg: 'empire not active' };
    const h = handlers[order.t];
    if (!h) return { ok: false, msg: 'unknown order type: ' + order.t };
    try { const r = h(S, E, order); return r || { ok: true }; }
    catch (err) { return { ok: false, msg: 'order failed: ' + (err && err.message || err) }; }
  };
  // apply a list; returns array of results (same indices)
  O.applyAll = function (S, empireId, orders) { return orders.map(o => O.apply(S, empireId, o)); };

  O.ok = (extra) => Object.assign({ ok: true }, extra || {});
  O.fail = (msg) => ({ ok: false, msg });
});
