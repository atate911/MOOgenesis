// The whole piece with the climax's horns in a fuller arrangement (the user: 4E's low horn for the quiet statements, and at the climax
// a second horn with the first). x: the octave, the horn section at D4-D5 (4D's register) with the solo French horn an octave below
// carrying on from the quiet statements, the trombones under them; y: harmony, the horn section with a second horn a third below it
// (diatonic), the trombones an octave below.
const F = require('./full.js')['fresh:full'];
const clone = o => JSON.parse(JSON.stringify(o));
const x = clone(F), y = clone(F), bx = x.sec.find(s => s.n === 'B'), by = y.sec.find(s => s.n === 'B');
bx.lead = { ph: 'PA PB', inst: 'horn', vel: 0.95 };
bx.lead2 = { ph: 'PA PB', inst: 'hornIowa', oct: -1, vel: 0.9 };
bx.bell2 = { ph: 'PA PB', inst: 'trombones', oct: -1, vel: 0.7 };
by.lead = { ph: 'PA PB', inst: 'horn', vel: 0.95, harm: -2, hvel: 0.75 };
by.lead2 = { ph: 'PA PB', inst: 'trombones', oct: -1, vel: 0.8 };
module.exports = { 'fresh:fullx': x, 'fresh:fully': y };
