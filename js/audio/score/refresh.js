// The refresh (loaded last): what the main theme taught about sound, applied to every other piece without rewriting it. The notes, forms
// and instruments stay as written; each entry below changes only how a piece is performed and mastered, measured against the theme
// (tools/fresh/sweep.js before and after; README there):
//  - orch: the orchestral profile (held beds and bass, phrase expression, staged dynamics, a clean bass tone with a sine sub) for
//    pieces played by recorded orchestral instruments;
//  - hall: the recorded Musikverein in place of the generated hall (clearer, the parts better separated, a real room);
//  - tone: presence (the 5 kHz shelf) and weight (the 120 Hz shelf), dB; lowBand: the master's low band, dB (the low-band compressor
//    otherwise takes back what a piece adds below 160 Hz); subBass: the sine under a recorded bass (orch only);
//  - verb: the hall ridden down in a piece's climaxes (sections, by name) so the tutti stays clear, as in the theme;
//  - mix: layer balance (the solo about 3 dB over the bed, the choir and strings within 4.5 dB); trim: the level kept where it was.
// A piece's war-time copy (':war') takes the same refresh. Turn it all off with ?refresh=0 to hear the pieces as they were.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, T = Music._tracks;
  const off = typeof location !== 'undefined' && /[?&]refresh=0\b/.test(location.search || '');
  const R = {
    // measured in three passes over each piece's first 100 s (tools/fresh/sweep.js; the numbers in tools/fresh/README.md): the cues,
    // the galaxy and the race themes. The orchestral pieces take the profile and the three-layer solo recordings; the synth-era cues
    // and the race themes (and the battle cue, whose bite the profile softened) the mastering alone, with a sub under their bass.
    'combat3': {hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2.3}, lowBand: 3, trim: 1.12},
    'combat1': {hall: 'musikverein', tone: {lo: 1.7, hi: 1, pres: 2}, lowBand: 3, subBass: 0.4, trim: 1.37},
    'combat2': {hall: 'musikverein', tone: {lo: 1.6, hi: 1, pres: 1.6}, lowBand: 3, subBass: 0.4, trim: 1.33},
    'ground': {hall: 'musikverein', tone: {lo: 1.9, hi: 0, pres: 0.5}, lowBand: 3, subBass: 0.4, mix: {lead: 2.02, choir: 2.97}, trim: 2.12},
    'council': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.5, hi: 0.42, pres: 2}, lowBand: 2.5, subBass: 0.49, mix: {lead: 1.35}, verb: {A3: 0.8,B2: 0.8}, trim: 0.86},
    'council2': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 1.39, pres: 2.6}, lowBand: 2.5, subBass: 0.51, mix: {lead: 1.84}, verb: {B: 0.8,R: 0.8}, trim: 1.8},
    'procession': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.32, pres: 2.6}, lowBand: 2.5, subBass: 0.56, mix: {lead: 1.37}, verb: {B: 0.8,R: 0.8}, trim: 1.72},
    'victory': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 0, pres: 1.9}, lowBand: 2.5, subBass: 0.46, mix: {lead: 1.23, choir: 1.2}, verb: {A2: 0.8,B2: 0.8,A3: 0.72}, trim: 1.1},
    'defeat': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.5, hi: 1.2, pres: 1.6}, lowBand: 2.5, subBass: 0.45, mix: {lead: 1.24}, trim: 1.5},
    'spy': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.08, hi: 0.35, pres: 4}, lowBand: 2.5, subBass: 0.53, mix: {choir: 1.79}, trim: 1.01},
    'gnn': {hall: 'musikverein', tone: {lo: 2, hi: 0.06}, lowBand: 3, subBass: 0.4, mix: {lead: 1.46}, trim: 0.7},
    'orion': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.55, hi: 1.34, pres: 2.3}, lowBand: 2.5, subBass: 0.4, mix: {lead: 1.73}, verb: {A3: 0.8}, trim: 1.88},
    'antarans': {hall: 'musikverein', tone: {lo: 2, hi: 0}, lowBand: 3, mix: {lead: 2.11, choir: 2.18}, trim: 1.73},
    'research': {hall: 'musikverein', tone: {lo: 2, hi: 3, pres: 1.1}, lowBand: 3, subBass: 0.4, mix: {choir: 1.48, lead: 0.88}, trim: 1.32},
    'design': {hall: 'musikverein', tone: {lo: 1.3, hi: 0, pres: 1.6}, lowBand: 3, subBass: 0.4, trim: 1.13},
    'galaxy1': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.95, hi: -0.68, pres: 1}, lowBand: 2.5, subBass: 0.5, mix: {lead: 1.23}, trim: 1.68},
    'galaxy2': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.32, hi: -0.98, pres: 4}, lowBand: 2.5, subBass: 0.41, trim: 1.38},
    'galaxy3': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.68, pres: 1.7}, lowBand: 2.5, subBass: 0.25, mix: {choir: 2.74, lead: 0.85}, trim: 1.68},
    'galaxy4': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.38, hi: -0.92, pres: 3.3}, lowBand: 2.5, subBass: 0.78, mix: {lead: 3.53, choir: 1.23}, trim: 2.07},
    'galaxy5': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.75, hi: -1, pres: 2.4}, lowBand: 2.5, subBass: 0.45, mix: {lead: 2.06, choir: 2.68}, trim: 1.55},
    'galaxy6': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 3, pres: 4}, lowBand: 2.5, subBass: 0.32, mix: {lead: 3.37, choir: 1.5}, trim: 3.47},
    'galaxy7': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.1, hi: -1, pres: 1.5}, lowBand: 2.5, subBass: 0.79, mix: {lead: 1.64, choir: 2.97}, trim: 1.93},
    'galaxy8': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2, hi: 3.14, pres: 4}, lowBand: 2.5, subBass: 0.34, mix: {lead: 3.39}, trim: 1.97},
    'galaxy9': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1, hi: 1.5, pres: 4}, lowBand: 0, subBass: 0.3, verb: {B: 0.8,A2: 0.72}, trim: 2.24},
    'galaxy10': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.9, hi: 1.08}, lowBand: 2.5, subBass: 0.32, mix: {lead: 2.75}, verb: {B: 0.8,A2: 0.72}, trim: 1.04},
    'galaxy11': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.38, hi: -0.62, pres: 2.4}, lowBand: 2.5, subBass: 0.15, mix: {lead: 2.81, choir: 1.36}, trim: 4.04},
    'galaxy12': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.23, pres: 1.2}, lowBand: 2.5, subBass: 0.4, mix: {lead: 2.26}, trim: 2.66},
    'galaxy13': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.65, hi: -1.5}, lowBand: 2.5, subBass: 0.25, mix: {lead: 2.34, choir: 2.62}, trim: 3.4},
    'galaxy14': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.5, pres: 4}, lowBand: 2.5, subBass: 0.3, mix: {choir: 2.02, lead: 1.17}, verb: {sunrise: 0.72}, trim: 2.91},
    'galaxy15': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.18, pres: 1.2}, lowBand: 2.5, subBass: 0.8, mix: {lead: 3.43, choir: 1.88}, trim: 3.1},
    'galaxy16': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.85, hi: -1, pres: 3.1}, lowBand: 2.5, subBass: 0.25, mix: {lead: 2.72}, trim: 4.01},
    'galaxy17': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.39}, lowBand: 2.5, subBass: 0.7, mix: {lead: 1.41, choir: 2.97}, trim: 2.89},
    'galaxy18': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.54, hi: 0.24}, lowBand: 2.5, subBass: 0.36, mix: {lead: 2.23}, trim: 2.37},
    'galaxy19': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 1.99}, lowBand: 2.5, subBass: 0.35, mix: {lead: 3.45, choir: 1.7}, verb: {ch3: 0.8}, trim: 1.97},
    'galaxy20': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.55, hi: 3.5, pres: 4}, lowBand: 2.5, subBass: 0.46, mix: {lead: 2.95}, trim: 3.05},
    'galaxy21': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.3, pres: 3.3}, lowBand: 2.5, subBass: 0.3, trim: 2.51},
    'galaxy22': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 1.56, pres: 1.1}, lowBand: 2.5, subBass: 0.3, mix: {lead: 1.91}, verb: {crest: 0.8}, trim: 2.51},
    'race:alkari': {hall: 'musikverein', tone: {lo: 1.15, hi: 0, pres: 1.5}, lowBand: 3, mix: {lead: 0.88}, trim: 1.76},
    'race:bulrathi': {hall: 'musikverein', tone: {lo: 1.15, hi: 2.28, pres: 0.6}, lowBand: 3, mix: {lead: 1.26, choir: 1.58}, trim: 1.04},
    'race:darlok': {hall: 'musikverein', tone: {lo: 0.5, hi: 0.3, pres: 1.4}, lowBand: 3, mix: {lead: 2.31}, trim: 1.7},
    'race:human': {hall: 'musikverein', tone: {lo: 1.2, hi: 1.44, pres: 0.7}, lowBand: 3, mix: {lead: 1.2}, trim: 0.77},
    'race:klackon': {hall: 'musikverein', tone: {lo: 0.5, hi: 0, pres: 1.2}, lowBand: 3, subBass: 0.4, mix: {lead: 1.26}, trim: 1.06},
    'race:meklar': {hall: 'musikverein', tone: {lo: 0.6, hi: 0, pres: 1.1}, lowBand: 3, mix: {lead: 1.14}, trim: 0.71},
    'race:mrrshan': {hall: 'musikverein', tone: {lo: 1, hi: 0.3, pres: 1.1}, lowBand: 3, subBass: 0.4, mix: {lead: 1.7, choir: 1.58}, trim: 0.84},
    'race:psilon': {hall: 'musikverein', tone: {lo: 1.7, hi: 1.2, pres: 0.9}, lowBand: 3, subBass: 0.4, trim: 1.41},
    'race:sakkra': {hall: 'musikverein', tone: {lo: 1, hi: 0, pres: 1.4}, lowBand: 3, subBass: 0.4, mix: {lead: 1.16}, trim: 1.27},
    'race:silicoid': {hall: 'musikverein', tone: {lo: 0.5, hi: 0.96}, lowBand: 3, mix: {lead: 2.81}, trim: 1.7},
  };
  // upgrade: the solo winds and brass from the one-layer recordings to the library's three-layer ones of the same instruments (soft, mid
  // and loud each recorded, so a phrase's dynamics change the tone as a player's do). The factor is the loudness of the old against the
  // new at the same notes and dynamics (tools/fresh: the level match), so the part keeps its place in the mix; its dynamic range widens.
  const UPGRADE = { flute: ['fluteIowa', 2.71], oboe: ['oboeIowa', 1.27], clarinet: ['clarIowa', 3.05], altoFlute: ['altoFluteIowa', 0.11],
    bassoon: ['bassoonIowa', 1.92], hornSolo: ['hornIowa', 0.62], tptSolo: ['tptIowa', 2.43] };
  function upgrade(v) {
    const INST = Music._INST, name = typeof v === 'string' ? v : v && typeof v === 'object' ? v.p : null, u = name && UPGRADE[name];
    if (!u || !INST[u[0]] || !INST[name]) return v;
    const lvl = (typeof v === 'object' && v.lvl !== undefined ? v.lvl : INST[name].lvl) * u[1] * INST[u[0]].lvl / INST[name].lvl;
    return Object.assign({}, typeof v === 'object' ? v : {}, { p: u[0], lvl: Math.round(lvl * 1000) / 1000 });
  }
  function upgradeAll(d) {
    for (const k in d.inst || {}) d.inst[k] = upgrade(d.inst[k]);
    for (const a of d.alts || []) for (const k in a) a[k] = upgrade(a[k]);
    for (const k in d.eraAlts || {}) d.eraAlts[k] = upgrade(d.eraAlts[k]);
    for (const s of d.sec) for (const k in s) if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k].inst !== undefined) s[k] = Object.assign({}, s[k], { inst: upgrade(s[k].inst) });
  }
  function apply(d, p) {
    for (const k in p) {
      if (k === 'upgrade') { if (p.upgrade) upgradeAll(d); }
      else if (k === 'verb') { for (const n in p.verb) { const s = d.sec.find(x => x.n === n); if (s) s.verb = p.verb[n]; } }
      else if (k === 'mix' || k === 'tone') d[k] = Object.assign({}, d[k] || {}, p[k]);
      else d[k] = p[k];
    }
    d.refreshed = true;
  }
  Music._refresh = R; Music._applyRefresh = apply;   // tools try a refresh before it is written here (tools/fresh/sweep.js --patch)
  if (off) return;
  for (const id in R) {
    const b = T[id], w = T[id + ':war'], p = R[id]; if (!b) continue;
    const k = p.trim ? p.trim / b.trim : 1; apply(b, p);
    if (w) apply(w, Object.assign({}, p, p.trim ? { trim: w.trim * k } : {}));   // its own trim, moved by the same ratio
  }
})(window.MOO);
