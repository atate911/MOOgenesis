// Headless loader: runs the DOM-free game code (js/core, js/data, js/sim, js/ai) inside a Node vm context.
//   const MOO = require('./headless.js').load();     // -> the MOO namespace
//   node tools/headless.js                            // smoke test: just loads everything and lists namespaces
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS_DIRS = /^js\/(core|data|sim|ai)\//;

function load(opts) {
  opts = opts || {};
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, setInterval, clearInterval, Math, Date, JSON, Object, Array, Map, Set, WeakMap, Promise, Symbol, Uint8Array, Float32Array, Float64Array, Int32Array, Uint32Array });
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/manifest.js'), 'utf8'), ctx, { filename: 'manifest.js' });
  const files = ctx.MOO_MANIFEST.js.filter(f => HEADLESS_DIRS.test(f));
  const missing = [];
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) { missing.push(f); continue; }
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
    catch (e) { console.error('[headless] error while loading ' + f + ':\n' + (e && e.stack || e)); throw e; }
  }
  if (missing.length && !opts.quiet) console.warn('[headless] missing files: ' + missing.join(', '));
  return ctx.MOO;
}

module.exports = { load, ROOT };

if (require.main === module) {
  const M = load();
  console.log('Loaded MOO', M.VERSION, '— namespaces:', Object.keys(M).filter(k => typeof M[k] === 'object').map(k => k + '(' + Object.keys(M[k]).length + ')').join(' '));
}
