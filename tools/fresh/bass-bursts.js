// one held note per bass voice (24 s, the step's bass path), its bursts inside the hold (3 dB over the surrounding 0.4 s median, 10 ms),
// in 150-1500 Hz (the overtones that carry a bass) and 40-150 Hz (its fundamental), from 4 s on
const { serve, open } = require('/home/user/MOOgenesis/tools/qa/lib');
const INSTS = (process.argv[2] || 'deep').split(','), MS = (process.argv[3] || '38').split(',').map(Number), PORT = +process.argv[4] || 8894;
(async () => { const srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html'); await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const res = await page.evaluate(async ([INSTS, MS]) => { const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload(); const out = [];
    const PC = 'C C# D Eb E F F# G Ab A Bb B'.split(' ');
    for (const inst of INSTS) for (const m of MS) {
      const id = 'bb:' + inst + ':' + m;
      M._define(id, { bpm: 60, root: PC[m % 12], mode: 'major', bassC: m, hidden: true, tens: false, trim: 1, rubato: 0, orch: true, holdLow: false, loopFrom: 'A', inst: { bass: inst },
        sec: [{ n: 'A', bars: 6, lv: 0.85, prog: 'I:24', bass: { pat: '1---', inst: { p: inst, att: 1.0, rel: 1.5 } }, timp: false, drums: false }] });
      M._dbg = { noExpr: true, noPerform: true }; const buf = await M.renderOffline(id, 24, { sampleRate: 44100, loop: false, only: ['bass'] }); M._dbg = {};
      const scan = async (hp, lp) => { const oc = new OfflineAudioContext(1, buf.length, buf.sampleRate), src = oc.createBufferSource(); src.buffer = buf; let n = src; for (let k = 0; k < 2; k++) { const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; n.connect(h); n = h; const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; n.connect(l); n = l; } n.connect(oc.destination); src.start(); const x = (await oc.startRendering()).getChannelData(0), W = 441, e = [];
        for (let s = 0; s + W <= x.length; s += W) { let q = 0; for (let i = s; i < s + W; i++) q += x[i] * x[i]; e.push(10 * Math.log10(q / W + 1e-14)); }
        let n3 = 0, n6 = 0, mx = 0; const R = 20; for (let i = 400; i < e.length - R - 10; i++) { const nb = e.slice(i - R, i - 2).concat(e.slice(i + 3, i + R)).sort((p, q) => p - q), d = e[i] - nb[nb.length >> 1]; if (d > 3 && e[i] >= e[i - 1] && e[i] >= e[i + 1]) { n3++; if (d > 6) n6++; mx = Math.max(mx, d); } }
        const lvl = e.slice(400, e.length - 30).reduce((p, q) => p + q, 0) / (e.length - 430); return { n3, n6, mx: +mx.toFixed(1), lvl: +lvl.toFixed(1) }; };
      out.push({ inst, m, over: await scan(150, 1500), fund: await scan(40, 150) });
    }
    return out; }, [INSTS, MS]);
  const NM = n => 'C C# D Eb E F F# G Ab A Bb B'.split(' ')[n % 12] + (Math.floor(n / 12) - 1);
  console.log('voice       note   150-1500 Hz: bursts >3 dB / >6 dB / worst  level  |  40-150 Hz: >3 dB / worst  level   (per 20 s)');
  for (const r of res) console.log(r.inst.padEnd(11), NM(r.m).padEnd(5), String(r.over.n3).padStart(14), String(r.over.n6).padStart(7), String(r.over.mx).padStart(7), String(r.over.lvl).padStart(7), '  |', String(r.fund.n3).padStart(9), String(r.fund.mx).padStart(7), String(r.fund.lvl).padStart(7));
  await browser.close(); srv.close(); })().catch(e => { console.error(e); process.exit(1); });
