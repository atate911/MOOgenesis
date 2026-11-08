// the refresh sweep: each piece's sound measured over its first 100 s (after its first 8): the spectrum's balance (the share of six
// bands, dB), how clearly its melody stands over the accompaniment (lead and bells against the rest, 250 Hz-4 kHz), the choir against
// the strings (the same band), and its level (RMS, dB).   node sweep.js id1,id2,... [PORT] [JSONFILE|-] [PATCHFILE]
const { serve, open } = require('../qa/lib'); const fs = require('fs');
const IDS = process.argv[2].split(','), PORT = +process.argv[3] || 8894, JSONF = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : null;
const PATCH = process.argv[5] ? JSON.parse(fs.readFileSync(process.argv[5], 'utf8')) : {};   // optional: { id: refresh entry } tried before measuring (as js/audio/score/refresh.js would apply it)
(async () => { const srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html'); await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const out = {};
  for (const id of IDS) {
    out[id] = await page.evaluate(async ([id, patch]) => { const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload(); if (patch) M._applyRefresh(M._tracks[id], JSON.parse(JSON.stringify(patch))); const T0 = 8, T1 = 108;
      const band = async (b, lo, hi) => { const oc = new OfflineAudioContext(1, b.length, b.sampleRate), s = oc.createBufferSource(); s.buffer = b; let m = s; for (const [t, f] of [['highpass', lo], ['highpass', lo], ['lowpass', hi], ['lowpass', hi]]) { if (!f) continue; const q = oc.createBiquadFilter(); q.type = t; q.frequency.value = f; m.connect(q); m = q; } m.connect(oc.destination); s.start(); const y = (await oc.startRendering()).getChannelData(0); let q = 0; const a = Math.round(T0 * b.sampleRate), e = Math.min(y.length, Math.round(T1 * b.sampleRate)); for (let i = a; i < e; i++) q += y[i] * y[i]; return 10 * Math.log10(q / Math.max(1, e - a) + 1e-15); };
      const r = o => M.renderOffline(id, T1 + 1, Object.assign({ sampleRate: 32000, loop: true, seed: 1 }, o));
      const mix = await r({}), all = await band(mix, 20, 15000), res = { lvl: +all.toFixed(1), bands: [] };
      for (const [lo, hi] of [[25, 50], [50, 120], [120, 400], [400, 2000], [2000, 5000], [5000, 12000]]) res.bands.push(+((await band(mix, lo, hi)) - all).toFixed(1));
      const ev = M._compile(id, 0).events, has = l => ev.some(e => e.ly === l && e.m);
      if (has('lead') || has('bell')) { const mel = await r({ only: ['lead', 'bell'] }), rest = await r({ only: ['pad', 'choir', 'bass', 'arp', 'drums'] }); res.tune = +((await band(mel, 250, 4000)) - (await band(rest, 250, 4000))).toFixed(1); }
      if (has('choir') && has('pad')) { const ch = await r({ only: ['choir'] }), pd = await r({ only: ['pad'] }); res.choir = +((await band(ch, 250, 4000)) - (await band(pd, 250, 4000))).toFixed(1); }
      return res; }, [id, PATCH[id] || null]);
    const x = out[id]; console.log(id.padEnd(16), 'lvl', String(x.lvl).padStart(6), ' sub/low/lowmid/mid/pres/air', x.bands.map(v => String(v).padStart(6)).join(''), ' tune', x.tune === undefined ? '   -' : String(x.tune).padStart(5), ' choir', x.choir === undefined ? '   -' : String(x.choir).padStart(5));
  }
  if (JSONF) fs.writeFileSync(JSONF, JSON.stringify(out, null, 1));
  await browser.close(); srv.close(); })().catch(e => { console.error(e); process.exit(1); });
