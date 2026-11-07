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
