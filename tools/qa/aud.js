// Diplomacy audience flows through the real UI: every menu path; reports the list of items at each step and any console errors.
const { serve, open, sleep } = require('./lib');
(async () => {
  const srv = await serve(8766);
  const { browser, page, errors } = await open();
  await page.goto('http://localhost:8766/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=40');
  await sleep(1200);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) { MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; } void MOO.UI.Audience.open(1, { from: 'galaxy' }); });
  await sleep(2500);
  const state = () => page.evaluate(() => ({ txt: (document.querySelector('.au-text') || {}).textContent, items: [...document.querySelectorAll('.au-item')].map(b => (b.disabled ? '!' : '') + b.textContent.trim().replace(/\s+/g, ' ')), terms: (document.querySelector('.au-terms') || {}).textContent, open: MOO.UI.Audience.isOpen(), screen: MOO.UI.Screens.current.id }));
  async function settle() { for (let i = 0; i < 12; i++) { await page.keyboard.press('Space'); await sleep(250); const s = await state(); if (s.items.length) return s; } return state(); }
  async function click(re) {
    let s = await settle();
    const idx = s.items.findIndex(x => new RegExp(re, 'i').test(x) && !x.startsWith('!'));
    if (idx < 0) { console.log('   NOT FOUND', re, '| have:', s.items.join(' | ')); return null; }
    await page.evaluate(i => document.querySelectorAll('.au-item')[i].click(), idx);
    await sleep(700);
    s = await settle();
    console.log('  >', re, '=>', JSON.stringify((s.txt || '').slice(0, 100)), '|', (s.terms || ''), '|', s.items.join(' | ').slice(0, 220));
    return s;
  }
  const paths = [['Propose Treaty', 'Non-Aggression'], ['Propose Treaty', 'Alliance'], ['Form Trade', '.'], ['Offer Tribute', '.'], ['Offer Tribute', '.'], ['Exchange Tech', '.'], ['Threaten', '.'], ['Propose Treaty', 'Declaration of War', '.'], ['Threaten', 'Break']];
  for (const p of paths) {
    console.log('PATH', p.join(' > '));
    for (const r of p) { const s = await click(r); if (!s) break; }
    await page.keyboard.press('Escape'); await sleep(500);
    const s = await state(); if (!s.open) { console.log('  audience closed; reopen'); await page.evaluate(() => { void MOO.UI.Audience.open(1, { from: 'galaxy' }); }); await sleep(2000); }
  }
  console.log(errors);
  await page.screenshot({ path: '/tmp/claude-0/aud.png' });
  await browser.close(); srv.close();
})();
