/* =========================================================================
   MOO.Gfx.GLPlanets — WebGL2 planet / star / asteroid renderer (optional accelerator; API-compatible with MOO.Gfx.Planets)

   Everything is procedural in the fragment shader.  Noise is sampled on the sphere surface in object space (3-D), so there are no
   seams and no pole pinching.  The noise itself comes from two small periodic 3-D textures synthesised once on the CPU (band-limited
   random-phase spectra -> inverse FFT; value + analytic gradient in one texel), which keeps shader compile times short and the
   per-pixel cost low.  Surface = domain-warped fbm continents, ridged mountains, crater fields, biome grading, ocean depth + glint,
   polar caps, gradient-based relief lighting, a rotating self-shading cloud layer with cloud shadows, lava / radiated emissive
   veins, night-side city lights, Fresnel atmosphere + halo, rings with front/back occlusion and mutual shadows.  Gas giants use
   sheared latitude bands + vortices.  Octave counts scale with MOO.Perf.q.planetDetail and with the on-screen radius.

     GLPlanets.supported()                                  -> bool (GL.supported() && noise volume built && the main planet shader linked). NEVER blocks: the
                                                               first call starts warm() and returns false, so the CPU fallback draws until it flips to true.
                                                               supported(true) = blocking form for tools.
     GLPlanets.draw(ctx, desc, cx, cy, radius, t, opts)     -> bool (true = drawn).  Same contract as MOO.Gfx.Planets.draw.
     GLPlanets.sprite(desc, diameterPx, opts)               -> canvas (cached static sphere incl. atmosphere / rings; opts.phase = rotation in revs)
     GLPlanets.drawStar(ctx, kind, cx, cy, r, t, opts)      -> bool   animated star surface / corona / prominences / black hole (r = photosphere radius;
                                                               black hole: r = shadow radius, the lensed disc extends to ~3.5 r)
     GLPlanets.drawAsteroids(ctx, desc, cx, cy, w, h, t, opts) -> bool   lit tumbling rock field with parallax (centre cx,cy)
     GLPlanets.warm(cb) / ready()                           idle-sliced: noise volume in ~20 ms pieces, one shader compile per slice, polled; ready() = all compiled
   Canvas2D parity: when WebGL2 is unavailable (or Perf tier 'low' / Settings gpu=false, or a program is still compiling) every entry point hands the
   call to MOO.Gfx.Planets / MOO.Gfx.Space.drawStarSurface with the same arguments (GLPlanets.fallback = false disables that; GLPlanets.path tells
   which path served the last call: 'gl' | 'cpu').  opts: lightAngle (-2.3) lightElev (.55) spin (.015) clouds atmosphere lights cloudShadows dpr lightColor.
   ========================================================================= */
