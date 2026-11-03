// The production arrangement (the user): full4, the version before the held multi-octave peak ("too much: let the melody and the
// arrangement do the heavy lifting"), with full6's clearer rise (the horn section and the solo horn an octave below; no trombones,
// no women; the ostinato lighter, three string voices, the men alone), which the user heard as better.
const F4 = require('./full4.js')['fresh:prod2'];
const d = JSON.parse(JSON.stringify(F4)), M = d.sec.find(s => s.n === 'M');
Object.assign(M, { cres: [1.0, 1.1], pad: { p: 'sus', inst: 'strings', n: 3, reg: [57, 81], vel: 0.85 },
  arp: { inst: 'strOst', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.3, reg: [55, 69] },
  choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 1.0, width: 0.9 }, choir2: false, bell2: false });
module.exports = { 'fresh:prod5': d };
