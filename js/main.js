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
    // pre-compile the WebGL2 shader programs after the first frame so the first use does not hitch (all optional; the Canvas2D paths work without them)
    setTimeout(() => {
      for (const k of ['GLSpace', 'GLFx', 'GLPlanets']) {
        try { const g = M.Gfx && M.Gfx[k]; if (g && g.supported && g.supported() && g.warm) g.warm(); } catch (e) { console.warn(k + ' warm-up failed', e); }
      }
    }, 250);

    const unlock = () => {
      try { if (M.Audio && M.Audio.init) M.Audio.init(); } catch (e) { console.warn('audio init failed', e); }
      window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);

    // surface uncaught errors in-game (first few only) so problems are visible during development
    let shown = 0;
    window.addEventListener('error', e => { if (shown++ < 4) UI.toast('Error: ' + (e.message || e.error), 'bad', 9000); });
    window.addEventListener('unhandledrejection', e => { if (shown++ < 4) UI.toast('Error: ' + (e.reason && e.reason.message || e.reason), 'bad', 9000); });

    const q = new URLSearchParams(location.search);
    let first = q.get('screen');
    if (!first || !UI.Screens.has(first)) first = UI.Screens.has('menu') ? 'menu' : 'styleguide';
    try { if (M.Game && M.Game.devBoot && q.get('dev')) M.Game.devBoot(q); } catch (e) { console.error(e); }
    UI.Screens.go(first, {});

    const boot = document.getElementById('boot');
    if (boot) { boot.classList.add('gone'); setTimeout(() => boot.remove(), 700); }
  };
})(window.MOO);
