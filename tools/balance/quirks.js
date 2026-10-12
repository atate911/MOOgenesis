'use strict';
// Check: A/B every AI / sim quirk flag against the current defaults (same seeds), through MOO_OVERRIDES in tools/soak-worker.js.
//   node tools/balance/quirks.js [--games 96] [--only name1,name2] [--difficulty average]
const L = require('./lib');
const games = L.arg('games', '96'), diff = L.arg('difficulty', 'average'), only = (L.arg('only', '') || '').split(',').filter(Boolean);
const H = require(L.ROOT + '/tools/headless.js'), MOO = H.load({ quiet: true });
const flags = [];
for (const k of Object.keys(MOO.AI.QUIRKS)) flags.push(['AI.QUIRKS.' + k, MOO.AI.QUIRKS[k]]);
for (const k of Object.keys(MOO.Data.Config.QUIRKS)) flags.push(['Data.Config.QUIRKS.' + k, MOO.Data.Config.QUIRKS[k]]);
const base = ['--difficulty', diff, '--games', games, '--seed', '700', '--turns', '150', '--stats-at', '50,100,150', '--threads', '4'];
function summarize(j) {
  const G = j.games, F = G.filter(g => g.finished), at = (T, m) => { const v = []; for (const g of G) { const s = (g.snaps || []).find(x => x.turn === T); if (s) for (const e of s.e) if (e.alive) v.push(e[m]); } return L.median(v); };
  const wars = [], stuck = j.aggregates.warnings ? 0 : 0;
  return { fin: F.length, end: L.median(F.map(g => g.endTurn)), col100: at(100, 'colonies'), prod100: at(100, 'production'), rp100: at(100, 'research'), tech100: at(100, 'techs'), ships100: at(100, 'ships'), tech150: at(150, 'techs'),
    ccap: j.aggregates.capped, council: F.filter(g => g.reason === 'council').length, conq: F.filter(g => g.reason !== 'council').length, errs: (j.aggregates.exceptions || 0) + (j.aggregates.crashes || 0) };
}
const rows = []; const run = (label, ov) => {
  process.env.MOO_OVERRIDES = JSON.stringify(ov);
  const s = summarize(L.soak(base, 'q-' + label.replace(/\W/g, '_')));
  rows.push([label, s.fin, s.end, s.col100, s.prod100, s.rp100, s.tech100, s.ships100, s.tech150, s.council, s.conq, s.errs]);
  console.error('done', label);
};
run('BASELINE (defaults)', {});
for (const [path, def] of flags) { if (only.length && !only.some(o => path.endsWith(o))) continue; if (typeof def !== 'boolean') continue; run(path.replace('Data.Config.', '') + '=' + !def, { [path]: !def }); }
if (!only.length) { process.env.MOO_OVERRIDES = ''; const s = summarize(L.soak(base.concat(['--opt', 'aiClassic=true']), 'q-classic')); rows.push(['options.aiClassic=true', s.fin, s.end, s.col100, s.prod100, s.rp100, s.tech100, s.ships100, s.tech150, s.council, s.conq, s.errs]); }
console.log(L.table(['variant', 'finished', 'median end', 'col T100', 'prod T100', 'RP T100', 'techs T100', 'ships T100', 'techs T150', 'council', 'conquest/other', 'errors'], rows));
