// The one sky behind every screen (tools/handoff/visual-system-plan.md, phase 1.2).
//   A static <canvas id="sky"> is the first child of #app, under #screens: screens that are not the universe themselves (Options, New game,
//   Load game, the Almanac, the ledgers) go transparent over it, so a screen change is a cross-fade within one place instead of a cut to
//   another backdrop. The galaxy map, the star system and the scenes stay opaque: they are the sky.
//   Painted once per window size from Gfx.Space.sky() (the same definition the map and the title read), never per frame; a slow drift
//   (CSS transform) on the high tiers only, never under reduceMotion / data-fx="off", never on phones. After each paint the picture is
//   also published as the CSS custom property --sky-img (a data URL) so a well can show the sky *behind it* with
//   `background: var(--sky-img) 50% 50% / cover fixed` — the ledgers' empty tables are windows on the same sky.
//   UI.Sky.install()   once at boot (main.js)      UI.Sky.repaint()   after a tier change      <html class="has-sky"> while installed
(function (M) {
  'use strict';
  const UI = M.UI;
  const Sky = UI.Sky = { el: null, key: '', busy: false };

  UI.css('sky', `
    #sky { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; background:#030309; }
    #sky.drift { transform-origin:50% 50%; animation:sky-drift 140s ease-in-out infinite alternate; }
    @keyframes sky-drift { from { transform:scale(1.045) translate(-.55%, -.3%); } to { transform:scale(1.045) translate(.55%, .3%); } }
    html[data-fx="off"] #sky.drift, html[data-phone] #sky.drift { animation:none; transform:none; }
    /* screens that are rooms on the ship, not the universe: their own painted sky goes, the one sky shows through */
    html.has-sky:root:root :is(.op-wrap, .sl-wrap, .su-wrap) { background:transparent; }
    html.has-sky:root:root .al { background:radial-gradient(110% 80% at 10% 0%, rgba(26,38,114,.55) 0%, rgba(26,38,114,0) 58%), radial-gradient(90% 70% at 100% 100%, rgba(44,26,92,.5) 0%, rgba(44,26,92,0) 62%); }
    html.has-sky:root:root :is(.lp, .lf) { background:radial-gradient(90% 70% at 50% 0%, rgba(47,34,24,.55) 0%, rgba(47,34,24,0) 70%); }
    /* the ledgers' empty tables are windows on the sky behind the sheet (fixed attachment: the well shows the part of the sky it covers) */
    html.has-sky:root:root:not([data-phone]) :is(.lp-tablewrap, .lf-body) { background:linear-gradient(180deg, #2f231a 0%, rgba(47,35,26,.92) 18%, rgba(47,35,26,.78) 100%), var(--sky-img, none) 50% 50% / cover fixed no-repeat #120d09; }
  `);

  function dpr() {
    const q = M.Perf && M.Perf.q, d = (q && q.dpr) || window.devicePixelRatio || 1;
    return Math.max(1, Math.min(2, d));
  }
  function gpu() { const G = M.Gfx && M.Gfx.GLSpace; return !!(G && G.supported && G.supported()); }

  // paint the window-sized sky (cached per size + tier); on the CPU path the painter caps at 1280x720 and the canvas stretches it
  function paint() {
    const el = Sky.el; if (!el) return;
    const w = Math.max(2, window.innerWidth), h = Math.max(2, window.innerHeight), d = dpr(), g = gpu();
    const key = w + 'x' + h + '@' + d + (g ? 'g' : 'c');
    if (key === Sky.key) return;
    Sky.key = key;
    const pw = Math.round(w * d), ph = Math.round(h * d);
    const Sp = M.Gfx && M.Gfx.pick ? M.Gfx.pick('space') : (M.Gfx && M.Gfx.Space);
    let src = null;
    try {
      if (Sp && Sp.makeBackdrop && Sp.sky) {
        const cw = Math.min(pw, g ? 2560 : 1280), ch = Math.round(cw * ph / pw);
        src = Sp.makeBackdrop(cw, ch, 'sky', Sp.sky({ intensity: 0.8, stars: 1.1, floor: 0.08 }));
      }
    } catch (e) { console.warn('[sky] backdrop failed, keeping the flat void', e); src = null; }
    el.width = pw; el.height = ph;
    const x = el.getContext('2d');
    if (src && (src.width || src.naturalWidth)) x.drawImage(src, 0, 0, pw, ph);
    else { const gr = x.createRadialGradient(pw / 2, ph * 0.46, 0, pw / 2, ph / 2, Math.hypot(pw, ph) * 0.62); gr.addColorStop(0, '#0e0c1e'); gr.addColorStop(0.55, '#070614'); gr.addColorStop(1, '#030309'); x.fillStyle = gr; x.fillRect(0, 0, pw, ph); }
    publish();
    drift();
  }
  // the same picture as a CSS token, encoded off the frame (a webp data URL of a 2560-wide sky is ~150 KB)
  function publish() {
    const el = Sky.el, run = () => {
      try { const url = el.toDataURL('image/webp', 0.8); document.documentElement.style.setProperty('--sky-img', 'url("' + url + '")'); } catch (e) { /* tainted or unsupported: the wells keep their fallback */ }
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 50);
  }
  function drift() {
    const el = Sky.el; if (!el) return;
    const q = M.Perf && M.Perf.q, rm = M.Settings && M.Settings.get && M.Settings.get('reduceMotion');
    el.classList.toggle('drift', !!(q && q.glow >= 0.75 && !rm && !(M.Phone && M.Phone.active && M.Phone.active())));
  }

  Sky.install = function () {
    if (Sky.el || typeof document === 'undefined') return;
    const app = document.getElementById('app'); if (!app) return;
    const el = document.createElement('canvas'); el.id = 'sky'; el.setAttribute('aria-hidden', 'true');
    app.insertBefore(el, app.firstChild);
    Sky.el = el;
    document.documentElement.classList.add('has-sky');
    paint();
    const later = M.Util && M.Util.debounce ? M.Util.debounce(paint, 220) : paint;
    window.addEventListener('resize', later);
    if (M.Bus && M.Bus.on) {
      M.Bus.on('perf:tier', () => { Sky.key = ''; paint(); });      // a tier change can switch the painter (GPU / CPU) and the resolution
      M.Bus.on('settings', drift);
    }
  };
  Sky.repaint = function () { Sky.key = ''; paint(); };
})(window.MOO);
