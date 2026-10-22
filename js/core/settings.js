// User preferences (not part of a save game). Persisted in localStorage; emits 'settings' on the bus when changed.
//   MOO.Settings.get('animSpeed')   MOO.Settings.set('animSpeed', 2)   MOO.Settings.all()
(function (M) {
  'use strict';
  const KEY = 'moo.settings.v1';
  const DEFAULTS = {
    music: true,            // background music on/off (volume lives in MOO.Audio.settings)
    sfx: true,
    animSpeed: 1,           // 0 = instant, 1 = normal, 2 = fast (fleet moves, combat playback)
    autosave: true,         // autosave at the start of every turn
    tactical: true,         // default for new games: play out battles tactically (false = auto-resolve)
    confirmEndTurn: false,  // ask before ending a turn with idle colonies / unassigned research
    landingScenes: true,    // play the colony-ship landing vignette when founding a colony (false: the card's Yes founds it at once)
    newsMode: 'broadcast',  // 'broadcast' = the GNN studio scene; 'brief' = one list of the turn's headlines with a single Continue
    showTips: true,         // tooltips
    reduceMotion: false,    // less screen motion/particles
    mapLabels: 'auto',      // 'auto' | 'all' | 'owned'
    mapGrid: true,          // star-chart graticule on the galaxy map
    turnLogOpen: true,      // the galaxy sidebar's "Last turn" log is expanded
    mapRoutes: true,
    mapDeclutter: false,    // the galaxy map's declutter mode (button / V)        // fleet route lines and colony rally lines on the galaxy map (the map's route button / L)
    uiScale: 1,             // multiplies the fluid UI scale (0.85–1.3)
    threads: 0,             // worker threads for AI/combat/texture jobs: 0 = auto (all logical threads - 1)
    graphics: 'auto',       // 'auto' | 'low' | 'medium' | 'high' | 'ultra' (see MOO.Perf)
    gpu: true,              // use WebGL2 shader renderers when available (false = Canvas2D fallbacks)
    perfOverlay: false,     // F3 overlay: fps, frame ms, worker utilisation, GPU (phones: a row in Options)
    phoneHints: false,      // phones: the first-run card on touch controls has been shown (js/ui/phone-galaxy.js)
    haptics: true,          // phones: short vibrations on Next turn, slider steps, switches, sheet snaps and errors (UI.Phone.haptic)
    lastSetup: null,        // remembered new-game choices
  };
  let cur = Object.assign({}, DEFAULTS);
  try { const t = typeof localStorage !== 'undefined' && localStorage.getItem(KEY); if (t) cur = Object.assign(cur, JSON.parse(t)); } catch (e) { /* ignore */ }

  function persist() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* ignore */ } }

  M.Settings = {
    DEFAULTS,
    get: k => cur[k],
    all: () => Object.assign({}, cur),
    set(k, v) { if (cur[k] === v) return; cur[k] = v; persist(); if (M.Bus) M.Bus.emit('settings', k, v); },
    reset() { cur = Object.assign({}, DEFAULTS); persist(); if (M.Bus) M.Bus.emit('settings', null, null); },
  };
})(window.MOO);
