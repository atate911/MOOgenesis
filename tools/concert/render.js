// The concert suite: render the movements of tools/concert/suite.js through the game's own engine and orchestra (headless Chromium,
// OfflineAudioContext), as finished recordings rather than loops.
//   node tools/concert/render.js                      every movement, to tools/concert/out/ (WAV 24-bit + MP3 320k)
//   node tools/concert/render.js --only 2             one movement (1-based), or a comma list
//   node tools/concert/render.js --lint               compile only: length, sections, notes the engine had to move onto a chord
//   node tools/concert/render.js --secs 40 --from 90  a window of a movement (from 90 s, 40 s long), for a quick check
//   node tools/concert/render.js --out DIR
// The levels: each movement is rendered at unity through the game's master chain, then the whole suite gets one gain (the same for every
// movement, so a quiet movement stays quiet against a loud one), set so the loudest movement sits at -16 LUFS integrated with its true
// peak under -1 dBFS. ffmpeg does the encoding.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { serve, open } = require('../qa/lib');

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); opt[k] = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : true; } }
const OUT = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(__dirname, 'out'));
const SR = 48000, PORT = +opt.port || 8772, TAIL = 11, TARGET_LUFS = -16, CEIL_DB = -1.0;

(async () => {
  const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html`);
  await page.addScriptTag({ url: `http://localhost:${PORT}/tools/lib/audio-metrics.js` });
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music && window.AudioMetrics);
  await page.addScriptTag({ url: `http://localhost:${PORT}/tools/concert/suite.js?` + Date.now() });
  const suite = await page.evaluate(() => window.CONCERT_SUITE);
  if (!suite) throw new Error('suite.js did not register window.CONCERT_SUITE');
  let pick = suite.movements.map((m, i) => i);
  if (typeof opt.only === 'string') pick = opt.only.split(',').map(s => +s - 1);

  // ---- compile: the form, the length, and the notes the engine moved onto a chord (a written note against its chord)
  const lint = await page.evaluate(ids => ids.map(id => {
    const M = MOO.Audio.Music, a = M.analyze(id), c = M._compile(id, 0);
    const byLy = {}; for (const e of c.events) if (e.m) { const b = byLy[e.ly + ':' + e.k] || (byLy[e.ly + ':' + e.k] = { n: 0, lo: 999, hi: 0 }); b.n++; b.lo = Math.min(b.lo, e.m); b.hi = Math.max(b.hi, e.m); }
    return { id, secs: c.len, sections: c.wraps.map(w => w.R.n + '@' + w.t0.toFixed(1)), snaps: c.snapLog, warnings: a.warnings, layers: byLy };
  }), pick.map(i => suite.movements[i].id));
  for (const L of lint) {
    console.log(`\n== ${L.id}: ${(L.secs / 60).toFixed(2)} min (${L.secs.toFixed(1)} s)`);
    console.log('  form: ' + L.sections.join('  '));
    if (L.warnings.length) console.log('  warnings: ' + L.warnings.join('; '));
    console.log(`  notes moved onto the chord: ${L.snaps.length}` + (L.snaps.length ? '\n' + L.snaps.slice(0, 40).map(s => `    ${s.sec} ${s.key} bar ${s.bar} beat ${s.beat} (${s.dur}b): ${s.from} -> ${s.to} over ${s.ch}`).join('\n') : ''));
    if (opt.layers) for (const k in L.layers) console.log(`    ${k.padEnd(18)} ${String(L.layers[k].n).padStart(5)} notes  ${L.layers[k].lo}-${L.layers[k].hi}`);
  }
  if (opt.lint) { await browser.close(); srv.close(); return; }

  const st = await page.evaluate(async () => { await MOO.Audio.Samples.preload(); return MOO.Audio.Samples.status(); });
  console.log('\nsamples: ' + JSON.stringify(st));
  fs.mkdirSync(OUT, { recursive: true });
  const rendered = [];
  for (const i of pick) {
    const mv = suite.movements[i], L = lint.find(x => x.id === mv.id);
    const from = +opt.from || 0, secs = opt.secs ? +opt.secs : L.secs - from + TAIL;
    const t0 = Date.now();
    const info = await page.evaluate(async ([id, secs, from, SR]) => {
      const buf = await MOO.Audio.Music.renderOffline(id, secs, { from, loop: false, sampleRate: SR, intensity: 0 });
      // the tail: the last seconds fade to silence under the hall (nothing is cut while it still rings)
      const n = buf.length, fade = Math.min(n, Math.round(2.5 * SR));
      for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let k = 0; k < fade; k++) d[n - fade + k] *= Math.pow(1 - k / fade, 2); }
      window.__concertBuf = buf;
      const a = AudioMetrics.analyze(buf);
      return { lufs: a.lufs, peakDb: a.peakDb, lra: a.lra, kneePct: a.kneePct, hotPct: a.hotPct, len: buf.length, ch: buf.numberOfChannels, stats: buf.mooStats };
    }, [mv.id, secs, from, SR]);
    // the samples out in pieces (a six-minute stereo render is too large for one message), as float32
    const raw = path.join(OUT, `.${mv.id.replace(/[^a-z0-9]+/gi, '_')}.f32`), fd = fs.openSync(raw, 'w'), CH = SR * 10;
    for (let s0 = 0; s0 < info.len; s0 += CH) {
      const b64 = await page.evaluate(([s0, CH]) => { const b = window.__concertBuf, n = Math.min(CH, b.length - s0), L = b.getChannelData(0), R = b.getChannelData(b.numberOfChannels > 1 ? 1 : 0), f = new Float32Array(n * 2);
        for (let k = 0; k < n; k++) { f[2 * k] = L[s0 + k]; f[2 * k + 1] = R[s0 + k]; }
        let s = ''; const u = new Uint8Array(f.buffer); for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s); }, [s0, CH]);
      fs.writeSync(fd, Buffer.from(b64, 'base64'));
    }
    fs.closeSync(fd);
    console.log(`${mv.id}: ${(info.len / SR).toFixed(1)} s rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s · ${info.lufs.toFixed(1)} LUFS, peak ${info.peakDb.toFixed(1)} dB, LRA ${info.lra.toFixed(1)}, limiter knee ${(info.kneePct).toFixed(2)}%, voices peak ${info.stats && info.stats.peak}`);
    rendered.push({ mv, i, raw, info });
  }
  await browser.close(); srv.close();
  if (errors.length) console.log('page messages:\n  ' + errors.slice(0, 10).join('\n  '));

  // one gain for the suite
  const loudest = Math.max(...rendered.map(r => r.info.lufs));
  const gain = opt.secs ? 0 : Math.min(TARGET_LUFS - loudest, ...rendered.map(r => CEIL_DB - r.info.peakDb));
  console.log(`\nsuite gain: ${gain >= 0 ? '+' : ''}${gain.toFixed(2)} dB`);
  for (const r of rendered) {
    const base = path.join(OUT, (opt.secs ? 'window-' : '') + r.mv.file);
    const af = `volume=${gain.toFixed(3)}dB`;
    const meta = ['-metadata', `title=${r.mv.title}`, '-metadata', `album=${suite.title}`, '-metadata', `track=${r.i + 1}/${suite.movements.length}`, '-metadata', `artist=${suite.artist}`];
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', r.raw, '-af', af, '-c:a', 'pcm_s24le', ...meta, base + '.wav']);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', r.raw, '-af', af, '-c:a', 'libmp3lame', '-b:a', '320k', ...meta, base + '.mp3']);
    fs.unlinkSync(r.raw);
    console.log('  ' + base + '.{wav,mp3}');
  }
})().catch(e => { console.error(e); process.exit(1); });
