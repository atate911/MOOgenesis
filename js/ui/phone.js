// Phone layout layer — UI behaviour. The gate is decided in index.html before any stylesheet loads (js/core/phone.js exposes it); the
// matching rules live in css/phone.css. Everything here is inert unless <html data-phone> is set.
//   UI.Phone.active()                        live gate (coarse pointer + shorter screen side ≤ 600px, or ?phone=1)
//   UI.Phone.back()                          THE Back: dispatches an Escape keydown. Every screen, modal, popup and panel already handles
//                                            Escape exactly like its right-click (kit.js keydown → modal stack → newest UI.bindKey; the
//                                            window-capture handlers of galaxymap / help run first), so one control covers the whole game.
//   UI.Phone.backHidden                      Set of screen ids where the global Back control stays hidden (they draw their own); every
//                                            other screen gets a slim app bar holding Back (<html data-ph-bar>; #screens starts below it)
//   UI.Phone.sheet(el, {states, initial})    makes a panel a bottom sheet: a drag handle (.ph-grip) becomes its first child and
//                                            el.dataset.sheet = 'strip' | 'half' | 'full' (heights come from CSS); tap cycles, drag snaps.
//                                            → {set(s), get(), on(fn), el, grip, states}; also stored as el.phSheet
//   UI.Phone.stepper({get, set, max})        −10 · −1 · value · +1 · +10 · Fill row for counts (ship-design weapon banks); .api.draw()
//   UI.Phone.showTip(html, x, y) / hideTip() the long-press tooltip popover (.ph-tip)
// Also installed on phones: a history sentinel (hardware Back / edge swipe → UI.Phone.back() instead of leaving the page), long-press on
// any [data-tip] shows its tooltip, the long-press contextmenu is swallowed (it would fire every right-click-as-Back handler), the F1
// help overlay is off (hover leader lines; the Almanac stays), and the game autosaves when the tab is hidden (phones kill background tabs).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, U = M.Util, doc = document, root = doc.documentElement;
  const active = () => !!(M.Phone && M.Phone.active());
  const tipHtml = el => (UI.tipHtml ? UI.tipHtml(el) : el.getAttribute('data-tip'));
  const P = UI.Phone = { active, backHidden: new Set(['menu', 'galaxy']) };

  // ------------------------------------------------------------------ the gate, live
  function recheck() {
    if (!M.Phone || M.Phone.forced) return;
    let on = false;
    try { on = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 600; } catch (e) { /* ignore */ }
    if (on === active()) return;
    M.Phone.set(on); root.toggleAttribute('data-phone', on);
    if (on) mountBack();
    updateBack(); if (M.Bus) M.Bus.emit('phone', on);
  }
  try { const mq = matchMedia('(pointer: coarse)'); if (mq && mq.addEventListener) mq.addEventListener('change', recheck); } catch (e) { /* ignore */ }

  // ------------------------------------------------------------------ Back
  let backEl = null;
  function mountBack() {                                                                     // only ever in the DOM on a phone
    if (backEl) return;
    const app = doc.getElementById('app') || doc.body;
    app.appendChild(h('div.ph-appbar', { 'aria-hidden': 'true' }));
    backEl = h('button.ph-back', { type: 'button', 'aria-label': 'Back', onclick: () => P.back() }, h('span.ch', '‹'), h('span', 'Back'));
    app.appendChild(backEl);
  }
  // the app bar is decided BEFORE a screen's enter() runs (Screens.go is wrapped below), so canvases measure the final size
  const barFor = id => active() && !!id && !P.backHidden.has(id);
  const setBar = id => root.toggleAttribute('data-ph-bar', barFor(id));
  function updateBack() {
    if (!backEl) return;
    const cur = UI.Screens && UI.Screens.current, id = cur && cur.id;
    const modal = !!(UI.modalOpen && UI.modalOpen());
    setBar(id);
    backEl.classList.toggle('on', active() && (modal || barFor(id)));
  }
  P.updateBack = updateBack;
  P.back = function () {
    const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    const at = doc.activeElement && doc.activeElement !== doc.body && doc.activeElement.isConnected ? doc.activeElement : doc.body;
    at.dispatchEvent(ev);
    setTimeout(updateBack, 0);
  };

  // history sentinel: one extra entry, armed on a real user gesture (an entry pushed without activation is skipped by the browser's
  // back-navigation intervention). Popping it = Back. On the main menu with no modal it stays unarmed, so Back leaves the page as usual.
  let armed = false;
  function wantArm() {
    if (!active()) return false;
    const id = UI.Screens && UI.Screens.current && UI.Screens.current.id;
    return !(id === 'menu' && !(UI.modalOpen && UI.modalOpen()));
  }
  function arm() { if (armed) return; try { history.pushState({ moo: 'back' }, ''); armed = true; } catch (e) { /* ignore */ } }
  window.addEventListener('popstate', () => { if (!armed) return; armed = false; P.back(); });
  const armOnGesture = e => { if (e.isTrusted && !armed && wantArm()) arm(); };
  window.addEventListener('pointerdown', armOnGesture, true);
  window.addEventListener('keydown', armOnGesture, true);

  // a long press raises contextmenu on Android: swallowed, or every right-click-as-Back handler would fire under the finger
  window.addEventListener('contextmenu', e => { if (active()) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

  // ------------------------------------------------------------------ long-press tooltips
  let tipEl = null, tipTimer = 0, lp = null, swallow = false;
  P.showTip = function (html, x, y) {
    if (!tipEl) { tipEl = h('div.ph-tip.ch'); (doc.getElementById('app') || doc.body).appendChild(tipEl); }
    tipEl.innerHTML = html; tipEl.classList.add('on');
    const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let l = x - w / 2, t = y - hh - 20; if (t < 6) t = y + 26;
    tipEl.style.left = Math.max(6, Math.min(innerWidth - w - 6, l)) + 'px';
    tipEl.style.top = Math.max(6, Math.min(innerHeight - hh - 6, t)) + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(P.hideTip, 6000);
  };
  P.hideTip = () => { if (tipEl) tipEl.classList.remove('on'); clearTimeout(tipTimer); tipTimer = 0; };
  const lpCancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  window.addEventListener('pointerdown', e => {
    swallow = false;
    if (!active() || e.pointerType === 'mouse') return;
    P.hideTip();
    const t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!t) return;
    lpCancel();
    const x = e.clientX, y = e.clientY;
    lp = { x, y, timer: setTimeout(() => { lp = null; const html = tipHtml(t); if (!html) return; P.showTip(html, x, y); swallow = true; }, 450) };
  }, true);
  window.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, true);
  window.addEventListener('pointerup', lpCancel, true);
  window.addEventListener('pointercancel', lpCancel, true);
  window.addEventListener('scroll', lpCancel, true);
  window.addEventListener('click', e => { if (swallow) { swallow = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);   // the tap that ended the press is not a click

  // ------------------------------------------------------------------ bottom sheet
  P.sheet = function (el, o) {
    o = Object.assign({ states: ['strip', 'half', 'full'], initial: 'strip' }, o || {});
    const states = o.states, subs = [];
    let state = o.initial, drag = null;
    const grip = h('div.ph-grip', { role: 'button', 'aria-label': 'Expand or collapse' });
    el.insertBefore(grip, el.firstChild);
    el.classList.add('ph-sheet');
    function set(s, silent) {
      if (states.indexOf(s) < 0) return;
      const was = state; state = s; el.dataset.sheet = s;
      if (!silent && was !== s) subs.slice().forEach(f => { try { f(s, was); } catch (e) { console.error(e); } });
    }
    grip.addEventListener('pointerdown', e => {
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag = { y: e.clientY, t: e.timeStamp, h0: el.getBoundingClientRect().height, moved: false };
      el.classList.add('ph-dragging'); e.preventDefault();
    });
    grip.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = drag.y - e.clientY;
      if (!drag.moved && Math.abs(dy) > 6) drag.moved = true;
      if (drag.moved) el.style.height = Math.max(0, drag.h0 + dy) + 'px';
    });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null; el.classList.remove('ph-dragging'); el.style.height = '';
      const i = states.indexOf(state);
      if (!d.moved) { set(states[(i + 1) % states.length]); return; }                       // a tap on the handle cycles
      const dy = d.y - e.clientY, v = dy / Math.max(1, e.timeStamp - d.t);                 // px per ms, up = positive
      let steps = Math.round(dy / (innerHeight * 0.28));
      if (!steps && Math.abs(v) > 0.4) steps = Math.sign(v);
      set(states[U.clamp(i + steps, 0, states.length - 1)]);
    };
    grip.addEventListener('pointerup', end); grip.addEventListener('pointercancel', end);
    set(state, true);
    const api = { set, get: () => state, on: f => { subs.push(f); return () => U.remove(subs, f); }, el, grip, states };
    el.phSheet = api;
    return api;
  };

  // ------------------------------------------------------------------ count stepper
  P.stepper = function (o) {
    const val = h('span.ph-stv');
    const step = d => { const v = o.get(); o.set(d === 'fill' ? (o.max ? o.max() : v) : v + d); draw(); };
    const b = (lbl, d, tip) => UI.button(lbl, () => step(d), { small: true, tip });
    const el = h('div.ph-step', b('−10', -10), b('−', -1), val, b('+', 1), b('+10', 10), o.fill === false ? null : b('Fill', 'fill', 'As many as fit'));
    function draw() { val.textContent = String(o.get()); }
    draw(); el.api = { draw };
    return el;
  };

  // ------------------------------------------------------------------ install (UI.init runs at boot, after every script has loaded)
  const init0 = UI.init;
  UI.init = function () {
    if (init0) init0.apply(this, arguments);
    if (active()) mountBack();
    if (M.Bus) M.Bus.on('screen', () => setTimeout(updateBack, 0));
    const go0 = UI.Screens.go;
    UI.Screens.go = function (id) { setBar(id); return go0.apply(UI.Screens, arguments); };
    const modal0 = UI.modal;                                                                 // the Back control shows while a modal is open
    UI.modal = function () { const p = modal0.apply(this, arguments); updateBack(); p.then(() => setTimeout(updateBack, 170), () => {}); return p; };
    if (UI.Help && UI.Help.overlay) { const ov0 = UI.Help.overlay; UI.Help.overlay = function () { return active() ? false : ov0.apply(this, arguments); }; }
    if (active()) { try { history.replaceState({ moo: 0 }, ''); } catch (e) { /* ignore */ } }
    updateBack();
  };

  // phones kill background tabs: keep the autosave slot current whenever the game leaves the foreground (never mid-turn)
  const flush = () => { try { const G = M.Game; if (active() && G && G.S && !G.busy && M.Settings && M.Settings.get('autosave') !== false) G.autosave(); } catch (e) { /* ignore */ } };
  window.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) flush(); });
})(window.MOO);
