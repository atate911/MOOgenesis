// Save/load round-trip on a dev game
const { open, report } = require('./lib');
(async () => {
  const { b, p, flush } = await open('dev=1&screen=galaxy&race=human&size=small&opp=2&seed=sl&diff=average&turns=20');
  flush();
  const snap = () => p.evaluate(() => { const S = MOO.Game.S; return JSON.stringify({ t: S.turn, bc: MOO.Game.player().bc, n: S.stars.length }); });
  const ok1 = await p.evaluate(() => MOO.Game.saveSlot(1));
  const before = await snap();
  await p.evaluate(() => MOO.Game.endTurn()); await p.waitForTimeout(1500);
  const mid = await snap();
  const ok2 = await p.evaluate(() => MOO.Game.loadSlot(1));
  await p.waitForTimeout(800);
  const after = await snap();
  console.log({ ok1, ok2, before, mid, after });
  report('save/load round-trip', before === after && mid !== before ? flush() : ['mismatch', ...flush()]);
  await p.evaluate(() => MOO.Game.endTurn()); await p.waitForTimeout(1500);
  report('turn after load', flush());
  await b.close();
})();
