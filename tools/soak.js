#!/usr/bin/env node
// MOO soak / balance runner: plays full AI-vs-AI games headlessly on every CPU thread, then reports balance statistics and
// correctness warnings. Usage:  node tools/soak.js [options]      (--help for the list, tools/SOAK.md for the guide)
// Layout: CLI/config -> job list -> worker pool (shared atomic job counter, watchdog, crash recording + respawn) ->
//         aggregation -> text report + JSON file.  The games themselves are played by tools/soak-worker.js.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { parseArgs } = require('util');
const { performance } = require('perf_hooks');
const St = require('./lib/stats.js');
const W = require('./soak-worker.js');
const Mock = require('./mock-sim.js');

const WORKER_FILE = path.join(__dirname, 'soak-worker.js');
const OUT_DIR = path.join(__dirname, 'out');
const SIZES = ['small', 'medium', 'large', 'huge', 'colossal'];
const AGES = ['young', 'average', 'old'];
const DIFFS = ['simple', 'easy', 'average', 'hard', 'impossible'];
const DEFAULT_RACES = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
const METRICS = ['colonies', 'pop', 'production', 'research', 'techs', 'ships', 'bc', 'score'];
const HW_THREADS = (os.availableParallelism && os.availableParallelism()) || os.cpus().length;

const HELP = `node tools/soak.js [options]      AI-vs-AI soak/balance runner on all CPU threads (details: tools/SOAK.md)
  --games N             games to play, per cell with --matrix, per thread with --bench     [24]
  --size S              small|medium|large|huge|colossal   (list or 'all')                 [medium]
  --age A               young|average|old                  (list or 'all')                 [average]
  --difficulty D        simple|easy|average|hard|impossible (list or 'all')                [average; all with --matrix]
  --opponents N         1-5 AI opponents (list ok)                                         [3]
  --races a,b|all       race of empire 0, rotated through the list                         [all]
  --turns N             turn cap per game                                                  [250]
  --seed S              base seed, game i uses S+i                                         [1]
  --threads N           worker threads                                                     [${HW_THREADS}]
  --matrix              race x difficulty grid (--games per cell)
  --stats-at a,b,c      snapshot turns for the curves                                      [25,50,100,150,200]
  --json FILE           results file (bare name -> tools/out/)           [tools/out/soak-<time>.json]   --no-json to skip
  --quiet               no live progress                  --no-color  --strict (warnings also fail the exit code)
  --timeout-ms N        per-game limit (soft check between turns, thread kill after 1.25x+2s)  [180000]
  --determinism         replay each game's first 40 turns twice and compare state hashes (--det-turns N, --det-games N)
  --replay SEED RACE DIFFICULTY   play one game verbosely, one line per turn (--events, --dump-at 50,100)
  --profile             per-phase turn-time percentiles           --bench   games/s vs thread count
  --scan-every N        deep state scan period, 0 = final only [10]   --slow-ms N [1500]  --max-save-kb N [5120]  --max-growth-kb N [16]
  --max-mem-mb N        per-worker heap limit  --young-mb N  per-worker young generation (try 8-16 for allocation-heavy sims)
  --opt key=val[,..]    extra settings.options (e.g. council=false)   --fresh  reload the sim for every game (rules out state leaking between games)
  --mock                force tools/mock-sim.js (auto when MOO.Sim.newGame is missing)
  --mock-fail k@turn[:p[:arg]],..  inject faults into the mock (${Object.keys(Mock.FAULTS).join(', ')})
  --mock-work X         mock CPU cost multiplier [1]               --max-examples N  examples per warning kind [3]`;

class UsageError extends Error {}

// ============================================================================================================ CLI/config
const OPTS = {
  games: { type: 'string' }, size: { type: 'string' }, age: { type: 'string' }, difficulty: { type: 'string' }, opponents: { type: 'string' },
  races: { type: 'string' }, turns: { type: 'string' }, seed: { type: 'string' }, threads: { type: 'string' }, matrix: { type: 'boolean' },
  json: { type: 'string' }, 'no-json': { type: 'boolean' }, quiet: { type: 'boolean' }, 'timeout-ms': { type: 'string' }, 'stats-at': { type: 'string' },
  determinism: { type: 'boolean' }, 'det-turns': { type: 'string' }, 'det-games': { type: 'string' }, profile: { type: 'boolean' }, bench: { type: 'boolean' },
  mock: { type: 'boolean' }, 'mock-fail': { type: 'string' }, 'mock-work': { type: 'string' }, 'scan-every': { type: 'string' },
  'max-mem-mb': { type: 'string' }, 'young-mb': { type: 'string' }, fresh: { type: 'boolean' },
  opt: { type: 'string', multiple: true }, 'slow-ms': { type: 'string' }, 'max-save-kb': { type: 'string' }, 'max-growth-kb': { type: 'string' },
  events: { type: 'boolean' }, 'dump-at': { type: 'string' }, 'no-color': { type: 'boolean' }, strict: { type: 'boolean' }, 'max-examples': { type: 'string' },
  help: { type: 'boolean', short: 'h' },
};

function parseCli(argv) {
  argv = argv.slice();
  let replay = null;
  for (let i = 0; i < argv.length; i++) {                  // --replay takes three bare values, so lift it out before parseArgs
    if (argv[i] === '--replay') { replay = argv.slice(i + 1, i + 4); argv.splice(i, 4); break; }
    if (argv[i].startsWith('--replay=')) { replay = argv[i].slice(9).split(','); argv.splice(i, 1); break; }
  }
  if (replay && (replay.length !== 3 || replay.some(x => !x || x.startsWith('--')))) throw new UsageError('--replay needs three values: --replay SEED RACE DIFFICULTY');
  try { return { v: parseArgs({ args: argv, options: OPTS, strict: true, allowPositionals: false }).values, replay }; }
  catch (e) { throw new UsageError(e.message); }
}

const parseVal = s => (s === 'true' ? true : s === 'false' ? false : s !== '' && !isNaN(+s) ? +s : s);

