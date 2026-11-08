// how clearly the tune comes through in a stretch of a step: the melodic parts (lead, bell: the solo, the horns' line, the trumpet)
// against everything else, at 250 Hz-4 kHz, and how crowded the low mids are (the 150-400 Hz share of 100 Hz-8 kHz), in a window
//   node clarity.js STEP.js ID T0 T1 [PORT]
const path = require('path'); const { serve, open } = require('../qa/lib');
const DEFS = require(path.resolve(process.argv[2])), ID = process.argv[3], T0 = +process.argv[4], T1 = +process.argv[5], PORT = +process.argv[6] || 8894;
(async () => { const srv = await serve(PORT); const { browser, page } = await open();
  await page.goto('http://localhost:' + PORT + '/tools/test-audio.html'); await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  const o = await page.evaluate(async ([id, def, T0, T1]) => { const A = MOO.Audio, M = A.Music, S = A.Samples; await S.preload(); M._define(id, JSON.parse(JSON.stringify(def)));
    const lv = async (b, lo, hi) => { const oc = new OfflineAudioContext(1, b.length, b.sampleRate), s = oc.createBufferSource(); s.buffer = b; let m = s; for (const [t, f] of [['highpass', lo], ['highpass', lo], ['lowpass', hi], ['lowpass', hi]]) { const q = oc.createBiquadFilter(); q.type = t; q.frequency.value = f; m.connect(q); m = q; } m.connect(oc.destination); s.start(); const y = (await oc.startRendering()).getChannelData(0); let q = 0; const a = Math.round(T0 * b.sampleRate), e = Math.round(T1 * b.sampleRate); for (let i = a; i < e; i++) q += y[i] * y[i]; return 10 * Math.log10(q / (e - a) + 1e-15); };
    const r = o => M.renderOffline(id, T1 + 1, Object.assign({ sampleRate: 22050, loop: false, seed: 1 }, o));
    const mel = await r({ only: ['lead', 'bell'] }), rest = await r({ only: ['pad', 'choir', 'bass', 'arp', 'drums'] }), mix = await r({});
    return { tune: +((await lv(mel, 250, 4000)) - (await lv(rest, 250, 4000))).toFixed(1), lowmid: +((await lv(mix, 150, 400)) - (await lv(mix, 100, 8000))).toFixed(1) }; }, [ID, DEFS[ID], T0, T1]);
  console.log(ID, T0 + '-' + T1 + ' s: the tune ' + o.tune + ' dB against the rest (250 Hz-4 kHz); the low mids (150-400 Hz) ' + o.lowmid + ' dB of the whole');
  await browser.close(); srv.close(); })().catch(e => { console.error(e); process.exit(1); });
