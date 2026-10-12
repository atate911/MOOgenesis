'use strict';
// Shared helpers for the balance scripts: run tools/soak.js and load its JSON, small stats helpers, markdown tables.
const cp = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
exports.ROOT = ROOT;
exports.soak = function (args, name) {
  const file = 'bal-' + name + '.json';
  const r = cp.spawnSync('node', [path.join(ROOT, 'tools', 'soak.js'), '--quiet', '--no-color', '--json', file].concat(args), { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const p = path.join(ROOT, 'tools', 'out', file);
  if (!fs.existsSync(p)) throw new Error('soak produced no json: ' + (r.stderr || r.stdout).slice(0, 500));
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
exports.load = name => JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'out', 'bal-' + name + '.json'), 'utf8'));
exports.median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
exports.mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
exports.pct = (n, d) => d ? (100 * n / d).toFixed(1) : '-';
exports.table = function (head, rows) {
  const out = ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'];
  for (const r of rows) out.push('| ' + r.map(x => typeof x === 'number' ? (Number.isInteger(x) ? x : x.toFixed(1)) : x).join(' | ') + ' |');
  return out.join('\n');
};
// snapshot of empire `id` at turn T in a game (null when the game ended earlier or the empire is dead)
exports.snapAt = function (g, T, id) { const s = (g.snaps || []).find(x => x.turn === T); if (!s) return null; const e = s.e.find(x => x.id === id); return e && e.alive ? e : null; };
exports.arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
