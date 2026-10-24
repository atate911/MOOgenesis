// Spy panels with synthetic interrupts (steal, sabotage, frame dialog, result card, victim notices, caught table)
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8814; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=4&seed=spy1&turns=30`); await sleep(1500);
  await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
  const clickIn = (sel, n = 0) => page.evaluate(([sel, n]) => { const b = [...document.querySelectorAll(sel)].filter(b => !b.disabled)[n]; if (b) b.click(); return !!b; }, [sel, n]);
  // steal
  await page.evaluate(() => { window.__r = null; const names = ['Fusion Beam', 'Deflector Shield', 'Hyperdrive', 'Cloning', 'Neural Scanner', 'Ion Pulse']; const it = { type: 'spyStealChoice', target: 1, race: 'x', n: 3, anyCaught: true, frame: true, frameChoices: [{ empire: 2, race: 'y', name: 'Psilon' }, { empire: 3, race: 'z', name: 'Silicoid' }],
    candidates: [0, 1, 2, 3, 4, 5].map(f => ({ field: f, fieldName: 'F' + f, level: 5 + f, id: 'x' + f, name: names[f], desc: 'Plans for ' + names[f], value: 10 })), answer: p => { window.__r = p; return { granted: null, aborted: false, blamed: -1, framed: -1 }; } };
    MOO.UI.Spy.steal(it).then(v => { window.__pick = v; }); });
  await sleep(700); await page.screenshot({ path: '/tmp/claude-0/spy-steal.png' });
  console.log('steal click', await clickIn('.spy-fld', 2)); await sleep(500); await page.screenshot({ path: '/tmp/claude-0/spy-frame.png' });
  console.log('frame click', await clickIn('.modal button', 0)); await sleep(600);
  console.log('answer', JSON.stringify(await page.evaluate(() => window.__r)), 'pick', JSON.stringify(await page.evaluate(() => window.__pick)), 'modal open', await page.evaluate(() => !!document.querySelector('.scrim .modal')));
  await page.evaluate(() => { document.querySelectorAll('.scrim .modal-f button').forEach(b => b.click()); });
  // sabotage
  await page.evaluate(() => { window.__r = null; const it = { type: 'spySabotageChoice', target: 1, n: 4, units: 12, anyCaught: false, frame: false, frameChoices: [], planets: [{ planet: 3, star: 3, name: 'Alpha', pop: 40, factories: 50, bases: 2, unrest: 0, rebels: 0, canIncite: true }, { planet: 4, star: 4, name: 'Beta', pop: 20, factories: 0, bases: 0, unrest: 1, rebels: 0, canIncite: false }],
    answer: p => { window.__r = p; return { planet: 3, action: 'factories', destroyed: 8, none: false, blamed: -1, framed: -1, penalty: 0 }; } };
    MOO.UI.Spy.sabotage(it).then(v => { window.__pick = v; }); });
  await sleep(700); await page.screenshot({ path: '/tmp/claude-0/spy-sab.png' });
  console.log('sab click', await clickIn('.spy-act button', 0)); await sleep(800); await page.screenshot({ path: '/tmp/claude-0/spy-sabres.png' });
  await page.evaluate(() => { document.querySelectorAll('.scrim .modal-f button').forEach(b => b.click()); }); await sleep(400);
  console.log('answer', JSON.stringify(await page.evaluate(() => window.__r)));
  // victim notices
  for (const ev of [{ kind: 'techStolen', by: 1, tech: 'Fusion Beam' }, { kind: 'sabotage', by: -1, action: 'factories', n: 5, planet: 0 }, { kind: 'sabotage', by: 2, action: 'revolt', rebellion: true, planet: 0 }, { kind: 'spiesCaught', by: 1 }, { kind: 'spyNothing', target: 1 }]) {
    await page.evaluate(ev => { MOO.UI.Spy.victimNotice(Object.assign({ type: 'notice', empire: 0 }, ev)); }, ev); await sleep(500);
    await page.evaluate(() => { document.querySelectorAll('.scrim .modal-f button').forEach(b => b.click()); }); await sleep(300);
  }
  await page.evaluate(() => { void MOO.UI.Spy.caught(); }); await sleep(500); await page.screenshot({ path: '/tmp/claude-0/spy-caught.png' });
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
