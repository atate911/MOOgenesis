// full9f (the concert flute with feeling) reviewed for clarity at the climax (the user: the mix is clear and the stereo good; make the
// climax better and clearer). Measured: the tune stood only 2.5 dB over the rest in the climax (7.5 in the interlude, 4.8 in the
// rise): the horns' tune (D4-D5) shared its octave with the women, the upper strings and the ostinato. So the climax is spaced: the
// women above the horns, the ostinato below them, the strings thinner and higher, the men's choir beneath; and the hall rides back
// (a section's `verb`) through the climax and the rise, its tail no longer filling the gaps, and gives again after.
const F = require('./full9f.js')['fresh:prod7f'];
const d = JSON.parse(JSON.stringify(F)), by = n => d.sec.find(s => s.n === n), B = by('B'), M = by('M'), R = by('R');
Object.assign(B, { verb: 0.7,
  pad: { p: 'sus', inst: 'strings', n: 3, reg: [67, 88], vel: 0.9 },
  choir2: Object.assign({}, B.choir2, { reg: [71, 86] }),
  arp: Object.assign({}, B.arp, { reg: [48, 60], vel: 0.34 }) });
// measured by layer in the climax: the choir only 3.2 dB under the horns' tune (raised there earlier at the user's wish), the strings 6
// under, the rest well back; so the horns about 1.5 dB up and the men's choir about 1 dB down at the climax
B.lead = Object.assign({}, B.lead, { vel: 1.1 }); B.choir = Object.assign({}, B.choir, { vel: 1.1 });
Object.assign(M, { verb: 0.7, arp: Object.assign({}, M.arp, { reg: [48, 60] }) });
Object.assign(R, { verb: 0.85 });
module.exports = { 'fresh:prod8': d };
