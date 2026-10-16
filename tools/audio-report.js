// Headless "listening" pass over the procedural soundtrack and sound effects (renders through OfflineAudioContext in Chromium).
//   node tools/audio-report.js                         lint + a 30 s window of every track + the first 20 s + every effect
//   node tools/audio-report.js --full                  also the whole loop of every track
//   node tools/audio-report.js --tracks title,combat1 --sfx click,laser --intensity 0,1 --secs 30
//   node tools/audio-report.js --wav DIR [--mp3]       also save the renders (16-bit WAV; --mp3 converts with ffmpeg when present)
//   node tools/audio-report.js --json FILE             machine-readable report (everything that is printed, plus per-item metrics)
// Levels are measured at unity bus gain (the Options volumes are not applied) after the master compressor / soft clipper,
// so "knee %" = share of samples the limiter is bending (> 0.6) and "hot %" = share above 0.9.  LUFS per ITU-R BS.1770.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { serve, open } = require('./qa/lib');

const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) { const k = a.slice(2); opt[k] = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : true; } }
const list = v => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : null);
const SECS = +opt.secs || 30, SR = +opt.sr || 48000, PORT = +opt.port || 8771;
const INT = list(opt.intensity) ? list(opt.intensity).map(Number) : null;
const r1 = x => (x === -Infinity ? '-inf' : (Math.round(x * 10) / 10).toFixed(1)), r2 = x => (Math.round(x * 100) / 100).toFixed(2);
const pad = (s, n, right) => { s = String(s); return right ? s.padStart(n) : s.padEnd(n); };
function table(head, rows) {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => pad(c, w[i], i > 0)).join('  ');
  console.log(line(head)); console.log(w.map(n => '-'.repeat(n)).join('  '));
  for (const r of rows) console.log(line(r));
}

