// Master of Orion — Reborn · TACTICAL COMBAT ENGINE (research/03 §4 tactical combat, §3.7 weapons, §4.15 monsters, §5.1 bases; research/05 §7.4–7.5; research/08 §5.5, §6).
// Worker-safe (MOO.def blocks, plain JSON, all randomness from MOO.RNG). Needs Data.Components, Sim.Design (stats), Sim.Fleet/Colony (applyResults), optional Sim.Diplo / Sim.Ev.
//
// ======================================================================================================================================================
//  PUBLIC API  (MOO.Sim.Combat)
// ======================================================================================================================================================
//  TURN PIPELINE (called by sim/turn.js, sim/auto.js, core/game.js)
//    findBattles(S, R) → battle[]        one battle per star where hostile parties meet (planet owner with missile bases / fleets / the Orion Guardian / roaming monsters).
//                                         Also resets S.bombard and registers UNOPPOSED bombard candidates (armed ships over an enemy colony nobody defends).
//    resolve(battle, R[, {full:true}]) → result      PURE + deterministic.  AI-vs-AI → the original's weight-attrition model (§4.12); any battle that involves a
//                                         human (battle.human) or opts.full → the full tactical simulation with this engine's AI playing both sides ("Auto" button).
//    applyResults(S, results, R)          mutate S: ships lost, retreat fleets (loser → nearest other own planet, §4.11), planet losses, Guardian/monster kills,
//                                         `battle` + `news` events (S.ev), diplomacy incident hook, S.bombard = [{empire, planet, target, star}] for Ground.bombard.
//    MOO.Ops.resolveBattle({battle, seed}) → result            worker op (Workers.map('resolveBattle', …)).
//    odds(battle, n, seed[, opts]) → {win:[p0,p1], n, avgLost:[[6],[6]]}      Monte-Carlo preview for the pre-battle panel.
//    retreatBeforeBattle(battle) → result    the whole fleet of a side withdraws before a shot is fired.
//
//  BATTLE SNAPSHOT (plain JSON; produced by findBattles, consumed by resolve/create):
//    { v:1, star, starName, planet:null|{id,owner,name,pop,factories,bases,shield,type,special,maxPop,baseHp,comp,ecm,absorb,weapon,weapon2,interdictor,antidote},
//      sides:[left,right], planetSide:0|1|-1, nebula, bg, rocks:'none'|'some'|'many', attacker:empireId|-1, defender:empireId, human, diff, seed }
//    side = { empire (-1 = monster), fleetId, ships:[6 counts], designs:[6 × null|stats snapshot (Design.stats shape + wt)], role:'attacker'|'defender', race, name,
//             human, mod:{compLevel,initiative,defense,misDefense}, tl:[6], autoWeight, antidote, monster?:{kind:'guardian'|'crystal'|'amoeba', id?} }
//    The HUMAN is always the LEFT side (sides[0]); otherwise the defender (planet owner) is left.  Left units start in column 0, right units in column 9
//    (rows 3,4,2,5,1,6 by design order); a planet with missile bases sits at (1,3) when its owner is left, (8,3) when right.
//
//  RESULT:  { v:1, mode:'weights'|'tactical', star, starName, planetId, winner:0|1, winnerEmpire, loserEmpire, rounds, reason:'wiped'|'timeout'|'weights'|'retreat',
//             sides:[{empire, fleetId, monster, lost:[6], survivors:[6], voluntary:[6] (left the field by retreat order), retreated (loser with survivors → flees),
//                     retreatTo:-1 (filled by applyResults), destroyed}],
//             planet:null|{id, owner, basesLost, basesLeft, popKilled, factoriesKilled, bioDamage, shieldBroken:false, popLeft, factoriesLeft},
//             human, attacker, defender, summary:[strings] }
//
//  INTERACTIVE TACTICAL API (the battle screen; every call returns an ordered events[] to animate; B is plain JSON and may be saved/cloned at any time)
//    create(S, battle, R) → B        S may be null.  R = MOO.RNG generator (its next 4 draws seed B.rs) – or omit R and battle.seed is used.
//    B = { v, w:10, h:8, round, phase:'turn'|'roundEnd'|'over', active (unit id whose turn it is | null), order:[ids still to act this round, active first excluded],
//          units:[unit…], planet:null|{…collateral state…}, rocks:[{x,y}], missiles:[stack…], log:[strings], over:null|{winner,reason}, sides:[{empire,name,role,ctl:'human'|'ai',
//          human,initial:[6],…}], planetSide, nebula, bg, star, starName, diff, rs:[4] (own RNG state — B is self-contained & deterministic) }
//    unit = { id, side, kind:'ship'|'planet'|'monster', empire, slot, name, hull, count, hp1 (current max HP of one ship), hp2 (full), hploss (damage on the top ship), x, y,
//             speed, actman (moves left), unman, comp (attack level incl. race/scanner), def (beam defense), mdef (missile defense), absorb, misshield, repair,
//             weapons:[{id,name,kind,count,dmin,dmax,range,rof,numfire,shots (-1 = unlimited),acc,speed,warheads,mul,half,stream,tl,…}], sp:{specials}, st:{cloak,stasis,
//             retreat,subspace,…}, gone, left }
//    Unit ids: the planet (when it has missile bases) is unit 0, then the left side's designs in slot order, then the right side's.  hp shown = hp1*(count-1)+hp1-hploss.
//    B.active is always a unit that can act, or null (phase 'roundEnd' → call endRound).  A frozen / leaving unit is skipped automatically.
//    legalMoves(B, unit) → [{x,y,cost,tele?}]            cells the unit may END on this turn (walking ≤ actman Chebyshev steps around rocks/planet, through other groups;
//                                                         teleporters: every empty cell with tele:true)
//    targets(B, unit, mode) → [{id,type:'ship'|'planet'|'monster',range,hitChance,hit:{beam,missile},weapons:[slots in reach],cloaked,name,count,hp}]
//                                                         enemies the unit can hit from where it stands now. mode: 'all' (default) | 'beam' | 'missile' | 'bomb' | 'special'.
//                                                         hitChance = exact probability (0..1) for the first weapon in reach; hit.beam/hit.missile include rocks/cloak and the
//                                                         cumulative-accuracy quirk is applied per slot in `chances:[{slot,kind,hit}]`.
//    act(B, unit, action) → events[]                     unit = id | unit object; must be B.active.  action:
//        {type:'move', x, y}                  walk (reaction fire from enemies that already acted fires at every step; repulsors push) or teleport
//        {type:'fire', target, weapons}       weapons: 'all' (default) | 'beams' | 'missiles' | [slot indexes] — every weapon in reach fires (planets fire ONE slot per round)
//        {type:'special', device, target, x, y}   device: 'stasis'|'pulsar'|'stream'|'blackhole'|'dissipator'|'technull'|'repulsor'|'teleport'
//        {type:'planet-weapon', slot}         planet only: choose which missile slot fires this round (the original's Missile toggle)
//        {type:'scan', target}                 needs a Battle Scanner on that side → {type:'scan', info}
//        {type:'wait'}                        defer the turn to the end of the round (once)       {type:'done'}   end the turn (beams still fire as reaction fire later)
//        {type:'retreat'}                     flag the group; it moves away NOW (as AI) and leaves the field the next time it is activated (enemy gets one more turn)
//        Bad input → [{type:'invalid', reason}] (events.ok === false).  After the last unit of the round acts: B.active = null, B.phase = 'roundEnd'.
//    endRound(B) → events[]               missiles refill/lose fuel, round counter, AI retreat check, new initiative order; timeout after 50 rounds. Also fast-forwards
//                                         the rest of the current round (all remaining units skip) if called early.
//    aiTurn(B, side) → [{unit, action, events}]   the engine's AI plays the ACTIVE unit if it belongs to `side` (0|1; omit = whoever is active) and ends its turn.
//    isOver(B) → bool        finish(B) → result       retreatAll(B, side)  flags every group of a side (no pre-battle fight)      scanInfo(B, unit) → plain object
//    hitChance(B, attacker, target, slot) → 0..1      unit(B,id)      liveUnits(B,side)
//
//  EVENT CATALOGUE  { type, … } (grid coordinates are integers except missile positions which are fractional cells):
//    round-start{round,order} turn-start{unit,name,side,round} turn-end{unit} frozen{unit} move{unit,from,to} teleport{unit,from,to}
//    beam{unit,target,slot,weapon,name,shots,hits,damage,x0,y0,x1,y1,blocked} miss{unit,target,slot,count} shield-absorb{target,amount,hits} armor-hit{target,damage,count,hp1,hploss}
//    damage{target,amount} ship-destroyed{target,n,left} explosion{x,y,size} planet-hit{target,damage,popKilled,factoriesKilled} base-destroyed{target,n,left}
//    missile-launch{unit,target,slot,mid,n,kind,weapon,x,y} missile-move{mid,from,to} missile-hit{mid,target,n,hits,intercepted,damage}
//    missile-lost{mid,target,reason:'fuel'|'rock'|'target-lost'|'stasis'|'faded',n} special-effect{unit,device,target,…} cloak{unit,state:'on'|'off'} repair{unit,amount}
//    retreat{unit} warp-out{unit,survivors} scan{unit,target,info} bio-hit{target,popKilled} round-end{round} battle-end{winner,reason} invalid{reason}
//
//  DECISIONS ON THE RESEARCH QUIRKS (research/03 §4.16, §12) — 1oom v1.3 behaviour is the default, switches in C.CONFIG:
//    • beams never lose accuracy with distance; the 95 miss cap is applied BEFORE weapon accuracy bonuses (so +b weapons hit 6%+10%·b at worst); each firing slot's
//      accuracy bonus is subtracted cumulatively for the following slots of the same attack action (also from beams after a missile slot).
//    • excess beam damage on a killed ship is carried (remainder mod hp) as damage on the next ship; one shot kills at most one ship unless it is a streaming weapon.
//    • Oracle Interface does not halve shields (CONFIG.oracleFix=false); Black Hole vs a single ship uses the original's inverted comparison (CONFIG.bhBug).
//    • battle length 51 rounds (the original's off-by-one, verified); timeout → the planet owner's side wins, else the right side (attacker withdraws).
//    • Guardian repair per the v1.3 table (Hard 15%, Impossible 0) – CONFIG.guardianFix=true gives the intended Hard 15 / Impossible 30. Amoeba repairs 50%/round.
//    • AI-vs-AI weights: the 32-bit "doom stack" overflow is NOT reproduced (CONFIG.overflowBug=false); missile bases/pop/factories are untouched by weight battles.
//    • 'Wait' does not re-run the start-of-turn effects (no double repair / re-armed pulsars) — the 1.40m patch behaviour; a waiting group still gives reaction fire (verified).
//    • a planet with 0 missile bases and no ships is not a party (no battle); ships there bombard unopposed (S.bombard).  "No treaty" is hostile, NAP only protects
//      third-party systems (research/05 §4.5, 08 §6.8); at most ONE battle per star per turn (a star with a monster: one battle per empire party vs the monster).
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Combat = M.Sim.Combat || {};
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] | 0; return s; };

  C.VERSION = 1;
  C.CONFIG = {
    maxRounds: 51,            // 1oom really plays 51 rounds (the `> 50` test runs before the counter is incremented) — verified against the source
    maxMissileStacks: 30,     // BATTLE_MISSILE_MAX
    batchShots: 2000,         // volleys above this many shots are sampled and scaled (the original's damagemul2)
    oracleFix: false,         // true: Oracle Interface halves target shields vs the group's beams (not in v1.3)
    bhBug: true,              // true: Black Hole vs a single ship kills when d100 > v (inverted, as shipped)
    guardianFix: false,       // true: Hard = Automated Repair 15%, Impossible = Advanced Damage Control 30%
    amoebaRepair: 50,         // % of a ship's full HP per own turn (1oom table; the guide says 30)
    overflowBug: false,       // true: reproduce the 32-bit overflow of the AI-vs-AI survivor maths
    debug: false,             // true: AI errors throw instead of being logged
  };
  C.W = 10; C.H = 8; C.CELL_W = 32; C.CELL_H = 24;
  C.HULL_W = [1, 5, 25, 125];
  C.ROWS = [3, 4, 2, 5, 1, 6];
  C.BASE_HP = [50, 75, 100, 125, 150, 175, 200];
  C.BASE_MISSILES = ['nuclear-missile', 'hyper-v', 'hyper-x', 'merculite', 'stinger', 'pulson', 'hercular', 'zeon'];
  C.BASE_SCATTER = ['scatter-pack-v', 'scatter-pack-vii', 'scatter-pack-x'];
  C.MONSTER_WEIGHT = { guardian: 100000, crystal: 30000, amoeba: 30000 };
  C.ROCK_P = [10, 9, 8, 7, 7, 6, 5, 4, 3, 3];

  // ---- pure rule maths (unit-tested) ---------------------------------------------------------------------------------------------------------------
  // miss threshold of ONE attack: 50 − 10·(attack level − defense), +30 when the line of fire crosses a rock (beams only), +50 vs a cloaked target; capped at 95
  // BEFORE the weapon's accuracy bonus (10 per point) is subtracted (v1.3 "precap" quirk).  A shot hits iff d100 >= miss.
  C.missThreshold = function (att, def, o) {
    o = o || {};
    let m = 50 - 10 * (att - def);
    if (o.rock) m += 30;
    if (o.cloak) m += 50;
    if (m > 95) m = 95;
    return m - 10 * (o.acc | 0);
  };
  C.hitProb = m => (m <= 1 ? 1 : m > 100 ? 0 : (101 - m) / 100);
  // beam / bomb damage of a roll that hit (roll >= miss): the roll position inside [miss,100] scales min..max (negative miss starts above the minimum)
  C.beamDamage = function (miss, roll, dmin, dmax) {
    const d = dmax - dmin;
    let v = Math.floor(((roll - miss) * 2 * d) / (100 - miss));
    v = Math.floor((v + 1) / 2);
    return v + dmin;
  };
  // damage left after a shield: absorb (halved for shield-halving weapons, integer), never below 0
  C.afterShield = (dmg, absorb, half) => Math.max(0, dmg - (half ? Math.floor(absorb / 2) : absorb));
  C.isBeam = k => k === 'beam' || k === 'special';
  C.isMissile = k => k === 'missile' || k === 'torpedo';

  // ---- race modifiers ---------------------------------------------------------------------------------------------------------------------------------
  const RACE_FALLBACK = { mrrshan: { compLevel: 4, initiative: 4, defense: 0, misDefense: 0 }, alkari: { compLevel: 0, initiative: 3, defense: 3, misDefense: 3 } };
  C.raceMod = function (raceId) {
    const R = M.Data && M.Data.races && M.Data.races[raceId], m = (R && R.mod) || RACE_FALLBACK[raceId] || {};
    return { compLevel: m.compLevel | 0, initiative: m.initiative | 0, defense: m.defense | 0, misDefense: m.misDefense | 0 };
  };
  C.raceWeight = function (raceId) {
    const R = M.Data && M.Data.races && M.Data.races[raceId];
    if (R && R.ai) return R.ai.autoResolveWeight | 0;
    return raceId === 'mrrshan' || raceId === 'alkari' ? 15 : 0;
  };

  // ---- design snapshots ---------------------------------------------------------------------------------------------------------------------------------
  function weightInfo(d, K) {
    const w0 = d && d.weapons && d.weapons[0] && d.weapons[0].type >= 0 && K.WEAPONS[d.weapons[0].type] ? K.WEAPONS[d.weapons[0].type].n : 0;
    const sp = [0, 0, 0];
    if (d && d.specials) for (let i = 0; i < 3; i++) { const si = d.specials[i]; sp[i] = si >= 0 && K.SPECIALS[si] ? K.SPECIALS[si].n : 0; }
    return { shield: d && d.shield >= 0 ? d.shield + 1 : 0, comp: d && d.comp >= 0 ? d.comp + 1 : 0, armor: d ? d.armor | 0 : 0, w0, sp };
  }
  function copyWeapon(w) {
    return { slot: w.slot | 0, id: w.id, n: w.n | 0, name: w.name, kind: w.kind, count: w.count | 0, dmg: [w.dmg[0], w.dmg[1]], range: w.range | 0, rof: w.rof | 0, ammo: w.ammo === undefined ? -1 : w.ammo,
      speed: +w.speed || 0, acc: w.acc | 0, racks: w.racks | 0, warheads: w.warheads | 0, mul: w.mul | 0, heavy: !!w.heavy, flags: Object.assign({}, w.flags), tl: w.tl !== undefined ? w.tl : (w.tech ? w.tech.l : 1) };
  }
  // Design.stats(S,E,slot) → the combat snapshot stored in battle.sides[i].designs[slot] (self-contained: no component tables are needed to fight)
  C.snapshotDesign = function (S, E, slot) {
    const D = M.Sim.Design, K = M.Data.Components, st = D.stats(S, E, slot), d = E.designs && E.designs[slot];
    return {
      slot, name: (d && d.name) || ('Design ' + (slot + 1)), hull: st.hull | 0, hp: st.hp | 0, combatSpeed: st.combatSpeed | 0, warp: st.warp | 0,
      beamDef: st.beamDef | 0, missDef: st.missDef | 0, attack: st.attack | 0, absorb: st.absorb | 0, repair: st.repair | 0, misshield: st.misshield | 0,
      pulsar: st.pulsar | 0, stream: st.stream | 0, cloak: st.cloak | 0, displacement: st.displacement | 0,
      teleport: !!st.teleport, scanner: !!st.scanner, stasis: !!st.stasis, repulsor: !!st.repulsor, dissipator: !!st.dissipator, blackhole: !!st.blackhole, technull: !!st.technull, oracle: !!st.oracle,
      weapons: (st.weapons || []).map(copyWeapon), specials: (st.specials || []).slice(), hullW: st.hullW || K.HULLS[st.hull | 0].w,
      cost: st.cost | 0, armed: !!st.armed, bombs: st.bombs | 0, bio: st.bio | 0, colonyMin: st.colonyMin | 0, wt: weightInfo(d, K),
    };
  };

  // ---- monsters (research/03 §4.15, research/05 §7.4–7.5) -----------------------------------------------------------------------------------------------
  function compWeapon(id, count, slot, rangeBonus) {
    const K = M.Data.Components, w = K.WEAPONS[K.idx.weapons[id]];
    const o = { slot, type: K.idx.weapons[id], id: w.id, n: w.n, name: w.name, kind: w.kind, count, dmg: w.dmg.slice(), range: w.range, rof: w.rof, ammo: w.ammo, speed: w.speed, acc: w.acc, racks: w.racks,
      warheads: w.warheads, mul: w.mul, heavy: w.heavy, flags: Object.assign({}, w.flags), tl: w.tech.l };
    if (rangeBonus && C.isBeam(w.kind)) o.range += rangeBonus;
    return o;
  }
  C.compWeapon = compWeapon;
  C.monsterStats = function (kind, diff) {
    const d = clamp(diff | 0, 0, 4), K = M.Data.Components, ss = {
      slot: 0, name: '', hull: 3, hp: 0, combatSpeed: 2, warp: 1, beamDef: 0, missDef: 0, attack: 10, absorb: 0, repair: 0, misshield: 0, pulsar: 0, stream: 0, cloak: 0, displacement: 0,
      teleport: false, scanner: false, stasis: false, repulsor: false, dissipator: false, blackhole: false, technull: false, oracle: false, weapons: [], specials: [], hullW: 125,
      cost: 0, armed: true, bombs: 0, bio: 0, colonyMin: 0, wt: { shield: 0, comp: 0, armor: 0, w0: 0, sp: [0, 0, 0] }, monster: kind,
    };
    if (kind === 'crystal') {
      ss.name = 'Space Crystal'; ss.hp = 3000 + 1000 * d; ss.beamDef = ss.missDef = 1 + d; ss.absorb = 5; ss.misshield = 100; ss.blackhole = true;
      ss.weapons = [compWeapon('crystal-ray', 10, 0)]; ss.specials = ['lightning-shield', 'black-hole-generator'];
    } else if (kind === 'amoeba') {
      ss.name = 'Space Amoeba'; ss.hp = 1000 + 1000 * d; ss.beamDef = ss.missDef = 1 + d; ss.absorb = 0; ss.misshield = 0; ss.repair = C.CONFIG.amoebaRepair;
      ss.weapons = [compWeapon('amoeba-stream', 1, 0)]; ss.specials = ['advanced-damage-control'];
    } else {
      const rep = C.CONFIG.guardianFix ? [0, 0, 0, 15, 30] : [0, 0, 0, 15, 0];
      ss.name = 'Guardian of Orion'; ss.hp = 2000 + 2000 * d; ss.beamDef = ss.missDef = [1, 3, 5, 7, 9][d]; ss.absorb = [5, 6, 7, 8, 9][d]; ss.misshield = 100; ss.repair = rep[d];
      ss.weapons = [compWeapon('scatter-pack-x-5', [5, 25, 45, 65, 85][d], 0, 3), compWeapon('death-ray', 1, 1, 3), compWeapon('stellar-converter', [5, 15, 25, 35, 45][d], 2, 3),
        compWeapon('plasma-torpedo', [6, 9, 12, 15, 18][d], 3, 3)];
      ss.specials = ['high-energy-focus', 'lightning-shield'];
    }
    void K;
    return ss;
  };

  // ---- who fights whom ----------------------------------------------------------------------------------------------------------------------------------------
  // treaty codes (research/05 §1): 0 none, 1 non-aggression pact, 2 alliance, 3 war, 4 final war.  Unknown without a Diplo module → -1 (nobody is hostile).
  function treatyOf(S, a, b) {
    const D = M.Sim.Diplo;
    if (!D) return -1;
    try {
      if (D.status) { const st = D.status(S, a, b); if (st && st.treaty !== undefined && st.treaty !== null) return typeof st.treaty === 'number' ? st.treaty : -1; }
      if (D.treaty) { const t = D.treaty(S, a, b); if (typeof t === 'number') return t; }
    } catch (e) { /* ignore */ }
    return -1;
  }
  // May `attacker` and `defender` fight at a star whose planet belongs to `starOwner` (-1 = nobody)?  Diplo.canFight (alliance / NAP / ceasefire gate) decides when the
  // module is loaded; the fallback reads the treaty: allies never, a non-aggression pact only at the planet owner's own world, "no treaty" and war always.
  C.hostile = function (S, attacker, defender, starOwner) {
    if (attacker === defender) return false;
    const D = M.Sim.Diplo;
    if (!D) return false;
    if (D.canFight) return !!D.canFight(S, attacker, defender, starOwner);
    if (D.isAllied && D.isAllied(S, attacker, defender)) return false;
    const t = treatyOf(S, attacker, defender);
    if (t === 2) return false;
    if (t === 3 || t === 4) return true;
    if (D.atWar && D.atWar(S, attacker, defender)) return true;
    if (t === 1) return starOwner === attacker || starOwner === defender;
    return t === 0;                                    // "No treaty" is not peace in MOO1
  };

  // ---- the planet's combat snapshot ---------------------------------------------------------------------------------------------------------------------------
  function planetSnapshot(S, p, E) {
    const m = E.mods || {}, tier = clamp(m.baseHp | 0, 0, 6);
    const w1 = C.BASE_MISSILES[clamp((m.baseMissile || 1) - 1, 0, 7)], w2 = m.baseScatter ? C.BASE_SCATTER[clamp(m.baseScatter - 1, 0, 2)] : w1;
    return { id: p.id, owner: p.owner, name: p.name || S.stars[p.starId].name, pop: p.pop | 0, factories: p.factories | 0, bases: p.bases | 0, shield: p.shield | 0, type: p.type, special: p.special,
      maxPop: p.mp3 !== undefined ? p.mp3 : p.maxPop, baseHp: C.BASE_HP[tier], comp: m.baseComp || 1, ecm: m.baseEcm | 0, absorb: m.baseShield || 1, weapon: w1, weapon2: w2,
      interdictor: !!m.interdictor, antidote: m.antidote | 0 };
  }
  function empireSide(S, party, role) {
    const E = S.empires[party.empire], f = party.fleet, designs = [null, null, null, null, null, null], ships = [0, 0, 0, 0, 0, 0];
    if (f) for (let i = 0; i < 6; i++) if ((f.ships[i] | 0) > 0 && E.designs && E.designs[i]) { ships[i] = f.ships[i] | 0; designs[i] = C.snapshotDesign(S, E, i); }
    return { empire: E.id, fleetId: f ? f.id : -1, ships, designs, role, race: E.race, name: E.plural || E.name || E.race, human: !!E.human, mod: C.raceMod(E.race),
      tl: E.research && E.research.tl ? E.research.tl.slice() : [1, 1, 1, 1, 1, 1], autoWeight: C.raceWeight(E.race), antidote: (E.mods && E.mods.antidote) | 0 };
  }
  function monsterSide(mon, diff) {
    const ss = C.monsterStats(mon.kind, diff);
    return { empire: -1, fleetId: -1, ships: [1, 0, 0, 0, 0, 0], designs: [ss, null, null, null, null, null], role: 'attacker', race: 'monster', name: ss.name, human: false,
      mod: { compLevel: 0, initiative: 0, defense: 0, misDefense: 0 }, tl: [1, 1, 1, 1, 1, 1], autoWeight: 0, antidote: 0, monster: { kind: mon.kind, id: mon.id } };
  }
  C.monsterSide = monsterSide;
  function mkBattle(S, star, defP, attP, mon) {
    const p = S.planets[star], diff = (S.settings && S.settings.diffIdx) | 0;
    const dSide = empireSide(S, defP, 'defender'), aSide = mon ? monsterSide(mon, diff) : empireSide(S, attP, 'attacker');
    const sides = !dSide.human && aSide.human ? [aSide, dSide] : [dSide, aSide];
    let planet = null, planetSide = -1;
    if (p && p.owner >= 0 && (p.pop | 0) > 0) {
      const si = sides.findIndex(s => s.empire === p.owner);
      if (si >= 0) { planet = planetSnapshot(S, p, S.empires[p.owner]); planetSide = si; }
    }
    return { v: 1, star, starName: S.stars[star].name, planet, sides, planetSide, nebula: !!S.stars[star].nebula, bg: p ? p.bg | 0 : 0, rocks: (p && p.rocks) || 'none',
      attacker: aSide.empire, defender: dSide.empire, human: !!(dSide.human || aSide.human), diff, seed: String(S.seed) + ':' + S.turn + ':' + star + (mon ? ':m' + dSide.empire : '') };
  }
  function monstersByStar(S) {
    const out = {};
    const put = (star, m) => { (out[star] = out[star] || []).push(m); };
    if (S.guardian && S.guardian.alive && S.orion !== undefined && S.orion >= 0) put(S.orion, { kind: 'guardian', id: -2 });
    if (S.settings && S.settings.options && S.settings.options.monsters === false) return out;
    for (const m of (S.monsters || [])) {
      // Sim.Events model: {id, kind, star (-1 while flying), attackable (false while it rests after a strike), killer (-1 or the killer's id), gone}
      if (!m || m.gone || m.dead || m.killer >= 0) continue;
      const star = m.star !== undefined ? m.star : -1, kind = m.kind || m.type;
      if (!(star >= 0) || (kind !== 'crystal' && kind !== 'amoeba') || m.attackable === false || m.resting === true) continue;
      put(star, { kind, id: m.id });
    }
    return out;
  }
  const hasWeapons = (S, E, f) => { for (let i = 0; i < 6; i++) if ((f.ships[i] | 0) > 0 && E.designs && E.designs[i] && M.Sim.Design.stats(S, E, i).weapons.length > 0) return true; return false; };

  // ---- findBattles ------------------------------------------------------------------------------------------------------------------------------------------------
  C.findBattles = function (S, R) {
    void R;
    S.bombard = [];
    const battles = [], n = S.stars.length, fleetsAt = new Array(n), mons = monstersByStar(S);
    for (const f of S.fleets) {
      if (!(f.star >= 0) || !(total(f.ships) > 0)) continue;
      const E = S.empires[f.owner]; if (!E || !E.alive) continue;
      (fleetsAt[f.star] = fleetsAt[f.star] || []).push(f);
    }
    const fought = {};
    for (let star = 0; star < n; star++) {
      const p = S.planets[star], fl = fleetsAt[star] || [], ms = mons[star] || [];
      const owner = p && p.owner >= 0 && S.empires[p.owner] && S.empires[p.owner].alive ? p.owner : -1;
      const parties = [];
      const add = (e, fleet, planet) => {
        let q = parties.find(x => x.empire === e);
        if (!q) { q = { empire: e, fleet: null, planet: false }; parties.push(q); }
        if (fleet) q.fleet = fleet; if (planet) q.planet = true;
      };
      if (owner >= 0 && (p.bases | 0) > 0) add(owner, null, true);
      for (const f of fl) add(f.owner, f, false);
      parties.sort((a, b) => (a.empire === owner ? -1 : b.empire === owner ? 1 : a.empire - b.empire));
      if (ms.length && parties.length) {
        for (const q of parties) battles.push(mkBattle(S, star, q, null, ms[0]));
        fought[star] = true;
      } else if (parties.length >= 2) {
        let pair = null;
        for (let i = 0; i < parties.length && !pair; i++) for (let j = i + 1; j < parties.length && !pair; j++) {
          if (C.hostile(S, parties[j].empire, parties[i].empire, owner)) pair = [parties[i], parties[j]];      // the planet owner / lowest id defends
        }
        if (pair) { battles.push(mkBattle(S, star, pair[0], pair[1], null)); fought[star] = true; }
      }
    }
    // unopposed bombardment candidates: armed ships over an enemy colony that nobody defends this turn
    for (let star = 0; star < n; star++) {
      if (fought[star]) continue;
      const p = S.planets[star], fl = fleetsAt[star];
      if (!fl || !p || p.owner < 0 || !(p.pop > 0) || (p.bases | 0) > 0) continue;
      if (fl.some(f => f.owner === p.owner)) continue;
      const D = M.Sim.Diplo;
      for (const f of fl) {
        const E = S.empires[f.owner];
        if (f.owner === p.owner || (D && D.isAllied && D.isAllied(S, f.owner, p.owner)) || !hasWeapons(S, E, f)) continue;
        S.bombard.push({ empire: f.owner, planet: p.id, target: p.owner, star });
      }
    }
    return battles;
  };
});

