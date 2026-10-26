// Which screens need scrolling on a phone, and how much: per screen (and the galaxy sheet states, the game menu, the three new-game steps) the
// scroll containers whose content is taller than they are, as height→needed (pages). usage: node tools/qa/scroll.js [portrait|small]
// Screenshots: /tmp/claude-0/scroll-<mode>-<screen>.png. Portrait is a 390x844 phone, small a 360x740 one; a 30-turn dev game with contact.
const { serve, open, sleep } = require('./lib');
const mode = process.argv[2] || 'portrait';
(async () => {
  const srv = await serve(9060 + (mode === 'small' ? 1 : 0)); const { browser, page } = await open({ phone: mode === 'small' ? 'small' : true });
  await page.goto('http://localhost:' + (9060 + (mode === 'small' ? 1 : 0)) + '/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=30'); await sleep(2500);
  await page.evaluate(() => { MOO.UI.closeAllModals(); const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  const measure = () => page.evaluate(() => {
    const scope = [...document.querySelectorAll('.scrim .modal')].pop() || document.querySelector('.screen.active'); if (!scope) return [];
    const out = [];
    for (const e of [scope, ...scope.querySelectorAll('*')]) {
      const cs = getComputedStyle(e); if (!/auto|scroll/.test(cs.overflowY)) continue;
      if (e.scrollHeight > e.clientHeight + 4 && e.clientHeight > 40) { const r = e.getBoundingClientRect(); if (r.width < 40) continue;
        out.push({ el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), h: Math.round(e.clientHeight), need: Math.round(e.scrollHeight), pages: +(e.scrollHeight / e.clientHeight).toFixed(2) }); }
    }
    return out;
  });
  const list = [['galaxy'], ['planets'], ['fleets'], ['specs'], ['tech'], ['techtree'], ['races'], ['report', { empire: 1 }], ['status'], ['mapoverview'], ['system'], ['help'], ['saveload'], ['options'], ['audience', { empire: 1 }], ['council'], ['design']];
  const rows = [];
  for (const [id, params] of list) {
    await page.evaluate(([id, p]) => { try { MOO.UI.Screens.go(id, Object.assign({ from: 'galaxy' }, p || {})); } catch (e) { console.error(e); } }, [id, params]); await sleep(1200);
    const cur = await page.evaluate(() => MOO.UI.Screens.current.id); if (cur !== id) { rows.push([id, '(not reachable: ' + cur + ')']); continue; }
    const m = await measure(); rows.push([id, m]); await page.screenshot({ path: '/tmp/claude-0/scroll-' + mode + '-' + id + '.png' });
    await page.evaluate(() => MOO.UI.closeAllModals());
  }
  // galaxy sheet states (colony) and the game menu / options modal
  await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(800);
  for (const st of ['half', 'full']) { await page.evaluate(s => { const G = MOO.Game; MOO.UI.Galaxy.selectStar(G.player().capital); const side = document.querySelector('.gx-side:not(.gx-float)'); side.phSheet.set(s); }, st); await sleep(700); rows.push(['galaxy sheet ' + st, await measure()]); await page.screenshot({ path: '/tmp/claude-0/scroll-' + mode + '-sheet-' + st + '.png' }); }
  await page.evaluate(() => { document.querySelector('.gx-side:not(.gx-float)').phSheet.set('strip'); MOO.UI.gameMenu(); }); await sleep(600); rows.push(['game menu', await measure()]); await page.screenshot({ path: '/tmp/claude-0/scroll-' + mode + '-gamemenu.png' }); await page.evaluate(() => MOO.UI.closeAllModals());
  // new-game wizard steps
  await page.evaluate(() => MOO.UI.Screens.go('setup', { from: 'menu' })); await sleep(900);
  for (let i = 0; i <= 2; i++) { await page.evaluate(i => { MOO.UI.Setup.go(i); }, i); await sleep(600); rows.push(['setup step ' + (i + 1), await measure()]); await page.screenshot({ path: '/tmp/claude-0/scroll-' + mode + '-setup' + i + '.png' }); }
  for (const [id, m] of rows) console.log(id.padEnd(18), typeof m === 'string' ? m : (m.length ? m.map(x => x.el + ' ' + x.h + '→' + x.need + ' (' + x.pages + '×)').join(' | ') : 'fits'));
  await browser.close(); srv.close();
})();
