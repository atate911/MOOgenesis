// Phone layout layer — the galaxy screen. Inert unless <html data-phone> is set (css/phone.css holds the matching rules).
// The map fills the screen and the side panel becomes a bottom sheet (UI.Phone.sheet) with three heights:
//   strip   the title row (a thumbnail, the star / colony name) and a summary line (.ph-sum: a colony's pop, production and what it builds
//           with any warning; a star's planet, owner and range) — the map stays in view and tappable; a tap on it opens the sheet halfway
//   half    the controls: a colony's five sliders and Ships / Reloc / Trans (the picture, stats and build box wait for full), or a
//           pick-a-star panel's counts and Accept / Cancel; its height is measured from that content (at most 70% of the map)
//   full    everything, including the turn log; a held prompt (pre-battle card, battle result, exploration / colonise card) opens here
// The sheet is driven from UI.Side.show: a pick-a-star panel (Fleet deployment / Reloc / Trans) collapses it to a compact card measured
// from its own content (data-ph-pick: Fleet deployment hides its steppers behind a row of ship chips — a tap opens them at half — and
// the hint gives way to the route line once a star is picked) so the map stays in view for the pick, and never follows the pick into a
// floating panel (UI.Side.noFollow); the map is told what the sheet, the HUD and the control column cover (map.setInset) so centring
// lands in the uncovered part, and the origin with every star the ships can reach (a colony's rally candidates for Reloc) is flown into
// that part (map.frame) when any of them is hidden. A held prompt opens the sheet fully and the state from before the prompt comes back
// once it is answered; the turn's processing collapses it. A tap on the title plate while collapsed opens the sheet halfway and centres
// the map on the selection. Also reused by the map overview screen (its side panel → sheet).
// The bottom bar becomes fixed tabs: Planets · Fleet · Tech · Races · More, then Next turn (css/phone.css lays out galaxy.js's own buttons;
// Game, Design and Map are hidden: More opens the game menu, which on a phone also offers Design and the galaxy map — gamemenu.js).
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Game, h = UI.h, U = M.Util, Q = M.Sim.Q;
  const active = () => !!(UI.Phone && UI.Phone.active());
  const portrait = () => { try { return matchMedia('(orientation: portrait)').matches; } catch (e) { return true; } };   // landscape: the panel is a column, not a sheet
  const PICK = { reloc: true, trans: true, fleetDeploy: true };
  const TABS = { Game: ['game'], Design: ['design'], Map: ['map'], Fleet: ['fleet', 'fleet'], Races: ['races', 'diplomacy'], Planets: ['planets', 'planet'], Tech: ['tech', 'research'] };
  let sheet = null, holding = false, remembered = 'strip', halfPx = 0, probe = null;
  UI.Side.noFollow = () => active();                                                       // a pick stays in the sheet (or landscape's column): the float would cover the map

  // the bar's buttons get a tab class (+ an icon over the label); a More tab opens the game menu
  function installBar(scr) {
    const bar = scr.querySelector('.gx-bar'); if (!bar || bar.classList.contains('ph-tabs')) return;
    bar.classList.add('ph-tabs');
    for (const b of bar.querySelectorAll(':scope > .btn')) {
      const t = TABS[(b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild.textContent : b.textContent).trim()];
      if (b.classList.contains('primary')) { b.classList.add('ph-next'); b.insertBefore(UI.icon('nextturn'), b.firstChild); continue; }
      if (!t) continue;
      b.classList.add('ph-tab-' + t[0]);
      if (t[1]) b.insertBefore(UI.icon(t[1]), b.firstChild);
    }
    bar.appendChild(UI.button('More', () => { if (UI.gameMenu) UI.gameMenu(); }, { icon: 'more', cls: 'ph-tab-more' }));
  }

  function installGalaxy() {
    const scr = UI.Screens.el('galaxy'); if (!scr) return;
    installBar(scr);
    const side = scr.querySelector('.gx-side:not(.gx-float)'); if (!side || side.phSheet) return;
    sheet = UI.Phone.sheet(side, { initial: 'strip' });
    // the collapsed sheet: a tap anywhere on it (title row or summary) opens it halfway and centres the map on the selection. Captured, so the
    // name's rename prompt does not open from the strip (it still does from half / full); the colony arrows keep working.
    side.addEventListener('click', e => {
      if (sheet.get() !== 'strip' || !portrait() || !e.target.closest || e.target.closest('.ph-grip')) return;
      if (e.target.closest('.cyc') || (e.target.closest('.btn, button, input, .slider') && !e.target.closest('.side-title'))) return;
      e.stopPropagation(); e.preventDefault();
      sheet.set('half'); UI.Phone.haptic('snap');
      if (side.dataset.phPick) return;                                                     // a pick card: the steppers unfold, the map stays where the pick is
      try { const id = G.sel && G.sel.star; if (id >= 0 && UI.Galaxy.map) UI.Galaxy.map.centerOn(id, { animate: true }); } catch (err) { /* optional */ }
    }, true);
    side.addEventListener('click', e => { if (e.target.closest && e.target.closest('.sm-sb')) requestAnimationFrame(updateFleetSum); });   // a stepper changed a count: the chips follow
    sheet.on(st => { if (st === 'half') requestAnimationFrame(() => { fitHalf(); pushInsets(); }); else pushInsets(); });
    window.addEventListener('resize', () => requestAnimationFrame(() => { fitStrip(); fitHalf(); pushInsets(); }));
    if (M.Bus) M.Bus.on('turn:processing', on => { if (on && active() && sheet) { holding = false; sheet.set('strip'); } });
    noteShown(UI.Side.current(), null); update(); pushInsets({ animate: false });         // the first entry showed its panel before the sheet existed
  }

  // ---- the summary line (.ph-sum) under the sidebar's title ----------------------------------------------------------------------------------
  let shown = null;                                                                        // what the sidebar (not the floating panel) shows: {name, id}
  const sideHost = () => { const scr = UI.Screens.el && UI.Screens.el('galaxy'); return scr ? scr.querySelector('.gx-side:not(.gx-float) .gx-sidebody') : null; };
  function noteShown(name, params) { if (name) shown = { name, id: params && params.star !== undefined ? params.star : G.sel.star }; }
  const STAR = { yellow: 'yellow', red: 'red', green: 'green', blue: 'blue', white: 'white', purple: 'neutron' };
  const cap1 = t => String(t || '').replace(/^./, c => c.toUpperCase());
  function sumColony(id) {
    const S = G.S, c = Q.colony(S, id); if (!c || c.owner !== S.playerId) return null;
    const g = c.growthTenths, ship = c.readouts.ship.text;
    const warn = c.unrest === 2 ? 'Rebellion' : c.unrest ? 'Unrest' : c.event ? cap1(c.event.type) : g < 0 && c.pop > 0 ? 'Shrinking' : c.readouts.eco.text === 'WASTE' ? 'Waste' : null;
    return [h('span', 'Pop ', h('b', U.fmt(c.pop)), g ? h('span.' + (g > 0 ? 'up' : 'dn'), (g > 0 ? ' ↑' : ' ↓') + Math.abs(g / 10).toFixed(1)) : null),
      h('span', 'Prod ', h('b', U.fmt(c.production))),
      h('span', ship === 'NONE' ? 'No ship production' : [c.build.name + ' in ', h('b', ship)]),
      warn ? h('span.w', warn) : null];
  }
  function sumStar(id) {
    const S = G.S, me = G.player(), q = Q.star(S, me.id, id), s = S.stars[id], out = [];
    const far = q.inFuelRange === 0, rng = h('span' + (far ? '.w' : ''), q.range === 0 ? 'In your territory' : ['Range ', h('b', q.range), ' pc', far ? ' · out of fuel range' : q.inFuelRange === 2 ? ' · reserve tanks only' : '']);
    if (!q.explored) return [h('span', 'Unexplored ' + (STAR[s.color] || '') + ' star'), rng];
    const c = q.planet;
    out.push(h('span', c.type === 'none' ? 'No habitable planet' : [c.typeLabel + ' · max ', h('b', c.maxPop)]));
    if (q.owner >= 0 && q.owner !== me.id) { const seen = q.live ? S.planets[id] : q.lastSeen; out.push(h('span', S.empires[q.owner].plural + (seen ? ' · pop ' + (seen.pop | 0) : ''))); }
    out.push(rng);
    return out;
  }
  function updateSummary() {
    const host = sideHost(); if (!host || !shown) return;
    let parts = null;
    try { parts = shown.name === 'colony' ? sumColony(shown.id) : shown.name === 'star' ? sumStar(shown.id) : null; } catch (e) { console.warn('[phone summary]', e); }
    let el = host.querySelector('.ph-sum');
    const t = host.querySelector('.side-title');
    if (!parts || !t) { if (el) el.remove(); return; }
    if (!el) el = h('div.ph-sum');
    if (t.nextSibling !== el) t.after(el);
    UI.mount(el, parts);
  }

  // ---- the pick card: Fleet deployment's ships as chips ("2× Scout · 1 of 3× Cruiser", a tap unfolds the steppers at half) ----------------------
  function updateFleetSum() {
    const host = sideHost(), side = host && host.closest('.gx-side'); if (!host) return;
    let el = host.querySelector('.ph-fsum');
    const rows = side && side.dataset.phPick === 'fleetDeploy' ? [...host.querySelectorAll('.sm-fleet')] : [];
    if (!rows.length) { if (el) el.remove(); return; }
    const chips = rows.map(r => {
      const nm = r.querySelector('.nm'), n = r.querySelector('.sm-step .n'), m = /(\d+)\s*\/\s*(\d+)/.exec(n ? n.textContent : ''), sel = m ? +m[1] : 0, tot = m ? +m[2] : 0;
      return h('span.ph-fchip' + (sel ? '' : '.off'), h('b', (sel === tot ? sel : sel + ' of ' + tot) + '×'), ' ' + (nm ? nm.textContent : ''));
    });
    if (!el) el = h('div.ph-fsum', { role: 'button', 'aria-label': 'Change which ships go' });
    UI.mount(el, h('span.ph-fchips', chips), h('span.ph-fedit', 'Change'));
    const after = host.querySelector('h3') || host.querySelector('.side-title');
    if (after && after.nextSibling !== el) after.after(el);
  }
  // a pick panel collapses to a compact card: its strip height is its own content (the hidden steppers do not count), at most 60% of the map
  function fitStrip() {
    if (!sheet || !portrait()) return;
    const side = sheet.el, host = side.querySelector('.gx-sidebody'), panel = host && host.parentElement, wrap = side.parentElement && side.parentElement.querySelector('.gx-mapwrap');
    if (!side.dataset.phPick || !host || !panel || !wrap) { document.documentElement.style.removeProperty('--ph-strip'); return; }
    const cs = getComputedStyle(panel), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const need = sheet.grip.offsetHeight + pad + host.scrollHeight + 2;
    document.documentElement.style.setProperty('--ph-strip', Math.round(Math.min(need, wrap.clientHeight * 0.6)) + 'px');   // on the root: the minimap, map key and toasts sit above the strip too
  }
  function pickShown(name, params) {
    const side = sheet.el; side.dataset.phPick = name;
    sheet.set('strip'); updateFleetSum(); fitStrip(); pushInsets();
    framePick(name, params);
  }
  function pickHidden() {
    const side = sheet.el; if (!side.dataset.phPick) return false;
    delete side.dataset.phPick; const el = side.querySelector('.ph-fsum'); if (el) el.remove();
    fitStrip(); return true;
  }
  // the origin and every star the pick may land on, into the uncovered part of the map (only when one of them is hidden)
  function framePick(name, params) {
    const map = UI.Galaxy.map, S = G.S, E = G.player(); if (!map || !map.frame || !S) return;
    const origin = params && params.star !== undefined ? params.star : params && params.planet !== undefined ? params.planet : G.sel.star;
    const ids = [];
    try {
      if (name === 'fleetDeploy') { const r = map.getReach && map.getReach(); if (r && r.forEach) r.forEach(id => ids.push(id)); else if (typeof r === 'function') for (let i = 0; i < S.stars.length; i++) if (r(i)) ids.push(i); }
      else if (name === 'reloc') for (const q of S.planets) if (q.owner === E.id) ids.push(q.starId);
      else if (name === 'trans') for (let i = 0; i < S.stars.length; i++) if (M.Sim.Fleet.canReach(S, E, i, false)) ids.push(i);
    } catch (e) { console.warn('[phone frame]', e); }
    if (origin >= 0 && ids.indexOf(origin) < 0) ids.push(origin);
    map.frame(ids, { maxZoom: 2.6, pad: 30 });
  }
  // what covers the map: the HUD (top), the control column (right) and, in portrait, the sheet (bottom; at most 62% so a centred star stays
  // in view after a full sheet closes). Heights come from the sheet's own CSS (a probe reads --ph-strip; fitHalf measured half)
  function pushInsets(opt) {
    const map = UI.Galaxy.map; if (!map || !map.setInset) return;
    if (!active() || !sheet) { map.setInset(null, opt); return; }
    const side = sheet.el, wrap = side.parentElement && side.parentElement.querySelector('.gx-mapwrap'); if (!wrap) return;
    const wr = wrap.getBoundingClientRect(), hud = wrap.querySelector('.gx-hud'), ctrl = wrap.querySelector('.gmap-ctrl');
    const hr = hud ? hud.getBoundingClientRect() : null, cr = ctrl ? ctrl.getBoundingClientRect() : null;
    const top = hr && hr.height ? Math.max(0, hr.bottom - wr.top + 6) : 0, right = cr && cr.width ? Math.max(0, wr.right - cr.left + 6) : 0;
    let bottom = 0;
    if (portrait()) {
      if (!probe) { probe = h('div', { style: { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '0', height: 'var(--ph-strip)' } }); wrap.appendChild(probe); }   // not in the sheet: its non-panel children are hidden below full
      const st = sheet.get();
      bottom = st === 'strip' ? probe.offsetHeight : st === 'half' ? (halfPx || wr.height * 0.56) : wr.height;
      bottom = Math.min(bottom, wr.height * 0.62);
    }
    map.setInset({ top, right, bottom, left: 0 }, opt);
  }

  // ---- half height = the controls' own height, at most 70% of the map (portrait) --------------------------------------------------------------
  function fitHalf() {
    if (!sheet || !portrait() || sheet.get() !== 'half') return;
    const side = sheet.el, host = side.querySelector('.gx-sidebody'), panel = host && host.parentElement, wrap = side.parentElement && side.parentElement.querySelector('.gx-mapwrap');
    if (!host || !panel || !wrap) return;
    const cs = getComputedStyle(panel), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const need = sheet.grip.offsetHeight + pad + host.scrollHeight + 2;
    halfPx = Math.round(Math.min(need, wrap.clientHeight * 0.7));
    side.style.setProperty('--ph-half', halfPx + 'px');
  }
  const update = () => { if (!active()) return; updateSummary(); updateFleetSum(); if (sheet && sheet.get() === 'half') fitHalf(); };

  // which height a panel wants (runs after the original show, only when that show took effect)
  const show0 = UI.Side.show;
  UI.Side.show = function (name, params, _hd) {
    const r = show0.apply(this, arguments);
    if (!active() || UI.Side.current() !== name) return r;
    if (!(params && params.float)) noteShown(name, params);
    update();
    if (!sheet) return r;
    const held = UI.Side.held && _hd === UI.Side.held, pick = PICK[name] && !(params && params.float);
    const wasPick = !pick && pickHidden();
    if (params && params.float) { if (!held) sheet.set('strip'); return r; }                 // the float card carries its own Accept / Cancel
    if (held) { if (!holding) { holding = true; remembered = wasPick ? 'strip' : sheet.get(); } sheet.set('full'); return r; }
    if (holding) { holding = false; sheet.set(remembered === 'full' ? 'half' : remembered); return r; }   // the prompt was answered: back to where the player was
    if (pick) pickShown(name, params); else if (wasPick) sheet.set('strip');                // the pick is over (accepted or cancelled): the strip again
    return r;
  };

  const refresh0 = UI.Side.refresh;
  UI.Side.refresh = function () { const r = refresh0.apply(this, arguments); update(); return r; };

  // ---- the first-run card: how the phone layout works (once; Settings 'phoneHints'). Waits for a quiet moment: no dialog, no held prompt.
  const HINTS = [['planet', 'Tap the panel at the bottom to open your colony, or the star you picked. Drag its handle to resize it.'],
    ['info', 'Press and hold anything to see what it is: a star, a number, a button. A tap on a number or label works too.'],
    ['left', 'Back, top left (or your phone’s own back gesture), closes and goes back.'],
    ['more', 'More holds the game menu, Ship design and the Galaxy map. Battles resolve on their own.']];
  let hintTimer = 0;
  function firstRunHints() {
    clearTimeout(hintTimer);
    if (!active() || !M.Settings || M.Settings.get('phoneHints')) return;
    hintTimer = setTimeout(() => {
      const cur = UI.Screens.current;
      if (!cur || cur.id !== 'galaxy' || (UI.modalOpen && UI.modalOpen()) || UI.Side.held || G.busy) return;        // the next galaxy entry tries again
      M.Settings.set('phoneHints', true);
      UI.modal({ title: 'Playing on a phone', cls: 'ph-hints', width: '26rem', buttons: [{ label: 'Got it', value: true, primary: true }],
        body: h('div.ph-hints-b', HINTS.map(([ico, t]) => h('div.ph-hint', UI.icon(ico), h('span', t)))) });
    }, 900);
  }

  function installOverview() {
    const scr = UI.Screens.el('mapoverview'); if (!scr) return;
    const side = scr.querySelector('.ov-side'); if (!side || side.phSheet) return;
    UI.Phone.sheet(side, { states: ['strip', 'full'], initial: 'strip' });
  }

  if (M.Bus) M.Bus.on('screen', id => {
    if (!active()) return;
    if (id === 'galaxy') { installGalaxy(); firstRunHints(); } else if (id === 'mapoverview') installOverview();
  });
  UI.Phone.galaxySheet = () => sheet;
  UI.Phone.galaxyInsets = pushInsets;
})(window.MOO);
