/* Master of Orion - Reborn : js/gfx/portraits.js
   Leader portraits for the ten races: photoreal art in assets/races/race-<id>-portrait.webp.
   Self-contained: exports only through window.MOO.Gfx.Portraits
     RACES, MOODS, NAMES, draw(ctx, race, x, y, w, h, o), canvas(race, w, h, o), drawBadge(ctx, race, cx, cy, r, o), photo, accent(race), facing(race)
   See tools/handoff/portraits-photo.md
*/
(function (M) {
  'use strict';

  const TAU = Math.PI * 2, PI = Math.PI;
  const sin = Math.sin, cos = Math.cos;
  const RACES = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  const MOODS = ['neutral', 'pleased', 'angry', 'worried', 'scheming'];
  // which way each photo's leader looks (1 = towards the viewer's right, -1 = left, 0 = straight ahead): scenes that seat several leaders
  // around a centre mirror the ones that would look away from it (Portraits.facing)
  const FACING = { meklar: -1, darlok: 0 };
  const ACCENT = { alkari: '#ffa94d', bulrathi: '#e0a070', darlok: '#a58bff', human: '#79a8d8', klackon: '#c4e05a', meklar: '#ff6a4a', mrrshan: '#ffb35a', psilon: '#46e6d4', sakkra: '#3be28b', silicoid: '#ffc04a' };

  /* ======================================================================= small helpers */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const h2 = (v) => { v = clamp(Math.round(v), 0, 255); return (v < 16 ? '0' : '') + v.toString(16); };
  function rgbOf(c) {
    if (Array.isArray(c)) return c;
    let s = String(c).trim();
    if (s[0] === '#') {
      s = s.slice(1); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      const n = parseInt(s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  function mixc(a, b, t) {
    const A = rgbOf(a), B = rgbOf(b);
    return '#' + h2(A[0] + (B[0] - A[0]) * t) + h2(A[1] + (B[1] - A[1]) * t) + h2(A[2] + (B[2] - A[2]) * t);
  }
  function rgba(c, a) {
    const v = rgbOf(c);
    return 'rgba(' + (v[0] | 0) + ',' + (v[1] | 0) + ',' + (v[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : Math.round(a * 1000) / 1000) + ')';
  }
  function lg(g, x0, y0, x1, y1, st) {
    const r = g.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }
  function rgd(g, x, y, r0, r1, st) {
    const r = g.createRadialGradient(x, y, r0, x, y, r1);
    for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]);
    return r;
  }

  /* per-portrait state (talking amount smoothing), keyed like the callers' o.key */
  const _states = new Map();
  function getState(key) {
    let st = _states.get(key);
    if (!st) { if (_states.size > 300) _states.clear(); st = { seed: strHash(key) & 0xffff, pa: 0, pt: null }; _states.set(key, st); }
    return st;
  }
  function keyOf(race, o) { return o.key || (race + '|' + (o.variant | 0) + '|' + (o.color || '')); }

  function badgeRing(ctx, cx, cy, r, rw, o) {
    const fr = r - rw;
    // brass ring
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = r * 0.18; ctx.shadowOffsetY = r * 0.05;
    ctx.beginPath(); ctx.arc(cx, cy, r - rw / 2, 0, TAU); ctx.lineWidth = rw;
    const v2 = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'v2';
    ctx.strokeStyle = lg(ctx, cx - r, cy - r, cx + r, cy + r, v2 ? [0, '#dbe7f1', 0.3, '#8ea4ba', 0.62, '#46596c', 0.82, '#7b90a5', 1, '#34455a'] : [0, '#f6e3b0', 0.3, '#d6b36a', 0.62, '#8a7040', 0.82, '#c9a35c', 1, '#6e5830']);
    ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, fr + 0.4, 0, TAU); ctx.lineWidth = Math.max(1, r * 0.03); ctx.strokeStyle = 'rgba(8,6,18,.7)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r - rw * 0.3, PI * 1.08, PI * 1.58); ctx.lineWidth = Math.max(0.8, rw * 0.2); ctx.strokeStyle = v2 ? 'rgba(225,238,250,.6)' : 'rgba(255,248,215,.7)'; ctx.stroke();
    if (o.color) {
      const a = PI * 0.25, px = cx + cos(a) * (r - rw * 0.2), py = cy + sin(a) * (r - rw * 0.2), pr = Math.max(2.2, r * 0.17);
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fillStyle = o.color; ctx.fill();
      ctx.lineWidth = Math.max(1, pr * 0.28); ctx.strokeStyle = v2 ? '#8ea4ba' : '#d6b36a'; ctx.stroke();
    }
  }

  /* ####################################################################################################################
     PHOTO PORTRAITS : one square photoreal image per race.  Until an image has loaded (or if it fails / Portraits.photos === false) a
     quiet "channel" card is shown instead (dark panel in the race accent, monogram + name; nothing at all when placed on a scene).
     Images are plain <img> (works from file://; pixels are never read back).
     Per (race, pixel size, crop tightness, feather) the cover-cropped, downscaled bitmap is cached (budget scales with
     MOO.HW.memoryGB).  Moods = cheap canvas grading; talking = slow breathing zoom + light flicker.   See tools/handoff/portraits-photo.md
     #################################################################################################################### */
  const PH = { img: {}, state: {}, cache: new Map(), bytes: 0, subs: [], base: 'assets/races/' };
  (function () {
    try { const cs = document.currentScript; PH.base = new URL('../../assets/races/', cs && cs.src ? cs.src : location.href).href; } catch (e) { /* relative fallback */ }
  })();
  const PH_FACE = { x: 0.52, y: 0.36 };
  function phBudget() { const gb = (M.HW && M.HW.memoryGB) || 4; return clamp(gb * 6, 24, 96) * 1048576; }
  function phLoad(race) {
    if (PH.state[race]) return;
    PH.state[race] = 'loading';
    const im = new Image();
    im.decoding = 'async';
    im.onload = function () {
      if (!(im.naturalWidth > 0)) { PH.state[race] = 'bad'; return; }
      PH.img[race] = im; PH.state[race] = 'ok';
      PH.subs.slice().forEach((f) => { try { f(race); } catch (e) { /* ignore */ } });
      try { window.dispatchEvent(new CustomEvent('moo-portrait-loaded', { detail: { race: race } })); } catch (e) { /* ignore */ }
    };
    im.onerror = function () { PH.state[race] = 'bad'; };
    im.src = PH.base + 'race-' + race + '-portrait.webp';
  }
  function phReady(race) {
    if (M.Gfx.Portraits.photos === false || RACES.indexOf(race) < 0) return null;
    const st = PH.state[race];
    if (st === 'ok') return PH.img[race];
    if (!st) phLoad(race);
    return null;
  }
  let _phIdle = false;
  function phIdleAll() {
    if (_phIdle) return; _phIdle = true;
    let i = 0;
    const ric = window.requestIdleCallback || ((f) => setTimeout(f, 250));
    const step = () => { if (i < RACES.length) { phLoad(RACES[i++]); ric(step); } };
    ric(step);
  }
  /* source rect of the square image for a target aspect (w/h) and tightness z (1 = widest, <1 = closer on the face) */
  function phCrop(im, aspect, z) {
    const S = Math.min(im.naturalWidth, im.naturalHeight);
    let cw, ch;
    if (aspect <= 1) { ch = S * z; cw = ch * aspect; } else { cw = S * z; ch = cw / aspect; }
    let sx = PH_FACE.x * S - cw * 0.5, sy = PH_FACE.y * S - ch * (z < 1 ? 0.4 : 0.46);
    sx = clamp(sx, 0, S - cw); sy = clamp(sy, 0, S - ch);
    return { sx: sx, sy: sy, sw: cw, sh: ch };
  }
  function phScaled(race, im, dw, dh, z, feather) {
    const key = race + '|' + dw + 'x' + dh + '|' + z + '|' + (feather ? 1 : 0);
    let e = PH.cache.get(key);
    if (e) { PH.cache.delete(key); PH.cache.set(key, e); return e; }
    const r = phCrop(im, dw / dh, z);
    let src = im, sx = r.sx, sy = r.sy, sw = r.sw, sh = r.sh;
    while (sw / 2 > dw * 1.2 && sh / 2 > dh * 1.2) {   // step-halve big downscales for quality
      const hw = Math.max(1, Math.round(sw / 2)), hh = Math.max(1, Math.round(sh / 2));
      const t = document.createElement('canvas'); t.width = hw; t.height = hh;
      const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, sx, sy, sw, sh, 0, 0, hw, hh);
      src = t; sx = 0; sy = 0; sw = hw; sh = hh;
    }
    const c = document.createElement('canvas'); c.width = dw; c.height = dh;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    const ex = M.Gfx.WorldArt && M.Gfx.WorldArt.raceExposure ? M.Gfx.WorldArt.raceExposure(race, 'portrait') : 1;   // the set's outliers brought toward its mean
    if (ex !== 1 && 'filter' in g) { try { g.filter = 'brightness(' + ex + ')'; } catch (e) { /* no filters */ } }
    g.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh); g.filter = 'none';
    if (feather) {
      // A photo placed on a scene must not read as a pasted square: the mask is a soft bust-shaped ellipse (no straight edge anywhere), full over
      // the face and shoulders, running off the bottom of the box, fading out well inside the left/right/top edges; the photo's own studio
      // background is keyed down towards the edges so only the figure stays.
      const m = document.createElement('canvas'); m.width = dw; m.height = dh;
      const mg = m.getContext('2d');
      const cx = dw * 0.5, cy = dh * 0.62, rx = dw * 0.36, ry = dh * 0.66;
      const gr = mg.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.72, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      mg.save(); mg.translate(cx, cy); mg.scale(rx * 1.35, ry * 1.25); mg.fillStyle = gr; mg.fillRect(-1, -1, 2, 2); mg.restore();
      const b = document.createElement('canvas'); b.width = dw; b.height = dh;
      const bg = b.getContext('2d');
      try { bg.filter = 'blur(' + Math.max(1, Math.min(dw, dh) * 0.05).toFixed(1) + 'px)'; } catch (er) { /* ignore */ }
      bg.drawImage(m, 0, 0);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(b, 0, 0); g.globalCompositeOperation = 'source-over';
    }
    e = { c: c, bytes: dw * dh * 4 };
    PH.cache.set(key, e); PH.bytes += e.bytes;
    const budget = phBudget();
    for (const k of Array.from(PH.cache.keys())) { if (PH.bytes <= budget || PH.cache.size <= 1) break; const o = PH.cache.get(k); if (o === e) continue; PH.cache.delete(k); PH.bytes -= o.bytes; }
    return e;
  }
  const PH_MOOD = {   // [soft-light tint, alpha, vignette boost, brightness overlay (+white / -black alpha)]
    neutral: null,
    pleased: ['#ffcf7a', 0.2, -0.05, 0.05],
    angry: ['#ff2a14', 0.3, 0.22, -0.06],
    worried: ['#6f8fbf', 0.28, 0.1, -0.08],
    scheming: ['#8ee0a8', 0.2, 0.16, -0.05]
  };
  function phGrade(g, x, y, w, h, o, t, talk, atop) {
    const md = PH_MOOD[o.mood], over = atop ? 'source-atop' : 'source-over';   // atop: only the photo's own (masked) pixels are graded, never the box around it
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (md) {
      g.globalCompositeOperation = atop ? 'source-atop' : 'soft-light'; g.globalAlpha = md[1] * (atop ? 0.6 : 1); g.fillStyle = md[0]; g.fillRect(x, y, w, h);
      g.globalCompositeOperation = over;
      g.globalAlpha = Math.abs(md[3]); g.fillStyle = md[3] > 0 ? '#fff' : '#000'; g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    }
    if (o.vignette !== false) {
      const cx = x + w / 2, cy = y + h * 0.42, rr = Math.hypot(w, h) * 0.6;
      const gr = g.createRadialGradient(cx, cy, rr * 0.45, cx, cy, rr);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,6,' + clamp(0.38 + (md ? md[2] : 0), 0, 0.7).toFixed(3) + ')');
      g.globalCompositeOperation = over; g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
    if (talk > 0.01) {   // faint screen flicker while someone is speaking
      const f = 0.5 + 0.5 * Math.sin(t * 31) * Math.sin(t * 13.7);
      g.globalCompositeOperation = over; g.globalAlpha = 0.035 * talk * f; g.fillStyle = '#bfe0ff'; g.fillRect(x, y, w, h); g.globalAlpha = 1;
    }
    g.restore();
  }
  let _phTmp = null;
  /* paint the photo into the box (x,y,w,h); z = crop tightness.  Returns false when the image is not ready. */
  function phPaint(ctx, race, x, y, w, h, o, z, shape) {
    const im = phReady(race); if (!im) return false;
    const T = ctx.getTransform(), sx = Math.hypot(T.a, T.b) || 1, sy = Math.hypot(T.c, T.d) || 1;
    const q = (v) => Math.max(16, Math.min(1024, Math.ceil(v / 16) * 16));
    const S = Math.min(im.naturalWidth, im.naturalHeight);
    const dw = Math.min(q(w * sx * 1.03), S), dh = Math.min(q(h * sy * 1.03), S);
    const e = phScaled(race, im, dw, dh, z, o.bg === false && !shape);
    const t = o.t == null ? performance.now() / 1000 : +o.t;
    const st = getState(keyOf(race, o));
    const tt = o.talking === true ? 1 : (+o.talking || 0), dt = st.pt == null ? -1 : t - st.pt;
    st.pa = dt > 0 && dt < 0.5 ? (st.pa || 0) + (tt - (st.pa || 0)) * (1 - Math.exp(-dt * 6)) : tt;
    st.pt = t;
    const ph = st.seed * 0.001, ta = st.pa;
    // A photograph must hold still. The old breathing zoom (1.2 %) plus a talking "pump" (up to 1.2 % more at ~0.45 Hz) and a sideways drift
    // made every photo bob and slide, and on screens that redraw their portraits at 10-20 fps (Races, council alcoves, GNN badges) the motion
    // stepped visibly: the "photos jump around" report. Small portraits (< 220 device px) and o.still are now static; large ones keep a very
    // slow, slight push (0.35 %) so a scene still feels alive. Talking is shown by the flicker in phGrade only, never by moving the picture.
    const pxSize = Math.min(w * sx, h * sy), amp = o.still || pxSize < 220 ? 0 : 1;
    const zoom = 1 + amp * 0.0035 * (0.5 + 0.5 * Math.sin(t * 0.3 + ph));
    const iw = dw / zoom, ih = dh / zoom, ix = (dw - iw) * 0.5, iy = (dh - ih) * 0.3;
    const feathered = o.bg === false && !shape;
    ctx.save();
    if (o.flip) { ctx.translate(x + w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(x + w / 2), 0); }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (feathered) {
      // grade on a scratch layer with source-atop so the mood tint, vignette and flicker touch only the figure, then composite the layer
      if (!_phTmp) _phTmp = document.createElement('canvas');
      if (_phTmp.width < dw || _phTmp.height < dh) { _phTmp.width = Math.max(_phTmp.width, dw); _phTmp.height = Math.max(_phTmp.height, dh); }
      const tg = _phTmp.getContext('2d');
      tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.globalAlpha = 1; tg.clearRect(0, 0, dw, dh);
      tg.drawImage(e.c, ix, iy, iw, ih, 0, 0, dw, dh);
      phGrade(tg, 0, 0, dw, dh, o, t, ta, true);
      ctx.drawImage(_phTmp, 0, 0, dw, dh, x, y, w, h);
      ctx.restore();
      return true;
    }
    ctx.drawImage(e.c, ix, iy, iw, ih, x, y, w, h);
    ctx.restore();
    phGrade(ctx, x, y, w, h, o, t, ta);
    return true;
  }
  /* stand-in while a photo loads (or if it cannot): a dark comm-channel card tinted with the race accent, monogram ring + name */
  function phAccent(race) { return ACCENT[race] || '#d6b36a'; }
  function phHold(ctx, race, x, y, w, h, o) {
    if (o.bg === false) return;   // on a scene: leave the spot empty rather than show a stand-in figure
    const ac = phAccent(race), m = Math.min(w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = lg(ctx, x, y, x, y + h, [0, mixc(ac, '#070a18', 0.82), 1, '#03040c']); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rgd(ctx, x + w / 2, y + h * 0.42, 0, Math.max(w, h) * 0.7, [0, rgba(ac, 0.16), 1, rgba(ac, 0)]); ctx.fillRect(x, y, w, h);
    if (m > 40) { ctx.fillStyle = 'rgba(255,255,255,.025)'; const st = Math.max(2, m / 90); for (let yy = y; yy < y + h; yy += st * 2) ctx.fillRect(x, yy, w, st); }
    const cx = x + w / 2, cy = y + h * (m > 90 ? 0.44 : 0.5), r = m * 0.24;
    ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = rgba(ac, 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    const nm = NAMES[race] || String(race || '?');
    ctx.fillStyle = rgba(mixc(ac, '#ffffff', 0.55), 0.8); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + Math.round(r * 1.05) + 'px "Marcellus SC", "Marcellus", Georgia, serif';
    ctx.fillText(nm.charAt(0).toUpperCase(), cx, cy + r * 0.05);
    if (m > 90) {
      ctx.fillStyle = 'rgba(236,230,211,.6)'; ctx.font = '400 ' + Math.max(10, Math.round(m * 0.07)) + 'px "Marcellus SC", "Marcellus", Georgia, serif';
      ctx.fillText(nm.toUpperCase(), cx, y + h * 0.8);
    }
    ctx.restore();
  }
  function phHoldBadge(ctx, race, cx, cy, r, o) {
    const rw = Math.max(1.6, r * 0.09), fr = r - rw;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, fr, 0, TAU); ctx.clip();
    const ac = phAccent(race);
    ctx.fillStyle = rgd(ctx, cx - fr * 0.3, cy - fr * 0.35, 0, fr * 1.4, [0, mixc(ac, '#0a0d1e', 0.6), 1, '#03040c']); ctx.fillRect(cx - fr, cy - fr, fr * 2, fr * 2);
    ctx.fillStyle = rgba(mixc(ac, '#ffffff', 0.55), 0.85); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + Math.round(fr * 1.05) + 'px "Marcellus SC", "Marcellus", Georgia, serif';
    ctx.fillText((NAMES[race] || String(race || '?')).charAt(0).toUpperCase(), cx, cy + fr * 0.06);
    ctx.restore();
    badgeRing(ctx, cx, cy, r, rw, o);
  }
  function zFor(px, badge) { return badge ? (px > 140 ? 0.74 : 0.62) : px <= 90 ? 0.6 : px <= 170 ? 0.8 : 1; }
  function photoDraw(ctx, race, x, y, w, h, o) {
    o = o || {};
    if (phReady(race)) {
      try {
        const T = ctx.getTransform(), px = Math.min(w * Math.hypot(T.a, T.b), h * Math.hypot(T.c, T.d));
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        const ok = phPaint(ctx, race, x, y, w, h, o, zFor(px, false), false);
        const GR = M.Gfx.Grade;
        // a feathered photo (bg:false, placed on a scene) is never post-graded here: the grade's vignette would fill the whole box and draw the square back in
        if (ok && GR && !GR.depth && o.grade !== false && o.bg !== false && GR.on()) { ctx.translate(x, y); GR.apply(ctx, w, h, o.t == null ? performance.now() / 1000 : +o.t, 'portrait'); }
        ctx.restore();
        if (ok) return;
      } catch (e) { PH.state[race] = 'bad'; console.warn('[portraits photo] ' + race, e); }
    }
    phHold(ctx, race, x, y, w, h, o);
  }
  function photoBadge(ctx, race, cx, cy, r, o) {
    o = o || {};
    if (phReady(race)) {
      try {
        const rw = Math.max(1.6, r * 0.09), fr = r - rw, T = ctx.getTransform();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, fr, 0, TAU); ctx.clip();
        const ok = phPaint(ctx, race, cx - fr, cy - fr, fr * 2, fr * 2, o, zFor(fr * 2 * Math.hypot(T.a, T.b), true), true);
        ctx.restore();
        if (ok) { badgeRing(ctx, cx, cy, r, rw, o); return; }
      } catch (e) { PH.state[race] = 'bad'; console.warn('[portraits photo badge] ' + race, e); }
    }
    phHoldBadge(ctx, race, cx, cy, r, o || {});
  }
  const _pcc = new Map();
  function photoCanvas(race, w, h, o) {
    o = o || {};
    if (!phReady(race)) { const c = document.createElement('canvas'); c.width = w; c.height = h; phHold(c.getContext('2d'), race, 0, 0, w, h, o); return c; }   // not cached: the photo replaces it once loaded
    const key = [race, w, h, o.mood || '', o.color || '', o.bg === false ? 0 : 1, o.flip ? 1 : 0, o.t || 0].join('|');
    let c = _pcc.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const o2 = {}; for (const k in o) o2[k] = o[k];
    o2.t = o.t || 0; o2.key = '@pcanvas|' + key; o2.grade = false; o2.talking = 0;
    photoDraw(c.getContext('2d'), race, 0, 0, w, h, o2);
    _states.delete(o2.key);
    _pcc.set(key, c); if (_pcc.size > 120) _pcc.delete(_pcc.keys().next().value);
    return c;
  }
  if (typeof window !== 'undefined') setTimeout(phIdleAll, 1200);

  const NAMES = { alkari: 'Alkari', bulrathi: 'Bulrathi', darlok: 'Darlok', human: 'Human', klackon: 'Klackon', meklar: 'Meklar', mrrshan: 'Mrrshan', psilon: 'Psilon', sakkra: 'Sakkra', silicoid: 'Silicoid' };
  M.Gfx.Portraits = {
    RACES: RACES, MOODS: MOODS, NAMES: NAMES,
    draw: photoDraw, canvas: photoCanvas, drawBadge: photoBadge,
    photos: true,
    photo: { ready: function (r) { return PH.state[r] === 'ok'; }, load: phLoad, loadAll: function () { RACES.forEach(phLoad); }, onLoad: function (f) { PH.subs.push(f); },
      whenReady: function (race, f) { if (PH.state[race] === 'ok') { f(); return; } if (!PH.state[race]) phLoad(race); if (PH.state[race] === 'bad') return; PH.subs.push(function w(r) { if (r === race) { const i = PH.subs.indexOf(w); if (i >= 0) PH.subs.splice(i, 1); f(); } }); }, cacheBytes: function () { return PH.bytes; } },
    accent: phAccent,
    facing: function (race) { return race in FACING ? FACING[race] : 1; },
    clearCache: function () { _pcc.clear(); PH.cache.clear(); PH.bytes = 0; _states.clear(); }
  };
})(window.MOO);
