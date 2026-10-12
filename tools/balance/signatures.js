'use strict';
// Check 3 + 4: objective / personality / race signatures. Plays N AI-vs-AI games to T100 and measures, per empire, wars started, treaties (NAP/alliance) entered, colonies,
// pop, factories, RP, ships and techs at T100 - each as a ratio to the mean of that game's empires (removes game/difficulty effects). Prints markdown tables.
//   node tools/balance/signatures.js [--games 240] [--difficulty average] [--turn 100] [--json out.json]
const L = require('./lib'), W = require(L.ROOT + '/tools/soak-worker.js'), fs = require('fs');
const n = +L.arg('games', 240), diff = L.arg('difficulty', 'average'), T = +L.arg('turn', 100), seed0 = +L.arg('seed', 3000);
const env = W.makeEnv({ options: {} }), Sim = env.Sim, D = env.MOO.Sim.Diplo;
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
let wars = null;
const orig = D.startWar; D.startWar = function (S, a, b, why) { const r = orig.apply(this, arguments); if (r && wars) wars[a]++; return r; };
const OBJ = ['diplomat', 'militarist', 'expansionist', 'technologist', 'industrialist', 'ecologist'], PERS = ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic'];
const nm = (v, a) => typeof v === 'number' ? a[v] : v;
const rows = [];
for (let i = 0; i < n; i++) {
  const opp = 3 + (i % 3);
  const S = Sim.newGame(W.settingsFor(env, { size: 'medium', age: 'average', difficulty: diff, opponents: opp, race: RACES[i % 10], seed: seed0 + i }));
  wars = S.empires.map(() => 0); const treaties = S.empires.map(() => 0), prev = {};
  const key = (a, b) => a + '-' + b;
  let t = 0;
  for (; t < T && !Sim.isOver(S).over; t++) {
    Sim.autoTurn(S);
    for (const E of S.empires) for (const b in E.relations) { const r = E.relations[b], k = key(E.id, b); if (E.id < b && (r.treaty === 1 || r.treaty === 2) && prev[k] !== r.treaty) treaties[E.id]++, treaties[b]++; prev[k] = r.treaty; }
  }
  if (t < T) continue;
  const st = Sim.stats(S), emp = S.empires.filter(E => E.alive);
  const per = emp.map(E => {
    const P = S.planets.filter(p => p.owner === E.id);
    return { id: E.id, race: E.race, pers: nm(E.personality, PERS), obj: nm(E.objective, OBJ), wars: wars[E.id], treaties: treaties[E.id], col: P.length, pop: P.reduce((a, p) => a + (p.pop || 0), 0), fac: P.reduce((a, p) => a + (p.factories || 0), 0),
      rp: E.research.total | 0, techs: E.research.completed.reduce((a, c) => a + c.length, 0), ships: S.fleets.filter(f => f.owner === E.id).reduce((a, f) => a + Object.values(f.ships || {}).reduce((x, y) => x + y, 0), 0) };
  });
  const mean = k => per.reduce((a, e) => a + e[k], 0) / per.length || 1;
  const m = {}; for (const k of ['wars', 'treaties', 'col', 'pop', 'fac', 'rp', 'techs', 'ships']) m[k] = mean(k);
  for (const e of per) { e.rel = {}; for (const k in m) e.rel[k] = m[k] > 0 ? e[k] / m[k] : 1; rows.push(e); }
}
const KEYS = ['wars', 'treaties', 'col', 'pop', 'fac', 'rp', 'techs', 'ships'];
const group = f => { const g = {}; for (const e of rows) (g[e[f]] = g[e[f]] || []).push(e); return g; };
const out = ['(each cell = mean ratio to the same game\'s empire mean; 1.00 = average; n = empires)\n'];
for (const f of ['obj', 'pers', 'race']) {
  const g = group(f);
  out.push('### by ' + (f === 'obj' ? 'objective' : f === 'pers' ? 'personality' : 'race') + ' at T' + T + '\n' + L.table([f, 'n'].concat(KEYS).concat(['wars/game (abs)']), Object.keys(g).sort().map(k => [k, g[k].length].concat(KEYS.map(x => (L.mean(g[k].map(e => e.rel[x]))).toFixed(2))).concat([L.mean(g[k].map(e => e.wars)).toFixed(2)]))) + '\n');
}
console.log(out.join('\n'));
if (L.arg('json')) fs.writeFileSync(L.ROOT + '/tools/out/' + L.arg('json'), JSON.stringify(rows));
