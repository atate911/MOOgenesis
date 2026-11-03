// full5 (the peak trumpet on the theme's 4th-6th notes) with 3:00-3:50 thinned out: the user heard the rise and the held peak as muddy,
// over the top and hard to hear. Fewer lines at once and clear registers, rather than more parts stacked in the low mids.
//   M, the rise: the horn section with the solo horn an octave below, nothing else melodic (no trombones); the ostinato lighter, the
//   strings in three voices, the men's choir alone
//   P, the peak: the solo trumpet on top with the horn section holding under it; the low strings on the root and fifth only; the men
//   higher (out of the low mids), the women softer and below the trumpet; no flutes, no trombones; the timpani's roll lighter
const F = require('./full5.js')['fresh:prod3'];
const d = JSON.parse(JSON.stringify(F)), M = d.sec.find(s => s.n === 'M'), P = d.sec.find(s => s.n === 'P');
Object.assign(M, { cres: [1.0, 1.1], pad: { p: 'sus', inst: 'strings', n: 3, reg: [57, 81], vel: 0.85 },
  arp: { inst: 'strOst', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.3, reg: [55, 69] },
  choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 1.0, width: 0.9 }, choir2: false, bell2: false });
Object.assign(P, { cres: [1.08, 1.12],
  pad: { p: 'sus', inst: 'strings', n: 4, reg: [57, 86], vel: 0.85 }, pad2: { p: 'sus', inst: 'cellos', n: 2, reg: [38, 50], vel: 0.75, open: true },
  lead: { ph: 'HOLDE', inst: 'horn', vel: 0.8 }, lead2: false, bell2: false,
  choir: { inst: 'choirMenAh', n: 3, reg: [50, 64], vel: 0.9, width: 0.9 }, choir2: { inst: 'choirWomen', n: 2, reg: [64, 76], vel: 0.6, width: 0.85 },
  timp: { p: 'hits', roll: 2 } });
P.bell = Object.assign({}, P.bell, { vel: 1.0 });
module.exports = { 'fresh:prod4': d };
