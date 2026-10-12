'use strict';
// Check 6 + 5: robustness and game length over many games across all galaxy sizes (24/48/70/108/160 stars), 1-5 opponents (one soak run per opponent count), every difficulty and galaxy age,
// with the soak's sanity scans (NaN, negative values, non-plain state, round trip, cycles, Math.random...). Exit 1 on exceptions / crashes / timeouts / ERROR warnings.
//   node tools/balance/robust.js [--games 1000] [--seed 20000] [--turns 300] [--det]
const L = require('./lib');
const total = +L.arg('games', 1000), per = Math.ceil(total / 5), turns = L.arg('turns', '300');
const agg = { games: 0, ok: 0, exceptions: 0, crashes: 0, timeouts: 0, finished: 0, reasons: {}, rows: [], warn: {}, errorWarn: 0, ends: [] };
for (let k = 1; k <= 5; k++) {
  const args = ['--size', 'small,medium,large,huge,colossal', '--opponents', String(k), '--difficulty', 'all', '--age', 'all', '--games', String(per), '--seed', String(+L.arg('seed', '20000') + 1000 * k), '--threads', '4', '--stats-at', '100,200', '--turns', turns, '--timeout-ms', '900000'];
  if (process.argv.includes('--det')) args.push('--determinism', '--det-games', '20');
  const j = L.soak(args, 'robust' + k), a = j.aggregates;
  agg.games += a.games; agg.ok += a.ok; agg.exceptions += a.exceptions; agg.crashes += a.crashes; agg.timeouts += a.timeouts; agg.finished += a.finished;
  for (const r in a.reasons || {}) agg.reasons[r] = (agg.reasons[r] || 0) + a.reasons[r];
  for (const w of a.warnings || []) { agg.warn[w.code + ' ' + w.sev] = (agg.warn[w.code + ' ' + w.sev] || 0) + w.total; if (w.sev === 'error') agg.errorWarn += w.total; }
  const F = j.games.filter(g => g.finished);
  agg.ends.push(...F.map(g => g.endTurn));
  agg.rows.push([k, a.games, F.length, (100 * (a.games - F.length) / a.games).toFixed(0) + '%', L.median(F.map(g => g.endTurn)), F.filter(g => g.reason === 'council').length, F.filter(g => g.reason !== 'council').length]);
}
console.log('games', agg.games, 'ok', agg.ok, 'exceptions', agg.exceptions, 'crashes', agg.crashes, 'timeouts', agg.timeouts, 'ERROR warnings', agg.errorWarn);
console.log(L.table(['opponents', 'games', 'finished', 'hit turn cap', 'median end turn (finished)', 'council', 'conquest/other'], agg.rows));
console.log('warnings (code sev: occurrences)', JSON.stringify(agg.warn));
process.exit(agg.exceptions || agg.crashes || agg.timeouts || agg.errorWarn ? 1 : 0);
