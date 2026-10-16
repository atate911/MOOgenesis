// Game runner for tools/soak.js. Two roles, one code path:
//   * worker thread  - loads the sim ONCE (tools/headless.js), then claims jobs from a shared atomic counter and plays whole games;
//   * library        - soak.js requires this file to play a single verbose game in-process (--replay).
// A game = Sim.newGame -> Sim.autoTurn until Sim.isOver / turn cap, with per-turn timing, event counting, stats snapshots and
// the sanity checks (NaN scan, JSON round trip, save size, determinism, Math.random probe...). Pure data in, pure data out.
'use strict';

const { parentPort, workerData, isMainThread } = require('worker_threads');
const { performance } = require('perf_hooks');
const St = require('./lib/stats.js');

// Shared control block (Int32Array over a SharedArrayBuffer made by soak.js). Global words, then a [job, turn] pair per worker slot.
const C = { NEXT: 0, STOP: 1, GO: 2, READY: 3, SLOTS: 4 };

// Event classification by report.events[].type only. Edit these if the sim names its diplomacy events differently.
const RE_CONTACT = /contact/i;                                           // news:firstContact, diplomacy:firstContact (greeting audience), bare 'contact' events
const RE_WAR = /(?:^|:)war(?:Declared)?$/i;                              // news:warDeclared (every war, also AI-vs-AI) and bare 'war' events; the human's diplomacy:warDeclared audience repeats a news item, so it is not counted twice
const RE_TREATY = /treaty|alliance|pact|peace|accord|agreement|napSigned|tradeSigned|^diplomacy:(?:nap|alliance|trade|peace)/i;   // news:peaceTreaty / allianceFormed / napSigned / tradeSigned / treatyBroken, diplomacy:* proposals

const safeHash = S => { try { return St.hashState(S); } catch (e) { return null; } };
const errInfo = e => ({ name: (e && e.name) || 'Error', message: String((e && e.message) || e), stack: String((e && e.stack) || '') });
const num = v => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 100) / 100 : null) : null);

// personality/objective may be an index into Data.Races.PERSONALITIES / OBJECTIVES (real sim) or already a name (mock)
function traitName(MOO, list, v) {
  if (v === undefined || v === null) return null;
  const tbl = MOO.Data && MOO.Data.Races && MOO.Data.Races[list];
  return typeof v === 'number' && Array.isArray(tbl) && tbl[v] !== undefined ? String(tbl[v]) : String(v);
}

// A/B experiments: env MOO_OVERRIDES='{"AI.QUIRKS.fourthColonyShip":true,"Data.Config.QUIRKS.wasteSub1":true}' sets those dotted paths (under MOO) in every loaded sim.
function applyOverrides(MOO) {
  const raw = process.env.MOO_OVERRIDES; if (!raw) return;
  const o = JSON.parse(raw);
  for (const path of Object.keys(o)) {
    const parts = path.split('.'); let t = MOO;
    for (let i = 0; i < parts.length - 1; i++) t = t[parts[i]] = t[parts[i]] || {};
    t[parts[parts.length - 1]] = o[path];
  }
}
// ---- sim loading -------------------------------------------------------------------------------------------------
// Uses the real MOO.Sim when it has newGame(), otherwise (or with opts.forceMock) installs tools/mock-sim.js over it.
function loadSim(opts) {
  const MOO = require('./headless.js').load({ quiet: true });
  const hasReal = !!(MOO.Sim && typeof MOO.Sim.newGame === 'function');
  const mock = !!opts.forceMock || !hasReal;
  if (mock) require('./mock-sim.js').install(MOO);
  else {
    for (const f of ['autoTurn', 'stats', 'isOver']) {
      if (typeof MOO.Sim[f] !== 'function') throw new Error('MOO.Sim.' + f + ' is missing (newGame exists, so the mock is not used; pass --mock to force it)');
    }
  }
  applyOverrides(MOO);
  return { MOO, mock, why: opts.forceMock ? 'forced by --mock' : hasReal ? 'real MOO.Sim' : 'MOO.Sim.newGame missing' };
}

