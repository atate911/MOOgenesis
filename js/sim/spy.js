// Espionage (research/05 §5, research/01 §4.7, research/02 §1.10). Worker-safe. The per-turn AI PLANNER (security slider, who to spy on, which mode) lives in
// js/ai/spy.js and drives this module only through the orders  spyBudget / spyMode / security;  this module owns hiring, mission resolution and the AI's
// mission-level picks (which tech an AI steals, who it frames, what it sabotages).
//
// STATE (all plain JSON)
//   E.spyBudget[target]   0..100  per-mille of the empire's GROSS production spent on that target each turn (Econ deducts it from income)
//   E.spies[target]       spies alive on that target            E.spyMode[target]  0 hide | 1 espionage | 2 sabotage      E.spyFund[target]  BC carried towards the next spy
//   E.security            0..200 per-mille of gross (Econ order 'security'); defender bonus = security/5 on every spy roll
//   E.spyReport[target]   {year, best[6]}  newest tech level per field as of the last turn a spy was alive on the target (the "Report" screen)
//   S.spy                 {caught[target][owner], totals[target][owner], log[], pending[], nextId}   caught = spies of `owner` caught by `target` THIS turn (Spies-Caught overlay);
//                         log = this turn's mission rolls [{empire, target, mode, caught, failed, active, success (spies that got in), frame, anyCaught}]
//
// TURN HOOKS (sim/turn.js)
//   buildTurn(S,R)        step "spies built": per target  fund = gross*budget/1000 + fund;  cost = 2*ComputerTL + 25 (Darlok x0.5, truncated), doubling for every spy bought in the SAME turn
//                         (v1.3 behaviour — the [Guide] says "per living spy", research/05 §5.1 conflict). Contact lost / target dead => budget 0, mode Hide.
//   turn(S,R) → [interrupt]   mission resolution (§5.3-5.5). Human choices are returned as interrupts, AI missions are resolved inline.
//                         The array has a custom iterator: when the driver moves past an interrupt that nobody answered, the default pick is applied (so a driver that
//                         ignores answers still gets a deterministic outcome). Better: turn.js should do  `const a = yield ev; if (ev.answer) ev.answer(a);`  (like diplomacy).
//
// INTERRUPTS (JSON + two non-enumerable functions  it.answer(pick)  and  it.settle())
//   {type:'spyStealChoice', id, empire, target, race, star, planet, n (spies that got in), cap (tech-level cap = best roll × target's best TL / 100),
//    candidates:[{field, fieldName, level, id, name, desc, value}]  ONE per field (research/05 §5.4: "up to 5 sampler attempts, best per field"),
//    fields:[6 bool], anyCaught, frame:bool, frameChoices:[{empire, race, name}]}
//       answer: candidate index | {index} | {field[,level]} | {…, frame: empireId}  |  null/false/-1/{abort:true} = abort (spies stay)  |  undefined = default (highest value, no frame)
//       result (it.result): {granted:{field,level,id,name}|null, aborted, blamed, framed, penalty}
//   {type:'spySabotageChoice', id, empire, target, n, chances, units (= sum of rnd(5) over the chances), planets:[{planet, star, name, pop, factories, bases, unrest, rebels, canIncite}],
//    anyCaught, frame, frameChoices}
//       answer: {planet, action:'factories'|'bases'|'revolt'[, frame]} | null = abort | undefined = default (most factories)
//       result: {planet, action, destroyed, rebels, rebellion, none, blamed, framed, penalty}
//
// NOTICES for human victims / owners are pushed as {type:'notice', kind:'techStolen'|'sabotage'|'spiesCaught'|'spiesLost'|'spyNothing', empire (who sees it), by (blamed empire id or -1 = "Unknown spies"), …}.
// DIPLOMACY: every political consequence goes through Diplo.incident(S, kind, from, to, dv, extra) when present — kind 'spyTheft' (-5d12, dtype 4), 'spyFrameTheft' (-(2d12), 5),
// 'sabotage' (-(20+d20), 6), 'spyFrameSabotage' (-(2d16), 7); from = the culprit, to = the victim whose attitude drops, dv = signed DP before scaling (Diplo takes |dv| and negates).
// Incite revolt uses Ground.incite(S, planet, rebels) when present.
//
// DECISIONS (research conflicts): v1.3 code over the Guide (roll tables, doubling per turn, 5d12 penalty); research/08 §17 "keep the quirks": a HUMAN saboteur costs no DP
// (Sp.QUIRKS.humanSabotagePenalty = false; set true for the intended 20+d20) and an AI-vs-AI sabotage frame-up GIVES the scapegoat +2d16 (Sp.QUIRKS.aiFrameSabotageSign = +1; -1 = intended);
// an identified human spy pays 5d12 only when NOT framing; advanced "TL-only" techs are not stealable; the Death Ray is (value 30000).
MOO.def(function (M) {
  'use strict';
  const Sp = M.Sim.Spy = {};
  const Sim = M.Sim;
  const O = Sim.Orders;
  Sp.MODES = ['hide', 'espionage', 'sabotage'];
  Sp.QUIRKS = { humanSabotagePenalty: false, aiFrameSabotageSign: 1 };       // sign: +1 = original (a framed scapegoat gains DP), -1 = intended

  // ---- small helpers --------------------------------------------------------------------------------------------------------------------------------
  const raceMod = E => { const D = M.Data && M.Data.Races; const r = D && D.races && D.races[E.race]; return (r && r.mod) || {}; };
  const compTL = E => (E.research && E.research.tl ? E.research.tl[0] : 1) | 0;
  const weapTL = E => (E.research && E.research.tl ? E.research.tl[5] : 1) | 0;
  const zero = n => Array.from({ length: n }, () => new Array(n).fill(0));
  const ensure = E => {
    for (const k of ['spyBudget', 'spies', 'spyMode', 'spyFund']) { if (!E[k]) E[k] = []; while (E[k].length < 6) E[k].push(0); }
    return E;
  };
  const st = S => {
    const n = S.empires.length;
    if (!S.spy || !S.spy.caught || S.spy.caught.length !== n) {
      const old = S.spy || {};
      S.spy = { caught: zero(n), totals: old.totals && old.totals.length === n ? old.totals : zero(n), pending: old.pending || [], nextId: old.nextId || 1, log: [] };
    }
    return S.spy;
  };
  const notice = (S, ev) => { if (Sim.Ev) Sim.Ev.push(S, Object.assign({ type: 'notice' }, ev)); };
  const newsPush = (S, ev) => { if (Sim.Ev) Sim.Ev.push(S, Object.assign({ type: 'news' }, ev)); };
  const incident = (S, kind, from, to, dv, info) => {
    const D = Sim.Diplo;
    if (D && typeof D.incident === 'function') { try { return D.incident(S, kind, from, to, dv, info); } catch (e) { return null; } }
    return null;
  };

  // Diplomatic contact (research/05 §4.1): Diplo when present, else the geometric rule (some planet of a within max fuel range of some planet of b).
  Sp.contact = function (S, a, b) {
    const D = Sim.Diplo;
    if (D && typeof D.hasContact === 'function') { try { return !!D.hasContact(S, a, b); } catch (e) { /* fall through */ } }
    const A = S.empires[a], B = S.empires[b];
    if (!A || !B || !A.alive || !B.alive || a === b) return false;
    const range = Math.max((A.range | 0) || 3, (B.range | 0) || 3), Geo = Sim.Geo;
    for (const p of S.planets) {
      if (p.owner !== a) continue;
      for (const q of S.planets) if (q.owner === b && Geo.parsecs(S, p.starId, q.starId) <= range) return true;
    }
    return false;
  };

  // ---- hiring (§5.1) ------------------------------------------------------------------------------------------------------------------------------
  Sp.baseCost = function (S, E) {
    const mul = raceMod(E).spyCostMul;
    const xc = (E.mods && E.mods.spyCostPct) || 100, base = (2 * compTL(E) + 25) * (mul === undefined ? 1 : mul);   // xc: expansion Neural Infiltration Net
    return Math.max(1, Math.floor(xc === 100 ? base : base * xc / 100));
  };
  // BC of the first spy bought this turn; every further spy bought in the same turn costs double the previous one
  Sp.nextCost = (S, E) => Sp.baseCost(S, E);
  Sp.buyPlan = function (base, fund) {                    // pure: how many spies does `fund` buy, and what is left
    let n = 0, cost = base;
    while (fund >= cost && n < 40) { n++; fund -= cost; cost *= 2; }
    return { n, rest: fund };
  };

  Sp.buildTurn = function (S, R) {
    const hired = [];
    Sp.flush(S, R);
    for (const E of S.empires) {
      if (!E.alive) continue;
      ensure(E);
      const gross = (E.flow && E.flow.gross) | 0, base = Sp.baseCost(S, E);
      for (let t = 0; t < S.empires.length; t++) {
        if (t === E.id) continue;
        const T = S.empires[t];
        if (!T || !T.alive) { E.spyBudget[t] = 0; E.spyMode[t] = 0; E.spies[t] = 0; E.spyFund[t] = 0; continue; }
        const bud = E.spyBudget[t] | 0;
        if (!bud && !(E.spyMode[t] | 0)) continue;
        if (!Sp.contact(S, E.id, t)) { E.spyBudget[t] = 0; E.spyMode[t] = 0; continue; }             // contact lost: budget forced to 0, spies hide
        if (!bud) continue;
        const plan = Sp.buyPlan(base, Math.floor(gross * bud / 1000) + (E.spyFund[t] | 0));
        E.spies[t] = (E.spies[t] | 0) + plan.n; E.spyFund[t] = plan.rest;
        if (plan.n) hired.push({ empire: E.id, target: t, n: plan.n });
      }
    }
    return hired;
  };

  // ---- roll tables (§5.3), pure helpers so tests can check them analytically ----------------------------------------------------------------------
  // success: rnd(100) + dt1 > 84  →  (16 + dt1)% (capped at 100); frame: rnd(100) + dt1 > 100
  Sp.infiltrationChance = dt1 => Math.max(0, Math.min(100, 16 + dt1)) / 100;
  Sp.frameChance = dt1 => Math.max(0, Math.min(100, dt1)) / 100;
  // per-spy outcome probabilities for spies on a mission: r = rnd(100) + dt2: >99 confess, 71..99 eliminated, 51..70 stopped, else clear
  Sp.catchOdds = function (dt2) {
    const cnt = (lo, hi) => { let c = 0; for (let v = 1; v <= 100; v++) { const r = v + dt2; if (r >= lo && r <= hi) c++; } return c / 100; };
    return { confess: cnt(100, 1e9), eliminated: cnt(71, 99), stopped: cnt(51, 70), clear: cnt(-1e9, 50) };
  };
  Sp.dts = function (S, A, T, mode) {
    const comp1T = compTL(T) + (raceMod(T).spyDef | 0), comp2A = compTL(A) + (raceMod(A).spyOff | 0) + ((A.mods && A.mods.spyOff) | 0);   // + expansion: Neural Infiltration Net
    let dt1 = Math.max(0, comp2A - comp1T);
    const dt2 = Math.max(0, comp1T - comp2A) + Math.floor((T.security | 0) / 5);
    if (mode === 0) dt1 += 30;
    return { dt1, dt2 };
  };

  // ---- the tech a spy can steal (§5.4, research/02 §1.10) ------------------------------------------------------------------------------------------
  const STEALABLE_GROUPS = { 'robotic-controls': 1, scanner: 1, waste: 1, 'industrial-tech': 1, 'planetary-shield': 1, terraforming: 1, environment: 1, 'eco-restoration': 1, 'personal-armor': 1, 'personal-shield': 1, fuel: 1, 'personal-weapon': 1 };
  const NO_ECO = { waste: 1, environment: 1, 'eco-restoration': 1 };
  const groupTiers = E => {
    const m = {}, Tc = M.Data.Techs;
    for (let f = 0; f < 6; f++) for (const l of E.research.completed[f]) { const t = Tc.byFL[f][l]; if (t && t.gtier && (m[t.group] || 0) < t.gtier) m[t.group] = t.gtier; }
    return m;
  };
  // value used to rank candidates: level², ×10 singular, ×6 robotic controls, ×3 waste / eco restoration, /4 when a higher tier of its group is owned, 0 when equal; Death Ray 30000
  Sp.techValue = function (t, tiers) {
    if (t.special === 'orion-only') return 30000;
    let v = t.level * t.level;
    if (t.group === 'singular') v *= 10; else if (t.group === 'robotic-controls') v *= 6; else if (t.group === 'waste' || t.group === 'eco-restoration') v *= 3;
    const own = (tiers && tiers[t.group]) || 0;
    if (t.gtier && own) { if (own > t.gtier) v = Math.floor(v / 4); else if (own === t.gtier) v = 0; }
    return v;
  };
  Sp.stealable = function (thief, t, tiers) {
    if (!t || t.group === 'advanced' || t.free) return false;
    const own = (tiers && tiers[t.group]) || 0;
    if (STEALABLE_GROUPS[t.group] && t.gtier && own >= t.gtier) return false;                  // an equal or higher tier of the group is already owned
    if (thief.race === 'silicoid' || raceMod(thief).noEcoTech) { if (NO_ECO[t.group] || (t.never && t.never.indexOf(thief.race) >= 0)) return false; }      // Silicoid thieves skip waste / environment / eco-restoration (+ soil, atmosphere)
    else if (t.never && t.never.indexOf(thief.race) >= 0) return false;
    return Sp.techValue(t, tiers) > 0;
  };
  // up to `max` (6 = TECH_SPY_MAX) random DISTINCT techs the victim has and the thief lacks: random field first, then random tech inside it
  Sp.sample = function (S, thief, victim, R, max) {
    const Tc = M.Data.Techs, tiers = groupTiers(thief), pool = [[], [], [], [], [], []];
    let left = 0;
    for (let f = 0; f < 6; f++) for (const l of victim.research.completed[f]) {
      if (thief.research.completed[f].indexOf(l) >= 0) continue;
      const t = Tc.byFL[f][l];
      if (!t || !Sp.stealable(thief, t, tiers)) continue;
      pool[f].push({ field: f, level: l, tech: t, value: Sp.techValue(t, tiers) }); left++;
    }
    const out = [];
    while (out.length < (max || 6) && left > 0) {
      const f = R.int(0, 5);
      if (!pool[f].length) continue;
      out.push(pool[f].splice(R.int(0, pool[f].length - 1), 1)[0]); left--;
    }
    return out;
  };
  Sp.stealCap = (roll, victim) => Math.floor(roll * Math.max.apply(null, victim.research.tl) / 100);
  // what a HUMAN spy is offered: 5 sampler attempts, cap-filtered, best candidate per field
  Sp.offer = function (S, thief, victim, cap, R) {
    const best = [null, null, null, null, null, null];
    for (let a = 0; a < 5; a++) for (const c of Sp.sample(S, thief, victim, R, 6)) if (c.level <= cap && (!best[c.field] || c.value > best[c.field].value)) best[c.field] = c;
    return best.filter(Boolean);
  };
  const candInfo = c => ({ field: c.field, fieldName: M.Data.Techs.FIELD_NAMES[c.field], level: c.level, id: c.tech.id, name: c.tech.name, desc: c.tech.desc, value: c.value });

  // ---- framing helpers --------------------------------------------------------------------------------------------------------------------------------
  const frameCands = (S, A, T) => S.empires.filter(c => c.alive && c.id !== A.id && c.id !== T.id && Sp.contact(S, T.id, c.id)).map(c => c.id);

  // ---- pending choices ------------------------------------------------------------------------------------------------------------------------------------
  function makePending(S, data) {
    const s = st(S), it = data;
    it.id = s.nextId++; it.done = false;
    Object.defineProperty(it, 'answer', { value: function (pick) { return Sp.resolve(S, it, pick); }, enumerable: false, configurable: true });
    Object.defineProperty(it, 'settle', { value: function () { if (!it.done) Sp.resolve(S, it, undefined); }, enumerable: false, configurable: true });
    s.pending.push(it);
    return it;
  }
  function iterable(list) {
    Object.defineProperty(list, Symbol.iterator, {
      configurable: true, enumerable: false, writable: true,
      value: function () {
        let i = 0;
        return { next() {
          if (i > 0 && list[i - 1] && list[i - 1].settle) list[i - 1].settle();
          if (i >= list.length) return { done: true, value: undefined };
          return { done: false, value: list[i++] };
        } };
      },
    });
    return list;
  }
  // settle every unanswered choice (defaults). Called at the start of every spy phase.
  Sp.flush = function (S, R) {
    const s = st(S);
    for (const it of s.pending.slice()) { if (!it.done) Sp.resolve(S, it, undefined, R); }
    s.pending = s.pending.filter(it => !it.done);
  };

  // ---- the per-turn resolution (§5.3) ----------------------------------------------------------------------------------------------------------------------
  Sp.turn = function (S, R) {
    R = R || M.RNG.bind(S.rs);
    const s = st(S), n = S.empires.length, out = [];
    Sp.flush(S, R);
    for (let t = 0; t < n; t++) for (let o = 0; o < n; o++) s.caught[t][o] = 0;
    s.log = [];
    const has = new Array(n).fill(false);
    for (const p of S.planets) if (p.owner >= 0) has[p.owner] = true;
    for (const A of S.empires) {
      if (!A.alive) continue;
      ensure(A);
      for (let t = 0; t < n; t++) {
        const T = S.empires[t];
        if (t === A.id || !T.alive || (A.spies[t] | 0) <= 0 || !has[A.id] || !has[t]) continue;
        mission(S, A, T, R, s, out);
      }
    }
    refreshReports(S);
    return iterable(out);
  };

  function mission(S, A, T, R, s, out) {
    const t = T.id, mode = A.spyMode[t] | 0, d = Sp.dts(S, A, T, mode);
    let n = A.spies[t] | 0, caught = 0, failed = 0, any = false, frame = false;
    if (mode === 0) {
      for (let i = 0; i < n; i++) if (R.int(1, 100) + d.dt2 > 85) caught++;                       // hiding spies: each one caught on rnd(100) + dt2 > 85 (~15% at equal tech); no mission
      n = 0;
    } else {
      for (let i = 0; i < n; i++) {
        const r = R.int(1, 100) + d.dt2;
        if (r > 99) { caught = failed = n; any = true; break; }                                    // confession: the whole network is lost and fully blamed
        else if (r > 70) { caught++; failed++; any = true; }                                       // eliminated
        else if (r > 50) { failed++; any = true; }                                                 // stopped for the turn, survives
      }
    }
    n = Math.max(0, n - failed);
    caught = Math.min(caught, A.spies[t] | 0);
    A.spies[t] = (A.spies[t] | 0) - caught;
    s.caught[t][A.id] += caught; s.totals[t][A.id] += caught;
    if (caught > 0) {
      if (A.human) notice(S, { kind: 'spiesLost', empire: A.id, target: t, n: caught });
      if (T.human) notice(S, { kind: 'spiesCaught', empire: T.id, by: A.id, n: caught });
      if (A.human || T.human) newsPush(S, { cat: 'spyCaught', empire: A.id, empire2: t });
    }
    const entry = { empire: A.id, target: t, mode, caught, failed, active: mode === 0 ? 0 : n, success: 0, frame: false, anyCaught: any };
    s.log.push(entry);
    if (mode === 0 || n <= 0) return;
    const r = R.int(1, 100) + d.dt1;
    if (r <= 84) return;                                                                          // the group fails to infiltrate
    if (r > 100) frame = true;
    entry.success = n; entry.frame = frame;
    if (mode === 1) espionage(S, A, T, n, any, frame, R, out); else sabotage(S, A, T, n, any, frame, R, out);
  }

  // ---- espionage mission (§5.4) --------------------------------------------------------------------------------------------------------------------------
  function espionage(S, A, T, success, any, frame, R, out) {
    let mx = 0;
    for (let i = 0; i < success; i++) mx = Math.max(mx, R.int(1, 100));
    const cap = Sp.stealCap(mx, T);
    if (A.human) {
      const offer = Sp.offer(S, A, T, cap, R);
      if (!offer.length) { notice(S, { kind: 'spyNothing', empire: A.id, target: T.id }); return; }
      const fc = frame ? frameCands(S, A, T) : [];
      const okFrame = fc.length >= 2;
      out.push(makePending(S, {
        type: 'spyStealChoice', kind: 'steal', empire: A.id, target: T.id, race: T.race, star: T.capital, planet: T.capital, n: success, cap,
        candidates: offer.map(candInfo), fields: [0, 1, 2, 3, 4, 5].map(f => offer.some(c => c.field === f)), anyCaught: any,
        frame: okFrame, frameChoices: okFrame ? fc.slice(0, 2).map(id => ({ empire: id, race: S.empires[id].race, name: S.empires[id].name })) : [],
      }));
      return;
    }
    const cands = Sp.sample(S, A, T, R, 6).filter(c => c.level <= cap);                          // the AI takes candidate #1
    if (!cands.length) return;
    let frameTarget = -1;
    if (frame) {
      const fc = frameCands(S, A, T);
      if (T.human) { if (fc.length) frameTarget = fc[R.int(0, fc.length - 1)]; }
      else if (R.int(0, 1) === 0) { const hs = fc.filter(id => S.empires[id].human); if (hs.length) frameTarget = hs[R.int(0, hs.length - 1)]; }   // AI-vs-AI: 50% a human is blamed
    }
    finishSteal(S, A, T, cands[0], { any, frameTarget }, R);
  }

  function finishSteal(S, A, T, c, ctx, R) {
    const tech = c.tech || M.Data.Techs.byFL[c.field][c.level];
    Sim.Research.grant(S, A, c.field, c.level, 'spy');
    let blamed = -1, framed = -1, penalty = 0;
    if (ctx.frameTarget >= 0) {                                                                  // a successful frame-up: the chosen race takes 2d12 (dtype 5; an AI thief's frame: 20+d20)
      framed = ctx.frameTarget;
      if (!T.human) { penalty = A.human ? R.int(1, 12) + R.int(1, 12) : R.int(1, 20) + 20; incident(S, 'spyFrameTheft', framed, T.id, -penalty, { dtype: 5, field: c.field, tech: tech.id }); }
    }
    if (ctx.any) {
      blamed = A.id;
      if (A.human && !T.human && framed < 0) { const p5 = R.dice(5, 12); penalty = p5; incident(S, 'spyTheft', A.id, T.id, -p5, { dtype: 4, framed: false, field: c.field, tech: tech.id }); }   // identified human spy: -5d12
    }
    const shown = framed >= 0 ? framed : (ctx.any ? A.id : -1);
    if (T.human) {
      notice(S, { kind: 'techStolen', empire: T.id, by: shown, field: c.field, level: c.level, tech: tech.name, id: tech.id });
      newsPush(S, { cat: 'techStolen', empire: shown >= 0 ? shown : A.id, empire2: T.id, tech: tech.name });
    }
    return { granted: { field: c.field, level: c.level, id: tech.id, name: tech.name }, aborted: false, blamed, framed, penalty };
  }

  // ---- sabotage mission (§5.5) ------------------------------------------------------------------------------------------------------------------------------
  function sabotage(S, A, T, success, any, frame, R, out) {
    const chances = Math.floor((weapTL(A) + 9) * success / 10);
    let units = 0;
    for (let i = 0; i < chances; i++) units += R.int(1, 5);
    const targets = S.planets.filter(p => p.owner === T.id);
    if (!targets.length || units <= 0) return;
    if (A.human) {
      const fc = frame ? frameCands(S, A, T) : [], okFrame = fc.length >= 2;
      out.push(makePending(S, {
        type: 'spySabotageChoice', kind: 'sabotage', empire: A.id, target: T.id, race: T.race, n: success, chances, units,
        planets: targets.map(p => ({ planet: p.id, star: p.starId, name: p.name, pop: p.pop | 0, factories: p.factories | 0, bases: p.bases | 0, unrest: p.unrest | 0, rebels: p.rebels | 0, canIncite: (p.unrest | 0) === 0 })),
        anyCaught: any, frame: okFrame, frameChoices: okFrame ? fc.slice(0, 2).map(id => ({ empire: id, race: S.empires[id].race, name: S.empires[id].name })) : [],
      }));
      return;
    }
    const p = targets[R.int(0, targets.length - 1)];
    let action;
    if (T.human && (p.unrest | 0) === 0 && R.int(1, 100) <= 25) action = 'revolt'; else action = R.int(0, 1) === 0 ? 'factories' : 'bases';
    let frameTarget = -1;
    if (frame) { const fc = frameCands(S, A, T); if (fc.length) frameTarget = fc[R.int(0, fc.length - 1)]; }
    applySabotage(S, A, T, p, action, units, any, frameTarget, R);
  }

  // apply one sabotage strike. Human strikers use the 25%-per-unit base rule, AI strikers the "units/5" rule of §5.5.
  function applySabotage(S, A, T, p, action, units, any, frameTarget, R) {
    const res = { planet: p.id, action, destroyed: 0, rebels: 0, rebellion: false, none: false, blamed: -1, framed: -1, penalty: 0 };
    if (action === 'bases') {
      let k;
      if (A.human) { k = 0; for (let i = 0; i < units; i++) if (R.int(1, 100) <= 25) k++; } else k = Math.floor(units / 5);
      res.destroyed = Math.min(k, p.bases | 0); p.bases = (p.bases | 0) - res.destroyed;
      if (!(p.bases + res.destroyed)) res.none = true;
    } else if (action === 'factories') {
      res.destroyed = Math.min(units, p.factories | 0); p.factories = (p.factories | 0) - res.destroyed;
      if (!(p.factories + res.destroyed)) res.none = true;
    } else if (action === 'revolt') {
      if ((p.unrest | 0) !== 0) res.none = true;
      else {
        const pop = p.pop | 0;
        const add = A.human ? Math.max(1, Math.floor(pop * units / 200)) : Math.max(1, Math.min(pop, Math.floor(pop * Math.floor(units / 2) / 100)));
        res.rebels = add;
        const G = Sim.Ground;
        if (G && typeof G.incite === 'function') G.incite(S, p, add);                         // the shared rebellion mechanic (rebels >= pop/2 -> rebellion)
        else { p.rebels = (p.rebels | 0) + add; if (p.rebels >= Math.floor(pop / 2)) { p.unrest = 2; p.rebels = Math.max(1, Math.floor(pop / 2)); } else if (p.rebels > 0) p.unrest = 1; }
        res.rebellion = (p.unrest | 0) === 2;
      }
    }
    // politics: an identified striker pays 20+d20 (dtype 6) except for incitement; a frame-up costs the framed race 2d16 (dtype 7)
    if (frameTarget >= 0) {
      res.framed = frameTarget;
      if (!T.human) {
        const dv = A.human ? -(R.int(1, 12) + R.int(1, 12)) : (R.int(1, 16) + R.int(1, 16)) * Sp.QUIRKS.aiFrameSabotageSign;      // human: -2d12; AI: ±2d16 (the original gives the scapegoat a GAIN, research/08 §17 #9)
        res.penalty = -dv;
        const D = Sim.Diplo;
        if (dv > 0 && D && typeof D.act === 'function') { try { D.act(S, dv, frameTarget, T.id, 7, p.id, action); } catch (e) { /* optional */ } }   // Diplo.incident only knows penalties: use the raw DP engine for the gain
        else incident(S, 'spyFrameSabotage', frameTarget, T.id, dv, { dtype: 7, planet: p.id, what: action });
      }
    }
    if (any && action !== 'revolt') {
      res.blamed = A.id;
      if (!T.human && frameTarget < 0 && (!A.human || Sp.QUIRKS.humanSabotagePenalty)) { const pen = R.int(1, 20) + 20; res.penalty = pen; incident(S, 'sabotage', A.id, T.id, -pen, { dtype: 6, framed: false, planet: p.id, what: action }); }
    }
    if (T.human) {
      const shown = res.framed >= 0 ? res.framed : (any ? A.id : -1);
      notice(S, { kind: 'sabotage', empire: T.id, by: shown, planet: p.id, star: p.starId, action, n: res.destroyed || res.rebels, rebellion: res.rebellion });
      newsPush(S, { cat: 'sabotage', empire: shown >= 0 ? shown : A.id, empire2: T.id, planet: p.id });
    }
    return res;
  }

  // ---- answering human choices ------------------------------------------------------------------------------------------------------------------------------
  Sp.resolve = function (S, it, pick, R) {
    if (!it) return null;
    if (it.done) return it.result;
    R = R || M.RNG.bind(S.rs);
    it.done = true;
    const s = st(S); s.pending = s.pending.filter(x => x !== it);
    const A = S.empires[it.empire], T = S.empires[it.target];
    it.result = it.kind === 'steal' ? resolveSteal(S, A, T, it, pick, R) : resolveSabotage(S, A, T, it, pick, R);
    return it.result;
  };
  const isAbort = pick => pick === null || pick === false || pick === -1 || (pick && typeof pick === 'object' && pick.abort);
  const frameOf = (it, pick) => {
    const f = pick && typeof pick === 'object' ? pick.frame : undefined;
    return it.frame && typeof f === 'number' && it.frameChoices.some(c => c.empire === f) ? f : -1;
  };
  function resolveSteal(S, A, T, it, pick, R) {
    const c = it.candidates;
    let idx = -1;
    if (isAbort(pick)) return { granted: null, aborted: true, blamed: -1, framed: -1, penalty: 0 };
    const best = () => { let bv = -1, bi = -1; c.forEach((x, i) => { if (x.value > bv) { bv = x.value; bi = i; } }); return bi; };
    if (pick === undefined) idx = best();
    else if (typeof pick === 'number') idx = pick;
    else if (pick && typeof pick === 'object') {
      if (typeof pick.index === 'number') idx = pick.index;
      else if (typeof pick.field === 'number') idx = c.findIndex(x => x.field === pick.field && (pick.level === undefined || x.level === pick.level));
      else if (typeof pick.candidate === 'number') idx = pick.candidate;
      else idx = best();
    }
    if (!(idx >= 0 && idx < c.length)) return { granted: null, aborted: true, blamed: -1, framed: -1, penalty: 0 };
    const x = c[idx];
    return finishSteal(S, A, T, { field: x.field, level: x.level, tech: M.Data.Techs.byFL[x.field][x.level], value: x.value }, { any: it.anyCaught, frameTarget: frameOf(it, pick) }, R);
  }
  function resolveSabotage(S, A, T, it, pick, R) {
    const none = { planet: -1, action: null, destroyed: 0, rebels: 0, rebellion: false, none: true, aborted: true, blamed: -1, framed: -1, penalty: 0 };
    if (isAbort(pick)) return none;
    let planet = -1, action = 'factories';
    if (pick && typeof pick === 'object') { if (typeof pick.planet === 'number') planet = pick.planet; if (pick.action) action = pick.action; }
    if (planet < 0) { let bf = -1; for (const q of it.planets) if (q.factories > bf) { bf = q.factories; planet = q.planet; } }
    const p = S.planets[planet];
    if (!p || p.owner !== T.id || ['factories', 'bases', 'revolt'].indexOf(action) < 0) return none;
    return applySabotage(S, A, T, p, action, it.units, it.anyCaught, frameOf(it, pick), R);
  }

  // ---- reports (Races screen "Report" and the Spies Caught overlay) -----------------------------------------------------------------------------------------
  function refreshReports(S) {
    for (const A of S.empires) {
      if (!A.alive) continue;
      A.spyReport = A.spyReport || [];
      while (A.spyReport.length < S.empires.length) A.spyReport.push(null);        // no array holes: the state must survive a JSON round-trip unchanged
      for (const T of S.empires) {
        if (T.id === A.id || !T.alive || (A.spies[T.id] | 0) <= 0) continue;
        A.spyReport[T.id] = { year: S.year, best: T.research.completed.map(l => Math.max.apply(null, l)) };
      }
    }
  }
  Sp.reports = function (S, E) {
    ensure(E);
    const s = st(S), Tc = M.Data.Techs, rows = [];
    for (const T of S.empires) {
      if (T.id === E.id) continue;
      const rep = E.spyReport && E.spyReport[T.id];
      rows.push({
        empire: T.id, race: T.race, name: T.name, plural: T.plural, color: T.color, alive: T.alive, contact: Sp.contact(S, E.id, T.id),
        spies: E.spies[T.id] | 0, budget: E.spyBudget[T.id] | 0, mode: E.spyMode[T.id] | 0, modeName: Sp.MODES[E.spyMode[T.id] | 0], fund: E.spyFund[T.id] | 0,
        yours: s.caught[T.id][E.id], theirs: s.caught[E.id][T.id], yoursTotal: s.totals[T.id][E.id], theirsTotal: s.totals[E.id][T.id],
        report: rep ? { year: rep.year, fields: rep.best.map((l, f) => { const t = Tc.byFL[f][l]; return { field: f, level: l, name: t ? t.name : 'Tech ' + l }; }) } : null,
      });
    }
    const secBonus = Math.floor((E.security | 0) / 5) + (raceMod(E).spyDef | 0);
    return { rows, security: E.security | 0, securityBonus: secBonus, cost: Sp.baseCost(S, E), year: S.year };
  };

  // ---- orders (validated exactly like human orders; the AI planner in js/ai/spy.js emits the same) ---------------------------------------------------------
  function targetOf(S, E, o) {
    const t = o.target | 0;
    if (!(o.target >= 0) || t !== o.target || t >= S.empires.length) return null;
    const T = S.empires[t];
    return T && T.alive && t !== E.id ? T : null;
  }
  Sp.setBudget = function (S, E, t, v) {
    ensure(E);
    v = Math.max(0, Math.min(100, Math.round(v)));
    if (v > 0 && !Sp.contact(S, E.id, t)) return null;
    E.spyBudget[t] = v; return v;
  };
  O.register('spyBudget', function (S, E, o) {
    const T = targetOf(S, E, o); if (!T) return O.fail('bad target');
    if (typeof o.value !== 'number' || o.value !== o.value) return O.fail('bad value');
    const v = Sp.setBudget(S, E, T.id, o.value);
    return v === null ? O.fail('no contact') : O.ok({ value: v });
  });
  O.register('spyMode', function (S, E, o) {
    const T = targetOf(S, E, o); if (!T) return O.fail('bad target');
    ensure(E);
    let m = o.mode;
    if (typeof m === 'string') m = Sp.MODES.indexOf(m.toLowerCase());
    if (!(m === 0 || m === 1 || m === 2)) return O.fail('bad mode');
    if (m !== 0 && !Sp.contact(S, E.id, T.id)) return O.fail('no contact');
    E.spyMode[T.id] = m; return O.ok({ mode: m });
  });
});
