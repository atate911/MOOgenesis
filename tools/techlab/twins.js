'use strict';
// Tech Lab · twin trials. "What is a technology worth?" measured the only clean way a chaotic 4X game allows: copy a game, give ONE empire the tech in one
// copy and not in the other, play both on, compare that empire. Every subject (each expansion candidate and every classic researchable tech, as the
// reference band) is granted in the same base games at the same moment, so the classic techs show what "a normal tech of this level" is worth.
//   base games  medium galaxy, 4 empires, Average, expanded pool (all AI), seeds twin-<g>; checkpoints at turn 40 / 80 / 120
//   subjects    levels 1-15 → granted at turn 40, 16-30 → turn 80, 31-50 → turn 120; the subject empire rotates and never already owns
//               or researches the tech; measured 10 / 25 / 50 turns later against the untouched control copy
//   placebo     the control copy with ONE extra draw from the game's RNG: pure butterfly-effect noise, the yardstick for "no effect"
//   node tools/techlab/twins.js [--games 48] [--threads 4] [--only id,id] [--classic 0] [--out twins.json] [--set path=value,...]
const L = require('./lib');
const { isMainThread } = require('worker_threads');
const OFFSETS = [10, 25, 50];
const CHECKPOINTS = [40, 80, 120];
const bandOf = level => (level <= 15 ? 0 : level <= 30 ? 1 : 2);
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

if (!isMainThread) {
  let MOO = null, Sim = null, setKey = null;
  L.serve((job, data) => {
    const key = JSON.stringify(data.set || {});
    if (!MOO || setKey !== key) { MOO = L.loadSim(data.set || {}); Sim = MOO.Sim; setKey = key; }
    const T = MOO.Data.Techs, g = job.g;
    const S = Sim.newGame(L.settings({ seed: 'twin-' + g, size: 'medium', opponents: 3, race: L.RACES[g % 10] }, 'expanded'));
    const out = { g, subjects: [], placebo: [], ended: [] };
    const run = (S0, mutate, who) => {                         // play a copy on, recording `who` (empire ids) at each offset
      const S1 = L.clone(S0), t0 = S1.turn, rec = {};
      if (mutate) mutate(S1);
      for (const h of OFFSETS) {
        L.playTo(Sim, S1, t0 + h);
        rec[h] = who.map(e => L.metrics(MOO, S1, e));
      }
      return rec;
    };
    for (let c = 0; c < CHECKPOINTS.length; c++) {
      L.playTo(Sim, S, CHECKPOINTS[c]);
      if (Sim.isOver(S).over) { out.ended.push(CHECKPOINTS[c]); break; }
      const alive = S.empires.filter(E => E.alive).map(E => E.id);
      const ctrl = run(S, null, alive);
      const plac = run(S, S1 => { MOO.RNG.bind(S1.rs).next(); }, alive);
      alive.forEach((e, k) => out.placebo.push({ band: c, e, ctrl: OFFSETS.map(h => ctrl[h][k]), treat: OFFSETS.map(h => plac[h][k]) }));
      for (const sub of data.subjects) {
        if (bandOf(sub.level) !== c) continue;
        if (data.only && data.only.indexOf(sub.id) < 0) continue;
        const t = T.byId[sub.id];
        // the subject empire: rotate by game and tech; skip empires that own it or have it as their current project
        let e = -1;
        for (let k = 0; k < alive.length; k++) {
          const cand = alive[(hash(sub.id) + g + k) % alive.length], rs = S.empires[cand].research;
          if (rs.completed[t.field].indexOf(t.level) >= 0 || rs.project[t.field] === t.level) continue;
          if (t.never && t.never.indexOf(S.empires[cand].race) >= 0) continue;          // a tech the race can never use (Silicoids and waste / soil techs)
          e = cand; break;
        }
        if (e < 0) continue;
        const ki = alive.indexOf(e);
        const tr = run(S, S1 => { MOO.Sim.Research.grant(S1, S1.empires[e], t.field, t.level, 'lab'); }, [e]);
        out.subjects.push({ id: sub.id, band: c, e, race: S.empires[e].race, ctrl: OFFSETS.map(h => ctrl[h][ki]), treat: OFFSETS.map(h => tr[h][0]) });
      }
    }
    return out;
  });
}

if (isMainThread) (async () => {
  const games = +L.arg('games', 48), threads = +L.arg('threads', 4), file = L.arg('out', 'twins.json'), first = +L.arg('first', 0);
  const only = L.arg('only') ? L.arg('only').split(',') : null, withClassic = L.arg('classic', '1') !== '0';
  const set = {};
  for (const kv of (L.arg('set') || '').split(',').filter(Boolean)) { const i = kv.indexOf('='); set[kv.slice(0, i)] = JSON.parse(kv.slice(i + 1)); }
  const MOO = L.loadSim(), T = MOO.Data.Techs;
  const subjects = T.X.list.map(t => ({ id: t.id, level: t.level, x: true }));
  if (withClassic) for (const t of T.list) if (!t.free && !t.special && t.level <= 50 && t.type !== 'advanced') subjects.push({ id: t.id, level: t.level, x: false });
  console.log('subjects', subjects.length, 'base games', games, only ? 'only ' + only.length : '', Object.keys(set).length ? 'set ' + JSON.stringify(set) : '');
  const t0 = Date.now();
  const res = await L.runPool(__filename, Array.from({ length: games }, (_, i) => ({ g: first + i })), { threads, data: { subjects, only, set }, onResult: L.progress('twins') });
  const errs = res.filter(r => r && r.error); if (errs.length) { console.log('errors', errs.length, errs[0].error.slice(0, 600)); }
  L.writeJSON(file, { at: new Date().toISOString(), games, first, offsets: OFFSETS, checkpoints: CHECKPOINTS, set, subjects, results: res.filter(r => r && !r.error) });
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's →', L.OUT + '/' + file);
})().catch(e => { console.error(e); process.exit(1); });
