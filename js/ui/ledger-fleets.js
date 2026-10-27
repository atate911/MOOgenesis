// Fleet ledger + Specs (research/06 §5.9 / §5.10). Screens 'fleets' (grid: one row per star where you have ships, one column per design) and 'specs'
// (one row per design: stats, weapons, specials, cost, Scrap). Both ids open the same two-tab view.
//   UI.Screens.go('fleets', {from, mode:'grid'|'specs', scrap:true})      V = Specs / Fleets · S = scrap · 1-6 = pick / scrap that design · O / Space / Esc / right-click = OK
//   Orders used: scrapDesign {slot}.  Row click jumps to the fleet on the galaxy screen (stationary stacks open Fleet Deployment).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util;

  UI.css('ledger-fleets', `
    .lf { position:absolute; inset:0; display:flex; padding:1rem 1.3rem; overflow:hidden;
      background: radial-gradient(110% 80% at 88% 0%, #1b2a78 0%, rgba(27,42,120,0) 58%), radial-gradient(90% 70% at 0% 100%, #2a1a58 0%, rgba(42,26,88,0) 62%), var(--void); }
    .lf-sheet { flex:1 1 auto; min-width:0; max-width:112rem; margin:0 auto; display:flex; flex-direction:column; min-height:0; padding:.8rem 1rem .9rem; }
    .lf-head { display:flex; align-items:flex-end; gap:1.2rem; padding-bottom:.55rem; margin-bottom:.5rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .lf-title { font:400 2.1rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; text-shadow:0 0 22px rgba(214,179,106,.28); }
    .lf-sub { padding-bottom:.18rem; color:var(--mist); font-size:.98rem; } .lf-sub b { color:var(--ivory); font-weight:600; font-variant-numeric:tabular-nums; }
    .lf-head .tabs { margin:0 0 -.55rem auto; border-bottom:0; } .lf-head .tabs button { padding:.3rem 1rem .5rem; font-size:1.08rem; }
    .lf-banner { display:none; margin:0 0 .5rem; padding:.4rem .8rem; align-items:center; gap:.6rem; color:var(--rose); border:1px solid rgba(255,92,106,.55); background:rgba(255,92,106,.09); animation:lf-pulse 1.8s ease-in-out infinite; }
    .lf-banner.on { display:flex; } .lf-banner .ico { width:1.2em; height:1.2em; } .lf-banner.hint { color:var(--gold); border-color:rgba(255,213,79,.55); background:rgba(255,213,79,.08); }
    @keyframes lf-pulse { 50% { filter:brightness(1.35); } }
    .lf-body { flex:1 1 auto; min-height:0; overflow:auto; background:rgba(3,5,18,.5); box-shadow:inset 0 0 0 1px rgba(214,179,106,.2); }
    .lf-grid { --cols:15.5rem repeat(6, minmax(6.6rem, 1fr)); min-width:min-content; display:flex; flex-direction:column; min-height:100%; }
    .lf-grid .lf-row.total { margin-top:auto; }
    .lf-row { display:grid; grid-template-columns:var(--cols); align-items:stretch; border-bottom:var(--hair-w, 1px) solid var(--hair, rgba(255,255,255,.05)); cursor:var(--hand); transition:background .1s; }
    .lf-row:hover { background:rgba(98,216,255,.09); } .lf-row.head { position:sticky; top:0; z-index:2; cursor:default; background:#0d1540; border-bottom:1px solid rgba(214,179,106,.45); }
    .lf-row.head:hover { background:#0d1540; } .lf-row.total { position:sticky; bottom:0; z-index:2; cursor:default; background:#0d1540; border-top:1px solid rgba(214,179,106,.45); border-bottom:0; }
    .lf-row.total:hover { background:#0d1540; }
    .lf-h { padding:.45rem .5rem .4rem; text-align:center; border-left:var(--hair-w, 1px) solid var(--hair, rgba(255,255,255,.05)); }
    .lf-h .nm { display:block; font:400 1.12rem/1.1 var(--font-title); color:var(--brass-hi); letter-spacing:.02em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .lf-h .sub { display:block; margin-top:.15rem; font-size:.9rem; color:var(--mist); letter-spacing:.04em; }
    .lf-h.none .nm { color:var(--fog); font-family:var(--font-display); font-size:.95rem; letter-spacing:.07em; text-transform:uppercase; }
    .lf-h.st { text-align:left; padding-left:.9rem; border-left:0; font:400 .95rem var(--font-display); color:var(--brass); letter-spacing:.07em; text-transform:uppercase; align-self:center; }
    .lf-scrapmode .lf-h:not(.none):not(.st) { cursor:var(--hand); box-shadow:inset 0 -2px 0 var(--rose); background:rgba(255,92,106,.1); }
    .lf-scrapmode .lf-h:not(.none):not(.st):hover { background:rgba(255,92,106,.24); }
    .lf-st { display:flex; align-items:center; gap:.75rem; padding:.45rem .6rem .45rem .9rem; min-width:0; }
    .lf-pic { flex:none; width:3.7rem; height:3.7rem; display:grid; place-items:center; position:relative; }
    .lf-pic :is(canvas, img) { width:100%; height:100%; }
    .lf-pic.mv { width:3.7rem; height:3.1rem; background:radial-gradient(circle at 30% 40%, #1a2468, #070b24 75%); box-shadow:inset 0 0 0 1px rgba(214,179,106,.4); }
    .lf-pic.mv canvas { width:100%; height:100%; }
    .lf-info { min-width:0; line-height:1.2; } .lf-info .nm { font:400 1.12rem var(--font-title); color:var(--brass-hi); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lf-info .stt { font-size:.86rem; color:var(--mist); } .lf-info .stt b { color:var(--cyan); font-weight:600; } .lf-info .stt .own { color:var(--leaf); } .lf-info .stt .foe { color:var(--rose); }
    .lf-cell { position:relative; display:grid; place-items:center; min-height:4.4rem; border-left:var(--hair-w, 1px) solid var(--hair, rgba(255,255,255,.05)); }
    .lf-cell canvas { width:100%; height:3.6rem; object-fit:contain; }
    .lf-n { position:absolute; right:.45rem; bottom:.3rem; min-width:1.5rem; padding:0 .4rem; text-align:center; font:600 .95rem/1.5 var(--font-ui); color:var(--ivory); font-variant-numeric:tabular-nums;
      background:rgba(8,12,34,.92); border:1px solid rgba(243,220,160,.7); clip-path:polygon(.2rem 0,100% 0,100% calc(100% - .2rem),calc(100% - .2rem) 100%,0 100%,0 .2rem); }
    .lf-total .v { font:400 1.25rem var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; } .lf-total { display:grid; place-items:center; padding:.4rem; border-left:1px solid rgba(255,255,255,.05); }
    .lf-total.lbl { place-items:center start; padding-left:.9rem; border-left:0; font:400 .95rem var(--font-display); color:var(--brass); letter-spacing:.07em; text-transform:uppercase; }
    .lf-empty { padding:3rem 1rem; text-align:center; color:var(--mist); font-size:1.1rem; }
    .lf-foot { margin-top:.7rem; display:flex; align-items:center; gap:.8rem; }
    .lf-maint { display:flex; align-items:baseline; gap:.6rem; padding:.45rem .9rem; background:rgba(5,8,26,.6); border:1px solid rgba(214,179,106,.3); }
    .lf-maint .k { font:400 .95rem var(--font-display); color:var(--brass); letter-spacing:.06em; text-transform:uppercase; } .lf-maint b { font:400 1.5rem var(--font-title); color:var(--gold); font-variant-numeric:tabular-nums; } .lf-maint .u { color:var(--gold); }
    .lf-maint .x { color:var(--mist); font-size:.88rem; }
    .lf-note { flex:1; color:var(--mist); font-size:.88rem; }
    .lf-foot .sp { flex:1; }
    .lf-srow { display:grid; grid-template-columns:9rem 11.5rem minmax(21rem, 1.7fr) minmax(8rem, 1fr) minmax(8rem, 1fr) 6.5rem; gap:.9rem; align-items:center; padding:.7rem 1rem; border-bottom:1px solid rgba(255,255,255,.06); cursor:var(--hand); transition:background .1s; }
    .lf-srow:hover { background:rgba(98,216,255,.07); } .lf-srow.none { cursor:default; opacity:.55; } .lf-srow.none:hover { background:none; }
    .lf-spic { position:relative; height:5.2rem; display:grid; place-items:center; background:radial-gradient(ellipse at 50% 50%, rgba(40,58,140,.55), rgba(5,8,26,.4) 70%); box-shadow:inset 0 0 0 1px rgba(214,179,106,.32); }
    .lf-spic canvas { width:100%; height:100%; object-fit:contain; }
    .lf-spic .lf-n { right:auto; left:.4rem; bottom:auto; top:.3rem; }
    .lf-sname .nm { font:400 1.4rem/1.1 var(--font-title); color:var(--brass-hi); }
    .lf-sname .cls { margin:.15rem 0 .45rem; color:var(--mist); font-size:.9rem; letter-spacing:.04em; }
    .lf-stats { display:grid; grid-template-columns:repeat(7, 1fr); gap:.35rem; }
    .lf-stat { padding:.28rem .2rem .3rem; text-align:center; background:rgba(0,0,0,.34); border:1px solid rgba(214,179,106,.24); }
    .lf-stat .v { display:block; font:400 1.4rem/1.1 var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; }
    .lf-stat { min-width:0; } .lf-stat .l { display:block; margin-top:.1rem; font-size:.8rem; line-height:1.1; letter-spacing:.05em; color:var(--mist); text-transform:uppercase; }
    .lf-stat.warp .v { color:var(--cyan); } .lf-stat.hits .v { color:var(--leaf); } .lf-stat.att .v { color:var(--ember); } .lf-stat.shd .v, .lf-stat.bdef .v, .lf-stat.mdef .v { color:var(--azure); }
    .lf-stat.zero .v { color:var(--fog); }
    .lf-wl { display:flex; flex-direction:column; gap:.2rem; font-size:.98rem; } .lf-wl .ln { display:flex; align-items:center; gap:.45rem; } .lf-wl .ln .ico { width:1.1em; height:1.1em; color:var(--ember); }
    .lf-wl .ln.missile .ico, .lf-wl .ln.torpedo .ico { color:var(--azure); } .lf-wl .ln.bomb .ico, .lf-wl .ln.bio .ico { color:var(--rose); }
    .lf-wl .ln .c { color:var(--mist); font-variant-numeric:tabular-nums; } .lf-wl .none { color:var(--fog); }
    .lf-sp .ln { font-size:.98rem; line-height:1.4; } .lf-sp .ln.col { color:var(--leaf); } .lf-sp .ln.tank { color:var(--cyan); } .lf-sp .none { color:var(--fog); }
    .lf-cost { text-align:right; } .lf-cost .l { display:block; font-size:.8rem; letter-spacing:.08em; color:var(--mist); text-transform:uppercase; } .lf-cost b { display:block; font:400 1.6rem/1.15 var(--font-title); color:var(--gold); font-variant-numeric:tabular-nums; }
    .lf-cost .u { color:var(--gold); font-size:.9rem; } .lf-cost .up { display:block; margin-top:.1rem; font-size:.86rem; color:var(--mist); }
    .lf-srow .btn { margin-top:.1rem; }
    .lf-hint { display:flex; gap:.35rem; align-items:center; color:var(--fog); font-size:.9rem; margin-left:.5rem; }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: tool-screen family (bronze bevel frame, recessed cells, black picture tiles, amber/red stat slots, gold names).
  UI.css('ledger-fleets-orig', bump(`
    .lf { --bz-hi:#b39677; --bz-md:#826551; --bz-lo:#3a2c21; --bz-slot:var(--well-leather, #1a1410); --bz-gold:#f48201; --bz-pale:#f0dcc0;
      background:radial-gradient(90% 70% at 50% 0%, #2f2218 0%, rgba(47,34,24,0) 70%), #120d09; }
    .lf-sheet { padding:.7rem .9rem .8rem; background:linear-gradient(135deg, var(--bz-hi), var(--bz-md) 18%, #6d5645 60%, var(--bz-lo)); box-shadow:inset 1px 1px 0 rgba(255,235,200,.35), inset -1px -1px 0 rgba(0,0,0,.65), 0 0 0 1px #000, 0 10px 40px rgba(0,0,0,.6); }
    .lf-sheet::before, .lf-sheet::after { display:none; }
    .lf-head { border-bottom:0; padding-bottom:.4rem; }
    .lf-title { color:var(--title-hi); text-shadow:var(--title-shadow); font:400 1.85rem/1 var(--font-display); letter-spacing:.06em; text-transform:uppercase; }   /* one title style on every tool screen (Research, Races, Stats) */
    .lf-h.none .nm { color:var(--bz-pale); opacity:.45; }                                                   /* an empty design slot's column reads as empty, not as a design */
    .lf-sub { color:#ead4b0; } .lf-sub b { color:var(--bz-pale); }
    .lf-body { background:#2f231a; box-shadow:inset 1px 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.7), 0 1px 0 1px rgba(255,235,200,.15); }
    .lf-body { background:linear-gradient(180deg, rgba(26,20,16,.92) 0%, rgba(26,20,16,.8) 22%, rgba(26,20,16,.62) 100%), url('assets/art/scene/scene-galaxy.webp') 50% 60% / cover no-repeat #120d09; }
    .lf-row { border-bottom:1px solid rgba(0,0,0,.55); box-shadow:0 1px 0 rgba(255,235,200,.06); } .lf-row:hover { background:rgba(255,215,140,.07); }
    .lf-row.head, .lf-row.total, .lf-row.head:hover, .lf-row.total:hover { background:#4a3a2c; border-color:rgba(0,0,0,.7); }
    .lf-h { border-left-color:rgba(0,0,0,.5); box-shadow:inset 1px 0 0 rgba(255,235,200,.08); }
    .lf-h .nm { color:var(--bz-gold); font-family:var(--font-display); font-size:.98rem; letter-spacing:.07em; text-transform:uppercase; }
    .lf-h .sub { color:#ead4b0; } .lf-h.st, .lf-total.lbl { color:var(--bz-pale); }
    .lf-cell { border-left-color:rgba(0,0,0,.6); box-shadow:inset 1px 0 0 var(--hair, rgba(255,235,200,.06)); background:var(--bz-slot); }
    .lf-cell canvas { background:radial-gradient(ellipse at 50% 40%, #3b2e22 0%, #1d1610 100%); margin:.15rem; width:calc(100% - .3rem); box-shadow:inset 1px 1px 3px rgba(0,0,0,.8), inset -1px -1px 0 rgba(255,235,200,.12), 0 0 0 1px rgba(255,235,200,.22); }
    .lf-n { background:transparent; border:0; clip-path:none; color:#f0e060; text-shadow:0 1px 0 #000, 0 0 3px #000; font-family:var(--font-mono, monospace); }
    .lf-pic, .lf-pic.mv { background:radial-gradient(ellipse at 50% 40%, #3b2e22 0%, #1d1610 100%); box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.18); }   /* one tile for planet and moving-fleet thumbnails (and the Planets ledger's) */
    .lf-info .nm { color:var(--bz-gold); } .lf-info .stt { color:#ead4b0; }
    .lf-maint { background:var(--well-leather, #1a1410); border:0; box-shadow:inset 1px 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.14); }
    .lf-maint .k { color:var(--bz-pale); } .lf-maint b, .lf-maint .u { color:#f0e060; }
    .lf-srow { border-bottom:1px solid rgba(0,0,0,.55); box-shadow:0 1px 0 rgba(255,235,200,.06); }
    .lf-spic { background:radial-gradient(ellipse at 50% 40%, #3b2e22 0%, #1d1610 100%); box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.18); }
    .lf-sname .nm { color:var(--bz-gold); font-family:var(--font-display); letter-spacing:.06em; text-shadow:0 1px 0 #000; }
    .lf-sname .cls { color:#ead4b0; }
    .lf-stat { background:var(--well-leather-2, #14100c); border:0; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,235,200,.12); }
    .lf-stat .v { color:#ff9a62; font-family:var(--font-mono, monospace); font-size:1.15rem; } .lf-stat .l { color:#f0b868; }
    .lf-stat.warp .v, .lf-stat.hits .v, .lf-stat.att .v, .lf-stat.shd .v, .lf-stat.bdef .v, .lf-stat.mdef .v { color:#ff9a62; } .lf-stat.zero .v { color:#b9a68c; }
    .lf-sp .ln.col, .lf-sp .ln.tank { color:#70e060; }
    .lf-cost b, .lf-cost .u { color:#f0e060; }
    .lf-foot .btn { clip-path:none; background:rgba(0,0,0,.85); box-shadow:none; color:#fff; text-shadow:0 1px 0 #000; font:600 .85rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; }
    .lf-foot .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #8c8f9a, #5c606c); box-shadow:inset 1px 1px 0 rgba(255,255,255,.35), inset -1px -1px 0 rgba(0,0,0,.5); }
    .lf-foot .btn:hover::before { background:linear-gradient(180deg, #a0a4b0, #6c707c); }
    .lf-head .tabs button { color:#ead4b0; } .lf-head .tabs button.active { color:var(--bz-gold); border-bottom-color:var(--bz-gold); }
  `));

  const EMP = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];
  const HULL_NAME = ['Small', 'Medium', 'Large', 'Huge'];
  const empCol = E => { let c = ''; try { c = getComputedStyle(document.documentElement).getPropertyValue('--emp' + E.color).trim(); } catch (e) { c = ''; } return c || EMP[E.color % 6]; };
  const dpr = () => Math.min(2, (M.Perf && M.Perf.dpr ? M.Perf.dpr() : window.devicePixelRatio) || 1);
  const K = () => M.Data && M.Data.Components;

  // ---- art ---------------------------------------------------------------------------------------------------------------------------------
  function shipFlags(st) {
    const f = { colony: st.colonyMin > 0, beams: false, missiles: false, bomb: (st.bombs | 0) + (st.bio | 0) > 0 };
    for (const w of (st.weapons || [])) { if (w.kind === 'beam') f.beams = true; else if (w.kind === 'missile' || w.kind === 'torpedo') f.missiles = true; }
    return f;
  }
  // ship sprite on its own canvas (backing store w × hh px, contain-fit); the CSS box is set by the caller's class
  const HULL_FIT = [0.56, 0.68, 0.8, 0.9];          // share of the canvas width a Small / Medium / Large / Huge hull fills: keeps the size hierarchy readable
  const HULL_FIT_H = [0.74, 0.82, 0.9, 0.96];       // share of its height (looser: the cells are short and wide, a long thin hull must not be shrunk by the height rule)
  function shipCanvas(E, slot, w, hh) {
    const c = h('canvas', { width: w, height: hh }), d = E.designs[slot];
    if (!d) return c;
    try {
      const st = M.Sim.Design.stats(G.S, E, slot), hull = Math.max(0, Math.min(3, d.hull | 0)), f = HULL_FIT[hull];
      const col = empCol(E), flags = shipFlags(st), vk = M.Gfx.Ships.designKey ? M.Gfx.Ships.designKey(E.id, slot, d.name) : null;
      const probe = M.Gfx.Ships.sprite(E.race, hull, 64, col, flags, vk);                                          // a small render (cached) tells the hull's aspect
      const size = Math.max(8, Math.round(64 * Math.min(w * f / probe.width, hh * HULL_FIT_H[hull] / probe.height)));   // the hull's share of the box on both axes, so the hierarchy holds whatever the box's shape
      const sp = M.Gfx.Ships.sprite(E.race, hull, size, col, flags, vk);
      const k = Math.min(w / sp.width, hh / sp.height, 1), x = c.getContext('2d');                              // never upscaled: rendered at its own size, so it stays sharp
      x.drawImage(sp, (w - sp.width * k) / 2, (hh - sp.height * k) / 2, sp.width * k, sp.height * k);
    } catch (e) { /* art is optional */ }
    return c;
  }
  function planetPic(p, size) {
    const WA = M.Gfx && M.Gfx.WorldArt, path = WA && WA.enabled ? WA.orbit(p, G.S) : null;     // the orbit plate, else the planet sprite
    if (path) return WA.image(path, { fx: 0.5, fy: 0.5 });
    const c = h('canvas', { width: size, height: size });
    try {
      const look = p.type === 'none' ? 'asteroids' : (p.growth === 'gaia' ? 'gaia' : p.type);
      const sp = M.Gfx.pick('planets').sprite({ look, seed: p.id * 7919 + (p.gfx | 0), inhabited: p.owner >= 0, color: p.owner >= 0 ? empCol(G.S.empires[p.owner]) : undefined }, size);
      c.getContext('2d').drawImage(sp, 0, 0, size, size);
    } catch (e) { const x = c.getContext('2d'); x.fillStyle = '#556'; x.beginPath(); x.arc(size / 2, size / 2, size * 0.38, 0, 6.3); x.fill(); }
    return c;
  }
  function movingPic(f, E, size) {
    const c = h('canvas', { width: size, height: Math.round(size * 0.84) }), x = c.getContext('2d');
    try {
      const S = G.S, A = S.stars[f.from], B = S.stars[f.to];
      for (let i = 0; i < 16; i++) { const px = (Math.sin(i * 12.9 + f.id) * 0.5 + 0.5) * c.width, py = (Math.sin(i * 7.7 + f.id * 3) * 0.5 + 0.5) * c.height; x.fillStyle = 'rgba(200,215,255,' + (0.25 + (i % 4) * 0.12) + ')'; x.fillRect(px, py, 1.5, 1.5); }
      M.Gfx.Ships.drawFleetMarker(x, c.width / 2, c.height / 2, size * 0.2, empCol(E), Math.atan2(B.y - A.y, B.x - A.x), 1.2, { moving: true });
    } catch (e) { /* art is optional */ }
    return c;
  }

  // ---- data ---------------------------------------------------------------------------------------------------------------------------------
  function collect() {
    const S = G.S, E = G.player(), pid = E.id, D = M.Sim.Design, F = M.Sim.Fleet;
    const counts = [0, 0, 0, 0, 0, 0], rows = [], own = {};
    for (const p of S.planets) if (p.owner === pid) own[p.starId] = true;
    for (const f of S.fleets) {
      if (f.owner !== pid) continue;
      const tot = f.ships.reduce((a, b) => a + b, 0); if (tot <= 0) continue;
      for (let i = 0; i < 6; i++) counts[i] += f.ships[i] | 0;
      const moving = f.star < 0, sid = moving ? f.to : f.star, p = S.planets[sid];
      rows.push({ id: f.id, star: f.star, from: f.from, to: f.to, ships: f.ships.slice(), total: tot, moving, eta: moving ? F.etaLeft(S, f) : 0, speed: f.speed,
        name: p && p.name ? p.name : S.stars[sid].name, planet: moving && !E.explored[sid] ? null : p, known: !moving || !!E.explored[sid], colony: !moving && !!own[f.star], foe: !moving && p && p.owner >= 0 && p.owner !== pid });
    }
    rows.sort((a, b) => (a.moving - b.moving) || (b.colony - a.colony) || (a.moving ? a.eta - b.eta : a.name.localeCompare(b.name)));
    const designs = [];
    for (let i = 0; i < 6; i++) {
      const d = E.designs[i];
      if (!d) { designs.push({ slot: i, empty: true, count: 0 }); continue; }
      const st = D.stats(S, E, i);
      designs.push({ slot: i, empty: false, d, st, name: d.name, hull: Math.max(0, Math.min(3, d.hull | 0)), cost: D.cost(S, E, i), count: counts[i] });
    }
    let maint = { ships: (E.flow && E.flow.shipM) | 0, bases: 0, gates: 0, total: 0 };
    try { if (D.maintenance) { const m = D.maintenance(S, E); if (m && isFinite(m.ships)) maint = m; } } catch (e) { /* fall back to the cached flow */ }
    const trans = (S.trans || []).filter(t => t.owner === pid);
    return { S, E, rows, designs, maint, gross: (E.flow && E.flow.gross) | 0, transCount: trans.length, transPop: trans.reduce((a, t) => a + t.n, 0), ships: counts.reduce((a, b) => a + b, 0) };
  }

  // ---- behaviour ----------------------------------------------------------------------------------------------------------------------------
  function make(startMode) {
    const st = { mode: startMode, scrap: false, from: 'galaxy', d: null, hint: '' };
    let el, body, banner, tabs = {}, btnSpecs, btnScrap, maintBox, noteEl, subEl;

    function close(snd) { if (snd) UI.sfx(snd); UI.Screens.go(st.from || 'galaxy'); }
    function setMode(m) {
      st.mode = m; st.scrap = st.scrap && m === 'grid';
      el.classList.toggle('lf-scrapmode', st.scrap);
      for (const k in tabs) tabs[k].classList.toggle('active', k === m);
      paintBtns(); paint();
    }
    function setScrap(on) {
      st.scrap = !!on && st.mode === 'grid'; el.classList.toggle('lf-scrapmode', st.scrap);
      paintBtns(); paint();
    }
    function paintBanner() {
      const scr = st.scrap && st.mode === 'grid';
      banner.classList.toggle('on', scr || !!st.hint); banner.classList.toggle('hint', !scr && !!st.hint);
      UI.mount(banner, UI.icon(scr ? 'warning' : 'info'), h('span', scr ? 'Scrap: ' + UI.Phone.say('click', 'tap') + ' the design to scrap. All of its ships are removed and a quarter of their value goes to the reserve. ' + UI.Phone.say('Esc cancels.', 'Back cancels.') : st.hint));
    }
    function paintBtns() {
      UI.mount(btnSpecs, st.mode === 'grid' ? 'Specs' : 'Fleets', h('span.kbd', 'V'));
      btnScrap.classList.toggle('active', st.scrap);
      btnScrap.classList.toggle('hide', st.mode === 'specs');
    }
    function jump(r) {
      UI.sfx('click');
      if (r.star >= 0) {
        G.sel.star = r.star; G.sel.fleet = r.id; UI.Screens.go('galaxy');
        if (UI.Side && UI.Side.has && UI.Side.has('fleetDeploy')) UI.Side.show('fleetDeploy', { star: r.star });
      } else {
        G.sel.star = r.to; G.sel.fleet = r.id; UI.Screens.go('galaxy');
        const map = UI.Galaxy && UI.Galaxy.map; if (map && map.selectFleet) map.selectFleet(r.id, { emit: true, center: true });
      }
    }
    function jumpDesign(slot) {          // the biggest stack of that design
      const S = G.S, E = G.player(); let best = null;
      for (const f of S.fleets) if (f.owner === E.id && f.ships[slot] > 0 && (!best || f.ships[slot] > best.ships[slot])) best = f;
      if (best) jump({ id: best.id, star: best.star, to: best.to });
    }

    async function scrapDesign(slot) {
      const S = G.S, E = G.player(), D = M.Sim.Design, d = E.designs[slot];
      if (!d) return;
      const info = st.d && st.d.designs[slot] ? st.d.designs[slot] : { count: 0 };
      const n = info.count | 0, refund = D.scrapRefund ? D.scrapRefund(S, E, slot, n) : Math.floor(n * D.cost(S, E, slot) / 4);
      const building = S.planets.filter(p => p.owner === E.id && p.build === slot).length;
      let repl = null; for (let i = 0; i < 6; i++) if (i !== slot && E.designs[i] && D.stats(S, E, i).valid) { repl = E.designs[i].name; break; }
      const body = h('div', h('p', n ? h('span', 'This removes all ', h('b.t-rose', U.fmt(n)), ' ', d.name, n === 1 ? ' ship' : ' ships', ' from your fleets, wherever they are, and frees the design slot.')
        : h('span', 'No ', d.name, ' ships exist. This only frees the design slot.')),
        n ? h('p', 'A quarter of their value, ', h('b.t-gold', U.fmt(refund) + ' BC'), ', goes to your reserve.') : null,
        building ? h('p.t-ember', building + (building === 1 ? ' colony is' : ' colonies are') + ' building this design and will switch to ' + (repl || 'another design') + '.') : null);
      const ok = await UI.modal({ title: 'Scrap the ' + d.name + '?', body, width: '27rem', buttons: [{ label: 'Keep', value: false, primary: true }, { label: 'Scrap', value: true, danger: true }] });
      setScrap(false);
      if (!ok) return;
      const r = G.order({ t: 'scrapDesign', slot });
      if (!r.ok) { UI.toast(r.msg || 'Could not scrap that design', 'bad'); UI.sfx('error'); return; }
      UI.sfx('confirm'); UI.toast('Scrapped ' + d.name + (r.refund ? ': +' + U.fmt(r.refund) + ' BC' : ''), 'ok');
    }

    // ---- painting -------------------------------------------------------------------------------------------------------------------------------
    function paintGrid(d) {
      const E = d.E, grid = h('div.lf-grid');
      const head = h('div.lf-row.head', h('div.lf-h.st', 'Station'));
      d.designs.forEach(x => {
        if (x.empty) head.appendChild(h('div.lf-h.none', h('span.nm', 'No design'), h('span.sub', ' ')));
        else head.appendChild(h('div.lf-h', { tip: scrapTip(x), onclick: () => { if (st.scrap) scrapDesign(x.slot); } },
          h('span.nm', x.name), h('span.sub', HULL_NAME[x.hull] + ' · ' + U.fmt(x.cost) + ' BC')));
      });
      grid.appendChild(head);
      if (!d.rows.length) grid.appendChild(h('div.lf-empty', 'You have no ships. Build some at a colony with the Ships button.'));
      const px = Math.round(120 * dpr() / 1.5), cells = [];
      for (const r of d.rows) {
        const sub = r.moving ? h('span.stt', 'moving · ', h('b', 'ETA ' + r.eta + (r.eta === 1 ? ' turn' : ' turns')))
          : h('span.stt', 'in orbit', r.colony ? h('span.own', ' · your colony') : r.foe ? h('span.foe', ' · ' + G.S.empires[G.S.planets[r.star].owner].plural + ' colony') : null);
        const pic = r.moving ? h('div.lf-pic.mv', movingPic({ id: r.id, from: r.from, to: r.to }, E, px)) : h('div.lf-pic', planetPic(G.S.planets[r.star], px));
        const row = h('div.lf-row', { onclick: () => jump(r) },
          h('div.lf-st', pic, h('div.lf-info', h('div.nm', r.moving ? (r.known ? '→ ' + r.name : '→ Unknown system') : r.name), sub)));
        d.designs.forEach(x => {
          const n = r.ships[x.slot] | 0;
          const cell = h('div.lf-cell', n > 0 && !x.empty ? h('span.lf-n', U.fmt(n)) : null);
          if (n > 0 && !x.empty) cells.push({ cell, slot: x.slot });
          row.appendChild(cell);
        });
        grid.appendChild(row);
      }
      const tot = h('div.lf-row.total', h('div.lf-total.lbl', 'Total ships'));
      d.designs.forEach(x => tot.appendChild(h('div.lf-total', x.empty ? null : h('span.v', U.fmt(x.count)))));
      grid.appendChild(tot);
      UI.mount(body, grid);
      // the ship pictures are painted at the size of the cell they sit in (device pixels, measured after mount), so no cell is ever
      // an upscaled smaller bitmap; off-screen (no layout yet) the old fixed store is used
      if (cells.length) {
        const r = cells[0].cell.getBoundingClientRect(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, k = dpr();
        const cw = r.width > 20 ? Math.round((r.width - 0.3 * rem) * k) : Math.round(220 * k / 1.5), ch = r.width > 20 ? Math.round(3.6 * rem * k) : Math.round(120 * k / 1.5);
        for (const c of cells) c.cell.insertBefore(shipCanvas(E, c.slot, cw, ch), c.cell.firstChild);
      }
    }
    const scrapTip = x => (st.scrap ? 'Scrap the <b>' + x.name + '</b>' : null);

    function statBox(cls, value, label, tip) { return h('div.lf-stat.' + cls + (value ? '' : '.zero'), { tip }, h('span.v', value), h('span.l', label)); }
    function paintSpecs(d) {
      const E = d.E, Kc = K(), wrap = h('div');
      const px = Math.round(150 * dpr() / 1.5), cw = Math.round(300 * dpr() / 1.5), ch = Math.round(160 * dpr() / 1.5);
      d.designs.forEach(x => {
        if (x.empty) {
          wrap.appendChild(h('div.lf-srow.none', h('div.lf-spic'), h('div.lf-sname', h('div.nm.dim', 'No design'), h('div.cls', 'Empty slot ' + (x.slot + 1))),
            h('div.dim', 'Create a new ship in the Design screen.'), h('div'), h('div'), h('div')));
          return;
        }
        const s = x.st, dd = x.d;
        const stats = h('div.lf-stats',
          statBox('shd', s.absorb | 0, 'Shield', 'Damage the deflector shield absorbs from every hit'),
          statBox('bdef', s.beamDef | 0, 'Beam def', 'Beam defense: chance enemy beams miss'),
          statBox('att', s.attack | 0, 'Att lvl', 'Attack level of the battle computer'),
          statBox('warp', s.warp | 0, 'Warp', 'Speed on the star map, parsecs per turn'),
          statBox('mdef', s.missDef | 0, 'Misl def', 'Missile defense: beam defense plus ECM'),
          statBox('hits', s.hp | 0, 'Hits', 'Hit points'),
          statBox('spd', s.combatSpeed | 0, 'Speed', 'Combat speed, squares per round'));
        const wl = h('div.lf-wl');
        const ws = (s.weapons || []).filter(w => w.count > 0);
        if (!ws.length) wl.appendChild(h('div.ln.none', 'No weapons'));
        for (const w of ws) wl.appendChild(h('div.ln.' + w.kind, UI.icon(w.kind === 'beam' ? 'beam' : w.kind === 'missile' || w.kind === 'torpedo' ? 'missile' : w.kind === 'bomb' || w.kind === 'bio' ? 'bomb' : 'weapons'), h('span.c', w.count + ' ×'), h('span', w.name)));
        const spec = h('div.lf-sp');
        const names = (dd.specials || []).filter(i => i >= 0).map(i => Kc && Kc.SPECIALS[i] ? Kc.SPECIALS[i] : null).filter(Boolean);
        if (!names.length) spec.appendChild(h('div.ln.none', 'No specials'));
        for (const sp of names) spec.appendChild(h('div.ln' + (sp.colonyMin ? '.col' : sp.tanks ? '.tank' : ''), sp.name));
        const upkeep = Math.max(1, Math.ceil(x.cost / 50));
        wrap.appendChild(h('div.lf-srow', { onclick: e => { if (!e.target.closest('.btn')) jumpDesign(x.slot); } },
          h('div.lf-spic', shipCanvas(E, x.slot, cw, ch), x.count ? h('span.lf-n', { tip: x.count + ' ships in service' }, '× ' + U.fmt(x.count)) : null),
          h('div.lf-sname', h('div.nm', x.name), h('div.cls', HULL_NAME[x.hull] + ' hull' + (s.colonyMin ? ' · colony ship' : '')),
            UI.button('Scrap', () => scrapDesign(x.slot), { small: true, danger: true, kbd: String(x.slot + 1) })),
          stats, wl, spec,
          h('div.lf-cost', h('span.l', 'Cost'), h('b', U.fmt(x.cost), h('span.u', ' BC')), h('span.up', 'upkeep ' + upkeep + ' BC / turn'))));
      });
      UI.mount(body, wrap);
    }
    function paintFoot(d) {
      const m = d.maint, pct = d.gross > 0 ? Math.round(m.ships * 1000 / d.gross) / 10 : 0;
      UI.mount(maintBox, h('span.k', 'Ship maintenance cost'), h('b', U.fmt(m.ships)), h('span.u', ' BC / year'), pct ? h('span.x', pct + '% of production') : null, m.gates ? h('span.x', '+ ' + U.fmt(m.gates) + ' for stargates') : null);
      const bits = [];
      if (d.transCount) bits.push(d.transCount + (d.transCount === 1 ? ' transport carries ' : ' transports carry ') + U.fmt(d.transPop) + ' million colonists');
      UI.mount(noteEl, bits.join(' · '));
      UI.mount(subEl, h('b', U.fmt(d.ships)), d.ships === 1 ? ' ship' : ' ships', ' · ', h('b', d.rows.length), d.rows.length === 1 ? ' stack' : ' stacks', ' · ', h('b', d.designs.filter(x => !x.empty).length), ' of 6 designs');
    }
    function paint() {
      if (!el || !G.S) return;
      const d = st.d = collect();
      if (st.mode === 'specs') paintSpecs(d); else paintGrid(d);
      paintFoot(d); paintBanner();
      el.querySelector('.lf-title').textContent = st.mode === 'specs' ? 'Ship specifications' : 'Fleets';
    }

    return {
      create(root) {
        banner = h('div.lf-banner'); body = h('div.lf-body'); maintBox = h('div.lf-maint'); noteEl = h('div.lf-note'); subEl = h('div.lf-sub');
        const tabBar = h('div.tabs');
        [['grid', 'Fleets'], ['specs', 'Specs']].forEach(([id, label]) => { tabs[id] = h('button', { type: 'button', onclick: () => { UI.sfx('click'); setMode(id); } }, label); tabBar.appendChild(tabs[id]); });
        btnSpecs = UI.button('Specs', () => setMode(st.mode === 'grid' ? 'specs' : 'grid'), { kbd: 'V' });
        btnScrap = UI.button('Scrap', () => setScrap(!st.scrap), { danger: true, kbd: 'S' });
        const okBtn = UI.button('OK', () => close(), { primary: true, kbd: 'Space', sfx: 'confirm' });
        el = h('div.lf', h('div.lf-sheet.panel', h('div.lf-head', h('div.lf-title', 'Fleets'), subEl, tabBar), banner, body,
          h('div.lf-foot', maintBox, noteEl, btnSpecs, btnScrap, okBtn)));
        root.appendChild(el);
        const scr = { screen: root.dataset.screen };
        UI.bindKey('o', () => close('confirm'), scr); UI.bindKey('space', () => close('confirm'), scr);
        UI.bindKey('escape', () => { if (st.scrap) setScrap(false); else close('cancel'); }, scr);
        UI.bindKey('v', () => setMode(st.mode === 'grid' ? 'specs' : 'grid'), scr);
        UI.bindKey('s', () => { if (st.mode === 'grid') setScrap(!st.scrap); }, scr);
        for (let i = 1; i <= 6; i++) UI.bindKey(String(i), () => { const x = st.d && st.d.designs[i - 1]; if (x && !x.empty && (st.mode === 'specs' || st.scrap)) scrapDesign(i - 1); }, scr);
        root.addEventListener('contextmenu', e => { e.preventDefault(); if (st.scrap) setScrap(false); else close('cancel'); });
        M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === root.dataset.screen) paint(); });
      },
      enter(params) {
        if (!G.S) { UI.Screens.go('menu'); return; }
        params = params || {};
        st.from = params.from || 'galaxy'; st.hint = params.hint || '';
        st.scrap = false; el.classList.remove('lf-scrapmode');
        setMode(params.mode === 'specs' || params.mode === 'grid' ? params.mode : startMode);
        if (params.scrap && st.mode === 'grid') setScrap(true);
      },
    };
  }

  UI.Screens.register('fleets', make('grid'));
  UI.Screens.register('specs', make('specs'));
})(window.MOO);
