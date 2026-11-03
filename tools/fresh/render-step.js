// render a fresh-start step: the track definitions in a JS file (module.exports = { id: def, ... }), each SECS long with a 3 s fade at the
// end, to WAV and MP3 in OUT, with the report tool's analysis (LUFS, peak, clicks) and the low end's pulse
//   node render-step.js STEP.js SECS OUT [PORT]
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { serve, open } = require('/home/user/MOOgenesis/tools/qa/lib');
const DEFS = require(path.resolve(process.argv[2])), SECS = +process.argv[3] || 50, OUT = process.argv[4], PORT = +process.argv[5] || 8894;
(async () => { const srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html'); await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  if (!(await page.evaluate(() => !!window.AudioMetrics))) await page.addScriptTag({ url: 'http://localhost:' + PORT + '/tools/lib/audio-metrics.js' });
  for (const id in DEFS) {
    const r = await page.evaluate(async ([id, def, SECS]) => { const A = MOO.Audio, M = A.Music, S = A.Samples, AM = window.AudioMetrics; await S.preload();
      M._define(id, JSON.parse(JSON.stringify(def)));
      const buf = await M.renderOffline(id, SECS, { sampleRate: 44100, loop: false, seed: 1 });
      const sr = buf.sampleRate, F = Math.round(3 * sr); for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < F; i++) d[d.length - F + i] *= Math.cos(0.5 * Math.PI * i / F); }
      const a = AM.analyze(buf); delete a.env; delete a.feat;
      // the low end (40-300 Hz) level movement between 0.3 s and 6 s, past the first 12 s
      const oc = new OfflineAudioContext(1, buf.length, sr), src = oc.createBufferSource(); src.buffer = buf; let n = src;
      for (let k = 0; k < 2; k++) { const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 40; n.connect(h); n = h; const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = 300; n.connect(l); n = l; }
      n.connect(oc.destination); src.start(); const x = (await oc.startRendering()).getChannelData(0), W = Math.round(0.05 * sr), e = [];
      for (let s = 0; s + W <= x.length; s += W) { let q = 0; for (let i = s; i < s + W; i++) q += x[i] * x[i]; e.push(10 * Math.log10(q / W + 1e-12)); }
      const mav = (v, R) => v.map((_, i) => { let q = 0, c = 0; for (let k = Math.max(0, i - R); k <= Math.min(v.length - 1, i + R); k++) { q += v[k]; c++; } return q / c; });
      const sm = mav(e, 3), tr = mav(e, 60), f = []; for (let i = 240; i < e.length - 80; i++) f.push(sm[i] - tr[i]); f.sort((p, q) => p - q);
      a.lowMoves = f.length ? +(f[Math.floor(f.length * 0.95)] - f[Math.floor(f.length * 0.05)]).toFixed(1) : 0;
      // the choir against the strings where the ear is most sensitive (250 Hz-4 kHz), each rendered alone
      const lv = async b => { const oc2 = new OfflineAudioContext(1, b.length, b.sampleRate), s2 = oc2.createBufferSource(); s2.buffer = b; let m = s2; for (const [t, f] of [['highpass', 250], ['highpass', 250], ['lowpass', 4000], ['lowpass', 4000]]) { const q = oc2.createBiquadFilter(); q.type = t; q.frequency.value = f; m.connect(q); m = q; } m.connect(oc2.destination); s2.start(); const y = (await oc2.startRendering()).getChannelData(0); let q = 0; for (let i = 12 * b.sampleRate; i < y.length - 3 * b.sampleRate; i++) q += y[i] * y[i]; return 10 * Math.log10(q / (y.length - 15 * b.sampleRate) + 1e-15); };
      if (def.sec.some(s => s.choir || s.choir2)) { const ch = await M.renderOffline(id, SECS, { sampleRate: 22050, loop: false, seed: 1, only: ['choir'] }), pd = await M.renderOffline(id, SECS, { sampleRate: 22050, loop: false, seed: 1, only: ['pad'] }); a.choirOverStrings = +((await lv(ch)) - (await lv(pd))).toFixed(1); }
      if (def.sec.some(s => s.lead)) { const ld = await M.renderOffline(id, SECS, { sampleRate: 22050, loop: false, seed: 1, only: ['lead'] }), bd = await M.renderOffline(id, SECS, { sampleRate: 22050, loop: false, seed: 1, only: ['pad', 'choir'] }); a.soloOverBeds = +((await lv(ld)) - (await lv(bd))).toFixed(1); }
      return { a, wav: AM.wavBase64(buf) }; }, [id, DEFS[id], SECS]);
    const name = id.replace(/[:]/g, '-'), wav = path.join(OUT, name + '.wav'); fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '256k', wav.replace(/\.wav$/, '.mp3')]);
    const a = r.a; console.log(id.padEnd(12), 'LUFS', a.lufs, 'peak', a.peak, 'clicks', a.clicks, 'LRA', a.lra, 'bands', a.bands ? a.bands.join('/') : '', 'low end moves', a.lowMoves, 'dB' + (a.choirOverStrings !== undefined ? ', the choir ' + a.choirOverStrings + ' dB against the strings (250 Hz-4 kHz)' : '') + (a.soloOverBeds !== undefined ? ', the solo ' + a.soloOverBeds + ' dB against the strings and choir' : ''));
  }
  await browser.close(); srv.close(); })().catch(e => { console.error(e); process.exit(1); });
