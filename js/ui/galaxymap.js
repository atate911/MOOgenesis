// Galaxy map — the main view of the game: a reusable pan/zoom star-chart CANVAS component (the screen shell lives in ui/galaxy.js).
//
//   const map = MOO.UI.GalaxyMap.create(containerEl, opts);   containerEl should have a size (the map fills it)
//   map.setState(S) · map.refresh()                       S = MOO.Game.S; calling setState(S) again with the SAME object == refresh() (fleets then glide to their new positions)
//   map.setMode('normal'|'colonies'|'environments'|'minerals') · getMode()      overview filters + Map Key legend (map.legend() -> HTMLElement, showLegend(bool))
//   map.select(starId|null) · selectFleet(id|null) · getSelection()             API-driven changes do NOT emit events unless {emit:true}; {center:true} also flies there
//   map.centerOn(starId|{x,y}, {zoom, animate}) · fit() · home()                smooth fly-to camera. zoom is RELATIVE to the fit-all view (1 = whole galaxy, 4 = four times closer)
//   map.setRoutePreview({from,to,eta,valid,reason}|null) · beginRoute(fleetId) · endRoute()    route mode: left-click a star -> 'moveOrder'
//   map.highlightStars(ids, {color}) · setRanges({stars:[ids], radius (parsecs), color}|null)  pulsing target marks / dashed range rings
//   map.setFog(bool) · getFog() · getCamera() · worldToScreen · screenToWorld · starAt(px,py) · resize() · destroy() · on(evt, fn) -> off() · off(evt, fn)
//   Events: 'selectStar'(id) 'selectFleet'(id|null) 'hoverStar'(id|null) 'hoverFleet'(id|null) 'moveOrder'({fleetId,toStar}) 'routeCancel'(fleetId)
//           'contextStar'(id) 'dblStar'(id) 'cameraChanged'({x,y,zoom,view}).  'selectStar' is never emitted with null (the host's panel always has a star).
//   Input: drag = pan (with inertia) · wheel/pinch = zoom at the cursor · click = select · right-click a star with a fleet selected = move order · dbl-click = 'dblStar' (empty space: zoom in)
//          arrows (hold, Shift = fast) · + / - · Home = capital · End = fit · Esc = cancel route / deselect fleet (otherwise left to the host, e.g. game menu)
//   opts: {minimap:'auto'|true|false|{corner:'br'|'bl'|'tr'|'tl', size}, legend:true|false|'always', controls:true, keys:true, hud:true, ruler:true, tooltips:true, fog:true,
//          initialView:'auto'|'fit'|'capital', clearOnEmptyClick:false, escClears:false, envOf:(planet,star)=>0..6, routeInfo:(fleet,toStarId)=>({eta,valid,reason}), backdrop:'auto'|'builtin'}
// UNITS: star/fleet x,y and S.galaxy are MAP UNITS (1 parsec ~ 11 units, S.galaxy.pc overrides); empire.range / mods.scan and fleet.speed are PARSECS; zoom = screen px per unit.
// REAL STATE (js/sim): star.color = class, star.nebula, S.orion + S.guardian{alive}, ONE planet per star (S.planets[star.id]); empire.vis[] = 0 unexplored (class visible, planet hidden) |
//   1 explored, out of scanner range (owner/pop from empire.seen[star]) | 2 explored and live; fleets come from MOO.Sim.Q.mapFleets (already fog-filtered, with kind + eta, transports have string ids).
//   The mock (tools/mockstate.js) emits the same shape plus legacy aliases (kind, inNebula), and the component accepts either.
// Rendering scales with MOO.Perf.q (glow / nebula / particles / dpr / animFps): low = no twinkle, parallax or spikes; high/ultra = everything. Gfx.Space (backdrop, star sprites, living sun surfaces),
//   Gfx.Planets (lit planet spheres) and Gfx.Ships.drawFleetMarker are used when present, with built-in fallbacks for each.
(function (M) {
  'use strict';
  const UI = M.UI, doc = document;
  const PI = Math.PI, TAU = PI * 2;

  // ================================================================== small helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const hex = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hashInt = n => { n = Math.imul((n | 0) ^ ((n | 0) >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return (n ^ (n >>> 16)) >>> 0; };
  const rng32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const mk = (w, h) => { const c = doc.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, a, b) => (n === 1 ? a : b || a + 's');
  const PC_DEFAULT = 11;          // map units per parsec

  // chamfered rectangle path (45-degree cuts, like every panel in the UI kit)
  function plate(g, x, y, w, h, c) {
    g.beginPath();
    g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
    g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }

  // ================================================================== theme (CSS variables, read once)
  const FALLBACK = {
    void: '#060919', night: '#0a1030', deep: '#0d153a', brass: '#d6b36a', brassHi: '#f3dca0', brassLo: '#8a7040', ivory: '#ece6d3', mist: '#98a5cf', fog: '#5d6a96',
    cyan: '#62d8ff', ember: '#ff9440', leaf: '#5fdc8f', rose: '#ff5c6a', violet: '#a98bff', gold: '#ffd54f', teal: '#38d6c4', azure: '#5b8cff',
    emp: ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#eceaf2', '#e8c94a'],        // Blue Green Purple Red White Yellow
  };
  const CSSVAR = { void: '--void', night: '--night', deep: '--deep', brass: '--brass', brassHi: '--brass-hi', brassLo: '--brass-lo', ivory: '--ivory', mist: '--mist', fog: '--fog',
    cyan: '--cyan', ember: '--ember', leaf: '--leaf', rose: '--rose', violet: '--violet', gold: '--gold', teal: '--teal', azure: '--azure' };
  let theme = null;
  function readTheme(force) {
    if (theme && !force) return theme;
    const t = { emp: [], rgb: {} };
    let cs = null; try { cs = getComputedStyle(doc.documentElement); } catch (e) { cs = null; }
    const v = (name, def) => { const s = cs ? String(cs.getPropertyValue(name)).trim() : ''; return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s) ? s : def; };
    for (const k in CSSVAR) { t[k] = v(CSSVAR[k], FALLBACK[k]); t.rgb[k] = hex(t[k]); }
    for (let i = 0; i < 6; i++) t.emp.push(v('--emp' + i, FALLBACK.emp[i]));
    t.empRGB = t.emp.map(hex);
    const fd = cs ? String(cs.getPropertyValue('--font-display')).trim() : '', fu = cs ? String(cs.getPropertyValue('--font-ui')).trim() : '';
    t.fontDisp = fd || "'Marcellus SC', 'Palatino Linotype', Georgia, serif";
    t.fontUi = fu || "'IBM Plex Sans Condensed', 'Segoe UI', sans-serif";
    theme = t; return t;
  }

  // ================================================================== tables
  // star classes: core / mid / halo colours, relative size, diffraction-spike strength, twinkle speed. (orange / blackhole are accepted extras)
  const KINDS = {
    yellow:    { name: 'Yellow star', core: [255, 250, 226], mid: [255, 224, 124], halo: [255, 176, 64], s: 1.0, spike: 0.85, tw: 1.0 },
    orange:    { name: 'Orange star', core: [255, 241, 216], mid: [255, 182, 100], halo: [255, 126, 52], s: 0.94, spike: 0.55, tw: 0.9 },
    red:       { name: 'Red star', core: [255, 228, 216], mid: [255, 116, 96], halo: [236, 56, 60], s: 0.88, spike: 0.3, tw: 0.8 },
    blue:      { name: 'Blue star', core: [244, 250, 255], mid: [156, 206, 255], halo: [78, 148, 255], s: 1.22, spike: 1.0, tw: 1.15 },
    white:     { name: 'White star', core: [255, 255, 255], mid: [226, 236, 255], halo: [168, 196, 255], s: 1.06, spike: 0.9, tw: 1.0 },
    green:     { name: 'Green star', core: [238, 255, 236], mid: [160, 246, 172], halo: [70, 220, 136], s: 1.0, spike: 0.5, tw: 1.0 },
    purple:    { name: 'Neutron star', core: [252, 244, 255], mid: [206, 160, 255], halo: [140, 94, 255], s: 0.9, spike: 0.7, tw: 1.0, pulsar: true },
    blackhole: { name: 'Black hole', core: [30, 14, 52], mid: [255, 150, 70], halo: [150, 84, 255], s: 1.15, spike: 0, tw: 0.5, bh: true },
    unknown:   { name: 'Unknown star', core: [236, 242, 255], mid: [176, 194, 238], halo: [116, 144, 226], s: 0.85, spike: 0, tw: 1.0 },
  };
  const KIND_ORDER = ['yellow', 'red', 'green', 'blue', 'white', 'purple'];

  // planet type -> environment class (hostile red-ish / standard greens / terran bright / gaia); a race table can be injected with opts.envOf
  const ENV = [
    { id: 'none', name: 'No planet', sub: '', col: '#6e7ba6' },
    { id: 'severe', name: 'Hostile', sub: 'radiated · toxic · inferno', col: '#ff4d63' },
    { id: 'hostile', name: 'Hostile', sub: 'dead · tundra · barren', col: '#ff8f4a' },
    { id: 'marginal', name: 'Standard', sub: 'minimal · desert · steppe · arid', col: '#c6d94e' },
    { id: 'standard', name: 'Standard', sub: 'ocean · jungle', col: '#4fd67e' },
    { id: 'terran', name: 'Terran', sub: '', col: '#a6ffc2' },
    { id: 'gaia', name: 'Gaia', sub: '', col: '#38e6d2' },
  ];
  const ENV_OF_TYPE = { none: 0, radiated: 1, toxic: 1, inferno: 1, dead: 2, tundra: 2, barren: 2, minimal: 3, desert: 3, steppe: 3, arid: 3, ocean: 4, jungle: 4, terran: 5, gaia: 6 };
  // planet.special doubles as the mineral class
  const MINERALS = [
    { id: 'ultrapoor', name: 'Ultra poor', col: '#5b69a8' },
    { id: 'poor', name: 'Poor', col: '#8e9484' },
    { id: 'normal', name: 'Normal', col: '#d8b45a' },
    { id: 'rich', name: 'Rich', col: '#ff9a2e' },
    { id: 'ultrarich', name: 'Ultra rich', col: '#fff6d2' },
    { id: 'artifacts', name: 'Ancient artifacts', col: '#b78cff' },
    { id: 'orion', name: 'Orion', col: '#ff6fae' },
  ];
  const MIN_INDEX = { ultrapoor: 0, poor: 1, normal: 2, rich: 3, ultrarich: 4, artifacts: 5, orion: 6 };
  const TYPE_NAME = { none: 'No planet', radiated: 'Radiated', toxic: 'Toxic', inferno: 'Inferno', dead: 'Dead', tundra: 'Tundra', barren: 'Barren', minimal: 'Minimal', desert: 'Desert',
    steppe: 'Steppe', arid: 'Arid', ocean: 'Ocean', jungle: 'Jungle', terran: 'Terran', gaia: 'Gaia' };
  const TYPE_LETTER = { gaia: 'G', terran: 'T', ocean: 'O', jungle: 'J', arid: 'A', steppe: 'S', desert: 'D', minimal: 'M', tundra: 'U', barren: 'B', dead: 'X', inferno: 'I', toxic: 'Y', radiated: 'R' };
  const FLEET_KIND = { war: 'Warfleet', colony: 'Colony ship', transport: 'Transports', scout: 'Scout', mixed: 'Task force' };

  const envClassOf = p => { const c = p ? ENV_OF_TYPE[p.type] : undefined; return c === undefined ? 0 : c; };
  const mineralClassOf = p => { const c = p ? MIN_INDEX[p.special] : undefined; return c === undefined ? 2 : c; };

  // ================================================================== sprite factory (cached; sizes picked by level of detail)
  const SPR = { halo: {}, core: {}, spike: {}, glow: {}, planet: {}, label: new Map(), bh: null, bhSwirl: null, beam: null, trail: null };
  const LODS = [12, 24, 48, 96, 192];
  const lodFor = px => { for (let i = 0; i < LODS.length; i++) if (px <= LODS[i] * 1.2) return LODS[i]; return LODS[LODS.length - 1]; };

  // soft glow around a star: analytic falloff (+ dither so the long gradients never band)
  function haloSprite(kind) {
    if (SPR.halo[kind]) return SPR.halo[kind];
    const d = KINDS[kind] || KINDS.unknown, S = 128, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), px = img.data, half = S / 2, rnd = rng32(hashInt(kind.length * 31 + 7));
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, r = Math.sqrt(dx * dx + dy * dy), i = (y * S + x) * 4;
      if (r >= 1) { px[i + 3] = 0; continue; }
      const edge = 1 - sstep(0.62, 1, r);
      let a = (0.82 * Math.pow(1 - r, 3.3) + 0.26 * Math.exp(-r * 8.5)) * edge;
      a = clamp(a + (rnd() - 0.5) * 0.012, 0, 1);
      const t = sstep(0, 0.55, r), col = mixc(d.mid, d.halo, t);
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0); return (SPR.halo[kind] = c);
  }
  // bright stellar disc with a white-hot centre; chosen by level of detail so downscaling never aliases
  function coreSprite(kind, px) {
    const lod = lodFor(px), key = kind + ':' + lod;
    if (SPR.core[key]) return SPR.core[key];
    const d = KINDS[kind] || KINDS.unknown, S = lod, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), p = img.data, half = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, r = Math.sqrt(dx * dx + dy * dy), i = (y * S + x) * 4;
      if (r >= 1.02) { p[i + 3] = 0; continue; }
      const edge = 1 - sstep(0.80, 1.0, r);
      const col = mixc(d.core, d.mid, sstep(0.05, 0.92, r)), shade = 1 - 0.12 * r * r;
      p[i] = col[0] * shade; p[i + 1] = col[1] * shade; p[i + 2] = col[2] * shade; p[i + 3] = edge * 255;
    }
    g.putImageData(img, 0, 0); return (SPR.core[key] = c);
  }
  // 4-point diffraction cross (+ faint diagonals); drawn additively, scaled by star size
  function spikeSprite(kind) {
    if (SPR.spike[kind]) return SPR.spike[kind];
    const d = KINDS[kind] || KINDS.unknown, S = 256, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), p = img.data, half = S / 2;
    const col = mixc(d.mid, [255, 255, 255], 0.45);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, i = (y * S + x) * 4;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      let a = Math.exp(-ax * 5.2) * Math.exp(-Math.pow(ay / 0.016, 2)) + Math.exp(-ay * 5.2) * Math.exp(-Math.pow(ax / 0.016, 2));
      const ux = (dx + dy) * 0.7071, uy = (dx - dy) * 0.7071;
      a += 0.28 * (Math.exp(-Math.abs(ux) * 9) * Math.exp(-Math.pow(uy / 0.02, 2)) + Math.exp(-Math.abs(uy) * 9) * Math.exp(-Math.pow(ux / 0.02, 2)));
      a *= 1 - sstep(0.7, 1, Math.sqrt(dx * dx + dy * dy));
      p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(img, 0, 0); return (SPR.spike[kind] = c);
  }
  // neutron-star lighthouse beam: a thin double-ended streak through the centre (rotated per frame)
  function beamSprite() {
    if (SPR.beam) return SPR.beam;
    const W = 256, H = 32, c = mk(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), p = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.abs((x + 0.5 - W / 2) / (W / 2)), dy = (y + 0.5 - H / 2) / (H / 2), i = (y * W + x) * 4;
      const a = Math.exp(-dx * 3.4) * Math.exp(-Math.pow(dy / (0.1 + 0.18 * dx), 2)) * (1 - sstep(0.8, 1, dx));
      p[i] = 214; p[i + 1] = 190; p[i + 2] = 255; p[i + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(img, 0, 0); return (SPR.beam = c);
  }
  // black hole: event horizon + lensed photon ring + tilted accretion disc (source-over; the disc swirl is a second additive sprite)
  function bhSprite() {
    if (SPR.bh) return SPR.bh;
    const S = 192, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), p = img.data, half = S / 2, tilt = -0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, i = (y * S + x) * 4, r = Math.sqrt(dx * dx + dy * dy);
      const rx = dx * ct + dy * st, ry = (-dx * st + dy * ct) / 0.30, rho = Math.sqrt(rx * rx + ry * ry);
      let a = 0, R = 0, G = 0, B = 0;
      let disc = sstep(0.27, 0.36, rho) * (1 - sstep(0.4, 0.98, rho)); disc = Math.pow(disc, 0.8);
      const dopp = 0.65 + 0.55 * (rx / (rho + 0.001));
      const hot = 1 - sstep(0.3, 0.8, rho), dc = mixc([150, 84, 255], [255, 205, 130], hot);
      const front = ry > 0 || rho > 0.48 ? 1 : 0.55;
      const da = clamp(disc * dopp * front * 1.15, 0, 1);
      R = dc[0]; G = dc[1]; B = dc[2]; a = da;
      const ring = Math.exp(-Math.pow((r - 0.205) / 0.022, 2)) * (0.8 + 0.2 * dopp);
      if (ring > 0.01) { const nA = clamp(a + ring * (1 - a), 0, 1); R = (R * a + 215 * ring * (1 - a)) / (nA || 1); G = (G * a + 235 * ring * (1 - a)) / (nA || 1); B = (B * a + 255 * ring * (1 - a)) / (nA || 1); a = nA; }
      const hz = 1 - sstep(0.17, 0.205, r);
      if (hz > 0) { R *= (1 - hz); G *= (1 - hz); B *= (1 - hz); a = a + (1 - a) * hz; }
      p[i] = R; p[i + 1] = G; p[i + 2] = B; p[i + 3] = a * 255 * (1 - sstep(0.93, 1, r));
    }
    g.putImageData(img, 0, 0); return (SPR.bh = c);
  }
  function bhSwirlSprite() {
    if (SPR.bhSwirl) return SPR.bhSwirl;
    const S = 128, c = mk(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), p = img.data, half = S / 2;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - half) / half, dy = (y + 0.5 - half) / half, r = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx), i = (y * S + x) * 4;
      const arm = 0.5 + 0.5 * Math.cos(2 * th - 7.5 * Math.log(r + 0.05));
      const a = Math.pow(arm, 3) * sstep(0.3, 0.45, r) * (1 - sstep(0.55, 0.98, r)) * 0.55;
      const col = mixc([255, 190, 120], [170, 110, 255], sstep(0.3, 0.95, r));
      p[i] = col[0]; p[i + 1] = col[1]; p[i + 2] = col[2]; p[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0); return (SPR.bhSwirl = c);
  }
  // soft round glow in an arbitrary colour (fleet halos, pulses, dots)
  function glowSprite(col, key) {
    key = key || ('c' + (col[0] | 0) + ',' + (col[1] | 0) + ',' + (col[2] | 0));
    if (SPR.glow[key]) return SPR.glow[key];
    const S = 64, c = mk(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(0.18, rgba(col, 0.6)); gr.addColorStop(0.45, rgba(col, 0.2)); gr.addColorStop(0.75, rgba(col, 0.05)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, S, S); return (SPR.glow[key] = c);
  }
  // engine-trail streak (points left; rotate it to the heading)
  function trailSprite() {
    if (SPR.trail) return SPR.trail;
    const c = mk(64, 16), g = c.getContext('2d'), gr = g.createLinearGradient(64, 0, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    const vg = g.createLinearGradient(0, 0, 0, 16); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(0.5, 'rgba(255,255,255,1)'); vg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 16); g.globalCompositeOperation = 'destination-in'; g.fillStyle = vg; g.fillRect(0, 0, 64, 16);
    return (SPR.trail = c);
  }

  // ------------------------------------------------------------------ planets (close-up view at high zoom)
  const PLANET_PAL = {
    terran:   { a: '#2d6fc4', b: '#173f86', c: '#4fae5c', f: 'cont', atm: '#7fc4ff', cloud: 0.35 },
    gaia:     { a: '#2fbf9a', b: '#157a68', c: '#9be36a', f: 'cont', atm: '#9ff3d8', cloud: 0.4 },
    ocean:    { a: '#2a66d6', b: '#143a8e', c: '#4a9ae6', f: 'swirl', atm: '#7fb4ff', cloud: 0.45 },
    jungle:   { a: '#2e9a4a', b: '#175a2c', c: '#66cc6a', f: 'cont', atm: '#9be39a', cloud: 0.3 },
    arid:     { a: '#c8985a', b: '#80542a', c: '#e4c486', f: 'cont', atm: '#ffd9a0', cloud: 0.1 },
    steppe:   { a: '#a9b45e', b: '#646e30', c: '#d2da90', f: 'cont', atm: '#e0e8a0', cloud: 0.15 },
    desert:   { a: '#e0b868', b: '#9a7030', c: '#f4dca0', f: 'dunes', atm: '#ffe0a0', cloud: 0.05 },
    minimal:  { a: '#9a8a7c', b: '#5a4e48', c: '#bcae9e', f: 'crater', atm: '#c8b8a8', cloud: 0.1 },
    tundra:   { a: '#b4cce0', b: '#6f8eac', c: '#f0f8ff', f: 'cont', atm: '#dff0ff', cloud: 0.25 },
    barren:   { a: '#8e8e96', b: '#4c4c56', c: '#b8b8c0', f: 'crater', atm: null },
    dead:     { a: '#6e6862', b: '#3a3632', c: '#8e8880', f: 'crater', atm: null },
    inferno:  { a: '#e65a2a', b: '#7a1e0e', c: '#ffb84a', f: 'lava', atm: '#ff8a50' },
    toxic:    { a: '#a8c63c', b: '#5e7618', c: '#dcf470', f: 'swirl', atm: '#d0f060', cloud: 0.4 },
    radiated: { a: '#c4ea5c', b: '#6e9020', c: '#f4ffa0', f: 'crater', atm: '#e0ff80' },
  };
  function makePlanetSprite(type, S, variant) {
    const pal = PLANET_PAL[type] || PLANET_PAL.barren, c = mk(S, S), g = c.getContext('2d');
    const R = S / 2 - 1, cx = S / 2, cy = S / 2, rnd = rng32(hashInt(type.length * 977 + type.charCodeAt(0) * 131 + variant * 7919 + S));
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    const gr0 = g.createLinearGradient(0, cy - R, 0, cy + R); gr0.addColorStop(0, pal.a); gr0.addColorStop(1, pal.b); g.fillStyle = gr0; g.fillRect(0, 0, S, S);
    const feat = pal.f, fc = hex(pal.c);
    if (feat === 'cont') {
      g.fillStyle = rgba(fc, 0.85);
      for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * S * 0.9, cy + (rnd() - 0.5) * S * 0.9, S * (0.1 + rnd() * 0.16), S * (0.06 + rnd() * 0.12), rnd() * PI, 0, TAU); g.fill(); }
    } else if (feat === 'swirl') {
      g.lineWidth = Math.max(1, S * 0.06); g.strokeStyle = rgba(fc, 0.5); g.lineCap = 'round';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + (rnd() - 0.5) * S * 0.6, cy + (rnd() - 0.5) * S * 0.9, S * (0.25 + rnd() * 0.4), rnd() * TAU, rnd() * TAU + 1.6); g.stroke(); }
    } else if (feat === 'dunes') {
      g.lineWidth = Math.max(1, S * 0.07); g.strokeStyle = rgba(fc, 0.55);
      for (let i = 0; i < 6; i++) { const y = S * (0.12 + i * 0.15 + rnd() * 0.05); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(S * 0.3, y - S * 0.1, S * 0.6, y + S * 0.12, S, y - S * 0.02); g.stroke(); }
    } else if (feat === 'crater') {
      for (let i = 0; i < 9 + S / 12; i++) {
        const x = cx + (rnd() - 0.5) * S * 0.95, y = cy + (rnd() - 0.5) * S * 0.95, r = S * (0.03 + rnd() * 0.07);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.strokeStyle = rgba(fc, 0.35); g.lineWidth = Math.max(0.6, r * 0.28); g.beginPath(); g.arc(x - r * 0.1, y - r * 0.1, r, PI * 0.9, PI * 1.9); g.stroke();
      }
    } else if (feat === 'lava') {
      g.strokeStyle = rgba(fc, 0.9); g.lineWidth = Math.max(1, S * 0.035); g.lineCap = 'round';
      for (let i = 0; i < 9; i++) { g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * S * 0.4; y += (rnd() - 0.5) * S * 0.4; g.lineTo(x, y); } g.stroke(); }
    }
    if (pal.cloud) {
      g.fillStyle = 'rgba(255,255,255,' + (pal.cloud * 0.55) + ')';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * S * 0.9, cy + (rnd() - 0.5) * S * 0.9, S * (0.12 + rnd() * 0.18), S * (0.025 + rnd() * 0.04), (rnd() - 0.5) * 0.7, 0, TAU); g.fill(); }
    }
    // lighting: lit from the upper left, terminator darkens to the lower right
    const lg = g.createRadialGradient(cx - R * 0.42, cy - R * 0.46, R * 0.08, cx - R * 0.1, cy - R * 0.1, R * 1.25);
    lg.addColorStop(0, 'rgba(255,255,255,0.34)'); lg.addColorStop(0.35, 'rgba(255,255,255,0.02)'); lg.addColorStop(0.7, 'rgba(0,0,12,0.42)'); lg.addColorStop(1, 'rgba(0,0,12,0.84)');
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
    g.restore();
    if (pal.atm) {
      const ac = hex(pal.atm), ag = g.createRadialGradient(cx, cy, R * 0.84, cx, cy, R * 1.04);
      ag.addColorStop(0, rgba(ac, 0)); ag.addColorStop(0.7, rgba(ac, 0.28)); ag.addColorStop(1, rgba(ac, 0));
      g.fillStyle = ag; g.beginPath(); g.arc(cx, cy, R * 1.04, 0, TAU); g.fill();
    }
    return c;
  }
  function planetSprite(type, px, variant) {
    const lod = px <= 28 ? 24 : px <= 56 ? 48 : 96, key = type + ':' + lod + ':' + variant;
    return SPR.planet[key] || (SPR.planet[key] = makePlanetSprite(type, lod, variant));
  }

  // ================================================================== vector marks
  function pathDiamond(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); }
  function pathStar4(g, x, y, r, k) {          // pointed 4-star (capital / artifact mark)
    const q = r * (k || 0.32); g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x + q, y - q); g.lineTo(x + r, y); g.lineTo(x + q, y + q); g.lineTo(x, y + r); g.lineTo(x - q, y + q); g.lineTo(x - r, y); g.lineTo(x - q, y - q); g.closePath();
  }
  // swallow-tail banner on a pole (the owner flag); (x,y) = foot of the pole
  function drawFlag(g, x, y, hgt, col, capital, t, ph, a) {
    const w = hgt * 0.78, wv = Math.sin(t * 3.1 + ph) * hgt * 0.05, ty = y - hgt;
    g.globalAlpha = a;
    g.lineWidth = Math.max(1, hgt * 0.07); g.strokeStyle = 'rgba(4,6,20,0.85)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, ty - 1); g.stroke();
    g.lineWidth = Math.max(0.8, hgt * 0.045); g.strokeStyle = capital ? '#ffe9a8' : '#e8e2cf'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, ty - 1); g.stroke();
    g.beginPath();
    g.moveTo(x, ty); g.lineTo(x + w, ty + hgt * 0.07 + wv); g.lineTo(x + w * 0.74, ty + hgt * 0.24); g.lineTo(x + w, ty + hgt * 0.4 - wv); g.lineTo(x, ty + hgt * 0.46); g.closePath();
    g.fillStyle = rgba(col, 0.96); g.fill();
    g.lineWidth = 1; g.strokeStyle = 'rgba(4,6,20,0.8)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + w, ty + hgt * 0.07 + wv); g.lineTo(x + w * 0.9, ty + hgt * 0.14 + wv * 0.8); g.lineTo(x, ty + hgt * 0.17); g.closePath(); g.fill();
    if (capital) { g.fillStyle = '#ffd86a'; pathStar4(g, x, ty - hgt * 0.1, hgt * 0.17, 0.4); g.fill(); }
    g.globalAlpha = 1;
  }
  // the Orion guardian: a slit-pupil eye in a lens-shaped lid (violet-rose glow)
  function drawGuardianEye(g, x, y, s, t) {
    const open = 0.78 + 0.22 * Math.sin(t * 0.9), pulse = 0.6 + 0.4 * Math.sin(t * 2.1);
    const gg = glowSprite([255, 90, 170], 'guard');
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + 0.3 * pulse; g.drawImage(gg, x - s * 1.7, y - s * 1.7, s * 3.4, s * 3.4); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x, y - s * 0.95 * open, x + s, y); g.quadraticCurveTo(x, y + s * 0.95 * open, x - s, y); g.closePath();
    g.fillStyle = 'rgba(18,6,30,0.92)'; g.fill(); g.lineWidth = Math.max(1, s * 0.13); g.strokeStyle = '#ff7fc0'; g.stroke();
    const ir = s * 0.5 * open + s * 0.12, ig = g.createRadialGradient(x, y, 0, x, y, ir);
    ig.addColorStop(0, '#fff2a0'); ig.addColorStop(0.6, '#ff9a4a'); ig.addColorStop(1, '#c0245a');
    g.save(); g.clip(); g.fillStyle = ig; g.beginPath(); g.arc(x, y, ir, 0, TAU); g.fill();
    g.fillStyle = '#12041c'; g.beginPath(); g.ellipse(x, y, ir * 0.2, ir * 0.95, 0, 0, TAU); g.fill(); g.restore();
  }

  // ------------------------------------------------------------------ text labels, rendered once into small sprites (halo'd, DPR-crisp)
  function labelSprite(text, px, tone, dpr, fontFam) {
    const key = tone + '|' + px + '|' + dpr + '|' + text;
    let e = SPR.label.get(key); if (e) return e;
    if (SPR.label.size > 700) SPR.label.clear();
    const g0 = labelSprite.g || (labelSprite.g = mk(4, 4).getContext('2d'));
    const font = px + 'px ' + fontFam;
    g0.font = font; const tw = Math.ceil(g0.measureText(text).width) + 2, pad = 4, w = tw + pad * 2, h = Math.ceil(px * 1.5) + 4;
    const c = mk(w * dpr, h * dpr), g = c.getContext('2d'); g.scale(dpr, dpr);
    g.font = font; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
    if ('letterSpacing' in g) g.letterSpacing = (px * 0.045).toFixed(2) + 'px';
    const by = Math.round(h * 0.5 + px * 0.32);
    g.lineWidth = Math.max(2.4, px * 0.3); g.strokeStyle = 'rgba(3,5,18,0.9)'; g.strokeText(text, pad, by);
    g.fillStyle = tone; g.fillText(text, pad, by);
    e = { c, w, h, by }; SPR.label.set(key, e); return e;
  }

  // ================================================================== procedural backdrop — fallback when Gfx.Space is absent
  function makeNoise(seed) {
    const N = 256, lat = new Float32Array(N * N), r = rng32(seed);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const at = (x, y) => lat[((y & 255) << 8) | (x & 255)];
    function noise(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    function fbm(x, y, oct) {
      let s = 0, a = 0.5, f = 1, n = 0;
      for (let o = 0; o < oct; o++) { s += a * noise(x * f + o * 17.3, y * f + o * 9.1); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { noise, fbm };
  }
  // ambient additive cloud texture (opaque RGB drawn with 'lighter'); o: {scale, warp, t0, t1, gain, wisp, lens, colors:[rgb,rgb,rgb]}
  function buildAmbientNebula(w, h, seed, o) {
    const nz = makeNoise(seed), c = mk(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data, rnd = rng32(seed ^ 0x9e3779b9);
    const A = o.colors[0], B = o.colors[1], C = o.colors[2], asp = h / w;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w, sx = u * o.scale, sy = v * o.scale * asp;
        const qx = nz.fbm(sx + 1.7, sy + 9.2, 3), qy = nz.fbm(sx + 8.3, sy + 2.8, 3);
        const n = nz.fbm(sx + o.warp * (qx - 0.5) * 2 + 3.1, sy + o.warp * (qy - 0.5) * 2 + 5.7, 5);
        const dens = sstep(o.t0, o.t1, n);
        const mm = sstep(0.3, 0.7, nz.fbm(u * 1.9 + 40, v * 1.9 * asp + 12, 3));
        const rg = 1 - Math.abs(nz.fbm(sx * 1.8 + 50, sy * 1.8 + 20, 4) * 2 - 1);
        const wisp = Math.pow(rg, 5) * o.wisp * sstep(0.32, 0.72, n);
        let lens = 1;
        if (o.lens) { const dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, rr = Math.sqrt(dx * dx + dy * dy); lens = 0.3 + 0.7 * (1 - sstep(0.3, 1.0, rr)); }
        const k = dens * o.gain * lens, kw = wisp * lens, i = (y * w + x) * 4, dith = (rnd() - 0.5) * 1.4;
        d[i] = lerp(A[0], B[0], mm) * k + C[0] * kw + dith; d[i + 1] = lerp(A[1], B[1], mm) * k + C[1] * kw + dith; d[i + 2] = lerp(A[2], B[2], mm) * k + C[2] * kw + dith; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0); return c;
  }
  // gameplay nebula (S.nebulae[i].rects, map units): ragged soft union of the rectangles, rendered as a purple additive cloud
  function buildGameNebula(rects, seed) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rects) { x0 = Math.min(x0, r[0]); y0 = Math.min(y0, r[1]); x1 = Math.max(x1, r[2]); y1 = Math.max(y1, r[3]); }
    const pad = 26; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const ppu = clamp(2.6, 1, 4), W = Math.ceil((x1 - x0) * ppu), H = Math.ceil((y1 - y0) * ppu);
    const nz = makeNoise(seed), c = mk(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, rnd = rng32(seed ^ 0x51ed270b);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = x0 + x / ppu, wy = y0 + y / ppu, nx = wx * 0.045, ny = wy * 0.045;
      const warp = nz.fbm(nx + 3.3, ny + 7.1, 3), n1 = nz.fbm(nx * 1.0 + warp * 1.6, ny * 1.0 + warp * 1.2, 5), n2 = nz.fbm(nx * 2.4 + 11.5, ny * 2.4 + 4.2, 4);
      let best = -1e9;
      for (const r of rects) { const ins = Math.min(wx - r[0], r[2] - wx, wy - r[1], r[3] - wy); if (ins > best) best = ins; }
      const a = sstep(-13, 13, best + (n1 - 0.5) * 34), i = (y * W + x) * 4;
      const cloud = 0.42 + 1.05 * n2 * (0.55 + 0.9 * n1), rim = Math.exp(-Math.pow((a - 0.42) / 0.16, 2)) * 0.5;
      const k = a * cloud + rim * 0.5 * a, wisp = Math.pow(1 - Math.abs(nz.fbm(nx * 3.1 + 21, ny * 3.1 + 9, 4) * 2 - 1), 3) * a * 0.26, hue = sstep(0.25, 0.75, n1), dith = (rnd() - 0.5) * 1.3;
      d[i] = (lerp(70, 128, hue) * k + 205 * wisp) * 0.5 + dith; d[i + 1] = (lerp(34, 52, hue) * k + 140 * wisp) * 0.5 + dith; d[i + 2] = (lerp(128, 176, hue) * k + 255 * wisp) * 0.5 + dith; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  // tileable star dots (wrap-safe)
  function buildStarTile(size, scale, count, seed, big) {
    const c = mk(size * scale, size * scale), g = c.getContext('2d'), r = rng32(seed);
    g.scale(scale, scale);
    for (let i = 0; i < count; i++) {
      const x = r() * size, y = r() * size, b = Math.pow(r(), 2.4), tint = r();
      const col = tint < 0.6 ? [196, 212, 255] : tint < 0.86 ? [255, 240, 214] : [255, 200, 186], rad = 0.32 + b * (big ? 1.3 : 0.62);
      g.fillStyle = rgba(col, 0.16 + b * 0.78);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const px = x + ox * size, py = y + oy * size; if (px < -3 || py < -3 || px > size + 3 || py > size + 3) continue;
        g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
      }
      if (big && b > 0.82) { const gg = glowSprite(col, 'tile' + (tint < 0.6 ? 0 : tint < 0.86 ? 1 : 2)); g.globalAlpha = 0.5; g.drawImage(gg, x - 5, y - 5, 10, 10); g.globalAlpha = 1; }
    }
    return c;
  }

  // ================================================================== territory field (merged empire glow, rendered in world space)
  // empires: [{rgb, range (map units), pts:[x0,y0,x1,y1,...]}]  -> {canvas, x0, y0, w, h} (world rect covered) or null
  function buildTerritory(gw, gh, empires, strength) {
    let maxR = 0, any = false;
    for (const e of empires) { if (e.pts.length) any = true; maxR = Math.max(maxR, e.range); }
    if (!any) return null;
    const pad = maxR + 6, wx0 = -pad, wy0 = -pad, ww = gw + pad * 2, wh = gh + pad * 2;
    const ppu = clamp(880 / Math.max(ww, wh), 1, 8), W = Math.ceil(ww * ppu), H = Math.ceil(wh * ppu), N = W * H;
    const pot = empires.map(() => new Float32Array(N));
    empires.forEach((e, k) => {
      const f = pot[k], R = e.range * 0.92 * ppu, R2 = R * R, ir = Math.ceil(R);
      for (let q = 0; q < e.pts.length; q += 2) {
        const cx = (e.pts[q] - wx0) * ppu, cy = (e.pts[q + 1] - wy0) * ppu;
        const x0 = Math.max(0, Math.floor(cx - ir)), x1 = Math.min(W - 1, Math.ceil(cx + ir)), y0 = Math.max(0, Math.floor(cy - ir)), y1 = Math.min(H - 1, Math.ceil(cy + ir));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy; if (d2 >= R2) continue;
          const u = 1 - Math.sqrt(d2) / R; f[y * W + x] += u * u * (0.55 + 0.45 * u);
        }
      }
    });
    const c = mk(W, H), g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, ne = empires.length;
    for (let i = 0; i < N; i++) {
      let b = -1, v1 = 0, v2 = 0;
      for (let k = 0; k < ne; k++) { const v = pot[k][i]; if (v > v1) { v2 = v1; v1 = v; b = k; } else if (v > v2) v2 = v; }
      if (b < 0 || v1 < 0.004) continue;
      const u = 1 - Math.exp(-1.7 * v1);
      const edge = Math.exp(-Math.pow((u - 0.27) / 0.05, 2));
      let a = (0.17 * sstep(0.04, 0.5, u) + 0.07 * sstep(0.55, 0.95, u) + 0.3 * edge) * strength;
      const cont = v2 / v1; if (cont > 0.5) a *= 1 - 0.55 * sstep(0.5, 0.95, cont);
      if (a < 0.002) continue;
      const col = empires[b].rgb, j = i * 4, br = 1 + 0.35 * edge;
      d[j] = Math.min(255, col[0] * br); d[j + 1] = Math.min(255, col[1] * br); d[j + 2] = Math.min(255, col[2] * br); d[j + 3] = clamp(a, 0, 1) * 255;
    }
    g.putImageData(img, 0, 0);
    return { canvas: c, x0: wx0, y0: wy0, w: ww, h: wh };
  }

  // ================================================================== quality (read from MOO.Perf every frame; no allocation)
  const Q = { glow: 1, nebula: 1, part: 1, fps: 60, dpr: 2, reduce: false, twinkle: true, parallax: 2, spikes: true, sparkles: 56, flow: true, layers: 2, inertia: true };
  function readQuality() {
    const P = M.Perf, q = P && P.q;
    Q.glow = q ? q.glow : 1; Q.nebula = q ? q.nebula : 1; Q.part = q ? q.particles : 1; Q.fps = q ? q.animFps : 60; Q.dpr = q ? q.dpr : 2;
    Q.reduce = !!(M.Settings && M.Settings.get('reduceMotion'));
    Q.twinkle = !Q.reduce && Q.glow >= 0.75;
    Q.parallax = Q.reduce ? 0 : Q.glow >= 0.95 ? 2 : Q.glow >= 0.75 ? 1 : 0;
    Q.spikes = Q.glow >= 0.75;
    Q.sparkles = (Q.reduce || Q.glow < 0.75) ? 0 : Math.round(52 * Math.min(1.6, Q.part));
    Q.flow = !Q.reduce && Q.fps >= 45;
    Q.layers = Q.nebula >= 0.7 ? 2 : 1;
    Q.inertia = !Q.reduce;
  }

  // ================================================================== component styles
  const SPACING = 30;          // typical star-to-star distance in map units: on-screen sizes scale with zoom * SPACING
  const GRID_STEPS = [{ M: 1, m: 0.25 }, { M: 2, m: 0.5 }, { M: 5, m: 1 }, { M: 10, m: 2 }, { M: 20, m: 5 }, { M: 50, m: 10 }];
  const MODES = ['normal', 'colonies', 'environments', 'minerals'];
  let cssDone = false;
  function ensureCss() {
    if (cssDone) return; cssDone = true;
    const css = `
    .gmap { position:relative; width:100%; height:100%; overflow:hidden; background:#04061a; outline:none; touch-action:none; user-select:none; -webkit-user-select:none; }
    .gmap-cv { position:absolute; inset:0; width:100%; height:100%; cursor:grab; }
    .gmap.dragging .gmap-cv { cursor:grabbing; } .gmap.hot .gmap-cv { cursor:pointer; } .gmap.route .gmap-cv { cursor:crosshair; }
    .gmap-ctrl { position:absolute; right:.75rem; top:1.9rem; display:flex; flex-direction:column; gap:.3rem; z-index:3; }
    .gmap-btn { --ch:.3rem; position:relative; isolation:isolate; width:2rem; height:2rem; padding:0; border:0; cursor:pointer; color:var(--brass-hi); display:grid; place-items:center;
      background:linear-gradient(180deg,var(--brass),var(--brass-lo)); transition:filter .15s; }
    .gmap-btn::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg,#27336d,#161e4a); transition:background .15s; }
    .gmap-btn:hover { filter:brightness(1.15); } .gmap-btn:hover::before { background:linear-gradient(180deg,#34448c,#1c2760); } .gmap-btn:active { transform:translateY(1px); }
    .gmap-btn svg { width:1.05rem; height:1.05rem; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:square; stroke-linejoin:miter; }
    .gmap-mini { --ch:.55rem; position:absolute; z-index:3; padding:1px; background:linear-gradient(135deg,var(--brass),var(--brass-lo) 50%,var(--brass)); }
    .gmap-mini canvas { display:block; clip-path:var(--poly); background:rgba(5,8,24,.88); cursor:crosshair; }
    .gmap .gmap-legend.panel { position:absolute; left:.75rem; bottom:2.7rem; z-index:3; width:16rem; max-height:70%; overflow:hidden; transition:opacity .25s; }
    .gmap .gmap-legend.off { opacity:0; pointer-events:none; }
    .gmap-legend .gl-h { display:flex; align-items:baseline; justify-content:space-between; gap:.5rem; padding-bottom:.3rem; margin-bottom:.35rem; border-bottom:1px solid rgba(214,179,106,.28);
      font:400 1.02rem var(--font-display); color:var(--brass-hi); letter-spacing:.04em; }
    .gmap-legend .gl-h small { font:400 .74rem var(--font-ui); color:var(--mist); letter-spacing:0; }
    .gmap-legend .gl-row { display:flex; align-items:center; gap:.55rem; padding:.1rem 0; font-size:.86rem; color:var(--ivory); line-height:1.15; }
    .gmap-legend .gl-row.dim { opacity:.45; }
    .gmap-legend .gl-sw { flex:none; width:.78rem; height:.78rem; background:var(--c); box-shadow:0 0 7px var(--c); transform:rotate(45deg) scale(.86); }
    .gmap-legend .gl-sw.dot { transform:none; border-radius:50%; width:.7rem; height:.7rem; margin:0 .04rem; }
    .gmap-legend .gl-sw.hollow { background:transparent; box-shadow:none; border:1.5px solid var(--c); }
    .gmap-legend .gl-txt { min-width:0; } .gmap-legend .gl-sub { display:block; color:var(--mist); font-size:.72rem; }
    .gmap-legend .gl-n { margin-left:auto; color:var(--mist); font-variant-numeric:tabular-nums; }
    .gmap-legend .gl-sep { height:1px; margin:.35rem 0; background:linear-gradient(90deg,transparent,rgba(214,179,106,.35),transparent); }
    .gmap-tip { --ch:.35rem; position:absolute; z-index:6; left:0; top:0; display:none; max-width:21rem; min-width:9rem; padding:.45rem .75rem .55rem; font-size:.88rem; line-height:1.38; pointer-events:none;
      color:var(--ivory); background:linear-gradient(135deg,var(--brass),var(--brass-lo)); isolation:isolate; }
    .gmap-tip::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg,#101a46,#0a1030); }
    .gmap-tip b { color:var(--brass-hi); font-weight:600; }
    .gmap-tip .gt-h { display:flex; align-items:baseline; gap:.7rem; padding-bottom:.25rem; margin-bottom:.25rem; border-bottom:1px solid rgba(214,179,106,.25); font:400 1.1rem var(--font-display); color:var(--brass-hi); letter-spacing:.03em; }
    .gmap-tip .gt-k { margin-left:auto; display:flex; align-items:center; gap:.35rem; font:400 .76rem var(--font-ui); color:var(--mist); letter-spacing:0; white-space:nowrap; }
    .gmap-tip .gt-k i { display:inline-block; width:.62em; height:.62em; border-radius:50%; background:var(--c); box-shadow:0 0 6px var(--c); }
    .gmap-tip .gt-r { margin-top:.12rem; } .gmap-tip .gt-d { color:var(--mist); } .gmap-tip .gt-w { color:var(--ember); } .gmap-tip .gt-v { color:var(--violet); }
    .gmap-tip i.sw { display:inline-block; width:.62em; height:.62em; background:var(--c); transform:rotate(45deg); margin:0 .4em 0 .1em; box-shadow:0 0 5px var(--c); }
    .gmap-hint { --ch:.4rem; position:absolute; z-index:4; left:50%; top:1.9rem; transform:translateX(-50%); display:none; padding:.4rem 1rem; font-size:.92rem; color:var(--brass-hi); pointer-events:none;
      background:linear-gradient(180deg,var(--brass),var(--brass-lo)); isolation:isolate; white-space:nowrap; }
    .gmap-hint::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg,#27336d,#161e4a); }
    .gmap-hint kbd { font:600 .74rem var(--font-ui); color:var(--mist); padding:0 .35em; border:1px solid rgba(214,179,106,.5); margin:0 .15em; }
    .gmap.route .gmap-hint { display:block; animation:gmap-pulse 1.6s ease-in-out infinite; }
    @keyframes gmap-pulse { 50% { filter:brightness(1.25); } }
    `;
    if (UI.css) UI.css('gmap', css); else { const s = doc.createElement('style'); s.id = 'css-gmap'; s.textContent = css; doc.head.appendChild(s); }
  }

  // ================================================================== the component
  function create(container, userOpts) {
    const opts = Object.assign({ minimap: 'auto', legend: true, controls: true, keys: true, hud: true, ruler: true, tooltips: true, fog: true,
      initialView: 'auto', clearOnEmptyClick: false, envOf: null, routeInfo: null, backdrop: 'auto' }, userOpts || {});
    const th = readTheme(); ensureCss();
    const h = UI.h;
    try { if (doc.fonts && doc.fonts.load) { doc.fonts.load('14px "Marcellus SC"').catch(() => {}); doc.fonts.load('14px "IBM Plex Sans Condensed"').catch(() => {}); } } catch (e) { /* optional */ }

    // ---------------------------------------------------------------- DOM
    const canvas = h('canvas.gmap-cv');
    const tipEl = h('div.gmap-tip.ch');
    const hintEl = h('div.gmap-hint.ch');
    const legendEl = h('div.gmap-legend.panel.tight');
    const miniCv = h('canvas');
    const miniEl = h('div.gmap-mini.ch', miniCv);
    const svgBtn = (path, tip, fn) => { const b = h('button.gmap-btn.ch', { type: 'button', 'aria-label': tip, onclick: e => { fn(e); root.focus({ preventScroll: true }); } }); b.innerHTML = '<svg viewBox="0 0 24 24">' + path + '</svg>'; if (UI.setTip) UI.setTip(b, tip); return b; };
    const ctrlEl = h('div.gmap-ctrl',
      svgBtn('<path d="M12 5v14M5 12h14"/>', 'Zoom in <b>+</b>', () => zoomStep(1.45)),
      svgBtn('<path d="M5 12h14"/>', 'Zoom out <b>−</b>', () => zoomStep(1 / 1.45)),
      svgBtn('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 'Show the whole galaxy', () => api.fit()),
      svgBtn('<path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="2.2"/>', 'Centre on your capital <b>Home</b>', () => api.home()));
    const root = h('div.gmap', { tabindex: 0, role: 'application', 'aria-label': 'Galaxy map' }, canvas, miniEl, ctrlEl, legendEl, hintEl, tipEl);
    if (opts.controls === false) ctrlEl.style.display = 'none';
    container.appendChild(root);

    // ---------------------------------------------------------------- state
    let S = null, me = null, destroyed = false, pcU = PC_DEFAULT, gw = 100, gh = 100, galaxyKey = '';
    let W = 0, H = 0, dpr = 1, ctx = null, uk = 1, sizeDirty = true, accDt = 0, clock = 0, lastFrameT = 0;
    let mode = 'normal', prevMode = 'normal', modeT = 1, wCol = 0, wEnv = 0, wMin = 0;
    let fog = opts.fog !== false;
    const cam = { x: 0, y: 0, z: 1 }, tgt = { x: 0, y: 0, z: 1 }, vel = { x: 0, y: 0 };
    let camSet = false, anchor = null, flight = null, fitZ = 1, minZ = 0.4, maxZ = 14, pendingView = null, pendingCmd = null, lastEmit = { x: NaN, y: NaN, z: NaN };
    let selStar = null, selFleet = null, hoverStar = null, hoverFleet = null, hoverGrp = null, hoverNeb = -1, routeFleet = null, routePrev = null, rangesSpec = null, hiSpec = null;
    let selT = 0, hoverT = 0;
    const SD = [], sdById = [], sdPool = {}; let sdSorted = [];
    const FD = new Map(), movers = [], groups = [], scanSrc = []; let groupsDirty = true, fdMark = 0;
    const pings = [];
    let terr = null, gnebs = [], nebKey = '', dirty = { terr: true, legend: true, mini: true, neb: true };
    const handlers = {};
    const view = { x0: 0, y0: 0, x1: 0, y1: 0 };
    const hitX = [], hitY = [], hitR = [], hitFd = [], hitGrp = []; let nHit = 0;
    const lblRects = []; let nLbl = 0;
    const keys = {}; let tipKey = '';
    const empCol = id => { const E = S && S.empires && S.empires[id]; const ci = E && E.color !== undefined ? E.color : id; return th.empRGB[(((ci | 0) % 6) + 6) % 6] || th.rgb.mist; };
    const empHex = id => { const E = S && S.empires && S.empires[id]; const ci = E && E.color !== undefined ? E.color : id; return th.emp[(((ci | 0) % 6) + 6) % 6] || th.mist; };
    const pidOf = () => (S && S.playerId !== undefined ? S.playerId : 0) | 0;

    function on(evt, fn) { (handlers[evt] || (handlers[evt] = [])).push(fn); return () => off(evt, fn); }
    function off(evt, fn) { const a = handlers[evt]; if (!a) return api; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); return api; }
    function emit(evt, a, b) { const l = handlers[evt]; if (!l || !l.length) return; for (const fn of l.slice()) { try { fn(a, b); } catch (e) { console.error('[GalaxyMap:' + evt + ']', e); } } }

    // ---------------------------------------------------------------- derive: per-star data (one planet per star) + territory sources
    function newSD(id) {
      const r = rng32(hashInt(id * 7919 + 13));
      return { id, st: null, pl: null, x: 0, y: 0, vis: 0, known: false, live: false, stale: false, owner: -1, mine: false, capital: false, kind: 'unknown', vkind: 'unknown', orion: false, guard: false, env: -1, min: -1, nebula: false, name: '', pri: 0,
        art: false, pop: 0, maxPop: 0, ph: r() * TAU, ph2: r() * TAU, fr: 0.8 + r() * 1.2, ang: r() * TAU,
        sx: 0, sy: 0, r: 3, on: false, glowA: 1, coreA: 1, lblA: 0, lblSlot: 0, lblX: 0, lblY: 0, pipY: 0 };
    }
    function readGalaxy() {
      const g = S.galaxy;
      if (g && g.w > 0 && g.h > 0) { gw = g.w; gh = g.h; }
      else { let mx = 10, my = 10; for (const s of S.stars || []) { mx = Math.max(mx, s.x); my = Math.max(my, s.y); } gw = mx + 12; gh = my + 12; }
      pcU = (g && g.pc) || PC_DEFAULT;
      const key = Math.round(gw) + 'x' + Math.round(gh) + ':' + ((S.stars || []).length);
      if (key !== galaxyKey) { galaxyKey = key; pendingView = opts.initialView; dirty.neb = true; amb.key = ''; }
    }
    function derive() {
      const stars = S.stars || [], planets = S.planets || [], emps = S.empires || [], pid = pidOf();
      me = emps[pid] || null;
      const visArr = fog && me && me.vis ? me.vis : null, seenMap = me && me.seen && typeof me.seen === 'object' ? me.seen : null;
      const guardianAlive = !!S.guardian && (S.guardian === true || S.guardian.alive !== false);
      SD.length = 0; sdById.length = 0;
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i], sd = sdPool[st.id] || (sdPool[st.id] = newSD(st.id));
        const pl = planets[st.planets && st.planets.length ? st.planets[0] : st.id] || null;
        sd.st = st; sd.pl = pl; sd.x = st.x; sd.y = st.y;
        const own = pl && pl.owner >= 0 ? pl.owner : -1, seen = seenMap && seenMap[st.id];
        // vis: 0 unexplored (class visible, planet unknown) | 1 explored, out of scanner range (last reported) | 2 explored and live
        let vis = visArr ? (visArr[st.id] | 0) : 2;
        if (own === pid) vis = 2;
        sd.vis = vis; sd.known = vis >= 1; sd.live = vis === 2; sd.mine = own === pid;
        sd.owner = vis === 2 ? own : vis === 1 ? (seenMap ? (seen ? (seen.owner >= 0 ? seen.owner : -1) : -1) : own) : -1; sd.stale = vis === 1 && sd.owner >= 0;
        sd.capital = sd.owner >= 0 && !!emps[sd.owner] && !!pl && emps[sd.owner].capital === pl.id;
        const kn = st.kind || st.color; sd.kind = KINDS[kn] && kn !== 'unknown' ? kn : 'unknown'; sd.vkind = sd.kind;
        sd.orion = S.orion === st.id || st.special === 'orion' || (!!pl && pl.special === 'orion');
        sd.guard = sd.orion && guardianAlive;
        sd.env = sd.known && pl ? (opts.envOf ? opts.envOf(pl, st) : envClassOf(pl)) : -1;
        sd.min = sd.known && pl ? mineralClassOf(pl) : -1;
        sd.art = sd.known && !!pl && pl.special === 'artifacts';
        sd.nebula = !!(st.inNebula || st.nebula);
        sd.pop = vis === 2 ? (pl ? pl.pop || 0 : 0) : (seen ? seen.pop || 0 : 0); sd.maxPop = sd.known && pl ? pl.maxPop || 0 : 0;
        sd.name = st.name || ('Star ' + st.id); if (sd.lblName !== sd.name) { sd.lbl = null; sd.lblName = sd.name; }
        sd.pri = (sd.orion ? 100 : 0) + (sd.capital ? 40 : 0) + (sd.mine ? 30 : sd.owner >= 0 ? 20 : 0) + (vis === 2 ? 4 : vis === 1 ? 2 : 0);
        SD.push(sd); sdById[st.id] = sd;
      }
      sdSorted = SD.slice().sort((a, b) => b.pri - a.pri || a.id - b.id);
      dirty.terr = dirty.legend = dirty.mini = true; tipKey = '';
      // nebulae (gameplay clouds): rebuild textures only if the rectangles changed
      let nk = ''; for (const nb of S.nebulae || []) for (const r of nb.rects || []) nk += r.join(',') + ';';
      if (nk !== nebKey) { nebKey = nk; dirty.neb = true; }
    }
    function rebuildTerritory() {
      dirty.terr = false; stats.nTerr = (stats.nTerr || 0) + 1;
      const emps = S.empires || [], by = {}, list = [];
      for (const sd of SD) {
        if (sd.owner < 0) continue;
        let e = by[sd.owner];
        if (!e) { const E = emps[sd.owner]; e = by[sd.owner] = { rgb: empCol(sd.owner), range: Math.max(1, (E && E.range || 3)) * pcU, pts: [] }; list.push(e); }
        e.pts.push(sd.x, sd.y);
      }
      terr = buildTerritory(gw, gh, list, 1.0);
    }
    function rebuildNebulae() {
      dirty.neb = false; stats.nNeb = (stats.nNeb || 0) + 1; gnebs = [];
      (S.nebulae || []).forEach((nb, i) => { if (nb.rects && nb.rects.length) { try { gnebs.push(buildGameNebula(nb.rects, 1000 + i * 77)); } catch (e) { console.warn('[GalaxyMap] nebula', e); } } });
    }

    // ---------------------------------------------------------------- derive: fleets
    const scanOf = () => (me ? (me.scan !== undefined ? me.scan : me.mods && me.mods.scan !== undefined ? me.mods.scan : 3) : 0);
    const idHash = id => { if (typeof id === 'number') return id; let h = 7; const t = String(id); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h & 0xffff; };
    const shipsOf = f => { if (f.n > 0 && !(f.ships && f.ships.some(v => v > 0))) return f.n; const a = f.ships; if (!a) return 1; if (a.length && typeof a[0] === 'number') { let n = 0; for (let i = 0; i < a.length; i++) n += a[i] | 0; return Math.max(1, n); } return a.length || 1; };
    function fleetSource() {                                   // the real sim already filters by what the viewer may see (and adds kind + ETA); the mock path filters here
      const Qm = M.Sim && M.Sim.Q;
      if (fog && Qm && Qm.mapFleets && me && me.explored) { try { return Qm.mapFleets(S, pidOf()); } catch (e) { console.warn('[GalaxyMap] Q.mapFleets failed', e); } }
      return S.fleets || [];
    }
    function deriveFleets(hard) {
      const fl = fleetSource(), filtered = fl !== S.fleets, pid = pidOf(), scanR = scanOf() * pcU, sr2 = scanR * scanR;
      const animSpeed = M.Settings ? M.Settings.get('animSpeed') : 1, anim = animSpeed > 0 && !Q.reduce && !hard;
      scanSrc.length = 0;
      for (const sd of SD) if (sd.mine) scanSrc.push(sd.x, sd.y);
      for (const f of fl) if (f.owner === pid) scanSrc.push(f.x, f.y);
      const mark = ++fdMark;
      for (const f of fl) {
        let fd = FD.get(f.id), isNew = false;
        if (!fd) { fd = { id: f.id, f, owner: f.owner, dx: f.x, dy: f.y, tx: f.x, ty: f.y, tw: null, a: hard ? 1 : 0, vis: true, moving: false, mark: 0, pinged: -1, ang: 0, ph: (idHash(f.id) * 0.7) % TAU, sx: 0, sy: 0, sz: 12, nsh: 1 }; FD.set(f.id, fd); isNew = true; }
        const wasMoving = fd.moving; fd.f = f; fd.mark = mark; fd.owner = f.owner; fd.nsh = shipsOf(f);
        if (!f.kind) f.kind = (M.Sim && M.Sim.Q && M.Sim.Q.fleetKind && f.ships && typeof f.ships[0] === 'number') ? M.Sim.Q.fleetKind(S, f) : 'war';
        if (f.star < 0 && f.to >= 0 && !(f.eta > 0)) { const to = S.stars[f.to]; if (to) f.eta = Math.max(1, Math.ceil(Math.hypot(to.x - f.x, to.y - f.y) / pcU / Math.max(0.5, f.speed || 1))); }
        let vis = filtered || f.owner === pid || !fog;
        if (!vis) for (let i = 0; i < scanSrc.length; i += 2) { const dx = scanSrc[i] - f.x, dy = scanSrc[i + 1] - f.y; if (dx * dx + dy * dy <= sr2) { vis = true; break; } }
        fd.vis = vis; if (isNew) fd.a = hard && vis ? 1 : 0;
        fd.moving = f.to >= 0 && !(f.star >= 0);
        if (isNew || !anim) { fd.dx = f.x; fd.dy = f.y; fd.tw = null; }
        else if (Math.abs(f.x - fd.tx) > 0.02 || Math.abs(f.y - fd.ty) > 0.02) fd.tw = { t0: clock, dur: 0.9 / animSpeed, x0: fd.dx, y0: fd.dy, x1: f.x, y1: f.y };
        fd.tx = f.x; fd.ty = f.y;
        if (f.to >= 0) { const to = sdById[f.to]; if (to) fd.ang = Math.atan2(to.y - f.y, to.x - f.x); }
        if ((f.arrived || (wasMoving && !fd.moving && f.star >= 0)) && vis && fd.pinged !== S.turn) { fd.pinged = S.turn; pings.push({ x: f.x, y: f.y, t0: clock + (fd.tw ? fd.tw.dur : 0), owner: f.owner }); }
      }
      for (const [id, fd] of FD) if (fd.mark !== mark) { FD.delete(id); if (selFleet === id) selFleet = null; }
      groupsDirty = true;
    }
    function buildGroups() {
      groupsDirty = false; groups.length = 0; movers.length = 0;
      const by = new Map(), pid = pidOf();
      for (const fd of FD.values()) {
        const f = fd.f;
        if (fd.moving || fd.tw || !(f.star >= 0)) { movers.push(fd); continue; }
        const key = f.star * 16 + (f.owner & 15);
        let g = by.get(key);
        if (!g) { g = { star: f.star, owner: f.owner, list: [], ships: 0, ang: 0, sx: 0, sy: 0, a: 1 }; by.set(key, g); groups.push(g); }
        g.list.push(fd); g.ships += fd.nsh;
      }
      const per = new Map();
      for (const g of groups) { let a = per.get(g.star); if (!a) per.set(g.star, a = []); a.push(g); }
      for (const arr of per.values()) {
        arr.sort((a, b) => ((a.owner === pid ? 0 : 1) - (b.owner === pid ? 0 : 1)) || a.owner - b.owner);
        arr.forEach((g, i) => { g.ang = -PI / 4 + i * TAU / arr.length; });
      }
    }

    // ---------------------------------------------------------------- selection helpers
    function setSelStar(id, doEmit) {
      const prevF = selFleet;
      if (id === selStar && (id === null || prevF === null)) return;
      if (id !== null && selFleet !== null) { selFleet = null; if (doEmit) emit('selectFleet', null); }
      if (id !== selStar) { selStar = id; selT = 0; if (doEmit) emit('selectStar', id); }
      else selT = 0;
    }
    function setSelFleet(id, doEmit) {
      if (id === selFleet) return;
      if (id !== null && selStar !== null) selStar = null;           // the reticle moves to the fleet; 'selectStar'(null) is never emitted (hosts keep their star selection)
      selFleet = id; selT = 0; if (doEmit) emit('selectFleet', id);
    }
    function setRouteMode(fid) {
      routeFleet = fid; root.classList.toggle('route', fid !== null);
      if (fid !== null) { const f = FD.get(fid); hintEl.innerHTML = 'Choose a destination' + (f ? ' for <b>' + esc((FLEET_KIND[f.f.kind] || 'fleet')) + ' #' + f.id + '</b>' : '') + ' &nbsp;·&nbsp; <kbd>Esc</kbd> cancel'; }
    }

    // ---------------------------------------------------------------- camera
    function computeFit() {
      const mx = 40 * uk, mt = 30 * uk, mb = 26 * uk;
      fitZ = Math.max(0.02, Math.min((W - mx * 2) / gw, (H - mt - mb) / gh));
      minZ = fitZ * 0.72; maxZ = Math.max(fitZ * 4.5, 14);
    }
    function clampTo(c) { c.z = clamp(c.z, minZ, maxZ); c.x = clamp(c.x, 0, gw); c.y = clamp(c.y, 0, gh); }
    function setCamNow(x, y, z) { camSet = true; cam.x = tgt.x = x; cam.y = tgt.y = y; cam.z = tgt.z = z; clampTo(cam); clampTo(tgt); flight = null; anchor = null; vel.x = vel.y = 0; }
    function cancelFlight() { if (flight) { tgt.x = cam.x; tgt.y = cam.y; tgt.z = cam.z; flight = null; } }
    function flyTo(x, y, z, animate, dur) {
      z = clamp(z, minZ, maxZ); x = clamp(x, 0, gw); y = clamp(y, 0, gh);
      if (!animate || Q.reduce || !W) { setCamNow(x, y, z); return; }
      const distPx = Math.hypot(x - cam.x, y - cam.y) * Math.min(cam.z, z), span = Math.hypot(W, H);
      if (distPx < 1 && Math.abs(Math.log(z / cam.z)) < 0.002) { setCamNow(x, y, z); return; }
      flight = { t: 0, dur: dur || clamp(0.5 + distPx / span * 0.45, 0.5, 1.15), x0: cam.x, y0: cam.y, z0: cam.z, x1: x, y1: y, z1: z, dip: clamp(Math.log2(1 + distPx / span * 1.6) * 0.75, 0, 1.5) };
      tgt.x = x; tgt.y = y; tgt.z = z; anchor = null; vel.x = vel.y = 0;
    }
    function updateCamera(dt) {
      if (flight) {
        flight.t += dt; const u = clamp(flight.t / flight.dur, 0, 1), s = easeIO(u);
        cam.x = lerp(flight.x0, flight.x1, s); cam.y = lerp(flight.y0, flight.y1, s);
        cam.z = Math.exp(lerp(Math.log(flight.z0), Math.log(flight.z1), s) - flight.dip * Math.sin(PI * s) * 0.693);
        if (u >= 1) { cam.x = flight.x1; cam.y = flight.y1; cam.z = flight.z1; flight = null; }
        clampTo(cam); return;
      }
      // held arrow keys: smooth panning
      const kx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), ky = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      if (kx || ky) { const sp = (keys.shift ? 1500 : 640) * dt / cam.z; tgt.x += kx * sp; tgt.y += ky * sp; anchor = null; vel.x = vel.y = 0; }
      // inertia after a drag
      if (Q.inertia && (Math.abs(vel.x) > 12 || Math.abs(vel.y) > 12) && !ptr.moved) {
        cam.x -= vel.x * dt / cam.z; cam.y -= vel.y * dt / cam.z; tgt.x = cam.x; tgt.y = cam.y; tgt.z = cam.z;
        const f = Math.exp(-dt * 5.5); vel.x *= f; vel.y *= f;
      } else if (!ptr.moved) { vel.x = vel.y = 0; }
      const k = Q.reduce ? 1 : 1 - Math.exp(-dt * 13);
      clampTo(tgt);
      const lz = Math.log(cam.z), lt = Math.log(tgt.z);
      cam.z = Math.abs(lt - lz) < 1e-4 ? tgt.z : Math.exp(lz + (lt - lz) * k);
      if (anchor) {
        cam.x = anchor.wx - (anchor.sx - W / 2) / cam.z; cam.y = anchor.wy - (anchor.sy - H / 2) / cam.z;
        tgt.x = anchor.wx - (anchor.sx - W / 2) / tgt.z; tgt.y = anchor.wy - (anchor.sy - H / 2) / tgt.z;
        if (cam.z === tgt.z) anchor = null;
      } else { cam.x += (tgt.x - cam.x) * k; cam.y += (tgt.y - cam.y) * k; if (Math.abs(tgt.x - cam.x) < 1e-3 / cam.z) cam.x = tgt.x; if (Math.abs(tgt.y - cam.y) < 1e-3 / cam.z) cam.y = tgt.y; }
      clampTo(cam);
    }
    function zoomAt(px, py, k) {
      cancelFlight(); vel.x = vel.y = 0;
      const wx = cam.x + (px - W / 2) / cam.z, wy = cam.y + (py - H / 2) / cam.z;
      tgt.z = clamp(tgt.z * k, minZ, maxZ); anchor = { wx, wy, sx: px, sy: py };
      if (Q.reduce) updateCamera(1);
    }
    function zoomStep(k) { zoomAt(W / 2, H / 2, k); }
    function applyInitialView() {
      const v = pendingView; pendingView = null;
      const cap = capitalStar();
      const mode0 = v === 'fit' ? 'fit' : v === 'capital' ? 'capital' : (SD.length > 60 && cap ? 'capital' : 'fit');
      if (mode0 === 'capital' && cap) setCamNow(cap.x, cap.y, clamp(Math.max(W / 200, fitZ * 1.4), minZ, maxZ));
      else setCamNow(gw / 2, gh / 2, fitZ);
    }
    function capitalStar() {
      if (!S || !me) return null;
      const pl = (S.planets || [])[me.capital]; if (pl && sdById[pl.starId] !== undefined) return sdById[pl.starId];
      for (const sd of SD) if (sd.mine) return sd;
      return null;
    }

    // ---------------------------------------------------------------- hit testing
    const pk = { sd: null, fd: null, grp: null };
    function pick(x, y) {
      pk.sd = null; pk.fd = null; pk.grp = null;
      let best = 1e9;
      for (let i = 0; i < nHit; i++) { const dx = hitX[i] - x, dy = hitY[i] - y, d = dx * dx + dy * dy, r = hitR[i]; if (d <= r * r && d < best) { best = d; pk.fd = hitFd[i]; pk.grp = hitGrp[i]; } }
      if (pk.fd) return pk;
      best = 1e9;
      for (let i = 0; i < SD.length; i++) {
        const s = SD[i]; if (!s.on) continue;
        const dx = s.sx - x, dy = s.sy - y, d = dx * dx + dy * dy, r = Math.max(11 * uk, s.r * 2 + 5);
        if (d <= r * r && d < best) { best = d; pk.sd = s; }
      }
      return pk;
    }
    function nebAt(wx, wy) {
      const nbs = S && S.nebulae || [];
      for (let i = 0; i < nbs.length; i++) for (const r of nbs[i].rects || []) if (wx >= r[0] && wx <= r[2] && wy >= r[1] && wy <= r[3]) return i;
      return -1;
    }

    // ---------------------------------------------------------------- input
    const ptr = { x: -1, y: -1, inside: false, down: false, id: -1, sx: 0, sy: 0, lx: 0, ly: 0, lt: 0, moved: false, btn: 0, t0: 0 };
    const pts = new Map(); let pinch = null, lastClick = { t: 0, id: -2 };
    const rectOf = () => canvas.getBoundingClientRect();
    function startPinch() { const a = Array.from(pts.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 }; ptr.moved = true; cancelFlight(); vel.x = vel.y = 0; }
    function doPinch() {
      const a = Array.from(pts.values()); if (a.length < 2) return;
      const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      cam.x -= (mx - pinch.mx) / cam.z; cam.y -= (my - pinch.my) / cam.z;
      const wx = cam.x + (mx - W / 2) / cam.z, wy = cam.y + (my - H / 2) / cam.z, nz = clamp(cam.z * d / pinch.d, minZ, maxZ);
      cam.z = nz; cam.x = wx - (mx - W / 2) / nz; cam.y = wy - (my - H / 2) / nz; clampTo(cam); tgt.x = cam.x; tgt.y = cam.y; tgt.z = cam.z; anchor = null;
      pinch.d = d; pinch.mx = mx; pinch.my = my;
    }
    canvas.addEventListener('pointerdown', e => {
      if (e.button === 2) return;
      root.focus({ preventScroll: true });
      const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      pts.set(e.pointerId, { x, y }); ptr.x = x; ptr.y = y; ptr.inside = true;
      if (pts.size === 2) { startPinch(); ptr.down = false; return; }
      ptr.down = true; ptr.id = e.pointerId; ptr.btn = e.button; ptr.sx = ptr.lx = x; ptr.sy = ptr.ly = y; ptr.moved = false; ptr.t0 = ptr.lt = e.timeStamp;
      vel.x = vel.y = 0; hideTip(); e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
      const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top;
      ptr.x = x; ptr.y = y; ptr.inside = true;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x, y });
      if (pinch) { doPinch(); return; }
      if (ptr.down && e.pointerId === ptr.id) {
        if (!ptr.moved && Math.hypot(x - ptr.sx, y - ptr.sy) > 4) { ptr.moved = true; root.classList.add('dragging'); cancelFlight(); anchor = null; hideTip(); }
        if (ptr.moved) {
          const dx = x - ptr.lx, dy = y - ptr.ly, dtm = Math.max(1, e.timeStamp - ptr.lt);
          cam.x -= dx / cam.z; cam.y -= dy / cam.z; clampTo(cam); tgt.x = cam.x; tgt.y = cam.y; tgt.z = cam.z;
          vel.x = lerp(vel.x, dx / dtm * 1000, 0.45); vel.y = lerp(vel.y, dy / dtm * 1000, 0.45);
          ptr.lx = x; ptr.ly = y; ptr.lt = e.timeStamp;
        }
      }
      placeTip(x, y);
    });
    const endPointer = e => {
      pts.delete(e.pointerId);
      if (pinch) { if (pts.size < 2) pinch = null; ptr.down = false; ptr.moved = false; root.classList.remove('dragging'); return; }
      if (!ptr.down || e.pointerId !== ptr.id) return;
      ptr.down = false; root.classList.remove('dragging');
      const wasMoved = ptr.moved; ptr.moved = false;
      if (e.type === 'pointercancel') return;
      if (!wasMoved) { vel.x = vel.y = 0; if (ptr.btn === 0) handleClick(ptr.x, ptr.y); }
      else if (e.timeStamp - ptr.lt > 90) { vel.x = vel.y = 0; }
    };
    canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('pointerleave', e => { if (!ptr.down) { ptr.inside = false; setHover(null, null, null); hideTip(); } });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top;
      let d = e.deltaY; if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= 100;
      zoomAt(x, y, Math.pow(1.0017, -d * (e.ctrlKey ? 2.4 : 1)));
    }, { passive: false });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top; ptr.x = x; ptr.y = y;
      if (routeFleet !== null) { const fid = routeFleet; setRouteMode(null); emit('routeCancel', fid); return; }
      const p = pick(x, y);
      if (p.sd) { if (selFleet !== null) emit('moveOrder', { fleetId: selFleet, toStar: p.sd.id }); else emit('contextStar', p.sd.id); }
    });
    function handleClick(x, y) {
      const p = pick(x, y), now = performance.now();
      if (routeFleet !== null) {
        if (p.sd) { const fid = routeFleet; setRouteMode(null); routePrev = null; emit('moveOrder', { fleetId: fid, toStar: p.sd.id }); }
        return;
      }
      if (p.fd) {
        let id = p.fd.id;
        if (p.grp && p.grp.list.length > 1) { const i = p.grp.list.findIndex(f => f.id === selFleet); id = p.grp.list[(i + 1) % p.grp.list.length].id; }
        setSelFleet(id, true); return;
      }
      if (p.sd) {
        const id = p.sd.id;
        if (lastClick.id === id && now - lastClick.t < 380) { emit('dblStar', id); lastClick.t = 0; }
        else lastClick = { t: now, id };
        setSelStar(id, true); return;
      }
      if (lastClick.id === -1 && now - lastClick.t < 380) { zoomAt(x, y, 1.9); lastClick.t = 0; return; }
      lastClick = { t: now, id: -1 };
      if (opts.clearOnEmptyClick) { if (selFleet !== null) setSelFleet(null, true); if (selStar !== null) setSelStar(null, true); }
    }
    function isActive() { return !destroyed && root.isConnected && root.offsetWidth > 0 && root.offsetHeight > 0 && !(UI.modalOpen && UI.modalOpen()); }
    const onKeyDown = e => {
      if (!opts.keys || !isActive() || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      const k = e.key; let used = true;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') { keys[k] = true; keys.shift = e.shiftKey; cancelFlight(); }
      else if (k === '+' || k === '=' || k === 'Add') zoomStep(1.4);
      else if (k === '-' || k === '_' || k === 'Subtract') zoomStep(1 / 1.4);
      else if (k === 'Home') api.home();
      else if (k === 'End') api.fit();
      else if (k === 'Escape') {
        if (routeFleet !== null) { const fid = routeFleet; setRouteMode(null); emit('routeCancel', fid); }
        else if (selFleet !== null) setSelFleet(null, true);
        else if (opts.escClears && selStar !== null) setSelStar(null, true);
        else used = false;
      } else used = false;
      if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    const onKeyUp = e => { if (keys[e.key]) keys[e.key] = false; keys.shift = e.shiftKey; };
    const onBlur = () => { for (const k in keys) keys[k] = false; };
    window.addEventListener('keydown', onKeyDown, true); window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', onBlur);

    // ---------------------------------------------------------------- hover
    function setHover(sd, fd, grp) {
      const sid = sd ? sd.id : null, fid = fd ? fd.id : null;
      if (sid !== hoverStar) { hoverStar = sid; hoverT = 0; emit('hoverStar', sid); }
      if (fid !== hoverFleet) { hoverFleet = fid; emit('hoverFleet', fid); }
      hoverGrp = grp;
      root.classList.toggle('hot', sid !== null || fid !== null);
    }
    function updateHover() {
      if (!ptr.inside || ptr.moved || pinch || flight) { setHover(null, null, null); hoverNeb = -1; refreshTip(); return; }
      const p = pick(ptr.x, ptr.y);
      setHover(p.sd, p.fd, p.grp);
      hoverNeb = (!p.sd && !p.fd && S) ? nebAt(cam.x + (ptr.x - W / 2) / cam.z, cam.y + (ptr.y - H / 2) / cam.z) : -1;
      refreshTip();
    }

    // ================================================================== rendering
    const amb = { key: '', world: null, far: null, tiles: null, tileDpr: 0, sparks: null, ext: null, extKey: '', extAt: -9, grad: null, gradKey: '' };
    const mod = (v, n) => ((v % n) + n) % n;
    const ownTone = {};
    const toneFor = (kind, id) => {
      if (kind === 'own') { const k = 'o' + id; return ownTone[k] || (ownTone[k] = rgba(mixc(hex('#ece6d3'), empCol(id), 0.42), 1)); }
      return kind === 'ivory' ? '#ece6d3' : kind === 'mist' ? '#9aa7d2' : kind === 'sel' ? th.brassHi : kind === 'gold' ? '#ffd86a' : kind === 'violet' ? '#e6a8ff' : '#98a5cf';
    };

    function ensureAmbient() {
      if (amb.key !== galaxyKey || !amb.world) {
        amb.key = galaxyKey;
        const asp = gh / gw, w = 240, hh = Math.round(clamp(240 * asp, 120, 300));
        amb.world = { canvas: buildAmbientNebula(w, hh, 7, { scale: 3.1, warp: 1.5, t0: 0.4, t1: 0.92, gain: 0.42, wisp: 0.5, lens: true, colors: [[30, 44, 118], [64, 38, 120], [44, 130, 170]] }), x0: -gw * 0.2, y0: -gh * 0.2, w: gw * 1.4, h: gh * 1.4 };
        if (!amb.far) amb.far = buildAmbientNebula(320, 180, 91, { scale: 4.2, warp: 1.9, t0: 0.42, t1: 0.92, gain: 0.3, wisp: 0.38, lens: false, colors: [[20, 34, 92], [54, 34, 104], [60, 108, 160]] });
      }
      const td = Math.min(2, dpr);
      if (!amb.tiles || amb.tileDpr !== td) {
        amb.tileDpr = td;
        amb.tiles = [{ c: buildStarTile(512, td, 260, 4242, false), f: 0.05 }, { c: buildStarTile(512, td, 70, 777, true), f: 0.13 }];
        const r = rng32(99); amb.sparks = [];
        for (let i = 0; i < 90; i++) amb.sparks.push({ u: r(), v: r(), s: 6 + r() * 11, ph: r() * TAU, fr: 0.4 + r() * 1.3, k: r() < 0.6 ? 'white' : r() < 0.6 ? 'blue' : 'yellow', f: 0.06 + r() * 0.1 });
      }
      // optional external backdrop (MOO.Gfx.Space.makeBackdrop), rebuilt a little after a resize settles
      const Sp = M.Gfx && M.Gfx.Space;
      if (opts.backdrop !== 'builtin' && Sp && Sp.makeBackdrop && !amb.extFailed) {
        const key = (W >> 5) + 'x' + (H >> 5);
        if (key !== amb.extKey && (!amb.ext || clock - amb.extAt > 0.4)) {
          try { const c = Sp.makeBackdrop(Math.min(W, 1600), Math.min(H, 900), 'galaxymap', { intensity: 0.42, stars: 0.5, palette: ['#2a1d78', '#14357a', '#3a2a7a', '#0d4f7a'] }); if (c && (c.width || c.naturalWidth)) { amb.ext = c; amb.extKey = key; amb.extAt = clock; } else amb.extFailed = true; }
          catch (e) { amb.extFailed = true; console.warn('[GalaxyMap] Space.makeBackdrop failed, using built-in backdrop', e); }
        }
      }
    }
    function drawBackdrop(t) {
      const pf = stats.profile, prof = stats.passes; let tq = pf ? performance.now() : 0;
      const lq = k => { if (pf) { const n = performance.now(); prof[k] = (prof[k] || 0) * 0.92 + (n - tq) * 0.08; tq = n; } };
      ensureAmbient(); lq('bd_ensure');
      const z = cam.z, px = (cam.x - gw / 2) * fitZ, py = (cam.y - gh / 2) * fitZ, zr = clamp(Math.log2(z / fitZ), -1, 5);
      const par = Q.parallax;
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (amb.ext) {
        const mx = W * 0.04, my = H * 0.04, ox = par ? clamp(-px * 0.05, -mx, mx) : 0, oy = par ? clamp(-py * 0.05, -my, my) : 0;
        ctx.drawImage(amb.ext, -mx + ox, -my + oy, W + mx * 2, H + my * 2);
      } else {
        const gk = W + 'x' + H;
        if (amb.gradKey !== gk) { const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62); g.addColorStop(0, '#0c1442'); g.addColorStop(0.55, '#070c2b'); g.addColorStop(1, '#03051a'); amb.grad = g; amb.gradKey = gk; }
        ctx.fillStyle = amb.grad; ctx.fillRect(0, 0, W, H);
        // far dust layer (parallax)
        const far = amb.far, s = Math.max(W / far.width, H / far.height) * 1.14, dw = far.width * s, dh = far.height * s;
        const ox = par ? clamp(-px * 0.07, -(dw - W) / 2, (dw - W) / 2) : 0, oy = par ? clamp(-py * 0.07, -(dh - H) / 2, (dh - H) / 2) : 0;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(0.95 * Q.nebula, 0, 1);
        ctx.drawImage(far, (W - dw) / 2 + ox, (H - dh) / 2 + oy, dw, dh);
      }
      lq('bd_base');
      // galaxy-anchored ambient cloud
      const wd = amb.world, wx = (wd.x0 - cam.x) * z + W / 2, wy = (wd.y0 - cam.y) * z + H / 2;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp((amb.ext ? 0.32 : 0.85) * Q.nebula, 0, 1);
      ctx.drawImage(wd.canvas, wx, wy, wd.w * z, wd.h * z);
      lq('bd_world');
      // parallax star layers
      ctx.globalCompositeOperation = 'lighter';
      const nl = Q.parallax === 0 ? 1 : Q.parallax === 1 ? 1 : 2;
      for (let li = 0; li < nl; li++) {
        const L = amb.tiles[li], f = par ? L.f : 0, sT = 512 * (1 + zr * (0.04 + f * 0.55) * 0.35), ox = W / 2 - px * f, oy = H / 2 - py * f;
        ctx.globalAlpha = (li === 0 ? 0.9 : 1) * (amb.ext ? 0.6 : 1);
        const i0 = Math.floor((0 - ox) / sT), i1 = Math.floor((W - ox) / sT), j0 = Math.floor((0 - oy) / sT), j1 = Math.floor((H - oy) / sT);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) ctx.drawImage(L.c, Math.round(ox + i * sT), Math.round(oy + j * sT), Math.ceil(sT) + 1, Math.ceil(sT) + 1);
      }
      lq('bd_tiles');
      // twinkling sparkles
      if (Q.sparkles > 0) {
        const P = Math.max(W, H) * 1.5, n = Math.min(Q.sparkles, amb.sparks.length);
        for (let i = 0; i < n; i++) {
          const sp = amb.sparks[i], f = par ? sp.f : 0;
          const x = mod(sp.u * P - px * f, P) - (P - W) / 2, y = mod(sp.v * P - py * f, P) - (P - H) / 2;
          if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
          const a = 0.1 + 0.9 * Math.pow(Math.max(0, Math.sin(t * sp.fr + sp.ph)), 3), s = sp.s * (0.7 + 0.3 * a) * uk;
          ctx.globalAlpha = a * 0.8; ctx.drawImage(spikeSprite(sp.k), x - s, y - s, s * 2, s * 2);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      lq('bd_spark');
    }
    function drawNebulae(t) {
      if (!gnebs.length) return;
      const z = cam.z; ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < gnebs.length; i++) {
        const n = gnebs[i], x = (n.x0 - cam.x) * z + W / 2, y = (n.y0 - cam.y) * z + H / 2, w = n.w * z, hh = n.h * z;
        if (x > W || y > H || x + w < 0 || y + hh < 0) continue;
        const br = 0.9 + 0.1 * Math.sin(t * 0.45 + i * 1.9);
        ctx.globalAlpha = clamp(0.95 * br * (0.55 + 0.45 * Q.nebula), 0, 1); ctx.drawImage(n.canvas, x, y, w, hh);
        if (Q.layers >= 2) { const k = 1.07, dx = Math.sin(t * 0.07 + i) * 5, dy = Math.cos(t * 0.06 + i * 2) * 5; ctx.globalAlpha = 0.3 * br; ctx.drawImage(n.canvas, x - w * (k - 1) / 2 + dx, y - hh * (k - 1) / 2 + dy, w * k, hh * k); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    function drawBounds() {
      const z = cam.z, x0 = (0 - cam.x) * z + W / 2, y0 = (0 - cam.y) * z + H / 2, x1 = (gw - cam.x) * z + W / 2, y1 = (gh - cam.y) * z + H / 2;
      ctx.fillStyle = 'rgba(2,3,12,0.5)';
      if (y0 > 0) ctx.fillRect(0, 0, W, Math.min(H, y0));
      if (y1 < H) ctx.fillRect(0, Math.max(0, y1), W, H - Math.max(0, y1));
      const ty0 = Math.max(0, y0), ty1 = Math.min(H, y1);
      if (x0 > 0) ctx.fillRect(0, ty0, Math.min(W, x0), Math.max(0, ty1 - ty0));
      if (x1 < W) ctx.fillRect(Math.max(0, x1), ty0, W - Math.max(0, x1), Math.max(0, ty1 - ty0));
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(214,179,106,0.30)';
      ctx.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
      // brass corner brackets
      const L = 14 * uk; ctx.strokeStyle = 'rgba(243,220,160,0.85)'; ctx.lineWidth = 2; ctx.beginPath();
      const cs = [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]];
      for (const c of cs) { ctx.moveTo(c[0] + c[2] * L, c[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0], c[1] + c[3] * L); }
      ctx.stroke();
    }
    function drawTerritory(t) {
      if (!terr) return;
      const z = cam.z, x = (terr.x0 - cam.x) * z + W / 2, y = (terr.y0 - cam.y) * z + H / 2;
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(lerp(0.85, 1, wCol) * (0.94 + 0.06 * Math.sin(t * 0.9)), 0, 1);
      ctx.drawImage(terr.canvas, x, y, terr.w * z, terr.h * z);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // ------------------------------------------------------------------ star-chart graticule + parsec ruler
    function drawGrid(t) {
      if (M.Settings && M.Settings.get('mapGrid') === false) return;
      const z = cam.z, pcPx = z * pcU, hw = W / 2, hh = H / 2;
      let ST = GRID_STEPS[GRID_STEPS.length - 1];
      for (const s of GRID_STEPS) if (s.M * pcPx >= 84) { ST = s; break; }
      const majU = ST.M * pcU, minU = ST.m * pcU;
      const gx0 = Math.max(0, view.x0), gx1 = Math.min(gw, view.x1), gy0 = Math.max(0, view.y0), gy1 = Math.min(gh, view.y1);
      if (gx1 <= gx0 || gy1 <= gy0) return;
      const sx0 = (gx0 - cam.x) * z + hw, sx1 = (gx1 - cam.x) * z + hw, sy0 = (gy0 - cam.y) * z + hh, sy1 = (gy1 - cam.y) * z + hh;
      ctx.lineWidth = 1; ctx.globalAlpha = 1;
      // major hairlines
      ctx.beginPath();
      for (let x = Math.ceil(gx0 / majU) * majU; x <= gx1 + 1e-6; x += majU) { const sx = Math.round((x - cam.x) * z + hw) + 0.5; ctx.moveTo(sx, sy0); ctx.lineTo(sx, sy1); }
      for (let y = Math.ceil(gy0 / majU) * majU; y <= gy1 + 1e-6; y += majU) { const sy = Math.round((y - cam.y) * z + hh) + 0.5; ctx.moveTo(sx0, sy); ctx.lineTo(sx1, sy); }
      ctx.strokeStyle = 'rgba(214,179,106,0.085)'; ctx.stroke();
      // minor crosses at the sub-grid intersections
      const nx = (gx1 - gx0) / minU, ny = (gy1 - gy0) / minU;
      if (nx * ny < 2400) {
        ctx.beginPath(); const a = 2.2;
        for (let x = Math.ceil(gx0 / minU) * minU; x <= gx1 + 1e-6; x += minU) {
          const sx = Math.round((x - cam.x) * z + hw) + 0.5;
          for (let y = Math.ceil(gy0 / minU) * minU; y <= gy1 + 1e-6; y += minU) { const sy = Math.round((y - cam.y) * z + hh) + 0.5; ctx.moveTo(sx - a, sy); ctx.lineTo(sx + a, sy); ctx.moveTo(sx, sy - a); ctx.lineTo(sx, sy + a); }
        }
        ctx.strokeStyle = 'rgba(214,179,106,0.2)'; ctx.stroke();
      }
      if (opts.ruler === false) return;
      // ruler along the top and left edges (screen space), labelled in parsecs from the galaxy origin
      const rt = 15 * uk, rl = 26 * uk;
      let gr = ctx.createLinearGradient(0, 0, 0, rt + 6); gr.addColorStop(0, 'rgba(4,6,22,0.62)'); gr.addColorStop(1, 'rgba(4,6,22,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, rt + 6);
      gr = ctx.createLinearGradient(0, 0, rl + 6, 0); gr.addColorStop(0, 'rgba(4,6,22,0.62)'); gr.addColorStop(1, 'rgba(4,6,22,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, rl + 6, H);
      ctx.font = Math.round(9.5 * uk) + 'px ' + th.fontUi; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(214,179,106,0.55)'; ctx.fillStyle = 'rgba(226,196,128,0.78)';
      ctx.beginPath();
      for (let x = Math.ceil(gx0 / minU) * minU; x <= gx1 + 1e-6; x += minU) {
        const sx = Math.round((x - cam.x) * z + hw) + 0.5; if (sx < rl || sx > W) continue;
        const major = Math.abs(x / majU - Math.round(x / majU)) < 1e-4; ctx.moveTo(sx, 0); ctx.lineTo(sx, major ? 7 * uk : 3.5 * uk);
      }
      for (let y = Math.ceil(gy0 / minU) * minU; y <= gy1 + 1e-6; y += minU) {
        const sy = Math.round((y - cam.y) * z + hh) + 0.5; if (sy < rt || sy > H) continue;
        const major = Math.abs(y / majU - Math.round(y / majU)) < 1e-4; ctx.moveTo(0, sy); ctx.lineTo(major ? 7 * uk : 3.5 * uk, sy);
      }
      ctx.stroke();
      const lab = v => { const p = v / pcU; return (Math.abs(p - Math.round(p)) < 1e-6 ? String(Math.round(p)) : p.toFixed(1)); };
      for (let x = Math.ceil(gx0 / majU) * majU; x <= gx1 + 1e-6; x += majU) { const sx = (x - cam.x) * z + hw; if (sx > rl + 8 && sx < W - 10) ctx.fillText(lab(x), sx + 3, 14 * uk); }
      for (let y = Math.ceil(gy0 / majU) * majU; y <= gy1 + 1e-6; y += majU) { const sy = (y - cam.y) * z + hh; if (sy > rt + 8 && sy < H - 6) ctx.fillText(lab(y), 9 * uk, sy - 3); }
      ctx.fillStyle = 'rgba(214,179,106,0.55)'; ctx.fillText('pc', 5 * uk, 12 * uk);
    }

    // ------------------------------------------------------------------ range rings, lanes
    function ring(cx, cy, r, col, a, lw, dash, off) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.lineWidth = lw; ctx.strokeStyle = rgba(col, a);
      if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = off || 0; }
      ctx.stroke(); if (dash) ctx.setLineDash([]);
    }
    function drawRanges(t) {
      const z = cam.z, hw = W / 2, hh = H / 2;
      if (rangesSpec) {
        const col = rangesSpec.col || th.rgb.brass, rr = (rangesSpec.radius || 0) * pcU * z;
        for (const id of rangesSpec.stars) { const s = sdById[id]; if (!s || !s.on && Math.hypot(s.sx - W / 2, s.sy - H / 2) > rr + Math.max(W, H)) continue; ring(s.sx, s.sy, rr, col, 0.55, 1.3, [7, 6], -t * 6); ctx.fillStyle = rgba(col, 0.035); ctx.beginPath(); ctx.arc(s.sx, s.sy, rr, 0, TAU); ctx.fill(); }
        return;
      }
      if (!me) return;
      let cx = 0, cy = 0, have = false;
      if (selStar !== null) { const s = sdById[selStar]; if (s && s.mine) { cx = s.sx; cy = s.sy; have = true; } }
      else if (selFleet !== null) { const fd = FD.get(selFleet); if (fd && fd.owner === pidOf() && fd.a > 0.05) { cx = (fd.dx - cam.x) * z + hw; cy = (fd.dy - cam.y) * z + hh; have = true; } }
      if (!have) return;
      const rr = (me.range || 0) * pcU * z, sr = scanOf() * pcU * z, ep = easeOut(clamp(selT / 0.5, 0, 1));
      ctx.fillStyle = rgba(th.rgb.brass, 0.03 * ep); ctx.beginPath(); ctx.arc(cx, cy, rr * ep, 0, TAU); ctx.fill();
      ring(cx, cy, rr * ep, th.rgb.brass, 0.62, 1.4, [8, 7], -t * 7);
      ring(cx, cy, sr * ep, th.rgb.cyan, 0.5, 1.2, [2, 6], t * 4);
      // radar sweep pulse from the selected colony / fleet
      if (!Q.reduce) { const u = mod(t * 0.42, 1), rp = sr * u; ring(cx, cy, rp, th.rgb.cyan, 0.34 * (1 - u), 1.6); }
      // labels
      ctx.font = Math.round(10 * uk) + 'px ' + th.fontUi; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,5,18,0.85)';
      const lbl = (txt, ang, r, col) => { const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); };
      lbl('range ' + me.range + ' pc', -PI * 0.5, rr * ep + 11 * uk, rgba(th.rgb.brassHi, 0.9)); lbl('scan ' + scanOf() + ' pc', PI * 0.5, sr * ep + 13 * uk, rgba(th.rgb.cyan, 0.9));
      ctx.textAlign = 'left';
    }
    function drawLanes(t) {
      const z = cam.z, hw = W / 2, hh = H / 2, pid = pidOf();
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {              // pass 0: foreign (dimmer), pass 1: own
        const byOwner = {};
        for (let i = 0; i < movers.length; i++) {
          const fd = movers[i], f = fd.f; if (f.to < 0 || fd.a < 0.03 || (fd.owner === pid) !== (pass === 1)) continue;
          const to = sdById[f.to]; if (!to) continue;
          const fx = (fd.dx - cam.x) * z + hw, fy = (fd.dy - cam.y) * z + hh;
          if ((fx < -50 && to.sx < -50) || (fx > W + 50 && to.sx > W + 50) || (fy < -50 && to.sy < -50) || (fy > H + 50 && to.sy > H + 50)) continue;
          (byOwner[fd.owner] || (byOwner[fd.owner] = [])).push(fx, fy, to.sx, to.sy, fd.a);
        }
        for (const o in byOwner) {
          const arr = byOwner[o], col = empCol(+o);
          ctx.beginPath(); for (let i = 0; i < arr.length; i += 5) { ctx.moveTo(arr[i], arr[i + 1]); ctx.lineTo(arr[i + 2], arr[i + 3]); }
          ctx.lineWidth = pass ? 1.5 : 1.1; ctx.strokeStyle = rgba(col, pass ? 0.5 : 0.3); ctx.setLineDash([5, 6]); ctx.lineDashOffset = Q.flow ? -t * 16 : 0; ctx.stroke(); ctx.setLineDash([]);
          // travelling dots
          if (Q.flow && Q.part > 0.3) {
            const gs = glowSprite(col), ds = (pass ? 7 : 5) * uk; ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < arr.length; i += 5) {
              const dx = arr[i + 2] - arr[i], dy = arr[i + 3] - arr[i + 1], len = Math.hypot(dx, dy); if (len < 18) continue;
              const k = mod(t * 0.55 + i * 0.13, 1); ctx.globalAlpha = (pass ? 0.9 : 0.55) * Math.sin(PI * k) * arr[i + 4];
              ctx.drawImage(gs, arr[i] + dx * k - ds, arr[i + 1] + dy * k - ds, ds * 2, ds * 2);
            }
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          }
        }
      }
      ctx.lineCap = 'butt';
    }

    // ------------------------------------------------------------------ stars
    function computeScreen(t, dt) {
      const z = cam.z, hw = W / 2, hh = H / 2, baseR = clamp(1.4 + zn() * 0.032, 2.2, 9.5 + Math.max(0, zn() - 260) * 0.05) * uk;
      for (let i = 0; i < SD.length; i++) {
        const s = SD[i];
        s.sx = (s.x - cam.x) * z + hw; s.sy = (s.y - cam.y) * z + hh;
        s.on = s.sx > -70 && s.sx < W + 70 && s.sy > -70 && s.sy < H + 70;
        if (!s.on) continue;
        const kd = KINDS[s.vkind] || KINDS.unknown;
        s.r = baseR * kd.s;
      }
    }
    function zn() { return cam.z * SPACING; }
    const STAR_LODS = [32, 48, 64, 96, 128, 192, 256];
    const warm = { q: [], key: '' };
    function queueWarmup() {                                       // build the star sprites we will need during idle frames (each one costs a few ms)
      const Sp = M.Gfx && M.Gfx.Space; if (!Sp || !Sp.starSprite || SPR.spaceBad) return;
      const key = galaxyKey + ':' + dpr; if (warm.key === key) return; warm.key = key; warm.q.length = 0;
      const kinds = {}; for (const sd of SD) if (KINDS[sd.kind] && sd.kind !== 'unknown') kinds[sd.kind] = 1;
      for (const lod of [48, 64, 96, 128]) for (const k in kinds) for (const spk of [true, false]) warm.q.push(() => { try { Sp.starSprite(k, lod, { spikes: spk && Q.spikes, dpr: 1 }); } catch (e) { SPR.spaceBad = true; } });
    }
    function pumpWarmup() { if (warm.q.length) warm.q.shift()(); }
    // Gfx.Space.starSprite (core + halo [+ spikes] in one sprite) when available; quantised sizes keep its cache small
    function spaceStar(kind, D, spikes) {
      const Sp = M.Gfx && M.Gfx.Space;
      if (!Sp || !Sp.starSprite || SPR.spaceBad || !KINDS[kind] || kind === 'unknown') return null;
      const need = D * dpr * 0.85; let L = STAR_LODS[STAR_LODS.length - 1];
      for (let i = 0; i < STAR_LODS.length; i++) if (STAR_LODS[i] >= need) { L = STAR_LODS[i]; break; }
      try { return Sp.starSprite(kind, L, { spikes: !!spikes, dpr: 1 }); }
      catch (e) { SPR.spaceBad = true; console.warn('[GalaxyMap] Space.starSprite failed; using built-in star sprites', e); return null; }
    }
    function drawStarsPass(t, dt) {
      const n = SD.length, twk = Q.twinkle, znv = zn(), ovAny = wCol + wEnv + wMin;
      // ---- A: glow + disc (additive). One Space sprite per known star, else our halo (cores follow in pass B)
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const s = SD[i]; s.useSp = false; if (!s.on) continue;
        const kd = KINDS[s.vkind] || KINDS.unknown;
        let a = s.live ? 1 : s.known ? 0.92 : 0.62;
        if (ovAny > 0) {                                           // overlay modes tone the starfield down so the colour code reads
          let keep = 1;
          if (wCol > 0) keep = Math.min(keep, lerp(1, s.owner >= 0 ? 1 : 0.22, wCol));
          if (wEnv > 0) keep = Math.min(keep, lerp(1, 0.4, wEnv));
          if (wMin > 0) keep = Math.min(keep, lerp(1, 0.4, wMin));
          a *= keep;
        }
        const hot = s.id === selStar || s.id === hoverStar;
        const tws = twk ? 1 + 0.08 * Math.sin(t * kd.tw * 2.2 + s.ph) + 0.04 * Math.sin(t * 5.3 + s.ph2) : 1;
        const gk = (Q.glow < 0.6 ? 0.75 : 1) * (hot ? 1.12 : 1);
        let sp = null;
        if (!kd.bh) sp = spaceStar(s.vkind, s.r * 13.5 * gk, Q.spikes && kd.spike >= 0.5 && s.r >= 2.8 && s.known);
        if (sp) {
          const D = s.r * 13.5 * gk * (0.97 + 0.03 * tws); s.useSp = true;
          ctx.globalAlpha = clamp(a * (0.9 + 0.1 * tws), 0, 1); ctx.drawImage(sp, s.sx - D / 2, s.sy - D / 2, D, D);
        } else if (!kd.bh) {
          const size = s.r * 11.5 * (0.96 + 0.04 * tws) * (s.known ? 1 : 0.9) * gk;
          ctx.globalAlpha = clamp(a * tws * (s.known ? 0.95 : 0.8), 0, 1); ctx.drawImage(haloSprite(s.vkind), s.sx - size / 2, s.sy - size / 2, size, size);
        }
      }
      // ---- B: our stellar discs (fallback / unknown stars) and black holes (opaque horizon -> source-over)
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < n; i++) {
        const s = SD[i]; if (!s.on) continue;
        const kd = KINDS[s.vkind] || KINDS.unknown;
        if (kd.bh) {
          const bs = s.r * 7.2, spb = spaceStar('blackhole', bs, false);
          ctx.globalAlpha = s.known ? 1 : 0.85;
          if (spb) ctx.drawImage(spb, s.sx - bs / 2, s.sy - bs / 2, bs, bs);
          else ctx.drawImage(bhSprite(), s.sx - bs / 2, s.sy - bs / 2, bs, bs);
          continue;
        }
        if (s.useSp) continue;
        let a = s.live ? 1 : s.known ? 0.92 : 0.8;
        if (wCol > 0 && s.owner < 0) a *= lerp(1, 0.5, wCol);
        ctx.globalAlpha = a;
        const rr = s.r * (s.id === selStar ? 1.08 : 1), cs = coreSprite(s.vkind, rr * 2 * dpr);
        ctx.drawImage(cs, s.sx - rr, s.sy - rr, rr * 2, rr * 2);
      }
      // ---- C: spikes for our own sprites, sparkle for uncharted stars, pulsar beams, black-hole swirl (additive)
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const s = SD[i]; if (!s.on) continue;
        const kd = KINDS[s.vkind] || KINDS.unknown;
        let keep = 1; if (wCol > 0 && s.owner < 0) keep = lerp(1, 0.2, wCol); if (wEnv > 0 || wMin > 0) keep = Math.min(keep, lerp(1, 0.3, Math.max(wEnv, wMin)));
        if (!s.known) {                                              // uncharted: a small cold sparkle so it reads as "a star I have not visited"
          if (!Q.spikes || s.r < 2.2) continue;
          const sz = s.r * 7.5, tws = twk ? 0.75 + 0.25 * Math.sin(t * 1.3 + s.ph) : 1; ctx.globalAlpha = 0.3 * tws * keep; ctx.drawImage(spikeSprite('unknown'), s.sx - sz / 2, s.sy - sz / 2, sz, sz); continue;
        }
        if (kd.bh) {
          if (!SPR.spaceBad && !(M.Gfx && M.Gfx.Space && M.Gfx.Space.starSprite) && Q.glow >= 0.75) { const bs = s.r * 7.2; ctx.save(); ctx.translate(s.sx, s.sy); ctx.scale(1, 0.34); ctx.rotate(t * 0.5 + s.ph); ctx.globalAlpha = 0.9; ctx.drawImage(bhSwirlSprite(), -bs * 0.55, -bs * 0.55, bs * 1.1, bs * 1.1); ctx.restore(); }
          continue;
        }
        const tws = twk ? 0.8 + 0.2 * Math.sin(t * 1.7 * kd.tw + s.ph) : 1;
        if (!s.useSp && Q.spikes && kd.spike > 0 && s.r >= 2.6) {
          const size = s.r * (13 + 7 * kd.spike) * (s.live ? 1 : 0.8);
          ctx.globalAlpha = clamp(0.5 * kd.spike * tws * keep * (s.live ? 1 : 0.6), 0, 1); ctx.drawImage(spikeSprite(s.vkind), s.sx - size / 2, s.sy - size / 2, size, size);
        }
        if (kd.pulsar && Q.glow >= 0.75 && s.r >= 2.4) {
          const bl = s.r * 24 * (0.8 + 0.2 * Math.sin(t * 3 + s.ph)); ctx.save(); ctx.translate(s.sx, s.sy); ctx.rotate(t * 1.6 + s.ph); ctx.globalAlpha = 0.5 * keep * (s.live ? 1 : 0.6);
          ctx.drawImage(beamSprite(), -bl, -bl * 0.1, bl * 2, bl * 0.2); ctx.restore();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      // ---- D: animated star surfaces (Gfx.Space.drawStarSurface) for stars that are big on screen
      const Sp = M.Gfx && M.Gfx.Space;
      if (Sp && Sp.drawStarSurface && Q.glow >= 0.75 && !SPR.surfBad && znv > 250) {
        for (let i = 0; i < n; i++) {
          const s = SD[i]; if (!s.on || !s.known || s.r < 10) continue;
          const kd = KINDS[s.vkind]; if (!kd || kd.bh || s.sx < -60 || s.sx > W + 60 || s.sy < -60 || s.sy > H + 60) continue;
          let keep = 1; if (wCol > 0 && s.owner < 0) keep = lerp(1, 0.45, wCol); if (wEnv > 0 || wMin > 0) keep = Math.min(keep, lerp(1, 0.45, Math.max(wEnv, wMin)));
          ctx.globalAlpha = keep * sstep(250, 300, znv);
          try { Sp.drawStarSurface(ctx, s.vkind, s.sx, s.sy, Math.round(s.r * 0.78 / 2) * 2, t, { dpr: dpr }); } catch (e) { SPR.surfBad = true; console.warn('[GalaxyMap] Space.drawStarSurface failed', e); }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      // ---- markers: ownership, population pips, special marks, overlay badges
      const pid = pidOf(), flagH0 = clamp(9 + znv * 0.034, 11, 25) * uk;
      for (let i = 0; i < n; i++) {
        const s = SD[i]; if (!s.on) continue;
        const x = s.sx, y = s.sy, r = s.r;
        // unexplored: a small plotted-point ring (chart "pin") so it never reads as background dust; a dotted outer ring when there is room
        if (!s.known && ovAny < 0.5) {
          ctx.beginPath(); ctx.arc(x, y, Math.max(3.4, r * 1.55) + 0.5, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(150,172,236,' + (0.5 * (1 - ovAny)) + ')'; ctx.stroke();
          if (znv > 60) { ctx.setLineDash([1.5, 3.5]); ctx.beginPath(); ctx.arc(x, y, r * 2.5 + 3, 0, TAU); ctx.strokeStyle = 'rgba(150,170,230,0.26)'; ctx.stroke(); ctx.setLineDash([]); }
        }
        // inside a gameplay nebula
        if (s.nebula && ovAny < 0.6) { ctx.setLineDash([2, 3.5]); ctx.lineDashOffset = -t * 4; ctx.beginPath(); ctx.arc(x, y, r * 2.15 + 3.5, 0, TAU); ctx.strokeStyle = 'rgba(190,130,255,0.5)'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.setLineDash([]); }
        // owner ring + flag
        if (s.owner >= 0) {
          const col = empCol(s.owner), rr = r * 1.95 + 3 + (s.capital ? 2.5 : 0), bold = 1 + wCol * 0.9;
          ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.lineWidth = 1.4 * bold; ctx.strokeStyle = rgba(col, 0.82); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, rr + 2.6, 0, TAU); ctx.lineWidth = 0.8; ctx.strokeStyle = rgba(col, 0.28); ctx.stroke();
          if (s.capital) { ctx.setLineDash([2, 3]); ctx.lineDashOffset = -t * 5; ctx.beginPath(); ctx.arc(x, y, rr + 6, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,214,106,0.7)'; ctx.stroke(); ctx.setLineDash([]); }
          const fh = flagH0 * (1 + 0.5 * wCol) * (s.capital ? 1.18 : 1);
          drawFlag(ctx, x + rr * 0.72, y - rr * 0.55, fh, col, s.capital, t, s.ph, 1);
          // population pips (filled share of max population)
          if (znv > 52 || wCol > 0.2) {
            const np = 5, fill = s.maxPop > 0 ? clamp(Math.ceil(np * s.pop / s.maxPop - 1e-6), s.pop > 0 ? 1 : 0, np) : 0, pw = Math.max(2.4, 2.2 * uk + wCol * 1.2), gap = pw * 0.55, tw0 = np * pw + (np - 1) * gap, py = y + rr + 5.5;
            for (let k = 0; k < np; k++) { const px = x - tw0 / 2 + k * (pw + gap); ctx.fillStyle = k < fill ? rgba(col, 0.95) : 'rgba(150,165,215,0.24)'; ctx.fillRect(Math.round(px), Math.round(py), Math.ceil(pw), Math.ceil(pw)); }
            s.pipY = py + pw + 1;
          } else s.pipY = y + rr + 2;
        } else s.pipY = y + r * 1.9 + 2;
        // artifacts (ancient relics) — a small violet gem
        if (s.art && znv > 80 && ovAny < 0.6) { ctx.fillStyle = 'rgba(190,140,255,0.95)'; pathStar4(ctx, x - r * 1.5 - 3, y - r * 1.5 - 3, 3.8 * uk, 0.3); ctx.fill(); ctx.strokeStyle = 'rgba(30,10,60,0.8)'; ctx.lineWidth = 0.8; ctx.stroke(); }
        // Orion: violet ward ring + the guardian's eye while it lives
        if (s.orion) {
          const rr = r * 2.5 + 5; ctx.setLineDash([4, 5]); ctx.lineDashOffset = t * 6; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(255,120,190,0.65)'; ctx.stroke(); ctx.setLineDash([]);
          if (s.guard) drawGuardianEye(ctx, x - rr * 0.78 - 4, y - rr * 0.78 - 2, clamp(5 + znv * 0.028, 7, 15) * uk, t);
        }
        // overlay badges
        if (wEnv > 0.01 || wMin > 0.01) drawBadge(s, t, znv);
      }
      ctx.globalAlpha = 1;
    }
    function drawBadge(s, t, znv) {
      const x = s.sx, y = s.sy, r = s.r, rr = r * 1.8 + 3.5, pl = s.pl;
      for (let pass = 0; pass < 2; pass++) {
        const w = pass === 0 ? wEnv : wMin; if (w < 0.01) continue;
        let col, known = s.known && pl, none = false, extra = 0, letter = '';
        if (known) {
          if (pass === 0) { const c = ENV[clamp(s.env, 0, ENV.length - 1)]; col = hex(c.col); none = s.env === 0; extra = s.env === 6 ? 1 : 0; letter = TYPE_LETTER[pl.type] || ''; }
          else { const c = MINERALS[clamp(s.min, 0, MINERALS.length - 1)]; col = hex(c.col); extra = s.min === 4 ? 1 : s.min >= 5 ? 2 : 0; }
        } else col = [120, 135, 190];
        ctx.globalAlpha = w;
        if (known && !none) { ctx.globalCompositeOperation = 'lighter'; const gs = glowSprite(col), gsz = rr * 3.4; ctx.globalAlpha = w * (0.55 + 0.15 * Math.sin(t * 2 + s.ph)); ctx.drawImage(gs, x - gsz / 2, y - gsz / 2, gsz, gsz); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = w; }
        ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU);
        if (!known || none) { ctx.setLineDash([2.5, 3.5]); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(col, known ? 0.55 : 0.4); ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.lineWidth = 2.6; ctx.strokeStyle = rgba(col, 0.96); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, rr - 2.2, 0, TAU); ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(4,6,20,0.7)'; ctx.stroke(); }
        if (extra === 1) { ctx.fillStyle = rgba(col, 0.95); pathStar4(ctx, x + rr * 0.78, y - rr * 0.78, 4.2 * uk, 0.3); ctx.fill(); }
        if (extra === 2 && pass === 1) { ctx.fillStyle = rgba(col, 0.95); pathDiamond(ctx, x + rr * 0.78, y - rr * 0.78, 3.6 * uk); ctx.fill(); ctx.strokeStyle = 'rgba(20,6,40,0.9)'; ctx.lineWidth = 0.8; ctx.stroke(); }
        if (!known && znv > 70) { ctx.fillStyle = 'rgba(150,165,225,0.55)'; ctx.font = Math.round(9 * uk) + 'px ' + th.fontUi; ctx.textAlign = 'center'; ctx.fillText('?', x, y + rr + 10 * uk); ctx.textAlign = 'left'; }
        else if (pass === 0 && letter && znv > 150) { const ls = labelSprite(letter, Math.round(9.5 * uk), rgba(col, 1), dpr, th.fontUi); ctx.drawImage(ls.c, x + rr * 0.55, y + rr * 0.35, ls.w, ls.h); }
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ the single planet of each explored star (small dot -> lit sphere as you zoom in)
    const PL_LODS = [24, 32, 48, 64, 96, 128];
    let plPre = 0;
    function preloadPlanets() {                                   // Gfx.Planets builds its textures in timed slices; until ready we use our own icons
      const P = M.Gfx && M.Gfx.Planets; if (plPre || !P || !P.preload) return; plPre = 1;
      const seen = {}, descs = [];
      for (const pl of (S && S.planets) || []) if (pl && pl.type && pl.type !== 'none' && !seen[pl.type] && P.LOOKS.indexOf(pl.type) >= 0) { seen[pl.type] = 1; descs.push({ look: pl.type, seed: 'gm-' + pl.type }); }
      try { P.preload(descs, () => { plPre = 2; }, { tier: 128, budget: 6 }); } catch (e) { plPre = -1; }
    }
    function planetImg(type, px, owned, la, id) {
      const P = M.Gfx && M.Gfx.Planets;
      if (plPre === 2 && P && P.sprite && P.LOOKS.indexOf(type) >= 0) {
        const need = px * dpr; let L = PL_LODS[PL_LODS.length - 1]; for (let i = 0; i < PL_LODS.length; i++) if (PL_LODS[i] >= need * 0.9) { L = PL_LODS[i]; break; }
        const step = TAU / 12, q = Math.round(la / step) * step;
        try { return { c: P.sprite({ look: type, seed: 'gm-' + type, inhabited: !!owned }, L, { dpr: 1, lightAngle: q }), ext: true }; } catch (e) { plPre = -1; }
      }
      return { c: planetSprite(type, px * dpr, id % 3), ext: false };
    }
    function drawSystems(t) {
      const znv = zn(); if (znv < 105) return;
      if (znv > 90 && !plPre) preloadPlanets();
      const fade = sstep(105, 150, znv), orbitA = sstep(165, 230, znv), z = cam.z;
      for (let i = 0; i < SD.length; i++) {
        const s = SD[i]; if (!s.on || !s.known || !s.pl || s.pl.type === 'none') continue;
        const pl = s.pl, ro = s.r * 2.1 + 6 * uk + clamp((znv - 150) * 0.05, 0, 36), ang = PI * 0.85 + (s.ang / TAU) * PI * 0.5;       // always on the left, clear of flags and labels
        const pr = clamp(2.6 + (znv - 105) * 0.016 + (pl.maxPop || 40) / 120 * 2.2, 2.8, 15) * uk, px = s.sx + Math.cos(ang) * ro, py = s.sy + Math.sin(ang) * ro * 0.7;
        if (orbitA > 0.02) { ctx.globalAlpha = orbitA * 0.5; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.ellipse(s.sx, s.sy, ro, ro * 0.7, 0, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,180,240,0.32)'; ctx.stroke(); ctx.setLineDash([]); }
        if (pl.rocks && pl.rocks !== 'none' && znv > 200) {          // rock belt hugging the orbit
          ctx.globalAlpha = sstep(200, 260, znv) * 0.9;
          const nr = pl.rocks === 'many' ? 18 : 8, rnd = rng32(hashInt(pl.id * 31 + 5)); ctx.fillStyle = 'rgba(196,190,178,0.8)';
          for (let k = 0; k < nr; k++) { const a = rnd() * TAU + (Q.reduce ? 0 : t * 0.03), rj = ro * (1.2 + rnd() * 0.12); ctx.fillRect(s.sx + Math.cos(a) * rj - 0.7, s.sy + Math.sin(a) * rj * 0.7 - 0.7, 1.4 + rnd() * 1.3, 1.4 + rnd() * 1.3); }
        }
        const owned = pl.owner >= 0 && s.owner >= 0, la = Math.atan2(s.sy - py, s.sx - px), im = planetImg(pl.type, pr * (2.5), owned, la, pl.id), sz = im.ext ? pr * 2.5 : pr * 2;
        ctx.globalAlpha = fade; ctx.drawImage(im.c, px - sz / 2, py - sz / 2, sz, sz);
        if (owned) { ctx.beginPath(); ctx.arc(px, py, pr + 2.2, 0, TAU); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(empCol(pl.owner), 0.95); ctx.stroke(); }
        if (znv > 260 && owned) { const tx = Math.round(s.pop) + '/' + (s.maxPop || '?'), ls = labelSprite(tx, Math.round(10 * uk), toneFor('ivory'), dpr, th.fontUi); ctx.globalAlpha = fade * 0.9; ctx.drawImage(ls.c, px - ls.w / 2, py + pr + 3, ls.w, ls.h); }
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ labels (declutter by priority, fade in/out)
    const LBL_C = new Float64Array(8);
    function drawLabels(t, dt) {
      const znv = zn(), lm = (M.Settings && M.Settings.get('mapLabels')) || 'auto', px = clamp(Math.round((10.5 + znv * 0.016) * uk), 10, 17);
      const lr = lblRects; lr.length = 0;
      for (let i = 0; i < SD.length; i++) { const s = SD[i]; if (!s.on) continue; const rr = s.r * 2 + 3; lr.push(s.sx - rr, s.sy - rr, s.sx + rr, s.sy + rr); }
      // keep the ranges/flags area of owned stars free too
      for (let i = 0; i < SD.length; i++) { const s = SD[i]; if (s.on && s.owner >= 0) { const rr = s.r * 1.95 + 5; lr.push(s.sx + rr * 0.5, s.sy - rr * 2, s.sx + rr * 2.2, s.sy - rr * 0.3); } }
      const own = lr.length;
      for (let k = 0; k < sdSorted.length; k++) {
        const s = sdSorted[k];
        if (!s.on) { s.lblA = 0; continue; }
        const hot = s.id === selStar || s.id === hoverStar, named = s.known || s.orion;
        let want = false, force = false;
        if (s.orion || (hot && named)) { want = true; force = true; }
        else if (!named) want = false;
        else if (lm === 'owned') want = s.owner >= 0;
        else if (lm === 'all') want = true;
        else want = s.owner >= 0 || (s.known && znv >= 40);
        if (wEnv > 0.5 || wMin > 0.5) want = want && (s.known || s.orion) && (s.owner >= 0 || znv >= 70);
        if (!want) { s.lblA = Math.max(0, s.lblA - dt * 6); if (s.lblA <= 0.01) continue; }
        const tone = s.id === selStar ? 'sel' : s.orion ? 'violet' : s.capital ? 'gold' : s.owner >= 0 ? 'own' : s.known ? 'ivory' : 'mist';
        const tcol = tone === 'own' ? toneFor('own', s.owner) : toneFor(tone);
        let e = s.lbl; if (!e || s.lblPx !== px || s.lblTone !== tcol || s.lblDpr !== dpr) { e = s.lbl = labelSprite(s.name, px, tcol, dpr, th.fontDisp); s.lblPx = px; s.lblTone = tcol; s.lblDpr = dpr; }
        const rr = s.r * 1.95 + 3, top = Math.max(s.pipY, s.sy + rr), cd = LBL_C;
        cd[0] = s.sx - e.w / 2; cd[1] = top - 2; cd[2] = s.sx + rr + 2; cd[3] = s.sy - e.h * 0.45; cd[4] = s.sx - rr - 2 - e.w; cd[5] = s.sy - e.h * 0.45; cd[6] = s.sx - e.w / 2; cd[7] = s.sy - rr - e.h - 1;
        let ok = -1;
        for (let c = 0; c < 4 && ok < 0; c++) {
          const x0 = cd[c * 2] + 3, y0 = cd[c * 2 + 1] + 3, x1 = cd[c * 2] + e.w - 3, y1 = cd[c * 2 + 1] + e.h - 3; let hit = false;
          for (let q = 0; q < lr.length; q += 4) { if (x0 < lr[q + 2] && x1 > lr[q] && y0 < lr[q + 3] && y1 > lr[q + 1]) { if (q < own && Math.abs(lr[q] + lr[q + 2] - 2 * s.sx) < 2 * (s.r * 2 + 4) && Math.abs(lr[q + 1] + lr[q + 3] - 2 * s.sy) < 2 * (s.r * 2 + 4)) continue; hit = true; break; } }
          if (!hit) ok = c;
        }
        if (ok < 0 && force) ok = 0;
        if (ok >= 0 && want) {
          s.lblA = Math.min(1, s.lblA + dt * 7); s.lblX = cd[ok * 2]; s.lblY = cd[ok * 2 + 1]; lr.push(s.lblX + 3, s.lblY + 3, s.lblX + e.w - 3, s.lblY + e.h - 3);
        } else if (want) s.lblA = Math.max(0, s.lblA - dt * 7);
        if (s.lblA > 0.01) {
          let a = s.lblA; if (s.vis === 1) a *= 0.88; if (wCol > 0 && s.owner < 0) a *= lerp(1, 0.55, wCol);
          ctx.globalAlpha = a; ctx.drawImage(e.c, Math.round(s.lblX), Math.round(s.lblY), e.w, e.h);
        }
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ fleets
    function updateFleets(dt) {
      if (groupsDirty) buildGroups();
      let ended = false;
      for (const fd of FD.values()) {
        const tw = fd.tw;
        if (tw) {
          const u = clamp((clock - tw.t0) / tw.dur, 0, 1), s = easeIO(u);
          fd.dx = lerp(tw.x0, tw.x1, s); fd.dy = lerp(tw.y0, tw.y1, s);
          if (u >= 1) { fd.tw = null; fd.dx = tw.x1; fd.dy = tw.y1; ended = true; }
        } else { fd.dx = fd.tx; fd.dy = fd.ty; }
        const target = fd.vis ? 1 : 0; fd.a += (target - fd.a) * Math.min(1, dt * 5); if (Math.abs(target - fd.a) < 0.01) fd.a = target;
      }
      if (ended) groupsDirty = true;
    }
    // fleet marker: Gfx.Ships.drawFleetMarker when present and the fleet is fully opaque (it manages its own alpha); otherwise an equivalent built-in chevron
    let extMarkerBad = false;
    function badgeSprite(n) {
      const key = 'badge|' + n + '|' + dpr; let e = SPR.label.get(key); if (e) return e;
      const txt = String(n), fs = 11, f = '700 ' + fs + 'px ' + th.fontUi, g0 = labelSprite.g || (labelSprite.g = mk(4, 4).getContext('2d'));
      g0.font = f; const w = Math.ceil(g0.measureText(txt).width) + 9, hh = fs + 5, c = mk((w + 2) * dpr, (hh + 2) * dpr), g = c.getContext('2d');
      g.scale(dpr, dpr); plate(g, 1.5, 1.5, w - 1, hh - 1, 3); g.fillStyle = 'rgba(8,12,34,0.92)'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = 'rgba(243,220,160,0.95)'; g.stroke();
      g.font = f; g.fillStyle = '#f6efd8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 1.5 + (w - 1) / 2, 1.5 + (hh - 1) / 2 + 0.5);
      e = { c, w: w + 2, h: hh + 2 }; SPR.label.set(key, e); return e;
    }
    // small glyph in the marker's upper-left corner that tells the ship role (war = none)
    function drawKindMark(x, y, s, kind, a) {
      if (kind === 'war') return;
      ctx.globalAlpha = a; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? Math.max(1.1, s * 0.17) : Math.max(2.6, s * 0.4); ctx.strokeStyle = pass ? '#f6efd8' : 'rgba(4,6,20,0.85)';
        ctx.beginPath();
        if (kind === 'colony') { ctx.arc(x, y, s * 0.78, 0, TAU); ctx.moveTo(x - s * 0.34, y); ctx.lineTo(x + s * 0.34, y); ctx.moveTo(x, y - s * 0.34); ctx.lineTo(x, y + s * 0.34); }
        else if (kind === 'transport') { ctx.rect(x - s * 0.8, y - s * 0.55, s * 1.6, s * 1.1); ctx.moveTo(x - s * 0.8, y - s * 0.55); ctx.lineTo(x + s * 0.8, y + s * 0.55); }
        else if (kind === 'scout') { ctx.moveTo(x - s * 1.1, y); ctx.quadraticCurveTo(x, y - s * 1.05, x + s * 1.1, y); ctx.quadraticCurveTo(x, y + s * 1.05, x - s * 1.1, y); ctx.moveTo(x + s * 0.12, y); ctx.arc(x, y, s * 0.12, 0, TAU); }
        else { ctx.moveTo(x - s * 0.8, y - s * 0.7); ctx.lineTo(x - s * 0.1, y); ctx.lineTo(x - s * 0.8, y + s * 0.7); ctx.moveTo(x + s * 0.1, y - s * 0.7); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x + s * 0.1, y + s * 0.7); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    function drawFleetGlyph(x, y, sz, owner, ang, kind, sel, hov, count, moving, a, t, ph) {
      const col = empCol(owner), Sh = M.Gfx && M.Gfx.Ships; let usedExt = false;
      if (a >= 0.995 && Sh && Sh.drawFleetMarker && !extMarkerBad) {
        try { Sh.drawFleetMarker(ctx, x, y, sz, empHex(owner), ang, t + ph, { selected: sel, count: count, moving: moving }); usedExt = true; }
        catch (e) { extMarkerBad = true; console.warn('[GalaxyMap] Ships.drawFleetMarker failed; using built-in markers', e); }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
      }
      if (!usedExt) {
        const hi = mixc(col, [255, 255, 255], 0.45), lo = mixc(col, [0, 0, 0], 0.35), pulse = 0.85 + 0.15 * Math.sin(t * 3.1 + x * 0.05), gz = sz * 2.5;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (sel ? 0.8 : 0.5) * pulse; ctx.drawImage(glowSprite(col), x - gz / 2, y - gz / 2, gz, gz);
        if (moving && Q.flow) { const tl = sz * (1.5 + 0.2 * Math.sin(t * 13 + y * 0.1)); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a * 0.7; ctx.drawImage(tintTrail(owner, col), -tl - sz * 0.22, -sz * 0.2, tl, sz * 0.4); ctx.restore(); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sz, sz); ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(0.62, 0); ctx.lineTo(-0.42, -0.4); ctx.lineTo(-0.2, 0); ctx.lineTo(-0.42, 0.4); ctx.closePath();
        ctx.lineWidth = Math.max(2.6, sz * 0.16) / sz; ctx.strokeStyle = 'rgba(4,6,20,0.75)'; ctx.stroke(); ctx.fillStyle = rgba(col, 1); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.62, 0); ctx.lineTo(-0.42, -0.4); ctx.lineTo(-0.2, 0); ctx.closePath(); ctx.fillStyle = rgba(hi, 0.9); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.62, 0); ctx.lineTo(-0.42, 0.4); ctx.lineTo(-0.2, 0); ctx.closePath(); ctx.fillStyle = rgba(lo, 0.55); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.62, 0); ctx.lineTo(-0.42, -0.4); ctx.lineTo(-0.2, 0); ctx.lineTo(-0.42, 0.4); ctx.closePath();
        ctx.lineWidth = Math.max(1, sz * 0.07) / sz; ctx.strokeStyle = 'rgba(255,255,255,0.88)'; ctx.stroke();
        ctx.restore();
        if (count > 1) { const b = badgeSprite(count); ctx.globalAlpha = a; ctx.drawImage(b.c, x + sz * 0.5, y - sz * 0.5 - b.h + 3, b.w, b.h); }
      }
      if (kind !== 'war') drawKindMark(x - sz * 0.68, y - sz * 0.62, Math.max(3.4, sz * 0.27), kind, a);
      ctx.globalAlpha = 1;
      return usedExt;
    }
    const trailCache = {};
    function tintTrail(owner, col) {
      const k = owner + ':' + col[0] + col[1] + col[2]; if (trailCache[k]) return trailCache[k];
      const src = trailSprite(), c = mk(src.width, src.height), g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = rgba(mixc(col, [255, 255, 255], 0.3), 1); g.fillRect(0, 0, c.width, c.height);
      return (trailCache[k] = c);
    }
    function drawFleets(t) {
      nHit = 0;
      const z = cam.z, hw = W / 2, hh = H / 2, znv = zn(), sz = clamp(10 + znv * 0.045, 12, 22) * uk, pid = pidOf();
      // stationary stacks around their star
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi], sd = sdById[g.star]; if (!sd || !sd.on) continue;
        let a = 0, sel = false, rep = g.list[0];
        for (let i = 0; i < g.list.length; i++) { const fd = g.list[i]; if (fd.a > a) a = fd.a; if (fd.id === selFleet) { sel = true; rep = fd; } }
        if (a < 0.02) continue;
        if (wCol > 0 && g.owner !== pid) a *= lerp(1, 0.35, wCol);
        const ringR = (sd.owner >= 0 ? sd.r * 1.95 + 5.5 : sd.r + 2) + sz * 0.62 + 2;
        g.sx = sd.sx + Math.cos(g.ang) * ringR; g.sy = sd.sy + Math.sin(g.ang) * ringR;
        const hov = hoverGrp === g;
        const ext = drawFleetGlyph(g.sx, g.sy, sz, g.owner, g.ang, g.list.length === 1 ? rep.f.kind : 'mixed', sel, hov, g.ships, false, a * (wEnv + wMin > 0.5 ? 0.45 : 1), t, rep.ph);
        if ((sel && !ext) || (hov && !sel)) { ctx.globalAlpha = 1; drawBrackets(g.sx, g.sy, sz * 0.78, t, sel ? 1 : 0.6, sel ? th.rgb.brassHi : th.rgb.cyan, sel ? selT : 1); }
        hitX[nHit] = g.sx; hitY[nHit] = g.sy; hitR[nHit] = sz * 0.75; hitFd[nHit] = rep; hitGrp[nHit] = g; nHit++;
      }
      // fleets in motion
      for (let i = 0; i < movers.length; i++) {
        const fd = movers[i], f = fd.f; if (fd.a < 0.02) continue;
        let x = (fd.dx - cam.x) * z + hw, y = (fd.dy - cam.y) * z + hh;
        if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
        if (fd.moving && f.from >= 0) {                            // just left its star: slide the marker out along the lane so it never hides the star
          const a0 = sdById[f.from];
          if (a0 && a0.on) { const minD = a0.r * 1.95 + 7 + sz * 0.8, ddx = x - a0.sx, ddy = y - a0.sy; if (ddx * ddx + ddy * ddy < minD * minD) { const to = sdById[f.to]; let ux = to ? to.sx - a0.sx : Math.cos(fd.ang), uy = to ? to.sy - a0.sy : Math.sin(fd.ang); const l = Math.hypot(ux, uy) || 1; x = a0.sx + ux / l * minD; y = a0.sy + uy / l * minD; } }
        }
        const sel = fd.id === selFleet, hov = fd.id === hoverFleet && hoverGrp === null;
        let a = fd.a; if (wCol > 0 && fd.owner !== pid) a *= lerp(1, 0.35, wCol); if (wEnv + wMin > 0.5) a *= 0.45;
        const moving = fd.moving || !!fd.tw;
        // docking fade for fleets that just arrived
        let ang = fd.ang; if (!fd.moving && f.star >= 0) { const sd = sdById[f.star]; if (sd) ang = Math.atan2(sd.sy - y, sd.sx - x); }
        const ext = drawFleetGlyph(x, y, sz, fd.owner, ang, f.kind, sel, hov, fd.nsh, moving, a, t, fd.ph);
        if ((sel && !ext) || (hov && !sel)) { ctx.globalAlpha = 1; drawBrackets(x, y, sz * 0.8, t, sel ? 1 : 0.6, sel ? th.rgb.brassHi : th.rgb.cyan, sel ? selT : 1); }
        fd.sx = x; fd.sy = y; fd.sz = sz;
        // ETA label
        if ((fd.owner === pid || sel || hov) && f.eta > 0 && (znv >= 60 || sel || hov) && !fd.tw) {
          const etaPx = Math.round(10 * uk), etaTone = fd.owner === pid ? toneFor('ivory') : toneFor('mist');
          let e = fd.etaL; if (!e || fd.etaV !== f.eta || fd.etaPx !== etaPx || fd.etaTone !== etaTone || fd.etaDpr !== dpr) { e = fd.etaL = labelSprite('ETA ' + f.eta, etaPx, etaTone, dpr, th.fontUi); fd.etaV = f.eta; fd.etaPx = etaPx; fd.etaTone = etaTone; fd.etaDpr = dpr; }
          ctx.globalAlpha = a * (sel || hov ? 1 : 0.85); ctx.drawImage(e.c, Math.round(x - e.w / 2), Math.round(y + sz * 0.62), e.w, e.h); ctx.globalAlpha = 1;
        }
        hitX[nHit] = x; hitY[nHit] = y; hitR[nHit] = Math.max(9, sz * 0.7); hitFd[nHit] = fd; hitGrp[nHit] = null; nHit++;
      }
      ctx.globalAlpha = 1;
    }

    // ------------------------------------------------------------------ overlays: selection, hover, highlights, route preview, pings
    function drawBrackets(x, y, r, t, a, col, k) {
      const e = easeOut(clamp(k / 0.28, 0, 1)), R = r * (1 + (1 - e) * 1.7) + Math.sin(t * 3.4) * 0.7, L = Math.max(5, R * 0.55);
      ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      for (let pass = 0; pass < 2; pass++) {
        ctx.lineWidth = pass ? 1.7 : 4.5; ctx.strokeStyle = rgba(col, pass ? a : a * 0.25);
        ctx.beginPath();
        for (let q = 0; q < 4; q++) { const sx = q & 1 ? 1 : -1, sy = q & 2 ? 1 : -1; ctx.moveTo(x + sx * R, y + sy * (R - L)); ctx.lineTo(x + sx * R, y + sy * R); ctx.lineTo(x + sx * (R - L), y + sy * R); }
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
    function drawRoute(x0, y0, x1, y1, valid, text, col) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy); if (len < 4) return;
      const ux = dx / len, uy = dy / len, c = valid ? th.rgb.cyan : th.rgb.rose, ex = x1 - ux * 12, ey = y1 - uy * 12;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.lineWidth = 5; ctx.strokeStyle = rgba(c, 0.16); ctx.setLineDash([]); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey); ctx.lineWidth = 1.8; ctx.strokeStyle = rgba(c, 0.95); if (!valid) ctx.setLineDash([6, 5]); else ctx.setLineDash([9, 5]); ctx.lineDashOffset = -clock * 22; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x1 - ux * 4, y1 - uy * 4); ctx.lineTo(x1 - ux * 15 - uy * 6, y1 - uy * 15 + ux * 6); ctx.lineTo(x1 - ux * 15 + uy * 6, y1 - uy * 15 - ux * 6); ctx.closePath(); ctx.fillStyle = rgba(c, 0.95); ctx.fill();
      ctx.lineCap = 'butt';
      if (text) {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, fs = Math.round(11.5 * uk); ctx.font = fs + 'px ' + th.fontUi;
        const tw = ctx.measureText(text).width, pw = tw + 16 * uk, ph = fs + 9 * uk, px = clamp(mx - pw / 2, 4, W - pw - 4), py = clamp(my - ph - 8, 4, H - ph - 4);
        plate(ctx, px, py, pw, ph, 4 * uk); ctx.fillStyle = 'rgba(7,12,34,0.92)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = rgba(c, 0.9); ctx.stroke();
        ctx.fillStyle = valid ? '#e8f6ff' : '#ffd2d6'; ctx.textBaseline = 'middle'; ctx.fillText(text, px + 8 * uk, py + ph / 2 + 0.5); ctx.textBaseline = 'alphabetic';
      }
    }
    function drawOverlays(t, dt) {
      const z = cam.z, hw = W / 2, hh = H / 2, znv = zn();
      // arrival pings
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i], age = clock - p.t0; if (age > 1.9) { pings.splice(i, 1); continue; } if (age < 0) continue;
        const x = (p.x - cam.x) * z + hw, y = (p.y - cam.y) * z + hh; if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
        const u = age / 1.9, col = empCol(p.owner); ring(x, y, 6 + easeOut(u) * 44 * uk, col, 0.75 * (1 - u), 2); ring(x, y, 3 + easeOut(clamp(u * 1.3, 0, 1)) * 24 * uk, col, 0.5 * (1 - u), 1.2);
      }
      // highlighted stars (e.g. valid targets)
      if (hiSpec) {
        const col = hiSpec.col || th.rgb.violet;
        for (const id of hiSpec.ids) {
          const s = sdById[id]; if (!s || !s.on) continue;
          const pr = 0.5 + 0.5 * Math.sin(t * 3.2 + s.ph), rr = s.r * 2.5 + 6 + pr * 2.5, x = s.sx, y = s.sy;
          pathDiamond(ctx, x, y, rr); ctx.setLineDash([3, 4]); ctx.lineDashOffset = -t * 8; ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(col, 0.55); ctx.stroke(); ctx.setLineDash([]);
          const q = rr * 0.34; ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.6 + 0.4 * pr); ctx.beginPath();     // bright corners on the four diamond vertices
          ctx.moveTo(x - q, y - rr + q); ctx.lineTo(x, y - rr); ctx.lineTo(x + q, y - rr + q); ctx.moveTo(x + rr - q, y - q); ctx.lineTo(x + rr, y); ctx.lineTo(x + rr - q, y + q);
          ctx.moveTo(x + q, y + rr - q); ctx.lineTo(x, y + rr); ctx.lineTo(x - q, y + rr - q); ctx.moveTo(x - rr + q, y + q); ctx.lineTo(x - rr, y); ctx.lineTo(x - rr + q, y - q); ctx.stroke();
        }
      }
      // selected fleet: highlighted route
      const sf = selFleet !== null ? FD.get(selFleet) : null;
      if (sf && sf.f.to >= 0 && sf.a > 0.05) {
        const to = sdById[sf.f.to], x = (sf.dx - cam.x) * z + hw, y = (sf.dy - cam.y) * z + hh;
        if (to) { const col = empCol(sf.owner); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(to.sx, to.sy); ctx.lineWidth = 2; ctx.strokeStyle = rgba(col, 0.85); ctx.setLineDash([7, 5]); ctx.lineDashOffset = -t * 18; ctx.stroke(); ctx.setLineDash([]); ring(to.sx, to.sy, to.r * 2.4 + 6, col, 0.7, 1.4, [3, 4], t * 5); }
      }
      // hovered moving fleet: its lane
      if (hoverFleet !== null && hoverFleet !== selFleet) {
        const fd = FD.get(hoverFleet);
        if (fd && fd.f.to >= 0 && hoverGrp === null) { const to = sdById[fd.f.to]; if (to) { const x = (fd.dx - cam.x) * z + hw, y = (fd.dy - cam.y) * z + hh; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(to.sx, to.sy); ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(empCol(fd.owner), 0.8); ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 14; ctx.stroke(); ctx.setLineDash([]); } }
      }
      // route preview (supplied by the screen) or the built-in one while choosing a destination
      if (routePrev && sdById[routePrev.to]) {
        const a = routePrev.from !== undefined && routePrev.from !== null ? sdById[routePrev.from] : null, b = sdById[routePrev.to];
        if (a) { const pc = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / pcU); const txt = routePrev.valid === false ? (routePrev.reason || 'Out of range') : (pc + ' pc' + (routePrev.eta ? ' · ETA ' + routePrev.eta + ' ' + plural(routePrev.eta, 'turn') : '')); drawRoute(a.sx, a.sy, b.sx, b.sy, routePrev.valid !== false, txt); }
      } else if (routeFleet !== null && hoverStar !== null) {
        const fd = FD.get(routeFleet), b = sdById[hoverStar];
        if (fd && b) {
          const x = (fd.dx - cam.x) * z + hw, y = (fd.dy - cam.y) * z + hh, pc = Math.ceil(Math.hypot(b.x - fd.dx, b.y - fd.dy) / pcU);
          let info = { eta: Math.max(1, Math.ceil(pc / Math.max(0.5, fd.f.speed || 1))), valid: true }; if (opts.routeInfo) { try { info = Object.assign(info, opts.routeInfo(fd.f, b.id) || {}); } catch (e) { /* ignore */ } }
          drawRoute(x, y, b.sx, b.sy, info.valid !== false, info.valid === false ? (info.reason || 'Cannot reach') : pc + ' pc · ETA ' + info.eta + ' ' + plural(info.eta, 'turn'));
        }
      }
      // reticles
      if (selStar !== null) { const s = sdById[selStar]; if (s && s.on) { drawBrackets(s.sx, s.sy, s.r * 2.3 + (s.owner >= 0 ? 9 : 5), t, 1, th.rgb.brassHi, selT); ring(s.sx, s.sy, s.r * 2.3 + (s.owner >= 0 ? 17 : 13), th.rgb.brassHi, 0.3, 1, [2, 6], -t * 9); } }
      if (hoverStar !== null && hoverStar !== selStar) {
        const s = sdById[hoverStar]; if (s && s.on) { const e = easeOut(clamp(hoverT / 0.16, 0, 1)); ring(s.sx, s.sy, (s.r * 2 + 6 + (s.owner >= 0 ? 6 : 0)) * (0.7 + 0.3 * e), th.rgb.cyan, 0.9 * e, 1.5); }
      }
      selT += dt; hoverT += dt;
    }
    function drawHud(t) {
      if (opts.hud === false) return;
      const pcPx = cam.z * pcU; let L = 1;
      for (const c of [1, 2, 5, 10, 20, 50, 100]) { L = c; if (c * pcPx >= 64) break; }
      const len = L * pcPx, x = 16 * uk + 2, y = H - 15 * uk, tk = 5 * uk;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,5,18,0.75)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.moveTo(x, y - tk); ctx.lineTo(x, y + tk); ctx.moveTo(x + len, y - tk); ctx.lineTo(x + len, y + tk); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = th.brassHi; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.moveTo(x, y - tk); ctx.lineTo(x, y + tk); ctx.moveTo(x + len, y - tk); ctx.lineTo(x + len, y + tk); ctx.moveTo(x + len / 2, y - tk * 0.5); ctx.lineTo(x + len / 2, y); ctx.stroke();
      ctx.font = Math.round(10.5 * uk) + 'px ' + th.fontUi; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,5,18,0.85)'; const lt = L + ' pc'; ctx.strokeText(lt, x + len + 7, y + 3.5); ctx.fillStyle = th.brassHi; ctx.fillText(lt, x + len + 7, y + 3.5);
    }

    // ================================================================== legend (Map Key), tooltips
    let legendForce = null;
    function buildLegend() {
      dirty.legend = false;
      const emps = (S && S.empires) || [], pid = pidOf();
      const row = (cls, col, text, sub, n) => h('div.gl-row' + (n === 0 ? '.dim' : ''), h('i.gl-sw' + cls, { style: { '--c': col } }), h('span.gl-txt', text, sub ? h('span.gl-sub', sub) : null), n !== undefined && n !== null ? h('span.gl-n', String(n)) : null);
      const kids = []; let sub = '';
      const total = SD.length, unknown = SD.filter(s => !s.known).length;
      if (mode === 'colonies') {
        sub = 'Colonies';
        const per = {}; for (const s of SD) if (s.owner >= 0) per[s.owner] = (per[s.owner] || 0) + 1;
        Object.keys(per).map(Number).sort((a, b) => (a === pid ? -1 : b === pid ? 1 : a - b)).forEach(id => {
          const E = emps[id] || {}; kids.push(row('', empHex(id), (E.name || E.race || 'Empire ' + id) + (id === pid ? ' (you)' : ''), '', per[id]));
        });
        const free = SD.filter(s => s.owner < 0 && s.known).length;
        kids.push(h('div.gl-sep')); kids.push(row('.dot', '#c9d4ff', 'Free stars', 'known, no colony', free)); kids.push(row('.dot.hollow', '#7b89bd', 'Unexplored', '', SD.filter(s => !s.known).length));
        kids.push(row('', '#ffd86a', 'Capital', 'banner with gold star', SD.filter(s => s.capital).length));
      } else if (mode === 'environments') {
        sub = 'Environments';
        const cnt = new Array(ENV.length).fill(0); for (const s of SD) if (s.known && s.env >= 0) cnt[clamp(s.env, 0, ENV.length - 1)]++;
        for (let i = ENV.length - 1; i >= 0; i--) kids.push(row(i === 0 ? '.hollow' : '', ENV[i].col, ENV[i].name, ENV[i].sub, cnt[i]));
        kids.push(h('div.gl-sep')); kids.push(row('.dot.hollow', '#7b89bd', 'Not yet explored', 'planet unknown', unknown));
      } else if (mode === 'minerals') {
        sub = 'Minerals';
        const cnt = new Array(MINERALS.length).fill(0); for (const s of SD) if (s.known && s.min >= 0) cnt[clamp(s.min, 0, MINERALS.length - 1)]++;
        for (const i of [4, 3, 2, 1, 0]) kids.push(row('', MINERALS[i].col, MINERALS[i].name, '', cnt[i]));
        kids.push(h('div.gl-sep')); kids.push(row('', MINERALS[5].col, MINERALS[5].name, 'bonus research', cnt[5])); kids.push(row('', MINERALS[6].col, MINERALS[6].name, 'the Ancients’ system', cnt[6]));
        kids.push(row('.dot.hollow', '#7b89bd', 'Not yet explored', '', unknown));
      } else {
        sub = 'Chart';
        const cnt = {}; for (const s of SD) cnt[s.kind] = (cnt[s.kind] || 0) + 1;
        for (const k of KIND_ORDER) { const d = KINDS[k]; kids.push(row('.dot', 'rgb(' + d.mid.map(Math.round).join(',') + ')', d.name, '', cnt[k] || 0)); }
        kids.push(h('div.gl-sep'));
        kids.push(row('.dot.hollow', '#7b89bd', 'Unexplored', 'planet unknown', SD.filter(s => !s.known).length));
        kids.push(row('.dot.hollow', '#bb82ff', 'Nebula', 'ships slow, shields fail', SD.filter(s => s.nebula).length));
        kids.push(row('', th.brass, 'Colony', 'flag + population pips', SD.filter(s => s.owner >= 0).length));
      }
      UI.mount(legendEl, h('div.gl-h', 'Map Key', h('small', sub + ' · ' + total + ' stars')), kids);
      legendEl.classList.toggle('off', !(legendForce === null ? (opts.legend === 'always' || (opts.legend !== false && mode !== 'normal')) : legendForce));
      if (opts.legend === false && legendEl.parentNode === root) root.removeChild(legendEl);
    }
    function distToMine(s) { let d = Infinity; for (const o of SD) if (o.mine) d = Math.min(d, Math.hypot(o.x - s.x, o.y - s.y)); return d === Infinity ? null : Math.ceil(d / pcU); }
    const MIN_TXT = { ultrapoor: 'ultra-poor minerals', poor: 'poor minerals', normal: 'normal minerals', rich: 'rich minerals', ultrarich: 'ultra-rich minerals', artifacts: 'ancient artifacts', orion: 'the Orion Ancients' };
    function starTip(s) {
      const kd = KINDS[s.vkind] || KINDS.unknown, pl = s.pl, E = s.owner >= 0 ? ((S.empires || [])[s.owner] || {}) : null;
      const kindTxt = kd.name + (s.known ? '' : ' · unexplored'), name = (!s.known && !s.orion) ? 'Unexplored star' : s.name;
      let out = '<div class="gt-h"><span>' + esc(name) + '</span><span class="gt-k"><i style="--c:rgb(' + kd.mid.map(Math.round).join(',') + ')"></i>' + esc(kindTxt) + '</span></div>';
      if (s.known && pl) {
        if (pl.type === 'none') out += '<div class="gt-r gt-d">No planet in this system</div>';
        else {
          out += '<div class="gt-r"><b>' + esc(TYPE_NAME[pl.type] || cap(pl.type)) + '</b> world · max pop <b>' + (pl.maxPop || 0) + '</b></div>';
          out += '<div class="gt-r">' + esc(cap(MIN_TXT[pl.special] || pl.special || 'normal minerals')) + (pl.rocks && pl.rocks !== 'none' ? ' · ' + pl.rocks + ' asteroids' : '') + '</div>';
          if (pl.growth === 'hostile') out += '<div class="gt-r gt-w">Hostile environment: growth halved</div>';
          else if (pl.growth === 'fertile') out += '<div class="gt-r" style="color:var(--leaf)">Fertile soil: growth bonus</div>';
          else if (pl.growth === 'gaia') out += '<div class="gt-r" style="color:var(--teal)">Gaia: ideal for any race</div>';
        }
        if (s.orion) out += '<div class="gt-r gt-v">The Orion system' + (s.guard ? ' · guarded by a Guardian' : '') + '</div>';
        else if (pl.special === 'artifacts') out += '<div class="gt-r gt-v">Ancient artifacts: boosts research</div>';
      } else { out += '<div class="gt-r gt-d">Not yet explored. Send a ship to survey it.</div>'; if (s.orion) out += '<div class="gt-r gt-v">The Orion system</div>'; }
      if (E) out += '<div class="gt-r"><i class="sw" style="--c:' + empHex(s.owner) + '"></i><b>' + esc(E.name || E.race || 'Empire') + '</b>' + (s.capital ? ' · capital' : '') + (s.known ? ' · pop <b>' + Math.round(s.pop) + '</b>/' + s.maxPop : '') + (s.stale ? ' <span class="gt-d">(last report)</span>' : '') + '</div>';
      if (s.nebula) out += '<div class="gt-r gt-v">Inside a nebula: ships slow, shields fail</div>';
      if (!s.mine) { const d = distToMine(s); if (d !== null) out += '<div class="gt-r gt-d">' + d + ' pc from your nearest colony</div>'; }
      return out;
    }
    function fleetTip(fd, grp) {
      const list = grp ? grp.list : [fd], pid = pidOf(), E = (S.empires || [])[fd.owner] || {};
      let out = '', ships = 0; for (const x of list) ships += x.nsh;
      if (list.length === 1) {
        const f = fd.f, to = f.to >= 0 ? sdById[f.to] : null, at = f.star >= 0 ? sdById[f.star] : null;
        out += '<div class="gt-h"><span>' + esc(FLEET_KIND[f.kind] || 'Fleet') + '</span><span class="gt-k">#' + f.id + '</span></div>';
        out += '<div class="gt-r"><i class="sw" style="--c:' + empHex(fd.owner) + '"></i><b>' + esc(E.name || E.race || 'Empire') + '</b>' + (fd.owner === pid ? ' (you)' : '') + ' · ' + ships + ' ' + plural(ships, 'ship') + '</div>';
        if (to && f.eta > 0) out += '<div class="gt-r">Heading to <b>' + esc(to.known || fd.owner === pid ? to.name : 'unknown space') + '</b> · ETA <b>' + f.eta + '</b> ' + plural(f.eta, 'turn') + '</div>';
        else if (at) out += '<div class="gt-r gt-d">' + (f.arrived ? 'Just arrived at ' : 'Stationed at ') + esc(at.known ? at.name : 'an unknown star') + '</div>';
        if (f.speed) out += '<div class="gt-r gt-d">Speed ' + f.speed + ' pc/turn</div>';
      } else {
        out += '<div class="gt-h"><span>' + list.length + ' fleets</span><span class="gt-k">' + ships + ' ' + plural(ships, 'ship') + '</span></div>';
        out += '<div class="gt-r"><i class="sw" style="--c:' + empHex(fd.owner) + '"></i><b>' + esc(E.name || E.race || 'Empire') + '</b>' + (fd.owner === pid ? ' (you)' : '') + '</div>';
        for (const x of list.slice(0, 6)) out += '<div class="gt-r gt-d">#' + x.id + ' · ' + esc(FLEET_KIND[x.f.kind] || 'Fleet') + ' · ' + x.nsh + ' ' + plural(x.nsh, 'ship') + '</div>';
        if (list.length > 6) out += '<div class="gt-r gt-d">… and ' + (list.length - 6) + ' more</div>';
        out += '<div class="gt-r gt-d">Click again to cycle through them</div>';
      }
      return out;
    }
    function refreshTip() {
      if (opts.tooltips === false || !S) return;
      let key = '';
      if (hoverFleet !== null) key = 'f' + hoverFleet + (hoverGrp ? 'g' + hoverGrp.list.length : '');
      else if (hoverStar !== null) key = 's' + hoverStar;
      else if (hoverNeb >= 0) key = 'n' + hoverNeb;
      if (!key || ptr.moved) { hideTip(); return; }
      if (key === tipKey) return;
      tipKey = key; let html = '';
      if (hoverFleet !== null) { const fd = FD.get(hoverFleet); if (fd) html = fleetTip(fd, hoverGrp); }
      else if (hoverStar !== null) { const s = sdById[hoverStar]; if (s) html = starTip(s); }
      else html = '<div class="gt-h"><span>Nebula</span><span class="gt-k"><i style="--c:#b27cff"></i>hazard</span></div><div class="gt-r gt-v">Ships travel slowly and shields do not work inside a nebula.</div>';
      if (!html) { hideTip(); return; }
      tipEl.innerHTML = html; tipEl.style.display = 'block'; placeTip(ptr.x, ptr.y);
    }
    function placeTip(x, y) {
      if (tipEl.style.display !== 'block') return;
      const w = tipEl.offsetWidth, hh = tipEl.offsetHeight; let l = x + 18, t = y + 20;
      if (l + w > W - 6) l = x - w - 14; if (t + hh > H - 6) t = y - hh - 14;
      tipEl.style.transform = 'translate(' + Math.round(Math.max(4, l)) + 'px,' + Math.round(Math.max(4, t)) + 'px)';
    }
    function hideTip() { if (tipEl.style.display !== 'none') tipEl.style.display = 'none'; tipKey = ''; }

    // ================================================================== minimap
    let miniOn = false, miniW = 0, miniH = 0, miniStatic = null, miniDown = false, miniCorner = 'br', miniSize = 0;
    function layoutMini() {
      const mm = opts.minimap, want = mm === false ? false : (mm === true || (mm && typeof mm === 'object')) ? true : SD.length >= 50;
      miniCorner = mm && mm.corner || 'br';
      const base = (mm && mm.size) || clamp(W * 0.17, 150, 250);
      let w = Math.round(Math.min(base, W * 0.3)), hh = Math.round(w * gh / gw);
      if (hh > H * 0.34) { hh = Math.round(H * 0.34); w = Math.round(hh * gw / gh); }
      miniOn = !!want && w >= 60 && hh >= 40; miniEl.style.display = miniOn ? 'block' : 'none';
      if (!miniOn) return;
      miniW = w; miniH = hh; const m = '0.75rem';
      miniEl.style.right = miniEl.style.left = miniEl.style.top = miniEl.style.bottom = 'auto';
      if (miniCorner[1] === 'r') miniEl.style.right = m; else miniEl.style.left = m;
      if (miniCorner[0] === 'b') miniEl.style.bottom = '2.7rem'; else miniEl.style.top = '4.4rem';
      miniCv.style.width = miniW + 'px'; miniCv.style.height = miniH + 'px';
      const bw = Math.round(miniW * dpr), bh = Math.round(miniH * dpr); if (miniCv.width !== bw || miniCv.height !== bh) { miniCv.width = bw; miniCv.height = bh; }
      dirty.mini = true;
    }
    function buildMiniStatic() {
      dirty.mini = false;
      const c = miniStatic && miniStatic.width === miniCv.width && miniStatic.height === miniCv.height ? miniStatic : (miniStatic = mk(miniCv.width, miniCv.height)), g = c.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, miniW, miniH);
      const sx = miniW / gw, sy = miniH / gh;
      g.fillStyle = 'rgba(8,13,38,0.9)'; g.fillRect(0, 0, miniW, miniH);
      g.globalCompositeOperation = 'lighter';
      if (terr) { g.globalAlpha = 0.95; g.drawImage(terr.canvas, terr.x0 * sx, terr.y0 * sy, terr.w * sx, terr.h * sy); }
      for (const n of gnebs) { g.globalAlpha = 0.8; g.drawImage(n.canvas, n.x0 * sx, n.y0 * sy, n.w * sx, n.h * sy); }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      for (const s of SD) {
        const x = s.x * sx, y = s.y * sy;
        if (s.owner >= 0) { const col = empCol(s.owner); g.fillStyle = rgba(col, 1); if (s.capital) { pathDiamond(g, x, y, 3.2); g.fill(); g.strokeStyle = 'rgba(255,225,140,0.95)'; g.lineWidth = 0.9; g.stroke(); } else g.fillRect(x - 1.3, y - 1.3, 2.6, 2.6); }
        else { const d = KINDS[s.vkind] || KINDS.unknown; g.fillStyle = rgba(d.mid, s.live ? 0.85 : s.known ? 0.65 : 0.3); g.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
      }
      const pid = pidOf();
      for (const fd of FD.values()) { if (!fd.vis) continue; const x = fd.tx * sx, y = fd.ty * sy; g.fillStyle = fd.owner === pid ? 'rgba(255,255,255,0.95)' : rgba(empCol(fd.owner), 0.9); g.fillRect(x - 1, y - 1, 2, 2); }
    }
    function drawMini() {
      if (!miniOn || !S) return;
      if (dirty.mini || !miniStatic) buildMiniStatic();
      const g = miniCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, miniW, miniH); g.drawImage(miniStatic, 0, 0, miniW, miniH);
      const sx = miniW / gw, sy = miniH / gh;
      const x0 = clamp(view.x0 * sx, 0, miniW), y0 = clamp(view.y0 * sy, 0, miniH), x1 = clamp(view.x1 * sx, 0, miniW), y1 = clamp(view.y1 * sy, 0, miniH);
      g.fillStyle = 'rgba(243,220,160,0.08)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.lineWidth = 1; g.strokeStyle = 'rgba(243,220,160,0.95)'; g.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.max(2, Math.round(x1 - x0)), Math.max(2, Math.round(y1 - y0)));
      if (selStar !== null) { const s = sdById[selStar]; if (s) { const p = 0.5 + 0.5 * Math.sin(clock * 4); g.strokeStyle = 'rgba(243,220,160,' + (0.5 + 0.4 * p) + ')'; g.lineWidth = 1; g.beginPath(); g.arc(s.x * sx, s.y * sy, 3.5 + p * 2, 0, TAU); g.stroke(); } }
      // frame ticks
      g.strokeStyle = 'rgba(214,179,106,0.5)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, miniW - 1, miniH - 1);
    }
    function miniJump(e, drag) {
      const r = miniCv.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width, 0, 1) * gw, y = clamp((e.clientY - r.top) / r.height, 0, 1) * gh;
      if (drag) setCamNow(x, y, cam.z); else flyTo(x, y, cam.z, true, 0.38);
    }
    miniCv.addEventListener('pointerdown', e => { miniDown = true; try { miniCv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } miniJump(e, false); e.preventDefault(); e.stopPropagation(); });
    miniCv.addEventListener('pointermove', e => { if (miniDown) { if (flight) cancelFlight(); miniJump(e, true); } });
    miniCv.addEventListener('pointerup', () => { miniDown = false; }); miniCv.addEventListener('pointercancel', () => { miniDown = false; });
    miniCv.addEventListener('wheel', e => { e.preventDefault(); zoomStep(Math.pow(1.0017, -e.deltaY)); }, { passive: false });
    miniEl.addEventListener('pointerdown', e => e.stopPropagation());

    // ================================================================== frame loop
    function fitCv() {
      let r;
      try { r = UI.fitCanvas ? UI.fitCanvas(canvas, { maxDpr: Q.dpr, ctxOpts: { alpha: false } }) : null; } catch (e) { return null; }
      if (!r || r.w < 48 || r.h < 48) return null;
      ctx = r.ctx;
      if (r.w !== W || r.h !== H || r.dpr !== dpr || sizeDirty) { const atFit = W > 0 && Math.abs(cam.z / fitZ - 1) < 0.03; W = r.w; H = r.h; dpr = r.dpr; sizeDirty = false; onSize(atFit); }
      return r;
    }
    function onSize(atFit) {
      let rem = 16; try { rem = parseFloat(getComputedStyle(doc.documentElement).fontSize) || 16; } catch (e) { /* ignore */ }
      uk = clamp(rem / 16, 0.85, 1.35);
      computeFit();
      if (pendingCmd) { const c = pendingCmd; pendingCmd = null; pendingView = null; c(); }
      else if (S && pendingView !== null) applyInitialView();
      else if (atFit) { setCamNow(gw / 2, gh / 2, fitZ); }
      else { clampTo(cam); clampTo(tgt); }
      layoutMini();
    }
    function render(dt, t) {
      const pf = stats.profile, prof = stats.passes; let tp = pf ? performance.now() : 0;
      const lap = k => { if (pf) { const n = performance.now(); prof[k] = (prof[k] || 0) * 0.92 + (n - tp) * 0.08; tp = n; } };
      view.x0 = cam.x - W / 2 / cam.z; view.x1 = cam.x + W / 2 / cam.z; view.y0 = cam.y - H / 2 / cam.z; view.y1 = cam.y + H / 2 / cam.z;
      if (modeT < 1) modeT = Math.min(1, modeT + dt / 0.4);
      const wm = m => (mode === m ? easeOut(modeT) : prevMode === m ? 1 - easeOut(modeT) : 0);
      wCol = wm('colonies'); wEnv = wm('environments'); wMin = wm('minerals');
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (!S) { drawBackdrop(t); return; }
      lap('head');
      if (dirty.terr) rebuildTerritory();
      if (dirty.neb) rebuildNebulae();
      lap('rebuild');
      computeScreen(t, dt); updateFleets(dt); updateHover(); lap('update');
      drawBackdrop(t); lap('backdrop'); drawNebulae(t); lap('nebulae'); drawBounds(); lap('bounds'); drawTerritory(t); lap('territory'); drawGrid(t); lap('grid'); drawRanges(t); drawLanes(t); lap('lanes');
      drawStarsPass(t, dt); lap('stars'); drawSystems(t); lap('systems'); drawLabels(t, dt); lap('labels'); drawFleets(t); lap('fleets'); drawOverlays(t, dt); drawHud(t); lap('overlays');
      drawMini(); lap('mini');
      if (dirty.legend) buildLegend();
      lap('legend');
      if (Math.abs(cam.x - lastEmit.x) > 0.01 || Math.abs(cam.y - lastEmit.y) > 0.01 || Math.abs(cam.z / lastEmit.z - 1) > 0.0005) { lastEmit.x = cam.x; lastEmit.y = cam.y; lastEmit.z = cam.z; emit('cameraChanged', camInfo()); }
    }
    function frame(dtRaw) { frameImpl(dtRaw, false); }
    function frameImpl(dtRaw, force) {
      if (destroyed || !root.isConnected || (doc.hidden && !force)) return;
      const tf0 = performance.now();
      readQuality();
      accDt += dtRaw;
      if (Q.fps < 55 && accDt < 1 / Q.fps - 0.002) return;
      const dt = Math.min(0.1, accDt); accDt = 0;
      if (!fitCv()) return;
      if (S && pendingView !== null) applyInitialView();
      queueWarmup();
      const t0 = performance.now();
      clock += dt; updateCamera(dt);
      const t1 = performance.now();
      render(dt, clock);
      const t2 = performance.now();
      if (!flight && !ptr.moved && (t2 - t0) < 6) pumpWarmup();
      stats.renderMs += (t2 - t0 - stats.renderMs) * 0.08;
      if (stats.profile) { stats.passes.cam = (stats.passes.cam || 0) * 0.92 + (t1 - t0) * 0.08; stats.passes.render = (stats.passes.render || 0) * 0.92 + (t2 - t1) * 0.08; stats.passes.pre = (stats.passes.pre || 0) * 0.92 + (t0 - tf0) * 0.08; }
    }
    const stats = { renderMs: 0, profile: false, passes: {} };
    const camInfo = () => ({ x: cam.x, y: cam.y, zoom: cam.z / fitZ, pxPerUnit: cam.z, minZoom: minZ / fitZ, maxZoom: maxZ / fitZ, view: { x0: view.x0, y0: view.y0, x1: view.x1, y1: view.y1 } });
    let stopFrame = null;
    if (UI.onFrame) { stopFrame = UI.onFrame(frame); if (UI.startLoop) UI.startLoop(); }
    else { let raf = 0, last = performance.now(); const loop = ts => { frame(Math.min(0.1, (ts - last) / 1000)); last = ts; raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); stopFrame = () => cancelAnimationFrame(raf); }
    const stopWatch = UI.watchSize ? UI.watchSize(root, () => { sizeDirty = true; }) : null;
    const stopBus = M.Bus && M.Bus.on ? M.Bus.on('settings', () => { dirty.legend = true; }) : null;

    // ================================================================== public API
    const api = {
      el: root, canvas,
      setState(state) {
        const same = state === S; S = state || null;
        if (!S) { SD.length = 0; sdById.length = 0; FD.clear(); groups.length = 0; movers.length = 0; terr = null; gnebs = []; dirty.legend = dirty.mini = true; return api; }
        if (!same) { FD.clear(); pings.length = 0; selStar = selFleet = null; routePrev = null; setRouteMode(null); }
        readGalaxy(); derive(); deriveFleets(!same); if (W) computeFit(); return api;
      },
      refresh() { if (!S) return api; readGalaxy(); derive(); deriveFleets(false); return api; },
      setMode(m) { if (MODES.indexOf(m) < 0 || m === mode) return api; prevMode = mode; mode = m; modeT = 0; dirty.legend = true; return api; },
      getMode: () => mode,
      select(id, o) { const ok = id === null || id === undefined ? null : (sdById[id] ? id : null); setSelStar(ok, !!(o && o.emit)); if (ok !== null && o && o.center) api.centerOn(ok, { animate: true }); return api; },
      selectFleet(id, o) { const ok = id === null || id === undefined ? null : (FD.has(id) ? id : null); setSelFleet(ok, !!(o && o.emit)); if (ok !== null && o && o.center) { const fd = FD.get(ok); api.centerOn({ x: fd.tx, y: fd.ty }, { animate: true }); } return api; },
      getSelection: () => ({ star: selStar, fleet: selFleet }),
      centerOn(target, o) {
        o = o || {}; let x, y;
        if (typeof target === 'number') { const s = sdById[target]; if (!s) return api; x = s.x; y = s.y; } else if (target && typeof target.x === 'number') { x = target.x; y = target.y; } else return api;
        if (!W) { pendingCmd = () => api.centerOn(target, Object.assign({}, o, { animate: false })); return api; }       // not laid out yet: apply on the first frame
        pendingView = null; const z = o.zoom ? o.zoom * fitZ : (camSet ? cam.z : clamp(Math.max(W / 200, fitZ * 1.4), minZ, maxZ)); flyTo(x, y, z, camSet && o.animate !== false); return api;
      },
      fit(o) { if (!W) { pendingCmd = () => api.fit({ animate: false }); return api; } pendingView = null; flyTo(gw / 2, gh / 2, fitZ, !(o && o.animate === false)); return api; },
      home(o) { if (!W) { pendingCmd = () => api.home({ animate: false }); return api; } pendingView = null; const c = capitalStar(); if (!c) return api.fit(o); flyTo(c.x, c.y, clamp(Math.max(W / 200, fitZ * 1.4), minZ, maxZ), !(o && o.animate === false)); return api; },
      setRoutePreview(p) { routePrev = p ? { from: p.from, to: p.to, eta: p.eta, valid: p.valid !== false, reason: p.reason } : null; return api; },
      beginRoute(fid) { if (!FD.has(fid)) return api; if (selFleet !== fid) setSelFleet(fid, false); setRouteMode(fid); return api; },
      endRoute() { setRouteMode(null); return api; },
      highlightStars(ids, o) { hiSpec = ids && ids.length ? { ids: ids.slice(), col: o && o.color ? hex(o.color) : null } : null; return api; },
      setRanges(spec) { rangesSpec = spec && spec.stars && spec.stars.length ? { stars: spec.stars.slice(), radius: spec.radius || 0, col: spec.color ? hex(spec.color) : null } : null; return api; },
      setFog(b) { fog = !!b; if (S) { derive(); deriveFleets(false); } return api; },
      getFog: () => fog,
      legend: () => legendEl,
      showLegend(b) { legendForce = b === undefined ? null : !!b; dirty.legend = true; return api; },
      getCamera: camInfo,
      worldToScreen: (x, y) => ({ x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 }),
      screenToWorld: (px, py) => ({ x: cam.x + (px - W / 2) / cam.z, y: cam.y + (py - H / 2) / cam.z }),
      starAt(px, py) { const p = pick(px, py); return p.sd ? p.sd.id : null; },
      resize() { sizeDirty = true; return api; },
      getStats: () => stats,
      profile(on) { stats.profile = on !== false; return api; },
      tick(dt, n) { for (let i = 0; i < (n || 1); i++) frameImpl(dt || 1 / 60, true); return api; },      // advance the animation by hand (tests / hidden tabs)
      _dbg: () => ({ terr, gnebs, SD, FD, groups, movers, cam, tgt, Q, amb, W, H, dpr, fitZ, uk, mode, wCol, wEnv, wMin }),
      on, off,
      destroy() {
        if (destroyed) return; destroyed = true;
        try { if (stopFrame) stopFrame(); if (stopWatch) stopWatch(); if (stopBus) stopBus(); } catch (e) { /* ignore */ }
        window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', onBlur);
        if (root.parentNode) root.parentNode.removeChild(root);
        for (const k in handlers) delete handlers[k];
      },
    };
    if (opts.legend === false) { /* still updated; not embedded */ legendEl.parentNode && legendEl.parentNode.removeChild(legendEl); }
    if (opts.state) api.setState(opts.state);
    return api;
  }

  UI.GalaxyMap = { create, KINDS, ENV, MINERALS, PC: PC_DEFAULT, VERSION: '1.0' };
})(window.MOO);
