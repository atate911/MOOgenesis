// Adaptive performance manager — the game scales UP on strong machines and DOWN on modest ones.
//   MOO.Perf.q            current quality knobs (read every frame, cheap):
//       dpr (max devicePixelRatio for canvases), particles (×), planetDetail (×), gl (use WebGL2 renderers), bloom, nebula (×), glow (×), maxFx, animFps
//   MOO.Perf.tier         'low' | 'medium' | 'high' | 'ultra'   (effective tier)        MOO.Perf.preset  'auto' | tier (user choice)
//   MOO.Perf.fps / frameMs  smoothed frame stats          MOO.Perf.caps  probed capabilities
//   MOO.Perf.setPreset(p) · MOO.Perf.start() (called at boot) · MOO.Bus 'perf:tier' (tier, q) on change · F3 toggles the overlay
// In 'auto' the tier starts from a hardware heuristic, then adapts: sustained slow frames drop a tier, sustained headroom raises one
// (never above the heuristic cap + 1; never above the cap on a software GL renderer). Gfx modules must scale effort from MOO.Perf.q instead of hard-coding counts.
//   <html data-fx="off"|"on"> mirrors low tier / reduceMotion for CSS (theme-v2 drops its full-screen overlay when off).
(function (M) {
  'use strict';
  const TIERS = {
    low:    { dpr: 1,   particles: 0.25, planetDetail: 0.5,  gl: false, bloom: false, nebula: 0.5,  glow: 0.5, maxFx: 600,  animFps: 30 },
    medium: { dpr: 1.5, particles: 0.6,  planetDetail: 0.75, gl: true,  bloom: false, nebula: 0.75, glow: 0.8, maxFx: 1800, animFps: 60 },
    high:   { dpr: 2,   particles: 1,    planetDetail: 1,    gl: true,  bloom: true,  nebula: 1,    glow: 1,   maxFx: 5000, animFps: 60 },
    ultra:  { dpr: 2.5, particles: 1.6,  planetDetail: 1.5,  gl: true,  bloom: true,  nebula: 1.25, glow: 1.2, maxFx: 12000, animFps: 120 },
  };
  const ORDER = ['low', 'medium', 'high', 'ultra'];

  const P = M.Perf = {
    TIERS, ORDER,
    tier: 'high', preset: 'auto', q: Object.assign({}, TIERS.high),
    fps: 60, frameMs: 16.7, caps: null, cap: 'high', started: false, overlay: false,
  };

  function probe() {
    const caps = { threads: M.HW.threads, memoryGB: M.HW.memoryGB || 0, dpr: window.devicePixelRatio || 1, webgl2: false, gpu: '', discrete: false, software: false, maxTex: 0, screen: [screen.width, screen.height] };
    try {
      const c = document.createElement('canvas'); const gl = c.getContext('webgl2', { powerPreference: 'high-performance' });
      if (gl) {
        caps.webgl2 = true; caps.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const e = gl.getExtension('WEBGL_debug_renderer_info');
        caps.gpu = String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      }
    } catch (err) { /* no GL */ }
    const g = caps.gpu.toLowerCase();
    caps.software = /swiftshader|llvmpipe|software|basic render|microsoft basic/.test(g);
    caps.discrete = /rtx|gtx|geforce|radeon rx|radeon pro|arc a|quadro|apple m|nvidia|rx \d{3,4}/.test(g) && !caps.software;
    M.HW.gpu = caps.gpu; M.HW.webgl2 = caps.webgl2;
    return caps;
  }

  function heuristicTier(c) {
    if (!c.webgl2 || c.software) return 'low';
    let score = 0;
    score += c.discrete ? 2 : 1;
    score += c.threads >= 12 ? 1 : c.threads >= 6 ? 0.5 : 0;
    score += c.memoryGB >= 8 || c.memoryGB === 0 ? 0.5 : 0;
    score -= (c.dpr > 2 && !c.discrete) ? 1 : 0;
    if (score >= 3.5) return 'ultra';
    if (score >= 2.5) return 'high';
    if (score >= 1.5) return 'medium';
    return 'low';
  }

  function apply(tier, why) {
    if (!TIERS[tier]) tier = 'high';
    const changed = tier !== P.tier;
    P.tier = tier; P.q = Object.assign({}, TIERS[tier]);
    if (!M.Settings || M.Settings.get('gpu') === false) P.q.gl = false;
    if (P.caps && !P.caps.webgl2) P.q.gl = false;
    const reduce = !!(M.Settings && M.Settings.get('reduceMotion'));
    if (reduce) { P.q.particles *= 0.4; P.q.animFps = Math.min(P.q.animFps, 30); }
    // css/theme-v2.css: data-fx="off" drops the full-screen vignette/scanline overlay (a per-frame composite) on the low tier / reduceMotion
    try { document.documentElement.dataset.fx = (tier === 'low' || reduce) ? 'off' : 'on'; } catch (e) { /* no DOM */ }
    if (changed && M.Bus) M.Bus.emit('perf:tier', tier, P.q, why || '');
  }

  P.setPreset = function (p) {
    P.preset = p || 'auto';
    if (M.Settings) M.Settings.set('graphics', P.preset);
    if (P.preset === 'auto') apply(P.cap, 'auto'); else apply(P.preset, 'user');
  };

  // ---- frame-time governor -------------------------------------------------------------------
  // highest tier index 'auto' may climb to: heuristic cap + 1, except on a software GL renderer where the cap is final (raising to
  // 'medium' switches the GL renderers on, frames collapse, it drops back, and the cycle repeated every ~20 s)
  function maxTier() { const c = ORDER.indexOf(P.cap); return P.caps && P.caps.software ? c : c + 1; }
  let acc = 0, n = 0, slowSecs = 0, fastSecs = 0, last = 0, cooldown = 0;
  function tick(dt) {
    if (dt > 0.25 || dt <= 0) return;                // ignore hidden-tab gaps
    P.frameMs += (dt * 1000 - P.frameMs) * 0.08; P.fps = 1000 / P.frameMs;
    acc += dt; n++;
    if (acc < 1) return;
    const avg = acc / n * 1000; acc = 0; n = 0;
    if (cooldown > 0) cooldown--;
    if (P.preset !== 'auto') return;
    const budget = 1000 / Math.min(P.q.animFps, 60);   // ms per frame we should hit
    if (avg > budget * 1.35) { slowSecs++; fastSecs = 0; } else if (avg < budget * 0.55) { fastSecs++; slowSecs = 0; } else { slowSecs = 0; fastSecs = 0; }
    const i = ORDER.indexOf(P.tier);
    if (slowSecs >= 3 && i > 0 && !cooldown) { apply(ORDER[i - 1], 'slow frames'); slowSecs = 0; cooldown = 6; }
    else if (fastSecs >= 10 && i < maxTier() && i < ORDER.length - 1 && !cooldown) { apply(ORDER[i + 1], 'headroom'); fastSecs = 0; cooldown = 12; }
  }

  // ---- overlay (F3) ----------------------------------------------------------------------------
  let ovEl = null, ovT = 0;
  function renderOverlay() {
    if (!ovEl) { ovEl = document.createElement('div'); ovEl.style.cssText = 'position:fixed;right:8px;top:8px;z-index:300;padding:6px 9px;font:12px/1.45 monospace;color:#cfe;background:rgba(5,8,25,.82);border:1px solid rgba(214,179,106,.5);pointer-events:none;white-space:pre'; document.body.appendChild(ovEl); }
    ovEl.style.display = P.overlay ? 'block' : 'none';
    if (!P.overlay) return;
    const w = M.Workers ? M.Workers.stats() : null, c = P.caps || {};
    ovEl.textContent =
      `${P.fps.toFixed(0)} fps · ${P.frameMs.toFixed(1)} ms · tier ${P.tier}${P.preset === 'auto' ? ' (auto)' : ''}\n` +
      `GPU ${c.gpu || 'n/a'}${P.q.gl ? '' : ' [2D mode]'}\n` +
      `threads ${c.threads} · workers ${w ? w.size : 0}${w && w.inline ? ' (inline)' : ''} busy ${w ? w.busy : 0} q ${w ? w.queued : 0} · util ${w ? (w.utilisation * 100).toFixed(0) : 0}%\n` +
      `jobs ${w ? w.completed : 0} done · last batch ${w ? w.lastBatchN : 0}×${w ? w.lastBatchMs.toFixed(0) : 0}ms` + (performance.memory ? `\nheap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : '');
  }

  P.start = function () {
    if (P.started) return; P.started = true;
    P.caps = probe(); P.cap = heuristicTier(P.caps);
    let pref = (M.Settings && M.Settings.get('graphics')) || 'auto';
    try { const qt = new URLSearchParams(location.search).get('tier'); if (qt && TIERS[qt]) pref = qt; } catch (e) { /* ?tier=low|medium|high|ultra forces a tier for this page load (QA / measuring) */ }
    P.preset = pref; apply(pref === 'auto' ? P.cap : pref, 'startup');
    if (M.UI && M.UI.onFrame) M.UI.onFrame(dt => { tick(dt); ovT += dt; if (ovT > 0.25) { ovT = 0; renderOverlay(); } });
    if (M.UI && M.UI.bindKey) M.UI.bindKey('F3', () => { P.overlay = !P.overlay; if (M.Settings) M.Settings.set('perfOverlay', P.overlay); renderOverlay(); }, { modal: true });
    P.overlay = !!(M.Settings && M.Settings.get('perfOverlay'));
    if (M.Bus) M.Bus.on('settings', k => { if (k === 'gpu' || k === 'reduceMotion' || k === null) apply(P.tier, 'settings'); });
  };

  // convenience for gfx modules: devicePixelRatio capped by the current tier
  P.dpr = () => Math.min(window.devicePixelRatio || 1, P.q.dpr);
})(window.MOO);
