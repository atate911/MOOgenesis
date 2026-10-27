'use strict';
// Tech Lab shared helpers: a small worker-thread pool, sim loading, empire metrics and statistics. See tools/techlab/README.md.
const path = require('path'), fs = require('fs'), os = require('os');
const { Worker } = require('worker_threads');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'tools', 'out', 'techlab');
exports.ROOT = ROOT; exports.OUT = OUT;
exports.RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];

exports.arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : d; };
exports.flag = k => process.argv.indexOf('--' + k) > 0;
exports.ensureOut = () => { fs.mkdirSync(OUT, { recursive: true }); return OUT; };
exports.writeJSON = (name, data) => { exports.ensureOut(); const p = path.join(OUT, name); fs.writeFileSync(p, JSON.stringify(data)); return p; };
exports.readJSON = name => JSON.parse(fs.readFileSync(path.join(OUT, name), 'utf8'));

// ---- sim ------------------------------------------------------------------------------------------------------------------------------------------------
// A fresh headless sim. MOO_OVERRIDES-style overrides: {'Sim.XTech.WEIGHT.comp': 5, …} (dotted paths under MOO).
exports.loadSim = function (overrides) {
  const MOO = require(path.join(ROOT, 'tools', 'headless.js')).load({ quiet: true });
  for (const p of Object.keys(overrides || {})) {
    const parts = p.split('.'); let o = MOO;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = overrides[p];
  }
  return MOO;
};
exports.settings = (job, pool) => ({
  size: job.size || 'medium', age: 'average', difficulty: job.difficulty || 'average', opponents: job.opponents === undefined ? 3 : job.opponents,
  race: job.race || 'human', seed: job.seed, playerAI: true,
  // playOn: a council verdict or a conquest does not end the game (the twins must run their full horizon); the council still meets and votes
  options: { tactical: false, randomEvents: true, antarans: true, council: true, playOn: job.playOn !== false, techPool: pool === 'classic' || pool === 'strat' ? 'classic' : 'expanded', strategic: pool === 'strat' || pool === 'xstrat' },   // strat / xstrat: + Strategic choices
});
exports.playTo = function (Sim, S, turn) { while (S.turn < turn && !Sim.isOver(S).over) Sim.autoTurn(S); return S; };
exports.clone = S => JSON.parse(JSON.stringify(S));

// ---- metrics --------------------------------------------------------------------------------------------------------------------------------------------
const HULL_W = [1, 5, 25, 125];
exports.metrics = function (MOO, S, e) {
  const E = S.empires[e];
  let prod = 0, pop = 0, planets = 0, fac = 0;
  for (const p of S.planets) if (p.owner === e) { prod += p.gross | 0; pop += p.pop | 0; planets++; fac += p.factories | 0; }
  let fleet = 0;
  for (const f of S.fleets) if (f.owner === e) for (let i = 0; i < 6; i++) if (f.ships[i] && E.designs[i] && !MOO.Sim.Design.stats(S, E, i).colonyMin) fleet += f.ships[i] * HULL_W[E.designs[i].hull | 0];
  const tl = E.research.tl.reduce((a, b) => a + b, 0), techs = E.research.completed.reduce((a, c) => a + c.length, 0);
  return { alive: E.alive ? 1 : 0, prod, pop, planets, fac, fleet, tl, techs, bc: E.bc | 0, rp: E.research.total | 0 };
};
// one number for "how strong is this empire": weighted log of the core metrics (the same weights for every subject)
const EPI_W = { prod: 0.4, pop: 0.25, fleet: 0.2, tl: 0.15 };
exports.EPI_W = EPI_W;
exports.epi = m => EPI_W.prod * Math.log1p(m.prod) + EPI_W.pop * Math.log1p(m.pop) + EPI_W.fleet * Math.log1p(m.fleet) + EPI_W.tl * Math.log1p(m.tl);

// ---- statistics -----------------------------------------------------------------------------------------------------------------------------------------
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / (a.length - 1)); };
exports.mean = mean; exports.sd = sd;
exports.se = a => sd(a) / Math.sqrt(a.length);
exports.median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
exports.quantile = (a, q) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
// a trimmed mean is robust against the occasional runaway twin (an empire wiped out in one branch only)
exports.trimmed = (a, k) => { if (a.length < 5) return mean(a); const s = a.slice().sort((x, y) => x - y), n = Math.floor(s.length * (k === undefined ? 0.1 : k)); return mean(s.slice(n, s.length - n)); };
exports.bootCI = function (a, stat, n, seed) {
  if (a.length < 3) return [NaN, NaN];
  let x = (seed || 12345) >>> 0; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = [];
  for (let b = 0; b < (n || 1000); b++) { const s = []; for (let i = 0; i < a.length; i++) s.push(a[Math.floor(rnd() * a.length)]); out.push(stat(s)); }
  out.sort((p, q) => p - q);
  return [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]];
};
exports.table = function (head, rows) {
  const out = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'];
  for (const r of rows) out.push('| ' + r.join(' | ') + ' |');
  return out.join('\n');
};
exports.fmtPct = (v, d) => (Number.isFinite(v) ? (v >= 0 ? '+' : '') + (100 * v).toFixed(d === undefined ? 1 : d) + '%' : '-');

// ---- worker pool ----------------------------------------------------------------------------------------------------------------------------------------
// runPool(file, jobs, {threads, data, onResult}) → Promise<results in job order>. The worker file exports nothing; it must call
// require('./lib').serve(handler) where handler(job, data) returns a (JSON-able) result.
exports.runPool = function (file, jobs, opts) {
  opts = opts || {};
  const threads = Math.max(1, Math.min(jobs.length, opts.threads || os.cpus().length));
  const results = new Array(jobs.length);
  let next = 0, done = 0;
  return new Promise((resolve, reject) => {
    if (!jobs.length) return resolve(results);
    for (let w = 0; w < threads; w++) {
      const wk = new Worker(file, { workerData: { techlab: true, data: opts.data || null } });
      const feed = () => { if (next < jobs.length) { const i = next++; wk.postMessage({ i, job: jobs[i] }); } else wk.postMessage({ stop: true }); };
      wk.on('message', m => {
        if (m.ready) return feed();
        results[m.i] = m.result; done++;
        if (opts.onResult) opts.onResult(m.result, m.i, done, jobs.length);
        feed();
      });
      wk.on('error', reject);
      wk.on('exit', code => { if (code !== 0) reject(new Error('worker exited ' + code)); else if (done === jobs.length) resolve(results); });
    }
  });
};
exports.serve = function (handler) {
  const { parentPort, workerData } = require('worker_threads');
  const data = workerData && workerData.data;
  parentPort.on('message', m => {
    if (m.stop) { parentPort.close(); return; }
    let result;
    try { result = handler(m.job, data); } catch (e) { result = { error: String(e && e.stack || e) }; }
    parentPort.postMessage({ i: m.i, result });
  });
  parentPort.postMessage({ ready: true });
};
exports.progress = function (label) {
  const t0 = Date.now();
  return (r, i, done, n) => { if (done === n || done % Math.max(1, Math.floor(n / 20)) === 0) process.stderr.write('  ' + label + ' ' + done + '/' + n + '  ' + Math.round((Date.now() - t0) / 1000) + 's\n'); };
};
