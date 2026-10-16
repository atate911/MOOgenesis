/* =========================================================================
   MOO.Gfx.Planets — procedural, animated, lit planets (the game's visual centrepiece).

   Pipeline
     1. Per (look, seed): seamless equirectangular textures are generated from 3-D simplex noise sampled on the
        sphere (no seams / pole pinching).  Channels: albedo RGB + glow, relief gradient + city potential + gloss,
        cloud alpha.  Generation is row-sliced so it can run in the background (preload / progressive draw).
     2. Per (radius, tilt): a sphere lookup table (texture coords, normals, edge coverage) is built once.
     3. Per light direction: lighting tables (lambert, bump vectors, specular, atmosphere haze, ring shadows).
     4. Per frame: one tight pixel loop samples the textures at the spin offset, adds relief lighting, cloud
        shading + shadows, specular, glow, night-side city lights and atmosphere, then putImageData -> drawImage.
   Everything is original procedural art; no external assets.

   API  (MOO.Gfx.Planets)
     LOOKS                               the 16 look keys; unknown keys fall back to 'barren'
     desc = {look, seed (int|string), rings, bands:'jovian'|'saturn'|'ice'|'storm', inhabited, color:'#hex'}
     sprite(desc, diameterPx, {dpr=1, lightAngle, lightElev, clouds, atmosphere, lights, phase, onReady(cv), sync}) -> cached canvas (diameterPx*dpr square)
                                         never blocks: drawn from the best tier built so far (cv.pending = true), repainted IN PLACE as tiers land;
                                         onReady fires when final, MOO.Bus 'planets:sprite' (desc, cv, final) on every repaint; sync:true = old blocking behaviour
     draw(ctx, desc, cx, cy, radius, t, {dpr, lightAngle=-2.3, lightElev=.55, spin=.015, clouds, atmosphere, lights, cloudShadows})
                                         first frame of a new planet uses a cheap 64 px placeholder texture; real tiers arrive in the background
     drawAsteroids(ctx, desc, cx, cy, w, h, t, {count, lightAngle})   parallax field of tumbling rocks, clipped to w x h
     preload(descs, done, progressFn | {onProgress, sizes:[px..], spriteOpts, tier, budget})   timed slices, never freezes the UI
     clear()                             drop all caches
   ========================================================================= */
