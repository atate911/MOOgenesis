'use strict';
// Tech Lab · combat calibration. AI-vs-AI battles are settled by the original's weight model (sim/combat.js resolveWeights), which knows nothing of the
// expansion's combat effects; sim/xtech.js gives each effect a weight bonus. This script measures what those bonuses SHOULD be with the tactical engine:
//   1. collect real AI battles (snapshots from findBattles) from expanded games;
//   2. rescale the subject side so the tactical fight is close to even (its win rate ≈ 50 %);
//   3. fight it out many times with the effect, and with the subject's ships scaled by k ∈ {0.8 … 1.5} without it;
//   4. the effect is "worth k* ships", where the win-rate curve P(k) crosses the win rate with the effect. The weight model is linear in ship count,
//      so k* − 1 is the weight bonus (per design it applies to: shields for absorption, missiles for warheads …).
//   node tools/techlab/combat.js [--games 24] [--runs 30] [--threads 4] [--out combat.json]
const L = require('./lib');
const { isMainThread } = require('worker_threads');

const SHIP_EFFECTS = {
  comp1: { comp: 1 }, comp2: { comp: 2 }, mdef2: { mdef: 2 }, absorb1: { absorb: 1 }, absorb2: { absorb: 2 }, mis20: { misshield: 20 }, thrust: { speed: 1, init: 2 },
  warhead25: { warhead: 25 },
};
const PLANET_EFFECTS = { baseComp2: { baseComp: 2 }, baseHp50: { baseHpPct: 50 }, mines8: { mines: 8 } };
// round 1 also measured def1, hp15, repair5 and pshield5 for candidates cut in round 2 (combat-r1.json keeps them); the sim no longer applies those keys.
const SCALES = [0.8, 0.9, 1.1, 1.25, 1.5];
const xmOf = fx => Object.assign({ comp: 0, mdef: 0, absorb: 0, misshield: 0, speed: 0, init: 0, warhead: 0, mines: 0, baseComp: 0, baseHpPct: 0 }, fx);

// ---- worker ------------------------------------------------------------------------------------------------------------------------------------------------
if (!isMainThread) {
  const MOO = L.loadSim(), Sim = MOO.Sim, Cb = Sim.Combat;
  const shipsOf = s => s.ships.reduce((a, b) => a + b, 0);
  L.serve(job => {
    if (job.kind === 'collect') {
      const got = [], orig = Cb.findBattles;
      Cb.findBattles = function (S, R) {
        const bs = orig.call(this, S, R);
        if (S.turn >= 50 && S.turn % 4 === job.phase) for (const b of bs) {
          if (b.sides.some(s => s.empire < 0)) continue;
          const sh = b.sides.map(shipsOf);
          if (sh[0] + sh[1] < 6) continue;
          if (!b.sides.some((s, i) => sh[i] >= 4)) continue;
          const c = JSON.parse(JSON.stringify(b)); for (const s of c.sides) delete s.xm; c.human = false;
          got.push(c);
        }
        return bs;
      };
      try {
        const S = Sim.newGame(L.settings({ seed: 'cal-' + job.g, size: job.g % 2 ? 'large' : 'medium', opponents: 3 + (job.g % 3), race: L.RACES[job.g % 10] }, 'expanded'));
        L.playTo(Sim, S, 220);
      } finally { Cb.findBattles = orig; }
      // keep a spread: at most 12 per game, evenly over the game
      const step = Math.max(1, Math.floor(got.length / 12)), out = [];
      for (let i = 0; i < got.length && out.length < 12; i += step) out.push(got[i]);
      return out;
    }
    // measure one snapshot: subject side i
    const b0 = job.battle, i = job.side, K = job.runs, planetSub = job.planet;
    const scaled = (b, k) => {
      const c = JSON.parse(JSON.stringify(b));
      if (planetSub) c.planet.bases = Math.max(1, Math.round(c.planet.bases * k));
      else c.sides[i].ships = c.sides[i].ships.map(n => (n > 0 ? Math.max(1, Math.round(n * k)) : 0));
      return c;
    };
    const winRate = (b, tag) => {
      let w = 0;
      for (let r = 0; r < K; r++) { const res = Cb.resolve(b, MOO.RNG.create(tag + ':' + r), { full: true }); if (res.winner === i) w++; }
      return w / K;
    };
    // 1. balance: find k0 with P ≈ 0.5 (coarse, then refine once)
    const probe = [0.4, 0.6, 0.8, 1, 1.25, 1.6, 2.2, 3];
    let pts = probe.map(k => ({ k, p: winRate(scaled(b0, k), 'bal' + k) }));
    let k0 = null;
    for (let j = 1; j < pts.length; j++) if (pts[j - 1].p <= 0.5 && pts[j].p >= 0.5) { const a = pts[j - 1], c = pts[j]; k0 = c.p === a.p ? a.k : a.k + (0.5 - a.p) * (c.k - a.k) / (c.p - a.p); break; }
    if (k0 === null) return { skip: 'unbalanceable', pts };
    const base = scaled(b0, k0);
    const p0 = winRate(base, 'p0');
    const curve = [{ k: 1, p: p0 }].concat(SCALES.map(k => ({ k, p: winRate(scaled(base, k), 'k' + k) }))).sort((a, c) => a.k - c.k);
    for (let j = 1; j < curve.length; j++) if (curve[j].p < curve[j - 1].p) curve[j].p = curve[j - 1].p;      // isotonic: more ships never hurt
    const effects = planetSub ? PLANET_EFFECTS : SHIP_EFFECTS, out = {};
    for (const name in effects) {
      const b = JSON.parse(JSON.stringify(base));
      const pe = winRate(Object.assign(b, { sides: b.sides.map((s, j) => (j === i ? Object.assign({}, s, { xm: xmOf(effects[name]) }) : s)) }), 'e' + name);
      const pb = p0;
      // k*: where the curve reaches pe (relative to the condition's own baseline pb)
      const target = pe - pb + p0;
      let ks = null;
      if (target <= curve[0].p) ks = curve[0].k;
      else if (target >= curve[curve.length - 1].p) ks = curve[curve.length - 1].k + 0.0001;          // beyond the range: censored
      else for (let j = 1; j < curve.length; j++) if (curve[j].p >= target) { const a = curve[j - 1], c = curve[j]; ks = c.p === a.p ? a.k : a.k + (target - a.p) * (c.k - a.k) / (c.p - a.p); break; }
      // share of the subject's weight the effect can act on (design-conditional effects)
      let share = 1;
      if (!planetSub) {
        const s = base.sides[i]; let tot = 0, hit = 0;
        for (let k = 0; k < 6; k++) {
          const ss = s.designs[k], n = s.ships[k]; if (!ss || !n) continue;
          const w = n * (ss.hullW || 1); tot += w;
          const on = name.startsWith('absorb') ? ss.absorb > 0 : name === 'warhead25' ? ss.weapons.some(x => x.kind === 'missile' || x.kind === 'torpedo')
            : name === 'mis20' ? ss.misshield < 20 : true;
          if (on) hit += w;
        }
        share = tot ? hit / tot : 0;
      }
      out[name] = { pe, pb, ks, share };
    }
    return { k0, p0, curve, out, ships: shipsOf(base.sides[i]), turn: job.turn };
  });
}