function buildConfig(v, replay) {
  const int = (name, def, min) => {
    if (v[name] === undefined) return def;
    const n = Number(v[name]);
    if (!Number.isFinite(n) || n < min) throw new UsageError('--' + name + ' must be a number >= ' + min);
    return Math.floor(n);
  };
  const list = (name, def, all, valid) => {
    if (v[name] === undefined) return def;
    const a = v[name] === 'all' ? all.slice() : String(v[name]).split(',').map(s => s.trim()).filter(Boolean);
    if (!a.length) throw new UsageError('--' + name + ' is empty');
    if (valid) for (const x of a) if (!valid.includes(x)) throw new UsageError("--" + name + ": unknown '" + x + "' (valid: " + valid.join(', ') + ')');
    return a;
  };
  const cfg = { replay, matrix: !!v.matrix, bench: !!v.bench };
  cfg.mock = !!(v.mock || v['mock-fail'] || v['mock-work']);
  let faults;
  try { faults = Mock.parseFaults(v['mock-fail']); } catch (e) { throw new UsageError(e.message); }
  cfg.mockCfg = { work: v['mock-work'] === undefined ? 1 : Number(v['mock-work']), faults };
  cfg.mockSpec = v['mock-fail'] || '';
  if (!(cfg.mockCfg.work >= 0)) throw new UsageError('--mock-work must be >= 0');

  const sim = W.loadSim({ forceMock: cfg.mock });         // loaded once here only to learn the race list and which sim is used
  cfg.simMock = sim.mock; cfg.simWhy = sim.why;
  const rr = raceIds(sim.MOO);
  cfg.raceSrc = rr.src;

  cfg.games = int('games', cfg.bench ? 3 : 24, 1);
  cfg.turns = int('turns', 250, 1);
  cfg.threads = Math.max(1, int('threads', HW_THREADS, 1));
  cfg.seed = v.seed === undefined ? '1' : String(v.seed);
  cfg.sizes = list('size', ['medium'], SIZES, SIZES);
  cfg.ages = list('age', ['average'], AGES, AGES);
  cfg.difficulties = list('difficulty', cfg.matrix ? DIFFS.slice() : ['average'], DIFFS, DIFFS);
  cfg.opponents = list('opponents', ['3'], ['1', '2', '3', '4', '5'], ['1', '2', '3', '4', '5']).map(Number);
  cfg.races = list('races', rr.ids.slice(), rr.ids, rr.src === 'built-in default list' && !cfg.simMock ? null : rr.ids);
  cfg.statsAt = list('stats-at', ['25', '50', '100', '150', '200'], []).map(Number).filter(n => Number.isFinite(n) && n >= 1);
  cfg.statsAt = Array.from(new Set(cfg.statsAt)).sort((a, b) => a - b);
  cfg.timeoutMs = int('timeout-ms', 180000, 100);
  cfg.determinism = !!v.determinism;
  cfg.detTurns = int('det-turns', 40, 1);
  cfg.detGames = int('det-games', 0, 0);
  cfg.scanEvery = int('scan-every', 10, 0);
  cfg.slowMs = int('slow-ms', 1500, 1);
  cfg.maxSaveKb = int('max-save-kb', 5120, 1);
  cfg.maxGrowthKb = int('max-growth-kb', 16, 1);
  cfg.maxMemMb = v['max-mem-mb'] === undefined ? 0 : int('max-mem-mb', 0, 16);
  cfg.youngMb = v['young-mb'] === undefined ? 0 : int('young-mb', 0, 1);
  cfg.maxExamples = int('max-examples', 3, 1);
  cfg.fresh = !!v.fresh;
  cfg.quiet = !!v.quiet; cfg.profile = !!v.profile; cfg.events = !!v.events; cfg.strict = !!v.strict;
  cfg.noJson = !!v['no-json']; cfg.jsonFile = v.json; cfg.noColor = !!v['no-color'];
  cfg.dumpAt = v['dump-at'] ? v['dump-at'].split(',').map(Number).filter(Number.isFinite) : [];
  cfg.simOptions = {};
  for (const o of v.opt || []) {
    for (const kv of o.split(',')) {
      const m = /^([\w.]+)=(.*)$/.exec(kv.trim());
      if (!m) throw new UsageError("--opt expects key=value, got '" + kv + "'");
      cfg.simOptions[m[1]] = parseVal(m[2]);
    }
  }
  if (replay) {                                            // --replay SEED RACE DIFFICULTY overrides the game list
    cfg.seed = replay[0]; cfg.races = [replay[1]]; cfg.difficulties = [replay[2]];
    if (!DIFFS.includes(replay[2])) throw new UsageError("--replay: unknown difficulty '" + replay[2] + "'");
    cfg.games = 1;
  }
  cfg.runOpts = {
    forceMock: cfg.mock, mockCfg: cfg.mockCfg, maxTurns: cfg.turns, statsAt: cfg.statsAt, timeoutMs: cfg.timeoutMs, scanEvery: cfg.scanEvery,
    determinism: cfg.determinism, detTurns: cfg.detTurns, detGames: cfg.detGames, slowMs: cfg.slowMs, maxSaveKb: cfg.maxSaveKb, maxGrowthKb: cfg.maxGrowthKb,
    options: cfg.simOptions, statsEvery: 0, fresh: cfg.fresh,
  };
  return cfg;
}

// race ids for 'all': MOO.Data races if present, else MOO.Sim.raceIds (mock), else the ten classic races
function raceIds(MOO) {
  const D = MOO.Data || {};
  for (const k of ['races', 'RACES', 'Races']) {
    const val = D[k];
    if (!val) continue;
    const ids = Array.isArray(val) ? val.map(x => (typeof x === 'string' ? x : x && (x.id || x.key || x.name))).filter(Boolean).map(String)
      : Array.isArray(val.ORDER) ? val.ORDER.map(String) : val.races && typeof val.races === 'object' ? Object.keys(val.races) : typeof val === 'object' ? Object.keys(val) : [];
    if (ids.length) return { ids, src: 'MOO.Data.' + k };
  }
  if (MOO.Sim && Array.isArray(MOO.Sim.raceIds) && MOO.Sim.raceIds.length) return { ids: MOO.Sim.raceIds.slice(), src: 'MOO.Sim.raceIds' };
  return { ids: DEFAULT_RACES.slice(), src: 'built-in default list' };
}

const seedFor = (base, i) => (/^-?\d+$/.test(base) ? Number(base) + i : base + '-' + i);

// Job list. Plain mode: game i takes race = races[i % R], then difficulty, size, age, opponents as a mixed-radix counter, so every
// combination appears before any repeats. Matrix mode: one game per (seed j, race, difficulty); j-major so a Ctrl+C leaves balanced cells.
// Matrix seeds are shared by all cells (same galaxies for every race/difficulty = less noise when comparing cells).
function makeJobs(cfg) {
  const jobs = [];
  const exact = cfg.replay ? (/^-?\d+$/.test(cfg.replay[0]) ? Number(cfg.replay[0]) : cfg.replay[0]) : null;   // --replay: the seed as given
  const add = (si, race, difficulty, size, age, opponents, cell) =>
    jobs.push({ i: jobs.length, seed: exact !== null ? exact : seedFor(cfg.seed, si), race, difficulty, size, age, opponents, cell });
  const R = cfg.races.length, D = cfg.difficulties.length, Z = cfg.sizes.length, A = cfg.ages.length, P = cfg.opponents.length;
  if (cfg.matrix) {
    for (let j = 0; j < cfg.games; j++) {
      const size = cfg.sizes[j % Z], age = cfg.ages[Math.floor(j / Z) % A], opp = cfg.opponents[Math.floor(j / (Z * A)) % P];
      for (const race of cfg.races) for (const diff of cfg.difficulties) add(j, race, diff, size, age, opp, race + '|' + diff);
    }
  } else {
    for (let i = 0; i < cfg.games; i++) {
      add(i, cfg.races[i % R], cfg.difficulties[Math.floor(i / R) % D], cfg.sizes[Math.floor(i / (R * D)) % Z],
        cfg.ages[Math.floor(i / (R * D * Z)) % A], cfg.opponents[Math.floor(i / (R * D * Z * A)) % P]);
    }
  }
  return jobs;
}

// ================================================================================================================= pool
// Workers load the sim once, then claim jobs from a shared atomic counter (no per-job round trip, so scaling stays linear).
// The parent only receives results, runs the watchdog, records crashes (worker 'error'/'exit') and respawns the slot.
function blankFailure(job, kind, err, turn) {
  return {
    i: job.i, seed: job.seed, race: job.race, difficulty: job.difficulty, size: job.size, age: job.age, opponents: job.opponents, cell: job.cell || null,
    status: kind === 'timeout' ? 'timeout' : 'error', finished: false, reason: kind, endTurn: Math.max(0, turn - 1), simTurn: null, winnerId: null, winner: null, leaderId: null,
    empires: [], snaps: [], firstContact: null, wars: 0, treaties: 0, events: {}, time: null, bytes: { series: [], final: null }, warnings: [], warnCounts: {}, det: null, samples: null,
    error: { kind, name: err.name || 'Error', message: err.message, stack: err.stack || '', turn, phase: err.phase || 'autoTurn' },
  };
}

