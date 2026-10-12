// Opens every bottom-bar screen, plays turns, resizes; reports console errors per step.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  let errs = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  const step = async (name, fn) => { errs = []; try { await fn(); } catch (e) { errs.push('SCRIPT: ' + e.message.split('\n')[0]); } await p.waitForTimeout(500); console.log((errs.length ? 'FAIL ' : 'ok   ') + name + (errs.length ? '\n   ' + [...new Set(errs)].join('\n   ') : '')); };
  await p.goto('file://' + path.resolve('index.html') + '?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&diff=average&turns=30');
  await p.waitForTimeout(3000);
  const labels = await p.$$eval('button', bs => bs.map(x => x.textContent.trim()).filter(Boolean));
  console.log('buttons:', labels.slice(0, 40).join(' | '));
  for (const name of ['Colonies', 'Fleets', 'Design', 'Map', 'Races', 'Planets', 'Tech']) {
    await step('screen ' + name, async () => {
      const el = p.locator('button', { hasText: new RegExp('^\\s*' + name, 'i') }).first();
      await el.click({ timeout: 2000 });
      await p.waitForTimeout(700);
      await p.screenshot({ path: `/tmp/qa-${name}.png` });
      await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      if (await p.locator('text=Game menu').count()) await p.keyboard.press('Escape');
    });
  }
  for (const [w, h] of [[1024, 600], [1920, 1080], [2560, 1440]]) {
    await step(`resize ${w}x${h}`, async () => { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(500); await p.screenshot({ path: `/tmp/qa-${w}.png` }); });
  }
  await p.setViewportSize({ width: 1280, height: 720 });
  for (let i = 0; i < 40; i++) {
    await step('turn ' + i, async () => { await p.keyboard.press('Enter'); await p.waitForTimeout(250); });
  }
  await b.close();
})();
