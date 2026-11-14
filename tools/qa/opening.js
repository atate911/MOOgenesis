// The opening of a new game: the title screen's main theme carries on into the game and is heard to its end before the map's programme
// (an end-of-turn change of programme, a visit to the laboratory or a borrowed scene never cut it); a loaded game starts its programme at
// once.   node tools/qa/opening.js
const { serve, open, sleep } = require('./lib');
(async () => {
  const srv = await serve(8778);
  const { browser, page, errors } = await open();
  const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
  await page.goto('http://localhost:8778/index.html?dev=1&screen=galaxy&race=human&size=small&opp=2&seed=op1');
  await page.waitForFunction(() => MOO.Game && MOO.Game.hasGame && MOO.Game.hasGame() && MOO.UI.Soundscape, null, { timeout: 60000 });
  await page.mouse.click(5, 5); await sleep(1000);
  const st = () => page.evaluate(() => { const Mu = MOO.Audio.Music, S = Mu._rotation.S; return { cur: Mu.current(), loop: S.cur && S.cur.loop, lead: !!Mu.leading(), pl: !!S.playlist, ids: S.playlist ? S.playlist.ids.length : 0, playing: S.cur && S.cur.id }; });
  // the title screen: its grand reading, some way in
  await page.evaluate(() => { MOO.UI.Screens.go('menu'); }); await sleep(6000);
  ok((await st()).cur === 'title:grand', 'the title screen plays the grand reading');
  // a new game begins (Game.newGame emits game:new, then the map opens)
  await page.evaluate(() => { MOO.Bus.emit('game:new'); MOO.UI.Screens.go('galaxy'); }); await sleep(3000);
  let s = await st();
  ok(s.playing === 'title:grand' && s.loop === false && s.lead && s.pl, 'the grand reading carries on into the game, once, with the programme behind it (' + JSON.stringify(s) + ')');
  // the end of a turn changes the programme (first contact, a war): the theme is not cut
  await page.evaluate(() => MOO.Audio.Music.setMood('galaxyWar', { fade: 6, quantize: 'bar', soft: true })); await sleep(3000);
  s = await st();
  ok(s.playing === 'title:grand' && s.lead && s.ids === 10, 'a change of programme waits for the theme to end (' + JSON.stringify(s) + ')');
  // a visit to the research screen longer than its dwell
  await page.evaluate(() => MOO.UI.Screens.go('tech')); await sleep(6000);
  s = await st(); ok(s.playing === 'title:grand', 'the laboratory leaves the opening theme playing (' + s.playing + ')');
  await page.evaluate(() => MOO.UI.Screens.go('galaxy')); await sleep(1500);
  // a scene that borrows the music (the news, the score player) and gives it back
  const at0 = await page.evaluate(() => { const Mu = MOO.Audio.Music; window._snap = Mu.snapshot(); Mu.play('gnn', { fade: 0.5, quantize: false }); return Mu.position().t; });
  await sleep(2500);
  await page.evaluate(() => MOO.Audio.Music.restore(window._snap, { resume: true, fade: 1 })); await sleep(2000);
  s = await st();
  const p = await page.evaluate(() => MOO.Audio.Music.position());
  ok(s.playing === 'title:grand' && s.loop === false && s.lead && s.pl && p.t > at0 - 4, 'a borrowed scene gives the theme back where it was, the programme behind it (' + JSON.stringify(s) + ' t ' + p.t.toFixed(0) + ')');
  // its end: the programme takes over
  await page.evaluate(() => { const Mu = MOO.Audio.Music, len = Mu.catalogue(['title:grand']).find(e => e.id === 'title:grand').seconds; Mu.stop({ fade: 0.2 }); Mu.playlist(Mu._rotation.MOODS.galaxy, { director: true, gap: 0, gapIn: 0, fade: 6, between: Mu._rotation.INTERLUDES, betweenP: 1, lead: 'title:grand', from: len - 14, quantize: false }); });
  await sleep(1000);
  const left = await page.evaluate(() => { const p = MOO.Audio.Music.position(); return p ? p.len - p.t : 30; });   // the performance's own length (its rubato stretches it)
  await sleep((left + 8) * 1000);
  s = await st();
  ok(s.playing && s.playing !== 'title:grand' && s.pl && !s.lead, 'at its end the map’s programme follows (' + JSON.stringify(s) + ')');
  // a loaded game: the programme at once
  await page.evaluate(() => { MOO.UI.Screens.go('menu'); }); await sleep(3000);
  await page.evaluate(() => { MOO.Game.autosave(); MOO.Game.loadSlot('auto'); }); await sleep(3500);
  s = await st();
  ok(s.playing && !/^title/.test(s.playing) && s.pl && !s.lead, 'a loaded game starts the map’s programme at once (' + JSON.stringify(s) + ')');
    const errs = errors.filter(e => !/GL Driver|favicon/.test(e));
  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(fails.length ? fails.length + ' failed' : 'all passed'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
