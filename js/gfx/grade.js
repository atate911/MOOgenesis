// Gfx.Grade — the v2 "serious sci-fi" colour grade: a cheap Canvas2D post pass applied on top of finished scene / portrait / backdrop frames.
//   Gfx.Grade.apply(ctx, w, h, t, preset | opts)   draws over the CURRENT ctx state area (0,0,w,h in the ctx's own units); safe to call every frame
//   opts: sat (0..1 desaturation), cool (0..1 multiply by a cool neutral = lower exposure, bluer shadows), vig (0..1 edge darkening), grain (0..1), lift (0..1 black lift toward deep blue), bloom (0..1 soft highlight glow, needs ctx.filter)
//   presets: 'scene' (default) 'room' (sunlit interiors: stronger) 'space' (light touch) 'portrait'
// Does nothing when theme v1 is active (<html data-theme> absent), when Settings.reduceMotion/Perf tier 'low' (grain only) or opts.off.
(function (M) {
  'use strict';
  const Gfx = M.Gfx = M.Gfx || {};
  const PRESETS = {
    scene: { tone: [1.14, 0.92, 0.72], sat: 0.34, cool: 0.34, dark: 0.12, vig: 0.5, grain: 0.03, lift: 0.0, bloom: 0.0 },
    room: { tone: [1.3, 0.66, 0.45], sat: 0.6, cool: 0.4, dark: 0.55, vig: 0.66, grain: 0.028, lift: 0.0, bloom: 0.0 },
    space: { sat: 0.12, cool: 0.10, vig: 0.38, grain: 0.035, lift: 0.0, bloom: 0.0 },
    portrait: { sat: 0.22, cool: 0.18, vig: 0.30, grain: 0.04, lift: 0.0, bloom: 0.0 },
  };
  let noise = null, tmp = null;
  function noiseTile() {
    if (noise) return noise;
    const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'), d = g.createImageData(160, 160);
    let s = 1234567; for (let i = 0; i < d.data.length; i += 4) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const v = 96 + ((s >>> 24) % 160); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); noise = c; return c;
  }
  function on() { return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'v2'; }
  function apply(ctx, w, h, t, o) {
    if (!on()) return;
    const P = typeof o === 'string' ? PRESETS[o] : (o && o.preset ? Object.assign({}, PRESETS[o.preset], o) : o);
    const q = Object.assign({}, PRESETS.scene, P || {});
    if (q.off) return;
    const low = (M.Perf && M.Perf.tier === 'low');
    ctx.save();
    ctx.setLineDash && ctx.setLineDash([]);
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.globalAlpha = 1;
    let toned = false;
    if (q.tone && !low && 'filter' in ctx) {                  // real contrast / exposure / saturation curve through a filtered copy of the frame (skipped on the low tier)
      try {
        const m = ctx.getTransform(), dx = Math.round(m.e), dy = Math.round(m.f), dw = Math.max(1, Math.round(w * m.a)), dh = Math.max(1, Math.round(h * m.d));
        if (!tmp) tmp = document.createElement('canvas'); if (tmp.width < dw || tmp.height < dh) { tmp.width = Math.max(tmp.width, dw); tmp.height = Math.max(tmp.height, dh); }
        const tg = tmp.getContext('2d'); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'copy'; tg.drawImage(ctx.canvas, dx, dy, dw, dh, 0, 0, dw, dh);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy';
        ctx.filter = 'contrast(' + q.tone[0] + ') brightness(' + q.tone[1] + ') saturate(' + q.tone[2] + ')'; ctx.drawImage(tmp, 0, 0, dw, dh, dx, dy, dw, dh); ctx.filter = 'none'; ctx.restore(); toned = true;
      } catch (e) { toned = false; }
    }
    if (q.sat > 0 && !toned) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = q.sat; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    if (q.cool > 0) {                                           // multiply by a cool neutral: exposure down, shadows bluer, whites stay clean
      const k = q.cool, r = 255 - 70 * k, gg = 255 - 52 * k, b = 255 - 32 * k;
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(' + (r | 0) + ',' + (gg | 0) + ',' + (b | 0) + ')'; ctx.fillRect(0, 0, w, h);
    }
    if (q.dark > 0) {                                              // low-key exposure: multiply keeps contrast (source-over would grey the picture)
      const d = q.dark, c1 = [255 - 150 * d, 255 - 125 * d, 255 - 95 * d].map(Math.round), c2 = [255 - 80 * d, 255 - 66 * d, 255 - 50 * d].map(Math.round);
      const dg = ctx.createLinearGradient(0, 0, 0, h); dg.addColorStop(0, 'rgb(' + c1 + ')'); dg.addColorStop(1, 'rgb(' + c2 + ')');
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
    }
    if (q.lift > 0) { ctx.globalCompositeOperation = 'lighten'; ctx.fillStyle = 'rgb(' + Math.round(4 + 14 * q.lift * 8) + ',' + Math.round(9 + 20 * q.lift * 8) + ',' + Math.round(16 + 30 * q.lift * 8) + ')'; ctx.fillRect(0, 0, w, h); }
    if (q.vig > 0) {
      const key = w + 'x' + h + ':' + q.vig;
      ctx.globalCompositeOperation = 'source-over';
      const gr = ctx.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.hypot(w, h) * 0.58);
      gr.addColorStop(0, 'rgba(2,6,12,0)'); gr.addColorStop(1, 'rgba(2,6,12,' + q.vig.toFixed(2) + ')'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
    if (q.grain > 0 && !low && !(M.Settings && M.Settings.get('reduceMotion'))) {
      const tile = noiseTile(), pat = ctx.createPattern(tile, 'repeat'), ox = Math.floor((t * 61) % 160), oy = Math.floor((t * 37) % 160);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = Math.min(1, q.grain * 4); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(ox, oy, w, h);
    }
    ctx.restore();
  }
  Gfx.Grade = { apply, PRESETS, on };
})(window.MOO);