(function (M) {
  'use strict';
  const Gfx = M.Gfx = M.Gfx || {};
  const GL = Gfx.GL;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mixf = (a, b, t) => a + (b - a) * t;
  const hasWin = typeof window !== 'undefined';

  /* ---------------------------------------------------------------- hashing / rng */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return h >>> 0;
  }
  function mixInt(x) { x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16; return x >>> 0; }
  function seedOf(v) {
    if (typeof v === 'number' && isFinite(v) && v === (v | 0)) return mixInt((v | 0) + 0x9e3779b9);
    if (v === undefined || v === null) return mixInt(1);
    return hashStr(String(v));
  }
  function rng32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // inverse normal CDF (Abramowitz-Stegun 26.2.23): turns "ocean fraction" / "cloud cover" into field thresholds
  function probit(p) {
    p = clamp(p, 1e-4, 1 - 1e-4);
    const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
    const x = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
    return p < 0.5 ? -x : x;
  }

  /* ---------------------------------------------------------------- colours (authored in sRGB, shaded in linear) */
  const lin = v => Math.pow(v / 255, 2.2);
  function hexRgb(h, dflt) {
    if (typeof h !== 'string') return dflt || [128, 128, 128];
    let s = h.charAt(0) === '#' ? h.slice(1) : h;
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const v = parseInt(s, 16);
    if (!isFinite(v)) return dflt || [128, 128, 128];
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const hexLin = h => hexRgb(h).map(lin);

  /* ---------------------------------------------------------------- periodic 3-D noise textures (built once, CPU) */
  const NZ = 64;                       // texels per axis; the tile spans 4 noise units (16 texels per unit)
  const COS64 = new Float64Array(64), SIN64 = new Float64Array(64), REV64 = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    COS64[i] = Math.cos(TAU * i / 64); SIN64[i] = Math.sin(TAU * i / 64);
    let r = 0; for (let b = 0; b < 6; b++) if (i & (1 << b)) r |= 1 << (5 - b);
    REV64[i] = r;
  }
  function fft64(re, im) {
    for (let i = 0; i < 64; i++) { const j = REV64[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= 64; len <<= 1) {
      const half = len >> 1, step = 64 / len;
      for (let i = 0; i < 64; i += len) {
        for (let k = 0; k < half; k++) {
          const wr = COS64[k * step], wi = SIN64[k * step], a = i + k, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }
  const _f32 = new Float32Array(1), _u32 = new Uint32Array(_f32.buffer);
  function toHalf(v) {
    _f32[0] = v; const x = _u32[0];
    const sign = (x >>> 16) & 0x8000; const exp = ((x >>> 23) & 0xff) - 127 + 15; let mant = x & 0x7fffff;
    if (exp <= 0) { if (exp < -10) return sign; mant = (mant | 0x800000) >> (1 - exp); return sign | ((mant + 0x1000) >> 13); }
    if (exp >= 31) return sign | 0x7c00;
    return sign | (exp << 10) | ((mant + 0x1000) >> 13);
  }
  let NOISE = null;      // {d1, d2: Uint16Array} half-float RGBA, kept so a restored context can re-upload instantly
  // The noise volume (~200 ms of pure JS) is built in slices of ~20-30 ms: noiseStep() runs one slice and returns true when done,
  // buildNoise() runs every remaining slice at once (first GL draw before warm() finished, test pages).
  let NZ_ST = null;
  function ifftAxis(re, im, axis) {
    const N = NZ, tr = new Float64Array(N), ti = new Float64Array(N), stride = axis === 0 ? 1 : axis === 1 ? N : N * N;
    for (let a = 0; a < N; a++) {
      for (let b = 0; b < N; b++) {
        const base = axis === 0 ? (a * N + b) * N : axis === 1 ? a * N * N + b : a * N + b;
        for (let i = 0; i < N; i++) { tr[i] = re[base + i * stride]; ti[i] = im[base + i * stride]; }
        fft64(tr, ti);
        for (let i = 0; i < N; i++) { re[base + i * stride] = tr[i]; im[base + i * stride] = ti[i]; }
      }
    }
  }
  function noiseStep() {
    if (NOISE) return true;
    const N = NZ, N3 = N * N * N;
    if (!NZ_ST) {
      const rnd = rng32(0xC0FFEE), gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd()))) * Math.cos(TAU * rnd());
      const K0 = 2.6, BW = 0.62;
      // random-phase Hermitian spectrum with a log-gaussian band around K0 cycles per tile (=> features about one noise unit wide)
      const fill = (R, I) => {
        for (let kz = 0; kz <= 8; kz++) for (let ky = -8; ky <= 8; ky++) for (let kx = -8; kx <= 8; kx++) {
          if (!(kz > 0 || (ky > 0 || (ky === 0 && kx > 0)))) continue;
          const k = Math.sqrt(kx * kx + ky * ky + kz * kz);
          if (k < 1 || k > 8) continue;
          const amp = Math.exp(-0.5 * Math.pow(Math.log(k / K0) / BW, 2));
          const cr = amp * gauss(), ci = amp * gauss();
          const i1 = ((kz & 63) * N + (ky & 63)) * N + (kx & 63), i2 = (((-kz) & 63) * N + ((-ky) & 63)) * N + ((-kx) & 63);
          R[i1] = cr; I[i1] = ci; R[i2] = cr; I[i2] = -ci;
        }
      };
      NZ_ST = { fill, fields: [], pass: 0, axis: -1, step: 0 };
    }
    const st = NZ_ST;
    if (st.pass < 3) {                                   // 3 passes x (spectrum, ifft x, ifft y, ifft z) = 12 slices
      if (st.axis < 0) {
        const R1 = new Float64Array(N3), I1 = new Float64Array(N3), R2 = new Float64Array(N3), I2 = new Float64Array(N3);
        st.fill(R1, I1); st.fill(R2, I2);
        for (let i = 0; i < N3; i++) { const a = R1[i] - I2[i], b = I1[i] + R2[i]; R1[i] = a; I1[i] = b; }
        st.cur = [R1, I1]; st.axis = 0;
      } else {
        ifftAxis(st.cur[0], st.cur[1], st.axis++);
        if (st.axis === 3) { st.fields.push(st.cur[0], st.cur[1]); st.cur = null; st.axis = -1; st.pass++; }
      }
      return false;
    }
    if (st.step === 0) {                                 // normalise every field to std 0.38 (matches simplex noise statistics so thresholds carry over)
      st.fields.forEach(f => {
        let s2 = 0; for (let i = 0; i < N3; i++) s2 += f[i] * f[i];
        const k = 0.38 / Math.sqrt(s2 / N3); for (let i = 0; i < N3; i++) f[i] *= k;
      });
      st.d1 = new Uint16Array(N3 * 4); st.d2 = new Uint16Array(N3 * 4); st.z = 0; st.step = 1;
      return false;
    }
    const A = st.fields[0], B = [st.fields[1], st.fields[2], st.fields[3], st.fields[4]], d1 = st.d1, d2 = st.d2;
    const idx = (x, y, z) => ((z & 63) * N + (y & 63)) * N + (x & 63);
    for (let z = st.z, ze = Math.min(N, st.z + 16); z < ze; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y, z), o = i * 4;
      d1[o] = toHalf(A[i]);
      d1[o + 1] = toHalf((A[idx(x + 1, y, z)] - A[idx(x - 1, y, z)]) * 8);
      d1[o + 2] = toHalf((A[idx(x, y + 1, z)] - A[idx(x, y - 1, z)]) * 8);
      d1[o + 3] = toHalf((A[idx(x, y, z + 1)] - A[idx(x, y, z - 1)]) * 8);
      d2[o] = toHalf(B[0][i]); d2[o + 1] = toHalf(B[1][i]); d2[o + 2] = toHalf(B[2][i]); d2[o + 3] = toHalf(B[3][i]);
    }
    st.z += 16;
    if (st.z < N) return false;
    NOISE = { d1, d2 }; NZ_ST = null;
    return true;
  }
  function buildNoise() { while (!noiseStep()) { /* run every remaining slice */ } return NOISE; }
  let noiseTex = null, noiseGl = null, noiseHalf = null;
  function uploadHalf(g, data) { g.activeTexture(g.TEXTURE0 + 6); const t = mkNoiseTex(g, data); g.activeTexture(g.TEXTURE0); return t; }
  function mkNoiseTex(g, data) {
    const t = g.createTexture(); g.bindTexture(g.TEXTURE_3D, t);
    g.texImage3D(g.TEXTURE_3D, 0, g.RGBA16F, NZ, NZ, NZ, 0, g.RGBA, g.HALF_FLOAT, data);
    g.texParameteri(g.TEXTURE_3D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_3D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_3D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_3D, g.TEXTURE_WRAP_T, g.REPEAT); g.texParameteri(g.TEXTURE_3D, g.TEXTURE_WRAP_R, g.REPEAT);
    return t;
  }
  function ensureNoiseTex(g) {
    if (noiseTex && noiseGl === g && !g.isContextLost()) return noiseTex;
    const nz = buildNoise();
    const mk = data => mkNoiseTex(g, data);
    g.activeTexture(g.TEXTURE0 + 6);
    if (noiseHalf && noiseGl === g && !g.isContextLost()) { noiseTex = { t1: noiseHalf, t2: mk(nz.d2) }; noiseHalf = null; }   // warm() uploaded the first volume in an earlier slot
    else noiseTex = { t1: mk(nz.d1), t2: mk(nz.d2) };
    g.activeTexture(g.TEXTURE0);
    noiseGl = g;
    return noiseTex;
  }
  function bindNoise(g, pr) {
    const nt = ensureNoiseTex(g);
    g.activeTexture(g.TEXTURE0 + 6); g.bindTexture(g.TEXTURE_3D, nt.t1);
    g.activeTexture(g.TEXTURE0 + 7); g.bindTexture(g.TEXTURE_3D, nt.t2);
    g.activeTexture(g.TEXTURE0);
    pr.i1('uN1', 6); pr.i1('uN2', 7);
  }

  /* ---------------------------------------------------------------- look catalogue */
  const LOOK_NAMES = ['terran', 'jungle', 'ocean', 'arid', 'steppe', 'desert', 'minimal', 'barren', 'tundra', 'dead',
    'inferno', 'toxic', 'radiated', 'gaia', 'gasgiant', 'asteroids'];
  const LOOK_SET = {}; LOOK_NAMES.forEach(k => { LOOK_SET[k] = true; });
  const BANDS = ['jovian', 'saturn', 'ice', 'storm'];

  const PALKEYS = ['shallow', 'deep', 'beach', 'dry', 'steppe', 'grass', 'forest', 'rock', 'snow', 'seaice', 'atm', 'twi', 'cloud', 'emHi', 'emLo', 'maria'];
  const FKEYS = ['water', 'ice', 'mount', 'crater',
    'bump', 'warp', 'freq', 'dunes',
    'cover', 'cscale', 'copac', 'cwrap',
    'atm', 'atmH', 'wrap', 'spec',
    'moist', 'temp', 'river', 'sand',
    'emType', 'emAmt', 'emScale', 'city',
    'limb', 'grain', 'depthS', 'maria',
    'canyon', 'dust', 'atmEmis', 'seaIce'];
  const FDEF = {
    water: 0, ice: 1.3, mount: 0, crater: 0, bump: 0.5, warp: 0.35, freq: 0.8, dunes: 0, cover: 0, cscale: 1.3, copac: 0.9, cwrap: 0.35,
    atm: 0, atmH: 0.03, wrap: 0.12, spec: 0, moist: 0, temp: 0, river: 0, sand: 0.02, emType: 0, emAmt: 0, emScale: 2.5, city: 1,
    limb: 0, grain: 0.1, depthS: 4, maria: 0, canyon: 0, dust: 0, atmEmis: 0, seaIce: 1
  };
  const PDEF = { shallow: '#40a0b0', deep: '#0a2a60', beach: '#d8c898', dry: '#b09870', steppe: '#988850', grass: '#608040', forest: '#305830', rock: '#706860',
    snow: '#f4f6fa', seaice: '#d0e0ee', atm: '#80b0ff', twi: '#ff9a5a', cloud: '#ffffff', emHi: '#000000', emLo: '#000000', maria: '#504840' };

  // each look: p = parameter overrides (see FKEYS), pal = palette overrides (sRGB hex), vort = number of cloud cyclones
  const LOOKS = {
    terran: {
      p: { water: 0.62, ice: 0.80, mount: 1.0, bump: 0.55, warp: 0.35, freq: 0.62, cover: 0.31, cscale: 2.1, copac: 0.8, atm: 1.0, atmH: 0.03, wrap: 0.26, spec: 1.0, sand: 0.02, city: 1.0, grain: 0.12, depthS: 4.5 },
      pal: { shallow: '#3ab8c8', deep: '#0a2d68', beach: '#dccb92', dry: '#cdb177', steppe: '#9fae5c', grass: '#5a9441', forest: '#2c6a36', rock: '#7c6c5a', snow: '#f6f8fb', seaice: '#d4e6f4', atm: '#68a8ff', twi: '#ff9a5a', cloud: '#f2f5f8' }, vort: 1
    },
    jungle: {
      p: { water: 0.34, ice: 1.2, mount: 0.7, bump: 0.6, warp: 0.4, freq: 0.85, cover: 0.5, cscale: 1.9, copac: 0.93, atm: 1.0, atmH: 0.03, wrap: 0.28, spec: 0.7, moist: 0.30, temp: 0.28, river: 1.0, sand: 0.02, city: 0.9, grain: 0.16, depthS: 4.5 },
      pal: { shallow: '#34c0a8', deep: '#07405a', beach: '#cdbf7c', dry: '#a89a4e', steppe: '#6c9a3c', grass: '#2f8a3a', forest: '#145c2c', rock: '#4f6a3e', snow: '#e8f4ee', seaice: '#d6eee8', atm: '#7ae6b0', twi: '#ffc070', cloud: '#f2fff6' }, vort: 2
    },
    ocean: {
      p: { water: 0.93, ice: 0.9, mount: 0.5, bump: 0.4, warp: 0.4, freq: 1.1, cover: 0.42, cscale: 1.6, copac: 0.92, atm: 1.0, atmH: 0.032, wrap: 0.30, spec: 1.2, sand: 0.012, city: 0.6, grain: 0.1, depthS: 3.4 },
      pal: { shallow: '#3cd8d8', deep: '#06308a', beach: '#f0e2a2', dry: '#c8b878', steppe: '#8ab060', grass: '#3a9a4e', forest: '#1f6e3a', rock: '#6a7a5a', snow: '#f0f6fa', seaice: '#d8eaf6', atm: '#5eaaff', twi: '#ff9560', cloud: '#fdffff' }, vort: 3
    },
    gaia: {
      p: { water: 0.54, ice: 0.9, mount: 0.5, bump: 0.5, warp: 0.35, freq: 0.8, cover: 0.3, cscale: 1.8, copac: 0.88, atm: 1.1, atmH: 0.034, wrap: 0.3, spec: 0.9, moist: 0.22, temp: 0.2, river: 0.9, sand: 0.025, city: 1.0, grain: 0.14, depthS: 4.2, emType: 3, emAmt: 0.5, emScale: 3 },
      pal: { shallow: '#40e6d8', deep: '#0a58b8', beach: '#f4e6a6', dry: '#d8c870', steppe: '#9ad45a', grass: '#48c050', forest: '#1f9a48', rock: '#9a8f7a', snow: '#f8fcff', seaice: '#e0f4ff', atm: '#7ae6ff', twi: '#ffb878', cloud: '#ffffff', emHi: '#48ffc8', emLo: '#10a890' }, vort: 2
    },
    arid: {
      p: { water: 0, ice: 0.9, mount: 1.0, crater: 0.45, bump: 0.7, warp: 0.4, freq: 0.9, cover: 0.12, cscale: 1.6, copac: 0.5, atm: 0.55, atmH: 0.028, wrap: 0.15, moist: -0.6, temp: 0.0, canyon: 0.8, city: 0.8, grain: 0.14, depthS: 1 },
      pal: { dry: '#b5532e', steppe: '#c47a46', grass: '#7a3e2a', forest: '#4a2820', rock: '#8c5a44', snow: '#f0dcd4', beach: '#d1895a', atm: '#f09a6a', twi: '#ffb070', cloud: '#f8d8c0' }, vort: 0
    },
    steppe: {
      p: { water: 0.14, ice: 0.9, mount: 0.7, bump: 0.6, warp: 0.4, freq: 0.85, cover: 0.3, cscale: 1.4, copac: 0.85, atm: 0.7, atmH: 0.028, wrap: 0.2, spec: 0.35, moist: -0.15, temp: 0.1, river: 0.4, city: 1.0, grain: 0.14, depthS: 4 },
      pal: { shallow: '#6fb0b0', deep: '#2a5878', beach: '#d8c88a', dry: '#c7ad63', steppe: '#b2a24e', grass: '#7e9a3e', forest: '#4c7234', rock: '#8a7a5e', snow: '#f4f4f0', seaice: '#d4e4ee', atm: '#a8cfff', twi: '#ffb070', cloud: '#fafafa' }, vort: 1
    },
    desert: {
      p: { water: 0, ice: 1.3, mount: 0.9, crater: 0.15, bump: 0.8, warp: 0.4, freq: 0.8, dunes: 1.0, cover: 0.08, cscale: 1.6, copac: 0.5, atm: 0.5, atmH: 0.026, wrap: 0.16, moist: -0.55, temp: 0.2, canyon: 0.4, city: 0.8, grain: 0.14, depthS: 1 },
      pal: { dry: '#d9a85c', steppe: '#e6c07a', grass: '#c88f45', forest: '#8c5c2e', rock: '#9a6e44', snow: '#f7f0e2', beach: '#f0d8a0', atm: '#fcce90', twi: '#ffb060', cloud: '#f4e6d2' }, vort: 0
    },
    minimal: {
      p: { water: 0, ice: 1.3, mount: 0.8, crater: 0.65, bump: 0.8, warp: 0.35, freq: 0.9, cover: 0.1, cscale: 1.5, copac: 0.5, atm: 0.25, atmH: 0.022, wrap: 0.1, moist: -0.4, temp: -0.1, city: 0.9, grain: 0.14, maria: 0.4, depthS: 1 },
      pal: { dry: '#8f8678', steppe: '#a39a8a', grass: '#6d675f', forest: '#4b4741', rock: '#7f776c', snow: '#e6e8ee', beach: '#b9ad9a', atm: '#c8d2e0', twi: '#e8c0a0', cloud: '#ecedf0', maria: '#4a4540' }, vort: 0
    },
    barren: {
      p: { water: 0, ice: 1.3, mount: 0.5, crater: 1.0, bump: 0.9, warp: 0.3, freq: 1.0, cover: 0, atm: 0, wrap: 0.03, moist: -0.6, city: 0.8, grain: 0.18, maria: 1.0, limb: 0.2, depthS: 1 },
      pal: { dry: '#8c8478', steppe: '#9c9488', grass: '#7a7268', forest: '#5e5850', rock: '#a89e90', snow: '#e8e6e2', beach: '#a8a090', maria: '#4e4a46' }, vort: 0
    },
    tundra: {
      p: { water: 0.28, ice: 0.62, mount: 0.9, bump: 0.7, warp: 0.4, freq: 0.85, cover: 0.34, cscale: 1.4, copac: 0.88, atm: 0.7, atmH: 0.028, wrap: 0.2, spec: 0.35, moist: 0.0, temp: -0.45, sand: 0.01, city: 0.9, grain: 0.12, depthS: 4, seaIce: 1 },
      pal: { shallow: '#8fb4c8', deep: '#35607e', beach: '#c0c4b8', dry: '#a7a79a', steppe: '#b9bfb4', grass: '#8ea08a', forest: '#5c7a68', rock: '#7b838c', snow: '#f4f9ff', seaice: '#dceaf6', atm: '#bfe0ff', twi: '#ffc8a0', cloud: '#f6faff' }, vort: 1
    },
    dead: {
      p: { water: 0, ice: 1.3, mount: 0.5, crater: 1.0, bump: 0.9, warp: 0.3, freq: 1.1, cover: 0, atm: 0, wrap: 0.03, moist: -0.6, city: 0.8, grain: 0.2, maria: 1.0, limb: 0.25, depthS: 1 },
      pal: { dry: '#3d3a3c', steppe: '#4a4648', grass: '#34323a', forest: '#26242a', rock: '#5a5658', snow: '#a8a6aa', beach: '#44403e', maria: '#1c1b20' }, vort: 0
    },
    inferno: {
      p: { water: 0, ice: 1.3, mount: 1.1, crater: 0.2, bump: 0.8, warp: 0.4, freq: 0.9, cover: 0.34, cscale: 1.4, copac: 0.8, atm: 0.9, atmH: 0.04, wrap: 0.12, moist: -0.6, emType: 1, emAmt: 2.4, emScale: 2.2, city: 0.7, grain: 0.1, atmEmis: 0.75, depthS: 1 },
      pal: { dry: '#2a1a16', steppe: '#3a2018', grass: '#20110e', forest: '#140a08', rock: '#4a2a20', snow: '#6a5048', beach: '#2e1c16', atm: '#ff7a30', twi: '#ff5a20', cloud: '#5a4a46', emHi: '#ffd060', emLo: '#d02a06' }, vort: 2
    },
    toxic: {
      p: { water: 0.42, ice: 1.3, mount: 0.6, bump: 0.4, warp: 0.5, freq: 1.0, cover: 0.68, cscale: 1.6, copac: 0.93, atm: 1.1, atmH: 0.04, wrap: 0.34, spec: 0.5, moist: 0.0, temp: 0.0, emType: 3, emAmt: 0.9, emScale: 3.0, city: 0.7, grain: 0.12, depthS: 3.6, atmEmis: 0.2 },
      pal: { shallow: '#a6e03a', deep: '#2f6e12', beach: '#c8d86a', dry: '#6b3f86', steppe: '#8a5aa0', grass: '#4a2a60', forest: '#2f1a44', rock: '#5a4a6a', snow: '#d8d0e8', seaice: '#cfe8a0', atm: '#b070ff', twi: '#d8ff70', cloud: '#dede9c', emHi: '#b8ff3a', emLo: '#4a9a10' }, vort: 3
    },
    radiated: {
      p: { water: 0, ice: 1.3, mount: 1.0, crater: 0.3, bump: 0.8, warp: 0.4, freq: 0.9, cover: 0.14, cscale: 1.6, copac: 0.5, atm: 0.6, atmH: 0.045, wrap: 0.1, moist: -0.5, emType: 2, emAmt: 1.9, emScale: 2.2, city: 0.7, grain: 0.14, atmEmis: 0.5, depthS: 1 },
      pal: { dry: '#3a342c', steppe: '#4a443a', grass: '#2c2822', forest: '#1e1b17', rock: '#5a5246', snow: '#9a9a8a', beach: '#4a4438', atm: '#a0ff5a', twi: '#d0ff70', cloud: '#dfe8c0', emHi: '#c8ff30', emLo: '#2eaa10' }, vort: 1
    }
  };
  LOOKS.gasgiant = { gas: true, p: {}, pal: {}, vort: 0 };
  LOOKS.asteroids = { rocks: true, p: {}, pal: {}, vort: 0 };

  const SIGMA_H = 0.274, SIGMA_C = 0.232;     // std of the shader's continental / cloud fields (fbm of the 0.38-std noise, gain 0.5)
  function bakeLook(name) {
    const L = LOOKS[name] || LOOKS.barren;
    if (L.baked) return L.baked;
    const f = Object.assign({}, FDEF, L.p);
    const pal = Object.assign({}, PDEF, L.pal);
    const A = new Float32Array(64), F = new Float32Array(32);
    PALKEYS.forEach((k, i) => { const c = hexLin(pal[k]); A[i * 4] = c[0]; A[i * 4 + 1] = c[1]; A[i * 4 + 2] = c[2]; A[i * 4 + 3] = 1; });
    FKEYS.forEach((k, i) => { F[i] = f[k]; });
    L.baked = { f, A, F, pal };
    return L.baked;
  }

  /* ---- gas giants: palettes + parameters per band style */
  const GAS = {
    jovian: {
      ramp: ['#5b3a2e', '#9a5a3a', '#c98a58', '#dcc08e', '#efe5cc', '#faf6ec'], spot: '#c4482c', spot2: '#f3ead8', polar: '#6a7a98', atm: '#ffe2b4', twi: '#ff9a5a', aur: '#9a70ff', cir: '#fff6e6',
      f: { bandF: 11, turb: 1.0, streak: 0.30, shear: 0.03, spots: 3, polar: 0.5, hex: 0, contrast: 1.15, atm: 0.85, atmH: 0.028, wrap: 0.42, aur: 0.5, cirrus: 0.25, limb: 0.9 }
    },
    saturn: {
      ramp: ['#9a7d4c', '#c4a468', '#dcc088', '#ecd8a8', '#f4e8c4', '#fbf3dc'], spot: '#d8b070', spot2: '#f6efd6', polar: '#7a8aa6', atm: '#ffeabe', twi: '#ffb070', aur: '#8a7cff', cir: '#fff8e8',
      f: { bandF: 9, turb: 0.55, streak: 0.14, shear: 0.02, spots: 1, polar: 0.6, hex: 1, contrast: 0.95, atm: 0.8, atmH: 0.028, wrap: 0.44, aur: 0.35, cirrus: 0.2, limb: 0.85 }
    },
    ice: {
      ramp: ['#1f4f9a', '#2f78c0', '#4aa2d8', '#7cc8e6', '#b0e4f2', '#e4f8fc'], spot: '#0f2f6a', spot2: '#e8fbff', polar: '#2a5aa0', atm: '#8cd6ff', twi: '#a0d0ff', aur: '#60ffc8', cir: '#f0fdff',
      f: { bandF: 6, turb: 0.5, streak: 0.18, shear: 0.02, spots: 1, polar: 0.4, hex: 0, contrast: 0.9, atm: 1.0, atmH: 0.034, wrap: 0.40, aur: 0.5, cirrus: 0.55, limb: 0.5 }
    },
    storm: {
      ramp: ['#3a1e5c', '#6a3aa0', '#9a60d0', '#c490ec', '#e6c4fa', '#fff0ff'], spot: '#e0408a', spot2: '#f8e0ff', polar: '#4a2a7a', atm: '#d696ff', twi: '#ff9ae0', aur: '#60ff9a', cir: '#fff0ff',
      f: { bandF: 12, turb: 1.7, streak: 0.42, shear: 0.045, spots: 4, polar: 0.7, hex: 0, contrast: 1.2, atm: 0.95, atmH: 0.032, wrap: 0.42, aur: 0.7, cirrus: 0.3, limb: 0.9 }
    }
  };
  const GFKEYS = ['bandF', 'turb', 'streak', 'shear', 'spots', 'polar', 'hex', 'contrast', 'atm', 'atmH', 'wrap', 'aur', 'cirrus', 'limb'];
  function gasSetup(P, rnd) {
    const G = GAS[P.bands] || GAS.jovian;
    const A = new Float32Array(64), F = new Float32Array(32);
    const put = (i, hex) => { const c = hexLin(hex); A[i * 4] = c[0]; A[i * 4 + 1] = c[1]; A[i * 4 + 2] = c[2]; A[i * 4 + 3] = 1; };
    G.ramp.forEach((h, i) => put(i, h));
    put(6, G.spot); put(7, G.spot2); put(8, G.atm); put(9, G.twi); put(10, G.aur); put(11, G.cir); put(12, G.polar);
    GFKEYS.forEach((k, i) => { F[i] = G.f[k]; });
    F[0] *= 0.85 + 0.3 * P.rn[0];                // band count variety
    F[1] *= 0.8 + 0.4 * P.rn[1];
    P.A = A; P.F = F;
    // vortices: [lon, lat, rx, ry] (+ strength); the first is the "great spot"
    const n = Math.round(G.f.spots), sp = new Float32Array(16), ss = new Float32Array(4);
    for (let i = 0; i < 4; i++) {
      if (i >= n) continue;
      const south = i === 0 ? true : rnd() < 0.5;
      const lat = (south ? -1 : 1) * (i === 0 ? 0.20 + rnd() * 0.20 : 0.15 + rnd() * 0.55);
      sp[i * 4] = rnd() * TAU; sp[i * 4 + 1] = lat;
      const big = i === 0 ? 1 : 0.35 + rnd() * 0.3;
      sp[i * 4 + 2] = (0.38 + rnd() * 0.18) * big * (P.bands === 'ice' ? 0.8 : 1);
      sp[i * 4 + 3] = (0.17 + rnd() * 0.07) * big * (P.bands === 'ice' ? 0.9 : 1);
      ss[i] = (lat < 0 ? 1 : -1) * (2.2 + rnd() * 1.6) * (P.bands === 'storm' ? 1.4 : 1);
    }
    P.spots = sp; P.spotS = ss;
  }

  /* ---------------------------------------------------------------- per-planet data (cached) */
  const PCACHE = new Map();
  function randRot(out, rnd) {
    let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const a = rnd() * TAU, c = Math.cos(a), s = Math.sin(a), k = 1 - c;
    const m = [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
    for (let cc = 0; cc < 3; cc++) for (let r = 0; r < 3; r++) out[cc * 3 + r] = m[r * 3 + cc];   // column-major
  }
  function planetData(desc) {
    desc = desc || {};
    const look = LOOK_SET[desc.look] ? desc.look : 'barren';
    const bands = BANDS.indexOf(desc.bands) >= 0 ? desc.bands : 'jovian';
    const seed = seedOf(desc.seed);
    const key = look + '|' + seed + '|' + (look === 'gasgiant' ? bands : '') + '|' + (desc.rings ? 1 : 0);
    let P = PCACHE.get(key);
    if (P) { PCACHE.delete(key); PCACHE.set(key, P); return P; }
    const rnd = rng32(seed ^ 0x51ed270b), baked = bakeLook(look), L = LOOKS[look];
    P = { key, look, bands, seed, rings: !!desc.rings && look !== 'asteroids', baked, gas: !!L.gas };
    P.sd = [rnd() * 60 + 3, rnd() * 60 + 3, rnd() * 60 + 3];
    P.sd2 = [rnd() * 60 + 3, rnd() * 60 + 3, rnd() * 60 + 3];
    P.rn = [rnd(), rnd(), rnd(), rnd()];
    P.rn2 = [rnd(), rnd(), rnd(), rnd()];
    P.sr = new Float32Array(9); randRot(P.sr, rnd);
    P.roll = (rnd() - 0.5) * 0.8;
    P.elev = P.rings ? (rnd() < 0.8 ? 1 : -1) * (0.27 + rnd() * 0.15) : (rnd() - 0.32) * 0.62;
    P.phase = rnd();
    P.cphase = rnd();
    P.F = baked.F; P.A = baked.A;
    if (!P.gas && look !== 'asteroids') {
      const F = new Float32Array(baked.F), A = new Float32Array(baked.A), ix = k => FKEYS.indexOf(k), f = baked.f;
      if (f.water > 0.001) F[ix('water')] = clamp(f.water + (P.rn[0] - 0.5) * 0.12, 0.02, 0.97);
      F[ix('cover')] = clamp(f.cover * (0.8 + P.rn[1] * 0.4), 0, 0.95);
      F[ix('freq')] = f.freq * (0.88 + P.rn[2] * 0.26);
      F[ix('moist')] = f.moist + (P.rn[3] - 0.5) * 0.14;
      F[ix('temp')] = f.temp + (P.rn2[0] - 0.5) * 0.12;
      F[ix('ice')] = f.ice + (P.rn2[1] - 0.5) * 0.08;
      F[ix('water')] = f.water > 0.001 ? SIGMA_H * probit(F[ix('water')]) : -9;
      F[ix('cover')] = F[ix('cover')] > 0.001 ? SIGMA_C * probit(1 - F[ix('cover')]) : 9;
      const tintK = (kA, kB, amt) => {
        for (let c = 0; c < 3; c++) {
          const v = 1 + (P.rn2[2] - 0.5) * amt * (c === 0 ? 1.1 : c === 1 ? 0.6 : -0.9);
          A[kA * 4 + c] *= v; A[kB * 4 + c] *= v;
        }
      };
      tintK(5, 6, 0.28); tintK(3, 4, 0.2); tintK(0, 1, 0.14 * (P.rn2[3] > 0.5 ? 1 : -1));
      P.F = F; P.A = A;
    }
    P.vort = new Float32Array(12); P.vs = new Float32Array(3);
    const nv = L.vort || 0;
    for (let i = 0; i < 3; i++) {
      if (i >= nv) continue;
      const lat = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.5), lon = rnd() * TAU, cl = Math.cos(lat);
      P.vort[i * 4] = cl * Math.sin(lon); P.vort[i * 4 + 1] = Math.sin(lat); P.vort[i * 4 + 2] = cl * Math.cos(lon); P.vort[i * 4 + 3] = 0.22 + rnd() * 0.2;
      P.vs[i] = (lat < 0 ? -1 : 1) * (1.8 + rnd() * 1.8);
    }
    const style = look === 'gasgiant' ? bands : 'saturn';
    const RC = { jovian: [188, 158, 118], saturn: [214, 188, 138], ice: [172, 202, 220], storm: [160, 130, 142] }[style];
    P.ring = P.rings ? { inner: 1.30 + rnd() * 0.12, outer: 1.92 + rnd() * 0.26, seed: rnd() * 40 + 2, col: RC.map(lin), contrast: 0.9 + rnd() * 0.4 } : null;
    if (P.gas) gasSetup(P, rnd);
    PCACHE.set(key, P);
    if (PCACHE.size > 400) PCACHE.delete(PCACHE.keys().next().value);
    return P;
  }

  /* ---------------------------------------------------------------- GLSL: shared library */
  const GLSL_HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler3D;\nin vec2 vUv;\nout vec4 oCol;\n';
  const GLSL_LIB = `
#define PI 3.14159265359
#define TAU 6.28318530718
uniform sampler3D uN1;   // periodic noise, rgba = value, d/dx, d/dy, d/dz  (std 0.38)
uniform sampler3D uN2;   // four independent periodic noise values
float sst(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
vec4 hash43(vec3 p) { vec4 p4 = fract(vec4(p.xyzx) * vec4(0.1031, 0.1030, 0.0973, 0.1099)); p4 += dot(p4, p4.wzxy + 33.33); return fract((p4.xxyz + p4.yzzw) * p4.zywx); }

vec4 nz(vec3 p) { return textureLod(uN1, p * 0.25, 0.0); }
vec4 nzV(vec3 p) { return textureLod(uN2, p * 0.25, 0.0); }
float snoise(vec3 p) { return textureLod(uN1, p * 0.25, 0.0).x; }

const mat3 ROT3 = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
const mat3 ROT3T = mat3(0.00, -0.80, -0.60, 0.80, 0.36, -0.48, 0.60, -0.48, 0.64);

// fractional-octave fbm (smooth LOD): value std ~0.22
float fbm(vec3 p, float oct) {
  float a = 0.5, s = 0.0;
  int n = int(ceil(oct));
  for (int i = 0; i < n; i++) {
    float w = clamp(oct - float(i), 0.0, 1.0);
    s += a * w * snoise(p);
    p = ROT3 * p * 2.0 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
// fbm with analytic gradient wrt p (higher octaves contribute less slope: 'gdec' per-octave decay; 'gain' = amplitude ratio) -> (value, dx, dy, dz)
vec4 fbmG(vec3 p, float oct, float gdec, float gain) {
  float a = 0.5, s = 0.0, gk = 1.0;
  vec3 gr = vec3(0.0);
  mat3 J = mat3(1.0);
  int n = int(ceil(oct));
  for (int i = 0; i < n; i++) {
    float w = clamp(oct - float(i), 0.0, 1.0);
    vec4 d = nz(p);
    s += a * w * d.x;
    gr += a * w * gk * (J * d.yzw);
    p = ROT3 * p * 2.0 + vec3(1.7, 9.2, 3.1);
    J = (2.0 * ROT3T) * J;
    a *= gain; gk *= gdec;
  }
  return vec4(s, gr);
}
vec4 fbmD(vec3 p, float oct, float gdec) { return fbmG(p, oct, gdec, 0.5); }
// ridged multifractal-ish: (value ~0..1, gradient)
vec4 ridgedD(vec3 p, float oct, float gdec) {
  float a = 0.5, s = 0.0, gk = 1.0;
  vec3 gr = vec3(0.0);
  mat3 J = mat3(1.0);
  int n = int(ceil(oct));
  for (int i = 0; i < n; i++) {
    float w = clamp(oct - float(i), 0.0, 1.0);
    vec4 d = nz(p);
    float v = max(1.0 - abs(d.x) * 1.9, 0.0);
    s += a * w * v * v;
    gr += a * w * gk * 2.0 * v * (-sign(d.x) * 1.9) * (J * d.yzw);
    p = ROT3 * p * 2.0 + vec3(5.3, 1.9, 8.1);
    J = (2.0 * ROT3T) * J;
    a *= 0.5; gk *= gdec;
  }
  return vec4(s, gr);
}
vec3 rotAbout(vec3 p, vec3 k, float ang) {
  float c = cos(ang), s = sin(ang);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}

// ---- colour pipeline: filmic tone map + gamma, premultiplied output helpers
vec3 grade(vec3 c) {
  c = max(c, 0.0);
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, 1.10);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
vec4 glowOut(vec3 I) { vec3 d = grade(I); float a = clamp(max(d.r, max(d.g, d.b)), 0.0, 1.0); return vec4(d, a); }
vec4 over(vec4 t, vec4 b) { return t + b * (1.0 - t.a); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
uniform vec2 uVo;        // viewport origin inside the full render region (px): keeps the dither pattern the same when only part of a region is shaded
vec4 finalize(vec4 c) {
  if (c.a > 0.0) {
    float dn = (ign(gl_FragCoord.xy + uVo) - 0.5) / 255.0;
    c.a = clamp(c.a + dn, 0.0, 1.0);
    c.rgb = min(max(c.rgb + dn, 0.0), c.a);
  }
  return c;
}

// ---- impact craters: gradient + albedo modulation only (scale-invariant slopes).  8 candidate cells around the nearest corner.
vec3 craterLayer(vec3 P, float freq, float seed, float dens, out float alb) {
  vec3 p = P * freq + seed;
  vec3 cell0 = floor(p), f = p - cell0;
  vec3 sg = vec3(f.x > 0.5 ? 1.0 : -1.0, f.y > 0.5 ? 1.0 : -1.0, f.z > 0.5 ? 1.0 : -1.0);
  vec3 grad = vec3(0.0);
  alb = 0.0;
  for (int k = 0; k < 8; k++) {
    vec3 off = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)) * sg;
    vec3 c = cell0 + off;
    vec4 hs = hash43(c);
    if (hs.w > dens) continue;
    float rad = 0.15 + 0.14 * hash13(c + 7.7);
    vec3 dv = p - (c + 0.15 + 0.7 * hs.xyz);
    float dist = length(dv);
    float d = dist / rad;
    if (d > 1.8) continue;
    float win = 1.0 - sst(1.25, 1.8, d);
    float dbowl = d < 1.0 ? 2.0 * d : 0.0;
    float rim = exp(-pow((d - 1.0) * 4.5, 2.0));
    float drim = rim * (-2.0 * (d - 1.0) * 20.25);
    float dh = (0.55 * dbowl + 0.42 * drim) * win;
    grad += dh * dv / max(dist, 1e-4);
    float inside = d < 1.0 ? 1.0 - d * d : 0.0;
    alb += (-0.30 * inside + 0.10 * rim) * win;
  }
  return grad;
}
`;

  /* shared uniforms + ring code (needs uC, uAxis, uL, uSun) */
  const GLSL_RING = `
uniform vec4 uRing;     // x inner, y outer (planet radii; y == 0: no rings), z opacity, w seed
uniform vec4 uRingC;    // rgb tint (linear), w ringlet contrast
float ringDensity(float t, float lod) {
  float sd = uRing.w;
  float gapT = 0.50 + 0.16 * fract(sd * 0.37);
  float base = 0.30 + 0.70 * sst(0.10, 0.34, t);
  base *= 1.0 - 0.93 * sst(0.045, 0.0, abs(t - gapT));
  base *= 1.0 - 0.55 * sst(0.028, 0.0, abs(t - gapT * 0.56));
  float n1 = nz(vec3(t * 2.7, sd, 3.1)).x;
  float n2 = nz(vec3(t * 10.0, sd + 7.3, 1.7)).x * lod;
  float n3 = nz(vec3(t * 37.0, sd + 2.9, 9.3)).x * lod * lod;
  float d = base * clamp(0.64 + uRingC.w * (0.9 * n1 + 0.6 * n2 + 0.35 * n3), 0.0, 1.0);
  return d * sst(0.0, 0.03, t) * sst(1.0, 0.965, t);
}
// shadow cast by the rings on a sphere point S (view space, |S| = 1): 1 = lit
float ringShadowOn(vec3 S) {
  float al = dot(uAxis, uL);
  if (abs(al) < 0.02) return 1.0;
  float t = -dot(uAxis, S) / al;
  if (t < 0.0) return 1.0;
  vec3 X = S + uL * t;
  float tt = (length(X) - uRing.x) / (uRing.y - uRing.x);
  if (tt <= 0.0 || tt >= 1.0) return 1.0;
  return 1.0 - 0.88 * ringDensity(tt, 0.6) * uRing.z;
}
// ring layer for pixel q (planet radii): premultiplied display rgba; 'front' tells whether it is in front of the planet disc
vec4 ringLayer(vec2 q, float r2, float pxw, out bool front) {
  front = false;
  float rz = -(uAxis.x * q.x + uAxis.y * q.y) / uAxis.z;
  vec3 X = vec3(q, rz);
  float t = (length(X) - uRing.x) / (uRing.y - uRing.x);
  if (t < -0.03 || t > 1.03) return vec4(0.0);
  float ringPx = (uRing.y - uRing.x) * uC.z * abs(uAxis.z);
  float lod = clamp(ringPx / 38.0, 0.0, 1.0);
  float dens = ringDensity(clamp(t, 0.0, 1.0), lod) * uRing.z;
  dens *= sst(-0.03, 0.01, t) * sst(1.03, 0.99, t);
  if (dens < 0.003) return vec4(0.0);
  float ndl = dot(uAxis, uL);
  float side = (ndl * uAxis.z) >= 0.0 ? 1.0 : -1.0;
  float lit = side > 0.0 ? mix(0.38, 1.0, sst(0.0, 0.45, abs(ndl))) : mix(0.06, 0.30, 1.0 - dens);
  float b = dot(X, uL), shadow = 1.0;
  if (b < 0.0) shadow = sst(0.97, 1.03, sqrt(max(dot(X, X) - b * b, 0.0)));
  float cv = 0.5 + nz(vec3(t * 5.5, uRing.w * 1.7, 4.4)).x * 1.5;
  vec3 rc = uRingC.rgb * mix(0.72, 1.18, clamp(cv, 0.0, 1.0));
  vec3 lc = rc * (uSun * lit * (0.10 + 0.90 * shadow) + vec3(0.012, 0.014, 0.022));
  front = (r2 >= 1.0) || (rz > sqrt(max(1.0 - r2, 0.0)));
  float a = clamp(dens, 0.0, 0.97);
  return vec4(grade(lc) * a, a);
}
`;

  const GLSL_PLANET_UNI = `
uniform vec3 uC;        // x,y: disc centre (px, GL coords), z: radius px
uniform mat3 uRotS;     // view -> object (surface)
uniform mat3 uRotC;     // view -> object (cloud layer)
uniform mat3 uSR;       // per-planet noise-space rotation
uniform vec3 uAxis;     // spin axis, view space
uniform vec3 uL;        // light direction (toward the star), view space
uniform vec3 uSun;      // light colour * intensity (linear)
uniform vec3 uSd;
uniform vec3 uSd2;
uniform vec4 uRn;
uniform vec4 uLod;      // x terrain octaves, y cloud octaves, z crater scales, w city grain frequency
uniform vec4 uFlg;      // x clouds, y atmosphere, z lights, w time (s, wrapped)
uniform vec4 uQ;        // x cloud-shadow strength, y cloud shadow offset, z bump scale, w unused
uniform vec4 uA[16];
uniform vec4 uF[8];
`;

  /* ---------------------------------------------------------------- GLSL: rocky planets (all solid looks) */
  const GLSL_ROCKY = GLSL_PLANET_UNI + `
uniform vec3 uCity;
uniform vec4 uVort[3];
uniform vec3 uVs;
` + GLSL_RING + `
#define P_SHALLOW uA[0].rgb
#define P_DEEP    uA[1].rgb
#define P_BEACH   uA[2].rgb
#define P_DRY     uA[3].rgb
#define P_STEPPE  uA[4].rgb
#define P_GRASS   uA[5].rgb
#define P_FOREST  uA[6].rgb
#define P_ROCK    uA[7].rgb
#define P_SNOW    uA[8].rgb
#define P_SEAICE  uA[9].rgb
#define P_ATM     uA[10].rgb
#define P_TWI     uA[11].rgb
#define P_CLOUD   uA[12].rgb
#define P_EMHI    uA[13].rgb
#define P_EMLO    uA[14].rgb
#define P_MARIA   uA[15].rgb
#define SEA     uF[0].x
#define ICELAT  uF[0].y
#define MOUNT   uF[0].z
#define CRATER  uF[0].w
#define BUMP    uF[1].x
#define WARPA   uF[1].y
#define CFREQ   uF[1].z
#define DUNES   uF[1].w
#define CTHR    uF[2].x
#define CSCALE  uF[2].y
#define COPAC   uF[2].z
#define CWRAP   uF[2].w
#define ATMS    uF[3].x
#define ATMH    uF[3].y
#define WRAP    uF[3].z
#define SPEC    uF[3].w
#define MOIST   uF[4].x
#define TEMP    uF[4].y
#define RIVER   uF[4].z
#define SANDW   uF[4].w
#define EMTYPE  uF[5].x
#define EMAMT   uF[5].y
#define EMSCALE uF[5].z
#define CITYD   uF[5].w
#define LIMB    uF[6].x
#define GRAIN   uF[6].y
#define DEPTHS  uF[6].z
#define MARIA   uF[6].w
#define CANYON  uF[7].x
#define ATMEMIS uF[7].z
#define SEAICEW uF[7].w

struct Sf { vec3 alb; float water; float land; float icem; vec3 relG; vec3 emi; float emiNight; float lat; float el; };

Sf surfaceAt(vec3 P, float pxw, float limbLod) {
  Sf s;
  s.emi = vec3(0.0); s.emiNight = 0.0; s.icem = 0.0;
  float oct = max(uLod.x - limbLod, 2.0);
  float lat = abs(P.y);
  s.lat = lat;
  float tt = uFlg.w;
  vec3 Pn = uSR * P;
  vec3 relN = vec3(0.0);     // relief gradient in noise space
  vec3 relP = vec3(0.0);     // relief gradient in object space

  // ---- continental height field: domain-warped fbm
  vec3 wv = nzV(Pn * 1.1 + uSd).xyz;
  vec4 hd = fbmD((Pn + wv * WARPA) * CFREQ + uSd2, oct, 0.6);
  float h = hd.x * 1.25;
  vec3 gH = hd.yzw * (CFREQ * 1.25);
  float e = h - SEA;
  float fw = length(gH) * pxw * 1.2 + 0.0012;
  float landM = sst(-fw, fw, e);
  float el = SEA < -5.0 ? clamp(0.5 + h * 1.8, 0.0, 1.0) : clamp(e * 2.4, 0.0, 1.0);
  s.land = landM; s.el = el;
  relN += gH * 0.45;

  float mn = fbm(Pn * 1.7 + uSd2.yzx, min(oct, 3.5));
  float gr = fbm(Pn * 9.0 + uSd, max(min(oct - 2.0, 3.0), 1.0));

  // ---- land colour: moisture / temperature biome grading
  float moist = clamp(0.5 + MOIST + 1.3 * mn + 0.20 * exp(-lat * lat / 0.045) - 0.28 * exp(-pow((lat - 0.33) / 0.15, 2.0)), 0.0, 1.0);
  float temp = 1.0 - pow(lat, 1.7) * 1.28 - el * 0.45 + TEMP + 0.12 * mn;
  vec3 c = mix(P_DRY, P_STEPPE, sst(0.20, 0.45, moist));
  c = mix(c, P_GRASS, sst(0.40, 0.62, moist));
  c = mix(c, P_FOREST, sst(0.60, 0.88, moist) * sst(0.25, 0.60, temp));
  float cold = sst(0.40, 0.10, temp);
  c = mix(c, mix(P_ROCK, P_STEPPE, 0.4), cold * 0.55);
  c *= 1.0 + GRAIN * 2.2 * gr;

  if (MARIA > 0.0) {
    float mm = fbm(Pn * 1.3 + uSd2.zxy * 0.7, min(oct, 3.5));
    c = mix(c, P_MARIA, sst(0.02, -0.12, mm) * MARIA);
  }

  // ---- mountains
  float mt = 0.0;
  if (MOUNT > 0.0) {
    vec4 rd = ridgedD(Pn * 1.9 + uSd2.zxy, min(oct, 4.5), 0.6);
    float mscore = el + (rd.x - 0.40) * 0.9 * MOUNT;
    mt = sst(0.22, 0.62, mscore) * landM;
    c = mix(c, mix(P_ROCK * 0.85, P_ROCK * 1.3, sst(0.3, 0.9, el)), mt);
    float snowm = sst(0.72, 0.95, mscore + 0.25 * (0.5 - temp)) * landM;
    c = mix(c, P_SNOW, snowm * sst(0.45, 0.2, temp + 0.35));
    relN += rd.yzw * 1.9 * 0.35 * MOUNT * (0.3 + 0.7 * mt);
  }

  // ---- dunes / canyons / craters
  if (DUNES > 0.0) {
    vec4 dn = nz(vec3(P.x * 4.0, P.y * 30.0, P.z * 4.0) + uSd + wv * 2.0);
    c *= 1.0 + 0.16 * DUNES * dn.x * 2.0;
    relP += vec3(dn.y * 4.0, dn.z * 30.0, dn.w * 4.0) * 0.05 * DUNES;
  }
  if (CANYON > 0.0) {
    float cn = snoise((Pn + wv * 0.25) * 1.6 + uSd2);
    float cw = 1.0 - sst(0.0, 0.05 + 1.4 * pxw * 1.6, abs(cn));
    cw *= landM * sst(0.1, 0.4, el + 0.15);
    c *= 1.0 - 0.45 * CANYON * cw;
  }
  if (CRATER > 0.0) {
    float calb = 0.0;
    for (int k = 0; k < 4; k++) {
      if (float(k) >= uLod.z) break;
      float fq = 3.0 * pow(2.3, float(k));
      float al;
      vec3 cg = craterLayer(Pn, fq, uSd.x * 7.0 + float(k) * 17.0, 0.55 * CRATER, al);
      relN += cg * (0.85 - 0.12 * float(k));
      calb += al;
    }
    c *= 1.0 + calb * CRATER * 1.3;
  }

  // ---- beach
  float bm = (1.0 - sst(0.0, SANDW * 2.4 + fw, e)) * landM;
  c = mix(c, P_BEACH, bm * 0.9);

  // ---- ocean
  float dep = clamp(-e * DEPTHS, 0.0, 1.0);
  vec3 wc = mix(P_SHALLOW, P_DEEP, pow(dep, 0.5));
  wc *= 1.0 + 0.12 * fbm(Pn * 4.5 + uSd.yzx, 2.5);

  // ---- polar caps (snow on land, pack ice on water)
  float iceE = ICELAT + 0.45 * fbm(Pn * 2.1 + uSd2, 3.0) - 0.05 * el;
  float icem = sst(iceE, iceE + 0.05 + 2.0 * fw, lat);
  s.icem = icem;
  wc = mix(wc, P_SEAICE * (0.92 + 0.08 * gr), icem * SEAICEW);
  c = mix(c, P_SNOW, icem);

  // ---- rivers (inland, humid)
  if (RIVER > 0.0) {
    float rv = snoise((Pn + wv * 0.2) * 2.4 + uSd2.yzx);
    float rw = (1.0 - sst(0.0, 0.022 + 1.3 * pxw * 2.4, abs(rv))) * landM * sst(0.45, 0.05, el) * RIVER * sst(0.35, 0.6, moist);
    c = mix(c, P_SHALLOW * 0.8, rw * 0.9);
  }

  s.alb = mix(wc, c, landM);
  s.water = (1.0 - landM) * (1.0 - icem * SEAICEW * 0.85);
  s.relG = (relN * uSR + relP) * landM;

  // ---- emissive: lava cracks / radioactive veins / bioluminescent seas
  s.emi = vec3(0.0);
  if (EMTYPE > 0.5) {
    if (EMTYPE < 1.5) {
      vec3 lq = (Pn + wv * 0.12) * EMSCALE + uSd2.zxy;
      vec4 d1 = fbmD(lq, min(oct, 4.5), 0.6);
      float n2 = fbm(lq * 2.9 + 11.0, min(oct, 3.5));
      float w1 = 0.04 + 1.5 * length(d1.yzw) * EMSCALE * pxw;
      float crack = 1.0 - sst(0.0, w1, abs(d1.x));
      float crack2 = (1.0 - sst(0.0, 0.03 + w1 * 0.6, abs(n2))) * 0.65;
      float pool = sst(-0.22, -0.40, h);
      float heat = clamp(max(crack, crack2) + pool, 0.0, 1.0);
      float flick = 0.84 + 0.16 * sin(tt * 1.3 + n2 * 9.0 + d1.x * 6.0);
      float hot = heat * flick;
      float glowW = sst(0.0, 0.22, 0.22 - abs(d1.x)) * 0.35;
      s.emi = mix(P_EMLO, P_EMHI, pow(hot, 1.7)) * (hot * hot + glowW * 0.5) * EMAMT;
      s.alb *= 1.0 - 0.75 * clamp(crack + pool, 0.0, 1.0);
    } else if (EMTYPE < 2.5) {
      float n1 = fbm(Pn * EMSCALE + uSd2, 3.5);
      float n2 = fbm(Pn * EMSCALE * 3.1 + uSd, 2.5);
      float patch0 = sst(0.04, 0.26, n1 + 0.25 * n2);
      float vein = (1.0 - sst(0.0, 0.05 + 2.0 * pxw * EMSCALE, abs(n2))) * sst(-0.1, 0.2, n1);
      float hot = clamp(patch0 * 0.9 + vein * 0.5, 0.0, 1.0) * (0.82 + 0.18 * sin(tt * 0.9 + n1 * 7.0));
      s.emi = mix(P_EMLO, P_EMHI, hot) * hot * hot * EMAMT * landM;
    } else {
      float n1 = fbm(Pn * EMSCALE + uSd2, 2.5);
      float bio = sst(0.0, 0.3, n1) * (1.0 - landM) * (1.0 - icem);
      s.emi = P_EMHI * bio * EMAMT * (0.78 + 0.22 * sin(tt * 0.8 + n1 * 10.0));
      s.emiNight = 1.0;
    }
  }
  return s;
}

// ---- cloud layer: swirl vortices + domain warp + zonal stretch; returns (density, gradient wrt direction)
// Weather: the warp fields are sampled along a slow bounded wander through noise space (tw) and the cyclones breathe, so banks stretch,
// curl and break up over tens of seconds instead of riding the planet as a fixed decal. The wander's frequencies are multiples of
// 2*pi/4096 so it is continuous where uFlg.w (t mod 4096) wraps. The shadow lookup calls the same function at the same time.
vec4 cloudField(vec3 Pc, float oct, bool full) {
  float tt = uFlg.w;
  vec3 p = Pc;
  for (int i = 0; i < 3; i++) {
    float f = uVs[i];
    if (f == 0.0) continue;
    vec4 v = uVort[i];
    float d = acos(clamp(dot(p, v.xyz), -1.0, 1.0));
    p = rotAbout(p, v.xyz, f * (1.0 + 0.22 * sin(tt * 0.006136 + float(i) * 2.1)) * exp(-(d * d) / (v.w * v.w)));
  }
  vec3 sc = vec3(CSCALE, CSCALE * 1.3, CSCALE);
  vec3 q = p;
  if (full) {
    vec3 tw = vec3(sin(tt * 0.003068), cos(tt * 0.004602), sin(tt * 0.003068 + 2.1)) * 0.8;
    q += nzV(p * 0.85 + uSd2 + tw).xyz * 0.24;
    q += nzV(q * 2.1 + uSd - tw * 0.6).xyz * 0.07;
  }
  vec4 d = fbmG(q * sc + uSd.yzx, oct, 0.55, 0.58);
  d.yzw *= sc;
  return d;
}

vec3 cityLights(vec3 Pn, float lat, float el) {
  float m = fbm(Pn * 2.0 + uSd2, 2.5) * 1.5 + 0.5 * snoise(Pn * 5.1 + uSd.yzx);
  float dens = sst(0.04, 0.38, m);
  if (dens < 0.01) return vec3(0.0);
  float f = uLod.w;
  float g1 = snoise(Pn * f * 0.25 + uSd);
  float g2 = snoise(Pn * f * 0.57 + uSd2);
  float dots = sst(0.26, 0.55, g1 * 0.65 + g2 * 0.35);
  float web = 1.0 - sst(0.0, 0.07, abs(snoise(Pn * f * 0.11 + uSd2.zxy)));
  float I = dens * (dots * 0.95 + web * 0.35 * dens);
  I *= (1.0 - sst(0.62, 0.92, lat)) * (1.0 - sst(0.35, 0.8, el));
  return uCity * I;
}

vec3 atmColor(float sd) {
  float tw = exp(-pow((sd - 0.03) / 0.24, 2.0));
  return mix(P_ATM, P_TWI, tw * 0.75);
}
float atmLight(float sd) { return 0.12 + 0.88 * sst(-0.30, 0.55, sd); }

vec3 shadeDisc(vec3 n, float pxw) {
  float tt = uFlg.w;
  vec3 P = uRotS * n;
  float ndl = dot(n, uL);
  float limbLod = log2(1.0 / max(n.z, 0.2));
  Sf s = surfaceAt(P, pxw, limbLod);

  // relief: analytic gradient -> tangent plane -> view space -> perturbed normal
  vec3 G = s.relG;
  vec3 gt = G - P * dot(G, P);
  vec3 gv = gt * uRotS;
  vec3 nn = normalize(n - BUMP * uQ.z * gv);
  float ndb = dot(nn, uL);

  float rs = (uRing.y > 0.0) ? ringShadowOn(n) : 1.0;

  // ---- clouds
  float ca = 0.0;
  vec3 ccol = vec3(0.0);
  float shadowF = 1.0;
  if (uFlg.x > 0.5 && CTHR < 8.0) {
    vec3 Pc = uRotC * n;
    float coct = max(uLod.y - limbLod, 2.0);
    vec4 cd = cloudField(Pc, coct, true);
    float soft = 0.05;
    float dens = sst(CTHR - soft, CTHR + soft * 3.2, cd.x);
    ca = dens * COPAC;
    if (ca > 0.002) {
      vec3 gct = cd.yzw - Pc * dot(cd.yzw, Pc);
      vec3 nc = normalize(n - 0.16 * (gct * uRotC));
      float dc = clamp((dot(nc, uL) + CWRAP) / (1.0 + CWRAP), 0.0, 1.0);
      float thick = sst(CTHR, CTHR + 0.45, cd.x);
      ccol = P_CLOUD * (uSun * dc * mix(1.0, 0.72, thick * thick) * rs + vec3(0.016, 0.02, 0.034));
    }
    if (uQ.x > 0.0 && ndl > -0.1) {
      vec3 Lt = uL - n * ndl;
      vec3 ns = normalize(n + Lt * uQ.y);
      float dsh = cloudField(uRotC * ns, max(coct - 1.5, 2.5), true).x;
      shadowF = 1.0 - uQ.x * sst(CTHR - soft, CTHR + soft * 3.2, dsh) * COPAC;
    }
  }

  // ---- surface lighting
  float dif = clamp((ndb + WRAP) / (1.0 + WRAP), 0.0, 1.0);
  dif = dif * dif * (3.0 - 2.0 * dif) * 0.5 + dif * 0.5;
  vec3 amb = vec3(0.010, 0.013, 0.024) * (1.0 + 2.0 * ATMS);
  vec3 col = s.alb * (uSun * dif * rs * shadowF + amb);

  // specular glint on water / ice, fresnel sky reflection
  vec3 Hh = normalize(uL + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, Hh), 0.0);
  float sheen = (pow(nh, 420.0) * 1.5 + pow(nh, 36.0) * 0.12) * SPEC * s.water;
  float fresW = 0.03 + 0.97 * pow(1.0 - n.z, 5.0);
  col += uSun * sheen * dif * rs * (0.75 + 0.25 * snoise(uSR * P * 60.0 + tt * 0.2)) * sst(-0.02, 0.1, ndl);
  col += P_ATM * fresW * 0.55 * s.water * ATMS * (0.1 + 0.9 * sst(-0.2, 0.5, ndl)) * dif;

  // limb darkening for airless bodies
  col *= 1.0 - LIMB * pow(1.0 - n.z, 1.5);

  // emissive (lava / glow patches), city lights on the night side
  float nightF = sst(0.10, -0.12, ndl);
  col += s.emi * mix(1.0, nightF, s.emiNight);
  if (uFlg.z > 0.5 && CITYD > 0.0 && uCity.x > 0.0 && s.land > 0.5 && s.icem < 0.6) {
    if (nightF > 0.01) col += cityLights(uSR * P, s.lat, s.el) * CITYD * 2.6 * nightF * (1.0 - ca * 0.85);
  }

  // clouds over the surface
  col = mix(col, ccol, ca);

  // ---- atmosphere in-scatter / aerial perspective
  if (uFlg.y > 0.5 && ATMS > 0.0) {
    float fres = pow(1.0 - n.z, 2.8);
    float haze = clamp(ATMS * (0.03 + 0.80 * fres), 0.0, 0.97);
    vec3 ar = atmColor(ndl) * atmLight(ndl) * (uSun * 0.78);
    ar = mix(ar, P_ATM * 0.55 * (uSun * 0.78), ATMEMIS);
    col = mix(col, ar, haze) + ar * 0.10 * fres * ATMS;
  }
  return col;
}

void main() {
  vec2 q = (gl_FragCoord.xy - uC.xy) / uC.z;
  float r2 = dot(q, q);
  float rr = sqrt(r2);
  float pxw = 1.0 / uC.z;
  vec4 base = vec4(0.0);

  if (rr >= 1.0 && uFlg.y > 0.5 && ATMS > 0.0) {
    float h = rr - 1.0;
    float H = ATMH;
    if (h < H * 7.0) {
      vec2 m = q / rr;
      float sd = dot(vec3(m, 0.0), uL);
      vec3 ar = atmColor(sd) * atmLight(sd) * (uSun * 0.78);
      ar = mix(ar, P_ATM * 0.55 * (uSun * 0.78), ATMEMIS);
      float peak = clamp(ATMS * 0.80, 0.0, 0.97);
      float prof = exp(-h / H) * (1.0 - sst(H * 3.5, H * 7.0, h));
      base = glowOut(ar * peak * prof);
    }
  }
  if (rr < 1.0 + 1.5 * pxw) {
    vec2 qq = rr > 0.9995 ? q * (0.9995 / rr) : q;
    float zz = sqrt(max(1.0 - dot(qq, qq), 0.0));
    vec3 col = shadeDisc(vec3(qq, zz), pxw);
    float edge = clamp((1.0 - rr) / pxw + 0.5, 0.0, 1.0);
    base = over(vec4(grade(col) * edge, edge), base);
  }
  vec4 res = base;
  if (uRing.y > 0.0) {
    bool front;
    vec4 rl = ringLayer(q, r2, pxw, front);
    res = front ? over(rl, base) : over(base, rl);
  }
  oCol = finalize(res);
}
`;

  /* ---------------------------------------------------------------- GLSL: gas giants */
  const GLSL_GAS = GLSL_PLANET_UNI + `
uniform vec4 uSp[4];     // vortices: lon, lat, rx, ry
uniform vec4 uSpS;       // vortex swirl strengths
` + GLSL_RING + `
#define G_BANDF   uF[0].x
#define G_TURB    uF[0].y
#define G_STREAK  uF[0].z
#define G_SHEAR   uF[0].w
#define G_NSP     uF[1].x
#define G_POLAR   uF[1].y
#define G_HEX     uF[1].z
#define G_CONTR   uF[1].w
#define G_ATM     uF[2].x
#define G_ATMH    uF[2].y
#define G_WRAP    uF[2].z
#define G_AUR     uF[2].w
#define G_CIRRUS  uF[3].x
#define G_LIMB    uF[3].y

vec3 ramp6(float x) {
  float f = clamp(x, 0.0, 1.0) * 5.0;
  int i = int(min(floor(f), 4.0));
  float t = f - float(i);
  t = t * t * (3.0 - 2.0 * t);
  return mix(uA[i].rgb, uA[i + 1].rgb, t);
}

vec3 gasSurface(vec3 P, float pxw, float limbLod, out float cirrus) {
  float oct = max(uLod.x - limbLod, 2.0);
  float tt = uFlg.w;
  vec3 Q = P;
  vec4 spotAcc = vec4(0.0);
  float rimAcc = 0.0;
  int ns = int(G_NSP + 0.5);
  float lonP = atan(P.x, P.z);
  float latP = asin(clamp(P.y, -1.0, 1.0));
  float cosLat = sqrt(max(1.0 - P.y * P.y, 0.0));
  for (int i = 0; i < 4; i++) {
    if (i >= ns) break;
    vec4 sp = uSp[i];
    float cl = cos(sp.y);
    vec3 C = vec3(cl * sin(sp.x), sin(sp.y), cl * cos(sp.x));
    float dlon = atan(sin(lonP - sp.x), cos(lonP - sp.x));
    vec2 dd = vec2(dlon * cosLat / sp.z, (latP - sp.y) / sp.w);
    float r2s = dot(dd, dd);
    Q = rotAbout(Q, C, uSpS[i] * exp(-r2s * 0.9));
    float r = sqrt(r2s);
    float a = sst(1.0, 0.5, r) * 0.9;
    vec3 scol = uA[6 + (i & 1)].rgb;
    spotAcc.rgb = mix(spotAcc.rgb, scol, a);
    spotAcc.a = max(spotAcc.a, a);
    rimAcc = max(rimAcc, exp(-pow((r - 1.0) / 0.2, 2.0)));
  }
  float y = Q.y;
  // two-phase flow-map so the differential rotation never winds up without bound
  float T = 26.0, ph = fract(tt / T);
  float tA = ph * T, tB = fract(ph + 0.5) * T, wA = 1.0 - abs(2.0 * ph - 1.0);
  float wind = 0.6 * sin(y * 7.0 + uRn.x * 6.28) + 0.4 * sin(y * 13.0 + uRn.y * 6.28);
  float angA = tA * G_SHEAR * wind, angB = tB * G_SHEAR * wind;
  vec3 WA = vec3(cos(angA) * Q.x + sin(angA) * Q.z, y, -sin(angA) * Q.x + cos(angA) * Q.z);
  vec3 WB = vec3(cos(angB) * Q.x + sin(angB) * Q.z, y, -sin(angB) * Q.x + cos(angB) * Q.z);
  float o1 = min(oct, 4.5), o2 = min(oct, 3.5);
  float tbA = fbm(vec3(WA.x * 1.6, y * 5.0, WA.z * 1.6) + uSd, o1) + 0.4 * fbm(vec3(WA.x * 4.4, y * 17.0, WA.z * 4.4) + uSd2, o2);
  float tbB = fbm(vec3(WB.x * 1.6, y * 5.0, WB.z * 1.6) + uSd, o1) + 0.4 * fbm(vec3(WB.x * 4.4, y * 17.0, WB.z * 4.4) + uSd2, o2);
  float tb = mix(tbB, tbA, wA);
  float bc = y * G_BANDF + G_TURB * tb * 2.2;
  float bv = 0.5 + 0.5 * (0.52 * sin(bc) + 0.30 * sin(bc * 2.17 + 1.3 + uRn.z * 6.28) + 0.18 * sin(bc * 3.9 + 4.1));
  float st = fbm(vec3(Q.x * 2.2, y * 40.0, Q.z * 2.2) + uSd.yzx, min(oct, 4.0));
  bv = clamp(bv + G_STREAK * st * 1.6, 0.0, 1.0);
  bv = clamp(0.5 + (bv - 0.5) * G_CONTR, 0.0, 1.0);
  vec3 c = ramp6(bv);
  // polar hood and (optionally) a hexagonal polar jet
  float ay = abs(P.y);
  float polar = sst(0.70, 0.97, ay) * G_POLAR;
  c = mix(c, uA[12].rgb, polar);
  if (G_HEX > 0.5 && P.y > 0.8) {
    float pd = acos(clamp(P.y, -1.0, 1.0));
    float ang = atan(P.x, P.z);
    float k = mod(ang + 0.2, PI / 3.0) - PI / 6.0;
    float hexR = 0.34 * cos(PI / 6.0) / cos(k);
    float inside = sst(hexR + 0.012, hexR - 0.012, pd);
    c = mix(c, uA[12].rgb * 0.8, inside * 0.7);
  }
  // cirrus streaks
  cirrus = 0.0;
  if (G_CIRRUS > 0.0) {
    float ci = fbm(vec3(Q.x * 1.8, y * 26.0, Q.z * 1.8) + uSd2.yzx, min(oct, 3.5));
    cirrus = sst(0.10, 0.32, ci) * G_CIRRUS * (0.4 + 0.6 * sst(0.2, 0.0, abs(y - 0.1)));
    c = mix(c, uA[11].rgb, cirrus * 0.6);
  }
  c = mix(c, spotAcc.rgb, spotAcc.a);
  c = mix(c, uA[7].rgb, rimAcc * 0.18);
  return c;
}

vec3 shadeGas(vec3 n, float pxw) {
  float tt = uFlg.w;
  vec3 P = uRotS * n;
  float ndl = dot(n, uL);
  float limbLod = log2(1.0 / max(n.z, 0.2));
  float cirrus;
  vec3 alb = gasSurface(P, pxw, limbLod, cirrus);
  float rs = (uRing.y > 0.0) ? ringShadowOn(n) : 1.0;
  float dif = clamp((ndl + G_WRAP) / (1.0 + G_WRAP), 0.0, 1.0);
  dif = dif * dif * (3.0 - 2.0 * dif) * 0.6 + dif * 0.4;
  vec3 col = alb * (uSun * dif * rs + vec3(0.012, 0.014, 0.022));
  float limb = pow(n.z, 0.45 * G_LIMB);
  col *= mix(1.0, limb, 0.75);
  // twilight band + aerial haze
  float tw = exp(-pow((ndl - 0.02) / 0.22, 2.0));
  vec3 ac = mix(uA[8].rgb, uA[9].rgb, tw * 0.7);
  float fres = pow(1.0 - n.z, 3.0);
  col = mix(col, ac * (0.12 + 0.88 * sst(-0.3, 0.55, ndl)) * uSun * 0.7, clamp(G_ATM * 0.7 * fres, 0.0, 0.9));
  // aurora ovals near the poles (night side)
  if (G_AUR > 0.0) {
    float ay = abs(P.y);
    float band = exp(-pow((ay - 0.86) / 0.035, 2.0));
    float curt = 0.5 + nz(vec3(atan(P.x, P.z) * 2.2, ay * 6.0, tt * 0.3) + uSd2).x * 1.5;
    col += uA[10].rgb * band * clamp(curt, 0.0, 1.0) * G_AUR * 0.9 * sst(0.2, -0.3, ndl);
  }
  return col;
}

void main() {
  vec2 q = (gl_FragCoord.xy - uC.xy) / uC.z;
  float r2 = dot(q, q);
  float rr = sqrt(r2);
  float pxw = 1.0 / uC.z;
  vec4 base = vec4(0.0);
  if (rr >= 1.0 && uFlg.y > 0.5 && G_ATM > 0.0) {
    float h = rr - 1.0;
    float H = G_ATMH;
    if (h < H * 7.0) {
      vec2 m = q / rr;
      float sd = dot(vec3(m, 0.0), uL);
      float tw = exp(-pow((sd - 0.03) / 0.24, 2.0));
      vec3 ar = mix(uA[8].rgb, uA[9].rgb, tw * 0.75) * (0.12 + 0.88 * sst(-0.30, 0.55, sd)) * (uSun * 0.7);
      float prof = exp(-h / H) * (1.0 - sst(H * 3.5, H * 7.0, h));
      base = glowOut(ar * clamp(G_ATM * 0.7, 0.0, 0.95) * prof);
    }
  }
  if (rr < 1.0 + 1.5 * pxw) {
    vec2 qq = rr > 0.9995 ? q * (0.9995 / rr) : q;
    float zz = sqrt(max(1.0 - dot(qq, qq), 0.0));
    vec3 col = shadeGas(vec3(qq, zz), pxw);
    float edge = clamp((1.0 - rr) / pxw + 0.5, 0.0, 1.0);
    base = over(vec4(grade(col) * edge, edge), base);
  }
  vec4 res = base;
  if (uRing.y > 0.0) {
    bool front;
    vec4 rl = ringLayer(q, r2, pxw, front);
    res = front ? over(rl, base) : over(base, rl);
  }
  oCol = finalize(res);
}
`;

  /* ---------------------------------------------------------------- programs */
  const SRC = {};   // filled after the shader strings below are defined
  // Programs are compiled on the shared GL context with KHR_parallel_shader_compile when available: every program is started at once
  // on worker threads and polled, so a late-needed shader never stalls a frame (draw() just reports false until it is ready).
  const progs = {}, failed = {};
  let parExt = null, parChecked = false, ctxHooked = false;
  function hookContext() {
    if (ctxHooked) return;
    const cv = GL.canvas && GL.canvas(); if (!cv) return;
    ctxHooked = true;
    cv.addEventListener('webglcontextlost', () => { for (const k in progs) delete progs[k]; noiseTex = null; noiseHalf = null; supportedCache = null; });
  }
  function startCompile(name) {
    let e = progs[name]; if (e) return e;
    const g = GL.gl(); if (!g || !SRC[name]) return null;
    hookContext();
    if (!parChecked) { parChecked = true; parExt = g.getExtension('KHR_parallel_shader_compile'); }
    e = progs[name] = { name, state: 'pending', t0: performance.now(), h: null };
    const mk = (type, src) => { const sh = g.createShader(type); g.shaderSource(sh, src); g.compileShader(sh); return sh; };
    e.vs = mk(g.VERTEX_SHADER, GL.quadVS); e.fs = mk(g.FRAGMENT_SHADER, SRC[name]);
    e.pg = g.createProgram(); g.attachShader(e.pg, e.vs); g.attachShader(e.pg, e.fs); g.linkProgram(e.pg);
    return e;
  }
  function finishCompile(e, block) {
    if (e.state !== 'pending') return e.state === 'ready';
    const g = GL.gl();
    if (!block) {
      if (parExt) { if (!g.getProgramParameter(e.pg, parExt.COMPLETION_STATUS_KHR)) return false; }
      else if (performance.now() - e.t0 < 400) return false;    // no parallel-compile extension: the status query itself blocks, so give the driver time first
    }
    if (!g.getProgramParameter(e.pg, g.LINK_STATUS)) {
      console.error('[GLPlanets] shader "' + e.name + '" failed:\n' + (g.getShaderInfoLog(e.fs) || '') + '\n' + (g.getProgramInfoLog(e.pg) || ''));
      e.state = 'failed'; failed[e.name] = true; return false;
    }
    const locs = {}, pg = e.pg;
    const h = e.h = {
      name: e.name, prog: pg, use() { g.useProgram(pg); return h; },
      u(n) { return n in locs ? locs[n] : (locs[n] = g.getUniformLocation(pg, n)); },
      f1(n, a) { g.uniform1f(h.u(n), a); return h; }, f2(n, a, b) { g.uniform2f(h.u(n), a, b); return h; },
      f3(n, a, b, c) { g.uniform3f(h.u(n), a, b, c); return h; }, f4(n, a, b, c, d) { g.uniform4f(h.u(n), a, b, c, d); return h; },
      i1(n, a) { g.uniform1i(h.u(n), a); return h; }
    };
    e.state = 'ready'; stats.compileMs[e.name] = Math.round(performance.now() - e.t0);
    return true;
  }
  // returns the program helper when ready; null while it is still compiling (or failed).  block = wait for it.
  function prog(name, block) {
    if (!GL || failed[name]) return null;
    const e = startCompile(name); if (!e) return null;
    return finishCompile(e, !!block) ? e.h : null;
  }
  // supported(): true once the GL core is usable, the noise volume is built and the main planet shader is linked. It never blocks:
  // the first call starts warm() (idle-sliced noise build + staggered compiles) and reports false, so callers draw the Canvas2D
  // fallback until everything is ready. supported(true) is the old blocking form (tools / benchmarks only).
  let supportedCache = null;
  function supported(block) {
    if (!GL || !GL.supported()) return false;
    if (supportedCache === false) return false;
    if (supportedCache === true) return true;
    if (block) { buildNoise(); for (const k in SRC) startCompile(k); supportedCache = !!prog('rocky', true); return supportedCache; }
    warm();
    const e = progs.rocky;
    if (e && e.state === 'failed') { supportedCache = false; return false; }
    if (NOISE && e && (e.state === 'ready' || finishCompile(e, false))) { supportedCache = true; return true; }
    return false;
  }

  /* ---------------------------------------------------------------- matrices (row-major 3x3 as flat arrays) */
  const _m1 = new Float32Array(9), _m2 = new Float32Array(9), _m3 = new Float32Array(9), _mS = new Float32Array(9), _mC = new Float32Array(9);
  function rotX(o, a) { const c = Math.cos(a), s = Math.sin(a); o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = c; o[5] = -s; o[6] = 0; o[7] = s; o[8] = c; }
  function rotY(o, a) { const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = 0; o[2] = s; o[3] = 0; o[4] = 1; o[5] = 0; o[6] = -s; o[7] = 0; o[8] = c; }
  function rotZ(o, a) { const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = -s; o[2] = 0; o[3] = s; o[4] = c; o[5] = 0; o[6] = 0; o[7] = 0; o[8] = 1; }
  function mul3(o, a, b) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  }
  // view -> object = Ry(-spin) · Rx(-elev) · Rz(-roll); written column-major into `out` (WebGL forbids transpose)
  function viewToObject(out, spin, elev, roll) {
    rotZ(_m1, -roll); rotX(_m2, -elev); mul3(_m3, _m2, _m1); rotY(_m1, -spin); mul3(_m2, _m1, _m3);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 3 + r] = _m2[r * 3 + c];
  }

  /* ---------------------------------------------------------------- shared draw plumbing */
  const DEFQ = { dpr: 1, planetDetail: 1, particles: 1 };
  const getQ = () => (M.Perf && M.Perf.q) || DEFQ;
  const stats = { draws: 0, lastMs: 0, compileMs: {} };
  const _lc = new Float32Array(3);

  function lightVec(out, angle, elev) {
    const se = clamp(elev, -0.99, 0.99), ce = Math.sqrt(1 - se * se);
    out[0] = Math.cos(angle) * ce; out[1] = -Math.sin(angle) * ce; out[2] = se;
  }
  function cityColor(hex) {
    const warm = [255, 204, 130], o = hex ? hexRgb(hex, null) : null;
    if (!o) return warm.map(lin);
    return [mixf(warm[0], o[0], 0.55), mixf(warm[1], o[1], 0.55), mixf(warm[2], o[2], 0.55)].map(lin);
  }
  const SUN_DEF = [1.34, 1.27, 1.14];

  // halo / ring extent in planet radii (what has to fit around the disc)
  function extentOf(P) {
    let e = 1.0;
    const atm = P.gas ? P.F[8] : P.F[12], atmH = P.gas ? P.F[9] : P.F[13];
    if (atm > 0) e = 1 + atmH * 7.0;
    if (P.ring) {
      const sr = Math.sin(P.roll) * Math.cos(P.elev);
      e = Math.max(e, P.ring.outer * Math.sqrt(Math.max(0, 1 - sr * sr)) + 0.04, P.ring.outer * 0.99 + 0.04);
    }
    return e;
  }

  function bindCommon(pr, P, Rpx, cxg, cyg, t, opts) {
    const g = GL.gl();
    const spin = opts.spin !== undefined ? opts.spin : 0.015;
    let sp = P.phase + spin * t; sp -= Math.floor(sp);
    let csp = P.cphase + spin * 1.24 * t + 0.0012 * t; csp -= Math.floor(csp);   // the cloud deck runs a little ahead of the ground
    viewToObject(_mS, sp * TAU, P.elev, P.roll);
    viewToObject(_mC, csp * TAU, P.elev, P.roll);
    const la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, le = opts.lightElev !== undefined ? opts.lightElev : 0.55;
    lightVec(_lc, la, le);
    pr.f3('uC', cxg, cyg, Rpx);
    g.uniformMatrix3fv(pr.u('uRotS'), false, _mS);
    g.uniformMatrix3fv(pr.u('uRotC'), false, _mC);
    g.uniformMatrix3fv(pr.u('uSR'), false, P.sr);
    const ce = Math.cos(P.elev), se = Math.sin(P.elev);
    pr.f3('uAxis', -Math.sin(P.roll) * ce, Math.cos(P.roll) * ce, se);
    pr.f3('uL', _lc[0], _lc[1], _lc[2]);
    if (opts.lightColor) { const s = hexRgb(opts.lightColor).map(lin); pr.f3('uSun', s[0] * 1.3, s[1] * 1.3, s[2] * 1.3); }
    else pr.f3('uSun', SUN_DEF[0], SUN_DEF[1], SUN_DEF[2]);
    pr.f3('uSd', P.sd[0], P.sd[1], P.sd[2]);
    pr.f3('uSd2', P.sd2[0], P.sd2[1], P.sd2[2]);
    pr.f4('uRn', P.rn[0], P.rn[1], P.rn[2], P.rn[3]);
    g.uniform4fv(pr.u('uA'), P.A);
    g.uniform4fv(pr.u('uF'), P.F);
    bindNoise(g, pr);
  }

  function octFor(Rpx, base, detail, maxOct, minOct) { return clamp(Math.log2(Math.max(2, Rpx * detail / (2.4 * base))) + 1, minOct || 2, maxOct); }

  function setRockyUniforms(pr, P, Rpx, detail, t, opts, desc) {
    const g = GL.gl(), f = P.F;
    const cfreq = f[6], cscale = f[9];
    const terr = octFor(Rpx, cfreq, detail, 8.5, 2.5);
    const cl = octFor(Rpx, cscale * 1.4, detail, 7.0, 2.5);
    let crScales = 0;
    for (let k = 0; k < 4; k++) if (Rpx * detail / (3.0 * Math.pow(2.3, k)) >= 5) crScales = k + 1;
    pr.f4('uLod', terr, cl, crScales, clamp(Rpx * 0.28, 18, 84));
    const clouds = opts.clouds !== false, atm = opts.atmosphere !== false, lights = opts.lights !== false && !!(desc && desc.inhabited);
    pr.f4('uFlg', clouds ? 1 : 0, atm ? 1 : 0, lights ? 1 : 0, t % 4096);
    const shadows = opts.cloudShadows !== false && detail >= 0.7 && Rpx >= 26;
    pr.f4('uQ', shadows ? 0.5 : 0, 0.035, 1.0 / (1.0 + 0.12 * terr), 0);
    const cc = cityColor(desc && desc.color);
    pr.f3('uCity', cc[0], cc[1], cc[2]);
    g.uniform4fv(pr.u('uVort'), P.vort);
    g.uniform3fv(pr.u('uVs'), P.vs);
  }
  function setGasUniforms(pr, P, Rpx, detail, t, opts) {
    const g = GL.gl();
    const terr = octFor(Rpx, 1.6, detail, 7.5, 2.5);
    pr.f4('uLod', terr, terr, 0, 0);
    pr.f4('uFlg', 0, opts.atmosphere !== false ? 1 : 0, 0, t % 4096);
    pr.f4('uQ', 0, 0, 1, 0);
    g.uniform4fv(pr.u('uSp'), P.spots);
    g.uniform4fv(pr.u('uSpS'), P.spotS);
  }
  function setRingUniforms(pr, P) {
    if (P.ring) {
      const r = P.ring;
      pr.f4('uRing', r.inner, r.outer, 0.94, r.seed);
      pr.f4('uRingC', r.col[0], r.col[1], r.col[2], r.contrast);
    } else pr.f4('uRing', 0, 0, 0, 0);
  }

  /* ---- planet region + draw */
  let _lastDrawErr = 0;
  // The part of a region ([x, x+s] × [y, y+s] in ctx units) that lands on ctx's bitmap, as an offset + size in region device px: null when
  // all of it does, false when none. Shading only that part is free (same fragment maths, a smaller viewport) and halves the cost of a
  // planet half off the canvas (the title screen's, a close system view). Only for scale + translate transforms (the usual
  // setTransform(dpr, 0, 0, dpr, 0, 0)); a rotated or skewed ctx shades the whole region.
  function visibleSub(ctx, x, y, s, dpr, S) {
    const cv = ctx.canvas;
    if (!cv || typeof ctx.getTransform !== 'function') return null;
    let m; try { m = ctx.getTransform(); } catch (e) { return null; }
    if (!m || m.b !== 0 || m.c !== 0 || !(m.a > 0) || !(m.d > 0)) return null;
    const x0 = -m.e / m.a, y0 = -m.f / m.d, x1 = (cv.width - m.e) / m.a, y1 = (cv.height - m.f) / m.d;
    if (x0 <= x && y0 <= y && x1 >= x + s && y1 >= y + s) return null;
    const ox = Math.max(0, Math.floor((x0 - x) * dpr) - 1), oy = Math.max(0, Math.floor((y0 - y) * dpr) - 1);
    const ex = Math.min(S, Math.ceil((x1 - x) * dpr) + 1), ey = Math.min(S, Math.ceil((y1 - y) * dpr) + 1);
    if (ex <= ox || ey <= oy) return false;
    return { ox, oy, w: ex - ox, h: ey - oy };
  }
  function renderPlanetRegion(ctx, desc, cx, cy, radius, t, opts, forceDpr, fit) {
    const q = getQ();
    const P = planetData(desc);
    if (P.look === 'asteroids') return drawRockCluster(ctx, desc, P, cx, cy, radius, t, opts, forceDpr);
    const pr = prog(P.gas ? 'gas' : 'rocky');
    if (!pr) return false;
    const g = GL.gl(); if (!g || g.isContextLost()) return false;
    let dpr = forceDpr || (opts.dpr > 0 ? opts.dpr : (M.Perf && M.Perf.dpr ? M.Perf.dpr() : (hasWin && window.devicePixelRatio) || 1));
    let Rpx = radius * dpr;
    if (!(Rpx > 0.5)) return true;
    const ext = fit ? 1 : extentOf(P);
    let half = Math.ceil(ext * Rpx + 3);
    if (half > 2048) { const k = 2048 / half; dpr *= k; Rpx *= k; half = 2048; }
    const S = half * 2;
    // pixel-align the destination so the planet is never resampled (keeps the limb crisp)
    const gx = cx * dpr, gy = cy * dpr;
    const ix = Math.round(gx - half), iy = Math.round(gy - half);
    const fx = gx - ix - half, fy = gy - iy - half;
    let ox = 0, oy = 0, Sw = S, Sh = S;
    const sub = visibleSub(ctx, ix / dpr, iy / dpr, S / dpr, dpr, S);
    if (sub === false) return true;                 // nothing of it on the canvas
    if (sub) { ox = sub.ox; oy = sub.oy; Sw = sub.w; Sh = sub.h; }
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    if (!GL.begin(Sw, Sh)) return false;
    pr.use();
    const detail = clamp(q.planetDetail === undefined ? 1 : q.planetDetail, 0.4, 2.0);
    bindCommon(pr, P, Rpx, half + fx - ox, Sh - (half + fy - oy), t, opts);   // centre in viewport px, GL origin bottom-left (unclipped: half + fx, half - fy)
    pr.f2('uVo', ox, S - Sh - oy);
    if (P.gas) setGasUniforms(pr, P, Rpx, detail, t, opts); else setRockyUniforms(pr, P, Rpx, detail, t, opts, desc);
    setRingUniforms(pr, P);
    GL.drawQuad();
    GL.blit(ctx, (ix + ox) / dpr, (iy + oy) / dpr, Sw / dpr, Sh / dpr);
    stats.draws++;
    if (t0) stats.lastMs = performance.now() - t0;
    return true;
  }

  function glDraw(ctx, desc, cx, cy, radius, t, opts) {
    opts = opts || {};
    if (!supported()) return false;
    try { return renderPlanetRegion(ctx, desc, cx, cy, radius, t || 0, opts, 0, false); } catch (e) {
      if (!_lastDrawErr++) console.warn('[GLPlanets] draw failed', e);
      return false;
    }
  }
  // Canvas2D parity: when GL is unavailable (or a program is still compiling) the CPU modules draw instead, with identical arguments.
  // API.fallback = false disables this (test pages that compare the two paths); API.path reports which path served the last call.
  function cpuPlanets() { const c = Gfx.Planets; return c && c !== API && typeof c.draw === 'function' ? c : null; }
  function cpuSpace() { const c = Gfx.Space; return c && typeof c.drawStarSurface === 'function' ? c : null; }
  function viaCpu(fn) {
    if (!API.fallback) return false;
    try { fn(); API.path = 'cpu'; return true; } catch (e) { if (!_lastDrawErr++) console.warn('[GLPlanets] CPU fallback failed', e); return false; }
  }
  function draw(ctx, desc, cx, cy, radius, t, opts) {
    if (glDraw(ctx, desc, cx, cy, radius, t, opts)) { API.path = 'gl'; return true; }
    const c = cpuPlanets();
    return c ? viaCpu(() => c.draw(ctx, desc, cx, cy, radius, t, opts)) : false;
  }

  /* ---------------------------------------------------------------- sprite cache */
  const SPR = new Map();
  let sprBytes = 0;
  function sprBudget() { const gb = (M.HW && M.HW.memoryGB) || 4; return clamp(gb * 10, 24, 120) * 1048576; }
  function sprite(desc, diameterPx, opts) {
    const cv = glSprite(desc, diameterPx, opts);
    if (cv) { API.path = 'gl'; return cv; }
    const c = cpuPlanets();
    if (c && typeof c.sprite === 'function' && API.fallback) { API.path = 'cpu'; return c.sprite(desc, diameterPx, opts); }
    return null;
  }
  function glSprite(desc, diameterPx, opts) {
    opts = opts || {};
    if (!supported()) return null;
    const P = planetData(desc);
    const dpr = opts.dpr > 0 ? opts.dpr : 1;
    const D = Math.max(6, Math.round(Math.max(6, diameterPx) * dpr));
    const la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, le = opts.lightElev !== undefined ? opts.lightElev : 0.55;
    const key = [P.key, D, opts.clouds === false ? 0 : 1, opts.atmosphere === false ? 0 : 1, opts.lights === false ? 0 : 1, desc && desc.inhabited ? 1 : 0,
      desc && desc.color || '', la.toFixed(2), le.toFixed(2), opts.phase === undefined ? '' : opts.phase].join('|');
    const hit = SPR.get(key);
    if (hit) { SPR.delete(key); SPR.set(key, hit); return hit; }
    const cv = document.createElement('canvas'); cv.width = cv.height = D;
    const c2 = cv.getContext('2d');
    const fit = extentOf(P) + 0.02;
    const Rr = Math.max(3, (D / 2 - 1.5) / fit);
    const o = Object.assign({}, opts, { dpr: 1, cloudShadows: true, spin: 1, lightAngle: la, lightElev: le });   // spin 1 rev/s * t = phase (revolutions) -> static pose
    const ok = renderPlanetRegion(c2, desc, D / 2, D / 2, Rr, opts.phase || 0, o, 1, false);
    if (!ok) return null;
    cv._bytes = D * D * 4; sprBytes += cv._bytes; SPR.set(key, cv);
    while (sprBytes > sprBudget() && SPR.size > 1) { const k0 = SPR.keys().next().value, v0 = SPR.get(k0); SPR.delete(k0); sprBytes -= v0._bytes || 0; }
    return cv;
  }

  /* ================================================================ stars */
  const GLSL_STAR = `
uniform vec3 uC;           // x,y: centre (px, GL coords), z: star radius px
uniform vec2 uSize;        // region size px
uniform mat3 uRotS;
uniform float uT;
uniform vec3 uSd;
uniform vec3 uCl;          // cool lanes / spots
uniform vec3 uCm;          // mid photosphere
uniform vec3 uCh;          // hot cell centres
uniform vec3 uCor;         // corona colour
uniform vec4 uP;           // x granule frequency, y -, z spot amount, w lod (>0.5: second granule scale)
uniform vec3 uLimb;        // limb darkening per channel
uniform vec4 uG;           // x glow strength, y glow tightness, z streamer amount, w prominences
uniform vec4 uH;           // x ray frequency, y flare pulse, z seed scalar

vec3 worleyA(vec3 p, float tm) {
  vec3 ip = floor(p), fp = fract(p);
  float f1 = 8.0, f2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = hash33(ip + g);
    vec3 o2 = 0.5 + 0.42 * sin(tm * (0.5 + o.zxy * 0.9) + 6.2831 * o);
    vec3 d = g + o2 - fp;
    float dd = dot(d, d);
    if (dd < f1) { f2 = f1; f1 = dd; id = o.x; }
    else if (dd < f2) f2 = dd;
  }
  return vec3(sqrt(f1), sqrt(f2), id);
}

void main() {
  vec2 q = (gl_FragCoord.xy - uC.xy) / uC.z;
  float r2 = dot(q, q), rr = sqrt(r2), pxw = 1.0 / uC.z;
  float ext = 0.5 * uSize.x / uC.z;
  float h = max(rr - 1.0, 0.0);
  vec2 dir = q / max(rr, 1e-4);
  float ang = atan(q.y, q.x);
  float pulse = 1.0 + uH.y * (0.5 * sin(uT * 0.9 + uH.z * 5.0) + 0.5 * sin(uT * 2.3 + uH.z * 11.0));

  // ---- corona: layered halo + angular streamers
  float rays = nz(vec3(dir * uH.x, uT * 0.05 + uSd.x)).x * 2.0 + 0.6 * nz(vec3(dir * uH.x * 2.3, uT * 0.08 + uSd.y)).x * 2.0;
  float streak = clamp(exp(uG.z * rays * 0.8 * sst(0.03, 0.5, h)), 0.4, 2.2);
  float tg = max(uG.y, 0.2);
  float g1 = exp(-h * 7.0 / tg), g2 = exp(-h * 2.4 / tg), g3 = 1.0 / (1.0 + 16.0 * h * h / (tg * tg));
  float glow = uG.x * (0.52 * g1 + 0.26 * g2 + 0.10 * g3) * streak * pulse;
  glow *= 1.0 - sst(0.5 * ext, ext, rr);
  vec3 I = uCor * glow;

  // ---- prominences: glowing arches rising from the limb
  for (int i = 0; i < 5; i++) {
    if (float(i) >= uG.w) break;
    float fi = float(i);
    vec4 hs = hash43(vec3(fi, uH.z, 3.7));
    float phi0 = hs.x * TAU, w = 0.13 + 0.14 * hs.y;
    float H = 0.20 + 0.36 * hs.z;
    float life = 0.5 + 0.5 * sin(uT * (0.10 + 0.14 * hs.w) + fi * 2.3 + uH.z * 6.0);
    H *= sst(0.05, 0.9, life);
    float a = atan(sin(ang - phi0), cos(ang - phi0)) / w;
    if (abs(a) < 1.0 && H > 0.01 && rr > 0.98) {
      float arch = H * sqrt(max(1.0 - a * a, 0.0));
      float dd = h - arch;
      float th = 0.016 + 0.020 * hs.y + 0.5 * pxw;
      float arc = exp(-pow(dd / th, 2.0));
      float fill = (1.0 - sst(0.0, 1.0, h / max(arch, 1e-3))) * sst(0.0, 0.015, h) * (1.0 - a * a);
      float flow = 0.7 + 0.3 * nz(vec3(a * 3.0, h * 20.0, uT * 0.4 + fi)).x * 2.0;
      vec3 pc = mix(uCor, vec3(1.0, 0.34, 0.22), 0.55);
      I += pc * (arc * 1.7 + fill * 0.40) * flow * sst(0.95, 0.5, abs(a)) * 1.3;
    }
  }
  vec4 base = glowOut(I);

  // ---- photosphere
  if (rr < 1.0 + 1.5 * pxw) {
    vec2 qq = rr > 0.9995 ? q * (0.9995 / rr) : q;
    float mu = sqrt(max(1.0 - dot(qq, qq), 0.0));
    vec3 P = uRotS * vec3(qq, mu);
    float tm = uT * 0.30;
    vec3 pp = P * uP.x + uSd;
    pp += nzV(P * uP.x * 0.45 + uSd.yzx).xyz * 0.7;
    vec3 w1 = worleyA(pp, tm);
    float lane = sst(0.0, 0.42, w1.y - w1.x);
    float B = mix(0.84, 1.0, lane) * (0.93 + 0.09 * w1.z);          // v3: fine, low-contrast granulation (the cells barely read; no plates, no cracks)
    if (uP.w > 0.5) {
      vec3 w2 = worleyA(pp * 3.0 + 5.3, tm * 1.6);
      B *= mix(0.94, 1.03, sst(0.0, 0.3, w2.y - w2.x));
    }
    B *= 1.0 + 0.14 * fbm(P * 1.7 + uSd.zxy, 3.0);                  // gentle large-scale mottling (was 0.55: blotches)
    float sn = fbm(P * 1.3 + uSd.yzx * 0.7, 3.0) * 1.6 + 0.4 * nz(P * 3.1 + uSd).x;
    float thr = mix(0.80, 0.42, uP.z);                               // sunspots: rarer and smaller
    B *= mix(1.0, 0.82, sst(thr, thr + 0.10, sn)) * mix(1.0, 0.45, sst(thr + 0.10, thr + 0.20, sn));
    vec3 c = B < 0.55 ? mix(uCl, uCm, B / 0.55) : mix(uCm, uCh, clamp((B - 0.55) / 0.55, 0.0, 1.0));
    // limb darkening I = 1 - u (1 - mu), per channel (the blue channel darkens most: the limb reddens); a touch of extra
    // falloff in the last 10 % so the disc reads as a sphere, not a plate
    vec3 ld = clamp(1.0 - uLimb * (1.0 - mu), 0.0, 1.0) * (0.82 + 0.18 * sst(0.0, 0.12, mu));
    c *= ld * 1.18 * pulse;                                           // was 1.6: the tone map clipped the whole disc to one flat colour
    float edge = clamp((1.0 - rr) / pxw + 0.5, 0.0, 1.0);
    base = over(vec4(grade(c) * edge, edge), base);
  }
  oCol = finalize(base);
}
`;

  /* ================================================================ black hole: null geodesics (Schwarzschild), tilted accretion disc */
  const GLSL_BH = `
uniform vec3 uC;           // x,y: centre (px), z: shadow radius px
uniform vec2 uSize;
uniform float uT;
uniform vec3 uND;          // accretion-disc normal (view space)
uniform vec3 uSd;
uniform vec4 uBH;          // x r_in, y r_out (Schwarzschild radii), z brightness, w detail
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCold;
const float BC = 2.598076;

vec3 bbRamp(float t) {
  t = max(t, 0.0);
  if (t < 0.45) return mix(uCold * 0.35, uCold, t / 0.45);
  if (t < 0.9) return mix(uCold, uMid, (t - 0.45) / 0.45);
  return mix(uMid, uHot, clamp((t - 0.9) / 0.6, 0.0, 1.0));
}

// emission of the disc at radius r, from the ray state at the crossing
vec4 discAt(float r, float u, float v, float phi, vec3 eb) {
  if (r < uBH.x * 0.96 || r > uBH.y * 1.05) return vec4(0.0);
  vec3 ez = vec3(0.0, 0.0, 1.0);
  vec3 er = cos(phi) * ez + sin(phi) * eb;
  vec3 ep = -sin(phi) * ez + cos(phi) * eb;
  vec3 X = r * er;
  vec3 T = -(v / (u * u)) * er + (1.0 / u) * ep;
  vec3 nph = -normalize(T);
  vec3 vdir = normalize(cross(uND, X));
  float beta = min(sqrt(0.5 / max(r - 1.0, 0.3)), 0.55);
  float dop = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(vdir, nph));
  float grav = sqrt(max(1.0 - 1.0 / r, 0.03));
  float shift = dop * grav;
  vec3 ex = normalize(cross(uND, ez));
  vec3 ey = cross(uND, ex);
  float psi = atan(dot(X, ey), dot(X, ex));
  float PH = 12.0, ph = fract(uT / PH);
  float tA = ph * PH, tB = fract(ph + 0.5) * PH, wA = 1.0 - abs(2.0 * ph - 1.0);
  float om = 1.7 / (r * sqrt(r));
  vec2 cA = vec2(cos(psi - om * tA), sin(psi - om * tA)) * r;
  vec2 cB = vec2(cos(psi - om * tB), sin(psi - om * tB)) * r;
  float oct = 2.0 + 2.0 * uBH.w;
  float nA = fbm(vec3(cA * 1.0, r * 0.4) + uSd, oct), nB = fbm(vec3(cB * 1.0, r * 0.4) + uSd, oct);
  float pat = 0.80 + 1.5 * mix(nB, nA, wA);
  pat *= 0.88 + 0.24 * sin(r * 7.0 + 2.5 * mix(nB, nA, wA));
  float Tn = pow(uBH.x / r, 0.72);
  float body = sst(uBH.x * 0.96, uBH.x * 1.10, r) * sst(uBH.y * 1.05, uBH.y * 0.62, r);
  float I = pow(Tn, 2.6) * pow(max(shift, 0.05), 3.0) * pat * body * uBH.z;
  vec3 col = bbRamp(Tn * pow(max(shift, 0.05), 0.75) * 1.05) * I;
  return vec4(col, clamp(body * 1.05, 0.0, 1.0));
}

void main() {
  vec2 q = (gl_FragCoord.xy - uC.xy) / uC.z;
  float bq = length(q);
  float pxw = 1.0 / uC.z;
  float b = max(bq * BC, 1e-3);
  vec3 eb = vec3(bq > 1e-4 ? q / bq : vec2(1.0, 0.0), 0.0);
  float A = uND.z, B = dot(uND, eb);
  float pc = atan(-A, B);
  float p1 = pc < 0.0 ? pc + PI : pc;
  float p2 = p1 + PI;
  float u = 0.0, v = 1.0 / b, phi = 0.0;
  const float DP = 0.05;
  float u1 = -1.0, v1 = 0.0, u2 = -1.0, v2 = 0.0;
  for (int i = 0; i < 136; i++) {
    float u0 = u, vv0 = v;
    float a1 = -u + 1.5 * u * u;
    float um = u + 0.5 * DP * v, vm = v + 0.5 * DP * a1;
    float a2 = -um + 1.5 * um * um;
    u += DP * vm; v += DP * a2;
    float phin = phi + DP;
    if (u1 < 0.0 && phi < p1 && phin >= p1) { float t = (p1 - phi) / DP; u1 = max(mix(u0, u, t), 1e-5); v1 = mix(vv0, v, t); }
    if (u2 < 0.0 && phi < p2 && phin >= p2) { float t = (p2 - phi) / DP; u2 = max(mix(u0, u, t), 1e-5); v2 = mix(vv0, v, t); break; }
    phi = phin;
    if (u >= 1.0) break;
    if (u <= 0.0 && i > 3) break;
  }
  vec3 col = vec3(0.0);
  float al = 0.0;
  if (u1 > 0.0) {
    vec4 d = discAt(1.0 / u1, u1, v1, p1, eb);
    col += (1.0 - al) * d.rgb * d.a; al += (1.0 - al) * d.a;
  }
  if (u2 > 0.0 && al < 0.995) {
    vec4 d = discAt(1.0 / u2, u2, v2, p2, eb);
    col += (1.0 - al) * d.rgb * d.a; al += (1.0 - al) * d.a;
  }
  // event horizon / shadow (anti-aliased analytically) and the photon-ring glow
  float shadow = 1.0 - sst(1.0 - pxw * 0.8, 1.0 + pxw * 0.8, bq);
  vec3 ringCol = uMid * 1.2;
  float ring = exp(-pow((bq - 1.015) / 0.035, 2.0)) * 0.55 + exp(-pow((bq - 1.0) / 0.012, 2.0)) * 0.5;
  col += ringCol * ring * (1.0 - shadow) * uBH.z * 0.8;
  vec3 halo = uCold * 0.10 * exp(-(bq - 1.0) * 1.6) * (1.0 - sst(0.55 * 0.5 * uSize.x / uC.z, 0.5 * uSize.x / uC.z, bq));
  col += halo * (1.0 - shadow);
  vec3 d = grade(col);
  float a = max(max(d.r, d.g), d.b);
  vec4 res = vec4(d, clamp(a, 0.0, 1.0));
  res = over(vec4(vec3(0.0), shadow), res * (1.0 - shadow));
  oCol = finalize(res);
}
`;

  const STAR_KINDS = ['yellow', 'orange', 'red', 'blue', 'white', 'green', 'purple', 'blackhole'];
  const STAR = {
    yellow: { cl: '#c8681e', cm: '#ffb440', ch: '#fff0c0', cor: '#ffd070', limb: [0.55, 0.85, 1.2], spots: 0.12, freq: 9.0, glow: 0.85, tight: 1.0, streak: 0.5, prom: 0 },
    orange: { cl: '#8a2e06', cm: '#f07a1c', ch: '#ffc468', cor: '#ff9438', limb: [0.5, 0.8, 1.2], spots: 0.25, freq: 8.0, glow: 0.8, tight: 0.9, streak: 0.5, prom: 0 },
    red: { cl: '#4a0a04', cm: '#d8300e', ch: '#ff7a44', cor: '#ff4a28', limb: [0.45, 0.8, 1.3], spots: 0.45, freq: 7.0, glow: 0.8, tight: 0.85, streak: 0.4, prom: 2 },
    blue: { cl: '#2c58c8', cm: '#7ab4ff', ch: '#e6f4ff', cor: '#6ea6ff', limb: [0.35, 0.5, 0.7], spots: 0.0, freq: 7.0, glow: 1.5, tight: 1.4, streak: 0.8, prom: 1 },
    white: { cl: '#9aaad8', cm: '#e6ecff', ch: '#ffffff', cor: '#cfdcff', limb: [0.4, 0.55, 0.75], spots: 0.08, freq: 6.5, glow: 1.2, tight: 1.2, streak: 0.6, prom: 1 },
    green: { cl: '#14762c', cm: '#52e07c', ch: '#e0ffd0', cor: '#58f08c', limb: [0.5, 0.55, 0.9], spots: 0.2, freq: 5.5, glow: 1.1, tight: 1.1, streak: 0.6, prom: 2 },
    purple: { cl: '#4a1590', cm: '#a460ff', ch: '#f0d8ff', cor: '#9a58ff', limb: [0.4, 0.6, 0.8], spots: 0.15, freq: 6.0, glow: 1.2, tight: 1.1, streak: 0.9, prom: 2 }
  };
  Object.keys(STAR).forEach(k => { const s = STAR[k]; s.cl = hexLin(s.cl); s.cm = hexLin(s.cm); s.ch = hexLin(s.ch); s.cor = hexLin(s.cor); });

  function drawStar(ctx, kind, cx, cy, r, t, opts) {
    if (glDrawStar(ctx, kind, cx, cy, r, t, opts)) { API.path = 'gl'; return true; }
    const c = cpuSpace();
    return c ? viaCpu(() => c.drawStarSurface(ctx, kind, cx, cy, r, t, opts)) : false;
  }
  function glDrawStar(ctx, kind, cx, cy, r, t, opts) {
    opts = opts || {};
    if (!supported()) return false;
    try {
      const bh = kind === 'blackhole';
      const pr = prog(bh ? 'bh' : 'star'); if (!pr) return false;
      const g = GL.gl(); if (!g || g.isContextLost()) return false;
      let dpr = opts.dpr > 0 ? opts.dpr : (M.Perf && M.Perf.dpr ? M.Perf.dpr() : (hasWin && window.devicePixelRatio) || 1);
      let Rpx = r * dpr; if (!(Rpx > 0.5)) return true;
      const ext = bh ? 3.7 : 3.1 + 0.3 * (opts.glow !== undefined ? clamp(opts.glow, 0, 2) : 1);
      let half = Math.ceil(ext * Rpx + 3);
      if (half > 2048) { const k = 2048 / half; dpr *= k; Rpx *= k; half = 2048; }
      const S = half * 2, gx = cx * dpr, gy = cy * dpr;
      const ix = Math.round(gx - half), iy = Math.round(gy - half), fx = gx - ix - half, fy = gy - iy - half;
      if (!GL.begin(S, S)) return false;
      pr.use();
      const seed = seedOf(opts.seed !== undefined ? opts.seed : kind), rnd = rng32(seed);
      const sdx = rnd() * 50 + 3, sdy = rnd() * 50 + 3, sdz = rnd() * 50 + 3, tw = (t || 0) % 4096;
      pr.f3('uC', half + fx, half - fy, Rpx); pr.f2('uSize', S, S); pr.f1('uT', tw); pr.f3('uSd', sdx, sdy, sdz);
      bindNoise(g, pr);
      if (bh) {
        const tilt = opts.tilt !== undefined ? opts.tilt : 0.19, roll = opts.roll !== undefined ? opts.roll : -0.32 + (rnd() - 0.5) * 0.2;
        const ct = Math.cos(tilt);
        pr.f3('uND', -Math.sin(roll) * ct, Math.cos(roll) * ct, Math.sin(tilt));
        pr.f4('uBH', 3.0, 9.0, opts.glow !== undefined ? 0.9 * opts.glow : 0.9, clamp(Rpx / 60, 0.4, 1.5));
        const hot = hexLin('#e8f0ff'), mid = hexLin('#ffc070'), cold = hexLin('#e0501a');
        pr.f3('uHot', hot[0] * 1.6, hot[1] * 1.6, hot[2] * 1.6); pr.f3('uMid', mid[0] * 1.5, mid[1] * 1.5, mid[2] * 1.5); pr.f3('uCold', cold[0] * 1.3, cold[1] * 1.3, cold[2] * 1.3);
      } else {
        const K = STAR[kind] || STAR.yellow;
        viewToObject(_mS, (t || 0) * 0.02 + rnd() * TAU, 0.25, 0.0);
        g.uniformMatrix3fv(pr.u('uRotS'), false, _mS);
        pr.f3('uCl', K.cl[0], K.cl[1], K.cl[2]); pr.f3('uCm', K.cm[0], K.cm[1], K.cm[2]); pr.f3('uCh', K.ch[0], K.ch[1], K.ch[2]); pr.f3('uCor', K.cor[0], K.cor[1], K.cor[2]);
        pr.f4('uP', K.freq, 1, K.spots, Rpx >= 22 ? 1 : 0);
        pr.f3('uLimb', K.limb[0], K.limb[1], K.limb[2]);
        const gl = (opts.glow !== undefined ? opts.glow : 1) * K.glow, prom = Rpx >= 12 ? K.prom : 0;
        pr.f4('uG', gl, K.tight, K.streak, prom);
        pr.f4('uH', 2.4, kind === 'red' ? 0.05 : 0.025, rnd() * 10, 0);
      }
      GL.drawQuad();
      GL.blit(ctx, ix / dpr, iy / dpr, S / dpr, S / dpr);
      return true;
    } catch (e) { if (!_lastDrawErr++) console.warn('[GLPlanets] drawStar failed', e); return false; }
  }

  /* ================================================================ asteroids */
  const GLSL_AST = `
uniform vec4 uAC;          // x,y region size px, z mode (0 field, 1 cluster), w time
uniform vec3 uL;
uniform vec3 uSun;
uniform vec3 uSd;
uniform vec4 uAP;          // x density, y near cell size px, z layers, w speed px/s
uniform vec3 uTint;        // rock albedo (linear)
uniform vec3 uDust;        // dust colour (linear)
uniform vec4 uRocks[12];   // cluster: x, y (px, GL), radius px, seed
uniform int uNR;

// one tumbling rock: d = offset from the rock centre (px), R = nominal radius (px); returns display-space premultiplied rgba
vec4 rockShade(vec2 d, float R, float seed, float tm, float dim) {
  float ang = hash11(seed * 3.7) * TAU + tm * (hash11(seed * 5.1) - 0.5) * 0.30;
  float ca = cos(ang), sa = sin(ang);
  vec2 u = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y) / R;
  float asp = 0.62 + 0.38 * hash11(seed * 7.3);
  u.y /= asp;
  float rl = length(u);
  if (rl > 1.6) return vec4(0.0);
  float th = atan(u.y, u.x);
  vec3 lq = vec3(cos(th), sin(th), seed * 0.37) * 1.3;
  float lump = 1.0 + 0.30 * nz(lq).x + 0.12 * nz(lq * 2.7 + 5.0).x;
  float alpha = clamp((lump - rl) * R * asp + 0.5, 0.0, 1.0);
  if (alpha <= 0.0) return vec4(0.0);
  float zz = sqrt(max(1.0 - (rl / lump) * (rl / lump), 0.0));
  vec3 nl = vec3(u / lump, zz);
  vec3 axis = normalize(hash33(vec3(seed, 3.0, 9.0)) * 2.0 - 1.0 + vec3(0.001));
  float spin = tm * (0.12 + 0.30 * hash11(seed * 11.0)) * (hash11(seed * 13.0) < 0.5 ? -1.0 : 1.0);
  vec3 po = rotAbout(nl, axis, spin);
  vec4 n1 = fbmD(po * 1.7 + seed * 1.7, 3.5, 0.7);
  float al;
  vec3 cg = craterLayer(po, 2.6, seed, 0.6, al);
  vec3 g = n1.yzw * 1.7 * 0.55 + cg * 0.7;
  g = g - po * dot(g, po);
  vec3 gl = rotAbout(g, axis, -spin);
  vec3 nb = normalize(nl - 0.9 * gl);
  vec3 Ll = normalize(vec3(ca * uL.x + sa * uL.y, -sa * uL.x + ca * uL.y, uL.z));
  float diff = max(dot(nb, Ll), 0.0);
  float rim = pow(1.0 - zz, 2.0);
  float alb = (0.62 + 0.9 * n1.x) * (1.0 + 0.9 * al);
  vec3 col = uTint * alb * (uSun * diff * (1.0 - 0.35 * rim) + vec3(0.02, 0.022, 0.03));
  col *= dim;
  return vec4(grade(col) * alpha, alpha);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec4 acc = vec4(0.0);
  float tm = uAC.w;
  if (uAC.z < 0.5) {
    int K = int(uAP.z + 0.5);
    for (int l = 0; l < 6; l++) {
      if (l >= K) break;
      float f = float(l) / max(float(K - 1), 1.0);
      float cs = uAP.y * mix(0.42, 1.0, f);
      float spd = uAP.w * mix(0.22, 1.0, f);
      vec2 off = vec2(-tm * spd + hash11(float(l) * 7.3 + uSd.x) * 311.0, hash11(float(l) * 3.1 + uSd.y) * 177.0 + tm * spd * 0.06);
      vec2 p = (frag + off) / cs;
      vec2 cell = floor(p), fr = fract(p);
      vec4 hh = hash43(vec3(cell, float(l) * 13.0 + uSd.z));
      if (hh.w > uAP.x) continue;
      vec2 c = 0.5 + (hh.xy - 0.5) * 0.26;
      float rad = 0.15 + 0.14 * hh.z;
      vec4 r = rockShade((fr - c) * cs, rad * cs, hh.x * 100.0 + float(l) * 17.0, tm, mix(0.38, 1.0, f));
      acc = over(r, acc);
    }
  } else {
    for (int i = 0; i < 12; i++) {
      if (i >= uNR) break;
      vec4 rk = uRocks[i];
      vec4 r = rockShade(frag - rk.xy, rk.z, rk.w, tm, 1.0);
      acc = over(r, acc);
    }
  }
  oCol = finalize(acc);
}
`;

  function rockTint(desc) {
    const c = desc && desc.color ? hexRgb(desc.color) : null;
    const base = [150, 128, 108];
    return (c ? [mixf(base[0], c[0], 0.18), mixf(base[1], c[1], 0.18), mixf(base[2], c[2], 0.18)] : base).map(lin);
  }
  function setAstCommon(pr, g, W, H, t, opts, desc, seed) {
    const la = opts.lightAngle !== undefined ? opts.lightAngle : -2.3, le = opts.lightElev !== undefined ? opts.lightElev : 0.55;
    lightVec(_lc, la, le);
    pr.f3('uL', _lc[0], _lc[1], _lc[2]);
    pr.f3('uSun', SUN_DEF[0] * 1.15, SUN_DEF[1] * 1.15, SUN_DEF[2] * 1.15);
    const rnd = rng32(seed); pr.f3('uSd', rnd() * 40, rnd() * 40, rnd() * 40);
    const tc = rockTint(desc); pr.f3('uTint', tc[0], tc[1], tc[2]);
    bindNoise(g, pr);
  }
  function drawAsteroids(ctx, desc, cx, cy, w, h, t, opts) {
    if (glDrawAsteroids(ctx, desc, cx, cy, w, h, t, opts)) { API.path = 'gl'; return true; }
    const c = cpuPlanets();
    return c && typeof c.drawAsteroids === 'function' ? viaCpu(() => c.drawAsteroids(ctx, desc, cx, cy, w, h, t, opts)) : false;
  }
  function glDrawAsteroids(ctx, desc, cx, cy, w, h, t, opts) {
    opts = opts || {};
    if (!supported()) return false;
    try {
      const pr = prog('ast'); if (!pr) return false;
      const g = GL.gl(); if (!g || g.isContextLost()) return false;
      let dpr = opts.dpr > 0 ? opts.dpr : (M.Perf && M.Perf.dpr ? M.Perf.dpr() : (hasWin && window.devicePixelRatio) || 1);
      const q = getQ();
      let W = Math.ceil(w * dpr), H = Math.ceil(h * dpr);
      if (W > 4096 || H > 4096) { const k = 4096 / Math.max(W, H); dpr *= k; W = Math.ceil(w * dpr); H = Math.ceil(h * dpr); }
      const gx = (cx - w / 2) * dpr, gy = (cy - h / 2) * dpr, ix = Math.round(gx), iy = Math.round(gy);
      if (!GL.begin(W, H)) return false;
      pr.use();
      const seed = seedOf(desc && desc.seed !== undefined ? desc.seed : 1);
      setAstCommon(pr, g, W, H, t, opts, desc, seed);
      const u = clamp(Math.min(w, h) / 230, 0.55, 2.4), K = (q.particles || 1) >= 1 ? 6 : (q.particles || 1) >= 0.6 ? 5 : 4;
      const cs = 64 * u * dpr, count = opts.count || 40;
      let sumInv = 0; for (let l = 0; l < K; l++) { const f = l / Math.max(K - 1, 1), k = 0.42 + 0.58 * f; sumInv += 1 / (k * k); }
      const density = clamp(count * cs * cs / (W * H * sumInv), 0.10, 0.9);
      pr.f4('uAC', W, H, 0, (t || 0) % 4096);
      pr.f4('uAP', density, cs, K, 18 * u * dpr);
      pr.f3('uDust', 0, 0, 0);
      pr.i1('uNR', 0);
      GL.drawQuad();
      GL.blit(ctx, ix / dpr, iy / dpr, W / dpr, H / dpr);
      return true;
    } catch (e) { if (!_lastDrawErr++) console.warn('[GLPlanets] drawAsteroids failed', e); return false; }
  }
  // asteroid "planet": a round-ish orbiting cluster of lit rocks (same layout idea as the CPU module)
  const _rk = new Float32Array(48);
  function drawRockCluster(ctx, desc, P, cx, cy, radius, t, opts, forceDpr) {
    const pr = prog('ast'); if (!pr) return false;
    const g = GL.gl(); if (!g || g.isContextLost()) return false;
    let dpr = forceDpr || (opts.dpr > 0 ? opts.dpr : (M.Perf && M.Perf.dpr ? M.Perf.dpr() : (hasWin && window.devicePixelRatio) || 1));
    let Rpx = radius * dpr; if (!(Rpx > 0.5)) return true;
    let half = Math.ceil(Rpx * 1.35 + 3);
    if (half > 2048) { const k = 2048 / half; dpr *= k; Rpx *= k; half = 2048; }
    const S = half * 2, gx = cx * dpr, gy = cy * dpr;
    const ix = Math.round(gx - half), iy = Math.round(gy - half), fx = gx - ix - half, fy = gy - iy - half;
    if (!GL.begin(S, S)) return false;
    pr.use();
    setAstCommon(pr, g, S, S, t, opts, desc, P.seed);
    const rnd = rng32(P.seed ^ 0x777), n = Math.min(12, opts.count || 11), list = [];
    for (let i = 0; i < n; i++) {
      const rr = 0.12 + 0.86 * Math.sqrt(rnd()), ph = rnd() * TAU, om = (0.02 + 0.03 * Math.pow(rr + 0.15, -1.5) * 0.5) * (rnd() < 0.9 ? 1 : -1);
      list.push({ rr, ph, om, seed: rnd() * 90 + 3, sz: 0.20 + rnd() * 0.5 * (1 - rr * 0.5) });
    }
    const tilt = 0.42 + 0.2 * rnd(), rot = (rnd() - 0.5) * 0.8, cr = Math.cos(rot), sr = Math.sin(rot);
    list.forEach(q => {
      const a = q.ph + q.om * (t || 0) * TAU * 0.4, ex = Math.cos(a) * q.rr * Rpx, ey = Math.sin(a) * q.rr * Rpx * tilt;
      q.x = ex * cr - ey * sr; q.y = ex * sr + ey * cr; q.dz = Math.sin(a);
    });
    list.sort((a, b) => a.dz - b.dz);
    for (let i = 0; i < n; i++) {
      const q = list[i], R = Rpx * q.sz * 0.62 * (1 + 0.22 * q.dz) * 0.5;
      _rk[i * 4] = half + fx + q.x; _rk[i * 4 + 1] = half - fy - q.y; _rk[i * 4 + 2] = Math.max(1.2, R); _rk[i * 4 + 3] = q.seed;
    }
    pr.f4('uAC', S, S, 1, (t || 0) % 4096);
    pr.f4('uAP', 0, 0, 0, 0);
    pr.f3('uDust', 0, 0, 0);
    pr.i1('uNR', n);
    g.uniform4fv(pr.u('uRocks'), _rk);
    GL.drawQuad();
    GL.blit(ctx, ix / dpr, iy / dpr, S / dpr, S / dpr);
    return true;
  }

  /* ---------------------------------------------------------------- background compilation */
  // Every slice runs in an idle callback (setTimeout fallback): one shader compile per slice (the driver compiles them in order, and
  // flooding it would stall any frame that uses GL meanwhile), the noise volume in ~20 ms pieces, then polling until all are linked.
  const warmCbs = []; let warming = false;
  const idle = fn => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 120 }) : setTimeout(fn, 32));
  function warm(cb) {
    if (!GL || !GL.supported()) { if (cb) cb(false); return; }
    if (cb) warmCbs.push(cb);
    if (warming) return;
    warming = true;
    const order = ['rocky'].concat(Object.keys(SRC).filter(k => k !== 'rocky'));
    let ci = 0, noiseUp = false;
    const finish = (ok, transient) => { warming = false; if (supportedCache === null && !transient) supportedCache = ok; const cbs = warmCbs.splice(0); for (const f of cbs) { try { f(ok); } catch (e) { console.warn('[GLPlanets] warm callback', e); } } };
    (function next(dl) {
      try {
        if (!GL.supported()) { finish(false, true); return; }       // GL is off for now (tier dip): report false but leave the cache open so a later warm() can succeed
        if (ci < order.length) startCompile(order[ci++]);           // one program per slice
        else if (!NOISE) noiseStep();
        else if (!noiseUp) { const g = GL.gl(); if (!noiseTex && !noiseHalf) { noiseHalf = uploadHalf(g, NOISE.d1); noiseGl = g; } else { ensureNoiseTex(g); noiseUp = true; } }
        else {
          let pending = 0;
          for (const k in SRC) { const e = progs[k]; if (e && e.state === 'pending' && !finishCompile(e, false)) pending++; }
          if (!pending) { finish(!!(progs.rocky && progs.rocky.state === 'ready')); return; }
        }
        // noise slices overlap the driver's link work; when the browser grants real idle time, use it (a busy page only gets the timeout)
        if (!NOISE) { noiseStep(); while (dl && !dl.didTimeout && dl.timeRemaining() > 25 && !noiseStep()) { /* more slices in the same idle period */ } }
      } catch (e) { console.warn('[GLPlanets] warm failed', e); finish(false, true); return; }
      idle(next);
    })();
  }
  function ready() { for (const k in SRC) { const e = progs[k]; if (!e) return false; if (e.state === 'pending' && !finishCompile(e, false)) return false; } return true; }

  SRC.rocky = GLSL_HEAD + GLSL_LIB + GLSL_ROCKY;
  SRC.gas = GLSL_HEAD + GLSL_LIB + GLSL_GAS;
  SRC.star = GLSL_HEAD + GLSL_LIB + GLSL_STAR;
  SRC.bh = GLSL_HEAD + GLSL_LIB + GLSL_BH;
  SRC.ast = GLSL_HEAD + GLSL_LIB + GLSL_AST;

  /* ---------------------------------------------------------------- exports */
  const API = {
    LOOKS: LOOK_NAMES, BANDS, STAR_KINDS, supported, ready, draw, sprite, drawStar, drawAsteroids, warm, stats, fallback: true, path: 'gl',
    extent(desc) { return extentOf(planetData(desc)); },
    _dbg: { SRC, prog, planetData, PCACHE, failed, HEAD: GLSL_HEAD, LIB: GLSL_LIB, buildNoise, noiseStep }
  };
  Gfx.GLPlanets = API;
})(window.MOO);
