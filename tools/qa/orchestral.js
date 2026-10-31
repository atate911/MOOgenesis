// The acceptance test for an orchestral piece (a piece with `orch: true`): what "an orchestra and a choir, held and clean" means, checked
// on the piece itself before it is published. Run it on every render of an orchestral reading; a failure names the place to look.
//   node tools/qa/orchestral.js title,title:reed,title:cello [--from 10 --to 100] [--json FILE]
// Checks, from the compiled score (instant):
//   synthetic   no synthesized voice and no synth-family recording sounds (drums, the timpani and struck bells aside)
//   held        the beds and the bass do not strike a note again that they were holding into a bar line (at most 2% of their notes)
//   window      a bed or choir note within 3 semitones of the soloist's note sounds under it for at most 12% of the solo's time
// and from a rendered excerpt (a minute or two each):
//   phase       below 150 Hz the bass, the choir and the beds agree left and right (correlation 0.9 or more); the mix 150-500 Hz 0.4 or more
//               (full string sections are naturally wide there)
//   carried     in the choir's own lowest octave neither the bass nor the beds stand more than 3 dB over the choir
const { serve, open } = require('./lib');
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const IDS = (argv.find(a => !a.startsWith('--') && !Object.values(opt).includes(a)) || 'title').split(','), T0 = +opt.from || 10, T1 = +opt.to || 100;
(async () => {
  const PORT = +process.env.PORT || 8871, srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const res = await page.evaluate(async ([IDS, T0, T1]) => {
    const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload(); const out = {};
    const SYNTH_SMP = /^pad(Serrie|Glass|Air|Dark)|^organ/;                    // the synthesized pads among the recordings
    const OK_V = { sample: 1, drum: 1, kick: 1, snare: 1, hat: 1, timp: 1 };
    for (const id of IDS) {
      const d = M._tracks[id], r = M._compile(id, 0), spb = 60 / d.bpm, meter = d.meter || 4, ev = r.events.filter(e => e.o), checks = [];
      // synthetic
      const syn = {}; for (const e of ev) { const smp = e.o.smp || ''; if ((!OK_V[e.v] && e.ly !== 'drums') || SYNTH_SMP.test(smp)) syn[(e.k || e.ly) + ':' + (smp || e.v)] = (syn[(e.k || e.ly) + ':' + (smp || e.v)] || 0) + 1; }
      checks.push({ name: 'synthetic', pass: !Object.keys(syn).length, detail: Object.keys(syn).length ? Object.entries(syn).map(([k, n]) => k + ' x' + n).join(', ') : 'none' });
      // held
      const beds = ev.filter(e => e.m && e.bt && (e.ly === 'pad' || e.ly === 'bass')); let re = 0;
      for (const e of beds) { if (Math.abs(e.b / meter - Math.round(e.b / meter)) > 0.02) continue; if (beds.some(p => p !== e && (p.k || p.ly) === (e.k || e.ly) && p.m === e.m && p.b < e.b - 0.01 && p.b + p.bt >= e.b - 0.05)) re++; }
      checks.push({ name: 'held', pass: re <= Math.max(2, 0.02 * beds.length), detail: re + ' re-struck of ' + beds.length + ' bed and bass notes' });
      // window
      const solo = ev.filter(e => e.m && e.bt && e.k === 'lead'), under = ev.filter(e => e.m && e.bt && (e.ly === 'pad' || e.ly === 'choir'));
      let soloT = 0, clashT = 0, worst = null;
      for (const s of solo) { const a = s.b, b = s.b + s.bt; soloT += s.bt; let c = 0; for (const u of under) { if (Math.abs(u.m - s.m) > 3) continue; const ov = Math.min(b, u.b + u.bt) - Math.max(a, u.b); if (ov > 0) c = Math.max(c, ov); } clashT += c; if (c > 1.5 && !worst) worst = (s.b * spb).toFixed(0) + ' s'; }
      const wf = soloT ? clashT / soloT : 0;
      checks.push({ name: 'window', pass: wf <= 0.12, detail: Math.round(wf * 100) + '% of the solo\'s time has a bed or choir note within 3 semitones' + (worst ? ' (first at ' + worst + ')' : '') });
      // phase and carried: a rendered excerpt, bus by bus
      const corr = async (buf, lo, hi) => {
        const oc = new OfflineAudioContext(2, buf.length, buf.sampleRate), src = oc.createBufferSource(); src.buffer = buf; let n = src;
        for (let k = 0; k < 2; k++) { if (lo) { const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = lo; n.connect(h); n = h; } const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = hi; n.connect(l); n = l; }
        n.connect(oc.destination); src.start(); const y = await oc.startRendering(), L = y.getChannelData(0), R = y.getChannelData(1), sr = y.sampleRate, W = Math.round(0.1 * sr), cs = []; let e2 = 0;
        for (let s = Math.round(T0 * sr); s + W <= Math.min(L.length, Math.round(T1 * sr)); s += W) { let lr = 0, ll = 0, rr = 0; for (let i = s; i < s + W; i++) { lr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i]; } e2 += ll + rr; if (ll + rr > 1e-9) cs.push(lr / Math.sqrt(ll * rr + 1e-15)); }
        cs.sort((p, q) => p - q); return { c: cs.length ? cs[cs.length >> 1] : 1, db: 10 * Math.log10(e2 / Math.max(1, cs.length) + 1e-15), n: cs.length };
      };
      const stems = {};
      for (const bus of ['bass', 'choir', 'pad', 'mix']) stems[bus] = await M.renderOffline(id, T1 + 1, Object.assign({ sampleRate: 16000, loop: false }, bus === 'mix' ? {} : { only: [bus] }));
      const ph = [], bad = [];
      for (const bus of ['bass', 'choir', 'pad']) { const k = await corr(stems[bus], 0, 150); if (k.n < 10 || k.db < -90) continue; ph.push(bus + ' ' + k.c.toFixed(2)); if (k.c < 0.9) bad.push(bus); }
      const mx = await corr(stems.mix, 150, 500); ph.push('mix 150-500 ' + mx.c.toFixed(2)); if (mx.c < 0.4) bad.push('mix');
      checks.push({ name: 'phase', pass: !bad.length, detail: ph.join(', ') });
      // the choir's own lowest octave (from its notes): where a bass or a bed covering it would be heard
      const cn = ev.filter(e => e.m && e.ly === 'choir').map(e => e.m).sort((p, q) => p - q), f0 = cn.length ? 440 * Math.pow(2, (cn[Math.floor(cn.length * 0.1)] - 69) / 12) : 0;
      if (!cn.length) checks.push({ name: 'carried', pass: true, detail: 'no choir' });
      else { const lo = Math.round(f0 * 0.85), hi = Math.round(f0 * 2.1), cb = await corr(stems.choir, lo, hi), bb = await corr(stems.bass, lo, hi), pb = await corr(stems.pad, lo, hi), over = Math.max(bb.db, pb.db) - cb.db, who = bb.db >= pb.db ? 'the bass' : 'the beds';
        checks.push({ name: 'carried', pass: over <= 3, detail: who + ' ' + (over >= 0 ? over.toFixed(1) + ' dB over' : (-over).toFixed(1) + ' dB under') + ' the choir in its lowest octave (' + lo + '-' + hi + ' Hz)' }); }
      out[id] = { orch: !!d.orch, checks };
    }
    return out;
  }, [IDS, T0, T1]);
  await browser.close(); srv.close();
  let fails = 0;
  for (const id in res) {
    console.log(id + (res[id].orch ? '' : '  (not marked orch: the profile is off)'));
    for (const c of res[id].checks) { if (!c.pass) fails++; console.log('  ' + (c.pass ? 'pass' : 'FAIL') + '  ' + c.name.padEnd(10) + c.detail); }
  }
  if (opt.json) require('fs').writeFileSync(opt.json, JSON.stringify(res, null, 1));
  console.log(fails ? '\n' + fails + ' check(s) failed' : '\nall checks pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
