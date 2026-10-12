// Rules test runner — executes every tools/rules/*.test.js against the headless game modules.
//   node tools/rules-test.js            run all areas
//   node tools/rules-test.js colony     run areas whose file name contains "colony"
// A test file exports  function (M, t) { t.test('name', () => { t.eq(actual, expected); }); }
// Tests encode the VERIFIED formulas/tables (see research/*.md and RULES.md) and known data points, so balance work can never silently break the rules.
const fs = require('fs');
const path = require('path');
const { load } = require('./headless.js');

const dir = path.join(__dirname, 'rules');
const filter = process.argv[2] || '';
const M = load({ quiet: true });

let pass = 0, fail = 0, skipped = 0;
const failures = [];
let area = '';

const t = {
  test(name, fn) {
    try { fn(); pass++; }
    catch (e) { if (e && e.skip) { skipped++; return; } fail++; failures.push(`[${area}] ${name}\n      ${e && e.message || e}`); }
  },
  skip(msg) { const e = new Error(msg || 'skipped'); e.skip = true; throw e; },
  ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy, got ' + v); },
  eq(a, b, msg) { if (a !== b) throw new Error((msg ? msg + ': ' : '') + `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  near(a, b, eps, msg) { if (!(Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps))) throw new Error((msg ? msg + ': ' : '') + `expected ≈${b} (±${eps}), got ${a}`); },
  deep(a, b, msg) { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error((msg ? msg + ': ' : '') + `expected ${y}, got ${x}`); },
  throws(fn, msg) { let threw = false; try { fn(); } catch (e) { threw = true; } if (!threw) throw new Error(msg || 'expected an exception'); },
  between(v, lo, hi, msg) { if (!(v >= lo && v <= hi)) throw new Error((msg ? msg + ': ' : '') + `expected ${lo}..${hi}, got ${v}`); },
};

if (!fs.existsSync(dir)) { console.log('no tools/rules directory yet — nothing to test'); process.exit(0); }
const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js') && f.includes(filter)).sort();
for (const f of files) {
  area = f.replace('.test.js', '');
  const before = pass + fail + skipped;
  try { require(path.join(dir, f))(M, t); }
  catch (e) { fail++; failures.push(`[${area}] (file failed to run)\n      ${e && e.stack || e}`); }
  console.log(`  ${area.padEnd(18)} ${pass + fail + skipped - before} tests`);
}
console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped  (${files.length} areas)`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