(function (M) {
  'use strict';
  var Gfx = M.Gfx = M.Gfx || {};

  var PI = Math.PI, TAU = PI * 2;
  var sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, abs = Math.abs, floor = Math.floor, ceil = Math.ceil,
    pow = Math.pow, exp = Math.exp, atan2 = Math.atan2, asin = Math.asin, min = Math.min, max = Math.max;
  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : Date.now;

  /* ---------------------------------------------------------------- small helpers */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, x) { var t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function mixf(a, b, t) { return a + (b - a) * t; }

  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return h >>> 0;
  }
  function mixInt(x) {
    x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16;
    return x >>> 0;
  }
  function seedOf(v) {
    if (typeof v === 'number' && isFinite(v) && v === (v | 0)) return mixInt((v | 0) + 0x9e3779b9);
    if (v === undefined || v === null) return mixInt(1);
    return hashStr(String(v));
  }
  function sub(seed, k) { return mixInt((seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0); }
  function rng32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 3-D simplex noise (Gustavson) with seeded permutation; returns {n, fbm, ridged} */
  function makeNoise(seed) {
    var rnd = rng32(seed), p = new Uint8Array(256), i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = (rnd() * (i + 1)) | 0; t = p[i]; p[i] = p[j]; p[j] = t; }
    var perm = new Uint8Array(512), pm = new Uint8Array(512);
    for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = (perm[i] % 12) * 3; }
    var g = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    var F3 = 1 / 3, G3 = 1 / 6;
    function n(x, y, z) {
      var s = (x + y + z) * F3;
      var i = floor(x + s), j = floor(y + s), k = floor(z + s);
      var tt = (i + j + k) * G3;
      var x0 = x - (i - tt), y0 = y - (j - tt), z0 = z - (k - tt);
      var i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      var x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      var ii = i & 255, jj = j & 255, kk = k & 255;
      var r = 0, gi, t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 > 0) { gi = pm[ii + perm[jj + perm[kk]]]; t0 *= t0; r += t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0 + g[gi + 2] * z0); }
      var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 > 0) { gi = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]]; t1 *= t1; r += t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1 + g[gi + 2] * z1); }
      var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 > 0) { gi = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]]; t2 *= t2; r += t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2 + g[gi + 2] * z2); }
      var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 > 0) { gi = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]]; t3 *= t3; r += t3 * t3 * (g[gi] * x3 + g[gi + 1] * y3 + g[gi + 2] * z3); }
      return 32 * r;
    }
    function fbm(x, y, z, oct, gain) {
      var a = 1, s = 0, nrm = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) {
        s += a * n(x, y, z); nrm += a; a *= gn;
        var tx = x; x = y * 2.02 + 17.3; y = z * 2.02 + 9.1; z = tx * 2.02 + 4.7;
      }
      return s / nrm;
    }
    // ridged: 0..1, sharp crests
    function ridged(x, y, z, oct, gain) {
      var a = 1, s = 0, nrm = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) {
        var v = 1 - abs(n(x, y, z)); v *= v;
        s += a * v; nrm += a; a *= gn;
        var tx = x; x = y * 2.03 + 11.7; y = z * 2.03 + 3.9; z = tx * 2.03 + 8.3;
      }
      return s / nrm;
    }
    return { n: n, fbm: fbm, ridged: ridged };
  }

  /* 3-D cellular noise (nearest 2x2x2 jittered cells): after cell(x,y,z) the result object holds f1,f2 (distances) and h (nearest cell hash) */
  function makeCellular(seed) {
    var r = { f1: 0, f2: 0, h: 0 };
    function cell(x, y, z) {
      var bx = floor(x - 0.5), by = floor(y - 0.5), bz = floor(z - 0.5), f1 = 1e9, f2 = 1e9, hn = 0;
      for (var dz = 0; dz < 2; dz++) for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
        var cx = bx + dx, cy = by + dy, cz = bz + dz;
        var h = mixInt((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791) ^ seed) >>> 0);
        var ex = x - (cx + 0.15 + 0.7 * ((h & 1023) / 1023)), ey = y - (cy + 0.15 + 0.7 * (((h >>> 10) & 1023) / 1023)), ez = z - (cz + 0.15 + 0.7 * (((h >>> 20) & 1023) / 1023));
        var d = ex * ex + ey * ey + ez * ez;
        if (d < f1) { f2 = f1; f1 = d; hn = h; } else if (d < f2) f2 = d;
      }
      r.f1 = sqrt(f1); r.f2 = sqrt(f2); r.h = hn;
    }
    return { cell: cell, r: r };
  }

  /* ---------------------------------------------------------------- colour helpers */
  function parseHex(h) {
    if (typeof h !== 'string') return h;
    var s = h.charAt(0) === '#' ? h.slice(1) : h;
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var v = /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0x808080;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  // stops: [[pos, '#hex' | [r,g,b]], ...] -> Float32Array(256*3)
  function makeRamp(stops) {
    var lut = new Float32Array(768), st = stops.map(function (s) { return [s[0], parseHex(s[1])]; });
    for (var i = 0; i < 256; i++) {
      var t = i / 255, a = st[0], b = st[st.length - 1], k;
      if (t <= a[0]) b = a;
      else if (t >= b[0]) a = b;
      else {
        for (k = 1; k < st.length; k++) if (t <= st[k][0]) { a = st[k - 1]; b = st[k]; break; }
      }
      var f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      lut[i * 3] = mixf(a[1][0], b[1][0], f); lut[i * 3 + 1] = mixf(a[1][1], b[1][1], f); lut[i * 3 + 2] = mixf(a[1][2], b[1][2], f);
    }
    return lut;
  }
  var CR = 0, CG = 0, CB = 0;   // rampAt output registers (avoid allocation in texture loops)
  function rampAt(lut, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var i = ((t * 255 + 0.5) | 0) * 3;
    CR = lut[i]; CG = lut[i + 1]; CB = lut[i + 2];
  }
  var _trig = {};
  function trig(W) {
    var T = _trig[W];
    if (!T) {
      T = _trig[W] = { s: new Float32Array(W), c: new Float32Array(W) };
      for (var x = 0; x < W; x++) { var a = (x + 0.5) / W * TAU; T.s[x] = sin(a); T.c[x] = cos(a); }
    }
    return T;
  }

  /* ================================================================ look catalogue */
  var LOOKS = ['terran', 'jungle', 'ocean', 'arid', 'steppe', 'desert', 'minimal', 'barren', 'tundra', 'dead',
    'inferno', 'toxic', 'radiated', 'gaia', 'gasgiant', 'asteroids'];
  var LOOK_SET = {};
  LOOKS.forEach(function (k) { LOOK_SET[k] = true; });
  var BANDS = ['jovian', 'saturn', 'ice', 'storm'];

  // Render-time parameters (colours 0..255, light factors 0..1)
  var DEF = {
    atm: [0, 0, 0], str: 0, halo: 0, haloW: 0.1, wrap: 0.15, amb: [0.014, 0.014, 0.02], sun: [1.22, 1.16, 1.08],
    limb: 0, tint: [255, 150, 90], tintAmt: 0, bump: 0, spec: 0, specPow: 60, cloudCol: [250, 250, 252], city: 1,
    glow: null, glowDay: 1, gamma: 0.82
  };
  var RAMP_LAVA = [[0, '#000000'], [0.12, '#3a0804'], [0.38, '#a81c06'], [0.62, '#ff6a14'], [0.82, '#ffb83a'], [1, '#fff4c0']];
  var RAMP_RAD = [[0, '#000000'], [0.15, '#0a3a0c'], [0.4, '#2fae18'], [0.65, '#9aee2a'], [0.85, '#e4ff5a'], [1, '#f6ffd0']];
  var RAMP_AURORA = [[0, '#000000'], [0.2, '#06382c'], [0.5, '#20d890'], [0.78, '#7affc4'], [1, '#e6fff6']];
  var CFG = {
    terran: { atm: [118, 176, 255], str: 0.78, halo: 0.62, haloW: 0.10, wrap: 0.30, amb: [0.016, 0.024, 0.052], tint: [255, 150, 90], tintAmt: 0.20, bump: 0.55, spec: 0.85, specPow: 70, cloudCol: [250, 252, 255], city: 1, glow: RAMP_AURORA, glowDay: 0 },
    jungle: { atm: [118, 230, 176], str: 0.72, halo: 0.55, haloW: 0.10, wrap: 0.28, amb: [0.012, 0.026, 0.040], tint: [255, 190, 110], tintAmt: 0.14, bump: 0.65, spec: 0.55, specPow: 55, cloudCol: [236, 248, 240], city: 0.9, glow: RAMP_AURORA, glowDay: 0 },
    ocean: { atm: [96, 170, 255], str: 0.82, halo: 0.66, haloW: 0.11, wrap: 0.32, amb: [0.012, 0.022, 0.056], tint: [255, 150, 100], tintAmt: 0.22, bump: 0.35, spec: 1.0, specPow: 90, cloudCol: [250, 252, 255], city: 0.6, glow: RAMP_AURORA, glowDay: 0 },
    arid: { atm: [240, 160, 110], str: 0.36, halo: 0.30, haloW: 0.08, wrap: 0.14, amb: [0.020, 0.014, 0.013], tint: [255, 160, 100], tintAmt: 0.12, bump: 0.9, cloudCol: [238, 218, 196], city: 0.8 },
    steppe: { atm: [170, 204, 255], str: 0.50, halo: 0.42, haloW: 0.09, wrap: 0.22, amb: [0.016, 0.018, 0.030], tint: [255, 180, 110], tintAmt: 0.14, bump: 0.7, spec: 0.3, specPow: 50, cloudCol: [248, 250, 252], city: 1 },
    desert: { atm: [252, 206, 144], str: 0.40, halo: 0.34, haloW: 0.09, wrap: 0.16, amb: [0.020, 0.016, 0.014], tint: [255, 170, 100], tintAmt: 0.12, bump: 1.0, cloudCol: [244, 230, 210], city: 0.8 },
    minimal: { atm: [198, 210, 228], str: 0.24, halo: 0.20, haloW: 0.07, wrap: 0.10, amb: [0.016, 0.016, 0.020], tint: [220, 200, 190], tintAmt: 0.06, bump: 0.9, cloudCol: [236, 238, 242], city: 0.9 },
    barren: { atm: [0, 0, 0], str: 0, wrap: 0.05, amb: [0.012, 0.012, 0.015], limb: 0.20, bump: 1.05, city: 0.8 },
    tundra: { atm: [190, 224, 255], str: 0.48, halo: 0.40, haloW: 0.09, wrap: 0.20, amb: [0.018, 0.024, 0.040], tint: [255, 200, 170], tintAmt: 0.10, bump: 0.8, spec: 0.35, specPow: 40, cloudCol: [246, 250, 255], city: 0.9 },
    dead: { atm: [0, 0, 0], str: 0, wrap: 0.04, amb: [0.010, 0.010, 0.013], limb: 0.25, bump: 1.1, city: 0.8 },
    inferno: { atm: [255, 112, 40], str: 0.88, halo: 0.80, haloW: 0.12, wrap: 0.12, amb: [0.020, 0.010, 0.008], tint: [255, 90, 30], tintAmt: 0.30, bump: 0.9, cloudCol: [104, 84, 78], glow: RAMP_LAVA, glowDay: 0.95, city: 0.7 },
    toxic: { atm: [172, 106, 230], str: 0.92, halo: 0.78, haloW: 0.12, wrap: 0.34, amb: [0.030, 0.026, 0.040], tint: [200, 255, 90], tintAmt: 0.20, bump: 0.4, cloudCol: [236, 236, 170], city: 0.7 },
    radiated: { atm: [150, 255, 90], str: 0.52, halo: 0.62, haloW: 0.17, wrap: 0.10, amb: [0.016, 0.018, 0.016], tint: [190, 255, 120], tintAmt: 0.12, bump: 0.9, cloudCol: [232, 240, 214], glow: RAMP_RAD, glowDay: 0.9, city: 0.7 },
    gaia: { atm: [120, 228, 255], str: 0.82, halo: 0.68, haloW: 0.11, wrap: 0.32, amb: [0.016, 0.026, 0.054], tint: [255, 190, 120], tintAmt: 0.20, bump: 0.5, spec: 0.9, specPow: 75, cloudCol: [252, 254, 255], city: 1, glow: RAMP_AURORA, glowDay: 0 },
    gasgiant: { atm: [255, 226, 180], str: 0.70, halo: 0.50, haloW: 0.09, wrap: 0.42, amb: [0.020, 0.020, 0.026], tint: [255, 170, 120], tintAmt: 0.10, bump: 0.3, city: 0 },
    asteroids: {}
  };
  var BAND_ATM = { jovian: [255, 226, 186], saturn: [255, 236, 190], ice: [140, 214, 255], storm: [214, 150, 255] };
  function cfgOf(look, bands) {
    var c = {}, s = CFG[look] || {}, k;
    for (k in DEF) c[k] = DEF[k];
    for (k in s) c[k] = s[k];
    if (look === 'gasgiant' && bands && BAND_ATM[bands]) c.atm = BAND_ATM[bands];
    if (c.glow && !c.glowLUT) { c.glowLUT = makeRamp(c.glow); }
    return c;
  }

  // cloud-layer generation parameters (null = no separate cloud layer)
  var CLOUDS = {
    terran: { cover: 0.40, scale: 1.45, swirl: 1.0, vort: 2, bands: 0.6, wisp: 0.2, soft: 0.20, max: 0.96 },
    jungle: { cover: 0.52, scale: 1.7, swirl: 0.7, vort: 2, bands: 0.3, wisp: 0.1, soft: 0.26, max: 0.88 },
    ocean: { cover: 0.46, scale: 1.2, swirl: 1.3, vort: 4, bands: 0.4, wisp: 0.15, soft: 0.22, max: 0.96 },
    arid: { cover: 0.14, scale: 2.0, swirl: 0.5, vort: 1, bands: 0.7, wisp: 0.6, soft: 0.16, max: 0.65 },
    steppe: { cover: 0.28, scale: 1.8, swirl: 0.6, vort: 2, bands: 0.5, wisp: 0.4, soft: 0.18, max: 0.85 },
    desert: { cover: 0.09, scale: 2.0, swirl: 0.4, vort: 1, bands: 0.8, wisp: 0.8, soft: 0.14, max: 0.55 },
    minimal: { cover: 0.11, scale: 1.9, swirl: 0.4, vort: 1, bands: 0.5, wisp: 0.5, soft: 0.14, max: 0.55 },
    tundra: { cover: 0.32, scale: 1.7, swirl: 0.7, vort: 2, bands: 0.6, wisp: 0.6, soft: 0.16, max: 0.8 },
    inferno: { cover: 0.32, scale: 1.6, swirl: 0.9, vort: 2, bands: 0.8, wisp: 0.3, soft: 0.18, max: 0.8 },
    toxic: { cover: 0.28, scale: 2.0, swirl: 1.0, vort: 2, bands: 0.8, wisp: 0.9, soft: 0.14, max: 0.5 },
    radiated: { cover: 0.10, scale: 1.9, swirl: 0.5, vort: 1, bands: 0.4, wisp: 0.5, soft: 0.14, max: 0.45 },
    gaia: { cover: 0.32, scale: 1.55, swirl: 0.8, vort: 2, bands: 0.5, wisp: 0.8, soft: 0.22, max: 0.9 }
  };

  /* ================================================================ texture job framework */
  var TIERS = [128, 256, 512, 1024];
  var LOOK_GEN = {};          // look -> function (job, P) -> hooks {field, setup, color, relK}
  var TX = 0, TY = 0, TZ = 0;
  function twistPoint(px, py, pz, ax, ay, az, ang) {
    var c = cos(ang), s = sin(ang), d = (ax * px + ay * py + az * pz) * (1 - c);
    TX = px * c + (ay * pz - az * py) * s + ax * d;
    TY = py * c + (az * px - ax * pz) * s + ay * d;
    TZ = pz * c + (ax * py - ay * px) * s + az * d;
  }
  function octs(job, n) { n += job.octShift; return n < 2 ? 2 : n > 9 ? 9 : n; }

  function makeJob(P, W) {
    var H = W >> 1, N = W * H, tr = trig(W);
    var job = {
      P: P, look: P.look, W: W, H: H, N: N, sinT: tr.s, cosT: tr.c, octShift: Math.round(Math.log(W / 512) / Math.LN2),
      h: new Float32Array(N), rel: new Float32Array(N), cb: null, cd: null,
      surf: new Uint8ClampedArray(N * 4), dat: new Uint8ClampedArray(N * 4), cloud: new Uint8ClampedArray(N),
      hooks: null, stage: 0, row: 0, done: false, tex: null, relK: 0.3, cloudRow: null, cloudFinal: null
    };
    for (var i = 0; i < N; i++) { job.dat[i * 4] = 128; job.dat[i * 4 + 1] = 128; }
    var hk = job.hooks = (LOOK_GEN[P.look] || LOOK_GEN.barren)(job, P);
    if (hk.relK !== undefined) job.relK = hk.relK;
    var cs = hk.clouds !== undefined ? hk.clouds : CLOUDS[P.look];
    if (cs) {
      var cg = makeCloudGen(job, rng32(sub(P.seed, 77)), cs);
      job.cloudRow = cg.row; job.cloudFinal = cg.final;
    }
    return job;
  }

  function stepJob(job, ms) {
    var t0 = now(), hk = job.hooks, H = job.H;
    while (!job.done) {
      switch (job.stage) {
        case 0: if (hk.field && job.row < H) hk.field(job.row++); else { job.stage = 1; job.row = 0; } break;
        case 1: if (hk.setup) hk.setup(); job.stage = 2; job.row = 0; break;
        case 2: if (job.row < H) hk.color(job.row++); else { job.stage = 3; job.row = 0; } break;
        case 3:
          if (job.row < H) gradRow(job, job.row++);
          else { job.stage = job.cloudRow ? 4 : 6; job.row = 0; }
          break;
        case 4: if (job.row < H) job.cloudRow(job.row++); else job.stage = 5; break;
        case 5: job.cloudFinal(); job.stage = 6; break;
        case 6: finishJob(job); job.done = true; break;
      }
      if (ms !== Infinity && now() - t0 > ms) break;
    }
    return job.done;
  }
  // relief gradient (east/north slopes) from job.rel -> dat.R/G
  function gradRow(job, y) {
    var W = job.W, H = job.H, Wm = W - 1, rel = job.rel, dat = job.dat, K = job.relK;
    var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat); if (cl < 0.16) cl = 0.16;
    var kx = K / (2 * (TAU / W) * cl), ky = K / (2 * (PI / H));
    var ya = y > 0 ? y - 1 : 0, yb = y < H - 1 ? y + 1 : H - 1, r0 = y * W, ra = ya * W, rb = yb * W;
    for (var x = 0; x < W; x++) {
      var gx = (rel[r0 + ((x + 1) & Wm)] - rel[r0 + ((x - 1) & Wm)]) * kx;
      var gy = (rel[ra + x] - rel[rb + x]) * ky;
      gx = gx < -1 ? -1 : gx > 1 ? 1 : gx; gy = gy < -1 ? -1 : gy > 1 ? 1 : gy;
      var o = (r0 + x) * 4;
      dat[o] = gx * 127 + 128; dat[o + 1] = gy * 127 + 128;
    }
  }

  function downLevel(L) {
    var W = L.W, H = L.H, w = W >> 1, h = H >> 1;
    var s = new Uint32Array(w * h), d = new Uint32Array(w * h), c = new Uint8ClampedArray(w * h);
    var sb = new Uint8Array(L.s.buffer), db = new Uint8Array(L.d.buffer), so = new Uint8Array(s.buffer), dobuf = new Uint8Array(d.buffer);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var a = ((2 * y) * W + 2 * x), b = a + 1, c2 = a + W, d2 = c2 + 1, o = (y * w + x);
        var a4 = a * 4, b4 = b * 4, c4 = c2 * 4, d4 = d2 * 4, o4 = o * 4;
        for (var k = 0; k < 4; k++) {
          so[o4 + k] = (sb[a4 + k] + sb[b4 + k] + sb[c4 + k] + sb[d4 + k] + 2) >> 2;
          dobuf[o4 + k] = (db[a4 + k] + db[b4 + k] + db[c4 + k] + db[d4 + k] + 2) >> 2;
        }
        c[o] = (L.c[a] + L.c[b] + L.c[c2] + L.c[d2] + 2) >> 2;
      }
    }
    return { W: w, H: h, s: s, d: d, c: c };
  }
  function finishJob(job) {
    if (job.hasCity) bloomCity(job);
    var lv = [{ W: job.W, H: job.H, s: new Uint32Array(job.surf.buffer), d: new Uint32Array(job.dat.buffer), c: job.cloud }];
    var cur = lv[0], bytes = job.N * 9;
    while (cur.W > 32) { cur = downLevel(cur); lv.push(cur); bytes += cur.W * cur.H * 9; }
    job.tex = { W: job.W, levels: lv, bytes: bytes, hasClouds: !!job.cloudRow };
    job.h = job.rel = job.cb = job.cd = null;
  }

  /* quantile helpers: weight rows by cos(lat) so coverage is by surface area */
  function areaQuantile(job, arr, frac) {
    var W = job.W, H = job.H, lo = 1e9, hi = -1e9, i, N = job.N;
    for (i = 0; i < N; i++) { var v = arr[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    var NB = 1024, bins = new Float64Array(NB), sc = (NB - 0.001) / Math.max(1e-9, hi - lo), tot = 0;
    for (var y = 0; y < H; y++) {
      var w = cos((0.5 - (y + 0.5) / H) * PI), r0 = y * W;
      for (var x = 0; x < W; x++) bins[((arr[r0 + x] - lo) * sc) | 0] += w;
      tot += w * W;
    }
    var target = frac * tot, acc = 0, b = 0;
    while (b < NB - 1 && acc + bins[b] < target) acc += bins[b++];
    var q = lo + (b + (bins[b] > 0 ? (target - acc) / bins[b] : 0)) / sc;
    return { q: q, lo: lo, hi: hi };
  }
  // remap job.h so that `cover` of the surface is below 0.5 (sea level)
  function remapSea(job, cover) {
    var h = job.h, r = areaQuantile(job, h, cover), s = r.q, lo = r.lo, hi = r.hi;
    var a = 0.5 / Math.max(1e-9, s - lo), b = 0.5 / Math.max(1e-9, hi - s);
    for (var i = 0, N = job.N; i < N; i++) { var v = h[i]; h[i] = v < s ? (v - lo) * a : 0.5 + (v - s) * b; }
  }
  function normalize01(job, arr) {
    var lo = 1e9, hi = -1e9, N = job.N, i;
    for (i = 0; i < N; i++) { var v = arr[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    var k = 1 / Math.max(1e-9, hi - lo);
    for (i = 0; i < N; i++) arr[i] = (arr[i] - lo) * k;
  }

  /* impact craters stamped as heightfield (job.h) + albedo modulation (job.cb); o = {n:[big,mid,small,tiny], depth, fresh} */
  function stampCraters(job, rnd, o) {
    var W = job.W, H = job.H, h = job.h, Wm = W - 1, sinT = job.sinT, cosT = job.cosT, N = job.N;
    var cb = job.cb || (job.cb = new Float32Array(N));
    function one(rho, big) {
      var cz = rnd() * 2 - 1, cl0 = sqrt(1 - cz * cz), lon = rnd() * TAU;
      var ax = cl0 * sin(lon), ay = cz, az = cl0 * cos(lon);
      var fresh = rnd() < o.fresh, dark = !fresh && rnd() < (o.dark || 0.25);
      var ext = fresh ? 3.6 : 1.8, R2 = rho * ext, clat = asin(ay);
      var y0 = max(0, floor((0.5 - (clat + R2) / PI) * H)), y1 = min(H - 1, ceil((0.5 - (clat - R2) / PI) * H));
      var dep = o.depth * pow(rho / 0.1, 0.55) * (0.7 + 0.6 * rnd()), rimH = dep * (big ? 0.55 : 0.8);
      var ph = rnd() * TAU, nr = 5 + floor(rnd() * 6);
      // tangent basis for ray pattern
      var ex = az, ez = -ax, el = sqrt(ex * ex + ez * ez) || 1; ex /= el; ez /= el;
      var fx = ay * ez, fy = az * ex - ax * ez, fz = -ay * ex;
      for (var y = y0; y <= y1; y++) {
        var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), xa, xb, dl = cl > 0.02 ? R2 / cl : 99;
        if (dl >= PI) { xa = 0; xb = W - 1; }
        else { var xc = lon / TAU * W; xa = floor(xc - dl / TAU * W) - 1; xb = ceil(xc + dl / TAU * W) + 1; }
        for (var xx = xa; xx <= xb; xx++) {
          var x = xx & Wm, dx = cl * sinT[x] - ax, dy = sl - ay, dz = cl * cosT[x] - az;
          var d = sqrt(dx * dx + dy * dy + dz * dz) / rho;
          if (d >= ext) continue;
          var i = y * W + x, q;
          if (d < 1) {
            q = 1 - d * d;
            var bowl = big ? min(1, q * 2.6) : q;
            h[i] = h[i] * (1 - 0.65 * sqrt(q)) - dep * bowl;
            cb[i] += (dark ? -0.30 : -0.10) * q;
            if (big && d < 0.2) h[i] += dep * 0.55 * (1 - d / 0.2);
          }
          if (d > 0.62) {
            var t = (d - 1) / 0.17;
            h[i] += rimH * exp(-t * t) + (d > 1 ? rimH * 0.28 * pow(1 / d, 2.6) : 0);
            cb[i] += 0.07 * exp(-t * t);
          }
          if (fresh && d > 0.9) {
            var vx = cl * sinT[x], vy = sl, vz = cl * cosT[x];
            var du = vx * ex + vz * ez, dv = vx * fx + vy * fy + vz * fz;
            var rays = pow(max(0, cos(atan2(dv, du) * nr + ph)), 3);
            cb[i] += 0.50 * pow(1 / d, 1.5) * (0.45 + 0.55 * rays);
          }
        }
      }
    }
    var cnt = o.n, ranges = [[0.15, 0.30], [0.055, 0.12], [0.022, 0.05], [0.0125, 0.022]], k, m;
    for (k = 0; k < 4; k++) {
      if (k === 3 && job.W < 512) break;
      var c = cnt[k] * (k === 3 ? job.W / 512 : 1);
      for (m = 0; m < c; m++) one(mixf(ranges[k][0], ranges[k][1], pow(rnd(), 1.6)), k === 0);
    }
  }

  /* settlement potential (city lights): clustered blobs x fine speckle; sparse in 0..1 (1 = very few) */
  function makeCity(job, rnd, sparse) {
    var nz = makeNoise(sub(job.P.seed, 313)), cs = [], nS = Math.max(5, Math.round(34 - 26 * sparse)), i;
    for (i = 0; i < nS; i++) {
      var z = rnd() * 2 - 1, c0 = sqrt(1 - z * z), lon = rnd() * TAU, rad = (0.15 + rnd() * 0.26) * (1 - 0.35 * sparse);
      cs.push({ x: c0 * sin(lon), y: z, z: c0 * cos(lon), r2: rad * rad, w: 0.6 + rnd() * 0.7 });
    }
    job.hasCity = true;
    var F = 30, seed = sub(job.P.seed, 314);
    return function (px, py, pz) {
      var dens = 0;
      for (var k = 0; k < nS; k++) {
        var c = cs[k], dx = px - c.x, dy = py - c.y, dz = pz - c.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < c.r2 * 5) dens += c.w * exp(-d2 / c.r2);
      }
      if (dens < 0.05) return 0;
      // jittered-grid point process: discrete city dots, denser inside settlement blobs
      var x = px * F, y = py * F, z = pz * F, bx = floor(x - 0.5), by = floor(y - 0.5), bz = floor(z - 0.5), best = 0, pk = 0.12 + 0.55 * min(1, dens);
      for (var cz = bz; cz < bz + 2; cz++) for (var cy = by; cy < by + 2; cy++) for (var cx = bx; cx < bx + 2; cx++) {
        var h = mixInt((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791) ^ seed) >>> 0);
        if ((h & 255) / 255 > pk) continue;
        var I = ((h >>> 8) & 255) / 255, ex = x - (cx + 0.2 + 0.6 * ((h >>> 16) & 63) / 63), ey = y - (cy + 0.2 + 0.6 * ((h >>> 22) & 63) / 63), ez = z - (cz + 0.2 + 0.6 * ((h >>> 28) & 15) / 15);
        var v = (0.25 + 0.75 * I * I) * exp(-(ex * ex + ey * ey + ez * ez) * 9);
        if (v > best) best = v;
      }
      return min(1, best * min(1.25, dens * 1.6));
    };
  }
  // soft bloom around city dots (3x3 binomial blur + gain) so lights read as glows at planet scale
  function bloomCity(job) {
    var passes = job.W >= 1024 ? 2 : 1;
    for (var pass = 0; pass < passes; pass++) bloomPass(job);
  }
  function bloomPass(job) {
    var W = job.W, H = job.H, Wm = W - 1, dat = job.dat, tmp = new Float32Array(job.N), x, y;
    for (y = 0; y < H; y++) {
      var r0 = y * W, ra = (y > 0 ? y - 1 : 0) * W, rb = (y < H - 1 ? y + 1 : H - 1) * W;
      for (x = 0; x < W; x++) {
        var xl = (x - 1) & Wm, xr = (x + 1) & Wm;
        tmp[r0 + x] = (dat[(r0 + x) * 4 + 2] * 4 + dat[(r0 + xl) * 4 + 2] * 2 + dat[(r0 + xr) * 4 + 2] * 2 + dat[(ra + x) * 4 + 2] * 2 + dat[(rb + x) * 4 + 2] * 2
          + dat[(ra + xl) * 4 + 2] + dat[(ra + xr) * 4 + 2] + dat[(rb + xl) * 4 + 2] + dat[(rb + xr) * 4 + 2]) / 16;
      }
    }
    for (var i = 0, N = job.N; i < N; i++) { var v = dat[i * 4 + 2] * 0.85 + tmp[i] * 1.5; dat[i * 4 + 2] = v > 255 ? 255 : v; }
  }

  /* cloud layer: twisted vortices + zonal shear + warped fbm; thresholded by area quantile so cover is exact */
  function makeCloudGen(job, rnd, spec) {
    var nz = makeNoise(sub(job.P.seed, 901)), W = job.W, H = job.H, sinT = job.sinT, cosT = job.cosT, vs = [], k;
    var cd = job.cd = new Float32Array(job.N), oct = octs(job, 6), octW = octs(job, 4), sc = spec.scale;
    for (k = 0; k < spec.vort; k++) {
      var lat = (rnd() < 0.5 ? -1 : 1) * (0.22 + rnd() * 0.5), lon = rnd() * TAU, cl = cos(lat);
      vs.push({ x: cl * sin(lon), y: sin(lat), z: cl * cos(lon), rho: 0.13 + rnd() * 0.17, s: (lat < 0 ? -1 : 1) * (1.5 + rnd() * 1.3) * spec.swirl });
    }
    var ph1 = rnd() * TAU, ph2 = rnd() * TAU, bf = 5 + rnd() * 4, bandAmp = spec.bands * 0.20, wisp = spec.wisp, nv = vs.length;
    var wa = spec.warp !== undefined ? spec.warp : 0.12 + 0.05 * spec.swirl;
    function row(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var px = cl * sinT[x], py = sl, pz = cl * cosT[x];
        var a = bandAmp * (sin(py * bf + ph1) * 0.7 + sin(py * bf * 2.3 + ph2) * 0.3);
        var ca = cos(a), sa = sin(a), qx = px * ca + pz * sa, qy = py, qz = pz * ca - px * sa;
        for (var k = 0; k < nv; k++) {
          var v = vs[k], dx = qx - v.x, dy = qy - v.y, dz = qz - v.z, d2 = dx * dx + dy * dy + dz * dz, lim = v.rho * 2.6;
          if (d2 < lim * lim) {
            var u = sqrt(d2) / lim, f = 1 - u * u * (3 - 2 * u);
            twistPoint(qx, qy, qz, v.x, v.y, v.z, v.s * f * f);
            qx = TX; qy = TY; qz = TZ;
          }
        }
        var wx = nz.n(qx * 1.5 + 5.1, qy * 1.5 + 1.7, qz * 1.5 + 8.3), wy = nz.n(qx * 1.5 + 2.9, qy * 1.5 + 7.1, qz * 1.5 + 3.3), wz = nz.n(qx * 1.5 + 9.7, qy * 1.5 + 4.4, qz * 1.5 + 0.6);
        var sx = (qx + wx * wa) * sc, sy = (qy + wy * wa) * sc, sz = (qz + wz * wa) * sc;
        var d = nz.fbm(sx, sy, sz, oct);
        if (wisp > 0) d += wisp * 0.35 * nz.fbm(sx * 1.1 + 7, sy * 3.6, sz * 1.1 + 3, octW);
        cd[base + x] = d;
      }
    }
    function final() {
      var r = areaQuantile(job, cd, 1 - spec.cover), thr = r.q, soft = spec.soft, mx = (spec.max || 1) * 255, cloud = job.cloud;
      for (var i = 0, N = job.N; i < N; i++) {
        var a = sstep(thr - soft, thr + soft * 2.4, cd[i]);
        cloud[i] = a * mx;
      }
    }
    return { row: row, final: final };
  }

  /* ================================================================ look generators */
  function mkField(job, nz, o) {
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct = octs(job, o.oct || 6);
    var f = o.f, wf = o.wf || 0.9, wa = o.warp === undefined ? 0.35 : o.warp, ox = o.ox || 0;
    return function (y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var px = cl * sinT[x], py = sl, pz = cl * cosT[x], qx = px, qy = py, qz = pz;
        if (wa > 0) {
          qx += wa * nz.n(px * wf + 3.1, py * wf + 7.7, pz * wf + 1.3);
          qy += wa * nz.n(px * wf + 5.9, py * wf + 2.3, pz * wf + 9.1);
          qz += wa * nz.n(px * wf + 8.2, py * wf + 4.4, pz * wf + 6.6);
        }
        h[base + x] = nz.fbm(qx * f + ox, qy * f, qz * f, oct) * 0.5 + 0.5;
      }
    };
  }

  /* worlds with oceans: terran, jungle, ocean, gaia */
  function genWorld(job, P, S) {
    var rnd = rng32(sub(P.seed, 11)), nz = makeNoise(sub(P.seed, 21)), na = makeNoise(sub(P.seed, 22)), nr = makeNoise(sub(P.seed, 23));
    var W = job.W, H = job.H, h = job.h, rel = job.rel, surf = job.surf, dat = job.dat, sinT = job.sinT, cosT = job.cosT;
    var field = mkField(job, nz, { f: S.f, warp: S.warp, oct: 6 });
    var water = makeRamp(S.water), land = makeRamp(S.land), city = makeCity(job, rnd, S.sparse || 0);
    var o2 = rnd() * 50, o3 = rnd() * 50, o4 = rnd() * 50, oct3 = octs(job, 3), oct4 = octs(job, 4);
    var rock = S.rock, rockHi = S.rockHi, snow = S.snow, beach = S.beach, ice = S.ice, seaIce = [196, 222, 244];
    var mgx = (rnd() - 0.5) * 0.22, mgz = (rnd() - 0.5) * 0.22, mgl = 1 / sqrt(mgx * mgx + 1 + mgz * mgz); mgx *= mgl; mgz *= mgl; var mgy = mgl;
    function setup() { remapSea(job, S.sea); }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), alat = abs(sl), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i], r, g, b, gloss = 0, rl = 0, ct = 0, bio = 0;
        var n2 = na.fbm(px * 9 + o2, py * 9, pz * 9, oct3);
        var iceEdge = S.iceLat + 0.11 * na.fbm(px * 2.2 + o3, py * 2.2, pz * 2.2, 3);
        var im = sstep(iceEdge, iceEdge + 0.05, alat);
        if (e < 0.5) {
          var d = (0.5 - e) * 2;
          rampAt(water, pow(d, S.depthPow));
          var v = 1 + 0.05 * n2;
          r = CR * v; g = CG * v; b = CB * v; gloss = 218 + 37 * n2;
          if (S.bio) bio = S.bio * (1 - sstep(0, 0.16, d)) * (0.35 + 0.65 * (na.fbm(px * 14 + o4, py * 14, pz * 14, 2) * 0.5 + 0.5));
          if (im > 0) {
            var iv = 0.9 + 0.1 * n2;
            r = mixf(r, seaIce[0] * iv, im * 0.92); g = mixf(g, seaIce[1] * iv, im * 0.92); b = mixf(b, seaIce[2] * iv, im * 0.92); gloss = mixf(255, 90, im);
          }
        } else {
          var el = pow((e - 0.5) * 2, S.elPow || 1.6);
          var mn = na.fbm(px * 2.6 + o4, py * 2.6, pz * 2.6, oct4);
          var moist = 0.5 + S.moistAmp * mn + S.moistBias
            - 0.30 * exp(-((alat - 0.33) / 0.15) * ((alat - 0.33) / 0.15)) * S.dry + 0.12 * exp(-(alat / 0.22) * (alat / 0.22));
          moist = clamp(moist, 0, 1);
          rampAt(land, 1 - moist);
          r = CR; g = CG; b = CB;
          var ridge = nr.ridged(px * 2.8 + o3, py * 2.8, pz * 2.8, octs(job, 4));
          var temp = 1 - pow(alat, 1.7) * 1.35 - el * 0.32 + 0.10 * n2 + S.warm;
          // cold climates fade towards tundra grey / snow
          var cold = sstep(0.34, 0.08, temp);
          r = mixf(r, 168, cold * 0.7); g = mixf(g, 176, cold * 0.7); b = mixf(b, 170, cold * 0.7);
          // highlands / mountains
          var rm = sstep(0.42, 0.85, el * 1.15 + (ridge - 0.5) * 0.45 * S.mount);
          r = mixf(r, mixf(rock[0], rockHi[0], el), rm); g = mixf(g, mixf(rock[1], rockHi[1], el), rm); b = mixf(b, mixf(rock[2], rockHi[2], el), rm);
          var sm = sstep(0.80, 0.97, el * 1.05 + (ridge - 0.5) * 0.3) + cold * 0.85 * sstep(0.4, 0.8, el);
          sm = sm > 1 ? 1 : sm;
          r = mixf(r, snow[0], sm); g = mixf(g, snow[1], sm); b = mixf(b, snow[2], sm);
          // rivers & lakes (inland water) in lowlands
          if (S.rivers) {
            var rv = nr.n(px * 3.3 + o2, py * 3.3, pz * 3.3), rw = 1 - sstep(0.0, 0.03 + 0.02 * el, abs(rv));
            rw *= sstep(0.5, 0.05, el) * S.rivers;
            if (rw > 0) { r = mixf(r, S.riverCol[0], rw); g = mixf(g, S.riverCol[1], rw); b = mixf(b, S.riverCol[2], rw); gloss = max(gloss, 200 * rw); }
          }
          // beach
          var bm = sstep(0.04, 0.0, el) * S.beachAmt;
          r = mixf(r, beach[0], bm); g = mixf(g, beach[1], bm); b = mixf(b, beach[2], bm);
          var vv = 1 + S.grain * n2; r *= vv; g *= vv; b *= vv;
          rl = el * 0.55 + (ridge - 0.35) * el * 0.9 * S.mount; if (rl < 0) rl = 0;
          if (im > 0) {
            var iv2 = 0.93 + 0.07 * n2;
            r = mixf(r, ice[0] * iv2, im); g = mixf(g, ice[1] * iv2, im); b = mixf(b, ice[2] * iv2, im); gloss = 60 * im;
          }
          if (S.cityOk) ct = city(px, py, pz) * (1 - im) * (1 - sm) * (1 - rm * 0.7) * (0.35 + 0.65 * (1 - alat * alat)) * sstep(0.0, 0.05, el + 0.02);
        }
        var o = i * 4, au = 0, am = abs(px * mgx + py * mgy + pz * mgz);
        if (am > 0.8 && S.aurora) {
          var dd = (am - 0.925) / 0.045, ring = exp(-dd * dd);
          if (ring > 0.03) { var cn = na.fbm(px * 6 + o2, py * 6, pz * 6, 3) * 0.5 + 0.5; au = ring * (0.18 + 0.82 * cn * cn) * S.aurora * 255; }
        }
        if (bio * 150 > au) au = bio * 150;
        surf[o] = r; surf[o + 1] = g; surf[o + 2] = b; surf[o + 3] = au;
        dat[o + 2] = ct * 255; dat[o + 3] = gloss; rel[i] = rl;
      }
    }
    return { field: field, setup: setup, color: color, relK: S.relK || 0.22 };
  }

  var WORLD = {
    terran: {
      sea: 0.66, f: 1.15, warp: 0.38, depthPow: 0.6, iceLat: 0.80, moistAmp: 0.95, moistBias: 0.02, dry: 1, warm: 0, mount: 1, grain: 0.07,
      beachAmt: 0.85, rivers: 0.0, cityOk: true, aurora: 0.9,
      water: [[0, '#80dcd2'], [0.035, '#3cb0d2'], [0.13, '#1c78b6'], [0.34, '#104c98'], [0.7, '#082c6e'], [1, '#051848']],
      land: [[0, '#2a6a32'], [0.22, '#3f8038'], [0.45, '#6f9142'], [0.68, '#a49c5a'], [0.85, '#c8a76c'], [1, '#d6b57c']],
      rock: [118, 104, 90], rockHi: [170, 158, 142], snow: [246, 249, 252], beach: [226, 212, 162], ice: [242, 247, 253]
    },
    gaia: {
      sea: 0.56, f: 1.05, warp: 0.42, depthPow: 0.55, iceLat: 0.88, moistAmp: 0.7, moistBias: 0.22, dry: 0.4, warm: 0.12, mount: 0.55, grain: 0.08,
      beachAmt: 0.9, rivers: 0.9, riverCol: [70, 200, 220], cityOk: true, elPow: 1.9, aurora: 1.0, bio: 0.75,
      water: [[0, '#9af4e2'], [0.04, '#40d4dc'], [0.16, '#18a0dc'], [0.4, '#0e68c0'], [0.75, '#0a4090'], [1, '#07286a']],
      land: [[0, '#1e8a3c'], [0.3, '#34ac46'], [0.6, '#6cc450'], [0.82, '#a8cc62'], [1, '#d4d27a']],
      rock: [128, 124, 100], rockHi: [190, 184, 156], snow: [248, 252, 255], beach: [244, 232, 176], ice: [246, 252, 255]
    },
    jungle: {
      sea: 0.30, f: 1.0, warp: 0.45, depthPow: 0.6, iceLat: 0.95, moistAmp: 0.5, moistBias: 0.40, dry: 0.15, warm: 0.25, mount: 0.7, grain: 0.10,
      beachAmt: 0.5, rivers: 1.0, riverCol: [34, 140, 138], cityOk: true, elPow: 1.4, aurora: 0.6,
      water: [[0, '#72d8bc'], [0.05, '#30a8a0'], [0.2, '#16787e'], [0.5, '#0c4c64'], [1, '#07304a']],
      land: [[0, '#0f4a26'], [0.3, '#175e2c'], [0.6, '#237a38'], [0.85, '#3e9040'], [1, '#6c9a50']],
      rock: [86, 100, 74], rockHi: [124, 138, 104], snow: [232, 244, 238], beach: [186, 190, 120], ice: [236, 246, 244]
    },
    ocean: {
      sea: 0.935, f: 1.5, warp: 0.5, depthPow: 0.5, iceLat: 0.90, moistAmp: 0.6, moistBias: 0.25, dry: 0.3, warm: 0.15, mount: 0.4, grain: 0.07,
      beachAmt: 1.0, rivers: 0.0, cityOk: true, sparse: 0.5, elPow: 1.0, relK: 0.18, aurora: 0.8, bio: 0.4,
      water: [[0, '#a4f0e0'], [0.025, '#52d0d8'], [0.08, '#24a0d8'], [0.22, '#1268b8'], [0.55, '#0a3c90'], [1, '#06226a']],
      land: [[0, '#2a8a46'], [0.3, '#2f7a3c'], [0.6, '#4a8a46'], [0.85, '#7a9a60'], [1, '#98a478']],
      rock: [100, 98, 84], rockHi: [150, 146, 128], snow: [240, 246, 250], beach: [246, 234, 178], ice: [244, 249, 253]
    }
  };
  LOOK_GEN.terran = function (job, P) { return genWorld(job, P, WORLD.terran); };
  LOOK_GEN.gaia = function (job, P) { return genWorld(job, P, WORLD.gaia); };
  LOOK_GEN.jungle = function (job, P) { return genWorld(job, P, WORLD.jungle); };
  LOOK_GEN.ocean = function (job, P) { return genWorld(job, P, WORLD.ocean); };

  /* shared by dry/airless worlds: write a texel */
  function putTexel(job, i, r, g, b, glow, ct, gloss, rl) {
    var o = i * 4, surf = job.surf, dat = job.dat;
    surf[o] = r; surf[o + 1] = g; surf[o + 2] = b; surf[o + 3] = glow;
    dat[o + 2] = ct * 255; dat[o + 3] = gloss; job.rel[i] = rl;
  }

  /* barren (lunar highlands + maria) and dead (dark basalt) */
  function genMoon(job, P, S) {
    var rnd = rng32(sub(P.seed, 41)), nz = makeNoise(sub(P.seed, 42)), nm = makeNoise(sub(P.seed, 43));
    var W = job.W, H = job.H, h = job.h, cb = null, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4);
    var field = mkField(job, nz, { f: S.f, warp: 0.16, oct: 6 }), ramp = makeRamp(S.ramp), city = makeCity(job, rnd, 0.7);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    function setup() { normalize01(job, h); stampCraters(job, rnd, S.craters); cb = job.cb; }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        var m = nm.fbm(px * 1.35 + o1, py * 1.35, pz * 1.35, oct4), edge = 0.07 * nm.fbm(px * 8 + o3, py * 8, pz * 8, 3);
        var mare = sstep(S.mareT, S.mareT - 0.10, m + edge) * S.mare;
        var tn = nm.fbm(px * 2.6 + o2, py * 2.6, pz * 2.6, oct3), gr = nz.fbm(px * 34 + o1, py * 34, pz * 34, 2);
        rampAt(ramp, clamp(e * 0.85 + 0.08, 0, 1));
        var r = CR, g = CG, b = CB;
        var mv = 1 + 0.12 * tn;
        r = mixf(r, S.mareCol[0] * mv, mare); g = mixf(g, S.mareCol[1] * mv, mare); b = mixf(b, S.mareCol[2] * mv, mare);
        r *= 1 + S.tint * tn; b *= 1 - S.tint * tn * 0.8;
        var v = (1 + cb[i] * S.cbK) * (1 + 0.09 * gr);
        r *= v; g *= v; b *= v;
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * (1 - mare * 0.5) * 0.9, 0, h[i] * 0.5 + cb[i] * 0.12);
      }
    }
    return { field: field, setup: setup, color: color, relK: S.relK };
  }
  LOOK_GEN.barren = function (job, P) {
    return genMoon(job, P, {
      f: 1.5, mare: 0.85, mareT: -0.07, mareCol: [96, 88, 82], tint: 0.16, cbK: 1.0, relK: 0.2,
      ramp: [[0, '#706558'], [0.35, '#938676'], [0.65, '#b3a592'], [1, '#d2c4ae']],
      craters: { n: [7, 48, 250, 800], depth: 0.06, fresh: 0.10, dark: 0.2 }
    });
  };
  LOOK_GEN.dead = function (job, P) {
    return genMoon(job, P, {
      f: 1.6, mare: 0.9, mareT: -0.04, mareCol: [30, 28, 32], tint: 0.12, cbK: 1.1, relK: 0.22,
      ramp: [[0, '#2c2a2e'], [0.4, '#403b3b'], [0.7, '#5a5451'], [1, '#7e766e']],
      craters: { n: [9, 60, 300, 900], depth: 0.07, fresh: 0.07, dark: 0.3 }
    });
  };

  /* arid: Mars-like — bright rust plains, ragged dark basalt patches, volcano domes, a canyon scar, frost caps */
  LOOK_GEN.arid = function (job, P) {
    var rnd = rng32(sub(P.seed, 61)), nz = makeNoise(sub(P.seed, 62)), na = makeNoise(sub(P.seed, 63));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), cb = null;
    var field = mkField(job, nz, { f: 1.2, warp: 0.18, oct: 6 }), city = makeCity(job, rnd, 0.75);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var ramp = makeRamp([[0, '#a85a34'], [0.35, '#c4713f'], [0.65, '#d98f55'], [1, '#ebb57a']]);
    var za = rnd() * 2 - 1, ca0 = sqrt(1 - za * za), la0 = rnd() * TAU, cax = ca0 * sin(la0), cay = za, caz = ca0 * cos(la0);
    var domes = [];
    for (var k = 0; k < 3; k++) { var z2 = (rnd() * 2 - 1) * 0.8, c2 = sqrt(1 - z2 * z2), lo = rnd() * TAU; domes.push({ x: c2 * sin(lo), y: z2, z: c2 * cos(lo), r: 0.10 + rnd() * 0.12 }); }
    function setup() {
      normalize01(job, h); stampCraters(job, rnd, { n: [3, 20, 110, 320], depth: 0.045, fresh: 0.12, dark: 0.15 }); cb = job.cb;
      for (var d = 0; d < domes.length; d++) {   // shield volcanoes with calderas
        var dm = domes[d];
        for (var y = 0; y < H; y++) {
          var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat);
          for (var x = 0; x < W; x++) {
            var dx = cl * sinT[x] - dm.x, dy = sl - dm.y, dz = cl * cosT[x] - dm.z, q = sqrt(dx * dx + dy * dy + dz * dz) / dm.r;
            if (q < 2.2) { var i = y * W + x; h[i] += 0.30 * exp(-q * q * 0.9) - (q < 0.18 ? 0.10 * (1 - q / 0.18) : 0); }
          }
        }
      }
    }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), alat = abs(sl), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        var b1 = na.fbm(px * 2.1 + o1, py * 2.1, pz * 2.1, oct4), sk = na.fbm(px * 2.6 + o2, py * 13, pz * 2.6, oct3), fine = na.fbm(px * 26 + o3, py * 26, pz * 26, 2);
        rampAt(ramp, clamp(0.5 + 0.55 * b1 + 0.25 * (e - 0.5), 0, 1));
        var r = CR, g = CG, b = CB;
        var m = na.fbm(px * 1.7 + o2, py * 1.7, pz * 1.7, oct4), edge = 0.07 * na.fbm(px * 8 + o3, py * 8, pz * 8, 3);
        var dk = sstep(-0.06, -0.13, m + edge), dv = 1 + 0.3 * na.fbm(px * 5 + o1, py * 5, pz * 5, 3);
        r = mixf(r, 92 * dv, dk * 0.9); g = mixf(g, 58 * dv, dk * 0.9); b = mixf(b, 46 * dv, dk * 0.9);
        var v = 1 + 0.07 * sk + 0.06 * fine; r *= v; g *= v; b *= v;
        var cd = (px * cax + py * cay + pz * caz) + 0.04 * na.n(px * 2.2 + o3, py * 2.2, pz * 2.2), cn = 1 - sstep(0, 0.018 + 0.012 * na.n(px * 7, py * 7, pz * 7), abs(cd));
        cn *= sstep(0.5, 0.0, na.n(px * 1.3 + o1, py * 1.3, pz * 1.3) + 0.2);
        r = mixf(r, 44, cn * 0.8); g = mixf(g, 26, cn * 0.8); b = mixf(b, 22, cn * 0.8);
        var cp = sstep(0.915, 0.975, alat + 0.03 * b1); r = mixf(r, 244, cp); g = mixf(g, 232, cp); b = mixf(b, 226, cp);
        var cv = 1 + cb[i] * 0.9; r *= cv; g *= cv; b *= cv;
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * (1 - cp) * (1 - cn), 0, e * 0.9 + cb[i] * 0.12 - cn * 0.25);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.2 };
  };

  /* steppe: olive / straw / ochre patchwork fields, rivers, a few dark lakes */
  LOOK_GEN.steppe = function (job, P) {
    var rnd = rng32(sub(P.seed, 71)), nz = makeNoise(sub(P.seed, 72)), na = makeNoise(sub(P.seed, 73));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4);
    var field = mkField(job, nz, { f: 1.25, warp: 0.25, oct: 6 }), city = makeCity(job, rnd, 0.2);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var pal = [[112, 124, 54], [198, 172, 92], [188, 134, 62], [166, 140, 104], [64, 94, 48], [142, 98, 60], [150, 150, 70], [210, 190, 120]];
    var lakeCol = [52, 86, 116];
    function setup() { normalize01(job, h); }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), alat = abs(sl), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        var a = na.fbm(px * 2.3 + o1, py * 2.3, pz * 2.3, oct4) * 0.5 + 0.5, edge = 0.025 * na.fbm(px * 14 + o3, py * 14, pz * 14, 3);
        var P8 = (a + edge) * 8, fl = floor(P8), fr = P8 - fl, i0 = clamp(fl, 0, 7) | 0, i1 = clamp(fl + 1, 0, 7) | 0, mx = sstep(0.42, 0.58, fr);
        var c0 = pal[(i0 * 3) % 8], c1 = pal[(i1 * 3) % 8];
        var r = mixf(c0[0], c1[0], mx), g = mixf(c0[1], c1[1], mx), b = mixf(c0[2], c1[2], mx);
        var bq = na.fbm(px * 6 + o2, py * 6, pz * 6, 3), fine = na.fbm(px * 36, py * 36, pz * 36, 2), gv = 1 + 0.14 * bq + 0.08 * fine;
        r *= gv; g *= gv; b *= gv;
        var hill = sstep(0.62, 0.92, e); r = mixf(r, r * 0.72 + 14, hill * 0.55); g = mixf(g, g * 0.72 + 12, hill * 0.55); b = mixf(b, b * 0.72 + 10, hill * 0.55);
        var rv = na.n(px * 3.0 + o3, py * 3.0, pz * 3.0), rw = (1 - sstep(0, 0.026, abs(rv))) * sstep(0.72, 0.25, e);
        var lake = sstep(0.16, 0.11, e), wm = max(rw * 0.9, lake);
        r = mixf(r, lakeCol[0] * (1 + 0.1 * fine), wm); g = mixf(g, lakeCol[1] * (1 + 0.1 * fine), wm); b = mixf(b, lakeCol[2] * (1 + 0.1 * fine), wm);
        var cp = sstep(0.92, 0.985, alat); r = mixf(r, 238, cp); g = mixf(g, 240, cp); b = mixf(b, 242, cp);
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * (1 - wm) * (1 - cp), wm * 230, e * 0.5 + fine * 0.05);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.2 };
  };

  /* desert: sand seas of crossing dunes with bright crests, rock plateaus, salt flats, broad colour drifts */
  LOOK_GEN.desert = function (job, P) {
    var rnd = rng32(sub(P.seed, 81)), nz = makeNoise(sub(P.seed, 82)), na = makeNoise(sub(P.seed, 83));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), cb = null;
    var field = mkField(job, nz, { f: 1.2, warp: 0.2, oct: 6 }), city = makeCity(job, rnd, 0.8);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var ramp = makeRamp([[0, '#a8703c'], [0.3, '#cf9a58'], [0.55, '#e6b870'], [0.8, '#f2d28e'], [1, '#faebb8']]);
    function setup() { normalize01(job, h); stampCraters(job, rnd, { n: [1, 6, 34, 90], depth: 0.04, fresh: 0.1, dark: 0.1 }); cb = job.cb; }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        var wx = na.n(px * 1.3 + o1, py * 1.3, pz * 1.3) * 0.22, wy = na.n(px * 1.3 + o2, py * 1.3 + 3, pz * 1.3) * 0.22, wz = na.n(px * 1.3 + o3, py * 1.3, pz * 1.3 + 5) * 0.22;
        var qx = px + wx, qy = py + wy, qz = pz + wz;
        var d1 = na.ridged(qx * 3.6 + o1, qy * 12, qz * 3.6, 3), d2 = na.ridged(qy * 4.2 + o2, qz * 11, qx * 11, 3);
        var m = na.fbm(px * 1.9 + o3, py * 1.9, pz * 1.9, oct3), w = sstep(-0.1, 0.1, m), d = mixf(d1, d2, w);
        var b1 = na.fbm(px * 1.5 + o2, py * 1.5, pz * 1.5, oct4), b2 = na.fbm(px * 6 + o1, py * 6, pz * 6, 3);
        var erg = sstep(-0.18, 0.04, na.fbm(px * 1.4 + o3, py * 1.4, pz * 1.4, 3) + 0.06 * b2);
        var t = 0.46 + 0.30 * b1 + 0.08 * b2 + erg * (d - 0.5) * 0.30 + erg * 0.07 * sstep(0.78, 0.97, d);
        rampAt(ramp, clamp(t, 0, 1));
        var r = CR, g = CG, b = CB;
        var pl = sstep(0.60, 0.72, e + 0.08 * b2) * (1 - erg * 0.7), rk = 1 + 0.25 * na.fbm(px * 14, py * 14, pz * 14, 2);
        r = mixf(r, 150 * rk, pl * 0.8); g = mixf(g, 100 * rk, pl * 0.8); b = mixf(b, 70 * rk, pl * 0.8);
        var sa = sstep(0.24, 0.16, e); r = mixf(r, 238, sa * 0.8); g = mixf(g, 228, sa * 0.8); b = mixf(b, 208, sa * 0.8);
        var cv = 1 + cb[i] * 0.9; r *= cv; g *= cv; b *= cv;
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * (1 - pl), 0, erg * d * 0.55 + e * 0.35 + cb[i] * 0.1);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.17 };
  };

  /* minimal: grey-brown rock, cracks, sparse pale-green lichen patches */
  LOOK_GEN.minimal = function (job, P) {
    var rnd = rng32(sub(P.seed, 91)), nz = makeNoise(sub(P.seed, 92)), na = makeNoise(sub(P.seed, 93));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), cb = null;
    var field = mkField(job, nz, { f: 1.5, warp: 0.2, oct: 6 }), city = makeCity(job, rnd, 0.6);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var ramp = makeRamp([[0, '#454139'], [0.35, '#68645c'], [0.65, '#8a8576'], [1, '#b2ab98']]);
    function setup() { normalize01(job, h); stampCraters(job, rnd, { n: [2, 16, 90, 240], depth: 0.04, fresh: 0.08, dark: 0.15 }); cb = job.cb; }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        rampAt(ramp, e);
        var r = CR, g = CG, b = CB, dn = na.fbm(px * 5 + o1, py * 5, pz * 5, oct4), fine = na.fbm(px * 28, py * 28, pz * 28, 2);
        var v = 1 + 0.15 * dn + 0.08 * fine; r *= v * 1.03; g *= v; b *= v * 0.95;
        var lm = na.fbm(px * 3.3 + o2, py * 3.3, pz * 3.3, oct4) * 0.5 + 0.5, edge = 0.05 * na.fbm(px * 30 + o3, py * 30, pz * 30, 2);
        var li = sstep(0.60, 0.65, lm + edge) * (0.55 + 0.45 * sstep(-0.2, 0.5, fine + dn));
        var lc = 0.5 + 0.5 * na.n(px * 12 + o3, py * 12, pz * 12);
        r = mixf(r, mixf(120, 170, lc), li * 0.85); g = mixf(g, mixf(148, 192, lc), li * 0.85); b = mixf(b, mixf(86, 118, lc), li * 0.85);
        var ck = na.n(px * 5.4 + o3, py * 5.4, pz * 5.4), cr = (1 - sstep(0, 0.03, abs(ck))) * 0.5;
        r *= 1 - cr; g *= 1 - cr; b *= 1 - cr;
        var cv = 1 + cb[i] * 1.0; r *= cv; g *= cv; b *= cv;
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * (1 - 0.6 * li), 0, e * 0.7 + cb[i] * 0.1 - cr * 0.1);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.2 };
  };

  /* tundra: glacial plains, blue-grey ice, dark rock ranges, crevasses */
  LOOK_GEN.tundra = function (job, P) {
    var rnd = rng32(sub(P.seed, 101)), nz = makeNoise(sub(P.seed, 102)), na = makeNoise(sub(P.seed, 103));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), cb = null;
    var field = mkField(job, nz, { f: 1.4, warp: 0.22, oct: 6 }), city = makeCity(job, rnd, 0.8);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var ice = makeRamp([[0, '#5a7ba6'], [0.28, '#94b2d6'], [0.55, '#cbdcf0'], [0.8, '#eef5fc'], [1, '#fbfdff']]);
    var rockR = makeRamp([[0, '#2e3038'], [0.5, '#4a4b56'], [1, '#76727a']]);
    function setup() { normalize01(job, h); stampCraters(job, rnd, { n: [1, 8, 40, 100], depth: 0.03, fresh: 0.05, dark: 0.1 }); cb = job.cb; }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), alat = abs(sl), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        var dn = na.fbm(px * 3.0 + o1, py * 3.0, pz * 3.0, oct4), fine = na.fbm(px * 16 + o2, py * 16, pz * 16, 3), ridge = na.ridged(px * 2.2 + o3, py * 2.2, pz * 2.2, 4);
        var mf = 0.65 * na.fbm(px * 1.9 + o2, py * 1.9, pz * 1.9, 4) + 0.55 * (ridge - 0.45) + 0.12 * (0.5 - e);
        var rockMask = sstep(0.10, 0.24, mf + 0.07 * fine) * (1 - sstep(0.86, 0.98, alat));
        rampAt(ice, 0.50 + 0.52 * dn + 0.10 * fine);
        var r = CR, g = CG, b = CB;
        rampAt(rockR, 0.42 + 0.6 * fine + 0.3 * dn);
        r = mixf(r, CR, rockMask * 0.92); g = mixf(g, CG, rockMask * 0.92); b = mixf(b, CB, rockMask * 0.92);
        var ck = na.n(px * 4.2 + o3, py * 4.2, pz * 4.2), cr = (1 - sstep(0, 0.022, abs(ck))) * (1 - rockMask) * 0.5;
        r = mixf(r, 104, cr); g = mixf(g, 134, cr); b = mixf(b, 176, cr);
        var cv = 1 + cb[i] * 0.55; r *= cv; g *= cv; b *= cv;
        putTexel(job, i, r, g, b, 0, city(px, py, pz) * rockMask * 0.5, (1 - rockMask) * 90, ridge * 0.5 * rockMask + dn * 0.12 + e * 0.2 + cb[i] * 0.1);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.16 };
  };

  /* inferno: cracked black crust plates (cellular) with glowing magma seams, secondary fractures and lava seas */
  LOOK_GEN.inferno = function (job, P) {
    var rnd = rng32(sub(P.seed, 111)), nz = makeNoise(sub(P.seed, 112)), na = makeNoise(sub(P.seed, 113));
    var cA = makeCellular(sub(P.seed, 114)), cB = makeCellular(sub(P.seed, 115)), ra = cA.r, rb = cB.r;
    var W = job.W, H = job.H, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), rel = job.rel;
    var city = makeCity(job, rnd, 0.9), o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40, o4 = rnd() * 40;
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x];
        var qx = px + 0.16 * nz.n(px * 2.2 + o1, py * 2.2, pz * 2.2), qy = py + 0.16 * nz.n(px * 2.2 + o2, py * 2.2 + 2, pz * 2.2), qz = pz + 0.16 * nz.n(px * 2.2 + o3, py * 2.2, pz * 2.2 + 4);
        var wn = nz.n(qx * 3 + o4, qy * 3, qz * 3) * 0.5 + 0.5;
        cA.cell(qx * 3.4 + o1, qy * 3.4, qz * 3.4); var d1 = ra.f2 - ra.f1, plate = ((ra.h >>> 6) & 255) / 255;
        cB.cell(qx * 8.2 + o2, qy * 8.2, qz * 8.2); var d2 = rb.f2 - rb.f1;
        var k1 = 1 - sstep(0, 0.060 + 0.05 * wn, d1), k2 = (1 - sstep(0, 0.05, d2)) * 0.8 * sstep(0.22, 0.62, wn + 0.3 * (plate - 0.5));
        var lake = sstep(0.14, 0.34, -nz.fbm(qx * 1.5 + o4, qy * 1.5, qz * 1.5, oct4) - 0.04);
        var heat = Math.max(k1, k2, lake * 0.9);
        heat *= 0.74 + 0.26 * (na.fbm(px * 7 + o2, py * 7, pz * 7, oct3) * 0.5 + 0.5);
        var fn = na.fbm(px * 10 + o3, py * 10, pz * 10, oct4);
        // each plate has its own tone; plate rims are heat-softened and reddish
        var pv = 0.7 + 0.6 * plate, rimk = 1 - sstep(0, 0.30, d1), r = (24 + 16 * fn) * pv, g = (19 + 9 * fn) * pv, b = (21 + 8 * fn) * pv;
        r += 70 * rimk * rimk; g += 14 * rimk * rimk;
        var hot = heat > 0.02 ? Math.pow(heat, 0.6) : 0;
        r += 90 * hot; g += 28 * hot; b += 5 * hot;
        rel[i] = sstep(0, 0.22, d1) * 0.7 * (1 - lake) + fn * 0.2 + plate * 0.1;
        putTexel(job, i, r, g, b, Math.max(heat, rimk * rimk * 0.18) * 255, city(px, py, pz) * (1 - heat) * 0.5, 0, rel[i]);
      }
    }
    return { field: null, setup: null, color: color, relK: 0.2 };
  };

  /* toxic: Venus-like churning cloud deck, sickly yellow-green with violet shadows, pale streaks and cyclones */
  LOOK_GEN.toxic = function (job, P) {
    var rnd = rng32(sub(P.seed, 121)), nz = makeNoise(sub(P.seed, 122)), na = makeNoise(sub(P.seed, 123));
    var W = job.W, H = job.H, sinT = job.sinT, cosT = job.cosT, oct = octs(job, 5), oct4 = octs(job, 4), oct3 = octs(job, 3);
    var ramp = makeRamp([[0, '#38400e'], [0.2, '#627020'], [0.42, '#92a62a'], [0.62, '#c2cc3e'], [0.8, '#e6e47e'], [1, '#f8f4c8']]);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40, ph = rnd() * TAU, vs = [], k;
    for (k = 0; k < 3; k++) {
      var lat = (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.75), lon = rnd() * TAU, cl0 = cos(lat);
      vs.push({ x: cl0 * sin(lon), y: sin(lat), z: cl0 * cos(lon), rho: 0.28 + rnd() * 0.2, s: (lat < 0 ? -1 : 1) * (1.3 + rnd() * 1.1) });
    }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W, k;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x];
        var a = 0.5 * sin(py * 5 + ph) + 0.18 * sin(py * 13 + ph * 2), ca = cos(a), sa = sin(a);
        var qx = px * ca + pz * sa, qy = py, qz = pz * ca - px * sa, eye = 0;
        for (k = 0; k < 3; k++) {
          var v = vs[k], dx = qx - v.x, dy = qy - v.y, dz = qz - v.z, d2 = dx * dx + dy * dy + dz * dz, lim = v.rho * 2.6;
          if (d2 < lim * lim) {
            var u = sqrt(d2) / lim, f = 1 - u * u * (3 - 2 * u);
            twistPoint(qx, qy, qz, v.x, v.y, v.z, v.s * f * f); qx = TX; qy = TY; qz = TZ;
            eye = max(eye, 1 - sstep(0, v.rho * 0.8, sqrt(d2)));
          }
        }
        var x1 = qx + 0.34 * nz.n(qx * 1.0 + o1, qy * 1.0, qz * 1.0), y1 = qy + 0.34 * nz.n(qx * 1.0 + o2, qy * 1.0 + 5, qz * 1.0), z1 = qz + 0.34 * nz.n(qx * 1.0 + 7, qy * 1.0, qz * 1.0 + o1);
        var x2 = x1 + 0.12 * nz.n(x1 * 2.1 + o2, y1 * 2.1, z1 * 2.1), y2 = y1 + 0.12 * nz.n(x1 * 2.1, y1 * 2.1 + o1, z1 * 2.1), z2 = z1 + 0.12 * nz.n(x1 * 2.1, y1 * 2.1, z1 * 2.1 + o2);
        var vv = nz.fbm(x2 * 1.5, y2 * 2.4, z2 * 1.5, oct) * 0.5 + 0.5, dt = na.fbm(x2 * 5 + o3, y2 * 8, z2 * 5, oct4);
        var t = clamp((vv - 0.5) * 1.1 + 0.52 + 0.14 * dt, 0, 1);
        rampAt(ramp, t);
        var r = CR, g = CG, b = CB;
        var ci = na.ridged(x2 * 2.2 + o1, y2 * 14, z2 * 2.2, 3), cm = sstep(0.84, 0.97, ci) * 0.22;
        r = mixf(r, 246, cm); g = mixf(g, 240, cm); b = mixf(b, 190, cm);
        var sh = sstep(0.36, 0.0, t) * 0.38 + eye * 0.55;
        r = mixf(r, 92, sh); g = mixf(g, 62, sh); b = mixf(b, 120, sh);
        var sv = 1 + 0.05 * dt; r *= sv; g *= sv; b *= sv;
        putTexel(job, i, r, g, b, 0, 0, 0, t * 0.55 - eye * 0.2);
      }
    }
    return { field: null, setup: null, color: color, relK: 0.13 };
  };

  /* radiated: pale cratered rock with glowing irradiated patches and veins */
  LOOK_GEN.radiated = function (job, P) {
    var rnd = rng32(sub(P.seed, 131)), nz = makeNoise(sub(P.seed, 132)), na = makeNoise(sub(P.seed, 133));
    var W = job.W, H = job.H, h = job.h, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), cb = null;
    var field = mkField(job, nz, { f: 1.4, warp: 0.2, oct: 6 }), city = makeCity(job, rnd, 0.9);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40;
    var ramp = makeRamp([[0, '#6a665c'], [0.4, '#9a9484'], [0.7, '#bab49e'], [1, '#d8d2ba']]);
    function setup() { normalize01(job, h); stampCraters(job, rnd, { n: [4, 26, 130, 380], depth: 0.05, fresh: 0.1, dark: 0.2 }); cb = job.cb; }
    function color(y) {
      var lat = (0.5 - (y + 0.5) / H) * PI, cl = cos(lat), sl = sin(lat), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x], e = h[i];
        rampAt(ramp, e);
        var r = CR, g = CG, b = CB, fine = na.fbm(px * 18 + o1, py * 18, pz * 18, 3), dn = na.fbm(px * 4 + o2, py * 4, pz * 4, oct3);
        var v = 1 + 0.12 * dn + 0.1 * fine; r *= v; g *= v; b *= v;
        var rp = na.fbm(px * 2.3 + o3, py * 2.3, pz * 2.3, oct4) * 0.5 + 0.5, edge = 0.05 * fine;
        var m1 = sstep(0.60, 0.74, rp + edge), m2 = sstep(0.50, 0.66, rp + edge);
        var vk = na.n(px * 7.5 + o1, py * 7.5, pz * 7.5), vein = (1 - sstep(0, 0.045, abs(vk))) * m2;
        var rg = m1 * (0.20 + 0.30 * sstep(-0.3, 0.5, fine + 0.4 * dn)), glow = clamp(Math.max(rg, vein * 0.8), 0, 1);
        r = mixf(r, 128, m1 * 0.38); g = mixf(g, 150, m1 * 0.38); b = mixf(b, 70, m1 * 0.38);
        var cv = 1 + cb[i] * 1.0; r *= cv; g *= cv; b *= cv;
        putTexel(job, i, r, g, b, glow * 255, city(px, py, pz) * (1 - m1) * 0.5, 0, e * 0.7 + cb[i] * 0.12);
      }
    }
    return { field: field, setup: setup, color: color, relK: 0.2 };
  };

  /* gas giants: zonal bands, jets, turbulence, vortex storms; style = jovian | saturn | ice | storm */
  var GAS_PAL = {
    jovian: [[0, '#4e2e24'], [0.18, '#7e4a32'], [0.36, '#b07a50'], [0.55, '#d4aa7a'], [0.75, '#ecd4aa'], [1, '#faf0dc']],
    saturn: [[0, '#8a6c3c'], [0.25, '#b8984e'], [0.5, '#d8bc72'], [0.75, '#ecd8a0'], [1, '#faf0cc']],
    ice: [[0, '#2a5ea8'], [0.25, '#3e8cc8'], [0.5, '#64b4de'], [0.75, '#9ad8ee'], [1, '#e2f8fc']],
    storm: [[0, '#1c1440'], [0.22, '#3e2278'], [0.44, '#8a3a9a'], [0.64, '#d2506a'], [0.82, '#f09050'], [1, '#ffe4b0']]
  };
  LOOK_GEN.gasgiant = function (job, P) {
    var style = P.bands, rnd = rng32(sub(P.seed, 141)), nz = makeNoise(sub(P.seed, 142)), nb = makeNoise(sub(P.seed, 143)), nd = makeNoise(sub(P.seed, 144));
    var W = job.W, H = job.H, sinT = job.sinT, cosT = job.cosT, oct3 = octs(job, 3), oct4 = octs(job, 4), oct5 = octs(job, 5);
    var ramp = makeRamp(GAS_PAL[style]), TN = 2048, bandTab = new Float32Array(TN), shearTab = new Float32Array(TN), jetTab = new Float32Array(TN);
    var o1 = rnd() * 40, o2 = rnd() * 40, o3 = rnd() * 40, bf = style === 'saturn' ? 3.2 : style === 'ice' ? 2.6 : style === 'storm' ? 4.2 : 4.8;
    var levels = style === 'saturn' ? 9 : style === 'ice' ? 6 : style === 'storm' ? 7 : 9, contrast = style === 'saturn' ? 0.55 : style === 'ice' ? 0.6 : 1.0;
    var j, ph = rnd() * 10;
    for (j = 0; j < TN; j++) {
      var yy = (j / (TN - 1)) * 2 - 1;
      var s = nb.n(0.31, yy * bf + ph, 0.17) * 0.62 + nb.n(0.31, yy * bf * 2.3 + ph + 5, 0.9) * 0.26 + nb.n(0.31, yy * bf * 5 + ph + 9, 0.4) * 0.12;
      var t = clamp(0.5 + 0.62 * s, 0, 1), P7 = t * levels, fl = floor(P7), fr = P7 - fl;
      bandTab[j] = clamp((fl + sstep(0.30, 0.70, fr)) / levels, 0, 1);
      jetTab[j] = nd.n(0.5, yy * 6.5 + ph, 0.3) * 0.6 + nd.n(0.5, yy * 14 + ph, 1.3) * 0.4;
    }
    for (j = 0; j < TN; j++) {
      var a = bandTab[Math.max(0, j - 3)], b = bandTab[Math.min(TN - 1, j + 3)];
      shearTab[j] = clamp(abs(b - a) * levels * 0.6, 0, 1);
    }
    // storms
    var storms = [], lat, lon, cl0, S;
    function addStorm(latv, rx, ry, tw, col, ring, opa) {
      var lonv = rnd() * TAU, cl1 = cos(latv), c = { x: cl1 * sin(lonv), y: sin(latv), z: cl1 * cos(lonv) };
      // east/north tangent basis at the centre
      var ex = c.z, ez = -c.x, el = sqrt(ex * ex + ez * ez) || 1; ex /= el; ez /= el;
      var nx = -c.y * c.x / (cl1 || 1), ny = cl1, nz2 = -c.y * c.z / (cl1 || 1);
      storms.push({ c: c, ex: ex, ez: ez, nx: nx, ny: ny, nz: nz2, rx: rx, ry: ry, tw: tw, col: col, ring: ring, opa: opa, lim: Math.max(rx, ry) * 2.6 });
    }
    if (style === 'jovian') {
      var sgn = rnd() < 0.5 ? -1 : 1;
      addStorm(sgn * (0.30 + rnd() * 0.10), 0.30, 0.15, 2.6, [190, 84, 56], [238, 200, 160], 0.92);
      for (j = 0; j < 4 + floor(rnd() * 3); j++) addStorm(-sgn * (0.42 + rnd() * 0.12), 0.05 + rnd() * 0.025, 0.035, 1.2, [250, 244, 232], [255, 255, 255], 0.9);
      addStorm(sgn * (-0.1 + rnd() * 0.05), 0.11, 0.035, 1.4, [96, 58, 40], [140, 96, 70], 0.8);
    } else if (style === 'saturn') {
      addStorm((rnd() - 0.5) * 0.8, 0.13, 0.08, 1.4, [250, 242, 214], [255, 250, 236], 0.8);
      addStorm((rnd() - 0.5) * 0.9, 0.07, 0.04, 1.0, [200, 164, 96], [230, 204, 140], 0.6);
    } else if (style === 'ice') {
      var sg = rnd() < 0.5 ? -1 : 1;
      addStorm(sg * (0.3 + rnd() * 0.15), 0.24, 0.12, 2.2, [20, 44, 120], [90, 150, 210], 0.9);
      addStorm(sg * (0.3 + rnd() * 0.15) + 0.14, 0.12, 0.03, 0.8, [240, 252, 255], [255, 255, 255], 0.85);
      addStorm(-sg * (0.5 + rnd() * 0.2), 0.08, 0.05, 1.2, [220, 246, 252], [250, 255, 255], 0.7);
    } else {
      for (j = 0; j < 5; j++) addStorm((rnd() - 0.5) * 1.5, 0.16 + rnd() * 0.18, 0.10 + rnd() * 0.1, (rnd() < 0.5 ? -1 : 1) * (2.4 + rnd() * 1.4), [220 + rnd() * 35, 80 + rnd() * 110, 70 + rnd() * 120], [255, 230, 190], 0.85);
    }
    var polar = style === 'jovian' ? [86, 84, 96] : style === 'saturn' ? [120, 128, 118] : style === 'ice' ? [150, 214, 230] : [60, 40, 110], ns = storms.length;
    var hexPh = rnd() * TAU;
    function color(y) {
      var latr = (0.5 - (y + 0.5) / H) * PI, cl = cos(latr), sl = sin(latr), base = y * W;
      for (var x = 0; x < W; x++) {
        var i = base + x, px = cl * sinT[x], py = sl, pz = cl * cosT[x];
        var jj = ((py + 1) * 0.5 * (TN - 1)) | 0, jet = jetTab[jj] * 0.55, ca = cos(jet), sa = sin(jet);
        var qx = px * ca + pz * sa, qy = py, qz = pz * ca - px * sa, k;
        for (k = 0; k < ns; k++) {
          var st = storms[k], dx = qx - st.c.x, dy = qy - st.c.y, dz = qz - st.c.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < st.lim * st.lim) {
            var u = sqrt(d2) / st.lim, f = 1 - u * u * (3 - 2 * u);
            twistPoint(qx, qy, qz, st.c.x, st.c.y, st.c.z, st.tw * f * f); qx = TX; qy = TY; qz = TZ;
          }
        }
        var shear = shearTab[jj] * 0.7 + 0.3;
        var tx = nz.n(qx * 2.4 + o1, qy * 6.5, qz * 2.4), ty = nz.n(qx * 2.4 + o2, qy * 6.5 + 3, qz * 2.4), tz = nz.n(qx * 2.4 + 5, qy * 6.5, qz * 2.4 + o1);
        var wy = qy + 0.055 * shear * ty + 0.012 * nz.n(qx * 9, qy * 22, qz * 9), wx = qx + 0.10 * shear * tx, wz = qz + 0.10 * shear * tz;
        var j2 = ((clamp(wy, -1, 1) + 1) * 0.5 * (TN - 1)) | 0, bv = bandTab[j2];
        var dn = nz.fbm(wx * 3 + o3, wy * 15, wz * 3, oct4), fn = nz.fbm(wx * 9, wy * 55, wz * 9, 3);
        var t = clamp(0.5 + (bv - 0.5) * contrast + 0.10 * dn + 0.05 * fn, 0, 1);
        rampAt(ramp, t);
        var r = CR, g = CG, b = CB, vv = 1 + 0.07 * fn; r *= vv; g *= vv; b *= vv;
        if (style === 'ice') {   // bright cirrus streaks
          var ci = nz.ridged(wx * 3.2 + o2, wy * 30, wz * 3.2, 3), cm = sstep(0.82, 0.96, ci) * sstep(0.1, 0.55, nz.n(wx * 1.4, wy * 4 + o3, wz * 1.4) * 0.5 + 0.5);
          r = mixf(r, 238, cm * 0.8); g = mixf(g, 250, cm * 0.8); b = mixf(b, 255, cm * 0.8);
        }
        for (k = 0; k < ns; k++) {
          var st2 = storms[k], dot = px * st2.c.x + py * st2.c.y + pz * st2.c.z;
          if (dot > 0.6) {
            var ox = px - st2.c.x * dot, oy = py - st2.c.y * dot, oz = pz - st2.c.z * dot;
            var ee = ox * st2.ex + oz * st2.ez, nn = ox * st2.nx + oy * st2.ny + oz * st2.nz, uu = sqrt((ee / st2.rx) * (ee / st2.rx) + (nn / st2.ry) * (nn / st2.ry));
            if (uu < 1.25) {
              var sm = sstep(1.0, 0.62, uu) * st2.opa, rm = sstep(1.25, 1.0, uu) * sstep(0.7, 1.0, uu) * 0.5;
              var sw = nz.fbm(qx * 6 + o1, qy * 12, qz * 6, 3) * 0.5 + 0.5, cmix = clamp(uu * 0.9 + (sw - 0.5) * 0.6, 0, 1);
              var sr = mixf(st2.col[0], st2.ring[0], cmix * cmix), sg2 = mixf(st2.col[1], st2.ring[1], cmix * cmix), sb = mixf(st2.col[2], st2.ring[2], cmix * cmix);
              r = mixf(r, st2.ring[0], rm * 0.5); g = mixf(g, st2.ring[1], rm * 0.5); b = mixf(b, st2.ring[2], rm * 0.5);
              r = mixf(r, sr, sm); g = mixf(g, sg2, sm); b = mixf(b, sb, sm);
            }
          }
        }
        var pm = sstep(0.74, 0.98, abs(py)) * 0.6;
        if (style === 'saturn' && py > 0.8) {   // hexagonal polar vortex
          var lonp = atan2(px, pz), rp = sqrt(max(0, 1 - py * py)), hexr = 0.34 / Math.max(0.5, cos(((lonp + hexPh) % (PI / 3) + PI / 3) % (PI / 3) - PI / 6));
          pm = max(pm, sstep(hexr + 0.03, hexr - 0.03, rp) * 0.85);
        }
        r = mixf(r, polar[0], pm); g = mixf(g, polar[1], pm); b = mixf(b, polar[2], pm);
        putTexel(job, i, r, g, b, 0, 0, 0, 0);
      }
    }
    return { field: null, setup: null, color: color, relK: 0.1, clouds: null };
  };

  /* ================================================================ planet objects, texture cache */
  var PCACHE = {}, useClock = 0, QUEUE = [], pumpTimer = 0, TEXCAP = 120 * 1048576, texBytes = 0;
  var COLC = {};
  // First-frame placeholder: a 64x32 texture of the same look (2-8 ms to generate) drawn while the real tiers are built in the
  // background. Nothing in draw()/sprite() generates a 128+ tier synchronously any more (that cost 30-650 ms per unique planet).
  var PH_W = 64;

  function getPlanet(desc) {
    desc = desc || {};
    var look = typeof desc.look === 'string' && LOOK_SET[desc.look] ? desc.look : 'barren';
    var seed = seedOf(desc.seed), bands = '';
    if (look === 'gasgiant') bands = BANDS.indexOf(desc.bands) >= 0 ? desc.bands : BANDS[sub(seed, 5) % 4];
    var rings = !!desc.rings && look !== 'asteroids';
    var key = look + '|' + seed + '|' + bands + '|' + (rings ? 'r' : '');
    var P = PCACHE[key];
    if (!P) {
      var rnd = rng32(sub(seed, hashStr(look) + 3));
      P = PCACHE[key] = {
        key: key, look: look, seed: seed, bands: bands, rings: rings, cfg: cfgOf(look, bands),
        tau: (rnd() - 0.5) * 0.8, pitch: rings ? (rnd() < 0.8 ? 1 : -1) * (0.27 + rnd() * 0.15) : (rnd() - 0.32) * 0.62,
        phase0: rnd(), phase0c: rnd(), tex: {}, ph: null, jobs: {}, last: 0, ring: null, rock: null
      };
      if (rings) P.ring = makeRingSpec(P, rnd);
      P.cfg.dlut = gammaLut(P.cfg.gamma);
    }
    P.last = ++useClock;
    return P;
  }
  var _gl = {};
  function gammaLut(g) {
    var k = String(g);
    if (!_gl[k]) { var l = new Float32Array(1026); for (var i = 0; i < 1026; i++) l[i] = pow(min(1, i / 1024), g); _gl[k] = l; }
    return _gl[k];
  }
  function ownerColor(hex) {
    if (!hex) return null;
    var c = COLC[hex];
    if (!c) {
      var v = parseHex(hex), m = Math.max(v[0], v[1], v[2], 1);
      c = COLC[hex] = [v[0] * 255 / m, v[1] * 255 / m, v[2] * 255 / m];
    }
    return c;
  }

  function bestTex(P) {
    var best = null;
    for (var i = TIERS.length - 1; i >= 0; i--) if (P.tex[TIERS[i]]) { best = P.tex[TIERS[i]]; break; }
    return best;
  }
  function placeholderTex(P) {
    if (!P.ph) { var job = makeJob(P, PH_W); stepJob(job, Infinity); P.ph = job.tex; }
    return P.ph;
  }
  // best texture right now (placeholder when nothing is built yet) + the next tier queued towards `want` (never synchronous)
  function texNow(P, want, prio) {
    var tex = bestTex(P), nt = tex ? TIERS[TIERS.indexOf(tex.W) + 1] : TIERS[0];
    if (!tex) tex = placeholderTex(P);
    if (nt && nt <= want) requestTex(P, nt, false, prio);
    return tex;
  }
  function addTex(P, W, tex) {
    if (P.tex[W]) return;
    P.tex[W] = tex; texBytes += tex.bytes;
    if (texBytes > TEXCAP) evictTex(P);
  }
  function evictTex(keep) {
    var keys = Object.keys(PCACHE), arr = [];
    for (var i = 0; i < keys.length; i++) { var p = PCACHE[keys[i]]; if (p !== keep && p.last < useClock - 12 && Object.keys(p.tex).length) arr.push(p); }
    arr.sort(function (a, b) { return a.last - b.last; });
    for (i = 0; i < arr.length && texBytes > TEXCAP * 0.75; i++) {
      for (var w in arr[i].tex) texBytes -= arr[i].tex[w].bytes;
      arr[i].tex = {};
    }
  }
  function schedule() {
    if (pumpTimer) return;
    pumpTimer = setTimeout(pump, 2);
  }
  function pump() {
    pumpTimer = 0;
    var t0 = now();
    while (QUEUE.length && now() - t0 < 7) {
      var job = QUEUE[0];
      if (job.lazy) {                               // queued request: allocate the real job only when it starts running
        if (job.P.tex[job.W]) { QUEUE.shift(); delete job.P.jobs[job.W]; continue; }
        job = QUEUE[0] = job.P.jobs[job.W] = makeJob(job.P, job.W);
      }
      stepJob(job, Math.max(1, 7.5 - (now() - t0)));
      if (job.done) { QUEUE.shift(); addTex(job.P, job.W, job.tex); delete job.P.jobs[job.W]; texLanded(job.P); }
    }
    if (QUEUE.length) schedule();
  }
  function enqueue(job) {              // keep the queue ordered by priority (on-screen radius), FIFO within equal priority
    var i = QUEUE.length;
    while (i > 0 && (QUEUE[i - 1].prio || 0) < (job.prio || 0) && !(i === 1 && !QUEUE[0].lazy)) i--;
    QUEUE.splice(i, 0, job);
  }
  // ask for tier W: sync -> returns tex now; async -> queues a background job and returns the tex if already present
  function requestTex(P, W, sync, prio) {
    if (P.tex[W]) return P.tex[W];
    var job = P.jobs[W];
    if (sync) {
      var qi = job ? QUEUE.indexOf(job) : -1;
      if (!job || job.lazy) job = P.jobs[W] = makeJob(P, W);
      if (qi >= 0) QUEUE.splice(qi, 1);
      stepJob(job, Infinity);
      qi = QUEUE.indexOf(job); if (qi >= 0) QUEUE.splice(qi, 1);
      addTex(P, W, job.tex); delete P.jobs[W];
      return job.tex;
    }
    prio = prio || 0;
    if (!job) { P.jobs[W] = { lazy: true, P: P, W: W, prio: prio }; enqueue(P.jobs[W]); schedule(); }
    else if (job.lazy && prio > job.prio) { QUEUE.splice(QUEUE.indexOf(job), 1); job.prio = prio; enqueue(job); }
    return null;
  }
  function tierFor(Rd, hi) {
    var need = Rd * 4;
    if (need <= 128) return 128;
    if (need <= 256) return 256;
    if (need <= 512 || !hi) return 512;
    return 1024;
  }
  function levelFor(tex, Rd) {
    var want = Rd * 4, lv = 0;     // texture width should be >= 2 * diameter
    for (var i = 0; i < tex.levels.length; i++) { if (tex.levels[i].W >= want) lv = i; else break; }
    return lv;
  }

  /* ================================================================ geometry / lighting tables */
  function buildGeom(Rr, bw, bh, cxb, cyb, tau, pitch) {
    var maxN = ((PI * (Rr + 2) * (Rr + 2)) | 0) + 128;
    var g = {
      n: 0, pos: new Int32Array(maxN), uf: new Float32Array(maxN), vf: new Float32Array(maxN), nx: new Float32Array(maxN), ny: new Float32Array(maxN),
      nz: new Float32Array(maxN), qx: new Float32Array(maxN), qy: new Float32Array(maxN), qz: new Float32Array(maxN), cov: new Uint8Array(maxN),
      rim: new Float32Array(maxN), limbB: new Float32Array(maxN), rows: {}, Rr: Rr, bw: bw, bh: bh, cxb: cxb, cyb: cyb, tau: tau, pitch: pitch
    };
    var ct = cos(tau), st = sin(tau), cp = cos(pitch), sp = sin(pitch), invR = 1 / Rr, k = 0;
    var xs = max(0, floor(cxb - Rr - 1)), xe = min(bw - 1, ceil(cxb + Rr + 1)), ys = max(0, floor(cyb - Rr - 1)), ye = min(bh - 1, ceil(cyb + Rr + 1));
    for (var py = ys; py <= ye; py++) {
      var dy = py + 0.5 - cyb;
      for (var px = xs; px <= xe; px++) {
        var dx = px + 0.5 - cxb, d = sqrt(dx * dx + dy * dy);
        if (d > Rr + 0.5) continue;
        var c = Rr + 0.5 - d; if (c > 1) c = 1;
        var s = d * invR, kk = 1;
        if (s > 0.9996) { kk = 0.9996 / s; s = 0.9996; }
        var nx = dx * invR * kk, ny = -dy * invR * kk, nzv = sqrt(1 - s * s);
        var qx = nx * ct + ny * st;
        var qy = -nx * st * cp + ny * ct * cp + nzv * sp;
        var qz = nx * st * sp - ny * ct * sp + nzv * cp;
        var uf = atan2(qx, qz) / TAU; if (uf < 0) uf += 1;
        g.pos[k] = py * bw + px; g.uf[k] = uf; g.vf[k] = 0.5 - asin(qy > 1 ? 1 : qy < -1 ? -1 : qy) / PI;
        g.nx[k] = nx; g.ny[k] = ny; g.nz[k] = nzv; g.qx[k] = qx; g.qy[k] = qy; g.qz[k] = qz; g.cov[k] = (c * 255 + 0.5) | 0;
        g.rim[k] = pow(1 - nzv, 2.6); g.limbB[k] = pow(1 - nzv, 1.6);
        k++;
      }
    }
    g.n = k;
    return g;
  }
  // per-texture-level vertical sampling rows
  function geomRows(g, L) {
    var key = L.W, r = g.rows[key];
    if (r) return r;
    var n = g.n, Hl = L.H, Wl = L.W, r0 = new Int32Array(n), r1 = new Int32Array(n), fy = new Float32Array(n);
    for (var k = 0; k < n; k++) {
      var V = g.vf[k] * Hl - 0.5, i0 = floor(V), f = V - i0, i1 = i0 + 1;
      if (i0 < 0) { i0 = 0; f = 0; } else if (i0 > Hl - 1) { i0 = Hl - 1; }
      if (i1 > Hl - 1) i1 = Hl - 1; if (i1 < 0) i1 = 0;
      r0[k] = i0 * Wl; r1[k] = i1 * Wl; fy[k] = f;
    }
    return (g.rows[key] = { r0: r0, r1: r1, fy: fy });
  }

  function lightVec(angle, elev) {
    var se = elev, ce = sqrt(max(0, 1 - se * se));
    return [cos(angle) * ce, -sin(angle) * ce, se];
  }
  function powLut(e) { var l = new Float32Array(4097); for (var i = 0; i <= 4096; i++) l[i] = pow(i / 4096, e); return l; }
  var TINTLUT = (function () { var l = new Float32Array(1025); for (var i = 0; i < 1025; i++) { var b = i / 512 - 1; l[i] = exp(-((b - 0.04) * (b - 0.04)) / 0.0225); } return l; })();
  function buildLight(g, lv, P, ringInfo) {
    var cfg = P.cfg, n = g.n;
    var lt = {
      base: new Float32Array(n), bE: new Float32Array(n), bN: new Float32Array(n), du: new Float32Array(n), dv: new Float32Array(n),
      sp: new Float32Array(n), haze: new Float32Array(n), tint: new Float32Array(n), night: new Float32Array(n), limb: null, rs: null
    };
    var lx = lv[0], ly = lv[1], lz = lv[2], ct = cos(g.tau), st = sin(g.tau), cp = cos(g.pitch), sp = sin(g.pitch);
    var lqx = lx * ct + ly * st, lqy = -lx * st * cp + ly * ct * cp + lz * sp, lqz = lx * st * sp - ly * ct * sp + lz * cp;
    var hx = lx, hy = ly, hz = lz + 1, hl = sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
    var str = cfg.str, tamt = cfg.tintAmt * Math.min(1, str * 1.5), limbK = cfg.limb, useSpec = cfg.spec > 0;
    var sl1 = null, sl2 = null;
    if (useSpec) { sl1 = cfg.specLut1 || (cfg.specLut1 = powLut(cfg.specPow * 2.4)); sl2 = cfg.specLut2 || (cfg.specLut2 = powLut(16)); }
    if (limbK > 0) lt.limb = new Float32Array(n);
    var nxA = g.nx, nyA = g.ny, nzA = g.nz, qxA = g.qx, qyA = g.qy, qzA = g.qz, rimA = g.rim, limbBA = g.limbB;
    var baseA = lt.base, bEA = lt.bE, bNA = lt.bN, duA = lt.du, dvA = lt.dv, spA = lt.sp, hzA = lt.haze, tnA = lt.tint, ngA = lt.night;
    for (var k = 0; k < n; k++) {
      var nx = nxA[k], ny = nyA[k], nz = nzA[k], b = nx * lx + ny * ly + nz * lz;
      var qx = qxA[k], qy = qyA[k], qz = qzA[k], s = sqrt(qx * qx + qz * qz), inv = s > 1e-3 ? 1 / s : 0;
      var ex = qz * inv, ez = -qx * inv, nxv = -qy * qx * inv, nyv = s, nzv = -qy * qz * inv;
      if (!inv) { ex = 1; ez = 0; nxv = 0; nyv = 0; nzv = 0; }
      var bE = lqx * ex + lqz * ez, bN = lqx * nxv + lqy * nyv + lqz * nzv;
      baseA[k] = b; bEA[k] = bE; bNA[k] = bN;
      var scl = 0.022 / (b + 0.2 > 0.42 ? b + 0.2 : 0.42);
      duA[k] = scl * bE / ((s > 0.2 ? s : 0.2) * TAU); dvA[k] = -scl * bN / PI;
      if (useSpec) {
        var nh = nx * hx + ny * hy + nz * hz;
        if (nh > 0) {
          var ti = (b + 0.02) / 0.22; ti = ti < 0 ? 0 : ti > 1 ? 1 : ti;
          var ni = (nh * 4095) | 0;
          spA[k] = (0.9 * sl1[ni] + 0.075 * sl2[ni]) * ti * ti * (3 - 2 * ti);
        }
      }
      var tl = (b + 0.30) / 0.75; tl = tl < 0 ? 0 : tl > 1 ? 1 : tl;
      hzA[k] = str * rimA[k] * (0.10 + 0.90 * tl * tl * (3 - 2 * tl));
      if (tamt > 0) tnA[k] = tamt * TINTLUT[((b + 1) * 512) | 0];
      var tn = (b + 0.02) / 0.24; tn = tn < 0 ? 0 : tn > 1 ? 1 : tn;
      ngA[k] = 1 - tn * tn * (3 - 2 * tn);
      if (limbK > 0) lt.limb[k] = 1 - limbK * limbBA[k];
    }
    if (ringInfo) lt.rs = ringShadowOnPlanet(g, lv, ringInfo);
    return lt;
  }
  function buildHalo(bw, bh, cxb, cyb, Rr, cfg, lv) {
    if (!(cfg.halo > 0 && cfg.str > 0)) return null;
    var buf = new Uint32Array(bw * bh), ext = Rr * cfg.haloW * 1.6, ar = cfg.atm[0] | 0, ag = cfg.atm[1] | 0, ab = cfg.atm[2] | 0;
    var r0 = Rr - 1.5, r1 = Rr + ext, lx = lv[0], ly = lv[1];
    var xs = max(0, floor(cxb - r1 - 1)), xe = min(bw - 1, ceil(cxb + r1 + 1)), ys = max(0, floor(cyb - r1 - 1)), ye = min(bh - 1, ceil(cyb + r1 + 1));
    for (var py = ys; py <= ye; py++) {
      var dy = py + 0.5 - cyb;
      for (var px = xs; px <= xe; px++) {
        var dx = px + 0.5 - cxb, d = sqrt(dx * dx + dy * dy);
        if (d < r0 || d > r1) continue;
        var s = (d - Rr) / ext; if (s < 0) s = 0;
        var f = 1 - s; f = f * f * f;
        var ndlo = (dx * lx - dy * ly) / d, lit = 0.10 + 0.90 * sstep(-0.30, 0.45, ndlo);
        var a = cfg.str * cfg.halo * lit * f;
        if (a > 1) a = 1;
        buf[py * bw + px] = (((a * 255 + 0.5) | 0) << 24) | (ab << 16) | (ag << 8) | ar;
      }
    }
    return buf;
  }

  /* ================================================================ the pixel loop */
  function renderBody(inst, tex, lvl, fr) {
    var g = inst.geom, lt = inst.lt, P = inst.P, cfg = P.cfg;
    var L = tex.levels[lvl], Wl = L.W, Hl = L.H, Wm = Wl - 1, S = L.s, D = L.d, C = L.c;
    var rc = geomRows(g, L), n = g.n, pos = g.pos, uf = g.uf, vf = g.vf, cov = g.cov, r0A = rc.r0, r1A = rc.r1, fyA = rc.fy;
    var baseA = lt.base, bEA = lt.bE, bNA = lt.bN, duA = lt.du, dvA = lt.dv, spA = lt.sp, hzA = lt.haze, tnA = lt.tint, ngA = lt.night, rsA = lt.rs, lmA = lt.limb;
    var out = inst.out32, halo = inst.halo;
    if (halo && fr.atm) out.set(halo); else out.fill(0);
    var sph = fr.spin, spc = fr.cspin;
    var bumpK = fr.bump ? cfg.bump : 0, specK = fr.spec ? cfg.spec / 255 : 0, hasC = fr.clouds && tex.hasClouds, shadeC = hasC && fr.shade;
    var glowL = cfg.glowLUT, hasGlow = !!glowL, glowDay = cfg.glowDay, lightsOn = fr.lights, useAtm = fr.atm && cfg.str > 0;
    var needD = bumpK > 0 || specK > 0 || lightsOn;
    var wrap = cfg.wrap, iw = 1 / (1 + wrap), wrapC = wrap + 0.12, iwc = 1 / (1 + wrapC), dlut = cfg.dlut;
    var amR = cfg.amb[0], amG = cfg.amb[1], amB = cfg.amb[2], suR = cfg.sun[0], suG = cfg.sun[1], suB = cfg.sun[2];
    var clR = cfg.cloudCol[0], clG = cfg.cloudCol[1], clB = cfg.cloudCol[2], ambC = 0.07;
    var atR = cfg.atm[0], atG = cfg.atm[1], atB = cfg.atm[2], tiR = cfg.tint[0], tiG = cfg.tint[1], tiB = cfg.tint[2];
    var ciR = fr.city[0], ciG = fr.city[1], ciB = fr.city[2], cityK = cfg.city * 0.9, i127 = 1 / 127, i255 = 1 / 255;
    var Hm = Hl - 1;
    for (var k = 0; k < n; k++) {
      var u = (uf[k] - sph + 1) * Wl - 0.5, ix0 = u | 0, fx = u - ix0, ix1;
      ix0 &= Wm; ix1 = (ix0 + 1) & Wm;
      var a0 = r0A[k], a1 = r1A[k], fy = fyA[k];
      var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      var t00 = S[a0 + ix0], t10 = S[a0 + ix1], t01 = S[a1 + ix0], t11 = S[a1 + ix1];
      var ar = w00 * (t00 & 255) + w10 * (t10 & 255) + w01 * (t01 & 255) + w11 * (t11 & 255);
      var ag = w00 * ((t00 >>> 8) & 255) + w10 * ((t10 >>> 8) & 255) + w01 * ((t01 >>> 8) & 255) + w11 * ((t11 >>> 8) & 255);
      var ab = w00 * ((t00 >>> 16) & 255) + w10 * ((t10 >>> 16) & 255) + w01 * ((t01 >>> 16) & 255) + w11 * ((t11 >>> 16) & 255);
      var b0 = baseA[k], ndl = b0, cityV = 0, glossV = 0;
      if (needD) {
        var q00 = D[a0 + ix0], q10 = D[a0 + ix1], q01 = D[a1 + ix0], q11 = D[a1 + ix1];
        if (bumpK > 0) {
          var gx = (w00 * (q00 & 255) + w10 * (q10 & 255) + w01 * (q01 & 255) + w11 * (q11 & 255) - 128) * i127;
          var gy = (w00 * ((q00 >>> 8) & 255) + w10 * ((q10 >>> 8) & 255) + w01 * ((q01 >>> 8) & 255) + w11 * ((q11 >>> 8) & 255) - 128) * i127;
          ndl = b0 - bumpK * (gx * bEA[k] + gy * bNA[k]);
        }
        cityV = w00 * ((q00 >>> 16) & 255) + w10 * ((q10 >>> 16) & 255) + w01 * ((q01 >>> 16) & 255) + w11 * ((q11 >>> 16) & 255);
        glossV = w00 * (q00 >>> 24) + w10 * (q10 >>> 24) + w01 * (q01 >>> 24) + w11 * (q11 >>> 24);
      }
      var ca = 0, ca2 = 0;
      if (hasC) {
        var uc = (uf[k] - spc + 1) * Wl - 0.5, cx0 = uc | 0, cfx = uc - cx0, cx1;
        cx0 &= Wm; cx1 = (cx0 + 1) & Wm;
        ca = ((1 - cfx) * ((1 - fy) * C[a0 + cx0] + fy * C[a1 + cx0]) + cfx * ((1 - fy) * C[a0 + cx1] + fy * C[a1 + cx1])) * i255;
        if (shadeC) {
          var uc2 = uc + duA[k] * Wl + 2 * Wl, v2 = (vf[k] + dvA[k]) * Hl - 0.5, iy0 = floor(v2), fy2 = v2 - iy0, iy1 = iy0 + 1;
          iy0 = iy0 < 0 ? 0 : iy0 > Hm ? Hm : iy0; iy1 = iy1 < 0 ? 0 : iy1 > Hm ? Hm : iy1;
          var xa = uc2 | 0, fx2 = uc2 - xa, xb; xa &= Wm; xb = (xa + 1) & Wm;
          var b0r = iy0 * Wl, b1r = iy1 * Wl;
          ca2 = ((1 - fx2) * ((1 - fy2) * C[b0r + xa] + fy2 * C[b1r + xa]) + fx2 * ((1 - fy2) * C[b0r + xb] + fy2 * C[b1r + xb])) * i255;
        }
      }
      var dd = (ndl + wrap) * iw; dd = dd < 0 ? 0 : dd > 1 ? 1 : dd;
      var dl = dlut[(dd * 1024) | 0], shadow = rsA ? rsA[k] : 1;
      if (shadeC) shadow *= 1 - 0.42 * ca2;
      var r = ar * (amR + suR * dl * shadow), g2 = ag * (amG + suG * dl * shadow), b = ab * (amB + suB * dl * shadow);
      if (specK > 0 && glossV > 3) {
        var sv = spA[k] * glossV * specK * (1 - 0.9 * ca) * shadow;
        r += 255 * sv; g2 += 248 * sv; b += 236 * sv;
      }
      if (hasGlow) {
        var ae = w00 * (t00 >>> 24) + w10 * (t10 >>> 24) + w01 * (t01 >>> 24) + w11 * (t11 >>> 24);
        if (ae > 1.5) {
          var gi = (ae | 0) * 3, gk = (glowDay + (1 - glowDay) * ngA[k]) * (1 - 0.75 * ca);
          r += glowL[gi] * gk; g2 += glowL[gi + 1] * gk; b += glowL[gi + 2] * gk;
        }
      }
      if (lightsOn && cityV > 3) {
        var cv = cityV * i255 * ngA[k] * cityK * (1 - 0.88 * ca);
        if (cv > 0.004) { var cw = 55 * cv * cv; r += ciR * cv + cw; g2 += ciG * cv + cw * 0.8; b += ciB * cv + cw * 0.5; }
      }
      if (ca > 0.004) {
        var dc = (b0 + wrapC) * iwc; if (shadeC) dc += 0.85 * (ca2 - ca);
        dc = dc < 0 ? 0 : dc > 1 ? 1 : dc;
        var cl = ambC + (1 - ambC) * dlut[(dc * 1024) | 0];
        r += (clR * cl - r) * ca; g2 += (clG * cl - g2) * ca; b += (clB * cl - b) * ca;
      }
      if (useAtm) {
        var hz = hzA[k], tn = tnA[k];
        r += (atR - r) * hz + tiR * tn; g2 += (atG - g2) * hz + tiG * tn; b += (atB - b) * hz + tiB * tn;
      }
      if (lmA) { var lf = lmA[k]; r *= lf; g2 *= lf; b *= lf; }
      r = r > 255 ? 255 : r; g2 = g2 > 255 ? 255 : g2; b = b > 255 ? 255 : b;
      var px = pos[k], cvv = cov[k], ri = r | 0, gi2 = g2 | 0, bi = b | 0;
      if (cvv === 255) out[px] = 0xff000000 | (bi << 16) | (gi2 << 8) | ri;
      else {
        var hp = out[px], ha = (hp >>> 24) * i255, c = cvv * i255, ao = c + ha * (1 - c), wb = c / ao, wh = ha * (1 - c) / ao;
        ri = ri * wb + (hp & 255) * wh; gi2 = gi2 * wb + ((hp >>> 8) & 255) * wh; bi = bi * wb + ((hp >>> 16) & 255) * wh;
        out[px] = (((ao * 255 + 0.5) | 0) << 24) | ((bi | 0) << 16) | ((gi2 | 0) << 8) | (ri | 0);
      }
    }
  }

  /* ================================================================ rings */
  var RING_PAL = {
    jovian: [[116, 92, 68], [188, 158, 118], [238, 214, 176]],
    saturn: [[148, 124, 92], [214, 188, 138], [250, 234, 194]],
    ice: [[112, 142, 164], [172, 202, 220], [228, 241, 250]],
    storm: [[92, 68, 88], [160, 130, 142], [220, 198, 204]]
  };
  function makeRingSpec(P, rnd) {
    var style = P.look === 'gasgiant' ? P.bands : 'saturn', pal = RING_PAL[style];
    var inner = 1.30 + rnd() * 0.12, outer = 1.92 + rnd() * 0.26, N = 512, i, j;
    var nz = makeNoise(sub(P.seed, 55)), dens = new Float32Array(N), col = new Float32Array(N * 3), raw = new Float32Array(N), rcol = new Float32Array(N);
    var nb = 6 + floor(rnd() * 5), cuts = [0, 1];
    for (i = 1; i < nb; i++) cuts.push(i / nb + (rnd() - 0.5) * 0.7 / nb);
    cuts.sort(function (a, b) { return a - b; });
    var segD = [], segC = [];
    for (i = 0; i < cuts.length - 1; i++) {
      var gap = rnd() < 0.13;
      segD.push(gap ? 0.04 + rnd() * 0.08 : 0.50 + rnd() * 0.48); segC.push(rnd());
    }
    var big = floor(rnd() * (cuts.length - 1));          // one prominent gap (a "division")
    segD[big] = 0.05; if (big + 1 < segD.length) segD[big + 1] = Math.max(segD[big + 1], 0.8);
    for (i = 0; i < N; i++) {
      var t = i / (N - 1), s = 0;
      for (j = 0; j < cuts.length - 1; j++) if (t >= cuts[j] && t <= cuts[j + 1]) { s = j; break; }
      var ring = 0.62 + 0.38 * (nz.n(t * 55, 0.7, 3.3) * 0.5 + nz.n(t * 170, 2.1, 1.0) * 0.32 + 0.5);
      raw[i] = segD[s] * clamp(ring, 0.2, 1.1);
      rcol[i] = clamp(segC[s] * 0.7 + 0.3 * (nz.n(t * 25, 5.5, 2.2) * 0.5 + 0.5), 0, 1);
    }
    for (i = 0; i < N; i++) {                              // soften segment boundaries
      var sd = 0, sc = 0, cnt = 0;
      for (j = -6; j <= 6; j++) { var k = clamp(i + j, 0, N - 1); sd += raw[k]; sc += rcol[k]; cnt++; }
      var t2 = i / (N - 1), edge = sstep(0, 0.02, t2) * sstep(1, 0.975, t2);
      dens[i] = clamp(sd / cnt, 0, 1) * edge * 0.94;
      var tc = sc / cnt, m = tc < 0.5 ? tc * 2 : (tc - 0.5) * 2, A = tc < 0.5 ? pal[0] : pal[1], B = tc < 0.5 ? pal[1] : pal[2];
      col[i * 3] = mixf(A[0], B[0], m); col[i * 3 + 1] = mixf(A[1], B[1], m); col[i * 3 + 2] = mixf(A[2], B[2], m);
    }
    return { inner: inner, outer: outer, N: N, dens: dens, col: col };
  }
  function ringAxis(P) {
    var ct = cos(P.tau), st = sin(P.tau), cp = cos(P.pitch), sp = sin(P.pitch);
    return [-st * cp, ct * cp, sp];
  }
  function ringExtents(P) {
    var a = ringAxis(P), o = P.ring.outer;
    return { hx: o * sqrt(max(0, 1 - a[0] * a[0])), hy: o * sqrt(max(0, 1 - a[1] * a[1])) };
  }
  function ringInfoFor(P) { return { a: ringAxis(P), ring: P.ring }; }
  // multiplier (0..1) of sunlight reaching each planet pixel after passing through the rings
  function ringShadowOnPlanet(g, lv, info) {
    var n = g.n, out = new Float32Array(n), a = info.a, R = info.ring, lx = lv[0], ly = lv[1], lz = lv[2];
    var al = a[0] * lx + a[1] * ly + a[2] * lz, span = R.outer - R.inner, N = R.N;
    for (var k = 0; k < n; k++) {
      var sx = g.nx[k], sy = g.ny[k], sz = g.nz[k], v = 1;
      if (abs(al) > 1e-3) {
        var t = -(a[0] * sx + a[1] * sy + a[2] * sz) / al;
        if (t > 0) {
          var qx = sx + t * lx, qy = sy + t * ly, qz = sz + t * lz, rho = sqrt(qx * qx + qy * qy + qz * qz);
          var f = (rho - R.inner) / span;
          if (f >= 0 && f <= 1) v = 1 - 0.86 * R.dens[(f * (N - 1)) | 0];
        }
      }
      out[k] = v;
    }
    return out;
  }
  // back/front ring canvases for an instance box
  function renderRingLayers(P, inst, lv) {
    var R = P.ring, lay = inst.lay, bw = lay.bw, bh = lay.bh, cx = lay.cx, cy = lay.cy, Rr = inst.Rr, a = ringAxis(P);
    var ax = a[0], ay = a[1], az = a[2], lx = lv[0], ly = lv[1], lz = lv[2], al = ax * lx + ay * ly + az * lz;
    var cvB = createCanvas(bw, bh), cvF = createCanvas(bw, bh), cB = cvB.getContext('2d'), cF = cvF.getContext('2d');
    var iB = cB.createImageData(bw, bh), iF = cF.createImageData(bw, bh), B32 = new Uint32Array(iB.data.buffer), F32 = new Uint32Array(iF.data.buffer);
    var ss = Rr < 90 ? 3 : 1, ss2 = ss * ss, inv = 1 / Rr, span = R.outer - R.inner, N = R.N, in2 = R.inner * R.inner, out2 = R.outer * R.outer;
    var sameSide = (az > 0) === (al > 0), lum = sameSide ? 0.38 + 0.62 * Math.min(1, abs(al) * 1.6 + 0.15) : 0.30;
    var ex = ringExtents(P), x0 = max(0, floor(cx - ex.hx * Rr - 2)), x1 = min(bw - 1, ceil(cx + ex.hx * Rr + 2));
    var y0 = max(0, floor(cy - ex.hy * Rr - 2)), y1 = min(bh - 1, ceil(cy + ex.hy * Rr + 2));
    for (var py = y0; py <= y1; py++) {
      for (var px = x0; px <= x1; px++) {
        var bA = 0, bR = 0, bG = 0, bBl = 0, fA = 0, fR = 0, fG = 0, fBl = 0;
        for (var sj = 0; sj < ss; sj++) {
          for (var si = 0; si < ss; si++) {
            var x = (px + (si + 0.5) / ss - cx) * inv, y = -(py + (sj + 0.5) / ss - cy) * inv;
            var z = -(ax * x + ay * y) / az, r2 = x * x + y * y + z * z;
            if (r2 < in2 || r2 > out2) continue;
            var f = (sqrt(r2) - R.inner) / span, idx = (f * (N - 1)) | 0, al0 = R.dens[idx];
            if (al0 < 0.004) continue;
            // planet shadow on the ring
            var pl = x * lx + y * ly + z * lz, shadow = 0;
            if (pl < 0) { var dp = sqrt(max(0, r2 - pl * pl)); shadow = sstep(1.05, 0.93, dp); }
            var sh = lum * (1 - 0.9 * shadow);
            var rr = R.col[idx * 3] * sh, gg = R.col[idx * 3 + 1] * sh, bb = R.col[idx * 3 + 2] * sh;
            var front = false, d2 = x * x + y * y;
            if (d2 < 1) front = z > sqrt(1 - d2);
            var aa = al0 * (sameSide ? 1 : 0.8);
            if (front) { fA += aa; fR += rr * aa; fG += gg * aa; fBl += bb * aa; } else { bA += aa; bR += rr * aa; bG += gg * aa; bBl += bb * aa; }
          }
        }
        var o = py * bw + px;
        if (bA > 0) B32[o] = packStraight(bR / bA, bG / bA, bBl / bA, bA / ss2);
        if (fA > 0) F32[o] = packStraight(fR / fA, fG / fA, fBl / fA, fA / ss2);
      }
    }
    cB.putImageData(iB, 0, 0); cF.putImageData(iF, 0, 0);
    return { back: cvB, front: cvF };
  }
  function packStraight(r, g, b, a) {
    r = r > 255 ? 255 : r; g = g > 255 ? 255 : g; b = b > 255 ? 255 : b; a = a > 1 ? 1 : a;
    return (((a * 255 + 0.5) | 0) << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
  }

  /* ================================================================ instances, draw(), sprite() */
  var INST = {}, INSTKEYS = [], RMAX = 230;
  function createCanvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function haloExtent(P) { return P.cfg.halo > 0 && P.cfg.str > 0 ? P.cfg.haloW * 1.6 : 0.0; }
  function layoutFor(P, Rr) {
    var ext = haloExtent(P), px = ext, py = ext;
    if (P.ring) { var e = ringExtents(P); px = max(px, e.hx - 1 + 0.04); py = max(py, e.hy - 1 + 0.04); }
    var padx = ceil(Rr * px) + 3, pady = ceil(Rr * py) + 3;
    return { bw: 2 * (Rr + padx), bh: 2 * (Rr + pady), cx: Rr + padx, cy: Rr + pady };
  }
  function makeInst(P, Rr, lay) {
    var cv = createCanvas(lay.bw, lay.bh), ctx = cv.getContext('2d'), img = ctx.createImageData(lay.bw, lay.bh);
    return {
      P: P, Rr: Rr, lay: lay, cv: cv, ctx: ctx, img: img, out32: new Uint32Array(img.data.buffer),
      geom: buildGeom(Rr, lay.bw, lay.bh, lay.cx, lay.cy, P.tau, P.pitch), lt: null, halo: null, la: NaN, le: NaN, texW: 0, lvl: -1,
      sp: 9, csp: 9, dirty: true, ringLayers: null, ringInfo: null, flagKey: -1, cityRef: null, fr: { city: [255, 200, 120] }
    };
  }
  var instBytes = 0, INST_CAP = 176 * 1048576;
  function getInst(P, Rr) {
    var key = P.key + '|' + Rr, inst = INST[key];
    if (!inst) {
      inst = INST[key] = makeInst(P, Rr, layoutFor(P, Rr)); INSTKEYS.push(key);
      inst.key = key; inst.bytes = inst.lay.bw * inst.lay.bh * 8 + inst.geom.n * 100 + (inst.P.ring ? inst.lay.bw * inst.lay.bh * 8 : 0);
      instBytes += inst.bytes;
      while ((instBytes > INST_CAP || INSTKEYS.length > 90) && INSTKEYS.length > 1) {
        var old = INSTKEYS.shift(), oi = INST[old]; if (oi) { instBytes -= oi.bytes; delete INST[old]; }
      }
    } else { var ix = INSTKEYS.indexOf(key); if (ix !== INSTKEYS.length - 1 && ix >= 0) { INSTKEYS.splice(ix, 1); INSTKEYS.push(key); } }
    return inst;
  }
  function relight(inst, la, le) {
    if (inst.la === la && inst.le === le) return;
    var lv = lightVec(la, le), P = inst.P;
    inst.la = la; inst.le = le;
    inst.ringInfo = P.ring ? ringInfoFor(P) : null;
    inst.lt = buildLight(inst.geom, lv, P, inst.ringInfo);
    inst.halo = buildHalo(inst.lay.bw, inst.lay.bh, inst.lay.cx, inst.lay.cy, inst.Rr, P.cfg, lv);
    inst.ringLayers = P.ring ? renderRingLayers(P, inst, lv) : null;
    inst.dirty = true;
  }
  var CITYC = {};
  function cityColor(hex) {
    var k = hex || '', c = CITYC[k];
    if (c) return c;
    var warm = [255, 188, 100], o = ownerColor(hex);
    c = o ? [mixf(warm[0], o[0], 0.45), mixf(warm[1], o[1], 0.45), mixf(warm[2], o[2], 0.45)] : warm;
    return (CITYC[k] = c);
  }
  function setFlags(inst, desc, opts, Rr) {
    var P = inst.P, fr = inst.fr, cc = cityColor(desc && desc.color);
    fr.clouds = opts.clouds !== false; fr.atm = opts.atmosphere !== false;
    fr.lights = opts.lights !== false && !!(desc && desc.inhabited) && P.cfg.city > 0;
    fr.bump = Rr >= 16; fr.spec = Rr >= 8; fr.shade = Rr >= 30 && opts.cloudShadows !== false;
    fr.city = cc;
    var fk = (fr.clouds ? 1 : 0) | (fr.atm ? 2 : 0) | (fr.lights ? 4 : 0) | (fr.bump ? 8 : 0) | (fr.spec ? 16 : 0) | (fr.shade ? 32 : 0);
    if (fk !== inst.flagKey || cc !== inst.cityRef) { inst.flagKey = fk; inst.cityRef = cc; inst.dirty = true; }
  }
  function refresh(inst, tex, lvl) {
    renderBody(inst, tex, lvl, inst.fr);
    inst.ctx.putImageData(inst.img, 0, 0);
    inst.dirty = false;
  }
  function wrapDiff(a, b) { var d = abs(a - b); return d > 0.5 ? 1 - d : d; }

  function draw(ctx, desc, cx, cy, radius, t, opts) {
    opts = opts || {};
    var P = getPlanet(desc);
    if (P.look === 'asteroids') { drawBeltDisc(ctx, P, cx, cy, radius, t || 0, opts); return; }
    var dpr = opts.dpr > 0 ? opts.dpr : (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    var rdev = radius * dpr;
    if (!(rdev > 0.5)) return;
    var Rr = Math.round(rdev); if (Rr > RMAX) Rr = RMAX; if (Rr < 3) Rr = 3;
    var sc = rdev / Rr, inst = getInst(P, Rr);
    relight(inst, opts.lightAngle !== undefined ? opts.lightAngle : -2.3, opts.lightElev !== undefined ? opts.lightElev : 0.55);
    setFlags(inst, desc, opts, Rr);
    // texture: best available now, better tier generated in the background
    var want = tierFor(Rr, true), tex = P.tex[want];
    if (!tex) tex = texNow(P, want, Rr);   // refine step by step: placeholder -> 128 -> 256 -> 512 -> 1024, every tier generated in the background
    var lvl = levelFor(tex, Rr);
    var spin = opts.spin !== undefined ? opts.spin : 0.015, tt = t || 0;
    var sp = P.phase0 + spin * tt; sp -= floor(sp);
    var csp = P.phase0c + spin * 1.15 * tt + 0.0011 * tt; csp -= floor(csp);
    var moved = max(wrapDiff(sp, inst.sp), wrapDiff(csp, inst.csp)) * TAU * Rr;
    if (inst.dirty || tex.W !== inst.texW || lvl !== inst.lvl || moved > 0.4) {
      inst.fr.spin = sp; inst.fr.cspin = csp; inst.sp = sp; inst.csp = csp; inst.texW = tex.W; inst.lvl = lvl;
      refresh(inst, tex, lvl);
    }
    var dw = inst.lay.bw * sc / dpr, dh = inst.lay.bh * sc / dpr, dx = cx - dw / 2, dy = cy - dh / 2, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (inst.ringLayers) ctx.drawImage(inst.ringLayers.back, dx, dy, dw, dh);
    ctx.drawImage(inst.cv, dx, dy, dw, dh);
    if (inst.ringLayers) ctx.drawImage(inst.ringLayers.front, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = sm;
  }

  // Sprites are cached canvases. A sprite rendered before its wanted texture tier exists is PENDING: it is drawn from the best tier
  // available (or the placeholder), the missing tiers are queued, and the SAME canvas is repainted in place as each tier lands
  // (cv.pending = true until final). opts.onReady(cv) fires once it is final; MOO.Bus 'planets:sprite' (desc, cv) fires on every
  // repaint for callers that copied the pixels elsewhere. opts.sync = true restores the old blocking behaviour (baking static scenes).
  var SPR = {}, SPRKEYS = [], PENDING = {};
  function sprite(desc, diameterPx, opts) {
    opts = opts || {};
    var P = getPlanet(desc), dpr = opts.dpr > 0 ? opts.dpr : 1;
    var dia = isFinite(diameterPx) && diameterPx > 0 ? diameterPx : 64, Dd = Math.max(6, Math.round(Math.max(6, dia) * dpr));
    var la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, le = opts.lightElev !== undefined ? opts.lightElev : 0.55;
    var key = [P.key, Dd, opts.clouds === false ? 0 : 1, opts.atmosphere === false ? 0 : 1, opts.lights === false ? 0 : 1, desc && desc.inhabited ? 1 : 0,
      desc && desc.color || '', la.toFixed(2), le.toFixed(2), opts.phase === undefined ? '' : opts.phase].join('|');
    var hit = SPR[key];
    if (hit) {
      var pe = PENDING[key];
      if (pe) {
        if (opts.sync) { requestTex(P, pe.want, true); upgradeSprite(key, pe); }
        else { if (opts.onReady) pe.cbs.push(opts.onReady); var b = bestTex(P); if (b && b.W > pe.W) upgradeSprite(key, pe); }
      }
      return hit;
    }
    var cv, pend = null;
    if (P.look === 'asteroids') cv = rockSprite(P, Dd, la, opts);
    else {
      var st = { P: P, Dd: Dd, desc: desc || {}, opts: opts, la: la, le: le, cbs: [], W: 0, want: 0 };
      cv = renderSprite(P, Dd, desc || {}, opts, la, le, st);
      if (st.W < st.want) { pend = st; st.cv = cv; cv.pending = true; if (opts.onReady) st.cbs.push(opts.onReady); }
    }
    SPR[key] = cv; SPRKEYS.push(key);
    if (pend) PENDING[key] = pend;
    while (SPRKEYS.length > 700) { var old = SPRKEYS.shift(); if (PENDING[old]) { SPRKEYS.push(old); if (SPRKEYS[0] === old) break; continue; } delete SPR[old]; }   // pending sprites stay until their tier lands
    return cv;
  }
  // st (optional) receives {W: tier drawn, want: tier wanted}; without st the wanted tier is generated synchronously (old behaviour)
  function renderSprite(P, Dd, desc, opts, la, le, st) {
    var ext = haloExtent(P), fit = 1 + ext + 0.02;
    if (P.ring) { var e = ringExtents(P); fit = max(fit, e.hx + 0.03, e.hy + 0.03); }
    var Rr = Math.max(3, Math.floor((Dd / 2 - 1.5) / fit));
    var inst = st && st.inst;                 // a pending sprite keeps its instance (geometry + lighting tables) so a repaint is only the pixel loop
    if (!inst) {
      inst = makeInst(P, Rr, { bw: Dd, bh: Dd, cx: Dd / 2, cy: Dd / 2 });
      relight(inst, la, le);
      setFlags(inst, desc, opts, Rr);
      if (st) st.inst = inst;
    }
    var want = tierFor(Rr, false), best = bestTex(P), tex;
    if (best && best.W >= want) tex = best;
    else if (!st || opts.sync) tex = requestTex(P, want, true);
    else tex = texNow(P, want, Rr);
    if (st) { st.W = tex.W; st.want = want; }
    var lvl = levelFor(tex, Rr);
    var ph = opts.phase !== undefined ? opts.phase : 0;
    inst.fr.spin = (P.phase0 + ph) % 1; inst.fr.cspin = (P.phase0c + ph * 1.15) % 1;
    refresh(inst, tex, lvl);
    if (!inst.ringLayers) return inst.cv;
    var cv = createCanvas(Dd, Dd), c = cv.getContext('2d');
    c.drawImage(inst.ringLayers.back, 0, 0); c.drawImage(inst.cv, 0, 0); c.drawImage(inst.ringLayers.front, 0, 0);
    return cv;
  }
  // repaint a pending sprite in place from the best tier now available; final when the wanted tier is reached
  function upgradeSprite(key, pe) {
    var fresh = renderSprite(pe.P, pe.Dd, pe.desc, pe.opts, pe.la, pe.le, pe), cv = pe.cv;
    if (fresh !== cv) { var c = cv.getContext('2d'); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'copy'; c.drawImage(fresh, 0, 0); c.restore(); }
    var final_ = pe.W >= pe.want;
    if (final_) { delete PENDING[key]; cv.pending = false; pe.inst = null; }
    try { if (M.Bus && M.Bus.emit) M.Bus.emit('planets:sprite', pe.desc, cv, final_); } catch (e) { /* listeners are optional */ }
    if (final_) for (var i = 0; i < pe.cbs.length; i++) { try { pe.cbs[i](cv); } catch (e2) { console.warn('[Planets] onReady', e2); } }
  }
  // a big sprite's repaint is a full pixel loop (~100 ms at 500 px), so those only repaint for the first real tier and the final one
  function texLanded(P) {
    var best = bestTex(P); if (!best) return;
    for (var key in PENDING) {
      var pe = PENDING[key];
      if (pe.P !== P || best.W <= pe.W) continue;
      if (pe.Dd > 256 && best.W < pe.want && pe.W >= TIERS[0]) continue;
      upgradeSprite(key, pe);
    }
  }

  /* ================================================================ asteroids */
  // Tumbling rocks are pre-lit sprite sheets (NSH shapes x NF rotation frames) for one light angle; frames are
  // cross-faded at draw time so slow tumbles stay smooth.
  var ROCK = { S: 64, NSH: 5, NF: 14 }, SHEETS = {}, ROCKQ = [], rockTimer = 0;

  function matMul(a, b) {
    var r = new Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  function rotX(a) { var c = cos(a), s = sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function rotY(a) { var c = cos(a), s = sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rotZ(a) { var c = cos(a), s = sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; }

  function rockSheet(la) {
    var key = la.toFixed(2), sh = SHEETS[key];
    if (!sh) {
      sh = SHEETS[key] = { la: la, shapes: [], lv: lightVec(la, 0.5), ready: 0 };
      for (var s = 0; s < ROCK.NSH; s++) sh.shapes.push({ frames: new Array(ROCK.NF), n: 0, model: null });
      buildRockFrame(sh, 0, 0);           // first frame synchronously so something can be drawn at once
      for (s = 0; s < ROCK.NSH; s++) for (var f = 0; f < ROCK.NF; f++) if (!(s === 0 && f === 0)) ROCKQ.push({ sh: sh, s: s, f: f });
      scheduleRocks();
    }
    return sh;
  }
  function scheduleRocks() { if (!rockTimer && ROCKQ.length) rockTimer = setTimeout(pumpRocks, 2); }
  function pumpRocks() {
    rockTimer = 0;
    var t0 = now();
    while (ROCKQ.length && now() - t0 < 6) { var j = ROCKQ.shift(); buildRockFrame(j.sh, j.s, j.f); }
    scheduleRocks();
  }
  function rockModel(si) {
    var rnd = rng32(0xA57E + si * 977), nz = makeNoise(0xB00B + si * 131), cr = [], i;
    for (i = 0; i < 8; i++) {
      var z = rnd() * 2 - 1, c = sqrt(1 - z * z), lon = rnd() * TAU, big = i < 3;
      cr.push({ x: c * sin(lon), y: z, z: c * cos(lon), r: big ? 0.34 + rnd() * 0.22 : 0.16 + rnd() * 0.16, d: big ? 0.20 + rnd() * 0.14 : 0.10 + rnd() * 0.10 });
    }
    return {
      nz: nz, cr: cr, ax: 0.72 + rnd() * 0.5, ay: 0.66 + rnd() * 0.42, az: 0.72 + rnd() * 0.46, tilt: (rnd() - 0.5) * 1.6, tilt2: (rnd() - 0.5) * 1.2,
      off: rnd() * 30, tint: [[1.0, 0.96, 0.9], [0.92, 0.95, 1.0], [1.06, 0.94, 0.84], [0.98, 0.95, 0.92], [1.08, 1.0, 0.92]][si % 5], amp: 0.18 + rnd() * 0.12
    };
  }
  function rockHeight(m, x, y, z) {
    var h = m.nz.fbm(x * 1.7 + m.off, y * 1.7, z * 1.7, 3, 0.42) * 0.34, cr = m.cr;
    for (var i = 0; i < 8; i++) {
      var c = cr[i], dx = x - c.x, dy = y - c.y, dz = z - c.z, d = sqrt(dx * dx + dy * dy + dz * dz);
      if (d < c.r * 1.7) {
        var q = d / c.r;
        if (q < 1) h -= c.d * (1 - q * q) * (q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3 * 0.4); else { var t = (q - 1) / 0.28; h += c.d * 0.5 * exp(-t * t); }
      }
    }
    return h;
  }
  function buildRockFrame(sh, si, f) {
    var shp = sh.shapes[si], S = ROCK.S, NF = ROCK.NF;
    if (!shp.model) shp.model = rockModel(si);
    if (shp.frames[f]) return;
    var m = shp.model, nz = m.nz, psi = f / NF * TAU;
    var R = matMul(rotZ(m.tilt), matMul(rotX(m.tilt2), rotY(psi)));          // local -> view
    var Mt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];           // view -> local
    var cv = createCanvas(S, S), c = cv.getContext('2d'), img = c.createImageData(S, S), o32 = new Uint32Array(img.data.buffer);
    var half = S / 2, sc = half / 1.12, L = sh.lv, lx = L[0], ly = L[1], lz = L[2], eps = 0.09;
    // light in local space is not needed: shade in view space with the perturbed normal rotated back
    for (var py = 0; py < S; py++) {
      for (var px = 0; px < S; px++) {
        var u = (px + 0.5 - half) / sc, v = -(py + 0.5 - half) / sc, r = sqrt(u * u + v * v);
        var dx = r > 1e-6 ? u / r : 1, dy = r > 1e-6 ? v / r : 0;
        var wx = Mt[0] * dx + Mt[1] * dy, wy = Mt[3] * dx + Mt[4] * dy, wz = Mt[6] * dx + Mt[7] * dy;
        var Lw = 1 / sqrt((wx / m.ax) * (wx / m.ax) + (wy / m.ay) * (wy / m.ay) + (wz / m.az) * (wz / m.az));
        var rs = 0.80 * Lw * (1 + m.amp * nz.fbm(wx * 1.5 + m.off, wy * 1.5, wz * 1.5, 3));
        var cov = (rs - r) * sc + 0.5;
        if (cov <= 0) continue;
        if (cov > 1) cov = 1;
        var rho = r / rs; if (rho > 0.999) rho = 0.999;
        var nzv = sqrt(1 - rho * rho), nvx = u / rs, nvy = v / rs;
        var lx0 = Mt[0] * nvx + Mt[1] * nvy + Mt[2] * nzv, ly0 = Mt[3] * nvx + Mt[4] * nvy + Mt[5] * nzv, lz0 = Mt[6] * nvx + Mt[7] * nvy + Mt[8] * nzv;
        // tangent basis
        var t1x, t1y, t1z;
        if (abs(ly0) < 0.9) { t1x = -lz0; t1y = 0; t1z = lx0; } else { t1x = 0; t1y = lz0; t1z = -ly0; }
        var tl = sqrt(t1x * t1x + t1y * t1y + t1z * t1z) || 1; t1x /= tl; t1y /= tl; t1z /= tl;
        var t2x = ly0 * t1z - lz0 * t1y, t2y = lz0 * t1x - lx0 * t1z, t2z = lx0 * t1y - ly0 * t1x;
        var h0 = rockHeight(m, lx0, ly0, lz0);
        var h1 = rockHeight(m, lx0 + eps * t1x, ly0 + eps * t1y, lz0 + eps * t1z), h2 = rockHeight(m, lx0 + eps * t2x, ly0 + eps * t2y, lz0 + eps * t2z);
        var g1 = (h1 - h0) / eps, g2 = (h2 - h0) / eps, K = 0.85;
        var pnx = lx0 - K * (g1 * t1x + g2 * t2x), pny = ly0 - K * (g1 * t1y + g2 * t2y), pnz = lz0 - K * (g1 * t1z + g2 * t2z);
        var pl = sqrt(pnx * pnx + pny * pny + pnz * pnz); pnx /= pl; pny /= pl; pnz /= pl;
        // back to view space
        var vx = R[0] * pnx + R[1] * pny + R[2] * pnz, vy = R[3] * pnx + R[4] * pny + R[5] * pnz, vz = R[6] * pnx + R[7] * pny + R[8] * pnz;
        var ndl = vx * lx + vy * ly + vz * lz, dd = (ndl + 0.06) / 1.06; dd = dd < 0 ? 0 : dd;
        var shade = 0.07 + 1.0 * Math.pow(dd, 0.82);
        var alb = 0.74 + 0.40 * (nz.fbm(lx0 * 2.4 + m.off + 9, ly0 * 2.4, lz0 * 2.4, 2) * 0.5 + 0.5) + 1.1 * (h0 < -0.10 ? (h0 + 0.10) : 0);
        alb = alb < 0.30 ? 0.30 : alb;
        var br = 200 * alb * shade, bg = 184 * alb * shade, bb = 164 * alb * shade;
        br *= m.tint[0]; bg *= m.tint[1]; bb *= m.tint[2];
        var rim = Math.pow(1 - nzv, 3) * 0.20 * (dd > 0 ? 1 : 0.3); br += 70 * rim; bg += 84 * rim; bb += 120 * rim;
        var fill = 0.05 * (1 - dd); br += 24 * fill; bg += 30 * fill; bb += 46 * fill;
        br = br > 255 ? 255 : br; bg = bg > 255 ? 255 : bg; bb = bb > 255 ? 255 : bb;
        o32[py * S + px] = (((cov * 255 + 0.5) | 0) << 24) | ((bb | 0) << 16) | ((bg | 0) << 8) | (br | 0);
      }
    }
    c.putImageData(img, 0, 0);
    shp.frames[f] = cv; shp.n++;
  }
  // pick a drawable frame for rock shape s at tumble phase ph (0..1); returns [frameA, frameB, mix]
  var _fr = [null, null, 0], FORCE_ROCKS = false;
  function rockFrames(sh, s, ph) {
    var shp = sh.shapes[s], NF = ROCK.NF, fp = (ph - floor(ph)) * NF, f0 = floor(fp), mx = fp - f0, f1 = (f0 + 1) % NF;
    if (FORCE_ROCKS) { buildRockFrame(sh, s, f0); buildRockFrame(sh, s, f1); }
    var a = shp.frames[f0], b = shp.frames[f1];
    if (!a) { shp = sh.shapes[0]; a = shp.frames[0]; b = null; mx = 0; }
    _fr[0] = a; _fr[1] = b; _fr[2] = mx;
    return _fr;
  }
  function blitRock(ctx, sh, s, ph, x, y, size, alpha) {
    var fr = rockFrames(sh, s, ph), a = fr[0], b = fr[1], mx = fr[2];
    if (!a) return;
    var h = size / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(a, x - h, y - h, size, size);
    if (b && mx > 0.02) { ctx.globalAlpha = alpha * mx; ctx.drawImage(b, x - h, y - h, size, size); }
  }

  var BELTS = {};
  function beltFor(P, w, h, count) {
    var key = P.key + '|' + (w | 0) + 'x' + (h | 0) + '|' + count, b = BELTS[key];
    if (b) return b;
    var rnd = rng32(sub(P.seed, 4242)), rocks = [], i;
    var ang = (rnd() - 0.5) * 0.5 + 0.1;
    for (i = 0; i < count; i++) {
      var d = Math.pow(rnd(), 0.85);
      rocks.push({
        d: d, x: rnd(), y: rnd(), sh: floor(rnd() * ROCK.NSH), ph: rnd(), tr: (0.05 + rnd() * 0.16) * (rnd() < 0.5 ? -1 : 1),
        spd: 0.35 + d * 1.2, sz: 0.4 + Math.pow(d, 1.4) * 1.0 + rnd() * 0.15
      });
    }
    rocks.sort(function (a, b2) { return a.d - b2.d; });
    b = BELTS[key] = { rocks: rocks, ang: ang };
    var ks = Object.keys(BELTS); if (ks.length > 30) delete BELTS[ks[0]];
    return b;
  }
  function drawAsteroids(ctx, desc, cx, cy, w, h, t, opts) {
    opts = opts || {};
    var P = getPlanet({ look: 'asteroids', seed: desc && desc.seed !== undefined ? desc.seed : 1 });
    var la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, sh = rockSheet(la);
    var count = opts.count || 40, belt = beltFor(P, w, h, count), u = Math.min(w, h) / 230;
    u = u < 0.55 ? 0.55 : u > 2.4 ? 2.4 : u;
    var ca = cos(belt.ang), sa = sin(belt.ang), tt = t || 0, x0 = cx - w / 2, y0 = cy - h / 2, base = 16 * u;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    var prevA = ctx.globalAlpha;
    for (var i = 0; i < belt.rocks.length; i++) {
      var r = belt.rocks[i], size = base * r.sz * 1.7, m = size;
      var span = w + 2 * m, spanY = h + 2 * m;
      var px = r.x * span + ca * r.spd * 18 * u * tt, py = r.y * spanY + sa * r.spd * 18 * u * tt;
      px = ((px % span) + span) % span; py = ((py % spanY) + spanY) % spanY;
      blitRock(ctx, sh, r.sh, r.ph + r.tr * tt, x0 - m + px, y0 - m + py, size, 0.55 + 0.45 * r.d);
    }
    ctx.globalAlpha = prevA;
    ctx.restore();
  }
  // asteroid look as a round-ish orbiting cluster (used by draw() and sprite())
  function drawBeltDisc(ctx, P, cx, cy, radius, t, opts) {
    var la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, sh = rockSheet(la), rnd = rng32(sub(P.seed, 777)), n = opts.count || 22, list = [], i;
    for (i = 0; i < n; i++) {
      var rr = 0.10 + 0.88 * Math.sqrt(rnd()), ph = rnd() * TAU, om = (0.016 + 0.02 * Math.pow(rr + 0.2, -1.5) * 0.5) * (rnd() < 0.9 ? 1 : -1), big = rnd();
      list.push({ rr: rr, ph: ph, om: om, sh: floor(rnd() * ROCK.NSH), tp: rnd(), tr: (0.05 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1), sz: (opts.chunky ? 0.34 : 0.20) + (opts.chunky ? 0.42 : 0.50) * big * big * (1 - 0.35 * rr) });
    }
    var tilt = 0.55 + 0.2 * rnd(), rot = (rnd() - 0.5) * 0.7, cr = cos(rot), sr = sin(rot);
    for (i = 0; i < n; i++) {
      var q = list[i], a = q.ph + q.om * t * TAU * 0.4, ex = cos(a) * q.rr * radius * 0.92, ey = sin(a) * q.rr * radius * 0.92 * tilt;
      q.x = cx + ex * cr - ey * sr; q.y = cy + ex * sr + ey * cr; q.dz = sin(a);
    }
    list.sort(function (a, b) { return a.dz - b.dz; });
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.0);
    g.addColorStop(0, 'rgba(150,130,110,0.09)'); g.addColorStop(1, 'rgba(150,130,110,0)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(cx - radius * 1.1, cy - radius * 1.1, radius * 2.2, radius * 2.2); ctx.restore();
    var prev = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    for (i = 0; i < n; i++) {
      var r2 = list[i], size = radius * r2.sz * 0.95 * (1 + 0.22 * r2.dz);
      blitRock(ctx, sh, r2.sh, r2.tp + r2.tr * t, r2.x, r2.y, size, 0.82 + 0.18 * (r2.dz * 0.5 + 0.5));
    }
    ctx.globalAlpha = prev; ctx.imageSmoothingEnabled = sm;
  }
  function rockSprite(P, Dd, la) {
    var cv = createCanvas(Dd, Dd), c = cv.getContext('2d');
    FORCE_ROCKS = true;
    try { drawBeltDisc(c, P, Dd / 2, Dd / 2, Dd * 0.44, 0, { lightAngle: la, count: Dd < 40 ? 5 : Dd < 80 ? 9 : 14, chunky: Dd < 80 }); } finally { FORCE_ROCKS = false; }
    return cv;
  }

  /* ================================================================ preload + exports */
  /*
   * Warm caches in small timed slices so the UI never freezes.  preload(descs, done, o):
   *   o = function (doneCount, total)                         -- progress callback, or
   *   o = {onProgress, sizes:[96,..] (also bake sprites at these diameters), spriteOpts:{dpr,..}, tier:256, budget:8 (ms per slice)}
   */
  function preload(descs, cb, o) {
    var opts = typeof o === 'function' ? { onProgress: o } : (o || {});
    var list = (descs || []).slice(), total = list.length, done = 0, tier = opts.tier || 256, budget = opts.budget || 8, sizes = opts.sizes || [];
    function next() {
      var t0 = now();
      while (list.length && now() - t0 < budget) {
        var d = list[0], P = getPlanet(d);
        if (P.look !== 'asteroids') {
          var have = bestTex(P);
          if (!have || have.W < tier) {
            var job = P.jobs[tier];
            if (!job || job.lazy) { var ph = job; job = P.jobs[tier] = makeJob(P, tier); if (ph) { var pi = QUEUE.indexOf(ph); if (pi >= 0) QUEUE.splice(pi, 1); } }
            if (!stepJob(job, Math.max(1, budget - (now() - t0)))) break;
            var qi = QUEUE.indexOf(job); if (qi >= 0) QUEUE.splice(qi, 1);
            addTex(P, tier, job.tex); delete P.jobs[tier]; texLanded(P);
          }
        }
        for (var i = 0; i < sizes.length; i++) sprite(d, sizes[i], opts.spriteOpts);
        list.shift(); done++;
        if (opts.onProgress) opts.onProgress(done, total);
      }
      if (list.length) setTimeout(next, 0); else if (cb) cb();
    }
    setTimeout(next, 0);
  }

  // drop every cache (textures, sprites, instances, rock sheets); descriptors keep working and regenerate on demand
  function clear() {
    var k;
    for (k in PCACHE) { PCACHE[k].tex = {}; PCACHE[k].jobs = {}; PCACHE[k].ph = null; }
    QUEUE.length = 0; texBytes = 0;
    INST = {}; INSTKEYS = []; instBytes = 0; SPR = {}; SPRKEYS = []; PENDING = {}; SHEETS = {}; ROCKQ.length = 0; BELTS = {};
  }

  Gfx.Planets = {
    LOOKS: LOOKS, BANDS: BANDS, sprite: sprite, draw: draw, drawAsteroids: drawAsteroids, preload: preload, clear: clear,
    _dbg: { getPlanet: getPlanet, makeJob: makeJob, stepJob: stepJob, requestTex: requestTex, cache: PCACHE, rockSheet: rockSheet, buildRockFrame: buildRockFrame, ROCK: ROCK, buildLight: buildLight, buildHalo: buildHalo, lightVec: lightVec, layoutFor: layoutFor, renderRingLayers: renderRingLayers, ringInfoFor: ringInfoFor, makeInst: makeInst }
  };
})(window.MOO);
