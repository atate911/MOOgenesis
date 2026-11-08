// How each piece ends when it plays once (as the game's programme plays it): the whole piece rendered and 15 s past its last bar, and
// the level of the final chord and the hall measured at the bar line and after it. A piece the game lets ring out must have fallen away
// (40 dB under its closing level) or the engine's six-second fade at the last bar (Player.tick) is what ends it; this lists which is which.
//   node tools/qa/endings-tail.js   (renders each piece whole: allow a minute a piece)
//   [--tracks a,b] [--port 8796]
const { serve, open } = require('./lib');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
(async () => {
  const port = +opt.port || 8796, srv = await serve(port); const { browser, page } = await open();
  await page.goto(`http://localhost:${port}/tools/test-audio.html`);
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  await page.evaluate(async () => { if (MOO.Audio.Samples) await MOO.Audio.Samples.preload(); });
  const ids = typeof opt.tracks === 'string' ? opt.tracks.split(',') : await page.evaluate(() => MOO.Audio.Music.list().map(t => t.id));
  const rows = [];
  for (const id of ids) {
    const r = await page.evaluate(async id => {
      const M = MOO.Audio.Music, a = M.analyze(id); if (!a || !a.loopSec) return { id, err: 'no length' };
      const len = (a.introSec || 0) + a.loopSec, from = 0, secs = len + 15;   // the whole piece: notes held from earlier sound into the end
      const buf = await M.renderOffline(id, secs, { loop: false, from, sampleRate: 24000 });
      const B = buf.mooBeats || [], end = B.length > 1 ? B[B.length - 1] + (B[B.length - 1] - B[B.length - 2]) : len;   // the last bar line as conducted (the refresh's pieces breathe a little longer than written)
      const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      const rms = (t0, t1) => { let s = 0, n = 0; for (let i = Math.max(0, Math.floor(t0 * sr)); i < Math.min(L.length, Math.floor(t1 * sr)); i++) { s += L[i] * L[i] + R[i] * R[i]; n += 2; } return 10 * Math.log10(s / Math.max(1, n) + 1e-12); };
      const close = rms(end - 3, end), at = rms(end - 0.2, end);
      let fall = null; for (let t = end; t < secs - 0.25; t += 0.25) if (rms(t, t + 0.25) < close - 40) { fall = +(t - end).toFixed(2); break; }
      return { id, len: +end.toFixed(1), close: +close.toFixed(1), atBar: +at.toFixed(1), plus3: +rms(end + 2.75, end + 3.25).toFixed(1), plus5: +rms(end + 4.75, end + 5.25).toFixed(1), fall };
    }, id);
    rows.push(r); console.log(JSON.stringify(r));
  }
  const held = rows.filter(r => !r.err && (r.fall === null || r.fall > 6)), err = rows.filter(r => r.err);
  console.log('\n' + rows.length + ' pieces; ring out on their own: ' + (rows.length - held.length - err.length) + '; still sounding 6 s after the last bar (the engine\'s fade ends them): ' + (held.length ? held.map(r => r.id).join(', ') : 'none') + (err.length ? '; errors: ' + err.map(r => r.id).join(', ') : ''));
  await browser.close(); srv.close(); process.exit(err.length ? 1 : 0);
})();
