// Master of Orion — Reborn · MOO.Gfx.Icons
// Original vector glyph set. 24x24 grid, solid fills with even-odd cut-outs, 45-degree chamfers instead of rounded
// corners (matches the chamfered panels), one visual weight. Everything is painted with currentColor so CSS colours it.
// The host rule `.ico { fill: currentColor; stroke: none }` means every STROKED element carries its own stroke attributes.
//
//   Icons.has(name) -> bool                 Icons.names() -> string[]
//   Icons.svg(name, {size, cls, title})     Icons.defs[name] -> inner SVG markup
//   Icons.dataUrl(name, color)              (extra) data: URI with a concrete colour, for canvas / <img>
(function (M) {
  'use strict';
  M.Gfx = M.Gfx || {};

  // ------------------------------------------------------------------------------------------ geometry helpers
  const f = n => String(Math.round(n * 100) / 100);
  const pp = p => f(p[0]) + ' ' + f(p[1]);
  const poly = (pts, open) => 'M' + pts.map(pp).join('L') + (open ? '' : 'Z');
  const circ = (cx, cy, r) => 'M' + f(cx - r) + ' ' + f(cy) + 'a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(2 * r) + ' 0a' + f(r) + ' ' + f(r) + ' 0 1 0 ' + f(-2 * r) + ' 0Z';
  const ring = (cx, cy, ro, ri) => circ(cx, cy, ro) + circ(cx, cy, ri);
  const rectP = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const rect = (x, y, w, h) => poly(rectP(x, y, w, h));
  const D2R = Math.PI / 180;
  // cut every corner of a polygon at 45 degrees: c = distance along each edge (number, or per-vertex array)
  function chamfer(pts, c) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const v = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], ci = Array.isArray(c) ? (c[i] || 0) : c;
      if (!ci) { out.push(v); continue; }
      const da = Math.hypot(a[0] - v[0], a[1] - v[1]), db = Math.hypot(b[0] - v[0], b[1] - v[1]);
      out.push([v[0] + (a[0] - v[0]) / da * ci, v[1] + (a[1] - v[1]) / da * ci], [v[0] + (b[0] - v[0]) / db * ci, v[1] + (b[1] - v[1]) / db * ci]);
    }
    return out;
  }
  const cpoly = (pts, c) => poly(chamfer(pts, c));
  const crect = (x, y, w, h, c) => cpoly(rectP(x, y, w, h), c);
  const rot = (pts, deg, cx, cy) => {
    cx = cx === undefined ? 12 : cx; cy = cy === undefined ? 12 : cy;
    const s = Math.sin(deg * D2R), c = Math.cos(deg * D2R);
    return pts.map(p => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]);
  };
  const mir = pts => pts.map(p => [24 - p[0], p[1]]);
  const sym = h => h.concat(mir(h.slice().reverse()).filter(p => p[0] !== 12));      // right half (top->bottom) -> full outline
  const reg = (n, cx, cy, r, a0) => { const o = []; for (let i = 0; i < n; i++) { const a = (a0 + 360 / n * i) * D2R; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  const oct = (cx, cy, ap) => reg(8, cx, cy, ap / Math.cos(22.5 * D2R), 22.5);       // flat-sided octagon by apothem
  const burst = (n, ro, ri, cx, cy, a0) => { const o = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = (a0 + i * 180 / n) * D2R; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; };
  const spark = (cx, cy, ro, ri) => poly(burst(4, ro, ri, cx, cy, -90));
  const ell = (cx, cy, rx, ry, deg) => { const o = []; for (let i = 0; i < 18; i++) { const a = i * 20 * D2R; o.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return poly(rot(o, deg, cx, cy)); };
  const pol = (cx, cy, r, deg) => [cx + r * Math.cos(deg * D2R), cy + r * Math.sin(deg * D2R)];
  // circular arc as an open path; angles in degrees, clockwise from +x on screen (a1 > a0 draws clockwise)
  const arc = (cx, cy, r, a0, a1) => {
    const p = pol(cx, cy, r, a0), q = pol(cx, cy, r, a1);
    return 'M' + pp(p) + 'A' + f(r) + ' ' + f(r) + ' 0 ' + (Math.abs(a1 - a0) > 180 ? 1 : 0) + ' ' + (a1 > a0 ? 1 : 0) + ' ' + pp(q);
  };
  // leaf / grain / blade: kite from (x,y) pointing at `deg`, length len, width w
  const leaf = (x, y, deg, len, w, k) => rot([[x, y], [x + len * (k || 0.45), y - w / 2], [x + len, y], [x + len * (k || 0.45), y + w / 2]], deg, x, y);
  // lens-shaped leaf (two arcs meeting at pointed ends) from (x,y) pointing at `deg`
  const leafL = (x, y, deg, len, w) => {
    const up = [], dn = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, h = w / 2 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1 - 0.18 * t); up.push([x + len * t, y - h]); dn.push([x + len * t, y + h]); }
    return rot(up.concat(dn.reverse().slice(1, -1)), deg, x, y);
  };
  // circle1 minus circle2 as one closed path
  function crescent(c1, r1, c2, r2) {
    const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
    const mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
    const p1 = [mx + h * dy / d, my - h * dx / d], p2 = [mx - h * dy / d, my + h * dx / d];
    const x1 = (p1[0] - c1[0]) * (p2[1] - c1[1]) - (p1[1] - c1[1]) * (p2[0] - c1[0]);
    const x2 = (p2[0] - c2[0]) * (p1[1] - c2[1]) - (p2[1] - c2[1]) * (p1[0] - c2[0]);
    return 'M' + pp(p1) + 'A' + f(r1) + ' ' + f(r1) + ' 0 1 ' + (x1 > 0 ? 0 : 1) + ' ' + pp(p2) +
      'A' + f(r2) + ' ' + f(r2) + ' 0 ' + ((d - a) > 0 ? 0 : 1) + ' ' + (((x2 > 0) === ((d - a) > 0)) ? 1 : 0) + ' ' + pp(p1) + 'Z';
  }
  // grow (d > 0) / shrink (d < 0) a clockwise polygon with mitred corners
  function offset(pts, d) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], v = pts[i], b = pts[(i + 1) % n];
      let x1 = v[0] - a[0], y1 = v[1] - a[1], x2 = b[0] - v[0], y2 = b[1] - v[1];
      const l1 = Math.hypot(x1, y1), l2 = Math.hypot(x2, y2); x1 /= l1; y1 /= l1; x2 /= l2; y2 /= l2;
      const nx = y1 + y2, ny = -x1 - x2, k = d / (1 + (y1 * y2 + x1 * x2));
      out.push([v[0] + nx * k, v[1] + ny * k]);
    }
    return out;
  }
  // Sutherland-Hodgman against one half-plane: keep points where side(p) >= 0
  function clipHalf(pts, side) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], da = side(a), db = side(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // thick line segment as a polygon (butt ends)
  const seg = (p, q, w) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy), nx = -dy / l * w / 2, ny = dx / l * w / 2;
    return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny], [q[0] - nx, q[1] - ny], [p[0] - nx, p[1] - ny]];
  };
  // block arrow from p0 to p1: shaft width th, head half-width hw and length hl
  function arrowP(p0, p1, th, hw, hl) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const e = [p1[0] - ux * hl, p1[1] - uy * hl], at = (p, s) => [p[0] + nx * s, p[1] + ny * s];
    return [at(p0, th / 2), at(e, th / 2), at(e, hw), p1, at(e, -hw), at(e, -th / 2), at(p0, -th / 2)];
  }
  // arrowhead sitting on a circle at angle a (clockwise travel), for circular arrows
  function arcHead(cx, cy, r, a, len, hw) {
    const p = pol(cx, cy, r, a), t = [-Math.sin(a * D2R), Math.cos(a * D2R)], n = [Math.cos(a * D2R), Math.sin(a * D2R)];
    return poly([[p[0] + t[0] * len, p[1] + t[1] * len], [p[0] + n[0] * hw, p[1] + n[1] * hw], [p[0] - n[0] * hw, p[1] - n[1] * hw]]);
  }
  // gear outline: n trapezoid teeth between root radius ri and tip radius ro
  function gear(n, ro, ri, cx, cy, a0, rootHalf, tipHalf) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + 360 / n * i;
      pts.push(pol(cx, cy, ri, a - rootHalf), pol(cx, cy, ro, a - tipHalf), pol(cx, cy, ro, a + tipHalf), pol(cx, cy, ri, a + rootHalf));
    }
    return pts;
  }
  // scale about the grid centre, rotate, then move the centre to (cx, cy)
  const place = (pts, s, deg, cx, cy) => rot(pts.map(p => [12 + (p[0] - 12) * s, 12 + (p[1] - 12) * s]), deg).map(p => [p[0] + cx - 12, p[1] + cy - 12]);

  // element builders -------------------------------------------------------------------------------------
  const fp = d => '<path fill-rule="evenodd" d="' + d + '"/>';                                      // solid fill, even-odd holes
  const sp = (d, w, cap, join) => '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="' + (w || 2) +
    '" stroke-linecap="' + (cap || 'square') + '" stroke-linejoin="' + (join || 'bevel') + '"/>';   // stroked line work (explicit attrs)
  const U = function () { let s = ''; for (let i = 0; i < arguments.length; i++) s += fp(arguments[i]); return s; };   // union of separate solid shapes
  const grp = (inner, deg, cx, cy, tx, ty) => '<g transform="' + (tx || ty ? 'translate(' + (tx || 0) + ' ' + (ty || 0) + ') ' : '') + 'rotate(' + deg + ' ' + (cx === undefined ? 12 : cx) + ' ' + (cy === undefined ? 12 : cy) + ')">' + inner + '</g>';
  // teardrop pointing up: round bulb radius r at (cx, cy), tip 2.2r above the centre
  const drop = (cx, cy, r) => {
    const h = 2.2 * r, ph = Math.acos(r / h), sx = r * Math.sin(ph), sy = r * Math.cos(ph);
    return 'M' + pp([cx, cy - h]) + 'L' + pp([cx + sx, cy - sy]) + 'A' + f(r) + ' ' + f(r) + ' 0 1 1 ' + pp([cx - sx, cy - sy]) + 'Z';
  };

  const defs = {};
  const def = (name, inner) => { defs[name] = inner; };

  // ================================================================================================ SHIPS
  const SHIP = [[12, 2], [15, 8.4], [15, 12], [21.6, 17.8], [21.6, 21.4], [16.2, 19.6], [14.6, 22], [12, 20.2]];
  const DART = [[12, 2], [13.6, 8.8], [13.6, 14], [17.6, 19.4], [17.6, 21.8], [13.2, 19.8], [12, 21]];
  def('ship', fp(poly(sym(SHIP)) + poly([[12, 5.6], [13.3, 8], [13.3, 10.6], [10.7, 10.6], [10.7, 8]])));

  const miniShip = (cx, top, s) => poly(sym(SHIP).map(p => [cx + (p[0] - 12) * s, top + (p[1] - 2) * s]));
  def('fleet', fp(miniShip(12, 1.4, 0.5) + miniShip(6.4, 12.2, 0.5) + miniShip(17.6, 12.2, 0.5)));

  // scout: a ship heading for a magnifying glass
  def('scout', U(poly(place(sym(SHIP), 0.52, 45, 8.4, 15.6)), ring(16.4, 7.4, 4.9, 2.7), poly(seg([19.9, 10.9], [21.9, 12.9], 2.8))));

  // colony ship: a ship approaching a world
  def('colonyship', U(poly(place(sym(SHIP), 0.58, 45, 8.9, 14.9))) + ringedPlanet(17.3, 6.9, 4.7, 24, 0.7, 0.8, 5.9));

  // transport: side-on freighter with a deck of containers
  def('transport',
    fp(cpoly([[3, 13.4], [19.2, 13.4], [22.6, 16.4], [22.6, 21.4], [3, 21.4]], [1.4, 0, 0, 1.2, 1.4]) + crect(17.4, 15.2, 3.4, 2.4, 0.6)) +
    fp(crect(4.2, 6, 4.8, 6.2, 0.8) + crect(10.2, 6, 4.8, 6.2, 0.8) + crect(16.2, 6, 4.8, 6.2, 0.8)));

  // warship: side-on gunboat, turret with a long barrel
  def('warship', U(
    cpoly([[2.4, 15], [14, 15], [22.4, 18.2], [14, 21.4], [2.4, 21.4]], [1.2, 0, 0, 0, 1.2]),
    crect(6, 9, 8.6, 4.8, 1.4) + rect(14.6, 10.4, 7.6, 2.2),
    poly([[2.4, 13.4], [2.4, 8.6], [5, 8.6], [7.4, 13.4]])));

  def('starbase',
    fp(poly(oct(12, 12, 9.8)) + poly(oct(12, 12, 7.4))) +
    fp(rect(10.9, 4.4, 2.2, 5) + rect(10.9, 14.6, 2.2, 5) + rect(4.4, 10.9, 5, 2.2) + rect(14.6, 10.9, 5, 2.2)) +
    fp(poly(oct(12, 12, 3.8)) + circ(12, 12, 1.4)));

  // stargate: segmented ring around a spark of energy
  (function () {
    const ro = 10.6, ri = 6.6, g = 7;                              // gap angle at the outer radius; inner gap widened to stay parallel
    const gi = g * ro / ri;
    let d = '';
    for (let i = 0; i < 8; i++) {
      const c = i * 45 + 22.5, a0 = c - 22.5 + g / 2, a1 = c + 22.5 - g / 2, b0 = c - 22.5 + gi / 2, b1 = c + 22.5 - gi / 2;
      d += 'M' + pp(pol(12, 12, ro, a0)) + 'A' + ro + ' ' + ro + ' 0 0 1 ' + pp(pol(12, 12, ro, a1)) + 'L' + pp(pol(12, 12, ri, b1)) + 'A' + ri + ' ' + ri + ' 0 0 0 ' + pp(pol(12, 12, ri, b0)) + 'Z';
    }
    def('stargate', fp(d) + fp(spark(12, 12, 4.9, 1.4)));
  })();

  // ================================================================================================ WORLDS & SPACE
  def('colony',
    fp(cpoly(rectP(2, 18.2, 20, 3.8), 1.4)) +
    fp('M3.8 16.2A8.2 8.2 0 0 1 20.2 16.2Z' + cpoly([[10.4, 16.2], [10.4, 12.4], [13.6, 12.4], [13.6, 16.2]], [0, 1, 1, 0])) +
    fp(rect(11.25, 2, 1.5, 6.6) + poly([[12.75, 2.2], [18.6, 4.3], [12.75, 6.4]])));

  def('home', U(
    poly([[12, 2.2], [22.4, 11.2], [1.6, 11.2]]) + poly(burst(5, 2.9, 1.2, 12, 8.6, -90)),
    cpoly(rectP(4.4, 12.6, 15.2, 9.2), [0, 0, 1, 1]) + poly([[9.6, 21.8], [9.6, 16], [14.4, 16], [14.4, 21.8]])));

  // ringed planet: ring tips poke out, the ring in front of the disc is a band with a gap either side
  function ringedPlanet(cx, cy, r, tilt, vc, hb, A) {
    const hg = hb + 1.3, T = (u, v) => rot([[cx + u, cy + v]], tilt, cx, cy)[0];
    const u0 = Math.sqrt(r * r - (vc - hg) * (vc - hg)), u1 = Math.sqrt(r * r - (vc + hg) * (vc + hg));
    const top = 'M' + pp(T(-u0, vc - hg)) + 'A' + r + ' ' + r + ' 0 0 1 ' + pp(T(u0, vc - hg)) + 'Z';
    const bot = 'M' + pp(T(u1, vc + hg)) + 'A' + r + ' ' + r + ' 0 0 1 ' + pp(T(-u1, vc + hg)) + 'Z';
    const band = poly([T(-A, vc), T(-A + 1.8, vc - hb), T(A - 1.8, vc - hb), T(A, vc), T(A - 1.8, vc + hb), T(-A + 1.8, vc + hb)]);
    return fp(top) + fp(bot) + fp(band);
  }
  def('planet', ringedPlanet(12, 12.6, 7.4, -24, 1.1, 1.2, 11.2));

  (function () {                                    // sun with eight rays
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = -90 + 45 * i, ro = i % 2 ? 9.4 : 11, ri = 6.4, hw = i % 2 ? 1.7 : 2;
      const t = pol(12, 12, ro, a), b = pol(12, 12, ri, a), n = pol(0, 0, hw, a + 90);
      rays.push(poly([[b[0] + n[0], b[1] + n[1]], t, [b[0] - n[0], b[1] - n[1]]]));
    }
    def('star', fp(circ(12, 12, 4.6)) + fp(rays.join('')));
  })();

  (function () {                                    // two tapered spiral arms and a core
    let arms = '';
    for (let k = 0; k < 2; k++) {
      const out = [], inn = [], N = 22;
      for (let i = 0; i <= N; i++) {
        const t = i / N, th = (k * 180 - 20 + 268 * t), r = 3.6 + 6.2 * t, w = 3.2 - 2.0 * t;
        out.push(pol(12, 12, r + w / 2, th)); inn.push(pol(12, 12, r - w / 2, th));
      }
      arms += poly(out.concat(inn.reverse()));
    }
    def('galaxy', fp(arms) + fp(circ(12, 12, 3)));
  })();

  def('orbit',
    fp(circ(12, 12, 3.2)) + sp(arc(12, 12, 8.8, -17, 287), 2, 'butt') + fp(circ(pol(12, 12, 8.8, -45)[0], pol(12, 12, 8.8, -45)[1], 2.9)));

  def('moon', fp(crescent([11, 12.6], 9.4, [16.4, 8.4], 7.6)));

  def('asteroid',
    fp(poly([[3, 12.5], [5.6, 7.4], [10.6, 5.4], [15.6, 7.4], [18, 12.4], [16.4, 18], [11.4, 20.6], [6, 19.4], [3.4, 16.4]]) +
      circ(8.6, 11.8, 2) + circ(13.2, 15.4, 2.3) + circ(13, 9.6, 1.1)) +
    fp(poly([[18.2, 2.8], [21.4, 3.6], [22, 6.6], [19.2, 8], [17.4, 5.6]])) +
    fp(poly([[20.2, 12.2], [22.4, 13.2], [21.8, 15.6], [19.4, 15]])));

  (function () {                                    // banded gas giant with a small moon
    const cx = 11.4, cy = 13, r = 8.6, xr = y => Math.sqrt(r * r - (y - cy) * (y - cy));
    const strip = (y0, y1) => poly([[cx - xr(y0), y0], [cx + xr(y0), y0], [cx + xr(y1), y1], [cx - xr(y1), y1]]);
    def('gasgiant', fp(circ(cx, cy, r) + strip(8.1, 9.5) + strip(12, 13.4) + strip(15.9, 17.3)) + fp(circ(20.2, 4.4, 2)));
  })();

  // ================================================================================================ ECONOMY
  def('pop', U(
    circ(7.6, 8, 3.2) + cpoly([[1.4, 21], [1.4, 16.8], [4, 13.2], [11.2, 13.2], [13.8, 16.8], [13.8, 21]], 0),
    circ(17.6, 9, 2.7) + cpoly([[15.6, 21], [15.6, 14.6], [16.8, 13.6], [18.6, 13.6], [21.6, 16.6], [21.6, 21]], 0)));

  def('food', U(
    rect(10.8, 8, 2.4, 14),
    poly(leaf(12.8, 19.4, -45, 7, 3.8)), poly(leaf(11.2, 19.4, -135, 7, 3.8)),
    poly(leaf(12.8, 12.8, -45, 7, 3.8)), poly(leaf(11.2, 12.8, -135, 7, 3.8)),
    poly(leaf(12, 9.4, -90, 8, 4))));

  def('industry', fp(cpoly([[2.5, 21.5], [2.5, 10], [9.2, 13.8], [9.2, 10], [16, 13.9], [16, 3.2], [19.8, 3.2], [19.8, 12], [21.5, 12], [21.5, 21.5]], [1, 0, 0, 0, 0, 0.9, 0.9, 0, 0, 1]) +
    rect(4.4, 16, 2.8, 2.8) + rect(10.6, 16, 2.8, 2.8) + rect(16.8, 16, 2.8, 2.8)));

  (function () {                                    // flask: glass wall + liquid with bubbles
    const O = [[8.8, 2], [15.2, 2], [15.2, 9.4], [21.2, 19.8], [19.4, 22], [4.6, 22], [2.8, 19.8], [8.8, 9.4]];
    const I = offset(O, -1.9), L = clipHalf(offset(I, 0.4), p => p[1] - 14.4);
    def('research', fp(poly(O) + poly(I)) + fp(poly(L) + circ(10.2, 18.6, 1.15) + circ(14.2, 16.9, 0.85)));
  })();

  def('money', fp(circ(12, 12, 9.6) + poly(reg(6, 12, 12, 5.8, -90)) + poly(reg(6, 12, 12, 2.7, -90))));

  def('defense', fp(cpoly([[4, 3.4], [20, 3.4], [20, 12.4], [12, 21.8], [4, 12.4]], [2, 2, 0.8, 0, 0.8]) +
    poly([[6.6, 9], [12, 14], [17.4, 9], [17.4, 11.8], [12, 16.8], [6.6, 11.8]])));

  (function () {                                    // three chasing arrows
    const V = [[12, 2.6], [21.6, 19.2], [2.4, 19.2]], at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    let s = '';
    for (let i = 0; i < 3; i++) s += poly(arrowP(at(V[i], V[(i + 1) % 3], 0.13), at(V[i], V[(i + 1) % 3], 0.9), 3, 3.5, 4.6));
    def('ecology', fp(s));
  })();

  def('waste', U(
    cpoly([[3, 3.4], [15.6, 3.4], [15.6, 21.8], [3, 21.8]], 1.8) + rect(3, 8, 12.6, 1.4) + rect(3, 16, 12.6, 1.4),
    drop(19.4, 17.6, 2.5), drop(19.8, 10.8, 1.6)));

  def('terraform',
    fp(circ(12, 12, 4.6)) + sp(arc(12, 12, 8.9, -168, -40), 2.2, 'butt') + sp(arc(12, 12, 8.9, 12, 140), 2.2, 'butt') +
    fp(arcHead(12, 12, 8.9, -40, 3.8, 3.2) + arcHead(12, 12, 8.9, 140, 3.8, 3.2)));

  def('minerals',
    fp(poly([[12, 2], [16.2, 6.4], [16.2, 19.6], [12, 22], [7.8, 19.6], [7.8, 6.4]]) + poly([[11.35, 8.4], [12, 7.8], [12.65, 8.4], [12.65, 19.4], [11.35, 19.4]])) +
    fp(poly([[1.8, 21.6], [2.4, 13], [5.2, 8.6], [7, 13], [6.6, 21.6]])) +
    fp(poly([[17.4, 21.6], [17, 14.4], [19.6, 10.4], [22.2, 14.4], [21.8, 21.6]])));

  def('fuel', U(
    cpoly([[3.8, 7.4], [17.2, 7.4], [20.2, 10.4], [20.2, 21.6], [3.8, 21.6]], [1.2, 0, 0, 1.2, 1.2]) + drop(12, 15.6, 2.9),
    cpoly([[5.6, 8.2], [5.6, 2.8], [13.4, 2.8], [13.4, 8.2], [11.4, 8.2], [11.4, 4.8], [7.6, 4.8], [7.6, 8.2]], [0, 0.8, 0.8, 0, 0, 0, 0, 0]),
    crect(14.6, 3.8, 3.4, 4, 0.8)));

  (function () {                                    // isometric crate over a pair of exchange arrows
    const cx = 12, cy = 6.5, R = 5.6, w = R * 0.866, h = R / 2, g = 0.6;
    const faces = [
      [[cx, cy - R], [cx + w, cy - h], [cx, cy], [cx - w, cy - h]],
      [[cx - w, cy - h], [cx, cy], [cx, cy + R], [cx - w, cy + h]],
      [[cx + w, cy - h], [cx + w, cy + h], [cx, cy + R], [cx, cy]]];
    def('trade', U.apply(null, faces.map(fc => poly(offset(fc, -g)))) +
      U(poly(arrowP([2.6, 15], [21.4, 15], 2.2, 2.3, 3.4)), poly(arrowP([21.4, 20.2], [2.6, 20.2], 2.2, 2.3, 3.4))));
  })();

  def('tribute', fp(poly([[8, 2.4], [12, 4.2], [16, 2.4], [15, 6.4], [19.6, 10.6], [21.4, 16.4], [18.6, 21.8], [5.4, 21.8], [2.6, 16.4], [4.4, 10.6], [9, 6.4]]) +
    poly(reg(6, 12, 15, 4.6, -90)) + poly(reg(6, 12, 15, 2, -90))));

  // ================================================================================================ RESEARCH FIELDS
  def('computers', U(
    crect(5.4, 5.4, 13.2, 13.2, 1.8) + crect(8.6, 8.6, 6.8, 6.8, 0.8),
    crect(10.6, 10.6, 2.8, 2.8, 0.4),
    rect(7, 2, 2, 3), rect(11, 2, 2, 3), rect(15, 2, 2, 3), rect(7, 19, 2, 3), rect(11, 19, 2, 3), rect(15, 19, 2, 3),
    rect(2, 7, 3, 2), rect(2, 11, 3, 2), rect(2, 15, 3, 2), rect(19, 7, 3, 2), rect(19, 11, 3, 2), rect(19, 15, 3, 2)));

  def('construction', grp(U(crect(5.5, 3.2, 13, 7, 1.5), crect(10.6, 11, 2.8, 10.6, 0.8)), -45));

  // a ship inside an energy bubble
  def('forcefield', fp(ring(12, 12, 10.4, 8.5)) + U(poly(place(sym(DART), 0.68, 0, 12, 12.2))) + sp(arc(12, 12, 6.6, 194, 252), 1.8, 'butt') + sp(arc(12, 12, 6.6, 16, 34), 1.8, 'butt'));

  // a ringed world with a seedling growing out of it
  def('planetology', ringedPlanet(12, 15.8, 6.2, -24, 1, 1, 10) + U(
    poly(leafL(12.2, 6.4, -28, 8, 4.4)), poly(leafL(11.8, 6.4, -152, 8, 4.4)), rect(11.2, 5.6, 1.6, 4.6)));

  def('propulsion', grp(U(
    poly(sym([[12, 1.8], [14.4, 5.2], [14.9, 9], [14.9, 12.6], [19, 17.4], [19, 19.8], [14.9, 18.2], [13.6, 19.2], [12, 19.2]])) + circ(12, 9.2, 2),
    poly([[10.4, 20.4], [13.6, 20.4], [12, 23.4]])), 45, 12, 12.6));

  def('weapons', U(
    poly(burst(8, 7.6, 3.7, 12, 12, -67.5)) + circ(12, 12, 1.5),
    rect(10.9, 1.4, 2.2, 3.6), rect(10.9, 19, 2.2, 3.6), rect(1.4, 10.9, 3.6, 2.2), rect(19, 10.9, 3.6, 2.2)));

  // ================================================================================================ SHIP COMPONENTS
  // retro ray-gun firing a bolt
  def('beam', U(
    cpoly([[1.8, 8.6], [13.8, 8.6], [16.2, 10.4], [16.2, 13.6], [13.8, 15.4], [1.8, 15.4]], [1, 0, 0, 0, 0, 1]) + rect(12.6, 8.6, 1.2, 6.8),
    poly([[3.4, 8], [5, 4.8], [9, 4.8], [10.2, 8]]),
    cpoly([[3.6, 16.2], [8.4, 16.2], [7.6, 21.4], [3.2, 21.4]], 0.6),
    spark(19.2, 12, 3.3, 1)));

  def('missile', grp(U(
    poly(sym([[12, 1.6], [14.2, 5.4], [14.6, 9], [14.6, 14.4], [18.2, 18.8], [18.2, 21.4], [14.6, 19.6], [13.4, 21.4], [12, 21.4]])) + rect(9.4, 9.8, 5.2, 1.2)), 45, 12, 11.5, 2, -1.2));

  def('bomb', U(
    circ(10.4, 14.6, 7.4) + circ(7.6, 11.8, 1.5),
    poly(rot(rectP(14.3, 7.4, 3.4, 3), 45, 16, 8.9))) +
    sp('M17.6 7.6L19.4 5.8L18.4 4.7', 1.6) + fp(spark(20.3, 3.5, 2.5, 0.8)));

  // bolted octagonal plate with a sheen
  def('armor', fp(cpoly(rectP(3.6, 3.6, 16.8, 16.8), 3.2) + circ(7.2, 7.2, 1.05) + circ(16.8, 7.2, 1.05) + circ(7.2, 16.8, 1.05) + circ(16.8, 16.8, 1.05) +
    poly([[8.4, 15.6], [15.6, 8.4], [16.8, 9.6], [9.6, 16.8]]) + poly([[11.4, 16.6], [16.6, 11.4], [17.5, 12.3], [12.3, 17.5]])));

  // deflector: hollow shield carrying a bolt of energy
  (function () {
    const O = chamfer([[4, 3.4], [20, 3.4], [20, 12.4], [12, 21.8], [4, 12.4]], [2, 2, 0.8, 0, 0.8]);
    def('shield', fp(poly(O) + poly(offset(O, -2.1))) + fp(poly([[13.2, 5.6], [8.8, 12], [11.4, 12], [10.9, 15.8], [15.2, 9.8], [12.6, 9.8]])));
  })();

  // thruster: engine block, bell nozzle and three jets of plasma
  def('engine', U(
    crect(7, 2, 10, 5, 1.2) + rect(7, 4, 10, 0.9),
    cpoly([[8.6, 7.8], [15.4, 7.8], [18.8, 13.2], [5.2, 13.2]], 0.5),
    cpoly([[6.6, 14.8], [9.6, 14.8], [9.6, 19], [8.1, 20.4], [6.6, 19]], 0), cpoly([[10.5, 14.8], [13.5, 14.8], [13.5, 20.4], [12, 22.2], [10.5, 20.4]], 0),
    cpoly([[14.4, 14.8], [17.4, 14.8], [17.4, 19], [15.9, 20.4], [14.4, 19]], 0)));

  // radar dish firing jagged interference
  def('ecm', grp(U('M2.6 12A9.4 5.4 0 0 0 21.4 12Z', rect(11.1, 4.8, 1.8, 7.4) + circ(12, 4.4, 1.5)), 30) +
    U(rect(8.3, 16.4, 2, 4.2), crect(5, 20.2, 8.6, 2.2, 0.8)) + sp('M17 2.8L19.2 4.5L17.5 5.9L20.2 7.9', 1.9));

  def('special', fp(poly(gear(10, 10.6, 7.8, 12, 12, -90, 8, 5.2)) + poly(burst(5, 5.5, 2.3, 12, 12, -90))));

  (function () {                                    // three warp chevrons
    let s = '';
    [1.4, 7.4, 13.4].forEach(x => { s += poly([[x, 5], [x + 3.2, 5], [x + 8.2, 12], [x + 3.2, 19], [x, 19], [x + 5, 12]]); });
    def('speed', fp(s));
  })();

  def('range', fp(circ(12, 12, 2.3) + ring(12, 12, 6.2, 4.4) + ring(12, 12, 10.2, 8.4)));

  // ship half solid, half only an outline: phasing out of sight
  def('cloak', fp(poly(mir(SHIP))) + fp(poly(SHIP) + poly(offset(SHIP, -1.7))));

  def('repair', grp(U(
    poly([[7, 3.4], [9.6, 1.8], [9.6, 6.4], [14.4, 6.4], [14.4, 1.8], [17, 3.4], [18.2, 6.8], [17, 10.4], [14, 11.8], [10, 11.8], [7, 10.4], [5.8, 6.8]]),
    crect(10.7, 11, 2.6, 10.6, 0.8)), 45));

  // ================================================================================================ WAR & INTRIGUE
  def('troops', fp(poly([[4, 13], [5.2, 7.2], [9, 3.6], [15, 3.6], [18.8, 7.2], [20, 13], [20, 16.6], [17, 21.2], [14.6, 21.2], [14.6, 17.8], [9.4, 17.8], [9.4, 21.2], [7, 21.2], [4, 16.6]]) +
    cpoly([[6.2, 10.2], [17.8, 10.2], [17.8, 13.8], [6.2, 13.8]], 1.2) + rect(11.2, 5, 1.6, 4.2)));

  def('spy', U(
    cpoly([[7.4, 3.4], [16.6, 3.4], [17.4, 10.2], [6.6, 10.2]], [1, 1, 0, 0]) + poly([[10.6, 3.4], [12, 5.2], [13.4, 3.4]]),
    poly([[1.6, 11.4], [4.6, 10], [19.4, 10], [22.4, 11.4], [19.6, 13], [4.4, 13]]),
    cpoly([[3.4, 14.6], [11, 14.6], [10.4, 19], [5, 19]], 0.6), cpoly([[13, 14.6], [20.6, 14.6], [19, 19], [13.6, 19]], 0.6), rect(10.6, 15.2, 2.8, 1.3)));

  (function () {
    const sword = U(poly([[12, 1.4], [13.7, 4.2], [13.7, 14.6], [10.3, 14.6], [10.3, 4.2]]), crect(6.6, 14.6, 10.8, 2.1, 0.6), rect(11, 16.7, 2, 3.6) + circ(12, 21.4, 1.4));
    def('war', grp(sword, 45) + grp(sword, -45));
  })();

  def('target', U(ring(12, 12, 7.8, 5.6), circ(12, 12, 1.8), rect(10.9, 1.8, 2.2, 7), rect(10.9, 15.2, 2.2, 7), rect(1.8, 10.9, 7, 2.2), rect(15.2, 10.9, 7, 2.2)));

  def('skull', fp(poly([[7, 2.4], [17, 2.4], [20.4, 5.6], [20.4, 12], [17.2, 14.4], [17.2, 19.8], [14.8, 21.8], [9.2, 21.8], [6.8, 19.8], [6.8, 14.4], [3.6, 12], [3.6, 5.6]]) +
    cpoly([[6.2, 8.2], [10.4, 8.2], [10.4, 12.4], [6.2, 12.4]], [0, 0, 1.2, 0]) + cpoly([[13.6, 8.2], [17.8, 8.2], [17.8, 12.4], [13.6, 12.4]], [0, 0, 0, 1.2]) +
    poly([[12, 12.8], [13.5, 15.4], [10.5, 15.4]]) + rect(10.3, 18.2, 1.1, 3.6) + rect(12.6, 18.2, 1.1, 3.6)));

  def('rebel', U(
    crect(5.2, 3.6, 13.6, 14.2, 2.2) + rect(7.775, 3.6, 1.1, 5) + rect(11.45, 3.6, 1.1, 5) + rect(15.125, 3.6, 1.1, 5) + rect(5.2, 10.2, 8.4, 1.2),
    crect(7.4, 19, 9.2, 3, 0.8)));

  (function () {                                    // biohazard: three crescents around a hub
    let s = fp(ring(12, 12, 2.5, 1.1));
    for (let k = 0; k < 3; k++) {
      const phi = -90 + 120 * k, c1 = pol(12, 12, 5.1, phi), c2 = pol(12, 12, 3.4, phi);
      s += fp(crescent(c1, 5.4, c2, 4.7));
    }
    def('plague', s);
  })();

  (function () {                                    // jolly roger: skull over crossed bones
    const bone = U(crect(4.6, 15.5, 14.8, 2.2, 0.8)) + fp(circ(4.6, 15.2, 1.25) + circ(4.6, 18, 1.25) + circ(19.4, 15.2, 1.25) + circ(19.4, 18, 1.25));
    def('pirate', fp(poly([[7.2, 1.8], [16.8, 1.8], [18.4, 3.4], [18.4, 7.2], [16, 9], [16, 10.8], [14.4, 12.2], [9.6, 12.2], [8, 10.8], [8, 9], [5.6, 7.2], [5.6, 3.4]]) +
      rect(7.8, 4.4, 2.8, 2.6) + rect(13.4, 4.4, 2.8, 2.6) + poly([[12, 7.6], [13, 9.2], [11, 9.2]])) + grp(bone, 27, 12, 16.6) + grp(bone, -27, 12, 16.6));
  })();

  def('monster', fp(poly([[5.2, 5], [8, 2.4], [16, 2.4], [18.8, 5], [20.2, 9.6], [18.8, 13.4], [5.2, 13.4], [3.8, 9.6]]) +
    poly([[6.6, 6.4], [10.6, 8], [10.2, 10.6], [6.8, 9.6]]) + poly([[17.4, 6.4], [13.4, 8], [13.8, 10.6], [17.2, 9.6]])) +
    U(poly([[4.4, 13.4], [7.4, 13.4], [6.8, 18], [8.6, 21.6], [5.4, 21.6], [4.2, 17.4]]), poly([[8.8, 13.4], [11.4, 13.4], [11, 18.6], [12, 22], [9.4, 21.2], [8.4, 18]]),
      poly([[12.6, 13.4], [15.2, 13.4], [15.6, 18], [14.6, 21.2], [12, 22], [13, 18.6]]), poly([[16.6, 13.4], [19.6, 13.4], [19.8, 17.4], [18.6, 21.6], [15.4, 21.6], [17.2, 18]])));

  def('antaran', fp(poly(burst(8, 11, 5.4, 12, 12, -90)) + poly([[12, 6], [15, 12], [12, 18], [9, 12]]) ) + fp(rect(11.2, 8, 1.6, 8)));

  def('orion', fp(cpoly([[12, 1.8], [15.2, 6.6], [14.4, 18.8], [17, 18.8], [17, 22], [7, 22], [7, 18.8], [9.6, 18.8], [8.8, 6.6]], [0, 0, 0, 0, 0.9, 0.9, 0, 0, 0]) +
    rect(11.2, 9, 1.6, 1.6) + rect(11.2, 12.2, 1.6, 1.6) + rect(11.2, 15.4, 1.6, 1.6)));

  (function () {                                    // amphora with a zig-zag band
    const body = [[10.2, 7], [13.8, 7], [19, 11.4], [19, 15.4], [15.4, 21.6], [8.6, 21.6], [5, 15.4], [5, 11.4]];
    def('artifact', fp(poly(body) + poly([[5, 14.2], [8.2, 16.2], [11, 14.2], [13.8, 16.2], [16.8, 14.2], [19, 15.4], [19, 17], [16.8, 15.8], [13.8, 17.6], [11, 15.8], [8.2, 17.6], [5.2, 15.8]])) +
      U(crect(8.8, 2, 6.4, 1.8, 0.5) + rect(10.2, 3.8, 3.6, 3.6)) + sp('M10 8.6L6.4 6.4L5 9.4', 1.8) + sp('M14 8.6L17.6 6.4L19 9.4', 1.8));
  })();

  (function () {                                    // jagged explosion
    const R = [11, 7.2, 9, 5.6, 11, 6.6, 8.6, 5.4, 10.4, 6.4, 9, 5.8, 11, 7, 8.4, 5.6, 10.6, 6.2, 9.2, 5.4, 11, 6.8, 8.8, 5.8];
    const pts = R.map((r, i) => pol(12, 12, r, -90 + i * 15));
    def('nova', fp(poly(pts) + circ(12, 12, 2.6)));
  })();

  // ================================================================================================ DIPLOMACY & POLITICS
  // diplomacy: the dove of truce
  def('diplomacy', U(
    poly([[22.8, 9.2], [20.2, 7.2], [18, 7.6], [16.6, 9.6], [12.8, 12.4], [7.4, 13.6], [2.4, 16.4], [6.4, 17.2], [3.4, 20.4], [8.2, 19.4], [12.6, 18.4], [16.6, 16], [19.2, 12.8], [20.2, 10.6]]),
    poly([[16.2, 11.2], [14, 5.6], [9.4, 2.4], [9.4, 5.2], [6.2, 5], [8.6, 8.4], [6.4, 9.6], [10.6, 12.4]])));

  // peace: an olive branch
  (function () {
    const P0 = [3.2, 20.8], P1 = [19.2, 4.8], th = -45, g = [poly(seg(P0, P1, 1.9))];
    [0.2, 0.42, 0.64, 0.86].forEach(t => {
      const b = [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
      g.push(poly(leafL(b[0], b[1], th - 58, 6, 3.2)), poly(leafL(b[0], b[1], th + 58, 6, 3.2)));
    });
    g.push(poly(leafL(P1[0], P1[1], th, 5, 3)));
    def('peace', U.apply(null, g));
  })();

  (function () {                                    // two interlocked rings
    def('alliance', sp(arc(8.4, 12, 6, -32, 288), 2.4, 'butt') + sp(arc(15.6, 12, 6, 148, 468), 2.4, 'butt'));
  })();

  def('treaty', U(
    crect(3.6, 2.4, 16.8, 3, 1), crect(3.6, 18.6, 16.8, 3, 1),
    rect(5.6, 6.4, 12.8, 11.6) + rect(8, 8.8, 8, 1.3) + rect(8, 11.6, 8, 1.3) + rect(8, 14.4, 5, 1.3)));

  def('council', U(
    poly([[12, 2.2], [22.4, 8.2], [1.6, 8.2]]),
    crect(3.4, 9.6, 17.2, 1.8, 0.5), rect(4.4, 12.4, 2.6, 6.2), rect(8.9, 12.4, 2.6, 6.2), rect(13.4, 12.4, 2.6, 6.2), rect(17.4, 12.4, 2.6, 6.2),
    crect(2.6, 19.6, 18.8, 2.4, 0.8)));

  def('vote', U(
    crect(7.6, 1.8, 8.8, 8.8, 1.2) + poly([[9.6, 6.2], [11.2, 7.8], [14.4, 4.4], [13.6, 3.6], [11.2, 6.2], [10.4, 5.4]]),
    crect(3.2, 12, 17.6, 9.6, 1.4) + rect(7.2, 14.2, 9.6, 1.6)));

  def('news', U(
    circ(12, 8.2, 2),
    poly([[12, 10.2], [17, 22], [14.8, 22], [12, 15], [9.2, 22], [7, 22]]), rect(8.6, 17.6, 6.8, 1.6)) +
    sp(arc(12, 8.2, 5.2, -42, 42), 1.9, 'butt') + sp(arc(12, 8.2, 8.4, -42, 42), 1.9, 'butt') + sp(arc(12, 8.2, 5.2, 138, 222), 1.9, 'butt') + sp(arc(12, 8.2, 8.4, 138, 222), 1.9, 'butt'));

  def('score', U(
    poly([[6.2, 2.6], [17.8, 2.6], [17, 9.6], [14.4, 12.6], [9.6, 12.6], [7, 9.6]]),
    rect(10.8, 13.4, 2.4, 4), crect(7, 18.2, 10, 3.4, 0.8)) +
    sp('M6.6 4.6H3.2V8L7 10.2', 1.8) + sp('M17.4 4.6H20.8V8L17 10.2', 1.8));

  def('crown', fp(poly([[2.6, 6.4], [7.8, 11.4], [12, 4.4], [16.2, 11.4], [21.4, 6.4], [20.2, 15], [3.8, 15]])) +
    fp(crect(4, 16.4, 16, 4.8, 1) + poly([[12, 17.6], [13.2, 18.8], [12, 20], [10.8, 18.8]])) + fp(circ(2.8, 5.2, 1.5) + circ(12, 3.2, 1.6) + circ(21.2, 5.2, 1.5)));

  // ================================================================================================ EVENTS & KNOWLEDGE
  def('tech', U(
    circ(12, 9.6, 7) + poly([[10, 13.6], [10, 10], [11, 8.8], [13, 8.8], [14, 10], [14, 13.6], [12.9, 13.6], [12.9, 10.4], [12.4, 9.9], [11.6, 9.9], [11.1, 10.4], [11.1, 13.6]]),
    cpoly([[8.8, 14.4], [15.2, 14.4], [14.6, 17.4], [9.4, 17.4]], 0),
    crect(9, 18.4, 6, 1.8, 0.6), crect(10, 20.6, 4, 1.4, 0.5)));

  def('discover', fp(spark(10.4, 13.4, 8.8, 2.6) + spark(19, 5.4, 4, 1.2) + spark(19.8, 18.6, 2.8, 0.9)));

  def('event', fp(cpoly([[12, 1.4], [22.6, 12], [12, 22.6], [1.4, 12]], 1) +
    poly([[10.8, 6.4], [13.2, 6.4], [12.7, 13.6], [11.3, 13.6]]) + rect(10.9, 15.2, 2.2, 2.2)));

  def('warning', fp(cpoly([[12, 2.4], [22.4, 20.4], [1.6, 20.4]], 1.8) +
    poly([[10.8, 8.6], [13.2, 8.6], [12.7, 14.8], [11.3, 14.8]]) + rect(10.9, 16.4, 2.2, 2.2)));

  def('info', fp(circ(12, 12, 9.2) + rect(10.8, 6.4, 2.4, 2.6) + rect(10.8, 10.4, 2.4, 7.4)));

  def('eye', (function () {
    const O = [[1.5, 12], [7.5, 5.6], [16.5, 5.6], [22.5, 12], [16.5, 18.4], [7.5, 18.4]];
    return fp(poly(O) + circ(12, 12, 4.4)) + fp(circ(12, 12, 2));
  })());

  def('search', fp(ring(10.2, 10.2, 7.4, 4.8)) + sp('M15.8 15.8L19.8 19.8', 3.4));

  // ================================================================================================ INTERFACE
  def('ok', sp('M4.2 12.6L9.8 18.2L19.8 6.2', 3.6));
  def('cancel', sp('M5.4 5.4L18.6 18.6M18.6 5.4L5.4 18.6', 3.6));
  def('add', sp('M12 4.4V19.6M4.4 12H19.6', 3.6));
  def('remove', sp('M4.4 12H19.6', 3.6));

  (function () {
    const up = chamfer(arrowP([12, 21.2], [12, 2.6], 5.4, 8.8, 9.2), [0.9, 0, 1.3, 1.2, 1.3, 0, 0.9]);
    def('up', fp(poly(up)));
    def('right', fp(poly(rot(up, 90))));
    def('down', fp(poly(rot(up, 180))));
    def('left', fp(poly(rot(up, -90))));
  })();

  def('expand', sp('M4.8 8.8L12 16L19.2 8.8', 3.6));
  def('collapse', sp('M4.8 15.2L12 8L19.2 15.2', 3.6));

  const padlock = fp(crect(4.6, 10.4, 14.8, 11.2, 1.6) + 'M11.1 19.2L11.1 16.24A1.7 1.7 0 1 1 12.9 16.24L12.9 19.2Z');   // body with a keyhole
  def('lock', padlock + sp('M8.4 10.6V7.6L10.4 4.4H13.6L15.6 7.6V10.6', 2.4, 'butt'));
  def('unlock', padlock + sp('M8.4 10.6V7.6L10.4 4.4H13.6L15.6 7.6V8.2', 2.4, 'butt'));

  def('settings', fp(poly(gear(8, 10.6, 7.8, 12, 12, -90, 11, 7)) + circ(12, 12, 3.6)));

  def('save', fp(cpoly([[3, 3], [17.4, 3], [21, 6.6], [21, 21], [3, 21]], [1.2, 0, 0, 1.2, 1.2]) +
    rect(7.4, 4.8, 8, 4.4) + rect(12.4, 5.6, 1.8, 2.8) + crect(6, 13.4, 12, 6, 0.6)));

  def('load', U(
    poly([[2.6, 4.4], [9.2, 4.4], [11.6, 7.2], [21.4, 7.2], [21.4, 9], [2.6, 9]]),
    crect(2.6, 10.4, 18.8, 10.2, 1.4)));

  def('sound', fp(cpoly([[2.6, 9.2], [6.6, 9.2], [12, 4.6], [12, 19.4], [6.6, 14.8], [2.6, 14.8]], [0.8, 0, 0, 0, 0, 0.8])) + sp(arc(11.4, 12, 6, -45, 45), 2, 'butt') + sp(arc(11.4, 12, 9.4, -45, 45), 2, 'butt'));
  def('mute', fp(cpoly([[2.6, 9.2], [6.6, 9.2], [12, 4.6], [12, 19.4], [6.6, 14.8], [2.6, 14.8]], [0.8, 0, 0, 0, 0, 0.8])) + sp('M15.4 9L20.8 15M20.8 9L15.4 15', 2.4));

  def('music', U(
    ell(8, 18.2, 3.5, 2.6, -20), rect(9.8, 5, 1.8, 13), ell(17.4, 16.2, 3.5, 2.6, -20), rect(19.2, 3, 1.8, 13),
    poly([[9.8, 4.6], [21, 2.2], [21, 5.8], [9.8, 8.2]])));

  def('play', fp(cpoly([[6.4, 3.6], [20, 12], [6.4, 20.4]], 1.6)));
  def('pause', U(crect(5.4, 3.6, 4.8, 16.8, 0.9), crect(13.8, 3.6, 4.8, 16.8, 0.9)));

  (function () {                                    // hourglass
    const O = [[6.2, 4.6], [17.8, 4.6], [17.8, 8], [13.4, 12], [17.8, 16], [17.8, 19.4], [6.2, 19.4], [6.2, 16], [10.6, 12], [6.2, 8]];
    const I = offset(O, -1.7), top = clipHalf(clipHalf(offset(I, 0.4), p => p[1] - 8.6), p => 11.6 - p[1]), bot = clipHalf(offset(I, 0.4), p => p[1] - 15.4);
    def('nextturn', U(crect(4, 2, 16, 2.6, 0.8), crect(4, 19.4, 16, 2.6, 0.8), poly(O) + poly(I)) + U(poly(top), poly(bot), rect(11.4, 11.4, 1.2, 4.2)));
  })();

  def('design', fp(ring(12, 4.8, 2.8, 1.1)) + sp('M11 7.2L5.6 19.8M13 7.2L18.4 19.8', 2.6, 'butt') +
    fp(poly([[4.6, 19.8], [6.8, 20.7], [5.2, 22.8]]) + poly([[17.2, 20.7], [19.4, 19.8], [18.8, 22.8]])) + sp('M8.2 14.4Q12 17.4 15.8 14.4', 1.7, 'butt'));

  def('map', U(
    cpoly([[2, 6.8], [8, 4.4], [8, 18.6], [2, 21]], 0.8),
    cpoly([[9.4, 4.4], [14.6, 6.8], [14.6, 21], [9.4, 18.6]], 0.8),
    cpoly([[16, 6.8], [22, 4.4], [22, 18.6], [16, 21]], 0.8)));

  def('list', U(
    crect(2.6, 4.2, 3.4, 3.4, 0.6), rect(8, 4.8, 13.4, 2.2), crect(2.6, 10.3, 3.4, 3.4, 0.6), rect(8, 10.9, 13.4, 2.2), crect(2.6, 16.4, 3.4, 3.4, 0.6), rect(8, 17, 13.4, 2.2)));

  // ---- small extras the UI kit refers to by name
  def('close', defs.cancel);
  def('chevron', sp('M8.6 4.8L15.8 12L8.6 19.2', 3.6));
  def('dot', fp(circ(12, 12, 4.5)));

  // ================================================================================================ API
  const MISSING = fp(crect(2.5, 2.5, 19, 19, 3) + crect(5, 5, 14, 14, 1.5));
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cache = {};
  function svg(name, o) {
    const inner = Object.prototype.hasOwnProperty.call(defs, name) ? defs[name] : MISSING;
    if (!o || (o.size === undefined && !o.cls && !o.title)) {
      return cache[name] || (cache[name] = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">' + inner + '</svg>');
    }
    let a = '';
    if (o.size !== undefined && o.size !== null) { const s = typeof o.size === 'number' ? o.size : esc(o.size); a += ' width="' + s + '" height="' + s + '"'; }
    if (o.cls) a += ' class="' + esc(o.cls) + '"';
    a += o.title ? ' role="img"' : ' aria-hidden="true"';
    return '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"' + a + '>' + (o.title ? '<title>' + esc(o.title) + '</title>' : '') + inner + '</svg>';
  }

  M.Gfx.Icons = {
    has: name => Object.prototype.hasOwnProperty.call(defs, name),
    names: () => Object.keys(defs),
    svg: svg,
    defs: defs,
    dataUrl: (name, color) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(name).replace(/currentColor/g, color || '#ffffff')),
  };
})(window.MOO);
