// Tactical combat demo scenarios: boot each, let it animate, auto-resolve, screenshot, collect errors
const { open, report } = require('./lib');
(async () => {
  for (const scn of (process.argv[2] || 'planet,fleet,defend,monster,crystal,amoeba,big,specials,nebula').split(',')) {
    let ctx;
    try {
      ctx = await open(`dev=1&screen=combat&scn=${scn}`, { wait: 2500 });
      const { p, flush } = ctx;
      await p.bringToFront();
      await p.waitForTimeout(2500);
      await p.screenshot({ path: `/tmp/qa-cb-${scn}.png` });
      const sess = await p.evaluate(() => { const s = MOO.UI.Combat.session(); return s ? { round: s.B && s.B.round, over: MOO.Sim.Combat.isOver(s.B) } : null; });
      // play: press Space/Enter/A repeatedly (auto), then check result
      for (let i = 0; i < 12; i++) { await p.keyboard.press('a'); await p.waitForTimeout(600); }
      await p.screenshot({ path: `/tmp/qa-cb-${scn}-after.png` });
      const end = await p.evaluate(() => { const s = MOO.UI.Combat.session(); return s ? { round: s.B && s.B.round, over: MOO.Sim.Combat.isOver(s.B) } : 'no session' });
      report(`combat ${scn} start=${JSON.stringify(sess)} end=${JSON.stringify(end)}`, flush());
    } catch (e) { report('combat ' + scn, [e.message.split('\n')[0], ...(ctx ? ctx.flush() : [])]); }
    if (ctx) await ctx.b.close();
  }
})();
