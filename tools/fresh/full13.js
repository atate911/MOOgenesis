// full12h (the cor anglais, approved) with an organ pedal for sub-bass (the user: more sub and felt bass; the lowest register of a
// church organ, an octave under the double bass): the pipe organ (VSCO 2's recording of a real organ's open stop) holding only each
// chord's root in the lowest octave (D1 at about 37 Hz, under the double bass's D2 at 73), through every section, felt more than heard.
const F = require('./full12h.js')['fresh:prod10h'];
const d = JSON.parse(JSON.stringify(F));
for (const s of d.sec) s.pad3 = { p: 'sus', inst: 'organ', root: true, n: 1, reg: [26, 37], vel: 0.8 };
module.exports = { 'fresh:prod11': d };
