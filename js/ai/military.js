// AI step 30 — military: the fleet-and-war half of the original "p1" (planet ratings, send_attack, send_defend, send_idle, trans_en). Pure planner (worker-safe).
// Spec: research/08 §3.5–3.8 (target list, commitment), §4 (strength metrics, fronts, idle staging, dispatch, invasion transports, bombing decision), §5 (defence, retreat, ceasefire),
// §13–§19 (adjustments, constants, quirks, planner contract) · research/07 §8.4 (bestspeed terms), §8.5, §2.11 (transports). Details re-checked against 1oom `game_ai_classic.c` (rules/numbers only).
//
// WHAT THE ORIGINAL DOES (and this file reproduces)
//   * War is decided by DIPLOMACY (Sim.Diplo). This planner only attacks planets of empires it is at war with (treaty ≥ WAR) — or any planet on "need_conquer" turns / after the game ended
//     (then it first BREAKS a NAP/alliance with the owner: `diplomacy breakTreaty` order, Expansionist odds) — that lie inside fuel range, have type ≥ my colonisable threshold, and are
//     not the Orion planet before year 120.  Unowned planets with a foreign fleet over them count as owned by the lowest-index such empire.  Weight = pop − 10·bases + 30·special − 20.
//   * per front (Intel.fronts, in order) the WHOLE stack at the anchor planet goes to the first target (weight order) that is closer than fuel·15 units, passes d100 < 40 (always when the list has
//     [measured 2026-10, 8 large games × 200 turns: also accepting targets within fuel·15 of ANY own planet doubled the dispatches (60 → 132) but lowered captures (31 → 19) and produced no conquest
//      ending either way (0 eliminations in both runs) — the anchor-only radius is kept.]
//     < 2 entries) and whose defender weight D is strictly below my force there: D = Σ other empires' ships × design threat + (weaponTech%·5 + (planetShield+10)·10) · missile bases.
//     The target is "used" for this turn whether or not a fleet really leaves.  No retreat, no escorts, no coordination, no re-routing (research/08 §4.11).
//   * send_defend: every planet with < 5 bases and no ship over it has a flat threat of 50; planets whose force·4/3 < threat are on the defend list; each star that has force and no threat sends
//     its stack to the FIRST list planet within 30·S+20 units — only if threat·5/3 < its force (hull-weight threat vs design-threat force: the original's unit mismatch).
//   * send_idle (only < 8 fleets in flight): stacks that are not at a front anchor and whose force ≥ force_own_sum (= Σ force/25, halved after a council election, halved again in the final war)
//     go to the front minimising dist·10/(20·S+20) + front value.
//   * trans_en: own planets with pop ≥ max/2 and pop > 20 send pop/2 to the nearest enemy planet (within 30·S+30 units) where I already have ships in orbit.
//   * bombardment (§4.8) and the ground fight are engine business: Ground.bombard decides "bomb iff pop > own inbound transports" itself (js/sim/ground.js `aiBombs`).
//   * strategic retreat (§5.3) has no planner order: Combat.applyResults sends a loser to its nearest other planet; `AI.Military.retreatTarget` is the same rule as a helper.
//
// QUIRKS (AI.QUIRKS.<name>; false = fixed, true = original v1.3 behaviour; S.settings.options.aiClassic switches every one on)
//   attackPhaseBDead     TRUE   research/08 §3.7(6)/§17.12: the second attack pass (stacks sitting over ENEMY planets, 60 % roll, 3/2·force > hull-weight defenders) never runs in Classic because the force
//                               table only holds own/unowned stars.  Kept (default true): it is what keeps a besieging stack in place for the invasion transports.  false = run the second pass.
//   attackDesignBound    false  §3.7(3)/§17.17: the original summed other empires' ships over the AI's OWN design count (1oom fixed it); true reproduces the short loop.
//   targetSortEarlyStop  false  the original bubble sort resets its "swapped" flag at every comparison, so a pass that ends without a swap stops the sort early (1oom source); true reproduces it.
//   transFromRebellion   false  §4.7: Classic lets planets in rebellion launch invasion transports (Classic+ excludes them).
//   threatCountsAllies   false  §5.1/§4.10: Classic counts allied empires' fleets/transports as threats to my planets (Classic+ ignores allies); shared with the economy planner's panic mode.
//   transNoWarRequired   TRUE   §4.7: invasion transports need NO war — any non-allied planet with one of my ships (a lingering scout!) over it is a target.  Kept (original feel); false = also require
//                               war / need_conquer / game ended, which stops 'conquest by scout' between peaceful empires.
//   threat16             false  §4.1: Classic stores a design's threat in 16 bits (wraps at 65536); fixed = exact.   (32-bit masks of force/D are never reachable and not reproduced.)
// FIXES (AI.FIXES.<name>; true = fixed (default), false = original; aiClassic turns them off — outside the quirk table because tools/rules/83-balance pins that one to REPORT.md)
//   defendStaging        TRUE   §5.1/§4.5: Classic only sees ships IN ORBIT, so two unguarded colonies trade the same stack back and forth forever.  Fixed: own stacks in flight count as
//                               force at their destination and the exact reverse of a defend/idle move made < Mil.MOVE_MEMORY (8) turns ago is refused (memory: E.ai.milMoves).
//   Not reproduced (documented, no flag): the idle-fleet clean-up that writes the wrong index (the spec does not say what it clears); Classic deleting ships that could not be sent (never replicate).
//
// ctx.shared INPUT (js/ai/intel.js): orbit (planned stationary ships), fronts, needConquer, ended/refusers, contact, bestSpeed, inFlight/galaxyMoving, colonyFor.  Ships are sent through AI.Intel.send
//   (whole stack, designs filtered by the target's range flag, orbit/inFlight bookkeeping), so a ship is never used twice in a plan.
// ctx.shared OUTPUT  mil = { targets:[{planet, star, owner (effective), real (planet.owner), weight, pop, bases, special}], used:{planetId:true}, force:{star:n} (my force table at plan start,
//   own/unowned stars only), forceSum, forceOwnSum, threat:[6] (my design threats), attacks:[{from, to, planet, owner, force, defenders}], breaks:[{to, kind}], defends:[{from, to, threat, force}],
//   idles:[{from, to, front}], transports:[{planet, to, n, owner}], skipped:{…diagnostics} }
// PUBLIC (AI.Military): bestSpeed · colonyThreshold · designThreat · planetWeight · newPlan · buildTargets · defenderWeight · attack · defend · idle · invade · retreatTarget · treatyKind · ceasefire
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, Geo = M.Sim.Geo;
  const Mil = AI.Military = {};
  const Q = AI.QUIRKS = AI.QUIRKS || {};
  const reg = (name, v) => { if (Q[name] === undefined) Q[name] = v; };
  reg('attackPhaseBDead', true); reg('attackDesignBound', false); reg('targetSortEarlyStop', false); reg('transFromRebellion', false);
  reg('threatCountsAllies', false); reg('threat16', false); reg('transNoWarRequired', true);
  AI.FIXES = AI.FIXES || {}; if (AI.FIXES.defendStaging === undefined) AI.FIXES.defendStaging = true;   // see the staging memory below

  const EXPANSIONIST = 2;
  const SPECIAL = { ultrapoor: 0, poor: 1, normal: 2, artifacts: 3, rich: 4, ultrarich: 5, orion: 6 };   // the original's planet-special enum
  const BATTLE_SCANNER_N = 9;                                                                         // special enum number of the Battle Scanner (SPECIALS[i].n)
  const HUGE = 100000000;                                                                              // "threat set to a huge number so nobody else goes"
  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] | 0; return s; };

  // ---- small rule helpers -------------------------------------------------------------------------------------------------------------------------------------
  // "best speed" S of the original = best engine tech level (6,12,…,48; 0 while only the Retro engine is known) + 3   (research/07 §8.4; 1oom game_ai_best_speed)
  Mil.bestSpeed = function (E) {
    const done = E.research && E.research.completed ? E.research.completed[4] : null;
    let p = 0;
    if (done) for (let l = 6; l <= 48; l += 6) if (done.indexOf(l) >= 0) p = l;
    return p + 3;
  };
  // the colonisable-type threshold ("have_colony_for"): 7 Minimal … 1 Radiated; Silicoids settle everything
  Mil.colonyThreshold = function (E) {
    if (E.race === 'silicoid') return 1;
    const v = E.mods && E.mods.colonyFor;
    return v >= 1 && v <= 7 ? v : 7;
  };
  Mil.gameEnded = S => !!(S.gameOver || (S.council && (S.council.finalWar || S.council.over)));
  const hullW = (E, slot) => {
    const d = E.designs && E.designs[slot];
    if (!d) return 1;
    const h = M.Data.Components.HULLS[d.hull | 0];
    return h ? h.w : 1;
  };
  // treaty with `e`: 'none' | 'nap' | 'alliance' | 'war' (Diplo when present; war covers final war)
  Mil.treatyKind = function (ctx, e) {
    if (ctx.allied(e)) return 'alliance';
    if (ctx.atWar(e)) return 'war';
    const t = ctx.treaty(e);
    if (typeof t === 'string') { const s = t.toLowerCase(); return s.indexOf('allian') >= 0 ? 'alliance' : (s === 'nap' || s.indexOf('non') >= 0) ? 'nap' : s.indexOf('war') >= 0 ? 'war' : 'none'; }
    return t === 1 ? 'nap' : t === 2 ? 'alliance' : t >= 3 ? 'war' : 'none';
  };
  // turns of ceasefire a human `owner` still holds against me (Diplo keeps it symmetric)
  Mil.ceasefire = function (S, me, owner) {
    const D = M.Sim.Diplo;
    if (!D) return 0;
    try { if (D.ceasefire) return D.ceasefire(S, me, owner) | 0; const st = D.status && D.status(S, me, owner); return st && st.ceasefire ? st.ceasefire | 0 : 0; } catch (e) { return 0; }
  };

  // research/08 §4.1: design threat = Σ non-bomb weapon banks (weapon TECH LEVEL × count) + (if that sum ≠ 0) ((shield index + 10) × hit points)/50
  //   + 2 × tech level of every special device at or after the Battle Scanner; ×2 for an AI empire once a council election was held, ×2 again once the game has ended (Classic: & 0xffff).
  Mil.designThreat = function (S, E, slot, flags) {
    const d = E.designs && E.designs[slot];
    if (!d) return 0;
    const K = M.Data.Components, st = M.Sim.Design.stats(S, E, slot);
    if (!st || st.empty) return 0;
    let v = 0;
    for (const w of st.weapons) if (w.count > 0 && w.kind !== 'bomb' && w.kind !== 'bio') v += (w.tl | 0) * w.count;       // bombs and bio weapons are flagged "bomb" in the original
    if (v !== 0) v += Math.floor(((d.shield >= 0 ? d.shield + 1 : 0) + 10) * (st.hp | 0) / 50);
    for (const sid of (d.specials || [])) { const sp = sid >= 0 ? K.SPECIALS[sid] : null; if (sp && sp.n >= BATTLE_SCANNER_N) v += 2 * sp.tech.l; }
    if (!E.human) {
      if (flags && flags.held) v *= 2;
      if (flags && flags.ended) v *= 2;
    }
    return flags && flags.mask16 ? (v & 0xffff) : v;
  };
  // planet rating (planet_w): v4 = (special−2)·20 + special·10 + 20 = 30·special − 20; enemy planets pay 10 per missile base, own planets 5
  Mil.planetWeight = function (p, own) {
    const sp = SPECIAL[p.special] !== undefined ? SPECIAL[p.special] : 2, owned = p.owner >= 0;
    return (owned ? p.pop | 0 : 0) - (own ? 5 : 10) * (owned ? p.bases | 0 : 0) + (sp - 2) * 20 + sp * 10 + 20;
  };
  // strategic retreat (§5.3): the nearest planet I own other than the battle planet (parsecs, ties → lowest id); -1 when I own no other planet (the ships are lost)
  Mil.retreatTarget = function (S, eid, fromStar) {
    let best = -1, bd = 1e9;
    for (const p of S.planets) {
      if (p.owner !== eid || p.starId === fromStar) continue;
      const d = Geo.parsecs(S, fromStar, p.starId);
      if (d < bd) { bd = d; best = p.starId; }
    }
    return best;
  };

  // ---- plan state ----------------------------------------------------------------------------------------------------------------------------------------------
  // everything one run of the step needs, built once: orbit index of foreign stacks, my planned orbit overlay, threat tables, my force table
  Mil.newPlan = function (ctx) {
    const S = ctx.S, E = ctx.E, me = ctx.id, n = S.stars.length, sh = ctx.shared;
    if (AI.Intel && AI.Intel.init) AI.Intel.init(ctx);
    else if (!sh.orbit) {                                                                              // standalone fallback (no intel step): the same overlay by hand
      sh.orbit = {}; sh.moving = []; sh.galaxyMoving = 0;
      for (const f of S.fleets) {
        if (!total(f.ships)) continue;
        if (f.star < 0) sh.galaxyMoving++;
        if (f.owner !== me) continue;
        if (f.star >= 0) { const o = sh.orbit[f.star] || (sh.orbit[f.star] = [0, 0, 0, 0, 0, 0]); for (let i = 0; i < 6; i++) o[i] += f.ships[i]; } else sh.moving.push({ to: f.to, counts: f.ships.slice() });
      }
      sh.inFlight = sh.moving.length;
    }
    const plan = {
      ctx, S, E, me, n, sh, mine: ctx.mine(), flags: { held: !!(S.council && S.council.held), ended: !!(sh.ended !== undefined ? sh.ended : Mil.gameEnded(S)), mask16: !!ctx.quirk('threat16') },
      bs: sh.bestSpeed || Mil.bestSpeed(E), range: (((E.range | 0) || 3) * 15), orbit: new Array(n), threats: {}, force: {}, forceSum: 0, forceOwnSum: 0,
      used: {}, targets: [], fronts: sh.fronts || [], out: { attacks: [], breaks: [], defends: [], idles: [], transports: [], skipped: {} },
      noMemory: !ctx.fix('defendStaging'), newMoves: {},                                            // staging memory of this plan (Mil.isReverse / Mil.memoryPatch)
    };
    for (const f of S.fleets) if (f.star >= 0 && total(f.ships) > 0) (plan.orbit[f.star] || (plan.orbit[f.star] = [])).push(f);       // every empire's stationary stacks by star
    const mt = Mil.threatOf(plan, me);
    let sum = 0;
    for (const k in sh.orbit) {                                                                          // force table: own/unowned stars only (enemy-owned stars hold nothing)
      const s = +k, ow = S.planets[s].owner;
      if (ow >= 0 && ow !== me) continue;
      let v = 0; const o = sh.orbit[k];
      for (let i = 0; i < 6; i++) if (o[i] > 0) v += o[i] * mt[i];
      plan.force[s] = v; sum += v;
    }
    plan.forceSum = sum;
    let own = Math.floor(sum / 25);
    if (plan.flags.held) own = Math.floor(own / 2);                                                      // halved after the first election, again at game end
    if (plan.flags.ended) own = Math.floor(own / 2);
    plan.forceOwnSum = own;
    plan.targets = Mil.buildTargets(plan);
    return plan;
  };
  Mil.threatOf = function (plan, e) {
    let t = plan.threats[e];
    if (!t) { const E = plan.S.empires[e]; t = plan.threats[e] = []; for (let i = 0; i < 6; i++) t.push(Mil.designThreat(plan.S, E, i, plan.flags)); }
    return t;
  };

  // ---- dispatch (whole stack through Intel.send: range flags, orbit overlay, inFlight) ------------------------------------------------------------------------------
  const ENROUTE_MAX = () => (AI.Intel && AI.Intel.ENROUTE_MAX) || 208;
  function send(plan, from, to) {
    const ctx = plan.ctx, sh = plan.sh;
    if (from === to || sh.galaxyMoving >= ENROUTE_MAX()) return null;
    let counts = null;
    if (AI.Intel && AI.Intel.send) counts = AI.Intel.send(ctx, from, to);
    else {                                                                                               // standalone fallback of the same rule
      const have = sh.orbit[from], fr = ctx.range(to);
      if (have && fr) {
        const c = [0, 0, 0, 0, 0, 0]; let any = 0;
        for (let i = 0; i < 6; i++) { if (have[i] <= 0 || (fr === 2 && !ctx.designStats(i).tanks)) continue; c[i] = have[i]; any += have[i]; }
        if (any) { ctx.order({ t: 'fleetSend', from, to, counts: c.slice() }); for (let i = 0; i < 6; i++) have[i] -= c[i]; sh.moving.push({ to, counts: c }); sh.inFlight++; sh.galaxyMoving++; counts = c; }
      }
    }
    if (counts) { plan.force[from] = 0; if (sh.force) sh.force[from] = 0; }                              // the send helper zeroes the force entry of its source
    return counts;
  }
  Mil.send = send;

  // ---- planet ratings & target list (planet_w) ------------------------------------------------------------------------------------------------------------------
  // the original's bubble sort descending; `early` reproduces its flag bug (swapped is reset before EVERY comparison, so only the last one of a pass keeps the loop going)
  function bubbleDesc(list) {
    const a = list.slice(); let swapped;
    do {
      swapped = false;
      for (let i = 0; i + 1 < a.length; i++) {
        swapped = false;
        if (a[i].weight < a[i + 1].weight) { const t = a[i]; a[i] = a[i + 1]; a[i + 1] = t; swapped = true; }
      }
    } while (swapped);
    return a;
  }
  Mil.bubbleDesc = bubbleDesc;
  Mil.buildTargets = function (plan) {
    const ctx = plan.ctx, S = plan.S, E = plan.E, me = plan.me, sh = plan.sh;
    const need = !!sh.needConquer, ended = plan.flags.ended, thr = Mil.colonyThreshold(E), year = S.year | 0;
    const first = new Array(plan.n).fill(-1);                                                            // lowest-index OTHER empire with ships over each star
    for (const f of S.fleets) {
      if (f.star < 0 || f.owner === me || !total(f.ships) || !S.empires[f.owner] || !S.empires[f.owner].alive) continue;
      if (first[f.star] < 0 || f.owner < first[f.star]) first[f.star] = f.owner;
    }
    const war = {};
    const atWar = e => (war[e] === undefined ? (war[e] = ctx.atWar(e)) : war[e]);
    const list = [];
    for (const p of S.planets) {
      let owner = p.owner;
      if (owner === me) continue;
      if (owner < 0) owner = first[p.starId];                                                            // unowned but a foreign fleet is over it → "owned" by the first such empire
      if (owner < 0 || !S.empires[owner] || !S.empires[owner].alive) continue;
      if (!(atWar(owner) || need || ended)) continue;
      if (ctx.range(p.starId) !== 1) continue;                                                           // within_frange == 1
      if (!(p.typeIdx >= thr)) continue;
      if (!(year > 120 || !(p.special === 'orion' || p.starId === S.orion))) continue;
      list.push({ planet: p.id, star: p.starId, owner, real: p.owner, weight: Mil.planetWeight(p, false), pop: p.owner >= 0 ? p.pop | 0 : 0, bases: p.owner >= 0 ? p.bases | 0 : 0, special: p.special });
    }
    if (Q.targetSortEarlyStop || ctx.quirk('targetSortEarlyStop')) return bubbleDesc(list);
    return list.sort((a, b) => b.weight - a.weight || a.planet - b.planet);                              // a bubble sort is stable: equal weights keep planet-index order
  };

  // ---- the defender weight D of send_attack -------------------------------------------------------------------------------------------------------------------------
  // Σ over every OTHER empire's ships at the target × that design's threat (+1800 per monster) + (owner's weapon-tech % × 5 + (owner's planetary-shield level + 10) × 10) × missile bases
  Mil.defenderWeight = function (plan, star) {
    const S = plan.S, me = plan.me, ctx = plan.ctx;
    const lim = ctx.quirk('attackDesignBound') ? Math.min(6, (plan.E.designs || []).filter(Boolean).length) : 6;
    let d = 0;
    const here = plan.orbit[star];
    if (here) for (const f of here) {
      if (f.owner === me) continue;
      const t = Mil.threatOf(plan, f.owner);
      for (let i = 0; i < lim; i++) d += (f.ships[i] | 0) * t[i];
    }
    if (S.guardian && S.guardian.alive && S.guardian.star === star) d += 1800;
    if (S.monsters) for (const m of S.monsters) if (m && !m.gone && !(m.killer >= 0) && m.star === star) d += 1800;
    const p = S.planets[star];
    if (p.owner >= 0 && p.owner !== me) {
      const O = S.empires[p.owner], tl = O.research && O.research.tl ? O.research.tl[5] | 0 : 0, sh = (O.mods && O.mods.planetShield) | 0;
      d += (tl * 5 + (sh + 10) * 10) * (p.bases | 0);
    }
    return d;
  };

  // ---- send_attack --------------------------------------------------------------------------------------------------------------------------------------------------------
  function breakOrder(plan, owner, kind) {
    plan.ctx.order({ t: 'diplomacy', to: owner, act: 'breakTreaty', expand: true, cap: kind === 'alliance' ? 30 : 20 });
    plan.out.breaks.push({ to: owner, kind });
  }
  Mil.attack = function (plan) {
    const ctx = plan.ctx, S = plan.S, R = ctx.R, me = plan.me, targets = plan.targets;
    if (!targets.length || !plan.fronts.length) return;
    const expansionist = ctx.obj === EXPANSIONIST;
    for (const fr of plan.fronts) {
      const P = S.planets[fr.anchor];
      if (!P || P.owner !== me) continue;
      const ps = P.starId;
      for (let k = 0; k < targets.length; k++) {
        const t = targets[k];
        if (plan.used[t.planet]) continue;                                                               // marked used (weight −1000) this turn
        if (!(Geo.unitDist(S, ps, t.star) < plan.range)) continue;                                       // strictly closer than fuel × 15 units
        if (targets.length >= 2 && !(R.int(1, 100) < 40)) continue;                                     // the 40 % gate (39 of 100 rolls), skipped for a lone target
        const D = Mil.defenderWeight(plan, t.star), force = plan.force[ps] | 0;
        if (!(force > D)) continue;                                                                      // strictly greater, else the walk goes on
        plan.used[t.planet] = true;                                                                      // chosen: used whether or not a fleet really leaves
        if (t.real < 0) { if (send(plan, ps, t.star)) plan.out.attacks.push({ from: ps, to: t.star, planet: t.planet, owner: t.owner, force, defenders: D }); }
        else {
          const kind = Mil.treatyKind(ctx, t.owner);
          if (kind === 'alliance') { if (R.int(0, 3) === 0 || (R.int(0, 1) === 0 && expansionist)) breakOrder(plan, t.owner, kind); }          // 1/4, 5/8 for an Expansionist; no fleet this turn
          else if (kind === 'nap') { if (R.int(0, 1) === 0 || expansionist) breakOrder(plan, t.owner, kind); }                                   // 1/2, certain for an Expansionist
          else if (send(plan, ps, t.star)) plan.out.attacks.push({ from: ps, to: t.star, planet: t.planet, owner: t.owner, force, defenders: D });
        }
        break;                                                                                           // a chosen target ends the walk for this front
      }
    }
    if (!ctx.quirk('attackPhaseBDead')) attackPhaseB(plan);
  };
  // the second pass the original never reaches (fixed variant, flag attackPhaseBDead=false): every enemy-owned star where I have ships picks the first unused target
  // within range that passes d100 < 60 and for which 3/2 · force beats the hull-weight total of the other empires' ships there.
  function attackPhaseB(plan) {
    const ctx = plan.ctx, S = plan.S, R = ctx.R, me = plan.me, mt = Mil.threatOf(plan, me);
    for (const k in plan.sh.orbit) {
      const s = +k, ow = S.planets[s].owner;
      if (ow < 0 || ow === me) continue;
      const o = plan.sh.orbit[k]; let force = 0;
      for (let i = 0; i < 6; i++) if (o[i] > 0) force += o[i] * mt[i];
      if (force <= 0) continue;
      for (const t of plan.targets) {
        if (plan.used[t.planet] || t.star === s || !(Geo.unitDist(S, s, t.star) < plan.range) || !(R.int(1, 100) < 60)) continue;
        let hw = 0;
        for (const f of (plan.orbit[t.star] || [])) if (f.owner !== me) for (let i = 0; i < 6; i++) hw += (f.ships[i] | 0) * hullW(S.empires[f.owner], i);
        if (!(Math.floor(force * 3 / 2) > hw)) continue;
        plan.used[t.planet] = true;
        if (send(plan, s, t.star)) plan.out.attacks.push({ from: s, to: t.star, planet: t.planet, owner: t.owner, force, defenders: hw, phase: 'B' });
        break;
      }
    }
  }

  // ---- staging memory (fix of the defend/idle ping-pong; AI.FIXES.defendStaging = false restores the original) -------------------------------------------------------------
  // The original rates every colony with < 5 bases and no ship IN ORBIT as "unguarded" (threat 50), so star A ships its whole stack to B, next turn A is unguarded and B ships it back
  // (measured: 162 A→B→A reversals in 120 turns on a large map, the stacks never garrison anything).  Fixed variant: (1) own stacks already in flight count as force at their destination
  // (unguarded / defend-list tests), (2) every defend/idle move is remembered in E.ai.milMoves {"from>to": turn} and the exact reverse move is refused for Mil.MOVE_MEMORY turns.
  Mil.MOVE_MEMORY = 8;
  const moveKey = (from, to) => from + '>' + to;
  // my stacks in flight (snapshot + everything this plan has already dispatched) as design-threat force per destination star
  Mil.inboundForce = function (plan) {
    const mt = Mil.threatOf(plan, plan.me), out = {};
    for (const m of (plan.sh.moving || [])) {
      if (!m || !(m.to >= 0) || !m.counts) continue;
      let v = 0;
      for (let i = 0; i < 6; i++) if (m.counts[i] > 0) v += m.counts[i] * mt[i];
      if (v > 0) out[m.to] = (out[m.to] || 0) + v;
    }
    return out;
  };
  // the move from → to would undo a defend/idle move made within the last MOVE_MEMORY turns
  Mil.isReverse = function (plan, from, to) {
    if (plan.noMemory) return false;
    const mem = plan.ctx.state.milMoves, k = moveKey(to, from);
    return !!(mem && typeof mem[k] === 'number' && mem[k] > plan.S.turn - Mil.MOVE_MEMORY);
  };
  function remember(plan, from, to) { if (!plan.noMemory) plan.newMoves[moveKey(from, to)] = plan.S.turn; }
  // E.ai.milMoves after this plan: the old entries still inside the window plus this plan's moves (patched only when something changed, so the aiState patch stays small)
  Mil.memoryPatch = function (plan) {
    if (plan.noMemory) return null;
    const old = plan.ctx.state.milMoves || {}, next = {}, cut = plan.S.turn - Mil.MOVE_MEMORY;
    let changed = false;
    for (const k of Object.keys(old).sort()) { if (typeof old[k] === 'number' && old[k] > cut) next[k] = old[k]; else changed = true; }
    for (const k of Object.keys(plan.newMoves).sort()) { if (next[k] !== plan.newMoves[k]) changed = true; next[k] = plan.newMoves[k]; }
    return changed ? next : null;
  };

  // ---- send_defend --------------------------------------------------------------------------------------------------------------------------------------------------------
  Mil.defend = function (plan) {
    const ctx = plan.ctx, S = plan.S, me = plan.me, allies = ctx.quirk('threatCountsAllies');
    const threat = {}, inbound = plan.noMemory ? {} : Mil.inboundForce(plan);
    const guard = star => (plan.force[star] | 0) + (inbound[star] | 0);                                   // force in orbit + my stacks already on their way
    const hostile = e => e !== me && (allies || !ctx.allied(e));
    for (const f of S.fleets) {                                                                          // en-route fleets of other empires aimed at one of my planets: Σ ships × hull weight
      if (f.star >= 0 || f.owner === me || !hostile(f.owner) || !(f.to >= 0) || S.planets[f.to].owner !== me) continue;
      const O = S.empires[f.owner]; let w = 0;
      for (let i = 0; i < 6; i++) if (f.ships[i] > 0) w += f.ships[i] * hullW(O, i);
      threat[f.to] = (threat[f.to] || 0) + w;
    }
    for (const t of (S.trans || [])) {                                                                   // hostile transports weigh pop × 5 (the medium hull weight)
      if (t.owner === me || !hostile(t.owner) || !(t.to >= 0) || S.planets[t.to].owner !== me) continue;
      threat[t.to] = (threat[t.to] || 0) + (t.n | 0) * 5;
    }
    for (const p of plan.mine) if ((p.bases | 0) < 5 && !(guard(p.starId) > 0)) threat[p.starId] = 50;   // every unguarded colony counts as threatened (this overwrites)
    const list = [];
    for (const p of plan.mine) { const th = threat[p.starId] | 0; if (Math.floor(guard(p.starId) * 4 / 3) < th) list.push(p.starId); }
    if (!list.length) return;
    const reach = plan.bs * 30 + 20;
    for (let s = 0; s < plan.n; s++) {                                                                   // every star with force and no threat is a candidate sender
      const force = plan.force[s] | 0;
      if (!(force > 0) || (threat[s] | 0) > 0) continue;
      let dest = -1;
      for (const d of list) if (Geo.unitDist(S, s, d) < reach && !Mil.isReverse(plan, s, d)) { dest = d; break; }   // the FIRST list planet in range, not the nearest, and no second try
      if (dest < 0) continue;
      const th = threat[dest];
      if (Math.floor(th * 5 / 3) < force) {
        if (send(plan, s, dest)) { plan.out.defends.push({ from: s, to: dest, threat: th, force }); remember(plan, s, dest); }
        threat[dest] = HUGE;                                                                             // nobody else goes there
      }
    }
  };

  // ---- send_idle ----------------------------------------------------------------------------------------------------------------------------------------------------------
  Mil.idle = function (plan) {
    const sh = plan.sh, S = plan.S, fronts = plan.fronts;
    if (!(sh.inFlight < 8) || !fronts.length) return;
    const anchors = {};
    for (const f of fronts) anchors[f.star] = true;
    const div = plan.bs * 20 + 20;
    for (let s = 0; s < plan.n; s++) {
      const o = sh.orbit[s];
      if (!o || !total(o) || anchors[s]) continue;                                                       // fleets at front anchors are left alone
      if ((plan.force[s] | 0) < plan.forceOwnSum) continue;                                              // small stacks stay where they are
      let best = -1, bv = 1e18;
      for (let i = 0; i < fronts.length; i++) {
        if (Mil.isReverse(plan, s, fronts[i].star)) continue;                                            // (fixed) a front the stack just came from is not staged again for a while
        const v = Math.floor(Geo.unitDist(S, s, fronts[i].star) * 10 / div) + fronts[i].value;
        if (v < bv) { bv = v; best = i; }                                                                // the first minimum wins ties
      }
      if (best >= 0 && send(plan, s, fronts[best].star)) { plan.out.idles.push({ from: s, to: fronts[best].star, front: best }); remember(plan, s, fronts[best].star); }
    }
  };

  // ---- trans_en: invasion transports -----------------------------------------------------------------------------------------------------------------------------------
  Mil.invade = function (plan) {
    const ctx = plan.ctx, S = plan.S, E = plan.E, me = plan.me, sh = plan.sh, F = M.Sim.Fleet;
    const thr = Mil.colonyThreshold(E), reach = plan.bs * 30 + 30, rebels = ctx.quirk('transFromRebellion');
    const targeted = {};
    for (const t of (S.trans || [])) if (t.owner === me) targeted[t.to] = true;                          // a transport of mine is already on its way
    const sources = [];
    for (const p of plan.mine) {
      if ((p.pop | 0) > 20 && p.pop >= Math.floor((p.mp3 | 0) / 2) && (rebels || p.unrest !== 2) && !p.trans) sources.push(p);
    }
    if (!sources.length) return;
    const cf = {};
    for (const p of S.planets) {
      if (p.owner < 0 || p.owner === me || targeted[p.starId]) continue;
      const o = sh.orbit[p.starId];
      if (!o || !total(o)) continue;                                                                     // I need at least one ship in orbit there (stacks already sent are gone)
      if (ctx.allied(p.owner)) continue;
      if (!ctx.quirk('transNoWarRequired') && !(ctx.atWar(p.owner) || sh.needConquer || plan.flags.ended)) continue;
      if (S.empires[p.owner].human) { if (cf[p.owner] === undefined) cf[p.owner] = Mil.ceasefire(S, me, p.owner) > 0; if (cf[p.owner]) continue; }   // no invasions of a human holding a ceasefire
      if (!(p.typeIdx >= thr)) continue;
      if (F && F.canTransportTo && !F.canTransportTo(S, E, plan.mine[0], p.starId).ok) continue;           // the sim's own gate (explored, in fuel range, colonisable type)
      let best = -1, bd = 10000;
      for (let i = 0; i < sources.length; i++) {
        const q = sources[i]; if (!q) continue;
        const d = Geo.unitDist(S, q.starId, p.starId);
        if (d < bd && d < reach) { bd = d; best = i; }                                                   // nearest unused source (ties → lowest planet index)
      }
      if (best < 0) continue;
      const src = sources[best], n = Math.floor(src.pop / 2);                                            // half of the population, no estimate of the defenders
      ctx.order({ t: 'trans', planet: src.id, to: p.starId, n });
      plan.out.transports.push({ planet: src.id, to: p.starId, n, owner: p.owner });
      sources[best] = null;                                                                              // the source is spent for this turn
      targeted[p.starId] = true;
    }
  };

  // ---- the step ------------------------------------------------------------------------------------------------------------------------------------------------------------
  AI.step('military', 30, function (ctx) {
    if (!ctx.mine().length) return;
    const plan = Mil.newPlan(ctx);
    if (plan.targets.length) Mil.attack(plan);                                                           // only if the enemy-target list is non-empty
    Mil.defend(plan);
    Mil.idle(plan);
    Mil.invade(plan);
    const mem = Mil.memoryPatch(plan);
    if (mem) ctx.patch({ milMoves: mem });
    ctx.shared.mil = Object.assign({ targets: plan.targets, used: plan.used, forceSum: plan.forceSum, forceOwnSum: plan.forceOwnSum, threat: Mil.threatOf(plan, plan.me).slice() }, plan.out);
  });
});
