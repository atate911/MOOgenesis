// Scrap a design with ships in orbit (real UI): select fleet, open design screen, click Scrap on that card, confirm; verify state + that galaxy/fleet screens survive.
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8792; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=10`);
  await sleep(1200);
  const pre = await page.evaluate(() => { const S = MOO.Game.S, me = MOO.Game.player(); MOO.Sim.Fleet.addShips(S, 0, me.capital, 2, 3); const f = MOO.Sim.Fleet.at(S, me.capital, 0); MOO.Game.sel.fleet = f.id; MOO.Game.sel.star = me.capital; return { bc: me.bc, fleet: f.id, ships: f.ships.slice() }; });
  console.log('pre', JSON.stringify(pre));
  await page.evaluate(() => MOO.UI.Screens.go('design', { from: 'galaxy' })); await sleep(800);
  await page.screenshot({ path: '/tmp/claude-0/scrap-1.png' });
  // click Scrap on card 3 (Destroyer)
  await page.evaluate(() => { const c = document.querySelectorAll('.dz-card')[2]; [...c.querySelectorAll('button')].find(b => /scrap/i.test(b.textContent)).click(); });
  await sleep(500); await page.screenshot({ path: '/tmp/claude-0/scrap-2.png' });
  console.log('modal:', await page.evaluate(() => (document.querySelector('.scrim .modal') || {}).textContent));
  await page.evaluate(() => { const m = document.querySelector('.scrim .modal'); const b = [...m.querySelectorAll('.modal-f button')]; (b.find(x => /scrap|ok|yes/i.test(x.textContent) && !/cancel/i.test(x.textContent)) || b[b.length - 1]).click(); });
  await sleep(600);
  const post = await page.evaluate(() => { const S = MOO.Game.S, me = MOO.Game.player(); return { bc: me.bc, fleets: S.fleets.filter(f => f.owner === 0).map(f => f.id + ':' + f.ships.join('/')), sel: MOO.Game.sel, designs: me.designs.map(d => d && d.name) }; });
  console.log('post', JSON.stringify(post));
  for (const s of ['galaxy', 'fleets', 'specs', 'planets']) { await page.evaluate(id => MOO.UI.Screens.go(id, { from: 'galaxy' }), s); await sleep(500); }
  await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(400);
  await page.screenshot({ path: '/tmp/claude-0/scrap-3.png' });
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
