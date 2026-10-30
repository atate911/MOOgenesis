// Seam examples, captured from the real-time engine in headless Chromium (node tools/audio-seams.js [outDir]): for each pair, the first
// piece plays for half a minute, the programme is asked to change softly to the second (the seam everything in the game goes through:
// the next section line or breath, the interlude the seam builds for exactly these two pieces — the outgoing key, meter, pulse and
// colour walking into the new ones — then the second piece), which plays for forty seconds and fades.
//   Writes NN-<name>.mp3 (160 kbps) and seams-log.json: every change of piece with its time, the template the seam chose and what it
//   built (the pivot chords, the opening meter and tempo glide, the voices carried in from either side). Real time: about 2.5 min each.
const { serve, open } = require('./qa/lib');
const fs = require('fs'), { execFileSync } = require('child_process');
const OUT = (process.argv[2] || 'out/seams').replace(/\/?$/, '/'); fs.mkdirSync(OUT, { recursive: true });
const EXAMPLES = [
  { n: 1, name: 'survey-vigil', a: 'galaxy16', b: 'galaxy22', era: 0.45 },      // D major 76 → F minor 52: the Neapolitan, the violas carried under
  { n: 2, name: 'cradle-long-night', a: 'galaxy7', b: 'galaxy12', era: 0.5 },   // a lullaby in six at 156 → a passacaglia in four at 50: the dotted beat handed over
  { n: 3, name: 'tide-wonder', a: 'galaxy9', b: 'galaxy1', era: 0.5 },          // D minor → G lydian: the circle walk, the men's choir carried under the strings
  { n: 4, name: 'noon-embers', a: 'galaxy19', b: 'galaxy21', era: 0.75 },       // C major → C# minor in three: the brass carried, the body in triple time
];
const LEAD = 28, TAIL = 40, WITHIN = 45;
(async () => {
  const srv = await serve(8796); const { browser, page, errors } = await open();
  const files = {}, log = [];
  await page.exposeFunction('__pcm', (name, b64) => { const b = Buffer.from(b64, 'base64'); if (!files[name]) files[name] = fs.openSync(OUT + name + '.raw', 'w'); fs.writeSync(files[name], b); });
  await page.exposeFunction('__log', line => { log.push(line); console.log(line); fs.writeFileSync(OUT + 'seams-log.json', JSON.stringify(log, null, 1)); });
  await page.goto('http://localhost:8796/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const rate = await page.evaluate(async ({ EXAMPLES, LEAD, TAIL, WITHIN }) => {
    const A = MOO.Audio, M = A.Music, R = M._rotation, S = R.S, sleep = ms => new Promise(r => setTimeout(r, ms));
    A.init(); await sleep(400); await A.Samples.preload();
    A.setVolume('music', 1); A.setVolume('sfx', 0);
    const ctx = A.ctx, eng = A.engine;
    const sp = ctx.createScriptProcessor(16384, 2, 2); let chunks = [], len = 0, name = null;
    const flush = () => { if (!len || !name) { chunks = []; len = 0; return; } const all = new Uint8Array(len); let o = 0; for (const c of chunks) { all.set(new Uint8Array(c.buffer), o); o += c.byteLength; } chunks = []; len = 0; let s = ''; for (let i = 0; i < all.length; i += 0x8000) s += String.fromCharCode.apply(null, all.subarray(i, i + 0x8000)); window.__pcm(name, btoa(s)); };
    sp.onaudioprocess = e => {
      if (!name) return;
      const L = e.inputBuffer.getChannelData(0), Rr = e.inputBuffer.getChannelData(1), n = L.length, out = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) { let l = L[i], r = Rr[i]; l = l > 1 ? 1 : l < -1 ? -1 : l; r = r > 1 ? 1 : r < -1 ? -1 : r; out[i * 2] = (l * 32767) | 0; out[i * 2 + 1] = (r * 32767) | 0; }
      chunks.push(out); len += out.byteLength; if (len >= 1 << 20) flush();
      for (let c = 0; c < 2; c++) e.outputBuffer.getChannelData(c).fill(0);
    };
    eng.outGain.connect(sp); sp.connect(ctx.destination);
    const ROT = { director: false, shuffle: false, gap: 0, gapIn: 0, fade: 6, between: ['drift', 'drift2', 'drift3', 'drift4', 'drift5', 'drift6', 'drift7'], betweenP: 1 };
    for (const ex of EXAMPLES) {
      const fn = String(ex.n).padStart(2, '0') + '-' + ex.name, t0 = ctx.currentTime, T = () => (ctx.currentTime - t0).toFixed(1), say = s => window.__log(fn + ' ' + T() + ' ' + s);
      M.setEra(ex.era); M.setSituation(null); M.setMotif(null);
      name = fn;
      M.playlist([ex.a], Object.assign({ firstFade: 2 }, ROT)); say('piece ' + ex.a + ' (' + M._tracks[ex.a].desc.split(/[—:]/)[0].trim() + ')');
      let last = ex.a, armed = false, arrived = null;
      while (true) {
        await sleep(100);
        const now = ctx.currentTime - t0, cur = M.state().cur;
        if (cur !== last) { say('piece ' + cur); last = cur; if (cur === ex.b) arrived = now; }
        if (!armed && now >= LEAD) {
          armed = true;
          const r = R.softSwitch([ex.b], ROT, { fade: 6, within: WITHIN }), sw = S.switchAt;
          if (!r || !sw) { say('soft switch refused'); continue; }
          const d = M._tracks[sw.id], inS = d.sec.find(x => x.n === 'in'), outS = d.sec[d.sec.length - 1], carried = sc => ['pad2', 'choir', 'choir2'].filter(k => sc[k] && typeof sc[k].inst === 'string').map(k => k + '=' + sc[k].inst).join(',') || 'none';
          say('seam armed in ' + (sw.at - ctx.currentTime).toFixed(1) + ' s: ' + sw.id + ' | in: ' + inS.prog + ' in ' + inS.meter + ' at ' + Math.round(inS.bpm) + '→' + inS.bpmTo + ' bpm, carried ' + carried(inS) + ' | body ' + d.meter + '/4 at ' + d.bpm + ' bpm, inst ' + JSON.stringify(d.inst) + ' | out carried ' + carried(outS));
        }
        if (arrived !== null && now - arrived >= TAIL) { M.stop({ fade: 10 }); say('fade out'); await sleep(11000); break; }
        if (now > 400) { say('gave up'); M.stop({ fade: 2 }); await sleep(3000); break; }
      }
      flush(); name = null; await sleep(500);
      window.__log(fn + ' captured');
    }
    return ctx.sampleRate;
  }, { EXAMPLES, LEAD, TAIL, WITHIN });
  for (const k in files) fs.closeSync(files[k]);
  console.log('sample rate', rate, 'errors', errors.filter(e => !/favicon/.test(e)).join(' | ') || 'none');
  await browser.close(); srv.close();
  for (const ex of EXAMPLES) {
    const fn = String(ex.n).padStart(2, '0') + '-' + ex.name;
    if (!fs.existsSync(OUT + fn + '.raw')) continue;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '2', '-i', OUT + fn + '.raw', '-codec:a', 'libmp3lame', '-b:a', '160k', OUT + fn + '.mp3']);
    fs.unlinkSync(OUT + fn + '.raw'); console.log('wrote', fn + '.mp3', Math.round(fs.statSync(OUT + fn + '.mp3').size / 1024) + ' kB');
  }
})().catch(e => { console.error(e); process.exit(1); });
