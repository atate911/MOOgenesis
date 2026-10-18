// Tactical combat renderer + animation director (MOO.UI.CombatFx) — the "view" half of the combat screen (js/ui/combat.js is the controller).
//
//   const view = UI.CombatFx.createView(canvas)
//   view.load({B, battle, S})        start a battle: builds the display units / planet / rocks / backdrop from the engine state B (Sim.Combat.create)
//   view.sync(B)                     snap the display state to the engine state (call when no animation is running)
//   view.play(events) → Promise      animate an events[] list returned by Combat.act / endRound / aiTurn (in order, at Settings.animSpeed; resolves when done)
//   view.skip()                      finish the running animation instantly       view.setSpeed(0|1|2)   0 = instant
//   view.resize()                    refit the canvas (call after layout changes)  view.frame(dt, t)   per-frame update + draw
//   view.setActive(id)               unit with the selection frame               view.setHighlights({moves:[{x,y,cost,tele}], targets:[{id,hit}], hover:{x,y}|null, path:bool})
//   view.cellAt(clientX, clientY) → {x,y}|null     view.cellRect(x,y) → {x,y,w,h} in CSS px of the canvas        view.unitAtCell(x,y) → display unit | null
//   view.banner(text, sub, color)    big centred caption       view.floatText(cellX, cellY, text, color, size)       view.shake(v)
// Everything is event-sourced: the engine mutates B immediately, the view replays the events so numbers, bars and positions lag behind B exactly as long as the
// animation runs; view.sync(B) then snaps to the truth, so a missed/unknown event can never leave the screen wrong.
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Gfx || {};
  const PI = Math.PI, TAU = PI * 2;
  const abs = Math.abs, min = Math.min, max = Math.max, sin = Math.sin, cos = Math.cos, atan2 = Math.atan2, sqrt = Math.sqrt, hypot = Math.hypot, floor = Math.floor, round = Math.round;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const NO = {};

  const FONT_UI = '"IBM Plex Sans Condensed","Bahnschrift SemiCondensed","Bahnschrift","Segoe UI",system-ui,sans-serif';
  const V2 = document.documentElement.getAttribute('data-theme') === 'v2';          // v2: steel instead of brass, technical display face
  const BR = V2 ? '142,164,186' : '214,179,106', BH = V2 ? '210,224,236' : '243,220,160';
  const FONT_DISP = V2 ? '"Oxanium","Saira Semi Condensed","Bahnschrift SemiBold","Bahnschrift","DIN Condensed","Segoe UI Semibold",system-ui,sans-serif' : '"Marcellus SC","Marcellus","Palatino Linotype","Book Antiqua",Georgia,serif';
  const EMP = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];
  const MON = { guardian: '#ffb347', crystal: '#79e8ff', amoeba: '#9dff6a' };
  const C = { brass: V2 ? '#8ea4ba' : '#d6b36a', brassHi: V2 ? '#d2e0ec' : '#f3dca0', brassLo: V2 ? '#46596c' : '#8a7040', cyan: '#62d8ff', rose: '#ff5c6a', ember: '#ff9440', leaf: '#5fdc8f', violet: '#a98bff', azure: '#5b8cff', ivory: '#ece6d3', mist: '#98a5cf', gold: '#ffd54f' };
  const HULL_LEN = [0.5, 0.64, 0.8, 0.98];                    // length of a Small / Medium / Large / Huge hull as a share of the base ship length

  // ---- weapon id → visual family ---------------------------------------------------------------------------------------------------------------------
  const BEAM_FX = {
    'laser': ['laser', 1], 'heavy-laser': ['laser', 1.5], 'gatling-laser': ['laser', 0.8],
    'mass-driver': ['mass', 1], 'gauss-autocannon': ['mass', 0.9], 'auto-blaster': ['mass', 1], 'pulse-phasor': ['mass', 1.1],
    'neutron-pellet-gun': ['neutron', 0.8], 'neutron-blaster': ['neutron', 1], 'heavy-blast-cannon': ['neutron', 1.5], 'megabolt-cannon': ['neutron', 1.1],
    'ion-cannon': ['phasor', 0.9], 'heavy-ion-cannon': ['phasor', 1.4], 'graviton-beam': ['phasor', 1], 'tachyon-beam': ['phasor', 1], 'phasor': ['phasor', 1],
    'heavy-phasor': ['phasor', 1.5], 'hard-beam': ['phasor', 1.1], 'particle-beam': ['phasor', 1.2],
    'fusion-beam': ['plasma', 0.8], 'heavy-fusion-beam': ['plasma', 1.2], 'plasma-cannon': ['plasma', 1], 'tri-focus-plasma-cannon': ['plasma', 1.5], 'mauler-device': ['plasma', 1.9],
    'disruptor': ['disruptor', 1.3], 'stellar-converter': ['disruptor', 1.9], 'crystal-ray': ['disruptor', 1.7], 'amoeba-stream': ['disruptor', 1.5],
    'death-ray': ['deathray', 1.3],
  };
  const MIS_FX = {
    'nuclear-missile': 'nuclear', 'hyper-v': 'hyperx', 'hyper-x': 'hyperx', 'scatter-pack-v': 'scatter', 'scatter-pack-vii': 'scatter', 'scatter-pack-x': 'scatter',
    'merculite': 'merculite', 'stinger': 'stinger', 'pulson': 'stinger', 'hercular': 'merculite', 'zeon': 'stinger',
    'anti-matter-torpedo': 'antimatter', 'hellfire-torpedo': 'antimatter', 'proton-torpedo': 'torpedo', 'plasma-torpedo': 'torpedo',
  };
  const MIS_COL = { nuclear: '#ffbe5a', hyperx: '#96d2ff', merculite: '#aaff64', scatter: '#ffa05a', stinger: '#ff6050', torpedo: '#8cc8ff', antimatter: '#d6a0ff' };
  const BEAM_COL = { laser: '#ff4e42', mass: '#ffd68c', neutron: '#8cff5c', phasor: '#5adeff', plasma: '#ff9230', disruptor: '#ba6cff', deathray: '#cea4ff' };
  const beamInfo = id => BEAM_FX[String(id || '').replace(/-5$/, '')] || ['laser', 1];
  const misKind = id => MIS_FX[String(id || '').replace(/-5$/, '')] || 'nuclear';

  // ---- tiny canvas helpers ------------------------------------------------------------------------------------------------------------------------------
  function mk(w, h) { const c = document.createElement('canvas'); c.width = max(1, w | 0); c.height = max(1, h | 0); return c; }
  function rng32(a) { a = a >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function chamfer(g, x, y, w, h, c) {
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
  }
  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || '');
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 220, 255];
  }
  function rgba(hex, a) { const c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  // soft glow dot (white core → colour → clear), one per colour
  const glowCache = new Map();
  function glowSprite(hex) {
    let c = glowCache.get(hex);
    if (c) return c;
    c = mk(64, 64);
    const g = c.getContext('2d'), rgb = hexRgb(hex), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.55)');
    gr.addColorStop(0.7, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.12)'); gr.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache.set(hex, c);
    return c;
  }

  // lumpy asteroid sprite (lit from the upper left), 3 variants, cached per size
  const rockCache = new Map();
  function rockSprite(variant, px, dpr) {
    const key = variant + '|' + px + '|' + dpr;
    let c = rockCache.get(key);
    if (c) return c;
    if (rockCache.size > 24) rockCache.clear();
    const S = max(8, Math.ceil(px * dpr));
    c = mk(S, S);
    const g = c.getContext('2d'), R = rng32(variant * 7919 + 101), cx = px / 2, cy = px / 2, r0 = px * 0.37, n = 13;
    g.scale(S / px, S / px);
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU + (R() - 0.5) * 0.28, r = r0 * (0.74 + R() * 0.42); pts.push([cx + cos(a) * r * (1 + (variant % 2) * 0.12), cy + sin(a) * r * (1 - (variant % 2) * 0.1)]); }
    const path = () => {
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (i === 0) g.moveTo((pts[n - 1][0] + a[0]) / 2, (pts[n - 1][1] + a[1]) / 2);
        g.quadraticCurveTo(a[0], a[1], mx, my);
      }
      g.closePath();
    };
    // contact shadow
    g.save(); g.translate(px * 0.04, px * 0.06); path(); g.fillStyle = 'rgba(0,0,8,0.4)'; g.filter = 'blur(' + (px * 0.03) + 'px)'; g.fill(); g.restore();
    g.filter = 'none';
    path();
    const body = g.createRadialGradient(cx - r0 * 0.45, cy - r0 * 0.5, r0 * 0.08, cx, cy, r0 * 1.4);   // darker, rock-brown, higher contrast (the fallback until the rock cutouts land)
    body.addColorStop(0, '#9c9190'); body.addColorStop(0.28, '#625a5c'); body.addColorStop(0.66, '#2d2a30'); body.addColorStop(1, '#0d0c12');
    g.fillStyle = body; g.fill();
    g.save(); path(); g.clip();
    for (let i = 0; i < 9; i++) {                                             // craters: shadowed bowl, lit far rim
      const a = R() * TAU, d = R() * r0 * 0.7, x = cx + cos(a) * d, y = cy + sin(a) * d, rr = r0 * (0.07 + R() * 0.16);
      const cg = g.createRadialGradient(x - rr * 0.25, y - rr * 0.25, rr * 0.05, x, y, rr);
      cg.addColorStop(0, 'rgba(6,5,10,0.7)'); cg.addColorStop(0.7, 'rgba(6,5,10,0.3)'); cg.addColorStop(0.92, 'rgba(255,240,225,0.22)'); cg.addColorStop(1, 'rgba(255,240,225,0)');
      g.fillStyle = cg; g.beginPath(); g.ellipse(x, y, rr, rr * 0.8, 0.4, 0, TAU); g.fill();
    }
    for (let i = 0; i < 110; i++) { g.fillStyle = 'rgba(' + (R() < 0.45 ? '255,240,225' : '0,0,0') + ',' + (0.04 + R() * 0.1).toFixed(3) + ')'; const s = 0.6 + R() * 1.8; g.fillRect(cx + (R() - 0.5) * r0 * 2, cy + (R() - 0.5) * r0 * 2, s, s); }
    const hi = g.createLinearGradient(cx - r0, cy - r0, cx + r0 * 0.3, cy + r0 * 0.3);
    hi.addColorStop(0, 'rgba(255,240,220,0.3)'); hi.addColorStop(0.5, 'rgba(255,240,220,0.02)'); hi.addColorStop(1, 'rgba(0,0,12,0.5)');
    g.fillStyle = hi; g.fillRect(0, 0, px, px);
    g.restore();
    path();
    const rim = g.createLinearGradient(cx - r0, cy - r0, cx + r0, cy + r0);
    rim.addColorStop(0, 'rgba(255,236,214,0.55)'); rim.addColorStop(0.5, 'rgba(255,255,255,0.03)'); rim.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.lineWidth = max(1, px * 0.012); g.strokeStyle = rim; g.stroke();
    rockCache.set(key, c);
    return c;
  }
  // rendered rock / debris / base cutouts (assets/art/fx/*, batch 4) — null until they exist, so every caller keeps its drawn sprite
  const WAfx = name => { const WA = G.WorldArt; if (!WA || !WA.enabled) return null; const p = WA.fx(name); return p ? WA.get(p) : null; };

  // orbital missile platform: a lit ring sprite (dark disc, bright rim, nav lights in the banner colour), cached per size + colour
  const baseCache = new Map();
  function baseSprite(px, color, dpr) {
    const key = px + '|' + color + '|' + dpr;
    let c = baseCache.get(key);
    if (c) return c;
    if (baseCache.size > 24) baseCache.clear();
    const S = max(8, Math.ceil(px * dpr));
    c = mk(S, S);
    const g = c.getContext('2d'), r = px * 0.44, cx = px / 2, cy = px / 2, rgb = hexRgb(color);
    g.scale(S / px, S / px);
    g.save(); g.filter = 'blur(' + (px * 0.05) + 'px)'; g.fillStyle = 'rgba(0,0,8,0.5)'; g.beginPath(); g.arc(cx + px * 0.04, cy + px * 0.06, r, 0, TAU); g.fill(); g.restore();
    const body = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r);
    body.addColorStop(0, '#6c747e'); body.addColorStop(0.55, '#2c3139'); body.addColorStop(1, '#0d1016');
    g.fillStyle = body; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) {                                              // silo covers
      const a = i / 6 * TAU + 0.3, x = cx + cos(a) * r * 0.55, y = cy + sin(a) * r * 0.55;
      g.fillStyle = 'rgba(8,10,16,0.7)'; g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(200,210,224,0.35)'; g.lineWidth = max(0.6, px * 0.01); g.stroke();
    }
    g.fillStyle = 'rgba(20,24,32,0.9)'; g.beginPath(); g.arc(cx, cy, r * 0.22, 0, TAU); g.fill();
    const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    rim.addColorStop(0, 'rgba(255,245,230,0.75)'); rim.addColorStop(0.5, 'rgba(180,200,220,0.12)'); rim.addColorStop(1, 'rgba(0,0,0,0.7)');
    g.lineWidth = max(1, px * 0.03); g.strokeStyle = rim; g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, 0, TAU); g.stroke();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {                                              // nav lights in the banner colour
      const a = i / 4 * TAU + 0.78, x = cx + cos(a) * r * 0.9, y = cy + sin(a) * r * 0.9, gr = g.createRadialGradient(x, y, 0, x, y, r * 0.2);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.25, 'rgba(' + rgb.join(',') + ',0.8)'); gr.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 0.2, 0, TAU); g.fill();
    }
    baseCache.set(key, c);
    return c;
  }
  const LIMB = { inferno: '#ff9a50', toxic: '#b0ff70', radiated: '#ffd070', desert: '#ffd9a0', arid: '#ffd9a0', steppe: '#f0e0b0', ocean: '#8fd0ff', terran: '#8fd0ff', jungle: '#9fe0b0', gaia: '#9fe0ff' };
  const limbColor = look => LIMB[look] || '#c8d8ff';

  // ==========================================================================================================================================================
  function createView(canvas) {
    const view = { canvas, fx: null, ready: false, speed: 1, B: null, S: null, battle: null };
    let ctx = null, W = 320, H = 200, dpr = 1;
    const grid = { x: 0, y: 0, w: 0, h: 0, cw: 32, ch: 24, base: 40 };
    let gridLayer = null, gridKey = '';
    let B = null, S = null, battle = null;
    let units = [], planetU = null, rocks = [], missiles = new Map(), order = [];
    let backdrop = { star: 'yellow', seed: 1, nebula: true, decor: null, key: '' }, star = { x: 60, y: 60 };
    let activeId = -1, moveCells = [], targetCells = [], hoverCell = null, showPath = false, targetMap = new Map();
    let roundNo = 0, bannerT = null, camT = 0;
    const nud = { x: 0, y: 0, t: 0 };                           // camera nudge on big hits (2–4 px for 120 ms; off with reduceMotion)
    const DEBRIS = [];                                          // kill debris: rendered cutouts when present (else the particle shards from Gfx.Fx), small fixed pool
    for (let i = 0; i < 24; i++) DEBRIS.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, age: 0, life: 1, s: 20, v: 1 });
    const reduceMotion = () => !!(M.Settings && M.Settings.get && M.Settings.get('reduceMotion'));
    function nudge(ang, amp) { if (reduceMotion()) return; nud.x = cos(ang) * amp; nud.y = sin(ang) * amp; nud.t = 0.12; }
    function spawnDebris(x, y, len) {
      if (!WAfx('debris-1')) return false;                     // no cutouts yet: the FX system's shards stand in
      let n = 0;
      for (const d of DEBRIS) {
        if (d.on) continue;
        const a = Math.random() * TAU, sp = len * (0.25 + Math.random() * 0.6);
        d.on = true; d.x = x; d.y = y; d.vx = cos(a) * sp; d.vy = sin(a) * sp; d.rot = Math.random() * TAU; d.vr = (Math.random() - 0.5) * 3; d.age = 0; d.life = 2.6 + Math.random() * 1.6; d.s = len * (0.06 + Math.random() * 0.07); d.v = 1 + ((Math.random() * 24) | 0);   // small fragments of the hull, any of the 24 wreckage cutouts
        if (++n >= 4) break;
      }
      return true;
    }
    const texts = [];                                           // floating numbers (small pool)
    for (let i = 0; i < 72; i++) texts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, txt: '', col: '#fff', size: 14, bold: true });
    let fx = null, spdOverride = null, inst = false, clock = 0;
    const sched = [], jobs = [];
    let job = null;

    view.makeFx = function () {
      fx = null;
      try { if (G.GLFx && G.GLFx.create) fx = G.GLFx.create(); } catch (e) { console.warn('[CombatFx] GLFx unavailable', e); fx = null; }
      if (!fx) { try { if (G.Fx && G.Fx.create) fx = G.Fx.create(); } catch (e) { fx = null; } }
      view.fx = fx;
      try { if (fx && fx.setQuality && M.Perf && M.Perf.q) fx.setQuality(clamp(M.Perf.q.particles, 0.3, 1)); } catch (e) { /* optional */ }
    };

    // ---- sizing / layout ------------------------------------------------------------------------------------------------------------------------------
    function resize() {
      const o = UI.fitCanvas(canvas, { maxDpr: (M.Perf && M.Perf.q && M.Perf.q.dpr) || 2 });
      ctx = o.ctx; W = o.w; H = o.h; dpr = o.dpr;
      layout();
      view.ready = true;
    }
    function layout() {
      const mx = max(16, W * 0.018), top = max(46, H * 0.082), bot = max(12, H * 0.026);
      let cw = (W - 2 * mx) / 10, ch = (H - top - bot) / 8;
      if (cw / ch > 1.72) cw = ch * 1.72; else if (cw / ch < 1.05) ch = cw / 1.05;
      grid.cw = cw; grid.ch = ch; grid.w = cw * 10; grid.h = ch * 8;
      grid.x = (W - grid.w) / 2; grid.y = top + (H - top - bot - grid.h) / 2;
      grid.base = min(cw * 0.94, ch * 1.5);
      for (const u of units) if (u) sizeUnit(u);
      gridKey = '';                                             // rebuild the cached grid layer
    }
    function sizeUnit(u) {
      if (u.kind === 'planet') { u.R = min(grid.ch * 0.8, grid.cw * 0.42); u.len = u.R * 2; return; }
      const mon = u.kind === 'monster';
      u.len = grid.base * (mon ? 1.55 : HULL_LEN[clamp(u.hull | 0, 0, 3)]);
      u.copies = u.count >= 40 ? 4 : u.count >= 10 ? 3 : u.count >= 2 ? 2 : 1;
      if (mon) u.copies = 1;
    }
    const cx = c => grid.x + (c + 0.5) * grid.cw;               // cell centre (cell coords may be fractional)
    const cy = c => grid.y + (c + 0.5) * grid.ch;
    view.cellRect = (x, y) => ({ x: grid.x + x * grid.cw, y: grid.y + y * grid.ch, w: grid.cw, h: grid.ch });
    view.cellAt = function (clientX, clientY) {
      const r = canvas.getBoundingClientRect(), px = clientX - r.left, py = clientY - r.top;
      const x = floor((px - grid.x) / grid.cw), y = floor((py - grid.y) / grid.ch);
      return x >= 0 && y >= 0 && x < 10 && y < 8 ? { x, y } : null;
    };
    view.cellToClient = function (x, y) { const r = canvas.getBoundingClientRect(); return { x: r.left + cx(x), y: r.top + cy(y), cw: grid.cw, ch: grid.ch }; };
    view.unitAtCell = function (x, y) {
      for (const u of units) { if (!u || u.gone || u.alpha < 0.05) continue; if (u.kind === 'planet' ? (u.x === x && u.y === y) : (round(u.x) === x && round(u.y) === y && u.count > 0)) return u; }
      return null;
    };
    view.unit = id => units[id] || null;

    // ---- loading a battle -------------------------------------------------------------------------------------------------------------------------------
    function unitFlags(bu) {
      const f = { beams: false, missiles: false, bomb: false, colony: false };
      for (const w of bu.weapons || []) { if (w.count <= 0) continue; if (w.kind === 'beam' || w.kind === 'special') f.beams = true; else if (w.kind === 'missile' || w.kind === 'torpedo') f.missiles = true; else if (w.kind === 'bomb' || w.kind === 'bio') f.bomb = true; }
      const side = battle && battle.sides && battle.sides[bu.side], d = side && side.designs && side.designs[bu.slot];
      if (d && d.colonyMin > 0) f.colony = true;
      return f;
    }
    function empireColor(side) {
      const e = S && S.empires && S.empires[side.empire];
      return EMP[(e ? e.color : (side.empire | 0)) % 6] || EMP[0];
    }
    function hpFrac(du) { return du.count0 > 0 && du.hp2 > 0 ? clamp(hpNow(du) / (du.hp2 * du.count0), 0, 1) : 0; }
    function hpNow(du) { return du.count > 0 ? (du.count - 1) * du.hp1 + max(0, du.hp1 - du.hploss) : 0; }
    function makeUnit(bu) {
      const side = B.sides[bu.side], monster = bu.kind === 'monster', mk_ = side.monster && side.monster.kind;
      const du = {
        id: bu.id, side: bu.side, kind: bu.kind, slot: bu.slot, hull: bu.hull, name: bu.name, empire: bu.empire,
        race: mk_ === 'crystal' ? 'silicoid' : mk_ === 'guardian' ? 'meklar' : side.race && side.race !== 'monster' ? side.race : 'sakkra',
        mkind: mk_ || '', color: monster ? (MON[mk_] || '#9dff6a') : empireColor(side), flags: unitFlags(bu),
        vkey: monster || bu.kind === 'planet' || !(G.Ships && G.Ships.designKey) ? '' : G.Ships.designKey(bu.empire, bu.slot, bu.name),   // art variant of this design
        x: bu.x, y: bu.y, tx: bu.x, ty: bu.y, count: bu.count, count0: bu.kind === 'planet' ? (B.planet ? B.planet.bases0 : bu.count) : (side.initial[bu.slot] | 0) || bu.count,
        hp1: bu.hp1, hp2: bu.hp2, hploss: bu.hploss, hpShown: 0, absorb: bu.absorb, shieldLvl: 0,
        alpha: 1, alphaT: 1, heading: bu.side === 0 ? 0 : PI, angle: bu.side === 0 ? 0 : PI, moveAng: 0, moving: false, idle: 1,
        flash: 0, shield: 0, cloak: 0, cloakT: 0, frozen: 0, frozenT: 0, warp: 0, warpT: 0, dying: 0, retreating: false, gone: false, tag: '', tagT: 0,
        len: 60, R: 0, copies: 1, copyOff: 0, seed: bu.id * 31 + 7, slotSel: bu.planetSlot | 0, bases0: bu.kind === 'planet' && B.planet ? B.planet.bases0 : 0,
        pop: B.planet && bu.kind === 'planet' ? B.planet.pop : 0, fac: B.planet && bu.kind === 'planet' ? B.planet.factories : 0, shieldGlow: 0,
      };
      du.hpShown = hpFrac(du);
      if (bu.kind === 'planet') {
        const pl = battle && battle.planet;
        du.shieldLvl = pl ? pl.shield | 0 : 0; du.planetDesc = planetDesc(pl); du.ownerName = side.name;
      }
      return du;
    }
    function planetDesc(pl) {
      let look = 'terran', seed = 1, inhabited = true, color;
      const sp = S && pl && S.planets && S.planets[pl.id];
      if (sp) { look = sp.type === 'none' ? 'asteroids' : sp.growth === 'gaia' ? 'gaia' : sp.type; seed = sp.id * 7919 + (sp.gfx | 0); }
      else if (pl) { look = pl.type && pl.type !== 'none' ? pl.type : 'barren'; seed = (pl.id | 0) * 7919 + 3; }
      if (pl && pl.owner >= 0 && S && S.empires && S.empires[pl.owner]) color = EMP[S.empires[pl.owner].color % 6];
      return { look, seed, inhabited, color };
    }
    function decorPlanet() {
      const sp = S && S.planets && B && S.planets[B.star];
      if (!sp || sp.type === 'none') return null;
      return { look: sp.growth === 'gaia' ? 'gaia' : sp.type, seed: sp.id * 7919 + (sp.gfx | 0), inhabited: sp.owner >= 0 };
    }
    view.load = function (o) {
      B = view.B = o.B; S = view.S = o.S || null; battle = view.battle = o.battle || null;
      if (!fx) view.makeFx();
      if (fx && fx.clear) fx.clear();
      units = []; planetU = null; missiles.clear(); sched.length = 0; jobs.length = 0; job = null; roundNo = B.round; bannerT = null; activeId = -1; moveCells = []; targetCells = []; hoverCell = null; showPath = false; targetMap.clear();
      for (const t of texts) t.on = false;
      for (const d of DEBRIS) d.on = false; nud.t = 0;
      for (const bu of B.units) {
        const du = makeUnit(bu); units[bu.id] = du;
        if (bu.kind === 'planet') planetU = du;
        else if (G.Ships && G.Ships.prewarm) { try { G.Ships.prewarm(du.race, monsterHull(du), 128, du.color, du.flags, du.vkey || null); } catch (e) { /* optional */ } }
      }
      rocks = B.rocks.map((r, i) => ({ x: r.x, y: r.y, v: (r.x * 7 + r.y * 13 + i) % 3, art: (r.x * 7 + r.y * 13 + i * 3) % 8, sz: 0.75 + ((r.x * 11 + r.y * 5 + i) % 5) * 0.1, rot: ((r.x * 31 + r.y * 17) % 60) / 60 * TAU, spin: (((r.x + r.y * 3) % 5) - 2) * 0.03 + 0.02 }));
      const st = S && S.stars && S.stars[B.star];
      backdrop = { star: (st && st.color) || 'yellow', seed: (B.star | 0) * 131 + (B.bg | 0) * 17 + 5, nebula: !!B.nebula || ((B.bg | 0) % 2 === 0), decor: planetU ? null : decorPlanet(), key: '' };
      if (view.ready) layout();
      view.sync(B);
      for (const u of units) if (u) u.hpShown = hpFrac(u);
    };
    const monsterHull = u => (u.kind === 'monster' ? 4 : u.kind === 'planet' ? 5 : clamp(u.hull | 0, 0, 3));

    // ---- state sync (engine → display) ---------------------------------------------------------------------------------------------------------------
    view.sync = function (Bn) {
      if (Bn) B = view.B = Bn;
      if (!B) return;
      for (const bu of B.units) {
        const u = units[bu.id]; if (!u) continue;
        u.count = bu.count; u.hp1 = bu.hp1; u.hp2 = bu.hp2; u.hploss = bu.hploss; u.absorb = bu.absorb;
        u.x = u.tx = bu.x; u.y = u.ty = bu.y; u.moving = false;
        u.cloakT = bu.st && bu.st.cloak === 1 ? 1 : 0; u.frozenT = bu.st && bu.st.stasis > 0 ? 1 : 0; u.retreating = !!(bu.st && bu.st.retreat > 0);
        u.gone = !!(bu.gone || bu.left) || (bu.kind !== 'planet' && bu.count <= 0);
        u.alphaT = u.gone ? 0 : 1; if (u.gone && u.alpha > 0.5 && !u.dying && !u.warp) u.alpha = u.alphaT;
        if (bu.kind === 'planet') { u.slotSel = bu.planetSlot | 0; if (B.planet) { u.pop = B.planet.pop; u.fac = B.planet.factories; } }
        sizeUnit(u);
        if (!inst) u.tagT = 0;
      }
      // missiles in flight → display stacks
      const live = new Set();
      for (const m of B.missiles) {
        live.add(m.id);
        let dm = missiles.get(m.id);
        if (!dm) { dm = newMissile(m.id, m.wid, m.n, m.px / 32 - 0.5, m.py / 24 - 0.5, m.shooter); missiles.set(m.id, dm); }
        dm.n = m.n; dm.x = dm.x1 = m.px / 32 - 0.5; dm.y = dm.y1 = m.py / 24 - 0.5; dm.moving = false; dm.fade = 0;
      }
      for (const [id] of missiles) if (!live.has(id)) missiles.delete(id);
      activeId = B.active === null || B.active === undefined ? -1 : B.active;
      roundNo = B.round;
    };

    // ---- highlights -----------------------------------------------------------------------------------------------------------------------------------
    view.setActive = id => { activeId = id === null || id === undefined ? -1 : id; };
    view.setHighlights = function (h) {
      h = h || NO;
      moveCells = h.moves || []; targetCells = h.targets || []; hoverCell = h.hover || null; showPath = !!h.path;
      targetMap.clear(); for (const t of targetCells) targetMap.set(t.id, t);
    };
    view.setHover = function (cell, path) { hoverCell = cell; showPath = !!path; };

    // ---- fx helpers -----------------------------------------------------------------------------------------------------------------------------------
    const sfx = (id, o) => { if (!inst) UI.sfx(id, o); };
    const panOf = x => clamp((x / W) * 2 - 1, -1, 1) * 0.6;
    const upos = u => ({ x: cx(u.x), y: cy(u.y) });
    function spawnText(x, y, txt, col, size, o) {
      let t = null;
      for (let i = 0; i < texts.length; i++) if (!texts[i].on) { t = texts[i]; break; }
      if (!t) t = texts[0];
      o = o || NO;
      t.on = true; t.x = x + (o.dx || 0); t.y = y + (o.dy || 0); t.vx = o.vx || 0; t.vy = o.vy === undefined ? -26 : o.vy; t.age = -(o.delay || 0); t.life = o.life || 1.35; t.txt = txt; t.col = col || '#fff'; t.size = size || 14; t.bold = o.bold !== false;
    }
    view.floatText = (x, y, txt, col, size) => spawnText(cx(x), cy(y), txt, col, size);
    view.shake = v => { if (fx) fx.shake = min(34, max(fx.shake || 0, v)); };
    view.banner = function (text, sub, color) { bannerT = { text, sub: sub || '', color: color || C.brassHi, age: 0, life: 1.7 }; };
    const later = (dt, fn, vis) => { if (inst) { if (!vis) fn(); return; } sched.push({ t: clock + dt, fn, vis: vis !== false }); sched.sort((a, b) => a.t - b.t); };
    const sizeFx = n => grid.base * 0.34 * (n === 3 ? 2.1 : n === 2 ? 1.5 : 1);

    function newMissile(mid, wid, n, x, y, shooter) {
      const k = misKind(wid);
      return { mid, wid, kind: k, col: MIS_COL[k] || '#ffbe5a', n, x, y, x0: x, y0: y, x1: x, y1: y, t: 1, dur: 0.3, moving: false, fade: 0, trail: [], shooter, born: clock, big: k === 'torpedo' || k === 'antimatter' };
    }

    // ---- event handlers (one per engine event type); each returns the pause (s) before the next event starts ---------------------------------------
    function targetPoint(from, t) {                             // where a beam ends on target t when fired from point from
      const c = upos(t);
      if (t.kind === 'planet') { const a = atan2(from.y - c.y, from.x - c.x); return { x: c.x + cos(a) * t.R * 0.78, y: c.y + sin(a) * t.R * 0.78 }; }
      return c;
    }
    function muzzle(a, to) {                                    // beam origin: a little in front of the firing ship
      const c = upos(a), ang = atan2(to.y - c.y, to.x - c.x), L = a.kind === 'planet' ? a.R * 0.9 : a.len * 0.32;
      return { x: c.x + cos(ang) * L, y: c.y + sin(ang) * L };
    }
    function hitStack(u, e) { if (!u) return; u.count = e.count !== undefined ? e.count : u.count; u.hp1 = e.hp1 !== undefined ? e.hp1 : u.hp1; u.hploss = e.hploss !== undefined ? e.hploss : u.hploss; }

    function handle(e) {
      const U = units;
      switch (e.type) {
        case 'round-start': {
          roundNo = e.round;
          if (!inst) view.banner('Round ' + e.round, '', C.brassHi);
          return inst ? 0 : 0.45;
        }
        case 'turn-start': { activeId = e.unit; return inst ? 0 : 0.05; }
        case 'turn-end': { if (activeId === e.unit) activeId = -1; return 0; }
        case 'frozen': { const u = U[e.unit]; if (u && !inst) { const p = upos(u); spawnText(p.x, p.y - u.len * 0.4, 'Frozen', '#9fe8ff', 13); } return inst ? 0 : 0.2; }
        case 'repair': {
          const u = U[e.unit]; if (!u) return 0;
          if (!inst) { const p = upos(u); spawnText(p.x, p.y - u.len * 0.35, '+' + e.amount, C.leaf, 15); if (fx) fx.sparks(p.x, p.y, 10, '#7dffb0'); }
          return inst ? 0 : 0.12;
        }
        case 'move': {
          const u = U[e.unit]; if (!u) return 0;
          u.tx = e.to.x; u.ty = e.to.y;
          if (inst) { u.x = u.tx; u.y = u.ty; return 0; }
          const dx = (e.to.x - e.from.x) * grid.cw, dy = (e.to.y - e.from.y) * grid.ch;
          u.moveAng = atan2(dy, dx); u.moving = true; u.idle = 0;
          if (u.x === u.tx && u.y === u.ty) u.x = e.from.x, u.y = e.from.y;
          return e.push ? 0.24 : 0.17;
        }
        case 'teleport': {
          const u = U[e.unit]; if (!u) return 0;
          u.tx = e.to.x; u.ty = e.to.y;
          if (inst) { u.x = u.tx; u.y = u.ty; return 0; }
          if (fx) { fx.warpFlash(cx(e.from.x), cy(e.from.y), u.len, { color: '#c8a8ff' }); }
          sfx('warp', { pan: panOf(cx(e.from.x)), rate: 1.3 });
          u.alphaT = 0;
          later(0.22, () => { u.x = u.tx; u.y = u.ty; u.alpha = 0; u.alphaT = 1; if (fx) fx.warpFlash(cx(u.x), cy(u.y), u.len, { color: '#c8a8ff', mode: 'in' }); });
          return 0.5;
        }
        case 'beam': return onBeam(e);
        case 'miss': {
          if (inst) return 0;
          const t = U[e.target]; if (t) { const p = upos(t); spawnText(p.x, p.y - t.len * 0.3, e.count > 1 ? 'Miss ×' + e.count : 'Miss', '#c8d2f0', 11, { life: 0.9, vy: -18 }); }
          return 0.04;
        }
        case 'shield-absorb': {
          const t = U[e.target]; if (!t) return 0;
          t.shieldGlow = 1;
          if (inst) return 0;
          const p = upos(t), a = t.lastHitAngle === undefined ? PI : t.lastHitAngle;
          if (fx) fx.shieldHit(p.x, p.y, t.kind === 'planet' ? t.R * 1.28 : max(grid.cw, t.len) * 0.52, a, [120, 215, 255]);
          sfx('shield_hit', { pan: panOf(p.x), vol: 0.7 });
          if (e.amount > 0) spawnText(p.x - t.len * 0.25, p.y - t.len * 0.2, '−' + e.amount, C.cyan, 11, { life: 0.9, vy: -20, dx: (Math.random() - 0.5) * 12 });
          return 0.05;
        }
        case 'armor-hit': {
          const t = U[e.target]; if (!t) return 0;
          hitStack(t, e);
          t.flash = 1;
          if (inst) return 0;
          const p = upos(t);
          if (fx) fx.sparks(p.x, p.y, 8 + min(20, e.damage * 0.4 | 0), '#ffb878');
          sfx('armor_hit', { pan: panOf(p.x), vol: 0.8 });
          return 0.05;
        }
        case 'damage': {
          const t = U[e.target]; if (!t) return 0;
          if (inst) return 0;
          const p = upos(t), rel = e.amount / max(1, t.hp2), big = rel > 0.5 ? 2 : rel > 0.15 ? 1 : 0;
          spawnText(p.x + (Math.random() - 0.5) * t.len * 0.4, p.y - t.len * 0.15, '−' + e.amount, big === 2 ? C.rose : big === 1 ? C.ember : '#ffd9a0', 14 + big * 5, { life: 1.4 });
          if (rel > 0.12) { view.shake(min(18, 3 + rel * 18)); nudge(t.lastHitAngle === undefined ? PI : t.lastHitAngle + PI, 2 + rel * 2); }
          return 0.04;
        }
        case 'ship-destroyed': {
          const t = U[e.target]; if (!t) return 0;
          t.count = e.left;
          if (e.left <= 0) { t.dying = 1; t.alphaT = 0; t.gone = true; }
          if (inst) return 0;
          const p = upos(t);
          spawnText(p.x, p.y - t.len * 0.55, e.left <= 0 ? 'Destroyed' : '−' + e.n + (e.n > 1 ? ' ships' : ' ship'), C.rose, e.left <= 0 ? 17 : 14, { life: 1.6 });
          if (e.left <= 0 && fx) {                              // the stack dies: shockwave ring, drifting wreckage, a directional camera nudge
            if (fx.shockwave) fx.shockwave(p.x, p.y, t.len * 1.7, t.color);
            spawnDebris(p.x, p.y, t.len);
            nudge(Math.random() * TAU, 4);
          }
          return 0.06;
        }
        case 'explosion': {
          if (inst || !fx) return 0;
          const n = e.size | 0 || 1, x = cx(e.x), y = cy(e.y);
          fx.explosion(x, y, sizeFx(n) * 1.5, { kind: 'fire' });
          if (n >= 3 && fx.shockwave) fx.shockwave(x, y, sizeFx(n) * 2.4, '#ffc890');
          sfx(n >= 3 ? 'explosion_big' : 'explosion_small', { pan: panOf(x), vol: n >= 2 ? 1 : 0.8 });
          if (n >= 2) { view.shake(6 + n * 4); nudge(Math.random() * TAU, 2 + n); }
          return 0.1;
        }
        case 'planet-hit': {
          const t = U[e.target] || planetU; if (!t) return 0;
          if (e.popKilled) t.pop = max(0, t.pop - e.popKilled);
          if (e.factoriesKilled) t.fac = max(0, t.fac - e.factoriesKilled);
          if (inst) return 0;
          const p = upos(t);
          if (fx) fx.planetImpact(p.x, p.y, t.R);
          sfx('planet_hit', { pan: panOf(p.x) });
          view.shake(8);
          let dy = -t.R * 1.1;
          if (e.popKilled) { spawnText(p.x, p.y + dy, '−' + e.popKilled + ' pop', C.rose, 15, { life: 1.9 }); dy -= 18; }
          if (e.factoriesKilled) spawnText(p.x, p.y + dy, '−' + e.factoriesKilled + ' factories', C.ember, 14, { life: 1.9 });
          return 0.12;
        }
        case 'base-destroyed': {
          const t = U[e.target] || planetU; if (!t) return 0;
          t.count = e.left;
          if (inst) return 0;
          const p = upos(t), a = Math.random() * TAU;
          if (fx) fx.explosion(p.x + cos(a) * t.R * 1.25, p.y + sin(a) * t.R * 1.25, sizeFx(2), { kind: 'fire' });
          sfx('explosion_small', { pan: panOf(p.x) });
          spawnText(p.x, p.y - t.R * 1.5, e.left <= 0 ? 'All bases destroyed' : '−' + e.n + (e.n > 1 ? ' bases' : ' base'), C.rose, 15, { life: 1.8 });
          return 0.1;
        }
        case 'bio-hit': {
          const t = U[e.target] || planetU; if (!t) return 0;
          t.pop = max(0, t.pop - (e.popKilled | 0));
          if (inst) return 0;
          const p = upos(t);
          if (fx) fx.pulse(p.x, p.y, t.R * 1.6, '#9aff6a');
          spawnText(p.x, p.y - t.R * 1.1, '−' + e.popKilled + ' pop', '#b6ff7a', 15, { life: 1.9 });
          return 0.2;
        }
        case 'missile-launch': {
          const a = U[e.unit], t = U[e.target];
          const m = newMissile(e.mid, e.weapon, e.n, e.x, e.y, e.unit); missiles.set(e.mid, m);
          if (a && t) { const dx = (t.x - a.x) * grid.cw, dy = (t.y - a.y) * grid.ch; m.ang = atan2(dy, dx); }
          if (inst) return 0;
          if (fx) fx.flashAt(cx(e.x), cy(e.y), grid.base * 0.4, m.col, 0.25);
          sfx('missile_launch', { pan: panOf(cx(e.x)), vol: 0.7 });
          return 0.16;
        }
        case 'missile-move': {
          let m = missiles.get(e.mid);
          if (!m) { m = newMissile(e.mid, '', 1, e.from.x, e.from.y, -1); missiles.set(e.mid, m); }
          m.x0 = e.from.x; m.y0 = e.from.y; m.x1 = e.to.x; m.y1 = e.to.y;
          m.ang = atan2((e.to.y - e.from.y) * grid.ch, (e.to.x - e.from.x) * grid.cw);
          if (inst) { m.x = m.x1; m.y = m.y1; return 0; }
          const d = hypot((e.to.x - e.from.x) * grid.cw, (e.to.y - e.from.y) * grid.ch) / grid.cw;
          m.dur = clamp(d * 0.17, 0.12, 0.75); m.t = 0; m.moving = true;
          const nx = job && job.ev[job.i];
          return nx && nx.type === 'missile-move' ? 0.06 : m.dur * 0.97;
        }
        case 'missile-hit': {
          const m = missiles.get(e.mid), t = U[e.target];
          if (m) missiles.delete(e.mid);
          if (!t) return 0;
          const p = upos(t);
          if (t.kind === 'planet') { t.lastHitAngle = atan2((m ? cy(m.y) : p.y) - p.y, (m ? cx(m.x) : p.x) - p.x); } else if (m) t.lastHitAngle = atan2(cy(m.y) - p.y, cx(m.x) - p.x);
          if (inst) return 0;
          const big = m && m.big;
          if (e.hits > 0 && fx) {
            const sz = sizeFx(1) * (big ? 2.4 : 1.2) * (1 + min(1, e.hits / 40) * 0.5);
            fx.explosion(p.x + (Math.random() - 0.5) * t.len * 0.3, p.y + (Math.random() - 0.5) * t.len * 0.2, sz, { kind: big ? 'plasma' : 'fire' });
            sfx('missile_hit', { pan: panOf(p.x), vol: big ? 1 : 0.8 });
          }
          if (e.intercepted > 0) {
            if (fx) fx.sparks(p.x - t.len * 0.3, p.y, min(40, 6 + e.intercepted), '#8fe6ff');
            spawnText(p.x, p.y - t.len * 0.5, e.intercepted + ' shot down', C.cyan, 12, { life: 1.3 });
          }
          if (e.hits === 0 && !e.intercepted) spawnText(p.x, p.y - t.len * 0.4, e.faded ? 'Faded' : 'Missed', '#c8d2f0', 11, { life: 0.9, vy: -16 });
          return 0.1;
        }
        case 'missile-lost': {
          const m = missiles.get(e.mid);
          if (m) { m.fade = 1; if (!inst && fx && e.reason === 'rock') fx.sparks(cx(m.x), cy(m.y), 14, '#ffd09a'); if (inst) missiles.delete(e.mid); }
          return 0;
        }
        case 'special-effect': return onSpecial(e);
        case 'cloak': { const u = U[e.unit]; if (u) { u.cloakT = e.state === 'on' ? 1 : 0; if (!inst) { sfx('scan', { rate: 1.6, vol: 0.4 }); } } return inst ? 0 : 0.15; }
        case 'retreat': {
          const u = U[e.unit]; if (!u) return 0;
          u.retreating = true;
          if (!inst) { const p = upos(u); spawnText(p.x, p.y - u.len * 0.5, 'Retreat', C.ember, 14, { life: 1.4 }); }
          return 0.05;
        }
        case 'warp-out': {
          const u = U[e.unit]; if (!u) return 0;
          u.gone = true; u.alphaT = 0;
          if (inst) { u.alpha = 0; return 0; }
          u.warp = 0.001; u.warpT = 1;
          const p = upos(u);
          if (fx) fx.warpFlash(p.x, p.y, u.len * 1.1, { mode: 'out', color: '#bfe0ff' });
          sfx('warp', { pan: panOf(p.x) });
          return 0.35;
        }
        case 'scan': return 0;
        case 'battle-end': return inst ? 0 : 0.3;
        default: return 0;
      }
    }

    function onBeam(e) {
      const a = units[e.unit], t = units[e.target];
      if (!a || !t) return 0;
      const hit = e.hits > 0, info = beamInfo(e.weapon), kind = e.kind === 'bomb' || e.kind === 'bio' ? null : info[0];
      // remember where the damage comes from (shield ripple faces the attacker)
      const ap = upos(a), tp = upos(t);
      t.lastHitAngle = atan2(ap.y - tp.y, ap.x - tp.x);
      if (a.kind !== 'planet') { const ang = atan2(tp.y - ap.y, tp.x - ap.x); a.aimAng = ang; a.aimT = 0.5; a.recoil = 1; }
      if (inst) return 0;
      const shots = max(1, e.shots | 0);
      if (!kind) {                                                // bombs / bio: a bomb falls on the planet
        const from = muzzle(a, tp), to = targetPoint(from, t), n = min(6, 1 + (shots >> 2));
        if (fx) for (let i = 0; i < n; i++) later(i * 0.07, () => fx.missile(from.x, from.y, to.x + (Math.random() - 0.5) * t.R * 0.6, to.y + (Math.random() - 0.5) * t.R * 0.6, 420, e.kind === 'bio' ? 'merculite' : 'nuclear', { scale: 0.9 }));
        sfx('bomb', { pan: panOf(tp.x) });
        return 0.4 + n * 0.05;
      }
      const lines = shots >= 24 ? 3 : shots >= 6 ? 2 : 1, scale = info[1] * clamp(grid.base / 110, 0.7, 1.5);
      const from = muzzle(a, tp);
      const to0 = targetPoint(from, t), dx = to0.x - from.x, dy = to0.y - from.y, L = hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      const heavy = info[1] >= 1.4;
      const rapid = /gatling|autocannon|auto-blaster|pulse-phasor|pellet/.test(String(e.weapon));
      const sid = e.weapon === 'death-ray' ? 'deathray' : rapid ? 'gatling' : kind === 'laser' ? 'laser' : kind === 'mass' ? 'mass' : kind === 'phasor' ? 'beam_phasor' : kind === 'plasma' ? 'beam_plasma' : kind === 'disruptor' ? 'beam_disruptor' : 'beam_heavy';
      sfx(sid, { pan: panOf(from.x), vol: 0.7, rate: heavy ? 0.9 : 1 });
      const dur = kind === 'deathray' ? 1.5 : null;
      for (let i = 0; i < lines; i++) {
        const off = (i - (lines - 1) / 2) * grid.ch * 0.1, miss = !hit && i === lines - 1 || (hit && e.hits < shots * 0.35 && i === lines - 1 && lines > 1);
        later(i * 0.055, () => {
          if (!fx) return;
          const wob = miss ? (Math.random() < 0.5 ? -1 : 1) * grid.ch * (0.38 + Math.random() * 0.3) : 0;
          const ext = miss ? 1.18 : 1;
          fx.beam(from.x + nx * off, from.y + ny * off, from.x + dx * ext + nx * (off + wob), from.y + dy * ext + ny * (off + wob), kind, dur, { scale });
        });
      }
      if (hit && fx) later(0.07, () => { fx.sparks(to0.x, to0.y, 6 + lines * 3, BEAM_COL[kind] || '#ffd09a'); });
      return 0.2 + (lines - 1) * 0.05;
    }

    function onSpecial(e) {
      const a = units[e.unit], t = e.target !== undefined ? units[e.target] : null;
      switch (e.device) {
        case 'planet-weapon': { if (a) a.slotSel = e.slot | 0; return 0; }
        case 'stasis': {
          if (t) { t.frozenT = 1; }
          if (inst || !t) return 0;
          const p = upos(t);
          if (fx) { fx.pulse(p.x, p.y, t.len * 1.1, '#9fe8ff'); fx.ring(p.x, p.y, t.len * 0.2, t.len * 0.9, '#bfeeff', 0.7); }
          sfx('shield_hit', { rate: 0.55, pan: panOf(p.x) });
          spawnText(p.x, p.y - t.len * 0.5, 'Stasis', '#9fe8ff', 15, { life: 1.5 });
          return 0.4;
        }
        case 'stasis-end': { if (t) t.frozenT = 0; return 0; }
        case 'pulsar': {
          if (inst || !a) return 0;
          const p = upos(a), R = max(grid.cw, grid.ch) * 1.7;
          if (fx) { fx.ring(p.x, p.y, a.len * 0.2, R, e.mode === 2 ? '#ff7ae8' : '#c88aff', 0.8); fx.pulse(p.x, p.y, R * 0.9, e.mode === 2 ? '#ff7ae8' : '#b48cff'); }
          sfx('beam_heavy', { rate: 0.5, pan: panOf(p.x) });
          for (const h of e.affected || []) { const u = units[h.target]; if (u && h.damage > 0) { const q = upos(u); spawnText(q.x, q.y - u.len * 0.3, '−' + h.damage + ' armor', C.violet, 13, { life: 1.5 }); } }
          view.shake(7);
          return 0.55;
        }
        case 'stream': {
          if (inst || !a || !t) return 0;
          const from = muzzle(a, upos(t)), to = upos(t);
          if (fx) fx.beam(from.x, from.y, to.x, to.y, 'disruptor', 0.7, { scale: 1.3, color: '#7dffd0' });
          sfx('beam_heavy', { rate: 0.7, pan: panOf(from.x) });
          spawnText(to.x, to.y - t.len * 0.5, '−' + e.percent + '% armor', '#7dffd0', 14, { life: 1.6 });
          return 0.5;
        }
        case 'blackhole': {
          if (inst || !t) return 0;
          const p = upos(t), R = max(grid.cw, grid.ch) * 1.2;
          if (fx) { fx.ring(p.x, p.y, R, R * 0.05, '#7a5cff', 0.8); fx.pulse(p.x, p.y, R, '#3a1c8a'); }
          sfx('explosion_big', { rate: 0.5, pan: panOf(p.x), vol: 0.8 });
          view.shake(10);
          spawnText(p.x, p.y - t.len * 0.5, e.killed ? 'Black hole: −' + e.killed : 'Black hole', C.violet, 15, { life: 1.7 });
          return 0.7;
        }
        case 'dissipator': {
          if (inst || !a || !t) return 0;
          const from = muzzle(a, upos(t)), to = upos(t);
          if (fx) { fx.beam(from.x, from.y, to.x, to.y, 'phasor', 0.6, { color: '#ffc04a' }); fx.pulse(to.x, to.y, t.len, '#ffc04a'); }
          sfx('beam_heavy', { rate: 0.8, pan: panOf(from.x) });
          spawnText(to.x, to.y - t.len * 0.5, e.success ? 'Slowed' : 'Resisted', e.success ? C.ember : '#c8d2f0', 14, { life: 1.5 });
          return 0.45;
        }
        case 'technull': {
          if (inst || !a || !t) return 0;
          const from = upos(a), to = upos(t);
          if (fx) { fx.ring(to.x, to.y, t.len * 0.2, t.len * 1.2, '#62d8ff', 0.8); fx.beam(from.x, from.y, to.x, to.y, 'phasor', 0.35, { color: '#62d8ff', scale: 0.7 }); }
          sfx('scan', { rate: 1.5, pan: panOf(to.x) });
          spawnText(to.x, to.y - t.len * 0.5, '−' + e.drop + ' attack', C.cyan, 14, { life: 1.6 });
          return 0.45;
        }
        case 'repulsor': {
          if (inst || !a) return 0;
          const p = upos(a);
          if (fx) fx.ring(p.x, p.y, a.len * 0.2, a.len * 1.1, '#ffe6a0', 0.5);
          sfx('armor_hit', { rate: 0.6, pan: panOf(p.x) });
          return 0.3;
        }
        default: return 0;
      }
    }

    // ---- sequencer ------------------------------------------------------------------------------------------------------------------------------------
    function prepare(evs) {
      const out = [];
      for (let i = 0; i < evs.length; i++) {
        const e = evs[i];
        if (e.type === 'special-effect' && (e.device === 'pulsar' || e.device === 'stream')) {            // the engine reports the kills first: show the device before them
          let j = out.length;
          while (j > 0 && (out[j - 1].type === 'ship-destroyed' || out[j - 1].type === 'explosion' || out[j - 1].type === 'base-destroyed')) j--;
          out.splice(j, 0, e);
        } else out.push(e);
      }
      return out;
    }
    const spdK = () => { const s = spdOverride !== null ? spdOverride : view.speed; return s >= 2 ? 2.3 : s > 0 ? s : 0; };
    view.setSpeed = s => { view.speed = s; };
    view.play = function (events) {
      return new Promise(resolve => {
        const evs = prepare(events || []);
        if (!evs.length) { resolve(); return; }
        const j = { ev: evs, i: 0, wait: 0, resolve };
        if (spdK() <= 0) { flush(j); resolve(); return; }
        jobs.push(j);
        if (!job) job = jobs.shift();
      });
    };
    function flush(j) {                                         // apply the state changes of a job at once (no effects)
      const was = inst; inst = true;
      try { for (; j.i < j.ev.length; j.i++) { try { handle(j.ev[j.i]); } catch (err) { console.error('[CombatFx] event', j.ev[j.i], err); } } } finally { inst = was; }
    }
    view.skip = function () {
      if (!job && !jobs.length) return;
      for (let i = sched.length - 1; i >= 0; i--) { const s = sched[i]; if (s.vis) sched.splice(i, 1); }
      while (sched.length) sched.shift().fn();
      const all = job ? [job].concat(jobs) : jobs.slice();
      jobs.length = 0; job = null;
      for (const j of all) { flush(j); j.resolve(); }
      if (B) view.sync(B);
      bannerT = null;
    };
    view.busy = () => !!job || jobs.length > 0;
    function stepSeq(dt) {
      const k = spdK(), step = dt * (k || 1);
      clock += step;
      while (sched.length && sched[0].t <= clock) { const s = sched.shift(); try { s.fn(); } catch (err) { console.error('[CombatFx] scheduled', err); } }
      if (!job) return;
      job.wait -= step;
      while (job.wait <= 0 && job.i < job.ev.length) {
        const e = job.ev[job.i++];
        let w = 0;
        try { w = handle(e) || 0; } catch (err) { console.error('[CombatFx] event', e, err); }
        job.wait += w;
      }
      if (job.i >= job.ev.length && job.wait <= 0 && !sched.length && !tweening()) {
        const r = job.resolve; job = jobs.shift() || null; r();
      }
    }
    function tweening() {
      for (const u of units) if (u && u.moving) return true;
      for (const [, m] of missiles) if (m.moving) return true;
      return false;
    }

    // ---- per-frame update ---------------------------------------------------------------------------------------------------------------------------------
    function update(dt) {
      const k = spdK() || 1, sd = dt * k;
      for (const u of units) {
        if (!u) continue;
        // movement: chase the target cell at a steady speed so consecutive one-cell steps flow into each other
        const dx = u.tx - u.x, dy = u.ty - u.y, d = hypot(dx, dy);
        if (d > 1e-4) {
          const sp = 6.2 * sd * (d > 2.5 ? 1.5 : 1), s = min(d, sp);
          u.x += dx / d * s; u.y += dy / d * s; u.moving = d - s > 1e-3; u.idle = 0;
          if (!u.moving) { u.x = u.tx; u.y = u.ty; }
        } else { u.moving = false; u.idle += dt; }
        // heading: turn toward the direction of travel, then back to the battle line
        const want = u.moving || u.idle < 0.18 ? u.moveAng : u.heading;
        let da = want - u.angle; da = atan2(sin(da), cos(da));
        u.angle += da * min(1, dt * (u.moving ? 14 : 7));
        u.alpha += (u.alphaT - u.alpha) * min(1, dt * (u.dying ? 3.2 : 5));
        if (u.alphaT === 1 && u.alpha > 0.98) u.alpha = 1;
        u.cloak += (u.cloakT - u.cloak) * min(1, dt * 4);
        u.frozen += (u.frozenT - u.frozen) * min(1, dt * 5);
        u.flash = max(0, u.flash - dt * 4.5);
        u.shieldGlow = max(0, u.shieldGlow - dt * 1.4);
        u.hpShown += (hpFrac(u) - u.hpShown) * min(1, dt * 6);
        if (u.warp > 0) { u.warp += dt * 2.4; if (u.warp >= 1) { u.warp = 0; u.alpha = 0; } }
        if (u.recoil) u.recoil = max(0, u.recoil - dt * 6);
        if (u.aimT > 0) u.aimT -= dt;
        if (u.dying && u.alpha < 0.02) u.dying = 0;
      }
      for (const [id, m] of missiles) {
        if (m.moving) { m.t += sd / m.dur; const k2 = min(1, m.t); m.x = lerp(m.x0, m.x1, k2); m.y = lerp(m.y0, m.y1, k2); if (m.t >= 1) m.moving = false; }
        if (m.fade > 0) { m.fade -= dt * 3; if (m.fade <= 0) { missiles.delete(id); continue; } }
        const tr = m.trail, px = m.x, py = m.y;
        if (!tr.length || hypot(px - tr[tr.length - 2], py - tr[tr.length - 1]) > 0.04) { tr.push(px, py); if (tr.length > 28) tr.splice(0, 2); }
        else if (tr.length > 2 && !m.moving) tr.splice(0, 2);
      }
      for (const r of rocks) r.rot += r.spin * dt;
      if (nud.t > 0) nud.t -= dt;
      for (const d of DEBRIS) if (d.on) { d.age += dt; if (d.age > d.life) d.on = false; else { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - min(1, dt * 0.9); d.vy *= 1 - min(1, dt * 0.9); d.rot += d.vr * dt; } }
      for (const t of texts) if (t.on) { t.age += dt; if (t.age > t.life) t.on = false; else if (t.age > 0) { t.x += t.vx * dt; t.y += t.vy * dt; t.vy *= 1 - min(1, dt * 1.2); } }
      if (bannerT) { bannerT.age += dt; if (bannerT.age > bannerT.life) bannerT = null; }
      if (fx) fx.update(sd);
    }

    // ---- drawing ------------------------------------------------------------------------------------------------------------------------------------------
    function buildGridLayer() {
      const key = W + 'x' + H + '@' + dpr + '|' + grid.x.toFixed(1) + '|' + grid.cw.toFixed(1) + '|' + grid.ch.toFixed(1) + '|' + sideKey();
      if (gridLayer && key === gridKey) return;
      gridKey = key;
      if (!gridLayer) gridLayer = mk(1, 1);
      gridLayer.width = max(1, Math.ceil(W * dpr)); gridLayer.height = max(1, Math.ceil(H * dpr));
      const g = gridLayer.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x0 = grid.x, y0 = grid.y, gw = grid.w, gh = grid.h, cw = grid.cw, ch = grid.ch;
      // faint panel under the grid so ships read against the nebula
      g.fillStyle = 'rgba(3,5,18,0.34)'; g.fillRect(x0, y0, gw, gh);
      // side zones tinted with the banner colours
      const sc = [sideColor(0), sideColor(1)];
      for (let s = 0; s < 2; s++) {
        const gr = g.createLinearGradient(s ? x0 + gw : x0, 0, s ? x0 + gw - cw * 2.2 : x0 + cw * 2.2, 0);
        gr.addColorStop(0, rgba(sc[s], 0.1)); gr.addColorStop(1, rgba(sc[s], 0));
        g.fillStyle = gr; g.fillRect(s ? x0 + gw - cw * 2.2 : x0, y0, cw * 2.2, gh);
      }
      // checker
      g.fillStyle = 'rgba(190,210,255,0.028)';
      for (let j = 0; j < 8; j++) for (let i = 0; i < 10; i++) if ((i + j) & 1) g.fillRect(x0 + i * cw, y0 + j * ch, cw, ch);
      // no full line grid: the cells only show near the cursor and the selected unit (drawGridNear); faint intersection dots keep the board readable
      g.fillStyle = ('rgba(' + BH + ',0.22)');
      for (let i = 1; i < 10; i++) for (let j = 1; j < 8; j++) g.fillRect(x0 + i * cw - 0.75, y0 + j * ch - 0.75, 1.5, 1.5);
      // frame + corner brackets
      g.lineWidth = 1;
      g.strokeStyle = ('rgba(' + BR + ',0.55)'); g.strokeRect(x0 - 0.5, y0 - 0.5, gw + 1, gh + 1);
      g.strokeStyle = ('rgba(' + BH + ',0.9)'); g.lineWidth = 2; const bl = min(cw, ch) * 0.34;
      for (const [px, py, sx, sy] of [[x0, y0, 1, 1], [x0 + gw, y0, -1, 1], [x0, y0 + gh, 1, -1], [x0 + gw, y0 + gh, -1, -1]]) { g.beginPath(); g.moveTo(px + sx * bl, py); g.lineTo(px, py); g.lineTo(px, py + sy * bl); g.stroke(); }
      // axis labels
      const fs = clamp(ch * 0.15, 9, 14);
      g.font = '600 ' + fs + 'px ' + FONT_UI; g.fillStyle = ('rgba(' + BR + ',0.6)'); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (let i = 0; i < 10; i++) g.fillText(String.fromCharCode(65 + i), x0 + (i + 0.5) * cw, y0 - 6);
      g.textAlign = 'right';
      for (let j = 0; j < 8; j++) g.fillText(String(j + 1), x0 - 6, y0 + (j + 0.5) * ch + fs * 0.35);
    }
    const sideKey = () => (B ? sideColor(0) + sideColor(1) : '');
    function sideColor(s) {
      for (const u of units) if (u && u.side === s) return u.color;
      return s ? '#e8504d' : '#4a90e8';
    }

    // The scene backdrop (nebula, three drifting star layers, sun, lens ghosts and the colour grade: a dozen full-screen passes plus a
    // filtered copy of the frame) is repainted at 24 Hz into an offscreen canvas and blitted every frame. Its star layers drift under
    // 0.25 px between repaints and the film grain already steps at 24 Hz, so nothing visible changes; the per-frame cost of the screen
    // is now the units and the effects. When a photoreal plate is available (drawPlate below) it is drawn directly instead: one image
    // and a few fills a frame.
    const bdc = { c: null, g: null, key: '', pace: {}, bdObj: null, bkey: '' };

    // photoreal plate behind the board: a battle backdrop (batch 3, by situation) when it exists, else the star-system plate with its own planet
    // kept off-frame, darkened so the ships read, with a very slow drift. Returns false (nothing drawn) when WorldArt is off or still loading.
    function drawPlate(t) {
      const WA = G.WorldArt; if (!WA || !WA.enabled) return false;
      const kind = B && B.nebula ? 'nebula' : rocks.length >= 5 ? 'asteroids' : planetU ? 'planet' : 'deep';
      let path = WA.battle(kind), im = path ? WA.get(path) : null, mode = 'battle';
      if (!im) { path = WA.system(backdrop.star); im = path ? WA.get(path) : null; mode = 'system'; }
      if (!im) return false;
      const iw = im.naturalWidth, ih = im.naturalHeight, drift = reduceMotion() ? 0 : 1;
      const dx = sin(t * 0.05) * 2 * drift, dy = cos(t * 0.037) * 1.5 * drift;
      let sx = 0, sy = 0, sw = iw, sh = ih, starU = 0.84, starV = 0.16;
      if (mode === 'system') { sx = iw * 0.42; sy = 0; sw = iw * 0.58; sh = ih * 0.56; starU = (0.86 * iw - sx) / sw; starV = 0.17 * ih / sh; }   // top-right of the plate: the star, no planet
      else if (kind === 'star') { starU = 0.9; starV = 0.5; }
      const s = max(W / sw, H / sh) * 1.02, dw = sw * s, dh = sh * s, ox = (W - dw) / 2 + dx, oy = (H - dh) / 2 + dy;
      ctx.save(); ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, sx, sy, sw, sh, ox, oy, dw, dh);
      ctx.fillStyle = 'rgba(2,4,12,0.45)'; ctx.fillRect(0, 0, W, H);                                   // ~55 % brightness
      if (B && B.nebula && mode === 'system') {                                                       // inside a nebula: a soft two-hue haze over the plate (shields are weaker here)
        const n1 = ctx.createRadialGradient(W * 0.3 + dx * 4, H * 0.6, 0, W * 0.3, H * 0.6, W * 0.5), n2 = ctx.createRadialGradient(W * 0.75, H * 0.3 + dy * 4, 0, W * 0.75, H * 0.3, W * 0.45);
        n1.addColorStop(0, 'rgba(120,70,190,0.26)'); n1.addColorStop(1, 'rgba(120,70,190,0)'); n2.addColorStop(0, 'rgba(60,150,170,0.2)'); n2.addColorStop(1, 'rgba(60,150,170,0)');
        ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H); ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);
      }
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, min(W, H) * 0.3, W * 0.5, H * 0.5, hypot(W, H) * 0.6);
      vg.addColorStop(0, 'rgba(1,2,8,0)'); vg.addColorStop(1, 'rgba(1,2,8,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      star.x = ox + starU * dw; star.y = oy + starV * dh;
      return true;
    }
    function drawBackdrop(dt, t) {
      let ok = false;
      try { ok = drawPlate(t); } catch (err) { if (!view._plateWarn) { view._plateWarn = 1; console.warn('[CombatFx] plate backdrop failed', err); } ok = false; }
      const Sc = !ok && G.Scenes && G.Scenes.battle;
      if (Sc) {
        if (bdc.bdObj !== backdrop) { bdc.bdObj = backdrop; bdc.bkey = JSON.stringify([backdrop.star, backdrop.seed, backdrop.nebula, backdrop.decor]); }
        const key = W + 'x' + H + '@' + dpr + '|' + bdc.bkey;
        const paced = UI.pace ? UI.pace(bdc.pace, 24, dt) : true;
        if (paced || key !== bdc.key || !bdc.c) {
          try {
            if (!bdc.c || bdc.c.width !== canvas.width || bdc.c.height !== canvas.height) { bdc.c = mk(canvas.width, canvas.height); bdc.g = bdc.c.getContext('2d', { alpha: false }); }
            const g = bdc.g; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
            const r = Sc.draw(g, W, H, t, { starKind: backdrop.star, seed: backdrop.seed, nebula: backdrop.nebula, planet: backdrop.decor ? { desc: backdrop.decor, size: 0.85 } : null });
            if (r && r.star) { star.x = r.star.x; star.y = r.star.y; }
            bdc.key = key; ok = true;
          } catch (err) { bdc.key = ''; if (!view._bdWarn) { view._bdWarn = 1; console.warn('[CombatFx] backdrop failed', err); } }
        } else ok = true;
        if (ok) ctx.drawImage(bdc.c, 0, 0, W, H);
      }
      if (!ok) {
        const gr = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, hypot(W, H) * 0.6);
        gr.addColorStop(0, '#12183f'); gr.addColorStop(1, '#04061a'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
    }

    function chip(x, y, text, o) {                              // little chamfered label centred on x,y
      o = o || NO;
      ctx.font = (o.weight || 600) + ' ' + (o.size || 11) + 'px ' + (o.font || FONT_UI);
      const w = ctx.measureText(text).width + (o.pad === undefined ? 8 : o.pad) * 2, h = (o.size || 11) + (o.vpad === undefined ? 6 : o.vpad * 2);
      const bx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2, by = y - h / 2;
      chamfer(ctx, bx, by, w, h, min(4, h * 0.3));
      ctx.fillStyle = o.bg || 'rgba(6,9,26,0.88)'; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = o.border || ('rgba(' + BR + ',0.6)'); ctx.stroke();
      ctx.fillStyle = o.color || C.ivory; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, y + 0.5);
      return w;
    }

    function drawRocks() {
      const pr = min(grid.ch * 0.8, grid.cw * 0.42);              // the planet's radius (see layout): a rock is about half the planet's width
      for (const r of rocks) {
        const im = WAfx('rock-' + (r.art + 1)), x = cx(r.x), y = cy(r.y);   // art (0..7): one of the eight rendered rocks; v (0..2) the procedural fallback
        const px = max(14, pr * r.sz) | 0;                         // sz 0.75..1.15 per rock
        ctx.save(); ctx.translate(x, y); ctx.rotate(r.rot);
        if (im) { const k = min(px / im.naturalWidth, px / im.naturalHeight); ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); }
        else ctx.drawImage(rockSprite(r.v, px, dpr), -px / 2, -px / 2, px, px);
        ctx.restore();
      }
    }
    function drawDebris() {
      for (const d of DEBRIS) {
        if (!d.on) continue;
        const im = WAfx('debris-' + d.v); if (!im) { d.on = false; continue; }
        const k = min(d.s / im.naturalWidth, d.s / im.naturalHeight), a = d.age < d.life * 0.7 ? 1 : 1 - (d.age - d.life * 0.7) / (d.life * 0.3);
        ctx.save(); ctx.globalAlpha = a; ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k);
        ctx.restore();
      }
    }
    // grid lines only near the cursor (two cells, fading) and around the selected unit (one cell)
    function drawGridNear() {
      const cw = grid.cw, ch = grid.ch, gx = grid.x, gy = grid.y, au = units[activeId];
      const cells = [];
      if (hoverCell) cells.push([hoverCell.x, hoverCell.y, 2, 0.26]);
      if (au && !au.gone && au.alpha > 0.2) cells.push([round(au.x), round(au.y), 1, 0.2]);
      if (!cells.length) return;
      ctx.save(); ctx.lineWidth = 1;
      for (const [hx, hy, rad, a0] of cells) {
        for (let i = max(0, hx - rad); i <= min(9, hx + rad); i++) for (let j = max(0, hy - rad); j <= min(7, hy + rad); j++) {
          const d = max(abs(i - hx), abs(j - hy)), a = a0 * (1 - d / (rad + 1));
          ctx.strokeStyle = 'rgba(' + BR + ',' + a.toFixed(3) + ')';
          ctx.strokeRect(round(gx + i * cw) + 0.5, round(gy + j * ch) + 0.5, round(cw), round(ch));
        }
      }
      ctx.restore();
    }

    function drawHighlights(t) {
      const cw = grid.cw, ch = grid.ch, gx = grid.x, gy = grid.y, tk = min(cw, ch) * 0.15, pulse = 0.5 + 0.5 * sin(t * 3.2);
      if (moveCells.length) {
        ctx.save();
        ctx.fillStyle = 'rgba(98,216,255,' + (0.055 + 0.03 * pulse).toFixed(3) + ')';
        ctx.beginPath();
        for (const c of moveCells) if (!c.tele) ctx.rect(gx + c.x * cw + 2, gy + c.y * ch + 2, cw - 4, ch - 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(98,216,255,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (const c of moveCells) {
          if (c.tele) continue;
          const x = gx + c.x * cw + 4, y = gy + c.y * ch + 4, X = x + cw - 8, Y = y + ch - 8;
          ctx.moveTo(x, y + tk); ctx.lineTo(x, y); ctx.lineTo(x + tk, y); ctx.moveTo(X - tk, y); ctx.lineTo(X, y); ctx.lineTo(X, y + tk);
          ctx.moveTo(x, Y - tk); ctx.lineTo(x, Y); ctx.lineTo(x + tk, Y); ctx.moveTo(X - tk, Y); ctx.lineTo(X, Y); ctx.lineTo(X, Y - tk);
        }
        ctx.stroke();
        let hasT = false;
        ctx.fillStyle = 'rgba(169,139,255,' + (0.05 + 0.03 * pulse).toFixed(3) + ')'; ctx.strokeStyle = 'rgba(169,139,255,0.4)'; ctx.beginPath();
        for (const c of moveCells) if (c.tele) { hasT = true; ctx.rect(gx + c.x * cw + 3, gy + c.y * ch + 3, cw - 6, ch - 6); }
        if (hasT) { ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
      // targets in reach: rose brackets
      for (const tg of targetCells) {
        const u = units[tg.id]; if (!u || u.alpha < 0.3) continue;
        const x = gx + u.x * cw, y = gy + u.y * ch, a = 0.55 + 0.35 * pulse;
        ctx.save();
        ctx.fillStyle = 'rgba(255,92,106,' + (0.07 + 0.04 * pulse).toFixed(3) + ')'; ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
        ctx.strokeStyle = 'rgba(255,92,106,' + a.toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath();
        const x1 = x + cw - 2, y1 = y + ch - 2, x2 = x + 2, y2 = y + 2;
        ctx.moveTo(x2, y2 + tk * 1.3); ctx.lineTo(x2, y2); ctx.lineTo(x2 + tk * 1.3, y2); ctx.moveTo(x1 - tk * 1.3, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, y2 + tk * 1.3);
        ctx.moveTo(x2, y1 - tk * 1.3); ctx.lineTo(x2, y1); ctx.lineTo(x2 + tk * 1.3, y1); ctx.moveTo(x1 - tk * 1.3, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - tk * 1.3);
        ctx.stroke(); ctx.restore();
      }
      // hover
      if (hoverCell) {
        const x = gx + hoverCell.x * cw, y = gy + hoverCell.y * ch, isMove = moveCells.find(c => c.x === hoverCell.x && c.y === hoverCell.y), tg = targetCells.find(q => { const u = units[q.id]; return u && round(u.x) === hoverCell.x && round(u.y) === hoverCell.y; });
        ctx.save();
        if (isMove) {
          ctx.fillStyle = isMove.tele ? 'rgba(169,139,255,0.22)' : 'rgba(98,216,255,0.2)'; ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
          ctx.strokeStyle = isMove.tele ? C.violet : C.cyan; ctx.lineWidth = 1.5; ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6);
          const au = units[activeId];
          if (au && showPath && !isMove.tele) {
            ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 18; ctx.strokeStyle = 'rgba(98,216,255,0.8)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(cx(au.x), cy(au.y)); ctx.lineTo(x + cw / 2, y + ch / 2); ctx.stroke(); ctx.setLineDash([]);
          }
          chip(x + cw / 2, y + ch - 9, isMove.tele ? 'teleport' : String(isMove.cost) + (isMove.cost === 1 ? ' step' : ' steps'), { size: 10, color: isMove.tele ? C.violet : C.cyan, border: isMove.tele ? 'rgba(169,139,255,0.7)' : 'rgba(98,216,255,0.6)' });
        } else if (tg) {
          const au = units[activeId], u = units[tg.id];
          if (au && u) {
            ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 22; ctx.strokeStyle = 'rgba(255,92,106,0.85)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(cx(au.x), cy(au.y)); ctx.lineTo(cx(u.x), cy(u.y)); ctx.stroke(); ctx.setLineDash([]);
          }
          ctx.strokeStyle = C.rose; ctx.lineWidth = 1.6; ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
        } else { ctx.strokeStyle = ('rgba(' + BR + ',0.5)'); ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3); }
        ctx.restore();
      }
    }

    function drawSelection(t) {
      const u = units[activeId]; if (!u || u.gone || u.alpha < 0.2) return;
      const x = grid.x + u.x * grid.cw, y = grid.y + u.y * grid.ch, cw = grid.cw, ch = grid.ch, k = 0.5 + 0.5 * sin(t * 5), tk = min(cw, ch) * 0.24, p = 1 + k * 2;
      ctx.save();
      const side = u.side === 0 ? '98,216,255' : '255,160,110';
      const gl = ctx.createRadialGradient(x + cw / 2, y + ch / 2, 0, x + cw / 2, y + ch / 2, max(cw, ch) * 0.7);
      gl.addColorStop(0, 'rgba(' + side + ',0.16)'); gl.addColorStop(1, 'rgba(' + side + ',0)'); ctx.fillStyle = gl; ctx.fillRect(x - cw * 0.2, y - ch * 0.2, cw * 1.4, ch * 1.4);
      // the original's brick-red selection frame (a thin pale inner edge keeps it readable on red hulls)
      const x0 = x - p, y0 = y - p, x1 = x + cw + p, y1 = y + ch + p;
      const corners = () => { ctx.beginPath(); ctx.moveTo(x0, y0 + tk); ctx.lineTo(x0, y0); ctx.lineTo(x0 + tk, y0); ctx.moveTo(x1 - tk, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + tk); ctx.moveTo(x0, y1 - tk); ctx.lineTo(x0, y1); ctx.lineTo(x0 + tk, y1); ctx.moveTo(x1 - tk, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - tk); ctx.stroke(); };
      ctx.lineCap = 'square';
      ctx.strokeStyle = 'rgba(176,48,58,' + (0.85 + 0.15 * k).toFixed(2) + ')'; ctx.lineWidth = 2.6; corners();
      ctx.strokeStyle = 'rgba(255,214,200,' + (0.3 + 0.2 * k).toFixed(2) + ')'; ctx.lineWidth = 1; corners();
      ctx.restore();
    }

    function drawHpBar(x, y, w, frac, count, count0) {
      const h = max(4, grid.ch * 0.07);
      ctx.fillStyle = 'rgba(4,6,18,0.82)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      const col = frac > 0.6 ? C.leaf : frac > 0.3 ? C.ember : C.rose;
      const gr = ctx.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, rgba(col, 0.75)); gr.addColorStop(1, col);
      ctx.fillStyle = gr; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
      if (count0 > 1 && count0 <= 20) { ctx.strokeStyle = 'rgba(4,6,18,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < count0; i++) { const px = Math.round(x + w * i / count0) + 0.5; ctx.moveTo(px, y); ctx.lineTo(px, y + h); } ctx.stroke(); }
      ctx.strokeStyle = ('rgba(' + BR + ',0.5)'); ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    }

    const COPY_OFF = [[0, 0], [-0.2, -0.26], [-0.12, 0.26], [-0.3, 0.02]];
    function drawUnit(u, t, hover) {
      if (u.alpha < 0.02 && !u.warp) return;
      const x = cx(u.x), y = cy(u.y), A = u.alpha;
      if (u.kind === 'monster' && u.mkind === 'amoeba') { drawAmoeba(x, y, u, t); }
      else {
        const dir = u.side === 0 ? 1 : -1;
        const warpK = u.warp > 0 ? u.warp : 0;
        ctx.save();
        if (warpK > 0) { ctx.translate(x, y); ctx.scale(1 + warpK * 2.2, max(0.05, 1 - warpK * 0.85)); ctx.rotate(0); ctx.translate(-x, -y); ctx.globalAlpha = A * (1 - warpK); }
        else ctx.globalAlpha = A;
        const copies = u.copies | 0, S0 = G.Ships;
        if (S0 && S0.draw) {
          for (let i = copies - 1; i >= 0; i--) {
            const off = COPY_OFF[i], main = i === 0, sz = main ? u.len : u.len * 0.84;
            const o = { race: u.race, hull: u.kind === 'monster' ? 4 : clamp(u.hull | 0, 0, 3), x: x + off[0] * u.len * dir * 0.55, y: y + off[1] * grid.ch * 0.62 * (u.side === 0 ? 1 : 1), size: sz, angle: main ? u.angle : u.angle * 0.9 + (i % 2 ? 0.05 : -0.05), color: u.color, flags: u.flags, t: t + i * 1.7,
              thrust: u.moving ? 1 : 0.28, damage: main ? clamp(u.hploss / max(1, u.hp1), 0, 1) * (u.count > 0 ? 1 : 0) : 0, shield: main ? clamp(u.shieldGlow, 0, 1) : 0, cloaked: u.cloak, seed: u.seed + i * 17, vkey: u.vkey };
            if (!main) ctx.globalAlpha = A * (warpK > 0 ? 1 - warpK : 0.82);
            try { S0.draw(ctx, o); } catch (err) { if (!view._shipWarn) { view._shipWarn = 1; console.warn('[CombatFx] Ships.draw failed', err); } fallbackShip(x, y, u); break; }
          }
        } else fallbackShip(x, y, u);
        ctx.restore();
        if (u.kind === 'monster') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = u.len * 0.9, pul = 0.14 + 0.05 * sin(t * 1.6); ctx.globalAlpha = A * pul; ctx.drawImage(glowSprite(u.color), x - r, y - r, r * 2, r * 2); ctx.restore(); }
        if (u.flash > 0.02 && u.alpha > 0.2) {                                      // white-hot hit flash
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = u.flash * 0.55 * A; const r = u.len * 0.62; ctx.drawImage(glowSprite('#ffd9b0'), x - r, y - r, r * 2, r * 2); ctx.restore();
        }
        if (u.frozen > 0.02) {                                                      // ice shell
          ctx.save(); ctx.globalAlpha = u.frozen * 0.9 * A; const r = u.len * 0.58;
          ctx.strokeStyle = 'rgba(190,240,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.78, 0, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(150,220,255,0.16)'; ctx.fill();
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = u.frozen * 0.35 * A; ctx.drawImage(glowSprite('#9fe8ff'), x - r * 1.3, y - r * 1.3, r * 2.6, r * 2.6);
          ctx.restore();
        }
      }
      if (u.alpha < 0.3) return;
      // status strip: HP bar + count
      const bw = min(grid.cw * 0.84, max(u.len * 1.05, grid.cw * 0.5)), by = y + grid.ch * 0.5 - max(7, grid.ch * 0.1) - 2;
      ctx.globalAlpha = min(1, A * 1.4);
      drawHpBar(x - bw / 2, by, bw, u.hpShown, u.count, u.count0);
      if (u.count > 1) chip(x - bw / 2 + 2, by - 9, '×' + u.count, { size: clamp(grid.ch * 0.15, 10, 14), align: 'left', pad: 5, vpad: 2, color: C.ivory, border: rgba(u.color, 0.9) });
      if (u.retreating) chip(x + bw / 2, by - 9, 'RETREAT', { size: 9, align: 'right', pad: 4, vpad: 2, color: C.ember, border: 'rgba(255,148,64,0.8)' });
      if (u.frozenT) chip(x + bw / 2, by - 21, 'FROZEN', { size: 9, align: 'right', pad: 4, vpad: 2, color: '#9fe8ff', border: 'rgba(159,232,255,0.8)' });
      if (u.cloakT) chip(x + bw / 2, by - (u.frozenT || u.retreating ? 21 : 9), 'CLOAKED', { size: 9, align: 'right', pad: 4, vpad: 2, color: C.violet, border: 'rgba(169,139,255,0.8)' });
      if (u.id === activeId || hover) chip(x, y - grid.ch * 0.5 + 6, u.name, { size: clamp(grid.ch * 0.16, 10, 14), font: FONT_DISP, weight: 400, pad: 7, color: C.brassHi, border: rgba(u.color, 0.9) });
      ctx.globalAlpha = 1;
    }
    function fallbackShip(x, y, u) {                            // art is optional: a plain chevron
      ctx.save(); ctx.translate(x, y); ctx.rotate(u.angle); const L = u.len * 0.5;
      ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(-L * 0.8, -L * 0.5); ctx.lineTo(-L * 0.4, 0); ctx.lineTo(-L * 0.8, L * 0.5); ctx.closePath();
      ctx.fillStyle = u.color; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke(); ctx.restore();
    }
    function drawAmoeba(x, y, u, t) {
      const r = u.len * 0.55, ph = u.seed, N = 16, A = u.alpha;
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = A;
      const gl = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.7); gl.addColorStop(0, 'rgba(150,255,100,0.28)'); gl.addColorStop(1, 'rgba(150,255,100,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = (i % N) / N * TAU, rr = r * (0.82 + 0.16 * sin(t * 1.7 + (i % N) * 1.9 + ph) + 0.1 * sin(t * 2.9 + (i % N) * 3.1 + ph * 2) + (i % 4 === 0 ? 0.12 * sin(t * 0.9 + i) : 0));
        const px = cos(a) * rr * 1.1, py = sin(a) * rr * 0.9; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const body = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
      body.addColorStop(0, 'rgba(210,255,170,0.85)'); body.addColorStop(0.5, 'rgba(110,210,90,0.65)'); body.addColorStop(1, 'rgba(40,120,70,0.5)');
      ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,255,170,0.8)'; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) { const a = t * 0.3 + i * 2.1 + ph, d = r * (0.2 + 0.4 * ((i * 37) % 10) / 10), s = r * (0.06 + 0.05 * ((i * 53) % 7) / 7); ctx.fillStyle = 'rgba(190,255,150,0.5)'; ctx.beginPath(); ctx.arc(cos(a) * d, sin(a * 1.3) * d * 0.8, s, 0, TAU); ctx.fill(); }
      const nuc = r * (0.22 + 0.02 * sin(t * 3)); ctx.fillStyle = 'rgba(255,255,200,0.6)'; ctx.beginPath(); ctx.arc(r * 0.05, 0, nuc, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function drawPlanet(u, t) {
      if (!u) return;
      const x = cx(u.x), y = cy(u.y), R = u.R, dispOwner = u.color;
      // atmosphere / ownership glow
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 1.8); gl.addColorStop(0, rgba(dispOwner, 0.22)); gl.addColorStop(1, rgba(dispOwner, 0));
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, R * 1.8, 0, TAU); ctx.fill(); ctx.restore();
      const la = atan2(star.y - y, star.x - x);
      let drawn = false;
      const P = G.GLPlanets || G.Planets;
      if (P && P.draw && u.planetDesc) {
        try { P.draw(ctx, u.planetDesc, x, y, R, t, { dpr: dpr, lightAngle: la, spin: 0.01 }); drawn = true; } catch (err) { if (!view._plWarn) { view._plWarn = 1; console.warn('[CombatFx] planet draw failed', err); } }
      }
      if (!drawn) { const g2 = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R); g2.addColorStop(0, '#6a8ccf'); g2.addColorStop(1, '#10204a'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); }
      // limb glow: a soft atmosphere ring that follows the edge, brighter on the side facing the star
      { const lc = limbColor(u.planetDesc && u.planetDesc.look);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createRadialGradient(x, y, R * 0.88, x, y, R * 1.16);
        lg.addColorStop(0, rgba(lc, 0)); lg.addColorStop(0.42, rgba(lc, 0.28)); lg.addColorStop(0.62, rgba(lc, 0.16)); lg.addColorStop(1, rgba(lc, 0));
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(x, y, R * 1.16, 0, TAU); ctx.fill();
        ctx.lineWidth = max(1.5, R * 0.05); ctx.lineCap = 'round'; ctx.strokeStyle = rgba(lc, 0.5); ctx.beginPath(); ctx.arc(x, y, R * 1.0, la - 1.25, la + 1.25); ctx.stroke();
        ctx.restore();
        ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = rgba(dispOwner, 0.4); ctx.beginPath(); ctx.arc(x, y, R * 1.05, 0, TAU); ctx.stroke(); ctx.restore(); }
      // planetary shield: a faint bubble that lights up when struck
      if (u.shieldLvl > 0 && !(B && B.nebula)) {
        const sg = u.shieldGlow, br = R * 1.32;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g3 = ctx.createRadialGradient(x, y, br * 0.82, x, y, br); g3.addColorStop(0, 'rgba(98,216,255,0)'); g3.addColorStop(0.8, 'rgba(98,216,255,' + (0.05 + 0.12 * sg).toFixed(3) + ')'); g3.addColorStop(1, 'rgba(160,235,255,' + (0.28 + 0.5 * sg).toFixed(3) + ')');
        ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
        ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 6; ctx.strokeStyle = 'rgba(160,235,255,' + (0.22 + 0.4 * sg).toFixed(3) + ')'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      }
      if (u.flash > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = u.flash * 0.5; const r = R * 1.2; ctx.drawImage(glowSprite('#ffb070'), x - r, y - r, r * 2, r * 2); ctx.restore(); }
      // missile bases in orbit
      const nb = min(6, u.count);
      if (nb > 0) {                                                                 // lit platform sprites (the rendered cutout when it exists)
        const orbit = R * 1.5, bs = min(grid.cw * 0.3, R * 0.9), im = WAfx('base-platform'), spr = im ? null : baseSprite(bs | 0, u.color, dpr);
        for (let i = 0; i < nb; i++) {
          const a = t * 0.16 + i / nb * TAU + 0.6, bx = x + cos(a) * orbit * 1.0, by = y + sin(a) * orbit * 0.62;
          ctx.save(); ctx.translate(bx, by); ctx.rotate(a * 0.5 + i);
          if (im) {
            const k = min(bs / im.naturalWidth, bs / im.naturalHeight); ctx.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k);
            ctx.globalCompositeOperation = 'lighter'; const r2 = bs * 0.14, lx = bs * 0.41, bl = 0.5 + 0.5 * sin(t * 3 + i); ctx.globalAlpha = 0.5 + 0.5 * bl; ctx.drawImage(glowSprite(u.color), lx - r2, -r2, r2 * 2, r2 * 2);   // the beacon lens on the platform's right edge
          } else ctx.drawImage(spr, -bs / 2, -bs / 2, bs, bs);
          ctx.restore();
        }
      }
      // label + base strength
      if (u.alpha > 0.3) {
        const by = y + R + grid.ch * 0.34;
        ctx.globalAlpha = 1;
        const nm = u.name || 'Planet';
        chip(x, by - 2, nm, { size: clamp(grid.ch * 0.16, 10, 14), font: FONT_DISP, weight: 400, pad: 8, color: C.brassHi, border: rgba(u.color, 0.9) });
        if (u.count > 0 || u.bases0 > 0) {
          const bw = min(grid.cw * 0.84, R * 2.2);
          drawHpBar(x - bw / 2, by + 11, bw, u.hpShown, u.count, u.count0);
          chip(x - bw / 2 + 2, by + 24, u.count > 0 ? u.count + ' base' + (u.count > 1 ? 's' : '') : 'no bases', { size: 10, align: 'left', pad: 5, vpad: 2, color: u.count > 0 ? C.ivory : C.rose, border: rgba(u.color, 0.8) });
        }
      }
    }

    function drawMissiles(t) {
      if (!missiles.size) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const s = clamp(grid.base / 120, 0.7, 1.6);
      for (const [, m] of missiles) {
        const x = cx(m.x), y = cy(m.y), al = m.fade > 0 ? m.fade : 1, col = m.col, spr = glowSprite(col), tr = m.trail;
        if (tr.length >= 4) {                                 // trail
          for (let i = 2; i < tr.length; i += 2) {
            const k = i / tr.length, ax = cx(tr[i - 2]), ay = cy(tr[i - 1]), bx = cx(tr[i]), by = cy(tr[i + 1]);
            ctx.strokeStyle = rgba(col, 0.55 * k * al); ctx.lineWidth = (1.2 + 3 * k) * s * (m.big ? 1.6 : 1); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
        const heads = clamp(Math.ceil(m.n / (m.kind === 'scatter' ? 6 : 14)), 1, m.kind === 'scatter' ? 7 : 4), ang = m.ang === undefined ? 0 : m.ang;
        for (let h = 0; h < heads; h++) {
          const lat = (h - (heads - 1) / 2) * 7 * s, hx = x - sin(ang) * lat, hy = y + cos(ang) * lat, fl = 0.85 + 0.15 * sin(t * 40 + h * 2 + m.mid), r = (m.big ? 18 : 11) * s * fl;
          ctx.globalAlpha = 0.95 * al; ctx.drawImage(spr, hx - r, hy - r, r * 2, r * 2);
          ctx.globalAlpha = al; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, (m.big ? 3 : 2) * s, 0, TAU); ctx.fill();
        }
        if (m.n > 1 && m.kind !== 'scatter') { ctx.globalAlpha = 0.9 * al; ctx.font = '600 10px ' + FONT_UI; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('×' + m.n, x + 9 * s, y - 9 * s); }
      }
      ctx.restore();
    }

    function drawTexts() {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const q of texts) {
        if (!q.on || q.age < 0) continue;
        const k = q.age / q.life, a = k < 0.1 ? k / 0.1 : k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1, sc = k < 0.12 ? 0.7 + 0.3 * (k / 0.12) + 0.25 * (1 - k / 0.12) : 1;
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.font = (q.bold ? '700 ' : '500 ') + (q.size * sc) + 'px ' + FONT_UI;
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(4,6,18,0.9)'; ctx.strokeText(q.txt, q.x, q.y);
        ctx.fillStyle = q.col; ctx.fillText(q.txt, q.x, q.y);
      }
      ctx.globalAlpha = 1;
    }

    function drawBanner() {
      if (!bannerT) return;
      const b = bannerT, k = b.age / b.life, a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1, sz = clamp(min(W * 0.055, H * 0.09), 24, 64);
      const x = W / 2, y = grid.y + grid.h * 0.46;
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
      const w = min(W * 0.7, sz * (b.text.length * 0.7 + 4)), hh = sz * 1.5;
      const gr = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); gr.addColorStop(0, 'rgba(4,6,20,0)'); gr.addColorStop(0.2, 'rgba(4,6,20,0.62)'); gr.addColorStop(0.8, 'rgba(4,6,20,0.62)'); gr.addColorStop(1, 'rgba(4,6,20,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - w / 2, y - hh / 2, w, hh);
      ctx.strokeStyle = rgba(b.color, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - w * 0.4, y - hh / 2); ctx.lineTo(x + w * 0.4, y - hh / 2); ctx.moveTo(x - w * 0.4, y + hh / 2); ctx.lineTo(x + w * 0.4, y + hh / 2); ctx.stroke();
      ctx.font = '400 ' + sz + 'px ' + FONT_DISP; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = rgba(b.color, 0.7); ctx.shadowBlur = 18; ctx.fillStyle = b.color; ctx.fillText(b.text.toUpperCase(), x, y - (b.sub ? sz * 0.12 : 0));
      ctx.shadowBlur = 0;
      if (b.sub) { ctx.font = '500 ' + sz * 0.3 + 'px ' + FONT_UI; ctx.fillStyle = C.mist; ctx.fillText(b.sub, x, y + sz * 0.5); }
      ctx.restore();
    }

    // draw order: backdrop → grid → rocks → planet → highlights → units (by row) → missiles → fx → texts → banner
    const sorted = [];
    view.frame = function (dt, t) {
      if (!ctx || !view.ready) return;
      dt = min(dt, 0.1);
      stepSeq(dt); update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      drawBackdrop(dt, t);
      const sh = fx && fx.shake > 0.3 ? fx.shake : 0, nk = nud.t > 0 ? sin(PI * nud.t / 0.12) : 0;
      ctx.save();
      if (sh || nk) ctx.translate((Math.random() - 0.5) * sh * 0.9 + nud.x * nk, (Math.random() - 0.5) * sh * 0.9 + nud.y * nk);
      buildGridLayer(); ctx.drawImage(gridLayer, 0, 0, W, H);
      drawGridNear();
      drawRocks(); drawDebris();
      if (planetU) drawPlanet(planetU, t);
      drawHighlights(t);
      sorted.length = 0;
      for (const u of units) if (u && u.kind !== 'planet') sorted.push(u);
      sorted.sort((a, b) => (a.y - b.y) || (a.id - b.id));
      const hov = hoverCell ? view.unitAtCell(hoverCell.x, hoverCell.y) : null;
      for (const u of sorted) drawUnit(u, t, hov === u);
      drawSelection(t);
      drawMissiles(t);
      if (fx) fx.draw(ctx);
      drawTexts();
      ctx.restore();
      if (fx && fx.flash > 0.02) { ctx.fillStyle = 'rgba(255,248,235,' + clamp(fx.flash * 0.3, 0, 0.35).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      drawBanner();
      // canvas label for the planet when hovered is handled by the controller's tooltip
    };
    view.hitChanceLabel = null;
    view.resize = resize;
    view.dispose = function () { if (fx && fx.clear) fx.clear(); jobs.length = 0; job = null; sched.length = 0; for (const d of DEBRIS) d.on = false; nud.t = 0; };
    view.isInstant = () => spdK() <= 0;
    view.unitsList = () => units;
    return view;
  }

  UI.CombatFx = { createView, EMP, MON, beamInfo, misKind, BEAM_COL, MIS_COL, FONT_UI, FONT_DISP };
})(window.MOO);
