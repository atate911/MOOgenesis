// shared helpers for QA scripts
const { chromium } = require('playwright');
const path = require('path');
exports.open = async function (query = '', opts = {}) {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: opts.viewport || { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  if (opts.init) await p.addInitScript(opts.init);
  await p.goto('file://' + path.resolve(__dirname, '../../index.html') + (query ? '?' + query : ''));
  await p.waitForTimeout(opts.wait || 3000);
  const flush = () => { const e = [...new Set(errs)]; errs.length = 0; return e; };
  return { b, p, flush };
};
exports.report = (name, errs) => console.log((errs.length ? 'FAIL ' : 'ok   ') + name + (errs.length ? '\n   ' + errs.join('\n   ') : ''));
