// Master of Orion — Reborn · audio core.
// Pure Web Audio, no files. Exposes MOO.Audio.{init, ctx, engine, settings, setVolume, setMuted, isReady, stats, onReady,
// createEngine, offline, renderWindowed, Voices, playVoice, kit}. Music lives in music.js, effects in sfx.js.
//
// Architecture: an "engine" (createEngine) wraps one AudioContext (real or Offline) with
//   voices -> layer/sfx buses -> musicBus (-> eq -> M/S width -> glue compressor -> duck) / sfxBus -> master -> highpass -> compressor -> soft-clip limiter -> outGain -> destination
// plus two convolution reverbs (music hall, sfx plate). Every voice is a small graph that is stopped + disconnected when it ends.
// The duck stage dips the music for a moment under big sound effects (eng.duckMusic, driven by sfx.js) so stingers read without being loud.
(function (M) {
  'use strict';

  const A = M.Audio;
  const LS_KEY = 'moo.audio.v1';

  // ------------------------------------------------------------------ helpers
  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  const num = (x, d) => (x === undefined || x === null || x !== x ? d : x);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const ftom = f => 69 + 12 * Math.log2(f / 440);
  const dbtoa = d => Math.pow(10, d / 20);
  const noop = () => {};

  function hashStr(s) {
    s = String(s);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  // small seeded PRNG (mulberry32) with helpers; every audio random choice goes through one of these
  function makeRng(seed) {
    let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
    const r = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.chance = p => r() < p;
    return r;
  }

  // envelopes (all anchored with setValueAtTime so ramps start where we want them)
  function envPerc(p, t, peak, a, d) {           // fast attack, exponential decay to silence
    p.setValueAtTime(1e-4, t);
    p.linearRampToValueAtTime(Math.max(peak, 2e-4), t + a);
    p.exponentialRampToValueAtTime(1e-4, t + a + d);
    return t + a + d;
  }
  // equal-power fade of an AudioParam from `from` to `to` over `sec` seconds ('in' = sine, 'out' = cosine shape). Never throws:
  // when a curve cannot be scheduled (WebKit refuses a new event inside a running setValueCurveAtTime) it falls back to a linear ramp.
  function fadeParam(p, from, to, t, sec, shape) {
    if (!(sec > 0.01)) { try { p.cancelScheduledValues(t); p.setValueAtTime(to, t); } catch (e) { try { p.value = to; } catch (e2) { /* ignore */ } } return; }
    const n = 48, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * Math.PI / 2; c[i] = shape === 'out' ? to + (from - to) * Math.cos(x) : from + (to - from) * Math.sin(x); }
    try { p.cancelScheduledValues(t); p.setValueAtTime(from, t); p.setValueCurveAtTime(c, t, sec); }
    catch (e) {
      try { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + sec); }
      catch (e2) { try { p.value = to; } catch (e3) { /* ignore */ } }
    }
  }
  function envAdsr(p, t, peak, a, d, sus, dur, r) { // returns the time the envelope reaches silence
    peak = Math.max(peak, 2e-4);
    const tA = t + a;
    p.setValueAtTime(1e-4, t);
    p.linearRampToValueAtTime(peak, tA);
    let lvl = peak, tHold = tA;
    if (sus < 0.999 && d > 0) { lvl = Math.max(1e-4, peak * sus); p.exponentialRampToValueAtTime(lvl, tA + d); tHold = tA + d; }
    const tRel = Math.max(t + dur, tHold);
    p.setValueAtTime(lvl, tRel);
    p.exponentialRampToValueAtTime(1e-4, tRel + r);
    return tRel + r;
  }

  // ------------------------------------------------------------------ settings
  const settings = { music: 0.5, sfx: 0.8, muted: false };   // the score sits in the background by default
  function loadSettings() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (o && typeof o === 'object') {
        if (typeof o.music === 'number' && isFinite(o.music)) settings.music = clamp(o.music, 0, 1);
        if (typeof o.sfx === 'number' && isFinite(o.sfx)) settings.sfx = clamp(o.sfx, 0, 1);
        if (typeof o.muted === 'boolean') settings.muted = o.muted;
      }
    } catch (e) { /* storage blocked or corrupt JSON: keep defaults */ }
  }
  function saveSettings() {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }
  loadSettings();
  const volToGain = v => (v <= 0 ? 0 : Math.pow(v, 1.6));

  // ------------------------------------------------------------------ shared buffers (cached per sample rate)
  const cache = Object.create(null);
  A._cache = cache;                             // (debug / measurement hook: generated impulse responses, noise buffers, curves)

  function makeNoise(ctx, kind, seconds, seed) {
    const sr = ctx.sampleRate, n = Math.floor(sr * seconds), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), rng = makeRng(seed);
    if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = rng() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
      }
    } else if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < n; i++) { last = (last + 0.02 * (rng() * 2 - 1)) / 1.02; d[i] = last; }
    } else {
      for (let i = 0; i < n; i++) d[i] = rng() * 2 - 1;
    }
    let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
    const g = 0.3 / Math.sqrt(e / n || 1);               // normalise every colour to RMS 0.3
    for (let i = 0; i < n; i++) d[i] = clamp(d[i] * g, -1, 1);
    return buf;
  }

  // generated stereo impulse response: decorrelated noise, exponential decay, darkening tail, a few early reflections
  const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  function IRBuilder(ctx, o) {
    const sr = ctx.sampleRate;
    this.o = o; this.sr = sr; this.len = Math.max(64, Math.floor(sr * o.seconds)); this.buf = ctx.createBuffer(2, this.len, sr);
    this.rng = makeRng(o.seed || 7); this.pre = Math.floor(sr * (o.pre || 0.01));
    this.envStep = Math.exp(-6.9078 / (o.rt60 * sr)); this.dampStep = Math.exp(-1 / (o.damp * sr)); this.diffN = Math.max(1, o.diff * sr);
    this.ch = 0; this.phase = 0; this.reset();
  }
  IRBuilder.prototype.reset = function () { this.i = this.pre; this.lp = 0; this.env = 1; this.damp = 1; };
  // returns true when finished; otherwise call again later (budget in ms)
  IRBuilder.prototype.run = function (budget) {
    const t0 = nowMs(), o = this.o, len = this.len, pre = this.pre, sr = this.sr, rng = this.rng;
    while (this.ch < 2) {
      const d = this.buf.getChannelData(this.ch);
      if (this.phase === 0) {
        let i = this.i, lp = this.lp, env = this.env, dm = this.damp;
        const es = this.envStep, ds = this.dampStep, dn = this.diffN, hs = o.hiStart, he = o.hiEnd;
        while (i < len) {
          const k = i - pre, a = he + (hs - he) * dm;
          lp += a * ((rng() * 2 - 1) - lp);
          d[i] = lp * env * (k < dn ? k / dn : 1);
          env *= es; dm *= ds; i++;
          if ((i & 8191) === 0 && nowMs() - t0 > budget) { this.i = i; this.lp = lp; this.env = env; this.damp = dm; return false; }
        }
        for (let k = 0; k < (o.er || 0); k++) {            // a few early reflections
          const idx = pre + Math.floor(sr * (0.006 + rng() * 0.07));
          if (idx < len) d[idx] += (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.35);
        }
        this.phase = 1;
        if (nowMs() - t0 > budget) return false;
      }
      let e = 0; for (let i = 0; i < len; i++) e += d[i] * d[i];     // unit-energy normalisation
      const g = 1 / Math.sqrt(e || 1);
      for (let i = 0; i < len; i++) d[i] *= g;
      this.ch++; this.phase = 0; this.reset();
      if (nowMs() - t0 > budget) return this.ch >= 2;
    }
    return true;
  };
  function makeIR(ctx, o) { const b = new IRBuilder(ctx, o); b.run(Infinity); return b.buf; }
  const IR_STAGE = { seconds: 0.9, rt60: 0.55, pre: 0.008, diff: 0.03, hiStart: 0.9, hiEnd: 0.45, damp: 0.6, er: 12, seed: 23 };   // a stage: short, bright, early reflections
  const IR_HALL = { seconds: 3.8, rt60: 3.3, pre: 0.036, diff: 0.05, hiStart: 0.6, hiEnd: 0.14, damp: 1.3, er: 8, seed: 11 };   // a large, open hall: long dark tail, a little more pre-delay
  const IR_PLATE = { seconds: 1.2, rt60: 1.0, pre: 0.003, diff: 0.008, hiStart: 0.85, hiEnd: 0.25, damp: 0.7, er: 0, seed: 23 };

  function softClipCurve() {                      // |x|<=0.6 linear, then tanh knee toward 0.97 (input pre-scaled by 0.5)
    const n = 2049, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x) * 2;
      const y = a <= 0.6 ? a : 0.6 + 0.37 * Math.tanh((a - 0.6) / 0.37);
      c[i] = x < 0 ? -y : y;
    }
    return c;
  }
  function driveCurve(k) {
    const n = 1025, c = new Float32Array(n), nk = Math.tanh(k);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / nk;
    return c;
  }

  // ------------------------------------------------------------------ Voice: a tracked bundle of nodes
  class Voice {
    constructor(eng, dest, t0, prio, pan, send) {
      this.eng = eng; this.ctx = eng.ctx; this.t0 = t0; this.t1 = t0; this.prio = prio;
      this.nodes = []; this.srcs = []; this.dead = false; this.pending = 0;
      this.out = this.add(this.ctx.createGain());
      if (pan) {
        const p = this.add(this.ctx.createStereoPanner());
        p.pan.value = clamp(pan, -1, 1);
        this.out.connect(p); p.connect(dest);
      } else this.out.connect(dest);
      if (send > 0 && eng.sfxVerbIn) { const s = this.add(this.ctx.createGain()); s.gain.value = send; this.out.connect(s); s.connect(eng.sfxVerbIn); }
    }
    add(n) { this.nodes.push(n); this.eng.nodeCount++; return n; }
    gain(v) { const g = this.add(this.ctx.createGain()); g.gain.value = v === undefined ? 1 : v; return g; }
    filter(type, f, q) {
      const n = this.add(this.ctx.createBiquadFilter());
      n.type = type; n.frequency.value = clamp(f, 10, this.eng.sr * 0.45); if (q !== undefined) n.Q.value = q;
      return n;
    }
    shaper(curve) { const n = this.add(this.ctx.createWaveShaper()); n.curve = curve; return n; }
    osc(type, f, a, b) {
      const o = this.add(this.ctx.createOscillator());
      if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
      o.frequency.value = clamp(f, 1, this.eng.sr * 0.45);
      if (!(b > a)) b = a + 0.01;
      o.start(a); o.stop(b); this.srcs.push(o);
      if (b > this.t1) this.t1 = b;
      return o;
    }
    noise(kind, a, b, off) {
      const s = this.add(this.ctx.createBufferSource());
      const buf = this.eng.noiseBuf[kind || 'white'];
      s.buffer = buf; s.loop = true;
      if (!(b > a)) b = a + 0.01;
      s.start(a, off === undefined ? this.eng.rand() * (buf.duration - 0.05) : off); s.stop(b); this.srcs.push(s);
      if (b > this.t1) this.t1 = b;
      return s;
    }
    end() {
      this.pending = this.srcs.length;
      for (const s of this.srcs) s.onended = () => { if (--this.pending <= 0) this.dispose(); };
      this.eng.stats.created++;
      return this;
    }
    kill(t) {                                    // fast fade + early stop (voice stealing / track disposal)
      if (this.dead) return;
      this.killAt = t;
      try { const g = this.out.gain; g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.004); } catch (e) { /* ignore */ }
      const stopAt = Math.max(t + 0.03, this.t0 + 0.001);
      for (const s of this.srcs) { try { s.stop(stopAt); } catch (e) { /* ignore */ } }
      if (this.t1 > stopAt) this.t1 = stopAt;
    }
    dispose() {
      if (this.dead) return;
      this.dead = true;
      for (const s of this.srcs) { s.onended = null; try { s.stop(); } catch (e) { /* already stopped */ } }
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
      this.eng.nodeCount -= this.nodes.length;
      this.nodes.length = 0; this.srcs.length = 0;
      this.eng.voices.delete(this);
      this.eng.stats.disposed++;
    }
  }

  // ------------------------------------------------------------------ engine
  function createEngine(ctx, opts) {
    opts = opts || {};
    const sr = ctx.sampleRate;
    const eng = {
      ctx, sr, offline: !!opts.offline, unity: !!opts.unity, maxVoices: opts.maxVoices || 96,
      voices: new Set(), nodeCount: 0, vnow: 0, baseNodes: 0,
      stats: { created: 0, disposed: 0, stolen: 0, refused: 0, peak: 0 },
    };
    eng.rand = makeRng(opts.seed !== undefined ? opts.seed : (opts.offline ? 1 : ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0)));
    eng.now = () => (eng.offline ? eng.vnow : ctx.currentTime);
    const mk = n => { eng.nodeCount++; return n; };
    eng.mk = mk;

    // master chain
    const master = mk(ctx.createGain());
    const hp = mk(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 22; hp.Q.value = 0.5;
    const comp = mk(ctx.createDynamicsCompressor());
    comp.threshold.value = -6; comp.knee.value = 4; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.12;   // a peak limiter: the glue stage levels, this only catches peaks
    const pre = mk(ctx.createGain()); pre.gain.value = 0.5;
    const shaper = mk(ctx.createWaveShaper());
    if (!cache.clip) cache.clip = softClipCurve();
    shaper.curve = cache.clip; try { shaper.oversample = '2x'; } catch (e) { /* ignore */ }
    const outGain = mk(ctx.createGain());
    master.connect(hp); hp.connect(comp); comp.connect(pre); pre.connect(shaper); shaper.connect(outGain); outGain.connect(ctx.destination);
    eng.master = master; eng.outGain = outGain;
    eng.musicBus = mk(ctx.createGain());
    // music-only tone stage, left flat on purpose (the shelves are kept as hooks for a listening pass)
    const eqL = mk(ctx.createBiquadFilter()), eqH = mk(ctx.createBiquadFilter());
    eqL.type = 'lowshelf'; eqL.frequency.value = 60; eqL.gain.value = 0.5;      // weight
    const eqM = mk(ctx.createBiquadFilter()); eqM.type = 'peaking'; eqM.frequency.value = 250; eqM.gain.value = -1.5; eqM.Q.value = 0.8;   // the mud region, where every bed stacks up
    eqH.type = 'highshelf'; eqH.frequency.value = 3200; eqH.gain.value = 1.0;    // presence, mastering-mild
    const eqA = mk(ctx.createBiquadFilter()); eqA.type = 'highshelf'; eqA.frequency.value = 10000; eqA.gain.value = 1.5;   // air, mastering-mild
    // glue: a slow, shallow compressor on the whole orchestra (2:1 above -20 dB, 40 ms in, 400 ms out) so tutti swells sit together
    // and the master limiter is left with transients only
    const glue = mk(ctx.createDynamicsCompressor());
    glue.threshold.value = -24; glue.knee.value = 18; glue.ratio.value = 1.6; glue.attack.value = 0.06; glue.release.value = 0.5;
    const glueMake = mk(ctx.createGain()); glueMake.gain.value = dbtoa(0);
    const sat = mk(ctx.createWaveShaper());        // a whisper of tape-style saturation before the limiter: density, not distortion
    (function () { const n = 2048, c = new Float32Array(n), d = 1.6; for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(d * x) / d; } sat.curve = c; try { sat.oversample = '2x'; } catch (e) { /* ignore */ } })();
    const duck = mk(ctx.createGain());
    const width = (function () {                   // M = (L+R)/2, S = (L-R)/2 ; S -> hp 120 -> +1.5 dB @ 6k -> x w ; L' = M + S', R' = M - S'
      const w = 1.15, inG = mk(ctx.createGain()), split = mk(ctx.createChannelSplitter(2)), merge = mk(ctx.createChannelMerger(2));
      const mid = mk(ctx.createGain()), side = mk(ctx.createGain()), lToM = mk(ctx.createGain()), rToM = mk(ctx.createGain()), lToS = mk(ctx.createGain()), rToS = mk(ctx.createGain());
      lToM.gain.value = 0.5; rToM.gain.value = 0.5; lToS.gain.value = 0.5; rToS.gain.value = -0.5;
      inG.connect(split); split.connect(lToM, 0); split.connect(rToM, 1); split.connect(lToS, 0); split.connect(rToS, 1);
      lToM.connect(mid); rToM.connect(mid); lToS.connect(side); rToS.connect(side);
      const sHp = mk(ctx.createBiquadFilter()); sHp.type = 'highpass'; sHp.frequency.value = 120; sHp.Q.value = 0.7;
      const sAir = mk(ctx.createBiquadFilter()); sAir.type = 'highshelf'; sAir.frequency.value = 6000; sAir.gain.value = 1.5;
      const sW = mk(ctx.createGain()); sW.gain.value = w; const sNeg = mk(ctx.createGain()); sNeg.gain.value = -1;
      side.connect(sHp); sHp.connect(sAir); sAir.connect(sW);
      mid.connect(merge, 0, 0); sW.connect(merge, 0, 0);            // L' = M + S'
      mid.connect(merge, 0, 1); sW.connect(sNeg); sNeg.connect(merge, 0, 1);   // R' = M - S'
      return { in: inG, out: merge };
    })();
    eng.musicBus.connect(eqL); eqL.connect(eqM); eqM.connect(eqH); eqH.connect(eqA); eqA.connect(width.in); width.out.connect(glue); glue.connect(glueMake); glueMake.connect(sat); sat.connect(duck); duck.connect(master);
    eng.glue = glue;
    eng.duck = duck; eng.duckUntil = 0; eng.duckLevel = 1;
    // dip the music by `depthDb` for `hold` seconds (15 ms in, ~250 ms release). While an earlier duck is still holding, the depth
    // never decreases (the deeper one is kept, the hold is extended); a shorter + shallower request inside a running duck is ignored.
    eng.duckMusic = function (depthDb, hold) {
      if (eng.offline || eng.unity) return;
      const t = ctx.currentTime, until = t + Math.max(0.05, hold || 0.3), p = duck.gain;
      let g = dbtoa(-Math.abs(depthDb || 3));
      if (eng.duckUntil > t) { if (eng.duckUntil >= until && eng.duckLevel <= g) return; g = Math.min(g, eng.duckLevel); }
      try { p.cancelScheduledValues(t); p.setTargetAtTime(g, t, 0.015); p.setTargetAtTime(1, until, 0.25); } catch (e) { /* ignore */ }
      eng.duckUntil = until; eng.duckLevel = g;
    };
    eng.sfxBus = mk(ctx.createGain()); eng.sfxBus.connect(master);
    eng.sfxIn = eng.sfxBus;

    // shared noise buffers + curves
    const nk = sr + ':noise', seeds = { white: 101, pink: 202, brown: 303 };
    if (!cache[nk]) cache[nk] = {};
    const NB = cache[nk];
    eng.noiseBuf = {};                           // built lazily per colour (keeps engine creation cheap)
    for (const k of ['white', 'pink', 'brown']) Object.defineProperty(eng.noiseBuf, k, { enumerable: true, get() { return NB[k] || (NB[k] = makeNoise(ctx, k, 1.6, seeds[k])); } });
    if (!cache.drive) cache.drive = { soft: driveCurve(1.6), hard: driveCurve(4) };
    eng.curves = cache.drive;

    // reverbs (music hall -> musicBus, sfx plate -> sfxBus)
    const jobs = [];
    const verb = (kind, params, bus, hpHz, lpHz) => {
      const key = sr + ':' + kind;
      const inp = mk(ctx.createGain()), h = mk(ctx.createBiquadFilter()), conv = mk(ctx.createConvolver()), l = mk(ctx.createBiquadFilter()), out = mk(ctx.createGain());
      h.type = 'highpass'; h.frequency.value = hpHz; h.Q.value = 0.5; l.type = 'lowpass'; l.frequency.value = lpHz; l.Q.value = 0.5;
      conv.normalize = false;
      if (cache[key]) conv.buffer = cache[key];
      else if (eng.offline) { cache[key] = makeIR(ctx, params); conv.buffer = cache[key]; }
      else jobs.push({ key, params, conv });            // real-time: generated in slices below (the reverb fades in a moment after init)
      inp.connect(h); h.connect(conv); conv.connect(l); l.connect(out); out.connect(bus);
      return inp;
    };
    eng.hallIn = verb('hall', IR_HALL, eng.musicBus, 170, 8800);
    eng.stageIn = verb('stage', IR_STAGE, eng.musicBus, 140, 12000);   // the close plane: drums, lead, plucks, bells
    eng.sfxVerbIn = verb('plate', IR_PLATE, eng.sfxBus, 120, 11000);
    if (jobs.length) {                                  // keep every main-thread task well under a frame: <=2.5 ms slices, one buffer assignment per task
      const next = () => {
        const j = jobs.shift(); if (!j) return;
        const b = new IRBuilder(ctx, j.params);
        const slice = () => {
          if (!b.run(2.5)) { setTimeout(slice, 0); return; }
          setTimeout(() => { try { cache[j.key] = b.buf; j.conv.buffer = b.buf; } catch (e) { /* context closed */ } setTimeout(next, 0); }, 0);
        };
        setTimeout(slice, 0);
      };
      next();
    }

    // cached periodic waves (pulse trains of a given duty)
    const pulses = {};
    eng.pulse = function (duty) {
      const k = Math.round(clamp(duty, 0.05, 0.5) * 100);
      if (!pulses[k]) {
        const N = 56, re = new Float32Array(N), im = new Float32Array(N), d = k / 100;
        for (let n = 1; n < N; n++) { re[n] = Math.sin(2 * Math.PI * n * d) / (n * Math.PI); im[n] = (1 - Math.cos(2 * Math.PI * n * d)) / (n * Math.PI); }
        pulses[k] = ctx.createPeriodicWave(re, im);
      }
      return pulses[k];
    };

    // twin tempo delay (L: t1, R: t2) with darkening feedback
    eng.makeDelay = function (t1, t2, fb, hz) {
      const nodes = [], N = n => { nodes.push(n); eng.nodeCount++; return n; };
      const inp = N(ctx.createGain()), out = N(ctx.createGain());
      [[t1, -0.55], [t2, 0.55]].forEach(function (p) {
        const d = N(ctx.createDelay(4)), lp = N(ctx.createBiquadFilter()), g = N(ctx.createGain()), pn = N(ctx.createStereoPanner());
        d.delayTime.value = clamp(p[0], 0.01, 3.9); lp.type = 'lowpass'; lp.frequency.value = hz || 3000; lp.Q.value = 0.5;
        g.gain.value = fb; pn.pan.value = p[1];
        inp.connect(d); d.connect(lp); lp.connect(g); g.connect(d); lp.connect(pn); pn.connect(out);
      });
      return { in: inp, out, dispose() { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } eng.nodeCount -= nodes.length; nodes.length = 0; } };
    };

    // ensemble chorus: three modulated delay taps spread across the stereo field (strings / choir / pad "ensemble" thickening)
    // Group-bus processing, one chain per music layer (the mix engineer's channel strips): a high-pass that keeps each group out of
    // the register below it, a cut in the low-mid "mud" region so the beds do not stack up at 250 Hz, a touch of presence where a
    // line has to read, gentle bus compression on bass / lead, and parallel compression on the drums for weight without pumping.
    // Nothing here adds what a recording lacks; it clears the space between the recordings.
    const STRIPS = {
      bass:  { hp: 28, cuts: [[240, -2, 1.0]], comp: [-22, 3, 0.01, 0.2] },   // (no spread: the bass stays centred and solid)
      pad:   { hp: 120, hp2: true, cuts: [[260, -2.5, 0.9], [3200, 1, 0.8]], spread: [0.014, 0.22] },
      arp:   { hp: 140, cuts: [[250, -1.5, 1.0]], spread: [0.011, 0.2] },
      lead:  { hp: 80, cuts: [[300, -1.5, 1.0], [2800, 2, 0.9]], comp: [-20, 2, 0.02, 0.25], spread: [0.009, 0.14] },
      bell:  { hp: 300, cuts: [[8000, 1, 'hs']], spread: [0.016, 0.25] },
      choir: { hp: 140, hp2: true, cuts: [[420, -2, 1.0], [6000, 1.5, 'hs']], spread: [0.018, 0.25] },
      drums: { hp: 30, cuts: [[180, 1, 1.2]], par: [-24, 4, 0.003, 0.12, 0.35] },
      fx:    { hp: 60 },
    };
    eng.makeStrip = function (kind) {
      const st = STRIPS[kind] || STRIPS.fx, nodes = [], N = n => { nodes.push(n); eng.nodeCount++; return n; };
      const inp = N(ctx.createGain()), out = N(ctx.createGain());
      let node = inp;
      const hp = N(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = st.hp; hp.Q.value = 0.7; node.connect(hp); node = hp;
      if (st.hp2) { const h2 = N(ctx.createBiquadFilter()); h2.type = 'highpass'; h2.frequency.value = st.hp; h2.Q.value = 0.7; node.connect(h2); node = h2; }   // 24 dB/oct: the beds stay out of the bass
      for (const c of st.cuts || []) {
        const f = N(ctx.createBiquadFilter());
        if (c[2] === 'hs') { f.type = 'highshelf'; f.frequency.value = c[0]; f.gain.value = c[1]; }
        else { f.type = 'peaking'; f.frequency.value = c[0]; f.gain.value = c[1]; f.Q.value = c[2]; }
        node.connect(f); node = f;
      }
      if (st.comp) { const cp = N(ctx.createDynamicsCompressor()); cp.threshold.value = st.comp[0]; cp.ratio.value = st.comp[1]; cp.attack.value = st.comp[2]; cp.release.value = st.comp[3]; cp.knee.value = 8; node.connect(cp); node = cp; }
      if (st.par) {                                 // parallel compression: a squashed copy under the dry drums
        const cp = N(ctx.createDynamicsCompressor()), pg = N(ctx.createGain());
        cp.threshold.value = st.par[0]; cp.ratio.value = st.par[1]; cp.attack.value = st.par[2]; cp.release.value = st.par[3]; cp.knee.value = 4; pg.gain.value = st.par[4];
        node.connect(cp); cp.connect(pg); pg.connect(out);
      }
      if (st.spread) {                              // L' = L + g*R(delayed), R' = R + g*L(delayed)
        const sp = N(ctx.createChannelSplitter(2)), mg = N(ctx.createChannelMerger(2)), dL = N(ctx.createDelay(0.05)), dR = N(ctx.createDelay(0.05)), gL = N(ctx.createGain()), gR = N(ctx.createGain()), dry = N(ctx.createGain());
        dL.delayTime.value = st.spread[0]; dR.delayTime.value = st.spread[0] * 1.17; gL.gain.value = st.spread[1]; gR.gain.value = st.spread[1];
        node.connect(sp); sp.connect(dL, 0); sp.connect(dR, 1); dL.connect(gL); dR.connect(gR);
        sp.connect(mg, 0, 0); sp.connect(mg, 1, 1); gR.connect(mg, 0, 0); gL.connect(mg, 0, 1);
        mg.connect(out);
      } else node.connect(out);
      return { in: inp, out, nodes, dispose() { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } eng.nodeCount -= nodes.length; } };
    };
    eng.makeChorus = function (o) {
      o = o || {};
      const nodes = [], N = n => { nodes.push(n); eng.nodeCount++; return n; };
      const inp = N(ctx.createGain()), out = N(ctx.createGain()), taps = [[0.0135, -0.75, 0.29], [0.0185, 0, 0.37], [0.0235, 0.75, 0.43]];
      for (const tp of taps) {
        const d = N(ctx.createDelay(0.1)), lfo = N(ctx.createOscillator()), lg = N(ctx.createGain()), pn = N(ctx.createStereoPanner()), g = N(ctx.createGain());
        d.delayTime.value = tp[0]; lfo.type = 'sine'; lfo.frequency.value = tp[2] * num(o.rate, 1); lg.gain.value = num(o.depth, 0.0026); pn.pan.value = tp[1]; g.gain.value = 0.55;
        lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
        inp.connect(d); d.connect(g); g.connect(pn); pn.connect(out);
      }
      return { in: inp, out, dispose() { for (const n of nodes) { try { if (n.stop) n.stop(); } catch (e) { /* ignore */ } try { n.disconnect(); } catch (e) { /* ignore */ } } eng.nodeCount -= nodes.length; nodes.length = 0; } };
    };

    // voice allocation with a polyphony cap; higher priority voices may steal lower ones
    eng.voice = function (dest, t0, prio, pan, send) {
      prio = prio || 1;
      const over = [];
      for (const q of eng.voices) {
        if (q.dead || (q.killAt !== undefined && q.killAt <= t0)) continue;
        if (q.t0 <= t0 + 0.0005 && q.t1 > t0) over.push(q);
      }
      let cnt = over.length;
      if (cnt >= eng.maxVoices) {
        // steal the cheapest lower-priority voices (lowest priority first, then the one that ends soonest) until there is room
        over.sort((a, b) => a.prio - b.prio || a.t1 - b.t1);
        let i = 0;
        while (cnt >= eng.maxVoices) {
          const victim = over[i++];
          if (!victim || victim.prio >= prio) { eng.stats.refused++; return null; }
          victim.kill(Math.max(t0, eng.now())); eng.stats.stolen++; cnt--;
        }
      }
      const v = new Voice(eng, dest, t0, prio, pan, send);
      eng.voices.add(v);
      if (cnt + 1 > eng.stats.peak) eng.stats.peak = cnt + 1;
      return v;
    };
    eng.sweep = function (now) {                 // janitor: dispose anything that should have ended long ago
      if (now === undefined) now = eng.now();
      for (const q of Array.from(eng.voices)) if (q.dead || q.t1 + 0.6 < now) q.dispose();
    };
    eng.killAll = function () { for (const q of Array.from(eng.voices)) q.dispose(); };

    eng.setBusGains = function (immediate) {
      const t = ctx.currentTime;
      const set = (p, v) => { try { p.cancelScheduledValues(t); if (immediate) p.setValueAtTime(v, t); else p.setTargetAtTime(v, t, 0.03); } catch (e) { p.value = v; } };
      set(eng.musicBus.gain, eng.unity ? 1 : volToGain(settings.music));
      set(eng.sfxBus.gain, eng.unity ? 1 : volToGain(settings.sfx));
      set(eng.outGain.gain, !eng.unity && settings.muted ? 0 : 1);
    };
    eng.setBusGains(true);
    eng.baseNodes = eng.nodeCount;
    return eng;
  }

  // ------------------------------------------------------------------ voice factories
  // Signature: V.name(eng, dest, t, o) -> Voice | null.   o: {f (Hz), dur (s), vel, pan, prio, send, ...voice params}
  const V = {};
  const mkv = (eng, dest, t, o, prio) => eng.voice(dest, t, o.prio || prio, o.pan, o.send);

  // warm detuned-saw pad through a slowly breathing lowpass
  V.pad = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.12, num(o.dur, 2)), vel = num(o.vel, 0.6), att = num(o.att, 0.5), rel = num(o.rel, 0.9);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + rel + 0.08, cut = Math.min(num(o.cut, f * num(o.cutK, 4) + num(o.cutB, 600)), 9000);
    const lp = v.filter('lowpass', cut * 0.5, num(o.q, 1));
    lp.frequency.setValueAtTime(cut * 0.5, t); lp.frequency.exponentialRampToValueAtTime(cut, t + att + 0.4);
    const env = v.gain(0.0001), det = num(o.det, 8), wave = o.wave || 'sawtooth', oscs = [];
    for (const d of (o.two ? [-det, det] : [-det, 0, det])) { const os = v.osc(wave, f, t, end); os.detune.value = d; os.connect(lp); oscs.push(os); }
    if (o.sub) { const so = v.osc('sine', f * 0.5, t, end), sg = v.gain(o.sub); so.connect(sg); sg.connect(lp); }
    lp.connect(env); env.connect(v.out);
    const lfo = v.osc('sine', num(o.lfo, 0.13) * (0.75 + eng.rand() * 0.5), t, end), lg = v.gain(cut * num(o.lfoDepth, 0.2));
    lfo.connect(lg); lg.connect(lp.frequency);
    if (o.vib) { const vl = v.osc('sine', 5 + eng.rand() * 0.6, t, end), vg = v.gain(o.vib); vl.connect(vg); for (const os of oscs) vg.connect(os.detune); }
    envAdsr(env.gain, t, vel * num(o.gain, 0.26), att, 0, 1, dur, rel);
    return v.end();
  };

  // subtractive pluck / sequenced arp voice (saw, square, triangle or pulse)
  V.pluck = function (eng, dest, t, o) {
    const f = o.f, vel = num(o.vel, 0.6), dec = num(o.dec, Math.max(0.12, num(o.dur, 0.4)));
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dec + 0.1;
    const c0 = Math.min(num(o.c0, f * 8), 11000), c1 = Math.max(num(o.c1, f * 1.6), 150);
    const lp = v.filter('lowpass', c0, num(o.q, 3));
    lp.frequency.setValueAtTime(c0, t); lp.frequency.exponentialRampToValueAtTime(Math.min(c1, c0), t + num(o.fdec, dec * 0.55));
    const env = v.gain(0.0001), wave = o.wave === 'pulse' ? eng.pulse(num(o.duty, 0.3)) : (o.wave || 'sawtooth'), det = num(o.det, 5);
    v.osc(wave, f, t, end).connect(lp);
    if (det) { const o2 = v.osc(wave, f, t, end); o2.detune.value = det; o2.connect(lp); }
    if (o.sub) { const so = v.osc('sine', f * 0.5, t, end), sg = v.gain(o.sub); so.connect(sg); sg.connect(lp); }
    lp.connect(env); env.connect(v.out);
    envPerc(env.gain, t, vel * num(o.gain, 0.3), num(o.att, 0.003), dec);
    return v.end();
  };

  // FM bell / glass: sine carrier + inharmonic modulator whose index decays, plus a short metallic partial
  V.bell = function (eng, dest, t, o) {
    const f = o.f, vel = num(o.vel, 0.6), dur = num(o.dur, 2.2), ratio = num(o.ratio, 3.5), idx = num(o.idx, 1.8);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.1, g = num(o.gain, 0.3), depth = Math.min(f * ratio * idx, 9000);
    const car = v.osc('sine', f, t, end), mod = v.osc('sine', f * ratio, t, end), mg = v.gain(depth);
    mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.06), t + dur * 0.7);
    mod.connect(mg); mg.connect(car.frequency);
    const env = v.gain(0.0001); car.connect(env); env.connect(v.out);
    envPerc(env.gain, t, vel * g, 0.002, dur);
    const p = num(o.partial, 0.28);
    if (p > 0 && f * num(o.pr, 2.76) < 11000) {
      const po = v.osc('sine', f * num(o.pr, 2.76), t, end), pe = v.gain(0.0001);
      po.connect(pe); pe.connect(v.out); envPerc(pe.gain, t, vel * p * g, 0.002, dur * 0.4);
    }
    return v.end();
  };

  // synth-brass lead: saws + square sub, filter "blat" on attack, delayed vibrato
  V.brass = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.08, num(o.dur, 0.6)), vel = num(o.vel, 0.7), att = num(o.att, 0.045), rel = num(o.rel, 0.16);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + rel + 0.1, br = num(o.bright, 6.5);
    const cs = Math.max(250, f * 1.4), cp = Math.min(f * br, 7500), cu = Math.min(f * br * 0.55, 5000);
    const lp = v.filter('lowpass', cs, num(o.q, 3));
    const a1 = Math.min(att * 1.8 + 0.01, Math.max(0.02, dur * 0.6));
    lp.frequency.setValueAtTime(cs, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(cp, cs * 1.05), t + a1);
    lp.frequency.setTargetAtTime(cu, t + a1, 0.16);
    lp.frequency.setTargetAtTime(cs * 1.3, Math.max(t + dur, t + a1 + 0.02), Math.max(0.03, rel * 0.5));
    const env = v.gain(0.0001), oscs = [];
    for (const d of [-5, 5]) { const os = v.osc('sawtooth', f, t, end); os.detune.value = d; os.connect(lp); oscs.push(os); }
    const sq = v.osc('square', f * 0.5, t, end), sg = v.gain(num(o.body, 0.25)); sq.connect(sg); sg.connect(lp);
    lp.connect(env); env.connect(v.out);
    if (dur > 0.45 && num(o.vib, 10) > 0) {
      const vl = v.osc('sine', 5.3 + eng.rand() * 0.5, t, end), vg = v.gain(0.0001);
      vg.gain.setValueAtTime(0.0001, t + 0.15); vg.gain.linearRampToValueAtTime(num(o.vib, 10), t + 0.65);
      vl.connect(vg); for (const os of oscs) vg.connect(os.detune);
    }
    envAdsr(env.gain, t, vel * num(o.gain, 0.24), att, 0.25, 0.85, dur, rel);
    return v.end();
  };

  // sub bass: sine + filtered saw edge so it survives small speakers
  V.bass = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.06, num(o.dur, 0.5)), vel = num(o.vel, 0.8), att = num(o.att, 0.008), rel = num(o.rel, 0.1);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + rel + 0.06, env = v.gain(0.0001), edge = num(o.edge, 0.28);
    v.osc('sine', f, t, end).connect(env);
    if (edge > 0) {
      const w = v.osc(o.wave || 'sawtooth', f, t, end), lp = v.filter('lowpass', clamp(f * 5, 140, 1400), 1), eg = v.gain(edge);
      lp.frequency.setValueAtTime(clamp(f * 9, 200, 2200), t); lp.frequency.exponentialRampToValueAtTime(clamp(f * 3, 120, 900), t + 0.15);
      w.connect(lp); lp.connect(eg); eg.connect(env);
    }
    env.connect(v.out);
    envAdsr(env.gain, t, vel * num(o.gain, 0.5), att, 0.2, 0.8, dur, rel);
    return v.end();
  };

  // formant "choir": detuned saws through 3 vowel bandpasses (vowel can morph v1 -> v2) + breath
  const FORM = {
    a: [[800, 1.0], [1150, 0.5], [2900, 0.18]], o: [[450, 1.0], [800, 0.45], [2830, 0.12]], u: [[325, 1.0], [700, 0.35], [2530, 0.10]],
    e: [[500, 1.0], [1750, 0.38], [2600, 0.15]], i: [[290, 1.0], [2200, 0.30], [3000, 0.12]],
  };
  V.choir = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.3, num(o.dur, 2)), vel = num(o.vel, 0.6), att = num(o.att, 0.7), rel = num(o.rel, 1.1);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + rel + 0.08, F1 = FORM[o.v1 || 'a'], F2 = FORM[o.v2 || o.v1 || 'a'];
    const src = v.gain(1), env = v.gain(0.0001), oscs = [];
    for (const d of [-10, 9]) { const os = v.osc('sawtooth', f, t, end); os.detune.value = d; os.connect(src); oscs.push(os); }
    for (let i = 0; i < 3; i++) {
      const bp = v.filter('bandpass', F1[i][0], 7), fg = v.gain(F1[i][1] * 2.6);
      bp.frequency.setValueAtTime(F1[i][0], t); bp.frequency.linearRampToValueAtTime(F2[i][0], t + Math.max(0.2, dur * 0.8));
      src.connect(bp); bp.connect(fg); fg.connect(env);
    }
    const vl = v.osc('sine', 4.7 + eng.rand() * 0.6, t, end), vg = v.gain(0.0001);
    vg.gain.setValueAtTime(0.0001, t + 0.3); vg.gain.linearRampToValueAtTime(num(o.vib, 9), t + 1.0);
    vl.connect(vg); for (const os of oscs) vg.connect(os.detune);
    const nz = v.noise('pink', t, end), nb = v.filter('bandpass', 2400, 0.9), ng = v.gain(num(o.breath, 0.1));
    nz.connect(nb); nb.connect(ng); ng.connect(env);
    env.connect(v.out);
    envAdsr(env.gain, t, vel * num(o.gain, 0.5), att, 0, 1, dur, rel);
    return v.end();
  };

  // airy flute: sine + weak harmonics, breath noise, scooped onset, late vibrato
  V.flute = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.1, num(o.dur, 0.6)), vel = num(o.vel, 0.7), att = num(o.att, 0.07), rel = num(o.rel, 0.14);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + rel + 0.08, env = v.gain(0.0001), oscs = [];
    const o1 = v.osc('sine', f, t, end), o2 = v.osc('sine', f * 2, t, end), o3 = v.osc('sine', f * 3, t, end);
    o1.frequency.setValueAtTime(f * 0.985, t); o1.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    const g2 = v.gain(num(o.h2, 0.2)), g3 = v.gain(num(o.h3, 0.06));
    o1.connect(env); o2.connect(g2); g2.connect(env); o3.connect(g3); g3.connect(env); oscs.push(o1, o2, o3);
    const nz = v.noise('pink', t, end), bp = v.filter('bandpass', clamp(f * 2.5, 1200, 7000), 2.2), ng = v.gain(0.0001), br = num(o.breath, 0.5);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(br, t + 0.025); ng.gain.exponentialRampToValueAtTime(Math.max(0.0002, br * 0.22), t + 0.14);
    nz.connect(bp); bp.connect(ng); ng.connect(env);
    if (dur > 0.4 && num(o.vib, 7) > 0) {
      const vl = v.osc('sine', 5.2 + eng.rand() * 0.6, t, end), vg = v.gain(0.0001);
      vg.gain.setValueAtTime(0.0001, t + 0.2); vg.gain.linearRampToValueAtTime(num(o.vib, 7), t + 0.7);
      vl.connect(vg); for (const os of oscs) vg.connect(os.detune);
    }
    env.connect(v.out);
    envAdsr(env.gain, t, vel * num(o.gain, 0.5), att, 0.1, 0.9, dur, rel);
    return v.end();
  };

  // slow resonant drone (low saws, breathing lowpass, vocal resonance)
  V.drone = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(1, num(o.dur, 8)), vel = num(o.vel, 0.6), att = num(o.att, 2.5), rel = num(o.rel, 3);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + rel + 0.1, cut = num(o.cut, 420), env = v.gain(0.0001), mix = v.gain(1);
    const lp = v.filter('lowpass', cut, num(o.q, 5));
    for (const d of [-13, 0, 12]) { const os = v.osc(o.wave || 'sawtooth', f, t, end); os.detune.value = d; os.connect(mix); }
    const so = v.osc('sine', f * 0.5, t, end), sg = v.gain(0.7); so.connect(sg); sg.connect(mix);
    mix.connect(lp); lp.connect(env);
    const rp = v.filter('bandpass', clamp(f * num(o.reson, 3), 80, 3000), 6), rg = v.gain(num(o.resG, 0.9));
    mix.connect(rp); rp.connect(rg); rg.connect(env);
    const lfo = v.osc('sine', num(o.lfo, 0.06) * (0.8 + eng.rand() * 0.4), t, end), lg = v.gain(cut * 0.35); lfo.connect(lg); lg.connect(lp.frequency);
    env.connect(v.out);
    envAdsr(env.gain, t, vel * num(o.gain, 0.3), att, 0, 1, dur, rel);
    return v.end();
  };

  // metallic bar / glockenspiel-like chime: inharmonic sine partials with separate decays
  V.chime = function (eng, dest, t, o) {
    const f = o.f, dur = num(o.dur, 3.5), vel = num(o.vel, 0.5);
    const ratios = o.ratios || [1, 2.756, 5.404, 8.933], amps = o.amps || [1, 0.55, 0.28, 0.12], decs = o.decs || [1, 0.55, 0.32, 0.18];
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.1;
    for (let i = 0; i < ratios.length; i++) {
      const pf = f * ratios[i]; if (pf > 12000) continue;
      const os = v.osc('sine', pf, t, end), g = v.gain(0.0001);
      os.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * 0.3 * amps[i], 0.001, Math.max(0.05, dur * decs[i]));
    }
    return v.end();
  };

  // glass-harmonica: additive harmonics with slow swell and shimmering partial detune
  V.harp = function (eng, dest, t, o) {
    const f = o.f, dur = Math.max(0.4, num(o.dur, 3)), vel = num(o.vel, 0.5), att = num(o.att, 0.18), rel = num(o.rel, 1.6);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + rel + 0.1, env = v.gain(0.0001), nP = num(o.partials, 6);
    for (let n = 1; n <= nP; n++) {
      if (f * n > 9000) break;
      const os = v.osc('sine', f * n, t, end), g = v.gain(1 / Math.pow(n, 1.15));
      os.detune.value = (eng.rand() - 0.5) * 7; os.connect(g); g.connect(env);
    }
    env.connect(v.out);
    envAdsr(env.gain, t, vel * num(o.gain, 0.3), att, 0, 1, dur, rel);
    return v.end();
  };

  // breathy whisper (swept band noise with slow swell)
  V.whisper = function (eng, dest, t, o) {
    const dur = Math.max(0.4, num(o.dur, 1.6)), vel = num(o.vel, 0.5), f0 = num(o.f0, 1700), f1 = num(o.f1, 3300);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.2, env = v.gain(0.0001);
    const nz = v.noise('pink', t, end), bp = v.filter('bandpass', f0, num(o.q, 3.5)), bp2 = v.filter('bandpass', 2600, 1.4);
    bp.frequency.setValueAtTime(f0, t); bp.frequency.linearRampToValueAtTime(f1, t + dur);
    nz.connect(bp); bp.connect(bp2); bp2.connect(env); env.connect(v.out);
    const peak = vel * num(o.gain, 0.5), tp = t + dur * 0.42;
    env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(peak, tp);
    env.gain.setValueAtTime(peak, tp); env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    return v.end();
  };

  // ---- drums
  V.kick = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.8), f0 = num(o.f0, 135), f1 = num(o.f, 48), dur = num(o.dur, 0.36);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.06, os = v.osc('sine', f0, t, end);
    os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    const g = v.gain(0.0001), sh = v.shaper(eng.curves.soft), post = v.gain(0.75);
    os.connect(g); g.connect(sh); sh.connect(post); post.connect(v.out);
    envPerc(g.gain, t, vel * 0.48, 0.002, dur);
    const nz = v.noise('white', t, t + 0.03), hp = v.filter('highpass', 2500, 0.7), ng = v.gain(0.0001);
    nz.connect(hp); hp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.11, 0.0005, 0.01);
    return v.end();
  };

  V.snare = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.7), dur = num(o.dur, 0.2), tone = num(o.f, 190);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.3;
    const nz = v.noise('white', t, end), hp = v.filter('highpass', 800, 0.7), bp = v.filter('bandpass', 3200, 0.6), ng = v.gain(0.0001);
    nz.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.48, 0.001, dur);
    const b = v.osc('triangle', tone * 1.25, t, end), bg = v.gain(0.0001);
    b.frequency.setValueAtTime(tone * 1.25, t); b.frequency.exponentialRampToValueAtTime(tone * 0.8, t + 0.07);
    b.connect(bg); bg.connect(v.out); envPerc(bg.gain, t, vel * 0.37, 0.001, 0.11);
    const nz2 = v.noise('white', t, end), hp2 = v.filter('highpass', 5200, 0.7), rg = v.gain(0.0001);
    nz2.connect(hp2); hp2.connect(rg); rg.connect(v.out); envPerc(rg.gain, t, vel * 0.14, 0.002, dur * 1.4);
    return v.end();
  };

  V.hat = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.5), dur = o.open ? num(o.dur, 0.26) : num(o.dur, 0.05);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.05;
    const nz = v.noise('white', t, end), hp = v.filter('highpass', 7200, 0.7), bp = v.filter('bandpass', num(o.f, 10500), 0.6), ng = v.gain(0.0001);
    nz.connect(hp); hp.connect(bp); bp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.42, 0.001, dur);
    return v.end();
  };

  V.tom = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.7), f = num(o.f, 110), dur = num(o.dur, 0.42);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.06, os = v.osc('sine', f * 1.6, t, end), g = v.gain(0.0001);
    os.frequency.setValueAtTime(f * 1.6, t); os.frequency.exponentialRampToValueAtTime(f, t + 0.07);
    os.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * 0.42, 0.002, dur);
    const nz = v.noise('white', t, t + 0.05), bp = v.filter('bandpass', 1800, 1.2), ng = v.gain(0.0001);
    nz.connect(bp); bp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.07, 0.001, 0.025);
    return v.end();
  };

  V.timp = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.8), f = num(o.f, 65), dur = num(o.dur, 1.8);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.1;
    [[1, 1, 1], [1.504, 0.5, 0.7], [1.99, 0.3, 0.5], [2.52, 0.16, 0.34]].forEach(function (p, i) {
      const os = v.osc('sine', f * p[0], t, end), g = v.gain(0.0001);
      if (i === 0) { os.frequency.setValueAtTime(f * 1.1, t); os.frequency.exponentialRampToValueAtTime(f, t + 0.14); }
      os.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * 0.34 * p[1], 0.003, dur * p[2]);
    });
    const nz = v.noise('brown', t, t + 0.12), lp = v.filter('lowpass', 420, 0.7), ng = v.gain(0.0001);
    nz.connect(lp); lp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.38, 0.002, 0.07);
    return v.end();
  };

  V.clap = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.7);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + 0.32, nz = v.noise('white', t, end), bp = v.filter('bandpass', num(o.f, 1500), 1.3), g = v.gain(0.0001);
    nz.connect(bp); bp.connect(g); g.connect(v.out);
    const p = g.gain, pk = vel * 1.8;
    p.setValueAtTime(0.0001, t);
    for (let k = 0; k < 3; k++) { const tk = t + k * 0.013; p.linearRampToValueAtTime(pk * (0.7 + 0.1 * k), tk + 0.001); p.exponentialRampToValueAtTime(0.0003, tk + 0.012); p.setValueAtTime(0.0003, tk + 0.0125); }
    const t3 = t + 0.04; p.linearRampToValueAtTime(pk, t3 + 0.002); p.exponentialRampToValueAtTime(0.0001, t3 + 0.17);
    return v.end();
  };

  V.metal = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.6), f = num(o.f, 340), dur = num(o.dur, 0.9);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.1, bp = v.filter('bandpass', num(o.bp, 2600), 0.7), hp = v.filter('highpass', 500, 0.7), g = v.gain(0.0001);
    [1, 1.4832, 1.9318, 2.5463].forEach(function (r) { const os = v.osc('square', f * r, t, end), og = v.gain(0.22); os.connect(og); og.connect(bp); });
    bp.connect(hp); hp.connect(g); g.connect(v.out);
    envPerc(g.gain, t, vel * 0.42, 0.001, dur);
    return v.end();
  };

  V.click = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.6), f = num(o.f, 2400), dur = num(o.dur, 0.014);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.04, nz = v.noise('white', t, end), bp = v.filter('bandpass', f, num(o.q, 7)), g = v.gain(0.0001);
    nz.connect(bp); bp.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * num(o.gain, 4), 0.0005, dur);
    return v.end();
  };

  V.shaker = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.5), dur = num(o.dur, 0.07);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.06, nz = v.noise('white', t, end), hp = v.filter('highpass', num(o.hp, 5500), 0.7), bp = v.filter('bandpass', num(o.f, 8000), 0.6), g = v.gain(0.0001);
    nz.connect(hp); hp.connect(bp); bp.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * 0.32, num(o.att, 0.01), dur);
    return v.end();
  };

  V.crash = function (eng, dest, t, o) {
    const vel = num(o.vel, 0.6), dur = num(o.dur, 2.6);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.1, nz = v.noise('white', t, end), hp = v.filter('highpass', 3200, 0.7), g = v.gain(0.0001);
    const b1 = v.filter('bandpass', 6200, 0.5), b2 = v.filter('bandpass', 9400, 0.9), s = v.gain(0.0001);
    nz.connect(hp); hp.connect(g); hp.connect(b1); hp.connect(b2); b1.connect(s); b2.connect(s); g.connect(v.out); s.connect(v.out);
    envPerc(g.gain, t, vel * 0.14, 0.002, dur); envPerc(s.gain, t, vel * 0.165, 0.004, dur * 0.7);
    return v.end();
  };

  V.swell = function (eng, dest, t, o) {
    const dur = Math.max(0.3, num(o.dur, 2)), vel = num(o.vel, 0.5), f0 = num(o.f0, 400), f1 = num(o.f1, 9000);
    const v = mkv(eng, dest, t, o, 1); if (!v) return null;
    const end = t + dur + 0.2, nz = v.noise('white', t, end), bp = v.filter('bandpass', f0, num(o.q, 1.2)), g = v.gain(0.0001);
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    nz.connect(bp); bp.connect(g); g.connect(v.out);
    g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(vel * 0.43, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    return v.end();
  };

  V.boom = function (eng, dest, t, o) {
    const dur = num(o.dur, 2.6), vel = num(o.vel, 0.9), f = num(o.f, 48);
    const v = mkv(eng, dest, t, o, 2); if (!v) return null;
    const end = t + dur + 0.1, os = v.osc('sine', f * 1.6, t, end), g = v.gain(0.0001);
    os.frequency.setValueAtTime(f * 1.6, t); os.frequency.exponentialRampToValueAtTime(f * 0.62, t + 0.6);
    os.connect(g); g.connect(v.out); envPerc(g.gain, t, vel * 0.41, 0.004, dur);
    const nz = v.noise('brown', t, end), lp = v.filter('lowpass', 700, 0.8), ng = v.gain(0.0001);
    lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(90, t + dur * 0.6);
    nz.connect(lp); lp.connect(ng); ng.connect(v.out); envPerc(ng.gain, t, vel * 0.41, 0.003, dur * 0.8);
    const n2 = v.noise('white', t, t + 0.3), hp = v.filter('highpass', 1500, 0.7), cg = v.gain(0.0001);
    n2.connect(hp); hp.connect(cg); cg.connect(v.out); envPerc(cg.gain, t, vel * 0.14, 0.001, 0.18);
    return v.end();
  };

  // ------------------------------------------------------------------ public API
  A.settings = settings;
  A.engine = null;
  A.ctx = null;
  A.Voices = V;
  A.playVoice = function (name, eng, dest, t, o) { return V[name](eng, dest, t, o || {}); };
  A.createEngine = createEngine;
  A.kit = { clamp, num, mtof, ftom, dbtoa, hashStr, makeRng, envPerc, envAdsr, fadeParam, volToGain };

  const readyHooks = [];
  function fireReady() { const h = readyHooks.splice(0); for (const fn of h) { try { fn(); } catch (e) { console.warn('[audio] ready hook failed', e); } } }
  A.isReady = () => !!(A.ctx && A.ctx.state === 'running');
  A.onReady = function (fn) { if (A.isReady()) { try { fn(); } catch (e) { console.warn(e); } } else readyHooks.push(fn); };

  // Idempotent. Call from any user gesture (pointerdown / keydown / click).
  A.init = function () {
    try {
      if (A.ctx) {
        if (A.ctx.state !== 'running') { const p = A.ctx.resume(); if (p && p.then) p.then(() => { if (A.ctx.state === 'running') fireReady(); }, noop); }
        return A.ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      let ctx;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
      A.ctx = ctx;
      A.engine = createEngine(ctx, {});
      ctx.addEventListener('statechange', () => { if (ctx.state === 'running') fireReady(); });
      try { const p = ctx.resume(); if (p && p.then) p.then(() => { if (ctx.state === 'running') fireReady(); }, noop); } catch (e) { /* ignore */ }
      if (ctx.state === 'running') fireReady();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => { if (!document.hidden && A.ctx && A.ctx.state !== 'running') { try { A.ctx.resume(); } catch (e) { /* ignore */ } } });
      }
      return ctx;
    } catch (e) {
      console.warn('[audio] init failed', e);
      return null;
    }
  };

  A.unlock = function () { return A.init(); };    // alias: call from the first user gesture

  A.setVolume = function (kind, v) {
    if (kind !== 'music' && kind !== 'sfx') return;
    v = Number(v); if (!isFinite(v)) return;
    settings[kind] = clamp(v, 0, 1);
    saveSettings();
    if (A.engine) A.engine.setBusGains(false);
  };
  A.setMuted = function (b) {
    settings.muted = !!b;
    saveSettings();
    if (A.engine) A.engine.setBusGains(false);
  };

  A.stats = function () {
    const e = A.engine;
    if (!e) return null;
    return { state: e.ctx.state, voices: e.voices.size, nodes: e.nodeCount, baseNodes: e.baseNodes, created: e.stats.created, disposed: e.stats.disposed, stolen: e.stats.stolen, refused: e.stats.refused, peak: e.stats.peak, maxVoices: e.maxVoices };
  };

  // Render with an OfflineAudioContext: build(eng, ctx) schedules everything up front (fine for short sounds).
  A.offline = function (seconds, build, o) {
    o = o || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = o.sampleRate || 44100;
    const ctx = new OAC(2, Math.max(1, Math.ceil(seconds * sr)), sr);
    const eng = createEngine(ctx, { offline: true, unity: true, seed: o.seed });
    build(eng, ctx);
    return ctx.startRendering();
  };

  // Long renders: nodes are created window by window via suspend()/resume() so the graph stays small.
  // build(eng, t0, t1) must schedule everything that starts inside [t0, t1).
  A.renderWindowed = function (seconds, o, build) {
    o = o || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = o.sampleRate || 44100;
    const len = Math.max(128, Math.ceil(seconds * sr)), ctx = new OAC(2, len, sr);
    const eng = createEngine(ctx, { offline: true, unity: true, seed: o.seed, maxVoices: o.maxVoices });
    const winS = 128 * Math.max(1, Math.round((o.window || 1.5) * sr / 128)), win = winS / sr;
    if (o.setup) o.setup(eng, ctx);
    eng.vnow = 0; build(eng, 0, Math.min(win, seconds));
    for (let k = 1; k * winS < len - 128; k++) {
      const ts = k * winS / sr;
      ctx.suspend(ts).then(() => { eng.vnow = ts; eng.sweep(ts); build(eng, ts, Math.min(ts + win, seconds)); ctx.resume(); });
    }
    return ctx.startRendering().then(function (buf) { if (o.teardown) o.teardown(eng); return buf; });
  };
})(window.MOO);
