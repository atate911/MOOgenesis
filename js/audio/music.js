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
//   setMood(name,{fade, soft, bridge}) snapshot() / restore(snap,{fade}) (hand the music back after a scene: track OR running playlist)
//   setSituation({solitude, contact, tension, war, grief, grandeur, energy, dark, council}) — the director's reading of the game (see 'the director' below)
//   setMotif(trackId | {ph, inst}) — the next interlude carries this phrase once (a race just met, the council's call); themeIndex()
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
        if (!cluster) for (let j = 1; j < n; j++) { const g = pick[j] - pick[j - 1]; if (g < 3) cost += (3 - g) * 2.5; if (pick[j - 1] < 48 && g <= 4) cost += 3; else if (pick[j - 1] < 43 && g <= 7) cost += 1.5; }   // the low-interval limit: no second or third below C3, open spacing below G2
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
  const PH_TOK = /^([A-Za-z][A-Za-z0-9]*)((?:[+-]\d+|~|\^|_|\*\d*\.?\d+)*)$/;   // name, then modifiers: +n/-n shift, ~ invert, ^ _ octave, *x a dynamic mark (velocity times x)
  function parseMods(s) {
    const r = { shift: 0, inv: false, oct: 0, vel: 1 };
    const re = /([+-]\d+)|\*(\d*\.?\d+)|~|\^|_/g; let m;
    while ((m = re.exec(s))) { if (m[1]) r.shift += parseInt(m[1], 10); else if (m[2]) r.vel *= parseFloat(m[2]); else if (m[0] === '~') r.inv = !r.inv; else if (m[0] === '^') r.oct++; else r.oct--; }
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
  // (the synthesized pads carry no `ens` doubling: a second copy of a looped buffer a few milliseconds behind the first swelled 5 dB at
  //  every wrap; the pad bus's chorus thickens them instead)
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
    violas: smp('vlaSus', 0.15, { att: 0.25, rel: 1.0, hp: 100, eq: [[300, -2, 1], [7000, 1.5, 'hs']] }, 'strings'),   // the viola section as a bed of its own (the early pieces)
    tremLo: smp('vcTrem', 0.2, { att: 0.6, rel: 1.4, hp: 60, eq: [[250, -2, 1], [6000, 1.5, 'hs']] }, 'warm'),        // the cellos' tremolo, low and quiet: the unease of a late game
    airPad: smp('strEns', 0.12, { att: 0.45, rel: 1.3, cut: 5000 }, 'airPad'),
    glassPad: smp('padGlass', 0.122, { ens: 0, att: 0.7, rel: 1.6 }, 'glassPad'),
    dark: smp('strEns', 0.14, { att: 0.35, rel: 1.1, cut: 2200 }, 'dark'),
    drone: smp('strEns', 0.13, { att: 0.7, rel: 1.5, cut: 1800 }, 'drone'),
    analog: smp('padSerrie', 0.143, { ens: 0, att: 0.9, rel: 2.0, hp: 110, eq: [[220, -2, 1], [1500, -2, 1.2], [6000, 1.5, 'hs']] }, 'warm'), air: smp('padAir', 0.14, { ens: 0, att: 1.4, rel: 2.6, hp: 300, eq: [[8000, 1.5, 'hs']] }, 'airPad'),
    padGlass: smp('padGlass', 0.125, { ens: 0, att: 0.7, rel: 1.6 }, 'glassPad'),
    organ: smp('organ', 0.13, {}, 'organ'), organSoft: smp('organSoft', 0.14, { att: 0.12 }, 'organ'),
    flutes: smp('fluteSus', 0.3, { att: 0.08 }, 'flute'),
    // basses: the bass section
    deep: smp('cbSus', 0.3, { att: 0.1, sub: 0.4, eq: [[200, -3, 1], [600, -2, 1]] }, 'deep'), sub: smp('cbSus', 0.3, { att: 0.1, sub: 0.5, eq: [[200, -3, 1], [600, -2, 1]] }, 'sub'),
    moog: smp('cbPizz', 0.55, {}, 'moog'), pulse: smp('cbPizz', 0.5, {}, 'pulse'),
    subSwell: smp('subBass', 0.36, { att: 1.6, rel: 1.6, sub: 0.3, eq: [[80, 2, 'ls'], [300, -2.5, 1]] }, 'sub'),   // the deep swell of the rare pieces
    // brass and winds (the horns crossfade between their mp and ff recordings with the written dynamic)
    horn: smp('hornSus', 0.38, { vib: 0, att: 0.09, hp: 90, eq: [[300, -2, 1], [2800, 2.5, 0.9], [4000, 2.5, 'hs']] }, 'horn'),
    hornSolo: smp('hornSolo', 0.34, { hp: 70, vib: 5, cutK: 14000, eq: [[2800, 3, 0.9], [4000, 2.5, 'hs']] }, 'horn'),   // vib: a delayed vibrato on the long notes; cutK: darker when soft, open when loud
    brass: smp('brassEns', 0.33, { att: 0.08, hp: 60, eq: [[4000, 2, 'hs']] }, 'brass'),
    synth: smp('brassEns', 0.33, { att: 0.06 }, 'synth'),
    tpt: smp('tptSus', 0.3, {}, 'brass'), tptSolo: smp('tptSolo', 0.56, {}, 'brass'),   // the solo trumpet's recordings sit 9 dB under the solo horn's: lifted
    lowBrass: smp('lowBrass', 0.36, { att: 0.08, eq: [[3500, 2.5, 'hs']] }, 'horn'),
    trombones: smp('tbnSus', 0.32, { att: 0.1, hp: 60, eq: [[300, -1.5, 1], [3500, 2, 'hs']] }, 'horn'), tuba: smp('tubaSus', 0.32, { att: 0.12, sub: 0.25, eq: [[200, -2, 1], [600, -1.5, 1]] }, 'deep'),   // the trombone section as a chorale voice, the tuba as a bass
    tpts: smp('tptSus', 0.26, { att: 0.08, hp: 150, eq: [[4000, 1.5, 'hs']] }, 'brass'),   // the trumpet section, soft: a chorale voice above the horns
    brassStab: smp('brassStac', 1.5, { ring: true }, 'brassStab'),
    // the University of Iowa soloists (tools/samples/iowa.py): real solo strings at three dynamics with the player's vibrato, the solo winds and brass dry and close
    vlnSolo: smp('vlnSolo', 0.566, { att: 0.1, rel: 0.9, hp: 150, leg: true, eq: [[300, -1.5, 1], [3000, 1.5, 0.8], [8000, 1.5, 'hs']] }, 'strings'), vlaSolo: smp('vlaSolo', 0.333, { att: 0.1, rel: 0.9, hp: 110, leg: true, eq: [[250, -1.5, 1], [2500, 1.5, 0.8], [7000, 1, 'hs']] }, 'strings'),
    vcSolo: smp('vcSolo', 0.389, { att: 0.12, rel: 1.0, hp: 55, leg: true, eq: [[200, -1.5, 1], [2500, 1.5, 0.8], [6000, 1, 'hs']] }, 'strings'), cbSolo: smp('cbSolo', 0.295, { att: 0.15, rel: 1.1, hp: 35, leg: true, eq: [[120, 1, 'ls'], [2000, 1, 0.8]] }, 'deep'),
    hornIowa: smp('hornIowa', 0.835, { hp: 70, cutK: 14000, eq: [[2800, 2, 0.9], [4000, 2, 'hs']] }, 'horn'), tbnSolo: smp('tbnSolo', 0.497, { att: 0.08, hp: 60, eq: [[300, -1.5, 1], [3500, 2, 'hs']] }, 'horn'), bassTbn: smp('bassTbn', 0.481, { att: 0.1, hp: 45, eq: [[300, -1.5, 1], [3000, 1.5, 'hs']] }, 'horn'), tubaIowa: smp('tubaIowa', 0.501, { att: 0.12, sub: 0.2, eq: [[200, -2, 1]] }, 'deep'), tptIowa: smp('tptIowa', 0.148, { att: 0.05, hp: 150, eq: [[4000, 1.5, 'hs']] }, 'brass'),
    bassClar: smp('bassClar', 0.366, { att: 0.07, hp: 50, eq: [[4000, 1.5, 'hs']] }, 'reed'), clarIowa: smp('clarIowa', 0.084, { att: 0.07, hp: 120, eq: [[6000, 1.5, 'hs']] }, 'flute'), altoFluteIowa: smp('altoFluteIowa', 0.45, { att: 0.08, hp: 150 }, 'flute'), fluteIowa: smp('fluteIowa', 0.071, { att: 0.07, hp: 200, eq: [[6000, 1.5, 'hs']] }, 'flute'), oboeIowa: smp('oboeIowa', 0.295, { att: 0.06, hp: 180, eq: [[6000, 1.5, 'hs']] }, 'flute'), bassoonIowa: smp('bassoonIowa', 0.133, { att: 0.07, hp: 60, eq: [[5000, 1.5, 'hs']] }, 'horn'),
    // the FreePats bagpipe (CC0, a pipe in G): the chanter and its drones
    pipes: smp('pipes', 0.4, { att: 0.04, rel: 0.2, hp: 200, eq: [[2500, 2, 0.8], [6000, 2, 'hs']] }, 'reed'), pipesDrone: smp('pipesDrone', 0.35, { att: 0.4, rel: 1.0, hp: 60 }, 'organ'),
    flute: smp('flute', 0.75, { att: 0.07, hp: 200, eq: [[6000, 1.5, 'hs']] }, 'flute'), altoFlute: smp('altoFlute', 1.35, { att: 0.08 }, 'flute'),   // the flute's recordings sit 10 dB under the oboe's, the alto flute's 24 dB under: lifted to the family's level (measured alone through the bus)
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
  // the sounding range of each recording (MIDI, C4 = 60): what the section or the player can give. A pad, choir, arpeggio or sparkle
  // keeps its register inside it; a written line folds a stray note by an octave, as a player would. The basses have the C extension.
  const SET_RANGE = { strEns: [28, 100], strEnsTrem: [28, 100], vln1Trem: [55, 100], vlaSus: [48, 88], vcSus: [36, 84], vcTrem: [36, 84], cbSus: [24, 60], cbPizz: [24, 60], subBass: [24, 60],
    strEnsPizz: [28, 96], strEnsSpic: [28, 96], harp: [24, 103], marimba: [36, 96], celeste: [60, 108], glock: [79, 108], crotales: [84, 108], chimes: [60, 79],
    hornSus: [41, 81], hornSolo: [41, 81], brassEns: [40, 86], brassStac: [40, 86], tptSus: [52, 86], tptSolo: [52, 86], lowBrass: [28, 65], tbnSus: [40, 72], tubaSus: [26, 65],
    flute: [60, 96], fluteSus: [60, 96], altoFlute: [55, 91], oboe: [58, 91], corAnglais: [52, 81], clarinet: [50, 91], bassoon: [34, 77],
    vlnSolo: [55, 100], vlaSolo: [48, 88], vcSolo: [36, 81], cbSolo: [28, 62], hornIowa: [34, 77], tbnSolo: [40, 72], bassTbn: [28, 62], tubaIowa: [24, 60], tptIowa: [52, 86], bassClar: [38, 79], clarIowa: [50, 91], altoFluteIowa: [55, 91], fluteIowa: [60, 96], oboeIowa: [58, 91], bassoonIowa: [34, 77], pipes: [65, 91], pipesDrone: [40, 60],
    chorus: [40, 81], chorusMen: [38, 69], chorusWomen: [53, 81] };
  for (const k in INST) if (INST[k].smp && SET_RANGE[INST[k].smp]) INST[k].range = SET_RANGE[INST[k].smp];
  const inRange = (inst, reg) => { const r = inst.range; if (!r || !reg) return reg; const lo = Math.max(reg[0], r[0]), hi = Math.min(reg[1], r[1]); return hi - lo >= 7 ? [lo, hi] : reg; };
  const foldRange = (inst, m) => { const r = inst.range; if (!r) return m; while (m > r[1]) m -= 12; while (m < r[0]) m += 12; return m; };
  Music._range = { SET_RANGE, inRange, foldRange };
  const LAYERS = {
    // (the Sonatina recordings carry their own hall, so the sends are moderate; the bus chorus is off the recorded sections and kept
    //  for the synthesized pads only, where it belongs)
    // verb = the hall (far plane), stage = the short bright stage (close plane): pads and choir live far back, the melody, plucks,
    // bells and drums stand at the front of the stage with the hall only behind them
    // the soundstage (A.soundstage, `?soundstage=0` to hear the old staging): the pads and the chorus go into the stage's early reflections
    // too, lightly, so the whole ensemble stands in one room and the image is a little wider
    pad: { lvl: 0.82, verb: 0.36, stage: 0.16 * A.soundstage, dly: 0, chorus: 0.12 }, bass: { lvl: 0.8, verb: 0.06, stage: 0.08 + 0.02 * A.soundstage, dly: 0 }, arp: { lvl: 0.5, verb: 0.18, stage: 0.22, dly: 0.12 },
    lead: { lvl: 1.0, verb: 0.16, stage: 0.26, dly: 0.08 }, bell: { lvl: 0.45, verb: 0.3, stage: 0.24, dly: 0.1 }, choir: { lvl: 0.72, verb: 0.42, stage: 0.18 * A.soundstage, dly: 0, chorus: 0 },
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
  // The shared themes (js/audio/score/themes.js): a phrase written '@group.NAME' resolves to the library's phrase, ' x2' doubling and ' /2'
  // halving its note values; prepare() records which themes a piece quotes (Music.themeIndex()).
  let THEMES = {};
  Music.defineThemes = function (t) { THEMES = t || {}; };
  function resolveTheme(str, into) {
    const m = /^@([A-Za-z][A-Za-z0-9]*)\.([A-Za-z][A-Za-z0-9]*)(?:\s+(x2|\/2))?$/.exec(String(str).trim());
    if (!m) throw new Error('bad theme reference "' + str + '"');
    const g = THEMES[m[1]], ph = g && g[m[2]];
    if (!ph) throw new Error('unknown theme "' + m[1] + '.' + m[2] + '"');
    if (into) into[m[1]] = true;
    if (!m[3]) return ph;
    const k = m[3] === 'x2' ? 2 : 0.5;
    return ph.split(/\s+/).map(tk => { if (tk === '|') return tk; const p = /^(r|-?\d+[#b]?)(?::(\d*\.?\d+))?(!?)$/.exec(tk); if (!p) return tk; const d = p[2] !== undefined ? parseFloat(p[2]) : 1; return p[1] + ':' + (d * k) + p[3]; }).join(' ');
  }
  Music.themeIndex = function () {
    const out = {};
    for (const id in TRACKS) { const d = TRACKS[id]; if (d.hidden) continue; try { prepare(d); } catch (e) { continue; } for (const t in d._p.themes) (out[t] = out[t] || []).push(id); }
    return out;
  };
  const DEFAULT_TRIM = 1, MIX_TRIM = 2.4;   // MIX_TRIM: the producer's master fader, set from the headless loudness report

  // ---------------------------------------------------------------- prepare (parse + validate once per track)
  // the vibrato in time with the music: a whole number of cycles to a beat, as near five a second as the tempo allows (58 bpm: five to a beat,
  // 4.8 Hz; 120 bpm: three, 6 Hz), so the players' vibrato and the pulse agree instead of drifting against each other note by note
  function vibRateFor(bpm) { const bps = clamp(num(bpm, 90), 30, 220) / 60, n = Math.max(1, Math.round(5.1 / bps)); return n * bps; }
  Music._vibRateFor = vibRateFor;
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

  const STRONG = { 2: [0], 3: [0], 4: [0, 2], 5: [0, 3], 6: [0, 3], 7: [0, 4] };
  function prepare(def) {
    if (def._p) return def._p;
    const meter = def.meter || 4, tpc = PCS[def.root];
    if (tpc === undefined) throw new Error(def.id + ': bad root');
    const scale = SCALES[def.mode || 'major'];
    if (!scale) throw new Error(def.id + ': bad mode');
    const P = {
      meter, spb: 60 / def.bpm, tpc, scale, warn: [], strong: def.strong || (STRONG[meter] || [0]), src: {},
      tonic: def.tonic !== undefined ? def.tonic : 57 + mod12(tpc - 57) + 12 * (def.oct || 0), phr: {}, secs: [], loopIdx: 0, themes: {},
    };
    for (const t of def.quotes || []) P.themes[t] = true;   // a theme quoted in a hand-adapted reading (another meter, an inversion) is declared
    for (const k in (def.ph || {})) { const src = def.ph[k], str = typeof src === 'string' && src[0] === '@' ? resolveTheme(src, P.themes) : src; P.src[k] = str; P.phr[k] = parsePhrase(str, meter); if (Math.abs(P.phr[k].beats / meter - Math.round(P.phr[k].beats / meter)) > 1e-6) P.warn.push('phrase ' + k + ' is ' + P.phr[k].beats + ' beats (not bar-aligned)'); }
    const base = def.base || {};
    def.sec.forEach(function (s, idx) {
      const R = { n: s.n || 'S' + idx, bars: s.bars, lv: num(s.lv, 1), lv1: s.cres ? s.cres[1] : num(s.lv, 1), lv0: s.cres ? s.cres[0] : num(s.lv, 1), L: {}, raw: s };
      // a section's own meter and tempo (an interlude's opening bars keep the outgoing piece's; a tempo may ramp across a section)
      R.meter = num(s.meter, meter); R.strong = s.strong || def.strong || (STRONG[R.meter] || [0]); R.bpm = num(s.bpm, def.bpm); R.bpmTo = num(s.bpmTo, R.bpm);
      R.segs = expandProg(s.prog, s.bars, R.meter, tpc);
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
    o.f = mtof(midi); o.dur = Math.max(0.03, (C.tAt(beat + beats) - C.tAt(beat)) * (ex && ex.art !== undefined ? ex.art : 1)); o.vel = vel * (inst.lvl === undefined ? 1 : inst.lvl) * C.lvAt(beat); o.dyn = clamp(vel * C.lvAt(beat), 0, 1);
    if (inst.v === 'sample' && beats >= 1.5) { const d1 = clamp(vel * C.lvAt(beat + beats), 0, 1); if (Math.abs(d1 - o.dyn) > 0.04) o.swell = d1; }   // long notes swell with the section's crescendo
    // struck/ringing voices (bells, chimes) keep their own ring time; it only stretches a little with the written length
    if ((inst.v === 'bell' || inst.v === 'chime') && inst.dur) o.dur = inst.dur * clamp(0.7 + 0.15 * beats, 0.7, 1.4);
    if (ex) for (const k in ex) if (k !== 'art' && k !== 'dt' && ex[k] !== undefined) o[k] = ex[k];
    delete o.p;
    const ev = { t: C.tAt(beat) + (ex && ex.dt || 0), v: inst.v, ly, o, m: midi, b: beat, bt: beats, k: C.key };
    C.ev.push(ev);
    return ev;
  }
  function emitDrum(C, ly, dv, beat, vel, ex) {
    if (beat < 0 || beat >= C.totalBeats) return;
    const o = Object.assign({}, dv); o.vel = vel * C.lvAt(beat) * (dv.lvl === undefined ? 1 : dv.lvl); if (dv.dyn === undefined) o.dyn = clamp(vel * C.lvAt(beat), 0, 1); if (ex) Object.assign(o, ex);
    C.ev.push({ t: C.tAt(beat), v: dv.v, ly, o, m: 0, b: beat, bt: 0, k: C.key });
  }
  function stepMidi(C, step, acc) {
    const L = C.scale.length, o = Math.floor(step / L), i = step - o * L;
    return C.tonic + C.scale[i] + 12 * o + (acc || 0);
  }
  function isStrong(C, beatInSec) {
    const b = beatInSec % C.meter;
    for (const s of C.strong) if (Math.abs(b - s) < 1e-6) return true;
    return false;
  }

  // ---------------------------------------------------------------- generators
  // a chord reduced to its root and fifth (the third and the colour tones left to the voices above): deep open chords in the low strings
  function openChord(ch) { const fifth = ch.pcs.find(p => mod12(p - ch.pc) === 7); const pcs = fifth !== undefined ? [ch.pc, fifth] : [ch.pc]; return Object.assign({}, ch, { pcs, iv: pcs.length > 1 ? [7] : [] }); }
  function genPad(C, s, cfg, key) {
    key = key || 'pad';
    const inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]);
    const style = cfg.style || cfg.p || 'sus', reg = inRange(inst, cfg.reg || [50, 72]), n = (cfg.n || 4) + (C.era > 0.55 ? 1 : 0), vel = num(cfg.vel, 1), rng = C.vrng;
    let prev = C.prevPad[key];
    const segs = s.R.segs.slice();
    // tie (the pad's `tie`, or the piece's `padTie`): a held bed, as an orchestra's strings hold one. A note the next chord shares keeps
    // sounding through the change instead of being bowed again; a note the next chord drops lets go at the change; a note it adds comes
    // in legato, past its bow's attack. Only the first chord of the section enters with the bed's attack (or its swell): with a swell
    // per chord, or a fresh bow on every note of every chord, the strings struck a beat at each bar line.
    const tie = cfg.tie !== undefined ? !!cfg.tie : !!(C.def && C.def.padTie);
    if (tie && (style === 'sus' || style === 'swell')) {
      // the held notes carry on into the next section when it follows at once on the same instrument (a section line is no reason to
      // bow again); otherwise they end where their section ended. Every held note is written once, when its length is known.
      C.padCarry = C.padCarry || {}; const carry = C.padCarry[key]; C.padCarry[key] = null;
      const open = new Map(); let any = false;
      if (carry) { if (Math.abs(carry.endAbs - s.start) < 1e-6 && sameVoice(carry.inst, inst)) { for (const [m, o] of carry.open) open.set(m, o); any = open.size > 0; } else padFlushAll(C, carry); }
      for (let i = 0; i < segs.length; i++) {
        const sg = segs[i]; let b1 = sg.b1;
        if (cfg.merge !== false) while (i + 1 < segs.length && segs[i + 1].ch.sym === sg.ch.sym) { i++; b1 = segs[i].b1; }
        const notes = voiceChord(cfg.open ? openChord(sg.ch) : sg.ch, prev, reg[0], reg[1], n, (reg[0] + reg[1]) / 2); prev = notes;
        for (const m of Array.from(open.keys())) if (notes.indexOf(m) < 0) { padFlush(C, open.get(m), m, s.start + sg.b0, true); open.delete(m); }
        notes.forEach(function (m, j) { if (!open.has(m)) open.set(m, { b0: s.start + sg.b0, j, first: !any, inst, vel, n, width: num(cfg.width, 1), rel: cfg.rel, style, rng }); });
        any = true;
      }
      C.padCarry[key] = { open, endAbs: s.start + (segs.length ? segs[segs.length - 1].b1 : 0), inst };
      C.prevPad[key] = prev; return;
    }
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], notes = voiceChord(cfg.open ? openChord(sg.ch) : sg.ch, prev, reg[0], reg[1], n, (reg[0] + reg[1]) / 2);   // open: roots and fifths only (deep chords that must not smear)
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

  function padFlush(C, o, m, endAbs, cont) {
    const L = endAbs - o.b0; if (L <= 0) return;
    const ex = { pan: (o.j / Math.max(1, o.n - 1) - 0.5) * 0.8 * o.width * C.widthK, dt: (o.rng() - 0.5) * 0.02, rel: o.rel };
    if (o.first) { if (o.style === 'swell') ex.att = Math.min(L * C.spb * 0.6, 3.5); } else { ex.leg = true; ex.legAtt = 0.4; ex.legOff = 'loop'; }
    emit(C, 'pad', o.inst, o.b0, m, L + (cont ? 0.12 : 0), o.vel * (o.j === 0 ? 1 : 0.9), ex);
  }
  function padFlushAll(C, carry) { for (const [m, o] of carry.open) padFlush(C, o, m, carry.endAbs, false); carry.open.clear(); }
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
    // tie (the bass's `tie`, or the piece's `bassTie`): an undercurrent rather than a pulse. A note that the next step repeats is held
    // through it (one note across the bars of a chord, not a new attack each bar), a change of note is played legato (the next note past
    // its attack, the last one let go quickly as it arrives), so a slow bass never swells in again at every bar line.
    const tie = P.tie !== undefined ? !!P.tie : !!(C.def && C.def.bassTie), notes = [];
    for (let bar = 0; bar < s.bars; bar++) {
      const pt = parseSteps(pats[bar % pats.length]), stepB = C.meter / pt.n;
      for (const st of pt.steps) {
        const beat = bar * C.meter + st.i * stepB, sg = segAt(s.R.segs, beat);
        const m = bassPitch(C, sg.ch, st.c, P.pedal);
        if (m === null) continue;
        const onBeat = Math.abs(st.i * stepB - Math.round(st.i * stepB)) < 1e-6, v = vel * (onBeat ? 1 : 0.78) * (1 + (C.vrng() - 0.5) * 0.08);
        if (!tie) { emit(C, 'bass', inst, s.start + beat, m, st.len * stepB * (st.len > 1 ? 0.97 : gate), v); continue; }
        const p = notes[notes.length - 1];
        if (p && p.m === m && Math.abs(p.beat + p.len - beat) < 1e-6) p.len += st.len * stepB; else notes.push({ beat, m, len: st.len * stepB, v });
      }
    }
    if (!tie) return;
    // the held note carries on into the next section when it follows at once on the same note and instrument (no new attack at the
    // section line); the last note of a section waits to be written until the next section, or the end of the pass, says how long it is
    C.bassCarry = C.bassCarry || null; const cr = C.bassCarry; C.bassCarry = null;
    for (const n of notes) n.beat += s.start;
    if (cr) {
      const f = notes[0];
      if (f && Math.abs(cr.beat + cr.len - f.beat) < 1e-6 && cr.m === f.m && sameVoice(cr.inst, inst)) { f.beat = cr.beat; f.len += cr.len; f.v = cr.v; f.from = cr.from; f.inst0 = cr.inst0 || cr.inst; }
      else { if (f && Math.abs(cr.beat + cr.len - f.beat) < 1e-6 && sameVoice(cr.inst, inst)) { cr.into = true; f.from = true; } bassWrite(C, cr); }
    }
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], nx = notes[i + 1], pv = notes[i - 1];
      n.inst = inst; n.into = !!(nx && Math.abs(n.beat + n.len - nx.beat) < 1e-6); n.from = n.from || !!(pv && Math.abs(pv.beat + pv.len - n.beat) < 1e-6);
      if (i === notes.length - 1) C.bassCarry = n; else bassWrite(C, n);
    }
  }
  function sameVoice(a, b) { return a === b || (!!a && !!b && a.v === b.v && (a.smp || '') === (b.smp || '')); }   // one instrument, whatever its envelope settings
  function bassWrite(C, n) { emit(C, 'bass', n.inst0 || n.inst, n.beat, n.m, n.into ? n.len + 0.08 : n.len * 0.97, n.v, Object.assign(n.from ? { leg: true, legAtt: 0.2, legOff: 'loop' } : {}, n.into ? { rel: 0.3 } : {})); }

  function genArp(C, s, cfg, key) {
    const P = norm(cfg, ARPS, 'arp'), inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]), reg = inRange(inst, P.reg || [55, 84]);
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
        emit(C, 'arp', inst, s.start + beat, m, stepB * gate, vel * (onBeat ? 1 : 0.72) * (1 + (rng() - 0.5) * 0.12), { pan: (k % 2 ? 0.3 : -0.3) * num(P.width, 1) });   // no two plucks at quite the same level
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
        emitDrum(C, 'drums', { v: 'sample', smp: 'timpRoll', fb: 'timp', fbo: { f: mtof(m0), dur: 1.8 }, f: mtof(m0), dur: C.tAt(s.start + (bar + 1) * C.meter) - C.tAt(s.start + bar * C.meter), dyn: d0, swell: d1, hum: 0, lvl: 0.9 }, s.start + bar * C.meter, vel0 * d1);
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
    const inst = resolveInst(cfg.inst, C.inst[key] || DEF_INST[key]), reg = inRange(inst, cfg.reg || [55, 77]), n = cfg.n || 3, vel = num(cfg.vel, 1);
    let prev = C.prevChoir[key];
    const segs = s.R.segs, soft = !!cfg.soft, rng = C.vrng, spb = C.spb;
    const breathBeats = Math.max(2, Math.round((soft ? (C.def && C.def.padTie ? 16.0 : 8.0) : 5.2) / spb));   // a held piece's soft hum: a choir breathes in turn, the sound does not stop
    const sampled = inst.v === 'sample';
    const scaleHas = m => C.scale.indexOf(mod12(m - C.tonic)) >= 0;
    C.choirCarry = C.choirCarry || {}; const cc = C.choirCarry[key];
    const voices = cc && C.def && C.def.padTie && Math.abs(cc.endAbs - s.start) < 1e-6 && sameVoice(cc.inst, inst) ? cc.voices : [];   // per part: { m, ev } of the note currently sounding (carried from the section before when it follows at once)
    const base = { v1: cfg.v1 || inst.v1, v2: cfg.v2 || inst.v2, att: cfg.att, rel: cfg.rel, width: cfg.width };
    const sing = (j, m, beat, L, k, first) => {           // one phrase of one voice: staggered entry, a small swell, breath-length
      const dyn0 = (soft ? 0.3 : 0.55) + (soft ? 0.12 : 0.2) * (k % 2), dt = first ? j * 0.16 + rng() * 0.08 : j * 0.04 + rng() * 0.05;
      const ex = Object.assign({}, base, { pan: (j - (n - 1) / 2) * 0.35, dt, dyn: dyn0, swell: dyn0 + (soft ? 0.22 : 0.18) });
      if (!first && soft && C.def && C.def.padTie) ex.att = 1.0;          // a held piece's hum: a voice back from its breath fades in, unheard
      return emit(C, 'choir', inst, s.start + beat, m, Math.max(0.5, L), vel * (0.9 + 0.1 * (k % 2)), ex);
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
    C.choirCarry[key] = { voices, endAbs: s.start + (segs.length ? segs[segs.length - 1].b1 : 0), inst };
    C.prevChoir[key] = prev;
  }

  // melodic lines from hand-written phrases (lead, lead2, bell, bell2)
  function genLine(C, s, cfg, key) {
    const spec = typeof cfg === 'string' ? { ph: cfg } : cfg;
    const ly = BUS[key], inst = resolveInst(spec.inst, C.inst[key] || DEF_INST[key]);
    const vel0 = num(spec.vel, key === 'lead' ? 0.9 : 0.7), art = num(spec.art, inst.v === 'pluck' || inst.v === 'bell' || inst.v === 'chime' ? 1 : 0.97);
    const harm = spec.harm || 0, oct = spec.oct || 0, rng = C.vrng, brassy = inst.v === 'brass' || inst.v === 'flute', blown = brassy || (inst.v === 'sample' && /^(horn|brass|flute|winds|oboe|clarinet|bassoon)/.test(inst.fb || ''));   // blown: no octave echo on a horn or a flute, synthesized or recorded
    const graceP = num(spec.grace, brassy ? 0.18 : 0), flutterP = num(spec.flutter, 0), echoP = num(spec.echo, blown || inst.v === 'sample' ? 0 : 0.07);   // the octave echo is for the synthesized lines: on a recorded soloist it was a stray note an octave up   // flutter: the pipers' doubling before a long note
    const swellK = clamp(num(spec.swell, 0), 0, 0.8);   // swell: each note of two beats or more starts softer and opens to its dynamic through the recorded layers (the brass rising)
    const shape = clamp(num(spec.shape, 0), 0, 0.8);   // shape: each phrase played as a hairpin — soft at its ends, full in its middle and at its top, the long notes blooming (a singer's or a horn's phrasing)
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
      if (!pm || C.P.src[pm[1]] === undefined) { C.warn('unknown phrase "' + tk + '" in ' + s.R.n); continue; }
      const ph = parsePhrase(C.P.src[pm[1]], C.meter), md = parseMods(pm[2]);   // read in the section's meter (an interlude's opening bars may differ)
      if (restP && rng() < restP) { cur += ph.bars * C.meter; continue; }        // the player leaves this phrase out: a breath in the line
      const first = ph.notes.length ? ph.notes[0].d - 1 : 0;
      const span = shape ? ph.notes.reduce((x, n) => Math.max(x, n.off + n.dur), 0) || 1 : 1, dLo = shape ? Math.min(...ph.notes.map(n => n.d)) : 0, dHi = shape ? Math.max(...ph.notes.map(n => n.d)) : 0;
      for (const nt of ph.notes) {
        const off = cur + nt.off;
        const vel = (shape ? vel0 * (1 - shape * (1 - Math.min(1, 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, (nt.off + nt.dur / 2) / span)), 0.6) + 0.35 * (nt.d - dLo) / Math.max(1, dHi - dLo) + (nt.dur >= 2 ? 0.1 : 0)))) : vel0) * md.vel;   // the phrase's dynamic mark
        if (off >= s.beats - 1e-6) break;
        let step = nt.d - 1;
        if (md.inv) step = 2 * first - step;
        step += md.shift + (md.oct + oct) * L;
        const sg = segAt(s.R.segs, off), strong = isStrong(C, off);
        let m = stepMidi(C, step, nt.acc);
        if (!nt.keep && (strong || nt.dur >= 2) && !isChordTone(m, sg.ch) && clashes(m, sg.ch)) { m = snapToChord(m, sg.ch); C.snaps++; }
        m = foldRange(inst, m);
        const dt = (rng() - 0.5) * 0.012;
        if (flutterP && nt.dur >= 1.5 && rng() < flutterP) { for (let k = 0; k < 3; k++) emit(C, ly, inst, s.start + off - 0.17 + k * 0.055, foldRange(inst, stepMidi(C, step + (k % 2 === 0 ? 1 : 0), 0)), 0.055, vel * 0.6, { art: 1, dt: 0 }); }
        else if (graceP && nt.dur >= 1.5 && rng() < graceP) emit(C, ly, inst, s.start + off - 0.09, foldRange(inst, stepMidi(C, step - 1, 0)), 0.09, vel * 0.55, { art: 1, dt: 0 });
        const sw = swellK && nt.dur >= 2 ? { dyn: clamp(vel * C.lvAt(s.start + off) * (1 - swellK), 0.12, 1), swell: clamp(vel * C.lvAt(s.start + off + nt.dur), 0, 1) } : null;
        emit(C, ly, inst, s.start + off, m, nt.dur, vel, Object.assign({ art: art, dt: dt, pan: spec.pan, width: spec.width }, sw || {}));
        if (echoP && (!strong || spec.echo) && rng() < echoP) emit(C, ly, inst, s.start + off + 0.04, foldRange(inst, m + 12), Math.min(nt.dur, 1) * 0.8, vel * 0.3, { art: art, pan: (rng() - 0.5) * 0.8 });
        if (harm) {
          let hm = stepMidi(C, step + harm, 0);
          if (!isChordTone(hm, sg.ch) && clashes(hm, sg.ch)) hm = snapToChord(hm, sg.ch);
          hm = foldRange(inst, hm);
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
    const reg = inRange(inst, cfg.reg || [72, 91]), res = cfg.res || 2, dens = num(cfg.dens, 0.5) * 0.5, vel = num(cfg.vel, 0.55) * 0.7, rng = C.crng, vr = C.vrng;
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
      C.meter = cur.R.meter;
      if (cur.R.hit) { emitDrum(C, 'fx', { v: 'boom' }, cur.start, 0.3); emitDrum(C, 'fx', { v: 'sample', smp: 'bassDrum', fb: 'kick', fbo: { f: 40, f0: 110, dur: 0.5 } }, cur.start, 0.95); if (cur.R.hit === 'tam') emitDrum(C, 'fx', { v: 'sample', smp: 'gong', fb: 'crash', fbo: { dur: 3 } }, cur.start, 0.8); }
      if (!prev || C.def.gentle) continue;
      const up = cur.R.lv0 - prev.R.lv1;
      if (cur.R.cr === true || (cur.R.cr !== false && up >= 0.12)) emitDrum(C, 'fx', { v: 'sample', smp: 'crash', fb: 'crash', fbo: { dur: 2.8 } }, cur.start, 0.6);
      const rise = prev.R.rise !== undefined ? prev.R.rise : (up >= 0.15 ? 1 : 0);
      if (rise) {
        // the riser sits in the last bar(s) of the previous section; across the loop seam it lives at the end of this pass
        const st = i > 0 ? cur.start - rise * C.meter : C.totalBeats - rise * C.meter;
        if (st >= 0) { C.curW = i > 0 ? prev : cur; const dur = C.tAt(st + rise * C.meter) - C.tAt(st); emitDrum(C, 'fx', { v: 'swell', dur }, st, 0.15); emitDrum(C, 'fx', { v: 'sample', smp: 'cymSwell', fb: 'swell', fbo: { dur }, alignEnd: true, dur, dyn: dur > 5 ? 0.9 : dur > 3 ? 0.5 : 0.15 }, st, 0.55); }
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
      def, P, pass, take: take || 0, era: E, widthK: 1 - 0.3 * E, meter: P.meter, spb: P.spb, strong: P.strong, scale: P.scale, tonic: P.tonic, ev: [], bassC: def.bassC || 38, prevPad: {}, prevChoir: {},
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
        if (bars !== R0.bars) R = Object.assign(Object.create(R0), { bars, segs: expandProg(R0.raw.prog, bars, R0.meter, P.tpc) });
      }
      if (tenseP > 0) {                                   // the era colours some of the chords (the same ones every time at a given era, per take)
        const segs = R.segs.map((sg, i, arr) => { const r = erng(); if (r >= tenseP || i === arr.length - 1) return sg; const sym = tenseChord(sg.ch.sym, E, erng()); return sym === sg.ch.sym ? sg : { ch: parseChord(sym, P.tpc), b0: sg.b0, b1: sg.b1 }; });   // never the cadence
        R = Object.assign(Object.create(R), { segs });
      }
      wraps.push({ R, start: beat, beats: R.bars * R.meter, bars: R.bars }); beat += R.bars * R.meter;
    }
    C.totalBeats = beat;
    // the time map: each section runs at its tempo (and may ramp to bpmTo across its bars); t(beat) integrates it, so a ramp is a true
    // accelerando or ritardando and every event, bar line and beat sits where the music puts it
    const tOf = (w, b) => { const d = w.b1 - w.b0; return d ? 60 * w.beats / d * Math.log((w.b0 + d * b / w.beats) / w.b0) : 60 * b / w.b0; };
    let tAcc = 0;
    for (const w of wraps) { w.b0 = w.R.bpm; w.b1 = w.R.bpmTo; w.t0 = tAcc; w.len = tOf(w, w.beats); tAcc += w.len; }
    C.tAt = function (b) {
      let w = wraps[0]; for (const x of wraps) { if (b >= x.start - 1e-9) w = x; else break; }
      if (b < w.start) return w.t0 + (b - w.start) * 60 / w.b0;
      if (b > w.start + w.beats) return w.t0 + w.len + (b - w.start - w.beats) * 60 / w.b1;
      return w.t0 + tOf(w, b - w.start);
    };
    const bars = [], beatsT = [];
    for (const w of wraps) { for (let k = 0; k < w.bars; k++) bars.push(C.tAt(w.start + k * w.R.meter)); for (let k = 0; k < w.beats; k++) beatsT.push(C.tAt(w.start + k)); }
    bars.push(tAcc); beatsT.push(tAcc);
    C.curW = null;
    C.lvAt = function (b) { const w = C.curW; if (!w || w.R.lv0 === w.R.lv1) return w ? w.R.lv0 : 1; return w.R.lv0 + (w.R.lv1 - w.R.lv0) * clamp((b - w.start) / w.beats, 0, 1); };
    for (const w of wraps) {
      C.curW = w; C.meter = w.R.meter; C.strong = w.R.strong; C.spb = 60 / w.b0;   // the section's meter and (opening) tempo
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
    if (C.padCarry) for (const k in C.padCarry) if (C.padCarry[k]) { padFlushAll(C, C.padCarry[k]); C.padCarry[k] = null; }   // the held beds end with the pass
    if (C.bassCarry) { bassWrite(C, C.bassCarry); C.bassCarry = null; }
    C.ev.sort((a, b) => a.t - b.t);
    markLegato(C.ev);
    return { events: C.ev, beats: C.totalBeats, len: tAcc, wraps, pass, snaps: C.snaps, bars, beatsT };
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
          const ch = eng.makeChorus(Music.chorusSync !== false && def.bpm ? { bps: clamp(num(def.bpm, 90), 30, 220) / 60 } : {}), cg = mk(ctx.createGain()); cg.gain.value = chAmt;
          post.connect(ch.in); ch.out.connect(cg); cg.connect(this.bus); cg.connect(sv);
          this.choruses.push(ch);
        }
        this.layers[name] = { in: inG, level: L.lvl * num(mix[name], 1), i0: L.i0 };
        inG.gain.value = this.layers[name].i0 !== undefined ? 0 : this.layers[name].level;
      }
      const gate = def.gate || {};
      for (const name in gate) { const L = this.layers[name]; if (L && L.i0 === undefined && gate[name] > 0) { L.i0 = gate[name]; L.in.gain.value = 0; } }
      this.trimBase = num(def.trim, DEFAULT_TRIM) * MIX_TRIM; this.trim = this.trimBase * (eng.offline ? 1 : dirMul()); this.offline = !!eng.offline; this.fadeEnd = 0;
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
      const now = this.eng.ctx.currentTime;
      if (!this.pass || this.stopped) return now;
      const base = this.pass.start - this.shift, arr = kind === 'beat' ? this.pass.beatsT : this.pass.bars, st = this.stretch;
      let at = base + this.pass.len;                                         // past the last line: the end of the performance
      for (let i = 0; i < arr.length; i++) if (base + arr[i] * st > now + 0.06) { at = base + arr[i] * st; break; }
      return Math.min(at, now + (kind === 'beat' ? 1.5 : 4.5));
    }
    // the first bar line at or after `time` in this performance (never past its end): where the next piece enters
    boundaryAfter(time) {
      if (!this.pass) return time;
      const base = this.pass.start - this.shift, end = this.pass.start + this.pass.len - this.shift, st = this.stretch;
      for (const b of this.pass.bars) { const at = base + b * st; if (at >= time - 0.02) return Math.min(end, Math.max(time, at)); }
      return end;
    }
    // the next place this performance would naturally let another piece in: the start of its next section at least `minAhead` seconds away
    // (a breath — a section written at lv <= 0.35 — inside `maxAhead` is preferred, since the piece is all but silent there), else the first
    // section line inside `maxAhead`, else the last bar line before it; never past the end of the performance
    nextSectionBoundary(minAhead, maxAhead) {
      const now = this.eng.ctx.currentTime;
      if (!this.pass || this.stopped) return now;
      const st = this.stretch, base = this.pass.start - this.shift, end = base + this.pass.len;
      const lines = this.pass.wraps.map(w => ({ at: base + w.t0 * st, lv: w.R.lv0 })).concat([{ at: end, lv: 0 }]).filter(x => x.at >= now + minAhead && x.at <= now + maxAhead);
      const breath = lines.find(x => x.lv <= 0.35);
      if (breath) return breath.at;
      if (lines.length) return lines[0].at;
      return this.boundaryAfter(Math.max(now + minAhead, now + maxAhead - this.P.meter * this.P.spb * st));
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
      const t = this.eng.ctx.currentTime; this.fadeEnd = t + sec + 0.5;
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
      const o2 = o && o.vib !== 0 && ev.v === 'sample' && this.def && this.def.bpm ? Object.assign({}, o, { vibRate: vibRateFor(this.bpmNow ? this.bpmNow(T) : this.def.bpm) }) : o;
      const v = V[ev.v](this.eng, L.in, T, o2);
      if (v) this.live.add(v);
      if (ev.ly === 'lead' && o && o.dur > 0.2) this.duckBeds(T, o.dur);
    }
    // the mixer's hand on the faders: while the melody sounds, the pad and choir beds sit back and come up again after it. A phrase is one
    // dip: a note that starts before the dip has come back (or within 0.6 s of it, a breath between two notes) moves the restore to its own
    // end instead of scheduling one inside itself (overlapping legato notes used to bring the beds up mid-note, and every gap between two
    // notes swelled them back, a pump of the whole duck depth against the solo). The restore is slower (0.6 s) so a real rest breathes.
    duckBeds(T, dur) {
      const dk = this.def && this.def.duck !== undefined ? clamp(num(this.def.duck, 0.79), 0.3, 1) : 0.79;   // a piece may ask for a deeper dip under its soloist (the title: 0.7, 3.1 dB)
      const merge = Music.duckMerge !== false, end = T + dur, cont = merge && this._duckEnd !== undefined && T <= this._duckEnd + 0.6;
      for (const name of ['pad', 'pad2', 'choir', 'choir2', 'arp', 'arp2']) {
        const L = this.layers[name]; if (!L || L.i0 !== undefined) continue;
        const g = L.in.gain, lv = L.level, k = name.indexOf('arp') === 0 ? 0.84 : dk;
        try {
          if (!merge) { g.setTargetAtTime(lv * k, T, 0.06); g.setTargetAtTime(lv, T + dur, 0.3); continue; }
          if (cont) { g.cancelScheduledValues(Math.max(T, this._duckEnd - 0.001)); g.setTargetAtTime(lv * k, Math.max(T, this._duckEnd - 0.001), 0.06); }
          else g.setTargetAtTime(lv * k, T, 0.06);
          g.setTargetAtTime(lv, Math.max(end, cont ? this._duckEnd : 0) + 0.15, 0.6);
        } catch (e) { /* ignore */ }
      }
      if (merge) this._duckEnd = Math.max(end, cont ? this._duckEnd : 0);
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
      if (S.switchAt && now >= S.switchAt.at - 0.03) { const w = S.switchAt; S.switchAt = null; startTrack(w.id, w.opts); if (w.then) S.switchAt = w.then; }   // a bridge carries the cue behind it
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
        if (pl.director) id = pickNext(pl, DIR.lastPiece || p.id);     // the director: the piece that fits the moment, by weighted chance
        else { pl.i = (pl.i + 1) % pl.order.length; if (pl.i === 0 && pl.shuffle) pl.order = composeOrder(pl, pl.order[pl.order.length - 1]); id = pl.order[pl.i]; }
        pl.far = false;
        if (pl.between && Math.random() < pl.betweenP) {
          const far = pl.director && DIR.lastPiece && farApart(TRACKS[DIR.lastPiece], TRACKS[id]);   // a very different piece next: breathe first
          const quiet = far ? pl.between.filter(t => QUIET[t]) : pl.between, base = quiet.length ? quiet : pl.between;
          const pool = base.length > 1 ? base.filter(t => t !== pl.lastTpl) : base, tpl = chooseTemplate(pool, outgoing(p), TRACKS[id]);   // never the same bridge twice running; the colour that fits
          const d = interludeFor(tpl, id, { long: far, motif: DIR.motif, from: outgoing(p) }); if (d) { pl.lastTpl = tpl; pl.queued = id; id = d; gap = pl.gapIn; pl.far = !!far; DIR.motif = null; }
        }
      }
      const g = pickGap(gap);
      if (g > 0) { p.fadeOut(Math.max(0.5, p.endAt - now)); S.old.push(p); S.cur = null; S.plWait = { at: p.endAt + g, id: id, fade: 0.4 }; }
      else {
        // the seam: the new piece enters on a bar line of the old one, `fade` seconds (or less) before it ends, and fades in over that time;
        // the old piece is not cut — it plays its last bar and its final chord decays under the newcomer (a long fade that mostly happens
        // after its last note), so the cadence is heard and the hall carries one piece into the next
        const at = Math.min(p.endAt, p.boundaryAfter(Math.max(now + 0.1, p.endAt - pl.fade)));
        const inFade = clamp(p.endAt - at + 1.5, 2.5, pl.fade + (pl.far ? 2 : 0)), oldFade = (p.endAt - at) + (pl.far ? 8 : 6);
        S.switchAt = { id, opts: { fade: pl.fade, inFade, oldFade, loop: false, keepPlaylist: true, quantize: false }, at };
        ensureTimer();
      }
    }
  }
  const pickGap = g => (Array.isArray(g) ? g[0] + Math.random() * (g[1] - g[0]) : num(g, 0));
  // one cycle of the programme: the regular pieces shuffled, and each rare piece slipped in with probability pl.rare.p, never beside another
  function composeOrder(pl, last) {
    const a = shuffled(eraList(pl.ids), last);
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
  // ================================================================== the director
  // Every map piece carries tags (0..1) on a few axes of the game's situation — solitude, contact, tension, war, grief, grandeur, energy,
  // dark — and the soundscape sends the situation on the same axes (Music.setSituation) at the end of every turn. When a programme needs
  // its next piece the director scores each candidate by how close its tags sit to the situation, tilts the weight by the key (near on the
  // circle of fifths after the piece just heard), by how recently it was heard and by its rarity, and draws one at random from those
  // weights: still a shuffle, leaning the way the game leans. It also tilts the music's level a little (never more than about a decibel):
  // up when the galaxy is at war or the empire is grand, down when the player is alone and nothing presses.
  const AXES = { solitude: 1, contact: 0.8, tension: 1, war: 1.2, grief: 1, grandeur: 0.7, energy: 0.3, dark: 0.5 };
  const DIR = { q: null, hist: Object.create(null), lastPiece: null, gainDb: 0 };
  function affinity(def) {                            // 0..1: how well a piece's tags fit the situation (0.5 when nothing is known)
    const q = DIR.q, t = def && def.tags; if (!q || !t) return 0.5;
    let sum = 0, w = 0; for (const a in AXES) { if (q[a] === undefined || t[a] === undefined) continue; sum += AXES[a] * (1 - Math.abs(t[a] - q[a])); w += AXES[a]; }
    return w ? sum / w : 0.5;
  }
  const FIFTHS = (() => { const o = {}; let pc = 0; for (let i = 0; i < 12; i++) { o[pc] = i; pc = (pc + 7) % 12; } return o; })();
  const PARENT = { major: 0, lydian: 7, mixolydian: 5, dorian: 10, phrygian: 8, minor: 3, harmonic: 3, melodic: 3 };   // offset from a mode's root to its parent major
  const centre = def => mod12(PCS[def.root] + num(PARENT[def.mode || 'major'], 0));
  const fifthsDist = (a, b) => { const d = Math.abs(FIFTHS[centre(a)] - FIFTHS[centre(b)]); return Math.min(d, 12 - d); };   // 0..6 steps round the circle
  // two pieces far apart in feel or key: the seam between them gets a quiet, longer interlude and a wider fade (the breath)
  const farApart = (a, b) => { const ta = (a && a.tags) || {}, tb = (b && b.tags) || {}; return Math.abs(num(ta.energy, 0.5) - num(tb.energy, 0.5)) >= 0.45 || Math.abs(num(ta.dark, 0.3) - num(tb.dark, 0.3)) >= 0.5 || (a && b && fifthsDist(a, b) >= 4); };
  const QUIET = { drift: 1, drift3: 1, drift5: 1, drift6: 1 };   // the interludes that breathe: a pad and a few points of light, the voices, one held note, the choir alone
  function pickNext(pl, last) {
    const now = A.engine ? A.engine.ctx.currentTime : 0, lastDef = DIR.lastPiece ? TRACKS[DIR.lastPiece] : null;
    const lastRare = !!(pl.rare && DIR.lastPiece && pl.rare.ids.indexOf(DIR.lastPiece) >= 0);
    const cands = eraList(pl.ids).filter(id => id !== last).concat(pl.rare && !lastRare ? pl.rare.ids.filter(id => id !== last) : []);
    if (!cands.length) return pl.ids[0];
    let tot = 0;
    const ws = cands.map(id => {
      const def = TRACKS[id]; let w = Math.exp(4 * affinity(def));
      const h = DIR.hist[id]; if (h !== undefined) { const age = now - h; w *= age < 1500 ? 0.08 : age < 4200 ? 0.08 + 0.92 * (age - 1500) / 2700 : 1; }   // heard in the last 25 minutes: almost never again; an hour on: as new
      if (lastDef) { const d = fifthsDist(lastDef, def); w *= d === 0 ? (lastDef.root === def.root ? 0.35 : 1.25) : d === 1 ? 1.15 : d === 2 ? 1 : d === 3 ? 0.85 : 0.7; }   // the circle of fifths: a near key is an easy seam
      if (pl.rare && pl.rare.ids.indexOf(id) >= 0) w *= (typeof pl.rare.p === 'object' ? num(pl.rare.p[id], 0.35) : num(pl.rare.p, 0.35)) * (0.4 + 1.2 * S.era);
      if (DIR.q && DIR.q.council && def.tags && def.tags.ceremony) w *= 1 + 3 * num(DIR.q.council, 0) * def.tags.ceremony;   // the council approaching: the procession likelier
      tot += w; return w;
    });
    let r = Math.random() * tot; for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  const dirMul = () => Math.pow(10, DIR.gainDb / 20);
  // the situation: {solitude, contact, tension, war, grief, grandeur, energy, dark} on 0..1 (any subset); null forgets it
  Music.setSituation = function (q) {
    DIR.q = q && typeof q === 'object' ? Object.assign({}, q) : null;
    const g = q ? clamp(0.8 * (num(q.war, 0) + 0.5 * num(q.grandeur, 0)) - 0.8 * num(q.solitude, 0) * (1 - num(q.tension, 0)), -1.2, 1.2) : 0;
    if (Math.abs(g - DIR.gainDb) < 0.05) return;
    DIR.gainDb = g;
    const eng = A.engine; if (!eng) return;
    const t = eng.ctx.currentTime;
    for (const p of [S.cur].concat(S.old)) {           // running players follow over a few seconds, once their own fade-in is done
      if (!p || p.stopped || p.offline || !(t > p.fadeEnd)) continue;
      p.trim = p.trimBase * dirMul();
      try { p.bus.gain.setTargetAtTime(p.trim, t, 3); } catch (e) { /* ignore */ }
    }
  };
  Music.getSituation = () => (DIR.q ? Object.assign({}, DIR.q) : null);
  // A motif for the next interlude: the first bars of a race's theme when that race is met, the procession's call when the council
  // approaches. x is a track id carrying `motif` (and perhaps `motifInst`), or {ph, inst}; null forgets it. The next interlude the map builds
  // plays it once in its own key, in the interlude's voice, and the motif is spent.
  Music.setMotif = function (x) {
    if (!x) { DIR.motif = null; return true; }
    const d = typeof x === 'string' ? TRACKS[x] : null; let ph = d ? d.motif : x.ph;
    if (!ph) return false;
    if (ph[0] === '@') { try { ph = resolveTheme(ph); } catch (e) { return false; } }
    DIR.motif = { ph, inst: d ? d.motifInst : x.inst, from: d ? d.id : null };
    return true;
  };
  Music.getMotif = () => (DIR.motif ? Object.assign({}, DIR.motif) : null);
  Music._director = { pickNext, affinity, fifthsDist, farApart, centre, DIR, AXES };
  // a piece written for a phase of the game carries an era window (def.eraWin = [lo, hi]); the programme is composed from the pieces whose
  // window holds the current era, so the early pieces fall silent as the galaxy fills and the late ones arrive — a cycle at a time, never a cut
  const fitsEra = id => { const w = TRACKS[id] && TRACKS[id].eraWin; return !w || (S.era >= w[0] - 1e-9 && S.era <= w[1] + 1e-9); };
  const eraList = ids => { const a = ids.filter(fitsEra); return a.length >= 3 ? a : ids; };   // never starve a programme
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
  // ---------------------------------------------------------------- modulation: the way from one key into the next
  // The diatonic triads of a key (root, quality, degree), the pitch classes of a chord, and a chord spelled as a numeral of a key
  function triads(def) {
    const sc = SCALES[def.mode || 'major'], tpc = PCS[def.root]; if (!sc || sc.length !== 7 || tpc === undefined) return [];
    return sc.map((d, i) => { const th = mod12(sc[(i + 2) % 7] - d), fi = mod12(sc[(i + 4) % 7] - d); const q = th === 4 && fi === 7 ? '' : th === 3 && fi === 7 ? 'm' : th === 3 && fi === 6 ? 'o' : th === 4 && fi === 8 ? '+' : null; return q === null ? null : { root: mod12(tpc + d), q, deg: i }; }).filter(Boolean);
  }
  const pcsOf = ch => (QUAL[ch.q] || QUAL['']).map(x => mod12(ch.root + x)).sort((a, b) => a - b).join(',');
  function romanIn(ch, tpc) { const name = DEG_NAME[mod12(ch.root - tpc)], lower = ch.q === 'm' || ch.q === 'o'; return (lower ? name.toLowerCase() : name) + (ch.q === 'o' ? 'o' : ch.q === '+' ? '+' : '') + (ch.seventh ? '7' : ''); }
  // The chords of an interlude's opening bars, in the numerals of the key arrived at: the old tonic first (the old piece's last chord decays
  // into its twin), then a pivot the two keys share — one with a pre-dominant role in the new key when there is one — or, when they share
  // nothing, a walk round the circle of fifths the short way (a major chord on each step, each the dominant of the next flatwards) or the
  // Neapolitan when they are far apart, then the new dominant seventh. Null when the keys are the same.
  function pivotPath(from, to) {
    const tFrom = triads(from), tTo = triads(to), tpc = PCS[to.root];
    const oldI = tFrom.find(c => c.deg === 0); if (!oldI || !tTo.length) return null;
    if (from.root === to.root && (from.mode || 'major') === (to.mode || 'major')) return null;
    const path = [oldI], d = fifthsDist(from, to);
    const shared = tTo.filter(c => c.q !== 'o' && pcsOf(c) !== pcsOf(oldI) && tFrom.some(x => pcsOf(x) === pcsOf(c)));
    const pre = shared.filter(c => c.deg === 1 || c.deg === 3 || c.deg === 5);
    if (pre.length || shared.length) path.push((pre.length ? pre : shared)[0]);
    else if (d >= 5) path.push({ root: mod12(tpc + 1), q: '' });
    else {
      const pf = FIFTHS[centre(from)], pt = FIFTHS[centre(to)], step = ((pt - pf + 12) % 12) <= 6 ? 1 : -1; let pos = pf;
      for (let i = 0; i < d - 1 && path.length < 4; i++) { pos = (pos + step + 12) % 12; for (const pc in FIFTHS) if (FIFTHS[pc] === pos) path.push({ root: +pc, q: '' }); }
    }
    path.push({ root: mod12(tpc + 7), q: '', seventh: true });
    return path.map(c => romanIn(c, tpc));
  }
  // the pulse an outgoing piece is felt in, against the tempo arrived at: whole beats, halves or thirds of the bar (a quick six is felt in
  // dotted beats, a battle's four in halves), whichever lands nearest the new tempo
  function pulseK(def, target) { let best = 1, bd = Infinity; for (const k of [1, 2, 3]) { if ((def.meter || 4) % k || def.bpm / k < 34) continue; const dd = Math.abs(Math.log((def.bpm / k) / target)); if (dd < bd) { bd = dd; best = k; } } return best; }
  Music._modulation = { triads, pivotPath, romanIn, pulseK };


  // ---------------------------------------------------------------- colour: what a piece is scored for, and an interlude that keeps it
  // Every instrument preset belongs to a family (by the recording behind it, or the synth voice when there is none); a piece's palette is
  // the weight of each family across its sections — bars × level × the part's velocity, the edge sections counted three times when the head
  // (what an interlude hands into) or the tail (what it takes over from) is asked for. Alternations count a share each.
  const FAMILY = { strEns: 'strings', strEnsTrem: 'strings', vln1Trem: 'strings', vcSus: 'strings', vcTrem: 'strings', vlaSus: 'strings',
    cbSus: 'low', subBass: 'low', cbPizz: 'low', tubaSus: 'low',
    hornSus: 'brass', hornSolo: 'brass', brassEns: 'brass', brassStac: 'brass', tptSus: 'brass', tptSolo: 'brass', lowBrass: 'brass', tbnSus: 'brass',
    flute: 'winds', altoFlute: 'winds', fluteSus: 'winds', oboe: 'winds', corAnglais: 'winds', clarinet: 'winds', bassoon: 'winds',
    vlnSolo: 'strings', vlaSolo: 'strings', vcSolo: 'strings', cbSolo: 'strings', hornIowa: 'brass', tbnSolo: 'brass', bassTbn: 'brass', tubaIowa: 'brass', tptIowa: 'brass', bassClar: 'winds', clarIowa: 'winds', altoFluteIowa: 'winds', fluteIowa: 'winds', oboeIowa: 'winds', bassoonIowa: 'winds', pipes: 'winds', pipesDrone: 'winds',
    strEnsPizz: 'pluck', strEnsSpic: 'pluck', harp: 'pluck', marimba: 'pluck', celeste: 'bells', glock: 'bells', crotales: 'bells', chimes: 'bells',
    chorus: 'choir', chorusMen: 'choir', chorusWomen: 'choir', padGlass: 'synth', padSerrie: 'synth', padAir: 'synth', organ: 'synth', organSoft: 'synth' };
  const V_FAMILY = { pad: 'synth', bass: 'low', brass: 'brass', flute: 'winds', pluck: 'pluck', bell: 'bells', chime: 'bells', choir: 'choir', drone: 'synth' };
  const SUSTAIN = { pad: 1, pad2: 1, choir: 1, choir2: 1 };
  const SUSTAINS = { strings: 1, synth: 1, choir: 1, brass: 1, winds: 1 };   // the families that can hold a chord (a harp or a celeste in a pad slot would only tick)
  const familyOf = name => { const i = INST[name]; return i ? (i.smp && FAMILY[i.smp]) || V_FAMILY[i.v] || null : null; };
  const instName = (cfg, key, inst) => { const own = cfg && typeof cfg === 'object' ? (typeof cfg.inst === 'object' && cfg.inst ? cfg.inst.p : cfg.inst) : null; return own || inst[key] || DEF_INST[key]; };
  const secLevel = sc => sc.cres ? (num(sc.cres[0], 1) + num(sc.cres[1], 1)) / 2 : num(sc.lv, 1);
  const PAL = typeof WeakMap === 'function' ? new WeakMap() : null;
  function palette(def, where) {
    const memo = PAL && PAL.get(def); if (memo && memo[where || 'all']) return memo[where || 'all'];
    const out = {}, secs = def.sec || [], nS = secs.length, alts = def.alts && def.alts.length ? def.alts : [{}];
    secs.forEach((sc, i) => {
      const edge = where === 'head' ? (i < 2 ? 3 : 1) : where === 'tail' ? (i >= nS - 2 ? 3 : 1) : 1, w0 = num(sc.bars, 4) * secLevel(sc) * edge;
      for (const key in GEN) {
        const cfg = sc[key]; if (!cfg || key === 'bass' || key === 'drums' || key === 'perc' || key === 'timp') continue;   // the bass and the drums are not a colour: every piece has them
        const w = w0 * (typeof cfg === 'object' ? num(cfg.vel, 1) * (1 - num(cfg.skip, 0)) * (SUSTAIN[key] && cfg.n ? Math.min(cfg.n, 4) / 3 : 1) : 1) * ((LAYERS[BUS[key]] || {}).lvl || 0.7) / alts.length;   // a one-voice bed is a third of the colour
        for (const alt of alts) { const f = familyOf(instName(cfg, key, Object.assign({}, def.inst || {}, alt))); if (f) out[f] = (out[f] || 0) + w; }
      }
    });
    if (PAL) PAL.set(def, Object.assign(memo || {}, { [where || 'all']: out }));
    return out;
  }
  const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] * a[k]; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] * b[k]; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const blend = (a, b) => { const o = {}, add = p => { let n = 0; for (const k in p) n += p[k]; if (n) for (const k in p) o[k] = (o[k] || 0) + p[k] / n; }; if (a) add(a); if (b) add(b); return o; };
  // the sustained colour a piece ends in (or opens with): the weightiest pad or choir part of its edge sections, with its register and voicing
  function colourOf(def, where) {
    const secs = def.sec || [], nS = secs.length, inst = Object.assign({}, def.inst || {}, def.alts && def.alts.length ? def.alts[0] : {}); let best = null;
    secs.forEach((sc, i) => {
      const edge = where === 'head' ? (i < 2 ? 3 : 1) : (i >= nS - 2 ? 3 : 1);
      for (const key in SUSTAIN) {
        const cfg = sc[key]; if (!cfg) continue;
        const w = num(sc.bars, 4) * secLevel(sc) * edge * (typeof cfg === 'object' ? num(cfg.vel, 1) * (1 - num(cfg.skip, 0)) : 1), name = instName(cfg, key, inst);
        const fam = familyOf(name); if (fam && SUSTAINS[fam] && (!best || w > best.w)) best = { w, name, key, fam, reg: typeof cfg === 'object' ? cfg.reg : null, n: typeof cfg === 'object' ? cfg.n : null };   // a colour that can be held
      }
    });
    return best;
  }
  // how well an interlude template (or one of its alternations) sits between two pieces: its palette against theirs (the tail of the one
  // ending, the head of the one coming), and its character against the mean of their tags
  function colourFit(d, from, next) {
    const tgt = blend(from && palette(from, 'tail'), next && palette(next, 'head')), c = cosine(palette(d), tgt);
    const tg = d.tags || {}, mean = k => { const v = [from, next].filter(Boolean).map(x => num((x.tags || {})[k], k === 'dark' ? 0.3 : 0.4)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const dk = mean('dark'), en = mean('energy'), f = dk === null ? 0.7 : 1 - 0.5 * Math.abs(num(tg.dark, 0.3) - dk) - 0.5 * Math.abs(num(tg.energy, 0.3) - en);
    return 0.7 * c + 0.3 * f;
  }
  // the template for the seam between two pieces, by weighted chance — a good fit is several times as likely as a poor one, never certain
  function chooseTemplate(pool, from, next) {
    if (!pool.length) return null; if (pool.length === 1 || (!from && !next)) return pool[Math.floor(Math.random() * pool.length)];
    const ws = pool.map(t => TRACKS[t] ? Math.exp(6 * colourFit(TRACKS[t], from, next)) : 1), tot = ws.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) return pool[i]; } return pool[pool.length - 1];
  }
  const freeSlot = (sc, choir) => (choir ? ['choir2', 'choir', 'pad2'] : ['pad2', 'choir2', 'choir']).find(k => !sc[k]) || null;
  Music._colour = { palette, familyOf, colourOf, colourFit, chooseTemplate };

  // the interlude for the piece that follows: the template transposed to its key and mode (cached as a hidden track 'drift:<id>'); with
  // o.from (the piece ending) its opening bars keep that piece's meter and pulse, walk the pivot chords from its key while the tempo glides to
  // the new piece's, and the body continues in the new meter at the new tempo
  const outgoing = p => p && !p.stopped ? (p.def.interlude ? Object.assign({}, p.def, { interlude: false, bridge: false }) : p.def) : DIR.lastPiece ? TRACKS[DIR.lastPiece] : null;   // the piece (or the interlude, already in the next key) the seam leaves
  // where a piece's quiet half begins: its first section at or under half level and four bars or more, after the loop point (seconds into the first pass); 0 when it has none
  function quietStart(def) {
    try { const P = prepare(def), r = compilePass(def, 0); for (let i = (P.loopIdx || 0) + 1; i < r.wraps.length; i++) { const w = r.wraps[i]; if (w.bars >= 4 && Math.max(w.R.lv0, w.R.lv1) <= 0.5 && w.R.tens !== false) return w.t0; } for (let i = (P.loopIdx || 0) + 1; i < r.wraps.length; i++) { const w = r.wraps[i]; if (w.bars >= 4 && Math.max(w.R.lv0, w.R.lv1) <= 0.52) return w.t0; } } catch (e) { /* a piece without a still */ }
    return 0;
  }
  function interludeFor(template, nextId, o) {
    const T = TRACKS[template], N = TRACKS[nextId], long = !!(o && o.long);
    if (!T || !N || N.interlude) return null;
    const from = o && o.from && o.from.id !== nextId && !o.from.interlude && o.from.bpm && PCS[o.from.root] !== undefined ? o.from : null;
    const id = template + ':' + nextId + (long ? ':long' : '') + (o && o.motif && o.motif.ph ? ':m' + (o.motif.from || String(o.motif.ph).length) : '') + (from ? ':f' + from.id : '');
    if (TRACKS[id]) return id;
    const d = JSON.parse(JSON.stringify(T)); delete d._p; delete d.id;
    if (long) for (const sct of d.sec) {               // the breath: half as long again and a shade quieter, before a piece of a very different kind
      if (sct.n === 'A') { sct.bars = Math.round(sct.bars * 1.5); if (sct.cres) sct.cres = sct.cres.map(x => x * 0.85); else sct.lv = num(sct.lv, 1) * 0.85; }
      if (sct.n === 'out') { sct.bars = 3; sct.barsVar = [2, 3]; }
    }
    if (o && o.motif && o.motif.ph && (d.meter || 4) === 4) {   // the motif, once, in the interlude's own voice: a race just met, the council's call
      d.ph = Object.assign({}, d.ph || {}, { M: o.motif.ph });
      const bars = parsePhrase(o.motif.ph, d.meter || 4).bars, A = d.sec.find(x => x.n === 'A');
      if (A && bars <= A.bars) { const r = A.bars - bars, lead = A.lead && typeof A.lead === 'object' ? A.lead : {}; A.lead = Object.assign({}, lead, { ph: r >= 4 ? ['r2 M', 'r' + (r - 2) + ' M r2', 'M r' + r] : ['M'], inst: o.motif.inst || lead.inst, vel: num(lead.vel, 0.4) + 0.06, echo: 0.3, skip: 0, rest: 0 }); }
    }
    if (d.alts && d.alts.length > 1) {                   // the alternation of the template that sits best between the two pieces, pinned
      let best = null, bw = -1; for (const alt of d.alts) { const w = colourFit(Object.assign({}, d, { alts: [alt] }), from, N); if (w > bw) { bw = w; best = alt; } }
      d.inst = Object.assign({}, d.inst || {}, best || {}); delete d.alts;
    }
    d.root = N.root; d.mode = SCALES[N.mode || 'major'].length === 7 ? (N.mode || 'major') : 'major';
    const oldScale = SCALES[T.mode || 'major'], newScale = SCALES[d.mode], prog = DRIFT_PROG[d.mode];
    for (const sct of d.sec) {
      const toks = String(sct.prog).replace(/\|/g, ' ').trim().split(/\s+/);
      sct.prog = toks.length > 1 && prog ? prog : toks.map(t => respell(t, oldScale, newScale)).join(' ');   // the consonant walk of each mode; a lone chord is simply re-spelled
    }
    if (N.tonic !== undefined) d.tonic = N.tonic; else if (N.oct) d.oct = N.oct;
    if (from && T.bridge) {                               // a bridge: its first bar on the outgoing tonic, its second on the cue's dominant seventh, at its own pace
      const path = pivotPath(from, N), B = d.sec[0];
      if (path && B) B.prog = path[0] + ' ' + path[path.length - 1];
    } else if (from) {
      const inS = d.sec.find(x => x.n === 'in'), path = pivotPath(from, N), k = pulseK(from, N.bpm);
      if (inS) {
        inS.meter = (from.meter || 4) / k; inS.bpm = from.bpm / k; inS.bpmTo = N.bpm;     // the outgoing bars and pulse, gliding to the new tempo
        if (path) {                                                                         // each pivot chord has time to be heard: the old tonic spans the old piece's fade (it is still
          const barLen = 60 / inS.bpm * inS.meter, need = secs => Math.max(1, Math.ceil(secs / barLen - 0.15));   // sounding under these bars), every other chord five seconds or so
          const dw = path.map((c, i) => need(i === 0 ? 7 : 5)), total = () => dw.reduce((x, y) => x + y, 0);
          while (total() * barLen > 26 && dw.slice(1, -1).some(x => x > 1)) { let j = 1, m = 0; for (let i = 1; i < dw.length - 1; i++) if (dw[i] > m) { m = dw[i]; j = i; } dw[j]--; }   // a long walk moves on sooner in the middle
          inS.prog = path.map((c, i) => c + ':' + dw[i]).join(' '); inS.bars = total(); delete inS.barsVar;
        }
      }
      d.bpm = N.bpm; d.meter = N.meter || 4;                                              // the body in the new meter at the new tempo
      if (inS) { const lv = secLevel(from.sec[from.sec.length - 1]); if (inS.cres) inS.cres = [clamp(lv * 0.8, inS.cres[0], 0.55), inS.cres[1]]; }   // open near the level the piece ends at
      if (d.meter !== 4) for (const sct of d.sec) if (sct.n !== 'in' && sct.lead) sct.lead = Object.assign({}, typeof sct.lead === 'object' ? sct.lead : { ph: sct.lead }, { ph: 'r' + sct.bars });   // the interludes' lines are written in four
    }
    // the colours either side bleed into the interlude's edges: the sustained voice the old piece ends in holds under the opening bars, the
    // voice the new piece opens with is already there under the last; the template's own voice keeps the middle (never a slot it uses itself)
    const inS = d.sec.find(x => x.n === 'in'), outS = d.sec[d.sec.length - 1], carry = (sc, c, vel) => {
      if (!sc || !c) return; const own = familyOf(instName(sc.pad, 'pad', d.inst || {}));
      if (c.fam === own || Object.keys(SUSTAIN).some(k => sc[k] && familyOf(instName(sc[k], k, d.inst || {})) === c.fam)) return;
      const slot = freeSlot(sc, c.fam === 'choir'); if (!slot) return;
      const reg = c.reg || (c.fam === 'choir' ? [55, 77] : [50, 72]), spec = { inst: c.name, n: Math.min(c.n || 3, 3), reg, vel };
      sc[slot] = SUSTAIN[slot] && /choir/.test(slot) ? Object.assign(spec, { soft: true }) : Object.assign(spec, { p: 'swell' });
    };
    if (from && !T.bridge) carry(inS, colourOf(from, 'tail'), 0.5);
    if (outS && outS !== inS && !T.bridge) { carry(outS, colourOf(N, 'head'), 0.45); if (outS.lv !== undefined && !outS.cres) { const lv = secLevel(N.sec[0]); outS.cres = [outS.lv, clamp(lv * 0.8, outS.lv, 0.5)]; delete outS.lv; } }
    d.hidden = true; d.interlude = true; d.desc = (T.desc || template) + ' (in the key of ' + nextId + ')';
    return Track(id, d).id;
  }

  // Switches happen on the bar (opts.quantize 'bar', the default; 'beat' for urgent cues; false = now) with long crossfades, so a
  // change of scene reads as a phrase ending rather than a jump cut.
  function startTrack(id, opts) {
    const def = TRACKS[id], eng = A.engine, fade = num(opts.fade, 3.5);
    if (opts.bridge && S.cur && !S.cur.stopped && S.cur.id !== id && !S.cur.def.bridge && TRACKS['bridge:' + opts.bridge]) {
      // a cue that cannot wait still gets a way in: a two-bar bridge in its key starts on the next beat, the old piece fades under it, and the
      // cue enters as the bridge crests
      const b = interludeFor('bridge:' + opts.bridge, id, { from: outgoing(S.cur) });
      if (b) {
        const len = compilePass(TRACKS[b], 0).len, at = S.cur.nextBoundary('beat');
        const then = { id, opts: Object.assign({}, opts, { bridge: undefined, quantize: false, fade: num(opts.fade, 1.5), inFade: Math.min(1.6, num(opts.fade, 1.5)), oldFade: 1.2 }), at: at + len - 0.7 };
        S.switchAt = { id: b, opts: { fade: 0.5, inFade: 0.5, oldFade: Math.max(1.5, len * 0.8), loop: false, keepPlaylist: !!opts.keepPlaylist, quantize: false }, at, then };
        if (!opts.keepPlaylist) { S.playlist = null; S.plWait = null; }
        ensureTimer(); return true;
      }
    }
    if (opts.quantize !== false && S.cur && !S.cur.stopped && S.cur.id !== id) {
      const at = S.cur.nextBoundary(opts.quantize || 'bar');
      if (at - eng.ctx.currentTime > 0.1) { S.switchAt = { id, opts: Object.assign({}, opts, { quantize: false }), at }; if (!opts.keepPlaylist) { S.playlist = null; S.plWait = null; } ensureTimer(); return true; }
    }
    S.switchAt = null;
    if (!opts.keepPlaylist) { S.playlist = null; S.plWait = null; }
    const p = new Player(eng, def, { loop: opts.loop !== false, intensity: S.intensity });
    if (opts.from > 0) { p.shift = num(opts.from, 0); p.skipBefore = 0; }   // start part-way through the first pass (a demo, a test)
    else if (opts.quiet) { const q = quietStart(def); if (q > 0) { p.shift = q; p.skipBefore = 0; } }   // land on the piece's quiet half (back from a fight)
    if (!def.hidden || def.variantOf) { const pid = def.variantOf || id; DIR.hist[pid] = eng.ctx.currentTime; DIR.lastPiece = pid; }   // a war-time reading counts as its piece
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
      if (S.switchAt && !opts.restart && (S.switchAt.id === id || (S.switchAt.then && S.switchAt.then.id === id))) return true;   // already on its way (behind a bridge, or armed on the bar)
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
      const d = TRACKS[id], P = prepare(d), r0 = compilePass(d, 0), r1 = compilePass(d, 1), introW = r0.wraps[P.loopIdx];
      return { id, desc: d.desc, bpm: d.bpm, seconds: Math.round(r1.len), introSeconds: Math.round(introW ? introW.t0 : 0) };
    });
  };
  function makePlaylist(ids, opts) {
      ids = (ids || Object.keys(TRACKS)).filter(id => TRACKS[id]);
      if (!ids.length) return null;
      const pl = {
        ids, shuffle: !!opts.shuffle, gap: Array.isArray(opts.gap) ? opts.gap.slice() : num(opts.gap, 1.5), fade: num(opts.fade, 3), order: opts.shuffle ? shuffled(ids) : ids.slice(), i: 0, advancing: false,
        between: opts.between ? [].concat(opts.between).filter(t => TRACKS[t]) : null, betweenP: num(opts.betweenP, 0.5), gapIn: Array.isArray(opts.gapIn) ? opts.gapIn.slice() : num(opts.gapIn, 0), queued: null, lastTpl: null, director: !!opts.director,
      };
      if (pl.between && !pl.between.length) pl.between = null;
      if (opts.rare) { const ids = [].concat(opts.rare.ids || opts.rare).filter(id => TRACKS[id] && pl.ids.indexOf(id) < 0); pl.rare = ids.length ? { ids, p: typeof opts.rare.p === 'object' ? Object.assign({}, opts.rare.p) : num(opts.rare.p, 0.35) } : null; }
      if (pl.shuffle) pl.order = composeOrder(pl, opts.last);
      if (pl.director && !opts.start) { const pick = pickNext(pl, opts.last || DIR.lastPiece); pl.order = [pick].concat(pl.order.filter(id => id !== pick)); }   // the director opens the programme too
      if (opts.start && TRACKS[opts.start] && pl.order.indexOf(opts.start) < 0 && (pl.ids.indexOf(opts.start) >= 0 || (pl.rare && pl.rare.ids.indexOf(opts.start) >= 0))) pl.order.unshift(opts.start);   // restored mid-piece (a rare one, or one the era has set aside): come back to it
      if (opts.start && pl.order.indexOf(opts.start) >= 0) {           // begin with a given track (the rest keeps its order / shuffle)
        const k = pl.order.indexOf(opts.start);
        pl.order = pl.shuffle ? [opts.start].concat(pl.order.filter(id => id !== opts.start)) : pl.order.slice(k).concat(pl.order.slice(0, k));
      }
      return pl;
  }
  Music.playlist = function (ids, opts) {
    try {
      opts = opts || {};
      const pl = makePlaylist(ids, opts);
      if (!pl) return false;
      const first = pl.order[0];
      if (!A.isReady()) { S.pending = { id: first, opts: { loop: false } }; S.playlist = pl; A.onReady(() => { const p = S.pending; if (p) { S.pending = null; startTrack(p.id, { fade: 1, loop: false, keepPlaylist: true }); } }); return 'pending'; }
      S.playlist = pl;
      return startTrack(first, { fade: num(opts.firstFade, 1.5), loop: false, keepPlaylist: true, bridge: opts.bridge, from: opts.from, quiet: opts.quiet });
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
    const p = S.cur; if (!p || p.stopped || !A.engine || p.def.bridge) return;   // a bridge is five seconds long: not worth restarting
    const elapsed = A.engine.ctx.currentTime - p.t0;
    if (elapsed >= 0 && elapsed < 14) { const keep = S.switchAt; startTrack(p.id, { fade: 2.5, loop: p.loop, keepPlaylist: true, quantize: false }); if (keep) S.switchAt = keep; }   // a switch already armed (a bar line, a bridge's cue) stays armed
  };

  // A scene that borrows the music (GNN, lab, spy panels) takes a snapshot first and restores it afterwards: a running playlist
  // (the galaxy rotation) comes back as a playlist, a single looping track as that track, silence as silence.
  Music.snapshot = function () {
    const pl = S.playlist;
    return { id: Music.current(), playlist: pl ? { ids: pl.ids.slice(), shuffle: pl.shuffle, gap: pl.gap, gapIn: pl.gapIn, fade: pl.fade, between: pl.between, betweenP: pl.betweenP, rare: pl.rare, director: pl.director, start: pl.queued || (S.plWait && S.plWait.id) || pl.order[pl.i] } : null };
  };
  Music.restore = function (snap, opts) {
    try {
      opts = opts || {};
      const fade = num(opts.fade, 1.5);
      if (!snap) return Music.stop({ fade });
      if (snap.playlist) { const pl = snap.playlist; return Music.playlist(pl.ids, { shuffle: pl.shuffle, gap: pl.gap, gapIn: pl.gapIn, fade: pl.fade, between: pl.between, betweenP: pl.betweenP, rare: pl.rare, director: pl.director, start: pl.start, firstFade: fade, bridge: opts.bridge, quiet: opts.quiet }); }
      if (snap.id) return Music.play(snap.id, { fade, bridge: opts.bridge });
      return Music.stop({ fade });
    } catch (e) { console.warn('[music] restore failed', e); return false; }
  };

  // The programme (which pieces the map plays and when) lives in js/audio/score/programme.js and is handed in through defineProgramme.
  let GALAXY = [], GALAXY_EARLY = [], MOODS = {}, INTERLUDES = [], MOOD_ROTATE = {};
  Music.defineProgramme = function (p) { p = p || {}; MOODS = p.moods || {}; MOOD_ROTATE = p.rotate || {}; GALAXY = p.galaxy || []; GALAXY_EARLY = p.early || []; INTERLUDES = p.interludes || []; };
  // A running programme gives way to another without a cut: the new programme's first piece enters where the current piece would naturally
  // let it in — its next breath or section line, within a minute or two — through an interlude in the new piece's key, with the long seam
  // fades of the rotation; the old piece finishes its phrase and decays under the newcomer. Nothing is heard but the music moving on.
  function softSwitch(ids, rot, opts) {
    const p = S.cur;
    if (!S.playlist || !p || p.stopped || S.plWait || !A.isReady()) return false;
    const pl = makePlaylist(ids, Object.assign({}, rot, { shuffle: true, last: DIR.lastPiece || p.id }));
    if (!pl) return false;
    const fade = Math.max(4, num(opts.fade, num(rot.fade, 6)));
    let id = pl.order[0];
    const first = id;
    let far = false;
    if (pl.between && Math.random() < pl.betweenP) {
      far = farApart(outgoing(p), TRACKS[id]);                                          // a very different piece next: the breath, as the director's seam has it
      const quiet = far ? pl.between.filter(t => QUIET[t]) : pl.between, pool = quiet.length ? quiet : pl.between;
      const tpl = chooseTemplate(pool, outgoing(p), TRACKS[id]), d = interludeFor(tpl, id, { long: far, motif: DIR.motif, from: outgoing(p) });
      if (d) { pl.lastTpl = tpl; pl.queued = id; id = d; pl.far = !!far; DIR.motif = null; }
    }
    const at = p.nextSectionBoundary(Math.max(2, fade * 0.5), num(opts.within, 100));
    pl.advancing = true;
    S.playlist = pl; S.plWait = null;
    S.switchAt = { id, opts: { fade: fade + (far ? 2 : 0), inFade: fade + (far ? 2 : 0), oldFade: fade + 4 + (far ? 2 : 0), loop: false, keepPlaylist: true, quantize: false }, at };
    ensureTimer();
    return first;
  }
  let moodTick = 0;
  Music.moods = () => Object.keys(MOODS).concat(Object.keys(TRACKS).filter(id => id.indexOf('race:') === 0));
  // setMood('combat' | 'explore' | 'council' | 'human' | 'race:human' | any track id, {fade, loop, soft}) -> id of the track chosen (or false)
  // soft: a programme already running changes to the new one at the current piece's next breath or section line (see softSwitch)
  Music.setMood = function (mood, opts) {
    try {
      opts = opts || {};
      let pick = MOODS[mood] || (TRACKS[mood] ? mood : (TRACKS['race:' + mood] ? 'race:' + mood : null));
      if (!pick) { console.warn('[music] unknown mood "' + mood + '"'); return false; }
      if (Array.isArray(pick)) {
        const rot = MOOD_ROTATE[mood], list = rot ? eraList(pick) : pick;
        const cur = list.indexOf(Music.current()), next = list[cur >= 0 ? (cur + 1) % list.length : (moodTick++) % list.length];
        if (rot) {
          if (opts.soft) { const r = softSwitch(pick, rot, opts); if (r) return r; }
          const r = Music.playlist(pick, Object.assign({}, rot, { shuffle: true, start: rot.director ? undefined : next, firstFade: num(opts.fade, 2), bridge: opts.bridge, quiet: opts.quiet })); return r === false ? false : (rot.director ? (S.playlist && S.playlist.order[0]) || next : next);
        }
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
    for (const w of r0.wraps) { out.secs.push({ n: w.R.n, bars: w.bars, at: Math.round(w.t0 * 10) / 10 }); acc += w.len; }
    out.introSec = Math.round((r0.wraps[P.loopIdx] ? r0.wraps[P.loopIdx].t0 : 0) * 10) / 10;
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
      const bis = (e.b - w.start) % w.R.meter, st = w.R.strong.some(x => Math.abs(bis - x) < 1e-6);
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
    out.themes = Object.keys(P.themes);
    return out;
  };
  Music._compile = (id, pass, form0, alt0, take, era) => compilePass(TRACKS[id], pass || 0, form0, alt0, take, era);
  Music._define = Track;                          // test hook: register a (hidden) track at run time
  Music._quietStart = def => quietStart(def);      // test hook: where a piece's quiet half begins
  Music._tracks = TRACKS; Music._INST = INST; Music._parseChord = parseChord;

  // The score itself — every Track(id, def) — lives in js/audio/score/*.js (themes, cues, map, races, programme), loaded after this file.
  Music._hitsVariant = hitsVariant;





















  // The war-time readings of the rare pieces: the same music with the Mutiny-style synthetic hits (processed booms, synth kick and snare,
  // anvil) placed in the big sections, sparse in the first; the war rotation plays these instead of the plain ones.
  function hitsVariant(baseId) {
    const base = TRACKS[baseId]; if (!base) return null;
    const d = JSON.parse(JSON.stringify(base)); delete d._p; delete d.id;
    d.hidden = true; d.variantOf = baseId; d.desc = String(base.desc).split(' — ')[0] + ', at war: the same piece with synthetic drum hits in its big sections';
    d.mix = Object.assign({}, d.mix || {}, { drums: 1.15 }); d.trim = num(base.trim, DEFAULT_TRIM);
    for (const sct of d.sec) {
      const top = sct.cres ? sct.cres[1] : num(sct.lv, 1);
      if (top >= 0.9) sct.drums = { p: 'mutiny', vel: 0.9 };
      else if (top >= 0.75 && sct.n !== 'intro') sct.drums = { p: 'mutiny', vel: 0.6, skip: 0.3 };
    }
    return Track(baseId + ':war', d);
  }
































  // ================================================================== espionage (spy panels borrow the music, see js/ui/spyscenes.js)

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
    const fifth = has(root + 7) ? 7 : (/\+/.test(m[3]) && has(root + 8)) ? 8 : has(root + 6) ? 6 : has(root + 8) ? 8 : 7;   // an augmented chord stays augmented where the new scale allows (the whole-tone pieces)
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
      if (sct.lead2 && typeof sct.lead2 === 'object' && sct.lead2.inst) { sct.lead2.inst = 'brassStab'; if (sct.lead2.oct) sct.lead2.oct = 0; }   // the brass has no bells' octave, and no octave below (the stabs would sit on the bass)
      if (sct.lead && typeof sct.lead === 'object' && !sct.lead.inst && sct.lead.oct > 0) sct.lead.oct = 0;
      if (sct.choir && typeof sct.choir === 'object' && !sct.choir.reg) sct.choir.reg = [41, 62];   // the men sing in their own register
      if (sct.pad && typeof sct.pad === 'object' && sct.pad.inst) sct.pad.inst = 'dark';
    }
    d.variantOf = baseId;
    return Track(baseId + ':war', d);
  }
  Music._warVariant = warVariant; Music._respell = respell;
  Music._rotation = { shuffled, composeOrder, interludeFor, pickGap, fitsEra, eraList, softSwitch, pickNext, S, get GALAXY() { return GALAXY; }, get GALAXY_EARLY() { return GALAXY_EARLY; }, get INTERLUDES() { return INTERLUDES; }, get MOODS() { return MOODS; } };  // test hooks

})(window.MOO);
