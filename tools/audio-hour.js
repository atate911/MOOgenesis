// A scripted hour of the map's music, captured from the real-time engine in headless Chromium (node tools/audio-hour.js [outDir]):
// the programme changes and the era scripted
// the way soundscape.js would request them over a game (alone, first contact, a war, peace, the late years), the master output captured
//   Writes hour.raw (16-bit stereo PCM at the context rate), hour-log.json (every change of piece with its time) and prints the byte count;
//   wrap the raw in a WAV header or feed it to ffmpeg (-f s16le -ar 44100 -ac 2). The wall-clock time is the hour itself.
//   Session 11 used it for the demo page's hour: cuts at the quietest instant near every 10.5 minutes, 160 kbps parts under 15 MB.
// as 16-bit PCM into a WAV, and every change of piece logged with its time.
const { serve, open } = require('./qa/lib');
const fs = require('fs');
const OUT = (process.argv[2] || 'out/hour').replace(/\/?$/, '/'); require('fs').mkdirSync(OUT, { recursive: true });
const SECS = 3600, SR = 44100;
(async () => {
  const srv = await serve(8795); const { browser, page, errors } = await open();
  const pcm = fs.openSync(OUT + 'hour.raw', 'w'); let written = 0;
  await page.exposeFunction('__pcm', b64 => { const b = Buffer.from(b64, 'base64'); fs.writeSync(pcm, b); written += b.length; });
  const log = [];
  await page.exposeFunction('__log', line => { log.push(line); fs.writeFileSync(OUT + 'hour-log.json', JSON.stringify(log, null, 1)); });
  await page.goto('http://localhost:8795/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  await page.evaluate(async secs => {
    const A = MOO.Audio, M = A.Music;
    A.init(); await new Promise(r => setTimeout(r, 400));
    await A.Samples.preload();
    A.setVolume('music', 1); A.setVolume('sfx', 0);
    const ctx = A.ctx, eng = A.engine;
    // the tap: the engine's last node before the output, copied to 16-bit stereo and handed out every few seconds
    const sp = ctx.createScriptProcessor(16384, 2, 2); let chunks = [], len = 0, frames = 0, on = false;
    sp.onaudioprocess = e => {
      if (!on) return;
      const L = e.inputBuffer.getChannelData(0), R = e.inputBuffer.getChannelData(1), n = L.length, out = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { let l = L[i], r = R[i]; l = l > 1 ? 1 : l < -1 ? -1 : l; r = r > 1 ? 1 : r < -1 ? -1 : r; out[i * 2] = (l * 32767) | 0; out[i * 2 + 1] = (r * 32767) | 0; }
      chunks.push(out); len += out.byteLength; frames += n;
      if (len >= 1 << 20) { const all = new Uint8Array(len); let o = 0; for (const c of chunks) { all.set(new Uint8Array(c.buffer), o); o += c.byteLength; } chunks = []; len = 0; let s = ''; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000)); window.__pcm(btoa(s)); }
      for (let c = 0; c < 2; c++) e.outputBuffer.getChannelData(c).fill(0);
    };
    eng.outGain.connect(sp); sp.connect(ctx.destination);
    // the game over an hour: alone (the early programme), first contact at 13 min, a war at 34, peace at 46, the late years to the end;
    // the era climbs the way soundscape.js lets it, a little every turn
    const t0 = ctx.currentTime; const mins = () => (ctx.currentTime - t0) / 60;
    const eraAt = m => m < 13 ? 0.02 + m / 13 * 0.28 : m < 34 ? 0.3 + (m - 13) / 21 * 0.2 : m < 46 ? 0.5 + (m - 34) / 12 * 0.35 : 0.85 + (m - 46) / 14 * 0.07;
    const say = s => window.__log(((ctx.currentTime - t0)).toFixed(1) + ' ' + s);
    M.setEra(eraAt(0)); on = true;
    M.setMood('galaxyEarly', { fade: 2 }); say('phase alone: the early programme');
    let last = null, phase = 0;
    while (ctx.currentTime - t0 < secs) {
      await new Promise(r => setTimeout(r, 250));
      const m = mins(); M.setEra(eraAt(m));
      const st = M.state(), cur = st.cur;
      if (cur !== last) { say('piece ' + cur + ' era ' + eraAt(m).toFixed(2)); last = cur; }
      if (phase === 0 && m >= 13) { phase = 1; M.setMood('galaxy', { fade: 6, quantize: 'bar', soft: true }); say('phase first contact: the full programme'); }
      if (phase === 1 && m >= 34) { phase = 2; M.setMood('galaxyWar', { fade: 6, quantize: 'bar', soft: true }); say('phase war'); }
      if (phase === 2 && m >= 46) { phase = 3; M.setMood('galaxy', { fade: 6, quantize: 'bar', soft: true }); say('phase peace: the late years'); }
      if (phase === 3 && m >= 59.5) { phase = 4; M.stop({ fade: 28 }); say('end: the music fades'); }
    }
    on = false; await new Promise(r => setTimeout(r, 1500));
    if (len) { const all = new Uint8Array(len); let o = 0; for (const c of chunks) { all.set(new Uint8Array(c.buffer), o); o += c.byteLength; } let s = ''; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000)); window.__pcm(btoa(s)); }
    say('captured frames ' + frames + ' (' + (frames / ctx.sampleRate / 60).toFixed(2) + ' min) at ' + ctx.sampleRate + ' Hz');
  }, SECS);
  fs.closeSync(pcm);
  console.log('raw bytes', written, 'errors', errors.filter(e => !/favicon/.test(e)).join(' | ') || 'none');
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