function runPool(cfg, jobs, hooks) {
  hooks = hooks || {};
  const C = W.C, total = jobs.length, nSlots = Math.max(1, Math.min(cfg.threads, total));
  const ctrl = new Int32Array(new SharedArrayBuffer(4 * (C.SLOTS + 2 * nSlots)));
  const starts = new Float64Array(new SharedArrayBuffer(8 * nSlots));
  for (let s = 0; s < nSlots; s++) ctrl[C.SLOTS + 2 * s] = -1;
  const results = new Array(total).fill(null), slots = new Array(nSlots).fill(null);
  const pool = { results, nSlots, respawns: 0, wallMs: 0, interrupted: false };
  const hardMs = cfg.timeoutMs * 1.25 + 2000;
  let done = 0, ready = 0, startFails = 0, released = false, tRelease = performance.now(), finishing = false, live = 0;
  const timers = [];

  pool.promise = new Promise((resolve, reject) => {
    const base = slot => C.SLOTS + 2 * slot;
    const release = () => { if (released) return; released = true; tRelease = performance.now(); Atomics.store(ctrl, C.GO, 1); Atomics.notify(ctrl, C.GO); };
    const record = (idx, res) => {
      if (results[idx]) return;
      results[idx] = res; done++;
      if (hooks.onResult) hooks.onResult(res);
    };
    const killAll = () => { for (const s of slots) if (s) s.w.terminate(); };
    const fail = err => { if (finishing) return; finishing = true; timers.forEach(t => { clearInterval(t); clearTimeout(t); }); killAll(); reject(err); };
    const finish = () => {
      if (finishing) return;
      finishing = true;
      timers.forEach(t => { clearInterval(t); clearTimeout(t); });
      pool.wallMs = performance.now() - tRelease;
      for (let i = 0; i < total; i++) if (!results[i] && !pool.interrupted) results[i] = blankFailure(jobs[i], 'lost', { message: 'job never produced a result (worker vanished)' }, 1);
      Promise.all(slots.filter(Boolean).map(s => s.w.terminate())).then(() => resolve(pool), () => resolve(pool));
    };
    const check = () => {
      if (finishing) return;
      if (done >= total) finish();
      else if (live === 0 && (pool.interrupted || Atomics.load(ctrl, C.NEXT) >= total)) finish();
    };

    function spawn(slot) {
      const wo = { workerData: { soakWorker: true, slot, jobs, opts: cfg.runOpts, ctrlBuf: ctrl.buffer, startBuf: starts.buffer } };
      const limits = {};
      if (cfg.maxMemMb) limits.maxOldGenerationSizeMb = cfg.maxMemMb;
      if (cfg.youngMb) limits.maxYoungGenerationSizeMb = cfg.youngMb;
      if (cfg.maxMemMb || cfg.youngMb) wo.resourceLimits = limits;
      const st = { w: new Worker(WORKER_FILE, wo), slot, ready: false, finished: false, killReason: null, lastError: null };
      slots[slot] = st; live++;
      st.w.on('message', m => {
        if (m.type === 'result') record(m.idx, m.result);
        else if (m.type === 'ready') { st.ready = true; if (++ready >= nSlots) release(); }
        else if (m.type === 'done') st.finished = true;
        else if (m.type === 'fatal') fail(new Error('worker ' + slot + ' cannot run games: ' + m.error.message + (m.error.stack ? '\n' + m.error.stack : '')));
        check();
      });
      st.w.on('error', e => { st.lastError = e; });
      st.w.on('exit', code => {
        live--;
        if (slots[slot] === st) slots[slot] = null;
        if (finishing) return;
        if (!st.finished) {                                // unexpected death: record the job it was playing, respawn the slot
          const b = base(slot), idx = ctrl[b], turn = ctrl[b + 1] + 1;
          if (!st.ready) {
            if (++startFails >= 3) return fail(new Error('workers keep dying at startup: ' + (st.lastError ? st.lastError.message : 'exit code ' + code)));
          } else if (idx >= 0) {
            const kind = st.killReason || (st.lastError ? 'crash' : 'exit');
            const err = st.lastError ? { name: st.lastError.name || 'Error', message: st.lastError.message, stack: st.lastError.stack }
              : kind === 'timeout' ? {
                name: 'Timeout', stack: '',
                message: 'no result after ' + Math.round((Date.now() - starts[slot]) / 1000) + 's (hard limit ' + Math.round(hardMs / 1000) + 's); worker thread killed',
              }
                : { name: 'WorkerExit', message: 'worker thread exited unexpectedly (exit code ' + code + ')', stack: '' };
            record(idx, blankFailure(jobs[idx], kind, err, turn));
            ctrl[b] = -1;
          }
          if (!pool.interrupted && Atomics.load(ctrl, C.NEXT) < total) { pool.respawns++; spawn(slot); return; }
        }
        check();
      });
    }

    timers.push(setInterval(() => {                       // watchdog: kill workers stuck inside one game
      const now = Date.now();
      for (const st of slots) {
        if (!st || !st.ready || st.killReason) continue;
        const idx = ctrl[base(st.slot)];
        if (idx >= 0 && now - starts[st.slot] > hardMs) { st.killReason = 'timeout'; st.w.terminate(); }
      }
    }, 200));
    if (hooks.onTick) {
      timers.push(setInterval(() => {
        let fly = 0;
        for (let s = 0; s < nSlots; s++) if (ctrl[base(s)] >= 0) fly += Math.min(0.95, ctrl[base(s) + 1] / cfg.turns);
        hooks.onTick({ done, total, fly, elapsed: performance.now() - tRelease, started: released });
      }, 250));
    }
    timers.push(setTimeout(release, 60000));               // never wait forever for a slow starter
    for (let s = 0; s < nSlots; s++) spawn(s);
  });

  pool.stop = () => { pool.interrupted = true; Atomics.store(ctrl, C.STOP, 1); };
  return pool;
}

// ============================================================================================================ aggregation
const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
const countBy = (arr, fn) => { const o = {}; for (const x of arr) { const k = fn(x); o[k] = (o[k] || 0) + 1; } return o; };
const short = v => (St.isNum(v) ? String(Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10) : '-');

function newTally() { return { n: 0, fin: 0, wins: 0, leads: 0, elim: 0, expFin: 0, scoreSum: 0, scoreN: 0, capped: 0, ends: [] }; }
function tally(map, key, e, g, n) {
  if (key === null || key === undefined) return;
  let t = map.get(key);
  if (!t) map.set(key, (t = newTally()));
  t.n++;
  if (g.finished) { t.fin++; t.expFin += 1 / n; if (sameId(g.winnerId, e.id)) t.wins++; } else t.capped++;
  if (sameId(g.leaderId, e.id)) t.leads++;
  if (!e.alive) t.elim++;
  if (St.isNum(e.score)) { t.scoreSum += e.score; t.scoreN++; }
  t.ends.push(g.endTurn);
}
function winRow(label, t) {
  const ci = St.wilson(t.wins, t.fin), exp = t.fin ? t.expFin / t.fin : NaN;
  const flag = t.fin >= 10 ? (ci[0] > exp ? 'HIGH' : ci[1] < exp ? 'LOW' : '') : '';
  return { label, n: t.n, fin: t.fin, wins: t.wins, win: t.fin ? t.wins / t.fin : NaN, lo: ci[0], hi: ci[1], exp, lead: t.n ? t.leads / t.n : NaN, elim: t.n ? t.elim / t.n : NaN,
    score: t.scoreN ? t.scoreSum / t.scoreN : NaN, cap: t.n ? t.capped / t.n : NaN, endMed: St.median(t.ends), flag };
}

