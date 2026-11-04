// full12h (the cor anglais, approved) with sub-bass (the user: more sub and felt bass, below the double bass). The library has no real
// instrument with a clean note an octave under the bass: the organ's low recordings carry almost no fundamental (-72 dB at 25-60 Hz on
// its own), the tuba's D1 and the double-bass section's D1 and G1 are rough. So a quiet sine an octave under the solo double bass
// (`subBass`), as a film mix reinforces its low strings: D2's sub at 37 Hz, felt more than heard, the double bass the timbre.
const F = require('./full12h.js')['fresh:prod10h'];
const make = k => { const d = JSON.parse(JSON.stringify(F)); d.subBass = k; return d; };
module.exports = { 'fresh:prod12': make(0.6) };
