// full5 with the peak's solo trumpet on the theme's 5th-8th notes (6 5 3 2: B A F# E, the strain's falling answer), an octave up,
// across the three held bars, against 5 6 5 in full5.
const F = require('./full5.js')['fresh:prod3'];
const d = JSON.parse(JSON.stringify(F));
d.ph.TPT = '13:3 12:1 | 10:2 9:2 | 9:4';
module.exports = { 'fresh:prod3b': d };
