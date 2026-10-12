// Master of Orion — Reborn · synthesized sound effects.
// MOO.Audio.SFX.play(id, {vol, pan, rate}) — silently does nothing until audio is unlocked; never throws.
// Every effect is built from a few primitives (tone / noise / voice) that scale pitch + speed with `rate`,
// get a tiny random pitch variation per call, start from silence and end on an exponential decay (click-free).
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
  function Sess(eng, o) {
    this.eng = eng; this.t0 = o.t0; this.o = o;
    const vary = o.vary === undefined ? 0.04 : o.vary;
    this.R = (o.rate > 0 ? clamp(o.rate, 0.25, 4) : 1) * (1 + (eng.rand() - 0.5) * 2 * vary);
    this.vol = (o.vol === undefined ? 1 : clamp(o.vol, 0, 2)) * (o.gain === undefined ? 1 : o.gain);
    this.pan = clamp(o.pan || 0, -1, 1);
  }
  Sess.prototype.rnd = function () { return this.eng.rand(); };

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
  function def(id, desc, dur, gap, gain, fn) { FX[id] = { id, desc, dur, gap, gain, fn }; ORDER.push(id); }

  // ---- interface
  def('click', 'UI button click', 0.09, 20, 0.875, S => {
    S.noise({ dur: 0.014, att: 0.0005, vel: 0.9, bp: [3200, 3200, 1.3] });
    S.tone({ f: 1850, f1: 1500, dur: 0.05, att: 0.001, vel: 0.5 });
  });
  def('hover', 'Soft hover tick', 0.07, 45, 0.871, S => {
    S.tone({ type: 'triangle', f: 2500, f1: 2750, dur: 0.035, att: 0.004, vel: 0.22 });
  });
  def('confirm', 'Positive two-note confirmation', 0.5, 40, 0.515, S => {
    S.tone({ type: 'triangle', f: 659.3, dur: 0.12, vel: 0.5 });
    S.tone({ type: 'triangle', f: 987.8, at: 0.075, dur: 0.26, vel: 0.5, send: 0.2 });
    S.tone({ f: 1975.5, at: 0.075, dur: 0.32, vel: 0.12, send: 0.25 });
  });
  def('cancel', 'Descending cancel', 0.4, 40, 0.531, S => {
    S.tone({ type: 'triangle', f: 493.9, dur: 0.12, vel: 0.5, lp: [2200, 2200] });
    S.tone({ type: 'triangle', f: 370, at: 0.075, dur: 0.24, vel: 0.5, lp: [1800, 1800] });
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
  def('open', 'Panel opening whoosh', 0.4, 60, 1.806, S => {
    S.noise({ kind: 'pink', dur: 0.26, att: 0.02, vel: 0.5, bp: [350, 2800, 1.6], env: 'swell', pk: 0.7 });
    S.tone({ type: 'triangle', f: 440, f1: 700, dur: 0.18, att: 0.02, vel: 0.2 });
  });
  def('close', 'Panel closing whoosh', 0.4, 60, 1.728, S => {
    S.noise({ kind: 'pink', dur: 0.24, att: 0.01, vel: 0.5, bp: [2800, 350, 1.6] });
    S.tone({ type: 'triangle', f: 700, f1: 420, dur: 0.16, att: 0.01, vel: 0.2 });
  });
  def('turn', 'End turn: stamp, rising sweep and ping', 1.0, 200, 1.136, S => {
    S.v('kick', { at: 0, f: 70, f0: 170, dur: 0.32, vel: 0.9 });
    S.noise({ kind: 'pink', at: 0.02, dur: 0.5, att: 0.01, vel: 0.5, bp: [300, 5000, 1.2], env: 'swell', pk: 0.8 });
    S.tone({ type: 'sawtooth', f: 196, f1: 784, at: 0.05, dur: 0.55, att: 0.02, vel: 0.28, lp: [500, 4500, 2], send: 0.2 });
    S.tone({ type: 'triangle', f: 1318.5, at: 0.52, dur: 0.38, vel: 0.35, send: 0.3 });
  });
  def('newturn', 'New turn: bright bell arpeggio', 1.3, 200, 0.738, S => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => S.v('bell', { at: i * 0.1, f, dur: 1.0, vel: 0.9, ratio: 3.5, idx: 1.5, send: 0.25 }));
    S.v('bell', { at: 0.42, f: 2093, dur: 0.9, vel: 0.5, ratio: 2, idx: 0.8, send: 0.3 });
  });
  def('alert', 'Attention double beep', 0.6, 150, 0.459, S => {
    [0, 0.22].forEach(at => {
      S.tone({ type: 'square', f: 880, at, dur: 0.14, vel: 0.32, lp: [2600, 2600] });
      S.tone({ type: 'square', f: 1320, at, dur: 0.14, vel: 0.16, lp: [2600, 2600] });
    });
  });
  def('news', 'GNN ticker blips', 0.5, 120, 0.588, S => {
    [[2000, 0], [2400, 0.065], [2200, 0.13]].forEach(a => {
      S.tone({ f: a[0], at: a[1], dur: 0.045, att: 0.002, vel: 0.4 });
      S.noise({ at: a[1], dur: 0.008, vel: 0.3, bp: [3800, 3800, 2] });
    });
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
  def('typing', 'Keyboard typing burst', 1.0, 150, 0.864, S => {
    let t = 0;
    for (let i = 0; i < 9; i++) {
      const r = S.rnd(), f = 2200 + r * 2600;
      S.noise({ at: t, dur: 0.014, att: 0.0005, vel: 0.6 + r * 0.3, bp: [f, f, 3] });
      S.tone({ f: 800 + r * 500, f1: 500 + r * 200, at: t, dur: 0.02, att: 0.001, vel: 0.2 });
      t += 0.05 + S.rnd() * 0.07;
    }
  });

  // ---- empire / economy
  def('tech', 'Research complete: ascending bells, brass chord and sparkle', 2.2, 400, 0.567, S => {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => S.v('bell', { at: i * 0.11, f, dur: 1.4, vel: 0.9, ratio: 3.5, idx: 1.6, send: 0.3 }));
    [261.63, 329.63, 392, 523.25].forEach(f => S.v('brass', { at: 0.5, f, dur: 1.1, att: 0.1, rel: 0.5, vel: 0.9, vib: 7, bright: 4.5, send: 0.3 }));
    S.v('bell', { at: 0.6, f: 2093, dur: 2.0, vel: 0.7, ratio: 2, idx: 1.0, send: 0.4 });
    S.noise({ at: 0.45, dur: 1.2, att: 0.05, vel: 0.15, hp: [5000, 9000], env: 'swell', pk: 0.3, send: 0.3 });
  });
  def('colonize', 'Colony founded: landing swell, warm chord, chimes', 2.0, 400, 0.522, S => {
    S.noise({ kind: 'pink', dur: 0.9, att: 0.05, vel: 0.3, lp: [1400, 300, 1], env: 'swell', pk: 0.25 });
    S.tone({ f: 70, f1: 120, dur: 1.2, att: 0.15, vel: 0.35, sus: true, rel: 0.4 });
    [196, 246.9, 293.7].forEach(f => S.v('pad', { at: 0.35, f, dur: 0.9, att: 0.25, rel: 0.7, vel: 1.2, send: 0.3 }));
    S.v('chime', { at: 0.75, f: 784, dur: 1.4, vel: 0.7, send: 0.35 });
    S.v('chime', { at: 0.95, f: 1046.5, dur: 1.6, vel: 0.7, send: 0.35 });
  });
  def('construct', 'Construction: hammer clinks, ratchet, servo', 1.1, 300, 1.155, S => {
    [0, 0.18, 0.33].forEach((at, i) => S.v('metal', { at, f: 900 + i * 90, dur: 0.18, vel: 0.9 }));
    for (let i = 0; i < 8; i++) S.v('click', { at: 0.5 + i * 0.035, f: 3000 + i * 150, vel: 0.9, dur: 0.01 });
    S.tone({ type: 'sawtooth', f: 300, f1: 640, at: 0.45, dur: 0.5, att: 0.05, vel: 0.12, lp: [900, 2200, 2] });
  });
  def('shipbuilt', 'Ship completed: hum, clank, ping', 1.4, 300, 1.168, S => {
    S.tone({ type: 'sawtooth', f: 110, f1: 220, dur: 0.6, att: 0.05, vel: 0.25, lp: [600, 2000, 2], send: 0.1 });
    S.v('metal', { at: 0.55, f: 420, dur: 0.5, vel: 0.8, send: 0.15 });
    S.v('bell', { at: 0.62, f: 1318.5, dur: 1.2, vel: 0.8, ratio: 3.5, idx: 1.4, send: 0.3 });
    S.noise({ kind: 'pink', dur: 0.4, att: 0.05, vel: 0.2, bp: [400, 3000, 1], env: 'swell', pk: 0.6 });
  });
  def('treaty', 'Treaty signed: two bells and a warm chord', 1.8, 400, 0.54, S => {
    S.v('bell', { f: 392, dur: 1.4, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.04, f: 587.3, dur: 1.4, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.4, f: 523.25, dur: 1.6, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    S.v('bell', { at: 0.4, f: 784, dur: 1.6, vel: 0.9, ratio: 2, idx: 1.0, send: 0.3 });
    [261.63, 329.63, 392].forEach(f => S.v('pad', { at: 0.4, f, dur: 0.8, att: 0.12, rel: 0.7, vel: 1.1, send: 0.3 }));
  });
  def('war', 'War declared: low brass stab, timpani, dissonant sting', 1.9, 500, 0.558, S => {
    [87.3, 130.8, 185].forEach(f => S.v('brass', { f, dur: 0.9, att: 0.04, rel: 0.4, vel: 1.1, bright: 5, vib: 5, send: 0.25 }));
    S.v('timp', { f: 55, dur: 1.6, vel: 1.0, send: 0.2 });
    S.v('timp', { at: 0.36, f: 49, dur: 1.8, vel: 1.0, send: 0.2 });
    S.v('metal', { at: 0.02, f: 233, dur: 1.4, vel: 0.9, send: 0.25 });
    S.noise({ dur: 0.7, att: 0.02, vel: 0.2, lp: [900, 200, 1], env: 'swell', pk: 0.3 });
  });
  def('insult', 'Insult: sliding wah-wah trombone and rimshot', 1.4, 500, 0.635, S => {
    S.tone({ type: 'sawtooth', f: 330, f1: 185, dur: 0.38, att: 0.03, vel: 0.35, lp: [1500, 700, 2], sus: true, rel: 0.05, det2: 6 });
    S.tone({ type: 'sawtooth', f: 262, f1: 131, at: 0.45, dur: 0.55, att: 0.03, vel: 0.35, lp: [1400, 500, 2], sus: true, rel: 0.08, det2: 6 });
    S.v('snare', { at: 1.05, vel: 0.8, send: 0.1 });
    S.v('click', { at: 1.05, f: 1900, q: 3, dur: 0.03, vel: 0.6 });
  });
  def('coins', 'Coins and cash register jingle', 1.0, 150, 0.82, S => {
    for (let i = 0; i < 6; i++) S.v('chime', { at: i * 0.045 + S.rnd() * 0.02, f: 2000 + S.rnd() * 1600, dur: 0.5, vel: 0.7, ratios: [1, 2.4, 4.1], amps: [1, 0.5, 0.25], decs: [1, 0.5, 0.3], send: 0.2 });
    S.v('bell', { at: 0.26, f: 1760, dur: 0.8, vel: 0.6, ratio: 3.8, idx: 0.9, send: 0.25 });
    S.v('bell', { at: 0.34, f: 2349.3, dur: 0.9, vel: 0.6, ratio: 3.8, idx: 0.9, send: 0.25 });
  });

  // ---- fleet / navigation
  def('warp', 'Warp jump: rising sweep and zip', 1.5, 300, 0.725, S => {
    S.noise({ dur: 0.95, att: 0.05, vel: 0.5, bp: [300, 6000, 3], env: 'swell', pk: 0.9, send: 0.15 });
    S.tone({ type: 'sawtooth', f: 80, f1: 1200, dur: 0.95, att: 0.05, vel: 0.2, lp: [500, 4000, 2], env: 'swell', pk: 0.9, send: 0.2 });
    S.noise({ at: 0.9, dur: 0.18, att: 0.002, vel: 0.5, hp: [3000, 3000] });
    S.tone({ f: 2600, f1: 300, at: 0.9, dur: 0.3, att: 0.002, vel: 0.3, send: 0.3 });
  });
  def('arrive', 'Arrival: decelerating sweep, thunk and chime', 1.4, 300, 0.838, S => {
    S.noise({ dur: 0.7, att: 0.02, vel: 0.45, bp: [4500, 400, 2.5], send: 0.15 });
    S.tone({ type: 'sawtooth', f: 1200, f1: 90, dur: 0.7, att: 0.02, vel: 0.2, lp: [4000, 500, 2], send: 0.15 });
    S.tone({ f: 90, f1: 48, at: 0.62, dur: 0.3, att: 0.004, vel: 0.5 });
    S.v('bell', { at: 0.7, f: 880, dur: 1.1, vel: 0.6, ratio: 3, idx: 1.2, send: 0.3 });
  });
  def('scan', 'Sonar-style scanner ping with echoes', 1.5, 250, 1.513, S => {
    S.tone({ f: 1400, f1: 1380, dur: 0.35, att: 0.004, vel: 0.5, send: 0.35 });
    S.tone({ f: 1400, at: 0.26, dur: 0.3, vel: 0.2, send: 0.35 });
    S.tone({ f: 1400, at: 0.52, dur: 0.3, vel: 0.1, send: 0.35 });
    S.noise({ dur: 0.45, att: 0.05, vel: 0.12, bp: [800, 3000, 2], env: 'swell', pk: 0.6 });
    S.tone({ f: 2100, at: 0.56, dur: 0.1, vel: 0.2, send: 0.2 });
  });

  // ---- weapons and combat
  def('laser', 'Laser bolt', 0.3, 40, 1.259, S => {
    S.tone({ type: 'sawtooth', f: 2600, f1: 260, dur: 0.2, att: 0.001, vel: 0.5, bp: [3500, 900, 1.2], send: 0.1 });
    S.tone({ f: 1200, f1: 200, dur: 0.16, att: 0.001, vel: 0.3 });
    S.noise({ dur: 0.02, att: 0.0005, vel: 0.3, hp: [4000, 4000] });
  });
  def('beam_heavy', 'Heavy beam weapon burst', 1.2, 120, 0.567, S => {
    S.tone({ type: 'sawtooth', f: 110, f1: 130, dur: 0.85, att: 0.08, vel: 0.35, lp: [400, 2600, 3], sus: true, rel: 0.25, det2: 9, am: [38, 0.6], send: 0.15 });
    S.tone({ type: 'square', f: 55, dur: 0.85, att: 0.08, vel: 0.25, lp: [300, 300], sus: true, rel: 0.25 });
    S.noise({ dur: 0.85, att: 0.08, vel: 0.2, hp: [4500, 4500], sus: true, rel: 0.25, am: [31, 0.5] });
    S.noise({ at: 0.8, dur: 0.3, att: 0.002, vel: 0.3, bp: [2500, 800, 2] });
  });
  def('missile_launch', 'Missile launch: ignition thump and rising whoosh', 1.3, 100, 1.075, S => {
    S.tone({ f: 120, f1: 48, dur: 0.3, att: 0.003, vel: 0.7 });
    S.noise({ kind: 'pink', at: 0.03, dur: 0.85, att: 0.04, vel: 0.5, bp: [500, 2600, 0.8], env: 'swell', pk: 0.4, send: 0.15 });
    S.noise({ at: 0.05, dur: 0.8, att: 0.05, vel: 0.12, hp: [3000, 3000] });
    S.tone({ type: 'sawtooth', f: 90, f1: 300, dur: 0.8, att: 0.05, vel: 0.15, lp: [800, 800] });
  });
  def('missile_hit', 'Missile impact: crack and boom', 1.4, 80, 1.427, S => {
    S.noise({ dur: 0.07, att: 0.0008, vel: 0.9, hp: [2500, 2500] });
    S.v('boom', { f: 62, dur: 1.1, vel: 0.9, send: 0.2 });
    S.v('metal', { at: 0.05, f: 600, dur: 0.3, vel: 0.5 });
  });
  def('explosion_small', 'Small explosion', 1.0, 80, 1.093, S => {
    S.noise({ dur: 0.55, att: 0.002, vel: 0.9, lp: [3200, 200, 1], send: 0.2 });
    S.tone({ f: 95, f1: 40, dur: 0.4, att: 0.002, vel: 0.8 });
    S.noise({ at: 0.03, dur: 0.14, att: 0.001, vel: 0.35, hp: [3000, 3000] });
  });
  def('explosion_big', 'Big explosion with rumble and debris', 3.2, 150, 1.06, S => {
    S.v('boom', { f: 46, dur: 2.9, vel: 1.0, send: 0.3 });
    S.noise({ dur: 1.9, att: 0.003, vel: 1.0, lp: [1900, 80, 1], send: 0.3 });
    S.noise({ kind: 'brown', dur: 2.5, att: 0.01, vel: 0.9, lp: [150, 150] });
    for (let i = 0; i < 9; i++) S.noise({ at: 0.15 + S.rnd() * 1.5, dur: 0.05 + S.rnd() * 0.06, att: 0.0008, vel: 0.2 + S.rnd() * 0.2, hp: [1800 + S.rnd() * 2000, 1800], send: 0.2 });
  });
  def('shield_hit', 'Shield impact: electric sizzle', 0.6, 60, 2.018, S => {
    S.noise({ dur: 0.25, att: 0.002, vel: 0.6, bp: [3000, 8000, 5], send: 0.15 });
    S.tone({ type: 'sawtooth', f: 1800, f1: 600, dur: 0.3, att: 0.002, vel: 0.3, fm: { r: 7, idx: 3, dec: 0.8 }, lp: [6000, 2000, 1], send: 0.2 });
    S.tone({ f: 3500, f1: 2400, dur: 0.35, att: 0.004, vel: 0.15, am: [45, 0.8], send: 0.2 });
  });
  def('armor_hit', 'Armor hit: metallic clang and thud', 0.9, 60, 1.094, S => {
    S.v('metal', { f: 650, dur: 0.55, vel: 1.0, send: 0.15 });
    S.tone({ f: 140, f1: 70, dur: 0.16, att: 0.002, vel: 0.6 });
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
    S.noise({ at: 0.8, dur: 0.9, att: 0.002, vel: 0.8, lp: [2200, 120, 1], send: 0.2 });
  });
  def('deathray', 'Death ray: ominous swarm, rising whine and crackle', 3.0, 400, 0.837, S => {
    [55, 55.8, 82.4, 110.5].forEach((f, i) => S.tone({ type: 'sawtooth', f, f1: f * 1.05, dur: 1.9, att: 0.4, vel: 0.2, lp: [200, 3200, 5], sus: true, rel: 0.3, am: [22, 0.5], send: 0.15 }));
    S.tone({ f: 200, f1: 1600, dur: 1.7, att: 0.2, vel: 0.18, env: 'swell', pk: 0.95, send: 0.2 });
    S.noise({ dur: 1.9, att: 0.3, vel: 0.2, bp: [5000, 5000, 3], am: [28, 1], sus: true, rel: 0.2 });
    S.v('boom', { at: 1.7, f: 44, dur: 1.4, vel: 0.8, send: 0.3 });
  });
  def('planet_hit', 'Planet struck: heavy impact and rolling rumble', 3.2, 300, 1.142, S => {
    S.v('boom', { f: 40, dur: 2.9, vel: 1.0, send: 0.4 });
    S.noise({ kind: 'brown', dur: 2.6, att: 0.01, vel: 0.9, lp: [140, 140], send: 0.2 });
    S.noise({ dur: 0.1, att: 0.001, vel: 0.5, hp: [1800, 1800] });
    for (let i = 0; i < 6; i++) S.noise({ at: 0.2 + S.rnd() * 1.4, dur: 0.07, att: 0.001, vel: 0.2, bp: [900 + S.rnd() * 900, 900, 2], send: 0.2 });
  });
  def('ground_fire', 'Small-arms fire burst with a ricochet', 1.0, 150, 0.725, S => {
    for (let i = 0; i < 4; i++) {
      const at = i * 0.12 + S.rnd() * 0.02;
      S.noise({ at, dur: 0.09, att: 0.0005, vel: 0.8, bp: [1800, 1800, 0.7], send: 0.1 });
      S.noise({ at, dur: 0.05, att: 0.0005, vel: 0.5, lp: [600, 600] });
      S.tone({ f: 160, f1: 80, at, dur: 0.06, att: 0.0008, vel: 0.5 });
    }
    S.tone({ f: 3000, f1: 1200, at: 0.5, dur: 0.22, att: 0.003, vel: 0.1, send: 0.2 });
  });
  def('troops_land', 'Troops land: descending drop-ship, thuds and a horn blip', 2.0, 300, 0.87, S => {
    S.noise({ kind: 'pink', dur: 0.9, att: 0.1, vel: 0.35, bp: [1500, 400, 1], env: 'swell', pk: 0.8 });
    S.tone({ type: 'sawtooth', f: 60, f1: 50, dur: 1.0, att: 0.1, vel: 0.3, lp: [300, 300] });
    [0.9, 1.05, 1.2].forEach((at, i) => { S.v('metal', { at, f: 300, dur: 0.2, vel: 0.5 }); S.v('tom', { at, f: 90, dur: 0.25, vel: 0.9 }); });
    S.v('brass', { at: 1.35, f: 261.6, dur: 0.3, vel: 0.8, att: 0.03, send: 0.2 });
  });
  def('planet_destroyed', 'Planet destroyed: enormous boom, falling sweep and cracking', 4.8, 800, 0.999, S => {
    S.v('boom', { f: 36, dur: 4.0, vel: 1.0, send: 0.45 });
    S.noise({ dur: 3.0, att: 0.004, vel: 1.0, lp: [2600, 60, 1], send: 0.35 });
    S.tone({ type: 'sawtooth', f: 900, f1: 30, dur: 2.6, att: 0.01, vel: 0.3, lp: [1800, 100, 2], send: 0.3 });
    S.noise({ kind: 'brown', dur: 3.6, att: 0.01, vel: 1.0, lp: [110, 110] });
    for (let i = 0; i < 14; i++) S.noise({ at: 0.1 + S.rnd() * 2.4, dur: 0.05 + S.rnd() * 0.1, att: 0.001, vel: 0.2 + S.rnd() * 0.2, hp: [1500 + S.rnd() * 2500, 1500], send: 0.3 });
  });
  def('nova', 'Star goes nova: rising whine, white swell, then a huge blast', 5.2, 800, 0.982, S => {
    S.tone({ type: 'sawtooth', f: 120, f1: 3000, dur: 1.7, att: 0.1, vel: 0.22, lp: [400, 6000, 2], env: 'swell', pk: 0.95, send: 0.3 });
    S.noise({ dur: 1.8, att: 0.1, vel: 0.5, bp: [200, 9000, 1], env: 'swell', pk: 0.95, send: 0.25 });
    S.v('boom', { at: 1.8, f: 38, dur: 3.0, vel: 1.0, send: 0.4 });
    S.v('crash', { at: 1.8, dur: 3.0, vel: 0.9, send: 0.4 });
    S.noise({ at: 1.8, dur: 2.2, att: 0.002, vel: 0.9, lp: [3000, 80, 1], send: 0.3 });
  });

  // ------------------------------------------------------------------ public API
  SFX.list = () => ORDER.map(id => ({ id, desc: FX[id].desc, dur: FX[id].dur }));
  SFX.has = id => !!FX[id];
  SFX.info = id => (FX[id] ? { id, desc: FX[id].desc, dur: FX[id].dur, gap: FX[id].gap, gain: FX[id].gain } : null);

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
      fx.fn(new Sess(eng, { t0: eng.ctx.currentTime + 0.006, vol: o.vol, pan: o.pan, rate: o.rate, gain: fx.gain }));
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
      fx.fn(new Sess(eng, { t0: 0.03, vol: o.vol, pan: o.pan, rate: o.rate, gain: o.raw ? 1 : fx.gain, vary: 0 }));
    }, { sampleRate: o.sampleRate || 44100 });
  };
})(window.MOO);
