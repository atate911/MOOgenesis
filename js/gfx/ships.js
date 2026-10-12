/* ============================================================================
   Master of Orion — Reborn · js/gfx/ships.js
   MOO.Gfx.Ships — race-styled procedural spaceships, stations and fleet markers.
   Top-down, pseudo-3D shaded vector art generated entirely in code (original art).

   Pipeline
     1. A "Painter" (shading toolkit: bevelled plates, tubes, domes, seams, glows) paints each
        race's hull into an offscreen canvas, lit from the upper-left (8 light buckets so the
        light stays put while the ship rotates).
     2. The result is cached per (race, hull, size bucket, team colour, add-on flags, light bucket).
     3. Per frame only the dynamic layers are drawn: engine flames, blinking lights, emissive
        pulse, damage sparks/smoke, shield shimmer, cloak shimmer.
   Self-contained: no dependency on other MOO modules except the MOO.Gfx namespace.
   ========================================================================== */
(function (M) {
  'use strict';

  // ==========================================================================
  // 1. helpers
  // ==========================================================================
  const PI = Math.PI, TAU = PI * 2;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, atan2 = Math.atan2, hypot = Math.hypot;
  const floor = Math.floor, ceil = Math.ceil, round = Math.round, min = Math.min, max = Math.max;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function fract(x) { return x - floor(x); }

  const colorMemo = new Map();
  function parseColor(c) {
    if (Array.isArray(c)) return c;
    c = String(c || '');
    let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c);
    if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16)];
    m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(c);
    if (m) return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    let r = colorMemo.get(c);
    if (r) return r;
    r = [98, 216, 255];
    try { // named / hsl() colours: let the canvas normalise them
      const g = mk(1, 1).getContext('2d');
      g.fillStyle = '#62d8ff'; g.fillStyle = c;
      const n = /^#([0-9a-f]{6})$/i.exec(g.fillStyle);
      if (n) { const v = parseInt(n[1], 16); r = [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
    } catch (err) { /* keep default */ }
    if (colorMemo.size > 200) colorMemo.clear();
    colorMemo.set(c, r);
    return r;
  }
  const SPACE = [7, 9, 26];
  function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  // k>0 → toward warm white, k<0 → toward the blue-black of space
  function tone(c, k) { return k >= 0 ? mixc(c, [255, 248, 236], k) : mixc(c, SPACE, -k); }
  function rgba(c, a) { return 'rgba(' + ((c[0] + 0.5) | 0) + ',' + ((c[1] + 0.5) | 0) + ',' + ((c[2] + 0.5) | 0) + ',' + (a === undefined ? 1 : a) + ')'; }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = max(1, w | 0); c.height = max(1, h | 0);
    return c;
  }
  function flipY(pts) { const o = new Array(pts.length); for (let i = 0; i < pts.length; i++) o[i] = (i & 1) ? -pts[i] : pts[i]; return o; }
  // half outline (axis → axis, y ≥ 0) → closed symmetric loop
  function symPts(half) {
    const n = half.length / 2, out = half.slice();
    for (let i = n - 2; i >= 1; i--) out.push(half[2 * i], -half[2 * i + 1]);
    return out;
  }
  function scalePts(pts, sx, sy) { const o = new Array(pts.length); for (let i = 0; i < pts.length; i += 2) { o[i] = pts[i] * sx; o[i + 1] = pts[i + 1] * (sy === undefined ? sx : sy); } return o; }


  // dense Catmull-Rom sampling of an open polyline (flat array), `seg` samples per span
  function crPts(pts, seg) {
    const out = [], n = pts.length / 2;
    for (let i = 0; i < n - 1; i++) {
      const i0 = max(i - 1, 0), i2 = i + 1, i3 = min(i + 2, n - 1);
      for (let j = 0; j < seg; j++) {
        const t = j / seg, t2 = t * t, t3 = t2 * t;
        for (let c = 0; c < 2; c++) {
          const p0 = pts[2 * i0 + c], p1 = pts[2 * i + c], p2 = pts[2 * i2 + c], p3 = pts[2 * i3 + c];
          out.push(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
        }
      }
    }
    out.push(pts[2 * (n - 1)], pts[2 * (n - 1) + 1]);
    return out;
  }
  // half-width of a half-outline (flat [x,y,...] ordered from the bow to the stern) at x
  function halfAt(half, x) {
    for (let i = 0; i < half.length - 2; i += 2) {
      const xa = half[i], xb = half[i + 2];
      if ((x <= xa && x >= xb) || (x >= xa && x <= xb)) { const t = xa === xb ? 0 : (x - xa) / (xb - xa); return lerp(half[i + 1], half[i + 3], t); }
    }
    return 0;
  }

  // ---- shared soft sprites (tiny, created once) ---------------------------------
  const glowCache = new Map();
  function glowSprite(col) { // radial blob: hot white core → tint → clear
    const key = ((col[0] | 0) << 16) | ((col[1] | 0) << 8) | (col[2] | 0);
    let c = glowCache.get(key);
    if (c) return c;
    c = mk(64, 64);
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.1, rgba(tone(col, 0.6), 0.95));
    gr.addColorStop(0.32, rgba(col, 0.52));
    gr.addColorStop(0.68, rgba(col, 0.13));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache.set(key, c);
    return c;
  }
  const flameCache = new Map();
  function flameSprite(eng) { // 128×40 teardrop, nozzle at the right edge
    const key = eng.map(function (c) { return ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0); }).join('/');
    let c = flameCache.get(key);
    if (c) return c;
    const W = 128, H = 40;
    c = mk(W, H);
    const g = c.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    function drop(len, hh, col, a, blur) {
      const lg = g.createLinearGradient(W, 0, W - len, 0);
      lg.addColorStop(0, rgba(col, a)); lg.addColorStop(0.45, rgba(col, a * 0.6)); lg.addColorStop(1, rgba(col, 0));
      g.save();
      g.shadowColor = rgba(col, a * 0.8); g.shadowBlur = blur;
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(W - 3, H / 2 - hh);
      g.bezierCurveTo(W - len * 0.5, H / 2 - hh, W - len * 0.82, H / 2 - hh * 0.3, W - len, H / 2);
      g.bezierCurveTo(W - len * 0.82, H / 2 + hh * 0.3, W - len * 0.5, H / 2 + hh, W - 3, H / 2 + hh);
      g.closePath(); g.fill(); g.restore();
    }
    drop(W - 14, 15, eng[2], 0.5, 8);
    drop(W * 0.78, 10, eng[1], 0.8, 5);
    drop(W * 0.5, 5.5, eng[0], 1, 3);
    flameCache.set(key, c);
    return c;
  }
  let smokeSpr = null;
  function smokeSprite() {
    if (smokeSpr) return smokeSpr;
    const c = mk(64, 64), g = c.getContext('2d');
    const r = rng(77);
    for (let i = 0; i < 9; i++) {
      const x = 32 + (r() - 0.5) * 20, y = 32 + (r() - 0.5) * 20, rad = 12 + r() * 12;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(70,72,84,0.34)'); gr.addColorStop(1, 'rgba(70,72,84,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    smokeSpr = c;
    return c;
  }

  // ==========================================================================
  // 2. constants & public tables
  // ==========================================================================
  const RACES = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  const RACE_NAMES = {
    alkari: 'Alkari', bulrathi: 'Bulrathi', darlok: 'Darlok', human: 'Human', klackon: 'Klackon',
    meklar: 'Meklar', mrrshan: 'Mrrshan', psilon: 'Psilon', sakkra: 'Sakkra', silicoid: 'Silicoid'
  };
  const HULLS = [
    { id: 0, key: 'frigate', name: 'Frigate', length: 1 },
    { id: 1, key: 'destroyer', name: 'Destroyer', length: 1.45 },
    { id: 2, key: 'cruiser', name: 'Cruiser', length: 2.1 },
    { id: 3, key: 'battleship', name: 'Battleship', length: 3.0 },
    { id: 4, key: 'doomstar', name: 'Doomstar', length: 4.4 }
  ];
  const STRUCTURES = ['starbase', 'battlestation', 'starfortress', 'stargate'];
  const FLAG = { colony: 1, troops: 2, beams: 4, missiles: 8, bomb: 16 };
  function flagMask(f) {
    if (typeof f === 'number') return f | 0;
    if (!f) return 0;
    return (f.colony ? 1 : 0) | (f.troops ? 2 : 0) | ((f.beams || f.beam) ? 4 : 0) | (f.missiles ? 8 : 0) | (f.bomb ? 16 : 0);
  }
  // key light: upper-left, in screen space
  const LIGHT = (function () { const x = -0.56, y = -0.83, l = hypot(x, y); return { x: x / l, y: y / l }; })();
  const LIGHT_BUCKETS = 8;
  function lightFor(b, nb) { // light direction expressed in the sprite's own frame (sprite will be drawn rotated by b*TAU/nb)
    const a = b * TAU / nb, c = cos(a), s = sin(a);
    return { x: LIGHT.x * c + LIGHT.y * s, y: -LIGHT.x * s + LIGHT.y * c };
  }
  function lightBucket(angle, nb) { return ((round((((angle % TAU) + TAU) % TAU) / TAU * nb)) % nb + nb) % nb; }

  const DESIGNS = {};   // race → { pal, hw[5], ex, build(P, h), struct }
  const STRUCT_DEF = {}; // filled in the stations section

  function resolvePal(p) {
    const o = {};
    for (const k in p) {
      const v = p[k];
      o[k] = Array.isArray(v) ? v.map(parseColor) : parseColor(v);
    }
    return o;
  }

  // ==========================================================================
  // 3. the Painter — shaded vector toolkit (all geometry in ship-length units,
  //    +x = bow, origin = ship centre; light comes from this.L / this.Ld)
  // ==========================================================================
  const NO = {};
  const EDGE = [5, 7, 20];

  function Painter(g, gg, S, Ld, pal, team, seed, cx, cy, quality) {
    this.g = g; this.gg = gg; this.S = S; this.Ld = Ld; this.L = Ld;
    this.pal = pal; this.team = team; this.rnd = rng(seed); this.cx = cx; this.cy = cy;
    this.q = quality || 1;
    this.meta = {
      eng: [], lights: [], glow: false, shapes: [],
      hard: { turret: [], rack: [], pod: [], troop: [], bay: [] }
    };
  }
  const PP = Painter.prototype;

  // local point → sprite-unit coordinates under the current transform
  PP.u = function (x, y) {
    const m = this.g.getTransform();
    return [(m.a * x + m.c * y + m.e - this.cx) / this.S, (m.b * x + m.d * y + m.f - this.cy) / this.S];
  };
  PP.at = function (x, y, a, fn) {
    const g = this.g, gg = this.gg, sL = this.L;
    g.save(); g.translate(x, y); g.rotate(a);
    gg.save(); gg.translate(x, y); gg.rotate(a);
    const c = cos(a), s = sin(a);
    this.L = { x: sL.x * c + sL.y * s, y: -sL.x * s + sL.y * c };
    fn.call(this);
    this.L = sL;
    g.restore(); gg.restore();
  };
  PP.rot = function (a, fn) { this.at(0, 0, a, fn); };
  PP.both = function (fn) { fn(+1); fn(-1); };               // mirror helper: fn(s) with s = ±1
  PP.clipTo = function (sh, fn) { const g = this.g; g.save(); g.clip(sh.p); fn.call(this); g.restore(); };

  // ---- shape constructors ------------------------------------------------------
  PP.poly = function (pts) {
    const p = new Path2D();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      if (i) p.lineTo(x, y); else p.moveTo(x, y);
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    p.closePath();
    return { p: p, x0: x0, y0: y0, x1: x1, y1: y1 };
  };
  // Catmull-Rom through pts (flat array). closed → smooth loop.
  PP.curve = function (pts, closed, tn) {
    const p = new Path2D(), n = pts.length / 2, k = (tn === undefined ? 1 : tn) / 6;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) {
      const x = pts[2 * i], y = pts[2 * i + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    p.moveTo(pts[0], pts[1]);
    const cnt = closed ? n : n - 1;
    for (let i = 0; i < cnt; i++) {
      let i0 = i - 1, i1 = i, i2 = i + 1, i3 = i + 2;
      if (closed) { i0 = (i0 + n) % n; i2 %= n; i3 %= n; } else { i0 = max(i0, 0); i3 = min(i3, n - 1); }
      const ax = pts[2 * i0], ay = pts[2 * i0 + 1], bx = pts[2 * i1], by = pts[2 * i1 + 1];
      const cx = pts[2 * i2], cy = pts[2 * i2 + 1], dx = pts[2 * i3], dy = pts[2 * i3 + 1];
      p.bezierCurveTo(bx + (cx - ax) * k, by + (cy - ay) * k, cx - (dx - bx) * k, cy - (dy - by) * k, cx, cy);
    }
    if (closed) p.closePath();
    const m = 0.006;
    return { p: p, x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
  };
  PP.ell = function (cx, cy, rx, ry, rot) {
    const p = new Path2D(), r = rot || 0, c = cos(r), s = sin(r);
    p.ellipse(cx, cy, rx, ry, r, 0, TAU);
    const hx = sqrt(rx * rx * c * c + ry * ry * s * s), hy = sqrt(rx * rx * s * s + ry * ry * c * c);
    return { p: p, x0: cx - hx, y0: cy - hy, x1: cx + hx, y1: cy + hy };
  };
  PP.rect = function (x, y, w, h) { return this.poly([x, y, x + w, y, x + w, y + h, x, y + h]); };
  PP.cham = function (x, y, w, h, c) { // chamfered rectangle
    c = min(c, w / 2, h / 2);
    return this.poly([x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c]);
  };
  PP.sector = function (a0, a1, ri, ro) {
    const p = new Path2D();
    p.arc(0, 0, ro, a0, a1, false); p.arc(0, 0, ri, a1, a0, true); p.closePath();
    const xs = [cos(a0) * ri, cos(a0) * ro, cos(a1) * ri, cos(a1) * ro], ys = [sin(a0) * ri, sin(a0) * ro, sin(a1) * ri, sin(a1) * ro];
    for (let q = ceil(a0 / (PI / 2)); q * PI / 2 <= a1; q++) { xs.push(cos(q * PI / 2) * ro); ys.push(sin(q * PI / 2) * ro); }
    return { p: p, x0: min.apply(null, xs), x1: max.apply(null, xs), y0: min.apply(null, ys), y1: max.apply(null, ys) };
  };
  PP.annulus = function (ri, ro) {
    const p = new Path2D();
    p.arc(0, 0, ro, 0, TAU); p.moveTo(ri, 0); p.arc(0, 0, ri, 0, TAU, true);
    return { p: p, x0: -ro, y0: -ro, x1: ro, y1: ro, eo: true };
  };
  PP.line = function (pts, closed) { // open path "shape" (for strokes/clips)
    const p = new Path2D();
    for (let i = 0; i < pts.length; i += 2) { if (i) p.lineTo(pts[i], pts[i + 1]); else p.moveTo(pts[0], pts[1]); }
    if (closed) p.closePath();
    return p;
  };

  // ---- lighting primitives -------------------------------------------------------
  // soft shadow of `sh` cast away from the light (drawn under the real fill)
  // (the shape itself is drawn far off-canvas; only its shadow lands in view, so gaps stay clear)
  PP.drop = function (sh, d, a) {
    const g = this.g, S = this.S, Ld = this.Ld, m = g.getTransform(), T = -5;
    g.save();
    g.shadowColor = rgba(SPACE, a === undefined ? 0.5 : a);
    g.shadowBlur = d * S * 1.7;
    g.shadowOffsetX = -Ld.x * d * S - m.a * T; g.shadowOffsetY = -Ld.y * d * S - m.b * T;
    g.translate(T, 0);
    g.fillStyle = '#000';
    g.fill(sh.p, sh.eo ? 'evenodd' : 'nonzero');
    g.restore();
  };
  // inner shadow/highlight clipped to the shape (offset in device direction = Ld)
  PP.inset = function (sh, color, dx, dy, blur) {
    const g = this.g, S = this.S, m = blur * 3 + 0.01 + abs(dx) + abs(dy);
    g.save();
    g.clip(sh.p, sh.eo ? 'evenodd' : 'nonzero');
    g.shadowColor = color; g.shadowBlur = blur * S; g.shadowOffsetX = dx * S; g.shadowOffsetY = dy * S;
    const big = new Path2D();
    big.rect(sh.x0 - m, sh.y0 - m, sh.x1 - sh.x0 + 2 * m, sh.y1 - sh.y0 + 2 * m);
    big.addPath(sh.p);
    g.fillStyle = '#000';
    g.fill(big, 'evenodd');
    g.restore();
  };
  PP.note = function (sh) {
    const a = (sh.x1 - sh.x0) * (sh.y1 - sh.y0);
    if (a > 0.0022 && this.meta.shapes.length < 80) {
      const u = this.u((sh.x0 + sh.x1) / 2, (sh.y0 + sh.y1) / 2);
      this.meta.shapes.push([u[0], u[1], a, (sh.x1 - sh.x0) / 2, (sh.y1 - sh.y0) / 2]);
    }
  };

  // main workhorse: gradient fill + bevel highlights/shadows + outline
  //   o: lift (drop shadow depth), k (contrast), bev (bevel width), hi/sh (bevel strengths), rim (far-edge rim light),
  //      edge (outline alpha), flat, raw (custom fillStyle), a (alpha), gs (gradient scale)
  PP.fill = function (sh, base, o) {
    o = o || NO;
    const g = this.g, L = this.L, S = this.S, Ld = this.Ld;
    const w = sh.x1 - sh.x0, h = sh.y1 - sh.y0;
    const a = o.a === undefined ? 1 : o.a;
    if (o.lift) this.drop(sh, o.lift, o.liftA === undefined ? 0.5 : o.liftA);
    if (o.raw) g.fillStyle = o.raw;
    else if (o.flat) g.fillStyle = rgba(base, a);
    else {
      const cx = (sh.x0 + sh.x1) * 0.5, cy = (sh.y0 + sh.y1) * 0.5;
      // keep the light ramp across the short axis so long hulls don't simply fade end-to-end
      let dx = L.x, dy = L.y;
      if (w > h * 1.3) dx *= clamp(h / w * 1.6, 0.18, 1); else if (h > w * 1.3) dy *= clamp(w / h * 1.6, 0.18, 1);
      const dl = hypot(dx, dy) || 1;
      dx /= dl; dy /= dl;
      const ext = min(w / (2 * abs(dx) + 0.02), h / (2 * abs(dy) + 0.02)) * (o.gs || 1);
      const k = o.k === undefined ? 1 : o.k;
      const gr = g.createLinearGradient(cx + dx * ext, cy + dy * ext, cx - dx * ext, cy - dy * ext);
      gr.addColorStop(0, rgba(tone(base, 0.3 * k), a));
      gr.addColorStop(0.5, rgba(base, a));
      gr.addColorStop(1, rgba(tone(base, -0.5 * k), a));
      g.fillStyle = gr;
    }
    const rule = sh.eo ? 'evenodd' : 'nonzero';
    g.fill(sh.p, rule);
    if (o.round) this.roundShade(sh, o.round, o.ra);
    if (o.skin) this.skin(sh, o.skin === true ? NO : o.skin);
    const bev = min(o.bev === undefined ? 0.013 : o.bev, min(w, h) * 0.3);
    if (bev * S >= 0.6) {
      if (o.hi !== 0) this.inset(sh, rgba(tone(base, 0.72), 0.5 * (o.hi === undefined ? 1 : o.hi)), -Ld.x * bev, -Ld.y * bev, bev * 1.2);
      if (o.sh !== 0) this.inset(sh, rgba(SPACE, 0.5 * (o.sh === undefined ? 1 : o.sh)), Ld.x * bev * 1.2, Ld.y * bev * 1.2, bev * 1.7);
      const rim = o.rim === undefined ? (bev * S >= 2.2 ? 0.3 : 0) : o.rim;
      if (rim) this.inset(sh, rgba(o.rimC || [130, 175, 255], rim), Ld.x * bev * 0.55, Ld.y * bev * 0.55, bev * 0.45);
    }
    if (o.edge !== 0) {
      g.lineWidth = max(o.ew || 0.0032, 0.85 / S); g.lineJoin = 'round';
      g.strokeStyle = rgba(o.ec || EDGE, o.edge === undefined ? 0.62 : o.edge);
      g.stroke(sh.p);
    }
    if (!o.nonote) this.note(sh);
  };

  // cylindrical cross-section shading across the shape's local y extent (hull reads as a rounded fuselage)
  PP.roundShade = function (sh, k, axis) {
    const g = this.g, L = this.L;
    g.save();
    g.clip(sh.p, sh.eo ? 'evenodd' : 'nonzero');
    const horiz = axis === 'x';
    const lc = horiz ? L.x : L.y;
    const gr = horiz ? g.createLinearGradient(sh.x0, 0, sh.x1, 0) : g.createLinearGradient(0, sh.y0, 0, sh.y1);
    const pk = clamp(0.5 + lc * 0.17, 0.3, 0.7);
    gr.addColorStop(0, rgba(SPACE, 0.5 * k));
    gr.addColorStop(0.16 * pk * 2, rgba(SPACE, 0.12 * k));
    gr.addColorStop(pk, 'rgba(255,250,240,' + 0.2 * k + ')');
    gr.addColorStop(pk + (1 - pk) * 0.5, rgba(SPACE, 0.14 * k));
    gr.addColorStop(1, rgba(SPACE, 0.6 * k));
    g.fillStyle = gr;
    g.fillRect(sh.x0 - 0.01, sh.y0 - 0.01, sh.x1 - sh.x0 + 0.02, sh.y1 - sh.y0 + 0.02);
    g.restore();
  };
  // procedural plating: tinted brick-pattern panels + engraved seams, clipped to the shape
  //   o: cw/ch (panel size), tint (tint strength), seam (seam alpha)
  PP.skin = function (sh, o) {
    const g = this.g, S = this.S, L = this.L, r = this.rnd;
    const w = sh.x1 - sh.x0, h = sh.y1 - sh.y0;
    const cw = o.cw || 0.075, ch = o.ch || 0.05;
    if (min(cw, ch) * S < 5) return;
    const ny = max(1, round(h / ch)), ta = o.tint === undefined ? 0.1 : o.tint, sa = o.seam === undefined ? 0.34 : o.seam;
    g.save();
    g.clip(sh.p, sh.eo ? 'evenodd' : 'nonzero');
    const lines = [];
    for (let j = 0; j < ny; j++) {
      const y0 = sh.y0 + j * h / ny, y1 = sh.y0 + (j + 1) * h / ny;
      let x = sh.x0 - r() * cw;
      while (x < sh.x1) {
        const nx = x + cw * (0.6 + r() * 0.9), v = r();
        if (v > 0.45) {
          g.fillStyle = v < 0.78 ? 'rgba(255,255,255,' + (ta * (0.35 + r() * 0.65)).toFixed(3) + ')' : 'rgba(6,8,22,' + (ta * (0.5 + r() * 0.9)).toFixed(3) + ')';
          g.fillRect(x, y0, nx - x, y1 - y0);
        }
        lines.push(nx, y0, nx, y1);
        x = nx;
      }
      if (j) lines.push(sh.x0, y0, sh.x1, y0);
    }
    g.lineCap = 'butt';
    const lw = max(0.0022, 0.8 / S);
    g.beginPath();
    for (let i = 0; i < lines.length; i += 4) { g.moveTo(lines[i], lines[i + 1]); g.lineTo(lines[i + 2], lines[i + 3]); }
    g.lineWidth = lw; g.strokeStyle = rgba(SPACE, sa); g.stroke();
    g.save();
    g.translate(-L.x * lw * 1.2, -L.y * lw * 1.2);
    g.lineWidth = lw * 0.8; g.strokeStyle = 'rgba(255,255,255,' + (sa * 0.3).toFixed(3) + ')'; g.stroke();
    g.restore();
    g.restore();
  };

  // lit cylinder / strut / pylon between two points
  PP.tube = function (x1, y1, x2, y2, r1, r2, base, o) {
    o = o || NO;
    const g = this.g, L = this.L, S = this.S;
    const dx = x2 - x1, dy = y2 - y1, len = hypot(dx, dy) || 1e-6;
    const nx = -dy / len, ny = dx / len, an = atan2(ny, nx);
    const p = new Path2D();
    p.moveTo(x1 + nx * r1, y1 + ny * r1);
    p.lineTo(x2 + nx * r2, y2 + ny * r2);
    if (o.cap2) p.arc(x2, y2, r2, an, an - PI, true); else p.lineTo(x2 - nx * r2, y2 - ny * r2);
    p.lineTo(x1 - nx * r1, y1 - ny * r1);
    if (o.cap1) p.arc(x1, y1, r1, an + PI, an, true);
    p.closePath();
    const rm = max(r1, r2);
    const sh = { p: p, x0: min(x1, x2) - rm, y0: min(y1, y2) - rm, x1: max(x1, x2) + rm, y1: max(y1, y2) + rm };
    if (o.lift) this.drop(sh, o.lift, o.liftA);
    const s = (nx * L.x + ny * L.y) >= 0 ? 1 : -1;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, rr = (r1 + r2) / 2;
    const gr = g.createLinearGradient(mx + nx * s * rr, my + ny * s * rr, mx - nx * s * rr, my - ny * s * rr);
    const k = o.k === undefined ? 1 : o.k, a = o.a === undefined ? 1 : o.a;
    gr.addColorStop(0, rgba(tone(base, 0.1 * k), a));
    gr.addColorStop(0.2, rgba(tone(base, 0.45 * k), a));
    gr.addColorStop(0.52, rgba(base, a));
    gr.addColorStop(0.86, rgba(tone(base, -0.52 * k), a));
    gr.addColorStop(1, rgba(tone(base, -0.3 * k), a));
    g.fillStyle = gr; g.fill(p);
    if (o.edge !== 0) {
      g.lineWidth = max(o.ew || 0.003, 0.85 / S); g.lineJoin = 'round';
      g.strokeStyle = rgba(EDGE, o.edge === undefined ? 0.6 : o.edge); g.stroke(p);
    }
    if (!o.nonote) this.note(sh);
  };

  // lit dome / ball (ellipse with focus offset toward the light)
  PP.dome = function (cx, cy, rx, ry, rot, base, o) {
    o = o || NO;
    const g = this.g, L = this.L, S = this.S, r = rot || 0, c = cos(r), s = sin(r);
    const sh = this.ell(cx, cy, rx, ry, r);
    if (o.lift) this.drop(sh, o.lift, o.liftA);
    const lx = L.x * c + L.y * s, ly = -L.x * s + L.y * c;   // light in the ellipse's own frame
    const k = o.k === undefined ? 1 : o.k, a = o.a === undefined ? 1 : o.a;
    g.save();
    g.translate(cx, cy); g.rotate(r); g.scale(rx, ry);
    const gr = g.createRadialGradient(lx * 0.4, ly * 0.4, 0.03, lx * 0.12, ly * 0.12, 1.04);
    gr.addColorStop(0, rgba(tone(base, 0.72 * k), a));
    gr.addColorStop(0.22, rgba(tone(base, 0.34 * k), a));
    gr.addColorStop(0.58, rgba(base, a));
    gr.addColorStop(0.9, rgba(tone(base, -0.5 * k), a));
    gr.addColorStop(1, rgba(tone(base, -0.35 * k), a));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
    if (o.edge !== 0) {
      g.lineWidth = max(o.ew || 0.003, 0.85 / S); g.strokeStyle = rgba(EDGE, o.edge === undefined ? 0.6 : o.edge); g.stroke(sh.p);
    }
    if (o.spec !== 0) this.glint(cx + L.x * rx * 0.42, cy + L.y * ry * 0.42, rx * 0.36, ry * 0.26, atan2(L.y, L.x) + PI / 2, o.spec === undefined ? 0.55 : o.spec);
    if (!o.nonote) this.note(sh);
    return sh;
  };

  // additive highlight blob
  PP.glint = function (x, y, rx, ry, rot, a) {
    const g = this.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(x, y); g.rotate(rot || 0); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(0.4, 'rgba(255,255,255,' + a * 0.3 + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
  };
  // engraved panel line (dark groove + lit lip)
  PP.seam = function (pts, w, a, closed) {
    const g = this.g, L = this.L;
    w = w || 0.0032; a = a === undefined ? 0.5 : a;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = this.line(pts, closed);
    g.lineWidth = max(w, 0.7 / this.S); g.strokeStyle = rgba(SPACE, a); g.stroke(path);
    g.translate(-L.x * w * 1.1, -L.y * w * 1.1);
    g.lineWidth = max(w * 0.7, 0.5 / this.S); g.strokeStyle = 'rgba(255,255,255,' + (a * 0.32) + ')'; g.stroke(path);
    g.restore();
  };
  PP.stroke = function (pts, w, col, a, closed) { // plain polyline
    const g = this.g;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = max(w, 0.6 / this.S); g.strokeStyle = rgba(col, a === undefined ? 1 : a); g.stroke(this.line(pts, closed));
    g.restore();
  };
  PP.rivet = function (x, y, r, base) {
    if (r * this.S < 0.7) return;
    const g = this.g, L = this.L;
    g.fillStyle = rgba(SPACE, 0.55); g.beginPath(); g.arc(x - L.x * r * 0.5, y - L.y * r * 0.5, r, 0, TAU); g.fill();
    g.fillStyle = rgba(tone(base || [190, 150, 120], 0.1)); g.beginPath(); g.arc(x, y, r * 0.86, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x + L.x * r * 0.3, y + L.y * r * 0.3, r * 0.34, 0, TAU); g.fill();
  };
  PP.rivets = function (x0, y0, x1, y1, n, r, base) {
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); this.rivet(lerp(x0, x1, t), lerp(y0, y1, t), r, base); }
  };
  // little lit window row (static) — a few of them are registered as blinking lights
  PP.windows = function (x0, y0, x1, y1, n, w, h, col, dim) {
    const g = this.g;
    if (w * this.S < 0.9) return;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      const lit = (dim && this.rnd() < dim) ? 0.22 : 1;
      g.fillStyle = rgba(SPACE, 0.7); g.fillRect(x - w * 0.62, y - h * 0.62, w * 1.24, h * 1.24);
      g.fillStyle = rgba(col, 0.95 * lit); g.fillRect(x - w / 2, y - h / 2, w, h);
    }
  };
  // glowing spot that is baked statically AND registered for per-frame animation
  //   kind: 'blink' | 'pulse' | 'steady'
  PP.light = function (x, y, r, col, kind, per, ph, big) {
    const g = this.g;
    g.save();
    g.fillStyle = rgba(tone(col, 0.35), 0.95); g.beginPath(); g.arc(x, y, r * 0.55, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.drawImage(glowSprite(col), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
    g.restore();
    const u = this.u(x, y);
    this.meta.lights.push({ x: u[0], y: u[1], r: r * (big || 1), c: col, kind: kind || 'blink', per: per || 1.6, ph: ph === undefined ? this.rnd() : ph });
  };
  // glowing line (baked dim + registered on the glow layer, which pulses per frame)
  PP.strip = function (pts, w, col, a, closed) {
    a = a === undefined ? 1 : a;
    const g = this.g, gg = this.gg, S = this.S;
    this.meta.glow = true;
    const path = this.line(pts, closed);
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalCompositeOperation = 'lighter';
    g.lineWidth = w * 3.6; g.strokeStyle = rgba(col, 0.16 * a); g.stroke(path);
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = max(w, 0.8 / S); g.strokeStyle = rgba(tone(col, 0.35), 0.9 * a); g.stroke(path);
    g.restore();
    gg.save();
    gg.lineCap = 'round'; gg.lineJoin = 'round';
    gg.lineWidth = w * 3.2; gg.strokeStyle = rgba(col, 0.38 * a); gg.stroke(path);
    gg.lineWidth = w * 1.2; gg.strokeStyle = rgba(tone(col, 0.7), 0.75 * a); gg.stroke(path);
    gg.restore();
  };
  // soft emissive blob (baked + glow layer)
  PP.emit = function (x, y, rx, ry, rot, col, a) {
    a = a === undefined ? 1 : a;
    this.meta.glow = true;
    const ctxs = [this.g, this.gg];
    for (let i = 0; i < 2; i++) {
      const g = ctxs[i], k = i ? 1 : 0.55;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.translate(x, y); g.rotate(rot || 0); g.scale(rx, ry);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, rgba(tone(col, 0.7), a * k)); gr.addColorStop(0.3, rgba(col, 0.6 * a * k)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
      g.restore();
    }
  };

  // leaf-shaped feather / blade: base (x,y), direction ang, length, max width.  o: tip (colour), lift, shape
  PP.feather = function (x, y, ang, len, wid, base, o) {
    o = o || NO;
    this.at(x, y, ang, function () {
      const n = 12, pts = [], sp = o.shape || 0.7;
      const hwf = function (t) { return wid * 0.5 * (0.18 + 0.82 * sin(PI * Math.pow(t, sp))); };
      for (let i = 0; i <= n; i++) { const t = i / n; pts.push(t * len, -hwf(t)); }
      for (let i = n; i >= 0; i--) { const t = i / n; pts.push(t * len, hwf(t)); }
      const sh = this.poly(pts), g = this.g;
      this.fill(sh, base, { lift: o.lift === undefined ? 0.006 : o.lift, bev: wid * 0.1, round: 0.55, rim: 0.2, nonote: !!o.nonote });
      if (o.band) this.clipTo(sh, function () { g.fillStyle = rgba(o.band[2], 0.95); g.fillRect(o.band[0] * len, -wid, (o.band[1] - o.band[0]) * len, wid * 2); });
      if (o.tip) {
        this.clipTo(sh, function () {
          const gr = g.createLinearGradient(len * 0.5, 0, len, 0);
          gr.addColorStop(0, rgba(o.tip, 0)); gr.addColorStop(0.55, rgba(o.tip, 0.55)); gr.addColorStop(1, rgba(o.tip, 0.97));
          g.fillStyle = gr; g.fillRect(len * 0.5, -wid, len * 0.5, wid * 2);
        });
      }
      this.stroke([len * 0.05, 0, len * 0.93, 0], max(wid * 0.035, 0.0018), SPACE, 0.4);
      const nb = (len / (wid * 0.5)) | 0;
      for (let i = 1; i < nb; i++) {
        const t = i / nb, xx = t * len, w2 = hwf(t) * 0.9;
        this.stroke([xx, 0, xx + w2 * 0.9, -w2, xx, 0, xx + w2 * 0.9, w2], max(wid * 0.02, 0.0012), SPACE, 0.16);
      }
    });
  };
  // flat-shaded polygon lit as a 3-D facet; vertices [x, y, z] (z = height above the hull plane); normal from the first three
  PP.facetPoly = function (v, base, o) {
    o = o || NO;
    const L = this.L, a = v[0], b = v[1], c = v[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const lz = 0.58, lh = sqrt(1 - lz * lz);
    const d = nx * L.x * lh + ny * L.y * lh + nz * lz;
    const col = tone(base, clamp((d - 0.58) * (o.k || 1.5), -(o.loMax || 0.6), o.hiMax || 0.62));
    const pts = [];
    for (let i = 0; i < v.length; i++) pts.push(v[i][0], v[i][1]);
    const sh = this.poly(pts);
    this.fill(sh, col, { flat: true, a: o.a, bev: o.bev === undefined ? 0.004 : o.bev, edge: o.edge === undefined ? 0.5 : o.edge, ew: 0.0026, hi: 0.5, sh: 0.5, rim: 0, nonote: o.nonote });
    return sh;
  };
  PP.facet = function (a, b, c, base, o) { return this.facetPoly([a, b, c], base, o); };
  // hexagonal crystal prism with a pyramid tip, from base centre (x0,y0) to tip (x1,y1); w = full width
  PP.prism = function (x0, y0, x1, y1, w, base, o) {
    o = o || NO;
    const dx = x1 - x0, dy = y1 - y0, len = hypot(dx, dy) || 1e-6, ax = dx / len, ay = dy / len, nx = -ay, ny = ax;
    const tl = min(len * 0.5, w * (o.tip || 1.2)), sl = len - tl, zt = w * 0.6 * (o.z || 1);
    const lat = [-0.5, -0.17, 0.17, 0.5], hz = [0, zt, zt, 0], B = [], S = [];
    for (let i = 0; i < 4; i++) {
      B.push([x0 + nx * lat[i] * w, y0 + ny * lat[i] * w, hz[i]]);
      S.push([x0 + ax * sl + nx * lat[i] * w, y0 + ay * sl + ny * lat[i] * w, hz[i]]);
    }
    const T = [x1, y1, zt * 0.55];
    if (o.lift !== false) {
      this.drop(this.poly([B[0][0], B[0][1], S[0][0], S[0][1], x1, y1, S[3][0], S[3][1], B[3][0], B[3][1]]), o.lift || 0.012, 0.5);
    }
    const fo = { k: o.k || 1.7, hiMax: o.hiMax || 0.6, loMax: o.loMax || 0.5, a: o.a, edge: o.edge === undefined ? 0.55 : o.edge, nonote: o.nonote };
    for (let i = 0; i < 3; i++) this.facetPoly([B[i], B[i + 1], S[i + 1], S[i]], base, fo);
    for (let i = 0; i < 3; i++) this.facetPoly([S[i], S[i + 1], T], base, fo);
    // glinting edges
    const g = this.g;
    g.save(); g.lineCap = 'round'; g.strokeStyle = rgba(o.edgeC || [225, 255, 250], o.edgeA === undefined ? 0.55 : o.edgeA); g.lineWidth = max(w * 0.025, 0.002);
    g.beginPath();
    g.moveTo(S[1][0], S[1][1]); g.lineTo(T[0], T[1]); g.moveTo(S[2][0], S[2][1]); g.lineTo(T[0], T[1]);
    g.moveTo(B[1][0], B[1][1]); g.lineTo(S[1][0], S[1][1]); g.moveTo(B[2][0], B[2][1]); g.lineTo(S[2][0], S[2][1]);
    g.stroke(); g.restore();
    return { sx: x0 + ax * sl, sy: y0 + ay * sl, ax: ax, ay: ay, nx: nx, ny: ny };
  };
  // double-terminated hexagonal crystal centred at (cx,cy), axis angle rot, length len, full width w
  PP.gem = function (cx, cy, rot, len, w, base, o) {
    o = o || NO;
    this.at(cx, cy, rot, function () {
      const tf = min(w * (o.tf || 1.35), len * 0.46), tr = min(w * (o.tr || 0.85), len * 0.3), zt = w * 0.6 * (o.z || 1);
      const lat = [-0.5, -0.17, 0.17, 0.5], hz = [0, zt, zt, 0];
      const R = [-len / 2, 0, zt * 0.55], F = [len / 2, 0, zt * 0.55], S0 = [], S1 = [];
      for (let i = 0; i < 4; i++) { S0.push([-len / 2 + tr, lat[i] * w, hz[i]]); S1.push([len / 2 - tf, lat[i] * w, hz[i]]); }
      if (o.lift !== false) this.drop(this.poly([R[0], 0, S0[0][0], S0[0][1], S1[0][0], S1[0][1], F[0], 0, S1[3][0], S1[3][1], S0[3][0], S0[3][1]]), o.lift || 0.012, 0.5);
      const rr = this.rnd;
      const fo = function (v) { return { k: o.k || 1.8, hiMax: 0.6, loMax: 0.52, a: o.a, edge: o.edge === undefined ? 0.55 : o.edge, nonote: o.nonote, bev: min(0.004, w * 0.05) }; };
      const tint = function () { return tone(base, (rr() - 0.5) * 0.18); };
      for (let i = 0; i < 3; i++) this.facetPoly([S0[i], S0[i + 1], S1[i + 1], S1[i]], tint(), fo());
      for (let i = 0; i < 3; i++) this.facetPoly([R, S0[i + 1], S0[i]], tint(), fo());
      for (let i = 0; i < 3; i++) this.facetPoly([S1[i], S1[i + 1], F], tint(), fo());
      const g = this.g;
      g.save(); g.lineCap = 'round'; g.strokeStyle = rgba([228, 255, 250], 0.55); g.lineWidth = max(w * 0.022, 0.0018);
      g.beginPath();
      g.moveTo(S0[1][0], S0[1][1]); g.lineTo(S1[1][0], S1[1][1]); g.moveTo(S0[2][0], S0[2][1]); g.lineTo(S1[2][0], S1[2][1]);
      g.moveTo(S1[1][0], S1[1][1]); g.lineTo(F[0], F[1]); g.moveTo(S1[2][0], S1[2][1]); g.lineTo(F[0], F[1]);
      g.moveTo(S0[1][0], S0[1][1]); g.lineTo(R[0], R[1]); g.moveTo(S0[2][0], S0[2][1]); g.lineTo(R[0], R[1]);
      g.stroke();
      g.strokeStyle = rgba([255, 255, 255], 0.35); g.lineWidth = max(w * 0.012, 0.0012);
      g.beginPath(); g.moveTo(S0[0][0], S0[0][1]); g.lineTo(S1[0][0], S1[0][1]); g.lineTo(F[0], F[1]); g.stroke();
      g.restore();
    });
  };
  PP.custom = function (fn, x0, y0, x1, y1) { const p = new Path2D(); fn(p); return { p: p, x0: x0, y0: y0, x1: x1, y1: y1 }; };

  // ---- anchors ------------------------------------------------------------------
  // flame anchor only (no art) — for organic / slit exhausts drawn by the design itself
  PP.engAt = function (x, y, r) { const u = this.u(x, y); this.meta.eng.push({ x: u[0], y: u[1], r: r }); };
  PP.hard = function (kind, x, y, r, extra) {
    const u = this.u(x, y), e = { x: u[0], y: u[1], r: r };
    if (extra) for (const k in extra) e[k] = extra[k];
    this.meta.hard[kind].push(e);
  };
  PP.hardSym = function (kind, x, y, r, extra) { this.hard(kind, x, y, r, extra); if (abs(y) > 1e-4) this.hard(kind, x, -y, r, extra); };
  // engine bell at x (rear end), pointing -x. Registers a flame anchor.
  PP.engine = function (x, y, r, o) {
    o = o || NO;
    const g = this.g, len = o.len || r * 1.7, flare = o.flare === undefined ? 1.12 : o.flare;
    const eng = this.pal.eng;
    const sh = this.poly([x + len, y - r * 0.82, x + len * 0.2, y - r * 0.98 * flare, x, y - r * flare, x, y + r * flare, x + len * 0.2, y + r * 0.98 * flare, x + len, y + r * 0.82]);
    this.fill(sh, o.mat || this.pal.dark, { bev: r * 0.2, lift: o.lift === undefined ? 0.004 : o.lift, nonote: true });
    // glowing throat
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x + r * 0.5, 0, x - r * 0.05, 0);
    gr.addColorStop(0, rgba(eng[2], 0)); gr.addColorStop(0.5, rgba(eng[1], 0.8)); gr.addColorStop(1, rgba(eng[0], 1));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x + r * 0.5, y - r * 0.62); g.lineTo(x, y - r * 0.82 * flare); g.lineTo(x, y + r * 0.82 * flare); g.lineTo(x + r * 0.5, y + r * 0.62); g.closePath(); g.fill();
    g.restore();
    const u = this.u(x, y);
    this.meta.eng.push({ x: u[0], y: u[1], r: r * (o.fr || 1) });
  };

  // ==========================================================================
  // 4. add-ons (colony pod, troop pods, turrets, missile racks, bomb bay)
  // ==========================================================================
  function drawAddons(P, mask, h) {
    const H = P.meta.hard, pal = P.pal, g = P.g, tm = P.team;
    if (!mask) return;
    const nT = [2, 2, 4, 6, 8][h], nR = [2, 2, 2, 4, 4][h], nP = [2, 2, 2, 4, 4][h];
    const hullMid = pal.base;

    if ((mask & 16) && H.bay.length) {
      const b = H.bay[0], l = b.r, w = b.w || b.r * 0.55;
      const sh = P.cham(b.x - l, b.y - w, 2 * l, 2 * w, w * 0.28);
      P.fill(sh, [26, 28, 38], { bev: w * 0.18, lift: 0.004 });
      P.clipTo(sh, function () {
        const n = 8, step = 2 * l / n;
        for (let i = 0; i < n; i += 2) {
          g.fillStyle = rgba(tm, 0.9);
          g.beginPath();
          g.moveTo(b.x - l + i * step, b.y + w); g.lineTo(b.x - l + (i + 1) * step, b.y + w);
          g.lineTo(b.x - l + (i + 1) * step + w * 0.9, b.y - w); g.lineTo(b.x - l + i * step + w * 0.9, b.y - w);
          g.closePath(); g.fill();
        }
      });
      P.fill(P.cham(b.x - l * 0.78, b.y - w * 0.62, l * 1.56, w * 1.24, w * 0.2), [14, 16, 24], { bev: w * 0.14, edge: 0.8 });
      P.seam([b.x, b.y - w * 0.62, b.x, b.y + w * 0.62], 0.0032, 0.8);
      P.light(b.x - l * 0.9, b.y, w * 0.14, [255, 70, 60], 'blink', 0.9, 0.2);
    }
    if ((mask & 2) && H.troop.length) {
      for (let i = 0; i < min(nP, H.troop.length); i++) {
        const t = H.troop[i], r = t.r;
        const sh = P.cham(t.x - r * 1.15, t.y - r * 0.8, r * 2.3, r * 1.6, r * 0.45);
        P.fill(sh, [96, 108, 84], { bev: r * 0.2, lift: 0.006 });
        P.clipTo(sh, function () { g.fillStyle = 'rgba(235,240,225,0.75)'; g.fillRect(t.x - r * 0.1, t.y - r * 0.9, r * 0.28, r * 1.8); g.fillStyle = rgba(tm, 0.9); g.fillRect(t.x + r * 0.55, t.y - r * 0.9, r * 0.2, r * 1.8); });
        P.seam([t.x - r * 0.62, t.y - r * 0.5, t.x - r * 0.62, t.y + r * 0.5], 0.0028, 0.6);
        P.dome(t.x - r * 0.15, t.y, r * 0.28, r * 0.28, 0, [60, 70, 58], { edge: 0.5, nonote: true });
      }
    }
    if ((mask & 1) && H.pod.length) {
      const d = H.pod[0], r = d.r;
      P.fill(P.cham(d.x - r * 0.55, d.y - r * 1.12, r * 1.1, r * 2.24, r * 0.25), [70, 78, 92], { bev: r * 0.1, lift: 0.006 });
      P.dome(d.x, d.y, r * 1.28, r, 0, [196, 214, 204], { lift: 0.014, liftA: 0.55 });
      P.clipTo(P.ell(d.x, d.y, r * 1.28, r, 0), function () {
        P.stroke([d.x - r * 0.3, d.y - r, d.x - r * 0.3, d.y + r], 0.004, [60, 80, 70], 0.55);
        P.stroke([d.x + r * 0.4, d.y - r, d.x + r * 0.4, d.y + r], 0.004, [60, 80, 70], 0.55);
      });
      P.dome(d.x + r * 0.08, d.y, r * 0.55, r * 0.46, 0, [96, 214, 140], { a: 0.9, edge: 0.4, nonote: true });
      P.emit(d.x + r * 0.08, d.y, r * 0.62, r * 0.5, 0, [110, 255, 160], 0.55);
      g.strokeStyle = rgba(tm, 0.95); g.lineWidth = max(r * 0.12, 0.003); g.beginPath(); g.ellipse(d.x, d.y, r * 1.06, r * 0.82, 0, 0, TAU); g.stroke();
    }
    if ((mask & 8) && H.rack.length) {
      for (let i = 0; i < min(nR, H.rack.length); i++) {
        const k = H.rack[i], r = k.r;
        P.fill(P.cham(k.x - r * 1.5, k.y - r * 0.95, r * 2.5, r * 1.9, r * 0.25), [44, 48, 60], { bev: r * 0.14, lift: 0.005 });
        for (let j = -1; j <= 1; j++) {
          P.tube(k.x - r * 1.2, k.y + j * r * 0.58, k.x + r * 0.75, k.y + j * r * 0.58, r * 0.2, r * 0.2, [214, 220, 228], { edge: 0.5, nonote: true });
          const cone = P.poly([k.x + r * 0.75, k.y + j * r * 0.58 - r * 0.2, k.x + r * 1.3, k.y + j * r * 0.58, k.x + r * 0.75, k.y + j * r * 0.58 + r * 0.2]);
          P.fill(cone, [226, 70, 58], { bev: r * 0.05, nonote: true });
        }
      }
    }
    if ((mask & 4) && H.turret.length) {
      for (let i = 0; i < min(nT, H.turret.length); i++) {
        const k = H.turret[i], r = k.r;
        const tb = pal.dark;
        P.tube(k.x, k.y - r * 0.38, k.x + r * 2.1, k.y - r * 0.38, r * 0.2, r * 0.17, tb, { edge: 0.6, nonote: true, lift: 0.003 });
        P.tube(k.x, k.y + r * 0.38, k.x + r * 2.1, k.y + r * 0.38, r * 0.2, r * 0.17, tb, { edge: 0.6, nonote: true, lift: 0.003 });
        P.dome(k.x, k.y, r * 1.08, r * 1.08, 0, tone(pal.base, -0.25), { lift: 0.008, liftA: 0.55, spec: 0.4, nonote: true });
        P.dome(k.x, k.y, r * 0.66, r * 0.66, 0, tone(pal.light, -0.05), { edge: 0.5, spec: 0.5, nonote: true });
        g.fillStyle = rgba(tm, 0.9); g.beginPath(); g.arc(k.x - r * 0.15, k.y, r * 0.16, 0, TAU); g.fill();
      }
    }
  }

  // ==========================================================================
  // 5. race designs
  // ==========================================================================
  // ---------------------------------------------------------------- HUMAN
  // classic aerodynamic, modular: silver/white plates, swept delta wings, blue-white engines
  DESIGNS.human = {
    pal: { base: '#b9c5d9', light: '#ecf1fa', dark: '#53607a', deep: '#252d45', eng: ['#ffffff', '#86c8ff', '#3070ff'], glow: '#9bd6ff', win: '#ffe6a0' },
    hw: [0.30, 0.34, 0.40, 0.47, 0.54],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const bw = [0.07, 0.08, 0.092, 0.108, 0.125][h];
      const span = [0.16, 0.19, 0.2, 0.22, 0.26][h];
      const wingMat = mixc(pal.base, pal.dark, 0.36);
      const plate = function (half, col, o) { return P.fill(P.poly(symPts(half)), col, o); };

      // ---- nacelles + engines (behind the wings) ----
      const nacY = [[], [bw + span * 0.92], [bw + span * 0.92], [bw + span * 0.5, bw + span * 1.0], [bw + span * 0.38, bw + span * 0.72, bw + span * 1.0]][h];
      const nacR = [0, 0.026, 0.034, 0.038, 0.044][h];
      nacY.forEach(function (ny, i) {
        const x1 = (i === nacY.length - 1 ? -0.02 : -0.06 + i * 0.05), x2 = -0.42 - i * 0.012, r = nacR * (1 - i * 0.06);
        P.both(function (s) {
          const y = s * ny;
          P.tube(x1, y, x2, y, r * 0.78, r, pal.base, { lift: 0.012, liftA: 0.5, cap1: true });
          P.tube(x2 + (x1 - x2) * 0.42, y, x2 + (x1 - x2) * 0.5, y, r * 0.93, r * 0.95, tm, { edge: 0.3, nonote: true });
          P.dome(x1 + r * 0.25, y, r * 1.1, r * 0.8, 0, pal.light, { edge: 0.5, nonote: true });
          P.engine(x2 - r * 0.15, y, r * 0.86, { len: r * 1.8 });
          P.hard('rack', x1 + (x2 - x1) * 0.28 + 0.16, y + s * r * 1.7, r * 0.5);
        });
      });

      // ---- wings ----
      P.both(function (s) {
        const wp = P.poly([0.13, s * bw * 0.7, -0.27, s * (bw + span), -0.37, s * (bw + span * 0.97), -0.43, s * (bw + span * 0.2), -0.43, s * bw * 0.6]);
        P.fill(wp, wingMat, { lift: 0.014, bev: 0.011, skin: { cw: 0.1, ch: 0.07 } });
        P.clipTo(wp, function () {
          // team livery band along the wing
          g.fillStyle = rgba(tm, 0.92);
          g.beginPath(); g.moveTo(-0.07, s * (bw + span * 0.46)); g.lineTo(-0.26, s * (bw + span * 0.97)); g.lineTo(-0.3, s * (bw + span * 0.95)); g.lineTo(-0.13, s * (bw + span * 0.4)); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.14)'; g.beginPath(); g.moveTo(0.13, s * bw * 0.7); g.lineTo(-0.27, s * (bw + span)); g.lineTo(-0.2, s * (bw + span * 0.98)); g.lineTo(0.13, s * bw * 0.9); g.closePath(); g.fill();
        });
        P.seam([-0.02, s * (bw + span * 0.12), -0.34, s * (bw + span * 0.8)], 0.003, 0.5);
        P.seam([-0.2, s * bw * 0.9, -0.38, s * (bw + span * 0.5)], 0.003, 0.45);
        P.light(-0.31, s * (bw + span * 0.93), 0.008, s > 0 ? [60, 255, 130] : [255, 60, 60], 'steady');
      });

      // ---- fuselage: four bolted modules ----
      plate([-0.24, 0, -0.24, bw * 0.97, -0.31, bw * 1.0, -0.44, bw * 0.82, -0.475, bw * 0.55, -0.475, 0], mixc(pal.base, pal.dark, 0.18), { lift: 0.008, round: 0.8, skin: true });
      plate([0.08, 0, 0.08, bw, 0.0, bw * 1.07, -0.15, bw * 1.07, -0.24, bw * 0.98, -0.24, 0], pal.base, { lift: 0.008, round: 0.8, skin: true });
      plate([0.3, 0, 0.3, bw * 0.6, 0.17, bw * 0.92, 0.08, bw, 0.08, 0], pal.light, { lift: 0.008, round: 0.7, skin: true });
      plate([0.5, 0, 0.46, 0.013, 0.37, bw * 0.34, 0.3, bw * 0.6, 0.3, 0], mixc(pal.base, pal.light, 0.4), { lift: 0.008, round: 0.9 });
      // livery stripes + panel lines
      P.both(function (s) {
        P.fill(P.rect(-0.22, s * bw * 0.5 - 0.009, 0.28, 0.018), tm, { bev: 0.004, edge: 0.3, nonote: true });
        P.seam([0.0, s * bw * 0.98, 0.0, s * bw * 0.1], 0.003, 0.5);
        P.seam([-0.12, s * bw * 1.02, -0.12, s * bw * 0.1], 0.003, 0.4);
        P.windows(0.27, s * bw * 0.46, 0.12, s * bw * 0.72, 4, 0.011, 0.007, pal.win, 0.25);
      });
      P.seam([-0.31, bw * 0.95, -0.31, -bw * 0.95], 0.0035, 0.55);
      // dorsal spine + bridge
      P.tube(-0.2, 0, 0.1, 0, bw * 0.17, bw * 0.17, pal.light, { lift: 0.005, nonote: true });
      P.dome(0.19, 0, 0.056 + h * 0.006, 0.04 + h * 0.004, 0, [96, 138, 186], { lift: 0.01, liftA: 0.55 });
      P.windows(0.2, -0.026, 0.2, 0.026, 3, 0.009, 0.006, pal.win);
      P.light(-0.2, 0, 0.007, [255, 255, 255], 'blink', 1.7, 0.1);
      P.light(0.1, bw * 0.4, 0.006, tone(tm, 0.3), 'pulse', 2.4, 0.3);
      P.light(0.1, -bw * 0.4, 0.006, tone(tm, 0.3), 'pulse', 2.4, 0.8);

      // ---- class-specific features ----
      if (h >= 1) { // dorsal modules
        P.fill(P.cham(-0.12, -bw * 0.5, 0.15, bw, 0.012), pal.dark, { lift: 0.006, bev: 0.008 });
        P.seam([-0.075, -bw * 0.5, -0.075, bw * 0.5], 0.003, 0.6);
      }
      if (h >= 2) { // sponson pods
        P.both(function (s) {
          P.tube(-0.18, s * bw * 1.22, 0.04, s * bw * 1.22, 0.022, 0.016, pal.base, { lift: 0.008, cap2: true });
          P.rivets(-0.17, s * bw * 1.22, 0.02, s * bw * 1.22, 4, 0.003, pal.light);
        });
      }
      if (h >= 3) {
        P.both(function (s) {
          P.fill(P.cham(0.12, s * bw * 0.4 - 0.025, 0.12, 0.05, 0.01), pal.dark, { lift: 0.006, bev: 0.007 });
          P.dome(0.0, s * bw * 0.62, 0.026, 0.026, 0, pal.light, { lift: 0.008, nonote: true });
          P.hardSym('turret', -0.2, bw * 0.95, 0.017);
        });
      }
      if (h === 4) {
        // planet-cracker prongs converging on a focal emitter
        P.both(function (s) {
          P.tube(0.0, s * 0.2, 0.46, s * 0.07, 0.03, 0.012, pal.base, { lift: 0.014, cap2: true });
          P.tube(0.0, s * 0.2, 0.3, s * 0.12, 0.017, 0.017, tm, { nonote: true, edge: 0.3 });
          for (let i = 0; i < 5; i++) P.seam([0.06 + i * 0.075, s * (0.18 - i * 0.025) - 0.03, 0.06 + i * 0.075, s * (0.18 - i * 0.025) + 0.03], 0.003, 0.55);
          P.strip([0.1, s * 0.19, 0.46, s * 0.07], 0.003, [150, 210, 255], 0.9);
        });
        P.emit(0.49, 0, 0.1, 0.1, 0, [160, 215, 255], 1);
        P.dome(0.49, 0, 0.032, 0.032, 0, [220, 240, 255], { lift: 0.005, spec: 0.7 });
        P.strip([0.46, 0.07, 0.49, 0, 0.46, -0.07], 0.004, [190, 230, 255], 1);
        P.hardSym('turret', 0.0, 0.28, 0.02); P.hardSym('turret', -0.16, 0.34, 0.02);
        P.hardSym('turret', 0.04, 0.12, 0.018);
      }

      // ---- rear engines on the fuselage ----
      const er = [0.026, 0.03, 0.034, 0.04, 0.05][h];
      if (h === 0) { P.engine(-0.46, bw * 0.45, er); P.engine(-0.46, -bw * 0.45, er); }
      else { P.engine(-0.465, 0, er * 1.15); P.engine(-0.455, bw * 0.62, er * 0.8); P.engine(-0.455, -bw * 0.62, er * 0.8); }
      if (h >= 4) { P.engine(-0.45, bw * 1.0, er * 0.7); P.engine(-0.45, -bw * 1.0, er * 0.7); }

      // ---- hardpoints for add-ons ----
      P.hardSym('turret', 0.02, bw * 0.55, 0.016); P.hardSym('turret', -0.2, bw * 0.55, 0.016);
      P.hardSym('turret', 0.22, bw * 0.32, 0.014); P.hardSym('turret', -0.3, bw * 0.4, 0.014);
      P.hard('pod', -0.12, 0, bw * 0.85);
      P.hardSym('troop', -0.02, bw * 1.38, 0.022);
      P.hardSym('rack', -0.14, bw + span * 0.36, 0.017);
      P.hard('bay', -0.33, 0, 0.055, { w: bw * 0.4 });
    }
  };

  // ---------------------------------------------------------------- ALKARI
  // avian: forward-swept layered feather wings, fan tails, beaked prow; orange / cream
  DESIGNS.alkari = {
    pal: { base: '#e8782a', light: '#fff0d6', dark: '#8a3510', deep: '#4a1c08', gold: '#ffc45a', eng: ['#ffffff', '#ffc468', '#ff6a1c'], glow: '#ffb458', win: '#fff0b8' },
    hw: [0.34, 0.41, 0.48, 0.56, 0.7],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const nW = [3, 5, 7, 9, 13][h], wl = [0.27, 0.34, 0.41, 0.49, 0.58][h], nT = [2, 3, 3, 5, 7][h];
      const k = [0.8, 0.9, 1.0, 1.15, 1.35][h];
      const orange = pal.base, dark = pal.dark, cream = pal.light, gold = pal.gold;

      // tail fan (outer feathers first so the middle ones sit on top)
      const tails = [];
      for (let i = 0; i < nT; i++) tails.push(nT === 1 ? 0 : (i / (nT - 1) - 0.5) * 2);
      tails.sort(function (a, b) { return abs(b) - abs(a); });
      tails.forEach(function (kk) {
        const ang = PI + kk * (0.16 + nT * 0.03), len = (0.2 + (1 - abs(kk)) * 0.1) * (0.85 + h * 0.08);
        P.feather(-0.25, kk * 0.03 * k, ang, len, 0.07 * k, mixc(orange, dark, 0.12 + abs(kk) * 0.25), { tip: cream });
      });
      // lower wing layer (bigger, darker) on the large classes
      if (h >= 3) {
        P.both(function (s) {
          const n = nW - 2;
          for (let i = n - 1; i >= 0; i--) {
            const f = i / (n - 1), a = lerp(0.37, 0.64, f) * PI;
            P.feather(lerp(0.02, -0.22, f), s * 0.05 * k, s * a, wl * 1.12 * lerp(1, 0.58, f), 0.09 * k, mixc(orange, dark, 0.5 + f * 0.1), { tip: gold, lift: 0.004 });
          }
        });
      }
      // radiant crown behind the head (doomstar)
      if (h === 4) {
        for (let i = 0; i < 11; i++) {
          const a = PI + (i / 10 - 0.5) * 2.3;
          P.feather(0.16, 0, a, 0.2, 0.05, mixc(gold, cream, i % 2 ? 0.25 : 0), { tip: cream, nonote: true });
        }
      }
      // main wing: forward-swept, trailing feathers first
      P.both(function (s) {
        for (let i = nW - 1; i >= 0; i--) {
          const f = nW === 1 ? 0 : i / (nW - 1), a = lerp(0.3, 0.57, f) * PI;
          const len = wl * lerp(1, 0.6, Math.pow(f, 0.85));
          const base = mixc(orange, dark, f * 0.32 + (i % 2) * 0.06);
          P.feather(lerp(0.07, -0.2, f), s * (0.045 * k + f * 0.012), s * a, len, 0.078 * k * lerp(1, 0.85, f), base,
            { tip: cream, band: i % 2 === 0 && i < nW - 1 ? [0.42, 0.52, tm] : null });
        }
        const nc = max(2, nW - 1);
        for (let i = nc - 1; i >= 0; i--) {
          const f = i / (nc - 1), a = lerp(0.34, 0.6, f) * PI;
          P.feather(lerp(0.06, -0.18, f), s * 0.05 * k, s * a, wl * 0.42 * lerp(1, 0.75, f), 0.06 * k, mixc(orange, cream, 0.38), { tip: cream, lift: 0.004, nonote: true });
        }
      });
      // wing-root engine pods
      if (h >= 2) {
        P.both(function (s) {
          const y = s * (0.11 * k);
          P.tube(-0.08, y, -0.24, y, 0.018 * k, 0.022 * k, mixc(orange, cream, 0.25), { lift: 0.01, cap1: true });
          P.engine(-0.255, y, 0.02 * k, { len: 0.035 });
          P.hard('rack', -0.04, y + s * 0.045, 0.016 * k);
        });
      }
      // plump torso, slim neck, bird head
      const half = [0.1, 0, 0.08, 0.05 * k, 0.0, 0.082 * k, -0.1, 0.094 * k, -0.2, 0.082 * k, -0.3, 0.058 * k, -0.4, 0.03 * k, -0.46, 0];
      const body = P.curve(symPts(half), true);
      P.fill(body, mixc(orange, cream, 0.3), { lift: 0.012, round: 0.9, bev: 0.012, sh: 0.7 });
      P.clipTo(body, function () {
        for (let x = 0.06; x > -0.44; x -= 0.034) P.stroke([x, 0, x - 0.028, -0.1 * k, x, 0, x - 0.028, 0.1 * k], 0.0028, dark, 0.3);
      });
      P.stroke([0.08, 0, -0.44, 0], 0.003, dark, 0.35);
      P.tube(0.07, 0, 0.27, 0, 0.034 * k, 0.027 * k, mixc(orange, cream, 0.2), { lift: 0.008, nonote: true });
      P.stroke([0.2, 0.02 * k, 0.2, -0.02 * k], 0.003, dark, 0.35); P.stroke([0.13, 0.025 * k, 0.13, -0.025 * k], 0.003, dark, 0.3);
      // head: beak, eyes, crest, canopy
      P.dome(0.32, 0, 0.075 * k, 0.056 * k, 0, mixc(orange, cream, 0.35), { lift: 0.01, liftA: 0.5, spec: 0.6 });
      P.fill(P.poly([0.56, 0, 0.42, 0.028 * k, 0.385, 0, 0.42, -0.028 * k]), gold, { lift: 0.006, bev: 0.006 });
      P.stroke([0.52, 0, 0.41, 0], 0.003, dark, 0.5);
      P.dome(0.04, 0, 0.046 * k, 0.03 * k, 0, [255, 196, 110], { lift: 0.008, liftA: 0.5, spec: 0.7 });
      P.both(function (s) {
        P.fill(P.ell(0.345, s * 0.032 * k, 0.017, 0.011 * k, s * 0.3), [255, 240, 190], { flat: true, bev: 0.002, edge: 0.6, nonote: true });
        P.light(0.345, s * 0.032 * k, 0.007 * k, [255, 240, 190], 'steady');
        if (h >= 1) P.feather(0.28, s * 0.03 * k, PI - s * 0.42, 0.13 * k, 0.04 * k, mixc(gold, cream, 0.1), { tip: cream, nonote: true });
      });
      if (h >= 1) P.fill(P.rect(-0.14, -0.014 * k, 0.12, 0.028 * k), tm, { bev: 0.004, edge: 0.3, nonote: true });
      P.light(-0.2, 0, 0.006, [255, 255, 255], 'blink', 1.9, 0.3);
      if (h === 4) {
        P.emit(0.0, 0, 0.16, 0.16, 0, [255, 190, 90], 0.8);
        P.dome(-0.04, 0, 0.055, 0.055, 0, [255, 218, 140], { lift: 0.006, spec: 0.8 });
        P.strip([0.43, 0, 0.5, 0], 0.004, [255, 220, 150], 1);
      }
      // tail engines
      const er = 0.02 * k;
      P.engine(-0.395, 0.03 * k, er, { len: er * 1.3 }); P.engine(-0.395, -0.03 * k, er, { len: er * 1.3 });
      if (h >= 3) { P.engine(-0.41, 0, er * 1.2, { len: er * 1.3 }); }
      // hardpoints
      P.hardSym('turret', 0.0, 0.03 * k, 0.013 * k); P.hardSym('turret', -0.14, 0.038 * k, 0.013 * k);
      P.hardSym('turret', 0.2, 0.03 * k, 0.012 * k); P.hardSym('turret', -0.26, 0.026 * k, 0.012 * k);
      P.hard('pod', -0.06, 0, 0.04 * k);
      P.hardSym('troop', -0.2, 0.085 * k, 0.02 * k);
      P.hardSym('rack', -0.02, 0.14 * k, 0.015 * k);
      P.hard('bay', -0.27, 0, 0.04, { w: 0.022 * k });
    }
  };

  // ---------------------------------------------------------------- BULRATHI
  // massive armoured slabs: bolted copper-brown plating, heavy turrets, square engine banks
  DESIGNS.bulrathi = {
    pal: { base: '#a85f36', light: '#dc9d6a', dark: '#40220f', plate: '#8c4a2a', steel: '#54453d', eng: ['#fff2d0', '#ffb040', '#ff5a12'], glow: '#ffa040', win: '#ffcf80' },
    hw: [0.19, 0.23, 0.28, 0.34, 0.4],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const wm = [0.12, 0.145, 0.175, 0.21, 0.25][h], ne = [2, 2, 3, 4, 5][h];
      const slab = pal.base, plate = pal.plate, steel = pal.steel, dk = pal.dark;
      const skin = { cw: 0.085, ch: 0.065, tint: 0.14 };

      // engine bank
      P.fill(P.cham(-0.5, -wm * 0.92, 0.14, wm * 1.84, 0.02), steel, { lift: 0.01, skin: { cw: 0.05, ch: 0.04, tint: 0.12 } });
      const er = wm * 1.32 / ne * 0.4;
      for (let i = 0; i < ne; i++) P.engine(-0.5, lerp(-wm * 0.66, wm * 0.66, (i + 0.5) / ne), er, { len: er * 1.6, mat: dk, flare: 1.05 });
      // side armour sponsons (behind the main slab so the slab overlaps them)
      const np = [1, 2, 2, 3, 4][h], pd = [0.04, 0.05, 0.062, 0.075, 0.09][h], pl = [0.3, 0.24, 0.24, 0.2, 0.18][h];
      P.both(function (s) {
        for (let i = 0; i < np; i++) {
          const x = np === 1 ? -0.05 : lerp(-0.34, 0.22 - pl * 0.5, i / (np - 1));
          const sh = P.cham(x - pl / 2, s > 0 ? wm - 0.035 : -(wm + pd), pl, pd + 0.035, 0.016);
          P.fill(sh, mixc(plate, dk, 0.1 + (i % 2) * 0.1), { lift: 0.012, skin: skin, bev: 0.014 });
          P.rivets(x - pl / 2 + 0.014, s * (wm + pd - 0.012), x + pl / 2 - 0.014, s * (wm + pd - 0.012), 5 + h, 0.0042, slab);
          P.fill(P.rect(x + pl / 2 - 0.045, s * (wm + pd * 0.5) - 0.007, 0.032, 0.014), tm, { bev: 0.003, edge: 0.3, nonote: true });
        }
      });
      // main slab
      const main = P.cham(-0.38, -wm, 0.76, wm * 2, 0.045);
      P.fill(main, slab, { lift: 0.012, skin: skin, round: 0.35, bev: 0.017 });
      P.both(function (s) {
        P.rivets(-0.35, s * (wm - 0.017), 0.33, s * (wm - 0.017), 14 + h * 2, 0.0045, slab);
        P.seam([-0.2, s * wm * 0.98, -0.2, s * wm * 0.15], 0.0035, 0.55);
        P.seam([0.04, s * wm * 0.98, 0.04, s * wm * 0.15], 0.0035, 0.55);
        P.fill(P.rect(-0.3, s * wm * 0.62 - 0.01, 0.2, 0.02), tm, { bev: 0.004, edge: 0.3, nonote: true });
      });
      // bow wedge with hazard stripes
      const bow = P.poly([0.37, -wm * 0.96, 0.5, -wm * 0.45, 0.5, wm * 0.45, 0.37, wm * 0.96]);
      P.fill(bow, mixc(plate, slab, 0.4), { lift: 0.01, bev: 0.015, round: 0.3 });
      P.clipTo(bow, function () {
        g.fillStyle = rgba(tm, 0.88);
        for (let i = -4; i < 6; i += 2) { g.beginPath(); g.moveTo(0.37 + i * 0.03, -wm); g.lineTo(0.37 + (i + 1) * 0.03, -wm); g.lineTo(0.37 + (i + 1) * 0.03 + wm * 0.8, wm); g.lineTo(0.37 + i * 0.03 + wm * 0.8, wm); g.closePath(); g.fill(); }
      });
      P.rivets(0.4, -wm * 0.82, 0.4, wm * 0.82, 6 + h, 0.0045, slab);
      // command bunker
      const bw2 = wm * 1.05, bunker = P.cham(-0.14, -bw2 * 0.5, 0.3, bw2, 0.025);
      P.fill(bunker, steel, { lift: 0.014, skin: { cw: 0.06, ch: 0.05, tint: 0.14 }, bev: 0.014 });
      P.fill(P.rect(0.125, -bw2 * 0.34, 0.016, bw2 * 0.68), [255, 190, 90], { flat: true, bev: 0.002, edge: 0.4, nonote: true });
      P.emit(0.133, 0, 0.03, bw2 * 0.4, 0, [255, 170, 70], 0.9);
      P.rivets(-0.12, -bw2 * 0.44, 0.14, -bw2 * 0.44, 6, 0.0035, slab);
      P.rivets(-0.12, bw2 * 0.44, 0.14, bw2 * 0.44, 6, 0.0035, slab);
      if (h >= 3) P.fill(P.cham(-0.08, -bw2 * 0.3, 0.16, bw2 * 0.6, 0.02), dk, { lift: 0.01, skin: true, bev: 0.012 });
      P.light(-0.1, 0, 0.007, [255, 90, 60], 'blink', 1.3, 0.1);
      P.light(0.14, bw2 * 0.4, 0.006, tone(tm, 0.3), 'pulse', 2.2, 0.2);
      P.light(0.14, -bw2 * 0.4, 0.006, tone(tm, 0.3), 'pulse', 2.2, 0.7);
      // gun houses with heavy barrels
      const ng = [0, 1, 2, 3, 4][h];
      for (let i = 0; i < ng; i++) {
        const x = lerp(0.24, -0.22, ng === 1 ? 0 : i / (ng - 1)), yy = wm * 0.62;
        P.both(function (s) {
          P.tube(x, s * yy - 0.014, x + 0.12, s * yy - 0.014, 0.011, 0.01, dk, { lift: 0.006, nonote: true });
          P.tube(x, s * yy + 0.014, x + 0.12, s * yy + 0.014, 0.011, 0.01, dk, { lift: 0.006, nonote: true });
          P.fill(P.cham(x - 0.035, s * yy - 0.032, 0.07, 0.064, 0.012), mixc(slab, steel, 0.3), { lift: 0.01, bev: 0.01, skin: true });
          P.dome(x - 0.003, s * yy, 0.018, 0.018, 0, mixc(plate, dk, 0.2), { nonote: true, edge: 0.5 });
        });
      }
      // doomstar: siege cannon
      if (h === 4) {
        P.tube(0.1, 0, 0.5, 0, 0.06, 0.05, steel, { lift: 0.014, nonote: true });
        for (let i = 0; i < 4; i++) P.fill(P.cham(0.18 + i * 0.075, -0.082, 0.03, 0.164, 0.008), mixc(steel, slab, 0.3), { lift: 0.006, bev: 0.007, nonote: true });
        P.dome(0.505, 0, 0.016, 0.05, 0, [14, 8, 6], { edge: 0.8, spec: 0, nonote: true });
        P.emit(0.5, 0, 0.07, 0.07, 0, [255, 150, 60], 0.9);
      }
      // hardpoints
      P.hardSym('turret', 0.3, wm * 0.5, 0.017); P.hardSym('turret', -0.3, wm * 0.5, 0.017);
      P.hardSym('turret', -0.05, wm * 0.85, 0.016); P.hardSym('turret', 0.2, wm * 0.85, 0.016);
      P.hard('pod', -0.27, 0, wm * 0.5);
      P.hardSym('troop', -0.05, wm + pd * 0.55, 0.024);
      P.hardSym('rack', 0.12, wm * 0.8, 0.016);
      P.hard('bay', 0.27, 0, 0.06, { w: wm * 0.4 });
    }
  };

  // ---------------------------------------------------------------- DARLOK
  // stealth bombers: faceted dark planes lit like low-poly crystal, violet light strips
  DESIGNS.darlok = {
    pal: { base: '#2c2250', light: '#7a66c0', dark: '#120d26', deep: '#07050f', violet: '#b46bff', eng: ['#f6e6ff', '#b46bff', '#6020d8'], glow: '#b46bff', win: '#d9a8ff' },
    hw: [0.3, 0.36, 0.42, 0.5, 0.56],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g, vio = pal.violet;
      const sy = [0.6, 0.82, 0.96, 1.08, 1.2][h];
      function wing(sx, syy, dx, zk, col, strips) {
        const X = function (x) { return x * sx + dx; };
        const V = function (x, y, z) { return [X(x), y * syy, z * zk]; };
        const N = V(0.5, 0, 0), R1 = V(0.26, 0, 0.1), R2 = V(-0.02, 0, 0.14), R3 = V(-0.4, 0, 0.04);
        const A = V(0.2, 0.07, 0.03), W = V(-0.16, 0.42, 0), T1 = V(-0.26, 0.3, 0), T2 = V(-0.2, 0.22, 0), T3 = V(-0.34, 0.14, 0), T4 = V(-0.28, 0.07, 0);
        const outline = [N[0], N[1], A[0], A[1], W[0], W[1], T1[0], T1[1], T2[0], T2[1], T3[0], T3[1], T4[0], T4[1], R3[0], R3[1]];
        P.drop(P.poly(symPts(outline)), 0.014, 0.55);
        P.both(function (s) {
          const f = function (v) { return [v[0], v[1] * s, v[2]]; };
          [[N, A, R1], [A, W, R1], [W, R2, R1], [W, T1, R2], [T1, T2, R2], [T2, T3, R2], [T3, T4, R2], [T4, R3, R2]].forEach(function (t) {
            P.facet(f(t[0]), f(t[1]), f(t[2]), col, { k: 1.25, hiMax: 0.34 });
          });
          if (strips) {
            P.strip([N[0] - 0.015, 0, A[0] - 0.005, s * (A[1] - 0.004), W[0] + 0.01, s * (W[1] - 0.008)], 0.0032, vio, 0.95);
            P.strip([W[0] - 0.01, s * (W[1] - 0.012), T1[0] + 0.012, s * (T1[1] + 0.004)], 0.0026, vio, 0.7);
            P.strip([T2[0], s * T2[1], T3[0] + 0.01, s * T3[1]], 0.0026, vio, 0.7);
            P.strip([R1[0], 0, R2[0], 0, R3[0] + 0.02, 0], 0.0028, vio, 0.8);
            P.strip([R2[0], 0, T2[0] + 0.02, s * (T2[1] - 0.01)], 0.002, vio, 0.45);
            P.emit(T2[0] - 0.005, s * (T2[1] - 0.045), 0.026, 0.016, 0, vio, 0.9);
            P.engAt(T3[0] + 0.004, s * (T3[1] + 0.04), 0.017 * syy);
          }
        });
        return { N: N, R1: R1, R2: R2, R3: R3, A: A, W: W };
      }
      // trailing wing layers (bigger classes get stacked chevrons)
      if (h >= 2) wing(0.82, 0.78, -0.17, 0.8, mixc(pal.base, pal.dark, 0.35), false);
      if (h >= 4) wing(0.7, 0.55, -0.27, 0.7, mixc(pal.base, pal.dark, 0.5), false);
      const m = wing(1, sy, 0, 1, pal.base, true);
      // dorsal blades and canopy
      if (h >= 1) {
        P.both(function (s) {
          P.facet([0.16, s * 0.035, 0.0], [-0.12, s * 0.06, 0.0], [-0.04, s * 0.04, 0.17], pal.base, { k: 1.8, hiMax: 0.34 });
        });
      }
      const canopy = [0.22, 0, 0.13, 0.034, 0.02, 0.034, -0.05, 0, 0.02, -0.034, 0.13, -0.034];
      P.fill(P.poly(canopy), [18, 12, 38], { lift: 0.01, bev: 0.008, edge: 0.8 });
      P.clipTo(P.poly(canopy), function () {
        g.fillStyle = rgba(vio, 0.28); g.beginPath(); g.moveTo(0.2, 0); g.lineTo(0.12, 0.03); g.lineTo(0.08, 0.0); g.closePath(); g.fill();
      });
      P.strip(canopy, 0.0022, vio, 0.75, true);
      // central engine slit
      P.emit(-0.395, 0, 0.03, 0.02, 0, vio, 0.8); P.engAt(-0.4, 0, 0.02 * sy);
      if (h >= 3) { P.emit(-0.35, 0, 0.05, 0.02, 0, vio, 0.6); P.engAt(-0.33, 0.035 * sy, 0.016); P.engAt(-0.33, -0.035 * sy, 0.016); }
      // team marks
      P.both(function (s) {
        P.fill(P.poly([-0.02, s * 0.2 * sy, -0.1, s * 0.27 * sy, -0.1, s * 0.255 * sy, -0.04, s * 0.2 * sy]), tm, { flat: true, bev: 0.003, edge: 0.3, nonote: true });
        P.light(m.W[0] + 0.02, s * (m.W[1] - 0.03), 0.007, vio, 'blink', 2.1, s > 0 ? 0 : 0.5);
      });
      // doomstar: the void-lens
      if (h === 4) {
        P.emit(0.0, 0, 0.17, 0.17, 0, vio, 0.9);
        P.dome(0.0, 0, 0.065, 0.065, 0, [10, 6, 22], { lift: 0.008, spec: 0.3 });
        P.strip([0.05, 0, 0.03, 0.04, 0.0, 0.05, -0.04, 0.03, -0.055, 0, -0.04, -0.03, 0.0, -0.05, 0.03, -0.04], 0.003, [230, 190, 255], 1, true);
        P.emit(0.0, 0, 0.05, 0.05, 0, [230, 190, 255], 1);
      }
      // hardpoints
      P.hardSym('turret', 0.1, 0.1 * sy, 0.013); P.hardSym('turret', -0.1, 0.16 * sy, 0.013);
      P.hardSym('turret', 0.18, 0.06 * sy, 0.012); P.hardSym('turret', -0.2, 0.25 * sy, 0.012);
      P.hard('pod', -0.19, 0, 0.04 * sy);
      P.hardSym('troop', -0.05, 0.1 * sy, 0.018);
      P.hardSym('rack', -0.1, 0.28 * sy, 0.016);
      P.hard('bay', 0.07, 0, 0.055, { w: 0.03 * sy });
    }
  };

  // ---------------------------------------------------------------- KLACKON
  // insectoid: segmented chitin plates, jointed leg pylons, mandibles, compound eyes
  DESIGNS.klackon = {
    pal: { base: '#8f9038', light: '#d3d072', dark: '#3e3216', deep: '#1c180a', brown: '#654c24', eng: ['#fffbd8', '#d8ff50', '#6fb824'], glow: '#d8ff50', win: '#ffd23a' },
    hw: [0.31, 0.37, 0.44, 0.5, 0.58],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const chit = pal.base, brown = pal.brown, lt = pal.light, dk = pal.dark;
      const k = [0.82, 0.94, 1.06, 1.2, 1.38][h], nl = [1, 2, 3, 3, 4][h], ns = [3, 3, 4, 5, 6][h];

      // ---- legs: coxa / femur / tibia with knee joints and claws ----
      P.both(function (s) {
        for (let i = nl - 1; i >= 0; i--) {
          const f = nl === 1 ? 0.5 : i / (nl - 1);
          const x0 = lerp(0.14, -0.12, f), reach = (0.15 + 0.05 * h) * lerp(1, 0.85, f);
          const p0 = [x0, s * 0.05 * k], p1 = [x0 - 0.035, s * (0.1 * k + 0.03)], p2 = [x0 - 0.075, s * (0.17 * k + reach * 0.55)], p3 = [x0 + 0.055 + 0.02 * (1 - f), s * (0.19 * k + reach)];
          P.tube(p0[0], p0[1], p1[0], p1[1], 0.018 * k, 0.015 * k, brown, { lift: 0.008, cap2: true });
          P.tube(p1[0], p1[1], p2[0], p2[1], 0.015 * k, 0.012 * k, mixc(chit, brown, 0.35), { lift: 0.008, cap1: true, cap2: true });
          P.tube(p2[0], p2[1], p3[0], p3[1], 0.012 * k, 0.007 * k, chit, { lift: 0.008, cap1: true, cap2: true });
          P.dome(p1[0], p1[1], 0.017 * k, 0.017 * k, 0, brown, { nonote: true });
          P.dome(p2[0], p2[1], 0.015 * k, 0.015 * k, 0, brown, { nonote: true });
          const dx = p3[0] - p2[0], dy = p3[1] - p2[1], dl = hypot(dx, dy), ux = dx / dl, uy = dy / dl;
          P.fill(P.poly([p3[0] - uy * 0.008, p3[1] + ux * 0.008, p3[0] + ux * 0.034, p3[1] + uy * 0.034, p3[0] + uy * 0.008, p3[1] - ux * 0.008]), lt, { bev: 0.004, nonote: true });
          if (i === nl - 1) P.hard('turret', p3[0], p3[1], 0.012 * k);
          if (i === 0) P.hard('troop', p2[0] + 0.02, p2[1] + s * 0.03, 0.02 * k);
        }
      });
      // ---- abdomen: overlapping chitin segments (rear first) ----
      for (let j = 0; j < ns; j++) {
        const f = ns === 1 ? 0 : j / (ns - 1);
        const x = lerp(-0.4, -0.1, f), ry = (0.03 + 0.085 * Math.pow(sin(PI * (0.12 + f * 0.8)), 0.8)) * k, rx = (0.3 / ns) * 0.95 + 0.04;
        const seg = P.dome(x, 0, rx, ry, 0, mixc(chit, brown, (j % 2) * 0.28), { lift: 0.01, liftA: 0.5, spec: 0.5, k: 1.05 });
        P.clipTo(seg, function () {
          for (let q = -2; q <= 2; q++) P.stroke([x - rx * 0.6, ry * q * 0.38, x + rx * 0.2, ry * q * 0.3], 0.0026, dk, 0.35);
        });
        if (j === ns - 1) P.fill(P.rect(x - rx * 0.4, -ry * 0.12, rx * 1.1, ry * 0.24), tm, { bev: 0.003, edge: 0.3, nonote: true });
      }
      // ---- thorax with shoulder plates ----
      P.dome(0.02, 0, 0.15, 0.078 * k, 0, chit, { lift: 0.012, liftA: 0.55, spec: 0.6, k: 1.05 });
      P.both(function (s) {
        const pl = P.poly([0.12, s * 0.03 * k, 0.07, s * 0.085 * k, -0.04, s * 0.09 * k, -0.1, s * 0.05 * k, -0.02, s * 0.03 * k]);
        P.fill(pl, mixc(chit, lt, 0.25), { lift: 0.008, round: 0.6, skin: { cw: 0.05, ch: 0.03, tint: 0.1 } });
        P.fill(P.poly([0.05, s * 0.05 * k, -0.03, s * 0.052 * k, -0.045, s * 0.07 * k, 0.02, s * 0.074 * k]), tm, { bev: 0.003, edge: 0.35, nonote: true });
        P.hard('turret', 0.0, s * 0.055 * k, 0.014 * k);
      });
      P.seam([0.12, 0, -0.08, 0], 0.003, 0.5);
      P.light(-0.02, 0, 0.007, [255, 230, 120], 'pulse', 2.6, 0.2);
      // ---- head: mandibles, antennae, compound eyes ----
      P.both(function (s) {
        const man = P.curve([0.34, s * 0.04 * k, 0.43, s * 0.085 * k, 0.52, s * 0.07 * k, 0.56, s * 0.018 * k, 0.5, s * 0.038 * k, 0.43, s * 0.058 * k, 0.37, s * 0.024 * k], true, 1);
        P.fill(man, mixc(brown, dk, 0.3), { lift: 0.008, round: 0.5, bev: 0.007 });
        P.stroke([0.4, s * 0.062 * k, 0.5, s * 0.052 * k], 0.003, lt, 0.5);
        // antenna
        P.stroke([0.33, s * 0.03 * k, 0.4, s * 0.1 * k, 0.46, s * 0.17 * k, 0.5, s * 0.25 * k], 0.0034 * k, mixc(chit, dk, 0.4), 0.95);
        P.light(0.5, s * 0.25 * k, 0.007, [255, 230, 90], 'pulse', 1.8, s > 0 ? 0 : 0.5);
      });
      P.tube(0.12, 0, 0.26, 0, 0.034 * k, 0.03 * k, mixc(brown, dk, 0.2), { lift: 0.008, nonote: true });
      P.dome(0.29, 0, 0.1, 0.07 * k, 0, mixc(chit, brown, 0.2), { lift: 0.012, spec: 0.6 });
      P.both(function (s) {
        const eye = P.dome(0.3, s * 0.052 * k, 0.034, 0.03 * k, 0, [255, 190, 50], { lift: 0.004, spec: 0.8, k: 0.9 });
        P.emit(0.3, s * 0.052 * k, 0.05, 0.045 * k, 0, [255, 190, 60], 0.55);
        P.clipTo(eye, function () { for (let q = -2; q <= 2; q++) { P.stroke([0.27, s * 0.052 * k + q * 0.012, 0.33, s * 0.052 * k + q * 0.012], 0.0016, dk, 0.35); P.stroke([0.3 + q * 0.012, s * 0.052 * k - 0.03, 0.3 + q * 0.012, s * 0.052 * k + 0.03], 0.0016, dk, 0.3); } });
      });
      if (h === 4) { // gaping maw cannon
        P.dome(0.5, 0, 0.05, 0.05, 0, [18, 14, 6], { lift: 0.004, spec: 0.2 });
        P.emit(0.5, 0, 0.12, 0.1, 0, [216, 255, 80], 0.9);
        for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; P.fill(P.poly([0.5 + cos(a) * 0.055, sin(a) * 0.055, 0.5 + cos(a + 0.18) * 0.04, sin(a + 0.18) * 0.04, 0.5 + cos(a - 0.18) * 0.04, sin(a - 0.18) * 0.04]), lt, { bev: 0.002, nonote: true }); }
      }
      // ---- engine glands on the abdomen tip ----
      const er = 0.026 * k;
      P.dome(-0.46, 0, 0.03 * k, 0.03 * k, 0, brown, { nonote: true });
      P.engine(-0.45, 0, er, { len: er * 1.2, mat: brown });
      if (h >= 2) { P.engine(-0.42, 0.07 * k, er * 0.7, { len: er, mat: brown }); P.engine(-0.42, -0.07 * k, er * 0.7, { len: er, mat: brown }); }
      P.hard('pod', -0.24, 0, 0.05 * k);
      P.hardSym('rack', 0.12, 0.1 * k, 0.016 * k);
      P.hard('bay', -0.1, 0, 0.05, { w: 0.03 * k });
      P.hardSym('turret', -0.2, 0.07 * k, 0.014 * k);
    }
  };

  // ---------------------------------------------------------------- MEKLAR
  // cybernetic machine hulls: gunmetal rectilinear modules, lattice booms, robotic arms, red optics, glowing circuit traces
  DESIGNS.meklar = {
    pal: { base: '#69707c', light: '#b4bdcb', dark: '#2a2f39', deep: '#12151b', red: '#ff2c2c', circuit: '#ff6a3a', eng: ['#ffe6c8', '#ff6a30', '#c01c0c'], glow: '#ff4a2a', win: '#ff6a4a' },
    hw: [0.22, 0.29, 0.36, 0.45, 0.52],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const cw = [0.07, 0.08, 0.092, 0.105, 0.12][h], ne = [2, 2, 3, 4, 5][h];
      const gun = pal.base, steel = pal.dark, hi = pal.light, red = pal.red, circ = pal.circuit;
      const skin = { cw: 0.06, ch: 0.045, tint: 0.12, seam: 0.42 };
      const r = P.rnd;
      function truss(x0, y0, x1, y1) {
        P.fill(P.cham(x0, y0, x1 - x0, y1 - y0, 0.006), [22, 24, 30], { lift: 0.007, bev: 0.004 });
        const n = max(2, round((x1 - x0) / 0.05));
        for (let i = 0; i < n; i++) {
          const xa = lerp(x0, x1, i / n), xb = lerp(x0, x1, (i + 1) / n);
          P.stroke([xa, y0, xb, y1], 0.0022, hi, 0.5); P.stroke([xa, y1, xb, y0], 0.0022, hi, 0.5);
        }
        P.stroke([x0, y0, x1, y0], 0.004, hi, 0.7); P.stroke([x0, y1, x1, y1], 0.004, hi, 0.7);
        for (let i = 0; i <= n; i++) { const xx = lerp(x0, x1, i / n); P.fill(P.rect(xx - 0.0045, y0 - 0.0045, 0.009, 0.009), gun, { bev: 0.002, edge: 0.5, nonote: true }); P.fill(P.rect(xx - 0.0045, y1 - 0.0045, 0.009, 0.009), gun, { bev: 0.002, edge: 0.5, nonote: true }); }
      }
      function vents(x, y, w, hh, n) { for (let i = 0; i < n; i++) P.fill(P.rect(x + i * w / n, y, w / n * 0.55, hh), [10, 10, 14], { flat: true, bev: 0.001, edge: 0.2, nonote: true }); }
      // ---- doomstar frame ----
      if (h === 4) {
        truss(-0.42, -0.34, 0.32, -0.3); truss(-0.42, 0.3, 0.32, 0.34);
        P.fill(P.cham(-0.42, -0.34, 0.045, 0.68, 0.008), steel, { lift: 0.008, skin: true }); P.fill(P.cham(0.275, -0.34, 0.045, 0.68, 0.008), steel, { lift: 0.008, skin: true });
        P.both(function (s) { P.fill(P.cham(-0.37, s * 0.19 - 0.014, 0.64, 0.028, 0.005), gun, { lift: 0.006, skin: true }); P.hardSym('turret', 0.24, 0.3, 0.02); P.hardSym('turret', -0.34, 0.3, 0.02); });
      }
      // ---- side booms + pods, joined by struts ----
      if (h >= 1) {
        P.both(function (s) { const y0 = cw * 0.8, y1 = cw * 0.8 + 0.05; truss(-0.32, s > 0 ? y0 : -y1, 0.1, s > 0 ? y1 : -y0); });
      }
      if (h >= 2) {
        P.both(function (s) {
          const yc = s * (cw + 0.14);
          for (const x of [-0.2, 0.02]) P.fill(P.rect(x, s > 0 ? cw * 0.9 : -(cw + 0.1), 0.026, cw * 0.1 + 0.1), steel, { lift: 0.006, bev: 0.004, nonote: true });
          P.fill(P.cham(-0.28, yc - 0.047, 0.38, 0.094, 0.012), gun, { lift: 0.012, skin: skin, bev: 0.01 });
          vents(-0.25, yc - 0.015, 0.1, 0.03, 6);
          P.seam([-0.1, yc - 0.047, -0.1, yc + 0.047], 0.003, 0.5);
          P.fill(P.rect(-0.04, yc - 0.008, 0.1, 0.016), tm, { bev: 0.002, edge: 0.3, nonote: true });
          P.light(0.07, yc, 0.007, red, 'blink', 1.2 + (s > 0 ? 0 : 0.3), s > 0 ? 0 : 0.4);
          P.hard('turret', 0.07, yc + s * 0.0, 0.017); P.hard('rack', -0.22, yc + s * 0.07, 0.016);
        });
      }
      if (h >= 3) {
        P.both(function (s) {
          const yc = s * (cw + 0.32);
          P.fill(P.rect(0.1, s > 0 ? cw + 0.19 : -(cw + 0.27), 0.022, 0.08), steel, { lift: 0.006, nonote: true });
          P.fill(P.rect(-0.16, s > 0 ? cw + 0.19 : -(cw + 0.27), 0.022, 0.08), steel, { lift: 0.006, nonote: true });
          P.fill(P.cham(-0.24, yc - 0.04, 0.4, 0.08, 0.01), gun, { lift: 0.012, skin: skin });
          vents(-0.2, yc - 0.012, 0.12, 0.024, 7);
          P.light(0.13, yc, 0.007, red, 'pulse', 1.5, 0.3);
          P.hard('turret', 0.15, yc, 0.016);
        });
      }
      // ---- engine block ----
      P.fill(P.cham(-0.5, -cw * 1.15, 0.15, cw * 2.3, 0.012), steel, { lift: 0.01, skin: { cw: 0.04, ch: 0.03, tint: 0.1 } });
      const er = cw * 2.0 / ne * 0.36;
      for (let i = 0; i < ne; i++) P.engine(-0.5, lerp(-cw * 0.85, cw * 0.85, (i + 0.5) / ne), er, { len: er * 1.4, mat: [38, 40, 48], flare: 1.0 });
      // ---- core ----
      P.fill(P.cham(-0.36, -cw, 0.5, cw * 2, 0.014), gun, { lift: 0.012, skin: skin, round: 0.35, bev: 0.012 });
      vents(-0.33, -cw * 0.45, 0.1, cw * 0.9, 6);
      P.fill(P.cham(-0.12, -cw * 0.62, 0.16, cw * 1.24, 0.01), steel, { lift: 0.008, skin: true, bev: 0.008 });
      // radar dish
      P.dome(-0.04, 0, cw * 0.46, cw * 0.46, 0, mixc(gun, hi, 0.3), { lift: 0.006, spec: 0.5 });
      g.strokeStyle = rgba(steel, 0.8); g.lineWidth = 0.003; for (let q = 1; q < 3; q++) { g.beginPath(); g.arc(-0.04, 0, cw * 0.46 * q / 3, 0, TAU); g.stroke(); }
      P.tube(-0.04, 0, -0.04 + cw * 0.5, -cw * 0.1, 0.004, 0.003, hi, { nonote: true }); P.dome(-0.04 + cw * 0.5, -cw * 0.1, 0.007, 0.007, 0, red, { nonote: true, spec: 0.8 });
      // circuitry traces
      for (let i = 0; i < 5 + h * 2; i++) {
        let x = lerp(-0.34, 0.1, r()), y = (r() - 0.5) * cw * 1.6;
        const pts = [x, y];
        for (let j = 0; j < 3; j++) { if (j % 2) y = clamp(y + (r() - 0.5) * cw, -cw * 0.9, cw * 0.9); else x = clamp(x + (r() - 0.35) * 0.14, -0.35, 0.12); pts.push(x, y); }
        P.strip(pts, 0.0024, circ, 0.85);
        P.fill(P.rect(pts[pts.length - 2] - 0.005, pts[pts.length - 1] - 0.005, 0.01, 0.01), [255, 120, 70], { flat: true, bev: 0.001, edge: 0.4, nonote: true });
      }
      // ---- robotic arms carrying gun pods ----
      if (h >= 1) {
        P.both(function (s) {
          const bx = 0.04, by = s * cw * 0.95, jx = 0.2 + 0.02 * h, jy = s * (cw + 0.05 + 0.02 * h), ex = 0.3, ey = s * (cw + 0.02 + 0.015 * h);
          P.tube(bx, by, jx, jy, 0.011, 0.009, steel, { lift: 0.008, nonote: true, cap2: true });
          P.tube(jx, jy, ex, ey, 0.009, 0.0075, gun, { lift: 0.008, nonote: true, cap1: true, cap2: true });
          P.dome(jx, jy, 0.013, 0.013, 0, hi, { nonote: true, spec: 0.5 });
          P.fill(P.cham(ex - 0.004, ey - 0.014, 0.04, 0.028, 0.006), steel, { lift: 0.006, bev: 0.005, nonote: true });
          P.tube(ex + 0.03, ey - 0.006, ex + 0.07, ey - 0.006, 0.004, 0.0035, hi, { nonote: true }); P.tube(ex + 0.03, ey + 0.006, ex + 0.07, ey + 0.006, 0.004, 0.0035, hi, { nonote: true });
          P.hard('turret', ex + 0.01, ey, 0.012);
        });
      }
      // ---- sensor head + red optic ----
      P.fill(P.cham(0.14, -cw * 0.72, 0.2, cw * 1.44, 0.012), mixc(gun, steel, 0.25), { lift: 0.01, skin: skin, bev: 0.01 });
      P.dome(0.3, 0, cw * 0.46, cw * 0.46, 0, [24, 10, 12], { lift: 0.004, spec: 0.3 });
      P.emit(0.3, 0, cw * 0.9, cw * 0.9, 0, red, 0.9);
      P.dome(0.3, 0, cw * 0.24, cw * 0.24, 0, [255, 90, 80], { spec: 0.9, edge: 0.3 });
      g.strokeStyle = rgba(hi, 0.7); g.lineWidth = 0.0028; g.beginPath(); g.arc(0.3, 0, cw * 0.46, 0, TAU); g.stroke();
      P.both(function (s) {
        P.tube(0.34, s * cw * 0.45, 0.5, s * cw * 0.45, 0.005, 0.003, hi, { nonote: true, lift: 0.004 });
        P.light(0.5, s * cw * 0.45, 0.006, red, 'blink', 1.4, s > 0 ? 0 : 0.5);
      });
      P.tube(0.14, 0, 0.5, 0, 0.0045, 0.0025, hi, { nonote: true });
      // greebles
      for (let i = 0; i < 6 + h * 2; i++) {
        const x = lerp(-0.34, 0.1, r()), y = (r() - 0.5) * cw * 1.7, w = 0.012 + r() * 0.025, hh = 0.008 + r() * 0.02;
        P.fill(P.rect(x, y, w, hh), mixc(gun, hi, 0.1 + r() * 0.2), { lift: 0.003, bev: 0.002, nonote: true, edge: 0.4 });
      }
      P.fill(P.rect(-0.2, -0.006, 0.1, 0.012), tm, { bev: 0.002, edge: 0.3, nonote: true });
      if (h === 4) { // great eye
        P.dome(-0.14, 0, 0.075, 0.075, 0, [22, 8, 10], { lift: 0.006, spec: 0.3 });
        P.emit(-0.14, 0, 0.16, 0.16, 0, red, 1);
        P.dome(-0.14, 0, 0.034, 0.034, 0, [255, 110, 100], { spec: 1 });
        g.strokeStyle = rgba(hi, 0.8); g.lineWidth = 0.003; g.beginPath(); g.arc(-0.14, 0, 0.075, 0, TAU); g.stroke(); g.beginPath(); g.arc(-0.14, 0, 0.055, 0, TAU); g.stroke();
      }
      P.hardSym('turret', 0.08, cw * 0.7, 0.014); P.hardSym('turret', -0.28, cw * 0.7, 0.014);
      P.hard('pod', -0.22, 0, cw * 0.5);
      P.hardSym('troop', -0.15, cw * 0.8 + 0.03, 0.016);
      P.hardSym('rack', 0.0, cw * 0.8 + 0.06, 0.014);
      P.hard('bay', 0.04, 0, 0.05, { w: cw * 0.3 });
    }
  };

  // ---------------------------------------------------------------- MRRSHAN
  // predatory curves: fanged prow, sabre fins, gold hull with black tiger stripes
  DESIGNS.mrrshan = {
    pal: { base: '#e3aa2e', light: '#ffe493', dark: '#8a5a10', deep: '#2a1c06', stripe: '#15100a', eng: ['#fff6d0', '#ffc040', '#ff7a10'], glow: '#ffc040', win: '#ffe060' },
    hw: [0.3, 0.36, 0.42, 0.49, 0.56],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const gold = pal.base, hi = pal.light, dk = pal.dark, ink = pal.stripe;
      const k = [0.82, 0.94, 1.06, 1.18, 1.34][h], nf = [1, 1, 2, 2, 3][h];
      // sabre fins (rear pair first)
      for (let i = nf - 1; i >= 0; i--) {
        const xr = lerp(0.02, -0.16, nf === 1 ? 0 : i / (nf - 1)), ext = 1 + i * 0.08, wy = 0.36 * (0.7 + 0.1 * h);
        P.both(function (s) {
          const fin = P.curve([xr + 0.12, s * 0.07 * k, xr + 0.04, s * (0.15 * ext), xr - 0.08, s * (wy * 0.72), xr - 0.28, s * (wy + 0.02 * i), xr - 0.17, s * (wy * 0.62), xr - 0.2, s * 0.15, xr - 0.27, s * 0.085 * k], true, 1.1);
          P.fill(fin, mixc(gold, dk, 0.12 + i * 0.12), { lift: 0.012, round: 0.4, bev: 0.01, skin: { cw: 0.08, ch: 0.05, tint: 0.07, seam: 0.2 } });
          P.clipTo(fin, function () {
            g.fillStyle = rgba(ink, 0.92);
            for (let q = 0; q < 4; q++) {
              const t = 0.25 + q * 0.17;
              const ax = lerp(xr + 0.1, xr - 0.26, t), ay = s * lerp(0.1, wy, Math.pow(t, 0.9));
              g.beginPath(); g.moveTo(ax + 0.05, ay - s * 0.05 * 0); g.lineTo(ax - 0.012, ay + s * 0.06); g.lineTo(ax - 0.035, ay + s * 0.06); g.lineTo(ax + 0.02, ay - s * 0.03); g.closePath(); g.fill();
            }
          });
          P.light(xr - 0.27, s * (wy + 0.02 * i - 0.01), 0.007, tone(tm, 0.2), 'blink', 1.8, s > 0 ? 0 : 0.45);
          if (i === 0) P.hard('rack', xr - 0.06, s * wy * 0.62, 0.016);
        });
      }
      // fangs
      P.both(function (s) {
        const fang = P.curve([0.24, s * 0.08 * k, 0.36, s * 0.1 * k, 0.48, s * 0.075 * k, 0.56, s * 0.026, 0.5, s * 0.052, 0.4, s * 0.07 * k, 0.3, s * 0.05 * k], true, 1);
        P.fill(fang, mixc(hi, gold, 0.25), { lift: 0.012, round: 0.55, bev: 0.008, rim: 0.4 });
        P.stroke([0.32, s * 0.083 * k, 0.5, s * 0.07], 0.0026, dk, 0.45);
      });
      // body
      const half = [0.4, 0, 0.37, 0.03 * k, 0.3, 0.07 * k, 0.17, 0.093 * k, 0.02, 0.092 * k, -0.12, 0.108 * k, -0.28, 0.092 * k, -0.4, 0.056 * k, -0.47, 0.022 * k, -0.485, 0];
      const body = P.curve(symPts(half), true);
      P.fill(body, gold, { lift: 0.014, round: 0.8, bev: 0.013, skin: { cw: 0.09, ch: 0.05, tint: 0.06, seam: 0.18 } });
      P.clipTo(body, function () {
        g.fillStyle = rgba(ink, 0.93);
        for (let q = 0; q < 5 + h; q++) {
          const x = lerp(-0.42, 0.1, q / (4 + h));
          for (const s of [1, -1]) {
            g.beginPath(); g.moveTo(x + 0.012, s * 0.0); g.lineTo(x - 0.05, s * 0.13 * k); g.lineTo(x - 0.075, s * 0.13 * k); g.lineTo(x - 0.012, s * 0.0); g.closePath(); g.fill();
          }
        }
      });
      // spine highlight + cockpit
      P.stroke([0.3, 0, -0.4, 0], 0.003, dk, 0.4);
      P.dome(0.07, 0, 0.065, 0.032 * k, 0, [255, 214, 120], { lift: 0.008, liftA: 0.5, spec: 0.8 });
      P.stroke([0.12, 0, 0.0, 0], 0.003, dk, 0.5);
      // slit eyes
      P.both(function (s) {
        const eye = P.poly([0.3, s * 0.03 * k, 0.215, s * 0.062 * k, 0.225, s * 0.048 * k, 0.29, s * 0.02 * k]);
        P.fill(eye, [255, 226, 110], { flat: true, bev: 0.002, edge: 0.6, nonote: true });
        P.emit(0.26, s * 0.042 * k, 0.05, 0.02, s * 0.5, [255, 214, 90], 0.9);
        P.light(0.3, s * 0.025 * k, 0.004, [255, 240, 180], 'steady');
      });
      P.fill(P.rect(-0.25, -0.012 * k, 0.12, 0.024 * k), tm, { bev: 0.003, edge: 0.3, nonote: true });
      if (h === 4) { // maw orb between the fangs
        P.emit(0.5, 0, 0.12, 0.1, 0, [255, 200, 90], 1);
        P.dome(0.485, 0, 0.034, 0.034, 0, [255, 236, 170], { lift: 0.004, spec: 0.9 });
      }
      // engines
      const er = 0.026 * k;
      P.both(function (s) { P.tube(-0.3, s * 0.05 * k, -0.45, s * 0.045 * k, 0.026 * k, 0.03 * k, mixc(gold, dk, 0.3), { lift: 0.01, cap1: true }); P.engine(-0.465, s * 0.045 * k, er, { len: er * 1.3, flare: 1.15 }); });
      if (h >= 3) P.engine(-0.48, 0, er * 0.9, { len: er * 1.2 });
      P.hardSym('turret', 0.14, 0.062 * k, 0.014); P.hardSym('turret', -0.1, 0.075 * k, 0.015);
      P.hardSym('turret', -0.3, 0.06 * k, 0.014);
      P.hard('pod', -0.18, 0, 0.045 * k);
      P.hardSym('troop', -0.05, 0.125 * k, 0.02);
      P.hard('bay', -0.36, 0, 0.04, { w: 0.022 * k });
    }
  };

  // ---------------------------------------------------------------- PSILON
  // elegant ovoid hulls, glass domes, floating halo rings and thin spires; pearl with cyan light
  DESIGNS.psilon = {
    pal: { base: '#ecebf9', light: '#ffffff', dark: '#8b83bd', deep: '#2f2b5c', lilac: '#bfb5e4', cyan: '#62e8ff', eng: ['#ffffff', '#86f0ff', '#2aa6ff'], glow: '#62e8ff', win: '#c8f8ff' },
    hw: [0.25, 0.3, 0.36, 0.43, 0.52],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g, cy = pal.cyan, pearl = pal.base, lil = pal.lilac;
      const w = [0.72, 0.85, 1.0, 1.2, 1.5][h], nf = [1, 1, 2, 2, 3][h], nb = [0, 1, 1, 2, 3][h], nrg = [0, 1, 1, 2, 3][h];
      // spires
      P.both(function (s) {
        const spire = function (x0, y0, x1, y1, r) {
          P.tube(x0, y0, x1, y1, r, r * 0.3, mixc(pearl, lil, 0.3), { lift: 0.006, nonote: true });
          P.light(x1, y1, 0.007, cy, 'pulse', 2.2 + abs(x1) * 1.3, abs(y1) * 3 + (s > 0 ? 0 : 0.5));
        };
        for (let j = 0; j < nf; j++) spire(0.16 - j * 0.11, s * 0.06 * w * (1 + j * 0.4), 0.52 - j * 0.04, s * (0.1 + 0.09 * j), 0.0058 + h * 0.0006);
        for (let j = 0; j < nb; j++) spire(-0.3 + j * 0.1, s * (0.05 + j * 0.03) * w, -0.52 + j * 0.04, s * (0.12 + 0.11 * j), 0.0058 + h * 0.0006);
      });
      // outrigger pods on slim pylons
      if (h >= 1) {
        P.both(function (s) {
          const px = -0.1 - 0.01 * h, py = s * (0.118 * w + 0.055 + 0.022 * h), rx = 0.1 + 0.014 * h, ry = 0.028 + 0.006 * h;
          P.tube(0.04, s * 0.09 * w, px + 0.03, py, 0.007, 0.0055, mixc(pearl, lil, 0.3), { lift: 0.006, nonote: true });
          P.tube(-0.12, s * 0.08 * w, px - 0.03, py, 0.006, 0.005, mixc(pearl, lil, 0.3), { lift: 0.006, nonote: true });
          P.dome(px, py, rx, ry, 0, pearl, { lift: 0.012, liftA: 0.5, spec: 0.7, rim: 0.5, k: 0.85 });
          P.strip([px + rx * 0.7, py, px - rx * 0.6, py], 0.0022, cy, 0.8);
          g.strokeStyle = rgba(cy, 0.95); g.lineWidth = 0.0038; g.beginPath(); g.ellipse(px - rx - 0.004, py, 0.005, ry * 0.8, 0, 0, TAU); g.stroke();
          P.emit(px - rx - 0.008, py, 0.028, ry * 1.1, 0, cy, 0.7); P.engAt(px - rx - 0.008, py, 0.013 + 0.002 * h);
          P.light(px + rx * 0.2, py, 0.006, cy, 'pulse', 2.3, s > 0 ? 0 : 0.5);
          P.hard('rack', px + rx * 0.3, py, 0.013);
        });
      }
      // hull
      const half = [0.46, 0, 0.42, 0.034 * w, 0.33, 0.072 * w, 0.2, 0.103 * w, 0.0, 0.118 * w, -0.2, 0.105 * w, -0.34, 0.072 * w, -0.43, 0.032 * w, -0.47, 0];
      const hull = P.curve(symPts(half), true);
      P.fill(hull, pearl, { lift: 0.016, liftA: 0.55, round: 1.0, bev: 0.02, rim: 0.6, rimC: [150, 235, 255], k: 0.8 });
      P.clipTo(hull, function () {
        const gr = g.createLinearGradient(-0.45, 0, 0.45, 0);
        gr.addColorStop(0, rgba(lil, 0.35)); gr.addColorStop(0.5, rgba(lil, 0)); gr.addColorStop(1, rgba(lil, 0.1));
        g.fillStyle = gr; g.fillRect(-0.5, -0.3, 1, 0.6);
      });
      P.both(function (s) {
        P.strip(crPts([0.3, s * 0.05 * w, 0.12, s * 0.097 * w, -0.08, s * 0.106 * w, -0.28, s * 0.07 * w, -0.4, s * 0.034 * w], 6), 0.0028, cy, 0.85);
        P.strip(crPts([0.22, s * 0.028 * w, 0.0, s * 0.062 * w, -0.2, s * 0.05 * w, -0.36, s * 0.026 * w], 6), 0.0018, cy, 0.5);
      });
      P.glint(-0.08, -0.06 * w, 0.2, 0.025 * w, -0.18, 0.5);
      P.clipTo(hull, function () {
        for (let x = -0.36; x < 0.02; x += 0.09) { const hh = halfAt(half, x) * 0.98; P.seam([x, -hh, x - 0.012, 0, x, hh], 0.0028, 0.3); }
      });
      // tilted halo ring around the canopy + drifting orbs
      if (h >= 2) {
        const rx0 = 0.06, ry0 = 0.2 * w, ring = P.custom(function (p) { p.ellipse(0.14, 0, rx0, ry0, 0, 0, TAU); p.moveTo(0.14 + rx0 - 0.011, 0); p.ellipse(0.14, 0, rx0 - 0.011, ry0 - 0.011, 0, 0, TAU, true); }, 0.14 - rx0, -ry0, 0.14 + rx0, ry0);
        ring.eo = true;
        P.fill(ring, pearl, { lift: 0.012, liftA: 0.5, bev: 0.008, rim: 0.5, k: 0.8 });
        g.save(); g.strokeStyle = rgba(cy, 0.85); g.lineWidth = 0.0028; g.beginPath(); g.ellipse(0.14, 0, rx0 - 0.0055, ry0 - 0.0055, 0, 0, TAU); g.stroke(); g.restore();
        P.emit(0.14, 0, rx0, ry0, 0, cy, 0.18);
      }
      if (h >= 3) {
        const orbs = [[0.36, 0.2], [-0.22, 0.24], [0.1, 0.3]];
        for (let i = 0; i < min(orbs.length, h - 1); i++) P.both(function (s) {
          const o = orbs[i], ox = o[0], oy = s * o[1] * w * 0.8;
          P.stroke([ox, oy, ox * 0.6, s * 0.1 * w], 0.0022, cy, 0.4);
          P.dome(ox, oy, 0.022, 0.022, 0, [172, 206, 240], { lift: 0.01, spec: 0.8, rim: 0.5, nonote: true, a: 0.92 });
          P.emit(ox, oy, 0.036, 0.036, 0, cy, 0.7); P.dome(ox, oy, 0.008, 0.008, 0, [220, 252, 255], { spec: 0.9, nonote: true }); P.light(ox, oy, 0.006, cy, 'pulse', 2.6, i * 0.3 + (s > 0 ? 0 : 0.5));
        });
      }
      // canopy
      P.dome(0.14, 0, 0.115, 0.072 * w, 0, [166, 218, 240], { lift: 0.01, liftA: 0.5, a: 0.94, spec: 0.8, k: 0.9 });
      P.emit(0.15, 0, 0.09, 0.055 * w, 0, cy, 0.55);
      P.light(0.17, 0, 0.008, [200, 250, 255], 'pulse', 3, 0.1, 1.2);
      // halo rings
      const rxs = [-0.06, 0.24, -0.3];
      for (let i = 0; i < nrg; i++) {
        const x = rxs[i], ry = 0.115 * w + 0.075 + 0.03 * i;
        P.dome(x, 0, 0.011 + h * 0.0016, ry, 0, pearl, { lift: 0.014, liftA: 0.5, spec: 0.5, k: 0.9, rim: 0.4 });
        P.strip([x, -ry * 0.94, x, ry * 0.94], 0.0026, cy, 0.9);
        P.light(x, ry * 0.97, 0.007, cy, 'pulse', 1.8, i * 0.3); P.light(x, -ry * 0.97, 0.007, cy, 'pulse', 1.8, i * 0.3 + 0.5);
      }
      P.fill(P.rect(-0.28, -0.012, 0.1, 0.024), tm, { bev: 0.003, edge: 0.3, nonote: true, round: 0.5 });
      // doomstar: the great lens
      if (h === 4) {
        P.dome(-0.19, 0, 0.085, 0.085, 0, [22, 40, 76], { lift: 0.006, spec: 0.4 });
        P.emit(-0.19, 0, 0.18, 0.18, 0, cy, 0.8);
        P.dome(-0.19, 0, 0.04, 0.04, 0, [190, 250, 255], { spec: 0.9 });
        g.strokeStyle = rgba(cy, 0.9); g.lineWidth = 0.004; g.beginPath(); g.arc(-0.19, 0, 0.085, 0, TAU); g.stroke(); g.lineWidth = 0.0025; g.beginPath(); g.arc(-0.19, 0, 0.064, 0, TAU); g.stroke();
      }
      // ion engines
      P.both(function (s) {
        const y = s * 0.04 * w;
        g.strokeStyle = rgba(cy, 0.95); g.lineWidth = 0.0042; g.beginPath(); g.ellipse(-0.464, y, 0.006, 0.02 * w, 0, 0, TAU); g.stroke();
        P.emit(-0.468, y, 0.03, 0.026 * w, 0, cy, 0.7);
        P.engAt(-0.468, y, 0.016 * w);
      });
      if (h >= 2) { P.emit(-0.47, 0, 0.034, 0.028 * w, 0, cy, 0.7); P.engAt(-0.47, 0, 0.02 * w); }
      P.hardSym('turret', 0.04, 0.07 * w, 0.013); P.hardSym('turret', -0.2, 0.07 * w, 0.013);
      P.hardSym('turret', 0.28, 0.04 * w, 0.011); P.hardSym('turret', -0.34, 0.05 * w, 0.011);
      P.hard('pod', -0.12, 0, 0.045 * w);
      P.hardSym('troop', -0.1, 0.13 * w, 0.018);
      P.hardSym('rack', 0.08, 0.13 * w, 0.014);
      P.hard('bay', -0.3, 0, 0.04, { w: 0.02 * w });
    }
  };

  // ---------------------------------------------------------------- SAKKRA
  // organic, horned and spiked: ribbed green hull, ochre scutes, membrane wings on bone spars
  DESIGNS.sakkra = {
    pal: { base: '#5d9c3b', light: '#a2d25c', dark: '#203818', deep: '#0f1b0b', ochre: '#cb9c36', bone: '#efe3b2', eng: ['#fffbc8', '#d8ff40', '#6aa820'], glow: '#e0ff44', win: '#ffd23a' },
    hw: [0.3, 0.37, 0.44, 0.51, 0.6],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g;
      const green = pal.base, och = pal.ochre, bone = pal.bone, dk = pal.dark;
      const k = [0.85, 0.95, 1.05, 1.18, 1.35][h], ns = [2, 3, 3, 4, 5][h], wy = [0.3, 0.36, 0.42, 0.49, 0.58][h], nsp = [4, 6, 7, 9, 12][h], nrib = [3, 4, 5, 7, 9][h];
      const half = [0.5, 0, 0.45, 0.026, 0.37, 0.058, 0.28, 0.074, 0.2, 0.052, 0.1, 0.07 * k, -0.04, 0.09 * k, -0.18, 0.085 * k, -0.3, 0.06 * k, -0.42, 0.034 * k, -0.52, 0];
      // ---- membrane wings on bone spars ----
      P.both(function (s) {
        const tips = [];
        for (let i = 0; i < ns; i++) { const f = ns === 1 ? 0 : i / (ns - 1); tips.push([lerp(0.26, -0.34, f), s * wy * (0.96 - 0.3 * f)]); }
        const rF = [0.12, s * 0.07 * k], rR = [-0.24, s * 0.075 * k];
        const mem = P.custom(function (p) {
          p.moveTo(rF[0], rF[1]); p.lineTo(tips[0][0], tips[0][1]);
          for (let i = 0; i < ns - 1; i++) {
            const a = tips[i], b = tips[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
            p.quadraticCurveTo(mx - 0.02, s * (abs(my) - (abs(my) - 0.08) * 0.36), b[0], b[1]);
          }
          p.lineTo(rR[0], rR[1]); p.closePath();
        }, -0.4, s > 0 ? 0.04 : -wy - 0.03, 0.3, s > 0 ? wy + 0.03 : -0.04);
        P.fill(mem, mixc(och, dk, 0.22), { lift: 0.012, bev: 0.011, skin: { cw: 0.16, ch: 0.12, tint: 0.06, seam: 0.0 } });
        P.clipTo(mem, function () {
          const gr = g.createLinearGradient(0, s * 0.06, 0, s * wy);
          gr.addColorStop(0, rgba(dk, 0.45)); gr.addColorStop(0.5, rgba(dk, 0)); gr.addColorStop(1, rgba([255, 230, 150], 0.18));
          g.fillStyle = gr; g.fillRect(-0.45, Math.min(0, s * wy), 0.8, wy);
        });
        for (let i = 0; i < ns; i++) {
          const t = tips[i];
          P.stroke([0.04, s * 0.07 * k, t[0], t[1]], 0.003, dk, 0.3);
          P.tube(0.06, s * 0.062 * k, t[0], t[1], 0.011 * k, 0.0035, bone, { lift: 0.008, cap2: true, nonote: true });
        }
        const t0 = tips[0];
        P.fill(P.poly([t0[0] + 0.05, t0[1] - s * 0.01, t0[0] - 0.005, t0[1] + s * 0.006, t0[0] - 0.012, t0[1] - s * 0.016]), bone, { bev: 0.004, nonote: true });
        P.hard('rack', 0.0, s * wy * 0.45, 0.016);
      });
      // ---- spikes along the flanks ----
      P.both(function (s) {
        for (let i = 0; i < nsp; i++) {
          const x = lerp(0.18, -0.4, i / (nsp - 1)), y = halfAt(half, x), len = 0.035 + 0.03 * k * (1 - abs(i / (nsp - 1) - 0.4));
          P.fill(P.poly([x + 0.014, s * y * 0.85, x - 0.016, s * y * 0.85, x - 0.045, s * (y + len)]), mixc(bone, och, 0.2), { lift: 0.005, bev: 0.005, nonote: true, edge: 0.55 });
        }
      });
      // ---- body ----
      const body = P.curve(symPts(half), true);
      P.fill(body, green, { lift: 0.014, round: 0.9, bev: 0.013, skin: { cw: 0.05, ch: 0.035, tint: 0.09, seam: 0.2 } });
      // ribs
      P.both(function (s) {
        for (let i = 0; i < nrib; i++) {
          const x = lerp(0.14, -0.34, i / (nrib - 1)), y = halfAt(half, x);
          P.tube(x + 0.01, s * 0.012, x - 0.012, s * y * 0.5, 0.0075, 0.0065, bone, { nonote: true, edge: 0.4 });
          P.tube(x - 0.012, s * y * 0.5, x - 0.045, s * y * 0.92, 0.0065, 0.0045, bone, { nonote: true, edge: 0.4, cap2: true });
        }
      });
      // dorsal scutes
      for (let x = 0.22; x > -0.42; x -= 0.05) {
        const y = halfAt(half, x) * 0.42;
        P.fill(P.poly([x + 0.03, 0, x, y * 0.78, x - 0.026, 0, x, -y * 0.78]), mixc(och, green, abs(x) * 0.5), { lift: 0.005, bev: 0.006, nonote: true, round: 0.6 });
      }
      P.fill(P.rect(-0.22, -0.01 * k, 0.1, 0.02 * k), tm, { bev: 0.003, edge: 0.3, nonote: true });
      // ---- horns + head ----
      P.both(function (s) {
        const horn = P.curve([0.3, s * 0.05, 0.38, s * 0.088, 0.46, s * 0.118 * k, 0.535, s * 0.1, 0.495, s * 0.082, 0.42, s * 0.068, 0.34, s * 0.036], true, 1);
        P.fill(horn, mixc(bone, och, 0.15), { lift: 0.01, round: 0.5, bev: 0.007, rim: 0.4 });
        if (h >= 2) {
          const h2 = P.curve([0.12, s * 0.08 * k, 0.2, s * 0.15 * k, 0.28, s * 0.205 * k, 0.37, s * 0.215 * k, 0.31, s * 0.185 * k, 0.22, s * 0.12 * k, 0.15, s * 0.07 * k], true, 1);
          P.fill(h2, mixc(bone, och, 0.25), { lift: 0.008, round: 0.5, bev: 0.006 });
        }
        P.dome(0.335, s * 0.036, 0.016, 0.011, s * 0.3, [255, 220, 70], { spec: 0.6, edge: 0.4, nonote: true });
        P.emit(0.335, s * 0.036, 0.034, 0.022, 0, [255, 220, 70], 0.8);
        P.light(0.335, s * 0.036, 0.005, [255, 245, 150], 'steady');
      });
      P.stroke([0.48, 0, 0.36, 0], 0.003, dk, 0.5);
      if (h === 4) { // gaping maw
        P.dome(0.47, 0, 0.04, 0.036, 0, [20, 14, 8], { spec: 0.1, nonote: true });
        P.emit(0.47, 0, 0.1, 0.08, 0, [255, 210, 80], 0.9);
        for (let q = 0; q < 5; q++) { const yy = -0.03 + q * 0.015; P.fill(P.poly([0.5, yy - 0.006, 0.5, yy + 0.006, 0.52, yy]), bone, { bev: 0.001, nonote: true }); }
      }
      // tail barb + organ engines
      P.fill(P.poly([-0.55, 0, -0.43, 0.02, -0.43, -0.02]), mixc(bone, och, 0.2), { lift: 0.005, bev: 0.005 });
      P.both(function (s) {
        P.dome(-0.37, s * 0.052 * k, 0.034 * k, 0.026 * k, 0, och, { lift: 0.008, spec: 0.6 });
        P.fill(P.rect(-0.405, s * 0.052 * k - 0.011 * k, 0.03, 0.022 * k), [255, 240, 120], { flat: true, bev: 0.002, edge: 0.4, nonote: true });
        P.emit(-0.405, s * 0.052 * k, 0.045, 0.04 * k, 0, [220, 255, 70], 0.9);
        P.engAt(-0.407, s * 0.052 * k, 0.02 * k);
      });
      if (h >= 3) { P.emit(-0.43, 0, 0.04, 0.03, 0, [220, 255, 70], 0.8); P.engAt(-0.43, 0, 0.022); }
      P.hardSym('turret', 0.1, 0.05 * k, 0.014); P.hardSym('turret', -0.14, 0.07 * k, 0.014); P.hardSym('turret', 0.22, 0.04, 0.012);
      P.hard('pod', -0.08, 0, 0.04 * k);
      P.hardSym('troop', -0.25, 0.075 * k, 0.018);
      P.hard('bay', -0.27, 0, 0.04, { w: 0.02 * k });
    }
  };

  // ---------------------------------------------------------------- SILICOID
  // crystalline shard clusters: translucent faceted gems, inner glow, teal fading to violet
  DESIGNS.silicoid = {
    pal: { base: '#2fd8c6', violet: '#8b5cff', light: '#c8fff4', dark: '#0d3a56', deep: '#06182b', eng: ['#ffffff', '#a8fff0', '#7a6cff'], glow: '#aefcf0', win: '#e8ffff' },
    hw: [0.26, 0.33, 0.41, 0.5, 0.6],
    build: function (P, h) {
      const pal = P.pal, tm = P.team, g = P.g, teal = pal.base, vio = pal.violet;
      const wm = [0.1, 0.12, 0.15, 0.18, 0.22][h], n2 = [4, 6, 8, 11, 15][h], r = P.rnd;
      const hue = function (x) { return mixc(teal, vio, clamp(0.42 - x * 1.1 + (r() - 0.5) * 0.35, 0, 1)); };
      // background shards, outermost first
      const list = [];
      for (let i = 0; i < n2; i++) {
        const s = (i % 2) ? 1 : -1, x = lerp(-0.3, 0.26, r());
        list.push({ x: x, y: s * wm * (0.55 + r() * 1.0), rot: s * (0.12 + r() * 0.85) * (r() < 0.78 ? 1 : -0.4), len: (0.24 + r() * 0.3 + 0.03 * h), w: wm * (0.5 + r() * 0.55) });
      }
      list.sort(function (a, b) { return abs(b.y) - abs(a.y); });
      list.forEach(function (c) { P.gem(c.x, c.y, c.rot, c.len, c.w, hue(c.x), { a: 0.9, lift: 0.014 }); });
      // main crystal with a couple of crossing shards on top
      P.gem(0.04, 0, 0, 0.92, wm * 1.7, mixc(teal, vio, 0.15), { a: 0.94, lift: 0.02, tf: 1.9, tr: 1.1, z: 1.1 });
      P.gem(0.12, wm * 0.2, 0.1, 0.5, wm * 0.9, mixc(teal, [210, 255, 250], 0.35), { a: 0.85, lift: 0.01, z: 1.3 });
      P.gem(-0.12, -wm * 0.2, -0.1, 0.46, wm * 0.8, mixc(vio, teal, 0.35), { a: 0.85, lift: 0.01, z: 1.3 });
      // inner glow + veins (kept soft: the glow layer pulses on top)
      P.emit(0.0, 0, 0.3, wm * 0.9, 0, [150, 255, 240], 0.3);
      P.emit(0.02, 0, 0.09, wm * 0.4, 0, [235, 255, 252], 0.32);
      P.strip([-0.36, 0, 0.0, wm * 0.05, 0.3, 0], 0.0026, [220, 255, 250], 0.55);
      P.strip([-0.26, wm * 0.45, -0.02, wm * 0.2, 0.2, wm * 0.34], 0.0016, [190, 255, 240], 0.4);
      P.strip([-0.26, -wm * 0.45, -0.02, -wm * 0.2, 0.2, -wm * 0.34], 0.0016, [190, 255, 240], 0.4);
      // team shards at the bow
      P.both(function (s) {
        P.gem(0.3, s * wm * 1.15, s * 0.55, 0.15 + 0.02 * h, 0.032 + h * 0.004, tm, { a: 0.95, lift: 0.008, z: 1.2, nonote: true });
        P.light(0.34, s * wm * 1.45, 0.006, tone(tm, 0.4), 'pulse', 2.0, s > 0 ? 0 : 0.5);
      });
      P.light(0.02, 0, 0.008, [220, 255, 250], 'pulse', 2.8, 0.2, 1.2);
      // tiny drifting splinters
      for (let i = 0; i < 4 + h * 2; i++) {
        const a = r() * TAU, d = 0.18 + r() * (0.16 + 0.04 * h);
        P.gem(cos(a) * d * 1.5, sin(a) * d * 0.75 * (1 + h * 0.2), r() * TAU, 0.03 + r() * 0.03, 0.012 + r() * 0.01, hue(cos(a) * d), { a: 0.9, lift: 0.004, nonote: true, edge: 0.4 });
      }
      if (h === 4) {
        P.emit(0.02, 0, 0.5, 0.2, 0, [150, 255, 240], 0.28);
        P.emit(0.02, 0, 0.12, 0.12, 0, [255, 255, 255], 0.42);
      }
      // exhaust crystals
      P.emit(-0.4, 0, 0.06, 0.04, 0, [190, 255, 245], 0.7); P.engAt(-0.4, 0, 0.026 + 0.004 * h);
      P.both(function (s) { P.engAt(-0.3, s * wm * 0.7, 0.017); P.emit(-0.3, s * wm * 0.7, 0.04, 0.025, 0, vio, 0.5); });
      P.hardSym('turret', 0.1, wm * 0.5, 0.013); P.hardSym('turret', -0.2, wm * 0.5, 0.013);
      P.hardSym('turret', 0.28, wm * 0.25, 0.012); P.hardSym('turret', -0.32, wm * 0.3, 0.012);
      P.hard('pod', -0.12, 0, wm * 0.8);
      P.hardSym('troop', -0.05, wm * 1.35, 0.018);
      P.hardSym('rack', 0.0, wm * 1.1, 0.014);
      P.hard('bay', -0.28, 0, 0.04, { w: wm * 0.3 });
    }
  };


  // ==========================================================================
  // 6. stations
  // ==========================================================================
  const TIERS = [
    { ro: 0.43, ri: 0.35, n: 8, hubR: 0.13, spokes: 4, spires: 4, turrets: 4, inner: 0, sl: 0.07 },
    { ro: 0.46, ri: 0.36, n: 12, hubR: 0.165, spokes: 6, spires: 6, turrets: 8, inner: 1, sl: 0.08 },
    { ro: 0.49, ri: 0.375, n: 16, hubR: 0.2, spokes: 8, spires: 8, turrets: 12, inner: 1, sl: 0.09 }
  ];
  function pol(r, a) { return [cos(a) * r, sin(a) * r]; }
  function stTurret(P, x, y, a, r, mat) {
    P.at(x, y, a, function () {
      P.tube(0, -r * 0.34, r * 2.1, -r * 0.34, r * 0.2, r * 0.16, P.pal.dark, { nonote: true, lift: 0.003 });
      P.tube(0, r * 0.34, r * 2.1, r * 0.34, r * 0.2, r * 0.16, P.pal.dark, { nonote: true, lift: 0.003 });
      P.dome(0, 0, r, r, 0, mat || tone(P.pal.base, -0.2), { lift: 0.006, nonote: true });
      P.dome(0, 0, r * 0.58, r * 0.58, 0, tone(P.pal.light, -0.1), { nonote: true });
    });
  }
  function ringPoly(P, a0, a1, ri, ro, ins) { // straight-edged plate between two radii
    const p0 = pol(ri, a0 + ins), p1 = pol(ro, a0 + ins), p2 = pol(ro, a1 - ins), p3 = pol(ri, a1 - ins);
    return P.poly([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]]);
  }
  function spokeTube(P, a, r0, r1, w, col, o) {
    const p0 = pol(r0, a), p1 = pol(r1, a);
    P.tube(p0[0], p0[1], p1[0], p1[1], w, w, col, o || { lift: 0.008, nonote: true });
  }

  const STATION_STYLE = {};
  // ---- human: silver torus segments, windows, solar wings, docking hub
  STATION_STYLE.human = {
    seg: function (P, T, a0, a1, i) {
      const sh = P.sector(a0 + 0.018, a1 - 0.018, T.ri, T.ro);
      P.fill(sh, i % 2 ? P.pal.base : mixc(P.pal.base, P.pal.light, 0.35), { lift: 0.008, round: 0.0, bev: 0.01, skin: { cw: 0.05, ch: 0.04, tint: 0.08 } });
      const am = (a0 + a1) / 2, rm = (T.ri + T.ro) / 2;
      for (let k = -2; k <= 2; k++) { const p = pol(rm, am + k * (a1 - a0) * 0.16); P.fill(P.rect(p[0] - 0.005, p[1] - 0.004, 0.01, 0.008), P.pal.win, { flat: true, bev: 0, edge: 0.3, nonote: true }); }
      const p = pol(T.ro - 0.01, a0 + 0.04); P.light(p[0], p[1], 0.005, i % 3 === 0 ? [255, 70, 60] : [255, 255, 255], 'blink', 1.6, i * 0.13);
    },
    spoke: function (P, T, a, i) { spokeTube(P, a, T.hubR * 0.8, T.ri + 0.01, 0.014, P.pal.base); },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.dome(0, 0, R * 1.18, R * 1.18, 0, P.pal.dark, { lift: 0.012 });
      for (let i = 0; i < 4 + tier * 2; i++) { const a = i / (4 + tier * 2) * TAU + 0.3, p = pol(R * 1.12, a); P.at(p[0], p[1], a, function () { P.fill(P.cham(-0.02, -0.014, 0.05, 0.028, 0.006), P.pal.light, { lift: 0.005, bev: 0.005, nonote: true }); }); }
      P.dome(0, 0, R, R, 0, P.pal.base, { lift: 0.006, k: 0.9 });
      P.dome(0, 0, R * 0.55, R * 0.55, 0, [100, 150, 200], { a: 0.92, spec: 0.8, nonote: true });
      P.emit(0, 0, R * 0.5, R * 0.5, 0, [140, 210, 255], 0.5);
    },
    spire: function (P, T, a, len, i) { const p0 = pol(T.hubR * 0.9, a), p1 = pol(T.ro + len, a); P.tube(p0[0], p0[1], p1[0], p1[1], 0.007, 0.0025, P.pal.light, { lift: 0.006, nonote: true }); P.light(p1[0], p1[1], 0.006, [255, 255, 255], 'blink', 2.2, i * 0.21); },
    extra: function (P, T, tier) {
      for (let q = 0; q < 4; q++) {
        const a = q * PI / 2 + PI / 4, p = pol(T.ro - 0.02, a);
        P.at(p[0], p[1], a, function () {
          P.tube(0, 0, 0.05, 0, 0.008, 0.008, P.pal.light, { nonote: true });
          for (const s of [1, -1]) {
            P.fill(P.rect(0.04, s * 0.05 - 0.034 + (s > 0 ? 0 : 0.0), 0.1 + tier * 0.02, 0.068), [38, 70, 150], { lift: 0.006, bev: 0.006, nonote: true });
            for (let k = 1; k < 5; k++) P.stroke([0.04 + k * (0.1 + tier * 0.02) / 5, s * 0.05 - 0.034, 0.04 + k * (0.1 + tier * 0.02) / 5, s * 0.05 + 0.034], 0.0018, [150, 190, 255], 0.55);
            P.stroke([0.04, s * 0.05, 0.14 + tier * 0.02, s * 0.05], 0.0018, [150, 190, 255], 0.55);
          }
        });
      }
    }
  };
  // ---- alkari: feather-vane ring, crest hub, blade spires
  STATION_STYLE.alkari = {
    seg: function (P, T, a0, a1, i) {
      P.fill(P.sector(a0 + 0.015, a1 - 0.015, T.ri, T.ro), mixc(P.pal.base, P.pal.dark, (i % 2) * 0.2), { lift: 0.008, round: 0.0, bev: 0.01 });
      const rm = T.ro * 0.94, a = a0 + (a1 - a0) * 0.1, p = pol(rm, a), len = rm * (a1 - a0) * 1.0;
      P.feather(p[0], p[1], a + PI / 2 + 0.12, len, 0.055, mixc(P.pal.base, P.pal.light, 0.35), { tip: P.pal.light, lift: 0.004, nonote: true });
      const q = pol(T.ri + 0.01, a0 + (a1 - a0) * 0.1);
      P.feather(q[0], q[1], a + PI / 2 + 0.1, len * 0.9, 0.045, mixc(P.pal.base, P.pal.dark, 0.3), { tip: P.pal.gold, lift: 0.004, nonote: true });
    },
    spoke: function (P, T, a, i) { spokeTube(P, a, T.hubR * 0.8, T.ri + 0.01, 0.014, mixc(P.pal.base, P.pal.light, 0.2)); },
    hub: function (P, T, tier) {
      const R = T.hubR;
      for (let i = 0; i < 10 + tier * 4; i++) { const a = i / (10 + tier * 4) * TAU, p = pol(R * 0.8, a); P.feather(p[0], p[1], a + 0.35, R * 1.0, 0.04, i % 2 ? P.pal.gold : mixc(P.pal.base, P.pal.light, 0.3), { tip: P.pal.light, nonote: true, lift: 0.004 }); }
      P.dome(0, 0, R * 0.78, R * 0.78, 0, P.pal.base, { lift: 0.01 });
      P.dome(0, 0, R * 0.42, R * 0.42, 0, [255, 214, 130], { spec: 0.9 });
      P.emit(0, 0, R * 0.7, R * 0.7, 0, [255, 190, 90], 0.6);
    },
    spire: function (P, T, a, len, i) { const p = pol(T.hubR * 0.7, a); P.feather(p[0], p[1], a, T.ro - T.hubR * 0.7 + len, 0.034, mixc(P.pal.gold, P.pal.light, 0.2), { tip: P.pal.light, lift: 0.006, nonote: true }); }
  };
  // ---- bulrathi: straight armour plates, octagon bunker hub, heavy gun towers
  STATION_STYLE.bulrathi = {
    seg: function (P, T, a0, a1, i) {
      const sh = ringPoly(P, a0, a1, T.ri, T.ro, 0.012);
      P.fill(sh, i % 2 ? P.pal.base : P.pal.plate, { lift: 0.01, bev: 0.012, skin: { cw: 0.06, ch: 0.04, tint: 0.14 } });
      for (const aa of [a0 + 0.035, a1 - 0.035]) for (const rr of [T.ri + 0.012, T.ro - 0.012]) { const p = pol(rr, aa); P.rivet(p[0], p[1], 0.0045, P.pal.base); }
      if (i % 3 === 0) P.clipTo(sh, function () {
        const g = P.g; g.fillStyle = rgba(P.team, 0.85);
        const am = (a0 + a1) / 2, c = pol((T.ri + T.ro) / 2, am);
        P.at(c[0], c[1], am, function () { for (let k = -3; k < 3; k += 2) { g.beginPath(); g.moveTo(k * 0.014, -0.05); g.lineTo((k + 1) * 0.014, -0.05); g.lineTo((k + 1) * 0.014 + 0.03, 0.05); g.lineTo(k * 0.014 + 0.03, 0.05); g.closePath(); g.fill(); } });
      });
    },
    spoke: function (P, T, a, i) { P.at(0, 0, a, function () { P.fill(P.cham(T.hubR * 0.8, -0.022, T.ri - T.hubR * 0.8 + 0.01, 0.044, 0.008), P.pal.steel, { lift: 0.008, skin: true, bev: 0.007, nonote: true }); }); },
    hub: function (P, T, tier) {
      const R = T.hubR, pts = [];
      for (let k = 0; k < 8; k++) { const p = pol(R * 1.12, k * PI / 4 + PI / 8); pts.push(p[0], p[1]); }
      P.fill(P.poly(pts), P.pal.steel, { lift: 0.012, bev: 0.014, skin: { cw: 0.05, ch: 0.04, tint: 0.14 } });
      const pts2 = [];
      for (let k = 0; k < 8; k++) { const p = pol(R * 0.72, k * PI / 4 + PI / 8); pts2.push(p[0], p[1]); }
      P.fill(P.poly(pts2), P.pal.base, { lift: 0.008, bev: 0.01, skin: true });
      P.dome(0, 0, R * 0.34, R * 0.34, 0, [255, 190, 90], { spec: 0.7 }); P.emit(0, 0, R * 0.55, R * 0.55, 0, [255, 170, 70], 0.7);
      for (let k = 0; k < 8; k++) { const p = pol(R * 1.0, k * PI / 4 + PI / 8); P.rivet(p[0], p[1], 0.005, P.pal.base); }
    },
    spire: function (P, T, a, len, i) { const p = pol(T.ro - 0.02, a); P.at(p[0], p[1], a, function () { P.tube(0, -0.012, 0.09 + len, -0.012, 0.011, 0.01, P.pal.dark, { nonote: true, lift: 0.004 }); P.tube(0, 0.012, 0.09 + len, 0.012, 0.011, 0.01, P.pal.dark, { nonote: true, lift: 0.004 }); P.fill(P.cham(-0.035, -0.035, 0.07, 0.07, 0.012), P.pal.base, { lift: 0.01, skin: true, bev: 0.01, nonote: true }); P.dome(0, 0, 0.016, 0.016, 0, P.pal.plate, { nonote: true }); }); }
  };
  // ---- darlok: dark faceted shard ring, violet strips, hex prism hub
  STATION_STYLE.darlok = {
    seg: function (P, T, a0, a1, i) {
      const am = (a0 + a1) / 2, vio = P.pal.violet;
      const A = pol(T.ri, a0 + 0.01), B = pol(T.ro + 0.02, am), C = pol(T.ri, a1 - 0.01), D = pol((T.ri + T.ro) / 2, am);
      const Dz = [D[0], D[1], 0.07];
      P.drop(P.poly([A[0], A[1], B[0], B[1], C[0], C[1]]), 0.01, 0.5);
      P.facet([A[0], A[1], 0], [B[0], B[1], 0], Dz, P.pal.base, { k: 1.25, hiMax: 0.34 });
      P.facet([B[0], B[1], 0], [C[0], C[1], 0], Dz, P.pal.base, { k: 1.25, hiMax: 0.34 });
      P.facet([C[0], C[1], 0], [A[0], A[1], 0], Dz, mixc(P.pal.base, P.pal.dark, 0.4), { k: 1.25, hiMax: 0.34 });
      P.strip([A[0], A[1], B[0], B[1], C[0], C[1]], 0.0028, vio, 0.8, false);
    },
    spoke: function (P, T, a, i) { const p0 = pol(T.hubR * 0.8, a), p1 = pol(T.ri, a); P.tube(p0[0], p0[1], p1[0], p1[1], 0.01, 0.007, P.pal.dark, { lift: 0.006, nonote: true }); P.strip([p0[0], p0[1], p1[0], p1[1]], 0.0022, P.pal.violet, 0.7); },
    hub: function (P, T, tier) {
      const R = T.hubR, pts = [];
      for (let k = 0; k < 6; k++) { const p = pol(R * 1.15, k * PI / 3); pts.push(p[0], p[1]); }
      for (let k = 0; k < 6; k++) {
        const p = pol(R * 1.15, k * PI / 3), q = pol(R * 1.15, (k + 1) * PI / 3);
        P.facet([p[0], p[1], 0], [q[0], q[1], 0], [0, 0, 0.09], P.pal.base, { k: 1.25, hiMax: 0.34 });
      }
      P.strip(pts, 0.003, P.pal.violet, 0.9, true);
      P.dome(0, 0, R * 0.38, R * 0.38, 0, [14, 8, 26], { spec: 0.3 }); P.emit(0, 0, R * 0.8, R * 0.8, 0, P.pal.violet, 0.8);
    },
    spire: function (P, T, a, len, i) { const p0 = pol(T.hubR, a), p1 = pol(T.ro + len, a); P.at(0, 0, a, function () { P.facet([T.hubR, -0.014, 0], [T.ro + len, 0, 0], [T.hubR, 0.014, 0], P.pal.base, { k: 1.4, hiMax: 0.34 }); P.stroke([T.hubR, 0, T.ro + len, 0], 0.0022, P.pal.violet, 0.8); }); P.light(p1[0], p1[1], 0.005, P.pal.violet, 'pulse', 2.4, i * 0.2); }
  };
  // ---- klackon: chitin pods ring, jointed leg spokes, eyed hub
  STATION_STYLE.klackon = {
    seg: function (P, T, a0, a1, i) {
      const am = (a0 + a1) / 2, rm = (T.ri + T.ro) / 2, c = pol(rm, am), arc = rm * (a1 - a0);
      P.dome(c[0], c[1], arc * 0.56, (T.ro - T.ri) * 0.62, am + PI / 2, mixc(P.pal.base, P.pal.brown, (i % 2) * 0.35), { lift: 0.01, spec: 0.5 });
      const p = pol(rm, am); P.light(p[0], p[1], 0.0045, [255, 210, 80], 'pulse', 2.4, i * 0.2);
    },
    spoke: function (P, T, a, i) {
      const k = pol((T.hubR + T.ri) / 2, a + 0.18), p0 = pol(T.hubR * 0.8, a), p1 = pol(T.ri, a);
      P.tube(p0[0], p0[1], k[0], k[1], 0.014, 0.011, P.pal.brown, { lift: 0.006, nonote: true, cap2: true });
      P.tube(k[0], k[1], p1[0], p1[1], 0.011, 0.008, P.pal.base, { lift: 0.006, nonote: true, cap1: true });
      P.dome(k[0], k[1], 0.014, 0.014, 0, P.pal.brown, { nonote: true });
    },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.dome(0, 0, R * 1.1, R * 1.1, 0, mixc(P.pal.base, P.pal.brown, 0.3), { lift: 0.012, spec: 0.6 });
      for (let k = 0; k < 3 + tier; k++) { const a = k / (3 + tier) * TAU + 0.5, p = pol(R * 0.55, a); P.dome(p[0], p[1], R * 0.28, R * 0.25, a, [255, 190, 50], { spec: 0.8 }); P.emit(p[0], p[1], R * 0.4, R * 0.35, a, [255, 190, 60], 0.6); }
    },
    spire: function (P, T, a, len, i) { const p0 = pol(T.hubR, a), m = pol(T.ro, a + 0.12), p1 = pol(T.ro + len, a + 0.05); P.stroke([p0[0], p0[1], m[0], m[1], p1[0], p1[1]], 0.0035, P.pal.brown, 0.95); P.light(p1[0], p1[1], 0.006, [255, 230, 90], 'pulse', 1.8, i * 0.2); }
  };
  // ---- meklar: rectilinear plates, truss spokes, red optic hub
  STATION_STYLE.meklar = {
    seg: function (P, T, a0, a1, i) {
      const sh = ringPoly(P, a0, a1, T.ri, T.ro, 0.01);
      P.fill(sh, P.pal.base, { lift: 0.01, bev: 0.01, skin: { cw: 0.05, ch: 0.04, tint: 0.12, seam: 0.4 } });
      const am = (a0 + a1) / 2, p = pol((T.ri + T.ro) / 2, am), q = pol(T.ro - 0.012, am);
      P.strip([p[0], p[1], q[0], q[1]], 0.0022, P.pal.circuit, 0.85);
      P.light(q[0], q[1], 0.0055, P.pal.red, 'blink', 1.3 + (i % 3) * 0.2, i * 0.17);
    },
    spoke: function (P, T, a, i) {
      P.at(0, 0, a, function () {
        const x0 = T.hubR * 0.8, x1 = T.ri + 0.01;
        P.fill(P.rect(x0, -0.016, x1 - x0, 0.032), [22, 24, 30], { lift: 0.006, bev: 0.004, nonote: true });
        const n = max(2, round((x1 - x0) / 0.04));
        for (let k = 0; k < n; k++) { const xa = lerp(x0, x1, k / n), xb = lerp(x0, x1, (k + 1) / n); P.stroke([xa, -0.016, xb, 0.016], 0.002, P.pal.light, 0.5); P.stroke([xa, 0.016, xb, -0.016], 0.002, P.pal.light, 0.5); }
        P.stroke([x0, -0.016, x1, -0.016], 0.0035, P.pal.light, 0.65); P.stroke([x0, 0.016, x1, 0.016], 0.0035, P.pal.light, 0.65);
      });
    },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.rot(PI / 4, function () { P.fill(P.cham(-R, -R, R * 2, R * 2, R * 0.2), P.pal.dark, { lift: 0.012, skin: true, bev: 0.012 }); });
      P.fill(P.cham(-R * 0.78, -R * 0.78, R * 1.56, R * 1.56, R * 0.15), P.pal.base, { lift: 0.008, skin: { cw: 0.05, ch: 0.04, tint: 0.12 }, bev: 0.01 });
      P.dome(0, 0, R * 0.42, R * 0.42, 0, [24, 10, 12], { spec: 0.2 }); P.emit(0, 0, R * 0.9, R * 0.9, 0, P.pal.red, 0.9); P.dome(0, 0, R * 0.2, R * 0.2, 0, [255, 100, 90], { spec: 0.9 });
      const g = P.g; g.strokeStyle = rgba(P.pal.light, 0.7); g.lineWidth = 0.003; g.beginPath(); g.arc(0, 0, R * 0.42, 0, TAU); g.stroke();
    },
    spire: function (P, T, a, len, i) { const p0 = pol(T.hubR, a), p1 = pol(T.ro + len, a); P.tube(p0[0], p0[1], p1[0], p1[1], 0.0045, 0.0025, P.pal.light, { nonote: true }); P.light(p1[0], p1[1], 0.0055, P.pal.red, 'blink', 1.5, i * 0.2); }
  };
  // ---- mrrshan: curved gold claws with black stripes, slit-eye hub, fang spires
  STATION_STYLE.mrrshan = {
    seg: function (P, T, a0, a1, i) {
      P.fill(P.sector(a0 + 0.012, a1 - 0.012, T.ri, T.ro), mixc(P.pal.base, P.pal.dark, (i % 2) * 0.18), { lift: 0.008, bev: 0.01 });
      const am = (a0 + a1) / 2, rm = (T.ri + T.ro) / 2;
      const q = [pol(T.ri + 0.005, a0 + 0.02), pol(T.ro + 0.015, a0 + (a1 - a0) * 0.45), pol(T.ro + 0.02, a1 - 0.02), pol(T.ro - 0.02, a1 - 0.03), pol(rm, a0 + (a1 - a0) * 0.5)];
      const claw = P.curve([q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1], q[4][0], q[4][1]], true, 1);
      P.fill(claw, mixc(P.pal.light, P.pal.base, 0.3), { lift: 0.006, round: 0.0, bev: 0.007, nonote: true });
      P.clipTo(P.sector(a0 + 0.012, a1 - 0.012, T.ri, T.ro), function () { const s0 = pol(T.ri, a0 + (a1 - a0) * 0.2), s1 = pol(T.ro, a0 + (a1 - a0) * 0.45); P.stroke([s0[0], s0[1], s1[0], s1[1]], 0.014, P.pal.stripe, 0.9); });
    },
    spoke: function (P, T, a, i) { const k = pol((T.hubR + T.ri) / 2, a - 0.12), p0 = pol(T.hubR * 0.8, a), p1 = pol(T.ri + 0.01, a); P.tube(p0[0], p0[1], k[0], k[1], 0.014, 0.012, P.pal.base, { lift: 0.006, nonote: true, cap2: true }); P.tube(k[0], k[1], p1[0], p1[1], 0.012, 0.01, P.pal.base, { lift: 0.006, nonote: true, cap1: true }); },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.dome(0, 0, R * 1.15, R * 1.15, 0, P.pal.base, { lift: 0.012, spec: 0.5 });
      P.fill(P.ell(0, 0, R * 0.78, R * 0.46, 0), [255, 218, 100], { flat: true, bev: 0.006, edge: 0.7, nonote: true });
      P.emit(0, 0, R * 0.95, R * 0.6, 0, [255, 200, 70], 0.8);
      P.fill(P.ell(0, 0, R * 0.14, R * 0.46, 0), [18, 12, 6], { flat: true, bev: 0.002, edge: 0.4, nonote: true });
      for (let k = 0; k < 6 + tier * 2; k++) { const a = k / (6 + tier * 2) * TAU, p = pol(R * 1.1, a); P.at(p[0], p[1], a, function () { P.fill(P.poly([0, -0.012, 0.04, 0, 0, 0.012]), P.pal.stripe, { nonote: true, bev: 0.003 }); }); }
    },
    spire: function (P, T, a, len, i) { const p = pol(T.ro - 0.03, a); P.at(p[0], p[1], a, function () { const fang = P.curve([0, -0.016, 0.05 + len, -0.03, 0.1 + len, -0.006, 0.05, 0.004], true, 1); P.fill(fang, P.pal.light, { lift: 0.006, round: 0.0, bev: 0.005, nonote: true }); }); }
  };
  // ---- psilon: smooth pearl torus with a cyan inlay, orb nodes, crown of spires
  STATION_STYLE.psilon = {
    seg: function (P, T, a0, a1, i) {
      P.fill(P.sector(a0 + 0.004, a1 - 0.004, T.ri, T.ro), P.pal.base, { lift: 0.008, bev: 0.012, rim: 0.5, rimC: [150, 235, 255], k: 0.8 });
    },
    spoke: function (P, T, a, i) {
      spokeTube(P, a, T.hubR * 0.8, T.ri, 0.008, mixc(P.pal.base, P.pal.lilac, 0.3));
      const p = pol(T.ri, a); P.dome(p[0], p[1], 0.022, 0.022, 0, P.pal.base, { lift: 0.008, spec: 0.8, nonote: true }); P.light(p[0], p[1], 0.006, P.pal.cyan, 'pulse', 2.4, i * 0.2);
    },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.dome(0, 0, R * 1.1, R * 1.1, 0, P.pal.base, { lift: 0.014, spec: 0.8, k: 0.85 });
      P.dome(0, 0, R * 0.7, R * 0.7, 0, [166, 218, 240], { a: 0.94, spec: 0.9, nonote: true });
      P.emit(0, 0, R * 0.8, R * 0.8, 0, P.pal.cyan, 0.6);
      const g = P.g; g.strokeStyle = rgba(P.pal.cyan, 0.9); g.lineWidth = 0.004; g.beginPath(); g.arc(0, 0, R * 0.92, 0, TAU); g.stroke();
    },
    spire: function (P, T, a, len, i) { const p0 = pol(T.hubR, a), p1 = pol(T.ro + len * 1.1, a); P.tube(p0[0], p0[1], p1[0], p1[1], 0.006, 0.002, mixc(P.pal.base, P.pal.lilac, 0.3), { lift: 0.005, nonote: true }); P.light(p1[0], p1[1], 0.006, P.pal.cyan, 'pulse', 2.0, i * 0.17); },
    extra: function (P, T, tier) {
      const pts = [], rm = (T.ri + T.ro) / 2;
      for (let k = 0; k < 64; k++) { const p = pol(rm, k / 64 * TAU); pts.push(p[0], p[1]); }
      P.strip(pts, 0.0034, P.pal.cyan, 0.9, true);
    }
  };
  // ---- sakkra: ribbed ring with bone horns, scute line, maw hub
  STATION_STYLE.sakkra = {
    seg: function (P, T, a0, a1, i) {
      const am = (a0 + a1) / 2, p = pol(T.ro - 0.01, am);
      P.at(p[0], p[1], am, function () { P.fill(P.poly([-0.02, -0.022, 0.07 + T.sl * 0.5, 0, -0.02, 0.022]), mixc(P.pal.bone, P.pal.ochre, 0.2), { lift: 0.006, bev: 0.006, nonote: true }); });
      P.fill(P.sector(a0 + 0.012, a1 - 0.012, T.ri, T.ro), P.pal.base, { lift: 0.01, bev: 0.011, skin: { cw: 0.05, ch: 0.035, tint: 0.09, seam: 0.2 } });
      const pa = pol(T.ri + 0.004, am - (a1 - a0) * 0.2), pb = pol(T.ro - 0.004, am - (a1 - a0) * 0.05);
      P.stroke([pa[0], pa[1], pb[0], pb[1]], 0.007, P.pal.bone, 0.9);
      const c = pol((T.ri + T.ro) / 2, am); P.dome(c[0], c[1], 0.016, 0.012, am + PI / 2, P.pal.ochre, { nonote: true, spec: 0.5 });
    },
    spoke: function (P, T, a, i) { spokeTube(P, a, T.hubR * 0.8, T.ri + 0.01, 0.011, P.pal.bone, { lift: 0.006, nonote: true }); for (let k = 0; k < 3; k++) { const p = pol(lerp(T.hubR, T.ri, (k + 0.5) / 3), a); P.dome(p[0], p[1], 0.014, 0.01, a + PI / 2, P.pal.ochre, { nonote: true }); } },
    hub: function (P, T, tier) {
      const R = T.hubR;
      P.dome(0, 0, R * 1.12, R * 1.12, 0, P.pal.base, { lift: 0.012, spec: 0.5 });
      for (let k = 0; k < 8 + tier * 2; k++) { const a = k / (8 + tier * 2) * TAU, p = pol(R * 1.05, a); P.at(p[0], p[1], a, function () { P.fill(P.poly([-0.01, -0.012, 0.04, 0, -0.01, 0.012]), P.pal.bone, { nonote: true, bev: 0.003 }); }); }
      P.fill(P.ell(0, 0, R * 0.62, R * 0.3, 0.3), [255, 226, 90], { flat: true, edge: 0.7, nonote: true, bev: 0.005 }); P.emit(0, 0, R * 0.9, R * 0.5, 0.3, [255, 220, 80], 0.9);
      P.fill(P.ell(0, 0, R * 0.12, R * 0.3, 0.3), [30, 20, 6], { flat: true, edge: 0.4, nonote: true, bev: 0.002 });
    },
    spire: function (P, T, a, len, i) { const p = pol(T.ro - 0.03, a); P.at(p[0], p[1], a, function () { const horn = P.curve([0, -0.014, 0.05 + len, -0.028, 0.11 + len, -0.006, 0.05, 0.008], true, 1); P.fill(horn, P.pal.bone, { lift: 0.006, bev: 0.005, nonote: true }); }); }
  };
  // ---- silicoid: ring of tangential gems, glowing strip spokes, cluster hub
  STATION_STYLE.silicoid = {
    seg: function (P, T, a0, a1, i) {
      const am = (a0 + a1) / 2, rm = (T.ri + T.ro) / 2, c = pol(rm, am), arc = rm * (a1 - a0);
      P.gem(c[0], c[1], am + PI / 2, arc * 1.4, (T.ro - T.ri) * 1.15, mixc(P.pal.base, P.pal.violet, (i % 2) * 0.7 + 0.1), { a: 0.92, lift: 0.01, tf: 1.1, tr: 1.0 });
    },
    spoke: function (P, T, a, i) { const p0 = pol(T.hubR * 0.8, a), p1 = pol(T.ri, a); P.strip([p0[0], p0[1], p1[0], p1[1]], 0.004, [200, 255, 248], 0.8); },
    hub: function (P, T, tier) {
      const R = T.hubR;
      for (let k = 0; k < 5 + tier * 2; k++) { const a = k / (5 + tier * 2) * TAU + 0.2; P.gem(cos(a) * R * 0.55, sin(a) * R * 0.55, a, R * 1.5, R * 0.55, mixc(P.pal.base, P.pal.violet, (k % 3) * 0.4), { a: 0.93, lift: 0.01, tf: 1.2, tr: 0.9 }); }
      P.gem(0, 0, 0.4, R * 1.8, R * 0.8, mixc(P.pal.base, [220, 255, 250], 0.3), { a: 0.9, lift: 0.01, z: 1.2 });
      P.emit(0, 0, R * 1.0, R * 1.0, 0, [180, 255, 245], 0.65);
    },
    spire: function (P, T, a, len, i) { const p = pol(T.ro - 0.02, a); P.gem(p[0] + cos(a) * (0.03 + len * 0.5), p[1] + sin(a) * (0.03 + len * 0.5), a, 0.07 + len, 0.022, mixc(P.pal.base, P.pal.violet, 0.5), { a: 0.92, lift: 0.006, nonote: true }); }
  };

  function buildStation(P, race, tier) {
    const T = TIERS[tier], st = STATION_STYLE[race] || STATION_STYLE.human, def = STATION_STYLE.human, pal = P.pal;
    const f = function (k) { return st[k] || def[k]; };
    P.drop(P.annulus(T.ri - 0.01, T.ro + 0.01), 0.018, 0.5);
    for (let i = 0; i < T.spokes; i++) f('spoke').call(null, P, T, (i + 0.5) / T.spokes * TAU, i);
    if (T.inner) { // inner ring
      const ri2 = T.hubR + (T.ri - T.hubR) * 0.5, n2 = T.n;
      P.fill(P.annulus(ri2 - 0.014, ri2 + 0.014), mixc(pal.base, pal.dark, 0.3), { lift: 0.006, bev: 0.006, skin: true });
    }
    for (let i = 0; i < T.n; i++) f('seg').call(null, P, T, i * TAU / T.n, (i + 1) * TAU / T.n, i);
    f('hub').call(null, P, T, tier);
    for (let i = 0; i < T.spires; i++) f('spire').call(null, P, T, (i + 0.5) / T.spires * TAU + TAU / (T.spires * 2) * (tier % 2), T.sl, i);
    const tr = [0.017, 0.019, 0.021][tier];
    for (let i = 0; i < T.turrets; i++) {
      const a = (i + 0.5) / T.turrets * TAU + (tier === 0 ? PI / 4 : 0) * 0, p = pol(T.ro - 0.012, a);
      stTurret(P, p[0], p[1], a, tr, mixc(pal.base, pal.dark, 0.35));
    }
    if (st.extra) st.extra.call(null, P, T, tier);
    P.meta.chase = { r: (T.ri + T.ro) / 2, n: T.n, col: pal.glow };
    // anchors for weapon FX: turrets on the ring
    for (let i = 0; i < T.turrets; i++) { const a = (i + 0.5) / T.turrets * TAU, p = pol(T.ro, a); P.hard('turret', p[0], p[1], tr); }
  }

  // ---- the stargate: neutral ancient ring, event horizon animated per frame ----
  function buildGate(P) {
    const g = P.g, ro = 0.5, ri = 0.355, n = 12, steel = [88, 98, 124], gold = [232, 200, 124];
    P.drop(P.annulus(ri - 0.01, ro), 0.02, 0.6);
    for (let i = 0; i < n; i++) {
      const a0 = i * TAU / n, a1 = (i + 1) * TAU / n;
      P.fill(P.sector(a0 + 0.008, a1 - 0.008, ri, ro), mixc(steel, [60, 70, 96], (i % 2) * 0.4), { lift: 0.006, bev: 0.014, skin: { cw: 0.07, ch: 0.05, tint: 0.1, seam: 0.3 }, rim: 0.35 });
      const am = (a0 + a1) / 2, rm = (ri + ro) / 2, p = pol(rm, am);
      P.at(p[0], p[1], am, function () {
        P.fill(P.cham(-0.035, -0.012, 0.07, 0.024, 0.006), gold, { bev: 0.004, lift: 0.003, nonote: true });
        P.fill(P.cham(-0.012, -0.03, 0.024, 0.06, 0.005), mixc(gold, steel, 0.5), { bev: 0.004, nonote: true });
      });
      const q = pol(ri + 0.014, am); P.light(q[0], q[1], 0.0075, [150, 215, 255], 'pulse', 3.2, i * 0.083, 1.2);
    }
    // locking chevrons
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + TAU / 16, p = pol(ri - 0.005, a);
      P.at(p[0], p[1], a + PI, function () { P.fill(P.poly([-0.03, -0.034, 0.02, -0.018, 0.02, 0.018, -0.03, 0.034]), gold, { lift: 0.008, bev: 0.007, nonote: true }); P.fill(P.poly([-0.012, -0.012, 0.01, -0.007, 0.01, 0.007, -0.012, 0.012]), [20, 26, 44], { flat: true, bev: 0.002, nonote: true }); });
    }
    const ps = [];
    for (let k = 0; k < 90; k++) { const p = pol(ro - 0.016, k / 90 * TAU); ps.push(p[0], p[1]); }
    P.strip(ps, 0.002, [150, 215, 255], 0.6, true);
    const ps2 = [];
    for (let k = 0; k < 90; k++) { const p = pol(ri + 0.004, k / 90 * TAU); ps2.push(p[0], p[1]); }
    P.strip(ps2, 0.0028, [190, 235, 255], 0.9, true);
    P.meta.gate = { r: ri + 0.004 };
  }


  // ==========================================================================
  // 7. baking, caching and per-frame rendering
  // ==========================================================================
  let PIXEL_RATIO = 1;
  try { PIXEL_RATIO = clamp(window.devicePixelRatio || 1, 1, 2); } catch (err) { PIXEL_RATIO = 1; }
  const LADDER = [24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 640, 768, 960];
  function sizeBucket(px) {
    for (let i = 0; i < LADDER.length; i++) if (LADDER[i] >= px - 0.01) return LADDER[i];
    return LADDER[LADDER.length - 1];
  }
  const HULL_CODE = { frigate: 0, destroyer: 1, cruiser: 2, battleship: 3, doomstar: 4, starbase: 5, battlestation: 6, starfortress: 7, stargate: 8 };
  function hullCode(h) {
    if (typeof h === 'number') return h < 0 ? 0 : h > 8 ? 8 : h | 0;
    if (typeof h === 'string') {
      const c = HULL_CODE[h.toLowerCase()];
      if (c !== undefined) return c;
      const n = parseInt(h, 10);
      if (n >= 0) return min(n, 8);
    }
    return 0;
  }

  // ---- cache ---------------------------------------------------------------------
  const cache = new Map();
  let cacheBytes = 0, useTick = 0, bakeSpent = 0, lastBakeEnd = 0;
  const MAX_BYTES = 230 * 1024 * 1024;
  function nowMs() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
  function putCache(key, e, bytes) {
    e.bytes = bytes; e.used = ++useTick;
    cache.set(key, e); cacheBytes += bytes;
    if (cacheBytes > MAX_BYTES) {
      const arr = Array.from(cache.entries()).sort(function (a, b) { return a[1].used - b[1].used; });
      for (let i = 0; i < arr.length && cacheBytes > MAX_BYTES * 0.75; i++) {
        const ent = arr[i][1];
        if (ent.used >= useTick - 4) continue;
        cache.delete(arr[i][0]); cacheBytes -= ent.bytes; ent.dead = true;
        if (ent.c) { ent.c.width = 1; ent.c.height = 1; }
        if (ent.gc) { ent.gc.width = 1; ent.gc.height = 1; }
      }
    }
  }
  function entryBytes(e) { return e.W * e.H * 4 * (e.gc ? 2 : 1) + 2048; }

  // ---- hull painting ---------------------------------------------------------------
  function pickSites(meta, seed) {
    const r = rng(seed), sh = meta.shapes, sites = [];
    let tot = 0;
    for (let i = 0; i < sh.length; i++) tot += sh[i][2];
    if (!tot) return [{ x: 0, y: 0, s: 0.05 }];
    for (let n = 0; n < 6; n++) {
      let v = r() * tot, k = 0;
      while (k < sh.length - 1 && v > sh[k][2]) { v -= sh[k][2]; k++; }
      const s = sh[k];
      sites.push({ x: s[0] + (r() - 0.5) * s[3] * 1.2, y: s[1] + (r() - 0.5) * s[4] * 1.2, s: 0.035 + r() * 0.04 });
    }
    return sites;
  }
  function paintHull(race, code, S, colStr, mask, Ld) {
    const D = DESIGNS[race], hw = D.hw[code], ex = D.ex || 0.54;
    const W = ceil(2 * ex * S) + 6, H = ceil(2 * (hw + 0.035) * S) + 6;
    const c = mk(W, H), gc = mk(W, H);
    const g = c.getContext('2d'), gg = gc.getContext('2d');
    const cx = W / 2, cy = H / 2;
    g.setTransform(S, 0, 0, S, cx, cy); gg.setTransform(S, 0, 0, S, cx, cy);
    const pal = resolvePal(D.pal);
    const P = new Painter(g, gg, S, Ld, pal, parseColor(colStr), hash(race + code), cx, cy, S >= 70 ? 1 : 0);
    D.build(P, code);
    drawAddons(P, mask, code);
    const meta = P.meta;
    meta.sites = pickSites(meta, hash(race + 's' + code));
    meta.shapes = null;
    for (let i = 0; i < meta.lights.length; i++) meta.lights[i].spr = glowSprite(meta.lights[i].c);
    return { c: c, gc: meta.glow ? gc : null, W: W, H: H, cx: cx, cy: cy, S: S, meta: meta, pal: pal, eng: pal.eng, spr: flameSprite(pal.eng), team: P.team };
  }
  function getHull(race, code, bs, colStr, mask, lb) {
    const key = race + '|' + code + '|' + bs + '|' + colStr + '|' + mask + '|' + lb;
    let e = cache.get(key);
    if (e) { e.used = ++useTick; return e; }
    const t0 = nowMs();
    if (t0 - lastBakeEnd > 80) bakeSpent = 0;
    if (bakeSpent > 14) {       // frame budget blown: borrow a neighbouring light bucket if one exists
      for (let d = 1; d <= LIGHT_BUCKETS / 2; d++) {
        const a = cache.get(race + '|' + code + '|' + bs + '|' + colStr + '|' + mask + '|' + ((lb + d) % LIGHT_BUCKETS));
        if (a) return a;
        const b = cache.get(race + '|' + code + '|' + bs + '|' + colStr + '|' + mask + '|' + ((lb - d + LIGHT_BUCKETS) % LIGHT_BUCKETS));
        if (b) return b;
      }
    }
    e = code >= 5 ? paintStructure(race, code, min(bs * PIXEL_RATIO, 1000), colStr, lightFor(lb, LIGHT_BUCKETS)) : paintHull(race, code, min(bs * PIXEL_RATIO, 1000), colStr, mask, lightFor(lb, LIGHT_BUCKETS));
    e.key = key; e.bs = bs;
    putCache(key, e, entryBytes(e));
    lastBakeEnd = nowMs(); bakeSpent += lastBakeEnd - t0;
    return e;
  }

  // ---- derived sprites (silhouette, damage overlay, shield bubble) -------------------
  function silhouette(e) {
    if (e.sil) return e.sil;
    const c = mk(e.W, e.H), g = c.getContext('2d');
    g.drawImage(e.c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#000'; g.fillRect(0, 0, e.W, e.H);
    e.sil = c;
    return c;
  }
  function ghostOf(e) { // cool-white edge-lit silhouette for the cloak shimmer
    if (e.ghost) return e.ghost;
    const c = mk(e.W, e.H), g = c.getContext('2d');
    g.drawImage(e.c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = 'rgb(150,220,255)'; g.fillRect(0, 0, e.W, e.H);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.5; g.drawImage(e.c, 0, 0);
    e.ghost = c;
    return c;
  }
  const dmgCache = new Map();
  function damageOf(e) {
    const key = e.key.split('|').slice(0, 3).join('|') + '|' + e.key.split('|')[4];
    let d = dmgCache.get(key);
    if (d && !d.A.dead) return d;
    const W = e.W, H = e.H, S = e.S, r = rng(hash(key));
    const A = mk(W, H), B = mk(W, H), ga = A.getContext('2d'), gb = B.getContext('2d');
    ga.setTransform(S, 0, 0, S, e.cx, e.cy); gb.setTransform(S, 0, 0, S, e.cx, e.cy);
    const sites = e.meta.sites;
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      // scorch
      let gr = ga.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.s * 1.6);
      gr.addColorStop(0, 'rgba(6,5,8,0.78)'); gr.addColorStop(0.55, 'rgba(10,8,10,0.4)'); gr.addColorStop(1, 'rgba(10,8,10,0)');
      ga.fillStyle = gr; ga.fillRect(s.x - s.s * 1.7, s.y - s.s * 1.7, s.s * 3.4, s.s * 3.4);
      // soot streak toward the stern
      ga.save(); ga.translate(s.x, s.y); ga.scale(2.6, 0.55);
      gr = ga.createRadialGradient(-s.s * 0.6, 0, 0, -s.s * 0.6, 0, s.s * 1.1);
      gr.addColorStop(0, 'rgba(8,7,10,0.5)'); gr.addColorStop(1, 'rgba(8,7,10,0)');
      ga.fillStyle = gr; ga.beginPath(); ga.arc(-s.s * 0.6, 0, s.s * 1.1, 0, TAU); ga.fill(); ga.restore();
      // cracks
      const nc = 2 + ((r() * 3) | 0);
      for (let k = 0; k < nc; k++) {
        let x = s.x, y = s.y, a = r() * TAU;
        ga.beginPath(); ga.moveTo(x, y);
        const segs = 4 + ((r() * 4) | 0);
        for (let j = 0; j < segs; j++) { a += (r() - 0.5) * 1.3; const l = 0.012 + r() * 0.024; x += cos(a) * l; y += sin(a) * l; ga.lineTo(x, y); }
        ga.lineWidth = 0.0034; ga.strokeStyle = 'rgba(4,4,8,0.85)'; ga.lineJoin = 'round'; ga.stroke();
        ga.save(); ga.globalCompositeOperation = 'lighter'; ga.lineWidth = 0.0014; ga.strokeStyle = 'rgba(255,128,44,0.7)'; ga.stroke(); ga.restore();
      }
    }
    // breaches (worst damage): torn plating with a glowing, burning interior
    for (let i = 0; i < min(3, sites.length); i++) {
      const s = sites[i], n = 16, rad = s.s * 0.72;
      gb.beginPath();
      for (let j = 0; j < n; j++) {
        const a = j / n * TAU + (r() - 0.5) * 0.25, rr2 = rad * (j % 2 ? 0.42 + r() * 0.3 : 0.85 + r() * 0.5);
        const X = s.x + cos(a) * rr2, Y = s.y + sin(a) * rr2 * 0.86;
        if (j) gb.lineTo(X, Y); else gb.moveTo(X, Y);
      }
      gb.closePath();
      gb.save();
      gb.shadowColor = 'rgba(255,120,30,0.95)'; gb.shadowBlur = rad * S * 0.9; gb.fillStyle = 'rgb(10,6,6)'; gb.fill();
      gb.restore();
      const gr = gb.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad * 1.1);
      gr.addColorStop(0, 'rgba(255,200,90,0.95)'); gr.addColorStop(0.35, 'rgba(230,90,24,0.9)'); gr.addColorStop(0.8, 'rgba(24,10,8,0.95)'); gr.addColorStop(1, 'rgba(10,6,6,1)');
      gb.fillStyle = gr; gb.fill();
      gb.lineWidth = 0.0032; gb.lineJoin = 'round'; gb.strokeStyle = 'rgba(255,190,110,0.85)'; gb.stroke();
    }
    // mask both layers to the hull
    for (const cv of [A, B]) {
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(e.c, 0, 0);
    }
    d = { A: A, B: B, sites: sites };
    if (dmgCache.size > 48) { const k0 = dmgCache.keys().next().value, o0 = dmgCache.get(k0); o0.A.width = 1; o0.B.width = 1; dmgCache.delete(k0); }
    dmgCache.set(key, d);
    return d;
  }
  const bubbleCache = new Map();
  // shield bubble radius (in ship lengths): a circle that clears the whole hull
  function bubbleUnits(race, code) {
    if (code >= 5) return 0.58;
    const D = DESIGNS[race] || DESIGNS.human;
    return max(0.56, D.hw[code] * 1.04);
  }
  function bubbleOf(race, code, bs) {
    const key = race + '|' + code + '|' + bs;
    let b = bubbleCache.get(key);
    if (b) return b;
    if (bubbleCache.size > 80) { const k0 = bubbleCache.keys().next().value; const o = bubbleCache.get(k0); o.c.width = 1; o.c.height = 1; bubbleCache.delete(k0); }
    const rx = bubbleUnits(race, code), ry = rx;
    const R = min(bs * PIXEL_RATIO, 420 / (2 * rx));
    const W = ceil(2 * rx * R) + 6, H = W;
    const c = mk(W, H), g = c.getContext('2d');
    g.translate(W / 2, H / 2);
    // body + fresnel rim
    g.save(); g.scale(rx * R, ry * R);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(110,190,255,0.03)'); gr.addColorStop(0.7, 'rgba(120,205,255,0.08)');
    gr.addColorStop(0.92, 'rgba(150,225,255,0.3)'); gr.addColorStop(1, 'rgba(220,248,255,0.62)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill();
    g.restore();
    // hex lattice
    g.save();
    g.beginPath(); g.arc(0, 0, rx * R - 1, 0, TAU); g.clip();
    const s = clamp(R * 0.06, 6, 24), hx = s * 1.5, hy = s * sqrt(3);
    g.strokeStyle = 'rgba(165,225,255,0.34)'; g.lineWidth = max(1, R * 0.004);
    g.beginPath();
    for (let i = -ceil(W / 2 / hx) - 1; i <= ceil(W / 2 / hx) + 1; i++) {
      for (let j = -ceil(H / 2 / hy) - 1; j <= ceil(H / 2 / hy) + 1; j++) {
        const px = i * hx, py = (j + (i & 1 ? 0.5 : 0)) * hy;
        for (let k = 0; k < 6; k++) { const a = k * PI / 3; const qx = px + cos(a) * s, qy = py + sin(a) * s; if (k) g.lineTo(qx, qy); else g.moveTo(qx, qy); }
        g.closePath();
      }
    }
    g.stroke();
    g.restore();
    // upper-left glint
    g.save(); g.scale(rx * R, ry * R); g.lineWidth = 0.05; g.lineCap = 'round';
    const lg = g.createLinearGradient(-0.7, -0.7, 0.2, 0.2); lg.addColorStop(0, 'rgba(255,255,255,0.7)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = lg; g.beginPath(); g.arc(0, 0, 0.93, PI * 1.08, PI * 1.55); g.stroke();
    g.restore();
    b = { c: c, W: W, H: H, rx: rx, ry: ry, R: R };
    bubbleCache.set(key, b);
    return b;
  }
  let bandSpr = null;
  function bandSprite() {
    if (bandSpr) return bandSpr;
    const c = mk(128, 128), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    bandSpr = c;
    return c;
  }

  // ---- the dynamic layers ------------------------------------------------------------
  function drawFlames(ctx, e, thrust, t, ph, lod) {
    const eng = e.meta.eng, spr = e.spr, glow = glowSprite(e.eng[1]);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < eng.length; i++) {
      const n = eng[i], fl = 0.86 + 0.09 * sin(t * 33 + i * 1.7 + ph) + 0.05 * sin(t * 61 + i * 2.9 + ph * 2);
      const len = n.r * (2.3 + 9 * thrust) * fl, hh = n.r * (1 + 0.25 * thrust);
      ctx.globalAlpha = 0.3 + 0.7 * thrust;
      ctx.drawImage(spr, n.x - len, n.y - hh, len, hh * 2);
      if (lod > 0) {
        ctx.globalAlpha = 0.25 + 0.5 * thrust;
        ctx.drawImage(glow, n.x - n.r * 2.4, n.y - n.r * 2.4, n.r * 4.8, n.r * 4.8);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawLights(ctx, e, t, ph) {
    const L = e.meta.lights;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.length; i++) {
      const l = L[i], f = fract(t / l.per + l.ph + ph * 0.37);
      let a;
      if (l.kind === 'blink') a = f < 0.14 ? 1 : 0.1;
      else if (l.kind === 'pulse') a = 0.4 + 0.6 * (0.5 + 0.5 * sin(TAU * f));
      else a = 0.75;
      ctx.globalAlpha = a;
      const r = l.r * 3.4;
      ctx.drawImage(l.spr, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function hash1(n) { const s = sin(n * 127.1 + 311.7) * 43758.5453; return s - floor(s); }
  function drawDamage(ctx, e, dmg, t, size, lod, ph) {
    const d = damageOf(e), k = 1 / e.S, x0 = -e.cx * k, y0 = -e.cy * k, w = e.W * k, h = e.H * k;
    const aA = clamp(dmg * 1.7, 0, 1), aB = clamp((dmg - 0.45) * 2.6, 0, 1);
    ctx.globalAlpha = aA; ctx.drawImage(d.A, x0, y0, w, h);
    if (aB > 0) { ctx.globalAlpha = aB; ctx.drawImage(d.B, x0, y0, w, h); }
    ctx.globalAlpha = 1;
    if (lod === 0) return;
    const n = min(d.sites.length, 1 + ((dmg * 5) | 0));
    const smoke = smokeSprite(), sp = glowSprite([255, 170, 70]);
    for (let i = 0; i < n; i++) {
      const s = d.sites[i];
      if (dmg > 0.28) {
        for (let j = 0; j < 3; j++) {
          const f = fract(t * 0.45 + j / 3 + i * 0.37 + ph * 0.1);
          const a = (1 - f) * clamp((dmg - 0.2) * 1.1, 0, 0.8) * 0.9, r = 0.03 + f * 0.09;
          ctx.globalAlpha = a;
          ctx.drawImage(smoke, s.x - f * 0.3 - r, s.y + sin(f * 7 + i) * 0.02 - r, r * 2, r * 2);
        }
      }
      const q = floor(t * 11 + i * 7.3), v = hash1(q + i * 3.7);
      if (v > 0.5) {
        const jx = (hash1(q * 1.3 + i) - 0.5) * 0.02, jy = (hash1(q * 2.1 + i) - 0.5) * 0.02, r = 0.012 + v * 0.02;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (v - 0.4) * 1.5 * (0.5 + dmg * 0.5);
        ctx.drawImage(sp, s.x + jx - r * 2, s.y + jy - r * 2, r * 4, r * 4);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawShield(ctx, race, code, bs, shield, t, ph, ang) {
    const b = bubbleOf(race, code, bs), k = 1 / b.R;
    const a = shield * (0.62 + 0.38 * sin(t * 2.2 + ph));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.save(); ctx.rotate(-ang);   // keep the glint / lattice upright in screen space
    ctx.drawImage(b.c, -b.W * 0.5 * k, -b.H * 0.5 * k, b.W * k, b.H * k);
    ctx.restore();
    // sweeping shimmer band, clipped to the bubble
    ctx.save();
    ctx.rotate(-ang);
    ctx.beginPath(); ctx.arc(0, 0, b.rx * 0.985, 0, TAU); ctx.clip();
    const sx = (fract(t * 0.23 + ph * 0.05) * 2.6 - 1.3) * b.rx;
    ctx.globalAlpha = clamp(shield * 0.28, 0, 1);
    ctx.drawImage(bandSprite(), sx - b.rx * 0.22, -b.ry * 1.05, b.rx * 0.44, b.ry * 2.1);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawHullLayers(ctx, e, size, o, race, code, t, ph, lod) {
    const k = 1 / e.S, x0 = -e.cx * k, y0 = -e.cy * k, w = e.W * k, h = e.H * k;
    const thrust = o.thrust === undefined ? 0.35 : clamp(o.thrust, 0, 1);
    const dmg = clamp(o.damage || 0, 0, 1), shield = clamp(o.shield || 0, 0, 1), cloak = clamp(o.cloaked || 0, 0, 1);
    // soft shadow
    if (o.shadow && cloak < 0.9) {
      const sil = silhouette(e), ang = o.angle || 0, ca = cos(ang), sa = sin(ang);
      const off = 0.05, ox = (0.5 * ca + 0.86 * sa) * off, oy = (-0.5 * sa + 0.86 * ca) * off; // screen offset (+0.5,+0.86) in ship frame
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = (0.2 - i * 0.04) * (1 - cloak);
        const m = 0.7 + i * 0.4;
        ctx.drawImage(sil, x0 + ox * m - (i * 0.004), y0 + oy * m - (i * 0.004), w + i * 0.008, h + i * 0.008);
      }
      ctx.globalAlpha = 1;
    }
    if (cloak < 0.9 && o.glow !== false) {
      if (size < 84) { // small ships: soft team-coloured halo so they pop against the starfield
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.14 + 0.34 * (1 - size / 84)) * (1 - cloak);
        ctx.drawImage(glowSprite(e.team), x0 - 0.12, y0 - 0.08, w + 0.24, h + 0.16);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (code === 4) { // doomstar: ominous bloom
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (0.2 + 0.06 * sin(t * 1.3 + ph)) * (1 - cloak);
        ctx.drawImage(glowSprite(e.eng[1]), x0 - 0.2, y0 - 0.14, w + 0.4, h + 0.28);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    drawFlames(ctx, e, thrust * (1 - cloak * 0.6), t, ph, lod);
    // hull
    if (cloak > 0.02) {
      const jit = 0.0022 * cloak * (sin(t * 23 + ph) + 0.6 * sin(t * 41 + ph * 2)), gh = ghostOf(e);
      ctx.globalAlpha = 1 - cloak * 0.83;
      ctx.drawImage(e.c, x0 + jit, y0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = cloak * (0.2 + 0.08 * sin(t * 2.6 + ph));
      ctx.drawImage(gh, x0 - jit, y0, w, h);
      // holographic scan strip sweeping across the hull
      const bandH = h * 0.16, by = y0 - bandH + fract(t * 0.42 + ph * 0.07) * (h + bandH);
      ctx.save();
      ctx.beginPath(); ctx.rect(x0 - 0.02, by, w + 0.04, bandH); ctx.clip();
      ctx.globalAlpha = cloak * 0.6; ctx.drawImage(gh, x0, y0, w, h);
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(e.c, x0, y0, w, h);
    }
    const vis = 1 - cloak * 0.8;
    if (e.gc && lod > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.4 + 0.3 * sin(t * 1.7 + ph) + 0.15 * sin(t * 4.1 + ph * 2)) * vis;
      ctx.drawImage(e.gc, x0, y0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (dmg > 0.04 && cloak < 0.95) drawDamage(ctx, e, dmg, t, size, lod, ph);
    if (lod > 0 && vis > 0.3) { ctx.globalAlpha = vis; drawLights(ctx, e, t, ph); ctx.globalAlpha = 1; }
    if (shield > 0.01) drawShield(ctx, race, code, e.bs, shield, t, ph, o.angle || 0);
  }

  function draw(ctx, o) {
    o = o || NO;
    const code = hullCode(o.hull);
    const race = code === 8 ? 'gate' : (DESIGNS[o.race] ? o.race : 'human');
    const size = o.size > 2 ? +o.size : 64;
    if (code >= 5) { drawStructure(ctx, race, code, o, size); return; }
    const ang = o.angle || 0, t = o.t || 0;
    const colStr = typeof o.color === 'string' ? o.color : '#62d8ff';
    const e = getHull(race, code, sizeBucket(size), colStr, flagMask(o.flags), lightBucket(ang, LIGHT_BUCKETS));
    const ph = (o.x || 0) * 0.0173 + (o.y || 0) * 0.0231 + (o.seed || 0);
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.rotate(ang);
    ctx.scale(size, size);
    drawHullLayers(ctx, e, size, o, race, code, t, ph, size < 30 ? 0 : size < 60 ? 1 : 2);
    ctx.restore();
  }
  const GATE_PAL = { base: '#58627c', light: '#c8d6f0', dark: '#262c40', deep: '#10142a', glow: '#8fd0ff', eng: ['#ffffff', '#9fd0ff', '#3070ff'], win: '#bfe4ff' };
  function paintStructure(race, code, S, colStr, Ld) {
    const half = 0.56, W = ceil(2 * half * S) + 6, H = W;
    const c = mk(W, H), gc = mk(W, H), g = c.getContext('2d'), gg = gc.getContext('2d'), cx = W / 2, cy = H / 2;
    g.setTransform(S, 0, 0, S, cx, cy); gg.setTransform(S, 0, 0, S, cx, cy);
    const pal = resolvePal(code === 8 ? GATE_PAL : DESIGNS[race].pal);
    const P = new Painter(g, gg, S, Ld, pal, parseColor(colStr), hash(race + 'S' + code), cx, cy, S >= 70 ? 1 : 0);
    if (code === 8) buildGate(P); else buildStation(P, race, code - 5);
    const meta = P.meta;
    meta.sites = pickSites(meta, hash(race + 'ss' + code));
    meta.shapes = null;
    for (let i = 0; i < meta.lights.length; i++) meta.lights[i].spr = glowSprite(meta.lights[i].c);
    if (meta.chase) meta.chase.spr = glowSprite(meta.chase.col);
    return { c: c, gc: meta.glow ? gc : null, W: W, H: H, cx: cx, cy: cy, S: S, meta: meta, pal: pal, eng: pal.eng, spr: flameSprite(pal.eng), team: P.team };
  }
  let gateSpr = null;
  function gateSprites() {
    if (gateSpr) return gateSpr;
    const N = 256, base = mk(N, N), g = base.getContext('2d');
    const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    gr.addColorStop(0, 'rgba(170,225,255,0.95)'); gr.addColorStop(0.22, 'rgba(60,130,255,0.85)'); gr.addColorStop(0.68, 'rgba(24,48,170,0.9)'); gr.addColorStop(0.92, 'rgba(60,120,230,0.95)'); gr.addColorStop(1, 'rgba(150,215,255,1)');
    g.fillStyle = gr; g.beginPath(); g.arc(N / 2, N / 2, N / 2, 0, TAU); g.fill();
    function spiral(arms, cols, tw) {
      const c = mk(N, N), q = c.getContext('2d');
      q.globalCompositeOperation = 'lighter';
      for (let a = 0; a < arms; a++) {
        for (let i = 0; i < 190; i++) {
          const th = a * TAU / arms + i * tw, r = 6 + i * 0.64, x = N / 2 + cos(th) * r, y = N / 2 + sin(th) * r, f = i / 190;
          const rad = 2 + f * 9;
          const gg = q.createRadialGradient(x, y, 0, x, y, rad);
          gg.addColorStop(0, 'rgba(' + cols + ',' + (0.1 + 0.28 * (1 - f)) + ')'); gg.addColorStop(1, 'rgba(' + cols + ',0)');
          q.fillStyle = gg; q.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
      }
      return c;
    }
    const core = mk(128, 128), cg = core.getContext('2d'), cgr = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
    cgr.addColorStop(0, 'rgba(255,255,255,1)'); cgr.addColorStop(0.2, 'rgba(190,235,255,0.7)'); cgr.addColorStop(1, 'rgba(120,190,255,0)');
    cg.fillStyle = cgr; cg.fillRect(0, 0, 128, 128);
    gateSpr = { base: base, a: spiral(4, '190,230,255', 0.052), b: spiral(3, '120,160,255', -0.06), core: core };
    return gateSpr;
  }
  function drawGateHorizon(ctx, t, ph) {
    const s = gateSprites(), R = 0.372;
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    ctx.drawImage(s.base, -R, -R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.save(); ctx.rotate(t * 0.45); ctx.globalAlpha = 0.75; ctx.drawImage(s.a, -R, -R, R * 2, R * 2); ctx.restore();
    ctx.save(); ctx.rotate(-t * 0.31); ctx.globalAlpha = 0.6; ctx.drawImage(s.b, -R * 0.92, -R * 0.92, R * 1.84, R * 1.84); ctx.restore();
    const pr = 0.16 * (1 + 0.08 * sin(t * 2.1));
    ctx.globalAlpha = 0.75; ctx.drawImage(s.core, -pr, -pr, pr * 2, pr * 2);
    ctx.lineWidth = 0.008;
    for (let k = 0; k < 3; k++) {
      const f = fract(t * 0.3 + k / 3);
      ctx.globalAlpha = (1 - f) * 0.55 * sstep(0, 0.12, f);
      ctx.strokeStyle = 'rgb(190,230,255)';
      ctx.beginPath(); ctx.arc(0, 0, f * R, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawChase(ctx, e, t) {
    const c = e.meta.chase;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      const th = t * 0.8 + k * PI;
      for (let i = 0; i < 7; i++) {
        const a = th - i * 0.075, r = 0.02 * (1 - i * 0.09);
        ctx.globalAlpha = (1 - i / 7) * 0.9;
        ctx.drawImage(c.spr, cos(a) * c.r - r, sin(a) * c.r - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  function drawStructure(ctx, race, code, o, size) {
    const ang = o.angle || 0, t = o.t || 0;
    const colStr = typeof o.color === 'string' ? o.color : '#62d8ff';
    const e = getHull(race, code, sizeBucket(size), colStr, 0, lightBucket(ang, LIGHT_BUCKETS));
    const ph = (o.x || 0) * 0.0173 + (o.y || 0) * 0.0231 + (o.seed || 0);
    ctx.save();
    ctx.translate(o.x || 0, o.y || 0);
    ctx.rotate(ang);
    ctx.scale(size, size);
    if (code === 8) drawGateHorizon(ctx, t, ph);
    drawHullLayers(ctx, e, size, o, race, code, t, ph, size < 30 ? 0 : size < 60 ? 1 : 2);
    if (e.meta.chase && size >= 36) drawChase(ctx, e, t);
    ctx.restore();
  }

  // ==========================================================================
  // 8. public helpers: sprite(), fleet markers, anchors, cache control
  // ==========================================================================
  const spriteCache = new Map();
  // Static, transparent canvas for lists / UI / design preview. The ship points along +x.
  // The canvas has props cx, cy (ship centre in canvas px) and its natural pixel size is the logical size.
  function sprite(race, hull, sizePx, color, flags) {
    const code = hullCode(hull);
    race = code === 8 ? 'gate' : (DESIGNS[race] ? race : 'human');
    sizePx = max(8, round(+sizePx || 48));
    const colStr = typeof color === 'string' ? color : '#62d8ff';
    const mask = code >= 5 ? 0 : flagMask(flags);
    const key = race + '|' + code + '|' + sizePx + '|' + colStr + '|' + mask;
    let c = spriteCache.get(key);
    if (c) return c;
    const S = min(sizePx, 1000);
    const Ld = lightFor(0, LIGHT_BUCKETS);
    const e = code >= 5 ? paintStructure(race, code, S, colStr, Ld) : paintHull(race, code, S, colStr, mask, Ld);
    const pad = code >= 5 ? 2 : ceil(S * 0.22);
    c = mk(e.W + pad, e.H);
    const g = c.getContext('2d');
    // flames first (behind), soft idle glow
    const ox = pad + e.cx, oy = e.cy;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < e.meta.eng.length; i++) {
      const n = e.meta.eng[i], len = n.r * 5.2 * S, hh = n.r * 1.15 * S;
      g.globalAlpha = 0.85; g.drawImage(e.spr, ox + n.x * S - len, oy + n.y * S - hh, len, hh * 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (code === 8) { // gate: show a frozen event horizon
      g.save(); g.translate(ox, oy); g.scale(S, S); drawGateHorizon(g, 3.7, 0); g.restore();
    }
    g.drawImage(e.c, pad, 0);
    if (e.gc) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55; g.drawImage(e.gc, pad, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < e.meta.lights.length; i++) {
      const l = e.meta.lights[i], r = l.r * 3.4 * S;
      g.globalAlpha = l.kind === 'blink' ? (i % 2 ? 1 : 0.3) : 0.8;
      g.drawImage(l.spr, ox + l.x * S - r, oy + l.y * S - r, r * 2, r * 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    c.cx = ox; c.cy = oy; c.size = sizePx;
    if (spriteCache.size > 600) spriteCache.delete(spriteCache.keys().next().value);
    spriteCache.set(key, c);
    return c;
  }

  // Fleet marker for the galaxy map: glowing chevron with an engine trail.
  //   o: { selected, count, moving }
  const DASH = [0, 0];
  function drawFleetMarker(ctx, x, y, size, color, angle, t, o) {
    o = o || NO;
    const col = parseColor(color || '#62d8ff'), s = size || 18, hi = tone(col, 0.45), lo = tone(col, -0.35);
    const pulse = 0.85 + 0.15 * sin(t * 3.1 + x * 0.05);
    ctx.save();
    ctx.translate(x, y);
    // halo
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (o.selected ? 0.8 : 0.5) * pulse;
    ctx.drawImage(glowSprite(col), -s * 1.25, -s * 1.25, s * 2.5, s * 2.5);
    ctx.rotate(angle || 0);
    if (o.moving) {
      const len = s * (1.5 + 0.25 * sin(t * 13 + y * 0.1)), spr = flameSprite([[255, 255, 255], hi, col]);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(spr, -s * 0.26 - len, -s * 0.2, len, s * 0.4);
      ctx.globalAlpha = 0.45;
      ctx.drawImage(spr, -s * 0.2 - len * 1.35, -s * 0.34, len * 1.35, s * 0.68);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // chevron body
    ctx.beginPath();
    ctx.moveTo(s * 0.62, 0); ctx.lineTo(-s * 0.42, -s * 0.4); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.42, s * 0.4); ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = max(2.6, s * 0.16); ctx.strokeStyle = 'rgba(4,6,20,0.75)'; ctx.stroke();
    ctx.fillStyle = rgba(col, 1); ctx.fill();
    // lit half + rim
    ctx.beginPath(); ctx.moveTo(s * 0.62, 0); ctx.lineTo(-s * 0.42, -s * 0.4); ctx.lineTo(-s * 0.2, 0); ctx.closePath();
    ctx.fillStyle = rgba(hi, 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.62, 0); ctx.lineTo(-s * 0.42, s * 0.4); ctx.lineTo(-s * 0.2, 0); ctx.closePath();
    ctx.fillStyle = rgba(lo, 0.55); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.62, 0); ctx.lineTo(-s * 0.42, -s * 0.4); ctx.lineTo(-s * 0.2, 0); ctx.lineTo(-s * 0.42, s * 0.4); ctx.closePath();
    ctx.lineWidth = max(1, s * 0.07); ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.stroke();
    ctx.restore();
    if (o.selected) { // reticle: four corner brackets that breathe
      const r = s * (1.08 + 0.06 * sin(t * 4)), l = s * 0.36;
      ctx.save(); ctx.translate(x, y);
      ctx.lineWidth = max(1.5, s * 0.09); ctx.strokeStyle = 'rgba(255,236,170,0.95)'; ctx.lineCap = 'square';
      ctx.beginPath();
      for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) {
        ctx.moveTo(sx * r, sy * (r - l)); ctx.lineTo(sx * r, sy * r); ctx.lineTo(sx * (r - l), sy * r);
      }
      ctx.stroke();
      DASH[0] = s * 0.12; DASH[1] = s * 0.2;
      ctx.setLineDash(DASH); ctx.lineDashOffset = -t * s * 0.6; ctx.lineWidth = max(1, s * 0.05); ctx.strokeStyle = 'rgba(255,236,170,0.45)';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (o.count > 1) { // count badge
      const txt = String(o.count), fs = max(10, round(s * 0.62));
      ctx.save();
      ctx.font = '700 ' + fs + 'px "IBM Plex Sans Condensed", "Segoe UI", sans-serif';
      const tw = ctx.measureText(txt).width, bw = tw + fs * 0.7, bh = fs * 1.1, bx = x + s * 0.55, by = y - s * 0.55 - bh;
      ctx.beginPath();
      ctx.moveTo(bx + 3, by); ctx.lineTo(bx + bw - 3, by); ctx.lineTo(bx + bw, by + 3); ctx.lineTo(bx + bw, by + bh - 3); ctx.lineTo(bx + bw - 3, by + bh); ctx.lineTo(bx + 3, by + bh); ctx.lineTo(bx, by + bh - 3); ctx.lineTo(bx, by + 3); ctx.closePath();
      ctx.fillStyle = 'rgba(8,12,34,0.92)'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(hi, 0.95); ctx.stroke();
      ctx.fillStyle = '#f6efd8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, bx + bw / 2, by + bh / 2 + 0.5);
      ctx.restore();
    }
  }

  // Query helpers (not for per-frame use on huge numbers of ships)
  function resolveSpec(o) {
    const code = hullCode(o.hull), race = code === 8 ? 'gate' : (DESIGNS[o.race] ? o.race : 'human'), size = o.size > 2 ? +o.size : 64;
    const ang = o.angle || 0;
    const e = getHull(race, code, sizeBucket(size), typeof o.color === 'string' ? o.color : '#62d8ff', code >= 5 ? 0 : flagMask(o.flags), lightBucket(ang, LIGHT_BUCKETS));
    return { e: e, code: code, race: race, size: size, ang: ang, c: cos(ang), s: sin(ang), x: o.x || 0, y: o.y || 0 };
  }
  function toWorld(sp, p, dx) {
    const lx = p.x + (dx || 0), ly = p.y;
    return { x: sp.x + (lx * sp.c - ly * sp.s) * sp.size, y: sp.y + (lx * sp.s + ly * sp.c) * sp.size, r: (p.r || 0) * sp.size };
  }
  // World-space anchors for an `o` like draw()'s: turrets (muzzle tips), racks, engines, pod, bay
  function anchors(o) {
    const sp = resolveSpec(o || NO), H = sp.e.meta.hard, out = { turrets: [], racks: [], engines: [], pod: null, bay: null, troop: [] };
    for (let i = 0; i < H.turret.length; i++) out.turrets.push(toWorld(sp, H.turret[i], H.turret[i].r * 2.1));
    for (let i = 0; i < H.rack.length; i++) out.racks.push(toWorld(sp, H.rack[i], H.rack[i].r * 1.3));
    for (let i = 0; i < H.troop.length; i++) out.troop.push(toWorld(sp, H.troop[i]));
    for (let i = 0; i < sp.e.meta.eng.length; i++) out.engines.push(toWorld(sp, sp.e.meta.eng[i]));
    if (H.pod[0]) out.pod = toWorld(sp, H.pod[0]);
    if (H.bay[0]) out.bay = toWorld(sp, H.bay[0]);
    return out;
  }
  // bounding radius (px) for hit-testing, and the radius of the circular shield bubble
  function radiusOf(race, hull, size) {
    const code = hullCode(hull);
    if (code >= 5) return 0.5 * size;
    const D = DESIGNS[race] || DESIGNS.human;
    return max(0.5, D.hw[code] * 0.85) * size;
  }
  function shieldRadius(race, hull, size) { return bubbleUnits(DESIGNS[race] ? race : 'human', hullCode(hull)) * size; }
  function palette(race) {
    const D = DESIGNS[race] || DESIGNS.human, o = {};
    for (const k in D.pal) o[k] = D.pal[k];
    return o;
  }
  function clearCache() {
    cache.clear(); cacheBytes = 0; spriteCache.clear(); dmgCache.clear(); bubbleCache.clear();
  }
  function cacheInfo() { return { entries: cache.size, sprites: spriteCache.size, mb: +(cacheBytes / 1048576).toFixed(1) }; }
  function setPixelRatio(r) { r = clamp(+r || 1, 0.5, 3); if (r !== PIXEL_RATIO) { PIXEL_RATIO = r; clearCache(); } }
  // Pre-bake all light buckets for one ship so the first rotation is hitch-free
  function prewarm(race, hull, size, color, flags) {
    const code = hullCode(hull);
    race = code === 8 ? 'gate' : (DESIGNS[race] ? race : 'human');
    for (let b = 0; b < LIGHT_BUCKETS; b++) getHull(race, code, sizeBucket(size), typeof color === 'string' ? color : '#62d8ff', code >= 5 ? 0 : flagMask(flags), b);
  }

  M.Gfx.Ships = {
    RACES: RACES, RACE_NAMES: RACE_NAMES, HULLS: HULLS, STRUCTURES: STRUCTURES,
    draw: draw, sprite: sprite, drawFleetMarker: drawFleetMarker,
    anchors: anchors, radius: radiusOf, shieldRadius: shieldRadius, palette: palette, prewarm: prewarm,
    setPixelRatio: setPixelRatio, clearCache: clearCache, cacheInfo: cacheInfo
  };

})(window.MOO);
