// each part of a step rendered alone; every sudden burst inside its held notes (5 ms energy over the surrounding 300 ms median), in two
// bands (the whole sound, and above 1 kHz where a bow's scrape or a pluck shows), with the notes sounding at that moment
//   node transients.js STEP.js ID [PORT]
const path = require('path'); const { serve, open } = require('/home/user/MOOgenesis/tools/qa/lib');
const DEFS = require(path.resolve(process.argv[2])), ID = process.argv[3], PORT = +process.argv[4] || 8894;
(async () => { const srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html'); await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const o = await page.evaluate(async ([id, def]) => { const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload(); M._define(id, JSON.parse(JSON.stringify(def)));
    const r = M._compile(id, 0), out = {};
    const keyOf = { bass: 'bass', pad: 'pad', pad2: 'pad' };
    for (const key of ['bass', 'pad2', 'pad']) {
      const d = M._tracks[id], keep = d.sec.map(s => ({ pad: s.pad, pad2: s.pad2, bass: s.bass }));
      d.sec.forEach(s => { for (const k of ['bass', 'pad', 'pad2']) if (k !== key) s[k] = false; }); d._p = null;
      const buf = await M.renderOffline(id, 50, { sampleRate: 44100, loop: false, seed: 1, only: [keyOf[key]] });
      const notes = M._compile(id, 0).events.filter(e => e.m && e.o && e.k === key).map(e => ({ t: e.t, end: e.t + e.o.dur, m: e.m, smp: e.o.smp }));
      d.sec.forEach((s, i) => Object.assign(s, keep[i])); d._p = null;
      const scan = async (hp, lp, TH) => { const oc = new OfflineAudioContext(1, buf.length, buf.sampleRate), src = oc.createBufferSource(); src.buffer = buf; let n = src; for (let k = 0; k < 2; k++) { if (hp) { const h = oc.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; n.connect(h); n = h; } if (lp) { const l = oc.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp; n.connect(l); n = l; } } n.connect(oc.destination); src.start(); const x = (await oc.startRendering()).getChannelData(0), W = 441, e = [];
        for (let s = 0; s + W <= x.length; s += W) { let q = 0; for (let i = s; i < s + W; i++) q += x[i] * x[i]; e.push(10 * Math.log10(q / W + 1e-14)); }
        const hits = []; const R = 20; for (let i = R; i < e.length - R; i++) { const nb = e.slice(i - R, i - 2).concat(e.slice(i + 3, i + R)).sort((p, q) => p - q), med = nb[nb.length >> 1]; if (e[i] > med + TH && e[i] > -80 && e[i] >= e[i - 1] && e[i] >= e[i + 1]) hits.push([+(i * W / 44100).toFixed(3), +(e[i] - med).toFixed(1)]); }
        return hits; };
      const near = t => notes.some(n => Math.abs(n.t - t) < 0.6 || Math.abs(n.end - t) < 0.6);
      const label = t => notes.filter(n => n.t <= t && n.end >= t).map(n => n.m + '+' + (t - n.t).toFixed(2) + 's').join(',');
      const full = (await scan(0, 0, 3)).filter(h => h[0] > 3 && !near(h[0])), hi = (await scan(150, 1500, 3)).filter(h => h[0] > 3 && !near(h[0])), top = (await scan(1500, 0, 3)).filter(h => h[0] > 3 && !near(h[0]));
      out[key] = { notes: notes.map(n => [+n.t.toFixed(1), n.m, n.smp]), full: full.map(h => h.concat(label(h[0]))), hi: hi.map(h => h.concat(label(h[0]))), top: top.map(h => h.concat(label(h[0]))) };
    }
    return out; }, [ID, DEFS[ID]]);
  for (const k in o) { console.log('== ' + k + '  notes: ' + JSON.stringify(o[k].notes)); console.log('  bursts, whole sound: ' + o[k].full.length + ' ' + JSON.stringify(o[k].full.slice(0, 12))); console.log('  bursts 150-1500 Hz: ' + o[k].hi.length + ' ' + JSON.stringify(o[k].hi.slice(0, 14))); console.log('  bursts above 1.5 kHz: ' + o[k].top.length + ' ' + JSON.stringify(o[k].top.slice(0, 14))); }
  await browser.close(); srv.close(); })().catch(e => { console.error(e); process.exit(1); });
