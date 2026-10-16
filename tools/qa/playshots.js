// Fun-audit click-through: plays N turns through the real UI with an AI policy driving the human seat's economy, screenshots every distinct interrupt screen
// (first MAXK of each kind, default 2) into $OUT, and logs per-turn wall time, bot clicks and quiet turns.  usage: node tools/qa/playshots.js [turns] [seed] [opp] [diff] [race]
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const { serve, open, sleep } = require(path.join(ROOT, 'tools/qa/lib'));
const bot = require('./bot');
const OUT = process.env.OUT || '/tmp/claude-0/fun-shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const [turns = 60, seed = 'fun1', opp = 3, diff = 'average', race = 'human'] = process.argv.slice(2);
  const port = +process.env.PORT || 8777;
  const srv = await serve(port);
  const { browser, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://localhost:${port}/index.html?dev=1&screen=galaxy&race=${race}&size=${process.env.SIZE || 'medium'}&opp=${opp}&seed=${seed}&diff=${diff}&turns=0${process.env.TACT ? '' : ''}`);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/00-galaxy-turn0.png` });
  await page.evaluate(() => {
    const H = MOO.Game.handlers; window.__int = []; window.__cur = null;
    for (const k of Object.keys(H)) { const f = H[k]; H[k] = async function (it, S) { const tag = k + (it && (it.kind || (it.field !== undefined ? 'f' + it.field : '')) ? ':' + (it.kind || it.field) : ''); window.__int.push(tag); window.__cur = tag; window.__curT = performance.now(); const r = await f.apply(this, arguments); window.__cur = null; return r; }; }
    // AI policy for the human seat: plan as an AI (orders validated as an AI's), everything else stays human
    window.__aiSeat = () => { const S = MOO.Game.S, E = S.empires[0]; if (!E.ai) E.ai = { countdown: 20, p2: 5, crowded: true }; E.human = false; try { const o = MOO.AI.plan(S, 0, MOO.AI.seedFor(S, 0)); MOO.Sim.Orders.applyAll(S, 0, o); } finally { E.human = true; } MOO.Sim.Econ.refresh(S); };
  });
  const shots = {}, MAXK = +(process.env.MAXK || 2), rows = [];
  const b = bot.start(page, { verbose: !!process.env.V, interval: +(process.env.INT || 900), onTick: async r => {
    const st = await page.evaluate(() => ({ cur: window.__cur, scr: MOO.UI.Screens.current && MOO.UI.Screens.current.id, side: MOO.UI.Side.current && MOO.UI.Side.current(), modal: (document.querySelector('.scrim .modal .modal-h, .scrim .modal h3, .scrim .modal h2') || {}).textContent || '' }));
    const key = (st.cur || st.scr + '/' + st.side + (st.modal ? '/' + st.modal.trim().slice(0, 20) : ''));
    if (!key || key === 'galaxy/default' || key === 'galaxy/colony' || key === 'galaxy/null') return;
    shots[key] = (shots[key] || 0) + 1;
    if (shots[key] <= MAXK) { const f = `${OUT}/${String(rows.length).padStart(3, '0')}-${key.replace(/[^a-z0-9]+/gi, '_')}-${shots[key]}.png`; try { await page.screenshot({ path: f }); } catch (e) {} }
  } });
  const t0 = Date.now();
  for (let i = 0; i < +turns; i++) {
    const alive = await page.evaluate(() => { const S = MOO.Game.S; return S && MOO.Game.player().alive && !(MOO.Game.last && MOO.Game.last.over); });
    if (!alive) { console.log('game over at turn', i); break; }
    await page.evaluate(() => window.__aiSeat());
    const c0 = b.stats.clicks, w0 = Date.now();
    const p = page.evaluate(() => MOO.Game.endTurn().then(r => r && { ints: r.interrupts, over: r.over && r.over.reason, ms: r.ms | 0 }));
    const res = await Promise.race([p, sleep(90000).then(() => 'TIMEOUT')]);
    const info = await page.evaluate(() => ({ t: MOO.Game.S.turn, scr: MOO.UI.Screens.current.id, col: MOO.Game.S.planets.filter(p => p.owner === 0).length }));
    const wall = Date.now() - w0, clicks = b.stats.clicks - c0;
    rows.push({ turn: info.t, wall, clicks, ints: res && res.ints ? res.ints.filter(x => x !== 'aiPlan').join(',') : String(res) });
    console.log(`T${String(info.t).padStart(3)} ${String(wall).padStart(6)}ms ${String(clicks).padStart(2)} clicks col${info.col}  ${rows[rows.length - 1].ints}`);
    if (res === 'TIMEOUT') { console.log('STUCK', await page.evaluate(() => ({ cur: window.__cur, side: MOO.UI.Side.current(), scr: MOO.UI.Screens.current.id }))); await page.screenshot({ path: `${OUT}/stuck.png` }); break; }
    if (res && res.over) { console.log('OVER', res.over); break; }
    if (info.scr !== 'galaxy') await page.evaluate(() => MOO.UI.Screens.go('galaxy'));
  }
  await page.screenshot({ path: `${OUT}/zz-galaxy-end.png` });
  const tot = rows.reduce((a, r) => a + r.wall, 0), cl = rows.reduce((a, r) => a + r.clicks, 0);
  console.log(`\nplayed ${rows.length} turns in ${(tot / 1000).toFixed(1)}s (${(tot / rows.length / 1000).toFixed(2)} s/turn), bot clicks ${cl} (${(cl / rows.length).toFixed(2)}/turn); quiet turns (no interrupt): ${rows.filter(r => !r.ints).length}`);
  console.log('shots:', JSON.stringify(shots));
  console.log('errors:', [...new Set(errors)].slice(0, 10));
  b.stop(); await browser.close(); srv.close();
})();
