// Every looped sustain, held through the real music path: one note per recorded zone of every sustain instrument, fourteen seconds on the
// lead strip (the hall and the stage sends as a solo line has them), rendered offline (a beat's rest, then the note held fifteen beats at 60). For each: the level swing over the held part (RMS in
// 60 ms windows, 95th less 5th percentile, dB), the slow swing (the same after a ±240 ms mean: under about two hertz, which is where a
// loop's breath or vibrato cycle shows as a pulse), the strongest periodicity of the envelope between 0.4 and 4 s and its lag, and the seam
// steps (one-sample steps above six times the local mean: a click once per loop). A zone is flagged when its slow swing is above the
// threshold (default 1.2 dB) or it has a seam step. Prints a table, the worst first, and exits 1 on any flag.
//   node tools/qa/loops.js [--insts altoFlute,oboe] [--limit 1.2] [--json FILE]
const { serve, open } = require('./lib');
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const LIMIT = +opt.limit || 1.2;
(async () => {
  const PORT = +process.env.PORT || 8803, srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const rows = await page.evaluate(async ([want]) => {
    const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload();
    const INST = M._INST, bySmp = {};                                             // the engine's instrument names for each sample set
    for (const k in INST) { const d = INST[k]; if (d && d.v === 'sample' && d.smp && !bySmp[d.smp]) bySmp[d.smp] = k; }
    const names = Object.keys(S.inst).filter(n => S.inst[n].loop && S.inst[n].ready && bySmp[n] && (!want || want.includes(n)));
    const out = [];
    const metric = (x, sr) => { const a = Math.round(3 * sr), b = Math.round(15.5 * sr), W = Math.round(0.06 * sr), env = []; for (let i = a; i + W <= b; i += W >> 1) { let q = 0; for (let k = i; k < i + W; k++) q += x[k] * x[k]; env.push(Math.sqrt(q / W)); }
      const sw = e => { const s = e.slice().sort((p, q) => p - q); return +(20 * Math.log10(s[Math.floor(s.length * 0.95)] / (s[Math.floor(s.length * 0.05)] || 1e-9))).toFixed(1); };
      const R = 8, slow = env.map((v, i) => { let q = 0, c = 0; for (let k = Math.max(0, i - R); k <= Math.min(env.length - 1, i + R); k++) { q += env[k]; c++; } return q / c; });
      const mean = env.reduce((p, q) => p + q, 0) / env.length, e0 = env.map(v => v - mean), hopS = (W >> 1) / sr; let best = 0, lag = 0; const v0 = e0.reduce((p, q) => p + q * q, 0) || 1e-9;
      for (let L = Math.round(0.4 / hopS); L <= Math.round(4 / hopS) && L < e0.length / 2; L++) { let c = 0; for (let i = 0; i + L < e0.length; i++) c += e0[i] * e0[i + L]; c /= v0; if (c > best) { best = c; lag = L * hopS; } }
      let steps = 0, i = a; const Ws = Math.round(0.02 * sr);
      while (i < b) { const d = Math.abs(x[i] - x[i - 1]); let m = 0, c = 0; for (let k = i - Ws; k < i + Ws; k += 5) { m += Math.abs(x[k] - x[k - 1]); c++; } m = m / c + 1e-9; if (d / m > 6 && d > 0.002) { steps++; i += Math.round(0.01 * sr); } else i += 2; }
      return { swing: sw(env), slow: sw(slow), ac: +best.toFixed(2), lag: +lag.toFixed(2), steps, rmsDb: +(20 * Math.log10(mean || 1e-9)).toFixed(1) }; };
    for (const smp of names) {
      const inst = S.inst[smp], eng = bySmp[smp];
      for (const z of inst.zones) {
        if (!z.loop) continue;
        const midi = Math.round(Math.min(z.hi, Math.max(z.lo, z.root)));   // the zone's root (the manifest's roots carry cents)
        const id = 'loopqa:' + smp + ':' + midi;
        M._define(id, { bpm: 60, root: 'C C# D Eb E F F# G Ab A Bb B'.split(' ')[midi % 12], tonic: midi, mode: 'major', hidden: true, tens: false, trim: 1, rubato: 0, loopFrom: 'A', inst: { lead: eng }, ph: { N: 'r:1 1:15' }, sec: [{ n: 'A', bars: 4, lv: 0.8, prog: 'I:4', lead: { ph: 'N', vel: 0.6 } }] });   // the note at the zone's own root, no transposition; a beat's rest first so the note's jitter never puts it before the render starts
        let buf; try { buf = await M.renderOffline(id, 16.5, { from: 0, intensity: 0, sampleRate: 44100, loop: false }); } catch (e) { out.push({ smp, eng, midi, error: String(e && e.message || e) }); continue; }
        out.push(Object.assign({ smp, eng, midi, loop: +(z.loop[1] - z.loop[0]).toFixed(2) }, metric(buf.getChannelData(0), buf.sampleRate)));
      }
    }
    return out;
  }, [opt.insts ? String(opt.insts).split(',') : null]);
  await browser.close(); srv.close();
  const ok = rows.filter(r => !r.error), bad = ok.filter(r => r.slow > LIMIT || r.steps > 0);
  ok.sort((a, b) => (b.slow - a.slow) || (b.steps - a.steps));
  const nm = n => 'C C# D Eb E F F# G Ab A Bb B'.split(' ')[n % 12] + (Math.floor(n / 12) - 1);
  console.log('zone                       note  loop s  level swing  slow swing  periodicity     steps  rms dB');
  for (const r of ok.slice(0, +opt.show || 40)) console.log((r.smp + ' (' + r.eng + ')').padEnd(26), nm(r.midi).padEnd(5), String(r.loop).padStart(6), String(r.swing).padStart(12), String(r.slow).padStart(11), (r.ac + ' @ ' + r.lag + ' s').padStart(15), String(r.steps).padStart(6), String(r.rmsDb).padStart(7), r.slow > LIMIT || r.steps ? '  <-- flagged' : '');
  for (const r of rows.filter(r => r.error)) console.log('ERROR', r.smp, r.midi, r.error);
  const byInst = {}; for (const r of ok) { const k = r.smp; byInst[k] = byInst[k] || { n: 0, slow: 0, worst: 0 }; byInst[k].n++; byInst[k].slow += r.slow; byInst[k].worst = Math.max(byInst[k].worst, r.slow); }
  console.log('\nper instrument (mean slow swing dB / worst zone):', Object.entries(byInst).sort((a, b) => b[1].worst - a[1].worst).map(([k, v]) => k + ' ' + (v.slow / v.n).toFixed(1) + '/' + v.worst.toFixed(1)).join(', '));
  console.log('\n' + ok.length + ' zones held; ' + bad.length + ' flagged (slow swing above ' + LIMIT + ' dB or a seam step)');
  if (opt.json) require('fs').writeFileSync(opt.json, JSON.stringify(rows, null, 1));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
