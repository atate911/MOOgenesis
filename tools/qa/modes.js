// Robustness matrix: viewport x settings (low tier / GPU off / workers off / reduced motion / threads=1). For each: visit every screen, play 8 turns through the bot,
// screenshot galaxy, report console errors. usage: node modes.js [name ...]   (phone / phoneland: an emulated touch phone)
const { serve, open, sleep } = require('./lib'); const bot = require('./bot');
const MODES = {
  '1920x1080': { vp: [1920, 1080] },
  '1024x600': { vp: [1024, 600] },
  '2560x1440': { vp: [2560, 1440] },
  low: { settings: { graphics: 'low' } },
  gpuoff: { settings: { gpu: false } },
  workersoff: { noWorkers: true },
  reduced: { settings: { reduceMotion: true, animSpeed: 0 } },
  ultra: { settings: { graphics: 'ultra' } },
  phone: { phone: true },                       // emulated touch phone, portrait (the phone layout layer; tools/qa/phone.js checks it in depth)
  phoneland: { phone: 'landscape' },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODES);
  const PORT = +process.env.PORT || 8793; const srv = await serve(PORT);
  for (const name of names) {
    const m = MODES[name]; const [W, H] = m.vp || [1280, 720];
    const { browser, ctx, page, errors } = await open({ viewport: { width: W, height: H }, phone: m.phone });
    if (m.settings) await ctx.addInitScript(s => localStorage.setItem('moo.settings.v1', JSON.stringify(s)), m.settings);
    if (m.noWorkers) await ctx.addInitScript(() => { window.Worker = undefined; });
    await page.goto(`http://localhost:${PORT}/index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&turns=15`);
    await sleep(1500);
    await page.evaluate(() => { const S = MOO.Game.S; for (const E of S.empires) for (const o of S.empires) if (E.id !== o.id) MOO.Sim.Diplo.rec(S, E.id, o.id).contact = true; });
    const info = await page.evaluate(() => ({ tier: MOO.Perf.tier, workers: MOO.Workers.size !== undefined ? (typeof MOO.Workers.size === 'function' ? MOO.Workers.size() : MOO.Workers.size) : undefined, gl: MOO.Gfx.GL && MOO.Gfx.GL.supported && MOO.Gfx.GL.supported() }));
    const scr = ['galaxy', 'planets', 'fleets', 'specs', 'design', 'tech', 'races', 'report', 'status', 'mapoverview', 'help', 'options', 'saveload', 'system', 'landing', 'gnn', 'council'];
    for (const s of scr) { await page.evaluate(id => { try { MOO.UI.Screens.go(id, { from: 'galaxy', empire: 1 }); } catch (e) { console.error('go ' + id, e.message); } }, s); await sleep(450); if (['design', 'races', 'tech'].includes(s)) await page.screenshot({ path: `/tmp/claude-0/mode-${name}-${s}.png` }); await page.keyboard.press('F1'); await sleep(150); await page.keyboard.press('Escape'); }
    await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(300);
    const b = bot.start(page, {}); let ok = 0;
    for (let i = 0; i < 8; i++) { const r = await Promise.race([page.evaluate(() => MOO.Game.endTurn().then(() => 1)), sleep(45000).then(() => 0)]); if (!r) { console.log('  STUCK turn', i); break; } ok++; await page.evaluate(() => MOO.UI.Screens.go('galaxy')); }
    b.stop(); await sleep(300);
    await page.screenshot({ path: `/tmp/claude-0/mode-${name}-galaxy.png` });
    const perf = await page.evaluate(() => ({ fps: Math.round(MOO.Perf.fps), frameMs: +MOO.Perf.frameMs.toFixed(1), tier: MOO.Perf.tier, mem: performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6) }));
    console.log(name, 'turns', ok, JSON.stringify(info), JSON.stringify(perf), 'errors:', JSON.stringify([...new Set(errors)]));
    await browser.close();
  }
  srv.close();
})();
