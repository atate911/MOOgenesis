/* ============================================================================
   Master of Orion — Reborn · js/gfx/fx.js
   MOO.Gfx.Fx — additive particle / effect system for tactical combat and map events.

   const fx = MOO.Gfx.Fx.create();   fx.update(dt);  fx.draw(ctx);
   Spawners (canvas px, optional o.scale):
     explosion(x,y,size,o{kind:'fire'|'plasma'|'energy'|'nova'}) · debris(x,y,n) · sparks(x,y,n,color)
     beam(x1,y1,x2,y2,kind,dur,o) -> handle{done,x1,y1,x2,y2}   kinds: laser neutron disruptor phasor plasma deathray mass
     missile(x1,y1,x2,y2,speed,kind,o) -> handle{done,x,y,onHit}  kinds: nuclear hyperx merculite scatter stinger torpedo antimatter
     shieldHit(x,y,r,angle,color) · warpFlash(x,y,size,o) · novaBlast(x,y,r) · planetImpact(x,y,r) · pulse(x,y,r,color)
     shockwave(x,y,r,color)  — kill ring: a bright expanding rim with a dark refraction band behind it (normal blend), a flash and sparks
   Design: every visual is a pre-baked white/tinted sprite drawn with additive blending ('lighter');
   particles and entities live in fixed pools (no allocation in update/draw).
   ========================================================================== */
