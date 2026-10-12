// F1 context help on screens with data-help hooks: reports how many callouts resolve their selector
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8815; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=20`); await sleep(1500);
  for (const s of ['galaxy', 'planets', 'fleets', 'tech', 'design', 'races', 'mapoverview']) {
    await page.evaluate(id => MOO.UI.Screens.go(id, { from: 'galaxy' }), s); await sleep(600);
    await page.keyboard.press('F1'); await sleep(500);
    const n = await page.evaluate(() => ({ overlay: !!document.querySelector('.hp, .help-ov, [class*="help"]'), pages: document.querySelectorAll('[class*="hp-"]').length }));
    await page.screenshot({ path: `/tmp/claude-0/help-${s}.png` });
    await page.keyboard.press('Escape'); await sleep(200); console.log(s, JSON.stringify(n));
  }
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
