// Spy steal / sabotage choices through the real turn pipeline: put many spies on every rival (espionage then sabotage), end turns with the bot answering the panels.
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const PORT = +process.env.PORT || 8813; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=4&seed=spy1&turns=30&diff=average`); await sleep(1500);
  await page.evaluate(() => { const S = MOO.Game.S, me = MOO.Game.player(); for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; me.bc = 9999; for (let t = 1; t < S.empires.length; t++) { me.spies[t] = 25; me.spyBudget[t] = 20; me.spyMode[t] = 1; } });
  const b = bot.start(page, { verbose: true });
  for (let mode = 1; mode <= 2; mode++) {
    await page.evaluate(m => { const me = MOO.Game.player(), S = MOO.Game.S; for (let t = 1; t < S.empires.length; t++) { me.spyMode[t] = m; me.spies[t] = 25; } }, mode);
    for (let i = 0; i < 6; i++) { const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(r => r.interrupts.filter(x => /spy|notice/.test(x)).length)), sleep(40000).then(() => 'TIMEOUT')]); console.log('mode', mode, 'turn', i, r); if (r === 'TIMEOUT') break; await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
    await page.screenshot({ path: `/tmp/claude-0/spy-${mode}.png` });
  }
  b.stop(); console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
