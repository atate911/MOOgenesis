// Turn event buffer: sim modules append plain event objects ({type, …}) to S.ev during a turn; the turn pipeline turns them into
// presentation (tech scenes, notices, GNN bulletins, diplomacy audiences) and clears the buffer. Worker-safe.
MOO.def(function (M) {
  'use strict';
  const Ev = M.Sim.Ev = {};
  // type examples: tech {empire, field, level, id, source:'research'|'spy'|'loot'|'trade'|'orion'}, colony {empire, planet}, battle {…}, news {cat, …}
  // news categories of the running turn are also kept in S.newsThisTurn (names only; reset by Turn.run) so headless drivers / the soak can count AI-vs-AI wars, contacts and treaties
  // that never reach a GNN broadcast
  Ev.push = function (S, ev) { ev.turn = S.turn; (S.ev = S.ev || []).push(ev); if (ev.type === 'news' && Array.isArray(S.newsThisTurn)) S.newsThisTurn.push(ev.cat); return ev; };
  Ev.take = function (S, pred) { const all = S.ev || [], keep = [], out = []; for (const e of all) (pred(e) ? out : keep).push(e); S.ev = keep; return out; };
  Ev.of = function (S, type) { return (S.ev || []).filter(e => e.type === type); };
  Ev.clear = function (S) { S.ev = []; };
});
