// In-game menu (modal): Resume · Save · Load · Options · Almanac · Quit to title.
//   MOO.UI.gameMenu() -> Promise resolving to the chosen action ('resume' | 'quit' | 'help' | 'saved' | 'loaded' ...) or null (Esc / click-away).
// Open it from the galaxy screen's bottom-bar "Game" button and on Esc. First letters are hotkeys (underlined); Esc or right-click closes.
// Options / Save / Load open as modals and return to this menu when cancelled. A button is enabled only when it applies
// (no game: no save / quit; no 'help' screen: no almanac). Needs UI.Controls (setup.js).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;
  const C = () => UI.Controls;
  let open = null;

  const game = () => M.Game || null;
  function hasGame() { const G = game(); try { return !!(G && typeof G.hasGame === 'function' && G.hasGame()); } catch (e) { return false; } }
  function summary() {
    const G = game();
    try { if (G && G.S && M.Save && M.Save.meta) return M.Save.meta(G.S); } catch (e) { /* unknown state shape */ }
    return null;
  }

  // ok() -> true, or a string explaining why the entry is unavailable
  const ENTRIES = [
    { id: 'resume', label: 'Resume', icon: 'play', kbd: 'R', primary: true, ok: () => true },
    { id: 'save', label: 'Save game', icon: 'save', kbd: 'S', sep: true, ok: () => (UI.openSaveLoad ? (hasGame() ? true : 'There is no game in progress to save.') : 'Saving is not available.') },
    { id: 'load', label: 'Load game', icon: 'load', kbd: 'L', ok: () => (UI.openSaveLoad ? true : 'Loading is not available.') },
    { id: 'options', label: 'Options', icon: 'sliders', kbd: 'O', ok: () => (UI.openOptions ? true : 'Options are not available.') },
    { id: 'news', label: 'GNN archive', icon: 'news', kbd: 'G', ok: () => (UI.GNN && UI.GNN.archive ? (hasGame() ? true : 'There is no game in progress.') : 'The news archive is not available.') },
    { id: 'spies', label: 'Spies caught', icon: 'spy', kbd: 'C', ok: () => (UI.Spy && UI.Spy.caught ? (hasGame() ? true : 'There is no game in progress.') : 'Not available.') },
    { id: 'help', label: 'Almanac', icon: 'book', kbd: 'A', ok: () => (UI.Screens.has('help') ? true : 'The almanac is not available yet.') },
    { id: 'quit', label: 'Quit to title', icon: 'quit', kbd: 'Q', sep: true, danger: true, ok: () => (hasGame() ? true : 'There is no game in progress.') },
  ];

  function confirmQuit() {
    return C().confirmDanger('Quit to title', h('div', h('p', 'Return to the title screen?'), h('p.dim', 'Progress since your last save will be lost.')), 'Quit to title', false).then(yes => {
      if (!yes) return UI.gameMenu();
      const G = game();
      if (G && typeof G.quitToMenu === 'function') G.quitToMenu(); else if (UI.Screens.has('menu')) UI.Screens.go('menu');
      return 'quit';
    });
  }

  function run(id) {
    switch (id) {
      case 'resume': return 'resume';
      case 'save': case 'load': return UI.openSaveLoad(id).then(res => (res && res.action) || UI.gameMenu());
      case 'options': return UI.openOptions().then(() => UI.gameMenu());
      case 'news': return UI.GNN.archive(game().S).then(() => UI.gameMenu());
      case 'spies': return UI.Spy.caught().then(() => UI.gameMenu());
      case 'help': { const cur = UI.Screens.current; UI.Screens.go('help', { from: cur && cur.id }); return 'help'; }
      case 'quit': return confirmQuit();
      default: return null;
    }
  }

  UI.gameMenu = function () {
    if (open) return open;
    const ctl = C(), info = summary(), live = hasGame();
    const list = h('div.gm-list');
    let pm = null;
    const btns = {};
    ENTRIES.forEach(en => {
      const why = en.ok();
      const enabled = why === true;
      const b = UI.button(en.label, () => pm.close(en.id), { block: true, primary: en.primary, danger: en.danger, disabled: !enabled });
      if (enabled) ctl.hotkey(b, en.kbd);
      b.insertBefore(ctl.icon(en.icon), b.firstChild);
      btns[en.id] = enabled ? b : null;
      if (en.sep) list.appendChild(h('div.gm-sep'));
      list.appendChild(h('div.gm-item', { tip: enabled ? null : why }, b));
    });

    const head = live && info
      ? h('div.gm-info', ctl.raceBadge(info.race, 3.3, info.color),
        h('div.gm-info-t', h('b', ctl.raceName(info.race)), h('span', (info.leader ? info.leader + ' · ' : '') + 'Year ' + ctl.calendarYear(info.year) + ' · Turn ' + info.turn)))
      : null;
    pm = UI.modal({ title: 'Game menu', body: h('div.gm', head, list), buttons: [], width: '25rem', cls: 'gm-modal' });

    const move = dir => {
      const all = Array.from(list.querySelectorAll('button:not(:disabled)'));
      if (!all.length) return false;
      const i = all.indexOf(document.activeElement);
      all[i < 0 ? (dir > 0 ? 0 : all.length - 1) : (i + dir + all.length) % all.length].focus();
      return true;
    };
    const keys = { ArrowDown: () => move(1), ArrowUp: () => move(-1) };
    ENTRIES.forEach(en => { if (btns[en.id]) keys[en.kbd.toLowerCase()] = keys[en.kbd] = () => { pm.close(en.id); return true; }; });
    const off = ctl.keyScope(pm.el, keys), off2 = ctl.trapFocus(pm.el);
    ctl.rightClick(pm.el.parentNode, () => pm.close(null));           // right-click = cancel, like Esc
    pm.then(() => { off(); off2(); });

    open = pm.then(id => { open = null; return run(id); });
    return open;
  };

  UI.css('gamemenu', `
    .gm-modal { min-width:0; }
    .gm-info { display:flex; align-items:center; gap:.85rem; padding:.05rem 0 .75rem; margin-bottom:.7rem; border-bottom:1px solid rgba(214,179,106,.22); }
    .gm-info-t b { display:block; font:400 1.25rem/1.1 var(--font-display); color:var(--brass-hi); }
    .gm-info-t span { color:var(--mist); font-size:.9rem; }
    .gm-list { display:flex; flex-direction:column; gap:.5rem; }
    .gm-sep { height:1px; margin:.25rem 0; background:linear-gradient(90deg, transparent, rgba(214,179,106,.4), transparent); }
    .gm-item .btn { width:100%; justify-content:flex-start; gap:.7em; padding:.55em 1.1em; font-size:1.18rem; }
    .gm-item .btn .ico { width:1.2em; height:1.2em; }
    .gm-item .btn .kbd { margin-left:auto; padding-left:1em; font-size:.78rem; }
  `);
})(window.MOO);
