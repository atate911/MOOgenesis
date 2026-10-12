// Mock of the MOO.Sim API (newGame / autoTurn / stats / isOver) with a toy economy, so tools/soak.js can be developed and
// tested before (or without) the real simulation. Deterministic from settings.seed: all randomness comes from S.rs.
//   node tools/mock-sim.js [seed] [race] [difficulty]     // plays one game and prints a summary
//   require('./mock-sim.js').install(MOO)                  // sets MOO.Sim.{newGame,autoTurn,stats,isOver}
// Fault injection (tests the runner itself): settings.mock = {work, faults:[{kind,turn,p,arg}]}; see FAULTS below.
'use strict';

const { performance } = require('perf_hooks');
const v8 = require('v8');

const SIZES = { small: 24, medium: 48, large: 70, huge: 108, colossal: 150 };            // stars
const AGE_RICH = { young: 1.15, average: 1.0, old: 0.85 };                               // planet richness multiplier
const DIFF_BONUS = { simple: 0.7, easy: 0.85, average: 1.0, hard: 1.2, impossible: 1.45 }; // production/research bonus of AI empires 1+
const RACES = {
  alkari:   { prod: 1.00, res: 1.00, grow: 1.00, war: 1.15 },
  bulrathi: { prod: 1.10, res: 0.90, grow: 1.10, war: 1.20 },
  darlok:   { prod: 0.95, res: 1.00, grow: 1.00, war: 0.90 },
  human:    { prod: 1.00, res: 1.00, grow: 1.00, war: 1.00 },
  klackon:  { prod: 1.20, res: 0.85, grow: 1.10, war: 0.95 },
  meklar:   { prod: 1.25, res: 0.95, grow: 0.80, war: 1.00 },
  mrrshan:  { prod: 0.95, res: 1.00, grow: 1.00, war: 1.10 },
  psilon:   { prod: 0.85, res: 1.35, grow: 1.00, war: 0.85 },
  sakkra:   { prod: 1.00, res: 0.90, grow: 1.30, war: 1.10 },
  silicoid: { prod: 1.05, res: 0.80, grow: 0.90, war: 1.10 },
};
const PERSONALITIES = {                                   // aggr: appetite for war, peace: willingness to end it
  honorable:  { aggr: 0.5, peace: 1.4 }, xenophobic: { aggr: 1.1, peace: 0.5 }, ruthless: { aggr: 1.5, peace: 0.4 },
  aggressive: { aggr: 1.8, peace: 0.6 }, erratic: { aggr: 1.0, peace: 1.0 }, pacifist: { aggr: 0.2, peace: 1.8 },
};
const OBJECTIVES = {                                      // rshare: research share, mshare: military share of production
  militarist: { prod: 1.00, res: 0.95, rshare: 0.20, mshare: 0.45 }, ecologist: { prod: 0.95, res: 1.05, rshare: 0.30, mshare: 0.20 },
  diplomat: { prod: 1.00, res: 1.05, rshare: 0.30, mshare: 0.25 }, industrialist: { prod: 1.15, res: 0.90, rshare: 0.20, mshare: 0.30 },
  expansionist: { prod: 1.00, res: 0.95, rshare: 0.20, mshare: 0.25 }, technologist: { prod: 0.95, res: 1.20, rshare: 0.40, mshare: 0.20 },
};
const REL = { NONE: 0, PEACE: 1, WAR: 2, TREATY: 3 };
const REL_NAME = ['none', 'peace', 'war', 'treaty'];
const COLONY_COST = 60, SHIP_COST = 30;

