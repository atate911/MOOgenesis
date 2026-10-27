// AI steps 20 (scouts) and 25 (colonize) — the scouting / colonisation half of the original p1, plus the free "conjured" colony ship and AI.onColonized.
// Spec: research/07 §3 (colonisation), §8.1 (send_scout), §1.3 (p1 order, flag_send_colony), §6.1 rows 6–7 (difficulty), §2.2 (new colonies), §10 (constants) · research/08 §3.5 (need_conquer).
// Pure planners: they read the snapshot and the planned-fleet overlay in `ctx.shared` (see js/ai/intel.js for the shared contract) and emit `fleetSend` / `aiColonyShip` orders.
//
// WHAT THE ORIGINAL DOES (and this file reproduces)
//   * scouts: every turn each unowned, unexplored planet that is inside fuel range, has no foreign ships over it and is not already a destination of one of my fleets gets ONE
//     fleet: the nearest star where I have ANY ship (colony ships and warships too!) sends floor(n/4)+1 ships of one design (first design with reserve tanks, else the last present).
//   * need_conquer = 1-in-(8−difficulty) roll, cleared while any colonisable free planet exists (or after the game ended). Stored in ctx.shared.needConquer for the military step.
//   * colony ships are never built: with p = clamp(0.4·TP, 1, 500)/500 per turn (Simple keeps the roll 1/6 of the time, Easy 2/6) a free colony ship appears at a random front's
//     anchor planet while a colonisable planet exists. Existing colony ships are dispatched in planet-index order to unowned planets with type ≥ the colony design's base
//     (Silicoid: any), each target takes the nearest colony-ship stack and the WHOLE stack with every escort in that orbit leaves. Founding on arrival is automatic (sim/turn.js).
//   * non-Expansionist empires skip dispatch (not spawning) while more than half of their planets are "developing" and a human has contact with them.
//
// QUIRKS (AI.QUIRKS.<name>; false = fixed / not reproduced, true = the original v1.3 behaviour; options.aiClassic switches them all on)
//   fourthColonyShip  false  research/07 §3.4 BUG "4th colony-ship curse": with more than 3 colony-design ships anywhere the AI neither spawns nor sends any more (fixed in kyrub 1.40i / Classic+).
//   colonyDesignIndex false  §3.10/§11.3: shipi_colony starts at design 1 (the Fighter!) until the first p2 run (1..10 turns): the real colony ship (slot 4) is not recognised as a
//                            colony design (nothing is dispatched as colony ship) and the "free colony ship" is a Fighter. Fixed: the colony design is detected from turn 1.
//                            The first p2 run is detected through E.ai.p2Done (set by js/ai/designs.js; falls back to "turn ≥ 10").
//   staleColonyOrbit  false  §3.5: Classic does not refresh a source stack's count after sending from it, so later targets whose nearest source is that (emptied) stack get nothing this turn. Fixed: refreshed.
//   colonyRangeCap    false  §3.5: Classic only sends when dist_fast(target, source stack) ≤ fuel range × 15 map units (Classic+ has no cap).
//   (not reproduced, no flag: Classic deletes the ships of a dispatched orbit that could not travel — research/07 §3.6 says never replicate it.)
//   Kept as the original without a flag (they define the AI's feel): scouts use any ship; escorts leave with colony ships; targets are served in planet-index order with no scoring;
//   the spawn roll exists even while sending is throttled; a colony ship is never built.
//
// NEW ORDER (registered here): {t:'aiColonyShip', planet, slot?}  AI empires only — adds ONE ship of the colony design (the last design slot carrying a colony base; `slot` may name it) to the
//   stationary fleet at that owned planet (Fleet.addShips). The probability was rolled by the planner; the order only validates (AI empire, own planet, colony design, once per turn).
// HOOK: AI.onColonized(S, E, planet) — called by sim/turn.js on the main thread right after an AI colony was founded.
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, Geo = M.Sim.Geo, O = M.Sim.Orders;
  AI.QUIRKS = AI.QUIRKS || {};
  for (const q of ['fourthColonyShip', 'colonyDesignIndex', 'staleColonyOrbit', 'colonyRangeCap']) if (AI.QUIRKS[q] === undefined) AI.QUIRKS[q] = false;
  const Intel = () => AI.Intel;
  const EXPANSIONIST = 2;

  const p2Done = ctx => (ctx.state.p2Done !== undefined ? !!ctx.state.p2Done : ctx.turn >= 10);

  // the AI's colony-design slot: the LAST design carrying a colony base (original role detection); -1 when none. Quirk: slot 1 until the first p2 run.
  function colonySlot(ctx) {
    const E = ctx.E;
    if (ctx.quirk('colonyDesignIndex') && !p2Done(ctx)) return 1;
    let slot = -1;
    for (let i = 0; i < 6; i++) if (E.designs[i] && ctx.designStats(i).colonyMin > 0) slot = i;
    return slot;
  }
  const countOf = (sh, slot) => {
    let n = 0;
    for (const k in sh.orbit) n += sh.orbit[k][slot];
    for (const m of sh.moving) n += m.counts[slot];
    return n;
  };

  // ---- step 20: scouts + need_conquer ---------------------------------------------------------------------------------------------------------------------
  function scouts(ctx) {
    const S = ctx.S, E = ctx.E, R = ctx.R, I = Intel(), sh = I.init(ctx), n = S.stars.length;
    if (!sh.centre) return;                                                              // step 10 failed: nothing to build on
    const ignore = new Uint8Array(n), foreign = new Uint8Array(n), allied = {};
    for (const f of S.fleets) {                                                          // stars with ships of a non-allied foreign empire in orbit
      if (f.owner === ctx.id || f.star < 0) continue;
      if (allied[f.owner] === undefined) allied[f.owner] = !!ctx.allied(f.owner);
      if (!allied[f.owner] && f.ships.some(c => c > 0)) foreign[f.star] = 1;
    }
    for (let i = 0; i < n; i++) if (E.explored[i] || !ctx.range(i, true) || foreign[i]) ignore[i] = 1;
    for (const m of sh.moving) ignore[m.to] = 1;
    // need_conquer: 1-in-(8−difficulty); cleared when a colonisable free planet exists anywhere (§3.5 of research/08) or after the game ended
    let need = R.int(0, 7 - ctx.diff) === 0;
    const col = I.scanColonizable(ctx);
    sh.colonyFor = col.thr; sh.haveColonizable = col.have; sh.colonizable = col.list;
    if (col.have) need = false;
    if (sh.ended) need = false;
    sh.needConquer = need;

    const targets = [];
    for (let i = 0; i < n; i++) if (S.planets[i].owner < 0 && !ignore[i] && i !== S.orion) targets.push(i);     // Orion is never scouted
    const own = new Array(n).fill(0);
    for (const k in sh.orbit) { const o = sh.orbit[k]; own[+k] = o[0] + o[1] + o[2] + o[3] + o[4] + o[5]; }
    let sent = 0;
    for (const t of targets) {
      let src = -1, bd = 10000;
      for (let j = 0; j < n; j++) {                                                      // nearest star where I have any ship (ties → lowest index)
        if (own[j] <= 0) continue;
        const d = Geo.unitDist(S, t, j);
        if (d < bd) { bd = d; src = j; }
      }
      if (src < 0 || sh.galaxyMoving >= I.ENROUTE_MAX) continue;
      const have = sh.orbit[src]; let slot = -1;
      for (let i = 0; i < 6; i++) if (have[i] > 0 && (slot < 0 || !ctx.designStats(slot).tanks)) slot = i;   // first design with tanks, else the last one present
      if (slot < 0) continue;
      const fr = ctx.range(t, true);
      if (!(fr === 1 || (fr === 2 && ctx.designStats(slot).tanks))) continue;
      const num = Math.floor(have[slot] / 4) + 1, only = [0, 0, 0, 0, 0, 0]; only[slot] = num;
      const out = I.send(ctx, src, t, only);
      if (out) { own[src] -= num; sent++; }
    }
    sh.scoutsSent = sent;
    I.fronts(ctx);                                                                       // the original's first `front` call
  }
  AI.step('scouts', 20, scouts);

  // ---- step 25: free colony ship + dispatch --------------------------------------------------------------------------------------------------------------
  // flag_send_colony: non-Expansionists stop dispatching while > half of their planets are "developing" and a human has contact with them
  function sendAllowed(ctx) {
    if (ctx.obj === EXPANSIONIST) return true;
    const mine = ctx.mine();
    let developing = 0;
    for (const p of mine) if ((p.bases | 0) < Math.floor(p.mp3 / 20) && p.pop < Math.floor((p.mp3 * 2) / 3)) developing++;
    return !(Math.floor(mine.length / 2) < developing && ctx.shared.humanContact);
  }

  // have_colony_ship: maybe conjure one, then "are there colony ships to dispatch?"
  function haveColonyShip(ctx) {
    const E = ctx.E, R = ctx.R, sh = Intel().init(ctx), slot = colonySlot(ctx);
    const fronts = sh.fronts || [];
    const tp = E.flow && E.flow.gross !== undefined ? E.flow.gross : ctx.mine().reduce((a, p) => a + (p.gross | 0), 0);
    if (!fronts.length || slot < 0 || tp <= 0) return false;
    const count = countOf(sh, slot);
    if (ctx.quirk('fourthColonyShip') && count > 3) return false;                        // the curse: nothing spawned, nothing dispatched
    const anchor = fronts[R.int(0, fronts.length - 1)].anchor;                           // consumed even when no ship follows
    if (count > 3) return true;                                                          // (fixed) plenty already: just dispatch them
    let prod = Math.min(500, Math.max(1, Math.floor((tp * 2) / 5)));
    if (ctx.diff < 2 && R.int(0, 5) > ctx.diff) prod = 0;                                // Simple keeps the roll 1/6 of the time, Easy 2/6
    if (sh.haveColonizable === undefined) sh.haveColonizable = Intel().scanColonizable(ctx).have;
    if (!sh.haveColonizable || R.int(1, 500) > prod) return count > 0;
    ctx.order({ t: 'aiColonyShip', planet: anchor, slot });
    const star = ctx.S.planets[anchor].starId, o = sh.orbit[star] || (sh.orbit[star] = [0, 0, 0, 0, 0, 0]);
    o[slot]++;
    sh.spawned = (sh.spawned || 0) + 1; sh.spawnPlanet = anchor;
    return true;
  }

  // send_colony_ships: unowned planets in index order; each takes the nearest stack holding colony ships, the whole orbit (escorts too) leaves
  function sendColonyShips(ctx) {
    const S = ctx.S, E = ctx.E, I = Intel(), sh = I.init(ctx), n = S.stars.length, slot = colonySlot(ctx);
    if (slot < 0) return;
    const des = ctx.designStats(slot);
    const canColonize = (ctx.mod && ctx.mod.allTerrain) || ctx.race === 'silicoid' ? 1 : (des.colonyMin || 7);
    const range = ((E.range | 0) || 3) * 15;
    const ignore = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (S.planets[i].owner >= 0 || !ctx.range(i, true)) ignore[i] = 1;
    for (const m of sh.moving) if (m.counts[slot] > 0) ignore[m.to] = 1;
    const guard = !!(S.guardian && S.guardian.alive);
    const targets = [];
    for (let i = 0; i < n; i++) {
      const p = S.planets[i];
      if (p.owner < 0 && !ignore[i] && !(guard && i === S.orion) && p.typeIdx >= canColonize) targets.push(i);
    }
    const cnt = new Array(n).fill(0);
    for (const k in sh.orbit) cnt[+k] = sh.orbit[k][slot];
    const stale = ctx.quirk('staleColonyOrbit'), cap = ctx.quirk('colonyRangeCap');
    let sent = 0;
    for (const t of targets) {
      const fr = ctx.range(t, true);
      if (!(fr === 1 || (fr === 2 && des.tanks))) continue;
      let src = -1, bd = 10000;
      for (let j = 0; j < n; j++) {
        if (cnt[j] <= 0) continue;
        const d = Geo.unitDist(S, t, j);
        if (d < bd) { bd = d; src = j; }
      }
      if (src < 0) continue;
      if (cap && bd > range) continue;
      if (sh.galaxyMoving >= I.ENROUTE_MAX) continue;
      const out = I.send(ctx, src, t);
      if (out) sent++;
      if (!stale) cnt[src] = sh.orbit[src] ? sh.orbit[src][slot] : 0;                    // Classic+ refreshes the local copy; Classic leaves the emptied source "occupied"
    }
    sh.colonyOrdersSent = (sh.colonyOrdersSent || 0) + sent;
  }

  function colonize(ctx) {
    const sh = Intel().init(ctx);
    if (!sh.centre) return;
    const allowed = sendAllowed(ctx);
    const have = haveColonyShip(ctx);
    if (have && allowed) sendColonyShips(ctx);
    Intel().fronts(ctx);                                                                 // the original's second `front` call
  }
  AI.step('colonize', 25, colonize);
  AI.Colonize = { scouts, colonize, colonySlot, haveColonyShip, sendColonyShips, sendAllowed, countOf };      // exposed for tests and tools

  // ---- order: the free colony ship ------------------------------------------------------------------------------------------------------------------------
  function lastColonySlot(S, E) {
    let slot = -1;
    for (let i = 0; i < 6; i++) if (E.designs && E.designs[i] && M.Sim.Design.stats(S, E, i).colonyMin > 0) slot = i;
    return slot;
  }
  O.register('aiColonyShip', function (S, E, o) {
    if (E.human) return O.fail('AI empires only');
    const p = S.planets[o.planet !== undefined ? o.planet : o.star];
    if (!p || p.owner !== E.id) return O.fail('not your planet');
    const slot = o.slot !== undefined ? (o.slot | 0) : lastColonySlot(S, E);
    if (!(slot >= 0 && slot < 6) || !E.designs || !E.designs[slot]) return O.fail('no such design');
    const classic = !!(S.settings && S.settings.options && S.settings.options.aiClassic) || !!AI.QUIRKS.colonyDesignIndex;
    if (!(M.Sim.Design.stats(S, E, slot).colonyMin > 0) && !classic) return O.fail('not a colony design');
    if (E.ai && E.ai.conjured === S.turn) return O.fail('one free colony ship per turn');
    M.Sim.Fleet.addShips(S, E.id, p.starId, slot, 1);
    E.ai = Object.assign(E.ai || {}, { conjured: S.turn });
    return O.ok({ slot, planet: p.id });
  });

  // ---- hook: a new AI colony ---------------------------------------------------------------------------------------------------------------------------------
  // research/07 §2.2: a freshly founded AI colony has pop 2, no factories, sliders IND 100 / rest 0, builds design slot 0, rallies to itself. Colony.found (called by Fleet.colonize for
  // humans and AIs alike) already creates exactly that; this hook re-asserts the defaults for AI empires so a later change to the human path can never leak into the AI's colonies.
  // The first p3 rebalance (planets.js, ≤ 6 turns later) replaces the sliders.
  AI.onColonized = function (S, E, p) {
    if (!E || E.human || !p || p.owner !== E.id) return;
    p.sliders = [0, 0, 100, 0, 0]; p.build = 0; p.reloc = p.starId; p.trans = null;
    if (M.Sim.Colony && M.Sim.Colony.applyEcoFloor) M.Sim.Colony.applyEcoFloor(S, E, p);
  };
});
