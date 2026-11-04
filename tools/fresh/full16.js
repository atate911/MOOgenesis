// full15 with the user's next notes: another low bass instrument (the bass clarinet holding each chord's root softly with the double
// bass, D2-B2, in every section but the climax and the rise, where the tuba holds them) and the sub +1 dB throughout (0.6 -> 0.67,
// the climax 1.0 -> 1.12, the rise 0.9 -> 1.0); the master's low band +1 dB more for the piece (2.5 -> 3.5) so the added body comes
// through its compressor.
const F = require('./full15.js')['fresh:prod13'];
const d = JSON.parse(JSON.stringify(F)), k = Math.pow(10, 1 / 20);
d.subBass = +(d.subBass * k).toFixed(2); d.lowBand = 3.5;
for (const s of d.sec) {
  if (s.subBass !== undefined) s.subBass = +(s.subBass * k).toFixed(2);
  if (!s.pad3) s.pad3 = { p: 'sus', inst: 'bassClar', root: true, n: 1, reg: [38, 46], vel: 0.7 };
}
module.exports = { 'fresh:prod14': d };