// Injectable faults (settings.mock.faults, CLI: --mock-fail kind@turn[:probability[:arg]]).
const FAULTS = {
  throw: 'TypeError thrown from inside autoTurn (caught by the runner, game recorded as failed)',
  error: 'plain Error thrown from autoTurn',
  exit: 'process.exit(3) inside the worker thread (silent hard crash)',
  hang: 'infinite loop (needs the per-game timeout watchdog)',
  oom: 'allocates until the worker heap limit is hit (requires --max-mem-mb <= 1000)',
  slow: 'one very slow turn; arg = busy-wait ms (default 1500)',
  nan: 'NaN written into a planet', negpop: 'negative population on a planet', undef: 'undefined / function / Map values in S',
  cycle: 'S.self = S (cycle: JSON.stringify throws)', badowner: 'planet.owner pointing at a non-existent empire',
  leak: 'appends ~20KB of log entries to S every turn from the fault turn on', nondet: 'uses Math.random() (breaks determinism)',
  elim: 'empire 2 is eliminated at the fault turn', stuck: 'empire 1 production forced to 0 from the fault turn',
  norp: 'empire 1 research forced to 0 from the fault turn', noexpand: 'empire 1 never builds colony ships',
  badturn: 'S.turn fails to advance once', impure: 'Sim.stats() writes into the state (queries must be pure)',
  badreport: 'isOver() returns a function as the winner (result cannot be cloned to the parent)',
};

// ---- seeded RNG (sfc32 + xmur3, same algorithm as js/core/rng.js, but self-contained) --------------------------------
function sfc32(st) {
  let a = st[0] >>> 0, b = st[1] >>> 0, c = st[2] >>> 0, d = st[3] >>> 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
  st[0] = a >>> 0; st[1] = b >>> 0; st[2] = c >>> 0; st[3] = d >>> 0;
  return (t >>> 0) / 4294967296;
}
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function seedState(seed) {
  const n = xmur3(String(seed)), st = [n(), n(), n(), n()];
  for (let i = 0; i < 15; i++) sfc32(st);
  return st;
}
const hashFrac = str => { const n = xmur3(str); return n() / 4294967296; };

// ---- helpers -----------------------------------------------------------------------------------------------------
let sink = 0;
function spin(n) { let x = sink; for (let i = 1; i <= n; i++) x += Math.sqrt(i) * 0.5; sink = x; }   // deterministic CPU load
function churn(n) { let t = 0, o; for (let i = 0; i < n; i++) { o = { a: i, b: [i, i + 1, t] }; t += o.b.length; } sink += t; }   // short-lived garbage
function work(S) { const n = S.planets.length * S.empires.length * S.cfg.work; spin(n * 450); churn(n * 12); }
function busy(msec) { const end = performance.now() + msec; while (performance.now() < end) spin(1000); }
const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

function parseFaults(spec) {                              // "throw@30:0.2,slow@50:1:2000" -> [{kind,turn,p,arg}]
  if (!spec) return [];
  return String(spec).split(',').filter(Boolean).map(tok => {
    const m = /^([a-z]+)@(\d+)(?::([\d.]+))?(?::([\d.]+))?$/.exec(tok.trim());
    if (!m || !FAULTS[m[1]]) throw new Error("bad --mock-fail entry '" + tok + "' (kind@turn[:prob[:arg]]; kinds: " + Object.keys(FAULTS).join(', ') + ')');
    const f = { kind: m[1], turn: +m[2], p: m[3] === undefined ? 1 : +m[3] };
    if (m[4] !== undefined) f.arg = +m[4];
    return f;
  });
}

