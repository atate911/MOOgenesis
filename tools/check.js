// Syntax-checks every file listed in js/manifest.js (compile only — nothing is executed) and reports missing files.
//   node tools/check.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const ctx = vm.createContext({});
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/manifest.js'), 'utf8'), ctx);
const files = ctx.MOO_MANIFEST.js.concat(['js/loader.js', 'js/manifest.js']);

let bad = 0, missing = 0, ok = 0, lines = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('  missing  ' + f); missing++; continue; }
  const src = fs.readFileSync(p, 'utf8');
  lines += src.split('\n').length;
  try { new vm.Script(src, { filename: f }); ok++; }
  catch (e) { bad++; console.log('  SYNTAX   ' + f + '\n           ' + e.message + (e.stack ? '\n' + e.stack.split('\n').slice(0, 4).join('\n') : '')); }
}
console.log(`checked ${files.length} files (${lines} lines): ${ok} ok, ${bad} with syntax errors, ${missing} missing`);
process.exit(bad ? 1 : 0);
