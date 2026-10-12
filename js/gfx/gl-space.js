// GPU space art (WebGL2) — OPTIONAL accelerator for MOO.Gfx.Space, same contracts, same look-and-feel, far more spectacle.
// Everything renders through the ONE shared context of MOO.Gfx.GL (begin → draw → blit). Canvas2D fallbacks live in space.js / menu.js.
//
//   GLSpace.supported()                          true when the shared GL core is usable (honours Settings 'gpu' + Perf tier)
//   GLSpace.makeBackdrop(w, h, seed, opts)       → canvas w×h: domain-warped nebula + dust lanes + baked multi-layer starfield
//                                                  opts: palette[hex…] intensity(1) stars(1) vignette(.55) dust(1) scale(3) quality(0..1.5)
//   GLSpace.drawLive(ctx, w, h, t, seed, opts)   animated drifting nebula + twinkling parallax stars, drawn straight into ctx (opts as above
//                                                  + pan:[x,y] css px, twinkle(1), freeze) — nebula layer is re-rendered at ≤24 Hz at reduced res
//   GLSpace.vortex(ctx, cx, cy, R, t, opts)      200k+ star spiral galaxy, additive; opts: tilt(.42) rot(0) seed arms(3) twist density(1) count
//                                                  bloom(Perf.q.bloom) intensity(1) speed(1) palette[core,inner,mid,outer] composite('lighter')
//   GLSpace.makeVortex(seed, o)                  → { draw(ctx, cx, cy, R, t, tilt, rot) }   (drop-in for the menu's CPU vortex object)
//   GLSpace.starSprite(kind, sizePx, opts)       cached glow sprite canvas (sizePx = canvas side); kinds yellow orange red blue white green
//                                                  purple blackhole; opts: spikes(0..1) glow(1) seed
//   GLSpace.makeStarfield(w, h, seed, opts)      transparent canvas with the baked multi-layer stars only
//   GLSpace.warm({vortexSeed, arms})             compile every shader + pre-build the vortex star buffer (call from a loading screen: ~0.6 s cold, ~0.1 s warm)
//   GLSpace.stats                                last CPU-side submit times in ms {backdrop, live, vortex, sprite}
// Effort scales from MOO.Perf.q (dpr, nebula, bloom, particles); never hard-codes counts. Returns false (and draws nothing) when GL is
// unavailable so callers can fall back; makeBackdrop/starSprite/makeStarfield instead delegate to MOO.Gfx.Space when GL is missing.
(function (M) {
  'use strict';
  const GL = M.Gfx.GL;
  const S = M.Gfx.GLSpace = { stats: { backdrop: 0, live: 0, vortex: 0, sprite: 0 } };
  // look-and-feel knobs (read every draw; exposed so the art can be tuned live from a test page)
  S.tune = { vxStar: 0.2, vxDisc: 1.0, vxBulge: 0.16, vxArm: 1.5, vxExposure: 1, vxBloom: 0.45, vxBloomThr: 0.9, nebGain: 1 };
  const TAU = Math.PI * 2;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------------ tiny self-contained helpers
  const DEFQ = { dpr: 1.5, particles: 1, nebula: 1, glow: 1, bloom: true, maxFx: 5000, gl: true, animFps: 60 };
  const Q = () => (M.Perf && M.Perf.q) || DEFQ;
  const tierName = () => (M.Perf && M.Perf.tier) || 'high';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function hashStr(s) {
    s = String(s === undefined || s === null ? 'moo' : s);
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hexRGB(c, d) {
    if (Array.isArray(c)) return c.slice(0, 3);
    if (typeof c !== 'string') return d || [1, 1, 1];
    let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
    if (m) {
      let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join('');
      const n = parseInt(h, 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(c);
    if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
    return d || [1, 1, 1];
  }
  // keep hue, lift dark palette entries so additive shading has something to work with
  function lift(c, target) {
    const mx = Math.max(c[0], c[1], c[2], 0.3);
    const k = target / mx;
    return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
  }
  function ctxScale(ctx) {
    try { const m = ctx.getTransform(); return Math.max(0.25, Math.hypot(m.a, m.b)); } catch (e) { return 1; }
  }

  // ------------------------------------------------------------------ GL plumbing (programs, context-loss epoch, FBOs)
  let epoch = 0, hooked = null;
  const progs = Object.create(null), bad = Object.create(null);
  const caches = [];
  function ensure() {
    if (!GL || !GL.supported || !GL.supported()) return null;
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
    const p = GL.program('gls.' + name, vs || null, fs);
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
  // keep a single named FBO of the requested size alive
  const slots = Object.create(null);
  caches.push({ clear() { for (const k in slots) delete slots[k]; } });
  function slot(name, w, h, wantFloat) {
    const c = slots[name];
    if (c && c.epoch === epoch && c.w === w && c.h === h) return c;
    if (c && c.epoch === epoch) c.dispose();
    return (slots[name] = makeFbo(w, h, wantFloat));
  }
  function resetState(g) {
    g.disable(g.BLEND); g.blendFunc(g.ONE, g.ZERO); g.bindVertexArray(null);
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.activeTexture(g.TEXTURE0);
  }

  // ------------------------------------------------------------------ GLSL
  const NOISE = (GL && GL.glsl && GL.glsl.noise) || '';
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n' +
    'float ss(float a, float b, float x){ float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }\n';
  const UTIL = `
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  `;

  // domain-warped nebula: rgb = emission (low luminance), a = dust-lane density (dims stars behind it)
  const NEB_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform vec2 uRes; uniform float uT; uniform vec3 uOff; uniform vec2 uPan, uDrift;
    uniform float uScale, uDust, uInt; uniform vec3 uPal[4]; uniform int uOct; uniform vec4 uBand; uniform vec3 uCloud;
    ${NOISE}
    vec3 palAt(float x){ x = clamp(x, 0.0, 0.999) * 3.0; int i = int(x); float f = x - float(i); f = f * f * (3.0 - 2.0 * f); return mix(uPal[i], uPal[i + 1], f); }
    void main(){
      float asp = uRes.x / uRes.y;
      vec2 p = (vUv - 0.5) * vec2(asp, 1.0) * uScale + uPan + uOff.xy + uDrift * uT;
      float tz = uOff.z + uT * 0.010;
      vec3 P = vec3(p, tz);
      float big = fbm(vec3(p * 0.30 + 17.0, tz * 0.35), 3);
      vec2 q = vec2(fbm(P, 3), fbm(P + vec3(5.2, 1.3, 2.7), 3));
      vec2 r = vec2(fbm(P + vec3(2.4 * q, 0.0) + vec3(1.7, 9.2, 0.0), 3), fbm(P + vec3(2.4 * q, 0.0) + vec3(8.3, 2.8, 0.0), 3));
      float f = fbm(P + vec3(2.7 * r, 0.0), uOct);
      vec2 cd = vec2((vUv.x - uCloud.x) * asp, vUv.y - uCloud.y);
      float bd = exp(-pow(dot(vUv - vec2(0.5), uBand.xy) / uBand.z - uBand.w, 2.0));
      float mask = clamp(0.30 + 0.55 * bd + 0.60 * exp(-dot(cd, cd) / (uCloud.z * uCloud.z)), 0.0, 1.0);
      float gas = ss(0.30, 0.88, f) * (0.35 + 0.65 * ss(0.20, 0.66, big)) * mask;
      float hue = fbm(vec3(p * 0.42 + 40.0, tz * 0.4), 3) * 1.3 - 0.14 + (f - 0.5) * 0.5 + (r.x - 0.5) * 0.45;
      vec3 c = palAt(hue);
      float fil = pow(clamp(ridged(vec3(p * 2.2 + 1.8 * r, tz * 1.3), 4), 0.0, 1.0), 2.4);
      float core = pow(gas, 2.6);
      vec3 col = c * gas * 0.80 + palAt(hue + 0.3) * fil * gas * 0.95 + (c * 0.7 + 0.10) * core * 0.70;
      float dust = smoothstep(0.50, 0.78, fbm(vec3(p * 1.3 + 1.6 * r + vec2(4.0, -3.0), tz * 0.7 + 9.0), 4)) * uDust;
      dust *= smoothstep(0.10, 0.50, gas + 0.4 * big);
      col *= 1.0 - 0.84 * dust;
      col = (1.0 - exp(-col * 1.30)) * uInt;
      o = vec4(col, dust);
    }`;

  // backdrop composite: base void colour + nebula, vignette, dither (written opaque into the default framebuffer)
  const BACK_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uNeb; uniform vec3 uBase; uniform float uVig;
    ${UTIL}
    void main(){
      vec3 col = uBase + texture(uNeb, vUv).rgb;
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.9);
      float vg = 1.0 - uVig * smoothstep(0.28, 0.82, length(q) * 1.28);
      col *= vg;
      col += (ign(gl_FragCoord.xy) - 0.5) * (1.6 / 255.0);
      o = vec4(col, 1.0);
    }`;

  // instanced star quads (backdrop + live): sub-pixel gaussian cores, soft skirt, diffraction spikes on the few hero stars
  const STAR_VS = HEAD + `
    layout(location=0) in vec4 aA;   // x, y (0..1), sigma (css px), brightness
    layout(location=1) in vec4 aB;   // temperature, phase, layer, spike length (css px)
    uniform vec2 uRes, uDrift, uPan, uShift; uniform float uT, uPx, uTwinkle, uVig, uOccl, uGain;
    uniform sampler2D uNeb;
    out vec2 vC; out vec3 vCol; out vec3 vS;
    void main(){
      vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
      float layer = aB.z, b = aA.w;
      vec2 pos = fract(aA.xy + uDrift * (0.3 + layer) * uT + uPan * (0.2 + layer * 0.8) / uRes);
      float tw = 1.0 + uTwinkle * (0.16 + 0.5 * b) * sin(uT * (1.2 + aB.y * 2.8) + aB.y * 60.0);
      float sig = aA.z * uPx, spike = aB.w * uPx;
      float hs = max(2.5, sig * 3.4 + spike);
      vec2 ndc = (pos * uRes + uShift + corner * hs) / uRes * 2.0 - 1.0;
      gl_Position = vec4(ndc, 0.0, 1.0);
      vC = corner * hs; vS = vec3(sig, spike, hs);
      vec3 col = mix(vec3(1.0, 0.70, 0.46), vec3(0.58, 0.72, 1.0), aB.x);
      col = mix(col, vec3(1.0), 0.30 + 0.55 * b);
      float occl = 1.0 - uOccl * 0.85 * textureLod(uNeb, pos, 0.0).a;
      vec2 qv = (pos - 0.5) * vec2(1.0, 0.9);
      float vg = 1.0 - uVig * 0.6 * smoothstep(0.28, 0.82, length(qv) * 1.28);
      vCol = col * b * tw * occl * vg * uGain;
    }`;
  const STAR_FS = HEAD + `
    in vec2 vC; in vec3 vCol; in vec3 vS; out vec4 o;
    void main(){
      float sig = vS.x, L = vS.y;
      float d2 = dot(vC, vC);
      float I = exp(-d2 / (2.0 * sig * sig)) + 0.16 * exp(-sqrt(d2) / (sig * 2.6));
      if (L > 0.5) {
        float wd = sig * 0.8 + 0.25;
        float h = exp(-abs(vC.y) / wd) * exp(-abs(vC.x) / (L * 0.34));
        float v = exp(-abs(vC.x) / wd) * exp(-abs(vC.y) / (L * 0.34));
        I += 0.6 * (h + v);
      }
      I *= 1.0 - smoothstep(0.55, 1.0, sqrt(d2) / vS.z);
      vec3 c = vCol * I;
      o = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
    }`;

  // ---- bloom (dual-filter chain, HDR) ----
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
  const COPY_FS = HEAD + `
    in vec2 vUv; out vec4 o; uniform sampler2D uSrc;
    void main(){ o = vec4(texture(uSrc, vUv).rgb, 1.0); }`;

  // run the bloom chain: returns the texture holding the blurred highlights (level 0 = half size)
  const bloomState = { levels: [], w: 0, h: 0, epoch: -1 };
  caches.push({ clear() { bloomState.levels = []; bloomState.epoch = -1; } });
  function bloomRun(g, srcTex, w, h, thr, knee, upK) {
    const pd = prog('bloomDown', BLOOM_DOWN_FS), pu = prog('bloomUp', BLOOM_UP_FS);
    if (!pd || !pu) return null;
    const bs = bloomState;
    if (bs.epoch !== epoch || bs.w !== w || bs.h !== h) {
      if (bs.epoch === epoch) for (const f of bs.levels) f.dispose();
      bs.levels = []; bs.w = w; bs.h = h; bs.epoch = epoch;
      let lw = w, lh = h;
      for (let i = 0; i < 5; i++) {
        lw = Math.max(2, lw >> 1); lh = Math.max(2, lh >> 1);
        if (lw < 4 || lh < 4) break;
        bs.levels.push(makeFbo(lw, lh, true));
      }
    }
    const L = bs.levels; if (!L.length) return null;
    g.disable(g.BLEND);
    let src = srcTex, sw = w, sh = h;
    for (let i = 0; i < L.length; i++) {
      const f = L[i];
      g.bindFramebuffer(g.FRAMEBUFFER, f.fb); g.viewport(0, 0, f.w, f.h);
      GL.bindTex(0, src);
      pd.use().i1('uSrc', 0).f2('uTexel', 1 / sw, 1 / sh).f1('uThr', i === 0 ? thr : -1).f1('uKnee', knee);
      GL.drawQuad();
      src = f.tex; sw = f.w; sh = f.h;
    }
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
    for (let i = L.length - 1; i > 0; i--) {
      const f = L[i - 1], s = L[i];
      g.bindFramebuffer(g.FRAMEBUFFER, f.fb); g.viewport(0, 0, f.w, f.h);
      GL.bindTex(0, s.tex);
      pu.use().i1('uSrc', 0).f2('uTexel', 1 / s.w, 1 / s.h).f1('uK', upK);
      GL.drawQuad();
    }
    g.disable(g.BLEND);
    return L[0].tex;
  }

  // ------------------------------------------------------------------ nebula backdrop / live
  const PRESETS = [
    ['#3b1d86', '#14357a', '#7a2a86', '#0d5a7a'],   // indigo · azure · magenta · teal  (the house look)
    ['#4a1d7a', '#7a2a6a', '#1b3a86', '#0f6a6a'],   // violet · rose · blue · teal
    ['#2a1a6a', '#0f4a8a', '#0d6a6a', '#6a2a8a'],   // deep indigo · cobalt · teal · orchid
    ['#5a1a4a', '#2a1a7a', '#8a3a2a', '#1a3a7a'],   // magenta · violet · ember · blue
  ];
  function params(seed, o, w, h) {
    const sh = hashStr(seed), r = rng(sh ^ 0x51ed270b);
    const hex = (o.palette && o.palette.length >= 2) ? o.palette : PRESETS[sh % PRESETS.length];
    const pal = new Float32Array(12);
    for (let i = 0; i < 4; i++) {
      const c = lift(hexRGB(hex[Math.min(hex.length - 1, Math.round(i * (hex.length - 1) / 3))]), 0.88);
      pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2];
    }
    const pan = o.pan || [0, 0];
    // same option semantics as the CPU Space.makeBackdrop: intensity 0..1.5 (default .55), stars = density, vignette boolean (or 0..1 strength)
    const vg = o.vignette === undefined || o.vignette === true ? 0.55 : o.vignette === false ? 0 : clamp(+o.vignette, 0, 1);
    return {
      sh, pal, palKey: hex.join(','),
      off: [r() * 180, r() * 180, r() * 40],
      band: (function () { const a = r() * Math.PI; return [Math.cos(a), Math.sin(a), 0.20 + r() * 0.14, (r() - 0.5) * 0.7]; })(),
      cloud: [0.2 + r() * 0.6, 0.2 + r() * 0.6, 0.22 + r() * 0.2],
      int: clamp(o.intensity === undefined ? 0.55 : o.intensity, 0, 1.6) * 1.15 * S.tune.nebGain,
      vig: vg,
      dust: clamp(o.dust === undefined ? 1 : o.dust, 0, 1.5),
      scale: clamp(o.scale === undefined ? 3.6 : o.scale, 0.6, 12),
      starK: Math.max(0, o.stars === undefined ? 1 : o.stars),
      twinkle: o.twinkle === undefined ? 1 : o.twinkle,
      pan: [pan[0] / Math.max(1, h) * 0.18, -pan[1] / Math.max(1, h) * 0.18], panPx: pan,
      base: [0.011, 0.014, 0.040],
    };
  }
  function octaves(o) {
    const nq = o && o.quality !== undefined ? o.quality : Q().nebula;
    return nq >= 1.2 ? 6 : nq >= 0.95 ? 5 : nq >= 0.7 ? 4 : 3;
  }

  // star field data in normalised coordinates (resolution independent), 8 floats / star
  function genStars(sh, w, h, k, count) {
    const n = Math.min(24000, count !== undefined ? Math.max(0, Math.round(count)) : Math.round(w * h / 520 * k));
    const rnd = rng(sh ^ 0x9e3779b9);
    const A = new Float32Array(n * 8);
    for (let i = 0; i < n; i++) {
      const o = i * 8, hero = rnd() < 0.004;
      const b = hero ? 0.85 + 0.15 * rnd() : 0.06 + 0.62 * Math.pow(rnd(), 3.2);
      const layer = Math.pow(rnd(), 1.4);
      A[o] = rnd(); A[o + 1] = rnd();
      A[o + 2] = 0.42 + 0.42 * b + layer * 0.14;
      A[o + 3] = b;
      A[o + 4] = rnd(); A[o + 5] = rnd(); A[o + 6] = layer;
      A[o + 7] = hero ? 14 + rnd() * 30 : 0;
    }
    return { data: A, n };
  }
  function uploadStars(g, st) {
    const buf = g.createBuffer(), vao = g.createVertexArray();
    g.bindVertexArray(vao); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, st.data, g.STATIC_DRAW);
    for (let i = 0; i < 2; i++) { g.enableVertexAttribArray(i); g.vertexAttribPointer(i, 4, g.FLOAT, false, 32, i * 16); g.vertexAttribDivisor(i, 1); }
    g.bindVertexArray(null); g.bindBuffer(g.ARRAY_BUFFER, null);
    return { buf, vao, n: st.n, epoch };
  }
  function freeStars(g, s) { if (s && s.epoch === epoch) { g.deleteBuffer(s.buf); g.deleteVertexArray(s.vao); } }

  function drawNebula(g, fbo, P, t, oct) {
    const p = prog('nebula', NEB_FS); if (!p) return false;
    g.bindFramebuffer(g.FRAMEBUFFER, fbo.fb); g.viewport(0, 0, fbo.w, fbo.h); g.disable(g.BLEND);
    p.use().f2('uRes', fbo.w, fbo.h).f1('uT', t).f3('uOff', P.off[0], P.off[1], P.off[2]).f2('uPan', P.pan[0], P.pan[1]).f2('uDrift', 0.0065, 0.0021)
      .f1('uScale', P.scale).f1('uDust', P.dust).f1('uInt', P.int).i1('uOct', oct).f4('uBand', P.band[0], P.band[1], P.band[2], P.band[3]).f3('uCloud', P.cloud[0], P.cloud[1], P.cloud[2]);
    g.uniform3fv(p.u('uPal'), P.pal);
    GL.drawQuad();
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    return true;
  }
  function drawBackdropComposite(g, pw, ph, nebTex, P, t, stars, pxScale, live, withBase, wrap, gain) {
    g.viewport(0, 0, pw, ph);
    GL.bindTex(0, nebTex);
    if (withBase) {
      const p = prog('backdrop', BACK_FS); if (!p) return false;
      p.use().i1('uNeb', 0).f3('uBase', P.base[0], P.base[1], P.base[2]).f1('uVig', P.vig);
      GL.drawQuad();
    }
    if (stars && stars.n && P.starK > 0) {
      const sp = prog('stars', STAR_FS, STAR_VS); if (!sp) return false;
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
      sp.use().i1('uNeb', 0).f2('uRes', pw, ph).f1('uT', t).f1('uPx', pxScale).f1('uTwinkle', live ? P.twinkle : 0).f1('uVig', withBase ? P.vig : 0)
        .f1('uOccl', withBase ? 1 : 0).f2('uDrift', live ? 0.0016 : 0, live ? 0.0005 : 0).f2('uPan', P.panPx[0] * pxScale, P.panPx[1] * pxScale).f1('uGain', gain || 1);
      g.bindVertexArray(stars.vao);
      if (wrap) {                       // seamless tiling: also draw the 8 neighbouring copies so edge stars wrap around
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          sp.f2('uShift', ox * pw, oy * ph);
          g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, stars.n);
        }
      } else {
        sp.f2('uShift', 0, 0);
        g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, stars.n);
      }
      g.bindVertexArray(null); g.disable(g.BLEND);
    }
    return true;
  }

  const BUDGET = { low: 0.9e6, medium: 1.9e6, high: 3.4e6, ultra: 6.0e6 };
  function pickScale(ctx, w, h) {
    let k = Math.min(ctxScale(ctx), Math.max(1, Q().dpr));
    const budget = BUDGET[tierName()] || BUDGET.high;
    const px = w * h * k * k;
    if (px > budget) k *= Math.sqrt(budget / px);
    return k;
  }

  // ---- static backdrop ----
  function cpuFallback(name, args) {
    const C = M.Gfx.Space;
    if (C && typeof C[name] === 'function') { try { return C[name].apply(C, args); } catch (e) { /* fall through */ } }
    return null;
  }
  S.supported = function () { return !!(GL && GL.supported && GL.supported()); };

  S.makeBackdrop = function (w, h, seed, opts) {
    const t0 = now();
    opts = opts || {};
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const g = ensure();
    let ok = false;
    if (g) {
      const P = params(seed, opts, w, h);
      const st = uploadStars(g, genStars(P.sh, w, h, P.starK));
      const ns = clamp(0.40 + 0.34 * (opts.quality !== undefined ? opts.quality : Q().nebula), 0.5, 0.95);
      const nw = Math.max(16, Math.round(w * ns)), nh = Math.max(16, Math.round(h * ns));
      GL.begin(w, h);
      const neb = slot('bd-neb', nw, nh, true);
      if (drawNebula(g, neb, P, opts.t || 0, octaves(opts))) ok = drawBackdropComposite(g, w, h, neb.tex, P, 0, st, 1, false, true, false, 1);
      if (ok) GL.blit(canvas.getContext('2d'), 0, 0, w, h);
      resetState(g); freeStars(g, st);
    }
    if (!ok) {
      const c = cpuFallback('makeBackdrop', [w, h, seed, opts]);
      if (c) return c;
      const x = canvas.getContext('2d'), gr = x.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#04061a'); gr.addColorStop(1, '#0a0f2e'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    }
    S.stats.backdrop = now() - t0;
    return canvas;
  };

  // same signature as the CPU one: (w, h, seed, count) — count = number of stars (default w*h/2400); `count` may also be an opts object.
  // The result tiles seamlessly (edge stars wrap), so parallax layers can scroll it with modulo offsets.
  S.makeStarfield = function (w, h, seed, count) {
    const opts = (count && typeof count === 'object') ? count : {};
    if (typeof count === 'number') opts.count = count;
    w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const g = ensure();
    if (g) {
      const P = params('sf:' + seed, opts, w, h);
      const n = opts.count !== undefined ? opts.count : Math.round(w * h / 2400);
      const st = uploadStars(g, genStars(P.sh, w, h, P.starK, n * P.starK));
      const nul = slot('bd-null', 4, 4, false);
      GL.begin(w, h);
      if (drawBackdropComposite(g, w, h, nul.tex, P, 0, st, 1, false, false, true, opts.gain === undefined ? 1.25 : opts.gain)) GL.blit(canvas.getContext('2d'), 0, 0, w, h);
      resetState(g); freeStars(g, st);
      return canvas;
    }
    return cpuFallback('makeStarfield', [w, h, seed, count]) || canvas;
  };

  // ---- live backdrop ----
  const liveCache = new Map();
  caches.push({ clear() { liveCache.clear(); } });
  S.drawLive = function (ctx, w, h, t, seed, opts) {
    const t0 = now();
    opts = opts || {};
    const g = ensure(); if (!g) return false;
    const k = pickScale(ctx, w, h);
    const pw = Math.max(2, Math.round(w * k)), ph = Math.max(2, Math.round(h * k));
    const P = params(seed, opts, w, h);
    const ns = clamp(0.36 + 0.30 * (opts.quality !== undefined ? opts.quality : Q().nebula), 0.42, 0.80);
    const nw = Math.max(16, Math.round(pw * ns)), nh = Math.max(16, Math.round(ph * ns));
    const key = P.sh + '|' + nw + 'x' + nh + '|' + P.palKey + '|' + P.scale + '|' + P.dust + '|' + P.int + '|' + P.starK + '|' + Math.round(w) + 'x' + Math.round(h);
    let e = liveCache.get(key);
    if (e && e.epoch !== epoch) { liveCache.delete(key); e = null; }
    if (!e) {
      if (liveCache.size >= 4) {
        const oldest = liveCache.keys().next().value, old = liveCache.get(oldest);
        old.fbo.dispose(); freeStars(g, old.stars); liveCache.delete(oldest);
      }
      e = { epoch, fbo: makeFbo(nw, nh, true), stars: uploadStars(g, genStars(P.sh, w, h, P.starK)), lastT: -1e9, lastPan: [1e9, 1e9] };
      liveCache.set(key, e);
    } else { liveCache.delete(key); liveCache.set(key, e); }   // LRU refresh
    const interval = Q().animFps >= 60 ? 1 / 24 : 1 / 12;
    const panMoved = Math.abs(P.panPx[0] - e.lastPan[0]) + Math.abs(P.panPx[1] - e.lastPan[1]) > 0.5;
    if (!opts.freeze && (Math.abs(t - e.lastT) >= interval || panMoved) || e.lastT < -1e8) {
      if (!drawNebula(g, e.fbo, P, t, octaves(opts))) return false;
      e.lastT = t; e.lastPan = [P.panPx[0], P.panPx[1]];
    }
    GL.begin(pw, ph);
    const ok = drawBackdropComposite(g, pw, ph, e.fbo.tex, P, t, e.stars, k, true, true);
    if (ok) GL.blit(ctx, 0, 0, w, h);
    resetState(g);
    S.stats.live = now() - t0;
    return ok;
  };

  // ------------------------------------------------------------------ galaxy vortex
  // Three populations: arm stars (flow inward along log-spiral arms), axisymmetric haze on differentially rotating orbits, and a dense bulge.
  const VX_VS = HEAD + `
    layout(location=0) in vec4 aA;   // u0, offAng, speed, rScale
    layout(location=1) in vec4 aB;   // size, bright, colorF, phase     (normalised bytes)
    layout(location=2) in vec4 aC;   // z, wobble, armness, puff
    uniform float uT, uFlow, uPow, uB, uPatt, uTilt, uTiltS, uCos, uSin, uHalf, uSz, uSig, uExp, uTw, uSpin, uArms;
    uniform vec3 uPal[4];
    out vec2 vC; out vec3 vCol; out vec3 vS;
    const float RIN = 0.022;
    void main(){
      vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
      float arm = aC.z;
      float flow = step(0.001, aA.z);
      float u = fract(aA.x - uT * uFlow * aA.z);
      float rr = mix(aA.w, aA.w * (RIN + (1.0 - RIN) * pow(u, uPow)), flow);
      float spin = uSpin / pow(rr + 0.10, 0.85);
      float th = aA.y + arm * (uB * log(rr + 0.06) + uPatt * uT) + (1.0 - arm) * spin * uT
               + aC.y * 0.22 * sin(uT * (0.25 + aB.w * 1.4) + aB.w * 25.0);
      vec2 pd = rr * vec2(cos(th), sin(th));
      float z = (aC.x - 0.5) * 0.36;
      vec2 ps = vec2(pd.x, pd.y * uTilt + z * uTiltS);
      vec2 pr = vec2(ps.x * uCos - ps.y * uSin, ps.x * uSin + ps.y * uCos);
      vec2 ndc0 = vec2(pr.x, -pr.y) / uHalf;
      float b = aB.y;
      float fade = mix(1.0, ss(0.0, 0.07, u) * ss(1.0, 0.86, u), flow);
      float tw = 1.0 - uTw * 0.38 * (0.5 + 0.5 * sin(uT * (1.0 + aB.w * 3.0) + aB.w * 50.0));
      float dust = arm * pow(0.5 + 0.5 * cos(aA.y * uArms - 0.95), 6.0);
      float L = (0.045 + 2.4 * b * b * b) * (1.0 + 1.3 * exp(-rr * 7.0)) * fade * tw * uExp * (1.0 - 0.72 * dust * ss(0.04, 0.22, rr));
      float sig = (0.5 + 1.25 * aB.x) * uSig;
      if (aC.w > 0.5) { sig *= 4.5; L *= 0.16; }
      if (b > 0.985) { L *= 2.2; sig *= 1.15; }
      float x = aB.z * 4.0; int i0 = int(x); float fx = x - float(i0);
      vec3 rc = mix(uPal[1], uPal[2], ss(0.08, 0.5, rr)); rc = mix(rc, uPal[3], ss(0.42, 0.95, rr));
      vec3 col = mix(mix(uPal[i0 & 3], uPal[(i0 + 1) & 3], fx), rc, 0.55);
      col = mix(col, uPal[0], ss(0.40, 0.0, rr) * 0.85);
      col = mix(col, vec3(1.0), 0.03 + 0.34 * b);
      float hs = max(2.0, sig * 3.3);
      gl_Position = vec4(ndc0 + corner * hs / (uSz * 0.5), 0.0, 1.0);
      vC = corner * hs; vS = vec3(sig, hs, 0.0);
      vCol = col * L;
    }`;
  const VX_FS = HEAD + `
    in vec2 vC; in vec3 vCol; in vec3 vS; out vec4 o;
    void main(){
      float d2 = dot(vC, vC), sig = vS.x;
      float I = exp(-d2 / (2.0 * sig * sig)) + 0.10 * exp(-sqrt(d2) / (sig * 2.4));
      I *= 1.0 - smoothstep(0.6, 1.0, sqrt(d2) / vS.y);
      o = vec4(vCol * I, 1.0);
    }`;
  // smooth galactic light: core, arms (clumpy, advected inward along the arms), dust lanes, HII knots, anamorphic streak
  const VX_DISC_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform float uT, uTilt, uCos, uSin, uHalf, uB, uPatt, uArms, uInt, uSpeed, uGB, uGA;
    uniform vec3 uPal[4]; uniform float uSeed;
    ${NOISE}
    void main(){
      vec2 s = (vUv * 2.0 - 1.0) * uHalf; s.y = -s.y;
      vec2 q = vec2(s.x * uCos + s.y * uSin, -s.x * uSin + s.y * uCos);
      vec2 d = vec2(q.x, q.y / uTilt);
      float r = length(d);
      if (r > 1.45) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
      float th = atan(d.y, d.x);
      float lg = log(max(r, 0.004) + 0.06);
      float ac = th - (uB * lg + uPatt * uT);
      vec3 nc = vec3(cos(ac) * 1.8, sin(ac) * 1.8, lg * 2.6 + uT * 0.05 * uSpeed + uSeed);
      float n1 = fbm(nc, 4), n2 = fbm(nc * 2.3 + vec3(3.1, 7.7, 1.3), 3);
      float ph = ac * uArms;
      float A = pow(0.5 + 0.5 * cos(ph), 2.2);
      float clump = 0.35 + 1.6 * n1 * n1;
      float edge = ss(1.12, 0.55, r), armMask = smoothstep(0.03, 0.2, r), rad = exp(-r * 2.4);
      float dl = pow(0.5 + 0.5 * cos(ph - 0.95), 6.0) * (0.35 + 1.0 * n2);
      float dust = clamp(dl * 1.3, 0.0, 1.0) * smoothstep(0.05, 0.3, r) * edge;
      float bulge = (1.55 * exp(-r * r * 90.0) + 0.42 * exp(-r * r * 14.0)) * uGB;
      float nuc = 6.5 * exp(-r * r * 1100.0);
      float armL = rad * edge * armMask * (0.06 + 1.3 * A * clump) * uGA;
      float haze = (0.22 * exp(-r * 1.8) + 0.05) * edge;
      float kn = smoothstep(0.56, 0.82, fbm(nc * 4.7 + 9.0, 3)) * A * edge * armMask * rad * 3.4;
      vec3 armCol = mix(uPal[2], uPal[3], smoothstep(0.15, 0.85, r) * 0.9 + 0.1 * n2);
      vec3 col = uPal[0] * (bulge + nuc) + armCol * armL + uPal[1] * kn + uPal[2] * haze;
      col *= 1.0 - 0.78 * dust;
      col += uPal[0] * 0.30 * exp(-abs(s.y) * 38.0) * exp(-abs(s.x) * 2.8);
      o = vec4(col * uInt, 1.0);
    }`;
  const VX_OUT_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uHdr, uBloom; uniform float uBloomK, uExposure;
    ${UTIL}
    void main(){
      vec3 c = texture(uHdr, vUv).rgb;
      if (uBloomK > 0.0) c += texture(uBloom, vUv).rgb * uBloomK;
      c *= uExposure;
      vec2 e = abs(vUv * 2.0 - 1.0);
      c *= 1.0 - smoothstep(0.80, 1.0, max(e.x, e.y));
      float m = max(c.r, max(c.g, c.b));
      float tm = m < 0.6 ? m : 0.6 + 0.4 * (1.0 - exp(-(m - 0.6) / 0.4));
      vec3 rgb = c * (tm / max(m, 1e-4));
      rgb = mix(rgb, vec3(tm), smoothstep(1.0, 4.0, m) * 0.30);
      rgb += (ign(gl_FragCoord.xy) - 0.5) * (1.5 / 255.0) * step(0.004, m);
      o = vec4(max(rgb, 0.0), clamp(tm, 0.0, 1.0));
    }`;

  const VX_PAL = ['#ffd9a0', '#ff72dc', '#8466ff', '#52b4ff'];
  function genVortexStars(sh, n, arms) {
    const rnd = rng(sh ^ 0x7f4a7c15);
    const ab = new ArrayBuffer(n * 24), F = new Float32Array(ab), B = new Uint8Array(ab);
    const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };
    const q8 = x => (x <= 0 ? 0 : x >= 1 ? 255 : (x * 255 + 0.5) | 0);
    const pick = (w) => { let r = rnd(), i = 0; while (i < w.length - 1 && r > w[i]) { r -= w[i]; i++; } return i; };
    const nArm = Math.floor(n * 0.55), nHaze = Math.floor(n * 0.25);
    for (let i = 0; i < n; i++) {
      const o6 = i * 6, o24 = i * 24 + 16;
      let u0, off, spd, rs, size, bright, ci, z, wob, armness, puff = 0;
      const phase = rnd();
      const hero = rnd() < 0.0009;
      if (i < nArm) {                                  // arm stars: flow inward along the log spiral
        u0 = rnd(); spd = 0.55 + 0.9 * rnd(); rs = 1; armness = 1;
        off = rnd() < 0.86 ? Math.floor(rnd() * arms) * TAU / arms + gauss() * 0.19 : rnd() * TAU;
        ci = pick([0.07, 0.31, 0.31, 0.31]);
        bright = 0.08 + 0.92 * Math.pow(rnd(), 3.0);
        size = 0.15 * rnd() + 0.8 * bright;
        z = 0.5 + gauss() * 0.012; wob = rnd();
        if (rnd() < 0.014) { puff = 1; size = 0.7; bright = 0.5; ci = rnd() < 0.7 ? 1 : 2; }
      } else if (i < nArm + nHaze) {                   // haze: axisymmetric, differential rotation
        u0 = 0.9; spd = 0; armness = 0;
        let r = -0.23 * (Math.log(1 - rnd() * 0.999) + Math.log(1 - rnd() * 0.999)); if (r > 1.05) r = rnd() * 0.9;
        rs = Math.max(0.03, r); off = rnd() * TAU;
        ci = pick([0.10, 0.20, 0.40, 0.30]);
        bright = 0.06 + 0.7 * Math.pow(rnd(), 3.2);
        size = 0.12 * rnd() + 0.7 * bright;
        z = 0.5 + gauss() * 0.02; wob = rnd();
      } else {                                         // bulge: dense, warm, tall
        u0 = 0.9; spd = 0; armness = 0;
        rs = Math.max(0.012, Math.abs(gauss()) * 0.115); off = rnd() * TAU;
        ci = pick([0.64, 0.22, 0.14, 0.0]);
        bright = 0.10 + 0.7 * Math.pow(rnd(), 2.6);
        size = 0.1 * rnd() + 0.6 * bright;
        z = 0.5 + gauss() * 0.11; wob = rnd();
      }
      if (hero) { bright = 1; size = 1; puff = 0; }
      F[o6] = u0; F[o6 + 1] = off; F[o6 + 2] = spd; F[o6 + 3] = rs;
      B[o24] = q8(size); B[o24 + 1] = q8(bright); B[o24 + 2] = q8((ci + rnd() * 0.85) / 4); B[o24 + 3] = q8(phase);
      B[o24 + 4] = q8(z); B[o24 + 5] = q8(wob); B[o24 + 6] = q8(armness); B[o24 + 7] = puff ? 255 : 0;
    }
    return ab;
  }
  const vxSets = new Map();
  caches.push({ clear() { vxSets.clear(); } });
  function vortexStars(g, sh, n, arms) {
    const key = sh + '|' + n + '|' + arms;
    let s = vxSets.get(key);
    if (s && s.epoch !== epoch) { vxSets.delete(key); s = null; }
    if (s) return s;
    if (vxSets.size >= 3) {
      const k0 = vxSets.keys().next().value, o = vxSets.get(k0);
      g.deleteBuffer(o.buf); g.deleteVertexArray(o.vao); vxSets.delete(k0);
    }
    const ab = genVortexStars(sh, n, arms);
    const buf = g.createBuffer(), vao = g.createVertexArray();
    g.bindVertexArray(vao); g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, ab, g.STATIC_DRAW);
    g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 4, g.FLOAT, false, 24, 0); g.vertexAttribDivisor(0, 1);
    g.enableVertexAttribArray(1); g.vertexAttribPointer(1, 4, g.UNSIGNED_BYTE, true, 24, 16); g.vertexAttribDivisor(1, 1);
    g.enableVertexAttribArray(2); g.vertexAttribPointer(2, 4, g.UNSIGNED_BYTE, true, 24, 20); g.vertexAttribDivisor(2, 1);
    g.bindVertexArray(null); g.bindBuffer(g.ARRAY_BUFFER, null);
    s = { buf, vao, n, epoch }; vxSets.set(key, s);
    return s;
  }
  const VX_SIDE = { low: 720, medium: 1100, high: 1500, ultra: 2000 };
  const VX_BASE_COUNT = 260000;

  S.vortex = function (ctx, cx, cy, R, t, opts) {
    const t0 = now();
    opts = opts || {};
    const g = ensure(); if (!g || !(R > 2)) return false;
    const q = Q(), T = S.tune;
    const tilt = clamp(opts.tilt === undefined ? 0.42 : opts.tilt, 0.12, 1);
    const rot = opts.rot || 0, arms = Math.max(1, Math.round(opts.arms || 3));
    const MARG = 1.3, cssSide = 2 * MARG * R;
    const kdev = Math.min(ctxScale(ctx), Math.max(1, q.dpr));
    const rs = Math.min(kdev, (VX_SIDE[tierName()] || 1500) / cssSide);
    const side = Math.max(48, Math.ceil(cssSide * rs / 16) * 16);
    const unitPx = side / (2 * MARG);
    const sh = hashStr(opts.seed === undefined ? 'vortex' : opts.seed);
    const n = clamp(Math.round((opts.count || VX_BASE_COUNT * q.particles) * (opts.density === undefined ? 1 : opts.density)), 2000, 700000);
    const set = vortexStars(g, sh, n, arms);
    const ts = t * (opts.speed === undefined ? 1 : opts.speed);
    const useBloom = opts.bloom === undefined ? q.bloom : opts.bloom;
    const ps = prog('vxStars', VX_FS, VX_VS), pd = prog('vxDisc', VX_DISC_FS), po = prog('vxOut', VX_OUT_FS), pc = prog('copy', COPY_FS);
    if (!ps || !pd || !po || !pc) return false;
    const palHex = opts.palette && opts.palette.length >= 4 ? opts.palette : VX_PAL;
    const pal = new Float32Array(12);
    for (let i = 0; i < 4; i++) { const c = hexRGB(palHex[i]); pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2]; }
    const cs = Math.cos(rot), sn = Math.sin(rot), tiltS = Math.sqrt(Math.max(0, 1 - tilt * tilt));
    const inten = opts.intensity === undefined ? 1 : opts.intensity;
    const twist = opts.twist === undefined ? 2.2 : opts.twist;
    const flow = 1 / (opts.cycle || 120), patt = 0.055;

    GL.begin(side, side);
    // 1. smooth disc light at reduced resolution
    const dsc = clamp(0.36 + 0.3 * q.nebula, 0.45, 0.8);
    const dw = Math.max(32, Math.round(side * dsc / 8) * 8);
    const disc = slot('vx-disc', dw, dw, true), hdr = slot('vx-hdr', side, side, true);
    g.bindFramebuffer(g.FRAMEBUFFER, disc.fb); g.viewport(0, 0, dw, dw); g.disable(g.BLEND);
    pd.use().f1('uT', ts).f1('uTilt', tilt).f1('uCos', cs).f1('uSin', sn).f1('uHalf', MARG).f1('uB', twist).f1('uPatt', patt).f1('uArms', arms)
      .f1('uInt', 0.9 * inten * T.vxDisc).f1('uSpeed', 1).f1('uSeed', (sh % 1000) * 0.1).f1('uGB', T.vxBulge).f1('uGA', T.vxArm);
    g.uniform3fv(pd.u('uPal'), pal);
    GL.drawQuad();
    // 2. HDR scene: disc + additive stars
    g.bindFramebuffer(g.FRAMEBUFFER, hdr.fb); g.viewport(0, 0, side, side);
    GL.bindTex(0, disc.tex);
    pc.use().i1('uSrc', 0); GL.drawQuad();
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE);
    const uExp = Math.sqrt(VX_BASE_COUNT / n) * inten * 0.85 * T.vxStar;
    ps.use().f1('uT', ts).f1('uFlow', flow).f1('uPow', 1.7).f1('uB', twist).f1('uPatt', patt).f1('uTilt', tilt).f1('uTiltS', tiltS).f1('uCos', cs).f1('uSin', sn)
      .f1('uHalf', MARG).f1('uSz', side).f1('uSig', Math.max(0.75, unitPx / 520 * 1.15)).f1('uExp', uExp).f1('uTw', 1).f1('uSpin', 0.42).f1('uArms', arms);
    g.uniform3fv(ps.u('uPal'), pal);
    g.bindVertexArray(set.vao);
    g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, set.n);
    g.bindVertexArray(null); g.disable(g.BLEND);
    // 3. bloom
    let bloomTex = null;
    if (useBloom) bloomTex = bloomRun(g, hdr.tex, side, side, T.vxBloomThr, 0.45, 1.0);
    // 4. tone-map to the shared canvas
    g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, side, side); g.disable(g.BLEND);
    GL.bindTex(0, hdr.tex); if (bloomTex) GL.bindTex(1, bloomTex);
    po.use().i1('uHdr', 0).i1('uBloom', 1).f1('uBloomK', bloomTex ? T.vxBloom * Math.max(0.6, q.glow) : 0).f1('uExposure', T.vxExposure);
    GL.drawQuad();
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = opts.composite || 'lighter';
    GL.blit(ctx, cx - MARG * R, cy - MARG * R, cssSide, cssSide);
    ctx.globalCompositeOperation = prevOp;
    g.activeTexture(g.TEXTURE0);
    resetState(g);
    S.stats.vortex = now() - t0;
    return true;
  };
  S.makeVortex = function (seed, o) {
    const base = Object.assign({ seed: seed === undefined ? 'vortex' : seed }, o || {});
    return { draw(ctx, cx, cy, R, t, tilt, rot) { return S.vortex(ctx, cx, cy, R, t, Object.assign({}, base, { tilt, rot })); } };
  };

  // ------------------------------------------------------------------ star sprites (proportions + palette follow the CPU Space.starSprite)
  const STAR = {
    yellow: { core: '#fffbe0', glow: '#ffd25a', rgb: [255, 224, 120] },
    orange: { core: '#ffeacc', glow: '#ff9a3a', rgb: [255, 156, 64] },
    red: { core: '#ffd2bc', glow: '#ff4a2e', rgb: [255, 84, 52] },
    blue: { core: '#eef6ff', glow: '#5a9cff', rgb: [104, 164, 255] },
    white: { core: '#ffffff', glow: '#d6e2ff', rgb: [232, 238, 255] },
    green: { core: '#f4fff2', glow: '#58f08c', rgb: [160, 255, 176] },
    purple: { core: '#f6eaff', glow: '#9a50ff', rgb: [196, 120, 255] },
    blackhole: { core: '#fff2d8', glow: '#ff9a40', rgb: [255, 170, 80] },
  };
  S.STAR_KINDS = ['yellow', 'orange', 'red', 'blue', 'white', 'green', 'purple', 'blackhole'];
  S.starColor = function (kind) { const s = STAR[kind] || STAR.yellow; return { core: s.core, glow: s.glow, rgb: s.rgb.slice() }; };

  const SPR_FS = HEAD + `
    in vec2 vUv; out vec4 o;
    uniform vec3 uCore, uRgb, uGlow;
    uniform float uKind, uKs, uHk, uGlowK, uSpikes, uJets, uSeed, uPx;
    ${NOISE}
    vec3 bhRamp(float t){ t = clamp(t, 0.0, 1.0); vec3 a = vec3(1.0, 0.96, 0.84), b = vec3(1.0, 0.70, 0.36), c = vec3(0.84, 0.30, 0.14); return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0); }
    void main(){
      vec2 d = (vUv - 0.5) * 2.0; d.y = -d.y;                 // canvas orientation (y down), units of the half-size
      float r = length(d);
      float win = 1.0 - ss(0.60, 1.0, r); win *= win;
      vec3 col = vec3(0.0); vec4 hz = vec4(0.0);
      if (uKind < 0.5) {
        float c1 = exp(-pow(r / (0.085 * uKs), 2.0)) * 1.9, c2 = exp(-pow(r / (0.18 * uKs), 1.6));
        float c3 = 0.60 * uHk / (1.0 + pow(r / 0.22, 2.0)), c4 = 0.22 * uHk * exp(-pow(r / 0.55, 1.6));
        float ang = atan(d.y, d.x);
        float rays = 0.86 + 0.28 * vnoise(vec3(cos(ang) * 2.4, sin(ang) * 2.4, uSeed * 3.0 + r * 3.0));
        float gran = uPx >= 40.0 ? fbm(vec3(d / (0.18 * uKs) * 2.4, uSeed), 3) : 0.5;
        float halo = (c3 + c4) * win * uGlowK * rays;
        col = uCore * c1 + uRgb * c2 * (0.88 + 0.26 * gran * (1.0 - ss(0.10, 0.22, r / uKs))) + uGlow * halo;
        float sp = 0.0;
        if (uSpikes > 0.0) {
          float ax = abs(d.x), ay = abs(d.y), u = (d.x + d.y) * 0.7071, v = (d.x - d.y) * 0.7071;
          sp = (exp(-ay * ay / 0.00012) * pow(max(0.0, 1.0 - ax), 2.2) + exp(-ax * ax / 0.00012) * pow(max(0.0, 1.0 - ay), 2.2)) * 0.9;
          sp += (exp(-v * v / 0.0003) * pow(max(0.0, 1.0 - abs(u) * 1.8), 2.4) + exp(-u * u / 0.0003) * pow(max(0.0, 1.0 - abs(v) * 1.8), 2.4)) * 0.28;
          sp *= win * uSpikes;
        }
        if (uJets > 0.5) sp += exp(-d.x * d.x / 0.0004) * pow(max(0.0, 1.0 - abs(d.y)), 1.6) * 0.8 * win;
        col += sp * mix(uGlow, vec3(1.0), 0.5);
      } else {
        // black hole: horizon, lensed arch + photon ring, tilted accretion disc (near half crosses in front of the horizon)
        float ct = cos(-0.20), st = sin(-0.20);
        float ux = d.x * ct + d.y * st, uy = -d.x * st + d.y * ct;
        float rho = sqrt(ux * ux + (uy / 0.30) * (uy / 0.30)), phi = atan(uy / 0.30, ux);
        float rh = 0.175, rin = 0.26, rout = 0.94, edge = 1.0 - ss(0.78, 1.0, r);
        col = uGlowK * 0.20 * exp(-pow(r / 0.55, 1.5)) * edge * vec3(1.0, 0.62, 0.34);
        float arch = exp(-pow((r - 0.285) / 0.055, 2.0)), top = 0.30 + 0.70 * (0.5 - 0.5 * (uy / max(r, 1e-4)));
        float ring = exp(-pow((r - 0.205) / 0.0135, 2.0)), dop = 0.8 + 0.4 * (ux / max(r, 1e-4));
        col += bhRamp(0.12) * (arch * top * 0.85 + ring * 1.3) * dop * edge;
        float front = 0.0; vec3 dc = vec3(0.0);
        if (rho > rin * 0.94 && rho < rout) {
          float prof = pow(rin / max(rho, rin), 1.7) * ss(rout, rout * 0.7, rho) * ss(rin * 0.94, rin * 1.1, rho);
          float streak = 0.74 + 0.15 * sin(rho * 46.0 + phi * 2.0) + 0.12 * sin(phi * 5.0 + rho * 13.0) + 0.30 * (vnoise(vec3(rho * 30.0, phi * 4.0, uSeed)) - 0.5);
          float dop2 = 1.0 + 0.48 * (ux / max(rho, 1e-3));
          dc = bhRamp(clamp((rho - rin) / (rout - rin) * 1.2, 0.0, 1.0));
          float I = prof * streak * dop2 * 1.3 * edge;
          if (uy > 0.0) front = I;
          if (uy > 0.0 || r > rh * 1.05) col += dc * I;
        }
        if (r < rh) { float fa = clamp(front, 0.0, 1.0); hz = vec4(fa > 0.01 ? dc * fa : vec3(0.0), 1.0); }
      }
      float a = max(col.r, max(col.g, col.b));
      float ia = 1.0 / max(a, 1.0), A = min(a, 1.0);        // same alpha convention as the CPU sprite (colour * its own luminance)
      vec4 res = vec4(col * ia * A, A);
      if (hz.a > 0.5) res = hz;
      o = res;
    }`;
  const spriteCache = new Map();
  S.starSprite = function (kind, sizePx, opts) {
    const t0 = now();
    opts = opts || {};
    kind = STAR[kind] ? kind : 'yellow';
    const dpr = opts.dpr > 0 ? opts.dpr : 1;
    const N = clamp(Math.round((sizePx || 64) * dpr), 8, 1024);
    const spikes = !!opts.spikes, glowK = opts.glow !== undefined ? opts.glow : 1;
    const key = kind + '|' + N + '|' + (spikes ? 1 : 0) + '|' + glowK;
    const hit = spriteCache.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = N;
    const g = ensure(); let ok = false;
    if (g) {
      const p = prog('sprite', SPR_FS);
      if (p) {
        const st = STAR[kind], c0 = hexRGB(st.core), c1 = hexRGB(st.glow), c2 = [st.rgb[0] / 255, st.rgb[1] / 255, st.rgb[2] / 255];
        const ks = kind === 'blue' ? 0.85 : kind === 'red' ? 1.25 : kind === 'orange' ? 1.1 : kind === 'purple' ? 0.7 : 1.0;
        const hk = kind === 'red' ? 1.15 : kind === 'blue' ? 1.1 : 1.0;
        GL.begin(N, N);
        p.use().f3('uCore', c0[0], c0[1], c0[2]).f3('uGlow', c1[0], c1[1], c1[2]).f3('uRgb', c2[0], c2[1], c2[2]).f1('uKind', kind === 'blackhole' ? 1 : 0)
          .f1('uKs', ks).f1('uHk', hk).f1('uGlowK', glowK).f1('uSpikes', spikes ? 1 : 0).f1('uJets', kind === 'purple' ? 1 : 0)
          .f1('uSeed', hashStr(kind) % 97 + (opts.seed || 0)).f1('uPx', N);
        GL.drawQuad();
        GL.blit(canvas.getContext('2d'), 0, 0, N, N);
        resetState(g); ok = true;
      }
    }
    if (!ok) { const c = cpuFallback('starSprite', [kind, sizePx, opts]); if (c) return c; }
    if (spriteCache.size > 96) spriteCache.delete(spriteCache.keys().next().value);
    spriteCache.set(key, canvas);
    S.stats.sprite = now() - t0;
    return canvas;
  };

  // ------------------------------------------------------------------ lifecycle
  // compile every shader and pre-build the default vortex star set (o.vortexSeed / o.arms match the vortex() opts you intend to use)
  S.warm = function (o) {
    const g = ensure(); if (!g) return false;
    o = o || {};
    [['nebula', NEB_FS], ['backdrop', BACK_FS], ['stars', STAR_FS, STAR_VS], ['vxStars', VX_FS, VX_VS], ['vxDisc', VX_DISC_FS], ['vxOut', VX_OUT_FS],
      ['copy', COPY_FS], ['bloomDown', BLOOM_DOWN_FS], ['bloomUp', BLOOM_UP_FS], ['sprite', SPR_FS]].forEach(a => prog(a[0], a[1], a[2]));
    if (o.vortex !== false) vortexStars(g, hashStr(o.vortexSeed === undefined ? 'vortex' : o.vortexSeed), clamp(Math.round(VX_BASE_COUNT * Q().particles), 2000, 700000), Math.max(1, Math.round(o.arms || 3)));
    return true;
  };
  S.dispose = function () {
    const g = GL && GL.gl && GL.gl();
    if (g) {
      for (const e of liveCache.values()) { if (e.epoch === epoch) { e.fbo.dispose(); freeStars(g, e.stars); } }
      for (const s of vxSets.values()) if (s.epoch === epoch) { g.deleteBuffer(s.buf); g.deleteVertexArray(s.vao); }
      for (const k in slots) if (slots[k].epoch === epoch) slots[k].dispose();
      for (const f of bloomState.levels) if (bloomState.epoch === epoch) f.dispose();
    }
    liveCache.clear(); vxSets.clear(); spriteCache.clear(); bloomState.levels = []; bloomState.epoch = -1;
    for (const k in slots) delete slots[k];
  };
})(window.MOO);
