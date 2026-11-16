// An objective review card for every piece of the score (node tools/score-review.js [--json FILE] [ids...]): compiled in node, no audio.
// Per piece: length and form; the dynamic arc (section levels, climax, ending); the harmonic vocabulary and rhythm; the melody (strong-beat
// chord tones, leaps, how often the engine had to snap a written note onto the chord); notes outside the real instrument's range (the
// sampler will play them, a player could not); texture (polyphony, low-register mud); the loop seam (the chord the pass ends on into the
// chord it restarts on); the palette. Hidden pieces are included (war readings, interludes, bridges), the derived interludes are not.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, setInterval: () => 0, clearInterval: () => 0, setTimeout: () => 0, performance: { now: () => 0 }, navigator: { hardwareConcurrency: 4, userAgent: 'node' }, location: { protocol: 'http:', search: '' }, document: { hidden: false, addEventListener() {} }, window: null, Math, JSON, WeakMap });
ctx.window = ctx;
for (const f of ['js/core/ns.js', 'js/audio/audio.js', 'js/audio/sampler.js', 'js/audio/music.js', 'js/audio/score/themes.js', 'js/audio/score/cues.js', 'js/audio/score/map.js', 'js/audio/score/races.js', 'js/audio/score/programme.js', 'js/audio/score/refresh.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
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
// --races: the race themes and their hostile readings as they are heard (an audience lasts 60 to 90 seconds and always starts at the first
// bar): over the first 90 s of the first pass, the crest and when it comes, the dynamic range, the phrases and chords heard, the sections
// whose level moves; and each piece's likeness to the rest of the score (palette 0.45, tempo 0.15, mode 0.1, meter 0.05, melody 0.25: the
// share of three-note interval shapes the two pieces' phrases have in common; a family measure, not an ear), its nearest neighbour, and for a reading its likeness to its own theme and to the nearest other reading.
if (args.indexOf('--races') >= 0) {
  const WIN = 90, all = Object.keys(T).filter(id => !/^drift\d*:|^bridge:/.test(id) && !T[id].interlude);
  const vec = id => { const p = CO.palette(T[id]), t = Object.values(p).reduce((x, y) => x + y, 0) || 1, v = {}; for (const k in p) v[k] = p[k] / t; return v; };
  const V = {}; for (const id of all) { try { V[id] = vec(id); } catch (e) { /* skip */ } }
  const SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], ukrDorian: [0, 2, 3, 6, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11], phrygDom: [0, 1, 4, 5, 7, 8, 10], dblHarm: [0, 1, 4, 5, 7, 8, 11], wholetone: [0, 2, 4, 6, 8, 10], octatonic: [0, 2, 3, 5, 6, 8, 9, 11], octaH: [0, 1, 3, 4, 6, 7, 9, 10], lydDom: [0, 2, 4, 6, 7, 9, 10] };
  const like = (a, b) => {
    const A = T[a], B = T[b], va = V[a], vb = V[b]; if (!va || !vb) return 0;
    let dot = 0, na = 0, nb = 0; for (const k of new Set([...Object.keys(va), ...Object.keys(vb)])) { const x = va[k] || 0, y = vb[k] || 0; dot += x * y; na += x * x; nb += y * y; }
    const cos = dot / (Math.sqrt(na * nb) || 1), tempo = Math.max(0, 1 - Math.abs(Math.log(A.bpm / B.bpm)) / Math.log(2));
    const sa = SC[A.mode || 'major'] || [], sb = SC[B.mode || 'major'] || [], mode = sa.filter(x => sb.indexOf(x) >= 0).length / new Set([...sa, ...sb]).size;
    const ma = MEL(a), mb = MEL(b), mel = ma.size && mb.size ? [...ma].filter(x => mb.has(x)).length / new Set([...ma, ...mb]).size : 0;
    return 0.45 * cos + 0.15 * tempo + 0.1 * mode + 0.05 * ((A.meter || 4) === (B.meter || 4) ? 1 : 0) + 0.25 * mel;
  };
  // the melody: the set of three-note interval shapes (in scale steps) across a piece's own phrases; a reading shares its theme's
  const melC = {}, MEL = id => { if (melC[id]) return melC[id]; const st = new Set(); for (const k in T[id].ph || {}) { const src = String(T[id].ph[k]); if (src[0] === '@') continue; const d = src.replace(/\|/g, ' ').split(/\s+/).map(t => /^(-?\d+)/.exec(t)).filter(Boolean).map(m => +m[1]); for (let i = 2; i < d.length; i++) st.add((d[i - 1] - d[i - 2]) + ',' + (d[i] - d[i - 1])); } return (melC[id] = st); };
  const rows = [];
  for (const id of Object.keys(T).filter(x => /^race:[a-z]+(:war)?$/.test(x))) {
    const def = T[id], r0 = M._compile(id, 0), a = M.analyze(id), heard = r0.wraps.filter(w => w.t0 < WIN);
    const lv = heard.map(w => [w.R.lv0, w.R.lv1]), tops = lv.map(x => Math.max(...x)), crest = Math.max(...tops), ci = tops.indexOf(crest), cw = heard[ci];
    const crestT = cw.R.lv1 > cw.R.lv0 ? Math.min(WIN, (r0.wraps[r0.wraps.indexOf(cw) + 1] || { t0: r0.len }).t0) : cw.t0;
    const lows = Math.min(...lv.map(x => Math.min(...x))), chords = new Set(), phr = new Set(), names = Object.keys(def.ph || {});
    for (const w of heard) { for (const sg of w.R.segs) chords.add(sg.ch.sym); for (const k of ['lead', 'lead2', 'lead3', 'lead4', 'bell2']) { const L = w.R.L[k]; if (!L) continue; const src = typeof L === 'string' ? L : L.ph; for (const s of [].concat(src || [])) for (const tk of String(s).split(/\s+/)) { const n = tk.replace(/[+\-~^_*].*$/, ''); if (names.indexOf(n) >= 0) phr.add(n); } } }
    const moving = heard.filter(w => Math.abs(w.R.lv1 - w.R.lv0) > 0.01).length;
    const others = all.filter(x => x !== id && V[x]).map(x => [x, like(id, x)]).sort((p, q) => q[1] - p[1]);
    const theme = def.variantOf ? like(id, def.variantOf) : null, oread = def.variantOf ? others.filter(([x]) => /:war$/.test(x) && /^race:/.test(x))[0] : null;
    rows.push({ id, crest: r2(crest), crestT: Math.round(crestT), range: r2(crest - lows), phrases: phr.size, chords: chords.size, moving: moving + '/' + heard.length, ctone: a.lead.strongCT, snaps: a.snaps,
      nearest: others[0][0] + ' ' + r2(others[0][1]), theme: theme === null ? '' : r2(theme), otherReading: oread ? oread[0] + ' ' + r2(oread[1]) : '' });
  }
  console.log('\nraces, first ' + WIN + ' s'); console.log(pad('piece', 18) + pad('crest', 6, 1) + pad('at s', 6, 1) + pad('range', 6, 1) + pad('phr', 4, 1) + pad('ch', 4, 1) + pad('moving', 8, 1) + pad('ctone', 6, 1) + pad('snaps', 6, 1) + '  nearest | to its theme | nearest reading');
  for (const o of rows) console.log(pad(o.id, 18) + pad(o.crest, 6, 1) + pad(o.crestT, 6, 1) + pad(o.range, 6, 1) + pad(o.phrases, 4, 1) + pad(o.chords, 4, 1) + pad(o.moving, 8, 1) + pad(o.ctone === null ? '-' : r2(o.ctone), 6, 1) + pad(o.snaps, 6, 1) + '  ' + o.nearest + (o.theme !== '' ? ' | ' + o.theme + ' | ' + o.otherReading : ''));
  if (jsonAt) fs.writeFileSync(jsonAt.replace(/\.json$/, '') + '.races.json', JSON.stringify(rows, null, 1));
}
