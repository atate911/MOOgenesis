// World art (js/gfx/worldart.js): every image its lists can request exists in assets/art/, so the game never asks for a missing
// file (each one is a failed load in the player's console). Reads the lists from the source: worldart.js is not part of the headless build.
module.exports = function (M, t) {
  const fs = require('fs'), path = require('path');
  const ROOT = path.resolve(__dirname, '../..'), src = fs.readFileSync(path.join(ROOT, 'js/gfx/worldart.js'), 'utf8');
  const list = name => { const m = src.match(new RegExp('const ' + name + ' = (\\[[^\\]]*\\])')); if (!m) throw new Error('list ' + name + ' not found'); return JSON.parse(m[1].replace(/'/g, '"')); };

  t.test('every world-art path the lists can produce has a file', () => {
    const fx = list('FX'); const n = (src.match(/for \(let i = 1; i <= (\d+); i\+\+\) FX\.push\('debris-' \+ i\)/) || [])[1]; for (let i = 1; i <= +n; i++) fx.push('debris-' + i);
    const sys = list('SYSTEM'), paths = [].concat(
      list('ORBIT').map(k => 'orbit/orbit-' + k), list('SURFACE').map(k => 'surface/surface-' + k), sys.map(k => 'system/system-' + k), sys.map(k => 'system-sky/system-sky-' + k),
      list('BATTLE').map(k => 'battle/battle-' + k), fx.map(k => 'fx/' + k), list('STILLS').map(k => 'still/' + k), list('EVENTS').map(k => 'event/event-' + k),
      list('SCENES').map(k => 'scene/scene-' + k), list('COLONY').map(k => 'colony/colony-' + k), ['gnn/race-neutral-gnn-studio-background']);
    for (const r of list('RACES')) for (const p of list('PURPOSES')) paths.push('races/race-' + r + '-' + p);
    t.ok(paths.length > 100, 'parsed only ' + paths.length + ' paths');
    const missing = paths.filter(p => !fs.existsSync(path.join(ROOT, 'assets/art', p + '.webp')));
    t.deep(missing, [], 'missing art files');
  });
};
