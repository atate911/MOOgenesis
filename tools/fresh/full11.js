// full10 with the user's next notes: more bass and sub-bass presence (the solo double bass about 3 dB up, the tone's low end a touch
// more; no synthetic sub), the first statement on an emotive solo violin (Iowa) instead of the flute (D4-D5, the warm lower strings,
// the phrase's arc strong, a little more vibrato), and the horn's first entry (the theme building) about 1.5 dB less forward.
const F = require('./full10.js')['fresh:prod8'];
const d = JSON.parse(JSON.stringify(F)), by = n => d.sec.find(s => s.n === n), A = by('A'), A2 = by('A2');
d.mix = Object.assign({}, d.mix, { bass: 1.4 }); d.tone = Object.assign({}, d.tone, { lo: 1.3 });
A.lead = { ph: 'PA*0.85 PB*0.9', inst: { p: 'vlnSolo', lvl: 0.78 }, oct: 0, vel: 0.95, pan: 0.05, expr: 1.6, vibK: 1.3 };
A2.lead = Object.assign({}, A2.lead, { vel: 0.8 });
module.exports = { 'fresh:prod9': d };
