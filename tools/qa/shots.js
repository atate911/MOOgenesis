// usage: node shots.js WxH screen[,screen...]  -> /tmp/claude-0/shot-<screen>-<W>x<H>.png (dev game, 30 turns, contact with everyone)
const { serve, open, sleep } = require('./lib');
(async () => {
  const [wh = '1280x720', list = 'galaxy'] = process.argv.slice(2); const [W, H] = wh.split('x').map(Number);
  const srv = await serve(+process.env.PORT || 8790);
  const { browser, page, errors } = await open({ viewport: { width: W, height: H } });
  await page.goto(`http://localhost:${process.env.PORT || 8790}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=30`);
  await sleep(1200);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  for (const s of list.split(',')) {
    await page.evaluate(id => { if (id === 'audience') void MOO.UI.Audience.open(1, { from: 'galaxy' }); else MOO.UI.Screens.go(id, { from: 'galaxy' }); }, s);
    await sleep(s === 'audience' ? 3500 : 1200);
    if (s === 'audience') for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await sleep(200); }
    await page.screenshot({ path: `/tmp/claude-0/shot-${s}-${wh}.png` });
  }
  console.log([...new Set(errors)]);
  await browser.close(); srv.close();
})();
