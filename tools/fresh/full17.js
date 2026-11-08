// full16 (the main movement) in a recorded hall: the Musikverein's impulse (Voxengo, unaltered, its license beside it) for the hall
// send (`hall`), its energy matched to the generated hall's, so the room's character changes and not its level.
const F = require('./full16.js')['fresh:prod14'];
const d = JSON.parse(JSON.stringify(F)); d.hall = 'musikverein';
module.exports = { 'fresh:prod15': d };