// ---- game creation -----------------------------------------------------------------------------------------------
function newGame(settings) {
  settings = settings || {};
  const size = settings.size || 'medium', age = settings.age || 'average', difficulty = settings.difficulty || 'average';
  if (!SIZES[size]) throw new Error("mock: unknown size '" + size + "'");
  if (!AGE_RICH[age]) throw new Error("mock: unknown age '" + age + "'");
  if (!DIFF_BONUS[difficulty]) throw new Error("mock: unknown difficulty '" + difficulty + "'");
  const race = settings.race || 'human';
  if (!RACES[race]) throw new Error("mock: unknown race '" + race + "'");
  const opponents = Math.max(1, Math.min(5, settings.opponents | 0 || 3));
  const mock = settings.mock || {};
  const S = {
    v: 1, mock: true, turn: 1, year: 2300, rs: seedState(settings.seed === undefined ? 0 : settings.seed),
    settings: {
      size, age, difficulty, opponents, race, seed: settings.seed, playerAI: !!settings.playerAI,
      options: Object.assign({ tactical: false, randomEvents: true, antarans: true, council: true }, settings.options),
    },
    stars: [], planets: [], fleets: [], battles: [], empires: [], over: null, nextId: 1, log: [],
    cfg: {
      work: mock.work === undefined ? 1 : mock.work,
      faults: (mock.faults || []).map(f => Object.assign({ done: false }, f, { on: f.p >= 1 || hashFrac(settings.seed + ':' + f.kind + ':' + f.turn) < f.p })),
    },
  };
  const R = () => sfc32(S.rs), rich = AGE_RICH[age], nStars = SIZES[size], side = Math.sqrt(nStars) * 12;

  for (let i = 0; i < nStars; i++) {                      // stars with a minimum spacing
    let x = 0, y = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = R() * side; y = R() * side;
      if (S.stars.every(s => Math.hypot(s.x - x, s.y - y) > 5)) break;
    }
    S.stars.push({ id: i, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, name: 'Star-' + i, planets: [] });
  }
  for (const st of S.stars) {                             // 1-2 planets each
    const n = R() < 0.45 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const p = { id: S.planets.length, star: st.id, x: st.x, y: st.y, owner: -1, pop: 0, maxPop: Math.max(2, Math.round((3 + R() * R() * 24) * rich)), factories: 0 };
      st.planets.push(p.id); S.planets.push(p);
    }
  }
  // empire 0 gets the requested race, the others random distinct races
  const others = Object.keys(RACES).filter(r => r !== race);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = others[i]; others[i] = others[j]; others[j] = t; }
  const races = [race].concat(others.slice(0, opponents));
  const homes = [];                                       // farthest-point sampling of home stars
  homes.push(S.stars[Math.floor(R() * nStars)]);
  while (homes.length < races.length) {
    let best = null, bd = -1;
    for (const st of S.stars) {
      if (homes.includes(st)) continue;
      const d = Math.min.apply(null, homes.map(h => dist(h, st)));
      if (d > bd) { bd = d; best = st; }
    }
    homes.push(best);
  }
  races.forEach((r, id) => {
    const home = S.planets[homes[id].planets[0]];
    home.owner = id; home.maxPop = Math.max(home.maxPop, 18); home.pop = 9; home.factories = 6;
    S.empires.push({
      id, race: r, name: cap(r) + ' Dominion', personality: pick(R, Object.keys(PERSONALITIES)), objective: pick(R, Object.keys(OBJECTIVES)),
      alive: true, bc: 50, prod: 0, rp: 0, techs: 0, techProg: 0, ships: 2, colonyReady: 1, warFleets: 0, pcol: 0, pship: 0, capital: home.id,
      rel: races.map(() => REL.NONE), since: races.map(() => 0),
    });
  });
  return S;
}

// ---- per-turn phases ---------------------------------------------------------------------------------------------
const techCost = n => 25 * Math.pow(1.07, n) * (1 + n / 5);
const multOf = (S, e) => RACES[e.race].prod * OBJECTIVES[e.objective].prod * (e.id === 0 ? 1 : DIFF_BONUS[S.settings.difficulty]);
const ownedPlanets = (S, id) => { const r = []; for (const p of S.planets) if (p.owner === id) r.push(p); return r; };

function setRel(S, a, b, st) {
  a.rel[b.id] = b.rel[a.id] = st;
  a.since[b.id] = b.since[a.id] = S.turn;
}

function eliminate(S, e, ev) {
  e.alive = false; e.ships = 0; e.colonyReady = 0; e.warFleets = 0; e.prod = 0; e.rp = 0;
  S.fleets = S.fleets.filter(f => f.owner !== e.id);
  for (const o of S.empires) if (o !== e) o.rel[e.id] = REL.NONE;
  ev.push({ type: 'eliminated', empire: e.id, turn: S.turn });
}

