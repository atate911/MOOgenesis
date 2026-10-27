'use strict';
// Tech Lab · league analysis (tools/techlab/league.js output): paired classic-vs-expanded comparison per seed, the difficulty ladder, race signatures,
// game endings, and per expansion tech: dealt %, researched % (of those dealt), median turn, intent-to-treat effect on the empire's standing.
//   node tools/techlab/league-analyze.js [--in league.json] [--out league-analysis.json]
const L = require('./lib');
const SNAP_KEYS = ['techs', 'tl', 'production', 'pop', 'colonies', 'ships', 'research', 'factories'];

function analyze(file) {
  const D = L.readJSON(file), by = {};
  for (const r of D.results) (by[r.g] = by[r.g] || {})[r.pool] = r;
  const pairs = Object.values(by).filter(p => p.classic && p.expanded);
  const snapOf = (r, T) => r.snaps.find(s => s.turn === T) || null;
  const gameMean = (r, T, k) => { const s = snapOf(r, T); if (!s) return null; const a = s.e.filter(e => e.alive); return a.length ? L.mean(a.map(e => e[k])) : null; };
  const out = { file, games: pairs.length, turns: D.turns, drop: D.drop || [], paired: {}, byDiff: {}, races: {}, endings: {}, techs: {}, xstats: {} };
  // paired relative differences of game means, as the geometric mean of the per-seed ratios (exp of the mean log ratio): the plain mean of ratios is biased
  // upward by about the squared spread of chaotic games (two unrelated games of equal strength would read several percent "better")
  for (const T of [50, 100, 150, 200]) for (const k of SNAP_KEYS) {
    const lr = [], base = [];
    for (const p of pairs) { const a = gameMean(p.classic, T, k), b = gameMean(p.expanded, T, k); if (a === null || b === null || !(a > 0) || !(b > 0)) continue; lr.push(Math.log(b / a)); base.push(a); }
    if (lr.length < 5) continue;
    out.paired[k + '@' + T] = { n: lr.length, classicMean: L.mean(base), rel: Math.exp(L.mean(lr)) - 1, relTrim: Math.exp(L.trimmed(lr, 0.1)) - 1, ci: L.bootCI(lr, L.mean, 1000).map(v => Math.exp(v) - 1), sdLog: L.sd(lr) };
  }
  // game length (turn the game ended, or the cap) and wars declared, paired by seed
  const pd = f => { const d = pairs.map(p => f(p.expanded) - f(p.classic)).filter(Number.isFinite); return { n: d.length, classic: L.mean(pairs.map(p => f(p.classic))), expanded: L.mean(pairs.map(p => f(p.expanded))), diff: L.mean(d), ci: L.bootCI(d, L.mean, 1000) }; };
  out.length = pd(r => r.turnEnd);
  if (pairs.every(p => p.classic.wars !== null && p.expanded.wars !== null)) out.wars = pd(r => r.wars);
  // game endings and length (conquest / council before the turn cap)
  for (const pool of ['classic', 'expanded']) {
    const rs = pairs.map(p => p[pool]);
    const ended = rs.filter(r => r.over);
    out.endings[pool] = { ended: ended.length, of: rs.length, medianEnd: L.median(ended.map(r => r.over.turn)), reasons: count(ended.map(r => r.over.reason)), winners: count(ended.map(r => r.over.race)) };
    // difficulty ladder (games rotate easy / average / hard by g)
    for (const r of rs) {
      const diff = ['easy', 'average', 'hard'][Math.floor(r.g / 3) % 3];
      const s = snapOf(r, 100); if (!s) continue;
      const k = pool + ':' + diff; const o = out.byDiff[k] || (out.byDiff[k] = { techs: [], production: [] });
      const a = s.e.filter(e => e.alive); o.techs.push(L.mean(a.map(e => e.techs))); o.production.push(L.mean(a.map(e => e.production)));
    }
    // race signatures at T100: each empire's production and techs relative to its game's mean
    for (const r of rs) {
      const s = snapOf(r, 100); if (!s) continue;
      const a = s.e.filter(e => e.alive), mp = L.mean(a.map(e => e.production)) || 1, mt = L.mean(a.map(e => e.techs)) || 1;
      for (const e of a) { const k = pool + ':' + e.race; const o = out.races[k] || (out.races[k] = { prod: [], techs: [] }); o.prod.push(e.production / mp); o.techs.push(e.techs / mt); }
    }
  }
  for (const k in out.byDiff) { const o = out.byDiff[k]; out.byDiff[k] = { n: o.techs.length, techs: L.mean(o.techs), production: L.mean(o.production) }; }
  for (const k in out.races) { const o = out.races[k]; out.races[k] = { n: o.prod.length, prod: L.mean(o.prod), techs: L.mean(o.techs) }; }
  // expansion techs: dealt / researched / ITT
  const MOO = L.loadSim(), T = MOO.Data.Techs;
  for (const x of T.X.list) out.techs[x.id] = { name: x.name, level: x.level, dealt: 0, of: 0, researched: 0, turns: [], itt: { with: [], without: [] } };
  for (const p of pairs) {
    const r = p.expanded; if (!r.trees) continue;
    const s = snapOf(r, 150) || r.snaps[r.snaps.length - 1]; if (!s) continue;
    const alive = s.e.filter(e => e.alive), ms = L.mean(alive.map(e => e.score)) || 1;
    r.trees.forEach((ids, e) => {
      const set = new Set(ids), se = s.e[e], stand = se && se.alive ? se.score / ms : 0;
      for (const id in out.techs) {
        const o = out.techs[id]; o.of++;
        if (set.has(id)) { o.dealt++; (o.itt.with).push(stand); const turn = r.done[e] && r.done[e][id]; if (turn !== undefined) { o.researched++; o.turns.push(turn); } }
        else o.itt.without.push(stand);
      }
    });
    for (const k in r.xstats || {}) { const o = out.xstats[k] || (out.xstats[k] = { n: 0, sum: 0, games: 0 }); o.n += r.xstats[k].n; o.sum += r.xstats[k].sum; o.games++; }
  }
  for (const id in out.techs) {
    const o = out.techs[id], w = o.itt.with, wo = o.itt.without;
    o.dealtPct = o.of ? o.dealt / o.of : 0; o.researchedPct = o.dealt ? o.researched / o.dealt : 0; o.medianTurn = L.median(o.turns);
    o.itt = { diff: L.mean(w) - L.mean(wo), n: w.length, ci: diffCI(w, wo) };
    delete o.turns;
  }
  return out;
}
function count(a) { const o = {}; for (const x of a) o[x] = (o[x] || 0) + 1; return o; }
function diffCI(a, b) {
  if (a.length < 5 || b.length < 5) return [NaN, NaN];
  let x = 99; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296), res = [];
  for (let k = 0; k < 600; k++) { let sa = 0, sb = 0; for (let i = 0; i < a.length; i++) sa += a[Math.floor(rnd() * a.length)]; for (let i = 0; i < b.length; i++) sb += b[Math.floor(rnd() * b.length)]; res.push(sa / a.length - sb / b.length); }
  res.sort((p, q) => p - q); return [res[15], res[584]];
}
exports.analyze = analyze;