// Math.random() must never be used by the sim (all randomness comes from S.rs); count calls made while a game runs.
function makeProbe() {
  const p = { armed: false, rand: 0, randStack: '' }, orig = Math.random;
  Math.random = function random() {
    if (p.armed && !p.rand++) p.randStack = String(new Error().stack).split('\n').slice(2, 7).map(s => s.trim()).join(' <- ');
    return orig();
  };
  p.restore = () => { Math.random = orig; };
  return p;
}

function makeEnv(opts, shared) {
  const sim = loadSim(opts);
  const env = { MOO: sim.MOO, Sim: sim.MOO.Sim, mock: sim.mock, why: sim.why, opts, shared: shared || null, probe: makeProbe() };
  env.reload = () => { const s = loadSim(opts); env.MOO = s.MOO; env.Sim = s.MOO.Sim; };   // fresh vm context (after an exception)
  env.dispose = () => env.probe.restore();
  return env;
}

function settingsFor(env, job) {
  const o = env.opts;
  const s = {
    size: job.size, age: job.age, difficulty: job.difficulty, opponents: job.opponents, race: job.race, seed: job.seed, playerAI: true,
    options: Object.assign({ tactical: false, randomEvents: true, antarans: true, council: true }, o.options),
  };
  if (env.mock && o.mockCfg) s.mock = o.mockCfg;                 // fault injection / work factor, only ever seen by the mock
  return s;
}

// ---- determinism -------------------------------------------------------------------------------------------------
// hashes[t] = state hash after t turns of the main run. Replays the same seed and compares; on a mismatch replays once more to
// find WHICH fields differ (and whether the first run was the odd one out, i.e. state leaking between games).
function detCheck(env, job, hashes, isSnap) {
  const Sim = env.Sim, n = hashes.length - 1, out = { ok: true, turns: n };
  const start = () => { const G = Sim.newGame(settingsFor(env, job)); if (isSnap(0)) Sim.stats(G); return G; };
  const step = (G, t) => { Sim.autoTurn(G); if (isSnap(t)) Sim.stats(G); };      // same calls, same order as the main run
  try {
    const S = start();
    let bad = St.hashState(S) === hashes[0] ? -1 : 0;
    for (let t = 1; t <= n && bad < 0; t++) { step(S, t); if (St.hashState(S) !== hashes[t]) bad = t; Sim.isOver(S); }
    if (bad >= 0) {
      out.ok = false; out.turn = bad;
      const S3 = start();
      for (let t = 1; t <= bad; t++) { step(S3, t); if (t < bad) Sim.isOver(S3); }
      out.diff = St.plainDiff(JSON.parse(JSON.stringify(S3)), JSON.parse(JSON.stringify(S)), 3);
      out.firstRunOdd = out.diff.length === 0;           // runs 2 and 3 agree: run 1 differed (leaked/global state)
    }
  } catch (e) { out.ok = false; out.error = errInfo(e).message; }
  return out;
}

// one-line explanation of a failed determinism check
function nondetDetail(det) {
  if (det.error) return ': ' + det.error;
  if (det.firstRunOdd) return ' (replays 2 and 3 agree, replay 1 differs: state leaking between games?)';
  return ': ' + det.diff.map(x => x.path + ' ' + x.a + ' vs ' + x.b).join('; ');
}