function applyFaults(S) {                                  // may throw / hang / corrupt state on purpose (tests of the runner)
  const t = S.turn;
  for (const f of S.cfg.faults) {
    if (!f.on) continue;
    switch (f.kind) {
      case 'throw': if (t === f.turn) S.empires[S.empires.length + 2].bc += 1; break;
      case 'error': if (t === f.turn) throw new Error('mock: injected exception at turn ' + t); break;
      case 'exit': if (t === f.turn) process.exit(3); break;
      case 'hang': if (t === f.turn) for (;;) spin(1e5); break;
      case 'oom':
        if (t === f.turn) {
          if (v8.getHeapStatistics().heap_size_limit > 1.2e9) throw new Error('mock oom fault refused: run with --max-mem-mb <= 1000');
          const hog = [];
          for (;;) hog.push({ a: t, b: [1, 2, 3], c: 'x' + hog.length });
        }
        break;
      case 'slow': if (t === f.turn) busy(f.arg || 1500); break;
      case 'nan': if (t === f.turn) S.planets[1].pop = NaN; break;
      case 'negpop': if (t === f.turn) S.planets[0].pop = -3; break;
      case 'undef': if (t === f.turn) { S.empires[0].junk = undefined; S.cache = new Map(); S.fn = function () {}; } break;
      case 'cycle': if (t === f.turn) S.self = S; break;
      case 'badowner': if (t === f.turn) S.planets[2].owner = 99; break;
      case 'leak': if (t >= f.turn) for (let i = 0; i < 250; i++) S.log.push({ t, i, msg: 'leaked log entry ' + 'x'.repeat(40) }); break;
      case 'nondet': if (t >= f.turn && t <= 40) S.empires[0].bc += Math.random() * 1e-6; break;
      case 'elim':
        if (t === f.turn && S.empires[2] && S.empires[2].alive) {
          for (const p of S.planets) if (p.owner === 2) { p.owner = -1; p.pop = 0; }
          eliminate(S, S.empires[2], []);
        }
        break;
      case 'badreport': if (t === f.turn) S.over = { winner: function () {}, reason: 'conquest' }; break;
      case 'badturn': if (t === f.turn && !f.done) { f.done = true; S.skipTurn = true; } break;
      default: break;                                      // stuck / norp / noexpand are handled in the economy
    }
  }
}
const faultOn = (S, kind) => S.cfg.faults.some(f => f.on && f.kind === kind && S.turn >= f.turn);

function aiPhase(S, R, ev) {
  work(S);
  for (const e of S.empires) {
    if (!e.alive) continue;
    const pers = PERSONALITIES[e.personality];
    while (e.colonyReady > 0 && !(faultOn(S, 'noexpand') && e.id === 1)) {   // colony ships go to the nearest free planet nobody is already flying to
      const cap0 = S.planets[e.capital];
      let best = null, bd = 1e9;
      for (const p of S.planets) {
        if (p.owner !== -1 || p.maxPop < 4) continue;
        if (S.fleets.some(f => f.kind === 'colony' && f.to === p.id)) continue;
        const d = dist(cap0, p) * (1 - Math.min(0.5, p.maxPop / 60));
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) break;
      e.colonyReady--;
      S.fleets.push({ id: S.nextId++, owner: e.id, kind: 'colony', ships: 1, to: best.id, eta: Math.max(1, Math.ceil(dist(cap0, best) / 3)) });
      ev.push({ type: 'launch', empire: e.id, kind: 'colony', planet: best.id });
    }
    let enemy = null;
    for (const o of S.empires) {                           // diplomacy: wars and treaties between contacted empires
      if (o.id === e.id || !o.alive || e.rel[o.id] === REL.NONE) continue;
      const st = e.rel[o.id];
      if (st === REL.WAR) {
        enemy = enemy || o;
        if (S.turn - e.since[o.id] > 8 && R() < 0.012 * pers.peace * (o.ships <= e.ships ? 0.8 : 1.3)) {
          setRel(S, e, o, REL.PEACE); ev.push({ type: 'peace', a: e.id, b: o.id }); enemy = null;
        }
      } else if (e.id < o.id || st === REL.PEACE) {
        const ratio = Math.min(2, (e.ships + 1) / (o.ships + 1));
        if (S.turn > 25 && R() < 0.03 * pers.aggr * ratio * (st === REL.TREATY ? 0.5 : 1)) { setRel(S, e, o, REL.WAR); ev.push({ type: 'war', a: e.id, b: o.id }); enemy = enemy || o; }
        else if (st === REL.PEACE && R() < 0.008 * (2.2 - pers.aggr)) { setRel(S, e, o, REL.TREATY); ev.push({ type: 'treaty', a: e.id, b: o.id }); }
      }
    }
    if (enemy && e.ships >= 6 && e.warFleets < 3) {        // launch an attack on the enemy planet closest to our capital
      const cap0 = S.planets[e.capital];
      let best = null, bd = 1e9;
      for (const p of S.planets) { if (p.owner !== enemy.id) continue; const d = dist(cap0, p); if (d < bd) { bd = d; best = p; } }
      if (best) {
        const n = Math.floor(e.ships * 0.7);
        e.ships -= n; e.warFleets++;
        S.fleets.push({ id: S.nextId++, owner: e.id, kind: 'war', ships: n, to: best.id, eta: Math.max(1, Math.ceil(bd / 4)) });
        ev.push({ type: 'launch', empire: e.id, kind: 'war', planet: best.id });
      }
    }
  }
}

