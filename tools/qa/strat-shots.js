// Strategic choices UI check: the setup option, the colony focus row (click a focus), the Planets ledger's Projects window.
// usage: node tools/qa/strat-shots.js   → tools/out/strat/ui-*.png, console errors printed
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const OUT = path.resolve(__dirname, '../out/strat'); fs.mkdirSync(OUT, { recursive: true });
  const PORT = +process.env.PORT || 8798; const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1600, height: 900 } });
  const base = `http://localhost:${PORT}/index.html`;
  const shot = async n => { await page.screenshot({ path: `${OUT}/ui-${n}.png` }); console.log('shot', n); };
  try {
    await page.goto(base); await sleep(3500);
    await page.evaluate(() => MOO.UI.Screens.go('setup')); await sleep(1500);
    const optText = await page.evaluate(() => [...document.querySelectorAll('.su-optrow-t b')].map(b => b.textContent));
    console.log('setup options:', optText.join(' | '));
    await page.goto(`${base}?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=strat&turns=60&strat=1`); await sleep(5000);
    await page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(); MOO.Game.sel.star = S.planets[E.capital].starId; MOO.UI.Screens.go('galaxy'); }); await sleep(2000);
    const row = await page.evaluate(() => { const r = document.querySelector('.sc-focus'); return r ? r.textContent : null; });
    console.log('focus row:', row);
    await page.evaluate(() => { const b = [...document.querySelectorAll('.sc-focus button')].find(x => x.textContent === 'Industry'); if (b) b.click(); }); await sleep(800);
    console.log('after click:', await page.evaluate(() => { const S = MOO.Game.S, E = MOO.Game.player(), p = S.planets[E.capital]; return p.focus + ' / retool ' + p.focusT + ' / row: ' + document.querySelector('.sc-focus').textContent; }));
    await shot('colony-focus');
    await page.evaluate(() => { const E = MOO.Game.player(); E.bc = 2000; E.research.tl[0] = Math.max(E.research.tl[0], 10); MOO.UI.Screens.go('planets', { from: 'galaxy' }); }); await sleep(2000);
    await page.keyboard.press('p'); await sleep(1200);
    console.log('projects window:', await page.evaluate(() => { const m = document.querySelector('.lp-proj'); return m ? m.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; }));
    await shot('projects');
    await page.evaluate(() => { const b = [...document.querySelectorAll('.lp-pj .btn')].find(x => /Fund/.test(x.textContent) && !x.disabled); if (b) b.click(); }); await sleep(900);
    console.log('after fund:', await page.evaluate(() => JSON.stringify(MOO.Game.player().projects || {})));
    await shot('projects-funded');
  } catch (e) { console.log('FAIL', e.message); }
  console.log('console errors:', errors.length ? '\n  ' + errors.filter(e => !/GL Driver/.test(e)).slice(0, 12).join('\n  ') : 'none');
  await browser.close(); srv.close();
})();
