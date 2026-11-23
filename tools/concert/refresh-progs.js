// The chord progressions the refresh (js/audio/score/refresh.js) re-wrote, piece by piece: the score loaded without it and with it,
// and every section whose progression changed. A port of a piece from its original text carries these (tools/concert/port.py).
//   node tools/concert/refresh-progs.js > tools/concert/refresh-progs.json
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
function load(withRefresh) {
  const ctx = vm.createContext({ console: { log() {}, warn() {} }, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '?symphonic=0' } });
  ctx.window = ctx; ctx.globalThis = ctx;
  const files = ['js/core/ns.js', 'js/audio/audio.js', 'js/audio/sampler.js', 'js/audio/music.js', 'js/audio/score/themes.js', 'js/audio/score/cues.js', 'js/audio/score/map.js', 'js/audio/score/races.js', 'js/audio/score/programme.js'].concat(withRefresh ? ['js/audio/score/refresh.js'] : []);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  const T = ctx.MOO.Audio.Music._tracks, out = {};
  for (const id in T) { out[id] = {}; for (const s of T[id].sec || []) out[id][s.n] = s.prog; }
  return out;
}
const a = load(false), b = load(true), diff = {};
for (const id in b) for (const n in b[id]) if (a[id] && a[id][n] !== undefined && a[id][n] !== b[id][n]) (diff[id] = diff[id] || {})[n] = b[id][n];
console.log(JSON.stringify(diff, null, 1));
