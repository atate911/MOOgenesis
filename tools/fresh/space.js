// The space in each piece, section by section, from its notes (pass 0 as refreshed; tools/fresh/README.md, "space"), and the refresh's
// `space` entries that open it:   node tools/fresh/space.js [SINGJSON] > space.json
//  A (the low mids): three or more sustained parts (beds, choirs) each sounding 1.5+ notes on average in A2-C4: the bed (not a choir)
//    reaching highest is voiced above middle C, unless the melody lives there (then it steps back, velK 0.75).
//  B (the melody's room): a bed or a chordal choir with 1+ notes on average within 4 semitones of the melody: voiced under it (its chord
//    notes drawn from the octave and a half below the melody's lowest note), unless that would put it into the low mids (it steps back,
//    velK 0.7), else above it (a halo, as high strings over a brass tune; not a choir), else it steps back. The melody's own harmony line and its second line are orchestration, and stay.
//  C (the choir's tune): where the choir sings the melody (sing), its own chordal part on the same notes steps back (velK 0.6).
//  D (the choir leading): where a choir carries the melody (its own line or the sung tune), a bed on its notes is voiced above it, or
//    steps back; a chordal choir on them steps back (velK 0.6).
const fs = require('fs'), vm = require('vm'), path = require('path'); const ROOT = path.resolve(__dirname, '../..');
const ctx = vm.createContext({ console, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '' } }); ctx.window = ctx; ctx.globalThis = ctx;
const mctx = vm.createContext({}); mctx.window = mctx; vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/manifest.js'), 'utf8'), mctx);
for (const f of ['js/core/ns.js'].concat(mctx.MOO_MANIFEST.js.filter(f => /^js\/audio\/(audio|sampler|music)\.js$|^js\/audio\/score\//.test(f)))) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const M = ctx.MOO.Audio.Music, T = M._tracks, SING = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2])) : {};
const BEDS = /^(pad|pad2|pad3|choir|choir2)$/, CHOIR = /^choir/;
const out = {}, log = [];
for (const id of Object.keys(M._refresh)) {
  const d = T[id]; if (SING[id]) M._applyRefresh(d, { sing: SING[id] });
  const r = M._compile(id, 0), ev = r.events.filter(e => e.m && e.o && e.o.dur && !/^(drums|perc|timp|fx|_fx)$/.test(e.ly));
  for (const e of ev) e.part = e.k || e.ly;
  const sung = new Set(SING[id] ? SING[id].sections : []);
  const bySec = {};
  for (const w of r.wraps) { const n = w.R.raw && w.R.raw.n; if (!n || bySec[n]) continue; const t0 = r.beatsT[w.start], t1 = r.beatsT[Math.min(r.beatsT.length - 1, w.start + w.beats)]; bySec[n] = [t0, t1]; }
  for (const n in bySec) {
    const [t0, t1] = bySec[n], P = {}; let k = 0, leadLo = 999, leadHi = 0, cLo = 999, cHi = 0;
    for (let t = t0; t < t1; t += 0.25) { k++;
      const now = ev.filter(e => e.t <= t && e.t + e.o.dur > t), lead = now.filter(e => e.part === 'lead'), sl = now.filter(e => e.part === 'lead3'), cl = now.filter(e => /^lead/.test(e.part) && /^(chorus|choir)/.test(e.o.smp || ''));
      for (const L of lead) { leadLo = Math.min(leadLo, L.m); leadHi = Math.max(leadHi, L.m); } for (const L of cl) { cLo = Math.min(cLo, L.m); cHi = Math.max(cHi, L.m); }
      for (const e of now) { if (!BEDS.test(e.part)) continue; const p = P[e.part] = P[e.part] || { mud: 0, nl: 0, ns: 0, nc: 0, lo: 999, hi: 0 };
        p.lo = Math.min(p.lo, e.m); p.hi = Math.max(p.hi, e.m); if (!p.range) p.range = e.o.range || [0, 127]; if (e.m >= 45 && e.m <= 60) p.mud++;
        for (const L of lead) if (Math.abs(L.m - e.m) <= 4) p.nl++; for (const L of sl) if (Math.abs(L.m - e.m) <= 4) p.ns++; for (const L of cl) if (Math.abs(L.m - e.m) <= 4) p.nc++; } }
    for (const p of Object.values(P)) { p.mud /= k; p.nl /= k; p.ns /= k; p.nc /= k; }
    const fits = (ly, reg) => { const r = P[ly].range; return reg[0] >= r[0] && reg[1] <= r[1]; };   // the instrument can play there
    const set = (ly, c, why) => { ((out[id] = out[id] || {})[n] = out[id][n] || {})[ly] = Object.assign(out[id][n][ly] || {}, c); log.push(id + ' ' + n + ' ' + ly + ': ' + why + ' -> ' + JSON.stringify(c)); };
    // A
    const thick = Object.entries(P).filter(([, p]) => p.mud >= 1.5);
    if (thick.length >= 3) { const beds = thick.filter(([ly]) => !CHOIR.test(ly)).sort((a, b) => b[1].hi - a[1].hi || b[1].lo - a[1].lo);
      if (beds.length) { const [ly, p] = beds[0];
        if (leadLo <= 74 && leadHi >= 60) set(ly, { velK: 0.75 }, 'low mids thick (' + thick.length + ' parts), the melody above middle C');
        else if (fits(ly, [60, Math.max(76, p.hi)])) set(ly, { reg: [60, Math.max(76, p.hi)] }, 'low mids thick (' + thick.length + ' parts)');
        else set(ly, { velK: 0.75 }, 'low mids thick (' + thick.length + ' parts), it cannot play higher'); } }
    // B
    if (leadLo < 999) for (const [ly, p] of Object.entries(P)) { if (p.nl < 1) continue; if (out[id] && out[id][n] && out[id][n][ly]) continue;
      const hi = leadLo - 1, lo = Math.max(48, hi - 18);
      const up = leadHi + 2;   // or above it, as high strings hold a halo over a brass tune
      if (hi - lo >= 9 && lo >= 52 && fits(ly, [lo, hi])) set(ly, { reg: [lo, hi] }, 'on the melody (' + p.nl.toFixed(1) + ' notes near it): under it');
      else if (!CHOIR.test(ly) && up + 12 <= 88 && fits(ly, [up, Math.min(88, up + 14)])) set(ly, { reg: [up, Math.min(88, up + 14)] }, 'on the melody (' + p.nl.toFixed(1) + '): above it');
      else set(ly, { velK: 0.7 }, 'on the melody (' + p.nl.toFixed(1) + '), no room under or above it'); }
    // C
    if (sung.has(n)) for (const [ly, p] of Object.entries(P)) if (CHOIR.test(ly) && p.ns >= 1) set(ly, { velK: 0.6 }, 'on the sung tune (' + p.ns.toFixed(1) + ')');
    // D: where the choir carries the melody (its own line, or the sung tune), the beds give it room as they do an instrument's
    if (cLo < 999) for (const [ly, p] of Object.entries(P)) { if (p.nc < 1) continue; const had = out[id] && out[id][n] && out[id][n][ly]; if (had && had.reg) continue;
      if (CHOIR.test(ly)) { if (!had) set(ly, { velK: 0.6 }, 'on the choir\'s melody (' + p.nc.toFixed(1) + ')'); continue; }
      const up = cHi + 2;
      if (up + 12 <= 88 && fits(ly, [up, Math.min(88, up + 14)])) set(ly, { reg: [up, Math.min(88, up + 14)], velK: undefined }, 'on the choir\'s melody (' + p.nc.toFixed(1) + '): above it');
      else if (!had) set(ly, { velK: 0.7 }, 'on the choir\'s melody (' + p.nc.toFixed(1) + '), no room above it'); }
  }
}
console.error(log.join('\n')); console.error(log.length + ' changes in ' + Object.keys(out).length + ' pieces');
console.log(JSON.stringify(out, null, 1));