function aggregate(results, samples, cfg, wallMs) {
  const games = results.filter(Boolean), valid = games.filter(r => r.status === 'ok');
  const A = {
    games: games.length, ok: valid.length, exceptions: games.filter(r => r.status === 'error' && r.error && r.error.kind === 'exception').length,
    crashes: games.filter(r => r.status === 'error' && r.error && r.error.kind !== 'exception').length, timeouts: games.filter(r => r.status === 'timeout').length,
    aborted: games.filter(r => r.status === 'aborted').length, finished: valid.filter(r => r.finished).length, wallMs,
  };
  A.capped = A.ok - A.finished;
  A.reasons = countBy(valid, r => r.reason || 'none');
  A.endTurn = { all: St.summarize(valid.map(r => r.endTurn)), finished: St.summarize(valid.filter(r => r.finished).map(r => r.endTurn)) };
  A.turnsPlayed = games.reduce((s, r) => s + (r.endTurn || 0), 0);

  // ---- win rates
  const byRace = new Map(), byRace0 = new Map(), byPers = new Map(), byObj = new Map();
  const slot0 = { difficulty: new Map(), size: new Map(), age: new Map(), opponents: new Map() };
  for (const g of valid) {
    const n = g.empires.length || 1, e0 = g.empires.find(e => sameId(e.id, 0)) || g.empires[0];
    for (const e of g.empires) { tally(byRace, e.race, e, g, n); tally(byPers, e.personality, e, g, n); tally(byObj, e.objective, e, g, n); }
    if (e0) { tally(byRace0, e0.race, e0, g, n); for (const d of Object.keys(slot0)) tally(slot0[d], String(g[d]), e0, g, n); }
  }
  const byWin = (a, b) => (b.win || -1) - (a.win || -1) || (a.label < b.label ? -1 : 1);
  const rows = (map, order) => Array.from(map.entries()).map(([k, t]) => winRow(k, t))
    .sort(order ? (a, b) => order.indexOf(a.label) - order.indexOf(b.label) : byWin);
  A.win = {
    race: rows(byRace), race0: rows(byRace0), personality: rows(byPers), objective: rows(byObj),
    difficulty: rows(slot0.difficulty, DIFFS), size: rows(slot0.size, SIZES), age: rows(slot0.age, AGES), opponents: rows(slot0.opponents, ['1', '2', '3', '4', '5']),
  };

  // ---- growth curves (all empires alive at the snapshot turn)
  const turnsC = cfg.statsAt.filter(t => t <= cfg.turns);
  A.curves = turnsC.map(T => {
    const vals = {}, c = { turn: T, games: 0, empires: 0, alive: 0 };
    for (const m of METRICS) vals[m] = [];
    for (const g of valid) {
      const s = g.snaps.find(x => x.turn === T);
      if (!s) continue;
      c.games++;
      for (const e of s.e) { c.empires++; if (!e.alive) continue; c.alive++; for (const m of METRICS) if (e[m] !== null) vals[m].push(e[m]); }
    }
    for (const m of METRICS) c[m] = St.summarize(vals[m]);
    return c;
  });

  // ---- growth by race at a reference turn (snapshot nearest to turn 100, never beyond it): who expands / techs faster?
  const refT = turnsC.filter(t => t <= 100).pop() || turnsC[0];
  const raceVals = new Map();
  for (const g of valid) {
    const s = g.snaps.find(x => x.turn === refT);
    if (!s) continue;
    const raceOf = new Map(g.empires.map(e => [String(e.id), e.race]));
    for (const e of s.e) {
      if (!e.alive) continue;
      const key = raceOf.get(String(e.id));
      if (!raceVals.has(key)) raceVals.set(key, { n: 0, vals: Object.fromEntries(METRICS.map(m => [m, []])) });
      const r = raceVals.get(key);
      r.n++;
      for (const m of METRICS) if (e[m] !== null) r.vals[m].push(e[m]);
    }
  }
  A.growthByRace = { turn: refT === undefined ? null : refT, rows: Array.from(raceVals.entries()).map(([race, r]) => {
    const row = { race, n: r.n };
    for (const m of METRICS) row[m] = St.median(r.vals[m]);
    return row;
  }).sort((a, b) => (b.colonies || 0) - (a.colonies || 0) || (a.race < b.race ? -1 : 1)) };

  // ---- timing (raw per-turn samples)
  const wall = [], ph = {}, buckets = new Map();
  let worst = null;
  for (const g of games) {
    const sm = samples.get(g.i);
    if (g.time && g.time.worst && (!worst || g.time.worst.ms > worst.ms)) {
      worst = { ms: g.time.worst.ms, turn: g.time.worst.turn, seed: g.seed, race: g.race, difficulty: g.difficulty, timings: g.time.worst.timings };
    }
    if (!sm) continue;
    for (let t = 0; t < sm.wall.length; t++) {
      wall.push(sm.wall[t]);
      const b = Math.floor(t / 50);
      let bk = buckets.get(b);
      if (!bk) buckets.set(b, (bk = { wall: [], phases: {} }));
      bk.wall.push(sm.wall[t]);
    }
    for (const k in sm.phases) {
      const arr = ph[k] || (ph[k] = []);
      for (let t = 0; t < sm.phases[k].length; t++) { arr.push(sm.phases[k][t]); const bk = buckets.get(Math.floor(t / 50)); (bk.phases[k] || (bk.phases[k] = [])).push(sm.phases[k][t]); }
    }
  }
  A.timing = { wall: St.summarize(wall), phases: {}, worst, cpuMs: games.reduce((s, r) => s + (r.time ? r.time.wallMs : 0), 0), buckets: [] };
  for (const k in ph) A.timing.phases[k] = St.summarize(ph[k]);
  for (const [b, bk] of Array.from(buckets.entries()).sort((x, y) => x[0] - y[0])) {
    const row = { from: b * 50 + 1, to: b * 50 + 50, wall: St.summarize(bk.wall), phases: {} };
    for (const k in bk.phases) row.phases[k] = St.summarize(bk.phases[k]);
    A.timing.buckets.push(row);
  }

  // ---- diplomacy / events / saves
  const evTotals = {};
  for (const g of valid) for (const k in g.events) evTotals[k] = (evTotals[k] || 0) + g.events[k];
  A.events = { perGame: Object.fromEntries(Object.entries(evTotals).map(([k, n]) => [k, n / Math.max(1, valid.length)])), seen: Object.keys(evTotals).length > 0 };
  A.diplomacy = {
    contactGames: valid.filter(g => g.firstContact !== null).length, firstContact: St.summarize(valid.map(g => g.firstContact)),
    wars: St.summarize(valid.map(g => g.wars)), treaties: St.summarize(valid.map(g => g.treaties)),
  };
  A.saves = { final: St.summarize(valid.map(g => g.bytes.final)) };
  A.determinism = cfg.determinism ? { checked: valid.filter(g => g.det).length, bad: valid.filter(g => g.det && !g.det.ok).length } : null;
  A.warnings = collectWarnings(games, A, cfg);
  A.failures = collectFailures(games);
  return A;
}

const SEV_RANK = { error: 0, warn: 1, info: 2 };
function collectWarnings(games, A, cfg) {
  const map = new Map();
  const add = (code, sev, g, w) => {
    let e = map.get(code);
    if (!e) map.set(code, (e = { code, sev, games: 0, total: 0, examples: [] }));
    if (w.first && g) e.games++;
    e.total += w.count;
    if (w.first && e.examples.length < cfg.maxExamples && w.msg) {
      const from = k => (g ? g[k] : null);
      e.examples.push({ i: from('i'), seed: from('seed'), race: from('race'), difficulty: from('difficulty'), size: from('size'), age: from('age'), opponents: from('opponents'), turn: w.turn, msg: w.msg });
    }
  };
  for (const g of games) {
    const first = new Set();
    for (const w of g.warnings || []) {
      add(w.code, w.sev, g, { first: !first.has(w.code), count: first.has(w.code) ? 0 : (g.warnCounts[w.code] || 1), turn: w.turn, msg: w.msg });
      first.add(w.code);
    }
  }
  // run-level findings: balance flags and suspicious aggregates (info/warn)
  const glob = (code, sev, msg) => add(code, sev, null, { first: true, count: 1, turn: null, msg });
  if (A.ok >= 8 && A.capped / A.ok > 0.5) {
    glob('CAP_RATE', 'info', St.pc(A.capped / A.ok) + ' of games hit the ' + cfg.turns + '-turn cap: raise --turns, or the AI is too passive to finish games');
  }
  const seenTypes = Object.keys(A.events.perGame).slice(0, 8).join(', ');
  if (A.ok >= 8 && A.events.seen && A.diplomacy.contactGames === 0) {
    glob('NO_CONTACT', 'info', 'no event matching /contact/ in any game, so first-contact turns are unknown (event types seen: ' + seenTypes + '; see RE_CONTACT in tools/soak-worker.js)');
  }
  if (A.ok >= 8 && A.events.seen && A.diplomacy.wars.sum === 0) {
    glob('NO_WARS', 'info', 'no event matching /war/ in any game, so wars cannot be counted (event types seen: ' + seenTypes + '; see RE_WAR in tools/soak-worker.js)');
  }
  const flagged = (tbl, what) => {
    for (const r of tbl) {
      if (!r.flag) continue;
      glob('BALANCE', 'info', what + ' ' + r.label + ': win ' + St.pc(r.win, 1) + ' (95% CI ' + St.pc(r.lo) + '-' + St.pc(r.hi) + ') vs ' + St.pc(r.exp, 1) +
        ' expected over ' + r.fin + ' finished games [' + r.flag + ']');
    }
  };
  flagged(A.win.race, 'race'); flagged(A.win.personality, 'personality'); flagged(A.win.objective, 'objective');
  flagged(A.win.race0.map(r => Object.assign({}, r, { label: r.label + ' (slot 0)' })), 'race');
  const dd = A.win.difficulty.filter(r => r.fin >= 10);
  for (let k = 1; k < dd.length; k++) {
    if (dd[k].win > dd[k - 1].win && dd[k].lo > dd[k - 1].hi) {
      glob('DIFFICULTY_ORDER', 'info', 'slot-0 win rate RISES from ' + dd[k - 1].label + ' (' + St.pc(dd[k - 1].win) + ') to ' + dd[k].label + ' (' + St.pc(dd[k].win) +
        '): difficulty bonuses look inverted');
    }
  }
  return Array.from(map.values()).sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev] || b.games - a.games || (a.code < b.code ? -1 : 1));
}