// ---- one game ----------------------------------------------------------------------------------------------------
// hooks.onTurn({played, S, rep, ms, snap, over}) is called after every turn (used by --replay).
function playGame(env, job, hooks) {
  hooks = hooks || {};
  const o = env.opts, Sim = env.Sim, probe = env.probe, sh = env.shared, maxTurns = o.maxTurns;
  const snapAt = new Set([0, 30, 40]);                     // 0 = initial state; 30/40 feed the early-game sanity checks
  for (const t of o.statsAt) if (t >= 1 && t <= maxTurns) snapAt.add(t);
  const isSnap = t => snapAt.has(t) || (o.statsEvery > 0 && t % o.statsEvery === 0);
  const detTurns = Math.min(o.detTurns || 40, maxTurns);
  let hashes = o.determinism && (!(o.detGames > 0) || job.i < o.detGames) ? [] : null;      // hashes[t] = state hash after t turns

  const res = {
    i: job.i, seed: job.seed, race: job.race, difficulty: job.difficulty, size: job.size, age: job.age, opponents: job.opponents, cell: job.cell || null,
    status: 'ok', finished: false, reason: null, endTurn: 0, simTurn: null, winnerId: null, winner: null, leaderId: null,
    empires: [], snaps: [], firstContact: null, wars: 0, treaties: 0, events: {}, time: null, bytes: { series: [], final: null },
    warnings: [], warnCounts: {}, error: null, det: null, samples: null,
  };
  const seenCodes = new Set();
  const warn = (code, sev, turn, msg, extra) => {          // keeps counts of everything, details of the first 3 per code
    const n = (res.warnCounts[code] = (res.warnCounts[code] || 0) + 1);
    if (n <= 3) res.warnings.push(Object.assign({ code, sev, turn, msg }, extra));
  };
  const warnOnce = (code, sev, turn, msg, extra) => {      // first occurrence only (per empire when extra.empire is given)
    const key = extra && extra.empire !== undefined ? code + '#' + extra.empire : code;
    if (!seenCodes.has(key)) { seenCodes.add(key); warn(code, sev, turn, msg, extra); }
  };

  const wall = new Float32Array(maxTurns), phase = {}, initColonies = {}, elimTurn = [];
  let S = null, played = 0, where = 'newGame', worst = { ms: 0, turn: 0, timings: null };
  let prevSimTurn = 0, alive = [], lastSnap = null, aiErrSeen = 0;
  const reachAt30 = {};                                    // per empire: colonisable planets inside fuel range at the turn-30 snapshot (NO_EXPANSION needs one)
  const gameStart = performance.now();
  probe.armed = true;
  probe.rand = 0; probe.randStack = '';

  // ---- per-turn bookkeeping ----
  const recordTimings = (rep, dt) => {                     // phase samples (report.timings) + slowest turn
    const tm = rep && rep.timings && typeof rep.timings === 'object' ? rep.timings : null;
    if (tm) for (const k in tm) if (typeof tm[k] === 'number' && Number.isFinite(tm[k])) (phase[k] || (phase[k] = new Float32Array(maxTurns).fill(NaN)))[played - 1] = tm[k];
    if (dt > worst.ms) worst = { ms: dt, turn: played, timings: tm ? Object.assign({}, tm) : null };
  };

  const recordEvents = rep => {                            // counts, first contact, wars, treaties ({type,...} objects or bare type strings)
    const evs = rep && Array.isArray(rep.events) ? rep.events : [];
    for (let k = 0; k < evs.length; k++) {
      const type = typeof evs[k] === 'string' ? evs[k] : evs[k] && evs[k].type;
      if (type === undefined || type === null) continue;
      res.events[type] = (res.events[type] || 0) + 1;
      const txt = String(type);
      if (RE_CONTACT.test(txt)) { if (res.firstContact === null) res.firstContact = played; }
      else if (RE_WAR.test(txt)) res.wars++;
      else if (RE_TREATY.test(txt)) res.treaties++;
    }
  };

  const checkTurn = () => {                                // cheap checks: turn counter, eliminations, NaN in empire records
    where = 'check';
    if (typeof S.turn === 'number') {
      if (S.turn !== prevSimTurn + 1) warnOnce('TURN_COUNTER', 'error', played, 'S.turn went ' + prevSimTurn + ' -> ' + S.turn + ' after one autoTurn');
      prevSimTurn = S.turn;
    }
    const emps = S.empires || [];
    for (let k = 0; k < emps.length; k++) {
      const e = emps[k], a = e.alive !== false;
      if (alive[k] && !a) {
        elimTurn[k] = played;
        if (played < 30) warn('EARLY_ELIM', 'warn', played, 'empire ' + k + ' (' + e.race + ') eliminated at turn ' + played, { empire: k });
      }
      alive[k] = a;
      for (const f in e) if (typeof e[f] === 'number' && !Number.isFinite(e[f])) warnOnce('NAN', 'error', played, 'S.empires[' + k + '].' + f + ' is ' + e[f], { empire: k });
    }
    // AI planner steps that threw (the `aiLog` order keeps S.aiLog = {n, last[]}): every new entry is an AI_ERRORS hit (details of the first 3, counts of all)
    const log = S.aiLog;
    if (log && typeof log.n === 'number' && Array.isArray(log.last) && log.n > aiErrSeen) {
      for (const x of log.last.slice(Math.max(0, log.last.length - (log.n - aiErrSeen)))) {
        warn('AI_ERRORS', 'warn', played, 'AI planner step "' + x.step + '" of empire ' + x.empire + ' threw: ' + String(x.msg).split('\n')[0], { empire: x.empire });
      }
      aiErrSeen = log.n;
    }
  };

  // ---- stats snapshots and state scans ----
  const takeSnapshot = turn => {
    where = 'stats';
    const h0 = hashes && turn <= detTurns ? safeHash(S) : null;
    const rows = Sim.stats(S);
    if (h0 !== null && safeHash(S) !== h0) warnOnce('IMPURE_QUERY', 'error', turn, 'Sim.stats(S) modified the game state (queries must be pure)');
    if (!Array.isArray(rows)) { warnOnce('API', 'error', turn, 'MOO.Sim.stats(S) did not return an array'); return null; }
    const snap = { turn, e: rows.map((r, k) => {
      for (const f of ['colonies', 'pop', 'production', 'research', 'techs', 'ships', 'bc', 'score']) {
        if (typeof r[f] === 'number' && !Number.isFinite(r[f])) warnOnce('NAN', 'error', turn, 'Sim.stats() row ' + k + ' field ' + f + ' is ' + r[f], { empire: k });
      }
      return { id: r.id === undefined ? k : r.id, alive: r.alive !== false, colonies: num(r.colonies), pop: num(r.pop), production: num(r.production), research: num(r.research),
        techs: num(r.techs), ships: num(r.ships), bc: num(r.bc), score: num(r.score) };
    }) };
    if (turn === 0) for (const r of snap.e) initColonies[r.id] = r.colonies;
    sanitySnap(snap);
    res.snaps.push(snap);
    lastSnap = snap;
    where = 'size';
    try { res.bytes.series.push([turn, JSON.stringify(S).length]); } catch (e) { warnOnce('ROUNDTRIP', 'error', turn, 'JSON.stringify(S) threw: ' + e.message); }
    return snap;
  };

  // unowned planets the empire could colonise right now (type at/above its colonisable threshold, inside normal fuel range); null when the state has no such fields (mock sim)
  const reachableColonies = eid => {
    const E = S.empires && S.empires[eid], planets = Array.isArray(S.planets) ? S.planets : null;
    if (!E || !planets || !E.frange || !E.mods) return null;
    const thr = E.race === 'silicoid' ? 1 : (E.mods.colonyFor || 7), out = [];
    for (const p of planets) if (p && p.owner < 0 && p.typeIdx >= thr && E.frange[p.starId] === 1 && p.id !== S.orion) out.push(p.id);
    return out;
  };
  const sanitySnap = snap => {                             // balance / AI-health checks on a stats snapshot
    const t = snap.turn;
    for (const r of snap.e) {
      if (!r.alive) continue;
      const tag = { empire: r.id };
      if (t === 30) reachAt30[r.id] = reachableColonies(r.id);
      if (t === 40 && r.colonies !== null && initColonies[r.id] !== undefined && r.colonies <= initColonies[r.id]) {
        const reach = reachAt30[r.id] === undefined ? reachableColonies(r.id) : reachAt30[r.id];   // a start with no colonisable planet inside fuel range by turn 30 is a map condition, not an AI failure
        if (reach === null || reach.length) warnOnce('NO_EXPANSION', 'warn', t, 'empire ' + r.id + ' still has ' + r.colonies + ' colonies at turn 40' + (reach ? ' (colonisable and in range since turn 30: planets ' + reach.slice(0, 5).join(', ') + ')' : ''), tag);
        else warnOnce('ISOLATED_START', 'info', t, 'empire ' + r.id + ' still has ' + r.colonies + ' colonies at turn 40: no colonisable free planet inside its fuel range by turn 30', tag);
      }
      if (t >= 20 && r.colonies > 0 && r.production !== null && r.production <= 0) warnOnce('STUCK_PRODUCTION', 'warn', t, 'empire ' + r.id + ' production is ' + r.production, tag);
      if (t >= 20 && r.colonies > 0 && r.research !== null && r.research <= 0) warnOnce('STUCK_RESEARCH', 'warn', t, 'empire ' + r.id + ' research is ' + r.research, tag);
      const old = res.snaps.filter(s => s.turn <= t - 50).pop();           // latest snapshot at least 50 turns back
      const prev = old && old.e.find(x => x.id === r.id);
      if (prev && prev.alive && prev.techs !== null && r.techs === prev.techs && r.research > 0)
        warnOnce('STUCK_TECH', 'warn', t, 'empire ' + r.id + ' learned no tech between turn ' + old.turn + ' and ' + t + ' (research ' + r.research + ')', tag);
    }
  };

  // deep structural scan of the state (NaN, negatives, non-JSON values, cycles, aliasing) + planet/empire reference checks
  const deepCheck = turn => {
    where = 'scan';
    const sc = St.scanState(S, { maxPer: 3 });
    const ex = list => list.map(x => x.path + (x.value !== undefined ? '=' + x.value : '') + (x.kind ? ' (' + x.kind + ')' : '')).join(', ');
    if (sc.counts.nan) warnOnce('NAN', 'error', turn, sc.counts.nan + ' NaN/Infinity value(s): ' + ex(sc.nan));
    if (sc.counts.neg) warnOnce('NEG_POP', 'error', turn, sc.counts.neg + ' negative count/population value(s): ' + ex(sc.neg));
    if (sc.counts.huge) warnOnce('HUGE_VALUE', 'warn', turn, sc.counts.huge + ' value(s) >= 1e14 (runaway growth?): ' + ex(sc.huge));
    if (sc.counts.nonPlain) warnOnce('NOT_PLAIN', 'error', turn, sc.counts.nonPlain + ' non-JSON value(s) in state: ' + ex(sc.nonPlain));
    if (sc.counts.cycle) warnOnce('CYCLE', 'error', turn, sc.counts.cycle + ' circular reference(s): ' + ex(sc.cycle));
    if (sc.counts.shared) warnOnce('SHARED_REF', 'warn', turn, sc.counts.shared + ' object(s) referenced from several places (aliasing is lost on save/load): ' + ex(sc.shared));
    const emps = Array.isArray(S.empires) ? S.empires : [];
    const planets = Array.isArray(S.planets) ? S.planets : S.planets && typeof S.planets === 'object' ? Object.values(S.planets) : [];
    const ids = new Map(emps.map((e, k) => [e && e.id !== undefined ? e.id : k, e]));
    for (const p of planets) {
      if (!p || p.owner === undefined || p.owner === -1 || p.owner === null) continue;
      const owner = ids.get(p.owner);
      if (!owner) { warnOnce('BAD_OWNER', 'error', turn, 'planet ' + p.id + ' owner ' + p.owner + ' is not an empire id'); break; }
      if (owner.alive === false) { warnOnce('DEAD_OWNER', 'warn', turn, 'planet ' + p.id + ' still belongs to eliminated empire ' + p.owner); break; }
    }
  };

  // ---- end of game ----
  const checkSave = () => {                                // JSON round trip of the final state, save size and save-size growth
    where = 'roundtrip';
    let json = null;
    try { json = JSON.stringify(S); } catch (e) { warnOnce('ROUNDTRIP', 'error', played, 'JSON.stringify(S) threw: ' + e.message); }
    if (json !== null) {
      res.bytes.final = json.length;
      const d = St.plainDiff(S, JSON.parse(json), 4);
      if (d.length) warnOnce('ROUNDTRIP', 'error', played, 'JSON.parse(JSON.stringify(S)) differs: ' + d.map(x => x.path + ' ' + x.a + ' -> ' + x.b).join('; '));
    }
    const biggest = () => Object.keys(S).map(k => { try { return [k, JSON.stringify(S[k]).length]; } catch (e) { return [k, 0]; } })
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(p => p[0] + ' ' + St.kb(p[1])).join(', ');
    if (res.bytes.final !== null && res.bytes.final > o.maxSaveKb * 1024) {
      warn('SAVE_SIZE', 'warn', played, 'save is ' + St.kb(res.bytes.final) + ' (limit ' + o.maxSaveKb + 'KB); largest: ' + biggest());
    }
    const ser = res.bytes.series, last = ser[ser.length - 1];
    const mid = last && ser.find(p => p[0] >= last[0] / 2 && p[0] < last[0] - 19);        // snapshot at/after half-time, >= 20 turns before the end
    const perTurn = mid ? (last[1] - mid[1]) / (last[0] - mid[0]) : 0;
    if (mid && perTurn > o.maxGrowthKb * 1024) {
      warn('SAVE_GROWTH', 'warn', played, 'save grows ' + St.fix(perTurn / 1024) + ' KB/turn between turns ' + mid[0] + ' and ' + last[0] + '; largest: ' + biggest());
    }
  };

  const summarizeOutcome = () => {                         // per-empire summary, leader at end, winner
    res.empires = (S.empires || []).map((e, k) => {
      const id = e.id === undefined ? k : e.id, r = lastSnap && lastSnap.e.find(x => x.id === id) || {};
      const g = f => (r[f] === undefined ? null : r[f]);
      return { id, race: String(e.race), personality: traitName(env.MOO, 'PERSONALITIES', e.personality), objective: traitName(env.MOO, 'OBJECTIVES', e.objective),
        alive: alive[k] !== false, elimTurn: elimTurn[k] === undefined ? null : elimTurn[k], score: g('score'), colonies: g('colonies'), pop: g('pop'),
        production: g('production'), techs: g('techs'), ships: g('ships') };
    });
    // "leader at end" = highest Sim.stats() score; if the sim reports no score at all, a rough proxy (so lead% still means something)
    const hasScore = res.empires.some(e => e.score !== null), z = v => (v === null ? 0 : v);
    const lv = e => (hasScore ? z(e.score) : z(e.colonies) * 10 + z(e.pop) + z(e.production) * 0.5 + z(e.techs) * 8 + z(e.ships) * 2);
    res.leaderBy = hasScore ? 'score' : 'proxy';
    let lead = null;
    for (const r of res.empires) if (r.alive && (lead === null || lv(r) > lv(lead))) lead = r;
    res.leaderId = lead ? lead.id : null;
    if (res.winnerId !== null) res.winner = res.empires.find(e => e.id === res.winnerId) || null;
  };

  const endGame = () => {
    res.endTurn = played; res.simTurn = S.turn;
    if (res.status === 'ok' && !res.finished) res.reason = 'cap';
    if (res.status === 'aborted') return;
    if (!lastSnap || lastSnap.turn !== played) takeSnapshot(played);
    deepCheck(played);
    checkSave();
    if (worst.ms > o.slowMs) {
      const detail = worst.timings ? ' (' + Object.keys(worst.timings).map(k => k + ' ' + St.ms(worst.timings[k])).join(', ') + ')' : '';
      warn('SLOW_TURN', 'warn', worst.turn, 'turn ' + worst.turn + ' took ' + St.ms(worst.ms) + ' ms' + detail);
    }
    if (probe.rand > 0) warn('MATH_RANDOM', 'error', played, 'sim called Math.random() ' + probe.rand + 'x (all randomness must come from S.rs); first call: ' + probe.randStack);
    summarizeOutcome();
    if (hashes && hashes.includes(null)) hashes = null;      // a state that cannot be serialised cannot be hashed (reported elsewhere)
    if (hashes && res.status === 'ok') {
      where = 'determinism';
      res.det = detCheck(env, job, hashes, isSnap);
      if (!res.det.ok) warn('NONDET', 'error', res.det.turn, 'same seed gave a different state at turn ' + res.det.turn + nondetDetail(res.det));
    }
  };

  try {
    where = 'newGame';
    S = Sim.newGame(settingsFor(env, job));
    res.startTurn = S.turn; prevSimTurn = S.turn;
    alive = (S.empires || []).map(e => e.alive !== false);
    takeSnapshot(0);
    if (hashes) hashes.push(safeHash(S));

    while (played < maxTurns) {
      if (sh && Atomics.load(sh.ctrl, C.STOP)) { res.status = 'aborted'; break; }
      if (performance.now() - gameStart > o.timeoutMs) {
        res.status = 'timeout'; res.reason = 'timeout';
        res.error = {
          kind: 'timeout', name: 'Timeout', stack: '', turn: played + 1, phase: 'autoTurn',
          message: 'game exceeded ' + o.timeoutMs + ' ms (soft limit) after ' + played + ' turns',
        };
        break;
      }
      where = 'autoTurn';
      const t0 = performance.now();
      const rep = Sim.autoTurn(S);
      const dt = performance.now() - t0;
      played++;
      if (sh) sh.ctrl[sh.base + 1] = played;                 // lets the parent report the turn a crashed/hung worker was on
      wall[played - 1] = dt;
      recordTimings(rep, dt);
      recordEvents(rep);
      checkTurn();

      const snap = isSnap(played) ? takeSnapshot(played) : null;
      if (o.scanEvery > 0 && played % o.scanEvery === 0) deepCheck(played);
      if (hashes && played <= detTurns) hashes.push(safeHash(S));

      where = 'isOver';
      const over = Sim.isOver(S);
      if (hashes && played <= detTurns && hashes[played] !== null && safeHash(S) !== hashes[played]) {
        warnOnce('IMPURE_QUERY', 'error', played, 'Sim.isOver(S) modified the game state (queries must be pure)');
      }
      if (hooks.onTurn) hooks.onTurn({ played, S, rep, ms: dt, snap, over });
      if (over && over.over) {
        res.finished = true; res.reason = over.reason === undefined || over.reason === null ? 'over' : String(over.reason);
        res.winnerId = over.winner === undefined || over.winner === -1 ? null : over.winner;
        break;
      }
    }
    endGame();
  } catch (e) {
    res.status = 'error';
    res.endTurn = played;
    res.error = Object.assign(errInfo(e), { kind: 'exception', turn: played + (where === 'autoTurn' ? 1 : 0), phase: where });
  }
  probe.armed = false;

  // timing summary + raw per-turn samples (typed arrays; stripped from the JSON by soak.js)
  const n = played, samples = { wall: wall.slice(0, n), phases: {} }, ph = {};
  for (const k in phase) { samples.phases[k] = phase[k].slice(0, n); ph[k] = St.summarize(samples.phases[k]); }
  res.time = { wallMs: performance.now() - gameStart, turns: n, turn: St.summarize(samples.wall), phases: ph, worst: { turn: worst.turn, ms: worst.ms, timings: worst.timings } };
  res.samples = samples;
  return res;
}

