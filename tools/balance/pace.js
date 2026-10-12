'use strict';
// Checks 1 + 2: growth curves per difficulty (colonies/production/RP/techs/ships at T25/50/100/150/200) and the difficulty ladder.
//   node tools/balance/pace.js [--games 300] [--seed 1] [--reuse]
const L = require('./lib');
const games = L.arg('games', '300'), seed = L.arg('seed', '1');
const j = process.argv.includes('--reuse') ? L.load('pace') : L.soak(['--difficulty', 'all', '--games', games, '--seed', seed, '--stats-at', '10,25,50,75,100,150,200', '--threads', '4'], 'pace');
const DIFFS = ['simple', 'easy', 'average', 'hard', 'impossible'], TS = [10, 25, 50, 75, 100, 150, 200], M = ['colonies', 'production', 'research', 'techs', 'ships'];
console.log('# Pace by difficulty (median over living empires, all slots)\n');
for (const m of M) {
  const rows = DIFFS.map(d => [d].concat(TS.map(T => {
    const v = []; for (const g of j.games) if (g.difficulty === d) { const s = (g.snaps || []).find(x => x.turn === T); if (s) for (const e of s.e) if (e.alive) v.push(e[m]); }
    return v.length ? L.median(v) : '-';
  })));
  console.log('### ' + m + '\n' + L.table(['difficulty'].concat(TS.map(t => 'T' + t)), rows) + '\n');
}
console.log('### Slot-0 / all-empire outcomes by difficulty\n');
console.log(L.table(['difficulty', 'games', 'finished', 'median end', 'slot0 win % (of finished)', 'techs T100', 'first-tech turn (median empire)'], DIFFS.map(d => {
  const G = j.games.filter(g => g.difficulty === d), F = G.filter(g => g.finished);
  const t100 = []; for (const g of G) { const s = (g.snaps || []).find(x => x.turn === 100); if (s) for (const e of s.e) if (e.alive) t100.push(e.techs); }
  return [d, G.length, F.length, L.median(F.map(g => g.endTurn)), L.pct(F.filter(g => g.winnerId === 0).length, F.length), L.median(t100), ''];
})));
