// Step 1, version B (the low strings move with the chords), with a clean bass voice. The double-bass section's D2 recording carries
// scrapes its loop repeats (51 bursts over 6 dB in 20 s through the engine); the solo double bass (Iowa) is clean on D2, E2, G2, A2 and C2
// but has no recording near A1, so the bass sits from D2 to A2 (the dominant's root a fifth above the tonic, not a fourth below).
const base = require('./step1.js')['fresh:1b'];
const c = JSON.parse(JSON.stringify(base));
c.bassC = 40;
c.sec[0].bass = { pat: '1---', vel: 0.85, inst: { p: 'cbSolo', att: 3, rel: 2.5 } };
module.exports = { 'fresh:1c': c };
