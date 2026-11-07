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
  function apply(d, p) {
    for (const k in p) {
      if (k === 'verb') { for (const n in p.verb) { const s = d.sec.find(x => x.n === n); if (s) s.verb = p.verb[n]; } }
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
