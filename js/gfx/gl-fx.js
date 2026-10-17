// GPU effects (WebGL2) — OPTIONAL accelerator for MOO.Gfx.Fx: same system API, same effect kinds and identity, 10-50x the particle budget.
// Renders through the ONE shared context of MOO.Gfx.GL (begin → draw → blit). Everything is additive HDR (RGBA16F) with an optional
// bloom pass and a soft tone-map; smoke/shards go through a second, normal-blend layer.
//
//   const fx = MOO.Gfx.GLFx.create();            // → falls back to MOO.Gfx.Fx.create() when WebGL2 is unavailable (create({forceGL:true}) never falls back)
//   fx.update(dt);  fx.draw(ctx);  fx.clear();  fx.count();           // draw(ctx) blits the GPU result over the whole canvas (any 2D transform is honoured)
//   fx.explosion(x, y, size, {kind:'fire'|'plasma'|'energy'|'nova', scale, tint, debris})   fx.debris(x, y, n, size)   fx.sparks(x, y, n, color)
//   fx.beam(x1, y1, x2, y2, kind, dur, {color, scale}) → handle {done, x1,y1,x2,y2, stop()}     kinds laser neutron disruptor phasor plasma deathray mass
//   fx.missile(x1, y1, x2, y2, speed, kind, {onHit, scale, arc}) → handle {done, x, y, tx, ty, onHit, stop()}
//                                                        kinds nuclear hyperx merculite scatter stinger torpedo antimatter
//   fx.shieldHit(x, y, r, angle, color)  fx.warpFlash(x, y, size, {color, mode:'in'|'out', angle})  fx.novaBlast(x, y, r)
//   fx.planetImpact(x, y, r)  fx.pulse(x, y, r, color)  fx.ring(x, y, r0, r1, color, dur)  fx.flashAt(x, y, r, color, dur)  fx.shockwave(x, y, r, color)
//   fx.shake / fx.flash (decaying camera-shake / white-flash values, same as the CPU system)   fx.setQuality(q)   fx.stats()
//   GPU extras: fx.stress(n, {w, h}) (spawn n particles at once), fx.bloom (true/false/undefined=Perf), fx.gain, fx.resScale, fx.dispose()
// Particles live in one typed-array ring buffer (64 bytes each, ≥131,072 slots) and are integrated analytically in the vertex shader
// (position = p0 + v0·(1-e^-kt)/k + …), so the CPU only writes NEW particles; beams, shields and missile heads are tiny shader quads.
// Effort scales from MOO.Perf.q (particles, bloom, glow, dpr) and fx.setQuality(); nothing here requires more than WebGL2.
(function (M) {
  'use strict';
  const GL = M.Gfx.GL;
  const FX = M.Gfx.GLFx = { stats: { draw: 0 } };
  const PI = Math.PI, TAU = PI * 2;
  const sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, sqrt = Math.sqrt, abs = Math.abs, min = Math.min, max = Math.max;
  const floor = Math.floor, hypot = Math.hypot, pow = Math.pow;
  const NO = {};
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // cosmetic RNG (never used for simulation)
  let rs = (Math.random() * 4294967296) | 0 || 123456789;
  function rand() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; }
  function rr(a, b) { return a + (b - a) * rand(); }

  const DEFQ = { dpr: 1.5, particles: 1, nebula: 1, glow: 1, bloom: true, maxFx: 5000, gl: true, animFps: 60 };
  const Q = () => (M.Perf && M.Perf.q) || DEFQ;
  const tierName = () => (M.Perf && M.Perf.tier) || 'high';
  const BUDGET = { low: 1.2e6, medium: 2.4e6, high: 4.0e6, ultra: 7.0e6 };

  // ------------------------------------------------------------------ colours (0..255 triplets, same helpers as the CPU system)
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
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
  const pk = (r, g, b, a) => ((((a | 0) & 255) << 24) | ((((b + 0.5) | 0) & 255) << 16) | ((((g + 0.5) | 0) & 255) << 8) | (((r + 0.5) | 0) & 255)) >>> 0;
  const pkc = c => pk(c[0], c[1], c[2], 0);

  // life-time colour ramps (identical stops to the CPU system → identical identity); shader looks them up by id
  const RAMP_COLORS = {
    fire: [[255, 255, 255], [255, 246, 210], [255, 214, 120], [255, 162, 62], [236, 100, 32], [172, 52, 20], [92, 32, 18]],
    plasma: [[255, 255, 255], [214, 255, 255], [120, 235, 255], [60, 170, 255], [40, 100, 235], [30, 56, 170], [20, 30, 100]],
    energy: [[255, 255, 255], [255, 226, 255], [255, 150, 245], [226, 90, 255], [160, 62, 240], [102, 38, 190], [52, 22, 110]],
    nova: [[255, 255, 255], [236, 244, 255], [170, 208, 255], [128, 160, 255], [160, 120, 255], [112, 70, 210], [58, 34, 130]],
    acid: [[255, 255, 235], [236, 255, 170], [170, 255, 90], [100, 222, 60], [56, 160, 40], [34, 100, 30], [20, 56, 20]],
    ice: [[255, 255, 255], [220, 245, 255], [160, 220, 255], [110, 180, 255], [90, 130, 240]],
    anti: [[255, 255, 255], [250, 232, 255], [214, 170, 255], [170, 110, 255], [120, 70, 230], [70, 40, 170]],
  };
  const RAMP_ID = { fire: 1, plasma: 2, energy: 3, nova: 4, acid: 5, ice: 6, anti: 7 };
  const RAMP_U = new Float32Array(8 * 7 * 3), RAMP_N = new Float32Array(8);
  const RP = {}, RP1 = {}, RP2 = {}, RC = {};     // packed (c0,c1) pairs for ramp lookups starting at stop 0/1/2, and constant stop colours
  Object.keys(RAMP_COLORS).forEach(k => {
    const id = RAMP_ID[k], st = RAMP_COLORS[k];
    RAMP_N[id] = st.length;
    st.forEach((c, i) => { RAMP_U[(id * 7 + i) * 3] = c[0] / 255; RAMP_U[(id * 7 + i) * 3 + 1] = c[1] / 255; RAMP_U[(id * 7 + i) * 3 + 2] = c[2] / 255; });
    RP[k] = [pk(0, 0, 0, id), pk(0, 0, 0, 0)]; RP1[k] = [pk(0, 0, 0, id), pk(0, 0, 0, 1)]; RP2[k] = [pk(0, 0, 0, id), pk(0, 0, 0, 2)];
    RC[k] = st.map(pkc);
  });
  const WHITE = pk(255, 255, 255, 0);
  const WHITE_P = [WHITE, WHITE];
  function constPair(c) { const p = pkc(c); return [p, p]; }
  // effect tables (same as the CPU system)
  const BEAMS = {
    laser:     { col: [255, 78, 66],   w: 2.4, glow: 10, dur: 0.34, muz: 15, imp: 18, rate: 38, ramp: 'fire', id: 0 },
    neutron:   { col: [140, 255, 92],  w: 4.6, glow: 17, dur: 0.5,  muz: 20, imp: 26, rate: 60, ramp: 'acid', id: 1 },
    disruptor: { col: [186, 108, 255], w: 3.0, glow: 20, dur: 0.58, muz: 20, imp: 26, rate: 80, ramp: 'energy', id: 2 },
    phasor:    { col: [90, 222, 255],  w: 3.4, glow: 16, dur: 0.62, muz: 22, imp: 28, rate: 70, ramp: 'plasma', id: 3 },
    plasma:    { col: [255, 146, 48],  w: 8.5, glow: 30, dur: 0.72, muz: 30, imp: 44, rate: 90, ramp: 'fire', id: 4 },
    deathray:  { col: [206, 164, 255], w: 17,  glow: 78, dur: 1.5,  muz: 76, imp: 96, rate: 170, ramp: 'anti', id: 5 },
    mass:      { col: [255, 214, 140], w: 2.6, glow: 9,  dur: 0.58, muz: 13, imp: 13, rate: 34, ramp: 'fire', id: 6 },
  };
  const MISSILES = {
    nuclear:    { col: [255, 190, 90],  speed: 1.0,  size: 1.5,  trail: 'smoke', flame: 'fire',   blast: 'fire',   blastSize: 74, tint: 0, turn: 0.5 },
    hyperx:     { col: [150, 210, 255], speed: 1.55, size: 1.2,  trail: 'streak', flame: 'plasma', blast: 'plasma', blastSize: 52, tint: 2, turn: 0.35 },
    merculite:  { col: [170, 255, 100], speed: 1.05, size: 1.45, trail: 'smoke', flame: 'acid',   blast: 'acid',   blastSize: 62, tint: 1, turn: 0.5 },
    scatter:    { col: [255, 160, 90],  speed: 1.2,  size: 0.95, trail: 'smoke', flame: 'fire',   blast: 'fire',   blastSize: 34, tint: 0, turn: 0.3, cluster: 5 },
    stinger:    { col: [255, 96, 80],   speed: 1.9,  size: 0.8,  trail: 'streak', flame: 'fire',  blast: 'fire',   blastSize: 26, tint: 0, turn: 0.25 },
    torpedo:    { col: [140, 200, 255], speed: 0.62, size: 2.0,  trail: 'glow',  flame: 'plasma', blast: 'plasma', blastSize: 92, tint: 2, turn: 0.4 },
    antimatter: { col: [214, 160, 255], speed: 0.8,  size: 1.9,  trail: 'glow',  flame: 'anti',   blast: 'nova',   blastSize: 124, tint: 3, turn: 0.35 },
  };
  FX.BEAMS = BEAMS; FX.MISSILES = MISSILES;

  // ------------------------------------------------------------------ GL plumbing (programs, context-loss epoch, render targets)
  let epoch = 0, hooked = null, broken = false;
  const progs = Object.create(null), bad = Object.create(null), caches = [];
  function ensure() {
    if (broken || !GL || !GL.supported || !GL.supported()) return null;
    const cv = GL.canvas();
    if (cv && cv !== hooked) {
      hooked = cv;
      const bump = function () { epoch++; for (let i = 0; i < caches.length; i++) caches[i].clear(); };
      cv.addEventListener('webglcontextlost', bump); cv.addEventListener('webglcontextrestored', bump);
    }
    return GL.gl();
  }
  function prog(name, fs, vs) {
    if (bad[name]) return null;
    const c = progs[name];
    if (c && c.epoch === epoch) return c.p;
    const p = GL.program('glfx.' + name, vs || null, fs);
    if (!p) { bad[name] = true; return null; }
    progs[name] = { p, epoch };
    return p;
  }
  function makeFbo(w, h, wantFloat) {
    const fl = wantFloat && GL.info && GL.info.floatRT;
    let f = GL.fbo(w, h, fl ? { float: true } : {});
    if (!f.ok && fl) { f.dispose(); f = GL.fbo(w, h, {}); }
    f.epoch = epoch;
    return f;
  }
  function resetState(g) {
    g.disable(g.BLEND); g.blendFunc(g.ONE, g.ZERO); g.bindVertexArray(null);
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.activeTexture(g.TEXTURE0);
  }
  let emptyVao = null, emptyEpoch = -1;
  function emptyVA(g) { if (!emptyVao || emptyEpoch !== epoch) { emptyVao = g.createVertexArray(); emptyEpoch = epoch; } return emptyVao; }

  // render targets (HDR scene + bloom chain) cached per size so several systems can alternate sizes without thrashing
  const targets = new Map();
  caches.push({ clear() { targets.clear(); } });
  function getTarget(pw, ph) {
    const key = pw + 'x' + ph;
    let t = targets.get(key);
    if (t && t.epoch !== epoch) { targets.delete(key); t = null; }
    if (!t) {
      if (targets.size >= 3) { const k0 = targets.keys().next().value, o = targets.get(k0); disposeTarget(o); targets.delete(k0); }
      t = { epoch, w: pw, h: ph, scene: makeFbo(pw, ph, true), levels: null };
      targets.set(key, t);
    } else { targets.delete(key); targets.set(key, t); }
    return t;
  }
  function disposeTarget(t) { if (!t || t.epoch !== epoch) return; if (t.scene) t.scene.dispose(); if (t.levels) t.levels.forEach(f => f.dispose()); }
  function bloomLevels(t) {
    if (t.levels) return t.levels;
    t.levels = [];
    let lw = t.w, lh = t.h;
    for (let i = 0; i < 5; i++) {
      lw = max(2, lw >> 1); lh = max(2, lh >> 1);
      if (lw < 4 || lh < 4) break;
      t.levels.push(makeFbo(lw, lh, true));
    }
    return t.levels;
  }

  // ------------------------------------------------------------------ GLSL
  const NOISE = (GL && GL.glsl && GL.glsl.noise) || '';
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n' +
    'float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }\n';

  // shared sprite profiles (the CPU sprite gradients, evaluated analytically): return premultiplied additive colour in rgb, coverage in a
  const PROFILES = `
    vec4 glowProf(float r, vec3 c){
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 col; float a;
      if (r < 0.09) { float t = r / 0.09; col = mix(vec3(1.0), hot, t); a = mix(1.0, 0.95, t); }
      else if (r < 0.30) { float t = (r - 0.09) / 0.21; col = mix(hot, c, t); a = mix(0.95, 0.55, t); }
      else if (r < 0.66) { float t = (r - 0.30) / 0.36; col = c; a = mix(0.55, 0.14, t); }
      else { float t = clamp((r - 0.66) / 0.34, 0.0, 1.0); col = c; a = mix(0.14, 0.0, t * t * (3.0 - 2.0 * t)); }
      return vec4(col * a, a);
    }
    vec4 coreProf(float r, vec3 c){
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 col; float a;
      if (r < 0.2) { float t = r / 0.2; col = mix(vec3(1.0), hot, t); a = mix(1.0, 0.9, t); }
      else if (r < 0.5) { float t = (r - 0.2) / 0.3; col = mix(hot, c, t); a = mix(0.9, 0.32, t); }
      else { float t = clamp((r - 0.5) / 0.5, 0.0, 1.0); col = c; a = mix(0.32, 0.0, t * t * (3.0 - 2.0 * t)); }
      return vec4(col * a, a);
    }
    vec4 ringProf(float r, vec3 c){
      if (r < 0.68 || r >= 1.0) return vec4(0.0);
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 col; float a;
      if (r < 0.8) { float t = (r - 0.68) / 0.12; col = c; a = mix(0.0, 0.22, t); }
      else if (r < 0.9) { float t = (r - 0.8) / 0.1; col = mix(c, hot, t); a = mix(0.22, 0.7, t); }
      else if (r < 0.94) { float t = (r - 0.9) / 0.04; col = mix(hot, vec3(1.0), t); a = mix(0.7, 0.95, t); }
      else if (r < 0.975) { float t = (r - 0.94) / 0.035; col = mix(vec3(1.0), c, t); a = mix(0.95, 0.45, t); }
      else { float t = (r - 0.975) / 0.025; col = c; a = mix(0.45, 0.0, t); }
      return vec4(col * a, a);
    }
    // elongated streak: q in [-1,1]^2 (x along), soft ellipse + hot filament
    vec4 sparkProf(vec2 q, vec3 c){
      float rho = length(q);
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 col; float a;
      if (rho >= 1.0) return vec4(0.0);
      if (rho < 0.22) { float t = rho / 0.22; col = mix(vec3(1.0), hot, t); a = mix(1.0, 0.85, t); }
      else if (rho < 0.6) { float t = (rho - 0.22) / 0.38; col = mix(hot, c, t); a = mix(0.85, 0.32, t); }
      else { float t = (rho - 0.6) / 0.4; col = c; a = mix(0.32, 0.0, t * t * (3.0 - 2.0 * t)); }
      float fil = (1.0 - ss(0.08, 0.24, abs(q.y))) * max(0.0, 1.0 - abs(q.x) / 0.8125) * 0.95;
      return vec4(col * a + vec3(fil), max(a, fil));
    }
    vec3 flareProf(vec2 p, vec3 c, float R){
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 acc = vec3(0.0);
      for (int k = 0; k < 4; k++) {
        float ang = float(k) * 0.7853982;
        vec2 d = vec2(cos(ang), sin(ang));
        float u = dot(p, d), v = dot(p, vec2(-d.y, d.x));
        bool odd = (k & 1) == 1;
        float sx = odd ? 0.55 : 1.0, sy = max(odd ? 0.014 : 0.024, 1.1 / R);
        float rho = length(vec2(u / sx, v / sy));
        if (rho < 1.0) {
          float a0 = odd ? 0.5 : 0.95, a1 = odd ? 0.25 : 0.55; vec3 col; float a;
          if (rho < 0.3) { float t = rho / 0.3; col = mix(vec3(1.0), hot, t); a = mix(a0, a1, t); }
          else { float t = (rho - 0.3) / 0.7; col = mix(hot, c, t); a = mix(a1, 0.0, t); }
          acc += col * a;
        }
      }
      float rr = length(p) / 0.547;
      if (rr < 1.0) {
        vec3 col; float a;
        if (rr < 0.3) { float t = rr / 0.3; col = mix(vec3(1.0), hot, t); a = mix(0.95, 0.5, t); }
        else { float t = (rr - 0.3) / 0.7; col = mix(hot, c, t); a = mix(0.5, 0.0, t); }
        acc += col * a;
      }
      return acc;
    }
  `;

  // ---- particles (instanced quads; integrate p(t) = p0 + v0 (1-e^-kt)/k + a-terms in the vertex shader) ----
  const PART_VS = HEAD + `
    layout(location=0) in vec4 aPV;   // x0 y0 vx0 vy0
    layout(location=1) in vec4 aTL;   // birth life s0 s1
    layout(location=2) in vec4 aC0;   // colour0 (rgb) · ramp id (a)
    layout(location=3) in vec4 aC1;   // colour1 (rgb) · ramp start (a)
    layout(location=4) in vec4 aPh;   // drag ax ay type(+16 = hold)
    layout(location=5) in vec2 aEx;   // intensity extra
    uniform vec4 uM0, uM1; uniform vec2 uPix; uniform float uT, uPass, uGain;
    uniform vec3 uRamp[56]; uniform float uRN[8];
    out vec2 vC; out vec4 vCol; flat out vec4 vP; out float vK; out float vS;
    const vec3 TINT[4] = vec3[4](vec3(0.408, 0.329, 0.275), vec3(0.361, 0.376, 0.424), vec3(0.251, 0.290, 0.416), vec3(0.337, 0.259, 0.431));
    vec3 rampAt(int rid, int st, float p){
      int n = int(uRN[rid] + 0.5) - st;
      float f = clamp(p * float(n) - 0.5, 0.0, float(n - 1));
      int i0 = int(floor(f)); float fr = f - float(i0);
      int i1 = min(i0 + 1, n - 1);
      return mix(uRamp[rid * 7 + st + i0], uRamp[rid * 7 + st + i1], fr);
    }
    void main(){
      float age = uT - aTL.x, life = aTL.y, p = age / life;
      vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
      float tc = aPh.w; float hold = step(15.5, tc); int ty = int(tc - 16.0 * hold + 0.5);
      bool isN = (ty == 2 || ty == 3);
      if (age < 0.0 || p >= 1.0 || isN != (uPass > 0.5)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCol = vec4(0.0); vC = vec2(0.0); vP = vec4(0.0); vK = 0.0; vS = 0.0; return; }
      float kd = aPh.x; vec2 acc = (ty == 12) ? vec2(0.0) : aPh.yz;
      vec2 pos, vel;
      if (kd > 0.001) { float E = exp(-kd * age); vec2 vt = acc / kd, dv = aPV.zw - vt; pos = aPV.xy + dv * (1.0 - E) / kd + vt * age; vel = dv * E + vt; }
      else { pos = aPV.xy + aPV.zw * age + 0.5 * acc * age * age; vel = aPV.zw + acc * age; }
      float s0 = aTL.z, s1 = aTL.w, inten = aEx.x * uGain, ex = aEx.y;
      float e2 = 1.0 - (1.0 - p) * (1.0 - p);
      float R = 1.0, env = 1.0; vec2 hf = vec2(1.0), ax = vec2(1.0, 0.0), ay = vec2(0.0, 1.0);
      vec4 pp = vec4(float(ty), 1.0, 0.0, 0.0);
      float seed = fract(sin(aTL.x * 127.1 + aPV.x * 311.7 + aPV.y * 74.7) * 43758.5453);
      vec3 col = (int(aC0.a * 255.0 + 0.5) == 0) ? mix(aC0.rgb, aC1.rgb, p) : rampAt(int(aC0.a * 255.0 + 0.5), int(aC1.a * 255.0 + 0.5), p);
      if (ty == 0) { R = max(mix(s0, s1, e2), 0.5); env = min(1.0, p * 12.0) * pow(1.0 - p, 1.15); hf = vec2(R); pp.y = R; }
      else if (ty == 1) {
        float len = max(s0 * (1.0 - 0.45 * p * (1.0 - hold)), 1.0), wid = max(s1 * 2.1, 1.6);
        vec2 dir = dot(vel, vel) > 4.0 ? normalize(vel) : vec2(cos(ex), sin(ex));
        ax = dir; ay = vec2(-dir.y, dir.x);
        hf = vec2(len * 0.5, wid * 0.5); pp.y = wid * 0.5; pp.z = len * 0.5; env = pow(1.0 - p, 0.9);
      }
      else if (ty == 2) { R = max(mix(s0, s1, e2), 0.5); env = min(1.0, p * 7.0) * (1.0 - p); hf = vec2(R); pp.y = R; col = TINT[int(ex + 0.5) & 3]; }
      else if (ty == 3) {
        R = max(s0 * 0.5, 1.0); float ang = seed * 6.2831853 + ex * age;
        ax = vec2(cos(ang), sin(ang)); ay = vec2(-ax.y, ax.x); hf = vec2(R * 1.25); pp.y = R; env = min(1.0, (1.0 - p) / 0.35);
      }
      else if (ty == 4) {
        float pw = ex > 0.0 ? ex : 3.0;
        float k = 1.0 - pow(1.0 - p, pw); R = max((s0 + (s1 - s0) * k) / 0.94, 1.0);
        env = pow(1.0 - p, 1.25); hf = vec2(R); pp.y = R;
      }
      else if (ty == 5) { R = max(s0 * (0.65 + 0.35 * sqrt(p)), 0.5); env = (1.0 - p) * (1.0 - p); hf = vec2(R); pp.y = R; }
      else if (ty == 6) {
        R = max(s0 * (0.7 + 0.3 * p), 1.0); env = pow(1.0 - p, 1.6);
        if (abs(ex) > 0.0001) { float ang = ex + p * 0.3; ax = vec2(cos(ang), sin(ang)); ay = vec2(-ax.y, ax.x); }
        hf = vec2(R); pp.y = R;
      }
      else if (ty == 7) { R = max(s0, 0.5); env = (1.0 - p) * min(1.0, p * 8.0); hf = vec2(R); pp.y = R; }
      else if (ty == 8) { R = max(mix(s0, s1, e2), 0.5); env = min(1.0, p * 10.0) * pow(1.0 - p, 1.3); hf = vec2(R * 1.4); pp.y = R; }
      else if (ty == 9) {
        R = max(s0, 1.0); env = ss(0.0, 0.25, age) * (1.0 - ss(1.2, life, age)); hf = vec2(R * 1.75); pp.y = R; pp.z = age;
      }
      else if (ty == 10) { R = max(s0, 0.5); env = min(1.0, p * 12.0) * pow(1.0 - p, 1.15); hf = vec2(R); pp.y = R; }
      else if (ty == 12) {
        float a = ex; ax = vec2(cos(a), sin(a)); ay = vec2(-ax.y, ax.x);
        R = max(s0, 1.0); hf = vec2(R * 4.7, R * 2.3); pp.y = R; pp.z = p; pp.w = aPh.y; env = 1.0;
      }
      if (hold > 0.5) env = 1.0 - abs(2.0 * p - 1.0);
      vec2 wp = pos + ax * (corner.x * hf.x) + ay * (corner.y * hf.y);
      vec2 pix = vec2(uM0.x * wp.x + uM0.y * wp.y + uM0.z, uM1.x * wp.x + uM1.y * wp.y + uM1.z);
      gl_Position = vec4(pix.x / uPix.x * 2.0 - 1.0, 1.0 - pix.y / uPix.y * 2.0, 0.0, 1.0);
      vC = corner * hf; vCol = vec4(col, env * inten); vP = pp; vK = p; vS = seed;
    }`;
  const PART_FS = HEAD + `
    in vec2 vC; in vec4 vCol; flat in vec4 vP; in float vK; in float vS; out vec4 o;
    ${NOISE}
    ${PROFILES}
    void main(){
      int ty = int(vP.x + 0.5); vec3 c = vCol.rgb; float A = vCol.a, R = vP.y; vec3 add = vec3(0.0);
      if (ty == 0 || ty == 7) { float r = length(vC) / R; if (r >= 1.0) discard; add = glowProf(r, c).rgb; }
      else if (ty == 1) { vec2 q = vC / vec2(vP.z, vP.y); if (abs(q.x) >= 1.0 || abs(q.y) >= 1.0) discard; add = sparkProf(q, c).rgb; }
      else if (ty == 4) { float r = length(vC) / R; if (r >= 1.0) discard; add = ringProf(r, c).rgb; }
      else if (ty == 5) { float r = length(vC) / R; if (r >= 1.0) discard; add = glowProf(r, c).rgb + coreProf(r / 0.45, c).rgb; }
      else if (ty == 6) { add = flareProf(vC / R, c, R); }
      else if (ty == 10) { float r = length(vC) / R; if (r >= 1.0) discard; add = coreProf(r, c).rgb; }
      else if (ty == 8) {
        vec2 p = vC / R; float r = length(p);
        vec3 np = vec3(p * 1.9, vS * 31.0 + vK * 1.6);
        float n = fbm(np, 4), n2 = fbm(np * 2.3 + vec3(7.7, 3.1, 1.3), 3);
        float edge = r - (0.50 + 0.34 * vK) + (0.5 - n) * 0.95;
        float body = 1.0 - ss(-0.34, 0.20, edge);
        float heat = body * (0.45 + 0.95 * n2) * (1.0 - 0.40 * r);
        vec3 hotc = mix(c, vec3(1.0, 0.96, 0.86), 0.5);
        add = mix(c, hotc, ss(0.45, 1.05, heat)) * body * (0.30 + 0.90 * heat);
      }
      else if (ty == 9) {
        float d = length(vC) / R, age = vP.z;
        vec3 sum = glowProf(d / 1.6, c).rgb * 0.45;
        if (d < 1.0) { sum += glowProf(d / 1.3, c).rgb * 0.45 * (0.85 + 0.15 * sin(age * 17.0)) + glowProf(d / 1.05, c).rgb * 0.4 * (0.82 + 0.18 * sin(age * 19.0)); }
        float rg = abs(d - 1.01) * R;
        sum += vec3(1.0, 0.67, 0.35) * 0.5 * (1.0 - ss(0.0, 1.6, rg));
        add = sum;
      }
      else if (ty == 12) {
        float s = R, p = vP.z, out_ = vP.w; vec2 q = vC;
        bool isOut = out_ > 0.5;
        float env = isOut ? ss(0.38, 0.55, p) * (1.0 - ss(0.55, 1.0, p)) : (1.0 - p) * (1.0 - p);
        float fr = s * (0.6 + 1.1 * p);
        vec3 sum = (glowProf(length(q) / fr, c).rgb + coreProf(length(q) / (fr * 0.42), c).rgb) * env;
        float len = isOut ? s * 9.0 * ss(0.38, 0.62, p) * (1.0 - ss(0.62, 1.0, p)) : s * 8.0 * pow(1.0 - p, 1.4);
        if (len > 1.0) {
          sum += sparkProf(q / vec2(len * 0.5, max(s * 0.1, 0.8)), c).rgb * 0.95;
          sum += sparkProf(q / vec2(len * 0.4, max(s * 0.03, 0.6)), vec3(1.0)).rgb;
        }
        float rad = isOut ? s * (1.8 - 1.6 * ss(0.0, 0.5, p)) : s * (0.2 + 1.7 * (1.0 - (1.0 - p) * (1.0 - p)));
        float ra = isOut ? ss(0.0, 0.25, p) * (1.0 - ss(0.45, 0.55, p)) : (1.0 - p);
        sum += ringProf(length(q) / (rad / 0.94), c).rgb * ra * 0.85;
        add = sum;
      }
      vec3 oc = add * A;
      o = vec4(oc, clamp(max(oc.r, max(oc.g, oc.b)), 0.0, 1.0));
    }`;
  // normal-blend layer: smoke puffs and metal shards (premultiplied alpha)
  const PARTN_FS = HEAD + `
    in vec2 vC; in vec4 vCol; flat in vec4 vP; in float vK; in float vS; out vec4 o;
    ${NOISE}
    void main(){
      int ty = int(vP.x + 0.5); float R = vP.y, a = 0.0; vec3 col = vec3(0.0);
      if (ty == 2) {
        float r = length(vC) / R; if (r >= 1.0) discard;
        float n = fbm(vec3(vC / R * 1.7, vS * 20.0 + vK * 0.35), 3);
        float cloud = (1.0 - ss(0.22, 1.0, r)) * (0.5 + 1.1 * (n - 0.30));
        a = clamp(cloud, 0.0, 1.0) * 0.8 * vCol.a; col = vCol.rgb;
      } else {
        vec2 q = vC / R; float asp = 0.42 + 0.58 * fract(vS * 7.3); q.y /= asp;
        float d = max(max(abs(q.x), abs(q.y)), (abs(q.x) + abs(q.y)) * 0.78);
        if (d >= 1.0) discard;
        float sh = 0.5 + 0.5 * (q.x * 0.6 - q.y * 0.5);
        col = mix(vec3(0.10, 0.11, 0.16), vec3(0.59, 0.61, 0.69), sh);
        float edge = ss(0.74, 1.0, d);
        col = mix(col, vec3(1.0, 0.75, 0.43), edge * 0.85); a = vCol.a;
      }
      o = vec4(col * a, a);
    }`;

  // ---- beams ----
  const BEAM_VS = HEAD + `
    uniform vec4 uM0, uM1; uniform vec2 uPix, uA, uB; uniform float uPad, uCap;
    out vec2 vL;
    void main(){
      vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
      vec2 d = uB - uA; float L = length(d); vec2 dir = d / max(L, 1e-3), nrm = vec2(-dir.y, dir.x);
      float x = mix(-uCap, L + uCap, c.x), y = (c.y * 2.0 - 1.0) * uPad;
      vec2 wp = uA + dir * x + nrm * y; vL = vec2(x, y);
      vec2 pix = vec2(uM0.x * wp.x + uM0.y * wp.y + uM0.z, uM1.x * wp.x + uM1.y * wp.y + uM1.z);
      gl_Position = vec4(pix.x / uPix.x * 2.0 - 1.0, 1.0 - pix.y / uPix.y * 2.0, 0.0, 1.0);
    }`;
  const BEAM_FS = HEAD + `
    in vec2 vL; out vec4 o;
    uniform int uKind;
    uniform float uLen, uAge, uFade, uGrow, uPul, uW, uGW, uSc, uSeed, uAmp, uNseg;
    uniform vec3 uC, uHot;
    ${PROFILES}
    float h11(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
    vec3 stripe(float y, float th, vec3 c, float alpha){
      float u = abs(y) / (0.5 * th);
      if (u >= 1.0) return vec3(0.0);
      vec3 hot = mix(c, vec3(1.0), 0.55); vec3 col; float a;
      if (u < 0.12) { float t = u / 0.12; col = mix(vec3(1.0), hot, t); a = mix(1.0, 0.92, t); }
      else if (u < 0.44) { float t = (u - 0.12) / 0.32; col = mix(hot, c, t); a = mix(0.92, 0.40, t); }
      else { float t = (u - 0.44) / 0.56; col = c; a = mix(0.40, 0.0, t * t * (3.0 - 2.0 * t)); }
      return col * a * alpha;
    }
    vec3 lineCol(float d, float lw, vec3 c, float alpha){
      float cov = 1.0 - ss(lw * 0.5 - 0.6, lw * 0.5 + 0.6, abs(d));
      float halo = exp(-d * d / (lw * lw * 1.6 + 0.01)) * 0.22;
      return c * (cov * alpha + halo * alpha);
    }
    void main(){
      float x = vL.x, y = vL.y, L = uLen, Lh = L * uGrow, age = uAge, sc = uSc;
      float m = ss(-0.7, 0.7, x) * ss(-0.7, 0.7, Lh - x);
      vec3 W = vec3(1.0), sum = vec3(0.0);
      if (uKind == 0) {
        sum = (stripe(y, uGW * uPul, uC, 0.5) + stripe(y, uW * 3.4 * uPul, uC, 0.95) + stripe(y, uW * 1.2, W, 1.0)) * m;
      } else if (uKind == 1) {
        sum = (stripe(y, uGW * uPul, uC, 0.5) + stripe(y, uW * 3.2 * uPul, uC, 0.95) + stripe(y, uW * 1.2, W, 1.0)) * m;
        for (int k = 0; k < 7; k++) {
          float dk = fract(age * 2.2 + float(k) / 7.0) * Lh;
          float r = length(vec2(x - dk, y)) / (7.0 * sc);
          if (r < 1.0) sum += coreProf(r, W).rgb * 0.85;
        }
      } else if (uKind == 2) {
        float n = uNseg, sp = L / n, idx = clamp(x / sp, 0.0, n - 0.001), i = floor(idx), f = idx - i;
        float o0 = (h11(i + uSeed * 57.0) - 0.5) * 2.0 * uAmp * pow(max(sin(3.1415927 * i / n), 0.0), 0.55);
        float o1 = (h11(i + 1.0 + uSeed * 57.0) - 0.5) * 2.0 * uAmp * pow(max(sin(3.1415927 * (i + 1.0) / n), 0.0), 0.55);
        float off = mix(o0, o1, f), slope = (o1 - o0) / sp;
        float dp = (y - off) / sqrt(1.0 + slope * slope);
        vec3 t1 = mix(uC, W, 0.3);
        float lm = ss(-0.7, 0.7, x) * ss(-0.7, 0.7, Lh - x);
        sum = lineCol(dp, 16.0 * sc, uC, 0.16 * 1.4) * lm + lineCol(dp, 5.5 * sc, t1, 0.65) * lm + lineCol(dp, 1.8 * sc, W, 1.0) * lm;
        sum += stripe(y, uGW * 1.2, uC, 0.4) * m;
      } else if (uKind == 3) {
        sum = stripe(y, uGW * 1.5, uC, 0.5) * m;
        float A = 5.6 * sc, env = pow(max(sin(3.1415927 * min(1.0, x / L)), 0.0), 0.35);
        for (int rib = 0; rib < 2; rib++) {
          float ph = x * 0.085 - age * 36.0 + float(rib) * 3.1415927;
          float off = sin(ph) * A * env, slope = cos(ph) * 0.085 * A * env;
          float dp = (y - off) / sqrt(1.0 + slope * slope);
          sum += (lineCol(dp, 3.4 * sc, rib == 1 ? uHot : uC, 0.95) + lineCol(dp, 1.2 * sc, W, 0.9)) * m;
        }
        sum += stripe(y, uW * 0.9, W, 1.0) * m;
      } else if (uKind == 4) {
        sum = (stripe(y, uGW * 1.8 * uPul, uC, 0.55) + stripe(y, uW * 3.2 * uPul, uC, 0.95) + stripe(y, uW * 1.5 * uPul, W, 1.0)) * m;
        for (int k = 0; k < 9; k++) {
          float dk = fract(age * 1.7 + float(k) / 9.0) * Lh, r = (11.0 + 5.0 * sin(age * 30.0 + float(k) * 2.0)) * sc;
          float rr = length(vec2(x - dk, y)) / r;
          if (rr < 1.0) sum += glowProf(rr, uC).rgb * 0.8;
        }
      } else if (uKind == 5) {
        sum = (stripe(y, uGW * 2.1 * uPul, uC, 0.45) + stripe(y, uGW * 0.75, uC, 0.9) + stripe(y, uW * 1.8 * uPul, W, 1.0) + stripe(y, uW * 0.7, W, 0.9)) * m;
        float env = pow(max(sin(3.1415927 * min(1.0, x / L)), 0.0), 0.4);
        for (int rib = 0; rib < 3; rib++) {
          float ph = x * 0.045 - age * 24.0 + float(rib) * 2.0943951;
          float off = sin(ph) * 17.0 * sc * env, slope = cos(ph) * 0.045 * 17.0 * sc * env;
          float dp = (y - off) / sqrt(1.0 + slope * slope);
          sum += lineCol(dp, 4.0 * sc, rib == 1 ? W : uHot, 0.75) * m;
        }
        for (int k = 0; k < 5; k++) {
          float f = fract(age * 1.2 + float(k) / 5.0), dk = f * Lh, r = (30.0 + 20.0 * f) * sc;
          sum += ringProf(length(vec2(x - dk, y)) / r, uC).rgb * 0.6 * sin(3.1415927 * f);
        }
      } else {
        sum = stripe(y, uW * 2.4, uC, 0.16) * m;
        for (int k = 0; k < 8; k++) {
          float f = fract(age * 2.4 + float(k) / 8.0), dk = f * L;
          if (dk > Lh) continue;
          vec2 q = vec2((x - dk) / (15.0 * sc), y / (3.0 * sc));
          if (abs(q.x) < 1.0 && abs(q.y) < 1.0) sum += sparkProf(q, uC).rgb;
        }
      }
      sum *= uFade;
      o = vec4(sum, clamp(max(sum.r, max(sum.g, sum.b)), 0.0, 1.0));
    }`;

  // ---- shield hit: dome with a hex lattice, ripple from the impact, rim arcs ----
  const SHIELD_VS = HEAD + `
    uniform vec4 uM0, uM1; uniform vec2 uPix, uCtr; uniform float uPad;
    out vec2 vL;
    void main(){
      vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
      vec2 wp = uCtr + c * uPad; vL = c * uPad;
      vec2 pix = vec2(uM0.x * wp.x + uM0.y * wp.y + uM0.z, uM1.x * wp.x + uM1.y * wp.y + uM1.z);
      gl_Position = vec4(pix.x / uPix.x * 2.0 - 1.0, 1.0 - pix.y / uPix.y * 2.0, 0.0, 1.0);
    }`;
  const SHIELD_FS = HEAD + `
    in vec2 vL; out vec4 o;
    uniform float uR, uAng, uP, uSeed; uniform vec3 uC;
    ${PROFILES}
    float hexDist(vec2 p){ p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
    float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 p = vL; float d = length(p), r = uR, fade = 1.0 - uP;
      vec2 dir = vec2(cos(uAng), sin(uAng));
      vec3 c = uC, hotc = mix(c, vec3(1.0), 0.15);
      float ang = atan(p.y, p.x), da = abs(atan(sin(ang - uAng), cos(ang - uAng)));
      float wd = 0.8 + 0.7 * uP, ring = abs(d - r);
      vec3 sum = vec3(0.0);
      sum += hotc * 0.35 * fade * (1.0 - ss(0.0, (9.0 + r * 0.07) * 0.5, ring)) * (1.0 - ss(wd * 0.5 - 0.15, wd * 0.5 + 0.1, da));
      sum += vec3(1.0) * 0.95 * fade * (1.0 - ss(0.0, (2.0 + r * 0.02) * 0.5, ring)) * (1.0 - ss(wd * 0.35 - 0.1, wd * 0.35 + 0.05, da));
      sum += hotc * 0.18 * fade * (1.0 - ss(0.0, 1.0, ring));
      vec2 I = dir * r; float gr = r * 0.5 * (1.0 - uP * 0.45);
      sum += glowProf(length(p - I) / gr, c).rgb * fade;
      if (d < r && r > 10.0) {
        float rn = clamp(d / r, 0.0, 0.9995);
        vec2 hp = (d > 0.001 ? p / d : vec2(0.0)) * asin(rn) * r;
        vec2 Ih = dir * (1.5707963 * r);
        float cell = clamp(r * 0.13, 6.0, 22.0), wcell = cell * 1.7320508;
        vec2 uv = (hp / wcell).yx, rv = vec2(1.0, 1.7320508), hh = rv * 0.5;
        vec2 a = mod(uv, rv) - hh, b = mod(uv - hh, rv) - hh;
        vec2 gv = dot(a, a) < dot(b, b) ? a : b;
        float edgePx = (0.5 - hexDist(gv)) * wcell;
        vec2 cc = (uv - gv).yx * wcell;
        float lw = max(1.4, r * 0.017) * (0.7 + 0.5 * (1.0 - rn * rn));
        float lines = 1.0 - ss(lw * 0.5 - 0.5, lw * 0.5 + 0.5, edgePx);
        float dist = length(hp - Ih), rp = (0.12 + 1.5 * (1.0 - fade * fade)) * r * 1.2;
        float mk = ringProf(dist / (rp / 0.94), c).a + 0.7 * ringProf(dist / (rp * 0.78 / 0.94), c).a + 0.9 * fade * glowProf(dist / (r * 0.7 * (0.5 + 0.5 * fade)), c).a;
        float front = exp(-pow((length(cc - Ih) - rp) / (0.11 * r), 2.0));
        float cellFlash = front * (0.35 + 0.65 * hash21(floor(cc / 3.0))) * 0.6;
        float rimFade = 1.0 - ss(0.86, 1.0, rn);
        sum += hotc * ((lines + 0.16) * clamp(mk, 0.0, 1.0) * (min(1.0, fade * 1.15) + fade * 0.5) + cellFlash * fade) * rimFade;
      }
      o = vec4(sum, clamp(max(sum.r, max(sum.g, sum.b)), 0.0, 1.0));
    }`;

  // ---- bloom + tone-mapped composite ----
  const BLOOM_DOWN_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThr, uKnee;
    vec3 T(vec2 off){ return texture(uSrc, vUv + off * uTexel).rgb; }
    void main(){
      vec3 a = T(vec2(-2.0, 2.0)), b = T(vec2(0.0, 2.0)), c = T(vec2(2.0, 2.0));
      vec3 d = T(vec2(-2.0, 0.0)), e = T(vec2(0.0, 0.0)), f = T(vec2(2.0, 0.0));
      vec3 g = T(vec2(-2.0, -2.0)), h = T(vec2(0.0, -2.0)), i = T(vec2(2.0, -2.0));
      vec3 j = T(vec2(-1.0, 1.0)), k = T(vec2(1.0, 1.0)), l = T(vec2(-1.0, -1.0)), m = T(vec2(1.0, -1.0));
      vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
      if (uThr >= 0.0) {
        float br = max(r.r, max(r.g, r.b));
        float rq = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee);
        rq = rq * rq / (4.0 * uKnee + 1e-4);
        r *= max(rq, br - uThr) / max(br, 1e-4);
      }
      o = vec4(r, 1.0);
    }`;
  const BLOOM_UP_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uK;
    vec3 T(vec2 off){ return texture(uSrc, vUv + off * uTexel).rgb; }
    void main(){
      vec3 r = T(vec2(-1.0, 1.0)) + T(vec2(1.0, 1.0)) + T(vec2(-1.0, -1.0)) + T(vec2(1.0, -1.0))
             + 2.0 * (T(vec2(0.0, 1.0)) + T(vec2(0.0, -1.0)) + T(vec2(-1.0, 0.0)) + T(vec2(1.0, 0.0))) + 4.0 * T(vec2(0.0, 0.0));
      o = vec4(r * (uK / 16.0), 1.0);
    }`;
  const OUT_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uHdr, uBloom; uniform float uBloomK;
    void main(){
      vec3 c = texture(uHdr, vUv).rgb;
      if (uBloomK > 0.0) c += texture(uBloom, vUv).rgb * uBloomK;
      float m = max(c.r, max(c.g, c.b));
      float tm = m < 0.6 ? m : 0.6 + 0.4 * (1.0 - exp(-(m - 0.6) / 0.4));
      vec3 rgb = c * (tm / max(m, 1e-4));
      rgb = mix(rgb, vec3(tm), ss(1.0, 4.0, m) * 0.35);
      o = vec4(max(rgb, 0.0), clamp(tm, 0.0, 1.0));
    }`;

  function runBloom(g, levels, srcTex, w, h, thr, knee) {
    const pd = prog('bloomDown', BLOOM_DOWN_FS), pu = prog('bloomUp', BLOOM_UP_FS);
    if (!pd || !pu || !levels.length) return null;
    g.disable(g.BLEND);
    let src = srcTex, sw = w, sh = h;
    for (let i = 0; i < levels.length; i++) {
      const f = levels[i];
      g.bindFramebuffer(g.FRAMEBUFFER, f.fb); g.viewport(0, 0, f.w, f.h);
      GL.bindTex(0, src);
      pd.use().i1('uSrc', 0).f2('uTexel', 1 / sw, 1 / sh).f1('uThr', i === 0 ? thr : -1).f1('uKnee', knee);
      GL.drawQuad();
      src = f.tex; sw = f.w; sh = f.h;
    }
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
    for (let i = levels.length - 1; i > 0; i--) {
      const f = levels[i - 1], s = levels[i];
      g.bindFramebuffer(g.FRAMEBUFFER, f.fb); g.viewport(0, 0, f.w, f.h);
      GL.bindTex(0, s.tex);
      pu.use().i1('uSrc', 0).f2('uTexel', 1 / s.w, 1 / s.h).f1('uK', 1.0);
      GL.drawQuad();
    }
    g.disable(g.BLEND);
    return levels[0].tex;
  }

  // ------------------------------------------------------------------ the system
  const TY = { GLOW: 0, SPARK: 1, SMOKE: 2, SHARD: 3, RING: 4, FLASH: 5, FLARE: 6, BIGGLOW: 7, FIREBALL: 8, PLANET: 9, CORE: 10, WARP: 12 };
  const HOLD = 16;
  const STRIDE = 16;   // floats per particle (64 bytes)
  const MAXE = 400;

  function createGL(opts) {
    opts = opts || NO;
    const ultra = tierName() === 'ultra';
    const CAP = opts.capacity || (ultra ? 262144 : 131072), MASK = CAP - 1, BLK = 512, NBLK = CAP / BLK;
    const buf = new ArrayBuffer(CAP * STRIDE * 4), F = new Float32Array(buf), U = new Uint32Array(buf);
    const blkExp = new Float32Array(NBLK);
    let head = 0, total = 0, uploaded = 0, T = 0, liveUntil = 0, normalUntil = 0, quality = 1;
    let gpu = null;                                  // { epoch, buf, vao }
    const beams = [], missiles = [], shields = [], events = [];
    const sys = { shake: 0, flash: 0, quality: 1, bloom: opts.bloom, gain: opts.gain === undefined ? 1 : opts.gain, resScale: opts.resScale || 1, gpu: true, real: true };
    let lastCW = 1280, lastCH = 720;

    const QK = () => clamp(quality, 0.2, 1) * clamp(Q().particles, 0.25, 2) * 1.5;

    // ---- emission ------------------------------------------------------------------
    function emit(ty, x, y, vx, vy, birth, life, s0, s1, c0, c1, drag, ax, ay, inten, extra) {
      const i = head, o = i * STRIDE;
      F[o] = x; F[o + 1] = y; F[o + 2] = vx; F[o + 3] = vy; F[o + 4] = birth; F[o + 5] = life; F[o + 6] = s0; F[o + 7] = s1;
      U[o + 8] = c0; U[o + 9] = c1; F[o + 10] = drag; F[o + 11] = ax; F[o + 12] = ay; F[o + 13] = ty; F[o + 14] = inten; F[o + 15] = extra;
      head = (i + 1) & MASK; total++;
      const b = i >> 9; if ((i & (BLK - 1)) === 0) blkExp[b] = 0;
      const dth = birth + life;
      if (dth > blkExp[b]) blkExp[b] = dth;
      if (dth > liveUntil) liveUntil = dth;
      const t = ty & 15; if ((t === 2 || t === 3) && dth > normalUntil) normalUntil = dth;
    }
    function glow(x, y, vx, vy, life, s0, s1, a0, rp, drag, delay) { emit(TY.GLOW, x, y, vx, vy, T + (delay || 0), life, s0, s1, rp[0], rp[1], drag || 0, 0, 0, a0, 0); }
    function spark(x, y, vx, vy, life, len, wid, a0, rp, drag, rot, delay) { emit(TY.SPARK, x, y, vx, vy, T + (delay || 0), life, len, wid, rp[0], rp[1], drag || 0, 0, 0, a0, rot || 0); }
    function smoke(x, y, vx, vy, life, s0, s1, a0, tint, drag) { emit(TY.SMOKE, x, y, vx, vy, T, life, s0, s1, 0, 0, drag || 0, 0, 0, a0, tint); }
    function shard(x, y, vx, vy, life, size, vr) { emit(TY.SHARD, x, y, vx, vy, T, life, size, 0, 0, 0, 0.5, 0, 0, 1, vr); }
    function ring(x, y, r0, r1, col, dur, a0, delay, ease) { emit(TY.RING, x, y, 0, 0, T + (delay || 0), dur, r0, r1, col, col, 0, 0, 0, a0 === undefined ? 0.85 : a0, ease || 0); }
    function flash(x, y, r, col, dur, a0, delay) { emit(TY.FLASH, x, y, 0, 0, T + (delay || 0), dur, r, 0, col, col, 0, 0, 0, a0 === undefined ? 1 : a0, 0); }
    function flare(x, y, r, col, dur, a0, rot, delay) { emit(TY.FLARE, x, y, 0, 0, T + (delay || 0), dur, r, 0, col, col, 0, 0, 0, a0 === undefined ? 0.8 : a0, rot || 0); }
    function bigglow(x, y, r, col, dur, a0) { emit(TY.BIGGLOW, x, y, 0, 0, T, dur, r, 0, col, col, 0, 0, 0, a0, 0); }
    function fireball(x, y, vx, vy, life, s0, s1, a0, rp, drag) { emit(TY.FIREBALL, x, y, vx, vy, T, life, s0, s1, rp[0], rp[1], drag || 0, 0, 0, a0, 0); }
    // "hold" emitters: refreshed every update; 2-frame triangular envelopes sum to a steady glow
    function hold(ty, x, y, vx, vy, life, s0, s1, c0, c1, a0, extra) { emit(ty | HOLD, x, y, vx, vy, T, life, s0, s1, c0, c1, 0, 0, 0, a0, extra || 0); }
    function shakeAdd(v) { sys.shake = min(34, max(sys.shake, v)); }
    function at(t, fn) { events.push({ t: T + t, fn }); events.sort((a, b) => a.t - b.t); }

    // ---- explosions ----------------------------------------------------------------
    function explosion(x, y, size, o) {
      o = o || NO;
      const s = (size || 40) * (o.scale || 1), kind = RAMP_ID[o.kind] ? o.kind : 'fire', q = QK();
      const energy = kind === 'energy', nova = kind === 'nova';
      const Rc = RC[kind], P0 = RP[kind], P1 = RP1[kind], P2 = RP2[kind];
      flash(x, y, s * (nova ? 2.4 : 1.7), Rc[1], nova ? 0.34 : 0.2, 0.95);
      flash(x, y, s * 0.7, Rc[0], 0.12, 1);
      ring(x, y, s * 0.18, s * (nova ? 2.6 : 1.9), Rc[2], nova ? 0.8 : 0.55, 0.9);
      if (energy) ring(x, y, s * 0.1, s * 1.5, Rc[1], 0.45, 0.7, 0.05);
      if (nova) { ring(x, y, s * 0.1, s * 1.9, Rc[1], 0.7, 0.8, 0.1); ring(x, y, s * 0.1, s * 1.2, Rc[0], 0.55, 0.8, 0.2); }
      if (s >= 46) flare(x, y, s * (nova ? 4.5 : 3), Rc[1], 0.4, 0.7, rand() * 0.3 + 0.01);
      // billowing fireballs (GPU only: noise-eroded volumetric blobs)
      if (s >= 24) {
        const nb = min(7, (2 + s / 45) | 0);
        for (let i = 0; i < nb; i++) { const a = rand() * TAU, d = rand() * s * 0.28, sp = rr(0.05, 0.5) * s; fireball(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, rr(0.55, 1.0) * (nova ? 1.6 : 1), s * rr(0.28, 0.45), s * rr(0.85, 1.25), 0.78, P1, 1.4); }
      }
      // fireball puffs
      const nf = min(160, ((10 + s * 0.28) * q) | 0);
      for (let i = 0; i < nf; i++) {
        const a = rand() * TAU, d = rand() * s * 0.3, sp = (0.25 + rand() * 1.4) * s;
        glow(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, 0.7 + rand() * 0.85, s * rr(0.2, 0.4), s * rr(0.7, 1.3), 0.7, P1, 2.3);
      }
      for (let i = 0; i < 4; i++) glow(x + rr(-0.1, 0.1) * s, y + rr(-0.1, 0.1) * s, 0, 0, 1.0 + rand() * 0.7, s * 0.4, s * rr(0.9, 1.2), 0.62, P1, 0);
      // lingering embers
      const ne = min(160, ((8 + s * 0.24) * q) | 0);
      for (let i = 0; i < ne; i++) { const a = rand() * TAU, sp = rr(0.12, 1.1) * s; glow(x, y, cos(a) * sp, sin(a) * sp, rr(1.1, 2.5), rr(2.2, 4.4), 1.0, 0.95, P2, 0.8); }
      // sparks
      const ns = min(260, ((12 + s * (energy ? 0.8 : 0.5)) * q) | 0);
      for (let i = 0; i < ns; i++) {
        const a = rand() * TAU, sp = s * (2 + rand() * 7);
        spark(x, y, cos(a) * sp, sin(a) * sp, 0.4 + rand() * 0.9, 12 + s * 0.4 * (0.3 + rand()), 1.2 + s * 0.012, 1, P0, 1.0);
      }
      // smoke
      if (!energy && q > 0.4) {
        const nm = min(30, ((4 + s * 0.09) * q) | 0), tint = o.tint !== undefined ? o.tint : (kind === 'plasma' ? 2 : nova ? 3 : kind === 'acid' ? 1 : 0);
        for (let i = 0; i < nm; i++) { const a = rand() * TAU, sp = rr(0.1, 0.65) * s; smoke(x + cos(a) * s * 0.2, y + sin(a) * s * 0.2, cos(a) * sp, sin(a) * sp, rr(2.0, 4.0), s * rr(0.25, 0.45), s * rr(0.9, 1.5), 0.7, tint, 1.1); }
      }
      if (!energy && !nova && o.debris !== false) debris(x, y, min(20, (s * 0.07 * q) | 0), s);
      shakeAdd(s * (nova ? 0.14 : 0.05));
      sys.flash = max(sys.flash, nova ? 0.5 : s > 90 ? 0.18 : 0);
    }
    function debris(x, y, n, size) {
      const s = size || 40, fire = RP.fire;
      n = min(n | 0, 40);
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU, sp = rr(0.6, 2.6) * (s + 30) * 1.3;
        shard(x, y, cos(a) * sp, sin(a) * sp, rr(0.9, 1.9), rr(5, 11) * max(1, sqrt(s / 50)), rr(-9, 9));
        if ((i & 1) === 0) glow(x, y, cos(a) * sp * 0.8, sin(a) * sp * 0.8, rr(0.25, 0.5), rr(4, 8), 1, 0.8, fire, 1);
      }
    }
    function sparks(x, y, n, color) {
      const c = parseColor(color || [255, 220, 150]), rp = constPair(c);
      n = min(n | 0, 400);
      for (let i = 0; i < n; i++) { const a = rand() * TAU, sp = rr(80, 420); spark(x, y, cos(a) * sp, sin(a) * sp, rr(0.25, 0.7), rr(7, 18), 2.2, 1, rp, 1.4); }
      flash(x, y, 14, rp[0], 0.12, 0.9);
    }
    function novaBlast(x, y, r) {
      r = r || 120;
      const Rc = RC.nova, Pn = RP.nova, q = QK();
      flash(x, y, r * 2.8, Rc[1], 0.5, 1);
      flash(x, y, r * 1.0, Rc[0], 0.25, 1);
      ring(x, y, r * 0.1, r * 2.3, Rc[1], 0.9, 0.95);
      ring(x, y, r * 0.1, r * 1.7, Rc[2], 0.75, 0.85, 0.1);
      ring(x, y, r * 0.1, r * 1.1, Rc[0], 0.6, 0.85, 0.22);
      flare(x, y, r * 6, Rc[1], 0.7, 0.85, 0);
      flare(x, y, r * 4, Rc[0], 0.5, 0.6, 0.5);
      bigglow(x, y, r * 1.7, Rc[2], 1.7, 0.55);
      const nb = min(8, (3 + r / 40) | 0);
      for (let i = 0; i < nb; i++) { const a = rand() * TAU, d = rand() * r * 0.35, sp = rr(0.1, 0.7) * r; fireball(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, rr(0.9, 1.7), r * rr(0.35, 0.6), r * rr(1.0, 1.5), 0.75, RP1.nova, 1.0); }
      for (let i = 0; i < min(120, (62 * q) | 0); i++) { const a = rand() * TAU, d = rand() * r * 0.3, sp = rr(0.2, 1.6) * r * 1.3; glow(x + cos(a) * d, y + sin(a) * d, cos(a) * sp, sin(a) * sp, rr(0.6, 1.4), r * rr(0.2, 0.4), r * rr(0.7, 1.3), 0.8, Pn, 1.4); }
      for (let i = 0; i < min(420, (210 * q) | 0); i++) { const a = rand() * TAU, sp = r * (3 + rand() * 8); spark(x, y, cos(a) * sp, sin(a) * sp, rr(0.5, 1.4), 10 + r * 0.25 * rand(), 2.6 + r * 0.02, 1, Pn, 0.9); }
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU + rand() * 0.2, sp = r * 9; spark(x, y, cos(a) * sp, sin(a) * sp, rr(0.6, 1.0), r * 0.7, 3.4, 1, Pn, 1.6); }
      if (q > 0.4) for (let i = 0; i < 20; i++) { const a = rand() * TAU, sp = r * rr(0.2, 0.8); smoke(x, y, cos(a) * sp, sin(a) * sp, rr(1.6, 3), r * 0.3, r * 1.2, 0.5, 3, 1); }
      shakeAdd(r * 0.2); sys.flash = max(sys.flash, 0.8);
    }
    function planetImpact(x, y, r) {
      r = r || 60;
      const Rc = RC.fire, Pf = RP.fire, n = 6 + ((rand() * 3) | 0);
      emit(TY.PLANET, x, y, 0, 0, T, 2.2, r, 0, Rc[3], Rc[3], 0, 0, 0, 1, 0);
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU, d = sqrt(rand()) * r * 0.82, px = x + cos(a) * d, py = y + sin(a) * d, dl = i * rr(0.1, 0.22) + rand() * 0.15, s = r * rr(0.16, 0.3);
        flash(px, py, s * 2, Rc[1], 0.28, 1, dl);
        ring(px, py, s * 0.2, s * 1.4, Rc[2], 0.5, 0.8, dl);
        for (let k = 0; k < 10; k++) { const aa = rand() * TAU, sp = rr(40, 220); emit(TY.GLOW, px, py, cos(aa) * sp, sin(aa) * sp, T + dl, rr(0.4, 0.9), s * rr(0.3, 0.6), s * 0.15, Pf[0], Pf[1], 1.5, 0, 0, 0.9, 0); }
        for (let k = 0; k < 8; k++) { const aa = rand() * TAU, sp = rr(60, 260); emit(TY.SPARK, px, py, cos(aa) * sp, sin(aa) * sp, T + dl, rr(0.3, 0.8), rr(6, 12), 2, Pf[0], Pf[1], 1.2, 0, 0, 1, 0); }
        const sh = r * 0.03; at(dl, () => shakeAdd(sh));
      }
      shakeAdd(r * 0.05);
    }
    function pulse(x, y, r, color) {
      const c = parseColor(color || [98, 216, 255]), cc = pkc(c); r = r || 120;
      for (let k = 0; k < 3; k++) ring(x, y, 0, r, cc, 1.05, (k ? 0.5 : 1) * 0.9, k * 0.2, 2);
      emit(TY.BIGGLOW, x, y, 0, 0, T, 1.5, r, 0, cc, cc, 0, 0, 0, 0.14, 0);
    }
    function warpFlash(x, y, size, o) {
      o = o || NO;
      const c = parseColor(o.color || [190, 225, 255]), cc = pkc(c), s = (size || 50) * (o.scale || 1);
      const ang = o.angle === undefined ? rr(-0.5, 0.5) : o.angle, out = o.mode === 'out' ? 1 : 0;
      emit(TY.WARP, x, y, 0, 0, T, 0.7, s, 0, cc, cc, 0, out, 0, 1, ang);
      for (let i = 0; i < 24; i++) { const d = rr(-1, 1) * s * 1.4; spark(x + cos(ang) * d, y + sin(ang) * d, rr(-40, 40), rr(-40, 40), rr(0.25, 0.6), rr(8, 20), 2, 0.9, [WHITE, cc], 0.6); }
      shakeAdd(s * 0.02);
    }

    // ---- beams ---------------------------------------------------------------------
    function beam(x1, y1, x2, y2, kind, dur, o) {
      o = o || NO;
      const cfg = BEAMS[kind] || BEAMS.laser, sc = o.scale || 1;
      const h = { done: false, x1, y1, x2, y2, kind: kind || 'laser', stop: null, _e: null };
      if (beams.length >= MAXE) { h.done = true; return h; }
      const col = o.color ? parseColor(o.color) : cfg.col, rp = [WHITE, pkc(col)];
      const e = { h, cfg, sc, kind: kind in BEAMS ? kind : 'laser', age: 0, dur: dur || cfg.dur, t0: rand() * 10, acc: 0, acc2: 1, n: 0, seed: 0, col, rp, nextHold: 0 };
      h._e = e; beams.push(e);
      h.stop = function () { const en = h._e; if (en && en.h === h) en.dur = min(en.dur, en.age + 0.06); };
      const a = atan2(y2 - y1, x2 - x1);
      for (let i = 0; i < 9; i++) { const aa = a + rr(-0.5, 0.5), sp = rr(60, 200); spark(x1, y1, cos(aa) * sp, sin(aa) * sp, rr(0.1, 0.28), rr(5, 11), 2, 0.9, rp, 1.5); }
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
      const dx = h.x2 - h.x1, dy = h.y2 - h.y1, ang = atan2(dy, dx), L = hypot(dx, dy);
      e.acc += dt * cfg.rate * (0.5 + 0.5 * quality) * e.sc * 1.6;
      while (e.acc >= 1) {
        e.acc -= 1;
        const a = ang + PI + rr(-1.15, 1.15), sp = rr(90, 400) * e.sc;
        spark(h.x2, h.y2, cos(a) * sp, sin(a) * sp, rr(0.18, 0.46), rr(6, 15) * e.sc, 2, 0.95, e.rp, 1.5);
        if ((e.kind === 'plasma' || e.kind === 'deathray') && rand() < 0.4) glow(h.x2 + rr(-8, 8), h.y2 + rr(-8, 8), cos(a) * sp * 0.3, sin(a) * sp * 0.3, rr(0.25, 0.5), rr(8, 16) * e.sc, rr(16, 28) * e.sc, 0.8, RP[cfg.ramp], 1);
      }
      if (e.kind === 'disruptor') { e.acc2 += dt; if (e.acc2 > 0.04) { e.acc2 = 0; e.seed = (e.seed + 1) % 977; } e.n = clamp((L / 11) | 0, 6, 76); }
      // per-frame held glows: muzzle + impact (+ deathray end flares)
      const fade = min(1, (e.dur - e.age) / min(0.22, e.dur * 0.35)), hl = max(0.03, dt * 2.2), cc = pkc(e.col), sc = e.sc;
      const grow = min(1, e.age / min(0.07, e.dur * 0.25));
      const mz = fade * max(0, 1 - e.age * 4.5);
      if (mz > 0.01) hold(TY.GLOW, h.x1, h.y1, 0, 0, hl, cfg.muz * sc, cfg.muz * sc, cc, cc, mz, 0);
      if (grow >= 1 || e.kind === 'deathray') {
        const ir = cfg.imp * sc * (0.8 + 0.2 * sin(e.age * 47 + e.t0));
        hold(TY.GLOW, h.x2, h.y2, 0, 0, hl, ir, ir, cc, cc, fade * 0.9, 0);
        hold(TY.CORE, h.x2, h.y2, 0, 0, hl, ir * 0.42, ir * 0.42, WHITE, WHITE, fade * 0.8, 0);
      }
      if (e.kind === 'deathray') {
        hold(TY.FLARE, h.x1, h.y1, 0, 0, hl, cfg.muz * 3.2 * sc, 0, cc, cc, fade * 0.8, 0);
        hold(TY.FLARE, h.x2, h.y2, 0, 0, hl, cfg.imp * 3.2 * sc, 0, cc, cc, fade * 0.7, 0);
      }
      return true;
    }
    function drawBeams(g, pb, view) {
      if (!beams.length) return;
      g.bindVertexArray(emptyVA(g));
      pb.use().f4('uM0', view.a, view.c, view.e, 0).f4('uM1', view.b, view.d, view.f, 0).f2('uPix', view.cw, view.ch);
      for (let i = 0; i < beams.length; i++) {
        const e = beams[i], h = e.h, cfg = e.cfg, sc = e.sc, kid = cfg.id;
        const dx = h.x2 - h.x1, dy = h.y2 - h.y1, L = hypot(dx, dy) || 1;
        const fadeT = min(0.22, e.dur * 0.35), fade = e.age > e.dur - fadeT ? max(0, (e.dur - e.age) / fadeT) : 1;
        if (fade <= 0) continue;
        const grow = min(1, e.age / min(0.07, e.dur * 0.25)), pul = 1 + 0.12 * sin(e.age * 52 + e.t0), w = cfg.w * sc, gw = cfg.glow * sc;
        let pad, cap = 4;
        switch (kid) {
          case 0: pad = gw * 0.5 + 3; break;
          case 1: pad = max(gw * 0.5, 7 * sc) + 3; cap = 8 * sc; break;
          case 2: pad = (7 + L * 0.012) * sc + 9 * sc + gw * 0.6 + 3; break;
          case 3: pad = gw * 0.8 + 5.6 * sc + 5; break;
          case 4: pad = max(gw * 0.95, 17 * sc) + 3; cap = 17 * sc; break;
          case 5: pad = max(gw * 1.1, 52 * sc) + 3; cap = 52 * sc; break;
          default: pad = max(w * 1.3, 4 * sc) + 3; cap = 16 * sc;
        }
        const c = e.col;
        pb.f2('uA', h.x1, h.y1).f2('uB', h.x2, h.y2).f1('uPad', pad).f1('uCap', cap)
          .i1('uKind', kid).f1('uLen', L).f1('uAge', e.age).f1('uFade', fade * sys.gain).f1('uGrow', grow).f1('uPul', pul).f1('uW', w).f1('uGW', gw).f1('uSc', sc)
          .f1('uSeed', e.seed).f1('uAmp', (7 + L * 0.012) * sc).f1('uNseg', max(6, e.n || clamp((L / 11) | 0, 6, 76)))
          .f3('uC', c[0] / 255, c[1] / 255, c[2] / 255).f3('uHot', mix255(c[0], 255, 0.3), mix255(c[1], 255, 0.3), mix255(c[2], 255, 0.3));
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      }
    }
    const mix255 = (a, b, t) => (a + (b - a) * t) / 255;

    // ---- missiles (flight model identical to the CPU system, so onHit timing matches) ----
    function missile(x1, y1, x2, y2, speed, kind, o) {
      o = o || NO;
      const cfg = MISSILES[kind] || MISSILES.nuclear, sc = o.scale || 1;
      const h = { done: false, x: x1, y: y1, tx: x2, ty: y2, angle: 0, onHit: o.onHit || null, kind: kind in MISSILES ? kind : 'nuclear', stop: null, _e: null };
      if (missiles.length >= MAXE) { h.done = true; return h; }
      const d0 = hypot(x2 - x1, y2 - y1) || 1, fl = RP[cfg.flame];
      const e = { h, cfg, sc, age: 0, dur: 60, x: x1, y: y1, r: (speed || 320) * cfg.speed, acc: d0, acc2: 0, t0: rand() * 10,
        a: atan2(y2 - y1, x2 - x1) + rr(-0.5, 0.5) * cfg.turn * 2, a1: rr(-1, 1) * (o.arc !== undefined ? o.arc : 0.55), n: cfg.cluster || 0, cc: pkc(cfg.col), bc: RC[cfg.flame][min(2, RC[cfg.flame].length - 1)], fl };
      h._e = e; missiles.push(e);
      h.stop = function () { const en = h._e; if (en && en.h === h) { en.dur = en.age; h.done = true; } };
      h.angle = e.a;
      for (let i = 0; i < 8; i++) { const aa = e.a + rr(-0.6, 0.6), sp = rr(30, 110); spark(x1, y1, cos(aa) * sp, sin(aa) * sp, rr(0.1, 0.3), rr(5, 10), 2, 0.9, fl, 1.5); }
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
      const ca = cos(e.a), sa = sin(e.a), fl = e.fl;
      e.x += ca * step; e.y += sa * step; h.x = e.x; h.y = e.y; h.angle = e.a;
      // trail (denser than the CPU one; same recipes)
      e.acc2 += step;
      const every = (cfg.trail === 'streak' ? 3 : cfg.trail === 'glow' ? 4 * sz : 3.5 * sz) * (quality < 0.5 ? 2 : 1);
      let guard = 0;
      while (e.acc2 >= every && guard++ < 14) {
        e.acc2 -= every;
        const px = e.x - ca * e.acc2, py = e.y - sa * e.acc2;
        if (cfg.trail === 'smoke') {
          smoke(px, py, rr(-8, 8), rr(-8, 8), rr(0.7, 1.35), 3 * sz, 11 * sz, 0.4, cfg.tint, 1.3);
          glow(px, py, 0, 0, 0.18, 7 * sz, 2 * sz, 0.7, fl, 0);
          if (rand() < 0.35) spark(px, py, rr(-30, 30), rr(-30, 30), rr(0.2, 0.5), rr(5, 11), 1.6, 0.9, fl, 1.6);
        } else if (cfg.trail === 'streak') {
          spark(px, py, 0, 0, rr(0.25, 0.4), 22 * sz + 18, 2.4 * sz, 0.9, fl, 0, e.a);
          if (rand() < 0.6) glow(px, py, rr(-10, 10), rr(-10, 10), 0.3, 6 * sz, 2, 0.6, fl, 0);
        } else {
          glow(px, py, rr(-14, 14), rr(-14, 14), rr(0.4, 0.7), 9 * sz, 17 * sz, 0.5, fl, 1);
          if (rand() < 0.6) spark(px, py, rr(-80, 80), rr(-80, 80), rr(0.2, 0.4), rr(6, 12), 2, 0.9, fl, 1.5);
        }
      }
      // head (held glows refreshed each update)
      const fl2 = 0.85 + 0.15 * sin(e.age * 70 + e.t0), hl = max(0.03, dt * 2.2), heads = e.n > 1 ? e.n : 1;
      const progH = prog;
      for (let k = 0; k < heads; k++) {
        let x = e.x, y = e.y;
        if (heads > 1) { const lat = (k - (heads - 1) / 2) * 7 * e.sc * sin(PI * clamp(progH * 1.1, 0, 1)); x += -sa * lat; y += ca * lat; }
        const f3 = fl2 * (1 + k * 0.03), len = 30 * sz * (0.8 + 0.4 * f3);
        hold(TY.GLOW, x, y, ca * sp, sa * sp, hl, 11 * sz * f3, 11 * sz * f3, e.cc, e.cc, 0.95, 0);
        emit(TY.SPARK | HOLD, x - ca * len * 0.5, y - sa * len * 0.5, ca * sp, sa * sp, T, hl, len, 9 * sz / 2.1, e.bc, e.bc, 0, 0, 0, 0.85, e.a);
        emit(TY.SPARK | HOLD, x, y, ca * sp, sa * sp, T, hl, 11 * sz, 3.6 * sz / 2.1, WHITE, WHITE, 0, 0, 0, 1, e.a);
      }
      if (cfg.trail === 'glow') {   // torpedo / antimatter: crackling energy sphere
        const r = 10 * sz * 0.8;
        hold(TY.CORE, e.x, e.y, ca * sp, sa * sp, hl, r * 0.95, r * 0.95, WHITE, WHITE, 0.85, 0);
        if (cfg.flame === 'anti') { const rg = r * (1.4 + 0.5 * sin(e.age * 9)); hold(TY.RING, e.x, e.y, ca * sp, sa * sp, hl, rg * 1.5 * 0.94, rg * 1.5 * 0.94, RC.anti[3], RC.anti[3], 0.6, 0); }
        for (let k = 0; k < 3; k++) {
          const a0 = rand() * TAU, r1 = r * rr(1.1, 1.8);
          spark(e.x + cos(a0) * r * 0.6, e.y + sin(a0) * r * 0.6, ca * sp, sa * sp, 0.06, r1 * 0.9, 1.2, 0.9, fl, 0, a0);
        }
      }
      return true;
    }

    // ---- shield hit ----------------------------------------------------------------
    function shieldHit(x, y, r, angle, color) {
      r = r || 40;
      if (shields.length >= MAXE) return;
      const c = parseColor(color || [120, 215, 255]), ia = angle || 0, cc = pkc(c);
      shields.push({ x, y, r, a: ia, age: 0, dur: 0.75, col: c, seed: rand() * 100 });
      const rp = [cc, cc];
      for (let i = 0; i < 10; i++) { const aa = ia + PI + rr(-1, 1), sp = rr(50, 200); spark(x + cos(ia) * r, y + sin(ia) * r, cos(aa) * sp, sin(aa) * sp, rr(0.15, 0.4), rr(5, 10), 1.8, 0.9, rp, 1.6); }
      liveUntil = max(liveUntil, T + 0.75);
    }
    function drawShields(g, ps, view) {
      if (!shields.length) return;
      g.bindVertexArray(emptyVA(g));
      ps.use().f4('uM0', view.a, view.c, view.e, 0).f4('uM1', view.b, view.d, view.f, 0).f2('uPix', view.cw, view.ch);
      for (let i = 0; i < shields.length; i++) {
        const e = shields[i], p = e.age / e.dur;
        if (p >= 1 || e.r < 4) continue;
        ps.f2('uCtr', e.x, e.y).f1('uPad', e.r * 1.6 + 12).f1('uR', e.r).f1('uAng', e.a).f1('uP', p).f1('uSeed', e.seed)
          .f3('uC', e.col[0] / 255, e.col[1] / 255, e.col[2] / 255);
        g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      }
    }

    // ---- update ----------------------------------------------------------------------
    function update(dt) {
      if (!(dt > 0)) return;
      if (dt > 0.1) dt = 0.1;
      T += dt;
      while (events.length && events[0].t <= T) events.shift().fn();
      for (let i = beams.length - 1; i >= 0; i--) { const e = beams[i]; if (!stepBeam(e, dt)) { beams[i] = beams[beams.length - 1]; beams.pop(); e.h._e = null; } }
      for (let i = missiles.length - 1; i >= 0; i--) { const e = missiles[i]; if (!stepMissile(e, dt)) { missiles[i] = missiles[missiles.length - 1]; missiles.pop(); e.h._e = null; } }
      for (let i = shields.length - 1; i >= 0; i--) { const e = shields[i]; e.age += dt; if (e.age >= e.dur) { shields[i] = shields[shields.length - 1]; shields.pop(); } }
      if (sys.shake) { sys.shake *= pow(0.03, dt); if (sys.shake < 0.05) sys.shake = 0; }
      if (sys.flash) { sys.flash *= pow(0.06, dt); if (sys.flash < 0.01) sys.flash = 0; }
    }

    // ---- GPU resources ----------------------------------------------------------------
    function ensureGpu(g) {
      if (gpu && gpu.epoch === epoch) return gpu;
      const b = g.createBuffer(), vao = g.createVertexArray();
      g.bindVertexArray(vao); g.bindBuffer(g.ARRAY_BUFFER, b);
      g.bufferData(g.ARRAY_BUFFER, CAP * STRIDE * 4, g.DYNAMIC_DRAW);
      g.bindVertexArray(null); g.bindBuffer(g.ARRAY_BUFFER, null);
      gpu = { epoch, buf: b, vao };
      uploaded = 0;                           // (re)upload everything the CPU mirror still holds
      return gpu;
    }
    function upload(g) {
      const n = total - uploaded;
      if (n <= 0) return;
      g.bindBuffer(g.ARRAY_BUFFER, gpu.buf);
      if (n >= CAP) g.bufferSubData(g.ARRAY_BUFFER, 0, F);
      else {
        const s = uploaded & MASK;
        if (s + n <= CAP) g.bufferSubData(g.ARRAY_BUFFER, s * STRIDE * 4, F, s * STRIDE, n * STRIDE);
        else { const n1 = CAP - s; g.bufferSubData(g.ARRAY_BUFFER, s * STRIDE * 4, F, s * STRIDE, n1 * STRIDE); g.bufferSubData(g.ARRAY_BUFFER, 0, F, 0, (n - n1) * STRIDE); }
      }
      g.bindBuffer(g.ARRAY_BUFFER, null);
      uploaded = total;
    }
    function setAttribs(g, first) {
      const base = first * STRIDE * 4, S = STRIDE * 4;
      g.bindBuffer(g.ARRAY_BUFFER, gpu.buf);
      for (let i = 0; i < 6; i++) g.enableVertexAttribArray(i);
      g.vertexAttribPointer(0, 4, g.FLOAT, false, S, base); g.vertexAttribPointer(1, 4, g.FLOAT, false, S, base + 16);
      g.vertexAttribPointer(2, 4, g.UNSIGNED_BYTE, true, S, base + 32); g.vertexAttribPointer(3, 4, g.UNSIGNED_BYTE, true, S, base + 36);
      g.vertexAttribPointer(4, 4, g.FLOAT, false, S, base + 40); g.vertexAttribPointer(5, 2, g.FLOAT, false, S, base + 56);
      for (let i = 0; i < 6; i++) g.vertexAttribDivisor(i, 1);
    }
    // draw the live blocks of the ring buffer (skips dead blocks; at most a handful of ranges)
    function drawLive(g, pass) {
      const used = min(total, CAP), nb = ((used + BLK - 1) / BLK) | 0;
      g.bindVertexArray(gpu.vao);
      let start = -1, ranges = 0, gapMax = 3, lastLive = -1;
      const flushRange = (a, b) => { setAttribs(g, a * BLK); g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, min(used, b * BLK) - a * BLK); ranges++; };
      for (let b = 0; b < nb; b++) {
        if (blkExp[b] > T) {
          if (start < 0) start = b; else if (b - lastLive - 1 > gapMax) { flushRange(start, lastLive + 1); start = b; }
          lastLive = b;
        }
      }
      if (start >= 0) flushRange(start, lastLive + 1);
      g.bindVertexArray(null);
    }

    function viewOf(ctx) {
      const m = ctx.getTransform(), cw = ctx.canvas.width, ch = ctx.canvas.height;
      return { a: m.a, b: m.b, c: m.c, d: m.d, e: m.e, f: m.f, cw, ch, sc: hypot(m.a, m.b) || 1 };
    }
    function anyLive() { return T < liveUntil || beams.length > 0 || missiles.length > 0 || shields.length > 0; }

    function draw(ctx) {
      if (!anyLive() || !ctx) return false;
      const t0 = now(), g = ensure(); if (!g) return false;
      const view = viewOf(ctx), cw = view.cw, ch = view.ch;
      if (!(cw > 1 && ch > 1)) return false;
      lastCW = cw / view.sc; lastCH = ch / view.sc;
      const q = Q();
      const pp = prog('part', PART_FS, PART_VS), pn = prog('partN', PARTN_FS, PART_VS), pb = prog('beam', BEAM_FS, BEAM_VS), psh = prog('shield', SHIELD_FS, SHIELD_VS), po = prog('out', OUT_FS);
      if (!pp || !pn || !pb || !psh || !po) { broken = true; return false; }
      const budget = BUDGET[tierName()] || BUDGET.high;
      let rsc = min(1, sqrt(budget / (cw * ch)), sys.resScale || 1);
      const pw = max(8, Math.round(cw * rsc)), ph = max(8, Math.round(ch * rsc));
      ensureGpu(g); upload(g);
      const setCommon = (p, pass) => {
        p.use().f4('uM0', view.a, view.c, view.e, 0).f4('uM1', view.b, view.d, view.f, 0).f2('uPix', cw, ch).f1('uT', T).f1('uPass', pass).f1('uGain', sys.gain * clamp(q.glow, 0.5, 1.3));
        g.uniform3fv(p.u('uRamp'), RAMP_U); g.uniform1fv(p.u('uRN'), RAMP_N);
      };
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // ---- layer 1: normal-blend smoke and shards
        if (normalUntil > T) {
          GL.begin(pw, ph);
          g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
          setCommon(pn, 1);
          drawLive(g, 1);
          ctx.globalCompositeOperation = 'source-over';
          GL.blit(ctx, 0, 0, cw, ch);
          resetState(g);
        }
        // ---- layer 2: additive HDR scene → bloom → tone-map
        GL.begin(pw, ph);
        const tgt = getTarget(pw, ph), useBloom = sys.bloom === undefined ? !!q.bloom : !!sys.bloom;
        if (!tgt.scene.ok) { broken = true; return false; }
        g.bindFramebuffer(g.FRAMEBUFFER, tgt.scene.fb); g.viewport(0, 0, pw, ph);
        g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
        g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
        if (T < liveUntil) { setCommon(pp, 0); drawLive(g, 0); }
        drawShields(g, psh, view);
        drawBeams(g, pb, view);
        g.disable(g.BLEND);
        let bloomTex = null;
        if (useBloom) bloomTex = runBloom(g, bloomLevels(tgt), tgt.scene.tex, pw, ph, 0.7, 0.5);
        g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, pw, ph); g.disable(g.BLEND);
        GL.bindTex(0, tgt.scene.tex); if (bloomTex) GL.bindTex(1, bloomTex);
        po.use().i1('uHdr', 0).i1('uBloom', 1).f1('uBloomK', bloomTex ? 0.42 * clamp(q.glow, 0.6, 1.3) : 0);
        GL.drawQuad();
        ctx.globalCompositeOperation = 'lighter';
        GL.blit(ctx, 0, 0, cw, ch);
      } finally {
        ctx.restore();
        resetState(g);
      }
      FX.stats.draw = now() - t0;
      return true;
    }

    function clear() {
      head = 0; total = 0; uploaded = 0; liveUntil = 0; normalUntil = 0; blkExp.fill(0);
      beams.forEach(e => { e.h.done = true; e.h._e = null; }); missiles.forEach(e => { e.h.done = true; e.h._e = null; });
      beams.length = 0; missiles.length = 0; shields.length = 0; events.length = 0;
      sys.shake = 0; sys.flash = 0;
    }
    function count() {
      let n = beams.length + missiles.length + shields.length;
      const used = min(total, CAP), nb = ((used + BLK - 1) / BLK) | 0;
      for (let b = 0; b < nb; b++) {
        if (blkExp[b] <= T) continue;
        const hi = min(used, (b + 1) * BLK);
        for (let i = b * BLK; i < hi; i++) { const o = i * STRIDE; if (F[o + 4] + F[o + 5] > T && F[o + 4] <= T) n++; }
      }
      return n;
    }

    // ---- GPU extras ----------------------------------------------------------------------
    // spawn n particles at once: a field of firework bursts + glitter (used to demonstrate the 100k-particle budget)
    function stress(n, o) {
      o = o || NO; n = n | 0;
      const W = o.w || lastCW, H = o.h || lastCH, bursts = max(6, min(48, (n / 4000) | 0)), per = (n / bursts) | 0, names = Object.keys(RAMP_ID);
      for (let b = 0; b < bursts; b++) {
        const cx = rr(0.08, 0.92) * W, cy = rr(0.08, 0.92) * H, kind = names[(b + (rand() * 3 | 0)) % names.length], P0 = RP[kind], P1 = RP1[kind], dl = rand() * 0.8, sp0 = rr(120, 520), life0 = rr(2.2, 5.5);
        for (let i = 0; i < per; i++) {
          const a = rand() * TAU, u = rand(), sp = sp0 * (0.15 + 0.85 * sqrt(u)), r = rand();
          if (r < 0.62) emit(TY.GLOW, cx, cy, cos(a) * sp, sin(a) * sp, T + dl, life0 * rr(0.6, 1.2), rr(1.6, 4.2), 1, P1[0], P1[1], rr(0.5, 1.4), 0, rr(0, 18), 0.9, 0);
          else if (r < 0.98) emit(TY.SPARK, cx, cy, cos(a) * sp * 1.5, sin(a) * sp * 1.5, T + dl, life0 * rr(0.3, 0.8), rr(6, 18), rr(0.7, 1.2), P0[0], P0[1], rr(0.6, 1.3), 0, 0, 1, 0);
          else emit(TY.GLOW, cx, cy, cos(a) * sp * 0.5, sin(a) * sp * 0.5, T + dl, life0 * rr(0.6, 1.0), rr(8, 18), rr(16, 34), P1[0], P1[1], 1.2, 0, 0, 0.16, 0);
        }
        ring(cx, cy, 8, rr(120, 260), RC[kind][2], 0.9, 0.7, dl);
        flash(cx, cy, rr(40, 90), RC[kind][1], 0.25, 0.9, dl);
      }
    }
    sys.update = update; sys.draw = draw; sys.clear = clear; sys.count = count;
    sys.explosion = explosion; sys.debris = debris; sys.sparks = sparks; sys.beam = beam; sys.missile = missile;
    sys.shieldHit = shieldHit; sys.warpFlash = warpFlash; sys.novaBlast = novaBlast; sys.planetImpact = planetImpact; sys.pulse = pulse;
    // kill shockwave: same identity as the CPU system's bright rim + flash + sparks; the dark refraction band is CPU-only (additive buffer here)
    sys.shockwave = function (x, y, r, color) {
      r = r || 80;
      const c = parseColor(color || [255, 220, 160]), pc = pkc(c), pw = pkc([255, 255, 255]), q = quality;
      ring(x, y, r * 0.12, r, pc, 0.42, 0.95);
      flash(x, y, r * 0.45, pw, 0.08, 0.85);
      for (let i = 0; i < min(14, (12 * q) | 0); i++) { const a = rand() * TAU, sp = r * rr(1.6, 3.2); spark(x, y, cos(a) * sp, sin(a) * sp, rr(0.2, 0.45), rr(8, 18), 1.8, 0.9, [pw, pc], 1.6); }
      shakeAdd(r * 0.04);
    };
    sys.ring = function (x, y, r0, r1, color, dur) { ring(x, y, r0, r1, pkc(parseColor(color)), dur || 0.6, 0.85); };
    sys.flashAt = function (x, y, r, color, dur) { flash(x, y, r, pkc(parseColor(color)), dur || 0.25, 1); };
    sys.setQuality = function (q) { quality = clamp(q, 0.2, 1); sys.quality = quality; };
    sys.stats = function () { return { particles: count(), entities: beams.length + missiles.length + shields.length, pool: min(total, CAP), max: CAP }; };
    sys.stress = stress;
    sys.resize = function (w, h) { lastCW = w; lastCH = h; };
    sys.dispose = function () {
      const g = GL && GL.gl && GL.gl();
      if (g && gpu && gpu.epoch === epoch) { g.deleteBuffer(gpu.buf); g.deleteVertexArray(gpu.vao); }
      gpu = null; clear();
    };
    return sys;
  }

  // ------------------------------------------------------------------ public API
  FX.supported = function () { return !broken && !!(GL && GL.supported && GL.supported()); };
  // FX.warm() compiles every program now (blocking; create() relies on the result). FX.warm({async: true}) only queues them for
  // background compilation through GL.precompile (one per idle slot, nothing blocks); a later FX.warm() then just picks them up.
  const WARM_PROGS = [['part', PART_FS, PART_VS], ['partN', PARTN_FS, PART_VS], ['beam', BEAM_FS, BEAM_VS], ['shield', SHIELD_FS, SHIELD_VS], ['out', OUT_FS],
    ['bloomDown', BLOOM_DOWN_FS], ['bloomUp', BLOOM_UP_FS]];
  FX.warm = function (o) {
    const g = ensure(); if (!g) return false;
    if (o && o.async && GL.precompile) { WARM_PROGS.forEach(a => { if (!bad[a[0]] && !(progs[a[0]] && progs[a[0]].epoch === epoch)) GL.precompile('glfx.' + a[0], a[2] || null, a[1]); }); return true; }
    const ok = WARM_PROGS.map(a => !!prog(a[0], a[1], a[2]));
    if (ok.indexOf(false) >= 0) { broken = true; return false; }
    return true;
  };
  FX.ready = function () { return !broken && WARM_PROGS.every(a => (progs[a[0]] && progs[a[0]].epoch === epoch) || (GL.ready && GL.ready('glfx.' + a[0]))); };
  FX.create = function (opts) {
    opts = opts || NO;
    if (!opts.forceGL) {
      const C = M.Gfx.Fx;
      if (!FX.supported() || !FX.warm()) { if (C && C.create) return C.create(opts); }
    }
    return createGL(opts);
  };
  FX.dispose = function () { targets.clear(); };
})(window.MOO);
