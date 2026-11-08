// The intake gate: every looped zone of an instrument, as the sampler will play it (decoded, its loop moved and tuned and blended),
// against one standard. Run it on any instrument before a piece uses it, and on the whole set an orchestral piece uses before a release.
//   node tools/qa/library.js vcSolo,choirHum,cellos-or-sample-names [--json FILE]      (sample-set names, as in instruments.json)
// Per zone:
//   tuning     the whole note's median pitch (autocorrelation within 6% of the root, every 50 ms through the loop) is within 12 cents
//              (15 for an ensemble: a section or a choir) of the root the sampler plays it from; a note too unsteady to measure is
//              reported, not failed
//   clearance  the loop ends at least 50 ms before the file does (the build fades a file's last 30 ms: a loop inside that fade sinks
//              at every wrap)
//   stereo     the two channels agree in the low mids (150-500 Hz over the loop, correlation 0.2 or more): opposed channels sound hollow
//              and phasey; such an instrument wants a width limit or the profile's mono low end
//   layers     at each root the louder layers are louder (the loop's level rises with the layer)
// Loop repetition (a level or tone cycle at the loop's length) is tools/qa/loops.js: run it as well on a solo instrument.
const { serve, open } = require('./lib');
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const NAMES = (argv.find(a => !a.startsWith('--') && !Object.values(opt).includes(a)) || '').split(',').filter(Boolean);
const ENSEMBLE = /^(str|vc|vla|vln|cb|horn(Sus)?$|tbnSus|tptSus|brass|lowBrass|chorus|choir(Hum|Ooh)|organ)/;
(async () => {
  const PORT = +process.env.PORT || 8872, srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html');
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Samples);
  const res = await page.evaluate(async ([NAMES, ENS]) => {
    const A = MOO.Audio, S = A.Samples; if (!A.ctx) A.init(); await S.preload(); const ensRe = new RegExp(ENS), out = {};
    const names = NAMES.length ? NAMES : Object.keys(S.inst);
    const pitchMedian = (d, a, b, sr, root) => {
      const f0 = 440 * Math.pow(2, (root - 69) / 12), P0 = sr / f0, lo = Math.floor(P0 / 1.06), hi = Math.ceil(P0 * 1.06) + 1, W = Math.round(Math.max(4 * hi, 0.05 * sr)), v = [];
      for (let s = a; s + W + hi < b; s += Math.round(0.05 * sr)) {
        let ea = 0; for (let i = 0; i < W; i++) ea += d[s + i] * d[s + i]; if (ea < 1e-9) continue;
        let best = -2, bk = 0; const cs = [];
        for (let P = lo; P <= hi; P++) { let xy = 0, yy = 0; for (let i = 0; i < W; i++) { const y = d[s + i + P]; xy += d[s + i] * y; yy += y * y; } const c = xy / Math.sqrt(ea * yy + 1e-15); cs.push(c); if (c > best) { best = c; bk = cs.length - 1; } }
        if (best < 0.7 || bk === 0 || bk === cs.length - 1) continue;
        const den = cs[bk - 1] - 2 * cs[bk] + cs[bk + 1], off = den < 0 ? 0.5 * (cs[bk - 1] - cs[bk + 1]) / den : 0;
        v.push(69 + 12 * Math.log2(sr / (lo + bk + off) / 440));
      }
      if (v.length < 5) return null; v.sort((p, q) => p - q); return v[v.length >> 1];
    };
    for (const n of names) {
      const inst = S.inst[n]; if (!inst || !inst.ready || !inst.loop) continue;
      const ens = ensRe.test(n), rows = [], byRoot = {};
      for (const z of inst.zones) {
        if (!z.loop) continue;
        const b = z.buf, sr = b.sampleRate, d0 = b.getChannelData(0), d1 = b.numberOfChannels > 1 ? b.getChannelData(1) : null, a = Math.round(z.loop[0] * sr), e = Math.min(b.length, Math.round(z.loop[1] * sr));
        const mono = new Float32Array(e - a); for (let i = a; i < e; i++) mono[i - a] = d1 ? 0.5 * (d0[i] + d1[i]) : d0[i];
        const pm = pitchMedian(mono, 0, mono.length, sr, Math.round(z.root)), cents = pm === null ? null : Math.round((pm - z.root) * 100);
        let corr = 1;
        if (d1) { const oc = new OfflineAudioContext(2, e - a, sr), bb = oc.createBuffer(2, e - a, sr); bb.copyToChannel(d0.slice(a, e), 0); bb.copyToChannel(d1.slice(a, e), 1); const src = oc.createBufferSource(); src.buffer = bb; let nn = src;
          for (const [t, f] of [['highpass', 150], ['highpass', 150], ['lowpass', 500], ['lowpass', 500]]) { const q = oc.createBiquadFilter(); q.type = t; q.frequency.value = f; nn.connect(q); nn = q; }
          nn.connect(oc.destination); src.start(); const y = await oc.startRendering(), L = y.getChannelData(0), R = y.getChannelData(1); let lr = 0, ll = 0, rr = 0; for (let i = Math.round(0.05 * sr); i < L.length; i++) { lr += L[i] * R[i]; ll += L[i] * L[i]; rr += R[i] * R[i]; } corr = lr / Math.sqrt(ll * rr + 1e-15); }
        let q = 0; for (let i = 0; i < mono.length; i++) q += mono[i] * mono[i]; const lvl = 10 * Math.log10(q / Math.max(1, mono.length) + 1e-15) + 20 * Math.log10(z.gain || 1);
        const clear = b.duration - z.loop[1];
        const row = { root: +z.root.toFixed(2), vel: z.vel.join('-'), cents, clear: +clear.toFixed(3), corr: +corr.toFixed(2), lvl: +lvl.toFixed(1), fails: [] };
        if (cents !== null && Math.abs(cents) > (ens ? 15 : 12)) row.fails.push('tuning ' + (cents > 0 ? '+' : '') + cents + ' c');
        if (clear < 0.05) row.fails.push('loop ' + Math.round(clear * 1000) + ' ms from the end');
        if (corr < 0.2) row.fails.push('stereo ' + corr.toFixed(2));
        rows.push(row); (byRoot[Math.round(z.root)] = byRoot[Math.round(z.root)] || []).push(row);
      }
      for (const r in byRoot) { const L = byRoot[r].slice().sort((p, q) => parseFloat(p.vel) - parseFloat(q.vel)); for (let i = 1; i < L.length; i++) if (L[i].lvl < L[i - 1].lvl - 1) L[i].fails.push('layer quieter than the one below by ' + (L[i - 1].lvl - L[i].lvl).toFixed(1) + ' dB'); }
      out[n] = { ensemble: ens, zones: rows.length, unmeasured: rows.filter(r => r.cents === null).length, rows };
    }
    return out;
  }, [NAMES, ENSEMBLE.source]);
  await browser.close(); srv.close();
  let bad = 0; const NM = m => 'C C# D Eb E F F# G Ab A Bb B'.split(' ')[Math.round(m) % 12] + (Math.floor(Math.round(m) / 12) - 1);
  for (const n in res) {
    const r = res[n], f = r.rows.filter(x => x.fails.length); bad += f.length;
    console.log((f.length ? 'FAIL ' : 'pass ') + n.padEnd(14) + String(r.zones).padStart(4) + ' zones' + (r.ensemble ? ' (ensemble)' : '') + (f.length ? ', ' + f.length + ' failing' : '') + (r.unmeasured ? ', ' + r.unmeasured + ' too unsteady to tune-check' : ''));
    for (const x of f.slice(0, 6)) console.log('       ' + NM(x.root).padEnd(4) + ' ' + x.vel.padEnd(10) + ' ' + x.fails.join('; '));
  }
  if (opt.json) require('fs').writeFileSync(opt.json, JSON.stringify(res, null, 1));
  console.log(bad ? '\n' + bad + ' zone(s) fail the intake standard' : '\nevery zone passes the intake standard');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
