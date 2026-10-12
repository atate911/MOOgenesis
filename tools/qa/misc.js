// GNN archive + Spies caught from Races screen and Game menu; Esc/right-click grammar on a few screens; resize 1024x600 -> 1920x1080 mid-screen
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8819; const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1024, height: 600 } });
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=40`); await sleep(1500);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  console.log('newsLog', await page.evaluate(() => (MOO.Game.S.newsLog || []).length));
  await page.keyboard.press('r'); await sleep(700);
  await page.keyboard.press('n'); await sleep(800); await page.screenshot({ path: '/tmp/claude-0/misc-archive.png' });
  console.log('archive modal', await page.evaluate(() => !!document.querySelector('.gnn-arch-modal')));
  await page.keyboard.press('Escape'); await sleep(400);
  await page.keyboard.press('c'); await sleep(600); await page.screenshot({ path: '/tmp/claude-0/misc-caught.png' });
  console.log('caught modal', await page.evaluate(() => (document.querySelector('.scrim .modal-h') || {}).textContent));
  await page.keyboard.press('Escape'); await sleep(300);
  console.log('still on', await page.evaluate(() => MOO.UI.Screens.current.id));
  await page.keyboard.press('Escape'); await sleep(500);
  await page.keyboard.press('g'); await sleep(400); await page.keyboard.press('g'); await sleep(600);
  console.log('archive via menu', await page.evaluate(() => !!document.querySelector('.gnn-arch-modal')));
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(300);
  // resize while on design
  await page.evaluate(() => MOO.UI.Screens.go('design', { from: 'galaxy' })); await sleep(500);
  await page.setViewportSize({ width: 1920, height: 1080 }); await sleep(600); await page.screenshot({ path: '/tmp/claude-0/misc-design-1080.png' });
  await page.setViewportSize({ width: 900, height: 500 }); await sleep(600); await page.screenshot({ path: '/tmp/claude-0/misc-design-900.png' });
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
