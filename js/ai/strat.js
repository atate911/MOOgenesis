// AI use of Strategic choices (sim/strat.js), only when the option is on. Runs last (after every step that spends the reserve), so a project is bought
// only from what the plan leaves in the reserve. Research pacts between AIs are formed by Sim.Strat.turn; the human's proposals are answered by Sim.Diplo.
//   focus     the capital and developed colonies: industry; every third developed colony, artifact worlds and Orion: science (technologists: every second);
//             colonies below half their max population: growth (back to the colony's role at three quarters); colonies with 6+ bases: fortress.
//             A focus is kept at least KEEP turns unless the colony has fallen below 40 % (bombed, plague).
//   projects  in a fixed order once affordable with a cushion: cartography, envoys (diplomats first), habitats, archive (technologists first).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI;
  const KEEP = 15, CUSHION = 1.25;
  function role(ctx, p) {
    if (p.id === ctx.E.capital) return 'industry';
    if (p.special === 'artifacts' || p.special === 'orion') return 'science';
    if ((p.bases | 0) >= 6) return 'fortress';
    return p.id % (ctx.objName() === 'technologist' ? 2 : 3) === 0 ? 'science' : 'industry';
  }
  function want(ctx, p) {
    const mp = p.mp3 || p.maxPop || 1, fill = (p.pop | 0) / mp;
    if (p.id !== ctx.E.capital && mp >= 30 && (fill < 0.4 || (p.focus === 'growth' && fill < 0.75) || (!p.focus && fill < 0.5))) return 'growth';
    return role(ctx, p);
  }
  AI.Strat = { want, role };
  AI.step('strategic', 85, function (ctx) {
    const S = ctx.S, St = M.Sim.Strat;
    if (!St || !St.on(S)) return;
    for (const p of ctx.mine()) {
      const w = want(ctx, p);
      if ((p.focus || null) === w) continue;
      const young = p.focus && S.turn - (p.focusSince | 0) < KEEP, fell = w === 'growth' && (p.pop | 0) < 0.4 * (p.mp3 || 1);
      if (young && !fell) continue;
      ctx.order({ t: 'focus', planet: p.id, focus: w });
    }
    const order = ctx.objName() === 'technologist' ? ['cartography', 'archive', 'habitats', 'envoys'] : ctx.objName() === 'diplomat' ? ['envoys', 'cartography', 'habitats', 'archive'] : ['cartography', 'habitats', 'envoys', 'archive'];
    for (const id of order) {
      const why = St.canBuy(S, ctx.E, id), cost = St.projectCost(S, ctx.E, id);
      if (why && why !== 'not enough BC in the reserve') continue;
      if (ctx.reserve() >= cost * CUSHION) ctx.order({ t: 'project', id });
      break;                                                                                     // one project at a time, in order: save up for the next
    }
  });
});
