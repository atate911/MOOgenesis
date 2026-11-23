// Before/after excerpts of the game's own pieces: renders a window of each track through the game's engine (the game's master, not the
// concert master) and writes MP3s, so a change to the whole score can be heard against what it was.
//   node tools/concert/compare.js --tracks title,galaxy14 --from 40 --secs 60 --tag before [--query symphonic=0]
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { serve, open } = require('../qa/lib');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
const OUT = path.join(__dirname, 'out', 'compare'), SR = 48000, PORT = +opt.port || 8812;
(async () => {
  const srv = await serve(PORT), { browser, page } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html` + (opt.query ? '?' + opt.query : ''));
  await page.addScriptTag({ url: `http://localhost:${PORT}/tools/lib/audio-metrics.js` });
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music && window.AudioMetrics);
  await page.evaluate(async () => { await MOO.Audio.Samples.preload(); });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of String(opt.tracks).split(',')) {
    const r = await page.evaluate(async ([id, from, secs, SR]) => { const b = await MOO.Audio.Music.renderOffline(id, secs, { from, loop: false, sampleRate: SR }); const a = AudioMetrics.analyze(b); return { wav: AudioMetrics.wavBase64(b), lufs: a.lufs, peak: a.peakDb, knee: a.kneePct }; }, [id, +opt.from || 0, +opt.secs || 60, SR]);
    const base = path.join(OUT, id.replace(/[^a-z0-9]+/gi, '_') + '-' + (opt.tag || 'x')), wav = base + '.wav';
    fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '320k', base + '.mp3']); fs.unlinkSync(wav);
    console.log(`${id} (${opt.tag}): ${r.lufs.toFixed(1)} LUFS, peak ${r.peak.toFixed(1)} dB, limiter ${r.knee.toFixed(2)}% -> ${base}.mp3`);
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
