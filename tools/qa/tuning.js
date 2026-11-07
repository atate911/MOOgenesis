// Tuning audit: every pitched zone of every instrument (or the named ones), measured as the sampler plays it, against equal temperament
// at A440. A looped zone over its loop, a struck or plucked one just after its attack (60-700 ms). The measure is independent of the
// sampler's own refinement (a different window and threshold), so it checks it rather than repeats it.
//   node tools/qa/tuning.js [name,name,...] [--tol 3] [--json FILE]     (sections and choirs: 6 cents, the spread of their players)
// Per instrument: zones, how many measured, the median and the largest error (cents), and every zone past the tolerance. A zone too
// noisy or inharmonic to measure (a choir's spread, a chime) is counted, not failed. Exit 1 when any measured zone is past the tolerance.
const { serve, open } = require('./lib'); const fs = require('fs');
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
// the instruments whose heard pitch is not the period of the wave (bells' strike tones, drums): as the sampler, not measured
const NOPITCH = /^(chimes|crotales|timp|gong|crash|cymSwell|anvil|bassDrum|snare|tenor|tamb|claves|shaker|taps|woodBlock|triangle|bellTree|sleigh)/;
// a section or a choir is many players a few cents apart: its pitch is their spread's centre, measured to about the spread
const ENSEMBLE = /^(chorus|choir|str|brass|lowBrass|pad)/, ENS_TOL = 6;
const NAMES = (argv.find(a => !a.startsWith('--') && !Object.values(opt).includes(a)) || '').split(',').filter(Boolean), TOL = +opt.tol || 3;
(async () => {
  const PORT = +opt.port || 8873, srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Samples);
  const res = await page.evaluate(async ([NAMES, NOP]) => { const NOPITCH = new RegExp(NOP);
    const A = MOO.Audio, S = A.Samples; if (!A.ctx) A.init(); await S.preload(); const out = {};
    const pitchMedian = (d, a, b, sr, root, oneShot) => {
      const f0 = 440 * Math.pow(2, (root - 69) / 12), P0 = sr / f0; if (P0 < 16) return null; const lo = Math.floor(P0 / 1.04), hi = Math.ceil(P0 * 1.04) + 1, W = Math.round(Math.max(4 * P0, 0.03 * sr)), v = [];
      for (let s = a; s + W + hi < b; s += Math.round(0.01 * sr)) {
        let ea = 0; for (let i = 0; i < W; i++) ea += d[s + i] * d[s + i]; if (ea < 1e-9) continue;
        let best = -2, bk = 0; const cs = [];
        for (let P = lo; P <= hi; P++) { let xy = 0, yy = 0; for (let i = 0; i < W; i++) { const y = d[s + i + P]; xy += d[s + i] * y; yy += y * y; } const c = xy / Math.sqrt(ea * yy + 1e-15); cs.push(c); if (c > best) { best = c; bk = cs.length - 1; } }
        if (best < 0.8 || bk === 0 || bk === cs.length - 1) continue;
        const den = cs[bk - 1] - 2 * cs[bk] + cs[bk + 1], off = den < 0 ? 0.5 * (cs[bk - 1] - cs[bk + 1]) / den : 0;
        v.push([69 + 12 * Math.log2(sr / (lo + bk + off) / 440), ea]);
      }
      // the heard pitch of a note that wavers (vibrato, a section's beating, a pluck's glide): the energy-weighted mean of its clearly
      // periodic moments, the outer tenth at either end set aside
      if (v.length < 4) return null; v.sort((p, q) => p[0] - q[0]); if (oneShot) return v[v.length >> 1][0];   // a pluck or a strike: the median moment (energy would weight its attack)
      const k = Math.floor(v.length * 0.1), mid = v.slice(k, v.length - k);
      let sw = 0, sp = 0; for (const [p, e] of mid) { sw += e; sp += p * e; } return sp / sw;
    };
    const names = NAMES.length ? NAMES : Object.keys(S.inst);
    for (const n of names) {
      const inst = S.inst[n]; if (!inst || !inst.ready || !inst.pitched || NOPITCH.test(n)) continue;
      const rows = [];
      for (const z of inst.zones) {
        const b = z.buf, sr = b.sampleRate, d0 = b.getChannelData(0), d1 = b.numberOfChannels > 1 ? b.getChannelData(1) : null;
        const a = Math.round((z.loop ? z.loop[0] : Math.min(0.06, b.duration * 0.1)) * sr), e = Math.min(b.length, Math.round((z.loop ? z.loop[1] : Math.min(b.duration, 0.7)) * sr));
        const mono = new Float32Array(Math.max(0, e - a)); for (let i = a; i < e; i++) mono[i - a] = d1 ? 0.5 * (d0[i] + d1[i]) : d0[i];
        const pm = pitchMedian(mono, 0, mono.length, sr, Math.round(z.root), !z.loop);
        rows.push({ root: +z.root.toFixed(3), vel: z.vel.join('-'), rr: z.rr, looped: !!z.loop, cents: pm === null ? null : +((pm - z.root) * 100).toFixed(1), nominal: pm === null ? null : +((pm - Math.round(z.root)) * 100).toFixed(1) });
      }
      out[n] = rows;
    }
    return out;
  }, [NAMES, NOPITCH.source]);
  await browser.close(); srv.close();
  let bad = 0; const summary = {};
  for (const n of Object.keys(res).sort()) {
    const rows = res[n], m = rows.filter(r => r.cents !== null), abs = m.map(r => Math.abs(r.cents)).sort((p, q) => p - q), tol = ENSEMBLE.test(n) ? Math.max(TOL, ENS_TOL) : TOL, off = m.filter(r => Math.abs(r.cents) > tol);
    bad += off.length; summary[n] = { zones: rows.length, measured: m.length, median: abs.length ? abs[abs.length >> 1] : null, max: abs.length ? abs[abs.length - 1] : null, off: off.length };
    console.log(n.padEnd(15), String(rows.length).padStart(4), 'zones', String(m.length).padStart(4), 'measured  median', String(summary[n].median).padStart(5), 'c  max', String(summary[n].max).padStart(6), 'c', off.length ? '  past ' + tol + ' c: ' + off.map(r => r.root + (r.looped ? '' : '*') + ' ' + (r.cents > 0 ? '+' : '') + r.cents).join(', ') : '');
  }
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ tol: TOL, summary, zones: res }, null, 1));
  console.log(bad ? bad + ' zones past ' + TOL + ' cents' : 'every measured zone within ' + TOL + ' cents'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
