// Phone layout layer — the galaxy screen. Inert unless <html data-phone> is set (css/phone.css holds the matching rules).
// The map fills the screen and the side panel becomes a bottom sheet (UI.Phone.sheet) with three heights:
//   strip   the panel's title plate only (the star / colony name) — the map stays in view and tappable
//   half    the colony sliders and build box, or a pick-a-star panel's counts and Accept / Cancel
//   full    everything, including the turn log; a held prompt (pre-battle card, battle result, exploration / colonise card) opens here
// The sheet is driven from UI.Side.show: a floating panel (opened beside a map tap) pins to the bottom edge and drops the sheet to the strip,
// a pick-a-star panel (Reloc / Trans / Fleet deployment) opens it halfway so the map stays visible for the pick, a held prompt opens it fully
// and the state from before the prompt comes back once it is answered; the turn's processing collapses it. A tap on the title plate while
// collapsed opens the sheet halfway and centres the map on the selection. Also reused by the map overview screen (its side panel → sheet).
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Game;
  const active = () => !!(UI.Phone && UI.Phone.active());
  const PICK = { reloc: true, trans: true, fleetDeploy: true };
  let sheet = null, holding = false, remembered = 'strip';

  function installGalaxy() {
    const scr = UI.Screens.el('galaxy'); if (!scr) return;
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
