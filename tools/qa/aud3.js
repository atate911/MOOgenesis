// Tribute / threat / tech exchange paths in the player-initiated audience, printing text + menu after every click.
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8821; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=40`); await sleep(1500);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; MOO.Game.player().bc = 800; });
  const state = () => page.evaluate(() => ({ txt: (document.querySelector('.au-text') || {}).textContent, items: [...document.querySelectorAll('.au-item')].map(b => (b.disabled ? '!' : '') + b.textContent.trim().replace(/\s+/g, ' ')), terms: (document.querySelector('.au-terms') || {}).textContent, note: (document.querySelector('.au-note') || {}).textContent, bc: MOO.Game.player().bc }));
  const dump = async l => { await sleep(1800); const s = await state(); console.log(l, '|', JSON.stringify((s.txt || '').slice(0, 90)), '| terms', s.terms, '| note', s.note, '| items', s.items.join(' / ').slice(0, 200), '| bc', s.bc); return s; };
  const click = async re => { for (let i = 0; i < 8; i++) { const s = await state(); const idx = s.items.findIndex(x => new RegExp(re, 'i').test(x) && !x.startsWith('!')); if (idx >= 0) { await page.evaluate(i => document.querySelectorAll('.au-item')[i].click(), idx); return true; } await page.keyboard.press('Space'); await sleep(400); } console.log('  no item', re); return false; };
  await page.evaluate(() => { void MOO.UI.Audience.open(1, { from: 'galaxy' }); }); await dump('open');
  for (const path of [['Offer Tribute', 'Gold', '.'], ['Offer Tribute', 'Technology', '.'], ['Exchange Tech', '.'], ['Threaten', 'Threaten To Attack']]) {
    console.log('PATH', path.join(' > '));
    for (const r of path) { if (!(await click(r))) break; await dump('  after ' + r); }
    await page.screenshot({ path: `/tmp/claude-0/aud3-${path[0].slice(0, 5)}.png` });
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await sleep(300); }
    // return to top menu
    for (let i = 0; i < 3; i++) { const s = await state(); if (s.items.some(x => /Propose Treaty/.test(x))) break; await page.keyboard.press('Escape'); await sleep(500); }
    if (!(await page.evaluate(() => MOO.UI.Audience.isOpen()))) { await page.evaluate(() => { void MOO.UI.Audience.open(1, { from: 'galaxy' }); }); await sleep(2000); }
  }
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