function collectFailures(games) {
  const map = new Map();
  for (const g of games) {
    if (!g.error || g.status === 'aborted') continue;
    const e = g.error, frame = (String(e.stack || '').split('\n').slice(1).find(l => /^\s*at /.test(l)) || '').trim();
    const key = e.kind + '|' + String(e.message).split('\n')[0] + '|' + frame.replace(/:\d+:\d+\)?$/, '');
    let f = map.get(key);
    if (!f) {
      const first = { i: g.i, seed: g.seed, race: g.race, difficulty: g.difficulty, size: g.size, age: g.age, opponents: g.opponents, turn: e.turn, phase: e.phase, stack: e.stack };
      map.set(key, (f = { kind: e.kind, message: String(e.message).split('\n')[0], count: 0, first }));
    }
    f.count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ============================================================================================================== reporting
let COLOR = false;
const paint = (code, s) => (COLOR ? '\x1b[' + code + 'm' + s + '\x1b[0m' : s);
const sevPaint = (sev, s) => (sev === 'error' ? paint(31, s) : sev === 'warn' ? paint(33, s) : s);
function reproCmd(cfg, r) {
  let c = 'node tools/soak.js --replay ' + r.seed + ' ' + r.race + ' ' + r.difficulty + ' --size ' + r.size + ' --age ' + r.age + ' --opponents ' + r.opponents + ' --turns ' + cfg.turns;
  if (cfg.simMock) c += ' --mock';
  if (cfg.mockSpec) c += ' --mock-fail ' + cfg.mockSpec;
  if (cfg.mockCfg.work !== 1) c += ' --mock-work ' + cfg.mockCfg.work;
  if (cfg.determinism) c += ' --determinism';
  for (const k of Object.keys(cfg.simOptions)) c += ' --opt ' + k + '=' + cfg.simOptions[k];
  return c;
}
const pct1 = v => (St.isNum(v) ? (v * 100).toFixed(1) : '-');
const L = (h, k, o) => Object.assign({ h, k, a: 'l' }, o);
const R = (h, k, o) => Object.assign({ h, k, a: 'r' }, o);

function reportHeader(cfg, A, info) {
  const sim = (cfg.simMock ? 'mock (' + cfg.simWhy + ')' : 'real MOO.Sim');
  const rate = A.wallMs > 0 ? A.games / (A.wallMs / 1000) : 0, trate = A.wallMs > 0 ? A.turnsPlayed / (A.wallMs / 1000) : 0;
  const L1 = 'MOO soak | ' + A.games + ' games | sim: ' + sim + ' | ' + info.threads + ' threads | wall ' + St.dur(A.wallMs) +
    ' (' + St.fix(rate, rate < 10 ? 2 : 1) + ' games/s, ' + St.int(trate) + ' turns/s)';
  const list = a => (a.length > 6 ? 'all ' + a.length : a.join(','));
  const L2 = '  size ' + cfg.sizes.join(',') + ' | age ' + cfg.ages.join(',') + ' | difficulty ' + cfg.difficulties.join(',') + ' | opponents ' + cfg.opponents.join(',') + ' | races ' + list(cfg.races) +
    ' | turns <= ' + cfg.turns + ' | seeds ' + seedFor(cfg.seed, 0) + (cfg.games > 1 && !cfg.matrix ? '..' + seedFor(cfg.seed, cfg.games - 1) : '') +
    (cfg.matrix ? ' x ' + cfg.races.length * cfg.difficulties.length + ' cells' : '');
  const combos = cfg.races.length * cfg.difficulties.length * cfg.sizes.length * cfg.ages.length * cfg.opponents.length;
  const out = [paint(1, L1), L2];
  if (!cfg.matrix && combos > cfg.games) {
    out.push('  note: the lists span ' + combos + ' combinations but only ' + cfg.games + ' games run (order: race, difficulty, size, age, opponents), ' +
      'so later values may not be reached');
  }
  return out;
}

function reportOutcome(A) {
  const bits = ['ok ' + A.ok];
  if (A.exceptions) bits.push(paint(31, 'exceptions ' + A.exceptions));
  if (A.crashes) bits.push(paint(31, 'worker crashes ' + A.crashes + (A.respawns ? ' (' + A.respawns + ' respawned)' : '')));
  if (A.timeouts) bits.push(paint(31, 'timeouts ' + A.timeouts));
  if (A.aborted) bits.push('aborted ' + A.aborted);
  const e = A.endTurn.all, f = A.endTurn.finished;
  const reasons = Object.entries(A.reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' ' + n).join(', ');
  return ['OUTCOME  games ' + A.games + '  ' + bits.join('  '),
    '         finished ' + A.finished + ' (' + St.pc(A.ok ? A.finished / A.ok : NaN) + ')  hit turn cap ' + A.capped + ' (' + St.pc(A.ok ? A.capped / A.ok : NaN) + ')' +
    '   end turn median ' + St.fix(f.n ? f.p50 : e.p50, 0) +
    (f.n ? ' of finished [p10 ' + St.fix(f.p10, 0) + ' .. p90 ' + St.fix(f.p90, 0) + ']' : '') + '   endings: ' + (reasons || '-')];
}

function winTable(title, tbl, withSlot0, first) {
  if (!tbl.length) return [];
  const cols = [L(first, 'label'), R('games', 'n'), R('fin', 'fin'), R('wins', 'wins'), R('win%', 'win', { f: pct1 }),
    R('95% CI', 'lo', { f: (v, r) => Math.round(r.lo * 100) + '-' + Math.round(r.hi * 100) }),
    R('exp%', 'exp', { f: pct1 }), R('lead%', 'lead', { f: pct1 }), R('elim%', 'elim', { f: pct1 }), R('cap%', 'cap', { f: pct1 }), R('score', 'score', { f: v => St.fix(v, 0) }), L('flag', 'flag')];
  if (withSlot0) {
    cols.splice(10, 0, R('s0 n', 's0n', { f: v => (v === undefined ? '' : v) }), R('s0 win%', 's0win', { f: pct1 }), R('s0 lead%', 's0lead', { f: pct1 }));
    for (const r of tbl) { const s = withSlot0.get(r.label); if (s) { r.s0n = s.n; r.s0win = s.win; r.s0lead = s.lead; } }
  }
  return [title, St.table(cols, tbl, { indent: 2 })];
}

function reportWinRates(A, cfg) {
  const out = ['WIN RATES   win% = wins / appearances in finished games, exp% = chance-level share, lead% = top score at game end (all games), 95% Wilson CI'];
  const s0 = new Map(A.win.race0.map(r => [r.label, r]));
  out.push.apply(out, winTable('  by race (all empire slots; s0 = race played in slot 0 = the "player" AI)', A.win.race, s0, 'race'));
  out.push.apply(out, winTable('  by personality (all slots)', A.win.personality, null, 'personality'));
  out.push.apply(out, winTable('  by objective (all slots)', A.win.objective, null, 'objective'));
  const lv = (name, tbl) => { if (tbl.length > 1) out.push.apply(out, winTable('  slot-0 AI by ' + name, tbl, null, name)); };
  lv('difficulty', A.win.difficulty); lv('size', A.win.size); lv('age', A.win.age); lv('opponents', A.win.opponents);
  const d1 = A.win.difficulty[0];
  if (A.win.difficulty.length === 1 && A.win.size.length === 1 && A.win.age.length === 1) {
    out.push('  (slot 0 at ' + d1.label + ' difficulty: win ' + pct1(d1.win) + '% of finished, lead ' + pct1(d1.lead) + '% of games, expected ' + pct1(d1.exp) + '%)');
  }
  return out;
}

function reportCurves(A) {
  if (!A.curves.length) return [];
  const cell = s => (s.n ? short(s.p50) + ' [' + short(s.p10) + '-' + short(s.p90) + ']' : '-');
  const cols = [L('metric', 'label')];
  A.curves.forEach((c, k) => cols.push(R('T' + c.turn, 'c' + k)));
  const rows = [{ label: 'alive' }];
  A.curves.forEach((c, k) => { rows[0]['c' + k] = c.empires ? c.alive + '/' + c.empires + ' ' + St.pc(c.alive / c.empires) : '-'; });
  for (const m of METRICS) {
    const row = { label: m === 'research' ? 'research (RP/turn)' : m };
    A.curves.forEach((c, k) => { row['c' + k] = cell(c[m]); });
    rows.push(row);
  }
  const out = ['GROWTH CURVES   median [p10-p90] over empires alive at turn T (alive = living / all empires in games that reached T)', St.table(cols, rows, { indent: 2 })];
  const gb = A.growthByRace;
  if (gb.rows.length > 1) {
    const num = m => R(m === 'research' ? 'RP' : m, m, { f: short });
    out.push('', '  by race at turn ' + gb.turn + ' (median over living empires, all slots; sorted by colonies)',
      St.table([L('race', 'race'), R('n', 'n')].concat(METRICS.map(num)), gb.rows, { indent: 4 }));
  }
  return out;
}

function reportTiming(A, cfg) {
  const T = A.timing, w = T.wall;
  if (!w.n) return [];
  const total = w.sum;
  const rows = [{ label: 'turn (wall)', s: w }];
  for (const k of Object.keys(T.phases)) rows.push({ label: '  ' + k, s: T.phases[k] });
  const cols = [L('ms per turn', 'label'), R('turns', 's', { f: s => St.int(s.n) }), R('mean', 's', { f: s => St.ms(s.mean) }),
    R('p50', 's', { f: s => St.ms(s.p50) }), R('p90', 's', { f: s => St.ms(s.p90) }),
    R('p99', 's', { f: s => St.ms(s.p99) }), R('max', 's', { f: s => St.ms(s.max) }), R('share', 's', { f: s => (s.sum !== undefined && total ? St.pc(s.sum / total) : '') })];
  const out = ['TURN TIME', St.table(cols, rows, { indent: 2 })];
  if (T.worst) out.push('  worst turn: ' + St.ms(T.worst.ms) + ' ms at turn ' + T.worst.turn + ' (seed ' + T.worst.seed + ' ' + T.worst.race + '/' + T.worst.difficulty + ')' +
    (T.worst.timings ? '  ' + Object.keys(T.worst.timings).map(k => k + ' ' + St.ms(T.worst.timings[k])).join(' ') : ''));
  if (cfg.profile && T.buckets.length) {
    const phases = Object.keys(T.phases).filter(k => k !== 'total');
    const bcols = [L('turns', 'label'), R('n', 'n'), R('mean', 'mean'), R('p50', 'p50'), R('p95', 'p95'), R('max', 'max')].concat(phases.map(k => R(k, 'ph_' + k)));
    const brow = T.buckets.map(b => {
      const r = { label: b.from + '-' + b.to, n: St.int(b.wall.n), mean: St.ms(b.wall.mean), p50: St.ms(b.wall.p50), p95: St.ms(b.wall.p95), max: St.ms(b.wall.max) };
      for (const k of phases) r['ph_' + k] = b.phases[k] ? St.ms(b.phases[k].mean) : '-';
      return r;
    });
    out.push('  profile: mean ms per phase by game stage', St.table(bcols, brow, { indent: 4 }));
  }
  return out;
}

function reportEvents(A) {
  const d = A.diplomacy, out = [];
  const top = Object.entries(A.events.perGame).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ' ' + St.fix(v, v < 10 ? 1 : 0)).join(', ');
  out.push('EVENTS / DIPLOMACY (per game)  ' + (A.events.seen ? 'contact in ' + St.pc(A.ok ? d.contactGames / A.ok : NaN) + ' of games' +
    (d.firstContact.n ? ', first contact turn median ' + St.fix(d.firstContact.p50, 0) + ' [p10 ' + St.fix(d.firstContact.p10, 0) + ' .. p90 ' + St.fix(d.firstContact.p90, 0) + ']' : '') +
    '; wars mean ' + St.fix(d.wars.mean, 1) + ' (max ' + St.fix(d.wars.max, 0) + '); treaties mean ' + St.fix(d.treaties.mean, 1) : 'no events reported by autoTurn'));
  if (top) out.push('  event types: ' + top);
  const s = A.saves.final;
  if (s.n) out.push('  save size (JSON): median ' + St.kb(s.p50) + ', p90 ' + St.kb(s.p90) + ', max ' + St.kb(s.max));
  if (A.determinism) out.push('  determinism: ' + A.determinism.checked + ' games replayed, ' + (A.determinism.bad ? paint(31, A.determinism.bad + ' DIVERGED') : 'all identical'));
  return out;
}

