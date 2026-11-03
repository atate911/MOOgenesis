// The whole main theme from the approved steps (4e): the bed alone, the low French horn's tune twice (the second fuller, a breath and a
// timpani roll), the crest (the horn section and the trombones, the timpani, the ostinato, the choir open), the wind-down with the horn,
// the settling; the game loops from the horn's first entry. Only the approved parts; the sections differ in what plays and how loudly.
const E = require('./step4v.js')['fresh:4e'];
const clone = o => JSON.parse(JSON.stringify(o));
const [quiet, crest] = E.sec, d = clone(E);
const sec = (from, o) => Object.assign(clone(from), o);
const lead = ph => ({ ph, inst: 'hornIowa', oct: -1, vel: 0.95, pan: -0.05 });
d.sec = [
  sec(quiet, { n: 'intro', bars: 4, prog: 'I I IV I', cres: [0.25, 0.42], breath: false, lead: undefined, timp: false }),
  sec(quiet, { n: 'A', bars: 8, prog: 'I I IV I | I I IV V', cres: [0.4, 0.55], breath: false, lead: lead('PA*0.9 PB*0.95'), timp: false }),
  sec(quiet, { n: 'A2', bars: 8, prog: 'I I IV I | I I IV V', cres: [0.5, 0.66], breath: true, lead: lead('PA*0.95 PB*1'), timp: { p: 'hits', roll: 2 } }),
  sec(crest, { n: 'B' }),
  sec(quiet, { n: 'D', bars: 8, prog: 'I I IV I | I I IV I', cres: [0.62, 0.42], breath: false, lead: lead('PA*0.85 r4'), timp: false }),
  sec(quiet, { n: 'E', bars: 4, prog: 'I I IV I', cres: [0.42, 0.3], breath: false, lead: undefined, timp: false }),
];
for (const s of d.sec) if (s.lead === undefined) delete s.lead;
d.loopFrom = 'A';
module.exports = { 'fresh:full': d };
