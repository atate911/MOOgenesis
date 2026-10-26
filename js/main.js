// Boot sequence. Loaded last; loader.js calls MOO.boot() once every script has executed.
(function (M) {
  'use strict';

  M.boot = function () {
    const UI = M.UI;
    UI.init();
    UI.startLoop();
    try { if (UI.Help && UI.Help.install) UI.Help.install(); } catch (e) { console.warn('help install failed', e); }      // F1 context help overlay + tutor tips

    // Web Audio needs a user gesture; unlock on the first one.
    // adaptive quality + worker pool (both optional accelerators; the game runs without them)
    try { M.Perf.start(); } catch (e) { console.warn('perf start failed', e); }
    setTimeout(() => { try { M.Workers.init(); } catch (e) { console.warn('workers init failed', e); } }, 400);
    // pre-compile the WebGL2 shader programs in the background so the first use does not hitch (all optional; the Canvas2D paths work
    // without them). The three warm-ups are staggered over idle callbacks and each one only QUEUES work (GL.precompile / idle slices):
    // nothing here blocks a frame, and a renderer that needs a program before it is linked falls back to Canvas2D for that call.
    const idle = (fn, t) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, 120));
    const warms = [['GLSpace', { vortex: false }], ['GLFx', { async: true }], ['GLPlanets', undefined]];
    idle(function nextWarm() {
      const w = warms.shift(); if (!w) return;
      try { const g = M.Gfx && M.Gfx[w[0]], GL = M.Gfx && M.Gfx.GL; if (g && g.warm && GL && GL.supported && GL.supported()) g.warm(w[1]); } catch (e) { console.warn(w[0] + ' warm-up failed', e); }
      idle(nextWarm, 1500);
    }, 2000);

    const unlock = () => {
      try { if (M.Audio && M.Audio.init) M.Audio.init(); } catch (e) { console.warn('audio init failed', e); }
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

    // surface uncaught errors in-game (first few only) so problems are visible during development. Only the game's own: browsers
    // and extensions inject scripts into the page (Brave's wallet: "window.ethereum…", cross-origin ones: a bare "Script error."),
    // and their errors land here too. Ours come from a file under <origin>/js/ (or a worker blob); the rest only go to the console.
    let shown = 0;
    let jsBase = '/js/'; try { jsBase = new URL('js/', location.href).href; } catch (e) { /* the page's own js/ folder, wherever the game is hosted */ }
    const ours = s => typeof s === 'string' && (s.indexOf(jsBase) >= 0 || s.indexOf('blob:') >= 0);
    window.addEventListener('error', e => { if (ours(e.filename) && shown++ < 4) UI.toast('Error: ' + (e.message || e.error), 'bad', 9000); });
    window.addEventListener('unhandledrejection', e => { const r = e.reason, st = r && r.stack; if ((typeof st === 'string' ? ours(st) : true) && shown++ < 4) UI.toast('Error: ' + (r && r.message || r), 'bad', 9000); });   // no stack to judge by: show it

    const q = new URLSearchParams(location.search);
    let first = q.get('screen');
    if (!first || !UI.Screens.has(first)) first = UI.Screens.has('menu') ? 'menu' : 'styleguide';
    try { if (M.Game && M.Game.devBoot && q.get('dev')) M.Game.devBoot(q); } catch (e) { console.error(e); }
    UI.Screens.go(first, {});

    const boot = document.getElementById('boot');
    if (boot) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 700); }
  };
})(window.MOO);
