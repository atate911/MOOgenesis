// Galactic (High) Council and the end-of-game checks (research/05 §6 + §8, research/01 §5.10, research/01 §5.12). Worker-safe.
//
// WHEN   due(S): not over, >= 3 empires alive, >= floor(2/3 of the stars) colonised, and (the first session ever  OR  internal year % 25 == 0).
// WHO    convene(S,R) → info:  electorate[{empire, race, name, plural, leader, color, human, alive, pop, votes}]  (votes = ceil(non-rebel pop / 100)),
//        total, need = floor(((total+1)*2)/3), candidates [c0, c1] (the two biggest, ties keep empire order; an AI leader with a human runner-up lists the human first),
//        order (AIs in id order, humans last), ballots [{empire, votes, choice (empire id | -1 abstain), human:false}]  — every AI has ALREADY voted (rules below) so the
//        scene can replay them — humans [{empire, votes}] still to vote, choices [{key, empire}] (the "1 / 2 / 0" menu), year, first, previous (last session's votes).
// VOTE   the interrupt {type:'council', info} is answered with the human's vote: a candidate EMPIRE ID, or -1 (also null/undefined/anything else) = abstain.
//        autoVote(S, info) → the same value chosen with the AI rules (headless / default driver).
// AI     (research/05 §6.3 = research/01 §5.10): w(c) = 20 [c owns Orion] + councilBonus of c's race (Human 20) + 40 [I voted for c last time];
//        own candidate → self · allied to a candidate → ally · at war with one → the other · rel(c0) >= 0: rnd(100) < rel/4 + w(c0) → c0, else rnd(100) < -rel/4 + w(c1) → c1 ·
//        rel(c1) >= 0: rnd(100) < rel/4 + w(c1) → c1, else rnd(100) < -rel/5 + w(c0) → c0 · otherwise abstain (also with 0 votes).
// RESOLVE resolve(S, info, humanVote, R) → result {year, candidates, ballots, votes{id:n}, tally[{empire,votes}], total, need, winner (-1 none), noWinner, humanElected,
//        needsAnswer: ['accept','defy'] | null, accepted: null|bool, gameOver, reason ('council' good ending | 'exile' | null), finalWar, text, finish(accepted)}
//        Side effects (via Diplo.incident(S,'councilVote',voter,candidate,dv)): +24 towards the candidate voted for, -12 towards the other, -6 towards both on abstaining.
//        With a living human the ruling must be accepted or defied: the 'councilResult' interrupt carries `result`; the handler (or turn.js) answers with
//        Council.finish(S, info, accepted)  ≡ result.finish(accepted)   (true/'accept'  = the game ends:  winner human → reason 'council' (WON_GOOD), AI → 'exile' (LOST_EXILE);
//        false/'defy' = FINAL WAR: the refuser is at war with everybody, everybody else is allied and shares techs every turn; if the human won he refuses the throne
//        and the other candidate becomes the winner). Unanswered rulings default to ACCEPT the next time due() runs (the original treats ESC as yes).
//        finish() mutates the SAME result object, so a turn.js that checks `out.gameOver` after the interrupt sees the final answer.
// FINAL WAR  S.council.finalWar = {refusers:[ids], winner, year}; Diplo.finalWar(S, refusers) sets the treaties (allied +100 / final war -100) and Diplo.economyTurn pools the techs every turn
//        (finalWarShare); without Diplo, Council.finalWarTurn(S) (called from Events.coups) does both on the placeholder relations. isFinalWar(S), refusers(S).
// VICTORY  Sim.Victory.check(S) → null | {reason:'conquest'|'council'|'defeat'|'exile', winner, ending:'tyrant'|'good'|'funeral'|'exile', …} (§8.1: council verdict, one empire owns
//        all planets, no human owns a non-rebelling planet); Victory.payload(S, over) → the {type:'gameover', …} interrupt for the endings screen. S.gameOver stores a verdict.
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Council = {};
  const V = M.Sim.Victory = {};
  const Sim = M.Sim;
  const cfg = () => (M.Data && M.Data.Config) || {};
  const every = () => cfg().COUNCIL_EVERY || 25;
  const races = () => (M.Data && M.Data.Races && M.Data.Races.races) || {};
  const raceMod = E => { const r = races()[E.race]; return (r && r.mod) || {}; };
  const newsPush = (S, ev) => { if (Sim.Ev) Sim.Ev.push(S, Object.assign({ type: 'news' }, ev)); };
  const incident = (S, kind, from, to, dv, info) => {
    const D = Sim.Diplo;
    if (D && typeof D.incident === 'function') { try { return D.incident(S, kind, from, to, dv, info); } catch (e) { return null; } }
    return null;
  };
  const state = S => {
    const c = S.council || (S.council = {});
    if (c.held === undefined) c.held = false;
    if (c.lastYear === undefined) c.lastYear = 0;
    if (c.emperor === undefined) c.emperor = -1;
    if (c.over === undefined) c.over = false;
    if (!c.voted) c.voted = [];
    if (!c.history) c.history = [];
    if (c.pending === undefined) c.pending = null;
    if (c.finalWar === undefined) c.finalWar = null;
    return c;
  };

  // ---- relations as seen by the voters (Diplo when present, the placeholder E.relations otherwise) --------------------------------------------------------
  const TREATY = { none: 0, nap: 1, 'non-aggression pact': 1, alliance: 2, war: 3, 'final war': 4, finalwar: 4 };
  function rel(S, a, b) {
    const D = Sim.Diplo;
    if (D && typeof D.status === 'function') { try { const x = D.status(S, a, b); if (x && typeof x.attitude === 'number') return x.attitude; } catch (e) { /* fall through */ } }
    const r = S.empires[a].relations && S.empires[a].relations[b];
    return r && typeof r.attitude === 'number' ? r.attitude : 0;
  }
  function treaty(S, a, b) {
    const D = Sim.Diplo;
    if (D && typeof D.status === 'function') {
      try {
        const x = D.status(S, a, b);
        if (x) { if (typeof x.treaty === 'number') return x.treaty; if (typeof x.treaty === 'string' && TREATY[x.treaty.toLowerCase()] !== undefined) return TREATY[x.treaty.toLowerCase()]; if (typeof x.treatyName === 'string' && TREATY[x.treatyName.toLowerCase()] !== undefined) return TREATY[x.treatyName.toLowerCase()]; }
      } catch (e) { /* fall through */ }
    }
    const r = S.empires[a].relations && S.empires[a].relations[b];
    return r && typeof r.treaty === 'number' ? r.treaty : 0;
  }
  const allied = (S, a, b) => { const D = Sim.Diplo; if (D && typeof D.isAllied === 'function') { try { return !!D.isAllied(S, a, b); } catch (e) { /* fall through */ } } return treaty(S, a, b) === 2; };
  const atWar = (S, a, b) => { const D = Sim.Diplo; if (D && typeof D.atWar === 'function') { try { return !!D.atWar(S, a, b); } catch (e) { /* fall through */ } } return treaty(S, a, b) >= 3; };

  // ---- schedule & electorate --------------------------------------------------------------------------------------------------------------------------
  C.threshold = S => Math.floor(S.stars.length * 2 / 3);
  C.colonised = S => { let n = 0; for (const p of S.planets) if (p.owner >= 0) n++; return n; };
  C.need = total => Math.floor(((total + 1) * 2) / 3);
  C.isFinalWar = S => !!((S.council && S.council.finalWar) || (S.diplo && S.diplo.finalWar));
  C.refusers = S => (S.council && S.council.finalWar ? S.council.finalWar.refusers.slice() : []);

  C.due = function (S) {
    const c = state(S);
    if (c.pending) C.finish(S, null, true);                                       // an unanswered ruling counts as accepted (ESC = yes)
    if (S.gameOver || c.over || c.finalWar) return false;
    if (S.empires.filter(e => e.alive).length <= 2) return false;                 // two empires left: the only way to win is elimination
    if (c.lastYear === S.year && c.held) return false;
    if (C.colonised(S) < C.threshold(S)) return false;
    return !c.held || S.year % every() === 0;
  };

  C.electorate = function (S) {
    return S.empires.map(E => {
      let pop = 0;
      if (E.alive) for (const p of S.planets) if (p.owner === E.id && (p.unrest | 0) !== 2) pop += p.pop | 0;
      return { empire: E.id, race: E.race, name: E.name, plural: E.plural, leader: E.leader, color: E.color, human: !!E.human, alive: !!E.alive, pop, votes: E.alive ? Math.ceil(pop / 100) : 0 };
    });
  };
  const ownsOrion = (S, c) => S.orion !== undefined && S.orion >= 0 && S.planets[S.orion] && S.planets[S.orion].owner === c;

  // ---- AI ballot (research/05 §6.3) ------------------------------------------------------------------------------------------------------------------
  C.aiVote = function (S, V_, cand, R) {
    const c = state(S), v = V_.id, c1 = cand[0], c2 = cand[1];
    const w = x => (ownsOrion(S, x) ? 20 : 0) + (raceMod(S.empires[x]).councilBonus | 0) + ((S.empires[x].mods && S.empires[x].mods.councilBonus) | 0) + (c.voted && c.voted[v] === x ? 40 : 0);   // + expansion: Holovision
    if (v === c1) return c1;
    if (v === c2) return c2;
    if (allied(S, v, c1)) return c1;
    if (allied(S, v, c2)) return c2;
    if (atWar(S, v, c1)) return c2;
    if (atWar(S, v, c2)) return c1;
    const r1 = rel(S, v, c1), r2 = rel(S, v, c2);
    if (r1 >= 0) { if (R.int(1, 100) < Math.floor(r1 / 4) + w(c1)) return c1; }
    else if (R.int(1, 100) < Math.floor(-r1 / 4) + w(c2)) return c2;
    if (r2 >= 0) { if (R.int(1, 100) < Math.floor(r2 / 4) + w(c2)) return c2; }
    else if (R.int(1, 100) < Math.floor(-r2 / 5) + w(c1)) return c1;               // (sic: /5, not /4 — research/05 §6.3)
    return -1;
  };

  C.convene = function (S, R) {
    R = R || M.RNG.bind(S.rs);
    const c = state(S), first = !c.held;
    c.held = true; c.lastYear = S.year;
    const el = C.electorate(S), alive = el.filter(e => e.alive);
    const ranked = alive.slice().sort((a, b) => b.votes - a.votes || a.empire - b.empire);
    let cand = [ranked[0].empire, ranked[1].empire];
    if (!S.empires[cand[0]].human && S.empires[cand[1]].human) cand = [cand[1], cand[0]];
    const total = alive.reduce((a, e) => a + e.votes, 0);
    const ai = alive.filter(e => !e.human).map(e => e.empire), hu = alive.filter(e => e.human).map(e => e.empire);
    const ballots = [];
    for (const id of ai) {
      const n = el[id].votes;
      ballots.push({ empire: id, votes: n, choice: n > 0 ? C.aiVote(S, S.empires[id], cand, R) : -1, human: false });
    }
    const info = {
      year: M.Data.Config.displayYear(S), turn: S.turn, first, electorate: el, total, need: C.need(total), candidates: cand, order: ai.concat(hu), ballots,
      humans: hu.map(id => ({ empire: id, votes: el[id].votes })), choices: [{ key: '1', empire: cand[0] }, { key: '2', empire: cand[1] }, { key: '0', empire: -1 }],
      previous: (c.voted || []).slice(), result: null,
    };
    newsPush(S, { cat: 'councilConvened', empire: cand[0], empire2: cand[1], year: info.year });
    return info;
  };

  // value the human's answer into a ballot choice
  const normVote = (v, cand) => {
    if (v && typeof v === 'object') v = v.empire !== undefined ? v.empire : v.vote;
    return typeof v === 'number' && cand.indexOf(v) >= 0 ? v : -1;
  };
  C.autoVote = function (S, info) {
    const R = M.RNG.bind(S.rs), h = info.humans && info.humans[0];
    if (!h || h.votes <= 0) return -1;
    return C.aiVote(S, S.empires[h.empire], info.candidates, R);
  };

  C.resolve = function (S, info, humanVote, R) {
    if (info.result) return info.result;
    R = R || M.RNG.bind(S.rs);
    const c = state(S), cand = info.candidates, ballots = info.ballots.map(b => Object.assign({}, b));
    info.humans.forEach((h, i) => {
      const choice = h.votes <= 0 ? -1 : (i === 0 ? normVote(humanVote, cand) : C.aiVote(S, S.empires[h.empire], cand, R));
      ballots.push({ empire: h.empire, votes: h.votes, choice, human: true });
    });
    const got = {}; cand.forEach(id => { got[id] = 0; });
    const voted = S.empires.map(() => -1);
    for (const b of ballots) {
      voted[b.empire] = b.choice;
      if (b.choice >= 0) {
        got[b.choice] += b.votes;
        const other = cand[0] === b.choice ? cand[1] : cand[0];
        if (b.empire !== b.choice) incident(S, 'councilVote', b.empire, b.choice, 24, { vote: 'for' });
        if (b.empire !== other) incident(S, 'councilVote', b.empire, other, -12, { vote: 'against' });
      } else {
        if (b.empire !== cand[1]) incident(S, 'councilVote', b.empire, cand[1], -6, { vote: 'abstain' });
        if (b.empire !== cand[0]) incident(S, 'councilVote', b.empire, cand[0], -6, { vote: 'abstain' });
      }
    }
    c.voted = voted;
    const winner = got[cand[0]] >= info.need ? cand[0] : got[cand[1]] >= info.need ? cand[1] : -1;
    const lead = got[cand[0]] >= got[cand[1]] ? cand[0] : cand[1], trail = lead === cand[0] ? cand[1] : cand[0];
    newsPush(S, { cat: 'councilVote', empire: lead, empire2: trail, n: got[lead] });
    const res = {
      year: info.year, candidates: cand.slice(), ballots, votes: got, tally: cand.map(id => ({ empire: id, votes: got[id] })), total: info.total, need: info.need,
      winner, noWinner: winner < 0, humanElected: winner >= 0 && !!S.empires[winner].human, needsAnswer: null, accepted: null, gameOver: false, reason: null, finalWar: false, text: '',
    };
    Object.defineProperty(res, 'finish', { value: function (accepted) { return C.finish(S, info, accepted, R); }, enumerable: false, configurable: true });
    info.result = res;
    if (winner < 0) {
      res.text = 'Neither candidate commands two thirds of the votes. The Council adjourns without a ruler.';
      c.history.push({ year: S.year, winner: -1, candidates: cand.slice(), votes: Object.assign({}, got), total: info.total, need: info.need });
      return res;
    }
    const W = S.empires[winner];
    res.text = 'The Council has chosen ' + W.leader + ' of the ' + W.plural + ' to rule as High Master of the New Republic.';
    newsPush(S, { cat: 'emperorElected', empire: winner, n: got[winner] });
    c.pending = { winner, candidates: cand.slice(), votes: Object.assign({}, got), total: info.total, need: info.need, year: S.year, text: res.text };
    if (S.empires.some(e => e.human && e.alive)) res.needsAnswer = ['accept', 'defy'];
    else C.finish(S, info, true, R);
    return res;
  };

  C.finish = function (S, info, accepted, R) {
    const c = state(S), p = c.pending;
    const res = info && info.result ? info.result : { winner: p ? p.winner : -1, gameOver: false, finalWar: false, needsAnswer: null, accepted: null, reason: null, text: '' };
    if (!p) return res;
    const accept = !(accepted === false || accepted === 'defy');                  // anything else (true, 'accept', undefined) = accept
    c.pending = null;
    const humans = S.empires.filter(e => e.human && e.alive);
    c.history.push({ year: S.year, winner: p.winner, candidates: p.candidates, votes: p.votes, total: p.total, need: p.need, accepted: accept });
    res.needsAnswer = null; res.accepted = accept; res.winner = p.winner;
    if (accept) {
      c.over = true; c.emperor = p.winner;
      const winnerHuman = !!S.empires[p.winner].human;
      res.reason = humans.length && !winnerHuman ? 'exile' : 'council';
      res.gameOver = true;
      S.gameOver = { reason: res.reason, winner: p.winner, council: true, year: S.year };
      return res;
    }
    // defiance: the refusing humans face everybody else in the Final War
    const refusers = humans.map(e => e.id);
    let winner = p.winner;
    if (S.empires[winner].human) winner = p.candidates[0] === winner ? p.candidates[1] : p.candidates[0];
    c.emperor = winner; c.finalWar = { refusers, winner, year: S.year };
    res.winner = winner; res.finalWar = true; res.gameOver = false; res.reason = null;
    res.text = 'So be it. You defy the Council. Now you will feel the wrath of the New Republic!';
    for (const id of refusers) newsPush(S, { cat: 'councilRefused', empire: id, empire2: p.winner });
    applyFinalWar(S, refusers);
    const D = Sim.Diplo;
    if (D && typeof D.finalWarShare === 'function') { try { D.finalWarShare(S); } catch (e) { C.shareTechs(S); } } else C.shareTechs(S);
    return res;
  };

  // ---- the Final War (§6.5) ---------------------------------------------------------------------------------------------------------------------------
  function applyFinalWar(S, refusers) {
    const D = Sim.Diplo;
    if (D && typeof D.finalWar === 'function') { try { D.finalWar(S, refusers); return; } catch (e) { /* fall through to the placeholder relations */ } }
    syncPlaceholder(S, refusers);
  }
  function syncPlaceholder(S, refusers) {                       // same side = alliance (+100), other side = final war (-100) on the E.relations placeholders
    const ref = {}; refusers.forEach(id => { ref[id] = true; });
    for (const a of S.empires) {
      if (!a.relations) continue;
      for (const r of a.relations) {
        if (!r || r.with === a.id || !S.empires[r.with]) continue;
        const same = !!ref[a.id] === !!ref[r.with];
        r.treaty = same ? 2 : 4; r.attitude = same ? 100 : -100; r.trade = 0;
      }
    }
  }
  // union of every tech of one side merged into every living member of that side (dead empires' techs included: research/05 §6.5 "known bug", reproduced)
  C.shareTechs = function (S) {
    const fw = S.council && S.council.finalWar;
    if (!fw) return 0;
    const ref = {}; fw.refusers.forEach(id => { ref[id] = true; });
    let n = 0;
    for (const side of [S.empires.filter(e => !ref[e.id]), S.empires.filter(e => ref[e.id])]) {
      if (side.length < 2 && side.length && ref[side[0].id]) continue;                 // a lone refuser has nobody to share with
      const union = [new Set(), new Set(), new Set(), new Set(), new Set(), new Set()];
      for (const e of side) if (e.research) for (let f = 0; f < 6; f++) for (const l of e.research.completed[f]) union[f].add(l);
      for (const e of side) {
        if (!e.alive || !e.research) continue;
        for (let f = 0; f < 6; f++) for (const l of Array.from(union[f]).sort((a, b) => a - b)) if (e.research.completed[f].indexOf(l) < 0 && Sim.Research.grant(S, e, f, l, 'trade')) n++;
      }
    }
    return n;
  };
  // per turn: Diplo.economyTurn already pools the techs and re-applies the alliances / final-war treaties when Diplo.finalWarShare exists; this is the fallback without it
  C.finalWarTurn = function (S) {
    const fw = S.council && S.council.finalWar;
    if (!fw) return 0;
    const D = Sim.Diplo;
    if (D && typeof D.finalWarShare === 'function') return 0;
    const n = C.shareTechs(S);
    if (D && typeof D.finalWar === 'function') { try { D.finalWar(S, fw.refusers); } catch (e) { /* ignore */ } } else syncPlaceholder(S, fw.refusers);
    return n;
  };

  // ---- victory & defeat (§8.1) -------------------------------------------------------------------------------------------------------------------------
  const ENDING = { conquest: 'tyrant', council: 'good', exile: 'exile', defeat: 'funeral' };
  V.payload = function (S, over) {
    if (!over) return null;
    const W = over.winner >= 0 ? S.empires[over.winner] : null, me = S.empires[S.playerId];
    return Object.assign({ type: 'gameover' }, over, {
      ending: ENDING[over.reason] || over.reason, year: M.Data.Config.displayYear(S), turn: S.turn,
      winnerName: W ? W.leader : '', winnerRace: W ? W.race : '', winnerPlural: W ? W.plural : '', player: S.playerId, playerWon: !!W && over.winner === S.playerId,
      playerLeader: me ? me.leader : '',
      canContinue: !!W && over.winner === S.playerId && (over.reason === 'council' || over.reason === 'conquest'),     // "Keep playing": settings.options.playOn then mutes further victory checks (Turn.victory)
    });
  };
  V.check = function (S) {
    if (S.gameOver) return Object.assign({ ending: ENDING[S.gameOver.reason] }, S.gameOver);
    const owners = new Set(), good = new Set();
    for (const p of S.planets) if (p.owner >= 0) { owners.add(p.owner); if ((p.unrest | 0) !== 2) good.add(p.owner); }
    if (owners.size === 1 && S.empires.length > 1) { const w = Array.from(owners)[0]; return { reason: 'conquest', winner: w, ending: 'tyrant' }; }
    const humans = S.empires.filter(e => e.human);
    if (humans.length && !humans.some(h => h.alive && good.has(h.id))) {
      const rest = Array.from(owners).filter(id => !S.empires[id].human);
      return { reason: 'defeat', winner: rest.length ? rest[0] : -1, ending: 'funeral', killer: rest.length ? rest[0] : -1 };
    }
    return null;
  };
});
