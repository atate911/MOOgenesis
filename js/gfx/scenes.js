/* Master of Orion - Reborn : js/gfx/scenes.js
   Cinematic, fully procedural "scene" backdrops (Canvas 2D). Exports MOO.Gfx.Scenes:
     lab, council, newsroom, audience, surface, battle, ending{victory,defeat,warp} (+ victory/defeat/warp aliases)
     SCENE_NAMES, draw(name, ctx, w, h, t, o)
   Every scene:  Scenes.<name>.draw(ctx, w, h, t, o)  draws into the w x h CSS-px area at the ctx origin and returns layout rects.
   Architecture: static layers (architecture, textures, lighting) are painted once per size into offscreen canvases (LRU, byte
   budget); every frame only light, screens, hologram, portraits and particles are drawn live. Uses MOO.Gfx.Portraits / Planets /
   Space / Ships when present and falls back to small built-in placeholders otherwise.
   Look: "imperial observatory" - deep indigo, brass hairlines, ivory light, chamfered geometry, cyan/violet holo glow. */
(function (M) {
  'use strict';
  if (!M.Gfx) M.Gfx = {};
  const G = M.Gfx;
  const PI = Math.PI, TAU = PI * 2;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, floor = Math.floor, min = Math.min, max = Math.max;
  const atan2 = Math.atan2, hypot = Math.hypot, exp = Math.exp, pow = Math.pow;

  const V2 = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'v2';
  const FONT_D = V2 ? "'Oxanium','Saira Semi Condensed','Bahnschrift SemiBold','Bahnschrift','DIN Condensed','Segoe UI Semibold',system-ui,sans-serif" : "'Marcellus SC','Marcellus','Palatino Linotype','Book Antiqua',Georgia,serif";
  const FONT_U = "'IBM Plex Sans Condensed','Bahnschrift SemiCondensed','Bahnschrift','Segoe UI',system-ui,sans-serif";
  const C = {
    void: '#060919', night: '#0a1030', deep: '#0d153a', steel: '#19224d', steelHi: '#2b3875',
    brass: '#d6b36a', brassHi: '#f3dca0', brassLo: '#8a7040', ivory: '#ece6d3', mist: '#98a5cf', fog: '#5d6a96',
    cyan: '#62d8ff', ember: '#ff9440', leaf: '#5fdc8f', rose: '#ff5c6a', violet: '#a98bff', gold: '#ffd54f', teal: '#38d6c4', azure: '#5b8cff',
  };
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'v2') {      // v2 "serious sci-fi" palette: gunmetal neutrals, steel instead of brass, restrained accents
    Object.assign(C, { void: '#05080c', night: '#0a0f15', deep: '#0f161e', steel: '#161f29', steelHi: '#2a3744', brass: '#8ea4ba', brassHi: '#d2e0ec', brassLo: '#46596c',
      ivory: '#e9eef3', mist: '#9aa8b6', fog: '#5d6b79', cyan: '#52c8ec', ember: '#ec8a45', leaf: '#62c488', rose: '#ee6679', violet: '#a58df0', gold: '#dcb54f', teal: '#3cc5b4', azure: '#6396ee' });
  }
  const RACE_IDS = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  const RACE_NAMES = { alkari: 'Alkari', bulrathi: 'Bulrathi', darlok: 'Darlok', human: 'Human', klackon: 'Klackon', meklar: 'Meklar', mrrshan: 'Mrrshan', psilon: 'Psilon', sakkra: 'Sakkra', silicoid: 'Silicoid' };

  /* ======================================================================= tiny maths / colour / random */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (v) => v - floor(v);
  const tm = (t) => (t > 0 && t < 1e9 ? +t : 0);   // time in seconds, never negative / NaN
  const tri = (v) => abs(fract(v) * 2 - 1);

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function h2(a, b) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function vn1(x, seed) { const i = floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h2(i, seed), h2(i + 1, seed), u); }
  const seedOf = (v) => (typeof v === 'number' && isFinite(v) ? v | 0 : hashStr(v == null ? 'x' : v));

  const _rgb = new Map();
  function rgb(c) {
    let v = _rgb.get(c);
    if (v) return v;
    v = [255, 255, 255];
    if (typeof c === 'string') {
      if (c.charCodeAt(0) === 35) {
        let s = c.slice(1);
        if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
        const n = parseInt(s.slice(0, 6), 16);
        if (!isNaN(n)) v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      } else {
        const m = c.match(/[\d.]+/g);
        if (m && m.length >= 3) v = [+m[0], +m[1], +m[2]];
      }
    }
    _rgb.set(c, v);
    return v;
  }
  function rgba(c, a) {
    const v = rgb(c);
    return 'rgba(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : Math.round(a * 1000) / 1000) + ')';
  }
  const hx = (n) => { n = n < 0 ? 0 : n > 255 ? 255 : Math.round(n); return (n < 16 ? '0' : '') + n.toString(16); };
  function mixc(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + hx(A[0] + (B[0] - A[0]) * t) + hx(A[1] + (B[1] - A[1]) * t) + hx(A[2] + (B[2] - A[2]) * t);
  }
  const lite = (c, k) => mixc(c, '#ffffff', k);
  const dark = (c, k) => mixc(c, '#000000', k);
  function lgr(g, x0, y0, x1, y1, st) {
    const r = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }
  function rgr(g, x, y, r0, r1, st, x2, y2) {
    const r = g.createRadialGradient(x, y, r0, x2 == null ? x : x2, y2 == null ? y : y2, r1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }
  const warned = {};
  function warnOnce(k, e) { if (!warned[k]) { warned[k] = 1; if (typeof console !== 'undefined') console.warn('[Scenes] ' + k + ' failed - using fallback:', e && e.message); } }

  /* ======================================================================= canvases, layer cache, DPR */
  function mk(w, h) { const c = document.createElement('canvas'); c.width = max(1, Math.ceil(w)); c.height = max(1, Math.ceil(h)); return c; }
  const CACHE = new Map();
  let _bytes = 0, _frame = 0;
  const BUDGET = 480 * 1024 * 1024;
  /* build(g, w, h, canvas) paints in CSS-px coordinates (g is pre-scaled); its return value is stored as entry.d. Returns the entry. */
  function layer(key, w, h, S, build) {
    const k = key + '@' + w + 'x' + h + '*' + S;
    let e = CACHE.get(k);
    if (!e) {
      const c = mk(w * S, h * S), g = c.getContext('2d');
      g.scale(c.width / w, c.height / h);
      e = { c: c, d: null, b: c.width * c.height * 4, u: _frame };
      e.d = build(g, w, h, c);
      CACHE.set(k, e); _bytes += e.b;
      if (_bytes > BUDGET) trim();
    }
    e.u = _frame;
    return e;
  }
  /* re-colour a finished layer canvas in place with a CSS filter chain (used to warm the navy halls into bronze / terracotta) */
  let _tint = null;
  const COUNCIL_TINT = 'hue-rotate(-205deg) saturate(1.55) brightness(1.2) contrast(1.05)';
  function tintLayer(c, filter) {
    try {
      if (!_tint) _tint = document.createElement('canvas');
      _tint.width = c.width; _tint.height = c.height;
      const t = _tint.getContext('2d'); t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, c.width, c.height); t.drawImage(c, 0, 0);
      const g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.filter = filter; g.drawImage(_tint, 0, 0); g.filter = 'none'; g.restore();
    } catch (e) { /* no canvas filter support: keep the original colours */ }
  }
  function trim() {
    const arr = Array.from(CACHE.entries()).sort((a, b) => a[1].u - b[1].u);
    for (let i = 0; i < arr.length && _bytes > BUDGET * 0.75; i++) {
      const e = arr[i][1];
      if (e.u >= _frame) continue;
      CACHE.delete(arr[i][0]); _bytes -= e.b; e.c.width = e.c.height = 1;
    }
  }
  function scaleOf(ctx) {
    let k = 1;
    try { const m = ctx.getTransform(); k = hypot(m.a, m.b) || 1; } catch (e) { /* old browsers */ }
    return clamp(Math.round(k * 4) / 4, 0.5, 2);
  }
  /* every public draw() starts with begin(): bumps the frame counter, saves state, clips to the scene rect */
  function begin(ctx, w, h) {
    _frame++;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return scaleOf(ctx);
  }
  function end(ctx) { ctx.restore(); }

  /* ======================================================================= glow sprites, text, shapes */
  const _glow = new Map();
  function glowImg(col) {
    let c = _glow.get(col);
    if (c) return c;
    c = mk(128, 128);
    const g = c.getContext('2d');
    g.fillStyle = rgr(g, 64, 64, 0, 64, [0, rgba(col, 1), 0.16, rgba(col, 0.6), 0.4, rgba(col, 0.2), 0.7, rgba(col, 0.045), 1, rgba(col, 0)]);
    g.fillRect(0, 0, 128, 128);
    _glow.set(col, c);
    return c;
  }
  /* additive glow blob; leaves composite op as 'lighter' only for the duration of the call */
  function glow(g, col, x, y, r, a) {
    if (a <= 0.004 || r < 0.5) return;
    const oa = g.globalAlpha, oc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = oa * (a > 1 ? 1 : a);
    g.drawImage(glowImg(col), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = oa; g.globalCompositeOperation = oc;
  }
  /* same, but caller already set 'lighter' (hot loops) */
  function glowL(g, col, x, y, r, a) {
    if (a <= 0.004 || r < 0.5) return;
    g.globalAlpha = a > 1 ? 1 : a;
    g.drawImage(glowImg(col), x - r, y - r, r * 2, r * 2);
  }
  const _hasLS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  function text(g, s, x, y, size, col, align, font, weight, ls) {
    g.font = (weight || 400) + ' ' + size + 'px ' + (font || FONT_U);
    g.textAlign = align || 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = col;
    if (_hasLS) g.letterSpacing = (ls || 0) + 'px';
    g.fillText(s, x, y);
    if (_hasLS && ls) g.letterSpacing = '0px';
  }
  const _tw = new Map();
  function textW(g, s, size, font, weight, ls) {
    const k = size + '|' + (font || '') + '|' + (weight || 400) + '|' + (ls || 0) + '|' + s;
    let v = _tw.get(k);
    if (v === undefined) {
      g.font = (weight || 400) + ' ' + size + 'px ' + (font || FONT_U);
      if (_hasLS) g.letterSpacing = (ls || 0) + 'px';
      v = g.measureText(s).width;
      if (_hasLS && ls) g.letterSpacing = '0px';
      if (_tw.size > 600) _tw.clear();
      _tw.set(k, v);
    }
    return v;
  }
  function chamferPath(g, x, y, w, h, c) {
    c = min(c, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  /* rectangle with a semi-elliptical top of height `rise` */
  function archPath(g, x, y, w, h, rise) {
    g.beginPath();
    g.moveTo(x, y + h); g.lineTo(x, y + rise);
    g.ellipse(x + w / 2, y + rise, w / 2, rise, 0, PI, TAU);
    g.lineTo(x + w, y + h); g.closePath();
  }
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }
  function brassGrad(g, x0, y0, x1, y1) { return lgr(g, x0, y0, x1, y1, [0, C.brassHi, 0.3, C.brass, 0.62, C.brassLo, 0.85, C.brass, 1, C.brassHi]); }
  /* chamfered double-hairline brass frame (outer line + inner thin line) */
  function brassFrame(g, x, y, w, h, c, lw) {
    lw = lw || 2;
    chamferPath(g, x, y, w, h, c);
    g.lineWidth = lw; g.strokeStyle = brassGrad(g, x, y, x + w, y + h); g.stroke();
    chamferPath(g, x + lw * 1.6, y + lw * 1.6, w - lw * 3.2, h - lw * 3.2, max(1, c - lw));
    g.lineWidth = max(0.6, lw * 0.35); g.strokeStyle = rgba(C.brassLo, 0.8); g.stroke();
  }
  function rivets(g, pts, r, col) {
    for (let i = 0; i < pts.length; i += 2) {
      g.fillStyle = rgba('#000', 0.5); g.beginPath(); g.arc(pts[i] + r * 0.2, pts[i + 1] + r * 0.3, r, 0, TAU); g.fill();
      g.fillStyle = col || C.brassLo; g.beginPath(); g.arc(pts[i], pts[i + 1], r, 0, TAU); g.fill();
      g.fillStyle = rgba(C.brassHi, 0.8); g.beginPath(); g.arc(pts[i] - r * 0.3, pts[i + 1] - r * 0.3, r * 0.4, 0, TAU); g.fill();
    }
  }

  /* ======================================================================= tileable value-noise textures */
  const _noise = new Map();
  /* grey-level tile: returns Float32Array size*size in 0..1 (wraps seamlessly) */
  function noiseField(seed, size, oct, f0) {
    const key = seed + '|' + size + '|' + oct + '|' + f0;
    let d = _noise.get(key);
    if (d) return d;
    d = new Float32Array(size * size);
    const R = mulberry32(seed);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const p = f0 << o, lat = new Float32Array(p * p);
      for (let i = 0; i < lat.length; i++) lat[i] = R();
      const cell = size / p;
      for (let y = 0; y < size; y++) {
        const gy = y / cell, iy = floor(gy), fy = gy - iy, sy = fy * fy * (3 - 2 * fy), r0 = (iy % p) * p, r1 = ((iy + 1) % p) * p;
        for (let x = 0; x < size; x++) {
          const gx = x / cell, ix = floor(gx), fx = gx - ix, sx = fx * fx * (3 - 2 * fx), x0 = ix % p, x1 = (ix + 1) % p;
          const a = lat[r0 + x0], b = lat[r0 + x1], c = lat[r1 + x0], e = lat[r1 + x1];
          d[y * size + x] += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy);
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < d.length; i++) d[i] /= tot;
    if (_noise.size > 24) _noise.clear();
    _noise.set(key, d);
    return d;
  }
  /* cloud/fog tile: single colour, alpha = smoothstep(lo,hi,noise)*a */
  const _tiles = new Map();
  function fogTile(seed, size, col, lo, hi, a, oct, f0) {
    const key = [seed, size, col, lo, hi, a, oct, f0].join('|');
    let c = _tiles.get(key);
    if (c) return c;
    const d = noiseField(seed, size, oct || 4, f0 || 3), rc = rgb(col);
    c = mk(size, size);
    const g = c.getContext('2d'), im = g.createImageData(size, size), px = im.data;
    for (let i = 0; i < d.length; i++) {
      const t = clamp((d[i] - lo) / (hi - lo), 0, 1);
      px[i * 4] = rc[0]; px[i * 4 + 1] = rc[1]; px[i * 4 + 2] = rc[2]; px[i * 4 + 3] = (t * t * (3 - 2 * t) * a * 255) | 0;
    }
    g.putImageData(im, 0, 0);
    if (_tiles.size > 40) _tiles.clear();
    _tiles.set(key, c);
    return c;
  }
  /* two-colour texture tile (stone, marble, hide ...) */
  function texTile(seed, size, c0, c1, oct, f0, contrast) {
    const key = ['tex', seed, size, c0, c1, oct, f0, contrast].join('|');
    let c = _tiles.get(key);
    if (c) return c;
    const d = noiseField(seed, size, oct || 4, f0 || 4), A = rgb(c0), B = rgb(c1), k = contrast || 1;
    c = mk(size, size);
    const g = c.getContext('2d'), im = g.createImageData(size, size), px = im.data;
    for (let i = 0; i < d.length; i++) {
      const t = clamp((d[i] - 0.5) * k + 0.5, 0, 1);
      px[i * 4] = A[0] + (B[0] - A[0]) * t; px[i * 4 + 1] = A[1] + (B[1] - A[1]) * t; px[i * 4 + 2] = A[2] + (B[2] - A[2]) * t; px[i * 4 + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    if (_tiles.size > 40) _tiles.clear();
    _tiles.set(key, c);
    return c;
  }
  let _grainPat = null, _scanPat = null;
  function grainPattern(g) {
    if (!_grainPat) {
      const c = mk(160, 160), cg = c.getContext('2d'), im = cg.createImageData(160, 160), px = im.data, R = mulberry32(4242);
      for (let i = 0; i < px.length; i += 4) { const v = R() > 0.5 ? 255 : 0; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = (abs(R() - 0.5) * 2 * 255) | 0; }
      cg.putImageData(im, 0, 0);
      _grainPat = g.createPattern(c, 'repeat');
    }
    return _grainPat;
  }
  function scanPattern(g) {
    if (!_scanPat) {
      const c = mk(2, 3), cg = c.getContext('2d');
      cg.fillStyle = 'rgba(0,0,0,0.0)'; cg.fillRect(0, 0, 2, 1);
      cg.fillStyle = 'rgba(0,0,10,0.32)'; cg.fillRect(0, 1, 2, 1);
      cg.fillStyle = 'rgba(0,0,0,0.08)'; cg.fillRect(0, 2, 2, 1);
      _scanPat = g.createPattern(c, 'repeat');
    }
    return _scanPat;
  }
  /* film grain: baked once into static layers (dithers the big gradients); animated grain only when Scenes.config.filmGrain is set */
  let _grainTile = null;
  function grainTile() {
    if (!_grainTile) {
      const c = mk(256, 256), cg = c.getContext('2d'), im = cg.createImageData(256, 256), px = im.data, R = mulberry32(4242);
      for (let i = 0; i < px.length; i += 4) { const v = R() > 0.5 ? 255 : 0; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = (abs(R() - 0.5) * 2 * 255) | 0; }
      cg.putImageData(im, 0, 0);
      _grainTile = c;
    }
    return _grainTile;
  }
  function bakeGrain(g, w, h, a) {
    const t = grainTile();
    g.save(); g.globalAlpha = a == null ? 0.05 : a; g.globalCompositeOperation = 'overlay';
    for (let y = 0; y < h; y += 192) for (let x = 0; x < w; x += 192) g.drawImage(t, x, y, 192, 192);
    g.restore();
  }
  const CONFIG = { filmGrain: false, audienceDim: true };
  /* final grade: vignette (+ optional animated grain) */
  /* photoreal world-art backdrop (Gfx.WorldArt); returns false until the image is loaded, so callers keep the procedural art */
  function artBG(ctx, path, w, h, o) { const WA = G.WorldArt; return !!(WA && path && WA.draw(ctx, path, 0, 0, w, h, o)); }
  function finish(g, w, h, vig, grain, t) {
    if (vig > 0) {
      g.fillStyle = rgr(g, w / 2, h * 0.5, min(w, h) * 0.38, hypot(w, h) * 0.62, [0, 'rgba(2,3,12,0)', 1, 'rgba(2,3,12,' + vig + ')'], w / 2, h * 0.48);
      g.fillRect(0, 0, w, h);
    }
    if (CONFIG.filmGrain && grain > 0) {
      const p = grainPattern(g), n = floor((t || 0) * 24);
      g.save(); g.globalAlpha = grain; g.globalCompositeOperation = 'overlay';
      g.translate((h2(n, 1) * 160) | 0, (h2(n, 2) * 160) | 0); g.fillStyle = p; g.fillRect(-160, -160, w + 320, h + 320);
      g.restore();
    }
  }

  /* ======================================================================= planet looks (shared by fallbacks + surface) */
  const LOOKS = {
    // sky = [zenith, mid, horizon]; gnd = [far, mid, near]; atmo = rim colour; planet = [shadow, base, light]
    terran:   { sky: ['#2c64b8', '#6aa6e0', '#cfe6f2'], gnd: ['#5f7f8c', '#3f7a45', '#2b5a34'], atmo: '#8cc8ff', planet: ['#14346a', '#2f6fc0', '#78b867'], sun: '#fff1c8', cloud: 0.7, stars: 0 },
    jungle:   { sky: ['#1d5a55', '#4c9a78', '#bfe0a8'], gnd: ['#2f6a4a', '#1f5a3a', '#123a26'], atmo: '#9be8b0', planet: ['#0d3b2c', '#238a58', '#9bd37a'], sun: '#fff0b0', cloud: 0.8, stars: 0 },
    ocean:    { sky: ['#1a5fa8', '#52a8dc', '#c8eaf4'], gnd: ['#2d7fa8', '#1d5f90', '#133f6a'], atmo: '#8fe0ff', planet: ['#0a2a62', '#1b6cc8', '#a9e3ff'], sun: '#fff7da', cloud: 0.6, stars: 0 },
    arid:     { sky: ['#6a5a86', '#d09a74', '#f6cc98'], gnd: ['#b0683c', '#8a4a2a', '#5e3220'], atmo: '#ffc896', planet: ['#4a2418', '#b0623a', '#e8a874'], sun: '#fff0d0', cloud: 0.2, stars: 0.2 },
    steppe:   { sky: ['#3b78c0', '#86b4d8', '#e8e0b8'], gnd: ['#a89a54', '#7e8a42', '#5a6a32'], atmo: '#d8e8a8', planet: ['#3a3a1a', '#8a8a3c', '#d4cf86'], sun: '#fff2c0', cloud: 0.6, stars: 0 },
    desert:   { sky: ['#7a6aa0', '#f0b878', '#ffe2a0'], gnd: ['#d8a060', '#b4783c', '#7e502a'], atmo: '#ffd89a', planet: ['#6a3c1c', '#c8883c', '#f0cc88'], sun: '#fff6d8', cloud: 0.1, stars: 0.1 },
    minimal:  { sky: ['#07091a', '#2a2c4a', '#7a6a7a'], gnd: ['#6a5e64', '#4a4048', '#2a242c'], atmo: '#b8a8c0', planet: ['#2a2430', '#7a6a76', '#c8b8c0'], sun: '#fff4e0', cloud: 0.05, stars: 0.9 },
    barren:   { sky: ['#02030a', '#060814', '#10142a'], gnd: ['#7a7a82', '#54545c', '#303036'], atmo: '#9098b0', planet: ['#26262c', '#74747c', '#c0c0c8'], sun: '#ffffff', cloud: 0, stars: 1 },
    tundra:   { sky: ['#4a6aa8', '#a8c4e0', '#eaf2f8'], gnd: ['#dfe8f2', '#b4c6dc', '#8aa0c0'], atmo: '#d8ecff', planet: ['#2c3c64', '#a4bcd8', '#f4f8ff'], sun: '#f4f8ff', cloud: 0.5, stars: 0.05 },
    dead:     { sky: ['#1c1a1f', '#4c4a50', '#8c887e'], gnd: ['#6a665e', '#46423e', '#26221f'], atmo: '#a09a90', planet: ['#1e1c1c', '#5e5a54', '#a8a298'], sun: '#e8e0d0', cloud: 0.4, stars: 0.2 },
    inferno:  { sky: ['#2a0808', '#8a2410', '#ff8a30'], gnd: ['#5a1a10', '#3a1008', '#1a0806'], atmo: '#ff7a30', planet: ['#2a0a06', '#9a2c10', '#ff9a40'], sun: '#ffd89a', cloud: 0.6, stars: 0 },
    toxic:    { sky: ['#2a3a10', '#7a9a2a', '#d8e070'], gnd: ['#5a6a24', '#3a4a18', '#1e2a0e'], atmo: '#d0ff60', planet: ['#1a2a08', '#6a8a22', '#d0e060'], sun: '#f4ffa0', cloud: 0.7, stars: 0 },
    radiated: { sky: ['#1a0a3a', '#6a2a8a', '#c0ff70'], gnd: ['#3a2a4a', '#241a34', '#120c1c'], atmo: '#b0ff70', planet: ['#180a2a', '#5a3a7a', '#b8f860'], sun: '#e8ffb0', cloud: 0.3, stars: 0.3 },
    gaia:     { sky: ['#2a7ad8', '#74c0f0', '#fff0c8'], gnd: ['#6aa84a', '#3e9a3e', '#237a38'], atmo: '#a8e4ff', planet: ['#0e3a8a', '#2a8ad8', '#8ae07a'], sun: '#fffbe0', cloud: 0.5, stars: 0 },
    gasgiant: { sky: ['#3a2a5a', '#b87a58', '#f4d09a'], gnd: ['#a4684a', '#7a4a3a', '#4a2a2a'], atmo: '#ffcc90', planet: ['#4a2a20', '#c48858', '#f4dcb0'], sun: '#fff0d0', cloud: 0.9, stars: 0 },
    asteroids:{ sky: ['#010208', '#03040c', '#080a18'], gnd: ['#6a625a', '#48423c', '#26221e'], atmo: '#908878', planet: ['#2a2622', '#7a7068', '#c8bcb0'], sun: '#ffffff', cloud: 0, stars: 1 },
  };
  function lookOf(d) { return LOOKS[d && d.look] || LOOKS.terran; }

  /* ======================================================================= safe wrappers around sibling modules */
  function drawPortrait(g, race, x, y, w, h, o) {
    const P = G.Portraits;
    if (P && P.draw) { try { P.draw(g, race, x, y, w, h, o); return true; } catch (e) { warnOnce('Portraits.draw', e); } }
    return false;   // no stand-in figure: an empty spot beats a crude drawing
  }
  function drawBadge(g, race, cx, cy, r, o) {
    const P = G.Portraits;
    if (P && P.drawBadge) { try { P.drawBadge(g, race, cx, cy, r, o); return; } catch (e) { warnOnce('Portraits.drawBadge', e); } }
    g.save();
    g.fillStyle = rgba(o.color || C.brass, 0.85); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.strokeStyle = C.brassHi; g.lineWidth = max(1, r * 0.12); g.stroke();
    g.restore();
  }
  /* planet fallback (small shaded sphere), cached per look/seed/size */
  function fbPlanet(g, d, cx, cy, r, t) {
    const L = lookOf(d), sd = seedOf(d.seed) + 1;
    const dia = Math.max(8, Math.round(r * 2 / 4) * 4), pad = d.rings ? Math.ceil(dia * 0.5) : Math.ceil(dia * 0.1);
    const S = clamp(scaleOf(g), 1, 2);
    const e = layer('fbp|' + d.look + '|' + sd + '|' + (d.rings ? 1 : 0), dia + pad * 2, dia + pad * 2, S, (q, w, h) => {
      const R = mulberry32(sd), x = w / 2, y = h / 2, rr = dia / 2;
      if (d.rings) { q.save(); q.translate(x, y); q.rotate(-0.28); q.scale(1, 0.28); q.strokeStyle = rgba(L.planet[2], 0.45); q.lineWidth = rr * 0.2; q.beginPath(); q.arc(0, 0, rr * 1.55, PI, TAU); q.stroke(); q.restore(); }
      q.save(); q.beginPath(); q.arc(x, y, rr, 0, TAU); q.clip();
      q.fillStyle = L.planet[1]; q.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      const band = d.look === 'gasgiant';
      for (let i = 0; i < (band ? 14 : 22); i++) {
        q.fillStyle = rgba(R() < 0.5 ? L.planet[0] : L.planet[2], 0.16 + R() * 0.2);
        if (band) q.fillRect(x - rr, y - rr + R() * rr * 2, rr * 2, 2 + R() * rr * 0.14);
        else { q.beginPath(); q.ellipse(x + (R() - 0.5) * rr * 1.6, y + (R() - 0.5) * rr * 1.6, rr * (0.1 + R() * 0.3), rr * (0.06 + R() * 0.2), R() * PI, 0, TAU); q.fill(); }
      }
      q.fillStyle = rgr(q, x, y, rr * 0.3, rr * 1.15, [0, 'rgba(0,0,0,0)', 0.6, 'rgba(2,4,14,0.42)', 1, 'rgba(2,4,14,0.92)'], x - rr * 0.42, y - rr * 0.38);
      q.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      q.restore();
      q.lineWidth = max(1.5, rr * 0.05); q.strokeStyle = rgba(L.atmo, 0.5); q.beginPath(); q.arc(x, y, rr - q.lineWidth / 2, -2.6, 0.2); q.stroke();
      if (d.rings) { q.save(); q.translate(x, y); q.rotate(-0.28); q.scale(1, 0.28); q.strokeStyle = rgba(L.planet[2], 0.55); q.lineWidth = rr * 0.2; q.beginPath(); q.arc(0, 0, rr * 1.55, 0, PI); q.stroke(); q.restore(); }
    });
    const k = r * 2 / dia;
    g.drawImage(e.c, cx - (dia / 2 + pad) * k, cy - (dia / 2 + pad) * k, (dia + pad * 2) * k, (dia + pad * 2) * k);
  }
  /* live planet (rotating): Planets.draw re-renders its pixel loop when the spin moves, so keep r modest or pass spin:0 */
  function drawPlanet(g, d, cx, cy, r, t, opt) {
    d = d || { look: 'terran', seed: 1 };
    const P = G.pick('planets');
    if (P && P.draw) { try { P.draw(g, d, cx, cy, r, t, opt); return; } catch (e) { warnOnce('Planets.draw', e); } }
    fbPlanet(g, d, cx, cy, r, t);
  }
  /* planet baked for static layers: Planets.sprite renders the full-quality tier synchronously and caches it.
     r = visible disc radius (CSS px); S = pixel scale of the target layer. */
  function planetStatic(g, d, cx, cy, r, S, opt) {
    d = d || { look: 'terran', seed: 1 };
    const P = G.pick('planets');
    if (P && P.sprite) {
      try {
        const dia = Math.round(r * 2 * (d.rings ? 2.15 : 1.16));
        const o = { dpr: S * min(1, 640 / (dia * S)), sync: true };     // cap the sprite at ~640 device px (generation cost / memory); sync: a static layer is baked once, so it needs the final tier now
        if (opt) for (const k in opt) o[k] = opt[k];
        const spr = P.sprite(d, dia, o);
        if (spr && spr.width) { g.drawImage(spr, cx - dia / 2, cy - dia / 2, dia, dia); return; }
      } catch (e) { warnOnce('Planets.sprite', e); }
    }
    fbPlanet(g, d, cx, cy, r, 0);
  }
  /* starfield + nebula backdrop; Space.makeBackdrop when available */
  function fbBackdrop(w, h, seed, opts) {
    const c = mk(w, h), g = c.getContext('2d'), R = mulberry32(seedOf(seed) + 77);
    g.fillStyle = lgr(g, 0, 0, w, h, [0, '#04061a', 0.5, '#070b26', 1, '#03040f']); g.fillRect(0, 0, w, h);
    if (!opts || opts.nebula !== false) {
      const cols = ['#4a2f9a', '#1f5aa8', '#8a2f7a', '#1a7a8a'];
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const t = fogTile(seedOf(seed) + i * 31, 256, cols[(i + (seedOf(seed) & 3)) % 4], 0.38, 0.8, 0.5, 5, 3);
        g.globalAlpha = 0.5; g.save(); g.translate(R() * w, R() * h); g.rotate(R() * TAU); const k = max(w, h) / 256 * (1.2 + R());
        g.scale(k, k); g.fillStyle = g.createPattern(t, 'repeat'); g.fillRect(-300, -300, 600, 600); g.restore();
      }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'lighter';
    const n = floor(w * h / 2600);
    for (let i = 0; i < n; i++) {
      const x = R() * w, y = R() * h, m = R(), s = m > 0.985 ? 1.8 : m > 0.9 ? 1.1 : 0.7, tc = R();
      g.fillStyle = rgba(tc < 0.2 ? '#ffd9b0' : tc > 0.8 ? '#b4cfff' : '#ffffff', 0.35 + R() * 0.65);
      g.fillRect(x, y, s, s);
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  function backdropCanvas(w, h, seed, opts) {
    const Sp = G.pick('space');
    if (Sp && Sp.makeBackdrop) {
      try { const c = Sp.makeBackdrop(w, h, seed, opts || {}); if (c && (c.width || c.naturalWidth)) return c; } catch (e) { warnOnce('Space.makeBackdrop', e); }
    }
    return fbBackdrop(w, h, seed, opts);
  }
  function fbShip(g, o) {
    const s = o.size || 40, col = o.color || C.azure;
    g.save(); g.translate(o.x, o.y); g.rotate(o.angle || 0);
    glow(g, C.cyan, -s * 0.5, 0, s * 0.5 * (0.6 + (o.thrust || 0)), 0.8);
    g.fillStyle = col; g.strokeStyle = C.ivory; g.lineWidth = max(1, s * 0.03);
    g.beginPath(); g.moveTo(s * 0.6, 0); g.lineTo(-s * 0.4, s * 0.32); g.lineTo(-s * 0.22, 0); g.lineTo(-s * 0.4, -s * 0.32); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
  function drawShip(g, o) {
    const S = G.Ships;
    if (S && S.draw) { try { S.draw(g, o); return; } catch (e) { warnOnce('Ships.draw', e); } }
    fbShip(g, o);
  }
  /* portrait drawn into a feathered buffer so its hard frame edges melt into the scene */
  let _pb = null;
  function featheredPortrait(g, race, x, y, w, h, o, fx, fyTop, fyBot) {
    const S = scaleOf(g), pw = max(2, Math.ceil(w * S)), ph = max(2, Math.ceil(h * S));
    if (!_pb) _pb = mk(pw, ph);
    if (_pb.width < pw || _pb.height < ph) { _pb.width = max(_pb.width, pw); _pb.height = max(_pb.height, ph); }
    const b = _pb.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, _pb.width, _pb.height);
    b.setTransform(S, 0, 0, S, 0, 0);
    const ok = drawPortrait(b, race, 0, 0, w, h, o);
    b.globalCompositeOperation = 'destination-in';
    b.fillStyle = lgr(b, 0, 0, w, 0, [0, 'rgba(0,0,0,0)', fx, 'rgba(0,0,0,1)', 1 - fx, 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,0)']);
    b.fillRect(0, 0, w, h);
    if (fyTop > 0 || fyBot > 0) {
      b.fillStyle = lgr(b, 0, 0, 0, h, [0, fyTop > 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)', fyTop || 0.001, 'rgba(0,0,0,1)', 1 - (fyBot || 0.001), 'rgba(0,0,0,1)', 1, fyBot > 0 ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)']);
      b.fillRect(0, 0, w, h);
    }
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over';
    g.drawImage(_pb, 0, 0, pw, ph, x, y, w, h);
    return ok;
  }

  /* ======================================================================= cylindrical-room camera (curved bulkheads, drums) */
  /* world: X right, Y up, Z away from camera.  Wall = ellipse in plan (Rx, Rz) centred at Z=0, camera at Z=-D, eye height Hc.
     Lens-shift projection (verticals stay vertical).  f in px. */
  function makeRoom(p) {
    const r = { p: p };
    r.pr = (X, Y, Z) => { const s = p.f / (Z + p.D); return [p.cx + X * s, p.hy + (p.Hc - Y) * s, s]; };
    r.wall = (a, Y) => r.pr(p.Rx * sin(a), Y, p.Rz * cos(a));
    r.x = (a) => p.cx + p.f * p.Rx * sin(a) / (p.D + p.Rz * cos(a));
    r.s = (a) => p.f / (p.D + p.Rz * cos(a));
    r.y = (a, Y) => p.hy + (p.Hc - Y) * r.s(a);
    return r;
  }
  /* affine map of a wall-mounted rectangle: returns [a,b,c,d,e,f] sending local (0..mw, 0..mh) to the wall quad */
  function wallXform(room, aL, aR, yTop, yBot, mw, mh) {
    const p0 = room.wall(aL, yTop), p1 = room.wall(aR, yTop), p2 = room.wall(aL, yBot);
    return [(p1[0] - p0[0]) / mw, (p1[1] - p0[1]) / mw, (p2[0] - p0[0]) / mh, (p2[1] - p0[1]) / mh, p0[0], p0[1]];
  }
  function wallPoly(g, room, a0, a1, y0, y1, n) {
    n = n || 6;
    g.beginPath();
    for (let i = 0; i <= n; i++) { const p = room.wall(lerp(a0, a1, i / n), y1); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    for (let i = n; i >= 0; i--) { const p = room.wall(lerp(a0, a1, i / n), y0); g.lineTo(p[0], p[1]); }
    g.closePath();
  }
  function wallLine(g, room, a0, a1, Y, n) {
    n = n || 12;
    g.beginPath();
    for (let i = 0; i <= n; i++) { const p = room.wall(lerp(a0, a1, i / n), Y); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
  }

  /* ======================================================================= hologram engine (wireframe segment soup) */
  function hPoly(a, pts, closed) {
    for (let i = 0; i + 1 < pts.length; i++) a.push(pts[i][0], pts[i][1], pts[i][2], pts[i + 1][0], pts[i + 1][1], pts[i + 1][2]);
    if (closed && pts.length > 2) { const p = pts[pts.length - 1], q = pts[0]; a.push(p[0], p[1], p[2], q[0], q[1], q[2]); }
  }
  function hRing(a, cx, cy, cz, r, n, axis, a0, a1) {
    const pts = [];
    a0 = a0 || 0; a1 = a1 == null ? TAU : a1;
    for (let i = 0; i <= n; i++) {
      const q = lerp(a0, a1, i / n), u = cos(q) * r, v = sin(q) * r;
      pts.push(axis === 'y' ? [cx + u, cy, cz + v] : axis === 'x' ? [cx, cy + u, cz + v] : [cx + u, cy + v, cz]);
    }
    hPoly(a, pts, false);
  }
  function hBox(a, cx, cy, cz, sx, sy, sz) {
    const v = [];
    for (let i = 0; i < 8; i++) v.push([cx + (i & 1 ? sx : -sx), cy + (i & 2 ? sy : -sy), cz + (i & 4 ? sz : -sz)]);
    const e = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    for (const q of e) hPoly(a, [v[q[0]], v[q[1]]]);
  }
  function hSphere(a, r, nLat, nLon, cx, cy, cz) {
    cx = cx || 0; cy = cy || 0; cz = cz || 0;
    for (let i = 1; i < nLat; i++) { const ph = -PI / 2 + PI * i / nLat; hRing(a, cx, cy + sin(ph) * r, cz, cos(ph) * r, 28, 'y'); }
    for (let j = 0; j < nLon; j++) {
      const th = TAU * j / nLon, pts = [];
      for (let i = 0; i <= 18; i++) { const ph = -PI / 2 + PI * i / 18; pts.push([cx + cos(ph) * cos(th) * r, cy + sin(ph) * r, cz + cos(ph) * sin(th) * r]); }
      hPoly(a, pts, false);
    }
  }
  /* surface of revolution about Y.  prof = [[r,y],..]; rings at profile points */
  function hLathe(a, prof, nMer, ringIdx) {
    for (let m = 0; m < nMer; m++) {
      const th = TAU * m / nMer, c = cos(th), s = sin(th), pts = [];
      for (const q of prof) pts.push([q[0] * c, q[1], q[0] * s]);
      hPoly(a, pts, false);
    }
    const rs = ringIdx || prof.map((_, i) => i);
    for (const i of rs) if (prof[i][0] > 0.001) hRing(a, 0, prof[i][1], 0, prof[i][0], 28, 'y');
  }
  function hIco(a, r, freq) {
    const t = (1 + sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const norm = (p) => { const l = hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; };
    V = V.map(norm);
    for (let f = 1; f < freq; f++) {
      const cache = new Map(), NF = [];
      const mid = (i, j) => {
        const k = i < j ? i + '_' + j : j + '_' + i;
        if (cache.has(k)) return cache.get(k);
        V.push(norm([(V[i][0] + V[j][0]) / 2, (V[i][1] + V[j][1]) / 2, (V[i][2] + V[j][2]) / 2]));
        cache.set(k, V.length - 1); return V.length - 1;
      };
      for (const q of F) { const ab = mid(q[0], q[1]), bc = mid(q[1], q[2]), ca = mid(q[2], q[0]); NF.push([q[0], ab, ca], [q[1], bc, ab], [q[2], ca, bc], [ab, bc, ca]); }
      F = NF;
    }
    const seen = new Set();
    for (const q of F) for (let i = 0; i < 3; i++) {
      const p = q[i], s = q[(i + 1) % 3], k = p < s ? p + '_' + s : s + '_' + p;
      if (seen.has(k)) continue; seen.add(k);
      a.push(V[p][0] * r, V[p][1] * r, V[p][2] * r, V[s][0] * r, V[s][1] * r, V[s][2] * r);
    }
  }
  function rotSegs(a, ax, ay, az) { // rotate model about z, then x, then y (build-time helper)
    const o = a.slice();
    for (let i = 0; i < o.length; i += 3) {
      let x = o[i], y = o[i + 1], z = o[i + 2], t;
      t = x * cos(az) - y * sin(az); y = x * sin(az) + y * cos(az); x = t;
      t = y * cos(ax) - z * sin(ax); z = y * sin(ax) + z * cos(ax); y = t;
      t = x * cos(ay) + z * sin(ay); z = -x * sin(ay) + z * cos(ay); x = t;
      o[i] = x; o[i + 1] = y; o[i + 2] = z;
    }
    return o;
  }
  const _models = {};
  const MODELS = {
    computers() {
      const a = [];
      // exploded processor stack: substrate, interposer, die, heat spreader
      hBox(a, 0, -0.62, 0, 0.92, 0.035, 0.92);
      for (let i = 0; i < 10; i++) { const k = -0.74 + i * 0.165; for (const sg of [-1, 1]) { hPoly(a, [[k, -0.62, sg * 0.92], [k, -0.62, sg * 1.1]]); hPoly(a, [[sg * 0.92, -0.62, k], [sg * 1.1, -0.62, k]]); } }
      hBox(a, 0, -0.22, 0, 0.78, 0.025, 0.78);
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const x = i * 0.3, z = j * 0.3; hPoly(a, [[x - 0.035, -0.2, z], [x + 0.035, -0.2, z]]); hPoly(a, [[x, -0.2, z - 0.035], [x, -0.2, z + 0.035]]); }
      hBox(a, 0, 0.2, 0, 0.5, 0.04, 0.5);
      for (let i = -1; i <= 1; i++) { hPoly(a, [[i * 0.25, 0.245, -0.5], [i * 0.25, 0.245, 0.5]]); hPoly(a, [[-0.5, 0.245, i * 0.25], [0.5, 0.245, i * 0.25]]); }
      hRing(a, 0, 0.25, 0, 0.17, 24, 'y');
      hBox(a, 0, 0.62, 0, 0.86, 0.05, 0.86);
      for (let i = -3; i <= 3; i++) hPoly(a, [[i * 0.22, 0.675, -0.74], [i * 0.22, 0.675, 0.74]]);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { hPoly(a, [[x * 0.92, -0.585, z * 0.92], [x * 0.92, 0.57, z * 0.92]]); hPoly(a, [[x * 0.5, 0.0, z * 0.5], [x * 0.5, 0.16, z * 0.5]]); }
      hRing(a, -0.7, -0.6, -0.7, 0.05, 8, 'y');
      return a;
    },
    construction() {
      const a = [], w = 0.5;
      for (let L = 0; L < 3; L++) {
        const y0 = -0.95 + L * 0.58, y1 = y0 + 0.58, k = 1 - L * 0.1, k2 = 1 - (L + 1) * 0.1, wa = w * k, wb = w * k2;
        const c = (s, y, ww) => [[-ww, y, -ww], [ww, y, -ww], [ww, y, ww], [-ww, y, ww]];
        hPoly(a, c(0, y0, wa), true); hPoly(a, c(0, y1, wb), true);
        for (let i = 0; i < 4; i++) {
          const p = c(0, y0, wa)[i], q = c(0, y1, wb)[i], p2 = c(0, y0, wa)[(i + 1) % 4], q2 = c(0, y1, wb)[(i + 1) % 4];
          hPoly(a, [p, q]); hPoly(a, [p, q2]); hPoly(a, [p2, q]);
        }
      }
      const yt = -0.95 + 3 * 0.58;
      hPoly(a, [[0, yt, 0], [0, yt + 0.55, 0]]);
      hPoly(a, [[-0.55, yt + 0.45, 0], [1.15, yt + 0.45, 0]]); hPoly(a, [[-0.55, yt + 0.55, 0], [1.15, yt + 0.55, 0]]);
      hPoly(a, [[0, yt + 0.55, 0], [1.15, yt + 0.45, 0]]); hPoly(a, [[0, yt + 0.55, 0], [-0.55, yt + 0.5, 0]]);
      hBox(a, -0.42, yt + 0.42, 0, 0.12, 0.1, 0.1);
      hPoly(a, [[0.95, yt + 0.45, 0], [0.95, yt - 0.25, 0]]); hBox(a, 0.95, yt - 0.35, 0, 0.1, 0.08, 0.08);
      hRing(a, 0, -1.0, 0, 0.9, 32, 'y');
      return a;
    },
    forcefield() {
      const a = [];
      hIco(a, 0.98, 2);
      hRing(a, 0, 0, 0, 1.08, 40, 'y'); hRing(a, 0, 0, 0, 1.08, 40, 'x', 0.3, 5.9); hRing(a, 0, 0, 0, 1.08, 40, 'z', 1.0, 6.0);
      hPoly(a, [[0.55, 0, 0], [-0.4, 0.2, 0.14], [-0.4, 0.2, -0.14]], true); hPoly(a, [[0.55, 0, 0], [-0.4, -0.12, 0.0]]);
      hPoly(a, [[-0.4, 0.2, 0.14], [-0.4, -0.12, 0], [-0.4, 0.2, -0.14]]); hPoly(a, [[-0.1, 0.1, 0.06], [-0.28, 0.1, 0.5], [-0.4, 0.2, 0.14]]); hPoly(a, [[-0.1, 0.1, -0.06], [-0.28, 0.1, -0.5], [-0.4, 0.2, -0.14]]);
      return a;
    },
    planetology() {
      const a = [];
      hSphere(a, 0.7, 7, 12, 0, -0.28, 0);
      const stem = [], n = 10;
      for (let i = 0; i <= n; i++) { const u = i / n; stem.push([0.06 * sin(u * 3), 0.42 + u * 0.62, 0.0]); }
      hPoly(a, stem, false);
      const leaf = (sx, y, yaw) => {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const u = i / 10, l = sin(u * PI) * 0.17; pts.push([sx * (0.06 + u * 0.46), y + u * 0.14 - sin(u * PI) * 0.0 + (u * u) * 0.12, l * (i % 2 ? 1 : 1)]); }
        const back = []; for (let i = 10; i >= 0; i--) { const u = i / 10; back.push([sx * (0.06 + u * 0.46), y + u * 0.14 + (u * u) * 0.12, -sin(u * PI) * 0.17]); }
        const all = pts.concat(back);
        const c = cos(yaw), s = sin(yaw);
        hPoly(a, all.map((p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]), true);
      };
      leaf(1, 0.85, 0.0); leaf(-1, 0.72, 0.0); leaf(1, 0.55, 1.57); leaf(-1, 0.62, 1.57);
      hRing(a, 0, 1.05, 0, 0.08, 10, 'y');
      return rotSegs(a, 0.0, 0, -0.18);
    },
    propulsion() {
      const a = [];
      const prof = [[0.0, 0.95], [0.3, 0.9], [0.38, 0.75], [0.38, 0.35], [0.3, 0.2], [0.17, 0.08], [0.2, -0.1], [0.3, -0.33], [0.45, -0.58], [0.62, -0.82]];
      hLathe(a, prof, 14, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      hRing(a, 0, 0.6, 0, 0.5, 30, 'y'); hRing(a, 0, 0.5, 0, 0.5, 30, 'y');
      for (let i = 0; i < 4; i++) { const th = i * PI / 2 + PI / 4; hPoly(a, [[cos(th) * 0.38, 0.7, sin(th) * 0.38], [cos(th) * 0.62, 0.5, sin(th) * 0.62], [cos(th) * 0.62, 0.1, sin(th) * 0.62], [cos(th) * 0.3, -0.2, sin(th) * 0.3]]); }
      return a;
    },
    crown() {
      const a = [];
      hRing(a, 0, 0, 0, 0.85, 40, 'y'); hRing(a, 0, 0.3, 0, 0.9, 40, 'y');
      for (let i = 0; i < 20; i++) { const th = i * TAU / 20; hPoly(a, [[cos(th) * 0.85, 0, sin(th) * 0.85], [cos(th) * 0.9, 0.3, sin(th) * 0.9]]); }
      for (let k = 0; k < 5; k++) {
        const th = k * TAU / 5, v0 = [cos(th - 0.62) * 0.9, 0.3, sin(th - 0.62) * 0.9], pk = [cos(th) * 0.92, 0.78, sin(th) * 0.92], v1 = [cos(th + 0.62) * 0.9, 0.3, sin(th + 0.62) * 0.9];
        hPoly(a, [v0, pk, v1]);
        const cx = cos(th) * 0.92, cz = sin(th) * 0.92, j = 0.07;
        hPoly(a, [[cx, 0.86, cz], [cx + j, 0.78, cz], [cx, 0.7, cz], [cx - j, 0.78, cz]], true);
        hPoly(a, [[cx, 0.86, cz], [cx, 0.78, cz + j], [cx, 0.7, cz], [cx, 0.78, cz - j]], true);
        hPoly(a, [[cos(th) * 0.88, 0.3, sin(th) * 0.88], [cos(th) * 0.9, 0.62, sin(th) * 0.9]]);
      }
      for (let k = 0; k < 2; k++) {
        const pts = [];
        for (let i = 0; i <= 16; i++) { const u = i / 16, q = PI * u; pts.push(k ? [0, 0.78 + 0.38 * sin(q), cos(q) * 0.92] : [cos(q) * 0.92, 0.78 + 0.38 * sin(q), 0]); }
        hPoly(a, pts);
      }
      hSphere(a, 0.1, 4, 6, 0, 1.26, 0); hPoly(a, [[0, 1.36, 0], [0, 1.54, 0]]); hPoly(a, [[-0.08, 1.46, 0], [0.08, 1.46, 0]]);
      return rotSegs(a, 0, 0, 0);
    },
    ballot() {
      const a = [];
      hBox(a, 0, -0.4, 0, 0.72, 0.42, 0.72);
      hBox(a, 0, 0.06, 0, 0.78, 0.045, 0.78);
      hPoly(a, [[-0.38, 0.11, -0.05], [0.38, 0.11, -0.05], [0.38, 0.11, 0.05], [-0.38, 0.11, 0.05]], true);
      hPoly(a, [[-0.34, -0.2, 0.725], [0.34, -0.2, 0.725], [0.34, -0.62, 0.725], [-0.34, -0.62, 0.725]], true);
      hPoly(a, [[-0.17, -0.42, 0.725], [-0.06, -0.54, 0.725], [0.2, -0.28, 0.725]]);
      return a;
    },
    weapons() {
      const a = [];
      const prof = [[0, 1.0], [0.07, 0.9], [0.13, 0.7], [0.16, 0.45], [0.17, 0.3], [0.17, -0.55], [0.12, -0.7], [0.1, -0.78]];
      hLathe(a, prof, 8, [3, 4, 5, 6]);
      for (let i = 0; i < 4; i++) {
        const th = i * PI / 2, c = cos(th), s = sin(th), P = (r, y) => [r * c, y, r * s];
        hPoly(a, [P(0.17, -0.1), P(0.55, -0.62), P(0.55, -0.78), P(0.17, -0.55)], true);
        hPoly(a, [P(0.17, 0.52), P(0.3, 0.4), P(0.17, 0.34)], true);
      }
      return rotSegs(a, 0, 0, -0.62);
    },
  };
  function holoModel(name) { return _models[name] || (_models[name] = new Float32Array((MODELS[name] || MODELS.computers)())); }
  const _hs = new Float32Array(6000 * 5);
  const _hdyn = new Float32Array(900);
  /* project + draw a segment soup. opt: {yaw, pitch, roll, persp, lw, a, dyn:Float32Array,nDyn} ; model coords ~ +-1 */
  function holoDraw(g, seg, cx, cy, sc, col, opt) {
    const yaw = opt.yaw || 0, pit = opt.pitch == null ? -0.32 : opt.pitch, a = opt.a == null ? 1 : opt.a, lw = opt.lw || 1.3, pf = opt.persp == null ? 0.16 : opt.persp;
    const cy1 = cos(yaw), sy1 = sin(yaw), cp = cos(pit), sp = sin(pit);
    const nA = floor(seg.length / 6), nB = opt.nDyn ? floor(opt.nDyn / 6) : 0, n = nA + nB;
    const P = _hs;
    let zmin = 9, zmax = -9;
    for (let i = 0; i < n; i++) {
      const src = i < nA ? seg : opt.dyn, o = (i < nA ? i : i - nA) * 6;
      let zz = 0;
      for (let e = 0; e < 2; e++) {
        const x = src[o + e * 3], y = src[o + e * 3 + 1], z = src[o + e * 3 + 2];
        const x1 = x * cy1 + z * sy1, z1 = -x * sy1 + z * cy1;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp, k = 1 / (1 - z2 * pf);
        P[i * 5 + e * 2] = cx + x1 * sc * k; P[i * 5 + e * 2 + 1] = cy - y2 * sc * k; zz += z2;
      }
      zz *= 0.5; P[i * 5 + 4] = zz; if (zz < zmin) zmin = zz; if (zz > zmax) zmax = zz;
    }
    g.save();
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    const span = max(0.001, zmax - zmin);
    for (let b = 0; b < 3; b++) {
      g.beginPath();
      let any = false;
      for (let i = 0; i < n; i++) {
        const bi = (P[i * 5 + 4] - zmin) / span * 2.999 | 0;
        if (bi !== b) continue;
        g.moveTo(P[i * 5], P[i * 5 + 1]); g.lineTo(P[i * 5 + 2], P[i * 5 + 3]); any = true;
      }
      if (!any) continue;
      const al = [0.32, 0.62, 1][b] * a;
      g.strokeStyle = col; g.globalAlpha = al * 0.16; g.lineWidth = lw * 4.2; g.stroke();
      g.globalAlpha = al * 0.9; g.lineWidth = lw * (0.7 + b * 0.25); g.strokeStyle = b === 2 ? lite(col, 0.45) : col; g.stroke();
    }
    g.restore();
    return P;
  }
  /* shared holo projector base: ellipse rings + emitter glow + light cone */
  function holoBase(g, cx, cy, rx, ry, col, t, a, coneH) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    if (coneH) {
      g.globalAlpha = 0.22 * a;
      g.fillStyle = lgr(g, 0, cy, 0, cy - coneH, [0, rgba(col, 0.75), 0.4, rgba(col, 0.2), 1, rgba(col, 0)]);
      g.beginPath(); g.moveTo(cx - rx * 0.92, cy); g.lineTo(cx + rx * 0.92, cy); g.lineTo(cx + rx * 0.4, cy - coneH); g.lineTo(cx - rx * 0.4, cy - coneH); g.closePath(); g.fill();
    }
    glow(g, col, cx, cy, rx * 1.35, 0.5 * a);
    g.lineWidth = max(1, rx * 0.012);
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.2;
      g.globalAlpha = (0.85 - i * 0.2) * a; g.strokeStyle = i === 0 ? lite(col, 0.4) : col;
      g.beginPath(); g.ellipse(cx, cy, rx * k, ry * k, 0, 0, TAU); g.stroke();
    }
    g.globalAlpha = 0.9 * a; g.lineWidth = max(1.5, rx * 0.022);
    for (let i = 0; i < 12; i++) {
      const q = t * 0.6 + i * TAU / 12, c1 = cos(q), s1 = sin(q);
      g.beginPath(); g.moveTo(cx + c1 * rx * 0.88, cy + s1 * ry * 0.88); g.lineTo(cx + c1 * rx * 0.96, cy + s1 * ry * 0.96); g.stroke();
    }
    g.restore();
  }
  /* rising scan-lines + sparkle motes inside a hologram region */
  function holoScan(g, cx, cy, rx, ry, col, t, a) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = col; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 0.35 + i / 3), y = cy + ry - u * ry * 2, k = sqrt(max(0, 1 - pow(u * 2 - 1, 2)));
      g.globalAlpha = 0.42 * a * sin(u * PI);
      g.beginPath(); g.moveTo(cx - rx * k, y); g.lineTo(cx + rx * k, y); g.stroke();
    }
    g.fillStyle = lite(col, 0.5);
    for (let i = 0; i < 14; i++) {
      const u = fract(t * (0.08 + h2(i, 3) * 0.1) + h2(i, 5)), x = cx + (h2(i, 7) - 0.5) * rx * 1.7, y = cy + ry - u * ry * 2.2;
      g.globalAlpha = a * 0.7 * sin(u * PI); g.fillRect(x, y, 1.6, 1.6);
    }
    g.restore();
  }

  /* ======================================================================= animated monitor contents */
  /* local space (0,0)-(w,h); caller has applied transform + clip. col = accent colour. */
  const SCR = {
    data(g, w, h, t, sd, col) {
      const rh = max(4, h / 15), cols = clamp(floor(w / 40), 2, 5), off = (t * rh * 2.2) % rh, base = floor(t * 2.2);
      const cw = w / cols;
      g.fillStyle = rgba(col, 0.55); g.beginPath();
      const hi = [];
      for (let r = -1; r < 16; r++) {
        const ri = base - r;
        for (let c = 0; c < cols; c++) {
          const v = h2(ri * 7 + c, sd + c * 13);
          if (v < 0.18) continue;
          const x0 = c * cw + 3, len = (cw - 8) * (0.25 + h2(ri, sd + c) * 0.75), y = r * rh + off + 2;
          if (v > 0.92) hi.push(x0, y, len); else g.rect(x0, y, len, max(1.5, rh * 0.42));
        }
      }
      g.fill();
      g.fillStyle = rgba(lite(col, 0.55), 0.95); g.beginPath();
      for (let i = 0; i < hi.length; i += 3) g.rect(hi[i], hi[i + 1], hi[i + 2], max(1.5, rh * 0.42));
      g.fill();
    },
    wave(g, w, h, t, sd, col) {
      g.strokeStyle = rgba(col, 0.14); g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < 5; i++) { g.moveTo(0, h * i / 5); g.lineTo(w, h * i / 5); }
      for (let i = 1; i < 8; i++) { g.moveTo(w * i / 8, 0); g.lineTo(w * i / 8, h); }
      g.stroke();
      for (let k = 0; k < 3; k++) {
        const f = 0.05 + k * 0.035 + h2(sd, k) * 0.03, sp = 1.4 + k * 0.9, am = h * (0.26 - k * 0.05);
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = h / 2 + sin(x * f + t * sp) * am * 0.55 + sin(x * f * 2.3 - t * sp * 1.3 + k) * am * 0.3 + (vn1(x * 0.09 + t * 3, sd + k) - 0.5) * am * 0.5;
          if (x) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.strokeStyle = rgba(k === 0 ? lite(col, 0.4) : col, k === 0 ? 0.95 : 0.55); g.lineWidth = k === 0 ? 1.6 : 1; g.stroke();
      }
    },
    ecg(g, w, h, t, sd, col) {
      g.strokeStyle = rgba(col, 0.12); g.lineWidth = 1; g.beginPath();
      for (let i = 1; i < 6; i++) { g.moveTo(0, h * i / 6); g.lineTo(w, h * i / 6); }
      g.stroke();
      const per = w * 0.55, head = (t * w * 0.5) % (w + per);
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        if (x > head) break;
        const u = fract((x - 0) / per);
        let y = 0;
        if (u > 0.30 && u < 0.34) y = -(u - 0.30) / 0.04 * 0.25; else if (u >= 0.34 && u < 0.38) y = -0.25 + (u - 0.34) / 0.04 * 0.2;
        else if (u >= 0.38 && u < 0.42) y = -0.05 - (u - 0.38) / 0.04 * 0.95 * 0 + 0;
        if (u > 0.5 && u < 0.54) y = (u - 0.5) / 0.04 * 0.95; else if (u >= 0.54 && u < 0.58) y = 0.95 - (u - 0.54) / 0.04 * 1.9; else if (u >= 0.58 && u < 0.62) y = -0.95 + (u - 0.58) / 0.04 * 0.95;
        const yy = h * 0.55 - y * h * 0.32;
        if (x) g.lineTo(x, yy); else g.moveTo(x, yy);
      }
      g.strokeStyle = rgba(lite(col, 0.3), 0.95); g.lineWidth = 1.6; g.stroke();
      glow(g, col, min(head, w), h * 0.55, h * 0.3, 0.8);
    },
    map(g, w, h, t, sd, col) {
      const R = mulberry32(sd + 5), n = 15, pts = [];
      for (let i = 0; i < n; i++) pts.push([0.08 + R() * 0.84, 0.1 + R() * 0.8]);
      g.strokeStyle = rgba(col, 0.28); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
        if (dx * dx + dy * dy < 0.055) { g.moveTo(pts[i][0] * w, pts[i][1] * h); g.lineTo(pts[j][0] * w, pts[j][1] * h); }
      }
      g.stroke();
      for (let i = 0; i < n; i++) {
        const tw = 0.5 + 0.5 * sin(t * (1.2 + i * 0.37) + i * 2);
        g.fillStyle = rgba(i % 5 === 0 ? C.gold : lite(col, 0.4), 0.55 + 0.45 * tw);
        const r = i % 5 === 0 ? 2.4 : 1.5;
        g.fillRect(pts[i][0] * w - r, pts[i][1] * h - r, r * 2, r * 2);
      }
      const k = ((floor(t * 0.4) % n) + n) % n, p = pts[k], q = 0.5 + 0.5 * sin(t * 4);
      g.strokeStyle = rgba(C.ivory, 0.9); g.lineWidth = 1;
      const rr = 5 + q * 3; g.strokeRect(p[0] * w - rr, p[1] * h - rr, rr * 2, rr * 2);
      const sw = (t * 0.7) % 1;
      g.fillStyle = rgba(col, 0.1); g.fillRect(0, sw * h, w, 2);
    },
    bars(g, w, h, t, sd, col) {
      const n = clamp(floor(w / 9), 6, 24), bw = w / n;
      g.fillStyle = rgba(col, 0.75);
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const v = 0.15 + 0.85 * (0.5 + 0.5 * sin(t * (1.5 + h2(i, sd) * 3) + i * 1.7)) * (0.5 + 0.5 * vn1(t * 0.8 + i, sd));
        const bh = v * h * 0.88; g.rect(i * bw + 1.5, h - bh - 2, bw - 3, bh);
      }
      g.fill();
      g.fillStyle = rgba(lite(col, 0.6), 0.9); g.beginPath();
      for (let i = 0; i < n; i++) {
        const v = 0.15 + 0.85 * (0.5 + 0.5 * sin(t * (1.5 + h2(i, sd) * 3) + i * 1.7)) * (0.5 + 0.5 * vn1(t * 0.8 + i, sd));
        g.rect(i * bw + 1.5, h - v * h * 0.88 - 3.5, bw - 3, 1.6);
      }
      g.fill();
    },
    radar(g, w, h, t, sd, col) {
      const cx = w / 2, cy = h / 2, r = min(w, h) * 0.44;
      g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1;
      for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(cx, cy, r * i / 3, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
      const a = t * 1.7;
      for (let i = 0; i < 10; i++) {
        const q = h2(i, sd) * TAU, d = 0.25 + h2(i, sd + 9) * 0.7, age = fract((a - q) / TAU);
        g.fillStyle = rgba(lite(col, 0.5), (1 - age) * (1 - age)); g.fillRect(cx + cos(q) * r * d - 1.5, cy + sin(q) * r * d - 1.5, 3, 3);
      }
      for (let i = 0; i < 14; i++) { g.strokeStyle = rgba(col, 0.06 + i * 0.012); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cos(a - i * 0.06) * r, cy + sin(a - i * 0.06) * r); g.stroke(); }
      g.strokeStyle = rgba(lite(col, 0.5), 0.95); g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cos(a) * r, cy + sin(a) * r); g.stroke();
    },
    graph(g, w, h, t, sd, col) {
      const pts = [];
      for (let x = 0; x <= w; x += 3) pts.push(x, h * (0.78 - 0.55 * (vn1((x + t * 22) * 0.05, sd) * 0.7 + vn1((x + t * 22) * 0.17, sd + 4) * 0.3)));
      g.beginPath(); g.moveTo(0, h);
      for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.lineTo(w, h); g.closePath();
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, rgba(col, 0.38), 1, rgba(col, 0.02)]); g.fill();
      g.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) g.lineTo(pts[i], pts[i + 1]); else g.moveTo(pts[i], pts[i + 1]); }
      g.strokeStyle = rgba(lite(col, 0.4), 0.95); g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = rgba(col, 0.15); g.lineWidth = 1; g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); } g.stroke();
    },
    helix(g, w, h, t, sd, col) {
      const n = 26, a = t * 1.6;
      g.lineWidth = 1.4;
      for (let s = 0; s < 2; s++) {
        g.beginPath();
        for (let i = 0; i <= n; i++) { const u = i / n, x = w * 0.5 + sin(u * 9 + a + s * PI) * w * 0.3, y = u * h; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.strokeStyle = rgba(s ? lite(col, 0.5) : col, 0.9); g.stroke();
      }
      g.strokeStyle = rgba(col, 0.4); g.beginPath();
      for (let i = 0; i <= n; i += 1) { const u = i / n, d = sin(u * 9 + a) * w * 0.3; g.moveTo(w * 0.5 + d, u * h); g.lineTo(w * 0.5 - d, u * h); }
      g.stroke();
    },
    dial(g, w, h, t, sd, col) {
      const cx = w / 2, cy = h * 0.58, r = min(w * 0.45, h * 0.5);
      g.strokeStyle = rgba(col, 0.5); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, PI * 1.05, PI * 1.95); g.stroke();
      g.strokeStyle = rgba(col, 0.4); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 10; i++) { const q = PI * (1.05 + 0.9 * i / 10); g.moveTo(cx + cos(q) * r * 0.82, cy + sin(q) * r * 0.82); g.lineTo(cx + cos(q) * r * 0.96, cy + sin(q) * r * 0.96); }
      g.stroke();
      const v = 0.5 + 0.4 * sin(t * 0.9 + sd) * sin(t * 0.37 + sd * 2), q = PI * (1.05 + 0.9 * v);
      g.strokeStyle = rgba(C.ivory, 0.95); g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cos(q) * r * 0.9, cy + sin(q) * r * 0.9); g.stroke();
      g.fillStyle = rgba(col, 0.9); g.beginPath(); g.arc(cx, cy, 2.4, 0, TAU); g.fill();
    },
  };
  /* draws one monitor screen in LOCAL space; caller applies transform. frame/bezel belongs to the static layer. */
  function screenDraw(g, kind, w, h, t, sd, col, a) {
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.globalAlpha = a == null ? 1 : a;
    g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#050b22', 1, '#03061a']); g.fillRect(0, 0, w, h);
    (SCR[kind] || SCR.data)(g, w, h, t, sd, col);
    g.globalAlpha = (a == null ? 1 : a) * 0.5; g.fillStyle = scanPattern(g); g.fillRect(0, 0, w, h);
    g.globalAlpha = (a == null ? 1 : a) * 0.07; g.fillStyle = lgr(g, 0, 0, w, h, [0, '#fff', 0.45, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0)']);
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  const Scenes = {};

  /* ======================================================================= shared scene helpers */
  function circlePts(room, X, Y, Z, r, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const q = TAU * i / n, p = room.pr(X + cos(q) * r, Y, Z + sin(q) * r); out.push(p[0], p[1]); }
    return out;
  }
  function strokePts(g, pts, close) {
    g.beginPath(); g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    if (close) g.closePath();
  }
  function ptsBox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i += 2) { x0 = min(x0, pts[i]); x1 = max(x1, pts[i]); y0 = min(y0, pts[i + 1]); y1 = max(y1, pts[i + 1]); }
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0 };
  }
  /* depth-of-field "calm zone": blur grows smoothly from 0 at x0 to maxBlur beyond x0+ramp (n strips), plus a dimming ramp */
  function defocus(g, c, kk, x0, y0, x1, y1, maxBlur, dim, ramp) {
    const ww = x1 - x0, hh = y1 - y0;
    if (ww < 4 || hh < 4) return;
    const src = mk(c.width, c.height); src.getContext('2d').drawImage(c, 0, 0);          // untouched copy to read from
    const n = 6, m = Math.ceil(maxBlur * 2.5), sw = ramp / n;
    for (let i = 0; i < n + 1; i++) {
      const bx0 = x0 + i * sw, bx1 = i === n ? x1 : bx0 + sw, blur = maxBlur * sstep(0, 1, (i + 0.5) / (n + 0.5));
      const rx0 = max(0, bx0 - m), rx1 = min(c.width / kk, bx1 + m), rw = rx1 - rx0;
      const t = mk(rw * kk, hh * kk), tg = t.getContext('2d');
      if ('filter' in tg && blur > 0.05) tg.filter = 'blur(' + (blur * kk).toFixed(1) + 'px)';
      tg.drawImage(src, rx0 * kk, y0 * kk, rw * kk, hh * kk, 0, 0, t.width, t.height);
      g.save(); g.beginPath(); g.rect(bx0, y0, bx1 - bx0 + (i < n ? 0.5 : 0), hh); g.clip(); g.drawImage(t, rx0, y0, rw, hh); g.restore();
      t.width = t.height = 1;
    }
    src.width = src.height = 1;
    g.fillStyle = lgr(g, x0, 0, x1, 0, [0, 'rgba(5,8,24,0)', min(0.9, ramp / ww), 'rgba(5,8,24,' + dim + ')', 1, 'rgba(5,8,24,' + dim + ')']);
    g.fillRect(x0, y0, ww, hh);
  }
  /* soft volumetric beam (trapezoid with an along-axis alpha ramp), drawn additively */
  // A shaft of light. Four nested trapezoids add up to the full intensity `a` along the axis and fade toward the sides, so the shaft has soft
  // edges; a single hard-sided trapezoid (the old shape) read as a pasted translucent panel (the Council's oculus shaft looked like a glass box).
  const BEAM_LAYERS = [[1, 0.14], [0.74, 0.2], [0.5, 0.28], [0.27, 0.38]];
  function beam(g, x0, y0, x1, y1, w0, w1, col, a) {
    const dx = x1 - x0, dy = y1 - y0, l = hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < BEAM_LAYERS.length; i++) {
      const k = BEAM_LAYERS[i][0], b = a * BEAM_LAYERS[i][1], v0 = w0 * k / 2, v1 = w1 * k / 2;
      g.fillStyle = lgr(g, x0, y0, x1, y1, [0, rgba(col, b), 0.5, rgba(col, b * 0.45), 1, rgba(col, 0)]);
      g.beginPath(); g.moveTo(x0 + nx * v0, y0 + ny * v0); g.lineTo(x1 + nx * v1, y1 + ny * v1); g.lineTo(x1 - nx * v1, y1 - ny * v1); g.lineTo(x0 - nx * v0, y0 - ny * v0); g.closePath(); g.fill();
    }
    g.restore();
  }
  /* drifting dust motes (stateless): n motes inside a rect */
  function motes(g, x, y, w, h, n, t, col, a, seed, size) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const sp = 0.012 + h2(i, seed + 1) * 0.02, u = fract(h2(i, seed) + t * sp), v = fract(h2(i, seed + 2) - t * sp * 0.7);
      const px = x + (u + sin(t * 0.3 + i * 1.7) * 0.02) * w, py = y + v * h, tw = 0.5 + 0.5 * sin(t * (0.6 + h2(i, seed + 3) * 1.6) + i);
      g.globalAlpha = a * tw * sin(v * PI);
      const s = (size || 1.6) * (0.6 + h2(i, seed + 4));
      g.fillRect(px, py, s, s);
    }
    g.restore();
  }

  /* ======================================================================= LAB : the research bridge */
  const HOLO_COL = { computers: '#62d8ff', construction: '#ffc46a', forcefield: '#a98bff', planetology: '#5fdc8f', propulsion: '#62d8ff', weapons: '#ff7a86' };
  const FIELD_LABEL = { computers: 'COMPUTERS', construction: 'CONSTRUCTION', forcefield: 'FORCE FIELDS', planetology: 'PLANETOLOGY', propulsion: 'PROPULSION', weapons: 'WEAPONS' };
  // a = wall angle (rad) of centre, aw = angular width, y = world height of centre, yh = world height
  const LAB_MONS = [
    { a: -0.74, aw: 0.15, y: 0.95, yh: 0.19, kind: 'wave', col: '#62d8ff', sd: 3 },
    { a: -0.555, aw: 0.15, y: 0.95, yh: 0.19, kind: 'map', col: '#a98bff', sd: 8 },
    { a: -0.385, aw: 0.15, y: 0.95, yh: 0.19, kind: 'data', col: '#5fdc8f', sd: 5 },
    { a: -0.725, aw: 0.11, y: 0.7, yh: 0.15, kind: 'dial', col: '#ffd54f', sd: 11 },
    { a: -0.258, aw: 0.062, y: 0.6, yh: 0.5, kind: 'helix', col: '#62d8ff', sd: 2 },
    { a: -0.258, aw: 0.062, y: 0.93, yh: 0.2, kind: 'bars', col: '#ff9440', sd: 4 },
    { a: 0.262, aw: 0.062, y: 0.6, yh: 0.5, kind: 'bars', col: '#5fdc8f', sd: 6 },
    { a: 0.262, aw: 0.062, y: 0.93, yh: 0.2, kind: 'radar', col: '#62d8ff', sd: 9 },
    { a: 0.45, aw: 0.15, y: 0.95, yh: 0.19, kind: 'data', col: '#62d8ff', sd: 12 },
    { a: 0.62, aw: 0.15, y: 0.95, yh: 0.19, kind: 'wave', col: '#a98bff', sd: 13 },
    { a: 0.79, aw: 0.15, y: 0.95, yh: 0.19, kind: 'graph', col: '#5fdc8f', sd: 14 },
    { a: 0.54, aw: 0.2, y: 0.58, yh: 0.3, kind: 'map', col: '#62d8ff', sd: 15 },
    { a: 0.76, aw: 0.2, y: 0.58, yh: 0.3, kind: 'ecg', col: '#ff5c6a', sd: 16 },
  ];
  function labRoom(w, h) {
    const f = h * 1.42, D = 1.5, Rz = 1.0, aE = 0.95;
    const Rx = (w * 0.5) * (D + Rz * cos(aE)) / (f * sin(aE));
    return makeRoom({ cx: w * 0.46, hy: h * 0.44, f: f, D: D, Rx: Rx, Rz: Rz, Hc: 0.62, Hw: 1.12 });
  }
  const LAB_TAB = { Z: 0.3, r: 0.33, H: 0.26 };
  function winPath(g, room, aw, yb, yt, rise) {
    g.beginPath();
    let q = room.wall(-aw, yb); g.moveTo(q[0], q[1]);
    q = room.wall(-aw, yt); g.lineTo(q[0], q[1]);
    for (let i = 1; i <= 28; i++) { const u = -1 + 2 * i / 28; q = room.wall(aw * u, yt + rise * sqrt(max(0, 1 - u * u))); g.lineTo(q[0], q[1]); }
    q = room.wall(aw, yb); g.lineTo(q[0], q[1]);
    g.closePath();
  }
  function buildLab(g, w, h, c, pd) {
    const room = labRoom(w, h), p = room.p, Hw = p.Hw, kk = c.width / w, AM = 1.5, s0 = room.s(0);
    const geo = { room: room, w: w, h: h, mons: [], win: null, tab: null, stars: [], k: kk };
    g.fillStyle = '#05081c'; g.fillRect(0, 0, w, h);

    /* ---- ceiling */
    const wallTop = [], wallBot = [];
    for (let i = 0; i <= 60; i++) { const a = lerp(-AM, AM, i / 60); wallTop.push(room.x(a), room.y(a, Hw)); wallBot.push(room.x(a), room.y(a, 0)); }
    g.save();
    g.beginPath(); g.moveTo(wallTop[0], -20);
    for (let i = 0; i < wallTop.length; i += 2) g.lineTo(wallTop[i], wallTop[i + 1]);
    g.lineTo(wallTop[wallTop.length - 2], -20); g.closePath();
    g.fillStyle = lgr(g, 0, 0, 0, room.y(0, Hw), [0, '#03051a', 0.62, '#0d1540', 1, '#1c2864']); g.fill();
    g.clip();
    const ringPts = (kr) => { const pts = []; for (let a = -1.5; a <= 1.5001; a += 0.05) { const q = room.pr(kr * p.Rx * sin(a), Hw, kr * p.Rz * cos(a)); pts.push(q[0], q[1]); } return pts; };
    g.lineWidth = 1.2;
    for (const kr of [0.4, 0.66, 0.86, 1.0]) { strokePts(g, ringPts(kr)); g.strokeStyle = rgba(C.brassLo, 0.5); g.stroke(); }
    for (let j = -9; j <= 9; j++) {
      const a = j * 0.19, q0 = room.pr(0.3 * p.Rx * sin(a), Hw, 0.3 * p.Rz * cos(a)), q1 = room.pr(p.Rx * sin(a), Hw, p.Rz * cos(a));
      g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.strokeStyle = rgba(C.brassLo, 0.38); g.stroke();
    }
    g.globalCompositeOperation = 'lighter';
    for (const kr of [0.52, 0.78, 0.95]) {
      const pts = ringPts(kr);
      strokePts(g, pts); g.lineWidth = 8; g.strokeStyle = rgba('#7fc8ff', 0.06); g.stroke();
      g.lineWidth = 2.4; g.strokeStyle = rgba('#bfe4ff', 0.42); g.stroke();
    }
    const lamp = circlePts(room, 0, Hw, LAB_TAB.Z, 0.36, 48), lb = ptsBox(lamp);
    glow(g, '#9fd8ff', (lb.x0 + lb.x1) / 2, (lb.y0 + lb.y1) / 2, lb.w * 0.9, 0.5);
    strokePts(g, lamp, true); g.lineWidth = 3; g.strokeStyle = rgba('#e6f6ff', 0.85); g.stroke();
    g.restore();

    /* ---- wall: panels, plates, seams */
    const da = 0.118, secs = [[0, 0.19], [0.19, 0.86], [0.86, Hw]];
    let idx = 0;
    for (let a0 = -1.06; a0 < 1.2; a0 += da, idx++) {
      const a1 = a0 + da, am = a0 + da / 2, lum = 0.5 + 0.5 * cos(am * 1.15);
      for (let s = 0; s < 3; s++) {
        const y0 = secs[s][0], y1 = secs[s][1];
        const base = s === 0 ? mixc('#070b24', '#12194a', lum) : s === 1 ? mixc('#0a1132', '#1c2864', lum) : mixc('#080d2a', '#18225a', lum);
        const yt = room.y(am, y1), yb = room.y(am, y0);
        wallPoly(g, room, a0, a1, y0, y1, 3);
        g.fillStyle = lgr(g, 0, yt, 0, yb, [0, dark(base, 0.32), 0.5, base, 1, dark(base, 0.42)]); g.fill();
        if (s === 1) {
          const ia = da * 0.14, iy = 0.05;
          wallPoly(g, room, a0 + ia, a1 - ia, y0 + iy, y1 - iy, 3);
          const pc = mixc('#10194a', '#2c3c8a', lum);
          g.fillStyle = lgr(g, 0, yt, 0, yb, [0, dark(pc, 0.15), 0.4, pc, 1, dark(pc, 0.34)]); g.fill();
          g.lineWidth = 1; g.strokeStyle = rgba('#000', 0.5); g.stroke();
          const q0 = room.wall(a0 + ia, y1 - iy), q1 = room.wall(a1 - ia, y1 - iy);
          g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.strokeStyle = rgba(C.mist, 0.1 + 0.2 * lum); g.stroke();
        } else if (s === 2 && idx % 2 === 0) {
          for (let v = 1; v <= 4; v++) { wallLine(g, room, a0 + da * 0.2, a1 - da * 0.2, lerp(y0, y1, 0.14 + v * 0.14), 3); g.lineWidth = 2; g.strokeStyle = rgba('#000', 0.55); g.stroke(); }
        }
      }
      const sA = room.wall(a0, 0), sB = room.wall(a0, Hw);
      g.beginPath(); g.moveTo(sA[0], sA[1]); g.lineTo(sB[0], sB[1]); g.lineWidth = 2.2; g.strokeStyle = rgba('#000', 0.6); g.stroke();
      g.beginPath(); g.moveTo(sA[0] + 1.6, sA[1]); g.lineTo(sB[0] + 1.6, sB[1]); g.lineWidth = 1; g.strokeStyle = rgba(C.brass, 0.3); g.stroke();
      if (idx % 3 === 0) { // structural rib
        wallPoly(g, room, a0 - 0.012, a0 + 0.012, 0, Hw, 1);
        g.fillStyle = lgr(g, room.x(a0 - 0.012), 0, room.x(a0 + 0.012), 0, [0, '#06091f', 0.5, mixc('#2a3a82', '#5a6aba', lum * 0.7), 1, '#060a20']); g.fill();
        g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.8); g.stroke();
      }
    }
    const bandAt = (Y, th) => {
      wallLine(g, room, -1.1, 1.3, Y, 60); g.lineWidth = th * 2 * s0; g.strokeStyle = C.brassLo; g.stroke();
      wallLine(g, room, -1.1, 1.3, Y + th * 0.55, 60); g.lineWidth = max(1, th * 0.8 * s0); g.strokeStyle = rgba(C.brassHi, 0.85); g.stroke();
      wallLine(g, room, -1.1, 1.3, Y - th * 0.7, 60); g.lineWidth = max(1, th * 0.7 * s0); g.strokeStyle = rgba('#241a0a', 0.8); g.stroke();
    };
    bandAt(0.19, 0.012); bandAt(0.86, 0.012); bandAt(Hw - 0.01, 0.018); bandAt(0.03, 0.01);
    for (let a = -1.0; a < 1.2; a += da * 0.5) { // rivets along bands
      const r1 = room.wall(a, 0.19), r2 = room.wall(a, 0.86);
      rivets(g, [r1[0], r1[1], r2[0], r2[1]], max(1, s0 * 0.0042), C.brassLo);
    }
    // light strip along the foot of the wall
    g.save(); g.globalCompositeOperation = 'lighter';
    wallLine(g, room, -1.1, 1.3, 0.085, 60); g.lineWidth = 6; g.strokeStyle = rgba(C.cyan, 0.08); g.stroke();
    g.lineWidth = 1.6; g.strokeStyle = rgba('#aeeaff', 0.5); g.stroke();
    g.restore();

    /* ---- window frame + view */
    const WA = 0.17, WYB = 0.24, WYT = 0.84, WR = 0.22;
    winPath(g, room, WA + 0.035, WYB - 0.045, WYT, WR + 0.05);
    g.fillStyle = lgr(g, 0, room.y(0, WYB + WR), 0, room.y(0, WYB), [0, '#2a3774', 0.5, '#141d52', 1, '#0a1030']); g.fill();
    g.lineWidth = 2.4; g.strokeStyle = brassGrad(g, room.x(-WA), 0, room.x(WA), 0); g.stroke();
    winPath(g, room, WA + 0.02, WYB - 0.025, WYT, WR + 0.03);
    g.lineWidth = 1; g.strokeStyle = rgba('#000', 0.6); g.stroke();
    // window opening polygon bounding box
    const wp = [];
    {
      let q = room.wall(-WA, WYB); wp.push(q[0], q[1]); q = room.wall(-WA, WYT); wp.push(q[0], q[1]);
      for (let i = 1; i <= 28; i++) { const u = -1 + 2 * i / 28; q = room.wall(WA * u, WYT + WR * sqrt(max(0, 1 - u * u))); wp.push(q[0], q[1]); }
      q = room.wall(WA, WYB); wp.push(q[0], q[1]);
    }
    const wb = ptsBox(wp);
    geo.win = { pts: wp, x: wb.x0, y: wb.y0, w: wb.w, h: wb.h };
    g.save();
    strokePts(g, wp, true); g.clip();
    const bd = backdropCanvas(max(64, Math.ceil(wb.w)), max(64, Math.ceil(wb.h)), 'labwin' + (pd.seed || 0), { nebula: true });
    g.drawImage(bd, wb.x0, wb.y0, wb.w, wb.h);
    const pr = wb.w * 0.95, pcx = wb.x0 + wb.w * 0.16, pcy = wb.y1 + pr * 0.28;
    planetStatic(g, pd, pcx, pcy, pr, kk, { lightAngle: -0.75 });
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#8fd6ff', 0.4); g.lineWidth = 3; g.beginPath(); g.arc(pcx, pcy, pr + 1, -2.0, -0.55); g.stroke();
    glow(g, '#fff4d0', wb.x0 + wb.w * 0.86, wb.y0 + wb.h * 0.2, wb.w * 0.8, 0.55);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = lgr(g, 0, wb.y0, 0, wb.y1, [0, 'rgba(10,14,50,0.0)', 0.55, 'rgba(8,12,44,0.0)', 0.82, 'rgba(6,9,36,0.38)', 1, 'rgba(4,6,28,0.62)']); g.fillRect(wb.x0, wb.y0, wb.w, wb.h);
    const R = mulberry32(99);
    for (let i = 0; i < 14; i++) geo.stars.push({ x: wb.x0 + R() * wb.w, y: wb.y0 + R() * wb.h * 0.7, s: 2 + R() * 3, ph: R() * 6 });
    // distant orbital station silhouette
    g.save(); g.translate(wb.x0 + wb.w * 0.72, wb.y0 + wb.h * 0.42); g.rotate(-0.25);
    g.strokeStyle = rgba('#0a1030', 0.9); g.fillStyle = rgba('#26335f', 0.95); g.lineWidth = 1.2;
    g.beginPath(); g.ellipse(0, 0, wb.w * 0.07, wb.w * 0.018, 0, 0, TAU); g.fill(); g.stroke();
    g.fillRect(-wb.w * 0.004, -wb.w * 0.035, wb.w * 0.008, wb.w * 0.07); g.fillRect(-wb.w * 0.03, -1, wb.w * 0.06, 2);
    g.restore();
    g.restore();
    // glass edge bevel
    strokePts(g, wp, true); g.lineWidth = 3; g.strokeStyle = rgba('#000', 0.65); g.stroke();
    g.lineWidth = 1; g.strokeStyle = rgba(C.brassHi, 0.55); g.stroke();
    // window cill + mullion shadow
    const cl = room.wall(-WA - 0.05, WYB - 0.045), cr = room.wall(WA + 0.05, WYB - 0.045);
    g.fillStyle = lgr(g, 0, cl[1], 0, cl[1] + 14, [0, C.brassHi, 0.3, C.brass, 1, '#3a2c14']);
    g.fillRect(cl[0], cl[1], cr[0] - cl[0], max(5, s0 * 0.016));

    /* ---- monitors (static bezel + dark glass; live content drawn per frame) */
    for (const m of LAB_MONS) {
      const a0 = m.a - m.aw / 2, a1 = m.a + m.aw / 2, y0 = m.y - m.yh / 2, y1 = m.y + m.yh / 2;
      wallPoly(g, room, a0 - 0.011, a1 + 0.011, y0 - 0.02, y1 + 0.02, 3);
      g.fillStyle = '#060a20'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = rgba(C.brass, 0.8); g.stroke();
      wallPoly(g, room, a0, a1, y0, y1, 3); g.fillStyle = '#02040e'; g.fill();
      const P0 = room.wall(a0, y1), P1 = room.wall(a1, y1), P2 = room.wall(a0, y0), P3 = room.wall(a1, y0);
      const pw = hypot(P1[0] - P0[0], P1[1] - P0[1]), ph = hypot(P2[0] - P0[0], P2[1] - P0[1]);
      geo.mons.push({ xf: wallXform(room, a0, a1, y1, y0, pw, ph), w: pw, h: ph, kind: m.kind, col: m.col, sd: m.sd, dim: m.a > 0.35,
        cx: (P0[0] + P3[0]) / 2, cy: (P0[1] + P3[1]) / 2 });
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const m of geo.mons) glowL(g, m.col, m.cx, m.cy, max(m.w, m.h) * 1.5, m.dim ? 0.09 : 0.2);
    glowL(g, '#9ecbff', geo.win.x + geo.win.w / 2, geo.win.y + geo.win.h * 0.55, geo.win.w * 1.6, 0.22);
    g.restore();

    /* ---- floor */
    g.save();
    g.beginPath(); g.moveTo(wallBot[0], h + 20);
    for (let i = 0; i < wallBot.length; i += 2) g.lineTo(wallBot[i], wallBot[i + 1]);
    g.lineTo(wallBot[wallBot.length - 2], h + 20); g.closePath();
    g.fillStyle = lgr(g, 0, room.y(0, 0), 0, h, [0, '#17215a', 0.3, '#0c1440', 1, '#04061a']); g.fill();
    g.clip();
    g.lineWidth = 1;
    for (let X = -5; X <= 5.01; X += 0.42) {
      const zEnd = p.Rz * sqrt(max(0, 1 - pow(X / p.Rx, 2))), a = room.pr(X, 0, -0.5), b = room.pr(X, 0, zEnd);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = rgba(C.brass, 0.1); g.stroke();
    }
    for (let Z = -0.5; Z <= 1.0; Z += 0.19) {
      const xe = p.Rx * sqrt(max(0, 1 - pow(Z / p.Rz, 2))), a = room.pr(-xe, 0, Z), b = room.pr(xe, 0, Z);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = rgba(C.brass, 0.1); g.stroke();
    }
    for (const rr of [0.46, 0.62]) { strokePts(g, circlePts(room, 0, 0, LAB_TAB.Z, rr, 64), true); g.lineWidth = rr > 0.5 ? 3 : 1.4; g.strokeStyle = rr > 0.5 ? rgba(C.brassLo, 0.9) : rgba(C.brassHi, 0.55); g.stroke(); }
    g.globalCompositeOperation = 'lighter';
    strokePts(g, circlePts(room, 0, 0, LAB_TAB.Z, 0.54, 64), true); g.lineWidth = 2; g.strokeStyle = rgba(C.cyan, 0.28); g.stroke();
    // window light pooled on the deck
    g.save(); g.translate(room.p.cx, room.y(0, 0) + h * 0.07); g.scale(1, 0.32);
    glowL(g, '#9ecbff', 0, 0, w * 0.2, 0.2); g.restore();
    g.restore();

    /* ---- holo table (static part) */
    {
      const T = LAB_TAB, Z = T.Z, rT = T.r, H = T.H;
      frustum(g, room, 0, Z, rT * 1.08, 0, rT * 1.02, 0.035, ['#070a24', '#2c3980', '#0e1544'], rgba(C.brass, 0.85));
      const ft = circlePts(room, 0, 0.035, Z, rT * 1.02, 56), fb = ptsBox(ft);
      strokePts(g, ft, true); g.fillStyle = lgr(g, 0, fb.y0, 0, fb.y1, [0, '#0e1650', 1, '#1c2a76']); g.fill(); g.lineWidth = 1.2; g.strokeStyle = brassGrad(g, fb.x0, 0, fb.x1, 0); g.stroke();
      strokePts(g, circlePts(room, 0, 0.037, Z, rT * 0.8, 56), true); g.lineWidth = 1.4; g.strokeStyle = rgba(C.cyan, 0.45); g.stroke();
      frustum(g, room, 0, Z, rT * 0.36, 0.035, rT * 0.27, H - 0.075, ['#05081c', '#5062b4', '#141c58'], rgba(C.brass, 0.6));
      for (const yy of [0.075, 0.15]) frustum(g, room, 0, Z, rT * 0.37 - yy * 0.1, yy, rT * 0.37 - yy * 0.1, yy + 0.014, ['#5a4a28', '#f3dca0', '#8a7040'], rgba('#241a0a', 0.8));
      frustum(g, room, 0, Z, rT * 0.62, H - 0.075, rT * 0.98, H - 0.02, ['#0a1038', '#34428e', '#10184a'], rgba(C.brass, 0.6));
      const bt0 = frustum(g, room, 0, Z, rT, H - 0.02, rT, H, ['#3a2a14', '#f3dca0', '#6a5428'], rgba('#241a0a', 0.8));
      const top = circlePts(room, 0, H, Z, rT, 64), bt = ptsBox(top);
      strokePts(g, top, true); g.fillStyle = lgr(g, 0, bt.y0, 0, bt.y1, [0, '#070c30', 0.55, '#12195a', 1, '#243384']); g.fill();
      g.lineWidth = 1.6; g.strokeStyle = brassGrad(g, bt.x0, 0, bt.x1, 0); g.stroke();
      for (const [k, lw, col] of [[0.86, 1, rgba(C.brassLo, 0.9)], [0.7, 1.2, rgba(C.cyan, 0.3)], [0.5, 1.2, rgba(C.brassHi, 0.55)]]) { strokePts(g, circlePts(room, 0, H + 0.004, Z, rT * k, 56), true); g.lineWidth = lw; g.strokeStyle = col; g.stroke(); }
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, p0 = room.pr(cos(a) * rT * 0.5, H + 0.004, Z + sin(a) * rT * 0.5), p1 = room.pr(cos(a) * rT * 0.86, H + 0.004, Z + sin(a) * rT * 0.86); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.45); g.stroke(); }
      const em = circlePts(room, 0, H + 0.006, Z, rT * 0.4, 44);
      strokePts(g, em, true); g.fillStyle = '#03061a'; g.fill(); g.lineWidth = 1.8; g.strokeStyle = rgba(C.brassHi, 0.85); g.stroke();
      const eb = ptsBox(em);
      geo.tab = { cx: (eb.x0 + eb.x1) / 2, top: (eb.y0 + eb.y1) / 2, rx: eb.w / 2, ry: eb.h / 2, foot: fb, box: bt, floorY: (fb.y0 + fb.y1) / 2, rimRx: bt.w / 2, rimRy: bt.h / 2, topCy: (bt.y0 + bt.y1) / 2 };
      void bt0;
    }

    /* ---- right side: depth-of-field "calm" zone behind the text panel */
    defocus(g, c, kk, floor(w * 0.56), 0, w, h, 5.5, 0.4, w * 0.14);
    bakeGrain(g, w, h, 0.05);
    return geo;
  }

  function buildLabFG(g, w, h) {
    const d = { xb: w * 0.352, xf: w * 0.397, yb: h * 0.868, yf: h * 0.938, btns: [], scr: [] };
    // desk top
    poly(g, [-20, d.yb, d.xb, d.yb, d.xf, d.yf, -20, d.yf]);
    g.fillStyle = lgr(g, 0, 0, d.xf, 0, [0, '#080d2a', 0.55, '#16206a', 1, '#2d3f96']); g.fill();
    g.fillStyle = lgr(g, 0, d.yb, 0, d.yf, [0, 'rgba(0,0,0,0.35)', 0.5, 'rgba(0,0,0,0)', 1, 'rgba(255,255,255,0.08)']); g.fill();
    // rear lip
    g.beginPath(); g.moveTo(-20, d.yb); g.lineTo(d.xb, d.yb); g.lineWidth = 2; g.strokeStyle = rgba(C.brassHi, 0.7); g.stroke();
    // control grid
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const v = 0.2 + r * 0.26, y = lerp(d.yb, d.yf, v), sc = 0.7 + v * 0.5, x1 = lerp(d.xb, d.xf, v), n = 22;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1), x = lerp(w * 0.012, x1 - w * 0.03, u);
        if (r === 0 && x > w * 0.18 && x < w * 0.275) continue;
        const bw = w * 0.0075 * sc, bh = h * 0.0105 * sc, hue = h2(i, r + 20);
        const col = hue < 0.28 ? C.cyan : hue < 0.5 ? C.ember : hue < 0.7 ? C.leaf : hue < 0.82 ? C.rose : C.violet;
        g.fillStyle = '#05081c'; chamferPath(g, x - bw / 2 - 1.5, y - bh / 2 - 1.5, bw + 3, bh + 3, 2); g.fill();
        g.fillStyle = rgba(col, 0.38); chamferPath(g, x - bw / 2, y - bh / 2, bw, bh, 1.5); g.fill();
        d.btns.push({ x: x, y: y, w: bw, h: bh, col: col, i: i + r * 40 });
      }
    }
    // display recess
    d.scr.push({ x: w * 0.185, y: d.yb + h * 0.008, w: w * 0.085, h: h * 0.05 });
    for (const s of d.scr) { g.fillStyle = '#02040e'; chamferPath(g, s.x - 4, s.y - 4, s.w + 8, s.h + 8, 4); g.fill(); g.lineWidth = 1.5; g.strokeStyle = rgba(C.brass, 0.85); g.stroke(); }
    // front face
    poly(g, [-20, d.yf, d.xf, d.yf, d.xf + w * 0.006, h + 10, -20, h + 10]);
    g.fillStyle = lgr(g, 0, d.yf, 0, h, [0, '#101a4c', 0.25, '#080d2a', 1, '#03051a']); g.fill();
    g.beginPath(); g.moveTo(-20, d.yf); g.lineTo(d.xf, d.yf); g.lineWidth = 3; g.strokeStyle = brassGrad(g, 0, 0, d.xf, 0); g.stroke();
    g.beginPath(); g.moveTo(-20, d.yf + 4); g.lineTo(d.xf, d.yf + 4); g.lineWidth = 1; g.strokeStyle = rgba('#000', 0.6); g.stroke();
    for (let i = 0; i < 36; i++) { // LED strip on the facia
      const x = w * 0.01 + i * w * 0.0105; if (x > d.xf - w * 0.01) break;
      g.fillStyle = rgba(C.cyan, 0.2); g.fillRect(x, d.yf + h * 0.022, w * 0.0075, h * 0.006);
    }
    g.fillStyle = rgba(C.brass, 0.25); for (let i = 0; i < 6; i++) g.fillRect(w * 0.012 + i * w * 0.06, d.yf + h * 0.038, w * 0.045, 2);
    // end cap
    poly(g, [d.xf - 2, d.yf - h * 0.012, d.xf + w * 0.012, d.yf + h * 0.01, d.xf + w * 0.012, h + 10, d.xf - 2, h + 10]);
    g.fillStyle = lgr(g, d.xf, 0, d.xf + w * 0.012, 0, [0, C.brass, 0.5, C.brassHi, 1, C.brassLo]); g.fill();
    // frame ribs at the screen edges
    g.fillStyle = lgr(g, 0, 0, w * 0.03, 0, [0, '#010208', 0.7, '#070b22', 1, 'rgba(7,11,34,0)']); g.fillRect(0, 0, w * 0.03, h);
    g.fillStyle = lgr(g, w, 0, w * 0.97, 0, [0, '#010208', 0.7, '#070b22', 1, 'rgba(7,11,34,0)']); g.fillRect(w * 0.97, 0, w * 0.03, h);
    g.fillStyle = lgr(g, 0, 0, 0, h * 0.05, [0, 'rgba(1,2,8,0.85)', 1, 'rgba(1,2,8,0)']); g.fillRect(0, 0, w, h * 0.05);
    g.fillStyle = rgba(C.brass, 0.5); g.fillRect(w * 0.0095, 0, 1.5, h); g.fillRect(w - w * 0.0095, 0, 1.5, h);
    return d;
  }

  /* hologram per field: static model + a little live geometry */
  function labHolo(g, geo, field, t, a, hs, cx, cy) {
    const seg = holoModel(field);
    let n = 0;
    const D = _hdyn, add = (x0, y0, z0, x1, y1, z1) => { if (n + 6 <= D.length) { D[n++] = x0; D[n++] = y0; D[n++] = z0; D[n++] = x1; D[n++] = y1; D[n++] = z1; } };
    const f12 = floor(t * 12);
    if (field === 'propulsion') {
      for (let i = 0; i < 12; i++) {
        const th = i * TAU / 12 + 0.2, L = 0.45 + 0.7 * h2(i, f12), r0 = 0.55;
        add(cos(th) * r0, -0.86, sin(th) * r0, cos(th) * r0 * 0.45, -0.86 - L, sin(th) * r0 * 0.45);
      }
    } else if (field === 'weapons') {
      const dx = -0.581, dy = -0.814;
      for (let i = 0; i < 9; i++) {
        const th = i * TAU / 9, L = 0.35 + 0.55 * h2(i, f12), r0 = 0.09, ox = -0.45 + r0 * cos(th) * 0.8, oy = -0.64, oz = r0 * sin(th);
        add(ox, oy, oz, ox + dx * L, oy + dy * L, oz * 0.6);
      }
    } else if (field === 'forcefield') {
      const u = fract(t * 0.22), y = -0.95 + u * 1.9, r = sqrt(max(0, 1 - y * y)) * 1.015;
      for (let i = 0; i < 28; i++) { const q0 = i * TAU / 28, q1 = (i + 1) * TAU / 28; add(cos(q0) * r, y, sin(q0) * r, cos(q1) * r, y, sin(q1) * r); }
    } else if (field === 'construction') {
      const u = fract(t * 0.3), y = -0.95 + u * 2.3, k = 0.5 * (1 - clamp((y + 0.95) / 1.74, 0, 1) * 0.3) + 0.04;
      add(-k, y, -k, k, y, -k); add(k, y, -k, k, y, k); add(k, y, k, -k, y, k); add(-k, y, k, -k, y, -k);
    } else if (field === 'computers') {
      const u = fract(t * 0.5), k = 0.08 + u * 0.4;
      add(-k, 0.19, -k, k, 0.19, -k); add(k, 0.19, -k, k, 0.19, k); add(k, 0.19, k, -k, 0.19, k); add(-k, 0.19, k, -k, 0.19, -k);
    } else if (field === 'planetology') {
      const u = fract(t * 0.25), y = -0.9 + u * 1.3, r = sqrt(max(0, 0.49 - (y + 0.28) * (y + 0.28))) * 1.04;
      for (let i = 0; i < 24; i++) { const q0 = i * TAU / 24, q1 = (i + 1) * TAU / 24; add(cos(q0) * r, y, sin(q0) * r, cos(q1) * r, y, sin(q1) * r); }
    }
    const col = HOLO_COL[field] || C.cyan;
    holoDraw(g, seg, cx, cy, hs, col, { yaw: t * 0.5, pitch: field === 'computers' ? -0.5 : -0.3, a: a, dyn: D, nDyn: n, lw: max(1, hs * 0.0085) });
    if (field === 'weapons') { // screen-space reticle
      g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = col; g.lineWidth = max(1, hs * 0.012);
      const r = hs * 1.12, q = t * 0.5;
      g.globalAlpha = 0.75 * a; g.beginPath(); g.arc(cx, cy, r, q, q + 1.2); g.stroke(); g.beginPath(); g.arc(cx, cy, r, q + PI, q + PI + 1.2); g.stroke();
      g.globalAlpha = 0.45 * a; g.beginPath(); g.arc(cx, cy, r * 0.82, -q * 1.3, -q * 1.3 + 4.4); g.stroke();
      g.globalAlpha = 0.85 * a; g.beginPath();
      for (let i = 0; i < 4; i++) { const th = i * PI / 2 + PI / 4; g.moveTo(cx + cos(th) * r * 1.08, cy + sin(th) * r * 1.08); g.lineTo(cx + cos(th) * r * 1.26, cy + sin(th) * r * 1.26); }
      g.stroke();
      g.restore();
    }
  }

  Scenes.lab = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h);
      const pd = o.planet || { look: 'terran', seed: 5, rings: false };
      const e = layer('lab|' + pd.look + '|' + pd.seed, w, h, S, (g, ww, hh, c) => buildLab(g, ww, hh, c, pd));
      const geo = e.d, field = o.field || 'computers', col = HOLO_COL[field] || C.cyan;
      const fl = 0.9 + 0.1 * sin(t * 37) * sin(t * 11.3) - (h2(floor(t * 14), 5) > 0.975 ? 0.3 : 0);
      ctx.drawImage(e.c, 0, 0, w, h);

      /* window life: twinkles, sweeping glass glare, a passing ship */
      const W = geo.win;
      ctx.save(); strokePts(ctx, W.pts, true); ctx.clip();
      for (const s of geo.stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * 1.3 + s.ph));
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#dff1ff';
        ctx.fillRect(s.x - s.s * 0.5, s.y - 0.5, s.s, 1); ctx.fillRect(s.x - 0.5, s.y - s.s * 0.5, 1, s.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      const cyc = (t % 34) / 34;
      if (cyc < 0.3) {
        const u = cyc / 0.3, sx = lerp(W.x - 30, W.x + W.w + 30, u), sy = W.y + W.h * (0.3 - 0.06 * u);
        ctx.globalAlpha = 0.95; drawShip(ctx, { race: o.race || 'human', hull: 'cruiser', x: sx, y: sy, size: W.w * 0.14, angle: 0.1, color: o.color || '#8fb4ff', t: t, thrust: 1 });
        ctx.globalAlpha = 1;
      }
      const gl = fract(t * 0.045);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = lgr(ctx, W.x + (gl * 2.2 - 0.6) * W.w, W.y, W.x + (gl * 2.2 - 0.6) * W.w + W.w * 0.35, W.y + W.h * 0.5, [0, 'rgba(160,200,255,0)', 0.5, 'rgba(190,225,255,0.09)', 1, 'rgba(160,200,255,0)']);
      ctx.fillRect(W.x, W.y, W.w, W.h);
      ctx.restore();

      /* wall monitors */
      for (const m of geo.mons) {
        ctx.save(); ctx.transform(m.xf[0], m.xf[1], m.xf[2], m.xf[3], m.xf[4], m.xf[5]);
        screenDraw(ctx, m.kind, m.w, m.h, t, m.sd, m.col, m.dim ? 0.32 : 0.95);
        ctx.restore();
      }

      /* hologram table */
      const T = geo.tab, hs = h * 0.165, hcx = T.cx, hcy = T.top - hs * 1.18;
      ctx.save(); ctx.translate(T.cx, T.floorY); ctx.scale(1, 0.3);
      glow(ctx, col, 0, 0, T.rx * 2.6, 0.2 * fl); ctx.restore();
      holoBase(ctx, T.cx, T.top, T.rimRx * 0.66, T.rimRy * 0.66, col, t, fl, hs * 2.4);
      labHolo(ctx, geo, field, t, fl, hs, hcx, hcy);
      holoScan(ctx, hcx, hcy, hs * 1.0, hs * 1.15, col, t, fl);
      glow(ctx, col, hcx, hcy, hs * 1.8, 0.16 * fl);
      // floating field label with a leader line
      {
        const lx = hcx + hs * 1.25, ly = hcy - hs * 1.0, lab = FIELD_LABEL[field] || field.toUpperCase();
        ctx.save(); ctx.globalAlpha = 0.85 * fl; ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hcx + hs * 0.62, hcy - hs * 0.56); ctx.lineTo(lx, ly); ctx.lineTo(lx + hs * 1.3, ly); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(hcx + hs * 0.62 - 2, hcy - hs * 0.56 - 2, 4, 4);
        text(ctx, lab, lx + 4, ly - 6, max(10, h * 0.017), lite(col, 0.55), 'left', FONT_D, 400, 1.5);
        text(ctx, 'RESEARCH MODEL', lx + 4, ly + h * 0.02, max(8, h * 0.011), rgba(col, 0.7), 'left', FONT_U, 400, 1.2);
        ctx.restore();
      }

      /* the scientist (left third) */
      const ph = min(h * 0.72, w * 0.34 / 0.8), pw = ph * 0.8, px = w * 0.02, py = h - ph;
      featheredPortrait(ctx, o.race || 'human', px, py, pw, ph, { t: t, mood: o.mood || 'neutral', talking: o.talking !== false && !!o.talking, color: o.color, bg: false, key: 'lab' }, 0.07, 0, 0.0);
      // holo light spilling on the scientist + the wall behind
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const rim = ctx.createLinearGradient(px + pw * 0.45, 0, px + pw * 1.05, 0);
      rim.addColorStop(0, rgba(col, 0)); rim.addColorStop(1, rgba(col, 0.16 * fl));
      ctx.fillStyle = rim; ctx.fillRect(px + pw * 0.45, py + ph * 0.1, pw * 0.6, ph * 0.85);
      ctx.restore();
      glow(ctx, col, px + pw * 1.0, py + ph * 0.45, pw * 0.55, 0.12 * fl);

      /* foreground console */
      const fg = layer('lab.fg', w, h, S, buildLabFG), d = fg.d;
      ctx.drawImage(fg.c, 0, 0, w, h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of d.btns) {
        const v = h2(b.i, floor(t * (1.5 + (b.i % 3) * 0.7)));
        if (v > 0.62) { ctx.globalAlpha = (v - 0.62) * 2.2; ctx.fillStyle = b.col; ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h); ctx.globalAlpha = 0.25 * (v - 0.62) * 2.2; ctx.fillRect(b.x - b.w, b.y - b.h, b.w * 2, b.h * 2); }
      }
      for (let i = 0; i < 36; i++) { const x = w * 0.01 + i * w * 0.0105; if (x > d.xf - w * 0.01) break; const v = 0.5 + 0.5 * sin(t * 2.2 - i * 0.5); ctx.globalAlpha = 0.25 + 0.6 * v * v; ctx.fillStyle = i % 9 === 4 ? C.ember : C.cyan; ctx.fillRect(x, d.yf + h * 0.022, w * 0.0075, h * 0.006); }
      ctx.restore();
      for (const s of d.scr) { // console display
        ctx.save(); ctx.translate(s.x, s.y); screenDraw(ctx, 'graph', s.w, s.h, t, 21, o.color || C.cyan, 1); ctx.restore();
      }
      motes(ctx, w * 0.05, h * 0.15, w * 0.55, h * 0.8, 38, t, '#bfe4ff', 0.5, 7, 1.8);
      finish(ctx, w, h, 0.55, 0.04, t);
      end(ctx);
      const T2 = geo.tab;
      return {
        portrait: { x: px, y: py, w: pw, h: ph },
        panel: { x: w * 0.6, y: h * 0.12, w: w * 0.37, h: h * 0.7 },
        window: { x: W.x, y: W.y, w: W.w, h: W.h },
        hologram: { x: hcx - hs, y: hcy - hs * 1.2, w: hs * 2, h: hs * 2.4 },
        table: { x: T2.box.x0, y: T2.box.y0, w: T2.box.w, h: T2.floorY - T2.box.y0 },
      };
    },
  };

  /* ======================================================================= COUNCIL : the round chamber */
  const BW = 0.44, BH = 0.74, RB = 0.93;
  const SEAT_ANG = {
    1: [0], 2: [-0.5, 0.5], 3: [-0.86, 0, 0.86], 4: [-0.98, -0.44, 0.44, 0.98], 5: [-1.1, -0.72, 0, 0.72, 1.1], 6: [-1.1, -0.74, -0.4, 0.4, 0.74, 1.1],
  };
  function councilRoom(w, h) {
    const f = h * 1.5, D = 1.9, Rz = 1.0, aE = 1.3;
    const Rx = (w * 0.5) * (D + Rz * cos(aE)) / (f * sin(aE));
    return makeRoom({ cx: w * 0.5, hy: h * 0.58, f: f, D: D, Rx: Rx, Rz: Rz, Hc: 0.36, Hw: 1.0 });
  }
  function councilBooths(room, n) {
    const p = room.p, ang = SEAT_ANG[clamp(n, 1, 6)] || [], bs = n <= 2 ? 1.5 : n === 3 ? 1.32 : n === 4 ? 1.18 : n === 5 ? 1.07 : 0.96, out = [];
    for (let i = 0; i < ang.length; i++) {
      const a = ang[i], X = RB * p.Rx * sin(a), Z = RB * p.Rz * cos(a), s = p.f / (Z + p.D);
      out.push({ i: i, a: a, Z: Z, s: s, u: s * bs, cx: p.cx + X * s, by: p.hy + p.Hc * s });
    }
    return out;
  }
  function archWall(g, room, ac, aw, yb, yt, rise, n) {
    n = n || 14;
    g.beginPath();
    let q = room.wall(ac - aw, yb); g.moveTo(q[0], q[1]);
    q = room.wall(ac - aw, yt); g.lineTo(q[0], q[1]);
    for (let i = 1; i <= n; i++) { const u = -1 + 2 * i / n; q = room.wall(ac + aw * u, yt + rise * sqrt(max(0, 1 - u * u))); g.lineTo(q[0], q[1]); }
    q = room.wall(ac + aw, yb); g.lineTo(q[0], q[1]);
    g.closePath();
  }
  const halfFront = (pts) => { const o = [], n = pts.length / 2; for (let i = floor(n / 2); i < n; i++) o.push(pts[i * 2], pts[i * 2 + 1]); return o; };
  /* drum/frustum on the floor: returns the top ellipse box. grad = [c0,c1,c2] horizontal body gradient */
  function frustum(g, room, X, Z, r0, y0, r1, y1, grad, edge) {
    const b = circlePts(room, X, y0, Z, r0, 56), t = circlePts(room, X, y1, Z, r1, 56), bb = halfFront(b), tb = halfFront(t);
    const bx = ptsBox(b.length > t.length ? b : t);
    g.beginPath(); g.moveTo(tb[0], tb[1]);
    for (let i = 2; i < tb.length; i += 2) g.lineTo(tb[i], tb[i + 1]);
    for (let i = bb.length - 2; i >= 0; i -= 2) g.lineTo(bb[i], bb[i + 1]);
    g.closePath();
    g.fillStyle = lgr(g, bx.x0, 0, bx.x1, 0, [0, grad[0], 0.32, grad[1], 0.7, grad[2], 1, grad[0]]); g.fill();
    if (edge) { g.lineWidth = 1.2; g.strokeStyle = edge; g.stroke(); }
    return ptsBox(t);
  }
  function buildCouncil(g, w, h, c, n) {
    const room = councilRoom(w, h), p = room.p, Hw = p.Hw, kk = c.width / w, s0 = room.s(0), AM = 1.5;
    const geo = { room: room, w: w, h: h, booths: councilBooths(room, n), ped: null, wins: [] };
    g.fillStyle = '#04061a'; g.fillRect(0, 0, w, h);

    /* ceiling: coffered ring + ribs, glowing oculus above the pedestal */
    const top = [], bot = [];
    for (let i = 0; i <= 64; i++) { const a = lerp(-AM, AM, i / 64); top.push(room.x(a), room.y(a, Hw)); bot.push(room.x(a), room.y(a, 0)); }
    g.save();
    g.beginPath(); g.moveTo(top[0], -30); for (let i = 0; i < top.length; i += 2) g.lineTo(top[i], top[i + 1]); g.lineTo(top[top.length - 2], -30); g.closePath();
    g.fillStyle = lgr(g, 0, 0, 0, room.y(0, Hw), [0, '#02030f', 0.45, '#0b123a', 1, '#1b2566']); g.fill(); g.clip();
    const ringAt = (kr, ang0, ang1, st) => { const pts = []; for (let a = ang0; a <= ang1 + 1e-6; a += st) { const q = room.pr(kr * p.Rx * sin(a) * 0.75, Hw, kr * p.Rz * cos(a) * 0.75); pts.push(q[0], q[1]); } return pts; };
    void ringAt;
    const plan = (kr, a) => room.pr(kr * sin(a), Hw, kr * cos(a));
    g.lineWidth = 1.3;
    for (const kr of [0.5, 0.7, 0.9, 1.1, 1.3]) { const pts = []; for (let a = -PI; a <= PI + 1e-6; a += 0.05) { const q = plan(kr, a); pts.push(q[0], q[1]); } strokePts(g, pts); g.strokeStyle = rgba(C.brassLo, 0.55); g.stroke(); }
    for (let j = 0; j < 28; j++) { const a = j * TAU / 28, q0 = plan(0.34, a), q1 = plan(1.45, a); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.strokeStyle = rgba(C.brassLo, 0.45); g.lineWidth = 1.2; g.stroke(); }
    // coffer fills between rings (alternating)
    for (let j = 0; j < 28; j += 1) {
      const a0 = j * TAU / 28, a1 = (j + 1) * TAU / 28, r0 = 0.5, r1 = 0.7;
      const q = [plan(r0, a0), plan(r1, a0), plan(r1, a1), plan(r0, a1)];
      g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); g.fillStyle = rgba('#000', 0.18 + 0.12 * (j % 2)); g.fill();
    }
    const oc = []; for (let a = 0; a <= TAU + 1e-6; a += 0.12) { const q = plan(0.27, a); oc.push(q[0], q[1]); }
    const ob = ptsBox(oc), ocx = (ob.x0 + ob.x1) / 2, ocy = (ob.y0 + ob.y1) / 2;
    const oc2 = []; for (let a = 0; a <= TAU + 1e-6; a += 0.12) { const q = plan(0.33, a); oc2.push(q[0], q[1]); }
    strokePts(g, oc2, true); g.fillStyle = '#1a2260'; g.fill(); g.lineWidth = 3; g.strokeStyle = brassGrad(g, ob.x0, 0, ob.x1, 0); g.stroke();
    strokePts(g, oc, true); g.fillStyle = rgr(g, ocx, ocy, 0, ob.w * 0.55, [0, '#ffffff', 0.55, '#fff0c8', 1, '#e8c888']); g.fill();
    g.globalCompositeOperation = 'lighter';
    glow(g, '#ffe9b8', ocx, ocy, ob.w * 1.05, 0.42);
    g.lineWidth = 2; g.strokeStyle = rgba(C.brassHi, 0.9); strokePts(g, oc, true); g.stroke();
    g.restore();
    geo.oculus = { cx: (ob.x0 + ob.x1) / 2, cy: (ob.y0 + ob.y1) / 2, rx: ob.w / 2, ry: ob.h / 2 };

    /* wall bays: plinth, blind arch, clerestory window, cornice, pilasters */
    const da = 0.14;
    for (let k = -12; k <= 12; k++) {
      const ac = k * da, a0 = ac - da / 2, a1 = ac + da / 2, lum = clamp(0.3 + 0.7 * cos(ac * 0.92), 0.12, 1);
      const base = mixc('#070b24', '#161f58', lum);
      wallPoly(g, room, a0, a1, 0, Hw, 3);
      g.fillStyle = lgr(g, 0, room.y(ac, Hw), 0, room.y(ac, 0), [0, dark(base, 0.35), 0.45, base, 0.85, dark(base, 0.25), 1, dark(base, 0.55)]); g.fill();
      // plinth
      wallPoly(g, room, a0, a1, 0, 0.11, 3); g.fillStyle = rgba('#02030c', 0.55); g.fill();
      // blind arch recess
      archWall(g, room, ac, da * 0.36, 0.15, 0.46, 0.17); g.fillStyle = lgr(g, 0, room.y(ac, 0.8), 0, room.y(ac, 0.15), [0, mixc('#04061a', '#10184a', lum), 1, mixc('#02030e', '#0a1038', lum)]); g.fill();
      g.lineWidth = 1.3; g.strokeStyle = rgba(C.brass, 0.4 + 0.4 * lum); g.stroke();
      archWall(g, room, ac, da * 0.39, 0.135, 0.46, 0.185); g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.5); g.stroke();
      // clerestory window (lit)
      archWall(g, room, ac, da * 0.3, 0.71, 0.8, 0.09);
      g.fillStyle = lgr(g, 0, room.y(ac, 0.92), 0, room.y(ac, 0.71), [0, mixc('#d8ecff', '#fff6dc', 0.3), 1, mixc('#6a8ad8', '#bcd2ff', lum)]); g.fill();
      g.lineWidth = 2; g.strokeStyle = brassGrad(g, 0, room.y(ac, 0.9), 0, room.y(ac, 0.7)); g.stroke();
      const m0 = room.wall(ac, 0.71), m1 = room.wall(ac, 0.89), m2 = room.wall(ac - da * 0.3, 0.755), m3 = room.wall(ac + da * 0.3, 0.755);
      g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.moveTo(m2[0], m2[1]); g.lineTo(m3[0], m3[1]); g.lineWidth = 1.4; g.strokeStyle = rgba('#1a2460', 0.8); g.stroke();
      if (abs(ac) < 1.25) geo.wins.push({ x: room.x(ac), y: room.y(ac, 0.8), s: room.s(ac), a: ac, lum: lum });
      // cornice dentils
      wallLine(g, room, a0, a1, Hw - 0.045, 4); g.lineWidth = 0.075 * room.s(ac); g.strokeStyle = rgba('#0a0f30', 0.9); g.stroke();
      g.setLineDash([3, 3]); g.lineWidth = 0.05 * room.s(ac); g.strokeStyle = rgba(C.brassLo, 0.8); g.stroke(); g.setLineDash([]);
      // pilaster at the seam
      const pa = a0, pl = 0.0125;
      wallPoly(g, room, pa - pl, pa + pl, 0, Hw - 0.07, 1);
      g.fillStyle = lgr(g, room.x(pa - pl), 0, room.x(pa + pl), 0, [0, '#060920', 0.28, mixc('#0c1240', '#3c4890', lum), 0.62, mixc('#0a1038', '#242e72', lum), 1, '#050720']); g.fill();
      g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.85); g.stroke();
      const c0 = room.wall(pa - pl * 1.35, Hw - 0.09), c1 = room.wall(pa + pl * 1.35, Hw - 0.07);
      g.fillStyle = brassGrad(g, c0[0], 0, c1[0], 0); g.fillRect(c0[0], c0[1], c1[0] - c0[0], max(3, room.s(pa) * 0.025));
      const b0 = room.wall(pa - pl * 1.35, 0.06), b1 = room.wall(pa + pl * 1.35, 0.06);
      g.fillStyle = brassGrad(g, b0[0], 0, b1[0], 0); g.fillRect(b0[0], b0[1], b1[0] - b0[0], max(3, room.s(pa) * 0.025));
    }
    const bandAt = (Y, th, col) => {
      wallLine(g, room, -1.5, 1.5, Y, 80); g.lineWidth = th * 2 * s0; g.strokeStyle = col || C.brassLo; g.stroke();
      wallLine(g, room, -1.5, 1.5, Y + th * 0.55, 80); g.lineWidth = max(1, th * 0.8 * s0); g.strokeStyle = rgba(C.brassHi, 0.8); g.stroke();
    };
    bandAt(0.11, 0.008); bandAt(Hw - 0.005, 0.016); bandAt(0.66, 0.006);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const wn of geo.wins) glowL(g, '#cfe4ff', wn.x, wn.y, wn.s * 0.34, 0.2 * wn.lum + 0.04);
    g.restore();

    /* floor: polished stone, reflection, inlay star, dais, pedestal */
    g.save();
    g.beginPath(); g.moveTo(bot[0], h + 30); for (let i = 0; i < bot.length; i += 2) g.lineTo(bot[i], bot[i + 1]); g.lineTo(bot[bot.length - 2], h + 30); g.closePath();
    g.fillStyle = lgr(g, 0, room.y(0, 0), 0, h, [0, '#1a2362', 0.3, '#0b1240', 1, '#03051a']); g.fill(); g.clip();
    g.save(); g.globalAlpha = 0.17; g.translate(0, 2 * room.y(0, 0)); g.scale(1, -1); g.drawImage(c, 0, 0, w, h); g.restore();
    g.fillStyle = lgr(g, 0, room.y(0, 0), 0, h, [0, 'rgba(8,12,40,0)', 0.5, 'rgba(4,6,24,0.5)', 1, 'rgba(2,3,12,0.8)']); g.fillRect(0, room.y(0, 0), w, h);
    const fp = (r, a) => room.pr(r * cos(a), 0, r * sin(a));
    for (let j = 0; j < 24; j++) { const a = j * TAU / 24, q0 = fp(0.5, a), q1 = fp(1.55, a); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.lineWidth = 1; g.strokeStyle = rgba(C.brass, 0.1); g.stroke(); }
    for (const rr of [0.7, 0.95, 1.2]) { const pts = []; for (let a = 0; a <= TAU + 1e-6; a += 0.05) { const q = fp(rr, a); pts.push(q[0], q[1]); } strokePts(g, pts, true); g.lineWidth = rr === 0.95 ? 3 : 1.3; g.strokeStyle = rgba(rr === 0.95 ? C.brassLo : C.brass, rr === 0.95 ? 0.8 : 0.28); g.stroke(); }
    { // star inlay
      const pts = []; for (let i = 0; i < 32; i++) { const q = fp(i % 2 ? 0.66 : 0.93, i * PI / 16 + PI / 32); pts.push(q[0], q[1]); }
      strokePts(g, pts, true); g.fillStyle = rgba(C.brass, 0.08); g.fill(); g.lineWidth = 1.4; g.strokeStyle = rgba(C.brassHi, 0.5); g.stroke();
    }
    g.restore();
    for (const B of geo.booths) { // contact shadows
      g.save(); g.translate(B.cx, B.by); g.scale(1, 0.22);
      g.fillStyle = rgr(g, 0, 0, 0, B.u * 0.34, [0, 'rgba(0,0,0,0.6)', 1, 'rgba(0,0,0,0)']); g.fillRect(-B.u * 0.4, -B.u * 0.4, B.u * 0.8, B.u * 0.8); g.restore();
    }
    // dais steps + pedestal
    const dz = 0;
    frustum(g, room, 0, dz, 0.64, 0, 0.62, 0.04, ['#070a20', '#232e6c', '#10184a'], rgba(C.brass, 0.7));
    const st2 = frustum(g, room, 0, dz, 0.52, 0.04, 0.5, 0.085, ['#090d28', '#2c3878', '#121a50'], rgba(C.brassHi, 0.7));
    const dtop = circlePts(room, 0, 0.085, dz, 0.5, 56); strokePts(g, dtop, true); g.fillStyle = lgr(g, 0, st2.y0, 0, st2.y1, [0, '#0e1442', 1, '#1c2662']); g.fill(); g.lineWidth = 1.5; g.strokeStyle = brassGrad(g, st2.x0, 0, st2.x1, 0); g.stroke();
    for (const [rr, col, lw] of [[0.42, rgba(C.cyan, 0.4), 1.2], [0.36, rgba(C.brassHi, 0.5), 1], [0.3, rgba(C.cyan, 0.25), 1]]) { strokePts(g, circlePts(room, 0, 0.087, dz, rr, 56), true); g.lineWidth = lw; g.strokeStyle = col; g.stroke(); }
    frustum(g, room, 0, dz, 0.16, 0.085, 0.1, 0.19, ['#05071a', '#3c4a96', '#121a50'], rgba(C.brass, 0.8));
    frustum(g, room, 0, dz, 0.1, 0.19, 0.085, 0.25, ['#080c26', '#4a5aa6', '#1a2462'], rgba(C.brassHi, 0.8));
    for (const yy of [0.14, 0.215]) frustum(g, room, 0, dz, 0.13 - (yy - 0.085) * 0.35, yy, 0.13 - (yy - 0.085) * 0.35, yy + 0.012, ['#4a3a1c', '#f3dca0', '#7a6030'], rgba('#241a0a', 0.8));
    frustum(g, room, 0, dz, 0.15, 0.25, 0.28, 0.285, ['#0a0e30', '#3a4896', '#161e58'], rgba(C.brass, 0.7));
    const pt = frustum(g, room, 0, dz, 0.28, 0.285, 0.28, 0.305, ['#4a3a1c', '#f3dca0', '#7a6030'], rgba('#241a0a', 0.8));
    const ptop = circlePts(room, 0, 0.305, dz, 0.28, 56); strokePts(g, ptop, true); g.fillStyle = lgr(g, 0, pt.y0, 0, pt.y1, [0, '#080c2c', 1, '#1a266c']); g.fill(); g.lineWidth = 1.6; g.strokeStyle = brassGrad(g, pt.x0, 0, pt.x1, 0); g.stroke();
    strokePts(g, circlePts(room, 0, 0.307, dz, 0.22, 48), true); g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.9); g.stroke();
    const em = circlePts(room, 0, 0.31, dz, 0.13, 40), eb = ptsBox(em); strokePts(g, em, true); g.fillStyle = '#03061a'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = rgba(C.brassHi, 0.85); g.stroke();
    bakeGrain(g, w, h, 0.05);
    geo.ped = { cx: (eb.x0 + eb.x1) / 2, top: (eb.y0 + eb.y1) / 2, rx: eb.w / 2, ry: eb.h / 2, s: room.pr(0, 0, dz)[2], floorY: room.pr(0, 0, dz)[1], dais: ptsBox(circlePts(room, 0, 0.0, dz, 0.62, 56)) };
    return geo;
  }

  /* one alcove booth: part 'back' (interior) or 'front' (pilasters, arch, desk). origin = base centre of the sprite. */
  function boothDims(u) { return { W: Math.ceil(BW * u * 1.5), H: Math.ceil(BH * u * 1.3), ox: Math.ceil(BW * u * 1.5) / 2, pad: 0.05 * u }; }
  function paintBooth(g, part, u) {
    const d = boothDims(u), W = d.W, H = d.H, ox = d.ox, oy = H - d.pad;
    const bw = BW * u, pw = 0.065 * u, openW = bw - 2 * pw, deskH = 0.15 * u, mould = 0.06 * u;
    const yc = BH * u - mould - openW / 2, Y = (y) => oy - y, Ro = bw / 2, Ri = openW / 2;
    if (part === 'back') {
      g.beginPath(); g.moveTo(ox - Ri, Y(deskH)); g.lineTo(ox - Ri, Y(yc)); g.arc(ox, Y(yc), Ri, PI, TAU); g.lineTo(ox + Ri, Y(deskH)); g.closePath();
      g.fillStyle = lgr(g, 0, Y(yc + Ri), 0, Y(deskH), [0, '#1c2668', 0.5, '#0e1446', 1, '#070b28']); g.fill();
      g.save(); g.clip();
      g.fillStyle = rgr(g, ox, Y(yc * 0.8), 0, Ri * 1.4, [0, 'rgba(120,150,255,0.35)', 1, 'rgba(120,150,255,0)']); g.fillRect(ox - Ri, Y(yc + Ri), Ri * 2, Ri * 2 + yc);
      g.strokeStyle = rgba(C.brassLo, 0.4); g.lineWidth = 1;
      for (let i = 1; i < 12; i++) { const a = PI + i * PI / 12; g.beginPath(); g.moveTo(ox + cos(a) * Ri * 0.15, Y(yc) + sin(a) * Ri * 0.15); g.lineTo(ox + cos(a) * Ri, Y(yc) + sin(a) * Ri); g.stroke(); }
      for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(ox, Y(yc), Ri * i / 4, PI, TAU); g.stroke(); }
      g.restore();
      return;
    }
    // pilasters
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? ox - bw / 2 : ox + bw / 2 - pw;
      g.fillStyle = lgr(g, x0, 0, x0 + pw, 0, sgn < 0 ? [0, '#070a24', 0.4, '#38468f', 1, '#0e1450'] : [0, '#0e1450', 0.6, '#323f86', 1, '#05081e']);
      g.fillRect(x0, Y(yc), pw, yc);
      g.lineWidth = 1; g.strokeStyle = rgba(C.brassLo, 0.9); g.strokeRect(x0 + 0.5, Y(yc), pw - 1, yc);
      g.strokeStyle = rgba('#000', 0.45); g.beginPath(); g.moveTo(x0 + pw * 0.33, Y(yc)); g.lineTo(x0 + pw * 0.33, Y(0.05 * u)); g.moveTo(x0 + pw * 0.66, Y(yc)); g.lineTo(x0 + pw * 0.66, Y(0.05 * u)); g.stroke();
      g.fillStyle = brassGrad(g, x0 - 3, 0, x0 + pw + 3, 0); g.fillRect(x0 - 0.01 * u, Y(yc) - 0.0, pw + 0.02 * u, 0.028 * u); g.fillRect(x0 - 0.01 * u, Y(0.05 * u), pw + 0.02 * u, 0.05 * u);
    }
    // arch moulding (half annulus)
    g.beginPath(); g.arc(ox, Y(yc), Ro, PI, TAU); g.arc(ox, Y(yc), Ri, TAU, PI, true); g.closePath();
    g.fillStyle = lgr(g, 0, Y(yc + Ro), 0, Y(yc), [0, '#3c4c9c', 0.35, '#212c78', 1, '#0b1040']); g.fill();
    g.lineWidth = 1.6; g.strokeStyle = brassGrad(g, ox - Ro, 0, ox + Ro, 0); g.beginPath(); g.arc(ox, Y(yc), Ro, PI, TAU); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = rgba(C.brassHi, 0.7); g.beginPath(); g.arc(ox, Y(yc), Ri, PI, TAU); g.stroke();
    g.lineWidth = 1; g.strokeStyle = rgba('#000', 0.5); g.beginPath(); g.arc(ox, Y(yc), (Ro + Ri) / 2, PI, TAU); g.stroke();
    // keystone
    g.beginPath(); g.moveTo(ox - 0.03 * u, Y(yc + Ri - 1)); g.lineTo(ox + 0.03 * u, Y(yc + Ri - 1)); g.lineTo(ox + 0.04 * u, Y(yc + Ro + 0.012 * u)); g.lineTo(ox - 0.04 * u, Y(yc + Ro + 0.012 * u)); g.closePath();
    g.fillStyle = brassGrad(g, ox - 0.04 * u, 0, ox + 0.04 * u, 0); g.fill(); g.lineWidth = 1; g.strokeStyle = rgba('#241a0a', 0.8); g.stroke();
    // desk
    g.beginPath(); g.moveTo(ox - bw / 2 - 0.012 * u, Y(0)); g.lineTo(ox - bw / 2 - 0.012 * u, Y(deskH - 0.02 * u)); g.lineTo(ox - bw / 2 + 0.01 * u, Y(deskH)); g.lineTo(ox + bw / 2 - 0.01 * u, Y(deskH)); g.lineTo(ox + bw / 2 + 0.012 * u, Y(deskH - 0.02 * u)); g.lineTo(ox + bw / 2 + 0.012 * u, Y(0)); g.closePath();
    g.fillStyle = lgr(g, 0, Y(deskH), 0, Y(0), [0, '#2a3678', 0.25, '#18205a', 1, '#080c2c']); g.fill();
    g.lineWidth = 1.4; g.strokeStyle = brassGrad(g, ox - bw / 2, 0, ox + bw / 2, 0); g.stroke();
    g.fillStyle = rgba(C.brassHi, 0.55); g.fillRect(ox - bw / 2 + 0.01 * u, Y(deskH) + 1, bw - 0.02 * u, 1.4);
    chamferPath(g, ox - bw * 0.4, Y(0.12 * u), bw * 0.8, 0.095 * u, 0.02 * u); g.fillStyle = '#04071c'; g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(C.brass, 0.8); g.stroke();
  }

  let _gal = null;
  /* face-on spiral galaxy baked once (additive stars + gas), then rotated/tilted per frame as a bitmap */
  function galaxySprite() {
    if (_gal) return _gal;
    const N = 512, c = mk(N, N), g = c.getContext('2d'), R = mulberry32(777), arms = 2, cx = N / 2, rad = N * 0.47;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgr(g, cx, cx, 0, rad, [0, 'rgba(140,170,255,0.22)', 0.5, 'rgba(90,110,255,0.08)', 1, 'rgba(60,70,200,0)']); g.fillRect(0, 0, N, N);
    const star = (r, th, sz, a, col) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(cx + cos(th) * r * rad - sz / 2, cx + sin(th) * r * rad - sz / 2, sz, sz); };
    for (const [lw, al] of [[0.16, 0.05], [0.09, 0.07], [0.045, 0.1]]) { // soft arm glow
      for (let arm = 0; arm < arms; arm++) { g.strokeStyle = rgba(arm ? '#9a8aff' : '#7fa8ff', al); g.lineWidth = lw * rad; g.lineCap = 'round'; g.beginPath(); for (let k = 0; k <= 60; k++) { const r = 0.08 + 0.9 * k / 60, th = arm * TAU / arms + 4.2 * Math.log(0.18 + r); const x = cx + cos(th) * r * rad, y = cx + sin(th) * r * rad; if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
    }
    for (let i = 0; i < 17000; i++) {
      let r, th;
      if (R() < 0.16) { r = pow(R(), 1.8) * 0.32 + 0.01; th = R() * TAU; }
      else { for (let k = 0; k < 80; k++) { r = pow(R(), 0.6) * 0.98 + 0.02; th = R() * TAU; const dens = pow(0.5 + 0.5 * cos(arms * (th - 4.2 * Math.log(0.18 + r))), 3) * (1 - 0.25 * r) + 0.03; if (R() < dens) break; } }
      star(r, th, 0.8 + R() * R() * 1.7, 0.3 + R() * 0.7, r < 0.28 ? '#ffe9b8' : r < 0.6 ? '#c4d6ff' : '#b89cff');
    }
    for (let k = 0; k < 46; k++) { // gas + young blue clusters along the arms
      const r = 0.2 + R() * 0.75, th = (k % arms) * TAU / arms + 4.2 * Math.log(0.18 + r) + (R() - 0.5) * 0.5;
      g.globalAlpha = 0.05 + R() * 0.07; g.drawImage(glowImg(R() < 0.5 ? '#ff8ac8' : '#7fa8ff'), cx + cos(th) * r * rad - 22, cx + sin(th) * r * rad - 22, 44, 44);
    }
    g.globalAlpha = 0.9; g.drawImage(glowImg('#ffe0a0'), cx - 60, cx - 60, 120, 120);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return (_gal = c);
  }
  function holoGalaxy(g, cx, cy, sc, t, a, seats) {
    const spr = galaxySprite(), pitch = 0.95, sp = sin(pitch) * 0.9, rot = t * 0.26, R = sc * 1.05;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.save(); g.translate(cx, cy); g.scale(1, sp); glowL(g, '#4a6aff', 0, 0, sc * 1.25, 0.2 * a); g.restore();
    g.save(); g.translate(cx, cy); g.scale(1, sp); g.rotate(rot); g.globalAlpha = a; g.drawImage(spr, -R, -R, R * 2, R * 2); g.restore();
    glow(g, '#ffe0a0', cx, cy, sc * 0.4, 0.55 * a);
    for (let i = 0; i < 26; i++) { // sparkle
      const r = 0.12 + 0.85 * h2(i, 7), th = h2(i, 8) * TAU + rot, tw = max(0, sin(t * (1.2 + h2(i, 9) * 2) + i * 5));
      if (tw > 0.3) { g.globalAlpha = tw * a; g.fillStyle = '#fff'; const x = cx + cos(th) * r * sc * 1.0, y = cy + sin(th) * r * sc * sp; g.fillRect(x - 3, y - 0.5, 6, 1); g.fillRect(x - 0.5, y - 3, 1, 6); }
    }
    g.strokeStyle = C.cyan; g.lineWidth = 1; g.globalAlpha = 0.3 * a;
    g.beginPath(); g.ellipse(cx, cy, sc * 1.05, sc * 1.05 * sp, 0, 0, TAU); g.stroke();
    g.globalAlpha = 0.14 * a; g.beginPath(); g.ellipse(cx, cy, sc * 1.18, sc * 1.18 * sp, 0, 0, TAU); g.stroke();
    for (let i = 0; i < (seats ? seats.length : 0); i++) {
      const s = seats[i], r = 0.32 + 0.55 * h2(i, 31), th = h2(i, 32) * TAU + rot, x = cos(th) * r, z = sin(th) * r;
      const sx = cx + x * sc, sy = cy + z * sp * sc, col = s.color || C.gold;
      glowL(g, col, sx, sy, sc * 0.2, 0.9 * a);
      g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.arc(sx, sy, sc * 0.05 + 1.5 * sin(t * 3 + i), 0, TAU); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(sx - 1.4, sy - 1.4, 2.8, 2.8);
    }
    g.restore();
  }
  function holoBallotFx(g, cx, cy, sc, t, a, col) {
    // ballots drop into the slot (dynamic segments) + glow pulse when one lands
    let n = 0;
    const D = _hdyn;
    for (let i = 0; i < 3; i++) {
      const u = fract(t * 0.32 + i / 3), y = 1.35 - u * 1.2, yaw = 0.7 + i * 1.3 + u * 2.4, c = cos(yaw), s = sin(yaw), hw = 0.34, hd = 0.22;
      const P = [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]].map((q) => [q[0] * c + q[2] * s, y, -q[0] * s + q[2] * c]);
      for (let k = 0; k < 4; k++) { const p0 = P[k], p1 = P[(k + 1) % 4]; D[n++] = p0[0]; D[n++] = p0[1]; D[n++] = p0[2]; D[n++] = p1[0]; D[n++] = p1[1]; D[n++] = p1[2]; }
      D[n++] = P[0][0]; D[n++] = y; D[n++] = P[0][2]; D[n++] = P[2][0]; D[n++] = y; D[n++] = P[2][2];
    }
    holoDraw(g, holoModel('ballot'), cx, cy, sc, col, { yaw: t * 0.45, pitch: -0.3, a: a, dyn: D, nDyn: n, lw: max(1, sc * 0.012) });
    const land = max(0, 1 - fract(t * 0.32) * 8);
    glow(g, col, cx, cy - sc * 0.1, sc * 0.9, (0.1 + 0.3 * land) * a);
  }

  /* little vector crown (winner marker) */
  function crownIcon(g, cx, cy, wd, a, t) {
    const h = wd * 0.62;
    g.save(); g.translate(cx, cy); g.globalAlpha = a;
    glow(g, '#ffd54f', 0, -h * 0.4, wd * 1.2, 0.5);
    g.beginPath(); g.moveTo(-wd / 2, 0); g.lineTo(-wd / 2, -h * 0.55); g.lineTo(-wd * 0.25, -h * 0.25); g.lineTo(0, -h); g.lineTo(wd * 0.25, -h * 0.25); g.lineTo(wd / 2, -h * 0.55); g.lineTo(wd / 2, 0); g.closePath();
    g.fillStyle = lgr(g, 0, -h, 0, 0, [0, '#fff0a8', 0.5, '#ffc83a', 1, '#a8741a']); g.fill(); g.lineWidth = max(1, wd * 0.035); g.strokeStyle = '#6a4a10'; g.stroke();
    g.fillStyle = '#ff5c6a'; g.beginPath(); g.arc(0, -h * 0.35, wd * 0.05, 0, TAU); g.fill();
    g.fillStyle = C.cyan; g.beginPath(); g.arc(-wd * 0.3, -h * 0.2, wd * 0.035, 0, TAU); g.arc(wd * 0.3, -h * 0.2, wd * 0.035, 0, TAU); g.fill();
    g.fillStyle = '#fff'; const q = 0.5 + 0.5 * sin(t * 4); g.globalAlpha = a * q; g.fillRect(-wd * 0.02, -h - wd * 0.06, wd * 0.04, wd * 0.12); g.fillRect(-wd * 0.06, -h - wd * 0.02, wd * 0.12, wd * 0.04);
    g.restore();
  }

  /* the name plate under a council seat: banner gem, delegate name, vote count, ABSTAIN tag, a soft glow once voted (u = the seat's size unit) */
  function plaqueText(ctx, seat, pl, u, col, st) {
    const abst = st === 'abstain', winner = st === 'winner', voted = st === 'voted';
    const fs = clamp(u * 0.04, 9, 20), nm = String(seat.name || RACE_NAMES[seat.race] || ''), hasV = seat.votes != null && isFinite(seat.votes);
    let f2 = fs; const maxW = pl.w - (hasV ? pl.h * 1.2 : 0) - pl.h * 0.9;
    while (f2 > 8 && textW(ctx, nm, f2, FONT_D, 400, 0.4) > maxW) f2 -= 0.5;
    const tx = pl.x + pl.h * 0.85;
    // a small gem in the empire's colour: the delegate's photo is already in the alcove above, and a thumbnail of it here only muddied the plate
    const gx = pl.x + pl.h * 0.48, gy = pl.y + pl.h * 0.5, gr = pl.h * 0.19;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, col, gx, gy, gr * 3.2, 0.32); ctx.restore();
    ctx.beginPath(); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx + gr * 0.78, gy); ctx.lineTo(gx, gy + gr); ctx.lineTo(gx - gr * 0.78, gy); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,240,210,0.65)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy - gr); ctx.lineTo(gx + gr * 0.78, gy); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    text(ctx, nm, tx, pl.y + pl.h * 0.5 + f2 * 0.2, f2, abst ? C.fog : C.ivory, 'left', FONT_D, 400, 0.4);
    if (hasV) {
      const vs = clamp(u * 0.062, 11, 26);
      text(ctx, String(seat.votes), pl.x + pl.w - pl.h * 0.45, pl.y + pl.h * 0.5 + vs * 0.34, vs, winner ? '#ffd54f' : C.gold, 'right', FONT_D, 400, 0.5);
      ctx.fillStyle = rgba(C.gold, 0.3); ctx.fillRect(pl.x + pl.w - pl.h * 1.2 - vs * 0.6, pl.y + pl.h * 0.18, 1, pl.h * 0.64);
    }
    if (abst) text(ctx, 'ABSTAIN', pl.x + pl.w / 2, pl.y - u * 0.02, clamp(u * 0.028, 8, 14), C.mist, 'center', FONT_U, 600, 1.5);
    if (voted) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, col, pl.x + pl.w - pl.h * 1.0, pl.y + pl.h * 0.5, pl.h * 0.8, 0.28); ctx.restore(); }
  }

  /* ---- COUNCIL on the illustrated chamber: assets/art/scene/scene-council-chamber.webp (docs/IMAGE-GEN-COUNCIL-AND-SKIES.md §1).
     Six empty alcoves measured on the plate, as fractions of the image: niche left / right edge, arch crown, lectern top. The leader photos
     stand in the alcoves on the lectern line; the drawn chamber below is the fallback until the plate has loaded. */
  const CPLATE = {
    al: [[0.0538, 0.1603, 0.2062, 0.5218], [0.2051, 0.2967, 0.2678, 0.5260], [0.3355, 0.4205, 0.2901, 0.5292],
      [0.5789, 0.6639, 0.2912, 0.5292], [0.7027, 0.7943, 0.2678, 0.5260], [0.8385, 0.9462, 0.2232, 0.5218]],
    plaque: [0.537, 0.583],                       // the brass panel on each lectern (y top, bottom)
    ped: { x: 0.5, y: 0.573, rx: 0.06 },          // the emitter disc on the pedestal
    // seat index -> alcove for 1..6 seats: Council's arrange() puts the two candidates in the seats "nearest the pedestal", which land in the
    // two inner alcoves (2, 3); with fewer than six empires the outer alcoves stay vacant
    map: [null, [2], [2, 3], [2, 1, 3], [1, 2, 3, 4], [1, 2, 0, 3, 4], [0, 1, 2, 3, 4, 5]],
  };
  function councilPlate(ctx, im, w, h, t, o, seats) {
    const iw = im.naturalWidth, ih = im.naturalHeight, sc = max(w / iw, h / ih), sx0 = (iw - w / sc) / 2, sy0 = (ih - h / sc) / 2;
    const X = (u) => (u * iw - sx0) * sc, Y = (v) => (v * ih - sy0) * sc;
    G.WorldArt.draw(ctx, im, 0, 0, w, h);
    // the oculus is bright where the vote tally sits: settle the top band
    ctx.fillStyle = lgr(ctx, 0, 0, 0, h * 0.2, [0, 'rgba(4,3,8,0.55)', 1, 'rgba(4,3,8,0)']); ctx.fillRect(0, 0, w, h * 0.2);
    const holo = o.hologram || 'galaxy', hcol = holo === 'crown' ? '#ffd54f' : holo === 'ballot' ? '#5fe0c0' : '#62d8ff';
    const fl = 0.92 + 0.08 * sin(t * 31) * sin(t * 9.7);
    const ped = { cx: X(CPLATE.ped.x), top: Y(CPLATE.ped.y), rx: CPLATE.ped.rx * iw * sc }; ped.ry = ped.rx * 0.12;
    const hsc = h * 0.086, hcy = ped.top - h * 0.14;

    /* light from the oculus onto the pedestal, then the hologram */
    beam(ctx, ped.cx, 0, ped.cx, ped.top, w * 0.05, ped.rx * 1.6, '#ffe9bd', 0.07 + 0.02 * sin(t * 0.6));
    holoBase(ctx, ped.cx, ped.top, ped.rx * 0.9, ped.ry * 0.9, hcol, t, fl, h * 0.12);
    ctx.fillStyle = rgr(ctx, ped.cx, hcy, hsc * 0.2, hsc * 1.5, [0, 'rgba(2,4,22,0.5)', 0.6, 'rgba(2,4,22,0.26)', 1, 'rgba(2,4,22,0)']); ctx.fillRect(ped.cx - hsc * 1.6, hcy - hsc * 1.6, hsc * 3.2, hsc * 3.2);
    if (holo === 'galaxy') holoGalaxy(ctx, ped.cx, hcy, hsc * 1.05, t, fl, seats);
    else holoBallotFx(ctx, ped.cx, hcy, hsc * 0.9, t, fl, hcol);
    holoScan(ctx, ped.cx, hcy, hsc * 0.95, hsc * 1.0, hcol, t, fl * 0.8);

    /* the alcoves */
    const P = G.Portraits, map = CPLATE.map[seats.length] || CPLATE.map[6], used = {}, out = { seats: [] };
    for (let i = 0; i < seats.length; i++) used[map[i]] = i;
    for (let k = 0; k < 6; k++) {
      const A = CPLATE.al[k], x0 = X(A[0]), x1 = X(A[1]), crown = Y(A[2]), lect = Y(A[3]), ow = x1 - x0, R = ow / 2, ox = (x0 + x1) / 2, spring = crown + R;
      const niche = () => { ctx.beginPath(); ctx.moveTo(x0, lect); ctx.lineTo(x0, spring); ctx.arc(ox, spring, R, PI, TAU); ctx.lineTo(x1, lect); ctx.closePath(); };
      const si = used[k];
      if (si === undefined) { ctx.save(); niche(); ctx.fillStyle = 'rgba(2,2,6,0.35)'; ctx.fill(); ctx.restore(); continue; }   // vacant seat
      const seat = seats[si], st = seat.state || 'idle', col = seat.color || C.brass, u = ow / BW;
      const speaking = st === 'speaking', winner = st === 'winner', abst = st === 'abstain', voted = st === 'voted';
      const openH = lect - crown, pbh = openH * 0.84, pbw = pbh * 0.8, pbx = ox - pbw / 2, pby = lect - pbh;
      // every delegate turns towards the pedestal: mirror a photo whose leader looks away from the centre
      const face = P && P.facing ? P.facing(seat.race) : 1, flip = face !== 0 && face === (k < 3 ? -1 : 1);
      glow(ctx, winner ? '#ffd54f' : speaking ? '#fff0c8' : abst ? '#8a93b8' : voted ? mixc(col, '#ffffff', 0.3) : '#c8a070', ox, crown + openH * 0.4, R * (winner || speaking ? 1.5 : 1.0), winner ? 0.4 : speaking ? 0.35 : 0.08);
      ctx.save();
      niche(); ctx.clip();
      drawPortrait(ctx, seat.race || 'human', pbx, pby, pbw, pbh, { t: t, mood: winner ? 'pleased' : abst ? 'worried' : 'neutral', talking: speaking, color: seat.color, bg: false, flip: flip, key: 'council' + k });
      // tie the photograph into the hall's warm lamplight (same grade as the drawn chamber's alcoves)
      ctx.globalCompositeOperation = 'lighten'; ctx.fillStyle = 'rgb(30,22,19)'; ctx.fillRect(x0, crown, ow, openH);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lgr(ctx, 0, crown, 0, lect, [0, 'rgb(255,240,218)', 0.55, 'rgb(246,218,188)', 1, 'rgb(186,148,120)']); ctx.fillRect(x0, crown, ow, openH);
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,172,104,0.3)'; ctx.fillRect(x0, crown, ow, openH);
      if (abst) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.8)'; ctx.fillRect(x0, crown, ow, openH); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(150,140,132)'; ctx.fillRect(x0, crown, ow, openH); }
      else if (!speaking && !winner) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = voted ? 'rgb(240,232,224)' : 'rgb(214,202,190)'; ctx.fillRect(x0, crown, ow, openH); }
      else { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = winner ? 'rgba(255,200,80,0.09)' : 'rgba(255,240,200,0.06)'; ctx.fillRect(x0, crown, ow, openH); }
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgr(ctx, ox, crown + openH * 0.5, R * 0.6, openH * 0.75, [0, 'rgba(2,3,10,0)', 1, 'rgba(2,3,10,0.5)']); ctx.fillRect(x0, crown, ow, openH);
      ctx.restore();
      if (speaking || winner) {
        const pulse = 0.55 + 0.45 * sin(t * (speaking ? 4.2 : 2.4));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = winner ? '#ffd54f' : '#fff0c8'; ctx.lineWidth = max(1.5, ow * 0.012); ctx.globalAlpha = 0.35 + 0.45 * pulse;
        niche(); ctx.stroke(); ctx.restore();
        beam(ctx, ox, crown - R * 1.2, ox, lect, R * 0.6, R * 1.1, winner ? '#ffd870' : '#fff0c8', 0.1 + 0.05 * pulse);
      }
      // the empire's gem on the keystone
      glow(ctx, col, ox, crown - R * 0.12, R * 0.35, 0.6);
      ctx.fillStyle = col; ctx.fillRect(ox - R * 0.05, crown - R * 0.17, R * 0.1, R * 0.1);
      // the text band across the brass panel: the full panel width, but only as tall as a drawn plaque (gem and number spacing scale with it)
      const py0 = Y(CPLATE.plaque[0]), py1 = Y(CPLATE.plaque[1]), ph = min(py1 - py0, ow * 0.2);
      const pl = { x: x0 - ow * 0.02, y: (py0 + py1 - ph) / 2, w: ow * 1.04, h: ph };
      plaqueText(ctx, seat, pl, u, col, st);
      if (winner) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe08a';
        for (let i = 0; i < 14; i++) { const q = fract(t * 0.4 + i / 14), sx = ox + (h2(i, k) - 0.5) * ow, sy = lect - q * openH * 0.8; ctx.globalAlpha = (1 - q) * 0.8; ctx.fillRect(sx, sy, 2, 2); }
        ctx.restore();
      }
      out.seats[si] = { x: x0, y: crown, w: ow, h: pl.y + pl.h - crown, portrait: { x: x0, y: crown, w: ow, h: openH }, plaque: pl, cx: ox, cy: crown + openH * 0.5 };
    }
    motes(ctx, w * 0.3, h * 0.05, w * 0.4, h * 0.6, 30, t, '#ffeccc', 0.35, 3, 1.8);
    finish(ctx, w, h, 0.35, 0.03, t);
    out.pedestal = { cx: ped.cx, cy: ped.top, rx: ped.rx, ry: ped.ry };
    out.hologram = { x: ped.cx - hsc * 1.1, y: hcy - hsc * 1.2, w: hsc * 2.2, h: hsc * 2.4 };
    out.top = { x: w * 0.1, y: 0, w: w * 0.8, h: h * 0.1 };
    out.bottom = { x: w * 0.12, y: h * 0.86, w: w * 0.76, h: h * 0.13 };
    out.grade = 'plate';
    return out;
  }

  Scenes.council = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), seats = (Array.isArray(o.seats) ? o.seats : []).filter((x) => x && typeof x === 'object').slice(0, 6), n = max(1, seats.length || 1);
      const WA = G.WorldArt, plate = WA && WA.scene ? WA.get(WA.scene('council-chamber')) : null;
      if (plate) { const r = councilPlate(ctx, plate, w, h, t, o, seats); end(ctx); return r; }
      const e = layer('council|' + n, w, h, S, (g, ww, hh, c) => { const r = buildCouncil(g, ww, hh, c, n); tintLayer(c, COUNCIL_TINT); return r; });
      const geo = e.d, room = geo.room;
      ctx.drawImage(e.c, 0, 0, w, h);
      const ped = geo.ped, holo = o.hologram || 'galaxy';
      const hcol = holo === 'crown' ? '#ffd54f' : holo === 'ballot' ? '#5fe0c0' : '#62d8ff';
      const fl = 0.92 + 0.08 * sin(t * 31) * sin(t * 9.7);

      /* light: oculus shaft, clerestory shafts (drifting) */
      const oc = geo.oculus, shaftA = 0.1;
      beam(ctx, oc.cx, oc.cy, ped.cx, ped.top, oc.rx * 1.6, ped.rx * 1.7, '#ffe9bd', shaftA + 0.03 * sin(t * 0.6));
      for (let i = 0; i < geo.wins.length; i++) {
        const wn = geo.wins[i];
        if (i % 2) continue;
        const sw = sin(t * 0.17 + i * 1.9) * 0.5 + 0.5, tx = lerp(wn.x, ped.cx, 0.55 + 0.25 * sw), ty = ped.top + wn.s * 0.1;
        beam(ctx, wn.x, wn.y, tx, ty, wn.s * 0.12, wn.s * 0.5, '#cfe2ff', 0.045 + 0.03 * wn.lum * (0.6 + 0.4 * sin(t * 0.4 + i)));
      }

      /* pedestal hologram */
      ctx.save(); ctx.translate(ped.cx, ped.floorY - 0.1 * ped.s); ctx.scale(1, 0.3); glow(ctx, hcol, 0, 0, ped.rx * 3.2, 0.3 * fl); ctx.restore();
      holoBase(ctx, ped.cx, ped.top, ped.rx * 0.95, ped.ry * 0.95, hcol, t, fl, ped.s * 0.55);
      const hsc = ped.s * 0.215, hcy = ped.top - ped.s * 0.22;
      ctx.fillStyle = rgr(ctx, ped.cx, hcy, hsc * 0.2, hsc * 1.5, [0, 'rgba(2,4,22,0.62)', 0.6, 'rgba(2,4,22,0.34)', 1, 'rgba(2,4,22,0)']); ctx.fillRect(ped.cx - hsc * 1.6, hcy - hsc * 1.6, hsc * 3.2, hsc * 3.2);
      if (holo === 'galaxy') holoGalaxy(ctx, ped.cx, hcy, hsc * 1.05, t, fl, seats);
      else holoBallotFx(ctx, ped.cx, hcy, hsc * 0.9, t, fl, hcol);
      holoScan(ctx, ped.cx, hcy, hsc * 0.95, hsc * 1.0, hcol, t, fl * 0.8);

      /* booths, far -> near */
      const order = geo.booths.slice().sort((a, b) => b.Z - a.Z), out = { seats: [] };
      for (const B of order) {
        const seat = seats[B.i] || null, d = boothDims(B.u), u = B.u, ru = Math.round(u);
        const back = layer('council.booth.b|' + ru, d.W, d.H, S, (g, ww, hh, c) => { paintBooth(g, 'back', ru); tintLayer(c, COUNCIL_TINT); }).c;
        const front = layer('council.booth.f|' + ru, d.W, d.H, S, (g, ww, hh, c) => { paintBooth(g, 'front', ru); tintLayer(c, COUNCIL_TINT); }).c;
        const x0 = B.cx - d.ox, y0 = B.by - (d.H - d.pad), k = u / ru;
        const dw = d.W * k, dh = d.H * k, ox = B.cx, oy = B.by;
        ctx.drawImage(back, B.cx - d.ox * k, B.by - (d.H - d.pad) * k, dw, dh);
        void x0; void y0;
        // opening geometry (px)
        const bw = BW * u, pw = 0.065 * u, openW = bw - 2 * pw, deskH = 0.15 * u, mould = 0.06 * u, yc = BH * u - mould - openW / 2, Ri = openW / 2;
        const st = seat ? seat.state || 'idle' : 'empty', col = (seat && seat.color) || C.brass;
        const speaking = st === 'speaking', winner = st === 'winner', abst = st === 'abstain', voted = st === 'voted';
        // interior glow
        const gcol = winner ? '#ffd54f' : speaking ? '#fff0c8' : abst ? '#8a93b8' : voted ? mixc(col, '#ffffff', 0.3) : '#6f86e8';
        glow(ctx, gcol, ox, oy - yc * 0.9, u * (winner || speaking ? 0.62 : 0.4), winner ? 0.55 : speaking ? 0.5 : st === 'empty' ? 0.05 : 0.18);
        // portrait inside the arch
        const px = ox - Ri, pyTop = oy - yc - Ri, openH = yc + Ri - deskH;
        if (seat) {
          ctx.save();
          ctx.beginPath(); ctx.moveTo(ox - Ri, oy - deskH); ctx.lineTo(ox - Ri, oy - yc); ctx.arc(ox, oy - yc, Ri, PI, TAU); ctx.lineTo(ox + Ri, oy - deskH); ctx.closePath(); ctx.clip();
          // the delegate stands in the alcove at human scale (head well below the arch crown), not as a bust filling a two-storey opening
          const pbh = openH * 0.84, pbw = pbh * 0.8, pbx = ox - pbw / 2, pby = oy - deskH - pbh + 0.01 * u, ah = openH + Ri;
          drawPortrait(ctx, seat.race || 'human', pbx, pby, pbw, pbh, { t: t, mood: speaking ? 'neutral' : st === 'winner' ? 'pleased' : abst ? 'worried' : 'neutral', talking: speaking, color: seat.color, bg: false, key: 'council' + B.i });
          // Tie the photograph into the painted hall. Each photo keeps its own cool studio light and grey-black backdrop; here its black is lifted
          // to the alcove's own dusk tone (sampled from the hall: ~rgb 40,28,26), the picture is warmed toward the hall's lamplight, and it is lit
          // from above (the oculus) so faces catch the light and coats fall into the same shadow as the woodwork.
          ctx.globalCompositeOperation = 'lighten'; ctx.fillStyle = 'rgb(36,25,22)'; ctx.fillRect(px, pyTop, openW, ah);
          ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = lgr(ctx, 0, pyTop, 0, pyTop + ah, [0, 'rgb(255,240,218)', 0.55, 'rgb(246,218,188)', 1, 'rgb(186,148,120)']); ctx.fillRect(px, pyTop, openW, ah);
          ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,172,104,0.38)'; ctx.fillRect(px, pyTop, openW, ah);
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgr(ctx, ox, pby + pbh * 0.26, 0, pbw * 0.6, [0, 'rgba(255,214,160,0.16)', 1, 'rgba(255,214,160,0)']); ctx.fillRect(px, pyTop, openW, ah);
          // state grading inside the arch: idle seats sink into warm shadow (not a cold navy veil), abstainers lose their colour
          if (abst) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.8)'; ctx.fillRect(px, pyTop, openW, ah); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(150,140,132)'; ctx.fillRect(px, pyTop, openW, ah); }
          else if (!speaking && !winner) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = voted ? 'rgb(240,232,224)' : 'rgb(214,202,190)'; ctx.fillRect(px, pyTop, openW, ah); }
          else { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = winner ? 'rgba(255,200,80,0.09)' : 'rgba(255,240,200,0.06)'; ctx.fillRect(px, pyTop, openW, ah); }
          // inner shade at the arch edge
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = rgr(ctx, ox, oy - yc * 0.9, Ri * 0.55, Ri * 1.5, [0, 'rgba(2,3,16,0)', 1, 'rgba(2,3,16,0.55)']); ctx.fillRect(px, pyTop, openW, openH + Ri);
          ctx.restore();
        }
        ctx.drawImage(front, B.cx - d.ox * k, B.by - (d.H - d.pad) * k, dw, dh);
        // frame glow by state
        if (speaking || winner) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const pulse = 0.55 + 0.45 * sin(t * (speaking ? 4.2 : 2.4));
          ctx.strokeStyle = winner ? '#ffd54f' : '#fff0c8'; ctx.lineWidth = max(1.5, u * 0.012); ctx.globalAlpha = (0.35 + 0.45 * pulse);
          ctx.beginPath(); ctx.moveTo(ox - Ri, oy - deskH); ctx.lineTo(ox - Ri, oy - yc); ctx.arc(ox, oy - yc, Ri, PI, TAU); ctx.lineTo(ox + Ri, oy - deskH); ctx.stroke();
          ctx.restore();
          beam(ctx, ox, oy - BH * u - u * 0.9, ox, oy - deskH, u * 0.26, u * 0.5, winner ? '#ffd870' : '#fff0c8', 0.12 + 0.05 * pulse);
        }
        // keystone gem + plaque
        glow(ctx, col, ox, oy - yc - Ri - 0.012 * u * 0 - 0.0, u * 0.1, 0.6);
        ctx.fillStyle = col; ctx.fillRect(ox - u * 0.012, oy - yc - (Ri + (BW * u / 2 - Ri) / 2) - u * 0.012, u * 0.024, u * 0.024);
        const pl = { x: ox - bw * 0.4, y: oy - 0.12 * u, w: bw * 0.8, h: 0.095 * u };
        if (seat) plaqueText(ctx, seat, pl, u, col, st);
        if (voted) { // the seat has voted: a lamp on the desk lights in its colour (was an unshaded paper "ballot chip" that read as a rendering glitch)
          const lx = ox + bw * 0.36, ly = oy - deskH - u * 0.014, lr = max(2, u * 0.013), pul = 0.85 + 0.15 * sin(t * 2.2 + B.i);
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, col, lx, ly, u * 0.09, 0.5 * pul); glow(ctx, '#fff6e0', lx, ly, u * 0.03, 0.55 * pul); ctx.restore();
          ctx.fillStyle = mixc(col, '#ffffff', 0.55); ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
        }
        if (winner) {
          glow(ctx, '#ffd870', ox, oy - BH * u - u * 0.02, u * 0.5, 0.35 + 0.15 * sin(t * 2));       // the elected seat glows; no drawn crown over the portrait
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe08a';
          for (let i = 0; i < 14; i++) { const q = fract(t * 0.4 + i / 14), sx = ox + (h2(i, B.i) - 0.5) * u * 0.5, sy = oy - deskH - q * u * 0.85; ctx.globalAlpha = (1 - q) * 0.8; ctx.fillRect(sx, sy, 2, 2); }
          ctx.restore();
        }
        if (speaking) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff0c8'; ctx.lineWidth = max(1, u * 0.008);
          for (let i = 0; i < 3; i++) { const q = fract(t * 0.7 + i / 3); ctx.globalAlpha = (1 - q) * 0.5; ctx.beginPath(); ctx.ellipse(ox, oy - 0.07 * u, bw * (0.5 + q * 0.5), u * (0.04 + q * 0.07), 0, 0, TAU); ctx.stroke(); }
          ctx.restore();
        }
        out.seats[B.i] = { x: ox - bw / 2, y: oy - BH * u, w: bw, h: BH * u, portrait: { x: ox - Ri, y: oy - yc - Ri, w: openW, h: openH }, plaque: pl, cx: ox, cy: oy - BH * u * 0.5 };
      }
      motes(ctx, w * 0.15, h * 0.1, w * 0.7, h * 0.7, 46, t, '#ffeccc', 0.45, 3, 1.8);
      finish(ctx, w, h, 0.5, 0.04, t);
      end(ctx);
      out.pedestal = { cx: ped.cx, cy: ped.top, rx: ped.rx, ry: ped.ry };
      out.hologram = { x: ped.cx - hsc * 1.1, y: hcy - hsc * 1.2, w: hsc * 2.2, h: hsc * 2.4 };
      out.top = { x: w * 0.1, y: 0, w: w * 0.8, h: h * 0.1 };
      out.bottom = { x: w * 0.12, y: h * 0.86, w: w * 0.76, h: h * 0.13 };
      return out;
    },
  };

  /* ======================================================================= NEWSROOM : Galactic News Network */
  const EMP = ['#e8504d', '#4a90e8', '#4ed17a', '#e8c94a', '#b45be8', '#e88a3a'];
  const RACE_CODE = { alkari: 'ALK', bulrathi: 'BUL', darlok: 'DAR', human: 'HUM', klackon: 'KLA', meklar: 'MEK', mrrshan: 'MRR', psilon: 'PSI', sakkra: 'SAK', silicoid: 'SIL' };

  /* original GNN mark: a globe wrapped by an orbit ring with a satellite */
  function gnnLogo(g, cx, cy, r, t, a, label, sub) {
    g.save(); g.globalAlpha *= a; g.translate(cx, cy);
    const tilt = -0.36, rx = r * 1.72, ry = r * 0.5, th = t * 0.7;
    const ring = (front) => {
      g.save(); g.rotate(tilt);
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, front ? 0 : PI, front ? PI : TAU);
      g.lineWidth = r * 0.13; g.strokeStyle = lgr(g, -rx, 0, rx, 0, [0, C.brassLo, 0.5, C.brassHi, 1, C.brassLo]); g.stroke();
      g.lineWidth = r * 0.03; g.strokeStyle = rgba('#fff7d8', 0.7); g.stroke();
      const sx = cos(th) * rx, sy = sin(th) * ry;
      if ((sin(th) > 0) === front) { glow(g, '#9fe4ff', sx, sy, r * 0.5, 0.9); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, r * 0.085, 0, TAU); g.fill(); }
      g.restore();
    };
    ring(false);
    g.beginPath(); g.arc(0, 0, r, 0, TAU);
    g.fillStyle = rgr(g, -r * 0.38, -r * 0.4, r * 0.05, r * 1.15, [0, '#d8f0ff', 0.28, '#5b9be0', 0.65, '#1b3a8e', 1, '#071040']); g.fill();
    g.save(); g.clip();
    g.strokeStyle = rgba('#e6f4ff', 0.42); g.lineWidth = max(0.8, r * 0.035);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(0, 0, r * i / 4 * 1.0, r, 0, 0, TAU); g.stroke(); }
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-r, i * r * 0.36); g.quadraticCurveTo(0, i * r * 0.36 + (i ? i * r * 0.13 : 0), r, i * r * 0.36); g.stroke(); }
    g.fillStyle = 'rgba(2,6,30,0.5)'; g.beginPath(); g.arc(r * 0.42, r * 0.4, r * 1.05, 0, TAU); g.arc(-r * 0.0, 0, r * 1.0, 0, TAU, true); g.fill('evenodd');
    g.restore();
    g.lineWidth = r * 0.06; g.strokeStyle = brassGrad(g, -r, -r, r, r); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    ring(true);
    if (label) {
      const fs = r * 1.28;
      text(g, label, r * 2.3, fs * 0.36, fs, C.ivory, 'left', FONT_D, 400, fs * 0.08);
      if (sub) text(g, sub, r * 2.34, fs * 0.36 + r * 0.62, r * 0.36, rgba(C.brassHi, 0.85), 'left', FONT_U, 600, r * 0.1);
    }
    g.restore();
  }
  function wallHeader(g, x, y, w, h, title, t, col) {
    const fs = max(9, h * 0.052);
    g.fillStyle = rgba(col, 0.16); g.fillRect(x, y, w, fs * 2.1);
    g.fillStyle = col; g.fillRect(x, y + fs * 2.1 - 1.5, w, 1.5);
    text(g, title, x + w * 0.025, y + fs * 1.45, fs, lite(col, 0.55), 'left', FONT_D, 400, fs * 0.12);
    const bl = sin(t * 4) > -0.3 ? 1 : 0.15;
    g.fillStyle = rgba(C.rose, bl); g.beginPath(); g.arc(x + w - w * 0.075, y + fs * 1.05, fs * 0.28, 0, TAU); g.fill();
    text(g, 'LIVE', x + w - w * 0.05, y + fs * 1.4, fs * 0.78, C.ivory, 'left', FONT_U, 600, fs * 0.1);
    return fs * 2.1;
  }
  const NEWS_G = {
    ticker(g, x, y, w, h, t) { // empire rankings board
      g.fillStyle = lgr(g, x, y, x, y + h, [0, '#071246', 1, '#030820']); g.fillRect(x, y, w, h);
      const hh = wallHeader(g, x, y, w, h, 'GALACTIC POWER INDEX', t, C.cyan);
      const rh = h * 0.092, top = y + hh + rh * 0.2, scroll = t * rh * 0.28, base = floor(scroll / rh), off = scroll - base * rh;
      g.save(); g.beginPath(); g.rect(x, y + hh, w, h - hh); g.clip();
      const fs = rh * 0.52;
      for (let k = -1; k < 11; k++) {
        const idx = base + k, ri = ((idx % 10) + 10) % 10, yy = top + k * rh - off, v = 60 + 38 * h2(ri, 5) + 6 * sin(t * (0.8 + ri * 0.13) + ri), up = sin(t * 0.9 + ri * 2.1) > 0;
        const al = clamp(min((yy - (y + hh)) / rh, (y + h - yy) / rh), 0, 1), col = EMP[ri % 6], race = RACE_IDS[ri];
        g.globalAlpha = al;
        if (k % 2 === 0) { g.fillStyle = 'rgba(120,160,255,0.06)'; g.fillRect(x, yy, w, rh); }
        text(g, String(ri + 1), x + w * 0.05, yy + rh * 0.7, fs, C.mist, 'center', FONT_U, 600);
        g.fillStyle = col; g.fillRect(x + w * 0.09, yy + rh * 0.25, w * 0.012, rh * 0.5);
        text(g, RACE_CODE[race], x + w * 0.12, yy + rh * 0.7, fs, C.ivory, 'left', FONT_D, 400, fs * 0.1);
        const bw = w * 0.4 * (v / 110);
        g.fillStyle = lgr(g, x + w * 0.3, 0, x + w * 0.3 + bw, 0, [0, rgba(col, 0.25), 1, col]); g.fillRect(x + w * 0.3, yy + rh * 0.3, bw, rh * 0.4);
        text(g, v.toFixed(1), x + w * 0.85, yy + rh * 0.7, fs, C.gold, 'right', FONT_U, 600);
        g.fillStyle = up ? C.leaf : C.rose; g.beginPath();
        if (up) { g.moveTo(x + w * 0.93, yy + rh * 0.3); g.lineTo(x + w * 0.945, yy + rh * 0.68); g.lineTo(x + w * 0.915, yy + rh * 0.68); } else { g.moveTo(x + w * 0.93, yy + rh * 0.68); g.lineTo(x + w * 0.945, yy + rh * 0.3); g.lineTo(x + w * 0.915, yy + rh * 0.3); }
        g.fill();
      }
      g.restore();
    },
    chart(g, x, y, w, h, t) {
      g.fillStyle = lgr(g, x, y, x, y + h, [0, '#071246', 1, '#030820']); g.fillRect(x, y, w, h);
      const hh = wallHeader(g, x, y, w, h, 'INDUSTRIAL OUTPUT', t, C.ember);
      const px = x + w * 0.09, py = y + hh + h * 0.07, pw = w * 0.86, ph = h - hh - h * 0.2;
      g.strokeStyle = rgba(C.mist, 0.18); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 5; i++) { g.moveTo(px, py + ph * i / 5); g.lineTo(px + pw, py + ph * i / 5); }
      g.stroke();
      for (let i = 0; i <= 5; i += 1) text(g, String(100 - i * 20), px - 6, py + ph * i / 5 + 4, max(8, h * 0.034), C.fog, 'right', FONT_U, 400);
      const n = 6, per = 7, ph0 = floor(t / per), k = clamp((t - ph0 * per) / 1.4, 0, 1), ez = 1 - pow(1 - k, 3), bw = pw / n;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a0 = 0.25 + 0.7 * h2(ph0 - 1, i + 3), a1 = 0.25 + 0.7 * h2(ph0, i + 3), v = lerp(a0, a1, ez), bh = ph * v, bx = px + i * bw + bw * 0.16, bwid = bw * 0.68, by = py + ph - bh;
        g.fillStyle = lgr(g, 0, by, 0, py + ph, [0, EMP[i], 1, dark(EMP[i], 0.6)]); g.fillRect(bx, by, bwid, bh);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx, by, bwid, 2);
        text(g, String(floor(v * 100)), bx + bwid / 2, by - 5, max(9, h * 0.04), C.ivory, 'center', FONT_U, 600);
        text(g, RACE_CODE[RACE_IDS[i]], bx + bwid / 2, py + ph + h * 0.06, max(8, h * 0.036), C.mist, 'center', FONT_D, 400, 1);
        pts.push(bx + bwid / 2, by - h * 0.04 * (0.5 + 0.5 * sin(t * 1.3 + i)));
      }
      g.strokeStyle = rgba(C.cyan, 0.9); g.lineWidth = 2; g.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) g.lineTo(pts[i], pts[i + 1]); else g.moveTo(pts[i], pts[i + 1]); } g.stroke();
      for (let i = 0; i < pts.length; i += 2) glow(g, C.cyan, pts[i], pts[i + 1], h * 0.04, 0.8);
    },
    map(g, w0, y0, w, h, t) { // galaxy overview map
      const x = w0;
      g.fillStyle = lgr(g, x, y0, x, y0 + h, [0, '#060e3c', 1, '#02051a']); g.fillRect(x, y0, w, h);
      const hh = wallHeader(g, x, y0, w, h, 'SECTOR OVERVIEW', t, C.teal);
      const R = mulberry32(31), n = 74, pts = [], my = y0 + hh, mh = h - hh;
      for (let i = 0; i < n; i++) pts.push([x + w * (0.04 + R() * 0.92), my + mh * (0.07 + R() * 0.86), i % 6]);
      g.save(); g.beginPath(); g.rect(x, my, w, mh); g.clip();
      g.globalCompositeOperation = 'lighter';
      for (let e = 0; e < 6; e++) { const p = pts[e * 11 % n]; glow(g, EMP[e], p[0], p[1], mh * 0.5, 0.26); glow(g, EMP[e], p[0], p[1], mh * 0.25, 0.2); }
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = rgba('#8aa8ff', 0.5); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1]; if (dx * dx + dy * dy < mh * mh * 0.03) { g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); } }
      g.globalAlpha = 0.45; g.stroke(); g.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        const own = i % 3 === 0, tw = 0.6 + 0.4 * sin(t * 1.5 + i);
        g.fillStyle = own ? EMP[pts[i][2]] : rgba('#dbe8ff', 0.8 * tw); const r = own ? 3 : 1.6; g.fillRect(pts[i][0] - r, pts[i][1] - r, r * 2, r * 2);
        if (own) { g.strokeStyle = rgba(EMP[pts[i][2]], 0.6); g.lineWidth = 1; g.strokeRect(pts[i][0] - r - 2, pts[i][1] - r - 2, r * 2 + 4, r * 2 + 4); }
      }
      const hot = [x + w * 0.64, my + mh * 0.58], q = fract(t * 0.5), fs = max(9, h * 0.04);
      g.strokeStyle = rgba(C.rose, 1 - q); g.lineWidth = 2; g.beginPath(); g.arc(hot[0], hot[1], mh * 0.03 + q * mh * 0.14, 0, TAU); g.stroke();
      g.strokeStyle = C.rose; g.lineWidth = 1.4; g.strokeRect(hot[0] - 7, hot[1] - 7, 14, 14);
      g.beginPath(); g.moveTo(hot[0] + 7, hot[1] - 7); g.lineTo(hot[0] + w * 0.07, hot[1] - mh * 0.16); g.lineTo(hot[0] + w * 0.07 + textW(g, 'ENGAGEMENT', fs, FONT_D, 400, 1) + 8, hot[1] - mh * 0.16); g.stroke();
      text(g, 'ENGAGEMENT', hot[0] + w * 0.07 + 4, hot[1] - mh * 0.16 - 5, fs, C.rose, 'left', FONT_D, 400, 1);
      const sw = t * 0.8, cx0 = x + w * 0.5, cy0 = my + mh * 0.5, RR = hypot(w, mh) * 0.5;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lgr(g, cx0, cy0, cx0 + cos(sw) * RR, cy0 + sin(sw) * RR, [0, rgba(C.teal, 0.0), 1, rgba(C.teal, 0.22)]);
      g.beginPath(); g.moveTo(cx0, cy0); g.arc(cx0, cy0, RR, sw - 0.5, sw); g.closePath(); g.fill();
      g.strokeStyle = rgba(C.teal, 0.7); g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx0, cy0); g.lineTo(cx0 + cos(sw) * RR, cy0 + sin(sw) * RR); g.stroke();
      g.strokeStyle = rgba(C.teal, 0.22); g.lineWidth = 1; for (const k of [0.25, 0.5, 0.75]) { g.beginPath(); g.arc(cx0, cy0, RR * k * 0.8, 0, TAU); g.stroke(); }
      g.restore();
    },
    battle(g, x, y, w, h, t, o) { // combat footage
      g.fillStyle = '#02040e'; g.fillRect(x, y, w, h);
      const hh = wallHeader(g, x, y, w, h, 'COMBAT FOOTAGE', t, C.rose), my = y + hh, mh = h - hh;
      g.save(); g.beginPath(); g.rect(x, my, w, mh); g.clip();
      const sh = (sin(t * 23) + sin(t * 31)) * 0.8 * (h2(floor(t * 3), 1) > 0.7 ? 1 : 0.2);
      g.translate(sh, sh * 0.6);
      const R = mulberry32(88);
      g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { g.globalAlpha = 0.2 + R() * 0.7; g.fillRect(x + R() * w, my + R() * mh, 1.2, 1.2); }
      g.globalAlpha = 1;
      glow(g, '#5b3aa8', x + w * 0.5, my + mh * 0.5, w * 0.5, 0.25);
      const ships = [[0.14, 0.3, 0.1, 'human', '#4a90e8'], [0.2, 0.62, 0.0, 'human', '#4a90e8'], [0.1, 0.78, 0.05, 'human', '#4a90e8'], [0.86, 0.26, PI, 'bulrathi', '#e8504d'], [0.8, 0.52, PI + 0.1, 'bulrathi', '#e8504d'], [0.88, 0.74, PI - 0.1, 'bulrathi', '#e8504d']];
      const size = mh * 0.17;
      for (let i = 0; i < 6; i++) {
        const s = ships[i], bob = sin(t * 0.8 + i * 2) * mh * 0.012, sx = x + w * s[0] + (i < 3 ? 1 : -1) * sin(t * 0.3 + i) * w * 0.01, sy = my + mh * s[1] + bob;
        drawShip(g, { race: s[3], hull: i % 3 === 1 ? 'cruiser' : 'destroyer', x: sx, y: sy, size: size * (i % 3 === 1 ? 1.15 : 0.9), angle: s[2], color: s[4], t: t, thrust: 0.7, seed: i });
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const k = floor(t * 3.2 + i * 7), a = h2(k, i + 11), b = h2(k, i + 21), ph = fract(t * 3.2 + i * 7);
        const L = ships[(a * 3) | 0], Rr = ships[3 + ((b * 3) | 0)], lx = x + w * L[0] + size * 0.5, ly = my + mh * L[1], rx = x + w * Rr[0] - size * 0.5, ry = my + mh * Rr[1];
        if (i % 2) { const tx = lerp(rx, lx, ph), ty = lerp(ry, ly, ph); g.strokeStyle = '#ff8a6a'; g.lineWidth = 2.4; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + (rx - lx) * 0.06, ty + (ry - ly) * 0.06); g.stroke(); }
        else { g.strokeStyle = '#8fd8ff'; g.lineWidth = 2.4; g.globalAlpha = 0.85 * (1 - ph) ; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lerp(lx, rx, min(1, ph * 3)), lerp(ly, ry, min(1, ph * 3))); g.stroke(); g.lineWidth = 7; g.globalAlpha = 0.18 * (1 - ph); g.stroke(); }
      }
      for (let i = 0; i < 3; i++) { // explosions
        const per = 2.2, ph = fract(t / per + i / 3), k = floor(t / per + i / 3), ex = x + w * (0.3 + 0.4 * h2(k, i + 40)), ey = my + mh * (0.2 + 0.6 * h2(k, i + 50));
        if (ph < 0.6) { const q = ph / 0.6; glow(g, '#ffb060', ex, ey, mh * (0.04 + 0.2 * q), (1 - q) * 0.95); g.strokeStyle = rgba('#ffd9a0', 1 - q); g.globalAlpha = 1; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, mh * 0.2 * q, 0, TAU); g.stroke(); }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.fillStyle = scanPattern(g); g.globalAlpha = 0.7; g.fillRect(x, my, w, mh); g.globalAlpha = 1;
      g.restore();
      text(g, 'REC', x + w * 0.04, my + mh * 0.93, max(9, h * 0.042), C.rose, 'left', FONT_U, 700, 1.5);
      g.fillStyle = rgba(C.rose, sin(t * 4) > 0 ? 1 : 0.2); g.beginPath(); g.arc(x + w * 0.03, my + mh * 0.915, h * 0.012, 0, TAU); g.fill();
      text(g, 'SEC 7-G  T+' + floor(t % 60).toString().padStart(2, '0') + ':' + floor((t * 100) % 100).toString().padStart(2, '0'), x + w * 0.96, my + mh * 0.93, max(9, h * 0.04), C.mist, 'right', FONT_U, 500);
    },
    planet(g, x, y, w, h, t, o) {
      g.fillStyle = lgr(g, x, y, x, y + h, [0, '#071246', 1, '#02051a']); g.fillRect(x, y, w, h);
      const hh = wallHeader(g, x, y, w, h, 'SYSTEM SURVEY', t, C.leaf), my = y + hh, mh = h - hh;
      const R = mulberry32(5); g.fillStyle = '#fff';
      for (let i = 0; i < 50; i++) { g.globalAlpha = 0.2 + R() * 0.6; g.fillRect(x + R() * w, my + R() * mh, 1.2, 1.2); } g.globalAlpha = 1;
      const pr = min(mh * 0.36, w * 0.2), pcx = x + w * 0.3, pcy = my + mh * 0.52;
      glow(g, '#6fb0ff', pcx, pcy, pr * 1.9, 0.3);
      g.strokeStyle = rgba(C.cyan, 0.3); g.lineWidth = 1; g.beginPath(); g.ellipse(pcx, pcy, pr * 1.55, pr * 0.5, -0.3, 0, TAU); g.stroke();
      drawPlanet(g, o.newsPlanet || { look: 'terran', seed: 4, inhabited: true }, pcx, pcy, pr, t, { dpr: 1, spin: 0.03 });
      const ang = t * 0.5, ox = pcx + cos(ang) * pr * 1.55 * cos(-0.3) - sin(ang) * pr * 0.5 * sin(-0.3), oy = pcy + cos(ang) * pr * 1.55 * sin(-0.3) + sin(ang) * pr * 0.5 * cos(-0.3);
      glow(g, C.cyan, ox, oy, pr * 0.2, 0.9); g.fillStyle = '#fff'; g.fillRect(ox - 1.5, oy - 1.5, 3, 3);
      const rows = [['POPULATION', 0.78, C.leaf], ['INDUSTRY', 0.55, C.ember], ['RESEARCH', 0.68, C.cyan], ['ENVIRONMENT', 0.9, C.teal], ['DEFENCE', 0.35, C.azure]];
      const bx = x + w * 0.58, bw = w * 0.36, fs = max(8, mh * 0.052);
      for (let i = 0; i < rows.length; i++) {
        const by = my + mh * (0.2 + i * 0.14), v = clamp(rows[i][1] + 0.05 * sin(t * (0.9 + i * 0.3) + i), 0, 1);
        text(g, rows[i][0], bx, by, fs, C.mist, 'left', FONT_D, 400, 1);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(bx, by + fs * 0.4, bw, fs * 0.5);
        g.fillStyle = lgr(g, bx, 0, bx + bw * v, 0, [0, dark(rows[i][2], 0.5), 1, rows[i][2]]); g.fillRect(bx, by + fs * 0.4, bw * v, fs * 0.5);
      }
    },
  };
  let _nb = null;
  Scenes.newsroom = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), cut = clamp(+o.cut || 0, 0, 1), I = cut > 0 && cut < 1 ? pow(sin(cut * PI), 1.2) : 0;
      const tgt = I > 0.01 ? ctx : null;
      let out = ctx, buf = null;
      if (tgt) { // render into a buffer so the cut can tear / zoom it
        const bw = Math.ceil(w * S), bh = Math.ceil(h * S);
        if (!_nb) _nb = mk(bw, bh); if (_nb.width !== bw || _nb.height !== bh) { _nb.width = bw; _nb.height = bh; }
        buf = _nb; out = buf.getContext('2d'); out.setTransform(S, 0, 0, S, 0, 0); out.clearRect(0, 0, w, h); out.save(); out.beginPath(); out.rect(0, 0, w, h); out.clip();
      }
      const L = newsroomDraw(out, w, h, t, o, S, I);
      if (buf) {
        out.restore();
        ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const z = 1 + 0.16 * I, sl = 14;
        for (let i = 0; i < sl; i++) {
          const y0 = h * i / sl, hh = h / sl, off = (h2(floor(t * 30), i + 3) - 0.5) * w * 0.09 * I * (h2(i, 9) > 0.45 ? 1 : 0.15);
          ctx.save(); ctx.beginPath(); ctx.rect(0, y0, w, hh + 1); ctx.clip();
          ctx.translate(w / 2 + off, h / 2); ctx.scale(z, z); ctx.translate(-w / 2, -h / 2);
          ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, w, h);
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 * I; ctx.fillStyle = '#7fb8ff'; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // static
        const n = floor(t * 40), pat = grainPattern(ctx);
        ctx.save(); ctx.globalAlpha = 0.62 * pow(I, 1.4); ctx.translate((h2(n, 1) * 160) | 0, (h2(n, 2) * 160) | 0); ctx.fillStyle = pat; ctx.fillRect(-160, -160, w + 320, h + 320); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,' + 0.18 * I * (h2(n, 5) > 0.5 ? 1 : 0.3) + ')'; ctx.fillRect(0, h * h2(n, 7), w, h * 0.03);
        ctx.restore();
      }
      end(ctx);
      return L;
    },
  };
  function buildNewsBG(g, w, h) {
    g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#02031a', 0.35, '#0b1342', 0.7, '#0a1038', 1, '#03051a']); g.fillRect(0, 0, w, h);
    // cyclorama glow behind the wall
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgr(g, w * 0.7, h * 0.34, 0, w * 0.55, [0, 'rgba(60,90,220,0.34)', 0.5, 'rgba(60,40,160,0.14)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, h);
    g.fillStyle = rgr(g, w * 0.1, h * 0.4, 0, w * 0.4, [0, 'rgba(120,70,220,0.22)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, h);
    g.restore();
    // vertical panel seams on the back wall
    for (let i = 0; i < 14; i++) {
      const x = w * (i / 13); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, w * 0.034, h * 0.72);
      g.fillStyle = rgba(C.brassLo, 0.5); g.fillRect(x, 0, 1, h * 0.72);
    }
    // LED tubes
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const x of [0.215, 0.425, 0.965, 0.025]) { g.fillStyle = rgba('#bfe0ff', 0.55); g.fillRect(w * x, h * 0.08, 2.5, h * 0.62); glow(g, '#8fb8ff', w * x + 1, h * 0.38, h * 0.3, 0.16); }
    g.restore();
    // left logo panel
    const lp = { x: w * 0.045, y: h * 0.11, w: w * 0.165, h: h * 0.52 };
    chamferPath(g, lp.x, lp.y, lp.w, lp.h, 14); g.fillStyle = lgr(g, 0, lp.y, 0, lp.y + lp.h, [0, '#101a5a', 1, '#070c30']); g.fill();
    brassFrame(g, lp.x, lp.y, lp.w, lp.h, 14, 2);
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, '#6aa0ff', lp.x + lp.w / 2, lp.y + lp.h * 0.4, lp.w * 0.8, 0.35); g.restore();
    // video wall frame
    const vw = newsWall(w, h);
    chamferPath(g, vw.x - w * 0.016, vw.y - w * 0.016, vw.w + w * 0.032, vw.h + w * 0.032, 16); g.fillStyle = lgr(g, 0, vw.y, 0, vw.y + vw.h, [0, '#2a387e', 0.5, '#101a58', 1, '#070c30']); g.fill();
    brassFrame(g, vw.x - w * 0.016, vw.y - w * 0.016, vw.w + w * 0.032, vw.h + w * 0.032, 16, 2.4);
    g.fillStyle = '#01030c'; g.fillRect(vw.x, vw.y, vw.w, vw.h);
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, '#7090ff', vw.x + vw.w / 2, vw.y + vw.h / 2, vw.w * 0.85, 0.22); g.restore();
    for (const [cx, cy, sx, sy] of [[vw.x, vw.y, 1, 1], [vw.x + vw.w, vw.y, -1, 1], [vw.x, vw.y + vw.h, 1, -1], [vw.x + vw.w, vw.y + vw.h, -1, -1]]) {
      g.strokeStyle = C.brassHi; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + sx * w * 0.02, cy - sy * 5); g.lineTo(cx - sx * 5, cy - sy * 5); g.lineTo(cx - sx * 5, cy + sy * w * 0.02); g.stroke();
    }
    // truss + lights
    g.fillStyle = '#04061c'; g.fillRect(0, 0, w, h * 0.055);
    g.fillStyle = brassGrad(g, 0, 0, w, 0); g.fillRect(0, h * 0.055, w, 2); g.fillRect(0, h * 0.02, w, 1.2);
    g.strokeStyle = rgba(C.brassLo, 0.8); g.lineWidth = 1; g.beginPath();
    for (let i = 0; i <= 60; i++) { const x = w * i / 60; g.moveTo(x, h * 0.02); g.lineTo(x + w / 120, h * 0.055); g.lineTo(x + w / 60, h * 0.02); }
    g.stroke();
    const lights = [];
    for (let i = 0; i < 8; i++) {
      const x = w * (0.07 + i * 0.123), cols = ['#8fd0ff', '#ffe0a0', '#c8a8ff', '#8fd0ff'];
      g.fillStyle = '#0a0f2c'; chamferPath(g, x - 14, h * 0.05, 28, 22, 5); g.fill(); g.lineWidth = 1; g.strokeStyle = rgba(C.brass, 0.7); g.stroke();
      lights.push({ x: x, y: h * 0.07, col: cols[i % 4] });
    }
    // floor
    const fy = h * 0.735;
    g.fillStyle = lgr(g, 0, fy, 0, h, [0, '#0e1650', 0.3, '#070b2c', 1, '#02030f']); g.fillRect(0, fy, w, h - fy);
    g.save(); g.globalAlpha = 0.17; g.beginPath(); g.rect(0, fy, w, h - fy); g.clip(); g.translate(0, 2 * fy); g.scale(1, -1); g.drawImage(g.canvas, 0, 0, w, h); g.restore();
    g.fillStyle = lgr(g, 0, fy, 0, h, [0, 'rgba(6,10,40,0)', 1, 'rgba(2,3,12,0.75)']); g.fillRect(0, fy, w, h - fy);
    g.strokeStyle = rgba(C.brass, 0.5); g.lineWidth = 2; g.beginPath(); g.ellipse(w * 0.34, h * 0.99, w * 0.5, h * 0.22, 0, PI, TAU); g.stroke();
    g.strokeStyle = rgba(C.brass, 0.22); g.lineWidth = 1; g.beginPath(); g.ellipse(w * 0.34, h * 0.99, w * 0.56, h * 0.26, 0, PI, TAU); g.stroke();
    g.fillStyle = brassGrad(g, 0, 0, w, 0); g.fillRect(0, fy - 1, w, 2.5);
    bakeGrain(g, w, h, 0.05);
    return { lights: lights, lp: lp };
  }
  function newsWall(w, h) { return { x: w * 0.455, y: h * 0.135, w: w * 0.485, h: h * 0.43 }; }
  function buildNewsFG(g, w, h) {
    // curved anchor desk: glossy top surface + dark front face with a light strip
    const yB = h * 0.69, yF = h * 0.722, x0 = -w * 0.03, x1 = w * 0.625, bulge = h * 0.014;
    g.beginPath(); g.moveTo(x0, yB); g.lineTo(x1 - w * 0.02, yB);
    g.bezierCurveTo(x1 + w * 0.012, yB + h * 0.006, x1 + w * 0.02, yF + h * 0.02, x1 - w * 0.01, yF + h * 0.085);
    g.lineTo(x0, h * 0.82); g.closePath();
    g.fillStyle = lgr(g, 0, yB, 0, h * 0.82, [0, '#2c3a84', 0.12, '#1a2468', 0.2, '#0c1244', 1, '#03051c']); g.fill();
    // top surface
    g.beginPath(); g.moveTo(x0, yB); g.lineTo(x1 - w * 0.02, yB); g.bezierCurveTo(x1 + w * 0.012, yB + h * 0.006, x1 + w * 0.018, yF - h * 0.002, x1 - w * 0.012, yF + h * 0.004);
    g.bezierCurveTo(w * 0.45, yF + bulge, w * 0.2, yF + bulge, x0, yF); g.closePath();
    g.fillStyle = lgr(g, 0, yB, 0, yF + bulge, [0, '#4a5cb4', 0.5, '#2a3a8a', 1, '#16204e']); g.fill();
    g.fillStyle = lgr(g, x0, 0, x1, 0, [0, 'rgba(255,255,255,0)', 0.35, 'rgba(190,215,255,0.22)', 0.7, 'rgba(255,255,255,0.05)', 1, 'rgba(255,255,255,0)']); g.fill();
    g.lineWidth = 2.2; g.strokeStyle = brassGrad(g, 0, 0, x1, 0); g.beginPath(); g.moveTo(x0, yB); g.lineTo(x1 - w * 0.02, yB); g.stroke();
    // front edge + LED strip
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#8fe0ff', 0.95); g.lineWidth = 1.8; g.beginPath(); g.moveTo(x0, yF); g.bezierCurveTo(w * 0.2, yF + bulge, w * 0.45, yF + bulge, x1 - w * 0.012, yF + h * 0.004); g.stroke();
    g.strokeStyle = rgba('#8fe0ff', 0.2); g.lineWidth = 8; g.stroke();
    g.restore();
    g.lineWidth = 1; g.strokeStyle = rgba('#000', 0.5);
    for (let i = 1; i < 9; i++) { const x = x1 * i / 9; g.beginPath(); g.moveTo(x, yF + bulge * 1.05 + 3); g.lineTo(x + w * 0.004, h * 0.82); g.stroke(); }
    return { yT: yB, x1: x1 };
  }
  function newsroomDraw(g, w, h, t, o, S, I) {
    const bg = layer('news.bg', w, h, S, buildNewsBG), fg = layer('news.fg', w, h, S, buildNewsFG), geo = bg.d, vw = newsWall(w, h);
    const z = 1.035 + 0.008 * sin(t * 0.13) + 0.05 * I, dx = sin(t * 0.21) * w * 0.006, dy = cos(t * 0.17) * h * 0.004;
    g.save();
    g.translate(w * 0.5 + dx, h * 0.5 + dy); g.scale(z, z); g.translate(-w * 0.5, -h * 0.5);
    g.drawImage(bg.c, 0, 0, w, h);
    // lights flicker + beams
    for (let i = 0; i < geo.lights.length; i++) {
      const L = geo.lights[i], sw = sin(t * 0.25 + i * 1.7) * w * 0.04, tx = L.x + (w * 0.5 - L.x) * 0.25 + sw;
      beam(g, L.x, L.y, tx, h * 0.76, 10, w * 0.12, L.col, 0.07 + 0.015 * sin(t * 0.9 + i));
      glow(g, L.col, L.x, L.y + 4, 26, 0.55 + 0.1 * sin(t * 3 + i));
    }
    // logo panel
    const lp = geo.lp;
    gnnLogo(g, lp.x + lp.w * 0.5, lp.y + lp.h * 0.4, lp.w * 0.24, t, 1);
    text(g, 'GALACTIC', lp.x + lp.w / 2, lp.y + lp.h * 0.76, max(9, lp.w * 0.1), rgba(C.brassHi, 0.95), 'center', FONT_D, 400, lp.w * 0.014);
    text(g, 'NEWS NETWORK', lp.x + lp.w / 2, lp.y + lp.h * 0.84, max(9, lp.w * 0.1), rgba(C.brassHi, 0.95), 'center', FONT_D, 400, lp.w * 0.014);
    // video wall
    g.save(); g.beginPath(); g.rect(vw.x, vw.y, vw.w, vw.h); g.clip();
    const gname = o.graphic || 'ticker', fn = NEWS_G[gname] || NEWS_G.ticker;
    fn(g, vw.x, vw.y, vw.w, vw.h, t, o);
    g.fillStyle = scanPattern(g); g.globalAlpha = 0.4; g.fillRect(vw.x, vw.y, vw.w, vw.h); g.globalAlpha = 1;
    const sweep = fract(t * 0.12); g.fillStyle = lgr(g, 0, vw.y + sweep * vw.h * 1.4 - vw.h * 0.2, 0, vw.y + sweep * vw.h * 1.4, [0, 'rgba(160,200,255,0)', 1, 'rgba(160,200,255,0.07)']); g.fillRect(vw.x, vw.y, vw.w, vw.h);
    g.restore();
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, '#7f9fff', vw.x + vw.w / 2, vw.y + vw.h / 2, vw.w * 0.75, 0.1); g.restore();
    // anchor
    const ph = h * 0.64, pw = ph * 0.8, px = w * 0.16, py = h * 0.715 - ph;
    glow(g, '#7090ff', px + pw / 2, py + ph * 0.42, pw * 1.0, 0.34);
    featheredPortrait(g, o.anchorRace || 'human', px, py, pw, ph, { t: t, mood: 'neutral', talking: o.talking !== false, color: o.color || '#6a8cff', bg: false, key: 'news' }, 0.05, 0, 0);
    glow(g, '#8aa8ff', px + pw * 1.02, py + ph * 0.5, pw * 0.5, 0.16); // rim light from the wall
    g.drawImage(fg.c, 0, 0, w, h);
    gnnLogo(g, w * 0.3, h * 0.757, h * 0.02, t, 0.95, 'GNN');
    g.restore();

    /* broadcast graphics (do not drift) */
    const lt = { x: w * 0.055, y: h * 0.8, w: w * 0.89, h: h * 0.092 }, tk = { x: w * 0.055, y: h * 0.905, w: w * 0.89, h: h * 0.05 };
    const tabW = w * 0.13;
    g.save();
    chamferPath(g, lt.x, lt.y, lt.w, lt.h, 10); g.fillStyle = 'rgba(5,8,32,0.9)'; g.fill();
    g.save(); chamferPath(g, lt.x, lt.y, lt.w, lt.h, 10); g.clip();
    g.fillStyle = lgr(g, lt.x, 0, lt.x + lt.w, 0, [0, 'rgba(60,90,200,0.35)', 0.5, 'rgba(20,30,100,0.12)', 1, 'rgba(60,90,200,0.3)']); g.fillRect(lt.x, lt.y, lt.w, lt.h);
    const sx = lt.x + tabW + fract(t * 0.25) * (lt.w - tabW) * 1.3 - lt.w * 0.15;
    g.globalCompositeOperation = 'lighter'; g.fillStyle = lgr(g, sx - 80, 0, sx + 80, 0, [0, 'rgba(160,210,255,0)', 0.5, 'rgba(160,210,255,0.28)', 1, 'rgba(160,210,255,0)']); g.fillRect(sx - 80, lt.y, 160, 2); g.restore();
    brassFrame(g, lt.x, lt.y, lt.w, lt.h, 10, 1.8);
    // brass tab
    poly(g, [lt.x, lt.y, lt.x + tabW, lt.y, lt.x + tabW - lt.h * 0.35, lt.y + lt.h, lt.x, lt.y + lt.h]);
    g.fillStyle = lgr(g, 0, lt.y, 0, lt.y + lt.h, [0, C.brassHi, 0.5, C.brass, 1, C.brassLo]); g.fill();
    const lblSz = lt.h * 0.34;
    g.fillStyle = rgba(C.rose, sin(t * 4) > -0.2 ? 1 : 0.25); g.beginPath(); g.arc(lt.x + lt.h * 0.32, lt.y + lt.h * 0.3, lt.h * 0.07, 0, TAU); g.fill();
    text(g, 'LIVE', lt.x + lt.h * 0.5, lt.y + lt.h * 0.38, lt.h * 0.2, '#3a1c10', 'left', FONT_U, 700, 1.5);
    text(g, 'GNN', lt.x + lt.h * 0.3, lt.y + lt.h * 0.82, lblSz, '#1a1206', 'left', FONT_D, 400, 2);
    const head = String(o.headline || 'Galactic News Network');
    let fs = lt.h * 0.46; const maxW = lt.w - tabW - lt.h * 0.9;
    while (fs > lt.h * 0.26 && textW(g, head, fs, FONT_D, 400, 0.6) > maxW) fs -= 0.5;
    let line = head;
    if (textW(g, line, fs, FONT_D, 400, 0.6) > maxW) { while (line.length > 4 && textW(g, line + '...', fs, FONT_D, 400, 0.6) > maxW) line = line.slice(0, -1); line += '...'; }
    g.save(); g.shadowColor = 'rgba(120,180,255,0.6)'; g.shadowBlur = 8;
    text(g, line, lt.x + tabW + lt.h * 0.28, lt.y + lt.h * 0.64, fs, C.ivory, 'left', FONT_D, 400, 0.6);
    g.restore();
    // ticker
    chamferPath(g, tk.x, tk.y, tk.w, tk.h, 8); g.fillStyle = 'rgba(3,5,24,0.92)'; g.fill(); brassFrame(g, tk.x, tk.y, tk.w, tk.h, 8, 1.4);
    const tkw = w * 0.085;
    g.save(); g.beginPath(); g.rect(tk.x + tkw, tk.y + 2, tk.w - tkw - 3, tk.h - 4); g.clip();
    const str = String(o.ticker || "GNN - The Galaxy's Source For News"), fsT = tk.h * 0.52, gap = fsT * 3.2;
    const tw = textW(g, str, fsT, FONT_U, 500, 0.4) + gap;
    const off = (t * w * 0.055) % tw;
    for (let x = tk.x + tkw + 14 - off; x < tk.x + tk.w; x += tw) {
      text(g, str, x, tk.y + tk.h * 0.69, fsT, rgba(C.ivory, 0.95), 'left', FONT_U, 500, 0.4);
      const dx = x + tw - gap / 2, dy = tk.y + tk.h * 0.5, dz = fsT * 0.2;
      g.fillStyle = C.brass; g.beginPath(); g.moveTo(dx, dy - dz); g.lineTo(dx + dz, dy); g.lineTo(dx, dy + dz); g.lineTo(dx - dz, dy); g.closePath(); g.fill();
    }
    g.restore();
    g.fillStyle = lgr(g, tk.x + tkw, 0, tk.x + tkw + tk.w * 0.05, 0, [0, 'rgba(3,5,24,0.95)', 1, 'rgba(3,5,24,0)']); g.fillRect(tk.x + tkw, tk.y + 2, tk.w * 0.05, tk.h - 4);
    g.fillStyle = lgr(g, tk.x + tk.w - tk.w * 0.04, 0, tk.x + tk.w, 0, [0, 'rgba(3,5,24,0)', 1, 'rgba(3,5,24,0.95)']); g.fillRect(tk.x + tk.w - tk.w * 0.04, tk.y + 2, tk.w * 0.04 - 2, tk.h - 4);
    chamferPath(g, tk.x, tk.y, tkw, tk.h, 8); g.fillStyle = lgr(g, 0, tk.y, 0, tk.y + tk.h, [0, C.brass, 1, C.brassLo]); g.fill();
    text(g, 'GNN WIRE', tk.x + tkw / 2, tk.y + tk.h * 0.67, tk.h * 0.42, '#1a1206', 'center', FONT_D, 400, 1.2);
    // top-right bug
    {
      const bp = { x: w * 0.835, y: h * 0.028, w: w * 0.135, h: h * 0.082 };
      chamferPath(g, bp.x, bp.y, bp.w, bp.h, 8); g.fillStyle = 'rgba(4,7,28,0.88)'; g.fill(); brassFrame(g, bp.x, bp.y, bp.w, bp.h, 8, 1.4);
      gnnLogo(g, bp.x + bp.h * 0.55, bp.y + bp.h * 0.5, bp.h * 0.27, t, 0.95, null);
      text(g, 'GNN', bp.x + bp.h * 1.28, bp.y + bp.h * 0.64, bp.h * 0.42, rgba(C.ivory, 0.95), 'left', FONT_D, 400, 1.5);
      g.fillStyle = rgba(C.rose, sin(t * 4) > -0.2 ? 0.95 : 0.2); g.beginPath(); g.arc(bp.x + bp.w - bp.h * 0.3, bp.y + bp.h * 0.5, bp.h * 0.09, 0, TAU); g.fill();
    }
    g.restore();
    finish(g, w, h, 0.45, 0.035, t);
    return { anchor: { x: px, y: py, w: pw, h: ph }, wall: { x: vw.x, y: vw.y, w: vw.w, h: vw.h }, lowerThird: lt, ticker: tk, logo: { x: w * 0.9, y: h * 0.04, w: w * 0.06, h: h * 0.07 } };
  }

  /* ======================================================================= AUDIENCE : ten diplomatic halls */
  /* ---- little painters shared by the halls ---- */
  function ridge(g, w, base, amp, seed, bottom, fill, rough) {
    const R = mulberry32(seed), p1 = R() * 6, p2 = R() * 6, p3 = R() * 6, f1 = 0.004 + R() * 0.004;
    g.beginPath(); g.moveTo(0, bottom);
    for (let x = 0; x <= w + 6; x += 5) g.lineTo(x, base - amp * (0.5 + 0.28 * sin(x * f1 + p1) + 0.16 * sin(x * f1 * 2.7 + p2) + (rough || 0.07) * sin(x * f1 * 9 + p3)));
    g.lineTo(w + 6, bottom); g.closePath(); g.fillStyle = fill; g.fill();
  }
  function floorPersp(g, w, h, y0, vx, c0, c1, lineCol, nRad, nHor, spread) {
    g.fillStyle = lgr(g, 0, y0, 0, h, [0, c0, 1, c1]); g.fillRect(0, y0, w, h - y0);
    g.strokeStyle = lineCol; g.lineWidth = 1; g.beginPath();
    for (let i = -nRad; i <= nRad; i++) { g.moveTo(vx + i * 0.04 * w * 0.3, y0); g.lineTo(vx + i * (spread || 0.2) * w, h); }
    for (let j = 1; j <= nHor; j++) { const y = y0 + pow(j / nHor, 2.1) * (h - y0); g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke();
  }
  function curtain(g, x, y, w, h, n, c0, c1, c2) {
    const pw = w / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = lgr(g, x + i * pw, 0, x + (i + 1) * pw, 0, [0, c0, 0.45, i % 2 ? c1 : c2, 1, c0]); g.fillRect(x + i * pw, y, pw + 0.5, h);
    }
    g.fillStyle = lgr(g, 0, y, 0, y + h, [0, 'rgba(0,0,0,0.5)', 0.3, 'rgba(0,0,0,0)', 0.8, 'rgba(0,0,0,0.1)', 1, 'rgba(0,0,0,0.6)']); g.fillRect(x, y, w, h);
  }
  function hexPath(g, cx, cy, r, rot) {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = rot + i * PI / 3; const x = cx + cos(a) * r, y = cy + sin(a) * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.closePath();
  }
  function gearPath(g, cx, cy, r, teeth, rot, depth) {
    g.beginPath();
    const da = TAU / teeth;
    for (let i = 0; i < teeth; i++) {
      const a = rot + i * da, r0 = r * (1 - depth), r1 = r;
      g.lineTo(cx + cos(a) * r0, cy + sin(a) * r0); g.lineTo(cx + cos(a + da * 0.15) * r1, cy + sin(a + da * 0.15) * r1);
      g.lineTo(cx + cos(a + da * 0.45) * r1, cy + sin(a + da * 0.45) * r1); g.lineTo(cx + cos(a + da * 0.6) * r0, cy + sin(a + da * 0.6) * r0);
    }
    g.closePath();
  }
  /* hexagonal crystal prism standing on (x, by): w wide, h tall, tip pointed */
  function crystal(g, x, by, w, h, col, seed, lean) {
    const R = mulberry32(seed || 1), tip = h * 0.22, ln = (lean || 0) * h, hw = w / 2;
    const cL = lite(col, 0.1), cM = col, cD = dark(col, 0.55), cT = lite(col, 0.45);
    const pts = { bl: [x - hw, by], br: [x + hw, by], ml: [x - hw + ln * 0.3, by - h + tip], mr: [x + hw + ln * 0.3, by - h + tip], mm: [x + ln * 0.35, by - h + tip + w * 0.12], tp: [x + ln, by - h] };
    g.beginPath(); g.moveTo(pts.bl[0], pts.bl[1]); g.lineTo(pts.ml[0], pts.ml[1]); g.lineTo(pts.tp[0], pts.tp[1]); g.lineTo(pts.mm[0], pts.mm[1]); g.lineTo(pts.bl[0] + w * 0.46, by); g.closePath();
    g.fillStyle = lgr(g, x - hw, 0, x, 0, [0, cD, 1, cM]); g.fill();
    g.beginPath(); g.moveTo(pts.bl[0] + w * 0.46, by); g.lineTo(pts.mm[0], pts.mm[1]); g.lineTo(pts.tp[0], pts.tp[1]); g.lineTo(pts.mr[0], pts.mr[1]); g.lineTo(pts.br[0], pts.br[1]); g.closePath();
    g.fillStyle = lgr(g, x, 0, x + hw, 0, [0, cL, 1, cM]); g.fill();
    g.beginPath(); g.moveTo(pts.ml[0], pts.ml[1]); g.lineTo(pts.tp[0], pts.tp[1]); g.lineTo(pts.mr[0], pts.mr[1]); g.lineTo(pts.mm[0], pts.mm[1]); g.closePath(); g.fillStyle = cT; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = rgba('#fff', 0.5); g.lineWidth = max(0.8, w * 0.012); g.beginPath(); g.moveTo(pts.mm[0], pts.mm[1]); g.lineTo(pts.bl[0] + w * 0.46, by); g.moveTo(pts.tp[0], pts.tp[1]); g.lineTo(pts.mm[0], pts.mm[1]); g.stroke();
    g.fillStyle = rgba('#fff', 0.18 + 0.1 * R()); g.beginPath(); g.moveTo(x - hw * 0.3, by - h * 0.12); g.lineTo(x - hw * 0.1, by - h * 0.6); g.lineTo(x - hw * 0.02, by - h * 0.58); g.lineTo(x - hw * 0.18, by - h * 0.1); g.closePath(); g.fill();
  }
  function flame(g, x, y, s, t, seed) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const w1 = sin(t * 9 + seed) * 0.12 + sin(t * 15.7 + seed * 2) * 0.07, h1 = 1 + 0.18 * sin(t * 11 + seed * 3) + 0.1 * sin(t * 23 + seed);
    const layers = [['#ff4a1a', 1.0, 0.55], ['#ff9a30', 0.78, 0.7], ['#ffe27a', 0.5, 0.85], ['#ffffff', 0.26, 0.9]];
    for (const L of layers) {
      const ss = s * L[1];
      g.globalAlpha = L[2];
      g.fillStyle = L[0];
      g.beginPath(); g.moveTo(x - ss * 0.5, y);
      g.bezierCurveTo(x - ss * 0.62, y - ss * 0.6 * h1, x - ss * 0.12 + w1 * ss, y - ss * 1.0 * h1, x + w1 * ss * 1.4, y - ss * 1.7 * h1);
      g.bezierCurveTo(x + ss * 0.22 + w1 * ss, y - ss * 0.95 * h1, x + ss * 0.64, y - ss * 0.55 * h1, x + ss * 0.5, y);
      g.closePath(); g.fill();
    }
    g.restore();
  }
  function vineDraw(g, x, y, len, sway, t, seed, col, leafCol) {
    const segs = 9, p = [];
    for (let i = 0; i <= segs; i++) { const u = i / segs, sw = sin(t * 0.9 + seed + u * 2.2) * sway * u * u; p.push(x + sw + sin(seed + u * 5) * len * 0.03, y + u * len); }
    g.strokeStyle = col; g.lineWidth = max(1.2, len * 0.012); g.beginPath(); g.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke();
    g.fillStyle = leafCol;
    for (let i = 2; i < p.length; i += 4) {
      const s = len * 0.035, side = (i / 4) % 2 ? 1 : -1;
      g.beginPath(); g.moveTo(p[i], p[i + 1]); g.quadraticCurveTo(p[i] + side * s * 1.6, p[i + 1] - s * 0.6, p[i] + side * s * 2.4, p[i + 1] + s * 0.4); g.quadraticCurveTo(p[i] + side * s * 1.2, p[i + 1] + s * 0.9, p[i], p[i + 1]); g.fill();
    }
  }
  function leafShape(g, x, y, len, ang, wid, c0, c1) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.9, len, 0); g.bezierCurveTo(len * 0.7, wid * 0.9, len * 0.25, wid, 0, 0); g.closePath();
    g.fillStyle = lgr(g, 0, -wid, 0, wid, [0, c0, 1, c1]); g.fill();
    g.strokeStyle = rgba('#000', 0.25); g.lineWidth = max(0.6, len * 0.006); g.beginPath(); g.moveTo(0, 0); g.lineTo(len * 0.95, 0); g.stroke();
    g.restore();
  }
  function lanternDraw(g, x, y, r, col, t, seed, sway) {
    const sw = sin(t * 0.7 + seed) * (sway || 0), fl = 0.85 + 0.15 * sin(t * 7.3 + seed * 3) * sin(t * 3.1 + seed);
    g.save(); g.translate(x + sw, y);
    glow(g, col, 0, r * 0.2, r * 5.5, 0.55 * fl);
    g.strokeStyle = rgba('#000', 0.7); g.lineWidth = max(1, r * 0.1); g.beginPath(); g.moveTo(-sw * 0.4, -y); g.lineTo(0, -r * 1.1); g.stroke();
    g.fillStyle = '#0a0612'; g.beginPath(); g.moveTo(-r * 0.5, -r * 1.1); g.lineTo(r * 0.5, -r * 1.1); g.lineTo(r * 0.3, -r * 0.8); g.lineTo(-r * 0.3, -r * 0.8); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-r * 0.62, -r * 0.8); g.lineTo(r * 0.62, -r * 0.8); g.lineTo(r * 0.5, r * 0.9); g.lineTo(-r * 0.5, r * 0.9); g.closePath();
    g.fillStyle = lgr(g, 0, -r * 0.8, 0, r * 0.9, [0, lite(col, 0.6), 0.5, col, 1, dark(col, 0.45)]); g.globalAlpha = 0.95; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = rgba('#0a0612', 0.9); g.lineWidth = max(1, r * 0.08); g.stroke();
    g.beginPath(); g.moveTo(0, -r * 0.8); g.lineTo(0, r * 0.9); g.moveTo(-r * 0.56, 0); g.lineTo(r * 0.56, 0); g.stroke();
    glow(g, '#ffffff', 0, 0, r * 0.7, 0.5 * fl);
    g.restore();
  }
  function scrollTile(g, tile, x, y, w, h, sc, offX, a) {
    const tw = max(8, Math.round(tile.width * sc));
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = a;
    const o = Math.round(((offX % tw) + tw) % tw);
    for (let px = Math.round(x) - o; px < x + w; px += tw) g.drawImage(tile, px, y, tw, h);
    g.restore();
  }
  /* tile scaled to w x h with soft top/bottom fade (static cloud banks, mist) */
  function softBand(tile, w, h, fade) {
    const c = mk(w, h), g = c.getContext('2d');
    g.drawImage(tile, 0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = lgr(g, 0, 0, 0, h, [0, 'rgba(0,0,0,0)', fade || 0.35, 'rgba(0,0,0,1)', 1 - (fade || 0.35), 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, h);
    g.fillStyle = lgr(g, 0, 0, w, 0, [0, 'rgba(0,0,0,0)', 0.2, 'rgba(0,0,0,1)', 0.8, 'rgba(0,0,0,1)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, h);
    return c;
  }
  function birdDraw(g, x, y, s, flap, col) {
    g.strokeStyle = col; g.lineWidth = max(1, s * 0.12); g.lineCap = 'round'; g.beginPath();
    const f = sin(flap) * s * 0.5;
    g.moveTo(x - s, y - f); g.quadraticCurveTo(x - s * 0.4, y - f * 0.4 - s * 0.35, x, y); g.quadraticCurveTo(x + s * 0.4, y - f * 0.4 - s * 0.35, x + s, y - f); g.stroke();
  }
  function sunburst(g, cx, cy, r0, r1, n, c0, c1) {
    for (let i = 0; i < n; i++) {
      const a0 = i * TAU / n, a1 = a0 + TAU / n * 0.5;
      g.beginPath(); g.moveTo(cx + cos(a0) * r0, cy + sin(a0) * r0); g.lineTo(cx + cos((a0 + a1) / 2) * r1, cy + sin((a0 + a1) / 2) * r1); g.lineTo(cx + cos(a1) * r0, cy + sin(a1) * r0); g.closePath();
      g.fillStyle = lgr(g, cx, cy, cx + cos(a0) * r1, cy + sin(a0) * r1, [0, c0, 1, c1]); g.fill();
    }
  }

  const MOOD_ALIAS = { neutral: 'neutral', calm: 'neutral', pleased: 'pleased', happy: 'pleased', friendly: 'pleased', joy: 'pleased', glad: 'pleased', angry: 'angry', furious: 'angry', hostile: 'angry', war: 'angry', worried: 'worried', afraid: 'worried', fear: 'worried', sad: 'worried', uneasy: 'worried', scheming: 'scheming', sly: 'scheming', cunning: 'scheming', smug: 'scheming' };
  const MOOD_FX = { neutral: { c: '#ffffff', a: 0, rim: null }, pleased: { c: '#ffc85a', a: 0.2, rim: '#ffd890' }, angry: { c: '#ff2a3a', a: 0.3, rim: '#ff5a50' }, worried: { c: '#3d6bff', a: 0.26, rim: '#7a9cff' }, scheming: { c: '#a855ff', a: 0.26, rim: '#c890ff' } };
  const HALLS = {};
  function audGeo(w, h) {
    // portrait screens (phones): sizing by height then clamping to 44 % of the width left a small leader standing at the bottom edge, where the
    // dialogue panel covers the lower half of the screen. There the leader is sized by the width, centred, and stands in the upper band.
    if (w < h * 0.8) {
      const lw = min(w * 0.92, h * 0.4), lh = lw / 0.8, cx = w * 0.5;
      return { w: w, h: h, cx: cx, L: { x: cx - lw / 2, y: h * 0.1, w: lw, h: lh }, hz: h * 0.56, fy: h * 0.78, portrait: true };
    }
    let lh = h * 0.9, lw = lh * 0.8;
    if (lw > w * 0.44) { lw = w * 0.44; lh = lw / 0.8; }
    const cx = w * 0.625;
    return { w: w, h: h, cx: cx, L: { x: cx - lw / 2, y: h * 1.01 - lh, w: lw, h: lh }, hz: h * 0.56, fy: h * 0.78 };
  }

  /* ---- ALKARI : sun-bright aerie ---- */
  HALLS.alkari = {
    key: '#fff2c4', amb: '#9fd0ff', rim: '#fff0b8',
    bg(g, w, h, c, G) {
      g.fillStyle = lgr(g, 0, 0, 0, h * 0.8, [0, '#2a6ec8', 0.45, '#86c0f0', 0.85, '#ffeec4', 1, '#fff6dc']); g.fillRect(0, 0, w, h);
      const sx = w * 0.17, sy = h * 0.27;
      g.save(); g.globalCompositeOperation = 'lighter';
      glow(g, '#fffbe8', sx, sy, h * 0.75, 0.5); glow(g, '#ffe2a0', sx, sy, h * 0.3, 0.7);
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24 + 0.07, L = w * 1.3, wd = 0.02 + 0.035 * h2(i, 3); g.fillStyle = rgba('#fff4cc', 0.035 + 0.05 * h2(i, 4)); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + cos(a - wd) * L, sy + sin(a - wd) * L); g.lineTo(sx + cos(a + wd) * L, sy + sin(a + wd) * L); g.closePath(); g.fill(); }
      g.restore();
      ridge(g, w, h * 0.66, h * 0.14, 5, h, '#a8c8ec'); ridge(g, w, h * 0.72, h * 0.12, 9, h, '#86aedc'); ridge(g, w, h * 0.77, h * 0.09, 14, h, '#6590c8');
      // floating isles
      const R = mulberry32(21);
      for (let i = 0; i < 4; i++) {
        const x = w * (0.08 + R() * 0.85), y = h * (0.3 + R() * 0.2), s = h * (0.04 + R() * 0.05);
        g.beginPath(); g.moveTo(x - s * 1.6, y); g.quadraticCurveTo(x, y - s * 0.5, x + s * 1.6, y); g.quadraticCurveTo(x + s * 0.8, y + s * 1.9, x, y + s * 2.1); g.quadraticCurveTo(x - s * 0.8, y + s * 1.9, x - s * 1.6, y); g.closePath();
        g.fillStyle = lgr(g, 0, y - s * 0.4, 0, y + s * 2.1, [0, '#a8d878', 0.1, '#78b058', 0.12, '#9a8062', 0.5, '#6a5444', 1, '#3a2c2c']); g.fill();
        g.fillStyle = '#4a8a46'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (k - 1.5) * s * 0.5, y - s * 0.25, s * (0.16 + 0.05 * (k % 2)), 0, TAU); g.fill(); }
        g.fillStyle = rgba('#fff', 0.25); g.fillRect(x - s * 1.2, y - 1, s * 2.4, 1.2);
      }
      // cloud banks near the horizon
      { const ct = softBand(fogTile(7, 256, '#ffffff', 0.45, 0.78, 0.9, 5, 3), Math.ceil(w * 0.5), Math.ceil(h * 0.16), 0.4); g.save(); g.globalAlpha = 0.7; for (let i = 0; i < 3; i++) g.drawImage(ct, w * (0.18 * i - 0.08), h * 0.64 + (i % 2) * h * 0.015, w * 0.5, h * 0.16); g.restore(); }
      // terrace floor
      const fy = h * 0.8;
      g.fillStyle = lgr(g, 0, fy, 0, h, [0, '#f2e6c6', 0.5, '#d8c9a2', 1, '#a89870']); g.fillRect(0, fy, w, h - fy);
      g.strokeStyle = rgba('#8a7440', 0.3); g.lineWidth = 1; g.beginPath();
      for (let i = -9; i <= 9; i++) { g.moveTo(w * 0.6 + i * w * 0.02, fy); g.lineTo(w * 0.6 + i * w * 0.14, h); }
      for (let j = 1; j < 7; j++) { const y = fy + pow(j / 7, 1.8) * (h - fy); g.moveTo(0, y); g.lineTo(w, y); }
      g.stroke();
      g.fillStyle = brassGrad(g, 0, 0, w, 0); g.fillRect(0, fy - 1, w, 3);
      // architrave arch + pillars
      const pillar = (x0, pw, top) => {
        g.fillStyle = lgr(g, x0, 0, x0 + pw, 0, [0, '#9a8a64', 0.3, '#f0e2c0', 0.7, '#cdbb90', 1, '#7a6a48']); g.fillRect(x0, top, pw, fy - top + 3);
        g.fillStyle = brassGrad(g, x0, 0, x0 + pw, 0); for (const yy of [0.18, 0.55, 0.9]) g.fillRect(x0 - 3, h * yy, pw + 6, h * 0.018);
        g.strokeStyle = rgba('#8a7440', 0.35); g.beginPath(); for (let i = 1; i < 5; i++) { g.moveTo(x0 + pw * i / 5, top); g.lineTo(x0 + pw * i / 5, fy); } g.stroke();
      };
      pillar(-w * 0.01, w * 0.095, 0); pillar(w * 0.92, w * 0.09, 0);
      pillar(w * 0.135, w * 0.028, h * 0.1); pillar(w * 0.84, w * 0.026, h * 0.1);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.05); g.quadraticCurveTo(w * 0.5, h * 0.2, 0, h * 0.05); g.closePath();
      g.fillStyle = lgr(g, 0, 0, 0, h * 0.14, [0, '#fff4d8', 1, '#c8b488']); g.fill(); g.lineWidth = 3; g.strokeStyle = brassGrad(g, 0, 0, w, 0); g.stroke();
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) { const x = w * (0.2 + i * 0.16); g.fillStyle = lgr(g, x, 0, x + w * 0.1, h * 0.8, [0, 'rgba(255,244,200,0.2)', 1, 'rgba(255,244,200,0)']); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.05, 0); g.lineTo(x + w * 0.2, h * 0.8); g.lineTo(x + w * 0.1, h * 0.8); g.closePath(); g.fill(); }
      g.restore();
      // sun-bird emblem halo behind the leader
      const hx = G.cx, hy = h * 0.36;
      g.save(); g.globalCompositeOperation = 'lighter'; sunburst(g, hx, hy, h * 0.3, h * 0.52, 28, 'rgba(255,230,150,0.32)', 'rgba(255,230,150,0)'); glow(g, '#fff4c0', hx, hy, h * 0.55, 0.5); g.restore();
      g.strokeStyle = rgba(C.brassHi, 0.8); g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, h * 0.3, 0, TAU); g.stroke(); g.lineWidth = 1; g.beginPath(); g.arc(hx, hy, h * 0.33, 0, TAU); g.stroke();
      return { sx: sx, sy: sy };
    },
    dyn(g, w, h, t, G, d) {
      const ct = fogTile(8, 256, '#ffffff', 0.5, 0.82, 0.9, 5, 3);
      scrollTile(g, ct, 0, h * 0.2, w, h * 0.26, 2.2, t * 9, 0.35); scrollTile(g, ct, 0, h * 0.45, w, h * 0.2, 2.8, t * 16 + 99, 0.4);
      for (let i = 0; i < 3; i++) { const u = fract(t * 0.012 + i * 0.37); birdDraw(g, w * (1.1 - u * 1.3), h * (0.2 + 0.1 * i + 0.02 * sin(t + i)), h * (0.016 + i * 0.004), t * (6 + i) + i, rgba('#3a5a88', 0.7)); }
      for (let i = 0; i < 3; i++) { // pennants
        const x = [w * 0.2, w * 0.4, w * 0.9][i], sw = sin(t * 1.1 + i * 2) * 5;
        g.fillStyle = i === 1 ? '#e8504d' : '#e8c94a'; g.beginPath(); g.moveTo(x - 10, h * 0.1); g.lineTo(x + 10, h * 0.1); g.lineTo(x + 8 + sw, h * 0.24); g.lineTo(x + sw * 1.4, h * 0.27); g.lineTo(x - 8 + sw, h * 0.24); g.closePath(); g.fill();
        g.strokeStyle = rgba(C.brassHi, 0.8); g.lineWidth = 1; g.stroke();
      }
      glow(g, '#fffbe0', d.sx, d.sy, h * 0.5, 0.18 + 0.05 * sin(t * 0.8));
      motes(g, 0, 0, w, h * 0.8, 30, t, '#ffffff', 0.5, 5, 1.8);
    },
  };

  /* ---- BULRATHI : stone hall, braziers ---- */
  HALLS.bulrathi = {
    key: '#ffb060', amb: '#40508c', rim: '#ff9a4a',
    bg(g, w, h, c, G) {
      const R = mulberry32(31), fy = h * 0.78;
      g.fillStyle = '#150e18'; g.fillRect(0, 0, w, h);
      // stone courses
      const bh = h * 0.075;
      for (let row = 0, y = 0; y < fy; row++, y += bh) {
        let x = -R() * w * 0.1;
        while (x < w) {
          const bw = w * (0.07 + R() * 0.08), tone = R(), col = mixc('#241a28', '#4a3a40', tone * 0.75);
          g.fillStyle = col; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
          g.fillStyle = rgba('#fff', 0.06 + 0.05 * R()); g.fillRect(x + 1, y + 1, bw - 2, 2);
          g.fillStyle = rgba('#000', 0.25); g.fillRect(x + 1, y + bh - 4, bw - 2, 3);
          x += bw;
        }
      }
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5;
      const tt = texTile(4, 256, '#3a2c30', '#b8a090', 5, 4, 1.4); g.fillStyle = g.createPattern(tt, 'repeat'); g.fillRect(0, 0, w, fy); g.restore();
      // timber beams
      for (let i = 0; i < 4; i++) { const x = w * (0.08 + i * 0.28); g.fillStyle = lgr(g, 0, 0, 0, h * 0.09, [0, '#2a1810', 1, '#4a2c1a']); g.fillRect(x, 0, w * 0.04, h * 0.12); }
      g.fillStyle = lgr(g, 0, 0, 0, h * 0.07, [0, '#1a0e0a', 1, '#4a2c1a']); g.fillRect(0, 0, w, h * 0.07);
      g.fillStyle = rgba('#000', 0.4); g.fillRect(0, h * 0.07, w, 4);
      // great arch behind the leader
      const ax = G.cx - w * 0.27, aw = w * 0.54;
      archPath(g, ax, h * 0.1, aw, fy - h * 0.1, aw / 2);
      g.fillStyle = lgr(g, 0, h * 0.1, 0, fy, [0, '#0a0610', 1, '#1c1218']); g.fill(); g.lineWidth = 8; g.strokeStyle = '#2e2024'; g.stroke(); g.lineWidth = 2; g.strokeStyle = rgba('#b08a60', 0.45); g.stroke();
      // carved bear-paw relief in the arch crown
      g.save(); g.translate(G.cx, h * 0.19); g.fillStyle = rgba('#b08a60', 0.2);
      g.beginPath(); g.ellipse(0, 6, h * 0.04, h * 0.032, 0, 0, TAU); g.fill(); for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(i * h * 0.026, -h * 0.032 - (abs(i) === 2 ? -4 : 0), h * 0.011, h * 0.015, i * 0.2, 0, TAU); g.fill(); } g.restore();
      // hide banners
      for (const [x, wd, ln] of [[w * 0.13, w * 0.06, h * 0.34], [w * 0.31, w * 0.05, h * 0.3], [w * 0.94, w * 0.05, h * 0.32]]) {
        g.fillStyle = lgr(g, x, 0, x + wd, 0, [0, '#4a2418', 0.5, '#7a4228', 1, '#3a1c14']); g.beginPath(); g.moveTo(x, h * 0.07); g.lineTo(x + wd, h * 0.07); g.lineTo(x + wd, h * 0.07 + ln); g.lineTo(x + wd / 2, h * 0.07 + ln * 0.88); g.lineTo(x, h * 0.07 + ln); g.closePath(); g.fill();
        g.strokeStyle = rgba('#d6b36a', 0.55); g.lineWidth = 1.5; g.stroke(); g.fillStyle = rgba('#d6b36a', 0.55); g.fillRect(x + wd * 0.35, h * 0.07 + ln * 0.25, wd * 0.3, ln * 0.35);
      }
      // floor + rug
      floorPersp(g, w, h, fy, G.cx, '#241a22', '#0a060c', rgba('#000', 0.55), 10, 8, 0.2);
      g.fillStyle = lgr(g, 0, fy, 0, h, [0, '#5a1c1c', 1, '#8a2a24']); g.beginPath(); g.moveTo(G.cx - w * 0.08, fy); g.lineTo(G.cx + w * 0.08, fy); g.lineTo(G.cx + w * 0.3, h); g.lineTo(G.cx - w * 0.3, h); g.closePath(); g.fill();
      g.strokeStyle = rgba('#d6b36a', 0.5); g.lineWidth = 2; g.stroke();
      // braziers (bowl)
      const braz = [[w * 0.07, h * 0.8, h * 0.07], [w * 0.945, h * 0.78, h * 0.06]];
      for (const [x, y, s] of braz) {
        g.fillStyle = '#0a0608'; g.fillRect(x - s * 0.1, y - s * 0.4, s * 0.2, s * 1.4);
        g.beginPath(); g.moveTo(x - s * 0.9, y - s * 0.6); g.lineTo(x + s * 0.9, y - s * 0.6); g.lineTo(x + s * 0.55, y - s * 0.05); g.lineTo(x - s * 0.55, y - s * 0.05); g.closePath();
        g.fillStyle = lgr(g, x - s, 0, x + s, 0, [0, '#1a1214', 0.4, '#5a4a4a', 1, '#16100f']); g.fill(); g.strokeStyle = rgba('#b08a60', 0.7); g.lineWidth = 1.5; g.stroke();
        for (const sg of [-1, 1]) { g.strokeStyle = '#0a0608'; g.lineWidth = s * 0.08; g.beginPath(); g.moveTo(x + sg * s * 0.3, y - s * 0.05); g.lineTo(x + sg * s * 0.8, y + s * 1.0); g.stroke(); }
        g.fillStyle = '#ff7a30'; g.beginPath(); g.ellipse(x, y - s * 0.6, s * 0.85, s * 0.14, 0, 0, TAU); g.fill();
      }
      G.braz = braz;
      return { braz: braz };
    },
    dyn(g, w, h, t, G, d) {
      const fl = 0.8 + 0.2 * sin(t * 9) * sin(t * 4.3) + 0.08 * sin(t * 23);
      for (let i = 0; i < d.braz.length; i++) {
        const [x, y, s] = d.braz[i], k = i ? 0.8 : 1;
        glow(g, '#ff8a30', x, y - s * 1.2, h * 0.9, 0.5 * fl * k); glow(g, '#ffb060', x, y - s * 1.0, h * 0.34, 0.55 * fl * k);
        flame(g, x, y - s * 0.62, s * 1.2, t, i * 7); flame(g, x - s * 0.35, y - s * 0.6, s * 0.7, t, i * 7 + 3); flame(g, x + s * 0.35, y - s * 0.6, s * 0.7, t, i * 7 + 5);
        g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ffb870';
        for (let k2 = 0; k2 < 14; k2++) { const u = fract(t * (0.25 + h2(k2, i) * 0.2) + h2(k2, 40 + i)), ex = x + (h2(k2, 50 + i) - 0.5) * s * 1.4 + sin(t * 2 + k2) * s * 0.3 * u, ey = y - s * 0.7 - u * h * 0.4; g.globalAlpha = (1 - u) * 0.9; g.fillRect(ex, ey, 2, 2); }
        g.restore();
      }
      motes(g, 0, 0, w, h * 0.8, 20, t, '#ffb888', 0.35, 9, 1.6);
    },
  };

  /* ---- DARLOK : shadowed chamber, violet lanterns ---- */
  HALLS.darlok = {
    key: '#c890ff', amb: '#3a2a6a', rim: '#a060ff',
    bg(g, w, h, c, G) {
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#06030e', 0.5, '#0e0820', 1, '#04020a']); g.fillRect(0, 0, w, h);
      // backlit lattice screen
      const ax = G.cx - w * 0.28, aw = w * 0.56, fy = h * 0.78;
      archPath(g, ax, h * 0.06, aw, fy - h * 0.06, aw * 0.5);
      g.fillStyle = rgr(g, G.cx, h * 0.4, 0, aw * 0.8, [0, '#5a2a9a', 0.5, '#2a1252', 1, '#0c0620']); g.fill();
      g.save(); archPath(g, ax, h * 0.06, aw, fy - h * 0.06, aw * 0.5); g.clip();
      g.strokeStyle = rgba('#05020c', 0.95); g.lineWidth = 3; g.beginPath(); const st = h * 0.075;
      for (let i = -20; i < 40; i++) { g.moveTo(ax + i * st, h * 0.04); g.lineTo(ax + i * st + (fy - h * 0.04) * 0.6, fy); g.moveTo(ax + i * st, h * 0.04); g.lineTo(ax + i * st - (fy - h * 0.04) * 0.6, fy); }
      g.stroke();
      g.strokeStyle = rgba('#c890ff', 0.35); g.lineWidth = 1; g.stroke();
      g.restore();
      g.lineWidth = 6; g.strokeStyle = '#120a22'; archPath(g, ax, h * 0.06, aw, fy - h * 0.06, aw * 0.5); g.stroke(); g.lineWidth = 1.5; g.strokeStyle = rgba('#8a5ad0', 0.7); g.stroke();
      // curtains
      curtain(g, 0, 0, w * 0.17, fy, 9, '#07030f', '#2a1450', '#1a0c36'); curtain(g, w * 0.86, 0, w * 0.14, fy, 8, '#07030f', '#2a1450', '#1a0c36');
      g.fillStyle = rgba('#8a5ad0', 0.5); g.fillRect(0, 0, w * 0.17, 3); g.fillRect(w * 0.86, 0, w * 0.14, 3);
      // floor (black glass)
      floorPersp(g, w, h, fy, G.cx, '#14082a', '#03010a', rgba('#8a5ad0', 0.12), 9, 7, 0.22);
      g.save(); g.globalAlpha = 0.28; g.beginPath(); g.rect(0, fy, w, h - fy); g.clip(); g.translate(0, 2 * fy); g.scale(1, -1); g.drawImage(c, 0, 0, w, h); g.restore();
      g.fillStyle = rgba('#8a5ad0', 0.35); g.fillRect(0, fy - 1, w, 2);
      const ls = [[0.28, 0.16, 0.036, 0], [0.5, 0.1, 0.03, 1], [0.76, 0.12, 0.034, 2], [0.2, 0.34, 0.05, 3], [0.9, 0.3, 0.05, 4], [0.4, 0.28, 0.026, 5], [0.62, 0.05, 0.024, 6]];
      return { ls: ls.map((l) => ({ x: w * l[0], y: h * l[1], r: h * l[2], s: l[3] })) };
    },
    dyn(g, w, h, t, G, d) {
      for (const l of d.ls) lanternDraw(g, l.x, l.y, l.r, l.s % 2 ? '#a060ff' : '#c040ff', t, l.s, l.r * 0.6);
      const mist = fogTile(12, 256, '#a070ff', 0.4, 0.8, 0.5, 5, 3);
      scrollTile(g, mist, 0, h * 0.62, w, h * 0.26, 3.4, t * 12, 0.5); scrollTile(g, mist, 0, h * 0.72, w, h * 0.3, 4.6, -t * 20 + 40, 0.42);
      for (let i = 0; i < 4; i++) { // eyes in the dark
        const ph = fract(t * 0.06 + i * 0.27), vis = sstep(0, 0.1, ph) * (1 - sstep(0.6, 0.7, ph)), ex = w * [0.05, 0.19, 0.93, 0.85][i], ey = h * [0.5, 0.4, 0.46, 0.6][i], bl = sin(t * 3 + i) > 0.96 ? 0.1 : 1;
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = vis * 0.85; g.fillStyle = '#ff40d0';
        g.beginPath(); g.ellipse(ex - 9, ey, 5, 2 * bl, 0, 0, TAU); g.ellipse(ex + 9, ey, 5, 2 * bl, 0, 0, TAU); g.fill(); g.restore();
      }
      motes(g, 0, 0, w, h * 0.8, 24, t, '#c8a0ff', 0.4, 13, 1.6);
    },
  };

  /* ---- HUMAN : command bridge ---- */
  function bridgeRoom(w, h) {
    const f = h * 1.35, D = 1.35, Rz = 1.0, aE = 1.05;
    const Rx = (w * 0.5) * (D + Rz * cos(aE)) / (f * sin(aE));
    return makeRoom({ cx: w * 0.5, hy: h * 0.47, f: f, D: D, Rx: Rx, Rz: Rz, Hc: 0.5, Hw: 1.06 });
  }
  HALLS.human = {
    key: '#e8f4ff', amb: '#5b8cff', rim: '#8fb4ff',
    bg(g, w, h, c, G) {
      const room = bridgeRoom(w, h), p = room.p, Hw = p.Hw, s0 = room.s(0), AM = 1.4, geo = { room: room, mons: [] };
      g.fillStyle = '#060a1c'; g.fillRect(0, 0, w, h);
      const top = [], bot = [];
      for (let i = 0; i <= 50; i++) { const a = lerp(-AM, AM, i / 50); top.push(room.x(a), room.y(a, Hw)); bot.push(room.x(a), room.y(a, 0)); }
      // ceiling
      g.save(); g.beginPath(); g.moveTo(top[0], -20); for (let i = 0; i < top.length; i += 2) g.lineTo(top[i], top[i + 1]); g.lineTo(top[top.length - 2], -20); g.closePath();
      g.fillStyle = lgr(g, 0, 0, 0, room.y(0, Hw), [0, '#04061a', 1, '#1d2a5a']); g.fill(); g.clip();
      for (let j = -8; j <= 8; j++) { const a = j * 0.2, q0 = room.pr(0.25 * p.Rx * sin(a), Hw, 0.25 * p.Rz * cos(a)), q1 = room.pr(p.Rx * sin(a), Hw, p.Rz * cos(a)); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.lineWidth = 3; g.strokeStyle = rgba('#8a9ac8', 0.35); g.stroke(); }
      g.globalCompositeOperation = 'lighter';
      for (const kr of [0.55, 0.85]) { const pts = []; for (let a = -1.5; a <= 1.5; a += 0.05) { const q = room.pr(kr * p.Rx * sin(a), Hw, kr * p.Rz * cos(a)); pts.push(q[0], q[1]); } strokePts(g, pts); g.lineWidth = 8; g.strokeStyle = rgba('#8fc8ff', 0.07); g.stroke(); g.lineWidth = 2.2; g.strokeStyle = rgba('#d8eeff', 0.6); g.stroke(); }
      g.restore();
      // wall panels
      const da = 0.13;
      for (let a0 = -1.1, k = 0; a0 < 1.2; a0 += da, k++) {
        const a1 = a0 + da, am = a0 + da / 2, lum = 0.45 + 0.55 * cos(am * 1.1);
        const col = mixc('#0a1030', '#26346e', lum);
        wallPoly(g, room, a0, a1, 0, Hw, 3); g.fillStyle = lgr(g, 0, room.y(am, Hw), 0, room.y(am, 0), [0, dark(col, 0.3), 0.5, col, 1, dark(col, 0.4)]); g.fill();
        wallPoly(g, room, a0 + da * 0.1, a1 - da * 0.1, 0.12, 0.34, 3); g.fillStyle = rgba('#000', 0.35); g.fill();
        const sA = room.wall(a0, 0), sB = room.wall(a0, Hw); g.beginPath(); g.moveTo(sA[0], sA[1]); g.lineTo(sB[0], sB[1]); g.lineWidth = 2; g.strokeStyle = rgba('#000', 0.55); g.stroke();
      }
      const band = (Y, th, col) => { wallLine(g, room, -1.2, 1.3, Y, 60); g.lineWidth = th * 2 * s0; g.strokeStyle = col; g.stroke(); };
      band(0.34, 0.01, C.brassLo); band(0.9, 0.012, C.brassLo); band(0.12, 0.008, '#3a4a8a');
      // central view screen
      const VA = 0.58, VY0 = 0.36, VY1 = 0.88;
      wallPoly(g, room, -VA - 0.03, VA + 0.03, VY0 - 0.04, VY1 + 0.045, 30); g.fillStyle = '#0c1438'; g.fill(); g.lineWidth = 2.4; g.strokeStyle = brassGrad(g, 0, 0, w, 0); g.stroke();
      wallPoly(g, room, -VA, VA, VY0, VY1, 30);
      const vb = ptsBox([room.x(-VA), room.y(0, VY1), room.x(VA), room.y(0, VY0), room.x(VA), room.y(VA, VY1), room.x(-VA), room.y(-VA, VY0)]);
      geo.view = { x: vb.x0, y: vb.y0, w: vb.w, h: vb.h };
      g.save(); g.clip();
      const bd = backdropCanvas(max(64, Math.ceil(vb.w)), max(64, Math.ceil(vb.h)), 'bridge', { nebula: true });
      g.drawImage(bd, vb.x0, vb.y0, vb.w, vb.h);
      const pcx = vb.x0 + vb.w * 0.2, pcy = vb.y0 + vb.h * 1.15, pr = vb.h * 0.62;
      planetStatic(g, { look: 'terran', seed: 3, inhabited: true }, pcx, pcy, pr, c.width / w, { lightAngle: -0.6 });
      glow(g, '#fff4d0', vb.x0 + vb.w * 0.82, vb.y0 + vb.h * 0.16, vb.h * 0.7, 0.55);
      g.restore();
      wallPoly(g, room, -VA, VA, VY0, VY1, 30); g.lineWidth = 3; g.strokeStyle = rgba('#000', 0.6); g.stroke();
      for (const sg of [-1, 1]) for (const [a0, a1] of [[0.62, 0.88], [0.92, 1.12]]) { // side console banks (monitors)
        const aa0 = sg * a0, aa1 = sg * a1, lo = min(aa0, aa1), hi = max(aa0, aa1);
        wallPoly(g, room, lo, hi, 0.18, 0.62, 4); g.fillStyle = '#080c26'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = rgba(C.brass, 0.7); g.stroke();
        for (let m = 0; m < 3; m++) {
          const ma0 = lo + (hi - lo) * (0.08 + m * 0.31), ma1 = lo + (hi - lo) * (0.08 + m * 0.31 + 0.27), y0 = 0.3 + (m % 2) * 0.12, y1 = y0 + 0.26;
          const P0 = room.wall(ma0, y1), P1 = room.wall(ma1, y1), P2 = room.wall(ma0, y0), pw = hypot(P1[0] - P0[0], P1[1] - P0[1]), ph = hypot(P2[0] - P0[0], P2[1] - P0[1]);
          wallPoly(g, room, ma0, ma1, y0, y1, 3); g.fillStyle = '#02040e'; g.fill();
          geo.mons.push({ xf: wallXform(room, ma0, ma1, y1, y0, pw, ph), w: pw, h: ph, kind: ['data', 'radar', 'wave', 'bars', 'map', 'graph'][(m + (sg > 0 ? 3 : 0) + (a0 > 0.7 ? 1 : 0)) % 6], col: ['#62d8ff', '#5fdc8f', '#ffb04a', '#a98bff'][(m + (sg > 0 ? 1 : 0)) % 4], sd: m * 7 + (sg > 0 ? 3 : 0) });
        }
      }
      // floor deck
      g.save(); g.beginPath(); g.moveTo(bot[0], h + 20); for (let i = 0; i < bot.length; i += 2) g.lineTo(bot[i], bot[i + 1]); g.lineTo(bot[bot.length - 2], h + 20); g.closePath();
      g.fillStyle = lgr(g, 0, room.y(0, 0), 0, h, [0, '#1a2458', 0.4, '#0a1030', 1, '#03050f']); g.fill(); g.clip();
      g.lineWidth = 1; g.strokeStyle = rgba(C.brass, 0.14);
      for (let X = -4; X <= 4; X += 0.4) { const zE = p.Rz * sqrt(max(0, 1 - pow(X / p.Rx, 2))), a = room.pr(X, 0, -0.6), b = room.pr(X, 0, zE); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      for (let Z = -0.6; Z <= 1; Z += 0.2) { const xe = p.Rx * sqrt(max(0, 1 - pow(Z / p.Rz, 2))), a = room.pr(-xe, 0, Z), b = room.pr(xe, 0, Z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      const ring = circlePts(room, 0, 0, 0.25, 0.7, 60); strokePts(g, ring, true); g.lineWidth = 3; g.strokeStyle = rgba(C.brassLo, 0.8); g.stroke();
      g.globalCompositeOperation = 'lighter'; glow(g, '#9fc4ff', w * 0.5, room.y(0, 0) + h * 0.06, w * 0.3, 0.14); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      glowL(g, '#9ecbff', geo.view.x + geo.view.w / 2, geo.view.y + geo.view.h / 2, geo.view.w * 0.8, 0.22); g.restore();
      return geo;
    },
    dyn(g, w, h, t, G, d) {
      const v = d.view; g.save(); g.beginPath(); g.rect(v.x, v.y, v.w, v.h); g.clip();
      const cyc = (t % 40) / 40;
      if (cyc < 0.35) { const u = cyc / 0.35; drawShip(g, { race: 'human', hull: 'battleship', x: lerp(v.x - 40, v.x + v.w + 40, u), y: v.y + v.h * (0.4 - 0.1 * u), size: v.w * 0.11, angle: 0.05, color: '#8fb4ff', t: t, thrust: 1 }); }
      g.restore();
      for (const m of d.mons) { g.save(); g.transform(m.xf[0], m.xf[1], m.xf[2], m.xf[3], m.xf[4], m.xf[5]); screenDraw(g, m.kind, m.w, m.h, t, m.sd, m.col, 0.95); g.restore(); }
      motes(g, 0, h * 0.1, w, h * 0.7, 26, t, '#cfe4ff', 0.4, 4, 1.6);
    },
  };

  /* ---- KLACKON : hive tunnels, glow-fungus ---- */
  HALLS.klackon = {
    key: '#ffc060', amb: '#7a9a30', rim: '#ffb040',
    bg(g, w, h, c, G) {
      const vx = w * 0.56, vy = h * 0.47, R = mulberry32(5), fung = [];
      g.fillStyle = rgr(g, vx, vy, 0, w * 0.8, [0, '#fff0a8', 0.06, '#ffc040', 0.24, '#b0681c', 0.55, '#52280a', 1, '#160802']); g.fillRect(0, 0, w, h);
      const N = 15;
      for (let k = 0; k < N; k++) {
        const s = 0.04 * pow(1.34, k), rx = s * w * 0.7, ry = s * h * 0.6, cx = vx + (G.cx - vx) * 0 + sin(k * 1.7) * w * 0.004 * s * 6, cy = vy + cos(k * 2.3) * h * 0.004 * s * 6;
        // hex cells in the wall between this ring and the previous one
        const rPrev = k ? 0.04 * pow(1.34, k - 1) : 0, cell = max(7, s * h * 0.13), nC = max(8, floor(TAU * (rx + (k ? rPrev * w * 0.7 : 0)) * 0.5 / (cell * 1.7)));
        for (let j = 0; j < nC; j++) {
          const a = j * TAU / nC + (k % 2) * 0.5 * TAU / nC, rr = k ? (rx + rPrev * w * 0.7) / 2 : rx * 0.5, ex = cx + cos(a) * rr * 1.0, ey = cy + sin(a) * rr * (ry / rx) * 1.0;
          const lum = 0.35 + 0.65 * (0.5 + 0.5 * cos(a - 1.2)) * (1 - k / (N + 2));
          hexPath(g, ex, ey, cell * 0.78, a);
          g.fillStyle = lgr(g, ex, ey - cell, ex, ey + cell, [0, mixc('#6a3410', '#d89030', lum), 1, mixc('#1c0a04', '#7a4416', lum)]); g.fill();
          g.lineWidth = max(1, cell * 0.1); g.strokeStyle = rgba('#1a0a04', 0.85); g.stroke();
          if (R() < 0.07) fung.push({ x: ex, y: ey, r: cell * (0.5 + R()), ph: R() * 6 });
        }
        g.lineWidth = max(2, s * h * 0.065); g.strokeStyle = lgr(g, cx - rx, cy - ry, cx + rx, cy + ry, [0, '#6a3a14', 0.5, '#2a1206', 1, '#4a2410']);
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.stroke();
        g.lineWidth = max(1, s * h * 0.012); g.strokeStyle = rgba('#ffcf80', 0.45 * (1 - k / N)); g.beginPath(); g.ellipse(cx, cy, rx * 0.985, ry * 0.985, 0, PI * 1.05, PI * 1.9); g.stroke();
      }
      // resin pillars framing the scene
      for (const [x, side] of [[w * 0.02, 1], [w * 0.99, -1]]) {
        g.beginPath(); g.moveTo(x, 0);
        for (let i = 0; i <= 12; i++) { const y = h * i / 12; g.lineTo(x + side * (w * 0.1 + sin(i * 1.3 + side) * w * 0.025 + sin(y * 0.01) * w * 0.01), y); }
        g.lineTo(x, h); g.closePath();
        g.fillStyle = lgr(g, x, 0, x + side * w * 0.13, 0, [0, '#0a0402', 0.55, '#3a1c0a', 1, '#8a4c16']); g.fill();
        g.strokeStyle = rgba('#ffc060', 0.55); g.lineWidth = 2; g.stroke();
      }
      // larvae pods
      for (let i = 0; i < 5; i++) { const px = w * (0.1 + R() * 0.2) * (i % 2 ? 1 : 0) + (i % 2 ? 0 : w * (0.8 + R() * 0.1)), py = h * (0.2 + R() * 0.5), pr = h * (0.03 + R() * 0.03); g.fillStyle = rgr(g, px - pr * 0.3, py - pr * 0.3, pr * 0.1, pr, [0, '#fff0a8', 0.5, '#d89030', 1, '#3a1c08']); g.beginPath(); g.ellipse(px, py, pr, pr * 1.2, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#1a0a04', 0.9); g.lineWidth = 2; g.stroke(); }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const f of fung) { glowL(g, '#7aff9a', f.x, f.y, f.r * 2.4, 0.4); }
      g.restore();
      return { fung: fung, vx: vx, vy: vy };
    },
    dyn(g, w, h, t, G, d) {
      glow(g, '#fff0b0', d.vx, d.vy, h * 0.4, 0.5 + 0.1 * sin(t * 1.3));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const f of d.fung) { const p = 0.5 + 0.5 * sin(t * 1.6 + f.ph); glowL(g, '#7affb0', f.x, f.y, f.r * (2 + p * 1.6), 0.35 + 0.4 * p); g.globalAlpha = 0.8 * p; g.fillStyle = '#d8ffe4'; g.fillRect(f.x - 1, f.y - 1, 2, 2); }
      g.restore();
      motes(g, 0, 0, w, h, 34, t, '#ffe0a0', 0.45, 17, 1.8);
      for (let i = 0; i < 8; i++) { const u = fract(t * 0.2 + i * 0.13), x = w * (0.05 + h2(i, 61) * 0.9), y = h * 0.05 + u * h * 0.45; g.fillStyle = rgba('#ffd070', (1 - u) * 0.5); g.fillRect(x, y, 2, 5 + u * 8); }
    },
  };

  /* ---- MEKLAR : machine hall ---- */
  function gearSprite(r, teeth, c0, c1, S) {
    const sz = Math.ceil(r * 2 + 8);
    return layer('gear|' + Math.round(r) + '|' + teeth + '|' + c0 + c1, sz, sz, S, (g) => {
      const cx = sz / 2, cy = sz / 2;
      gearPath(g, cx, cy, r, teeth, 0, 0.1); g.fillStyle = lgr(g, cx - r, cy - r, cx + r, cy + r, [0, lite(c0, 0.2), 0.45, c0, 1, c1]); g.fill(); g.lineWidth = 1.5; g.strokeStyle = rgba('#000', 0.6); g.stroke();
      g.beginPath(); g.arc(cx, cy, r * 0.82, 0, TAU); g.lineWidth = r * 0.04; g.strokeStyle = rgba('#fff', 0.2); g.stroke();
      g.fillStyle = rgba('#000', 0.55); for (let i = 0; i < 6; i++) { const a = i * PI / 3; g.beginPath(); g.arc(cx + cos(a) * r * 0.5, cy + sin(a) * r * 0.5, r * 0.15, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(cx, cy, r * 0.22, 0, TAU); g.fillStyle = lgr(g, cx - r * 0.2, cy - r * 0.2, cx + r * 0.2, cy + r * 0.2, [0, '#e8eef8', 1, '#3a4660']); g.fill(); g.stroke();
      g.fillStyle = rgba('#fff', 0.3); g.beginPath(); g.ellipse(cx - r * 0.25, cy - r * 0.45, r * 0.3, r * 0.08, -0.6, 0, TAU); g.fill();
    }).c;
  }
  HALLS.meklar = {
    key: '#ffb870', amb: '#4a90a8', rim: '#ff9a40',
    bg(g, w, h, c, G) {
      const fy = h * 0.78, R = mulberry32(8);
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#06080e', 0.5, '#101826', 1, '#05070c']); g.fillRect(0, 0, w, h);
      // wall plates
      for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) {
        const x = i * w / 11 - w * 0.02, y = j * fy / 6, pw = w / 11 + 2, ph = fy / 6 + 2, tone = R();
        g.fillStyle = mixc('#0c121e', '#222e44', tone * 0.7); g.fillRect(x, y, pw - 3, ph - 3);
        g.fillStyle = rgba('#fff', 0.05); g.fillRect(x, y, pw - 3, 2); g.fillStyle = rgba('#000', 0.4); g.fillRect(x, y + ph - 6, pw - 3, 3);
        rivets(g, [x + 7, y + 7, x + pw - 10, y + 7, x + 7, y + ph - 10, x + pw - 10, y + ph - 10], 1.6, '#4a5a78');
      }
      // pipes
      const pipe = (x0, y0, x1, y1, th, col) => {
        const horiz = abs(x1 - x0) > abs(y1 - y0);
        g.fillStyle = horiz ? lgr(g, 0, y0 - th / 2, 0, y0 + th / 2, [0, lite(col, 0.35), 0.4, col, 1, dark(col, 0.65)]) : lgr(g, x0 - th / 2, 0, x0 + th / 2, 0, [0, lite(col, 0.35), 0.4, col, 1, dark(col, 0.65)]);
        if (horiz) g.fillRect(x0, y0 - th / 2, x1 - x0, th); else g.fillRect(x0 - th / 2, y0, th, y1 - y0);
        g.fillStyle = rgba('#000', 0.45); const n = floor((horiz ? x1 - x0 : y1 - y0) / (th * 3));
        for (let i = 1; i < n; i++) { if (horiz) g.fillRect(x0 + i * th * 3, y0 - th / 2, th * 0.3, th); else g.fillRect(x0 - th / 2, y0 + i * th * 3, th, th * 0.3); }
      };
      pipe(0, h * 0.045, w, h * 0.045, h * 0.04, '#46586e'); pipe(0, h * 0.1, w, h * 0.1, h * 0.028, '#8a5a30'); pipe(w * 0.2, h * 0.1, w * 0.2, fy, h * 0.03, '#46586e'); pipe(w * 0.94, h * 0.1, w * 0.94, fy, h * 0.036, '#46586e');
      // core ring behind the leader
      const cx = G.cx, cy = h * 0.38, cr = h * 0.3;
      g.fillStyle = rgr(g, cx, cy, 0, cr * 1.3, [0, '#0a1c2a', 0.7, '#050a12', 1, '#02040a']); g.beginPath(); g.arc(cx, cy, cr * 1.18, 0, TAU); g.fill();
      for (const [rr, lw, col] of [[1.18, 8, '#2c3a52'], [1.05, 3, '#6a82a8'], [0.86, 2, '#ff8a30']]) { g.lineWidth = lw; g.strokeStyle = col; g.beginPath(); g.arc(cx, cy, cr * rr, 0, TAU); g.stroke(); }
      // floor grating
      floorPersp(g, w, h, fy, G.cx, '#101826', '#04060c', rgba('#6a82a8', 0.2), 12, 9, 0.2);
      g.fillStyle = rgba('#ff8a30', 0.55); for (let i = 0; i < 6; i++) g.fillRect(w * (0.08 + i * 0.17), fy + h * 0.02 + i * 2, w * 0.1, 3);
      g.fillStyle = brassGrad(g, 0, 0, w, 0); g.globalAlpha = 0.6; g.fillRect(0, fy - 1, w, 3); g.globalAlpha = 1;
      return { cx: cx, cy: cy, cr: cr, fy: fy };
    },
    dyn(g, w, h, t, G, d) {
      const S = scaleOf(g), cx = d.cx, cy = d.cy, cr = d.cr;
      // core segments
      g.save(); g.translate(cx, cy);
      glow(g, '#ff8a30', 0, 0, cr * 1.3, 0.22 + 0.06 * sin(t * 2));
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24 + t * 0.25, on = (i + floor(t * 3)) % 4 === 0; g.strokeStyle = on ? '#ffb060' : rgba('#ff8a30', 0.35); g.lineWidth = on ? 4 : 2.5; g.beginPath(); g.arc(0, 0, cr * 0.95, a, a + 0.12); g.stroke(); }
      g.strokeStyle = rgba('#62d8ff', 0.7); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, cr * 0.7, -t * 0.6, -t * 0.6 + 2.4); g.stroke(); g.beginPath(); g.arc(0, 0, cr * 0.7, -t * 0.6 + PI, -t * 0.6 + PI + 2.4); g.stroke();
      g.restore();
      // meshing gears
      const gears = [[w * 0.1, h * 0.36, h * 0.17, 20, 0.0, '#4a5870', '#1a2232'], [w * 0.24, h * 0.2, h * 0.095, 12, 1, '#7a5a30', '#2a1c0c'], [w * 0.26, h * 0.5, h * 0.12, 15, 2, '#46586e', '#141c2a'], [w * 0.88, h * 0.26, h * 0.12, 16, 3, '#46586e', '#141c2a'], [w * 0.97, h * 0.5, h * 0.14, 18, 4, '#7a5a30', '#2a1c0c']];
      for (const [x, y, r, n, k, c0, c1] of gears) {
        const spr = gearSprite(r, n, c0, c1, S), dir = k % 2 ? -1 : 1, ang = dir * t * (0.5 * (h * 0.14) / r) + (k % 2 ? PI / n : 0);
        g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(spr, -spr.width / S / 2, -spr.height / S / 2, spr.width / S, spr.height / S); g.restore();
      }
      // pistons
      for (let i = 0; i < 3; i++) {
        const x = w * (0.34 + i * 0.045), ph = sin(t * 1.6 + i * 1.1) * 0.5 + 0.5, y0 = h * 0.12, hh = h * 0.1 + ph * h * 0.12;
        g.fillStyle = lgr(g, x - 6, 0, x + 6, 0, [0, '#dfe8f4', 0.5, '#8a9ab4', 1, '#2a3548']); g.fillRect(x - 5, y0, 10, hh);
        g.fillStyle = '#10161f'; g.fillRect(x - 11, y0 - 6, 22, 24); g.strokeStyle = rgba('#ff8a30', 0.6); g.strokeRect(x - 11.5, y0 - 6.5, 23, 25);
      }
      // steam
      for (let i = 0; i < 2; i++) for (let k = 0; k < 5; k++) {
        const u = fract(t * 0.3 + k / 5 + i * 0.4), x = [w * 0.2, w * 0.94][i] + sin(t + k) * 10 * u, y = h * 0.1 + u * h * 0.1 - u * h * 0.0;
        g.fillStyle = rgba('#cfe8ff', (1 - u) * 0.22); g.beginPath(); g.arc(x, y + u * 40, 8 + u * 28, 0, TAU); g.fill();
      }
      // scan line over the leader
      const sy = G.L.y + (fract(t * 0.18)) * G.L.h; g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = lgr(g, 0, sy - 30, 0, sy + 2, [0, 'rgba(255,100,40,0)', 1, 'rgba(255,100,40,0.18)']); g.fillRect(G.L.x - G.L.w * 0.1, sy - 30, G.L.w * 1.2, 32);
      g.fillStyle = 'rgba(255,170,100,0.8)'; g.fillRect(G.L.x - G.L.w * 0.1, sy, G.L.w * 1.2, 1.5); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const on = h2(floor(t * 2), i + 30) > 0.4; g.fillStyle = on ? '#ff8a30' : '#3a2010'; g.fillRect(w * (0.08 + i * 0.17), d.fy + h * 0.02 + i * 2, w * 0.1, 3); }
      g.restore();
      motes(g, 0, 0, w, h * 0.8, 20, t, '#ffd0a0', 0.3, 21, 1.5);
    },
  };

  /* ---- MRRSHAN : jungle temple ---- */
  HALLS.mrrshan = {
    key: '#ffe9a0', amb: '#3a8a60', rim: '#ffd070',
    bg(g, w, h, c, G) {
      const R = mulberry32(13), fy = h * 0.8;
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#0a2a22', 0.4, '#1f6a50', 0.7, '#7ab070', 1, '#2a4a30']); g.fillRect(0, 0, w, h);
      // distant jungle
      for (const [b, a, col, sd] of [[0.62, 0.14, '#4a8a78', 3], [0.7, 0.12, '#2f7060', 7], [0.76, 0.1, '#1d5a48', 11]]) {
        ridge(g, w, h * b, h * a, sd, h, col, 0.14);
        for (let i = 0; i < 40; i++) { const x = R() * w, y = h * b - h * a * 0.45 + R() * h * 0.05, r = h * (0.015 + R() * 0.02); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      }
      // temple doorway
      const cx = G.cx, ax = cx - w * 0.2, aw = w * 0.4, atop = h * 0.14;
      g.fillStyle = '#16120e'; archPath(g, ax - w * 0.03, atop - h * 0.04, aw + w * 0.06, fy - atop + h * 0.04, (aw + w * 0.06) / 2); g.fill();
      archPath(g, ax, atop, aw, fy - atop, aw / 2); g.fillStyle = lgr(g, 0, atop, 0, fy, [0, '#fff0b8', 0.5, '#e8d890', 1, '#5a8a58']); g.fill();
      g.save(); archPath(g, ax, atop, aw, fy - atop, aw / 2); g.clip();
      glow(g, '#fff6c8', cx, h * 0.4, w * 0.3, 0.7);
      ridge(g, w, h * 0.7, h * 0.12, 33, h, '#4a9a70');
      for (let i = 0; i < 9; i++) { g.fillStyle = mixc('#3a3a30', '#8a8a70', i / 9); g.fillRect(ax - 4, fy - (i + 1) * h * 0.022, aw + 8, h * 0.022 - 1); }
      g.restore();
      for (const [x0, ww] of [[ax - w * 0.075, w * 0.07], [ax + aw + w * 0.005, w * 0.07]]) { // carved pillars
        g.fillStyle = lgr(g, x0, 0, x0 + ww, 0, [0, '#2a2a22', 0.4, '#6a6a58', 1, '#1a1a14']); g.fillRect(x0, atop - h * 0.04, ww, fy - atop + h * 0.04);
        g.fillStyle = rgba('#ffe090', 0.35); for (let i = 0; i < 9; i++) g.fillRect(x0 + ww * 0.3, atop + i * h * 0.07, ww * 0.4, h * 0.02);
        g.fillStyle = rgba('#3a8a50', 0.5); g.fillRect(x0, atop - h * 0.04, ww, h * 0.03);
      }
      g.lineWidth = 6; g.strokeStyle = '#3a382c'; archPath(g, ax, atop, aw, fy - atop, aw / 2); g.stroke();
      // cat-face keystone
      g.save(); g.translate(cx, atop - h * 0.02); g.fillStyle = '#4a4838'; g.beginPath(); g.moveTo(-w * 0.03, h * 0.04); g.lineTo(-w * 0.032, -h * 0.01); g.lineTo(-w * 0.018, h * 0.012); g.lineTo(w * 0.018, h * 0.012); g.lineTo(w * 0.032, -h * 0.01); g.lineTo(w * 0.03, h * 0.04); g.closePath(); g.fill();
      g.fillStyle = '#ffd070'; g.beginPath(); g.ellipse(-w * 0.011, h * 0.02, 4, 2, 0, 0, TAU); g.ellipse(w * 0.011, h * 0.02, 4, 2, 0, 0, TAU); g.fill(); g.restore();
      // floor
      floorPersp(g, w, h, fy, cx, '#3a4a38', '#0e1a12', rgba('#000', 0.35), 9, 7, 0.2);
      g.fillStyle = rgba('#5aa860', 0.25); for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(R() * w, fy + R() * (h - fy), 14 + R() * 30, 3 + R() * 6, 0, 0, TAU); g.fill(); }
      // framing foliage
      const leaves = [];
      for (let i = 0; i < 14; i++) leaves.push([w * (0.02 + R() * 0.12), h * (0.02 + R() * 0.5) - h * 0.05, h * (0.28 + R() * 0.2), 0.2 + R() * 1.0 + 0.5, h * (0.04 + R() * 0.04)]);
      for (let i = 0; i < 12; i++) leaves.push([w * (0.88 + R() * 0.12), h * (0.02 + R() * 0.5) - h * 0.05, h * (0.28 + R() * 0.2), PI - 0.2 - R() * 1.0 - 0.5, h * (0.04 + R() * 0.04)]);
      for (let i = 0; i < 10; i++) leaves.push([w * (0.6 + R() * 0.4), -h * 0.02, h * (0.2 + R() * 0.15), 1.2 + R() * 0.6, h * 0.04]);
      for (const L of leaves) leafShape(g, L[0], L[1], L[2], L[3], L[4], '#0e3a24', '#052014');
      for (const L of leaves.slice(0, 8)) leafShape(g, L[0] + 6, L[1] + 2, L[2] * 0.9, L[3] + 0.05, L[4] * 0.7, '#2f8a50', '#0d3a22');
      for (let i = 0; i < 9; i++) { const x = (i < 5 ? w * (0.01 + i * 0.03) : w * (0.9 + (i - 5) * 0.025)), y = h * 1.0; for (let k = 0; k < 4; k++) leafShape(g, x, y, h * (0.16 + R() * 0.12), -PI / 2 + (R() - 0.5) * 1.5, h * 0.03, '#1b6a3a', '#06240f'); }
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const x = w * (0.18 + i * 0.1); g.fillStyle = lgr(g, x, 0, x + w * 0.16, h * 0.8, [0, 'rgba(255,240,170,0.2)', 1, 'rgba(255,240,170,0)']); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.05, 0); g.lineTo(x + w * 0.24, h * 0.8); g.lineTo(x + w * 0.14, h * 0.8); g.closePath(); g.fill(); }
      g.restore();
      return { fy: fy };
    },
    dyn(g, w, h, t, G, d) {
      for (let i = 0; i < 5; i++) { const x = w * (0.62 + i * 0.075) + sin(i) * 20; vineDraw(g, x, -4, h * (0.16 + 0.07 * h2(i, 3)), 12, t, i * 3.1, '#0e3a24', '#1f7a44'); }
      for (let i = 0; i < 4; i++) vineDraw(g, w * (0.03 + i * 0.045), -4, h * (0.2 + 0.1 * h2(i, 8)), 9, t, i * 2.3 + 1, '#0e3a24', '#1f7a44');
      const mist = fogTile(15, 256, '#cfffe0', 0.42, 0.8, 0.5, 5, 3);
      scrollTile(g, mist, 0, d.fy - h * 0.06, w, h * 0.22, 3.2, t * 9, 0.4);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) { const x = w * (0.05 + h2(i, 77) * 0.9) + sin(t * 0.5 + i) * 20, y = h * (0.3 + h2(i, 78) * 0.5) + cos(t * 0.4 + i * 2) * 14, a = 0.5 + 0.5 * sin(t * 2 + i * 3); glowL(g, '#d8ff80', x, y, 10, 0.5 * a); g.globalAlpha = a; g.fillStyle = '#f4ffc8'; g.fillRect(x - 1, y - 1, 2, 2); }
      g.restore();
    },
  };

  /* ---- PSILON : crystal observatory ---- */
  HALLS.psilon = {
    key: '#d8f0ff', amb: '#6a8aff', rim: '#9fe0ff',
    bg(g, w, h, c, G) {
      const cx = G.cx, cy = h * 0.4, R0 = h * 0.5, fy = h * 0.8;
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#06082a', 0.6, '#10163e', 1, '#05071c']); g.fillRect(0, 0, w, h);
      // dome window
      g.save(); g.beginPath(); g.arc(cx, cy, R0, 0, TAU); g.clip();
      const bd = backdropCanvas(Math.ceil(R0 * 2), Math.ceil(R0 * 2), 'psilon', { nebula: true }); g.drawImage(bd, cx - R0, cy - R0, R0 * 2, R0 * 2);
      glow(g, '#a98bff', cx - R0 * 0.3, cy - R0 * 0.2, R0 * 0.9, 0.35);
      g.strokeStyle = rgba('#fff', 0.45); g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - R0, cy + R0 * 0.2); g.bezierCurveTo(cx - R0 * 0.3, cy - R0 * 0.2, cx + R0 * 0.3, cy + R0 * 0.1, cx + R0, cy - R0 * 0.35); g.stroke();
      g.restore();
      g.lineWidth = 10; g.strokeStyle = lgr(g, cx - R0, 0, cx + R0, 0, [0, '#8a9ac8', 0.5, '#f0f4ff', 1, '#8a9ac8']); g.beginPath(); g.arc(cx, cy, R0, 0, TAU); g.stroke();
      g.lineWidth = 2; g.strokeStyle = rgba('#cfe8ff', 0.5);
      for (let i = 0; i < 14; i++) { const a = i * TAU / 14; g.beginPath(); g.moveTo(cx + cos(a) * R0 * 0.18, cy + sin(a) * R0 * 0.18); g.lineTo(cx + cos(a) * R0, cy + sin(a) * R0); g.stroke(); }
      for (const k of [0.38, 0.68]) { g.beginPath(); g.arc(cx, cy, R0 * k, 0, TAU); g.stroke(); }
      // walls
      g.fillStyle = lgr(g, 0, 0, w, 0, [0, '#10163e', 0.25, 'rgba(16,22,62,0)', 0.8, 'rgba(16,22,62,0)', 1, '#10163e']); g.fillRect(0, 0, w, fy);
      for (const [x, ww] of [[0, w * 0.15], [w * 0.88, w * 0.12]]) { g.fillStyle = lgr(g, x, 0, x + ww, 0, [0, '#1a2258', 1, '#0a0e32']); g.fillRect(x, 0, ww, fy); g.fillStyle = rgba('#9fe0ff', 0.5); g.fillRect(x + ww - 2, 0, 2, fy); }
      // floor with constellation inlay
      floorPersp(g, w, h, fy, cx, '#141c52', '#050820', rgba('#9fe0ff', 0.12), 10, 7, 0.2);
      const Rr = mulberry32(3); g.fillStyle = rgba('#d8f0ff', 0.7); const pts = [];
      for (let i = 0; i < 16; i++) { const x = w * (0.05 + Rr() * 0.9), y = fy + (h - fy) * (0.1 + Rr() * 0.85); pts.push([x, y]); g.fillRect(x - 1.5, y - 1.5, 3, 3); }
      g.strokeStyle = rgba('#9fe0ff', 0.3); g.lineWidth = 1; g.beginPath(); for (let i = 1; i < pts.length; i++) { if (h2(i, 4) > 0.4) { g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); } } g.stroke();
      g.fillStyle = rgba('#d8f0ff', 0.7); g.fillRect(0, fy - 1, w, 2);
      // crystal columns
      const cr = [[w * 0.07, fy, h * 0.55, w * 0.06, '#7ad8ff', 0.04], [w * 0.14, fy, h * 0.38, w * 0.045, '#b89aff', -0.03], [w * 0.95, fy, h * 0.5, w * 0.055, '#7ad8ff', -0.04], [w * 0.89, fy + 6, h * 0.3, w * 0.04, '#d8f0ff', 0.03]];
      for (const k of cr) crystal(g, k[0], k[1], k[3], k[2], k[4], 4, k[5]);
      return { cx: cx, cy: cy, R0: R0, fy: fy, cr: cr };
    },
    dyn(g, w, h, t, G, d) {
      // armillary sphere
      const ax = w * 0.27, ay = h * 0.52, ar = h * 0.1;
      glow(g, '#9fe0ff', ax, ay, ar * 2.2, 0.28);
      g.save(); g.translate(ax, ay); g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = t * (0.5 + i * 0.2) + i * 1.3; g.strokeStyle = rgba(['#d8f0ff', '#9fe0ff', '#c8a8ff'][i], 0.9); g.beginPath(); g.ellipse(0, 0, ar * (1 - i * 0.12), ar * (1 - i * 0.12) * abs(cos(a)), i * 0.9, 0, TAU); g.stroke(); }
      g.fillStyle = '#fff'; glow(g, '#fff', 0, 0, ar * 0.7, 0.9); g.beginPath(); g.arc(0, 0, ar * 0.09, 0, TAU); g.fill();
      g.strokeStyle = rgba('#d8f0ff', 0.5); g.beginPath(); g.moveTo(0, ar * 1.05); g.lineTo(0, ar * 1.9); g.stroke(); g.restore();
      g.fillStyle = '#10163e'; chamferPath(g, ax - ar * 1.2, ay + ar * 1.8, ar * 2.4, ar * 0.25, 4); g.fill(); g.strokeStyle = rgba('#9fe0ff', 0.7); g.stroke();
      // crystal glows + glints
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < d.cr.length; i++) { const k = d.cr[i], p = 0.5 + 0.5 * sin(t * 1.2 + i * 1.7); glowL(g, k[4], k[0], k[1] - k[2] * 0.5, k[2] * 0.7, 0.2 + 0.18 * p); }
      for (let i = 0; i < 20; i++) { const x = d.cx + cos(i * 2.4) * d.R0 * 0.9 * h2(i, 91), y = d.cy + sin(i * 1.9) * d.R0 * 0.9 * h2(i, 92), tw = max(0, sin(t * (1 + h2(i, 93)) + i * 3)); if (tw > 0.2) { g.globalAlpha = tw; g.fillStyle = '#fff'; g.fillRect(x - 4, y - 0.5, 8, 1); g.fillRect(x - 0.5, y - 4, 1, 8); } }
      g.restore();
      const ss = fract(t * 0.07); if (ss < 0.1) { const u = ss / 0.1, x = d.cx - d.R0 * 0.6 + u * d.R0 * 0.8, y = d.cy - d.R0 * 0.6 + u * d.R0 * 0.35; g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#fff', 1 - u); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 60, y - 26); g.stroke(); g.restore(); }
      motes(g, 0, 0, w, h * 0.8, 24, t, '#d8f0ff', 0.45, 31, 1.6);
    },
  };

  /* ---- SAKKRA : swamp ziggurat ---- */
  HALLS.sakkra = {
    key: '#ffe0a0', amb: '#3a9a8a', rim: '#ffc860',
    bg(g, w, h, c, G) {
      const R = mulberry32(17), cx = G.cx, fy = h * 0.76;
      g.fillStyle = lgr(g, 0, 0, 0, fy, [0, '#0a2a30', 0.5, '#1c5a56', 1, '#8ab898']); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) { g.fillStyle = rgba('#fff', 0.2 + R() * 0.5); g.fillRect(R() * w, R() * h * 0.4, 1.2, 1.2); }
      glow(g, '#e8f8e0', w * 0.18, h * 0.2, h * 0.5, 0.35); g.fillStyle = '#eef6e0'; g.beginPath(); g.arc(w * 0.18, h * 0.2, h * 0.06, 0, TAU); g.fill();
      g.fillStyle = rgba('#a8c8b8', 0.5); g.beginPath(); g.arc(w * 0.18 + 6, h * 0.2 - 4, h * 0.05, 0, TAU); g.fill();
      ridge(g, w, h * 0.66, h * 0.12, 4, h, '#2a6a62', 0.16); ridge(g, w, h * 0.72, h * 0.1, 12, h, '#1b524c', 0.16);
      for (let i = 0; i < 22; i++) { const x = R() * w, y = h * (0.58 + R() * 0.12); g.fillStyle = '#143a38'; g.fillRect(x - 2, y, 4, h * 0.1); g.beginPath(); g.ellipse(x, y, h * 0.04, h * 0.022, 0, 0, TAU); g.fill(); }
      // ziggurat
      const tiers = 6, baseW = w * 0.62, topY = h * 0.1, tierH = (fy - topY) / tiers;
      for (let i = tiers - 1; i >= 0; i--) {
        const yb = topY + (i + 1) * tierH, yt = topY + i * tierH, wb = baseW * (0.28 + 0.72 * (i + 1) / tiers), wt = baseW * (0.28 + 0.72 * (i + 0.15) / tiers);
        g.beginPath(); g.moveTo(cx - wb / 2, yb); g.lineTo(cx - wt / 2, yt); g.lineTo(cx + wt / 2, yt); g.lineTo(cx + wb / 2, yb); g.closePath();
        g.fillStyle = lgr(g, cx - wb / 2, 0, cx + wb / 2, 0, [0, mixc('#102a2a', '#2a5a50', i / tiers), 0.5, mixc('#1a4a44', '#4a8a78', i / tiers), 1, '#0e2624']); g.fill();
        g.lineWidth = 2; g.strokeStyle = rgba('#d6b36a', 0.55); g.stroke();
        g.fillStyle = rgba('#000', 0.35); g.fillRect(cx - wt / 2 - 2, yt, wt + 4, 4);
        const gl = 7 + i * 2;
        for (let k = 0; k < gl; k++) { const gx = cx - wt / 2 * 0.9 + (wt * 0.9) * (k + 0.5) / gl; g.fillStyle = rgba('#ffd070', 0.3 + 0.2 * h2(k, i)); g.fillRect(gx - 3, yt + tierH * 0.35, 6, tierH * 0.28); }
      }
      g.fillStyle = lgr(g, 0, topY, 0, fy, [0, '#0a2020', 1, '#1a4a44']); g.beginPath(); g.moveTo(cx - w * 0.04, fy); g.lineTo(cx - w * 0.012, topY + tierH * 0.15); g.lineTo(cx + w * 0.012, topY + tierH * 0.15); g.lineTo(cx + w * 0.04, fy); g.closePath(); g.fill();
      g.strokeStyle = rgba('#000', 0.4); g.lineWidth = 1; g.beginPath(); for (let i = 0; i < 24; i++) { const y = topY + tierH * 0.15 + (fy - topY) * i / 24, ww = lerp(w * 0.012, w * 0.04, i / 24); g.moveTo(cx - ww, y); g.lineTo(cx + ww, y); } g.stroke();
      // swamp water
      g.fillStyle = lgr(g, 0, fy, 0, h, [0, '#1f5a58', 0.4, '#0c2a2c', 1, '#030c10']); g.fillRect(0, fy, w, h - fy);
      g.save(); g.globalAlpha = 0.3; g.beginPath(); g.rect(0, fy, w, h - fy); g.clip(); g.translate(0, 2 * fy); g.scale(1, -1); g.drawImage(c, 0, 0, w, h); g.restore();
      g.fillStyle = rgba('#8ad8c8', 0.25); g.fillRect(0, fy - 1, w, 2);
      for (let i = 0; i < 26; i++) { const x = R() < 0.5 ? R() * w * 0.2 : w * (0.85 + R() * 0.15), y = h * (0.85 + R() * 0.15); g.strokeStyle = '#04100c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + (R() - 0.5) * 20, y + h * 0.1, x + (R() - 0.5) * 30, y - h * 0.15 * R()); g.stroke(); }
      const torches = [[cx - w * 0.2, h * 0.5], [cx + w * 0.2, h * 0.5], [cx - w * 0.32, fy - 4], [cx + w * 0.32, fy - 4]];
      g.fillStyle = '#0a0806'; for (const [x, y] of torches) g.fillRect(x - 2, y, 4, h * 0.06);
      return { fy: fy, torches: torches };
    },
    dyn(g, w, h, t, G, d) {
      for (let i = 0; i < d.torches.length; i++) { const [x, y] = d.torches[i], fl = 0.8 + 0.2 * sin(t * 9 + i * 2); glow(g, '#ffa040', x, y, h * 0.22, 0.4 * fl); flame(g, x, y, h * 0.04, t, i * 5); }
      const mist = fogTile(19, 256, '#b8f0e0', 0.45, 0.8, 0.5, 5, 3);
      scrollTile(g, mist, 0, d.fy - h * 0.1, w, h * 0.2, 3.4, t * 7, 0.45); scrollTile(g, mist, 0, d.fy - h * 0.02, w, h * 0.14, 4.2, -t * 11, 0.35);
      g.save(); g.beginPath(); g.rect(0, d.fy, w, h - d.fy); g.clip();
      for (let i = 0; i < 12; i++) { const y = d.fy + (h - d.fy) * (0.1 + 0.9 * h2(i, 5)), x = w * h2(i, 6) + sin(t * 0.6 + i) * 20, ww = 30 + 70 * h2(i, 7); g.strokeStyle = rgba('#bff0e0', 0.12 + 0.1 * sin(t + i)); g.lineWidth = 1; g.beginPath(); g.moveTo(x - ww, y); g.lineTo(x + ww, y); g.stroke(); }
      for (const [x, y] of d.torches) { g.save(); g.globalCompositeOperation = 'lighter'; glowL(g, '#ffa040', x, d.fy + (d.fy - y) * 0.35 + (h - d.fy) * 0.1, h * 0.12, 0.25 + 0.1 * sin(t * 5 + x)); g.restore(); }
      g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) { const x = w * (0.04 + h2(i, 71) * 0.92) + sin(t * 0.6 + i) * 18, y = h * (0.35 + h2(i, 72) * 0.45) + cos(t * 0.5 + i * 2) * 12, a = 0.5 + 0.5 * sin(t * 2.4 + i * 3); glowL(g, '#d8ff70', x, y, 9, 0.5 * a); }
      g.restore();
    },
  };

  /* ---- SILICOID : crystal cavern ---- */
  HALLS.silicoid = {
    key: '#bff4ff', amb: '#a060ff', rim: '#7affff',
    bg(g, w, h, c, G) {
      const R = mulberry32(23), cx = G.cx, fy = h * 0.8, gem = [];
      g.fillStyle = lgr(g, 0, 0, 0, h, [0, '#0a0620', 0.5, '#150a3a', 1, '#05030f']); g.fillRect(0, 0, w, h);
      // geode mouth
      g.save(); g.globalCompositeOperation = 'lighter';
      glow(g, '#a8f0ff', cx, h * 0.4, w * 0.34, 0.5); glow(g, '#ffffff', cx, h * 0.4, w * 0.1, 0.55);
      for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + 0.1, L = w * 0.8, wd = 0.03; g.fillStyle = rgba('#b0f4ff', 0.05); g.beginPath(); g.moveTo(cx, h * 0.4); g.lineTo(cx + cos(a - wd) * L, h * 0.4 + sin(a - wd) * L); g.lineTo(cx + cos(a + wd) * L, h * 0.4 + sin(a + wd) * L); g.closePath(); g.fill(); }
      g.restore();
      // cave rim stalactites
      g.fillStyle = '#04020c'; g.beginPath(); g.moveTo(0, 0);
      for (let x = 0; x <= w; x += w / 24) { g.lineTo(x, 0); g.lineTo(x + w / 48, h * (0.07 + 0.2 * R() * (abs(x - cx) > w * 0.2 ? 1 : 0.35))); }
      g.lineTo(w, 0); g.closePath(); g.fill();
      g.strokeStyle = rgba('#a060ff', 0.4); g.lineWidth = 1.5; g.stroke();
      // crystal clusters
      const cols = ['#5ae8ff', '#ff5ad0', '#ffb04a', '#8a7aff', '#5aff9a'];
      const place = (x, by, n, sc, spread) => { for (let i = 0; i < n; i++) { const hh = sc * (0.5 + R() * 0.9), ww = hh * (0.14 + R() * 0.1), cc = cols[(R() * cols.length) | 0], xx = x + (R() - 0.5) * spread, lean = (R() - 0.5) * 0.35 + (xx < cx ? 0.12 : -0.12); crystal(g, xx, by + R() * h * 0.03, ww, hh, cc, (R() * 999) | 0, lean); gem.push({ x: xx, y: by - hh * 0.5, r: hh * 0.7, c: cc }); } };
      place(w * 0.07, fy, 7, h * 0.5, w * 0.15); place(w * 0.2, fy + 4, 4, h * 0.26, w * 0.12); place(w * 0.94, fy, 6, h * 0.46, w * 0.13); place(w * 0.84, fy + 4, 3, h * 0.24, w * 0.1);
      place(w * 0.5, fy - 2, 3, h * 0.14, w * 0.5); place(w * 0.34, fy + 8, 3, h * 0.1, w * 0.1);
      // floor
      g.fillStyle = lgr(g, 0, fy, 0, h, [0, '#1a0e44', 0.3, '#0c0624', 1, '#030108']); g.fillRect(0, fy, w, h - fy);
      g.save(); g.globalAlpha = 0.3; g.beginPath(); g.rect(0, fy, w, h - fy); g.clip(); g.translate(0, 2 * fy); g.scale(1, -1); g.drawImage(c, 0, 0, w, h); g.restore();
      g.strokeStyle = rgba('#a060ff', 0.2); g.lineWidth = 1; g.beginPath();
      for (let i = 0; i < 26; i++) { const x = R() * w, y = fy + R() * (h - fy); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 120, y + (R() - 0.2) * 20); } g.stroke();
      return { gem: gem, fy: fy };
    },
    dyn(g, w, h, t, G, d) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < d.gem.length; i++) { const k = d.gem[i], p = 0.5 + 0.5 * sin(t * (0.9 + h2(i, 4) * 1.2) + i * 1.9); glowL(g, k.c, k.x, k.y, k.r * (1 + 0.2 * p), 0.16 + 0.22 * p); }
      for (let i = 0; i < 26; i++) { const k = d.gem[i % d.gem.length], x = k.x + (h2(i, 5) - 0.5) * k.r, y = k.y + (h2(i, 6) - 0.5) * k.r * 1.4, tw = max(0, sin(t * (1.5 + h2(i, 7) * 2) + i * 5)); if (tw > 0.3) { g.globalAlpha = tw; g.fillStyle = '#fff'; g.fillRect(x - 5, y - 0.5, 10, 1); g.fillRect(x - 0.5, y - 5, 1, 10); } }
      for (let i = 0; i < 5; i++) { const x = w * (0.15 + 0.7 * fract(h2(i, 9) + t * 0.01 * (1 + i * 0.3))), y = d.fy + (h - d.fy) * (0.2 + 0.6 * h2(i, 10)); glowL(g, ['#5ae8ff', '#ff5ad0', '#ffb04a'][i % 3], x, y, h * 0.1, 0.1); }
      g.restore();
      motes(g, 0, 0, w, h * 0.85, 30, t, '#d0f8ff', 0.5, 41, 1.7);
    },
  };

  /* per-hall foreground rails (cover the portrait's lower edge) */
  const RAIL = {
    alkari: (g, w, h) => { railShape(g, w, h, [0, '#fff4d8', 0.3, '#e8d8b0', 1, '#a89870'], '#f3dca0', '#c8a350'); g.fillStyle = rgba('#fff', 0.5); g.fillRect(w * 0.31, h * 0.94, w * 0.67, 1.5); for (let i = 0; i < 9; i++) { const x = w * (0.34 + i * 0.075); g.fillStyle = rgba('#8a7440', 0.35); g.fillRect(x, h * 0.945, 3, h * 0.055); } },
    bulrathi: (g, w, h) => { railShape(g, w, h, [0, '#3a2c30', 0.3, '#241a1e', 1, '#0a0608'], '#8a6a50', '#b08a60'); const R = mulberry32(2); for (let i = 0; i < 14; i++) { g.strokeStyle = rgba('#000', 0.4); g.beginPath(); g.moveTo(w * (0.31 + i * 0.05), h * 0.935); g.lineTo(w * (0.3 + i * 0.056), h); g.stroke(); } g.fillStyle = rgba('#000', 0.2); for (let i = 0; i < 20; i++) g.fillRect(R() * w, h * (0.94 + R() * 0.05), 30 + R() * 50, 3); },
    darlok: (g, w, h) => { railShape(g, w, h, [0, '#1a0e34', 0.3, '#0a0618', 1, '#030108'], '#6a3aa8', '#c890ff'); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#a060ff', 0.25); g.fillRect(w * 0.31, h * 0.936, w * 0.67, 2); g.restore(); },
    human: (g, w, h) => { railShape(g, w, h, [0, '#26346e', 0.25, '#101a46', 1, '#04061a'], '#d6b36a', '#f3dca0'); g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 22; i++) { g.fillStyle = rgba(i % 5 === 2 ? '#ff9440' : '#62d8ff', 0.5); g.fillRect(w * (0.34 + i * 0.028), h * 0.962, w * 0.016, h * 0.008); } g.restore(); },
    klackon: (g, w, h) => { railShape(g, w, h, [0, '#8a4c16', 0.3, '#4a2408', 1, '#1a0a04'], '#ffc060', '#ffe090'); for (let i = 0; i < 16; i++) { hexPath(g, w * (0.34 + i * 0.04), h * 0.975, h * 0.018, 0.5); g.strokeStyle = rgba('#1a0a04', 0.7); g.lineWidth = 1.5; g.stroke(); } },
    meklar: (g, w, h) => { railShape(g, w, h, [0, '#46586e', 0.25, '#1e2a3c', 1, '#06080e'], '#8a9ab4', '#ff9a40'); for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#ff9a40' : '#10161f'; g.beginPath(); const x = w * (0.33 + i * 0.04); g.moveTo(x, h * 0.938); g.lineTo(x + w * 0.02, h * 0.938); g.lineTo(x + w * 0.012, h * 0.95); g.lineTo(x - w * 0.008, h * 0.95); g.closePath(); g.fill(); } rivets(g, [w * 0.4, h * 0.975, w * 0.6, h * 0.975, w * 0.8, h * 0.975, w * 0.95, h * 0.975], 3, '#6a82a8'); },
    mrrshan: (g, w, h) => { railShape(g, w, h, [0, '#5a6a4a', 0.3, '#2a3a2a', 1, '#0a140c'], '#c8b070', '#ffe090'); const R = mulberry32(5); for (let i = 0; i < 12; i++) leafShape(g, w * (0.32 + R() * 0.66), h * (0.945 + R() * 0.05), h * (0.06 + R() * 0.06), -PI / 2 + (R() - 0.5) * 1.8, h * 0.014, '#1b6a3a', '#06240f'); },
    psilon: (g, w, h) => { railShape(g, w, h, [0, '#d8e8ff', 0.2, '#6a7ac0', 1, '#10163e'], '#ffffff', '#9fe0ff'); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#9fe0ff', 0.4); g.fillRect(w * 0.31, h * 0.94, w * 0.67, 2); g.restore(); },
    sakkra: (g, w, h) => { railShape(g, w, h, [0, '#2a4a40', 0.3, '#14302a', 1, '#04100c'], '#d6b36a', '#ffd070'); g.fillStyle = rgba('#ffd070', 0.4); for (let i = 0; i < 18; i++) g.fillRect(w * (0.33 + i * 0.035), h * 0.965, w * 0.015, h * 0.012); },
    silicoid: (g, w, h) => { railShape(g, w, h, [0, '#5a3aa8', 0.25, '#241450', 1, '#06030f'], '#a8f0ff', '#ffffff'); const R = mulberry32(6); for (let i = 0; i < 9; i++) crystal(g, w * (0.34 + R() * 0.62), h * 1.01, w * (0.012 + R() * 0.012), h * (0.04 + R() * 0.04), ['#5ae8ff', '#ff5ad0', '#8a7aff'][i % 3], i + 1, (R() - 0.5) * 0.3); },
  };
  function railShape(g, w, h, stops, edgeA, edgeB) {
    const y0 = h * 0.925;
    g.fillStyle = lgr(g, 0, y0, 0, h, stops);
    g.beginPath(); g.moveTo(w * 0.27, h + 2); g.lineTo(w * 0.305, y0 + h * 0.012); g.lineTo(w * 0.985, y0 + h * 0.012); g.lineTo(w + 2, h + 2); g.closePath(); g.fill();
    g.lineWidth = 2.4; g.strokeStyle = lgr(g, w * 0.3, 0, w, 0, [0, edgeA, 0.5, edgeB, 1, edgeA]); g.beginPath(); g.moveTo(w * 0.305, y0 + h * 0.012); g.lineTo(w * 0.985, y0 + h * 0.012); g.stroke();
  }

  Scenes.audience = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const race = HALLS[o.race] ? o.race : 'human', hall = HALLS[race], S = begin(ctx, w, h), G0 = audGeo(w, h);
      const photo = artBG(ctx, G.WorldArt && G.WorldArt.race(race, 'audience'), w, h, { fx: 0.62, fy: 0.5, drift: 0.035, t: t, exposure: G.WorldArt && G.WorldArt.raceExposure ? G.WorldArt.raceExposure(race, 'audience') : 1 });   // the hall breathes behind the leader; the dark halls lifted toward the set
      const e = photo ? { d: {} } : layer('aud.' + race, w, h, S, (g, ww, hh, c) => { const d = hall.bg(g, ww, hh, c, G0); bakeGrain(g, ww, hh, 0.05); return d; });
      if (!photo) ctx.drawImage(e.c, 0, 0, w, h);
      /* conference-deck lighting: the sunlit hall is multiplied down into a deep-navy dome, leaving a warm pool of light on the leader */
      if (!photo && CONFIG.audienceDim !== false) {
        const Lq = G0.L; ctx.save(); ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = rgr(ctx, Lq.x + Lq.w * 0.5, Lq.y + Lq.h * 0.42, Lq.w * 0.18, hypot(w, h) * 0.6, [0, 'rgb(255,244,226)', 0.38, 'rgb(150,160,205)', 1, 'rgb(36,46,98)']); ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      if (!photo && hall.dyn) hall.dyn(ctx, w, h, t, G0, e.d, o);
      const mk = MOOD_ALIAS[String(o.mood || 'neutral').toLowerCase()] || 'neutral', fx = MOOD_FX[mk], L = G0.L;
      // backlight / rim for the leader
      glow(ctx, hall.rim, L.x + L.w * 0.5, L.y + L.h * 0.38, L.w * 0.9, 0.18);
      featheredPortrait(ctx, race, L.x, L.y, L.w, L.h, { t: t, mood: mk, talking: !!o.talking, color: o.color, bg: false, key: 'aud' }, 0.06, 0, 0);
      if (!photo && hall.fgDyn) hall.fgDyn(ctx, w, h, t, G0, e.d, o);
      // foreground rail
      if (!photo) { const fr = layer('aud.fg.' + race, w, h, S, (g, ww, hh) => (RAIL[race] ? RAIL[race](g, ww, hh) : buildAudFG(g, ww, hh))); ctx.drawImage(fr.c, 0, 0, w, h); }
      let tab = null;
      if (o.table) tab = audTable(ctx, w, h, t, hall);
      // mood grade: colour the whole room, light the leader from the mood's side
      if (mk !== 'neutral') moodGrade(ctx, w, h, t, mk, L);
      finish(ctx, w, h, 0.5, 0.04, t);
      end(ctx);
      return { leader: { x: L.x, y: L.y, w: L.w, h: L.h }, left: { x: w * 0.03, y: h * 0.1, w: w * 0.36, h: h * 0.62 }, bottom: { x: w * 0.03, y: h * 0.78, w: w * 0.94, h: h * 0.2 }, table: tab };
    },
  };
  function moodGrade(g, w, h, t, mk, L) {
    const pulse = mk === 'angry' ? 0.8 + 0.2 * sin(t * 6.3) * sin(t * 1.7 + 1) : mk === 'scheming' ? 0.85 + 0.15 * sin(t * 1.3) : 1;
    g.save();
    if (mk === 'angry') {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,92,80,0.5)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,40,30,' + (0.09 * pulse) + ')'; g.fillRect(0, 0, w, h);
      g.fillStyle = rgr(g, L.x + L.w * 0.05, L.y + L.h * 0.4, 0, L.w * 0.9, [0, rgba('#ff3a2a', 0.26 * pulse), 1, rgba('#ff3a2a', 0)]); g.fillRect(L.x - L.w, L.y - L.h * 0.3, L.w * 2.2, L.h * 1.6);
    } else if (mk === 'worried') {
      g.globalCompositeOperation = 'saturation'; g.fillStyle = 'rgba(128,128,128,0.45)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(110,140,235,0.5)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = lgr(g, 0, 0, 0, h, [0, 'rgba(90,130,255,0.14)', 1, 'rgba(90,130,255,0)']); g.fillRect(0, 0, w, h);
    } else if (mk === 'pleased') {
      g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,190,100,0.1)'; g.fillRect(0, 0, w, h);
      g.fillStyle = rgr(g, L.x + L.w / 2, L.y + L.h * 0.35, 0, L.w * 1.1, [0, 'rgba(255,214,140,0.22)', 1, 'rgba(255,214,140,0)']); g.fillRect(L.x - L.w * 0.6, L.y - L.h * 0.2, L.w * 2.2, L.h * 1.4);
    } else if (mk === 'scheming') {
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(165,100,235,0.5)'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = lgr(g, 0, h * 0.4, 0, h, [0, 'rgba(180,90,255,0)', 1, 'rgba(180,90,255,' + (0.2 * pulse) + ')']); g.fillRect(0, h * 0.4, w, h * 0.6);
    }
    g.restore();
    if (mk === 'angry' || mk === 'worried' || mk === 'scheming') {
      g.fillStyle = rgr(g, w * 0.62, h * 0.45, min(w, h) * 0.3, hypot(w, h) * 0.62, [0, 'rgba(0,0,0,0)', 1, mk === 'angry' ? 'rgba(30,0,4,0.55)' : mk === 'worried' ? 'rgba(0,4,28,0.5)' : 'rgba(14,0,28,0.5)']); g.fillRect(0, 0, w, h);
    }
  }
  function buildAudFG(g, w, h) {
    const y0 = h * 0.925;
    g.fillStyle = lgr(g, 0, y0, 0, h, [0, '#0e1646', 0.2, '#070b2a', 1, '#02030f']);
    g.beginPath(); g.moveTo(w * 0.28, h); g.lineTo(w * 0.31, y0 + h * 0.01); g.lineTo(w * 0.98, y0 + h * 0.01); g.lineTo(w, h); g.closePath(); g.fill();
    g.lineWidth = 2.2; g.strokeStyle = brassGrad(g, w * 0.3, 0, w, 0); g.beginPath(); g.moveTo(w * 0.31, y0 + h * 0.01); g.lineTo(w * 0.98, y0 + h * 0.01); g.stroke();
    g.fillStyle = rgba('#fff', 0.1); g.fillRect(w * 0.32, y0 + h * 0.014, w * 0.65, 1.5);
    return null;
  }
  function audTable(g, w, h, t, hall) {
    const cx = w * 0.25, cy = h * 0.875, rx = w * 0.15, ry = h * 0.056, col = '#62d8ff';
    g.save();
    // table body
    g.fillStyle = lgr(g, cx - rx, 0, cx + rx, 0, [0, '#080c2a', 0.35, '#34428e', 0.7, '#1a2464', 1, '#060920']);
    g.beginPath(); g.ellipse(cx, cy + h * 0.035, rx, ry, 0, 0, PI); g.lineTo(cx - rx, cy); g.ellipse(cx, cy, rx, ry, 0, PI, 0, true); g.closePath(); g.fill();
    g.fillStyle = lgr(g, 0, cy - ry, 0, cy + ry, [0, '#0a1038', 1, '#202d78']); g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    g.lineWidth = 2; g.strokeStyle = brassGrad(g, cx - rx, 0, cx + rx, 0); g.stroke();
    g.beginPath(); g.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 0, TAU); g.strokeStyle = rgba(C.brassHi, 0.5); g.lineWidth = 1; g.stroke();
    g.restore();
    const fl = 0.92 + 0.08 * sin(t * 33);
    holoBase(g, cx, cy, rx * 0.7, ry * 0.7, col, t, fl, h * 0.2);
    // trade routes: two worlds, arcs, crates
    const hs = h * 0.115, hcy = cy - h * 0.15;
    let n = 0; const D = _hdyn;
    for (let i = 0; i < 4; i++) {
      const u = fract(t * 0.3 + i / 4), x = -0.9 + 1.8 * u, y = 0.15 + 0.55 * sin(PI * u);
      for (const sy of [1, -1]) { const x2 = x + 0.04, u2 = clamp(u + 0.04, 0, 1); D[n++] = x; D[n++] = sy > 0 ? y : -y * 0.7 - 0.3; D[n++] = 0; D[n++] = -0.9 + 1.8 * u2; D[n++] = sy > 0 ? 0.15 + 0.55 * sin(PI * u2) : -(0.15 + 0.55 * sin(PI * u2)) * 0.7 - 0.3; D[n++] = 0; void x2; }
    }
    const seg = holoModel('trade');
    holoDraw(g, seg, cx, hcy, hs, col, { yaw: sin(t * 0.4) * 0.5, pitch: -0.34, a: fl, dyn: D, nDyn: n, lw: max(1, hs * 0.012) });
    holoScan(g, cx, hcy, hs * 1.3, hs, col, t, fl * 0.8);
    glow(g, col, cx, hcy, hs * 2.2, 0.12 * fl);
    return { x: cx - rx, y: hcy - hs, w: rx * 2, h: cy - hcy + hs + ry };
  }
  MODELS.trade = function () {
    const a = [];
    hSphere(a, 0.3, 5, 8, -0.95, 0.12, 0); hSphere(a, 0.3, 5, 8, 0.95, 0.12, 0);
    const arc = (h0, z) => { const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([-0.7 + 1.4 * u, 0.12 + h0 * sin(PI * u), z]); } hPoly(a, pts); };
    arc(0.7, 0); arc(0.45, 0.25); arc(0.45, -0.25);
    hBox(a, -0.3, -0.45, 0.2, 0.16, 0.14, 0.16); hBox(a, 0.05, -0.47, -0.1, 0.12, 0.1, 0.12); hBox(a, 0.38, -0.45, 0.15, 0.15, 0.13, 0.15);
    hRing(a, 0, -0.62, 0, 0.8, 40, 'y');
    return a;
  };

  /* ======================================================================= SURFACE : planet-surface landscapes */
  const SK = { hz: 0.6 };
  function surfLook(d) { return LOOKS[d && d.look] ? d.look : 'terran'; }
  function trees(g, w, y, n, sz, col, seed, conifer) {
    const R = mulberry32(seed);
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = R() * w, s = sz * (0.6 + R() * 0.8), yy = y + (R() - 0.5) * sz * 0.4;
      g.beginPath();
      if (conifer) { g.moveTo(x, yy - s * 2.2); g.lineTo(x + s * 0.55, yy - s * 0.5); g.lineTo(x + s * 0.28, yy - s * 0.5); g.lineTo(x + s * 0.7, yy); g.lineTo(x - s * 0.7, yy); g.lineTo(x - s * 0.28, yy - s * 0.5); g.lineTo(x - s * 0.55, yy - s * 0.5); g.closePath(); }
      else g.arc(x, yy - s, s, 0, TAU);
      g.fill();
    }
  }
  function dunes(g, w, h, base, amp, seed, cLit, cShade) {
    const R = mulberry32(seed), p1 = R() * 6, p2 = R() * 6, f = 0.0035 + R() * 0.002;
    g.beginPath(); g.moveTo(0, h);
    const ys = [];
    for (let x = 0; x <= w + 8; x += 6) { const y = base - amp * (0.5 + 0.36 * sin(x * f + p1) + 0.18 * sin(x * f * 2.3 + p2)); ys.push(y); g.lineTo(x, y); }
    g.lineTo(w + 8, h); g.closePath(); g.fillStyle = lgr(g, 0, base - amp, 0, base + amp * 0.5, [0, cLit, 1, cShade]); g.fill();
    g.strokeStyle = rgba('#fff', 0.15); g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < ys.length; i++) { if (i) g.lineTo(i * 6, ys[i]); else g.moveTo(0, ys[i]); } g.stroke();
  }
  function mesas(g, w, base, hmax, seed, col, col2) {
    const R = mulberry32(seed); let x = -20;
    while (x < w) {
      const bw = w * (0.05 + R() * 0.12), bh = hmax * (0.35 + R() * 0.65), top = base - bh;
      g.beginPath(); g.moveTo(x, base + 4); g.lineTo(x + bw * 0.04, top + bh * 0.2); g.lineTo(x + bw * 0.1, top); g.lineTo(x + bw * 0.9, top); g.lineTo(x + bw * 0.96, top + bh * 0.2); g.lineTo(x + bw, base + 4); g.closePath();
      g.fillStyle = lgr(g, x, 0, x + bw, 0, [0, col, 1, col2]); g.fill();
      g.fillStyle = rgba('#fff', 0.14); g.fillRect(x + bw * 0.1, top, bw * 0.8, 2);
      for (let k = 1; k < 4; k++) { g.fillStyle = rgba('#000', 0.14); g.fillRect(x + bw * 0.04, top + bh * k / 4, bw * 0.92, 2); }
      x += bw * (0.7 + R() * 0.6);
    }
  }
  function spires(g, w, base, hmax, seed, col, n) {
    const R = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const x = R() * w, bw = hmax * (0.05 + R() * 0.08), bh = hmax * (0.4 + R() * 0.6), lean = (R() - 0.5) * bw * 1.4;
      g.beginPath(); g.moveTo(x - bw, base + 3); g.quadraticCurveTo(x - bw * 0.3, base - bh * 0.5, x + lean, base - bh); g.quadraticCurveTo(x + bw * 0.5, base - bh * 0.5, x + bw, base + 3); g.closePath();
      g.fillStyle = lgr(g, x - bw, 0, x + bw, 0, [0, lite(col, 0.18), 1, dark(col, 0.45)]); g.fill();
    }
  }
  function cracks(g, w, y0, y1, n, seed, col, lw) {
    const R = mulberry32(seed);
    g.strokeStyle = col; g.lineWidth = lw || 2; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      let x = R() * w, y = y0 + R() * (y1 - y0); g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * w * 0.07; y += (R() - 0.35) * (y1 - y0) * 0.06; g.lineTo(x, y); }
      g.stroke();
    }
  }
  function citySkyline(g, w, h, cx, base, S0, col, glowCol, seed) {
    const R = mulberry32(seed), lights = [];
    // towers
    const n = 11;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - n / 2) * S0 * 0.34 + (R() - 0.5) * S0 * 0.08, tw = S0 * (0.07 + R() * 0.07), th = S0 * (0.35 + R() * 0.9) * (1 - abs(i - n / 2) / (n * 0.9));
      g.fillStyle = lgr(g, x, base - th, x + tw, base, [0, mixc('#1a2450', '#5a6aa8', 0.25 + R() * 0.3), 1, '#080c28']); g.fillRect(x - tw / 2, base - th, tw, th);
      g.fillStyle = rgba('#fff', 0.2); g.fillRect(x - tw / 2, base - th, tw, 1.5);
      if (R() < 0.5) { g.fillStyle = '#10163e'; g.fillRect(x - 1.2, base - th - S0 * 0.14, 2.4, S0 * 0.14); lights.push({ x: x, y: base - th - S0 * 0.14, c: '#ff5c6a', b: 1 }); }
      for (let wy = base - th + 6; wy < base - 4; wy += 7) for (let wx = x - tw / 2 + 2.5; wx < x + tw / 2 - 3; wx += 5) if (R() < 0.45) { g.fillStyle = rgba(R() < 0.8 ? glowCol : '#fff', 0.5 + R() * 0.5); g.fillRect(wx, wy, 2.2, 2.6); }
    }
    // domes
    const doms = [[cx - S0 * 1.1, S0 * 0.62], [cx + S0 * 1.25, S0 * 0.5], [cx + S0 * 0.05, S0 * 0.34]];
    for (const [dx, dr] of doms) {
      g.save(); g.beginPath(); g.ellipse(dx, base, dr, dr * 0.82, 0, PI, TAU); g.closePath();
      g.fillStyle = rgr(g, dx, base, dr * 0.1, dr, [0, rgba(glowCol, 0.5), 0.6, rgba('#8fc8ff', 0.18), 1, rgba('#a8d8ff', 0.4)]); g.fill(); g.clip();
      for (let i = 0; i < 9; i++) { const bx = dx + (R() - 0.5) * dr * 1.5, bh = dr * (0.15 + R() * 0.4), bw = dr * (0.05 + R() * 0.07); g.fillStyle = rgba('#0a0f30', 0.85); g.fillRect(bx - bw / 2, base - bh, bw, bh); g.fillStyle = rgba(glowCol, 0.8); for (let k = 0; k < 4; k++) g.fillRect(bx - bw * 0.3 + (k % 2) * bw * 0.35, base - bh + 3 + floor(k / 2) * 6, 2, 2.5); }
      g.restore();
      g.strokeStyle = rgba('#d8ecff', 0.7); g.lineWidth = 1.5; g.beginPath(); g.ellipse(dx, base, dr, dr * 0.82, 0, PI, TAU); g.stroke();
      g.lineWidth = 1; g.strokeStyle = rgba('#d8ecff', 0.28); for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(dx, base, dr * i / 4, dr * 0.82, 0, PI, TAU); g.stroke(); } g.beginPath(); g.moveTo(dx - dr, base); g.lineTo(dx + dr, base); g.stroke();
      g.fillStyle = rgba('#fff', 0.2); g.beginPath(); g.ellipse(dx - dr * 0.35, base - dr * 0.5, dr * 0.35, dr * 0.1, -0.7, 0, TAU); g.fill();
      g.fillStyle = '#0a1030'; g.fillRect(dx - dr * 1.05, base, dr * 2.1, S0 * 0.06);
    }
    // maglev
    g.fillStyle = '#0a1030'; g.fillRect(cx - S0 * 2.4, base + S0 * 0.02, S0 * 4.8, 3); for (let i = 0; i < 10; i++) g.fillRect(cx - S0 * 2.3 + i * S0 * 0.5, base + S0 * 0.02, 3, S0 * 0.13);
    return { lights: lights, doms: doms };
  }
  const SURF = {};
  function surfaceBG(g, w, h, c, d, S) {
    const look = surfLook(d), L = LOOKS[look], seed = seedOf(d.seed) + 3, R = mulberry32(seed), hz = h * (look === 'ocean' ? 0.58 : look === 'gasgiant' ? 0.66 : 0.6);
    const pop = d.populated !== undefined ? !!d.populated : !!d.inhabited, info = { hz: hz, look: look, pop: pop, seed: seed, items: {} };
    // sky
    g.fillStyle = lgr(g, 0, 0, 0, hz, [0, L.sky[0], 0.55, L.sky[1], 1, L.sky[2]]); g.fillRect(0, 0, w, h);
    if (L.stars > 0) { const SR = mulberry32(seed + 5); g.fillStyle = '#fff'; for (let i = 0; i < 260 * L.stars; i++) { g.globalAlpha = (0.15 + SR() * 0.75) * L.stars; const s = SR() > 0.95 ? 2 : 1.2; g.fillRect(SR() * w, SR() * hz * 0.95, s, s); } g.globalAlpha = 1; }
    if (look === 'barren' || look === 'asteroids' || look === 'minimal') { g.save(); g.globalCompositeOperation = 'lighter'; g.translate(w * 0.5, hz * 0.4); g.rotate(-0.4); g.fillStyle = rgr(g, 0, 0, 0, w * 0.5, [0, 'rgba(150,160,220,0.14)', 1, 'rgba(150,160,220,0)']); g.scale(1, 0.18); g.fillRect(-w, -w, w * 2, w * 2); g.restore(); }
    // sun(s)
    const nSun = h2(seed, 1) < 0.22 ? 2 : 1, suns = [];
    for (let i = 0; i < nSun; i++) {
      const sx = w * (0.14 + 0.5 * h2(seed, 3 + i * 7) + i * 0.1), sy = hz * (0.2 + 0.4 * h2(seed, 4 + i * 5)), sr = h * (look === 'inferno' ? 0.09 : look === 'desert' ? 0.07 : look === 'barren' || look === 'asteroids' ? 0.022 : 0.04) * (i ? 0.6 : 1);
      suns.push({ x: sx, y: sy, r: sr });
      g.save(); g.globalCompositeOperation = 'lighter';
      glow(g, L.sun, sx, sy, h * (look === 'barren' || look === 'asteroids' ? 0.3 : 0.62), look === 'barren' ? 0.3 : 0.4); glow(g, '#ffffff', sx, sy, sr * 3.4, 0.8);
      g.restore();
      g.fillStyle = lite(L.sun, 0.5); g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    }
    info.suns = suns;
    // neighbour planet / moons
    const nb = ['gasgiant', 'ocean', 'arid', 'desert', 'terran', 'tundra', 'gasgiant'][(seed >>> 3) % 7];
    const nbR = h * (look === 'asteroids' ? 0.34 : look === 'gasgiant' ? 0.1 : 0.05 + 0.05 * h2(seed, 9)), nx = w * (0.1 + 0.55 * h2(seed, 10)), ny = hz * (look === 'asteroids' ? 0.5 : 0.2 + 0.28 * h2(seed, 11));
    if (look !== 'gasgiant' || true) {
      const nd = { look: look === 'asteroids' ? 'gasgiant' : (nb === look ? 'barren' : nb), seed: seed + 11, rings: !!d.rings || look === 'asteroids' || (nb === 'gasgiant' && h2(seed, 14) < 0.5) };
      planetStatic(g, nd, nx, ny, nbR, S, { lightAngle: atan2(suns[0].y - ny, suns[0].x - nx) });
      info.nb = { x: nx, y: ny, r: nbR };
    }
    if (look !== 'asteroids' && look !== 'barren') { const mx = w * (0.55 + 0.4 * h2(seed, 12)), my = hz * (0.12 + 0.25 * h2(seed, 13)), mr = h * 0.018; g.fillStyle = rgba('#e8e8f0', look === 'terran' || look === 'gaia' ? 0.5 : 0.85); g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill(); g.fillStyle = rgba('#000', 0.22); g.beginPath(); g.arc(mx + mr * 0.35, my + mr * 0.1, mr * 0.95, 0, TAU); g.fill(); }
    // terrain per look
    (SURF[look] || SURF.terran)(g, w, h, hz, R, L, info, S);
    // haze at the horizon
    g.fillStyle = lgr(g, 0, hz - h * 0.14, 0, hz + h * 0.05, [0, rgba(L.sky[2], 0), 0.7, rgba(L.sky[2], look === 'barren' || look === 'asteroids' ? 0.0 : 0.38), 1, rgba(L.sky[2], 0.0)]); g.fillRect(0, hz - h * 0.14, w, h * 0.19);
    // settlement
    const sx0 = w * (0.27 + 0.12 * h2(seed, 20)), gy = hz + h * 0.1, S0 = h * 0.095;
    info.gy = gy; info.sx0 = sx0; info.S0 = S0;
    // landing pad / ground patch
    if (look === 'ocean' || look === 'gasgiant') {
      const pw = S0 * 4.6, ph = S0 * 0.14;
      g.fillStyle = rgba('#000', 0.3); g.beginPath(); g.ellipse(sx0, gy + ph * 3.2, pw * 0.62, ph * 1.4, 0, 0, TAU); g.fill();
      g.fillStyle = lgr(g, 0, gy, 0, gy + ph * 3, [0, '#3a4a7a', 1, '#0a1030']); g.beginPath(); g.moveTo(sx0 - pw / 2, gy); g.lineTo(sx0 + pw / 2, gy); g.lineTo(sx0 + pw * 0.46, gy + ph * 1.4); g.lineTo(sx0 - pw * 0.46, gy + ph * 1.4); g.closePath(); g.fill();
      g.strokeStyle = rgba(C.brass, 0.7); g.lineWidth = 1.4; g.stroke();
      for (let i = -3; i <= 3; i++) { g.fillStyle = '#10163e'; g.fillRect(sx0 + i * pw * 0.14 - 2.5, gy + ph * 1.3, 5, ph * (look === 'ocean' ? 4 : 2.2)); }
    } else { g.fillStyle = rgba('#000', 0.28); g.beginPath(); g.ellipse(sx0, gy + h * 0.025, S0 * 3.4, h * 0.03, 0, 0, TAU); g.fill(); }
    if (pop) { info.city = citySkyline(g, w, h, sx0, gy, S0, L.gnd[1], d.color || '#ffd890', seed); }
    // near foreground silhouette
    surfFore(g, w, h, hz, look, mulberry32(seed + 7), L);
    ridge(g, w, h * 0.97, h * 0.06, seed + 40, h, rgba(dark(L.gnd[2], 0.65), 1), 0.2);
    // vignette-ish ground darkening
    g.fillStyle = lgr(g, 0, hz + h * 0.15, 0, h, [0, 'rgba(0,0,0,0)', 1, 'rgba(0,0,0,0.5)']); g.fillRect(0, hz + h * 0.15, w, h);
    bakeGrain(g, w, h, 0.045);
    return info;
  }
  function surfFore(g, w, h, hz, look, R, L) {
    const y0 = h * 0.86;
    if (look === 'terran' || look === 'steppe' || look === 'gaia' || look === 'jungle' || look === 'toxic') {
      const col = look === 'toxic' ? '#2a3a10' : look === 'jungle' ? '#0a3a20' : look === 'steppe' ? '#6a6a2a' : '#1f5a2c';
      g.lineCap = 'round';
      for (let i = 0; i < 160; i++) { const x = R() * w, y = y0 + R() * (h - y0), l = h * (0.02 + R() * 0.05), lean = (R() - 0.5) * l * 0.8; g.strokeStyle = mixc(col, '#000', R() * 0.5); g.lineWidth = 1.2 + R() * 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.4, y - l * 0.6, x + lean, y - l); g.stroke(); }
      if (look === 'gaia' || look === 'terran') for (let i = 0; i < 40; i++) { g.fillStyle = ['#ff7aa8', '#fff08a', '#ffffff', '#c89aff'][i % 4]; const x = R() * w, y = y0 + R() * (h - y0); g.beginPath(); g.arc(x, y, 2 + R() * 2, 0, TAU); g.fill(); }
    } else if (look === 'desert' || look === 'arid' || look === 'minimal' || look === 'barren' || look === 'asteroids' || look === 'dead') {
      for (let i = 0; i < 26; i++) { const x = R() * w, y = y0 + R() * (h - y0), s = h * (0.008 + R() * 0.026); g.fillStyle = lgr(g, x - s, y - s, x + s, y + s, [0, lite(L.gnd[1], 0.25), 1, dark(L.gnd[2], 0.6)]); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.5, y - s * 0.8); g.lineTo(x + s * 0.3, y - s); g.lineTo(x + s, y - s * 0.2); g.lineTo(x + s * 0.8, y); g.closePath(); g.fill(); }
    } else if (look === 'tundra') {
      for (let i = 0; i < 20; i++) { const x = R() * w, y = y0 + R() * (h - y0), s = h * (0.01 + R() * 0.03); g.fillStyle = lgr(g, 0, y - s * 2, 0, y, [0, '#ffffff', 1, '#8ab0dc']); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 2); g.lineTo(x + s * 0.2, y - s * 1.3); g.lineTo(x + s, y); g.closePath(); g.fill(); }
    } else if (look === 'inferno') {
      for (let i = 0; i < 24; i++) { const x = R() * w, y = y0 + R() * (h - y0), s = h * (0.01 + R() * 0.03); g.fillStyle = '#0a0406'; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.2, y - s * 2.2); g.lineTo(x + s * 0.9, y); g.closePath(); g.fill(); g.strokeStyle = rgba('#ff6a20', 0.7); g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - s * 0.2, y - s * 2.2); g.lineTo(x + s * 0.9, y); g.stroke(); }
    } else if (look === 'radiated') {
      for (let i = 0; i < 9; i++) crystal(g, R() * w, h * (0.9 + R() * 0.1), h * (0.015 + R() * 0.02), h * (0.05 + R() * 0.07), '#7aff30', i + 40, (R() - 0.5) * 0.3);
    } else if (look === 'ocean') {
      for (let i = 0; i < 6; i++) { const x = w * (0.05 + R() * 0.9), y = h * (0.93 + R() * 0.06), s = h * (0.02 + R() * 0.04); g.fillStyle = '#10243a'; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.7, 0, PI, TAU); g.fill(); g.fillStyle = rgba('#fff', 0.5); g.beginPath(); g.ellipse(x, y + 2, s * 1.7, s * 0.22, 0, 0, TAU); g.fill(); }
    }
  }
  SURF.terran = (g, w, h, hz, R, L, info) => {
    ridge(g, w, hz + 2, h * 0.2, 3, h, lgr(g, 0, hz - h * 0.2, 0, hz, [0, '#ffffff', 0.28, '#dbe6f4', 0.55, '#8ea6c6', 1, '#8aa0c0']), 0.1);
    ridge(g, w, hz + h * 0.05, h * 0.1, 7, h, '#4a7a5a', 0.12); trees(g, w, hz + h * 0.015, 90, h * 0.014, '#2c5a3c', 5, true);
    ridge(g, w, hz + h * 0.12, h * 0.08, 11, h, '#5a9a4a', 0.1); trees(g, w, hz + h * 0.1, 55, h * 0.022, '#2f6a3a', 9, true);
    ridge(g, w, hz + h * 0.22, h * 0.07, 15, h, '#3f8a3e', 0.12);
    g.strokeStyle = rgba('#d8ecff', 0.85); g.lineWidth = 5; g.beginPath(); g.moveTo(w * 0.1, hz + h * 0.13); g.bezierCurveTo(w * 0.3, hz + h * 0.1, w * 0.4, hz + h * 0.2, w * 0.55, hz + h * 0.17); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = rgba('#fff', 0.5); g.stroke();
  };
  SURF.jungle = (g, w, h, hz, R, L) => {
    ridge(g, w, hz, h * 0.14, 3, h, '#4a8a78', 0.1);
    for (const [b, col, n, s] of [[hz + h * 0.04, '#2f7a5a', 70, h * 0.05], [hz + h * 0.12, '#1f6a48', 60, h * 0.07], [hz + h * 0.22, '#124a30', 50, h * 0.1]]) { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(R() * w, b + (R() - 0.5) * s * 0.7, s * (0.6 + R() * 0.7), 0, TAU); g.fill(); } g.fillStyle = rgba('#000', 0.18); g.fillRect(0, b + s * 0.5, w, h); }
    g.fillStyle = '#0a2a1c'; g.fillRect(0, hz + h * 0.3, w, h);
    for (let i = 0; i < 6; i++) {
      const x = w * (0.03 + 0.94 * (i + R() * 0.5) / 6), th = h * (0.55 + R() * 0.25), tw = h * (0.02 + R() * 0.012);
      g.fillStyle = lgr(g, x - tw * 2, 0, x + tw * 2, 0, [0, '#04140c', 0.5, '#0a2a1a', 1, '#031009']);
      g.beginPath(); g.moveTo(x - tw * 3, h); g.quadraticCurveTo(x - tw * 0.8, hz + h * 0.1, x - tw, hz - th * 0.6); g.lineTo(x - tw * 0.6, hz - th); g.lineTo(x + tw * 0.6, hz - th); g.lineTo(x + tw, hz - th * 0.6); g.quadraticCurveTo(x + tw * 0.8, hz + h * 0.1, x + tw * 3, h); g.closePath(); g.fill();
      g.fillStyle = '#041a10';
      for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(x + (R() - 0.5) * h * 0.2, hz - th + (R() - 0.5) * h * 0.06, h * (0.05 + R() * 0.06), 0, TAU); g.fill(); }
      g.fillStyle = rgba('#3aa860', 0.25); for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + (R() - 0.7) * h * 0.14, hz - th - h * 0.035 + (R() - 0.5) * h * 0.04, h * (0.03 + R() * 0.03), 0, TAU); g.fill(); }
    }
    for (let i = 0; i < 14; i++) leafShape(g, w * (i < 7 ? 0.0 : 1.0) + (R() - 0.5) * w * 0.05, h * (0.6 + R() * 0.45), h * (0.2 + R() * 0.2), (i < 7 ? -0.5 : PI + 0.5) + (R() - 0.5) * 1.2, h * 0.035, '#0e4a2a', '#03160c');
  };
  SURF.ocean = (g, w, h, hz, R, L, info) => {
    g.fillStyle = lgr(g, 0, hz, 0, h, [0, '#9fe0f0', 0.2, '#3aa0c8', 0.6, '#14609a', 1, '#082a5a']); g.fillRect(0, hz, w, h - hz);
    g.fillStyle = rgba('#fff', 0.6); g.fillRect(0, hz, w, 1.5);
    g.fillStyle = lgr(g, 0, hz - 2, 0, hz + h * 0.08, [0, 'rgba(255,255,255,0.5)', 1, 'rgba(255,255,255,0)']); g.fillRect(0, hz - 2, w, h * 0.08);
    const ix = w * 0.12, iy = hz + 2; g.fillStyle = '#2a6a58'; g.beginPath(); g.moveTo(ix - w * 0.1, iy); g.quadraticCurveTo(ix, iy - h * 0.05, ix + w * 0.12, iy); g.closePath(); g.fill();
    g.strokeStyle = '#143a2c'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { const px = ix - w * 0.04 + i * w * 0.025; g.beginPath(); g.moveTo(px, iy - h * 0.01); g.quadraticCurveTo(px + 6, iy - h * 0.06, px + 14, iy - h * 0.05); g.stroke(); }
    for (let i = 0; i < 30; i++) { const y = hz + (h - hz) * pow(R(), 1.6), x = R() * w, ww = 20 + (y - hz) * 0.8; g.strokeStyle = rgba('#fff', 0.1 + 0.2 * R() * (y - hz) / (h - hz)); g.lineWidth = 1 + (y - hz) * 0.01; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + ww / 2, y - 3 - (y - hz) * 0.02, x + ww, y); g.stroke(); }
  };
  SURF.arid = (g, w, h, hz, R, L) => {
    mesas(g, w, hz + 3, h * 0.2, 5, '#c07a4a', '#7a3a24'); mesas(g, w, hz + h * 0.07, h * 0.16, 9, '#a86036', '#5e2a1c'); mesas(g, w, hz + h * 0.16, h * 0.13, 13, '#8a4a2c', '#3e1a12');
    g.fillStyle = lgr(g, 0, hz + h * 0.1, 0, h, [0, '#9a5a34', 1, '#4a2216']); g.fillRect(0, hz + h * 0.14, w, h);
    cracks(g, w, hz + h * 0.2, h, 22, 4, rgba('#2a1008', 0.5), 1.5);
  };
  SURF.steppe = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.08, 3, h, '#7a8aa0', 0.08);
    ridge(g, w, hz + h * 0.05, h * 0.08, 6, h, '#9a9a58', 0.06); ridge(g, w, hz + h * 0.12, h * 0.07, 9, h, '#a8a050', 0.06); ridge(g, w, hz + h * 0.22, h * 0.06, 12, h, '#8a9040', 0.08);
    g.fillStyle = rgba('#000', 0.45); for (let i = 0; i < 12; i++) { const x = R() * w, y = hz + h * (0.08 + R() * 0.06); g.fillRect(x, y, 5, 2.5); g.fillRect(x + 1, y + 2, 1, 3); g.fillRect(x + 4, y + 2, 1, 3); }
  };
  SURF.desert = (g, w, h, hz, R, L) => {
    dunes(g, w, h, hz + h * 0.03, h * 0.08, 3, '#f0c078', '#a86a3a'); dunes(g, w, h, hz + h * 0.1, h * 0.1, 7, '#e8b068', '#8a4a2a'); dunes(g, w, h, hz + h * 0.2, h * 0.12, 11, '#d89a52', '#6a3820'); dunes(g, w, h, hz + h * 0.34, h * 0.14, 15, '#b87a40', '#4a2414');
  };
  SURF.minimal = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.07, 3, h, '#5a4e5a', 0.1); g.fillStyle = lgr(g, 0, hz, 0, h, [0, '#6a5a64', 1, '#1e1820']); g.fillRect(0, hz + h * 0.04, w, h);
    for (let i = 0; i < 70; i++) { const y = hz + h * 0.03 + pow(R(), 1.7) * (h - hz), x = R() * w, s = (y - hz) * 0.05 + 2; g.fillStyle = mixc('#8a7a84', '#2a222c', R()); g.beginPath(); g.ellipse(x, y, s * 1.4, s, 0, 0, TAU); g.fill(); g.fillStyle = rgba('#fff', 0.2); g.fillRect(x - s, y - s * 0.7, s * 0.7, 1.4); }
    g.fillStyle = rgba('#8aa86a', 0.5); for (let i = 0; i < 30; i++) { const y = hz + h * 0.06 + R() * (h - hz) * 0.8; g.beginPath(); g.ellipse(R() * w, y, 6 + (y - hz) * 0.05, 2 + (y - hz) * 0.01, 0, 0, TAU); g.fill(); }
  };
  SURF.barren = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.05, 3, h, '#6a6a72', 0.2); g.fillStyle = lgr(g, 0, hz, 0, h, [0, '#8a8a92', 0.4, '#54545c', 1, '#1a1a20']); g.fillRect(0, hz + h * 0.01, w, h);
    for (let i = 0; i < 46; i++) { const y = hz + h * 0.02 + pow(R(), 1.5) * (h - hz) * 0.95, x = R() * w, rx = 8 + (y - hz) * 0.35 * R(), ry = rx * 0.28; g.fillStyle = rgba('#000', 0.35); g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#fff', 0.25); g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, rx, ry, 0, PI * 1.1, PI * 1.9); g.stroke(); }
    for (let i = 0; i < 24; i++) { const y = hz + h * 0.08 + R() * (h - hz) * 0.8, x = R() * w, s = 3 + (y - hz) * 0.05; g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.4, y - s); g.lineTo(x + s, y); g.closePath(); g.fill(); g.fillStyle = rgba('#000', 0.4); g.fillRect(x, y, s * 3, 2); }
  };
  SURF.tundra = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.18, 4, h, '#a8c0dc', 0.16); ridge(g, w, hz + h * 0.06, h * 0.1, 8, h, '#d8e6f4', 0.1); ridge(g, w, hz + h * 0.14, h * 0.08, 12, h, '#e8f0fa', 0.08);
    dunes(g, w, h, hz + h * 0.28, h * 0.08, 5, '#ffffff', '#9ab4d8');
    for (let i = 0; i < 6; i++) { const x = R() * w, bw = w * (0.05 + R() * 0.07), bh = h * (0.06 + R() * 0.1), by = hz + h * (0.14 + R() * 0.1); g.beginPath(); g.moveTo(x, by); g.lineTo(x + bw * 0.2, by - bh); g.lineTo(x + bw * 0.45, by - bh * 0.55); g.lineTo(x + bw * 0.7, by - bh * 0.9); g.lineTo(x + bw, by); g.closePath(); g.fillStyle = lgr(g, x, by - bh, x + bw, by, [0, '#f4fbff', 0.5, '#a8d0ec', 1, '#5a8ac0']); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; }
  };
  SURF.dead = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.1, 3, h, '#4a4640', 0.2); ridge(g, w, hz + h * 0.07, h * 0.08, 6, h, '#38342e', 0.16);
    g.fillStyle = lgr(g, 0, hz + h * 0.1, 0, h, [0, '#5a554c', 1, '#1a1814']); g.fillRect(0, hz + h * 0.1, w, h);
    cracks(g, w, hz + h * 0.14, h, 26, 7, rgba('#000', 0.5), 2);
    // ruined tower + columns
    g.fillStyle = '#16140f'; const tx = w * 0.2; g.beginPath(); g.moveTo(tx - h * 0.04, hz + h * 0.1); g.lineTo(tx - h * 0.035, hz - h * 0.12); g.lineTo(tx - h * 0.01, hz - h * 0.08); g.lineTo(tx + h * 0.005, hz - h * 0.15); g.lineTo(tx + h * 0.03, hz - h * 0.05); g.lineTo(tx + h * 0.04, hz + h * 0.1); g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) { const x = w * (0.3 + i * 0.05 + R() * 0.02), ch = h * (0.04 + R() * 0.08); g.fillRect(x, hz + h * 0.1 - ch, h * 0.012, ch); }
    for (let i = 0; i < 9; i++) { const x = R() * w, y = hz + h * (0.1 + R() * 0.25), s = h * (0.05 + R() * 0.05); g.strokeStyle = '#0c0a08'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s); g.moveTo(x, y - s * 0.5); g.lineTo(x - s * 0.4, y - s * 0.9); g.moveTo(x, y - s * 0.7); g.lineTo(x + s * 0.35, y - s * 1.05); g.stroke(); }
  };
  SURF.inferno = (g, w, h, hz, R, L, info) => {
    for (const [cx, bw, bh] of [[w * 0.22, w * 0.3, h * 0.2], [w * 0.5, w * 0.22, h * 0.14], [w * 0.88, w * 0.28, h * 0.18]]) { g.beginPath(); g.moveTo(cx - bw / 2, hz + 3); g.lineTo(cx - bw * 0.06, hz - bh); g.lineTo(cx + bw * 0.06, hz - bh); g.lineTo(cx + bw / 2, hz + 3); g.closePath(); g.fillStyle = lgr(g, 0, hz - bh, 0, hz, [0, '#2a0c08', 1, '#12060a']); g.fill(); g.fillStyle = '#ff7a30'; g.fillRect(cx - bw * 0.06, hz - bh - 1, bw * 0.12, 4); info.items.vent = (info.items.vent || []).concat([[cx, hz - bh]]); }
    g.fillStyle = lgr(g, 0, hz, 0, h, [0, '#3a120c', 1, '#0a0406']); g.fillRect(0, hz + 2, w, h);
    // lava lake and rivers
    g.save(); g.beginPath(); g.moveTo(0, hz + h * 0.12); g.bezierCurveTo(w * 0.2, hz + h * 0.06, w * 0.35, hz + h * 0.2, w * 0.6, hz + h * 0.12); g.bezierCurveTo(w * 0.8, hz + h * 0.07, w * 0.9, hz + h * 0.16, w, hz + h * 0.1); g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    g.fillStyle = '#0c0508'; g.fill(); g.restore();
    cracks(g, w, hz + h * 0.12, h, 34, 5, '#ff6a20', 2.2); cracks(g, w, hz + h * 0.12, h, 20, 9, '#ffc060', 1.2);
    g.fillStyle = lgr(g, 0, hz + h * 0.1, 0, hz + h * 0.35, [0, 'rgba(255,110,30,0.65)', 1, 'rgba(255,60,10,0)']); g.beginPath(); g.ellipse(w * 0.4, hz + h * 0.2, w * 0.28, h * 0.07, 0, 0, TAU); g.fill();
  };
  SURF.toxic = (g, w, h, hz, R, L) => {
    ridge(g, w, hz + 2, h * 0.1, 3, h, '#5a6a24', 0.14); spires(g, w, hz + h * 0.06, h * 0.3, 5, '#4a5a24', 9);
    g.fillStyle = lgr(g, 0, hz + h * 0.04, 0, h, [0, '#4a5a1e', 1, '#10180a']); g.fillRect(0, hz + h * 0.05, w, h);
    for (let i = 0; i < 4; i++) { const x = w * (0.1 + i * 0.25 + R() * 0.1), y = hz + h * (0.12 + R() * 0.2), rx = w * (0.08 + R() * 0.1); g.fillStyle = lgr(g, 0, y - 10, 0, y + 12, [0, '#d8ff70', 1, '#6aa820']); g.beginPath(); g.ellipse(x, y, rx, rx * 0.12, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#fff', 0.35); g.lineWidth = 1; g.stroke(); }
    spires(g, w, hz + h * 0.3, h * 0.36, 9, '#2e3a16', 7);
  };
  SURF.radiated = (g, w, h, hz, R, L, info) => {
    ridge(g, w, hz + 2, h * 0.1, 3, h, '#3a2a4a', 0.16); g.fillStyle = lgr(g, 0, hz, 0, h, [0, '#3a2a48', 1, '#0e0a14']); g.fillRect(0, hz + 2, w, h);
    cracks(g, w, hz + h * 0.06, h, 30, 5, '#b8ff40', 2.2); cracks(g, w, hz + h * 0.06, h, 16, 8, '#f0ffb0', 1);
    info.items.gem = [];
    for (let i = 0; i < 12; i++) { const x = R() * w, by = hz + h * (0.08 + R() * 0.3), ch = h * (0.04 + R() * 0.1) * (1 + (by - hz) / h); crystal(g, x, by, ch * 0.3, ch, '#9aff30', i + 4, (R() - 0.5) * 0.3); info.items.gem.push([x, by - ch / 2, ch]); }
  };
  SURF.gaia = (g, w, h, hz, R, L, info) => {
    // rainbow
    g.save(); g.globalCompositeOperation = 'screen'; ['#ff5a5a', '#ffa44a', '#ffe86a', '#6aff8a', '#6ac8ff', '#9a8aff'].forEach((c0, i) => { g.strokeStyle = rgba(c0, 0.22); g.lineWidth = h * 0.012; g.beginPath(); g.arc(w * 0.62, hz + h * 0.1, h * (0.62 - i * 0.012), PI * 1.12, PI * 1.9); g.stroke(); }); g.restore();
    ridge(g, w, hz + 2, h * 0.16, 3, h, '#7aa8c8', 0.1); ridge(g, w, hz + h * 0.05, h * 0.1, 7, h, '#4a9a6a', 0.1);
    // waterfall
    const wx = w * 0.3; g.fillStyle = '#6a8a78'; g.fillRect(wx - w * 0.03, hz - h * 0.03, w * 0.06, h * 0.13); g.fillStyle = lgr(g, 0, hz - h * 0.03, 0, hz + h * 0.1, [0, 'rgba(255,255,255,0.95)', 1, 'rgba(180,230,255,0.75)']); g.fillRect(wx - w * 0.007, hz - h * 0.03, w * 0.014, h * 0.13); info.items.fall = [wx, hz - h * 0.03, hz + h * 0.1];
    ridge(g, w, hz + h * 0.14, h * 0.08, 11, h, '#4aaa4a', 0.1); trees(g, w, hz + h * 0.12, 40, h * 0.024, '#2a7a3a', 5);
    ridge(g, w, hz + h * 0.24, h * 0.07, 15, h, '#5ac05a', 0.12);
    const fl = ['#ff7aa8', '#fff08a', '#ffffff', '#c89aff', '#ff9a5a']; for (let i = 0; i < 180; i++) { const y = hz + h * 0.2 + pow(R(), 0.8) * (h - hz - h * 0.2), x = R() * w; g.fillStyle = fl[i % 5]; g.fillRect(x, y, 2 + (y - hz) * 0.006, 2 + (y - hz) * 0.006); }
  };
  SURF.gasgiant = (g, w, h, hz, R, L, info) => {
    const bands = [['#f4dcb0', 0], ['#d8a070', 0.18], ['#b87850', 0.34], ['#e8c090', 0.5], ['#8a5a44', 0.68], ['#d09a68', 0.84], ['#5a3a34', 1]];
    for (let i = 0; i < bands.length - 1; i++) { const y0 = hz + (h - hz) * bands[i][1], y1 = hz + (h - hz) * bands[i + 1][1]; g.fillStyle = lgr(g, 0, y0, 0, y1, [0, bands[i][0], 1, bands[i + 1][0]]); g.fillRect(0, y0, w, y1 - y0 + 1); }
    const cs = fogTile(21, 256, '#fff2d8', 0.4, 0.75, 0.7, 5, 3);
    g.globalAlpha = 0.75; for (let k = 0; k < 3; k++) { const y = hz + (h - hz) * (0.05 + k * 0.3); g.drawImage(cs, 0, y, w, (h - hz) * 0.22); } g.globalAlpha = 1;
    for (let i = 0; i < 2; i++) { const y = hz + (h - hz) * (0.2 + i * 0.4); g.strokeStyle = rgba('#fff', 0.2); g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 20, w * 0.6, y + 24, w, y - 8); g.stroke(); }
    const vx = w * 0.3, vy = hz + (h - hz) * 0.5; g.fillStyle = rgba('#b0502a', 0.8); g.beginPath(); g.ellipse(vx, vy, w * 0.06, h * 0.03, 0, 0, TAU); g.fill(); g.strokeStyle = rgba('#ffd8a0', 0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(vx, vy, w * 0.08, h * 0.04, 0, 0, TAU); g.stroke();
    info.items.storm = [vx, vy];
  };
  SURF.asteroids = (g, w, h, hz, R, L) => {
    g.fillStyle = '#0a0a0e'; g.beginPath(); g.ellipse(w * 0.5, h * 1.9, w * 1.1, h * 1.3, 0, 0, TAU); g.fill();
    g.fillStyle = lgr(g, 0, hz + h * 0.1, 0, h, [0, '#6a625a', 1, '#14120f']); g.fillRect(0, hz + h * 0.1, w, h);
    for (let i = 0; i < 30; i++) { const x = R() * w, by = hz + h * (0.12 + R() * 0.3), s = h * (0.03 + R() * 0.12); g.beginPath(); g.moveTo(x - s, by); g.lineTo(x - s * 0.5, by - s * 0.9); g.lineTo(x + s * 0.1, by - s * 1.2); g.lineTo(x + s * 0.8, by - s * 0.5); g.lineTo(x + s, by); g.closePath(); g.fillStyle = lgr(g, x - s, by - s, x + s, by, [0, mixc('#9a9086', '#3a342e', R() * 0.4), 1, '#14110e']); g.fill(); g.fillStyle = rgba('#fff', 0.18); g.beginPath(); g.moveTo(x - s * 0.5, by - s * 0.9); g.lineTo(x + s * 0.1, by - s * 1.2); g.lineTo(x - s * 0.05, by - s * 0.5); g.closePath(); g.fill(); }
  };

  Scenes.surface = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), look = surfLook(o), L = LOOKS[look];
      const key = 'surf|' + look + '|' + (o.seed | 0) + '|' + (o.rings ? 1 : 0) + '|' + (o.populated === undefined ? (o.inhabited ? 1 : 0) : (o.populated ? 1 : 0)) + '|' + (o.color || '');
      const e = layer(key, w, h, S, (g, ww, hh, c) => surfaceBG(g, ww, hh, c, o, c.width / ww)), I = e.d, hz = I.hz;
      const photo = artBG(ctx, G.WorldArt && G.WorldArt.surface(look), w, h, { fx: 0.5, fy: 0.55 });   // photo backdrop replaces the painted world; I keeps the layout (landing site, ground line)
      if (!photo) ctx.drawImage(e.c, 0, 0, w, h);
      // live sky: clouds
      const cl = photo ? 0 : L.cloud;
      if (cl > 0.05) {
        const tone = look === 'inferno' ? '#3a1008' : look === 'dead' ? '#6a665c' : look === 'toxic' ? '#c8e060' : look === 'radiated' ? '#8a5aa8' : look === 'gasgiant' ? '#f4dcb0' : '#ffffff';
        const ct = fogTile(40 + look.length, 256, tone, 0.45, 0.82, 0.85, 5, 3);
        scrollTile(ctx, ct, 0, hz * 0.05, w, hz * 0.42, 2.6, t * 7, 0.55 * cl); scrollTile(ctx, ct, 0, hz * 0.38, w, hz * 0.4, 3.4, t * 12 + 70, 0.5 * cl);
      }
      if (!photo) for (const s of I.suns) glow(ctx, L.sun, s.x, s.y, s.r * (6 + sin(t * 0.7)), 0.18);
      // look-specific life
      if (!photo) surfLive(ctx, w, h, t, o, I, L, look);
      // settlement life
      if (I.pop) {
        if (photo) { /* the photo carries its own sky and settlement */ } else {
        if (I.city) for (const l of I.city.lights) { const on = sin(t * 2 + l.x) > -0.2; if (on) glow(ctx, l.c, l.x, l.y, 9, 0.9); }
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const u = fract(t * (0.04 + i * 0.01) + i * 0.27), x = lerp(-20, w + 20, i % 2 ? 1 - u : u), y = hz - h * (0.05 + 0.1 * h2(i, 3)) + sin(t + i) * 4; glowL(ctx, i % 2 ? '#ffd890' : '#8fd8ff', x, y, 7, 0.9); ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.fillRect(x - 1, y - 1, 2, 2); }
        if (I.city) for (let i = 0; i < 3; i++) { const u = fract(t * 0.07 + i / 3), x = I.sx0 - I.S0 * 2.3 + u * I.S0 * 4.6; ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffe9b0'; ctx.fillRect(x, I.gy + I.S0 * 0.025, 6, 2); glowL(ctx, '#ffe9b0', x + 3, I.gy + I.S0 * 0.03, 9, 0.5); }
        const gc = o.color || '#ffd890';
        for (const [dx, dr] of (I.city ? I.city.doms : [])) glowL(ctx, gc, dx, I.gy - dr * 0.2, dr * 1.3, 0.12 + 0.04 * sin(t * 1.3 + dx));
        ctx.restore();
        }
      } else {
        // colony ship descends; outpost beacon on the ground
        const landing = o.landing != null ? clamp(o.landing, 0, 1) : sstep(0, 1, (t % 16) / 11);
        const gx = I.sx0, gy = I.gy + I.S0 * 0.1, sy = lerp(h * 0.04, gy - I.S0 * 0.75, landing), shs = I.S0 * 1.4;
        ctx.save();
        const touch = sstep(0.8, 1, landing), dust = (1 - abs(landing - 0.92) * 6);
        if (landing > 0.75 && landing < 1) { ctx.globalAlpha = clamp(dust, 0, 1) * 0.5; const dst = fogTile(55, 256, look === 'ocean' ? '#ffffff' : lite(L.gnd[1], 0.4), 0.3, 0.7, 0.9, 4, 3); ctx.drawImage(dst, gx - I.S0 * 2.2, gy - I.S0 * 0.2, I.S0 * 4.4, I.S0 * 0.5); ctx.globalAlpha = 1; }
        ctx.translate(gx, sy); ctx.rotate(Math.PI / 2);
        if (landing < 0.99) { glow(ctx, '#ffb060', shs * 0.55, 0, shs * 1.4, 0.7 * (1 - touch * 0.6)); glow(ctx, '#ffffff', shs * 0.45, 0, shs * 0.5, 0.9 * (1 - touch)); }
        ctx.restore();
        drawShip(ctx, { race: o.race || 'human', hull: 'cruiser', x: gx, y: sy, size: shs, angle: -PI / 2 + 0, view: '3q', color: o.color || '#8fb4ff', t: t, thrust: 1 - touch, flags: { colony: true } });   // seen from the beach, not from above
        // landing guide lights + beacon mast
        if (!photo) {
        const bx = gx - I.S0 * 1.8;
        ctx.fillStyle = '#10163e'; ctx.fillRect(bx - 1.5, gy - I.S0 * 0.9, 3, I.S0 * 0.9); ctx.fillStyle = '#c8d4ff'; ctx.fillRect(bx - 5, gy - I.S0 * 0.95, 10, 2);
        const blink = 0.5 + 0.5 * sin(t * 3);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowL(ctx, '#ff5c6a', bx, gy - I.S0 * 0.98, 16, 0.3 + 0.7 * blink);
        for (let i = -3; i <= 3; i++) { if (i === 0) continue; const lx = gx + i * I.S0 * 0.62, p = 0.4 + 0.6 * max(0, sin(t * 4 - abs(i) * 0.8)); glowL(ctx, '#7affc8', lx, gy + I.S0 * 0.06, 8, 0.3 + 0.5 * p); }
        ctx.restore();
        ctx.strokeStyle = rgba('#7affc8', 0.35); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(gx, gy + I.S0 * 0.06, I.S0 * 1.9, I.S0 * 0.18, 0, 0, TAU); ctx.stroke();
        }
      }
      finish(ctx, w, h, 0.38, 0.035, t);
      end(ctx);
      return { sky: { x: 0, y: 0, w: w, h: hz }, ground: { x: 0, y: hz, w: w, h: h - hz }, site: { x: I.sx0 - I.S0 * 3, y: I.gy - I.S0 * 1.4, w: I.S0 * 6, h: I.S0 * 1.8 }, panel: { x: w * 0.62, y: h * 0.1, w: w * 0.35, h: h * 0.62 } };
    },
  };
  function surfLive(g, w, h, t, o, I, L, look) {
    const hz = I.hz;
    if (look === 'inferno') {
      const fl = 0.75 + 0.25 * sin(t * 3) * sin(t * 1.7);
      g.save(); g.globalCompositeOperation = 'lighter';
      glowL(g, '#ff5a20', w * 0.4, hz + h * 0.2, w * 0.35, 0.22 * fl);
      for (const [vx, vy] of (I.items.vent || [])) { for (let k = 0; k < 9; k++) { const u = fract(t * 0.14 + k / 9 + vx * 0.001), px = vx + sin(u * 4 + k) * w * 0.03 * u, py = vy - u * h * 0.45, r = h * (0.03 + 0.1 * u); g.globalCompositeOperation = 'source-over'; g.globalAlpha = sin(u * PI) * 0.35; g.drawImage(glowImg('#241008'), px - r, py - r, r * 2, r * 2); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - u) * (1 - u) * 0.3; g.drawImage(glowImg('#ff6a20'), px - r * 0.5, py - r * 0.5, r, r); } }
      for (let i = 0; i < 40; i++) { const u = fract(t * (0.1 + h2(i, 3) * 0.12) + h2(i, 4)), x = w * h2(i, 5) + sin(t + i) * 12, y = h - u * h * 0.8; g.globalAlpha = (1 - u) * 0.9; g.fillStyle = '#ffb060'; g.fillRect(x, y, 2, 2); }
      g.restore();
    } else if (look === 'toxic') {
      const f = fract(t * 0.13), fl = f < 0.04 ? 1 - f / 0.04 : 0;
      for (let i = 0; i < 14; i++) { const u = fract(t * 0.3 + i * 0.37), x = w * (0.1 + 0.8 * h2(i, 9)), y = hz + h * (0.1 + 0.2 * h2(i, 10)) - u * h * 0.05; g.strokeStyle = rgba('#e8ffa0', (1 - u) * 0.6); g.lineWidth = 1; g.beginPath(); g.arc(x, y, 2 + u * 4, 0, TAU); g.stroke(); }
      if (fl > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#e8ffb0', fl * 0.35); g.fillRect(0, 0, w, hz); g.strokeStyle = rgba('#fff', fl); g.lineWidth = 2; g.beginPath(); let x = w * (0.2 + 0.6 * h2(floor(t * 0.13), 5)), y = 0; g.moveTo(x, y); while (y < hz) { y += hz / 8; x += (h2(floor(y), floor(t * 0.13)) - 0.5) * w * 0.05; g.lineTo(x, y); } g.stroke(); g.restore(); }
    } else if (look === 'radiated') {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [x, y, s] of (I.items.gem || [])) { const p = 0.5 + 0.5 * sin(t * 2 + x * 0.01); glowL(g, '#9aff30', x, y, s * (1.2 + 0.3 * p), 0.2 + 0.25 * p); }
      for (let i = 0; i < 3; i++) { g.fillStyle = rgba('#8aff50', 0.05 + 0.03 * sin(t * 0.5 + i * 2)); g.beginPath(); g.moveTo(0, hz * (0.2 + i * 0.12)); g.bezierCurveTo(w * 0.3, hz * (0.05 + i * 0.1 + 0.05 * sin(t * 0.4 + i)), w * 0.6, hz * (0.4 + i * 0.1), w, hz * (0.15 + i * 0.1)); g.lineTo(w, hz * (0.15 + i * 0.1) + 40); g.bezierCurveTo(w * 0.6, hz * (0.4 + i * 0.1) + 40, w * 0.3, hz * (0.05 + i * 0.1) + 40, 0, hz * (0.2 + i * 0.12) + 40); g.fill(); }
      for (let i = 0; i < 18; i++) { const tw = max(0, sin(t * 6 + i * 4)); if (tw > 0.7) { g.globalAlpha = tw; g.fillStyle = '#e8ffb0'; g.fillRect(w * h2(i, 3), hz + h * 0.5 * h2(i, 4), 2, 2); } }
      g.restore();
    } else if (look === 'tundra') {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) { const ph = t * 0.35 + i * 1.7; g.fillStyle = lgr(g, 0, 0, 0, hz * 0.7, [0, rgba(i % 2 ? '#7affb0' : '#a89aff', 0), 0.4, rgba(i % 2 ? '#7affb0' : '#a89aff', 0.16), 1, rgba(i % 2 ? '#7affb0' : '#a89aff', 0)]);
        g.beginPath(); g.moveTo(0, hz * 0.45); for (let x = 0; x <= w; x += 20) g.lineTo(x, hz * (0.28 + 0.07 * i) + sin(x * 0.006 + ph) * hz * 0.08 + sin(x * 0.014 - ph * 1.3) * hz * 0.03); g.lineTo(w, hz * 0.7); for (let x = w; x >= 0; x -= 20) g.lineTo(x, hz * (0.55 + 0.04 * i) + sin(x * 0.005 + ph) * hz * 0.05); g.closePath(); g.fill(); }
      for (let i = 0; i < 30; i++) { const tw = max(0, sin(t * 2 + i * 3)); if (tw > 0.6) { g.globalAlpha = tw; g.fillStyle = '#fff'; g.fillRect(w * h2(i, 6), hz + h * 0.4 * h2(i, 7), 2, 2); } }
      g.restore();
      motes(g, 0, 0, w, h, 50, t, '#ffffff', 0.55, 9, 2);
    } else if (look === 'dead') {
      motes(g, 0, 0, w, h, 70, t, '#8a867c', 0.55, 3, 2.2);
    } else if (look === 'desert' || look === 'arid') {
      const mist = fogTile(64, 256, look === 'desert' ? '#ffe0a0' : '#e0a070', 0.45, 0.8, 0.5, 5, 3);
      scrollTile(g, mist, 0, hz - h * 0.02, w, h * 0.12, 3, t * 20, 0.28);
      motes(g, 0, hz, w, h - hz, 36, t, '#ffd8a0', 0.4, 5, 1.8);
    } else if (look === 'jungle') {
      const mist = fogTile(66, 256, '#c8ffd8', 0.45, 0.8, 0.5, 5, 3);
      scrollTile(g, mist, 0, hz, w, h * 0.3, 3.6, t * 6, 0.32);
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const x = w * (0.2 + i * 0.18); g.fillStyle = lgr(g, x, 0, x + w * 0.12, hz, [0, 'rgba(255,240,170,0.16)', 1, 'rgba(255,240,170,0)']); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w * 0.04, 0); g.lineTo(x + w * 0.18, hz); g.lineTo(x + w * 0.08, hz); g.closePath(); g.fill(); } g.restore();
      for (let i = 0; i < 16; i++) { const x = w * h2(i, 8) + sin(t * 0.5 + i) * 20, y = h * (0.3 + 0.4 * h2(i, 9)) + cos(t * 0.4 + i * 2) * 14, a = 0.5 + 0.5 * sin(t * 2.4 + i * 3); g.save(); g.globalCompositeOperation = 'lighter'; glowL(g, '#d8ff70', x, y, 9, 0.5 * a); g.restore(); }
    } else if (look === 'ocean') {
      g.save(); g.globalCompositeOperation = 'lighter';
      const s = I.suns[0];
      for (let i = 0; i < 60; i++) { const y = hz + 3 + pow(h2(i, 1), 1.5) * (h - hz), sp = (y - hz) * 0.35 + 8, x = s.x + (h2(i, 2) - 0.5) * sp * 2, tw = max(0, sin(t * (2 + h2(i, 3) * 3) + i * 7)); g.globalAlpha = tw * 0.8; g.fillStyle = '#fffbe8'; g.fillRect(x - 3, y, 6 + (y - hz) * 0.02, 1.4); }
      g.restore();
      for (let i = 0; i < 3; i++) { const u = fract(t * 0.01 + i * 0.3); birdDraw(g, w * (1.1 - u * 1.3), hz * (0.4 + 0.15 * i), h * 0.012, t * 6 + i, rgba('#fff', 0.8)); }
      for (let i = 0; i < 24; i++) { const y = hz + (h - hz) * pow(h2(i, 8), 1.7), x = ((h2(i, 9) * w + t * (8 + (y - hz) * 0.03)) % (w + 120)) - 60; g.strokeStyle = rgba('#fff', 0.12 + 0.15 * (y - hz) / (h - hz)); g.lineWidth = 1 + (y - hz) * 0.006; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + (y - hz) * 0.1, y); g.stroke(); }
    } else if (look === 'gaia') {
      const f = I.items.fall; if (f) { for (let i = 0; i < 20; i++) { const u = fract(t * 0.8 + h2(i, 3)), x = f[0] + (h2(i, 4) - 0.5) * w * 0.012, y = f[1] + u * (f[2] - f[1]); g.fillStyle = rgba('#fff', 0.7 * (1 - u * 0.4)); g.fillRect(x, y, 1.6, 6); } glow(g, '#e8f8ff', f[0], f[2], w * 0.05, 0.4 + 0.1 * sin(t * 3)); }
      for (let i = 0; i < 8; i++) { const x = w * (0.1 + 0.8 * fract(h2(i, 5) + t * 0.01)) + sin(t * 1.2 + i) * 30, y = hz + h * (0.2 + 0.2 * h2(i, 6)) + sin(t * 2 + i * 2) * 10; g.fillStyle = ['#ff8ab8', '#fff08a', '#ffffff', '#b89aff'][i % 4]; g.fillRect(x, y, 3, 2 + 2 * abs(sin(t * 9 + i))); }
    } else if (look === 'steppe') {
      g.strokeStyle = rgba('#fff2a0', 0.25); g.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const y = hz + h * 0.04 + (h - hz) * pow(h2(i, 3), 1.5) * 0.8, x = ((h2(i, 4) * w + t * (20 + (y - hz) * 0.1)) % (w + 200)) - 100; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + (y - hz) * 0.2, y - 1); g.stroke(); }
      for (let i = 0; i < 3; i++) { const u = fract(t * 0.01 + i * 0.3); birdDraw(g, w * (1.1 - u * 1.3), hz * (0.4 + 0.15 * i), h * 0.012, t * 6 + i, rgba('#202a38', 0.7)); }
    } else if (look === 'terran') {
      for (let i = 0; i < 3; i++) { const u = fract(t * 0.01 + i * 0.3); birdDraw(g, w * (1.1 - u * 1.3), hz * (0.4 + 0.15 * i), h * 0.012, t * 6 + i, rgba('#202a38', 0.7)); }
      motes(g, 0, hz, w, h - hz, 18, t, '#ffffff', 0.35, 8, 1.6);
    } else if (look === 'gasgiant') {
      const f = fract(t * 0.17), fl = f < 0.05 ? 1 - f / 0.05 : 0;
      if (fl > 0 && I.items.storm) { g.save(); g.globalCompositeOperation = 'lighter'; glowL(g, '#fff0d0', I.items.storm[0] + (h2(floor(t * 0.17), 3) - 0.5) * 200, I.items.storm[1], h * 0.4, fl * 0.7); g.restore(); }
      const mist = fogTile(67, 256, '#fff2d8', 0.45, 0.8, 0.6, 5, 3); scrollTile(g, mist, 0, hz, w, h * 0.14, 3, t * 18, 0.4);
    } else if (look === 'barren' || look === 'asteroids' || look === 'minimal') {
      g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const tw = max(0, sin(t * (1 + h2(i, 3)) + i * 5)); g.globalAlpha = tw * 0.7; g.fillStyle = '#fff'; const x = w * h2(i, 4), y = hz * 0.9 * h2(i, 5); g.fillRect(x - 3, y, 6, 1); g.fillRect(x, y - 3, 1, 6); } g.restore();
      if (look === 'asteroids') { for (let i = 0; i < 8; i++) { const u = fract(t * 0.02 + i * 0.13), x = w * (u), y = h * (0.1 + 0.3 * h2(i, 6)); g.fillStyle = rgba('#9a9086', 0.8); g.beginPath(); g.arc(x, y, 2 + 4 * h2(i, 7), 0, TAU); g.fill(); } }
    }
  }

  /* ======================================================================= BATTLE : tactical backdrop */
  const STAR_TINT = { yellow: '#ffe9a8', orange: '#ffb070', red: '#ff7050', blue: '#9cc8ff', white: '#f4f8ff', green: '#a8ffb8', purple: '#d0a8ff', blackhole: '#ffb060' };
  function starKindOk(k) { k = String(k || 'yellow'); if (STAR_TINT[k]) return k; if (k === 'brown') return 'red'; if (k === 'neutron') return 'purple'; return 'yellow'; }
  function starLayer(w, h, seed, n, smax, S) {
    return layer('stars|' + seed + '|' + n + '|' + smax, w, h, S, (g) => {
      const R = mulberry32(seed);
      for (let i = 0; i < n; i++) {
        const x = R() * w, y = R() * h, m = R(), s = (0.5 + m * m * smax), tc = R();
        g.fillStyle = rgba(tc < 0.15 ? '#ffd9b0' : tc > 0.8 ? '#b4cfff' : '#ffffff', 0.35 + R() * 0.65);
        g.fillRect(x, y, s, s);
        if (s > smax * 0.8) { g.fillStyle = rgba('#fff', 0.12); g.fillRect(x - s * 2, y + s * 0.4, s * 5, 0.6); g.fillRect(x + s * 0.4, y - s * 2, 0.6, s * 5); }
      }
    }).c;
  }
  function battleGrid(g, w, h, gr) {
    const m = gr.margin != null ? gr.margin : min(w, h) * 0.035, x0 = m, y0 = m, gw = w - m * 2, gh = h - m * 2, cols = max(1, gr.cols | 0), rows = max(1, gr.rows | 0), cw = gw / cols, ch = gh / rows;
    g.save();
    g.lineWidth = 1;
    for (let i = 0; i <= cols; i++) { const x = Math.round(x0 + i * cw) + 0.5; g.strokeStyle = rgba(C.brass, i % 5 === 0 ? 0.2 : 0.09); g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + gh); g.stroke(); }
    for (let j = 0; j <= rows; j++) { const y = Math.round(y0 + j * ch) + 0.5; g.strokeStyle = rgba(C.brass, j % 5 === 0 ? 0.2 : 0.09); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + gw, y); g.stroke(); }
    g.strokeStyle = rgba(C.brassHi, 0.5); g.beginPath();
    for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { const x = x0 + i * cw, y = y0 + j * ch; g.moveTo(x - 3, y); g.lineTo(x + 3, y); g.moveTo(x, y - 3); g.lineTo(x, y + 3); }
    g.stroke();
    // frame + corner brackets
    g.strokeStyle = rgba(C.brass, 0.45); g.strokeRect(x0 - 0.5, y0 - 0.5, gw + 1, gh + 1);
    g.strokeStyle = rgba(C.brassHi, 0.85); g.lineWidth = 2; const bl = min(w, h) * 0.04;
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + gw, y0, -1, 1], [x0, y0 + gh, 1, -1], [x0 + gw, y0 + gh, -1, -1]]) { g.beginPath(); g.moveTo(cx + sx * bl, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + sy * bl); g.stroke(); }
    const fs = max(8, min(w, h) * 0.014);
    for (let i = 0; i < cols; i++) text(g, String.fromCharCode(65 + (i % 26)), x0 + (i + 0.5) * cw, y0 - 5, fs, rgba(C.brass, 0.55), 'center', FONT_U, 600, 1);
    for (let j = 0; j < rows; j++) text(g, String(j + 1), x0 - 6, y0 + (j + 0.5) * ch + fs * 0.35, fs, rgba(C.brass, 0.55), 'right', FONT_U, 600, 0.5);
    g.restore();
    return { x: x0, y: y0, w: gw, h: gh, cw: cw, ch: ch, cols: cols, rows: rows };
  }
  Scenes.battle = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), kind = starKindOk(o.starKind), seed = seedOf(o.seed == null ? 1 : o.seed), tint = STAR_TINT[kind];
      const pl = o.planet ? (o.planet.desc ? o.planet : { desc: o.planet }) : null, nebula = o.nebula !== false;
      const left = h2(seed, 1) < 0.5, sx = w * (left ? 0.13 + 0.14 * h2(seed, 2) : 0.87 - 0.14 * h2(seed, 2)), sy = h * (0.13 + 0.2 * h2(seed, 3));
      const key = 'battle|' + seed + '|' + kind + '|' + (nebula ? 1 : 0) + '|' + (pl ? (pl.desc.look || '') + (pl.desc.seed | 0) + (pl.desc.rings ? 'r' : '') + (pl.size || 1) : '-');
      const e = layer(key, w, h, S, (g, ww, hh, c) => {
        const pal = [mixc(tint, '#5a3aa8', 0.55), '#2a4aa8', mixc(tint, '#a03a7a', 0.6), '#1a7a8a'];
        const bd = backdropCanvas(Math.ceil(ww), Math.ceil(hh), seed, { palette: pal, intensity: nebula ? 0.62 : 0.06, stars: 0.5 });
        g.drawImage(bd, 0, 0, ww, hh);
        g.save(); g.globalCompositeOperation = 'lighter'; glow(g, tint, sx, sy, hh * 0.9, 0.2); g.restore();
        let pinfo = null;
        if (pl) {
          const sz = pl.size || 1, R = hh * 0.58 * sz, px = pl.x != null ? ww * pl.x : ww * (left ? 0.86 : 0.14), py = pl.y != null ? hh * pl.y : hh * 1.02;
          const la = atan2(sy - py, sx - px);
          planetStatic(g, pl.desc, px, py, R, c.width / ww, { lightAngle: la });
          g.save(); g.globalCompositeOperation = 'lighter';
          const rim = lookOf(pl.desc).atmo;
          g.strokeStyle = rgba(rim, 0.22); g.lineWidth = hh * 0.012; g.beginPath(); g.arc(px, py, R * 1.01, 0, TAU); g.stroke();
          g.restore();
          pinfo = { x: px, y: py, r: R };
        }
        bakeGrain(g, ww, hh, 0.04);
        return { planet: pinfo };
      });
      ctx.drawImage(e.c, 0, 0, w, h);
      // parallax star layers (scroll slowly, wrap)
      const lay = [[starLayer(w, h, seed + 1, floor(w * h / 5200), 1.6, S), 1.2, 0.8], [starLayer(w, h, seed + 2, floor(w * h / 12000), 2.4, S), 2.6, 0.9], [starLayer(w, h, seed + 3, floor(w * h / 40000), 3.4, S), 5, 1]];
      for (const [cv, sp, a] of lay) { const off = (t * sp) % w; ctx.globalAlpha = a * 0.85; ctx.drawImage(cv, -off, 0, w, h); ctx.drawImage(cv, w - off, 0, w, h); }
      ctx.globalAlpha = 1;
      // the distant sun
      const Sp = G.pick('space'), sz = h * 0.32, pulse = 0.94 + 0.06 * sin(t * 0.8) * sin(t * 0.37 + 1);
      let drawn = false;
      if (Sp && Sp.starSprite) { try { const spr = Sp.starSprite(kind, sz, { dpr: S, spikes: true }); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = pulse; ctx.drawImage(spr, sx - sz / 2, sy - sz / 2, sz, sz); ctx.restore(); drawn = true; } catch (er) { warnOnce('Space.starSprite', er); } }
      if (!drawn) { glow(ctx, tint, sx, sy, sz * 0.9, 0.85 * pulse); glow(ctx, '#ffffff', sx, sy, sz * 0.22, 1); }
      // lens ghosts along the line to the centre
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 4; i++) { const k = i * 0.34, gx = lerp(sx, w * 0.5, k), gy = lerp(sy, h * 0.5, k); glowL(ctx, i % 2 ? '#8fb4ff' : tint, gx, gy, h * (0.02 + 0.015 * i), 0.07); }
      ctx.restore();
      // optional tactical grid
      let grid = null;
      if (o.grid && o.grid.cols && o.grid.rows) {
        const gk = 'bgrid|' + o.grid.cols + 'x' + o.grid.rows + '|' + (o.grid.margin == null ? '' : o.grid.margin);
        const ge = layer(gk, w, h, S, (g, ww, hh) => battleGrid(g, ww, hh, o.grid));
        ctx.drawImage(ge.c, 0, 0, w, h); grid = ge.d;
      }
      finish(ctx, w, h, 0.4, 0.03, t);
      end(ctx);
      return { star: { x: sx, y: sy, r: sz * 0.12 }, planet: e.d.planet, grid: grid };
    },
  };

  /* ======================================================================= ENDINGS : victory / defeat / warp */
  const FW_COLS = ['#ffd54f', '#62d8ff', '#ff7a8a', '#b898ff', '#9aff9a', '#ffffff', '#ffa050'];
  function fireworks(g, w, h, t, rect, n, seed) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (let s = 0; s < n; s++) {
      const per = 2.8 + h2(s, 1 + seed) * 1.4, ph = (t + h2(s, 2 + seed) * 9) / per, k = floor(ph), age = (ph - k) * per, kk = k * 11 + s + seed;
      const ox = rect.x + (0.1 + 0.8 * h2(kk, 3)) * rect.w, oy = rect.y + (0.1 + 0.8 * h2(kk, 4)) * rect.h, col = FW_COLS[(h2(kk, 5) * FW_COLS.length) | 0], col2 = FW_COLS[(h2(kk, 6) * FW_COLS.length) | 0];
      const launch = 0.75;
      if (age < launch) {
        const u = age / launch, y = lerp(rect.y + rect.h * 1.3, oy, 1 - pow(1 - u, 2)), x = ox + sin(u * 6 + s) * 6 * (1 - u);
        g.strokeStyle = '#ffe9b0'; g.lineWidth = 2; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x - sin(u * 6 + s) * 2, y + 26 * (1 - u * 0.5)); g.stroke(); glowL(g, '#ffe0a0', x, y, 12, 0.8);
        continue;
      }
      const a = age - launch; if (a > 2.3) continue;
      const fade = pow(1 - a / 2.3, 1.5), np = 54, sc = h / 720, gv = 34 * sc, a0 = max(0, a - 0.07);
      const e1 = (1 - exp(-a * 2.3)) / 2.3, e0 = (1 - exp(-a0 * 2.3)) / 2.3;
      g.lineWidth = 1.8; g.strokeStyle = col; g.globalAlpha = fade * 0.95; g.beginPath();
      for (let i = 0; i < np; i++) {
        const ang = i / np * TAU + h2(kk, 20 + i) * 0.1, V = (0.55 + 0.45 * h2(kk, 40 + i)) * 520 * sc * (i % 2 ? 1 : 0.62);
        g.moveTo(ox + cos(ang) * V * e0, oy + sin(ang) * V * e0 + 0.5 * gv * a0 * a0);
        g.lineTo(ox + cos(ang) * V * e1, oy + sin(ang) * V * e1 + 0.5 * gv * a * a);
      }
      g.stroke();
      g.strokeStyle = col2; g.globalAlpha = fade * 0.6; g.beginPath();
      const f1 = (1 - exp(-a * 1.8)) / 1.8, f0 = (1 - exp(-a0 * 1.8)) / 1.8;
      for (let i = 0; i < 24; i++) {
        const ang = i / 24 * TAU + 0.13, V = 290 * sc;
        g.moveTo(ox + cos(ang) * V * f0, oy + sin(ang) * V * f0 + 8 * sc * a0 * a0); g.lineTo(ox + cos(ang) * V * f1, oy + sin(ang) * V * f1 + 8 * sc * a * a);
      }
      g.stroke();
      glowL(g, col, ox, oy, h * 0.3 * (a < 0.25 ? 1 : 0.5) * fade, a < 0.4 ? (0.4 - a) * 1.2 : 0.04);
    }
    g.restore();
  }
  function banner(g, x, y, bw, bh, col, t, seed, gold) {
    const n = 14; g.save();
    g.fillStyle = lgr(g, x, 0, x + bw, 0, [0, dark(col, 0.2), 0.5, lite(col, 0.1), 1, dark(col, 0.5)]);
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i <= n; i++) { const u = i / n, s = sin(t * 1.2 + seed + u * 5) * bw * 0.04 * u; g.lineTo(x + bw + s, y + bh * u); }
    g.lineTo(x + bw / 2 + sin(t * 1.2 + seed + 5) * bw * 0.04, y + bh * 1.08);
    for (let i = n; i >= 0; i--) { const u = i / n, s = sin(t * 1.2 + seed + u * 5) * bw * 0.04 * u; g.lineTo(x + s, y + bh * u); }
    g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = gold || C.brass; g.stroke();
    g.fillStyle = lgr(g, 0, y, 0, y + bh, [0, 'rgba(255,255,255,0.18)', 0.3, 'rgba(255,255,255,0)', 1, 'rgba(0,0,0,0.4)']); g.fill();
    // emblem
    const ex = x + bw / 2 + sin(t * 1.2 + seed + 1.5) * bw * 0.015, ey = y + bh * 0.3, er = bw * 0.26;
    g.fillStyle = gold || C.brassHi; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4, r = i % 2 ? er * 0.45 : er; g.lineTo(ex + cos(a) * r, ey + sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = dark(col, 0.4); g.beginPath(); g.arc(ex, ey, er * 0.28, 0, TAU); g.fill();
    g.fillStyle = gold || C.brass; g.fillRect(x - bw * 0.1, y - 5, bw * 1.2, 6);
    g.restore();
  }
  function crowd(g, w, h, t, y0, rows, col) {
    for (let r = 0; r < rows; r++) {
      const n = 46 + r * 10, yy = y0 + r * h * 0.026, sz = h * (0.03 - r * 0.0035);
      g.fillStyle = mixc(col, '#0a0f30', r * 0.25 + 0.1);
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5 + (h2(i, r + 3) - 0.5) * 0.6) * w / n, bob = sin(t * (2.2 + h2(i, r) * 2) + i * 1.3) * sz * 0.1, ar = h2(i, r + 9) > 0.7;
        g.beginPath(); g.ellipse(x, yy + sz * 1.4 + bob, sz * 0.9, sz * 0.9, 0, PI, TAU); g.fill();
        g.beginPath(); g.arc(x, yy + bob, sz * 0.38, 0, TAU); g.fill();
        if (ar) { g.strokeStyle = g.fillStyle; g.lineWidth = sz * 0.22; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + sz * 0.5, yy + sz * 0.9 + bob); g.lineTo(x + sz * 0.9 + sin(t * 4 + i) * sz * 0.3, yy - sz * 1.0 + bob); g.stroke(); }
      }
    }
  }
  function throneBG(g, w, h, c, o) {
    const col = o.color || '#4a90e8', cx = w * 0.5, R = mulberry32(5), hz = h * 0.58;
    g.fillStyle = lgr(g, 0, 0, 0, hz, [0, '#070b2e', 0.4, '#2a1a64', 0.75, '#b0466a', 1, '#ffb070']); g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; for (let i = 0; i < 120; i++) { g.globalAlpha = (0.2 + R() * 0.6) * (1 - 0.5); g.fillRect(R() * w, R() * hz * 0.7, 1.3, 1.3); } g.globalAlpha = 1;
    g.save(); g.globalCompositeOperation = 'lighter'; glow(g, '#ffb070', cx, hz, w * 0.6, 0.45); g.restore();
    // skyline
    for (const [col2, sc, a] of [['#3a2a5a', 1.0, 0.0], ['#1c1440', 1.35, 1.7]]) {
      let x = -20;
      while (x < w + 20) {
        const bw = w * (0.012 + R() * 0.03), bh = h * (0.04 + R() * 0.16) * sc * (1 - abs(x / w - 0.5) * 0.6);
        g.fillStyle = col2; g.fillRect(x, hz - bh, bw, bh + h * 0.05);
        if (R() < 0.18) { g.beginPath(); g.moveTo(x + bw * 0.5, hz - bh - h * 0.05 * sc); g.lineTo(x + bw * 0.8, hz - bh); g.lineTo(x + bw * 0.2, hz - bh); g.fill(); }
        if (R() < 0.15) { g.beginPath(); g.ellipse(x + bw / 2, hz - bh, bw * 0.7, bw * 0.55, 0, PI, TAU); g.fill(); }
        g.fillStyle = rgba('#ffd890', 0.7 - a * 0.2); for (let k = 0; k < 6; k++) if (R() < 0.5) g.fillRect(x + R() * bw * 0.8, hz - bh + R() * bh, 1.6, 2);
        x += bw + w * 0.002;
      }
    }
    // palace terraces
    g.fillStyle = '#0a0828'; g.fillRect(0, hz + h * 0.02, w, h);
    for (let i = 0; i < 4; i++) {
      const y = hz + h * (0.03 + i * 0.07), wd = w * (0.34 + i * 0.16);
      g.beginPath(); g.moveTo(cx - wd / 2, y + h * 0.07); g.lineTo(cx - wd / 2 + h * 0.02, y); g.lineTo(cx + wd / 2 - h * 0.02, y); g.lineTo(cx + wd / 2, y + h * 0.07); g.closePath();
      g.fillStyle = lgr(g, 0, y, 0, y + h * 0.07, [0, mixc('#3a3470', '#1a1646', i / 4), 1, '#0a0828']); g.fill(); g.lineWidth = 2; g.strokeStyle = rgba(C.brass, 0.7 - i * 0.1); g.stroke();
    }
    // carpet
    g.fillStyle = lgr(g, 0, hz + h * 0.03, 0, h, [0, dark(col, 0.45), 1, col]); g.beginPath(); g.moveTo(cx - w * 0.05, hz + h * 0.03); g.lineTo(cx + w * 0.05, hz + h * 0.03); g.lineTo(cx + w * 0.2, h); g.lineTo(cx - w * 0.2, h); g.closePath(); g.fill();
    g.strokeStyle = rgba(C.brassHi, 0.8); g.lineWidth = 2.5; g.stroke();
    // throne back with sunburst
    g.save(); g.globalCompositeOperation = 'lighter'; sunburst(g, cx, h * 0.38, h * 0.2, h * 0.62, 30, 'rgba(255,214,120,0.3)', 'rgba(255,214,120,0)'); glow(g, '#ffd890', cx, h * 0.38, h * 0.5, 0.35); g.restore();
    const tw = w * 0.2;
    archPath(g, cx - tw, h * 0.14, tw * 2, hz + h * 0.12 - h * 0.14, tw);
    g.fillStyle = brassGrad(g, cx - tw, 0, cx + tw, 0); g.fill();
    archPath(g, cx - tw * 0.86, h * 0.17, tw * 1.72, hz + h * 0.12 - h * 0.17, tw * 0.86);
    g.fillStyle = lgr(g, 0, h * 0.17, 0, hz, [0, dark(col, 0.2), 1, dark(col, 0.65)]); g.fill(); g.lineWidth = 3; g.strokeStyle = rgba('#241a0a', 0.8); g.stroke();
    for (let i = 0; i < 7; i++) { const a = PI + (i + 0.5) * PI / 7; g.fillStyle = i % 2 ? C.cyan : C.rose; g.beginPath(); g.arc(cx + cos(a) * tw * 0.93, h * 0.14 + tw + sin(a) * tw * 0.93, 4.5, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
    const braz = [[cx - w * 0.31, hz + h * 0.1], [cx + w * 0.31, hz + h * 0.1]];
    for (const [x, y] of braz) { g.fillStyle = '#0a0612'; g.fillRect(x - 3, y - h * 0.05, 6, h * 0.1); g.beginPath(); g.moveTo(x - 16, y - h * 0.05); g.lineTo(x + 16, y - h * 0.05); g.lineTo(x + 9, y - h * 0.02); g.lineTo(x - 9, y - h * 0.02); g.closePath(); g.fillStyle = brassGrad(g, x - 16, 0, x + 16, 0); g.fill(); }
    bakeGrain(g, w, h, 0.05);
    return { cx: cx, hz: hz, braz: braz, col: col };
  }
  Scenes.victory = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), col = o.color || '#4a90e8', race = o.race || 'human';
      // photoreal ending: the winner's own council hall with the sovereign standing in it (race council + figure illustrations); the drawn throne room is the fallback
      const WA = G.WorldArt, hallPath = WA ? WA.race(race, 'council') : null;
      if (hallPath && WA.get(hallPath)) {
        // the council plate already shows the sovereign enthroned among the delegates: a slow push-in, a warm wash for a victory, a cold red one for conquest
        artBG(ctx, hallPath, w, h, { fx: 0.5, fy: 0.42, zoom: 1 + 0.05 * sstep(0, 40, t), exposure: WA.raceExposure ? WA.raceExposure(race, 'council') : 1 });
        ctx.fillStyle = o.color === '#b0303a' ? 'rgba(40,6,10,0.3)' : 'rgba(4,6,16,0.22)'; ctx.fillRect(0, 0, w, h);
        const rays = sstep(0.2, 3, t);
        for (let i = 0; i < 2; i++) { const bx = [w * 0.3, w * 0.7][i], sw = sin(t * 0.3 + i * 2) * w * 0.06; beam(ctx, bx, h * 0.75, bx + sw, -h * 0.1, 12, w * 0.07, '#ffe9b0', 0.04 * rays); }
        ctx.fillStyle = lgr(ctx, 0, h * 0.74, 0, h, [0, 'rgba(3,4,12,0)', 1, 'rgba(3,4,12,0.88)']); ctx.fillRect(0, h * 0.74, w, h * 0.26);   // ground for the caption
        finish(ctx, w, h, 0.35, 0.03, t);
        end(ctx);
        const L = { x: w * 0.3, y: h * 0.05, w: w * 0.4, h: h * 0.7 };
        return { sovereign: L, crown: { x: w * 0.44, y: h * 0.02, w: w * 0.12, h: h * 0.08 }, text: { x: w * 0.1, y: h * 0.04, w: w * 0.8, h: h * 0.14 }, bottom: { x: w * 0.1, y: h * 0.8, w: w * 0.8, h: h * 0.15 } };
      }
      if (WA && hallPath) WA.get(hallPath);                                                                  // start loading for the next frame
      const e = layer('victory|' + col, w, h, S, (g, ww, hh, c) => throneBG(g, ww, hh, c, { color: col })), I = e.d;
      ctx.drawImage(e.c, 0, 0, w, h);
      fireworks(ctx, w, h, t, { x: w * 0.04, y: h * 0.05, w: w * 0.92, h: h * 0.4 }, 4, 3);
      // spotlight beams sweeping the sky
      for (let i = 0; i < 3; i++) { const bx = [w * 0.16, w * 0.84, w * 0.5][i], sw = sin(t * 0.5 + i * 2) * w * 0.12; beam(ctx, bx, h * 0.62, bx + sw, -h * 0.1, 18, w * 0.09, i === 2 ? '#ffe9b0' : '#a8c8ff', 0.1); }
      // banners
      for (const [x, k, sc] of [[w * 0.06, 0, 1], [w * 0.2, 1, 0.8], [w * 0.8, 2, 0.8], [w * 0.92, 3, 1]]) banner(ctx, x - w * 0.025 * sc, h * 0.02, w * 0.05 * sc, h * 0.4 * sc, k % 2 ? mixc(col, '#000', 0.2) : col, t, k * 1.3, C.brassHi);
      // braziers
      for (let i = 0; i < I.braz.length; i++) { const [x, y] = I.braz[i]; glow(ctx, '#ffa040', x, y - h * 0.05, h * 0.2, 0.4); flame(ctx, x, y - h * 0.045, h * 0.045, t, i * 4); }
      // the sovereign
      const L = { h: h * 0.62 }; L.w = L.h * 0.8; L.x = w * 0.5 - L.w / 2; L.y = h * 0.64 - L.h * 0.9;
      glow(ctx, '#ffd890', w * 0.5, L.y + L.h * 0.35, L.w * 0.9, 0.2);
      featheredPortrait(ctx, o.race || 'human', L.x, L.y, L.w, L.h, { t: t, mood: 'pleased', talking: false, color: col, bg: false, key: 'victory' }, 0.07, 0, 0.0);
      // crown descends then hovers
      const k = sstep(0.4, 4.2, t), cy0 = lerp(-h * 0.1, L.y + L.h * 0.02, 1 - pow(1 - k, 3)) + (k >= 1 ? sin(t * 1.6) * 3 : 0), cw = L.w * 0.3;
      crownIcon(ctx, w * 0.5, cy0, cw, 1, t);
      if (k > 0.97) { glow(ctx, '#fff0b0', w * 0.5, cy0 - cw * 0.3, cw * 1.8, 0.35 + 0.15 * sin(t * 3)); }
      // dais rail + crowd
      ctx.fillStyle = '#05061a'; ctx.fillRect(0, h * 0.92, w, h * 0.08);
      crowd(ctx, w, h, t, h * 0.9, 2, '#14103a');
      // golden confetti
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 60; i++) { const u = fract(t * (0.08 + h2(i, 1) * 0.1) + h2(i, 2)), x = w * h2(i, 3) + sin(t * 1.5 + i) * 20, y = u * h, a = 0.5 + 0.5 * sin(t * 8 + i); ctx.globalAlpha = a * 0.8; ctx.fillStyle = i % 3 ? '#ffe08a' : '#ffffff'; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); ctx.fillRect(-2, -1, 4, 2); ctx.restore(); }
      ctx.restore();
      finish(ctx, w, h, 0.45, 0.03, t);
      end(ctx);
      return { sovereign: L, crown: { x: w * 0.5 - cw / 2, y: cy0 - cw * 0.6, w: cw, h: cw * 0.6 }, text: { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.14 }, bottom: { x: w * 0.1, y: h * 0.8, w: w * 0.8, h: h * 0.15 } };
    },
  };

  /* defeat: a dying star, a burning homeworld and drifting wreckage */
  const WRECK = (function () {
    const R = mulberry32(99), out = [];
    for (let i = 0; i < 20; i++) {
      const n = 5 + ((R() * 3) | 0), pts = [];
      for (let k = 0; k < n; k++) { const a = k / n * TAU + R() * 0.5, r = 0.5 + R() * 0.7; pts.push(cos(a) * r, sin(a) * r * (0.5 + R() * 0.5)); }
      out.push({ pts: pts, x: R(), y: R(), z: 0.25 + R() * 0.9, sp: 0.4 + R() * 1.2, rot: R() * TAU, rs: (R() - 0.5) * 0.5, sz: 0.012 + R() * 0.03, seed: R() * 99 });
    }
    return out;
  })();
  Scenes.defeat = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), kind = o.focus === 'star' || o.focus === 'planet' ? o.focus : o.kind === 'star' || o.kind === 'planet' ? o.kind : 'both';
      // photoreal defeat: the devastated-world illustration, slow push-in, embers; the drawn dying star is the fallback
      const WA = G.WorldArt, devPath = WA ? WA.event('devastated') : null;
      if (devPath && WA.get(devPath)) {
        artBG(ctx, devPath, w, h, { fx: 0.5, fy: 0.5, zoom: 1 + 0.06 * sstep(0, 30, t) });
        ctx.fillStyle = 'rgba(20,4,6,0.3)'; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 40; i++) { const u = fract(t * (0.04 + h2(i, 1) * 0.05) + h2(i, 2)), x = w * h2(i, 3) + sin(t * 0.8 + i) * 12, y = h * (1 - u), a = sin(u * PI) * (0.4 + 0.4 * sin(t * 6 + i)); ctx.globalAlpha = a * 0.7; glowL(ctx, '#ff7a30', x, y, 2 + h2(i, 4) * 3, 1); }
        ctx.restore();
        ctx.fillStyle = lgr(ctx, 0, h * 0.78, 0, h, [0, 'rgba(6,2,4,0)', 1, 'rgba(6,2,4,0.85)']); ctx.fillRect(0, h * 0.78, w, h * 0.22);
        finish(ctx, w, h, 0.5, 0.035, t);
        end(ctx);
        return { art: true, text: { x: w * 0.1, y: h * 0.04, w: w * 0.8, h: h * 0.14 }, bottom: { x: w * 0.1, y: h * 0.8, w: w * 0.8, h: h * 0.15 } };
      }
      if (devPath) WA.get(devPath);
      const sx = w * (kind === 'planet' ? 0.82 : 0.68), sy = h * (kind === 'planet' ? 0.2 : 0.33), sR = h * (kind === 'star' ? 0.34 : kind === 'planet' ? 0.1 : 0.24);
      const px = w * (kind === 'star' ? 0.14 : 0.24), py = h * (kind === 'star' ? 1.04 : 0.92), pR = h * (kind === 'star' ? 0.2 : kind === 'planet' ? 0.5 : 0.36);
      const e = layer('defeat|' + kind, w, h, S, (g, ww, hh, c) => {
        g.fillStyle = lgr(g, 0, 0, 0, hh, [0, '#0a0206', 0.6, '#1c060c', 1, '#07020a']); g.fillRect(0, 0, ww, hh);
        const bd = backdropCanvas(Math.ceil(ww), Math.ceil(hh), 'defeat', { palette: ['#7a1a1a', '#4a1038', '#a0481a'], intensity: 0.5, stars: 0.5 });
        g.globalAlpha = 0.85; g.drawImage(bd, 0, 0, ww, hh); g.globalAlpha = 1;
        g.save(); g.globalCompositeOperation = 'lighter'; glow(g, '#ff4a20', sx, sy, hh * (kind === 'planet' ? 0.7 : 1.3), 0.5); glow(g, '#ff2a10', sx, sy, hh * 0.5, 0.4); g.restore();
        g.fillStyle = 'rgba(40,0,0,0.25)'; g.fillRect(0, 0, ww, hh);
        const la = atan2(sy - py, sx - px);
        planetStatic(g, { look: 'inferno', seed: 4 }, px, py, pR, c.width / ww, { lightAngle: la });
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ff5a20', 0.35); g.lineWidth = hh * 0.012; g.beginPath(); g.arc(px, py, pR * 1.01, 0, TAU); g.stroke(); glow(g, '#ff5a20', px, py, pR * 1.35, 0.3); g.restore();
        bakeGrain(g, ww, hh, 0.05);
        return null;
      });
      ctx.drawImage(e.c, 0, 0, w, h);
      // the dying star
      const Sp = G.pick('space');
      let ok = false;
      if (Sp && Sp.drawStarSurface) { try { Sp.drawStarSurface(ctx, 'red', sx, sy, sR, t, { dpr: S, spin: 0.01 }); ok = true; } catch (er) { warnOnce('Space.drawStarSurface', er); } }
      if (!ok) { glow(ctx, '#ff5a20', sx, sy, sR * 2.2, 0.8); ctx.fillStyle = rgr(ctx, sx, sy, 0, sR, [0, '#ffd8a0', 0.6, '#ff6a30', 1, '#601008']); ctx.beginPath(); ctx.arc(sx, sy, sR, 0, TAU); ctx.fill(); }
      const th = 0.85 + 0.15 * sin(t * 0.9) + 0.05 * sin(t * 2.3);
      glow(ctx, '#ff3a10', sx, sy, sR * 2.6 * th, 0.2);
      // fires and smoke on the homeworld
      ctx.save(); ctx.beginPath(); ctx.arc(px, py, pR, 0, TAU); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) { const a = -PI * (0.1 + 0.8 * h2(i, 1)), r = pR * (0.35 + 0.6 * h2(i, 2)), fx = px + cos(a) * r, fy = py + sin(a) * r, p = 0.6 + 0.4 * sin(t * (2 + h2(i, 3) * 3) + i); glowL(ctx, '#ff6a20', fx, fy, pR * (0.09 + 0.05 * p), 0.5 * p); }
      ctx.restore();
      ctx.save(); const sm = fogTile(77, 256, '#1a0608', 0.45, 0.8, 0.9, 5, 3);
      for (let i = 0; i < 4; i++) { const u = fract(t * 0.05 + i * 0.25), x = px + pR * (0.2 + 0.5 * h2(i, 5)) + u * w * 0.1, y = py - pR * (0.5 + 0.4 * h2(i, 6)) - u * h * 0.28; ctx.globalAlpha = sin(u * PI) * 0.55; ctx.drawImage(sm, x - h * 0.18, y - h * 0.1, h * 0.36, h * 0.26); }
      ctx.restore();
      // wreckage
      for (const p of WRECK) {
        const x = ((p.x * w * 1.4 + t * p.sp * p.z * w * 0.012) % (w * 1.4)) - w * 0.2, y = p.y * h * 0.9 + sin(t * 0.15 * p.sp + p.seed) * h * 0.03, s = p.sz * h * p.z * 1.6, ang = p.rot + t * p.rs;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.beginPath();
        for (let i = 0; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i] * s, p.pts[i + 1] * s); ctx.closePath();
        ctx.fillStyle = lgr(ctx, -s, -s, s, s, [0, mixc('#6a7488', '#1a1e2a', 1 - p.z * 0.5), 1, '#0a0c14']); ctx.fill();
        ctx.lineWidth = max(1, s * 0.08); ctx.strokeStyle = rgba(cos(ang - 0.6) > 0.2 ? '#ff7a30' : '#2a3040', 0.9); ctx.stroke();
        ctx.restore();
        if (h2(p.seed, 3) > 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowL(ctx, '#ff8a40', x, y, s * 1.6, 0.18 + 0.12 * sin(t * 5 + p.seed)); ctx.restore(); }
      }
      drawShip(ctx, { race: o.race || 'human', hull: 'battleship', x: w * 0.5 + sin(t * 0.05) * 20, y: h * 0.62, size: h * 0.3, angle: 0.5 + t * 0.03, color: '#4a5878', t: t, thrust: 0, damage: 0.9 });
      drawShip(ctx, { race: o.race || 'human', hull: 'cruiser', x: w * 0.82 + cos(t * 0.04) * 10, y: h * 0.74, size: h * 0.16, angle: -2.2 - t * 0.04, color: '#4a5878', t: t, thrust: 0, damage: 0.8, seed: 3 });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff8a40';
      for (let i = 0; i < 70; i++) { const u = fract(t * (0.05 + h2(i, 1) * 0.1) + h2(i, 2)), x = w * h2(i, 3) + sin(t * 0.7 + i) * 18, y = h - u * h * 1.05; ctx.globalAlpha = sin(u * PI) * 0.7; ctx.fillRect(x, y, 1.8, 1.8); }
      ctx.restore();
      ctx.fillStyle = rgr(ctx, w * 0.5, h * 0.5, min(w, h) * 0.3, hypot(w, h) * 0.62, [0, 'rgba(20,0,0,0)', 1, 'rgba(14,0,2,0.75)']); ctx.fillRect(0, 0, w, h);
      finish(ctx, w, h, 0.2, 0.05, t);
      end(ctx);
      return { star: { x: sx, y: sy, r: sR }, planet: { x: px, y: py, r: pR }, text: { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.14 }, bottom: { x: w * 0.1, y: h * 0.8, w: w * 0.8, h: h * 0.15 } };
    },
  };

  /* warp: hyperspace tunnel, o.progress 0..1 (0 = stars begin to streak, ~0.5 = full speed, 1 = white-out) */
  const WARP_STARS = (function () {
    const R = mulberry32(2024), n = 520, d = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) { d[i * 5] = R() * TAU; d[i * 5 + 1] = R(); d[i * 5 + 2] = 0.3 + R() * 0.7; d[i * 5 + 3] = R(); d[i * 5 + 4] = R() < 0.18 ? 1 : R() < 0.5 ? 0 : 2; }
    return { d: d, n: n };
  })();
  Scenes.warp = {
    draw(ctx, w, h, t, o) {
      t = tm(t);
      o = o || {};
      const S = begin(ctx, w, h), p = o.progress != null && isFinite(+o.progress) ? clamp(+o.progress, 0, 1) : fract(t / 4);
      const cx = w * 0.5, cy = h * 0.5, diag = hypot(w, h) * 0.5;
      const sp = sstep(0, 0.32, p) * (1 - 0.35 * sstep(0.82, 1, p)), flash = sstep(0.8, 1, p), inten = 0.25 + 0.75 * sstep(0, 0.2, p);
      const tt = (o.warpTime != null ? o.warpTime : t);
      ctx.fillStyle = '#02030c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rgr(ctx, cx, cy, 0, diag, [0, rgba(mixc('#2a50d8', '#ffffff', flash), 0.55 * inten), 0.15, rgba('#2a2aa8', 0.38 * inten), 0.5, rgba('#14104a', 0.4 * inten), 1, 'rgba(2,3,12,0)']); ctx.fillRect(0, 0, w, h);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // tunnel rings
      for (let i = 0; i < 9; i++) {
        const u = fract(i / 9 - tt * (0.15 + 0.5 * sp)), r = pow(u, 2.4) * diag * 1.15, a = sin(u * PI) * 0.5 * inten * (0.3 + 0.7 * sp);
        ctx.strokeStyle = i % 2 ? '#8a9aff' : '#5ad8ff'; ctx.lineWidth = 1 + u * 7; ctx.globalAlpha = a; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.05, r * 0.82, 0, 0, TAU); ctx.stroke();
      }
      // star streaks
      const d = WARP_STARS.d, cols = ['#ffffff', '#8fd8ff', '#c8a8ff'];
      for (let ci = 0; ci < 3; ci++) {
        for (let wi = 0; wi < 2; wi++) {
          ctx.strokeStyle = cols[ci]; ctx.lineWidth = wi ? 2 : 1; ctx.globalAlpha = (wi ? 0.55 : 0.85) * inten; ctx.beginPath();
          for (let i = 0; i < WARP_STARS.n; i++) {
            if (d[i * 5 + 4] !== ci || ((d[i * 5 + 3] > 0.7) !== (wi === 1))) continue;
            const ang = d[i * 5], z = fract(d[i * 5 + 1] - tt * (0.04 + 0.9 * sp) * d[i * 5 + 2]), r1 = (1 / (z * 5 + 0.12) - 0.19) * diag * 0.11;
            const z0 = min(1, z + (0.01 + 0.2 * sp) * d[i * 5 + 2]), r0 = (1 / (z0 * 5 + 0.12) - 0.19) * diag * 0.11;
            if (r1 > diag * 1.3) continue;
            ctx.moveTo(cx + cos(ang) * r0, cy + sin(ang) * r0 * 0.85); ctx.lineTo(cx + cos(ang) * r1, cy + sin(ang) * r1 * 0.85);
          }
          ctx.stroke();
        }
      }
      // core light + radial rays
      ctx.globalAlpha = 1;
      glow(ctx, '#ffffff', cx, cy, diag * (0.16 + 0.5 * flash), 0.5 + 0.5 * sp);
      glow(ctx, '#7ab0ff', cx, cy, diag * 0.5, 0.35 * inten);
      for (let i = 0; i < 18; i++) { const a = i * TAU / 18 + tt * 0.1, L = diag * (0.4 + 0.6 * sp * h2(i, 3)); ctx.fillStyle = rgba('#9fc8ff', 0.035 * inten); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(a - 0.03) * L, cy + sin(a - 0.03) * L); ctx.lineTo(cx + cos(a + 0.03) * L, cy + sin(a + 0.03) * L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = rgr(ctx, cx, cy, diag * 0.45, diag * 1.02, [0, 'rgba(0,0,10,0)', 1, 'rgba(0,0,10,0.7)']); ctx.fillRect(0, 0, w, h);
      if (flash > 0) { ctx.fillStyle = 'rgba(245,250,255,' + flash * flash + ')'; ctx.fillRect(0, 0, w, h); }
      finish(ctx, w, h, 0, 0.03, t);
      end(ctx);
      return { center: { x: cx, y: cy }, progress: p };
    },
  };
  Scenes.ending = {
    draw(ctx, w, h, t, o) {
      t = tm(t); o = o || {}; const k = Scenes[o.kind] && ['victory', 'defeat', 'warp'].indexOf(o.kind) >= 0 ? o.kind : 'victory'; return Scenes[k].draw(ctx, w, h, t, o); },
    victory: Scenes.victory, defeat: Scenes.defeat, warp: Scenes.warp,
  };

  /* v2 colour grade: every scene's draw() is followed by the shared grade pass (opt out per call with o.grade === false) */
  const GRADE = { audience: 'room', council: 'room', newsroom: 'room', lab: 'scene', surface: 'scene', battle: 'space', victory: 'scene', defeat: 'scene', warp: 'space' };
  Object.keys(GRADE).forEach(function (name) {
    const sc = Scenes[name]; if (!sc || !sc.draw) return; const raw = sc.draw;
    sc.draw = function (ctx, w, h, t, o) {
      const GR = G.Grade; if (GR) GR.depth = (GR.depth || 0) + 1;
      let r; try { r = raw.apply(this, arguments); } finally { if (GR) GR.depth--; }
      if (!(o && o.grade === false) && G.Grade) { try { G.Grade.apply(ctx, w, h, t || 0, (r && r.grade) || GRADE[name]); } catch (e) { warnOnce('Grade', e); } }   // r.grade: a scene drawn on an illustrated plate asks for a lighter pass
      return r;
    };
  });
  Scenes.SCENE_NAMES = ['lab', 'council', 'newsroom', 'audience', 'surface', 'battle', 'victory', 'defeat', 'warp'];
  Scenes.draw = function (name, ctx, w, h, t, o) {
    const s = Scenes[name];
    if (!s || typeof s.draw !== 'function') throw new Error('Scenes.draw: unknown scene "' + name + '"');
    return s.draw(ctx, w, h, t || 0, o || {});
  };
  Scenes.RACES = RACE_IDS;
  Scenes.config = CONFIG;
  Scenes.clearCache = function () { CACHE.forEach((e) => { e.c.width = e.c.height = 1; }); CACHE.clear(); _bytes = 0; };
  G.Scenes = Scenes;
})(window.MOO);
