// Title -> New game wizard through real clicks (every race picked once at step 1 for portraits), Begin, play 3 turns, save via Game menu, quit, Continue from title, Load screen.
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const PORT = +process.env.PORT || 8811; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html`); await sleep(1500);
  const btn = async re => page.evaluate(r => { const b = [...document.querySelectorAll('button')].filter(b => b.offsetParent && !b.disabled).find(b => new RegExp(r, 'i').test(b.textContent.trim())); if (b) { b.click(); return b.textContent.trim(); } return null; }, re);
  console.log('title buttons', await page.evaluate(() => [...document.querySelectorAll('.menu-list button')].map(b => b.textContent.trim())));
  await page.screenshot({ path: '/tmp/claude-0/wiz-title.png' });
  console.log('click New game ->', await btn('^New game'));
  await sleep(1200); await page.screenshot({ path: '/tmp/claude-0/wiz-1.png' });
  console.log('screen', await page.evaluate(() => MOO.UI.Screens.current.id));
  // step through; on each step screenshot and dump visible buttons
  for (let s = 0; s < 6; s++) {
    const info = await page.evaluate(() => ({ btns: [...document.querySelectorAll('.screen.active button')].filter(b => b.offsetParent && !b.disabled).map(b => b.textContent.trim().replace(/\s+/g, ' ').slice(0, 20)).slice(0, 40) }));
    console.log('step', s, JSON.stringify(info.btns).slice(0, 700));
    if (s === 1) { const n = await page.evaluate(() => document.querySelectorAll('.su-race, [data-race]').length); for (let i = 0; i < Math.min(n, 10); i++) { await page.evaluate(i => { const e = document.querySelectorAll('.su-race, [data-race]')[i]; e && e.click(); }, i); await sleep(350); if (i === 3 || i === 9) await page.screenshot({ path: `/tmp/claude-0/wiz-race${i}.png` }); } }
    if (s === 0) {
      // try every race tile
      const n = await page.evaluate(() => document.querySelectorAll('.screen.active [data-race], .screen.active .su-race').length); console.log('race tiles', n);
    }
    const r = await btn('^(Next|Begin)'); console.log('  advance ->', r); await sleep(900);
    await page.screenshot({ path: `/tmp/claude-0/wiz-${s + 2}.png` });
    if (await page.evaluate(() => MOO.UI.Screens.current.id) !== 'setup') break;
  }
  await sleep(2500);
  console.log('screen after begin', await page.evaluate(() => MOO.UI.Screens.current.id), 'hasGame', await page.evaluate(() => MOO.Game.hasGame()));
  const b = bot.start(page, {});
  for (let i = 0; i < 3; i++) { const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(() => 1)), sleep(40000).then(() => 0)]); console.log('turn', i, r); await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
  b.stop();
  // save via Game menu (G) -> Save
  await page.keyboard.press('g'); await sleep(500); await page.screenshot({ path: '/tmp/claude-0/wiz-gamemenu.png' });
  console.log('menu items', await page.evaluate(() => [...document.querySelectorAll('.gm-list button')].map(b => b.textContent.trim())));
  await page.keyboard.press('s'); await sleep(700); await page.screenshot({ path: '/tmp/claude-0/wiz-save.png' });
  console.log('save modal btns', await page.evaluate(() => [...document.querySelectorAll('.scrim button')].map(b => b.textContent.trim().replace(/\s+/g, ' ')).slice(0, 14)));
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(300);
  const sig = await page.evaluate(() => { MOO.Game.saveSlot(2); const S = MOO.Game.S; return { turn: S.turn, bc: MOO.Game.player().bc, n: S.planets.filter(p => p.owner === 0).length }; });
  console.log('state before quit', JSON.stringify(sig));
  await page.evaluate(() => MOO.Game.quitToMenu()); await sleep(800);
  console.log('title after quit:', await page.evaluate(() => [...document.querySelectorAll('.menu-list button')].map(b => b.textContent.trim())), await page.evaluate(() => document.querySelector('.menu-meta').textContent));
  console.log('Continue ->', await btn('^Continue')); await sleep(1500);
  console.log('after continue', await page.evaluate(() => ({ scr: MOO.UI.Screens.current.id, turn: MOO.Game.S && MOO.Game.S.turn, bc: MOO.Game.S && MOO.Game.player().bc })));
  await page.evaluate(() => MOO.UI.Screens.go('saveload', { mode: 'load', from: 'galaxy' })); await sleep(800); await page.screenshot({ path: '/tmp/claude-0/wiz-load.png' });
  console.log('load screen btns', await page.evaluate(() => [...document.querySelectorAll('.screen.active button')].map(b => b.textContent.trim().replace(/\s+/g, ' ')).slice(0, 20)));
  console.log('load slot 2', await page.evaluate(() => MOO.Game.loadSlot(2))); await sleep(800);
  const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(() => MOO.Game.S.turn)), sleep(40000).then(() => 'TIMEOUT')]); console.log('turn after load ->', r);
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
