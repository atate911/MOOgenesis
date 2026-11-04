// The acceptance test for an orchestral piece (a piece with `orch: true`): what "an orchestra and a choir, held and clean" means, checked
// on the piece itself before it is published. Run it on every render of an orchestral reading; a failure names the place to look.
//   node tools/qa/orchestral.js title,title:reed,title:cello [--from 10 --to 100] [--json FILE]
// Checks, from the compiled score (instant):
//   synthetic   no synthesized voice and no synth-family recording sounds (drums, the timpani and struck bells aside)
//   held        the beds and the bass do not strike a note again that they were holding into a bar line, on the same instrument (at most
//               2% of their notes)
//   window      a bed or choir note within 3 semitones of the soloist's note sounds under it for at most 12% of the solo's time
//   expressive  the tempo breathes (bar lengths spread 1% or more), the beds' expression moves 3 dB or more, 60% or more of the solo's
//               held notes are shaped (rising into the climax, blooming on it, releasing after)
//   performed   the ensemble plays as players: each part but the solo (whose time is the conductor's) leans ahead and behind over time
//               (its onsets against the score's grid, averaged over 8 beats, wander by 4 ms or more), a chord's notes spread (median 10 ms or more), each part's note levels vary (1.5 dB or
//               more from the 10th to the 90th percentile) and the sections breathe on their own (the beds' and the choir's expression
//               correlate under 0.97)
// and from a rendered excerpt (a minute or two each):
//   phase       below 150 Hz the bass, the choir and the beds agree left and right (correlation 0.9 or more); the mix 150-500 Hz 0.4 or more
//               (full string sections are naturally wide there)
//   carried     in the choir's own lowest octave neither the bass nor the beds stand more than 3 dB over the choir
//   clean       the bass is a tone, not a bow: its energy above 500 Hz is 35 dB or more under its 30-250 Hz
//   balance     an orchestra with a choir, not a choir alone: in the excerpt the choir stands at most 4.5 dB over the strings where the
//               ear is most sensitive (250 Hz-4 kHz)
//   continuous  the foundation is one continuous sound: the bass and the beds' voices below E3 begin at most 4 notes a minute (from the
//               score), and the bass's level 40-300 Hz moves 1.5 dB or less between 0.3 s and 6 s (a loop's swell, a pulse at each bar)
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
    const OK_V = { sample: 1, drum: 1, kick: 1, snare: 1, hat: 1, timp: 1, expr: 1, fx: 1 };   // expr: the expression curve, not a sound
    for (const id of IDS) {
      const d = M._tracks[id], r = M._compile(id, 0), spb = 60 / d.bpm, meter = d.meter || 4, ev = r.events.filter(e => e.o), checks = [];
      // synthetic
      const syn = {}; for (const e of ev) { const smp = e.o.smp || ''; if ((!OK_V[e.v] && e.ly !== 'drums') || SYNTH_SMP.test(smp)) syn[(e.k || e.ly) + ':' + (smp || e.v)] = (syn[(e.k || e.ly) + ':' + (smp || e.v)] || 0) + 1; }
      checks.push({ name: 'synthetic', pass: !Object.keys(syn).length, detail: Object.keys(syn).length ? Object.entries(syn).map(([k, n]) => k + ' x' + n).join(', ') : 'none' });
      // held
      const beds = ev.filter(e => e.m && e.bt && (e.ly === 'pad' || e.ly === 'bass')); let re = 0;
      for (const e of beds) { if (Math.abs(e.b / meter - Math.round(e.b / meter)) > 0.02) continue; if (beds.some(p => p !== e && (p.k || p.ly) === (e.k || e.ly) && (p.o.smp || p.v) === (e.o.smp || e.v) && p.m === e.m && p.b < e.b - 0.01 && p.b + p.bt >= e.b - 0.05)) re++; }   // the same instrument: a section handing a note to another at a section line is orchestration
      checks.push({ name: 'held', pass: re <= Math.max(2, 0.02 * beds.length), detail: re + ' re-struck of ' + beds.length + ' bed and bass notes' });
      // window
      const solo = ev.filter(e => e.m && e.bt && e.k === 'lead'), under = ev.filter(e => e.m && e.bt && (e.ly === 'pad' || e.ly === 'choir'));
      let soloT = 0, clashT = 0, worst = null;
      for (const s of solo) { const a = s.b, b = s.b + s.bt; soloT += s.bt; let c = 0; for (const u of under) { if (Math.abs(u.m - s.m) > 3) continue; const ov = Math.min(b, u.b + u.bt) - Math.max(a, u.b); if (ov > 0) c = Math.max(c, ov); } clashT += c; if (c > 1.5 && !worst) worst = (s.b * spb).toFixed(0) + ' s'; }
      const wf = soloT ? clashT / soloT : 0;
      checks.push({ name: 'window', pass: wf <= 0.12, detail: Math.round(wf * 100) + '% of the solo\'s time has a bed or choir note within 3 semitones' + (worst ? ' (first at ' + worst + ')' : '') });
      // expressive: the tempo breathes, the beds move with the music, the solo's held notes go somewhere
      const bl = []; for (let i = 1; i < r.bars.length; i++) bl.push(r.bars[i] - r.bars[i - 1]); const bm = bl.reduce((p, q) => p + q, 0) / bl.length, bsd = Math.sqrt(bl.reduce((p, q) => p + (q - bm) * (q - bm), 0) / bl.length) / bm;
      const xg = ev.filter(e => e.v === 'expr' && e.ly === 'pad').map(e => e.o.x !== undefined ? e.o.x : e.o.g),   // the movement (the stage also carries the section's dynamic)
        xr = xg.length ? 20 * Math.log10(Math.max(...xg) / Math.min(...xg)) : 0;
      const held = solo.filter(e => e.bt >= 1.5), shaped = held.filter(e => e.o.swell !== undefined && Math.abs(e.o.swell - e.o.dyn) > 0.03).length, sf = held.length ? shaped / held.length : 1;
      checks.push({ name: 'expressive', pass: bsd >= 0.01 && xr >= 3 && sf >= 0.6, detail: 'tempo spread ±' + (100 * bsd).toFixed(1) + '%, the beds move ' + xr.toFixed(1) + ' dB, ' + Math.round(sf * 100) + '% of the solo\'s held notes shaped' });
      // performed: the ensemble, part by part, against the score's grid
      { const bt = r.beatsT, grid = b => { const i = Math.min(Math.floor(b), bt.length - 2), f = b - i; return bt[i] + f * (bt[i + 1] - bt[i]); }, q = (a, p) => { const x = a.slice().sort((u, v) => u - v); return x[Math.min(x.length - 1, Math.floor(p * x.length))]; };
        const parts = {}; for (const e of ev) if (e.m && e.bt && e.ly !== 'drums') (parts[e.k || e.ly] = parts[e.k || e.ly] || []).push(e);
        const flat = [], still = [], chords = [], lv = [];
        for (const k in parts) {
          const L = parts[k]; if (L.length < 8) continue;
          const win = {}; for (const e of L) (win[Math.floor(e.b / 8)] = win[Math.floor(e.b / 8)] || []).push(1000 * (e.t - grid(e.b)));
          const means = Object.values(win).filter(x => x.length >= 2).map(x => x.reduce((p, z) => p + z, 0) / x.length);
          if (means.length >= 4 && k !== 'lead') { const mm = means.reduce((p, z) => p + z, 0) / means.length, sd = Math.sqrt(means.reduce((p, z) => p + (z - mm) * (z - mm), 0) / means.length); if (sd < 4) still.push(k + ' ' + sd.toFixed(1) + ' ms'); }
          const at = {}; for (const e of L) (at[e.b.toFixed(4)] = at[e.b.toFixed(4)] || []).push(e.t); for (const x of Object.values(at)) if (x.length > 1) chords.push(1000 * (Math.max(...x) - Math.min(...x)));
          const g = L.filter(e => e.pf).map(e => e.pf[1]); const gr = g.length >= 8 ? q(g, 0.9) - q(g, 0.1) : 0; lv.push(gr); if (gr < 1.5) flat.push(k + ' ' + gr.toFixed(1) + ' dB');
        }
        const sp = chords.length ? q(chords, 0.5) : 0;
        const xs = {}; for (const e of ev) if (e.v === 'expr') (xs[e.ly] = xs[e.ly] || []).push(Math.log(e.o.x !== undefined ? e.o.x : e.o.g));
        const cor = (a, b) => { if (!a || !b) return 0; const n = Math.min(a.length, b.length); let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i] / n; mb += b[i] / n; } let ab = 0, aa = 0, bb = 0; for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; } return ab / Math.sqrt(aa * bb + 1e-15); };
        const sung = ev.some(e => e.m && e.ly === 'choir'), pc = sung ? cor(xs.pad, xs.choir) : 0;
        checks.push({ name: 'performed', pass: !still.length && !flat.length && sp >= 10 && pc < 0.97, detail: (still.length ? 'on the grid: ' + still.join(', ') + '; ' : 'every part leans; ') + 'chords spread ' + Math.round(sp) + ' ms; ' + (flat.length ? 'level fixed: ' + flat.join(', ') : 'note levels vary ' + Math.min(...lv).toFixed(1) + '-' + Math.max(...lv).toFixed(1) + ' dB') + (sung ? '; beds and choir correlate ' + pc.toFixed(2) : '') }); }
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
      // balance: the choir against the strings, 250 Hz-4 kHz
      if (cn.length) { const cb2 = await corr(stems.choir, 250, 4000), pb2 = await corr(stems.pad, 250, 4000), lead = cb2.db - pb2.db;
        checks.push({ name: 'balance', pass: lead <= 4.5, detail: 'the choir ' + (lead >= 0 ? lead.toFixed(1) + ' dB over' : (-lead).toFixed(1) + ' dB under') + ' the strings, 250 Hz-4 kHz' }); }
      // clean: the bass's tone against its noise
      { const hi = await corr(stems.bass, 500, 6000), lo = await corr(stems.bass, 30, 250), dd = hi.db - lo.db;
        checks.push({ name: 'clean', pass: lo.n < 10 || dd <= -35, detail: lo.n < 10 ? 'no bass' : 'the bass above 500 Hz ' + (-dd).toFixed(0) + ' dB under its tone' }); }
      // continuous: the foundation holds, and the held bass does not pulse
      { const lowOn = ev.filter(e => e.m && e.bt && e.t >= 10 && (e.ly === 'bass' || (e.ly === 'pad' && e.m <= 52))).length, mins = Math.max(0.5, (r.len - 10) / 60), perMin = lowOn / mins;
        const oc = new OfflineAudioContext(1, stems.bass.length, stems.bass.sampleRate), src = oc.createBufferSource(); src.buffer = stems.bass; let n = src;
        for (let k = 0; k < 2; k++) { const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 40; n.connect(h); n = h; const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = 300; n.connect(l); n = l; }
        n.connect(oc.destination); src.start(); const x = (await oc.startRendering()).getChannelData(0), W = Math.round(0.05 * stems.bass.sampleRate), e = [];
        for (let i = 0; i + W <= x.length; i += W) { let q = 0; for (let k = i; k < i + W; k++) q += x[k] * x[k]; e.push(10 * Math.log10(q / W + 1e-12)); }
        const mav = (v, R) => v.map((_, i) => { let q = 0, c = 0; for (let k = Math.max(0, i - R); k <= Math.min(v.length - 1, i + R); k++) { q += v[k]; c++; } return q / c; });
        const sm = mav(e, 3), tr = mav(e, 60), f = []; for (let i = Math.round(T0 / 0.05); i < Math.min(e.length, Math.round(T1 / 0.05)); i++) if (e[i] > -90) f.push(sm[i] - tr[i]);
        const so = f.sort((p, q) => p - q), mv = so.length ? so[Math.floor(so.length * 0.95)] - so[Math.floor(so.length * 0.05)] : 0;
        checks.push({ name: 'continuous', pass: perMin <= 4 && mv <= 1.5, detail: perMin.toFixed(1) + ' low notes begin a minute; the held bass moves ' + mv.toFixed(1) + ' dB' }); }
      out[id] = { orch: !!d.orch, checks };
    }
    return out;
  }, [IDS, T0, T1]);
  await browser.close(); srv.close();
  let fails = 0;
  for (const id in res) {
    console.log(id + (res[id].orch ? '' : '  (not marked orch: the profile is off)'));
    for (const c of res[id].checks) { if (!c.pass) fails++; console.log('  ' + (c.pass ? 'pass' : 'FAIL') + '  ' + c.name.padEnd(11) + c.detail); }
  }
  if (opt.json) require('fs').writeFileSync(opt.json, JSON.stringify(res, null, 1));
  console.log(fails ? '\n' + fails + ' check(s) failed' : '\nall checks pass');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