function movePhase(S, R, ev) {
  work(S);
  const keep = [];
  for (const f of S.fleets) {
    if (--f.eta > 0) { keep.push(f); continue; }
    const e = S.empires[f.owner], p = S.planets[f.to];
    if (!e.alive) continue;
    if (f.kind === 'colony') {
      if (p.owner === -1) { p.owner = e.id; p.pop = 1.2; p.factories = 0; ev.push({ type: 'colonize', empire: e.id, planet: p.id }); }
      else e.colonyReady++;                                // lost the race for that planet: re-target next turn
    } else if (p.owner === e.id || p.owner === -1 || e.rel[p.owner] !== REL.WAR) { e.ships += f.ships; e.warFleets--; }
    else S.battles.push({ att: e.id, planet: p.id, ships: f.ships });
  }
  S.fleets = keep;
}

function combatPhase(S, R, ev) {
  work(S);
  for (const b of S.battles) {
    const att = S.empires[b.att], p = S.planets[b.planet], def = S.empires[p.owner];
    if (!att.alive) continue;
    att.warFleets--;
    if (!def || !def.alive) { att.ships += b.ships; continue; }
    const aStr = b.ships * (1 + 0.05 * att.techs) * RACES[att.race].war;
    const dStr = (def.ships * 0.35 + p.pop * 0.5 + p.factories * 0.08 + 2) * (1 + 0.05 * def.techs) * RACES[def.race].war;
    const ra = aStr * (0.7 + 0.6 * R()), rd = dStr * (0.7 + 0.6 * R());
    ev.push({ type: 'battle', att: att.id, def: def.id, planet: p.id, win: ra > rd });
    if (ra > rd) {
      att.ships += Math.max(0, b.ships - Math.ceil(b.ships * Math.min(0.9, 0.8 * rd / ra)));
      def.ships -= Math.floor(def.ships * 0.3);
      if (ra > rd * 1.15) {
        p.owner = att.id; p.pop *= 0.55; p.factories = Math.floor(p.factories * 0.4);
        ev.push({ type: 'conquer', empire: att.id, from: def.id, planet: p.id });
        if (p.id === def.capital) {                        // losing the capital shatters the empire: colonies defect or go independent
          for (const q of S.planets) { if (q.owner !== def.id) continue; const r = R(); if (r < 0.5) q.owner = att.id; else if (r < 0.62) { q.owner = -1; q.pop = 0; q.factories = 0; } }
          let nb = null;
          for (const q of S.planets) if (q.owner === def.id && (!nb || q.pop > nb.pop)) nb = q;
          if (nb) def.capital = nb.id;
        }
        if (!S.planets.some(q => q.owner === def.id)) eliminate(S, def, ev);
      }
    } else {
      att.ships += Math.floor(b.ships * 0.2);
      def.ships = Math.max(0, def.ships - Math.floor(b.ships * 0.3));
    }
  }
  S.battles = [];
}

