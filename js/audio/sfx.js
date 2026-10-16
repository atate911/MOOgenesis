// Master of Orion — Reborn · synthesized sound effects.
// MOO.Audio.SFX.play(id, {vol, pan, rate}) — silently does nothing until audio is unlocked; never throws.
// Every effect is built from a few primitives (tone / noise / voice) that scale pitch + speed with `rate`,
// get a tiny random pitch variation per call, start from silence and end on an exponential decay (click-free).
// Levels (measured with tools/audio-report.js, unity gain): interface sounds sit around -30 LUFS, stingers and big combat sounds
// around -14, frequent weapon sounds around -22; the music loops are -16..-21, so stingers also dip the music a few dB (DUCK below).
(function (M) {
  'use strict';

  const A = M.Audio;
  const K = A.kit;
  const clamp = K.clamp;
  const V = A.Voices;
  const SFX = A.SFX = {};
  const FX = Object.create(null), ORDER = [];
  const warned = {};

  // ------------------------------------------------------------------ session + primitives
  const rrIdx = Object.create(null);
  function Sess(eng, o) {
    this.eng = eng; this.t0 = o.t0; this.o = o; this.id = o.id || '?';
    const vary = o.vary === undefined ? 0.04 : o.vary;
    this.R = (o.rate > 0 ? clamp(o.rate, 0.25, 4) : 1) * (1 + (eng.rand() - 0.5) * 2 * vary);
    this.vol = (o.vol === undefined ? 1 : clamp(o.vol, 0, 2)) * (o.gain === undefined ? 1 : o.gain) * (1 + (eng.rand() - 0.5) * 2 * (vary ? 0.07 : 0));
    this.pan = clamp(o.pan || 0, -1, 1);
  }
  Sess.prototype.rnd = function () { return this.eng.rand(); };
  // take rotation: the next of n variants, never the one that just played (frequent sounds stop feeling stamped)
  Sess.prototype.pick = function (n) {
    if (this.o.vary === 0) return 0;                                 // deterministic renders always take the first variant
    const prev = rrIdx[this.id], i = prev === undefined ? Math.floor(this.rnd() * n) : (prev + 1 + Math.floor(this.rnd() * Math.max(1, n - 1))) % n;
    rrIdx[this.id] = i;
    return i;
  };
  // sampled layer from assets/audio (orchestral drums, cymbals, gong, harp, brass, choir); silent until loaded unless `fb` names a synth voice
  Sess.prototype.smp = function (name, p) { return this.v('sample', Object.assign({ smp: name, fb: 'none', oneShot: true, dyn: 0.8, send: 0.1 }, p || {})); };

  // swept filter helper: spec is a number or [f0, f1, q]
  function addFilter(v, node, type, spec, t, dur, R) {
    const a = Array.isArray(spec) ? spec : [spec, spec];
    const f = v.filter(type, a[0] * R, a[2] === undefined ? (type === 'bandpass' ? 1 : 0.7) : a[2]);
    if (a[1] !== undefined && a[1] !== a[0]) { f.frequency.setValueAtTime(a[0] * R, t); f.frequency.exponentialRampToValueAtTime(Math.max(10, a[1] * R), t + dur); }
    node.connect(f);
    return f;
  }
  function filters(v, node, p, t, dur, R) {
    if (p.hp) node = addFilter(v, node, 'highpass', p.hp, t, dur, R);
    if (p.bp) node = addFilter(v, node, 'bandpass', p.bp, t, dur, R);
    if (p.lp) node = addFilter(v, node, 'lowpass', p.lp, t, dur, R);
    return node;
  }
  function amplitude(S, v, node, p, t, dur, att, rel) {
    const g = v.gain(0.0001), peak = Math.max(0.0003, (p.vel === undefined ? 0.3 : p.vel) * S.vol);
    if (p.am) {                                   // tremolo before the envelope
      const depth = p.am[1], tg = v.gain(1 - depth / 2), lf = v.osc('sine', p.am[0] * S.R, t, t + dur + rel + 0.08), lg = v.gain(depth / 2);
      lf.connect(lg); lg.connect(tg.gain); node.connect(tg); node = tg;
    }
    node.connect(g); g.connect(v.out);
    if (p.env === 'swell') {
      g.gain.setValueAtTime(0.0003, t);
      g.gain.exponentialRampToValueAtTime(peak, t + dur * (p.pk || 0.85));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (p.sus) K.envAdsr(g.gain, t, peak, att, 0, 1, dur, Math.max(0.03, rel));
    else K.envPerc(g.gain, t, peak, att, Math.max(0.01, dur - att));
    return g;
  }

  // tone: p = {type, f, f1, at, dur, att, vel, sw, lin, det, det2, fm:{r, idx, dec}, lp/hp/bp, am:[rate, depth], drive, sus, rel, send, pan}
  Sess.prototype.tone = function (p) {
    const eng = this.eng, R = this.R, t = this.t0 + (p.at || 0) / R;
    const dur = Math.max(0.015, (p.dur || 0.2) / R), att = Math.max(0.0015, (p.att === undefined ? 0.004 : p.att) / R), rel = (p.rel || 0) / R;
    const v = eng.voice(eng.sfxIn, t, 3, clamp(this.pan + (p.pan || 0), -1, 1), p.send);
    if (!v) return null;
    const end = t + dur + rel + 0.08, f0 = Math.max(8, p.f * R), f1 = p.f1 ? Math.max(8, p.f1 * R) : f0, tsw = t + dur * (p.sw === undefined ? 1 : p.sw);
    const wave = p.type === 'pulse' ? eng.pulse(p.duty || 0.25) : (p.type || 'sine');
    const sweep = (osc, mul) => {
      if (f1 === f0) return;
      osc.frequency.setValueAtTime(f0 * mul, t);
      if (p.lin) osc.frequency.linearRampToValueAtTime(f1 * mul, tsw); else osc.frequency.exponentialRampToValueAtTime(f1 * mul, tsw);
    };
    const car = v.osc(wave, f0, t, end); sweep(car, 1);
    if (p.det) car.detune.value = p.det;
    let node = car;
    if (p.det2 || p.mix2) {                       // second, detuned oscillator for thickness
      const c2 = v.osc(wave, f0, t, end); sweep(c2, 1); c2.detune.value = p.det2 || 8;
      const mx = v.gain(1); car.connect(mx); c2.connect(mx); node = mx;
    }
    if (p.fm) {
      const mf = f0 * p.fm.r, depth = Math.min(mf * p.fm.idx, 9000), m = v.osc('sine', mf, t, end), mg = v.gain(depth);
      sweep(m, p.fm.r);
      mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * (p.fm.end === undefined ? 0.05 : p.fm.end)), t + dur * (p.fm.dec || 1));
      m.connect(mg); mg.connect(car.frequency);
    }
    if (p.drive) { const sh = v.shaper(eng.curves.hard); node.connect(sh); node = sh; }
    node = filters(v, node, p, t, dur, R);
    amplitude(this, v, node, p, t, dur, att, rel);
    return v.end();
  };

  // noise burst: p = {kind, at, dur, att, vel, env:'perc'|'swell', pk, lp/hp/bp, am, send, pan}
  Sess.prototype.noise = function (p) {
    const eng = this.eng, R = this.R, t = this.t0 + (p.at || 0) / R;
    const dur = Math.max(0.01, (p.dur || 0.2) / R), att = Math.max(0.0008, (p.att === undefined ? 0.003 : p.att) / R), rel = (p.rel || 0) / R;
    const v = eng.voice(eng.sfxIn, t, 3, clamp(this.pan + (p.pan || 0), -1, 1), p.send);
    if (!v) return null;
    const end = t + dur + rel + 0.08, src = v.noise(p.kind || 'white', t, end);
    let node = filters(v, src, p, t, dur, R);
    amplitude(this, v, node, p, t, dur, att, rel);
    return v.end();
  };

  // run one of the shared voice factories (kick, boom, brass, bell, ...) with pitch/speed scaling
  Sess.prototype.v = function (name, p) {
    const R = this.R, o = Object.assign({}, p), t = this.t0 + (p.at || 0) / R;
    if (o.f) o.f *= R; if (o.f0) o.f0 *= R; if (o.dur) o.dur /= R;
    o.vel = (p.vel === undefined ? 0.5 : p.vel) * this.vol; o.pan = clamp(this.pan + (p.pan || 0), -1, 1); o.prio = 3;
    return V[name](this.eng, this.eng.sfxIn, t, o);
  };

  // ------------------------------------------------------------------ effect definitions
  // def(id, description, nominal length (s), min repeat gap (ms), gain trim, builder)
  // Principles: interface sounds are quiet and short and rotate between takes; world sounds get a little random pitch, level and
  // timing; stingers may add a sampled layer (S.smp — bass drum, gong, cymbal, harp, brass, choir) that only sounds once the
  // instrument samples are loaded, so the synth recipe underneath must stand on its own.
  function def(id, desc, dur, gap, gain, fn) { FX[id] = { id, desc, dur, gap, gain, fn }; ORDER.push(id); }

  // ---- interface
  def('click', 'UI button click (three takes)', 0.09, 20, 0.875, S => {
    const k = S.pick(3), f = [1850, 1720, 1980][k], bp = [3200, 2900, 3600][k];
    S.noise({ dur: 0.012 + 0.003 * k, att: 0.0005, vel: 0.9, bp: [bp, bp, 1.3] });
    S.tone({ f, f1: f * 0.81, dur: 0.045 + (k === 1 ? 0.008 : 0), att: 0.001, vel: 0.5 });
  });
  def('hover', 'Soft hover tick', 0.07, 45, 0.871, S => {
    S.tone({ type: 'triangle', f: 2500, f1: 2750, dur: 0.035, att: 0.004, vel: 0.22 });
  });
  def('confirm', 'Positive two-note confirmation with a harp touch', 0.5, 40, 0.515, S => {
    S.tone({ type: 'triangle', f: 659.3, dur: 0.12, vel: 0.5 });
    S.tone({ type: 'triangle', f: 987.8, at: 0.075, dur: 0.26, vel: 0.5, send: 0.2 });
    S.tone({ f: 1975.5, at: 0.075, dur: 0.32, vel: 0.12, send: 0.25 });
    S.smp('harp', { at: 0.075, f: 987.8, vel: 0.3, dyn: 0.5, send: 0.2 });
  });
  def('cancel', 'Descending cancel', 0.4, 40, 0.531, S => {
    const k = S.pick(2);
    S.tone({ type: 'triangle', f: 493.9 - 30 * k, dur: 0.12, vel: 0.5, lp: [2200, 2200] });
    S.tone({ type: 'triangle', f: 370 - 20 * k, at: 0.075, dur: 0.24, vel: 0.5, lp: [1800, 1800] });
  });
  def('error', 'Buzzy double beep', 0.4, 80, 0.515, S => {
    [0, 0.15].forEach(at => {
      S.tone({ type: 'sawtooth', f: 150, f1: 140, at, dur: 0.11, att: 0.004, vel: 0.5, lp: [900, 700, 1] });
      S.tone({ type: 'square', f: 112, at, dur: 0.11, vel: 0.22, lp: [700, 700] });
    });
  });
  def('toggle', 'Switch toggle (pass rate < 1 for off)', 0.1, 30, 1.136, S => {
    S.noise({ dur: 0.01, vel: 0.7, bp: [2600, 2600, 1.5] });
    S.tone({ type: 'triangle', f: 900, f1: 1350, dur: 0.06, vel: 0.4 });
  });
  def('slider', 'Tiny slider tick (vary rate with value)', 0.05, 25, 0.963, S => {
    S.tone({ type: 'triangle', f: 640, f1: 560, dur: 0.035, att: 0.003, vel: 0.5 });
    S.tone({ f: 1280, dur: 0.02, att: 0.002, vel: 0.12 });
  });
  def('open', 'Panel opening whoosh with a soft thump', 0.4, 60, 1.806, S => {
    const k = S.pick(2);
    S.noise({ kind: 'pink', dur: 0.26, att: 0.02, vel: 0.5, bp: [350 - 60 * k, 2800 + 400 * k, 1.6], env: 'swell', pk: 0.7 });
    S.tone({ type: 'triangle', f: 440, f1: 700, dur: 0.18, att: 0.02, vel: 0.2 });
    S.tone({ f: 90, f1: 60, at: 0.1, dur: 0.14, att: 0.01, vel: 0.1 });
  });
  def('close', 'Panel closing whoosh', 0.4, 60, 1.728, S => {
    const k = S.pick(2);
    S.noise({ kind: 'pink', dur: 0.24, att: 0.01, vel: 0.5, bp: [2800 + 300 * k, 350, 1.6] });
    S.tone({ type: 'triangle', f: 700, f1: 420 - 40 * k, dur: 0.16, att: 0.01, vel: 0.2 });
  });
  def('turn', 'End turn: stamp, rising sweep and ping', 1.0, 200, 1.136, S => {
    S.v('kick', { at: 0, f: 70, f0: 170, dur: 0.32, vel: 0.9 });
    S.noise({ kind: 'pink', at: 0.02, dur: 0.5, att: 0.01, vel: 0.5, bp: [300, 5000, 1.2], env: 'swell', pk: 0.8 });
    S.tone({ type: 'sawtooth', f: 196, f1: 784, at: 0.05, dur: 0.55, att: 0.02, vel: 0.28, lp: [500, 4500, 2], send: 0.2 });
    S.tone({ type: 'triangle', f: 1318.5, at: 0.52, dur: 0.38, vel: 0.35, send: 0.3 });
  });
  def('newturn', 'New turn: a chime in fifths over a low tap (two takes)', 1.1, 200, 0.6, S => {
    const k = S.pick(2), base = k ? 587.3 : 523.3;
    S.smp('bassDrum', { vel: 0.4, dyn: 0.3 });
    S.tone({ f: 62, f1: 46, dur: 0.22, att: 0.004, vel: 0.22 });
    S.v('bell', { f: base, dur: 1.0, vel: 0.75, ratio: 3.5, idx: 1.2, send: 0.3 });
    S.v('bell', { at: 0.09, f: base * 1.5, dur: 1.0, vel: 0.6, ratio: 3.5, idx: 1.2, send: 0.3 });
    S.v('bell', { at: 0.2, f: base * 2, dur: 0.9, vel: 0.33, ratio: 2, idx: 0.8, send: 0.3 });
    S.noise({ kind: 'pink', dur: 0.4, att: 0.05, vel: 0.1, bp: [600, 2400, 1], env: 'swell', pk: 0.5 });
  });
  def('alert', 'Attention double beep', 0.6, 150, 0.459, S => {
    [0, 0.22].forEach(at => {
      S.tone({ type: 'square', f: 880, at, dur: 0.14, vel: 0.32, lp: [2600, 2600] });
      S.tone({ type: 'square', f: 1320, at, dur: 0.14, vel: 0.16, lp: [2600, 2600] });
    });
  });
  def('news', 'GNN ticker blips (two takes)', 0.5, 120, 0.588, S => {
    const k = S.pick(2);
    [[2000, 0], [2400 + 200 * k, 0.065], [2200 - 150 * k, 0.13]].forEach(a => {
      S.tone({ f: a[0], at: a[1], dur: 0.045, att: 0.002, vel: 0.4 });
      S.noise({ at: a[1], dur: 0.008, vel: 0.3, bp: [3800, 3800, 2] });
    });
  });
  def('gnn_ident', 'GNN ident: snare roll into three brass hits and a bright chime', 1.7, 500, 0.9, S => {
    for (let i = 0; i < 8; i++) S.v('snare', { at: i * 0.045, vel: 0.2 + i * 0.07, dur: 0.1 });
    [261.6, 392, 523.3].forEach((f, i) => S.smp('hornStac', { at: 0.38 + i * 0.17, f, vel: 0.8, dyn: 0.85, send: 0.15, fb: 'brass', fbo: { dur: 0.16, att: 0.02, vib: 0, bright: 6 } }));
    S.v('bell', { at: 0.9, f: 1046.5, dur: 1.2, vel: 0.65, ratio: 3.5, idx: 1.3, send: 0.35 });
    S.smp('crash', { at: 0.9, vel: 0.26, dyn: 0.3, send: 0.2 });
  });
  def('vote', 'Single voting ding', 0.5, 80, 0.867, S => {
    S.noise({ dur: 0.008, vel: 0.5, bp: [2800, 2800, 1.5] });
    S.tone({ type: 'triangle', f: 1200, dur: 0.15, vel: 0.4 });
    S.v('bell', { f: 1800, dur: 0.5, vel: 0.5, ratio: 3.2, idx: 1.2, send: 0.2 });
  });
  def('gavel', 'Wooden gavel, two knocks', 0.7, 150, 0.659, S => {
    const hit = (at, vel) => {
      S.tone({ f: 380, f1: 150, at, dur: 0.07, att: 0.001, vel: vel * 0.8 });
      S.noise({ at, dur: 0.025, att: 0.0005, vel: vel, bp: [1300, 1300, 2.2], send: 0.25 });
      S.tone({ type: 'triangle', f: 190, f1: 120, at, dur: 0.12, vel: vel * 0.5, send: 0.2 });
    };
    hit(0, 0.7); hit(0.26, 0.95);
  });
  def('typing', 'Keyboard typing burst', 0.5, 260, 0.864, S => {
    let t = 0;
    for (let i = 0; i < 6; i++) {
      const r = S.rnd(), f = 2200 + r * 2600;
      S.noise({ at: t, dur: 0.014, att: 0.0005, vel: 0.6 + r * 0.3, bp: [f, f, 3] });
      S.tone({ f: 800 + r * 500, f1: 500 + r * 200, at: t, dur: 0.02, att: 0.001, vel: 0.2 });
      t += 0.05 + S.rnd() * 0.07;
    }
  });

  // ---- empire / economy (stingers: the sampled layers sweeten, the synth recipe carries)
  def('tech', 'Research complete: ascending bells, brass chord, harp run and sparkle', 2.2, 400, 0.36, S => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => S.v('bell', { at: i * 0.11, f, dur: 1.4, vel: 0.9, ratio: 3.5, idx: 1.6, send: 0.3 }));
    [261.63, 329.63, 392, 523.25].forEach(f => S.v('brass', { at: 0.5, f, dur: 1.1, att: 0.1, rel: 0.5, vel: 0.9, vib: 7, bright: 4.5, send: 0.3 }));
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => S.smp('harp', { at: 0.42 + i * 0.065, f, vel: 0.55, dyn: 0.7, send: 0.3 }));
    S.v('bell', { at: 0.6, f: 2093, dur: 2.0, vel: 0.7, ratio: 2, idx: 1.0, send: 0.4 });
    S.noise({ at: 0.45, dur: 1.2, att: 0.05, vel: 0.15, hp: [5000, 9000], env: 'swell', pk: 0.3, send: 0.3 });
  });
  def('colonize', 'Colony founded: landing swell, warm chord, a breath of choir, chimes', 2.0, 400, 0.21, S => {
    S.noise({ kind: 'pink', dur: 0.9, att: 0.05, vel: 0.3, lp: [1400, 300, 1], env: 'swell', pk: 0.25 });
    S.tone({ f: 70, f1: 120, dur: 1.2, att: 0.15, vel: 0.35, sus: true, rel: 0.4 });
    S.smp('bassDrum', { at: 0.3, vel: 0.5, dyn: 0.35 });
    [196, 246.9, 293.7].forEach(f => S.v('pad', { at: 0.35, f, dur: 0.9, att: 0.25, rel: 0.7, vel: 1.2, send: 0.3 }));
    S.smp('chorusMen', { at: 0.3, f: 196, dur: 1.2, vel: 1.1, dyn: 0.6, oneShot: false, att: 0.35, rel: 0.7, send: 0.35 });
    S.smp('chorusMen', { at: 0.32, f: 293.7, dur: 1.2, vel: 0.9, dyn: 0.55, oneShot: false, att: 0.4, rel: 0.7, send: 0.35 });
    S.v('chime', { at: 0.75, f: 784, dur: 1.4, vel: 0.7, send: 0.35 });
    S.v('chime', { at: 0.95, f: 1046.5, dur: 1.6, vel: 0.7, send: 0.35 });
  });
  def('construct', 'Construction: hammer clinks, ratchet, servo (two takes)', 1.1, 300, 1.155, S => {
    const k = S.pick(2);
    [0, 0.18, 0.33].forEach((at, i) => S.v('metal', { at, f: 900 + i * 90 + k * 140, dur: 0.18, vel: 0.9 }));
    for (let i = 0; i < 8; i++) S.v('click', { at: 0.5 + i * 0.035, f: 3000 + i * 150, vel: 0.9, dur: 0.01 });
    S.tone({ type: 'sawtooth', f: 300 - 40 * k, f1: 640, at: 0.45, dur: 0.5, att: 0.05, vel: 0.12, lp: [900, 2200, 2] });
  });
  def('shipbuilt', 'Ship completed: hum, clank, ping', 1.4, 300, 1.1, S => {
    S.tone({ type: 'sawtooth', f: 110, f1: 220, dur: 0.6, att: 0.05, vel: 0.25, lp: [600, 2000, 2], send: 0.1 });
    S.v('metal', { at: 0.55, f: 420, dur: 0.5, vel: 0.8, send: 0.15 });
    S.smp('bassDrum', { at: 0.55, vel: 0.35, dyn: 0.3 });
    S.v('bell', { at: 0.62, f: 1318.5, dur: 1.2, vel: 0.8, ratio: 3.5, idx: 1.4, send: 0.3 });
    S.noise({ kind: 'pink', dur: 0.4, att: 0.05, vel: 0.2, bp: [400, 3000, 1], env: 'swell', pk: 0.6 });
  });
  def('treaty', 'Treaty signed: two bells, harp and a warm chord', 1.8, 400, 0.22, S => {
    S.v('bell', { f: 392, dur: 1.4, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.04, f: 587.3, dur: 1.4, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.4, f: 523.25, dur: 1.6, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.4, f: 784, dur: 1.6, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.smp('harp', { at: 0.4, f: 523.25, vel: 1.2, dyn: 0.6, send: 0.3 }); S.smp('harp', { at: 0.47, f: 784, vel: 1.0, dyn: 0.6, send: 0.3 });
    [261.63, 329.63, 392].forEach(f => S.v('pad', { at: 0.4, f, dur: 0.8, att: 0.12, rel: 0.7, vel: 1.1, send: 0.3 }));
    S.smp('chorusWomen', { at: 0.45, f: 523.25, dur: 0.9, vel: 0.9, dyn: 0.5, oneShot: false, att: 0.3, rel: 0.6, send: 0.35 });
  });
  def('war', 'War declared: low brass stab, bass drum, gong, dissonant sting', 1.9, 500, 0.3, S => {
    [87.3, 130.8, 185].forEach(f => S.v('brass', { f, dur: 0.9, att: 0.04, rel: 0.4, vel: 1.1, bright: 5, vib: 5, send: 0.25 }));
    S.smp('lowBrass', { f: 87.3, dur: 0.9, vel: 2.2, dyn: 0.95, oneShot: false, att: 0.03, rel: 0.35, send: 0.2 });
    S.smp('bassDrum', { vel: 2.0, dyn: 0.95 });
    S.smp('gong', { at: 0.04, vel: 0.8, dyn: 0.45, send: 0.3 });
    S.v('timp', { f: 55, dur: 1.6, vel: 1.0, send: 0.2 });
    S.v('timp', { at: 0.36, f: 49, dur: 1.8, vel: 1.0, send: 0.2 });
    S.v('metal', { at: 0.02, f: 233, dur: 1.4, vel: 0.9, send: 0.25 });
    S.noise({ dur: 0.7, att: 0.02, vel: 0.2, lp: [900, 200, 1], env: 'swell', pk: 0.3 });
  });
  def('insult', 'Insult: sliding wah-wah trombone and rimshot', 1.4, 500, 0.45, S => {
    S.tone({ type: 'sawtooth', f: 330, f1: 185, dur: 0.38, att: 0.03, vel: 0.35, lp: [1500, 700, 2], sus: true, rel: 0.05, det2: 6 });
    S.tone({ type: 'sawtooth', f: 262, f1: 131, at: 0.45, dur: 0.55, att: 0.03, vel: 0.35, lp: [1400, 500, 2], sus: true, rel: 0.08, det2: 6 });
    S.v('snare', { at: 1.05, vel: 0.8, send: 0.1 });
    S.v('click', { at: 1.05, f: 1900, q: 3, dur: 0.03, vel: 0.6 });
  });
  def('coins', 'Coins and cash register jingle', 1.0, 150, 0.62, S => {
    for (let i = 0; i < 6; i++) S.v('chime', { at: i * 0.045 + S.rnd() * 0.02, f: 2000 + S.rnd() * 1600, dur: 0.5, vel: 0.7, ratios: [1, 2.4, 4.1], amps: [1, 0.5, 0.25], decs: [1, 0.5, 0.3], send: 0.2 });
    S.v('bell', { at: 0.26, f: 1760, dur: 0.8, vel: 0.6, ratio: 3.8, idx: 0.9, send: 0.25 });
    S.v('bell', { at: 0.34, f: 2349.3, dur: 0.9, vel: 0.6, ratio: 3.8, idx: 0.9, send: 0.25 });
  });

  // ---- fleet / exploration
  def('warp', 'Warp jump: rising sweep and zip (two takes)', 1.5, 300, 0.725, S => {
    const k = S.pick(2);
    S.noise({ dur: 0.95, att: 0.05, vel: 0.5, bp: [300, 6000 - 1200 * k, 3], env: 'swell', pk: 0.9, send: 0.15 });
    S.tone({ type: 'sawtooth', f: 80, f1: 1200 + 300 * k, dur: 0.95, att: 0.05, vel: 0.2, lp: [500, 4000, 2], env: 'swell', pk: 0.9, send: 0.2 });
    S.noise({ at: 0.9, dur: 0.18, att: 0.002, vel: 0.5, hp: [3000, 3000] });
    S.tone({ f: 2600 - 400 * k, f1: 300, at: 0.9, dur: 0.3, att: 0.002, vel: 0.3, send: 0.3 });
  });
  def('arrive', 'Arrival: decelerating sweep, thunk and chime', 1.4, 300, 0.838, S => {
    const k = S.pick(2);
    S.noise({ dur: 0.7, att: 0.02, vel: 0.45, bp: [4500 - 800 * k, 400, 2.5], send: 0.15 });
    S.tone({ type: 'sawtooth', f: 1200, f1: 90, dur: 0.7, att: 0.02, vel: 0.2, lp: [4000, 500, 2], send: 0.15 });
    S.tone({ f: 90, f1: 48, at: 0.62, dur: 0.3, att: 0.004, vel: 0.5 });
    S.v('bell', { at: 0.7, f: k ? 987.8 : 880, dur: 1.1, vel: 0.6, ratio: 3, idx: 1.2, send: 0.3 });
  });
  def('scan', 'Sonar-style scanner ping with echoes', 1.5, 250, 1.513, S => {
    S.tone({ f: 1400, f1: 1380, dur: 0.35, att: 0.004, vel: 0.5, send: 0.35 });
    S.tone({ f: 1400, at: 0.26, dur: 0.3, vel: 0.2, send: 0.35 });
    S.tone({ f: 1400, at: 0.52, dur: 0.3, vel: 0.1, send: 0.35 });
    S.noise({ dur: 0.45, att: 0.05, vel: 0.12, bp: [800, 3000, 2], env: 'swell', pk: 0.6 });
    S.tone({ f: 2100, at: 0.56, dur: 0.1, vel: 0.2, send: 0.2 });
  });
  def('discover', 'New star explored: a quiet ping, glass chimes and a harp note', 1.7, 300, 0.55, S => {
    S.tone({ f: 1400, f1: 1380, dur: 0.3, att: 0.004, vel: 0.35, send: 0.35 });
    S.tone({ f: 1400, at: 0.22, dur: 0.25, vel: 0.14, send: 0.35 });
    S.noise({ dur: 0.5, att: 0.05, vel: 0.1, bp: [800, 3000, 2], env: 'swell', pk: 0.6 });
    S.v('chime', { at: 0.35, f: 1568, dur: 1.4, vel: 0.5, send: 0.35 });
    S.v('chime', { at: 0.5, f: 2093, dur: 1.5, vel: 0.4, send: 0.35 });
    S.smp('harp', { at: 0.35, f: 783.99, vel: 0.9, dyn: 0.6, send: 0.3 });
  });
  def('contact', 'First contact: hologram hum, rising sweep, a soft gong and a glass bell', 2.3, 500, 0.75, S => {
    S.tone({ type: 'sawtooth', f: 110, f1: 165, dur: 1.2, att: 0.2, vel: 0.18, lp: [400, 1600, 3], sus: true, rel: 0.4, am: [8, 0.35], det2: 7, send: 0.3 });
    S.noise({ dur: 1.0, att: 0.1, vel: 0.14, bp: [300, 4000, 2], env: 'swell', pk: 0.8, send: 0.2 });
    S.smp('gong', { at: 0.5, vel: 0.7, dyn: 0.35, send: 0.3 });
    S.v('bell', { at: 0.9, f: 880, dur: 1.6, vel: 0.45, ratio: 2, idx: 1.0, send: 0.4 });
    S.v('bell', { at: 1.15, f: 1318.5, dur: 1.4, vel: 0.3, ratio: 2, idx: 1.0, send: 0.4 });
  });

  // ---- weapons and combat (one voice per weapon family, see js/ui/combat-fx.js; every frequent hit rotates takes)
  def('laser', 'Laser bolt (three takes)', 0.3, 40, 1.259, S => {
    const k = S.pick(3), f0 = [2600, 2200, 3000][k];
    S.tone({ type: 'sawtooth', f: f0, f1: f0 * 0.1, dur: 0.2 - 0.02 * k, att: 0.001, vel: 0.5, bp: [3500, 900, 1.2], send: 0.1 });
    S.tone({ f: 1200 - 100 * k, f1: 200, dur: 0.16, att: 0.001, vel: 0.3 });
    S.noise({ dur: 0.02, att: 0.0005, vel: 0.3, hp: [4000, 4000] });
  });
  def('gatling', 'Rapid-fire cannon: a burst of short cracks', 0.5, 60, 1.0, S => {
    const n = 5 + S.pick(3);
    for (let i = 0; i < n; i++) {
      const at = i * 0.055, r = S.rnd();
      S.noise({ at, dur: 0.02, att: 0.0005, vel: 0.8, bp: [1800 + r * 500, 1800, 1.1] });
      S.tone({ f: 900 - r * 200, f1: 300, at, dur: 0.04, att: 0.001, vel: 0.35 });
    }
    S.noise({ dur: n * 0.055, att: 0.01, vel: 0.1, hp: [5000, 5000], sus: true, rel: 0.1 });
  });
  def('mass', 'Mass driver: kinetic thump and a short whistle', 0.5, 60, 1.0, S => {
    const k = S.pick(2);
    S.tone({ f: 160 - 20 * k, f1: 60, dur: 0.18, att: 0.001, vel: 0.7 });
    S.noise({ dur: 0.08, att: 0.0005, vel: 0.6, bp: [1200, 600, 1] });
    S.tone({ f: 3200, f1: 1400 + 300 * k, dur: 0.22, att: 0.003, vel: 0.1, send: 0.15 });
  });
  def('beam_heavy', 'Heavy neutron / blast beam', 1.2, 120, 0.47, S => {
    S.tone({ type: 'sawtooth', f: 110, f1: 130, dur: 0.85, att: 0.08, vel: 0.35, lp: [400, 2600, 3], sus: true, rel: 0.25, det2: 9, am: [38, 0.6], send: 0.15 });
    S.tone({ type: 'square', f: 55, dur: 0.85, att: 0.08, vel: 0.25, lp: [300, 300], sus: true, rel: 0.25 });
    S.noise({ dur: 0.85, att: 0.08, vel: 0.2, hp: [4500, 4500], sus: true, rel: 0.25, am: [31, 0.5] });
    S.noise({ at: 0.8, dur: 0.3, att: 0.002, vel: 0.3, bp: [2500, 800, 2] });
  });
  def('beam_phasor', 'Phasor / ion beam: electric chirp with a shimmering tail', 0.6, 60, 0.9, S => {
    const k = S.pick(2);
    S.tone({ type: 'sawtooth', f: 3500 - 500 * k, f1: 1600, dur: 0.3, att: 0.002, vel: 0.35, am: [45 + 10 * k, 0.7], lp: [6000, 2500, 1], send: 0.2 });
    S.tone({ f: 1200, f1: 900, dur: 0.4, att: 0.005, vel: 0.2, fm: { r: 3.1, idx: 2.5, dec: 0.7 }, send: 0.25 });
    S.noise({ dur: 0.35, att: 0.002, vel: 0.25, bp: [2500, 7000, 4], am: [60, 0.6], send: 0.15 });
  });
  def('beam_plasma', 'Plasma / fusion beam: wet sizzle over a low thump', 0.9, 90, 0.75, S => {
    const k = S.pick(2);
    S.tone({ f: 300 - 40 * k, f1: 110, dur: 0.45, att: 0.004, vel: 0.5 });
    S.noise({ dur: 0.6, att: 0.01, vel: 0.5, bp: [1500, 5500, 1.2], env: 'swell', pk: 0.2, send: 0.15 });
    S.tone({ type: 'sawtooth', f: 440, f1: 220, dur: 0.5, att: 0.01, vel: 0.22, det2: 11, lp: [3000, 900, 2], am: [30, 0.5], send: 0.15 });
    S.noise({ at: 0.05, dur: 0.5, att: 0.01, vel: 0.15, hp: [6000, 6000], am: [90, 0.8] });
  });
  def('beam_disruptor', 'Disruptor / stellar converter: tearing beam with a deep core', 1.3, 150, 0.6, S => {
    S.tone({ type: 'sawtooth', f: 70, f1: 95, dur: 0.9, att: 0.05, vel: 0.4, lp: [300, 3200, 4], sus: true, rel: 0.3, det2: 14, am: [27, 0.7], send: 0.15 });
    S.noise({ dur: 0.9, att: 0.05, vel: 0.3, bp: [900, 6000, 1.5], sus: true, rel: 0.3, am: [19, 0.8], send: 0.15 });
    S.tone({ f: 1800, f1: 600, dur: 0.9, att: 0.05, vel: 0.15, fm: { r: 1.41, idx: 4, dec: 0.9 }, send: 0.25 });
    S.noise({ at: 0.85, dur: 0.3, att: 0.002, vel: 0.35, bp: [2000, 600, 2] });
  });
  def('missile_launch', 'Missile launch: ignition thump and rising whoosh (two takes)', 1.3, 100, 1.075, S => {
    const k = S.pick(2);
    S.tone({ f: 120, f1: 48, dur: 0.3, att: 0.003, vel: 0.7 });
    S.noise({ kind: 'pink', at: 0.03, dur: 0.85, att: 0.04, vel: 0.5, bp: [500, 2600 + 500 * k, 0.8], env: 'swell', pk: 0.4, send: 0.15 });
    S.noise({ at: 0.05, dur: 0.8, att: 0.05, vel: 0.12, hp: [3000, 3000] });
    S.tone({ type: 'sawtooth', f: 90, f1: 300 + 60 * k, dur: 0.8, att: 0.05, vel: 0.15, lp: [800, 800] });
  });
  def('missile_hit', 'Missile impact: crack and boom (two takes)', 1.4, 80, 1.427, S => {
    const k = S.pick(2);
    S.noise({ dur: 0.07, att: 0.0008, vel: 0.9, hp: [2500 - 500 * k, 2500] });
    S.v('boom', { f: 62 - 8 * k, dur: 1.1, vel: 0.9, send: 0.2 });
    S.v('metal', { at: 0.05, f: 600 + 120 * k, dur: 0.3, vel: 0.5 });
  });
  def('explosion_small', 'Small explosion (three takes)', 1.0, 80, 1.093, S => {
    const k = S.pick(3);
    S.noise({ dur: 0.55 - 0.08 * k, att: 0.002, vel: 0.9, lp: [3200 - 400 * k, 200, 1], send: 0.2 });
    S.tone({ f: [95, 80, 110][k], f1: 40, dur: 0.4, att: 0.002, vel: 0.8 });
    S.noise({ at: 0.03, dur: 0.14, att: 0.001, vel: 0.35, hp: [3000, 3000] });
  });
  def('explosion_big', 'Big explosion: bass drum, rumble and debris', 3.2, 150, 0.79, S => {
    S.v('boom', { f: 46, dur: 2.9, vel: 1.0, send: 0.3 });
    S.smp('bassDrum', { vel: 1.3, dyn: 0.95 });
    if (S.rnd() < 0.35) S.smp('gong', { at: 0.05, vel: 0.45, dyn: 0.4, send: 0.3 });
    S.noise({ dur: 1.9, att: 0.003, vel: 1.0, lp: [1900, 80, 1], send: 0.3 });
    S.noise({ kind: 'brown', dur: 2.5, att: 0.01, vel: 0.9, lp: [150, 150] });
    for (let i = 0; i < 9; i++) S.noise({ at: 0.15 + S.rnd() * 1.5, dur: 0.05 + S.rnd() * 0.06, att: 0.0008, vel: 0.2 + S.rnd() * 0.2, hp: [1800 + S.rnd() * 2000, 1800], send: 0.2 });
  });
  def('shield_hit', 'Shield impact: electric sizzle (three takes)', 0.6, 60, 2.018, S => {
    const k = S.pick(3), f = [1800, 2300, 1500][k];
    S.noise({ dur: 0.25, att: 0.002, vel: 0.6, bp: [3000, 8000 - 1000 * k, 5], send: 0.15 });
    S.tone({ type: 'sawtooth', f, f1: f / 3, dur: 0.3, att: 0.002, vel: 0.3, fm: { r: 7, idx: 3, dec: 0.8 }, lp: [6000, 2000, 1], send: 0.2 });
    S.tone({ f: 3500 - 300 * k, f1: 2400, dur: 0.35, att: 0.004, vel: 0.15, am: [45 + 8 * k, 0.8], send: 0.2 });
  });
  def('armor_hit', 'Armor hit: metallic clang and thud (three takes)', 0.9, 60, 1.094, S => {
    const k = S.pick(3);
    S.v('metal', { f: [650, 520, 800][k], dur: 0.55, vel: 1.0, send: 0.15 });
    S.tone({ f: 140 - 15 * k, f1: 70, dur: 0.16, att: 0.002, vel: 0.6 });
    S.noise({ dur: 0.02, att: 0.0005, vel: 0.5, bp: [2500, 2500, 1.5] });
  });
  def('hull_breach', 'Hull breach: decompression hiss, groan and alarm', 1.6, 300, 0.981, S => {
    S.noise({ dur: 1.0, att: 0.01, vel: 0.5, hp: [800, 800], bp: [3200, 1000, 1.2], send: 0.1 });
    S.tone({ type: 'sawtooth', f: 70, f1: 44, dur: 0.9, att: 0.05, vel: 0.35, lp: [300, 200, 2] });
    [0.5, 0.7, 0.9].forEach(at => S.tone({ type: 'square', f: 1000, at, dur: 0.1, vel: 0.14, lp: [2200, 2200] }));
  });
  def('bomb', 'Orbital bomb: falling whistle then a deep detonation', 2.4, 200, 0.882, S => {
    S.tone({ f: 2200, f1: 500, dur: 0.8, att: 0.05, vel: 0.2, am: [6, 0.2] });
    S.noise({ dur: 0.7, att: 0.05, vel: 0.12, bp: [4000, 1200, 3] });
    S.v('boom', { at: 0.8, f: 50, dur: 1.5, vel: 1.0, send: 0.3 });
    S.smp('bassDrum', { at: 0.8, vel: 1.2, dyn: 0.9 });
    S.noise({ at: 0.8, dur: 0.9, att: 0.002, vel: 0.8, lp: [2200, 120, 1], send: 0.2 });
  });
  def('deathray', 'Death ray: ominous swarm, rising whine and crackle', 3.0, 400, 0.62, S => {
    [55, 55.8, 82.4, 110.5].forEach((f, i) => S.tone({ type: 'sawtooth', f, f1: f * 1.05, dur: 1.9, att: 0.4, vel: 0.2, lp: [200, 3200, 5], sus: true, rel: 0.3, am: [22, 0.5], send: 0.15 }));
    S.tone({ f: 200, f1: 1600, dur: 1.7, att: 0.2, vel: 0.18, env: 'swell', pk: 0.95, send: 0.2 });
    S.noise({ dur: 1.9, att: 0.3, vel: 0.2, bp: [5000, 5000, 3], am: [28, 1], sus: true, rel: 0.2 });
    S.v('boom', { at: 1.7, f: 44, dur: 1.4, vel: 0.8, send: 0.3 });
    S.smp('bassDrum', { at: 1.7, vel: 1.2, dyn: 0.9 });
  });
  def('planet_hit', 'Planet struck: heavy impact and rolling rumble', 3.2, 300, 0.8, S => {
    S.v('boom', { f: 40, dur: 2.9, vel: 1.0, send: 0.4 });
    S.smp('bassDrum', { vel: 1.3, dyn: 0.95 });
    S.noise({ kind: 'brown', dur: 2.6, att: 0.01, vel: 0.9, lp: [140, 140], send: 0.2 });
    S.noise({ dur: 0.1, att: 0.001, vel: 0.5, hp: [1800, 1800] });
    for (let i = 0; i < 6; i++) S.noise({ at: 0.2 + S.rnd() * 1.4, dur: 0.07, att: 0.001, vel: 0.2, bp: [900 + S.rnd() * 900, 900, 2], send: 0.2 });
  });
  def('ground_fire', 'Small-arms fire burst with a ricochet (three takes)', 1.0, 150, 0.725, S => {
    const n = 3 + S.pick(3);
    for (let i = 0; i < n; i++) {
      const at = i * 0.12 + S.rnd() * 0.02;
      S.noise({ at, dur: 0.09, att: 0.0005, vel: 0.8, bp: [1800, 1800, 0.7], send: 0.1 });
      S.noise({ at, dur: 0.05, att: 0.0005, vel: 0.5, lp: [600, 600] });
      S.tone({ f: 160, f1: 80, at, dur: 0.06, att: 0.0008, vel: 0.5 });
    }
    if (S.rnd() < 0.7) S.tone({ f: 3000, f1: 1200, at: 0.5, dur: 0.22, att: 0.003, vel: 0.1, send: 0.2 });
  });
  def('troops_land', 'Troops land: descending drop-ship, thuds and a horn blip', 2.0, 300, 0.87, S => {
    S.noise({ kind: 'pink', dur: 0.9, att: 0.1, vel: 0.35, bp: [1500, 400, 1], env: 'swell', pk: 0.8 });
    S.tone({ type: 'sawtooth', f: 60, f1: 50, dur: 1.0, att: 0.1, vel: 0.3, lp: [300, 300] });
    [0.9, 1.05, 1.2].forEach((at, i) => { S.v('metal', { at, f: 300, dur: 0.2, vel: 0.5 }); S.v('tom', { at, f: 90, dur: 0.25, vel: 0.9 }); S.smp('bassDrum', { at, vel: 0.6, dyn: 0.5 }); });
    S.v('brass', { at: 1.35, f: 261.6, dur: 0.3, vel: 0.8, att: 0.03, send: 0.2 });
  });
  def('planet_destroyed', 'Planet destroyed: enormous boom, falling sweep, gong and cracking', 4.8, 800, 0.52, S => {
    S.v('boom', { f: 36, dur: 4.0, vel: 1.0, send: 0.45 });
    S.smp('bassDrum', { vel: 1.4, dyn: 1.0 });
    S.smp('gong', { at: 0.1, vel: 0.9, dyn: 0.9, send: 0.4 });
    S.noise({ dur: 3.0, att: 0.004, vel: 1.0, lp: [2600, 60, 1], send: 0.35 });
    S.tone({ type: 'sawtooth', f: 900, f1: 30, dur: 2.6, att: 0.01, vel: 0.3, lp: [1800, 100, 2], send: 0.3 });
    S.noise({ kind: 'brown', dur: 3.6, att: 0.01, vel: 1.0, lp: [110, 110] });
    for (let i = 0; i < 14; i++) S.noise({ at: 0.1 + S.rnd() * 2.4, dur: 0.05 + S.rnd() * 0.1, att: 0.001, vel: 0.2 + S.rnd() * 0.2, hp: [1500 + S.rnd() * 2500, 1500], send: 0.3 });
  });
  def('nova', 'Star goes nova: rising whine, white swell, then a huge blast with cymbal and gong', 5.2, 800, 0.6, S => {
    S.tone({ type: 'sawtooth', f: 120, f1: 3000, dur: 1.7, att: 0.1, vel: 0.22, lp: [400, 6000, 2], env: 'swell', pk: 0.95, send: 0.3 });
    S.noise({ dur: 1.8, att: 0.1, vel: 0.5, bp: [200, 9000, 1], env: 'swell', pk: 0.95, send: 0.25 });
    S.v('boom', { at: 1.8, f: 38, dur: 3.0, vel: 1.0, send: 0.4 });
    S.v('crash', { at: 1.8, dur: 3.0, vel: 0.9, send: 0.4 });
    S.smp('bassDrum', { at: 1.8, vel: 1.4, dyn: 1.0 }); S.smp('crash', { at: 1.8, vel: 0.9, dyn: 0.9, send: 0.3 }); S.smp('gong', { at: 1.85, vel: 0.9, dyn: 0.9, send: 0.4 });
    S.noise({ at: 1.8, dur: 2.2, att: 0.002, vel: 0.9, lp: [3000, 80, 1], send: 0.3 });
  });

  // ------------------------------------------------------------------ public API
  SFX.list = () => ORDER.map(id => ({ id, desc: FX[id].desc, dur: FX[id].dur }));
  SFX.has = id => !!FX[id];
  SFX.info = id => (FX[id] ? { id, desc: FX[id].desc, dur: FX[id].dur, gap: FX[id].gap, gain: FX[id].gain } : null);

  // music duck in dB while the effect plays (stingers and big combat sounds only; interface and frequent weapon sounds never duck)
  const DUCK = {
    tech: 4, colonize: 4, treaty: 4, war: 4, insult: 3, coins: 2, newturn: 2.5, shipbuilt: 3, arrive: 2, warp: 2, turn: 2, gavel: 2, gnn_ident: 3, discover: 2, contact: 3,
    explosion_big: 4, planet_hit: 4, planet_destroyed: 5, nova: 5, deathray: 4, bomb: 4, beam_heavy: 3, beam_disruptor: 3, beam_plasma: 2, missile_hit: 2.5, troops_land: 3, hull_breach: 3,
  };
  SFX.duck = DUCK;

  const last = Object.create(null);
  SFX.play = function (id, o) {
    try {
      const fx = FX[id];
      if (!fx || !A.isReady() || A.settings.muted || A.settings.sfx <= 0) return false;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (last[id] !== undefined && now - last[id] < fx.gap) return false;
      last[id] = now;
      o = o || {};
      const eng = A.engine;
      eng.sweep();
      fx.fn(new Sess(eng, { id, t0: eng.ctx.currentTime + 0.006, vol: o.vol, pan: o.pan, rate: o.rate, gain: fx.gain }));
      const dk = DUCK[id];
      if (dk && eng.duckMusic && A.settings.music > 0) eng.duckMusic(dk * clamp(o.vol === undefined ? 1 : o.vol, 0, 1), Math.min(2, fx.dur * 0.7 / (o.rate > 0 ? clamp(o.rate, 0.25, 4) : 1)));
      return true;
    } catch (e) {
      if (!warned[id]) { warned[id] = 1; console.warn('[sfx] ' + id + ' failed', e); }
      return false;
    }
  };

  A.Sfx = SFX;                                    // alias (case variant)
  // A.play(name, opts): convenience dispatcher -> a sound effect if the name is one, otherwise a music track / mood
  A.play = function (name, o) {
    if (FX[name]) return SFX.play(name, o);
    return A.Music && A.Music.setMood ? A.Music.setMood(name, o) : false;
  };

  // Offline render (tests): deterministic, no random pitch variation. Resolves with an AudioBuffer.
  SFX.render = function (id, o) {
    o = o || {};
    const fx = FX[id];
    if (!fx) return Promise.reject(new Error('unknown sfx ' + id));
    return A.offline(fx.dur + 1.6, function (eng) {
      fx.fn(new Sess(eng, { id, t0: 0.03, vol: o.vol, pan: o.pan, rate: o.rate, gain: o.raw ? 1 : fx.gain, vary: 0 }));
    }, { sampleRate: o.sampleRate || 44100 });
  };
})(window.MOO);