// ---- main ------------------------------------------------------------------------------------------------------------------------------------------------
if (isMainThread) (async () => {
  const games = +L.arg('games', 24), runs = +L.arg('runs', 30), threads = +L.arg('threads', 4), file = L.arg('out', 'combat.json');
  const t0 = Date.now();
  const coll = await L.runPool(__filename, Array.from({ length: games }, (_, g) => ({ kind: 'collect', g, phase: g % 4 })), { threads, onResult: L.progress('collect') });
  const battles = [].concat(...coll.filter(Array.isArray));
  console.log('battle snapshots', battles.length);
  const jobs = [];
  battles.forEach((b, bi) => {
    const sh = b.sides.map(s => s.ships.reduce((a, c) => a + c, 0));
    for (let i = 0; i < 2; i++) if (sh[i] >= 4) jobs.push({ kind: 'measure', battle: b, side: i, runs, planet: false, id: bi + ':' + i });
    if (b.planet && b.planetSide >= 0 && (b.planet.bases | 0) >= 3) jobs.push({ kind: 'measure', battle: b, side: b.planetSide, runs, planet: true, id: bi + ':P' });
  });
  console.log('measurements', jobs.length);
  const res = await L.runPool(__filename, jobs, { threads, onResult: L.progress('measure') });
  const rows = res.map((r, j) => Object.assign({ id: jobs[j].id, planet: jobs[j].planet }, r)).filter(r => !r.skip && !r.error);
  const errors = res.filter(r => r && r.error); if (errors.length) console.log('errors', errors.length, errors[0].error.slice(0, 400));
  // summarise: per effect, median k* (censored values count at the edge), and the per-design weight percent (k* − 1)/share
  const summary = {};
  for (const name of Object.keys(SHIP_EFFECTS).concat(Object.keys(PLANET_EFFECTS))) {
    const ks = [], per = [], dp = [];
    for (const r of rows) {
      const o = r.out && r.out[name]; if (!o || o.ks === null) continue;
      ks.push(o.ks); dp.push(o.pe - o.pb);
      if (o.share >= 0.3) per.push((o.ks - 1) / o.share);
    }
    summary[name] = { n: ks.length, kMedian: L.median(ks), kMean: L.trimmed(ks, 0.15), perDesignPct: 100 * L.trimmed(per, 0.15), winShift: L.mean(dp), ci: L.bootCI(per, a => L.trimmed(a, 0.15), 600).map(v => 100 * v) };
  }
  L.writeJSON(file, { at: new Date().toISOString(), games, runs, snapshots: battles.length, rows, summary });
  console.log(L.table(['effect', 'n', 'win-rate shift', 'worth (ships ×)', 'weight % per design', '95% CI'], Object.keys(summary).map(k => {
    const s = summary[k]; return [k, s.n, L.fmtPct(s.winShift), s.kMean.toFixed(3), s.perDesignPct.toFixed(1), s.ci.map(v => v.toFixed(1)).join('…')];
  })));
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's →', L.OUT + '/' + file);
})().catch(e => { console.error(e); process.exit(1); });
