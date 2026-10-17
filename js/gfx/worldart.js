(function (M) {
  'use strict';
  /* ####################################################################################################################
     WORLD ART : pre-rendered photoreal illustrations in assets/art/<kind>/<kind>-<key>.webp  (races: races/race-<id>-<purpose>.webp)
     Orbit cards, surface / system / colony / event / scene backdrops, race rooms and the GNN studio.  Converted from the
     masters in assets/world-art/ (PNG + JSON sidecars, see its asset-manifest.json).
     Every lookup returns an <img> or null; null means "not loaded (yet) / missing / disabled" and the caller keeps its procedural
     art, so nothing depends on these files.  Plain <img> => works from file://; pixels are never read back.
     Decoded images live in an LRU capped by MOO.HW.memoryGB.  Disable with WorldArt.enabled = false or ?art=0.
     #################################################################################################################### */
  const W = { base: 'assets/art/', enabled: true, img: new Map(), state: {}, subs: [], bytes: 0 };
  (function () {
    try { const cs = document.currentScript; W.base = new URL('../../assets/art/', cs && cs.src ? cs.src : location.href).href; } catch (e) { /* relative fallback */ }
    try { if (/[?&]art=0\b/.test(location.search)) W.enabled = false; } catch (e) { /* ignore */ }
  })();

  const ORBIT = ['arid', 'asteroids', 'artifacts', 'barren', 'dead', 'desert', 'gaia', 'inferno', 'jungle', 'minimal', 'ocean', 'orion', 'radiated', 'steppe', 'terran', 'toxic', 'tundra'];
  const SURFACE = ['arid', 'asteroid', 'barren', 'dead', 'desert', 'inferno', 'jungle', 'minimal', 'ocean', 'radiated', 'steppe', 'terran', 'toxic', 'tundra'];
  const SYSTEM = ['blue', 'green', 'purple', 'red', 'white', 'yellow'];
  const EVENTS = ['bombarded', 'comet', 'devastated', 'nova', 'pirates', 'plague', 'planet-destroyed', 'rebellion'];
  const COLONY = ['barren-mining', 'dome-hostile', 'fortress', 'industrial', 'polluted', 'terran-city'];
  const SCENES = ['first-landing', 'galaxy', 'ground-battle'];
  const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  const PURPOSES = ['audience', 'scientist', 'figure', 'homeworld', 'council', 'homeworld-square'];
  // Batch-4 sprites / skies (docs/IMAGE-GEN-SPRITES.md) and batch-3 stills (docs/IMAGE-GEN-OTHER.md): looked up by the same rules,
  // so the callers below fall back to procedural art until the files exist in assets/art/.
  const BATTLE = ['planet', 'nebula', 'asteroids', 'star', 'deep'];
  const FX = ['rock-1', 'rock-2', 'rock-3', 'rock-4', 'rock-5', 'rock-6', 'rock-7', 'rock-8', 'debris-1', 'debris-2', 'debris-3', 'base-platform'];
  const STILLS = ['end-exile', 'inst-spaceport', 'title-key-art'];
  const has = (a, k) => a.indexOf(k) >= 0;

  function budget() { const gb = (M.HW && M.HW.memoryGB) || 4; return Math.max(160, Math.min(480, gb * 48)) * 1048576; }
  function bytesOf(im) { return im.naturalWidth * im.naturalHeight * 4; }

  /* path is relative to assets/art/, e.g. 'orbit/orbit-ocean'. Returns the loaded <img>, or null (starting a load if needed). */
  function get(path) {
    if (!W.enabled || !path) return null;
    const st = W.state[path];
    if (st === 'ok') { const im = W.img.get(path); W.img.delete(path); W.img.set(path, im); return im; }   // LRU touch
    if (!st) load(path);
    return null;
  }
  function load(path) {
    if (W.state[path] === 'loading' || W.state[path] === 'bad') return;
    W.state[path] = 'loading';
    const im = new Image();
    im.decoding = 'async';
    im.onload = function () {
      if (!(im.naturalWidth > 0)) { W.state[path] = 'bad'; return; }
      W.img.set(path, im); W.state[path] = 'ok'; W.bytes += bytesOf(im);
      const cap = budget();
      for (const k of Array.from(W.img.keys())) {              // evict least-recently-used (never the one just loaded)
        if (W.bytes <= cap || k === path) continue;
        const o = W.img.get(k); W.img.delete(k); W.state[k] = ''; W.bytes -= bytesOf(o);
      }
      W.subs.slice().forEach((f) => { try { f(path); } catch (e) { /* ignore */ } });
      try { window.dispatchEvent(new CustomEvent('moo-worldart-loaded', { detail: { path: path } })); } catch (e) { /* ignore */ }
    };
    im.onerror = function () { W.state[path] = 'bad'; };
    im.src = W.base + path + '.webp';
  }
  function ready(path) { return W.state[path] === 'ok'; }
  function whenReady(path, fn) {
    if (!W.enabled) return;
    if (ready(path)) { fn(); return; }
    get(path);
    const f = (p) => { if (p === path) { const i = W.subs.indexOf(f); if (i >= 0) W.subs.splice(i, 1); fn(); } };
    W.subs.push(f);
  }

  /* ---- key resolvers: game data -> asset path (null when no art fits) ---- */
  function orbitPath(p, S) {                      // planet {type, growth, special} ; precedence: Orion > Artifacts > Gaia > terrain
    if (!p) return null;                          // S (optional game state): the Orion card shows the Guardian, so it is used only while the Guardian lives
    if (p.special === 'orion' && !(S && S.guardian && S.guardian.alive === false)) return 'orbit/orbit-orion';
    if (p.special === 'artifacts') return 'orbit/orbit-artifacts';
    if (p.growth === 'gaia') return 'orbit/orbit-gaia';
    const t = p.type === 'none' ? 'asteroids' : p.type;
    return has(ORBIT, t) ? 'orbit/orbit-' + t : null;
  }
  function surfacePath(look) {                    // landing.js / scenes.js look name
    if (look === 'asteroids' || look === 'asteroid') return 'surface/surface-asteroid';
    if (look === 'gaia') look = 'terran';
    return has(SURFACE, look) ? 'surface/surface-' + look : null;
  }
  function systemPath(color) { return has(SYSTEM, color) ? 'system/system-' + color : null; }
  function systemSkyPath(color) { return has(SYSTEM, color) ? 'system-sky/system-sky-' + color : null; }   // planet-free sky (batch 4)
  function battlePath(name) { return has(BATTLE, name) ? 'battle/battle-' + name : null; }                  // tactical backdrops (batch 3)
  function fxPath(name) { return has(FX, name) ? 'fx/' + name : null; }                                      // rock / debris / base cutouts (batch 4)
  function stillPath(name) { return has(STILLS, name) ? 'still/' + name : null; }                            // end-exile, inst-spaceport, title-key-art (batch 3)
  function eventPath(name) { return has(EVENTS, name) ? 'event/event-' + name : null; }
  function scenePath(name) { return has(SCENES, name) ? 'scene/scene-' + name : null; }
  function racePath(race, purpose) { return has(RACES, race) && has(PURPOSES, purpose) ? 'races/race-' + race + '-' + purpose : null; }
  /* colony art for a settled planet: hostile -> domes, barren/dead -> mining, high pollution -> polluted, big industry -> industrial, else city */
  function colonyPath(p, o) {
    o = o || {};
    if (o.fortified) return 'colony/colony-fortress';
    if (o.polluted) return 'colony/colony-polluted';
    if (p && (p.type === 'toxic' || p.type === 'radiated' || p.type === 'inferno')) return 'colony/colony-dome-hostile';
    if (p && (p.type === 'barren' || p.type === 'dead' || p.type === 'none')) return 'colony/colony-barren-mining';
    if (o.industrial) return 'colony/colony-industrial';
    return 'colony/colony-terran-city';
  }
  const GNN = 'gnn/race-neutral-gnn-studio-background';

  /* Paint an image into the box. fit: 'cover' (default, crops) | 'contain'. (fx, fy) = focal point 0..1 kept in view when cropping.
     o.zoom >= 1 zooms in about the focal point (slow push-ins).  Returns false when the image is not ready. */
  function draw(ctx, path, x, y, w, h, o) {
    const im = typeof path === 'string' ? get(path) : path;
    if (!im) return false;
    o = o || {};
    const iw = im.naturalWidth, ih = im.naturalHeight, fx = o.fx == null ? 0.5 : o.fx, fy = o.fy == null ? 0.5 : o.fy;
    const z = o.zoom > 1 ? o.zoom : 1;
    let sx, sy, sw, sh;
    if (o.fit === 'contain') {
      const s = Math.min(w / iw, h / ih), dw = iw * s, dh = ih * s;
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore();
      return true;
    }
    const s = Math.max(w / iw, h / ih) * z;
    sw = w / s; sh = h / s;
    sx = Math.max(0, Math.min(iw - sw, fx * iw - sw * fx)); sy = Math.max(0, Math.min(ih - sh, fy * ih - sh * fy));
    ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h); ctx.restore();
    return true;
  }
  /* a canvas element holding the image (thumbnails / DOM use). Starts as a transparent canvas and fills in when loaded. */
  function canvas(path, w, h, o) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const paint = () => { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); draw(g, path, 0, 0, w, h, o); };
    if (path) { if (ready(path)) paint(); else whenReady(path, paint); }
    return c;
  }
  /* idle-time warm-up of a list of paths (keeps the first paint of a screen from popping) */
  function preload(paths) {
    if (!W.enabled) return;
    let i = 0; const ric = window.requestIdleCallback || ((f) => setTimeout(f, 250));
    const step = () => { if (i < paths.length) { get(paths[i++]); ric(step); } };
    ric(step);
  }

  M.Gfx.WorldArt = {
    get: get, ready: ready, whenReady: whenReady, draw: draw, canvas: canvas, preload: preload,
    orbit: orbitPath, surface: surfacePath, system: systemPath, event: eventPath, scene: scenePath, race: racePath, colony: colonyPath, gnn: GNN,
    systemSky: systemSkyPath, battle: battlePath, fx: fxPath, still: stillPath,
    get enabled() { return W.enabled; }, set enabled(v) { W.enabled = !!v; },
    lists: { orbit: ORBIT, surface: SURFACE, system: SYSTEM, events: EVENTS, colony: COLONY, scenes: SCENES, races: RACES, purposes: PURPOSES, battle: BATTLE, fx: FX, stills: STILLS },
    _state: W,
  };
})(window.MOO);
