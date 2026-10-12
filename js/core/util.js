// General-purpose helpers (no DOM, no game knowledge). Safe to load headless.
MOO.def(function (M) {
  'use strict';
  const U = M.Util;

  U.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.round = (v, d) => { const p = Math.pow(10, d || 0); return Math.round(v * p) / p; };
  U.smooth = t => t * t * (3 - 2 * t);
  U.wrap = (v, n) => ((v % n) + n) % n;
  U.TAU = Math.PI * 2;

  // ---- formatting ----------------------------------------------------------
  U.fmt = n => {
    n = Math.round(n);
    const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return n < 0 ? '−' + s : s;
  };
  U.fmtSigned = n => (n > 0 ? '+' : n < 0 ? '−' : '') + U.fmt(Math.abs(n));
  U.fmtShort = n => {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e9) return s + (a / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return s + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return s + (a / 1e3).toFixed(1) + 'K';
    return U.fmt(n);
  };
  U.pct = (v, d) => (v * 100).toFixed(d || 0) + '%';
  U.pad = (n, w, ch) => String(n).padStart(w, ch === undefined ? '0' : ch);
  U.cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  U.plural = (n, one, many) => (n === 1 ? one : many || one + 's');
  U.ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  U.roman = n => {
    const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let r = '';
    for (const [v, s] of t) while (n >= v) { r += s; n -= v; }
    return r;
  };
  // "{name} reached {n}" -> substitutes {key} from vars
  U.tpl = (str, vars) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));
  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- colour --------------------------------------------------------------
  U.hexToRgb = hex => {
    let h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => U.pad(Math.round(U.clamp(v, 0, 255)).toString(16), 2)).join('');
  U.rgba = (hex, a) => { const [r, g, b] = U.hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  U.mix = (c1, c2, t) => {
    const a = U.hexToRgb(c1), b = U.hexToRgb(c2);
    return U.rgbToHex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  U.lighten = (c, t) => U.mix(c, '#ffffff', t);
  U.darken = (c, t) => U.mix(c, '#000000', t);

  // ---- collections ---------------------------------------------------------
  U.range = n => Array.from({ length: n }, (_, i) => i);
  U.sum = (arr, fn) => { let s = 0; for (let i = 0; i < arr.length; i++) s += fn ? fn(arr[i], i) : arr[i]; return s; };
  U.max = (arr, fn) => { let b = null, bv = -Infinity; for (const x of arr) { const v = fn ? fn(x) : x; if (v > bv) { bv = v; b = x; } } return b; };
  U.min = (arr, fn) => { let b = null, bv = Infinity; for (const x of arr) { const v = fn ? fn(x) : x; if (v < bv) { bv = v; b = x; } } return b; };
  U.sortBy = (arr, fn, desc) => arr.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
  U.groupBy = (arr, fn) => { const o = {}; for (const x of arr) (o[fn(x)] = o[fn(x)] || []).push(x); return o; };
  U.clone = o => JSON.parse(JSON.stringify(o));
  U.uniq = arr => Array.from(new Set(arr));
  U.remove = (arr, x) => { const i = arr.indexOf(x); if (i >= 0) arr.splice(i, 1); return i >= 0; };
  U.hash = str => { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  // ---- functions -----------------------------------------------------------
  U.debounce = (fn, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; };
  U.once = fn => { let d = false, v; return function () { if (!d) { d = true; v = fn.apply(this, arguments); } return v; }; };
  U.sleep = ms => new Promise(r => setTimeout(r, ms));
  U.nextFrame = () => new Promise(r => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(r) : setTimeout(r, 16)));
});
