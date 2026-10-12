'use strict';
// Check 1 (tech pace): per-turn tracking of every AI's research: turn of the first completed new tech, techs at T25/50/75/100, empires with no new tech for >30 turns before T100.
//   node tools/balance/techpace.js [--games 60] [--difficulty average] [--seed 900]  (+ MOO_OVERRIDES env to A/B a quirk)
const L = require('./lib'), W = require(L.ROOT + '/tools/soak-worker.js');
const n = +L.arg('games', 60), diff = L.arg('difficulty', 'average'), seed0 = +L.arg('seed', 900);
const env = W.makeEnv({ options: {} });
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
const first = [], stuck = [], at = { 25: [], 50: [], 75: [], 100: [] };
const count = E => E.research.completed.reduce((a, c) => a + c.length, 0);
for (let i = 0; i < n; i++) {
  const S = env.Sim.newGame(W.settingsFor(env, { size: 'medium', age: 'average', difficulty: diff, opponents: 3, race: RACES[i % 10], seed: seed0 + i }));
  const base = S.empires.map(count), firstT = S.empires.map(() => null), lastGain = S.empires.map(() => 0), lastN = base.slice();
  const maxGap = S.empires.map(() => 0);
  for (let t = 1; t <= 100 && !env.Sim.isOver(S).over; t++) {
    env.Sim.autoTurn(S);
    S.empires.forEach((E, k) => {
      if (!E.alive) return;
      const c = count(E);
      if (c > lastN[k]) { if (firstT[k] === null) firstT[k] = t; lastGain[k] = t; lastN[k] = c; }
      maxGap[k] = Math.max(maxGap[k], t - lastGain[k]);
      if (t in at) at[t].push(c);
    });
  }
  S.empires.forEach((E, k) => { if (firstT[k] !== null) first.push(firstT[k]); else first.push(101); stuck.push(maxGap[k]); });
}
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
console.log(JSON.stringify({ diff, games: n, overrides: process.env.MOO_OVERRIDES || '', firstTechTurn: { p10: q(first, .1), med: q(first, .5), p90: q(first, .9) }, longestNoTechGap: { med: q(stuck, .5), p90: q(stuck, .9), max: q(stuck, 1) },
  empiresGapOver30: (100 * stuck.filter(x => x > 30).length / stuck.length).toFixed(1) + '%', techsAt: Object.fromEntries(Object.keys(at).map(T => [T, L.median(at[T])])) }));
