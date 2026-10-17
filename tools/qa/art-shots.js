// Art audit: one screenshot per screen where graphics appear, through the real UI. usage: node art-shots.js [WxH]
// TIER=medium forces the GL renderers on software GL (the look real hardware gets). Output: tools/out/art/<name>[-<tier>].png
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const [wh = '1920x1080'] = process.argv.slice(2); const [W, H] = wh.split('x').map(Number);
  const OUT = path.resolve(__dirname, '../out/art'); fs.mkdirSync(OUT, { recursive: true });
  const PORT = +process.env.PORT || 8799; const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: W, height: H } });
  const tag = process.env.TIER ? '-' + process.env.TIER : '', slow = process.env.TIER ? 4 : 1;   // software GL is slow: wait longer
  const shot = async n => { await page.screenshot({ path: `${OUT}/${n}${tag}.png` }); console.log('shot', n); };
  const base = `http://localhost:${PORT}/index.html`;
  const go = async (u, ms) => { await page.goto(u); await sleep(ms * slow); };
  const tryShot = async (name, fn, ms = 2500) => { const b = errors.length; try { await fn(); await sleep(ms * slow); await shot(name); } catch (e) { console.log('FAIL', name, e.message); } const e = errors.slice(b).filter(x => !/willReadFrequently|GPU stall/.test(x)); if (e.length) console.log('  errs', name, [...new Set(e)].slice(0, 5)); };
  const next = async () => { for (const b of await page.$$('button')) { const t = (await b.textContent()).trim(); if (/^(next|continue)/i.test(t)) { await b.click(); return; } } };

  await tryShot('menu', () => go(base, 4000));
  await tryShot('setup-1', () => page.evaluate(() => MOO.UI.Screens.go('setup')));
  await tryShot('setup-2', next); await tryShot('setup-3', next);

  await go(`${base}?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=30`, 4000);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  await tryShot('galaxy', () => page.evaluate(() => MOO.UI.Screens.go('galaxy')), 3000);
  await tryShot('galaxy-zoom', async () => { await page.mouse.move(W * 0.4, H * 0.5); for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -300); await sleep(300); } }, 2500);
  for (const s of ['system', 'design', 'fleets', 'planets', 'mapoverview', 'tech', 'techtree', 'races', 'report', 'status', 'specs', 'help', 'council'])
    await tryShot(s, () => page.evaluate(id => MOO.UI.Screens.go(id, { from: 'galaxy' }), s), s === 'system' ? 4000 : 2500);
  await tryShot('audience', async () => { await page.evaluate(() => { void MOO.UI.Audience.open(1, { from: 'galaxy' }); }); await sleep(3500); for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await sleep(250); } }, 800);
  await tryShot('techscene-break', () => page.evaluate(() => { const t = MOO.Sim.Research.techAt(3, 2); void MOO.Game.handlers.tech({ type: 'tech', empire: 0, field: 3, level: 2, id: t && t.id, source: 'research' }); }), 4500);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Space'); await sleep(800); }
  await tryShot('techscene-choose', () => page.evaluate(() => { const R = MOO.Sim.Research; const ch = [2, 3, 4].map(l => ({ level: l, cost: 100 * l, tech: R.techAt(4, l) })).filter(c => c.tech); void MOO.Game.handlers.techChoice({ type: 'techChoice', empire: 0, field: 4, choices: ch, manual: true }); }), 4500);
  await page.keyboard.press('Escape'); await sleep(800);
  await tryShot('gnn', () => page.evaluate(() => MOO.UI.Screens.go('gnn', { from: 'galaxy' })), 5000);
  for (const [reason, winner] of [['council', 0], ['conquest', 0], ['defeat', 1], ['exile', 1]])
    await tryShot('ending-' + reason, async () => { await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(300); await page.evaluate(([r, w]) => { void MOO.Game.handlers.gameover({ type: 'gameover', reason: r, winner: w, canContinue: true }); }, [reason, winner]); await sleep(2500); for (let i = 0; i < 2; i++) { await page.keyboard.press('Space'); await sleep(1500); } }, 2000);
  for (const k of ['colony', 'invade', 'bomb'])
    await tryShot('landing-' + k, async () => { await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(300); await page.evaluate(k => { void MOO.UI.Ground.demo(k); }, k); await sleep(k === 'colony' ? 2800 : 4000); }, 500);
  for (const scn of ['planet', 'big', 'nebula']) await tryShot('combat-' + scn, () => go(`${base}?dev=1&screen=combat&scn=${scn}`, 5000), 500);
  console.log('ERRORS', [...new Set(errors)].filter(x => !/willReadFrequently|GPU stall/.test(x)).slice(0, 30));
  await browser.close(); srv.close();
})();
