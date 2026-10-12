// Galactic Council through real turn: force a session, vote for a rival candidate so a human verdict (accept / defy) is needed.
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
(async () => {
  const PORT = +process.env.PORT || 8817; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  for (const [stance, seed] of [['y', 'c1'], ['n', 'c2'], ['y', 'c3'], ['n', 'c4']]) {
    await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=small&opp=3&seed=${seed}&turns=60`); await sleep(1500);
    await page.evaluate(() => { const C = MOO.Sim.Council; window.__due = C.due; C.due = () => { C.due = window.__due; return true; }; C.aiVote = (S, E, cand) => cand[0]; });
    const p = page.evaluate(() => MOO.Game.endTurn().then(r => ({ ints: r.interrupts.filter(x => /council|gameover/.test(x)), over: r.over && r.over.reason })));
    let done = false; p.then(() => { done = true; });
    let k = 0, log = [];
    while (!done && k++ < 200) {
      const st = await page.evaluate(() => ({ scr: MOO.UI.Screens.current.id, modal: !!document.querySelector('.scrim .modal'), prompt: (document.querySelector('.cn-hint, .cn-cap, [class*=cn-]') || {}).textContent }));
      if (st.scr === 'council') {
        const keys = stance === 'y' ? ['2', '1', '0', 'y', 'Space'] : ['2', '1', '0', 'n', 'Space'];
        await page.keyboard.press(keys[k % keys.length]);
        if (k % 12 === 0) await page.screenshot({ path: `/tmp/claude-0/council-${stance}-${seed}-${k}.png` });
      } else if (st.scr === 'endings') { await page.evaluate(() => { const b = [...document.querySelectorAll('.end-act button')]; b.length ? b[b.length - 1].click() : 0; }); await page.keyboard.press('Space'); }
      else if (st.scr !== 'galaxy') await page.keyboard.press('Space');
      await page.evaluate(() => { const m = [...document.querySelectorAll('.scrim .modal')].pop(); if (m) { const b = [...m.querySelectorAll('.modal-f button')]; (b.find(x => x.classList.contains('primary')) || b[b.length - 1]).click(); } });
      await sleep(350);
    }
    const res = await Promise.race([p, sleep(3000).then(() => 'unfinished')]);
    console.log(stance, seed, JSON.stringify(res), JSON.stringify(await page.evaluate(() => { const S = MOO.Game.S; return S ? { fw: !!(S.diplo && S.diplo.finalWar), refusers: S.diplo && S.diplo.refusers, over: !!S.gameOver, scr: MOO.UI.Screens.current.id } : null; })));
  }
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
