/* =========================================================================
   MOO.Gfx.Space — deep-space visuals: nebula backdrops, starfields, star sprites, animated star surfaces.
   Self-contained (own noise/RNG); only window.MOO is used for exports.  All art is procedural and original.

   API  (MOO.Gfx.Space)
     STAR_KINDS                          ['yellow','orange','red','blue','white','green','purple'(neutron),'blackhole']
     starColor(kind) -> {core, glow, rgb:[r,g,b]}
     makeBackdrop(w, h, seed, {palette:[hex..], intensity=.55, stars=1, vignette=true}) -> canvas   (1920x1080 in ~150 ms)
     makeStarfield(w, h, seed, count) -> transparent canvas of stars that tiles when drawn with wrap-around offsets
     starSprite(kind, sizePx, {spikes, glow=1, dpr=1}) -> cached canvas; draw with globalCompositeOperation 'lighter'
     drawStarSurface(ctx, kind, cx, cy, r, t, {dpr, spin, corona=true, prominences=true, sync})   animated close-up (black hole: r = event horizon);
                                         the surface texture builds in background slices (a graded disc shows meanwhile) unless sync:true
   ========================================================================= */
(function (M) {
  'use strict';
  var Gfx = M.Gfx = M.Gfx || {};

  var PI = Math.PI, TAU = PI * 2;
  var sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, abs = Math.abs, floor = Math.floor, ceil = Math.ceil,
    pow = Math.pow, exp = Math.exp, atan2 = Math.atan2, asin = Math.asin, min = Math.min, max = Math.max;
  var now = (typeof performance !== 'undefined' && performance.now) ? function () { return performance.now(); } : Date.now;

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
  function parseHex(h) {
    if (typeof h !== 'string') return h;
    var s = h.charAt(0) === '#' ? h.slice(1) : h;
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var v = /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0x808080;
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function createCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------------------------------------------------------------- noise (simplex 2D / 3D) */
  function permTables(seed) {
    var rnd = rng32(seed), p = new Uint8Array(256), i, j, t;
    for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = (rnd() * (i + 1)) | 0; t = p[i]; p[i] = p[j]; p[j] = t; }
    var perm = new Uint8Array(512);
    for (i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
  }
  function makeNoise2(seed) {
    var perm = permTables(seed), g = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1]);
    var F2 = 0.5 * (sqrt(3) - 1), G2 = (3 - sqrt(3)) / 6;
    function n(x, y) {
      var s = (x + y) * F2, i = floor(x + s), j = floor(y + s), t = (i + j) * G2;
      var x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      var ii = i & 255, jj = j & 255, r = 0, gi, t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 > 0) { gi = (perm[ii + perm[jj]] & 7) * 2; t0 *= t0; r += t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0); }
      var t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 > 0) { gi = (perm[ii + i1 + perm[jj + j1]] & 7) * 2; t1 *= t1; r += t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1); }
      var t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 > 0) { gi = (perm[ii + 1 + perm[jj + 1]] & 7) * 2; t2 *= t2; r += t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2); }
      return 70 * r;
    }
    function fbm(x, y, oct, gain) {
      var a = 1, s = 0, nr = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) { s += a * n(x, y); nr += a; a *= gn; var tx = x; x = (x * 0.8 - y * 0.6) * 2.0 + 13.1; y = (tx * 0.6 + y * 0.8) * 2.0 + 7.3; }
      return s / nr;
    }
    function ridged(x, y, oct, gain) {
      var a = 1, s = 0, nr = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) { var v = 1 - abs(n(x, y)); v *= v; s += a * v; nr += a; a *= gn; var tx = x; x = (x * 0.8 - y * 0.6) * 2.03 + 5.7; y = (tx * 0.6 + y * 0.8) * 2.03 + 9.1; }
      return s / nr;
    }
    return { n: n, fbm: fbm, ridged: ridged };
  }
  function makeNoise3(seed) {
    var perm = permTables(seed), pm = new Uint8Array(512), i;
    for (i = 0; i < 512; i++) pm[i] = (perm[i] % 12) * 3;
    var g = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
    var F3 = 1 / 3, G3 = 1 / 6;
    function n(x, y, z) {
      var s = (x + y + z) * F3, i = floor(x + s), j = floor(y + s), k = floor(z + s), tt = (i + j + k) * G3;
      var x0 = x - (i - tt), y0 = y - (j - tt), z0 = z - (k - tt), i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3, ii = i & 255, jj = j & 255, kk = k & 255;
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
      var a = 1, s = 0, nr = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) { s += a * n(x, y, z); nr += a; a *= gn; var tx = x; x = y * 2.02 + 17.3; y = z * 2.02 + 9.1; z = tx * 2.02 + 4.7; }
      return s / nr;
    }
    function ridged(x, y, z, oct, gain) {
      var a = 1, s = 0, nr = 0, gn = gain || 0.5;
      for (var o = 0; o < oct; o++) { var v = 1 - abs(n(x, y, z)); v *= v; s += a * v; nr += a; a *= gn; var tx = x; x = y * 2.03 + 11.7; y = z * 2.03 + 3.9; z = tx * 2.03 + 8.3; }
      return s / nr;
    }
    return { n: n, fbm: fbm, ridged: ridged };
  }

  /* ---------------------------------------------------------------- star kinds */
  var STAR_KINDS = ['yellow', 'orange', 'red', 'blue', 'white', 'green', 'purple', 'blackhole'];
  var STAR = {
    yellow: { core: '#fffbe0', glow: '#ffd25a', rgb: [255, 224, 120], temp: 0.50 },
    orange: { core: '#ffeacc', glow: '#ff9a3a', rgb: [255, 156, 64], temp: 0.30 },
    red: { core: '#ffd2bc', glow: '#ff4a2e', rgb: [255, 84, 52], temp: 0.12 },
    blue: { core: '#eef6ff', glow: '#5a9cff', rgb: [104, 164, 255], temp: 0.95 },
    white: { core: '#ffffff', glow: '#d6e2ff', rgb: [232, 238, 255], temp: 0.75 },
    green: { core: '#f4fff2', glow: '#58f08c', rgb: [160, 255, 176], temp: 0.62 },
    purple: { core: '#f6eaff', glow: '#9a50ff', rgb: [196, 120, 255], temp: 1.0 },
    blackhole: { core: '#fff2d8', glow: '#ff9a40', rgb: [255, 170, 80], temp: 0.4 }
  };
  function starColor(kind) {
    var s = STAR[kind] || STAR.yellow;
    return { core: s.core, glow: s.glow, rgb: s.rgb.slice() };
  }
  function kindOf(kind) { return STAR[kind] ? kind : 'yellow'; }

  /* ================================================================ backdrop + starfields */
  var DEF_PAL = ['#3c40b4', '#7a3cc4', '#1f90b4', '#c4408c'];
  var TINTS = [[176, 200, 255], [236, 242, 255], [255, 248, 228], [255, 226, 186], [255, 190, 160]];
  function tintIndex(u) { return u < 0.22 ? 0 : u < 0.50 ? 1 : u < 0.74 ? 2 : u < 0.90 ? 3 : 4; }

  // soft round star sprite (gaussian halo + hot core), optionally with diffraction spikes; cached per tint
  var _dots = {};
  function dotSprite(ti, spikes) {
    var key = ti + (spikes ? 's' : 'd'), c = _dots[key];
    if (c) return c;
    var S = spikes ? 128 : 48, cv = createCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = new Uint32Array(img.data.buffer);
    var t = TINTS[ti], half = S / 2;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, r = sqrt(dx * dx + dy * dy);
        var core = exp(-(r * r) / 0.0035) * 1.4, halo = exp(-(r * r) / 0.04) * 0.55 + exp(-(r * r) / 0.2) * 0.12;
        var I = core + halo;
        if (spikes) {
          var ax = abs(dx), ay = abs(dy);
          I += (exp(-(ay * ay) / 0.00018) * pow(max(0, 1 - ax), 2.4) + exp(-(ax * ax) / 0.00018) * pow(max(0, 1 - ay), 2.4)) * 0.85;
          var u = (dx + dy) * 0.7071, v = (dx - dy) * 0.7071;
          I += (exp(-(v * v) / 0.0004) * pow(max(0, 1 - abs(u) * 1.6), 2.6) + exp(-(u * u) / 0.0004) * pow(max(0, 1 - abs(v) * 1.6), 2.6)) * 0.22;
        }
        I *= max(0, 1 - sstep(0.7, 1, r));
        var a = I > 1 ? 1 : I;
        var w = core > 0.5 ? min(1, (core - 0.3) * 0.7) : 0;       // whiten the hot core
        var cr = mixf(t[0], 255, w), cg = mixf(t[1], 255, w), cb = mixf(t[2], 255, w);
        d[y * S + x] = (((a * 255 + 0.5) | 0) << 24) | ((cb | 0) << 16) | ((cg | 0) << 8) | (cr | 0);
      }
    }
    ctx.putImageData(img, 0, 0);
    return (_dots[key] = cv);
  }

  /* draws a star population onto ctx (additive); mod(x,y) -> 0..1 brightness/density modulation (dust, nebula band) */
  function paintStars(ctx, w, h, rnd, n1, n2, n3, mod, wrap) {
    var prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha, i, k;
    ctx.globalCompositeOperation = 'lighter';
    // layer 1: tiny single-pixel stars, batched per tint
    var groups = [[], [], [], [], []];
    for (i = 0; i < n1; i++) {
      var x = rnd() * w, y = rnd() * h, m = mod ? mod(x, y) : 1;
      if (rnd() > 0.30 + 0.70 * m) continue;
      var b = pow(rnd(), 2.3);
      groups[tintIndex(rnd())].push(x, y, (0.08 + 0.52 * b) * (0.35 + 0.65 * m));
    }
    for (k = 0; k < 5; k++) {
      var gr = groups[k], t = TINTS[k];
      ctx.fillStyle = 'rgb(' + t[0] + ',' + t[1] + ',' + t[2] + ')';
      for (i = 0; i < gr.length; i += 3) {
        ctx.globalAlpha = gr[i + 2];
        if (gr[i + 2] > 0.38) ctx.fillRect(gr[i] - 0.3, gr[i + 1] - 0.3, 1.6, 1.6); else ctx.fillRect(gr[i], gr[i + 1], 1, 1);
      }
    }
    // layer 2: small soft stars
    for (i = 0; i < n2; i++) {
      var x2 = rnd() * w, y2 = rnd() * h, m2 = mod ? mod(x2, y2) : 1;
      if (rnd() > 0.35 + 0.65 * m2) continue;
      var s2 = 3 + rnd() * 3.5, a2 = (0.30 + 0.60 * pow(rnd(), 1.6)) * (0.4 + 0.6 * m2), sp = dotSprite(tintIndex(rnd()), false);
      ctx.globalAlpha = a2; ctx.drawImage(sp, x2 - s2 / 2, y2 - s2 / 2, s2, s2);
    }
    // layer 3: bright stars with halo, a few with spikes
    for (i = 0; i < n3; i++) {
      var x3 = rnd() * w, y3 = rnd() * h, m3 = mod ? mod(x3, y3) : 1;
      if (rnd() > 0.5 + 0.5 * m3) continue;
      var spk = rnd() < 0.22, s3 = (spk ? 26 + rnd() * 34 : 9 + rnd() * 11), a3 = (0.65 + 0.35 * rnd()) * (0.5 + 0.5 * m3), ti = tintIndex(rnd()), sp3 = dotSprite(ti, spk);
      ctx.globalAlpha = a3;
      ctx.drawImage(sp3, x3 - s3 / 2, y3 - s3 / 2, s3, s3);
      if (wrap) {
        var ox = x3 < s3 ? w : x3 > w - s3 ? -w : 0, oy = y3 < s3 ? h : y3 > h - s3 ? -h : 0;
        if (ox) ctx.drawImage(sp3, x3 + ox - s3 / 2, y3 - s3 / 2, s3, s3);
        if (oy) ctx.drawImage(sp3, x3 - s3 / 2, y3 + oy - s3 / 2, s3, s3);
        if (ox && oy) ctx.drawImage(sp3, x3 + ox - s3 / 2, y3 + oy - s3 / 2, s3, s3);
      }
    }
    ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevOp;
  }

  var _dither = null;
  function ditherTile() {
    if (_dither) return _dither;
    var rnd = rng32(0xD17E5), t = new Float32Array(65536);
    for (var i = 0; i < 65536; i++) t[i] = rnd() - rnd();       // triangular noise in (-1, 1)
    return (_dither = t);
  }

  /*
   * Nebula backdrop.  Low-res (1/4) fields -> smooth float upsample + triangular dither (no banding) -> stars on top.
   * opts: {palette:[hex..], intensity:0..1 (.55), stars: density (1), vignette: true}
   */
  function makeBackdrop(w, h, seed, opts) {
    opts = opts || {};
    w = max(16, w | 0); h = max(16, h | 0);
    var sd = seedOf(seed), rnd = rng32(sub(sd, 1));
    var intensity = opts.intensity !== undefined ? clamp(opts.intensity, 0, 1.5) : 0.55;
    var starDens = opts.stars !== undefined ? max(0, opts.stars) : 1, vig = opts.vignette !== false;
    var pal = (opts.palette && opts.palette.length ? opts.palette : DEF_PAL).map(function (c) {
      var v = parseHex(c), m = Math.max(v[0], v[1], v[2], 1); return [v[0] / m, v[1] / m, v[2] / m];   // hue only: brightness is controlled below
    });
    var np = pal.length;
    var lw = max(8, (w / 4) | 0), lh = max(8, (h / 4) | 0), N = lw * lh;
    var LR = new Float32Array(N), LG = new Float32Array(N), LB = new Float32Array(N), LANE = new Float32Array(N), BAND = new Float32Array(N);
    var nz = makeNoise2(sub(sd, 2)), nh = makeNoise2(sub(sd, 3)), nf = makeNoise2(sub(sd, 4)), nl = makeNoise2(sub(sd, 5));
    var asp = w / h, SC = 1.35;
    // composition: a soft diagonal band of denser gas plus an off-centre bright cloud
    var ang = rnd() * PI, bnx = cos(ang), bny = sin(ang), bcx = 0.35 + rnd() * 0.3, bcy = 0.35 + rnd() * 0.3, bw = 0.22 + rnd() * 0.14;
    var gcx = rnd(), gcy = rnd(), gr = 0.24 + rnd() * 0.18, o1 = rnd() * 50, o2 = rnd() * 50, o3 = rnd() * 50;
    var baseR = 0.016, baseG = 0.021, baseB = 0.050, GAIN = 0.82;
    for (var y = 0; y < lh; y++) {
      var v = y / (lh - 1);
      for (var x = 0; x < lw; x++) {
        var u = x / (lw - 1), i = y * lw + x, px = u * asp * SC + o1, py = v * SC + o2;
        var qx = nz.fbm(px, py, 3), qy = nz.fbm(px + 5.2, py + 1.3, 3);
        var wx = px + 1.5 * qx, wy = py + 1.5 * qy;
        var big = nz.fbm(wx * 0.55 + 9, wy * 0.55, 3), mid = nz.fbm(wx * 1.3, wy * 1.3, 5);
        var dist = (u - bcx) * bnx + (v - bcy) * bny, bd = exp(-(dist * dist) / (bw * bw));
        var gdx = (u - gcx) * asp, gdy = v - gcy, gb = exp(-(gdx * gdx + gdy * gdy) / (gr * gr));
        var mask = 0.30 + 0.60 * bd + 0.55 * gb; if (mask > 1) mask = 1;
        var A = sstep(-0.35, 0.55, big), B = sstep(-0.10, 0.65, mid * 0.6 + big * 0.4);
        var dens = clamp(0.35 * A + 0.80 * B * (0.4 + 0.6 * A), 0, 1);
        // hue field picks / blends palette colours
        var hf = nh.fbm(px * 0.40 + o3, py * 0.40, 3) * 0.5 + 0.5, hp = clamp((hf - 0.5) * 2.1 + 0.5, 0, 0.999) * (np - 1), hi = hp | 0, hfr = hp - hi, hc = pal[hi], hn = pal[min(hi + 1, np - 1)];
        var cr = mixf(hc[0], hn[0], hfr), cg = mixf(hc[1], hn[1], hfr), cb = mixf(hc[2], hn[2], hfr);
        // luminous veins (ionised wisps)
        var fil = pow(nf.ridged(wx * 1.8 + 3, wy * 1.8, 4), 4);
        var L = (dens + 0.55 * fil * dens) * mask;
        // dust lanes absorb light
        var lane = pow(nl.ridged(px * 0.9 + 2 * qx + 4, py * 0.9 + 2 * qy, 3), 4); lane = clamp(lane * 1.9 - 0.1, 0, 1) * (0.35 + 0.65 * mask);
        var Lm = L * (1 - 0.80 * lane) * intensity * GAIN;
        var core = sstep(0.18, 0.5, Lm);           // hot cores drift toward white-lilac
        LR[i] = baseR + Lm * mixf(cr, 0.92, core * 0.30); LG[i] = baseG + Lm * mixf(cg, 0.88, core * 0.30); LB[i] = baseB + Lm * mixf(cb, 1.0, core * 0.30);
        LANE[i] = lane; BAND[i] = mask;
      }
    }
    // ---- final pass: bilinear float upsample + dither + vignette -> ImageData
    var cv = createCanvas(w, h), ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), out = new Uint32Array(img.data.buffer);
    var xi0 = new Int32Array(w), xi1 = new Int32Array(w), xw = new Float32Array(w), vx = new Float32Array(w), dt = ditherTile();
    for (var xx = 0; xx < w; xx++) {
      var fx = xx * (lw - 1) / (w - 1), x0 = fx | 0;
      xi0[xx] = x0; xi1[xx] = min(x0 + 1, lw - 1); xw[xx] = fx - x0;
      vx[xx] = vig ? 1 - 0.40 * pow(abs(2 * xx / (w - 1) - 1), 2.6) : 1;
    }
    for (var yy = 0; yy < h; yy++) {
      var fy = yy * (lh - 1) / (h - 1), y0 = fy | 0, y1 = min(y0 + 1, lh - 1), wy = fy - y0, rA = y0 * lw, rB = y1 * lw;
      var vy = vig ? 1 - 0.40 * pow(abs(2 * yy / (h - 1) - 1), 2.6) : 1, dro = (yy & 255) << 8;
      for (var x3 = 0; x3 < w; x3++) {
        var a0 = rA + xi0[x3], a1 = rA + xi1[x3], b0 = rB + xi0[x3], b1 = rB + xi1[x3], wx = xw[x3];
        var w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy), w01 = (1 - wx) * wy, w11 = wx * wy, vg = vx[x3] * vy * 255;
        var dd = dt[dro | (x3 & 255)];
        var r = (LR[a0] * w00 + LR[a1] * w10 + LR[b0] * w01 + LR[b1] * w11) * vg + dd * 0.9;
        var g = (LG[a0] * w00 + LG[a1] * w10 + LG[b0] * w01 + LG[b1] * w11) * vg + dd * 0.9;
        var b = (LB[a0] * w00 + LB[a1] * w10 + LB[b0] * w01 + LB[b1] * w11) * vg + dd * 0.9;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        out[yy * w + x3] = 0xff000000 | (((b + 0.5) | 0) << 16) | (((g + 0.5) | 0) << 8) | ((r + 0.5) | 0);
      }
    }
    ctx.putImageData(img, 0, 0);
    // ---- distant galaxies (faint elliptical smudges)
    var ng = 2 + ((rnd() * 3) | 0), gi;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (gi = 0; gi < ng; gi++) {
      var gx = rnd() * w, gy = rnd() * h, gs = (10 + rnd() * 16) * (w / 1920 + 0.5), rot = rnd() * PI, ti = TINTS[tintIndex(rnd())];
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot); ctx.scale(1, 0.32 + rnd() * 0.25);
      var gg = ctx.createRadialGradient(0, 0, 0, 0, 0, gs);
      gg.addColorStop(0, 'rgba(' + ti[0] + ',' + ti[1] + ',' + ti[2] + ',0.32)'); gg.addColorStop(0.25, 'rgba(' + ti[0] + ',' + ti[1] + ',' + ti[2] + ',0.12)'); gg.addColorStop(1, 'rgba(' + ti[0] + ',' + ti[1] + ',' + ti[2] + ',0)');
      ctx.fillStyle = gg; ctx.fillRect(-gs, -gs, gs * 2, gs * 2); ctx.restore();
    }
    ctx.restore();
    // ---- stars: 3 baked layers, denser along the gas band, dimmed inside dust lanes
    var area = w * h, mod = function (x, y) {
      var li = (clamp(y / h, 0, 1) * (lh - 1) | 0) * lw + (clamp(x / w, 0, 1) * (lw - 1) | 0);
      return clamp((0.45 + 0.9 * BAND[li]) * (1 - 0.85 * LANE[li]), 0, 1);
    };
    var srnd = rng32(sub(sd, 9));
    paintStars(ctx, w, h, srnd, (area / 700 * starDens) | 0, (area / 5600 * starDens) | 0, (area / 36000 * starDens) | 0, mod, false);
    return cv;
  }

  /* transparent star layer (for parallax); tiles seamlessly when drawn with wrap-around offsets */
  function makeStarfield(w, h, seed, count) {
    w = max(8, w | 0); h = max(8, h | 0);
    var cv = createCanvas(w, h), ctx = cv.getContext('2d'), rnd = rng32(sub(seedOf(seed), 21));
    var n = count !== undefined ? max(0, count | 0) : ((w * h / 2400) | 0);
    paintStars(ctx, w, h, rnd, (n * 0.78) | 0, (n * 0.17) | 0, (n * 0.05) | 0, null, true);
    return cv;
  }

  /* ================================================================ star sprites (galaxy map) */
  var SPR = {}, SPRKEYS = [];

  function putRGBA(d, i, cr, cg, cb) {   // cr,cg,cb = additive linear colour (may exceed 1) -> straight RGBA pixel
    var a = max(cr, cg, cb);
    if (a < 0.002) { d[i] = 0; return; }
    var ia = 1 / max(a, 1), A = a > 1 ? 1 : a;
    var r = cr * ia, g = cg * ia, b = cb * ia;
    d[i] = (((A * 255 + 0.5) | 0) << 24) | (((b > 1 ? 255 : b * 255) + 0.5 | 0) << 16) | (((g > 1 ? 255 : g * 255) + 0.5 | 0) << 8) | ((r > 1 ? 255 : r * 255) + 0.5 | 0);
  }

  function buildStarSprite(kind, S, spikes, glowK) {
    var st = STAR[kind], cv = createCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = new Uint32Array(img.data.buffer);
    var core = parseHex(st.core).map(function (v) { return v / 255; }), glow = parseHex(st.glow).map(function (v) { return v / 255; }), rgb = st.rgb.map(function (v) { return v / 255; });
    var half = S / 2, ks = kind === 'blue' ? 0.85 : kind === 'red' ? 1.25 : kind === 'orange' ? 1.1 : kind === 'purple' ? 0.7 : 1.0;
    var hk = kind === 'red' ? 1.15 : kind === 'blue' ? 1.1 : 1.0;
    var jets = kind === 'purple';
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, r = sqrt(dx * dx + dy * dy);
        var c1 = exp(-pow(r / (0.085 * ks), 2)) * 1.9, c2 = exp(-pow(r / (0.18 * ks), 1.6)) * 1.0;
        var c3 = 0.60 * hk / (1 + pow(r / 0.22, 2.0)), c4 = 0.22 * hk * exp(-pow(r / 0.55, 1.6));
        var win = 1 - sstep(0.60, 1.0, r); win *= win;
        var halo = (c3 + c4) * win * glowK;
        var cr = core[0] * c1 + rgb[0] * c2 + glow[0] * halo, cg = core[1] * c1 + rgb[1] * c2 + glow[1] * halo, cb = core[2] * c1 + rgb[2] * c2 + glow[2] * halo;
        var sp = 0;
        if (spikes) {
          var ax = abs(dx), ay = abs(dy), u = (dx + dy) * 0.7071, v = (dx - dy) * 0.7071;
          sp = (exp(-(ay * ay) / 0.00012) * pow(max(0, 1 - ax), 2.2) + exp(-(ax * ax) / 0.00012) * pow(max(0, 1 - ay), 2.2)) * 0.9;
          sp += (exp(-(v * v) / 0.0003) * pow(max(0, 1 - abs(u) * 1.8), 2.4) + exp(-(u * u) / 0.0003) * pow(max(0, 1 - abs(v) * 1.8), 2.4)) * 0.28;
          sp *= win;
        }
        if (jets) sp += exp(-(dx * dx) / 0.0004) * pow(max(0, 1 - abs(dy)), 1.6) * 0.8 * win;
        if (sp > 0) { cr += sp * mixf(glow[0], 1, 0.5); cg += sp * mixf(glow[1], 1, 0.5); cb += sp * mixf(glow[2], 1, 0.5); }
        putRGBA(d, y * S + x, cr, cg, cb);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* black hole: event horizon, hot tilted accretion disc (near side crosses the hole), lensed arch + photon ring */
  var BH_RAMP = [[1, 0.96, 0.84], [1, 0.70, 0.36], [0.84, 0.30, 0.14]];
  function bhDiscColor(t) {   // t: 0 inner -> 1 outer
    var a = t < 0.5 ? BH_RAMP[0] : BH_RAMP[1], b = t < 0.5 ? BH_RAMP[1] : BH_RAMP[2], m = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return [mixf(a[0], b[0], m), mixf(a[1], b[1], m), mixf(a[2], b[2], m)];
  }
  var BH = { rh: 0.175, rin: 0.26, rout: 0.94, ring: 0.205, ringW: 0.0135, arch: 0.285, archW: 0.055 };
  function buildBlackHoleSprite(S, glowK) {
    var cv = createCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = new Uint32Array(img.data.buffer);
    var half = S / 2, rh = BH.rh, tilt = -0.20, ct = cos(tilt), st = sin(tilt), kf = 0.30, rin = BH.rin, rout = BH.rout;
    for (var y = 0; y < S; y++) {
      for (var x = 0; x < S; x++) {
        var X = (x + 0.5 - half) / half, Y = (y + 0.5 - half) / half, r = sqrt(X * X + Y * Y), edge = 1 - sstep(0.78, 1, r);
        var ux = X * ct + Y * st, uy = -X * st + Y * ct, rho = sqrt(ux * ux + (uy / kf) * (uy / kf)), phi = atan2(uy / kf, ux);
        var cr = 0, cg = 0, cb = 0;
        var gl = 0.20 * glowK * exp(-pow(r / 0.55, 1.5)) * edge;
        cr += gl * 1.0; cg += gl * 0.62; cb += gl * 0.34;
        var arch = exp(-pow((r - BH.arch) / BH.archW, 2)), top = 0.30 + 0.70 * (0.5 - 0.5 * (uy / max(r, 1e-4)));
        var ring = exp(-pow((r - BH.ring) / BH.ringW, 2)), dop = 0.8 + 0.4 * (ux / max(r, 1e-4));
        var ac = bhDiscColor(0.12), aI = (arch * top * 0.85 + ring * 1.3) * dop * edge;
        cr += ac[0] * aI; cg += ac[1] * aI; cb += ac[2] * aI;
        var front = 0, dcl = null;
        if (rho > rin * 0.94 && rho < rout) {
          var prof = pow(rin / max(rho, rin), 1.7) * sstep(rout, rout * 0.7, rho) * sstep(rin * 0.94, rin * 1.1, rho);
          var streak = 0.78 + 0.16 * sin(rho * 46 + phi * 2) + 0.12 * sin(phi * 5 + rho * 13);
          var dop2 = 1 + 0.48 * (ux / max(rho, 1e-3));
          dcl = bhDiscColor(clamp((rho - rin) / (rout - rin) * 1.2, 0, 1)); var I = prof * streak * dop2 * 1.3 * edge;
          if (uy > 0) front = I;
          if (uy > 0 || r > rh * 1.05) { cr += dcl[0] * I; cg += dcl[1] * I; cb += dcl[2] * I; }
        }
        var idx = y * S + x;
        if (r < rh) {          // event horizon: opaque black, except the near disc passing in front
          var fa = clamp(front, 0, 1);
          if (fa > 0.01) d[idx] = (255 << 24) | (((dcl[2] * fa * 255) | 0) << 16) | (((dcl[1] * fa * 255) | 0) << 8) | ((dcl[0] * fa * 255) | 0);
          else d[idx] = 0xff000000;
        } else putRGBA(d, idx, cr, cg, cb);
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function starSprite(kind, sizePx, opts) {
    opts = opts || {};
    kind = kindOf(kind);
    var dpr = opts.dpr > 0 ? opts.dpr : 1, S = max(8, round((isFinite(sizePx) && sizePx > 0 ? sizePx : 64) * dpr)), spikes = !!opts.spikes, glowK = opts.glow !== undefined ? opts.glow : 1;
    var key = kind + '|' + S + '|' + (spikes ? 1 : 0) + '|' + glowK;
    var hit = SPR[key];
    if (hit) return hit;
    var cv = kind === 'blackhole' ? buildBlackHoleSprite(S, glowK) : buildStarSprite(kind, S, spikes, glowK);
    SPR[key] = cv; SPRKEYS.push(key);
    if (SPRKEYS.length > 160) delete SPR[SPRKEYS.shift()];
    return cv;
  }
  function round(v) { return Math.round(v); }

  /* ================================================================ animated star surface (solar-system view) */
  var SURF = {
    yellow: { ramp: [[0, '#8a1c04'], [0.22, '#c8480c'], [0.45, '#f58a14'], [0.68, '#ffc640'], [0.88, '#ffeaa0'], [1, '#fffbe8']], freq: 21, spots: 0.8, ld: 0.62, prom: 4, hue: [255, 200, 100], pc: [255, 96, 40] },
    orange: { ramp: [[0, '#5e1202'], [0.25, '#b03a08'], [0.5, '#f06c10'], [0.75, '#ffa638'], [0.92, '#ffd890'], [1, '#fff0d0']], freq: 17, spots: 1.0, ld: 0.66, prom: 4, hue: [255, 140, 60], pc: [255, 70, 30] },
    red: { ramp: [[0, '#3c0803'], [0.25, '#8a1a08'], [0.5, '#d6360e'], [0.75, '#ff6a2a'], [0.92, '#ff9c6a'], [1, '#ffc8a0']], freq: 11, spots: 1.5, ld: 0.7, prom: 5, hue: [255, 70, 44], pc: [255, 50, 30] },
    blue: { ramp: [[0, '#1a2c8c'], [0.3, '#3e72e6'], [0.6, '#86bcff'], [0.85, '#d2e8ff'], [1, '#ffffff']], freq: 30, spots: 0.0, ld: 0.30, prom: 2, hue: [100, 160, 255], pc: [120, 170, 255] },
    white: { ramp: [[0, '#6a78b0'], [0.3, '#aebcee'], [0.6, '#e4ecff'], [0.85, '#ffffff'], [1, '#ffffff']], freq: 26, spots: 0.15, ld: 0.42, prom: 3, hue: [214, 226, 255], pc: [190, 210, 255] },
    green: { ramp: [[0, '#165c22'], [0.25, '#34a846'], [0.5, '#7ae484'], [0.75, '#c0ffc4'], [0.92, '#eaffee'], [1, '#ffffff']], freq: 23, spots: 0.5, ld: 0.5, prom: 3, hue: [90, 255, 140], pc: [80, 255, 140] },
    purple: { ramp: [[0, '#34106a'], [0.25, '#7432cc'], [0.5, '#b474ff'], [0.75, '#e2bcff'], [0.92, '#f8eaff'], [1, '#ffffff']], freq: 46, spots: 0.0, ld: 0.2, prom: 0, hue: [170, 100, 255], pc: [170, 100, 255] }
  };
  var STEX = {};
  var _cf = { f1: 0, f2: 0, h: 0 };

  function makeCellular(seed) {
    function cell(x, y, z) {
      var bx = floor(x - 0.5), by = floor(y - 0.5), bz = floor(z - 0.5), f1 = 1e9, f2 = 1e9, hn = 0;
      for (var dz = 0; dz < 2; dz++) for (var dy = 0; dy < 2; dy++) for (var dx = 0; dx < 2; dx++) {
        var cx = bx + dx, cy = by + dy, cz = bz + dz;
        var h = mixInt((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791) ^ seed) >>> 0);
        var fx = cx + 0.15 + 0.7 * ((h & 1023) / 1023), fy = cy + 0.15 + 0.7 * (((h >>> 10) & 1023) / 1023), fz = cz + 0.15 + 0.7 * (((h >>> 20) & 1023) / 1023);
        var ex = x - fx, ey = y - fy, ez = z - fz, d = ex * ex + ey * ey + ez * ez;
        if (d < f1) { f2 = f1; f1 = d; hn = h; } else if (d < f2) f2 = d;
      }
      _cf.f1 = sqrt(f1); _cf.f2 = sqrt(f2); _cf.h = hn;
    }
    return cell;
  }

  // The 512x256 surface texture of a star kind costs 100-250 ms of pure JS, so it is generated row by row in background slices
  // (starTex(kind) returns null until it is done and drawStarSurface draws a cheap graded disc meanwhile); starTex(kind, true) blocks.
  var STJOB = {}, STQ = [], stTimer = 0;
  function starTex(kind, sync) {
    var T = STEX[kind];
    if (T) return T;
    var job = STJOB[kind];
    if (!job) { job = STJOB[kind] = starTexJob(kind); STQ.push(job); scheduleStarTex(); }
    if (!sync) return null;
    while (!job.done) job.step();
    var qi = STQ.indexOf(job); if (qi >= 0) STQ.splice(qi, 1);
    return STEX[kind];
  }
  function scheduleStarTex() { if (!stTimer && STQ.length) stTimer = setTimeout(pumpStarTex, 2); }
  function pumpStarTex() {
    stTimer = 0;
    var t0 = now();
    while (STQ.length && now() - t0 < 6) { var job = STQ[0]; if (job.done || job.step()) STQ.shift(); }
    scheduleStarTex();
  }
  function starTexJob(kind) {
    var cfg = SURF[kind] || SURF.yellow, W = 512, H = 256, N = W * H, sd = hashStr('star:' + kind);
    var g0 = new Uint8Array(N), g1 = new Uint8Array(N), mm = new Uint8Array(N);
    var nz = makeNoise3(sub(sd, 1)), c0 = makeCellular(sub(sd, 2)), c1 = makeCellular(sub(sd, 3)), c2 = makeCellular(sub(sd, 4)), c3 = makeCellular(sub(sd, 5));
    var sinT = new Float32Array(W), cosT = new Float32Array(W), x, y, k;
    for (x = 0; x < W; x++) { var a = (x + 0.5) / W * TAU; sinT[x] = sin(a); cosT[x] = cos(a); }
    var rnd = rng32(sub(sd, 6)), spots = [], ns = Math.round(3 + 5 * cfg.spots) * (cfg.spots > 0 ? 1 : 0);
    for (k = 0; k < ns; k++) {
      var lat = (rnd() < 0.5 ? -1 : 1) * (0.08 + rnd() * 0.5), lon = rnd() * TAU, cl = cos(lat), rho = 0.035 + rnd() * 0.06, pairs = rnd() < 0.6 ? 2 : 1;
      for (var q = 0; q < pairs; q++) {
        var lo = lon + q * (0.14 + rnd() * 0.1), cl2 = cos(lat + q * 0.02);
        spots.push({ x: cl2 * sin(lo), y: sin(lat + q * 0.02), z: cl2 * cos(lo), r: rho * (q ? 0.7 : 1), ph: rnd() * TAU });
      }
    }
    var fq = cfg.freq * 1.5;                                        // finer granulation than v1 (freq is per-kind; the cells were plate-sized)
    function gran(cell, px, py, pz) {
      cell(px * fq, py * fq, pz * fq);
      var lane = sstep(0.03, 0.30, _cf.f2 - _cf.f1), ctr = 1 - sstep(0.0, 0.85, _cf.f1) * 0.55, rv = ((_cf.h >>> 5) & 255) / 255 - 0.5;
      var g = 0.62 + 0.38 * lane * (0.70 + 0.30 * ctr) + rv * 0.10 * lane;   // low contrast: the lanes are a few percent darker, not cracks
      cell(px * fq * 2.2 + 11, py * fq * 2.2, pz * fq * 2.2);
      var l2 = sstep(0.04, 0.30, _cf.f2 - _cf.f1), g2 = 0.70 + 0.30 * l2 * (0.70 + 0.30 * (1 - sstep(0, 0.85, _cf.f1)));
      return g * 0.66 + g2 * 0.34;
    }
    function row(y) {
      var latr = (0.5 - (y + 0.5) / H) * PI, cl3 = cos(latr), sl3 = sin(latr);
      for (var x = 0; x < W; x++) {
        var px = cl3 * sinT[x], py = sl3, pz = cl3 * cosT[x], i = y * W + x;
        var v0 = gran(c0, px, py, pz) + 0.06 * nz.n(px * 40, py * 40, pz * 40);
        var v1 = gran(c1, px + 3.7, py - 1.2, pz + 2.1) + 0.06 * nz.n(px * 40 + 9, py * 40, pz * 40);
        g0[i] = clamp(v0, 0, 1) * 255; g1[i] = clamp(v1, 0, 1) * 255;
        var m = 0.5 + 0.14 * nz.fbm(px * 2.6 + 7, py * 2.6, pz * 2.6, 4) + 0.06 * nz.fbm(px * 8 + 3, py * 8, pz * 8, 3);   // gentle mottling (was 0.30: blotches)
        for (k = 0; k < spots.length; k++) {
          var sp = spots[k], dx = px - sp.x, dy = py - sp.y, dz = pz - sp.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < sp.r * sp.r * 6) {
            var u = sqrt(d2) / sp.r;
            if (u < 0.42) m -= 0.34;
            else if (u < 1.0) { var fib = 0.65 + 0.35 * cos(atan2(dy * 3 + dz, dx * 3 - dz) * 13 + sp.ph); m -= 0.22 * (1 - (u - 0.42) / 0.58) * fib; }
            else m += 0.06 * exp(-(u - 1) * 1.4);
          }
        }
        mm[i] = clamp(m, 0, 1) * 255;
      }
    }
    var job = { y: 0, done: false, step: function () {           // one row per step (~0.5-1 ms); true when the texture is finished
      if (job.done) return true;
      row(job.y++);
      if (job.y >= H) { job.done = true; delete STJOB[kind]; STEX[kind] = { W: W, H: H, g0: g0, g1: g1, m: mm, ramp: makeRampLut(cfg.ramp) }; }
      return job.done;
    } };
    return job;
  }
  function makeRampLut(stops) {
    var lut = new Uint8Array(256 * 3), st = stops.map(function (s) { return [s[0], parseHex(s[1])]; });
    for (var i = 0; i < 256; i++) {
      var t = i / 255, a = st[0], b = st[st.length - 1];
      if (t <= a[0]) b = a; else if (t >= b[0]) a = b;
      else for (var k = 1; k < st.length; k++) if (t <= st[k][0]) { a = st[k - 1]; b = st[k]; break; }
      var f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      lut[i * 3] = mixf(a[1][0], b[1][0], f); lut[i * 3 + 1] = mixf(a[1][1], b[1][1], f); lut[i * 3 + 2] = mixf(a[1][2], b[1][2], f);
    }
    return lut;
  }

  var SGEO = {}, SGKEYS = [];
  function starGeom(R) {
    var g = SGEO[R];
    if (g) return g;
    var bw = 2 * R + 4, c = bw / 2, maxN = ((PI * (R + 2) * (R + 2)) | 0) + 64;
    g = { n: 0, bw: bw, pos: new Int32Array(maxN), uf: new Float32Array(maxN), r0: new Int32Array(maxN), r1: new Int32Array(maxN), fy: new Float32Array(maxN), nz: new Float32Array(maxN), cov: new Uint8Array(maxN), dif: new Float32Array(maxN) };
    var tau = -0.22, pitch = 0.30, ct = cos(tau), st = sin(tau), cp = cos(pitch), sp = sin(pitch), invR = 1 / R, k = 0, Hl = 256, Wl = 512;
    for (var py = 0; py < bw; py++) {
      var dy = py + 0.5 - c;
      for (var px = 0; px < bw; px++) {
        var dx = px + 0.5 - c, d = sqrt(dx * dx + dy * dy);
        if (d > R + 0.5) continue;
        var cv = R + 0.5 - d; if (cv > 1) cv = 1;
        var s = d * invR, kk = 1; if (s > 0.9996) { kk = 0.9996 / s; s = 0.9996; }
        var nx = dx * invR * kk, ny = -dy * invR * kk, nzv = sqrt(1 - s * s);
        var qx = nx * ct + ny * st, qy = -nx * st * cp + ny * ct * cp + nzv * sp, qz = nx * st * sp - ny * ct * sp + nzv * cp;
        var uf = atan2(qx, qz) / TAU; if (uf < 0) uf += 1;
        var V = (0.5 - asin(qy > 1 ? 1 : qy < -1 ? -1 : qy) / PI) * Hl - 0.5, i0 = floor(V), f = V - i0, i1 = i0 + 1;
        if (i0 < 0) { i0 = 0; f = 0; } else if (i0 > Hl - 1) i0 = Hl - 1; if (i1 > Hl - 1) i1 = Hl - 1; if (i1 < 0) i1 = 0;
        g.pos[k] = py * bw + px; g.uf[k] = uf; g.r0[k] = i0 * Wl; g.r1[k] = i1 * Wl; g.fy[k] = f; g.nz[k] = nzv; g.cov[k] = (cv * 255 + 0.5) | 0; g.dif[k] = 1 - 0.18 * qy * qy;
        k++;
      }
    }
    g.n = k; SGEO[R] = g; SGKEYS.push(R);
    if (SGKEYS.length > 12) delete SGEO[SGKEYS.shift()];
    return g;
  }

  var SIN = {}, SINKEYS = [];
  function starInst(kind, R) {
    var key = kind + '|' + R, s = SIN[key];
    if (s) return s;
    var g = starGeom(R), cv = createCanvas(g.bw, g.bw), ctx = cv.getContext('2d'), img = ctx.createImageData(g.bw, g.bw);
    s = SIN[key] = { g: g, cv: cv, ctx: ctx, img: img, out: new Uint32Array(img.data.buffer), last: -9, phase: (hashStr(kind) % 1000) / 1000 };
    SINKEYS.push(key);
    if (SINKEYS.length > 16) delete SIN[SINKEYS.shift()];
    return s;
  }

  function renderStarBody(inst, kind, t, spin) {
    var T = starTex(kind), cfg = SURF[kind] || SURF.yellow, g = inst.g, n = g.n, out = inst.out, ramp = T.ramp, Wl = T.W, Wm = Wl - 1;
    var G0 = T.g0, G1 = T.g1, MM = T.m, pos = g.pos, uf = g.uf, r0A = g.r0, r1A = g.r1, fyA = g.fy, nzA = g.nz, cov = g.cov, difA = g.dif;
    out.fill(0);
    var s1 = inst.phase + t * spin, s2 = inst.phase * 1.7 + 0.31 - t * spin * 0.55, cw = 0.5 + 0.5 * sin(t * 0.42 + inst.phase * 9), nrm = 1 / sqrt(cw * cw + (1 - cw) * (1 - cw));
    var ld = cfg.ld, i255 = 1 / 255;
    for (var k = 0; k < n; k++) {
      var d = difA[k], fy = fyA[k], a0 = r0A[k], a1 = r1A[k];
      var u1 = (uf[k] - s1 * d + 2) * Wl - 0.5, x0 = u1 | 0, fx = u1 - x0, x1; x0 &= Wm; x1 = (x0 + 1) & Wm;
      var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      var ga = w00 * G0[a0 + x0] + w10 * G0[a0 + x1] + w01 * G0[a1 + x0] + w11 * G0[a1 + x1];
      var mv = w00 * MM[a0 + x0] + w10 * MM[a0 + x1] + w01 * MM[a1 + x0] + w11 * MM[a1 + x1];
      var u2 = (uf[k] - s2 * (0.6 + 0.4 * d) + 2) * Wl - 0.5, y0 = u2 | 0, fx2 = u2 - y0, y1; y0 &= Wm; y1 = (y0 + 1) & Wm;
      var v00 = (1 - fx2) * (1 - fy), v10 = fx2 * (1 - fy), v01 = (1 - fx2) * fy, v11 = fx2 * fy;
      var gb = v00 * G1[a0 + y0] + v10 * G1[a0 + y1] + v01 * G1[a1 + y0] + v11 * G1[a1 + y1];
      var gg = 0.5 + ((cw * ga + (1 - cw) * gb) * i255 - 0.5) * nrm;
      var mu = nzA[k], limb = (1 - ld * (1 - mu)) * (0.84 + 0.16 * (mu < 0.12 ? mu / 0.12 : 1));   // I = 1 - u(1 - mu), a little extra in the last 12 %
      var B = (0.30 + 0.46 * gg + 0.30 * (mv * i255 - 0.5)) * limb + (mu - 0.5) * 0.06;
      B = B < 0 ? 0 : B > 1 ? 1 : B;
      var ri = ((B * 255 + 0.5) | 0) * 3, r = ramp[ri], gc = ramp[ri + 1], b = ramp[ri + 2], cv = cov[k];
      var A = cv;
      out[pos[k]] = (A << 24) | (b << 16) | (gc << 8) | r;
    }
    inst.ctx.putImageData(inst.img, 0, 0);
  }

  /* glow sprite hugging the limb, with baked soft streamers; the star radius is 0.34 of the half-size */
  var CSPR = {};
  function coronaSprite(kind) {
    var c = CSPR[kind];
    if (c) return c;
    var S = 512, cv = createCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = new Uint32Array(img.data.buffer);
    var cfg = SURF[kind] || SURF.yellow, hue = cfg.hue.map(function (v) { return v / 255; }), half = S / 2, st = STAR[kind] || STAR.yellow, core = parseHex(st.core).map(function (v) { return v / 255; });
    var scale = kind === 'red' ? 1.25 : kind === 'blue' ? 0.8 : 1, nz = makeNoise2(hashStr('corona:' + kind));
    var streak = kind === 'purple' ? 0.2 : kind === 'blue' || kind === 'white' ? 1.0 : 0.8;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, s = sqrt(dx * dx + dy * dy) / 0.34;
      if (s < 1) s = 1;
      var q = s - 1, th = atan2(dy, dx), ct = cos(th), stt = sin(th);
      var sv = nz.n(ct * 1.5, stt * 1.5) * 0.65 + nz.n(ct * 3.6 + 5, stt * 3.6) * 0.35, str = clamp(0.5 + 0.9 * sv, 0, 1);
      var sk = mixf(1, 0.12 + 1.5 * str * str, streak * sstep(0.05, 0.9, q));
      var A = (0.50 * exp(-q * 4.2 / scale) + 0.26 * exp(-q * 1.25 / scale) * sk + 0.10 * exp(-q * 0.55 / scale) * sk) * (1 - sstep(1.9, 2.93, s));
      var hot = exp(-q * 3.0);
      putRGBA(d, y * S + x, mixf(hue[0], core[0], hot * 0.28) * A, mixf(hue[1], core[1], hot * 0.28) * A, mixf(hue[2], core[2], hot * 0.28) * A);
    }
    ctx.putImageData(img, 0, 0);
    return (CSPR[kind] = cv);
  }

  function hash01(a, b) { return mixInt((Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0) / 4294967296; }

  function drawProminences(ctx, cfg, cx, cy, r, t, seed) {
    var n = cfg.prom, pc = cfg.pc, lw = max(1, r / 55);
    ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var th = hash01(seed, i + 11) * TAU + t * 0.008 * (i % 2 ? 1 : -1), span = 0.16 + 0.22 * hash01(seed, i + 21);
      var life = 0.55 + 0.45 * sin(t * (0.22 + 0.3 * hash01(seed, i + 31)) + hash01(seed, i + 41) * TAU), hgt = r * (0.10 + 0.26 * hash01(seed, i + 51)) * life;
      if (hgt < r * 0.03) continue;
      var a1 = th - span / 2, a2 = th + span / 2, ax = cx + cos(a1) * r * 0.99, ay = cy + sin(a1) * r * 0.99, bx = cx + cos(a2) * r * 0.99, by = cy + sin(a2) * r * 0.99;
      var qx = cx + cos(th) * (r + hgt * 1.9), qy = cy + sin(th) * (r + hgt * 1.9), fade = 0.45 + 0.55 * life;
      var passes = [[9, 0.07], [5, 0.12], [2.4, 0.24], [1.1, 0.34]];
      for (var p = 0; p < 4; p++) {
        var ps = passes[p], wm = p === 3 ? 0.55 : 0;
        ctx.strokeStyle = 'rgba(' + ((mixf(pc[0], 255, wm)) | 0) + ',' + ((mixf(pc[1], 240, wm)) | 0) + ',' + ((mixf(pc[2], 220, wm)) | 0) + ',' + (ps[1] * fade).toFixed(3) + ')';
        ctx.lineWidth = ps[0] * lw;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by); ctx.stroke();
        if (p > 1) {
          ctx.beginPath(); ctx.moveTo(cx + cos(a1 + span * 0.2) * r * 0.99, cy + sin(a1 + span * 0.2) * r * 0.99);
          ctx.quadraticCurveTo(cx + cos(th) * (r + hgt * 1.15), cy + sin(th) * (r + hgt * 1.15), cx + cos(a2 - span * 0.2) * r * 0.99, cy + sin(a2 - span * 0.2) * r * 0.99);
          ctx.stroke();
        }
      }
    }
  }
  function drawFlare(ctx, cfg, cx, cy, r, t, seed) {
    var per = 17, tt = t + hash01(seed, 99) * per, k = floor(tt / per), ph = (tt - k * per) / 2.4;
    if (ph > 1 || hash01(seed, k + 200) < 0.25) return;
    var env = sin(PI * ph), th = hash01(seed, k + 300) * TAU, fx = cx + cos(th) * r, fy = cy + sin(th) * r, hue = cfg.hue;
    var rr = r * (0.18 + 0.42 * env), g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rr);
    g.addColorStop(0, 'rgba(255,255,240,' + (0.75 * env).toFixed(3) + ')'); g.addColorStop(0.3, 'rgba(' + hue[0] + ',' + hue[1] + ',' + hue[2] + ',' + (0.4 * env).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + hue[0] + ',' + hue[1] + ',' + hue[2] + ',0)');
    ctx.fillStyle = g; ctx.fillRect(fx - rr, fy - rr, rr * 2, rr * 2);
  }

  /* neutron star: tiny fierce body, lighthouse beams */
  function drawPulsarBeams(ctx, cx, cy, r, t) {
    var a = t * 2.1 + 0.6, tilt = 0.55;
    for (var s = 0; s < 2; s++) {
      var ang = a + s * PI, vis = pow(max(0, cos(ang * 1)), 2) * 0.9 + 0.12, dir = -PI / 2 + tilt * sin(ang) * 0.8 + (s ? PI : 0);
      var L = r * 7, ex = cx + cos(dir) * L, ey = cy + sin(dir) * L, wd = 0.045;
      var g = ctx.createLinearGradient(cx, cy, ex, ey);
      g.addColorStop(0, 'rgba(255,240,255,' + (0.85 * vis).toFixed(3) + ')'); g.addColorStop(0.25, 'rgba(190,120,255,' + (0.38 * vis).toFixed(3) + ')'); g.addColorStop(1, 'rgba(150,80,255,0)');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(cx + cos(dir + PI / 2) * r * 0.1, cy + sin(dir + PI / 2) * r * 0.1); ctx.lineTo(ex + cos(dir + PI / 2) * L * wd, ey + sin(dir + PI / 2) * L * wd);
      ctx.lineTo(ex - cos(dir + PI / 2) * L * wd, ey - sin(dir + PI / 2) * L * wd); ctx.lineTo(cx - cos(dir + PI / 2) * r * 0.1, cy - sin(dir + PI / 2) * r * 0.1);
      ctx.closePath(); ctx.fill();
    }
  }

  /* black hole: per-pixel accretion disc with differential-rotation streaks, drawn into a bounded buffer and scaled */
  var BHI = null;
  function bhInst() {
    if (BHI) return BHI;
    var S = 288, half = S / 2, n = 0, pos = new Int32Array(S * S), rr = new Float32Array(S * S), rho = new Float32Array(S * S), phi = new Float32Array(S * S), ux = new Float32Array(S * S), uy = new Float32Array(S * S);
    var tilt = -0.20, ct = cos(tilt), st = sin(tilt), kf = 0.30;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var X = (x + 0.5 - half) / half, Y = (y + 0.5 - half) / half, r = sqrt(X * X + Y * Y);
      if (r > 1) continue;
      var a = X * ct + Y * st, b = -X * st + Y * ct;
      pos[n] = y * S + x; rr[n] = r; ux[n] = a; uy[n] = b; rho[n] = sqrt(a * a + (b / kf) * (b / kf)); phi[n] = atan2(b / kf, a); n++;
    }
    var cv = createCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
    return (BHI = { S: S, n: n, pos: pos, rr: rr, rho: rho, phi: phi, ux: ux, uy: uy, cv: cv, ctx: ctx, img: img, out: new Uint32Array(img.data.buffer), last: -9 });
  }
  function renderBlackHole(t) {
    var I = bhInst(), out = I.out, n = I.n, rh = BH.rh, rin = BH.rin, rout = BH.rout;
    out.fill(0);
    for (var k = 0; k < n; k++) {
      var r = I.rr[k], rho = I.rho[k], phi = I.phi[k], ux = I.ux[k], uy = I.uy[k], edge = 1 - sstep(0.78, 1, r);
      var cr = 0, cg = 0, cb = 0, gl = 0.20 * exp(-pow(r / 0.55, 1.5)) * edge;
      cr += gl; cg += gl * 0.62; cb += gl * 0.34;
      var arch = exp(-pow((r - BH.arch) / BH.archW, 2)), top = 0.30 + 0.70 * (0.5 - 0.5 * (uy / max(r, 1e-4))), ring = exp(-pow((r - BH.ring) / BH.ringW, 2)), dop = 0.8 + 0.4 * (ux / max(r, 1e-4));
      var pulse = 0.88 + 0.12 * sin(t * 1.7 + phi * 3);
      var ac = bhDiscColor(0.12), aI = (arch * top * 0.85 * pulse + ring * 1.3) * dop * edge;
      cr += ac[0] * aI; cg += ac[1] * aI; cb += ac[2] * aI;
      var front = 0, dc = null;
      if (rho > rin * 0.94 && rho < rout) {
        var prof = pow(rin / max(rho, rin), 1.7) * sstep(rout, rout * 0.7, rho) * sstep(rin * 0.94, rin * 1.1, rho);
        var om = 1.6 / (rho * sqrt(rho) + 0.05), ph2 = phi - t * om * 0.5;
        var streak = 0.76 + 0.16 * sin(rho * 46 + ph2 * 2) + 0.14 * sin(ph2 * 5 + rho * 13) + 0.07 * sin(ph2 * 11 - rho * 25);
        var dop2 = 1 + 0.48 * (ux / max(rho, 1e-3));
        dc = bhDiscColor(clamp((rho - rin) / (rout - rin) * 1.2, 0, 1)); var Id = prof * streak * dop2 * 1.3 * edge;
        if (uy > 0) front = Id;
        if (uy > 0 || r > rh * 1.05) { cr += dc[0] * Id; cg += dc[1] * Id; cb += dc[2] * Id; }
      }
      var o = I.pos[k];
      if (r < rh) {
        var fa = clamp(front, 0, 1);
        out[o] = fa > 0.01 ? ((255 << 24) | (((dc[2] * fa * 255) | 0) << 16) | (((dc[1] * fa * 255) | 0) << 8) | ((dc[0] * fa * 255) | 0)) : 0xff000000;
      } else putRGBA(out, o, cr, cg, cb);
    }
    I.ctx.putImageData(I.img, 0, 0);
    return I;
  }

  function drawStarSurface(ctx, kind, cx, cy, r, t, opts) {
    opts = opts || {};
    kind = kindOf(kind); t = t || 0;
    if (!(r > 0.5)) return;
    var prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha, prevSm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (kind === 'blackhole') {
      var I = bhInst();
      if (t - I.last > 1 / 40 || t < I.last) { renderBlackHole(t); I.last = t; }
      var half = r / BH.rh;           // r = event-horizon radius
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(I.cv, cx - half, cy - half, half * 2, half * 2);
      ctx.globalCompositeOperation = prevOp; ctx.globalAlpha = prevA; ctx.imageSmoothingEnabled = prevSm;
      return;
    }
    var dpr = opts.dpr > 0 ? opts.dpr : (typeof window !== 'undefined' && window.devicePixelRatio) || 1, cfg = SURF[kind], seed = hashStr(kind);
    var Rr = Math.round(r * dpr); if (Rr > 240) Rr = 240; if (Rr < 3) Rr = 3;
    var sc = r * dpr / Rr, spin = opts.spin !== undefined ? opts.spin : 0.012, T = starTex(kind, !!opts.sync), inst = T ? starInst(kind, Rr) : null;
    if (inst && (t - inst.last > 1 / 45 || t < inst.last)) { renderStarBody(inst, kind, t, spin); inst.last = t; }
    var showCorona = opts.corona !== false, flick = 0.92 + 0.08 * sin(t * 1.3 + 1.7) + 0.04 * sin(t * 3.1);
    ctx.globalCompositeOperation = 'lighter';
    if (showCorona) {
      var D = r / 0.34, spr = coronaSprite(kind), ga = (kind === 'purple' ? 0.9 : 1) * flick;
      ctx.save(); ctx.translate(cx, cy);
      ctx.rotate(t * 0.011); ctx.globalAlpha = ga * 0.80; ctx.drawImage(spr, -D, -D, D * 2, D * 2);
      ctx.rotate(-t * 0.011 * 2.7 + 1.9); ctx.globalAlpha = ga * 0.42; ctx.drawImage(spr, -D, -D, D * 2, D * 2);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    if (inst) { var dw = inst.g.bw * sc / dpr; ctx.drawImage(inst.cv, cx - dw / 2, cy - dw / 2, dw, dw); }
    else {                                                     // surface texture still building: limb-darkened disc in the kind's ramp colours
      var ramp = cfg.ramp, gr = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.1, 0, cx, cy, r);
      gr.addColorStop(0, ramp[ramp.length - 2][1]); gr.addColorStop(0.55, ramp[Math.max(0, ramp.length - 3)][1]); gr.addColorStop(1, ramp[1][1]);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    if (opts.prominences !== false && cfg.prom > 0) { drawProminences(ctx, cfg, cx, cy, r, t, seed); drawFlare(ctx, cfg, cx, cy, r, t, seed); }
    if (kind === 'purple') drawPulsarBeams(ctx, cx, cy, r, t);
    ctx.globalCompositeOperation = prevOp; ctx.globalAlpha = prevA; ctx.imageSmoothingEnabled = prevSm;
  }

  Gfx.Space = {
    STAR_KINDS: STAR_KINDS, starColor: starColor, makeBackdrop: makeBackdrop, makeStarfield: makeStarfield,
    starSprite: starSprite, drawStarSurface: drawStarSurface
  };
})(window.MOO);
