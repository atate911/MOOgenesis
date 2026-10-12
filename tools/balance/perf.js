'use strict';
// Check 7: performance. Whole-turn and AI-planning ms on Huge/Colossal with 5 opponents (soak timing aggregates), peak save size, plus per-thread scaling hint.
//   node tools/balance/perf.js [--games 8]
const L = require('./lib');
const j = L.soak(['--size', 'huge,colossal', '--opponents', '5', '--difficulty', 'hard', '--games', L.arg('games', '8'), '--threads', '1', '--turns', '200', '--seed', '40000', '--timeout-ms', '900000'], 'perf');
const t = j.aggregates.timing || {};
console.log(JSON.stringify({ wallMs: j.aggregates.wallMs, turns: j.aggregates.turnsPlayed, timing: t, saves: j.aggregates.saves }, null, 1));