function reportWarnings(A, cfg) {
  const w = A.warnings, out = [];
  if (!w.length) return ['SANITY  no warnings'];
  out.push('SANITY WARNINGS  (' + w.length + ' kinds)');
  for (const e of w) {
    const hits = e.games ? e.games + ' game' + (e.games === 1 ? '' : 's') + (e.total > e.games ? ', ' + e.total + ' hits' : '') : 'run-level';
    out.push('  ' + sevPaint(e.sev, e.sev.toUpperCase().padEnd(5)) + ' ' + e.code.padEnd(18) + hits);
    e.examples.forEach((x, k) => {
      const where = x.seed !== null ? 'seed ' + x.seed + ' ' + x.race + '/' + x.difficulty + (x.turn !== null && x.turn !== undefined ? ' t' + x.turn : '') + ': ' : '';
      out.push('        ' + where + String(x.msg).replace(/\s+/g, ' ').slice(0, 210));
    });
    const g = e.examples.find(x => x.seed !== null);
    if (g && e.sev !== 'info') out.push('        repro: ' + reproCmd(cfg, g));
  }
  return out;
}

function reportFailures(A, cfg) {
  if (!A.failures.length) return [];
  const n = A.failures.reduce((s, f) => s + f.count, 0), out = ['FAILURES  (' + n + ' game' + (n === 1 ? '' : 's') + ', ' + A.failures.length + ' distinct)'];
  if (!cfg.simMock && A.ok === 0 && A.failures.every(f => f.first.phase === 'newGame')) {
    out.push('  hint: every game died inside MOO.Sim.newGame, so the real sim is probably incomplete; --mock tests the runner itself with the toy sim');
  }
  for (const f of A.failures) {
    const x = f.first;
    out.push('  ' + paint(31, '[' + f.kind + ' x' + f.count + ']') + ' ' + f.message.slice(0, 200));
    out.push('      first: seed ' + x.seed + ' ' + x.race + '/' + x.difficulty + ' turn ' + x.turn + ' in ' + x.phase);
    const st = String(x.stack || '').split('\n').slice(1).filter(l => l.trim() && !/node:internal/.test(l)).slice(0, 6);
    for (const l of st) out.push('      ' + l.trim().slice(0, 180));
    out.push('      repro: ' + reproCmd(cfg, x));
  }
  return out;
}

function reportMatrix(cfg, valid) {
  const T = cfg.statsAt.filter(t => t <= Math.min(100, cfg.turns)).pop() || null;
  const cells = new Map(), rowT = new Map(), colT = new Map(), allT = { n: 0, fin: 0, wins: 0, leads: 0, col: [], tech: [] };
  const mk = () => ({ n: 0, fin: 0, wins: 0, leads: 0, col: [], tech: [] });
  const bump = (t, g, r0) => {
    t.n++; if (g.finished) t.fin++;
    if (sameId(g.winnerId, 0)) t.wins++;
    if (sameId(g.leaderId, 0)) t.leads++;
    if (r0 && r0.alive) { if (r0.colonies !== null) t.col.push(r0.colonies); if (r0.techs !== null) t.tech.push(r0.techs); }
  };
  for (const g of valid) {
    const snap = T === null ? null : g.snaps.find(s => s.turn === T), r0 = snap && snap.e.find(e => sameId(e.id, 0));
    for (const [map, key] of [[cells, g.race + '|' + g.difficulty], [rowT, g.race], [colT, g.difficulty]]) { if (!map.has(key)) map.set(key, mk()); bump(map.get(key), g, r0); }
    bump(allT, g, r0);
  }
  const grid = (title, fn, fmt) => {
    const cols = [L('race', 'race')].concat(cfg.difficulties.map(d => R(d, d)), [R('all', 'all')]);
    const rows = cfg.races.map(r => {
      const o = { race: r }, rt = rowT.get(r);
      for (const d of cfg.difficulties) { const c = cells.get(r + '|' + d); o[d] = c ? fmt(fn(c)) : '-'; }
      o.all = rt ? fmt(fn(rt)) : '-';
      return o;
    });
    const tot = { race: 'all' }; for (const d of cfg.difficulties) { const c = colT.get(d); tot[d] = c ? fmt(fn(c)) : '-'; } tot.all = fmt(fn(allT));
    rows.push(tot);
    return ['  ' + title, St.table(cols, rows, { indent: 4 })];
  };
  const exp = valid.length ? valid.reduce((s, g) => s + 1 / (g.empires.length || 1), 0) / valid.length : NaN;
  const ns = Array.from(cells.values()).map(c => c.n), nMin = ns.length ? Math.min.apply(null, ns) : 0, nMax = ns.length ? Math.max.apply(null, ns) : 0;
  const out = ['MATRIX  slot-0 AI by race x difficulty, ' + cfg.games + ' games per cell (valid per cell ' + nMin + (nMax !== nMin ? '-' + nMax : '') + '); chance level = ' + pct1(exp) + '%'];
  out.push.apply(out, grid('score-leader share % (all games)', c => (c.n ? c.leads / c.n * 100 : NaN), v => St.fix(v, 0)));
  out.push.apply(out, grid('win % (of all games; unfinished games count as no win)', c => (c.n ? c.wins / c.n * 100 : NaN), v => St.fix(v, 0)));
  if (T !== null) {
    out.push.apply(out, grid('mean colonies at turn ' + T + ' (while alive)', c => St.mean(c.col), v => St.fix(v, 1)));
    out.push.apply(out, grid('mean techs at turn ' + T + ' (while alive)', c => St.mean(c.tech), v => St.fix(v, 1)));
  }
  return out;
}