// ======================================================================================================================================================
//  TACTICAL ENGINE: battle state, movement, firing, missiles in flight, special devices, turn flow  (research/03 §4.2–4.11)
// ======================================================================================================================================================
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Combat;
  const CW = C.CELL_W, CH = C.CELL_H;
  const isBeam = C.isBeam, isMis = C.isMissile;
  const alive = u => !u.gone && u.count > 0;
  const rngOf = B => M.RNG.bind(B.rs);
  const roll100 = r => 1 + Math.floor(r.next() * 100);
  const cdist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const unitOf = (B, u) => (u !== null && typeof u === 'object' ? B.units[u.id] : B.units[u]);
  const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const hpOf = u => (u.count > 0 ? (u.count - 1) * u.hp1 + Math.max(0, u.hp1 - u.hploss) : 0);
  const logLine = (B, s) => { B.log.push(s); if (B.log.length > 300) B.log.splice(0, B.log.length - 300); };
  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] | 0; return s; };

  // ---- geometry helpers ------------------------------------------------------------------------------------------------------------------------------------
  function rockAt(B, x, y) { const R = B.rocks; for (let i = 0; i < R.length; i++) if (R[i].x === x && R[i].y === y) return true; return false; }
  function planetCell(B, x, y) { const p = B.units[0]; return !!(p && p.kind === 'planet' && p.x === x && p.y === y); }
  function unitAtCell(B, x, y) { for (let i = 0; i < B.units.length; i++) { const u = B.units[i]; if (u.kind !== 'planet' && alive(u) && u.x === x && u.y === y) return u; } return null; }
  // breadth-first reach: Chebyshev steps, rocks and the planet block, other groups may be passed through
  function reach(B, u) {
    const W = B.w, H = B.h, dist = new Array(W * H).fill(-1), par = new Array(W * H).fill(-1), q = [u.y * W + u.x];
    dist[q[0]] = 0;
    const lim = u.actman;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % W, cy = (c - cx) / W;
      if (dist[c] >= lim) continue;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DIRS[k][0], ny = cy + DIRS[k][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (dist[ni] >= 0 || rockAt(B, nx, ny) || planetCell(B, nx, ny)) continue;
        dist[ni] = dist[c] + 1; par[ni] = c; q.push(ni);
      }
    }
    return { dist, par };
  }
  function pathTo(B, rm, idx) {
    const out = [];
    for (let c = idx; c >= 0 && rm.dist[c] > 0; c = rm.par[c]) out.push({ x: c % B.w, y: Math.floor(c / B.w) });
    return out.reverse();
  }
  // a beam is "blocked" when its line of fire passes through a rock square (+30 miss, counted once per attack)
  function lineBlocked(B, a, b) {
    if (!B.rocks.length) return false;
    if (b.kind === 'planet') return false;                                    // the planet's own cell overwrites the marker: shots AT the planet never get +30 (research/03-verification #4)
    const dx = b.x - a.x, dy = b.y - a.y, n = Math.max(Math.abs(dx), Math.abs(dy)) * 4;
    let last = 0;                                                             // the LAST obstructing cell on the line decides: a rock counts, a planet cell behind it cancels it, ships never count
    for (let i = 1; i < n; i++) {
      const t = i / n, cx = Math.floor(a.x + 0.5 + dx * t), cy = Math.floor(a.y + 0.5 + dy * t);
      if ((cx === a.x && cy === a.y) || (cx === b.x && cy === b.y)) continue;
      if (rockAt(B, cx, cy)) last = 1; else if (planetCell(B, cx, cy)) last = 2;
    }
    return last === 1;
  }

  // ---- building the battle -------------------------------------------------------------------------------------------------------------------------------
  function mkWeapon(w) {
    const f = w.flags || {}, rof = Math.max(1, w.rof | 0);
    return { id: w.id, n: w.n | 0, name: w.name, kind: w.kind, count: w.count | 0, dmin: w.dmg[0], dmax: w.dmg[1], range: w.range | 0, rof, numfire: rof, shots: w.ammo === undefined ? -1 : w.ammo,
      acc: w.acc | 0, speed: +w.speed || 0, warheads: Math.max(1, w.warheads | 0), mul: Math.max(1, w.mul | 0), racks: w.racks | 0, tl: w.tl | 0,
      half: !!f.halfShield, stream: !!f.streaming, every2: !!f.everyOtherRound, fade: !!f.damageFade };
  }
  function mkUnit(B, id, sideIdx, side, ss, slot, count, x, y) {
    const rm = side.mod || {};
    const sp = { scanner: !!ss.scanner, cloak: (ss.cloak | 0) > 0, stasis: !!ss.stasis, pulsar: ss.pulsar | 0, stream: ss.stream | 0, bh: !!ss.blackhole, tn: !!ss.technull, wd: !!ss.dissipator,
      repulsor: !!ss.repulsor, teleport: !!ss.teleport, oracle: !!ss.oracle, disp: ss.displacement | 0 };
    return {
      id, side: sideIdx, kind: side.monster ? 'monster' : 'ship', empire: side.empire, slot, name: ss.name, hull: ss.hull, count, hp1: ss.hp, hp2: ss.hp, hploss: 0, x, y,
      speed: ss.combatSpeed | 0, actman: ss.combatSpeed | 0, unman: 0,
      comp: (ss.attack | 0) + (rm.compLevel | 0), def: (ss.beamDef | 0) + (rm.defense | 0), mdef: (ss.missDef | 0) + (rm.misDefense | 0),
      absorb: B.nebula ? 0 : (ss.absorb | 0), misshield: ss.misshield | 0, repair: ss.repair | 0,
      init: (ss.scanner ? 3 : 0) + Math.max(0, (rm.initiative | 0) - (rm.compLevel | 0)),
      weapons: (ss.weapons || []).map(mkWeapon), sp,
      st: { cloak: sp.cloak ? 1 : 0, stasis: 0, stasisBy: -1, retreat: 0, subspace: sp.teleport ? 1 : 0, canRetaliate: false, used: {}, fired: false, noFire: false, begun: false, waited: false, rep: true },
      gone: false, left: false,
    };
  }
  function mkPlanetUnit(B, pl, sideIdx, side) {
    const rm = side.mod || {}, w0 = C.compWeapon(pl.weapon || 'nuclear-missile', 3, 0), w1 = C.compWeapon(pl.weapon2 || pl.weapon || 'nuclear-missile', 3, 1);
    w0.range = 40; w1.range = 40; w0.ammo = -1; w1.ammo = -1;
    return {
      id: 0, side: sideIdx, kind: 'planet', empire: pl.owner, slot: -1, name: pl.name || 'Planet', hull: -1, count: pl.bases | 0, hp1: pl.baseHp, hp2: pl.baseHp, hploss: 0,
      x: sideIdx === 0 ? 1 : 8, y: 3, speed: 0, actman: 0, unman: 0, comp: (pl.comp | 0) + 1 + (rm.compLevel | 0), def: 1, mdef: (pl.ecm | 0) + 1,
      absorb: B.nebula ? 0 : (pl.absorb | 0) + (pl.shield | 0), misshield: 0, repair: 0, init: 3 + Math.max(0, (rm.initiative | 0) - (rm.compLevel | 0)),
      weapons: [mkWeapon(w0), mkWeapon(w1)], planetSlot: 0,
      sp: { scanner: true, cloak: false, stasis: false, pulsar: 0, stream: 0, bh: false, tn: false, wd: false, repulsor: false, teleport: false, oracle: false, disp: 0 },
      st: { cloak: 0, stasis: 0, stasisBy: -1, retreat: 0, subspace: pl.interdictor ? 1 : 0, canRetaliate: false, used: {}, fired: false, noFire: false, begun: false, waited: false, rep: false },
      gone: false, left: false,
    };
  }
  function placeRocks(B, kind) {
    const r = rngOf(B), n = kind === 'many' ? r.int(5, 7) : kind === 'some' ? r.int(1, 4) : 0, pu = B.units[0] && B.units[0].kind === 'planet' ? B.units[0] : null;
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 80; tries++) {
        const x = r.int(2, 8), y = r.int(0, 7);
        if (pu && Math.max(Math.abs(x - pu.x), Math.abs(y - pu.y)) <= 1) continue;
        let bad = false;
        for (const q of B.rocks) if (Math.abs(q.x - x) + Math.abs(q.y - y) === 1) { bad = true; break; }
        if (bad) continue;
        if (!rockAt(B, x, y)) B.rocks.push({ x, y });
        break;
      }
    }
  }
  const seedRng = function (B, battle, R) {
    if (R && typeof R.next === 'function') {
      B.rs = [0, 0, 0, 0].map(() => Math.floor(R.next() * 4294967296) >>> 0);
      const g = M.RNG.bind(B.rs); for (let i = 0; i < 6; i++) g.next();
    } else B.rs = M.RNG.seedState('bt:' + (battle.seed !== undefined ? battle.seed : battle.star));
  };

  C.create = function (S, battle, R) {
    void S;
    const B = { v: 1, w: C.W, h: C.H, round: 0, phase: 'turn', active: null, order: [], units: [], planet: null, rocks: [], missiles: [], log: [], over: null, pend: [],
      star: battle.star, starName: battle.starName || '', nebula: !!battle.nebula, bg: battle.bg | 0, diff: battle.diff | 0, mid: 1, planetSide: battle.planetSide === undefined ? -1 : battle.planetSide,
      sides: [], rs: null, attacker: battle.attacker, defender: battle.defender, human: !!battle.human, planetSlot: 0 };
    seedRng(B, battle, R);
    for (let i = 0; i < 2; i++) {
      const s = battle.sides[i];
      B.sides.push({ empire: s.empire, fleetId: s.fleetId === undefined ? -1 : s.fleetId, name: s.name || '', race: s.race || '', role: s.role || '', human: !!s.human, ctl: s.human ? 'human' : 'ai',
        initial: (s.ships || [0, 0, 0, 0, 0, 0]).slice(), monster: s.monster || null, mod: s.mod || null, antidote: s.antidote | 0, fled: [0, 0, 0, 0, 0, 0], tl: (s.tl || [1, 1, 1, 1, 1, 1]).slice() });
    }
    const pl = battle.planet;
    if (pl && B.planetSide >= 0) {
      const pu = mkPlanetUnit(B, pl, B.planetSide, battle.sides[B.planetSide]);
      B.units.push(pu);
      B.planet = { id: pl.id, owner: pl.owner, name: pl.name, side: B.planetSide, bases0: pl.bases | 0, pop0: pl.pop | 0, fac0: pl.factories | 0, pop: pl.pop | 0, factories: pl.factories | 0,
        popAcc: 0, facAcc: 0, popKilled: 0, factoriesKilled: 0, bio: 0, antidote: pl.antidote | 0, shield: pl.shield | 0, absorb: pl.absorb | 0, interdictor: !!pl.interdictor };
    }
    for (let si = 0; si < 2; si++) {
      const s = battle.sides[si];
      let k = 0;
      for (let slot = 0; slot < 6; slot++) {
        const cnt = s.ships ? s.ships[slot] | 0 : 0, ss = s.designs && s.designs[slot];
        if (cnt <= 0 || !ss) continue;
        B.units.push(mkUnit(B, B.units.length, si, s, ss, slot, cnt, si === 0 ? 0 : 9, s.monster ? 3 : C.ROWS[k % 6]));
        k++;
      }
    }
    placeRocks(B, battle.rocks);
    // a Subspace Interdictor over the planet cancels every teleporter if the attackers own any (research/03 §4.4)
    if (B.planet && B.planet.interdictor && B.units.some(u => u.sp.teleport && B.sides[u.side].role === 'attacker')) for (const u of B.units) if (u.sp.teleport) u.st.subspace = -1;
    for (const u of B.units) if (u.sp.scanner) B.sides[u.side].scanner = true;
    if (!checkOver(B, B.pend)) beginRound(B, B.pend);
    return B;
  };

  // ---- initiative, rounds, turns -------------------------------------------------------------------------------------------------------------------------
  // priority = attack level + combat speed − slowed + 3 (Battle Scanner; planets with bases count as having one) + 3 Alkari + 1000 for a ready teleporter (research/03 §4.3)
  const prio = u => u.comp + u.speed - u.unman + u.init + (u.st.subspace === 1 && (u.sp.teleport || u.kind === 'planet') ? 1000 : 0);   // a Subspace Interdictor planet carries the +1000 too (verified against 1oom)
  C.priority = prio;
  function computeOrder(B) {
    const ids = [];
    for (const u of B.units) if (alive(u)) ids.push(u.id);
    ids.sort((a, b) => (prio(B.units[b]) - prio(B.units[a])) || (b - a));     // ties: later item first (right side before left, later design before earlier)
    B.order = ids;
  }
  function beginRound(B, ev) {
    B.round++;
    for (const u of B.units) {
      if (!alive(u)) continue;
      u.actman = Math.max(0, u.speed - u.unman);
      const st = u.st; st.canRetaliate = false; st.begun = false; st.waited = false; st.fired = false; st.rep = u.sp.repulsor;
      for (const w of u.weapons) w.numfire = Math.min(w.numfire + w.rof, w.rof);
    }
    if (C.aiRetreatCheck) C.aiRetreatCheck(B, ev);
    computeOrder(B);
    ev.push({ type: 'round-start', round: B.round, order: B.order.slice() });
    nextActive(B, ev);
  }
  function release(B, u) { for (const o of B.units) if (o.st.stasisBy === u.id) { o.st.stasisBy = -1; o.st.stasis = 0; } }
  function leave(B, u, ev) {
    u.left = true; u.gone = true;
    release(B, u); dropMissilesFor(B, u.id, 'target-lost', ev);
    if (u.slot >= 0) B.sides[u.side].fled[u.slot] += u.count;
    ev.push({ type: 'warp-out', unit: u.id, survivors: u.count });
    logLine(B, u.name + ' leaves the battle');
  }
  function groups(B, side) { let n = 0; for (const u of B.units) if (u.side === side && alive(u)) n++; return n; }
  function setOver(B, ev, winner, reason) {
    B.over = { winner, reason }; B.phase = 'over'; B.active = null; B.order = [];
    ev.push({ type: 'battle-end', winner, reason });
    return true;
  }
  function checkOver(B, ev) {
    if (B.over) return true;
    if (groups(B, 0) === 0) return setOver(B, ev, 1, 'wiped');
    if (groups(B, 1) === 0) return setOver(B, ev, 0, 'wiped');
    return false;
  }
  function beginTurn(B, u, ev) {
    const st = u.st;
    st.canRetaliate = true;
    if (!st.begun) {
      st.begun = true; st.used = {}; st.fired = false; st.noFire = false; st.rep = u.sp.repulsor;
      for (const o of B.units) if (o.st.stasisBy === u.id && o.st.stasis > 0) { o.st.stasis = 0; o.st.stasisBy = -1; ev.push({ type: 'special-effect', unit: u.id, device: 'stasis-end', target: o.id }); }
      if (u.repair > 0) {
        const rep = Math.floor(u.hp2 * u.repair / 100);
        if (rep > 0) {
          if (u.hp1 < u.hp2) u.hp1 = Math.min(u.hp2, u.hp1 + rep); else u.hploss = Math.max(0, u.hploss - rep);
          ev.push({ type: 'repair', unit: u.id, amount: rep });
        }
      }
    }
    ev.push({ type: 'turn-start', unit: u.id, name: u.name, side: u.side, round: B.round });
  }
  function closeTurn(B, u, ev) {
    if (u.sp.cloak && u.st.cloak === 2 && !u.st.fired) { u.st.cloak = 1; ev.push({ type: 'cloak', unit: u.id, state: 'on' }); }
    advanceMissiles(B, u, ev);
    ev.push({ type: 'turn-end', unit: u.id });
  }
  // makes the next able unit active (groups ordered to retreat play their own turn here; frozen groups are skipped)
  function nextActive(B, ev) {
    B.active = null;
    while (B.order.length) {
      const id = B.order.shift(), u = B.units[id];
      if (!alive(u)) continue;
      if (u.st.retreat >= 2) { leave(B, u, ev); if (checkOver(B, ev)) return; continue; }
      if (u.st.stasis > 0) { ev.push({ type: 'frozen', unit: id }); advanceMissiles(B, u, ev); continue; }
      if (u.st.retreat === 1) {
        beginTurn(B, u, ev); retreatMove(B, u, ev);
        if (alive(u)) { u.st.retreat = 2; closeTurn(B, u, ev); }
        if (checkOver(B, ev)) return;
        continue;
      }
      B.active = id; beginTurn(B, u, ev);
      return;
    }
    B.phase = B.over ? 'over' : 'roundEnd';
  }
  function endTurn(B, u, ev) {
    closeTurn(B, u, ev);
    if (checkOver(B, ev)) return;
    nextActive(B, ev);
  }

  // ---- damage ----------------------------------------------------------------------------------------------------------------------------------------------
  // `allowed` = ships one shot may kill (1; unlimited for streaming weapons). The unclamped remainder stays on the next ship (research/03 §4.6).
  function hitStack(t, dmg, allowed) {
    t.hploss += dmg;
    let kills = 0;
    while (t.hp1 > 0 && t.hploss >= t.hp1 && kills < allowed && kills < t.count) { kills++; t.hploss -= t.hp1; }
    if (t.hp1 > 0 && t.hploss >= t.hp1) t.hploss %= t.hp1;
    t.count -= kills;
    if (t.count <= 0) { t.count = 0; t.hploss = 0; }
    return kills;
  }
  function afterDamage(B, t, ev) {
    if (t.count > 0) return;
    if (t.kind !== 'planet') t.gone = true;
    release(B, t); dropMissilesFor(B, t.id, 'target-lost', ev);
    if (t.kind === 'planet' && B.planet && B.planet.interdictor) for (const o of B.units) if (o.sp.teleport && o.st.subspace === -1) o.st.subspace = 1;      // the last base falls: teleporters work again
  }
  function dropMissilesFor(B, id, reason, ev) {
    for (let i = 0; i < B.missiles.length; i++) {
      const m = B.missiles[i];
      if (m.target === id) { ev.push({ type: 'missile-lost', mid: m.id, target: id, reason, n: m.n }); B.missiles.splice(i, 1); i--; }
    }
  }
  function report(B, t, info, ev) {
    if (info.absorbed > 0) ev.push({ type: 'shield-absorb', target: t.id, amount: info.absorbed, hits: info.hits });
    if (info.dealt > 0) {
      ev.push({ type: 'armor-hit', target: t.id, damage: info.dealt, count: t.count, hp1: t.hp1, hploss: t.hploss });
      ev.push({ type: 'damage', target: t.id, amount: info.dealt });
    }
    if (info.kills > 0) {
      if (t.kind === 'planet') ev.push({ type: 'base-destroyed', target: t.id, n: info.kills, left: t.count });
      else { ev.push({ type: 'ship-destroyed', target: t.id, n: info.kills, left: t.count }); ev.push({ type: 'explosion', x: t.x, y: t.y, size: t.hull >= 3 ? 3 : t.hull >= 2 ? 2 : 1 }); }
      logLine(B, (info.kills) + ' ' + t.name + (t.kind === 'planet' ? ' base(s)' : ' ship(s)') + ' destroyed');
    }
    afterDamage(B, t, ev);
  }
  // damage that reaches a planet also kills population and factories: 200 damage = 1 pop, 50 = 1 factory; halved while a base still stands (research/03 §4.8)
  function planetCollateral(B, sum, ev, standing) {
    const P = B.planet, pu = B.units[0];
    if (!P || !pu || pu.kind !== 'planet' || sum <= 0) return;
    const v = (standing !== undefined ? standing : pu.count > 0) ? Math.floor(sum / 2) : sum;           // missiles test "a base is standing" BEFORE their kills, beams and bombs after
    P.popAcc += v; P.facAcc += v;
    const dp = Math.floor(P.popAcc / 200), df = Math.floor(P.facAcc / 50);
    P.popAcc -= dp * 200; P.facAcc -= df * 50;
    const kp = Math.min(dp, P.pop), kf = Math.min(df, P.factories);
    P.pop -= kp; P.factories -= kf; P.popKilled += kp; P.factoriesKilled += kf;
    if (kp > 0 || kf > 0) ev.push({ type: 'planet-hit', target: pu.id, damage: sum, popKilled: kp, factoriesKilled: kf });
  }

  // ---- hit chances / weapon plans ------------------------------------------------------------------------------------------------------------------------
  function baseMiss(B, u, t) {
    const cloak = t.kind !== 'planet' && t.st.cloak === 1, blocked = t.kind === 'planet' ? false : lineBlocked(B, u, t);
    const mb = 50 - 10 * (u.comp - t.def) + (blocked ? 30 : 0) + (cloak ? 50 : 0), mm = 50 - 10 * (u.comp - t.mdef) + (cloak ? 50 : 0);
    return { mb: mb > 95 ? 95 : mb, mm: mm > 95 ? 95 : mm, blocked, cloak };
  }
  function canTarget(B, u, t) {
    if (!t || t.side === u.side || t.left || t.gone) return false;
    if (t.kind === 'planet') return !!B.planet;
    return t.count > 0;
  }
  function weaponReady(B, u, w, wi, t, d, reaction) {
    if (w.count <= 0 || w.numfire <= 0 || w.shots === 0) return false;
    if (u.kind === 'planet' && wi !== u.planetSlot) return false;
    if (reaction && !isBeam(w.kind)) return false;
    const k = w.kind;
    if (u.st.retreat > 0 && k !== 'bomb' && k !== 'bio') return false;
    if (k === 'bomb' || k === 'bio') return t.kind === 'planet' && d <= 1;
    if (t.kind === 'planet' && t.count <= 0) return false;
    if (d > w.range) return false;
    if (isMis(k) && B.missiles.length >= C.CONFIG.maxMissileStacks) return false;
    return true;
  }
  function modeOk(mode, w) {
    if (mode === 'beam') return isBeam(w.kind);
    if (mode === 'missile') return isMis(w.kind);
    if (mode === 'bomb') return w.kind === 'bomb' || w.kind === 'bio';
    return true;
  }
  // The shared plan used both by the UI (targets/hitChance) and by the real attack: slot list with the exact miss threshold each slot fires with.
  // Accuracy bonuses accumulate over the slots of ONE attack action (v1.3 quirk) for beams and bombs; a missile rolls its own threshold when it lands.
  function weaponPlan(B, u, t, mode, reaction, slots) {
    const d = cdist(u, t), bm = baseMiss(B, u, t), out = [];
    let mb = bm.mb, mm = bm.mm;
    for (let wi = 0; wi < u.weapons.length; wi++) {
      const w = u.weapons[wi];
      if (slots && slots.indexOf(wi) < 0) continue;
      if (mode && !modeOk(mode, w)) continue;
      if (!weaponReady(B, u, w, wi, t, d, reaction)) continue;
      mb -= 10 * w.acc; mm -= 10 * w.acc;
      let miss;
      if (isBeam(w.kind)) miss = mb; else if (w.kind === 'bomb') miss = mm; else if (w.kind === 'bio') miss = 0; else miss = bm.mm - 10 * w.acc;
      out.push({ slot: wi, kind: w.kind, miss, hit: w.kind === 'bio' ? 1 : C.hitProb(miss) });
    }
    return { d, bm, plan: out };
  }
  C.hitChance = function (B, attacker, target, slot) {
    const u = unitOf(B, attacker), t = unitOf(B, target);
    if (!u || !t) return 0;
    const p = weaponPlan(B, u, t, null, false, null).plan;
    if (slot === undefined || slot === null) return p.length ? p[0].hit : 0;
    const q = p.find(x => x.slot === slot);
    if (q) return q.hit;
    const w = u.weapons[slot]; if (!w) return 0;
    const bm = baseMiss(B, u, t);
    return C.hitProb((isBeam(w.kind) ? bm.mb : bm.mm) - 10 * w.acc);
  };

  // ---- firing ------------------------------------------------------------------------------------------------------------------------------------------------
  function fireBeam(B, r, u, w, wi, t, miss, bomb, blocked, acc, ev) {
    const shots = u.count * w.count * w.numfire;
    w.numfire = 0;
    if (bomb && w.shots > 0) w.shots--;
    let n = shots, mult = 1;
    if (n > C.CONFIG.batchShots) { mult = Math.ceil(n / C.CONFIG.batchShots); n = Math.ceil(n / mult); }
    const planet = t.kind === 'planet', halve = w.half || (C.CONFIG.oracleFix && u.sp.oracle && !bomb && !planet);
    const ab = halve ? Math.floor(t.absorb / 2) : t.absorb, allowed = w.stream ? Infinity : mult, disp = t.sp.disp > 0;
    let hits = 0, absorbed = 0, dealt = 0, kills = 0;
    for (let i = 0; i < n && t.count > 0; i++) {
      const roll = 1 + Math.floor(r.next() * 100);
      if (roll < miss) continue;
      hits += mult;
      let dmg = C.beamDamage(miss, roll, w.dmin, w.dmax);
      if (planet && !bomb) dmg = Math.floor(dmg / 2);
      const raw = dmg;
      dmg = dmg > ab ? dmg - ab : 0;
      absorbed += (raw - dmg) * mult;
      dmg *= w.mul;
      if (dmg > 0 && disp && roll100(r) < 35) dmg = 0;
      if (dmg <= 0) continue;
      const eff = dmg * mult;
      dealt += eff;
      if (planet) acc.collat += w.stream ? eff : Math.min(dmg, t.hp1) * mult;
      kills += hitStack(t, eff, allowed);
    }
    ev.push({ type: 'beam', unit: u.id, target: t.id, slot: wi, weapon: w.id, name: w.name, kind: w.kind, shots, hits, damage: dealt, x0: u.x, y0: u.y, x1: t.x, y1: t.y, blocked: !!blocked });
    if (shots - hits > 0) ev.push({ type: 'miss', unit: u.id, target: t.id, slot: wi, count: shots - hits });
    logLine(B, u.name + ' fires ' + w.name + ' x' + shots + ' at ' + t.name + ': ' + hits + ' hit, ' + dealt + ' damage');
    report(B, t, { absorbed, dealt, kills, hits }, ev);
  }
  function fireBio(B, r, u, w, wi, t, ev, acc) {
    const n = u.count * w.count * w.numfire, P = B.planet, anti = P ? P.antidote : 0;
    w.numfire = 0; if (w.shots > 0) w.shots--;
    let tot = 0;
    for (let i = 0; i < n; i++) { const v = r.int(0, w.dmax) - anti; if (v > 0) tot += v; }
    const killed = P ? Math.min(tot, P.pop) : 0;
    if (P) { P.pop -= killed; P.popKilled += killed; P.bio += tot; }
    ev.push({ type: 'beam', unit: u.id, target: t.id, slot: wi, weapon: w.id, name: w.name, kind: w.kind, shots: n, hits: n, damage: tot, x0: u.x, y0: u.y, x1: t.x, y1: t.y, blocked: false });
    ev.push({ type: 'bio-hit', target: t.id, popKilled: killed });
    logLine(B, u.name + ' drops ' + w.name + ': ' + killed + ' population killed');
    // research/03-verification #8: after the population step the ordinary bomb damage loop runs too, with damage = the weapon's minimum (1/2/3) minus the planet's absorb
    if (P && acc && t.count > 0 && w.dmax > 0) {
      const bw = Object.assign({}, w, { kind: 'bomb', dmin: w.dmax, dmax: w.dmax, mul: 1, half: false, stream: false, shots: -1, numfire: n / Math.max(1, u.count * w.count) }), tmp = [];
      fireBeam(B, r, u, bw, wi, t, 0, true, false, acc, tmp);
      for (const e of tmp) if (e.type !== 'beam' && e.type !== 'miss') ev.push(e);
    }
  }
  function launch(B, u, w, wi, t, ev) {
    const n = u.count * w.count * w.warheads;
    if (w.shots > 0) w.shots--;
    w.numfire -= w.every2 ? 2 : 1;
    const m = { id: B.mid++, shooter: u.id, side: u.side, target: t.id, slot: wi, kind: w.kind, wid: w.id, name: w.name, n, px: (u.x + 0.5) * CW, py: (u.y + 0.5) * CH, spd: w.speed * CW, budget: w.speed * CW,
      fuel: u.kind === 'planet' ? 14 : 2, dmg: w.dmax, mul: w.mul, acc: w.acc, half: w.half, tl: w.tl, fade: w.fade, flown: 0, comp: u.comp, torp: w.kind === 'torpedo' };
    B.missiles.push(m);
    ev.push({ type: 'missile-launch', unit: u.id, target: t.id, slot: wi, mid: m.id, n, kind: w.kind, weapon: w.id, name: w.name, x: u.x, y: u.y });
    logLine(B, u.name + ' launches ' + n + ' ' + w.name + ' at ' + t.name);
  }
  // ONE attack action: every weapon slot that reaches the target fires (research/03 §4.4 step 3).  Returns the number of slots that fired.
  function attackUnit(B, u, t, o, ev) {
    const pl = weaponPlan(B, u, t, o.mode || null, !!o.reaction, o.slots || null);
    if (!pl.plan.length) return 0;
    const r = rngOf(B), acc = { collat: 0 };
    if (u.st.cloak === 1) { u.st.cloak = 2; ev.push({ type: 'cloak', unit: u.id, state: 'off' }); }
    u.st.fired = true;
    for (const p of pl.plan) {
      const w = u.weapons[p.slot];
      if (t.kind === 'planet' && t.count <= 0 && w.kind !== 'bomb' && w.kind !== 'bio') continue;
      if (w.kind === 'bio') fireBio(B, r, u, w, p.slot, t, ev, acc);
      else if (isBeam(w.kind)) fireBeam(B, r, u, w, p.slot, t, p.miss, false, pl.bm.blocked, acc, ev);
      else if (w.kind === 'bomb') fireBeam(B, r, u, w, p.slot, t, p.miss, true, false, acc, ev);
      else launch(B, u, w, p.slot, t, ev);
      if (t.kind !== 'planet' && !alive(t)) break;
    }
    if (acc.collat > 0) planetCollateral(B, acc.collat, ev);
    return pl.plan.length;
  }

  // ---- missiles in flight ---------------------------------------------------------------------------------------------------------------------------------
  function surviveBinomial(r, n, p) {
    if (n <= 0) return 0;
    if (n > 300) { const mean = n * (1 - p), sd = Math.sqrt(n * p * (1 - p)); return clamp0(Math.round(r.normal(mean, sd)), n); }
    let s = 0; for (let i = 0; i < n; i++) if (r.next() >= p) s++;
    return s;
  }
  const clamp0 = (v, n) => (v < 0 ? 0 : v > n ? n : v);
  function impact(B, r, m, t, ev) {
    const cloak = t.kind !== 'planet' && t.st.cloak === 1;
    let miss = 50 - 10 * (m.comp - t.mdef) + (cloak ? 50 : 0);
    if (miss > 95) miss = 95;
    miss -= 10 * m.acc;
    const planet = t.kind === 'planet', icept = t.misshield > 0 ? Math.max(0, t.misshield - m.tl) : 0, disp = t.sp.disp > 0;
    let n = m.n, mult = 1;
    if (n > C.CONFIG.batchShots) { mult = Math.ceil(n / C.CONFIG.batchShots); n = Math.ceil(n / mult); }
    const ab = m.half ? Math.floor(t.absorb / 2) : t.absorb;
    let dmgBase = m.dmg, faded = false;
    if (m.fade) { dmgBase = m.dmg - Math.floor(m.flown / 2); if (dmgBase < 0) faded = true; }
    let hits = 0, icepted = 0, absorbed = 0, tot = 0, clampSum = 0;
    const voided = disp && roll100(r) < 35;                                  // Displacement Device: ONE roll per stack, a 34% chance that the whole volley does nothing (verified)
    const standing = t.count > 0;
    if (!faded) {
      for (let i = 0; i < n; i++) {
        if (roll100(r) < miss) continue;
        hits += mult;
        if (icept > 0 && roll100(r) <= icept) { icepted += mult; continue; }
        let d = dmgBase;
        if (planet && m.torp) d = Math.floor(d / 2);
        const raw = d;
        d = d > ab ? d - ab : 0;
        absorbed += (raw - d) * mult;
        d *= m.mul;
        if (d > t.hp1) d = t.hp1;
        tot += d * mult; clampSum += d * mult;
      }
    }
    if (voided) { tot = 0; clampSum = 0; }
    let kills = 0;
    if (tot > 0) {
      const sum = t.hploss + tot;
      kills = Math.min(t.count, Math.floor(sum / t.hp1));
      t.hploss = sum - kills * t.hp1; if (t.hploss >= t.hp1) t.hploss %= t.hp1;
      t.count -= kills; if (t.count <= 0) { t.count = 0; t.hploss = 0; }
    }
    ev.push({ type: 'missile-hit', mid: m.id, target: t.id, n: m.n, hits, intercepted: icepted, damage: tot, faded });
    logLine(B, m.n + ' ' + m.name + ' reach ' + t.name + ': ' + hits + ' hit, ' + icepted + ' shot down, ' + tot + ' damage');
    if (planet && clampSum > 0) planetCollateral(B, clampSum, ev, standing);
    report(B, t, { absorbed, dealt: tot, kills, hits }, ev);
  }
  // a stack chases the CURRENT position of its target while the target's turn ends (research/03 §4.7); rocks eat missiles on the way (4 px sampling)
  function flyMissile(B, r, m, t, ev) {
    const tx = (t.x + 0.5) * CW, ty = (t.y + 0.5) * CH;
    let dd = Math.hypot(tx - m.px, ty - m.py);
    if (dd > 10 && m.budget > 0) {
      const step = Math.min(m.budget, dd), ux = (tx - m.px) / dd, uy = (ty - m.py) / dd;
      const from = { x: m.px / CW - 0.5, y: m.py / CH - 0.5 };
      let alive_n = m.n;
      if (B.rocks.length) {
        const p = C.ROCK_P[Math.min(m.acc, 9)] / 100;
        for (let s = 4; s <= step && alive_n > 0; s += 4) {
          const sx = m.px + ux * s, sy = m.py + uy * s, cx = Math.floor(sx / CW), cy = Math.floor(sy / CH);
          if (!rockAt(B, cx, cy)) continue;
          const lx = sx - cx * CW, ly = sy - cy * CH;
          if (lx < 2 || lx > 30 || ly < 2 || ly > 22) continue;
          alive_n = surviveBinomial(r, alive_n, p);
        }
      }
      m.px += ux * step; m.py += uy * step; m.budget -= step; m.flown += step;
      ev.push({ type: 'missile-move', mid: m.id, from, to: { x: m.px / CW - 0.5, y: m.py / CH - 0.5 } });
      if (alive_n < m.n) {
        if (alive_n <= 0) { ev.push({ type: 'missile-lost', mid: m.id, target: t.id, reason: 'rock', n: m.n }); return true; }
        m.n = alive_n;
      }
      dd = Math.hypot(tx - m.px, ty - m.py);
    }
    if (dd <= 10) { impact(B, r, m, t, ev); return true; }
    return false;
  }
  function advanceMissiles(B, t, ev) {
    if (!B.missiles.length) return;
    const r = rngOf(B);
    for (let i = 0; i < B.missiles.length; i++) {
      const m = B.missiles[i];
      if (m.target !== t.id) continue;
      if (t.gone || t.count <= 0) { B.missiles.splice(i, 1); i--; continue; }
      if (flyMissile(B, r, m, t, ev)) { const j = B.missiles.indexOf(m); if (j >= 0) B.missiles.splice(j, 1); i = -1; }
      if (t.gone || t.count <= 0) break;
    }
  }

  // ---- movement ------------------------------------------------------------------------------------------------------------------------------------------
  function reactionFire(B, mover, ev) {
    if (mover.st.cloak === 1) return;                       // a cloaked mover provokes no reaction fire
    for (const e of B.units) {
      if (e.side === mover.side || e.kind === 'planet' || !alive(e) || !alive(mover)) continue;
      if (!e.st.canRetaliate || e.st.stasis > 0 || e.st.retreat > 0) continue;
      const d = cdist(e, mover);
      if (!e.weapons.some(w => isBeam(w.kind) && w.count > 0 && w.numfire > 0 && d <= w.range)) continue;
      attackUnit(B, e, mover, { reaction: true }, ev);
      if (checkOver(B, ev)) return;
    }
  }
  // push `mover` one square straight away from `src` (or one of the two flanking squares) when the square is free
  function pushAway(B, src, mover, ev) {
    const dx = Math.sign(mover.x - src.x), dy = Math.sign(mover.y - src.y);
    const cands = [[dx, dy]];
    if (dx && dy) cands.push([dx, 0], [0, dy]); else if (dx) cands.push([dx, 1], [dx, -1]); else cands.push([1, dy], [-1, dy]);
    for (const c of cands) {
      const nx = mover.x + c[0], ny = mover.y + c[1];
      if (nx < 0 || ny < 0 || nx >= B.w || ny >= B.h || rockAt(B, nx, ny) || planetCell(B, nx, ny) || unitAtCell(B, nx, ny)) continue;
      const from = { x: mover.x, y: mover.y };
      mover.x = nx; mover.y = ny;
      ev.push({ type: 'special-effect', unit: src.id, device: 'repulsor', target: mover.id, to: { x: nx, y: ny } });
      ev.push({ type: 'move', unit: mover.id, from, to: { x: nx, y: ny }, push: true });
      return true;
    }
    return false;
  }
  function repulsors(B, mover, ev) {
    for (const e of B.units) {
      if (e.side === mover.side || !alive(e) || !e.sp.repulsor || !e.st.rep || e.st.stasis > 0 || e.st.retreat > 0 || cdist(e, mover) !== 1) continue;
      e.st.rep = false;
      if (pushAway(B, e, mover, ev)) return true;
    }
    return false;
  }
  function doMove(B, u, tx, ty, ev) {
    const bad = reason => { ev.push({ type: 'invalid', reason }); ev.ok = false; };
    if (u.kind === 'planet') return bad('planets do not move');
    if (u.st.stasis > 0) return bad('frozen');
    if (tx === u.x && ty === u.y) return bad('already there');
    if (!(tx >= 0 && ty >= 0 && tx < B.w && ty < B.h) || rockAt(B, tx, ty) || planetCell(B, tx, ty) || unitAtCell(B, tx, ty)) return bad('cell not free');
    const rm = reach(B, u), idx = ty * B.w + tx;
    if (rm.dist[idx] > 0) {
      for (const c of pathTo(B, rm, idx)) {
        const from = { x: u.x, y: u.y };
        u.x = c.x; u.y = c.y; u.actman--;
        ev.push({ type: 'move', unit: u.id, from, to: { x: u.x, y: u.y } });
        reactionFire(B, u, ev);
        if (B.over || !alive(u)) return true;
        if (repulsors(B, u, ev)) break;
      }
      return true;
    }
    if (u.sp.teleport && u.st.subspace === 1 && !u.st.used.teleport) {
      const from = { x: u.x, y: u.y };
      u.x = tx; u.y = ty; u.actman = 0; u.st.used.teleport = true;
      ev.push({ type: 'teleport', unit: u.id, from, to: { x: tx, y: ty } });
      return true;
    }
    return bad('out of reach');
  }
  // retreating groups run for the safest square (far from every enemy, near their own edge)
  function retreatMove(B, u, ev) {
    if (u.actman <= 0 || u.st.stasis > 0 || u.kind === 'planet') return;
    const rm = reach(B, u), foes = B.units.filter(o => o.side !== u.side && alive(o));
    let best = -1, bs = -1e9;
    for (let i = 0; i < rm.dist.length; i++) {
      if (rm.dist[i] < 0) continue;
      const x = i % B.w, y = Math.floor(i / B.w);
      if (i !== u.y * B.w + u.x && unitAtCell(B, x, y)) continue;
      let md = 99; for (const o of foes) md = Math.min(md, Math.max(Math.abs(o.x - x), Math.abs(o.y - y)));
      const edge = u.side === 0 ? x : 9 - x, s = md * 100 - edge * 10 - rm.dist[i];
      if (s > bs) { bs = s; best = i; }
    }
    if (best >= 0 && best !== u.y * B.w + u.x) doMove(B, u, best % B.w, Math.floor(best / B.w), ev);
  }

  // ---- special devices -------------------------------------------------------------------------------------------------------------------------------------
  function decloak(u, ev) { if (u.st.cloak === 1) { u.st.cloak = 2; ev.push({ type: 'cloak', unit: u.id, state: 'off' }); } }
  function killWhole(B, t, ev) {
    const n = t.count; t.count = 0; t.hploss = 0;
    if (t.kind === 'planet') ev.push({ type: 'base-destroyed', target: t.id, n, left: 0 }); else { ev.push({ type: 'ship-destroyed', target: t.id, n, left: 0 }); ev.push({ type: 'explosion', x: t.x, y: t.y, size: 2 }); }
    afterDamage(B, t, ev);
  }
  function doSpecial(B, u, a, ev) {
    const bad = reason => { ev.push({ type: 'invalid', reason }); ev.ok = false; return false; };
    const dev = a.device, st = u.st, r = rngOf(B), t = a.target !== undefined && a.target !== null ? B.units[a.target] : null;
    if (st.stasis > 0) return bad('frozen');
    if (dev !== 'teleport' && st.used[dev]) return bad('already used this turn');
    const foe = (range, needShip) => {
      if (!t || !canTarget(B, u, t)) return 'bad target';
      if (cdist(u, t) > range) return 'out of range';
      if (needShip && t.kind === 'planet') return 'not against a planet';
      return '';
    };
    const noMonster = () => (t && t.kind === 'monster' ? 'monsters are immune' : '');
    let why;
    switch (dev) {
      case 'stasis': {
        if (!u.sp.stasis) return bad('no stasis field');
        why = foe(1, true) || noMonster() || (t.st.cloak === 1 ? 'cloaked ships cannot be frozen' : '') || (t.st.stasis > 0 ? 'already frozen' : '');
        if (why) return bad(why);
        decloak(u, ev);
        t.st.stasis = 1; t.st.stasisBy = u.id; st.used.stasis = true; st.noFire = true;
        dropMissilesFor(B, t.id, 'stasis', ev);
        ev.push({ type: 'special-effect', unit: u.id, device: 'stasis', target: t.id });
        logLine(B, u.name + ' freezes ' + t.name);
        return true;
      }
      case 'pulsar': {
        if (!u.sp.pulsar) return bad('no pulsar');
        const adj = B.units.filter(o => o.id !== u.id && alive(o) && o.st.stasis === 0 && cdist(u, o) <= 1);
        if (!adj.length) return bad('nothing adjacent');
        decloak(u, ev); st.used.pulsar = true;
        const N = u.count, hit = [];
        for (const o of adj) {
          let v = u.sp.pulsar === 2 ? r.int(1, N + 10) : r.int(1, Math.floor(N / 2) + 5);
          if (o.kind === 'planet') v = Math.floor(v / 2);
          v -= o.absorb;
          if (v <= 0) { hit.push({ target: o.id, damage: 0, killed: 0 }); continue; }
          if (v >= o.hp1) { const n = o.count; killWhole(B, o, ev); hit.push({ target: o.id, damage: v, killed: n }); continue; }
          o.hp1 -= v;
          let k = 0;
          if (o.hploss > o.hp1) { o.count--; k = 1; if (o.count <= 0) { o.count = 0; afterDamage(B, o, ev); } }
          hit.push({ target: o.id, damage: v, killed: k });
          if (k) ev.push({ type: 'ship-destroyed', target: o.id, n: 1, left: o.count });
        }
        ev.push({ type: 'special-effect', unit: u.id, device: 'pulsar', mode: u.sp.pulsar, affected: hit });
        logLine(B, u.name + ' fires its pulsar');
        checkOver(B, ev);
        return true;
      }
      case 'stream': {
        if (!u.sp.stream) return bad('no stream projector');
        why = foe(2, false) || noMonster();
        if (why) return bad(why);
        decloak(u, ev); st.used.stream = true;
        const N = u.count, pct = u.sp.stream === 2 ? Math.min(75, Math.floor(N / 2) + 40) : Math.min(50, Math.floor(N / 2) + 20);
        const lose = Math.ceil(t.hp1 * pct / 100);
        t.hp1 -= lose;
        let killed = 0;
        if (t.hp1 <= 0) { killed = t.count; killWhole(B, t, ev); }
        else if (t.hploss >= t.hp1) { t.count--; t.hploss = 0; killed = 1; ev.push({ type: 'ship-destroyed', target: t.id, n: 1, left: t.count }); if (t.count <= 0) { t.count = 0; afterDamage(B, t, ev); } }
        ev.push({ type: 'special-effect', unit: u.id, device: 'stream', target: t.id, percent: pct, lost: lose, killed });
        logLine(B, u.name + ' strips ' + pct + '% of the armor of ' + t.name);
        return true;
      }
      case 'blackhole': {
        if (!u.sp.bh) return bad('no black hole generator');
        why = foe(1, false) || noMonster();
        if (why) return bad(why);
        decloak(u, ev); st.used.blackhole = true;
        const v = r.int(1, 75) + 25 - 2 * t.absorb;
        let killed = 0;
        if (v > 0) {
          if (t.count > 1) { const keep = Math.floor(t.count * (100 - v) / 100); killed = t.count - keep; t.count = keep; if (t.count <= 0) t.count = 0; }
          else { const roll = roll100(r); if (C.CONFIG.bhBug ? roll > v : roll <= v) { killed = t.count; t.count = 0; } }
        }
        ev.push({ type: 'special-effect', unit: u.id, device: 'blackhole', target: t.id, strength: v, killed });
        if (killed > 0) { ev.push({ type: 'ship-destroyed', target: t.id, n: killed, left: t.count }); ev.push({ type: 'explosion', x: t.x, y: t.y, size: 3 }); }
        afterDamage(B, t, ev);
        logLine(B, u.name + ' opens a black hole at ' + t.name + ': ' + killed + ' lost');
        return true;
      }
      case 'dissipator': {
        if (!u.sp.wd) return bad('no warp dissipator');
        why = foe(3, true) || noMonster();
        if (why) return bad(why);
        decloak(u, ev); st.used.dissipator = true;
        const ok = roll100(r) <= 50 && t.actman > 0;
        if (ok) { t.unman++; t.actman = Math.max(0, t.actman - t.unman); if (t.actman > 0) { t.def -= 2; t.mdef -= 2; } }   // cumulative: actman loses the TOTAL unman; defence -2 only while it can still move (verified)
        ev.push({ type: 'special-effect', unit: u.id, device: 'dissipator', target: t.id, success: ok });
        return true;
      }
      case 'technull': {
        if (!u.sp.tn) return bad('no technology nullifier');
        why = foe(4, false) || noMonster();
        if (why) return bad(why);
        decloak(u, ev); st.used.technull = true;
        const v = r.int(1, 3) + r.int(1, 3);
        t.comp = Math.max(0, t.comp - v); t.mdef = Math.max(t.def, t.mdef - v);
        ev.push({ type: 'special-effect', unit: u.id, device: 'technull', target: t.id, drop: v });
        return true;
      }
      case 'repulsor': {
        if (!u.sp.repulsor) return bad('no repulsor beam');
        why = foe(1, true);
        if (why) return bad(why);
        decloak(u, ev); st.used.repulsor = true;
        if (!pushAway(B, u, t, ev)) ev.push({ type: 'special-effect', unit: u.id, device: 'repulsor', target: t.id, blocked: true });
        return true;
      }
      case 'teleport': {
        if (!(u.sp.teleport && st.subspace === 1) || st.used.teleport) return bad('cannot teleport');
        return doMove(B, u, a.x | 0, a.y | 0, ev);
      }
      default: return bad('unknown device');
    }
  }
  C.scanInfo = function (B, unit) {
    const u = unitOf(B, unit);
    if (!u) return null;
    return { id: u.id, name: u.name, kind: u.kind, side: u.side, empire: u.empire, count: u.count, hp1: u.hp1, hp2: u.hp2, hploss: u.hploss, hp: hpOf(u), def: u.def, mdef: u.mdef, comp: u.comp, absorb: u.absorb,
      misshield: u.misshield, repair: u.repair, speed: u.speed, cloaked: u.st.cloak === 1,
      weapons: u.weapons.map(w => ({ id: w.id, name: w.name, kind: w.kind, count: w.count, dmin: w.dmin, dmax: w.dmax, range: w.range, shots: w.shots, numfire: w.numfire, acc: w.acc })),
      specials: Object.keys(u.sp).filter(k => u.sp[k]) };
  };

  // ---- the public tactical API -----------------------------------------------------------------------------------------------------------------------------
  C.unit = (B, id) => unitOf(B, id);
  C.liveUnits = (B, side) => B.units.filter(u => alive(u) && (side === undefined || side === null || u.side === side));
  C.isOver = B => !!B.over;
  C.hpOf = hpOf;
  C.reach = reach;
  C.lineBlocked = lineBlocked;

  C.legalMoves = function (B, unit) {
    const u = unitOf(B, unit), out = [];
    if (!u || !alive(u) || u.kind === 'planet' || u.st.stasis > 0) return out;
    const rm = reach(B, u), tele = u.sp.teleport && u.st.subspace === 1 && !u.st.used.teleport;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x;
      if (rockAt(B, x, y) || planetCell(B, x, y) || unitAtCell(B, x, y)) continue;
      if (rm.dist[i] > 0) out.push({ x, y, cost: rm.dist[i] });
      else if (tele && i !== u.y * B.w + u.x) out.push({ x, y, cost: u.actman, tele: true });
    }
    return out;
  };
  C.targets = function (B, unit, mode) {
    const u = unitOf(B, unit), out = [];
    if (!u || !alive(u)) return out;
    for (const t of B.units) {
      if (!canTarget(B, u, t)) continue;
      const m = mode || 'all';
      if (m === 'special') {
        const devs = [], d = cdist(u, t);
        if (u.sp.stasis && d <= 1 && t.kind === 'ship' && t.st.cloak !== 1 && t.st.stasis === 0) devs.push('stasis');
        if (u.sp.stream && d <= 2 && t.kind !== 'monster') devs.push('stream');
        if (u.sp.bh && d <= 1 && t.kind !== 'monster') devs.push('blackhole');
        if (u.sp.wd && d <= 3 && t.kind === 'ship') devs.push('dissipator');
        if (u.sp.tn && d <= 4 && t.kind !== 'monster') devs.push('technull');
        if (u.sp.repulsor && d <= 1 && t.kind !== 'planet') devs.push('repulsor');
        if (devs.length) out.push({ id: t.id, type: t.kind, range: d, hitChance: 1, devices: devs, name: t.name, count: t.count, hp: hpOf(t), cloaked: t.st.cloak === 1 });
        continue;
      }
      const pl = weaponPlan(B, u, t, m === 'all' ? null : m, false, null);
      if (!pl.plan.length) continue;
      const hit = { beam: C.hitProb(pl.bm.mb), missile: C.hitProb(pl.bm.mm) };
      out.push({ id: t.id, type: t.kind, range: pl.d, hitChance: pl.plan[0].hit, hit, weapons: pl.plan.map(p => p.slot), chances: pl.plan.map(p => ({ slot: p.slot, kind: p.kind, hit: p.hit })),
        cloaked: t.st.cloak === 1, name: t.name, count: t.count, hp: hpOf(t) });
    }
    return out;
  };
  C.act = function (B, unit, action) {
    const ev = B.pend.splice(0);
    ev.ok = true;
    const bad = reason => { ev.push({ type: 'invalid', reason }); ev.ok = false; return ev; };
    const u = unitOf(B, unit);
    if (B.over) return bad('battle over');
    if (!u) return bad('no such unit');
    if (B.active !== u.id) return bad('not this unit\'s turn');
    if (!action || !action.type) return bad('no action');
    let ended = false;
    switch (action.type) {
      case 'move': doMove(B, u, action.x | 0, action.y | 0, ev); break;
      case 'fire': {
        const t = B.units[action.target];
        if (!t || !canTarget(B, u, t)) return bad('bad target');
        if (u.st.noFire) return bad('attack already spent');
        if (u.st.stasis > 0) return bad('frozen');
        let slots = null, mode = null;
        const ws = action.weapons;
        if (Array.isArray(ws)) slots = ws.slice(); else if (ws === 'beams') mode = 'beam'; else if (ws === 'missiles') mode = 'missile';
        if (mode === 'beam') { slots = []; u.weapons.forEach((w, i) => { if (!isMis(w.kind)) slots.push(i); }); mode = null; }
        if (!attackUnit(B, u, t, { slots, mode }, ev)) return bad('nothing in reach');
        break;
      }
      case 'special': doSpecial(B, u, action, ev); break;
      case 'planet-weapon': {
        if (u.kind !== 'planet' || !(action.slot === 0 || action.slot === 1)) return bad('not a planet');
        u.planetSlot = action.slot; B.planetSlot = action.slot;
        ev.push({ type: 'special-effect', unit: u.id, device: 'planet-weapon', slot: action.slot });
        break;
      }
      case 'scan': {
        if (!B.sides[u.side].scanner) return bad('no Battle Scanner');
        const t = B.units[action.target];
        if (!t) return bad('bad target');
        ev.push({ type: 'scan', unit: u.id, target: t.id, info: C.scanInfo(B, t) });
        break;
      }
      case 'wait': {
        if (u.st.waited || !B.order.length) { ended = true; break; }
        u.st.waited = true; u.st.canRetaliate = true; B.order.push(u.id);
        ev.push({ type: 'turn-end', unit: u.id, waited: true });
        nextActive(B, ev);
        return ev;
      }
      case 'done': ended = true; break;
      case 'retreat': {
        if (u.kind === 'planet' || u.st.stasis > 0 || u.speed - u.unman < 1) return bad('cannot retreat');
        u.st.retreat = 1; ev.push({ type: 'retreat', unit: u.id });
        logLine(B, u.name + ' retreats');
        retreatMove(B, u, ev);
        if (alive(u)) u.st.retreat = 2;
        ended = true;
        break;
      }
      default: return bad('unknown action');
    }
    if (B.over || checkOver(B, ev)) return ev;
    if (B.active === u.id && !alive(u)) { ev.push({ type: 'turn-end', unit: u.id, dead: true }); nextActive(B, ev); return ev; }
    if (ended) endTurn(B, u, ev);
    return ev;
  };
  C.endRound = function (B) {
    const ev = B.pend.splice(0);
    ev.ok = true;
    if (B.over) return ev;
    let guard = 0;
    while (B.active !== null && !B.over && guard++ < 64) {
      const u = B.units[B.active];
      closeTurn(B, u, ev);
      if (checkOver(B, ev)) break;
      nextActive(B, ev);
    }
    if (B.over) return ev;
    for (let i = 0; i < B.missiles.length; i++) {
      const m = B.missiles[i];
      if (m.budget > 0.0001) continue;                       // never moved this round: keeps its fuel
      m.budget = m.spd; m.fuel--;
      if (m.fuel <= 0) { ev.push({ type: 'missile-lost', mid: m.id, target: m.target, reason: 'fuel', n: m.n }); B.missiles.splice(i, 1); i--; }
    }
    ev.push({ type: 'round-end', round: B.round });
    if (B.round >= C.CONFIG.maxRounds) { setOver(B, ev, B.planetSide >= 0 ? B.planetSide : 1, 'timeout'); return ev; }
    beginRound(B, ev);
    return ev;
  };
  // flag every group of a side: they run away on their turns and leave the field next time (the enemy gets shots in between)
  C.retreatAll = function (B, side) {
    const ev = [];
    for (const u of B.units) if (u.side === side && alive(u) && u.kind !== 'planet' && u.st.retreat === 0 && u.speed - u.unman >= 1) { u.st.retreat = 1; ev.push({ type: 'retreat', unit: u.id }); }
    return ev;
  };
  // internals shared with the AI block
  C._ = { alive, cdist, rngOf, roll100, reach, pathTo, rockAt, planetCell, unitAtCell, weaponPlan, weaponReady, baseMiss, canTarget, hpOf, attackUnit, doMove, retreatMove, checkOver, setOver, nextActive,
    endTurn, closeTurn, logLine, total, hitStack, planetCollateral, impact, flyMissile, advanceMissiles, beginRound, computeOrder, beginTurn, doSpecial, pushAway, reactionFire, placeRocks };
});