if (require.main === module) {
  const A = analyze(L.arg('in', 'league.json'));
  L.writeJSON(L.arg('out', 'league-analysis.json'), A);
  const pct = L.fmtPct;
  console.log('paired games:', A.games, ' dropped from pool:', A.drop.length);
  console.log(L.table(['metric', 'n', 'classic mean', 'expanded vs classic', '95% CI'], Object.keys(A.paired).map(k => { const o = A.paired[k]; return [k, o.n, o.classicMean.toFixed(1), pct(o.rel), o.ci.map(v => pct(v)).join('…')]; })));
  console.log('\ngame length (turns):', JSON.stringify(A.length), A.wars ? '\nwars per game: ' + JSON.stringify(A.wars) : '');
  console.log('\nendings:', JSON.stringify(A.endings));
  console.log('\nladder (T100 techs / production):', Object.keys(A.byDiff).sort().map(k => k + ' ' + A.byDiff[k].techs.toFixed(1) + '/' + A.byDiff[k].production.toFixed(0)).join('  '));
  console.log('\nraces (T100 prod ratio):', Object.keys(A.races).sort().map(k => k + ' ' + A.races[k].prod.toFixed(2)).join('  '));
  const ts = Object.values(A.techs).sort((a, b) => b.itt.diff - a.itt.diff);
  console.log('\n' + L.table(['tech', 'lv', 'dealt', 'researched', 'median turn', 'ITT standing', 'CI'], ts.map(o => [o.name, o.level, (100 * o.dealtPct).toFixed(0) + '%', (100 * o.researchedPct).toFixed(0) + '%', o.medianTurn || '-', o.itt.diff.toFixed(3), o.itt.ci.map(v => v.toFixed(3)).join('…')])));
  console.log('\nhook firings per game:', Object.entries(A.xstats).map(([k, v]) => k + ' ' + (v.n / A.games).toFixed(1) + 'x / ' + Math.round(v.sum / A.games)).join(' | '));
}
