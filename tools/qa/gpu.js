// GPU wiring QA: visit each render screen with gpu off / medium / ultra, collect console errors + screenshots (/tmp/qa-gpu-<mode>-<screen>.png).
// usage: NODE_PATH=$(npm root -g) node tools/qa/gpu.js [off|medium|ultra,...]
const { open, report } = require('./lib');
(async () => {
  for (const mode of (process.argv[2] || 'off,medium,ultra').split(',')) {
    const { b, p, flush } = await open('dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&diff=average&turns=15', { wait: 3500 });
    await p.bringToFront();
    await p.evaluate(m => { MOO.Settings.set('gpu', m !== 'off'); MOO.Perf.setPreset(m === 'off' ? 'low' : m); MOO.Gfx.Scenes && MOO.Gfx.Scenes.clearCache(); }, mode);
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => ({ tier: MOO.Perf.tier, glq: MOO.Perf.q.gl, supported: MOO.Gfx.GL.supported(), pick: MOO.Gfx.pick('planets') === MOO.Gfx.GLPlanets ? 'GL' : 'CPU', gpu: MOO.HW.gpu }));
    console.log('== mode', mode, JSON.stringify(info));
    const shot = async (name, wait = 1800) => { await p.waitForTimeout(wait); await p.screenshot({ path: `/tmp/qa-gpu-${mode}-${name}.png` }); report(`${mode} ${name}`, flush()); };
    flush();
    await shot('galaxy');
    const step = async (name, js, wait) => { try { await p.evaluate(js); await shot(name, wait); } catch (e) { report(`${mode} ${name}`, ['SCRIPT ' + e.message.split('\n')[0]]); } };
    await step('system', () => MOO.UI.Screens.go('system', { star: MOO.Game.player().capital !== undefined ? MOO.Game.S.planets[MOO.Game.player().capital].starId : 0, from: 'galaxy' }));
    for (const k of ['colony', 'invade', 'bombBio']) await step('landing-' + k, `MOO.UI.Screens.go('landing', {}); setTimeout(() => MOO.UI.Ground.demo('${k}'), 0)`, 2500);
    await step('audience', () => { const g = MOO.Game, me = g.player().id; const o = g.S.empires.find(e => e.id !== me && !e.dead); MOO.UI.Screens.go('audience', { empire: o.id, from: 'galaxy' }); }, 2500);
    for (const scn of ['planet', 'fleet', 'big']) {
      await p.goto(p.url().replace(/screen=[a-z]+/, 'screen=combat') + '&scn=' + scn); await p.waitForTimeout(500);
      await p.evaluate(m => { MOO.Settings.set('gpu', m !== 'off'); MOO.Perf.setPreset(m === 'off' ? 'low' : m); }, mode);
      await shot('combat-' + scn, 3500);
    }
    await b.close();
  }
})();
