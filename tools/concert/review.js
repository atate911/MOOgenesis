// Renders pieces of the score for the A/B review page (the published game against the symphonic score): one full first pass of each
// piece (its first form, so both sides play the same course), encoded as Opus in WebM, with what the page needs to switch between the two
// in step: the loudness (to match them), the sections' starts and every beat's time.
//   node tools/concert/review.js --tag b --ids title,galaxy1 [--root DIR] [--out DIR] [--port 8890]
//   --root: the checkout to render from (the published game: a copy of main's js/ and tools/test-audio.html, tools/lib/, with assets/)
// Writes <out>/<tag>/<id>.webm and <out>/<tag>/<id>.json.
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');
const { open } = require('../qa/lib');
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
const ROOT = path.resolve(opt.root || path.join(__dirname, '..', '..')), TAG = opt.tag || 'b', PORT = +opt.port || 8890, SR = 48000;
const OUT = path.join(path.resolve(opt.out || path.join(__dirname, 'out', 'review')), TAG);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
function serve() {
  return new Promise(res => { const s = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(PORT, () => res(s)); });
}
(async () => {
  const srv = await serve(), { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html`);
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music && window.AudioMetrics, null, { timeout: 60000 });
  await page.evaluate(async () => { await MOO.Audio.Samples.preload(); });
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of String(opt.ids).split(',')) {
    const info = await page.evaluate(async ([id, SR]) => {
      const M = MOO.Audio.Music, d = M._tracks[id]; if (!d) return { err: 'no such piece' };
      if (d.forms && d.forms.length > 1) { d.forms = [d.forms[0]]; d._p = null; }
      const c = M._compile(id, 0), secs = Math.min(c.len + 6, 480);
      const b = await M.renderOffline(id, secs, { loop: false, sampleRate: SR });
      const n = b.length, fade = Math.min(n, Math.round(3 * SR));   // the tail fades under the hall
      for (let ch = 0; ch < b.numberOfChannels; ch++) { const x = b.getChannelData(ch); for (let k = 0; k < fade; k++) x[n - fade + k] *= Math.pow(1 - k / fade, 2); }
      const a = AudioMetrics.analyze(b);
      return { wav: AudioMetrics.wavBase64(b), lufs: a.lufs, peak: a.peakDb, secs: n / SR, first: c.len, desc: d.desc || '',
        sections: c.wraps.map(w => ({ n: w.R.n, t: +w.t0.toFixed(3), bars: w.bars })), beats: (b.mooBeats || []).filter(t => t >= 0 && t <= c.len).map(t => +t.toFixed(3)) };
    }, [id, SR]);
    if (info.err) { console.log(`${id}: ${info.err}`); continue; }
    const base = path.join(OUT, id.replace(/[^a-z0-9]+/gi, '-')), wav = base + '.wav';
    fs.writeFileSync(wav, Buffer.from(info.wav, 'base64'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', '96k', '-vbr', 'on', base + '.webm']); fs.unlinkSync(wav);
    delete info.wav; fs.writeFileSync(base + '.json', JSON.stringify(info));
    console.log(`${TAG} ${id}: ${info.secs.toFixed(0)} s, ${info.lufs.toFixed(1)} LUFS, peak ${info.peak.toFixed(1)} dB, ${info.sections.length} sections`);
  }
  if (errors.some(e => /pageerror/.test(e))) console.log('page errors:\n  ' + errors.filter(e => /pageerror/.test(e)).join('\n  '));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