(function (M) {
  'use strict';

  const PI = Math.PI, TAU = PI * 2;
  const sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max;
  const floor = Math.floor, hypot = Math.hypot, pow = Math.pow, rand = Math.random;
  const NO = {};

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rr(a, b) { return a + (b - a) * rand(); }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = max(1, w | 0); c.height = max(1, h | 0); return c; }
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function tone(c, k) { return k >= 0 ? mixc(c, [255, 255, 255], k) : mixc(c, [0, 0, 20], -k); }
  function rgba(c, a) { return 'rgba(' + ((c[0] + 0.5) | 0) + ',' + ((c[1] + 0.5) | 0) + ',' + ((c[2] + 0.5) | 0) + ',' + a + ')'; }
  function parseColor(c) {
    if (Array.isArray(c)) return c;
    c = String(c || '');
    let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
    if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
    m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return [255, 220, 160];
  }

  // ==========================================================================
  // 1. sprite sets (baked once, shared by every system)
  // ==========================================================================
  const setCache = new Map();
  function colorSet(c) {
    const key = ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0);
    let s = setCache.get(key);
    if (s) return s;
    if (setCache.size > 160) setCache.clear();
    const W = [255, 255, 255], hot = tone(c, 0.55);
    s = { c: c };
    // soft round glow
    let cv = mk(64, 64), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(W, 1)); gr.addColorStop(0.09, rgba(hot, 0.95)); gr.addColorStop(0.3, rgba(c, 0.55)); gr.addColorStop(0.66, rgba(c, 0.14)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    s.glow = cv;
    // tight hot core
    cv = mk(64, 64); g = cv.getContext('2d'); gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, rgba(W, 1)); gr.addColorStop(0.2, rgba(hot, 0.9)); gr.addColorStop(0.5, rgba(c, 0.32)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    s.core = cv;
    // streak (elongated glow with a hot filament), drawn stretched along motion
    cv = mk(64, 16); g = cv.getContext('2d');
    g.save(); g.translate(32, 8); g.scale(1, 0.26);
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 32);
    gr.addColorStop(0, rgba(W, 1)); gr.addColorStop(0.22, rgba(hot, 0.85)); gr.addColorStop(0.6, rgba(c, 0.32)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 32, 0, TAU); g.fill(); g.restore();
    const lg = g.createLinearGradient(6, 0, 58, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(6, 6.6, 52, 2.8);
    s.streak = cv;
    // beam cross-section (stretched along the beam)
    cv = mk(4, 64); g = cv.getContext('2d'); gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.28, rgba(c, 0.4)); gr.addColorStop(0.44, rgba(hot, 0.92)); gr.addColorStop(0.5, rgba(W, 1)); gr.addColorStop(0.56, rgba(hot, 0.92)); gr.addColorStop(0.72, rgba(c, 0.4)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    s.beam = cv;
    // shock ring
    cv = mk(128, 128); g = cv.getContext('2d'); gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(c, 0)); gr.addColorStop(0.68, rgba(c, 0)); gr.addColorStop(0.8, rgba(c, 0.22)); gr.addColorStop(0.9, rgba(hot, 0.7)); gr.addColorStop(0.94, rgba(W, 0.95)); gr.addColorStop(0.975, rgba(c, 0.45)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    s.ring = cv;
    // lens flare star
    cv = mk(256, 256); g = cv.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(128, 128); g.rotate(k * PI / 4 + (k % 2 ? 0.0 : 0)); g.scale(k % 2 ? 0.55 : 1, k % 2 ? 0.014 : 0.024);
      gr = g.createRadialGradient(0, 0, 0, 0, 0, 128);
      gr.addColorStop(0, rgba(W, k % 2 ? 0.5 : 0.95)); gr.addColorStop(0.3, rgba(hot, k % 2 ? 0.25 : 0.55)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 128, 0, TAU); g.fill(); g.restore();
    }
    gr = g.createRadialGradient(128, 128, 0, 128, 128, 70);
    gr.addColorStop(0, rgba(W, 0.95)); gr.addColorStop(0.3, rgba(hot, 0.5)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    s.flare = cv;
    setCache.set(key, s);
    return s;
  }
  function makeRamp(list) { return list.map(function (c) { return colorSet(c); }); }
  const RAMP_COLORS = {
    fire: [[255, 255, 255], [255, 246, 210], [255, 214, 120], [255, 162, 62], [236, 100, 32], [172, 52, 20], [92, 32, 18]],
    plasma: [[255, 255, 255], [214, 255, 255], [120, 235, 255], [60, 170, 255], [40, 100, 235], [30, 56, 170], [20, 30, 100]],
    energy: [[255, 255, 255], [255, 226, 255], [255, 150, 245], [226, 90, 255], [160, 62, 240], [102, 38, 190], [52, 22, 110]],
    nova: [[255, 255, 255], [236, 244, 255], [170, 208, 255], [128, 160, 255], [160, 120, 255], [112, 70, 210], [58, 34, 130]],
    acid: [[255, 255, 235], [236, 255, 170], [170, 255, 90], [100, 222, 60], [56, 160, 40], [34, 100, 30], [20, 56, 20]],
    ice: [[255, 255, 255], [220, 245, 255], [160, 220, 255], [110, 180, 255], [90, 130, 240]],
    anti: [[255, 255, 255], [250, 232, 255], [214, 170, 255], [170, 110, 255], [120, 70, 230], [70, 40, 170]]
  };
  const rampCache = {};
  function ramp(name) { return rampCache[name] || (rampCache[name] = makeRamp(RAMP_COLORS[name] || RAMP_COLORS.fire)); }
  const ramp1Cache = {}, ramp2Cache = {};
  function ramp1(name) { return ramp1Cache[name] || (ramp1Cache[name] = ramp(name).slice(1)); }
  function ramp2(name) { return ramp2Cache[name] || (ramp2Cache[name] = ramp(name).slice(2)); }

  const SMOKE = [];
  function smokeSprites() {
    if (SMOKE.length) return SMOKE;
    const tints = [[104, 84, 70], [92, 96, 108], [64, 74, 106], [86, 66, 110]];
    for (let t = 0; t < tints.length; t++) {
      const c = mk(64, 64), g = c.getContext('2d');
      let seed = 33 + t * 17;
      const r = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 12; i++) {
        const x = 32 + (r() - 0.5) * 24, y = 32 + (r() - 0.5) * 24, rad = 9 + r() * 14;
        const gr = g.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, rgba(tints[t], 0.3)); gr.addColorStop(1, rgba(tints[t], 0));
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
      SMOKE.push(c);
    }
    return SMOKE;
  }
  const SHARDS = [];
  function shardSprites() {
    if (SHARDS.length) return SHARDS;
    let seed = 91;
    const r = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let v = 0; v < 5; v++) {
      const c = mk(32, 32), g = c.getContext('2d'), n = 4 + (v % 3), pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * TAU + r() * 0.5, rad = 7 + r() * 8; pts.push(16 + cos(a) * rad * (v % 2 ? 1.5 : 1), 16 + sin(a) * rad * 0.7); }
      g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath();
      const gr = g.createLinearGradient(4, 4, 28, 28);
      gr.addColorStop(0, 'rgb(150,156,176)'); gr.addColorStop(0.5, 'rgb(72,76,94)'); gr.addColorStop(1, 'rgb(26,28,40)');
      g.fillStyle = gr; g.fill();
      g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,190,110,0.85)'; g.stroke();
      SHARDS.push(c);
    }
    return SHARDS;
  }
  // soft hex lattice for shield hits (white lines, disc of radius r px), cached per radius bucket
  const latticeCache = new Map();
  function lattice(rb) {
    let c = latticeCache.get(rb);
    if (c) return c;
    if (latticeCache.size > 24) latticeCache.clear();
    const N = rb * 2 + 4;
    c = mk(N, N);
    const g = c.getContext('2d');
    g.translate(N / 2, N / 2);
    g.beginPath(); g.arc(0, 0, rb - 0.5, 0, TAU); g.clip();
    const s = clamp(rb * 0.13, 6, 22), hx = s * 1.5, hy = s * sqrt(3);
    g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = max(1.4, rb * 0.017);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath();
    for (let i = -ceil(rb / hx) - 1; i <= ceil(rb / hx) + 1; i++) {
      for (let j = -ceil(rb / hy) - 1; j <= ceil(rb / hy) + 1; j++) {
        const px = i * hx, py = (j + (i & 1 ? 0.5 : 0)) * hy;
        for (let k = 0; k < 6; k++) { const a = k * PI / 3, qx = px + cos(a) * s, qy = py + sin(a) * s; if (k) g.lineTo(qx, qy); else g.moveTo(qx, qy); }
        g.closePath();
      }
    }
    g.stroke(); g.fill();
    latticeCache.set(rb, c);
    return c;
  }
  function ceil(v) { return Math.ceil(v); }
  let scratch = null;
  function scratchCanvas(n) {
    if (!scratch) scratch = mk(256, 256);
    if (scratch.width < n || scratch.height < n) { scratch.width = max(scratch.width, n); scratch.height = max(scratch.height, n); }
    return scratch;
  }

  // ==========================================================================
  // 2. beam / missile tables
  // ==========================================================================
  const BEAMS = {
    laser:     { col: [255, 78, 66],   w: 2.4, glow: 10, dur: 0.34, muz: 15, imp: 18, rate: 38, ramp: 'fire' },
    neutron:   { col: [140, 255, 92],  w: 4.6, glow: 17, dur: 0.5,  muz: 20, imp: 26, rate: 60, ramp: 'acid' },
    disruptor: { col: [186, 108, 255], w: 3.0, glow: 20, dur: 0.58, muz: 20, imp: 26, rate: 80, ramp: 'energy' },
    phasor:    { col: [90, 222, 255],  w: 3.4, glow: 16, dur: 0.62, muz: 22, imp: 28, rate: 70, ramp: 'plasma' },
    plasma:    { col: [255, 146, 48],  w: 8.5, glow: 30, dur: 0.72, muz: 30, imp: 44, rate: 90, ramp: 'fire' },
    deathray:  { col: [206, 164, 255], w: 17,  glow: 78, dur: 1.5,  muz: 76, imp: 96, rate: 170, ramp: 'anti' },
    mass:      { col: [255, 214, 140], w: 2.6, glow: 9,  dur: 0.58, muz: 13, imp: 13, rate: 34, ramp: 'fire' }
  };
  const MISSILES = {
    nuclear:    { col: [255, 190, 90],  speed: 1.0,  size: 1.5,  trail: 'smoke', flame: 'fire',   blast: 'fire',   blastSize: 74, tint: 0, turn: 0.5 },
    hyperx:     { col: [150, 210, 255], speed: 1.55, size: 1.2,  trail: 'streak', flame: 'plasma', blast: 'plasma', blastSize: 52, tint: 2, turn: 0.35 },
    merculite:  { col: [170, 255, 100], speed: 1.05, size: 1.45, trail: 'smoke', flame: 'acid',   blast: 'acid',   blastSize: 62, tint: 1, turn: 0.5 },
    scatter:    { col: [255, 160, 90],  speed: 1.2,  size: 0.95,  trail: 'smoke', flame: 'fire',   blast: 'fire',   blastSize: 34, tint: 0, turn: 0.3, cluster: 5 },
    stinger:    { col: [255, 96, 80],   speed: 1.9,  size: 0.8,  trail: 'streak', flame: 'fire',  blast: 'fire',   blastSize: 26, tint: 0, turn: 0.25 },
    torpedo:    { col: [140, 200, 255], speed: 0.62, size: 2.0,  trail: 'glow',  flame: 'plasma', blast: 'plasma', blastSize: 92, tint: 2, turn: 0.4 },
    antimatter: { col: [214, 160, 255], speed: 0.8,  size: 1.9,  trail: 'glow',  flame: 'anti',   blast: 'nova',   blastSize: 124, tint: 3, turn: 0.35 }
  };

  // ==========================================================================
  // 3. the system
  // ==========================================================================
  function Particle() {
    this.kind = 0; this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.life = 0; this.max = 1;
    this.s0 = 1; this.s1 = 1; this.a0 = 1; this.rot = 0; this.vr = 0; this.drag = 0; this.ramp = null; this.tint = 0; this.v = 0;
  }
  function Entity() {
    this.type = 0; this.age = 0; this.dur = 1; this.delay = 0; this.x = 0; this.y = 0; this.x2 = 0; this.y2 = 0;
    this.r = 0; this.r1 = 0; this.a = 0; this.a1 = 0; this.set = null; this.ramp = null; this.h = null; this.kind = null; this.cfg = null;
    this.acc = 0; this.acc2 = 0; this.n = 0; this.m = 0; this.flag = 0; this.sc = 1; this.pts = null; this.t0 = 0;
    this.ix = null; this.iy = null; this.it = null; this.css0 = ''; this.css1 = '';
  }
  const E_RING = 1, E_FLASH = 2, E_FLARE = 3, E_BEAM = 4, E_MISSILE = 5, E_SHIELD = 6, E_WARP = 7, E_PULSE = 8, E_PLANET = 9, E_GLOW = 10, E_RAYS = 11, E_SHOCK = 12;

  function create(opts) {
    opts = opts || NO;
    const MAXP = opts.maxParticles || 6000, MAXE = opts.maxEntities || 400;
    const liveA = [], liveN = [], free = [], ents = [], efree = [];
    let total = 0, etotal = 0, quality = 1;
    const sys = { shake: 0, flash: 0, quality: 1 };
    smokeSprites(); shardSprites();

    // ---- pools ----
    function newP() { const p = free.pop(); if (p) return p; if (total >= MAXP) return null; total++; return new Particle(); }
    function newE(type, dur) {
      let e = efree.pop();
      if (!e) { if (etotal >= MAXE) return null; etotal++; e = new Entity(); }
      e.type = type; e.age = 0; e.dur = dur; e.delay = 0; e.h = null; e.flag = 0; e.acc = 0; e.acc2 = 0; e.n = 0; e.sc = 1; e.t0 = 0;
      ents.push(e);
      return e;
    }
    function addGlow(x, y, vx, vy, life, s0, s1, a0, rp, drag) {
      const p = newP(); if (!p) return null;
      p.kind = 0; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s0 = s0; p.s1 = s1; p.a0 = a0; p.ramp = rp; p.drag = drag || 0; p.rot = 0; p.vr = 0;
      liveA.push(p); return p;
    }
    function addSpark(x, y, vx, vy, life, len, wid, a0, rp, drag) {
      const p = newP(); if (!p) return null;
      p.kind = 1; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s0 = len; p.s1 = wid; p.a0 = a0; p.ramp = rp; p.drag = drag || 0; p.rot = 0; p.vr = 0;
      liveA.push(p); return p;
    }
    function addSmoke(x, y, vx, vy, life, s0, s1, a0, tint, drag) {
      const p = newP(); if (!p) return null;
      p.kind = 2; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s0 = s0; p.s1 = s1; p.a0 = a0; p.tint = tint; p.drag = drag || 0; p.rot = 0; p.vr = 0;
      liveN.push(p); return p;
    }
    function addShard(x, y, vx, vy, life, size, vr) {
      const p = newP(); if (!p) return null;
      p.kind = 3; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.s0 = size; p.a0 = 1; p.drag = 0.5; p.rot = rand() * TAU; p.vr = vr; p.v = (rand() * 5) | 0;
      liveN.push(p); return p;
    }
    function addRing(x, y, r0, r1, set, dur, a0, delay) {
      const e = newE(E_RING, dur); if (!e) return null;
      e.x = x; e.y = y; e.r = r0; e.r1 = r1; e.set = set; e.a = a0 === undefined ? 0.85 : a0; e.delay = delay || 0;
      return e;
    }
    function addFlash(x, y, r, set, dur, a0) {
      const e = newE(E_FLASH, dur); if (!e) return null;
      e.x = x; e.y = y; e.r = r; e.set = set; e.a = a0 === undefined ? 1 : a0;
      return e;
    }
    function addFlare(x, y, r, set, dur, a0, rot) {
      const e = newE(E_FLARE, dur); if (!e) return null;
      e.x = x; e.y = y; e.r = r; e.set = set; e.a = a0 === undefined ? 0.8 : a0; e.a1 = rot || 0;
      return e;
    }
    function shakeAdd(v) { sys.shake = min(34, max(sys.shake, v)); }

    // ---- explosions ----
    function explosion(x, y, size, o) {
      o = o || NO;
      const s = (size || 40) * (o.scale || 1), kind = o.kind || 'fire', q = quality;
      const R = ramp(kind), nR = R.length;
      const energy = kind === 'energy', nova = kind === 'nova';
      addFlash(x, y, s * (nova ? 2.4 : 1.7), R[1], nova ? 0.34 : 0.16, 0.95);   // stage 1: the flash (~60 ms core)
      addFlash(x, y, s * 0.7, R[0], 0.06, 1);
      addRing(x, y, s * 0.18, s * (nova ? 2.6 : 1.9), R[2], nova ? 0.8 : 0.55, 0.9);   // stage 4 (ring) overlaps the fireball
      if (s >= 46) { const pl = newE(E_GLOW, 0.4); if (pl) { pl.x = x; pl.y = y; pl.r = s * 2.2; pl.set = R[2]; pl.a = 0.4; } }   // point light on nearby hulls
      if (energy) addRing(x, y, s * 0.1, s * 1.5, R[1], 0.45, 0.7, 0.05);
      if (nova) { addRing(x, y, s * 0.1, s * 1.9, R[1], 0.7, 0.8, 0.1); addRing(x, y, s * 0.1, s * 1.2, R[0], 0.55, 0.8, 0.2); }
      if (s >= 46) addFlare(x, y, s * (nova ? 4.5 : 3), R[1], 0.4, 0.7, rand() * 0.3);
      // fireball puffs (start already pale-yellow so the cloud reads orange, not white)
      const R1 = ramp1(kind), R2 = ramp2(kind);
      const nf = min(48, ((10 + s * 0.28) * q) | 0);
      for (let i = 0; i < nf; i++) {
        const a = rand() * TAU, d = rand() * s * 0.3, sp = (0.25 + rand() * 1.4) * s;
        addGlow(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, 0.7 + rand() * 0.85, s * rr(0.2, 0.4), s * rr(0.7, 1.3), 0.95, R1, 2.3);
      }
      for (let i = 0; i < 4; i++) addGlow(x + rr(-0.1, 0.1) * s, y + rr(-0.1, 0.1) * s, 0, 0, 1.0 + rand() * 0.7, s * 0.4, s * rr(0.9, 1.2), 0.85, R1, 0);
      // lingering embers
      const ne = min(44, ((8 + s * 0.24) * q) | 0);
      for (let i = 0; i < ne; i++) {
        const a = rand() * TAU, sp = rr(0.12, 1.1) * s;
        addGlow(x, y, cos(a) * sp, sin(a) * sp, rr(1.1, 2.5), rr(2.2, 4.4), 1.0, 0.95, R2, 0.8);
      }
      // sparks
      const ns = min(80, ((12 + s * (energy ? 0.8 : 0.5)) * q) | 0);
      for (let i = 0; i < ns; i++) {
        const a = rand() * TAU, sp = s * (2 + rand() * 7);
        addSpark(x, y, cos(a) * sp, sin(a) * sp, 0.4 + rand() * 0.9, 12 + s * 0.4 * (0.3 + rand()), 1.2 + s * 0.012, 1, R, 1.0);
      }
      // smoke
      if (!energy && q > 0.4) {
        const nm = min(18, ((4 + s * 0.09) * q) | 0), tint = o.tint !== undefined ? o.tint : (kind === 'plasma' ? 2 : nova ? 3 : kind === 'acid' ? 1 : 0);
        for (let i = 0; i < nm; i++) {
          const a = rand() * TAU, sp = rr(0.1, 0.65) * s;
          addSmoke(x + cos(a) * s * 0.2, y + sin(a) * s * 0.2, cos(a) * sp, sin(a) * sp, rr(2.0, 4.0), s * rr(0.25, 0.45), s * rr(0.9, 1.5), 0.7, tint, 1.1);
        }
      }
      if (!energy && !nova && o.debris !== false) debris(x, y, min(12, (s * 0.07 * q) | 0), s);
      shakeAdd(s * (nova ? 0.14 : 0.05));
      sys.flash = max(sys.flash, nova ? 0.5 : s > 90 ? 0.18 : 0);
    }
    function debris(x, y, n, size) {
      const s = size || 40;
      n = min(n | 0, 24);
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU, sp = rr(0.6, 2.6) * (s + 30) * 1.3;
        addShard(x, y, cos(a) * sp, sin(a) * sp, rr(0.9, 1.9), rr(5, 11) * max(1, sqrt(s / 50)), rr(-9, 9));
        if (i % 2 === 0) addGlow(x, y, cos(a) * sp * 0.8, sin(a) * sp * 0.8, rr(0.25, 0.5), rr(4, 8), 1, 0.8, ramp('fire'), 1);
      }
    }
    function sparks(x, y, n, color) {
      const set = colorSet(parseColor(color || [255, 220, 150])), rp = [set, set];
      n = min(n | 0, 120);
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU, sp = rr(80, 420);
        addSpark(x, y, cos(a) * sp, sin(a) * sp, rr(0.25, 0.7), rr(7, 18), 2.2, 1, rp, 1.4);
      }
      addFlash(x, y, 14, set, 0.12, 0.9);
    }
    function novaBlast(x, y, r) {
      r = r || 120;
      const R = ramp('nova'), q = quality;
      addFlash(x, y, r * 2.8, R[1], 0.5, 1);
      addFlash(x, y, r * 1.0, R[0], 0.25, 1);
      addRing(x, y, r * 0.1, r * 2.3, R[1], 0.9, 0.95);
      addRing(x, y, r * 0.1, r * 1.7, R[2], 0.75, 0.85, 0.1);
      addRing(x, y, r * 0.1, r * 1.1, R[0], 0.6, 0.85, 0.22);
      addFlare(x, y, r * 6, R[1], 0.7, 0.85, 0);
      addFlare(x, y, r * 4, R[0], 0.5, 0.6, 0.5);
      const e = newE(E_GLOW, 1.7); if (e) { e.x = x; e.y = y; e.r = r * 1.7; e.set = R[2]; e.a = 0.55; }
      for (let i = 0; i < min(34, (28 * q) | 0); i++) {
        const a = rand() * TAU, d = rand() * r * 0.3, sp = rr(0.2, 1.6) * r * 1.3;
        addGlow(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, rr(0.6, 1.4), r * rr(0.2, 0.4), r * rr(0.7, 1.3), 0.95, R, 1.4);
      }
      for (let i = 0; i < min(110, (90 * q) | 0); i++) {
        const a = rand() * TAU, sp = r * (3 + rand() * 8);
        addSpark(x, y, cos(a) * sp, sin(a) * sp, rr(0.5, 1.4), 10 + r * 0.25 * rand(), 2.6 + r * 0.02, 1, R, 0.9);
      }
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + rand() * 0.2, sp = r * 9; addSpark(x, y, cos(a) * sp, sin(a) * sp, rr(0.6, 1.0), r * 0.7, 3.4, 1, R, 1.6); }
      if (q > 0.4) for (let i = 0; i < 14; i++) { const a = rand() * TAU, sp = r * rr(0.2, 0.8); addSmoke(x, y, cos(a) * sp, sin(a) * sp, rr(1.6, 3), r * 0.3, r * 1.2, 0.5, 3, 1); }
      shakeAdd(r * 0.2); sys.flash = max(sys.flash, 0.8);
    }
    function planetImpact(x, y, r) {
      r = r || 60;
      const e = newE(E_PLANET, 2.2); if (!e) return;
      e.x = x; e.y = y; e.r = r; e.set = colorSet([255, 96, 30]); e.ramp = ramp('fire');
      if (!e.ix) { e.ix = new Float32Array(8); e.iy = new Float32Array(8); e.it = new Float32Array(8); }
      e.n = 6 + ((rand() * 3) | 0); e.m = 0;
      for (let i = 0; i < e.n; i++) {
        const a = rand() * TAU, d = sqrt(rand()) * r * 0.82;
        e.ix[i] = cos(a) * d; e.iy[i] = sin(a) * d; e.it[i] = i * rr(0.1, 0.22) + rand() * 0.15;
      }
      shakeAdd(r * 0.05);
    }
    function pulse(x, y, r, color) {
      const set = colorSet(parseColor(color || [98, 216, 255]));
      const e = newE(E_PULSE, 1.5); if (!e) return;
      e.x = x; e.y = y; e.r = r || 120; e.set = set;
    }
    function shockwave(x, y, r, color) {
      r = r || 80;
      const set = colorSet(parseColor(color || [255, 220, 160]));
      addRing(x, y, r * 0.12, r, set, 0.42, 0.95);
      addFlash(x, y, r * 0.45, WHITE, 0.08, 0.85);
      const e = newE(E_SHOCK, 0.46); if (e) { e.x = x; e.y = y; e.r = r; e.set = set; }
      for (let i = 0; i < min(14, (12 * quality) | 0); i++) { const a = rand() * TAU, sp = r * rr(1.6, 3.2); addSpark(x, y, cos(a) * sp, sin(a) * sp, rr(0.2, 0.45), rr(8, 18), 1.8, 0.9, [WHITE, set], 1.6); }
      shakeAdd(r * 0.04);
    }
    function warpFlash(x, y, size, o) {
      o = o || NO;
      const set = colorSet(parseColor(o.color || [190, 225, 255])), s = (size || 50) * (o.scale || 1);
      const e = newE(E_WARP, 0.7); if (!e) return;
      e.x = x; e.y = y; e.r = s; e.set = set; e.a = o.angle === undefined ? rr(-0.5, 0.5) : o.angle; e.flag = o.mode === 'out' ? 1 : 0;
      const w = colorSet([255, 255, 255]);
      for (let i = 0; i < 14; i++) { const d = rr(-1, 1) * s * 1.4; addSpark(x + cos(e.a) * d, y + sin(e.a) * d, cos(e.a) * rr(-300, 300) * 0.0 + rr(-40, 40), rr(-40, 40), rr(0.25, 0.6), rr(8, 20), 2, 0.9, [w, set], 0.6); }
      shakeAdd(s * 0.02);
    }

    // ---- beams ----
    const WHITE = colorSet([255, 255, 255]);
    function beam(x1, y1, x2, y2, kind, dur, o) {
      o = o || NO;
      const cfg = BEAMS[kind] || BEAMS.laser, sc = o.scale || 1;
      const h = { done: false, x1: x1, y1: y1, x2: x2, y2: y2, kind: kind || 'laser', stop: null, _e: null };
      const e = newE(E_BEAM, dur || cfg.dur);
      if (!e) { h.done = true; return h; }
      e.h = h; h._e = e; e.cfg = cfg; e.sc = sc; e.kind = kind in BEAMS ? kind : 'laser'; e.t0 = rand() * 10; e.acc = 0; e.acc2 = 1; e.n = 0;
      e.set = colorSet(o.color ? parseColor(o.color) : cfg.col);
      e.ramp = [WHITE, e.set]; e.css0 = rgba(e.set.c, 1); e.css1 = rgba(tone(e.set.c, 0.3), 1);
      if (!e.pts) e.pts = new Float32Array(2 * 80);
      h.stop = function () { const en = h._e; if (en && en.h === h) en.dur = min(en.dur, en.age + 0.06); };
      // muzzle burst
      const a = atan2(y2 - y1, x2 - x1);
      for (let i = 0; i < 5; i++) { const aa = a + rr(-0.5, 0.5), sp = rr(60, 200); addSpark(x1, y1, cos(aa) * sp, sin(aa) * sp, rr(0.1, 0.28), rr(5, 11), 2, 0.9, e.ramp, 1.5); }
      return h;
    }
    function stepBeam(e, dt) {
      const h = e.h, cfg = e.cfg;
      e.age += dt;
      if (e.age >= e.dur || h.done) {
        const early = !h.done || e.age < e.dur;
        h.done = true;
        if (early) {
          if (e.kind === 'plasma') explosion(h.x2, h.y2, 36 * e.sc, { kind: 'plasma', debris: false });
          else if (e.kind === 'deathray') explosion(h.x2, h.y2, 92 * e.sc, { kind: 'nova' });
        }
        return false;
      }
      const dx = h.x2 - h.x1, dy = h.y2 - h.y1, ang = atan2(dy, dx);
      e.acc += dt * cfg.rate * (0.5 + 0.5 * quality) * e.sc;
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = ang + PI + rr(-1.15, 1.15), sp = rr(90, 400) * e.sc;
        addSpark(h.x2, h.y2, cos(a) * sp, sin(a) * sp, rr(0.18, 0.46), rr(6, 15) * e.sc, 2, 0.95, e.ramp, 1.5);
        if ((e.kind === 'plasma' || e.kind === 'deathray') && rand() < 0.4) addGlow(h.x2 + rr(-8, 8), h.y2 + rr(-8, 8), cos(a) * sp * 0.3, sin(a) * sp * 0.3, rr(0.25, 0.5), rr(8, 16) * e.sc, rr(16, 28) * e.sc, 0.8, ramp(cfg.ramp), 1);
      }
      if (e.kind === 'disruptor') {
        e.acc2 += dt;
        if (e.acc2 > 0.04) {
          e.acc2 = 0;
          const L = hypot(dx, dy), n = clamp((L / 11) | 0, 6, 76);
          e.n = n;
          const amp = (7 + L * 0.012) * e.sc;
          for (let i = 0; i <= n; i++) { const t = i / n, env = pow(sin(PI * t), 0.55); e.pts[2 * i] = t; e.pts[2 * i + 1] = (rand() - 0.5) * 2 * amp * env; }
        }
      }
      return true;
    }
    function stripe(ctx, bt, spr, x, y, a, len, wid) {
      xf(ctx, bt, x, y, a, len, wid);
      ctx.drawImage(spr, 0, -0.5, 1, 1);
    }
    function fract1(x) { return x - floor(x); }
    function drawBeam(ctx, bt, e) {
      const h = e.h, cfg = e.cfg, set = e.set, sc = e.sc, kind = e.kind;
      const x1 = h.x1, y1 = h.y1, dx = h.x2 - x1, dy = h.y2 - y1, L = hypot(dx, dy) || 1, a = atan2(dy, dx), ux = dx / L, uy = dy / L;
      const age = e.age, dur = e.dur;
      const fadeT = min(0.22, dur * 0.35), fade = age > dur - fadeT ? max(0, (dur - age) / fadeT) : 1;
      const grow = min(1, age / min(0.07, dur * 0.25)), Lh = L * grow;
      const pul = 1 + 0.12 * sin(age * 52 + e.t0), w = cfg.w * sc, gw = cfg.glow * sc, flk = 0.9 + 0.1 * sin(age * 73 + e.t0 * 3);   // slight flicker on the core
      // bloom: a wide, faint halo of the beam colour under everything (the 1/4-res blurred copy of the emissive layer, done cheaply)
      if (kind !== 'disruptor' && kind !== 'mass') { ctx.globalAlpha = fade * 0.14; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 2.8 * pul); }
      // muzzle + impact glows
      ctx.globalAlpha = fade * max(0, 1 - age * 4.5);
      ctx.drawImage(set.glow, x1 - cfg.muz * sc, y1 - cfg.muz * sc, cfg.muz * sc * 2, cfg.muz * sc * 2);
      if (grow >= 1 || kind === 'deathray') {
        const ir = cfg.imp * sc * (0.8 + 0.2 * sin(age * 47 + e.t0));
        ctx.globalAlpha = fade * 0.9;
        ctx.drawImage(set.glow, h.x2 - ir, h.y2 - ir, ir * 2, ir * 2);
        ctx.globalAlpha = fade * 0.8;
        ctx.drawImage(WHITE.core, h.x2 - ir * 0.42, h.y2 - ir * 0.42, ir * 0.84, ir * 0.84);
      }
      switch (kind) {
        case 'disruptor': {
          const n = e.n;
          if (n < 2) break;
          const px = -uy, py = ux;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          for (let pass = 0; pass < 3; pass++) {
            ctx.beginPath();
            const lim = max(1, (n * grow) | 0);
            for (let i = 0; i <= lim; i++) { const t = e.pts[2 * i], off = e.pts[2 * i + 1]; const X = x1 + dx * t + px * off, Y = y1 + dy * t + py * off; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
            if (pass === 0) { ctx.lineWidth = 16 * sc; ctx.strokeStyle = e.css0; ctx.globalAlpha = fade * 0.16; }
            else if (pass === 1) { ctx.lineWidth = 5.5 * sc; ctx.strokeStyle = e.css1; ctx.globalAlpha = fade * 0.65; }
            else { ctx.lineWidth = 1.8 * sc; ctx.strokeStyle = '#fff'; ctx.globalAlpha = fade; }
            ctx.stroke();
          }
          ctx.globalAlpha = fade * 0.4; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 1.2);
          break;
        }
        case 'phasor': {
          const nseg = clamp((Lh / 5) | 0, 4, 220), px = -uy, py = ux, A = 5.6 * sc;
          ctx.globalAlpha = fade * 0.5; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 1.5);
          ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
          for (let rib = 0; rib < 2; rib++) {
            ctx.beginPath();
            for (let i = 0; i <= nseg; i++) {
              const t = i / nseg, d = t * Lh, env = pow(sin(PI * min(1, d / L)), 0.35), off = sin(d * 0.085 - age * 36 + rib * PI) * A * env;
              const X = x1 + ux * d + px * off, Y = y1 + uy * d + py * off;
              if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
            }
            ctx.lineWidth = 3.4 * sc; ctx.strokeStyle = rib ? e.css1 : e.css0; ctx.globalAlpha = fade * 0.95; ctx.lineJoin = 'round'; ctx.stroke();
            ctx.lineWidth = 1.2 * sc; ctx.strokeStyle = '#fff'; ctx.globalAlpha = fade * 0.9; ctx.stroke();
          }
          ctx.globalAlpha = fade; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 0.9);
          break;
        }
        case 'plasma': {
          ctx.globalAlpha = fade * 0.55; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 1.8 * pul);
          ctx.globalAlpha = fade * 0.95; stripe(ctx, bt, set.beam, x1, y1, a, Lh, w * 3.2 * pul);
          ctx.globalAlpha = fade; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 1.5 * pul);
          ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
          for (let k = 0; k < 9; k++) {
            const d = fract1(age * 1.7 + k / 9) * Lh, r = (11 + 5 * sin(age * 30 + k * 2)) * sc;
            ctx.globalAlpha = fade * 0.8; ctx.drawImage(set.glow, x1 + ux * d - r, y1 + uy * d - r, r * 2, r * 2);
          }
          break;
        }
        case 'deathray': {
          ctx.globalAlpha = fade * 0.45; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 2.1 * pul);
          ctx.globalAlpha = fade * 0.9; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * 0.75);
          ctx.globalAlpha = fade; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 1.8 * pul);
          ctx.globalAlpha = fade * 0.9; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 0.7);
          ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
          const nseg = clamp((Lh / 6) | 0, 6, 240), px = -uy, py = ux;
          for (let rib = 0; rib < 3; rib++) {
            ctx.beginPath();
            for (let i = 0; i <= nseg; i++) {
              const t = i / nseg, d = t * Lh, env = pow(sin(PI * min(1, d / L)), 0.4), off = sin(d * 0.045 - age * 24 + rib * TAU / 3) * 17 * sc * env;
              const X = x1 + ux * d + px * off, Y = y1 + uy * d + py * off;
              if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
            }
            ctx.lineWidth = 4 * sc; ctx.strokeStyle = rib === 1 ? '#fff' : e.css1; ctx.globalAlpha = fade * 0.75; ctx.lineJoin = 'round'; ctx.stroke();
          }
          for (let k = 0; k < 5; k++) { // rings travelling down the beam
            const f = fract1(age * 1.2 + k / 5), d = f * Lh, r = (30 + 20 * f) * sc;
            ctx.globalAlpha = fade * 0.6 * sin(PI * f); ctx.drawImage(set.ring, x1 + ux * d - r, y1 + uy * d - r, r * 2, r * 2);
          }
          ctx.globalAlpha = fade * 0.8; const fr = cfg.muz * 3.2 * sc; ctx.drawImage(set.flare, x1 - fr, y1 - fr, fr * 2, fr * 2);
          const fr2 = cfg.imp * 3.2 * sc; ctx.globalAlpha = fade * 0.7; ctx.drawImage(set.flare, h.x2 - fr2, h.y2 - fr2, fr2 * 2, fr2 * 2);
          break;
        }
        case 'mass': {
          ctx.globalAlpha = fade * 0.16; stripe(ctx, bt, set.beam, x1, y1, a, Lh, w * 2.4);
          for (let k = 0; k < 8; k++) {
            const f = fract1(age * 2.4 + k / 8), d = f * L;
            if (d > Lh) continue;
            ctx.globalAlpha = fade; xf(ctx, bt, x1 + ux * d, y1 + uy * d, a, 30 * sc, 6 * sc); ctx.drawImage(set.streak, -0.5, -0.5, 1, 1);
          }
          break;
        }
        case 'neutron': {
          ctx.globalAlpha = fade * 0.5; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * pul);
          ctx.globalAlpha = fade * 0.95; stripe(ctx, bt, set.beam, x1, y1, a, Lh, w * 3.2 * pul);
          ctx.globalAlpha = fade; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 1.2);
          ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
          for (let k = 0; k < 7; k++) {
            const d = fract1(age * 2.2 + k / 7) * Lh, r = 7 * sc;
            ctx.globalAlpha = fade * 0.85; ctx.drawImage(WHITE.core, x1 + ux * d - r, y1 + uy * d - r, r * 2, r * 2);
          }
          break;
        }
        default: { // laser
          ctx.globalAlpha = fade * 0.5; stripe(ctx, bt, set.beam, x1, y1, a, Lh, gw * pul);
          ctx.globalAlpha = fade * 0.95; stripe(ctx, bt, set.beam, x1, y1, a, Lh, w * 3.4 * pul);
          ctx.globalAlpha = fade * flk; stripe(ctx, bt, WHITE.beam, x1, y1, a, Lh, w * 1.2);
        }
      }
    }

    // ---- missiles ----
    function missile(x1, y1, x2, y2, speed, kind, o) {
      o = o || NO;
      const cfg = MISSILES[kind] || MISSILES.nuclear, sc = o.scale || 1;
      const h = { done: false, x: x1, y: y1, tx: x2, ty: y2, angle: 0, onHit: o.onHit || null, kind: kind in MISSILES ? kind : 'nuclear', stop: null, _e: null };
      const e = newE(E_MISSILE, 60);
      if (!e) { h.done = true; return h; }
      const d0 = hypot(x2 - x1, y2 - y1) || 1;
      e.h = h; h._e = e; e.cfg = cfg; e.sc = sc; e.x = x1; e.y = y1; e.r = (speed || 320) * cfg.speed; e.acc = d0; e.acc2 = 0; e.t0 = rand() * 10;
      e.a = atan2(y2 - y1, x2 - x1) + rr(-0.5, 0.5) * cfg.turn * 2; e.a1 = rr(-1, 1) * (o.arc !== undefined ? o.arc : 0.55);
      e.set = colorSet(cfg.col); e.ramp = ramp(cfg.flame); e.n = cfg.cluster || 0; e.css1 = rgba(tone(e.set.c, 0.5), 1);
      h.stop = function () { const en = h._e; if (en && en.h === h) { en.dur = en.age; h.done = true; } };
      h.angle = e.a;
      for (let i = 0; i < 5; i++) { const aa = e.a + rr(-0.6, 0.6), sp = rr(30, 110); addSpark(x1, y1, cos(aa) * sp, sin(aa) * sp, rr(0.1, 0.3), rr(5, 10), 2, 0.9, e.ramp, 1.5); }
      return h;
    }
    function stepMissile(e, dt) {
      const h = e.h, cfg = e.cfg, sz = cfg.size * e.sc;
      if (h.done) return false;
      e.age += dt;
      const dx = h.tx - e.x, dy = h.ty - e.y, d = hypot(dx, dy);
      const prog = 1 - clamp(d / e.acc, 0, 1), want = atan2(dy, dx) + e.a1 * pow(1 - prog, 1.6);
      let da = want - e.a; da = atan2(sin(da), cos(da));
      e.a += clamp(da, -9 * dt, 9 * dt);
      const sp = e.r * (0.38 + 0.62 * min(1, e.age / 0.5)), step = sp * dt;
      if (d <= step + 3 * e.sc || e.age > e.dur) {
        h.x = h.tx; h.y = h.ty; h.done = true;
        const f = h.onHit; h.onHit = null;
        if (f) { try { f(h); } catch (err) { if (typeof console !== 'undefined') console.error(err); } }
        const bs = cfg.blastSize * e.sc;
        if (cfg.cluster) {
          for (let i = 0; i < cfg.cluster; i++) { const a = rand() * TAU, dd = rand() * 20 * e.sc; explosion(h.tx + cos(a) * dd, h.ty + sin(a) * dd, bs * rr(0.7, 1.1), { kind: cfg.blast, debris: false }); }
        } else explosion(h.tx, h.ty, bs, { kind: cfg.blast });
        return false;
      }
      const ca = cos(e.a), sa = sin(e.a);
      e.x += ca * step; e.y += sa * step; h.x = e.x; h.y = e.y; h.angle = e.a;
      // trail
      e.acc2 += step;
      const every = cfg.trail === 'streak' ? 4 : cfg.trail === 'glow' ? 7 * sz : 6 * sz;
      let guard = 0;
      while (e.acc2 >= every && guard++ < 6) {
        e.acc2 -= every;
        const px = e.x - ca * e.acc2, py = e.y - sa * e.acc2;
        if (cfg.trail === 'smoke') {
          addSmoke(px, py, rr(-8, 8), rr(-8, 8), rr(0.7, 1.35), 3 * sz, 11 * sz, 0.4, cfg.tint, 1.3);
          addGlow(px, py, 0, 0, 0.16, 7 * sz, 2 * sz, 0.9, e.ramp, 0);
        } else if (cfg.trail === 'streak') {
          const p = addSpark(px, py, 0, 0, rr(0.25, 0.4), 22 * sz + 18, 2.4 * sz, 0.9, e.ramp, 0);
          if (p) p.rot = e.a;
          if (rand() < 0.5) addGlow(px, py, rr(-10, 10), rr(-10, 10), 0.3, 6 * sz, 2, 0.6, e.ramp, 0);
        } else {
          addGlow(px, py, rr(-14, 14), rr(-14, 14), rr(0.4, 0.7), 9 * sz, 17 * sz, 0.55, e.ramp, 1);
          if (rand() < 0.5) addSpark(px, py, rr(-80, 80), rr(-80, 80), rr(0.2, 0.4), rr(6, 12), 2, 0.9, e.ramp, 1.5);
        }
      }
      return true;
    }
    function drawMissile(ctx, bt, e) {
      const cfg = e.cfg, sz = cfg.size * e.sc, a = e.a, age = e.age, fl = 0.85 + 0.15 * sin(age * 70 + e.t0);
      const ca = cos(a), sa = sin(a), set = e.set;
      const heads = e.n > 1 ? e.n : 1;
      const prog = 1 - clamp(hypot(e.h.tx - e.x, e.h.ty - e.y) / e.acc, 0, 1);
      for (let k = 0; k < heads; k++) {
        let x = e.x, y = e.y;
        if (heads > 1) { const lat = (k - (heads - 1) / 2) * 7 * e.sc * sin(PI * clamp(prog * 1.1, 0, 1)); x += -sa * lat; y += ca * lat; }
        const fl2 = fl * (1 + k * 0.03);
        ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
        ctx.globalAlpha = 0.95;
        ctx.drawImage(set.glow, x - 11 * sz * fl2, y - 11 * sz * fl2, 22 * sz * fl2, 22 * sz * fl2);
        const len = 30 * sz * (0.8 + 0.4 * fl2), plume = 64 * sz * (0.75 + 0.35 * fl2);
        ctx.globalAlpha = 0.32;                                                   // exhaust plume: long, faint, flickering
        xf(ctx, bt, x - ca * plume * 0.5, y - sa * plume * 0.5, a, plume, 7 * sz);
        ctx.drawImage(e.ramp[min(3, e.ramp.length - 1)].streak, -0.5, -0.5, 1, 1);
        ctx.globalAlpha = 0.85;
        xf(ctx, bt, x - ca * len * 0.5, y - sa * len * 0.5, a, len, 9 * sz);
        ctx.drawImage(e.ramp[min(2, e.ramp.length - 1)].streak, -0.5, -0.5, 1, 1);
        ctx.globalAlpha = 1;
        xf(ctx, bt, x, y, a, 11 * sz, 3.6 * sz);
        ctx.drawImage(WHITE.streak, -0.5, -0.5, 1, 1);
      }
      ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
      if (cfg.trail === 'glow') { // torpedo / antimatter: crackling energy sphere
        const r = 10 * sz * 0.8;
        ctx.globalAlpha = 0.85; ctx.drawImage(WHITE.core, e.x - r * 0.9, e.y - r * 0.9, r * 1.8, r * 1.8);
        if (cfg.flame === 'anti') { const rg = r * (1.4 + 0.5 * sin(age * 9)); ctx.globalAlpha = 0.6; ctx.drawImage(set.ring, e.x - rg * 1.6, e.y - rg * 1.6, rg * 3.2, rg * 3.2); }
        ctx.lineWidth = 1.2; ctx.strokeStyle = e.css1; ctx.globalAlpha = 0.9;
        for (let k = 0; k < 3; k++) {
          const a0 = rand() * TAU, a1 = a0 + rr(-0.9, 0.9), r0 = r * 0.6, r1 = r * rr(1.1, 1.8), am = (a0 + a1) / 2;
          ctx.beginPath(); ctx.moveTo(e.x + cos(a0) * r0, e.y + sin(a0) * r0); ctx.lineTo(e.x + cos(am) * r1 * 0.8 + rr(-2, 2), e.y + sin(am) * r1 * 0.8 + rr(-2, 2)); ctx.lineTo(e.x + cos(a1) * r1, e.y + sin(a1) * r1); ctx.stroke();
        }
      }
    }

    // ---- shield hit ----
    let scratchB = null;
    function shieldHit(x, y, r, angle, color) {
      r = r || 40;
      const e = newE(E_SHIELD, 0.75); if (!e) return;
      const c = parseColor(color || [120, 215, 255]);
      e.x = x; e.y = y; e.r = r; e.a = angle || 0; e.set = colorSet(c); e.css0 = rgba(tone(c, 0.15), 1);
      const ia = e.a;
      for (let i = 0; i < 6; i++) { const aa = ia + PI + rr(-1, 1), sp = rr(50, 200); addSpark(x + cos(ia) * r, y + sin(ia) * r, cos(aa) * sp, sin(aa) * sp, rr(0.15, 0.4), rr(5, 10), 1.8, 0.9, [e.set, e.set], 1.6); }
    }
    function drawShield(ctx, bt, e, rs) {
      const r = e.r, p = e.age / e.dur;
      if (p >= 1 || r < 4) return;
      const ia = e.a, ix = e.x + cos(ia) * r, iy = e.y + sin(ia) * r, fade = 1 - p, set = e.set;
      const wd = 0.8 + 0.7 * p;
      ctx.lineCap = 'round';
      ctx.strokeStyle = e.css0;
      ctx.globalAlpha = fade * 0.35; ctx.lineWidth = 9 + r * 0.07; ctx.beginPath(); ctx.arc(e.x, e.y, r, ia - wd * 0.5, ia + wd * 0.5); ctx.stroke();
      ctx.globalAlpha = fade * 0.95; ctx.lineWidth = 2 + r * 0.02; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y, r, ia - wd * 0.35, ia + wd * 0.35); ctx.stroke();
      ctx.globalAlpha = fade * 0.18; ctx.lineWidth = 1.5; ctx.strokeStyle = e.css0; ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.stroke();
      const gr = r * 0.5 * (1 - p * 0.45);
      ctx.globalAlpha = fade; ctx.drawImage(set.glow, ix - gr, iy - gr, gr * 2, gr * 2);
      if (r < 10) return;
      // hex ripple spreading from the impact (lattice masked by an expanding soft ring)
      const rb = max(16, ((r + 8) >> 4) << 4), lat = lattice(rb), f = r / rb * rs, n = ceil(lat.width * f) + 2;
      if (n > 1400) return;
      const A = scratchCanvas(n);
      if (!scratchB) scratchB = mk(256, 256);
      if (scratchB.width < n || scratchB.height < n) { scratchB.width = max(scratchB.width, n); scratchB.height = max(scratchB.height, n); }
      const a = A.getContext('2d'), b = scratchB.getContext('2d');
      a.setTransform(1, 0, 0, 1, 0, 0); b.setTransform(1, 0, 0, 1, 0, 0);
      a.globalAlpha = 1; b.globalAlpha = 1;
      a.globalCompositeOperation = 'source-over'; a.clearRect(0, 0, A.width, A.height); a.drawImage(lat, 0, 0, lat.width * f, lat.width * f);
      a.globalCompositeOperation = 'source-in'; a.fillStyle = e.css0; a.fillRect(0, 0, n, n);
      b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, scratchB.width, scratchB.height);
      const cx = lat.width * f * 0.5, rp = (0.12 + 1.5 * (1 - fade * fade)) * r * rs, ipx = cx + cos(ia) * r * rs, ipy = cx + sin(ia) * r * rs;
      b.drawImage(set.ring, ipx - rp / 0.94, ipy - rp / 0.94, rp * 2 / 0.94, rp * 2 / 0.94); const rq = rp * 0.78; b.globalAlpha = 0.7; b.drawImage(set.ring, ipx - rq / 0.94, ipy - rq / 0.94, rq * 2 / 0.94, rq * 2 / 0.94); b.globalAlpha = 1;
      b.globalAlpha = 0.9 * fade; const gg = r * 0.62 * rs * (0.5 + 0.5 * fade); b.drawImage(set.glow, ipx - gg, ipy - gg, gg * 2, gg * 2);
      a.globalCompositeOperation = 'destination-in'; a.globalAlpha = 1; a.drawImage(scratchB, 0, 0);
      ctx.globalAlpha = min(1, fade * 1.15);
      ctx.drawImage(A, 0, 0, n, n, e.x - cx / rs, e.y - cx / rs, n / rs, n / rs);
      ctx.globalAlpha = fade * 0.5; ctx.drawImage(A, 0, 0, n, n, e.x - cx / rs, e.y - cx / rs, n / rs, n / rs);
    }

    // ---- entity stepping ----
    function stepEntity(e, dt) {
      if (e.delay > 0) { e.delay -= dt; return true; }
      switch (e.type) {
        case E_BEAM: return stepBeam(e, dt);
        case E_MISSILE: return stepMissile(e, dt);
        case E_PLANET: {
          e.age += dt;
          while (e.m < e.n && e.age >= e.it[e.m]) {
            const i = e.m++, px = e.x + e.ix[i], py = e.y + e.iy[i], s = e.r * rr(0.16, 0.3);
            addFlash(px, py, s * 2, e.ramp[1], 0.28, 1);
            addRing(px, py, s * 0.2, s * 1.4, e.ramp[2], 0.5, 0.8);
            for (let k = 0; k < 7; k++) { const a = rand() * TAU, sp = rr(40, 220); addGlow(px, py, cos(a) * sp, sin(a) * sp, rr(0.4, 0.9), s * rr(0.3, 0.6), s * 0.15, 0.9, e.ramp, 1.5); }
            for (let k = 0; k < 5; k++) { const a = rand() * TAU, sp = rr(60, 260); addSpark(px, py, cos(a) * sp, sin(a) * sp, rr(0.3, 0.8), rr(6, 12), 2, 1, e.ramp, 1.2); }
            shakeAdd(e.r * 0.03);
          }
          return e.age < e.dur;
        }
        default:
          e.age += dt;
          return e.age < e.dur;
      }
    }
    function updateList(list, dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); free.push(p); continue; }
        if (p.drag) { const k = 1 / (1 + p.drag * dt); p.vx *= k; p.vy *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
    }
    function update(dt) {
      if (!(dt > 0)) return;
      if (dt > 0.1) dt = 0.1;
      updateList(liveA, dt); updateList(liveN, dt);
      for (let i = ents.length - 1; i >= 0; i--) {
        const e = ents[i];
        if (!stepEntity(e, dt)) { ents[i] = ents[ents.length - 1]; ents.pop(); e.h = null; efree.push(e); }
      }
      if (sys.shake) { sys.shake *= pow(0.03, dt); if (sys.shake < 0.05) sys.shake = 0; }
      if (sys.flash) { sys.flash *= pow(0.06, dt); if (sys.flash < 0.01) sys.flash = 0; }
    }

    // ---- drawing ----
    function xf(ctx, bt, x, y, rot, sx, sy) {
      const c = cos(rot), s = sin(rot), a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
      ctx.setTransform(bt.a * a + bt.c * b, bt.b * a + bt.d * b, bt.a * cc + bt.c * d, bt.b * cc + bt.d * d, bt.a * x + bt.c * y + bt.e, bt.b * x + bt.d * y + bt.f);
    }
    function sstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
    function drawNormal(ctx, bt) {
      const sm = SMOKE, sh = SHARDS;
      for (let i = 0; i < liveN.length; i++) {
        const p = liveN[i], k = 1 - p.life / p.max;
        if (p.kind === 2) {
          const s = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k)), a = p.a0 * min(1, k * 7) * (1 - k);
          ctx.globalAlpha = a;
          ctx.drawImage(sm[p.tint], p.x - s, p.y - s, s * 2, s * 2);
        } else {
          ctx.globalAlpha = min(1, p.life / (p.max * 0.35));
          xf(ctx, bt, p.x, p.y, p.rot, p.s0, p.s0);
          ctx.drawImage(sh[p.v], -0.5, -0.5, 1, 1);
          ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
        }
      }
    }
    function drawAdditive(ctx, bt, rs) {
      // entities first (large soft shapes), particles on top
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        if (e.delay > 0) continue;
        const p = e.age / e.dur;
        switch (e.type) {
          case E_RING: {
            const k = 1 - (1 - p) * (1 - p) * (1 - p), r = (e.r + (e.r1 - e.r) * k) / 0.94;
            ctx.globalAlpha = e.a * pow(1 - p, 1.25);
            ctx.drawImage(e.set.ring, e.x - r, e.y - r, r * 2, r * 2);
            break;
          }
          case E_FLASH: {
            ctx.globalAlpha = e.a * (1 - p) * (1 - p);
            const r = e.r * (0.65 + 0.35 * sqrt(p));
            ctx.drawImage(e.set.glow, e.x - r, e.y - r, r * 2, r * 2);
            ctx.drawImage(e.set.core, e.x - r * 0.45, e.y - r * 0.45, r * 0.9, r * 0.9);
            break;
          }
          case E_FLARE: {
            ctx.globalAlpha = e.a * pow(1 - p, 1.6);
            const r = e.r * (0.7 + 0.3 * p);
            if (e.a1) { xf(ctx, bt, e.x, e.y, e.a1 + p * 0.3, r * 2, r * 2); ctx.drawImage(e.set.flare, -0.5, -0.5, 1, 1); ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f); }
            else ctx.drawImage(e.set.flare, e.x - r, e.y - r, r * 2, r * 2);
            break;
          }
          case E_GLOW: {
            ctx.globalAlpha = e.a * (1 - p) * min(1, p * 8);
            ctx.drawImage(e.set.glow, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
            break;
          }
          case E_BEAM: drawBeam(ctx, bt, e); ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f); break;
          case E_MISSILE: drawMissile(ctx, bt, e); ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f); break;
          case E_SHIELD: drawShield(ctx, bt, e, rs); break;
          case E_PULSE: {
            const set = e.set;
            for (let k = 0; k < 3; k++) {
              const u = clamp((e.age - k * 0.2) / 1.05, 0, 1);
              if (u <= 0 || u >= 1) continue;
              const rk = e.r * (1 - (1 - u) * (1 - u)), al = pow(1 - u, 1.3) * (k ? 0.5 : 1);
              ctx.globalAlpha = al * 0.9; const hr = rk / 0.94; ctx.drawImage(set.ring, e.x - hr, e.y - hr, hr * 2, hr * 2);
              if (k === 0) { ctx.globalAlpha = al * 0.85; ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x, e.y, rk, 0, TAU); ctx.stroke(); }
            }
            ctx.globalAlpha = 0.14 * (1 - p); ctx.drawImage(set.glow, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
            break;
          }
          case E_WARP: {
            const s = e.r, set = e.set, out = e.flag === 1;
            const env = out ? sstep(0.38, 0.55, p) * (1 - sstep(0.55, 1, p)) : (1 - p) * (1 - p);
            ctx.globalAlpha = env; const fr = s * (0.6 + 1.1 * p); ctx.drawImage(set.glow, e.x - fr, e.y - fr, fr * 2, fr * 2);
            ctx.globalAlpha = env; ctx.drawImage(WHITE.core, e.x - fr * 0.42, e.y - fr * 0.42, fr * 0.84, fr * 0.84);
            const len = out ? s * 9 * sstep(0.38, 0.62, p) * (1 - sstep(0.62, 1, p)) : s * 8 * pow(1 - p, 1.4);
            if (len > 1) { ctx.globalAlpha = 0.95; xf(ctx, bt, e.x, e.y, e.a, len, s * 0.2); ctx.drawImage(set.streak, -0.5, -0.5, 1, 1); ctx.globalAlpha = 1; xf(ctx, bt, e.x, e.y, e.a, len * 0.8, s * 0.06); ctx.drawImage(WHITE.streak, -0.5, -0.5, 1, 1); ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f); }
            const rad = out ? s * (1.8 - 1.6 * sstep(0, 0.5, p)) : s * (0.2 + 1.7 * (1 - (1 - p) * (1 - p)));
            const ra = out ? sstep(0, 0.25, p) * (1 - sstep(0.45, 0.55, p)) : (1 - p);
            ctx.globalAlpha = ra * 0.85; const hr = rad / 0.94; ctx.drawImage(set.ring, e.x - hr, e.y - hr, hr * 2, hr * 2);
            break;
          }
          case E_PLANET: {
            const env = sstep(0, 0.25, e.age) * (1 - sstep(1.2, e.dur, e.age)), r = e.r;
            ctx.save();
            ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.clip();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.5 * env * (0.85 + 0.15 * sin(e.age * 17)); ctx.drawImage(e.set.glow, e.x - r * 1.3, e.y - r * 1.3, r * 2.6, r * 2.6);
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.4 * env * (0.82 + 0.18 * sin(e.age * 19)); ctx.drawImage(e.set.glow, e.x - r * 1.05, e.y - r * 1.05, r * 2.1, r * 2.1);
            ctx.restore();
            ctx.globalAlpha = 0.45 * env; ctx.drawImage(e.set.glow, e.x - r * 1.6, e.y - r * 1.6, r * 3.2, r * 3.2);
            ctx.globalAlpha = 0.5 * env; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgb(255,170,90)'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.01, 0, TAU); ctx.stroke();
            break;
          }
        }
      }
      for (let i = 0; i < liveA.length; i++) {
        const p = liveA[i], k = 1 - p.life / p.max, rp = p.ramp, n = rp.length;
        let idx = (k * n) | 0; if (idx >= n) idx = n - 1;
        if (p.kind === 0) {
          const s = p.s0 + (p.s1 - p.s0) * (1 - (1 - k) * (1 - k));
          ctx.globalAlpha = p.a0 * min(1, k * 12) * pow(1 - k, 1.15);
          ctx.drawImage(rp[idx].glow, p.x - s, p.y - s, s * 2, s * 2);
        } else {
          const sp2 = p.vx * p.vx + p.vy * p.vy, ang = sp2 > 4 ? atan2(p.vy, p.vx) : p.rot;
          ctx.globalAlpha = p.a0 * pow(1 - k, 0.9);
          xf(ctx, bt, p.x, p.y, ang, p.s0 * (1 - k * 0.45), p.s1 * 2.1);
          ctx.drawImage(rp[idx].streak, -0.5, -0.5, 1, 1);
        }
      }
    }
    function draw(ctx) {
      if (!liveA.length && !liveN.length && !ents.length) return;
      const bt = ctx.getTransform(), prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha;
      const rs = clamp(bt.a, 1, 2);
      ctx.globalCompositeOperation = 'source-over';
      drawNormal(ctx, bt);
      for (let i = 0; i < ents.length; i++) {                                  // shockwave: dark band just inside the bright rim (fakes refraction)
        const e = ents[i]; if (e.type !== E_SHOCK || e.delay > 0) continue;
        const p = e.age / e.dur, k = 1 - (1 - p) * (1 - p) * (1 - p), rk = e.r * (0.12 + 0.88 * k);
        ctx.globalAlpha = 0.5 * pow(1 - p, 1.3); ctx.lineWidth = max(2, e.r * 0.11 * (1 - p * 0.5)); ctx.strokeStyle = 'rgb(4,6,16)';
        ctx.beginPath(); ctx.arc(e.x, e.y, max(1, rk - ctx.lineWidth * 0.55), 0, TAU); ctx.stroke();
      }
      ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
      ctx.globalCompositeOperation = 'lighter';
      drawAdditive(ctx, bt, rs);
      ctx.setTransform(bt.a, bt.b, bt.c, bt.d, bt.e, bt.f);
      ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevOp;
    }
    function clear() {
      while (liveA.length) free.push(liveA.pop());
      while (liveN.length) free.push(liveN.pop());
      while (ents.length) { const e = ents.pop(); if (e.h) e.h.done = true; e.h = null; efree.push(e); }
      sys.shake = 0; sys.flash = 0;
    }
    function count() { return liveA.length + liveN.length + ents.length; }

    sys.update = update; sys.draw = draw; sys.clear = clear; sys.count = count;
    sys.explosion = explosion; sys.debris = debris; sys.sparks = sparks; sys.beam = beam; sys.missile = missile;
    sys.shieldHit = shieldHit; sys.warpFlash = warpFlash; sys.novaBlast = novaBlast; sys.planetImpact = planetImpact; sys.pulse = pulse; sys.shockwave = shockwave;
    sys.ring = function (x, y, r0, r1, color, dur) { return addRing(x, y, r0, r1, colorSet(parseColor(color)), dur || 0.6, 0.85); };
    sys.flashAt = function (x, y, r, color, dur) { return addFlash(x, y, r, colorSet(parseColor(color)), dur || 0.25, 1); };
    sys.setQuality = function (q) { quality = clamp(q, 0.2, 1); sys.quality = quality; };
    sys.stats = function () { return { particles: liveA.length + liveN.length, entities: ents.length, pool: total, max: MAXP }; };

    return sys;
  }

  M.Gfx.Fx = { create: create, BEAMS: BEAMS, MISSILES: MISSILES };
})(window.MOO);
