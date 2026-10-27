// Race photos in situ: for every race, screenshots of the Races cards, the Report and the audience with that race, plus the Almanac once,
// with the art rectangles (and the audience's fixed regions) in a JSON so racesite.py can measure the art against its surround.
// node racesite.js <tag>     → tools/out/racesite/<tag>-<race>-<site>.png + .json
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'out', 'racesite'); fs.mkdirSync(OUT, { recursive: true });
const tag = process.argv[2] || 'x';
const PORT = 8000 + (process.pid % 700);
const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
const contact = `(()=>{const S=MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id!==o.id) MOO.Sim.Diplo.rec(S,E.id,o.id).contact=true;})()`;
const rects = sel => `(()=>{ const out=[]; document.querySelectorAll(${JSON.stringify(sel)}).forEach((el,i)=>{ const r=el.getBoundingClientRect(); if (r.width>4&&r.height>4) out.push({i, x:r.x, y:r.y, w:r.width, h:r.height, race: el.dataset.race||(el.closest('[data-race]')||{}).dataset?.race||'' }); }); return out; })()`;
(async () => {
  const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=2`); await sleep(5000);
  // the Almanac: all ten portraits at once
  await page.evaluate(`MOO.UI.Screens.go('help', { from: 'galaxy' })`); await sleep(2500);
  const al = await page.evaluate(`(()=>{ const out=[]; document.querySelectorAll('.al-race').forEach(el=>{ const cv=el.querySelector('canvas'); if(!cv) return; const r=cv.getBoundingClientRect(); const nm=(el.querySelector('b, h3, .nm, strong')||el).textContent.trim().split(/\\s+/)[0].toLowerCase(); out.push({x:r.x,y:r.y,w:r.width,h:r.height,race:nm}); }); return out; })()`);
  await page.screenshot({ path: path.join(OUT, tag + '-all-almanac.png') }); fs.writeFileSync(path.join(OUT, tag + '-all-almanac.json'), JSON.stringify(al));
  for (let i = 0; i < RACES.length; i++) {
    const r1 = RACES[i], r2 = RACES[(i + 1) % 10], r3 = RACES[(i + 2) % 10];
    await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=2`); await sleep(4500);   // a fresh page: the Races cards cache their portraits per empire
    await page.evaluate(`(()=>{ const S=MOO.Game.S; const E=S.empires; E[1].race='${r1}'; E[2].race='${r2}'; E[3].race='${r3}'; ${contact}; })()`);
    // Races cards (three opponents)
    await page.evaluate(`MOO.UI.Screens.go('galaxy', {})`); await sleep(600);
    await page.evaluate(`MOO.UI.Screens.go('races', { from: 'galaxy' })`); await sleep(2500);
    const rc = await page.evaluate(`(()=>{ const out=[]; document.querySelectorAll('.rc-slot').forEach((sl,j)=>{ const cv=sl.querySelector('.rc-pic canvas'); if(!cv) return; const r=cv.getBoundingClientRect(), f=sl.getBoundingClientRect(); out.push({x:r.x,y:r.y,w:r.width,h:r.height, fx:f.x,fy:f.y,fw:f.width,fh:f.height, race:['${r1}','${r2}','${r3}'][j]||''}); }); const v=[...document.querySelectorAll('.rc-void .hw')].map(el=>{const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};}); return { pics: out, voids: v }; })()`);
    await page.screenshot({ path: path.join(OUT, `${tag}-${r1}-races.png`) }); fs.writeFileSync(path.join(OUT, `${tag}-${r1}-races.json`), JSON.stringify(rc));
    // Report on empire 1
    await page.evaluate(`MOO.UI.Screens.go('report', { from: 'galaxy', target: 1, id: 1 })`); await sleep(2500);
    const rp = await page.evaluate(`(()=>{ const q=s=>{const el=document.querySelector(s); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};}; return { pic:q('.rp-pic canvas'), doss:q('.rp-dossier'), left:q('.rp-left') }; })()`);
    await page.screenshot({ path: path.join(OUT, `${tag}-${r1}-report.png`) }); fs.writeFileSync(path.join(OUT, `${tag}-${r1}-report.json`), JSON.stringify(rp));
    // audience with empire 1
    await page.evaluate(`MOO.UI.Screens.go('galaxy', {})`); await sleep(500);
    await page.evaluate(`void MOO.UI.Audience.open(1, { from: 'galaxy' })`); await sleep(6000);
    await page.screenshot({ path: path.join(OUT, `${tag}-${r1}-audience.png`) });
    try { await page.keyboard.press('Escape'); } catch (e) { /* ignore */ } await sleep(800);
    try { await page.evaluate(`MOO.UI.Screens.go('galaxy', {})`); } catch (e) { /* ignore */ } await sleep(600);
    console.log('done', r1);
  }
  console.log('errors', JSON.stringify([...new Set(errors)].filter(x => !/fonts\.g|swiftshader|GPU stall|willReadFrequently|inst-spaceport|api\/status/i.test(x)).slice(0, 6)));
  await browser.close(); srv.close();
})();
