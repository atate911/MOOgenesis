/* Master of Orion - Reborn : js/gfx/portraits.js
   Procedural, animated leader portraits for the ten races (original designs).
   Self-contained: exports only through window.MOO.Gfx.Portraits
     RACES, MOODS, draw(ctx, race, x, y, w, h, o), canvas(race, w, h, o), drawBadge(ctx, race, cx, cy, r, o)

   Architecture
   - All art is authored in a virtual 400x500 frame. Static layers (body / head / fore / collar) are painted once into
     offscreen canvases per (race, size bucket, variant, banner colour) and cached; per frame only eyes, mouth, brows and
     small race-specific parts are drawn live (see each painter's back/dyn/front hooks).
   - Lighting convention everywhere: soft key light from the upper left, coloured rim light from the right.
*/
(function (M) {
  'use strict';

  const TAU = Math.PI * 2, PI = Math.PI;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, sqrt = Math.sqrt, hypot = Math.hypot, atan2 = Math.atan2;
  const W = 400, H = 500;
  const RACES = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  const MOODS = ['neutral', 'pleased', 'angry', 'worried', 'scheming'];
  const PAINT = {};

  /* ======================================================================= small helpers */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(a, b) {
    let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* ---- colour ---- */
  const _rgb = Object.create(null);
  function rgbOf(c) {
    if (typeof c !== 'string') return c;
    let v = _rgb[c]; if (v) return v;
    let s = c.trim();
    if (s[0] === '#') {
      if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      v = [parseInt(s.slice(1, 3), 16) || 0, parseInt(s.slice(3, 5), 16) || 0, parseInt(s.slice(5, 7), 16) || 0];
    } else { const m = s.match(/[\d.]+/g) || []; v = [+m[0] || 0, +m[1] || 0, +m[2] || 0]; }
    return (_rgb[c] = v);
  }
  const h2 = (n) => { n = n < 0 ? 0 : n > 255 ? 255 : Math.round(n); return (n < 16 ? '0' : '') + n.toString(16); };
  function mixc(a, b, t) {
    const A = rgbOf(a), B = rgbOf(b);
    return '#' + h2(A[0] + (B[0] - A[0]) * t) + h2(A[1] + (B[1] - A[1]) * t) + h2(A[2] + (B[2] - A[2]) * t);
  }
  const lite = (c, k) => mixc(c, '#ffffff', k);
  const dark = (c, k) => mixc(c, '#000000', k);
  function rgba(c, a) {
    const v = rgbOf(c);
    return 'rgba(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : Math.round(a * 1000) / 1000) + ')';
  }
  function lg(g, x0, y0, x1, y1, st) {
    const r = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }
  function rgd(g, x, y, r0, r1, st, x2, y2) {
    const r = g.createRadialGradient(x, y, r0, x2 == null ? x : x2, y2 == null ? y : y2, r1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }
  function colorPal(hex) {
    hex = (typeof hex === 'string' && /^#?[0-9a-f]{3,8}$/i.test(hex.trim())) ? hex.trim() : '#d6b36a';
    if (hex[0] !== '#') hex = '#' + hex;
    if (hex.length > 7) hex = hex.slice(0, 7);
    return { hex: hex, hi: lite(hex, 0.42), lo: dark(hex, 0.36), deep: dark(hex, 0.66), mid: hex };
  }

  /* ======================================================================= path builders */
  function bounds(p, m) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < p.length; i += 2) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
    return [x0 - m, y0 - m, x1 + m, y1 + m];
  }
  /* Catmull-Rom spline through a flat [x,y,x,y...] list, emitted as cubic beziers. corners = indices kept sharp. */
  function trace(t, p, closed, corners, k, noMove) {
    const n = p.length >> 1, f = (k == null ? 1 : k) / 6;
    const ix = (i) => (closed ? ((i % n) + n) % n : (i < 0 ? 0 : i > n - 1 ? n - 1 : i));
    if (!noMove) t.moveTo(p[0], p[1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = ix(i - 1) * 2, b = ix(i) * 2, c = ix(i + 1) * 2, d = ix(i + 2) * 2;
      const ca = corners && corners.indexOf(ix(i)) >= 0, cb = corners && corners.indexOf(ix(i + 1)) >= 0;
      t.bezierCurveTo(
        ca ? p[b] : p[b] + (p[c] - p[a]) * f, ca ? p[b + 1] : p[b + 1] + (p[c + 1] - p[a + 1]) * f,
        cb ? p[c] : p[c] - (p[d] - p[b]) * f, cb ? p[c + 1] : p[c + 1] - (p[d + 1] - p[b + 1]) * f,
        p[c], p[c + 1]);
    }
    if (closed) t.closePath();
  }
  function shape(p, closed, corners, k) {
    const path = new Path2D(); trace(path, p, closed !== false, corners, k);
    return { path: path, bb: bounds(p, 5), pts: p };
  }
  function pshape(p, closed) {
    const path = new Path2D(); path.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
    if (closed !== false) path.closePath();
    return { path: path, bb: bounds(p, 3), pts: p };
  }
  function eshape(x, y, rx, ry, rot) {
    const path = new Path2D(); path.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    const r = Math.max(rx, ry);
    return { path: path, bb: [x - r - 2, y - r - 2, x + r + 2, y + r + 2], pts: null };
  }
  /* right-half outline (top axis point ... bottom axis point) -> full symmetric closed outline */
  function symPts(half, cx) {
    cx = cx == null ? 200 : cx;
    const n = half.length >> 1, out = half.slice();
    for (let i = n - 2; i >= 1; i--) out.push(2 * cx - half[i * 2], half[i * 2 + 1]);
    return out;
  }
  function mirror(p, cx) {
    cx = cx == null ? 200 : cx;
    const o = [];
    for (let i = p.length - 2; i >= 0; i -= 2) o.push(2 * cx - p[i], p[i + 1]);
    return o;
  }
  function inClip(g, sh, fn) { g.save(); g.clip(sh.path); fn(); g.restore(); }

  /* ======================================================================= painting toolbox */
  let _sc = null, _sg = null;
  function scratch(w, h) {
    if (!_sc) _sc = document.createElement('canvas');
    if (_sc.width < w || _sc.height < h) { _sc.width = Math.max(_sc.width, w); _sc.height = Math.max(_sc.height, h); _sg = null; }
    if (!_sg) _sg = _sc.getContext('2d');
    return _sg;
  }
  const OFFX = 5000;
  /* Soft crescent: the part of `sh` NOT covered by `sh` shifted by (dx,dy), blurred, tinted and clipped to `sh`.
     (dx,dy) = (-d,-d) paints the lower-right shade edge, (+d,+d) the upper-left highlight edge, (-r,0) the right rim. */
  function crescent(g, sh, dx, dy, col, alpha, blur, op) {
    const T = g.getTransform(), s = hypot(T.a, T.b), cw = g.canvas.width, ch = g.canvas.height;
    const m = blur * 2 + abs(dx) + abs(dy) + 3, bb = sh.bb;
    const xs = [bb[0] - m, bb[2] + m], ys = [bb[1] - m, bb[3] + m];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const X = T.a * xs[i] + T.c * ys[j] + T.e, Y = T.b * xs[i] + T.d * ys[j] + T.f;
      if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(cw, Math.ceil(x1)); y1 = Math.min(ch, Math.ceil(y1));
    const bw = x1 - x0, bh = y1 - y0; if (bw < 1 || bh < 1) return;
    const sg = scratch(cw, ch);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
    sg.clearRect(x0, y0, bw, bh);
    sg.setTransform(T.a, T.b, T.c, T.d, T.e, T.f);
    sg.fillStyle = '#000'; sg.fill(sh.path);
    sg.globalCompositeOperation = 'destination-out';
    sg.translate(dx, dy); sg.fill(sh.path);
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over';
    g.save();
    g.clip(sh.path);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha *= alpha; if (op) g.globalCompositeOperation = op;
    g.shadowColor = col; g.shadowBlur = Math.max(0.01, blur * s); g.shadowOffsetX = OFFX; g.shadowOffsetY = 0;
    g.drawImage(_sc, x0, y0, bw, bh, x0 - OFFX, y0, bw, bh);
    g.restore();
  }
  /* Form-lit fill: base gradient (light upper-left) + soft shade / highlight / rim crescents (+ optional edge line). */
  function fillBase(g, sh, pal) {
    const bb = sh.bb, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    g.save();
    g.fillStyle = lg(g, bb[0] + bw * 0.16, bb[1] + bh * 0.04, bb[0] + bw * 0.84, bb[3] - bh * 0.04, [0, pal.hi, 0.5, pal.mid, 1, pal.lo]);
    g.fill(sh.path);
    g.restore();
  }
  function lightPass(g, sh, pal, o) {
    o = o || {};
    const bb = sh.bb, bw = bb[2] - bb[0], bh = bb[3] - bb[1];
    const d = o.d || clamp(Math.min(bw, bh) * 0.085, 3, 17);
    if (o.shade !== 0) crescent(g, sh, -d, -d * 0.85, pal.sh || dark(pal.lo, 0.45), o.shade == null ? 0.5 : o.shade, d * 0.95);
    if (o.spec !== 0) crescent(g, sh, d * 0.85, d * 0.85, pal.sp || lite(pal.hi, 0.45), o.spec == null ? 0.4 : o.spec, d * 0.7);
    if (o.rim) { const rw = o.rimW || d * 0.8; crescent(g, sh, -rw, -rw * 0.1, o.rim, o.rimA == null ? 0.85 : o.rimA, rw * 0.55, o.rimOp); }
    if (o.edge) { g.save(); g.strokeStyle = o.edge; g.lineWidth = o.edgeW || 1.5; g.lineJoin = 'round'; g.stroke(sh.path); g.restore(); }
  }
  function litFill(g, sh, pal, o) { fillBase(g, sh, pal); lightPass(g, sh, pal, o); }
  /* one feather / scale: leaf shape pointing along +y from the origin, drawn at (x,y) rotated by ang */
  function feather(g, x, y, ang, len, wid, c0, c1, line, rib) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(wid * 0.62, len * 0.18, wid * 0.52, len * 0.76, 0, len);
    g.bezierCurveTo(-wid * 0.52, len * 0.76, -wid * 0.62, len * 0.18, 0, 0);
    g.fillStyle = lg(g, 0, 0, 0, len, [0, c0, 1, c1]); g.fill();
    if (line) { g.strokeStyle = line; g.lineWidth = 0.8; g.stroke(); }
    if (rib) { g.strokeStyle = rib; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, len * 0.08); g.lineTo(0, len * 0.88); g.stroke(); }
    g.restore();
  }
  /* soft-edged arbitrary shape (blurred via the shadow trick): painterly shadows / highlights of any outline */
  function soft(g, sh, col, alpha, blur) {
    const T = g.getTransform(), s = hypot(T.a, T.b);
    g.save();
    g.shadowColor = rgba(col, alpha); g.shadowBlur = Math.max(0.01, blur * s); g.shadowOffsetX = OFFX; g.shadowOffsetY = 0;
    g.setTransform(T.a, T.b, T.c, T.d, T.e - OFFX, T.f);
    g.fillStyle = '#000'; g.fill(sh.path);
    g.restore();
  }
  function softPoly(g, pts, col, alpha, blur, smooth) {
    soft(g, smooth === false ? pshape(pts) : shape(pts), col, alpha, blur);
  }
  /* soft radial blotch (shadows, highlights, glows) */
  function blob(g, x, y, rx, ry, col, a, rot, hard) {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(rx, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(hard == null ? 0.45 : hard, rgba(col, a * 0.6)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
  }
  /* scattered brush strokes inside a shape: fur, hair, plumage texture ... */
  function strokes(g, sh, n, o, R) {
    g.save();
    if (sh) g.clip(sh.path);
    const bb = o.bb || sh.bb, cols = o.cols;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = bb[0] + R() * (bb[2] - bb[0]), y = bb[1] + R() * (bb[3] - bb[1]);
      let a = o.flow ? o.flow(x, y, R) : (o.ang || 0);
      a += (R() - 0.5) * (o.jit == null ? 0.5 : o.jit);
      const L = o.len[0] + (o.len[1] - o.len[0]) * R();
      const cu = (R() - 0.5) * (o.curve == null ? 0.35 : o.curve) * L;
      const ca = cos(a), sa = sin(a);
      g.strokeStyle = cols[(R() * cols.length) | 0];
      g.globalAlpha = o.a[0] + (o.a[1] - o.a[0]) * R();
      g.lineWidth = o.w[0] + (o.w[1] - o.w[0]) * R();
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + ca * L * 0.5 - sa * cu, y + sa * L * 0.5 + ca * cu, x + ca * L, y + sa * L);
      g.stroke();
    }
    g.restore();
  }
  /* tapered polygon along a quadratic centreline (brows, whiskers, tails) -> adds a closed subpath to g */
  const _tu = new Float32Array(64), _tl = new Float32Array(64);
  function taper(g, x0, y0, cx, cy, x1, y1, w0, w1, steps) {
    steps = steps || 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
      const l = hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = (w0 + (w1 - w0) * t) / 2;
      _tu[i * 2] = x + nx * w; _tu[i * 2 + 1] = y + ny * w; _tl[i * 2] = x - nx * w; _tl[i * 2 + 1] = y - ny * w;
    }
    g.moveTo(_tu[0], _tu[1]);
    for (let i = 1; i <= steps; i++) g.lineTo(_tu[i * 2], _tu[i * 2 + 1]);
    for (let i = steps; i >= 0; i--) g.lineTo(_tl[i * 2], _tl[i * 2 + 1]);
    g.closePath();
  }
  /* fur / feather fringe: strokes start just inside a spline outline and flick outward (softens hard silhouettes).
     o: {len:[a,b], w:[a,b], a:[a,b], cols:[], colFn(x,y,nx,ny,R), inset, grav, jit, curve, only(nx,ny)} */
  function edgeFur(g, sh, n, o, R) {
    const p = sh.pts, np = p.length >> 1, f = 1 / 6;
    let cx = 0, cy = 0; for (let i = 0; i < np; i++) { cx += p[i * 2]; cy += p[i * 2 + 1]; } cx /= np; cy /= np;
    g.save(); g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const u = R() * np, i = Math.floor(u) % np, tt = u - Math.floor(u);
      const i0 = (i - 1 + np) % np, i2 = (i + 1) % np, i3 = (i + 2) % np;
      const x0 = p[i * 2], y0 = p[i * 2 + 1], x3 = p[i2 * 2], y3 = p[i2 * 2 + 1];
      const c1x = x0 + (p[i2 * 2] - p[i0 * 2]) * f, c1y = y0 + (p[i2 * 2 + 1] - p[i0 * 2 + 1]) * f;
      const c2x = x3 - (p[i3 * 2] - p[i * 2]) * f, c2y = y3 - (p[i3 * 2 + 1] - p[i * 2 + 1]) * f, mt = 1 - tt;
      const bx = mt * mt * mt * x0 + 3 * mt * mt * tt * c1x + 3 * mt * tt * tt * c2x + tt * tt * tt * x3;
      const by = mt * mt * mt * y0 + 3 * mt * mt * tt * c1y + 3 * mt * tt * tt * c2y + tt * tt * tt * y3;
      const tx = 3 * mt * mt * (c1x - x0) + 6 * mt * tt * (c2x - c1x) + 3 * tt * tt * (x3 - c2x);
      const ty = 3 * mt * mt * (c1y - y0) + 6 * mt * tt * (c2y - c1y) + 3 * tt * tt * (y3 - c2y);
      let nx = ty, ny = -tx; const tl = hypot(nx, ny) || 1; nx /= tl; ny /= tl;
      if ((bx - cx) * nx + (by - cy) * ny < 0) { nx = -nx; ny = -ny; }
      if (o.only && !o.only(nx, ny, bx, by)) continue;
      const gr = o.grav || 0, dx = nx * (1 - gr), dy = ny * (1 - gr) + gr;
      const ang = atan2(dy, dx) + (R() - 0.5) * (o.jit == null ? 0.7 : o.jit);
      const L = (o.len[0] + (o.len[1] - o.len[0]) * R()) * (o.lenK ? o.lenK(nx, ny, bx, by) : 1), ins = o.inset == null ? 6 : o.inset;
      const sx = bx - nx * ins, sy = by - ny * ins, ex = bx + cos(ang) * L, ey = by + sin(ang) * L;
      const bend = (R() - 0.5) * L * (o.curve == null ? 0.5 : o.curve);
      g.strokeStyle = o.colFn ? o.colFn(bx, by, nx, ny, R) : o.cols[(R() * o.cols.length) | 0];
      g.globalAlpha = o.a[0] + (o.a[1] - o.a[0]) * R(); g.lineWidth = o.w[0] + (o.w[1] - o.w[0]) * R();
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 - sin(ang) * bend, (sy + ey) / 2 + cos(ang) * bend, ex, ey); g.stroke();
    }
    g.restore();
  }
  /* tapered curved lock (fur, hair, tentacle ...): root (x,y), direction ang (rad from +x), bend = sideways bulge */
  function lock(g, x, y, ang, len, w0, c0, c1, bend, w1) {
    const ex = x + cos(ang) * len, ey = y + sin(ang) * len;
    const cx = (x + ex) / 2 - sin(ang) * (bend || 0), cy = (y + ey) / 2 + cos(ang) * (bend || 0);
    g.beginPath(); taper(g, x, y, cx, cy, ex, ey, w0, w1 == null ? 2 : w1, 7);
    g.fillStyle = lg(g, x, y, ex, ey, [0, c0, 1, c1]); g.fill();
  }
  function inside(g, sh, x, y) { const T = g.getTransform(); return g.isPointInPath(sh.path, T.a * x + T.c * y + T.e, T.b * x + T.d * y + T.f); }
  function pip(p, x, y) {   // point in flat polygon
    let c = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > y) !== (p[j + 1] > y) && x < (p[j] - p[i]) * (y - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
    }
    return c;
  }
  const _glow = Object.create(null);
  function glowSprite(col) {
    let c = _glow[col]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = rgd(g, 32, 32, 0, 32, [0, rgba(col, 1), 0.22, rgba(col, 0.6), 0.55, rgba(col, 0.16), 1, rgba(col, 0)]);
    g.fillRect(0, 0, 64, 64);
    return (_glow[col] = c);
  }
  function glow(g, col, x, y, r, a) {
    if (a <= 0.003) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a > 1 ? 1 : a;
    g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); g.restore();
  }
  let _grain = null;
  function grain(g, cw, ch, amt) {
    if (!_grain) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const cg = c.getContext('2d'), id = cg.createImageData(128, 128), d = id.data, R = mulberry32(90210);
      for (let i = 0; i < d.length; i += 4) { const v = R(); d[i] = d[i + 1] = d[i + 2] = v > 0.5 ? 255 : 0; d[i + 3] = Math.floor(abs(v - 0.5) * 2 * 255); }
      cg.putImageData(id, 0, 0); _grain = g.createPattern(c, 'repeat');
    }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = amt == null ? 0.07 : amt;
    g.fillStyle = _grain; g.fillRect(0, 0, cw, ch); g.restore();
  }

  /* ---- generic almond eye (human-like races). c = static config, s = dynamic state ---- */
  function eyePath(g, x, y, w, hu, hl, dir, ti, to) {
    const xi = x + dir * w, xo = x - dir * w, yi = y + ti, yo = y + to;
    g.moveTo(xi, yi);
    g.bezierCurveTo(x + dir * w * 0.5, y - hu * 1.33 + ti * 0.5, x - dir * w * 0.45, y - hu * 1.33 + to * 0.5, xo, yo);
    g.bezierCurveTo(x - dir * w * 0.4, y + hl * 1.33 + to * 0.5, x + dir * w * 0.45, y + hl * 1.33 + ti * 0.5, xi, yi);
    g.closePath();
  }
  const _iris = Object.create(null);
  function irisSprite(c) {
    const key = c.i0 + c.i1 + c.i2 + (c.fib == null ? 1 : c.fib) + '|' + (c.limb == null ? 0.55 : c.limb);
    let cv = _iris[key]; if (cv) return cv;
    const S = 96, R0 = S / 2;
    cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    g.fillStyle = rgd(g, R0, R0, R0 * 0.1, R0, [0, c.i0, 0.5, c.i1, 0.86, c.i2, 1, dark(c.i2, 0.45)]);
    g.beginPath(); g.arc(R0, R0, R0 - 0.5, 0, TAU); g.fill();
    const R = mulberry32(strHash(key)); g.lineCap = 'round';
    for (let i = 0, n = 80 * (c.fib == null ? 1 : c.fib); i < n; i++) {
      const a = R() * TAU, r0 = R0 * (0.22 + R() * 0.22), r1 = R0 * (0.62 + R() * 0.34);
      g.strokeStyle = R() > 0.5 ? rgba(lite(c.i0, 0.2), 0.2 + R() * 0.3) : rgba(dark(c.i2, 0.2), 0.25 + R() * 0.3);
      g.lineWidth = 0.7 + R() * 1.5;
      g.beginPath(); g.moveTo(R0 + cos(a) * r0, R0 + sin(a) * r0); g.lineTo(R0 + cos(a) * r1, R0 + sin(a) * r1); g.stroke();
    }
    g.strokeStyle = rgba(c.i0, 0.3); g.lineWidth = 2; g.beginPath(); g.arc(R0, R0, R0 * 0.4, 0, TAU); g.stroke();
    g.strokeStyle = rgba(dark(c.i2, c.limb == null ? 0.55 : c.limb), 0.95); g.lineWidth = R0 * 0.22; g.beginPath(); g.arc(R0, R0, R0 * 0.9, 0, TAU); g.stroke();
    return (_iris[key] = cv);
  }
  /* c = static look, s = {open, lower, ti, to, dir, lx, ly, pup}. Draws sclera, iris, pupil, glints, lid shading, lash line, crease. */
  function drawEye(g, x, y, c, s) {
    const hu = c.h * s.open, hl = c.h * c.lowR * (1 - s.lower * 0.6) * Math.min(1, 0.3 + s.open * 0.7);
    const dir = s.dir, xi = x + dir * c.w, xo = x - dir * c.w, yi = y + s.ti, yo = y + s.to;
    g.save();
    g.beginPath(); eyePath(g, x, y, c.w, hu, hl, dir, s.ti, s.to); g.clip();
    g.fillStyle = lg(g, x, y - c.h, x, y + c.h, [0, c.sc0, 1, c.sc1]); g.fillRect(x - c.w - 3, y - c.h * 1.8, c.w * 2 + 6, c.h * 3.6);
    g.fillStyle = rgd(g, x, y, c.w * 0.35, c.w * 1.1, [0, 'rgba(60,20,20,0)', 1, 'rgba(60,20,20,.4)']); g.fillRect(x - c.w - 3, y - c.h * 1.8, c.w * 2 + 6, c.h * 3.6);
    const ir = c.ir, ix = x + s.lx * c.w * 0.3, iy = y + s.ly * c.h * 0.4 + (c.iy || 0);
    g.drawImage(irisSprite(c), ix - ir, iy - ir, ir * 2, ir * 2);
    const pr = ir * c.pr * (1 + s.pup * 0.4);
    if (c.pupil !== 'none') {
      g.fillStyle = c.pc; g.beginPath();
      if (c.pupil === 'vslit') g.ellipse(ix, iy, Math.max(pr * 0.4, 0.9), ir * 0.94, 0, 0, TAU);
      else if (c.pupil === 'hslit') g.ellipse(ix, iy, ir * 0.9, Math.max(pr * 0.4, 0.9), 0, 0, TAU);
      else g.arc(ix, iy, pr, 0, TAU);
      g.fill();
    }
    if (c.glint !== 0) {
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(ix - ir * 0.36, iy - ir * 0.4, ir * 0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.32)'; g.beginPath(); g.arc(ix + ir * 0.32, iy + ir * 0.36, ir * 0.12, 0, TAU); g.fill();
    }
    g.fillStyle = lg(g, x, y - hu, x, y + hu * 0.7, [0, 'rgba(14,6,10,.72)', 1, 'rgba(14,6,10,0)']);
    g.fillRect(x - c.w - 3, y - c.h * 1.8, c.w * 2 + 6, c.h * 1.8 + hu * 0.7);
    if (c.water) {
      g.strokeStyle = 'rgba(214,130,132,.5)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(xi, yi + 1);
      g.bezierCurveTo(x + dir * c.w * 0.45, y + hl * 1.33 - 1, x - dir * c.w * 0.4, y + hl * 1.33 - 1, xo, yo + 1); g.stroke();
    }
    g.restore();
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    const upper = () => {
      g.beginPath(); g.moveTo(xi, yi);
      g.bezierCurveTo(x + dir * c.w * 0.5, y - hu * 1.33 + s.ti * 0.5, x - dir * c.w * 0.45, y - hu * 1.33 + s.to * 0.5, xo, yo);
    };
    upper(); g.strokeStyle = rgba(c.lash, 0.3); g.lineWidth = c.lashW * 2; g.stroke();
    upper(); g.lineTo(xo - dir * c.wing, yo - 0.9); g.strokeStyle = c.lash; g.lineWidth = c.lashW * (0.65 + 0.35 * Math.min(1, s.open * 2)); g.stroke();
    if (c.crease) {
      g.strokeStyle = rgba(c.creaseCol, c.crease * (0.5 + 0.5 * Math.min(1, s.open * 1.2))); g.lineWidth = 1.7;
      const cy2 = y - (c.h + 6) * (0.55 + 0.45 * s.open);
      g.beginPath(); g.moveTo(xi + dir * 1.5, yi - 2);
      g.bezierCurveTo(x + dir * c.w * 0.4, cy2 - 3 + s.ti * 0.4, x - dir * c.w * 0.4, cy2 - 3 + s.to * 0.4, xo - dir * 2, yo - 3); g.stroke();
    }
    if (c.lowerLine) {
      g.strokeStyle = rgba(c.creaseCol, c.lowerLine); g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(xi - dir * 3, yi + 1.2);
      g.bezierCurveTo(x + dir * c.w * 0.4, y + hl * 1.33 + 1.5, x - dir * c.w * 0.4, y + hl * 1.33 + 1.5, xo + dir * 3, yo + 1); g.stroke();
    }
    g.restore();
  }

  /* ---- generic hair brow rig (tapered, mood-driven). c: {y,dy,xi,xo,arch,w0,w1,kb,kr,hi,mid,lo,sl,sd,n} ---- */
  function browRig(g, side, A, c) {
    const m = A.m, as = m.bAsym * (side < 0 ? -9 : 3);
    const xi = 200 + side * c.xi, xo = 200 + side * c.xo;
    const yi = c.y + m.brow * c.kb - m.browY * c.kr + as, yo = c.y + c.dy - m.brow * c.kb * 0.4 - m.browY * c.kr * 0.55 + as * 0.7;
    const cx = (xi + xo) / 2, cy = (yi + yo) / 2 - c.arch - (m.brow > 0 ? -m.brow * 3 : -m.brow * 3);
    const w0 = c.w0 + Math.max(0, m.brow) * 2, w1 = c.w1, n = c.n || 30;
    g.save();
    g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, w0, w1, 9);
    g.fillStyle = lg(g, 0, cy - w0 * 0.8, 0, cy + w0 * 0.6, [0, c.hi, 0.5, c.mid, 1, c.lo]); g.fill();
    g.clip(); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const t = (i + hash2(i, 3) * 0.8) / n, u = 1 - t, x = u * u * xi + 2 * u * t * cx + t * t * xo, y = u * u * yi + 2 * u * t * cy + t * t * yo;
      const tx = 2 * u * (cx - xi) + 2 * t * (xo - cx), ty = 2 * u * (cy - yi) + 2 * t * (yo - cy);
      const r = hash2(i, 7), ang = atan2(ty, tx) + (side < 0 ? 1 : -1) * 0.6 * (1 - t) + (r - 0.5) * 0.5;
      const wob = (hash2(i, 11) - 0.5) * w0 * 0.7 * (1 - t * 0.6);
      g.strokeStyle = r > 0.5 ? c.sl : c.sd; g.lineWidth = 0.9 + r * 0.5;
      g.beginPath(); g.moveTo(x - cos(ang) * 3.5, y - sin(ang) * 3.5 + wob); g.lineTo(x + cos(ang) * 4.5, y + sin(ang) * 4.5 + wob); g.stroke();
    }
    g.restore();
  }
  /* ---- generic lips + open mouth rig. c: {cx,my,mw,mwk,smk,talkw,openk,drop,thU,thL,bow,lipU,lipL,inside,tongue,teeth,line,corner} ---- */
  function mouthRig(g, A, c) {
    const m = A.m, sm = m.smile, as = m.asym, cx = c.cx == null ? 200 : c.cx, my = c.my;
    const mw = c.mw + sm * c.mwk - A.talk * c.talkw, op = clamp(m.open * c.openk + A.talk, 0, 1);
    const c0 = my - sm * c.smk, cl = c0 + as * 1.5, cr = c0 - as * 4.2, N = 16;
    const cyAt = (u) => lerp(cl, cr, (u + 1) / 2);
    const yu = (u) => my + (cyAt(u) - my) * u * u;
    const yl = (u) => yu(u) + op * c.drop * Math.pow(1 - u * u, 0.9);
    const thU = (u) => c.thU * Math.pow(1 - u * u, 0.6) - c.bow * Math.exp(-(u * u) / 0.02);
    const thL = (u) => (c.thL - 2.5 * Math.max(0, sm)) * Math.pow(1 - u * u, 0.7);
    g.save();
    if (op > 0.05) {
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(cx + u * mw, yu(u)); else g.moveTo(cx + u * mw, yu(u)); }
      for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(cx + u * mw, yl(u)); }
      g.closePath(); g.fillStyle = c.inside; g.fill();
      g.save(); g.clip();
      if (c.teeth) {
        const th = Math.min(op * 9, 7.5) * (c.teethK || 1);
        g.fillStyle = lg(g, 0, my - 8, 0, my + th, [0, '#e8e2d8', 1, '#fffdf6']);
        g.beginPath();
        for (let i = 2; i <= N - 2; i++) { const u = -1 + i * 2 / N, y = yu(u) + th * Math.pow(1 - u * u, 0.4); if (i > 2) g.lineTo(cx + u * mw, y); else g.moveTo(cx + u * mw, y); }
        for (let i = N - 2; i >= 2; i--) { const u = -1 + i * 2 / N; g.lineTo(cx + u * mw, yu(u) - 2); }
        g.closePath(); g.fill();
      }
      if (c.tongue) blob(g, cx, my + op * c.drop * 0.8, mw * 0.6, 5 + op * 3, c.tongue, 0.8);
      g.restore();
    }
    g.beginPath();
    for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N, x = cx + u * mw; if (i) g.lineTo(x, yu(u) - thU(u)); else g.moveTo(x, yu(u) - thU(u)); }
    for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(cx + u * mw, yu(u)); }
    g.closePath();
    g.fillStyle = lg(g, 0, my - 10, 0, my + 1, [0, lite(c.lipU, 0.08), 1, dark(c.lipU, 0.12)]); g.fill();
    g.beginPath();
    for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N, x = cx + u * mw; if (i) g.lineTo(x, yl(u)); else g.moveTo(x, yl(u)); }
    for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(cx + u * mw, yl(u) + thL(u)); }
    g.closePath();
    g.fillStyle = lg(g, 0, my, 0, my + 12 + op * c.drop, [0, c.lipL, 0.55, lite(c.lipL, 0.1), 1, dark(c.lipL, 0.18)]); g.fill();
    blob(g, cx - 5, yl(-0.05) + 4.5, 9, 3, '#ffffff', 0.34);
    g.strokeStyle = c.line; g.lineWidth = 1.3; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(cx + u * mw, yu(u)); else g.moveTo(cx + u * mw, yu(u)); }
    g.stroke();
    if (op > 0.05) {
      g.beginPath();
      for (let i = 1; i < N; i++) { const u = -1 + i * 2 / N; if (i > 1) g.lineTo(cx + u * mw, yl(u)); else g.moveTo(cx + u * mw, yl(u)); }
      g.stroke();
    }
    g.fillStyle = c.corner;
    g.beginPath(); g.arc(cx - mw, cl, 1.7, 0, TAU); g.arc(cx + mw, cr, 1.7, 0, TAU); g.fill();
    g.restore();
    return { mw: mw, cl: cl, cr: cr, op: op };
  }

  /* ======================================================================= animation */
  const MKEYS = ['brow', 'browY', 'lid', 'lower', 'smile', 'open', 'pup', 'glow', 'lean', 'tilt', 'bAsym', 'asym', 'ear', 'gx'];
  const MOOD = {
    neutral:  { brow: 0,    browY: 0,    lid: 0,     lower: 0,    smile: 0,    open: 0,    pup: 0,     glow: 1,    lean: 0,    tilt: 0,     bAsym: 0, asym: 0, ear: 0,    gx: 0 },
    pleased:  { brow: -0.2, browY: 0.35, lid: 0.06,  lower: 0.55, smile: 1,    open: 0.1,  pup: 0.35,  glow: 1.18, lean: -0.3, tilt: 0.055, bAsym: 0, asym: 0, ear: 0.5,  gx: 0 },
    angry:    { brow: 1,    browY: -0.4, lid: 0.42,  lower: 0.2,  smile: -0.9, open: 0.3,  pup: -0.6,  glow: 1.45, lean: 1,    tilt: 0,     bAsym: 0, asym: 0, ear: -1,   gx: 0 },
    worried:  { brow: -1,   browY: 0.6,  lid: -0.15, lower: 0,    smile: -0.5, open: 0.08, pup: 0.7,   glow: 0.75, lean: -0.8, tilt: -0.075, bAsym: 0, asym: 0, ear: -0.7, gx: 0.15 },
    scheming: { brow: 0.45, browY: -0.1, lid: 0.46,  lower: 0.32, smile: 0.6,  open: 0,    pup: -0.25, glow: 1.12, lean: 0.4, tilt: 0.085,  bAsym: 1, asym: 1, ear: 0.2,  gx: 0.55 }
  };
  const _states = new Map();
  function getState(key) {
    let st = _states.get(key);
    if (!st) {
      if (_states.size > 300) _states.clear();
      const h = strHash(key);
      st = { t: -1e9, m: {}, talkAmt: 0, ph: [], seed: h & 0xffff, A: { m: null, lx: 0, ly: 0 } };
      for (let i = 0; i < MKEYS.length; i++) st.m[MKEYS[i]] = MOOD.neutral[MKEYS[i]];
      for (let i = 0; i < 8; i++) st.ph.push(hash2(h, i + 3) * TAU);
      st.A.m = st.m;
      _states.set(key, st);
    }
    return st;
  }
  function blinkAmt(t, seed) {
    const P = 4.1, off = (seed % 97) * 0.043, u = (t + off) / P, k = Math.floor(u), s0 = k * P - off;
    const r = 0.1 + hash2(k, seed) * 0.7, c = s0 + r * P, x = t - c;
    let b = 0;
    if (x > -0.06 && x < 0.12) b = x < 0 ? 1 + x / 0.06 : 1 - x / 0.12;
    if (hash2(k, seed + 5) < 0.22) { const x2 = x - 0.3; if (x2 > -0.06 && x2 < 0.12) b = Math.max(b, x2 < 0 ? 1 + x2 / 0.06 : 1 - x2 / 0.12); }
    return b < 0 ? 0 : b;
  }
  function idleGaze(t, seed, A) {
    const P = 2.7, off = (seed % 31) * 0.07, u = (t + off) / P, k = Math.floor(u), f = u - k;
    const tx = (kk) => (hash2(kk, seed + 5) < 0.55 ? 0 : (hash2(kk, seed) * 2 - 1) * 0.55);
    const ty = (kk) => (hash2(kk, seed + 5) < 0.55 ? 0 : (hash2(kk, seed + 77) * 2 - 1) * 0.3);
    const e = sstep(f / 0.1);
    A.lx = lerp(tx(k - 1), tx(k), e); A.ly = lerp(ty(k - 1), ty(k), e);
  }
  function speech(t, seed) {
    const ph = seed * 0.37;
    const v = abs(sin(t * 8.6 + 1.7 * sin(t * 2.3 + ph))) * 0.55 + abs(sin(t * 5.3 + ph)) * 0.45;
    const gate = clamp(0.55 + 1.3 * sin(t * 1.9 + ph) + 0.4 * sin(t * 0.7), 0, 1);
    return Math.min(1, v * (0.45 + 0.75 * gate) * 1.15) * (gate > 0.05 ? 1 : 0);
  }
  /* advance mood smoothing and fill the per-frame animation record A */
  function animate(st, o, t, snap) {
    const A = st.A, m = st.m, tg = MOOD[o.mood] || MOOD.neutral;
    const tt = o.talking === true ? 1 : (+o.talking || 0), dt = t - st.t;
    if (snap || !(dt >= 0 && dt < 0.5)) { for (let i = 0; i < MKEYS.length; i++) m[MKEYS[i]] = tg[MKEYS[i]]; st.talkAmt = tt; }
    else if (dt > 0) {
      const a = 1 - Math.exp(-dt * 7);
      for (let i = 0; i < MKEYS.length; i++) { const k = MKEYS[i]; m[k] += (tg[k] - m[k]) * a; }
      st.talkAmt += (tt - st.talkAmt) * (1 - Math.exp(-dt * 9));
    }
    st.t = t;
    const ph = st.ph, seed = st.seed;
    A.t = t; A.talkAmt = st.talkAmt; A.seed = seed; A.ph = ph;
    A.blink = blinkAmt(t, seed);
    if (o.eyeLook) { A.lx = clamp(+o.eyeLook.x || 0, -1, 1); A.ly = clamp(+o.eyeLook.y || 0, -1, 1); }
    else { idleGaze(t, seed, A); A.lx = clamp(A.lx + m.gx, -1, 1); }
    const env = st.talkAmt > 0.002 ? speech(t, seed) * st.talkAmt : 0;
    A.talk = env;
    const br = sin(t * 1.5 + ph[0]) * 0.75 + sin(t * 3.1 + ph[1]) * 0.25;
    A.breath = br;
    A.hx = sin(t * 0.43 + ph[1]) * 2.4 + sin(t * 1.13 + ph[2]) * 0.8;
    A.hy = sin(t * 0.37 + ph[2]) * 1.7 + sin(t * 0.91 + ph[3]) * 0.6 - br * 1.0 + m.lean * 8 + sin(t * 6.1) * 0.9 * env;
    A.hr = sin(t * 0.29 + ph[3]) * 0.011 + sin(t * 0.77 + ph[4]) * 0.004 + m.tilt + sin(t * 2.3 + ph[5]) * 0.006 * st.talkAmt;
    A.hs = 1 + m.lean * 0.034;
    return A;
  }

  /* ======================================================================= backdrop */
  function backdrop(ctx, x, y, w, h, tint, accent, t) {
    const c0 = mixc(tint, '#33449a', 0.38), cx = x + w * 0.5, cy = y + h * 0.42, r = hypot(w, h) * 0.64;
    ctx.fillStyle = rgd(ctx, cx, cy, 0, r, [0, lite(c0, 0.06), 0.4, c0, 0.78, mixc(tint, '#0b1236', 0.78), 1, '#060a1f'], cx - w * 0.07, cy - h * 0.04);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lg(ctx, 0, y + h * 0.5, 0, y + h, [0, 'rgba(4,6,20,0)', 1, 'rgba(4,6,20,.6)']);
    ctx.fillRect(x, y, w, h);
    const pulse = 0.28 + 0.05 * sin(t * 0.7);
    ctx.fillStyle = lg(ctx, x + w, 0, x + w * 0.25, 0, [0, rgba(accent, pulse), 0.6, rgba(accent, pulse * 0.2), 1, rgba(accent, 0)]);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lg(ctx, x, 0, x + w * 0.4, 0, [0, 'rgba(3,5,16,.45)', 1, 'rgba(3,5,16,0)']);
    ctx.fillRect(x, y, w, h);
  }

  /* ======================================================================= cache + render */
  const BUCKETS = [0.25, 0.3, 0.37, 0.45, 0.55, 0.67, 0.8, 1, 1.2, 1.5, 2];
  const _ents = new Map();
  /* crop a painted layer to its alpha bounding box (cheaper to blit every frame); stores the virtual rect on the canvas */
  function cropLayer(c, bucket) {
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4 + 3;
      for (let x = 0; x < w; x++) if (d[row + x * 4] > 6) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, o = document.createElement('canvas'); o.width = cw; o.height = ch;
    o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
    o.vx = x0 / bucket; o.vy = y0 / bucket; o.vw = cw / bucket; o.vh = ch / bucket;
    return o;
  }
  function blit(g, L) { g.drawImage(L, L.vx, L.vy, L.vw, L.vh); }
  function buildEntry(race, bi, variant, color) {
    const pa = PAINT[race], bucket = BUCKETS[bi];
    const P = {
      race: race, variant: variant, bucket: bucket, color: colorPal(color || pa.defColor), accent: pa.accent,
      rng: (salt) => mulberry32(variant * 7919 + RACES.indexOf(race) * 104729 + strHash(String(salt)))
    };
    const T = pa.traits ? pa.traits(P) : {};
    const cw = Math.ceil(W * bucket), ch = Math.ceil(H * bucket), layers = {};
    const mk = (name, fn) => {
      if (!fn) return;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d'); g.setTransform(bucket, 0, 0, bucket, 0, 0);
      fn.call(pa, g, P, T);
      if (name !== 'sheen') grain(g, cw, ch, pa.grain);
      layers[name] = cropLayer(c, bucket);
    };
    mk('body', pa.body); mk('head', pa.head); mk('fore', pa.fore); mk('collar', pa.collar); mk('sheen', pa.sheen); mk('ears', pa.ears); mk('aux', pa.aux); mk('aux2', pa.aux2);
    P.layers = layers;
    return { race: race, pa: pa, P: P, T: T, layers: layers, bucket: bucket };
  }
  function getEntry(race, scale, variant, color) {
    let bi = BUCKETS.length - 1;
    for (let i = 0; i < BUCKETS.length; i++) if (BUCKETS[i] >= scale * 0.94) { bi = i; break; }
    const key = race + '|' + bi + '|' + variant + '|' + (color || '');
    let e = _ents.get(key);
    if (e) { _ents.delete(key); _ents.set(key, e); return e; }
    e = buildEntry(race, bi, variant, color);
    _ents.set(key, e);
    if (_ents.size > 40) _ents.delete(_ents.keys().next().value);
    return e;
  }

  function renderFigure(ctx, ent, A, view) {
    const pa = ent.pa, L = ent.layers, P = ent.P, T = ent.T;
    ctx.save();
    ctx.translate(view.tx, view.ty); ctx.scale(view.s, view.s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const br = A.breath;
    // body frame (breathing)
    ctx.save();
    ctx.translate(200, H); ctx.scale(1, 1 + br * 0.006); ctx.translate(-200, -H); ctx.translate(0, -br * 1.4);
    if (pa.bodyBack) pa.bodyBack(ctx, P, T, A);
    if (L.body) blit(ctx, L.body);
    if (pa.bodyDyn) pa.bodyDyn(ctx, P, T, A);
    ctx.restore();
    // head frame
    ctx.save();
    const px = pa.pivot[0], py = pa.pivot[1];
    ctx.translate(px + A.hx, py + A.hy); ctx.rotate(A.hr); ctx.scale(A.hs, A.hs); ctx.translate(-px, -py);
    if (pa.back) pa.back(ctx, P, T, A);
    if (L.head) blit(ctx, L.head);
    if (pa.dyn) pa.dyn(ctx, P, T, A);
    if (L.fore) blit(ctx, L.fore);
    if (pa.front) pa.front(ctx, P, T, A);
    ctx.restore();
    // collar (body frame, over the neck)
    if (L.collar) {
      ctx.save();
      ctx.translate(200, H); ctx.scale(1, 1 + br * 0.006); ctx.translate(-200, -H); ctx.translate(0, -br * 1.4);
      blit(ctx, L.collar);
      if (pa.collarDyn) pa.collarDyn(ctx, P, T, A);
      ctx.restore();
    }
    ctx.restore();
  }
  function pixelScale(ctx, s) { const T = ctx.getTransform(); return s * hypot(T.a, T.b); }
  function keyOf(race, o) { return o.key || (race + '|' + (o.variant | 0) + '|' + (o.color || '')); }
  function bgTint(pa, o) { return typeof o.bg === 'string' ? o.bg : pa.bg; }

  function draw(ctx, race, x, y, w, h, o) {
    o = o || {};
    const pa = PAINT[race]; if (!pa) return;
    const t = o.t == null ? performance.now() / 1000 : +o.t, variant = o.variant | 0;
    const s = Math.max(w / W, h / H), vw = W * s, vh = H * s;
    const view = { s: s, tx: x + (w - vw) / 2, ty: y + (h - vh) * 0.22 };
    const ent = getEntry(race, pixelScale(ctx, s), variant, o.color);
    const st = getState(keyOf(race, o)), A = animate(st, o, t, !!o._snap);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (o.flip) { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + w / 2), 0); }
    if (o.bg !== false) backdrop(ctx, x, y, w, h, bgTint(pa, o), pa.accent, t);
    renderFigure(ctx, ent, A, view);
    ctx.restore();
  }
  function drawBadge(ctx, race, cx, cy, r, o) {
    o = o || {};
    const pa = PAINT[race]; if (!pa) return;
    const t = o.t == null ? performance.now() / 1000 : +o.t, variant = o.variant | 0;
    const rw = Math.max(1.6, r * 0.09), fr = r - rw, crop = pa.badge, s = fr / crop[2];
    const view = { s: s, tx: cx - crop[0] * s, ty: cy - crop[1] * s };
    const ent = getEntry(race, pixelScale(ctx, s), variant, o.color);
    const st = getState(keyOf(race, o)), A = animate(st, o, t, !!o._snap);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, fr, 0, TAU); ctx.clip();
    if (o.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    if (o.bg !== false) backdrop(ctx, cx - fr, cy - fr, fr * 2, fr * 2, bgTint(pa, o), pa.accent, t);
    renderFigure(ctx, ent, A, view);
    ctx.restore();
    // brass ring
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = r * 0.18; ctx.shadowOffsetY = r * 0.05;
    ctx.beginPath(); ctx.arc(cx, cy, r - rw / 2, 0, TAU); ctx.lineWidth = rw;
    ctx.strokeStyle = lg(ctx, cx - r, cy - r, cx + r, cy + r, [0, '#f6e3b0', 0.3, '#d6b36a', 0.62, '#8a7040', 0.82, '#c9a35c', 1, '#6e5830']);
    ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, fr + 0.4, 0, TAU); ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(8,6,18,.7)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r - rw * 0.3, PI * 1.08, PI * 1.58); ctx.lineWidth = Math.max(0.8, rw * 0.2); ctx.strokeStyle = 'rgba(255,248,215,.7)'; ctx.stroke();
    if (o.color) {
      const a = PI * 0.25, px = cx + cos(a) * (r - rw * 0.2), py = cy + sin(a) * (r - rw * 0.2), pr = Math.max(2.2, r * 0.17);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fillStyle = o.color; ctx.fill();
      ctx.lineWidth = Math.max(1, pr * 0.28); ctx.strokeStyle = '#d6b36a'; ctx.stroke();
    }
  }
  const _cc = new Map();
  function canvas(race, w, h, o) {
    o = o || {};
    const key = [race, w, h, o.mood || '', o.talking ? 1 : 0, o.color || '', o.bg == null ? '' : String(o.bg), o.flip ? 1 : 0, o.variant | 0,
      o.eyeLook ? o.eyeLook.x + ',' + o.eyeLook.y : '', o.t || 0].join('|');
    let c = _cc.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const o2 = {}; for (const k in o) o2[k] = o[k];
    o2.t = o.t || 0; o2._snap = true; o2.key = '@canvas|' + key;
    draw(g, race, 0, 0, w, h, o2);
    _states.delete(o2.key);
    _cc.set(key, c);
    if (_cc.size > 400) _cc.delete(_cc.keys().next().value);
    return c;
  }

  /* ======================================================================= HUMAN */
  PAINT.human = (function () {
    const SKIN = [
      { hi: '#f8e2cc', mid: '#e3b490', lo: '#aa745c', sh: '#6a3b36', blush: '#e48e84', lip: '#d0686a' },
      { hi: '#f0cca4', mid: '#d09c72', lo: '#8d5a46', sh: '#533029', blush: '#d97f6c', lip: '#c05d5c' },
      { hi: '#d2a077', mid: '#a96f4d', lo: '#623828', sh: '#381d19', blush: '#c2634f', lip: '#9c4546' },
      { hi: '#ac7b5e', mid: '#7e503a', lo: '#412319', sh: '#25120e', blush: '#9d4b3c', lip: '#70403a' }
    ];
    const HAIR = { hi: '#fdfcfb', mid: '#dcd9d8', lo: '#aaa5a8', sh: '#6c666c' };
    const NAVY = { hi: '#4a6ec4', mid: '#233f86', lo: '#101f4d', sh: '#050c26' };
    const GOLD = { hi: '#fff3c4', mid: '#e9c05c', lo: '#9d7626', sh: '#4c360c' };
    const RIBBON = ['#b83a3a', '#2e5fb8', '#e0c04a', '#3c9a5a', '#7a3ab8', '#e8e8e8', '#d9783a'];

    function epaulette(g, P, cx, cy, ang, flip) {
      g.save(); g.translate(cx, cy); g.rotate(ang); g.scale(flip, 1);
      const eps = shape([-44, -9, -14, -13, 20, -12, 44, -8, 46, 9, 18, 13, -14, 13, -44, 10], true);
      litFill(g, eps, GOLD, { d: 4, rim: P.accent, rimA: 0.5, rimW: 3, edge: 'rgba(40,28,6,.7)', edgeW: 1.2 });
      inClip(g, eps, () => {
        g.strokeStyle = 'rgba(70,48,10,.45)'; g.lineWidth = 1;
        for (let i = -34; i < 44; i += 5) { g.beginPath(); g.moveTo(i, -13); g.lineTo(i + 3, 13); g.stroke(); }
        g.fillStyle = P.color.mid; g.fillRect(8, -13, 7, 26); g.fillRect(20, -13, 7, 26);
        g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(8, -13, 2, 26); g.fillRect(20, -13, 2, 26);
      });
      g.strokeStyle = GOLD.mid; g.lineWidth = 2.2; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { const y = -9 + i * 2.3; g.beginPath(); g.moveTo(-44, y); g.lineTo(-52 - (i % 2) * 2, y + 1.5); g.stroke(); }
      g.restore();
    }

    function mouth(g, A, T) {
      const m = A.m, sk = T.sk, sm = m.smile, as = m.asym;
      const mw = 25 + sm * 4 - A.talk * 2.5, my = 284, op = clamp(m.open * 0.35 + A.talk, 0, 1);
      const c0 = my - sm * 5.5, cl = c0 + as * 1.5, cr = c0 - as * 4.2;
      const N = 16;
      const cyAt = (u) => lerp(cl, cr, (u + 1) / 2);
      const yu = (u) => my + (cyAt(u) - my) * u * u;
      const yl = (u) => yu(u) + op * 13.5 * Math.pow(1 - u * u, 0.9);
      const thU = (u) => 7.4 * Math.pow(1 - u * u, 0.6) - 1.9 * Math.exp(-(u * u) / 0.02);
      const thL = (u) => (12 - 2.5 * Math.max(0, sm)) * Math.pow(1 - u * u, 0.7);
      blob(g, 200, my + 14 + op * 6, 34, 12, sk.sh, 0.28 + op * 0.1);
      g.save();
      if (op > 0.05) {
        g.beginPath();
        for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(200 + u * mw, yu(u)); else g.moveTo(200 + u * mw, yu(u)); }
        for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(200 + u * mw, yl(u)); }
        g.closePath();
        g.fillStyle = '#2b0d11'; g.fill();
        g.save(); g.clip();
        const th = Math.min(op * 9, 7.5);
        g.fillStyle = lg(g, 0, my - 8, 0, my + th, [0, '#e8e2d8', 1, '#fffdf6']);
        g.beginPath();
        for (let i = 2; i <= N - 2; i++) { const u = -1 + i * 2 / N; if (i > 2) g.lineTo(200 + u * mw, yu(u) + th * Math.pow(1 - u * u, 0.4)); else g.moveTo(200 + u * mw, yu(u) + th * Math.pow(1 - u * u, 0.4)); }
        for (let i = N - 2; i >= 2; i--) { const u = -1 + i * 2 / N; g.lineTo(200 + u * mw, yu(u) - 2); }
        g.closePath(); g.fill();
        blob(g, 200, my + op * 11, 15, 5 + op * 3, '#c4565f', 0.8);
        g.restore();
      }
      const lipU = mixc(sk.lip, sk.sh, 0.3), lipL = sk.lip;
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N, x = 200 + u * mw; if (i) g.lineTo(x, yu(u) - thU(u)); else g.moveTo(x, yu(u) - thU(u)); }
      for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(200 + u * mw, yu(u)); }
      g.closePath();
      g.fillStyle = lg(g, 0, my - 10, 0, my + 1, [0, mixc(lipU, '#ffffff', 0.08), 1, dark(lipU, 0.12)]); g.fill();
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N, x = 200 + u * mw; if (i) g.lineTo(x, yl(u)); else g.moveTo(x, yl(u)); }
      for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(200 + u * mw, yl(u) + thL(u)); }
      g.closePath();
      g.fillStyle = lg(g, 0, my, 0, my + 12 + op * 13, [0, lipL, 0.55, lite(lipL, 0.1), 1, dark(lipL, 0.18)]); g.fill();
      blob(g, 195, yl(-0.05) + 4.5, 9, 3, '#ffffff', 0.38);
      g.strokeStyle = 'rgba(40,12,16,.62)'; g.lineWidth = 1.3; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(200 + u * mw, yu(u)); else g.moveTo(200 + u * mw, yu(u)); }
      g.stroke();
      if (op > 0.05) {
        g.beginPath();
        for (let i = 1; i < N; i++) { const u = -1 + i * 2 / N; if (i > 1) g.lineTo(200 + u * mw, yl(u)); else g.moveTo(200 + u * mw, yl(u)); }
        g.stroke();
      }
      g.fillStyle = 'rgba(40,12,16,.5)';
      g.beginPath(); g.arc(200 - mw, cl, 1.7, 0, TAU); g.arc(200 + mw, cr, 1.7, 0, TAU); g.fill();
      g.restore();
      // cheek bulge + folds follow the smile
      const sa = Math.max(0, sm), fa = Math.max(0, -sm);
      if (sa > 0.02) { blob(g, 200 - mw - 12, my - 16, 12, 10, sk.hi, 0.35 * sa); blob(g, 200 + mw + 12, my - 16, 12, 10, sk.hi, 0.3 * sa); }
      g.strokeStyle = rgba(sk.sh, 0.2 + 0.32 * sa); g.lineWidth = 1.7; g.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath(); g.moveTo(200 + s * 19, 258); g.quadraticCurveTo(200 + s * (mw + 9 + sa * 3), 270, 200 + s * (mw + 6 + sa * 3), my - 3 - sm * 4); g.stroke();
      }
      if (fa > 0.02) {
        g.strokeStyle = rgba(sk.sh, 0.3 * fa);
        for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.moveTo(200 + s * (mw + 2), cl + 2); g.quadraticCurveTo(200 + s * (mw + 5), cl + 12, 200 + s * (mw + 2), cl + 24); g.stroke(); }
      }
    }

    return {
      accent: '#6fb4ff', bg: '#2a469e', defColor: '#b83a3a', pivot: [200, 338], badge: [200, 208, 138],
      traits: function (P) {
        const v = P.variant, sk = SKIN[v % 4], col = ['#5f8fd0', '#6f9a58', '#7b5233', '#7f8ba0'][(v >> 1) % 4];
        return {
          sk: sk, hairStyle: v % 3, beard: [0, 1, 0, 2, 0, 1][v % 6], scar: v % 5 === 2 ? 1 : 0, medals: 3 + (v % 3),
          brow: { y: 184, dy: 3, xi: 17, xo: 70, arch: 8, w0: 10, w1: 4.4, kb: 8.5, kr: 8, hi: '#c8c4cc', mid: '#8e8a94', lo: '#4c4854', sl: 'rgba(246,242,246,.34)', sd: 'rgba(48,44,56,.4)', n: 30 },
          eye: { w: 21.5, h: 12, lowR: 0.5, sc0: '#eee6de', sc1: '#c4b3ac', ir: 11, pr: 0.42, pc: '#0a0910', i0: lite(col, 0.4), i1: col, i2: dark(col, 0.6),
            lash: '#2a1a1c', lashW: 2.2, wing: 1.6, crease: 0.6, creaseCol: sk.sh, lowerLine: 0.3, water: true, pupil: 'round' }
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const torso = shape([168, 348, 120, 358, 68, 376, 26, 404, -16, 440, -16, 516, 416, 516, 416, 440, 374, 404, 332, 376, 280, 358, 232, 348, 200, 358], true, [5, 6]);
        litFill(g, torso, NAVY, { rim: lite(acc, 0.1), rimW: 12, rimA: 0.8, d: 15 });
        inClip(g, torso, () => {
          blob(g, 112, 398, 74, 24, NAVY.hi, 0.5, -0.32);
          blob(g, 326, 436, 70, 52, NAVY.sh, 0.5);
          blob(g, 70, 450, 50, 60, NAVY.sh, 0.3);
          // soft cloth folds
          g.lineCap = 'round';
          for (let i = 0; i < 7; i++) {
            const x = 40 + R() * 320, y = 410 + R() * 90, L = 26 + R() * 40;
            g.strokeStyle = 'rgba(5,10,38,' + (0.2 + R() * 0.15) + ')'; g.lineWidth = 3 + R() * 4;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + L * 0.5, x + (R() - 0.5) * 20, y + L); g.stroke();
            g.strokeStyle = 'rgba(120,150,230,' + (0.07 + R() * 0.08) + ')'; g.lineWidth = 2;
            g.beginPath(); g.moveTo(x - 4, y); g.quadraticCurveTo(x + 4, y + L * 0.5, x + (R() - 0.5) * 20 - 4, y + L); g.stroke();
          }
          // sash
          const sash = pshape([112, 382, 136, 342, 372, 494, 349, 531]);
          litFill(g, sash, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 7, rim: lite(acc, 0.2), rimW: 6, rimA: 0.55 });
          inClip(g, sash, () => {
            g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 1;
            for (let i = -20; i < 300; i += 6) { g.beginPath(); g.moveTo(112 + i * 0.844 + 12, 382 + i * 0.536 - 20); g.lineTo(112 + i * 0.844 - 10, 382 + i * 0.536 + 20); g.stroke(); }
            blob(g, 150, 400, 60, 14, C.hi, 0.4, 0.55);
          });
          g.lineCap = 'round';
          g.strokeStyle = GOLD.mid; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(112, 382); g.lineTo(349, 531); g.stroke();
          g.beginPath(); g.moveTo(136, 342); g.lineTo(372, 494); g.stroke();
          g.strokeStyle = 'rgba(255,248,200,.5)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(113, 380); g.lineTo(349, 528); g.stroke();
          // centre seam + buttons
          g.strokeStyle = 'rgba(3,8,30,.75)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(200, 380); g.lineTo(200, 520); g.stroke();
          g.strokeStyle = 'rgba(120,150,230,.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(198.6, 380); g.lineTo(198.6, 520); g.stroke();
          for (let i = 0; i < 3; i++) {
            const by = 408 + i * 42; const b = eshape(200, by, 5.2, 5.2);
            litFill(g, b, GOLD, { d: 2, shade: 0.5, edge: 'rgba(60,40,6,.8)', edgeW: 1 });
          }
          // medals (right chest)
          const nm = T.medals;
          for (let i = 0; i < nm * 3; i++) {
            const cx = 246 + (i % 3) * 17, cy = 398 + Math.floor(i / 3) * 9, c1 = RIBBON[(i * 3 + 1) % 7], c2 = RIBBON[(i * 5 + 2) % 7];
            g.fillStyle = '#101428'; g.fillRect(cx - 1, cy - 1, 17, 9);
            g.fillStyle = c1; g.fillRect(cx, cy, 15, 7);
            g.fillStyle = c2; g.fillRect(cx + 5, cy, 5, 7);
            g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(cx, cy, 15, 2);
          }
          g.fillStyle = '#c9a050'; g.fillRect(272, 424 + (nm - 3) * 9, 6, 10);
          const star = []; for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 6 : 13; star.push(275 + cos(a) * r, 450 + (nm - 3) * 9 + sin(a) * r); }
          litFill(g, pshape(star), GOLD, { d: 2.5, edge: 'rgba(60,40,6,.8)', edgeW: 1 });
          g.fillStyle = C.mid; g.beginPath(); g.arc(275, 450 + (nm - 3) * 9, 3.4, 0, TAU); g.fill();
        });
        epaulette(g, P, 96, 372, -0.34, 1);
        epaulette(g, P, 304, 372, 0.34, -1);
        // aiguillette cords
        g.save(); g.lineCap = 'round';
        for (let k = 0; k < 2; k++) {
          g.strokeStyle = k ? GOLD.hi : GOLD.lo; g.lineWidth = k ? 1.6 : 3.6;
          g.beginPath(); g.moveTo(112, 384); g.bezierCurveTo(106, 428, 140, 452, 164, 436); g.bezierCurveTo(176, 428, 168, 410, 154, 416); g.stroke();
          g.beginPath(); g.moveTo(120, 380); g.bezierCurveTo(124, 420, 152, 440, 172, 452); g.stroke();
        }
        g.fillStyle = GOLD.mid; g.fillRect(168, 448, 6, 12); g.fillStyle = GOLD.lo; g.fillRect(172, 448, 2, 12);
        g.restore();
      },

      collar: function (g, P, T) {
        const acc = P.accent, C = P.color;
        blob(g, 200, 352, 70, 24, '#02061a', 0.35);
        const half = [[148, 322, 168, 329, 188, 340, 200, 347, 200, 398, 168, 404, 134, 390, 124, 362]];
        for (let s = 0; s < 2; s++) {
          const pts = s ? mirror(half[0]) : half[0];
          const pan = pshape(pts);
          litFill(g, pan, NAVY, { d: 8, rim: lite(acc, 0.15), rimW: 8, rimA: s ? 0.85 : 0.4, edge: 'rgba(3,8,30,.9)', edgeW: 1.4 });
          inClip(g, pan, () => {
            blob(g, s ? 236 : 164, 350, 24, 18, NAVY.hi, 0.35);
            blob(g, 200, 380, 8, 40, '#000', 0.3);
          });
          // gold piping on the top edge and the front edge
          g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
          g.strokeStyle = GOLD.lo; g.lineWidth = 3.4;
          g.beginPath(); g.moveTo(pts[0], pts[1]); g.lineTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.lineTo(pts[6], pts[7]); g.stroke();
          g.strokeStyle = GOLD.hi; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(pts[0], pts[1] - 0.6); g.lineTo(pts[2], pts[3] - 0.6); g.lineTo(pts[4], pts[5] - 0.6); g.lineTo(pts[6], pts[7] - 0.6); g.stroke();
          // rank insignia: banner coloured pips on gold bars
          const cx = s ? 238 : 162, cy = 362;
          for (let i = 0; i < 2; i++) {
            const gem = eshape(cx + (s ? -1 : 1) * (i * 11 - 5), cy + 6 - i * 0, 4.4, 4.4);
            litFill(g, gem, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, edge: GOLD.mid, edgeW: 1.6, shade: 0.5 });
          }
          g.restore();
        }
        g.strokeStyle = 'rgba(2,6,24,.85)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(200, 347); g.lineTo(200, 398); g.stroke();
        const hook = eshape(200, 372, 3.3, 3.3); litFill(g, hook, GOLD, { d: 1.5, shade: 0.5 });
      },

      head: function (g, P, T) {
        const sk = T.sk, acc = P.accent, R = P.rng('head');
        const skinPal = { hi: sk.hi, mid: sk.mid, lo: sk.lo, sh: sk.sh };
        const neck = shape([167, 280, 162, 330, 158, 384, 242, 384, 238, 330, 233, 280], true, [2, 3]);
        litFill(g, neck, { hi: sk.mid, mid: sk.lo, lo: mixc(sk.lo, sk.sh, 0.5), sh: sk.sh }, { rim: acc, rimA: 0.5, rimW: 7, spec: 0 });
        inClip(g, neck, () => {
          blob(g, 200, 322, 82, 30, sk.sh, 0.8);
          g.strokeStyle = rgba(sk.sh, 0.35); g.lineWidth = 3.2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(180, 334); g.quadraticCurveTo(190, 356, 196, 384); g.stroke();
          g.beginPath(); g.moveTo(220, 334); g.quadraticCurveTo(210, 356, 204, 384); g.stroke();
          blob(g, 200, 360, 10, 22, sk.sh, 0.28);
        });
        const earL = [127, 196, 116, 199, 110, 214, 113, 233, 123, 247, 135, 241, 136, 208];
        for (let s = 0; s < 2; s++) {
          const ear = shape(s ? mirror(earL) : earL, true);
          litFill(g, ear, { hi: sk.mid, mid: sk.lo, lo: mixc(sk.lo, sk.sh, 0.4), sh: sk.sh }, { d: 4, rim: s ? acc : null, rimA: 0.6, rimW: 3 });
          inClip(g, ear, () => { blob(g, s ? 280 : 120, 218, 5, 13, sk.sh, 0.6); });
        }
        const hd = shape(symPts([200, 92, 235, 95, 263, 113, 277, 145, 281, 184, 279, 222, 270, 255, 253, 286, 229, 309, 200, 318]), true);
        litFill(g, hd, skinPal, { rim: acc, rimW: 12, rimA: 0.78, d: 13 });
        inClip(g, hd, () => {
          const cool = mixc(sk.sh, '#5a2a50', 0.2), sock = mixc(sk.lo, '#4a2a50', 0.32);
          // key-light side (left) / core shadow side (right)
          softPoly(g, [126, 160, 150, 118, 196, 100, 200, 136, 156, 170, 142, 214, 136, 250, 124, 226], '#fff6e6', 0.34, 14);
          softPoly(g, [236, 108, 296, 118, 298, 274, 262, 312, 232, 318, 244, 266, 241, 204, 240, 150], cool, 0.46, 15);
          softPoly(g, [250, 120, 290, 130, 292, 200, 268, 196], cool, 0.2, 10);
          softPoly(g, [146, 138, 176, 140, 196, 148, 226, 134, 252, 128, 266, 140, 232, 144, 196, 158, 164, 150], sk.sh, 0.3, 5);
          // cheeks
          blob(g, 146, 242, 30, 22, sk.hi, 0.36);
          softPoly(g, [232, 238, 266, 232, 272, 266, 248, 278], cool, 0.3, 8);
          softPoly(g, [130, 254, 152, 248, 158, 272, 140, 278], sk.sh, 0.16, 8);
          // eye sockets + brow shadow
          softPoly(g, [130, 198, 160, 184, 188, 194, 190, 216, 160, 228, 132, 216], sock, 0.34, 7);
          softPoly(g, [212, 194, 240, 184, 270, 198, 268, 216, 240, 228, 210, 216], sock, 0.42, 7);
          softPoly(g, [134, 184, 190, 176, 192, 190, 136, 198], sk.sh, 0.3, 5);
          softPoly(g, [210, 176, 266, 184, 266, 198, 208, 190], sk.sh, 0.36, 5);
          // nose
          softPoly(g, [193, 194, 199, 196, 200, 238, 197, 254, 192, 244, 191, 214], '#fff6e8', 0.45, 3);
          softPoly(g, [203, 194, 210, 203, 216, 232, 226, 253, 217, 260, 207, 249, 204, 226], cool, 0.4, 4);
          softPoly(g, [186, 214, 190, 214, 191, 244, 182, 257, 179, 244], sk.sh, 0.2, 3);
          softPoly(g, [177, 250, 186, 243, 193, 256, 188, 267, 179, 263], sk.sh, 0.42, 2.4);
          softPoly(g, [223, 250, 214, 243, 207, 256, 212, 267, 221, 263], cool, 0.42, 2.6);
          softPoly(g, [189, 267, 211, 267, 208, 276, 192, 276], sk.sh, 0.55, 2.6);
          blob(g, 200, 258, 13, 9, sk.blush, 0.2);
          blob(g, 198, 252, 7, 5, '#ffffff', 0.45);
          g.fillStyle = 'rgba(48,16,18,.5)';
          g.beginPath(); g.ellipse(191.5, 264.5, 4.2, 2, -0.25, 0, TAU); g.ellipse(208.5, 264.5, 4.2, 2, 0.25, 0, TAU); g.fill();
          // mouth surroundings, chin, jaw
          softPoly(g, [186, 274, 214, 274, 211, 282, 189, 282], sk.sh, 0.22, 3);
          softPoly(g, [182, 301, 218, 301, 213, 311, 187, 311], sk.sh, 0.36, 4);
          blob(g, 194, 309, 15, 8, sk.hi, 0.3);
          softPoly(g, [264, 262, 254, 298, 230, 316, 206, 320, 234, 296, 250, 268], cool, 0.3, 6);
          blob(g, 200, 316, 40, 8, sk.sh, 0.5);
          // age lines (soft)
          g.lineCap = 'round';
          g.strokeStyle = rgba(sk.sh, 0.2); g.lineWidth = 1.8;
          for (let i = 0; i < 3; i++) { const y = 126 + i * 12; g.beginPath(); g.moveTo(150 + i * 3, y + 3); g.bezierCurveTo(176, y - 3, 200, y + 3, 226, y - 2); g.quadraticCurveTo(240, y - 4, 250 - i * 3, y + 3); g.stroke(); }
          g.strokeStyle = rgba(sk.sh, 0.27); g.lineWidth = 1.9;
          g.beginPath(); g.moveTo(192, 178); g.quadraticCurveTo(190, 186, 192, 193); g.moveTo(208, 178); g.quadraticCurveTo(210, 186, 208, 193); g.stroke();
          for (let s = -1; s <= 1; s += 2) {
            g.strokeStyle = rgba(sk.sh, 0.19);
            for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(200 + s * 60, 205 + (i - 1) * 3); g.lineTo(200 + s * 73, 198 + i * 9); g.stroke(); }
            g.strokeStyle = rgba(sk.sh, 0.22);
            g.beginPath(); g.moveTo(200 + s * 58, 220); g.quadraticCurveTo(200 + s * 40, 229, 200 + s * 22, 223); g.stroke();
            g.strokeStyle = rgba(sk.sh, 0.3);
            g.beginPath(); g.moveTo(200 + s * 28, 300); g.quadraticCurveTo(200 + s * 33, 307, 200 + s * 39, 318); g.stroke();
          }
          blob(g, 140, 242, 18, 12, sk.blush, 0.16); blob(g, 262, 242, 18, 12, sk.blush, 0.14);
        });
        // hair
        const hs = T.hairStyle;
        const hair = shape(hs === 1
          ? [118, 208, 110, 170, 118, 128, 146, 96, 184, 80, 226, 78, 262, 90, 286, 116, 292, 156, 289, 200, 284, 210, 278, 196, 278, 166, 266, 140, 244, 126, 218, 124, 190, 128, 162, 130, 142, 140, 132, 162, 128, 188, 124, 208]
          : hs === 2
            ? [114, 214, 106, 172, 114, 130, 142, 98, 184, 82, 226, 80, 262, 92, 288, 118, 294, 158, 291, 204, 286, 214, 280, 198, 280, 164, 268, 136, 246, 118, 220, 112, 192, 112, 166, 116, 144, 128, 132, 152, 128, 184, 124, 210]
            : [112, 214, 104, 170, 112, 126, 140, 90, 182, 70, 228, 68, 266, 82, 292, 112, 298, 156, 294, 204, 288, 214, 282, 198, 282, 168, 270, 140, 250, 124, 224, 122, 196, 136, 170, 126, 146, 136, 132, 160, 128, 186, 124, 210], true);
        fillBase(g, hair, HAIR);
        const hflow = (x, y) => (y > 168 ? PI / 2 + clamp((196 - x) / 90, -1, 1) * -0.45 : -PI / 2 + clamp((x - 178) / 100, -1.1, 1.1) * 0.95);
        const RL = P.rng('locks');
        g.save(); g.clip(hair.path);
        for (let i = 0; i < 70; i++) {          // soft clumps: shadow underneath, lit crown on top
          const x = 108 + RL() * 190, y = 70 + RL() * 150, a = hflow(x, y) + (RL() - 0.5) * 0.2, L = 34 + RL() * 40, w = 10 + RL() * 12;
          const nx = -sin(a), ny = cos(a);
          blob(g, x + nx * 5, y + ny * 5, L * 0.5, w * 0.5, '#5e5a60', 0.3, a);
          blob(g, x - nx * 2, y - ny * 2, L * 0.46, w * 0.34, '#ffffff', 0.5, a);
        }
        strokes(g, hair, 1200, { cols: ['#ffffff', '#ffffff', '#f4f2f2', '#e2dfdf', '#cac6c8', '#a8a4a8', '#8a868a'], len: [18, 44], w: [0.6, 1.3], a: [0.18, 0.55], flow: (x, y, Rr) => hflow(x, y) + (Rr() - 0.5) * 0.14, curve: 0.5, jit: 0.1 }, R);
        g.lineCap = 'round';
        for (let i = 0; i < 26; i++) {          // gaps between locks
          const x = 112 + RL() * 180, y = 76 + RL() * 130, a = hflow(x, y), L = 30 + RL() * 40, cu = (RL() - 0.5) * 14;
          g.strokeStyle = 'rgba(96,90,98,' + (0.25 + RL() * 0.25) + ')'; g.lineWidth = 0.9 + RL() * 0.9;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + cos(a) * L * 0.5 - sin(a) * cu, y + sin(a) * L * 0.5 + cos(a) * cu, x + cos(a) * L, y + sin(a) * L); g.stroke();
        }
        g.restore();
        lightPass(g, hair, HAIR, { d: 10, shade: 0.5, spec: 0.3, rim: lite(acc, 0.35), rimW: 7, rimA: 0.75 });
        inClip(g, hair, () => {
          softPoly(g, [136, 112, 168, 92, 214, 86, 190, 100, 160, 118], '#ffffff', 0.55, 5);
          blob(g, 200, 126, 62, 12, '#000', 0.18);
        });
        edgeFur(g, hair, 110, { len: [4, 10], w: [0.7, 1.3], a: [0.3, 0.7], cols: ['#ffffff', '#f0eeee', '#d6d2d4', '#aaa6aa'], inset: 3, grav: 0.1, curve: 0.5, jit: 0.9, only: (nx, ny, x, y) => ny < 0.55 && y < 200 }, R);
      },

      fore: function (g, P, T) {
        const sk = T.sk, R = P.rng('fore');
        if (T.beard >= 1) {
          const mus = shape(symPts([200, 264, 216, 263, 231, 270, 242, 285, 232, 284, 217, 277, 200, 273]), true);
          litFill(g, mus, { hi: HAIR.hi, mid: HAIR.mid, lo: HAIR.lo, sh: HAIR.sh }, { d: 3, rim: P.accent, rimA: 0.5, rimW: 3, edge: 'rgba(70,76,100,.5)', edgeW: 0.8 });
          strokes(g, mus, 140, { cols: ['#ffffff', '#c9cdda', '#9aa0b8'], len: [5, 11], w: [0.7, 1.3], a: [0.4, 0.8], flow: (x) => (x < 200 ? 2.6 : 0.5), jit: 0.4 }, R);
        }
        if (T.beard === 2) {
          const gt = shape(symPts([200, 300, 216, 299, 232, 296, 238, 312, 226, 332, 200, 342]), true);
          litFill(g, gt, { hi: HAIR.hi, mid: HAIR.mid, lo: HAIR.lo, sh: HAIR.sh }, { d: 4, rim: P.accent, rimA: 0.5, rimW: 4, edge: 'rgba(70,76,100,.5)', edgeW: 0.8 });
          strokes(g, gt, 260, { cols: ['#ffffff', '#c9cdda', '#9aa0b8'], len: [6, 13], w: [0.7, 1.4], a: [0.4, 0.8], ang: PI / 2, jit: 0.7 }, R);
        }
        if (T.scar) {
          g.save(); g.lineCap = 'round';
          g.strokeStyle = 'rgba(70,20,20,.35)'; g.lineWidth = 3.4;
          g.beginPath(); g.moveTo(134, 218); g.quadraticCurveTo(144, 238, 152, 262); g.stroke();
          g.strokeStyle = 'rgba(244,196,186,.7)'; g.lineWidth = 1.7;
          g.beginPath(); g.moveTo(134, 218); g.quadraticCurveTo(144, 238, 152, 262); g.stroke();
          g.strokeStyle = 'rgba(120,50,50,.5)'; g.lineWidth = 0.8;
          for (let i = 0; i < 4; i++) { const t = 0.15 + i * 0.22, x = 134 + 18 * t + 4 * t, y = 218 + 44 * t; g.beginPath(); g.moveTo(x - 3, y - 1.5); g.lineTo(x + 3, y + 1.5); g.stroke(); }
          g.restore();
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, e = T.eye;
        const open = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.1, 0, 1.2);
        const st = { dir: 1, ti: m.brow * 2.4, to: -m.brow * 0.8, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        drawEye(g, 160, 206, e, st);
        st.dir = -1; drawEye(g, 240, 206, e, st);
        // dynamic wrinkles
        const ba = Math.max(0, m.brow), wa = Math.max(0, -m.brow) * 0.6 + Math.max(0, m.browY) * 0.5;
        g.save(); g.lineCap = 'round';
        if (ba > 0.02) { g.strokeStyle = rgba(T.sk.sh, 0.4 * ba); g.lineWidth = 2; g.beginPath(); g.moveTo(193, 175); g.quadraticCurveTo(190, 185, 192, 194); g.moveTo(207, 175); g.quadraticCurveTo(210, 185, 208, 194); g.stroke(); }
        if (wa > 0.02) {
          g.strokeStyle = rgba(T.sk.sh, 0.26 * Math.min(1, wa)); g.lineWidth = 1.8;
          for (let i = 0; i < 3; i++) { const y = 140 + i * 12 - m.browY * 4; g.beginPath(); g.moveTo(150 + i * 4, y + 2); g.quadraticCurveTo(200, y - 5, 250 - i * 4, y + 2); g.stroke(); }
        }
        if (m.lower > 0.05) {
          g.strokeStyle = rgba(T.sk.sh, 0.28 * m.lower); g.lineWidth = 1.5;
          for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(200 + s * 60, 205 + (i - 1) * 3); g.lineTo(200 + s * 74, 198 + i * 9); g.stroke(); }
        }
        g.restore();
        browRig(g, -1, A, T.brow); browRig(g, 1, A, T.brow);
        mouth(g, A, T);
      }
    };
  })();

  /* ======================================================================= ALKARI */
  PAINT.alkari = (function () {
    const CREAM = { hi: '#fffaf0', mid: '#f1e2c4', lo: '#c4a37c', sh: '#6a4228' };
    const ORANGE = { hi: '#ffb866', mid: '#ee7a26', lo: '#a8421a', sh: '#4a1a0c' };
    const GOLD = { hi: '#fff3c4', mid: '#e9bd55', lo: '#9d7022', sh: '#4c340c' };
    const BEAK = { hi: '#f8eab4', mid: '#d8b058', lo: '#7a5222', sh: '#2e1c0a' };
    const HEAD_HALF = [200, 104, 236, 108, 266, 126, 286, 156, 294, 194, 290, 234, 272, 268, 248, 298, 222, 322, 200, 332];
    const CAP = [106, 196, 104, 152, 122, 120, 160, 98, 200, 92, 240, 98, 278, 120, 296, 152, 294, 196, 278, 186, 256, 176, 234, 164, 216, 152, 200, 148, 184, 152, 166, 164, 144, 176, 122, 188];
    const MANTLE = [200, 364, 150, 368, 104, 386, 66, 418, 44, 466, 36, 520, 364, 520, 356, 466, 334, 418, 296, 386, 250, 368];
    const GAPE = 280;

    function crestFeather(g, x, y, ang, len, wid, c0, c1, c2) {
      g.save(); g.translate(x, y); g.rotate(ang - PI / 2);
      g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(wid * 0.55, len * 0.12, wid * 0.62, len * 0.6, wid * 0.16, len * 0.95);
      g.quadraticCurveTo(0, len * 1.06, -wid * 0.16, len * 0.95);
      g.bezierCurveTo(-wid * 0.62, len * 0.6, -wid * 0.55, len * 0.12, 0, 0);
      g.fillStyle = lg(g, 0, 0, 0, len, [0, c0, 0.5, c1, 0.8, c2, 1, '#2a120a']); g.fill();
      g.strokeStyle = 'rgba(40,14,6,.55)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(255,236,200,.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, len * 0.05); g.lineTo(0, len * 0.9); g.stroke();
      g.strokeStyle = 'rgba(40,14,6,.28)'; g.lineWidth = 0.8;
      for (let i = 1; i < 7; i++) { const yy = len * (0.12 + i * 0.12), ww = wid * 0.5 * (1 - Math.abs(i - 3) * 0.1); g.beginPath(); g.moveTo(-ww, yy + 5); g.lineTo(0, yy); g.lineTo(ww, yy + 5); g.stroke(); }
      g.fillStyle = lg(g, -wid * 0.6, 0, wid * 0.6, 0, [0, 'rgba(255,255,255,.22)', 0.5, 'rgba(255,255,255,0)', 1, 'rgba(0,0,0,.28)']);
      g.fill();
      g.restore();
    }
    function browRidge(g, side, A, T) {
      const m = A.m, as = m.bAsym * (side < 0 ? -9 : 3);
      const xi = 200 + side * 36, xo = 200 + side * 88;
      const yi = 200 + m.brow * 11 - m.browY * 8 + as, yo = 170 - m.brow * 4 - m.browY * 6 + as * 0.6;
      const cx = (xi + xo) / 2 + side * 3, cy = (yi + yo) / 2 - 8;
      g.save();
      g.beginPath(); taper(g, xi, yi + 6, cx, cy + 7, xo, yo + 9, 14, 7, 8);
      g.fillStyle = 'rgba(40,14,6,.45)'; g.shadowColor = 'rgba(40,14,6,.6)'; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0;
      g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, 25, 10, 9);
      g.fillStyle = lg(g, 0, cy - 12, 0, cy + 10, [0, lite(T.crown, 0.3), 0.5, T.crown, 1, dark(T.crown, 0.5)]); g.fill();
      g.clip();
      g.lineCap = 'round';
      for (let i = 0; i < 22; i++) {
        const t = (i + hash2(i, 5) * 0.7) / 22, u = 1 - t, x = u * u * xi + 2 * u * t * cx + t * t * xo, y = u * u * yi + 2 * u * t * cy + t * t * yo;
        const tx = 2 * u * (cx - xi) + 2 * t * (xo - cx), ty = 2 * u * (cy - yi) + 2 * t * (yo - cy), a = atan2(ty, tx);
        g.strokeStyle = hash2(i, 9) > 0.5 ? 'rgba(255,225,170,.5)' : 'rgba(90,30,10,.5)'; g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(x, y - 6 + hash2(i, 2) * 8); g.lineTo(x + cos(a) * 7, y + sin(a) * 7 - 3 + hash2(i, 2) * 8); g.stroke();
      }
      g.strokeStyle = 'rgba(255,240,210,.55)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(xi, yi - 8); g.quadraticCurveTo(cx, cy - 9, xo, yo - 4); g.stroke();
      g.restore();
    }
    function lowerBeak(g, P, open) {
      const drop = open * 24, y0 = GAPE;
      if (open > 0.04) {
        g.save();
        g.beginPath(); g.moveTo(170, y0 - 3); g.lineTo(230, y0 - 3); g.lineTo(220, y0 + drop + 14); g.lineTo(180, y0 + drop + 14); g.closePath();
        g.fillStyle = lg(g, 0, y0, 0, y0 + drop + 14, [0, '#1a0608', 0.7, '#4a1418', 1, '#6a2024']); g.fill();
        g.clip();
        blob(g, 200, y0 + drop * 0.7 + 6, 15, 7 + open * 4, '#d8606c', 0.9);
        g.restore();
      }
      const L = P.layers.aux;
      if (L) { g.save(); g.translate(0, drop); blit(g, L); g.restore(); }
    }

    return {
      accent: '#ffa94d', bg: '#6a3a22', defColor: '#2f6fd0', pivot: [200, 352], badge: [200, 218, 150],
      traits: function (P) {
        const v = P.variant, crown = ['#ee7a26', '#e4572a', '#f0a22e'][v % 3], ec = ['#f2a81c', '#ffd24a', '#e8602a', '#9ccf3a'][(v >> 1) % 4];
        const R = P.rng('crest'), cl = [];
        for (let i = 0; i < 11; i++) cl.push(R());
        return {
          crown: crown, notch: v % 4 === 1, bars: v % 2, cl: cl,
          eye: { w: 23.5, h: 13.5, lowR: 0.8, sc0: dark(ec, 0.3), sc1: dark(ec, 0.55), ir: 14.5, pr: 0.46, pc: '#0a0606', i0: lite(ec, 0.45), i1: ec, i2: dark(ec, 0.55),
            lash: '#3a1c0c', lashW: 2.4, wing: 0, crease: 0, creaseCol: '#000', lowerLine: 0.2, pupil: 'round', fib: 1.2 }
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const cape = shape([36, 384, 120, 364, 200, 360, 280, 364, 364, 384, 412, 430, 424, 520, -24, 520, -12, 430], true);
        litFill(g, cape, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { rim: lite(acc, 0.1), rimW: 12, rimA: 0.7, d: 14 });
        inClip(g, cape, () => {
          g.lineCap = 'round';
          for (let i = 0; i < 9; i++) {
            const x = R() * 60 + (i < 5 ? -10 : 350), y = 400 + R() * 40, L = 70 + R() * 50;
            g.strokeStyle = 'rgba(0,0,0,' + (0.18 + R() * 0.15) + ')'; g.lineWidth = 5 + R() * 6;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 20, y + L * 0.5, x + (R() - 0.5) * 24, y + L); g.stroke();
          }
        });
        g.strokeStyle = GOLD.mid; g.lineWidth = 3; g.stroke(cape.path);
        const mantle = shape(MANTLE, true);
        fillBase(g, mantle, CREAM);
        g.save(); g.clip(mantle.path);
        for (let row = 0, y = 534; y > 346; y -= 12.5, row++) {
          for (let x = 8 + (row % 2) * 12; x < 396; x += 24) {
            const jx = x + (R() - 0.5) * 5, jy = y + (R() - 0.5) * 3, tt = clamp((abs(jx - 200) - 40) / 120, 0, 1) + (jy - 360) / 520 * 0.35;
            const orange = R() < sstep(tt * 1.15);
            const c0 = orange ? lite(ORANGE.mid, 0.12 + R() * 0.2) : '#fffaf0', c1 = orange ? mixc(ORANGE.mid, ORANGE.lo, R() * 0.7) : mixc('#f1e2c4', '#c9a97c', R() * 0.6);
            feather(g, jx, jy, (jx - 200) * 0.0021 + (R() - 0.5) * 0.18, 34 + R() * 6, 26 + R() * 4, c0, c1, orange ? 'rgba(70,24,8,.45)' : 'rgba(110,70,40,.4)', 'rgba(255,255,255,.18)');
            if (orange && R() < 0.4) { g.strokeStyle = 'rgba(60,20,8,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(jx - 6, jy + 18); g.lineTo(jx + 6, jy + 18); g.stroke(); }
          }
        }
        g.restore();
        lightPass(g, mantle, { hi: '#fff', mid: '#ddd', lo: '#a98', sh: '#3a1608' }, { rim: lite(acc, 0.05), rimW: 12, rimA: 0.8, d: 16, shade: 0.55, spec: 0.28 });
        const strap = pshape([113, 396, 123, 376, 377, 502, 367, 522]);
        litFill(g, strap, { hi: '#6a4630', mid: '#43281a', lo: '#24140c', sh: '#0c0604' }, { d: 4, edge: 'rgba(0,0,0,.7)', edgeW: 1.2 });
        const stripe = pshape([118, 391, 122, 383, 372, 507, 368, 515]);
        litFill(g, stripe, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, shade: 0.4, spec: 0.3 });
        for (let i = 0; i < 5; i++) { const t = 0.12 + i * 0.19, x = 118 + (372 - 118) * t, y = 386 + (512 - 386) * t; litFill(g, eshape(x, y, 4, 4), GOLD, { d: 1.5, edge: 'rgba(60,40,6,.8)', edgeW: 0.8 }); }
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        softPoly(g, [90, 342, 200, 410, 310, 342, 300, 372, 200, 424, 100, 372], '#1a0a04', 0.5, 9);
        const outer = [96, 338, 120, 372, 160, 396, 200, 404, 240, 396, 280, 372, 304, 338];
        const inner = [270, 334, 246, 360, 220, 372, 200, 376, 180, 372, 154, 360, 130, 334];
        const gp = shape(outer.concat(inner), true, [0, 6, 7, 13]);
        litFill(g, gp, GOLD, { d: 6, rim: lite(acc, 0.3), rimW: 7, rimA: 0.9, edge: 'rgba(60,36,6,.9)', edgeW: 1.6 });
        inClip(g, gp, () => {
          g.strokeStyle = 'rgba(80,50,8,.55)'; g.lineWidth = 1.2;
          g.beginPath(); trace(g, [110, 346, 134, 372, 168, 390, 200, 396, 232, 390, 266, 372, 290, 346], false); g.stroke();
          for (let i = 0; i < 9; i++) {
            const t = i / 8, a = lerp(0.12, PI - 0.12, t), x = 200 - cos(a) * 82, y = 346 + sin(a) * 38;
            g.fillStyle = 'rgba(90,60,10,.55)'; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 5, y); g.lineTo(x, y + 5); g.lineTo(x - 5, y); g.closePath(); g.fill();
          }
        });
        for (let i = 0; i < 7; i++) {
          const a = lerp(0.35, PI - 0.35, i / 6), x = 200 - cos(a) * 86, y = 344 + sin(a) * 52;
          if (i === 3) continue;
          litFill(g, shape([x - 6, y, x + 6, y, x, y + 14], true, [0, 1, 2]), GOLD, { d: 2, edge: 'rgba(60,36,6,.8)', edgeW: 1 });
        }
        litFill(g, eshape(200, 392, 12, 12), GOLD, { d: 3, edge: 'rgba(60,36,6,.9)', edgeW: 1.4 });
        litFill(g, eshape(200, 392, 8, 8), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 3, spec: 0.6 });
        blob(g, 197, 389, 3.5, 2.5, '#fff', 0.7);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head'), crown = T.crown;
        // thick neck of soft feathers
        const neck = shape([134, 290, 122, 330, 122, 352, 150, 384, 200, 394, 250, 384, 278, 352, 278, 330, 266, 290], true);
        fillBase(g, neck, { hi: CREAM.mid, mid: CREAM.lo, lo: dark(CREAM.lo, 0.35) });
        g.save(); g.clip(neck.path);
        for (let row = 0, y = 424; y > 280; y -= 10, row++) for (let x = 102 + (row % 2) * 8; x < 300; x += 15) {
          feather(g, x + (R() - 0.5) * 3, y, (x - 200) * 0.006, 20, 15, '#fffaf0', mixc('#efdcb8', '#bfa07a', R() * 0.5), 'rgba(110,70,40,.3)');
        }
        g.restore();
        lightPass(g, neck, { hi: '#fff', mid: '#ddd', lo: '#a98', sh: '#3a1608' }, { rim: acc, rimW: 8, rimA: 0.7, shade: 0.5, spec: 0 });
        // ruff: two rows of feathers hugging the lower face and throat
        for (let row = 1; row >= 0; row--) {
          const n = row ? 17 : 15;
          for (let i = 0; i < n; i++) {
            const u = i / (n - 1), a = lerp(0.3, PI - 0.3, u), rr = row ? 82 : 66, x = 200 + cos(a) * rr, y = 254 + sin(a) * (row ? 70 : 54);
            const out = atan2(sin(a) * 66, cos(a) * 88), ang = out - PI / 2 + (R() - 0.5) * 0.16;
            const orange = (i + row + (T.bars ? 1 : 0)) % 3 === 0;
            feather(g, x, y, ang, (row ? 34 : 28) + R() * 7, 22 + R() * 4, orange ? lite(crown, 0.25) : '#fffaf0', orange ? dark(crown, 0.35) : mixc('#ead8b4', '#b8996e', R() * 0.5), 'rgba(80,40,16,.4)', 'rgba(255,255,255,.2)');
          }
        }
        softPoly(g, [120, 290, 280, 290, 300, 340, 200, 358, 100, 340], '#2a1006', 0.5, 9);
        // head base
        const hd = shape(symPts(HEAD_HALF), true);
        fillBase(g, hd, { hi: CREAM.hi, mid: CREAM.mid, lo: CREAM.lo });
        g.save(); g.clip(hd.path);
        const hdp = hd.pts;
        for (let row = 0, y = 340; y > 86; y -= 8.6, row++) {
          for (let x = 88 + (row % 2) * 5.5; x < 312; x += 11) {
            const jx = x + (R() - 0.5) * 3, jy = y + (R() - 0.5) * 2.5;
            if (!pip(hdp, jx, jy - 6)) continue;
            const orange = pip(CAP, jx, jy);
            let c0, c1, ln;
            if (orange) { c0 = lite(crown, 0.1 + R() * 0.3); c1 = mixc(crown, ORANGE.lo, 0.2 + R() * 0.55); ln = 'rgba(80,28,8,.3)'; }
            else { c0 = '#fffaf0'; c1 = mixc('#f1e2c4', '#cdb08a', R() * 0.55); ln = 'rgba(120,80,50,.22)'; }
            feather(g, jx, jy, (jx - 200) * 0.0042 + (R() - 0.5) * 0.2, 14 + R() * 3, 12.5 + R() * 2.5, c0, c1, ln, null);
          }
        }
        g.restore();
        for (let s = -1; s <= 1; s += 2) {
          const ex = 200 + s * 58;
          const ring = eshape(ex, 209, 32, 25, 0);
          fillBase(g, ring, { hi: '#fbe08a', mid: '#e9b848', lo: '#b87a22' });
          lightPass(g, ring, { hi: '#fbe08a', mid: '#e9b848', lo: '#b87a22', sh: '#4a2a08' }, { d: 4, rim: s > 0 ? acc : null, rimW: 4, rimA: 0.6, edge: 'rgba(60,30,8,.55)', edgeW: 1.4 });
          g.save(); g.lineCap = 'round';
          for (let i = 0; i < 22; i++) { const a = lerp(PI * 1.05, PI * 1.95, i / 21), x = ex + cos(a) * 31, y = 209 + sin(a) * 24; g.strokeStyle = 'rgba(70,32,10,.5)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + cos(a) * 5, y + sin(a) * 5); g.stroke(); }
          g.restore();
          const tp = [s < 0 ? 138 : 262, 236, s < 0 ? 150 : 250, 238, s < 0 ? 152 : 248, 266, s < 0 ? 144 : 256, 296, s < 0 ? 136 : 264, 268];
          inClip(g, hd, () => { softPoly(g, tp, '#2a1208', 0.9, 1.6); });
        }
        lightPass(g, hd, { hi: '#fff', mid: '#ddd', lo: '#a98', sh: '#4a1a08' }, { d: 13, shade: 0.5, spec: 0.28, rim: acc, rimW: 12, rimA: 0.85 });
        inClip(g, hd, () => {
          softPoly(g, [236, 108, 296, 120, 298, 270, 262, 312, 232, 334, 246, 266, 242, 204, 240, 150], '#2a0e22', 0.34, 15);
          softPoly(g, [124, 150, 150, 116, 196, 100, 200, 130, 154, 164, 140, 210, 126, 200], '#fff1d8', 0.28, 12);
        });
      },

      fore: function (g, P, T) {
        const acc = P.accent, R = P.rng('fore');
        const beak = shape(symPts([200, 192, 231, 205, 245, 230, 243, 256, 233, 278, 219, 296, 207, 312, 200, 326]), true, [7]);
        litFill(g, beak, BEAK, { d: 9, rim: lite(acc, 0.2), rimW: 7, rimA: 0.85, edge: 'rgba(46,28,8,.9)', edgeW: 1.7 });
        inClip(g, beak, () => {
          softPoly(g, [166, 214, 198, 204, 199, 312, 186, 276, 174, 244], '#fff6d0', 0.4, 4);
          softPoly(g, [203, 206, 242, 216, 246, 246, 232, 290, 208, 324], '#2a1608', 0.46, 4);
          softPoly(g, [190, 288, 210, 288, 206, 330, 194, 330], '#1a0e06', 0.7, 3);
          g.strokeStyle = 'rgba(255,240,180,.75)'; g.lineWidth = 1.9; g.lineCap = 'round';
          g.beginPath(); g.moveTo(199, 208); g.quadraticCurveTo(198, 250, 199, 290); g.stroke();
          g.strokeStyle = 'rgba(46,24,6,.6)'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(170, GAPE - 4); g.quadraticCurveTo(200, GAPE + 8, 230, GAPE - 4); g.stroke();
          for (let i = 0; i < 18; i++) { const y = 216 + i * 5.2, w = 14 + i * 0.5; g.strokeStyle = 'rgba(90,60,20,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(200 - w, y); g.lineTo(200 + w, y + 1); g.stroke(); }
          // tomial teeth
          g.fillStyle = 'rgba(30,14,4,.8)';
          for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.moveTo(200 + s * 31, GAPE - 12); g.lineTo(200 + s * 26, GAPE - 3); g.lineTo(200 + s * 35, GAPE - 4); g.closePath(); g.fill(); }
          if (T.notch) { g.fillStyle = 'rgba(30,14,4,.9)'; g.beginPath(); g.moveTo(228, 254); g.lineTo(236, 250); g.lineTo(232, 262); g.closePath(); g.fill(); }
        });
        const cere = shape(symPts([200, 177, 217, 182, 227, 194, 227, 210, 216, 219, 200, 223]), true);
        litFill(g, cere, { hi: '#ffe99a', mid: '#f0bc38', lo: '#b27a1c', sh: '#4a2a08' }, { d: 5, rim: lite(acc, 0.3), rimW: 5, rimA: 0.8, edge: 'rgba(60,34,8,.7)', edgeW: 1.3 });
        for (let s = -1; s <= 1; s += 2) {
          g.fillStyle = 'rgba(30,12,4,.85)'; g.beginPath(); g.ellipse(200 + s * 10, 205, 4.2, 2.9, s * 0.6, 0, TAU); g.fill();
          g.fillStyle = 'rgba(255,230,160,.6)'; g.beginPath(); g.ellipse(200 + s * 10 - 1, 203, 2, 1, 0, 0, TAU); g.fill();
        }
        blob(g, 193, 186, 8, 4.5, '#fff', 0.5);
        // rictal bristles
        g.save(); g.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 9; i++) {
          const x = 200 + s * (38 + R() * 8), y = 218 + i * 6 + R() * 3, a = (s > 0 ? 0.5 : PI - 0.5) + (R() - 0.5) * 0.5;
          g.strokeStyle = R() > 0.4 ? 'rgba(40,18,8,.8)' : 'rgba(255,240,220,.7)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + cos(a) * (9 + R() * 8), y + sin(a) * (9 + R() * 8)); g.stroke();
        }
        g.restore();
      },

      aux: function (g, P, T) {
        const y0 = GAPE, acc = P.accent;
        const lb = shape(symPts([200, y0 - 8, 228, y0 - 2, 228, y0 + 12, 218, y0 + 26, 207, y0 + 36, 200, y0 + 40]), true);
        litFill(g, lb, { hi: BEAK.mid, mid: BEAK.lo, lo: dark(BEAK.lo, 0.4), sh: BEAK.sh }, { d: 6, rim: lite(acc, 0.2), rimW: 5, rimA: 0.8, edge: 'rgba(40,22,8,.85)', edgeW: 1.4 });
        inClip(g, lb, () => {
          softPoly(g, [182, y0, 198, y0, 198, y0 + 34, 190, y0 + 18], BEAK.hi, 0.45, 3);
          softPoly(g, [204, y0, 230, y0 + 4, 218, y0 + 26, 204, y0 + 38], BEAK.sh, 0.4, 3);
          g.strokeStyle = 'rgba(255,236,170,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(200, y0 - 2); g.lineTo(200, y0 + 32); g.stroke();
        });
      },

      back: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph, flare = 0.65 * m.brow + 0.1 * Math.max(0, m.smile);
        const burst = Math.pow(Math.max(0, sin(t * 0.31 + ph[2])), 14), n = 11;
        for (let i = 0; i < n; i++) {
          const k = i - (n - 1) / 2, r = T.cl[i];
          const base = -PI / 2 + k * 0.19 * (1 + 0.5 * flare) + m.tilt * 0.8 + (r - 0.5) * 0.08;
          const da = sin(t * 1.6 + i * 0.8 + ph[0]) * 0.03 + sin(t * 0.7 + i * 1.3) * 0.02 + burst * sin(t * 19 + i * 2.1) * 0.07;
          const len = (112 - abs(k) * 9 - r * 14) * (1 + 0.3 * flare), a = base + da;
          crestFeather(g, 200 + k * 11, 134 - (5 - abs(k)) * 1.2, a, len, 27 - abs(k) * 1.4, lite(T.crown, 0.5), T.crown, dark(T.crown, 0.55));
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, e = T.eye;
        lowerBeak(g, P, clamp(m.open * 0.9 + A.talk, 0, 1));
        const open = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.08, 0, 1.15);
        const st = { dir: 1, ti: m.brow * 1.5, to: -m.brow * 0.6, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        drawEye(g, 144, 210, e, st);
        st.dir = -1; drawEye(g, 256, 210, e, st);
        browRidge(g, -1, A, T); browRidge(g, 1, A, T);
      },

      front: function (g, P, T, A) {
        const t = A.t, ph = A.ph;
        for (let i = 0; i < 9; i++) {
          const u = (i - 4) / 4, x = 200 + u * 56, y = 312 + abs(u) * 8;
          const sw = sin(t * 1.9 + i * 0.9 + ph[1]) * 0.08 + sin(t * 0.8 + i) * 0.04 + Math.pow(Math.max(0, sin(t * 0.31 + ph[2])), 12) * sin(t * 17 + i) * 0.05;
          feather(g, x, y, u * 0.55 + sw, 30 - abs(u) * 6, 17, i % 2 ? '#fffaf0' : lite(T.crown, 0.3), i % 2 ? '#d9c09a' : dark(T.crown, 0.3), 'rgba(70,28,8,.4)', 'rgba(255,255,255,.2)');
        }
      }
    };
  })();

  /* ======================================================================= BULRATHI */
  PAINT.bulrathi = (function () {
    const FUR = { hi: '#a47248', mid: '#6c4730', lo: '#3a2418', sh: '#160a05' };
    const FROST = { hi: '#efe6d6', mid: '#bdae98', lo: '#76695a', sh: '#2c241c' };
    const TAN = { hi: '#ead8b6', mid: '#bda37c', lo: '#7c6446', sh: '#2c2014' };
    const BRONZE = { hi: '#ffe2a2', mid: '#d09c4a', lo: '#7a4c1a', sh: '#331c08' };
    const HEAD = [200, 124, 250, 126, 290, 140, 314, 168, 324, 206, 320, 246, 302, 282, 270, 308, 236, 322, 200, 327];
    const MUZZLE = [200, 194, 234, 198, 254, 216, 262, 246, 254, 276, 232, 298, 200, 306];
    const FURCOL = ['#3a2418', '#472b1d', '#563624', '#6a4630', '#7c5538', '#8e6440'];
    const FROSTCOL = ['#a89a88', '#c4b8a4', '#ddd2bf'];
    /* overlapping fur tuft: rounded teardrop pointing along `ang`, dark root -> lighter tip */
    function tuft(g, x, y, ang, len, wid, c0, c1) {
      g.save(); g.translate(x, y); g.rotate(ang - PI / 2);
      g.beginPath(); g.moveTo(-wid * 0.5, 0);
      g.bezierCurveTo(-wid * 0.64, len * 0.35, -wid * 0.44, len * 0.8, -wid * 0.14, len * 0.96);
      g.quadraticCurveTo(0, len * 1.05, wid * 0.14, len * 0.96);
      g.bezierCurveTo(wid * 0.44, len * 0.8, wid * 0.64, len * 0.35, wid * 0.5, 0);
      g.closePath();
      g.fillStyle = lg(g, 0, 0, 0, len, [0, c0, 0.55, mixc(c0, c1, 0.6), 1, c1]); g.fill();
      g.strokeStyle = 'rgba(6,2,2,.3)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = rgba(c1, 0.35); g.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) { const o = (i - 1) * wid * 0.2; g.beginPath(); g.moveTo(o * 0.6, len * 0.12); g.quadraticCurveTo(o * 1.2, len * 0.5, o * 0.5, len * 0.9); g.stroke(); }
      g.restore();
    }
    const MANTLECOL = ['#5a4636', '#6a5644', '#7a6652', '#8a7662', '#9c8a74', '#b8a890'];
    /* soft fur cluster: a fan of round-capped curved strokes (no spikes) */
    function cluster(g, x, y, ang, len, R, cols, n, wd) {
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = ang + (R() - 0.5) * 0.7, L = len * (0.65 + R() * 0.5), bend = (R() - 0.5) * L * 0.5;
        const ex = x + cos(a) * L, ey = y + sin(a) * L;
        g.strokeStyle = cols[(R() * cols.length) | 0]; g.lineWidth = (wd || 3.4) * (0.75 + R() * 0.5);
        g.beginPath(); g.moveTo(x + (R() - 0.5) * 6, y + (R() - 0.5) * 6); g.quadraticCurveTo((x + ex) / 2 - sin(a) * bend, (y + ey) / 2 + cos(a) * bend, ex, ey); g.stroke();
      }
    }

    function mouth(g, A, T) {
      const m = A.m, sm = m.smile, as = m.asym, my = 273, mw = 44 + sm * 3 - A.talk * 3;
      const op = clamp(m.open * 0.9 + A.talk, 0, 1);
      const cl = my + 5 - sm * 7 + (sm < 0 ? -sm * 2 : 0) + as * 2, cr = my + 5 - sm * 7 - as * 6 + (sm < 0 ? -sm * 2 : 0);
      const cyAt = (u) => lerp(cl, cr, (u + 1) / 2);
      const yu = (u) => my - 2 + (cyAt(u) - my + 2) * u * u * 1.0 + 3 * (1 - u * u) * 0;
      const yl = (u) => yu(u) + op * 22 * Math.pow(1 - u * u, 0.8);
      const N = 14;
      g.save();
      if (op > 0.04) {
        g.beginPath();
        for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(200 + u * mw, yu(u)); else g.moveTo(200 + u * mw, yu(u)); }
        for (let i = N; i >= 0; i--) { const u = -1 + i * 2 / N; g.lineTo(200 + u * mw, yl(u)); }
        g.closePath(); g.fillStyle = '#1c0a0c'; g.fill(); g.save(); g.clip();
        blob(g, 200, my + op * 17, 24, 8 + op * 4, '#b8505c', 0.95);
        // teeth: upper canines + incisors, lower canines
        const ty = yu(0) - 1;
        g.fillStyle = lg(g, 0, ty, 0, ty + 14, [0, '#f6efe0', 1, '#d8c9a8']);
        const tl = 5 + op * 9;
        for (let s = -1; s <= 1; s += 2) {
          g.beginPath(); g.moveTo(200 + s * 17, ty - 1); g.lineTo(200 + s * 25, ty - 1); g.lineTo(200 + s * 21, ty + tl + 4); g.closePath(); g.fill();
        }
        g.fillStyle = '#efe6d2'; g.fillRect(200 - 12, ty - 1, 24, 3 + op * 3);
        const by = yl(0);
        g.fillStyle = '#e8dcc2';
        for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.moveTo(200 + s * 15, by + 1); g.lineTo(200 + s * 22, by + 1); g.lineTo(200 + s * 18.5, by - 3 - op * 6); g.closePath(); g.fill(); }
        g.restore();
      }
      // lips
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = '#241414'; g.lineWidth = 5.2;
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(200 + u * mw, yu(u)); else g.moveTo(200 + u * mw, yu(u)); }
      g.stroke();
      g.strokeStyle = '#4a3234'; g.lineWidth = 2.4;
      g.beginPath();
      for (let i = 0; i <= N; i++) { const u = -1 + i * 2 / N; if (i) g.lineTo(200 + u * mw, yu(u) - 0.9); else g.moveTo(200 + u * mw, yu(u) - 0.9); }
      g.stroke();
      if (op > 0.04) {
        g.strokeStyle = '#2a1818'; g.lineWidth = 4.4;
        g.beginPath();
        for (let i = 1; i < N; i++) { const u = -1 + i * 2 / N; if (i > 1) g.lineTo(200 + u * mw, yl(u)); else g.moveTo(200 + u * mw, yl(u)); }
        g.stroke();
      }
      // philtrum split + whisker dots
      g.strokeStyle = '#241414'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(200, 250); g.lineTo(200, yu(0)); g.stroke();
      g.restore();
    }

    function brow(g, side, A, T) {
      const m = A.m, as = m.bAsym * (side < 0 ? -9 : 3);
      const xi = 200 + side * 14, xo = 200 + side * 84;
      const yi = 182 + m.brow * 14 - m.browY * 7 + as, yo = 166 - m.brow * 3 - m.browY * 6 + as * 0.6;
      const cx = (xi + xo) / 2, cy = (yi + yo) / 2 - 7;
      g.save();
      g.beginPath(); taper(g, xi, yi + 8, cx, cy + 9, xo, yo + 10, 18, 10, 8);
      g.shadowColor = 'rgba(12,5,2,.85)'; g.shadowBlur = 8; g.fillStyle = 'rgba(12,5,2,.6)'; g.fill(); g.shadowBlur = 0;
      g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, 28, 15, 9);
      g.fillStyle = lg(g, 0, cy - 14, 0, cy + 10, [0, '#6a4630', 0.55, '#4a2e20', 1, '#2a180e']); g.fill();
      g.clip(); g.lineCap = 'round';
      for (let i = 0; i < 42; i++) {
        const t = (i + hash2(i, 5) * 0.8) / 42, u = 1 - t, x = u * u * xi + 2 * u * t * cx + t * t * xo, y = u * u * yi + 2 * u * t * cy + t * t * yo;
        const tx = 2 * u * (cx - xi) + 2 * t * (xo - cx), ty = 2 * u * (cy - yi) + 2 * t * (yo - cy), a = atan2(ty, tx) + (side < 0 ? 0.9 : -0.9) * (1 - t * 0.6);
        const r = hash2(i, 9);
        g.strokeStyle = r > 0.62 ? 'rgba(196,170,140,.55)' : r > 0.3 ? 'rgba(130,86,56,.6)' : 'rgba(20,10,6,.6)'; g.lineWidth = 1.3 + r * 0.8;
        const wob = (hash2(i, 12) - 0.5) * 14;
        g.beginPath(); g.moveTo(x - cos(a) * 4, y - sin(a) * 4 + wob * 0.5); g.lineTo(x + cos(a) * 9, y + sin(a) * 9 + wob * 0.5); g.stroke();
      }
      g.restore();
    }

    return {
      accent: '#e0a070', bg: '#4a3326', defColor: '#c8423e', pivot: [200, 345], badge: [200, 222, 156],
      traits: function (P) {
        const v = P.variant, R = P.rng('t');
        const furBase = [0, 1, 2][v % 3];
        return {
          tone: furBase, blind: v % 3 === 2, scars: 2 + (v % 3), earNotch: v % 2 === 0, eyeCol: ['#d89a2a', '#7ab04a', '#c85a2a', '#5aa0c8'][(v >> 1) % 4],
          eye: { w: 15, h: 8.6, lowR: 0.7, sc0: '#8a7664', sc1: '#463a2e', ir: 8.4, pr: 0.5, pc: '#0a0604',
            i0: lite(['#d89a2a', '#7ab04a', '#c85a2a', '#5aa0c8'][(v >> 1) % 4], 0.45), i1: ['#d89a2a', '#7ab04a', '#c85a2a', '#5aa0c8'][(v >> 1) % 4], i2: dark(['#d89a2a', '#7ab04a', '#c85a2a', '#5aa0c8'][(v >> 1) % 4], 0.6),
            lash: '#120804', lashW: 2.6, wing: 0, crease: 0, creaseCol: '#000', lowerLine: 0.25, pupil: 'round' }
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const base = shape([200, 322, 130, 326, 66, 346, 20, 386, -10, 440, -22, 520, 422, 520, 410, 440, 380, 386, 334, 346, 270, 326], true, [10, 11]);
        fillBase(g, base, { hi: '#6a5a4a', mid: '#3a2c22', lo: '#1c120c' });
        // mantle: painterly fur - mottled clumps, then thousands of flowing strokes, then the banner tunic
        fillBase(g, base, { hi: '#8c7862', mid: '#5c4838', lo: '#2a1c12' });
        g.save(); g.clip(base.path);
        const fa = (x) => PI / 2 + clamp((x - 200) / 200, -1, 1) * 0.55;
        for (let i = 0; i < 120; i++) {
          const x = -10 + R() * 420, y = 326 + R() * 200, a = fa(x), len = 50 + R() * 56, wd = 20 + R() * 24;
          const tone = clamp(0.2 + abs(x - 200) / 200 * 0.5 + (R() - 0.5) * 0.4, 0, 0.999);
          blob(g, x + cos(a) * len * 0.3, y + sin(a) * len * 0.3, len * 0.5, wd * 0.5, '#0c0604', 0.3, a);
          blob(g, x, y, len * 0.45, wd * 0.4, MANTLECOL[(tone * MANTLECOL.length) | 0], 0.4, a);
        }
        const mflow = (x, y, Rr) => fa(x) + (Rr() - 0.5) * 0.2;
        strokes(g, base, 2200, { cols: ['#1c120c', '#2a1a12', '#3a281c', '#4a3426', '#5a4636', '#6a5644', '#7a6652', '#8a7662'], len: [22, 56], w: [1.6, 3.6], a: [0.35, 0.85], flow: mflow, curve: 0.5, jit: 0.2 }, R);
        strokes(g, base, 900, { cols: ['#d8cdb8', '#bcae98', '#a89a88', '#e8dcc6'], len: [20, 48], w: [0.9, 1.8], a: [0.2, 0.55], flow: mflow, curve: 0.5, jit: 0.2 }, R);
        const tunHalf = (y) => 26 + Math.max(0, y - 340) * 0.14;
        const tun = pshape([200 - tunHalf(340), 336, 200 + tunHalf(340), 336, 200 + tunHalf(530) + 2, 530, 200 - tunHalf(530) - 2, 530]);
        litFill(g, tun, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 7, rim: lite(acc, 0.2), rimW: 5, rimA: 0.5 });
        inClip(g, tun, () => {
          g.strokeStyle = 'rgba(255,226,160,.55)'; g.lineWidth = 2; g.setLineDash([6, 4]);
          g.beginPath(); g.moveTo(200 - tunHalf(340) + 6, 342); g.lineTo(200 - tunHalf(530) + 6, 530); g.moveTo(200 + tunHalf(340) - 6, 342); g.lineTo(200 + tunHalf(530) - 6, 530); g.stroke(); g.setLineDash([]);
          g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, 340); g.lineTo(200, 530); g.stroke();
          blob(g, 200, 450, 30, 90, '#000', 0.28);
        });
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 9; i++) {
          const y = 344 + i * 21, x = 200 + s * (tunHalf(y) + 4);
          cluster(g, x, y, PI / 2 + s * 0.3 + (R() - 0.5) * 0.15, 44 + R() * 16, R, ['#2a1a12', '#4a3426', '#6a5644', '#8a7662', '#b8a890'], 9, 5);
        }
        g.restore();
        lightPass(g, base, FUR, { d: 18, shade: 0.5, spec: 0.22, rim: acc, rimW: 14, rimA: 0.75 });
        const mcol = (x, y, nx, ny, Rr) => nx > 0.4 ? ['#b88660', '#9a7050', '#8a7662', '#5a4636'][(Rr() * 4) | 0] : MANTLECOL[(Rr() * 6) | 0];
        edgeFur(g, base, 520, { len: [14, 34], w: [2, 4], a: [0.6, 0.95], colFn: mcol, inset: 9, grav: 0.55, curve: 0.5, only: (nx, ny, x, y) => y < 470 }, R);
        inClip(g, base, () => {
          softPoly(g, [130, 336, 40, 410, 10, 520, 0, 420], '#fff2dc', 0.18, 14);
          softPoly(g, [310, 346, 380, 420, 396, 520, 330, 440], '#0a0408', 0.35, 14);
        });
        // leather strap + bronze studs across the chest
        const strap = pshape([100, 372, 118, 358, 380, 478, 370, 506]);
        litFill(g, strap, { hi: '#6a4630', mid: '#43281a', lo: '#24140c', sh: '#0c0604' }, { d: 4, edge: 'rgba(0,0,0,.7)', edgeW: 1.2 });
        for (let i = 0; i < 6; i++) { const t = 0.08 + i * 0.17; litFill(g, eshape(110 + 262 * t, 366 + 132 * t, 3.8, 3.8), BRONZE, { d: 1.5, edge: 'rgba(40,20,4,.8)', edgeW: 0.8 }); }
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('collar');
        // fur ruff around the neck base, overlapping the jaw
        const ruff = shape([100, 298, 150, 320, 200, 332, 250, 320, 300, 298, 316, 336, 290, 374, 200, 394, 110, 374, 84, 336], true);
        fillBase(g, ruff, { hi: '#8c7862', mid: '#5c4838', lo: '#2a1c12' });
        g.save(); g.clip(ruff.path);
        const rflow = (x, y, Rr) => PI / 2 + clamp((x - 200) / 120, -1, 1) * 0.75 + (Rr() - 0.5) * 0.25;
        strokes(g, ruff, 1100, { cols: ['#1c120c', '#2a1a12', '#3a281c', '#4a3426', '#5a4636', '#6a5644', '#7a6652', '#8a7662'], len: [18, 40], w: [1.8, 3.8], a: [0.4, 0.9], flow: rflow, curve: 0.5, jit: 0.2 }, R);
        strokes(g, ruff, 500, { cols: ['#d8cdb8', '#bcae98', '#a89a88', '#e8dcc6'], len: [16, 36], w: [1, 2], a: [0.25, 0.6], flow: rflow, curve: 0.5, jit: 0.2 }, R);
        g.restore();
        lightPass(g, ruff, FUR, { d: 12, shade: 0.55, spec: 0.2, rim: acc, rimW: 10, rimA: 0.7 });
        edgeFur(g, ruff, 420, { len: [12, 30], w: [2, 4], a: [0.6, 0.95], colFn: (x, y, nx, ny, Rr) => nx > 0.45 ? ['#b88660', '#9a7050', '#8a7662'][(Rr() * 3) | 0] : MANTLECOL[(Rr() * 6) | 0], inset: 8, grav: 0.5, curve: 0.5 }, R);
        for (let i = 0; i < 16; i++) {
          const u = i / 15, a = lerp(0.12, PI - 0.12, u), x = 200 - cos(a) * 100, y0 = 346 + sin(a) * 38;
          cluster(g, x, y0, PI / 2 + (x - 200) * 0.006 + (R() - 0.5) * 0.3, 26 + R() * 12, R, ['#2a1a12', '#4a3426', '#6a5644', '#8a7662', '#b8a890'], 8, 5);
        }
        softPoly(g, [130, 346, 270, 346, 250, 372, 200, 380, 150, 372], '#000', 0.3, 6);
        // claw necklace
        g.save(); g.lineCap = 'round';
        g.strokeStyle = '#2a1c12'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(132, 340); g.quadraticCurveTo(200, 408, 268, 340); g.stroke();
        for (let i = 0; i < 9; i++) {
          const t = (i + 0.5) / 9, x = (1 - t) * (1 - t) * 132 + 2 * (1 - t) * t * 200 + t * t * 268, y = (1 - t) * (1 - t) * 340 + 2 * (1 - t) * t * 408 + t * t * 340;
          const sz = 16 - abs(t - 0.5) * 14;
          litFill(g, shape([x - 4, y - 2, x + 4, y - 2, x + 3, y + sz * 0.55, x + 0.5, y + sz, x - 2, y + sz * 0.5], true), { hi: '#fff6e0', mid: '#e0d0aa', lo: '#9a8662', sh: '#3a2c1a' }, { d: 2, edge: 'rgba(40,28,10,.7)', edgeW: 0.8 });
        }
        g.restore();
        // bronze clasp with banner gem
        litFill(g, eshape(200, 360, 21, 21), BRONZE, { d: 5, rim: lite(acc, 0.3), rimW: 4, rimA: 0.8, edge: 'rgba(50,26,6,.9)', edgeW: 1.8 });
        g.strokeStyle = 'rgba(50,26,6,.7)'; g.lineWidth = 1.2; g.beginPath(); g.arc(200, 360, 15.5, 0, TAU); g.stroke();
        litFill(g, eshape(200, 360, 10, 10), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 3, spec: 0.7, edge: 'rgba(50,26,6,.9)', edgeW: 1.2 });
        blob(g, 197, 357, 4, 3, '#fff', 0.75);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head');
        const hd = shape(symPts(HEAD), true);
        fillBase(g, hd, { hi: FUR.hi, mid: FUR.mid, lo: FUR.lo });
        // big tonal shapes
        inClip(g, hd, () => {
          softPoly(g, [130, 130, 200, 112, 270, 130, 250, 168, 200, 160, 150, 168], '#8a5c3a', 0.5, 12);
          softPoly(g, [112, 190, 150, 180, 170, 210, 150, 236, 112, 232], '#1a0c06', 0.5, 9);
          softPoly(g, [288, 190, 250, 180, 230, 210, 250, 236, 288, 232], '#1a0c06', 0.55, 9);
          softPoly(g, [96, 232, 140, 250, 150, 300, 110, 290], FROST.mid, 0.34, 12);
          softPoly(g, [304, 232, 260, 250, 250, 300, 290, 290], FROST.mid, 0.3, 12);
        });
        // fur texture
        const flowR = (x, y) => atan2(y - 232, x - 200);
        strokes(g, hd, 1500, { cols: FURCOL, len: [9, 22], w: [1, 2.2], a: [0.35, 0.8], flow: flowR, curve: 0.4, jit: 0.35 }, R);
        strokes(g, hd, 520, { cols: FROSTCOL, len: [8, 18], w: [0.9, 1.8], a: [0.25, 0.65], flow: flowR, curve: 0.4, jit: 0.35, bb: [90, 120, 310, 330] }, R);
        // muzzle
        const mz = shape(symPts(MUZZLE), true);
        fillBase(g, mz, TAN);
        strokes(g, mz, 700, { cols: ['#8a7252', '#a58c66', '#c4ab82', '#e0cba2', '#6a553a'], len: [5, 12], w: [0.9, 1.7], a: [0.35, 0.8], flow: (x, y) => atan2(y - 224, x - 200), curve: 0.3, jit: 0.3 }, R);
        lightPass(g, mz, TAN, { d: 8, shade: 0.5, spec: 0.3 });
        inClip(g, mz, () => { softPoly(g, [150, 250, 250, 250, 254, 290, 200, 306, 146, 290], '#241810', 0.28, 8); });
        // nose
        const nose = shape(symPts([200, 205, 222, 208, 234, 219, 231, 234, 214, 243, 200, 245]), true);
        litFill(g, nose, { hi: '#5a4a44', mid: '#241a18', lo: '#0c0808', sh: '#000' }, { d: 4, rim: acc, rimW: 3, rimA: 0.5, edge: 'rgba(0,0,0,.8)', edgeW: 1.2 });
        blob(g, 192, 213, 7, 3, '#ffffff', 0.32); blob(g, 211, 211, 3, 2, '#ffffff', 0.15);
        // whisker dots + under-eye shadow
        g.fillStyle = 'rgba(30,18,10,.55)';
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 8; i++) { const a = (i % 4) * 0.5, x = 200 + s * (34 + (i % 4) * 9 + (i > 3 ? 4 : 0)), y = 262 + (i > 3 ? 8 : 0) - (i % 4) * 2.5; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
        // scars (claw marks across the left cheek)
        g.save(); g.lineCap = 'round';
        const sc = T.scars;
        for (let i = 0; i < sc; i++) {
          const ox = i * 10, x0 = 112 + ox, y0 = 212 - i * 1, x1 = 138 + ox, y1 = 270 + i * 3;
          g.strokeStyle = 'rgba(14,6,4,.6)'; g.lineWidth = 4.2; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 5, (y0 + y1) / 2 - 3, x1, y1); g.stroke();
          g.strokeStyle = 'rgba(214,150,134,.85)'; g.lineWidth = 1.6; g.stroke();
          g.strokeStyle = 'rgba(255,214,196,.5)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x0 - 0.8, y0); g.quadraticCurveTo((x0 + x1) / 2 + 4.2, (y0 + y1) / 2 - 3, x1 - 0.8, y1); g.stroke();
        }
        g.restore();
        lightPass(g, hd, FUR, { d: 15, shade: 0.5, spec: 0.22, rim: acc, rimW: 13, rimA: 0.8 });
        inClip(g, hd, () => {
          softPoly(g, [250, 126, 318, 160, 322, 260, 290, 300, 262, 260, 266, 190], '#08040a', 0.36, 14);
          softPoly(g, [96, 150, 130, 124, 190, 112, 186, 140, 130, 170, 110, 220], '#ffe9cc', 0.2, 14);
        });
        strokes(g, hd, 160, { cols: ['#e8a870', '#f0b888', '#d89860'], len: [7, 14], w: [0.9, 1.5], a: [0.35, 0.75], flow: flowR, curve: 0.3, jit: 0.3, bb: [276, 130, 322, 300] }, R);
        const fcol = (x, y, nx, ny, Rr) => nx > 0.45 ? ['#c88652', '#a8683c', '#7a4a2a', '#5a3a28', '#8a5a38'][(Rr() * 5) | 0] : y > 230 && Rr() < 0.55 ? FROSTCOL[(Rr() * 3) | 0] : FURCOL[(Rr() * 6) | 0];
        edgeFur(g, hd, 620, { len: [9, 22], w: [1.6, 3.2], a: [0.55, 0.95], colFn: fcol, inset: 7, grav: 0.3, curve: 0.5 }, R);
        edgeFur(g, hd, 260, { len: [22, 44], w: [2, 4], a: [0.6, 0.95], colFn: fcol, inset: 10, grav: 0.55, curve: 0.6, only: (nx, ny, x, y) => abs(nx) > 0.55 && y > 190 }, R);
      },

      fore: function (g, P, T) {
        // lower tusks poking over the upper lip
        for (let s = -1; s <= 1; s += 2) {
          const x = 200 + s * 27;
          litFill(g, shape([x - 3.6, 286, x + 3.6, 286, x + 2.6, 270, x, 262, x - 2.6, 270], true, [3]), { hi: '#fffaf0', mid: '#e8dcc0', lo: '#a89868', sh: '#3a2c18' }, { d: 1.8, edge: 'rgba(40,28,10,.8)', edgeW: 0.8 });
        }
        if (T.blind) {
          g.save(); g.lineCap = 'round';
          g.strokeStyle = 'rgba(14,6,4,.7)'; g.lineWidth = 5; g.beginPath(); g.moveTo(134, 140); g.quadraticCurveTo(150, 200, 170, 262); g.stroke();
          g.strokeStyle = 'rgba(224,160,144,.9)'; g.lineWidth = 1.9; g.stroke();
          g.restore();
        }
      },

      sheen: function (g, P, T) {
        const R = P.rng('sheen'), hd = shape(symPts(HEAD), true);
        strokes(g, hd, 650, { cols: ['#ffe8c8', '#ffffff', '#f6d3a2'], len: [10, 24], w: [1, 2], a: [0.5, 1], flow: (x, y) => atan2(y - 232, x - 200), curve: 0.4, jit: 0.4 }, R);
      },

      ears: function (g, P, T) {
        const R = P.rng('ears');
        for (let s = -1; s <= 1; s += 2) {
          g.save(); g.translate(200 + s * 108, 160);
          const ear = eshape(0, -6, 27, 25);
          fillBase(g, ear, { hi: FUR.hi, mid: FUR.mid, lo: FUR.lo });
          strokes(g, ear, 140, { cols: FURCOL, len: [6, 12], w: [1, 1.8], a: [0.4, 0.8], ang: -PI / 2, jit: 1.8, curve: 0.3 }, R);
          lightPass(g, ear, FUR, { d: 5, rim: P.accent, rimW: 5, rimA: s > 0 ? 0.8 : 0.3 });
          const inner = eshape(s * 2, -3, 18, 17);
          fillBase(g, inner, { hi: '#c49a86', mid: '#7a5444', lo: '#3a2018' });
          lightPass(g, inner, { hi: '#c49a86', mid: '#7a5444', lo: '#3a2018', sh: '#120806' }, { d: 4, spec: 0.2 });
          if (T.earNotch && s < 0) { g.fillStyle = '#0c0604'; g.beginPath(); g.moveTo(-26, -22); g.lineTo(-14, -30); g.lineTo(-16, -16); g.closePath(); g.fill(); }
          g.restore();
        }
      },

      back: function (g, P, T, A) {
        const t = A.t, ph = A.ph, L = P.layers.ears; if (!L) return;
        for (let s = -1; s <= 1; s += 2) {
          const tw = Math.pow(Math.max(0, sin(t * 0.83 + ph[2] + (s > 0 ? 1.7 : 0))), 26) * sin(t * 38) * 0.16 + sin(t * 0.7 + ph[1] + s) * 0.02 - A.m.ear * 0.05 * s;
          const px = 200 + s * 108;
          g.save(); g.beginPath(); g.rect(s < 0 ? 0 : 200, 0, 200, H); g.clip();
          g.translate(px, 164); g.rotate(tw * s); g.translate(-px, -164);
          blit(g, L);
          g.restore();
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, e = T.eye;
        // fur sheen sweeping across the head
        const sh = P.layers.sheen;
        if (sh) {
          const k = (A.t * 0.22 + A.ph[4] * 0.1) % 1.6, x = -80 + k * 260;
          g.save(); g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            g.save(); g.beginPath(); g.rect(x - 34 + i * 12, 100, 68 - i * 24, 240); g.clip(); g.globalAlpha = 0.1 + i * 0.06; blit(g, sh); g.restore();
          }
          g.restore();
        }
        const open = clamp(1 - A.blink - m.lid * 0.5 + m.browY * 0.08, 0, 1.15);
        const st = { dir: 1, ti: m.brow * 1.6, to: -m.brow * 0.6, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        blob(g, 154, 200, 28, 15, '#0a0402', 0.55); blob(g, 246, 200, 28, 15, '#0a0402', 0.55);
        drawEye(g, 154, 201, e, st);
        if (T.blind) {
          const hu = e.h * open, hl = e.h * e.lowR * (1 - m.lower * 0.6) * Math.min(1, 0.3 + open * 0.7);
          g.save(); g.beginPath(); eyePath(g, 154, 201, e.w, hu, hl, 1, st.ti, st.to); g.clip();
          g.fillStyle = 'rgba(214,226,236,.78)'; g.fillRect(130, 180, 50, 40); g.restore();
        }
        st.dir = -1; drawEye(g, 246, 201, e, st);
        brow(g, -1, A, T); brow(g, 1, A, T);
        // nostrils flare with breathing
        const fl = 1 + 0.35 * A.breath + Math.max(0, m.glow - 1) * 1.2;
        g.fillStyle = 'rgba(0,0,0,.85)';
        for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(200 + s * 14, 238, 3.2 * fl, 1.9 * fl, s * 0.7, 0, TAU); g.fill(); }
        mouth(g, A, T);
      }
    };
  })();

  /* ======================================================================= DARLOK */
  PAINT.darlok = (function () {
    const CLOAK = { hi: '#7a6ae6', mid: '#3e3394', lo: '#1c1658', sh: '#06031c' };
    const LINING = { hi: '#463a9a', mid: '#221a5a', lo: '#0c0828', sh: '#020108' };
    const SILVER = { hi: '#f4f0ff', mid: '#bdb4e0', lo: '#6a5f9a', sh: '#1e1840' };
    const HOOD = [64, 450, 74, 388, 88, 328, 96, 264, 102, 202, 116, 150, 142, 104, 174, 68, 204, 44, 230, 36, 248, 48, 258, 72, 274, 112, 292, 160, 304, 214, 312, 270, 322, 326, 338, 386, 352, 436, 342, 458, 200, 470, 58, 458];
    const VOID_HALF = [200, 112, 230, 122, 256, 150, 270, 194, 270, 240, 258, 280, 240, 308, 218, 328, 200, 336];
    const CLOAK_PTS = [-16, 520, -16, 440, 20, 392, 76, 356, 136, 334, 200, 324, 264, 334, 324, 356, 380, 392, 416, 440, 416, 520];

    function glowEye(g, x, y, dir, A, T, pulse) {
      const m = A.m, w = 25;
      const asym = dir > 0 ? m.bAsym : 0;
      const lidk = clamp(1 - A.blink - m.lid * 0.7 + m.browY * 0.28 + Math.max(0, -m.brow) * 0.25, 0.1, 1.45) * (1 - 0.5 * asym);
      const hu = 8 * lidk, hl = 5.5 * lidk - Math.max(0, m.smile) * 8.6 * Math.min(1, lidk + 0.3);
      const ti = m.brow * 5.5 + asym * 1.5, to = -m.brow * 2 - asym * 1.5;
      const gl = m.glow * pulse;
      glow(g, '#7a52ff', x, y, 58 * (0.9 + 0.1 * gl), 0.55 * gl);
      glow(g, '#58e0ff', x, y, 30, 0.55 * gl);
      g.save();
      g.beginPath(); eyePath(g, x, y, w, Math.max(hu, 0.9), hl < -hu * 0.85 ? -hu * 0.85 : hl, dir, ti, to);
      g.fillStyle = lg(g, x - w, y, x + w, y, [0, '#b48bff', 0.22, '#6fdcff', 0.5, '#f4ffff', 0.78, '#6fdcff', 1, '#b48bff']); g.fill();
      g.clip();
      const hx = x + A.lx * w * 0.42, hy = y + A.ly * 2;
      blob(g, hx, hy, 15, 7, '#ffffff', 1.0, 0, 0.35);
      g.fillStyle = lg(g, 0, y - hu, 0, y + hu, [0, 'rgba(60,20,140,.55)', 0.5, 'rgba(60,20,140,0)', 1, 'rgba(60,20,140,.35)']); g.fillRect(x - w - 2, y - 14, w * 2 + 4, 28);
      g.restore();
      g.strokeStyle = 'rgba(40,20,120,.7)'; g.lineWidth = 1.1; g.beginPath(); eyePath(g, x, y, w, Math.max(hu, 0.9), hl < -hu * 0.85 ? -hu * 0.85 : hl, dir, ti, to); g.stroke();
      if (gl > 1.15) glow(g, '#ffffff', x, y, 14, (gl - 1.15) * 1.1);
      // thin flare streak
      g.save(); g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg(g, x - 36, 0, x + 36, 0, [0, 'rgba(140,200,255,0)', 0.5, 'rgba(190,235,255,' + (0.3 * gl).toFixed(3) + ')', 1, 'rgba(140,200,255,0)']);
      g.fillRect(x - 36, y - 0.7 + ti * 0.1, 72, 1.4); g.restore();
    }

    return {
      accent: '#a58bff', bg: '#1d1650', defColor: '#c8a040', pivot: [200, 348], badge: [200, 214, 136],
      traits: function (P) {
        const v = P.variant;
        return {
          voidShape: shape(symPts(VOID_HALF), true), cloak: shape(CLOAK_PTS, true, [0, 10]), runes: v % 3, hoodTip: v % 2,
          eyeCol: ['#6fdcff', '#9dff9a', '#ff9ad8', '#ffd86a'][(v >> 1) % 4]
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const cloak = T.cloak;
        litFill(g, cloak, CLOAK, { rim: acc, rimW: 15, rimA: 0.85, d: 17 });
        inClip(g, cloak, () => {
          for (let i = 0; i < 13; i++) {
            const u = i / 12, x = lerp(-20, 420, u), sx = 200 + (x - 200) * 0.3, dark_ = i % 2 === 0;
            softPoly(g, [sx - 7, 330, sx + 7, 330, x + 20, 540, x - 20, 540], dark_ ? '#04021a' : '#9488ff', dark_ ? 0.4 : 0.15, 9, false);
          }
          g.lineCap = 'round';
          for (let i = 0; i < 16; i++) {
            const u = (i + R() * 0.8) / 16, x = lerp(-10, 410, u), sx = 200 + (x - 200) * 0.3;
            g.strokeStyle = 'rgba(2,1,16,' + (0.3 + R() * 0.25) + ')'; g.lineWidth = 1.4 + R() * 1.6;
            g.beginPath(); g.moveTo(sx, 336); g.quadraticCurveTo(lerp(sx, x, 0.5) + (R() - 0.5) * 14, 420, x + (R() - 0.5) * 24, 530); g.stroke();
            g.strokeStyle = 'rgba(170,150,255,' + (0.1 + R() * 0.12) + ')'; g.lineWidth = 1.1;
            g.beginPath(); g.moveTo(sx + 1.6, 336); g.quadraticCurveTo(lerp(sx, x, 0.5) + 1.6 + (R() - 0.5) * 14, 420, x + 2 + (R() - 0.5) * 24, 530); g.stroke();
          }
          blob(g, 200, 470, 70, 120, '#02010c', 0.45);
          softPoly(g, [320, 340, 420, 400, 420, 520, 360, 520], '#02010a', 0.4, 12);
        });
        // front closure + trim
        g.strokeStyle = 'rgba(2,1,12,.8)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(200, 380); g.lineTo(200, 530); g.stroke();
        g.strokeStyle = SILVER.mid; g.lineWidth = 1.6; g.globalAlpha = 0.7; g.beginPath(); g.moveTo(196.5, 380); g.lineTo(196.5, 530); g.moveTo(203.5, 380); g.lineTo(203.5, 530); g.stroke(); g.globalAlpha = 1;
        // banner sigil on the chest
        const sg = pshape([200, 420, 214, 440, 200, 464, 186, 440]);
        litFill(g, sg, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 3, edge: SILVER.mid, edgeW: 1.4 });
        g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(200, 426); g.lineTo(200, 458); g.stroke();
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('collar');
        softPoly(g, [84, 290, 316, 290, 346, 380, 200, 456, 54, 380], '#000', 0.5, 12);
        const cowl = shape(symPts([200, 300, 228, 295, 254, 283, 276, 266, 294, 286, 304, 322, 312, 372, 324, 424, 200, 454]), true);
        litFill(g, cowl, CLOAK, { d: 14, rim: acc, rimW: 11, rimA: 0.9, edge: 'rgba(2,1,14,.85)', edgeW: 1.6 });
        inClip(g, cowl, () => {
          for (let i = 0; i < 11; i++) {
            const u = i / 10, x = lerp(96, 304, u), top = 292 - sin(u * PI) * 6 + (abs(u - 0.5) > 0.3 ? -22 : 0), dark_ = i % 2 === 0;
            softPoly(g, [lerp(200, x, 0.7) - 4, top + 10, lerp(200, x, 0.7) + 4, top + 10, x + 12, 460, x - 12, 460], dark_ ? '#04021a' : '#9488ff', dark_ ? 0.36 : 0.15, 6, false);
          }
          g.lineCap = 'round';
          for (let i = 0; i < 9; i++) {
            const u = (i + R() * 0.7) / 9, x = lerp(100, 300, u), x0 = lerp(200, x, 0.65);
            g.strokeStyle = 'rgba(2,1,16,' + (0.3 + R() * 0.2) + ')'; g.lineWidth = 1.2 + R() * 1.6;
            g.beginPath(); g.moveTo(x0, 306 + abs(u - 0.5) * 10); g.quadraticCurveTo(lerp(x0, x, 0.5) + (R() - 0.5) * 10, 380, x + (R() - 0.5) * 16, 456); g.stroke();
          }
          blob(g, 150, 340, 40, 30, CLOAK.hi, 0.22);
          // lining strip along the rolled rim
          g.strokeStyle = LINING.hi; g.lineWidth = 6; g.globalAlpha = 0.65;
          g.beginPath(); trace(g, [112, 276, 150, 296, 200, 308, 250, 296, 288, 276], false); g.stroke(); g.globalAlpha = 1;
          g.strokeStyle = 'rgba(2,1,14,.6)'; g.lineWidth = 2; g.beginPath(); trace(g, [112, 283, 150, 303, 200, 315, 250, 303, 288, 283], false); g.stroke();
        });
        g.save(); g.lineCap = 'round';
        g.strokeStyle = C.mid; g.lineWidth = 2.2; g.beginPath(); trace(g, [114, 272, 152, 292, 200, 303, 248, 292, 286, 272], false); g.stroke();
        g.strokeStyle = C.hi; g.lineWidth = 0.8; g.globalAlpha = 0.85; g.beginPath(); trace(g, [114, 271, 152, 291, 200, 302, 248, 291, 286, 271], false); g.stroke();
        g.restore();
        g.strokeStyle = 'rgba(2,1,14,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(200, 312); g.lineTo(200, 452); g.stroke();
        litFill(g, eshape(200, 352, 11, 11), SILVER, { d: 3, edge: 'rgba(20,14,50,.9)', edgeW: 1.3, rim: acc, rimW: 3, rimA: 0.6 });
        litFill(g, eshape(200, 352, 6.4, 6.4), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, spec: 0.7 });
        blob(g, 198, 350, 2.4, 1.8, '#fff', 0.8);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head'), C = P.color;
        const hood = shape(HOOD, true);
        litFill(g, hood, CLOAK, { rim: acc, rimW: 16, rimA: 0.9, d: 18 });
        inClip(g, hood, () => {
          // draped folds: long soft creases falling from the crown around the opening
          g.lineCap = 'round';
          for (let i = 0; i < 12; i++) {
            const side = i < 6 ? -1 : 1, u = (i < 6 ? i : i - 6) / 5;
            const tx = 226 + (R() - 0.5) * 10, ty = 50 + R() * 16;
            const ex = 200 + side * (80 + u * 108 + R() * 14), ey = lerp(150, 430, Math.pow(u, 0.9)) + (R() - 0.5) * 20;
            const mx = lerp(tx, ex, 0.5) + side * (4 + R() * 14), my = lerp(ty, ey, 0.4) + (R() - 0.5) * 10;
            g.strokeStyle = 'rgba(3,2,20,' + (0.2 + R() * 0.18) + ')'; g.lineWidth = 2 + R() * 4;
            g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
            g.strokeStyle = 'rgba(170,152,255,' + (0.06 + R() * 0.1) + ')'; g.lineWidth = 1.4 + R() * 1.8;
            g.beginPath(); g.moveTo(tx - 3, ty); g.quadraticCurveTo(mx - 3, my - 1, ex - 3, ey - 1); g.stroke();
          }
          softPoly(g, [96, 330, 120, 200, 150, 120, 190, 60, 150, 140, 134, 220, 124, 330], '#a89cff', 0.2, 10);
          softPoly(g, [300, 260, 286, 140, 250, 60, 262, 150, 280, 270, 330, 400], '#030014', 0.45, 12);
          softPoly(g, [60, 420, 200, 450, 340, 420, 340, 470, 60, 470], '#020010', 0.4, 12);
        });
        // hem trim in banner colour
        g.save(); g.lineCap = 'round';
        g.strokeStyle = C.mid; g.lineWidth = 3; g.beginPath(); trace(g, [60, 446, 130, 458, 200, 462, 270, 458, 342, 446], false); g.stroke();
        g.strokeStyle = C.hi; g.lineWidth = 1; g.beginPath(); trace(g, [60, 445, 130, 457, 200, 461, 270, 457, 342, 445], false); g.stroke();
        g.restore();
        // the void (hood interior)
        const vd = T.voidShape;
        fillBase(g, vd, { hi: '#2a1f78', mid: '#0d0833', lo: '#020110' });
        g.save(); g.clip(vd.path);
        // inner wall folds
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 6; i++) {
          const y = 140 + i * 30;
          softPoly(g, [200 + s * 66, y, 200 + s * 78, y + 8, 200 + s * 78, y + 36, 200 + s * 62, y + 24], i % 2 ? '#8a78ff' : '#000', i % 2 ? 0.2 : 0.4, 4);
        }
        g.restore();
        // faint mask-like face hints
        inClip(g, vd, () => {
          const face = shape(symPts([200, 122, 224, 132, 242, 160, 250, 202, 244, 246, 232, 284, 216, 312, 200, 322]), true);
          fillBase(g, face, { hi: '#26225a', mid: '#0f0b30', lo: '#04020f' });
          g.globalAlpha = 0.85;
          softPoly(g, [150, 150, 192, 134, 212, 142, 176, 170, 148, 190], '#b0a4ff', 0.3, 9);        // forehead plane
          softPoly(g, [134, 188, 190, 184, 192, 198, 136, 204], '#000', 0.55, 4);                      // brow shadow left
          softPoly(g, [210, 184, 266, 188, 264, 204, 208, 198], '#000', 0.6, 4);                       // brow shadow right
          softPoly(g, [138, 216, 176, 228, 170, 264, 142, 250], '#9a8cff', 0.34, 8);                    // cheekbone left
          softPoly(g, [195, 206, 203, 206, 207, 258, 193, 258], '#9a8cff', 0.26, 3);                   // nose ridge
          softPoly(g, [232, 220, 262, 214, 262, 258, 240, 266], '#000', 0.5, 8);
          g.globalAlpha = 1;
          lightPass(g, face, { hi: '#26225a', mid: '#0f0b30', lo: '#04020f', sh: '#000' }, { d: 8, shade: 0.55, spec: 0.22, rim: '#8d78ff', rimW: 7, rimA: 0.55 });
        });
        crescent(g, vd, 8, 8, '#7a68f0', 0.45, 8);
        crescent(g, vd, -9, -1, acc, 0.55, 7);
        crescent(g, vd, -14, -14, '#000', 0.7, 14);
      },

      fore: function (g, P, T) {
        const C = P.color, acc = P.accent, vd = T.voidShape;
        // hood opening edge: rolled fabric lip with banner piping
        g.save(); g.lineJoin = 'round';
        g.strokeStyle = 'rgba(2,1,14,.85)'; g.lineWidth = 9; g.stroke(vd.path);
        g.strokeStyle = CLOAK.mid; g.lineWidth = 5.5; g.stroke(vd.path);
        g.strokeStyle = CLOAK.hi; g.lineWidth = 1.8; g.globalAlpha = 0.7; g.stroke(vd.path); g.globalAlpha = 1;
        g.restore();
        crescent(g, vd, 10, 10, '#fff', 0.0, 2);
        // piping in banner colour just outside the lip
        g.save(); g.translate(200, 224); g.scale(1.065, 1.05); g.translate(-200, -224);
        g.lineWidth = 1.3 / 1.06; g.strokeStyle = C.mid; g.stroke(vd.path);
        g.lineWidth = 0.6; g.strokeStyle = C.hi; g.globalAlpha = 0.8; g.stroke(vd.path);
        g.restore();
        // violet rim glow on the right of the opening
        g.save(); g.clip(vd.path);
        g.fillStyle = lg(g, 276, 0, 238, 0, [0, rgba(acc, 0.35), 1, rgba(acc, 0)]); g.fillRect(230, 100, 60, 260);
        g.restore();
      },

      bodyDyn: function (g, P, T, A) {
        const k = ((A.t * 0.13 + A.ph[3] * 0.05) % 1.5) - 0.25, x = -60 + k * 520;
        g.save(); g.clip(T.cloak.path); g.globalCompositeOperation = 'lighter';
        g.fillStyle = lg(g, x - 70, 330, x + 70, 520, [0, 'rgba(150,130,255,0)', 0.5, 'rgba(150,130,255,.16)', 1, 'rgba(150,130,255,0)']);
        g.fillRect(x - 90, 320, 180, 210); g.restore();
      },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph, vd = T.voidShape;
        // drifting wisps of shadow
        g.save(); g.clip(vd.path);
        for (let i = 0; i < 7; i++) {
          const a = t * (0.14 + i * 0.03) + i * 1.7 + ph[i % 8];
          blob(g, 200 + sin(a) * 54 + sin(t * 0.31 + i) * 14, 140 + i * 29 + cos(a * 0.8) * 20, 52 + 20 * sin(a * 1.3), 16 + 6 * cos(a), i % 2 ? '#6a46d8' : '#241a78', 0.17 + 0.05 * sin(a * 2), a * 0.3);
        }
        g.restore();
        const pulse = 0.9 + 0.1 * sin(t * 2.1 + ph[0]) + A.talk * 0.35 + (A.talkAmt > 0.02 ? 0.05 : 0);
        glowEye(g, 164, 208, 1, A, T, pulse);
        glowEye(g, 236, 208, -1, A, T, pulse);
        // runic sensor marks under the eyes
        if (T.runes) {
          g.save(); g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba('#8d78ff', (0.3 + 0.2 * sin(t * 1.3 + ph[2])) * m.glow);
          g.lineWidth = 1.5;
          for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 2 + T.runes; i++) { g.beginPath(); g.moveTo(200 + s * (60 + i * 5), 226 + i * 9); g.lineTo(200 + s * (74 + i * 5), 222 + i * 9); g.stroke(); }
          g.restore();
        }
        // cold motes
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const u = (t * 0.05 + i * 0.173 + ph[i % 8] * 0.1) % 1, x = 150 + hash2(i, 31) * 100 + sin(t * 0.5 + i) * 6, y = 300 - u * 230;
          const a = Math.sin(u * PI) * 0.7 * (0.6 + 0.4 * sin(t * 3 + i));
          g.fillStyle = rgba('#b4d8ff', a); g.beginPath(); g.arc(x, y, 1.2 + hash2(i, 5) * 1.1, 0, TAU); g.fill();
        }
        g.restore();
      },

      collarDyn: function (g, P, T, A) {
        const a = A.talk;
        if (a > 0.02) {
          glow(g, '#79e6ff', 200, 302, 30 + a * 22, 0.25 + a * 0.55);
          g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          g.strokeStyle = rgba('#c8f6ff', 0.4 + a * 0.5); g.lineWidth = 1.4 + a * 2.6;
          g.beginPath(); g.moveTo(200 - 8 - a * 18, 301); g.lineTo(200 + 8 + a * 18, 301); g.stroke(); g.restore();
        }
      }
    };
  })();

  /* ======================================================================= KLACKON */
  PAINT.klackon = (function () {
    const OLIVE = { hi: '#cfdd78', mid: '#7f9430', lo: '#3a4a14', sh: '#101806' };
    const RUST = { hi: '#f0aa62', mid: '#b4581e', lo: '#6a2c0e', sh: '#2a0e04' };
    const HEAD_HALF = [200, 98, 234, 102, 264, 120, 282, 150, 288, 190, 282, 226, 268, 258, 248, 284, 226, 300, 200, 306];
    const EYE_L = { x: 134, y: 194, rx: 33, ry: 47, rot: -0.2 };
    const EYE_R = { x: 266, y: 194, rx: 33, ry: 47, rot: 0.2 };

    function mandible(g, side, open, T) {
      g.save(); g.translate(200 + side * 25, 288); g.scale(side, 1); g.rotate(-open * 0.6);
      const m = shape([-9, -10, 8, -10, 20, 0, 24, 20, 20, 42, 8, 62, -10, 76, -8, 62, -2, 46, 0, 28, -5, 8], true, [9]);
      fillBase(g, m, { hi: RUST.hi, mid: RUST.mid, lo: RUST.lo });
      inClip(g, m, () => {
        softPoly(g, [6, -6, 14, 2, 14, 30, 4, 54, 0, 30], '#fff4d8', 0.5, 2.5);
        softPoly(g, [-4, 10, 4, 30, 0, 52, -8, 70, -2, 40], '#1a0804', 0.5, 2);
      });
      g.strokeStyle = 'rgba(30,10,4,.85)'; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke(m.path);
      // serrated inner edge
      g.fillStyle = RUST.lo;
      for (let i = 0; i < 4; i++) { const y = 18 + i * 12; g.beginPath(); g.moveTo(-1 - i * 0.6, y); g.lineTo(-7 - i * 0.4, y + 5); g.lineTo(-1 - i * 0.6, y + 9); g.closePath(); g.fill(); }
      g.restore();
    }

    function antenna(g, side, A, T) {
      const m = A.m, t = A.t, ph = A.ph;
      const bx = 200 + side * 21, by = 134;
      const lay = 0.35 + 0.95 * Math.max(0, -m.ear) + (m.ear > 0 ? -0.18 * m.ear : 0) + (m.bAsym ? (side < 0 ? -0.35 : 0.5) * m.bAsym : 0);
      const trem = 1 + Math.max(0, -m.brow) * 2.2 + Math.max(0, -m.ear) * 0.6;
      const burst = Math.pow(Math.max(0, sin(t * 0.83 + ph[1] * side + (side > 0 ? 1.3 : 0))), 22);
      let ang = -PI / 2 + side * lay + sin(t * 0.9 + ph[2] + side) * 0.05;
      let x = bx, y = by;
      const N = 13, pts = [bx, by];
      x += cos(ang) * 42; y += sin(ang) * 42; pts.push(x, y);
      ang += side * (0.95 + 0.25 * (m.ear > 0 ? m.ear : 0));
      for (let i = 0; i < N; i++) {
        const L = 15 - i * 0.55;
        ang += side * 0.1 + sin(t * 3.1 - i * 0.55 + ph[0] + side * 1.7) * (0.02 + 0.013 * i) * trem + burst * sin(t * 31 - i * 0.9) * 0.09;
        x += cos(ang) * L; y += sin(ang) * L; pts.push(x, y);
      }
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      const n = pts.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const w = i === 0 ? 10 : 8 - (i - 1) * 0.36;
        g.strokeStyle = '#12180a'; g.lineWidth = w + 2.2; g.beginPath(); g.moveTo(pts[i * 2], pts[i * 2 + 1]); g.lineTo(pts[i * 2 + 2], pts[i * 2 + 3]); g.stroke();
        g.strokeStyle = i === 0 ? OLIVE.mid : (i % 2 ? RUST.mid : '#8a6a22'); g.lineWidth = w; g.stroke();
        g.strokeStyle = i === 0 ? OLIVE.hi : RUST.hi; g.lineWidth = Math.max(1, w * 0.34); g.globalAlpha = 0.75;
        g.beginPath(); g.moveTo(pts[i * 2] - 0.9, pts[i * 2 + 1] - 0.9); g.lineTo(pts[i * 2 + 2] - 0.9, pts[i * 2 + 3] - 0.9); g.stroke(); g.globalAlpha = 1;
      }
      g.fillStyle = '#12180a'; g.beginPath(); g.arc(pts[2], pts[3], 6.2, 0, TAU); g.fill();
      g.fillStyle = OLIVE.mid; g.beginPath(); g.arc(pts[2], pts[3], 4.6, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(pts[2] - 1.2, pts[3] - 1.2, 1.2, 0, TAU); g.fill();
      g.restore();
    }

    function brow(g, side, A, T) {
      const m = A.m, as = m.bAsym * (side < 0 ? -8 : 3);
      const xi = 200 + side * 20, xo = 200 + side * 74;
      const yi = 150 + m.brow * 12 - m.browY * 9 + as, yo = 140 - m.brow * 5 - m.browY * 7 + as * 0.6;
      const cx = (xi + xo) / 2 + side * 4, cy = (yi + yo) / 2 - 8;
      g.save();
      g.beginPath(); taper(g, xi, yi + 5, cx, cy + 6, xo, yo + 7, 13, 8, 8);
      g.shadowColor = 'rgba(8,10,2,.8)'; g.shadowBlur = 6; g.fillStyle = 'rgba(8,10,2,.55)'; g.fill(); g.shadowBlur = 0;
      g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, 17, 10, 9);
      g.fillStyle = lg(g, 0, cy - 9, 0, cy + 8, [0, RUST.hi, 0.45, RUST.mid, 1, RUST.lo]); g.fill();
      g.strokeStyle = 'rgba(30,10,4,.85)'; g.lineWidth = 1.3; g.stroke();
      g.strokeStyle = 'rgba(255,240,210,.7)'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(xi + side * 2, yi - 6); g.quadraticCurveTo(cx, cy - 6, xo - side * 2, yo - 3); g.stroke();
      g.restore();
    }

    return {
      accent: '#c4e05a', bg: '#2e3a14', defColor: '#d0883a', pivot: [200, 345], badge: [200, 212, 150],
      traits: function (P) {
        const v = P.variant, R = P.rng('t'), tint = ['#d98a1c', '#b8d824', '#e0501c', '#2cc0a0'][v % 4];
        const pits = [];
        for (let i = 0; i < 70; i++) pits.push(R());
        return { tint: tint, notch: v % 3 === 1, pits: pits, eyeL: shape([0, 0, 1, 0, 0, 1]), v: v };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        // neck stalk
        const base = shape([200, 352, 150, 358, 100, 374, 52, 406, 14, 454, -6, 520, 406, 520, 386, 454, 348, 406, 300, 374, 250, 358], true, [10, 11]);
        litFill(g, base, { hi: OLIVE.mid, mid: OLIVE.lo, lo: '#141d06', sh: '#060a02' }, { rim: lite(acc, 0.1), rimW: 13, rimA: 0.8, d: 16 });
        // pauldron plates (segmented carapace)
        const pl = [[58, 402, 104, 368, 150, 372, 164, 408, 150, 446, 104, 462, 60, 450]];
        for (let s = 0; s < 2; s++) {
          const pts = s ? mirror(pl[0]) : pl[0];
          const p = shape(pts, true);
          litFill(g, p, OLIVE, { d: 11, rim: acc, rimW: 9, rimA: s ? 0.95 : 0.4, edge: 'rgba(8,12,2,.9)', edgeW: 1.8 });
          inClip(g, p, () => {
            softPoly(g, s ? [320, 380, 300, 372, 262, 380, 280, 390] : [80, 384, 100, 374, 138, 380, 120, 394], '#ffffee', 0.65, 3.5);
            g.strokeStyle = 'rgba(8,12,2,.45)'; g.lineWidth = 1.2;
            for (let i = 1; i < 4; i++) { g.beginPath(); trace(g, pts.slice(0, 0).concat(s ? [400 - 70, 384 + i * 14, 400 - 110, 372 + i * 16, 400 - 150, 380 + i * 14] : [70, 384 + i * 14, 110, 372 + i * 16, 150, 380 + i * 14]), false); g.stroke(); }
            for (let i = 0; i < 16; i++) { const x = (s ? 400 - 160 : 60) + R() * 100, y = 376 + R() * 80; g.fillStyle = 'rgba(8,12,2,.45)'; g.beginPath(); g.arc(x, y, 1.2 + R() * 1.1, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,220,.4)'; g.beginPath(); g.arc(x - 0.7, y - 0.7, 0.6, 0, TAU); g.fill(); }
          });
          // rust joint at the plate edge
          g.strokeStyle = RUST.mid; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[10], pts[11]); g.quadraticCurveTo(pts[12] + (s ? 6 : -6), pts[13] + 4, pts[0] + (s ? -8 : 8), pts[1] + 2); g.stroke();
        }
        // central chest plate
        const ch = shape([156, 376, 244, 376, 268, 438, 238, 520, 162, 520, 132, 438], true);
        litFill(g, ch, { hi: RUST.mid, mid: RUST.lo, lo: '#3a1808', sh: '#1a0a02' }, { d: 10, rim: acc, rimW: 8, rimA: 0.7, edge: 'rgba(20,6,2,.9)', edgeW: 1.8 });
        inClip(g, ch, () => {
          softPoly(g, [170, 384, 200, 380, 196, 440, 176, 430], '#ffd8a0', 0.4, 4);
          g.strokeStyle = 'rgba(20,6,2,.5)'; g.lineWidth = 1.6;
          for (let i = 0; i < 5; i++) { g.beginPath(); trace(g, [150 + i * 3, 400 + i * 24, 200, 410 + i * 24, 250 - i * 3, 400 + i * 24], false); g.stroke(); }
        });
        // banner strap + hex medallion
        const strap = shape([92, 404, 160, 416, 240, 444, 320, 482, 384, 514, 372, 542, 308, 510, 230, 476, 150, 446, 84, 432], true, [0, 4, 5, 9]);
        litFill(g, strap, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 4, edge: 'rgba(8,12,2,.8)', edgeW: 1.2, rim: acc, rimW: 4, rimA: 0.5 });
        g.save(); g.translate(200, 436);
        const hex = pshape([0, -17, 15, -8.5, 15, 8.5, 0, 17, -15, 8.5, -15, -8.5]);
        litFill(g, hex, { hi: '#ffe9a8', mid: '#d6a64a', lo: '#7a561a', sh: '#2e1e06' }, { d: 4, edge: 'rgba(30,18,4,.9)', edgeW: 1.4 });
        litFill(g, pshape([0, -9, 7.8, -4.5, 7.8, 4.5, 0, 9, -7.8, 4.5, -7.8, -4.5]), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, spec: 0.7 });
        g.restore();
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head'), tint = T.tint;
        // neck stalk
        const neck = shape([176, 296, 172, 350, 228, 350, 224, 296], true);
        litFill(g, neck, { hi: '#3a4616', mid: '#1c2408', lo: '#0a0e02', sh: '#000' }, { d: 4, rim: acc, rimW: 4, rimA: 0.5 });
        inClip(g, neck, () => { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(172, 306 + i * 9); g.lineTo(228, 306 + i * 9); g.stroke(); } });
        // head capsule
        const hd = shape(symPts(HEAD_HALF), true);
        litFill(g, hd, OLIVE, { d: 15, rim: acc, rimW: 14, rimA: 0.9 });
        inClip(g, hd, () => {
          // frons shield, ridges and cheeks
          const fr = shape(symPts([200, 108, 218, 112, 232, 132, 238, 170, 232, 214, 218, 252, 200, 266]), true);
          fillBase(g, fr, { hi: OLIVE.hi, mid: OLIVE.mid, lo: OLIVE.lo });
          lightPass(g, fr, OLIVE, { d: 8, shade: 0.5, spec: 0.5 });
          g.strokeStyle = 'rgba(14,20,4,.7)'; g.lineWidth = 2.2; g.stroke(fr.path);
          g.strokeStyle = 'rgba(14,20,4,.5)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(200, 120); g.lineTo(200, 262); g.stroke();
          softPoly(g, [176, 120, 196, 114, 196, 200, 182, 220, 176, 170], '#ffffee', 0.5, 3.5);
          softPoly(g, [150, 110, 190, 98, 170, 130, 130, 160], '#ffffee', 0.3, 6);
          softPoly(g, [250, 120, 292, 150, 296, 260, 250, 290, 262, 210], '#04060a', 0.35, 10);
          // clypeus (lower face plate)
          const cl = shape(symPts([200, 252, 222, 256, 238, 272, 232, 292, 200, 304]), true);
          fillBase(g, cl, { hi: OLIVE.mid, mid: OLIVE.lo, lo: '#141d06' });
          lightPass(g, cl, { hi: OLIVE.mid, mid: OLIVE.lo, lo: '#141d06', sh: '#000' }, { d: 6, shade: 0.5, spec: 0.5, rim: acc, rimW: 5, rimA: 0.6 });
          g.strokeStyle = 'rgba(8,12,2,.8)'; g.lineWidth = 1.8; g.stroke(cl.path);
          // rust markings: cheek plates and frontal chevrons
          for (let s = -1; s <= 1; s += 2) {
            softPoly(g, [200 + s * 80, 232, 200 + s * 56, 262, 200 + s * 46, 290, 200 + s * 74, 276], RUST.mid, 0.55, 5);
            softPoly(g, [200 + s * 14, 150, 200 + s * 40, 168, 200 + s * 38, 178, 200 + s * 12, 162], RUST.mid, 0.7, 2);
            softPoly(g, [200 + s * 14, 176, 200 + s * 40, 194, 200 + s * 38, 204, 200 + s * 12, 188], RUST.mid, 0.6, 2);
          }
          // punctation pits
          for (let i = 0; i < 70; i++) {
            const x = 140 + T.pits[i] * 120, y = 110 + hash2(i, 3) * 180;
            if (!pip(hd.pts, x, y)) continue;
            g.fillStyle = 'rgba(10,16,2,.45)'; g.beginPath(); g.arc(x, y, 1.1 + hash2(i, 9) * 1.1, 0, TAU); g.fill();
            g.fillStyle = 'rgba(255,255,210,.35)'; g.beginPath(); g.arc(x - 0.7, y - 0.7, 0.6, 0, TAU); g.fill();
          }
        });
        // ocelli on the crown
        for (let i = 0; i < 3; i++) {
          const x = i === 0 ? 200 : 200 + (i === 1 ? -13 : 13), y = i === 0 ? 112 : 121;
          litFill(g, eshape(x, y, 4.2, 4.2), { hi: '#ffe08a', mid: tint, lo: dark(tint, 0.55), sh: '#1a0e02' }, { d: 1.5, edge: 'rgba(10,8,2,.9)', edgeW: 0.9 });
        }
        // antennal sockets
        for (let s = -1; s <= 1; s += 2) {
          const so = eshape(200 + s * 21, 136, 9.5, 9.5);
          litFill(g, so, { hi: RUST.mid, mid: RUST.lo, lo: '#2a0e04', sh: '#000' }, { d: 3, edge: 'rgba(8,4,2,.9)', edgeW: 1.2 });
        }
        // compound eyes (hex facets)
        const eyes = [EYE_L, EYE_R];
        for (let k = 0; k < 2; k++) {
          const e = eyes[k], sh = { path: new Path2D(), bb: [e.x - e.rx - 4, e.y - e.ry - 4, e.x + e.rx + 4, e.y + e.ry + 4] };
          sh.path.ellipse(e.x, e.y, e.rx, e.ry, e.rot, 0, TAU);
          fillBase(g, sh, { hi: '#5a3a0c', mid: '#241606', lo: '#070402' });
          g.save(); g.clip(sh.path);
          g.translate(e.x, e.y); g.rotate(e.rot);
          const step = 7.2, hh = step * 0.866;
          for (let r = -9, row = 0; r <= 9; r++, row++) for (let c = -6; c <= 6; c++) {
            const x = c * step + (row & 1 ? step / 2 : 0), y = r * hh;
            const d = hypot(x / e.rx, y / e.ry), br = Math.max(0, 1 - d), ph = hash2(c * 31 + k, r * 17);
            const col = mixc('#1a0e04', mixc(tint, '#fff0b0', 0.2), clamp(0.12 + br * 0.55 * (0.6 + ph * 0.6) + (x < 0 && y < 0 ? 0.25 : 0), 0, 1));
            g.fillStyle = col;
            g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * PI / 3 + PI / 6; g.lineTo(x + cos(a) * step * 0.54, y + sin(a) * step * 0.54); } g.closePath(); g.fill();
            g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.8; g.stroke();
          }
          g.restore();
          lightPass(g, sh, { hi: '#5a3a0c', mid: '#241606', lo: '#070402', sh: '#000' }, { d: 9, shade: 0.55, spec: 0, rim: acc, rimW: 8, rimA: 0.8 });
          softPoly(g, [e.x - 22, e.y - 34, e.x - 4, e.y - 38, e.x - 10, e.y - 14, e.x - 24, e.y - 10], '#ffffff', 0.7, 3);
          blob(g, e.x - 14, e.y - 26, 4, 3, '#ffffff', 0.95);
          g.strokeStyle = 'rgba(8,12,2,.95)'; g.lineWidth = 2.6; g.stroke(sh.path);
        }
        // cheek bristles
        g.save(); g.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 14; i++) {
          const x = 200 + s * (58 + R() * 20), y = 250 + R() * 36, a = (s > 0 ? 0.2 : PI - 0.2) + s * (R() - 0.3) * 0.7;
          g.strokeStyle = R() > 0.5 ? 'rgba(210,190,120,.7)' : 'rgba(80,60,20,.7)'; g.lineWidth = 1.1;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + cos(a) * (9 + R() * 8), y + sin(a) * (9 + R() * 8)); g.stroke();
        }
        g.restore();
      },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph;
        // eye glints
        const eyes = [EYE_L, EYE_R];
        for (let k = 0; k < 2; k++) {
          const e = eyes[k];
          g.save(); g.beginPath(); g.ellipse(e.x, e.y, e.rx - 1, e.ry - 1, e.rot, 0, TAU); g.clip();
          const sweep = ((t * 0.28 + ph[3] * 0.2 + k * 0.3) % 2.2) - 0.5, x = e.x - e.rx * 1.6 + sweep * e.rx * 2.4;
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = lg(g, x - 18, e.y - 30, x + 18, e.y + 30, [0, 'rgba(255,230,150,0)', 0.5, 'rgba(255,236,170,' + (0.4 * m.glow).toFixed(3) + ')', 1, 'rgba(255,230,150,0)']);
          g.fillRect(e.x - e.rx - 4, e.y - e.ry - 4, e.rx * 2 + 8, e.ry * 2 + 8);
          const red = Math.max(0, m.brow) * 0.4, warm = (m.glow - 1) * 0.5;
          if (red > 0.02) { g.fillStyle = 'rgba(255,50,20,' + (red * 0.55).toFixed(3) + ')'; g.fillRect(e.x - e.rx - 4, e.y - e.ry - 4, e.rx * 2 + 8, e.ry * 2 + 8); }
          if (warm > 0.02) { g.fillStyle = 'rgba(255,190,80,' + (warm * 0.35).toFixed(3) + ')'; g.fillRect(e.x - e.rx - 4, e.y - e.ry - 4, e.rx * 2 + 8, e.ry * 2 + 8); }
          if (m.glow < 0.95) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(0,0,0,' + ((1 - m.glow) * 0.5).toFixed(3) + ')'; g.fillRect(e.x - e.rx - 4, e.y - e.ry - 4, e.rx * 2 + 8, e.ry * 2 + 8); }
          g.restore();
        }
        brow(g, -1, A, T); brow(g, 1, A, T);
        // mouthparts: palps wiggle between the mandibles
        const open = clamp(m.open * 0.7 + A.talk * 1.0, 0, 1);
        g.save();
        blob(g, 200, 306, 12 + open * 12, 7 + open * 16, '#0a0402', 0.9);
        g.lineCap = 'round';
        for (let s = -1; s <= 1; s += 2) {
          const wob = sin(t * 7 + s + ph[0]) * (1.5 + open * 3);
          g.strokeStyle = '#1a2208'; g.lineWidth = 4.4; g.beginPath(); g.moveTo(200 + s * 6, 298); g.quadraticCurveTo(200 + s * (8 + open * 5) + wob, 314, 200 + s * (4 + open * 7) + wob * 1.3, 326 + open * 8); g.stroke();
          g.strokeStyle = OLIVE.mid; g.lineWidth = 2.8; g.stroke();
        }
        g.restore();
        mandible(g, -1, open, T); mandible(g, 1, open, T);
        antenna(g, -1, A, T); antenna(g, 1, A, T);
      }
    };
  })();

  /* ======================================================================= MEKLAR */
  PAINT.meklar = (function () {
    const SKIN = { hi: '#ecdfce', mid: '#c2b19e', lo: '#7f6e62', sh: '#35272b', blush: '#c58c86', lip: '#b8726c' };
    const STEEL = { hi: '#e6eef8', mid: '#93a0b2', lo: '#485364', sh: '#10141c' };
    const DARKM = { hi: '#6e7a8c', mid: '#38404f', lo: '#181c26', sh: '#06080c' };
    const RUST = '#a8521c';
    const HALF = [200, 96, 238, 99, 268, 116, 284, 148, 288, 188, 286, 226, 276, 258, 258, 288, 232, 310, 200, 318];
    const METAL = [214, 92, 240, 96, 271, 114, 288, 148, 292, 188, 290, 226, 280, 259, 262, 290, 234, 314, 200, 324, 191, 300, 200, 270, 197, 236, 193, 208, 202, 172, 208, 130, 212, 100];
    const OPT = { x: 241, y: 206, r: 23 };

    function rivet(g, x, y, r) {
      litFill(g, eshape(x, y, r, r), STEEL, { d: r * 0.5, edge: 'rgba(8,10,14,.85)', edgeW: 0.8, shade: 0.5, spec: 0.7 });
    }
    function brushed(g, sh, R, n, a) {
      strokes(g, sh, n, { cols: ['#ffffff', '#dfe8f4', '#0a0e16', '#1a2230'], len: [30, 110], w: [0.5, 1.1], a: [0.03, a || 0.12], ang: 0, jit: 0.04, curve: 0.02 }, R);
    }
    function rustPatch(g, sh, R, n) {
      inClip(g, sh, () => {
        for (let i = 0; i < n; i++) {
          const bb = sh.bb, x = bb[0] + R() * (bb[2] - bb[0]), y = bb[1] + R() * (bb[3] - bb[1]), r = 3 + R() * 9;
          blob(g, x, y, r * 1.6, r, R() > 0.5 ? RUST : '#7a3a14', 0.28 + R() * 0.22, R() * PI);
        }
      });
    }
    function hose(g, pts, w, col, sleeves) {
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      const path = () => { g.beginPath(); trace(g, pts, false); };
      path(); g.strokeStyle = '#05070a'; g.lineWidth = w + 4; g.stroke();
      path(); g.strokeStyle = col; g.lineWidth = w; g.stroke();
      g.save(); g.translate(-1.4, -1.4); path(); g.strokeStyle = 'rgba(190,210,230,.55)'; g.lineWidth = w * 0.22; g.stroke(); g.restore();
      path(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = w * 0.3; g.save(); g.translate(w * 0.28, w * 0.28); g.stroke(); g.restore();
      // sleeves / clamps along the hose (sample via bezier through the polyline)
      if (sleeves) for (let k = 0; k < sleeves.length; k++) {
        const u = sleeves[k], n = pts.length / 2 - 1, i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i;
        const x = lerp(pts[i * 2], pts[i * 2 + 2], f), y = lerp(pts[i * 2 + 1], pts[i * 2 + 3], f), a = atan2(pts[i * 2 + 3] - pts[i * 2 + 1], pts[i * 2 + 2] - pts[i * 2]);
        g.save(); g.translate(x, y); g.rotate(a);
        const sl = pshape([-5, -w / 2 - 2.5, 5, -w / 2 - 2.5, 5, w / 2 + 2.5, -5, w / 2 + 2.5]);
        litFill(g, sl, k % 2 ? STEEL : { hi: '#ffb070', mid: RUST, lo: '#5a2a0c', sh: '#1a0a02' }, { d: 2.2, edge: 'rgba(8,10,14,.9)', edgeW: 1 });
        g.restore();
      }
      g.restore();
    }

    function optic(g, A, T, pulse) {
      const m = A.m, t = A.t, x = OPT.x, y = OPT.y, R = OPT.r;
      const gl = m.glow * pulse;
      glow(g, '#ff2a1a', x, y, 64 * (0.85 + 0.15 * gl), 0.5 * gl);
      glow(g, '#ff7a4a', x, y, 32, 0.4 * gl);
      g.save();
      g.beginPath(); g.arc(x, y, R, 0, TAU); g.clip();
      g.fillStyle = rgd(g, x, y, 1, R, [0, '#fff4e0', 0.18, '#ff8a52', 0.5, '#e02418', 0.82, '#7a0808', 1, '#200202']); g.fill();
      // aperture blades closing with blink / mood
      const ap = R * clamp(0.42 + m.pup * 0.1 - A.blink * 0.4 - Math.max(0, m.lid) * 0.12 + Math.max(0, -m.lid) * 0.1, 0.05, 0.7);
      const rot = t * 0.35 + A.ph[2];
      for (let k = 0; k < 8; k++) {
        const a = rot + k * PI / 4, d = PI / 4 + 0.05, tw = 0.5;
        g.beginPath();
        g.moveTo(x + cos(a) * (R + 2), y + sin(a) * (R + 2)); g.lineTo(x + cos(a + d) * (R + 2), y + sin(a + d) * (R + 2));
        g.lineTo(x + cos(a + d + tw) * ap, y + sin(a + d + tw) * ap); g.lineTo(x + cos(a + tw) * ap, y + sin(a + tw) * ap); g.closePath();
        g.fillStyle = lg(g, x + cos(a) * R, y + sin(a) * R, x + cos(a + tw) * ap, y + sin(a + tw) * ap, [0, '#5a6678', 0.6, '#2c3442', 1, '#12161e']); g.fill();
        g.strokeStyle = 'rgba(200,215,235,.35)'; g.lineWidth = 0.7; g.stroke();
      }
      // hot core
      glow(g, '#ffffff', x + A.lx * 3, y + A.ly * 2, ap * 1.3 + 3, 0.8 * gl);
      // scan line
      const sy = y + sin(t * 1.7 + A.ph[1]) * R * 0.85;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg(g, x - R, 0, x + R, 0, [0, 'rgba(255,120,80,0)', 0.5, 'rgba(255,190,150,' + (0.55 * gl).toFixed(3) + ')', 1, 'rgba(255,120,80,0)']); g.fillRect(x - R, sy - 0.8, R * 2, 1.6);
      g.restore();
      // rotating red arc + glass
      g.save(); g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
      g.strokeStyle = rgba('#ff5a3a', 0.65 * gl); g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, R + 4.5, -t * 0.9, -t * 0.9 + 1.1); g.stroke();
      g.strokeStyle = rgba('#ff5a3a', 0.35 * gl); g.beginPath(); g.arc(x, y, R + 4.5, -t * 0.9 + PI, -t * 0.9 + PI + 0.5); g.stroke();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - 8, y - 10, 7, 3.2, -0.7, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(x + 8, y + 10, 4, 1.8, -0.7, 0, TAU); g.fill();
    }

    function metalBrow(g, A, T) {
      const m = A.m, as = m.bAsym * 3;
      const xi = 214, xo = 290, yi = 177 + m.brow * 12 - m.browY * 8 + as, yo = 166 - m.brow * 5 - m.browY * 6 + as * 0.6;
      const cx = (xi + xo) / 2, cy = (yi + yo) / 2 - 5;
      g.save();
      g.beginPath(); taper(g, xi, yi + 5, cx, cy + 5, xo, yo + 6, 14, 10, 8);
      g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 5; g.fillStyle = 'rgba(0,0,0,.5)'; g.fill(); g.shadowBlur = 0;
      g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, 17, 12, 9);
      g.fillStyle = lg(g, 0, cy - 10, 0, cy + 9, [0, STEEL.hi, 0.35, STEEL.mid, 1, STEEL.lo]); g.fill();
      g.strokeStyle = 'rgba(6,8,12,.9)'; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(xi + 3, yi - 6); g.quadraticCurveTo(cx, cy - 7, xo - 3, yo - 4); g.stroke();
      // red LED strip
      const lx0 = lerp(xi, xo, 0.2), lx1 = lerp(xi, xo, 0.8), ly0 = lerp(yi, yo, 0.2) + 2, ly1 = lerp(yi, yo, 0.8) + 2;
      g.strokeStyle = rgba('#ff4a2a', 0.5 + 0.4 * m.glow * (0.8 + 0.2 * sin(A.t * 3))); g.lineWidth = 2.4; g.beginPath(); g.moveTo(lx0, ly0); g.lineTo(lx1, ly1); g.stroke();
      g.restore();
      glow(g, '#ff3a1a', (lx0 + lx1) / 2, (ly0 + ly1) / 2, 28, 0.25 * m.glow);
    }

    return {
      accent: '#ff6a4a', bg: '#2a2230', defColor: '#d0903a', pivot: [200, 340], badge: [200, 208, 138],
      traits: function (P) {
        const v = P.variant, ic = ['#7aa0c8', '#8a9a5a', '#a8683a', '#9aa0a8'][v % 4];
        return {
          head: shape(symPts(HALF), true), metal: shape(METAL, true), stitches: 8 + (v % 3) * 2, rustK: 1 + (v % 3),
          eye: { w: 21, h: 11.5, lowR: 0.5, sc0: '#e4dcd2', sc1: '#b0a49c', ir: 10.5, pr: 0.45, pc: '#08080a', i0: lite(ic, 0.4), i1: ic, i2: dark(ic, 0.6),
            lash: '#2a2024', lashW: 2.3, wing: 1.2, crease: 0.45, creaseCol: SKIN.sh, lowerLine: 0.3, water: true, pupil: 'round' },
          brow: { y: 184, dy: 4, xi: 18, xo: 70, arch: 7, w0: 9.5, w1: 4.6, kb: 8.5, kr: 8, hi: '#6a6670', mid: '#3e3b44', lo: '#1c1a20', sl: 'rgba(170,170,180,.45)', sd: 'rgba(8,8,10,.55)', n: 24 }
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const torso = shape([168, 348, 120, 358, 68, 376, 26, 404, -16, 440, -16, 516, 416, 516, 416, 440, 374, 404, 332, 376, 280, 358, 232, 348, 200, 358], true, [5, 6]);
        litFill(g, torso, DARKM, { rim: lite(acc, 0.1), rimW: 12, rimA: 0.75, d: 15 });
        inClip(g, torso, () => {
          blob(g, 100, 400, 70, 24, DARKM.hi, 0.5, -0.32);
          blob(g, 330, 440, 70, 52, '#000', 0.45);
          // padded seams of the suit
          g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.setLineDash([5, 4]);
          g.beginPath(); trace(g, [150, 380, 160, 430, 150, 520], false); g.moveTo(250, 380); trace(g, [250, 380, 240, 430, 250, 520], false); g.stroke(); g.setLineDash([]);
          // chest plate
          const cp = shape([146, 384, 254, 384, 270, 450, 236, 516, 164, 516, 130, 450], true, [0, 1, 3, 4]);
          litFill(g, cp, STEEL, { d: 9, rim: acc, rimW: 8, rimA: 0.65, edge: 'rgba(6,8,12,.9)', edgeW: 1.8 });
          brushed(g, cp, R, 120, 0.12);
          inClip(g, cp, () => {
            g.strokeStyle = 'rgba(6,8,12,.6)'; g.lineWidth = 1.6;
            g.beginPath(); g.moveTo(150, 430); g.lineTo(250, 430); g.moveTo(200, 384); g.lineTo(200, 516); g.stroke();
            blob(g, 168, 400, 26, 14, '#ffffff', 0.4, -0.4);
          });
          rustPatch(g, cp, R, 6);
          // glowing status strip
          g.save(); g.fillStyle = '#2a0808'; g.fillRect(170, 452, 60, 8);
          g.fillStyle = rgba('#ff4a2a', 0.9); g.fillRect(172, 454, 30, 4); g.fillStyle = rgba('#ff4a2a', 0.45); g.fillRect(204, 454, 22, 4); g.restore();
          for (const p of [[152, 392], [248, 392], [140, 450], [260, 450], [168, 506], [232, 506]]) rivet(g, p[0], p[1], 3.2);
        });
        // harness strap in banner colour
        const strap = pshape([98, 376, 124, 358, 384, 482, 372, 514]);
        litFill(g, strap, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 5, edge: 'rgba(6,8,12,.85)', edgeW: 1.4, rim: acc, rimW: 4, rimA: 0.5 });
        inClip(g, strap, () => { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; for (let i = 0; i < 60; i++) { const x = 110 + i * 5; g.beginPath(); g.moveTo(x, 360 + i * 2.4); g.lineTo(x - 10, 384 + i * 2.4); g.stroke(); } });
        for (let i = 0; i < 4; i++) { const u = 0.15 + i * 0.22; rivet(g, lerp(111, 378, u), lerp(366, 498, u), 3.4); }
        // buckle
        const bk = pshape([178, 424, 222, 424, 222, 446, 178, 446]);
        litFill(g, bk, STEEL, { d: 4, edge: 'rgba(6,8,12,.9)', edgeW: 1.6 });
        litFill(g, pshape([186, 430, 214, 430, 214, 440, 186, 440]), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, spec: 0.7 });
        // pauldrons
        const pr = shape([262, 372, 312, 354, 360, 372, 388, 414, 384, 468, 334, 452, 286, 424], true);
        litFill(g, pr, STEEL, { d: 12, rim: acc, rimW: 10, rimA: 0.95, edge: 'rgba(6,8,12,.9)', edgeW: 2 });
        brushed(g, pr, R, 160, 0.14);
        inClip(g, pr, () => {
          g.strokeStyle = 'rgba(6,8,12,.55)'; g.lineWidth = 2;
          g.beginPath(); trace(g, [270, 398, 320, 380, 376, 400], false); g.stroke();
          g.beginPath(); trace(g, [286, 426, 330, 414, 380, 436], false); g.stroke();
          softPoly(g, [276, 382, 316, 364, 350, 376, 316, 386], '#ffffff', 0.5, 4);
        });
        rustPatch(g, pr, R, 10);
        const stripe = pshape([300, 360, 326, 356, 352, 450, 322, 446]);
        inClip(g, pr, () => { litFill(g, stripe, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 4, shade: 0.4, spec: 0.35 }); });
        for (const p of [[292, 392], [330, 376], [362, 394], [370, 436], [336, 440], [296, 420]]) rivet(g, p[0], p[1], 3.6);
        const pl = shape([140, 372, 90, 354, 42, 374, 14, 414, 16, 470, 66, 454, 114, 424], true);
        litFill(g, pl, { hi: '#586072', mid: '#2c323e', lo: '#12151c', sh: '#04060a' }, { d: 11, rim: acc, rimW: 8, rimA: 0.3, edge: 'rgba(4,6,10,.9)', edgeW: 2 });
        inClip(g, pl, () => { softPoly(g, [100, 372, 70, 372, 36, 392, 70, 392], '#9db0c8', 0.35, 5); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.beginPath(); trace(g, [120, 400, 70, 396, 24, 420], false); g.stroke(); });
        for (const p of [[100, 372], [60, 382], [30, 410]]) rivet(g, p[0], p[1], 3.2);
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        softPoly(g, [112, 346, 288, 346, 300, 384, 200, 408, 100, 384], '#000', 0.5, 7);
        const outer = [116, 342, 142, 372, 200, 388, 258, 372, 284, 342], inner = [270, 336, 248, 354, 200, 366, 152, 354, 130, 336];
        const gp = shape(outer.concat(inner), true, [0, 4, 5, 9]);
        litFill(g, gp, STEEL, { d: 6, rim: acc, rimW: 7, rimA: 0.95, edge: 'rgba(6,8,12,.95)', edgeW: 1.8 });
        brushed(g, gp, P.rng('collar'), 80, 0.14);
        inClip(g, gp, () => { g.strokeStyle = 'rgba(6,8,12,.5)'; g.lineWidth = 1.4; for (let i = 0; i < 7; i++) { const x = 140 + i * 20; g.beginPath(); g.moveTo(x, 346 + sin((x - 140) / 120 * PI) * 22); g.lineTo(x + 4, 376 + sin((x - 140) / 120 * PI) * 12); g.stroke(); } });
        g.save(); g.strokeStyle = rgba('#ff4a2a', 0.85); g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); trace(g, [148, 358, 176, 372, 200, 376, 224, 372, 252, 358], false); g.stroke(); g.restore();
        glow(g, '#ff4a2a', 200, 374, 36, 0.28);
        for (const p of [[128, 346], [150, 368], [250, 368], [272, 346]]) rivet(g, p[0], p[1], 3.2);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head'), C = P.color;
        // neck: organic left, steel right
        const neck = shape([167, 280, 162, 330, 158, 384, 242, 384, 238, 330, 233, 280], true, [2, 3]);
        litFill(g, neck, { hi: SKIN.mid, mid: SKIN.lo, lo: mixc(SKIN.lo, SKIN.sh, 0.5), sh: SKIN.sh }, { rim: acc, rimA: 0.4, rimW: 6, spec: 0 });
        inClip(g, neck, () => {
          blob(g, 200, 322, 82, 30, SKIN.sh, 0.8);
          const sl = pshape([204, 290, 240, 290, 240, 390, 204, 390]);
          litFill(g, sl, DARKM, { d: 5, rim: acc, rimW: 6, rimA: 0.8 });
          brushed(g, sl, R, 50, 0.1);
          g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2;
          for (let i = 0; i < 5; i++) { const y = 300 + i * 17; g.beginPath(); g.moveTo(204, y); g.lineTo(240, y); g.stroke(); g.strokeStyle = 'rgba(150,170,200,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(204, y + 1.6); g.lineTo(240, y + 1.6); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.7)'; g.lineWidth = 2; }
          blob(g, 200, 352, 8, 22, '#000', 0.3);
        });
        // ear (organic) and the cranial port on the metal side
        const earL = [127, 196, 116, 199, 110, 214, 113, 233, 123, 247, 135, 241, 136, 208];
        const ear = shape(earL, true);
        litFill(g, ear, { hi: SKIN.mid, mid: SKIN.lo, lo: mixc(SKIN.lo, SKIN.sh, 0.4), sh: SKIN.sh }, { d: 4 });
        // head base (organic)
        const hd = T.head;
        litFill(g, hd, SKIN, { rim: acc, rimW: 12, rimA: 0.5, d: 13 });
        inClip(g, hd, () => {
          softPoly(g, [126, 160, 150, 118, 196, 100, 200, 136, 156, 170, 142, 214, 136, 250, 124, 226], '#fff6e6', 0.34, 14);
          softPoly(g, [236, 108, 296, 118, 298, 274, 262, 312, 232, 318, 244, 266, 241, 204, 240, 150], SKIN.sh, 0.4, 15);
          blob(g, 146, 242, 30, 22, SKIN.hi, 0.34);
          const sock = mixc(SKIN.lo, '#4a2a50', 0.3);
          softPoly(g, [130, 198, 160, 184, 188, 194, 190, 216, 160, 228, 132, 216], sock, 0.4, 7);
          softPoly(g, [134, 184, 190, 176, 192, 190, 136, 198], SKIN.sh, 0.32, 5);
          // nose (left side visible)
          softPoly(g, [193, 194, 199, 196, 200, 238, 197, 254, 192, 244, 191, 214], '#fff6e8', 0.4, 3);
          softPoly(g, [186, 214, 190, 214, 191, 244, 182, 257, 179, 244], SKIN.sh, 0.22, 3);
          softPoly(g, [177, 250, 186, 243, 193, 256, 188, 267, 179, 263], SKIN.sh, 0.42, 2.4);
          softPoly(g, [189, 267, 205, 267, 205, 276, 192, 276], SKIN.sh, 0.5, 2.6);
          blob(g, 195, 252, 7, 5, '#ffffff', 0.4);
          g.fillStyle = 'rgba(48,16,18,.5)'; g.beginPath(); g.ellipse(191.5, 264.5, 4.2, 2, -0.25, 0, TAU); g.fill();
          softPoly(g, [182, 301, 218, 301, 213, 311, 187, 311], SKIN.sh, 0.34, 4);
          blob(g, 194, 309, 15, 8, SKIN.hi, 0.3);
          softPoly(g, [264, 262, 254, 298, 230, 316, 206, 320, 234, 296, 250, 268], SKIN.sh, 0.4, 6);
          // stubble on the organic jaw
          strokes(g, hd, 500, { cols: ['#4a4650', '#2c2a30', '#6a6670'], len: [1.5, 4], w: [0.7, 1.2], a: [0.18, 0.5], ang: 1.2, jit: 2.4, bb: [128, 240, 206, 316] }, R);
          // buzz-cut scalp
          strokes(g, hd, 380, { cols: ['#3a3640', '#58545e', '#26242a'], len: [3, 7], w: [0.8, 1.3], a: [0.3, 0.75], flow: (x, y) => atan2(y - 190, x - 200), jit: 0.4, bb: [124, 90, 206, 150] }, R);
          // veins and age
          g.strokeStyle = 'rgba(90,70,110,.2)'; g.lineWidth = 1.2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(140, 148); g.quadraticCurveTo(150, 160, 146, 178); g.moveTo(138, 232); g.quadraticCurveTo(144, 246, 160, 252); g.stroke();
          g.strokeStyle = rgba(SKIN.sh, 0.13); g.lineWidth = 1.7;
          for (let i = 0; i < 2; i++) { const y = 128 + i * 12; g.beginPath(); g.moveTo(148 + i * 3, y + 3); g.bezierCurveTo(166, y - 3, 184, y + 3, 198, y - 1); g.stroke(); }
        });
        // metal half: plates over the right side
        const mt = T.metal;
        litFill(g, mt, STEEL, { d: 10, rim: acc, rimW: 12, rimA: 0.95, edge: 'rgba(6,8,12,.95)', edgeW: 2 });
        brushed(g, mt, R, 420, 0.13);
        inClip(g, mt, () => {
          softPoly(g, [214, 100, 260, 104, 240, 140, 214, 150], '#ffffff', 0.4, 8);
          softPoly(g, [260, 220, 296, 200, 296, 300, 262, 320, 270, 264], '#04060a', 0.5, 10);
          g.strokeStyle = 'rgba(6,8,12,.7)'; g.lineWidth = 2.2; g.lineCap = 'round';
          g.beginPath(); trace(g, [210, 134, 250, 140, 290, 152], false); g.stroke();
          g.beginPath(); trace(g, [204, 236, 250, 236, 288, 248], false); g.stroke();
          g.beginPath(); trace(g, [206, 288, 240, 296, 274, 286], false); g.stroke();
          g.strokeStyle = 'rgba(190,210,235,.4)'; g.lineWidth = 1;
          g.beginPath(); trace(g, [210, 136.5, 250, 142.5, 290, 154.5], false); g.stroke();
          g.beginPath(); trace(g, [204, 238.5, 250, 238.5, 288, 250.5], false); g.stroke();
          g.beginPath(); g.moveTo(262, 104); g.lineTo(256, 138); g.moveTo(240, 238); g.lineTo(236, 296); g.stroke();
          // vents / grille on the cheek plate
          for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(4,6,10,.8)'; g.fillRect(224, 258 + i * 6, 34 - i * 2, 2.6); g.fillStyle = 'rgba(190,210,235,.3)'; g.fillRect(224, 260.6 + i * 6, 34 - i * 2, 0.8); }
        });
        rustPatch(g, mt, R, 8 * T.rustK);
        for (const p of [[216, 108], [258, 112], [284, 150], [214, 142], [288, 238], [212, 244], [214, 292], [268, 284], [250, 140]]) rivet(g, p[0], p[1], 3.1);
        // orbital bezel + socket for the optic
        const bz = eshape(OPT.x, OPT.y, 36, 33);
        litFill(g, bz, STEEL, { d: 7, rim: acc, rimW: 6, rimA: 0.9, edge: 'rgba(6,8,12,.95)', edgeW: 2 });
        brushed(g, bz, R, 40, 0.1);
        g.strokeStyle = 'rgba(6,8,12,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(OPT.x, OPT.y, 30, 0, TAU); g.stroke();
        for (let i = 0; i < 12; i++) { const a = i * PI / 6; g.beginPath(); g.moveTo(OPT.x + cos(a) * 30, OPT.y + sin(a) * 30); g.lineTo(OPT.x + cos(a) * 33.5, OPT.y + sin(a) * 33.5); g.stroke(); }
        const sock = eshape(OPT.x, OPT.y, 27, 27);
        fillBase(g, sock, { hi: '#1a1e28', mid: '#07080c', lo: '#000' });
        crescent(g, sock, 4, 4, '#000', 0.9, 4);
        // stitches along the organic/metal seam
        g.save(); g.lineCap = 'round'; g.strokeStyle = '#1c1618'; g.lineWidth = 1.5;
        const sb = [210, 106, 207, 130, 202, 170, 194, 206, 197, 236, 200, 268, 193, 300];
        for (let i = 0; i < T.stitches; i++) {
          const u = (i + 0.5) / T.stitches, idx = Math.min(sb.length / 2 - 2, Math.floor(u * (sb.length / 2 - 1))), f = u * (sb.length / 2 - 1) - idx;
          const x = lerp(sb[idx * 2], sb[idx * 2 + 2], f), y = lerp(sb[idx * 2 + 1], sb[idx * 2 + 3], f);
          g.beginPath(); g.moveTo(x - 8, y - 2.5); g.lineTo(x + 1, y + 2.5); g.moveTo(x - 8, y + 2.5); g.lineTo(x + 1, y - 2.5); g.stroke();
        }
        g.restore();
        // temple stud + scar on the organic cheek
        rivet(g, 132, 170, 3.4);
        g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(120,60,60,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(138, 226); g.quadraticCurveTo(150, 246, 158, 270); g.stroke();
        g.strokeStyle = 'rgba(30,14,16,.7)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { const t = 0.12 + i * 0.19, x = 138 + t * 20 + 2, y = 226 + t * 44; g.beginPath(); g.moveTo(x - 3, y - 2); g.lineTo(x + 3, y + 2); g.stroke(); } g.restore();
        // cranial hoses on the metal side (static)
        hose(g, [286, 168, 316, 196, 330, 252, 312, 316, 270, 366], 12, '#1a1e26', [0.18, 0.5, 0.82]);
        hose(g, [284, 190, 306, 214, 314, 262, 300, 322, 262, 372], 9, '#222832', [0.3, 0.7]);
        g.save(); g.lineCap = 'round';
        const wires = ['#ff4a3a', '#3aa0ff', '#ffd04a', '#e8eef4'];
        for (let k = 0; k < 4; k++) { g.strokeStyle = wires[k]; g.lineWidth = 1.6; g.beginPath(); g.moveTo(288, 176 + k * 3); g.bezierCurveTo(338 + k * 3, 206, 342 + k * 2, 266, 300 + k * 3, 340 + k); g.stroke(); }
        g.restore();
        rivet(g, 286, 170, 4.4); rivet(g, 284, 192, 4.4);
      },

      fore: function (g, P, T) { },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, e = T.eye;
        const open = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.1, 0, 1.2);
        const st = { dir: 1, ti: m.brow * 2.4, to: -m.brow * 0.8, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        drawEye(g, 160, 206, e, st);
        const flick = m.glow < 0.9 && hash2(Math.floor(t * 16), A.seed) > 0.82 ? 0.55 : 1;
        optic(g, A, T, (0.9 + 0.1 * sin(t * 2.3 + A.ph[0]) + A.talk * 0.3) * flick);
        // organic frown/age lines
        const ba = Math.max(0, m.brow), wa = Math.max(0, -m.brow) * 0.6 + Math.max(0, m.browY) * 0.5;
        g.save(); g.lineCap = 'round';
        if (ba > 0.02) { g.strokeStyle = rgba(SKIN.sh, 0.4 * ba); g.lineWidth = 2; g.beginPath(); g.moveTo(190, 176); g.quadraticCurveTo(188, 186, 190, 194); g.stroke(); }
        if (wa > 0.02) { g.strokeStyle = rgba(SKIN.sh, 0.24 * Math.min(1, wa)); g.lineWidth = 1.7; for (let i = 0; i < 2; i++) { const y = 134 + i * 12 - m.browY * 4; g.beginPath(); g.moveTo(148 + i * 4, y + 2); g.quadraticCurveTo(176, y - 4, 200, y + 1); g.stroke(); } }
        g.restore();
        browRig(g, -1, A, T.brow);
        metalBrow(g, A, T);
        // mouth: organic left half, steel right half
        const base = { my: 284, mw: 26, mwk: 3.5, smk: 5.5, talkw: 2.5, openk: 0.35, drop: 13.5, thU: 7.4, thL: 11.5, bow: 1.9, teeth: true, tongue: '#c4565f' };
        g.save(); g.beginPath(); g.rect(0, 0, 200, H); g.clip();
        mouthRig(g, A, Object.assign({}, base, { lipU: mixc(SKIN.lip, SKIN.sh, 0.3), lipL: SKIN.lip, inside: '#2b0d11', line: 'rgba(40,12,16,.62)', corner: 'rgba(40,12,16,.5)' }));
        g.restore();
        g.save(); g.beginPath(); g.rect(200, 0, 200, H); g.clip();
        const r = mouthRig(g, A, Object.assign({}, base, { lipU: '#8e9bab', lipL: '#a9b6c6', inside: '#07080c', line: 'rgba(4,6,10,.9)', corner: 'rgba(4,6,10,.7)', teeth: false, tongue: null }));
        if (r.op > 0.05) glow(g, '#ff3a1a', 226, 284 + r.op * 9, 22, 0.55 * r.op + 0.2 * A.talk);
        g.restore();
        g.strokeStyle = 'rgba(6,8,12,.85)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(200, 276); g.lineTo(200, 300); g.stroke();
        // cybernetic scan beam sweeping the face
        const sy = 100 + ((t * 0.32 + A.ph[4] * 0.1) % 1.6) * 150;
        if (sy < 330) {
          g.save(); g.clip(T.head.path); g.globalCompositeOperation = 'lighter';
          g.fillStyle = lg(g, 0, sy - 10, 0, sy + 10, [0, 'rgba(255,60,40,0)', 0.5, 'rgba(255,90,60,' + (0.16 * m.glow).toFixed(3) + ')', 1, 'rgba(255,60,40,0)']); g.fillRect(100, sy - 10, 200, 20);
          g.restore();
        }
      }
    };
  })();

  /* ======================================================================= MRRSHAN */
  PAINT.mrrshan = (function () {
    const ORANGE = { hi: '#ffb866', mid: '#ee7c24', lo: '#a8440e', sh: '#3a1304' };
    const CREAM = { hi: '#fffaf0', mid: '#f2e6cc', lo: '#bda888', sh: '#4a3a28' };
    const GOLD = { hi: '#fff3c4', mid: '#efc45c', lo: '#a07622', sh: '#4c340c' };
    const TEAL = { hi: '#2f8a96', mid: '#17505e', lo: '#0a2c38', sh: '#02121a' };
    const OR_COLS = ['#a8440e', '#c25a14', '#d86c1a', '#ee7c24', '#f58e38', '#ffa650'];
    const CR_COLS = ['#d9c9a8', '#ebdfc4', '#f6eddb', '#fffaf0'];
    const HEAD = [200, 112, 242, 117, 278, 137, 304, 170, 322, 212, 316, 252, 292, 286, 258, 310, 228, 324, 200, 330];
    const FACE_W = [200, 186, 232, 190, 262, 212, 288, 242, 298, 274, 278, 302, 242, 322, 200, 328];

    function cluster(g, x, y, ang, len, R, cols, n, wd) {
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = ang + (R() - 0.5) * 0.6, L = len * (0.65 + R() * 0.5), bend = (R() - 0.5) * L * 0.5, ex = x + cos(a) * L, ey = y + sin(a) * L;
        g.strokeStyle = cols[(R() * cols.length) | 0]; g.lineWidth = (wd || 3.4) * (0.75 + R() * 0.5);
        g.beginPath(); g.moveTo(x + (R() - 0.5) * 6, y + (R() - 0.5) * 6); g.quadraticCurveTo((x + ex) / 2 - sin(a) * bend, (y + ey) / 2 + cos(a) * bend, ex, ey); g.stroke();
      }
    }
    function stripe(g, x0, y0, cx, cy, x1, y1, w0) {
      g.save(); g.beginPath(); taper(g, x0, y0, cx, cy, x1, y1, w0, 1.4, 8);
      g.shadowColor = '#140804'; g.shadowBlur = 2.6; g.fillStyle = 'rgba(20,8,4,.93)'; g.fill(); g.restore();
    }

    function catMouth(g, A, T) {
      const m = A.m, sm = m.smile, as = m.asym, op = clamp(m.open * 0.9 + A.talk, 0, 1), my = 268;
      const cl = my + 11 - sm * 9 + as * 2, cr = my + 11 - sm * 9 - as * 6, wd = 36 + sm * 3 - A.talk * 3;
      const dropY = op * 24;
      g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
      const upper = (s) => { g.moveTo(200, my); g.bezierCurveTo(200 + s * wd * 0.2, my + 9, 200 + s * wd * 0.6, my + 11, 200 + s * wd, s < 0 ? cl : cr); };
      if (op > 0.04) {
        g.beginPath(); upper(-1); g.lineTo(200 - wd * 0.9, (cl + dropY * 0.5)); g.bezierCurveTo(200 - wd * 0.5, my + 11 + dropY, 200 - 6, my + 12 + dropY, 200, my + 12 + dropY);
        g.bezierCurveTo(200 + 6, my + 12 + dropY, 200 + wd * 0.5, my + 11 + dropY, 200 + wd * 0.9, cr + dropY * 0.5); g.lineTo(200 + wd, cr);
        g.bezierCurveTo(200 + wd * 0.6, my + 11, 200 + wd * 0.2, my + 9, 200, my); g.closePath();
        g.fillStyle = '#2a0a0e'; g.fill(); g.save(); g.clip();
        blob(g, 200, my + 10 + dropY * 0.8, wd * 0.55, 6 + op * 6, '#d8606c', 0.95);
        g.fillStyle = lg(g, 0, my + 6, 0, my + 6 + 12 + op * 8, [0, '#fffaf0', 1, '#e8dcc2']);
        for (let s = -1; s <= 1; s += 2) {
          const fx = 200 + s * 17;
          g.beginPath(); g.moveTo(fx - 3.4, my + 7); g.lineTo(fx + 3.4, my + 7); g.lineTo(fx, my + 7 + 5 + op * 11); g.closePath(); g.fill();
        }
        g.fillStyle = '#efe4cc'; g.fillRect(200 - 11, my + 7, 22, 3 + op * 3);
        g.fillStyle = '#e8dcc2';
        for (let s = -1; s <= 1; s += 2) { const fx = 200 + s * 15; g.beginPath(); g.moveTo(fx - 2.6, my + 12 + dropY); g.lineTo(fx + 2.6, my + 12 + dropY); g.lineTo(fx, my + 12 + dropY - 4 - op * 5); g.closePath(); g.fill(); }
        g.restore();
      }
      g.strokeStyle = '#140a06'; g.lineWidth = 3.4;
      g.beginPath(); upper(-1); g.stroke(); g.beginPath(); upper(1); g.stroke();
      g.strokeStyle = 'rgba(236,160,150,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(200, my - 1.5); g.bezierCurveTo(200 - wd * 0.2, my + 7.5, 200 - wd * 0.6, my + 9.5, 200 - wd, cl - 1.5); g.stroke();
      g.strokeStyle = '#140a06'; g.lineWidth = 3; g.beginPath(); g.moveTo(200, 244); g.lineTo(200, my); g.stroke();
      if (op > 0.04) { g.lineWidth = 3; g.beginPath(); g.moveTo(200 - wd * 0.9, cl + dropY * 0.5); g.bezierCurveTo(200 - wd * 0.5, my + 11 + dropY, 200 - 6, my + 12 + dropY, 200, my + 12 + dropY); g.bezierCurveTo(200 + 6, my + 12 + dropY, 200 + wd * 0.5, my + 11 + dropY, 200 + wd * 0.9, cr + dropY * 0.5); g.stroke(); }
      g.restore();
    }

    function whiskers(g, A, T) {
      const m = A.m, t = A.t, ph = A.ph;
      g.save(); g.lineCap = 'round';
      const lay = 0.5 * Math.max(0, -m.ear) - 0.25 * Math.max(0, m.ear);
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 7; i++) {
          const a0 = (i - 3) * 0.17 + 0.05 - lay * (0.3 + i * 0.02) * -1, L = 92 - Math.abs(i - 2.5) * 8 + (i % 2) * 6;
          const x0 = 200 + s * (48 + (i % 3) * 3), y0 = 262 + (i - 3) * 3.4;
          const sway = sin(t * 1.4 + i * 0.6 + ph[0] + s) * 0.05 + sin(t * 0.6 + i) * 0.03, a = a0 + sway;
          const ex = x0 + s * cos(a) * L, ey = y0 + sin(a) * L + 14 + lay * 14 - (m.smile > 0 ? m.smile * 10 : 0);
          const cx = x0 + s * cos(a) * L * 0.5, cy = y0 + sin(a) * L * 0.5 - 12 + (m.smile < 0 ? -m.smile * 5 : 0);
          g.strokeStyle = 'rgba(20,10,6,.35)'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(x0, y0 + 1); g.quadraticCurveTo(cx, cy + 1, ex, ey + 1); g.stroke();
          g.strokeStyle = 'rgba(255,250,236,.9)'; g.lineWidth = 1.2 - i * 0.03; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        }
      }
      g.restore();
    }

    return {
      accent: '#ffd45a', bg: '#5a3418', defColor: '#2a8aa0', pivot: [200, 340], badge: [200, 218, 150],
      traits: function (P) {
        const v = P.variant, ec = ['#ffc21a', '#f0e04a', '#9ae04a', '#58d8f0'][v % 4];
        return {
          scar: v % 3 === 1, tone: v % 2, eyeCol: ec,
          eye: { w: 26, h: 11.2, lowR: 0.72, sc0: mixc(ec, '#fff', 0.2), sc1: mixc(ec, '#7a4a08', 0.4), ir: 12.6, pr: 0.56, pc: '#050302', i0: lite(ec, 0.5), i1: ec, i2: dark(ec, 0.55),
            lash: '#140a06', lashW: 3.2, wing: 5, crease: 0, creaseCol: '#000', lowerLine: 0, pupil: 'vslit', fib: 0.8 },
          brow: { y: 172, dy: -2, xi: 20, xo: 84, arch: 9, w0: 15, w1: 8, kb: 11, kr: 9, hi: '#d86c1a', mid: '#a8440e', lo: '#3a1304', sl: 'rgba(255,230,190,.55)', sd: 'rgba(30,10,4,.7)', n: 34 }
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const torso = shape([168, 346, 120, 356, 68, 374, 26, 402, -16, 440, -16, 520, 416, 520, 416, 440, 374, 402, 332, 374, 280, 356, 232, 346, 200, 356], true, [5, 6]);
        litFill(g, torso, TEAL, { rim: lite(acc, 0.1), rimW: 12, rimA: 0.8, d: 15 });
        inClip(g, torso, () => {
          blob(g, 100, 396, 74, 24, TEAL.hi, 0.5, -0.32);
          blob(g, 330, 440, 70, 52, '#000', 0.45);
          g.lineCap = 'round';
          for (let i = 0; i < 8; i++) { const x = 30 + R() * 340, y = 410 + R() * 80, L = 30 + R() * 40; g.strokeStyle = 'rgba(0,12,18,' + (0.25 + R() * 0.15) + ')'; g.lineWidth = 3 + R() * 4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + L / 2, x + (R() - 0.5) * 20, y + L); g.stroke(); }
          // gold embroidery: mirrored arabesques
          g.strokeStyle = 'rgba(240,196,92,.8)'; g.lineWidth = 1.7;
          for (let s = -1; s <= 1; s += 2) {
            const X = (x) => 200 + s * x;
            g.beginPath(); g.moveTo(X(26), 380); g.bezierCurveTo(X(60), 400, X(40), 436, X(76), 448); g.bezierCurveTo(X(110), 458, X(120), 420, X(96), 410); g.bezierCurveTo(X(80), 404, X(70), 422, X(84), 428); g.stroke();
            g.beginPath(); g.moveTo(X(30), 470); g.bezierCurveTo(X(70), 460, X(100), 486, X(140), 470); g.bezierCurveTo(X(170), 458, X(176), 430, X(160), 420); g.stroke();
            g.beginPath(); g.moveTo(X(20), 500); g.bezierCurveTo(X(60), 490, X(120), 510, X(168), 496); g.stroke();
          }
          g.strokeStyle = 'rgba(240,196,92,.85)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(200, 380); g.lineTo(200, 520); g.stroke();
          for (let i = 0; i < 6; i++) litFill(g, eshape(200, 410 + i * 20, 4, 4), GOLD, { d: 1.5, edge: 'rgba(60,40,6,.8)', edgeW: 0.8 });
        });
        // banner silk sash
        const sash = pshape([104, 380, 130, 346, 372, 494, 346, 530]);
        litFill(g, sash, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 7, rim: lite(acc, 0.2), rimW: 6, rimA: 0.55, edge: 'rgba(240,196,92,.9)', edgeW: 2 });
        inClip(g, sash, () => { g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; for (let i = 0; i < 70; i++) { g.beginPath(); g.moveTo(100 + i * 4.2, 360 + i * 2.6); g.lineTo(80 + i * 4.2, 400 + i * 2.6); g.stroke(); } blob(g, 160, 400, 60, 12, C.hi, 0.4, 0.55); });
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        softPoly(g, [100, 340, 300, 340, 322, 392, 200, 440, 78, 392], '#000', 0.5, 8);
        const band = shape([112, 332, 150, 360, 200, 372, 250, 360, 288, 332, 296, 350, 252, 380, 200, 392, 148, 380, 104, 350], true);
        litFill(g, band, GOLD, { d: 5, rim: acc, rimW: 6, rimA: 0.9, edge: 'rgba(60,40,6,.9)', edgeW: 1.6 });
        // radiating filigree plates
        for (let i = 0; i < 11; i++) {
          const k = i - 5, a = k * 0.2, cx = 200 + sin(a) * 100, cy = 330 + (1 - cos(a)) * 60 + 38;
          const L = 46 - abs(k) * 2.4, wd = 20;
          g.save(); g.translate(cx, cy); g.rotate(-a);
          const pl = shape([-wd * 0.5, 0, wd * 0.5, 0, wd * 0.42, L * 0.6, 0, L, -wd * 0.42, L * 0.6], true, [3]);
          litFill(g, pl, i === 5 ? GOLD : GOLD, { d: 3.4, rim: acc, rimW: 3, rimA: k > 0 ? 0.8 : 0.3, edge: 'rgba(60,40,6,.95)', edgeW: 1.2 });
          inClip(g, pl, () => { g.strokeStyle = 'rgba(80,50,8,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, L - 6); g.moveTo(-4, 10); g.quadraticCurveTo(0, 16, 4, 10); g.stroke(); });
          if (i !== 5) litFill(g, eshape(0, L * 0.38, 3.2, 3.2), { hi: '#9af0ff', mid: '#2aa6c0', lo: '#0c5a70', sh: '#02202a' }, { d: 1.4, edge: 'rgba(40,28,4,.9)', edgeW: 0.8 });
          g.restore();
        }
        // central gem
        litFill(g, eshape(200, 396, 16, 16), GOLD, { d: 4, edge: 'rgba(60,40,6,.95)', edgeW: 1.6, rim: acc, rimW: 3, rimA: 0.8 });
        litFill(g, shape([200, 383, 211, 396, 200, 409, 189, 396], true, [0, 1, 2, 3]), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 3, spec: 0.7, edge: 'rgba(40,28,4,.9)', edgeW: 1 });
        blob(g, 196, 391, 3.6, 2.6, '#fff', 0.8);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head');
        // cream neck ruff
        const neck = shape([150, 296, 138, 350, 132, 400, 268, 400, 262, 350, 250, 296], true);
        fillBase(g, neck, { hi: CREAM.hi, mid: CREAM.mid, lo: CREAM.lo });
        strokes(g, neck, 500, { cols: CR_COLS.concat(['#c8b690']), len: [12, 30], w: [1.4, 3], a: [0.4, 0.9], flow: (x, y, Rr) => PI / 2 + (x - 200) * 0.006 + (Rr() - 0.5) * 0.2, curve: 0.4, jit: 0.2 }, R);
        lightPass(g, neck, CREAM, { d: 8, shade: 0.55, spec: 0, rim: acc, rimW: 8, rimA: 0.7 });
        softPoly(g, [150, 300, 250, 300, 266, 344, 200, 352, 134, 344], '#2a1608', 0.45, 8);
        const hd = shape(symPts(HEAD), true);
        fillBase(g, hd, ORANGE);
        const flowR = (x, y) => atan2(y - 240, x - 200);
        strokes(g, hd, 1500, { cols: OR_COLS, len: [8, 20], w: [1, 2.2], a: [0.35, 0.8], flow: flowR, curve: 0.4, jit: 0.3, bb: [90, 100, 310, 250] }, R);
        // cream lower face (soft boundary)
        const fw = shape(symPts(FACE_W), true);
        inClip(g, hd, () => {
          soft(g, fw, '#f6ecd6', 0.97, 6);
          softPoly(g, [160, 176, 200, 170, 240, 176, 232, 200, 200, 196, 168, 200], '#f6ecd6', 0.9, 6);
        });
        strokes(g, hd, 1000, { cols: CR_COLS, len: [8, 18], w: [1, 2], a: [0.4, 0.9], flow: flowR, curve: 0.4, jit: 0.3, bb: [96, 214, 304, 330] }, R);
        strokes(g, hd, 380, { cols: OR_COLS.slice(1), len: [8, 18], w: [1, 2], a: [0.3, 0.7], flow: flowR, curve: 0.4, jit: 0.3, bb: [96, 190, 304, 240] }, R);
        // stripes: forehead + cheeks
        inClip(g, hd, () => {
          for (let s = -1; s <= 1; s += 2) {
            stripe(g, 200 + s * 8, 112, 200 + s * 14, 138, 200 + s * 10, 166, 9);
            stripe(g, 200 + s * 30, 114, 200 + s * 38, 142, 200 + s * 32, 172, 9.5);
            stripe(g, 200 + s * 56, 122, 200 + s * 66, 150, 200 + s * 58, 176, 9.5);
            stripe(g, 200 + s * 82, 138, 200 + s * 90, 164, 200 + s * 82, 184, 8.5);
            stripe(g, 200 + s * 118, 192, 200 + s * 104, 198, 200 + s * 90, 192, 8);
            stripe(g, 200 + s * 122, 216, 200 + s * 104, 222, 200 + s * 92, 212, 8.5);
            stripe(g, 200 + s * 120, 240, 200 + s * 106, 244, 200 + s * 94, 238, 8);
            stripe(g, 200 + s * 112, 264, 200 + s * 102, 262, 200 + s * 92, 258, 6.5);
          }
          // eye liner + tear lines
          for (let s = -1; s <= 1; s += 2) {
            softPoly(g, [200 + s * 30, 201, 200 + s * 62, 184, 200 + s * 92, 187, 200 + s * 98, 196, 200 + s * 64, 214, 200 + s * 36, 212], '#120804', 0.62, 3);
            stripe(g, 200 + s * 26, 206, 200 + s * 26, 232, 200 + s * 34, 258, 6.5);
          }
          // white brow spots
          for (let s = -1; s <= 1; s += 2) blob(g, 200 + s * 52, 166, 17, 8, '#fff6e2', 0.9, -s * 0.2);
        });
        strokes(g, hd, 600, { cols: OR_COLS.concat(CR_COLS.slice(1)), len: [5, 12], w: [0.9, 1.6], a: [0.18, 0.4], flow: flowR, curve: 0.4, jit: 0.4 }, R);
        // whisker pads + nose
        for (let s = -1; s <= 1; s += 2) {
          const pad = eshape(200 + s * 37, 268, 29, 21, s * 0.1);
          inClip(g, hd, () => { fillBase(g, pad, CREAM); lightPass(g, pad, CREAM, { d: 6, shade: 0.5, spec: 0.35 }); });
          g.fillStyle = 'rgba(30,14,8,.7)';
          for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(200 + s * (40 + c * 8) - (r === 1 ? 0 : 3), 260 + r * 8 + c * 0.8, 1.5, 0, TAU); g.fill(); }
        }
        const nose = shape(symPts([200, 208, 222, 208, 233, 218, 228, 232, 214, 242, 200, 248]), true);
        litFill(g, nose, { hi: '#f4a49a', mid: '#d8706a', lo: '#8a3434', sh: '#2a0a0c' }, { d: 4, rim: acc, rimW: 3, rimA: 0.5, edge: 'rgba(20,8,6,.9)', edgeW: 2 });
        blob(g, 192, 214, 8, 3.5, '#fff', 0.55);
        g.fillStyle = 'rgba(20,6,6,.85)'; for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(200 + s * 11, 234, 3.4, 2, s * 0.6, 0, TAU); g.fill(); }
        if (T.scar) { g.save(); g.lineCap = 'round'; g.strokeStyle = 'rgba(20,8,4,.7)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(262, 150); g.quadraticCurveTo(272, 200, 266, 246); g.stroke(); g.strokeStyle = 'rgba(244,196,170,.85)'; g.lineWidth = 1.4; g.stroke(); g.restore(); }
        lightPass(g, hd, ORANGE, { d: 15, shade: 0.5, spec: 0.22, rim: acc, rimW: 13, rimA: 0.8 });
        inClip(g, hd, () => {
          softPoly(g, [250, 120, 320, 160, 324, 262, 290, 304, 262, 262, 266, 190], '#16060a', 0.34, 14);
          softPoly(g, [96, 150, 130, 122, 190, 110, 186, 140, 130, 170, 110, 220], '#fff0d8', 0.22, 14);
        });
        const fcol = (x, y, nx, ny, Rr) => y < 200 ? OR_COLS[(Rr() * 6) | 0] : y < 240 ? (Rr() < 0.45 ? OR_COLS[(Rr() * 6) | 0] : CR_COLS[(Rr() * 4) | 0]) : CR_COLS[(Rr() * 4) | 0];
        edgeFur(g, hd, 520, { len: [9, 22], w: [1.5, 3.2], a: [0.55, 0.95], colFn: fcol, inset: 7, grav: 0.3, curve: 0.5, lenK: (nx, ny) => ny < -0.55 ? 0.42 : 1 }, R);
        edgeFur(g, hd, 300, { len: [26, 54], w: [2.4, 4.6], a: [0.6, 0.95], colFn: fcol, inset: 10, grav: 0.55, curve: 0.55, only: (nx, ny, x, y) => abs(nx) > 0.5 && y > 196 }, R);
      },

      ears: function (g, P, T) {
        const R = P.rng('ears');
        for (let s = -1; s <= 1; s += 2) {
          g.save(); g.translate(200 + s * 100, 146); g.rotate(s * 0.34);
          const ear = shape([-26, 14, -20, -14, -4, -34, 16, -32, 28, -10, 26, 16], true);
          fillBase(g, ear, ORANGE);
          strokes(g, ear, 120, { cols: OR_COLS, len: [6, 12], w: [1, 1.8], a: [0.4, 0.8], ang: -PI / 2, jit: 1.8, curve: 0.3 }, R);
          lightPass(g, ear, ORANGE, { d: 5, rim: P.accent, rimW: 5, rimA: s > 0 ? 0.8 : 0.3 });
          const inner = shape([-15, 12, -11, -10, -1, -24, 11, -22, 18, -6, 16, 12], true);
          fillBase(g, inner, { hi: '#fffaf0', mid: '#ead8bc', lo: '#9a7a62' });
          strokes(g, inner, 60, { cols: ['#fffaf0', '#f0e2c8', '#c8aa88'], len: [5, 10], w: [1, 1.6], a: [0.4, 0.8], ang: -PI / 2, jit: 1.4, curve: 0.3 }, R);
          lightPass(g, inner, { hi: '#fffaf0', mid: '#ead8bc', lo: '#9a7a62', sh: '#3a2418' }, { d: 4, spec: 0.1 });
          g.fillStyle = 'rgba(20,8,4,.85)'; g.beginPath(); g.moveTo(-22, -10); g.quadraticCurveTo(-4, -40, 18, -30); g.quadraticCurveTo(0, -30, -22, -10); g.fill();
          g.restore();
        }
      },

      sheen: function (g, P, T) {
        const R = P.rng('sheen'), hd = shape(symPts(HEAD), true);
        strokes(g, hd, 520, { cols: ['#fff2d4', '#ffffff', '#ffe0a8'], len: [10, 22], w: [1, 2], a: [0.5, 1], flow: (x, y) => atan2(y - 240, x - 200), curve: 0.4, jit: 0.4 }, R);
      },

      back: function (g, P, T, A) {
        const t = A.t, ph = A.ph, L = P.layers.ears; if (!L) return;
        const m = A.m;
        for (let s = -1; s <= 1; s += 2) {
          const tw = Math.pow(Math.max(0, sin(t * 0.77 + ph[2] + (s > 0 ? 2.1 : 0))), 22) * sin(t * 36) * 0.2 + sin(t * 0.6 + ph[1] + s) * 0.02;
          const mood = -m.ear * 0.5 * s + (m.ear > 0 ? -m.ear * 0.1 * s : 0);
          const px = 200 + s * 100;
          g.save(); g.beginPath(); g.rect(s < 0 ? 0 : 200, 0, 200, H); g.clip();
          g.translate(px, 150); g.rotate((tw + mood) * (s > 0 ? 1 : 1)); g.translate(-px, -150);
          blit(g, L);
          g.restore();
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, e = T.eye, t = A.t;
        const sh = P.layers.sheen;
        if (sh) {
          const k = (t * 0.22 + A.ph[4] * 0.1) % 1.6, x = -80 + k * 260;
          g.save(); g.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) { g.save(); g.beginPath(); g.rect(x - 34 + i * 12, 100, 68 - i * 24, 240); g.clip(); g.globalAlpha = 0.09 + i * 0.05; blit(g, sh); g.restore(); }
          g.restore();
        }
        const open = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.1, 0, 1.2);
        const st = { dir: 1, ti: m.brow * 3.2, to: -m.brow * 1.6 - 2, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        glow(g, T.eyeCol, 150, 198, 40, 0.08 * m.glow); glow(g, T.eyeCol, 250, 198, 40, 0.08 * m.glow);
        drawEye(g, 152, 198, e, st);
        st.dir = -1; drawEye(g, 248, 198, e, st);
        browRig(g, -1, A, T.brow); browRig(g, 1, A, T.brow);
        const fl = 1 + 0.25 * A.breath + Math.max(0, m.glow - 1) * 0.8;
        g.fillStyle = 'rgba(20,6,6,.9)'; for (let s = -1; s <= 1; s += 2) { g.beginPath(); g.ellipse(200 + s * 11, 234, 3.4 * fl, 2 * fl, s * 0.6, 0, TAU); g.fill(); }
        catMouth(g, A, T);
        whiskers(g, A, T);
      }
    };
  })();

  /* ======================================================================= PSILON */
  PAINT.psilon = (function () {
    const AMBER = { hi: '#fff4d6', mid: '#f4d898', lo: '#c99c56', sh: '#6e4a22', blush: '#f2aa8a', lip: '#d89a7e' };
    const ROBE = { hi: '#ffffff', mid: '#e9ebf9', lo: '#a9afd8', sh: '#474c8e' };
    const VIOLET = { hi: '#cdb0ff', mid: '#7c50dc', lo: '#3c2294', sh: '#140a3c' };
    const GOLD = { hi: '#fff3c4', mid: '#efc45c', lo: '#a07622', sh: '#4c340c' };
    const HALF = [200, 34, 236, 40, 268, 62, 288, 98, 294, 142, 286, 184, 268, 222, 244, 254, 222, 278, 200, 292];
    const GEM = { x: 200, y: 112 };

    function growVeins(g, R, ox, oy) {
      g.lineCap = 'round';
      const walk = (x, y, a, len, w, depth) => {
        g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        let px = x, py = y;
        for (let i = 0; i < len; i++) {
          a += (R() - 0.5) * 0.7; px += cos(a) * 11; py += sin(a) * 11; g.lineTo(px, py);
          if (depth < 2 && R() < 0.2) { g.stroke(); walk(px, py, a + (R() < 0.5 ? 0.8 : -0.8), 3 + ((R() * 4) | 0), w * 0.7, depth + 1); g.lineWidth = w; g.beginPath(); g.moveTo(px, py); }
        }
        g.stroke();
      };
      for (let i = 0; i < 14; i++) { const a = PI * (0.1 + 0.8 * (i / 13)) + (R() - 0.5) * 0.2; walk(ox + cos(a) * 8, oy + sin(a) * 6, a, 7 + ((R() * 6) | 0), 1.8, 0); }
    }
    function mouth(g, A, T) {
      const base = { my: 270, mw: 11, mwk: 2, smk: 3.2, talkw: 1, openk: 0.3, drop: 8, thU: 2.5, thL: 4.2, bow: 0.6, teeth: false, tongue: '#c8707a', lipU: '#c98a72', lipL: AMBER.lip, inside: '#4a1c22', line: 'rgba(90,40,30,.6)', corner: 'rgba(90,40,30,.4)' };
      mouthRig(g, A, base);
    }

    return {
      accent: '#46e6d4', bg: '#16354a', defColor: '#8a4ee0', pivot: [200, 336], badge: [200, 178, 150], grain: 0.05,
      traits: function (P) {
        const v = P.variant, ec = ['#3fe0cc', '#58d0ff', '#7af0a0', '#c0a0ff'][v % 4];
        const R = P.rng('veins');
        return {
          cap: shape(symPts(HALF), true), gemShape: shape([0, -15, 9, -3, 7, 8, 0, 15, -7, 8, -9, -3], true, [0, 1, 3, 4]),
          ec: ec, gem: ['#a870ff', '#ff70c0', '#70c8ff', '#ffc070'][(v >> 1) % 4], circlet: v % 2,
          eye: { w: 27, h: 20, lowR: 0.9, sc0: '#effffb', sc1: mixc(ec, '#a8ece0', 0.5), ir: 19.5, pr: 0.27, pc: '#021014', i0: '#f4fffd', i1: lite(ec, 0.1), i2: dark(ec, 0.28), limb: 0.12,
            lash: '#8a6226', lashW: 1.8, wing: 0, crease: 0.2, creaseCol: AMBER.sh, lowerLine: 0.15, pupil: 'round', fib: 1.6, iy: 1 },
          brow: { y: 186, dy: 3, xi: 16, xo: 66, arch: 6, w0: 3.6, w1: 1.6, kb: 7, kr: 6, hi: '#d8aa60', mid: '#b88840', lo: '#8a5c20', sl: 'rgba(255,236,190,.4)', sd: 'rgba(110,70,20,.45)', n: 12 }
        };
      },

      aux: function (g, P, T) {   // cranial veins
        const R = P.rng('veins');
        g.strokeStyle = '#46d0c8'; growVeins(g, R, GEM.x, GEM.y + 8);
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        // fan collar behind the head
        const half = [200, 296, 232, 290, 262, 280, 288, 262, 304, 244, 316, 268, 326, 300, 322, 336, 306, 366, 200, 392];
        const fan = shape(symPts(half), true);
        litFill(g, fan, ROBE, { d: 12, rim: acc, rimW: 9, rimA: 0.75, edge: 'rgba(40,36,100,.6)', edgeW: 1.4 });
        inClip(g, fan, () => {
          for (let i = 0; i < 13; i++) {
            const a = lerp(PI * 0.02, PI * 0.98, i / 12), x = 200 - cos(a) * 130, y = 250 + sin(a) * 150;
            g.strokeStyle = i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(70,76,150,.38)'; g.lineWidth = 3.2; g.lineCap = 'round';
            g.beginPath(); g.moveTo(200 + (x - 200) * 0.55, 300 + (y - 300) * 0.2); g.quadraticCurveTo(200 + (x - 200) * 0.85, 300 + (y - 300) * 0.5, x, y); g.stroke();
          }
          softPoly(g, [100, 250, 200, 296, 300, 250, 300, 392, 100, 392], VIOLET.lo, 0.0, 6);
        });
        g.strokeStyle = VIOLET.mid; g.lineWidth = 3.4; g.lineJoin = 'round';
        g.beginPath(); trace(g, symPts(half).slice(2, 20), false); g.stroke();
        g.strokeStyle = GOLD.mid; g.lineWidth = 1; g.beginPath(); trace(g, symPts(half).slice(2, 20).map((v, i) => (i & 1) ? v - 3 : v), false); g.stroke();
        // robe
        const torso = shape([176, 314, 140, 328, 98, 352, 58, 388, 18, 436, -4, 520, 404, 520, 382, 436, 342, 388, 302, 352, 260, 328, 224, 314, 200, 328], true, [5, 6]);
        litFill(g, torso, ROBE, { rim: acc, rimW: 12, rimA: 0.8, d: 15 });
        inClip(g, torso, () => {
          for (let i = 0; i < 12; i++) {
            const u = i / 11, x = lerp(-10, 410, u), sx = 200 + (x - 200) * 0.3, dark_ = i % 2 === 0;
            softPoly(g, [sx - 8, 336, sx + 8, 336, x + 24, 540, x - 24, 540], dark_ ? ROBE.sh : '#ffffff', dark_ ? 0.3 : 0.45, 10, false);
          }
          g.lineCap = 'round';
          for (let i = 0; i < 12; i++) { const u = (i + R() * 0.8) / 12, x = lerp(0, 400, u), sx = 200 + (x - 200) * 0.3; g.strokeStyle = 'rgba(60,66,140,' + (0.18 + R() * 0.14) + ')'; g.lineWidth = 1.2 + R() * 1.4; g.beginPath(); g.moveTo(sx, 340); g.quadraticCurveTo(lerp(sx, x, 0.5) + (R() - 0.5) * 10, 420, x + (R() - 0.5) * 20, 530); g.stroke(); }
          blob(g, 330, 450, 70, 80, ROBE.sh, 0.35);
          // violet stole with gold pattern
          const st = pshape([176, 340, 224, 340, 246, 520, 154, 520]);
          litFill(g, st, VIOLET, { d: 7, rim: acc, rimW: 5, rimA: 0.6, edge: GOLD.mid, edgeW: 2 });
          inClip(g, st, () => {
            g.strokeStyle = 'rgba(240,196,92,.8)'; g.lineWidth = 1.4;
            for (let i = 0; i < 7; i++) { const y = 360 + i * 24, w = 18 + i * 3; g.beginPath(); g.moveTo(200 - w, y + 8); g.lineTo(200, y - 6); g.lineTo(200 + w, y + 8); g.lineTo(200, y + 22); g.closePath(); g.stroke(); }
            g.beginPath(); g.moveTo(200, 340); g.lineTo(200, 520); g.stroke();
            blob(g, 188, 400, 14, 70, VIOLET.hi, 0.3);
          });
          // banner sash across the waist
          const sash = shape([100, 452, 150, 463, 200, 468, 250, 459, 300, 440, 302, 470, 250, 490, 200, 498, 150, 494, 98, 486], true, [0, 4, 5, 9]);
          litFill(g, sash, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 5, edge: GOLD.mid, edgeW: 1.6, rim: acc, rimW: 4, rimA: 0.5 });
        });
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        softPoly(g, [160, 322, 240, 322, 252, 362, 200, 382, 148, 362], '#2a2a70', 0.4, 6);
        for (let s = 0; s < 2; s++) {
          const pts = s ? mirror([148, 318, 168, 313, 188, 322, 200, 334, 200, 388, 160, 384, 136, 356]) : [148, 318, 168, 313, 188, 322, 200, 334, 200, 388, 160, 384, 136, 356];
          const pn = shape(pts, true, [0, 3, 4]);
          litFill(g, pn, VIOLET, { d: 8, rim: acc, rimW: 7, rimA: s ? 0.9 : 0.4, edge: 'rgba(20,10,60,.9)', edgeW: 1.4 });
          inClip(g, pn, () => { g.strokeStyle = 'rgba(240,196,92,.75)'; g.lineWidth = 1.2; g.beginPath(); trace(g, s ? [252, 332, 232, 348, 214, 356, 202, 362] : [148, 332, 168, 348, 186, 356, 198, 362], false); g.stroke(); blob(g, s ? 230 : 170, 352, 18, 12, VIOLET.hi, 0.3); });
          g.strokeStyle = GOLD.mid; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[2], pts[3]); g.lineTo(pts[4], pts[5]); g.lineTo(pts[6], pts[7]); g.stroke();
        }
        litFill(g, eshape(200, 354, 12, 12), GOLD, { d: 3, edge: 'rgba(60,40,6,.95)', edgeW: 1.4, rim: acc, rimW: 3, rimA: 0.6 });
        litFill(g, shape([200, 344, 208, 354, 200, 364, 192, 354], true, [0, 1, 2, 3]), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, spec: 0.7 });
        blob(g, 197, 351, 2.6, 2, '#fff', 0.8);
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head');
        const neck = shape([174, 270, 170, 320, 166, 350, 234, 350, 230, 320, 226, 270], true, [2, 3]);
        litFill(g, neck, { hi: AMBER.mid, mid: AMBER.lo, lo: mixc(AMBER.lo, AMBER.sh, 0.5), sh: AMBER.sh }, { rim: acc, rimA: 0.5, rimW: 5, spec: 0 });
        inClip(g, neck, () => { blob(g, 200, 288, 50, 20, AMBER.sh, 0.7); g.strokeStyle = rgba(AMBER.sh, 0.25); g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(186, 300); g.quadraticCurveTo(192, 322, 196, 346); g.moveTo(214, 300); g.quadraticCurveTo(208, 322, 204, 346); g.stroke(); });
        const hd = shape(symPts(HALF), true);
        litFill(g, hd, AMBER, { rim: acc, rimW: 14, rimA: 0.85, d: 16 });
        inClip(g, hd, () => {
          softPoly(g, [116, 120, 150, 70, 206, 44, 214, 82, 156, 120, 136, 190, 118, 170], '#fffaf0', 0.5, 14);
          softPoly(g, [244, 56, 296, 100, 300, 230, 262, 262, 224, 296, 252, 226, 262, 160], '#5a3a62', 0.34, 16);
          // cranial sutures (faint)
          g.strokeStyle = rgba(AMBER.sh, 0.12); g.lineWidth = 1.4; g.lineCap = 'round';
          g.beginPath(); trace(g, [110, 150, 140, 100, 200, 66, 260, 100, 290, 150], false); g.stroke();
          g.beginPath(); trace(g, [128, 190, 150, 140, 200, 110, 250, 140, 272, 190], false); g.stroke();
          // face region: sockets, nose, cheeks
          const sock = mixc(AMBER.lo, '#6a3a60', 0.3);
          softPoly(g, [136, 198, 168, 188, 190, 204, 186, 236, 160, 244, 138, 226], sock, 0.36, 8);
          softPoly(g, [264, 198, 232, 188, 210, 204, 214, 236, 240, 244, 262, 226], sock, 0.44, 8);
          softPoly(g, [196, 214, 203, 214, 205, 246, 195, 246], '#fffaf0', 0.35, 3);
          softPoly(g, [207, 220, 214, 232, 216, 248, 206, 246], AMBER.sh, 0.2, 3);
          softPoly(g, [192, 248, 208, 248, 206, 255, 194, 255], AMBER.sh, 0.4, 2);
          g.fillStyle = 'rgba(70,30,20,.55)'; g.beginPath(); g.ellipse(194.5, 252, 2.4, 1.3, -0.3, 0, TAU); g.ellipse(205.5, 252, 2.4, 1.3, 0.3, 0, TAU); g.fill();
          blob(g, 200, 246, 6, 4, '#fff', 0.4);
          blob(g, 144, 246, 22, 14, AMBER.blush, 0.22); blob(g, 256, 246, 22, 14, AMBER.blush, 0.18);
          softPoly(g, [180, 276, 220, 276, 214, 284, 186, 284], AMBER.sh, 0.2, 3);
          softPoly(g, [186, 286, 214, 286, 210, 292, 190, 292], AMBER.sh, 0.28, 3);
          blob(g, 198, 288, 9, 5, '#fff', 0.35);
          softPoly(g, [236, 262, 266, 232, 270, 262, 246, 280], AMBER.sh, 0.28, 8);
        });
        // circlet + gem setting
        g.save();
        const band = shape([110, 158, 128, 138, 160, 122, 200, 116, 240, 122, 272, 138, 290, 158], false);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(30,16,4,.7)'; g.lineWidth = 7.5; g.stroke(band.path);
        g.strokeStyle = GOLD.mid; g.lineWidth = 5; g.stroke(band.path);
        g.strokeStyle = GOLD.hi; g.lineWidth = 1.6; g.save(); g.translate(0, -1.4); g.stroke(band.path); g.restore();
        g.strokeStyle = GOLD.lo; g.lineWidth = 1; g.save(); g.translate(0, 1.8); g.stroke(band.path); g.restore();
        g.restore();
        const set = shape([200, 96, 214, 112, 212, 126, 200, 134, 188, 126, 186, 112], true, [0]);
        litFill(g, set, GOLD, { d: 3, rim: acc, rimW: 3, rimA: 0.6, edge: 'rgba(50,30,4,.95)', edgeW: 1.4 });
      },

      fore: function (g, P, T) { },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, e = T.eye, ph = A.ph;
        // cranial veins lighting up in expanding rings from the gem
        const L = P.layers.aux;
        if (L) {
          g.save(); g.clip(T.cap.path);
          g.globalAlpha = 0.16 + 0.07 * sin(t * 1.4 + ph[0]) + A.talk * 0.2;
          blit(g, L);
          const ring = ((t * 0.32 + ph[1] * 0.1) % 1.5) * 190;
          g.globalAlpha = 0.55 * m.glow; g.beginPath(); g.arc(GEM.x, GEM.y + 10, ring, 0, TAU); g.arc(GEM.x, GEM.y + 10, Math.max(0, ring - 34), 0, TAU); g.clip('evenodd');
          blit(g, L);
          g.restore();
        }
        // eyes
        const open = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.1, 0, 1.2);
        const st = { dir: 1, ti: m.brow * 2.6, to: -m.brow * 1.0, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: open };
        const pulse = 0.85 + 0.15 * sin(t * 1.9 + ph[2]) + A.talk * 0.3;
        glow(g, T.ec, 160, 214, 62, 0.4 * m.glow * pulse); glow(g, T.ec, 240, 214, 62, 0.4 * m.glow * pulse);
        drawEye(g, 160, 214, e, st);
        st.dir = -1; drawEye(g, 240, 214, e, st);
        const hu = e.h * open, hl = e.h * e.lowR * (1 - m.lower * 0.6) * Math.min(1, 0.3 + open * 0.7);
        for (let k = 0; k < 2; k++) {
          const ex = k ? 240 : 160;
          g.save(); g.beginPath(); eyePath(g, ex, 214, e.w, hu, hl, k ? -1 : 1, st.ti, st.to); g.clip();
          glow(g, T.ec, ex + A.lx * 6, 214 + A.ly * 3, 30, 0.7 * m.glow * pulse); glow(g, '#ffffff', ex + A.lx * 6, 214 + A.ly * 3, 15, 0.35 * m.glow * pulse);
          g.restore();
        }
        browRig(g, -1, A, T.brow); browRig(g, 1, A, T.brow);
        mouth(g, A, T);
        // gem
        const gp = 0.8 + 0.2 * sin(t * 2.3 + ph[3]) + A.talk * 0.4 + Math.max(0, m.glow - 1);
        glow(g, T.gem, GEM.x, GEM.y + 2, 46, 0.5 * gp);
        g.save(); g.translate(GEM.x, GEM.y + 2);
        const gm = T.gemShape;
        fillBase(g, gm, { hi: lite(T.gem, 0.65), mid: T.gem, lo: dark(T.gem, 0.55) });
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 15); g.moveTo(-9, -3); g.lineTo(7, 8); g.moveTo(9, -3); g.lineTo(-7, 8); g.stroke();
        g.strokeStyle = 'rgba(30,10,60,.8)'; g.lineWidth = 1.2; g.stroke(gm.path);
        g.restore();
        glow(g, '#ffffff', GEM.x - 3, GEM.y - 4, 7, 0.7 * gp);
        const sp = Math.pow(Math.max(0, sin(t * 0.7 + ph[4])), 18);
        if (sp > 0.02) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#ffffff', sp * 0.9); g.lineWidth = 1.4; g.lineCap = 'round'; const L2 = 22 * sp + 4; g.beginPath(); g.moveTo(GEM.x - L2, GEM.y + 2); g.lineTo(GEM.x + L2, GEM.y + 2); g.moveTo(GEM.x, GEM.y + 2 - L2); g.lineTo(GEM.x, GEM.y + 2 + L2); g.stroke(); g.restore(); }
      }
    };
  })();

  /* ======================================================================= SAKKRA */
  PAINT.sakkra = (function () {
    const SC = { hi: '#74f2a8', mid: '#1fae68', lo: '#0b5c3e', sh: '#031a12' };
    const BELLY = { hi: '#f4f6a8', mid: '#cadb70', lo: '#7a9a36', sh: '#2a3a10' };
    const BONE = { hi: '#fffaf0', mid: '#eadcbc', lo: '#a89868', sh: '#3a2e18' };
    const GOLD = { hi: '#fff3c4', mid: '#e9bd55', lo: '#9d7022', sh: '#4c340c' };
    const HEAD_HALF = [200, 98, 238, 103, 270, 122, 292, 150, 298, 184, 292, 218, 282, 248, 276, 272, 272, 290, 200, 298];
    const JAW_HALF = [200, 290, 236, 288, 262, 282, 282, 278, 286, 296, 272, 320, 246, 338, 222, 346, 200, 349];
    const MUZ_HALF = [200, 152, 222, 158, 236, 178, 241, 214, 239, 250, 232, 280, 200, 296];
    const EYE_X = 62;

    function scales(g, sh, cell, pal, R, o) {
      o = o || {};
      g.save(); g.clip(sh.path);
      const bb = o.bb || sh.bb, rowH = cell * 0.76, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
      g.lineJoin = 'round';
      for (let row = 0, y = bb[3] + cell; y > bb[1] - cell; y -= rowH, row++) {
        for (let x = bb[0] - cell + (row % 2) * cell / 2; x < bb[2] + cell; x += cell) {
          const jx = x + (R() - 0.5) * cell * 0.16, jy = y + (R() - 0.5) * cell * 0.12, c = cell * (o.sz ? o.sz(jx, jy) : 1);
          const k = clamp(0.62 - ((jx - cx) * 0.0024 + (jy - cy) * 0.0018) + (R() - 0.5) * 0.18, 0.05, 0.98);
          const col = k < 0.5 ? mixc(pal.sh, pal.lo, k * 2) : k < 0.8 ? mixc(pal.lo, pal.mid, (k - 0.5) / 0.3) : mixc(pal.mid, pal.hi, (k - 0.8) / 0.2);
          g.beginPath(); g.moveTo(jx - c * 0.5, jy - c * 0.34);
          g.quadraticCurveTo(jx, jy - c * 0.72, jx + c * 0.5, jy - c * 0.34);
          g.quadraticCurveTo(jx + c * 0.56, jy + c * 0.24, jx, jy + c * 0.58);
          g.quadraticCurveTo(jx - c * 0.56, jy + c * 0.24, jx - c * 0.5, jy - c * 0.34);
          g.fillStyle = col; g.fill();
          g.strokeStyle = rgba(pal.sh, 0.55); g.lineWidth = 0.9; g.stroke();
          g.strokeStyle = rgba(pal.hi, 0.28 + k * 0.3); g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(jx - c * 0.36, jy - c * 0.2); g.quadraticCurveTo(jx - c * 0.1, jy - c * 0.5, jx + c * 0.3, jy - c * 0.28); g.stroke();
        }
      }
      g.restore();
    }
    function tooth(g, x, y, w, h, up) {
      g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x, y + (up ? h : -h)); g.closePath();
      g.fillStyle = lg(g, x, y, x, y + (up ? h : -h), [0, '#fffaf0', 1, '#cfc29c']); g.fill();
      g.strokeStyle = 'rgba(40,30,10,.55)'; g.lineWidth = 0.7; g.stroke();
    }
    function brow(g, side, A, T) {
      const m = A.m, as = m.bAsym * (side < 0 ? -8 : 3);
      const xi = 200 + side * 40, xo = 200 + side * 104;
      const yi = 162 + m.brow * 13 - m.browY * 8 + as, yo = 144 - m.brow * 4 - m.browY * 6 + as * 0.6;
      const cx = (xi + xo) / 2 + side * 4, cy = (yi + yo) / 2 - 8;
      g.save();
      g.beginPath(); taper(g, xi, yi + 5, cx, cy + 6, xo, yo + 8, 14, 9, 8);
      g.shadowColor = 'rgba(2,12,8,.85)'; g.shadowBlur = 6; g.fillStyle = 'rgba(2,12,8,.55)'; g.fill(); g.shadowBlur = 0;
      g.beginPath(); taper(g, xi, yi, cx, cy, xo, yo, 19, 11, 9);
      g.fillStyle = lg(g, 0, cy - 10, 0, cy + 9, [0, SC.hi, 0.4, SC.mid, 1, SC.lo]); g.fill();
      g.strokeStyle = 'rgba(2,20,12,.9)'; g.lineWidth = 1.3; g.stroke();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(2,24,14,.55)'; g.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const t = i / 9, u = 1 - t, x = u * u * xi + 2 * u * t * cx + t * t * xo, y = u * u * yi + 2 * u * t * cy + t * t * yo; g.beginPath(); g.moveTo(x - 1, y - 12); g.lineTo(x + side * 3, y + 12); g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(220,255,236,.75)'; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(xi + side * 2, yi - 7); g.quadraticCurveTo(cx, cy - 7, xo - side * 2, yo - 3); g.stroke();
      g.restore();
    }

    return {
      accent: '#3be28b', bg: '#0e3a2c', defColor: '#d0902c', pivot: [200, 345], badge: [200, 216, 150],
      traits: function (P) {
        const v = P.variant, ec = ['#f2d020', '#ff8a20', '#c8f040', '#ff4a4a'][v % 4];
        return {
          paint: v % 3, ec: ec, frill: ['#e8602a', '#d8408a', '#e8b02a'][(v >> 1) % 3],
          eye: { w: 23, h: 14, lowR: 0.62, sc0: ec, sc1: dark(ec, 0.5), ir: 14.4, pr: 0.5, pc: '#030806', i0: lite(ec, 0.5), i1: ec, i2: dark(ec, 0.55),
            lash: '#04180e', lashW: 3, wing: 0, crease: 0, creaseCol: '#000', lowerLine: 0, pupil: 'vslit', fib: 0.7 },
          jawShape: shape(symPts(JAW_HALF), true), headShape: shape(symPts(HEAD_HALF), true)
        };
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const torso = shape([168, 346, 120, 356, 68, 374, 26, 402, -16, 440, -16, 520, 416, 520, 416, 440, 374, 402, 332, 374, 280, 356, 232, 346, 200, 356], true, [5, 6]);
        fillBase(g, torso, SC);
        scales(g, torso, 16, SC, R, { bb: [-20, 340, 420, 530] });
        // belly plates
        const belly = shape([186, 350, 214, 350, 226, 430, 232, 520, 168, 520, 174, 430], true);
        fillBase(g, belly, BELLY);
        inClip(g, belly, () => {
          g.strokeStyle = 'rgba(40,60,10,.7)'; g.lineWidth = 1.6;
          for (let i = 0; i < 11; i++) { const y = 362 + i * 15; g.beginPath(); g.moveTo(170, y); g.quadraticCurveTo(200, y + 7, 230, y); g.stroke(); g.strokeStyle = 'rgba(255,255,220,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(170, y + 1.8); g.quadraticCurveTo(200, y + 8.8, 230, y + 1.8); g.stroke(); g.strokeStyle = 'rgba(40,60,10,.7)'; g.lineWidth = 1.6; }
        });
        lightPass(g, belly, BELLY, { d: 6, shade: 0.5, spec: 0.2 });
        lightPass(g, torso, SC, { d: 16, shade: 0.5, spec: 0.22, rim: acc, rimW: 13, rimA: 0.85 });
        inClip(g, torso, () => { softPoly(g, [320, 350, 420, 410, 420, 520, 350, 520], '#00080a', 0.38, 12); });
        // feather mantle on the shoulder (banner coloured)
        for (let i = 0; i < 9; i++) {
          const x = 300 + i * 11, y = 372 + i * 6;
          feather(g, x, y, -0.25 - i * 0.07, 52 + R() * 12, 20, i % 2 ? C.hi : C.mid, C.lo, 'rgba(0,0,0,.4)', 'rgba(255,255,255,.2)');
        }
        for (let i = 0; i < 6; i++) { const x = 118 - i * 12, y = 376 + i * 7; feather(g, x, y, 0.3 + i * 0.07, 46 + R() * 10, 18, i % 2 ? '#2a3a2a' : '#d8e8c0', '#0a1a10', 'rgba(0,0,0,.4)', 'rgba(255,255,255,.2)'); }
        // leather strap with bone beads
        const strap = pshape([96, 372, 118, 356, 380, 482, 366, 510]);
        litFill(g, strap, { hi: '#7a5230', mid: '#4a2e1a', lo: '#26160c', sh: '#0c0604' }, { d: 4, edge: 'rgba(0,0,0,.7)', edgeW: 1.2 });
        for (let i = 0; i < 7; i++) { const u = 0.1 + i * 0.13; litFill(g, eshape(lerp(108, 374, u), lerp(366, 496, u), 4.2, 4.2), BONE, { d: 1.6, edge: 'rgba(40,30,10,.8)', edgeW: 0.8 }); }
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        // tribal pectoral: bone collar of claws, beads and a central pendant
        softPoly(g, [104, 344, 296, 344, 316, 392, 200, 440, 84, 392], '#001008', 0.5, 8);
        const cord = [120, 340, 146, 376, 200, 396, 254, 376, 280, 340];
        g.save(); g.lineCap = 'round';
        g.strokeStyle = '#2a1a0c'; g.lineWidth = 4; g.beginPath(); trace(g, cord, false); g.stroke();
        g.strokeStyle = '#7a5230'; g.lineWidth = 2.2; g.stroke();
        g.restore();
        for (let i = 0; i < 13; i++) {
          const t = (i + 0.5) / 13, u = t * 4, k = Math.min(3, Math.floor(u)), f = u - k;
          const px = lerp(cord[k * 2], cord[k * 2 + 2], f), py = lerp(cord[k * 2 + 1], cord[k * 2 + 3], f);
          const a = atan2(py - 372, px - 200);
          if (i === 6) continue;
          if (i % 2) litFill(g, shape([px - 4, py, px + 4, py, px + 3, py + 18, px, py + 28, px - 3, py + 18], true, [3]), BONE, { d: 2, edge: 'rgba(50,38,14,.85)', edgeW: 0.9 });
          else litFill(g, eshape(px, py + 4, 5, 5), i % 4 === 0 ? GOLD : { hi: '#7af0d0', mid: '#1aa88a', lo: '#0a5a4c', sh: '#02201a' }, { d: 2, edge: 'rgba(30,20,6,.85)', edgeW: 0.9 });
        }
        // central pendant
        const pd = shape([200, 392, 218, 410, 214, 434, 200, 448, 186, 434, 182, 410], true, [0, 3]);
        litFill(g, pd, GOLD, { d: 4, edge: 'rgba(60,40,6,.95)', edgeW: 1.6, rim: acc, rimW: 3, rimA: 0.7 });
        litFill(g, eshape(200, 418, 9, 9), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 3, spec: 0.7, edge: 'rgba(40,28,4,.9)', edgeW: 1.2 });
        blob(g, 197, 415, 3, 2.2, '#fff', 0.8);
        inClip(g, pd, () => { g.strokeStyle = 'rgba(80,50,8,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(200, 392); g.lineTo(200, 448); g.stroke(); });
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head');
        // thick neck with scales
        const neck = shape([128, 290, 112, 330, 108, 392, 292, 392, 288, 330, 272, 290], true, [2, 3]);
        fillBase(g, neck, SC);
        scales(g, neck, 15, SC, R, {});
        lightPass(g, neck, SC, { d: 10, shade: 0.55, spec: 0, rim: acc, rimW: 9, rimA: 0.8 });
        softPoly(g, [124, 292, 276, 292, 286, 332, 200, 350, 114, 332], '#00100a', 0.5, 8);
        // head
        const hd = T.headShape;
        fillBase(g, hd, SC);
        scales(g, hd, 11.5, SC, R, { sz: (x, y) => (y < 150 ? 1.25 : y < 250 ? 1 : 0.9) });
        // lighter muzzle plate
        const mz = shape(symPts(MUZ_HALF), true);
        fillBase(g, mz, { hi: SC.hi, mid: '#2cc27a', lo: SC.mid });
        scales(g, mz, 9, { hi: SC.hi, mid: '#34c883', lo: SC.mid, sh: SC.lo }, R, { sz: () => 1 });
        lightPass(g, mz, SC, { d: 7, shade: 0.5, spec: 0.35, edge: 'rgba(2,30,18,.65)', edgeW: 1.2 });
        // tribal paint
        inClip(g, hd, () => {
          const paint = T.paint, pc = '#f4ecd4';
          for (let s = -1; s <= 1; s += 2) {
            for (let i = 0; i < 3; i++) softPoly(g, [200 + s * (66 + i * 7), 212 + i * 3, 200 + s * (72 + i * 7), 212 + i * 3, 200 + s * (74 + i * 7), 246 + i * 3, 200 + s * (68 + i * 7), 246 + i * 3], pc, 0.88, 1);
            if (paint > 0) softPoly(g, [200 + s * 76, 134, 200 + s * 86, 132, 200 + s * 94, 156, 200 + s * 84, 158], pc, 0.88, 1);
          }
          if (paint !== 1) softPoly(g, [196, 108, 204, 108, 205, 150, 195, 150], pc, 0.88, 1);
          if (paint === 2) softPoly(g, [194, 120, 206, 120, 210, 134, 190, 134], '#e8602a', 0.9, 1);
        });
        lightPass(g, hd, SC, { d: 16, shade: 0.5, spec: 0.24, rim: acc, rimW: 14, rimA: 0.9 });
        inClip(g, hd, () => {
          softPoly(g, [250, 120, 302, 156, 302, 280, 268, 298, 268, 220, 262, 170], '#00100a', 0.36, 14);
          softPoly(g, [104, 150, 140, 114, 196, 100, 190, 128, 140, 156, 118, 210], '#e8fff0', 0.24, 13);
          // eye sockets
          for (let s = -1; s <= 1; s += 2) softPoly(g, [200 + s * 40, 190, 200 + s * 62, 166, 200 + s * 94, 172, 200 + s * 102, 196, 200 + s * 70, 214, 200 + s * 42, 212], '#021a10', 0.5, 6);
          for (let s = -1; s <= 1; s += 2) softPoly(g, [200 + s * 44, 220, 200 + s * 74, 226, 200 + s * 80, 268, 200 + s * 50, 276], '#021a10', 0.22, 8);
        });
        // nostrils with raised rims
        for (let s = -1; s <= 1; s += 2) {
          const n = eshape(200 + s * 13, 264, 6.2, 4.2, s * 0.5);
          litFill(g, n, SC, { d: 2.2, edge: 'rgba(2,30,18,.9)', edgeW: 1 });
          g.fillStyle = 'rgba(0,10,6,.9)'; g.beginPath(); g.ellipse(200 + s * 13, 265, 3.6, 2.2, s * 0.5, 0, TAU); g.fill();
        }
        // cheek spikes seated on the outline
        for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
          const y = 204 + i * 19, hw = [297, 293, 286, 280][i], x = 200 + s * (hw - 200 - 6), a = s > 0 ? 0.3 + i * 0.17 : PI - (0.3 + i * 0.17);
          g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -6); g.lineTo(24 - i * 3, 0); g.lineTo(0, 6); g.closePath();
          g.fillStyle = lg(g, 0, 0, 24, 0, [0, SC.lo, 0.5, SC.mid, 1, SC.hi]); g.fill(); g.strokeStyle = 'rgba(2,30,18,.85)'; g.lineWidth = 1.1; g.stroke();
          g.strokeStyle = 'rgba(220,255,236,.4)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(2, -2); g.lineTo(18 - i * 3, -0.5); g.stroke(); g.restore();
        }
        // upper teeth
        for (let i = 0; i < 15; i++) { const u = (i - 7) / 7, x = 200 + u * 70, y = 290 - (u * u) * 11; tooth(g, x, y, 4.4, 7 - abs(u) * 2.4, true); }
      },

      aux: function (g, P, T) {   // lower jaw sprite (closed position)
        const R = P.rng('jaw'), acc = P.accent, jw = T.jawShape;
        fillBase(g, jw, SC);
        scales(g, jw, 10.5, SC, R, {});
        lightPass(g, jw, SC, { d: 8, shade: 0.55, spec: 0.2, rim: acc, rimW: 8, rimA: 0.85, edge: 'rgba(2,30,18,.7)', edgeW: 1.2 });
        inClip(g, jw, () => { softPoly(g, [150, 300, 250, 300, 240, 332, 200, 342, 160, 332], BELLY.mid, 0.3, 6); });
        for (let i = 0; i < 13; i++) { const u = (i - 6) / 6, x = 200 + u * 66, y = 291 - (u * u) * 12; tooth(g, x, y, 3.8, 5.8 - abs(u) * 2, false); }
      },

      aux2: function (g, P, T) {   // dewlap sprite
        const R = P.rng('dew'), dw = shape(symPts([200, 322, 232, 326, 252, 344, 260, 372, 242, 404, 200, 418]), true);
        fillBase(g, dw, BELLY);
        inClip(g, dw, () => {
          g.strokeStyle = 'rgba(60,80,16,.55)'; g.lineWidth = 1.6;
          for (let i = 0; i < 9; i++) { const y = 334 + i * 9; g.beginPath(); g.moveTo(140, y); g.quadraticCurveTo(200, y + 8, 260, y); g.stroke(); }
        });
        lightPass(g, dw, BELLY, { d: 8, shade: 0.55, spec: 0.2, rim: P.accent, rimW: 7, rimA: 0.6 });
      },

      back: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph, flare = 0.7 * m.brow - 0.35 * Math.max(0, -m.brow) + 0.15 * Math.max(0, m.smile);
        const n = 9, bx = [], by = [], tx = [], ty = [];
        const fl = Math.pow(Math.max(0, sin(t * 0.43 + ph[3])), 12);
        for (let i = 0; i < n; i++) {
          const k = i - (n - 1) / 2, a = -PI / 2 + k * 0.25 * (1 + 0.25 * flare) + m.tilt + (m.bAsym ? k * 0.03 * m.bAsym : 0) + sin(t * 1.5 + i * 0.7 + ph[0]) * 0.025 + fl * sin(t * 17 + i) * 0.04;
          const L = (104 - abs(k) * 11) * (1 + 0.18 * flare) * (0.85 + 0.15 * (m.glow));
          bx.push(200 + k * 12); by.push(130 - (4 - abs(k)) * 3);
          tx.push(bx[i] + cos(a) * L); ty.push(by[i] + sin(a) * L);
        }
        for (let i = 0; i < n - 1; i++) {
          const mx = (tx[i] + tx[i + 1]) / 2, my = (ty[i] + ty[i + 1]) / 2 + 12 + (n - abs(i - 3.5)) * 0.4;
          g.beginPath(); g.moveTo(bx[i], by[i]); g.lineTo(tx[i], ty[i]); g.quadraticCurveTo(mx, my, tx[i + 1], ty[i + 1]); g.lineTo(bx[i + 1], by[i + 1]); g.closePath();
          g.fillStyle = lg(g, 200, 130, mx, my - 30, [0, dark(T.frill, 0.3), 0.6, T.frill, 1, lite(T.frill, 0.3)]); g.globalAlpha = 0.93; g.fill(); g.globalAlpha = 1;
          g.strokeStyle = 'rgba(60,10,6,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo((bx[i] + bx[i + 1]) / 2, (by[i] + by[i + 1]) / 2); g.lineTo(mx, my - 6); g.stroke();
        }
        g.lineCap = 'round';
        for (let i = 0; i < n; i++) {
          g.strokeStyle = 'rgba(2,24,14,.9)'; g.lineWidth = 7; g.beginPath(); g.moveTo(bx[i], by[i]); g.lineTo(tx[i], ty[i]); g.stroke();
          g.strokeStyle = lg(g, bx[i], by[i], tx[i], ty[i], [0, SC.mid, 1, SC.hi]); g.lineWidth = 4.6; g.stroke();
          g.strokeStyle = 'rgba(230,255,240,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx[i] - 1, by[i]); g.lineTo(tx[i] - 1, ty[i] + 1); g.stroke();
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph, e = T.eye;
        const open = clamp(m.open * 0.7 + A.talk, 0, 1), drop = open * 30;
        // dewlap breathing
        const dl = P.layers.aux2;
        if (dl) { g.save(); g.translate(200, 330); g.scale(1 + 0.03 * A.breath + A.talk * 0.04, 1 + 0.045 * A.breath); g.translate(-200, -330); blit(g, dl); g.restore(); }
        // mouth cavity + tongue
        if (open > 0.04) {
          g.save(); g.beginPath(); g.moveTo(122, 279); g.quadraticCurveTo(200, 301 - m.smile * 6, 278, 279); g.lineTo(272, 281 + drop); g.quadraticCurveTo(200, 304 + drop, 128, 281 + drop); g.closePath();
          g.fillStyle = lg(g, 0, 284, 0, 304 + drop, [0, '#1a0406', 1, '#6a1420']); g.fill(); g.restore();
        }
        const fl = Math.pow(Math.max(0, sin(t * 0.86 + ph[2])), 16) + A.talk * Math.max(0, sin(t * 13)) * 0.7;
        if (fl > 0.03) {
          const L = 18 + 62 * clamp(fl, 0, 1), wob = sin(t * 38) * 4 * fl, y0 = 293 + drop * 0.4, y1 = y0 + L;
          g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
          g.strokeStyle = '#7a1a2a'; g.lineWidth = 5.4; g.beginPath(); g.moveTo(200, y0); g.quadraticCurveTo(200 + wob * 0.5, y0 + L * 0.5, 200 + wob, y1); g.stroke();
          g.strokeStyle = '#e2506a'; g.lineWidth = 3.6; g.stroke();
          const fk = 9 + 5 * fl;
          g.strokeStyle = '#7a1a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(200 + wob, y1 - 4); g.lineTo(200 + wob - fk * 0.7, y1 + fk); g.moveTo(200 + wob, y1 - 4); g.lineTo(200 + wob + fk * 0.7, y1 + fk); g.stroke();
          g.strokeStyle = '#e2506a'; g.lineWidth = 2.4; g.stroke();
          g.restore();
        }
        // lower jaw
        const jw = P.layers.aux;
        if (jw) { g.save(); g.translate(200, 290); g.rotate(open * 0.05); g.translate(-200, -290 + drop); blit(g, jw); g.restore(); }
        // dynamic mouth line (smile / snarl)
        const sm = m.smile, as = m.asym;
        g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
        const lc = 279 - sm * 7, rc = 279 - sm * 7 - as * 5;
        g.strokeStyle = 'rgba(2,20,12,.9)'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(116, lc + 1); g.quadraticCurveTo(158, 289 - sm * 3, 200, 292); g.quadraticCurveTo(242, 289 - sm * 3, 284, rc + 1); g.stroke();
        g.strokeStyle = 'rgba(200,255,225,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(116, lc - 1.4); g.quadraticCurveTo(158, 287 - sm * 3, 200, 290); g.quadraticCurveTo(242, 287 - sm * 3, 284, rc - 1.4); g.stroke();
        g.restore();
        // eyes
        const eo = clamp(1 - A.blink - m.lid * 0.55 + m.browY * 0.1, 0, 1.2);
        const st = { dir: 1, ti: m.brow * 3, to: -m.brow * 1.2, lx: A.lx, ly: A.ly, pup: m.pup, lower: m.lower, open: eo };
        glow(g, T.ec, 134, 183, 38, 0.12 * m.glow); glow(g, T.ec, 266, 183, 38, 0.12 * m.glow);
        drawEye(g, 134, 184, e, st); st.dir = -1; drawEye(g, 266, 184, e, st);
        brow(g, -1, A, T); brow(g, 1, A, T);
      }
    };
  })();

  /* ======================================================================= SILICOID */
  PAINT.silicoid = (function () {
    const RAMP = [[0, '#0e1120'], [0.24, '#222a4a'], [0.46, '#3e4e82'], [0.66, '#6a82bc'], [0.84, '#a6bcec'], [1, '#f4ecd6']];
    const BRONZE = { hi: '#ffe2a2', mid: '#d09c4a', lo: '#7a4c1a', sh: '#331c08' };
    const AMB = '#ffb030';
    const HEAD_HALF = [200, 88, 238, 94, 272, 116, 294, 152, 298, 190, 288, 224, 268, 254, 246, 282, 220, 304, 200, 316];
    const SOCK = [-40, -4, -22, -24, 22, -24, 40, -4, 26, 22, -26, 22];
    const EYES = [150, 200, 250, 200];
    function ramp(t) {
      t = clamp(t, 0, 1);
      for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) return mixc(RAMP[i - 1][1], RAMP[i][1], (t - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]));
      return RAMP[RAMP.length - 1][1];
    }
    /* low-poly cut-stone shading: jittered triangle grid lit by a pseudo normal (o.split = chance to subdivide, o.amber = citrine facets) */
    function facets(g, sh, cell, R, o) {
      o = o || {};
      const bb = o.bb || sh.bb, cx = o.cx, cy = o.cy, rx = o.rx, ry = o.ry, tilt = o.tilt == null ? 0.5 : o.tilt;
      const cols = Math.ceil((bb[2] - bb[0]) / cell) + 3, rows = Math.ceil((bb[3] - bb[1]) / (cell * 0.9)) + 3, P = [];
      for (let r = 0; r <= rows; r++) { const row = []; for (let c = 0; c <= cols; c++) row.push([bb[0] + (c - 1) * cell + (r & 1) * cell * 0.5 + (R() - 0.5) * cell * 0.6, bb[1] + (r - 1) * cell * 0.9 + (R() - 0.5) * cell * 0.55]); P.push(row); }
      const L = [-0.55, -0.6, 0.58], ll = hypot(L[0], L[1], L[2]);
      g.save(); g.clip(sh.path); g.lineJoin = 'round';
      const paint = (a, b, c) => {
        const x = (a[0] + b[0] + c[0]) / 3, y = (a[1] + b[1] + c[1]) / 3;
        let nx = (x - cx) / rx, ny = (y - cy) / ry; const nn = nx * nx + ny * ny, nz = Math.sqrt(Math.max(0.05, 1 - Math.min(nn, 0.95)));
        nx += (R() - 0.5) * 2 * tilt; ny += (R() - 0.5) * 2 * tilt; const nzz = nz + (R() - 0.5) * tilt;
        const len = hypot(nx, ny, nzz), br = (nx * L[0] + ny * L[1] + nzz * L[2]) / (len * ll);
        const v = clamp(0.46 + br * 0.52 + (R() - 0.5) * 0.08 + (o.bias || 0), 0, 1);
        let col = ramp(v);
        if (o.amber && R() < o.amber) col = mixc(col, v > 0.55 ? '#ffd070' : '#c8701c', 0.5 + 0.3 * v);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath();
        g.fillStyle = col; g.fill();
        g.strokeStyle = rgba(v > 0.6 ? '#ffffff' : '#000010', v > 0.6 ? 0.16 : 0.34); g.lineWidth = 0.9; g.stroke();
      };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const a = P[r][c], b = P[r][c + 1], d = P[r + 1][c], e = P[r + 1][c + 1];
        const tris = (r & 1) ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]];
        for (let k = 0; k < 2; k++) {
          const q = tris[k];
          if (o.split && R() < o.split) {
            const m = [(q[0][0] + q[1][0] + q[2][0]) / 3 + (R() - 0.5) * cell * 0.2, (q[0][1] + q[1][1] + q[2][1]) / 3 + (R() - 0.5) * cell * 0.2];
            paint(q[0], q[1], m); paint(q[1], q[2], m); paint(q[2], q[0], m);
          } else paint(q[0], q[1], q[2]);
        }
      }
      g.restore();
    }
    function crystal(g, bx, by, L, w, tilt, base, glowCol) {
      g.save(); g.translate(bx, by); g.rotate(tilt);
      const yt = -L * 0.8, edges = [-w, -w * 0.3, w * 0.45, w], tipX = w * 0.05;
      const shade = [0.86, 0.6, 0.28];
      for (let i = 0; i < 3; i++) {
        const x0 = edges[i], x1 = edges[i + 1], tip = i === 1 ? tipX : tipX * 0.4;
        g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0, yt + (i === 1 ? 0 : L * 0.05)); g.lineTo(x0 + (x1 - x0) * 0.5 + tip, -L); g.lineTo(x1, yt + (i === 1 ? 0 : L * 0.05)); g.lineTo(x1, 0); g.closePath();
        g.fillStyle = lg(g, x0, 0, x1, -L, [0, mixc(base, '#10061a', 1 - shade[i]), 0.55, mixc(base, '#ffffff', shade[i] * 0.12), 1, mixc(base, '#ffffff', shade[i] * 0.5)]);
        g.globalAlpha = 0.94; g.fill(); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(255,240,200,.45)'; g.lineWidth = 0.9; g.stroke();
      }
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = lg(g, 0, 0, 0, -L, [0, rgba(glowCol, 0), 0.45, rgba(glowCol, 0.4), 1, rgba(glowCol, 0.06)]);
      g.beginPath(); g.moveTo(-w * 0.35, -2); g.lineTo(-w * 0.2, -L * 0.72); g.lineTo(w * 0.12, -L * 0.92); g.lineTo(w * 0.34, -2); g.closePath(); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(edges[1], -3); g.lineTo(edges[1] + 1, yt); g.stroke();
      g.restore();
    }
    function makeVeins(R, eyes) {
      const veins = [];
      const walk = (x, y, a, n, depth) => {
        const pts = [x, y];
        for (let i = 0; i < n; i++) {
          a += (R() - 0.5) * 1.3; x += cos(a) * (14 + R() * 14); y += sin(a) * (14 + R() * 14); pts.push(x, y);
          if (depth < 2 && R() < 0.28) walk(x, y, a + (R() < 0.5 ? 0.9 : -0.9), 2 + ((R() * 3) | 0), depth + 1);
        }
        veins.push(pts);
      };
      walk(150, 214, PI * 0.62, 6, 0); walk(250, 214, PI * 0.38, 6, 0); walk(200, 112, PI / 2, 5, 0);
      walk(130, 186, PI * 0.9, 4, 0); walk(270, 186, PI * 0.1, 4, 0);
      return veins;
    }
    function drawVeins(g, veins, w) {
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const v of veins) { g.beginPath(); g.moveTo(v[0], v[1]); for (let i = 2; i < v.length; i += 2) g.lineTo(v[i], v[i + 1]); g.lineWidth = w; g.stroke(); }
    }

    return {
      accent: '#ffc04a', bg: '#2a2438', defColor: '#d06a3a', pivot: [200, 345], badge: [200, 206, 150], grain: 0.045,
      traits: function (P) {
        const v = P.variant, R = P.rng('veins'), core = ['#ffb030', '#ff7a30', '#ffd860', '#ff4a50'][v % 4];
        const gl = []; const R2 = P.rng('glints'); for (let i = 0; i < 9; i++) gl.push([130 + R2() * 140, 110 + R2() * 190, R2()]);
        return {
          core: core, veins: makeVeins(R, EYES), glints: gl, head: pshape(symPts(HEAD_HALF)), shards: v % 3,
          sock: [shape(SOCK.map((q, i) => (i & 1 ? EYES[1] + q : EYES[0] + q)), true, [0, 1, 2, 3, 4, 5]), shape(SOCK.map((q, i) => (i & 1 ? EYES[3] + q : EYES[2] + q)), true, [0, 1, 2, 3, 4, 5])]
        };
      },

      aux: function (g, P, T) {   // crown crystals
        const R = P.rng('crown');
        const CC = ['#f0b050', '#e89040', '#f6cf78', '#b8682a', '#e8c070', '#8fd0e0'];
        for (let i = -3; i <= 3; i++) {
          const L = 66 + (3 - abs(i)) * 12 + R() * 22, w = 14 + R() * 7;
          crystal(g, 200 + i * 23, 128 - (3 - abs(i)) * 4, L, w, i * 0.16 + (R() - 0.5) * 0.12, CC[(R() * 6) | 0], T.core);
        }
        for (let i = 0; i < 4; i++) { const s = i < 2 ? -1 : 1; crystal(g, 200 + s * (112 + (i & 1) * 18), 168 + (i & 1) * 22, 46 + R() * 22, 10 + R() * 4, s * (0.55 + (i & 1) * 0.2), CC[(R() * 6) | 0], T.core); }
        for (let s = -1; s <= 1; s += 2) { crystal(g, 200 + s * 132, 360, 70, 15, s * 0.5, '#e89a48', T.core); crystal(g, 200 + s * 156, 372, 46, 11, s * 0.8, '#f0b868', T.core); }
      },

      aux2: function (g, P, T) {   // bright veins (additively pulsed)
        g.strokeStyle = '#fff0b0'; drawVeins(g, T.veins, 1.6);
        g.strokeStyle = rgba('#ff9a28', 0.9); drawVeins(g, T.veins, 3.4);
      },

      body: function (g, P, T) {
        const C = P.color, acc = P.accent, R = P.rng('body');
        const torso = shape([176, 340, 128, 346, 76, 364, 30, 396, -10, 442, -14, 520, 414, 520, 410, 442, 370, 396, 324, 364, 272, 346, 224, 340, 200, 350], true, [5, 6]);
        const tp = pshape(torso.pts);
        fillBase(g, torso, { hi: '#74829f', mid: '#2c3550', lo: '#10131c' });
        facets(g, torso, 44, R, { cx: 200, cy: 420, rx: 230, ry: 190, tilt: 0.55, split: 0.3, amber: 0.03 });
        g.save(); g.clip(torso.path);
        g.strokeStyle = 'rgba(8,10,16,.55)'; g.lineWidth = 2;
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-10, 380 + i * 34); g.lineTo(100 + i * 12, 372 + i * 38); g.lineTo(200, 392 + i * 30); g.lineTo(300 - i * 12, 372 + i * 38); g.lineTo(410, 380 + i * 34); g.stroke(); }
        // amber veins through the rock
        g.strokeStyle = rgba('#ff9a28', 0.5); g.lineWidth = 2.2; g.lineJoin = 'round';
        for (let i = 0; i < 4; i++) { const x = 40 + i * 110 + R() * 30; g.beginPath(); g.moveTo(x, 400 + R() * 20); for (let k = 0; k < 5; k++) g.lineTo(x + (R() - 0.5) * 50, 420 + k * 24 + R() * 10); g.stroke(); }
        g.restore();
        lightPass(g, torso, { hi: '#aebcd6', mid: '#46526e', lo: '#14181f', sh: '#000' }, { d: 16, shade: 0.45, spec: 0.2, rim: acc, rimW: 14, rimA: 0.85 });
        // cloth sash in banner colour over one shoulder
        const sash = pshape([92, 372, 122, 350, 380, 476, 360, 520]);
        litFill(g, sash, { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 6, edge: BRONZE.mid, edgeW: 1.8, rim: acc, rimW: 5, rimA: 0.55 });
        inClip(g, sash, () => { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; for (let i = 0; i < 80; i++) { g.beginPath(); g.moveTo(100 + i * 3.8, 360 + i * 2); g.lineTo(82 + i * 3.8, 392 + i * 2); g.stroke(); } blob(g, 150, 396, 50, 12, C.hi, 0.4, 0.5); });
        // chest core socket
        const cs = pshape([200, 396, 224, 410, 224, 438, 200, 452, 176, 438, 176, 410]);
        litFill(g, cs, BRONZE, { d: 4, edge: 'rgba(40,20,4,.95)', edgeW: 2, rim: acc, rimW: 3, rimA: 0.7 });
        fillBase(g, pshape([200, 404, 217, 414, 217, 434, 200, 444, 183, 434, 183, 414]), { hi: '#ffe090', mid: '#e8801c', lo: '#6a1c04' });
        g.strokeStyle = 'rgba(40,10,0,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(200, 404); g.lineTo(200, 444); g.moveTo(183, 414); g.lineTo(217, 434); g.moveTo(217, 414); g.lineTo(183, 434); g.stroke();
      },

      bodyDyn: function (g, P, T, A) {
        const p = 0.65 + 0.35 * sin(A.t * 1.7 + A.ph[0]) + A.talk * 0.5;
        glow(g, T.core, 200, 424, 56, 0.55 * p * A.m.glow); glow(g, '#fff4c0', 200, 424, 20, 0.5 * p);
      },

      collar: function (g, P, T) {
        const C = P.color, acc = P.accent;
        softPoly(g, [136, 336, 264, 336, 280, 372, 200, 392, 120, 372], '#000', 0.5, 7);
        const gp = shape([128, 336, 152, 366, 200, 380, 248, 366, 272, 336, 256, 330, 236, 350, 200, 358, 164, 350, 144, 330], true, [0, 5, 9]);
        litFill(g, gp, BRONZE, { d: 6, rim: acc, rimW: 7, rimA: 0.95, edge: 'rgba(40,20,4,.95)', edgeW: 1.8 });
        inClip(g, gp, () => { g.strokeStyle = 'rgba(60,30,6,.5)'; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const x = 146 + i * 13; g.beginPath(); g.moveTo(x, 336); g.lineTo(x + 3, 372); g.stroke(); } });
        litFill(g, pshape([200, 360, 210, 370, 200, 382, 190, 370]), { hi: C.hi, mid: C.mid, lo: C.lo, sh: C.deep }, { d: 2, spec: 0.7, edge: 'rgba(40,20,4,.95)', edgeW: 1.3 });
      },

      head: function (g, P, T) {
        const acc = P.accent, R = P.rng('head');
        // neck column
        const neck = shape([164, 280, 160, 330, 156, 372, 244, 372, 240, 330, 236, 280], true, [2, 3]);
        fillBase(g, neck, { hi: '#74829f', mid: '#2c3550', lo: '#10131c' });
        facets(g, neck, 22, R, { cx: 200, cy: 320, rx: 60, ry: 90, tilt: 0.5 });
        lightPass(g, neck, { hi: '#aebcd6', mid: '#46526e', lo: '#14181f', sh: '#000' }, { d: 8, shade: 0.55, spec: 0, rim: acc, rimW: 7, rimA: 0.8 });
        softPoly(g, [160, 284, 240, 284, 244, 330, 200, 344, 156, 330], '#000', 0.5, 7);
        // head
        const hd = T.head;
        fillBase(g, hd, { hi: '#74829f', mid: '#2c3550', lo: '#10131c' });
        facets(g, hd, 30, R, { cx: 200, cy: 200, rx: 116, ry: 134, tilt: 0.5, bias: 0.02, split: 0.38, amber: 0.07 });
        g.save(); g.clip(hd.path);
        // strata / mineral banding
        g.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const y = 116 + i * 28 + R() * 8; g.strokeStyle = 'rgba(' + (i % 2 ? '255,224,170' : '8,10,16') + ',' + (0.07 + R() * 0.07) + ')'; g.lineWidth = 2 + R() * 3; g.beginPath(); g.moveTo(100, y + R() * 10); g.quadraticCurveTo(200, y + 8 + R() * 14, 300, y - 6 + R() * 12); g.stroke(); }
        // inclusions
        for (let i = 0; i < 46; i++) { const x = 118 + R() * 164, y = 104 + R() * 200; g.fillStyle = R() > 0.5 ? 'rgba(255,230,170,.35)' : 'rgba(6,8,14,.4)'; g.beginPath(); g.moveTo(x, y - 2.4); g.lineTo(x + 2, y); g.lineTo(x, y + 2.4); g.lineTo(x - 2, y); g.closePath(); g.fill(); }
        // brow block + nose ridge + cheek wedges
        softPoly(g, [114, 164, 200, 150, 286, 164, 280, 180, 200, 172, 120, 182], '#04060c', 0.55, 3.5);
        softPoly(g, [114, 150, 200, 138, 286, 150, 200, 148], '#e6ecf8', 0.28, 3);
        softPoly(g, [190, 196, 200, 190, 210, 196, 214, 252, 200, 262, 186, 252], '#c9d4ea', 0.2, 3);
        softPoly(g, [204, 200, 212, 198, 218, 254, 204, 262], '#04060c', 0.4, 3);
        softPoly(g, [120, 232, 170, 244, 164, 288, 140, 262], '#04060c', 0.28, 6);
        softPoly(g, [280, 232, 232, 244, 238, 288, 262, 262], '#04060c', 0.4, 6);
        // jaw crack (the glowing voice seam is drawn dynamically)
        g.strokeStyle = 'rgba(2,3,8,.85)'; g.lineWidth = 2.2; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(150, 278); g.lineTo(164, 274); g.lineTo(176, 281); g.lineTo(190, 275); g.lineTo(204, 282); g.lineTo(220, 275); g.lineTo(234, 280); g.lineTo(250, 274); g.stroke();
        // heavy brow slab
        const bs = pshape([108, 164, 150, 154, 200, 150, 250, 154, 292, 164, 298, 180, 270, 178, 232, 184, 200, 180, 168, 184, 130, 178, 102, 180]);
        fillBase(g, bs, { hi: '#6a82bc', mid: '#3e4e82', lo: '#10142a' });
        facets(g, bs, 15, R, { cx: 200, cy: 168, rx: 110, ry: 40, tilt: 0.55, bias: -0.04, split: 0.3 });
        lightPass(g, bs, { hi: '#a6bcec', mid: '#3e4e82', lo: '#10142a', sh: '#000' }, { d: 6, shade: 0.55, spec: 0.2, rim: acc, rimW: 6, rimA: 0.8, edge: 'rgba(4,5,12,.9)', edgeW: 1.5 });
        // dark cracks along the veins
        g.strokeStyle = 'rgba(2,3,8,.8)'; drawVeins(g, T.veins, 2.2);
        g.restore();
        lightPass(g, hd, { hi: '#aebcd6', mid: '#46526e', lo: '#14181f', sh: '#000' }, { d: 14, shade: 0.5, spec: 0.12, rim: acc, rimW: 12, rimA: 0.95, edge: 'rgba(4,5,10,.85)', edgeW: 1.6 });
        // eye sockets
        for (let k = 0; k < 2; k++) {
          const so = T.sock[k];
          fillBase(g, so, { hi: '#10141c', mid: '#06080e', lo: '#000' });
          crescent(g, so, 5, 5, '#d8e4ff', 0.3, 3);
          g.strokeStyle = 'rgba(2,3,8,.95)'; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(so.path);
          g.strokeStyle = 'rgba(190,205,235,.35)'; g.lineWidth = 1; g.save(); g.translate(1, 1.5); g.stroke(so.path); g.restore();
        }
      },

      back: function (g, P, T, A) {
        const t = A.t, ph = A.ph, L = P.layers.aux;
        if (L) blit(g, L);
        // orbiting shards
        const n = 3 + T.shards;
        for (let i = 0; i < n; i++) {
          const a = t * (0.16 + i * 0.035) + ph[i] + i * 2.1, rr = 150 + i * 9, x = 200 + cos(a) * rr * 1.05, y = 232 + sin(a) * rr * 0.34 - 30 + sin(t * 0.7 + i) * 8, front = sin(a) > 0, sz = 9 + (i % 3) * 3;
          g.save(); g.translate(x, y); g.rotate(t * 0.6 + i);
          g.beginPath(); g.moveTo(0, -sz * 1.6); g.lineTo(sz * 0.7, 0); g.lineTo(0, sz * 1.6); g.lineTo(-sz * 0.7, 0); g.closePath();
          g.fillStyle = lg(g, -sz, -sz, sz, sz, [0, '#fff0c0', 0.5, '#e89a3c', 1, '#6a3410']); g.globalAlpha = front ? 0.95 : 0.55; g.fill();
          g.strokeStyle = 'rgba(40,20,4,.7)'; g.lineWidth = 1; g.stroke(); g.restore();
          glow(g, T.core, x, y, sz * 2.4, 0.2);
        }
      },

      dyn: function (g, P, T, A) {
        const m = A.m, t = A.t, ph = A.ph, gl = m.glow;
        const hd = T.head;
        // pulsing veins
        const V = P.layers.aux2;
        if (V) {
          const amp = 0.45 + 0.2 * sin(t * 1.5 + ph[0]) + A.talk * 0.6 + Math.max(0, gl - 1) * 0.5;
          g.save(); g.clip(hd.path); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(amp, 0, 1); blit(g, V);
          const k = ((t * 0.4 + ph[1] * 0.1) % 1.8) * 240 - 40;
          g.globalAlpha = 0.7 * gl; g.beginPath(); g.rect(80 + k - 20, 90, 40, 260); g.clip(); blit(g, V);
          g.restore();
        }
        // core eyes
        for (let k = 0; k < 2; k++) {
          const x = EYES[k * 2], y = EYES[k * 2 + 1], so = T.sock[k], dirIn = k === 0 ? 1 : -1;
          const flick = 0.9 + 0.1 * sin(t * 11 + k * 3 + ph[2]) * (m.glow < 0.9 ? 2 : 1) + A.talk * 0.25;
          glow(g, T.core, x, y, 66, 0.5 * gl * flick);
          g.save(); g.clip(so.path);
          const ox = x + A.lx * 7, oy = y + A.ly * 4;
          g.fillStyle = rgd(g, ox, oy, 1, 21, [0, '#fffbe6', 0.22, '#ffd05a', 0.55, T.core, 0.85, '#8a2a06', 1, '#2a0802']);
          g.beginPath(); g.arc(ox, oy, 21, 0, TAU); g.fill();
          glow(g, '#ffffff', ox, oy, 14, 0.55 * gl * flick);
          g.strokeStyle = 'rgba(60,16,2,.55)'; g.lineWidth = 1; g.beginPath(); g.arc(ox, oy, 12, 0, TAU); g.stroke();
          // stone-slab lid
          const asym = k === 0 ? m.bAsym : 0;
          const cover = clamp(0.3 + m.lid * 0.5 - m.browY * 0.2 + A.blink * 0.85 + asym * 0.28, 0, 1.05);
          const top = y - 26, bot = y + 22, yi = lerp(top, bot, clamp(cover + m.brow * 0.16 * 1, 0, 1.05)), yo = lerp(top, bot, clamp(cover - m.brow * 0.08, 0, 1.05));
          const xi = x + dirIn * 44, xo = x - dirIn * 44;
          g.beginPath(); g.moveTo(xo - dirIn * 2, top - 4); g.lineTo(xi + dirIn * 2, top - 4); g.lineTo(xi, yi); g.lineTo(xo, yo); g.closePath();
          g.fillStyle = lg(g, 0, top, 0, bot, [0, '#3a4560', 0.7, '#222a3e', 1, '#10141e']); g.fill();
          g.strokeStyle = 'rgba(200,215,245,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(xi, yi); g.lineTo(xo, yo); g.stroke();
          g.fillStyle = lg(g, 0, Math.min(yi, yo), 0, Math.min(yi, yo) + 16, [0, 'rgba(0,0,0,.6)', 1, 'rgba(0,0,0,0)']); g.fillRect(x - 46, Math.min(yi, yo), 92, 18);
          g.restore();
        }
        // voice seam (the mouth substitute)
        const a = A.talk, idle = 0.1 + 0.05 * sin(t * 1.4 + ph[3]);
        g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
        const seam = () => { g.beginPath(); g.moveTo(150, 278); g.lineTo(164, 274); g.lineTo(176, 281); g.lineTo(190, 275); g.lineTo(204, 282); g.lineTo(220, 275); g.lineTo(234, 280); g.lineTo(250, 274); };
        seam(); g.strokeStyle = rgba('#ff9a28', clamp(idle + a * 0.8, 0, 1)); g.lineWidth = 2.2 + a * 5; g.stroke();
        seam(); g.strokeStyle = rgba('#fff0b0', clamp(idle * 0.6 + a * 0.9, 0, 1)); g.lineWidth = 1 + a * 1.6; g.stroke();
        g.restore();
        if (a > 0.02) glow(g, '#ffb040', 200, 278, 40 + a * 30, 0.35 * a);
        // sweeping glints on the facets
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < T.glints.length; i++) {
          const q = T.glints[i], w = Math.pow(Math.max(0, sin(t * 1.1 - (q[0] + q[1]) * 0.028 + q[2] * 0.6)), 22);
          if (w < 0.03) continue;
          const s = 3 + w * 9;
          g.fillStyle = rgba('#fff4d0', w * 0.95); g.beginPath();
          g.moveTo(q[0], q[1] - s); g.lineTo(q[0] + s * 0.18, q[1] - s * 0.18); g.lineTo(q[0] + s, q[1]); g.lineTo(q[0] + s * 0.18, q[1] + s * 0.18); g.lineTo(q[0], q[1] + s);
          g.lineTo(q[0] - s * 0.18, q[1] + s * 0.18); g.lineTo(q[0] - s, q[1]); g.lineTo(q[0] - s * 0.18, q[1] - s * 0.18); g.closePath(); g.fill();
        }
        g.restore();
      }
    };
  })();

  /* @@RACES@@ */

  const NAMES = { alkari: 'Alkari', bulrathi: 'Bulrathi', darlok: 'Darlok', human: 'Human', klackon: 'Klackon', meklar: 'Meklar', mrrshan: 'Mrrshan', psilon: 'Psilon', sakkra: 'Sakkra', silicoid: 'Silicoid' };
  M.Gfx.Portraits = {
    RACES: RACES, MOODS: MOODS, NAMES: NAMES,
    draw: draw, canvas: canvas, drawBadge: drawBadge,
    accent: function (race) { return PAINT[race] ? PAINT[race].accent : '#d6b36a'; },
    clearCache: function () { _ents.clear(); _cc.clear(); _states.clear(); }
  };
})(window.MOO);
