// Diplomacy engine — a faithful port of the Master of Orion (1993) v1.3 diplomacy rules (research/05 §2–§4, research/01 §1.4/§5, research/08).
// Worker-safe. Deterministic: every random draw comes from MOO.RNG bound to S.rs.
//
// ───────────────────────────────────────────── STATE ────────────────────────────────────────────────────────────────────────────────
//   E.relations[j]  = EMPIRE E's record about empire j (the research's "X.field[Y]" arrays). Created by Diplo.init(S). Plain JSON:
//     with contact(bool) met(0 never, 1 just met → greeting audience pending, 2 met) treaty(0 None,1 NAP,2 Alliance,3 War,4 Final War) trade(BC/turn face value) attitude(=rel1)
//     rel1 (−100..100, the "relations bar", always mirrored in both records)  rel2 (long-run base rel1 drifts back to)  trust
//     moodTreaty moodTrade moodTech moodPeace  (temporary modifiers, recover toward +100)   hatred(0..3)  blunder(msg type)  broken(treaty remembered as broken)
//     tradePct (efficiency −30..100)  tradeEst  ceasefire (turns)  dipType dipVal dipP1 dipP2 (message queued THIS turn + biggest DP change; kept on the HUMAN's record)
//     bounty (AI's open offer {x,bc,field,level}|null)  gift ({field,level}|null: last tech tribute, AI may thank you)
//   S.diplo = {v, finalWar(bool), pending (a counter-offer awaiting the player's answer), inbox[] (proposals ordered by AIs to humans), owners[] (planet owners last turn),
//              lastTaker{} (who last took a planet of an empire), dead{}, log[] (capped event log: {turn,k,a,b,x})}
//   Treaty constants: Diplo.T = {NONE:0, NAP:1, ALLIANCE:2, WAR:3, FINAL_WAR:4}.   Personality idx: 0 Xenophobic 1 Ruthless 2 Aggressive 3 Erratic 4 Honorable 5 Pacifistic.
//
// ───────────────────────────────────────────── QUERIES ──────────────────────────────────────────────────────────────────────────────
//   init(S) · isAllied(S,a,b) · atWar(S,a,b) · hasContact(S,a,b) · treaty(S,a,b) · ceasefire(S,a,b) · canFight(S,attacker,defender,starOwner) (combat gate: alliance / NAP / ceasefire)
//   status(S,a,b) → {treaty,treatyName,trade:{bc,percent,income},attitude,label,labelIndex,pointer,trust,contact,met,canAudience,gone,ceasefire,atWar,allied,hatred,moods{…}}
//   overview(S,humanId) → status rows for the Races screen · tradeIncome(S,E) · power(S,a) → {fleet,fleetStat,prod,pop,planets} · fleetPower · fleetStat · production
//   label(rel1) → {index,name} · isGone(S,h,a) · techCandidates(S,giver,taker,{noNewest,minValue}) · techValue
// ───────────────────────────────────────────── TURN HOOKS (sim/turn.js) ─────────────────────────────────────────────────────────────
//   preTurn(S,R)      ceasefire countdown, mood recovery/“blunder” capture, scratch reset, planet-owner tracking, genocide check
//   economyTurn(S,R)  trade efficiency growth, treaty goodwill (+DP), big-fleet / big-empire complaints, relation drift toward rel2
//   turn(S,R)         → interrupts[]  contact + first-contact greetings, AI↔AI diplomacy and wars (silent, news events), AI→human proposals / warnings / wars
//                     as {type:'diplomacy', from, to, kind, msgType, greeting?, text:{personality,situation,vars}, options:[{id,label}], answer(choice)} (see below)
// ───────────────────────────────────────────── PLAYER AUDIENCE (UI calls these directly) ────────────────────────────────────────────
//   audience(S,h,a) → {ok,state:'open'|'refused'|'later',greeting,…}    menu(S,h,a) → {actions:[{id,label,enabled,options}]}
//   propose(S,h,a,proposal) → {ok,accepted,result,reply:{situation,vars,msgType},counter?,effects}   answerCounter(S,h,a,yes) → same shape
//        proposal.kind: 'nap' | 'alliance' | 'peace' | 'askWar'{target} | 'askBreak'{target} | 'trade'{bc ∈ tradeLevels} | 'tributeBC'{bc,index?} | 'tributeTech'{field,level}
//                       | 'threat' | 'breakTreaty' | 'breakTrade' | 'techExchange'{want:{field,level},give:{field,level}}   (a 'counter' result must be answered with answerCounter)
//   leave(S,h,a,submenu) (costs of leaving 'trade'/'threaten'/'tech' without choosing) · tradeLevels · tributeChoices · techWanted · techOffers · techExchangeScale
//   declareWar(S,a,b,reason) · breakTreaty(S,breaker,victim) · breakTrade · stopWar · setTrade · setTreaty · act(S,dv,actor,target,dtype,p1,p2) (raw DP engine)
//   incident(S,kind,from,to,magnitude,extra) — DP consequences for other modules (spyTheft, spyFrameTheft, sabotage, spyFrameSabotage, combat, bio, capture, popKilled,
//        aiGround, genocide, councilVote, border, tooBig, tribute…); Ev events {type:'incident',kind,from,to,…} pushed by other modules are drained in turn().
//   finalWar(S,refusers) / finalWarShare(S) (Council helpers) · empireDied(S,dead,killer)
// ───────────────────────────────────────────── ORDERS ───────────────────────────────────────────────────────────────────────────────
//   {t:'diplomacy', to, act:'propose', kind:'nap'|'alliance'|'trade'|'peace', bc?}   AI→AI: answered at once with the mood formula; AI→human: queued and delivered as an audience by Diplo.turn
//   {t:'diplomacy', to, act:'declareWar', reason?}   {t:'diplomacy', to, act:'breakTreaty', expand?:true, cap?}   {t:'diplomacy', to, act:'breakTrade'}
//   {t:'diplomacy', to, act:'tribute', bc?|field,level}   {t:'diplomacy', to, act:'threaten'}   {t:'diplomacy', to, act:'peace'}  (shorthand for propose peace)
// Behaviour switches: Diplo.CFG (every default keeps the v1.3 quirk, see research/08 §17). Test hooks: Diplo._ . Message types (research/05 §4.8) map onto Data.text.diplomacy[personality][situation] through Diplo.MSG_SITUATION / Diplo.situation(type).
MOO.def(function (M) {
  'use strict';
  const D = M.Sim.Diplo = {};
  const O = M.Sim.Orders;

  // ── enums & tables ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const T = D.T = { NONE: 0, NAP: 1, ALLIANCE: 2, WAR: 3, FINAL_WAR: 4 };
  D.TREATY_NAMES = ['No Treaty', 'Non-Aggression Pact', 'Alliance', 'War', 'Final War'];
  D.TREATY_NOUN = ['treaty', 'non-aggression pact', 'alliance', 'war', 'final war'];          // lower-case noun phrase for {treaty} in dialogue/news
  D.PERSONALITIES = ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic'];
  D.OBJECTIVES = ['diplomat', 'militarist', 'expansionist', 'technologist', 'industrialist', 'ecologist'];
  const RELDIFF = D.RELDIFF = [-50, -30, -20, 0, 10, 20];                                       // research/05 §3.1: added to every AI willingness roll
  const XENO = 0, ERRATIC = 3, HONOR = 4, MILITARIST = 1, EXPANSIONIST = 2;
  D.LABELS = ['FEUD', 'HATE', 'DISCORD', 'TROUBLED', 'TENSE', 'RESTLESS', 'WARY', 'UNEASE', 'NEUTRAL', 'RELAXED', 'AMIABLE', 'CALM', 'AFFABLE', 'PEACEFUL', 'FRIENDLY', 'UNITY', 'HARMONY'];
  const HULL_W = [1, 5, 25, 125];                                                               // hull weights for every "fleet power" comparison
  const MOODS = ['moodTreaty', 'moodTrade', 'moodTech', 'moodPeace'];
  const ORDER = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  // starting attitudes in DP (research/01 §1.4 = research/05 §3.3 ×12). Used when Data.Races is not loaded; otherwise Data.Races.RELATIONS wins.
  const START_REL = [
    [0, 12, 12, 12, 12, 12, 12, 12, 12, 12], [12, 0, 0, -24, 0, -36, -12, -12, 0, -12], [12, 0, 0, 0, 0, 0, -12, 0, 12, -12], [12, -24, 0, 0, 0, -12, -12, 0, -12, -12],
    [12, 0, 0, 0, 0, 0, 0, 0, 0, -12], [12, -36, 0, -12, 0, 0, -12, 0, 0, -12], [12, -12, -12, -12, 0, -12, 0, 0, 0, -12], [12, -12, 0, 0, 0, 0, 0, 0, 0, -12],
    [12, 0, 12, -12, 0, 0, 0, 0, 0, -12], [12, -12, -12, -12, -12, -12, -12, -12, -12, 0]];

  // Behaviour switches. Every default keeps the shipped v1.3 ("Classic") quirk, as research/08 §17 recommends; flip a flag to get the intended / Classic+ rule.
  D.CFG = {
    classicTrustBug: true,         // true: breaking a treaty RAISES the breaker's trust 10/20 (x2 Honorable) and an alliance break raises rel2 (v1.3 sign bug); false: they fall
    classicCashTribute: true,      // true: cash tribute gives no relations (v1.3); false: +bc*12/production (Classic+ / the Guide)
    peaceUsesTreatyMood: true,     // true: peace proposals roll on mood_treaty (v1.3); false: on mood_peace (Classic+)
    aiAllianceToggle: true,        // true: AI↔AI — a passing alliance roll while already allied downgrades the alliance to a NAP (v1.3 oscillation)
    aiPeaceStaleV: true,           // true: AI↔AI peace test uses a stale 1oom message subtype (−1..13) instead of the fresh score (v1.3); false: fresh score
    allianceConflictFixedIndex: true, // true: the allied-with-both-sides check only looks at empire p1+1 (v1.3 loop bug, practically dead); false: the intended rule
    driftBothRows: false,          // false: relation drift is rolled once per pair from the LOWER-index row (v1.3 mirror order: a human player 0 never drifts); true: every AI row drifts
    bountyPaid: false,             // false: the bounty "paid" message arrives without a reward (v1.3); true: the reward is delivered
    threatHidesHuman: true,        // true: a successful threat sets the PLAYER's spies to Hide (v1.3); false: the AI's
    capturePaysAI: true,           // true: the AI victim is the charged "breaker" of a war started by a conquest (v1.3); false: the human is
    fleetStatBug: false,           // true: the fleet bar uses the non-monotone v1.3 band formula
  };

  // ── small helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const tdiv = (a, b) => Math.trunc(a / b);                                                      // C integer division (truncates toward zero)
  const RR = S => M.RNG.bind(S.rs);
  const rnd = (R, n) => (n >= 1 ? R.int(1, n) : 0);                                              // 1..n
  const rnd0 = (R, n) => (n >= 1 ? R.int(0, n - 1) : 0);                                         // 0..n-1
  const rec = (S, a, b) => S.empires[a].relations[b];
  const isHuman = (S, i) => !!(S.empires[i] && S.empires[i].human);
  const isAlive = (S, i) => !!(S.empires[i] && S.empires[i].alive);
  const diffIdx = S => (S.settings && S.settings.diffIdx) | 0;
  const year = S => S.year | 0;
  const minMood = r => Math.min(r.moodTreaty, r.moodTrade, r.moodTech, r.moodPeace);
  const reldiff = (S, id) => RELDIFF[S.empires[id].personality | 0] || 0;
  const DEFMOD = { tradePts: 0, posActMul: 1, tributeMul: 1, aiMoodBonus: 0, councilBonus: 0 }, HUMANMOD = { tradePts: 25, posActMul: 2, tributeMul: 2, aiMoodBonus: 50, councilBonus: 20 };
  const raceMod = (E, k) => {                                                                    // Data.Races mod hooks (Human: +25 trade pts, x2 positive acts/tribute, +50 AI mood)
    const rd = M.Data && M.Data.Races && M.Data.Races.races && M.Data.Races.races[E.race];
    if (rd && rd.mod && rd.mod[k] !== undefined) return rd.mod[k];
    return (E.race === 'human' ? HUMANMOD : DEFMOD)[k];
  };
  const askBonus = (S, h) => raceMod(S.empires[h], 'aiMoodBonus');                              // +50 in every roll when the ASKING human is Human
  const log = (S, k, a, b, x) => { const L = S.diplo.log; L.push({ turn: S.turn, k, a, b, x: x === undefined ? 0 : x }); if (L.length > 600) L.splice(0, L.length - 600); };
  const news = (S, cat, a, b, extra) => { if (M.Sim.Ev) M.Sim.Ev.push(S, Object.assign({ type: 'news', cat, empire: a, empire2: b }, extra || {})); };
  const notice = (S, kind, empire, extra) => { if (M.Sim.Ev && isHuman(S, empire)) M.Sim.Ev.push(S, Object.assign({ type: 'notice', kind, empire }, extra || {})); };

  function mkRec(j, rel) {
    return { with: j, contact: false, met: 0, treaty: 0, trade: 0, attitude: rel, rel1: rel, rel2: rel, trust: 0,
      moodTreaty: 0, moodTrade: 0, moodTech: 0, moodPeace: 0, hatred: 0, blunder: 0, broken: 0, tradePct: 0, tradeEst: 0, ceasefire: 0,
      dipType: 0, dipVal: 0, dipP1: -1, dipP2: -1, bounty: null, gift: null, allyTurn: -999 };
  }
  const startRel = (a, b) => {
    const RD = M.Data && M.Data.Races;
    let mat = RD && RD.RELATIONS && RD.RELATIONS.length === 10 ? RD.RELATIONS : START_REL, order = RD && RD.ORDER ? RD.ORDER : ORDER;
    let mx = 0; for (const row of mat) for (const v of row) mx = Math.max(mx, Math.abs(v));
    const sc = mx <= 3 ? 12 : 1;
    const i = order.indexOf(a.race), j = order.indexOf(b.race);
    return i < 0 || j < 0 ? 0 : mat[i][j] * sc;
  };

  // ── symmetric setters (rel1/treaty are mirrored in both records) ────────────────────────────────────────────────────────────────
  function setRel(S, a, b, v) { v = clamp(Math.trunc(v), -100, 100); const x = rec(S, a, b), y = rec(S, b, a); x.rel1 = y.rel1 = x.attitude = y.attitude = v; return v; }
  function setTreatyRaw(S, a, b, t) { rec(S, a, b).treaty = rec(S, b, a).treaty = t; }
  D.setTreaty = function (S, a, b, t) { setTreatyRaw(S, a, b, t); };
  const annoy = (r, n) => { for (const k of MOODS) r[k] -= 10 * n; };                           // research/05 §4.2.2 annoy(): all four moods −10·n on that record
  D.annoy = (S, h, a, n) => annoy(rec(S, h, a), n);

  // ── queries ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  D.isAllied = function (S, a, b) { const E = S.empires[a], r = E && E.relations && E.relations[b]; return !!r && a !== b && r.treaty === T.ALLIANCE; };
  D.atWar = function (S, a, b) { const E = S.empires[a], r = E && E.relations && E.relations[b]; return !!r && a !== b && r.treaty >= T.WAR; };
  D.hasContact = function (S, a, b) { const E = S.empires[a], r = E && E.relations && E.relations[b]; return !!r && a !== b && !!r.contact; };
  D.treaty = function (S, a, b) { const E = S.empires[a], r = E && E.relations && E.relations[b]; return r ? r.treaty : 0; };
  D.ceasefire = function (S, a, b) { const E = S.empires[a], r = E && E.relations && E.relations[b]; return r ? Math.max(r.ceasefire | 0, S.empires[b].relations[a].ceasefire | 0) : 0; };
  // Combat gate (research/03 §4.1, research/08 §6.8): no fight between allies; NAP partners do not fight unless the star's planet belongs to one of them;
  // an AI attacker withdraws from a human defender while the cease-fire runs. Everybody else (None, War, Final War) fights.
  D.canFight = function (S, attacker, defender, starOwner) {
    if (attacker === defender) return false;
    const t = D.treaty(S, attacker, defender);
    if (t === T.ALLIANCE) return false;
    if (t === T.NAP) return starOwner === attacker || starOwner === defender;
    if (t < T.WAR && !isHuman(S, attacker) && isHuman(S, defender) && D.ceasefire(S, attacker, defender) > 0) return false;
    return true;
  };
  D.label = function (rel1) { const i = clamp(tdiv(rel1, 12) + 8, 0, 16); return { index: i, name: D.LABELS[i] }; };
  // AI refuses to talk at all: trust + min(mood) + reldiff <= −100, or min(mood) <= −100 (research/05 §4.1)
  D.isGone = function (S, h, a) { const r = rec(S, h, a), m = minMood(r); return r.trust + m + reldiff(S, a) <= -100 || m <= -100; };

  // ── power measures (hull weights 1/5/25/125; research/05 §4.2.3, §4.6.5, §8.3) ───────────────────────────────────────────────────
  D.fleetPower = function (S, id) {
    const E = S.empires[id]; let sum = 0;
    for (const f of S.fleets) {
      if (f.owner !== id) continue;
      for (let i = 0; i < 6; i++) { const n = f.ships[i]; if (n > 0) { const d = E.designs && E.designs[i]; sum = Math.min(3250000, sum + n * HULL_W[d ? clamp(d.hull | 0, 0, 3) : 0]); } }
    }
    return Math.max(1, sum);
  };
  // doubling bands: px 1..10 cover `base` points, the next ten 2·base each, … (monotone [Guide] version); 100 = best
  function bandStat(sum, base) {
    let k = 0, w = base, rem = sum;
    while (k < 10 && rem >= w) { rem -= w; k++; w *= 2; }
    return k >= 10 ? 100 : k * 10 + Math.floor(rem * 10 / w);
  }
  function bandStatBug(sum, base) {                                                              // v1.3 formula as written (non-monotone at band edges)
    let k = 0, va = base, ve = 0;
    while (sum > va) { sum -= va; k++; ve = va; va *= 2; }
    return clamp(Math.floor(sum * 10 / (va - ve)) + 10 * k, 0, 100);
  }
  D.fleetStat = (S, id) => (D.CFG.fleetStatBug ? bandStatBug : bandStat)(D.fleetPower(S, id), 125);
  D.production = function (S, id) {                                                              // total_production_bc: gross planet output (+ trade income)
    let g = 0; for (const p of S.planets) if (p.owner === id) g += p.gross | 0;
    const E = S.empires[id]; if (E.flow && E.flow.trade) g += E.flow.trade | 0;
    return Math.max(0, g);
  };
  D.power = function (S, id) {
    let pop = 0, planets = 0; for (const p of S.planets) if (p.owner === id) { pop += p.pop | 0; planets++; }
    return { fleet: D.fleetPower(S, id), fleetStat: D.fleetStat(S, id), prod: D.production(S, id), pop, planets };
  };
  const galaxySizeIdx = S => {
    const m = { small: 0, medium: 1, large: 2, huge: 3, colossal: 3 }, k = S.settings && S.settings.size;
    if (k && m[k] !== undefined) return m[k];
    const n = S.stars.length; return n <= 30 ? 0 : n <= 60 ? 1 : n <= 90 ? 2 : 3;
  };

  // ── technologies as diplomatic currency (research/02 §1.10, Appendix D; research/05 §4.4.2) ─────────────────────────────────────────
  const TECHS = () => M.Data.Techs;
  const GROUPS12 = { 'robotic-controls': 1, scanner: 1, waste: 1, 'industrial-tech': 1, 'planetary-shield': 1, terraforming: 1, environment: 1, 'eco-restoration': 1, 'personal-armor': 1, 'personal-shield': 1, fuel: 1, 'personal-weapon': 1 };
  const techRec = (f, l) => { const t = TECHS(); return (t.byFL[f] && t.byFL[f][l]) || null; };
  const owns = (E, f, l) => E.research.completed[f].indexOf(l) >= 0;
  function newestLevel(E, f) { let m = 0; for (const l of E.research.completed[f]) if (l > m) m = l; return m; }
  function ownedTiers(E) {                                                                        // best group tier the empire owns, per obsolescence group
    const out = {}, TT = TECHS();
    for (let f = 0; f < 6; f++) for (const l of E.research.completed[f]) {
      const list = l === 1 && TT.l1Bundle ? TT.l1Bundle[f] : [techRec(f, l)];
      for (const t of list) if (t && t.group && t.gtier) out[t.group] = Math.max(out[t.group] || 0, t.gtier);
    }
    return out;
  }
  function techValue(t, tiers) {                                                                 // value to an empire owning `tiers`: level² × group multiplier, /4 if superseded
    if (t.special === 'orion-only') return 30000;
    let v = TECHS().tradeValue(t);
    if (t.group && t.group !== 'singular' && t.group !== 'advanced' && (tiers[t.group] || 0) > (t.gtier || 0)) v = Math.floor(v / 4);
    return v;
  }
  D.techValue = (S, E, t) => techValue(t, ownedTiers(E));
  // techs `giver` has that `taker` lacks (group-obsolescence aware); noNewest drops the giver's newest tech of every field; minValue filters by value to the taker
  D.techCandidates = function (S, giver, taker, opts) {
    opts = opts || {};
    const G = typeof giver === 'number' ? S.empires[giver] : giver, K = typeof taker === 'number' ? S.empires[taker] : taker, out = [], tiers = ownedTiers(K);
    for (let f = 0; f < 6; f++) {
      const newest = newestLevel(G, f);
      for (const l of G.research.completed[f]) {
        if (l <= 1 || (opts.noNewest && l === newest) || owns(K, f, l)) continue;
        const t = techRec(f, l); if (!t || (t.never && t.never.indexOf(K.race) >= 0)) continue;
        if (GROUPS12[t.group] && (tiers[t.group] || 0) >= (t.gtier || 0)) continue;
        const value = techValue(t, tiers);
        if (opts.minValue !== undefined && value < opts.minValue) continue;
        out.push({ field: f, level: l, tech: t, name: t.name, value });
      }
    }
    return out;
  };
  function giveTech(S, to, f, l, source) { return M.Sim.Research && M.Sim.Research.grant ? M.Sim.Research.grant(S, S.empires[to], f, l, source || 'trade') : false; }

  // ── init ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  D.init = function (S) {
    const n = S.empires.length;
    S.diplo = { v: 1, finalWar: false, pending: null, inbox: [], owners: S.planets.map(p => p.owner), lastTaker: {}, dead: {}, log: [] };
    for (const E of S.empires) { E.relations = []; for (let j = 0; j < n; j++) E.relations.push(mkRec(j, j === E.id ? 0 : startRel(E, S.empires[j]))); }
    D.updateContact(S, true);
    return S.diplo;
  };
  const ensure = S => { if (!S.diplo || !S.empires[0].relations || S.empires[0].relations.length !== S.empires.length || !S.empires[0].relations[0] || S.empires[0].relations[0].rel1 === undefined) D.init(S); };

  // ── contact (research/05 §4.1): ranges of two empires overlap when the nearest pair of owned stars is within max(fuel range) parsecs ──
  const fuelOf = E => (M.Sim.Fleet && M.Sim.Fleet.fuelRange ? M.Sim.Fleet.fuelRange(E) : (E.mods && E.mods.fuel) || 3);
  D.updateContact = function (S, silent) {
    const Geo = M.Sim.Geo, n = S.empires.length, owned = S.empires.map(() => []), changes = [];
    for (const p of S.planets) if (p.owner >= 0) owned[p.owner].push(p.starId);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const A = S.empires[a], B = S.empires[b], ra = A.relations[b], rb = B.relations[a];
      let c = false;
      if (A.alive && B.alive && owned[a].length && owned[b].length) {
        const range = Math.max(fuelOf(A), fuelOf(B));
        outer: for (const x of owned[a]) for (const y of owned[b]) { if (x === y || Geo.parsecs(S, x, y) <= range) { c = true; break outer; } }
      }
      if (c === !!ra.contact) continue;
      ra.contact = rb.contact = c;
      if (c) {
        if (!ra.met) {
          const hum = A.human || B.human;
          if (A.human) { ra.met = 1; rb.met = 2; } else if (B.human) { rb.met = 1; ra.met = 2; } else { ra.met = rb.met = 2; }
          if (hum && !silent) news(S, 'firstContact', a, b);
          log(S, 'contact', a, b);
        }
        changes.push({ a, b, first: ra.met === 1 || rb.met === 1 });
      } else {                                                                                   // contact lost: trade ends, spies hide
        D.breakTrade(S, a, b);
        A.spyMode && (A.spyMode[b] = 0); B.spyMode && (B.spyMode[a] = 0);
        A.spyBudget && (A.spyBudget[b] = 0); B.spyBudget && (B.spyBudget[a] = 0);
        if (!silent) { notice(S, 'contactLost', a, { other: b }); notice(S, 'contactLost', b, { other: a }); }
        log(S, 'contactLost', a, b);
      }
    }
    return changes;
  };

  // ── trade ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  D.breakTrade = function (S, a, b) {
    const x = rec(S, a, b), y = rec(S, b, a);
    x.trade = y.trade = 0; x.tradePct = y.tradePct = 0; x.tradeEst = y.tradeEst = 0; x.bounty = y.bounty = null;
  };
  // new/larger deals restart at −30 % efficiency for the added volume (research/05 §4.4.4)
  D.setTrade = function (S, a, b, bc) {
    const x = rec(S, a, b), y = rec(S, b, a);
    bc = Math.max(0, Math.trunc(bc));
    let pct = x.tradePct;
    if (x.tradeEst < bc) pct = tdiv(pct * x.tradeEst - bc * 30, x.tradeEst + bc);
    x.trade = y.trade = bc; x.tradeEst = y.tradeEst = bc; x.tradePct = y.tradePct = Math.min(100, pct);
  };
  // BC per turn for E: face value × (efficiency + Human 25 points)/100 per partner. A new/raised deal starts at −30 % (Human −5 %), so the first turns can cost money (research/04 §3.3).
  D.tradeIncome = function (S, E) {
    if (typeof E === 'number') E = S.empires[E];
    const rs = E.relations; if (!rs) return 0;
    const bonus = raceMod(E, 'tradePts');
    let sum = 0;
    for (let j = 0; j < rs.length; j++) { const r = rs[j]; if (j === E.id || !(r.trade > 0) || !r.contact || r.treaty >= T.WAR) continue; sum += tdiv(r.trade * (r.tradePct + bonus), 100); }
    return sum;
  };
  D.tradeIncomeFrom = function (S, a, b) { const E = S.empires[a], r = rec(S, a, b); return r.trade > 0 && r.contact && r.treaty < T.WAR ? tdiv(r.trade * (r.tradePct + raceMod(E, 'tradePts')), 100) : 0; };

  // ── status for UIs / AI planners ──────────────────────────────────────────────────────────────────────────────────────────────
  D.status = function (S, a, b) {
    const r = rec(S, a, b), E = S.empires[a], O2 = S.empires[b], lab = D.label(r.rel1), gone = a !== b && b !== undefined ? D.isGone(S, a, b) : false;
    return { with: b, treaty: r.treaty, treatyName: D.TREATY_NAMES[r.treaty], trade: { bc: r.trade, percent: r.tradePct, income: D.tradeIncomeFrom(S, a, b) },
      attitude: r.rel1, label: lab.name, labelIndex: lab.index, pointer: clamp(tdiv(r.rel1, 2), -50, 50), trust: r.trust, contact: !!r.contact, met: r.met,
      canAudience: !!r.contact && E.alive && O2.alive && r.treaty !== T.FINAL_WAR && !S.diplo.finalWar && !gone, gone, ceasefire: D.ceasefire(S, a, b),
      atWar: r.treaty >= T.WAR, allied: r.treaty === T.ALLIANCE, hatred: r.hatred, moods: { treaty: r.moodTreaty, trade: r.moodTrade, tech: r.moodTech, peace: r.moodPeace },
      race: O2.race, leader: O2.leader, personality: O2.personality, objective: O2.objective, alive: O2.alive };
  };
  D.overview = function (S, h) { const out = []; for (const E of S.empires) if (E.id !== h) out.push(D.status(S, h, E.id)); return out; };


  // ══════════════════════════════════════ THE DP (RELATION) ENGINE — research/05 §4.2.1 ═══════════════════════════════════════════════
  // act(dv, actor, target, dtype): `target`'s opinion of `actor` changes by dv, scaled by the current relation, the TARGET's personality and the ACTOR's race.
  // Only AI targets react (a human target is never touched). dtype = message category queued for the AI's later complaint/thanks (only when the actor is human).
  // Returns the DP actually applied.
  D.act = function (S, dv, actor, target, dtype, p1, p2) {
    if (!S.diplo || S.diplo.finalWar) return 0;
    dtype = dtype | 0;
    if (actor === target || !dv || !isAlive(S, target) || isHuman(S, target)) return 0;
    const A = S.empires[actor], Tg = S.empires[target], rt = rec(S, target, actor), ra = rec(S, actor, target);
    if (rt.treaty === T.FINAL_WAR) return 0;
    let R = rt.rel1;
    if (dv > 0) { if (R < 0) { dv *= 2; if (R + dv > 10) dv = 10 - R; } else dv = tdiv(dv, tdiv(R, 25) + 1); }       // repairing a bad relation: x2 (never beyond +10); else /1../5
    else { if (R > 0) dv *= 2; else dv = tdiv(dv, tdiv(-R, 25) + 1); }                                              // good relations are fragile; hated ones barely care
    if (Tg.personality === HONOR && dv < 0) dv *= 2;
    if (Tg.personality === XENO) { if (dv < 0) dv = tdiv(dv * 3, 2); else if (dv > 0) dv = tdiv(dv * 3, 4); }
    const v1 = dv;
    if (dv > 0) dv *= raceMod(A, 'posActMul');                                                                        // "Humans double positive DP"
    if (rt.treaty === T.WAR && dtype >= 4 && dtype <= 12 && dv < 0) {                                                // at war incidents only dent the peace mood
      if (A.human) { const q = tdiv(dv, 4); rt.moodPeace += q; ra.moodPeace -= q; }
      dv = 0;
    }
    if (!A.human && year(S) > 100) { if (dv > 0) dv *= 2; if (dv < 0) dv = tdiv(dv, tdiv(diffIdx(S), 2) + 1); }      // AI↔AI after year 100
    if (dv !== 0) {
      R = clamp(R + dv, -100, 100);
      rt.moodTreaty += dv; ra.moodTreaty = rt.moodTreaty;                                                            // the AI's copy wins (research/05 §2 note)
      rt.moodTrade += dv; ra.moodTrade = rt.moodTrade;
      rt.moodTech += dv; ra.moodTech = rt.moodTech;
      if (v1 < 0) { const q = tdiv(v1, 4); ra.moodPeace -= q; rt.moodPeace += q; } else rt.moodPeace += v1;
      if (A.human && dtype !== 0 && Math.abs(dv) > Math.abs(ra.dipVal)) { ra.dipVal = dv; ra.dipType = dtype; ra.dipP1 = p1 === undefined ? -1 : p1; ra.dipP2 = p2 === undefined ? -1 : p2; }
    }
    if (rt.treaty >= T.WAR) R = Math.max(R, -25);                                                                     // at war the bar never sinks below −25 afterwards
    if (rt.treaty !== T.ALLIANCE) R = Math.min(R, 65);                                                                // only allies can exceed +65
    setRel(S, actor, target, R);
    return dv;
  };

  // ══════════════════════════════════════ TREATY / WAR PRIMITIVES — research/05 §4.2.2 ═══════════════════════════════════════════════════
  // breaker B cancels the NAP/alliance with V: trust falls 10/20 (x2 Honorable) [v1.3 sign bug behind CFG.classicTrustBug], an alliance break lowers rel2 by the same amount,
  // rel1 drops 1..20, the treaty is remembered as "broken", all four moods of both records go to −200 ("nobody wants to talk").
  D.breakTreaty = function (S, b, v) {
    ensure(S);
    const rb = rec(S, b, v), rv = rec(S, v, b), B = S.empires[b], old = rb.treaty;
    if (rv.treaty >= T.WAR) return false;
    const R = RR(S);
    let w = old === T.NAP ? 10 : old === T.ALLIANCE ? 20 : 0;
    if (B.personality === HONOR) w *= 2;
    const sg = D.CFG.classicTrustBug ? w : -w;
    rb.trust = clamp(rb.trust + sg, -100, 100);
    if (old === T.ALLIANCE) rb.rel2 = rv.rel2 = clamp(rb.rel2 + sg, -100, 100);
    if (w !== 0) { rb.broken = rv.broken = old; setRel(S, b, v, Math.max(rb.rel1 - rnd(R, 20), -100)); }
    setTreatyRaw(S, b, v, T.NONE);
    rb.bounty = rv.bounty = null;
    for (const k of MOODS) rb[k] = rv[k] = -200;
    if (old === T.NONE) return false;
    if (old === T.ALLIANCE) news(S, 'allianceBroken', b, v); else news(S, 'treatyBroken', b, v, { treaty: D.TREATY_NOUN[old] });
    log(S, old === T.ALLIANCE ? 'allianceBroken' : 'napBroken', b, v);
    return true;
  };
  // A attacks B: trade ends, any treaty is broken, base relation −5, relation −75..−100, moods −200 (peace −130)
  D.startWar = function (S, a, b, why) {
    ensure(S);
    const ra = rec(S, a, b), rb = rec(S, b, a);
    if (a === b || ra.treaty >= T.WAR || !isAlive(S, b)) return false;
    const R = RR(S);
    D.breakTrade(S, a, b);
    D.breakTreaty(S, a, b);
    if (isHuman(S, a) && !ra.met) ra.met = 1; if (isHuman(S, b) && !rb.met) rb.met = 1;                         // a war marks first contact for human sides
    ra.rel2 = Math.max(ra.rel2 - 5, -100); rb.rel2 = Math.max(rb.rel2 - 5, -100);
    setRel(S, a, b, -75 - rnd(R, 25));
    setTreatyRaw(S, a, b, T.WAR);
    for (const k of ['moodTreaty', 'moodTrade', 'moodTech']) ra[k] = rb[k] = -200;
    ra.moodPeace = rb.moodPeace = -130;
    ra.ceasefire = rb.ceasefire = 0;
    news(S, 'warDeclared', a, b, why ? { why } : null);
    log(S, 'war', a, b, why || '');
    return true;
  };
  // peace: treaty None, relation +40, a cease-fire of 8..13 turns protects the human side
  D.stopWar = function (S, a, b) {
    ensure(S);
    const ra = rec(S, a, b), rb = rec(S, b, a);
    if (ra.treaty < T.WAR) return false;
    const R = RR(S);
    setTreatyRaw(S, a, b, T.NONE);
    setRel(S, a, b, Math.min(ra.rel1 + 40, 100));
    if (isHuman(S, a) || isHuman(S, b)) ra.ceasefire = rb.ceasefire = rnd0(R, 6) + 8;
    news(S, 'peaceTreaty', a, b); log(S, 'peace', a, b);
    return true;
  };
  // programmatic war declaration (events, council, orders, ground incidents). Queues the "war declared" audience when the victim is human.
  D.declareWar = function (S, a, b, reason, msgType) {
    ensure(S);
    const rel = rec(S, b, a).rel1;
    if (!D.startWar(S, a, b, reason)) return false;
    if (isHuman(S, b)) { const r = rec(S, b, a); r.dipType = msgType || (rel < 0 ? 13 : 60); }
    return true;
  };

  // ══════════════════════════════════════ INCIDENTS (other modules report here) — research/05 §4.2.3 ═══════════════════════════════════
  // Combat/bombardment aftermath (game_diplo_battle_finish): offense = max(5·popLost, min(apparent force lost, 50), 10·bio)
  D.battleFinish = function (S, offender, offended, o) {
    o = o || {};
    const popLost = o.popLost | 0, bio = o.bio | 0, app = Math.min(o.force | 0, 50);
    const offense = o.offense !== undefined ? o.offense : Math.max(5 * popLost, app, 10 * bio);
    const dtype = bio > 0 ? 11 : popLost > 0 ? 10 : 9;
    if (bio !== 0) for (const E of S.empires) if (E.alive && E.id !== offender && !E.human) D.act(S, -10, offender, E.id, 11);      // first: every AI (the injured one too) hates bio weapons
    if (offended >= 0 && !isHuman(S, offended)) D.act(S, -offense, offender, offended, dtype, o.planet);
    if (offense >= 30 && offended >= 0 && isHuman(S, offender)) {                                                    // "the enemy of my enemy is my friend"
      let owns = false; for (const p of S.planets) if (p.owner === offended) { owns = true; break; }
      for (const E of S.empires) {
        if (!E.alive || E.id === offender || E.id === offended || E.human) continue;
        const ra = rec(S, E.id, offender), claim = ra.bounty && ra.bounty.x === offended;
        if (rec(S, offended, E.id).treaty >= T.WAR || claim) {
          if (claim) ra.bounty.collect = true; else if (!owns) D.act(S, offense, offender, E.id, 3, o.planet);
        }
      }
    }
    return offense;
  };
  D.incident = function (S, kind, from, to, magnitude, extra) {
    ensure(S);
    extra = extra || {};
    const R = RR(S), mag = magnitude === undefined || magnitude === null ? null : Math.abs(magnitude);
    switch (kind) {
      case 'spyTheft': return D.act(S, -(mag !== null ? mag : R.dice(5, 12)), from, to, extra.framed ? 5 : 4, extra.field);                    // espionage identified: −5d12
      case 'spyFrameTheft': return D.act(S, -(mag !== null ? mag : rnd(R, 12) + rnd(R, 12)), from, to, 5, extra.field);                       // blamed third party: −2d12
      case 'sabotage': return D.act(S, -(mag !== null ? mag : rnd(R, 20) + 20), from, to, extra.framed ? 7 : 6, extra.planet, extra.what);    // sabotage identified: −(d20+20)
      case 'spyFrameSabotage': return D.act(S, -(mag !== null ? mag : rnd(R, 16) + rnd(R, 16)), from, to, 7, extra.planet, extra.what);
      case 'combat': return D.battleFinish(S, from, to, Object.assign({}, extra, mag !== null ? { offense: mag } : {}));
      case 'bio': return D.battleFinish(S, from, to === undefined ? -1 : to, { bio: Math.max(1, extra.bio | 0), planet: extra.planet, popLost: extra.popLost, force: extra.force });
      case 'capture': case 'depopulate': {                                                                                                       // a human takes/depopulates an AI planet: −(50..100) and an automatic war
        const wasWar = rec(S, to, from).treaty >= T.WAR;
        const dv = D.act(S, -(mag !== null ? mag : 50 + rnd(R, 50)), from, to, wasWar ? 10 : 13, extra.planet);
        if (!wasWar && isAlive(S, to)) { if (D.CFG.capturePaysAI) D.declareWar(S, to, from, 'invasion', 13); else D.declareWar(S, from, to, 'invasion', 13); }
        return dv;
      }
      case 'popKilled': return D.act(S, -(rnd(R, 5) + 5) * (mag !== null ? mag : 1), from, to, 10, extra.planet);                                // conquest attempt killed pop
      case 'aiGround': return D.act(S, -(rnd(R, 4) + 4), from, to, 10, extra.planet);                                                           // AI vs AI invasion
      case 'genocide': { let n = 0; for (const E of S.empires) if (E.alive && E.id !== from) { D.act(S, -36, from, E.id, 0); n++; } return n; }
      case 'councilVote': return D.act(S, magnitude, from, to, 0);                                                                              // +24 / −12 / −6
      case 'border': return D.act(S, -(mag !== null ? mag : 10), from, to, 8, extra.planet);
      case 'tooBig': return D.act(S, -(mag !== null ? mag : 10), from, to, 12);
      case 'war': return D.declareWar(S, from, to, extra.reason || 'incident');
      case 'breakTreaty': return D.breakTreaty(S, from, to);
      default: return 0;
    }
  };
  // drain {type:'incident'} events other modules pushed into S.ev (Ground: bio bombing…)
  function drainIncidents(S) {
    if (!M.Sim.Ev) return 0;
    const evs = M.Sim.Ev.take(S, e => e.type === 'incident');
    for (const e of evs) D.incident(S, e.kind, e.from, e.to, e.magnitude, e);
    return evs.length;
  }
  // an empire was wiped out: the killer (last taker of its planets) is blamed by everybody (−36)
  D.empireDied = function (S, dead, killer) {
    ensure(S);
    S.diplo.dead[dead] = true;
    for (const E of S.empires) { const r = E.relations[dead]; if (r) { r.contact = false; } const r2 = S.empires[dead].relations[E.id]; if (r2) r2.contact = false; }
    if (killer >= 0 && isAlive(S, killer)) { D.incident(S, 'genocide', killer, -1); news(S, 'genocide', killer, dead); log(S, 'genocide', killer, dead); }
  };
  function trackOwners(S) {
    const owners = S.diplo.owners || (S.diplo.owners = []);
    for (const p of S.planets) {
      const prev = owners[p.id];
      if (prev !== undefined && prev >= 0 && p.owner !== prev && p.owner >= 0) S.diplo.lastTaker[prev] = p.owner;
      owners[p.id] = p.owner;
    }
    for (const E of S.empires) {
      if (E.alive || S.diplo.dead[E.id]) continue;
      D.empireDied(S, E.id, S.diplo.lastTaker[E.id] === undefined ? -1 : S.diplo.lastTaker[E.id]);
    }
  }

  // ══════════════════════════════════════ PER-TURN BOOKKEEPING — research/05 §4.3 ═══════════════════════════════════════════════════════
  // start of turn: ceasefire countdown, mood recovery (+rnd(5) while <0, +rnd(5) while <50), blunder memory, scratch reset
  D.preTurn = function (S, R) {
    ensure(S); R = R || RR(S);
    trackOwners(S);
    const n = S.empires.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const r = rec(S, i, j);
      if (r.ceasefire > 0) r.ceasefire--;
      if (r.dipType >= 4 && r.dipType <= 11) r.blunder = r.dipType;
      else if (r.dipType >= 42 && r.dipType <= 49) r.blunder = r.dipType - 30;
      else if (r.dipType >= 50 && r.dipType <= 57) r.blunder = r.dipType - 46;
      if (r.treaty !== T.FINAL_WAR) {
        for (const k of MOODS) { let v = r[k]; if (v < 0) v += rnd(R, 5); if (v < 50) v += rnd(R, 5); r[k] = v; }
      }
      r.moodPeace = clamp(r.moodPeace, -200, 200);
      r.dipVal = 0; r.dipType = 0; r.dipP1 = -1; r.dipP2 = -1;
    }
  };
  // after production: trade efficiency growth, then the "diplo_adjust" block (goodwill, complaints, drift)
  D.economyTurn = function (S, R) {
    ensure(S); R = R || RR(S);
    const n = S.empires.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {                                               // trade efficiency: +0..3 per turn, better with good relations
      const r = rec(S, a, b); if (!r.trade) continue;
      if (!r.contact || !isAlive(S, a) || !isAlive(S, b)) { D.breakTrade(S, a, b); continue; }
      const g = Math.max(0, tdiv(rnd(R, 200) + r.rel1 + 25, 60));
      rec(S, a, b).tradePct = rec(S, b, a).tradePct = Math.min(100, r.tradePct + g);
    }
    diploAdjust(S, R);
    if (S.diplo.finalWar) D.finalWarShare(S);
  };
  function diploAdjust(S, R) {
    const n = S.empires.length, live = S.empires.filter(e => e.alive);
    // A: treaty goodwill — NAP +rnd(3), alliance +rnd(6), trade +rnd(3), each 50 % per pair per turn; actor = the lower index, target = the higher index (a human target never reacts)
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i].id, b = live[j].id, r = rec(S, a, b);
      if (r.treaty !== T.NAP && r.treaty !== T.ALLIANCE && !(r.trade > 0)) continue;
      if (rnd0(R, 2) !== 0) continue;                                                                      // one 50 % roll per pair, then every treaty's goodwill together
      if (r.treaty === T.NAP) D.act(S, rnd(R, 3), a, b, 0);
      if (r.treaty === T.ALLIANCE) D.act(S, rnd(R, 6), a, b, 0);
      if (r.trade > 0) D.act(S, rnd(R, 3), a, b, 2);
    }
    // B: an AI dislikes a human with a visibly bigger fleet (border build-up, type 8)
    const stat = {}; for (const E of live) stat[E.id] = D.fleetStat(S, E.id);
    for (const H of live) {
      if (!H.human) continue;
      for (const A of live) {
        if (A.human || !rec(S, H.id, A.id).contact) continue;
        const sa = stat[A.id], sh = stat[H.id];
        if (sa < sh && sa > 0 && rnd(R, 100) >= tdiv(sh * 50, sa) && rnd0(R, 20) === 0) D.act(S, -10, H.id, A.id, 8);
      }
    }
    // C: on even years an empire with many big producers frightens its AI allies (type 12)
    if (year(S) % 2 === 0) {
      const sz = galaxySizeIdx(S), gscale = (sz + 1) * 3, gdiv = sz + 6 - diffIdx(S);
      for (const X of live) {
        let npp = 0; for (const p of S.planets) if (p.owner === X.id && (p.spendable | 0) >= 100) npp++;
        if (npp > gscale && rnd0(R, 4) === 0) {
          let v = rnd(R, 4) * tdiv(-(npp - gscale), gdiv); v = tdiv(v, 3) * 4; if (X.human) v = tdiv(v, 2);
          for (const Y of live) if (Y.id !== X.id && !Y.human && rec(S, X.id, Y.id).treaty === T.ALLIANCE && rec(S, X.id, Y.id).contact) D.act(S, v, X.id, Y.id, 12);
        }
      }
    }
    // D/E: relations drift 0 or 1 toward rel2 with probability |rel1|/105 on every AI row; the closing mirror loop copies the LOWER-index row over the higher one
    // (research/05 errata), so each pair gets ONE roll — from the lower index — and a human player 0 never drifts. CFG.driftBothRows restores the old reading.
    for (let a = 0; a < n; a++) {
      rec(S, a, a).rel1 = rec(S, a, a).attitude = 0;
      for (let b = a + 1; b < n; b++) {
        if (!isAlive(S, a) || !isAlive(S, b)) continue;
        for (const o of (D.CFG.driftBothRows ? [a, b] : [a])) {
          if (isHuman(S, o)) continue;
          const p = o === a ? b : a, r = rec(S, o, p);
          if (Math.abs(r.rel1) > rnd(R, 105)) {
            const st = rnd0(R, 2);
            let v = r.rel1;
            if (v > r.rel2) v = Math.max(v - st, r.rel2); else if (v < r.rel2) v = Math.min(v + st, r.rel2);
            setRel(S, o, p, v);
          }
        }
      }
    }
  }


  // ══════════════════════════════════════ DIALOGUE MAPPING (message types → Data.text.diplomacy situations) ═════════════════════════════
  // research/05 §4.8 numbers the AI's messages; our own dialogue lines (data/text.js) are keyed by situation. This table is the bridge.
  const MS = {
    1: 'congratulate', 2: 'thanksGift', 3: 'congratulate', 4: 'spiesCaughtThem', 5: 'spiesCaughtThem', 6: 'spiesCaughtThem', 7: 'spiesCaughtThem', 8: 'borderWarning',
    9: 'threaten', 10: 'threaten', 11: 'threaten', 12: 'borderWarning', 13: 'declareWar', 20: 'insultReply', 21: 'proposalRejectedUntrust', 22: 'greeting', 23: 'greeting',
    24: 'offerNap', 25: 'offerAlliance', 26: 'offerTrade', 27: 'threaten', 28: 'callForAid', 29: 'offerTech', 30: 'askPeace', 31: 'proposalRejected', 32: 'breakTreaty',
    33: 'proposalRejectedUntrust', 46: 'borderWarning', 54: 'borderWarning', 58: 'payTribute', 59: 'warAnnounced', 60: 'declareWar', 61: 'declareWar', 62: 'proposalAccepted',
    63: 'proposalAccepted', 64: 'proposalAccepted', 65: 'acceptPeace', 66: 'thanksGift', 67: 'proposalAccepted', 68: 'proposalAccepted', 69: 'refuseTribute', 70: 'backDown',
    71: 'payTribute', 73: 'threaten', 74: 'farewell', 75: 'proposalRejected', 76: 'callForAid', 77: 'breakTreaty', 78: 'thanksGift', 79: 'insultReply', 80: 'councilVoteThanks',
  };
  for (let t = 14; t <= 19; t++) MS[t] = 'greeting';                                              // first-contact greetings: 14 + personality (the line set is chosen by the speaker's personality)
  for (let t = 34; t <= 41; t++) MS[t] = 'proposalRejectedUntrust';                              // refusals citing a remembered offence
  for (let t = 42; t <= 49; t++) if (!MS[t]) MS[t] = 'threaten';                                 // first warning about offence (t − 38)
  for (let t = 50; t <= 57; t++) if (!MS[t]) MS[t] = 'breakTreaty';                              // final warning, treaty cancelled
  D.MSG_SITUATION = MS;
  D.situation = type => MS[type] || 'proposalRejected';
  const say = (S, from, to, situation, vars, msgType) => {                                       // a dialogue line spec: UI looks up Data.text.diplomacy[personality][situation]
    const A = S.empires[from], H = S.empires[to];
    return { personality: D.PERSONALITIES[A.personality | 0], situation: situation || D.situation(msgType), msgType: msgType | 0, from, to, race: A.race,
      vars: Object.assign({ leader2: H.leader, race2: H.plural, leader: A.leader, race: A.plural }, vars || {}) };
  };
  D.say = say;

  // ══════════════════════════════════════ PLAYER-INITIATED AUDIENCE — research/05 §4.4 ═════════════════════════════════════════════════
  const MOODKEY = { treaty: 'moodTreaty', trade: 'moodTrade', peace: 'moodPeace', tech: 'moodTech' };
  const bonusFor = (S, x) => (isHuman(S, x) ? askBonus(S, x) : 0);
  // the one acceptance roll: mood + trust + relation + (Human 50) + reldiff + d100 − threshold (+40 if allied). Always costs −10 on all moods and 20–100 on the topic.
  // returns 0 flat refusal · 1 counter (asks a TECH) · 2 counter (asks BC) · 3 accepted
  function checkMood(S, R, h, a, a0, kind) {
    const r = rec(S, h, a), k = MOODKEY[kind];
    let v = r[k] + r.trust + r.rel1 + bonusFor(S, h) + reldiff(S, a) + rnd(R, 100) - a0;
    if (r.treaty === T.ALLIANCE) v += 40;
    annoy(r, 1);
    r[k] -= kind === 'peace' ? rnd(R, 50) + 50 : kind === 'tech' ? rnd(R, 50) + 20 : rnd(R, 30) + 20;
    return v < -75 ? 0 : v < -50 ? 1 : v < 0 ? 2 : 3;
  }
  D.checkMood = (S, h, a, a0, kind) => checkMood(S, RR(S), h, a, a0, kind);
  // the AI's counter-demand ("sweetener"): 2d8 × year BC rounded to 25 (0 if the human cannot pay) or a tech worth ≥ year to the AI, never the human's newest in a field
  function sweeten(S, R, h, a, result) {
    const H = S.empires[h];
    let bc = tdiv((rnd(R, 8) + rnd(R, 8)) * year(S), 25) * 25; if (bc > H.bc) bc = 0;
    const cands = D.techCandidates(S, h, a, { noNewest: true, minValue: year(S) });
    const t = cands.length ? cands[rnd0(R, cands.length)] : null;
    const tech = t ? { type: 'tech', field: t.field, level: t.level, name: t.name } : null, money = bc ? { type: 'bc', bc } : null;
    return result === 1 ? (tech || money) : (money || tech);
  }
  function counterText(R, ask) {
    const what = ask.type === 'bc' ? ask.bc + ' BC' : ask.name;
    return rnd0(R, 2) === 0 ? 'We might reconsider if you added ' + what + ' to the bargain.' : 'Add ' + what + ' and we have a deal.';
  }
  // refusal speech: remembered offence (50 %) or remembered broken treaty (25 %) replaces the generic refusal
  function refusal(S, R, h, a, sit, type) {
    const r = rec(S, h, a); type = type || 31;
    if (r.blunder !== 0 && rnd0(R, 2) === 0) { type = r.blunder + 30; r.blunder = 0; }
    else if (r.broken !== 0 && rnd0(R, 4) === 0) { type = 33; r.broken = 0; }
    return say(S, a, h, type >= 33 ? 'proposalRejectedUntrust' : (sit || 'proposalRejected'), {}, type);
  }
  const fail = msg => ({ ok: false, accepted: false, msg });

  // effects of an accepted proposal (also used by AI-vs-AI orders and answered counters)
  function applyAccepted(S, R, h, a, prop) {
    const eff = {};
    switch (prop.kind) {
      case 'nap': setTreatyRaw(S, h, a, T.NAP); news(S, 'napSigned', h, a); log(S, 'nap', h, a); eff.treaty = T.NAP; break;
      case 'alliance': setTreatyRaw(S, h, a, T.ALLIANCE); news(S, 'allianceFormed', h, a); log(S, 'alliance', h, a); eff.treaty = T.ALLIANCE; break;
      case 'peace': D.stopWar(S, h, a); eff.treaty = T.NONE; eff.ceasefire = D.ceasefire(S, h, a); break;
      case 'askWar': D.declareWar(S, a, prop.target, 'asked by ' + S.empires[h].name); eff.war = [a, prop.target]; break;
      case 'askBreak': D.breakTreaty(S, a, prop.target); eff.broke = [a, prop.target]; break;
      case 'trade': D.setTrade(S, h, a, prop.bc); news(S, 'tradeSigned', h, a, { bc: prop.bc }); log(S, 'trade', h, a, prop.bc); eff.trade = prop.bc; break;
    }
    return eff;
  }
  const OK = { nap: ['proposalAccepted', 62], alliance: ['proposalAccepted', 63], peace: ['acceptPeace', 65], askWar: ['proposalAccepted', 67], askBreak: ['proposalAccepted', 68], trade: ['proposalAccepted', 64] };
  const NO = { nap: 'proposalRejected', alliance: 'proposalRejected', peace: 'rejectPeace', askWar: 'refuseAid', askBreak: 'refuseAid', trade: 'proposalRejected' };
  function accepted(S, R, h, a, prop, extraEff) {
    const r = rec(S, h, a), eff = Object.assign(applyAccepted(S, R, h, a, prop), extraEff || {});
    let reply = say(S, a, h, OK[prop.kind][0], { treaty: D.TREATY_NOUN[eff.treaty !== undefined ? eff.treaty : 0] }, OK[prop.kind][1]);
    if (r.gift && rnd0(R, 4) === 0) { reply = say(S, a, h, 'thanksGift', { tech: r.gift.name }, 66); r.gift = null; }   // the AI remembers a tech tribute and may thank you
    return { ok: true, accepted: true, result: 3, kind: prop.kind, reply, effects: eff };
  }
  function refused(S, R, h, a, prop, res, gate) { return { ok: true, accepted: false, result: res | 0, kind: prop.kind, gate: !!gate, reply: refusal(S, R, h, a, NO[prop.kind], 31), effects: {} }; }
  function resolveAsk(S, R, h, a, prop, res) {
    if (res === 3) return accepted(S, R, h, a, prop);
    if (res === 0) return refused(S, R, h, a, prop, 0);
    const ask = sweeten(S, R, h, a, res);
    if (!ask) return refused(S, R, h, a, prop, 0);
    S.diplo.pending = { h, a, prop, ask };
    return { ok: true, accepted: false, result: res, kind: prop.kind, counter: Object.assign({ text: counterText(R, ask) }, ask), needsAnswer: true, effects: {},
      reply: say(S, a, h, NO[prop.kind], {}, 31) };
  }
  // the player answers a counter-offer: pay (BC or tech) and the original proposal is accepted, or refuse and it is dropped
  D.answerCounter = function (S, h, a, yes) {
    ensure(S);
    const p = S.diplo.pending, R = RR(S);
    if (!p || p.h !== h || p.a !== a) return fail('no counter-offer pending');
    S.diplo.pending = null;
    if (!yes) return refused(S, R, h, a, p.prop, 0);
    const H = S.empires[h], ask = p.ask, eff = {};
    if (ask.type === 'bc') { if (H.bc < ask.bc) return fail('not enough BC'); H.bc -= ask.bc; S.empires[a].bc += ask.bc; eff.bcPaid = ask.bc; }
    else { if (!owns(H, ask.field, ask.level)) return fail('technology not owned'); giveTech(S, a, ask.field, ask.level, 'trade'); eff.techGiven = { field: ask.field, level: ask.level, name: ask.name }; }
    return accepted(S, R, h, a, p.prop, eff);
  };

  // ── audience opening, menu ──────────────────────────────────────────────────────────────────────────────────────────────────────
  D.audience = function (S, h, a) {
    ensure(S);
    const r = rec(S, h, a), A = S.empires[a];
    if (!r.contact || !A.alive || r.treaty === T.FINAL_WAR || S.diplo.finalWar) return { ok: false, state: 'unavailable' };
    r.moodTreaty = clamp(r.moodTreaty, -200, 120);
    const m = minMood(r), atWar = r.treaty >= T.WAR;
    let v = r.trust + m + reldiff(S, a);
    if (v < -100) { const t = atWar ? 20 : 21; return { ok: true, state: 'refused', msgType: t, greeting: say(S, a, h, D.situation(t), {}, t) }; }
    v += r.rel1;
    const t = v > -50 ? 22 : 23;
    if (m < -100) return { ok: true, state: 'later', msgType: 74, greeting: say(S, a, h, D.situation(74), {}, 74) };
    return { ok: true, state: 'open', msgType: t, cool: t === 23, greeting: say(S, a, h, atWar ? 'greetingAtWar' : 'greeting', {}, t), status: D.status(S, h, a) };
  };
  const warTargets = (S, h, a) => S.empires.filter(e => e.alive && e.id !== h && e.id !== a && rec(S, a, e.id).treaty < T.WAR).map(e => e.id);
  const breakTargets = (S, h, a) => S.empires.filter(e => e.alive && e.id !== a && e.id !== h && rec(S, a, e.id).treaty === T.ALLIANCE && rec(S, a, e.id).contact).map(e => e.id);
  // headroom of the trade agreement menu (research/05 §4.4.4): up to 25 % of the smaller economy
  D.tradeLevels = function (S, h, a) {
    const cur = rec(S, h, a).trade, prod = Math.min(32000, tdiv(Math.min(D.production(S, h), D.production(S, a)), 4)), want = tdiv(prod, 25) * 25 - cur;
    if (want <= 0) return [];
    if (want < 125) { const o = []; for (let i = 1; i <= tdiv(want, 25); i++) o.push(cur + 25 * i); return o; }
    const q = f => cur + tdiv(tdiv(want * f, 5), 25) * 25;
    return [q(1), q(2), q(3), q(4), cur + want];
  };
  D.tributeChoices = function (S, h, a) {
    const reserve = tdiv(Math.min(Math.max(S.empires[h].bc, 0), 32000), 25) * 25, bc = [];
    if (reserve < 100) { for (let v = 25; v <= 100 && v <= reserve; v += 25) bc.push(v); }
    else for (const f of [1, 2, 3, 4]) bc.push(tdiv(tdiv(reserve * f, 4), 25) * 25);
    const all = D.techCandidates(S, h, a, {}).sort((x, y) => y.value - x.value || x.field - y.field || x.level - y.level);
    return { bc, techs: all.slice(0, 4).map(t => ({ field: t.field, level: t.level, name: t.name, value: t.value })), allTechs: all.map(t => ({ field: t.field, level: t.level, name: t.name, value: t.value })) };
  };
  D.menu = function (S, h, a) {
    ensure(S);
    const r = rec(S, h, a), H = S.empires[h], atWar = r.treaty >= T.WAR, wt = warTargets(S, h, a), bt = breakTargets(S, h, a);
    const treaty = [
      { id: 'nap', label: 'Non-Aggression Pact', enabled: r.treaty === T.NONE },
      { id: 'alliance', label: 'Alliance', enabled: r.treaty === T.NONE || r.treaty === T.NAP },
      { id: 'peace', label: 'Peace Treaty', enabled: r.treaty === T.WAR },
      { id: 'askWar', label: 'Declaration of War on Another Race', enabled: !atWar && wt.length > 0, targets: wt },
      { id: 'askBreak', label: 'Break Alliance With Another Race', enabled: bt.length > 0 && r.treaty < T.WAR, targets: bt },
    ];
    const levels = atWar ? [] : D.tradeLevels(S, h, a);
    const tc = D.tributeChoices(S, h, a);
    return { ok: true, with: a, atWar, actions: [
      { id: 'treaty', label: 'Propose Treaty', enabled: treaty.some(o => o.enabled), options: treaty },
      { id: 'trade', label: 'Form Trade Agreement', enabled: levels.length > 0, options: levels.map(bc => ({ id: 'trade', label: bc + ' BC', bc, enabled: true })), current: r.trade },
      { id: 'threaten', label: 'Threaten/Break Treaty and Trade', enabled: !atWar, options: [
        { id: 'breakTreaty', label: 'Break Non-Aggression Pact', enabled: r.treaty === T.NAP, treaty: T.NAP }, { id: 'breakTreaty', label: 'Break Alliance', enabled: r.treaty === T.ALLIANCE, treaty: T.ALLIANCE },
        { id: 'breakTrade', label: 'Break Trade Agreement', enabled: r.trade > 0 }, { id: 'threat', label: 'Threaten To Attack', enabled: true }] },
      { id: 'tribute', label: 'Offer Tribute', enabled: H.bc >= 25 || tc.allTechs.length > 0, options: [{ id: 'tributeBC', label: 'Gold', amounts: tc.bc, enabled: tc.bc.length > 0 }, { id: 'tributeTech', label: 'Technology', techs: tc.techs, enabled: tc.allTechs.length > 0 }] },
      { id: 'techExchange', label: 'Exchange Technology', enabled: !atWar },
      { id: 'goodbye', label: 'Good Bye', enabled: true },
    ] };
  };
  // leaving a submenu without choosing costs mood too (research/05 §4.4.4, §4.4.5, §4.4.7)
  D.leave = function (S, h, a, sub) {
    ensure(S);
    const r = rec(S, h, a), R = RR(S);
    if (sub === 'trade') { annoy(r, 1); r.moodTrade -= rnd0(R, 30) + 1; }
    else if (sub === 'threaten') annoy(r, 10);
    else if (sub === 'tech') { annoy(r, 3); r.moodTech = Math.min(r.moodTech, 50); S.diplo.techList = null; }
    return true;
  };

  // ── technology exchange (research/05 §4.4.7) ────────────────────────────────────────────────────────────────────────────────────
  D.techExchangeScale = function (S, h, a, R) {
    const r = rec(S, h, a);
    let di = r.moodTech; if (di > 0) di = tdiv(di, 5); di = Math.min(di, 30); if (r.treaty === T.ALLIANCE) di += 25;
    let v = r.trust + tdiv(r.rel1, 2) + bonusFor(S, h) + 2 * reldiff(S, a) + di + rnd(R || RR(S), 100) - 125;
    v = v < 0 ? -v + 100 : tdiv(20000, v + 200);
    return Math.max(tdiv(v, 4), 75);
  };
  // step 1: up to 5 techs the AI is willing to part with (never its newest per field); costs annoy(1) + mood_tech −(20..70) once per visit
  D.techWanted = function (S, h, a) {
    ensure(S);
    const r = rec(S, h, a), R = RR(S), c = S.diplo.techList;
    if (c && c.h === h && c.a === a && c.turn === S.turn) return c.list;
    const cands = D.techCandidates(S, a, h, { noNewest: true }), list = [];
    while (cands.length && list.length < 5) list.push(cands.splice(rnd0(R, cands.length), 1)[0]);
    const scale = D.techExchangeScale(S, h, a, R);
    annoy(r, 1); r.moodTech -= rnd(R, 50) + 20;
    const out = list.map(t => ({ field: t.field, level: t.level, name: t.name, value: techValue(t.tech, ownedTiers(S.empires[h])), price: tdiv(techValue(t.tech, ownedTiers(S.empires[a])) * scale, 100) }));
    S.diplo.techList = { h, a, turn: S.turn, scale, list: out };
    return out;
  };
  // step 2: techs the human can pay with — the AI lacks them and values each at least `price` (= its value of the wanted tech × scale / 100)
  D.techOffers = function (S, h, a, want) {
    ensure(S);
    const c = S.diplo.techList; if (!c || c.h !== h || c.a !== a || c.turn !== S.turn) return [];
    const w = c.list.find(x => x.field === want.field && x.level === want.level); if (!w) return [];
    return D.techCandidates(S, h, a, { minValue: w.price }).sort((x, y) => y.value - x.value).slice(0, 4).map(t => ({ field: t.field, level: t.level, name: t.name, value: t.value }));
  };
  // the wanted techs for which at least one payment exists (the menu hides the rest)
  D.techMarket = function (S, h, a) { return D.techWanted(S, h, a).filter(w => D.techOffers(S, h, a, w).length > 0); };

  // ── propose: every player action of the audience ───────────────────────────────────────────────────────────────────────────────────
  D.propose = function (S, h, a, prop) {
    ensure(S);
    const R = RR(S), r = rec(S, h, a), H = S.empires[h], A = S.empires[a];
    if (!prop || !prop.kind) return fail('no proposal');
    if (h === a || !A.alive || !r.contact) return fail('no contact');
    if (S.diplo.finalWar || r.treaty === T.FINAL_WAR) return fail('no diplomacy during the Final War');
    r.moodTreaty = clamp(r.moodTreaty, -200, 120);
    if (prop.kind !== 'techExchange') S.diplo.pending = null;
    switch (prop.kind) {
      case 'nap': case 'alliance': {
        if (prop.kind === 'nap' ? r.treaty !== T.NONE : (r.treaty !== T.NONE && r.treaty !== T.NAP)) return fail('not available');
        if (r.rel1 <= (prop.kind === 'nap' ? 10 : 50)) return refused(S, R, h, a, prop, 0, true);          // flat refusal, no mood cost
        return resolveAsk(S, R, h, a, prop, checkMood(S, R, h, a, prop.kind === 'nap' ? 50 : 125, 'treaty'));
      }
      case 'peace': {
        if (r.treaty !== T.WAR) return fail('not at war');
        const res = checkMood(S, R, h, a, 60, D.CFG.peaceUsesTreatyMood ? 'treaty' : 'peace');
        annoy(r, 2);                                                                                      // asking for peace always costs another −20
        return resolveAsk(S, R, h, a, prop, res);
      }
      case 'askWar': {
        const x = prop.target;
        if (!(x >= 0) || x === h || x === a || !isAlive(S, x) || r.treaty >= T.WAR || rec(S, a, x).treaty >= T.WAR) return fail('not available');
        let res;
        if (r.treaty === T.ALLIANCE && rec(S, h, x).treaty >= T.WAR) res = rnd0(R, 8) !== 0 ? 3 : 2;       // an ally helps its ally's war 7 times out of 8
        else res = checkMood(S, R, h, a, rec(S, a, x).rel1 + 150, 'treaty');
        return resolveAsk(S, R, h, a, prop, res);
      }
      case 'askBreak': {
        const x = prop.target;
        if (!(x >= 0) || x === h || x === a || rec(S, a, x).treaty !== T.ALLIANCE) return fail('not available');
        if (rec(S, a, h).rel1 <= 24) return refused(S, R, h, a, prop, 0, true);
        return resolveAsk(S, R, h, a, prop, checkMood(S, R, h, a, rec(S, a, x).rel1 + 175, 'treaty'));
      }
      case 'trade': {
        if (r.treaty >= T.WAR) return fail('at war');
        const levels = D.tradeLevels(S, h, a);
        if (levels.indexOf(prop.bc) < 0) return fail('not a listed level');
        const res = checkMood(S, R, h, a, 50, 'trade');
        annoy(r, 1); r.moodTrade -= rnd0(R, 30) + 1;                                                      // leaving the submenu
        return res === 3 ? accepted(S, R, h, a, prop) : refused(S, R, h, a, prop, res);                   // trade never counters
      }
      case 'tributeBC': return tributeBC(S, R, h, a, prop);
      case 'tributeTech': return tributeTech(S, R, h, a, prop);
      case 'threat': if (r.treaty >= T.WAR) return fail('at war'); return threaten(S, R, h, a);
      case 'breakTreaty': {
        if (r.treaty !== T.NAP && r.treaty !== T.ALLIANCE) return fail('no treaty to break');
        const old = r.treaty; annoy(r, 10);
        D.breakTreaty(S, h, a);
        return { ok: true, accepted: true, result: 3, kind: 'breakTreaty', effects: { broke: old }, reply: say(S, a, h, 'threaten', {}, 73) };
      }
      case 'breakTrade': {
        if (!(r.trade > 0)) return fail('no trade agreement'); annoy(r, 10);
        D.breakTrade(S, h, a); log(S, 'tradeBroken', h, a);
        return { ok: true, accepted: true, result: 3, kind: 'breakTrade', effects: { tradeBroken: true }, reply: say(S, a, h, 'threaten', {}, 73) };
      }
      case 'techExchange': {
        if (r.treaty >= T.WAR) return fail('at war');
        const w = prop.want, g = prop.give, c = S.diplo.techList;
        if (!w || !g || !c || c.h !== h || c.a !== a || c.turn !== S.turn) return fail('no exchange in progress');
        if (!D.techOffers(S, h, a, w).some(t => t.field === g.field && t.level === g.level)) return fail('not an acceptable payment');
        if (!owns(A, w.field, w.level) || !owns(H, g.field, g.level)) return fail('technology not owned');
        giveTech(S, h, w.field, w.level, 'trade'); giveTech(S, a, g.field, g.level, 'trade');
        annoy(r, 3); r.moodTech = Math.min(r.moodTech, 50); S.diplo.techList = null;                      // leaving the submenu
        const wt = techRec(w.field, w.level), gt = techRec(g.field, g.level);
        log(S, 'techSwap', h, a);
        return { ok: true, accepted: true, result: 3, kind: 'techExchange', effects: { got: { field: w.field, level: w.level, name: wt && wt.name }, gave: { field: g.field, level: g.level, name: gt && gt.name } }, reply: say(S, a, h, 'proposalAccepted', { tech: wt && wt.name }, 62) };
      }
    }
    return fail('unknown proposal');
  };

  // cash tribute: the money moves; v1.3 gives NO relations for it (unless the AI has no production at all: +index+1)
  function tributeBC(S, R, h, a, prop) {
    const r = rec(S, h, a), H = S.empires[h], A = S.empires[a], bc = prop.bc | 0;
    if (bc < 25 || bc > H.bc || bc > 32000) return fail('cannot pay that');
    H.bc -= bc; A.bc += bc;
    const prod = D.production(S, a), before = r.rel1;
    let gain = 0;
    if (D.CFG.classicCashTribute) { if (prod <= 0) gain = (prop.index | 0) + 1; } else gain = tdiv(bc * 12, Math.max(1, prod));
    gain *= raceMod(H, 'tributeMul');
    let nr = clamp(before + gain, -100, 100);
    if (r.treaty >= T.WAR) nr = Math.min(nr, -25); if (r.treaty !== T.ALLIANCE) nr = Math.min(nr, 65);
    setRel(S, h, a, Math.max(before, nr));
    news(S, 'tributePaid', h, a, { bc }); log(S, 'tributeBC', h, a, bc);
    return { ok: true, accepted: true, result: 3, kind: 'tributeBC', effects: { bc, rel: r.rel1 - before }, reply: say(S, a, h, 'thanksGift', { bc }, 66) };
  }
  // technology tribute: relation +((d8+d8+level/4)·base)/10 (x2 Human), trust +2..9 (cap 30), peace mood up; the AI remembers the gift
  function tributeTech(S, R, h, a, prop) {
    const r = rec(S, h, a), H = S.empires[h], A = S.empires[a], f = prop.field, l = prop.level;
    if (!(f >= 0 && f < 6) || !owns(H, f, l) || owns(A, f, l)) return fail('cannot give that');
    if (!D.techCandidates(S, h, a, {}).some(t => t.field === f && t.level === l)) return fail('the receiver cannot use that technology');
    const t = techRec(f, l), base = r.rel1 < 0 ? 20 : tdiv(100 - r.rel1, 10), before = r.rel1;
    let gain = tdiv((rnd(R, 8) + rnd(R, 8) + tdiv(l, 4)) * base, 10);
    gain *= raceMod(H, 'tributeMul');
    giveTech(S, a, f, l, 'tribute');
    let nr = Math.min(100, before + gain);
    if (r.treaty >= T.WAR) nr = Math.min(nr, -25); if (r.treaty !== T.ALLIANCE) nr = Math.min(nr, 70);
    setRel(S, h, a, Math.max(before, nr));
    r.moodPeace = Math.min(200, r.moodPeace + gain); rec(S, a, h).moodPeace = Math.min(200, rec(S, a, h).moodPeace + gain);
    r.trust = Math.min(30, r.trust + rnd(R, 8) + 2);
    r.gift = { field: f, level: l, name: t ? t.name : '' };
    news(S, 'tributePaid', h, a, { tech: t ? t.name : '' }); log(S, 'tributeTech', h, a, l);
    return { ok: true, accepted: true, result: 3, kind: 'tributeTech', effects: { field: f, level: l, name: t && t.name, rel: r.rel1 - before, trust: r.trust }, reply: say(S, a, h, 'thanksGift', { tech: t && t.name }, 66) };
  }
  // "Threaten To Attack": relative power + mood + personality + d200 decide between war, defiance, a cease-fire, BC tribute or a tech (research/05 §4.4.5)
  function threaten(S, R, h, a) {
    const r = rec(S, h, a), A = S.empires[a], H = S.empires[h];
    annoy(r, 10);                                                                                           // entering the menu costs −100 on every mood
    const pa = D.production(S, a), ph = D.production(S, h);
    const v = rnd(R, 200) + tdiv(r.moodTreaty, 2) + 2 * reldiff(S, a) + (pa > 0 ? tdiv(ph * 100, pa) : 100);
    setRel(S, h, a, Math.max(r.rel1 - rnd(R, 15), -100));
    r.moodTreaty = -120;
    if (v < 170) {
      if (rnd(R, 15) - reldiff(S, a) > rnd(R, 100)) { D.startWar(S, h, a, 'threat'); return { ok: true, accepted: false, result: 0, kind: 'threat', outcome: 'war', effects: { war: [h, a] }, reply: say(S, a, h, 'declareWar', {}, 13) }; }
      return { ok: true, accepted: false, result: 0, kind: 'threat', outcome: 'defiant', effects: {}, reply: say(S, a, h, 'refuseTribute', {}, 69) };
    }
    if (D.CFG.threatHidesHuman) { if (H.spyMode) H.spyMode[a] = 0; } else if (A.spyMode) A.spyMode[h] = 0;       // v1.3 bug: it is the PLAYER's spies that go into hiding
    rec(S, h, a).ceasefire = rec(S, a, h).ceasefire = rnd(R, 15) + 5;
    const eff = { ceasefire: rec(S, h, a).ceasefire };
    if (v >= 275) {
      const cands = D.techCandidates(S, a, h, { noNewest: true });
      if (cands.length) { const t = cands[rnd0(R, cands.length)]; giveTech(S, h, t.field, t.level, 'tribute'); eff.tech = { field: t.field, level: t.level, name: t.name }; }
    } else if (v >= 200) {
      const pay = Math.min(A.bc, tdiv((rnd(R, 8) + 2) * year(S), 25) * 25);
      if (pay > 0) { A.bc -= pay; H.bc += pay; eff.bc = pay; news(S, 'tributePaid', a, h, { bc: pay }); }
    }
    const sit = eff.bc ? 'payTribute' : 'backDown';
    return { ok: true, accepted: true, result: 3, kind: 'threat', outcome: eff.tech ? 'tech' : eff.bc ? 'bc' : 'cower', effects: eff, reply: say(S, a, h, sit, { bc: eff.bc, tech: eff.tech && eff.tech.name }, eff.bc ? 71 : 70) };
  }


  // ══════════════════════════════════════ WAR DECISIONS — research/05 §4.6.5, research/08 §3.2–3.3 ════════════════════════════════════
  // `fw`: how much stronger the TARGET is than the aggressor, as a random draw in 1..|ratio| (positive = target stronger → the AI gangs up on the leader)
  function envy(R, targetVal, aggVal) {
    const ratio = clamp(tdiv((targetVal - aggVal) * 100, Math.max(1, aggVal)), -300, 300);
    return ratio === 0 ? 0 : ratio > 0 ? rnd(R, ratio) : -rnd(R, -ratio);
  }
  const warsOf = (S, id) => { let n = 0; for (const E of S.empires) if (E.alive && E.id !== id && rec(S, id, E.id).treaty >= T.WAR) n++; return n; };
  // wage_war_do(T, A): turn a successful roll into action. Treaty partners are only cancelled (≥ Average difficulty); with no treaty the war starts unless a cease-fire runs.
  function warDo(S, R, tId, aId) {
    const rt = rec(S, tId, aId), A = S.empires[aId], diff = diffIdx(S), tHuman = isHuman(S, tId), rel = rt.rel1;
    if (rt.treaty === T.ALLIANCE || rt.treaty === T.NAP) {
      if (diff < 2) return false;
      const brk = rt.treaty === T.ALLIANCE ? (rnd0(R, 4) === 0 || (rnd0(R, 2) === 0 && A.objective === EXPANSIONIST)) : (rnd0(R, 2) === 0 || A.objective === EXPANSIONIST);
      if (!brk) return false;
      D.breakTreaty(S, aId, tId);
      if (tHuman) rec(S, tId, aId).dipType = 32;                                                        // "we cancel the treaty to expand"
      if (rec(S, tId, aId).rel1 > 30) setRel(S, aId, tId, 30);
      return true;
    }
    if (D.ceasefire(S, tId, aId) > 0) return false;
    if (tHuman) rec(S, tId, aId).dipType = rel < 0 ? 13 : 60;
    return D.startWar(S, aId, tId, 'ai');
  }
  // wage_war(T, A): the aggressor A rolls its war checks against target T (once per turn per contacted pair)
  function warCheck(S, R, tId, aId) {
    const rt = rec(S, tId, aId), A = S.empires[aId], Tg = S.empires[tId];
    if (rt.treaty >= T.WAR || !rt.contact || !A.alive || !Tg.alive) return false;
    const diff = diffIdx(S), tHuman = Tg.human, cf = !tHuman || D.ceasefire(S, tId, aId) < 1, dA = RELDIFF[A.personality | 0] || 0;
    let went = false;
    if (A.personality === ERRATIC && rnd(R, 300) <= diff && cf) {                                         // A: Erratic — sudden war (never on Simple), allies included
      if (D.startWar(S, aId, tId, 'erratic')) { if (tHuman) rec(S, tId, aId).dipType = 61; return true; }
    }
    if (rnd0(R, 20) === 0 && (A.objective === MILITARIST || A.objective === EXPANSIONIST) && A.personality !== HONOR && cf) {          // B: fleet envy
      const fw = envy(R, D.fleetPower(S, tId), D.fleetPower(S, aId));
      if (rt.rel1 - fw + dA + rt.trust < -150 && warDo(S, R, tId, aId)) went = true;
    }
    if (rnd0(R, 20) === 0 && cf) {                                                                          // C: production envy (any objective); re-runs war_do even after B
      const pa = Math.min(3250000, Math.max(1, D.production(S, aId)));
      const pw = envy(R, D.production(S, tId), pa);
      if (rt.rel1 - pw + dA + rt.trust < -150 && warDo(S, R, tId, aId)) went = true;
    }
    if (rec(S, tId, aId).treaty === T.ALLIANCE) {                                                           // D: ally of my ally's enemy — 1/10, can only drop the alliance
      for (const H4 of S.empires) {
        if (!H4.alive || !H4.human) continue;
        for (const X3 of S.empires) if (X3.alive && !X3.human && X3.id !== aId && rec(S, H4.id, X3.id).treaty >= T.WAR && rec(S, aId, X3.id).treaty === T.ALLIANCE && D.ceasefire(S, H4.id, aId) <= 0 && rnd0(R, 10) === 0) { if (warDo(S, R, tId, aId)) went = true; }
      }
    }
    if (tHuman && diff >= 2 && rec(S, tId, aId).treaty < T.WAR) {                                           // E: hatred pile-on against the human
      const n = warsOf(S, tId), rel = rec(S, tId, aId).rel1;
      if (n < diff && rel < -30 && rnd(R, 10) <= tdiv(-rel, 10) && warDo(S, R, tId, aId)) went = true;
    }
    return went;
  }
  D.warCheck = (S, tId, aId) => warCheck(S, RR(S), tId, aId);

  // ══════════════════════════════════════ AI ↔ AI DIPLOMACY — research/05 §4.7, research/08 §9.1 ═══════════════════════════════════════
  const topLevels = (E, f, k) => E.research.completed[f].filter(l => l > 1).sort((a, b) => b - a).slice(0, k);
  function aiTechSwap(S, R, P1, P2) {                                                                       // each side gets one tech the other lacks (donor's d3 newest per field excluded)
    const pick = (giver, taker) => {
      const r = rnd(R, 3), list = D.techCandidates(S, giver, taker, {}).filter(t => topLevels(giver, t.field, r).indexOf(t.level) < 0);
      return list.length ? list[(year(S) ^ r) % list.length] : null;
    };
    const a = pick(P2, P1), b = pick(P1, P2);
    if (!a || !b) return false;
    giveTech(S, P1.id, a.field, a.level, 'trade'); giveTech(S, P2.id, b.field, b.level, 'trade'); log(S, 'techSwap', P1.id, P2.id);
    return true;
  }
  // an AI allied with two AIs that fight each other drops both alliances. The v1.3 loop is buggy: it only ever tests p3 = p1+1 against the first non-human empire
  // above p1 — normally the same empire, so it practically never fires (the war cascade settles such conflicts instead). CFG.allianceConflictFixedIndex = false: intended rule.
  function breakConflictingAlliances(S, id) {
    if (D.CFG.allianceConflictFixedIndex) {
      const p3 = S.empires[id + 1]; let p2 = null;
      for (let j = id + 1; j < S.empires.length; j++) if (!S.empires[j].human) { p2 = S.empires[j]; break; }
      if (!p3 || !p2 || p2.id === p3.id || !p2.alive || !p3.alive) return false;
      if (rec(S, id, p2.id).treaty === T.ALLIANCE && rec(S, id, p3.id).treaty === T.ALLIANCE && rec(S, p2.id, p3.id).treaty >= T.WAR) { D.breakTreaty(S, id, p2.id); D.breakTreaty(S, id, p3.id); return true; }
      return false;
    }
    const allies = S.empires.filter(e => e.alive && e.id !== id && !e.human && rec(S, id, e.id).treaty === T.ALLIANCE);
    for (let i = 0; i < allies.length; i++) for (let j = i + 1; j < allies.length; j++) {
      if (rec(S, allies[i].id, allies[j].id).treaty >= T.WAR) { D.breakTreaty(S, id, allies[i].id); D.breakTreaty(S, id, allies[j].id); return true; }
    }
    return false;
  }
  function aiAiTurn(S, R) {
    const live = S.empires.filter(e => e.alive && !e.human), gate = 15 - 2 * diffIdx(S);
    for (const P1 of live) for (const P2 of live) {
      if (P1.id === P2.id) continue;
      const r = rec(S, P1.id, P2.id);
      if (!r.contact || rnd0(R, gate) !== 0) continue;
      const v = r.trust + r.rel1 + reldiff(S, P2.id) + rnd(R, 100) + (r.treaty === T.NAP ? 10 : 0) + (r.treaty === T.ALLIANCE ? 20 : 0) + (r.trade > 0 ? 10 : 0);
      if (v + r.moodTreaty > 150 && r.treaty !== T.ALLIANCE) {                                              // instant alliance (even out of a war)
        setTreatyRaw(S, P1.id, P2.id, T.ALLIANCE); rec(S, P1.id, P2.id).ceasefire = rec(S, P2.id, P1.id).ceasefire = 0;
        const fresh = S.turn - r.allyTurn >= 30;                                                            // the oscillation would flood the news: report a pair's alliance once per 30 turns
        r.allyTurn = rec(S, P2.id, P1.id).allyTurn = S.turn;
        if (fresh) news(S, 'allianceFormed', P1.id, P2.id);
        log(S, 'alliance', P1.id, P2.id);
      } else if (D.CFG.aiAllianceToggle && v + r.moodTreaty > 150 && r.treaty !== T.NAP) {
        const old = r.treaty; setTreatyRaw(S, P1.id, P2.id, T.NAP);                                          // v1.3 oscillation: an alliance silently becomes a NAP
        if (old < T.ALLIANCE) { news(S, 'napSigned', P1.id, P2.id); log(S, 'nap', P1.id, P2.id); }
      } else if (r.moodTech + 80 < v) aiTechSwap(S, R, P1, P2);
      else if (v > 70) {
        const bc = Math.min(tdiv(D.production(S, P1.id), 4), tdiv(D.production(S, P2.id), 4), 32000), had = r.trade;
        if (bc > 0 && bc !== had) { D.setTrade(S, P1.id, P2.id, bc); if (!had) { news(S, 'tradeSigned', P1.id, P2.id, { bc }); log(S, 'trade', P1.id, P2.id, bc); } }
      }
      if (rnd0(R, 20) === 0) D.act(S, rnd(R, 5), P1.id, P2.id, 1);
      const rr = rec(S, P1.id, P2.id);
      if (rr.treaty === T.WAR && (D.CFG.aiPeaceStaleV ? R.int(-1, 13) : v) + rr.moodPeace > 100) D.stopWar(S, P1.id, P2.id);
      annoy(rec(S, P1.id, P2.id), 3);
      breakConflictingAlliances(S, P1.id);
      warCheck(S, R, P1.id, P2.id);
    }
    for (const P1 of live) for (const P2 of live) {                                                          // allies join each other's wars, every turn, no roll
      if (P1.id === P2.id || rec(S, P1.id, P2.id).treaty !== T.ALLIANCE) continue;
      for (const P3 of live) if (P3.id !== P1.id && P3.id !== P2.id && rec(S, P1.id, P3.id).treaty >= T.WAR && rec(S, P2.id, P3.id).treaty < T.WAR) D.startWar(S, P2.id, P3.id, 'alliance');
    }
  }

  // ══════════════════════════════════════ AI → HUMAN DIPLOMACY — research/05 §4.6, research/08 §8 ═══════════════════════════════════════
  const fleetsHeadingTo = (S, aId, hId) => { for (const f of S.fleets) if (f.owner === aId && f.star < 0 && f.to >= 0 && S.planets[f.to] && S.planets[f.to].owner === hId) return true; return false; };
  function sweetenerOffer(S, R, H, A, prodH, prodA) {                                                       // AI adds BC (75 %) or a tech (25 %) to its own NAP/alliance offer
    if (!(prodA > 0) || A.personality <= 1 || rnd(R, 100) > tdiv(prodH * 30, prodA) || rnd0(R, 8) !== 0) return null;
    if (rnd0(R, 4) !== 0) return { bc: tdiv(tdiv(prodA, rnd(R, 3) + 1) + year(S), 25) * 25 };
    const c = D.techCandidates(S, A, H, { noNewest: true });
    if (!c.length) return null;
    const t = c[rnd0(R, c.length)]; return { tech: { field: t.field, level: t.level, name: t.name } };
  }
  // stage E of the proposal generator: the AI's tech-swap offer. In v1.3 its value filter only passes on EXACT equality, so it practically never fires (research/08 §8.3).
  function techSwapOffer(S, R, H, A, r, ra, ex) {
    const di0 = r.moodTech > 0 ? Math.min(tdiv(r.moodTech, 5), 30) : Math.min(r.moodTech, 30);
    const x0 = r.trust + tdiv(r.rel1, 2) + (A.race === 'human' ? raceMod(A, 'aiMoodBonus') : 0) + 2 * reldiff(S, A.id) + di0 + (r.treaty === T.ALLIANCE ? 25 : 0);
    if (!(x0 + rnd(R, 100) + r.moodTrade > 25)) return false;
    const want = D.techCandidates(S, H, A, {});
    if (!want.length) return false;
    const w = want[rnd0(R, want.length)], x = x0 + rnd(R, 100) - 125, fx = x < 0 ? tdiv(-x + 100, 4) : tdiv(tdiv(20000, x + 200), 4);
    if (fx <= 0) return false;
    const zval = tdiv(techValue(w.tech, ownedTiers(A)) * 100, Math.min(50, fx));
    const offers = D.techCandidates(S, A, H, { noNewest: true, minValue: zval }).filter(o => o.value <= zval);
    if (!offers.length) return false;
    ex.swap = { want: { field: w.field, level: w.level, name: w.name }, offers: offers.slice(0, 4).map(o => ({ field: o.field, level: o.level, name: o.name })) };
    r.moodTech = 0; ra.moodTech = 0;
    return true;
  }
  function proposals(S, R, H, A, r, ex) {                                                                   // stages A–G of research/05 §4.6.2 (the first that fires wins)
    if (!r.contact || r.treaty >= T.WAR || fleetsHeadingTo(S, A.id, H.id)) { r.dipType = 0; return; }
    if (r.dipType !== 0 && rnd0(R, 2) === 0) return;                                                       // an already queued message survives half the time
    const v = r.trust + r.rel1 + askBonus(S, H.id) + reldiff(S, A.id), ra = rec(S, A.id, H.id);
    const prodH = D.production(S, H.id), prodA = D.production(S, A.id);
    let type = 0;
    if (r.treaty === T.NONE && r.rel1 > 15 && v + rnd(R, 100) + r.moodTreaty > 50) type = 24;
    if ((r.treaty === T.NAP || type === 24) && r.rel1 > 50 && v + rnd(R, 100) + r.moodTreaty > 100) type = 25;
    if (!type && v + rnd(R, 150) + r.moodTrade > 50) {
      const n = tdiv(tdiv(Math.min(prodH, prodA), 4), 25), want = n >= 1 ? rnd(R, n) * 25 : 0;
      if (r.trade < want) { type = 26; ex.wantTrade = want; }
    }
    if (!type && rnd0(R, 10) === 0 && !ra.bounty) {                                                         // bounty on one of the AI's enemies
      let x = -1; for (const E of S.empires) if (E.alive && E.id !== H.id && E.id !== A.id && rec(S, A.id, E.id).treaty >= T.WAR && rec(S, H.id, E.id).contact) x = E.id;
      if (x >= 0) {
        const c = D.techCandidates(S, A, H, {}).filter(t => topLevels(A, t.field, 2).indexOf(t.level) < 0), t = c.length ? c[rnd0(R, c.length)] : null;
        ex.bounty = { x, bc: tdiv((rnd(R, 3) + 1) * year(S), 50) * 50, field: t ? t.field : -1, level: t ? t.level : 0, name: t ? t.name : '' }; type = 28;
      }
    }
    if (!type && techSwapOffer(S, R, H, A, r, ra, ex)) type = 29;
    if (!type && r.rel1 < 0 && prodH > prodA && r.treaty === T.NONE) type = 24;                              // a weaker hostile AI sues the stronger human for a pact (research/08 §8.3 item 6)
    if (type === 24 || type === 25) ex.offer = sweetenerOffer(S, R, H, A, prodH, prodA);
    if (type) r.dipType = type;
  }
  function callToArms(S, R, H, A, r, ex) {
    if (r.treaty !== T.ALLIANCE || rnd0(R, 10) !== 0) return;
    let x = -1;
    for (const E of S.empires) if (E.alive && E.id !== H.id && E.id !== A.id && rec(S, A.id, E.id).treaty >= T.WAR && rec(S, H.id, E.id).contact && rec(S, H.id, E.id).treaty < T.WAR) x = E.id;
    if (x >= 0) { r.dipType = 76; ex.target = x; }
  }
  // reaction to an offence of this turn / peace feeler (research/05 §4.6.4): warning → final warning (treaty cancelled) → war
  function reaction(S, R, H, A, r, ex) {
    const v = r.trust + r.rel1 + askBonus(S, H.id) + reldiff(S, A.id), dA = reldiff(S, A.id);
    if (r.treaty < T.WAR) {
      if (r.rel1 <= -95) { D.startWar(S, A.id, H.id, 'hatred'); r.dipType = 13; return; }
      if (v - rnd(R, 100) + r.moodTreaty <= -100) {
        if (r.hatred > 0) {
          r.hatred++;
          if (r.hatred > 2 || r.treaty === T.NONE) { if (rnd(R, 100) < -(tdiv(dA, 2) + r.dipVal)) { D.startWar(S, A.id, H.id, 'hatred'); r.dipType = 13; r.hatred = 1; } }
          else { r.dipType += 46; D.breakTreaty(S, A.id, H.id); }
        } else { r.hatred = 1; if (r.treaty === T.NAP || r.treaty === T.ALLIANCE || r.trade !== 0) r.dipType += 38; }
      }
    } else if (v + rnd(R, 100) + r.moodPeace >= 50 && rnd0(R, 8) === 0) {                                  // the war-weary AI offers peace, maybe with a sweetener
      r.dipType = 30;
      const prodH = D.production(S, H.id), prodA = D.production(S, A.id);
      if (prodH > 0 && rnd(R, 100) <= tdiv(prodA * 30, prodH)) {
        if (rnd0(R, 4) !== 0) ex.offer = { bc: tdiv(tdiv(prodA, rnd(R, 3) + 1) + year(S), 25) * 25 };
        else { const c = D.techCandidates(S, A, H, { noNewest: true }); if (c.length) { const t = c[rnd0(R, c.length)]; ex.offer = { tech: { field: t.field, level: t.level, name: t.name } }; } }
      }
    }
  }
  function dispatch(S, R, H, A, out) {
    const r = rec(S, H.id, A.id), ra = rec(S, A.id, H.id), ex = {};
    if (r.treaty === T.FINAL_WAR || r.dipType === 59) { if (r.dipType !== 59) r.dipType = 0; }
    else if (r.met === 1) { r.met = 2; r.dipType = 14 + (A.personality | 0); }                              // first-contact greeting
    else if (ra.bounty && ra.bounty.collect) r.dipType = 58;                                                // the AI pays out its bounty
    else if (r.dipType === 13 || r.dipType === 32 || r.dipType === 60 || r.dipType === 61) { /* war / cancellation already decided this turn */ }
    else {
      const m = minMood(r), v2 = m + r.trust + reldiff(S, A.id), dv2 = 2 * r.dipVal;
      if (v2 <= -100 || m <= -100) r.dipType = 0;                                                           // "diplomat gone": says nothing
      else if (r.dipVal < 0) { if (r.hatred > 0 || rnd(R, 100) < Math.abs(dv2)) reaction(S, R, H, A, r, ex); else r.dipType = 0; }
      else if (r.treaty === T.WAR && rnd(R, 100) + 30 < r.moodPeace) reaction(S, R, H, A, r, ex);
      else if (rnd(R, 100) < dv2 + (r.hatred === 0 ? 3 : 0) && rnd0(R, 4) === 0) { if (r.hatred > 0) r.hatred = 0; else proposals(S, R, H, A, r, ex); }
      else { r.dipType = 0; callToArms(S, R, H, A, r, ex); }                                                 // sub2: nothing queued unless an ally calls for help
    }
    if (r.dipType === 0) warCheck(S, R, H.id, A.id);
    if (r.dipType === 2 && rnd0(R, 10) !== 0) r.dipType = 0;
    // proposals ordered by AI planners (orders `diplomacy/propose` towards a human) are delivered when nothing else is queued
    if (r.dipType === 0 && S.diplo.inbox.length) {
      const k = S.diplo.inbox.findIndex(m => m.from === A.id && m.to === H.id);
      if (k >= 0) {
        const m = S.diplo.inbox.splice(k, 1)[0];
        if (m.kind === 'nap' && r.treaty === T.NONE) r.dipType = 24;
        else if (m.kind === 'alliance' && (r.treaty === T.NONE || r.treaty === T.NAP)) r.dipType = 25;
        else if (m.kind === 'trade' && r.treaty < T.WAR) { r.dipType = 26; ex.wantTrade = (m.bc | 0) || tdiv(Math.min(D.production(S, H.id), D.production(S, A.id)), 100) * 25; }
        else if (m.kind === 'peace' && r.treaty === T.WAR) r.dipType = 30;
      }
    }
    if (r.dipType) buildAudience(S, H, A, r, r.dipType, ex, out);
  }

  // ── audiences as interrupts ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  // {type:'diplomacy', from(AI), to(human), kind, msgType, greeting?, text:{personality,situation,vars,msgType}, options:[{id,label}], info, answer(choice)}
  // The UI shows greeting (if any) then text, offers `options`, and returns the chosen option id (undefined = the default "yes"). Multi-step audiences (demand to
  // break an alliance, "what if we also offered…", ally reactions) are chained: answer() inserts the follow-up interrupt right behind the current one.
  const OK_OPT = [{ id: 'ok', label: 'OK' }], AR_OPT = [{ id: 'accept', label: 'Accept' }, { id: 'reject', label: 'Reject' }];
  const yes = c => c === undefined || c === null || c === true || c === 'accept' || c === 'agree' || c === 'yes' || c === 'ok' || (typeof c === 'string' && c.indexOf('swap') === 0);
  D.yes = yes;
  const mk = (S, H, A, kind, type, sit, vars, options, extra) => Object.assign({ type: 'diplomacy', from: A.id, to: H.id, kind, msgType: type, text: say(S, A.id, H.id, sit || D.situation(type), vars, type), options: options || OK_OPT }, extra || {});
  const insertAfter = (out, cur, next) => { const i = out.indexOf(cur); if (i < 0) out.push(next); else out.splice(i + 1, 0, next); };
  const greet = (S, H, A) => say(S, A.id, H.id, 'greeting', {}, 22);
  function creditOffer(S, H, A, offer) {                                                                    // the AI's sweetener actually changes hands
    if (!offer) return null;
    if (offer.bc) { const pay = Math.min(offer.bc, Math.max(0, A.bc)); A.bc -= pay; H.bc += pay; return { bc: pay }; }
    if (offer.tech && !owns(H, offer.tech.field, offer.tech.level)) { giveTech(S, H.id, offer.tech.field, offer.tech.level, 'trade'); return { tech: offer.tech }; }
    return null;
  }
  // after EVERY AI-initiated proposal: −10 on all moods, plus −20..100 on its own topic (even if you accepted)
  function finishAudience(S, H, A, type) {
    const R = RR(S), r = rec(S, H.id, A.id);
    annoy(r, 1);
    if (type === 24 || type === 25) r.moodTreaty -= rnd(R, 30) + 20;
    else if (type === 26) r.moodTrade -= rnd(R, 30) + 20;
    else if (type === 29) r.moodTech -= rnd(R, 30) + 20;
    else if (type === 30) r.moodPeace -= rnd(R, 50) + 50;
  }
  function proposalFlow(S, H, A, spec, out) {
    const info = Object.assign({ treatyName: spec.treatyName }, spec.info || {});
    const first = mk(S, H, A, spec.kind, spec.type, spec.sit, spec.vars, spec.options || AR_OPT, { greeting: spec.noGreeting ? null : greet(S, H, A), info, offer: spec.offer || null });
    first.answer = function (c) {
      if (yes(c)) { spec.apply(c, null); finishAudience(S, H, A, spec.type); return; }
      if (spec.offer) {                                                                                      // "What if we also offered …?"
        const second = mk(S, H, A, spec.kind, spec.type, spec.sit, spec.vars, spec.options || AR_OPT, { incentive: spec.offer, info, offer: spec.offer });
        second.answer = c2 => { if (yes(c2)) spec.apply(c2, spec.offer); finishAudience(S, H, A, spec.type); };
        insertAfter(out, first, second); return;
      }
      finishAudience(S, H, A, spec.type);
    };
    out.push(first);
    return first;
  }
  function buildAudience(S, H, A, r, type, ex, out) {
    const proposalLike = (type >= 24 && type <= 30) || type === 58 || type === 76;
    // an ally of the human that is at war with the AI must be dropped first (type 27) before any proposal/request is heard
    const foe = proposalLike ? S.empires.find(e => e.alive && e.id !== A.id && e.id !== H.id && rec(S, H.id, e.id).treaty === T.ALLIANCE && rec(S, A.id, e.id).treaty >= T.WAR) : null;
    if (!foe) { buildProposal(S, H, A, r, type, ex, out, false); return; }
    const demand = mk(S, H, A, 'demandBreak', 27, 'threaten', { race3: foe.plural, leader3: foe.leader }, [{ id: 'agree', label: 'Agree' }, { id: 'forget', label: 'Forget It' }], { greeting: greet(S, H, A), info: { target: foe.id } });
    const tmp = []; buildProposal(S, H, A, r, type, ex, tmp, true);
    demand.answer = c => {
      if (yes(c)) { D.breakTreaty(S, H.id, foe.id); let at = demand; for (const p of tmp) { insertAfter(out, at, p); at = p; } }
      else { setRel(S, H.id, A.id, -100); if (type === 76) D.breakTreaty(S, A.id, H.id); }              // "Forget it": the audience ends in fury
    };
    out.push(demand);
  }
  function buildProposal(S, H, A, r, type, ex, out, noGreeting) {
    const R = RR(S), tn = D.TREATY_NOUN;
    switch (type) {
      case 24: case 25: {
        const kind = type === 24 ? 'nap' : 'alliance', want = type === 24 ? T.NAP : T.ALLIANCE;
        proposalFlow(S, H, A, { kind: type === 24 ? 'offerNap' : 'offerAlliance', type, noGreeting, vars: { treaty: tn[want] }, offer: ex.offer || null, treatyName: tn[want],
          apply: (c, offer) => { const q = rec(S, H.id, A.id).treaty; if (type === 24 ? q === T.NONE : (q === T.NONE || q === T.NAP)) applyAccepted(S, R, H.id, A.id, { kind }); creditOffer(S, H, A, offer); } }, out);
        return;
      }
      case 26: {
        const bc = ex.wantTrade | 0;
        proposalFlow(S, H, A, { kind: 'offerTrade', type, noGreeting, vars: { bc, treaty: 'trade agreement' }, info: { bc }, treatyName: 'trade agreement',
          apply: () => { if (bc > 0 && rec(S, H.id, A.id).treaty < T.WAR) applyAccepted(S, R, H.id, A.id, { kind: 'trade', bc }); } }, out);
        return;
      }
      case 29: {
        const sw = ex.swap; if (!sw) return;
        const opts = sw.offers.map(o => ({ id: 'swap:' + o.field + ':' + o.level, label: o.name, field: o.field, level: o.level })).concat([{ id: 'reject', label: 'Reject' }]);
        proposalFlow(S, H, A, { kind: 'techSwap', type, noGreeting, vars: { tech: sw.offers[0].name }, options: opts, info: { want: sw.want, offers: sw.offers },
          apply: c => {
            const pick = typeof c === 'string' && c.indexOf('swap:') === 0 ? c.split(':') : null;
            const o = pick ? sw.offers.find(x => x.field === +pick[1] && x.level === +pick[2]) : sw.offers[0];
            if (o && owns(H, sw.want.field, sw.want.level) && !owns(A, sw.want.field, sw.want.level) && !owns(H, o.field, o.level)) { giveTech(S, A.id, sw.want.field, sw.want.level, 'trade'); giveTech(S, H.id, o.field, o.level, 'trade'); log(S, 'techSwap', H.id, A.id); }
          } }, out);
        return;
      }
      case 30: {
        proposalFlow(S, H, A, { kind: 'askPeace', type, noGreeting, offer: ex.offer || null, treatyName: 'peace',
          apply: (c, offer) => { if (rec(S, H.id, A.id).treaty === T.WAR) { D.stopWar(S, A.id, H.id); const q = rec(S, H.id, A.id); if (q.rel1 < 80) setRel(S, H.id, A.id, q.rel1 + 20); annoy(q, 2); } creditOffer(S, H, A, offer); } }, out);
        return;
      }
      case 28: {                                                                                             // bounty offer: informational, remembered until earned
        const b = ex.bounty;
        const p = mk(S, H, A, 'bounty', 28, 'callForAid', { race3: S.empires[b.x].plural, tech: b.name, bc: b.bc }, OK_OPT, { greeting: noGreeting ? null : greet(S, H, A), info: { target: b.x, bc: b.bc, tech: b.field >= 0 ? { field: b.field, level: b.level, name: b.name } : null } });
        rec(S, A.id, H.id).bounty = { x: b.x, bc: b.bc, field: b.field, level: b.level, name: b.name, collect: false };
        p.answer = () => finishAudience(S, H, A, 28);
        out.push(p); return;
      }
      case 58: {                                                                                             // the AI pays what it promised (in v1.3 the payment itself never happens)
        const ra = rec(S, A.id, H.id), b = ra.bounty; ra.bounty = null;
        let paid = null;
        if (b && D.CFG.bountyPaid) {
          if (b.field >= 0 && !owns(H, b.field, b.level)) { giveTech(S, H.id, b.field, b.level, 'trade'); paid = { tech: b.name }; } else paid = creditOffer(S, H, A, { bc: b.bc });
        }
        const p = mk(S, H, A, 'bountyPaid', 58, paid && paid.tech ? 'offerTech' : 'payTribute', { bc: b ? b.bc : 0, tech: b ? b.name : '' }, OK_OPT, { greeting: noGreeting ? null : greet(S, H, A), info: { paid, target: b ? b.x : -1 } });
        p.answer = () => finishAudience(S, H, A, 58);
        out.push(p); return;
      }
      case 76: {
        const x = ex.target, X = S.empires[x];
        const p = mk(S, H, A, 'callToArms', 76, 'callForAid', { race3: X.plural }, [{ id: 'agree', label: 'Agree' }, { id: 'refuse', label: 'Forget It' }], { greeting: noGreeting ? null : greet(S, H, A), info: { target: x } });
        p.answer = c => {
          if (yes(c)) { D.declareWar(S, H.id, x, 'ally request'); insertAfter(out, p, mk(S, H, A, 'allyThanks', 78, 'thanksGift', {}, OK_OPT)); }
          else { D.breakTreaty(S, A.id, H.id); insertAfter(out, p, mk(S, H, A, 'allyBreaks', 77, 'breakTreaty', { treaty: 'alliance' }, OK_OPT)); }
          finishAudience(S, H, A, 76);
        };
        out.push(p); return;
      }
      default: {
        // informational audiences: greetings, complaints, warnings, war declarations, treaty cancellations, thanks
        const vars = {}, rr = rec(S, H.id, A.id);
        if ((type >= 4 && type <= 12) || (type >= 42 && type <= 57)) { const sp = rr.dipP1; vars.star = sp >= 0 && S.stars[sp] ? S.stars[sp].name : ''; }
        if (type === 32 || (type >= 50 && type <= 57)) vars.treaty = tn[rr.broken || 1];
        const kind = type >= 14 && type <= 19 ? 'firstContact' : type === 13 || type === 60 || type === 61 ? 'warDeclared' : type === 32 || (type >= 50 && type <= 57) ? 'treatyCancelled' : type >= 42 && type <= 49 ? 'warning' : type >= 4 && type <= 12 ? 'complaint' : 'message';
        const p = mk(S, H, A, kind, type, null, vars, OK_OPT, { info: { offence: type >= 42 && type <= 49 ? type - 38 : type >= 50 && type <= 57 ? type - 46 : type, planet: rr.dipP1, hatred: rr.hatred, treaty: rr.treaty } });
        p.answer = () => {};
        out.push(p);
      }
    }
  }
  function humanTurn(S, R, out) {
    for (const H of S.empires) {
      if (!H.alive || !H.human) continue;
      for (const A of S.empires) {
        if (!A.alive || A.human || A.id === H.id) continue;
        const r = rec(S, H.id, A.id);
        r.moodTreaty = clamp(r.moodTreaty, -200, 120);                                                      // game_diplo_limit_mood_treaty at the start of the AI→human phase
        if (!r.contact && r.met !== 1) continue;
        dispatch(S, R, H, A, out);
      }
    }
  }
  // end of the diplomacy phase: every mood below 100 recovers +10
  function relax(S) {
    for (const E of S.empires) for (const r of E.relations) if (r.with !== E.id) for (const k of MOODS) if (r[k] < 100) r[k] += 10;
  }
  D.turn = function (S, R) {
    ensure(S); R = R || RR(S);
    drainIncidents(S);
    D.updateContact(S, false);
    const out = [];
    if (!S.diplo.finalWar) { aiAiTurn(S, R); humanTurn(S, R, out); }
    S.diplo.inbox = [];
    trackOwners(S);
    relax(S);
    return out;
  };


  // ══════════════════════════════════════ FINAL WAR (Council helpers) — research/05 §6.5 ═══════════════════════════════════════════════
  // The Council module calls finalWar(S, refusers) when a human defies the ruling. Every pair with the same stance becomes allied (+100), every mixed pair is at
  // FINAL WAR (−100, trade ends); audiences are disabled; each turn the techs of each side are pooled (refusers only share among themselves).
  D.applyFinalWarTreaties = function (S) {
    const ref = new Set((S.diplo && S.diplo.refusers) || []), live = S.empires.filter(e => e.alive);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i].id, b = live[j].id;
      if (ref.has(a) === ref.has(b)) { setTreatyRaw(S, a, b, T.ALLIANCE); setRel(S, a, b, 100); }
      else { D.breakTrade(S, a, b); setTreatyRaw(S, a, b, T.FINAL_WAR); setRel(S, a, b, -100); }
    }
  };
  D.finalWar = function (S, refusers) {
    ensure(S);
    S.diplo.finalWar = true; S.diplo.refusers = (refusers || []).slice();
    D.applyFinalWarTreaties(S);
    log(S, 'finalWar', S.diplo.refusers[0] === undefined ? -1 : S.diplo.refusers[0], -1);
    return true;
  };
  D.finalWarShare = function (S) {
    if (!S.diplo || !S.diplo.finalWar) return 0;
    D.applyFinalWarTreaties(S);
    const ref = new Set(S.diplo.refusers || []), R = M.Sim.Research; let granted = 0;
    if (!R || !R.grant) return 0;
    for (const side of [S.empires.filter(e => e.alive && !ref.has(e.id)), S.empires.filter(e => e.alive && ref.has(e.id))]) {
      if (side.length < 2) continue;
      for (let f = 0; f < 6; f++) {
        const union = new Set();
        for (const e of side) for (const l of e.research.completed[f]) union.add(l);
        for (const e of side) for (const l of union) if (!owns(e, f, l) && R.grant(S, e, f, l, 'finalWar')) granted++;
      }
    }
    return granted;
  };

  // ══════════════════════════════════════ ORDERS — {t:'diplomacy', to, act, …} ═══════════════════════════════════════════════════════
  // One entry point for the UI (scripted/AI use) and for AI planners. Audience details (menus, counters) stay in the functions above.
  function aiPropose(S, R, x, a, o) {                                                                       // an AI asks another AI: the mood formula decides, no counters
    const r = rec(S, x, a), kind = o.kind;
    let prop = { kind }, a0 = 50, mood = 'treaty';
    if (kind === 'nap') { if (r.treaty !== T.NONE || r.rel1 <= 10) return O.ok({ accepted: false, gate: true }); }
    else if (kind === 'alliance') { if ((r.treaty !== T.NONE && r.treaty !== T.NAP) || r.rel1 <= 50) return O.ok({ accepted: false, gate: true }); a0 = 125; }
    else if (kind === 'peace') { if (r.treaty !== T.WAR) return O.fail('not at war'); a0 = 60; mood = D.CFG.peaceUsesTreatyMood ? 'treaty' : 'peace'; }
    else if (kind === 'trade') {
      if (r.treaty >= T.WAR) return O.fail('at war');
      const lv = D.tradeLevels(S, x, a); if (!lv.length) return O.fail('no trade headroom');
      prop.bc = lv.indexOf(o.bc) >= 0 ? o.bc : lv[lv.length - 1]; mood = 'trade';
    } else return O.fail('unsupported proposal');
    const res = checkMood(S, R, x, a, a0, mood);
    if (kind === 'peace') annoy(r, 2);
    if (kind === 'trade') { annoy(r, 1); r.moodTrade -= rnd0(R, 30) + 1; }
    if (res !== 3) return O.ok({ accepted: false, result: res });
    return O.ok({ accepted: true, effects: applyAccepted(S, R, x, a, prop) });
  }
  O.register('diplomacy', function (S, E, o) {
    ensure(S);
    const to = o.to | 0, id = E.id, R = RR(S);
    if (!(to >= 0 && to < S.empires.length) || to === id || !S.empires[to].alive) return O.fail('no such empire');
    const r = rec(S, id, to), human = !!E.human, targetHuman = isHuman(S, to), unwrap = x => (x && x.ok === false ? O.fail(x.msg || 'refused') : Object.assign({ ok: true }, x));
    switch (o.act) {
      case 'declareWar':
        if (human) return O.fail('a human cannot declare war directly (use a threat)');
        if (r.treaty >= T.WAR) return O.fail('already at war');
        return D.declareWar(S, id, to, o.reason || 'order') ? O.ok() : O.fail('could not declare war');
      case 'breakTreaty': {
        if (r.treaty !== T.NAP && r.treaty !== T.ALLIANCE) return O.fail('no treaty to break');
        const old = r.treaty;
        if (human) return unwrap(D.propose(S, id, to, { kind: 'breakTreaty' }));
        D.breakTreaty(S, id, to);                                                                           // an AI cancels (e.g. before attacking a partner's planet)
        if (o.expand) {
          if (targetHuman) rec(S, to, id).dipType = 32;                                                     // "we are breaking our treaty to expand"
          const cap = o.cap !== undefined ? o.cap : old === T.ALLIANCE ? 30 : 20;
          if (rec(S, id, to).rel1 > cap) setRel(S, id, to, cap);
        }
        return O.ok({ broke: old });
      }
      case 'breakTrade':
        if (!(r.trade > 0)) return O.fail('no trade agreement');
        if (human) return unwrap(D.propose(S, id, to, { kind: 'breakTrade' }));
        D.breakTrade(S, id, to); return O.ok();
      case 'peace': return O.apply(S, id, Object.assign({}, o, { act: 'propose', kind: 'peace' }));
      case 'propose': {
        const kind = o.kind;
        if (human) {
          if (targetHuman) return O.fail('no AI to ask');
          const map = { nap: 'nap', alliance: 'alliance', peace: 'peace', trade: 'trade' };
          if (!map[kind]) return O.fail('unsupported proposal');
          return unwrap(D.propose(S, id, to, { kind, bc: o.bc }));
        }
        if (!r.contact) return O.fail('no contact');
        if (targetHuman) { S.diplo.inbox.push({ from: id, to, kind, bc: o.bc | 0 }); return O.ok({ queued: true }); }
        return aiPropose(S, R, id, to, o);
      }
      case 'tribute': {
        if (!r.contact) return O.fail('no contact');
        if (human) return unwrap(D.propose(S, id, to, o.bc ? { kind: 'tributeBC', bc: o.bc, index: o.index } : { kind: 'tributeTech', field: o.field, level: o.level }));
        if (o.bc) {                                                                                         // AI gift of BC: money moves, no relation effect (v1.3)
          const bc = Math.min(o.bc | 0, Math.max(0, E.bc)); if (bc <= 0) return O.fail('nothing to give');
          E.bc -= bc; S.empires[to].bc += bc; news(S, 'tributePaid', id, to, { bc }); return O.ok({ bc });
        }
        const out = tributeTech(S, R, id, to, { field: o.field, level: o.level });
        return out.ok === false ? out : O.ok(out);
      }
      case 'threaten': return human && !targetHuman && r.treaty < T.WAR ? unwrap(D.propose(S, id, to, { kind: 'threat' })) : O.fail('not available');
    }
    return O.fail('unknown diplomacy act: ' + o.act);
  });

  // ══════════════════════════════════════ ALIASES / EXPORTS ═════════════════════════════════════════════════════════════════════════════
  D.hostile = D.canFight;
  D.rec = rec;                                                                                              // the relation record of a about b (read-only use)
  D.setRel = setRel;
  D.VERSION = 1;
  D._ = { checkMood, sweeten, warCheck, warDo, aiAiTurn, dispatch, proposals, reaction, humanTurn, aiTechSwap, diploAdjust, threaten, tributeTech, tributeBC, relax, buildAudience, trackOwners, envy, bandStat, bandStatBug, aiPropose };   // internals exposed for tools/rules/60-diplo.test.js
});
