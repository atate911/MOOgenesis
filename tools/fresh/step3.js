// Step 3: the horn with the tune, on step 2 version A (the strings, the solo double bass, the Sonatina men with the Pianobook ooh above).
// The tune is the commonwealth's strain (PA) and its answer to the octave (PB), as the title states it, twice (16 bars), after a bar of the
// bed alone and before a closing bar on the tonic so the excerpt resolves. The horn in its heroic middle register (D4-D5).
// a: the solo horn (Iowa); b: the horn section in unison (the epic manner of stating a theme).
const A = require('./step2.js')['fresh:2a'];
const clone = o => JSON.parse(JSON.stringify(o));
const make = (inst) => { const d = clone(A), s = d.sec[0];
  d.ph = { PA: '@procession.A1', PB: '@procession.A2' };
  s.bars = 18; s.prog = 'I | I I IV I | I I IV V | I I IV I | I I IV V | I';   // a bar of the bed alone first, the horn's tune over bars 2-17, the tonic to close s.cres = [0.5, 0.95];
  s.lead = { ph: 'r1 PA*0.9 PB*0.95 PA*1 PB*1', inst, vel: 0.95, pan: -0.05 };
  d.mix = Object.assign({}, d.mix, { lead: 1.8 });
  d.sends = { lead: { verb: 0.12, stage: 0.36, dly: 0.05 }, choir: { verb: 0.32, stage: 0.12 } };
  return d; };
module.exports = { 'fresh:3a': make('hornIowa'), 'fresh:3b': make('horn') };