// ======================================================================================================================================================
//  TACTICAL AI  (research/03 §4.13, research/08 §5.5 + §6): target scoring by expected damage, "best range" positioning, missile evasion, stasis / pulsar /
//  black-hole use, planets, unarmed ships that retreat, and the right-hand AI's retreat decision.
// ======================================================================================================================================================
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Combat, X = C._;
  const alive = X.alive, cdist = X.cdist, rngOf = X.rngOf, hpOf = X.hpOf, canTarget = X.canTarget, logLine = X.logLine;
  const isBeam = C.isBeam, isMis = C.isMissile;
  const CW = C.CELL_W, CH = C.CELL_H;

  const foesOf = (B, u) => B.units.filter(t => canTarget(B, u, t));
  // how much damage ONE attack action of group u would do to group t standing `d` squares away (expected value, in hit points); onlySlot restricts to one bank
  function expDamage(B, u, t, d, only) {
    const cl = t.kind !== 'planet' && t.st.cloak === 1;
    let mb = 50 - 10 * (u.comp - t.def) + (cl ? 50 : 0), mm = 50 - 10 * (u.comp - t.mdef) + (cl ? 50 : 0);
    if (mb > 95) mb = 95; if (mm > 95) mm = 95;
    let sum = 0;
    for (let wi = 0; wi < u.weapons.length; wi++) {
      const w = u.weapons[wi], k = w.kind;
      if (only !== undefined && only !== null && (Array.isArray(only) ? only.indexOf(wi) < 0 : wi !== only)) continue;
      if (w.count <= 0 || w.shots === 0) continue;
      if (k === 'bomb' || k === 'bio') { if (t.kind !== 'planet' || d > 1) continue; }
      else { if (t.kind === 'planet' && t.count <= 0) continue; if (d > w.range) continue; }
      const ab = w.half ? Math.floor(t.absorb / 2) : t.absorb;
      if (k === 'bio') { sum += u.count * w.count * Math.max(0, w.dmax / 2 - (B.planet ? B.planet.antidote : 0)) * 100; continue; }
      if (isBeam(k) || k === 'bomb') {
        const miss = (k === 'bomb' ? mm : mb) - 10 * w.acc, p = C.hitProb(miss), shots = u.count * w.count * w.rof, lo = Math.max(miss, 1);
        let avg = 0;
        for (let i = 0; i < 5; i++) {
          const roll = Math.min(100, Math.max(1, Math.floor(lo + (100 - lo) * (i + 0.5) / 5)));
          let dmg = C.beamDamage(miss, roll, w.dmin, w.dmax);
          if (t.kind === 'planet' && k !== 'bomb') dmg = Math.floor(dmg / 2);
          let v1 = Math.max(0, dmg - ab) * w.mul;
          v1 = w.stream ? Math.min(v1, t.hp1 * t.count) : Math.min(v1, t.hp1);       // overkill is wasted (one shot, one ship)
          avg += v1;
        }
        let v = shots * p * (avg / 5);
        if (t.sp.disp) v *= 0.66;
        sum += v;
      } else {
        const p = C.hitProb(mm - 10 * w.acc), icept = t.misshield > 0 ? Math.max(0, t.misshield - w.tl) / 100 : 0;
        let dmg = w.dmax;
        if (t.kind === 'planet' && k === 'torpedo') dmg = Math.floor(dmg / 2);
        dmg = Math.min(Math.max(0, dmg - ab) * w.mul, t.hp1);
        let v = u.count * w.count * w.warheads * p * (1 - icept) * dmg;
        if (w.every2) v *= 0.5;
        if (t.sp.disp) v *= 0.66;
        sum += v;
      }
    }
    if (d <= 1 && u.sp.bh && t.kind !== 'monster') sum += 1000;
    if (d <= 1 && u.sp.stasis && t.kind === 'ship') sum += 200;
    if (d <= 2 && u.sp.stream && t.kind !== 'monster') sum += t.hp1 * t.count * 0.2;
    return sum;
  }
  // the theoretical maximum damage a group can do in one round (used to rank how dangerous it is)
  function threat(u) {
    let s = 0;
    for (const w of u.weapons) {
      if (w.count <= 0 || w.kind === 'bomb' || w.kind === 'bio') continue;
      const per = isMis(w.kind) ? w.dmax * w.mul * w.warheads * (w.every2 ? 0.5 : 1) : w.dmax * w.mul * w.rof;
      s += per * w.count * u.count;
    }
    if (u.sp.bh) s += 1000;
    return s;
  }
  function potentials(B, u, t) {
    const W = [0];
    for (let d = 1; d <= 9; d++) W.push(expDamage(B, u, t, d));
    if (u.sp.bh && t.kind !== 'monster') W[1] += 2000;                    // research/08 §6.3: black hole and stasis are priced in at point-blank range only
    if (u.sp.stasis && t.kind === 'ship') W[1] += 2000;
    return W;
  }
  function rank(u, t, give) {
    if (give <= 0) return 0;
    const hp = Math.max(1, t.hp1), kills = give / hp, th = threat(t) + 1;
    let s = kills >= 1 ? Math.min(kills, t.count) * th * 20 + give : give * th / hp + give * 0.01;
    if (t.kind === 'planet' && give < t.hp1) s *= 0.2;           // the AI "avoids charging bases unless it can kill one in a single shot"
    return s;
  }
  // only targets that some READY weapon can reach right now (so the AI never issues an action the engine would refuse)
  function bestFireTarget(B, u) {
    let best = null, bs = 0;
    for (const e of C.targets(B, u, 'all')) {
      const t = B.units[e.id], give = expDamage(B, u, t, e.range, e.weapons);
      const s = rank(u, t, give);
      if (s > bs) { bs = s; best = t; }
    }
    return best;
  }
  function bestRival(B, u) {
    let best = null, bs = 0, bw = null;
    for (const t of foesOf(B, u)) {
      const W = potentials(B, u, t), give = Math.max.apply(null, W);
      const s = rank(u, t, give);
      if (s > bs || (s === bs && best && s > 0 && cdist(u, t) < cdist(u, best))) { bs = s; best = t; bw = W; }
    }
    return best ? { t: best, W: bw, score: bs } : null;
  }
  // the distance the AI wants to fight at (research/08 §6.3): the longest range that still gives more than a third of the point-blank damage
  function bestRange(u, W) {
    let br = 1;
    const cloaked = u.st.cloak === 1;
    for (let d = 2; d <= 9; d++) {
      if (W[d] <= 0) break;
      if (cloaked ? W[d] >= W[1] : W[1] < 3 * W[d]) br = d;
    }
    return br;
  }
  function hasOffense(B, u) {
    for (const w of u.weapons) if (w.count > 0 && w.shots !== 0 && (w.kind !== 'bomb' && w.kind !== 'bio' || !!B.planet)) return true;
    return u.sp.pulsar > 0 || u.sp.stream > 0 || u.sp.bh || u.sp.stasis || u.sp.wd || u.sp.tn;
  }

  // ---- movement choice -------------------------------------------------------------------------------------------------------------------------------------
  function pickCell(B, u, target, br) {
    const r = rngOf(B), cells = [{ x: u.x, y: u.y, cost: 0 }].concat(C.legalMoves(B, u));
    let best = [], bs = -1e9;
    for (const c of cells) {
      const d = Math.max(Math.abs(c.x - target.x), Math.abs(c.y - target.y));
      let s = d === br ? 10 : -4 * d;
      if (C.lineBlocked(B, c, target)) s -= 2;
      if (u.sp.pulsar) {
        const dm = u.sp.pulsar === 2 ? 10 + u.count : 5 + Math.floor(u.count / 2);
        for (const o of B.units) if (o.id !== u.id && alive(o) && Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) <= 1 && o.absorb < dm) s += o.side === u.side ? -4 : 3;
      }
      if (s > bs) { bs = s; best = [c]; } else if (s === bs) best.push(c);
    }
    return best[r.int(0, best.length - 1)];
  }
  function stasisPlan(B, u, emit) {
    if (!u.sp.stasis || u.st.used.stasis || u.st.noFire) return false;
    const foes = foesOf(B, u).filter(t => t.kind === 'ship' && t.st.cloak !== 1 && t.st.stasis === 0);
    if (!foes.length) return false;
    let v = null, vs = -1;
    for (const t of foes) {
      const others = foes.filter(o => o !== t).length;
      if (others < 2) continue;                                   // "at least two enemies would remain unlocked"
      const s = threat(t) * t.count;
      if (s > vs) { vs = s; v = t; }
    }
    if (!v) return false;
    if (cdist(u, v) > 1) {
      const cells = C.legalMoves(B, u).filter(c => Math.max(Math.abs(c.x - v.x), Math.abs(c.y - v.y)) === 1);
      if (!cells.length) return false;
      cells.sort((a, b) => a.cost - b.cost);
      emit({ type: 'move', x: cells[0].x, y: cells[0].y });
      if (B.over || !alive(u) || B.active !== u.id) return true;
    }
    if (cdist(u, v) <= 1) { const ev = emit({ type: 'special', device: 'stasis', target: v.id }); return ev.ok !== false; }
    return false;
  }
  function useSpecials(B, u, emit) {
    const r = foesOf(B, u), go = () => alive(u) && !B.over && B.active === u.id;
    // OSG firing order: stream projectors, pulsars, warp dissipator, black hole, technology nullifier (stasis is handled before moving)
    if (u.sp.stream && !u.st.used.stream) {
      const t = r.filter(o => o.kind !== 'monster' && cdist(u, o) <= 2 && o.hp1 > 1).sort((a, b) => b.hp1 * b.count - a.hp1 * a.count)[0];
      if (t) emit({ type: 'special', device: 'stream', target: t.id });
    }
    if (go() && u.sp.pulsar && !u.st.used.pulsar) {
      const dm = u.sp.pulsar === 2 ? 10 + u.count : 5 + Math.floor(u.count / 2);
      let sum = 0, any = 0;
      for (const o of B.units) if (o.id !== u.id && alive(o) && o.st.stasis === 0 && cdist(u, o) <= 1 && o.absorb < dm) { sum += o.side === u.side ? -4 : 3; any++; }
      if (any && sum > 0) emit({ type: 'special', device: 'pulsar' });
    }
    if (go() && u.sp.wd && !u.st.used.dissipator) {
      const t = r.filter(o => o.kind === 'ship' && o.actman > 0 && o.speed - o.unman >= 2 && cdist(u, o) <= 3).sort((a, b) => threat(b) - threat(a))[0];
      if (t) emit({ type: 'special', device: 'dissipator', target: t.id });
    }
    if (go() && u.sp.bh && !u.st.used.blackhole) {
      const t = r.filter(o => o.kind !== 'monster' && cdist(u, o) <= 1).sort((a, b) => threat(b) * b.count - threat(a) * a.count)[0];
      if (t) emit({ type: 'special', device: 'blackhole', target: t.id });
    }
    if (go() && u.sp.tn && !u.st.used.technull) {
      const t = r.filter(o => o.kind !== 'monster' && o.comp >= 3 && cdist(u, o) <= 4).sort((a, b) => b.comp - a.comp)[0];
      if (t) emit({ type: 'special', device: 'technull', target: t.id });
    }
  }
  // inbound missiles: higher difficulties dodge more often (research/08 §6.3: d3 < difficulty, rolled per missile)
  function evade(B, u, emit) {
    const inb = B.missiles.filter(m => m.target === u.id && m.side !== u.side);
    if (!inb.length || u.actman <= 0 || u.st.stasis > 0) return false;
    const r = rngOf(B), px = c => (c.x + 0.5) * CW, py = c => (c.y + 0.5) * CH;
    let want = false;
    for (const m of inb) {
      const danger = m.spd * m.fuel + 13;
      if (Math.hypot(px(u) - m.px, py(u) - m.py) > danger) continue;
      if (r.int(1, 3) < B.diff) want = true;
    }
    if (!want) return false;
    let bestC = null, bm = 0;
    for (const c of C.legalMoves(B, u)) {
      let margin = 1e9;
      for (const m of inb) margin = Math.min(margin, Math.hypot(px(c) - m.px, py(c) - m.py) - (m.spd * m.fuel + 13));
      if (margin > bm) { bm = margin; bestC = c; }
    }
    if (!bestC) return false;
    emit({ type: 'move', x: bestC.x, y: bestC.y });
    return true;
  }

  function playPlanet(B, u, emit) {
    const foes = foesOf(B, u);
    let best = null, bs = 0, bslot = u.planetSlot;
    for (let slot = 0; slot < 2; slot++) {
      for (const t of foes) {
        const s = rank(u, t, expDamage(B, u, t, cdist(u, t), slot)) + (10 - cdist(u, t)) * 0.001;
        if (s > bs) { bs = s; best = t; bslot = slot; }
      }
    }
    if (best) {
      if (bslot !== u.planetSlot) emit({ type: 'planet-weapon', slot: bslot });
      emit({ type: 'fire', target: best.id, weapons: 'all' });
    }
  }

  function playUnit(B, u, emit) {
    if (u.kind === 'planet') { playPlanet(B, u, emit); return; }
    if (u.st.stasis > 0) return;
    const aiSide1 = u.side === 1 && B.sides[1].ctl === 'ai' && u.kind !== 'monster';
    if (!hasOffense(B, u)) {
      if (aiSide1 && u.speed - u.unman >= 1) emit({ type: 'retreat' });      // unarmed ships retreat at the first chance (research/08 §6.1)
      return;
    }
    const rival = bestRival(B, u);
    if (!rival && aiSide1 && !B.missiles.some(m => m.shooter === u.id) && u.speed - u.unman >= 1) { emit({ type: 'retreat' }); return; }
    if (!rival) return;
    if (stasisPlan(B, u, emit)) return;
    if (B.over || !alive(u) || B.active !== u.id) return;
    let moved = false;
    if (u.actman > 0 && u.st.stasis === 0) moved = evade(B, u, emit);
    if (B.over || !alive(u) || B.active !== u.id) return;
    if (!moved && u.actman > 0 && u.kind !== 'planet') {
      const br = bestRange(u, rival.W), c = pickCell(B, u, rival.t, br);
      if (c && (c.x !== u.x || c.y !== u.y)) emit({ type: 'move', x: c.x, y: c.y });
    }
    if (B.over || !alive(u) || B.active !== u.id) return;
    useSpecials(B, u, emit);
    for (let i = 0; i < 10 && !B.over && alive(u) && B.active === u.id && !u.st.noFire; i++) {
      const t = bestFireTarget(B, u);
      if (!t) break;
      const ev = emit({ type: 'fire', target: t.id, weapons: 'all' });
      if (ev.ok === false) break;
    }
  }

  C.aiTurn = function (B, side) {
    const out = [];
    if (B.over || B.active === null) return out;
    const u = B.units[B.active];
    if ((side === 0 || side === 1) && u.side !== side) return out;
    const emit = action => { const events = C.act(B, u.id, action); out.push({ unit: u.id, action, events }); return events; };
    try { playUnit(B, u, emit); }
    catch (e) { if (C.CONFIG.debug) throw e; logLine(B, 'AI error: ' + (e && e.message)); }
    if (!B.over && B.active === u.id) emit({ type: 'done' });
    return out;
  };

  // ---- the right-hand AI's retreat decision (research/03 §4.11, 08 §5.5) --------------------------------------------------------------------------------
  // damage side `from` could inflict on side `to` in one round (best target per group, any distance) + missiles already flying
  function sideDamage(B, from, to) {
    let sum = 0;
    const targets = B.units.filter(t => t.side === to && alive(t));
    for (const u of B.units) {
      if (u.side !== from || !alive(u)) continue;
      let best = 0;
      for (const t of targets) {
        if (t.kind === 'planet' && !B.planet) continue;
        for (let d = 1; d <= 9; d++) best = Math.max(best, expDamage(B, u, t, d));
      }
      sum += best;
    }
    for (const m of B.missiles) {
      if (m.side !== from) continue;
      const t = B.units[m.target];
      if (!t || t.side !== to || !alive(t)) continue;
      const p = C.hitProb(50 - 10 * (m.comp - t.mdef) - 10 * m.acc), icept = t.misshield > 0 ? Math.max(0, t.misshield - m.tl) / 100 : 0;
      sum += m.n * p * (1 - icept) * Math.min(Math.max(0, m.dmg - t.absorb) * m.mul, t.hp1);
    }
    // repair credit: one fifth of a ship's hit points per repair percent point is already folded into the defender's regeneration (research: minus repair)
    let rep = 0;
    for (const t of targets) if (t.repair > 0) rep += Math.floor(t.hp2 * t.repair / 100);
    return Math.max(0, sum - rep);
  }
  // The pure decision (research/03 §4.11, 08 §5.5).  hpL/hpR: hit points of the left/right side (a planet counts 70%); dToLeft/dToRight: damage per round the right/left side can
  // inflict; v = (5 - difficulty)*5 + 5 (+10 if the planet is the left side's, +20 if the right's) + d15 roll.  The right-hand AI flees iff it cannot hurt the enemy at all or
  // (its loss rate in % of HP) > v * (the enemy's loss rate): the lower the difficulty, the larger v, the more stubborn the AI.
  C.shouldRetreat = function (hpL, hpR, dToLeft, dToRight, diff, planetSide, roll) {
    if (hpL <= 0 || hpR <= 0) return false;
    if (dToLeft <= 0) return true;
    const v = (5 - diff) * 5 + 5 + (planetSide === 0 ? 10 : planetSide === 1 ? 20 : 0) + roll;
    return dToRight * 100 / hpR > dToLeft * 100 * v / hpL;
  };
  C.aiRetreatCheck = function (B, ev) {
    const side = B.sides[1];
    if (!side || side.ctl !== 'ai' || side.monster) return;
    const hp = [0, 0];
    for (const u of B.units) if (alive(u)) hp[u.side] += hpOf(u) * (u.kind === 'planet' ? 0.7 : 1);
    if (hp[0] <= 0 || hp[1] <= 0) return;
    const dToLeft = sideDamage(B, 1, 0), dToRight = sideDamage(B, 0, 1);
    const go = C.shouldRetreat(hp[0], hp[1], dToLeft, dToRight, B.diff, B.planetSide, dToLeft > 0 ? rngOf(B).int(1, 15) : 0);
    if (!go) return;
    for (const u of B.units) if (u.side === 1 && alive(u) && u.kind !== 'planet' && u.st.retreat === 0 && u.speed - u.unman >= 1) { u.st.retreat = 1; ev.push({ type: 'retreat', unit: u.id, auto: true }); }
  };
  C._ai = { expDamage, threat, bestRange, sideDamage, bestFireTarget, bestRival, playUnit, evade, potentials, rank };
});

