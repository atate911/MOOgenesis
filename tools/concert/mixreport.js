// A mastering engineer's read of the concert suite, measured rather than guessed: per passage (section) of each movement,
//   - the octave-band balance (40 Hz .. 10 kHz) and the 200-500 Hz build-up, where many instruments at once turn to mud
//   - the melody against everything else (the lead line alone vs the whole): does the tune lead?
//   - each layer's share of the passage (the strings' beds, the choir, the bass, the lines, the percussion)
//   node tools/concert/mixreport.js [--only 2] [--secs 12]      (renders a window from the middle of every section)
//   node tools/concert/mixreport.js --track galaxy14             a piece of the game's score, through the game's master
const { serve, open } = require('../qa/lib');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;

(async () => {
  const PORT = +opt.port || 8805, srv = await serve(PORT), { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  await page.addScriptTag({ url: 'http://localhost:' + PORT + '/tools/concert/suite.js?' + Date.now() });
  const out = await page.evaluate(async ([only, secs, tracks]) => {
    if (!tracks) { MOO.Audio.hallHp = 220; MOO.Audio.hallRT = 4; MOO.Audio.hallLp = 6500; MOO.Audio.concert = true; } await MOO.Audio.Samples.preload();   // a game piece is measured through the game's own (symphonic) master
    const M = MOO.Audio.Music, SR = 24000, lines = [];
    const suite = tracks ? { movements: tracks.split(',').map(id => ({ id, title: id })) } : window.CONCERT_SUITE;   // --track: any piece of the game's score
    const bands = [40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];
    // octave-band energies of a buffer (a 4096-point FFT averaged over the window)
    function spectrum(x) {
      const N = 4096, re = new Float64Array(N), im = new Float64Array(N), acc = new Float64Array(N / 2), w = Array.from({ length: N }, (_, k) => 0.5 - 0.5 * Math.cos(2 * Math.PI * k / N));
      const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
        for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s, xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c; re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi; re[i + k] += xr; im[i + k] += xi; } } };
      for (let s0 = 0; s0 + N <= x.length; s0 += N / 2) { for (let k = 0; k < N; k++) { re[k] = x[s0 + k] * w[k]; im[k] = 0; } fft(re, im); for (let k = 0; k < N / 2; k++) acc[k] += re[k] * re[k] + im[k] * im[k]; }
      const e = []; for (let b = 0; b + 1 < bands.length; b++) { let s = 0; for (let k = 0; k < N / 2; k++) { const f = k * SR / N; if (f >= bands[b] && f < bands[b + 1]) s += acc[k]; } e.push(10 * Math.log10(s + 1e-15)); }
      let mud = 0, all = 0; for (let k = 0; k < N / 2; k++) { const f = k * SR / N; if (f >= 40) { all += acc[k]; if (f >= 200 && f < 500) mud += acc[k]; } }
      return { e, mud: 10 * Math.log10(mud / all + 1e-15) };
    }
    const lv = x => { let s = 0; for (const v of x) s += v * v; return 10 * Math.log10(s / x.length + 1e-15); };
    for (let mi = 0; mi < suite.movements.length; mi++) {
      if (only && +only !== mi + 1) continue;
      const id = suite.movements[mi].id, c = M._compile(id, 0);
      lines.push('\n== ' + suite.movements[mi].title);
      lines.push('  section        ' + bands.slice(0, -1).map((b, i) => (b + '-' + bands[i + 1]).padStart(9)).join('') + '   200-500  melody  layers (share of the passage, dB)');
      for (const w of c.wraps) {
        if (w.len < 4) continue;
        const from = w.t0 + Math.max(0, (w.len - secs) / 2), len = Math.min(secs, w.len), pre = 6;
        const render = o => M.renderOffline(id, len + pre, { from: from - pre, loop: false, sampleRate: SR, only: o }).then(b => b.getChannelData(0).subarray(pre * SR));
        const all = await render(undefined), sp = spectrum(all), L0 = lv(all), mx = Math.max(...sp.e);
        const mel = lv(await render(['lead'])) - L0;   // the lead bus (the tune and the lines with it) against the whole
        const parts = [];
        for (const k of ['pad', 'choir', 'bass', 'arp', 'drums']) { const v = lv(await render([k])) - L0; if (v > -40) parts.push(k + ' ' + v.toFixed(0)); }
        lines.push('  ' + w.R.n.padEnd(13) + sp.e.map(v => (v - mx).toFixed(0).padStart(9)).join('') + sp.mud.toFixed(1).padStart(10) + mel.toFixed(1).padStart(8) + '  ' + parts.join(', '));
      }
    }
    return lines.join('\n');
  }, [opt.only, +opt.secs || 10, typeof opt.track === 'string' ? opt.track : null]);
  console.log(out);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