function economyPhase(S, R, ev) {
  work(S);
  const gridOwned = new Array(S.empires.length).fill(0);
  for (const p of S.planets) if (p.owner >= 0) gridOwned[p.owner]++;
  for (const e of S.empires) {
    if (!e.alive) continue;
    const race = RACES[e.race], obj = OBJECTIVES[e.objective], mult = multOf(S, e);
    let prod = 0;
    for (const p of S.planets) {
      if (p.owner !== e.id) continue;
      p.pop = Math.min(p.maxPop, p.pop + race.grow * 0.08 * p.pop * (1 - p.pop / p.maxPop) + 0.05);
      const target = Math.floor(p.pop * 1.8);
      if (p.factories < target) p.factories++;
      prod += p.pop * 0.5 + p.factories * 0.3;
    }
    e.prod = faultOn(S, 'stuck') && e.id === 1 ? 0 : prod * mult * (1 + 0.02 * e.techs);
    e.rp = faultOn(S, 'norp') && e.id === 1 ? 0 : e.prod * obj.rshare * obj.res * race.res / obj.prod * 1.6;
    e.bc += e.prod * 0.08 - e.ships * 0.03;
    const rest = e.prod * (1 - obj.rshare);
    const wantColony = !(faultOn(S, 'noexpand') && e.id === 1) && S.planets.some(p => p.owner === -1 && p.maxPop >= 4);
    e.pcol += wantColony ? rest * (1 - obj.mshare) : 0;
    e.pship += rest * (wantColony ? obj.mshare : 1);
    while (e.pcol >= COLONY_COST) { e.pcol -= COLONY_COST; e.colonyReady++; }
    while (e.pship >= SHIP_COST) { e.pship -= SHIP_COST; e.ships++; }
    e.techProg += e.rp;
    while (e.techProg >= techCost(e.techs)) { e.techProg -= techCost(e.techs); e.techs++; ev.push({ type: 'tech', empire: e.id, n: e.techs }); }
  }
}

function worldPhase(S, R, ev) {                            // contact, random events, antarans, council, victory
  const alive = S.empires.filter(e => e.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (a.rel[b.id] !== REL.NONE) continue;
      const range = 22 + 1.5 * Math.max(a.techs, b.techs);
      let near = false;
      for (const p of S.planets) {
        if (p.owner !== a.id) continue;
        for (const q of S.planets) if (q.owner === b.id && dist(p, q) < range) { near = true; break; }
        if (near) break;
      }
      if (near) { setRel(S, a, b, REL.PEACE); ev.push({ type: 'contact', a: a.id, b: b.id }); }
    }
  }
  if (S.settings.options.randomEvents && alive.length && R() < 0.05) {
    const e = pick(R, alive), kind = pick(R, ['windfall', 'plague', 'discovery']);
    if (kind === 'windfall') e.bc += 40; else if (kind === 'discovery') e.techProg += 20;
    else for (const p of S.planets) if (p.owner === e.id) p.pop *= 0.93;
    ev.push({ type: 'event', empire: e.id, kind });
  }
  if (S.settings.options.antarans && S.turn > 100 && S.turn % 50 === 0 && alive.length) {
    const e = pick(R, alive); e.ships = Math.floor(e.ships * 0.6);
    ev.push({ type: 'antarans', empire: e.id });
  }
  const left = S.empires.filter(e => e.alive);
  const owned = left.map(e => ownedPlanets(S, e.id).length), total = owned.reduce((a, b) => a + b, 0);
  const top = owned.indexOf(Math.max.apply(null, owned));
  if (left.length <= 1) S.over = { winner: left.length ? left[0].id : null, reason: 'conquest' };
  else if (S.turn >= 60 && owned[top] >= 0.8 * total) S.over = { winner: left[top].id, reason: 'conquest' };   // the rest surrender
  else if (S.settings.options.council && S.turn >= 80 && S.turn % 20 === 0) {   // the council elects whoever holds half of the population
    const pops = left.map(e => ownedPlanets(S, e.id).reduce((s, p) => s + p.pop, 0)), tot = pops.reduce((s, v) => s + v, 0);
    let best = 0;
    for (let i = 1; i < pops.length; i++) if (pops[i] > pops[best]) best = i;
    const win = pops[best] / tot >= 0.5;
    ev.push({ type: 'council', winner: win ? left[best].id : null, share: Math.round(pops[best] / tot * 100) });
    if (win) S.over = { winner: left[best].id, reason: 'council' };
  }
}

