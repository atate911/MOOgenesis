// Step 4 variations after the user's notes: a little more choir over the horn (the choir up through the whole piece, the crest's
// strings as they are), and the same with the solo French horn an octave lower (D3-D4) in its first statement.
const S4 = require('./step4.js')['fresh:4'];
const clone = o => JSON.parse(JSON.stringify(o));
const a = clone(S4); a.mix = Object.assign({}, a.mix, { choir: 1.5 });
const b = clone(a); b.sec[0].lead = Object.assign({}, b.sec[0].lead, { oct: -1 });
module.exports = { 'fresh:4d': a, 'fresh:4e': b };
