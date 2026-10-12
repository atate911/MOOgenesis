// Robustness modes: GPU off / workers off (threads=1) / low tier / reduced motion; boots, plays 8 turns through the real endTurn, opens screens
const { open, report } = require('./lib');
const modes = {
  gpuOff: { gpu: false }, lowTier: { _preset: 'low' }, reduceMotion: { reduceMotion: true }, threads1: { threads: 1 },
  all: { gpu: false, reduceMotion: true, threads: 1, _preset: 'low' },
};
(async () => {
  for (const [name, s] of Object.entries(modes)) {
    let ctx;
    try {
      ctx = await open('dev=1&screen=galaxy&race=klackon&size=medium&opp=3&seed=m&diff=hard&turns=10', { wait: 500 });
      const { p, flush } = ctx;
      await p.evaluate(s => { for (const [k, v] of Object.entries(s)) { if (k === '_preset') MOO.Perf.setPreset(v); else MOO.Settings.set(k, v); } }, s);
      await p.reload(); // settings persist; boot under them
      await p.waitForTimeout(3000);
      await p.evaluate(s => { if (s._preset) MOO.Perf.setPreset(s._preset); }, s);
      for (let i = 0; i < 8; i++) { await p.evaluate(() => MOO.Game.S && MOO.Game.endTurn()); await p.waitForTimeout(500); }
      for (const k of ['d', 'm', 'r', 'p', 't']) { await p.keyboard.press(k); await p.waitForTimeout(500); await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
      await p.screenshot({ path: `/tmp/qa-mode-${name}.png` });
      const st = await p.evaluate(() => ({ turn: MOO.Game.S && MOO.Game.S.turn, tier: MOO.Perf.tier, gpu: MOO.Settings.get('gpu') }));
      report(`mode ${name} ${JSON.stringify(st)}`, flush());
    } catch (e) { report('mode ' + name, [e.message.split('\n')[0], ...(ctx ? ctx.flush() : [])]); }
    if (ctx) await ctx.b.close();
  }
})();