function printReport(cfg, A, valid, info) {
  const sections = [reportHeader(cfg, A, info), reportOutcome(A)];
  if (cfg.matrix) sections.push(reportMatrix(cfg, valid));
  if (A.ok) sections.push(reportWinRates(A, cfg), reportCurves(A));
  sections.push(reportTiming(A, cfg));
  if (A.ok) sections.push(reportEvents(A));
  sections.push(reportWarnings(A, cfg), reportFailures(A, cfg));
  console.log(sections.filter(s => s.length).map(s => s.join('\n')).join('\n\n'));
}

// =================================================================================================================== output
function resolveOut(file) {
  return path.isAbsolute(file) || /[\\/]/.test(file) ? path.resolve(file) : path.join(OUT_DIR, file);
}
const round3 = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v);
function writeJson(file, top, games) {                     // header/aggregates compact on single lines, one game per line
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const parts = ['{'];
  for (const k of Object.keys(top)) parts.push(JSON.stringify(k) + ':' + JSON.stringify(top[k], round3) + ',');
  parts.push('"games":[');
  parts.push(games.map(g => JSON.stringify(g, round3)).join(',\n'));
  parts.push(']}\n');
  fs.writeFileSync(file, parts.join('\n'));
  return file;
}

// ====================================================================================================== progress display
function makeProgress(cfg) {
  if (cfg.quiet) return null;
  const tty = !!process.stderr.isTTY;
  let lastLine = Date.now(), last = '';
  return {
    tick(p, live) {
      if (!p.started) return;
      const eff = p.done + p.fly, frac = Math.min(1, eff / p.total), rate = p.elapsed > 0 ? p.done / (p.elapsed / 1000) : 0;
      const eta = frac > 0.01 && frac < 1 ? p.elapsed * (1 - frac) / frac : NaN;
      const line = St.bar(frac, 24) + ' ' + p.done + '/' + p.total + ' ' + St.pc(frac) + '  ' + St.fix(rate, rate < 10 ? 2 : 1) + ' games/s  ETA ' + St.dur(eta) +
        '  | err ' + live.errors + ' timeout ' + live.timeouts + ' warn ' + live.warnings;
      if (tty) { process.stderr.write('\r' + line.padEnd(Math.max(last.length, line.length)) ); last = line; }
      else if (Date.now() - lastLine > 5000) { process.stderr.write(line + '\n'); lastLine = Date.now(); }
    },
    end() { if (tty && last) process.stderr.write('\r' + ' '.repeat(last.length) + '\r'); },
  };
}

// ============================================================================================================ run modes
let activePool = null, sigints = 0;
function onSigint() {
  sigints++;
  if (sigints >= 2 || !activePool) { process.stderr.write('\nforced exit\n'); process.exit(130); }
  process.stderr.write('\ninterrupt: finishing in-flight games, then reporting what completed (Ctrl+C again to force quit)\n');
  activePool.stop();
}

async function runSoak(cfg) {
  const jobs = makeJobs(cfg);
  const live = { errors: 0, timeouts: 0, warnings: 0 }, samples = new Map();
  const prog = makeProgress(cfg);
  if (!cfg.quiet) {
    const simName = cfg.simMock ? 'mock (' + cfg.simWhy + ')' : 'real MOO.Sim';
    const grid = cfg.matrix ? ', matrix ' + cfg.races.length + ' races x ' + cfg.difficulties.length + ' difficulties x ' + cfg.games + ' games' : '';
    console.error('soak: ' + jobs.length + ' games on ' + Math.min(cfg.threads, jobs.length) + ' threads, sim: ' + simName + grid);
  }
  const pool = runPool(cfg, jobs, {
    onResult(r) {
      if (r.samples) samples.set(r.i, r.samples);
      delete r.samples;                                    // raw per-turn arrays stay out of the results file
      if (r.status === 'error') live.errors++; else if (r.status === 'timeout') live.timeouts++;
      live.warnings += (r.warnings || []).length;
    },
    onTick: prog ? p => prog.tick(p, live) : null,
  });
  activePool = pool;
  let res;
  try { res = await pool.promise; } finally { activePool = null; if (prog) prog.end(); }
  const results = res.results;
  const A = aggregate(results, samples, cfg, res.wallMs);
  const valid = results.filter(r => r && r.status === 'ok');
  A.respawns = res.respawns;
  printReport(cfg, A, valid, { threads: res.nSlots });
  if (res.interrupted) console.log('\n(interrupted: ' + A.games + ' of ' + jobs.length + ' games completed)');
  if (!cfg.noJson) {
    const jsonPath = resolveOut(cfg.jsonFile || 'soak-' + St.stamp() + '.json');
    const meta = {
      tool: 'tools/soak.js', cmd: process.argv.slice(2).join(' '), when: new Date().toISOString(), node: process.version, cpus: HW_THREADS, threads: res.nSlots,
      sim: cfg.simMock ? 'mock' : 'real', simWhy: cfg.simWhy, wallMs: res.wallMs, interrupted: res.interrupted, respawns: res.respawns,
    };
    writeJson(jsonPath, { meta, config: Object.assign({}, cfg, { replay: undefined, runOpts: undefined }), aggregates: A }, results.filter(Boolean));
    console.log('\nfull results: ' + jsonPath);
  }
  const bad = A.exceptions + A.crashes + A.timeouts > 0 || A.warnings.some(w => w.sev === 'error') || (cfg.strict && A.warnings.some(w => w.sev === 'warn'));
  return res.interrupted ? 130 : bad ? 1 : 0;
}

// --replay: one verbose game in this process (no workers, no SIGINT handler, so Ctrl+C kills even a hung sim)
const NOTABLE = /contact|war|peace|treaty|eliminat|council|conquer|antaran|victory|alliance/i;
const evType = ev => (typeof ev === 'string' ? ev : ev && ev.type);
const compact = v => (v === null ? '-' : Math.round(v));

function replayTurnLine(cfg, job, { played, S, rep, ms, snap }) {
  const evs = rep && Array.isArray(rep.events) ? rep.events : [];
  const cells = snap ? snap.e.map(r => 'e' + r.id + ' ' + (r.alive ? [r.colonies, r.pop, r.production, r.research, r.techs, r.ships].map(compact).join('/') : 'dead')) : [];
  console.log('T' + String(played).padStart(3, '0') + ' ' + St.ms(ms).padStart(7) + 'ms ' + String(evs.length).padStart(3) + ' | ' + cells.join(' | '));
  for (const ev of evs) if (cfg.events || NOTABLE.test(String(evType(ev)))) console.log('        ' + JSON.stringify(ev).slice(0, 150));
  if (cfg.dumpAt.includes(played)) {
    const file = path.join(OUT_DIR, 'state-' + job.seed + '-t' + played + '.json');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(S));
    console.log('        state dumped to ' + file);
  }
}

