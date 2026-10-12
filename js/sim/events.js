// Random events, space monsters, coups and end-of-turn housekeeping (research/05 §7, research/04 §3.13, research/01 §5.12). Worker-safe.
//
// HOOKS (sim/turn.js)
//   Events.coups(S,R)   every turn (before the roll): Guardian prize / Orion clearing / Final-War tech pooling (upkeep), then the leader-coup check. (The -36 genocide DP is Diplo.preTurn's job.)
//   Events.turn(S,R) → [interrupt]   only when options.randomEvents: progress of running events (plague, nova, accident, comet, pirates), monsters, then the yearly roll.
//                       Presentation interrupts are {type:'event', kind, stage, empire, planet, star, text, cat, vars} (human victims and global monsters/pirates only);
//                       EVERY event also pushes a GNN item {type:'news', cat, kind, stage, headline, empire, planet, star, …} — `headline` is ready-made English for categories
//                       Data.text.news has no template for (earthquake, accident, virus, comet, derelict, richPlanet, poorPlanet, donation, coup, *Cured/*Averted, crystal/amoeba spawn).
// THE ROLL (§7.1): from year 41 on, chance = (year - S.events.year) scaled by difficulty (1/2, 2/3, 3/4, 4/5, 1) ; event iff rnd(512) <= chance ; victim by planet count
//   (humans x5, empires with < 4 planets weigh 1) ; a random planet of the victim (Orion = no event) ; up to 5 draws of rnd(16) with the rejection list ; each kind once per game.
//   S.events = {year (last event, starts 40), done:{kind:true}, pirates:{star,hp,…}|null, log:[…]}.
// PLANET TIMERS  planet.event = {type:'plague', cure, cost} | {type:'nova', years, cost} | {type:'comet', years, hp, dmg} | {type:'accident'}  (Econ drops plague/nova planets from
//   the empire's research total; the planet's research pays the cure instead.)  Order  eventCure {planet, amount?}  pays BC from the reserve 1:1 into a plague/nova cure (remake convenience).
// MONSTERS  S.monsters = [{id, kind:'crystal'|'amoeba', name, x, y, star (star id while standing on one, else -1), dest, counter, nuked, hit, attackable, killer (-1 or empire id), hp, maxHp, born}]
//   Spawn at a random map edge heading for the grid star there (counter 2), then 11 units/turn (5+6); on arriving (after that turn's battle) the planet is struck, it rests 4 turns,
//   then random-walks to an adjacent grid star. 5 hit colonies (or a kill) end it. Combat: Events.monsterAt(S, star) = the monster a fleet/planet fights there NOW (standing on `star`,
//   not resting after a hit); when it dies Combat calls Events.killMonster(S, monster, empireId). Guardian: S.guardian = {alive, star, killer?} is Combat's; the prize is paid here.
// TIMING DECISION: monsters are moved at the END of each events phase, so Combat.findBattles of the NEXT turn sees them on the star before the strike (movement → battle → effect).
// DECISIONS (research conflicts): v1.3 numbers (quake pop >= 50, comet 275-475 hp, accident hits any colony, Guardian HP by difficulty); comet damage keeps the original bug
//   (design #0's hull for every stack); [Guide]-only rules (plague blocks transports, event spreading) are not implemented.
MOO.def(function (M) {
  'use strict';
  const Ev = M.Sim.Events = {};
  const Sim = M.Sim;
  const O = Sim.Orders;
  const KINDS = ['', 'plague', 'quake', 'nova', 'accident', 'assassin', 'virus', 'comet', 'pirates', 'derelict', 'rebellion', 'crystal', 'amoeba', 'enviro', 'rich', 'support', 'poor'];
  Ev.KINDS = KINDS;
  const HULL_W = [1, 5, 25, 125];
  Ev.MONSTERS = { crystal: { name: 'space crystal', hp: [3000, 4000, 5000, 6000, 7000] }, amoeba: { name: 'space amoeba', hp: [1000, 2000, 3000, 4000, 5000] } };
  const FIELD_NAMES = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];

  // ---- helpers --------------------------------------------------------------------------------------------------------------------------------------
  const cfg = () => (M.Data && M.Data.Config) || {};
  const diffOf = S => S.settings.diffIdx | 0;
  const nextId = S => (S.nextId = (S.nextId || 1), S.nextId++);
  const stateOf = S => {
    const e = S.events || (S.events = {});
    if (e.year === undefined) e.year = cfg().EVENT_FIRST_YEAR || 40;
    if (!e.done) e.done = {};
    if (!e.log) e.log = [];
    if (e.pirates === undefined) e.pirates = null;
    return e;
  };
  const pname = (S, p) => p.name || S.stars[p.starId].name;
  const owned = (S, id) => S.planets.filter(p => p.owner === id);
  const push = (S, ev) => { if (Sim.Ev) Sim.Ev.push(S, ev); };
  const incident = (S, kind, from, to, dv, info) => {
    const D = Sim.Diplo;
    if (D && typeof D.incident === 'function') { try { return D.incident(S, kind, from, to, dv, info); } catch (e) { return null; } }
    return null;
  };
  function treatyOf(S, a, b) {
    const D = Sim.Diplo;
    if (D && typeof D.status === 'function') {
      try {
        const x = D.status(S, a, b);
        if (x) {
          if (typeof x.treaty === 'number') return x.treaty;
          const nm = String(x.treatyName || x.treaty || '').toLowerCase();
          if (nm === 'non-aggression pact' || nm === 'nap') return 1; if (nm === 'alliance') return 2; if (nm === 'war') return 3; if (nm === 'final war') return 4; if (nm) return 0;
        }
      } catch (e) { /* fall through */ }
    }
    const r = S.empires[a].relations && S.empires[a].relations[b];
    return r && typeof r.treaty === 'number' ? r.treaty : 0;
  }
  function tradeWith(S, a) {                                   // does `a` have a trade agreement with any other empire?
    for (const E of S.empires) {
      if (E.id === a || !E.alive) continue;
      const D = Sim.Diplo;
      if (D && typeof D.status === 'function') { try { const x = D.status(S, a, E.id); if (x && x.trade && (x.trade.bc | 0) > 0) return true; if (x) continue; } catch (e) { /* fall through */ } }
      const r = S.empires[a].relations && S.empires[a].relations[E.id];
      if (r && (r.trade | 0) > 0) return true;
    }
    return false;
  }
  const hullW = (E) => HULL_W[(E.designs && E.designs[0] && E.designs[0].hull) | 0] || 1;       // the original always uses design #0's hull (research/05 §7.2 BUG)
  const planetOutput = (S, E, p) => (Sim.Research ? Sim.Research.planetRP(E, p, p.spendable | 0) : 0);
  function destroyPlanet(S, p, type) {                         // game_planet_destroy: no colony, no buildings; type per caller
    if (Sim.Colony && Sim.Colony.abandon) Sim.Colony.abandon(S, p); else { p.owner = -1; p.pop = 0; p.factories = 0; p.bases = 0; p.shield = 0; }
    delete p.event;
    if (type === 'none') { p.type = 'none'; p.typeIdx = 0; p.growth = 'hostile'; p.mp1 = p.mp2 = p.mp3 = p.maxPop = 10; }
  }
  function killEmpire(S, E) {                                  // kill_player: the empire and its fleets vanish
    E.alive = false;
    S.fleets = S.fleets.filter(f => f.owner !== E.id);
    S.trans = (S.trans || []).filter(t => t.owner !== E.id);
    push(S, { type: 'empireDestroyed', empire: E.id });
  }
  function crank(S, E, p, firstTime, kind) {                   // AI reaction (research/05 §7.2): all sliders to research (plague, nova) or ships (comet, pirates), 1/5 of the reserve onto the planet
    if (E.human) return;
    p.sliders = kind === 'ship' ? [100, 0, 0, 0, 0] : [0, 0, 0, 0, 100];
    if (Sim.Colony && Sim.Colony.applyEcoFloor) Sim.Colony.applyEcoFloor(S, E, p);
    if (firstTime) { const give = Math.floor((E.bc | 0) / 5); if (give > 0) { E.bc -= give; p.bank = (p.bank | 0) + give; } }
  }

  // announce(): GNN item for everybody, presentation interrupt for the human victim / global happenings
  function announce(S, out, o) {
    const E = o.empire >= 0 ? S.empires[o.empire] : null;
    const item = { type: 'news', cat: o.cat, kind: o.kind, stage: o.stage, headline: o.text, empire: o.empire, planet: o.planet, star: o.star };
    if (o.empire2 !== undefined) item.empire2 = o.empire2;
    if (o.n !== undefined) item.n = o.n;
    if (o.field !== undefined) item.field = o.field;
    if (o.importance !== undefined) item.importance = o.importance;
    push(S, item);
    if (o.show || (E && E.human)) out.push({ type: 'event', kind: o.kind, stage: o.stage, empire: o.empire, empire2: o.empire2, planet: o.planet, star: o.star, text: o.text, cat: o.cat, vars: o.vars || {} });
  }

  // ---- the yearly roll (§7.1) ---------------------------------------------------------------------------------------------------------------------
  Ev.chance = function (S) {
    const e = stateOf(S), raw = e.year > S.year ? 0 : S.year - e.year;
    const sc = (cfg().EVENT_DIFF_SCALE || [[1, 2], [2, 3], [3, 4], [4, 5], [1, 1]])[diffOf(S)] || [1, 1];
    const scaled = Math.floor(raw * sc[0] / sc[1]);
    return { raw, scaled, p: Math.min(1, scaled / (cfg().EVENT_ROLL || 512)) };
  };
  // game_event_new_get_victim (verified against game_event.c): planets per owner; n < 4 -> 0, humans x5; m = max(5, min over ALL 6 slots, unused slots count 0);
  // w = trunc(w / m); then EVERY real player — alive or dead — gets max(w, 1). A dead empire can therefore be drawn: it has no planet and the attempt ends silently.
  Ev.victimWeights = function (S) {
    const w = S.empires.map(E => { const n = E.alive ? owned(S, E.id).length : 0; return n < 4 ? 0 : (E.human ? n * 5 : n); });
    const slots = w.slice(); while (slots.length < 6) slots.push(0);
    const m = Math.max(5, Math.min.apply(null, slots));
    return w.map(v => Math.max(Math.floor(v / m), 1));
  };
  Ev.pickVictim = function (S, R) {
    const w = Ev.victimWeights(S), total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return -1;
    let t = R.int(1, total);
    for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return i; }
    return -1;
  };
  Ev.monsterExists = S => (S.monsters || []).some(m => !m.gone && m.killer < 0);
  // the rejection list of §7.1 for a drawn kind
  Ev.rejects = function (S, kind, victim, p) {
    const e = stateOf(S), V = S.empires[victim], name = KINDS[kind], sp = p.special;
    if (e.done[name]) return true;
    switch (kind) {
      case 1: return V.race === 'silicoid' || !!(raceMod(V).noPlague);
      case 2: return (p.pop | 0) < 50;
      case 4: return V.race === 'silicoid' || !!(raceMod(V).noAccident);
      case 5: { if (S.gameOver) return true; return !S.empires.some(a => a.alive && !a.human && a.id !== victim && (treatyOf(S, victim, a.id) === 1 || treatyOf(S, victim, a.id) === 2)); }
      case 7: return S.year < 100;
      case 8: return !tradeWith(S, victim);
      case 9: return !!V.human;
      case 10: return !V.human || p.id === V.capital;
      case 11: case 12: return S.year < 200 || Ev.monsterExists(S) || S.settings.options.monsters === false;
      case 13: return p.typeIdx < 7 || p.growth === 'fertile' || p.growth === 'gaia' || !(sp === 'normal' || sp === 'poor' || sp === 'ultrapoor');
      case 14: return !(sp === 'normal' || sp === 'poor' || sp === 'ultrapoor');
      case 16: return !(sp === 'normal' || sp === 'rich' || sp === 'ultrarich' || sp === 'orion');
      default: return false;
    }
  };
  function raceMod(E) { const r = M.Data && M.Data.Races && M.Data.Races.races[E.race]; return (r && r.mod) || {}; }

  // one attempt: returns {kind, victim, planet} or null
  Ev.roll = function (S, R, out) {
    const e = stateOf(S);
    const ch = Ev.chance(S);
    if (R.int(1, cfg().EVENT_ROLL || 512) > ch.scaled) return null;
    const victim = Ev.pickVictim(S, R);
    if (victim < 0) return null;
    const mine = owned(S, victim);
    if (!mine.length) return null;
    const p = mine[R.int(0, mine.length - 1)];
    if (p.special === 'orion') return null;
    let kind = 0;
    for (let i = 0; i < 5; i++) { const k = R.int(1, 16); if (!Ev.rejects(S, k, victim, p)) { kind = k; break; } }
    if (!kind) return null;
    e.year = S.year; e.done[KINDS[kind]] = true;
    Ev.start(S, R, kind, victim, p, out || []);
    e.log.push({ year: S.year, kind: KINDS[kind], victim, planet: p.id });
    return { kind: KINDS[kind], victim, planet: p.id };
  };

  // ---- the sixteen events (§7.2): start-up effects ------------------------------------------------------------------------------------------------
  Ev.start = function (S, R, kind, victim, p, out) {
    const E = S.empires[victim], D = diffOf(S), name = pname(S, p), starName = S.stars[p.starId].name, prod = p.spendable | 0;
    const base = { empire: victim, planet: p.id, star: p.starId };
    switch (kind) {
      case 1: {                                                // plague
        const cure = (R.int(1, 8) + 2 * D) * prod;
        p.event = { type: 'plague', cure, cost: cure, born: S.year };
        crank(S, E, p, true);
        announce(S, out, Object.assign({ kind: 'plague', stage: 'start', cat: 'plague', n: cure, vars: { cure }, text: 'A deadly plague strikes ' + name + '. Until a cure costing ' + cure + ' research points is found, the colony loses population every year.' }, base));
        break;
      }
      case 2: {                                                // earthquake
        const popLoss = Math.floor((R.int(1, 10) + 20) * (p.pop | 0) / 100), facLoss = Math.floor((R.int(1, 50) + 30) * (p.factories | 0) / 100);
        p.pop = (p.pop | 0) - popLoss; p.factories = (p.factories | 0) - facLoss;
        announce(S, out, Object.assign({ kind: 'quake', stage: 'start', cat: 'earthquake', n: popLoss, vars: { pop: popLoss, factories: facLoss }, text: 'An earthquake devastates ' + name + ': ' + popLoss + ' colonists and ' + facLoss + ' factories are lost.' }, base));
        break;
      }
      case 3: {                                                // supernova warning
        const years = R.int(1, 5) + 10 - D, cost = (R.int(1, 5) + 10 - D) * prod;
        p.event = { type: 'nova', years, cost, cost0: cost, born: S.year };
        crank(S, E, p, true);
        announce(S, out, Object.assign({ kind: 'nova', stage: 'start', cat: 'novaWarning', n: years, vars: { years, cost }, text: 'The star at ' + starName + ' is about to go nova in ' + years + ' years unless a stabilising effort of ' + cost + ' research points is completed.' }, base));
        break;
      }
      case 4: {                                                // industrial accident
        p.mp3 = Math.floor((p.mp3 | 0) / 2); p.mp2 = Math.min(p.mp2 | 0, p.mp3); p.waste = Math.max(0, p.mp3 - 10);
        p.type = 'radiated'; p.typeIdx = 1; p.growth = 'hostile';
        p.event = { type: 'accident', born: S.year };
        announce(S, out, Object.assign({ kind: 'accident', stage: 'start', cat: 'accident', n: p.mp3, vars: { maxPop: p.mp3 }, text: 'An industrial accident has poisoned ' + name + '; its maximum population is halved to ' + p.mp3 + '.' }, base));
        break;
      }
      case 5: {                                                // assassination / diplomatic blunder
        let who = -1;
        for (const a of S.empires) if (a.alive && !a.human && a.id !== victim) { const t = treatyOf(S, victim, a.id); if (t === 1 || t === 2) who = a.id; }
        if (who < 0) break;
        declareWar(S, R, who, victim);
        announce(S, out, { kind: 'assassin', stage: 'start', cat: 'warDeclared', empire: who, empire2: victim, planet: p.id, star: p.starId, n: who, vars: { assassin: who, victim }, importance: 2, show: !!E.human,
          text: 'Assassins of the ' + S.empires[who].plural + ' have struck at ' + E.leader + '. The ' + S.empires[who].plural + ' declare war on the ' + E.plural + '!' });
        break;
      }
      case 6: {                                                // computer virus
        const f = [0, 2, 4, 5][R.int(0, 3)], lost = E.research.invest[f] | 0;
        E.research.invest[f] = 0;
        announce(S, out, Object.assign({ kind: 'virus', stage: 'start', cat: 'virus', n: lost, field: FIELD_NAMES[f], vars: { field: f, lost }, text: 'A computer virus has wiped out all ' + FIELD_NAMES[f] + ' research in progress (' + lost + ' research points lost).' }, base));
        break;
      }
      case 7: {                                                // comet
        const years = R.int(1, 5) + 10 - D, hp = (R.int(1, 5) + 10 + D) * 25;
        p.event = { type: 'comet', years, hp, dmg: 0, born: S.year };
        crank(S, E, p, true, 'ship');
        announce(S, out, Object.assign({ kind: 'comet', stage: 'start', cat: 'comet', n: years, vars: { years, hp }, text: 'A comet is heading for ' + name + ': impact in ' + years + ' years unless our ships destroy it first.' }, base));
        break;
      }
      case 8: {                                                // pirates
        const star = R.int(0, S.stars.length - 1), hp = (R.int(1, 5) + 10 + D) * 30;
        stateOf(S).pirates = { star, hp, maxHp: hp, born: S.year, victim };
        { const pp = S.planets[star]; if (pp && pp.owner >= 0) crank(S, S.empires[pp.owner], pp, true, 'ship'); }
        announce(S, out, { kind: 'pirates', stage: 'start', cat: 'piracy', empire: victim, planet: -1, star, n: Math.floor(hp / 6), show: true, vars: { setback: Math.floor(hp / 6) },
          text: 'Space pirates are raiding trade lanes near ' + S.stars[star].name + '; trade income is falling by ' + Math.floor(hp / 6) + ' percent a year.' });
        break;
      }
      case 9: {                                                // ancient derelict (never a human victim)
        let n = 0;
        for (const f of [5, 2]) {
          const tiers = Math.min(10, Math.floor((E.research.tl[f] | 0) / 5) + 2);
          for (let t = 0; t < tiers; t++) { const lvl = E.research.list[f][t] && E.research.list[f][t][0]; if (lvl && Sim.Research.grant(S, E, f, lvl, 'loot')) n++; }
        }
        announce(S, out, Object.assign({ kind: 'derelict', stage: 'start', cat: 'derelict', n, vars: { techs: n }, text: 'An ancient derelict has been found by the ' + E.plural + '; their scientists gain weapon and force-field secrets (' + n + ' technologies).' }, base));
        break;
      }
      case 10: {                                               // rebellion (human victims only, never the home planet)
        p.rebels = Math.max(1, Math.min(p.pop | 0, Math.floor((p.pop | 0) / 2))); p.unrest = 2;
        announce(S, out, Object.assign({ kind: 'rebellion', stage: 'start', cat: 'planetRebels', n: p.rebels, vars: { rebels: p.rebels }, text: 'Rebels seize ' + name + '! Its colonists renounce your rule.' }, base));
        break;
      }
      case 11: case 12: {                                      // monsters
        Ev.spawnMonster(S, R, kind === 11 ? 'crystal' : 'amoeba', out);
        break;
      }
      case 13: {                                               // fertile planet
        const before = p.mp2 | 0;
        if (Sim.Colony && Sim.Colony.soilEnrich) Sim.Colony.soilEnrich(S, E, p, 'fertile');
        else { const step = v => Math.max(5, Math.ceil(v / 5) * 5); p.mp2 = (p.mp1 | 0) + step((p.mp1 | 0) * 0.25); p.mp3 = (p.mp3 | 0) + (p.mp2 - before); p.growth = 'fertile'; }
        announce(S, out, Object.assign({ kind: 'enviro', stage: 'start', cat: 'terraform', n: (p.mp2 | 0) - before, vars: { gain: (p.mp2 | 0) - before }, text: name + "'s soil has become unusually fertile: maximum population +" + ((p.mp2 | 0) - before) + '.' }, base));
        break;
      }
      case 14: {                                               // mineral-rich planet
        p.special = 'rich';
        announce(S, out, Object.assign({ kind: 'rich', stage: 'start', cat: 'richPlanet', vars: {}, text: 'Rich mineral deposits have been discovered on ' + name + ': industry there is doubled.' }, base));
        break;
      }
      case 15: {                                               // donation
        const bc = Math.max(500, Math.floor(S.year / 10) * 100);
        E.bc = (E.bc | 0) + bc;
        announce(S, out, Object.assign({ kind: 'support', stage: 'start', cat: 'donation', n: bc, vars: { bc }, text: 'A wealthy benefactor donates ' + bc + ' BC to the ' + E.plural + '.' }, base));
        break;
      }
      case 16: {                                               // depleted planet
        p.special = 'poor';
        announce(S, out, Object.assign({ kind: 'poor', stage: 'start', cat: 'poorPlanet', vars: {}, text: name + "'s mineral deposits are being exhausted: industry there is reduced." }, base));
        break;
      }
      default: break;
    }
    return p.event || null;
  };

  function declareWar(S, R, a, b) {                            // start_war(a, b): treaties and trade end, relations crash to -75..-100
    const D = Sim.Diplo;
    if (D && typeof D.declareWar === 'function') { try { D.declareWar(S, a, b, 'assassin', 13); return; } catch (e) { /* fall through */ } }
    for (const [x, y] of [[a, b], [b, a]]) {
      const rs = S.empires[x].relations; if (!rs || !rs[y]) continue;
      rs[y].treaty = 3; rs[y].trade = 0; rs[y].attitude = -75 - R.int(0, 25);
    }
  }

  // ---- running events (§7.2 "from turn 2 each turn") ------------------------------------------------------------------------------------------------
  function progress(S, R, out) {
    for (const p of S.planets) {
      const ev = p.event;
      if (!ev) continue;
      if (p.owner < 0) { delete p.event; continue; }
      const E = S.empires[p.owner], name = pname(S, p), starName = S.stars[p.starId].name, base = { empire: E.id, planet: p.id, star: p.starId };
      if (ev.type === 'plague') {
        crank(S, E, p, false);
        if (ev.cure > 0) {
          const loss = Math.floor((R.int(1, 6) + 4) * (p.pop | 0) / 100);
          p.pop = Math.max(0, (p.pop | 0) - loss);
          ev.cure -= planetOutput(S, E, p);
          if (ev.cure > 0 && E.human && R.int(1, 10) === 1) announce(S, out, Object.assign({ kind: 'plague', stage: 'progress', cat: 'plagueProgress', n: loss, vars: { loss, left: ev.cure }, text: 'The plague on ' + name + ' claims ' + loss + ' more colonists; ' + ev.cure + ' research points are still needed.' }, base));
        }
        if (ev.cure <= 0) { delete p.event; announce(S, out, Object.assign({ kind: 'plague', stage: 'end', cat: 'plagueCured', vars: {}, text: 'A cure has been found: the plague on ' + name + ' is over.' }, base)); }
      } else if (ev.type === 'nova') {
        crank(S, E, p, false);
        ev.cost -= planetOutput(S, E, p);
        if (ev.cost <= 0) { delete p.event; announce(S, out, Object.assign({ kind: 'nova', stage: 'averted', cat: 'novaAverted', vars: {}, text: 'The star at ' + starName + ' has been stabilised; ' + name + ' is safe.' }, base)); continue; }
        ev.years -= 1;
        if (ev.years <= 0) {
          delete p.event;
          const maxPop = R.int(1, 10) + 10;
          p.type = 'radiated'; p.typeIdx = 1; p.growth = 'hostile'; p.mp1 = p.mp2 = p.mp3 = p.maxPop = maxPop; p.waste = 0;
          p.pop = Math.min(p.pop | 0, R.int(1, maxPop));
          p.factories = Math.min(p.factories | 0, Math.floor((R.int(1, 3) + 1) * (p.factories | 0) / 20));
          announce(S, out, Object.assign({ kind: 'nova', stage: 'end', cat: 'systemNova', importance: 2, vars: {}, text: 'The star ' + starName + ' has gone nova! ' + name + ' is scorched to a radiated cinder.' }, base));
        } else if (E.human && (ev.years < 3 || R.int(1, 10) === 1)) {
          announce(S, out, Object.assign({ kind: 'nova', stage: 'progress', cat: 'novaProgress', n: ev.years, vars: { years: ev.years, left: ev.cost }, text: 'The star at ' + starName + ' will go nova in ' + ev.years + ' years unless ' + ev.cost + ' more research points are invested.' }, base));
        }
      } else if (ev.type === 'accident') {
        if ((p.waste | 0) <= 0) { delete p.event; announce(S, out, Object.assign({ kind: 'accident', stage: 'end', cat: 'accidentCleaned', vars: {}, text: 'The poison on ' + name + ' has been cleaned up.' }, base)); }
      } else if (ev.type === 'comet') {
        crank(S, E, p, false, 'ship');
        const hw = hullW(E);
        let dmg = 0;
        for (const f of S.fleets) if (f.star === p.starId && f.owner === p.owner) for (let i = 0; i < f.ships.length; i++) if (f.ships[i] > 0) dmg += R.int(1, hw) * f.ships[i];
        ev.dmg += dmg;
        if (ev.dmg > ev.hp) { delete p.event; announce(S, out, Object.assign({ kind: 'comet', stage: 'destroyed', cat: 'cometDestroyed', vars: {}, text: 'The comet was destroyed before it could strike ' + name + '.' }, base)); continue; }
        ev.years -= 1;
        if (ev.years <= 0) {
          announce(S, out, Object.assign({ kind: 'comet', stage: 'end', cat: 'planetDestroyed', importance: 2, vars: {}, text: 'The comet strikes ' + name + '. The colony is annihilated.' }, base));
          destroyPlanet(S, p, 'none');
          if (!owned(S, E.id).length) killEmpire(S, E);
        } else if (E.human && R.int(1, 10) === 1) {
          announce(S, out, Object.assign({ kind: 'comet', stage: 'progress', cat: 'cometProgress', n: ev.years, vars: { years: ev.years, percent: Math.floor(ev.dmg * 100 / ev.hp) }, text: 'The comet heading for ' + name + ' is ' + Math.floor(ev.dmg * 100 / ev.hp) + '% destroyed; ' + ev.years + ' years to impact.' }, base));
        }
      }
    }
    pirates(S, R, out);
  }

  // pirates (§7.2 #8): ships at the pirate star chip away at them, a monster kills them outright; while alive trade collapses
  Ev.pirateSetback = function (S, a, b) {
    const pr = S.events && S.events.pirates;
    if (!pr || pr.hp <= 0) return 0;
    const cov = id => { const E = S.empires[id]; return !!(E && E.frange && E.frange[pr.star] >= 1); };
    return cov(a) || cov(b) ? Math.floor(pr.hp / 6) : 0;
  };
  // trade_percent *= (100 - hp/6)/100 for every trading pair whose supply range covers the pirate star (Diplo keeps the efficiency in E.relations[j].tradePct, mirrored in both records)
  function raidTrade(S, star) {
    void star;
    const n = S.empires.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const ra = S.empires[a].relations && S.empires[a].relations[b], rb = S.empires[b].relations && S.empires[b].relations[a];
      if (!ra || !rb || typeof ra.tradePct !== 'number' || !(ra.trade > 0)) continue;
      const pct = Ev.pirateSetback(S, a, b);
      if (pct > 0) { const v = Math.trunc(ra.tradePct * (100 - pct) / 100); ra.tradePct = rb.tradePct = v; }
    }
  }
  function pirates(S, R, out) {
    const e = stateOf(S), pr = e.pirates;
    if (!pr || pr.hp <= 0) return;
    if (pr.born === S.year) return;
    let dead = (S.monsters || []).some(m => !m.gone && m.killer < 0 && m.star === pr.star);
    if (!dead) {
      let dmg = 0;
      for (const f of S.fleets) { if (f.star !== pr.star) continue; const hw = hullW(S.empires[f.owner]); for (let i = 0; i < f.ships.length; i++) if (f.ships[i] > 0) dmg += R.int(1, hw) * f.ships[i]; }
      pr.hp -= dmg; dead = pr.hp <= 0;
    }
    if (dead) {
      pr.hp = 0;
      announce(S, out, { kind: 'pirates', stage: 'end', cat: 'piracyEnded', empire: pr.victim, planet: -1, star: pr.star, show: true, vars: {}, text: 'The pirates near ' + S.stars[pr.star].name + ' have been destroyed; trade recovers.' });
      return;
    }
    { const pp = S.planets[pr.star]; if (pp && pp.owner >= 0) crank(S, S.empires[pp.owner], pp, false, 'ship'); }
    const setback = Math.floor(pr.hp / 6), D = Sim.Diplo;
    if (D && typeof D.pirateRaid === 'function') { try { D.pirateRaid(S, pr.star, setback); } catch (err) { /* optional hook */ } }
    else raidTrade(S, pr.star);
    if (R.int(1, 10) === 1) announce(S, out, { kind: 'pirates', stage: 'progress', cat: 'piracyProgress', empire: pr.victim, planet: -1, star: pr.star, n: setback, show: false, vars: { setback }, text: 'Pirate raiders near ' + S.stars[pr.star].name + ' still cut trade by ' + setback + ' percent.' });
  }

  // ---- monsters (§7.4) ----------------------------------------------------------------------------------------------------------------------------------
  Ev.monsterAt = function (S, star) { return (S.monsters || []).find(m => !m.gone && m.killer < 0 && m.star === star && m.attackable) || null; };
  Ev.killMonster = function (S, m, empire) { if (typeof m === 'number') m = (S.monsters || []).find(x => x.id === m); if (!m) return false; m.killer = empire; m.attackable = false; return true; };

  Ev.spawnMonster = function (S, R, kind, out) {
    const g = S.galaxy, cols = g.cols, rows = g.rows, edge = R.int(0, 3);
    let star, x, y;
    if (edge === 0) { star = R.int(0, rows - 1) * cols; x = 0; y = S.stars[star].y; }                                  // left: the first star of a random row
    else if (edge === 2) { star = R.int(0, rows - 1) * cols + cols - 1; x = g.w; y = S.stars[star].y; }               // right: the last star of a random row
    else if (edge === 1) { star = R.int(0, cols - 1); x = S.stars[star].x; y = 0; }                                    // top: a random column of the first row
    else { star = (rows - 1) * cols + R.int(0, cols - 1); x = S.stars[star].x; y = g.h; }                              // bottom: a random column of the last row
    const hp = Ev.MONSTERS[kind].hp[diffOf(S)];
    const m = { id: nextId(S), kind, name: Ev.MONSTERS[kind].name, x, y, star: -1, dest: star, counter: 2, nuked: 0, hit: false, attackable: false, resting: false, killer: -1, hp, maxHp: hp, born: S.year, edge };
    (S.monsters || (S.monsters = [])).push(m);
    const text = 'A giant ' + m.name + ' has appeared at the rim of the galaxy, drifting towards ' + S.stars[star].name + '.';
    announce(S, out || [], { kind, stage: 'start', cat: 'monsterSpawn', empire: -1, planet: -1, star, show: true, importance: 1, vars: { monster: m.id, edge }, text });
    return m;
  };

  function stepMonster(S, m) {                                  // 11 map units a turn = warp 1: 5 then 6
    const B = S.stars[m.dest], Geo = Sim.Geo;
    let p = Geo.goLine(m.x, m.y, B.x, B.y, 5); m.x = p[0]; m.y = p[1];
    if (m.x !== B.x || m.y !== B.y) { p = Geo.goLine(m.x, m.y, B.x, B.y, 6); m.x = p[0]; m.y = p[1]; }
    m.star = (m.x === B.x && m.y === B.y) ? m.dest : -1;
    m.attackable = m.star >= 0 && !m.hit; m.resting = false;
  }
  function nextStar(S, R, m) {
    const g = S.galaxy, cols = g.cols, rows = g.rows, here = m.star;
    const c0 = here % cols, r0 = Math.floor(here / cols);
    for (let i = 0; i < 60; i++) {
      const c = c0 + R.int(-1, 1), r = r0 + R.int(-1, 1);
      if ((c === c0 && r === r0) || c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const id = r * cols + c, p = S.planets[id];
      if (!p || p.typeIdx === 0 || id === S.orion) continue;
      return id;
    }
    return -1;
  }
  function arrive(S, R, m, out) {
    const p = S.planets[m.star], name = m.name;
    if (p.owner >= 0) {
      const E = S.empires[p.owner], pn = pname(S, p), base = { empire: E.id, planet: p.id, star: p.starId };
      if (m.kind === 'amoeba') {
        const fac = Math.floor((p.factories | 0) / 10), maxPop = R.int(1, 3) * 5 + 5;
        destroyPlanet(S, p, null);                                               // colony destroyed, owner removed
        p.pop = 0; p.factories = fac;
        p.type = 'radiated'; p.typeIdx = 1; p.growth = 'hostile'; p.mp1 = p.mp2 = p.mp3 = p.maxPop = maxPop; p.waste = 0;
      } else { p.pop = 0; p.popFrac = 0; p.waste = Math.max(0, (p.mp3 | 0) - 10); }
      m.nuked++;
      const last = !owned(S, E.id).length;
      announce(S, out, Object.assign({ kind: m.kind, stage: last ? 'eliminated' : 'hit', cat: 'monsterAttack', n: m.nuked, importance: last ? 2 : 1, vars: { monster: m.id }, text: 'The ' + name + ' descends on ' + pn + (m.kind === 'amoeba' ? ' and devours the colony.' : ' and leaves the colony without a living soul.') + (last ? ' The ' + E.plural + ' have lost their last colony.' : '') }, base));
      if (last) killEmpire(S, E);
    }
    if (Ev.pirateSetback && S.events.pirates && S.events.pirates.hp > 0 && S.events.pirates.star === m.star) S.events.pirates.hp = 0;     // monsters destroy pirates they pass through
    m.hit = true; m.attackable = false; m.resting = true;
    if (m.nuked > 4) { m.gone = true; announce(S, out, { kind: m.kind, stage: 'vanish', cat: 'monsterVanishes', empire: -1, planet: -1, star: m.star, show: true, vars: {}, text: 'The ' + name + ' has vanished from the galaxy as suddenly as it came.' }); return; }
    const nx = nextStar(S, R, m);
    if (nx < 0) { m.gone = true; return; }
    m.dest = nx; m.counter = 4;
  }
  function monsters(S, R, out) {
    const list = S.monsters;
    if (!list || !list.length) return;
    for (const m of list) {
      if (m.gone) continue;
      if (m.killer >= 0) {
        m.gone = true;
        const K = S.empires[m.killer];
        announce(S, out, { kind: m.kind, stage: 'killed', cat: 'monsterKilled', empire: m.killer, planet: -1, star: m.star >= 0 ? m.star : m.dest, show: true, importance: 1, vars: {}, text: 'The ' + m.name + ' has been destroyed by the ' + (K ? K.plural : 'galaxy') + '!' });
        continue;
      }
      if (m.star >= 0 && m.star === m.dest && !m.hit) { arrive(S, R, m, out); continue; }
      if (m.counter > 0) { m.counter--; if (m.counter > 0) continue; }
      m.hit = false; stepMonster(S, m);
    }
    S.monsters = list.filter(m => !m.gone);
  }

  // ---- housekeeping that must run even with random events switched off ---------------------------------------------------------------------------------
  function upkeep(S, R) {
    const e = stateOf(S);
    if (e.upkeepTurn === S.turn) return;
    e.upkeepTurn = S.turn;
    if (Sim.Artifacts) { Sim.Artifacts.processGuardian(S, R); Sim.Artifacts.clearOrion(S); }
    if (Sim.Council && Sim.Council.finalWarTurn) Sim.Council.finalWarTurn(S);
    if (!e.orionNews && S.orion !== undefined && S.orion >= 0 && S.planets[S.orion] && S.planets[S.orion].owner >= 0) {       // "<race> has colonised Orion" (§11.2 #17)
      e.orionNews = true;
      const o = S.empires[S.planets[S.orion].owner];
      push(S, { type: 'news', cat: 'orionColonised', kind: 'orion', stage: 'start', empire: o.id, planet: S.orion, star: S.orion, importance: 1, headline: 'The ' + o.plural + ' have colonised Orion, throne-world of the Ancients.' });
    }
  }

  // ---- coups (research/01 §5.12, research/05 §7.3) ------------------------------------------------------------------------------------------------------
  Ev.coups = function (S, R) {
    R = R || M.RNG.bind(S.rs);
    upkeep(S, R);
    const G = Sim.Ground;
    const due = [];
    if (G && typeof G.coupCheck === 'function') { for (const c of G.coupCheck(S)) due.push(S.empires[c.empire]); }
    else for (const E of S.empires) {
      if (!E.alive) continue;
      let n = 0, reb = 0;
      for (const p of S.planets) if (p.owner === E.id) { n++; if ((p.unrest | 0) === 2) reb++; }
      if (n > 0 && reb >= Math.ceil(n / 2)) due.push(E);                                 // at least half (rounded up) of the planets in rebellion
    }
    for (const E of due) coup(S, R, E);
  };
  function resetRelations(S, E) {                              // relation1 := relation2 on every pair; treaties and trade with humans are cancelled (research/01 §5.12)
    const D = Sim.Diplo;
    if (D && typeof D.onCoup === 'function') { try { D.onCoup(S, E.id); return; } catch (err) { /* fall through */ } }
    for (const o of S.empires) {
      if (o.id === E.id) continue;
      const a = E.relations && E.relations[o.id], b = o.relations && o.relations[E.id];
      if (a && b && typeof a.rel2 === 'number') { a.rel1 = a.attitude = a.rel2; b.rel1 = b.attitude = a.rel2; }
      if (o.human && a && b) {
        if (D && typeof D.breakTrade === 'function') { try { D.breakTrade(S, E.id, o.id); } catch (err) { a.trade = 0; b.trade = 0; } } else { a.trade = 0; b.trade = 0; }
        if (D && typeof D.setTreaty === 'function') { try { D.setTreaty(S, E.id, o.id, 0); } catch (err) { a.treaty = 0; b.treaty = 0; } } else { a.treaty = 0; b.treaty = 0; }
      }
    }
  }
  function coup(S, R, E) {
    const G = Sim.Ground, PERS = (M.Data && M.Data.Races && M.Data.Races.PERSONALITIES) || [], OBJ = (M.Data && M.Data.Races && M.Data.Races.OBJECTIVES) || [];
    if (E.human && S.empires.filter(x => x.human && x.alive).length === 1) {   // the LAST living human is toppled: the funeral ending (game_event_run); with several humans it is an ordinary coup
      for (const p of S.planets) if (p.owner === E.id) { p.unrest = 0; p.rebels = 0; }
      E.alive = false;
      const others = S.empires.filter(x => x.human && x.alive);
      if (!others.length) {
        const rest = S.empires.filter(x => x.alive);
        S.gameOver = { reason: 'defeat', winner: rest.length ? rest[0].id : -1, cause: 'coup', empire: E.id, year: S.year };
      }
      push(S, { type: 'news', cat: 'coup', kind: 'coup', stage: 'human', empire: E.id, headline: 'A coup topples ' + E.leader + ' and the ' + E.plural + ' government falls.', importance: 2 });
      return;
    }
    if (E.human) {                                              // one of several humans: rebellions end, relation1 := relation2, treaties and trade with the other humans are cancelled
      for (const p of S.planets) if (p.owner === E.id) { p.unrest = 0; p.rebels = 0; }
      resetRelations(S, E);
      push(S, { type: 'news', cat: 'coup', kind: 'coup', stage: 'human2', empire: E.id, headline: 'A coup shakes the ' + E.plural + ' government, but ' + E.leader + ' holds on.', importance: 1 });
      return;
    }
    if (G && typeof G.applyCoup === 'function') G.applyCoup(S, E.id, R);          // every rebellion ends, new random personality + objective, new leader name
    else {
      E.personality = R.int(0, 5); E.objective = R.int(0, 5);
      for (const p of S.planets) if (p.owner === E.id) { p.unrest = 0; p.rebels = 0; }
      const races = (M.Data && M.Data.Races && M.Data.Races.races) || {}, used = {}; for (const x of S.empires) used[x.leader] = true;
      const pool = ((races[E.race] && races[E.race].leaders) || []).filter(n => !used[n]);
      if (pool.length) E.leader = pool[R.int(0, pool.length - 1)];
    }
    resetRelations(S, E);
    push(S, { type: 'news', cat: 'coup', kind: 'coup', stage: 'ai', empire: E.id, n: E.personality, headline: 'A coup in the ' + E.plural + ' empire: a ' + (PERS[E.personality] || 'new') + ', ' + (OBJ[E.objective] || 'new') + ' leader, ' + E.leader + ', takes power.', importance: 1 });
    stateOf(S).log.push({ year: S.year, kind: 'coup', victim: E.id });
  }

  // the pieces of Ev.turn, exported for tests and for hosts that schedule them separately
  Ev.progress = progress; Ev.moveMonsters = monsters; Ev.upkeep = upkeep;

  // ---- the turn hook ---------------------------------------------------------------------------------------------------------------------------------------
  Ev.turn = function (S, R) {
    R = R || M.RNG.bind(S.rs);
    stateOf(S);
    const out = [];
    upkeep(S, R);
    progress(S, R, out);
    monsters(S, R, out);
    Ev.roll(S, R, out);
    return out;
  };

  // ---- orders ----------------------------------------------------------------------------------------------------------------------------------------------
  // eventCure {planet, amount?}: pay BC from the reserve 1:1 into a plague cure / nova stabilisation (the research slider does the same for free)
  O.register('eventCure', function (S, E, o) {
    const p = S.planets[o.planet];
    if (!p || p.owner !== E.id) return O.fail('not your planet');
    const ev = p.event;
    if (!ev || (ev.type !== 'plague' && ev.type !== 'nova')) return O.fail('nothing to cure there');
    const key = ev.type === 'plague' ? 'cure' : 'cost', left = Math.max(0, ev[key]);
    const want = o.amount === undefined ? left : Math.floor(+o.amount);
    if (!(want > 0)) return O.fail('bad amount');
    const pay = Math.min(want, left, E.bc | 0);
    if (pay <= 0) return O.fail('no funds');
    E.bc -= pay; ev[key] -= pay;
    return O.ok({ paid: pay, left: ev[key] });
  });
});
