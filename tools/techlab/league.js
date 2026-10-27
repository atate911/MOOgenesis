'use strict';
// Tech Lab · league A/B. Whole games, classic pool against expanded pool, on the SAME seeds (the expanded game starts from the same galaxy, races and S.rs stream;
// only the swapped tree slots differ — data/techs-x.js). Measures what a player would notice: pace (techs, tech level), economy, expansion, fleets, game length,
// race strength, and for every expansion tech: how often it is dealt, researched, and whether holding it moves an empire's standing (intent-to-treat).
//   node tools/techlab/league.js [--games 240] [--first 0] [--size colossal] [--threads 4] [--turns 200] [--out league.json] [--set path=value,...] [--drop id,id]  (--drop = remove techs from the pool)
const L = require('./lib');
const { isMainThread } = require('worker_threads');
const SNAP = [50, 100, 150, 200];
const SIZES = ['small', 'medium', 'large'], DIFFS = ['easy', 'average', 'hard'];

if (!isMainThread) {
  let MOO = null, Sim = null, key = null;
  L.serve((job, data) => {
    const k = JSON.stringify([data.set, data.drop]);
    if (!MOO || key !== k) {
      MOO = L.loadSim(data.set || {}); Sim = MOO.Sim; key = k;
      if (data.drop && data.drop.length) dropTechs(MOO, data.drop);
      // battle telemetry per empire: battles fought, won, ships lost (the sim's own results, counted as they are applied)
      const orig = Sim.Combat.applyResults;
      Sim.Combat.applyResults = function (S, results) {
        const B = S.labBattles;
        if (B) for (const r of results || []) for (const sd of r.sides || []) { if (!(sd.empire >= 0) || !B[sd.empire]) continue; const o = B[sd.empire]; o.n++; if (r.winnerEmpire === sd.empire) o.won++; o.lost += (sd.lost || []).reduce((a, b) => a + (b | 0), 0); if (r.attacker === sd.empire) o.att++; }
        return orig.apply(this, arguments);
      };
    }
    const T = MOO.Data.Techs;
    const S = Sim.newGame(L.settings({ seed: 'league-' + job.g, size: data.size || SIZES[job.g % 3], difficulty: DIFFS[Math.floor(job.g / 3) % 3], opponents: 2 + (job.g % 4), race: L.RACES[job.g % 10], playOn: false }, job.pool));
    S.xstats = {}; S.labBattles = S.empires.map(() => ({ n: 0, won: 0, lost: 0, att: 0 }));
    const out = { g: job.g, pool: job.pool, snaps: [], over: null, xstats: null, trees: null, done: null };
    if (job.pool !== 'classic') out.trees = S.empires.map(E => { const ids = []; E.research.list.forEach((tiers, f) => tiers.forEach(tr => tr.forEach(l => { const t = T.byFL[f][l]; if (t.pool === 'x') ids.push(t.id); }))); return ids; });
    const doneAt = S.empires.map(() => ({}));
    for (let t = 1; t <= data.turns; t++) {
      Sim.autoTurn(S);
      for (const E of S.empires) for (let f = 0; f < 6; f++) for (const l of E.research.completed[f]) { const x = T.byFL[f][l]; if (x && x.pool === 'x' && doneAt[E.id][x.id] === undefined) doneAt[E.id][x.id] = S.turn; }
      if (SNAP.indexOf(S.turn) >= 0) {
        const st = Sim.stats(S);
        out.snaps.push({ turn: S.turn, e: st.map(x => ({ id: x.id, race: x.race, alive: x.alive, colonies: x.colonies, pop: x.pop, production: x.production, research: x.research, techs: x.techs,
          ships: x.ships, factories: x.factories, bc: x.bc, score: x.score, tl: S.empires[x.id].research.tl.reduce((a, b) => a + b, 0) })) });
      }
      const ov = Sim.isOver(S); if (ov.over) { out.over = { turn: S.turn, reason: ov.reason, winner: ov.winner, race: ov.winner >= 0 ? S.empires[ov.winner].race : null }; break; }
    }
    out.turnEnd = S.turn; out.xstats = S.xstats; out.done = doneAt; out.races = S.empires.map(E => E.race);
    const log = (S.diplo && S.diplo.log) || [];
    out.wars = S.diplo && S.diplo.log ? log.filter(x => x.k === 'war' || x.k === 'startWar').length : null;
    out.diplo = {}; out.warWhy = {}; for (const x of log) { out.diplo[x.k] = (out.diplo[x.k] || 0) + 1; if (x.k === 'war') out.warWhy[x.x || '?'] = (out.warWhy[x.x || '?'] || 0) + 1; }
    out.warsBy = S.empires.map(E => log.filter(x => x.k === 'war' && x.a === E.id).length);
    out.warsOn = S.empires.map(E => log.filter(x => x.k === 'war' && x.b === E.id).length);
    out.battles = S.labBattles; delete S.labBattles;
    return out;
  });
}

// remove expansion techs from the pool in this process (the cull): drop their levels from the expanded research table and the swap candidates
function dropTechs(MOO, ids) {
  const X = MOO.Data.Techs.X;
  for (const id of ids) {
    const t = MOO.Data.Techs.byId[id]; if (!t || t.pool !== 'x') throw new Error('not an expansion tech: ' + id);
    const bt = X.byTier[t.field][t.tier - 1], i = bt.indexOf(t.level); if (i >= 0) bt.splice(i, 1);
    const rt = X.researchTable[t.field][t.tier - 1], j = rt.indexOf(t.level); if (j >= 0) rt.splice(j, 1);
  }
}
exports.dropTechs = dropTechs;

if (isMainThread) (async () => {
  const games = +L.arg('games', 240), first = +L.arg('first', 0), threads = +L.arg('threads', 4), turns = +L.arg('turns', 200), file = L.arg('out', 'league.json');
  const set = {}; for (const kv of (L.arg('set') || '').split(',').filter(Boolean)) { const i = kv.indexOf('='); set[kv.slice(0, i)] = JSON.parse(kv.slice(i + 1)); }
  const drop = L.arg('drop') ? L.arg('drop').split(',').filter(Boolean) : [];
  const pools = (L.arg('pools', 'classic,expanded')).split(',');
  const jobs = []; for (let g = first; g < first + games; g++) for (const pool of pools) jobs.push({ g, pool });
  const t0 = Date.now();
  const size = L.arg('size') || null;
  const res = await L.runPool(__filename, jobs, { threads, data: { turns, set, drop, size }, onResult: L.progress('league') });
  const errs = res.filter(r => r && r.error); if (errs.length) console.log('errors', errs.length, errs[0].error.slice(0, 600));
  L.writeJSON(file, { at: new Date().toISOString(), games, turns, set, drop, pools, results: res.filter(r => r && !r.error) });
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's →', L.OUT + '/' + file);
})().catch(e => { console.error(e); process.exit(1); });
