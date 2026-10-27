// The other race-photo sites: the council demo chamber (portraits in booths over the council hall), the New game race pick (portrait +
// homeworld plate) and the research breakthrough scene (the scientist plate). node racesite2.js <tag>
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'racesite'); fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'x';
const PORT = 8000 + (process.pid % 700);
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
const BOOT = `http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=2`;
const contact = `(()=>{const S=MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id!==o.id) MOO.Sim.Diplo.rec(S,E.id,o.id).contact=true;})()`;
(async () => {
  const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1920, height: 1080 } });
  // council demo chamber: three race sets cover the ten
  for (const set of [['darlok', 'psilon', 'alkari', 'meklar'], ['human', 'klackon', 'bulrathi', 'silicoid'], ['mrrshan', 'sakkra', 'darlok', 'psilon']]) {
    await page.goto(BOOT); await sleep(4500);
    await page.evaluate(`(()=>{ const E=MOO.Game.S.empires; ${JSON.stringify(set)}.forEach((r,i)=>{ if (E[i]) E[i].race=r; }); ${contact}; MOO.UI.Screens.go('council', { from: 'galaxy' }); })()`);
    await sleep(7000);
    await page.screenshot({ path: path.join(OUT, `${tag}-council-${set.join('-')}.png`) });
  }
  // New game race pick: every race's portrait and homeworld plate
  await page.goto(`http://localhost:${PORT}/index.html?dev=1`); await sleep(4000);
  await page.evaluate(`MOO.UI.Screens.go('setup', { step: 1 })`); await sleep(2500);   // step 1 is the race pick
  const ids = await page.evaluate(`[...document.querySelectorAll('button.su-race')].map(b => b.dataset.race || b.dataset.id || b.getAttribute('data-race') || b.textContent.trim().toLowerCase())`);
  console.log('race buttons', JSON.stringify(ids));
  for (let i = 0; i < ids.length; i++) {
    await page.evaluate(`document.querySelectorAll('button.su-race')[${i}].click()`); await sleep(1800);
    const r = await page.evaluate(`(()=>{ const q=s=>{const el=document.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};}; return { portrait:q('.su-portrait'), home:q('.su-homeart') }; })()`);
    const nm = (ids[i] || String(i)).replace(/[^a-z]/g, '');
    await page.screenshot({ path: path.join(OUT, `${tag}-setup-${nm}.png`) }); fs.writeFileSync(path.join(OUT, `${tag}-setup-${nm}.json`), JSON.stringify(r));
  }
  // research breakthrough scene for three player races
  for (const r of ['darlok', 'psilon', 'human']) {
    await page.goto(BOOT); await sleep(4500);
    try {
      await page.evaluate(`(()=>{ const S=MOO.Game.S; const me=S.empires[0]; me.race='${r}'; void MOO.UI.TechScenes.breakthrough({ empire: me.id, field: 'computers', tech: 'battle_computer_1', level: 2 }); })()`);
      await sleep(6500);
      await page.screenshot({ path: path.join(OUT, `${tag}-techscene-${r}.png`) });
    } catch (e) { console.log('techscene fail', r, e.message); }
  }
  console.log('errors', JSON.stringify([...new Set(errors)].filter(x => !/fonts\.g|swiftshader|GPU stall|willReadFrequently|inst-spaceport|api\/status/i.test(x)).slice(0, 8)));
  await browser.close(); srv.close();
})();
