'use strict';
// Check 3/5: war-AI statistics never measured before - do AIs gang up on the leader, and do wars stall? Plays N games to T200 and records every war (startWar/stopWar):
// whether the target was the production leader when it started (vs the chance level 1/(empires-1)), war length, and planets that changed hands between the two sides.
//   node tools/balance/wars.js [--games 120] [--difficulty average]
const L = require('./lib'), W = require(L.ROOT + '/tools/soak-worker.js');
const n = +L.arg('games', 120), diff = L.arg('difficulty', 'average'), seed0 = +L.arg('seed', 8000), TMAX = +L.arg('turn', 200);
const env = W.makeEnv({ options: {} }), Sim = env.Sim, D = env.MOO.Sim.Diplo;
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
let cur = null;
const os = D.startWar, oe = D.stopWar;
D.startWar = function (S, a, b, why) { const was = D.atWar(S, a, b), r = os.apply(this, arguments); if (r && cur && !was) { const prod = S.empires.filter(E => E.alive).map(E => [E.id, S.planets.filter(p => p.owner === E.id).length]); const top = prod.sort((x, y) => y[1] - x[1]); cur.wars.push({ a, b, t0: S.turn, t1: null, swaps: 0, leader: top[0][0] === b && top[0][1] > (top[1] ? top[1][1] : 0), candidates: prod.length - 1 }); } return r; };
D.stopWar = function (S, a, b) { const r = oe.apply(this, arguments); if (cur) for (const w of cur.wars) if (w.t1 === null && ((w.a === a && w.b === b) || (w.a === b && w.b === a)) && !D.atWar(S, a, b)) w.t1 = S.turn; return r; };
const wars = [], games = [];
for (let i = 0; i < n; i++) {
  const S = Sim.newGame(W.settingsFor(env, { size: 'medium', age: 'average', difficulty: diff, opponents: 3 + (i % 3), race: RACES[i % 10], seed: seed0 + i }));
  cur = { wars: [] }; let owner = S.planets.map(p => p.owner), t = 0;
  for (; t < TMAX && !Sim.isOver(S).over; t++) {
    Sim.autoTurn(S);
    S.planets.forEach((p, k) => { if (p.owner !== owner[k]) { if (owner[k] >= 0 && p.owner >= 0) for (const w of cur.wars) if (w.t1 === null && ((w.a === owner[k] && w.b === p.owner) || (w.b === owner[k] && w.a === p.owner))) w.swaps++; owner[k] = p.owner; } });
  }
  for (const w of cur.wars) { w.open = w.t1 === null; w.len = (w.t1 === null ? t : w.t1) - w.t0; wars.push(w); }
  games.push({ turns: t, wars: cur.wars.length });
}
const leaderWars = wars.filter(w => w.leader), chance = L.mean(wars.map(w => 1 / Math.max(1, w.candidates)));
const long = wars.filter(w => w.len >= 60);
console.log(JSON.stringify({
  games: n, wars: wars.length, warsPerGame: +(wars.length / n).toFixed(2), gamesWithNoWar: games.filter(g => !g.wars).length,
  shareAgainstLeader: +(leaderWars.length / wars.length).toFixed(3), chanceShare: +chance.toFixed(3),
  warLength: { median: L.median(wars.map(w => w.len)), p90: wars.map(w => w.len).sort((x, y) => x - y)[Math.floor(wars.length * .9)] },
  longWars60plus: long.length, longWarsNoPlanetChange: long.filter(w => w.swaps === 0).length, stillOpenAtEnd: wars.filter(w => w.open).length,
  warsWithAnyConquest: wars.filter(w => w.swaps > 0).length }, null, 1));
