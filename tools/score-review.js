// An objective review card for every piece of the score (node tools/score-review.js [--json FILE] [ids...]): compiled in node, no audio.
// Per piece: length and form; the dynamic arc (section levels, climax, ending); the harmonic vocabulary and rhythm; the melody (strong-beat
// chord tones, leaps, how often the engine had to snap a written note onto the chord); notes outside the real instrument's range (the
// sampler will play them, a player could not); texture (polyphony, low-register mud); the loop seam (the chord the pass ends on into the
// chord it restarts on); the palette. Hidden pieces are included (war readings, interludes, bridges), the derived interludes are not.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '' }, document: { hidden: false, addEventListener() {} }, window: null, Math, JSON, WeakMap });
ctx.window = ctx;
for (const f of ['js/core/ns.js', 'js/audio/audio.js', 'js/audio/sampler.js', 'js/audio/music.js', 'js/audio/score/themes.js', 'js/audio/score/cues.js', 'js/audio/score/map.js', 'js/audio/score/races.js', 'js/audio/score/programme.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const M = ctx.MOO.Audio.Music, T = M._tracks, CO = M._colour, R = M._rotation;
// the sounding range of each recorded instrument (MIDI; C4 = 60): what a real section or player can give
const RANGE = { strEns: [28, 100], strEnsTrem: [28, 100], vln1Trem: [55, 100], vlaSus: [48, 88], vcSus: [36, 84], vcTrem: [36, 84], cbSus: [28, 55], cbPizz: [28, 55], subBass: [24, 55],
  strEnsPizz: [28, 96], strEnsSpic: [28, 96], harp: [24, 103], marimba: [36, 96], celeste: [60, 108], glock: [79, 108], crotales: [84, 108], chimes: [60, 79],
  hornSus: [41, 81], hornSolo: [41, 81], brassEns: [40, 84], brassStac: [40, 84], tptSus: [52, 84], tptSolo: [52, 84], lowBrass: [28, 65], tbnSus: [40, 72], tubaSus: [26, 65],
  flute: [60, 96], fluteSus: [60, 96], altoFlute: [55, 91], oboe: [58, 91], corAnglais: [52, 81], clarinet: [50, 91], bassoon: [34, 77],
  chorus: [40, 81], chorusMen: [40, 69], chorusWomen: [53, 81] };
const args = process.argv.slice(2), jsonAt = args.indexOf('--json') >= 0 ? args[args.indexOf('--json') + 1] : null;
const want = args.filter((a, i) => a !== '--json' && args[i - 1] !== '--json');
const ids = Object.keys(T).filter(id => !/^drift\d*:|^bridge:[a-z]+:/.test(id)).filter(id => !want.length || want.indexOf(id) >= 0);
const r2 = x => Math.round(x * 100) / 100, note = m => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][m % 12] + (Math.floor(m / 12) - 1);
const out = [];
for (const id of ids) {
  const def = T[id]; let a, r0, r1;
  try { a = M.analyze(id); r0 = M._compile(id, 0); r1 = M._compile(id, 1); } catch (e) { out.push({ id, error: String(e.message || e) }); continue; }
  const evs = r0.events.filter(e => e.ly !== 'drums');
  // range: notes a real player could not give, weighted by their length
  const outside = {}; let outBeats = 0, allBeats = 0;
  for (const e of evs) { if (!e.m || !e.o || !e.o.smp) continue; const rg = RANGE[e.o.smp]; if (!rg) continue; allBeats += e.bt; if (e.m < rg[0] || e.m > rg[1]) { outBeats += e.bt; const o = outside[e.o.smp] = outside[e.o.smp] || { beats: 0, lo: 999, hi: 0, keys: {} }; o.beats += e.bt; o.lo = Math.min(o.lo, e.m); o.hi = Math.max(o.hi, e.m); o.keys[e.k] = (o.keys[e.k] || 0) + 1; } }
  // texture: polyphony at every beat, and the low-interval limit (a second or a third sounding below C3)
  let maxPoly = 0, sumPoly = 0, mud = 0, n = 0;
  for (let b = 0; b < r0.beats; b++) { const on = evs.filter(e => e.m && e.b <= b + 1e-6 && e.b + e.bt > b + 1e-6); maxPoly = Math.max(maxPoly, on.length); sumPoly += on.length; const low = [...new Set(on.filter(e => e.m < 48).map(e => e.m))].sort((x, y) => x - y); let close = false; for (let i = 0; i < low.length && !close; i++) for (let j = i + 1; j < low.length; j++) { const d = low[j] - low[i]; if (d > 0 && d <= 4) { close = true; break; } } if (close) mud++; n++; }   // the low-interval limit: a second or a third below C3 is mud
  // the arc, the harmony, the seam
  const arc = r0.wraps.map(w => ({ n: w.R.n, lv0: r2(w.R.lv0), lv1: r2(w.R.lv1), bars: w.bars })), levels = arc.map(x => Math.max(x.lv0, x.lv1));
  const climax = Math.max(...levels), climaxAt = levels.indexOf(climax) / Math.max(1, levels.length - 1);
  const chords = new Set(), changes = []; for (const w of r0.wraps) { let last = null; for (const sg of w.R.segs) { chords.add(sg.ch.sym); if (sg.ch.sym !== last) changes.push(1); last = sg.ch.sym; } }
  const lastW = r1.wraps[r1.wraps.length - 1], firstW = r1.wraps[0], seam = lastW.R.segs[lastW.R.segs.length - 1].ch.sym + ' > ' + firstW.R.segs[0].ch.sym;
  const layers = new Set(); for (const s of def.sec) for (const k of ['pad', 'pad2', 'bass', 'arp', 'arp2', 'drums', 'perc', 'timp', 'lead', 'lead2', 'bell', 'bell2', 'choir', 'choir2']) if (s[k]) layers.add(k);
  const pal = CO.palette(def), ptot = Object.values(pal).reduce((x, y) => x + y, 0) || 1, palette = Object.entries(pal).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(100 * v / ptot)).join(', ');
  out.push({ id, hidden: !!def.hidden, desc: String(def.desc).split(/ — |: /)[0], key: def.root + ' ' + (def.mode || 'major'), bpm: def.bpm, meter: def.meter || 4,
    loopSec: Math.round(r1.len), firstSec: Math.round(r0.len), sections: def.sec.length, forms: (def.forms || []).length, alts: (def.alts || []).length, phrases: Object.keys(def.ph || {}).length,
    arc, climax, climaxAt: r2(climaxAt), ending: arc[arc.length - 1].lv1, range: r2(climax - Math.min(...levels)),
    chords: chords.size, chordsPerMin: r2(changes.length / (r0.len / 60)), seam,
    lead: a.lead, snaps: a.snaps, snapRate: a.lead.notes ? r2(a.snaps / a.lead.notes) : 0, variation: a.variation, eventsPerSec: a.eventsPerSec,
    outsidePct: allBeats ? r2(100 * outBeats / allBeats) : 0, outside: Object.entries(outside).map(([k, o]) => k + ' ' + note(o.lo) + '..' + note(o.hi) + ' (' + Object.keys(o.keys).join('/') + ', ' + r2(o.beats) + ' beats)').join('; '),
    maxPoly, meanPoly: r2(sumPoly / Math.max(1, n)), mudPct: r2(100 * mud / Math.max(1, n)), layers: [...layers].join(' '), palette, warnings: a.warnings });
}
if (jsonAt) fs.writeFileSync(jsonAt, JSON.stringify(out, null, 1));
const pad = (s, w, r) => { s = String(s); return r ? s.padStart(w) : s.padEnd(w); };
console.log(pad('piece', 16) + pad('key', 13) + pad('bpm', 5, 1) + pad('loop', 6, 1) + pad('climax', 7, 1) + pad('@', 5, 1) + pad('end', 5, 1) + pad('ch/min', 7, 1) + pad('chords', 7, 1) + pad('ctone', 6, 1) + pad('leap', 5, 1) + pad('snap%', 6, 1) + pad('out%', 6, 1) + pad('poly', 5, 1) + pad('mud%', 5, 1) + '  seam / out of range');
for (const o of out) { if (o.error) { console.log(pad(o.id, 16) + 'ERROR ' + o.error); continue; }
  console.log(pad(o.id, 16) + pad(o.key, 13) + pad(o.bpm, 5, 1) + pad(o.loopSec, 6, 1) + pad(o.climax, 7, 1) + pad(o.climaxAt, 5, 1) + pad(o.ending, 5, 1) + pad(o.chordsPerMin, 7, 1) + pad(o.chords, 7, 1) + pad(o.lead.strongCT === null ? '-' : o.lead.strongCT, 6, 1) + pad(o.lead.maxLeap, 5, 1) + pad(Math.round(o.snapRate * 100), 6, 1) + pad(o.outsidePct, 6, 1) + pad(o.maxPoly, 5, 1) + pad(o.mudPct, 5, 1) + '  ' + o.seam + (o.outside ? ' | ' + o.outside : '')); }
