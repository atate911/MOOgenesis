// Phone layout layer — the galaxy screen. Inert unless <html data-phone> is set (css/phone.css holds the matching rules).
// The map fills the screen and the side panel becomes a bottom sheet (UI.Phone.sheet) with three heights:
//   strip   the panel's title plate only (the star / colony name) — the map stays in view and tappable
//   half    the colony sliders and build box, or a pick-a-star panel's counts and Accept / Cancel
//   full    everything, including the turn log; a held prompt (pre-battle card, battle result, exploration / colonise card) opens here
// The sheet is driven from UI.Side.show: a floating panel (opened beside a map tap) pins to the bottom edge and drops the sheet to the strip,
// a pick-a-star panel (Reloc / Trans / Fleet deployment) opens it halfway so the map stays visible for the pick, a held prompt opens it fully
// and the state from before the prompt comes back once it is answered; the turn's processing collapses it. A tap on the title plate while
// collapsed opens the sheet halfway and centres the map on the selection. Also reused by the map overview screen (its side panel → sheet).
// The bottom bar becomes fixed tabs: Planets · Fleet · Tech · Races · More, then Next turn (css/phone.css lays out galaxy.js's own buttons;
// Game, Design and Map are hidden: More opens the game menu, which on a phone also offers Design and the galaxy map — gamemenu.js).
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Game;
  const active = () => !!(UI.Phone && UI.Phone.active());
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
    side.addEventListener('click', e => {                                                 // the collapsed title plate: open + centre on the selection
      if (sheet.get() !== 'strip' || !e.target.closest) return;
      if (e.target.closest('.cyc, .btn, button, input')) return;
      if (!e.target.closest('.side-title')) return;
      sheet.set('half');
      try { const id = G.sel && G.sel.star; if (id >= 0 && UI.Galaxy.map) UI.Galaxy.map.centerOn(id, { animate: true }); } catch (err) { /* optional */ }
    });
    if (M.Bus) M.Bus.on('turn:processing', on => { if (on && active() && sheet) { holding = false; sheet.set('strip'); } });
  }

  // which height a panel wants (runs after the original show, only when that show took effect)
  const show0 = UI.Side.show;
  UI.Side.show = function (name, params, _hd) {
    const r = show0.apply(this, arguments);
    if (!active() || !sheet || UI.Side.current() !== name) return r;
    const held = UI.Side.held && _hd === UI.Side.held;
    if (params && params.float) { if (!held) sheet.set('strip'); return r; }                 // the float card carries its own Accept / Cancel
    if (held) { if (!holding) { holding = true; remembered = sheet.get(); } sheet.set('full'); return r; }
    if (holding) { holding = false; sheet.set(remembered === 'full' ? 'half' : remembered); return r; }   // the prompt was answered: back to where the player was
    if (PICK[name]) sheet.set('half');
    return r;
  };

  function installOverview() {
    const scr = UI.Screens.el('mapoverview'); if (!scr) return;
    const side = scr.querySelector('.ov-side'); if (!side || side.phSheet) return;
    UI.Phone.sheet(side, { states: ['strip', 'full'], initial: 'strip' });
  }

  if (M.Bus) M.Bus.on('screen', id => {
    if (!active()) return;
    if (id === 'galaxy') installGalaxy(); else if (id === 'mapoverview') installOverview();
  });
  UI.Phone.galaxySheet = () => sheet;
})(window.MOO);
