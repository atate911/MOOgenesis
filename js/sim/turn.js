// Turn pipeline (research/04 §7; DESIGN.md A3). A generator: it runs the phases in the documented order and YIELDS an interrupt object whenever
// a human decision, a parallel batch or a presentation is needed; the driver answers via gen.next(answer).
//   interrupts: {type:'aiPlan'}                       → answer {[empireId]: orders[]}   (driver may use the worker pool)
//               {type:'battles', battles:[…]}         → answer {results:[…]}            (all battles; driver resolves AI-vs-AI in parallel, human ones tactically/auto)
//               {type:'colonize', empire, planet, fleet, slots}   → true|false
//               {type:'explore', empire, star}                    → (ack)
//               {type:'techChoice', empire, field, choices:[{level,cost,name}]} → level|0
//               {type:'tech', …} {type:'notice', …} {type:'gnn', …} {type:'diplomacy', …} {type:'council', …} {type:'gameover', …} {type:'message', …}
// Missing subsystems (combat, ground, diplomacy, spies, events, council, AI) are used when present, so the pipeline works at every stage of the build.
MOO.def(function (M) {
  'use strict';
  const T = M.Sim.Turn = {};
  const Sim = M.Sim;
  const has = n => !!Sim[n];

  T.run = function* (S) {
    const R = M.RNG.bind(S.rs);
    S.ev = []; S.newsThisTurn = [];
    const E = S.empires, alive = () => E.filter(e => e.alive);

    // (1–4) housekeeping, diplomacy mood tweaks
    if (has('Diplo') && Sim.Diplo.preTurn) Sim.Diplo.preTurn(S, R);

    // (3) AI planning — pure planners; the driver may run them on worker threads
    const plans = yield { type: 'aiPlan' };
    if (plans) for (const e of alive()) { const o = plans[e.id]; if (o && o.length) Sim.Orders.applyAll(S, e.id, o); }

    // (5–6) transports leave, production/upkeep/tax
    Sim.Fleet.launchTransports(S);
    Sim.Econ.stepProduction(S);
    // (7–8) ecology & growth, research points
    Sim.Econ.stepEco(S);
    Sim.Econ.stepResearchTotal(S);
    // (9–11) trade growth, spies built, diplomacy adjust
    if (has('Diplo') && Sim.Diplo.economyTurn) Sim.Diplo.economyTurn(S, R);
    if (has('Spy') && Sim.Spy.buildTurn) Sim.Spy.buildTurn(S, R);
    // production is recomputed ONCE MORE here (1oom "hidden child labor", default on in v1.3; research/04 verification C5): defence / ships / industry spend the output of
    // the population AFTER this turn's growth, while ecology and research used the earlier figures. Switch off with Data.Config.QUIRKS.hiddenChildLabor = false.
    if (!(M.Data.Config.QUIRKS && M.Data.Config.QUIRKS.hiddenChildLabor === false)) Sim.Econ.stepProduction(S);
    // (12–15) defence, ships, reserve, industry
    Sim.Econ.stepDefense(S);
    Sim.Econ.stepShips(S);
    Sim.Econ.stepReserve(S);
    Sim.Econ.stepIndustry(S);
    for (const p of S.planets) p.transCost = 0;

    // (16) movement
    const mv = Sim.Fleet.move(S);
    // (17–18) battles at stars
    if (has('Combat') && Sim.Combat.findBattles) {
      const battles = Sim.Combat.findBattles(S, R);
      if (battles.length) {
        const res = yield { type: 'battles', battles };
        if (res && res.results) Sim.Combat.applyResults(S, res.results, R);
      }
    }
    // (19) espionage / sabotage results
    if (has('Spy') && Sim.Spy.turn) { const sp = Sim.Spy.turn(S, R); for (const ev of (sp || [])) { const a = yield ev; if (typeof ev.answer === 'function') ev.answer(a); } }

    // (20–21) research: interest + breakthrough rolls; then choose next projects
    for (const e of alive()) Sim.Research.advance(S, e, R);
    // the breakthrough / discovery scene comes BEFORE the choice of the next project (original order); the trailing take below catches anything pushed later
    for (const ev of Sim.Ev.take(S, x => x.type === 'tech' && S.empires[x.empire].human)) yield ev;
    for (const e of alive()) {
      const rs = e.research;
      for (let f = 0; f < 6; f++) {
        // a field without a project that holds RP (a completed project leaves 1, so the next choice comes the SAME turn) asks for / gets its next project
        if (rs.project[f] === 0 && (rs.invest[f] > 0 || S.turn === 0) && Sim.Research.choices(e, f).length) {
          if (e.human) {
            const choices = Sim.Research.choices(e, f).map(l => ({ level: l, cost: Sim.Research.projectCost(S, e, f, l), tech: Sim.Research.techAt(f, l) }));
            const pick = yield { type: 'techChoice', empire: e.id, field: f, choices };
            if (pick) Sim.Research.start(S, e, f, pick); else Sim.Research.start(S, e, f, choices[0].level);
          } else Sim.Research.aiPick(S, e, f, R);
        }
      }
    }
    for (const ev of Sim.Ev.take(S, x => x.type === 'tech' && S.empires[x.empire].human)) yield ev;

    // (22) explore + colonise
    for (const st of S.stars) {
      const here = S.fleets.filter(f => f.star === st.id && F_total(f) > 0).sort((a, b) => a.owner - b.owner);     // simultaneous arrivals: lowest empire index first
      if (!here.length) continue;
      for (const f of here) {
        const e = E[f.owner]; if (!e.alive) continue;
        const virgin = E.every(x => !x.explored || !x.explored[st.id]);              // artifact worlds pay only the VERY FIRST explorer (an AI getting there first wastes it)
        if (Sim.Vis.explore(S, e, st.id)) {
          if (e.human) yield { type: 'explore', empire: e.id, star: st.id };
          if (virgin && S.planets[st.id].special === 'artifacts' && Sim.Artifacts && Sim.Artifacts.loot) Sim.Artifacts.loot(S, e, S.planets[st.id], R);
        }
      }
      const p = S.planets[st.id];
      if (p.owner < 0 && p.typeIdx > 0) {
        for (const f of here) {
          if (p.owner >= 0) break;
          const e = E[f.owner]; if (!e.alive) continue;
          const slots = Sim.Fleet.colonyShips(S, e, f, p); if (!slots.length) continue;
          let ok = true;
          if (e.human) ok = yield { type: 'colonize', empire: e.id, planet: p.id, fleet: f.id, slots };
          if (ok) { Sim.Fleet.colonize(S, e, f, slots[0], p); if (!e.human && M.AI && M.AI.onColonized) M.AI.onColonized(S, e, p); }
        }
      }
    }
    Sim.Fleet.cleanup(S);

    // (23–24) bombardment (humans are asked "Bomb?" first; unanswered = yes), transports land + ground combat
    if (has('Ground')) {
      if (Sim.Ground.pending && Sim.Ground.setBombard) for (const q of Sim.Ground.pending(S)) { const yes = yield q; Sim.Ground.setBombard(S, q.empire, q.planet, yes !== false); }
      if (Sim.Ground.bombard) { const bev = Sim.Ground.bombard(S, R); for (const ev of (bev || [])) yield ev; }
    }
    const landed = Sim.Fleet.landTransports(S, mv.landed);
    for (const l of landed) {
      if (l.kind === 'invade' && has('Ground') && Sim.Ground.invade) { const r = Sim.Ground.invade(S, l, R); if (r) yield { type: 'ground', result: r }; }
      else if (l.kind === 'lost' && S.empires[l.empire].human) Sim.Ev.push(S, { type: 'notice', kind: 'transportLost', empire: l.empire, planet: l.planet, n: l.n });
    }
    // (25) coups
    if (has('Events') && Sim.Events.coups) Sim.Events.coups(S, R);
    // (26–27) random events, artifact loot
    if (has('Events') && S.settings.options.randomEvents && Sim.Events.turn) { const evs = Sim.Events.turn(S, R); for (const ev of (evs || [])) yield ev; }
    let councilOver = null;
    // (28) the Galactic Council, THEN contact + AI diplomacy (the original: AI↔AI diplomacy → council → AI→human audiences; the Diplo engine does both halves in one call, after the council so its votes already count)
    if (has('Council') && S.settings.options.council && Sim.Council.due && Sim.Council.due(S)) {
      const info = Sim.Council.convene(S, R);
      const vote = yield { type: 'council', info };
      const out = Sim.Council.resolve(S, info, vote, R);
      const ruling = yield { type: 'councilResult', result: out };                 // a living human answers accept (true) / defy (false); unanswered = accept (the original treats Esc as yes)
      if (out && out.needsAnswer && out.accepted === null && typeof out.finish === 'function') out.finish(!(ruling === false || ruling === 'defy'));
      if (out && out.gameOver) councilOver = { reason: out.reason, winner: out.winner };      // the turn still finishes (year advances); the verdict is announced at its end
    }
    if (has('Diplo') && Sim.Diplo.turn) { const ds = Sim.Diplo.turn(S, R); for (const d of (ds || [])) { const ans = yield d; if (d.answer) d.answer(ans); } }
    // (29) fuel check
    const lost = Sim.Fleet.fuelCheck(S);
    for (const l of lost) if (S.empires[l.empire].human) Sim.Ev.push(S, { type: 'notice', kind: 'outOfFuel', ...l });

    // reports for the human: notices (industry maximum, fuel losses, lost transports…) and the fleet-production summary
    for (const ev of Sim.Ev.take(S, x => x.type === 'notice' && S.empires[x.empire] && S.empires[x.empire].human)) yield ev;
    const built = Sim.Ev.take(S, x => x.type === 'built' && S.empires[x.empire] && S.empires[x.empire].human);
    if (built.length) yield { type: 'built', year: M.Data.Config.displayYear(S), items: built.map(b => ({ planet: b.planet, design: b.design, count: b.count })) };

    // deaths & victory
    T.checkDeaths(S);
    const over = T.victory(S) || councilOver;
    // (31) year advances; (30,32,33) recompute displays, tech levels, ranges, visibility
    S.year += 1; S.turn += 1;
    for (const e of alive()) { Sim.Research.refreshTL(e); Sim.Design.refresh(S, e); }
    Sim.Fleet.updateRange(S); Sim.Vis.update(S);
    Sim.Econ.autoSwitch(S); Sim.Econ.refresh(S); Sim.Econ.stepResearchTotal(S);
    if (has('News') && Sim.News.compile) { const gnn = Sim.News.compile(S, R); if (gnn && gnn.items.length) yield gnn; }
    if (over) yield (Sim.Victory && Sim.Victory.payload ? Sim.Victory.payload(S, over) : { type: 'gameover', reason: over.reason, winner: over.winner });
    return over;
  };
  const F_total = f => f.ships.reduce((a, b) => a + b, 0);

  // an empire survives while it owns a planet or a ship that could still found one
  T.checkDeaths = function (S) {
    for (const e of S.empires) {
      if (!e.alive) continue;
      const hasPlanet = S.planets.some(p => p.owner === e.id);
      let hasColonizer = false;
      if (!hasPlanet) for (const f of S.fleets) if (f.owner === e.id) for (let i = 0; i < 6; i++) if (f.ships[i] && Sim.Design.stats(S, e, i).colonyMin) hasColonizer = true;
      if (!hasPlanet && !hasColonizer) {
        e.alive = false; Sim.Ev.push(S, { type: 'empireDestroyed', empire: e.id });
        // its population transports in flight vanish with it; otherwise they land later, 'invade' a planet and hand it to a dead empire (soak DEAD_OWNER, seed 24052)
        if (S.trans) S.trans = S.trans.filter(t => t.owner !== e.id);
      }
    }
  };
  // conquest victory: only one empire left (or the human is dead)
  T.victory = function (S) {
    if (Sim.Victory && Sim.Victory.check) { const v = Sim.Victory.check(S); if (v) return v; }      // council verdict, last empire standing, funeral (research/05 §8)
    const live = S.empires.filter(e => e.alive);
    if (!S.empires[S.playerId].alive && !S.settings.playerAI) return { reason: 'defeat', winner: live.length ? live[0].id : -1 };
    if (live.length === 1) return { reason: 'conquest', winner: live[0].id };
    return null;
  };
  const Sim_ = M.Sim; void Sim_;
});
