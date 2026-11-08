// full14 (the cor anglais, the sub, the 50-120 Hz body) with the bass arriving at the swell as a new register of the movement (the
// user: an impression, a gut feel, a new emotional hit): at the climax the solo double bass enters fresh with a strong attack (not
// tied from before) as the timpani begin, the section tuba joins it on the roots (the low brass's weight, clean on D2, G2 and A2)
// through the climax and the majestic rise, and the sub opens up there (a section's `subBass`), giving back after.
const F = require('./full14.js')['fresh:prod12'];
const d = JSON.parse(JSON.stringify(F)), by = n => d.sec.find(s => s.n === n), B = by('B'), M = by('M');
const tuba = { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [38, 46], vel: 0.8 };
B.bass = Object.assign({}, B.bass, { vel: 1.15, fresh: true, inst: { p: 'cbSolo', att: 0.2, rel: 2.5 } }); B.subBass = 1.0; B.pad3 = tuba;
M.subBass = 0.9; M.pad3 = tuba;
module.exports = { 'fresh:prod13': d };
