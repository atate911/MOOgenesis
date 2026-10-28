// Phone layout layer — the galaxy screen. Inert unless <html data-phone> is set (css/phone.css holds the matching rules).
// The map fills the screen and the side panel becomes a bottom sheet (UI.Phone.sheet) with three heights:
//   strip   the title row (a thumbnail, the star / colony name) and a summary line (.ph-sum: a colony's pop, production and what it builds
//           with any warning; a star's planet, owner and range) — the map stays in view and tappable; a tap on it opens the sheet halfway
//   half    the controls: a colony's five sliders and Ships / Reloc / Trans (the picture, stats and build box wait for full), or a
//           pick-a-star panel's counts and Accept / Cancel; its height is measured from that content (at most 70% of the map)
//   full    everything, including the turn log; a held prompt (pre-battle card, battle result, exploration / colonise card) opens here
// The sheet is driven from UI.Side.show: a floating panel (opened beside a map tap) pins to the bottom edge and drops the sheet to the strip,
// a pick-a-star panel (Reloc / Trans / Fleet deployment) opens it halfway so the map stays visible for the pick, a held prompt opens it fully
// and the state from before the prompt comes back once it is answered; the turn's processing collapses it. A tap on the title plate while
// collapsed opens the sheet halfway and centres the map on the selection. Also reused by the map overview screen (its side panel → sheet).
// The bottom bar becomes fixed tabs: Planets · Fleet · Tech · Races · More, then Next turn (css/phone.css lays out galaxy.js's own buttons;
// Game, Design and Map are hidden: More opens the game menu, which on a phone also offers Design and the galaxy map — gamemenu.js).
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Game, h = UI.h, U = M.Util, Q = M.Sim.Q, root = document.documentElement;
  const active = () => !!(UI.Phone && UI.Phone.active());
  const portrait = () => { try { return matchMedia('(orientation: portrait)').matches; } catch (e) { return true; } };   // landscape: the panel is a column, not a sheet
  const PICK = { reloc: true, trans: true, fleetDeploy: true };
  const TABS = { Game: ['game'], Design: ['design'], Map: ['map'], Fleet: ['fleet', 'fleet'], Races: ['races', 'diplomacy'], Planets: ['planets', 'planet'], Tech: ['tech', 'research'] };
  let sheet = null, holding = false, remembered = 'strip';

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
      if (e.target.closest('.cyc') || (e.target.closest('.btn, button, input') && !e.target.closest('.side-title'))) return;
      e.stopPropagation(); e.preventDefault();
      sheet.set('half'); UI.Phone.haptic('snap');
      try { const id = G.sel && G.sel.star; if (id >= 0 && UI.Galaxy.map) UI.Galaxy.map.centerOn(id, { animate: true }); } catch (err) { /* optional */ }
    }, true);
    sheet.on(st => { if (st === 'half') requestAnimationFrame(fitHalf); scheduleInset(); if (UI.Phone.updateBack) UI.Phone.updateBack(); });
    // Back closes what is open: the control (shown while the sheet covers the map) and the phone's back gesture both arrive as Escape; an open
    // sheet collapses instead of the game menu opening. A held prompt keeps its own keys, and a dialog on top keeps Escape.
    UI.Phone.backWanted = () => active() && !!sheet && sheet.get() === 'full' && portrait() && !holding && UI.Screens.current && UI.Screens.current.id === 'galaxy';
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !active() || !sheet || sheet.get() === 'strip' || !portrait() || holding) return;
      if (!UI.Screens.current || UI.Screens.current.id !== 'galaxy' || (UI.modalOpen && UI.modalOpen())) return;
      e.preventDefault(); e.stopImmediatePropagation();
      sheet.set('strip'); UI.Phone.haptic('snap');
    }, true);
    side.addEventListener('transitionend', e => { if (e.propertyName === 'height') syncInset(); });        // the sheet's height has settled: measure now, not on the timer
    const wrap = scr.querySelector('.gx-mapwrap'); if (wrap) wrap.addEventListener('pointerdown', () => syncInset(true), true);   // and right before a drag / tap on the map (soft: the view must not move under the finger)
    if (UI.Galaxy.map && UI.Galaxy.map.on) UI.Galaxy.map.on('controls', () => syncInset(true));        // More unfolded or folded the map's toggles: re-check the column fits
    window.addEventListener('resize', () => { requestAnimationFrame(fitHalf); scheduleInset(); });
    if (M.Bus) { M.Bus.on('turn:processing', on => { if (!active() || !sheet) return; if (on) { holding = false; sheet.set('strip'); markPick(false); } markHeld(false); }); M.Bus.on('screen', id => { if (id === 'galaxy') scheduleInset(); }); }
    scheduleInset();
    noteShown(UI.Side.current(), null); update();                                          // the first entry showed its panel before the sheet existed
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

  // ---- half height = the controls' own height, at most 70% of the map (portrait) --------------------------------------------------------------
  function fitHalf() {
    if (!sheet || !portrait() || sheet.get() !== 'half') return;
    const side = sheet.el, host = side.querySelector('.gx-sidebody'), panel = host && host.parentElement, wrap = side.parentElement && side.parentElement.querySelector('.gx-mapwrap');
    if (!host || !panel || !wrap) return;
    const cs = getComputedStyle(panel), pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const need = sheet.grip.offsetHeight + pad + host.scrollHeight + 2;
    const cap = PICK[UI.Side.current()] ? 0.45 : 0.7;                                      // a pick needs the map: its panel takes at most 45% (the body scrolls)
    side.style.setProperty('--ph-half', Math.round(Math.min(need, wrap.clientHeight * cap)) + 'px');
  }
  const update = () => { if (!active()) return; updateSummary(); if (sheet && sheet.get() === 'half') fitHalf(); scheduleInset(); };

  // ---- the map's bottom inset: what the sheet (portrait: it lies over the map) or the floating card covers, so the camera keeps the galaxy over the
  // uncovered part and a drag can reach the stars under them (galaxymap.js setInset). Measured once the sheet's height transition has ended.
  let insetTimer = 0;
  function syncInset(soft) {
    const map = UI.Galaxy.map; if (!active() || !map || !map.setInset) return;
    const scr = UI.Screens.el && UI.Screens.el('galaxy'), wrap = scr && scr.querySelector('.gx-mapwrap'); if (!wrap) return;
    const w = wrap.getBoundingClientRect(); let bottom = 0;
    const covers = el => { if (!el) return 0; const r = el.getBoundingClientRect(); if (!r.height || r.right <= w.left || r.left >= w.right || r.top <= w.top) return 0; return Math.max(0, w.bottom - r.top); };
    bottom = Math.max(covers(sheet && sheet.el), covers(scr.querySelector('.gx-side.gx-float.on')));
    map.setInset({ bottom: Math.round(bottom), soft: !!soft });
    // the map's control column stands on the uncovered band (css/phone.css --ph-inset); two columns when one would not fit between the HUD and the cover
    const gx = scr.querySelector('.gx'), ctl = wrap.querySelector('.gmap-ctrl'), top = wrap.querySelector('.gx-top');
    if (gx) {
      const b = bottom >= w.height * 0.75 ? 0 : bottom;                                      // the map is hidden, not inset: the column stays put
      gx.style.setProperty('--ph-inset', Math.round(b) + 'px');
      const tap = parseFloat(getComputedStyle(root).getPropertyValue('--tap')) || 44, free = w.height - b - (top ? top.getBoundingClientRect().bottom - w.top : 0);
      const shownCtl = ctl ? Array.from(ctl.children).filter(c => c.offsetParent !== null || getComputedStyle(c).display !== 'none').length : 0;   // the folded toggles do not count
      gx.classList.toggle('ph-ctl-tight', !!ctl && shownCtl * tap + 24 > free);
    }
  }
  const markPick = on => { const scr = UI.Screens.el && UI.Screens.el('galaxy'), gx = scr && scr.querySelector('.gx'); if (gx) gx.classList.toggle('ph-pick', !!on); };
  function scheduleInset() { clearTimeout(insetTimer); insetTimer = setTimeout(syncInset, 280); }

  // A held prompt (the turn's pending question) must stack above the map's busy overlay (.gx-busy, z-index 20): on a phone the sheet lies OVER
  // the map, and under that overlay its buttons could not be tapped — the turn then waited forever on a card the player could see but not
  // answer (the "Year …" freeze). css/phone.css raises [data-held] above the overlay; nothing else on the sheet may reach past it mid-turn.
  const markHeld = on => { if (sheet) { if (on) sheet.el.dataset.held = ''; else delete sheet.el.dataset.held; } };

  // which height a panel wants (runs after the original show, only when that show took effect)
  const show0 = UI.Side.show;
  UI.Side.show = function (name, params, _hd) {
    const r = show0.apply(this, arguments);
    if (!active() || UI.Side.current() !== name) return r;
    // a destination pick (Reloc / Trans / fleet deployment, in the sheet or floating after the first pick) hides the turn-message stack over the map:
    // on a small phone it and the sheet left a strip of a few dozen pixels for the pick (css/phone.css .ph-pick); the messages return with the next panel
    markPick(!!PICK[name]);
    if (!(params && params.float)) noteShown(name, params);
    update();
    if (!sheet) return r;
    const held = UI.Side.held && _hd === UI.Side.held;
    if (params && params.float) { if (!held) sheet.set('strip'); return r; }                 // the float card carries its own Accept / Cancel
    if (held) { if (!holding) { holding = true; remembered = sheet.get(); } markHeld(true); sheet.set('full'); return r; }
    if (holding) { holding = false; markHeld(false); sheet.set(remembered === 'full' ? 'half' : remembered); return r; }   // the prompt was answered: back to where the player was
    if (PICK[name]) sheet.set('half');
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

  // ---- the install card: from the second visit in a browser tab (never in the installed app), once. Android Chrome hands over its own install
  // prompt (beforeinstallprompt) when the page qualifies, so the card's button installs at once; elsewhere it says where the menu item is.
  const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
  if (active() && M.Settings && !standalone()) M.Settings.set('phoneVisits', (M.Settings.get('phoneVisits') | 0) + 1);
  let installTimer = 0;
  function installHint() {
    clearTimeout(installTimer);
    if (!active() || !M.Settings || standalone() || M.Settings.get('installHint') || (M.Settings.get('phoneVisits') | 0) < 2 || !M.Settings.get('phoneHints')) return;
    installTimer = setTimeout(() => {
      const cur = UI.Screens.current;
      if (!cur || cur.id !== 'galaxy' || (UI.modalOpen && UI.modalOpen()) || UI.Side.held || G.busy) return;
      M.Settings.set('installHint', true);
      const how = installEvt ? 'Install it and it opens full screen, without the browser bars, straight from your home screen.'
        : ios() ? 'In Safari, tap the Share button, then “Add to Home Screen”. It then opens full screen, without the browser bars.'
          : 'Open your browser’s menu and choose “Install app” or “Add to Home screen”. It then opens full screen, without the browser bars.';
      const buttons = installEvt ? [{ label: 'Not now', value: false }, { label: 'Install', value: true, primary: true }] : [{ label: 'Got it', value: true, primary: true }];
      UI.modal({ title: 'Keep the game on your home screen', cls: 'ph-hints', width: '26rem', buttons, body: h('div.ph-hints-b', h('div.ph-hint', UI.icon('home'), h('span', how))) })
        .then(v => { if (v && installEvt) { try { installEvt.prompt(); } catch (e) { /* the browser said no */ } installEvt = null; } });
    }, 1500);
  }

  function installOverview() {
    const scr = UI.Screens.el('mapoverview'); if (!scr) return;
    const side = scr.querySelector('.ov-side'); if (!side || side.phSheet) return;
    UI.Phone.sheet(side, { states: ['strip', 'full'], initial: 'strip' });
  }

  if (M.Bus) M.Bus.on('screen', id => {
    if (!active()) return;
    if (id === 'galaxy') { installGalaxy(); firstRunHints(); installHint(); } else if (id === 'mapoverview') installOverview();
  });
  UI.Phone.galaxySheet = () => sheet;
})(window.MOO);
