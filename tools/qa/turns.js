// Plays N turns through the real UI (Game.endTurn + bot answering every interrupt). usage: node turns.js [turns] [seed] [opp] [diff] [race]
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const [turns = 60, seed = 'q1', opp = 4, diff = 'hard', race = 'human'] = process.argv.slice(2);
  const srv = await serve(+process.env.PORT || 8766);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${process.env.PORT || 8766}/index.html?dev=1&screen=galaxy&race=${race}&size=medium&opp=${opp}&seed=${seed}&diff=${diff}&turns=0`);
  await sleep(1200);
  await page.evaluate(() => { const H = MOO.Game.handlers; window.__int = []; for (const k of Object.keys(H)) { const f = H[k]; H[k] = async function (it, S) { window.__int.push(k + (it && (it.kind || it.field !== undefined && ('f' + it.field)) ? ':' + (it.kind || it.field) : '')); window.__cur = k; const r = await f.apply(this, arguments); window.__cur = null; return r; }; } });
  const b = bot.start(page, { verbose: !!process.env.V });
  const t0 = Date.now(); let last = '';
  for (let i = 0; i < +turns; i++) {
    const alive = await page.evaluate(() => { const S = MOO.Game.S; return S && MOO.Game.player().alive && !MOO.Game.last?.over; });
    if (!alive) { console.log('game over at turn', i); break; }
    const p = page.evaluate(() => MOO.Game.endTurn().then(r => r && { ints: r.interrupts.length, over: r.over && r.over.reason, ms: r.ms | 0 }));
    const res = await Promise.race([p, sleep(60000).then(() => 'TIMEOUT')]);
    const info = await page.evaluate(() => ({ t: MOO.Game.S.turn, scr: MOO.UI.Screens.current.id, busy: MOO.Game.busy, modal: !!document.querySelector('.scrim .modal') }));
    if (res === 'TIMEOUT') { console.log('STUCK turn', i, info, b.stats.seen.slice(-4), await page.evaluate(() => ({ cur: window.__cur, ints: window.__int.slice(-6), side: MOO.UI.Side.current(), card: (document.querySelector('.gx-side') || {}).innerText && document.querySelector('.gx-side').innerText.slice(0, 200), modals: document.querySelectorAll('.scrim').length }))); await page.screenshot({ path: '/tmp/claude-0/stuck.png' }); break; }
    if (res && res.over) { console.log('OVER', res); }
    if (info.scr !== 'galaxy') await page.evaluate(() => MOO.UI.Screens.go('galaxy'));
  }
  console.log('turns played', (Date.now() - t0) / 1000 | 0, 's; bot clicks', b.stats.clicks, JSON.stringify(b.stats.screens));
  const counts = {}; b.stats.seen.forEach(s => { const k = s.split(':')[0] + ':' + (s.split(':')[1] || '').slice(0, 30); counts[k] = (counts[k] || 0) + 1; }); console.log(counts);
  console.log([...new Set(errors)]);
  b.stop(); await browser.close(); srv.close();
})();
