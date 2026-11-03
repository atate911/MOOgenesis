// Step 2: the choir on version C of step 1 (the string orchestra, the bass moving with the chords on the solo double bass). The user wants
// a wall of sound with the deep men they liked: the Sonatina men's choir (recorded G2 to F#4; below G2 it would be stretched).
// a: the full wall, the men in three parts (G2-C4) and the Pianobook choir's ooh above them (E4-E5);
// b: the men alone, in four parts (G2-E4).
const C = require('./step1c.js')['fresh:1c'];
const clone = o => JSON.parse(JSON.stringify(o));
const a = clone(C), b = clone(C);
a.mix = Object.assign({}, a.mix, { choir: 1.0 }); b.mix = Object.assign({}, b.mix, { choir: 1.0 });
a.sec[0].choir = { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.9, soft: true, width: 0.85, att: 3 };
a.sec[0].choir2 = { inst: 'choirOoh', n: 3, reg: [64, 76], vel: 0.5, soft: true, width: 0.8, att: 4 };
b.sec[0].choir = { inst: 'choirMenAh', n: 4, reg: [43, 64], vel: 0.95, soft: true, width: 0.9, att: 3 };
module.exports = { 'fresh:2a': a, 'fresh:2b': b };
