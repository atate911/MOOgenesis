// Per-turn wall time on a big AI-played map (real UI pipeline). usage: node perf.js [turns] [size] [opp]
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const [turns = 20, size = 'huge', opp = 5] = process.argv.slice(2);
  const PORT = +process.env.PORT || 8871; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=psilon&size=${size}&opp=${opp}&seed=pf&diff=hard&ai=1&turns=0`); await sleep(1500);
  const b = bot.start(page, {}); const t = [];
  for (let i = 0; i < +turns; i++) { const t0 = Date.now(); const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(r => r.ms | 0)), sleep(90000).then(() => 'TIMEOUT')]); t.push(r === 'TIMEOUT' ? 'T/O' : Date.now() - t0); if (i % 20 === 19) console.log('turn', i + 1, 'avg ms', Math.round(t.slice(-20).reduce((a, x) => a + (+x || 0), 0) / 20), 'scr', await page.evaluate(() => MOO.UI.Screens.current.id + ' ' + (MOO.Game.last && MOO.Game.last.over ? 'OVER' : ''))); if (r === 'TIMEOUT') break; await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
  b.stop(); console.log('turn wall ms', t.join(' ')); console.log('mem MB', await page.evaluate(() => performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6)), 'turn', await page.evaluate(() => MOO.Game.S.turn));
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
