// Tech Lab · writes tools/out/techlab/rounds.json for report.js: summary, per-tech notes, and the sections only the rounds know (cuts, moves, ablations, caveats)
//   node tools/techlab/rounds.js   (needs analysis-r2.json, league-rep.json and the ablation runs in tools/out/techlab; decisions: tools/techlab/decisions.json)
const L = require('./lib');
const path = require('path'), fs = require('fs');
const MOO = L.loadSim(), T = MOO.Data.Techs;
const dec = JSON.parse(fs.readFileSync(path.join(__dirname, 'decisions.json'), 'utf8')), A2 = L.readJSON('analysis-r2.json');
const pct = L.fmtPct;
const notes = {};
for (const id in dec.moved) notes[id] = 'moved from level ' + dec.moved[id].from;
notes['pr-44-slipstream-drives'] = 'retuned in round 3';
const cutRows = Object.keys(dec.cut).map(id => { const s = A2.subjects[id]; return [s.name, T.FIELD_NAMES[s.field] + ' ' + s.level, (100 * s.active).toFixed(0) + ' %', pct(s.h50.epi), s.h50.ci.map(v => pct(v)).join(' … '), dec.cut[id]]; });
// ablations: battle rate per 100 turns vs the classic games of the replication seeds
const C = {}; for (const r of L.readJSON('league-rep.json').results) if (r.pool === 'classic') C[r.g] = r;
const sb = r => (r.battles || []).reduce((a, b) => a + (b.n | 0), 0);
const ab = (label, f) => { const X = L.readJSON(f).results.filter(r => r.pool === 'expanded' && C[r.g]); const v = X.map(x => 100 * (sb(x) / x.turnEnd - sb(C[x.g]) / C[x.g].turnEnd)); const ci = L.bootCI(v, L.mean, 1000); const w = X.map(x => x.wars - C[x.g].wars); return [label, X.length, (L.mean(v) >= 0 ? '+' : '') + L.mean(v).toFixed(1), ci.map(x => x.toFixed(1)).join(' … '), (L.mean(w) >= 0 ? '+' : '') + L.mean(w).toFixed(2)]; };
const ablRows = [ab('full expanded pool', 'league-rep.json'), ab('same trees, every new effect off', 'abl-null-rep.json'), ab('only the combat effects on', 'only-f1.json'), ab('only battle aftermath on (escape, salvage, reverse engineering, lifeboats, stasis)', 'only-f2.json'),
  ab('only reach and invasion on (range, speed, survey, ground)', 'only-f3.json'), ab('only economy, growth, diplomacy on', 'only-f4.json'), ab('only Interstellar Ramscoops on', 'one-interstellar-ramscoops.json'), ab('only Navigation Beacons on', 'one-navigation-beacons.json'),
  ab('only Stellar Survey Probes on', 'one-stellar-survey-probes.json'), ab('only Prefabricated Colony Modules on', 'one-prefabricated-colony-modules.json')];
const classicRate = L.mean(Object.values(C).map(r => 100 * sb(r) / r.turnEnd));
const sections = [
  { title: '4. Round 2: what was cut and why', body: 'Values from round 2 (64 games, effects-off control), on the 60-candidate data.\n\n' + L.table(['tech', 'field', 'active', 'EPI +50', '95 % CI', 'reason'], cutRows) },
  { title: '5. Moves and the retune', body: L.table(['tech', 'change', 'why'], Object.keys(dec.moved).map(id => [T.byId[id].name, T.FIELD_NAMES[T.byId[id].field] + ' ' + dec.moved[id].from + ' → ' + T.byId[id].level, dec.moved[id].why]).concat([['Slipstream Drives', '+1 warp for every fleet → for fleets bound for your own colonies', 'As first designed it hurt AI holders in round 3 (−4.7 % EPI, CI −7.2 … −1.9 %, fleet −22 %); 16 traced games showed fewer battles but a third more ships lost. Re-tested on the round 3 games: −1.3 %, CI −4.9 … +2.2 %.']])) },
  { title: '6. Why AI empires fight more: league ablations', body: 'Battles per 100 turns, expanded game minus its classic twin (seeds 240-719; classic rate ' + classicRate.toFixed(1) + '). Ablations keep the expanded trees and switch effects off with `--set`, so only the effects differ between rows.\n\n' + L.table(['run', 'pairs', 'battles / 100 turns', '95 % CI', 'wars per game'], ablRows) + '\n\nThe extra fighting needs the effects (the same trees with effects off show none) and comes from the reach and the growth families together; no single tech accounts for more than a small part, and the combat effects add none.' },
  { title: '7. Caveats', body: '* Every number here is from AI-only games. Situational techs (minefields, lifeboats, warp damping, salvage, landing craft) can matter more in a player\'s hands than their AI numbers show.\n* In the leagues most games end at the council around turn 125-150, so techs above level ~35 are rarely researched there; their twin trials (granted at turn 120, measured to turn 170) are the evidence for them.\n* The empire power index counts hulls, not their quality: classic ship-component techs read slightly negative (better components make ships pricier), so for combat effects the calibration in section 1 is the fairer measure.\n* Chaotic games make late checkpoints noisy: the first league seed set read ships at turn 200 as −20 %, the replication as +19 %; pooled, +4 % with a CI that spans zero.' },
];
const summary = 'Outcome: 45 of 60 candidates kept (15 cut, 4 moved, 1 retuned). Against classic techs of similar level: 7 strong, 37 typical, 1 low, none outside the classic range. In 719 paired AI games the pace holds (techs researched +1.2 % at turn 100, production +0.6 %, population −0.3 %, colonies +0.2 %); AI empires fight about 22 % more battles per turn and declare about one more war per game.';
L.writeJSON('rounds.json', { summary, decisions: notes, sections });
console.log('rounds.json written; classic battle rate', classicRate.toFixed(1));
