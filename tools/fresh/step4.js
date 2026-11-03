// Step 4: the build. Step 3a (the solo French horn over the strings, the solo double bass and the choir wall) states the tune once,
// quietly; a timpani roll and a breath lead into the crest, where the tune returns broad: the horn section with the trombones an octave
// below, the timpani on the strong beats, the strings fuller and higher, the choir opening up (the men on ah, the women above them),
// then a closing bar on the tonic. 18 bars. Background music: the crest gains energy (a spiccato
// ostinato), not level, and the choir a little more presence.
const S3 = require('./step3.js')['fresh:3a'];
const d = JSON.parse(JSON.stringify(S3)), base = d.sec[0];
const clone = o => JSON.parse(JSON.stringify(o));
const quiet = clone(base), crest = clone(base), close = clone(base);
Object.assign(quiet, { n: 'A', bars: 9, prog: 'I | I I IV I | I I IV V', cres: [0.38, 0.58], breath: true,
  lead: { ph: 'r1 PA*0.9 PB*0.95', inst: 'hornIowa', vel: 0.95, pan: -0.05 }, timp: { p: 'hits', roll: 2 } });
Object.assign(crest, { n: 'B', bars: 8, prog: 'I I IV I | I I IV V', cres: [0.95, 1.15],
  pad: { p: 'sus', inst: 'strings', n: 4, reg: [60, 86], vel: 0.9 },
  lead: { ph: 'PA PB', inst: 'horn', vel: 0.95 }, lead2: { ph: 'PA PB', inst: 'trombones', oct: -1, vel: 0.8 },
  choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 1.25, width: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.78, width: 0.85 },   // more choir at the build (the user), the strings a touch back so it is no louder
  timp: { p: 'beats', vel: 0.6 },
  arp: { inst: 'strOst', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [55, 69] } });   // energy, not level: the strings' spiccato ostinato in eighths under the tune
Object.assign(close, { n: 'C', bars: 1, prog: 'I', cres: [0.8, 0.6], lead: undefined, timp: false });
delete close.lead;
d.sec = [quiet, crest, close]; d.loopFrom = 'A';
d.mix = Object.assign({}, d.mix, { choir: 1.3 });   // a little more choir (the user)
module.exports = { 'fresh:4': d };