function replaySummary(cfg, res) {
  console.log('');
  if (res.error) {
    console.log(paint(31, 'FAILED (' + res.error.kind + ') at turn ' + res.error.turn + ' in ' + res.error.phase + ': ' + res.error.message));
    if (res.error.stack) console.log(res.error.stack.split('\n').slice(0, 10).join('\n'));
  }
  const w = res.winner;
  const winner = w ? ', winner e' + w.id + ' ' + w.race + ' (' + w.personality + '/' + w.objective + ')' : ', no winner';
  const how = res.finished ? 'finished at turn ' + res.endTurn + ' by ' + res.reason + winner
    : res.status === 'ok' ? 'hit the ' + cfg.turns + '-turn cap' : res.status + ' after ' + res.endTurn + ' turns';
  console.log('RESULT  ' + how + '   leader at end: ' + (res.leaderId === null ? '-' : 'e' + res.leaderId + ' (by ' + res.leaderBy + ')') +
    '   wars ' + res.wars + ', treaties ' + res.treaties +
    ', first contact ' + (res.firstContact === null ? '-' : 'turn ' + res.firstContact));
  if (res.empires.length) {
    console.log(St.table([L('empire', 'id', { f: v => 'e' + v }), L('race', 'race'), L('personality', 'personality'), L('objective', 'objective'),
      R('alive', 'alive', { f: v => (v ? 'yes' : 'no') }),
      R('elim turn', 'elimTurn'), R('colonies', 'colonies'), R('techs', 'techs'), R('score', 'score', { f: v => St.fix(v, 0) })], res.empires, { indent: 2 }));
  }
  if (res.det) console.log('determinism: ' + (res.det.ok ? 'identical for ' + res.det.turns + ' turns' : 'DIVERGED at turn ' + res.det.turn));
  if (res.time) {
    const t = res.time, phases = Object.keys(t.phases);
    console.log('time: ' + St.dur(t.wallMs) + ' for ' + t.turns + ' turns; per turn mean ' + St.ms(t.turn.mean) + ' p95 ' + St.ms(t.turn.p95) + ' max ' + St.ms(t.turn.max) + ' ms' +
      (phases.length ? '; phase means: ' + phases.map(k => k + ' ' + St.ms(t.phases[k].mean)).join(', ') : ''));
    if (cfg.profile) {
      const rows = [Object.assign({ k: 'wall' }, t.turn)].concat(phases.map(k => Object.assign({ k }, t.phases[k])));
      const cols = [L('phase', 'k'), R('mean', 'mean', { f: St.ms }), R('p50', 'p50', { f: St.ms }), R('p90', 'p90', { f: St.ms }),
        R('p99', 'p99', { f: St.ms }), R('max', 'max', { f: St.ms })];
      console.log(St.table(cols, rows, { indent: 2 }));
    }
  }
  if (res.bytes.final) console.log('final save size ' + St.kb(res.bytes.final));
  if (!res.warnings.length) console.log('no sanity warnings');
  else {
    console.log('warnings:');
    for (const x of res.warnings) {
      const more = res.warnCounts[x.code] > 3 ? ' (x' + res.warnCounts[x.code] + ' total)' : '';
      console.log('  ' + sevPaint(x.sev, x.sev.toUpperCase()) + ' ' + x.code + ' t' + x.turn + ': ' + String(x.msg).replace(/\s+/g, ' ').slice(0, 300) + more);
    }
  }
}

async function runReplay(cfg) {
  const job = makeJobs(cfg)[0];
  const env = W.makeEnv(Object.assign({}, cfg.runOpts, { statsEvery: 1 }), null);
  console.log('replay seed ' + job.seed + ' ' + job.race + '/' + job.difficulty + ' size ' + job.size + ' age ' + job.age + ' opponents ' + job.opponents +
    ' | sim: ' + (env.mock ? 'mock (' + env.why + ')' : 'real MOO.Sim'));
  console.log('per empire: colonies/pop/production/research/techs/ships ("dead" once eliminated)');
  const res = W.playGame(env, job, { onTurn: info => replayTurnLine(cfg, job, info) });
  env.dispose();
  replaySummary(cfg, res);
  return res.status === 'ok' && !res.warnings.some(x => x.sev === 'error') ? 0 : 1;
}

// --bench: every thread plays the same games, at growing thread counts
async function runBench(cfg) {
  const base = makeJobs(Object.assign({}, cfg, { matrix: false }));
  const pts = Array.from(new Set([1, 2, 4, 8, 12, 16, 20, 24, 32, 48, 64].filter(n => n < cfg.threads).concat([cfg.threads]))).sort((a, b) => a - b);
  console.log('bench: each thread plays the same ' + base.length + ' games (' + cfg.sizes[0] + '/' + cfg.difficulties[0] + '/' + cfg.opponents[0] +
    ' opponents, <= ' + cfg.turns + ' turns), sim: ' +
    (cfg.simMock ? 'mock (' + cfg.simWhy + ')' : 'real MOO.Sim') + ', ' + HW_THREADS + ' logical CPUs');
  const rows = [];
  for (const t of pts) {
    const jobs = [];
    for (let k = 0; k < t; k++) for (const j of base) jobs.push(Object.assign({}, j, { i: jobs.length }));
    const pool = runPool(Object.assign({}, cfg, { threads: t }), jobs, {});
    activePool = pool;
    const res = await pool.promise;
    activePool = null;
    const ok = res.results.filter(r => r && r.status === 'ok'), turns = ok.reduce((s, r) => s + r.endTurn, 0), secs = res.wallMs / 1000;
    rows.push({
      threads: t, games: ok.length, fails: res.results.length - ok.length, wall: secs, gps: ok.length / secs, tps: turns / secs,
      busy: ok.reduce((s, r) => s + r.time.wallMs, 0) / (res.wallMs * t),                       // share of the wall time the workers spent inside games
      perTurn: ok.reduce((s, r) => s + r.time.turn.sum, 0) / Math.max(1, turns),
    });
    if (res.interrupted) break;
  }
  for (const r of rows) { r.speed = r.tps / rows[0].tps; r.eff = r.speed / (r.threads / rows[0].threads); }
  console.log(St.table([R('threads', 'threads'), R('games', 'games'), R('wall s', 'wall', { f: v => St.fix(v, 2) }), R('games/s', 'gps', { f: v => St.fix(v, 1) }),
    R('turns/s', 'tps', { f: St.int }), R('speedup', 'speed', { f: v => St.fix(v, 2) + 'x' }), R('efficiency', 'eff', { f: v => St.pc(v) }),
    R('workers busy', 'busy', { f: v => St.pc(v) }), R('ms/turn', 'perTurn', { f: St.ms }),
    R('failed', 'fails')], rows, { indent: 2 }));
  console.log('  efficiency = speedup / threads; "workers busy" = game time / (wall x threads) (low = scheduling gaps); ms/turn rising with threads = shared-core/cache/memory contention.');
  if (!cfg.noJson) {
    const file = resolveOut(cfg.jsonFile || 'bench-' + St.stamp() + '.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ when: new Date().toISOString(), cpus: HW_THREADS, node: process.version, sim: cfg.simMock ? 'mock' : 'real', rows }, null, 1));
    console.log('  saved ' + file);
  }
  return rows.some(r => r.fails) ? 1 : 0;
}

// ================================================================================================================== main
async function main(argv) {
  let cfg;
  try {
    const { v, replay } = parseCli(argv);
    if (v.help) { console.log(HELP); return 0; }
    cfg = buildConfig(v, replay);
  } catch (e) {
    if (e instanceof UsageError) { console.error('soak: ' + e.message + '\n(run with --help for the option list)'); return 2; }
    console.error('soak: cannot start: ' + (e && e.stack || e));
    return 2;
  }
  COLOR = !!process.stdout.isTTY && !cfg.noColor && !process.env.NO_COLOR;
  if (!cfg.replay) process.on('SIGINT', onSigint);
  try {
    if (cfg.replay) return await runReplay(cfg);
    if (cfg.bench) return await runBench(cfg);
    return await runSoak(cfg);
  } catch (e) {
    console.error('soak: ' + (e && e.stack || e));
    return 2;
  } finally {
    process.removeListener('SIGINT', onSigint);
  }
}

module.exports = { main, parseCli, buildConfig, makeJobs, runPool, aggregate };

if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