function autoTurn(S) {
  const t0 = performance.now(), R = () => sfc32(S.rs), ev = [], tm = { ai: 0, move: 0, combat: 0, economy: 0, total: 0 };
  applyFaults(S);
  let t = performance.now();
  aiPhase(S, R, ev); tm.ai = performance.now() - t; t = performance.now();
  movePhase(S, R, ev); tm.move = performance.now() - t; t = performance.now();
  combatPhase(S, R, ev); tm.combat = performance.now() - t; t = performance.now();
  economyPhase(S, R, ev); worldPhase(S, R, ev); tm.economy = performance.now() - t;
  const played = S.turn;
  if (S.skipTurn) S.skipTurn = false; else { S.turn++; S.year++; }
  tm.total = performance.now() - t0;
  return { turn: played, events: ev, timings: tm };
}

function stats(S) {
  if (S.cfg.faults.some(f => f.on && f.kind === 'impure')) S.statsCalls = (S.statsCalls | 0) + 1;
  const rows = S.empires.map(e => ({
    id: e.id, race: e.race, personality: e.personality, objective: e.objective, alive: e.alive, colonies: 0, pop: 0,
    production: e.alive ? e.prod : 0, research: e.alive ? e.rp : 0, techs: e.techs, ships: e.ships, bc: e.bc, score: 0, relations: {},
  }));
  for (const p of S.planets) if (p.owner >= 0 && p.owner < rows.length) { rows[p.owner].colonies++; rows[p.owner].pop += p.pop; }
  for (const r of rows) {
    const e = S.empires[r.id];
    r.score = r.alive ? r.techs * 10 + r.colonies * 15 + r.pop * 1.2 + r.ships * 3 + r.bc * 0.02 : 0;
    for (const o of S.empires) if (o.id !== r.id) r.relations[o.id] = REL_NAME[e.rel[o.id]];
  }
  return rows;
}

function isOver(S) {
  return S.over ? { over: true, winner: S.over.winner, reason: S.over.reason } : { over: false, winner: null, reason: null };
}

function install(MOO) {
  const Sim = MOO.Sim = MOO.Sim || {};
  Sim.newGame = newGame; Sim.autoTurn = autoTurn; Sim.stats = stats; Sim.isOver = isOver;
  Sim.isMock = true; Sim.raceIds = Object.keys(RACES);
  return MOO;
}

module.exports = { install, newGame, autoTurn, stats, isOver, parseFaults, FAULTS, RACES, PERSONALITIES, OBJECTIVES, SIZES, AGE_RICH, DIFF_BONUS };

if (require.main === module) {                            // smoke test: node tools/mock-sim.js [seed] [race] [difficulty]
  const [seed, race, difficulty] = [process.argv[2] || '1', process.argv[3] || 'human', process.argv[4] || 'average'];
  const S = newGame({ seed, race, difficulty, size: 'medium', opponents: 3, playerAI: true });
  const t0 = performance.now();
  let over, turns = 0;
  while (turns < 300 && !(over = isOver(S)).over) {
    autoTurn(S); turns++;
    if (turns % 25 === 0) {
      console.log('turn ' + turns + ': ' + stats(S).map(r => r.race.slice(0, 4) + ':' + r.colonies + 'c/' + r.techs + 't/' + r.ships + 's' + (r.alive ? '' : 'X')).join('  '));
    }
  }
  console.log('end turn ' + turns + ' over=' + JSON.stringify(isOver(S)) + ' in ' + (performance.now() - t0).toFixed(0) + 'ms, state ' + JSON.stringify(S).length + ' bytes');
}
