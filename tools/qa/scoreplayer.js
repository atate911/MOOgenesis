// The score player (Game menu → Score player): opens from the menu, lists the score, plays / seeks / pauses a piece, runs on through
// the list, and gives the game's music back when it closes.   node tools/qa/scoreplayer.js [--phone] [--shots DIR]
const { serve, open, sleep } = require('./lib');
const args = process.argv.slice(2), phone = args.includes('--phone'), shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
(async () => {
  const srv = await serve(8771);
  const { browser, page, errors } = await open(phone ? { phone: true } : {});
  const fails = [], ok = (c, m) => { if (!c) fails.push(m); console.log((c ? 'ok   ' : 'FAIL ') + m); };
  await page.goto('http://localhost:8771/index.html?dev=1&screen=galaxy&race=human&size=small&opp=2&seed=sp1');
  await page.waitForFunction(() => window.MOO && MOO.Game && MOO.Game.hasGame && MOO.Game.hasGame(), null, { timeout: 60000 });
  await page.mouse.click(5, 5); await sleep(1500);
  const before = await page.evaluate(() => MOO.Audio.Music.current());
  await page.evaluate(() => { window._gm = MOO.UI.gameMenu(); });
  await sleep(400);
  const entry = await page.$('.gm-modal button:has-text("Score player")');
  ok(!!entry, 'the game menu offers the score player');
  await entry.click(); await sleep(800);
  const n = await page.$$eval('.sp-row', r => r.length);
  ok(n > 40, 'the list holds the score (' + n + ' pieces)');
  if (shots) await page.screenshot({ path: shots + '/sp-open' + (phone ? '-phone' : '') + '.png' });
  // the notes: every piece has a blurb and a 'where', and every moment's section is in the score (else its jump button is lost)
  const notes = await page.evaluate(() => {
    const N = MOO.UI.ScoreNotes, bad = [], cat = MOO.Audio.Music.catalogue(['title:grand', 'title:classic']);
    for (const e of cat) {
      const n = N.get(e.id); if (!n || !n.blurb || !n.where) { bad.push(e.id + ': no notes'); continue; }
      for (const [sec] of n.listen) if (sec && !e.sections.some(x => x.n === sec)) bad.push(e.id + ': no section ' + sec);
    }
    return bad;
  });
  ok(!notes.length, 'every piece has notes and every moment its section' + (notes.length ? ': ' + notes.join(', ') : ''));
  await page.click('.sp-row[data-id="galaxy14"]'); await sleep(2500);
  let p = await page.evaluate(() => MOO.Audio.Music.position());
  ok(p && p.id === 'galaxy14' && p.t > 1, 'a click plays the piece (' + JSON.stringify(p && { id: p.id, t: +p.t.toFixed(1) }) + ')');
  await (await page.$('.sp-seek')).scrollIntoViewIfNeeded();
  const box = await (await page.$('.sp-seek')).boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2); await sleep(1200);
  const p2 = await page.evaluate(() => MOO.Audio.Music.position());
  const len = await page.evaluate(() => MOO.Audio.Music.catalogue().find(e => e.id === 'galaxy14').seconds);
  ok(p2 && p2.id === 'galaxy14' && Math.abs(p2.t - len * 0.5) < 6 && p2.perf.form0 === p.perf.form0 && p2.perf.alt0 === p.perf.alt0, 'seeking jumps to the middle in the same performance (' + (p2 && p2.t.toFixed(1)) + ' of ' + len.toFixed(0) + ')');
  if (shots) await page.screenshot({ path: shots + '/sp-playing' + (phone ? '-phone' : '') + '.png' });
  // the (i) card: opens, and a moment's jump plays from its time
  await (await page.$('.sp-ibtn')).scrollIntoViewIfNeeded();
  await page.click('.sp-ibtn'); await sleep(300);
  const card = await page.evaluate(() => ({ shown: !document.querySelector('.sp-info').hidden, heads: Array.from(document.querySelectorAll('.sp-i-h')).map(x => x.textContent), jumps: document.querySelectorAll('.sp-jump').length }));
  ok(card.shown && card.heads.indexOf('Where you hear it') >= 0 && card.heads.indexOf('Listen for') >= 0 && card.jumps >= 3, 'the (i) card shows where, what to listen for and its jumps (' + JSON.stringify(card) + ')');
  if (shots) await page.screenshot({ path: shots + '/sp-info' + (phone ? '-phone' : '') + '.png' });
  const jt = await page.evaluate(() => MOO.Audio.Music.catalogue().find(e => e.id === 'galaxy14').sections.find(x => x.n === 'sunrise').t);
  await page.click('.sp-jump >> nth=2'); await sleep(1200);
  const pj = await page.evaluate(() => MOO.Audio.Music.position());
  ok(pj && pj.id === 'galaxy14' && Math.abs(pj.t - jt) < 3, 'a moment jumps to its time (' + (pj && pj.t.toFixed(1)) + ' vs ' + jt.toFixed(1) + ')');
  await page.click('.sp-i-th .sp-chip >> nth=0'); await sleep(300);
  const filt = await page.evaluate(() => ({ bar: !document.querySelector('.sp-thbar').hidden, n: document.querySelectorAll('.sp-row').length }));
  ok(filt.bar && filt.n > 3 && filt.n < 30, 'a shared tune filters the list (' + filt.n + ' pieces)');
  await page.click('.sp-x'); await sleep(200);
  await page.click('.sp-ibtn'); await sleep(200);
  await page.click('.sp-play'); await sleep(800);
  ok(!(await page.evaluate(() => MOO.Audio.Music.current())), 'pause stops the music');
  await page.click('.sp-play'); await sleep(1000);
  const p3 = await page.evaluate(() => MOO.Audio.Music.position());
  ok(p3 && p3.id === 'galaxy14' && p3.t > len * 0.5 - 2, 'play resumes where it paused (' + (p3 && p3.t.toFixed(1)) + ')');
  await page.click('.sp-ctl button:has-text("Play on")'); await sleep(500);
  await page.click('.sp-ico >> nth=1'); await sleep(1500);
  const p4 = await page.evaluate(() => ({ cur: MOO.Audio.Music.current(), pl: MOO.Audio.Music.state().playlist }));
  ok(p4.cur === 'galaxy15' && p4.pl, 'next plays the next piece, as a programme in play-on mode (' + JSON.stringify(p4) + ')');
  await page.keyboard.press('Escape'); await sleep(2500);
  const after = await page.evaluate(() => ({ cur: MOO.Audio.Music.current(), pl: MOO.Audio.Music.state().playlist }));
  ok(after.cur && after.cur === before && after.pl, 'closing gives the game its music back (' + before + ' -> ' + JSON.stringify(after) + ')');
  const menuBack = await page.$('.gm-modal');
  ok(!!menuBack, 'closing returns to the game menu');
  // track names during play: off by default, switched in the player; then a new piece in the game shows its name
  ok(await page.evaluate(() => MOO.Settings.get('trackNames') === false), 'track names are off by default');
  await page.keyboard.press('Escape'); await sleep(400);                       // close the game menu
  await page.evaluate(() => MOO.Audio.Music.play('galaxy19', { quantize: false, fade: 0.5 })); await sleep(2500);
  ok(!(await page.$('.toast.sp-toast')), 'no name is shown while the setting is off');
  await page.evaluate(() => { MOO.UI.scorePlayer(); }); await sleep(600);
  await page.click('.sp-opt .ctl-sw'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(2500);
  ok(await page.evaluate(() => MOO.Settings.get('trackNames') === true), 'the player\u2019s switch turns track names on');
  ok(!(await page.$('.toast.sp-toast')), 'closing the player does not announce the piece the game resumes');
  await page.evaluate(() => MOO.Audio.Music.play('galaxy12', { quantize: false, fade: 0.5 })); await sleep(2500);
  const toast = await page.evaluate(() => { const t = document.querySelector('.toast.sp-toast'); return t ? t.textContent : null; });
  ok(toast && /The Long Night/.test(toast), 'a new piece shows its name (' + toast + ')');
  if (shots) await page.screenshot({ path: shots + '/sp-toast' + (phone ? '-phone' : '') + '.png' });
  const errs = errors.filter(e => !/favicon|AudioContext was not allowed|GL Driver Message/.test(e));
  ok(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(fails.length ? fails.length + ' failed' : 'all passed');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