// ---- worker thread entry -----------------------------------------------------------------------------------------
function workerMain() {
  const { slot, jobs, opts, ctrlBuf, startBuf } = workerData;
  const ctrl = new Int32Array(ctrlBuf), starts = new Float64Array(startBuf), base = C.SLOTS + 2 * slot;
  let env;
  try { env = makeEnv(opts, { ctrl, base, slot }); }
  catch (e) { parentPort.postMessage({ type: 'fatal', slot, error: errInfo(e) }); return; }
  parentPort.postMessage({ type: 'ready', slot, mock: env.mock, why: env.why });
  Atomics.add(ctrl, C.READY, 1);
  while (Atomics.load(ctrl, C.GO) === 0) Atomics.wait(ctrl, C.GO, 0, 1000);      // start barrier (open at once for respawned workers)
  for (;;) {
    if (Atomics.load(ctrl, C.STOP)) break;
    const idx = Atomics.add(ctrl, C.NEXT, 1);                                       // claim the next job from the shared queue
    if (idx >= jobs.length) break;
    ctrl[base] = idx; ctrl[base + 1] = 0; starts[slot] = Date.now();
    if (opts.fresh) { try { env.reload(); } catch (e) { parentPort.postMessage({ type: 'fatal', slot, error: errInfo(e) }); return; } }   // --fresh: new vm per game
    const result = playGame(env, jobs[idx]);
    try { parentPort.postMessage({ type: 'result', idx, result }); }
    catch (e) {                                                                     // not structured-clonable (e.g. a function inside isOver()'s result)
      result.samples = null; result.winner = null; result.winnerId = null; result.status = 'error';
      result.error = Object.assign(errInfo(e), { kind: 'exception', turn: result.endTurn, phase: 'report' });
      parentPort.postMessage({ type: 'result', idx, result });
    }
    ctrl[base] = -1;                                                                // cleared only after the result is out, so a crash here is attributed to this job
    if (result.status === 'error') {                                                // never trust a vm context that has thrown
      try { env.reload(); } catch (e) { parentPort.postMessage({ type: 'fatal', slot, error: errInfo(e) }); return; }
    }
  }
  parentPort.postMessage({ type: 'done', slot });
}

if (!isMainThread && workerData && workerData.soakWorker) workerMain();

module.exports = { C, loadSim, makeEnv, playGame, settingsFor, errInfo };
