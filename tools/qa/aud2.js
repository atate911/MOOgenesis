// AI-initiated audiences: harvest every distinct interrupt (kind) the engine produces (Diplo.turn under many relation states), then show each through UI.Audience.show and answer every option.
const { serve, open, sleep } = require('./lib');
(async () => {
  const PORT = +process.env.PORT || 8816; const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=4&seed=aud2&turns=40`); await sleep(1500);
  const harvest = await page.evaluate(() => {
    const S = MOO.Game.S, D = MOO.Sim.Diplo, list = [];
    for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) D.rec(S, E.id, o.id).contact = true;
    const AR = [{ id: 'accept', label: 'Accept' }, { id: 'reject', label: 'Reject' }], OK = [{ id: 'ok', label: 'OK' }], tech = { field: 1, level: 3, name: 'Reinforced Hull', id: 'x' };
    const mk = (kind, type, vars, options, extra) => Object.assign({ type: 'diplomacy', from: 1, to: 0, kind, msgType: type, text: D.say(S, 1, 0, D.situation(type), vars || {}, type), options: options || OK, greeting: D.say(S, 1, 0, 'greeting', {}, 22), info: {} }, extra || {});
    const defs = [['offerNap', 24, { treaty: 'non-aggression pact' }, AR, { treatyName: 'non-aggression pact' }], ['offerAlliance', 25, { treaty: 'alliance' }, AR, { treatyName: 'alliance' }], ['offerTrade', 26, { bc: 150, treaty: 'trade agreement' }, AR, { info: { bc: 150 } }],
      ['askPeace', 30, {}, AR, { treatyName: 'peace' }], ['askPeaceOffer', 30, {}, AR, { incentive: { bc: 200 }, offer: { bc: 200 }, kind: 'askPeace' }], ['offerNapTech', 24, {}, AR, { incentive: { tech }, offer: { tech }, kind: 'offerNap' }],
      ['techSwap', 29, { tech: tech.name }, [{ id: 'swap:1:3', label: 'Reinforced Hull', field: 1, level: 3 }, { id: 'swap:2:4', label: 'Deflector', field: 2, level: 4 }, { id: 'reject', label: 'Reject' }], { info: { want: { field: 0, level: 5, name: 'Fusion Beam' }, offers: [] } }],
      ['bounty', 28, { race3: 'Silicoids', tech: 'Fusion Beam', bc: 300 }, OK, { info: { target: 2, bc: 300, tech: { field: 0, level: 5, name: 'Fusion Beam' } } }], ['bountyPaid', 58, { bc: 300, tech: 'x' }, OK, { info: { paid: { bc: 300 }, target: 2 } }],
      ['callToArms', 76, { race3: 'Silicoids' }, [{ id: 'agree', label: 'Agree' }, { id: 'refuse', label: 'Forget It' }], { info: { target: 2 } }], ['demandBreak', 27, { race3: 'Silicoids', leader3: 'Zed' }, [{ id: 'agree', label: 'Agree' }, { id: 'forget', label: 'Forget It' }], { info: { target: 2 } }],
      ['allyThanks', 78, {}, OK], ['allyBreaks', 77, { treaty: 'alliance' }, OK], ['warDeclared', 13, {}, OK, { info: { treaty: 3 } }], ['firstContact', 14, {}, OK], ['treatyCancelled', 32, { treaty: 'non-aggression pact' }, OK], ['complaint', 5, { star: 'Sol' }, OK], ['warning', 44, { star: 'Sol' }, OK]];
    for (const [k, type, vars, opts, extra] of defs) list.push({ k, it: mk(extra && extra.kind || k, type, vars, opts, extra) });
    window.__list = list; return list.map(x => x.k);
  });
  console.log('harvested', JSON.stringify(harvest));
  const n = Array.isArray(harvest) ? harvest.length : 0;
  for (let i = 0; i < n; i++) {
    const before = errors.length;
    await page.evaluate(i => { window.__ans = 'pending'; const it = Object.assign({}, window.__list[i].it); it.answer = v => { window.__ans = v; }; MOO.UI.Audience.show(it).then(v => { window.__res = v; window.__ans = window.__ans === 'pending' ? 'ret:' + v : window.__ans; window.__fin = true; }); window.__fin = false; }, i);
    await sleep(900);
    if (i % 3 === 0) await page.screenshot({ path: `/tmp/claude-0/aud2-${i}.png` });
    let ok = false;
    for (let t = 0; t < 30 && !ok; t++) {
      const st = await page.evaluate(() => ({ items: [...document.querySelectorAll('.au-item')].filter(b => !b.disabled).length, fin: window.__fin }));
      if (st.fin) { ok = true; break; }
      if (st.items) await page.evaluate(() => { const b = [...document.querySelectorAll('.au-item')].filter(b => !b.disabled); b[Math.floor(Math.random() * b.length)].click(); });
      else await page.keyboard.press('Space');
      await sleep(500);
    }
    console.log(i, harvest[i], ok ? 'done' : 'STUCK', 'result', JSON.stringify(await page.evaluate(() => window.__res)), errors.slice(before));
    await sleep(500);
  }
  console.log([...new Set(errors)]); await browser.close(); srv.close();
})();
