// full11 with the user's next notes: more bass mass, more presence, and the first statement on a reed instead of the violin: g the oboe
// (Iowa), h the cor anglais, D4-D5, phrased strongly (expr 1.6, vibK 1.5), their levels set to stand about 3 dB over the soft bed.
// The double-bass section at D1-A1 was tried for mass and measured rough in its overtones (over a thousand small bursts in two minutes:
// the old plucking), so the bass stays the clean solo double bass at D2-A2; its mass comes from the master's 120 Hz shelf and its level.
const F = require('./full11.js')['fresh:prod9'];
const make = (inst) => { const d = JSON.parse(JSON.stringify(F)), A = d.sec.find(s => s.n === 'A');
  d.tone = { lo: 2.5, hi: 3.0 };   // presence and air (the 5 kHz shelf +3 dB, was +1) and mass (the 120 Hz shelf +2.5 dB, was +1.3)
  d.mix = Object.assign({}, d.mix, { bass: 1.6 });
  A.lead = { ph: 'PA*0.85 PB*0.9', inst, oct: 0, vel: 0.95, pan: -0.05, expr: 1.6, vibK: 1.5 };
  return d; };
module.exports = { g: { 'fresh:prod10g': make({ p: 'oboeIowa', lvl: 0.83 }) }, h: { 'fresh:prod10h': make({ p: 'reed', lvl: 0.55 }) } };
