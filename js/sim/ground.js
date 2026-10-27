// Ground war — orbital bombardment, the transports gauntlet, ground combat, conquest, rebellion.
// Sources: research/03 §5.2–5.3 (bio weapons, bombardment), §7 (transports, land combat, after the battle); research/04 §3.13, §6.2 (transports, rebellion);
// research/02 §5 (ground force) + §1.10 (tech capture); research/01 §4.5 (Bulrathi); research/05 §4.2.3, §5.4–5.5 (incident sizes, tech candidates, incite).
// Worker-safe. Randomness only through the generator R (default: MOO.RNG.bind(S.rs)); the same seed always gives the same war.
//
// MOO.Sim.Ground
//   force(S,E,isDefender) → int            5·armor + 10·suit + 10·shield + 5·weapon′ (+25 Bulrathi) (+5 defender); forceParts(...) → {armor,suit,shield,weapon,race,defender,total}
//   exchange(fa,fd) → {pa,pt,pd}           exact odds of one exchange (d100+fa vs d100+fd): attacker wins / tie / defender wins
//   odds(fa,fd,nA,nD[,opts]) → {pWin,expAttackers,expDefenders}   exact win chance + expected survivors of a whole fight (the AI's and the UI's odds)
//   fight(nA,nD,fa,fd,R[,opts]) → {a,d,exchanges,rounds}   the combat core: each exchange both sides roll d100+force, the loser of the exchange loses ONE trooper,
//                                          ties go to the defender; rounds = [{a,d}] troop counts after sampled exchanges (first = start, last = end, ≤160 entries)
//   gauntlet(S,landing) → {…}              EXPECTED outcome of the transports' run past bases and warships (no RNG)       runGauntlet(S,landing,R) rolls it
//   resolve(S,landing,R) → record|null     PURE: gauntlet → 300 cap → ground combat → capture plan (tech theft rolled); S is not changed
//   invade(S,landing,R[,all]) → record|null  resolve + apply (owner change, bookkeeping, tech grants, news, incidents, empire-death hook). turn.js yields {type:'ground',result}
//                                          for every non-null return, so the record only comes back when a human is involved (all = true: AI-vs-AI fights too)
//   reclaim(S,landing,R) → record|null     loyal transports landing on their own REBELLING planet fight the rebels (also run from bombard() before the transports land)
//   estimate(S,attacker,planet,n) → {…}    gauntlet + force + exact odds for an invasion that has not been launched (AI / UI)
//   bombPreview(S,empire,planet) → {…}     what the "Bomb?" prompt shows: pop, factories, bases, shield, expected kills            canBombard(S,empire,planet) → {ok,reason,…}
//   bombard(S,R[,all]) → events[]          the bombardment phase (see BOMBARDMENT below; events only for fights a human is part of unless all); setBombard(S,e,p,yes)
//   pending(S[,empire]) → [{type:'bombardPrompt',empire,planet,preview}]   the unanswered human prompts — the pipeline asks, answers with the `bombard` order, THEN calls bombard()
//   aiBombs(S,E,planet) · inbound(S,empire,planet) · bombTargets(S,empire)   the AI's rule (pop > its own inbound transports × invasion estimate) and queries
//   techCandidates(S,thief,victim[,R,opts]) → [{field,level,id,name,value}]   up to 6 random distinct stealable techs (shared with Spy / Diplo tribute)
//   stealTechs(S,thief,victim,count,R,source[,opts]) · theftRolls(factories,R)  grant them / the 1-in-50-per-factory capture rolls
//   rebelState(p) · rebels(p) · unrest(p) · startRebellion(S,p[,rebels]) · incite(S,p,n) · coupCheck(S) → [{empire,rebelling,planets,human}] · applyCoup(S,empire,R)
//   capture(S,planet,newOwner,troops) · destroyPlanet(S,planet)            the two ownership changes (also useful for events/monsters)
//   RULES / DEFAULT_RULES / CLASSIC_RULES / useRules(r)                   switches between the intended behaviour (default) and the shipped v1.3 quirks
//
// RECORD (UI): {attacker,defender,planet,star,planetName,attackerRace,defenderRace,attackerHuman,defenderHuman,visible (a human is involved — turn.js/UI should only
//   show visible ones: invade()/bombard() already return only those), sent,killed,recovered,arrived (survivors of the gauntlet),landed (≤300),overflow (lost to the 300 cap),defenders,defendersLeft,force:{a,d},
//   rounds,exchanges,survivors,captured:{factories,techs:[{field,level,id,name}]},theftRolls,success,rebellion,eliminated,gauntlet:{hp,speed,level,comp,bases,monster,…}}
//
// BOMBARDMENT — S.bombard = [{empire,planet,yes?}] (planet = planet id = star id; written by Combat.applyResults and/or by the `bombard` order); fleets in orbit over a
//   non-allied planet are also discovered here, so a parked fleet over a defenceless world still bombs. yes:true → bomb, yes:false → cancel, undefined → the AI decides
//   (pop > own inbound transports × race invasion estimate; never an ally, never a NAP partner) and a HUMAN is asked (RULES.humanBombard 'ask' leaves the entry pending;
//   'yes' / 'no' answer for him). Events returned: {type:'bombard',…} per bombardment, {type:'ground',result} per rebel reclaim (human involved). Ev gets a `notice`
//   {kind:'bombarded'} for a human victim, news (`bombardment`,
//   `planetDestroyed`, `invasionSuccess`, `invasionRepelled`, `planetRebels`) and relations incidents {type:'incident',kind,from,to,…} that Diplo.turn drains (its own vocabulary):
//   'combat' {popLost} (pop killed by bombs/beams/missiles) · 'bio' {bio,popLost} (also offends every other AI) · 'depopulate' (a human bombed an AI planet to zero → war) ·
//   'capture' (a human took an AI planet → −(50..100) and war) · 'popKilled' {magnitude = pop killed} (a human's failed landing) · 'aiGround' (AI against AI). Only AI victims are
//   offended. Genocide (an empire wiped out) is Diplo's/Events' own bookkeeping. Nothing here calls Diplo.incident directly, so nothing is counted twice.
//   S.groundTurn = {turn, landed:{'planet:empire':troops}} enforces the 300-troop cap across several landings of one turn; S.groundLog keeps the last 60 fights.
//   Rebel planets: transports of the OWNER arriving on a planet in rebellion are fought out in bombard() (it runs before Fleet.landTransports and zeroes t.n), so Fleet needs no change.
//
// DECISIONS where the research lists quirks (all switchable through RULES; CLASSIC_RULES restores the shipped v1.3 behaviour):
//   · bombardment uses all four weapon banks (v1.3: first three), halves TORPEDOES vs planets like tactical combat does (v1.3: plain missiles), takes the computer bonus
//     from the ships in orbit (v1.3: best of all designs) and shrinks max population only when the bombardment really happens (v1.3: even when the human cancels);
//   · the gauntlet's missile bases shoot with THEIR owner's computer, the best shooter computer counts (v1.3: transport owner's / last design above the speed);
//   · Combat Transporters work as documented: every lost transport lands with 1/2 (1/4 against a Subspace Interdictor) (v1.3: only vs an interdictor, 62.5%);
//   · ties in ground combat go to the defender (manual: both lose one; v1.3: the human-involved side flips) — 'both' and 'classic' are available;
//   · transport hit points (armor tier+1)·15 (printed guide table: 15,22,30,37,45,52,60 → RULES.transportHp = 'guide').
MOO.def(function (M) {
  'use strict';
  const G = M.Sim.Ground = {};
  const O = M.Sim.Orders;

  G.MAX_LANDING = 300;                                         // game_num_max_inbound: troops that can land on one planet per turn per attacker
  G.TECH_STEAL_MAX = 6;                                        // TECH_SPY_MAX
  G.TRANSPORT_HP = [15, 30, 45, 60, 75, 90, 105];              // (best armor tier + 1) × 15
  G.TRANSPORT_HP_GUIDE = [15, 22, 30, 37, 45, 52, 60];
  const SHOTS_PER_BASE = 24;                                   // a base's volleys at arriving transports (not scaled by transport speed)
  const MAX_ROUNDS = 160;

  const DEFAULT_RULES = {
    orbitalBanks: 4, orbitalTorpedoHalf: true, orbitalBestCompInOrbit: true, orbitalBioOnlyIfBombing: true,
    gauntletBaseComp: 'owner', gauntletCompLast: false, combatTransportersFixed: true, tie: 'defender', transportHp: 'code', humanBombard: 'ask',
  };
  const CLASSIC_RULES = {
    orbitalBanks: 3, orbitalTorpedoHalf: false, orbitalBestCompInOrbit: false, orbitalBioOnlyIfBombing: false,
    gauntletBaseComp: 'transport', gauntletCompLast: true, combatTransportersFixed: false, tie: 'classic', transportHp: 'code', humanBombard: 'ask',
  };
  const RULES = G.RULES = Object.assign({}, DEFAULT_RULES);
  G.DEFAULT_RULES = DEFAULT_RULES; G.CLASSIC_RULES = CLASSIC_RULES;
  G.useRules = function (r) { for (const k of Object.keys(RULES)) delete RULES[k]; Object.assign(RULES, DEFAULT_RULES, r || {}); return RULES; };

  // ---- helpers ------------------------------------------------------------------------------------------------------------------------------
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const idiv = (a, b) => Math.trunc(a / b);                    // the original's truncating integer division (operands are never negative here)
  const K = () => M.Data.Components;
  const isObj = v => v !== null && typeof v === 'object';
  const emp = (S, e) => (isObj(e) ? e : S.empires[e]);
  const eid = e => (isObj(e) ? e.id : e);
  const plan_ = (S, p) => (isObj(p) ? p : S.planets[p]);
  const rng = (S, R) => R || M.RNG.bind(S.rs);
  const push = (S, ev) => (M.Sim.Ev ? M.Sim.Ev.push(S, ev) : ev);
  const pname = (S, p) => p.name || (S.stars[p.starId] && S.stars[p.starId].name) || ('Planet ' + p.id);
  const mods = E => (E && E.mods) || {};
  const races = () => (M.Data.Races && M.Data.Races.races) || {};

  const allied = (S, a, b) => a === b || !!(M.Sim.Diplo && M.Sim.Diplo.isAllied && M.Sim.Diplo.isAllied(S, a, b));
  // 'none' | 'nap' | 'alliance' | 'war' — best effort over whatever the diplomacy module exposes (research/05 §2: 0 none, 1 NAP, 2 alliance, 3 war, 4 final war)
  function treatyOf(S, a, b) {
    const D = M.Sim.Diplo;
    if (!D || a === b) return 'none';
    if (D.isAllied && D.isAllied(S, a, b)) return 'alliance';
    if (D.atWar && D.atWar(S, a, b)) return 'war';
    const st = D.status ? D.status(S, a, b) : null, t = st ? (st.treaty !== undefined ? st.treaty : st.treatyName) : undefined;
    if (typeof t === 'string') { const s = t.toLowerCase(); return s === 'nap' || s.indexOf('aggression') >= 0 ? 'nap' : s.indexOf('allian') >= 0 ? 'alliance' : s.indexOf('war') >= 0 ? 'war' : 'none'; }
    if (t === 1) return 'nap'; if (t === 2) return 'alliance'; if (t === 3 || t === 4) return 'war';
    return 'none';
  }

  // =====================================================================================================================================
  // GROUND COMBAT (research/02 §5, research/03 §7.2, research/01 §4.5)
  // =====================================================================================================================================
  const raceBonus = E => {
    const rc = races()[E.race], b = rc && rc.mod && rc.mod.groundBonus;
    return b !== undefined ? b : (E.race === 'bulrathi' ? 25 : 0);
  };
  G.forceParts = function (S, E, isDefender) {
    E = emp(S, E);
    const g = mods(E).ground || {};
    const armor = 5 * clamp(g.armor | 0, 0, 6), suit = 10 * clamp(g.suit | 0, 0, 3), shield = 10 * clamp(g.shield | 0, 0, 3);
    const w = clamp(g.weapon | 0, 0, 5), weapon = 5 * (w <= 2 ? w : w + 1), race = raceBonus(E), defender = isDefender ? 5 : 0;
    const tech = (mods(E)[isDefender ? 'groundDef' : 'groundOff'] | 0);                  // expansion: Robotic Garrisons / Siege Engineering / Clone Troopers
    return { armor, suit, shield, weapon, race, defender, tech, total: armor + suit + shield + weapon + race + defender + tech };
  };
  G.force = (S, E, isDefender) => G.forceParts(S, E, isDefender).total;

  // one exchange: attacker rolls d100+fa, defender d100+fd; the attacker wins it iff his total is strictly higher
  G.exchange = function (fa, fd) {
    const k = fd - fa; let win = 0, tie = 0;
    for (let t = -99; t <= 99; t++) { const c = 100 - Math.abs(t); if (t > k) win += c; else if (t === k) tie += c; }
    return { pa: win / 10000, pt: tie / 10000, pd: (10000 - win - tie) / 10000 };
  };

  function sampleRounds(ra, rd) {
    const n = ra.length, out = [];
    if (n <= MAX_ROUNDS) { for (let i = 0; i < n; i++) out.push({ a: ra[i], d: rd[i] }); return out; }
    for (let k = 0; k < MAX_ROUNDS; k++) { const i = Math.round(k * (n - 1) / (MAX_ROUNDS - 1)); out.push({ a: ra[i], d: rd[i] }); }
    return out;
  }
  // opts: {tie:'defender'|'both'|'classic', human:bool (for 'classic'), rounds:false (skip the animation record)}
  G.fight = function (nA, nD, fa, fd, R, opts) {
    opts = opts || {};
    const tie = opts.tie || RULES.tie, rec = opts.rounds !== false;
    let a = Math.max(0, nA | 0), d = Math.max(0, nD | 0), ex = 0;
    const ra = rec ? [a] : null, rd = rec ? [d] : null;
    while (a > 0 && d > 0) {
      const v1 = R.int(1, 100) + fa, v2 = R.int(1, 100) + fd;
      if (v1 > v2) d--;
      else if (v1 < v2) a--;
      else if (tie === 'both') { a--; d--; }
      else if (tie === 'classic' && opts.human) d--;
      else a--;                                                // ties go to the defender
      ex++;
      if (rec) { ra.push(a); rd.push(d); }
    }
    return { a, d, exchanges: ex, rounds: rec ? sampleRounds(ra, rd) : null };
  };

  // exact distribution of a whole fight (dynamic programming over the troop counts; ≤ 300×300 states)
  G.odds = function (fa, fd, nA, nD, opts) {
    nA = Math.max(0, nA | 0); nD = Math.max(0, nD | 0);
    const e = G.exchange(fa, fd), tie = (opts && opts.tie) || RULES.tie;
    let pa = e.pa, pd = e.pd, pb = 0;
    if (tie === 'both') pb = e.pt; else if (tie === 'classic' && opts && opts.human) pa += e.pt; else pd += e.pt;
    const W = nD + 1, f = new Float64Array((nA + 1) * W);
    f[nA * W + nD] = 1;
    let win = 0, expA = 0, expD = 0;
    for (let a = nA; a >= 0; a--) {
      for (let d = nD; d >= 0; d--) {
        const q = f[a * W + d]; if (q === 0) continue;
        if (a === 0 || d === 0) { if (d === 0 && a > 0) { win += q; expA += q * a; } else if (a === 0 && d > 0) expD += q * d; continue; }
        f[a * W + d - 1] += q * pa; f[(a - 1) * W + d] += q * pd; if (pb) f[(a - 1) * W + d - 1] += q * pb;
      }
    }
    return { pWin: win, expAttackers: expA, expDefenders: expD, pa, pd };
  };

  // =====================================================================================================================================
  // THE TRANSPORTS' GAUNTLET (research/03 §7.1)
  // =====================================================================================================================================
  const speedOf = E => Math.max(1, (mods(E).transportSpeed | 0) || 1);
  G.transportSpeed = speedOf;
  G.transportHp = E => (RULES.transportHp === 'guide' ? G.TRANSPORT_HP_GUIDE : G.TRANSPORT_HP)[clamp(mods(E).baseHp | 0, 0, 6)];
  function bestComp(S, E) {                                    // Mark number of the best battle computer the empire owns
    const m = mods(E).baseComp; if (m) return m | 0;
    const D = M.Sim.Design;
    if (D && D.baseLoadout) { const b = D.baseLoadout(S, E); if (b.comp >= 0) return K().COMPUTERS[b.comp].level; }
    return 1;
  }
  function monsterAt(S, p) {
    if (S.guardian && S.guardian.alive && (S.guardian.star === p.starId || p.special === 'orion')) return 'guardian';
    const st = S.stars[p.starId];
    for (const m of (S.monsters || [])) {
      if (!m || m.exists === false || m.alive === false || m.dead || m.killer >= 0) continue;
      if (m.star === p.starId || m.at === p.starId || (st && m.x === st.x && m.y === st.y)) return 'monster';
    }
    return '';
  }
  // who shoots at transports landing on planet p: its owner (bases and ships) and every other empire that is neither allied with nor at peace (NAP) with the invader
  function shoots(S, shooter, attId, p) {
    if (shooter === attId) return false;
    if (shooter === p.owner) return true;
    if (allied(S, shooter, attId)) return false;
    return treatyOf(S, shooter, attId) !== 'nap';
  }
  const gunnery = w => (w.kind === 'beam' || w.kind === 'missile' || w.kind === 'torpedo') && !(w.flags && w.flags.monster) && !(w.n >= 61);

  function collectShots(S, att, p, speed) {
    const D = M.Sim.Design, K_ = K(), shots = {}, shooters = [], owner = p.owner >= 0 ? S.empires[p.owner] : null;
    let shipComp = 0, lastAbove = 0;
    const add = (type, n) => { if (n > 0) shots[type] = (shots[type] || 0) + n; };
    for (const f of S.fleets) {
      if (f.star !== p.starId || !shoots(S, f.owner, att.id, p)) continue;
      const E2 = S.empires[f.owner]; let sum = 0;
      for (let i = 0; i < 6; i++) {
        const cnt = f.ships[i] | 0; if (cnt <= 0) continue;
        const st = D.stats(S, E2, i); let armed = false;
        for (const w of (st.weapons || [])) {
          if (!gunnery(w) || !(w.count > 0)) continue;
          armed = true;
          let v = Math.min(32000, cnt * w.count * (w.ammo < 0 ? 4 : w.ammo) * Math.max(1, w.warheads | 0));   // ammo -1 (beams, torpedoes) counts as 4
          if (w.kind === 'torpedo') v = idiv(v, 2);
          const sh = idiv(v * 2, speed); add(w.type, sh); sum += sh;      // faster transports are exposed to fewer shots
        }
        if (armed) { const c = st.compLevel | 0; if (c > shipComp) shipComp = c; if (c > speed) lastAbove = c; }
      }
      if (sum > 0) shooters.push({ empire: f.owner, kind: 'ships', shots: sum });
    }
    const bases = owner ? (p.bases | 0) : 0;
    if (bases > 0) {
      const b = D.baseLoadout(S, owner);
      let wt = b.weapon; if (wt < 0) wt = K_.idx.weapons['nuclear-missile'];
      add(wt, bases * SHOTS_PER_BASE); shooters.push({ empire: owner.id, kind: 'bases', shots: bases * SHOTS_PER_BASE });
    }
    return { shots, shooters, bases, shipComp, lastAbove, owner };
  }

  // damage dealt by `n` shots of weapon w at attack level L (expected value when R is null)
  function shootDamage(w, n, L, R) {
    if (n <= 0) return 0;
    if (w.kind === 'beam') {                                   // variable damage: n·L/20 hits, each uniform in [min,max]
      const hits = idiv(n * L, 20);
      if (!R) return hits * (w.dmg[0] + w.dmg[1]) / 2;
      let chunk = 1, m = hits; if (m > 4000) { chunk = Math.ceil(m / 4000); m = idiv(hits, chunk); }
      let t = 0; for (let i = 0; i < m; i++) t += R.int(w.dmg[0], w.dmg[1]);
      return t * chunk;
    }
    if (!R) return n * L / 20 * w.dmg[1];                      // fixed damage: each shot hits when rnd(1..20) <= L
    let chunk = 1, m = n; if (m > 4000) { chunk = Math.ceil(m / 4000); m = idiv(n, chunk); }
    let hits = 0; for (let i = 0; i < m; i++) if (R.int(1, 20) <= L) hits++;
    return hits * chunk * w.dmg[1];
  }

  function runGauntlet(S, landing, R) {
    const att = S.empires[landing.empire], p = S.planets[landing.planet], owner = p.owner >= 0 ? S.empires[p.owner] : null;
    const n = Math.max(0, landing.n | 0), hp = G.transportHp(att), speed = speedOf(att);
    const out = { n, hp, speed, level: 0, comp: 0, bases: owner ? (p.bases | 0) : 0, damage: 0, killed: 0, recovered: 0, survivors: n, monster: '', shooters: [],
      expected: !R, combatTransporters: !!mods(att).combatTransporter };
    if (n <= 0) return out;
    const mon = monsterAt(S, p);
    if (mon) { out.monster = mon; out.killed = n; out.survivors = 0; return out; }
    const sh = collectShots(S, att, p, speed), K_ = K();
    out.shooters = sh.shooters;
    let comp;
    if (RULES.gauntletCompLast) comp = (sh.bases > 0 && RULES.gauntletBaseComp === 'transport') ? bestComp(S, att) : sh.lastAbove;
    else comp = Math.max(sh.shipComp, sh.bases > 0 ? bestComp(S, RULES.gauntletBaseComp === 'transport' ? att : owner) : 0);
    out.comp = comp; out.level = clamp((comp - speed) * 2 + 12, 1, 20);
    const totalHp = n * hp;
    const types = Object.keys(sh.shots).map(Number).sort((x, y) => K_.WEAPONS[x].n - K_.WEAPONS[y].n);   // weapons are processed in table order…
    let dmg = 0;
    for (const t of types) { if (dmg >= totalHp) break; dmg += shootDamage(K_.WEAPONS[t], sh.shots[t], out.level, R); }   // …until every transport is dead
    out.damage = dmg;
    let killed = R ? Math.min(n, idiv(dmg, hp)) : Math.min(n, dmg / hp);
    const gp = owner ? mods(owner).gauntletPct | 0 : 0, gop = mods(att).gauntletOwnPct || 100;      // expansion: Repulsor Field Net / Stealth Landing Craft
    if (killed > 0 && (gp || gop !== 100)) { const k = killed * (100 + gp) * gop / 10000; killed = Math.min(n, R ? Math.floor(k) : k); }
    let recovered = 0;
    if (killed > 0 && out.combatTransporters) {
      const inter = !!(owner && mods(owner).interdictor);
      if (RULES.combatTransportersFixed) {                     // every lost transport is recovered with probability 1/2 (1/4 against a Subspace Interdictor)
        const c = inter ? 4 : 2;
        if (R) { for (let i = 0; i < killed; i++) if (R.int(1, c) === 1) recovered++; } else recovered = killed / c;
      } else if (inter) {                                      // shipped v1.3: only against an interdictor, each with 1/4 + 3/4·1/2
        if (R) { for (let i = 0; i < killed; i++) if (R.int(1, 4) === 1 || R.int(1, 2) === 1) recovered++; } else recovered = killed * 0.625;
      }
    }
    out.killed = killed; out.recovered = recovered; out.survivors = n - killed + recovered;
    return out;
  }
  G.runGauntlet = runGauntlet;
  const round1 = v => Math.round(v * 10) / 10;
  G.gauntlet = function (S, landing) {
    const g = runGauntlet(S, landing, null);
    g.killed = round1(g.killed); g.recovered = round1(g.recovered); g.survivors = round1(g.survivors); g.damage = round1(g.damage);
    return g;
  };

  // =====================================================================================================================================
  // TECH CAPTURE / THEFT CANDIDATES (research/02 §1.10, research/05 §5.4)
  // =====================================================================================================================================
  const STEAL_GROUPS = { 'robotic-controls': 1, scanner: 1, waste: 1, 'industrial-tech': 1, 'planetary-shield': 1, terraforming: 1, environment: 1, 'eco-restoration': 1,
    'personal-armor': 1, 'personal-shield': 1, fuel: 1, 'personal-weapon': 1 };
  const GROUP_MUL = { 'robotic-controls': 6, waste: 3, 'eco-restoration': 3 };
  const ownsTech = (E, t) => !!t.free || E.research.completed[t.field].indexOf(t.level) >= 0;
  function groupTier(T, E, g) {                                // the empire's best tier (gtier) in an obsolescence group
    let best = 0; const ids = T.GROUPS[g] || (T.X && T.X.GROUPS[g]);
    if (ids) for (const id of ids) { const t = T.byId[id]; if (t.gtier > best && ownsTech(E, t)) best = t.gtier; }
    return best;
  }
  // up to opts.max (6) random distinct techs the victim has and the thief lacks, drawn "random field, then random tech".
  // A tech of one of the twelve groups is not stealable when the thief owns an equal-or-higher tier of that group; Silicoids never receive waste/environment/eco techs;
  // value = level² × group multiplier (singular ×10, robotic ×6, waste/eco ×3; ÷4 when the thief owns a higher tier; Death Ray 30000) and value 0 is excluded.
  G.techCandidates = function (S, thief, victim, R, opts) {
    opts = opts || {};
    const T = M.Data.Techs, th = emp(S, thief), vi = emp(S, victim), rr = rng(S, R), cache = {};
    const mine = g => (cache[g] !== undefined ? cache[g] : (cache[g] = groupTier(T, th, g)));
    const pool = [[], [], [], [], [], []];
    for (let f = 0; f < 6; f++) {
      for (const lvl of vi.research.completed[f]) {
        if (lvl <= 1) continue;                                // the level-1 start bundle belongs to everybody
        const t = T.byFL[f][lvl];
        if (!t || ownsTech(th, t)) continue;
        if (t.never && t.never.indexOf(th.race) >= 0) continue;
        if (opts.maxLevel !== undefined && lvl > opts.maxLevel) continue;
        const g = t.group, grouped = g !== 'singular' && g !== 'advanced', have = grouped ? mine(g) : 0;
        if (STEAL_GROUPS[g] && have >= t.gtier) continue;
        let v = t.special === 'orion-only' ? 30000 : t.level * t.level * (g === 'singular' ? 10 : (GROUP_MUL[g] || 1));
        if (grouped && have > t.gtier) v = idiv(v, 4); else if (grouped && have === t.gtier) v = 0;
        if (v <= 0) continue;
        pool[f].push({ field: f, level: lvl, id: t.id, name: t.name, value: v });
      }
    }
    const max = opts.max === undefined ? G.TECH_STEAL_MAX : opts.max, out = [];
    for (let k = 0; k < max; k++) {
      const fs = []; for (let f = 0; f < 6; f++) if (pool[f].length) fs.push(f);
      if (!fs.length) break;
      const f = fs[rr.int(0, fs.length - 1)], i = rr.int(0, pool[f].length - 1);
      out.push(pool[f][i]); pool[f].splice(i, 1);
    }
    return out;
  };
  G.theftRolls = function (factories, R) { let n = 0; for (let i = 0, m = Math.max(0, factories | 0); i < m; i++) if (R.int(0, 49) === 0) n++; return n; };
  G.stealTechs = function (S, thief, victim, count, R, source, opts) {
    const th = emp(S, thief), got = [];
    const cand = G.techCandidates(S, th, victim, R, opts);
    for (const c of cand.slice(0, Math.max(0, count | 0))) {
      if (M.Sim.Research.grant(S, th, c.field, c.level, source || 'spy')) got.push({ field: c.field, level: c.level, id: c.id, name: c.name });
    }
    return got;
  };

  // =====================================================================================================================================
  // INVASION (research/03 §7, research/04 §6.2)
  // =====================================================================================================================================
  function groundTurn(S) {
    if (!S.groundTurn || S.groundTurn.turn !== S.turn) S.groundTurn = { turn: S.turn, landed: {} };
    return S.groundTurn;
  }
  const landedSoFar = (S, p, attId) => (S.groundTurn && S.groundTurn.turn === S.turn ? (S.groundTurn.landed[p.id + ':' + attId] | 0) : 0);

  // relations incident for the diplomacy module: Diplo.turn drains these Ev events into Diplo.incident(S, kind, from, to, magnitude, extra) — kinds and extras as it defines them
  const incident = (S, kind, from, to, extra) => push(S, Object.assign({ type: 'incident', kind, from, to }, extra || {}));
  const news = (S, cat, a, b, p) => push(S, { type: 'news', cat, empire: a, empire2: b, planet: p.id, star: p.starId });

  function baseRecord(S, att, def, p) {
    return {
      attacker: att.id, defender: def.id, planet: p.id, star: p.starId, planetName: pname(S, p), attackerRace: att.race, defenderRace: def.race,
      attackerHuman: !!att.human, defenderHuman: !!def.human, visible: !!(att.human || def.human), rebellion: false, eliminated: false,
    };
  }

  // PURE: everything that will happen when `landing` arrives, rolled with R. Nothing in S changes.
  G.resolve = function (S, landing, R) {
    R = rng(S, R);
    const att = S.empires[landing.empire], p = S.planets[landing.planet];
    if (!att || !p || p.owner < 0 || p.owner === att.id || !(landing.n > 0)) return null;
    const def = S.empires[p.owner];
    if (!def || allied(S, att.id, def.id)) return null;
    const g = runGauntlet(S, landing, R);
    const room = Math.max(0, G.MAX_LANDING - landedSoFar(S, p, att.id)), arrived = Math.round(g.survivors);
    const landed = Math.min(arrived, room), overflow = arrived - landed;
    const defenders = p.pop | 0, fa = G.force(S, att, false), fd = G.force(S, def, true);
    const rec = Object.assign(baseRecord(S, att, def, p), {
      sent: g.n, killed: g.killed, recovered: g.recovered, arrived, landed, overflow, defenders, defendersLeft: defenders, force: { a: fa, d: fd },
      rounds: [], exchanges: 0, survivors: 0, captured: { factories: 0, techs: [] }, theftRolls: 0, success: false,
      gauntlet: { hp: g.hp, speed: g.speed, level: g.level, comp: g.comp, bases: g.bases, monster: g.monster, damage: g.damage, shooters: g.shooters, combatTransporters: g.combatTransporters },
    });
    if (landed <= 0) { rec.rounds = [{ a: 0, d: defenders }]; return rec; }
    const r = defenders <= 0 ? { a: landed, d: 0, exchanges: 0, rounds: [{ a: landed, d: 0 }] } : G.fight(landed, defenders, fa, fd, R, { human: !!(att.human || def.human) });   // e.g. a colony the Space Crystal emptied
    rec.rounds = r.rounds; rec.exchanges = r.exchanges; rec.survivors = r.a; rec.defendersLeft = r.d; rec.success = r.d === 0;
    if (rec.success) {
      rec.captured.factories = p.factories | 0;
      rec.theftRolls = G.theftRolls(rec.captured.factories, R);
      if (rec.theftRolls > 0) {
        const cand = G.techCandidates(S, att, def, R, { max: G.TECH_STEAL_MAX });
        rec.captured.techs = cand.slice(0, Math.min(rec.theftRolls, G.TECH_STEAL_MAX)).map(t => ({ field: t.field, level: t.level, id: t.id, name: t.name }));
      }
    }
    return rec;
  };

  // hand the planet to a new owner the way the original does: pop = survivors (≤ max pop), factories stay (they run at one per colonist until refitted), bases / planetary shield /
  // stargate / queues / reserve / rebels are gone, sliders back to 100% Industry
  G.capture = function (S, planet, newOwner, troops) {
    const p = plan_(S, planet), E = emp(S, newOwner), C = M.Sim.Colony;
    p.owner = E.id; p.pop = Math.max(1, Math.min(troops | 0, p.mp3 > 0 ? p.mp3 : (troops | 0))); p.popFrac = 0; p.operTier = 1;
    p.bases = 0; p.shield = 0; p.stargate = false; p.rebels = 0; p.unrest = 0; p.event = null; p.bank = 0; p.baseCostPaid = 0; p.trans = null; p.reloc = p.starId;
    p.sliders = [0, 0, 100, 0, 0]; p.lock = [false, false, false, false, false]; p.acc = { ship: 0, factory: 0, base: 0, baseUpg: 0, shield: 0, eco: 0, refit: 0 };
    p.gross = 0; p.spendable = 0;
    let slot = 0; for (let i = 0; i < 6; i++) if (E.designs && E.designs[i]) { slot = i; break; }
    p.build = slot;
    if (M.Sim.XTech) M.Sim.XTech.improve(S, E, p);                                    // expansion: the new owner's permanent improvements
    if (C && C.applyEcoFloor) C.applyEcoFloor(S, E, p);
    if (M.Sim.Vis) { M.Sim.Vis.explore(S, E, p.starId); M.Sim.Vis.snapshot(S, E, p.starId); }
    return p;
  };
  // the planet and everything on it is gone (bombed to zero population, comet, monster): unowned and empty, to be recolonised
  G.destroyPlanet = function (S, planet) {
    const p = plan_(S, planet);
    if (M.Sim.Colony && M.Sim.Colony.abandon) M.Sim.Colony.abandon(S, p);
    else { p.owner = -1; p.pop = 0; p.factories = 0; p.bases = 0; p.shield = 0; p.stargate = false; p.waste = 0; p.rebels = 0; p.unrest = 0; p.trans = null; }
    p.popFrac = 0; p.bank = 0; p.event = null;
    return p;
  };

  // an empire lost its last planet: run the pipeline's death check now (a colony ship in flight keeps it alive) so the news fires once; Events.coups applies the genocide penalty
  function deathHook(S, defId) {
    if (S.planets.some(q => q.owner === defId)) return false;
    const T = M.Sim.Turn;
    if (T && T.checkDeaths) { T.checkDeaths(S); return !S.empires[defId].alive; }
    return true;
  }

  function applyInvasion(S, rec, R) {
    const att = S.empires[rec.attacker], def = S.empires[rec.defender], p = S.planets[rec.planet];
    const gt = groundTurn(S), key = p.id + ':' + att.id;
    gt.landed[key] = (gt.landed[key] | 0) + rec.landed;
    const popKilled = rec.defenders - rec.defendersLeft;
    if (rec.success) {
      if (M.Sim.XTech) M.Sim.XTech.evacuate(S, def, p, rec.defenders);              // expansion: Lifeboat Protocols
      G.capture(S, p, att, rec.survivors);
      for (const t of rec.captured.techs) M.Sim.Research.grant(S, att, t.field, t.level, 'loot');
      news(S, 'invasionSuccess', att.id, def.id, p);
      if (!def.human) incident(S, att.human ? 'capture' : 'aiGround', att.id, def.id, { planet: p.id });                          // a human taking a colony: -(50..100) and war; AI vs AI: -(4+rnd 4)
      rec.eliminated = deathHook(S, def.id);
    } else {
      news(S, 'invasionRepelled', def.id, att.id, p);
      p.pop = rec.defendersLeft;
      if ((p.rebels | 0) > p.pop) p.rebels = p.pop;
      if (popKilled > 0 && !def.human) {
        if (att.human) incident(S, 'popKilled', att.id, def.id, { planet: p.id, magnitude: popKilled });                         // -(5+rnd 5) per pop killed
        else incident(S, 'aiGround', att.id, def.id, { planet: p.id });
      }
    }
  }

  // all = true returns the record of AI-vs-AI fights too (the turn pipeline yields whatever comes back, and the original only shows ground combat when a human is involved)
  G.invade = function (S, landing, R, all) {
    R = rng(S, R);
    const att = S.empires[landing.empire], p = S.planets[landing.planet];
    if (!att || !p || !(landing.n > 0)) return null;
    if (p.owner === att.id) {                                  // the planet is already ours (an earlier landing took it this turn) or rebels hold it
      if (p.unrest === 2 && (p.rebels | 0) > 0) { const r = G.reclaim(S, landing, R); return r && (all || r.visible) ? r : null; }
      p.pop = Math.min(p.pop + (landing.n | 0), p.mp3); return null;
    }
    if (p.owner < 0 || allied(S, att.id, p.owner)) { push(S, { type: 'notice', kind: 'transportLost', empire: att.id, planet: p.id, n: landing.n | 0 }); return null; }
    const rec = G.resolve(S, landing, R);
    if (!rec) return null;
    applyInvasion(S, rec, R);
    logFight(S, rec);
    return all || rec.visible ? rec : null;
  };
  // compact history of every fight (AI memory, statistics): the last 60
  function logFight(S, rec) {
    const log = S.groundLog || (S.groundLog = []);
    log.push({ turn: S.turn, attacker: rec.attacker, defender: rec.defender, planet: rec.planet, rebellion: !!rec.rebellion, success: rec.success, sent: rec.sent, landed: rec.landed,
      survivors: rec.survivors, defenders: rec.defenders, defendersLeft: rec.defendersLeft, techs: rec.captured.techs.length });
    if (log.length > 60) log.splice(0, log.length - 60);
  }

  // loyal troops against the rebels of their own planet (research/03 §7.3): win → pop = pop − rebels + survivors, unrest resolved; lose → the rebels that survive stay
  G.reclaim = function (S, landing, R) {
    R = rng(S, R);
    const E = S.empires[landing.empire], p = S.planets[landing.planet], rebels = p ? (p.rebels | 0) : 0, n = landing.n | 0;
    if (!E || !p || p.owner !== E.id || n <= 0) return null;
    if (rebels <= 0) { p.pop = Math.min(p.pop + n, p.mp3); p.unrest = 0; return null; }
    const room = Math.max(0, G.MAX_LANDING - landedSoFar(S, p, E.id)), landed = Math.min(n, room);
    const fa = G.force(S, E, false), fd = G.force(S, E, true);
    const r = landed > 0 ? G.fight(landed, rebels, fa, fd, R, { human: !!E.human }) : { a: 0, d: rebels, exchanges: 0, rounds: [{ a: 0, d: rebels }] };
    const rec = Object.assign(baseRecord(S, E, E, p), {
      rebellion: true, sent: n, killed: 0, recovered: 0, arrived: n, landed, overflow: n - landed, defenders: rebels, defendersLeft: r.d, force: { a: fa, d: fd }, rounds: r.rounds,
      exchanges: r.exchanges, survivors: r.a, captured: { factories: 0, techs: [] }, theftRolls: 0, success: r.d === 0, gauntlet: { hp: 0, speed: 0, level: 0, comp: 0, bases: 0, monster: '', damage: 0, shooters: [] },
    });
    const gt = groundTurn(S); gt.landed[p.id + ':' + E.id] = (gt.landed[p.id + ':' + E.id] | 0) + landed;
    if (rec.success) { p.pop = Math.min(p.pop - rebels + r.a, p.mp3); p.rebels = 0; p.unrest = 0; }
    else { p.pop = Math.max(1, p.pop - (rebels - r.d)); p.rebels = r.d; p.unrest = 2; }
    logFight(S, rec);
    return rec;
  };

  // odds of an invasion that has not been launched (AI planning, UI preview): gauntlet expectation, the two forces and the exact fight odds
  G.estimate = function (S, attacker, planet, n) {
    const att = emp(S, attacker), p = plan_(S, planet), def = S.empires[p.owner];
    const g = G.gauntlet(S, { empire: att.id, planet: p.id, n });
    const landed = Math.min(Math.round(g.survivors), G.MAX_LANDING), fa = G.force(S, att, false), fd = def ? G.force(S, def, true) : 0;
    const o = G.odds(fa, fd, landed, p.pop | 0, { human: !!(att.human || (def && def.human)) });
    return { gauntlet: g, landed, defenders: p.pop | 0, force: { a: fa, d: fd }, pWin: o.pWin, expSurvivors: o.expAttackers, expDefendersLeft: o.expDefenders };
  };

  // =====================================================================================================================================
  // ORBITAL BOMBARDMENT (research/03 §5.2–5.3)
  // =====================================================================================================================================
  // what the bombarding empire's ships in orbit bring: weapon shots per weapon type (bank-limited), computer attack level, bio/bomb flags
  function bombPlan(S, a, p) {
    const E = S.empires[a], D = M.Sim.Design, plan = { ok: false, reason: '', shots: {}, comp: 4, compLevel: 0, bio: false, bombs: false, any: false, ships: 0, antidote: 0 };
    if (!E || !E.alive) { plan.reason = 'no such empire'; return plan; }
    if (!p || p.owner < 0 || p.owner === a) { plan.reason = 'not an enemy planet'; return plan; }
    if (allied(S, a, p.owner)) { plan.reason = 'allied planet'; return plan; }
    if (!((p.pop | 0) > 0)) { plan.reason = 'no population'; return plan; }
    const fleet = M.Sim.Fleet.at(S, p.starId, a);
    if (!fleet) { plan.reason = 'no ships in orbit'; return plan; }
    let cl = 0;
    for (let i = 0; i < 6; i++) {
      const cnt = fleet.ships[i] | 0; if (cnt <= 0) continue;
      const st = D.stats(S, E, i); let armed = false;
      for (const w of (st.weapons || [])) {
        if (!(w.count > 0) || w.slot >= RULES.orbitalBanks || w.n >= 61 || w.kind === 'special') continue;      // Crystal Ray, Death Ray, Amoeba Stream never bombard
        armed = true; plan.any = true;
        plan.shots[w.type] = Math.min(100000, (plan.shots[w.type] || 0) + cnt * w.count * (w.ammo < 0 ? 30 : w.ammo));   // beams and torpedoes count as 30 shots
        if (w.kind === 'bio') plan.bio = true; else if (w.kind === 'bomb') plan.bombs = true;
      }
      if (armed) { plan.ships += cnt; cl = Math.max(cl, st.compLevel | 0); }
    }
    if (!RULES.orbitalBestCompInOrbit) { cl = 0; for (let i = 0; i < 6; i++) if (E.designs && E.designs[i]) cl = Math.max(cl, D.stats(S, E, i).compLevel | 0); }
    plan.compLevel = cl; plan.comp = clamp((cl - 1) * 2 + 6, 1, 20);              // Mark I → 6 … Mark VIII → 20 hits in 20
    if (!plan.any) { plan.reason = 'no armed ships'; return plan; }
    plan.antidote = mods(S.empires[p.owner]).antidote | 0;
    // expansion techs: Siege Engineering / Antimatter Warheads (attacker), Repulsor Field Net (defender)
    const xa = mods(E), xd = mods(S.empires[p.owner]);
    if (xa.bombPct || xd.bombDefPct) plan.xmul = Math.floor((100 + (xa.bombPct | 0)) * (xd.bombDefPct || 100) / 100);
    if (xa.warheadPct) plan.warhead = xa.warheadPct | 0;
    plan.ok = true; return plan;
  }
  G.canBombard = function (S, empire, planet) {
    const p = plan_(S, planet), plan = bombPlan(S, eid(empire), p);
    return { ok: plan.ok, reason: plan.reason, bio: plan.bio, bombs: plan.bombs, ships: plan.ships, comp: plan.comp };
  };

  // the bombardment maths: R rolls it, R = null returns the expectation (for the preview)
  function bombCore(S, p, plan, R) {
    const K_ = K(), st = S.stars[p.starId], shield = st && st.nebula ? 0 : (p.shield | 0), comp = plan.comp, antidote = plan.antidote;
    const types = Object.keys(plan.shots).map(Number).sort((x, y) => K_.WEAPONS[x].n - K_.WEAPONS[y].n);
    let dmg = 0, bio = 0;
    const wm = plan.warhead ? (100 + plan.warhead) / 100 : 1;                   // expansion Antimatter Warheads: missiles, torpedoes and bombs
    for (const ty of types) {
      const w = K_.WEAPONS[ty], n = plan.shots[ty];
      let v = 1, rolls = n; if (n >= 10) { v = idiv(n, 10); rolls = 10; }          // big stacks roll ten times with a multiplier
      if (w.kind === 'bio') {                                  // never hurts factories or bases, ignores planetary shields; the antidote cancels points per hit
        const mx = w.dmg[1];
        if (R) { for (let i = 0; i < rolls; i++) if (R.int(1, 20) <= comp) bio += v * Math.max(0, R.int(0, mx) - antidote); }
        else { let e = 0; for (let k = 0; k <= mx; k++) e += Math.max(0, k - antidote); bio += rolls * v * (comp / 20) * (e / (mx + 1)); }
      } else if (w.kind === 'missile' || w.kind === 'torpedo') {   // fixed damage, scatter packs multiply it, the planetary shield is deducted once
        let d = w.dmg[1];
        if (w.kind === (RULES.orbitalTorpedoHalf ? 'torpedo' : 'missile')) d = idiv(d, 2);
        d *= Math.max(1, w.warheads | 0);
        if (wm !== 1) d = Math.floor(d * wm);
        if (d > shield) { if (R) { for (let i = 0; i < rolls; i++) if (R.int(1, 20) <= comp) dmg += v * (d - shield); } else dmg += rolls * v * (comp / 20) * (d - shield); }
      } else {                                                 // beams (halved vs planets) and bombs: comp·shots/20 damage rolls, each reduced by the planetary shield
        let mn = w.dmg[0], mx = w.dmg[1]; if (w.kind === 'beam') { mn = idiv(mn, 2); mx = idiv(mx, 2); }
        if (wm !== 1 && w.kind === 'bomb') { mn = Math.floor(mn * wm); mx = Math.floor(mx * wm); }
        if (mx > shield) {
          const cnt = Math.min(100000, idiv(comp * rolls * v, 20));
          if (R) { for (let i = 0; i < cnt; i++) { const x = R.int(mn, mx) - shield; if (x > 0) dmg += x; } }
          else { let e = 0; for (let k = mn; k <= mx; k++) e += Math.max(0, k - shield); dmg += cnt * e / (mx - mn + 1); }
        }
      }
    }
    if (plan.xmul && plan.xmul !== 100) dmg = R ? Math.floor(dmg * plan.xmul / 100) : dmg * plan.xmul / 100;
    dmg = Math.min(dmg, 100000); bio = Math.min(bio, 10000);
    const fact = p.factories | 0, pop = p.pop | 0;
    let factoriesLost, popLost;
    if (R) {                                                   // fact_hp 50: divisor 41..60; pop_hp 200: divisor 161..240
      const d1 = R.int(1, 20) + 40, d2 = R.int(1, 80) + 160;
      factoriesLost = Math.min(fact, idiv(dmg, d1)); popLost = Math.min(pop, idiv(dmg, d2) + bio);
    } else {
      let sf = 0, sp = 0;
      for (let k = 41; k <= 60; k++) sf += Math.min(fact, Math.floor(dmg / k));
      for (let k = 161; k <= 240; k++) sp += Math.min(pop, Math.floor(dmg / k) + bio);
      factoriesLost = sf / 20; popLost = sp / 80;
    }
    return { damage: dmg, bio, popLost, factoriesLost, maxPopLoss: bio, shield, comp, antidote };
  }

  // shrink the maximum population by the bio damage (never below 10; terraforming / ecology spending restores it)
  function shrinkMaxPop(p, bio) { if (bio > 0) p.mp3 = Math.max(Math.min(p.mp3, 10), p.mp3 - bio); }

  function destroyedBy(S, a, p, R) {
    const vic = p.owner;
    G.destroyPlanet(S, p);
    push(S, { type: 'news', cat: 'planetDestroyed', empire: a, empire2: vic, planet: p.id, star: p.starId });
    if (S.empires[a].human && !S.empires[vic].human) incident(S, 'depopulate', a, vic, { planet: p.id });
    deathHook(S, vic);
  }

  function runBombard(S, a, p, plan, R) {
    const E = S.empires[a], vicId = p.owner, vic = S.empires[vicId];
    const core = bombCore(S, p, plan, R);
    const before = { pop: p.pop | 0, factories: p.factories | 0 }, factKilled = core.factoriesLost;
    let popKilled = core.popLost;
    if (M.Sim.XTech) { const fl = M.Sim.XTech.siegeFloor(S, p); if (fl) popKilled = Math.max(0, Math.min(popKilled, before.pop - fl)); }    // expansion: Planetary Stasis Field
    p.pop = before.pop - popKilled; p.factories = before.factories - factKilled;
    shrinkMaxPop(p, core.maxPopLoss);
    if (popKilled > 0 && (p.rebels | 0) > 0) { p.rebels = Math.max(0, p.rebels - (idiv(popKilled, 2) + 1)); if (p.rebels > p.pop) p.rebels = p.pop; if (p.rebels === 0) p.unrest = 0; }
    const destroyed = p.pop <= 0;
    const rec = {
      type: 'bombard', empire: a, victim: vicId, planet: p.id, star: p.starId, planetName: pname(S, p), attackerRace: E.race, victimRace: vic.race, attackerHuman: !!E.human,
      victimHuman: !!vic.human, visible: !!(E.human || vic.human), bio: plan.bio, bombs: plan.bombs, ships: plan.ships, popBefore: before.pop, factoriesBefore: before.factories,
      damage: core.damage, popKilled, factoriesKilled: factKilled, bioKilled: core.bio, maxPopLost: core.maxPopLoss, popLeft: Math.max(0, p.pop), factoriesLeft: p.factories | 0,
      shield: core.shield, comp: core.comp, destroyed, ineffective: popKilled === 0 && factKilled === 0 && !(core.maxPopLoss > 0),
    };
    if (!rec.ineffective) news(S, 'bombardment', a, vicId, p);
    if (vic.human && !rec.ineffective) push(S, { type: 'notice', kind: 'bombarded', empire: vicId, by: a, planet: p.id, star: p.starId, popKilled, factoriesKilled: factKilled, destroyed });
    if (core.bio > 0) incident(S, 'bio', a, vicId, { planet: p.id, bio: core.bio, popLost: popKilled });          // −max(5·pop, 10·bio) for an AI victim, −10 with every other AI
    else if (popKilled > 0) incident(S, 'combat', a, vicId, { planet: p.id, popLost: popKilled, bio: 0 });
    if (destroyed && M.Sim.XTech) M.Sim.XTech.evacuate(S, vic, p, before.pop);          // expansion: Lifeboat Protocols
    if (destroyed) destroyedBy(S, a, p, R);
    return rec;
  }

  // v1.3 only: a cancelled bombardment still shrank the maximum population
  function classicCancelBio(S, p, plan, R) { const core = bombCore(S, p, plan, R); shrinkMaxPop(p, core.maxPopLoss); }

  G.inbound = function (S, empire, planet) {
    const p = plan_(S, planet), a = eid(empire); let n = 0;
    for (const t of (S.trans || [])) if (t.owner === a && t.to === p.starId) n += t.n | 0;     // ALL of the bomber's transports in flight to the planet (research/08 §4.8), not only those landing this turn
    return n;
  };
  G.aiBombs = function (S, E, planet) {
    const p = plan_(S, planet), rc = races()[E.race], mul = (rc && rc.ai && rc.ai.invasionMul) || 1;
    const D = M.Sim.Diplo;                                       // never bomb a human who holds a ceasefire against us (research/03-verification #9, 08 §5.4)
    if (D && p.owner >= 0 && S.empires[p.owner] && S.empires[p.owner].human && !E.human && D.ceasefire(S, E.id, p.owner) > 0) return false;
    return (p.pop | 0) > G.inbound(S, E.id, p) * mul;           // bomb until the pop is smaller than the troops already on the way
  };

  // every (empire, planet) pair that may bombard this turn: S.bombard entries first, then fleets found in orbit over non-allied planets
  function bombardEntries(S) {
    const out = [], seen = {};
    for (const e of (S.bombard || [])) { if (!e) continue; const k = e.empire + ':' + e.planet; if (seen[k]) continue; seen[k] = 1; out.push({ empire: e.empire, planet: e.planet, entry: e }); }
    const found = [];
    for (const f of S.fleets) {
      if (f.star < 0 || !S.empires[f.owner] || !S.empires[f.owner].alive) continue;
      const p = S.planets[f.star];
      if (!p || p.owner < 0 || p.owner === f.owner || !((p.pop | 0) > 0)) continue;
      const k = f.owner + ':' + p.id; if (seen[k]) continue; seen[k] = 1; found.push({ empire: f.owner, planet: p.id, entry: null });
    }
    found.sort((x, y) => x.empire - y.empire || x.planet - y.planet);
    return out.concat(found);
  }
  G.bombTargets = function (S, empire) {
    const a = eid(empire), out = [];
    for (const it of bombardEntries(S)) {
      if (it.empire !== a) continue;
      const p = S.planets[it.planet], c = G.canBombard(S, a, p); if (!c.ok) continue;
      out.push({ planet: p.id, owner: p.owner, pop: p.pop | 0, factories: p.factories | 0, bio: c.bio, bombs: c.bombs });
    }
    return out;
  };

  G.bombPreview = function (S, empire, planet) {
    const a = eid(empire), p = plan_(S, planet), plan = bombPlan(S, a, p), st = S.stars[p.starId];
    const out = { planet: p.id, star: p.starId, owner: p.owner, pop: p.pop | 0, factories: p.factories | 0, bases: p.bases | 0, shield: st && st.nebula ? 0 : (p.shield | 0),
      inbound: G.inbound(S, a, p), canBomb: plan.ok, reason: plan.reason, bio: plan.bio, bombs: plan.bombs, ships: plan.ships, comp: plan.comp, antidote: plan.antidote,
      expected: { popKilled: 0, factoriesKilled: 0, bioKilled: 0, maxPopLoss: 0, damage: 0 }, expectedKills: { pop: 0, factories: 0, bio: 0 }, ineffective: true };
    if (plan.ok) {
      const c = bombCore(S, p, plan, null);
      out.expected = { popKilled: round1(c.popLost), factoriesKilled: round1(c.factoriesLost), bioKilled: round1(c.bio), maxPopLoss: round1(c.maxPopLoss), damage: Math.round(c.damage) };
      out.ineffective = c.popLost < 0.05 && c.factoriesLost < 0.05 && c.bio < 0.05;
      out.expectedKills = { pop: out.expected.popKilled, factories: out.expected.factoriesKilled, bio: out.expected.bioKilled };
    }
    return out;
  };

  // human prompts that still wait for an answer: [{type:'bombardPrompt', empire, planet, preview}] — answer each with the `bombard` order (or Ground.setBombard) before Ground.bombard runs
  G.pending = function (S, empire) {
    const out = [];
    for (const it of bombardEntries(S)) {
      const E = S.empires[it.empire];
      if (!E || !E.human || (empire !== undefined && it.empire !== empire)) continue;
      if (it.entry && it.entry.yes !== undefined && it.entry.yes !== null) continue;
      if (!G.canBombard(S, it.empire, it.planet).ok) continue;
      out.push({ type: 'bombardPrompt', empire: it.empire, planet: it.planet, preview: G.bombPreview(S, it.empire, it.planet) });
    }
    return out;
  };
  G.setBombard = function (S, empire, planet, yes) {
    const a = eid(empire), pid = eid(planet);
    if (!Array.isArray(S.bombard)) S.bombard = [];
    let e = S.bombard.find(x => x && x.empire === a && x.planet === pid);
    if (!e) { e = { empire: a, planet: pid }; S.bombard.push(e); }
    e.yes = !!yes; return e;
  };

  // lost troops of a planet's own empire that arrive on a REBELLING planet fight the rebels now (Fleet.landTransports would only add them as population)
  function reclaimRebels(S, R, events, all) {
    for (const t of (S.trans || [])) {
      if (!(t.n > 0)) continue;
      const p = S.planets[t.to], st = S.stars[t.to];
      if (!p || !st || t.x !== st.x || t.y !== st.y || p.owner !== t.owner || p.unrest !== 2 || !((p.rebels | 0) > 0)) continue;
      const rec = G.reclaim(S, { empire: t.owner, planet: p.id, n: t.n }, R);
      t.n = 0;                                                 // consumed: landTransports then adds nothing
      if (rec && (all || rec.visible)) events.push({ type: 'ground', result: rec });
    }
  }

  // all = true also returns the events of AI-vs-AI bombardments (by default only those a human is part of)
  G.bombard = function (S, R, all) {
    R = rng(S, R);
    const events = [], keep = [];
    reclaimRebels(S, R, events, all);
    for (const it of bombardEntries(S)) {
      const E = S.empires[it.empire], p = S.planets[it.planet];
      if (!E || !p) continue;
      const plan = bombPlan(S, it.empire, p);
      if (!plan.ok) continue;
      let yes = it.entry ? it.entry.yes : undefined;
      if (yes === undefined || yes === null) {
        if (E.human) yes = RULES.humanBombard === 'yes' ? true : RULES.humanBombard === 'no' ? false : undefined;
        else if (treatyOf(S, it.empire, p.owner) === 'nap' || (M.Sim.Diplo && M.Sim.Diplo.canFight && !M.Sim.Diplo.canFight(S, it.empire, p.owner, p.owner))) yes = false;
        else yes = G.aiBombs(S, E, p);
      }
      if (yes === undefined) { keep.push(it.entry || { empire: it.empire, planet: it.planet }); continue; }
      if (!yes) { if (!RULES.orbitalBioOnlyIfBombing && plan.bio) classicCancelBio(S, p, plan, R); continue; }
      const ev = runBombard(S, it.empire, p, plan, R);
      if (all || ev.visible) events.push(ev);
    }
    S.bombard = keep;
    return events;
  };

  // =====================================================================================================================================
  // REBELLION AND COUPS (research/04 §3.13, §6.2; research/05 §5.5, §7.2, §7.3)
  // =====================================================================================================================================
  G.rebels = p => p.rebels | 0;
  G.unrest = p => p.unrest | 0;                                // 0 calm · 1 unrest (some rebels) · 2 rebellion (no output, no council vote, defends with the rebels)
  G.rebelState = p => (p.unrest === 2 ? 'rebellion' : p.unrest === 1 ? 'unrest' : 'calm');
  G.startRebellion = function (S, planet, rebels) {
    const p = plan_(S, planet);
    p.rebels = clamp(rebels === undefined ? Math.max(1, idiv(p.pop | 0, 2)) : rebels | 0, 1, Math.max(1, p.pop | 0)); p.unrest = 2;
    push(S, { type: 'news', cat: 'planetRebels', empire: p.owner, planet: p.id, star: p.starId });
    return p;
  };
  // spy "Incite Revolt": rebels += n; once they reach half of the population the planet rebels (rebels = pop/2)
  G.incite = function (S, planet, n) {
    const p = plan_(S, planet), pop = p.pop | 0;
    if (p.unrest === 2 || n <= 0 || pop <= 0) return p;
    p.rebels = Math.min(pop, (p.rebels | 0) + (n | 0));
    if (p.rebels * 2 >= pop) G.startRebellion(S, p, Math.max(1, idiv(pop, 2))); else p.unrest = p.rebels > 0 ? 1 : 0;
    return p;
  };
  // an empire is toppled when at least half of its planets are in rebellion
  G.coupCheck = function (S) {
    const out = [];
    for (const E of S.empires) {
      if (!E.alive) continue;
      let total = 0, reb = 0;
      for (const p of S.planets) if (p.owner === E.id) { total++; if (p.unrest === 2) reb++; }
      if (total > 0 && reb * 2 >= total) out.push({ empire: E.id, rebelling: reb, planets: total, human: !!E.human });
    }
    return out;
  };
  // the coup (Events.coups owns the turn hook and the news; this is the shared mechanic): every rebellion ends; an AI leader is replaced (new random personality and objective,
  // new name); a toppled human is reported (gameOver) for the ending screen
  G.applyCoup = function (S, empire, R) {
    R = rng(S, R);
    const E = emp(S, empire), out = { empire: E.id, human: !!E.human, gameOver: !!E.human, newLeader: E.leader, personality: E.personality, objective: E.objective };
    for (const p of S.planets) if (p.owner === E.id && (p.unrest || p.rebels)) { p.unrest = 0; p.rebels = 0; }
    if (!E.human) {
      E.personality = R.int(0, 5); E.objective = R.int(0, 5);
      const rc = races()[E.race], used = {}; for (const o of S.empires) used[String(o.leader).toLowerCase()] = 1;
      if (rc && rc.leaders) { for (let i = 0; i < 200; i++) { const c = rc.leaders[R.int(0, rc.leaders.length - 1)]; if (!used[c.toLowerCase()]) { E.leader = c; break; } } }
      out.newLeader = E.leader; out.personality = E.personality; out.objective = E.objective;
    }
    return out;
  };

  // =====================================================================================================================================
  // ORDERS
  // =====================================================================================================================================
  if (O) {
    // {t:'bombard', planet, yes} — answer the "Bomb?" prompt for the fleet that is in orbit over `planet` (stored in the S.bombard entry)
    O.register('bombard', function (S, E, o) {
      const pid = o.planet | 0, c = G.canBombard(S, E.id, pid);
      if (!c.ok) return O.fail(c.reason || 'cannot bombard');
      G.setBombard(S, E.id, pid, !!o.yes);
      return O.ok();
    });
  }
});
