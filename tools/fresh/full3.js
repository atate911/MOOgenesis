// The production arrangement (the user, after X): theme (the question) - interlude (brooding) - theme (building) - majestic resolution
// (the answer) - conclusion. Built from the approved sounds of version X.
//   intro 4: the bed swells in alone
//   A 8: the theme, the question: the low French horn, the strain and its answer (PA PB), which ends open on the dominant
//   I 8: the interlude, brooding: new melody on the solo cello (Iowa) through the relative minor (V3 V4 over vi IM7 iii V | IM7 I ii V),
//        the men humming low, the upper voices and the brass silent
//   A2 8: the theme, building: fuller, a breath and a timpani roll
//   B 8: the climax as in X: the horn section with the solo horn an octave below, the trombones, the timpani, the ostinato, the choir open
//   M 8: the majestic resolution, the answer: the procession's hymn phrase and its cadence home to the tonic (HY CD) in the horns, the
//        choir full, the timpani, the ostinato
//   Z 8: the conclusion: the low horn recalls the head (PAh) and everything settles on the tonic
const X = require('./full2.js')['fresh:fullx'];
const clone = o => JSON.parse(JSON.stringify(o));
const d = clone(X), by = n => d.sec.find(s => s.n === n);
const intro = by('intro'), A = by('A'), A2 = by('A2'), B = by('B'), quiet = by('D');
d.ph = Object.assign({}, d.ph, { V3: '6:4 | 7:2 8:2 | 10:4 | 11:2 10:2', V4: '8:2 7:1 6:1 | 5:2 3:2 | 4:3 2:1 | 2:4', HY: '@procession.HY', CD: '@procession.CD', PAh: '1:3 2:1 | 3:2 5:2 | r:8' });
const sec = (from, o) => { const s = Object.assign(clone(from), o); for (const k in s) if (s[k] === undefined) delete s[k]; return s; };
const I = sec(quiet, { n: 'I', bars: 8, prog: 'vi IM7 iii V | IM7 I ii V', cres: [0.36, 0.5], breath: false, timp: false,
  pad: { p: 'swell', inst: 'strings', n: 4, reg: [52, 74], vel: 0.85 },
  lead: { ph: 'V3 V4', inst: 'vcSolo', oct: -1, vel: 0.9, pan: 0.1 },
  choir: { inst: 'choirMenAh', n: 3, reg: [43, 58], vel: 0.8, soft: true, width: 0.85 }, choir2: false });
const M = sec(B, { n: 'M', bars: 8, prog: 'I IV I I | IV V I I', cres: [1.0, 1.1],
  lead: { ph: 'HY CD', inst: 'horn', vel: 0.95 }, lead2: { ph: 'HY CD', inst: 'hornIowa', oct: -1, vel: 0.9 }, bell2: { ph: 'HY CD', inst: 'trombones', oct: -1, vel: 0.7 } });
const Z = sec(quiet, { n: 'Z', bars: 8, prog: 'I I IV I | IV IV I I', cres: [0.5, 0.26], breath: false, timp: false,
  lead: { ph: 'PAh r4', inst: 'hornIowa', oct: -1, vel: 0.9, pan: -0.05 }, choir2: false });
d.sec = [intro, A, I, A2, B, M, Z];
d.loopFrom = 'A';
module.exports = { 'fresh:prod': d };
