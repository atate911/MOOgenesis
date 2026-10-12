// Synchronous headless turn driver (used by tools/soak.js, tests and the AI-vs-AI "autoplay"): answers every interrupt with a sane default.
//   MOO.Sim.autoTurn(S) → {turn, events, timings}      MOO.Sim.autoPlay(S, maxTurns, onTurn)
// The browser's Game.endTurn() uses the same Turn.run generator but answers interrupts with UI and worker threads. Worker-safe.
MOO.def(function (M) {
  'use strict';
  const Sim = M.Sim;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  Sim.autoTurn = function (S, hooks) {
    const t0 = now(), seen = [], timings = {};
    const gen = Sim.Turn.run(S);
    let r = gen.next();
    while (!r.done) {
      const it = r.value; let ans;
      switch (it && it.type) {
        case 'aiPlan': { const t = now(); ans = {}; if (M.AI && M.AI.plan) for (const e of S.empires) if (e.alive && !e.human) ans[e.id] = M.AI.plan(S, e.id, M.AI.seedFor(S, e.id)); timings.ai = now() - t; break; }
        case 'battles': { const t = now(); ans = { results: it.battles.map(b => Sim.Combat.resolve(b, M.RNG.fromState(M.RNG.seedState(S.seed + ':' + S.turn + ':' + b.star)))) }; timings.combat = now() - t; break; }
        case 'colonize': ans = true; break;
        case 'techChoice': ans = it.choices[0] ? it.choices[0].level : 0; break;
        case 'council': ans = Sim.Council && Sim.Council.autoVote ? Sim.Council.autoVote(S, it.info) : 0; break;
        default: ans = undefined;
      }
      seen.push(it && it.type);
      // soak/test visibility: news categories and diplomacy kinds as extra tagged entries ('news:warDeclared', 'diplomacy:peaceOffer'…)
      if (it && it.type === 'gnn') for (const x of it.items || []) { if ((S.newsThisTurn || []).indexOf(x.cat) < 0) seen.push('news:' + x.cat); }     // compile-made items (starsReport, rankings, empireDestroyed)
      else if (it && it.type === 'diplomacy' && it.kind) seen.push('diplomacy:' + it.kind);
      else if (it && it.type === 'notice' && it.kind) seen.push('notice:' + it.kind);
      r = gen.next(ans);
    }
    for (const cat of (S.newsThisTurn || [])) seen.push('news:' + cat);               // EVERY news event of the turn, also the AI-vs-AI ones the human never sees
    timings.total = now() - t0;
    return { turn: S.turn, events: seen, timings, over: r.value || null };
  };

  Sim.autoPlay = function (S, maxTurns, onTurn) {
    for (let i = 0; i < maxTurns; i++) {
      const rep = Sim.autoTurn(S);
      if (onTurn) onTurn(rep, S);
      if (rep.over) return rep.over;
    }
    return null;
  };

  // The original has NO numeric score: its only composite ranking is the Racial Stats screen — five 0..100-px bars + "Total Power" (best empire = 100) (research/05 §8.3).
  // Fleet and production use the strategy guide's monotone brackets (the shipped code's bracket division overlaps); population/technology/planets follow the code.
  const bracket = (v, first) => { let va = first, k = 0, rem = Math.max(0, v); while (rem > va) { rem -= va; k++; va *= 2; } return Math.max(0, Math.min(100, Math.floor(rem * 10 / va) + 10 * k)); };
  Sim.powerBars = function (S) {
    const W = [1, 5, 25, 125], nStars = S.stars.length;
    const rows = S.empires.map(e => {
      const ps = S.planets.filter(p => p.owner === e.id);
      let hw = 0;
      for (const f of S.fleets) if (f.owner === e.id) for (let i = 0; i < 6; i++) if (f.ships[i] && e.designs[i] && !Sim.Design.stats(S, e, i).colonyMin) hw += f.ships[i] * W[e.designs[i].hull | 0];
      const trade = M.Sim.Diplo && M.Sim.Diplo.tradeIncome ? M.Sim.Diplo.tradeIncome(S, e) : 0;
      const prod = ps.reduce((a, p) => a + (p.gross | 0), 0) + trade;
      const tl = e.research && e.research.tl ? e.research.tl.reduce((a, b) => a + b, 0) : 0;
      const pop = ps.reduce((a, p) => a + p.pop, 0);
      const bars = { fleet: bracket(Math.min(3250000, hw), 125), tech: Math.min(100, Math.floor(tl / 3)), prod: bracket(prod, 100), pop: Math.min(100, Math.floor(pop / (Math.floor(nStars * 3 / 2) + 1))), planets: Math.min(100, Math.floor(ps.length * 100 / (nStars + 1))) };
      return { id: e.id, alive: e.alive, bars, sum: bars.fleet + bars.tech + bars.prod + bars.pop + bars.planets };
    });
    const best = Math.max(1, ...rows.filter(r => r.alive).map(r => r.sum));
    for (const r of rows) r.total = r.alive ? Math.floor(r.sum * 100 / best) : 0;
    return rows;
  };

  // plain-data summaries for tests/soak/UI rankings
  Sim.stats = function (S) {
    const pw = Sim.powerBars(S);
    return S.empires.map(e => {
      const ps = S.planets.filter(p => p.owner === e.id);
      let ships = 0; for (const f of S.fleets) if (f.owner === e.id) ships += f.ships.reduce((a, b) => a + b, 0);
      const techs = e.research ? e.research.completed.reduce((a, l) => a + l.length, 0) : 0;
      return { id: e.id, race: e.race, personality: e.personality, objective: e.objective, alive: e.alive, colonies: ps.length, pop: ps.reduce((a, p) => a + p.pop, 0),
        production: ps.reduce((a, p) => a + (p.gross | 0), 0), research: e.research ? (e.research.total | 0) : 0, techs, ships, bc: e.bc, factories: ps.reduce((a, p) => a + p.factories, 0),
        score: pw[e.id].total, power: pw[e.id].bars };
    });
  };
  Sim.newGame = function (settings) { return Sim.Setup.create(settings); };
  Sim.isOver = function (S) { const v = Sim.Turn.victory(S); return v ? { over: true, winner: v.winner, reason: v.reason } : { over: false }; };
});