(async () => {
  const srv = await serve(PORT);
  const { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html`);
  await page.addScriptTag({ url: `http://localhost:${PORT}/tools/lib/audio-metrics.js` });
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music && MOO.Audio.SFX && window.AudioMetrics);
  const report = { when: new Date().toISOString(), sr: SR, secs: SECS, lint: {}, music: {}, sfx: {}, notes: [] };
  const wavDir = typeof opt.wav === 'string' ? path.resolve(opt.wav) : null;
  if (wavDir) fs.mkdirSync(wavDir, { recursive: true });
  const saveWav = (name, b64) => {
    if (!wavDir || !b64) return;
    const f = path.join(wavDir, name + '.wav'); fs.writeFileSync(f, Buffer.from(b64, 'base64'));
    if (opt.mp3) { try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-codec:a', 'libmp3lame', '-q:a', '3', f.replace(/\.wav$/, '.mp3')]); fs.unlinkSync(f); } catch (e) { /* keep the wav */ } }
  };

  // ---- composition lint (no rendering) ---------------------------------------------------------------------------------
  const lint = await page.evaluate(() => { const out = {}; for (const t of MOO.Audio.Music.list()) { try { out[t.id] = MOO.Audio.Music.analyze(t.id); } catch (e) { out[t.id] = { error: e.message }; } } return out; });
  report.lint = lint;
  const trackIds = list(opt.tracks) || Object.keys(lint);
  if (!opt['no-lint']) {
    console.log('\n== composition lint ==');
    table(['track', 'key', 'bpm', 'm', 'intro+loop s', 'secs', 'lead n', 'strong CT/ok', 'leap', 'ev/s', 'det', 'var', 'warnings'],
      trackIds.map(id => { const a = lint[id]; if (!a || a.error) return [id, 'ERR', '', '', '', '', '', '', '', '', '', '', a && a.error]; const ct = a.lead.strongCT === null ? '-' : Math.round(a.lead.strongCT * 100) + '/' + Math.round(a.lead.strongOK * 100) + '%'; return [id, a.key, a.bpm, a.meter, r1(a.introSec) + '+' + r1(a.loopSec), a.secs.length, a.lead.notes, ct, a.lead.maxLeap, a.eventsPerSec, a.deterministic ? 'y' : 'NO', Math.round(a.variation * 100) + '%', a.warnings.join('; ') || '-']; }));
  }

  // ---- music renders -------------------------------------------------------------------------------------------------------
  const renderTrack = (id, secs, o) => page.evaluate(async ([id, secs, o]) => {
    const M = MOO.Audio.Music, AM = window.AudioMetrics, t0 = performance.now();
    const pre = o.pre || 0;
    let buf = await M.renderOffline(id, secs + pre, { from: (o.from || 0) - pre, intensity: o.intensity || 0, sampleRate: o.sr, only: o.only });
    const st = buf.mooStats || {};
    if (pre) { const off = Math.round(pre * buf.sampleRate), b = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: buf.length - off, sampleRate: buf.sampleRate }); for (let c = 0; c < buf.numberOfChannels; c++) b.copyToChannel(buf.getChannelData(c).subarray(off), c); buf = b; }
    const a = AM.analyze(buf); a.voices = { peak: st.peak || 0, created: st.created || 0, stolen: st.stolen || 0, refused: st.refused || 0 }; a.renderMs = Math.round(performance.now() - t0);
    delete a.env; delete a.feat;
    return { a, wav: o.wav ? AM.wavBase64(buf) : null };
  }, [id, secs, o]);
  const musicFlags = a => {
    const f = [];
    if (a.nan) f.push('NaN'); if (a.lufs > -14) f.push('loud'); if (a.lufs < -24 && a.lufs > -90) f.push('quiet');
    if (a.kneePct > 2) f.push('limiter'); if (a.hotPct > 0.25) f.push('hot'); if (a.clip) f.push('clip');
    if (a.silentPct > 15) f.push('silence'); if (a.corr < 0.15) f.push('phasey'); if (a.tiltDbOct > -2) f.push('bright'); if (a.tiltDbOct < -8) f.push('dull');
    if (a.voices.refused) f.push('refused'); if (a.voices.stolen > 0.01 * Math.max(1, a.voices.created)) f.push('stealing');
    return f;
  };
  const musicRow = (name, a) => [name, r1(a.lufs), r1(a.lufsShort), r1(a.lra), r1(a.peakDb), r1(a.crestDb), r2(a.kneePct), r2(a.hotPct), a.clip, r1(a.silentPct), r1(a.tiltDbOct), Math.round(a.centroid), a.bands.map(b => Math.round(b)).join('/'), r2(a.corr), a.voices.peak + '/' + a.voices.stolen + '/' + a.voices.refused, (a.renderMs / 1000).toFixed(1), musicFlags(a).join(',') || 'ok'];
  const MH = ['render', 'LUFS', 'S-max', 'LRA', 'peak', 'crest', 'knee%', 'hot%', 'clip', 'sil%', 'tilt', 'cent', 'sub/lo/lm/mid/hi/air', 'corr', 'vox pk/st/ref', 'ms', 'flags'];
  if (!opt['no-music']) {
    const rows = [];
    for (const id of trackIds) {
      const li = lint[id]; if (!li || li.error) continue;
      const intro = li.introSec || 0, loop = li.loopSec || 60;
      const ints = INT || [0];
      for (const inten of ints) {
        const tag = inten ? '@' + inten : '';
        if (!opt['no-intro'] && !inten) {
          const h = await renderTrack(id, Math.min(20, intro + loop), { from: 0, intensity: 0, sr: SR, wav: !!wavDir });
          report.music[id + ':head'] = h.a; rows.push(musicRow(id + ' head 0-20s', h.a)); saveWav(id + '-head', h.wav);
        }
        const w = await renderTrack(id, SECS, { from: intro, pre: Math.min(8, intro), intensity: inten, sr: SR, wav: !!wavDir });
        report.music[id + ':loop' + tag] = w.a; rows.push(musicRow(id + ' loop ' + SECS + 's' + tag, w.a)); saveWav(id + '-loop' + (tag ? tag.replace('@', '-i') : ''), w.wav);
        if (opt.full) {
          const f = await renderTrack(id, intro + loop, { from: 0, intensity: inten, sr: SR, wav: !!wavDir });
          report.music[id + ':full' + tag] = f.a; rows.push(musicRow(id + ' full' + tag, f.a)); saveWav(id + '-full' + (tag ? tag.replace('@', '-i') : ''), f.wav);
        }
      }
      process.stderr.write('.');
    }
    console.log('\n\n== music renders (unity gain, after master chain) ==');
    table(MH, rows);
  }

  // ---- sfx renders ---------------------------------------------------------------------------------------------------------
  if (!opt['no-sfx']) {
    const ids = list(opt.sfx) || await page.evaluate(() => MOO.Audio.SFX.list().map(x => x.id));
    const rows = [];
    for (const id of ids) {
      const r = await page.evaluate(async ([id, sr, wav]) => {
        const buf = await MOO.Audio.SFX.render(id, { sampleRate: sr }), a = window.AudioMetrics.analyze(buf), info = MOO.Audio.SFX.info(id);
        a.fv = a.feat.concat(a.env.map(x => Math.log10(x + 1e-6) * 1.5)); delete a.env; delete a.feat; a.info = info;
        return { a, wav: wav ? window.AudioMetrics.wavBase64(buf) : null };
      }, [id, SR, !!wavDir]);
      report.sfx[id] = r.a; saveWav('sfx-' + id, r.wav);
      process.stderr.write('.');
    }
    const sids = Object.keys(report.sfx), cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / Math.sqrt(na * nb || 1); };
    for (const id of sids) {
      const a = report.sfx[id]; let best = null, bs = -1;
      for (const o of sids) { if (o === id) continue; const s = cosine(a.fv, report.sfx[o].fv); if (s > bs) { bs = s; best = o; } }
      a.nearest = best; a.nearestSim = bs;
    }
    for (const id of sids) {
      const a = report.sfx[id], best = a.nearest, bs = a.nearestSim; delete a.fv;
      const f = [];
      if (a.nan) f.push('NaN'); if (a.clip) f.push('clip'); if (a.hotPct > 1) f.push('hot'); if (a.head > 0.02) f.push('click-in'); if (a.tail > 0.003) f.push('cut-tail'); if (a.peak < 0.08) f.push('quiet'); if (a.effSecs < 0.02) f.push('too-short'); if (bs > 0.995) f.push('twin:' + best);
      a.flags = f;
      rows.push([id, r2(a.effSecs), r1(a.peakDb), r1(a.lufsMoment), r1(a.actDb), Math.round(a.centroid), a.bands.map(b => Math.round(b)).join('/'), r2(a.kneePct), (a.info && a.info.gain) || '', r2(a.head), r2(a.tail * 100), best + ' ' + r2(bs), f.join(',') || 'ok']);
    }
    console.log('\n\n== sound effects (unity gain) ==');
    table(['sfx', 'len s', 'peak dB', 'LUFS-M', 'act dB', 'cent', 'sub/lo/lm/mid/hi/air', 'knee%', 'trim', 'head', 'tail e-2', 'nearest', 'flags'], rows);
  }

  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(report, null, 1));
  const errs = errors.filter(e => !/favicon/.test(e));
  if (errs.length) { console.log('\nbrowser console:'); for (const e of errs) console.log('  ' + e); }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
