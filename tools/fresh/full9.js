// full8 with a gentler first statement (the user: it came in too hard and fast): the opening 6 bars (was 4), the theme's first
// statement quieter on a softer voice, the French horn keeping the second (the theme building). a: the alto flute (Iowa), D4-D5;
// b: the solo trombone (Iowa), D3-D4.
const F8 = require('./full8.js')['fresh:prod6'];
const make = (inst, oct) => { const d = JSON.parse(JSON.stringify(F8)), intro = d.sec.find(s => s.n === 'intro'), A = d.sec.find(s => s.n === 'A');
  Object.assign(intro, { bars: 6, prog: 'I I IV I | IV I', cres: [0.22, 0.34] });
  Object.assign(A, { cres: [0.3, 0.42] }); A.lead = { ph: 'PA*0.85 PB*0.9', inst, oct, vel: 0.8, pan: -0.05 };
  return d; };
module.exports = { a: { 'fresh:prod7a': make('altoFluteIowa', 0) }, b: { 'fresh:prod7b': make('tbnSolo', -1) }, c: { 'fresh:prod7c': make('clarIowa', 0) } };   // c: the clarinet (Iowa), D4-D5 (the user: soft, rounded, warm)
