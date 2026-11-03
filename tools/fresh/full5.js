// full4 with a held tutti at the peak (the user): before the resolution, the whole orchestra on the dominant for three bars, holding a
// high note: the strings across the octaves (the low strings in open octaves and fifths below, the full section up to the violins'
// top), the flutes ringing on a high C#, the trumpets on the high A, the horn section on E, the trombones low, the choir full with the women at their highest, the timpani rolling.
const P2 = require('./full4.js')['fresh:prod2'];
const clone = o => JSON.parse(JSON.stringify(o));
const d = clone(P2), i = d.sec.findIndex(s => s.n === 'R'), M = d.sec.find(s => s.n === 'M');
Object.assign(d.ph, { HOLDHI: '12:12', HOLDE: '9:12', HOLDA: '5:12', HOLDC: '14:12' });
const P = Object.assign(clone(M), { n: 'P', bars: 3, prog: 'V V V', cres: [1.15, 1.2], breath: true,
  pad: { p: 'sus', inst: 'strings', n: 6, reg: [36, 88], vel: 1.0 },
  pad2: { p: 'sus', inst: 'cellos', n: 4, reg: [33, 57], vel: 1.0, open: true },   // the deep chord: the low strings in open octaves and fifths
  lead: { ph: 'HOLDE', inst: 'horn', vel: 0.95 }, lead2: { ph: 'HOLDC', inst: 'flutes', vel: 0.9 },   // the flutes ringing above the trumpets
  bell: { ph: 'HOLDHI', inst: 'tpts', vel: 0.85 }, bell2: { ph: 'HOLDA', inst: 'trombones', oct: -1, vel: 0.75 },
  choir: { inst: 'choirMenAh', n: 3, reg: [45, 62], vel: 1.25, width: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [69, 86], vel: 0.85, width: 0.85 },
  timp: { p: 'hits', roll: 3 }, arp: false });
d.sec.splice(i, 0, P);
module.exports = { 'fresh:prod3': d };
