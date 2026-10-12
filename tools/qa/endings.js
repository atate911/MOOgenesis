// The four endings through the real handler (Game.handlers.gameover) + two real triggers (conquest by eliminating rivals, defeat by losing every planet) via Game.endTurn.
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const PORT = +process.env.PORT || 8794; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  const boot = async () => { await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=small&opp=2&seed=abc&turns=10`); await sleep(1200); };
  await boot();
  for (const [reason, winner, canContinue] of [['council', 0, true], ['conquest', 0, true], ['defeat', 1, false], ['exile', 1, false]]) {
    await page.evaluate(([r, w, c]) => { window.__end = null; MOO.Game.handlers.gameover({ type: 'gameover', reason: r, winner: w, canContinue: c }).then(v => { window.__end = v; }); }, [reason, winner, canContinue]);
    await sleep(1500); await page.screenshot({ path: `/tmp/claude-0/end-${reason}-1.png` });
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Space'); await sleep(900); }
    await page.screenshot({ path: `/tmp/claude-0/end-${reason}-2.png` });
    const btns = await page.evaluate(() => [...document.querySelectorAll('.end-act button')].map(b => b.textContent.trim()));
    console.log(reason, 'buttons', btns, 'screen', await page.evaluate(() => MOO.UI.Screens.current.id));
    if (btns.includes('Keep playing')) await page.evaluate(() => [...document.querySelectorAll('.end-act button')].find(b => /keep/i.test(b.textContent)).click());
    else await page.evaluate(() => { const b = document.querySelector('.end-act button'); b && b.click(); });
    await sleep(1200);
    console.log('  ->', JSON.stringify(await page.evaluate(() => ({ end: window.__end, screen: MOO.UI.Screens.current.id, hasGame: MOO.Game.hasGame() }))));
    if (!(await page.evaluate(() => MOO.Game.hasGame()))) await boot();
    else await page.evaluate(() => MOO.UI.Screens.go('galaxy'));
  }
  // real conquest
  await boot();
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) if (E.id !== 0) { E.alive = false; } for (const p of S.planets) if (p.owner > 0) { p.owner = -1; p.pop = 0; } for (const f of S.fleets) if (f.owner > 0) f.ships = [0, 0, 0, 0, 0, 0]; });
  let b = bot.start(page, {});
  console.log('conquest endTurn:', JSON.stringify(await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(r => ({ ints: r.interrupts, over: r.over && r.over.reason }))), sleep(60000).then(() => 'TIMEOUT')])));
  b.stop();
  console.log('  screen', await page.evaluate(() => MOO.UI.Screens.current.id)); await page.screenshot({ path: '/tmp/claude-0/end-real-conquest.png' });
  // real defeat
  await boot();
  await page.evaluate(() => { const S = MOO.Game.S; for (const p of S.planets) if (p.owner === 0) { p.owner = -1; p.pop = 0; } for (const f of S.fleets) if (f.owner === 0) f.ships = [0, 0, 0, 0, 0, 0]; });
  b = bot.start(page, {});
  console.log('defeat endTurn:', JSON.stringify(await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(r => ({ ints: r.interrupts, over: r.over && r.over.reason }))), sleep(60000).then(() => 'TIMEOUT')])));
  b.stop(); await sleep(500);
  console.log('  screen', await page.evaluate(() => MOO.UI.Screens.current.id)); await page.screenshot({ path: '/tmp/claude-0/end-real-defeat.png' });
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
