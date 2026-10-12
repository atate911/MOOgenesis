// Headless-Chromium smoke test: loads the real UI, plays N turns, reports console/page errors.
// usage: NODE_PATH=$(npm root -g) node tools/qa/smoke.js [query] [turns]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const query = process.argv[2] || 'dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&diff=average&turns=5';
  const turns = +(process.argv[3] || 10);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await p.goto('file://' + path.resolve('index.html') + '?' + query);
  await p.waitForTimeout(3000);
  for (let i = 0; i < turns; i++) {
    await p.keyboard.press('Space'); // end turn / advance interrupts
    await p.waitForTimeout(400);
    await p.keyboard.press('Escape');
  }
  await p.screenshot({ path: process.env.TMPDIR ? process.env.TMPDIR + '/smoke.png' : '/tmp/smoke.png' });
  console.log(errs.length ? errs.join('\n') : 'no console errors');
  await b.close();
})();
