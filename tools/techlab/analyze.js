'use strict';
// Tech Lab · analysis of twin trials (tools/techlab/twins.js output). For each subject: the paired difference treatment − control of the subject empire,
// as log ratios (ln(1+x) differences ≈ percent changes), for production, population, fleet (hull-weighted ships), tech level sum, planets, and the
// composite EPI (lib.js: 0.4 prod + 0.25 pop + 0.2 fleet + 0.15 TL). Trimmed means (10 % each side) resist the occasional runaway twin.
// Each candidate is placed in the distribution of the CLASSIC techs of similar level (±6 levels): its percentile there is its "power rank".
//   node tools/techlab/analyze.js [--in twins.json[,more.json]] [--replace rerun.json[,…]] [--out analysis.json] [--h 50]
// --replace: files that RE-RAN some subjects on the same base games (e.g. after a harness fix). Their trials replace every other file's trials of the
// same subjects, and their placebo pairs (the same games again) are not counted twice. Trials of ids the current data no longer has (cut candidates,
// a candidate moved to another level) are skipped and counted.
const L = require('./lib');
const fs = require('fs');

const KEYS = ['epi', 'prod', 'pop', 'fleet', 'tl', 'planets'];
const d = (a, b) => Math.log1p(b) - Math.log1p(a);
function deltas(ctrl, treat) {
  const out = {};
  for (const k of ['prod', 'pop', 'fleet', 'tl', 'planets']) out[k] = d(ctrl[k], treat[k]);
  out.epi = L.epi(treat) - L.epi(ctrl);
  return out;
}

function analyze(files, opts) {
  opts = opts || {};
  const H = opts.h || 50, replace = opts.replace || [];
  files = files.concat(replace.filter(f => files.indexOf(f) < 0));
  const runs = files.map(f => L.readJSON(f));
  const offsets = runs[0].offsets, hi = offsets.indexOf(H), h25 = offsets.indexOf(25), h10 = offsets.indexOf(10);
  const MOO = L.loadSim(), T = MOO.Data.Techs;
  const trials = {}, placebo = [[], [], []], skipped = {};
  const redone = new Set();
  runs.forEach((run, i) => { if (replace.indexOf(files[i]) >= 0) for (const r of run.results) for (const s of r.subjects) redone.add(s.id); });
  runs.forEach((run, fi) => { const isRe = replace.indexOf(files[fi]) >= 0; for (const r of run.results) {
    for (const s of r.subjects) {
      const tt = T.byId[s.id];
      if (!tt) { skipped[s.id] = (skipped[s.id] || 0) + 1; continue; }                // no longer in the data
      if (!isRe && redone.has(s.id)) continue;                                          // superseded by a re-run
      if (s.race === undefined && tt.never && opts.strict) continue;                 // round-1 records lack the race: optionally drop never-techs' trials
      if (s.race !== undefined && tt.never && tt.never.indexOf(s.race) >= 0) continue;  // a race that can never use the tech
      (trials[s.id] = trials[s.id] || []).push(s);
    }
    if (!isRe) for (const p of r.placebo) placebo[p.band].push(p);
  } });
  const statOf = arr => {
    const o = { n: arr.length };
    for (const k of KEYS) {
      const v = arr.map(x => x[k]);
      o[k] = L.trimmed(v, 0.1);
    }
    o.epiSE = L.se(arr.map(x => x.epi));
    o.ci = L.bootCI(arr.map(x => x.epi), a => L.trimmed(a, 0.1), 800);
    return o;
  };
  // placebo: the noise floor per band and offset
  const noise = placebo.map(arr => offsets.map((h, i) => { const v = arr.map(p => deltas(p.ctrl[i], p.treat[i]).epi); return { n: v.length, sd: L.sd(v), mean: L.mean(v), trimmed: L.trimmed(v, 0.1) }; }));
  const subj = {};
  for (const id in trials) {
    const t = T.byId[id], arr = trials[id];
    const at = i => statOf(arr.map(s => deltas(s.ctrl[i], s.treat[i])));
    // activity: share of trials in which the tech changed anything by the last offset (with the effects-off control an idle tech leaves both copies identical)
    const same = (a, b) => ['prod', 'pop', 'fleet', 'tl', 'planets', 'bc', 'techs'].every(k => a[k] === b[k]);
    const active = arr.filter(s => !same(s.ctrl[hi], s.treat[hi])).length / Math.max(1, arr.length);
    subj[id] = { id, name: t.name, field: t.field, level: t.level, x: t.pool === 'x', band: arr[0].band, tags: t.tags || [], active, h10: at(h10), h25: at(h25), h50: at(hi) };
  }
  // reference bands: classic subjects within ±6 levels
  const classic = Object.values(subj).filter(s => !s.x);
  for (const s of Object.values(subj)) {
    const ref = classic.filter(c => c.id !== s.id && Math.abs(c.level - s.level) <= 6);
    const vals = ref.map(c => c.h50.epi).sort((a, b) => a - b), v25 = ref.map(c => c.h25.epi).sort((a, b) => a - b);
    const pct = (arr, v) => arr.length ? arr.filter(x => x < v).length / arr.length : NaN;
    s.ref = { n: ref.length, p25: L.quantile(vals, 0.25), median: L.median(vals), p75: L.quantile(vals, 0.75), p90: L.quantile(vals, 0.9), max: vals[vals.length - 1], min: vals[0] };
    s.rank50 = pct(vals, s.h50.epi); s.rank25 = pct(v25, s.h25.epi);
    s.rank = (s.rank50 + s.rank25) / 2;
    const nz = noise[s.band][hi].sd / Math.sqrt(Math.max(1, s.h50.n));
    s.sig = s.h50.ci[0] > 0 ? 1 : s.h50.ci[1] < 0 ? -1 : 0;
    // verdicts against the classic techs of similar level: outside their whole range (the CI clear of the strongest / weakest classic tech) is an outlier the
    // classic game has no match for; otherwise the quarter of the classic band it ranks in. 'situational': the tech changed nothing in half the trials or more.
    s.verdict = s.h50.ci[0] > s.ref.max ? 'above range' : s.h50.ci[1] < s.ref.min ? 'below range' : s.rank >= 0.75 ? 'strong' : s.rank >= 0.25 ? 'typical' : 'low';
    s.situational = s.active < 0.5;
    s.noise = nz;
  }
  return { files, replace, h: H, noise, skipped, subjects: subj };
}
exports.analyze = analyze;

