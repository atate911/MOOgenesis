// Tech Lab UI check: the "Expanded technology" option in the new-game setup, an expansion tech on the tech screen (effects, art), the tech tree of an
// expanded game, and the in-game tech encyclopedia. usage: node tools/qa/techlab-shots.js   → tools/out/techlab/ui-*.png, console errors printed
const { serve, open, sleep } = require('./lib');
const fs = require('fs'), path = require('path');
(async () => {
  const OUT = path.resolve(__dirname, '../out/techlab'); fs.mkdirSync(OUT, { recursive: true });
  const PORT = +process.env.PORT || 8797; const srv = await serve(PORT);
  const { browser, page, errors } = await open({ viewport: { width: 1600, height: 900 } });
  const base = `http://localhost:${PORT}/index.html`;
  const shot = async n => { await page.screenshot({ path: `${OUT}/ui-${n}.png` }); console.log('shot', n); };
  try {
    // 1. setup: open the remake options panel
    await page.goto(base); await sleep(3500);
    await page.evaluate(() => MOO.UI.Screens.go('setup')); await sleep(1500);
    await page.evaluate(() => { const d = document.querySelector('.su-disc'); if (d) d.click(); }); await sleep(900);
    await page.evaluate(() => { const p = document.querySelector('.su-p-remake'); if (p) p.scrollIntoView({ block: 'center' }); }); await sleep(500);
    await shot('setup-options');
    const optText = await page.evaluate(() => [...document.querySelectorAll('.su-optrow-t b')].map(b => b.textContent));
    console.log('setup options:', optText.join(' | '));
    // 2. an expanded dev game, a few expansion techs owned and one in the choice list
    await page.goto(`${base}?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=lab&turns=30&pool=expanded`); await sleep(4500);
    const info = await page.evaluate(() => {
      const S = MOO.Game.S, E = MOO.Game.player(), X = MOO.Data.Techs.X, R = MOO.Sim.Research;
      const pick = id => X.list.find(t => t.id.endsWith(id));
      for (const id of ['asteroid-mining', 'stellar-survey-probes', 'pressure-domes', 'tactical-combat-analyzers']) { const t = pick(id); R.grant(S, E, t.field, t.level, 'qa'); }
      MOO.Sim.Econ.refresh(S);
      const mine = []; E.research.list.forEach((tiers, f) => tiers.forEach(tr => tr.forEach(l => { const t = MOO.Data.Techs.byFL[f][l]; if (t.pool === 'x') mine.push(t.name); })));
      return { pool: E.research.pool, inTree: mine };
    });
    console.log('player pool', info.pool, '· expansion techs in the tree:', info.inTree.length, info.inTree.slice(0, 8).join(', '));
    await page.evaluate(() => MOO.UI.Screens.go('tech', { from: 'galaxy' })); await sleep(2500);
    // select Construction (field 1) and the researched-list entry of Asteroid Mining if the screen lists owned techs
    await page.keyboard.press('2'); await sleep(1200);
    await shot('tech-construction');
    await page.evaluate(() => MOO.UI.Screens.go('techtree', { from: 'galaxy', field: 1, level: 7 })); await sleep(2500);
    await shot('techtree');
    await page.evaluate(() => MOO.UI.Screens.go('help', { from: 'galaxy' })); await sleep(1500);
    // breakthrough scene of an expansion tech
    await page.evaluate(() => { MOO.UI.Screens.go('galaxy'); }); await sleep(1500);
    await page.evaluate(() => { const t = MOO.Data.Techs.X.list.find(x => x.id.endsWith('battlefield-salvage')); void MOO.Game.handlers.tech({ type: 'tech', empire: 0, field: t.field, level: t.level, id: t.id, source: 'research' }); });
    await sleep(3500); await shot('breakthrough');
  } catch (e) { console.log('FAIL', e.message); }
  console.log('console errors:', errors.length ? '\n  ' + errors.slice(0, 12).join('\n  ') : 'none');
  await browser.close(); srv.close();
})();
