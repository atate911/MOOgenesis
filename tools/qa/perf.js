// Per-turn wall time on a big AI-played map (real UI pipeline). usage: node perf.js [turns] [size] [opp]
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const [turns = 20, size = 'huge', opp = 5] = process.argv.slice(2);
  const PORT = +process.env.PORT || 8871; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=psilon&size=${size}&opp=${opp}&seed=pf&diff=hard&ai=1&turns=0`); await sleep(1500);
  await page.evaluate(() => { const H = MOO.Game.handlers; window.__int = []; for (const k of Object.keys(H)) { const f = H[k]; H[k] = async function (it) { window.__int.push(k); window.__cur = k; const r = await f.apply(this, arguments); window.__cur = null; return r; }; } });
  const b = bot.start(page, {}); const t = [];
  for (let i = 0; i < +turns; i++) { const t0 = Date.now(); const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(r => r.ms | 0)), sleep(90000).then(() => 'TIMEOUT')]); t.push(r === 'TIMEOUT' ? 'T/O' : Date.now() - t0); if (i % 20 === 19) console.log('turn', i + 1, 'avg ms', Math.round(t.slice(-20).reduce((a, x) => a + (+x || 0), 0) / 20), 'scr', await page.evaluate(() => MOO.UI.Screens.current.id + ' ' + (MOO.Game.last && MOO.Game.last.over ? 'OVER' : ''))); if (r === 'TIMEOUT') { console.log('STUCK', JSON.stringify(await page.evaluate(() => ({ cur: window.__cur, ints: window.__int.slice(-6), scr: MOO.UI.Screens.current.id, side: MOO.UI.Side.current(), turn: MOO.Game.S.turn })))); await page.screenshot({ path: '/tmp/claude-0/perf-stuck.png' }); break; } await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
  b.stop(); console.log('turn wall ms', t.join(' ')); console.log('mem MB', await page.evaluate(() => performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6)), 'turn', await page.evaluate(() => MOO.Game.S.turn));
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
