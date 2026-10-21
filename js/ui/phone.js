// Phone layout layer — UI behaviour. The gate is decided in index.html before any stylesheet loads (js/core/phone.js exposes it); the
// matching rules live in css/phone.css. Everything here is inert unless <html data-phone> is set.
//   UI.Phone.active()                        live gate (coarse pointer + shorter screen side ≤ 600px, or ?phone=1)
//   UI.Phone.back()                          THE Back: dispatches an Escape keydown. Every screen, modal, popup and panel already handles
//                                            Escape exactly like its right-click (kit.js keydown → modal stack → newest UI.bindKey; the
//                                            window-capture handlers of galaxymap / help run first), so one control covers the whole game.
//   UI.Phone.backHidden                      Set of screen ids where the global Back control stays hidden (they draw their own); every
//                                            other screen gets a slim app bar holding Back and the screen's title (<html data-ph-bar>;
//                                            #screens starts below it; css/phone.css hides the in-screen titles and OK buttons it replaces)
//   UI.Phone.sheet(el, {states, initial})    makes a panel a bottom sheet: a drag handle (.ph-grip) becomes its first child and
//                                            el.dataset.sheet = 'strip' | 'half' | 'full' (heights come from CSS); tap cycles, drag snaps.
//                                            → {set(s), get(), on(fn), el, grip, states}; also stored as el.phSheet
//   UI.Phone.stepper({get, set, max})        −10 · −1 · value · +1 · +10 · Fill row for counts (ship-design weapon banks); .api.draw()
//   UI.Phone.showTip(html, x, y) / hideTip() the tooltip popover (.ph-tip)
//   UI.Phone.say(desktop, phone)             the phone wording of a visible hint where the desktop one names keys or the mouse
//   UI.Phone.key(k)                          a key badge's touch equivalent: Space → Tap, Esc → Back; null for keys a phone has no use for
//   UI.Phone.haptic(kind)                    a short vibration: 'tap' | 'step' | 'snap' | 'turn' | 'warn' (Settings 'haptics', on by
//                                            default). Android: navigator.vibrate. iOS has no vibration API: on iOS 18+ toggling a hidden
//                                            <input type=checkbox switch> plays the system tick (inside a tap only); elsewhere nothing happens
// Also installed on phones: a history sentinel (hardware Back / edge swipe → UI.Phone.back() instead of leaving the page); tooltips on
// touch — a long press on any [data-tip] shows it, and so does a plain tap where the tap does nothing else (text, numbers, chips: the
// element and its ancestors up to the tip holder are not controls, carry no data-act from UI.h and no pointer / grab cursor); a disabled
// button's tip (it takes no pointer events) shows for a tap or a press on its box; tip texts lose their keyboard and mouse clauses; the
// long-press contextmenu is swallowed (it would fire every right-click-as-Back handler); the F1 help overlay is off (hover leader lines;
// the Almanac stays); and the game autosaves when the tab is hidden (phones kill background tabs).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, U = M.Util, doc = document, root = doc.documentElement;
  const active = () => !!(M.Phone && M.Phone.active());
  const P = UI.Phone = { active, backHidden: new Set(['menu', 'galaxy']) };
  P.say = (desktop, phone) => (active() ? phone : desktop);
  const KEYS = { Space: 'Tap', Esc: 'Back', Enter: 'Tap', '↵': '↵' };
  P.key = k => (!active() ? k : KEYS[k] !== undefined ? KEYS[k] : null);

  // haptics: one short pattern per kind; slider steps at most every 45 ms so a drag ticks rather than buzzes
  const BUZZ = { tap: 8, step: 5, snap: 10, turn: 20, warn: [20, 40, 20] };
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const canVibrate = typeof nav.vibrate === 'function';
  const isIOS = /iP(hone|ad|od)/.test(nav.platform || '') || (/Mac/.test(nav.userAgent || '') && 'ontouchend' in doc);
  let lastStep = 0, iosSw = null;
  function iosTick() {
    try {
      if (!iosSw) {
        const cb = doc.createElement('input'); cb.type = 'checkbox'; cb.setAttribute('switch', '');
        iosSw = doc.createElement('label'); iosSw.setAttribute('aria-hidden', 'true'); iosSw.appendChild(cb);
        iosSw.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        doc.body.appendChild(iosSw);
      }
      iosSw.click();
    } catch (e) { /* ignore */ }
  }
  P.haptic = function (kind) {
    if (!active() || (M.Settings && M.Settings.get('haptics') === false)) return false;
    if (kind === 'step') { const t = performance.now(); if (t - lastStep < 45) return false; lastStep = t; }
    if (canVibrate) { try { return nav.vibrate(BUZZ[kind] || BUZZ.tap); } catch (e) { return false; } }
    if (isIOS) { iosTick(); return true; }
    return false;
  };

  // tooltip text on a phone: no hotkeys, no mouse — "Previous colony <b>F2</b>" → "Previous colony", "Click to rename" → "Tap to rename";
  // a " · "-separated clause about the wheel, right-click, hover or a key is dropped
  const DESK = /right-click|mouse|wheel|\bhover|\bCtrl\b|\bShift\b|\bAlt\b|\bkey [0-9A-Z]\b|hotkey|keyboard|\bpress\b/i;
  function touchText(html) {
    if (!html || typeof html !== 'string') return html;
    let t = html.replace(/\s*\([^()]*(?:wheel|right-click|\bkey [0-9A-Z]\b|Ctrl|Shift)[^()]*\)/gi, '')
      .replace(/\s*\((?:[A-Z0-9=+\-−]|F\d{1,2}|Esc|Space|Enter|Home|Del)\)/g, '')
      .replace(/\s*<b>(?:F\d{1,2}|[A-Z0-9=+\-−/]|Esc|Space|Enter|Home|Del|(?:Ctrl|Shift|Alt)\+?[^<]*)<\/b>/g, '');
    t = t.split(/(<br\s*\/?>)/i).map(part => /^<br/i.test(part) ? part : part.split(/\s·\s/).filter(c => !DESK.test(c.replace(/<[^>]+>/g, ''))).join(' · ')).join('');
    return t.replace(/double-click/gi, 'double-tap').replace(/\bClick/g, 'Tap').replace(/\bclick(s?)\b/g, 'tap$1').replace(/(<br\s*\/?>\s*)+$/i, '').trim();
  }
  const tipHtml = el => { const raw = UI.tipHtml ? UI.tipHtml(el) : el.getAttribute('data-tip'); return active() ? touchText(raw) : raw; };
  P.touchText = touchText;

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
  let backEl = null, titleEl = null, titleObs = null;
  // the app bar's title: a fixed name per screen; Save / Load follows the screen's own heading (it switches between the two)
  const TITLES = { planets: 'Planets', fleets: 'Fleets', specs: 'Fleets', tech: 'Research', techtree: 'Tech overview', races: 'Races', report: 'Report',
    status: 'Racial stats', help: 'Almanac', options: 'Options', mapoverview: 'Galaxy map', system: 'Star system', audience: 'Audience', council: 'Galactic Council',
    landing: 'New colony', endings: '', setup: 'New game', saveload: 'Save / load', gnn: 'Galactic News', techscene: 'Research', combat: 'Battle' };
  function setTitle(id) {
    if (!titleEl) return;
    if (titleObs) { titleObs.disconnect(); titleObs = null; }
    titleEl.textContent = TITLES[id] !== undefined ? TITLES[id] : '';
    if (id === 'saveload') {
      const scr = UI.Screens.el && UI.Screens.el('saveload'), t = scr && scr.querySelector('.ctl-title');
      if (t) { const copy = () => { titleEl.textContent = t.textContent; }; copy(); titleObs = new MutationObserver(copy); titleObs.observe(t, { childList: true, characterData: true, subtree: true }); }
    }
  }
  // the status bar (theme-color) matches what sits under it: the app bar, the galaxy HUD, the design header, or the title art
  const BAR = { galaxy: '#10141b', design: '#2f2f2f', menu: '#05080c' };
  let metaTheme = null;
  function setThemeColor(id) {
    if (!metaTheme) metaTheme = doc.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', BAR[id] || '#0c1122');
  }
  function mountBack() {                                                                     // only ever in the DOM on a phone
    if (backEl) return;
    const app = doc.getElementById('app') || doc.body;
    titleEl = h('div.ph-bar-t');
    app.appendChild(h('div.ph-appbar', { 'aria-hidden': 'true' }, titleEl));
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

  // ------------------------------------------------------------------ tooltips: long press, tap-to-read, disabled buttons
  let tipEl = null, tipTimer = 0, lp = null, swallow = false, tipFor = null, downFor = null, touch = false;
  P.showTip = function (html, x, y, el) {
    if (!tipEl) { tipEl = h('div.ph-tip.ch'); (doc.getElementById('app') || doc.body).appendChild(tipEl); }
    tipEl.innerHTML = html; tipEl.classList.add('on'); tipFor = el || null;
    const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let l = x - w / 2, t = y - hh - 20; if (t < 6) t = y + 26;
    tipEl.style.left = Math.max(6, Math.min(innerWidth - w - 6, l)) + 'px';
    tipEl.style.top = Math.max(6, Math.min(innerHeight - hh - 6, t)) + 'px';
    clearTimeout(tipTimer); tipTimer = setTimeout(P.hideTip, 6000);
  };
  P.hideTip = () => { if (tipEl) tipEl.classList.remove('on'); clearTimeout(tipTimer); tipTimer = 0; tipFor = null; };
  const lpCancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
  // a disabled button takes no pointer events (kit.css), so its tip ("why not") is found by its box under the finger
  function disabledAt(x, y) {
    const scope = [...doc.querySelectorAll('.scrim .modal')].pop() || doc.querySelector('.screen.active'); if (!scope) return null;
    for (const b of scope.querySelectorAll('button:disabled[data-tip], .btn.disabled[data-tip]')) { const r = b.getBoundingClientRect(); if (r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b; }
    return null;
  }
  window.addEventListener('pointerdown', e => {
    swallow = false; touch = e.pointerType !== 'mouse';
    if (!active() || !touch) return;
    downFor = tipEl && tipEl.classList.contains('on') ? tipFor : null;                     // a second tap on the same thing closes its tip
    P.hideTip();
    const t = (e.target && e.target.closest ? e.target.closest('[data-tip]') : null) || disabledAt(e.clientX, e.clientY);
    if (!t) return;
    lpCancel();
    const x = e.clientX, y = e.clientY;
    lp = { x, y, timer: setTimeout(() => { lp = null; const html = tipHtml(t); if (!html) return; P.showTip(html, x, y, t); swallow = true; P.haptic('tap'); }, 450) };
  }, true);
  // tap-to-read: a tap that does nothing else shows the tip of what it landed on
  const CONTROL = 'button, a[href], input, select, textarea, label, summary, [role=button], [role=option], [role=tab], [role=radio], [role=switch], [role=slider], [tabindex]:not([tabindex="-1"]), [contenteditable], [data-act], canvas';
  const ACTS = /pointer|grab|move|resize|crosshair/;
  function readTap(e) {
    let t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (t) { for (let n = e.target; n; n = n.parentElement) { if (n.matches(CONTROL) || ACTS.test(getComputedStyle(n).cursor)) return; if (n === t) break; } }
    else t = disabledAt(e.clientX, e.clientY);
    if (!t || t === downFor) return;
    const html = tipHtml(t); if (html) P.showTip(html, e.clientX, e.clientY, t);
  }
  window.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, true);
  window.addEventListener('pointerup', lpCancel, true);
  window.addEventListener('pointercancel', lpCancel, true);
  window.addEventListener('scroll', lpCancel, true);
  window.addEventListener('click', e => {
    if (!e.isTrusted) return;                                                                // e.g. the iOS haptic switch (P.haptic)
    if (swallow) { swallow = false; e.preventDefault(); e.stopImmediatePropagation(); return; }   // the tap that ended the press is not a click
    if (active() && touch && !(M.Settings && M.Settings.get('showTips') === false)) readTap(e);   // Options › Tooltips off: long press only
  }, true);

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
      P.haptic('snap');
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
    if (M.Bus) M.Bus.on('screen', id => { P.hideTip(); setTimeout(updateBack, 0); if (active()) { setTitle(id); setThemeColor(id); } });
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
