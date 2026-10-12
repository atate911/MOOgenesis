'use strict';
// Check 6 + 5: robustness and game-length over many games across all galaxy sizes (24/48/70/108/160 stars) and 1-5 opponents, every difficulty, with the soak's sanity scans.
//   node tools/balance/robust.js [--games 1000] [--seed 20000] [--det]   (prints ERROR/WARN counts, endings, end-turn quantiles; exit 1 on exceptions/ERROR warnings)
const L = require('./lib');
const games = L.arg('games', '1000');
const args = ['--size', 'small,medium,large,huge,colossal', '--opponents', '1,2,3,4,5', '--difficulty', 'all', '--age', 'all', '--games', games, '--seed', L.arg('seed', '20000'), '--threads', '4', '--stats-at', '50,100,150,200', '--turns', '300', '--timeout-ms', '600000'];
if (process.argv.includes('--det')) args.push('--determinism', '--det-games', '40');
const j = L.soak(args, 'robust'), a = j.aggregates;
console.log('games', a.games, 'ok', a.ok, 'exceptions', a.exceptions, 'crashes', a.crashes, 'timeouts', a.timeouts, 'finished', a.finished, 'capped(turn cap)', a.capped, 'wall s', (a.wallMs / 1000).toFixed(0));
console.log('endings', JSON.stringify(a.reasons), 'endTurn', JSON.stringify(a.endTurn));
console.log('warnings', JSON.stringify(a.warnings), 'failures', (a.failures || []).length);
for (const f of (a.failures || []).slice(0, 5)) console.log(JSON.stringify(f).slice(0, 400));
process.exit(a.exceptions || a.crashes ? 1 : 0);