// ======================================================================================================================================================
//  RESOLUTION: results, the weight-attrition auto-resolve (§4.12), the AI-vs-AI tactical autoplay, applyResults (§4.11), ops, odds
// ======================================================================================================================================================
MOO.def(function (M) {
  'use strict';
  const C = M.Sim.Combat, X = C._;
  const alive = X.alive, total = X.total;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  const liveGroups = (B, s) => { let n = 0; for (const u of B.units) if (u.side === s && alive(u)) n++; return n; };
  const apparent = (side, lost) => { let v = 0; for (let i = 0; i < 6; i++) { const ss = side.designs && side.designs[i]; if (ss && lost[i] > 0) v += lost[i] * ((ss.hull | 0) + 1); } return v; };
  function lossLines(sideName, names, lost) {
    const out = [];
    for (let i = 0; i < 6; i++) if (lost[i] > 0) out.push(sideName + ' lose ' + lost[i] + ' ' + (names[i] || ('design ' + (i + 1))));
    return out;
  }

  // ---- tactical result ----------------------------------------------------------------------------------------------------------------------------------------
  C.finish = function (B) {
    let over = B.over;
    if (!over) {
      const l = liveGroups(B, 0), r = liveGroups(B, 1);
      over = { winner: l === 0 ? 1 : r === 0 ? 0 : (B.planetSide >= 0 ? B.planetSide : 1), reason: l === 0 || r === 0 ? 'wiped' : 'timeout' };
    }
    const winner = over.winner, res = { v: 1, mode: 'tactical', star: B.star, starName: B.starName, planetId: B.planet ? B.planet.id : -1, winner, winnerEmpire: B.sides[winner].empire,
      loserEmpire: B.sides[1 - winner].empire, rounds: B.round, reason: over.reason, human: B.human, attacker: B.attacker, defender: B.defender, sides: [], planet: null, summary: [] };
    const names = [{}, {}], hulls = [{}, {}];
    for (let i = 0; i < 2; i++) {
      const sd = B.sides[i], surv = [0, 0, 0, 0, 0, 0];
      for (const u of B.units) if (u.side === i && u.kind !== 'planet' && u.slot >= 0) { surv[u.slot] += u.count; names[i][u.slot] = u.name; hulls[i][u.slot] = u.hull | 0; }
      const lost = sd.initial.map((n, k) => Math.max(0, (n | 0) - surv[k]));
      res.sides.push({ empire: sd.empire, fleetId: sd.fleetId, monster: sd.monster, lost, survivors: surv, voluntary: sd.fled.slice(), retreated: i !== winner && total(surv) > 0, retreatTo: -1,
        destroyed: total(surv) === 0, apparentLost: lost.reduce((a, n, k) => a + n * ((hulls[i][k] | 0) + 1), 0) });
    }
    if (B.planet) {
      const P = B.planet, pu = B.units[0];
      res.planet = { id: P.id, owner: P.owner, basesLost: P.bases0 - pu.count, basesLeft: pu.count, popKilled: P.popKilled, factoriesKilled: P.factoriesKilled, bioDamage: P.bio, shieldBroken: false,
        popLeft: P.pop, factoriesLeft: P.factories };
    }
    res.summary.push((B.sides[winner].name || 'The winner') + ' win' + (over.reason === 'timeout' ? ' on the round limit' : '') + ' after ' + B.round + ' round' + (B.round === 1 ? '' : 's'));
    for (let i = 0; i < 2; i++) res.summary.push.apply(res.summary, lossLines(B.sides[i].name || ('Side ' + (i + 1)), names[i], res.sides[i].lost));
    if (res.planet) {
      if (res.planet.basesLost) res.summary.push(res.planet.basesLost + ' missile base(s) destroyed');
      if (res.planet.popKilled) res.summary.push(res.planet.popKilled + ' population killed');
      if (res.planet.factoriesKilled) res.summary.push(res.planet.factoriesKilled + ' factories destroyed');
    }
    return res;
  };
  // result for the "no fight" cases
  C.retreatBeforeBattle = function (battle, side) {
    const w = 1 - side, sides = battle.sides.map((s, i) => ({ empire: s.empire, fleetId: s.fleetId, monster: s.monster || null, lost: [0, 0, 0, 0, 0, 0], survivors: (s.ships || []).slice(),
      voluntary: i === side ? (s.ships || []).slice() : [0, 0, 0, 0, 0, 0], retreated: i === side, retreatTo: -1, destroyed: false, apparentLost: 0 }));
    const pl = battle.planet ? { id: battle.planet.id, owner: battle.planet.owner, basesLost: 0, basesLeft: battle.planet.bases | 0, popKilled: 0, factoriesKilled: 0, bioDamage: 0, shieldBroken: false,
      popLeft: battle.planet.pop | 0, factoriesLeft: battle.planet.factories | 0 } : null;
    return { v: 1, mode: 'tactical', star: battle.star, starName: battle.starName, planetId: pl ? pl.id : -1, winner: w, winnerEmpire: battle.sides[w].empire, loserEmpire: battle.sides[side].empire, rounds: 0,
      reason: 'retreat', human: !!battle.human, attacker: battle.attacker, defender: battle.defender, sides, planet: pl, summary: [(battle.sides[side].name || 'The fleet') + ' withdraws without a fight'] };
  };

  // ---- the engine plays both sides ---------------------------------------------------------------------------------------------------------------------
  C.autoPlay = function (B) {
    let guard = 0;
    while (!B.over && guard++ < 40000) {
      if (B.active === null) { C.endRound(B); continue; }
      const out = C.aiTurn(B, null);
      if (!out.length && !B.over && B.active !== null) C.act(B, B.active, { type: 'done' });
    }
    if (!B.over) X.setOver(B, [], B.planetSide >= 0 ? B.planetSide : 1, 'timeout');
    return B;
  };
  function resolveTactical(battle, R) {
    const B = C.create(null, battle, R);
    for (const s of B.sides) s.ctl = 'ai';
    C.autoPlay(B);
    return C.finish(B);
  }

  // ---- AI-vs-AI weight attrition (research/03 §4.12, research/08 §6.7) --------------------------------------------------------------------------------
  const SHIELD_IDX = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 9: 8, 11: 9, 13: 10, 15: 11 };
  function weightInfo(ss) {
    if (ss.wt) return ss.wt;
    const K = M.Data.Components, wt = { shield: SHIELD_IDX[ss.absorb | 0] | 0, comp: Math.max(0, (ss.attack | 0) - (ss.scanner ? 1 : 0)), armor: 0, w0: ss.weapons && ss.weapons[0] ? ss.weapons[0].n | 0 : 0, sp: [0, 0, 0] };
    (ss.specials || []).slice(0, 3).forEach((id, i) => { const k = K && K.idx.specials[id]; wt.sp[i] = k !== undefined ? K.SPECIALS[k].n : 0; });
    return wt;
  }
  function designWeight(side, ss) {
    const wt = weightInfo(ss);
    const sum = wt.shield * 5 + wt.comp * 5 + wt.w0 + wt.armor * 10 + 2 * (wt.sp[0] + wt.sp[1] + wt.sp[2]) + Math.floor((side.tl ? side.tl[1] | 0 : 0) / 2) + (side.autoWeight | 0);
    return sum * ((ss.hullW | 0) || C.HULL_W[ss.hull | 0] || 1);
  }
  C.sideWeight = function (battle, i) {
    const side = battle.sides[i];
    if (side.monster) return C.MONSTER_WEIGHT[side.monster.kind] || 30000;
    let W = 0;
    for (let k = 0; k < 6; k++) { const n = side.ships ? side.ships[k] | 0 : 0, ss = side.designs && side.designs[k]; if (n > 0 && ss) W += n * designWeight(side, ss); }
    if (battle.planet && battle.planetSide === i) W += ((side.tl ? (side.tl[5] | 0) + (side.tl[2] | 0) : 2)) * 75 * (battle.planet.bases | 0);
    return W;
  };
  function resolveWeights(battle, R) {
    const WL = C.sideWeight(battle, 0), WR = C.sideWeight(battle, 1);
    let wl = WL, wr = WR, it = 0;
    while (wl > 0 && wr > 0 && it < 100000) {
      wr -= Math.max(1, Math.floor(R.int(1, 10) * WL / 100));
      wl -= Math.max(1, Math.floor(R.int(1, 10) * WR / 100));
      it++;
    }
    const winner = wr > 0 ? 1 : 0;                              // double knock-out goes to the left (defender)
    const rem = [Math.max(0, wl), Math.max(0, wr)], W = [WL, WR], sides = [];
    for (let i = 0; i < 2; i++) {
      const s = battle.sides[i], surv = [0, 0, 0, 0, 0, 0], lost = [0, 0, 0, 0, 0, 0];
      for (let k = 0; k < 6; k++) {
        const n = s.ships ? s.ships[k] | 0 : 0;
        if (n <= 0) continue;
        let v = 0;
        if (i === winner && W[i] > 0) {
          v = C.CONFIG.overflowBug ? Math.trunc(Math.imul(n, rem[i] | 0) / W[i]) : Math.floor(n * rem[i] / W[i]);
          if (v < 0) v = 32000;
        }
        surv[k] = clamp(v, 0, n); lost[k] = n - surv[k];
      }
      sides.push({ empire: s.empire, fleetId: s.fleetId, monster: s.monster || null, lost, survivors: surv, voluntary: [0, 0, 0, 0, 0, 0], retreated: false, retreatTo: -1,
        destroyed: i !== winner || total(surv) === 0, apparentLost: apparent(s, lost) });
    }
    const pl = battle.planet ? { id: battle.planet.id, owner: battle.planet.owner, basesLost: 0, basesLeft: battle.planet.bases | 0, popKilled: 0, factoriesKilled: 0, bioDamage: 0, shieldBroken: false,
      popLeft: battle.planet.pop | 0, factoriesLeft: battle.planet.factories | 0 } : null;
    const res = { v: 1, mode: 'weights', star: battle.star, starName: battle.starName, planetId: pl ? pl.id : -1, winner, winnerEmpire: battle.sides[winner].empire, loserEmpire: battle.sides[1 - winner].empire,
      rounds: it, reason: 'weights', human: !!battle.human, attacker: battle.attacker, defender: battle.defender, sides, planet: pl, summary: [] };
    res.summary.push((battle.sides[winner].name || 'The winner') + ' win the engagement');
    for (let i = 0; i < 2; i++) { const nm = {}; (battle.sides[i].designs || []).forEach((d, k) => { if (d) nm[k] = d.name; }); res.summary.push.apply(res.summary, lossLines(battle.sides[i].name || ('Side ' + (i + 1)), nm, sides[i].lost)); }
    return res;
  }

  // resolve(battle, R[, {full:true}]): AI-vs-AI uses the weight model of the original; anything with a human on board (the Auto button) or opts.full plays the tactical simulation.
  C.resolve = function (battle, R, opts) {
    opts = opts || {};
    if (!R || typeof R.int !== 'function') R = M.RNG.create(battle.seed !== undefined ? battle.seed : battle.star);
    if (!opts.full && !battle.human) return resolveWeights(battle, R);
    return resolveTactical(battle, R);
  };
  C.resolveWeights = resolveWeights;
  C.resolveTactical = resolveTactical;
  C.odds = function (battle, n, seed, opts) {
    const win = [0, 0], lost = [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
    n = Math.max(1, n | 0);
    for (let i = 0; i < n; i++) {
      const r = C.resolve(battle, M.RNG.create(String(seed) + ':' + i), opts);
      win[r.winner]++;
      for (let s = 0; s < 2; s++) for (let k = 0; k < 6; k++) lost[s][k] += r.sides[s].lost[k];
    }
    return { n, win: [win[0] / n, win[1] / n], avgLost: lost.map(a => a.map(v => v / n)) };
  };
  M.Ops.resolveBattle = function (p) { return C.resolve(p.battle, M.RNG.create(p.seed), p.opts); };

  // ---- applyResults ----------------------------------------------------------------------------------------------------------------------------------------
  const nextId = S => (S.nextId = S.nextId || 1, S.nextId++);
  function findFleet(S, sd, star) {
    if (sd.fleetId >= 0) { const f = S.fleets.find(x => x.id === sd.fleetId && x.owner === sd.empire && x.star === star); if (f) return f; }
    return S.fleets.find(x => x.owner === sd.empire && x.star === star) || null;
  }
  function nearestOwnPlanet(S, empire, from) {
    const A = S.stars[from];
    let best = -1, bd = Infinity;
    for (const p of S.planets) {
      if (p.owner !== empire || p.starId === from) continue;
      const B = S.stars[p.starId], d = Math.hypot(B.x - A.x, B.y - A.y);
      if (d < bd) { bd = d; best = p.starId; }
    }
    return best;
  }
  function monsterDead(S, mon) {
    if (!mon) return false;
    if (mon.kind === 'guardian') return !(S.guardian && S.guardian.alive);
    const m = (S.monsters || []).find(x => x.id === mon.id);
    return !!(m && (m.gone || m.dead || m.killer >= 0));
  }
  function news(S, o) { if (M.Sim.Ev) M.Sim.Ev.push(S, Object.assign({ type: 'news' }, o)); }
  C.applyResults = function (S, results, R) {
    void R;
    const F = M.Sim.Fleet, Ev = M.Sim.Ev, D = M.Sim.Diplo;
    S.bombard = S.bombard || [];
    for (const res of results || []) {
      if (!res || !res.sides) continue;
      const mi = res.sides.findIndex(s => s.monster);
      if (mi >= 0 && monsterDead(S, res.sides[mi].monster) && res.sides[mi].destroyed) continue;      // another fleet already slew it this turn
      const star = res.star, p = S.planets[star], winner = res.winner, loser = 1 - winner;
      // 1. casualties
      const fleets = [null, null];
      for (let i = 0; i < 2; i++) {
        const sd = res.sides[i];
        if (sd.empire < 0) continue;
        const f = findFleet(S, sd, star);
        fleets[i] = f;
        if (f) for (let k = 0; k < 6; k++) f.ships[k] = Math.max(0, (f.ships[k] | 0) - (sd.lost[k] | 0));
      }
      // 2. the planet
      let popLost = 0, bio = 0, planetWiped = false;
      if (res.planet && p && p.owner === res.planet.owner) {
        const pr = res.planet;
        p.bases = Math.max(0, (p.bases | 0) - (pr.basesLost | 0));
        p.factories = Math.max(0, (p.factories | 0) - (pr.factoriesKilled | 0));
        popLost = Math.min(p.pop | 0, pr.popKilled | 0); bio = pr.bioDamage | 0;
        p.pop = Math.max(0, (p.pop | 0) - popLost);
        if (bio > 0 && p.mp3 !== undefined) p.mp3 = Math.max(Math.min(p.mp3, 10), p.mp3 - bio);
        if (p.pop <= 0 && popLost > 0) {
          const other = res.sides[res.sides[0].empire === p.owner ? 1 : 0];
          if (M.Sim.Colony && M.Sim.Colony.abandon) M.Sim.Colony.abandon(S, p);
          planetWiped = true;
          if (other.empire >= 0) news(S, { cat: 'planetDestroyed', empire: other.empire, planet: p.id, star });
        }
      }
      // 3. monsters
      for (let i = 0; i < 2; i++) {
        const sd = res.sides[i];
        if (!sd.monster || !sd.destroyed) continue;
        const killer = res.sides[1 - i].empire;
        if (sd.monster.kind === 'guardian') {
          if (S.guardian) { S.guardian.alive = false; S.guardian.killer = killer; }
          if (killer >= 0) news(S, { cat: 'guardianSlain', empire: killer, star });
        } else {
          const m = (S.monsters || []).find(x => x.id === sd.monster.id);
          if (m) { if (M.Sim.Events && M.Sim.Events.killMonster) M.Sim.Events.killMonster(S, m, killer); else { m.killer = killer; m.attackable = false; } }
        }
      }
      // 4. the loser's fleet flees to the nearest other planet it owns, or is lost (research/03 §4.11)
      const lsd = res.sides[loser], lf = fleets[loser];
      if (lsd.empire >= 0 && lf && total(lf.ships) > 0) {
        const to = nearestOwnPlanet(S, lsd.empire, star);
        if (to >= 0) {
          const E = S.empires[lsd.empire];
          let speed = 99;
          for (let k = 0; k < 6; k++) if ((lf.ships[k] | 0) > 0) speed = Math.min(speed, Math.max(1, E.designs && E.designs[k] ? M.Sim.Design.stats(S, E, k).warp | 0 || 1 : 1));
          const st = S.stars[star];
          S.fleets.push({ id: nextId(S), owner: lsd.empire, star: -1, from: star, to, x: st.x, y: st.y, speed: speed === 99 ? 1 : speed, ships: lf.ships.slice(), retreat: true });
          lf.ships = [0, 0, 0, 0, 0, 0];
          lsd.retreatTo = to; lsd.retreated = true;
        } else {
          lsd.lostAll = total(lf.ships); lsd.retreated = false;
          lf.ships = [0, 0, 0, 0, 0, 0];
        }
      }
      // 5. the winner may bombard (Ground.bombard consumes S.bombard)
      const wsd = res.sides[winner], wf = fleets[winner];
      if (wsd.empire >= 0 && wf && total(wf.ships) > 0 && p && p.owner >= 0 && p.owner !== wsd.empire && p.pop > 0 && !(D && D.isAllied && D.isAllied(S, wsd.empire, p.owner))) {
        let armed = false;
        for (let k = 0; k < 6; k++) if ((wf.ships[k] | 0) > 0 && S.empires[wsd.empire].designs[k] && M.Sim.Design.stats(S, S.empires[wsd.empire], k).weapons.length > 0) armed = true;
        if (armed && !S.bombard.some(b => b.empire === wsd.empire && b.planet === p.id)) S.bombard.push({ empire: wsd.empire, planet: p.id, target: p.owner, star });
      }
      // 6. events, news, diplomacy
      const lostN = [total(res.sides[0].lost), total(res.sides[1].lost)];
      if (Ev) Ev.push(S, { type: 'battle', star, planet: p ? p.id : -1, attacker: res.attacker, defender: res.defender, winner: res.winnerEmpire, loser: res.loserEmpire, rounds: res.rounds, human: !!res.human,
        mode: res.mode, reason: res.reason, sides: res.sides.map(s => ({ empire: s.empire, lost: total(s.lost), survivors: total(s.survivors), monster: s.monster ? s.monster.kind : null, retreatTo: s.retreatTo })),
        popKilled: popLost, bio, planetWiped, summary: res.summary });
      const we = res.winnerEmpire, le = res.loserEmpire, lostLoser = lostN[loser];
      if (le >= 0 && we >= 0 && lostLoser + (lsd.lostAll | 0) > 0) {
        const allLost = lsd.destroyed || lsd.lostAll > 0;
        const humanLoser = S.empires[le] && S.empires[le].human;
        news(S, { cat: allLost && !lsd.monster ? 'fleetDestroyed' : humanLoser ? 'battleLost' : 'battleWon', empire: allLost || humanLoser ? le : we, empire2: allLost || humanLoser ? we : le, star, ships: lostLoser + (lsd.lostAll | 0) });
      }
      if (D && D.incident && res.sides[0].empire >= 0 && res.sides[1].empire >= 0) {
        const planetOwner = p ? p.owner : -1, offended = planetOwner === res.sides[0].empire || planetOwner === res.sides[1].empire ? planetOwner : (S.empires[res.sides[0].empire].human ? res.sides[1].empire : res.sides[0].empire);
        const offender = offended === res.sides[0].empire ? res.sides[1].empire : res.sides[0].empire, oi = res.sides[0].empire === offended ? 0 : 1;
        const app = Math.min(50, res.sides[oi].apparentLost | 0), offense = Math.max(5 * popLost, app, 10 * bio);
        if (offense > 0) D.incident(S, 'combat', offender, offended, offense, { planet: p ? p.id : -1, popLost, bio, app, force: app, star });
      }
    }
    // nobody survives a visit to Orion while the Guardian lives
    if (S.guardian && S.guardian.alive && S.orion !== undefined && S.orion >= 0) {
      for (const f of S.fleets) if (f.star === S.orion && total(f.ships) > 0) { f.ships = [0, 0, 0, 0, 0, 0]; if (Ev) Ev.push(S, { type: 'notice', kind: 'guardianPurge', empire: f.owner, star: S.orion }); }
    }
    if (F && F.cleanup) F.cleanup(S);
  };
});
