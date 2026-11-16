// The compile hash of every race piece (node tools/races/hash.js [> file]): which pieces a change touched.
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const ctx = vm.createContext({ console, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '' }, document: { hidden: false, addEventListener() {} }, window: null, Math, JSON, WeakMap });
ctx.window = ctx;
for (const f of ['js/core/ns.js', 'js/audio/audio.js', 'js/audio/sampler.js', 'js/audio/music.js', 'js/audio/score/themes.js', 'js/audio/score/cues.js', 'js/audio/score/map.js', 'js/audio/score/races.js', 'js/audio/score/programme.js', 'js/audio/score/refresh.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const M = ctx.MOO.Audio.Music, T = M._tracks, want = process.argv.slice(2);
for (const id of Object.keys(T).filter(x => want.length ? want.indexOf(x) >= 0 : /^race:/.test(x))) {
  const h = crypto.createHash('md5'); for (const p of [0, 1]) for (const e of M._compile(id, p).events) h.update(JSON.stringify([e.t, e.v, e.m, e.ly, e.o && e.o.vel]));
  console.log(id.padEnd(20) + h.digest('hex').slice(0, 12));
}
