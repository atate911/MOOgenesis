// Landing / ground / bombard demos (Landing.demo) and every event card (UI.Events.show) through real input. usage: node scenes.js [W H]
const { serve, open, sleep } = require('./lib');
(async () => {
  const W = +process.argv[2] || 1280, H = +process.argv[3] || 720;
  const PORT = +process.env.PORT || 8798; const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: W, height: H } });
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=25`);
  await sleep(1500);
  const track = () => page.evaluate(() => ({ scr: MOO.UI.Screens.current.id, modal: !!document.querySelector('.scrim .modal'), done: window.__done }));
  for (const kind of (process.env.KINDS || 'colony,invade,invadeLost,bomb,bombResult,bombBio,bombDestroy').split(',')) {
    const before = errors.length;
    await page.evaluate(k => { window.__done = false; MOO.UI.Ground.demo(k).then(v => { window.__done = JSON.stringify(v === undefined ? 'undef' : v); }); }, kind);
    let shots = 0;
    for (let i = 0; i < 40; i++) {
      await sleep(700); const t = await track();
      if (i === 4 || i === 12) await page.screenshot({ path: `/tmp/claude-0/scene-${kind}-${i}-${W}x${H}.png` });
      if (t.done) break;
      if (t.modal) await page.evaluate(() => { const b = document.querySelector('.scrim .modal .modal-f button.primary') || document.querySelector('.scrim .modal .modal-f button'); b && b.click(); });
      else { await page.keyboard.press(['Space', 'Enter', 'b'][i % 3]); }
    }
    console.log(kind, JSON.stringify(await track()), errors.slice(before));
    await sleep(300);
  }
  // event cards
  const kinds = ['plague', 'quake', 'nova', 'accident', 'assassin', 'virus', 'comet', 'pirates', 'derelict', 'rebellion', 'crystal', 'amoeba', 'poor', 'rich', 'support', 'enviro', 'coup', 'orion', 'guardian'];
  for (const k of kinds) for (const stage of ['start', 'end']) {
    const before = errors.length;
    await page.evaluate(([k, stage]) => { const S = MOO.Game.S; const p = S.planets.find(p => p.owner === 0); window.__done = false; MOO.UI.Events.show({ type: 'event', kind: k, stage, empire: 0, planet: p.id, star: p.starId, text: 'QA ' + k + ' ' + stage, vars: {} }).then(v => { window.__done = true; }); }, [k, stage]);
    await sleep(350);
    const txt = await page.evaluate(() => (document.querySelector('.scrim .modal') || {}).innerText);
    if (stage === 'start' && ['plague', 'nova', 'derelict', 'support'].includes(k)) await page.screenshot({ path: `/tmp/claude-0/event-${k}.png` });
    await page.evaluate(() => { const b = document.querySelector('.scrim .modal .modal-f button.primary') || document.querySelector('.scrim .modal .modal-f button'); b && b.click(); });
    await sleep(200);
    const e = errors.slice(before); if (e.length || !txt) console.log('EVENT', k, stage, 'text=', JSON.stringify((txt || '').slice(0, 80)), e);
  }
  console.log('done', [...new Set(errors)]); await browser.close(); srv.close();
})();
