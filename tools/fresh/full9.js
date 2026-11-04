// full8 with a gentler first statement (the user: it came in too hard and fast): the opening 6 bars (was 4), the theme's first
// statement quieter on a softer voice, the French horn keeping the second (the theme building). a: the alto flute (Iowa), D4-D5;
// b: the solo trombone (Iowa), D3-D4.
const F8 = require('./full8.js')['fresh:prod6'];
const make = (inst, oct, vel, more) => { const d = JSON.parse(JSON.stringify(F8)), intro = d.sec.find(s => s.n === 'intro'), A = d.sec.find(s => s.n === 'A');
  Object.assign(intro, { bars: 6, prog: 'I I IV I | IV I', cres: [0.22, 0.34] });
  Object.assign(A, { cres: [0.3, 0.42] }); A.lead = Object.assign({ ph: 'PA*0.85 PB*0.9', inst, oct, vel: vel || 0.8, pan: -0.05 }, more || {});
  if (more) A.cres = [0.26, 0.48];   // a wider crescendo through the statement
  return d; };
// e/f (the user: more lift, more feeling, more dynamics): the alto flute and the concert flute each about 2 dB higher, the phrase's arc
// half again as strong (expr 1.6), a deeper vibrato on held notes (vibK 2.2), a wider crescendo through the statement
const MORE = { expr: 1.6, vibK: 2.2 };
module.exports = { e: { 'fresh:prod7e': make({ p: 'altoFluteIowa', lvl: 0.85 }, 0, 0.9, MORE) }, f: { 'fresh:prod7f': make({ p: 'fluteIowa', lvl: 0.92 }, 1, 1.0, MORE) }, a: { 'fresh:prod7a': make('altoFluteIowa', 0) }, b: { 'fresh:prod7b': make('tbnSolo', -1) }, c: { 'fresh:prod7c': make('clarIowa', 0) }, d: { 'fresh:prod7d': make({ p: 'fluteIowa', lvl: 0.73 }, 1, 1.0) } };   // the preset's level (0.071) left it 16 dB under the soft bed: raised to stand about 3 dB over it   // d: the concert flute (Iowa) an octave up, D5-D6: its singing register (the user found the alto flute low)   // c: the clarinet (Iowa), D4-D5 (the user: soft, rounded, warm)
