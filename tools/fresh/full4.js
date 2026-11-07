// The production arrangement, longer (about 5 min) and with more time away from the theme (the user). Built on full3 (version X's
// sounds). Every new phrase is drawn from the theme's two ideas, its rising head (1 2 3 5) and its falling answer (6 5 3 2), with
// chord tones on the strong beats and passing notes between.
//   intro 4  the bed swells in
//   A 8      the theme, the question (the low French horn, ending open on the dominant)
//   I1 8     interlude, antecedent: the solo cello, the rising idea from the sixth through the relative minor, a half close on V
//   I2 8     interlude, consequent: the horn answers with the falling idea while the cello lays the theme's head in long notes beneath,
//            ending on the third (not yet home)
//   A2 8     the theme building: fuller, a breath, a timpani roll
//   B 8      the climax (version X)
//   M 8      the majestic rise: the rising idea in sequence, climbing above the theme to a peak held on the dominant; the choir's top
//            voices higher, the timpani rolling into the peak
//   R 8      the resolution: the theme's opening shape, broadened, falling home to the tonic as the brass relaxes
//   L 4      the release: the strings and the choir alone, the climax breathing out
//   E 8      the echo: the interlude's consequent once more, softly, on the cello
//   Z 6      the conclusion: the low horn recalls the head; everything settles
const P3 = require('./full3.js')['fresh:prod'];
const clone = o => JSON.parse(JSON.stringify(o));
const d = clone(P3), by = n => d.sec.find(s => s.n === n);
const intro = by('intro'), A = by('A'), I = by('I'), A2 = by('A2'), B = by('B'), M0 = by('M'), Z0 = by('Z');
Object.assign(d.ph, {
  I1: '6:3 7:1 | 8:2 6:2 | 5:3 6:1 | 7:2 5:2 | 10:3 9:1 | 8:2 6:2 | 9:3 8:1 | 7:4',
  I2: '4:2 6:2 | 5:2 7:2 | 10:3 9:1 | 8:2 6:2 | 6:3 5:1 | 3:2 5:2 | 5:2 2:2 | 3:4',
  HEAD: '1:4 | 2:4 | 3:4 | 5:4 | 4:4 | 3:4 | 2:4 | 3:4',
  RISE: '5:3 6:1 | 8:2 11:2 | 12:3 11:1 | 9:2 7:2 | 11:3 10:1 | 12:4 | 13:2 12:2 | 12:2 9:2',
  RES: '3:3 5:1 | 6:2 4:2 | 5:2 3:2 | 2:4 | 4:3 3:1 | 2:2 5:2 | 3:2 2:2 | 1:4',
  PAh: '1:3 2:1 | 3:2 5:2 | r:8',
});
const sec = (from, o) => { const s = Object.assign(clone(from), o); for (const k in s) if (s[k] === undefined) delete s[k]; return s; };
const I1 = sec(I, { n: 'I1', prog: 'vi IV I V | vi IV ii V', cres: [0.36, 0.5], lead: { ph: 'I1', inst: 'vcSolo', oct: -1, vel: 0.95, pan: 0.1 } });
const I2 = sec(I, { n: 'I2', prog: 'IV V iii vi | IV I V I', cres: [0.48, 0.58],
  lead: { ph: 'I2', inst: 'hornIowa', oct: -1, vel: 0.95, pan: -0.05 }, lead2: { ph: 'HEAD', inst: 'vcSolo', oct: -1, vel: 0.7, pan: 0.15 } });
const M = sec(M0, { n: 'M', prog: 'I IV I V | IV I vi V', cres: [1.05, 1.2], breath: true,
  lead: { ph: 'RISE', inst: 'horn', vel: 0.95 }, lead2: { ph: 'RISE', inst: 'hornIowa', oct: -1, vel: 0.9 }, bell2: { ph: 'RISE', inst: 'trombones', oct: -1, vel: 0.7 },
  choir2: { inst: 'choirWomen', n: 3, reg: [67, 84], vel: 0.8, width: 0.85 }, timp: { p: 'hits', roll: 2 } });
const R = sec(M0, { n: 'R', prog: 'I IV I V | IV V I I', cres: [1.05, 0.8],
  lead: { ph: 'RES', inst: 'horn', vel: 0.92 }, lead2: { ph: 'RES', inst: 'hornIowa', oct: -1, vel: 0.85 }, bell2: { ph: 'RES', inst: 'trombones', oct: -1, vel: 0.62 }, arp: false });
const L = sec(I, { n: 'L', bars: 4, prog: 'I IV I I', cres: [0.72, 0.5], lead: undefined, lead2: undefined,
  choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 1.0, soft: true, width: 0.9 }, choir2: { inst: 'choirOoh', n: 3, reg: [64, 76], vel: 0.55, soft: true, width: 0.8 } });
const E = sec(I, { n: 'E', prog: 'IV V iii vi | IV I V I', cres: [0.46, 0.36], lead: { ph: 'I2', inst: 'vcSolo', oct: -1, vel: 0.9, pan: 0.1 } });
const Z = sec(Z0, { n: 'Z', bars: 6, prog: 'I I IV I | I I', cres: [0.4, 0.22] });
d.sec = [intro, A, I1, I2, A2, B, M, R, L, E, Z];
d.loopFrom = 'A';
module.exports = { 'fresh:prod2': d };
