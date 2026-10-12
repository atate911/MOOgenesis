// Title -> new-game wizard click-through for every race, then play a few turns, save/load round-trip
const { open, report } = require('./lib');
const races = ['Human','Mrrshan','Silicoid','Sakkra','Psilon','Alkari','Klackon','Bulrathi','Meklar','Darlok'];
(async () => {
  const { b, p, flush } = await open('');
  flush();
  const click = async t => {  await p.locator('button', { hasText: t }).first().click({ timeout: 3000 }); await p.waitForTimeout(400); };
  for (const r of races) {
    try {
      if (await p.evaluate(() => !!MOO.Game.S)) { await p.evaluate(() => MOO.Game.quitToMenu()); await p.waitForTimeout(800); }
      await click(/new game/i);
      await click(/^Small/);
      await click(/^Next/);
      await click(new RegExp('^' + r));
      await p.screenshot({ path: `/tmp/qa-race-${r}.png` });
      await click(/^Next/); await click(/^Begin/);
      await p.waitForTimeout(2500);
      const info = await p.evaluate(() => { const S = MOO.Game.S; return S ? { race: MOO.Game.player().race, turn: S.turn } : null; });
      if (!info) throw new Error('game did not start');
      for (let i = 0; i < 6; i++) { await p.keyboard.press('Enter'); await p.waitForTimeout(500); }
      report(`start ${r} -> ${info.race}`, flush());
    } catch (e) { report('race ' + r, [e.message.split('\n')[0], ...flush()]); await p.reload(); await p.waitForTimeout(2500); flush(); }
  }
  // save/load round trip
  try {
    const before = await p.evaluate(() => { MOO.Game.saveSlot(1); const S = MOO.Game.S; return JSON.stringify({ t: S.turn, e: MOO.Game.player().bc }); });
    await p.evaluate(() => MOO.Game.endTurn()); await p.waitForTimeout(800);
    const ok = await p.evaluate(() => MOO.Game.loadSlot(1));
    const after = await p.evaluate(() => { const S = MOO.Game.S; return JSON.stringify({ t: S.turn, e: MOO.Game.player().bc }); });
    report(`save/load ${ok} ${before} vs ${after}` , before === after ? flush() : ['state mismatch', ...flush()]);
  } catch (e) { report('save/load', [e.message]); }
  await b.close();
})();
