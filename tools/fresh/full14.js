// full12h (the cor anglais, approved) with sub-bass (the user: more sub and felt bass, below the double bass). The library has no real
// instrument with a clean note an octave under the bass: the organ's low recordings carry almost no fundamental (-72 dB at 25-60 Hz on
// its own), the tuba's D1 and the double-bass section's D1 and G1 are rough. So a quiet sine an octave under the solo double bass
// (`subBass`), as a film mix reinforces its low strings: D2's sub at 37 Hz, felt more than heard, the double bass the timbre.
const F = require('./full12h.js')['fresh:prod10h'];
// then more at 50-120 Hz, musically (the user): the double bass about 1.5 dB up and the low cellos' open fifth about 1.6 dB up (their
// voicing kept: a fuller chord would put a cello in unison with the bass, and two recordings in unison beat)
const make = k => { const d = JSON.parse(JSON.stringify(F)); d.subBass = k; d.mix = Object.assign({}, d.mix, { bass: 1.9 });
  for (const s of d.sec) if (s.pad2 && s.pad2.inst === 'cellos') s.pad2 = Object.assign({}, s.pad2, { vel: +(s.pad2.vel * 1.2).toFixed(2) });
  return d; };
// the master's low band (held even by its compressor, which took back most of the bass's lift) raised for this piece (`lowBand`, dB);
// the sub stays at 0.6, the low band's lift bringing it up a little (the user asked for a little more)
const out = make(0.6); out.lowBand = 2.5;
module.exports = { 'fresh:prod12': out };
