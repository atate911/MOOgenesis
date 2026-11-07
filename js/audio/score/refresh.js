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
    // and the race themes (and the battle cue, whose bite the profile softened) the mastering alone, with a sub under their bass. Then
    // the choir's sung lead in twelve of them (sing), room for every melody (space: tools/fresh/space.js) and one low end across the score
    // (the sub toward -5 dB and 50-120 Hz toward +2 dB of the whole, the main theme's family).
    'combat3': {hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2.3}, lowBand: 3, subBass: 0.1, space: {A1: {pad2: {velK: 0.7}}, B1: {pad2: {velK: 0.7}}, A2: {pad2: {velK: 0.7}}, B2: {pad2: {velK: 0.7}}}, trim: 1.42},
    'combat1': {hall: 'musikverein', tone: {lo: 1.7, hi: 1, pres: 2}, lowBand: 3, subBass: 0.32, space: {A1: {pad: {reg: [74,88]}}, A2: {pad: {reg: [74,88]}}, A3: {pad: {reg: [74,88]}}}, trim: 1.37},
    'combat2': {hall: 'musikverein', tone: {lo: 1.6, hi: 1, pres: 1.6}, lowBand: 3, subBass: 0.4, space: {A1: {pad: {velK: 0.7}}, A2: {pad: {velK: 0.7}}, A3: {pad: {velK: 0.7}}}, trim: 1.33},
    'ground': {hall: 'musikverein', tone: {lo: 3, hi: 0, pres: 0.5}, lowBand: 3, subBass: 0.59, mix: {lead: 2.02, choir: 2.97}, space: {B1: {pad: {reg: [72,86]}}, B2: {pad: {reg: [72,86]}}, D: {pad: {reg: [73,87]}}, E: {pad: {reg: [72,86]}}}, trim: 2.12},
    'council': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.5, hi: 0.42, pres: 2}, lowBand: 2.5, subBass: 0.62, mix: {lead: 1.35}, verb: {A3: 0.8, B2: 0.8}, sing: {sections: ['A3', 'B2'], inst: 'choirOoh', oct: 0, lvl: 0.352}, trim: 0.86},
    'council2': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 1.39, pres: 2.6}, lowBand: 3.5, subBass: 0.51, mix: {lead: 1.84, bass: 1.75}, verb: {B: 0.8, R: 0.8}, sing: {sections: ['B', 'R'], inst: 'choirOoh', oct: 0, lvl: 0.286}, space: {B: {pad: {velK: 0.75}}, R: {pad: {velK: 0.75}}}, trim: 1.8},
    'procession': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.32, pres: 2.6}, lowBand: 3.5, subBass: 0.44, mix: {lead: 1.37, bass: 1.55}, verb: {B: 0.8, R: 0.8}, sing: {sections: ['B', 'R'], inst: 'choirOoh', oct: 0, lvl: 0.264}, trim: 1.72},
    'victory': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 0, pres: 1.9}, lowBand: 2.5, subBass: 0.63, mix: {lead: 1.23, choir: 1.2}, verb: {A2: 0.8, B2: 0.8, A3: 0.72}, trim: 1.1},
    'defeat': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.5, hi: 1.2, pres: 1.6}, lowBand: 2.5, subBass: 0.55, mix: {lead: 1.24}, trim: 1.5},
    'spy': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.08, hi: 0.35, pres: 4}, lowBand: 2.5, subBass: 0.74, mix: {choir: 1.79}, trim: 1.01},
    'gnn': {hall: 'musikverein', tone: {lo: 3, hi: 0.06}, lowBand: 4, subBass: 0.56, mix: {lead: 1.46}, trim: 0.7},
    'orion': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.55, hi: 1.34, pres: 2.3}, lowBand: 2.5, subBass: 0.4, mix: {lead: 1.73}, verb: {A3: 0.8}, sing: {sections: ['A3'], inst: 'choirOoh', oct: 0, lvl: 0.207}, trim: 1.88},
    'antarans': {hall: 'musikverein', tone: {lo: 3, hi: 0}, lowBand: 4, subBass: 0.1, mix: {lead: 2.11, choir: 2.18}, space: {A2: {choir: {velK: 0.7}}, A3: {choir: {velK: 0.7}}}, trim: 1.73},
    'research': {hall: 'musikverein', tone: {lo: 3, hi: 3, pres: 1.1}, lowBand: 3, subBass: 0.62, mix: {choir: 1.48, lead: 0.88}, trim: 1.32},
    'design': {hall: 'musikverein', tone: {lo: 1.3, hi: 0, pres: 1.6}, lowBand: 3, subBass: 0.49, trim: 1.13},
    'galaxy1': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.95, hi: -0.68, pres: 1}, lowBand: 2.5, subBass: 0.58, mix: {lead: 1.23}, trim: 1.68},
    'galaxy2': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.32, hi: -0.98, pres: 4}, lowBand: 2.5, subBass: 0.41, trim: 1.38},
    'galaxy3': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.68, pres: 1.7}, lowBand: 3.5, subBass: 0.25, mix: {choir: 2.74, lead: 0.85}, sing: {sections: ['B2'], inst: 'choirOoh', oct: 0, lvl: 0.238}, space: {A3: {pad: {velK: 0.75}}}, trim: 1.68},
    'galaxy4': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.38, hi: -0.92, pres: 3.3}, lowBand: 2.5, subBass: 1.2, mix: {lead: 3.53, choir: 1.23}, space: {A1: {pad2: {velK: 0.75}}}, trim: 2.07},
    'galaxy5': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.75, hi: -1, pres: 2.4}, lowBand: 2.5, subBass: 0.57, mix: {lead: 2.06, choir: 2.68}, trim: 1.55},
    'galaxy6': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 3, pres: 4}, lowBand: 2.5, subBass: 0.32, mix: {lead: 3.37, choir: 1.5}, space: {A1: {pad: {velK: 0.75}}, B: {pad: {velK: 0.75}}, C: {choir: {velK: 0.6}}, A2: {pad: {velK: 0.75}}}, trim: 3.47},
    'galaxy7': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -1, pres: 1.5}, lowBand: 2.5, subBass: 1.03, mix: {lead: 1.64, choir: 2.97}, trim: 1.93},
    'galaxy8': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2, hi: 3.14, pres: 4}, lowBand: 2.5, subBass: 0.34, mix: {lead: 3.39}, trim: 1.97},
    'galaxy9': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.35, hi: 1.5, pres: 4}, lowBand: 0, subBass: 0.15, verb: {B: 0.8, A2: 0.72}, sing: {sections: ['B', 'A2'], inst: 'choirOoh', oct: 0, lvl: 0.209}, space: {A1: {pad: {velK: 0.75}}, A2: {pad2: {reg: [76,88]}}}, trim: 2.24},
    'galaxy10': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.9, hi: 1.08}, lowBand: 2.5, subBass: 0.41, mix: {lead: 2.75}, verb: {B: 0.8, A2: 0.72}, space: {intro: {pad: {reg: [60,76]}}, A1: {pad: {reg: [60,76]}, pad2: {velK: 0.7}}, B: {pad: {reg: [69,83]}, pad2: {velK: 0.7}, choir2: {velK: 0.6}}, A2: {pad: {reg: [69,83]}, pad2: {velK: 0.7}, choir2: {velK: 0.6}}}, trim: 1.1},
    'galaxy11': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.38, hi: -0.62, pres: 2.4}, lowBand: 2.5, subBass: 0.1, mix: {lead: 2.81, choir: 1.36}, sing: {sections: ['rise'], inst: 'choirOoh', oct: 0, lvl: 0.238}, trim: 4.04},
    'galaxy12': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.23, pres: 1.2}, lowBand: 1.5, subBass: 0.55, mix: {lead: 2.26}, sing: {sections: ['V6'], inst: 'choirOoh', oct: 0, lvl: 0.187}, space: {V4: {pad: {velK: 0.75}}, V6: {pad: {velK: 0.75}}}, trim: 2.66},
    'galaxy13': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -1.5}, lowBand: 2.5, subBass: 0.32, mix: {lead: 2.34, choir: 2.62}, space: {mid: {choir2: {velK: 0.6}}}, trim: 3.4},
    'galaxy14': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.5, pres: 4}, lowBand: 1.5, subBass: 0.3, mix: {choir: 2.02, lead: 1.17}, verb: {sunrise: 0.72}, sing: {sections: ['sunrise'], inst: 'choirOoh', oct: 0, lvl: 0.238}, space: {rise: {pad: {velK: 0.75}}, sunrise: {pad: {velK: 0.75}}, dusk: {pad: {velK: 0.75}}}, trim: 3.55},
    'galaxy15': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.18, pres: 1.2}, lowBand: 3.5, subBass: 1.12, mix: {lead: 3.43, choir: 1.88}, space: {CF2: {pad: {reg: [63,77]}, choir2: {velK: 0.6}}, CF3: {pad: {reg: [63,77]}, choir2: {velK: 0.6}, pad2: {reg: [63,77]}}}, trim: 3.1},
    'galaxy16': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.7, hi: -1, pres: 3.1}, lowBand: 2.5, subBass: 0.29, mix: {lead: 2.72}, trim: 4.01},
    'galaxy17': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.39}, lowBand: 3.5, subBass: 0.56, mix: {lead: 1.41, choir: 2.97}, space: {still: {pad: {velK: 0.75}}, canon3b: {pad: {velK: 0.75}}}, trim: 2.89},
    'galaxy18': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.54, hi: 0.24}, lowBand: 2.5, subBass: 0.36, mix: {lead: 2.23}, sing: {sections: ['crest'], inst: 'choirOoh', oct: 0, lvl: 0.238}, trim: 2.37},
    'galaxy19': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 1.99}, lowBand: 2.5, subBass: 0.35, mix: {lead: 3.45, choir: 1.7}, verb: {ch3: 0.8}, sing: {sections: ['ch3'], inst: 'choirOoh', oct: 0, lvl: 0.155}, space: {ch2: {pad: {velK: 0.75}}, ch3: {pad: {velK: 0.75}}, amen: {pad: {reg: [60,79]}}}, trim: 1.97},
    'galaxy20': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.55, hi: 3.5, pres: 4}, lowBand: 2.5, subBass: 0.46, mix: {lead: 2.95}, sing: {sections: ['M3', 'M4'], inst: 'choirMen', oct: 0, lvl: 0.28}, space: {M2: {pad: {reg: [54,68]}, choir: {velK: 0.6}}, M3: {pad: {reg: [60,76]}}, M4: {pad: {reg: [68,82]}, choir: {velK: 0.6}}}, trim: 3.05},
    'galaxy21': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.3, pres: 3.3}, lowBand: 1.5, subBass: 0.34, trim: 2.51},
    'galaxy22': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 1.56, pres: 1.1}, lowBand: 1.5, subBass: 0.34, mix: {lead: 1.91}, verb: {crest: 0.8}, space: {men: {pad: {reg: [62,76]}, choir2: {velK: 0.6}}, satb: {pad: {velK: 0.7}, choir2: {velK: 0.6}}, satb2: {pad: {velK: 0.75}, pad2: {velK: 0.7}, choir: {velK: 0.6}}, still: {pad: {reg: [58,72]}, choir2: {velK: 0.6}}, crest: {pad: {velK: 0.75}, choir: {velK: 0.6}, pad2: {velK: 0.7}}}, trim: 2.51},
    'race:alkari': {hall: 'musikverein', tone: {lo: 1.15, hi: 0, pres: 1.5}, lowBand: 3, mix: {lead: 0.88}, trim: 1.76},
    'race:bulrathi': {hall: 'musikverein', tone: {lo: 1.15, hi: 2.28, pres: 0.6}, lowBand: 3, subBass: 0.1, mix: {lead: 1.26, choir: 1.58}, space: {A: {pad: {reg: [64,78]}}, B: {pad: {reg: [64,78]}, choir: {velK: 0.7}}, C: {pad: {reg: [62,76]}}}, trim: 1.04},
    'race:darlok': {hall: 'musikverein', tone: {lo: 0.5, hi: 0.3, pres: 1.4}, lowBand: 3, subBass: 0.3, mix: {lead: 2.31}, space: {A: {choir: {velK: 0.7}}, B: {choir: {velK: 0.7}}}, trim: 1.7},
    'race:human': {hall: 'musikverein', tone: {lo: 1.2, hi: 1.44, pres: 0.7}, lowBand: 3, mix: {lead: 1.2}, trim: 0.77},
    'race:klackon': {hall: 'musikverein', tone: {lo: 0.5, hi: 0, pres: 1.2}, lowBand: 3, subBass: 0.58, mix: {lead: 1.26}, space: {A: {pad: {velK: 0.7}}, B: {pad: {velK: 0.7}}, A2: {pad: {velK: 0.7}}, B2: {pad: {velK: 0.7}}}, trim: 1.06},
    'race:meklar': {hall: 'musikverein', tone: {lo: 0.6, hi: 0, pres: 1.1}, lowBand: 3, mix: {lead: 1.14}, space: {A: {pad: {reg: [68,82]}}, B: {pad: {reg: [73,87]}}, A2: {pad: {reg: [68,82]}}, B2: {pad: {reg: [73,87]}}}, trim: 0.71},
    'race:mrrshan': {hall: 'musikverein', tone: {lo: 1.8, hi: 0.3, pres: 1.1}, lowBand: 3, subBass: 0.46, mix: {lead: 1.7, choir: 1.58}, trim: 0.84},
    'race:psilon': {hall: 'musikverein', tone: {lo: 1.7, hi: 1.2, pres: 0.9}, lowBand: 3, subBass: 0.51, trim: 1.41},
    'race:sakkra': {hall: 'musikverein', tone: {lo: 1, hi: 0, pres: 1.4}, lowBand: 3, subBass: 0.53, mix: {lead: 1.16}, trim: 1.27},
    'race:silicoid': {hall: 'musikverein', tone: {lo: 0.5, hi: 0.96}, lowBand: 3, mix: {lead: 2.81}, space: {A: {pad: {reg: [70,84]}}, B: {pad: {reg: [71,85]}, choir: {velK: 0.7}}}, trim: 1.7},
  };
  // upgrade: the solo winds and brass from the one-layer recordings to the library's three-layer ones of the same instruments (soft, mid
  // and loud each recorded, so a phrase's dynamics change the tone as a player's do). The factor is the loudness of the old against the
  // new at the same notes and dynamics (tools/fresh: the level match), so the part keeps its place in the mix; its dynamic range widens.
  // (the flute and the alto flute set from their melodies' level in the pieces: the matched notes misjudged them by 4 and 20 dB)
  const UPGRADE = { flute: ['fluteIowa', 4.3], oboe: ['oboeIowa', 1.27], clarinet: ['clarIowa', 3.05], altoFlute: ['altoFluteIowa', 1.0],
    bassoon: ['bassoonIowa', 1.92], hornSolo: ['hornIowa', 0.62], tptSolo: ['tptIowa', 2.43] };
  // the choirs, in every refreshed piece: the mixed and the women's voices from the Sonatina sets to the Pianobook choir the main theme
  // uses (much the better recordings: an ooh, and a hum for the closed 'uuh'); the men stay on the Sonatina men, whose deep bass voices
  // the new choir does not reach (it starts at D3), as in the theme. Matched in loudness the same way.
  const CHOIRS = { ooh: ['choirOoh', 1.33], aah: ['choirOoh', 0.71], eeh: ['choirOoh', 0.68], choirWomen: ['choirOoh', 0.76], uuh: ['choirHum', 0.80] };
  function upgrade(v, MAP) {
    const INST = Music._INST, name = typeof v === 'string' ? v : v && typeof v === 'object' ? v.p : null, u = name && (MAP || UPGRADE)[name];
    if (!u || !INST[u[0]] || !INST[name]) return v;
    const lvl = (typeof v === 'object' && v.lvl !== undefined ? v.lvl : INST[name].lvl) * u[1] * INST[u[0]].lvl / INST[name].lvl;
    return Object.assign({}, typeof v === 'object' ? v : {}, { p: u[0], lvl: Math.round(lvl * 1000) / 1000 });
  }
  function upgradeAll(d, MAP) {
    // a layer the piece plays without naming its instrument takes the engine's default: name it, so it is upgraded as well
    const D = Music._DEF_INST || {}; d.inst = d.inst || {};
    for (const sc of d.sec) for (const k in D) if (sc[k] && d.inst[k] === undefined && MAP && MAP[D[k]]) d.inst[k] = D[k];
    for (const k in d.inst || {}) d.inst[k] = upgrade(d.inst[k], MAP);
    for (const a of d.alts || []) for (const k in a) a[k] = upgrade(a[k], MAP);
    for (const k in d.eraAlts || {}) d.eraAlts[k] = upgrade(d.eraAlts[k], MAP);
    for (const s of d.sec) for (const k in s) if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k].inst !== undefined) s[k] = Object.assign({}, s[k], { inst: upgrade(s[k].inst, MAP) });
  }
  // sing: the choir takes the tune in a piece's big statements (the sections named), singing the melody with its instrument: the
  // section's lead line, as written, given to the second line on a choir (inst; oct moves it by octaves into the voices' range; vel and
  // lvl set it beside the instrument, so it leads with it rather than under it). Its own recorded vibrato: none added.
  function sing(d, o) {
    for (const n of o.sections) for (const sc of d.sec.filter(x => x.n === n)) {
      if (!sc.lead || typeof sc.lead !== 'object' || sc.lead3) continue;
      sc.lead3 = Object.assign({}, sc.lead, { inst: { p: o.inst, lvl: o.lvl }, oct: num(sc.lead.oct, 0) + (o.oct || 0), vel: num(sc.lead.vel, 0.9) * (o.vel || 0.95), pan: -num(sc.lead.pan, 0) * 0.6 + 0.08, vibK: 0, harm: undefined, echo: undefined, skip: undefined });   // it sings whenever the section plays (where the instrument rests, the choir carries the tune alone)
    }
  }
  const num = (v, f) => (typeof v === 'number' && isFinite(v) ? v : f);
  // space: room in a crowded section, without changing what is written. A bed or a chordal choir that sits on the melody's notes, or a
  // third sustained sound stacked in the low mids (A2-C4) where two already are, is voiced elsewhere (reg: the range its chord notes are
  // drawn from) or steps back (velK); found by measurement (tools/fresh/space.js), section by section: { section: { layer: {reg, velK} } }.
  function space(d, o) {
    for (const n in o) for (const sc of d.sec.filter(x => x.n === n)) for (const ly in o[n]) {
      const c = o[n][ly], v = sc[ly]; if (!v) continue;
      const spec = typeof v === 'string' ? { p: v } : Object.assign({}, v);
      if (c.reg) spec.reg = c.reg.slice();
      if (c.velK) spec.vel = num(spec.vel, 1) * c.velK;
      sc[ly] = spec;
    }
  }
  function apply(d, p) {
    for (const k in p) {
      if (k === 'upgrade') { if (p.upgrade) upgradeAll(d); }
      else if (k === 'sing') sing(d, p.sing);
      else if (k === 'space') space(d, p.space);
      else if (k === 'verb') { for (const n in p.verb) { const s = d.sec.find(x => x.n === n); if (s) s.verb = p.verb[n]; } }
      else if (k === 'mix' || k === 'tone') d[k] = Object.assign({}, d[k] || {}, p[k]);
      else d[k] = p[k];
    }
    upgradeAll(d, CHOIRS);
    d.refreshed = true; delete d._p;   // the engine's prepared form of the piece, made again from the refreshed definition
  }
  Music._refresh = R; Music._applyRefresh = apply;   // tools try a refresh before it is written here (tools/fresh/sweep.js --patch)
  if (off) { Music._dbg.noLayerFlow = true; return; }   // as they were: the layer flow and its rare exceptions too (the main theme's A)
  for (const id in R) {
    const b = T[id], w = T[id + ':war'], p = R[id]; if (!b) continue;
    const k = p.trim ? p.trim / b.trim : 1; apply(b, p);
    if (w) apply(w, Object.assign({}, p, p.trim ? { trim: w.trim * k } : {}));   // its own trim, moved by the same ratio
  }
})(window.MOO);
