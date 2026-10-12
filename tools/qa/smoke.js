const { serve, open, sleep } = require('./lib');
(async () => {
  const srv = await serve(8766);
  const { browser, page, errors } = await open();
  await page.goto('http://localhost:8766/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=20');
  await sleep(1500);
  const screens = await page.evaluate(() => Object.keys(MOO.UI.Screens).length && ['galaxy','planets','fleets','specs','design','tech','races','report','status','mapoverview','help','options','saveload','audience','council','combat','landing','endings','gnn','menu','setup','system']);
  for (const s of screens) {
    const before = errors.length;
    const r = await page.evaluate(id => { try { if (!MOO.UI.Screens.has(id)) return 'missing'; MOO.UI.Screens.go(id, {from:'galaxy'}); return 'ok'; } catch (e) { return 'ERR ' + e.message; } }, s);
    await sleep(500);
    console.log(s, r, errors.slice(before).join(' | '));
    await page.screenshot({ path: `/tmp/claude-0/shot-${s}.png` }).catch(()=>{});
  }
  console.log('ALL ERRORS', errors);
  await browser.close(); srv.close();
})();
