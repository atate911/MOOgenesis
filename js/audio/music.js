// Master of Orion — Reborn · procedural music.
// Each track is a small composition: tempo, key/mode, hand-written melodic phrases (scale-degree notation), chord progressions
// (roman numerals), and a section form that switches accompaniment layers on and off. compile() turns a track + pass number into a
// flat, time-sorted event list (seeded: same composition every loop, small seeded variations per pass); a lookahead scheduler
// (25 ms timer, ~160 ms ahead) or an offline window renderer plays the events through the voice factories in audio.js.
//
// Public API (MOO.Audio.Music):
//   play(id,{fade,loop}) stop({fade}) current() has(id) list() setIntensity(0..1)
//   playlist(ids,{shuffle, gap: s | [lo,hi], fade, start, between: templateId | [ids], betweenP, gapIn}) (a programme: pieces crossfade into
//     interludes re-rooted to the next piece's key and those into the next piece; reshuffles never repeat the last piece or put same-key pieces together)
//   setMood(name,{fade}) snapshot() / restore(snap,{fade}) (hand the music back after a scene: track OR running playlist)
//   renderOffline(id,seconds,opts) analyze(id) (composition lint, used by tools/test-audio.html and tools/audio-report.js)
// Intensity: layers x1..x3 are tension overlays that fade in above 0.12 / 0.38 / 0.62; a track may also *gate* its own layers
// (def.gate = {drums: 0.2, lead: 0.4, ...}) so a battle starts sparse and fills in as the fight escalates (combat1/combat2).
// Variation: a performance picks a form (def.forms: section orderings), an instrumentation (def.alts), a take (seeds the small
// variations: which written reading of a melody plays (ph: [...]), which parts sit out (skip), which phrases rest (rest), how long
// the breaths last (barsVar)) and a tempo rubato (def.rubato), so a piece heard many times over a long game never repeats itself.
(function (M) {
  'use strict';

  const A = M.Audio;
  const K = A.kit;
  const clamp = K.clamp, num = K.num, mtof = K.mtof, makeRng = K.makeRng;
  const V = A.Voices;
  const Music = A.Music = {};
  const TRACKS = Object.create(null);

  // ================================================================== theory
  const PCS = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11], melodic: [0, 2, 3, 5, 7, 9, 11], phrygDom: [0, 1, 4, 5, 7, 8, 10], dblHarm: [0, 1, 4, 5, 7, 8, 11],
    wholetone: [0, 2, 4, 6, 8, 10], octatonic: [0, 2, 3, 5, 6, 8, 9, 11], octaH: [0, 1, 3, 4, 6, 7, 9, 10],
    majPent: [0, 2, 4, 7, 9], minPent: [0, 3, 5, 7, 10], dorPent: [0, 2, 3, 7, 9], hirajoshi: [0, 2, 3, 7, 8],
  };
  const QUAL = {
    '': [0, 4, 7], m: [0, 3, 7], o: [0, 3, 6], '+': [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], '5': [0, 7, 12],
    '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], mM7: [0, 3, 7, 11], o7: [0, 3, 6, 9], 'ø': [0, 3, 6, 10], '7sus4': [0, 5, 7, 10],
    '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], '9': [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], M9: [0, 4, 7, 11, 14],
    q: [0, 5, 10, 15], cl: [0, 1, 6, 7], tri: [0, 6, 12], msus2: [0, 2, 7, 10], '5add9': [0, 7, 14],
  };
  const ROMAN = { I: 0, II: 2, III: 4, IV: 5, V: 7, VI: 9, VII: 11 };
  const CHORD_RE = /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)([^/]*)(?:\/([b#]?(?:VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)))?$/;
  const FIXED_Q = { o: 1, o7: 1, 'ø': 1, sus2: 1, sus4: 1, '7sus4': 1, '5': 1, '+': 1, q: 1, cl: 1, tri: 1, msus2: 1, '5add9': 1 };
  const LOWER_Q = { '': 'm', '7': 'm7', M7: 'mM7', '9': 'm9', '6': 'm6', add9: 'madd9', m: 'm' };

  const mod12 = x => ((x % 12) + 12) % 12;
  function romanRoot(rn) {
    const m = /^([b#]?)(.+)$/.exec(rn);
    return mod12(ROMAN[m[2].toUpperCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0));
  }
  const chordCache = new Map();
  function parseChord(sym, tpc) {
    const key = sym + '|' + tpc, hit = chordCache.get(key);
    if (hit) return hit;
    const m = CHORD_RE.exec(sym);
    if (!m) throw new Error('bad chord "' + sym + '"');
    const lower = m[2] === m[2].toLowerCase();
    let suf = m[3] === 'maj7' ? 'M7' : m[3];
    let qk = FIXED_Q[suf] ? suf : (lower ? (LOWER_Q[suf] || suf) : suf);
    const iv = QUAL[qk];
    if (!iv) throw new Error('bad chord quality "' + sym + '" -> ' + qk);
    const pc = mod12(tpc + romanRoot(m[1] + m[2]));
    const bassPc = m[4] ? mod12(tpc + romanRoot(m[4])) : pc;
    const pcs = [];
    for (const x of iv) { const p = mod12(pc + x); if (pcs.indexOf(p) < 0) pcs.push(p); }
    const third = iv.indexOf(3) >= 0 ? 3 : iv.indexOf(4) >= 0 ? 4 : iv.indexOf(5) >= 0 ? 5 : iv.indexOf(2) >= 0 ? 2 : 7;
    const fifth = iv.indexOf(6) >= 0 && iv.indexOf(7) < 0 ? 6 : iv.indexOf(8) >= 0 && iv.indexOf(7) < 0 ? 8 : 7;
    const seventh = iv.indexOf(11) >= 0 ? 11 : iv.indexOf(9) >= 0 && iv.indexOf(6) >= 0 ? 9 : 10;
    const ch = { sym, pc, bassPc, iv, pcs, third, fifth, seventh };
    chordCache.set(key, ch);
    return ch;
  }

  function expandProg(prog, bars, meter, tpc) {
    const toks = String(prog).replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean), segs = [], total = bars * meter;
    let b = 0, i = 0;
    while (b < total - 1e-9) {
      const tk = toks[i % toks.length]; i++;
      const parts = tk.split(':'), dur = parts[1] ? parseFloat(parts[1]) * meter : meter, beats = Math.min(dur, total - b);
      segs.push({ ch: parseChord(parts[0], tpc), b0: b, b1: b + beats });
      b += beats;
    }
    return segs;
  }
  function segAt(segs, beat) {
    for (let i = segs.length - 1; i >= 0; i--) if (beat >= segs[i].b0 - 1e-9) return segs[i];
    return segs[0];
  }

  // all chord-pitch-class notes in [lo, hi], ascending
  function chordTones(ch, lo, hi) {
    const r = [];
    for (let m = Math.ceil(lo); m <= hi; m++) if (ch.pcs.indexOf(mod12(m)) >= 0) r.push(m);
    return r;
  }
  function nearestPc(pc, center) {
    let m = pc + 12 * Math.round((center - pc) / 12);
    return m;
  }
  const isChordTone = (m, ch) => ch.pcs.indexOf(mod12(m)) >= 0;
  function clashes(m, ch) {
    const pc = mod12(m);
    for (const p of ch.pcs) { const d = mod12(pc - p); if (d === 1 || d === 11) return true; }
    return false;
  }
  function snapToChord(m, ch) {
    for (const d of [-1, 1, -2, 2, -3, 3, -4, 4]) if (isChordTone(m + d, ch)) return m + d;
    return m;
  }

  // smooth voice-leading for pads / choir: choose n chord tones in [lo, hi] closest to the previous voicing
  function voiceChord(ch, prev, lo, hi, n, center) {
    const pool = [];
    for (let m = lo; m <= hi; m++) if (ch.pcs.indexOf(mod12(m)) >= 0) pool.push(m);
    n = Math.min(n, pool.length);
    if (n <= 0) return [];
    const need = Math.min(n, ch.pcs.length), pick = [], cluster = ch.iv.indexOf(1) >= 0;
    let best = null, bestCost = Infinity;
    (function rec(start, k) {
      if (k === n) {
        const set = {}; let cnt = 0;
        for (const m of pick) { const p = mod12(m); if (!set[p]) { set[p] = 1; cnt++; } }
        if (cnt < need || !set[ch.pc]) return;
        let cost = 0;
        if (prev && prev.length) {
          for (let j = 0; j < n; j++) cost += Math.abs(pick[j] - prev[Math.min(j, prev.length - 1)]);
          cost += Math.abs(n - prev.length) * 3;
        }
        let mean = 0; for (const m of pick) mean += m; mean /= n;
        cost += 0.15 * Math.abs(mean - center);
        const span = pick[n - 1] - pick[0];
        if (span > 17) cost += (span - 17) * 1.5;
        if (!cluster) for (let j = 1; j < n; j++) { const g = pick[j] - pick[j - 1]; if (g < 3) cost += (3 - g) * 2.5; }
        if (mod12(pick[0]) !== ch.pc) cost += 1.2;
        if (cost < bestCost) { bestCost = cost; best = pick.slice(); }
        return;
      }
      for (let i = start; i <= pool.length - (n - k); i++) { pick[k] = pool[i]; rec(i + 1, k + 1); }
    })(0, 0);
    return best || pool.slice(0, n);
  }

  // ================================================================== notation parsing
  const cleanPat = s => String(s).replace(/[\s|]/g, '');
  const phraseCache = new Map();
  function parsePhrase(str, meter) {
    const key = meter + '|' + str, hit = phraseCache.get(key);
    if (hit) return hit;
    const toks = String(str).replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean), notes = [];
    let off = 0, last = 1;
    for (const tk of toks) {
      const m = /^(r|-?\d+)([#b]?)(?::(\d*\.?\d+))?(!?)$/.exec(tk);
      if (!m) throw new Error('bad phrase token "' + tk + '"');
      const dur = m[3] !== undefined ? parseFloat(m[3]) : last; last = dur;
      if (m[1] !== 'r') notes.push({ d: parseInt(m[1], 10), acc: m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, off, dur, keep: m[4] === '!' });
      off += dur;
    }
    const r = { notes, beats: off, bars: Math.max(1, Math.ceil(off / meter - 1e-6)) };
    phraseCache.set(key, r);
    return r;
  }
  const PH_TOK = /^([A-Za-z][A-Za-z0-9]*)((?:[+-]\d+|~|\^|_)*)$/;
  function parseMods(s) {
    const r = { shift: 0, inv: false, oct: 0 };
    const re = /([+-]\d+)|~|\^|_/g; let m;
    while ((m = re.exec(s))) { if (m[1]) r.shift += parseInt(m[1], 10); else if (m[0] === '~') r.inv = !r.inv; else if (m[0] === '^') r.oct++; else r.oct--; }
    return r;
  }
  // bass/arp/drum pattern: one string == one bar, step size = meter / length
  const patCache = new Map();
  function parseSteps(str) {
    const hit = patCache.get(str);
    if (hit) return hit;
    const s = cleanPat(str), out = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '.' || c === '-') continue;
      let len = 1; while (s[i + len] === '-') len++;
      out.push({ i, len, c });
    }
    const r = { n: s.length, steps: out };
    patCache.set(str, r);
    return r;
  }

  // ================================================================== presets
  // Synth presets (always available; also the fallbacks while the samples load or when they cannot load at all)
  const SYN = {
    warm: { lvl: 0.15, v: 'pad', att: 1.0, rel: 1.5, det: 9, lfo: 0.11, gain: 0.26 },
    strings: { lvl: 0.14, v: 'pad', att: 0.28, rel: 0.55, det: 6, cutK: 5, cutB: 900, lfo: 0.2, lfoDepth: 0.12, vib: 6, gain: 0.24 },
    glassPad: { lvl: 0.11, v: 'pad', wave: 'triangle', att: 1.5, rel: 2.0, det: 5, cutK: 7, cutB: 800, lfo: 0.08, sub: 0.25, gain: 0.3 },
    airPad: { lvl: 0.23, v: 'pad', two: true, att: 2.0, rel: 2.2, det: 13, cutK: 2.4, cutB: 450, lfo: 0.07, gain: 0.26 },
    dark: { lvl: 0.14, v: 'pad', att: 1.6, rel: 2.4, det: 10, cutK: 2.2, cutB: 250, lfo: 0.06, lfoDepth: 0.3, sub: 0.35, gain: 0.3 },
    organ: { lvl: 0.11, v: 'pad', wave: 'square', two: true, att: 0.05, rel: 0.25, det: 3, cutK: 6, cutB: 1200, lfo: 0.4, lfoDepth: 0.05, gain: 0.2 },
    sub: { lvl: 0.14, v: 'bass', edge: 0.3 }, deep: { lvl: 0.16, v: 'bass', edge: 0, rel: 0.2 }, moog: { lvl: 0.12, v: 'bass', edge: 0.55, att: 0.005, rel: 0.06 },
    pulse: { lvl: 0.11, v: 'bass', wave: 'square', edge: 0.45, att: 0.004, rel: 0.05 },
    brass: { lvl: 0.37, v: 'brass' },
    horn: { lvl: 0.35, v: 'brass', att: 0.08, bright: 4.2, body: 0.42, rel: 0.22, vib: 7 },
    synth: { lvl: 0.36, v: 'brass', att: 0.02, bright: 9, body: 0.15, vib: 8, q: 5 },
    flute: { lvl: 0.18, v: 'flute' },
    reed: { lvl: 0.62, v: 'pluck', wave: 'pulse', duty: 0.18, dec: 0.5, c0: 3600, c1: 1200, fdec: 0.25, det: 8 },
    choirLead: { lvl: 0.08, v: 'choir', att: 0.12, rel: 0.5, v1: 'a', gain: 0.55 },
    glass: { lvl: 0.52, v: 'bell', ratio: 2.0, idx: 1.2, dur: 3.0, partial: 0.2, pr: 4.0 },
    bell: { lvl: 0.55, v: 'bell', ratio: 3.5, idx: 2.0, dur: 2.4, partial: 0.28, pr: 2.76 },
    vibes: { lvl: 0.62, v: 'bell', ratio: 4.0, idx: 0.7, dur: 1.8, partial: 0.1, pr: 3.0 },
    crystal: { lvl: 0.48, v: 'bell', ratio: 1.5, idx: 1.6, dur: 4.0, partial: 0.3, pr: 5.4 },
    chime: { lvl: 0.46, v: 'chime', dur: 3.5 }, harp: { lvl: 0.25, v: 'harp' },
    shimmer: { lvl: 0.98, v: 'bell', ratio: 3, idx: 1.1, dur: 1.0, partial: 0.12, pr: 4, gain: 0.24 },
    arp: { lvl: 0.57, v: 'pluck', wave: 'pulse', duty: 0.28, dec: 0.28, c0: 4200, c1: 900, fdec: 0.15, det: 6 },
    arpSaw: { lvl: 0.72, v: 'pluck', wave: 'sawtooth', dec: 0.22, c0: 5200, c1: 700, fdec: 0.12, det: 7, q: 5 },
    marimba: { lvl: 0.71, v: 'pluck', wave: 'triangle', dec: 0.42, c0: 1800, c1: 600, fdec: 0.1, det: 0, q: 1, sub: 0.5 },
    pizz: { lvl: 0.76, v: 'pluck', wave: 'triangle', dec: 0.3, c0: 2500, c1: 500, fdec: 0.08, det: 0, q: 1, gain: 0.4 },
    kora: { lvl: 0.44, v: 'pluck', wave: 'sawtooth', dec: 0.6, c0: 3000, c1: 500, fdec: 0.2, det: 3, q: 2 },
    seq: { lvl: 0.86, v: 'pluck', wave: 'square', dec: 0.17, c0: 6000, c1: 500, fdec: 0.09, det: 0, q: 9 },
    stab: { lvl: 0.66, v: 'pluck', wave: 'sawtooth', dec: 0.3, c0: 5000, c1: 900, fdec: 0.18, det: 8, q: 2 },
    brassStab: { lvl: 0.36, v: 'brass', att: 0.02, rel: 0.12, vib: 0 },
    ooh: { lvl: 0.1, v: 'choir', v1: 'o', v2: 'a' }, aah: { lvl: 0.09, v: 'choir', v1: 'a', v2: 'a' }, uuh: { lvl: 0.1, v: 'choir', v1: 'u', v2: 'o' }, eeh: { lvl: 0.09, v: 'choir', v1: 'e', v2: 'i' },
    drone: { lvl: 0.11, v: 'drone' }, glassHarm: { lvl: 0.25, v: 'harp' },
  };
  // a sampled preset: `smp` instrument (assets/audio), `fb` + `fbo` = the synth voice that plays until the samples are in
  const fbOf = name => { const o = Object.assign({}, SYN[name]); const fb = o.v; delete o.v; delete o.lvl; return { fb, fbo: o }; };
  const smp = (inst, lvl, extra, fbName) => Object.assign({ lvl, v: 'sample', smp: inst }, fbOf(fbName), extra || {});
  const INST = Object.assign({}, SYN, {
    // sustains: the string sections carry the harmony (Sonatina: 1st violins / violas / celli / basses, each in its seat on the stage;
    // no detuned copies — a recorded section is already a section). The analogue pad survives as 'analog' for the Zimmer beds.
    warm: smp('strEns', 0.14, { att: 0.25, rel: 1.0, hp: 110, eq: [[250, -2.5, 1], [1600, -1.5, 1.2], [8000, 1.5, 'hs']] }, 'warm'),
    strings: smp('strEns', 0.14, { att: 0.2, rel: 0.9, hp: 110, eq: [[250, -2.5, 1], [8000, 1.5, 'hs']] }, 'strings'),
    strTrem: smp('strEnsTrem', 0.15, { att: 0.12, hp: 90, eq: [[8000, 2, 'hs']] }, 'strings'),
    tremHi: smp('vln1Trem', 0.13, { att: 1.2, rel: 2.2, hp: 300, eq: [[3000, -2, 1], [9000, 1.5, 'hs']] }, 'strings'),   // the eerie voice of a late era
    cello: smp('vcSus', 0.3, { att: 0.18, rel: 1.0, hp: 60, leg: true, eq: [[250, -2, 1], [2800, 1.5, 0.8], [7000, 1, 'hs']] }, 'strings'),   // the cello section as a singing line
    cellos: smp('vcSus', 0.24, { att: 0.3, rel: 1.2, hp: 60, eq: [[250, -2, 1], [6000, 2, 'hs']] }, 'warm'),   // cellos as a low bed
    airPad: smp('strEns', 0.12, { att: 0.45, rel: 1.3, cut: 5000 }, 'airPad'),
    glassPad: smp('padGlass', 0.14, { ens: 0.35, att: 0.7, rel: 1.6 }, 'glassPad'),
    dark: smp('strEns', 0.14, { att: 0.35, rel: 1.1, cut: 2200 }, 'dark'),
    drone: smp('strEns', 0.13, { att: 0.7, rel: 1.5, cut: 1800 }, 'drone'),
    analog: smp('padSerrie', 0.17, { ens: 0.25, att: 0.9, rel: 2.0, hp: 110, eq: [[220, -2, 1], [1500, -2, 1.2], [6000, 1.5, 'hs']] }, 'warm'), air: smp('padAir', 0.14, { ens: 0.3, att: 1.4, rel: 2.6, hp: 300, eq: [[8000, 1.5, 'hs']] }, 'airPad'),
    padGlass: smp('padGlass', 0.14, { ens: 0.35, att: 0.7, rel: 1.6 }, 'glassPad'),
    organ: smp('organ', 0.13, {}, 'organ'), organSoft: smp('organSoft', 0.14, { att: 0.12 }, 'organ'),
    flutes: smp('fluteSus', 0.3, { att: 0.08 }, 'flute'),
    // basses: the bass section
    deep: smp('cbSus', 0.3, { att: 0.1, sub: 0.4, eq: [[200, -3, 1], [600, -2, 1]] }, 'deep'), sub: smp('cbSus', 0.3, { att: 0.1, sub: 0.5, eq: [[200, -3, 1], [600, -2, 1]] }, 'sub'),
    moog: smp('cbPizz', 0.55, {}, 'moog'), pulse: smp('cbPizz', 0.5, {}, 'pulse'),
    subSwell: smp('subBass', 0.36, { att: 1.6, rel: 1.6, sub: 0.3, eq: [[80, 2, 'ls'], [300, -2.5, 1]] }, 'sub'),   // the deep swell of the rare pieces
    // brass and winds (the horns crossfade between their mp and ff recordings with the written dynamic)
    horn: smp('hornSus', 0.34, { vib: 0, att: 0.09, hp: 90, eq: [[300, -2, 1], [4000, 2, 'hs']] }, 'horn'),
    hornSolo: smp('hornSolo', 0.31, { hp: 70, eq: [[4000, 2, 'hs']] }, 'horn'),
    brass: smp('brassEns', 0.33, { att: 0.08, hp: 60, eq: [[4000, 2, 'hs']] }, 'brass'),
    synth: smp('brassEns', 0.33, { att: 0.06 }, 'synth'),
    tpt: smp('tptSus', 0.3, {}, 'brass'), tptSolo: smp('tptSolo', 0.28, {}, 'brass'),
    lowBrass: smp('lowBrass', 0.36, { att: 0.08, eq: [[3500, 2.5, 'hs']] }, 'horn'),
    brassStab: smp('brassStac', 1.5, { ring: true }, 'brassStab'),
    flute: smp('flute', 0.42, { att: 0.07, hp: 200, eq: [[6000, 1.5, 'hs']] }, 'flute'), altoFlute: smp('altoFlute', 0.42, { att: 0.08 }, 'flute'),
    oboe: smp('oboe', 0.4, { att: 0.06, hp: 180, eq: [[6000, 1.5, 'hs']] }, 'flute'), reed: smp('corAnglais', 0.4, { att: 0.07, hp: 150, eq: [[6000, 1.5, 'hs']] }, 'reed'),
    clarinet: smp('clarinet', 0.42, { att: 0.07, hp: 120, eq: [[6000, 1.5, 'hs']] }, 'flute'), bassoon: smp('bassoon', 0.42, { att: 0.07, hp: 60, eq: [[5000, 1.5, 'hs']] }, 'horn'),
    // plucked and struck: pizzicato sections, marimba, harp (no synth plucks in the symphonic palette)
    arp: smp('strEnsPizz', 0.42, { rel: 0.35 }, 'arp'), arpSaw: smp('strEnsPizz', 0.42, { rel: 0.35 }, 'arpSaw'), seq: smp('strEnsPizz', 0.42, { rel: 0.3 }, 'seq'),
    pizz: smp('strEnsPizz', 0.5, { rel: 0.4 }, 'pizz'), kora: smp('strEnsPizz', 0.45, { rel: 0.5 }, 'kora'), stab: smp('brassStac', 1.3, { ring: true }, 'stab'),
    strOst: smp('strEnsSpic', 0.5, { ring: true }, 'pizz'),
    marimba: smp('marimba', 0.45, { rel: 0.6, hold: 0.1 }, 'marimba'),
    harp: smp('harp', 0.8, { rel: 1.3, hold: 0.3, hp: 90, eq: [[6000, 1.5, 'hs']] }, 'harp'), glassHarm: smp('harp', 0.7, { rel: 1.3, hold: 0.3 }, 'harp'),
    // bells: celeste (glass), glockenspiel (bell), crotales (crystal, shimmer), tubular chimes (chime)
    glass: smp('celeste', 0.5, { rel: 1.4, hold: 0.4, hp: 300, eq: [[8000, 1.5, 'hs']] }, 'glass'), bell: smp('glock', 0.5, { rel: 1.6, hold: 0.4, hp: 400, eq: [[8000, 1.5, 'hs']] }, 'bell'), crystal: smp('crotales', 0.42, { rel: 2.0, hold: 0.5, hp: 600, eq: [[8000, 2, 'hs']] }, 'crystal'),
    shimmer: smp('crotales', 0.38, { rel: 1.4, hold: 0.3 }, 'shimmer'), vibes: smp('celeste', 0.42, { rel: 1.2, hold: 0.3 }, 'vibes'), chime: smp('chimes', 0.42, { rel: 2.2, hold: 0.5, hp: 150, eq: [[8000, 1.5, 'hs']] }, 'chime'),
    // the recorded chorus: men + women; every vowel preset maps onto it (the recording is one sustained vowel)
    ooh: smp('chorus', 0.17, { att: 0.12, rel: 1.2, hp: 150, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'ooh'), aah: smp('chorus', 0.17, { att: 0.12, rel: 1.2, hp: 150, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'aah'),
    uuh: smp('chorus', 0.16, { att: 0.12, rel: 1.2, hp: 150, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'uuh'), eeh: smp('chorus', 0.16, { att: 0.12, rel: 1.2, hp: 150, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'eeh'),
    choirMen: smp('chorusMen', 0.23, { att: 0.12, rel: 1.3, hp: 100, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'uuh'), choirMenAh: smp('chorusMen', 0.19, { att: 0.12, rel: 1.3, hp: 100, hum: 1.5, alt: true, eq: [[5000, 2.5, 'hs']] }, 'aah'), choirWomen: smp('chorusWomen', 0.16, { att: 0.15, rel: 1.4, hp: 220, hum: 1.5, alt: true, eq: [[5000, 2, 'hs']] }, 'aah'),
    // the two machine races keep a little of their electronic character
    seqSyn: SYN.seq, arpSawSyn: SYN.arpSaw, moogSyn: SYN.moog, pulseSyn: SYN.pulse, synthSyn: SYN.synth,
  });
  Music._SYN = SYN;
  const LAYERS = {
    // (the Sonatina recordings carry their own hall, so the sends are moderate; the bus chorus is off the recorded sections and kept
    //  for the synthesized pads only, where it belongs)
    // verb = the hall (far plane), stage = the short bright stage (close plane): pads and choir live far back, the melody, plucks,
    // bells and drums stand at the front of the stage with the hall only behind them
    pad: { lvl: 0.82, verb: 0.36, stage: 0.0, dly: 0, chorus: 0.12 }, bass: { lvl: 0.8, verb: 0.06, stage: 0.08, dly: 0 }, arp: { lvl: 0.5, verb: 0.18, stage: 0.22, dly: 0.12 },
    lead: { lvl: 1.0, verb: 0.16, stage: 0.26, dly: 0.08 }, bell: { lvl: 0.45, verb: 0.3, stage: 0.24, dly: 0.1 }, choir: { lvl: 0.72, verb: 0.42, stage: 0.0, dly: 0, chorus: 0 },
    drums: { lvl: 0.68, verb: 0.08, stage: 0.32, dly: 0 }, fx: { lvl: 0.6, verb: 0.5, stage: 0.2, dly: 0 },
    x1: { lvl: 0.8, verb: 0.12, dly: 0, i0: 0.12 }, x2: { lvl: 0.7, verb: 0.2, dly: 0.3, i0: 0.38 }, x3: { lvl: 0.9, verb: 0.3, dly: 0, i0: 0.62 },
  };
  const BUS = { pad: 'pad', pad2: 'pad', bass: 'bass', arp: 'arp', arp2: 'arp', drums: 'drums', perc: 'drums', timp: 'drums', lead: 'lead', lead2: 'lead', bell: 'bell', bell2: 'bell', choir: 'choir', choir2: 'choir' };
  const DEF_INST = { pad: 'warm', pad2: 'warm', bass: 'sub', arp: 'arp', arp2: 'arp', lead: 'brass', lead2: 'bell', bell: 'glass', bell2: 'glass', choir: 'ooh', choir2: 'aah' };
  const LINES = { lead: 1, lead2: 1, bell: 1, bell2: 1 };

  const DRUMV = {
    kick: { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 48, f0: 135, dur: 0.36 }, lvl: 0.85 }, snare: { v: 'sample', smp: 'snare', fb: 'snare', fbo: {}, lvl: 0.7 },
    hat: { v: 'sample', smp: 'taps', fb: 'hat', fbo: {}, lvl: 0.5 }, ohat: { v: 'sample', smp: 'taps', fb: 'hat', fbo: { open: true }, lvl: 0.55 }, clap: { v: 'sample', smp: 'tamb', fb: 'clap', fbo: {}, lvl: 0.6 },
    crash: { v: 'sample', smp: 'crash', fb: 'crash', fbo: {}, lvl: 0.7, hp: 180 },
    t1: { v: 'sample', smp: 'tenorHi', fb: 'tom', fbo: { f: 196 }, lvl: 0.7 }, t2: { v: 'sample', smp: 'tenorHi', fb: 'tom', fbo: { f: 147 }, lvl: 0.7 }, t3: { v: 'sample', smp: 'tenorLo', fb: 'tom', fbo: { f: 110 }, lvl: 0.75 },
    t4: { v: 'sample', smp: 'tenorLo', fb: 'tom', fbo: { f: 82 }, lvl: 0.8 }, t5: { v: 'sample', smp: 'bassDrum', fb: 'tom', fbo: { f: 62, dur: 0.6 }, lvl: 0.7 },
    metal: { v: 'sample', smp: 'anvil', fb: 'metal', fbo: {}, lvl: 0.6 }, metal2: { v: 'sample', smp: 'anvil', fb: 'metal', fbo: { f: 520, dur: 0.5 }, lvl: 0.45 },
    click: { v: 'sample', smp: 'claves', fb: 'click', fbo: {}, lvl: 0.5 }, click2: { v: 'sample', smp: 'woodBlock', fb: 'click', fbo: { f: 3600 }, lvl: 0.45 }, click3: { v: 'sample', smp: 'claves', fb: 'click', fbo: { f: 1500, q: 4 }, lvl: 0.4 },
    whisper: { v: 'whisper', dur: 2.6 }, whisper2: { v: 'whisper', dur: 1.3, f0: 2800, f1: 1500 },
    shk: { v: 'sample', smp: 'shaker', fb: 'shaker', fbo: {}, lvl: 0.45 }, hiss: { v: 'sample', smp: 'tambShake', fb: 'shaker', fbo: { dur: 0.22, hp: 3500, f: 7000, att: 0.03 }, lvl: 0.4 }, rim: { v: 'sample', smp: 'taps', fb: 'click', fbo: { f: 1900, q: 3, dur: 0.03, gain: 6 }, lvl: 0.55 },
    // sampled orchestral percussion (assets/audio) with synth fallbacks
    bd: { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 44, f0: 120, dur: 0.5 }, lvl: 0.9 }, bdSoft: { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 44, f0: 120, dur: 0.5 }, lvl: 0.55 },
    sn: { v: 'sample', smp: 'snare', fb: 'snare', fbo: {}, lvl: 0.75 }, snRoll: { v: 'sample', smp: 'snareRoll', fb: 'snare', fbo: { dur: 0.6 }, lvl: 0.7 },
    tam: { v: 'sample', smp: 'gong', fb: 'crash', fbo: { dur: 3 }, lvl: 0.8, hp: 60 }, crashS: { v: 'sample', smp: 'crash', fb: 'crash', fbo: {}, lvl: 0.7, hp: 180 },
    boom: { v: 'boom', lvl: 0.75, dur: 2.0 }, boomHi: { v: 'boom', lvl: 0.5, f: 90, dur: 1.1 }, kickSyn: { v: 'kick', f: 48, f0: 135, dur: 0.36, lvl: 0.85 }, snareSyn: { v: 'snare', lvl: 0.6 },   // the synthetic hits
    tri: { v: 'sample', smp: 'triangle', fb: 'hat', fbo: { open: true }, lvl: 0.4 }, bellTree: { v: 'sample', smp: 'bellTree', fb: 'none', lvl: 0.5 }, sleigh: { v: 'sample', smp: 'sleigh', fb: 'shaker', fbo: {}, lvl: 0.4 },
  };
  const VEL = { x: 0.78, X: 1, o: 0.42, g: 0.26 };
  const GHOSTY = { hat: 1, shk: 1, rim: 1, click: 1, click2: 1, click3: 1, hiss: 0, t3: 0, sn: 0, bd: 0 };
  const DRUMS = {
    pulse4: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...' },
    soft: { kick: 'x.......x.......', hat: 'o.o.o.o.o.o.o.o.' },
    backbeat: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    drive: { kick: 'x..xx...x..xx...', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo', ohat: '..............x.' },
    half: { kick: 'x.......x.......', snare: '........x.......', hat: 'x.o.x.o.x.o.x.o.' },
    walk: { kick: 'x.......x.......', rim: '....x.......x...', hat: 'o.o.o.o.o.o.o.o.' },
    march: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] },
    heavy: { kick: 'x..x..x...x..x..', snare: '........x.......', hat: 'xoxoxoxoxoxoxoxo', metal2: '..............x.' },
    ominous: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.' },
    news: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' },
    marchS: { bd: 'x.......x.......', sn: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, warS: { bd: 'x..x..x.x..x..x.', sn: '....x.......x...' },
    // the field-drum kit (the council procession): a march cadence — a firm one on the bass drum, snare accents on the beats with drags leading into two and four, a roll into every other bar
    field: { bd: 'X.......x.......', sn: ['X..ox.o.x..ox.o.', 'X..ox.o.x.oxxxxx', 'X.o.x..ox.o.x..o', 'X..ox...x..oxxxx'] },
    // the Mutiny kit: processed booms and synthetic kick / snare with an anvil, sparse, over two bars
    mutiny: { boom: ['x...............', '........x.......'], kickSyn: ['x.......x.......', 'x.......x...x...'], snareSyn: ['........x.......', '....x.......x...'], metal: ['....x...........', '............x...'], boomHi: ['............x...', '................'], hiss: ['........x.......', '................'] },
  };
  const FILLS = {
    snare: { snare: '............xxxx', ramp: [0.5, 1] },
    snS: { sn: '............xxxx', ramp: [0.5, 1] }, rollS: { sn: '........xxxxxxxx', ramp: [0.35, 1] }, bigS: { sn: '........xxxxxxxx', bd: '............x.x.', ramp: [0.4, 1] },
    tom: { t1: '........x.......', t2: '.........x......', t3: '..........x.....', t4: '...........x....', snare: '............x.x.', kick: '............x..x', ramp: [0.8, 1] },
    roll: { snare: '........xxxxxxxx', ramp: [0.35, 1] },
  };
  const BASS = {
    whole: '1---', half: '1-1-', walk: '1356', pulse8: '11111111', gallop: '1-111-111-111-11', sync: '1..1..1...1.1...', oct8: '18181818', offbeat: '.1.1.1.1',
    drive16: '1111111111111111', root5: '1-.-5-.-', pedal: { pat: '1---', pedal: true },
  };
  const ARPS = {
    up: { pat: '0123', res: 4 }, updown: { pat: '012321', res: 4 }, broken: { pat: '02130213', res: 4 }, alberti: { pat: '0212', res: 4 },
    wave: { pat: '01234321', res: 4 }, skip: { pat: '0.1.2.3.', res: 4 }, fifths: { pat: '04220422', res: 4 }, run: { pat: '0123210123210123', res: 4 },
    up8: { pat: '0123', res: 2 }, updown8: { pat: '012321', res: 2 }, broken8: { pat: '02130213', res: 2 },
  };

  // ================================================================== track registry
  function Track(id, def) { def.id = id; TRACKS[id] = def; return def; }
  const DEFAULT_TRIM = 1, MIX_TRIM = 2.4;   // MIX_TRIM: the producer's master fader, set from the headless loudness report

  // ---------------------------------------------------------------- prepare (parse + validate once per track)
  function resolveInst(spec, fallback) {
    let s = spec === undefined || spec === null ? fallback : spec, base = {}, extra = null;
    if (typeof s === 'object') { extra = s; s = s.p || fallback; }
    base = INST[s];
    if (!base) throw new Error('unknown instrument "' + s + '"');
    return extra ? Object.assign({}, base, extra, { p: undefined }) : base;
  }
  function norm(spec, lib, what) {
    if (typeof spec === 'string') { const p = lib[spec]; if (p === undefined) throw new Error('unknown ' + what + ' preset "' + spec + '"'); return typeof p === 'string' || Array.isArray(p) ? { pat: p } : Object.assign({}, p); }
    if (spec && typeof spec === 'object') {
      if (spec.p !== undefined) { const p = lib[spec.p]; if (p === undefined) throw new Error('unknown ' + what + ' preset "' + spec.p + '"'); return Object.assign({}, typeof p === 'string' || Array.isArray(p) ? { pat: p } : p, spec); }
      return spec;
    }
    return {};
  }

  function prepare(def) {
    if (def._p) return def._p;
    const meter = def.meter || 4, tpc = PCS[def.root];
    if (tpc === undefined) throw new Error(def.id + ': bad root');
    const scale = SCALES[def.mode || 'major'];
    if (!scale) throw new Error(def.id + ': bad mode');
    const P = {
      meter, spb: 60 / def.bpm, tpc, scale, warn: [], strong: def.strong || ({ 2: [0], 3: [0], 4: [0, 2], 5: [0, 3], 6: [0, 3], 7: [0, 4] }[meter] || [0]),
      tonic: def.tonic !== undefined ? def.tonic : 57 + mod12(tpc - 57) + 12 * (def.oct || 0), phr: {}, secs: [], loopIdx: 0,
    };
    for (const k in (def.ph || {})) { P.phr[k] = parsePhrase(def.ph[k], meter); if (Math.abs(P.phr[k].beats / meter - Math.round(P.phr[k].beats / meter)) > 1e-6) P.warn.push('phrase ' + k + ' is ' + P.phr[k].beats + ' beats (not bar-aligned)'); }
    const base = def.base || {};
    def.sec.forEach(function (s, idx) {
      const R = { n: s.n || 'S' + idx, bars: s.bars, lv: num(s.lv, 1), lv1: s.cres ? s.cres[1] : num(s.lv, 1), lv0: s.cres ? s.cres[0] : num(s.lv, 1), L: {}, raw: s };
      R.segs = expandProg(s.prog, s.bars, meter, tpc);
      for (const key of ['pad', 'pad2', 'bass', 'arp', 'arp2', 'drums', 'perc', 'timp', 'lead', 'lead2', 'bell', 'bell2', 'choir', 'choir2']) {
        let v = s[key] !== undefined ? s[key] : base[key];
        if (v === true) v = base[key];
        if (v) R.L[key] = v;
      }
      for (const k of ['fill', 'cr', 'rise', 'hit', 'tens', 'barsVar']) R[k] = s[k];
      P.secs.push(R);
    });
    if (def.loopFrom) { const i = P.secs.findIndex(s => s.n === def.loopFrom); if (i < 0) throw new Error(def.id + ': loopFrom not found'); P.loopIdx = i; }
    if (def.forms) for (const f of def.forms) for (const n of f) if (!P.secs.some(s => s.n === n)) throw new Error(def.id + ': form section "' + n + '" not found');
    def._p = P;
    return P;
  }

  // ---------------------------------------------------------------- compile context + emit
  function emit(C, ly, inst, beat, midi, beats, vel, ex) {
    if (beat < 0 || beat >= C.totalBeats) return null;
    const o = Object.assign({}, inst);
    o.f = mtof(midi); o.dur = Math.max(0.03, beats * C.spb * (ex && ex.art !== undefined ? ex.art : 1)); o.vel = vel * (inst.lvl === undefined ? 1 : inst.lvl) * C.lvAt(beat); o.dyn = clamp(vel * C.lvAt(beat), 0, 1);
    if (inst.v === 'sample' && beats >= 1.5) { const d1 = clamp(vel * C.lvAt(beat + beats), 0, 1); if (Math.abs(d1 - o.dyn) > 0.04) o.swell = d1; }   // long notes swell with the section's crescendo
    // struck/ringing voices (bells, chimes) keep their own ring time; it only stretches a little with the written length
    if ((inst.v === 'bell' || inst.v === 'chime') && inst.dur) o.dur = inst.dur * clamp(0.7 + 0.15 * beats, 0.7, 1.4);
    if (ex) for (const k in ex) if (k !== 'art' && k !== 'dt' && ex[k] !== undefined) o[k] = ex[k];
    delete o.p;
    const ev = { t: beat * C.spb + (ex && ex.dt || 0), v: inst.v, ly, o, m: midi, b: beat, bt: beats, k: C.key };
    C.ev.push(ev);
    return ev;
  }
  function emitDrum(C, ly, dv, beat, vel, ex) {
    if (beat < 0 || beat >= C.totalBeats) return;
    const o = Object.assign({}, dv); o.vel = vel * C.lvAt(beat) * (dv.lvl === undefined ? 1 : dv.lvl); if (dv.dyn === undefined) o.dyn = clamp(vel * C.lvAt(beat), 0, 1); if (ex) Object.assign(o, ex);
    C.ev.push({ t: beat * C.spb, v: dv.v, ly, o, m: 0, b: beat, bt: 0, k: C.key });
  }
  function stepMidi(C, step, acc) {
    const L = C.scale.length, o = Math.floor(step / L), i = step - o * L;
    return C.tonic + C.scale[i] + 12 * o + (acc || 0);
  }
  function isStrong(C, beatInSec) {
    const b = beatInSec % C.meter;
    for (const s of C.P.strong) if (Math.abs(b - s) < 1e-6) return true;
    return false;
  }

  // ---------------------------------------------------------------- generators
  function genPad(C, s, cfg, key) {
    key = key || 'pad';
    const inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]);
    const style = cfg.style || cfg.p || 'sus', reg = cfg.reg || [50, 72], n = (cfg.n || 4) + (C.era > 0.55 ? 1 : 0), vel = num(cfg.vel, 1), rng = C.vrng;
    let prev = C.prevPad[key];
    const segs = s.R.segs.slice();
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], notes = voiceChord(sg.ch, prev, reg[0], reg[1], n, (reg[0] + reg[1]) / 2);
      prev = notes;
      const b0 = s.start + sg.b0, len = sg.b1 - sg.b0;
      if (style === 'sus' || style === 'swell') {
        let L = len;
        if (cfg.merge !== false) { while (i + 1 < segs.length && segs[i + 1].ch.sym === sg.ch.sym) { i++; L = segs[i].b1 - sg.b0; } }
        const att = style === 'swell' ? Math.min(L * C.spb * 0.6, 3.5) : undefined;
        notes.forEach(function (m, j) { emit(C, 'pad', inst, b0, m, L, vel * (j === 0 ? 1 : 0.9), { pan: (j / Math.max(1, notes.length - 1) - 0.5) * 0.8 * num(cfg.width, 1) * C.widthK, att: att, dt: (rng() - 0.5) * 0.02, rel: cfg.rel }); });
      } else if (style === 'pulse' || style === 'stab') {
        const grid = cleanPat(cfg.pat || (style === 'pulse' ? 'x.x.x.x.' : 'x.......')), step = C.meter / grid.length;
        for (let bar0 = sg.b0; bar0 < sg.b1 - 1e-9; bar0 += C.meter) {      // the pattern is one bar; repeat it across the chord
          for (let k = 0; k < grid.length; k++) {
            const ch = grid[k]; if (ch === '.' || ch === '-') continue;
            const bb = bar0 + k * step; if (bb < sg.b0 - 1e-9 || bb >= sg.b1 - 1e-9) continue;
            const vv = (VEL[ch] || 0.7) * vel;
            notes.forEach(function (m, j) { emit(C, 'pad', inst, s.start + bb, m, step * num(cfg.gate, 0.8), vv, { pan: (j / Math.max(1, notes.length - 1) - 0.5) * 0.6 }); });
          }
        }
      }
    }
    C.prevPad[key] = prev;
  }

  function bassPitch(C, ch, tok, pedal) {
    const rootPc = pedal ? C.P.tpc : ch.bassPc;
    let root = nearestPc(rootPc, C.bassC), m;
    switch (tok) {
      case '1': m = root; break; case '2': m = root + 2; break; case '3': m = root + ch.third; break; case '4': m = root + 5; break;
      case '5': m = root + ch.fifth; break; case '6': m = root + 9; break; case '7': m = root + ch.seventh; break; case '8': m = root + 12; break;
      case '9': m = root + 14; break; case 'a': m = root + ch.fifth - 12; break; case 'b': m = root - 2; break; case 'c': m = root - 12; break;
      default: return null;
    }
    while (m < 26) m += 12;
    return m;
  }
  function genBass(C, s, cfg) {
    const P = norm(cfg, BASS, 'bass'), inst = resolveInst(cfg.inst, C.inst.bass || DEF_INST.bass);
    const pats = [].concat(P.pat), gate = num(P.gate, 0.88), vel = num(P.vel, 1);
    for (let bar = 0; bar < s.bars; bar++) {
      const pt = parseSteps(pats[bar % pats.length]), stepB = C.meter / pt.n;
      for (const st of pt.steps) {
        const beat = bar * C.meter + st.i * stepB, sg = segAt(s.R.segs, beat);
        const m = bassPitch(C, sg.ch, st.c, P.pedal);
        if (m === null) continue;
        const onBeat = Math.abs(st.i * stepB - Math.round(st.i * stepB)) < 1e-6;
        emit(C, 'bass', inst, s.start + beat, m, st.len * stepB * (st.len > 1 ? 0.97 : gate), vel * (onBeat ? 1 : 0.78));
      }
    }
  }

  function genArp(C, s, cfg, key) {
    const P = norm(cfg, ARPS, 'arp'), inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]), reg = P.reg || [55, 84];
    const pats = [].concat(P.pat || P.seq), vel = num(P.vel, 0.6), gate = num(P.gate, 0.7), jump = num(P.jump, 0), rng = C.vrng, cache = {};
    for (let bar = 0; bar < s.bars; bar++) {
      const raw = cleanPat(pats[bar % pats.length]);
      const res = P.res, n = res ? res * C.meter : raw.length, stepB = C.meter / n;
      for (let k = 0; k < n; k++) {
        const c = raw[k % raw.length]; if (c === '.' || c === '-' || c === undefined) continue;
        const beat = bar * C.meter + k * stepB, sg = segAt(s.R.segs, beat), ck = sg.ch.sym + reg[0];
        const tones = cache[ck] || (cache[ck] = chordTones(sg.ch, reg[0], reg[1]));
        if (!tones.length) continue;
        const idx = parseInt(c, 10), oc = Math.floor(idx / tones.length);
        let m = tones[idx % tones.length] + 12 * oc;
        if (jump && rng() < jump) m += 12;
        const onBeat = Math.abs(k * stepB - Math.round(k * stepB)) < 1e-6;
        emit(C, 'arp', inst, s.start + beat, m, stepB * gate, vel * (onBeat ? 1 : 0.72), { pan: (k % 2 ? 0.3 : -0.3) * num(P.width, 1) });
      }
    }
  }

  function genDrums(C, s, cfg, key) {
    const P = norm(cfg, DRUMS, 'drums'), vel0 = num(P.vel, 1), rng = C.vrng;
    const fillName = P.fill !== undefined ? P.fill : s.R.fill, F = fillName ? FILLS[fillName] : null;
    const ly = key === 'drums' || key === 'perc' ? 'drums' : 'drums';
    for (const name in P) {
      if (name === 'p' || name === 'vel' || name === 'fill' || name === 'gate' || name === 'tune' || name === 'skip') continue;
      const dv = DRUMV[name]; if (!dv) { C.warn('unknown drum "' + name + '"'); continue; }
      const pats = [].concat(P[name]).map(cleanPat);
      for (let bar = 0; bar < s.bars; bar++) {
        let pat = pats[bar % pats.length];
        const isFill = F && bar === s.bars - 1 && C.meter === 4 && F[name] !== undefined;
        if (isFill) pat = F[name];
        const stepB = C.meter / pat.length;
        let hitIdx = 0, hits = 0;
        if (isFill) for (let i = 0; i < pat.length; i++) if (pat[i] !== '.') hits++;
        for (let i = 0; i < pat.length; i++) {
          const c = pat[i]; if (c === '.' || c === '-') continue;
          let v = VEL[c]; if (v === undefined) { const dd = parseInt(c, 10); v = isNaN(dd) ? 0.7 : dd / 9; }
          if (isFill && F.ramp) v *= F.ramp[0] + (F.ramp[1] - F.ramp[0]) * (hits > 1 ? hitIdx / (hits - 1) : 1);
          hitIdx++;
          v *= vel0 * (1 + (rng() - 0.5) * 0.12);
          const ex = P.tune && P.tune[name] ? { f: P.tune[name] } : (C.def.tomTune && /^t\d$/.test(name) ? { f: C.def.tomTune[+name[1] - 1] } : null);
          emitDrum(C, ly, dv, s.start + bar * C.meter + i * stepB, v, ex);
        }
        if (GHOSTY[name] && pat.length >= 8) for (let i = 0; i < pat.length; i++) if (pat[i] === '.' && rng() < 0.035) emitDrum(C, ly, dv, s.start + bar * C.meter + i * stepB, 0.3 * vel0, null);
      }
    }
  }

  const TIMP = {
    hits: { kick: 'X...............' }, beats: { kick: 'X...x...x...x...' }, two: { kick: 'X.......x.......' },
    roll: { kick: 'xxxxxxxxxxxxxxxx', ramp: [0.25, 1] }, gallop: { kick: 'X..xx..xX..xx.x.' },
  };
  function genTimp(C, s, cfg) {
    const P = norm(cfg, TIMP, 'timp'), grid = P.kick || P.pat, pats = [].concat(grid).map(cleanPat), vel0 = num(P.vel, 1), rng = C.vrng;
    const rollBars = P.roll !== undefined ? P.roll : 0;
    for (let bar = 0; bar < s.bars; bar++) {
      let pat = pats[bar % pats.length], ramp = P.ramp;
      if (rollBars && bar >= s.bars - rollBars) {
        const sg0 = segAt(s.R.segs, bar * C.meter), m0 = nearestPc(sg0.ch.bassPc, num(P.center, 40)), k = bar - (s.bars - rollBars);
        const d0 = 0.25 + 0.55 * k / rollBars, d1 = 0.25 + 0.55 * (k + 1) / rollBars;
        // a real roll (looped) rising through the bar; the synth timpani keeps the old 16th-note roll when the samples are not in
        emitDrum(C, 'drums', { v: 'sample', smp: 'timpRoll', fb: 'timp', fbo: { f: mtof(m0), dur: 1.8 }, f: mtof(m0), dur: C.meter * C.spb, dyn: d0, swell: d1, hum: 0, lvl: 0.9 }, s.start + bar * C.meter, vel0 * d1);
        pat = bar === s.bars - 1 ? '...............x' : '................'; ramp = null;
      }
      const stepB = C.meter / pat.length, hits = pat.split('').filter(c => c !== '.' && c !== '-').length;
      let hi = 0;
      for (let i = 0; i < pat.length; i++) {
        const c = pat[i]; if (c === '.' || c === '-') continue;
        const beat = bar * C.meter + i * stepB, sg = segAt(s.R.segs, beat);
        let v = (VEL[c] || 0.7) * vel0 * (1 + (rng() - 0.5) * 0.1);
        if (ramp) v *= ramp[0] + (ramp[1] - ramp[0]) * (hits > 1 ? hi / (hits - 1) : 1);
        hi++;
        const m = nearestPc(sg.ch.bassPc, num(P.center, 40));
        emitDrum(C, 'drums', { v: 'sample', smp: 'timpani', fb: 'timp', fbo: { f: mtof(m), dur: num(P.dur, 1.8) }, f: mtof(m), lvl: 1.0, sub: 0.18, dur: 1.6 }, s.start + beat, v);
        if (v > 0.6) emitDrum(C, 'drums', { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 44, f0: 120, dur: 0.4 }, lvl: 0.4 }, s.start + beat, v);
      }
    }
  }

  // The choir is written as parts, not as chords: a voice that keeps its pitch across a chord change holds it (a tie, no new attack); a
  // voice that has to jump a third or more walks to its new note through a diatonic passing tone in the last beat; at a phrase start
  // the voices enter one after another; and a chord longer than a breath is sung as breath-length phrases that swell. `soft` sings low
  // and slow (the supportive role). The melody, when a piece gives the choir one, is a separate line layer (lead2 / bell2) in the choir's voice.
  function genChoir(C, s, cfg, key) {
    key = key || 'choir';
    const inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]), reg = cfg.reg || [55, 77], n = cfg.n || 3, vel = num(cfg.vel, 1);
    let prev = C.prevChoir[key];
    const segs = s.R.segs, soft = !!cfg.soft, rng = C.vrng, spb = C.spb;
    const breathBeats = Math.max(2, Math.round((soft ? 8.0 : 5.2) / spb));
    const sampled = inst.v === 'sample';
    const scaleHas = m => C.scale.indexOf(mod12(m - C.tonic)) >= 0;
    const voices = [];                                   // per part: { m, ev } of the note currently sounding
    const base = { v1: cfg.v1 || inst.v1, v2: cfg.v2 || inst.v2, att: cfg.att, rel: cfg.rel };
    const sing = (j, m, beat, L, k, first) => {           // one phrase of one voice: staggered entry, a small swell, breath-length
      const dyn0 = (soft ? 0.3 : 0.55) + (soft ? 0.12 : 0.2) * (k % 2), dt = first ? j * 0.16 + rng() * 0.08 : j * 0.04 + rng() * 0.05;
      return emit(C, 'choir', inst, s.start + beat, m, Math.max(0.5, L), vel * (0.9 + 0.1 * (k % 2)), Object.assign({}, base, { pan: (j - (n - 1) / 2) * 0.35, dt, dyn: dyn0, swell: dyn0 + (soft ? 0.22 : 0.18) }));
    };
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], notes = voiceChord(sg.ch, prev, reg[0], reg[1], n, (reg[0] + reg[1]) / 2);
      prev = notes;
      let L = sg.b1 - sg.b0;
      while (i + 1 < segs.length && segs[i + 1].ch.sym === sg.ch.sym) { i++; L = segs[i].b1 - sg.b0; }
      notes.forEach(function (m, j) {
        const cur = voices[j];
        if (!sampled) { emit(C, 'choir', inst, s.start + sg.b0, m, L, vel, Object.assign({}, base, { pan: (j - (n - 1) / 2) * 0.35 })); return; }
        // a held common tone: extend the sounding note instead of re-attacking (up to a breath)
        if (cur && cur.m === m && cur.ev && (cur.ev.o.dur / spb) + L <= breathBeats * 1.4) { cur.ev.o.dur += L * spb; cur.len += L; return; }
        // a leap: walk into the new note through a passing tone in the last beat of the old one
        if (cur && cur.ev && Math.abs(m - cur.m) >= 3 && cur.len >= 2 && cur.ev.o.dur > 1.6 * spb) {
          const dir = m > cur.m ? 1 : -1; let pt = m - dir;
          while (Math.abs(pt - cur.m) > 0 && !scaleHas(pt)) pt -= dir;
          if (pt !== cur.m && pt !== m) { cur.ev.o.dur -= spb; emit(C, 'choir', inst, s.start + sg.b0 - 1, pt, 0.98, vel * 0.85, Object.assign({}, base, { pan: (j - (n - 1) / 2) * 0.35, dyn: 0.5, leg: true })); }
        }
        // the new note, in breath-length phrases if it is long
        let b = 0, k = 0, first = !cur;
        while (b < L) {
          const len = Math.min(L - b, breathBeats + Math.round((rng() - 0.5) * 2)), gap = b + len < L ? 0.35 : 0;
          const ev = sing(j, m, sg.b0 + b, len - gap, k, first && b === 0);
          voices[j] = { m, ev, len };
          b += len; k++;
        }
      });
    }
    C.prevChoir[key] = prev;
  }

  // melodic lines from hand-written phrases (lead, lead2, bell, bell2)
  function genLine(C, s, cfg, key) {
    const spec = typeof cfg === 'string' ? { ph: cfg } : cfg;
    const ly = BUS[key], inst = resolveInst(spec.inst, C.inst[key] || DEF_INST[key]);
    const vel = num(spec.vel, key === 'lead' ? 0.9 : 0.7), art = num(spec.art, inst.v === 'pluck' || inst.v === 'bell' || inst.v === 'chime' ? 1 : 0.97);
    const harm = spec.harm || 0, oct = spec.oct || 0, rng = C.vrng, brassy = inst.v === 'brass' || inst.v === 'flute', graceP = num(spec.grace, brassy ? 0.18 : 0), echoP = num(spec.echo, brassy ? 0 : 0.07);
    const ref = key === 'lead' ? s.R.L.lead2 : s.R.L.lead;                       // '@': double the other line (lead2 follows lead, lead follows lead2)
    let phs = spec.ph === '@' ? (ref && (ref.ph || ref)) : spec.ph;
    if (Array.isArray(phs)) {                                                   // several written readings of the line: one per performance
      const picks = C.phPick || (C.phPick = new Map());                          // (a doubling that says ph: '@' follows the lead's choice)
      if (!picks.has(phs)) picks.set(phs, Math.floor(rng() * phs.length));
      phs = phs[picks.get(phs)];
    }
    const restP = num(spec.rest, 0);
    const toks = String(phs).trim().split(/\s+/).filter(Boolean);
    const L = C.scale.length;
    let cur = 0;
    for (const tk of toks) {
      const rm = /^r(\d*\.?\d+)$/.exec(tk);
      if (rm) { cur += parseFloat(rm[1]) * C.meter; continue; }
      const pm = PH_TOK.exec(tk);
      if (!pm || !C.P.phr[pm[1]]) { C.warn('unknown phrase "' + tk + '" in ' + s.R.n); continue; }
      const ph = C.P.phr[pm[1]], md = parseMods(pm[2]);
      if (restP && rng() < restP) { cur += ph.bars * C.meter; continue; }        // the player leaves this phrase out: a breath in the line
      const first = ph.notes.length ? ph.notes[0].d - 1 : 0;
      for (const nt of ph.notes) {
        const off = cur + nt.off;
        if (off >= s.beats - 1e-6) break;
        let step = nt.d - 1;
        if (md.inv) step = 2 * first - step;
        step += md.shift + (md.oct + oct) * L;
        const sg = segAt(s.R.segs, off), strong = isStrong(C, off);
        let m = stepMidi(C, step, nt.acc);
        if (!nt.keep && (strong || nt.dur >= 2) && !isChordTone(m, sg.ch) && clashes(m, sg.ch)) { m = snapToChord(m, sg.ch); C.snaps++; }
        const dt = (rng() - 0.5) * 0.012;
        if (graceP && nt.dur >= 1.5 && rng() < graceP) emit(C, ly, inst, s.start + off - 0.09, stepMidi(C, step - 1, 0), 0.09, vel * 0.55, { art: 1, dt: 0 });
        emit(C, ly, inst, s.start + off, m, nt.dur, vel, { art: art, dt: dt, pan: spec.pan });
        if (echoP && (!strong || spec.echo) && rng() < echoP) emit(C, ly, inst, s.start + off + 0.04, m + 12, Math.min(nt.dur, 1) * 0.8, vel * 0.3, { art: art, pan: (rng() - 0.5) * 0.8 });
        if (harm) {
          let hm = stepMidi(C, step + harm, 0);
          if (!isChordTone(hm, sg.ch) && clashes(hm, sg.ch)) hm = snapToChord(hm, sg.ch);
          C.key = key + '_h';
          emit(C, ly, inst, s.start + off, hm, nt.dur, vel * num(spec.hvel, 0.7), { art: art, dt: dt, pan: num(spec.pan, 0) * 0.5 - 0.25 });
          C.key = key;
        }
      }
      cur += ph.bars * C.meter;
    }
  }

  // generative bell sparkle (seeded by the composition RNG: identical every loop, a few notes dropped per pass)
  function genSparkle(C, s, cfg, key) {
    const ly = BUS[key], inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]);
    const reg = cfg.reg || [72, 91], res = cfg.res || 2, dens = num(cfg.dens, 0.5) * 0.5, vel = num(cfg.vel, 0.55) * 0.7, rng = C.crng, vr = C.vrng;
    const pent = cfg.pent !== false, scaleIdx = pent ? [0, 1, 2, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    const pool = [];
    for (let o = -1; o <= 3; o++) for (const i of scaleIdx) { if (i >= C.scale.length) continue; const m = C.tonic + C.scale[i] + 12 * o; if (m >= reg[0] && m <= reg[1]) pool.push(m); }
    pool.sort((a, b) => a - b);
    if (!pool.length) return;
    let ix = Math.floor(pool.length / 2);
    const n = res * C.meter;
    for (let bar = 0; bar < s.bars; bar++) {
      for (let k = 0; k < n; k++) {
        const beat = bar * C.meter + k / res, sg = segAt(s.R.segs, beat), strong = isStrong(C, beat), onBeat = k % res === 0;
        const p = dens * (strong ? 1.5 : onBeat ? 0.9 : 0.5);
        if (rng() >= p) continue;
        ix = clamp(ix + rng.pick([-3, -2, -1, -1, 1, 1, 2, 3]), 0, pool.length - 1);
        let m = pool[ix];
        if (strong && !isChordTone(m, sg.ch)) { const near = pool.map((q, j) => [Math.abs(q - m), j, q]).filter(a => isChordTone(a[2], sg.ch)).sort((a, b) => a[0] - b[0])[0]; if (near) { m = near[2]; ix = near[1]; } }
        else if (!isChordTone(m, sg.ch) && clashes(m, sg.ch)) m = snapToChord(m, sg.ch);
        if (vr() < 0.12) continue;
        emit(C, ly, inst, s.start + beat, m, 1 / res, vel * (0.6 + 0.4 * rng()), { pan: (rng() - 0.5) * 1.2 });
      }
    }
  }

  const GEN = { pad: genPad, pad2: genPad, bass: genBass, arp: genArp, arp2: genArp, drums: genDrums, perc: genDrums, timp: genTimp, choir: genChoir, choir2: genChoir, lead: genLine, lead2: genLine };

  // ---------------------------------------------------------------- tension overlays (layers x1..x3, gated by setIntensity)
  function genTension(C, s) {
    const T = C.def.tens;
    if (T === false) return;
    const t = T || {};
    // x1: light percussion pulse
    if (t.x1 !== false && C.meter === 4) {
      const pat = t.x1 || { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', snare: '................' };
      for (const name in pat) {
        const dv = DRUMV[name]; if (!dv) continue; const g = cleanPat(pat[name]), stepB = C.meter / g.length;
        for (let bar = 0; bar < s.bars; bar++) for (let i = 0; i < g.length; i++) { if (g[i] === '.') continue; emitDrum(C, 'x1', dv, s.start + bar * C.meter + i * stepB, (VEL[g[i]] || 0.6) * 0.8); }
      }
    }
    // x2: 16th-note arpeggio on chord tones
    if (t.x2 !== false) {
      const inst = resolveInst(t.inst || 'arp', 'arp'), reg = t.reg || [57, 81], seq = cleanPat(t.seq || '0123210132012301').slice(0, C.meter * 4), cache = {};
      const stepB = C.meter / seq.length;
      for (let bar = 0; bar < s.bars; bar++) for (let k = 0; k < seq.length; k++) {
        const beat = bar * C.meter + k * stepB, sg = segAt(s.R.segs, beat), tones = cache[sg.ch.sym] || (cache[sg.ch.sym] = chordTones(sg.ch, reg[0], reg[1]));
        if (!tones.length) continue;
        const idx = parseInt(seq[k], 10);
        emit(C, 'x2', inst, s.start + beat, tones[idx % tones.length] + 12 * Math.floor(idx / tones.length), stepB * 0.7, k % 4 === 0 ? 0.62 : 0.45, { pan: k % 2 ? 0.35 : -0.35 });
      }
    }
    // x3: timpani + brass chord hits on every bar start
    if (t.x3 !== false) {
      const inst = resolveInst(t.hit || 'brassStab', 'brassStab');
      for (let bar = 0; bar < s.bars; bar++) {
        const beat = bar * C.meter, sg = segAt(s.R.segs, beat);
        emitDrum(C, 'x3', { v: 'sample', smp: 'timpani', fb: 'timp', fbo: { f: mtof(nearestPc(sg.ch.bassPc, 40)), dur: 1.4 }, f: mtof(nearestPc(sg.ch.bassPc, 40)), lvl: 1.0 }, s.start + beat, 0.9);
        if (bar % 2 === 0) {
          const notes = voiceChord(sg.ch, null, 55, 74, 3, 64);
          notes.forEach(function (m) { emit(C, 'x3', inst, s.start + beat, m, 1.4, 0.55, {}); });
        }
      }
    }
  }

  // ---------------------------------------------------------------- the eerie voice of a contentious era
  // Past about two thirds of the arc an exploration piece gains, now and then, something not quite natural, far back in the hall: a high
  // violin tremolo holding a note a half step off the chord, swelling in and fading over a few bars; a bowed-cymbal shimmer; very rarely a
  // breath of whispered noise. Quiet, sparse, and more frequent as the era rises; never in the cadence bars.
  function genEerie(C, s, rng) {
    const E = C.era, k = (E - 0.65) / 0.35; if (k <= 0) return;
    const inst = resolveInst('tremHi', 'strings'), bars = s.bars, perBar = 0.12 + 0.3 * k;   // chance per bar of something
    for (let bar = 0; bar < bars - 1; bar++) {
      if (rng() >= perBar) continue;
      const beat = bar * C.meter, sg = segAt(s.R.segs, beat), kind = rng();
      if (kind < 0.62) {                                            // the tremolo: a chord tone's neighbour, high, swelling across two to four bars
        const tones = chordTones(sg.ch, 79, 91); if (!tones.length) continue;
        const ct = tones[Math.floor(rng() * tones.length)], m = ct + (rng() < 0.5 ? -1 : 1), L = Math.min((bars - 1 - bar) * C.meter, C.meter * (2 + Math.floor(rng() * 3)));
        if (L < C.meter) continue;
        const dyn = 0.18 + 0.22 * k;
        emit(C, 'fx', inst, s.start + beat, m, L, 0.26 + 0.2 * k, { pan: (rng() - 0.5) * 1.2, dyn, swell: dyn + 0.2, att: Math.min(L * C.spb * 0.4, 4), rel: 2.5 });
        bar += Math.round(L / C.meter);
      } else if (kind < 0.9) {                                      // a bowed cymbal, low and slow, ending on a bar line
        const dur = C.meter * C.spb * 2;
        emitDrum(C, 'fx', { v: 'sample', smp: 'cymSwell', fb: 'swell', fbo: { dur, f0: 300, f1: 4000 }, alignEnd: true, dur, dyn: 0.12 + 0.2 * k, hum: 0, lvl: 0.5 }, s.start + beat, 0.22 + 0.18 * k);
        bar += 1;
      } else {                                                      // a whisper, barely there
        emitDrum(C, 'fx', { v: 'whisper', dur: 2.2 + rng() * 1.5, lvl: 0.4 }, s.start + beat + rng() * C.meter, 0.16 + 0.14 * k);
      }
    }
  }

  // ---------------------------------------------------------------- transitions (auto crashes / risers / booms)
  function genTransitions(C, wraps) {
    for (let i = 0; i < wraps.length; i++) {
      const cur = wraps[i], prev = i > 0 ? wraps[i - 1] : (C.pass > 0 ? wraps[wraps.length - 1] : null);
      C.curW = cur;
      if (cur.R.hit) { emitDrum(C, 'fx', { v: 'boom' }, cur.start, 0.3); emitDrum(C, 'fx', { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 40, f0: 110, dur: 0.5 } }, cur.start, 0.95); if (cur.R.hit === 'tam') emitDrum(C, 'fx', { v: 'sample', smp: 'gong', fb: 'crash', fbo: { dur: 3 } }, cur.start, 0.8); }
      if (!prev || C.def.gentle) continue;
      const up = cur.R.lv0 - prev.R.lv1;
      if (cur.R.cr === true || (cur.R.cr !== false && up >= 0.12)) emitDrum(C, 'fx', { v: 'sample', smp: 'crash', fb: 'crash', fbo: { dur: 2.8 } }, cur.start, 0.6);
      const rise = prev.R.rise !== undefined ? prev.R.rise : (up >= 0.15 ? 1 : 0);
      if (rise) {
        // the riser sits in the last bar(s) of the previous section; across the loop seam it lives at the end of this pass
        const st = i > 0 ? cur.start - rise * C.meter : C.totalBeats - rise * C.meter;
        if (st >= 0) { C.curW = i > 0 ? prev : cur; const dur = rise * C.meter * C.spb; emitDrum(C, 'fx', { v: 'swell', dur }, st, 0.15); emitDrum(C, 'fx', { v: 'sample', smp: 'cymSwell', fb: 'swell', fbo: { dur }, alignEnd: true, dur, dyn: dur > 5 ? 0.9 : dur > 3 ? 0.5 : 0.15 }, st, 0.55); }
      }
    }
  }

  // ---------------------------------------------------------------- compile one pass of a track
  // the sections one pass plays: without `forms`, the intro then the loop (pass 0) or the loop (later passes); with `forms` (arrays
  // of section names, each a block of five minutes or more), the intro then block form0, then the blocks in turn, so a piece that
  // stays on for twenty minutes is heard as two or three long, differently ordered blocks rather than one loop
  function passSections(def, P, pass, form0) {
    if (!def.forms || !def.forms.length) return pass === 0 ? P.secs : P.secs.slice(P.loopIdx);
    const names = def.forms[((form0 || 0) + pass) % def.forms.length];
    const block = names.map(n => { const sec = P.secs.find(x => x.n === n); if (!sec) throw new Error(def.id + ': form section "' + n + '" not found'); return sec; });
    return pass === 0 ? P.secs.slice(0, P.loopIdx).concat(block) : block;
  }
  function loopBars(def, P) {
    const secs = def.forms && def.forms.length ? passSections(def, P, 1, 0) : P.secs.slice(P.loopIdx);
    return secs.reduce((a, s) => a + s.bars, 0);
  }
  // take: which of eight readings of the small variations this performance plays (phrase choices, rests, breath lengths, ornaments);
  // the composition RNG (crng) is the piece itself and never changes, the variation RNG (vrng) is seeded by pass and take
  function compilePass(def, pass, form0, alt0, take, era) {
    const P = prepare(def), secs = passSections(def, P, pass, form0), E = eraOf(def, era);
    const C = {
      def, P, pass, take: take || 0, era: E, widthK: 1 - 0.3 * E, meter: P.meter, spb: P.spb, scale: P.scale, tonic: P.tonic, ev: [], bassC: def.bassC || 38, prevPad: {}, prevChoir: {},
      inst: Object.assign({}, def.inst || {}, def.alts && def.alts.length ? def.alts[((alt0 || 0) + pass) % def.alts.length] : {}),   // per-pass instrument alternation, from a random start
      snaps: 0, crng: makeRng(def.id + ':c'), vrng: makeRng(def.id + ':v' + ((pass + (take || 0)) % 8)), warn: m => { if (P.warn.indexOf(m) < 0) P.warn.push(m); }, lvAt: null, totalBeats: 0,
    };
    const erng = makeRng(def.id + ':e' + ((pass + (take || 0)) % 8));
    if (E > 0.4 && def.eraAlts) for (const k in def.eraAlts) if (erng() < (E - 0.4) * 1.5) C.inst[k] = def.eraAlts[k];   // darker alternates stand in more often (90 % at the top)
    const tenseP = TENSE_P(E);
    const wraps = []; let beat = 0;
    for (const R0 of secs) {
      let R = R0;
      if (R0.barsVar) {                                   // a breath is not always the same length: the next phrase waits a little longer, or less
        const bars = Math.max(1, R0.barsVar[0] + C.vrng.int(0, R0.barsVar[1] - R0.barsVar[0]));
        if (bars !== R0.bars) R = Object.assign(Object.create(R0), { bars, segs: expandProg(R0.raw.prog, bars, P.meter, P.tpc) });
      }
      if (tenseP > 0) {                                   // the era colours some of the chords (the same ones every time at a given era, per take)
        const segs = R.segs.map((sg, i, arr) => { const r = erng(); if (r >= tenseP || i === arr.length - 1) return sg; const sym = tenseChord(sg.ch.sym, E, erng()); return sym === sg.ch.sym ? sg : { ch: parseChord(sym, P.tpc), b0: sg.b0, b1: sg.b1 }; });   // never the cadence
        R = Object.assign(Object.create(R), { segs });
      }
      wraps.push({ R, start: beat, beats: R.bars * P.meter, bars: R.bars }); beat += R.bars * P.meter;
    }
    C.totalBeats = beat;
    C.curW = null;
    C.lvAt = function (b) { const w = C.curW; if (!w || w.R.lv0 === w.R.lv1) return w ? w.R.lv0 : 1; return w.R.lv0 + (w.R.lv1 - w.R.lv0) * clamp((b - w.start) / w.beats, 0, 1); };
    for (const w of wraps) {
      C.curW = w;
      const s = { R: w.R, start: w.start, bars: w.bars, beats: w.beats };
      for (const key in w.R.L) {
        const cfg = w.R.L[key];
        C.key = key;
        if (cfg && typeof cfg === 'object' && cfg.skip && C.vrng() < cfg.skip) continue;   // a part that does not play in every performance
        if (key === 'bell' || key === 'bell2') {
          const spec = typeof cfg === 'string' ? { ph: cfg } : cfg;
          if (spec.ph) genLine(C, s, spec, key); else genSparkle(C, s, spec, key);
        } else if (GEN[key]) {
          if (typeof cfg === 'string' || typeof cfg === 'object') GEN[key](C, s, typeof cfg === 'object' && !(LINES[key]) ? cfg : (LINES[key] ? cfg : { p: cfg }), key);
        }
      }
      C.key = 'tens';
      if (w.R.tens !== false) genTension(C, s);
      if (E > 0.65 && w.bars >= 4) { C.key = 'eerie'; genEerie(C, s, erng); }
    }
    C.key = 'trans';
    genTransitions(C, wraps);
    C.ev.sort((a, b) => a.t - b.t);
    markLegato(C.ev);
    return { events: C.ev, beats: C.totalBeats, len: C.totalBeats * P.spb, wraps, pass, snaps: C.snaps };
  }
  // phrasing: in a melodic line, a note that follows straight on from the previous one is played legato (the sampler then starts past the
  // bow / breath attack and the previous note is held a little into it, like a player who does not re-attack every note)
  function markLegato(evs) {
    const last = Object.create(null);
    for (const ev of evs) {
      if (ev.v !== 'sample' || !LINES[ev.ly] || !ev.o || ev.o.ring || ev.o.oneShot) continue;
      const prev = last[ev.ly];
      if (prev && ev.m !== prev.m && Math.abs(ev.t - (prev.t + prev.o.dur)) < 0.09 && ev.o.dur > 0.25) {
        ev.o.leg = true;
        prev.o.dur = Math.max(prev.o.dur, ev.t - prev.t + 0.07);       // overlap into the new note; the old one releases under it
      }
      last[ev.ly] = ev;
    }
  }

  // ================================================================== player
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const S = { cur: null, old: [], timer: null, intensity: 0, era: 0, pending: null, playlist: null, ticks: 0, plWait: null };
  // The era (Music.setEra, 0..1): how contentious the game has become. It is read only when a new performance of an exploration piece
  // (def.gentle) is compiled, never mid-piece, and every step it takes is a few percent — the arc is felt in hindsight, not heard happening:
  // chords gain ninths and sevenths, then a few turn minor; the pads voice one more note and sit a little closer; the echoes tighten (the hall
  // stays: it is what makes the recordings real); the tempo lifts a little; recorded low strings and the men stand in more often; past two
  // thirds something eerie appears now and then, far back (genEerie).
  const eraOf = (def, era) => (def.gentle && def.eraSens !== false ? clamp(num(era, 0), 0, 1) : 0);
  const TENSE_P = era => Math.max(0, era - 0.25) * 0.65;         // share of chords coloured at this era (0 below 0.25, about half at 1)
  function tenseChord(sym, era, r) {
    const m = CHORD_RE.exec(sym); if (!m) return sym;
    const q = m[3], slash = m[4] ? '/' + m[4] : '', lower = m[2] === m[2].toLowerCase();
    if (q !== '' && q !== '7') return sym;                          // only plain triads and dominants are touched; written colours stay
    if (q === '7') return era > 0.65 && r < 0.6 ? m[1] + m[2] + '9' + slash : sym;
    if (era > 0.7 && !lower && r < 0.35 && m[2] === 'IV') return m[1] + 'iv' + slash;      // the subdominant turns minor, now and then
    if (era > 0.85 && !lower && r < 0.5 && m[2] === 'I') return m[1] + 'IM7' + slash;       // the tonic itself gains its seventh at the top
    if (era > 0.5 && r < 0.5) return m[1] + m[2] + (lower ? 'm9' : 'M7') + slash;          // richer sevenths and ninths, never suspensions
    return m[1] + m[2] + (lower ? 'm7' : 'add9') + slash;
  }

  class Player {
    constructor(eng, def, o) {
      this.eng = eng; this.def = def; this.id = def.id; this.o = o || {};
      this.P = prepare(def); this.nodes = []; this.live = new Set(); this.disposed = false; this.stopped = false; this.finished = false;
      this.loop = this.o.loop !== false; this.intensity = num(this.o.intensity, 0);
      const ctx = eng.ctx, mk = n => { this.nodes.push(n); eng.nodeCount++; return n; };
      this.bus = mk(ctx.createGain());
      if (def.tone && (def.tone.hi || def.tone.lo)) {       // the piece's own tone: the exploration pieces sit darker than the dramatic cues
        let n = this.bus;
        if (def.tone.hi) { const f = mk(ctx.createBiquadFilter()); f.type = 'highshelf'; f.frequency.value = 5000; f.gain.value = def.tone.hi; n.connect(f); n = f; }
        if (def.tone.lo) { const f = mk(ctx.createBiquadFilter()); f.type = 'lowshelf'; f.frequency.value = 120; f.gain.value = def.tone.lo; n.connect(f); n = f; }
        n.connect(eng.musicBus);
      } else this.bus.connect(eng.musicBus);
      this.verb = mk(ctx.createGain());
      const pre = mk(ctx.createDelay(0.2)); pre.delayTime.value = clamp((60 / def.bpm) / 16, 0.02, 0.09); this.verb.connect(pre); pre.connect(eng.hallIn);   // the room breathes with the bar
      this.stage = mk(ctx.createGain()); if (eng.stageIn) this.stage.connect(eng.stageIn);
      const spb = this.P.spb;
      this.delay = eng.makeDelay(spb * 0.75, spb, 0.42, 3200);
      this.delay.out.connect(this.bus);
      const dv = mk(ctx.createGain()); dv.gain.value = 0.3; this.delay.out.connect(dv); dv.connect(this.verb);
      this.layers = {};
      const fx = def.fx || {}, mix = def.mix || {};
      this.choruses = [];
      for (const name in LAYERS) {
        const L = LAYERS[name], inG = mk(ctx.createGain()), sv = mk(ctx.createGain()), sd = mk(ctx.createGain()), ss = mk(ctx.createGain());
        const ov = (def.sends && def.sends[name]) || {};                                   // a piece's own send levels for one layer (dry drums for a march)
        const eraE = eraOf(def, this.o.era !== undefined ? this.o.era : S.era);                 // the room stays (it is what makes the recordings real); the echoes tighten
        sv.gain.value = num(ov.verb, L.verb) * num(fx.verb, 1) * (1 - 0.08 * eraE); sd.gain.value = num(ov.dly, L.dly) * num(fx.dly, 1) * (1 - 0.55 * eraE); ss.gain.value = num(ov.stage, num(L.stage, 0)) * num(fx.stage, 1);
        const strip = eng.makeStrip ? eng.makeStrip(name) : null, post = strip ? strip.out : inG;
        if (strip) { inG.connect(strip.in); this.choruses.push(strip); }
        post.connect(this.bus); post.connect(sv); sv.connect(this.verb); post.connect(sd); sd.connect(this.delay.in); post.connect(ss); ss.connect(this.stage);
        const chAmt = num(L.chorus, 0) * num(fx.chorus, 1);
        if (chAmt > 0 && eng.makeChorus) {              // ensemble chorus: wet copy beside the dry signal (also feeds the hall a little)
          const ch = eng.makeChorus(), cg = mk(ctx.createGain()); cg.gain.value = chAmt;
          post.connect(ch.in); ch.out.connect(cg); cg.connect(this.bus); cg.connect(sv);
          this.choruses.push(ch);
        }
        this.layers[name] = { in: inG, level: L.lvl * num(mix[name], 1), i0: L.i0 };
        inG.gain.value = this.layers[name].i0 !== undefined ? 0 : this.layers[name].level;
      }
      const gate = def.gate || {};
      for (const name in gate) { const L = this.layers[name]; if (L && L.i0 === undefined && gate[name] > 0) { L.i0 = gate[name]; L.in.gain.value = 0; } }
      this.trim = num(def.trim, DEFAULT_TRIM) * MIX_TRIM;
      this.applyIntensity(this.intensity, true);
      this.pass = null; this.passNo = -1; this.idx = 0; this.t0 = 0; this.skipBefore = -1e9; this.shift = 0;
      const rnd = () => (eng.offline ? eng.rand() : Math.random());
      this.form0 = def.forms && def.forms.length ? Math.floor(rnd() * def.forms.length) : 0;   // which long block opens this performance
      this.alt0 = def.alts && def.alts.length ? Math.floor(rnd() * def.alts.length) : 0;        // and which instrumentation
      this.take = Math.floor(rnd() * 8);                                                        // and which reading of the small variations
      this.era = eraOf(def, this.o.era !== undefined ? this.o.era : S.era);                       // how contentious the game is, read once per performance
      this.stretch = (def.rubato ? 1 + (rnd() * 2 - 1) * def.rubato : 1) * (1 + 0.045 * this.era); // a performance is never at exactly the written tempo; tenser eras lift it a little
      this.schedDone = false; this.endAt = Infinity;
    }
    now() { return this.eng.now(); }
    // the next bar (or beat) boundary of this performance, capped so a switch never waits more than a few seconds
    nextBoundary(kind) {
      const now = this.eng.ctx.currentTime, unit = (kind === 'beat' ? this.P.spb : this.P.meter * this.P.spb) * this.stretch;
      if (!this.pass || this.stopped) return now;
      const base = this.pass.start - this.shift, k = Math.ceil((now - base + 0.06) / unit);
      return Math.min(base + k * unit, now + (kind === 'beat' ? 1.5 : 4.5));
    }
    // the first bar line at or after `time` in this performance (never past its end): where the next piece enters
    boundaryAfter(time) {
      if (!this.pass) return time;
      const unit = this.P.meter * this.P.spb * this.stretch, base = this.pass.start - this.shift, end = this.pass.start + this.pass.len - this.shift;
      const k = Math.ceil((time - base - 0.02) / unit);
      return Math.min(end, Math.max(time, base + k * unit));
    }
    applyIntensity(x, immediate) {
      this.intensity = x;
      const t = this.eng.ctx.currentTime;
      // the room dries up as the fight escalates (full intensity keeps a third less hall); the stage stays
      if (!this.stopped) { try { const vg = this.verb.gain; vg.cancelScheduledValues(t); vg.setTargetAtTime(1 - 0.33 * x, t, immediate ? 0.01 : 2.0); } catch (e) { /* ignore */ } }
      for (const name in this.layers) {
        const L = this.layers[name]; if (L.i0 === undefined) continue;
        const target = L.level * smooth((x - L.i0) / 0.25), g = L.in.gain;
        try { g.cancelScheduledValues(t); if (immediate) g.setValueAtTime(target, t); else g.setTargetAtTime(target, t, 1.6); } catch (e) { g.value = target; }   // layers swell in over seconds, never per hit
      }
    }
    fadeIn(sec) {
      const t = this.eng.ctx.currentTime;
      K.fadeParam(this.bus.gain, 0, this.trim, t, sec, 'in');
      K.fadeParam(this.verb.gain, 0, 1 - 0.33 * this.intensity, t, sec, 'in'); K.fadeParam(this.stage.gain, 0, 1, t, sec, 'in');
    }
    fadeOut(sec) {
      if (this.stopped) return;
      this.stopped = true;
      const t = this.eng.ctx.currentTime;
      sec = Math.max(0.03, sec);
      K.fadeParam(this.bus.gain, this.bus.gain.value, 0, t, sec, 'out');
      K.fadeParam(this.verb.gain, this.verb.gain.value, 0, t, sec, 'out'); K.fadeParam(this.stage.gain, this.stage.gain.value, 0, t, sec, 'out');
      this.killAt = t + sec + 0.15;
    }
    begin(t0) { this.t0 = t0; this.nextPass(); }
    nextPass() {
      this.passNo++;
      const prevEnd = this.pass ? this.pass.start + this.pass.len : this.t0;
      this.pass = compilePass(this.def, this.passNo, this.form0, this.alt0, this.take, this.era); this.pass.start = prevEnd; this.idx = 0;
      if (this.stretch !== 1) this.pass.len *= this.stretch;
    }
    fire(ev, T) {
      const L = this.layers[ev.ly]; if (!L) return;
      if (this.only && !this.only[ev.ly]) return;
      if (L.i0 !== undefined && this.intensity < L.i0 - 0.02) return;
      const o = this.stretch === 1 || !ev.o || !ev.o.dur ? ev.o : Object.assign({}, ev.o, { dur: ev.o.dur * this.stretch });
      const v = V[ev.v](this.eng, L.in, T, o);
      if (v) this.live.add(v);
      if (ev.ly === 'lead' && o && o.dur > 0.2) this.duckBeds(T, o.dur);
    }
    // the mixer's hand on the faders: while the melody sounds, the pad and choir beds sit 2 dB back and come up again after it
    duckBeds(T, dur) {
      for (const name of ['pad', 'pad2', 'choir', 'choir2', 'arp', 'arp2']) {
        const L = this.layers[name]; if (!L || L.i0 !== undefined) continue;
        const g = L.in.gain, lv = L.level, k = name.indexOf('arp') === 0 ? 0.84 : 0.79;
        try { g.setTargetAtTime(lv * k, T, 0.06); g.setTargetAtTime(lv, T + dur, 0.3); } catch (e) { /* ignore */ }
      }
    }
    // schedule every event whose (shifted) time is < wEnd
    scheduleUntil(wEnd) {
      if (this.schedDone) return;
      const off = this.shift;
      for (let guard = 0; guard < 8; guard++) {
        const evs = this.pass.events;
        while (this.idx < evs.length) {
          const ev = evs[this.idx], T = this.pass.start + ev.t * this.stretch - off;
          if (T >= wEnd) return;
          this.idx++;
          if (T < this.skipBefore) continue;
          if (!this.eng.offline && T < this.eng.ctx.currentTime - 0.1) continue;
          try { this.fire(ev, T); } catch (e) { if (!this.errLogged) { this.errLogged = true; console.warn('[music] voice error in ' + this.id, e); } }
        }
        if (this.loop) this.nextPass();
        else { this.schedDone = true; this.endAt = this.pass.start + this.pass.len - off; return; }
      }
    }
    tick(now, look) {
      if (this.disposed) return;
      for (const v of this.live) if (v.dead) this.live.delete(v);
      if (this.stopped) { if (now >= this.killAt) this.finished = true; return; }
      this.scheduleUntil(now + look);
      if (this.schedDone && now > this.endAt + 5) this.finished = true;
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const v of Array.from(this.live)) v.dispose();
      this.live.clear();
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
      this.eng.nodeCount -= this.nodes.length; this.nodes.length = 0;
      this.delay.dispose();
      for (const ch of this.choruses || []) ch.dispose();
    }
  }

  // ================================================================== scheduler + public API
  // Lookahead: 180 ms while the tab is visible (25 ms timer). Hidden tabs get their timers throttled to >= 1 Hz (and to one
  // wake-up a minute after five minutes in Chrome), so we schedule 2.5 s ahead while hidden, re-tick at once on visibilitychange,
  // and after any late tick keep a bigger window for a while (the gap we just saw, times 1.5).
  const LOOK_VISIBLE = 0.18, LOOK_HIDDEN = 2.5;
  let lastTickMs = 0, lookBoost = 0, lookBoostUntil = 0;
  function ensureTimer() { if (!S.timer) { S.timer = setInterval(tickAll, 25); lastTickMs = 0; } }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (S.timer) tickAll(); });
  function tickAll() {
    try {
      const eng = A.engine;
      if (!eng) return;
      const ms = Date.now();
      if (lastTickMs && ms - lastTickMs > 400) { lookBoost = Math.min(3, (ms - lastTickMs) / 1000 * 1.5); lookBoostUntil = ms + 10000; }
      else if (ms > lookBoostUntil) lookBoost = 0;
      lastTickMs = ms;
      const now = eng.ctx.currentTime, look = Math.max((typeof document !== 'undefined' && document.hidden) ? LOOK_HIDDEN : LOOK_VISIBLE, lookBoost);
      S.ticks++;
      if (S.cur) {
        S.cur.tick(now, look);
        if (S.playlist) playlistCheck(now);
        if (S.cur && S.cur.finished && !S.playlist) { const p = S.cur; S.cur = null; p.dispose(); }
      }
      for (let i = S.old.length - 1; i >= 0; i--) { const p = S.old[i]; p.tick(now, look); if (p.finished) { p.dispose(); S.old.splice(i, 1); } }
      if (S.ticks % 40 === 0) eng.sweep(now);
      if (S.plWait && now >= S.plWait.at) { const w = S.plWait; S.plWait = null; startTrack(w.id, { fade: w.fade, loop: false, keepPlaylist: true, quantize: false }); }
      if (S.switchAt && now >= S.switchAt.at - 0.03) { const w = S.switchAt; S.switchAt = null; startTrack(w.id, w.opts); }
      if (!S.cur && !S.old.length && !S.plWait && !S.switchAt) { clearInterval(S.timer); S.timer = null; }
    } catch (e) { console.warn('[music] tick failed', e); }
  }

  // The rotation is a programme, not a jukebox: a piece crossfades into a short interlude (one of the hidden 'drift' templates, re-rooted to
  // the key of the piece that follows, never the same template twice running) and the interlude into the next piece, so the music never
  // stops; a gap (a number or [lo, hi] seconds) is available for moods that want a breath. A reshuffle never repeats the piece just heard and
  // keeps pieces in the same key apart.
  function playlistCheck(now) {
    const pl = S.playlist, p = S.cur;
    if (!pl || !p || !p.schedDone || pl.advancing) return;
    if (S.switchAt) return;
    if (p.endAt - now <= pl.fade + 5) {
      pl.advancing = true;
      let id, gap = pl.gap;
      if (pl.queued) { id = pl.queued; pl.queued = null; gap = pl.gapIn; }      // the piece the interlude was leading into
      else {
        pl.i = (pl.i + 1) % pl.order.length;
        if (pl.i === 0 && pl.shuffle) pl.order = composeOrder(pl, pl.order[pl.order.length - 1]);
        id = pl.order[pl.i];
        if (pl.between && Math.random() < pl.betweenP) {
          const pool = pl.between.length > 1 ? pl.between.filter(t => t !== pl.lastTpl) : pl.between, tpl = pool[Math.floor(Math.random() * pool.length)];   // never the same bridge twice running
          const d = interludeFor(tpl, id); if (d) { pl.lastTpl = tpl; pl.queued = id; id = d; gap = pl.gapIn; }
        }
      }
      const g = pickGap(gap);
      if (g > 0) { p.fadeOut(Math.max(0.5, p.endAt - now)); S.old.push(p); S.cur = null; S.plWait = { at: p.endAt + g, id: id, fade: 0.4 }; }
      else {
        // the seam: the new piece enters on a bar line of the old one, `fade` seconds (or less) before it ends, and fades in over that time;
        // the old piece is not cut — it plays its last bar and its final chord decays under the newcomer (a long fade that mostly happens
        // after its last note), so the cadence is heard and the hall carries one piece into the next
        const at = Math.min(p.endAt, p.boundaryAfter(Math.max(now + 0.1, p.endAt - pl.fade)));
        const inFade = clamp(p.endAt - at + 1.5, 2.5, pl.fade), oldFade = (p.endAt - at) + 6;
        S.switchAt = { id, opts: { fade: pl.fade, inFade, oldFade, loop: false, keepPlaylist: true, quantize: false }, at };
        ensureTimer();
      }
    }
  }
  const pickGap = g => (Array.isArray(g) ? g[0] + Math.random() * (g[1] - g[0]) : num(g, 0));
  // one cycle of the programme: the regular pieces shuffled, and each rare piece slipped in with probability pl.rare.p, never beside another
  function composeOrder(pl, last) {
    const a = shuffled(pl.ids, last);
    if (pl.rare) {
      const isRare = id => id !== undefined && pl.rare.ids.indexOf(id) >= 0;
      const pOf = id => (typeof pl.rare.p === 'object' ? num(pl.rare.p[id], 0.35) : pl.rare.p) * (0.4 + 1.2 * S.era);   // rarer in a quiet galaxy, likelier in a contentious one
      for (const id of pl.rare.ids) if (Math.random() < pOf(id)) for (let tries = 0; tries < 10; tries++) {
        const k = 1 + Math.floor(Math.random() * a.length);
        if (!isRare(a[k - 1]) && !isRare(a[k]) && !(k === 1 && last === id)) { a.splice(k, 0, id); break; }
      }
    }
    return a;
  }
  const rootOf = id => (TRACKS[id] ? TRACKS[id].root : null);
  // a shuffle that never opens with `last` and keeps two pieces in the same key apart (tries a dozen times, then takes what it has)
  function shuffled(ids, last) {
    let a = ids.slice();
    for (let tries = 0; tries < 12; tries++) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
      if (a.length < 2) break;
      let ok = a[0] !== last;
      for (let i = 1; ok && i < a.length; i++) if (rootOf(a[i]) === rootOf(a[i - 1])) ok = false;
      if (ok && last !== undefined && rootOf(a[0]) === rootOf(last) && a.length > 2) ok = false;
      if (ok) break;
    }
    return a;
  }
  // the drift's four chords in each mode (re-spelling the major-key template would put diminished chords on the lydian and dorian steps)
  const DRIFT_PROG = {
    major: 'I:2 IV:2 vi:2 V:2', lydian: 'IM7:2 II:2 vi:2 IM7:2', mixolydian: 'I:2 bVII:2 v:2 IV:2', dorian: 'i:2 IV:2 bVII:2 i:2',
    minor: 'i:2 bVI:2 bVII:2 i:2', phrygian: 'i:2 bII:2 bVI:2 i:2', harmonic: 'i:2 iv:2 bVI:2 V:2', melodic: 'i:2 IV:2 bVI:2 V:2',
  };
  // the interlude for the piece that follows: the template transposed to its key and mode (cached as a hidden track 'drift:<id>')
  function interludeFor(template, nextId) {
    const T = TRACKS[template], N = TRACKS[nextId];
    if (!T || !N || N.interlude) return null;
    const id = template + ':' + nextId;
    if (TRACKS[id]) return id;
    const d = JSON.parse(JSON.stringify(T)); delete d._p; delete d.id;
    d.root = N.root; d.mode = SCALES[N.mode || 'major'].length === 7 ? (N.mode || 'major') : 'major';
    const oldScale = SCALES[T.mode || 'major'], newScale = SCALES[d.mode], prog = DRIFT_PROG[d.mode];
    for (const sct of d.sec) {
      const toks = String(sct.prog).replace(/\|/g, ' ').trim().split(/\s+/);
      sct.prog = toks.length > 1 && prog ? prog : toks.map(t => respell(t, oldScale, newScale)).join(' ');   // the consonant walk of each mode; a lone chord is simply re-spelled
    }
    if (N.tonic !== undefined) d.tonic = N.tonic; else if (N.oct) d.oct = N.oct;
    d.hidden = true; d.interlude = true; d.desc = (T.desc || template) + ' (in the key of ' + nextId + ')';
    return Track(id, d).id;
  }

  // Switches happen on the bar (opts.quantize 'bar', the default; 'beat' for urgent cues; false = now) with long crossfades, so a
  // change of scene reads as a phrase ending rather than a jump cut.
  function startTrack(id, opts) {
    const def = TRACKS[id], eng = A.engine, fade = num(opts.fade, 3.5);
    if (opts.quantize !== false && S.cur && !S.cur.stopped && S.cur.id !== id) {
      const at = S.cur.nextBoundary(opts.quantize || 'bar');
      if (at - eng.ctx.currentTime > 0.1) { S.switchAt = { id, opts: Object.assign({}, opts, { quantize: false }), at }; if (!opts.keepPlaylist) { S.playlist = null; S.plWait = null; } ensureTimer(); return true; }
    }
    S.switchAt = null;
    if (!opts.keepPlaylist) { S.playlist = null; S.plWait = null; }
    const p = new Player(eng, def, { loop: opts.loop !== false, intensity: S.intensity });
    if (S.cur) { S.cur.fadeOut(num(opts.oldFade, fade)); S.old.push(S.cur); }    // oldFade: let a piece that is ending ring out under the next one
    S.cur = p;
    p.fadeIn(num(opts.inFade, fade));
    p.begin(eng.ctx.currentTime + 0.1);
    if (S.playlist) S.playlist.advancing = false;
    ensureTimer();
    return true;
  }

  Music.play = function (id, opts) {
    try {
      opts = opts || {};
      if (!TRACKS[id]) { console.warn('[music] unknown track "' + id + '"'); return false; }
      if (!A.isReady()) {
        S.pending = { id: id, opts: opts };
        A.onReady(() => { const p = S.pending; if (p) { S.pending = null; Music.play(p.id, p.opts); } });
        return 'pending';
      }
      if (S.cur && S.cur.id === id && !S.cur.stopped && !opts.restart) { S.switchAt = null; return true; }
      return startTrack(id, opts);
    } catch (e) { console.warn('[music] play failed', e); return false; }
  };
  Music.stop = function (opts) {
    try {
      opts = opts || {};
      S.pending = null; S.playlist = null; S.plWait = null; S.switchAt = null;
      if (S.cur) { S.cur.fadeOut(num(opts.fade, 3)); S.old.push(S.cur); S.cur = null; }
      return true;
    } catch (e) { console.warn('[music] stop failed', e); return false; }
  };
  Music.current = () => (S.switchAt ? S.switchAt.id : S.cur && !S.cur.stopped ? S.cur.id : (S.pending ? S.pending.id : null));
  Music.list = function () {
    return Object.keys(TRACKS).filter(id => !TRACKS[id].hidden).map(id => {
      const d = TRACKS[id], P = prepare(d), bars = loopBars(d, P), intro = P.secs.slice(0, P.loopIdx).reduce((a, s) => a + s.bars, 0);
      return { id, desc: d.desc, bpm: d.bpm, seconds: Math.round(bars * P.meter * P.spb), introSeconds: Math.round(intro * P.meter * P.spb) };
    });
  };
  Music.playlist = function (ids, opts) {
    try {
      opts = opts || {};
      ids = (ids || Object.keys(TRACKS)).filter(id => TRACKS[id]);
      if (!ids.length) return false;
      const pl = {
        ids, shuffle: !!opts.shuffle, gap: Array.isArray(opts.gap) ? opts.gap.slice() : num(opts.gap, 1.5), fade: num(opts.fade, 3), order: opts.shuffle ? shuffled(ids) : ids.slice(), i: 0, advancing: false,
        between: opts.between ? [].concat(opts.between).filter(t => TRACKS[t]) : null, betweenP: num(opts.betweenP, 0.5), gapIn: Array.isArray(opts.gapIn) ? opts.gapIn.slice() : num(opts.gapIn, 0), queued: null, lastTpl: null,
      };
      if (pl.between && !pl.between.length) pl.between = null;
      if (opts.rare) { const ids = [].concat(opts.rare.ids || opts.rare).filter(id => TRACKS[id] && pl.ids.indexOf(id) < 0); pl.rare = ids.length ? { ids, p: typeof opts.rare.p === 'object' ? Object.assign({}, opts.rare.p) : num(opts.rare.p, 0.35) } : null; }
      if (pl.shuffle) pl.order = composeOrder(pl);
      if (opts.start && pl.rare && pl.rare.ids.indexOf(opts.start) >= 0 && pl.order.indexOf(opts.start) < 0) pl.order.unshift(opts.start);   // restored mid-rare-piece: come back to it
      if (opts.start && pl.order.indexOf(opts.start) >= 0) {           // begin with a given track (the rest keeps its order / shuffle)
        const k = pl.order.indexOf(opts.start);
        pl.order = pl.shuffle ? [opts.start].concat(pl.order.filter(id => id !== opts.start)) : pl.order.slice(k).concat(pl.order.slice(0, k));
      }
      const first = pl.order[0];
      if (!A.isReady()) { S.pending = { id: first, opts: { loop: false } }; S.playlist = pl; A.onReady(() => { const p = S.pending; if (p) { S.pending = null; startTrack(p.id, { fade: 1, loop: false, keepPlaylist: true }); } }); return 'pending'; }
      S.playlist = pl;
      return startTrack(first, { fade: num(opts.firstFade, 1.5), loop: false, keepPlaylist: true });
    } catch (e) { console.warn('[music] playlist failed', e); return false; }
  };
  Music.setIntensity = function (x) {
    x = clamp(Number(x) || 0, 0, 1);
    S.intensity = x;
    if (S.cur) S.cur.applyIntensity(x, false);
    for (const p of S.old) p.applyIntensity(x, false);
  };
  Music.getIntensity = () => S.intensity;
  // the era: 0 alone and early .. 1 contentious; read when the next exploration performance is compiled, never applied to a running one
  Music.setEra = function (x) { S.era = clamp(Number(x) || 0, 0, 1); };
  Music.getEra = () => S.era;
  Music.has = id => !!TRACKS[id];
  Music.onSamplesReady = function () {
    const p = S.cur; if (!p || p.stopped || !A.engine) return;
    const elapsed = A.engine.ctx.currentTime - p.t0;
    if (elapsed >= 0 && elapsed < 14) startTrack(p.id, { fade: 2.5, loop: p.loop, keepPlaylist: true, quantize: false });
  };

  // A scene that borrows the music (GNN, lab, spy panels) takes a snapshot first and restores it afterwards: a running playlist
  // (the galaxy rotation) comes back as a playlist, a single looping track as that track, silence as silence.
  Music.snapshot = function () {
    const pl = S.playlist;
    return { id: Music.current(), playlist: pl ? { ids: pl.ids.slice(), shuffle: pl.shuffle, gap: pl.gap, gapIn: pl.gapIn, fade: pl.fade, between: pl.between, betweenP: pl.betweenP, rare: pl.rare, start: pl.queued || (S.plWait && S.plWait.id) || pl.order[pl.i] } : null };
  };
  Music.restore = function (snap, opts) {
    try {
      opts = opts || {};
      const fade = num(opts.fade, 1.5);
      if (!snap) return Music.stop({ fade });
      if (snap.playlist) { const pl = snap.playlist; return Music.playlist(pl.ids, { shuffle: pl.shuffle, gap: pl.gap, gapIn: pl.gapIn, fade: pl.fade, between: pl.between, betweenP: pl.betweenP, rare: pl.rare, start: pl.start, firstFade: fade }); }
      if (snap.id) return Music.play(snap.id, { fade });
      return Music.stop({ fade });
    } catch (e) { console.warn('[music] restore failed', e); return false; }
  };

  // Moods: game-level names -> tracks (lists rotate so repeated requests do not replay the same piece)
  const GALAXY = ['galaxy4', 'galaxy1', 'galaxy11', 'galaxy5', 'galaxy2', 'galaxy13', 'galaxy8', 'galaxy3', 'galaxy12', 'galaxy7', 'galaxy6'];   // the exploration programme (eleven pieces, ~50 minutes before anything returns)
  // the first years, alone among the stars: the planetarium pieces only (big sky, synth pads, bells, no choir or drums), the pad and harp interludes
  const GALAXY_EARLY = ['galaxy4', 'galaxy8', 'galaxy1', 'galaxy11', 'galaxy5', 'galaxy13', 'galaxy7'];
  const MOODS = {
    title: 'title', menu: 'title', explore: GALAXY, galaxy: GALAXY, map: GALAXY, galaxyEarly: GALAXY_EARLY,
    calm: GALAXY, wonder: 'galaxy1', patient: 'galaxy2', determined: 'galaxy3', deep: 'galaxy4', veil: 'galaxy5', abyss: 'galaxy6', cradle: 'galaxy7', beacon: 'galaxy8', tide: 'galaxy9', chorale: 'galaxy10', orrery: 'galaxy11', passacaglia: 'galaxy12', watch: 'galaxy13', design: 'design', research: 'research', tech: 'research',
    combat: ['combat3', 'combat1', 'combat2'], battle: ['combat3', 'combat1', 'combat2'], tension: 'ground', ground: 'ground', news: 'gnn', gnn: 'gnn', council: ['council2', 'council'], procession: 'procession',
    orion: 'orion', antarans: 'antarans', victory: 'victory', defeat: 'defeat', spy: 'spy', espionage: 'spy', intrigue: 'spy',
  };
  // array moods listed here play as a shuffled playlist with a pause between pieces (the original's map was silent; a breath between
  // tracks keeps the exploration music from looping one piece for an hour). Others pick the next track of the list on each request.
  MOODS.galaxyWar = ['galaxy3', 'ground', 'procession', 'galaxy6', 'galaxy12', 'galaxy2', 'spy'];        // at war: the determined and uneasy pieces carry the map
  // the music never stops on the map: every piece crossfades into an interlude in the next piece's key, and that into the next piece
  const INTERLUDES = ['drift', 'drift2', 'drift3', 'drift4', 'drift5'];
  // the rare pieces (the tide, the chorale) are slipped into a cycle about a third of the time each; at war their readings with the synthetic hits, more often
  const CALM_ROT = { gap: 0, gapIn: 0, fade: 6, between: INTERLUDES, betweenP: 1, rare: { ids: ['galaxy9', 'galaxy10', 'procession'], p: { galaxy9: 0.35, galaxy10: 0.35, procession: 0.25 } } };   // the procession rarer still: an occasion
  const EARLY_ROT = { gap: 0, gapIn: 0, fade: 7, between: ['drift', 'drift2', 'drift4', 'drift5'], betweenP: 1 };
  const MOOD_ROTATE = { explore: CALM_ROT, galaxy: CALM_ROT, map: CALM_ROT, calm: CALM_ROT, galaxyEarly: EARLY_ROT, galaxyWar: { gap: 0, gapIn: 0, fade: 5, between: INTERLUDES, betweenP: 0.6, rare: { ids: ['galaxy9:war', 'galaxy10:war'], p: 0.6 } } };
  let moodTick = 0;
  Music.moods = () => Object.keys(MOODS).concat(Object.keys(TRACKS).filter(id => id.indexOf('race:') === 0));
  // setMood('combat' | 'explore' | 'council' | 'human' | 'race:human' | any track id, {fade, loop}) -> id of the track chosen (or false)
  Music.setMood = function (mood, opts) {
    try {
      let pick = MOODS[mood] || (TRACKS[mood] ? mood : (TRACKS['race:' + mood] ? 'race:' + mood : null));
      if (!pick) { console.warn('[music] unknown mood "' + mood + '"'); return false; }
      if (Array.isArray(pick)) {
        const cur = pick.indexOf(Music.current()), next = pick[cur >= 0 ? (cur + 1) % pick.length : (moodTick++) % pick.length], rot = MOOD_ROTATE[mood];
        if (rot) { const r = Music.playlist(pick, Object.assign({}, rot, { shuffle: true, start: next, firstFade: num(opts && opts.fade, 2) })); return r === false ? false : next; }
        pick = next;
      }
      const r = Music.play(pick, opts);
      return r === false ? false : pick;
    } catch (e) { console.warn('[music] setMood failed', e); return false; }
  };
  Music.state = function () { return { cur: S.cur && S.cur.id, old: S.old.length, timer: !!S.timer, intensity: S.intensity, era: S.era, pending: S.pending && S.pending.id, playlist: !!S.playlist }; };

  // Offline render of a track (windowed so the node graph stays small). opts: {from, intensity, sampleRate}
  Music.renderOffline = function (id, seconds, opts) {
    opts = opts || {};
    const def = TRACKS[id];
    if (!def) return Promise.reject(new Error('unknown track ' + id));
    let pl = null, stats = null;
    return A.renderWindowed(seconds, { sampleRate: opts.sampleRate || 44100, window: 1.5, seed: opts.seed || 1, teardown: eng => { stats = eng.stats; } }, function (eng, t0, t1) {
      if (!pl) {
        pl = new Player(eng, def, { loop: opts.loop !== false, intensity: num(opts.intensity, S.intensity), era: opts.era });
        pl.trim = num(def.trim, DEFAULT_TRIM) * MIX_TRIM * num(opts.gain, 1);
        pl.bus.gain.value = pl.trim; pl.verb.gain.value = 1;
        pl.shift = num(opts.from, 0); pl.skipBefore = 0;
        if (opts.only) { pl.only = {}; for (const k of [].concat(opts.only)) pl.only[k] = 1; }
        pl.begin(0);
      }
      pl.scheduleUntil(t1);
    }).then(buf => { buf.mooStats = stats; return buf; });
  };

  // ================================================================== analysis / lint (used by the test page)
  Music.analyze = function (id) {
    const def = TRACKS[id]; if (!def) return null;
    const P = prepare(def), r0 = compilePass(def, 0), r1 = compilePass(def, 1);
    const out = { id, bpm: def.bpm, meter: P.meter, key: def.root + ' ' + def.mode, warnings: P.warn.slice() };
    out.secs = []; let acc = 0;
    for (const w of r0.wraps) { out.secs.push({ n: w.R.n, bars: w.bars, at: Math.round(acc * 10) / 10 }); acc += w.bars * P.meter * P.spb; }
    out.introSec = Math.round(P.secs.slice(0, P.loopIdx).reduce((a, s) => a + s.bars, 0) * P.meter * P.spb * 10) / 10;
    out.loopSec = Math.round(r1.len * 10) / 10; out.firstSec = Math.round(r0.len * 10) / 10;
    const by = {};
    for (const ev of r0.events) { const b = by[ev.ly] || (by[ev.ly] = { n: 0, lo: 999, hi: 0 }); b.n++; if (ev.m) { if (ev.m < b.lo) b.lo = ev.m; if (ev.m > b.hi) b.hi = ev.m; } }
    out.layers = by;
    // lead lint: strong-beat chord-tone ratio, max leap, same-pass determinism of the melody
    let strong = 0, strongCT = 0, strongOK = 0, leaps = 0, maxLeap = 0, prev = null;
    const leads = r0.events.filter(e => e.k === 'lead' && e.m && e.bt > 0.1).sort((a, b) => a.b - b.b);
    const wr = r0.wraps;
    for (const e of leads) {
      const w = wr.filter(x => e.b >= x.start - 1e-9).pop();
      if (!w) continue;
      const sg = segAt(w.R.segs, e.b - w.start);
      const bis = (e.b - w.start) % P.meter, st = P.strong.some(x => Math.abs(bis - x) < 1e-6);
      if (st) { strong++; if (isChordTone(e.m, sg.ch)) { strongCT++; strongOK++; } else if (!clashes(e.m, sg.ch)) strongOK++; }
      if (prev !== null) { const d = Math.abs(e.m - prev); if (d > maxLeap) maxLeap = d; if (d > 9) leaps++; }
      prev = e.m;
    }
    out.lead = { notes: leads.length, strongCT: strong ? Math.round(1000 * strongCT / strong) / 1000 : null, strongOK: strong ? Math.round(1000 * strongOK / strong) / 1000 : null, maxLeap, bigLeaps: leaps };
    out.lintMin = def.lintMin || 0.85;
    out.events = r0.events.length; out.eventsPerSec = Math.round(r1.events.length / r1.len * 10) / 10;
    let same = r0.events.length > 0; // determinism check: recompiling pass 0 gives identical list
    const again = compilePass(def, 0);
    if (again.events.length !== r0.events.length) same = false; else for (let i = 0; i < again.events.length; i += 7) if (again.events[i].t !== r0.events[i].t || again.events[i].m !== r0.events[i].m) { same = false; break; }
    out.deterministic = same;
    // how much does pass 1 differ from pass 2? (share of events with no identical counterpart: layer, 1/16-beat slot, pitch)
    const p2 = compilePass(def, 2), keyOf = e => e.ly + '|' + Math.round(e.b * 16) + '|' + e.m + '|' + e.v, set2 = new Set(p2.events.map(keyOf));
    let miss = 0; for (const e of r1.events) if (!set2.has(keyOf(e))) miss++;
    out.variation = Math.round(1000 * miss / Math.max(1, r1.events.length)) / 1000;
    out.snaps = r0.snaps;
    return out;
  };
  Music._compile = (id, pass, form0, alt0, take, era) => compilePass(TRACKS[id], pass || 0, form0, alt0, take, era);
  Music._define = Track;                          // test hook: register a (hidden) track at run time
  Music._tracks = TRACKS; Music._INST = INST; Music._parseChord = parseChord;

  // @@TRACKS-BEGIN
  Track('title', {
    desc: 'Main theme — a hymn that opens on the organ with the men low beneath it and ends with the men’s choir carrying everything, the analogue synth around them, a pedal that sinks to the very deep octave; no drums',
    bpm: 70, root: 'D', mode: 'minor', loopFrom: 'A1', trim: 2.34, tens: false, tone: { lo: 1.0 }, mix: { choir: 1.45, pad: 1.0, lead: 0.75, bass: 1.15 },
    forms: [['A1', 'B', 'C', 'A2', 'E', 'C', 'A1', 'E'], ['A1', 'C', 'B', 'A2', 'C', 'E', 'A1', 'B', 'E']],
    alts: [{}, { choir2: 'choirWomen' }],
    inst: { pad: 'organ', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'strings', bell: 'glass', choir: 'ooh', choir2: 'aah', arp: 'strOst' },
    ph: {
      H1: '5:3 8:1 | 7:2 6:2 | 5:3 3:1 | 4:2 5:2',             // the hymn: rising fourth, falling step (the game's leitmotif), noble descent, half cadence
      H2: '5:3 8:1 | 9:2 10:2 | 8:2 7:1 6:1 | 5:4',
      H3: '8:2 10:2 | 12:3 11:1 | 10:2 9:1 8:1 | 7:2 5:2',      // the answer, a fifth higher
      H4: '6:2 8:2 | 10:2 9:1 8:1 | 5:3 6:1 | 8:4',
      CT: '1:2 3:2 | 2:2 1:2 | 4:2 3:2 | 2:3 r:1',             // low-brass counter-line under the march
      F1: '5:1 8:1 7:1 5:1 | 6:1 5:1 3:1 5:1 | 4:2 5:2 | 8:4', // flute, the interlude
    },
    sec: [
      { n: 'intro', bars: 8, cres: [0.56, 0.7], prog: 'i:2 bVI:2 i:2 bVII:1 V:1', pad: { p: 'swell', inst: 'organ', n: 4, reg: [45, 72], vel: 1.0 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [38, 60], vel: 0.5 }, bass: { pat: ['1---', '1---', '1---', 'c---'], pedal: true, inst: { p: 'deep', sub: 0.7, att: 0.6, rel: 1.8 } }, choir: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.42, soft: true },
        lead: { ph: 'r4 H1', inst: 'hornSolo', vel: 0.55 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.38 } },
      { n: 'A1', bars: 16, cres: [0.62, 0.8], prog: 'i bVII:.5 bVI:.5 i iv:.5 V:.5 | i V:.5 bIII:.5 i:.5 bVII:.5 V | i:.5 bVI:.5 i bIII:.5 V:.5 bVII:.5 V:.5 | bVI bIII:.5 V:.5 i i',
        pad: { p: 'sus', inst: 'organ', n: 4, reg: [45, 72], vel: 0.95 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [38, 60], vel: 0.6 }, bass: { pat: ['1---', '1---', 'c---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.4, rel: 1.6 } }, lead: { ph: 'H1 H2 H3 H4', vel: 0.7 },
        lead2: { ph: 'r8 H3 H4', inst: 'choirMen', oct: -1, vel: 0.55 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.6 }, bell: { dens: 0.07, res: 1, reg: [72, 96], vel: 0.36 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'i bVI bVII i iv bVI V V', cr: true, pad: { p: 'sus', inst: 'organ', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [43, 64], vel: 0.85 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.3, rel: 1.4 } },
        arp: { pat: '0.......2.......', res: 2, vel: 0.4, reg: [55, 79], gate: 0.9 },
        lead: { ph: 'CT CT', inst: 'cello', oct: -1, vel: 0.6, art: 0.95 }, lead2: { ph: 'H1 H2', inst: 'choirMen', oct: -1, vel: 0.7 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.8 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.5 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'bVI:2 iv:2 i:2 V:2', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [55, 79], vel: 0.6 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [43, 62], vel: 0.7 }, bass: { pat: ['c---', '1---'], inst: { p: 'deep', sub: 0.8, att: 1.2, rel: 2.4 } },
        lead: { ph: 'F1 F1', inst: 'flute', vel: 0.6 }, arp: { inst: 'harp', p: 'up8', vel: 0.5, reg: [55, 84] }, choir: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.55 }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.4 }, drums: false, timp: false, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.95, 1.08], prog: 'i bVII:.5 bVI:.5 i iv:.5 V:.5 | i V:.5 bIII:.5 i:.5 bVII:.5 V | i:.5 bVI:.5 i bIII:.5 V:.5 bVII:.5 V:.5 | bVI bIII:.5 V:.5 i i', cr: true,
        pad: { p: 'sus', inst: 'organ', n: 4, reg: [45, 72], vel: 0.5 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [43, 64], vel: 0.9 }, bass: { pat: ['c---', 'c---', '1---', 'c---'], inst: { p: 'deep', sub: 0.85, att: 0.3, rel: 1.4 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.4, reg: [55, 79], gate: 0.9 },
        lead: { ph: 'H1 H2 H3 H4', inst: 'horn', vel: 0.7, harm: -2 }, lead2: { ph: 'H1 H2 H3 H4', inst: 'choirMen', oct: -1, vel: 0.9 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.95 }, choir2: { inst: 'aah', n: 3, reg: [57, 76], vel: 0.6 },
        bell: { dens: 0.15, res: 1, reg: [76, 100], vel: 0.5 } },
      { n: 'E', bars: 8, lv: 0.68, prog: 'i bVI bVII i iv bVI V i', pad: { p: 'sus', n: 4, reg: [50, 76] }, pad2: { p: 'sus', inst: 'warm', n: 3, reg: [38, 60], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.6, rel: 2.0 } },
        lead: { ph: 'H4 H4', inst: 'hornSolo', vel: 0.6 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.7 }, bell: { dens: 0.07, res: 1, reg: [72, 96], vel: 0.36 } },
    ],
  });

  Track('galaxy4', {
    desc: 'Deep field — slow analogue pads under a high air pad, distant women’s voices, high strings that swell and fade, a celeste and harp as single points of light, a lone flute: the planetarium, in the Serrie manner',
    bpm: 50, trim: 4.48, tone: { hi: -2.5 }, root: 'A', mode: 'lydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.25 },
    forms: [['A1', 'breath1', 'B', 'breath2', 'C', 'breath3', 'E'], ['A1', 'breath1', 'C', 'breath2', 'B', 'breath3', 'E'], ['A1', 'breath2', 'B', 'breath1', 'E', 'breath3', 'C'], ['A1', 'C', 'breath1', 'B', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute', choir: 'choirMen' }, { lead: 'clarinet', lead2: 'cello', choir: 'cellos' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'flute', lead2: 'glass', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'ooh' },
    ph: {
      S1: '5:4 | 8:4 | 7:4 | 5:4', S2: '6:4 | 8:2 9:2 | 8:4 | 5:4', S3: '10:4 | 9:4 | 8:2 7:2 | 5:4', S4: '5:2 8:2 | 7:3 6:1 | 5:4 | 3:4',
      FL: '4:6 r:2 | 1:6 r:2 | 2:6 r:2 | 7:8',          // four slow notes, the Shine On shape, with the delay answering in the rests
      CL: '1:8 | 3:8 | 2:6 1:2 | 5:8',
      CM: '1:8 | 2:8 | 3:6 2:2 | 1:8',                    // the men, one sung phrase, low and slow                    // the cello: long, low, patient
    },
    sec: [
      { n: 'intro', bars: 8, cres: [0.45, 0.58], prog: 'IM7:4 II:4', pad: { p: 'swell', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.62 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.35 } },
      { n: 'A1', bars: 16, lv: 0.56, prog: 'IM7:4 II:4 | IM7:4 vi:4 | IM7:4 II:4 | V:4 IM7:4', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.62 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['S1 r8 S2', 'S2 r8 S1', 'r4 S3 r4 S4', 'S1 r4 S4'], vel: 0.45 }, choir: { n: 2, reg: [67, 81], vel: 0.35, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.32, soft: true }, arp: { pat: '0...2...1...3...', res: 1, vel: 0.4, reg: [57, 84], skip: 0.3 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.35 } },
      { n: 'breath1', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },   // nothing but the hall and, perhaps, one bell
      { n: 'B', bars: 16, lv: 0.58, prog: 'vi:4 II:4 | IM7:4 V:4 | vi:4 II:4 | IM7:4 II:4', pad: { p: 'sus', n: 4, reg: [48, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['r4 FL r8', 'FL r8 S4', 'r8 FL', 'r2 FL r2 S3'], inst: 'glass', vel: 0.45, echo: 0.3 }, lead2: { ph: ['r8 CL', 'r4 CL r4', 'CL r4 CL'], inst: 'cello', oct: -1, vel: 0.5, skip: 0.25 }, choir: { n: 2, reg: [67, 81], vel: 0.35, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.36, soft: true }, bell2: { ph: ['r8 CM', 'r4 CM', 'CM r8'], inst: 'choirMen', oct: -1, vel: 0.36, skip: 0.3 }, arp: { pat: '0.......2.......', res: 1, vel: 0.38, reg: [57, 84] }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'C', bars: 8, lv: 0.38, prog: 'IM7:4 II:4', pad: { p: 'swell', inst: 'strings', n: 3, reg: [52, 76] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.5 }, bass: false, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.3, soft: true }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath3', bars: 1, lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'IM7:4 II:4 | IM7:4 V:4', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.62 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['r4 S1', 'S4 r4', 'r2 FL r2'], vel: 0.42 }, lead2: { ph: ['r4 CL', 'CL r4'], inst: 'cello', oct: -1, vel: 0.45, skip: 0.4 }, arp: { pat: '0...2...1...3...', res: 1, vel: 0.36, reg: [57, 84] }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.35 } },
    ],
  });

  Track('combat3', {
    desc: 'Battle — driving spiccato string ostinato, low-brass stabs, bass drum and snare, men’s choir, and the main theme hammered out by horns and full brass as the fight escalates',
    bpm: 118, trim: 1.49, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, choir: 0.3, lead: 0.42, bell: 0.6 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A1', 'C', 'B1', 'A2', 'B2', 'C'], ['A1', 'C', 'B1', 'A2', 'B2', 'C', 'A1', 'B1', 'B2', 'A2', 'C']],
    inst: { pad: 'lowBrass', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'brass', arp: 'strOst', bell: 'bell', choir: 'ooh' },
    ph: {
      B1: '5:1.5 8:.5 7:1 6:1 | 5:2 3:2 | 4:1.5 5:.5 6:1 4:1 | 5:4',
      B2: '5:1.5 8:.5 9:1 10:1 | 8:2 7:1 6:1 | 5:1.5 6:.5 5:1 4:1 | 3:2 5:2',
      B3: '8:.5 8:.5 8:1 10:1 7:1 | 8:.5 8:.5 8:1 5:1 3:1 | 4:1 5:1 6:1 8:1 | 7:2 5:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.62, prog: 'i', hit: 'tam', pad2: { p: 'sus', inst: 'analog', n: 3, reg: [38, 57], vel: 0.9 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.6, reg: [50, 62], gate: 0.7 }, drums: { bd: 'x.......x.......' }, timp: 'hits' },
      { n: 'A1', bars: 16, lv: 0.8, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2', vel: 0.85 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, fill: 'rollS' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 0.95, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.75 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.75, reg: [55, 79], gate: 0.9, jump: 0.05 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B3 B3', inst: 'brass', vel: 1.0, harm: -2 },
        lead2: { ph: 'B1 B2 B1 B2', inst: 'strings', oct: 1, vel: 0.55 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.0 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.75 }, fill: 'bigS' },
      { n: 'A2', bars: 16, lv: 0.88, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9, jump: 0.06 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2', vel: 0.88, harm: -2 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'rollS' },
      { n: 'C', bars: 8, lv: 0.45, prog: 'i:2 bVI:2 bVII:2 V:2', pad2: { p: 'sus', inst: 'strTrem', n: 4, reg: [55, 79], vel: 0.65 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.5, reg: [50, 62], gate: 0.7 },
        drums: { bdSoft: 'x...............', t5: '........x.......' }, timp: { p: 'hits', roll: 2 }, choir: { inst: 'choirMen', n: 3, reg: [40, 57], vel: 0.6 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.15, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', hit: true, cr: true, pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 1.0, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 81], vel: 0.8 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.78, reg: [55, 81], gate: 0.9, jump: 0.08 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B1 B2', inst: 'brass', vel: 1.0, harm: -2 },
        lead2: { ph: 'B3 B3 B1 B2', inst: 'strings', oct: 1, vel: 0.6 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.05 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.8 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'bigS' },
    ],
  });

  Track('galaxy1', {
    desc: 'Calm exploration, wonder: airy flute, glassy bells and a floating lydian pad',
    bpm: 56, trim: 2.25, tone: { hi: -2.5 }, root: 'G', mode: 'lydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.2, verb: 1.25 },
    forms: [['A1', 'A2', 'breath1', 'B', 'C', 'breath2', 'A3', 'B2', 'breath3', 'E'], ['A1', 'B', 'breath1', 'C', 'breath2', 'A2', 'B2', 'E'], ['A1', 'A2', 'C', 'breath2', 'B', 'breath1', 'A3', 'E'], ['A1', 'breath1', 'B', 'A2', 'breath2', 'C', 'breath3', 'B2', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute', choir: 'choirMen' }, { lead: 'oboe', lead2: 'cello', arp: 'harp' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead2: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'flute', lead2: 'glass', bell: 'glass', arp: 'vibes', choir: 'choirWomen' },
    ph: {
      W1: '5:3 8:1 | 7:2 5:2 | 6:3 5:1 | 4:2 3:2',
      W2: '5:2 7:1 8:1 | 10:3 8:1 | 8:2! 7:1 5:1 | 5:4',
      W3: '6:3 8:1 | 10:2 9:1 8:1 | 7:3 6:1 | 4:4',
      W4: '8:2 5:2 | 7:3 5:1 | 5:2 6:1 7:1 | 7:4',
      C1: '10:4 | 9:4 | 8:4! | 7:4',
      FL: '4:6 r:2 | 1:6 r:2 | 2:6 r:2 | 7:8',
      CM: '1:8 | 2:8 | 3:6 2:2 | 1:8',
      C2: '5:4 | 7:4 | 6:4 | 4:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.45, prog: 'IM7:2 II:2', pad: { p: 'swell' }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.62 }, bell: { dens: 0.14, res: 1, vel: 0.4 } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'IM7:2 II:2 iii:2 V:2', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, lead: { ph: ['W1 r4', 'r2 W1 r2', 'W2 r4', 'W1 W4'] }, bell: { dens: 0.12, res: 1, vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'IM7:2 II:2 iii:2 V:2', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, arp: { pat: '0.2.1.3.', res: 1, vel: 0.4, reg: [62, 86], skip: 0.3 }, lead: { ph: ['W1 W2', 'W4 W2', 'W1 W3'] }, bell: { dens: 0.14, res: 1, vel: 0.45 }, choir: { vel: 0.4, soft: true } },
      { n: 'breath1', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.08, res: 1, vel: 0.35 } },
      { n: 'B', bars: 8, lv: 0.66, prog: 'vi:2 II:2 IM7:2 V:2', pad: 'sus', bass: 'whole', arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [64, 91] }, lead: { ph: ['W3 W4', 'W3 W1', 'W4 W3'] }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.4, skip: 0.35 }, bell: { dens: 0.12, res: 1, vel: 0.45 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'vi:2 V:2 IM7:2 II:2', pad: { p: 'swell' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.6 }, bass: false, lead: { ph: ['FL C2', 'C2 FL', 'FL r4'], inst: 'cello', oct: -1, vel: 0.62 }, bell2: { ph: ['r8 CM', 'r4 CM'], inst: 'choirMen', oct: -1, vel: 0.34, skip: 0.3 }, choir: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.32, soft: true }, bell: { dens: 0.18, res: 1, vel: 0.4 }, choir2: { v1: 'u', v2: 'o', vel: 0.4, skip: 0.4 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'IM7:2 II:2 iii:2 V:2', pad: 'sus', pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: 'whole', arp: { pat: '0...2...1...3...', res: 1, vel: 0.34, reg: [62, 88] }, lead: { ph: ['W1 W2', 'W1 W3'], harm: -2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.4, skip: 0.3 }, choir: { vel: 0.7 }, bell: { dens: 0.3, res: 2 } },
      { n: 'B2', bars: 8, lv: 0.72, prog: 'vi:2 II:2 IM7:2 V:2', pad: 'sus', pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: 'whole', arp: { pat: '0.......2.......', res: 1, vel: 0.32, reg: [64, 93] }, lead: { ph: ['W3 W4', 'W4 W2'], harm: -2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.45 }, choir: { v1: 'a', v2: 'a', vel: 0.75 }, bell: { dens: 0.35, res: 2 } },
      { n: 'breath3', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'E', bars: 8, lv: 0.6, prog: 'IM7:2 II:2 IM7:2 V:2', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, lead: { ph: ['W1 W4', 'W2 W4', 'r2 W4'] }, bell: { dens: 0.2, res: 2, vel: 0.45 } },
    ],
  });

  Track('galaxy2', {
    desc: 'Calm exploration, patience: marimba ostinato, plucked reed melody, warm dorian pad',
    bpm: 60, trim: 1.97, tone: { hi: -2.5 }, root: 'D', mode: 'dorian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.0, verb: 1.2 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2'], ['A1', 'B', 'C', 'breath', 'A2', 'B2'], ['A1', 'A2', 'C', 'breath', 'B', 'A3'], ['A1', 'C', 'breath', 'A2', 'B2', 'A3']],
    alts: [{}, { lead: 'cello', lead2: 'glass' }, { lead: 'clarinet', lead2: 'cello' }], eraAlts: { pad: 'cellos', lead: 'cello' },
    inst: { pad: 'warm', bass: 'deep', lead: 'reed', lead2: 'vibes', bell: 'vibes', arp: 'marimba' },
    ph: {
      P1: '5:1.5 6:.5 8:2 | 8:1.5 7:.5 6:2 | 5:2 3:2 | 4:1 5:1 6:2',
      P2: '7:2 5:2 | 4:2 6:2 | 5:2 8:2 | 8:3 r:1',
      P3: '9:2 8:1 7:1 | 5:2 7:2 | 8:2 6:1 4:1 | 6:2 5:2',
      P4: '8:2 10:2 | 9:2 7:2 | 8:2 6:2 | 5:2 1:2',
      Q1: '5:4 | 6:4 | 8:4 | 5:4',
      Q2: '4:4 | 3:4 | 5:4 | 1:4',
      CM: '1:8 | 2:8 | 3:6 2:2 | 1:8',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 IV:2', pad: { p: 'swell' }, arp: { pat: '0.2.', res: 1, vel: 0.36, reg: [57, 76] } },
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: 'sus', bass: 'half', arp: { pat: '0.2.', res: 1, vel: 0.4, reg: [57, 76] }, lead: { ph: ['P1 P2', 'P1 P4', 'P3 P2'] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: 'sus', bass: 'half', arp: { pat: '0.2.', res: 1, vel: 0.4, reg: [57, 76] }, lead: { ph: ['P1 P2', 'P4 P2'] }, bell: { dens: 0.25, res: 2, reg: [76, 93], vel: 0.45, skip: 0.3 } },
      { n: 'B', bars: 8, lv: 0.68, prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.6 }, bass: 'whole', arp: { pat: '0.1.', res: 1, vel: 0.38, reg: [57, 78] }, lead: { ph: ['P3 P4', 'P3 P2', 'P4 P1'] }, lead2: { ph: '@', inst: 'vibes', oct: 1, vel: 0.4, skip: 0.3 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVII:2 IV:2 i:2', pad: { p: 'swell' }, bass: 'whole', arp: false, lead: { ph: 'Q1 Q2', inst: 'vibes', vel: 0.62 }, bell: { dens: 0.2, res: 1, reg: [76, 93], vel: 0.4 }, choir: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.34, soft: true }, bell2: { ph: 'r8 CM', inst: 'choirMen', oct: -1, vel: 0.34 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: { p: 'sus', inst: 'strings' }, bass: 'half', arp: { pat: '0.2.', res: 1, vel: 0.4, reg: [57, 78] }, lead: { ph: ['P1 P2', 'P3 P4'], harm: -2 }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'B2', bars: 8, lv: 0.72, prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'organSoft', n: 3, reg: [55, 74], vel: 0.6 }, bass: 'whole', arp: { pat: '0.1.', res: 1, vel: 0.38, reg: [57, 80] }, lead: { ph: ['P3 P4', 'P4 P2'], inst: 'cello', vel: 0.65 }, lead2: { ph: '@', inst: 'vibes', oct: 1, vel: 0.45 }, choir: { vel: 0.6, skip: 0.3 } },
    ],
  });

  Track('galaxy3', {
    desc: 'Calm exploration, determination: steady pulse, strings and a resolute horn theme',
    bpm: 72, trim: 1.64, tone: { hi: -2.5 }, root: 'A', mode: 'minor', oct: 1, loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 1.6, verb: 1.2 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E'], ['A1', 'C', 'breath', 'A2', 'B', 'B2', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead2: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'pulse', lead: 'horn', lead2: 'bell', bell: 'glass', arp: 'arp', choir: 'aah' },
    ph: {
      D1: '1:1.5 3:.5 5:1 3:1 | 6:1.5 5:.5 3:2 | 7:1.5 5:.5 2:2 | 1:3 r:1',
      D2: '5:1.5 6:.5 8:1 6:1 | 8:1.5 6:.5 3:2 | 4:1.5 6:.5 8:2 | 7#:2 5:2',
      D3: '8:2 6:2 | 7:2 5:2 | 8:2 5:2 | 3:4',
      D4: '10:2 8:2 | 9:2 7:2 | 7#:2 9:2 | 5:4',
      D5: '8:4 | 6:4 | 5:4 | 3:4',
      D6: '6:4 | 8:4 | 7#:4 | 5:4',
      CM: '1:8 | 3:8 | 2:6 1:2 | 1:8',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 bVI:1 bVII:1', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'i bVI bVII i | i bVI bVII i', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [43, 62], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D1', 'D1 D2', 'r2 D1'] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [43, 62], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D2 D1'] }, arp: { p: 'up8', vel: 0.34, reg: [57, 81], skip: 0.3 } },
      { n: 'B', bars: 8, lv: 0.7, prog: 'bVI bVII i i | bVI bVII V V', pad: 'sus', bass: 'half', lead: { ph: ['D3 D4', 'D3 D6', 'D5 D4'] }, lead2: { ph: '@', inst: 'bell', oct: 1, vel: 0.4, skip: 0.3 }, arp: { p: 'up8', vel: 0.34, reg: [57, 81] } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'iv:2 i:2 bVI:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: false }, lead: { ph: 'D5 D6', inst: 'flute', vel: 0.7 }, bell: { dens: 0.2, res: 1, vel: 0.45 }, choir: { vel: 0.38, soft: true } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [43, 62], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D1 D1'], harm: -2 }, arp: { p: 'up', vel: 0.34, reg: [57, 84] }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.38, soft: true }, bell2: { ph: 'r8 CM', inst: 'choirMen', oct: -1, vel: 0.34 } },
      { n: 'B2', bars: 8, lv: 0.74, prog: 'bVI bVII i i | bVI bVII V V', pad: 'sus', bass: 'half', lead: { ph: ['D3 D4', 'D5 D6'], harm: -2 }, lead2: { ph: '@', inst: 'bell', oct: 1, vel: 0.45 }, arp: { p: 'up', vel: 0.36, reg: [57, 84] }, choir: { vel: 0.8 } },
      { n: 'E', bars: 8, lv: 0.64, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [43, 62], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D1 D5', 'D2 D1'] } },
    ],
  });

  Track('galaxy5', {
    desc: 'Calm exploration, the veil: a slow waltz of the spheres — harp arpeggios, an oboe singing over the strings, women far back, celeste points of light; in three',
    bpm: 54, meter: 3, trim: 3.12, tone: { hi: -2.5 }, root: 'Eb', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.0, verb: 1.25 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'C', 'breath', 'A3', 'B2', 'A2', 'E'], ['A1', 'B', 'A2', 'breath', 'C', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'clarinet', arp: 'vibes', choir: 'aah' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'oboe', lead2: 'glass', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      V1: '5:2 6:1 | 8:3 | 7:2 5:1 | 6:3', V1b: '5:1 6:1 8:1 | 8:3 | 7:1 6:1 5:1 | 6:3',          // the waltz tune and a more flowing reading of it
      V2: '8:2 9:1 | 10:3 | 9:2 8:1 | 5:3', V2b: '8:3 | 10:2 9:1 | 8:2 7:1 | 5:3',
      V3: '3:2 5:1 | 6:2 5:1 | 4:2 3:1 | 2:3',
      V4: '6:2 8:1 | 7:2 6:1 | 5:2 4:1 | 5:3', V4b: '6:2 8:1 | 7:2 6:1 | 5:2 2:1 | 1:3',          // half close / full close
      GL: '10:3 | 8:3 | 9:3 | 5:3',                                                               // the celeste answer
      CM: '1:6 | 2:6 | 3:3 2:3 | 1:6',                                                            // the men, one sung phrase
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.52], prog: 'I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.2', res: 1, vel: 0.34, reg: [55, 84] }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.4, reg: [55, 84] },
        lead: { ph: ['V1 V2', 'V1b V2', 'V1 V2b', 'r1 V1'], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 8, lv: 0.7, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42, skip: 0.3 }, bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.42, reg: [55, 84] },
        lead: { ph: ['V1 V2', 'V1b V2b', 'V3 V4'], vel: 0.62 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.36, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'vi IV | I V | vi ii | V I', pad: 'sus', pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: ['1--', '1-5'], inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.38, reg: [55, 84] },
        lead: { ph: ['V3 V4', 'V3 V4b', 'V4 V3'], vel: 0.6 }, lead2: { ph: 'GL GL', inst: 'glass', vel: 0.34, skip: 0.4, rest: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'IV:2 I:2 | IV:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.45 }, bass: false, arp: { pat: '0..', res: 1, vel: 0.3, reg: [55, 84], skip: 0.5 },
        lead: { ph: ['CM', 'r2 CM'], inst: 'cello', oct: -1, vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.32, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.42, reg: [55, 86] },
        lead: { ph: ['V1 V2', 'V1b V2b'], vel: 0.62, harm: -2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.38, skip: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, bell: { dens: 0.2, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 8, lv: 0.66, prog: 'vi IV | I V | vi ii | V I', pad: 'sus', pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: ['1--', '1-5'], inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.4, reg: [55, 86] },
        lead: { ph: ['V3 V4b', 'V4 V3'], vel: 0.62, harm: -2 }, choir: { n: 3, reg: [62, 79], vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.2, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I IV | I V | IV I | I I', pad: 'sus', bass: { pat: '1--', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['V1 V4b', 'V4b r4', 'r1 V1b'], vel: 0.56 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  Track('galaxy6', {
    desc: 'Calm exploration, the abyss: the dark between the stars — cellos on a sunken pedal, a bassoon far below, an alto flute far above, the men chanting the phrygian step; sparse, uneasy, patient',
    bpm: 46, trim: 3.85, tone: { hi: -3 }, root: 'E', mode: 'phrygian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.8 }, fx: { dly: 2.4, verb: 1.3 },
    forms: [['A1', 'breath1', 'B', 'C', 'breath2', 'A2', 'E'], ['A1', 'C', 'breath1', 'B', 'breath2', 'E'], ['A1', 'B', 'breath2', 'C', 'A2', 'breath1', 'E'], ['A1', 'breath1', 'C', 'A2', 'E']],
    alts: [{}, { lead: 'altoFlute', lead2: 'cello' }, { lead: 'cello', lead2: 'bassoon', pad: 'organSoft' }], eraAlts: { pad2: 'strings', lead2: 'cello' },
    inst: { pad: 'cellos', pad2: 'dark', bass: 'deep', lead: 'bassoon', lead2: 'altoFlute', bell: 'chime', arp: 'harp', choir: 'choirMen', choir2: 'uuh' },
    ph: {
      Z1: '5:4 | 6:4 | 5:2 4:2 | 3:4', Z1b: '5:6 6:2 | 5:2 4:2 3:4',                      // the bassoon: a step up, a slow fall
      Z2: '3:4 | 2:4 | 1:6 r:2', Z2b: '3:4 | 2:2 3:2 | 2:4 | 1:4',                       // the phrygian descent onto the tonic
      Z3: '8:4 | 9:2 8:2 | 6:4 | 5:4',
      Z4: '4:4 | 5:2 6:2 | 2:4 | 1:4',
      AF: '8:6 r:2 | 6:6 r:2 | 5:8 | r:8',                                                // the alto flute, three long notes far above
      CM: '1:8 | 2:8 | 1:6 7:2 | 1:8',                                                    // the men: tonic, the half step, tonic
    },
    sec: [
      { n: 'intro', bars: 6, cres: [0.4, 0.52], prog: 'i:6', pad: { p: 'swell', n: 3, reg: [40, 62] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.4 } },
      { n: 'A1', bars: 16, lv: 0.56, prog: 'i:2 bII:2 | i:2 bvii:2 | i:2 bVI:2 | bII:2 i:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z1 r2 Z2 r6', 'r2 Z1b r2 Z2b r4', 'Z1 r4 Z2b r4', 'r4 Z1 r4 Z2'], vel: 0.5 }, lead2: { ph: ['r8 AF', 'r6 AF', 'r10 AF'], vel: 0.42, skip: 0.3 }, choir: { n: 3, reg: [38, 55], vel: 0.34, soft: true },
        arp: { pat: '0.......', res: 2, vel: 0.3, reg: [52, 76], skip: 0.4 }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath1', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.36 } },
      { n: 'B', bars: 16, lv: 0.6, prog: 'iv:2 bIII:2 | bII:2 i:2 | iv:2 bVI:2 | bvii:2 i:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [48, 70] }, pad2: { p: 'swell', inst: 'cellos', n: 3, reg: [40, 62], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z3 r2 Z4 r6', 'r2 Z3 r2 Z4 r4', 'Z4 r4 Z3 r4'], vel: 0.52 }, lead2: { ph: ['r4 AF r4', 'r8 AF'], vel: 0.42, skip: 0.35 }, choir: { n: 3, reg: [38, 55], vel: 0.4, soft: true }, choir2: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.5 },
        drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'i:4 | bII:4', pad: { p: 'swell', n: 3, reg: [40, 62] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        lead2: { ph: ['CM', 'r2 CM'], inst: 'choirMen', oct: -1, vel: 0.42 }, choir: { n: 3, reg: [38, 55], vel: 0.36, soft: true }, bell: { dens: 0.1, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.6, prog: 'i:2 bII:2 | i:2 bvii:2 | i:2 bVI:2 | bII:2 i:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z1 r2 Z2b r6', 'Z1b r4 Z2 r4', 'r4 Z3 r4 Z2'], vel: 0.52, harm: -2 }, lead2: { ph: ['r6 AF', 'r2 AF r6'], vel: 0.44, skip: 0.25 }, choir: { n: 3, reg: [38, 55], vel: 0.42, soft: true },
        arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [52, 76], skip: 0.3 }, drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.5 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.48, prog: 'i:2 bII:2 | i:4', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['Z2 r4', 'r2 Z2b r2', 'Z4 r4'], vel: 0.48 }, choir: { n: 3, reg: [38, 55], vel: 0.34, soft: true }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.4 } },
    ],
  });

  Track('galaxy7', {
    desc: 'Calm exploration, the cradle: a lullaby in six — a rocking harp, a clarinet humming the tune, glockenspiel points, the women humming, the men beneath; the ship asleep between the stars',
    bpm: 156, meter: 6, trim: 3.2, tone: { hi: -2.5 }, root: 'F', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 1.6, verb: 1.2 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'B', 'breath', 'A3', 'C', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'vibes' }, { lead: 'cello', arp: 'vibes', bell: 'glass' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'warm', pad2: 'air', bass: 'deep', lead: 'clarinet', lead2: 'glass', bell: 'bell', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      L1: '5:2 6:1 8:3 | 7:2 6:1 5:3 | 3:2 4:1 5:3 | 6:6', L1b: '5:3 8:3 | 7:2 6:1 5:3 | 3:3 5:3 | 6:6',     // the lullaby, and a simpler reading
      L2: '8:2 9:1 10:3 | 9:2 8:1 7:3 | 6:2 5:1 6:3 | 5:6', L2b: '8:3 10:3 | 9:2 8:1 7:3 | 6:3 6:3 | 5:6',
      L3: '3:3 5:3 | 6:3 8:3 | 7:2 6:1 5:3 | 4:6',
      L4: '6:2 8:1 10:3 | 9:2 8:1 6:3 | 5:2 4:1 3:3 | 1:6',
      GL: '10:6 | 8:6 | 9:6 | 5:6',
      CM: '1:12 | 2:12 | 3:6 2:6 | 1:12',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.52], prog: 'I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.1.2.', res: 1, vel: 0.36, reg: [53, 81] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 16, lv: 0.62, prog: 'I vi IV V I vi ii V | I vi IV V I IV V I', pad: 'sus', bass: { pat: '1.....', inst: { p: 'deep', att: 0.6, rel: 1.6, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.4, reg: [53, 81] },
        lead: { ph: ['L1 L2 L1 L2b', 'L1b L2 L3 L4', 'L1 L2 r4 L1b', 'r2 L1 L2 L4'], vel: 0.58 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 16, lv: 0.7, prog: 'I vi IV V I vi ii V | I vi IV V I IV V I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.3 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 81] },
        lead: { ph: ['L1 L2 L3 L4', 'L1b L2b L1 L2', 'L3 L4 L1 L2'], vel: 0.6 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.34, skip: 0.4, rest: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 16, lv: 0.64, prog: 'IV I V vi IV I ii V | IV I V vi IV ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.38, reg: [53, 81] },
        lead: { ph: ['L3 L4 L3 L4', 'L3 L4 L1 L4', 'r4 L3 L4 L2'], vel: 0.58 }, lead2: { ph: 'GL GL GL GL', inst: 'glass', vel: 0.32, skip: 0.4, rest: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'vi:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: false, arp: { pat: '0.....', res: 1, vel: 0.3, reg: [53, 81], skip: 0.5 },
        lead: { ph: ['CM', 'r2 CM'], inst: 'cello', oct: -1, vel: 0.52 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.32, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 16, lv: 0.7, prog: 'I vi IV V I vi ii V | I vi IV V I IV V I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 83] },
        lead: { ph: ['L1 L2 L1b L2b', 'L1 L2 L3 L4'], vel: 0.6, harm: -2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.36, skip: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 16, lv: 0.66, prog: 'IV I V vi IV I ii V | IV I V vi IV ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.4, reg: [53, 83] },
        lead: { ph: ['L3 L4 L3 L4', 'L3 L4 L1b L2b'], vel: 0.6, harm: -2 }, choir: { n: 3, reg: [62, 79], vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I IV I V IV I I I', pad: 'sus', bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.34, reg: [53, 81] },
        lead: { ph: ['L1 L4', 'L4 r4', 'r2 L1b'], vel: 0.54 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  Track('galaxy8', {
    desc: 'Calm exploration, the beacon: a glass synth and strings on a sunken pedal, slow pizzicato, a horn calling the leitmotif from very far away, crotales and tubular bells answered by the delay; a signal from the edge',
    bpm: 52, trim: 3.79, tone: { hi: -2.5 }, root: 'C', mode: 'mixolydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.85 }, fx: { dly: 2.6, verb: 1.3 },
    forms: [['A1', 'B', 'C', 'breath', 'A2', 'E'], ['A1', 'C', 'breath', 'B', 'A2', 'E'], ['A1', 'breath', 'A2', 'C', 'E'], ['A1', 'B', 'breath', 'C', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'glass' }, { lead: 'cello', pad: 'strings', pad2: 'analog' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'padGlass', pad2: 'strings', bass: 'deep', lead: 'hornSolo', lead2: 'crystal', bell: 'crystal', bell2: 'chime', arp: 'pizz', choir: 'ooh' },
    ph: {
      K1: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4', K1b: '5:4 | 8:2 7:2 | 6:2 5:2 | r:4',          // the leitmotif head (rising fourth, falling step) as a distant call
      K2: '8:3 10:1 | 9:2 8:2 | 7:4 | 5:4',
      K3: '4:4 | 5:2 7:2 | 6:4 | 5:4',
      K4: '5:2 8:2 | 7:3 6:1 | 5:4 | 1:4',
      CH: '8:8 | r:8 | 5:8 | r:8',                                                         // tubular bells: two strokes, the delay answers in the rests
      CR: '12:4 | 10:4 | 9:4 | 8:4',                                                        // crotales descending
    },
    sec: [
      { n: 'intro', bars: 8, cres: [0.4, 0.52], prog: 'I:4 | bVII:4', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } },
        bell2: { ph: ['r2 CH', 'CH r2', 'r4 CH'], vel: 0.4, echo: 0.3 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 16, lv: 0.58, prog: 'I:2 bVII:2 | I:2 IV:2 | I:2 bVII:2 | IV:2 I:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.34, reg: [50, 72], skip: 0.3 },
        lead: { ph: ['K1 r2 K2 r2 K1', 'r2 K1 r2 K2 r2', 'K1b r4 K1 r4', 'r4 K1 r2 K3 r2'], vel: 0.42 }, lead2: { ph: ['r8 CR r4', 'r12 CR'], vel: 0.34, skip: 0.4 }, choir: { n: 2, reg: [60, 76], vel: 0.3, soft: true, skip: 0.3 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'B', bars: 8, lv: 0.6, prog: 'IV I bVII IV v IV bVII I', pad: { p: 'sus', inst: 'strings', n: 3, reg: [52, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, arp: { pat: '0...2...1...3...', res: 4, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K3 K4', 'K3 r4', 'r2 K4 r2'], vel: 0.46 }, lead2: { ph: ['CR CR', 'r4 CR'], vel: 0.34, skip: 0.35, rest: 0.3 }, choir: { n: 2, reg: [60, 76], vel: 0.34, soft: true }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'I:4 | bVII:4', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        bell2: { ph: ['CH', 'r2 CH'], vel: 0.42, echo: 0.3 }, lead2: { ph: ['r4 CR', 'CR r4'], vel: 0.32, skip: 0.4 }, choir: { n: 2, reg: [60, 76], vel: 0.32, soft: true }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.62, prog: 'I:2 bVII:2 | I:2 IV:2 | I:2 bVII:2 | IV:2 I:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K1 r2 K2 r2 K4', 'K1b r2 K3 r2 K4', 'r2 K2 r2 K1 r2'], vel: 0.46, harm: -2 }, lead2: { ph: ['r4 CR r8', 'r8 CR r4'], vel: 0.36, skip: 0.3 }, choir: { n: 3, reg: [58, 76], vel: 0.42, soft: true }, bell2: { ph: ['r8 CH', 'r12 CH'], vel: 0.38, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'I:2 bVII:2 | IV:2 I:2', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['K1 r4', 'r2 K1b r2', 'K4 r4'], vel: 0.42 }, bell2: { ph: ['r4 CH', 'r6 CH'], vel: 0.36, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
    ],
  });

  // The interludes between two pieces of the exploration programme (hidden; the rotation re-roots one of them to the key and mode of the
  // piece that follows, see interludeFor). Each is a minute of one idea: drift (the hall, one high pad, a pedal, a few points of light and
  // perhaps the first notes of the hymn), drift2 (harp and a cello line), drift3 (voices), drift4 (strings, the analogue sky and a distant
  // horn), drift5 (a soft marimba pulse). The music never stops between pieces: a piece crossfades into the interlude and the interlude
  // into the next piece.
  Track('drift', {
    desc: 'Drift — an interlude: one high pad, a pedal, a few points of light and perhaps the first notes of the hymn, in the key of the piece that follows',
    bpm: 52, trim: 5.6, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.35 },
    alts: [{}, { bell: 'crystal', lead: 'crystal' }, { lead: 'hornSolo', bell: 'chime' }, { pad: 'strings', lead: 'flute' }],
    inst: { pad: 'air', pad2: 'strings', bass: 'deep', lead: 'glass', bell: 'glass', arp: 'harp', choir: 'ooh' },
    ph: { H: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4', T: '8:4 | 5:4 | r:8', U: '3:4 | 5:4 | 4:4 | r:4' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.46], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.2, rel: 3.2, sub: 0.5 } }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A', bars: 8, lv: 0.44, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, pad2: { p: 'swell', n: 3, reg: [50, 72], vel: 0.5, skip: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } },
        lead: { ph: ['r2 H', 'H r4', 'r2 T r2', 'r4 U', 'r8'], vel: 0.36, echo: 0.3 }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [57, 84], skip: 0.5 }, choir: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.34 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', pad: { p: 'swell', n: 2, reg: [64, 81] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });


  Track('drift2', {
    desc: 'Drift, harp — a slow harp figure under one long cello line, strings far back; an interlude in the key of the piece that follows',
    bpm: 54, trim: 10, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.2, verb: 1.3 },
    alts: [{}, { arp: 'vibes', lead: 'altoFlute' }, { lead: 'clarinet' }],
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'cello', bell: 'glass', arp: 'harp', choir: 'ooh' },
    ph: { C1: '1:8 | 3:8 | 2:6 1:2 | 5:8', C2: '5:8 | 6:8 | 5:6 4:2 | 3:8' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.34, reg: [55, 84] } },
      { n: 'A', bars: 8, lv: 0.46, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.4 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } },
        arp: { pat: '0.1.2.3.', res: 2, vel: 0.36, reg: [55, 84] }, lead: { ph: ['C1', 'C2', 'r2 C1', 'r8'], oct: -1, vel: 0.5 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.36, prog: 'I:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift3', {
    desc: 'Drift, voices — the women humming over the men, an air pad, one flute note; an interlude in the key of the piece that follows',
    bpm: 52, trim: 5.4, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.35 },
    alts: [{}, { lead: 'glass' }, { choir: 'aah', lead: 'altoFlute' }],
    inst: { pad: 'air', pad2: 'strings', bass: 'deep', lead: 'flute', bell: 'glass', choir: 'choirWomen', choir2: 'choirMen' },
    ph: { F: '8:4 | 5:4 | r:8', G: '5:4 | 6:4 | 5:8' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } }, choir2: { n: 3, reg: [38, 55], vel: 0.34, soft: true } },
      { n: 'A', bars: 8, lv: 0.46, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, pad2: { p: 'swell', n: 3, reg: [50, 72], vel: 0.45, skip: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } },
        choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, choir2: { n: 3, reg: [38, 55], vel: 0.36, soft: true }, lead: { ph: ['r2 F r2', 'r4 G', 'r8'], vel: 0.34, echo: 0.3 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.36, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, choir2: { n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.3 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift4', {
    desc: 'Drift, horizon — strings and the analogue sky swelling together, a horn calling the hymn from far away, crotales; an interlude in the key of the piece that follows',
    bpm: 52, trim: 9.1, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, rubato: 0.04, mix: { bass: 0.75 }, fx: { dly: 2.2, verb: 1.3 },
    alts: [{}, { lead: 'cello' }, { lead: 'oboe', pad2: 'air' }],
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'hornSolo', bell: 'crystal', choir: 'ooh' },
    ph: { H: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4', H2: '8:3 10:1 | 9:2 8:2 | 7:4 | 5:4' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.5], prog: 'I:2', pad: { p: 'swell', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.55 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.55 } } },
      { n: 'A', bars: 8, lv: 0.5, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.55 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.55 } },
        lead: { ph: ['r2 H r2', 'H r4', 'r4 H2', 'r8'], vel: 0.4 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.34 }, choir: { n: 2, reg: [60, 76], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.38, prog: 'I:2', pad: { p: 'swell', n: 3, reg: [48, 70] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift5', {
    desc: 'Drift, pulse — a soft marimba figure keeps time under a warm pad, a celeste phrase above; an interlude in the key of the piece that follows',
    bpm: 58, trim: 9.8, tone: { hi: -2.5 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, rubato: 0.04, mix: { bass: 0.75 }, fx: { dly: 2.0, verb: 1.2 },
    alts: [{}, { arp: 'pizz' }, { arp: 'harp', lead: 'vibes' }],
    inst: { pad: 'warm', bass: 'deep', lead: 'glass', bell: 'vibes', arp: 'marimba', choir: 'ooh' },
    ph: { M: '5:2 8:2 | 7:4 | 6:2 5:2 | r:4' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.2.', res: 1, vel: 0.34, reg: [57, 78] } },
      { n: 'A', bars: 8, lv: 0.48, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72] }, bass: { pat: '1---', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '0.2.', res: 1, vel: 0.36, reg: [57, 78] },
        lead: { ph: ['r2 M r2', 'r4 M', 'r8'], vel: 0.36 }, bell: { dens: 0.08, res: 1, reg: [76, 93], vel: 0.34 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.38, prog: 'I:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0...', res: 1, vel: 0.3, reg: [57, 78] } },
    ],
  });

  // ---------------------------------------------------------------- the rare pieces (the Crimson Tide manner): once a cycle or so, with impact
  Track('galaxy9', {
    desc: 'The tide — deep bass swells rising out of the dark, the analogue sky and cellos over them, low brass and the men entering, the hymn in the horns at the crest; rare on the map, and felt when it comes',
    bpm: 60, trim: 3.1, tone: { lo: 1.0 }, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0.02, mix: { bass: 1.25, choir: 1.2, pad: 1.05 }, fx: { dly: 1.2, verb: 1.15 },
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'A2', 'B', 'E'], ['A1', 'B', 'A2', 'E']],
    alts: [{}, { lead: 'cello', pad2: 'strings' }, { pad: 'dark', lead2: 'brass' }],
    inst: { pad: 'analog', pad2: 'cellos', bass: 'subSwell', lead: 'horn', lead2: 'lowBrass', bell: 'crystal', choir: 'choirMen', choir2: 'aah' },
    ph: {
      H1: '5:3 8:1 | 7:2 6:2 | 5:3 3:1 | 4:2 5:2',                         // the hymn (the game's leitmotif)
      T1: '1:4 | 3:4 | 5:4 | 4:2 3:2', T2: '5:4 | 6:4 | 8:4 | 7:2 5:2',    // the slow rise
      T3: '8:2 7:2 | 6:2 5:2 | 4:4 | 5:4',                                   // the brass answer
      CM: '1:8 | 3:8 | 2:6 1:2 | 1:8',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.62], prog: 'i:4', pad: { p: 'swell', n: 3, reg: [38, 60], vel: 0.7 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.4, rel: 1.8 } }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
      { n: 'A1', bars: 16, cres: [0.62, 0.78], prog: 'i:2 bVI:2 | i:2 bVII:2 | i:2 bVI:2 | iv:2 V:2', pad: { p: 'swell', n: 3, reg: [38, 60], vel: 0.75 }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.6 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.2, rel: 1.8 } },
        lead: { ph: ['r4 T1 r4 T2', 'T1 r4 T2 r4', 'r8 T1 T2'], vel: 0.6 }, choir: { n: 3, reg: [38, 55], vel: 0.5, soft: true }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'B', bars: 8, lv: 0.95, hit: 'tam', cr: true, prog: 'bVI bVII i i | bVI bVII V i', pad: { p: 'sus', n: 3, reg: [38, 60], vel: 0.8 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.6 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.2, rel: 1.6 } },
        lead: { ph: ['H1 H1', 'H1 T3'], vel: 0.85, harm: -2 }, choir: { n: 3, reg: [38, 57], vel: 0.9 }, choir2: { n: 3, reg: [57, 74], vel: 0.5, skip: 0.4 }, timp: 'two', bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:4 | i:4', pad: { p: 'swell', n: 3, reg: [38, 60], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.0 } }, lead2: { ph: ['r2 CM', 'CM'], inst: 'choirMen', oct: -1, vel: 0.45, skip: 0.3 }, choir: { n: 3, reg: [38, 55], vel: 0.45, soft: true }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.38 }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.85, 1.08], hit: 'tam', prog: 'i:2 bVI:2 | i:2 bVII:2 | i:2 bVI:2 | iv:2 V:2', pad: { p: 'sus', n: 3, reg: [38, 60], vel: 0.8 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.6, rel: 1.6 } },
        lead: { ph: ['H1 H1 T3 H1', 'T1 T2 H1 H1'], inst: 'brass', vel: 0.95, harm: -2 }, lead2: { ph: ['r4 H1 r4 H1', 'r8 H1 H1'], inst: 'choirMen', oct: -1, vel: 0.8 }, choir: { n: 3, reg: [38, 57], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.6 }, timp: 'beats', bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.55, prog: 'i:2 bVI:2 | i:4', pad: { p: 'swell', n: 3, reg: [38, 60], vel: 0.65 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } }, lead: { ph: ['r4 H1', 'T2 r4'], inst: 'hornSolo', vel: 0.55 }, choir: { n: 3, reg: [38, 55], vel: 0.5, soft: true }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
    ],
  });

  Track('galaxy10', {
    desc: 'The chorale — the men’s choir carries everything: a hymn sung low over the organ and the analogue bed, a horn counter-line, the women joining at the crest, timpani underneath; rare on the map',
    bpm: 56, trim: 2.15, tone: { lo: 0.8 }, root: 'G', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0.02, mix: { choir: 1.4, bass: 1.1 }, fx: { dly: 1.0, verb: 1.2 },
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'A2', 'B', 'E'], ['A1', 'B', 'A2', 'C', 'E']],
    alts: [{}, { pad: 'organSoft', lead: 'cello' }, { pad2: 'cellos', choir2: 'choirWomen' }],
    inst: { pad: 'organ', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'choirMen', bell: 'glass', choir: 'choirMen', choir2: 'aah' },
    ph: {
      HY1: '1:3 3:1 | 2:2 1:2 | 5:3 4:1 | 3:4', HY2: '3:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4',     // the chorale, two lines
      HY3: '5:3 6:1 | 8:2 7:2 | 6:2 5:2 | 4:4', HY4: '6:2 5:2 | 4:2 3:2 | 2:3 1:1 | 1:4',     // its answer, higher
      CT: '1:2 3:2 | 2:2 1:2 | 4:2 3:2 | 2:3 r:1',                                             // the horn beneath
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.62], prog: 'i:2 bVI:2', pad: { p: 'swell', n: 4, reg: [45, 72], vel: 0.9 }, pad2: { p: 'swell', n: 3, reg: [38, 60], vel: 0.5 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.0 } }, choir: { n: 3, reg: [38, 55], vel: 0.5, soft: true } },
      { n: 'A1', bars: 16, cres: [0.68, 0.82], prog: 'i iv bVI V | i bVII bVI V | i iv bIII bVII | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.85 }, pad2: { p: 'sus', n: 3, reg: [38, 60], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.5, rel: 1.6 } },
        lead2: { ph: ['HY1 HY2 HY1 HY2', 'HY1 HY2 HY3 HY4', 'r4 HY1 HY2 HY4'], inst: 'choirMen', oct: -1, vel: 0.85 }, lead: { ph: ['r8 CT CT', 'CT r4 CT r4'], vel: 0.5, skip: 0.3 }, choir: { n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.34 } },
      { n: 'B', bars: 8, lv: 1.0, hit: 'tam', cr: true, prog: 'bVI bVII i i | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.8 }, pad2: { p: 'sus', n: 3, reg: [43, 64], vel: 0.8 }, bass: { pat: 'c---', inst: { p: 'deep', sub: 0.85, att: 0.4, rel: 1.4 } },
        lead2: { ph: ['HY3 HY4', 'HY1 HY4'], inst: 'choirMen', oct: -1, vel: 1.0 }, lead: { ph: ['HY3 HY4', 'HY1 HY4'], vel: 0.75, harm: -2 }, choir: { n: 3, reg: [38, 57], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.65 }, timp: 'two', bell: { dens: 0.1, res: 1, reg: [72, 96], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVI:2 | iv:2 i:2', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.85, att: 1.2, rel: 2.4 } }, lead2: { ph: ['HY1 HY2', 'r4 HY2'], inst: 'choirMen', oct: -1, vel: 0.6 }, choir: { n: 3, reg: [38, 55], vel: 0.55, soft: true }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.4 }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.88, 1.1], hit: 'tam', prog: 'i iv bVI V | i bVII bVI V | i iv bIII bVII | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.7 }, pad2: { p: 'sus', n: 3, reg: [43, 64], vel: 0.9 }, bass: { pat: ['c---', 'c---', '1---', 'c---'], inst: { p: 'deep', sub: 0.9, att: 0.3, rel: 1.4 } },
        lead2: { ph: ['HY1 HY2 HY3 HY4', 'HY3 HY4 HY1 HY2'], inst: 'choirMen', oct: -1, vel: 1.0 }, lead: { ph: '@', inst: 'horn', vel: 0.7, harm: -2 }, choir: { n: 3, reg: [38, 57], vel: 1.05 }, choir2: { n: 3, reg: [57, 76], vel: 0.7 }, timp: 'beats', bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.45 } },
      { n: 'E', bars: 8, lv: 0.58, prog: 'i iv bVI i | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.8 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.2 } }, lead2: { ph: ['HY2 HY4', 'r4 HY4'], inst: 'choirMen', oct: -1, vel: 0.7 }, choir: { n: 3, reg: [38, 55], vel: 0.6, soft: true }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.32 } },
    ],
  });

  // The war-time readings of the rare pieces: the same music with the Mutiny-style synthetic hits (processed booms, synth kick and snare,
  // anvil) placed in the big sections, sparse in the first; the war rotation plays these instead of the plain ones.
  function hitsVariant(baseId) {
    const base = TRACKS[baseId]; if (!base) return null;
    const d = JSON.parse(JSON.stringify(base)); delete d._p; delete d.id;
    d.hidden = true; d.desc = String(base.desc).split(' — ')[0] + ', at war: the same piece with synthetic drum hits in its big sections';
    d.mix = Object.assign({}, d.mix || {}, { drums: 1.15 }); d.trim = num(base.trim, DEFAULT_TRIM);
    for (const sct of d.sec) {
      const top = sct.cres ? sct.cres[1] : num(sct.lv, 1);
      if (top >= 0.9) sct.drums = { p: 'mutiny', vel: 0.9 };
      else if (top >= 0.75 && sct.n !== 'intro') sct.drums = { p: 'mutiny', vel: 0.6, skip: 0.3 };
    }
    return Track(baseId + ':war', d);
  }
  hitsVariant('galaxy9'); hitsVariant('galaxy10');

  // ---------------------------------------------------------------- three more pieces for the programme: a clockwork in five, a passacaglia, a night watch
  Track('galaxy11', {
    desc: 'Calm exploration, the orrery: a clockwork of the spheres in five — pizzicato strings and a celeste turning in three-and-two, a triangle on the turn, the harp; a clarinet sings the leitmotif stretched across the five and the cellos carry the men’s phrase; the clockwork stops for a flute and the hall, then turns again',
    bpm: 58, meter: 5, trim: 3.74, tone: { hi: -2.5 }, root: 'Bb', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.0, verb: 1.2 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E'], ['A1', 'B', 'A2', 'breath', 'C', 'B2', 'E']],
    alts: [{}, { lead: 'oboe', arp2: 'vibes' }, { lead: 'flute', lead2: 'crystal', pad: 'warm' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'clarinet', lead2: 'bell', bell: 'glass', arp: 'pizz', arp2: 'glass', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      O1: '5:3 8:2 | 7:3 6:2 | 5:3 3:2 | 4:3 5:2',                                           // the leitmotif (rising fourth, falling step) stretched across the five
      O2: '5:3 8:2 | 9:3 10:2 | 8:2 7:1 6:2 | 5:5',
      O3: '8:3 10:2 | 12:3 11:2 | 10:2 9:1 8:2 | 7:3 5:2',                                   // the answer, a fifth higher
      O4: '6:3 8:2 | 10:2 9:1 8:2 | 5:3 6:2 | 8:5',
      T1: '3:1 5:1 6:1 5:1 3:1 | 2:1 4:1 5:1 3:1 2:1 | 1:1 3:1 5:1 8:1 6:1 | 5:5',            // the gears: a turning figure for the celeste
      FL: '4:4 r:1 | 1:4 r:1 | 2:4 r:1 | 7:5',                                                 // the four slow notes, the delay answering in the rests
      GL: '10:5 | 8:5 | 9:5 | 5:5',                                                            // the glockenspiel answer
      CM: '1:5 | 2:5 | 3:3 2:2 | 1:5',                                                         // the men's phrase, in five
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.52], prog: 'I:2 IVM7:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.34, reg: [50, 72] }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'Iadd9 V | I IVM7:.6 V:.4 | Iadd9 vi7 | IVM7 I', pad: 'sus', bass: { pat: '1....', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.4, reg: [50, 72] },
        lead: { ph: ['O1 O2', 'O1 O4', 'r4 O2', 'O1 r4'], vel: 0.58 }, drums: { tri: ['x.........', '..........'], vel: 0.5 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 8, lv: 0.7, prog: 'Iadd9 V | I IVM7:.6 V:.4 | Iadd9 vi7 | IVM7 I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.3 }, bass: { pat: '1..5.', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.4, reg: [50, 72] }, arp2: { pat: '...0...2..', res: 2, vel: 0.3, reg: [67, 86], skip: 0.3 },
        lead: { ph: ['O1 O2', 'O1 O4', 'O1 r4'], vel: 0.6 }, lead2: { ph: ['r4 T1', 'T1 r4'], inst: 'glass', vel: 0.3, skip: 0.4, rest: 0.3 }, drums: { tri: ['x.........', '..........'], vel: 0.5 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'vi IVM7 | I V | IVM7 I | V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: ['1....', '1..5.'], inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.38, reg: [50, 74] }, arp2: { inst: 'harp', pat: '0.1.2.3.2.', res: 2, vel: 0.34, reg: [55, 84], skip: 0.3 },
        lead: { ph: ['O3 O4', 'O3 r4', 'r4 O4'], vel: 0.6 }, lead2: { ph: 'GL GL', inst: 'bell', vel: 0.32, skip: 0.4, rest: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'IVM7:2 IM7:2 | ii7:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 76] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: false, arp: false,
        lead: { ph: ['FL FL', 'r4 FL', 'FL r4'], inst: 'flute', vel: 0.5, echo: 0.3 }, lead2: { ph: ['CM r4', 'r1 CM r3'], inst: 'cello', oct: -1, vel: 0.5, skip: 0.3 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'I:2', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'Iadd9 V | I IVM7:.6 V:.4 | Iadd9 vi7 | IVM7 I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1..5.', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.4, reg: [50, 74] }, arp2: { pat: '...0...2..', res: 2, vel: 0.32, reg: [67, 86] },
        lead: { ph: ['O1 O2', 'O1 O4'], vel: 0.6, harm: -2 }, lead2: { ph: '@', inst: 'bell', oct: 1, vel: 0.36, skip: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.42, soft: true }, drums: { tri: ['x.........', '..........'], vel: 0.5 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 8, lv: 0.66, prog: 'vi IVM7 | I V | IVM7 I | V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: ['1....', '1..5.'], inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.4, reg: [50, 74] }, arp2: { inst: 'harp', pat: '0.1.2.3.2.', res: 2, vel: 0.36, reg: [55, 84] },
        lead: { ph: ['O3 O4', 'r4 O4'], vel: 0.62, harm: -2 }, lead2: { ph: ['T1 r4', 'r4 GL'], inst: 'glass', vel: 0.32, skip: 0.3, rest: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.45 }, choir2: { inst: 'choirMen', n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I V | I IVM7:.6 V:.4 | IVM7 I | I I', pad: 'sus', bass: { pat: '1....', inst: { p: 'deep', att: 1.0, rel: 2.4, sub: 0.5 } }, arp: { pat: '0.1.2.1.0.', res: 2, vel: 0.34, reg: [50, 72] },
        lead: { ph: ['O1 r4', 'r4 O4', 'O1 O4'], vel: 0.54 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  Track('galaxy12', {
    desc: 'Calm exploration, the long night: a passacaglia — a ground that never stops in the basses and cellos, the cor anglais singing over it, the harp, the women far back; the hymn arrives in the horn at the crest and the men hold the pillars of the ground; grave, patient, never raised',
    bpm: 50, trim: 3.93, tone: { hi: -2.5 }, root: 'B', mode: 'minor', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.02, fx: { dly: 1.6, verb: 1.25 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E'], ['A1', 'C', 'breath', 'A2', 'B', 'B2', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'bassoon' }, { lead: 'oboe', arp: 'pizz', bell: 'glass' }], eraAlts: { pad: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'reed', lead2: 'cello', bell: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      GB: '1:3 7:1 | 6:3 5:1 | 3:3 4:1 | 5:4',                                                 // the ground: the lament's descent, and the step back up to the dominant
      P1: '3:2 4:1 5:1 | 6:3 5:1 | 5:2 3:1 1:1 | 2:4',                                          // the cor anglais: its own theme over the ground
      P2: '8:3 7:1 | 6:3 5:1 | 5:3 4:1 | 2:2 7#:2',                                             // the answer, left on the leading tone
      H1: '5:3 8:1 | 7:2 6:2 | 5:3 3:1 | 4:2 5:2',                                              // the hymn (the game's leitmotif), which the ground was written to carry
      FL: '7:6 r:2 | 4:6 r:2 | 5:6 r:2 | 10:8',                                                 // the four slow notes, as the ground allows them
      CM: '1:8 | 5:8 | 3:4 1:4 | 5:8',                                                          // the men hold the pillars of the ground
      CD: '5:2 3:2 | 4:2 6:2 | 4:2 7#:2 | 1:4',                                                 // the close
    },
    // the ground lives in the bass line itself: root, then the passing note that walks to the next chord (b = a step below the root, 7 = the seventh, 2 = a step above)
    base: { bass: { pat: ['1--b', '1--7', '1--2', '1---'], inst: { p: 'deep', att: 0.9, rel: 2.2, sub: 0.55 }, vel: 0.9 } },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.54], prog: 'i bVIM7 bIII V', pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.5 }, bass: true, lead2: { ph: 'GB', vel: 0.6, art: 0.96 }, bell: { dens: 0.05, res: 1, reg: [64, 88], vel: 0.38 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'sus', n: 3, reg: [50, 72] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.5 }, bass: true, lead2: { ph: 'GB GB', vel: 0.6, art: 0.96 },
        lead: { ph: ['P1 P2', 'r4 P1', 'P2 P1', 'P1 r4'], vel: 0.56 }, arp: { pat: '0...2...', res: 2, vel: 0.32, reg: [52, 79], skip: 0.3 }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.4 } },
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'sus', n: 3, reg: [50, 72] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.55 }, bass: true, lead2: { ph: 'GB GB', vel: 0.62, art: 0.96 },
        lead: { ph: ['P1 P2', 'P2 P1', 'r4 P2'], vel: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.34, reg: [52, 79] }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true, skip: 0.3 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.4 } },
      { n: 'B', bars: 8, lv: 0.72, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'sus', n: 4, reg: [50, 74] }, pad2: { p: 'sus', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: true,
        lead: { ph: ['H1 P2', 'P1 H1', 'H1 H1'], inst: 'horn', vel: 0.55 }, lead2: { ph: 'CM', inst: 'choirMen', oct: -1, vel: 0.42, skip: 0.3 }, choir2: { n: 3, reg: [38, 55], vel: 0.36, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.32, soft: true, skip: 0.4 }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [52, 79] }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: ['1--b', '1--7', '1--2', '1---'], inst: { p: 'deep', att: 1.2, rel: 2.6, sub: 0.55 }, vel: 0.8 },
        lead: { ph: ['FL', 'r2 FL'], inst: 'glass', vel: 0.44, echo: 0.3 }, lead2: { ph: 'CM', inst: 'choirMen', oct: -1, vel: 0.38, skip: 0.3 }, choir2: { n: 3, reg: [38, 55], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.5 }, bell: { dens: 0.12, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'sus', n: 3, reg: [50, 72] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.55 }, bass: true, lead2: { ph: 'GB GB', vel: 0.62, art: 0.96 },
        lead: { ph: ['P1 P2', 'P2 P1'], vel: 0.6, harm: -2 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.34, reg: [52, 79] }, choir: { n: 3, reg: [62, 79], vel: 0.42, soft: true }, bell: { dens: 0.12, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'B2', bars: 8, lv: 0.76, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', pad: { p: 'sus', n: 4, reg: [50, 74] }, pad2: { p: 'sus', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.6 }, bass: true,
        lead: { ph: ['H1 H1', 'H1 P2'], inst: 'horn', vel: 0.6, harm: -2 }, lead2: { ph: 'CM', inst: 'choirMen', oct: -1, vel: 0.45 }, choir2: { n: 3, reg: [38, 55], vel: 0.45, soft: true }, choir: { n: 3, reg: [62, 79], vel: 0.4 }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [52, 79] }, drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.5 }, bell: { dens: 0.12, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'i bVIM7 bIII V | i bVIM7 iv:.5 V:.5 i', pad: { p: 'sus', n: 3, reg: [50, 72] }, pad2: { p: 'swell', n: 3, reg: [43, 64], vel: 0.5 }, bass: { pat: ['1--b', '1--7', '1--2', '1---', '1--b', '1--7', '1-1-', '1---'], inst: { p: 'deep', att: 1.0, rel: 2.4, sub: 0.55 }, vel: 0.85 }, lead2: { ph: 'GB GB', vel: 0.58, art: 0.96 },
        lead: { ph: ['P1 CD', 'r4 CD'], vel: 0.54 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.4 } },
    ],
  });

  Track('galaxy13', {
    desc: 'Calm exploration, the watch: the night watch on the bridge — a lone trumpet, very soft, plays the procession’s theme at rest over open strings, a slow pizzicato tread and the harp; the horn answers with the leitmotif from far away, a bell tree, the women humming at the crest; the empire’s step, heard from home',
    bpm: 60, trim: 3.6, tone: { hi: -2.5 }, root: 'Ab', mode: 'major', oct: -1, loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 1.8, verb: 1.25 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2', 'E'], ['A1', 'B', 'C', 'breath', 'A2', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E'], ['A1', 'C', 'breath', 'A2', 'B', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'oboe', lead2: 'horn', arp: 'glass' }], eraAlts: { pad2: 'cellos', lead: 'hornSolo', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'tptSolo', lead2: 'hornSolo', bell: 'bell', arp: 'harp', arp2: 'pizz', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PA: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 2:2', PB: '1:3 2:1 | 3:2 5:2 | 8:3 7:1 | 5:4',   // the procession's theme and its answer, at rest
      PB2: '1:3 2:1 | 3:2 5:2 | 6:2 5:1 3:1 | 2:4',                                           // the answer left open
      CD: '4:2 3:1 2:1 | 5:3 4:1 | 3:2 2:2 | 1:4',                                             // its cadence
      H1: '5:3 8:1 | 7:2 6:2 | 5:3 3:1 | 4:2 5:2', K: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4',         // the hymn, and the call that opens it
      CM: '1:8 | 2:8 | 3:6 2:2 | 1:8',                                                          // the men, one sung phrase
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.54], prog: 'Iadd9:2 IVM7:2', pad: { p: 'swell', n: 3, reg: [50, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.5 } }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84] }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.36, reg: [44, 62] }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84], skip: 0.3 },
        lead: { ph: ['PA PB', 'PA PB2', 'PB PA', 'r4 PB'], vel: 0.5 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 8, lv: 0.68, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.3 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.38, reg: [44, 62] }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.32, reg: [55, 84] },
        lead: { ph: ['PA PB', 'PB PA', 'PA PB2'], vel: 0.52 }, lead2: { ph: ['r4 K', 'K r4'], vel: 0.36, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true, skip: 0.3 }, drums: { bellTree: ['x...............', '................', '................', '................'], vel: 0.35 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76] }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.36, reg: [44, 62] }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84], skip: 0.3 },
        lead2: { ph: ['H1 r4', 'K r4'], vel: 0.42 }, lead: { ph: ['r4 CD', 'K CD'], vel: 0.52 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'Iadd9:2 Vsus4:2 | IVM7:2 I:2', pad: { p: 'swell', n: 3, reg: [52, 76] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.45 }, bass: false, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead2: { ph: ['CM', 'r2 CM'], inst: 'choirMen', oct: -1, vel: 0.4 }, choir2: { n: 3, reg: [38, 55], vel: 0.32, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, drums: { bellTree: ['x...............', '................', '................', '................', '................', '................', '................', '................'], vel: 0.3 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.38, reg: [44, 62] }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.34, reg: [55, 86] },
        lead: { ph: ['PA PB', 'PA PB2'], vel: 0.54, harm: -2 }, lead2: { ph: ['r4 K', 'K r4'], vel: 0.38, skip: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.45 }, drums: { bellTree: ['x...............', '................', '................', '................'], vel: 0.35 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 8, lv: 0.66, prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76] }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.38, reg: [44, 62] }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.32, reg: [55, 86] },
        lead2: { ph: 'H1 r4', vel: 0.45 }, lead: { ph: ['r4 CD', 'K CD'], vel: 0.55, harm: -2 }, choir: { n: 3, reg: [62, 79], vel: 0.48 }, choir2: { n: 3, reg: [38, 55], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.52, prog: 'I Isus2 IVadd9 V | IVM7 Vsus4 I:.5 V7:.5 I', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp2: { pat: '0...2...', res: 2, vel: 0.34, reg: [44, 62] }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84] },
        lead: { ph: ['PA CD', 'r4 CD', 'PA r4'], vel: 0.5 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  Track('design', {
    desc: 'Technical, light: bubbling marimba and sequenced plucks over a springy bass',
    bpm: 112, trim: 1.47, root: 'G', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'D', 'E', 'A1', 'B', 'C', 'A2', 'D', 'B2', 'E', 'A3', 'C', 'E'], ['A1', 'B', 'A2', 'D', 'C', 'A3', 'B2', 'E', 'A1', 'C', 'B', 'A2', 'E', 'D', 'B2', 'A3', 'C', 'E']],
    inst: { pad: 'glassPad', bass: 'pulse', lead: 'marimba', lead2: 'vibes', bell: 'vibes', arp: 'seq', choir: 'ooh' },
    ph: {
      T1: '5:.5 8:.5 5:.5 3:.5 5:1 r:1 | 6:.5 8:.5 6:.5 3:.5 6:1 r:1 | 4:.5 6:.5 4:.5 2:.5 4:1 r:1 | 5:.5 7:.5 5:.5 3:.5 2:1 r:1',
      T2: '8:1 7:.5 5:.5 3:1 5:1 | 8:1 6:.5 5:.5 6:1 8:1 | 9:1 8:.5 6:.5 4:1 6:1 | 5:2 r:1 5:1',
      T3: '8:1 6:.5 4:.5 6:1 8:1 | 7:1 5:.5 3:.5 5:1 7:1 | 6:1 4:.5 2:.5 4:1 6:1 | 5:2 r:1 5:1',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.55, prog: 'IM7 vi7 ii7 V7', pad: 'sus', arp: { pat: '0.2.1.3.', res: 2, vel: 0.4, reg: [60, 84] }, drums: { hat: 'x.x.x.x.x.x.x.x.' } },
      { n: 'A1', bars: 8, lv: 0.7, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T1 T1', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'A2', bars: 8, lv: 0.8, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T1 T2', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, bell: { dens: 0.3, res: 2, reg: [76, 93] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'IV iii ii V | IV iii ii V', pad: 'sus', bass: 'oct8', lead: 'T3 T3', arp: { p: 'up', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'C', bars: 8, lv: 0.55, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: { p: 'swell' }, bass: 'half', lead: false, arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, bell: { dens: 0.35, res: 2, reg: [72, 91], vel: 0.55 }, drums: { hat: 'x.x.x.x.x.x.x.x.' } },
      { n: 'A3', bars: 8, lv: 0.9, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: { ph: 'T2 T1', harm: -2 }, arp: { p: 'updown', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'B2', bars: 8, lv: 0.98, prog: 'IV iii ii V | IV iii ii V', pad: 'sus', bass: 'oct8', lead: { ph: 'T3 T2', inst: 'marimba' }, lead2: { ph: 'T3 T2', inst: 'vibes', oct: 1, vel: 0.4 }, arp: { p: 'up', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', clap: '....o.......o...' }, fill: 'snare' },
      { n: 'D', bars: 8, lv: 0.82, prog: 'IV iii ii V | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: { ph: 'T3 T1', inst: 'vibes', vel: 0.75 }, arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'E', bars: 8, lv: 0.65, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T2 T1', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
    ],
  });

  Track('research', {
    desc: 'Shimmering discovery: crystal bells, rising sequences and a glassy lydian wash',
    bpm: 84, trim: 1.37, root: 'E', mode: 'lydian', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'E', 'C', 'A1', 'B', 'A2', 'B2', 'E', 'A3'], ['A1', 'B', 'A2', 'C', 'B2', 'E', 'A3', 'C', 'A1', 'A2', 'B', 'B2', 'E', 'A3']],
    inst: { pad: 'glassPad', bass: 'deep', lead: 'crystal', lead2: 'glass', bell: 'crystal', arp: 'shimmer', choir: 'eeh' },
    ph: {
      R1: '5:1 8:.5 7:.5 5:1 3:1 | 6:1 8:.5 9:.5 8:1 6:1 | 5:1.5 6:.5 8:1 6:1 | 7:1 5:1 7:1 9:1',
      R2: '5:1 8:.5 7:.5 5:1 3:1 | 6:1 8:.5 9:.5 8:1 6:1 | 3:1.5 5:.5 7:1 5:1 | 7:1 9:1 12:2',
      R3: '6:1 8:1 10:1 12:1 | 7:1 9:1 12:1 9:1 | 8:1 10:1 12:1 10:1 | 9:1 11:1 13:1 11:1',
      R4: '6:1 8:1 10:1 12:1 | 7:1 9:1 12:1 9:1 | 9:1 11:1 13:1 11:1 | 12:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.45, prog: 'IM7:2 II:2', pad: { p: 'swell' }, bell: { dens: 0.35, res: 2, reg: [76, 96], vel: 0.55 } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'whole', lead: 'R1 R2', arp: { pat: '0.2.', res: 4, vel: 0.3, reg: [64, 91] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'half', lead: 'R1 R2', arp: { p: 'up', vel: 0.34, reg: [64, 93], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [79, 96], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'vi V IM7 II | vi V II V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R3 R4', inst: 'glass' }, lead2: { ph: 'R3 R4', inst: 'crystal', oct: 1, vel: 0.4 }, arp: { p: 'updown', vel: 0.34, reg: [64, 93], jump: 0.1 }, choir: { v1: 'e', v2: 'i', vel: 0.6 }, drums: { kick: 'x.......x.......', shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'IM7:2 II:2 vi:2 V:2', pad: { p: 'swell' }, bass: false, lead: false, bell: { dens: 0.45, res: 2, reg: [72, 96], vel: 0.6 }, choir: { v1: 'i', v2: 'e', vel: 0.5 }, arp: { pat: '0.2.', res: 4, vel: 0.26, reg: [64, 91] } },
      { n: 'A3', bars: 8, lv: 0.92, prog: 'IM7 II vi V | IM7 II iii V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R1 R2', harm: -2 }, lead2: { ph: 'R1 R2', inst: 'glass', oct: 1, vel: 0.4 }, arp: { p: 'up', vel: 0.36, reg: [64, 93], jump: 0.1 }, bell: { dens: 0.3, res: 2, reg: [79, 96], vel: 0.5 }, drums: { kick: 'x.......x.......', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B2', bars: 8, lv: 1.02, prog: 'vi V IM7 II | vi V II V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R3 R4', inst: 'glass', harm: -2 }, lead2: { ph: 'R3 R4', inst: 'crystal', oct: 1, vel: 0.45 }, arp: { p: 'run', vel: 0.34, reg: [64, 95], jump: 0.1 }, choir: { v1: 'e', v2: 'i', vel: 0.8 }, drums: { kick: 'x...x...x...x...', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, fill: 'snare' },
      { n: 'E', bars: 8, lv: 0.6, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'whole', lead: 'R2 R1', arp: { pat: '0.2.', res: 4, vel: 0.28, reg: [64, 91] }, bell: { dens: 0.25, res: 2, reg: [79, 96], vel: 0.45 } },
    ],
  });
  Track('combat1', {
    desc: 'Driving percussive tension: galloping bass, fast saw arps, timpani and a brass riff',
    bpm: 142, trim: 1.92, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'E', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, lead: 0.4, bell: 0.55 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A3', 'C', 'A1', 'B1', 'A2', 'B2', 'A3'], ['A1', 'C', 'B1', 'A2', 'B2', 'A3', 'A1', 'B1', 'C', 'A2', 'B2', 'A3']],
    inst: { pad: 'dark', bass: 'moog', lead: 'synth', lead2: 'brass', arp: 'arpSaw', bell: 'bell' },
    ph: {
      M1: '1:.5 1:.5 3:.5 1:.5 5:1 4:.5 3:.5 | 1:.5 1:.5 3:.5 1:.5 5:1 6:.5 5:.5',
      M2: '5:1 4:.5 3:.5 5:1 6:1 | 8:2 7:1 6:1 | 5:1 4:.5 3:.5 2:1 3:1 | 1:4',
      M3: '10:2 8:1 6:1 | 9:2 7:1 5:1 | 8:1 10:1 12:1 10:1 | 7#:2 9:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.6, prog: 'i', hit: true, pad: 'sus', bass: { pat: '1---', pedal: true }, timp: { p: 'roll', roll: 0 }, arp: { pat: '0.2.', res: 4, vel: 0.35, reg: [52, 76], gate: 0.5 } },
      { n: 'A1', bars: 16, lv: 0.85, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6 }, drums: 'drive', timp: 'hits', lead: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', fill: 'tom' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2 M3', inst: 'brass', harm: -2 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.92, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'hits', lead: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', lead2: { ph: 'r8 M1 M1-2 M1 M1-1', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bVI:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.2.', res: 4, vel: 0.3, reg: [52, 76], gate: 0.5 }, drums: { t5: 'X...............', t4: '........o.......', rim: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.2, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.52, reg: [52, 81], gate: 0.6, jump: 0.08 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2+3 M3', inst: 'brass', harm: -2 }, lead2: { ph: 'M2 M3 M2 M3', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
      { n: 'A3', bars: 16, lv: 1.0, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.1 }, drums: 'drive', timp: 'gallop', lead: { ph: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', harm: -2 }, lead2: { ph: 'r8 M1 M1-2 M1 M1-1', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
    ],
  });

  Track('combat2', {
    desc: 'Heavy half-time assault: syncopated stabs, chromatic phrygian bass, metal hits and a rapid pulse arp',
    bpm: 152, trim: 1.76, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'C#', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, lead: 0.4, bell: 0.55 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A3', 'C', 'A1', 'B1', 'A2', 'B2', 'A3', 'B2'], ['A1', 'C', 'B1', 'A2', 'B2', 'A3', 'A1', 'B1', 'C', 'A2', 'B2', 'A3', 'A3']],
    inst: { pad: 'dark', bass: 'pulse', lead: 'brass', lead2: 'horn', arp: 'seq', bell: 'bell' },
    ph: {
      N1: '1:1.5 1:1.5 3:1 | 2b:1.5 2b:1.5 4:1 | 5:1.5 3:1.5 1:1 | 7:1.5 5:1.5 4:1',
      N2: '8:1.5 8:1.5 10:1 | 9b:1.5 9b:1.5 11:1 | 11:2 9:1 7:1 | 5:2 3:1 1:1',
      N3: '8:2 6:1 8:1 | 9:2 7:1 9:1 | 10:2 8:2 | 5:4',
      N4: '10:2 8:1 10:1 | 11:2 9:1 11:1 | 12:2 11:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.6, prog: 'i', hit: true, pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X.......x.......', metal2: '..........o.....' }, timp: 'two' },
      { n: 'A1', bars: 16, lv: 0.86, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5 }, drums: 'heavy', timp: 'hits', lead: 'N1 N2 N1 N2', fill: 'tom' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'two', lead: { ph: 'N3 N4 N3 N4', harm: -2 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.94, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'hits', lead: { ph: 'N1 N2 N1 N2', inst: 'horn' }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X...............', t4: '........o.......', metal2: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.22, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.48, reg: [49, 78], gate: 0.5, jump: 0.08 }, drums: 'heavy', timp: 'beats', lead: { ph: 'N3 N4 N3 N4', harm: -2 }, lead2: { ph: 'N3 N4 N3 N4', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
      { n: 'A3', bars: 16, lv: 1.0, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.5, reg: [49, 78], gate: 0.5, jump: 0.1 }, drums: 'heavy', timp: 'gallop', lead: { ph: 'N1 N2 N1 N2', harm: -2 }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
    ],
  });

  Track('ground', {
    desc: 'Tense ground assault: low toms, a menacing plucked ostinato and brass swells in phrygian',
    bpm: 100, trim: 2.99, root: 'A', mode: 'phrygian', loopFrom: 'A1', tens: { x1: false },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'D', 'E', 'A1', 'C', 'B1', 'A2', 'D', 'B2', 'E', 'A1', 'E'], ['A1', 'C', 'B1', 'A2', 'D', 'B2', 'E', 'A1', 'B1', 'C', 'A2', 'B2', 'D', 'E', 'A1', 'E']],
    inst: { pad: 'dark', bass: 'moog', lead: 'horn', lead2: 'brass', arp: 'seq', bell: 'chime' },
    ph: {
      G1: '8:3 7:1 | 5:2 3:2 | 9:3 8:1 | 6:2 4:2',
      G2: '5:2 8:2 | 7:2 5:2 | 7:3 5:1 | 4:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X...............', shk: 'o.o.o.o.o.o.o.o.' }, hit: true },
      { n: 'A1', bars: 8, lv: 0.7, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, bell: { dens: 0.15, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'B1', bars: 8, lv: 0.82, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, lead: 'G1 G2', timp: 'two', bell: { dens: 0.2, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: '..o...o...o...o.', hat: 'o.o.o.o.o.o.o.o.' }, timp: 'beats' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: false, drums: { t5: 'X...............', metal2: '..........o.....' }, lead: false, bell: { dens: 0.2, res: 1, reg: [64, 86], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 0.95, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.52, reg: [45, 72], gate: 0.6, jump: 0.08 }, drums: 'ominous', lead: { ph: 'G1 G2', inst: 'brass', harm: -2 }, timp: 'beats', fill: 'tom' },
      { n: 'D', bars: 8, lv: 1.05, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.55, reg: [45, 72], gate: 0.6, jump: 0.1 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: 'o.o.o.o.o.o.o.o.', hat: 'xoxoxoxoxoxoxoxo', snare: '........x.......' }, timp: 'gallop', lead: { ph: 'G2 G1', inst: 'brass', harm: -2 }, fill: 'roll' },
      { n: 'E', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.45, reg: [45, 69], gate: 0.6 }, drums: 'ominous', lead: 'G1 G2' },
    ],
  });

  Track('gnn', {
    desc: 'Galactic News Network: a confident, upbeat broadcast bed with brass stabs and a bright ident theme',
    bpm: 120, trim: 0.95, root: 'C', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'D', 'E', 'A1', 'B', 'C', 'A2', 'D', 'B2', 'E', 'A3', 'C', 'A1', 'B', 'E'], ['A1', 'B', 'A2', 'D', 'C', 'A3', 'B2', 'E', 'A1', 'C', 'B', 'A2', 'E', 'D', 'B2', 'A3', 'A1', 'C', 'B', 'E']],
    inst: { pad: 'organ', bass: 'pulse', lead: 'synth', lead2: 'bell', arp: 'seq', bell: 'vibes' },
    ph: {
      G1: '5:.5 5:.5 8:1.5 5:.5 8:1 | 7:.5 7:.5 9:1.5 7:.5 9:1 | 8:.5 8:.5 10:1.5 8:.5 10:1 | 6:.5 6:.5 8:1 9:.5 10:.5 11:1',
      G2: '9:1 11:.5 9:.5 6:1 9:1 | 9:1 7:.5 9:.5 12:1 9:1 | 12:2 10:1 8:1 | 8:3 r:1',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.7, prog: 'I V vi IV', hit: true, pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.9 }, bass: 'sync', drums: 'news', fill: 'snare' },
      { n: 'A1', bars: 8, lv: 0.78, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.7 }, bass: 'sync', lead: 'G1 G1', drums: 'news', arp: { pat: '0.2.1.3.', res: 2, vel: 0.3, reg: [64, 88] } },
      { n: 'A2', bars: 8, lv: 0.88, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.7 }, bass: 'oct8', lead: { ph: 'G1 G1', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.32, reg: [64, 88] }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'ii V I I | vi IV V V', pad: { p: 'stab', pat: 'x.x.x.x.x.x.x.x.', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.55, gate: 0.5 }, bass: 'oct8', lead: 'G2 G2', drums: 'news', arp: { p: 'up', vel: 0.32, reg: [64, 88] } },
      { n: 'C', bars: 8, lv: 0.6, prog: 'I V vi IV | I V vi V', pad: { p: 'sus', inst: 'warm' }, bass: 'half', lead: false, arp: { pat: '0.2.1.3.', res: 2, vel: 0.34, reg: [64, 88] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.35, res: 2, reg: [72, 95], vel: 0.55 } },
      { n: 'A3', bars: 8, lv: 0.95, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.75 }, bass: 'oct8', lead: { ph: 'G1 G1+2', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.34, reg: [64, 90], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 }, fill: 'snare' },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'ii V I I | vi IV V V', pad: { p: 'stab', pat: 'x.x.x.x.x.x.x.x.', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.6, gate: 0.5 }, bass: 'oct8', lead: { ph: 'G2 G2', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.34, reg: [64, 90], jump: 0.08 }, timp: 'two', fill: 'snare' },
      { n: 'D', bars: 8, lv: 0.82, prog: 'ii V I I | ii V I V', pad: { p: 'sus', inst: 'warm' }, bass: 'oct8', lead: { ph: 'G2 G2', inst: 'vibes', vel: 0.8 }, drums: { kick: 'x.....x.x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, arp: { p: 'up', vel: 0.3, reg: [64, 88] }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 } },
      { n: 'E', bars: 8, lv: 0.8, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.65 }, bass: 'sync', lead: 'G1 G2', drums: 'news', arp: { pat: '0.2.1.3.', res: 2, vel: 0.3, reg: [64, 88] } },
    ],
  });

  Track('council', {
    desc: 'Galactic Council: grand ceremonial brass fanfare, hymn-like choir and timpani',
    bpm: 72, trim: 1.53, root: 'Bb', mode: 'major', oct: 1, loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'E', 'C', 'A1', 'B', 'E', 'A2', 'B2', 'E'], ['A1', 'B', 'A2', 'C', 'B2', 'E', 'A3', 'C', 'A1', 'A2', 'B', 'B2', 'E']],
    inst: { pad: 'organ', bass: 'deep', lead: 'horn', lead2: 'brass', arp: 'harp', bell: 'bell', choir: 'aah' },
    ph: {
      F1: '1:1 5:1 8:2 | 8:1.5 6:.5 5:1 3:1 | 5:2 7:2 | 7:3 r:1',
      CA: '1:1.5 3:.5 5:2 | 5:1.5 6:.5 7:1 8:1 | 8:1.5 7:.5 6:2 | 5:1.5 4:.5 3:2 | 4:2 6:1 8:1 | 8:1.5 6:.5 5:2 | 4:1.5 5:.5 6:1 4:1 | 5:3 r:1',
      CB: '1:1.5 3:.5 5:2 | 5:1.5 6:.5 7:1 8:1 | 8:1.5 7:.5 6:2 | 5:1.5 4:.5 3:2 | 4:2 6:2 | 5:2 7:2 | 8:3 5:1 | 5:2 1:2',
      CC: '6:2 5:1 3:1 | 4:2 6:2 | 5:2 3:1 1:1 | 2:2 5:2 | 6:2 8:2 | 6:2 4:2 | 5:2 7:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.7, prog: 'I:2 V:2', hit: true, pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'F1', inst: 'brass' }, timp: { p: 'beats', vel: 0.8 }, choir: { vel: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.8, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'CA', timp: 'two', choir: { vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.9, prog: 'I V vi iii | IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CB', inst: 'brass', harm: -2 }, timp: 'beats', choir: { vel: 0.7 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B', bars: 8, lv: 0.72, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'organ' }, bass: 'half', lead: { ph: 'CC', inst: 'horn' }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.85 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.6 }, bell: { dens: 0.2, res: 1, reg: [72, 91], vel: 0.5 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.3, res: 1, reg: [72, 91], vel: 0.55 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'A3', bars: 8, lv: 0.98, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CA', harm: -2 }, lead2: { ph: 'CA', inst: 'brass', oct: -1, vel: 0.6 }, timp: 'beats', choir: { vel: 0.9 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'CC', inst: 'brass', harm: -2 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.82, prog: 'I V vi iii | IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'CB', timp: 'two', choir: { vel: 0.6 } },
    ],
  });
  Track('procession', {
    desc: 'The procession: a processional march in the nobilmente manner — a solo horn carries a long-breathed theme over tuba and trombones on the step, the snare alone keeps the march with a firm bass drum on the one, strings and the organ of the chamber behind, the choir entering as the theme returns; the flat-sixth lift for the big phrase, a lyrical trio, the drums fall away for a hymn and the full chamber answers it; rare on the map once the empire stands among others, regular at war',
    bpm: 84, trim: 2.6, tone: { lo: 0.8, hi: -2.5 }, root: 'F', mode: 'major', loopFrom: 'A1', tens: false, rubato: 0.01, mix: { drums: 1.0, lead: 1.15, bass: 1.1, choir: 1.1 },
    fx: { stage: 0.7, verb: 1.2 }, sends: { drums: { stage: 0.06, verb: 0.03, dly: 0 } },
    forms: [['A1', 'A2', 'B', 'T', 'D', 'R', 'E'], ['A1', 'B', 'T', 'A2', 'D', 'R', 'E'], ['A1', 'A2', 'T', 'B', 'D', 'R', 'E'], ['A1', 'T', 'A2', 'B', 'D', 'R', 'E']],
    alts: [{}, { bell: 'glass', pad2: 'cellos' }, { pad: 'organSoft', choir: 'choirWomen' }],
    inst: { pad: 'strings', pad2: 'lowBrass', bass: 'lowBrass', lead: 'hornSolo', lead2: 'horn', arp: 'harp', bell: 'bell', choir: 'aah', choir2: 'choirMen' },
    ph: {
      A1: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 2:2', A2: '1:3 2:1 | 3:2 5:2 | 8:3 7:1 | 5:4',             // the theme: a slow climb from the tonic, and its answer to the octave
      B1: '5:2 6:1 8:1 | 10:3 9:1 | 8:2 6:2 | 5:4', B2: '6:2 5:1 6:1 | 8:3 10:1 | 9:2 8:1 7:1 | 8:4',  // the big phrase, over the flat-sixth lift
      CD: '4:2 3:1 2:1 | 5:3 4:1 | 3:2 2:2 | 1:4',                                                     // the cadence
      T1: '3:3 4:1 | 5:2 8:2 | 7:3 6:1 | 5:4', T2: '6:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4',                  // the trio, lyrical
      CT: '1:2 3:2 | 4:2 5:2 | 6:2 4:2 | 5:4',                                                          // the low brass beneath
      HY: '5:4 | 6:4 | 5:2 4:2 | 3:4', HY2: '3:4 | 4:4 | 5:2 6:2 | 5:4',                                // the hymn while the votes are cast
      CL: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4',                                                            // the call (the game's leitmotif) that opens
    },
    sec: [
      // the approach grows out of the interlude: strings and the horn call alone, the harp, then ghosted snare strokes under the horn, the cadence only with the theme
      { n: 'intro', bars: 8, cres: [0.5, 0.78], prog: 'I:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.5 }, bass: { pat: ['....', '....', '....', '....', '1---', '1---', '1---', '1---'], inst: { p: 'lowBrass', att: 0.14 }, vel: 0.75 },
        arp: { pat: '0...2...1...3...', res: 1, vel: 0.3, reg: [55, 81] }, lead: { ph: ['CL r2 CL', 'r2 CL r2'], oct: -1, vel: 0.72 },
        drums: { bd: ['................', '................', '................', '................', 'o...............', 'o...............', 'X.......o.......', 'X.......x.......'], sn: ['................', '................', '................', '................', 'o.......o.......', 'o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'X.o.x.o.x.x.xxxx'] } },
      { n: 'A1', bars: 16, lv: 0.78, prog: 'I I IV V | I vi ii V | I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [38, 55], vel: 0.65, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A1 A2 B1 CD'], oct: -1, vel: 0.85 }, drums: { p: 'field', vel: 0.85 }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.38 }, fill: 'snS' },
      { n: 'A2', bars: 16, lv: 0.86, prog: 'I I IV V | I vi ii V | I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.8 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.75, gate: 0.7 }, bass: { p: 'walk', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A2 A1 A2 CD'], oct: -1, vel: 0.9 }, lead2: { ph: ['CT CT CT CT', 'r4 CT r4 CT'], inst: 'lowBrass', oct: -1, vel: 0.6, skip: 0.3 }, drums: { p: 'field', vel: 0.95 }, timp: 'two', choir: { n: 3, reg: [60, 76], vel: 0.6 }, choir2: { n: 3, reg: [38, 57], vel: 0.5 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.4 }, fill: 'bigS' },
      { n: 'B', bars: 16, cres: [0.9, 1.0], prog: 'IV V | iii vi | bVI bVII | I I | IV V | iii vi | bVI bVII | V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.85, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B1 B2 B1 CD', 'B1 B2 B2 CD'], oct: -1, vel: 0.95 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.5 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.8 }, choir2: { n: 3, reg: [38, 57], vel: 0.7 }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.42 }, fill: 'bigS' },
      { n: 'T', bars: 16, lv: 0.6, prog: 'vi IV | I V | vi ii | V I | vi IV | I V | ii V | I I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.65 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { p: 'whole', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.7 },
        lead: { ph: ['T1 T2 T1 T2', 'T1 T2 A1 CD', 'r4 T1 T2 CD'], oct: -1, vel: 0.75 }, arp: { p: 'up8', vel: 0.3, reg: [55, 81], skip: 0.3 }, drums: { bd: 'X...............', sn: ['x...............', 'o...o...........', 'x...............', 'o.o.o.o.o.o.xxxx'], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [72, 96], vel: 0.4 } },
      { n: 'D', bars: 8, lv: 0.48, prog: 'ii:2 V:2 | iii:2 vi:2', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { p: 'whole', inst: 'deep' },
        lead: { ph: ['HY HY2', 'r4 HY2', 'HY r4'], oct: -1, vel: 0.6 }, arp: { p: 'up8', vel: 0.28, reg: [57, 81], skip: 0.3 }, choir2: { n: 3, reg: [38, 55], vel: 0.5, soft: true }, bell: { dens: 0.14, res: 1, reg: [72, 96], vel: 0.44 }, rise: 2 },
      { n: 'R', bars: 8, lv: 1.04, hit: 'tam', cr: true, prog: 'bVI bVII | I I | IV V | I I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.95, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B1 CD', 'B2 CD'], oct: -1, vel: 1.0 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.55 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.9 }, choir2: { n: 3, reg: [38, 57], vel: 0.8 }, bell: { dens: 0.18, res: 2, reg: [72, 96], vel: 0.5 }, fill: 'bigS' },
      { n: 'E', bars: 8, lv: 0.68, prog: 'I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [38, 55], vel: 0.55, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.08 }, vel: 0.8 },
        lead: { ph: ['A1 CD', 'A2 CD'], oct: -1, vel: 0.75 }, drums: { p: 'field', vel: 0.7 }, choir: { n: 3, reg: [60, 76], vel: 0.45 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.38 } },
    ],
  });
  // The council chamber is rarely open for more than a minute, so it plays an abbreviated, ceremonial reading of the procession: the same
  // composition with the long sections halved (phrase lists and progressions truncate with them) and forms that reach the big phrase within
  // the first quarter minute — but with the pomp of the chamber: a tam-tam and a timpani roll under a brass fanfare on the call, the organ
  // instead of the strings, the horn section and the brass doubling the solo horn, timpani on the step, the choir forward, a brighter room.
  (function () {
    const d = JSON.parse(JSON.stringify(TRACKS.procession)); delete d._p; delete d.id;
    d.desc = 'Galactic Council: the procession in state — the same march, abbreviated and ceremonial: tam-tam and timpani under a brass fanfare on the call, the organ of the chamber, horns and brass doubling the theme, the big phrase within the first quarter minute, the hymn while the votes are cast, the full chamber for the result';
    d.bpm = 78; d.tone = { lo: 1.0 }; d.fx = { stage: 0.8, verb: 1.25 }; d.sends = { drums: { stage: 0.15, verb: 0.08, dly: 0 } };
    d.mix = Object.assign({}, d.mix, { choir: 1.3, lead: 1.1, drums: 1.0, pad: 1.1 });
    d.forms = [['B', 'A1', 'R', 'D', 'E'], ['B', 'A2', 'D', 'R', 'E'], ['A1', 'B', 'R', 'T', 'E'], ['B', 'T', 'A2', 'R', 'E']];
    for (const s of d.sec) {
      if (s.n === 'A1' || s.n === 'A2' || s.n === 'B' || s.n === 'T') s.bars = 8;
      if (s.pad && s.pad.inst === 'strings') s.pad = { p: 'sus', inst: 'organ', n: 4, reg: [50, 76], vel: 0.8, width: 1.3 };      // the chamber's organ carries the harmony, spread wide
      else if (s.pad) s.pad.width = 1.3;
      if (s.choir) s.choir.vel = Math.min(1.0, (s.choir.vel || 0.6) * 1.2);
      if (s.n === 'A1') { s.lead2 = { ph: '@', inst: 'horn', oct: -1, vel: 0.45 }; s.timp = 'two'; }
      if (s.n === 'A2') s.timp = 'two';
      // the military orchestra: a sustained brass-section bed under the big phrase and the result (the low brass keeps the step), cymbals on the entries
      if (s.n === 'B') { s.lead2 = { ph: '@', inst: 'brass', oct: -1, vel: 0.5 }; s.timp = 'beats'; s.pad2 = { p: 'sus', inst: 'brass', n: 4, reg: [45, 69], vel: 0.55, width: 1.3 }; s.bass = { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 }; s.cr = true; }
      if (s.n === 'R') { s.lead2 = { ph: '@', inst: 'brass', oct: -1, vel: 0.6 }; s.bell = { dens: 0.22, res: 2, reg: [72, 96], vel: 0.5 }; s.pad2 = { p: 'sus', inst: 'brass', n: 4, reg: [45, 69], vel: 0.65, width: 1.3 }; s.choir2 = { n: 3, reg: [38, 57], vel: 0.85 }; s.cr = true; }
      if (s.n === 'A2') { s.pad2 = { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.8, gate: 0.7 }; s.choir2 = { n: 3, reg: [38, 57], vel: 0.6 }; }
      if (s.n === 'intro') {
        s.bars = 4; s.cres = [0.7, 0.92]; s.hit = 'tam'; s.prog = 'I:2 V:2';
        s.pad = { p: 'swell', inst: 'organ', n: 4, reg: [50, 76], vel: 0.85 }; s.pad2 = { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.6 }; s.arp = undefined;
        s.bass = { p: 'whole', inst: { p: 'lowBrass', att: 0.08 }, vel: 0.9 };
        s.lead = { ph: ['CL', 'r1 CL'], inst: 'brass', oct: -1, vel: 0.85 }; s.lead2 = { ph: '@', inst: 'horn', oct: -1, vel: 0.55 };
        s.timp = { p: 'two', roll: 2 }; s.choir = { n: 3, reg: [60, 76], vel: 0.55 };
        s.drums = { bd: 'X.......x.......', sn: ['o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'X.o.x.o.x.o.x.o.', 'X.x.x.x.x.x.xxxx'] };
      }
    }
    d.loopFrom = 'A1';
    Track('council2', d);
  })();

  Track('orion', {
    desc: 'Ancient and mysterious, awe: deep drones, metallic chimes and a double-harmonic melody',
    bpm: 54, trim: 3.19, root: 'D', mode: 'dblHarm', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B', 'C', 'A1', 'A3'], ['A1', 'B', 'A2', 'C', 'A3', 'A1', 'B', 'C', 'A3']],
    inst: { pad: 'drone', bass: 'deep', lead: 'harp', lead2: 'chime', bell: 'chime', choir: 'ooh' },
    ph: {
      O1: '5:4 | 3:2 2:2! | 1:3! 2:1 | 4:4',
      O2: '6:3 5:1 | 4:4 | 3:2 5:2 | 1:4',
      O3: '8:2 6:2 | 4:2 6:2 | 6:3 4:1 | 2:4',
      O4: '3:2 5:2 | 8:3 5:1 | 6:4 | 1:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'I:4', hit: true, pad: { p: 'sus', n: 3, reg: [38, 57], vel: 0.9 }, bell: { dens: 0.3, res: 1, reg: [62, 86], vel: 0.55 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: 'O1 O2', bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.8 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A2', bars: 8, lv: 0.72, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: 'O1 O2', choir: { v1: 'o', v2: 'u', vel: 0.6 }, bell: { dens: 0.25, res: 1, reg: [62, 86], vel: 0.5 }, timp: { p: 'hits', vel: 0.5, dur: 3 } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bII:2 I:2 bII:1 I:1', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: { ph: 'O3 O4', inst: 'flute', vel: 0.8 }, lead2: { ph: 'O3 O4', inst: 'chime', oct: 1, vel: 0.35 }, choir: { v1: 'a', v2: 'o', vel: 0.75 }, timp: 'two', drums: { whisper: 'x...............' } },
      { n: 'C', bars: 8, lv: 0.45, prog: 'I:2 bII:2 I:2 iv:2', pad: { p: 'swell', n: 3, reg: [38, 57] }, bass: false, lead: false, bell: { dens: 0.35, res: 1, reg: [62, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, drums: { whisper: ['x...............', '................', 'x...............', '................'] }, timp: false, rise: 1 },
      { n: 'A3', bars: 8, lv: 0.95, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', inst: 'dark', n: 4, reg: [40, 62] }, bass: 'half', lead: { ph: 'O1 O2', inst: 'horn', vel: 0.8, harm: -2 }, lead2: { ph: 'O1 O2', inst: 'chime', oct: 1, vel: 0.35 }, choir: { v1: 'a', v2: 'a', vel: 0.9 }, timp: 'beats', drums: { kick: 'x...............', metal2: '................' }, bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.5 } },
    ],
  });

  Track('antarans', {
    desc: 'Menacing and dissonant: tritone brass, cluster chords, whispers and metal hits in an unsettled 5/4',
    bpm: 72, trim: 2.6, meter: 5, root: 'C#', mode: 'octaH', loopFrom: 'A1', lintMin: 0.7, tens: { x1: false },
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'D', 'A1', 'B', 'C', 'A2', 'D', 'A3'], ['A1', 'B', 'A2', 'C', 'D', 'A3', 'A1', 'C', 'B', 'A2', 'A3', 'D']],
    inst: { pad: 'dark', bass: 'moog', lead: 'horn', lead2: 'brass', arp: 'seq', bell: 'chime', choir: 'uuh' },
    ph: {
      X1: '1:3 2:2! | 1:3 5:2! | 2:3 1:2! | 2:5',
      X2: '1:3 5:2! | 6:3 5:2! | 5:3 8:2 | 5:5',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'icl:2 i:2', hit: true, pad: { p: 'swell', n: 4, reg: [36, 60] }, drums: { whisper: ['x.........', '..........'], t5: 'X.........' } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..x.......', click3: 'o.o.o.o.o.', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', t4: '..o...o...', metal2: '..x...x...', click3: 'o.o.o.o.o.', hat: 'o.o.o.o.o.' }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X1 X2', choir: { v1: 'u', v2: 'o', vel: 0.5 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'icl:1 bII:1 io:1 bV:1 icl:1 bII:1 io:1 V:1', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', snare: '..........', metal2: 'x.x.x.x.x.', click3: 'o.o.o.o.o.', hat: 'x.x.x.x.x.' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X2 X1', inst: 'brass', harm: -3 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'icl:2 bII:2 io:2 V:2', pad: { p: 'swell', n: 4, reg: [36, 60] }, bass: false, drums: { whisper: ['x.........', '..........', 'x.........', '..........'], whisper2: ['..........', '......x...', '..........', '......x...'] }, bell: { dens: 0.3, res: 1, reg: [60, 84], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, rise: 2 },
      { n: 'A3', bars: 8, lv: 1.0, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', metal2: 'o.o.o.o.o.', hat: 'x.x.x.x.x.', snare: '......x...' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X1 X2', inst: 'brass', harm: -3 }, choir: { v1: 'a', v2: 'o', vel: 0.8 }, fill: 'tom' },
      { n: 'D', bars: 8, lv: 0.7, prog: 'i:2 bII:2 icl:2 io:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..o.......', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X2 X1' },
    ],
  });

  Track('victory', {
    desc: 'Triumphant: brass fanfares, rolling timpani and a soaring major theme',
    bpm: 100, trim: 1.69, root: 'D', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'B', 'A2', 'C', 'B2', 'D', 'A3', 'C', 'A1', 'B', 'A2', 'D', 'B2', 'A3', 'C', 'A3'], ['A1', 'C', 'B', 'A2', 'D', 'B2', 'A3', 'A1', 'B', 'C', 'A2', 'B2', 'D', 'A3', 'C', 'A3']],
    inst: { pad: 'strings', bass: 'sub', lead: 'brass', lead2: 'bell', arp: 'arp', bell: 'glass', choir: 'aah' },
    ph: {
      V1: '5:1 8:1 10:2 | 9:1.5 8:.5 7:1 5:1 | 10:1.5 8:.5 6:2 | 4:1 6:1 8:2',
      V2: '8:1.5 10:.5 12:2 | 12:1.5 11:.5 9:1 7:1 | 11:1.5 10:.5 8:2 | 7:2 9:2',
      V3: '11:1.5 10:.5 8:2 | 9:2 7:2 | 8:3 5:1 | 8:4',
      VB: '10:2 8:2 | 11:2 8:2 | 10:2 5:2 | 7:2 9:2',
      VC: '10:2 8:2 | 11:2 8:2 | 9:2 7:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.75, prog: 'I:2 V:2', hit: true, pad: 'sus', bass: 'whole', timp: { p: 'roll', roll: 1 }, lead: { ph: 'r1 V1', inst: 'brass' }, drums: false },
      { n: 'A1', bars: 8, lv: 0.85, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: 'V1 V2', timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'B', bars: 8, lv: 0.78, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'horn' }, choir: { v1: 'o', v2: 'a', vel: 0.8 }, timp: 'two', bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V1 V3', harm: -2 }, lead2: { ph: 'V1 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.7 }, arp: { p: 'up', vel: 0.3, reg: [57, 83] }, fill: 'roll' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { v1: 'a', v2: 'o', vel: 0.8 }, bell: { dens: 0.35, res: 2, reg: [72, 93], vel: 0.55 }, timp: { p: 'hits', roll: 1 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'brass', harm: -2 }, lead2: { ph: 'VB VC', inst: 'bell', oct: 1, vel: 0.4 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'D', bars: 8, lv: 0.9, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: { ph: 'V1 V2', inst: 'horn' }, timp: 'two', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.5 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 1.05, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V2 V3', harm: -2 }, lead2: { ph: 'V2 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], hat: 'x.x.x.x.x.x.x.x.' }, choir: { vel: 0.9 }, arp: { p: 'up', vel: 0.3, reg: [57, 83], jump: 0.1 }, fill: 'roll' },
    ],
  });

  Track('defeat', {
    desc: 'Somber defeat: slow falling lines, mourning strings and a lone bell',
    bpm: 56, trim: 2.73, root: 'F', mode: 'minor', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'E', 'C', 'A1', 'E'], ['A1', 'B', 'A2', 'C', 'E', 'A3', 'C', 'A1', 'E']],
    inst: { pad: 'strings', bass: 'deep', lead: 'flute', lead2: 'bell', bell: 'glass', choir: 'uuh' },
    ph: {
      L1: '5:2 3:1 1:1 | 6:2 4:1 3:1 | 5:2 3:1 5:1 | 7:2 5:2',
      L2: '6:2 4:1 6:1 | 5:2 3:2 | 7#:2 5:2 | 3:2 1:2',
      L3: '8:3 7:1 | 6:2 5:2 | 5:2 3:1 5:1 | 3:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'i:2 bVI:2', pad: { p: 'swell' }, bell: { dens: 0.25, res: 1, reg: [60, 84], vel: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.55, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'bell', vel: 0.7 }, timp: { p: 'hits', vel: 0.4, dur: 3 } },
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', vel: 0.75 }, choir: { vel: 0.55 }, timp: { p: 'hits', vel: 0.4, dur: 3 }, bell: { dens: 0.2, res: 1, reg: [72, 93], vel: 0.45 } },
      { n: 'B', bars: 8, lv: 0.8, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'L3 L2', inst: 'horn', vel: 0.8 }, choir: { v1: 'o', v2: 'a', vel: 0.75 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.42, prog: 'bVI:2 iv:2 i:2 V:2', pad: { p: 'swell' }, bass: false, lead: false, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', harm: -2, vel: 0.7 }, lead2: { ph: 'L1 L2', inst: 'bell', oct: 1, vel: 0.35 }, choir: { vel: 0.6 }, timp: { p: 'hits', vel: 0.4, dur: 3 } },
      { n: 'E', bars: 8, lv: 0.45, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L3 L2', inst: 'bell', vel: 0.65 }, bell: { dens: 0.2, res: 1, reg: [72, 93], vel: 0.4 } },
    ],
  });
  // ================================================================== diplomacy race themes (45-70 s loops)
  Track('race:alkari', {
    desc: 'Alkari: airy flute over harp-like plucks, soaring major pentatonic and wind chimes',
    bpm: 88, trim: 1.98, root: 'G', mode: 'major', tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'airPad', bass: 'deep', lead: 'flute', lead2: 'chime', arp: 'kora', bell: 'chime' },
    ph: {
      AL1: '5:1.5 8:.5 6:1 5:1 | 9:1.5 8:.5 6:1 5:1 | 10:1.5 9:.5 8:1 6:1 | 5:1.5 6:.5 8:2',
      AL2: '8:.5 9:.5 10:1 9:1 8:1 | 10:.5 12:.5 13:1 12:1 10:1 | 9:.5 10:.5 12:1 10:1 9:1 | 8:4',
      AL3: '6:2 5:1 3:1 | 5:2 6:2 | 8:3 6:1 | 5:4',
      AL4: '8:2 6:1 5:1 | 6:2 8:2 | 10:3 8:1 | 9:4',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.75, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'whole', lead: 'AL1 AL2', arp: { pat: '0121', res: 2, vel: 0.4, reg: [55, 79] }, drums: { shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'vi IV I V | vi IV I V', pad: 'sus', bass: 'half', lead: 'AL3 AL4', arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.3, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 0.85, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'half', lead: 'AL1 AL2', lead2: { ph: 'AL1 AL2', inst: 'chime', oct: 1, vel: 0.3 }, arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.25, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
    ],
  });

  Track('race:bulrathi', {
    desc: 'Bulrathi: deep stomping drums and low, heavy brass in D minor',
    bpm: 76, trim: 1.45, root: 'D', mode: 'minor', tonic: 50, tens: false,
    forms: [['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'], ['A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B']],
    inst: { pad: 'dark', bass: 'deep', lead: 'horn', lead2: 'brass', bell: 'chime', choir: 'uuh' },
    ph: {
      B1: '1:2 3:1 5:1 | 6:2 4:2 | 5:2 7:2 | 1:4',
      B2: '8:2 7:1 5:1 | 6:2 8:2 | 7:2 5:2 | 5:2 7#:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i bVI bVII i | i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: 'B1 B2', timp: 'two', drums: { t5: 'X.......x.......', t4: '....x.......x.x.', kick: 'x...............', shk: 'o.o.o.o.o.o.o.o.', rim: '..o.......o.....' }, bell: { dens: 0.2, res: 1, reg: [64, 90], vel: 0.7 } },
      { n: 'B', bars: 8, lv: 0.95, prog: 'i bVI bVII i | i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: { ph: 'B1 B2', harm: -2 }, lead2: { ph: 'B1 B2', inst: 'horn', oct: -1, vel: 0.6 }, timp: 'beats', choir: { v1: 'u', v2: 'o', vel: 0.55, reg: [50, 69] }, drums: { t5: 'X.....x.X.......', t4: '....x.......x.x.', t3: '..o.......o.....', kick: 'x.......x.......', clap: '....o.......o...', shk: 'x.x.x.x.x.x.x.x.', rim: '..o.......o.....' }, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.7 }, fill: 'tom' },
      { n: 'C', bars: 4, lv: 0.85, prog: 'i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: 'B1', timp: { p: 'hits', roll: 1 }, drums: { t5: 'X.......x.......', t4: '....x.......x.x.' } },
    ],
  });

  Track('race:darlok', {
    desc: 'Darlok: eerie minor pads, whispering noise swells and plucked shadows',
    bpm: 66, trim: 2.61, root: 'F#', mode: 'harmonic', tens: false,
    forms: [['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'], ['A', 'A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B', 'B']],
    inst: { pad: 'airPad', bass: 'deep', lead: 'pizz', lead2: 'flute', bell: 'chime', choir: 'uuh' },
    ph: {
      DK1: '5:1.5 6:.5 5:1 3:1 | 1:2 3:2 | 4:2 6:2 | 6:3 4:1',
      DK2: '5:1.5 6:.5 5:1 3:1 | 3:2 1:2 | 5:2 7:2 | 5:3 r:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.7, prog: 'i:2 iv:2 i:2 V:2', pad: { p: 'sus', n: 3, reg: [45, 66] }, bass: 'whole', lead: 'DK1 DK2', choir: { vel: 0.45 }, drums: { whisper: ['x...............', '................'], whisper2: ['................', '........x.......'] } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'i:2 iv:2 i:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 66] }, bass: 'whole', lead: { ph: 'DK2 DK1', inst: 'flute', vel: 0.55 }, lead2: { ph: 'DK2 DK1', inst: 'pizz', oct: -1, vel: 0.5 }, bell: { dens: 0.2, res: 1, reg: [66, 90], vel: 0.45 }, choir: { v1: 'u', v2: 'o', vel: 0.55 }, drums: { whisper: ['x...............', '................'], whisper2: ['................', '........x.......'], rim: '..o.......o.....' } },
    ],
  });

  Track('race:human', {
    desc: 'Human: a noble orchestral-synth march with snare, strings and brass',
    bpm: 108, trim: 1.02, root: 'F', mode: 'major', tens: false,
    forms: [['A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C'], ['A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B']],
    inst: { pad: 'strings', bass: 'sub', lead: 'horn', lead2: 'brass', arp: 'stab', bell: 'glass' },
    ph: {
      HM1: '5:1.5 5:.5 8:2 | 8:1.5 6:.5 4:2 | 5:1.5 7:.5 9:2 | 8:3 r:1',
      HM2: '6:1.5 6:.5 8:2 | 8:1.5 9:.5 8:1 6:1 | 9:1.5 7:.5 5:2 | 8:4',
      HM3: '8:2 6:1 4:1 | 5:2 8:2 | 7:2 5:2 | 8:4',
      HM4: '6:2 8:2 | 8:2 6:2 | 9:2 7:2 | 8:4',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.8, prog: 'I IV V I | vi IV V I', pad: { p: 'stab', pat: '....x.......x...', inst: 'stab', n: 3, reg: [53, 72], vel: 0.7, gate: 0.6 }, bass: 'half', lead: 'HM1 HM2', timp: 'two', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'IV I V I | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'HM3 HM4', inst: 'brass' }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I IV V I | vi IV V I', pad: { p: 'stab', pat: '....x.......x...', inst: 'stab', n: 3, reg: [53, 72], vel: 0.7, gate: 0.6 }, bass: 'walk', lead: { ph: 'HM1 HM2', harm: -2 }, lead2: { ph: 'HM1 HM2', inst: 'glass', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'C', bars: 4, lv: 0.9, prog: 'IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'HM3', inst: 'brass' }, timp: { p: 'beats', roll: 1 }, drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.'] } },
    ],
  });

  Track('race:klackon', {
    desc: 'Klackon: chittering insect clicks in whole-tone buzzing ostinati and skittering rhythms',
    bpm: 132, trim: 1.39, root: 'C', mode: 'wholetone', tens: false,
    forms: [['A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2'], ['A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B']],
    inst: { pad: 'glassPad', bass: 'pulseSyn', lead: 'seqSyn', lead2: 'marimba', arp: 'seqSyn', bell: 'vibes' },
    ph: {
      KL1: '1:.25 2:.25 1:.25 2:.25 1:.25 2:.25 3:.5 r:2 | 3:.25 4:.25 3:.25 4:.25 3:.25 4:.25 5:.5 r:2 | 5:.25 6:.25 5:.25 6:.25 5:.25 6:.25 7:.5 r:.5 7:.5 6:.5 5:.5 | 5:1 3:1 1:2',
      KL2: '1:.5 7:.5 1:.5 7:.5 3:.5 9:.5 3:.5 9:.5 | 2:.5 8:.5 2:.5 8:.5 4:.5 10:.5 4:.5 10:.5 | 3:.5 9:.5 3:.5 9:.5 5:.5 11:.5 5:.5 11:.5 | 6:1 5:1 4:1 2:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL1 KL1', arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: '....x.......x...', kick: 'x.......x.......' } },
      { n: 'B', bars: 8, lv: 0.92, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL2 KL2+1', arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: 'xxxx....xxxx....', click3: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...' } },
      { n: 'A2', bars: 8, lv: 0.85, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL1 KL1', lead2: { ph: 'KL1 KL1', inst: 'marimba', oct: 1, vel: 0.4 }, arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: '....x.......x...', kick: 'x.......x.......', rim: '..o...o...o...o.' } },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL2 KL2+1', lead2: { ph: 'KL2 KL2+1', inst: 'vibes', oct: 1, vel: 0.4 }, arp: { pat: '0120', res: 4, vel: 0.36, reg: [60, 86], gate: 0.45, jump: 0.1 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: 'xxxx....xxxx....', click3: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...', clap: '....o.......o...' } },
    ],
  });

  Track('race:meklar', {
    desc: 'Meklar: cold industrial sequencer arps, four-on-the-floor machine pulse and metal strikes',
    bpm: 128, trim: 0.96, root: 'B', mode: 'minor', tens: false,
    forms: [['A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2'], ['A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B']],
    inst: { pad: 'dark', bass: 'moogSyn', lead: 'synthSyn', lead2: 'seqSyn', arp: 'arpSawSyn', bell: 'bell' },
    ph: {
      MK1: '1:.5 5:.5 1:.5 4:.5 1:.5 3:.5 1:.5 2:.5',
      MK2: '1:.5 3:.5 5:.5 8:.5 5:.5 3:.5 1:.5 3:.5 | -1:.5 1:.5 3:.5 6:.5 3:.5 1:.5 -1:.5 1:.5 | 0:.5 2:.5 4:.5 7:.5 4:.5 2:.5 0:.5 2:.5 | 1:2 5:1 8:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i i bVI bVII | i i bVI bVII', pad: 'sus', bass: 'drive16', lead: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5 }, drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...', metal2: '..............x.' } },
      { n: 'B', bars: 8, lv: 0.92, prog: 'i bVI bVII i | i bVI bVII i', pad: { p: 'sus', inst: 'strings' }, bass: 'drive16', lead: 'MK2 MK2', arp: { pat: '0123210132012301', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5 }, drums: { kick: 'x...x...x...x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....x.......x...', metal2: '..x...x...x...x.', metal: 'x...............' } },
      { n: 'A2', bars: 8, lv: 0.88, prog: 'i i bVI bVII | i i bVI bVII', pad: 'sus', bass: 'drive16', lead: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', lead2: { ph: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', inst: 'seq', oct: 1, vel: 0.4 }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5, jump: 0.08 }, drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...', metal2: '..............x.' } },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'i bVI bVII i | i bVI bVII i', pad: { p: 'sus', inst: 'strings' }, bass: 'drive16', lead: 'MK2 MK2', lead2: { ph: 'MK2 MK2', inst: 'bell', oct: 1, vel: 0.35 }, arp: { pat: '0123210132012301', res: 4, vel: 0.42, reg: [47, 80], gate: 0.5, jump: 0.1 }, drums: { kick: 'x...x...x...x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....x.......x...', metal2: '..x...x...x...x.', metal: 'x.......x.......' }, fill: 'snare' },
    ],
  });

  Track('race:mrrshan', {
    desc: 'Mrrshan: tribal polyrhythmic percussion under a snaking phrygian-dominant reed line',
    bpm: 112, trim: 1.34, root: 'G', mode: 'phrygDom', tens: false,
    forms: [['A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C'], ['A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B']],
    inst: { pad: 'dark', bass: 'moog', lead: 'reed', lead2: 'flute', arp: 'kora', bell: 'chime', choir: 'uuh' },
    ph: {
      MR1: '1:.5 2:.5 3:1 2:.5 1:.5 3:1 | 6:1.5 5:.5 4:1 2:1 | 1:.5 2:.5 3:1 2:.5 1:.5 3:1 | 6:2 4:1 3:1',
      MR2: '5:1 6:.5 5:.5 3:1 5:1 | 9:2 6:1 4:1 | 5:1 6:.5 5:.5 3:1 5:1 | 4:1 3:1 1:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1 MR2', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR2 MR1', inst: 'flute' }, lead2: { ph: 'MR2 MR1', inst: 'reed', oct: -1, vel: 0.5 }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR1 MR2', harm: -2 }, choir: { v1: 'u', v2: 'o', vel: 0.5, reg: [55, 72] }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x.......x.......' }, fill: 'tom' },
      { n: 'C', bars: 4, lv: 0.8, prog: 'I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', shk: 'x.x.x.x.x.x.x.x.' } },
    ],
  });

  Track('race:psilon', { trim: 1.65,
    desc: 'Psilon: crystalline FM bells and glass-harmonica overtones in a cool lydian shimmer',
    bpm: 90, root: 'C', mode: 'lydian', oct: 1, tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'glassPad', bass: 'deep', lead: 'crystal', lead2: 'harp', arp: 'shimmer', bell: 'crystal' },
    ph: {
      PS1: '8:.5 7:.5 5:.5 3:.5 5:1 1:1 | 9:.5 8:.5 6:.5 4:.5 6:1 2:1 | 8:.5 7:.5 5:.5 7:.5 8:1 5:1 | 7:1 5:1 2:1 5:1',
      PS2: '6:2 8:2 | 8:2 6:2 | 7:2 5:2 | 5:2 2:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.72, prog: 'IM7 II IM7 V | IM7 II IM7 V', pad: 'sus', bass: 'whole', lead: 'PS1 PS1', arp: { p: 'up8', vel: 0.28, reg: [60, 88] }, drums: { click3: 'o...o...o...o...' } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'vi IV IM7 V | vi IV IM7 V', pad: { p: 'sus', inst: 'airPad' }, bass: 'half', lead: { ph: 'PS2 PS2', inst: 'harp', vel: 0.7 }, lead2: { ph: 'PS2 PS2', inst: 'crystal', oct: 1, vel: 0.45 }, arp: { p: 'up', vel: 0.28, reg: [60, 90] }, bell: { dens: 0.3, res: 2, reg: [84, 103], vel: 0.45 }, drums: { click3: 'o...o...o...o...' } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'IM7 II IM7 V | vi IV IM7 V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'PS1 PS2', lead2: { ph: 'PS1 PS2', inst: 'harp', oct: 1, vel: 0.4 }, arp: { p: 'updown', vel: 0.3, reg: [60, 90], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [84, 103], vel: 0.45 }, drums: { click3: 'o...o...o...o...', shk: 'o.o.o.o.o.o.o.o.' } },
    ],
  });

  Track('race:sakkra', { trim: 1.66,
    desc: 'Sakkra: hissing percussion and dry skins under a dorian-pentatonic kora line',
    bpm: 100, root: 'A', mode: 'dorian', oct: 1, tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'airPad', bass: 'pulse', lead: 'kora', lead2: 'flute', arp: 'pizz', bell: 'vibes' },
    ph: {
      SK1: '1:.5 3:.5 5:1 3:1 2:1 | 5:1.5 6:.5 5:1 3:1 | 6:1.5 5:.5 3:1 2:1 | 1:4',
      SK2: '5:.5 6:.5 8:1 6:1 5:1 | 8:1.5 6:.5 5:1 3:1 | 8:1.5 6:.5 5:1 2:1 | 2:2 1:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i:2 IV:2 i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: 'SK1 SK2', arp: { pat: '0.20.1.0', res: 2, vel: 0.3, reg: [57, 81] }, drums: { hiss: 'x.......x.......', shk: 'o.xo.xo.o.xo.xo.', t3: 'x...x..x....x...', rim: '....o.......o...' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'i:2 bVII:2 i:2 IV:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: { ph: 'SK2 SK1', inst: 'flute' }, lead2: { ph: 'SK2 SK1', inst: 'kora', oct: -1, vel: 0.5 }, arp: { pat: '0.20.1.0', res: 2, vel: 0.3, reg: [57, 81] }, drums: { hiss: 'x.......x.......', shk: 'xoxxoxoxxoxxoxox', t3: 'x...x..x....x...', t4: '......x.....x...', rim: '....o.......o...', kick: 'x.......x.......' } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'i:2 IV:2 i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: { ph: 'SK1 SK2', harm: -2 }, arp: { pat: '0.20.1.0', res: 2, vel: 0.32, reg: [57, 83], jump: 0.08 }, bell: { dens: 0.25, res: 2, reg: [76, 93], vel: 0.45 }, drums: { hiss: 'x.......x.......', shk: 'o.xo.xo.o.xo.xo.', t3: 'x...x..x....x...', t4: '......x.....x...', rim: '....o.......o...', kick: 'x.......x.......' }, fill: 'tom' },
    ],
  });

  Track('race:silicoid', {
    desc: 'Silicoid: vast resonant drones with slow metallic chimes and deep geologic pulses',
    bpm: 50, trim: 2.54, root: 'C#', mode: 'minor', tens: false,
    forms: [['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'], ['A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B']],
    inst: { pad: 'drone', bass: 'deep', lead: 'chime', lead2: 'chime', bell: 'chime', choir: 'uuh' },
    ph: {
      SL1: '5:4 | 3:4 | 4:4 | 2:4',
      SL2: '3:4 | 5:4 | 4:4 | 6:4',
      SL3: '8:4 | 6:4 | 5:4 | 2:4',
    },
    sec: [
      { n: 'A', bars: 4, lv: 0.7, prog: 'i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL1', oct: 1, vel: 0.8, echo: 0.3 }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', whisper2: ['................', '........x.......', '................', '................'] } },
      { n: 'B', bars: 4, lv: 0.85, prog: 'i:2 bII:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL2', oct: 1, vel: 0.8, echo: 0.3 }, choir: { v1: 'u', v2: 'o', vel: 0.45, reg: [49, 68] }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', metal2: ['................', '........o.......', '................', '................'] } },
      { n: 'C', bars: 4, lv: 0.8, prog: 'bVI:2 V:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL3', oct: 1, vel: 0.8, echo: 0.3 }, lead2: { ph: 'SL3', oct: 2, vel: 0.35 }, choir: { v1: 'o', v2: 'a', vel: 0.5, reg: [49, 68] }, timp: { p: 'hits', vel: 0.6, dur: 3 }, drums: { metal: 'x...............' } },
    ],
  });
  // @@TRACKS-END

  // ================================================================== espionage (spy panels borrow the music, see js/ui/spyscenes.js)
  Track('spy', {
    desc: 'Espionage: noir intrigue — walking sub-bass, clock ticks and rim clicks, muted horn phrases, hushed pads in harmonic minor',
    bpm: 94, trim: 1.87, root: 'C', mode: 'harmonic', loopFrom: 'A1', tens: false,
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'E', 'C', 'A1', 'B', 'A2', 'E', 'A3', 'C', 'E', 'A1'], ['A1', 'B', 'A2', 'C', 'E', 'A3', 'A1', 'C', 'B', 'A2', 'E', 'A3', 'C', 'A1', 'E']],
    inst: { pad: 'dark', bass: 'deep', lead: 'horn', lead2: 'vibes', arp: 'pizz', bell: 'vibes', choir: 'uuh' },
    ph: {
      Y1: '5:1.5 6:.5 5:1 3:1 | 1:2 2:1 1:1 | 4:1.5 3:.5 2:1 7:1 | 1:3 r:1',
      Y2: '3:1.5 5:.5 6:1 5:1 | 8:2 10:2 | 6:1.5 5:.5 4:1 3:1 | 2:2 7:2',
      Y3: '8:1 7:1 6:2 | 6:1 5:1 4:2 | 3:2 8:2 | 10:4',
      Y4: '6:4 | 4:2 2:2 | 7:4 | 2:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 iv:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'half', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', lead2: { ph: 'Y1 Y2', inst: 'vibes', oct: 1, vel: 0.35 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', shk: '..o...o...o...o.' } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bVI:2 iiø:2 V7:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y3 Y4', inst: 'brass', vel: 0.75 }, choir: { v1: 'u', v2: 'o', vel: 0.45 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......' } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVI:2 iv:2 V7:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'whole', lead: false, bell: { dens: 0.25, res: 1, reg: [67, 88], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, drums: { click3: 'x...x...x...x...', whisper2: ['................', '........x.......'] } },
      { n: 'A3', bars: 8, lv: 0.82, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y2 Y1', harm: -2 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......', shk: '..o...o...o...o.' } },
      { n: 'E', bars: 8, lv: 0.6, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'half', lead: 'Y1 Y4', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
    ],
  });

  // ================================================================== hostile race themes (derived)
  // The angry-ambassador variant of each race theme (research/06 §12.5: "same motif, lower register, faster, harsher timbre") keeps the
  // motifs and the form but turns the mode dark, drops the key a few semitones, speeds up, swaps the timbres for brass / saws and adds
  // martial drums. Chords are re-spelled diatonically in the new mode so the harmony keeps following the melody. js/ui/audience.js
  // plays 'race:<id>:war' whenever the ambassador is angry.
  const PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const DEG_NAME = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
  const DARK_MODE = {
    major: 'minor', lydian: 'phrygian', mixolydian: 'minor', dorian: 'phrygian', minor: 'phrygian', melodic: 'harmonic', harmonic: 'dblHarm',
    phrygian: 'locrian', phrygDom: 'dblHarm', dblHarm: 'octaH', wholetone: 'octatonic', octatonic: 'octaH', octaH: 'octaH', locrian: 'locrian',
    majPent: 'minPent', minPent: 'hirajoshi', dorPent: 'minPent', hirajoshi: 'hirajoshi',
  };
  // re-spell one progression token ('IM7:2', 'vi', 'bVII') as the diatonic chord on the same scale degree of the new scale
  function respell(tok, oldScale, newScale) {
    const parts = tok.split(':'), m = CHORD_RE.exec(parts[0]);
    if (!m) return tok;
    const has = x => newScale.indexOf(mod12(x)) >= 0;
    let root = romanRoot(m[1] + m[2]);
    const di = oldScale.indexOf(root);
    if (di >= 0 && di < newScale.length) root = newScale[di];
    const third = has(root + 3) ? 3 : has(root + 4) ? 4 : has(root + 2) ? 2 : 5;
    const fifth = has(root + 7) ? 7 : has(root + 6) ? 6 : has(root + 8) ? 8 : 7;
    let q = third === 2 ? 'sus2' : third === 5 ? 'sus4' : third === 3 ? (fifth === 6 ? 'o' : 'm') : (fifth === 8 ? '+' : '');
    let suf = '';
    if (/7|9|ø/.test(m[3]) && (q === 'm' || q === '' || q === 'o')) {
      if (q === 'o') suf = has(root + 9) ? 'o7' : has(root + 10) ? 'ø' : '';
      else if (has(root + 10)) suf = '7'; else if (has(root + 11)) suf = 'M7';
    }
    const lower = q === 'm' || q === 'o';
    let name = DEG_NAME[mod12(root)]; if (lower) name = name.toLowerCase();
    const qs = suf === 'ø' || suf === 'o7' ? suf : (q === 'm' ? '' : q) + suf;
    return name + qs + (parts[1] ? ':' + parts[1] : '');
  }
  const SOFT_LEADS = { flute: 1, reed: 1, kora: 1, pizz: 1, harp: 1, chime: 1, crystal: 1, glass: 1, seq: 1, marimba: 1, vibes: 1 };
  function warVariant(baseId, o) {
    const base = TRACKS[baseId]; if (!base) return null;
    o = o || {};
    const d = JSON.parse(JSON.stringify(base)); delete d._p; delete d.id;
    const oldScale = SCALES[base.mode || 'major'], newMode = o.mode || DARK_MODE[base.mode || 'major'] || 'phrygian', newScale = SCALES[newMode];
    const tpc = PCS[base.root], down = o.down === undefined ? 3 : o.down;
    const baseTonic = base.tonic !== undefined ? base.tonic : 57 + mod12(tpc - 57) + 12 * (base.oct || 0);
    d.root = PC_NAMES[mod12(tpc - down)]; d.mode = newMode; d.tonic = baseTonic - down; delete d.oct;
    d.bpm = Math.round(base.bpm * (o.tempo || 1.12));
    d.desc = String(base.desc || baseId).split(':')[0] + ', hostile: the same theme in ' + newMode + ', ' + Math.round((o.tempo || 1.12) * 100 - 100) + '% faster, a ' + (o.down === undefined ? 3 : o.down) + ' semitone lower key, brass leads and martial drums';
    d.inst = Object.assign({}, base.inst || {}, { pad: 'dark', bass: 'moog', lead: 'brass', lead2: 'brassStab', bell: 'bell', choir: 'choirMen' }, o.inst || {});
    d.tens = false; d.lintMin = o.lintMin || 0.6; d.trim = num(base.trim, DEFAULT_TRIM) * 1.16;   // measured at battle intensity: the war variants land on -14.5 LUFS
    const drums = o.drums || { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] };
    for (const sct of d.sec) {
      sct.prog = String(sct.prog).replace(/\|/g, ' ').trim().split(/\s+/).map(t => respell(t, oldScale, newScale)).join(' ');
      const had = typeof sct.drums === 'string' ? DRUMS[sct.drums] : sct.drums;
      sct.drums = Object.assign({}, had && typeof had === 'object' ? had : {}, drums);
      if (!sct.timp) sct.timp = 'two';
      if (typeof sct.lead === 'string') sct.lead = { ph: sct.lead, harm: -2 };
      else if (sct.lead && typeof sct.lead === 'object') { if (SOFT_LEADS[sct.lead.inst]) delete sct.lead.inst; if (sct.lead.harm === undefined) sct.lead.harm = -2; }
      if (sct.lead2 && typeof sct.lead2 === 'object' && sct.lead2.inst) sct.lead2.inst = 'brassStab';
      if (sct.pad && typeof sct.pad === 'object' && sct.pad.inst) sct.pad.inst = 'dark';
    }
    return Track(baseId + ':war', d);
  }
  const WAR = {
    alkari: { tempo: 1.2, inst: { lead: 'synth' } },                                                            // screeching, rapid
    bulrathi: { tempo: 1.1, down: 2 },                                                                           // pounding, lower still
    darlok: { tempo: 1.08, inst: { lead: 'horn' }, drums: { kick: 'x..x....x..x....', rim: '......o.......o.', hiss: '....x.......x...' } },   // heartbeat pulse
    human: {},                                                                                                   // the march in minor, snare + brass
    klackon: { tempo: 1.1, inst: { lead: 'synth', arp: 'arpSaw' } },                                             // buzzing saw swarms
    meklar: { inst: { lead: 'synth' }, drums: { kick: 'x...x...x...x...', metal2: 'x.x.x.x.x.x.x.x.', click2: 'xx.xxx.x.xx.x.xx' } },   // harsh clock
    mrrshan: { tempo: 1.15, down: 5 },                                                                           // growling low brass
    psilon: { inst: { lead: 'crystal' }, drums: { t5: 'X.......x.......', click3: 'o.o.o.o.o.o.o.o.' } },         // cold clusters, tremolo bells
    sakkra: { tempo: 1.18, drums: { t3: 'x..x..x.x..x..x.', t4: '....x.......x...', kick: 'x.......x.......', shk: 'x.x.x.x.x.x.x.x.' } },   // fast tribal toms
    silicoid: { tempo: 1.15, down: 2, inst: { lead: 'horn' }, drums: { t5: 'X.......X.......', metal: 'x.......x.......', hiss: '....x.......x...' } },   // grinding pulses
  };
  for (const r in WAR) warVariant('race:' + r, WAR[r]);
  Music._warVariant = warVariant; Music._respell = respell;
  Music._rotation = { shuffled, composeOrder, interludeFor, pickGap, GALAXY, GALAXY_EARLY, INTERLUDES, S };  // test hooks

})(window.MOO);
