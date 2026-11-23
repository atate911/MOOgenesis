// Balance a piece of the symphonic score by measurement: for every section where a tune sounds, each layer's share of the whole is
// measured (a window from the middle of the section, each bus rendered alone and with everything) and any layer over its ceiling is
// brought down to it — the accompaniment under the tune, never the tune up. Ceilings (dB under the whole): figures (arp) 10, beds (pad)
// 5, the bass line 6, the voices 4, the percussion 8. The gains go into js/audio/score/symphonic.js's BAL table (with --write), where
// the piece's sections take them as their mixK; run it again to check (it multiplies onto what is there).
//   node tools/concert/balance.js galaxy17 [--write] [--secs 8] [--port 8860]
const fs = require('fs'), path = require('path');
const { serve, open } = require('../qa/lib');
const args = process.argv.slice(2), opt = {}; const ids = [];
for (let i = 0; i < args.length; i++) { if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true; else ids.push(args[i]); }
const CEIL = { arp: -10, pad: -5, bass: -6, choir: -4, drums: -8 };
const FILE = path.join(__dirname, '..', '..', 'js', 'audio', 'score', 'symphonic.js');
(async () => {
  const PORT = +opt.port || 8860, srv = await serve(PORT), { browser, page, errors } = await open();
  await page.goto(`http://localhost:${PORT}/tools/test-audio.html`);
  await page.waitForFunction(() => window.MOO && MOO.Audio && MOO.Audio.Music);
  if (errors.some(e => /pageerror/.test(e))) { console.log('PAGE ERRORS:\n  ' + errors.join('\n  ')); process.exit(1); }
  for (const id of ids) {
    const res = await page.evaluate(async ([id, secs, CEIL]) => {
      await MOO.Audio.Samples.preload();
      const M = MOO.Audio.Music, D = M._tracks[id]; if (D.forms && D.forms.length > 1) { D.forms = [D.forms[0]]; D._p = null; }
      const c = M._compile(id, 0), SR = 24000, lv = x => { let s = 0; for (const v of x) s += v * v; return 10 * Math.log10(s / x.length + 1e-15); }, out = {};
      for (const w of c.wraps) {
        if (w.len < 4 || out[w.R.n] || /^breath/.test(w.R.n)) continue;   // a breath between sections is its bed alone
        const from = w.t0 + Math.max(0, (w.len - secs) / 2), len = Math.min(secs, w.len);
        const pre = Math.max(6, from - w.t0 + 0.5);   // from the section's start: a chord held across its bars sounds in the window (a render skips notes begun before it)
        const r = o => M.renderOffline(id, len + pre, { from: Math.max(0, from - pre), loop: false, sampleRate: SR, only: o }).then(b => b.getChannelData(0).subarray(Math.round(Math.min(pre, from) * SR)));
        const tune = c.events.some(e => e.m && (e.ly === 'lead' || e.k === 'lead') && e.t >= from && e.t < from + len);   // the tune is playing in the window (not only a tail ringing into it)
        const all = lv(await r()); if (all < -70 || !tune) { out[w.R.n] = { silent: true }; continue; }   // a window with nothing starting in it (a chord held from before it): no reading
        const mel = lv(await r(['lead'])) - all, row = { mel: +mel.toFixed(1) };
        for (const k of Object.keys(CEIL)) row[k] = +(lv(await r([k])) - all).toFixed(1);
        row.mk = (D.sec.find(x => x.n === w.R.n) || {}).mixK || {};
        out[w.R.n] = row;
      }
      return out;
    }, [id, +opt.secs || 8, CEIL]);
    const bal = {};
    console.log(`\n== ${id}`);
    for (const [sec, row] of Object.entries(res)) {
      if (row.silent) { console.log(`  ${sec.padEnd(10)} (no tune in the window, or nothing starts in it)`); continue; }
      const fix = {};
      if (row.mel > -30) for (const k of Object.keys(CEIL)) {
        if (row[k] > CEIL[k] && row[k] > -40) fix[k] = +Math.pow(10, (CEIL[k] - row[k]) / 20).toFixed(2);
        else if (row[k] > -40 && row[k] < CEIL[k] - 1.5 && (row.mk[k] || 1) < 0.97) fix[k] = +Math.min(Math.pow(10, (CEIL[k] - 0.5 - row[k]) / 20), Math.sqrt(1 / row.mk[k])).toFixed(2);   // turned down further than it needs (raised toward its ceiling, never over its written level; the gain is squared when applied)
      }
      console.log(`  ${sec.padEnd(10)} melody ${String(row.mel).padStart(6)}  ` + Object.keys(CEIL).map(k => `${k} ${row[k] < -90 ? '  -' : String(row[k]).padStart(5)}`).join('  ') + (Object.keys(fix).length ? '   -> ' + JSON.stringify(fix) : ''));
      if (Object.keys(fix).length) bal[sec] = fix;
    }
    if (opt.write && Object.keys(bal).length) {
      let s = fs.readFileSync(FILE, 'utf8');
      const m = /  const BAL = \{\n([\s\S]*?)  \};/.exec(s); if (!m) throw new Error('no BAL table');
      const table = {}; for (const line of m[1].split('\n')) { const mm = /^    '?([\w:]+)'?: (\{.*\}),?$/.exec(line); if (mm) table[mm[1]] = JSON.parse(mm[2].replace(/(\w+):/g, '"$1":').replace(/'/g, '"')); }
      const cur = table[id] || {};
      for (const [sec, f] of Object.entries(bal)) { cur[sec] = cur[sec] || {}; for (const [k, g] of Object.entries(f)) cur[sec][k] = +Math.min(1, Math.max(0.03, (cur[sec][k] || 1) * g * g)).toFixed(3); }
      table[id] = cur;
      const body = Object.entries(table).map(([k, v]) => `    '${k}': ${JSON.stringify(v).replace(/"(\w+)":/g, '$1: ')},`).join('\n');
      s = s.replace(m[0], '  const BAL = {\n' + body + '\n  };');
      fs.writeFileSync(FILE, s);
      console.log('  written to the BAL table');
    }
  }
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
