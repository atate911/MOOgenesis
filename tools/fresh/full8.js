// full7 paced with breathing room (the user): short, soft passages of the bed alone (the strings and the men humming quietly; no horn,
// brass or timpani) between the forward horn sections and the builds and let-downs, and a longer, gentler release.
//   S1 3 after the theme, before the interlude      S2 2 after the interlude, before the theme builds (leaning on the dominant)
//   S3 2 after the climax, before the majestic rise  L 6 the release after the resolution (was 4)
const F7 = require('./full7.js')['fresh:prod5'];
const clone = o => JSON.parse(JSON.stringify(o));
const d = clone(F7), by = n => d.sec.find(s => s.n === n), I1 = by('I1');
const soft = (n, bars, prog, cres) => { const s = clone(I1); for (const k of ['lead', 'lead2', 'bell', 'bell2']) delete s[k];
  return Object.assign(s, { n, bars, prog, cres, breath: false, timp: false, arp: false,
    pad: { p: 'swell', inst: 'strings', n: 3, reg: [55, 72], vel: 0.6 },
    choir: { inst: 'choirMenAh', n: 3, reg: [43, 57], vel: 0.6, soft: true, width: 0.85 }, choir2: false }); };
const L = by('L'); Object.assign(L, { bars: 6, prog: 'I IV I | vi IV I', cres: [0.55, 0.36] });
const order = [];
for (const s of d.sec) {
  order.push(s);
  if (s.n === 'A') order.push(soft('S1', 3, 'I IV IV', [0.4, 0.3]));
  if (s.n === 'I2') order.push(soft('S2', 2, 'V V', [0.42, 0.36]));
  if (s.n === 'B') order.push(soft('S3', 2, 'vi IV', [0.55, 0.45]));
}
d.sec = order;
module.exports = { 'fresh:prod6': d };
