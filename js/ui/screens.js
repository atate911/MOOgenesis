// Screen manager. Each screen registers itself:
//   MOO.UI.Screens.register('galaxy', {
//     create(el) {},              // once, lazily — build DOM inside <section class="screen">
//     enter(params) {},           // every time the screen is shown
//     leave() {},                 // when another screen replaces it
//     update(dt, t) {},           // per animation frame while active (seconds)
//     resize(w, h) {},            // window resized while active
//   });
//   MOO.UI.Screens.go('galaxy', {…});   MOO.UI.Screens.current -> {id, params}
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;
  const defs = {}, els = {};
  let cur = null;

  UI.Screens = {
    register(id, def) { defs[id] = def; },
    has: id => !!defs[id],
    get current() { return cur; },
    el: id => els[id],
    go(id, params) {
      const d = defs[id];
      if (!d) throw new Error('Unknown screen: ' + id);
      const root = document.getElementById('screens');
      if (!els[id]) {
        els[id] = h('section.screen', { dataset: { screen: id } });
        root.appendChild(els[id]);
        if (d.create) d.create(els[id]);
      }
      if (cur && cur.id !== id) {
        const od = defs[cur.id], oe = els[cur.id];
        if (od.leave) { try { od.leave(); } catch (e) { console.error(e); } }
        oe.classList.remove('active');
        // the leaving screen stays visible for a beat and fades under the entering one (.screen.fade-out keeps it displayed)
        oe.classList.add('fade-out'); clearTimeout(oe._fadeT);
        oe._fadeT = setTimeout(() => oe.classList.remove('fade-out'), 240);
      }
      clearTimeout(els[id]._fadeT); els[id].classList.remove('fade-out');
      UI.hideTip();
      const prev = cur;
      cur = { id, params: params || {}, prev: prev && prev.id };
      els[id].classList.add('active', 'fade-in');
      setTimeout(() => els[id] && els[id].classList.remove('fade-in'), 420);
      if (d.enter) d.enter(cur.params);
      if (d.resize) d.resize(window.innerWidth, window.innerHeight);
      M.Bus.emit('screen', id, cur.params);
    },
    // re-run enter() on the current screen (refresh after state changes)
    refresh() { if (cur && defs[cur.id].enter) defs[cur.id].enter(cur.params); },
  };

  UI.onFrame((dt, t) => { if (cur) { const d = defs[cur.id]; if (d.update) d.update(dt, t); } });
  UI.debounce = M.Util.debounce; // available to screens
  window.addEventListener('resize', UI.debounce(() => { if (cur && defs[cur.id].resize) defs[cur.id].resize(innerWidth, innerHeight); }, 60));
})(window.MOO);