if (require.main === module) {
  const files = (L.arg('in', 'twins.json')).split(','), out = L.arg('out', 'analysis.json');
  const A = analyze(files, { h: +L.arg('h', 50), replace: L.arg('replace') ? L.arg('replace').split(',') : [] });
  if (Object.keys(A.skipped).length) console.log('skipped (no longer in the data):', Object.keys(A.skipped).map(k => k + ' ×' + A.skipped[k]).join(', '));
  L.writeJSON(out, A);
  const pct = L.fmtPct;
  console.log('noise floor (placebo SD of EPI at +10/+25/+50):', A.noise.map((b, i) => 'band ' + i + ': ' + b.map(x => (100 * x.sd).toFixed(1) + '%').join('/') + ' (n=' + b[0].n + ')').join('  '));
  const xs = Object.values(A.subjects).filter(s => s.x).sort((a, b) => b.rank - a.rank || b.h50.epi - a.h50.epi);
  console.log(L.table(['tech', 'lv', 'n', 'active', 'EPI +25', 'EPI +50', '95% CI', 'prod', 'pop', 'fleet', 'TL', 'classic band p25/med/p75', 'rank', 'verdict'],
    xs.map(s => [s.name, s.level, s.h50.n, (100 * s.active).toFixed(0) + '%' + (s.situational ? ' (situational)' : ''), pct(s.h25.epi), pct(s.h50.epi), s.h50.ci.map(v => pct(v)).join('…'), pct(s.h50.prod), pct(s.h50.pop), pct(s.h50.fleet), pct(s.h50.tl),
      [s.ref.p25, s.ref.median, s.ref.p75].map(v => pct(v)).join(' / '), (100 * s.rank).toFixed(0), s.verdict])));
  const cs = Object.values(A.subjects).filter(s => !s.x).sort((a, b) => b.h50.epi - a.h50.epi);
  console.log('\nclassic top 12:', cs.slice(0, 12).map(s => s.name + ' ' + pct(s.h50.epi)).join(', '));
  console.log('classic bottom 8:', cs.slice(-8).map(s => s.name + ' ' + pct(s.h50.epi)).join(', '));
}
