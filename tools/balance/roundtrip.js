'use strict';
// Check 6: save/load round trip mid-game equals continuing. Plays a game to turn T, clones the state through JSON (what save/load does) and plays both copies N more turns; the state hashes must stay equal.
//   node tools/balance/roundtrip.js [--games 12] [--at 60] [--more 40]
const L = require('./lib'), W = require(L.ROOT + '/tools/soak-worker.js'), St = require(L.ROOT + '/tools/lib/stats.js');
const n = +L.arg('games', 12), at = +L.arg('at', 60), more = +L.arg('more', 40);
const env = W.makeEnv({ options: {} }), Sim = env.Sim;
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'], SIZES = ['small', 'medium', 'large', 'huge'];
let bad = 0;
for (let i = 0; i < n; i++) {
  const S = Sim.newGame(W.settingsFor(env, { size: SIZES[i % 4], age: 'average', difficulty: ['easy', 'average', 'hard'][i % 3], opponents: 2 + (i % 4), race: RACES[i % 10], seed: 5000 + i }));
  for (let t = 0; t < at && !Sim.isOver(S).over; t++) Sim.autoTurn(S);
  const C = JSON.parse(JSON.stringify(S));
  let diff = -1;
  for (let t = 0; t < more && !Sim.isOver(S).over; t++) { Sim.autoTurn(S); Sim.autoTurn(C); if (St.hashState(S) !== St.hashState(C)) { diff = t + 1; break; } }
  if (diff >= 0) { bad++; console.log('MISMATCH game ' + i + ' ' + SIZES[i % 4] + ' seed ' + (5000 + i) + ' diverged ' + diff + ' turns after the reload'); } 
}
console.log(n + ' games, ' + bad + ' round-trip mismatches');
process.exit(bad ? 1 : 0);
