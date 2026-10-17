// Star-system view (research/06 §5.2): the system's one planet large in the lower-left, the star glowing in the top-right, name + "<type> environment" at the top,
// fleets in orbit, the PLANET SIZE / FACTORIES / WASTE / POPULATION / GROWTH box and the rows of tiny icons. Click, any key or right-click returns.
//   UI.Screens.go('system', {star, from})      (star defaults to the selected star; from defaults to 'galaxy')
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('star-system', `
    .sv { position:absolute; inset:0; overflow:hidden; background:#04061a; cursor:pointer; user-select:none; }
    .sv-cv { position:absolute; inset:0; width:100%; height:100%; }
    .sv::after { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(120% 100% at 50% 40%, rgba(0,0,0,0) 55%, rgba(0,0,6,.55) 100%); }
    .sv > *:not(.sv-cv) { z-index:2; }
    .sv-top { position:absolute; top:3.2%; left:50%; transform:translateX(-50%); text-align:center; pointer-events:none; text-shadow:0 2px 16px rgba(0,0,10,.95), 0 0 2px #000; white-space:nowrap; }
    .sv-name { font:400 clamp(2.4rem, 7.2vh, 4.6rem)/1 var(--font-title); color:var(--brass-hi); letter-spacing:.07em; }
    .sv-env { margin-top:.5rem; font:400 clamp(1.1rem, 2.6vh, 1.7rem) var(--font-display); color:var(--ivory); letter-spacing:.14em; text-transform:uppercase; }
    .sv-own { margin-top:.5rem; display:inline-flex; align-items:center; gap:.5rem; padding:.2rem .9rem; font-size:1.02rem; color:var(--ivory); background:rgba(4,6,22,.62); border:1px solid rgba(214,179,106,.4); }
    .sv-own .empire-dot { margin-right:0; } .sv-own .dim { color:var(--mist); opacity:1; }
    .sv-tl { position:absolute; top:3.2%; left:2.2%; display:flex; flex-direction:column; gap:.45rem; max-width:24rem; pointer-events:none; }
    .sv-lab { display:flex; align-items:center; gap:.55rem; padding:.3rem .8rem; font:400 1.12rem var(--font-display); letter-spacing:.05em; color:var(--azure); background:rgba(4,6,22,.7); border:1px solid rgba(91,140,255,.55); }
    .sv-lab .ico { width:1.2em; height:1.2em; } .sv-lab.gate { color:var(--violet); border-color:rgba(169,139,255,.55); } .sv-lab.warn { color:var(--rose); border-color:rgba(255,92,106,.55); }
    .sv-note { padding:.35rem .75rem; background:rgba(4,6,22,.7); border-left:3px solid var(--mist); font-size:.98rem; line-height:1.3; color:var(--ivory); }
    .sv-note b { display:block; font:400 1.02rem var(--font-display); letter-spacing:.04em; } .sv-note span { color:var(--mist); font-size:.9rem; }
    .sv-note.warn { border-left-color:var(--ember); } .sv-note.warn b { color:var(--ember); } .sv-note.ok { border-left-color:var(--leaf); } .sv-note.ok b { color:var(--leaf); }
    .sv-note.cy { border-left-color:var(--cyan); } .sv-note.cy b { color:var(--cyan); } .sv-note.vi { border-left-color:var(--violet); } .sv-note.vi b { color:var(--violet); }
    .sv-note.teal { border-left-color:var(--teal); } .sv-note.teal b { color:var(--teal); } .sv-note.dim { border-left-color:var(--fog); } .sv-note.dim b { color:var(--mist); }
    .sv-star { position:absolute; left:86%; top:30%; transform:translateX(-50%); text-align:center; pointer-events:none; white-space:nowrap; color:var(--mist); font:400 .95rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-shadow:0 1px 8px #000, 0 0 3px #000; }
    .sv-fleets { position:absolute; right:2.2%; top:36%; display:flex; flex-direction:column; align-items:flex-end; gap:.6rem; max-width:55%; max-height:44%; overflow:hidden; }
    .sv-grp { display:flex; flex-direction:column; align-items:flex-end; gap:.3rem; }
    .sv-gh { display:flex; align-items:center; gap:.5rem; padding:.15rem .7rem; font:400 1rem var(--font-display); letter-spacing:.07em; color:var(--ivory); background:rgba(4,6,22,.66); text-transform:uppercase; }
    .sv-row { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:.35rem; }
    .sv-tile { position:relative; width:7.3rem; height:4.6rem; background:rgba(4,6,22,.5); border:1px solid rgba(214,179,106,.28); }
    .sv-tile.foe { border-color:rgba(255,92,106,.4); } .sv-tile canvas { position:absolute; inset:0; width:100%; height:calc(100% - 1.15rem); }
    .sv-tile .nm { position:absolute; left:0; right:0; bottom:.1rem; text-align:center; font-size:.82rem; color:var(--mist); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 .25rem; }
    .sv-tile .n { position:absolute; right:.3rem; top:.25rem; min-width:1.45rem; padding:0 .38rem; text-align:center; font:600 .95rem/1.5 var(--font-ui); color:var(--ivory); background:rgba(8,12,34,.92); border:1px solid rgba(243,220,160,.7); font-variant-numeric:tabular-nums;
      clip-path:polygon(.2rem 0,100% 0,100% calc(100% - .2rem),calc(100% - .2rem) 100%,0 100%,0 .2rem); }
    .sv-info { position:absolute; right:2.2%; bottom:3.6%; min-width:19rem; padding:.55rem .9rem .7rem; }
    .sv-info.panel::before { background:linear-gradient(180deg, rgba(5,10,28,.94), rgba(2,5,16,.96)); }
    .sv-info { background:linear-gradient(135deg, var(--leaf), #1f5a3c 40%, #1f5a3c 60%, var(--leaf)); }
    .sv-it { margin-bottom:.4rem; padding-bottom:.3rem; border-bottom:1px solid rgba(95,220,143,.35); font:400 1.05rem var(--font-display); letter-spacing:.09em; color:var(--leaf); text-transform:uppercase; display:flex; justify-content:space-between; align-items:baseline; }
    .sv-it small { font:400 .8rem var(--font-ui); color:var(--mist); letter-spacing:0; text-transform:none; }
    .sv-r { display:flex; justify-content:space-between; gap:1.4rem; padding:.18rem 0; font-size:1.05rem; } .sv-r .k { font:400 .95rem var(--font-display); letter-spacing:.08em; color:var(--mist); text-transform:uppercase; align-self:center; }
    .sv-r .v { font:600 1.2rem var(--font-ui); color:var(--ivory); font-variant-numeric:tabular-nums; } .sv-r .v small { font-size:.85rem; color:var(--mist); font-weight:400; }
    .sv-r .v.up { color:var(--leaf); } .sv-r .v.dn { color:var(--rose); } .sv-r .v.ember { color:var(--ember); } .sv-r .v.q { color:var(--fog); }
    .sv-icons { position:absolute; left:1.8%; bottom:3.6%; display:flex; flex-direction:column; gap:.4rem; padding:.5rem .7rem; background:rgba(3,5,18,.62); border:1px solid rgba(214,179,106,.3); max-width:44%; }
    .sv-ir { display:flex; align-items:center; gap:.6rem; } .sv-ir .l { flex:none; width:5.2rem; font:400 .8rem var(--font-display); letter-spacing:.09em; color:var(--mist); text-transform:uppercase; }
    .sv-ir .ic { display:flex; flex-wrap:wrap; gap:1px; } .sv-ir .ico { width:1.05rem; height:1.05rem; } .sv-ir .ico.off { opacity:.2; }
    .sv-ir.pop { color:var(--leaf); } .sv-ir.fac { color:var(--ember); } .sv-ir.base { color:var(--azure); } .sv-ir.wst { color:var(--teal); } .sv-ir .l { color:var(--mist); }
    .sv-hint { position:absolute; left:50%; bottom:1.1%; transform:translateX(-50%); color:rgba(152,165,207,.62); font-size:.85rem; letter-spacing:.06em; pointer-events:none; white-space:nowrap; }
    .sv-unex { position:absolute; left:8%; bottom:12%; max-width:28rem; padding:.9rem 1.2rem; color:var(--ivory); font-size:1.1rem; line-height:1.45; background:rgba(4,6,22,.62); border:1px solid rgba(255,92,106,.45); }
    .sv-unex .un { display:block; margin-bottom:.4rem; font:400 1.6rem var(--font-display); color:var(--leaf); letter-spacing:.14em; }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: embossed gold name, bevelled glass plates, recessed readout slots (still a full-bleed scene, not a framed tool screen).
  UI.css('star-system-orig', bump(`
    .sv-name { color:#e8c850; text-shadow:0 2px 0 #6b4f12, 0 4px 18px rgba(0,0,10,.95); }
    .sv-env { color:#f0d8b0; }
    .sv-own, .sv-lab, .sv-icons, .sv-unex { background:rgba(8,10,14,.72); border:0; backdrop-filter:blur(3px); box-shadow:inset 1px 1px 0 rgba(255,255,255,.2), inset -1px -1px 0 rgba(0,0,0,.7), 0 0 0 1px rgba(0,0,0,.75), 0 6px 18px rgba(0,0,0,.45); }
    .sv-tile { background:#000; border:0; box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.22), 0 4px 10px rgba(0,0,0,.5); }
    .sv-tile.foe { box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(255,92,106,.55), 0 4px 10px rgba(0,0,0,.5); }
    .sv-tile .nm { color:#f0d048; background:#3a2810; bottom:0; padding:.05rem .25rem; font:600 .86rem var(--font-display); letter-spacing:.06em; text-transform:uppercase; }
    .sv-tile .n { background:transparent; border:0; clip-path:none; color:#f0e060; text-shadow:0 1px 0 #000, 0 0 3px #000; font-family:var(--font-mono, monospace); }
    .sv-info { clip-path:none; padding:.4rem; background:linear-gradient(135deg, #59636f, #3a424c); box-shadow:inset 1px 1px 0 rgba(255,255,255,.25), inset -1px -1px 0 rgba(0,0,0,.6), 0 0 0 1px #000, 0 8px 24px rgba(0,0,0,.5); }
    .sv-info::before { inset:.2rem; clip-path:none; background:rgba(10,13,17,.94); box-shadow:inset 1px 1px 2px rgba(0,0,0,.9); }
    .sv-info::after { display:none; }
    .sv-it { color:#50d0b0; border-bottom-color:rgba(255,255,255,.14); }
    .sv-r .k { color:#f0b868; font-size:.92rem; } .sv-r .v { color:#f0e060; font-family:var(--font-mono, monospace); font-size:1.05rem; } .sv-r .v.up { color:#70e060; } .sv-r .v.dn { color:#ff7a5a; }
    .sv-it small { font-size:.9rem; } .sv-ir .l { font-size:.9rem; width:5.8rem; color:#e6dccb; } .sv-hint { color:#c4cce6; font-size:.92rem; }
  `));

  // ---- vocabulary --------------------------------------------------------------------------------------------------------------------------------
  const STAR_NAME = { yellow: 'Yellow', red: 'Red', green: 'Green', blue: 'Blue', white: 'White', purple: 'Neutron' };
  const STAR_TEXT = {
    yellow: 'A yellow star: the best odds of temperate, habitable planets.', red: 'An old, dull star: its worlds are commonly poor in minerals.',
    green: 'A moderately bright star with a wide range of planet types.', blue: 'A young blue star: mineral-rich, mostly lifeless worlds.',
    white: 'A white star burning very hot: its planets are generally hostile.', purple: 'A neutron star: rare, and the likeliest home of rich planets.',
  };
  const BACKDROP = { yellow: ['#3a3f9e', '#7b3fb0', '#c9803a', '#1f6fa8'], red: ['#5a1f4e', '#9a2a3a', '#3b2a8a', '#c4503a'], green: ['#1f6a68', '#2f8a5a', '#3a4aa0', '#6a3aa0'],
    blue: ['#1f3fa8', '#2a78d0', '#5a3ab8', '#1f9ab8'], white: ['#3a4aa0', '#5a6ac0', '#7a4ab0', '#3a8ab0'], purple: ['#5a2ab0', '#a83ab0', '#2a3ab0', '#c4408c'] };
  const HULL_NAME = ['Small', 'Medium', 'Large', 'Huge'];
  const EMP = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];
  const clamp = U.clamp, BLOOM = { spikes: false, glow: 1.3 };
  const css = n => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { return ''; } };
  const empCol = E => css('--emp' + E.color) || EMP[E.color % 6];

  let el, cv, ctx, W = 0, H = 0, dpr = 1, bg = null, bgKey = '', tt = 0, pace = {}, enterAt = 0, sizeDirty = true;
  const st = { star: 0, from: 'galaxy', info: null, tiles: [], geo: null };

  // ---- what do we know? ------------------------------------------------------------------------------------------------------------------------
  function notesFor(p) {
    const n = [];
    if (p.growth === 'hostile') n.push({ k: 'warn', t: 'Hostile environment', d: 'Population growth is halved' });
    else if (p.growth === 'fertile') n.push({ k: 'ok', t: 'Fertile soil', d: 'Population growth is boosted' });
    else if (p.growth === 'gaia') n.push({ k: 'teal', t: 'Gaia world', d: 'Population grows twice as fast' });
    const sp = { ultrapoor: ['dim', 'Ultra poor minerals', 'Industry output is a third'], poor: ['dim', 'Poor minerals', 'Industry output is halved'], rich: ['cy', 'Rich minerals', 'Industry output is doubled'],
      ultrarich: ['cy', 'Ultra rich minerals', 'Industry output is tripled'], artifacts: ['vi', 'Ancient artifacts', 'Research here is doubled'], orion: ['vi', 'The Orion system', 'Research here is quadrupled'] }[p.special];
    if (sp) n.push({ k: sp[0], t: sp[1], d: sp[2] });
    return n;
  }
  function gather(id) {
    const S = G.S, E = G.player(), s = S.stars[id], p = S.planets[id], q = Q.star(S, E.id, id), mine = p.owner === E.id;
    const info = { id, S, E, s, p, q, mine, explored: !!q.explored, live: !!q.live, kind: s.color, orionGuard: id === S.orion && S.guardian && S.guardian.alive };
    if (!info.explored) { info.name = 'Unexplored'; return info; }
    info.name = p.name || s.name;
    info.type = p.type; info.typeLabel = p.type === 'none' ? 'No planet' : U.cap(p.type) + ' environment';
    info.owner = q.owner;           // live owner when scanned, otherwise the last report
    info.empire = q.owner >= 0 ? S.empires[q.owner] : null;
    info.notes = p.type === 'none' ? [] : notesFor(p);
    if (mine) { info.c = Q.colony(S, id); }
    else if (q.owner >= 0) info.seen = q.live ? { pop: p.pop | 0, bases: p.bases | 0, factories: p.factories | 0, shield: p.shield | 0 } : q.lastSeen;
    info.shield = mine ? p.shield | 0 : (info.seen ? info.seen.shield | 0 : 0);
    info.stargate = !!p.stargate && (mine || q.live);
    // fleets in orbit that we may see
    info.groups = [];
    for (const f of S.fleets) {
      if (f.star !== id || f.ships.reduce((a, b) => a + b, 0) <= 0) continue;
      if (f.owner !== E.id && !M.Sim.Vis.canSee(S, E, f)) continue;
      info.groups.push({ owner: f.owner, empire: S.empires[f.owner], mine: f.owner === E.id, ships: f.ships.slice() });
    }
    info.groups.sort((a, b) => (b.mine - a.mine) || (a.owner - b.owner));
    return info;
  }

  // ---- DOM (rebuilt on every enter / state change) ----------------------------------------------------------------------------------------------
  const row = (k, v, cls, tip) => h('div.sv-r', { tip }, h('span.k', k), h('span.v' + (cls ? '.' + cls : ''), v));
  const unitFor = (max, step) => Math.max(step, Math.ceil(max / 28 / step) * step);          // how much one tiny icon stands for (at most ~28 icons per row)
  function iconRow(cls, icon, label, on, total, unit, tip) {
    const nOn = Math.min(40, Math.ceil(on / unit)), nAll = Math.min(40, Math.max(nOn, Math.ceil(total / unit)));
    if (nAll <= 0) return null;
    const ic = h('div.ic'); for (let i = 0; i < nAll; i++) ic.appendChild(UI.icon(icon, i < nOn ? '' : 'off'));
    return h('div.sv-ir.' + cls, { tip: tip + (unit > 1 ? '<br>Each icon stands for ' + unit : '') }, h('span.l', label), ic);
  }
  function build() {
    const i = st.info = gather(st.star), S = i.S;
    UI.clear(el.querySelector('.sv-ui'));
    const ui = el.querySelector('.sv-ui'), kids = [];
    // --- top: name, environment, owner
    const own = i.explored ? (i.empire ? h('div.sv-own', h('span.empire-dot', { style: { '--c': 'var(--emp' + i.empire.color + ')' } }), h('b', i.empire.plural + ' colony'), !i.mine && !i.live ? h('span.dim', '(last reported)') : null)
      : (i.type === 'none' ? null : h('div.sv-own', h('span.dim', 'Uninhabited')))) : null;
    kids.push(h('div.sv-top', h('div.sv-name', i.name), h('div.sv-env', i.explored ? i.typeLabel : STAR_NAME[i.kind] + ' star'), own));
    // --- top-left: shield, stargate, notes
    const tl = h('div.sv-tl');
    if (i.explored) {
      if (i.shield) tl.appendChild(h('div.sv-lab', UI.icon('shield'), 'Class ' + U.roman(i.shield) + ' planetary shield'));
      if (i.stargate) tl.appendChild(h('div.sv-lab.gate', UI.icon('stargate'), 'Stargate'));
      if (i.orionGuard) tl.appendChild(h('div.sv-lab.warn', UI.icon('monster'), 'Guarded by the Orion Guardian'));
      for (const n of i.notes) tl.appendChild(h('div.sv-note.' + n.k, h('b', n.t), h('span', n.d)));
    }
    kids.push(tl);
    // --- star caption (under the star glow)
    kids.push(h('div.sv-star', STAR_NAME[i.kind] + ' star'));
    if (!i.explored) {
      kids.push(h('div.sv-unex', h('span.un', 'UNEXPLORED'), STAR_TEXT[i.kind], h('div.dim', { style: { marginTop: '.5rem', fontSize: '.95rem' } }, 'Send a ship here to chart the system.')));
      kids.push(h('div.sv-hint', 'Click or press any key to return'));
      st.tiles = []; ui.append.apply(ui, kids.filter(Boolean)); placeCaption(); return;
    }
    // --- fleets in orbit
    const fl = h('div.sv-fleets'); st.tiles = [];
    for (const g of i.groups) {
      const E = g.empire, rowEl = h('div.sv-row');
      for (let slot = 0; slot < 6; slot++) {
        const n = g.ships[slot] | 0, d = E.designs[slot]; if (n <= 0 || !d) continue;
        const stt = M.Sim.Design.stats(S, E, slot), hull = clamp(d.hull | 0, 0, 3), c = h('canvas');
        const fl_ = { colony: stt.colonyMin > 0, beams: (stt.weapons || []).some(w => w.kind === 'beam'), missiles: (stt.weapons || []).some(w => w.kind === 'missile' || w.kind === 'torpedo'), bomb: (stt.bombs | 0) + (stt.bio | 0) > 0 };
        const tile = { c, ctx: c.getContext('2d'), sized: false, w: 0, h: 0, dpr: 1, ph: slot * 1.7 + g.owner, fit: [0.55, 0.66, 0.78, 0.88][hull],
          o: { race: E.race, hull, size: 40, color: empCol(E), flags: fl_, angle: 0, t: 0, x: 0, y: 0, thrust: 0.45, shadow: false } };      // draw options are reused every frame
        st.tiles.push(tile);
        rowEl.appendChild(h('div.sv-tile' + (g.mine ? '' : '.foe'), { tip: g.mine ? '<b>' + d.name + '</b><br>' + HULL_NAME[hull] + ' hull · ' + n + (n === 1 ? ' ship' : ' ships') : HULL_NAME[hull] + ' hull · ' + n + (n === 1 ? ' ship' : ' ships') }, c, h('span.n', U.fmt(n)), h('span.nm', g.mine ? d.name : HULL_NAME[hull] + ' hull')));
      }
      fl.appendChild(h('div.sv-grp', h('div.sv-gh', h('span.empire-dot', { style: { '--c': 'var(--emp' + E.color + ')' } }), g.mine ? 'Your fleet' : E.plural + ' fleet', ' · in orbit'), rowEl));
    }
    if (i.groups.length) kids.push(fl);
    // --- info box
    const p = i.p, box = h('div.sv-info.panel', h('div.sv-it', 'Planet data', !i.mine && i.owner >= 0 && !i.live ? h('small', 'last reported') : null));
    if (p.type === 'none') box.appendChild(h('div.sv-r', h('span.k', 'No planet in this system')));
    else {
      box.appendChild(row('Planet size', U.fmt(p.maxPop), '', 'Maximum population of this planet'));
      if (i.mine) {
        const c = i.c, g = c.growthTenths;
        box.appendChild(row('Factories', h('span', U.fmt(c.factories), h('small', ' / ' + U.fmt(c.maxFactories))), '', 'Factories built / the most this planet can run'));
        box.appendChild(row('Waste', U.fmt(c.waste), c.waste > 0 ? 'ember' : ''));
        box.appendChild(row('Population', h('span', U.fmt(c.pop), h('small', ' / ' + U.fmt(c.maxPopShown) + (c.canTerraform ? '+' : ''))), ''));
        box.appendChild(row('Growth', g ? (g > 0 ? '+' : '−') + Math.abs(g / 10).toFixed(1) : '0', g > 0 ? 'up' : g < 0 ? 'dn' : 'q', 'Population change per turn, in millions'));
      } else if (i.seen) {
        box.appendChild(row('Factories', U.fmt(i.seen.factories | 0)));
        box.appendChild(row('Population', U.fmt(i.seen.pop | 0)));
      } else box.appendChild(row('Population', 'none', 'q'));
    }
    kids.push(box);
    // --- rows of tiny icons
    if (p.type !== 'none' && (i.mine || i.seen)) {
      const ir = h('div.sv-icons');
      if (i.mine) {
        const c = i.c;
        ir.append(...[iconRow('pop', 'pop', 'Population', c.pop, c.maxPopShown, 5, 'Population ' + c.pop + ' of ' + c.maxPopShown + ' million'),
          iconRow('fac', 'industry', 'Factories', c.factories, c.maxFactories, unitFor(c.maxFactories, 5), 'Factories ' + c.factories + ' of ' + c.maxFactories),
          iconRow('base', 'defense', 'Bases', c.bases, c.bases, 5, 'Missile bases: ' + c.bases),
          iconRow('wst', 'waste', 'Waste', c.waste, c.waste, unitFor(c.waste, 1), 'Waste: ' + c.waste)].filter(Boolean));
      } else {
        const sn = i.seen, sf = sn.factories | 0;
        ir.append(...[iconRow('pop', 'pop', 'Population', sn.pop | 0, p.maxPop, 5, 'Population ' + (sn.pop | 0)), iconRow('fac', 'industry', 'Factories', sf, sf, unitFor(sf, 5), 'Factories ' + sf),
          iconRow('base', 'defense', 'Bases', sn.bases | 0, sn.bases | 0, 5, 'Missile bases: ' + (sn.bases | 0))].filter(Boolean));
      }
      if (ir.children.length) kids.push(ir);
    }
    kids.push(h('div.sv-hint', 'Click or press any key to return'));
    ui.append.apply(ui, kids.filter(Boolean));
    placeCaption();
  }

  // ---- art -------------------------------------------------------------------------------------------------------------------------------------
  const Gfx = () => M.Gfx || {};
  const glOk = () => { try { return !!(Gfx().GL && Gfx().GL.supported()); } catch (e) { return false; } };
  function makeBackdrop() {
    const i = st.info, key = i.kind + ':' + i.id + ':' + W + 'x' + H;
    if (key === bgKey && bg) return;
    bgKey = key; bg = null;
    const gpu = glOk() && Gfx().GLSpace && Gfx().GLSpace.makeBackdrop, k = gpu ? Math.min(dpr, 1.5) : 1;      // the GPU renders the sky at screen resolution, the CPU one at CSS pixels
    const w = Math.max(64, Math.min(Math.round(W * k), gpu ? 2560 : 1600)), hh = Math.max(64, Math.round(w * H / W)), seed = 'sys' + i.id + i.kind;
    try {
      const o = { palette: BACKDROP[i.kind] || BACKDROP.yellow, intensity: 0.6, stars: 1, vignette: true };
      const Sp = Gfx().Space;
      bg = gpu ? Gfx().GLSpace.makeBackdrop(w, hh, seed, o) : (Sp && Sp.makeBackdrop ? Sp.makeBackdrop(w, hh, seed, o) : null);
    } catch (e) { console.warn('[system] backdrop', e); bg = null; }
  }
  function geometry() {
    const i = st.info, k = i.explored && i.p.type !== 'none' ? 0.84 + 0.16 * clamp(i.p.maxPop / 120, 0, 1) : 0.9;
    const pr = Math.min(H * 0.4, W * 0.27) * k, px = W * 0.25, py = H * 0.8, sx = W * 0.86, sy = H * 0.15, sr = Math.min(H * 0.13, W * 0.09);
    const la = Math.atan2(sy - py, sx - px), base = { dpr, lightAngle: la, lightElev: 0.5, clouds: true, atmosphere: true, lights: true, cloudShadows: true };
    st.geo = { pr, px, py, sx, sy, sr, la, starOpts: { dpr }, optsGL: Object.assign({ spin: 0.018 }, base), optsCPU: Object.assign({ spin: 0.004 }, base) };
  }
  function drawStar(t) {
    const g = st.geo, kind = st.info.kind, Sp = Gfx().Space;
    // wide soft bloom over the whole scene
    try {
      if (Sp && Sp.starSprite) {
        const spr = Sp.starSprite(kind, 512, BLOOM), bs = Math.max(W, H) * 1.25;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(spr, g.sx - bs / 2, g.sy - bs / 2, bs, bs); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    } catch (e) { /* optional */ }
    let ok = false;
    const GP = Gfx().GLPlanets;
    if (glOk() && GP && GP.supported && GP.supported() && GP.drawStar) { try { ok = GP.drawStar(ctx, kind, g.sx, g.sy, g.sr, t, g.starOpts); } catch (e) { ok = false; } }
    if (!ok && Sp && Sp.drawStarSurface) { try { Sp.drawStarSurface(ctx, kind, g.sx, g.sy, g.sr, t, g.starOpts); } catch (e) { /* optional */ } }
  }
  function drawPlanet(t) {
    const i = st.info, g = st.geo, P = Gfx().Planets, GP = Gfx().GLPlanets;
    if (!i.explored || !P) {
      // unexplored: an empty orbit and a dark, unlit sphere
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(152,165,207,.45)'; ctx.setLineDash([3, 9]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(g.px, g.py + g.pr * 0.1, g.pr * 1.15, g.pr * 0.46, -0.35, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      return;
    }
    const p = i.p, look = p.type === 'none' ? 'asteroids' : (p.growth === 'gaia' ? 'gaia' : p.type);
    const desc = { look, seed: p.id * 7919 + (p.gfx | 0), inhabited: p.owner >= 0 && (i.mine || i.owner >= 0), color: i.empire ? empCol(i.empire) : undefined };
    const gl = glOk() && GP && GP.supported && GP.supported();
    if (look === 'asteroids') {
      try { P.drawAsteroids(ctx, desc, g.px + g.pr * 0.5, g.py - g.pr * 0.25, W * 0.8, H * 0.7, t, { count: 60, lightAngle: g.la }); } catch (e) { /* optional */ }
      return;
    }
    let ok = false;
    if (gl) { try { ok = GP.draw(ctx, desc, g.px, g.py, g.pr, t, g.optsGL); } catch (e) { ok = false; } }
    if (!ok) {                                                  // Canvas2D fallback: slow spin (the texture is re-lit only when it moves), a still sphere on the low tier
      try {
        if (M.Perf && M.Perf.tier === 'low') ctx.drawImage(P.sprite(desc, Math.round(g.pr * 2), g.optsCPU), g.px - g.pr, g.py - g.pr, g.pr * 2, g.pr * 2);
        else P.draw(ctx, desc, g.px, g.py, g.pr, t, g.optsCPU);
      } catch (e) { console.warn('[system] planet', e); }
    }
    // a belt of rocks in front, when the system has one
    if (p.rocks && p.rocks !== 'none' && P.drawAsteroids && (M.Perf ? M.Perf.q.particles : 1) >= 0.5) {
      try { P.drawAsteroids(ctx, { look: 'asteroids', seed: p.id * 31 + 5 }, W * 0.5, H * 0.93, W, H * 0.16, t, { count: p.rocks === 'many' ? 26 : 10, lightAngle: g.la }); } catch (e) { /* optional */ }
    }
  }
  function drawTiles(t) {
    const S = Gfx().Ships; if (!S) return;
    for (const tl of st.tiles) {
      if (!tl.sized) { const r = UI.fitCanvas(tl.c); tl.w = r.w; tl.h = r.h; tl.dpr = r.dpr; tl.sized = true; }
      const c = tl.ctx, o = tl.o; c.setTransform(tl.dpr, 0, 0, tl.dpr, 0, 0); c.clearRect(0, 0, tl.w, tl.h);
      o.size = Math.min(tl.w * tl.fit, tl.h * 2.1); o.angle = -0.1 + Math.sin(t * 0.6 + tl.ph) * 0.04; o.t = t; o.x = tl.w / 2; o.y = tl.h / 2 + Math.sin(t * 1.1 + tl.ph) * 2;
      try { S.draw(c, o); } catch (e) { /* optional */ }
    }
  }

  // ---- screen --------------------------------------------------------------------------------------------------------------------------------
  function close() { UI.sfx('close'); UI.Screens.go(st.from || 'galaxy'); }
  function onKey(e) {
    if (!UI.Screens.current || UI.Screens.current.id !== 'system') return;
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta' || e.key === 'CapsLock' || e.repeat || performance.now() - enterAt < 250) return;
    if (UI.modalOpen && UI.modalOpen()) return;
    e.preventDefault(); e.stopPropagation(); close();
  }
  function sizeCanvas() {
    const box = cv.getBoundingClientRect(), q = (M.Perf && M.Perf.q && M.Perf.q.dpr) || 2;       // keep the full-screen scene under ~8 megapixels and inside the quality tier
    const r = UI.fitCanvas(cv, { maxDpr: Math.max(1, Math.min(2, q, Math.sqrt(8.3e6 / Math.max(1, box.width * box.height)))) });
    W = r.w; H = r.h; dpr = r.dpr; ctx = r.ctx; sizeDirty = false;
    for (const tl of st.tiles) tl.sized = false;
    if (st.info) { geometry(); makeBackdrop(); placeCaption(); }
  }
  function placeCaption() {                                           // "<Colour> star" label sits right under the glowing star
    const cap = el.querySelector('.sv-star'), g = st.geo;
    if (cap && g) { cap.style.left = g.sx + 'px'; cap.style.top = (g.sy + g.sr * 1.3) + 'px'; }
  }

  UI.Screens.register('system', {
    create(root) {
      cv = h('canvas.sv-cv');
      el = h('div.sv', cv, h('div.sv-ui'));
      root.appendChild(el);
      el.addEventListener('click', () => { if (performance.now() - enterAt > 300) close(); });
      el.addEventListener('contextmenu', e => { e.preventDefault(); if (performance.now() - enterAt > 200) close(); });
      window.addEventListener('keydown', onKey, true);
      M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'system' && el) { build(); } });
    },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      params = params || {};
      st.from = params.from || 'galaxy';
      st.star = params.star !== undefined && params.star >= 0 ? params.star : (G.sel.star >= 0 ? G.sel.star : G.player().capital);
      if (!G.S.stars[st.star]) st.star = G.player().capital;
      enterAt = performance.now(); tt = 0; pace.n = pace.since = 0; bgKey = '';
      build(); sizeCanvas();
      UI.sfx('open');
    },
    leave() { st.tiles = []; bg = null; bgKey = ''; },
    update(dt) {
      if (!ctx || !st.info) return;
      if (sizeDirty) sizeCanvas();
      tt += dt;
      const fps = Math.min(glOk() ? 60 : 30, (M.Perf && M.Perf.q && M.Perf.q.animFps) || 60);
      if (!UI.pace(pace, fps, dt)) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      if (bg) ctx.drawImage(bg, 0, 0, W, H); else { ctx.fillStyle = '#04061a'; ctx.fillRect(0, 0, W, H); }
      drawStar(tt); drawPlanet(tt); drawTiles(tt);
    },
    resize() { sizeDirty = true; },
  });
})(window.MOO);
