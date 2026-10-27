// New-game wizard ("setup" screen): Galaxy -> Race -> Banner & names, with a persistent summary rail.
// Core choices are galaxy size, difficulty and rivals; galaxy age and the rule toggles live in a collapsed "Remake options" group whose
// defaults reproduce the original game. Also hosts UI.Controls, the small widget library shared by options.js / saveload.js / gamemenu.js
// (icons, switch, segmented control, radio-group keyboard nav, space backdrop, race badges, key scopes, hotkeys, portrait/ship painters).
//
//   UI.Screens.go('setup', {step: 0|1|2})   deep-link a step.  Cancel -> 'menu'; Esc / right-click = back one step (menu from step 1);
//                                           Space / Enter = continue; first-letter hotkeys C / B / N.  Last choices persist in Settings 'lastSetup'.
//   UI.Setup.collect()                      the settings object Begin hands to MOO.Game.newGame(settings):
//                                           {size, age, difficulty, opponents, race, banner, leader, homeworld, seed, options:{tactical, randomEvents, council, fogOfWar, monsters}}
//                                           (banner 0-5 = blue green purple red white yellow; options.tactical is the default battle mode from Options)
//   UI.Setup.go(step)                       jump to a step (dev / tests)
// Everything outside js/core is resolved lazily and guarded (MOO.Game, Gfx.*, Data.*): any of them may be absent.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, doc = document;
  const TAU = Math.PI * 2;

  // =========================================================================================================
  //  A. UI.Controls — shared widgets
  // =========================================================================================================
  const ICONS = {
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    dice: '<path d="M4 4h16v16H4z"/><g fill="currentColor" stroke="none"><circle cx="8.6" cy="8.6" r="1.45"/><circle cx="15.4" cy="8.6" r="1.45"/><circle cx="12" cy="12" r="1.45"/><circle cx="8.6" cy="15.4" r="1.45"/><circle cx="15.4" cy="15.4" r="1.45"/></g>',
    save: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 4v5h7V4"/><path d="M8 20v-6h8v6"/>',
    load: '<path d="M3 6h6.5l2 2.5H21V19H3z"/>',
    export: '<path d="M12 15V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 14v6h16v-6"/>',
    import: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 14v6h16v-6"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    sliders: '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><path d="M15 5v6M9 13v6"/>',
    play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
    quit: '<path d="M10 4H4v16h6"/><path d="M14 8l5 4-5 4"/><path d="M19 12H9"/>',
    book: '<path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3z"/><path d="M21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    chevL: '<path d="M15 5l-7 7 7 7"/>',
    chevR: '<path d="M9 5l7 7-7 7"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17v.8"/>',
    undo: '<path d="M5.5 12a6.5 6.5 0 1 0 2-4.7"/><path d="M4.5 4.5v4h4"/>',
    speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
    monitor: '<path d="M3 5h18v11H3z"/><path d="M8 20h8M12 16v4"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h12l-2.5 4 2.5 4H6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    news: '<path d="M4 5h13v14H4z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h7M7 12h7M7 15h4"/>',
    spy: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  function icon(name, cls) {
    const t = doc.createElement('template');
    t.innerHTML = '<svg class="ico ln" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + (ICONS[name] || ICONS.dot) + '</svg>';
    const el = t.content.firstChild;
    if (cls) String(cls).split(/\s+/).forEach(c => c && el.classList.add(c));
    return el;
  }
  // a kit button with one of our icons in front of the label
  function iconButton(label, name, onclick, o) {
    const b = UI.button(label, onclick, o);
    b.insertBefore(icon(name), b.firstChild);
    return b;
  }

  const remPx = () => parseFloat(getComputedStyle(doc.documentElement).fontSize) || 14;
  const dprNow = (max) => Math.min(window.devicePixelRatio || 1, max || 2);

  // ---- on/off switch --------------------------------------------------------------------------------------
  function toggle(value, onChange, o) {
    o = o || {};
    let on = !!value;
    const txt = h('span.ctl-sw-txt');
    const b = h('button.ctl-sw', { type: 'button', role: 'switch', 'aria-label': o.label || null }, h('span.ctl-sw-track', h('i')), txt);
    function paint() { b.setAttribute('aria-checked', on ? 'true' : 'false'); txt.textContent = on ? (o.onText || 'On') : (o.offText || 'Off'); }
    b.addEventListener('click', () => { on = !on; paint(); UI.sfx('click'); if (UI.Phone) UI.Phone.haptic('tap'); if (onChange) onChange(on); });
    b.set = v => { on = !!v; paint(); };
    b.get = () => on;
    paint();
    return b;
  }

  // ---- radio-group keyboard navigation (arrow keys move + select; cols>0 gives 2-D grid movement) ----------
  function radioNav(group, cols) {
    group.addEventListener('keydown', e => {
      const k = e.key;
      if (!/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(k)) return;
      const items = Array.from(group.querySelectorAll('[role=radio]')).filter(x => !x.disabled);
      const i = items.indexOf(e.target && e.target.closest ? e.target.closest('[role=radio]') : null);
      if (i < 0) return;
      let j = i;
      if (k === 'ArrowLeft') j = i - 1;
      else if (k === 'ArrowRight') j = i + 1;
      else if (k === 'ArrowUp') j = cols ? i - cols : i - 1;
      else if (k === 'ArrowDown') j = cols ? i + cols : i + 1;
      else if (k === 'Home') j = 0;
      else j = items.length - 1;
      e.preventDefault(); e.stopPropagation();
      if (!cols) j = (j + items.length) % items.length;
      if (j < 0 || j >= items.length || j === i) return;
      items[j].focus(); items[j].click();
    });
  }
  // roving tabindex + aria-checked for a set of radio buttons
  function markRadios(btns, isOn) {
    let any = false;
    btns.forEach((b, i) => { const on = !!isOn(b, i); any = any || on; b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    if (!any && btns[0]) btns[0].tabIndex = 0;
  }

  // ---- segmented control ----------------------------------------------------------------------------------
  function segmented(items, value, onChange, o) {
    o = o || {};
    let cur = value;
    const root = h('div.ctl-seg' + (o.block ? '.block' : ''), { role: 'radiogroup', 'aria-label': o.label || null });
    const btns = items.map(it => {
      const b = h('button', { type: 'button', role: 'radio', disabled: !!it.disabled, tip: it.tip || null }, it.label);
      b.addEventListener('click', () => {
        if (String(cur) === String(it.id)) return;
        set(it.id); UI.sfx('click'); if (UI.Phone) UI.Phone.haptic('tap'); if (onChange) onChange(it.id, true);
      });
      root.appendChild(b);
      return b;
    });
    function set(v) { cur = v; markRadios(btns, (b, i) => String(items[i].id) === String(cur)); }
    radioNav(root);
    root.set = set; root.get = () => cur;
    set(value);
    return root;
  }

  // Saves store the game's year index (1, 2, ...); show the calendar year when Data.Config can convert it. Values that already look like a year pass through.
  function calendarYear(y) {
    const C = M.Data && M.Data.Config;
    return (typeof y === 'number' && y > 0 && y < 1000 && C && typeof C.displayYear === 'function') ? C.displayYear({ year: y }) : y;
  }

  // ---- relative time ("5 min ago") ------------------------------------------------------------------------
  function ago(at) {
    if (!at) return '';
    const s = Math.max(0, (Date.now() - at) / 1000);
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    const hr = Math.round(s / 3600);
    if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
    const d = Math.round(s / 86400);
    if (d === 1) return 'yesterday';
    if (d < 14) return d + ' days ago';
    try { return new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return d + ' days ago'; }
  }

  // ---- key scope: keydown handler that is only live while `el` is the top-most modal / the active screen ----
  function inScope(el) {
    if (!el.isConnected) return false;
    const scrim = el.closest('.scrim');
    if (scrim) return scrim.parentNode.lastElementChild === scrim;
    const scr = el.closest('.screen');
    return !!scr && scr.classList.contains('active') && !UI.modalOpen();
  }
  // map: { 'ArrowDown': fn(e) -> truthy when handled, ... }. Keys typed into inputs are left alone.
  function keyScope(el, map) {
    function onKey(e) {
      if (!el.isConnected) { window.removeEventListener('keydown', onKey); return; }
      const fn = map[e.key];
      if (!fn || e.ctrlKey || e.metaKey || e.altKey || !inScope(el)) return;
      const t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Enter' || e.key === ' ') && t && t.closest && t.closest('button, a, [role=switch], [role=radio]')) return;
      if (fn(e)) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }
  // keeps Tab / Shift+Tab inside a modal (the kit has no focus trap, so focus could otherwise wander onto the screen underneath)
  function trapFocus(el) {
    function onKey(e) {
      if (e.key !== 'Tab') return;
      if (!el.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
      if (!inScope(el)) return;
      const f = Array.from(el.querySelectorAll('button, input, select, textarea, [tabindex]')).filter(x => x.tabIndex >= 0 && !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = doc.activeElement;
      if (!el.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }
  // first-letter hotkeys: underline the letter inside a kit button's label ...
  function hotkey(btn, letter) {
    const node = Array.from(btn.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
    const txt = node ? node.textContent : '', i = txt.toLowerCase().indexOf(String(letter).toLowerCase());
    if (i < 0) return btn;
    const lbl = h('span.lbl');                                   // one flex item, so the button's gap does not split the word
    lbl.append(txt.slice(0, i), h('u.hk', txt.charAt(i)), txt.slice(i + 1));
    node.replaceWith(lbl);
    return btn;
  }
  // ... and activate a visible, enabled button when its letter is typed (letters are ignored while typing in a field)
  function hotkeys(scopeEl, pairs) {
    const map = {};
    Object.keys(pairs).forEach(k => {
      const fire = () => { const b = pairs[k]; if (!b || b.disabled || b.offsetParent === null) return false; b.click(); return true; };
      map[k.toLowerCase()] = fire; map[k.toUpperCase()] = fire;
    });
    return keyScope(scopeEl, map);
  }
  // Cancel / <danger> confirmation. Resolves true/false. `focusOk` puts keyboard focus on the action instead of Cancel (Enter / Space then confirms).
  function confirmDanger(title, body, label, focusOk) {
    const pm = UI.modal({ title, body: typeof body === 'string' ? h('p', body) : body, buttons: [{ label: 'Cancel', value: false }, { label, value: true, danger: true }], autofocus: false });
    pm.then(trapFocus(pm.el));
    setTimeout(() => { const b = pm.el && pm.el.querySelectorAll('.modal-f .btn')[focusOk ? 1 : 0]; if (b) b.focus(); }, 40);
    return pm.then(v => !!v);
  }
  // right-click = cancel / back (the original's convention); text fields keep their native menu so copy / paste still works
  function rightClick(el, fn) {
    el.addEventListener('contextmenu', e => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (inScope(el)) fn(e);
    });
  }

  // ---- race / colour data helpers -----------------------------------------------------------------------
  const FALLBACK_RACES = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  function raceIds() {
    const D = M.Data || {};
    if (Array.isArray(D.raceList) && D.raceList.length) return D.raceList;
    if (D.Races && Array.isArray(D.Races.ORDER) && D.Races.ORDER.length) return D.Races.ORDER;       // the sim-side table
    return FALLBACK_RACES;
  }
  // Normalised race record. Reads MOO.Data.races[id] (UI contract), falls back to the sim table Data.Races.races[id] and Data.names,
  // and fills every missing field so callers never have to guard.
  const infoCache = new Map();
  const normTrait = t => (typeof t === 'string' ? { label: t, text: '', good: true } : { label: t.label || t.name || '', text: t.text || t.desc || '', good: !(t.good === false || t.bad === true) });
  function raceInfo(id) {
    const D = M.Data || {}, nm = D.names || {};
    const src = (D.races && D.races[id]) || (D.Races && D.Races.races && D.Races.races[id]) || null;
    const hit = infoCache.get(id);
    if (hit && hit.src === src) return hit.info;
    const b = src || {}, label = U.cap(String(id || '?'));
    const info = {
      id: b.id || id, name: b.name || label, plural: b.plural || (b.name || label) + 's', tagline: b.tagline || '', desc: b.desc || '',
      traits: Array.isArray(b.traits) ? b.traits.map(normTrait) : [],
      homeworld: b.homeworld || (nm.homeworlds && nm.homeworlds[id]) || '',
      leaderNames: b.leaderNames || b.leaders || (nm.leaders && nm.leaders[id]) || [],
      art: b.art || {},
    };
    infoCache.set(id, { src, info });
    return info;
  }
  const raceName = id => raceInfo(id).name || U.cap(String(id));
  const BANNER_FALLBACK = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];     // blue green purple red white yellow
  const bannerCache = [];
  function bannerHex(i) {
    i = U.clamp(Math.round(Number(i) || 0), 0, 5);
    if (bannerCache[i]) return bannerCache[i];
    let v = '';
    try { v = getComputedStyle(doc.documentElement).getPropertyValue('--emp' + i).trim(); } catch (e) { /* use fallback */ }
    return /^#[0-9a-f]{6}$/i.test(v) ? (bannerCache[i] = v) : BANNER_FALLBACK[i];      // only cache real stylesheet values
  }
  const safeHex = (c, d) => (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : d);
  function hslHex(hh, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l), f = n => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return U.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }

  // ---- portrait painter: Gfx.Portraits when available, otherwise a brass-ringed medallion with the race initial ---
  let portraitBroken = false;
  function havePortrait(id) {
    const P = M.Gfx && M.Gfx.Portraits;
    if (!P || portraitBroken || typeof P.draw !== 'function' || (P.RACES && P.RACES.indexOf(id) < 0)) return false;
    return true;
  }
  // o: {t, mood, talking, color, bg, still}.  `still` paints a cached static frame (thumbnails); otherwise animated.
  function drawPortrait(ctx, id, w, hh, o) {
    o = o || {};
    if (havePortrait(id)) {
      const P = M.Gfx.Portraits;
      try {
        if (o.still && typeof P.canvas === 'function') {
          const k = (ctx.getTransform ? ctx.getTransform().a : 1) || 1;
          const c = P.canvas(id, Math.max(8, Math.round(w * k)), Math.max(8, Math.round(hh * k)), { t: 0, mood: o.mood || 'neutral', color: o.color, bg: o.bg !== false });
          ctx.drawImage(c, 0, 0, w, hh);
        } else {
          P.draw(ctx, id, 0, 0, w, hh, { t: o.t === undefined ? performance.now() / 1000 : o.t, mood: o.mood || 'neutral', talking: !!o.talking, color: o.color, bg: o.bg !== false });
        }
        return true;
      } catch (e) { portraitBroken = true; console.warn('[ui] Gfx.Portraits failed, using placeholders:', e); }
    }
    placeholderPortrait(ctx, id, w, hh, o);
    return false;
  }
  function placeholderPortrait(ctx, id, w, hh, o) {
    const info = raceInfo(id), art = info.art || {}, t = o.t || 0;
    const c1 = safeHex(art.primary, hslHex(U.hash(id) % 360, 45, 42)), c2 = safeHex(art.secondary, hslHex((U.hash(id) >> 3) % 360, 40, 30));
    const g = ctx.createLinearGradient(0, 0, w, hh);
    g.addColorStop(0, U.darken(c1, .55)); g.addColorStop(1, U.darken(c2, .78));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
    const cx = w / 2, cy = hh * .47, r = Math.min(w, hh) * .27;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, hh) * .6);
    rg.addColorStop(0, U.rgba(U.lighten(c1, .2), .4)); rg.addColorStop(1, 'rgba(4,6,20,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, hh);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * .25);
    ctx.setLineDash([r * .09, r * .13]); ctx.lineWidth = Math.max(1, r * .035); ctx.strokeStyle = 'rgba(214,179,106,.55)';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.28, 0, TAU); ctx.stroke(); ctx.restore();
    ctx.lineWidth = Math.max(1.4, r * .08); ctx.strokeStyle = '#d6b36a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = U.rgba(U.darken(c1, .5), .55); ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f3dca0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + Math.round(r * 1.15) + 'px "Marcellus SC", "Marcellus", Georgia, serif';
    ctx.fillText(String(info.name || id).charAt(0).toUpperCase(), cx, cy + r * .06);
    if (w > 90) {
      ctx.font = '400 ' + Math.max(10, Math.round(r * .3)) + 'px "Marcellus SC", Georgia, serif';
      ctx.fillStyle = 'rgba(236,230,211,.85)'; ctx.fillText(String(info.name || id), cx, hh * .86);
    }
    if (o.color) { ctx.fillStyle = o.color; ctx.fillRect(0, hh - Math.max(3, hh * .03), w, Math.max(3, hh * .03)); }
  }
  // round brass-ringed badge (Gfx.Portraits.drawBadge, or a placeholder medallion); static pose.
  function drawBadge(ctx, id, cx, cy, r, colorHex) {
    const P = M.Gfx && M.Gfx.Portraits;
    if (P && typeof P.drawBadge === 'function' && havePortrait(id)) {
      try { P.drawBadge(ctx, id, cx, cy, r, { t: 0, color: colorHex, bg: true, key: 'ui-badge|' + id + '|' + colorHex }); return; } catch (e) { portraitBroken = true; console.warn('[ui] Gfx.Portraits.drawBadge failed:', e); }
    }
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip(); ctx.translate(cx - r, cy - r);
    placeholderPortrait(ctx, id, r * 2, r * 2, { color: null }); ctx.restore();
    ctx.lineWidth = Math.max(1.5, r * .1); ctx.strokeStyle = '#d6b36a'; ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, TAU); ctx.stroke();
    if (colorHex) { ctx.fillStyle = colorHex; ctx.beginPath(); ctx.arc(cx + r * .7, cy + r * .7, Math.max(2.2, r * .17), 0, TAU); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); }
  }
  // a canvas badge sized in rem, painted immediately (no layout needed)
  function raceBadge(id, sizeRem, colorIdx) {
    const px = Math.round(sizeRem * remPx()), dpr = dprNow(2), hex = bannerHex(colorIdx);
    const cv = h('canvas', { width: Math.round(px * dpr), height: Math.round(px * dpr) });
    const wrap = h('div.ctl-badge', { style: { width: sizeRem + 'rem', height: sizeRem + 'rem' } }, cv);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBadge(ctx, id, px / 2, px / 2, px / 2 - 1, hex);
    const PP = M.Gfx && M.Gfx.Portraits;
    if (PP && PP.photo && !PP.photo.ready(id)) PP.photo.whenReady(id, () => { try { ctx.clearRect(0, 0, px, px); drawBadge(ctx, id, px / 2, px / 2, px / 2 - 1, hex); } catch (e) { /* ignore */ } });
    return wrap;
  }

  // ---- ship painter: Gfx.Ships (sprite or draw) or a simple vector chevron ----------------------------------
  let shipBroken = false;
  const isDrawable = o => !!o && (o instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && o instanceof ImageBitmap) || o instanceof HTMLImageElement || (typeof OffscreenCanvas !== 'undefined' && o instanceof OffscreenCanvas));
  // draws a ship centred on (x,y); `len` = desired on-screen length in px; angle 0 = pointing right
  function drawShip(ctx, race, hull, x, y, len, color, o) {
    o = o || {};
    const S = M.Gfx && M.Gfx.Ships;
    if (S && !shipBroken && (!S.RACES || S.RACES.indexOf(race) >= 0)) {
      try {
        if (!o.animated && typeof S.sprite === 'function') {
          const sp = S.sprite(race, hull, Math.max(8, Math.round(len)), color, o.flags);
          if (isDrawable(sp)) { const k = len / Math.max(sp.width, sp.height); ctx.drawImage(sp, x - sp.width * k / 2, y - sp.height * k / 2, sp.width * k, sp.height * k); return; }
        }
        if (typeof S.draw === 'function') {
          S.draw(ctx, { race, hull, x, y, size: Math.max(8, len), angle: o.angle || 0, color, t: o.t || 0, thrust: o.thrust === undefined ? .55 : o.thrust, flags: o.flags });
          return;
        }
      } catch (e) { shipBroken = true; console.warn('[ui] Gfx.Ships failed, using placeholders:', e); }
    }
    placeholderShip(ctx, hull, x, y, len, color, o.angle || 0);
  }
  function placeholderShip(ctx, hull, x, y, len, color, angle) {
    const L = len / 2, k = .5 + hull * .09, c = safeHex(color, '#62d8ff');
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(L * .15, -L * .5 * k); ctx.lineTo(-L * .9, -L * .62 * k); ctx.lineTo(-L * .62, 0); ctx.lineTo(-L * .9, L * .62 * k); ctx.lineTo(L * .15, L * .5 * k); ctx.closePath();
    const g = ctx.createLinearGradient(0, -L * .6 * k, 0, L * .6 * k);
    g.addColorStop(0, U.lighten(c, .4)); g.addColorStop(.5, c); g.addColorStop(1, U.darken(c, .5));
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, L * .04); ctx.strokeStyle = U.rgba(U.lighten(c, .6), .7); ctx.stroke();
    ctx.fillStyle = 'rgba(180,235,255,.85)'; ctx.beginPath(); ctx.moveTo(L * .5, 0); ctx.lineTo(L * .05, -L * .13 * k); ctx.lineTo(L * .05, L * .13 * k); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,.9)'; ctx.fillRect(-L * 1.02, -L * .16 * k, L * .14, L * .32 * k);
    ctx.restore();
  }

  // ---- space backdrop (Gfx.Space.makeBackdrop or a generated nebula + starfield), shared by our full screens -----
  let bgSrc = null, bgSrcKey = '';
  function paintFallback(ctx, w, hh, seed, dpr) {
    const rnd = M.RNG.create('bg:' + seed);
    const g = ctx.createLinearGradient(0, 0, 0, hh);
    g.addColorStop(0, '#0d1540'); g.addColorStop(.55, '#070b25'); g.addColorStop(1, '#04061a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
    const blobs = [[.12, .1, .6, [78, 62, 200, .26]], [.92, .86, .65, [30, 104, 200, .2]], [.72, .1, .42, [170, 62, 188, .13]], [.22, .92, .46, [40, 152, 172, .1]]];
    for (const b of blobs) {
      const x = b[0] * w, y = b[1] * hh, r = b[2] * Math.max(w, hh), c = b[3];
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3] + ')'); rg.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, w, hh);
    }
    const n = Math.round(w * hh / (2300 * dpr * dpr));
    for (let i = 0; i < n; i++) {
      const x = rnd.next() * w, y = rnd.next() * hh, r = (Math.pow(rnd.next(), 3) * 1.5 + .45) * dpr, pick = rnd.next();
      ctx.globalAlpha = .22 + rnd.next() * .7;
      ctx.fillStyle = pick < .14 ? '#9fc4ff' : pick < .24 ? '#ffd9a0' : '#e8ecff';
      ctx.beginPath(); ctx.arc(x, y, r * .6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function backdrop(seed) {
    const cv = h('canvas.ctl-bgcanvas', { 'aria-hidden': 'true' });
    let key = '', timer = 0;
    cv.paint = function (settled) {
      const w = Math.max(2, window.innerWidth), hh = Math.max(2, window.innerHeight), dpr = dprNow(1.5);
      const k = seed + '|' + w + 'x' + hh + '@' + dpr;
      if (k === key) return;
      key = k;
      const pw = Math.round(w * dpr), ph = Math.round(hh * dpr);
      if (bgSrc && bgSrcKey !== k && settled !== true) {         // the window changed size: stretch the old backdrop now, rebuild when it settles
        cv.width = pw; cv.height = ph;
        cv.getContext('2d').drawImage(bgSrc, 0, 0, pw, ph);
        clearTimeout(timer); timer = setTimeout(() => { key = ''; cv.paint(true); }, 220);
        return;
      }
      if (!bgSrc || bgSrcKey !== k) {
        bgSrc = bgSrc || doc.createElement('canvas');
        bgSrc.width = pw; bgSrc.height = ph; bgSrcKey = k;
        const c = bgSrc.getContext('2d');
        let done = false;
        const S = M.Gfx && M.Gfx.pick('space');
        if (S && typeof S.makeBackdrop === 'function') {
          try {
            const src = S.makeBackdrop(Math.min(w, 1280), Math.min(hh, 720), seed, S.sky ? S.sky({ intensity: .8, stars: 1.1, floor: 0.08 }) : { intensity: .85, stars: 1.1, palette: ['#2b2a86', '#14357a', '#5b2a86', '#0d4f7a'] });   // the one sky
            if (isDrawable(src)) { c.drawImage(src, 0, 0, pw, ph); done = true; }
          } catch (e) { console.warn('[ui] Gfx.Space.makeBackdrop failed, using fallback:', e); }
        }
        if (!done) paintFallback(c, pw, ph, seed, dpr);
      }
      cv.width = pw; cv.height = ph;
      cv.getContext('2d').drawImage(bgSrc, 0, 0);
    };
    // repaint on window resize ourselves (a visible canvas only; hidden screens repaint when they are entered)
    window.addEventListener('resize', () => { if (cv.isConnected && cv.offsetParent !== null) cv.paint(); });
    return cv;
  }

  UI.Controls = { icon, iconButton, toggle, segmented, radioNav, markRadios, ago, calendarYear, keyScope, trapFocus, hotkey, hotkeys, rightClick, confirmDanger, backdrop, remPx, raceIds, raceInfo, raceName, bannerHex, drawPortrait, drawBadge, raceBadge, drawShip, safeHex };

  UI.css('ctl', `
    .ico.ln { fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:square; stroke-linejoin:miter; }
    .cx { --poly: polygon(var(--ch) 0, calc(100% - var(--ch)) 0, 100% var(--ch), 100% calc(100% - var(--ch)), calc(100% - var(--ch)) 100%, var(--ch) 100%, 0 calc(100% - var(--ch)), 0 var(--ch)); clip-path: var(--poly); }
    /* keyboard focus must stay visible inside clip-path'd buttons */
    .btn:focus-visible { outline:none; }
    .btn:focus-visible::before { box-shadow: inset 0 0 0 2px var(--cyan); }
    .ctl-bgcanvas { position:absolute; inset:0; width:100%; height:100%; }
    .ctl-shade { position:absolute; inset:0; pointer-events:none; background: radial-gradient(ellipse at 50% 42%, transparent 36%, rgba(2,3,12,.74) 100%); }
    .ctl-eyebrow { margin:0 0 .2rem .12rem; font:400 .9rem var(--font-display); letter-spacing:.36em; color:var(--brass); }
    .ctl-title { margin:0; font:400 clamp(1.9rem, 4.8vh, 3.1rem)/1 var(--font-title); letter-spacing:.04em; color:transparent;
      background:linear-gradient(180deg,#fff6d8 0%,#e9cf90 40%,#c39a50 78%,#8c6f3a 100%); -webkit-background-clip:text; background-clip:text;
      filter: drop-shadow(0 3px 0 rgba(0,0,0,.45)) drop-shadow(0 0 22px rgba(214,179,106,.2)); }
    u.hk { text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:.17em; }

    /* switch */
    .ctl-sw { display:inline-flex; align-items:center; gap:.55rem; padding:0; border:0; background:none; cursor:var(--hand); color:var(--fog); font:600 .7rem var(--font-ui); letter-spacing:.1em; text-transform:uppercase; }
    .ctl-sw-track { position:relative; flex:none; width:2.6rem; height:1.25rem; background:#0a1030; box-shadow: inset 0 0 0 1px var(--brass-line-3); transition: background .18s, box-shadow .18s; }
    .ctl-sw-track i { position:absolute; top:3px; bottom:3px; left:3px; width:calc(1.25rem - 6px); background:var(--mist); transition: left .2s var(--ease), background .18s, box-shadow .18s; }
    .ctl-sw-txt { min-width:1.9rem; text-align:left; }
    .ctl-sw:hover .ctl-sw-track { box-shadow: inset 0 0 0 1px var(--brass); }
    .ctl-sw:focus-visible { outline:none; } .ctl-sw:focus-visible .ctl-sw-track { box-shadow: inset 0 0 0 2px var(--cyan); }
    .ctl-sw[aria-checked=true] { color:var(--brass-hi); }
    .ctl-sw[aria-checked=true] .ctl-sw-track { background: linear-gradient(90deg, rgba(214,179,106,.38), rgba(214,179,106,.16)); box-shadow: inset 0 0 0 1px var(--brass); }
    .ctl-sw[aria-checked=true] .ctl-sw-track i { left: calc(100% - 1.25rem + 3px); background:var(--brass-hi); box-shadow:0 0 8px rgba(243,220,160,.65); }
    .ctl-sw:disabled { opacity:.4; cursor:not-allowed; }

    /* segmented */
    .ctl-seg { display:inline-flex; gap:2px; padding:2px; background:#0a1030; box-shadow: inset 0 0 0 1px var(--brass-line-3); }
    .ctl-seg.block { display:flex; width:100%; }
    .ctl-seg button { flex:1 1 0; min-width:0; padding:.34rem .7rem; border:0; background:transparent; color:var(--mist); font:400 1rem/1.15 var(--font-display); letter-spacing:.03em; cursor:var(--hand); white-space:nowrap; transition: background .15s, color .15s; }
    .ctl-seg button:hover { color:var(--ivory); background:rgba(255,255,255,.06); }
    .ctl-seg button[aria-checked=true] { color:#261b06; background:linear-gradient(180deg,#f0d596,#bf9748); }
    .ctl-seg button:focus-visible { outline:none; box-shadow: inset 0 0 0 2px var(--cyan); }
    .ctl-seg button:disabled { opacity:.4; cursor:not-allowed; }

    /* race badge */
    .ctl-badge { --ch:.3rem; flex:none; display:block; }
    .ctl-badge canvas { width:100%; height:100%; }

    @media (prefers-reduced-motion: reduce) { .ctl-sw-track i { transition:none; } }
  `);

  // =========================================================================================================
  //  B. New-game wizard
  // =========================================================================================================
  const SIZES = [
    { id: 'small', label: 'Small', stars: 24 },
    { id: 'medium', label: 'Medium', stars: 48 },
    { id: 'large', label: 'Large', stars: 70 },
    { id: 'huge', label: 'Huge', stars: 108 },
    { id: 'colossal', label: 'Colossal', stars: 160 },
  ];
  // Remake-only extras (the 1993 original has no age setting): defaults match the original's rules.
  const AGES = [
    { id: 'young', label: 'Young', text: 'Young galaxies are mineral-poor in places: resources are scarce and expansion pays back slowly.' },
    { id: 'average', label: 'Average', text: 'A balanced mix of poor, ordinary and rich worlds, as in the original.' },
    { id: 'old', label: 'Old', text: 'Old galaxies are richer in minerals and in fertile worlds waiting to be claimed.' },
  ];
  const DIFFS = [
    { id: 'simple', label: 'Simple', text: 'Gentle rivals and a generous start. A good way to learn the ropes.' },
    { id: 'easy', label: 'Easy', text: 'Forgiving rivals and a comfortable head start.' },
    { id: 'average', label: 'Average', text: 'Fair rivals and a standard start.' },
    { id: 'hard', label: 'Hard', text: 'Shrewd rivals, and your homeworld begins with fewer people.' },
    { id: 'impossible', label: 'Impossible', text: 'Ruthless rivals and a thin starting population. Expect no mercy.' },
  ];
  const OPT_DEFAULTS = { randomEvents: true, council: true, fogOfWar: true, monsters: true, expandedTech: false };
  const OPTS = [
    { id: 'randomEvents', label: 'Random events', short: 'Events', text: 'Plagues, raids, supernovae and other upsets.' },
    { id: 'council', label: 'Galactic council', short: 'Council', text: 'Rivals vote for a galactic leader.' },
    { id: 'fogOfWar', label: 'Fog of war', short: 'Fog', text: 'See only what you currently observe.' },
    { id: 'monsters', label: 'Space monsters', short: 'Monsters', text: 'Guardians and wandering beasts roam the lanes.' },
    { id: 'expandedTech', label: 'Expanded technology', short: 'New tech', text: 'New technologies join the pool every research tree is dealt from (experimental).' },
  ];
  const BANNER_NAMES = ['Blue', 'Green', 'Purple', 'Red', 'White', 'Yellow'];      // = --emp0..--emp5 (css/base.css)
  const STEPS = [
    { id: 'galaxy', label: 'Galaxy', hint: 'Shape the galaxy you will fight over.' },
    { id: 'race', label: 'Race', hint: 'Choose the people you will lead.' },
    { id: 'banner', label: 'Banner & names', hint: 'Raise your banner and name your throne-world.' },
  ];
  const PHASES = ['Scattering stars across the void', 'Surveying distant worlds', 'Placing homeworlds', 'Raising rival empires', 'Convening the Galactic Council'];
  const SEED_WORDS = ['Aldebaran', 'Altair', 'Antares', 'Arcturus', 'Betelgeuse', 'Canopus', 'Capella', 'Castor', 'Deneb', 'Fomalhaut', 'Mizar', 'Polaris', 'Pollux', 'Procyon', 'Regulus', 'Rigel', 'Sirius', 'Spica', 'Vega', 'Algol'];
  const randomSeed = () => SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)] + '-' + String(1000 + Math.floor(Math.random() * 9000));
  const clean = (s, max) => String(s === undefined || s === null ? '' : s).replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 24);
  const sizeOf = id => SIZES.find(s => s.id === id) || SIZES[1];
  const pickOf = (list, id) => list.find(x => x.id === id) || list[0];

  // ---- state ----------------------------------------------------------------------------------------------
  const st = {};
  const defaultLeader = id => { const l = raceInfo(id).leaderNames; return (l && l[0]) || 'Supreme Leader'; };
  const defaultHome = id => raceInfo(id).homeworld || (raceName(id) + ' Prime');
  function freshState() {
    const ids = raceIds();
    return {
      step: 0, size: 'medium', age: 'average', difficulty: 'average', opponents: 3, seed: '',
      options: Object.assign({}, OPT_DEFAULTS),
      race: ids.indexOf('human') >= 0 ? 'human' : ids[0], banner: 0, leader: '', homeworld: '', leaderCustom: false, homeCustom: false,
    };
  }
  function fillDefaults() {
    if (!st.leaderCustom || !st.leader) { st.leader = defaultLeader(st.race); st.leaderCustom = false; }
    if (!st.homeCustom || !st.homeworld) { st.homeworld = defaultHome(st.race); st.homeCustom = false; }
  }
  function restoreLast() {
    const base = freshState(), last = M.Settings.get('lastSetup');
    if (last && typeof last === 'object') {
      if (SIZES.some(s => s.id === last.size)) base.size = last.size;
      if (AGES.some(a => a.id === last.age)) base.age = last.age;
      if (DIFFS.some(d => d.id === last.difficulty)) base.difficulty = last.difficulty;
      if (Number.isFinite(last.opponents)) base.opponents = U.clamp(Math.round(last.opponents), 1, 5);
      if (last.options && typeof last.options === 'object') OPTS.forEach(o => { if (typeof last.options[o.id] === 'boolean') base.options[o.id] = last.options[o.id]; });
      if (raceIds().indexOf(last.race) >= 0) base.race = last.race;
      if (Number.isInteger(last.banner) && last.banner >= 0 && last.banner < 6) base.banner = last.banner;
      if (typeof last.leader === 'string' && clean(last.leader)) { base.leader = clean(last.leader); base.leaderCustom = !!last.leaderCustom; }
      if (typeof last.homeworld === 'string' && clean(last.homeworld)) { base.homeworld = clean(last.homeworld); base.homeCustom = !!last.homeCustom; }
    }
    Object.assign(st, base);
    fillDefaults();
  }
  function saveNow() {
    M.Settings.set('lastSetup', {
      size: st.size, age: st.age, difficulty: st.difficulty, opponents: st.opponents, options: Object.assign({}, st.options),     // the seed is deliberately not remembered
      race: st.race, banner: st.banner, leader: st.leader, homeworld: st.homeworld, leaderCustom: st.leaderCustom, homeCustom: st.homeCustom,
    });
  }
  const saveSoon = U.debounce(saveNow, 250);
  function collect() {
    if (!st.race) Object.assign(st, freshState());
    return {
      size: st.size, age: st.age, difficulty: st.difficulty, opponents: st.opponents,
      race: st.race, banner: st.banner,
      leader: clean(st.leader) || defaultLeader(st.race), homeworld: clean(st.homeworld) || defaultHome(st.race),
      seed: clean(st.seed) || randomSeed(),
      // `tactical` is only the default battle mode preference (Options screen): true = fight battles yourself, false = auto-resolve
      options: { tactical: M.Settings.get('tactical') !== false, randomEvents: !!st.options.randomEvents, council: !!st.options.council, fogOfWar: !!st.options.fogOfWar, monsters: !!st.options.monsters,
        techPool: st.options.expandedTech ? 'expanded' : 'classic' },
    };
  }

  // ---- galaxy chart (animated scatter preview) ------------------------------------------------------------
  function glowSprite(r, g, b) {
    const c = doc.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.12, `rgba(${r},${g},${b},1)`); gr.addColorStop(.4, `rgba(${r},${g},${b},.32)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    return c;
  }
  function makeChart(cv) {
    const N = 160, rnd = M.RNG.create('su-galaxy-chart-v1');
    const CLS = [[255, 244, 226, 34], [255, 214, 124, 26], [255, 158, 88, 14], [255, 108, 100, 9], [132, 184, 255, 11], [196, 146, 255, 6]];
    const total = CLS.reduce((a, c) => a + c[3], 0), sprites = CLS.map(c => glowSprite(c[0], c[1], c[2]));
    const pickClass = () => { let r = rnd.next() * total; for (let i = 0; i < CLS.length; i++) { r -= CLS[i][3]; if (r < 0) return i; } return 0; };
    const stars = [];
    for (let i = 0; i < N; i++) {                       // sunflower spiral: the first n stars always fill a disc of radius sqrt(n/N) evenly
      const rad = U.clamp(Math.sqrt((i + .5) / N) + (rnd.next() - .5) * .07, 0, 1);
      const arm = rnd.next() < .6;
      const ang = arm ? (i % 2) * Math.PI + rad * 2.7 + (rnd.next() + rnd.next() + rnd.next() - 1.5) * .55 : rnd.next() * TAU;
      stars.push({ x: Math.cos(ang) * rad, y: Math.sin(ang) * rad, k: pickClass(), ph: rnd.next() * TAU, sp: .5 + rnd.next() * 1.3, sz: .75 + rnd.next() * .85 });
    }
    const links = [];                                   // faint lanes: every star to its two nearest neighbours (when close enough)
    for (let i = 0; i < N; i++) {
      const near = [];
      for (let j = 0; j < N; j++) if (j !== i) { const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y; near.push([dx * dx + dy * dy, j]); }
      near.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 2; k++) {
        const j = near[k][1];
        if (near[k][0] < .032 && !links.some(l => (l[0] === i && l[1] === j) || (l[0] === j && l[1] === i))) links.push([i, j]);
      }
    }
    const homeCache = {};
    function homesFor(n, count) {                       // farthest-point sampling over the visible stars: spread-out homeworlds
      const key = n + ':' + count;
      if (homeCache[key]) return homeCache[key];
      const out = [Math.floor(n * .62)];
      const d2 = (a, b) => { const dx = stars[a].x - stars[b].x, dy = stars[a].y - stars[b].y; return dx * dx + dy * dy; };
      while (out.length < count && out.length < n) {
        let best = -1, bd = -1;
        for (let i = 0; i < n; i++) { let d = Infinity; for (const c of out) d = Math.min(d, d2(i, c)); if (d > bd) { bd = d; best = i; } }
        out.push(best);
      }
      return (homeCache[key] = out);
    }
    let layer = null, layerKey = '', curN = -1, markers = [], lastTarget = 0, flash = 0;
    function ensureLayer(w, hh, dpr) {
      const key = w + 'x' + hh + '@' + dpr;
      if (key === layerKey) return layer;
      layerKey = key;
      layer = layer || doc.createElement('canvas');
      layer.width = Math.round(w * dpr); layer.height = Math.round(hh * dpr);
      const c = layer.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = w / 2, cy = hh / 2, rx = w * .5 * .93, ry = hh * .5 * .88;
      [[-.32, -.12, .5, '90,70,210', .2], [.38, .14, .46, '40,120,210', .15], [.05, .4, .36, '180,70,190', .1]].forEach(b => {
        const x = cx + b[0] * w, y = cy + b[1] * hh, r = b[2] * Math.max(w, hh) * .8;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(' + b[3] + ',' + b[4] + ')'); g.addColorStop(1, 'rgba(' + b[3] + ',0)');
        c.fillStyle = g; c.fillRect(0, 0, w, hh);
      });
      c.lineWidth = 1; c.strokeStyle = 'rgba(214,179,106,.16)';
      for (const f of [.25, .5, .75, 1]) { c.beginPath(); c.ellipse(cx, cy, rx * f, ry * f, 0, 0, TAU); c.stroke(); }
      c.beginPath(); c.moveTo(cx - rx - 6, cy); c.lineTo(cx + rx + 6, cy); c.moveTo(cx, cy - ry - 6); c.lineTo(cx, cy + ry + 6); c.stroke();
      c.strokeStyle = 'rgba(214,179,106,.4)';
      for (let a = 0; a < 360; a += 15) {                // ticks on the outer ring
        const r = a * Math.PI / 180, len = a % 45 === 0 ? 7 : 3.5;
        c.beginPath(); c.moveTo(cx + Math.cos(r) * rx, cy + Math.sin(r) * ry); c.lineTo(cx + Math.cos(r) * (rx - len), cy + Math.sin(r) * (ry - len * ry / rx)); c.stroke();
      }
      return layer;
    }
    function frame(dt, t, tg) {                         // tg = {n, rivals, banner}
      const f = UI.fitCanvas(cv, { maxDpr: 1.75 }), ctx = f.ctx, w = f.w, hh = f.h;
      if (w < 16 || hh < 16) return;
      const calm = M.Settings.get('reduceMotion') || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (curN < 0 || calm) curN = tg.n;
      if (tg.n !== lastTarget) { if (lastTarget) flash = 1; lastTarget = tg.n; }
      curN += (tg.n - curN) * (1 - Math.exp(-dt * 4.2));
      if (Math.abs(tg.n - curN) < .03) curN = tg.n;
      flash = Math.max(0, flash - dt * 1.4);
      ctx.clearRect(0, 0, w, hh);
      ctx.drawImage(ensureLayer(w, hh, f.dpr), 0, 0, w, hh);
      const cx = w / 2, cy = hh / 2, rx = w * .5 * .93, ry = hh * .5 * .88, frac = Math.sqrt(Math.max(curN, 1) / N);
      // outline of the selected galaxy
      ctx.save(); ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 6; ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(243,220,160,' + (.3 + flash * .5) + ')';
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * frac * 1.04, ry * frac * 1.04, 0, 0, TAU); ctx.stroke(); ctx.restore();
      // lanes
      const whole = Math.floor(curN);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(214,179,106,.16)'; ctx.beginPath();
      for (let k = 0; k < links.length; k++) {
        const l = links[k];
        if (l[0] >= whole || l[1] >= whole) continue;
        ctx.moveTo(cx + stars[l[0]].x * rx, cy + stars[l[0]].y * ry); ctx.lineTo(cx + stars[l[1]].x * rx, cy + stars[l[1]].y * ry);
      }
      ctx.stroke();
      // stars
      for (let i = 0; i < N; i++) {
        const a = U.clamp(curN - i + 1, 0, 1);
        if (a <= .01) continue;
        const s = stars[i], tw = calm ? 1 : .74 + .26 * Math.sin(t * s.sp + s.ph), pop = 1 + (1 - a) * .9, sz = (3 + s.sz * 3.4) * pop;
        ctx.globalAlpha = a * tw;
        ctx.drawImage(sprites[s.k], cx + s.x * rx - sz, cy + s.y * ry - sz, sz * 2, sz * 2);
      }
      ctx.globalAlpha = 1;
      // homeworlds: you (brass ring) + rivals (banner-coloured diamonds)
      const count = Math.min(tg.rivals + 1, Math.max(1, Math.round(curN)));
      const homes = homesFor(Math.max(1, Math.round(tg.n)), tg.rivals + 1);
      const rivalIds = []; for (let i = 0; i < 6 && rivalIds.length < 5; i++) if (i !== tg.banner) rivalIds.push(i);
      while (markers.length < tg.rivals + 1) markers.push({ x: cx, y: cy, a: 0 });
      for (let k = 0; k < markers.length; k++) {
        const m = markers[k], want = k < homes.length && k < count && k <= tg.rivals;
        const s = stars[homes[k]] || stars[0];
        const tx = cx + s.x * rx, ty = cy + s.y * ry;
        if (m.a < .02 && want) { m.x = tx; m.y = ty; }
        const e = 1 - Math.exp(-dt * 7);
        m.x += (tx - m.x) * e; m.y += (ty - m.y) * e; m.a += ((want ? 1 : 0) - m.a) * (1 - Math.exp(-dt * 8));
        if (m.a < .02) continue;
        ctx.globalAlpha = m.a;
        if (k === 0) {
          const pulse = calm ? 0 : (Math.sin(t * 2.4) + 1) * .5;
          ctx.lineWidth = 1.6; ctx.strokeStyle = '#f3dca0'; ctx.beginPath(); ctx.arc(m.x, m.y, 7.5 + pulse * 2, 0, TAU); ctx.stroke();
          ctx.fillStyle = '#f3dca0'; ctx.beginPath(); ctx.arc(m.x, m.y, 2.4, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(243,220,160,' + (.35 - pulse * .25) + ')'; ctx.beginPath(); ctx.arc(m.x, m.y, 12 + pulse * 5, 0, TAU); ctx.stroke();
        } else {
          const col = bannerHex(rivalIds[(k - 1) % rivalIds.length]), r = 5.6;
          ctx.fillStyle = col; ctx.strokeStyle = 'rgba(4,6,20,.85)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(m.x, m.y - r); ctx.lineTo(m.x + r, m.y); ctx.lineTo(m.x, m.y + r); ctx.lineTo(m.x - r, m.y); ctx.closePath(); ctx.stroke(); ctx.fill();
          ctx.globalAlpha = m.a * .35; ctx.lineWidth = 1; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, r + 4, 0, TAU); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    return { frame, debug: () => ({ curN, markers: markers.map(m => ({ x: +m.x.toFixed(1), y: +m.y.toFixed(1), a: +m.a.toFixed(2) })) }) };
  }

  // ---- DOM / view construction ------------------------------------------------------------------------------
  let rootEl, bgEl, stageEl, loadEl, loadSub, phaseTimer = 0, busy = false, built = false;
  let headSteps = [], cancelBtn, backBtn, nextBtn, beginBtn, hintEl, views = [];
  let rail = null;
  let talkUntil = 0, thumbsKey = '', bannersKey = '';

  const grp = (cls, label) => h('div' + cls, { role: 'radiogroup', 'aria-label': label });
  const note = (cls) => h('p.su-note' + (cls || ''));

  function changed() { syncAll(); saveSoon(); }
  function setKey(k, v) { st[k] = v; changed(); }
  function setOpt(k, v) { st.options[k] = !!v; changed(); }
  function setRace(id) {
    if (st.race === id) return;
    st.race = id; fillDefaults(); talkUntil = performance.now() / 1000 + 1.5;
    const fr = rootEl && rootEl.querySelector('.su-pframe'); if (fr) restartAnim(fr, 'swap');
    changed();
  }
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  // ----- step 1: galaxy -----
  let remakeOpen = false;
  function buildGalaxy() {
    // galaxy size: five cards + the animated sector chart
    const sizeGroup = grp('.su-sizes', 'Galaxy size');
    const sizeBtns = SIZES.map(s => {
      const b = h('button.cx.su-opt', { type: 'button', role: 'radio', onclick: () => { if (st.size !== s.id) { UI.sfx('click'); setKey('size', s.id); } } },
        h('span.su-opt-l', s.label), h('span.su-opt-n', h('b', s.stars), ' stars'),
        h('i.su-opt-bar', h('u', { style: { width: Math.round(s.stars / 160 * 100) + '%' } })));
      sizeGroup.appendChild(b);
      return b;
    });
    radioNav(sizeGroup);
    const cv = h('canvas.su-chart-cv');
    const chart = makeChart(cv);
    const cvStars = h('b', '48'), cvEmp = h('b', '4');
    const chartBox = h('div.su-chart', cv,
      h('span.su-chart-tl', 'Sector chart'),
      h('span.su-chart-tr', cvStars, ' stars · ', cvEmp, ' empires'),
      h('span.su-chart-bl', h('i.you'), 'You', h('i.rival'), 'Rivals'));
    const sizePanel = UI.panel('Galaxy size', h('div.su-size-body', sizeGroup, chartBox), { sub: '—', cls: 'su-p-size' });
    const sizeSub = sizePanel.querySelector('.sub');

    // difficulty: one row per level, all descriptions visible
    const diffGroup = grp('.su-diffs', 'Difficulty');
    const diffBtns = DIFFS.map(d => {
      const b = h('button.cx.su-drow', { type: 'button', role: 'radio', onclick: () => { if (st.difficulty !== d.id) { UI.sfx('click'); setKey('difficulty', d.id); } } },
        h('i.su-drow-m'), h('span.su-drow-l', d.label), h('span.su-drow-t', d.text));
      diffGroup.appendChild(b);
      return b;
    });
    radioNav(diffGroup);
    const diffPanel = UI.panel('Difficulty', diffGroup, { sub: 'Harder: sharper rivals, fewer starting people', cls: 'su-p-diff' });

    // rivals
    const oppSeg = segmented([1, 2, 3, 4, 5].map(n => ({ id: n, label: String(n) })), st.opponents, v => setKey('opponents', Number(v)), { block: true, label: 'Rival empires' });
    const oppText = note();
    const oppPanel = UI.panel('Rival empires', h('div', oppSeg, oppText));

    // seed
    const seedIn = h('input.field.su-seed', {
      id: 'su-seed', type: 'text', maxlength: 24, placeholder: 'Random', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Galaxy seed',
      oninput: e => { st.seed = e.target.value; changed(); },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } },
    });
    const dice = iconButton('', 'dice', () => { st.seed = randomSeed(); changed(); }, { tip: 'Roll a random seed', cls: 'su-dice' });
    const seedPanel = UI.panel('Galaxy seed', h('div', h('div.row.g2', seedIn, dice),
      h('p.su-note', 'Optional. The same seed and settings always create the same galaxy; leave it blank for a surprise.')));

    // remake options (collapsed): everything here is an extra; the defaults reproduce the original's rules
    const ageSeg = segmented(AGES.map(a => ({ id: a.id, label: a.label })), st.age, v => setKey('age', v), { block: true, label: 'Galaxy age' });
    const ageText = note();
    const switches = {};
    const optRows = OPTS.map(o => {
      const sw = toggle(st.options[o.id], v => setOpt(o.id, v), { label: o.label });
      switches[o.id] = sw;
      return h('div.su-optrow', { onclick: e => { if (!sw.contains(e.target)) sw.click(); } }, h('span.su-optrow-t', h('b', o.label), h('span', o.text)), sw);
    });
    const restore = UI.button('Restore original rules', () => { st.age = 'average'; Object.assign(st.options, OPT_DEFAULTS); changed(); }, { small: true });
    const remakeSub = h('span.sub');
    const disc = h('button.panel-h.su-disc', { type: 'button', 'aria-expanded': 'false', tip: 'Extras the 1993 original never had', onclick: () => { UI.sfx('click'); setRemake(!remakeOpen, true); } }, icon('chevR', 'su-disc-i'), h('span', 'Remake options'), remakeSub);
    const remakePanel = h('div.panel.su-p-remake', disc,
      h('div.su-collapse', h('div.su-collapse-in',
        h('div.su-sub-h', 'Galaxy age'), ageSeg, ageText,
        h('div.su-sub-h', 'Rules'), h('div.su-rules.two', optRows),
        h('div.su-remake-foot', h('span', 'Extras the 1993 original never had; the defaults reproduce its rules.'), restore))));
    function setRemake(open, scroll) {
      remakeOpen = !!open;
      remakePanel.classList.toggle('open', remakeOpen);
      disc.setAttribute('aria-expanded', remakeOpen ? 'true' : 'false');
      if (remakeOpen && scroll) setTimeout(() => remakePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 340);
    }
    const nonDefault = () => (st.age !== 'average' ? 1 : 0) + OPTS.filter(o => !!st.options[o.id] !== OPT_DEFAULTS[o.id]).length;

    const el = h('section.su-view.su-s1',
      h('div.su-col.su-left', sizePanel, remakePanel),
      h('div.su-col.su-right', diffPanel, oppPanel, seedPanel));
    return {
      el,
      sync() {
        const sz = sizeOf(st.size);
        markRadios(sizeBtns, (b, i) => SIZES[i].id === st.size);
        sizeSub.textContent = sz.label + ' · ' + sz.stars + ' stars';
        cvStars.textContent = sz.stars; cvEmp.textContent = st.opponents + 1;
        markRadios(diffBtns, (b, i) => DIFFS[i].id === st.difficulty);
        oppSeg.set(st.opponents);
        oppText.textContent = st.opponents + (st.opponents === 1 ? ' rival empire' : ' rival empires') + ' · about ' + Math.max(1, Math.round(sz.stars / (st.opponents + 1))) + ' stars each';
        ageSeg.set(st.age); ageText.textContent = pickOf(AGES, st.age).text;
        OPTS.forEach(o => switches[o.id].set(st.options[o.id]));
        const n = nonDefault();
        remakeSub.textContent = n ? n + ' changed' : 'original rules';
        remakeSub.classList.toggle('changed', n > 0);
        restore.disabled = n === 0;
        if (seedIn.value !== st.seed) seedIn.value = st.seed;
      },
      show() { setRemake(nonDefault() > 0); },
      frame(dt, t) { chart.frame(dt, t, { n: sizeOf(st.size).stars, rivals: st.opponents, banner: st.banner }); },
      debug: chart.debug,
      focus() { const b = sizeBtns.find(x => x.tabIndex === 0) || sizeBtns[0]; b.focus({ preventScroll: true }); },
    };
  }

  // ----- step 2: race -----
  function buildRace() {
    const ids = raceIds();
    const roster = grp('.su-roster', 'Race');
    const cards = ids.map(id => {
      const r = raceInfo(id), cv = h('canvas.su-thumb');
      const pips = h('span.su-pips', (r.traits || []).slice(0, 8).map(t => h('i' + (t.good === false ? '.bad' : '.good'))));
      const b = h('button.cx.su-race', { type: 'button', role: 'radio', onclick: () => { UI.sfx('click'); setRace(id); } },
        h('span.su-thumb-w', cv),
        h('span.su-race-t', h('span.su-race-n', r.name || U.cap(id)), h('span.su-race-g', r.tagline || ''), pips));
      roster.appendChild(b);
      return { id, b, cv };
    });
    radioNav(roster, 2);

    const portrait = h('canvas.su-portrait');
    const pframe = h('div.cx.su-pframe', portrait);
    const dName = h('h2.su-d-name'), dTag = h('div.su-d-tag'), dDesc = h('p.su-d-desc'), dHome = h('b'), dLeaders = h('span');
    const traits = h('div.su-traits'), dArt = h('div.su-homeart');                  // homeworld illustration (Gfx.WorldArt), absent until loaded
    const detail = h('div.panel.su-detail',
      h('div.su-d-top', pframe,
        h('div.su-d-info', dName, dTag, dDesc,
          h('div.su-facts', h('div', h('small', 'Homeworld'), dHome), h('div', h('small', 'Emperors'), dLeaders)), dArt)),
      h('div.panel-h.su-traits-h', h('span', 'Racial traits'), h('span.sub', h('i.su-key.good'), 'strength', h('i.su-key.bad'), 'weakness')),
      traits);
    const el = h('section.su-view.su-s2', roster, detail);

    function paintThumbs() {
      const key = devKey() + '|' + st.banner;
      if (key === thumbsKey) return;
      let ok = true;
      cards.forEach(c => {
        const f = UI.fitCanvas(c.cv);
        if (f.w < 8) { ok = false; return; }
        f.ctx.clearRect(0, 0, f.w, f.h);
        drawPortrait(f.ctx, c.id, f.w, f.h, { still: true, color: bannerHex(st.banner) });
      });
      if (ok) thumbsKey = key;
    }
    return {
      el,
      sync() {
        markRadios(cards.map(c => c.b), (b, i) => cards[i].id === st.race);
        const r = raceInfo(st.race);
        dName.textContent = r.name || U.cap(st.race);
        dTag.textContent = r.tagline || '';
        dDesc.textContent = r.desc || 'No description available.';
        dHome.textContent = defaultHome(st.race);
        UI.clear(dArt);
        const WA = M.Gfx && M.Gfx.WorldArt, hp = WA && WA.enabled ? WA.race(st.race, 'homeworld') : null;
        if (hp) dArt.appendChild(WA.image(hp, { fx: 0.5, fy: 0.5, exposure: WA.raceExposure ? WA.raceExposure(st.race, 'homeworld') : 1 }));
        dLeaders.textContent = ((r.leaderNames || []).slice(0, 3).join(', ')) || '—';
        UI.clear(traits);
        const tl = r.traits || [];
        if (!tl.length) traits.appendChild(h('div.su-trait.dim', 'No special traits recorded.'));
        tl.forEach(t => traits.appendChild(h('div.su-trait', UI.chip(t.label, t.good === false ? 'bad' : 'ok'), t.text ? h('span', t.text) : null)));
      },
      show() { thumbsKey = ''; paintThumbs(); },
      repaint() { thumbsKey = ''; },
      frame(dt, t) {
        paintThumbs();
        const f = UI.fitCanvas(portrait, { maxDpr: 1.75 });
        if (f.w < 8) return;
        drawPortrait(f.ctx, st.race, f.w, f.h, { t, mood: 'neutral', talking: t < talkUntil, color: bannerHex(st.banner) });
      },
      focus() { const b = cards.find(c => c.b.tabIndex === 0); (b ? b.b : cards[0].b).focus({ preventScroll: true }); },
    };
  }
  const devKey = () => Math.round(remPx() * 10) + '@' + dprNow(2);

  // ----- step 3: banner & names -----
  function buildBanner() {
    const grid = grp('.su-banners', 'Banner colour');
    const sw = BANNER_NAMES.map((name, i) => {
      const cv = h('canvas.su-ship');
      const b = h('button.cx.su-banner', { type: 'button', role: 'radio', style: { '--c': bannerHex(i) }, onclick: () => { UI.sfx('click'); setKey('banner', i); } },
        cv, h('span.su-banner-n', h('i.empire-dot', { style: { '--c': bannerHex(i) } }), name));
      grid.appendChild(b);
      return { b, cv, i };
    });
    radioNav(grid, 3);
    const fleetCv = h('canvas.su-fleet-cv');
    const fleet = h('div.su-fleet', fleetCv);
    const bannerPanel = UI.panel('Banner colour', h('div.su-banner-body', grid,
      h('p.su-note', 'Your banner also fixes the livery of every ship you build, so choose a colour you can pick out in a crowded sky.'), fleet), { cls: 'su-p-banner' });

    const leaderIn = h('input.field.su-in', {
      id: 'su-leader', type: 'text', maxlength: 24, spellcheck: 'false', autocomplete: 'off',
      oninput: e => { st.leader = e.target.value; st.leaderCustom = true; changed(); },
      onchange: () => { if (!clean(st.leader)) { st.leaderCustom = false; fillDefaults(); changed(); } },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); next(); } },
    });
    const homeIn = h('input.field.su-in', {
      id: 'su-home', type: 'text', maxlength: 24, spellcheck: 'false', autocomplete: 'off',
      oninput: e => { st.homeworld = e.target.value; st.homeCustom = true; changed(); },
      onchange: () => { if (!clean(st.homeworld)) { st.homeCustom = false; fillDefaults(); changed(); } },
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); next(); } },
    });
    const rollLeader = iconButton('', 'dice', () => {
      const l = (raceInfo(st.race).leaderNames || []).filter(n => n !== st.leader);
      if (l.length) { st.leader = l[Math.floor(Math.random() * l.length)]; st.leaderCustom = false; changed(); }
    }, { tip: 'Pick a random emperor name' });
    const resetHome = iconButton('', 'undo', () => { st.homeCustom = false; fillDefaults(); changed(); }, { tip: 'Restore the default homeworld name' });
    const namesPanel = UI.panel('Emperor & throne-world', h('div.su-fields',
      h('div.su-field', h('label', { for: 'su-leader' }, 'Emperor name'), h('div.row.g2', leaderIn, rollLeader)),
      h('div.su-field', h('label', { for: 'su-home' }, 'Homeworld name'), h('div.row.g2', homeIn, resetHome))));

    const idCv = h('canvas.su-id-cv'), idName = h('div.su-id-name'), idRace = h('div.su-id-race'), idTag = h('div.su-id-tag'), idHome = h('b'), idBanner = h('span.su-id-ban');
    const idFrame = h('div.cx.su-pframe.sm', idCv);
    const idCard = h('div.panel.su-id', idFrame,
      h('div.su-id-t', h('small', 'Emperor'), idName, idRace, idTag,
        h('div.su-facts.one', h('div', h('small', 'Throne-world'), idHome), h('div', h('small', 'Banner'), idBanner))));

    const el = h('section.su-view.su-s3', bannerPanel, h('div.su-col.su-right', namesPanel, idCard));

    function paintShips() {
      const key = devKey() + '|' + st.race;
      if (key === bannersKey) return;
      let ok = true;
      sw.forEach(s => {
        const f = UI.fitCanvas(s.cv);
        if (f.w < 8) { ok = false; return; }
        f.ctx.clearRect(0, 0, f.w, f.h);
        drawShip(f.ctx, st.race, 1, f.w / 2, f.h / 2, Math.min(f.w * .8, f.h * 1.9), bannerHex(s.i), { angle: -Math.PI / 6 });
      });
      if (ok) bannersKey = key;
    }
    return {
      el,
      sync() {
        markRadios(sw.map(s => s.b), (b, i) => i === st.banner);
        el.style.setProperty('--c', bannerHex(st.banner));
        if (leaderIn.value !== st.leader) leaderIn.value = st.leader;
        if (homeIn.value !== st.homeworld) homeIn.value = st.homeworld;
        resetHome.disabled = !st.homeCustom;
        const r = raceInfo(st.race);
        idName.textContent = clean(st.leader) || defaultLeader(st.race);
        idRace.textContent = 'of the ' + (r.name || U.cap(st.race)) + ' empire';
        idTag.textContent = r.tagline || '';
        idHome.textContent = clean(st.homeworld) || defaultHome(st.race);
        UI.mount(idBanner, h('i.empire-dot', { style: { '--c': bannerHex(st.banner) } }), BANNER_NAMES[st.banner]);
      },
      show() { bannersKey = ''; paintShips(); },
      repaint() { bannersKey = ''; },
      frame(dt, t) {
        paintShips();
        let f = UI.fitCanvas(fleetCv, { maxDpr: 1.75 });
        if (f.w > 16) {
          const ctx = f.ctx, w = f.w, hh = f.h, col = bannerHex(st.banner);
          ctx.clearRect(0, 0, w, hh);
          const mult = [1, 1.3, 1.7, 2.2], gap = w * .04, unit = Math.min((w * .92 - 3 * gap) / 6.2, hh * .5);
          let x = (w - (unit * 6.2 + 3 * gap)) / 2;
          for (let k = 0; k < 4; k++) {
            const len = unit * mult[k];
            drawShip(ctx, st.race, k, x + len / 2, hh * .54 + Math.sin(t * .9 + k * 1.7) * hh * .02, len, col, { animated: true, t, thrust: .6 });
            x += len + gap;
          }
        }
        f = UI.fitCanvas(idCv, { maxDpr: 1.75 });
        if (f.w > 8) drawPortrait(f.ctx, st.race, f.w, f.h, { t, mood: 'pleased', color: bannerHex(st.banner) });
      },
      focus() { const b = sw.find(s => s.b.tabIndex === 0); (b ? b.b : sw[0].b).focus({ preventScroll: true }); },
      focusName() { leaderIn.focus(); leaderIn.select(); },
    };
  }

  // ----- summary rail -----
  function buildRail() {
    const portrait = h('div.su-rail-id');
    const nameEl = h('div.su-rail-race'), leaderEl = h('div.su-rail-leader');
    const row = (label, step) => {
      const v = h('span.su-rr-v');
      const b = h('button.su-rr.su-nav', { type: 'button', tip: 'Change', onclick: () => goStep(step) }, h('span.su-rr-l', label), v);
      return { b, v };
    };
    const r = { size: row('Galaxy', 0), age: row('Age', 0), diff: row('Difficulty', 0), opp: row('Rivals', 0), seed: row('Seed', 0), race: row('Race', 1), banner: row('Banner', 2), leader: row('Emperor', 2), home: row('Homeworld', 2) };
    const rules = h('div.su-rr-rules');
    const body = h('div.su-rail-body',
      h('div.su-rail-empire', portrait, h('div', nameEl, leaderEl)),
      h('div.su-rr-h', 'Galaxy'), r.size.b, r.diff.b, r.opp.b, r.age.b, r.seed.b,
      h('div.su-rr-h', 'Rules'), rules,
      h('div.su-rr-h', 'Empire'), r.race.b, r.banner.b, r.leader.b, r.home.b);
    const el = h('aside.su-rail', UI.panel('Your campaign', body));
    return {
      el,
      sync() {
        const sz = sizeOf(st.size), info = raceInfo(st.race);
        r.size.v.textContent = sz.label + ' · ' + sz.stars;
        r.age.v.textContent = pickOf(AGES, st.age).label;
        r.diff.v.textContent = pickOf(DIFFS, st.difficulty).label;
        r.opp.v.textContent = String(st.opponents);
        r.seed.v.textContent = clean(st.seed) || 'Random';
        r.race.v.textContent = info.name || U.cap(st.race);
        UI.mount(r.banner.v, h('i.empire-dot', { style: { '--c': bannerHex(st.banner) } }), BANNER_NAMES[st.banner]);
        r.leader.v.textContent = clean(st.leader) || defaultLeader(st.race);
        r.home.v.textContent = clean(st.homeworld) || defaultHome(st.race);
        nameEl.textContent = info.name || U.cap(st.race);
        leaderEl.textContent = clean(st.leader) || defaultLeader(st.race);
        UI.mount(rules, OPTS.map(o => h('span.su-rule' + (st.options[o.id] ? '.on' : ''), { tip: o.label + (st.options[o.id] ? ': on' : ': off') }, o.short)));
        const key = st.race + '|' + st.banner + '|' + devKey();
        if (portrait.dataset.key !== key) { portrait.dataset.key = key; UI.mount(portrait, raceBadge(st.race, 3.6, st.banner)); }
      },
    };
  }

  // ----- navigation -----
  function syncAll() { views.forEach(v => v.sync()); if (rail) rail.sync(); navSync(); }
  function navSync() {
    headSteps.forEach((s, i) => { s.classList.toggle('cur', i === st.step); s.classList.toggle('done', i < st.step); s.setAttribute('aria-current', i === st.step ? 'step' : 'false'); });
    if (backBtn) backBtn.disabled = st.step === 0 || busy;
    if (nextBtn) { nextBtn.classList.toggle('hide', st.step === 2); nextBtn.disabled = busy; }
    if (beginBtn) { beginBtn.classList.toggle('hide', st.step !== 2); beginBtn.disabled = busy; }
    if (hintEl) hintEl.textContent = 'Step ' + (st.step + 1) + ' of 3 · ' + STEPS[st.step].hint;
  }
  function goStep(n, o) {
    if (busy || !built) return;
    n = U.clamp(n, 0, 2);
    st.step = n;
    views.forEach((v, i) => v.el.classList.toggle('hide', i !== n));
    const v = views[n];
    restartAnim(v.el, 'in');
    stageEl.scrollTop = 0;
    if (v.show) v.show();
    navSync();
    if (o && o.focus) v.focus && v.focus();
  }
  function next() { if (busy) return; if (st.step < 2) goStep(st.step + 1); else begin(); }
  function back() { if (!busy && st.step > 0) goStep(st.step - 1); }
  function cancel() {
    if (busy) return;
    saveNow();
    if (UI.Screens.has('menu')) UI.Screens.go('menu'); else UI.toast('The title screen is not available', 'warn');
  }
  // Esc / right-click = back one step (cancel on the first); Enter / Space = OK. A focused button acts on itself; a selected card continues.
  function stepBack() { if (busy) return; if (st.step > 0) back(); else cancel(); }
  function escapeBack() {
    const a = doc.activeElement;
    if (a && a.tagName === 'INPUT') { a.blur(); if (stageEl) stageEl.focus({ preventScroll: true }); return; }       // Esc first leaves a text field
    stepBack();
  }
  function confirmKey() {
    if (busy) return;
    const a = doc.activeElement;
    if (a && a.tagName === 'BUTTON' && !a.matches('[role=radio]')) { a.click(); return; }
    if (a && a.matches && a.matches('[role=radio][aria-checked=false]')) { a.click(); return; }
    next();
  }
  function arrowNav(dx, dy) {
    if (busy) return false;
    if (st.step === 1) {
      const ids = raceIds(), i = ids.indexOf(st.race), j = U.clamp(i + dx + dy * 2, 0, ids.length - 1);
      if (j !== i) setRace(ids[j]);
      return true;
    }
    if (st.step === 2) { const j = U.clamp(st.banner + dx + dy * 3, 0, 5); if (j !== st.banner) setKey('banner', j); return true; }
    return false;
  }

  // ----- begin -----
  function showLoading(on) {
    clearInterval(phaseTimer);
    loadEl.classList.toggle('on', !!on);
    if (!on) return;
    let i = 0; loadSub.textContent = PHASES[0] + '…';
    phaseTimer = setInterval(() => { i = (i + 1) % PHASES.length; loadSub.textContent = PHASES[i] + '…'; }, 1100);
  }
  // let the loading overlay paint before the (possibly blocking) generator runs; never wait on a hidden tab's rAF
  const afterPaint = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 40)); setTimeout(go, 250); });
  function begin() {
    if (busy) return Promise.resolve();
    const G = M.Game;
    if (!G || typeof G.newGame !== 'function') {
      UI.alert('The game engine is not available yet, so a new game cannot be started.', { title: 'Cannot begin' });
      return Promise.resolve();
    }
    saveNow();
    const cfg = collect();
    busy = true; navSync(); showLoading(true);
    const t0 = performance.now();
    return afterPaint()
      .then(() => G.newGame(cfg))
      .then(() => U.sleep(Math.max(0, 650 - (performance.now() - t0))))
      .then(() => {
        busy = false; showLoading(false); navSync();
        if (UI.Screens.has('galaxy')) UI.Screens.go('galaxy'); else UI.toast('Galaxy screen is not available yet', 'warn');
      })
      .catch(err => {
        console.error('[setup] newGame failed', err);
        busy = false; showLoading(false); navSync();
        UI.modal({
          title: 'The galaxy could not be charted',
          body: h('div', h('p', 'Something went wrong while creating the new game. Your choices have been kept, so you can try again or adjust them.'),
            h('pre.su-err', String(err && err.message || err))),
          buttons: [{ label: 'Back to setup', value: true, primary: true }],
        });
      });
  }

  // ----- screen -----
  function create(el) {
    Object.assign(st, freshState());
    rootEl = el;
    bgEl = UI.Sky && UI.Sky.el ? null : backdrop('ui');              // the one sky shows through; the painted one is the fallback
    views = [buildGalaxy(), buildRace(), buildBanner()];
    rail = buildRail();
    stageEl = h('main.su-stage', { tabindex: -1 }, views.map(v => v.el));
    headSteps = STEPS.map((s, i) => h('button.su-step.su-nav', { type: 'button', onclick: () => goStep(i) }, h('span.su-dia', h('b', i + 1)), h('span.su-step-l', s.label)));
    const stepsNav = h('nav.su-steps', { 'aria-label': 'Setup steps' }, headSteps.map((b, i) => [i ? h('span.su-link') : null, b]));
    backBtn = UI.button('Back', back, { cls: 'su-nav' });
    backBtn.insertBefore(icon('chevL'), backBtn.firstChild);
    hotkey(backBtn, 'b');
    nextBtn = UI.button('Next', next, { primary: true, cls: 'su-nav', kbd: 'Space' });
    nextBtn.appendChild(icon('chevR'));
    hotkey(nextBtn, 'n');
    beginBtn = UI.button('Begin', next, { primary: true, big: true, cls: 'su-nav su-begin', kbd: 'Space' });
    cancelBtn = hotkey(UI.button('Cancel', cancel, { cls: 'su-nav', tip: 'Leave without starting a game' }), 'c');
    hintEl = h('span.su-foot-hint');
    loadSub = h('div.su-load-sub');
    loadEl = h('div.su-loading', { role: 'alert' }, h('div.su-load-box',
      h('div.su-orrery', h('i'), h('i'), h('i'), h('b')), h('div.su-load-title', 'Charting the galaxy…'), loadSub, h('div.su-load-bar', h('i'))));
    el.appendChild(h('div.su-wrap', bgEl, h('div.ctl-shade'),
      h('div.su-frame',
        h('header.su-head', h('div', h('div.ctl-eyebrow', 'The galaxy awaits'), h('h1.ctl-title', 'New game')), stepsNav),
        h('div.su-body', stageEl, rail.el),
        h('footer.su-foot', cancelBtn, hintEl, h('span.grow'), backBtn, nextBtn, beginBtn)),
      loadEl));
    rightClick(el, stepBack);
    hotkeys(el, { c: cancelBtn, b: backBtn, n: nextBtn });
    built = true;
  }
  function enter(params) {
    restoreLast();
    busy = false; showLoading(false);
    if (bgEl) bgEl.paint();
    thumbsKey = ''; bannersKey = '';
    views.forEach(v => v.repaint && v.repaint());
    syncAll();
    const s = params && Number.isInteger(params.step) ? params.step : 0;
    goStep(s);
    if (s === 2 && params && params.focusName) views[2].focusName();
    stageEl.focus({ preventScroll: true });
  }

  UI.Screens.register('setup', {
    create,
    enter,
    leave() { clearInterval(phaseTimer); saveNow(); },
    resize() { if (!built) return; if (bgEl) bgEl.paint(); thumbsKey = ''; bannersKey = ''; },
    update(dt, t) { if (!built) return; const v = views[st.step]; if (v && v.frame) v.frame(dt, t); },
  });

  UI.bindKey('Escape', escapeBack, { screen: 'setup' });
  UI.bindKey('Enter', confirmKey, { screen: 'setup' });
  UI.bindKey('Space', confirmKey, { screen: 'setup' });
  UI.bindKey('Backspace', back, { screen: 'setup' });
  UI.bindKey('ArrowLeft', () => arrowNav(-1, 0), { screen: 'setup' });
  UI.bindKey('ArrowRight', () => arrowNav(1, 0), { screen: 'setup' });
  UI.bindKey('ArrowUp', () => arrowNav(0, -1), { screen: 'setup' });
  UI.bindKey('ArrowDown', () => arrowNav(0, 1), { screen: 'setup' });

  UI.Setup = {
    collect, go: goStep, begin, get state() { return st; },
    debug: () => (views[0] && views[0].debug ? views[0].debug() : null),
    // average ms per frame of the current step's animation (dev aid)
    frameCost(n) { const v = views[st.step]; if (!v || !v.frame) return 0; n = n || 60; const t0 = performance.now(); for (let i = 0; i < n; i++) v.frame(1 / 60, performance.now() / 1000); return (performance.now() - t0) / n; },
  };

  UI.css('setup', `
    .su-wrap { position:absolute; inset:0; overflow:hidden; background:var(--void); }
    .su-frame { position:absolute; inset:0; display:flex; flex-direction:column; gap:.8rem; padding: clamp(.8rem, 3vh, 2rem) clamp(1rem, 3.4vw, 3.2rem) clamp(.7rem, 2.2vh, 1.3rem); }

    /* header + step tracker */
    .su-head { flex:none; display:flex; align-items:flex-end; justify-content:space-between; gap:1.5rem; }
    .su-steps { display:flex; align-items:center; padding-bottom:.25rem; }
    .su-step { display:flex; align-items:center; gap:.6rem; padding:.3rem .45rem; border:0; background:none; cursor:var(--hand); color:var(--fog); font:400 1rem var(--font-display); letter-spacing:.06em; transition: color .2s; }
    .su-dia { display:grid; place-items:center; flex:none; width:1.5rem; height:1.5rem; border:1px solid currentColor; transform:rotate(45deg); transition: background .2s, box-shadow .2s, color .2s; }
    .su-dia b { transform:rotate(-45deg); font:600 .8rem var(--font-ui); }
    .su-link { width:clamp(1.2rem, 3.2vw, 3.4rem); height:1px; margin:0 .15rem; background:linear-gradient(90deg, rgba(214,179,106,.5), rgba(214,179,106,.12)); }
    .su-step:hover { color:var(--ivory); }
    .su-step.done { color:var(--brass); }
    .su-step.cur { color:var(--brass-hi); }
    .su-step.cur .su-dia { color:#261b06; background:linear-gradient(135deg,#f6e3b0,#c9a35c); box-shadow:0 0 14px rgba(243,220,160,.45); }
    .su-step:focus-visible { outline:none; } .su-step:focus-visible .su-dia { box-shadow:0 0 0 2px var(--cyan); }

    /* layout */
    .su-body { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) clamp(15.5rem, 19.5vw, 19rem); gap:.9rem; }
    .su-stage { min-height:0; overflow-y:auto; overflow-x:hidden; padding:2px 6px 2px 2px; outline:none; }
    .su-view { animation:none; }
    .su-view.in { animation: su-in .38s var(--ease) both; }
    @keyframes su-in { from { opacity:0; transform:translateX(14px); } to { opacity:1; transform:none; } }
    .su-col { display:flex; flex-direction:column; gap:.8rem; min-width:0; }
    .su-s1 { display:grid; grid-template-columns:minmax(0,1.14fr) minmax(0,1fr); gap:.9rem; align-items:stretch; height:100%; }
    .su-s2 { display:grid; grid-template-columns:minmax(0,1.04fr) minmax(0,1fr); gap:.9rem; align-items:stretch; min-height:100%; }
    .su-s3 { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr); gap:.9rem; align-items:stretch; height:100%; }
    .su-foot { flex:none; display:flex; align-items:center; gap:.7rem; padding-top:.75rem; border-top:1px solid var(--brass-line-2); }
    .su-foot-hint { color:var(--mist); font-size:.9rem; margin-left:.5rem; }
    .su-begin { min-width:11rem; }
    .su-begin::after { content:""; position:absolute; inset:1px; z-index:-1; pointer-events:none; clip-path:var(--poly);
      background: linear-gradient(100deg, transparent 38%, rgba(255,255,255,.5) 50%, transparent 62%) no-repeat 160% 0 / 260% 100%; animation: su-shine 4s 1.4s ease-in-out infinite; }
    @keyframes su-shine { 0%, 52% { background-position: 160% 0; } 100% { background-position: -60% 0; } }
    html.reduce-motion .su-begin::after { animation:none; }
    .su-collapse-in .su-note { margin-top:.4rem; }
    .su-note { margin:.55rem 0 0; color:var(--mist); font-size:.9rem; line-height:1.35; }
    .su-wrap .panel-h .ico { width:1.15rem; height:1.15rem; color:var(--brass); }

    /* selectable cards (galaxy size, race, banner) */
    .su-opt, .su-race, .su-banner { --ch:.55rem; position:relative; isolation:isolate; border:0; padding:0; cursor:var(--hand); color:var(--mist); text-align:center;
      background:linear-gradient(135deg, var(--brass-lo), #2a3260 35%, #2a3260 65%, var(--brass-lo)); transition: filter .15s, transform .12s; }
    .su-opt::before, .su-race::before, .su-banner::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly);
      background:linear-gradient(180deg, rgba(25,36,84,.96), rgba(10,15,40,.97)); transition: background .2s, box-shadow .2s; }
    .su-opt:hover, .su-race:hover, .su-banner:hover { filter:brightness(1.16); }
    .su-opt:active, .su-race:active, .su-banner:active { transform:translateY(1px); }
    .su-opt[aria-checked=true], .su-race[aria-checked=true], .su-banner[aria-checked=true] { color:var(--brass-hi); background:linear-gradient(135deg, var(--brass-hi), var(--brass) 45%, var(--brass-lo)); }
    .su-opt[aria-checked=true]::before, .su-race[aria-checked=true]::before, .su-banner[aria-checked=true]::before { background:linear-gradient(180deg, rgba(54,62,120,.97), rgba(21,29,72,.98)); box-shadow: inset 0 0 1.5rem var(--brass-line-1); }
    .su-opt:focus-visible, .su-race:focus-visible, .su-banner:focus-visible { outline:none; }
    .su-opt:focus-visible::before, .su-race:focus-visible::before, .su-banner:focus-visible::before { box-shadow: inset 0 0 0 2px var(--cyan); }

    /* step 1 */
    .su-sizes { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:.45rem; }
    .su-opt { display:flex; flex-direction:column; align-items:center; gap:.18rem; padding:.55rem .2rem .5rem; }
    .su-opt-l { font:400 1.1rem/1.1 var(--font-display); letter-spacing:.03em; }
    .su-opt-n { font-size:.8rem; color:var(--mist); } .su-opt-n b { font-weight:600; color:var(--ivory); font-variant-numeric:tabular-nums; }
    .su-opt[aria-checked=true] .su-opt-n b { color:var(--brass-hi); }
    .su-opt-bar { display:block; width:70%; height:3px; margin-top:.2rem; background:rgba(255,255,255,.08); } .su-opt-bar u { display:block; height:100%; background:linear-gradient(90deg, var(--brass-lo), var(--brass)); text-decoration:none; }
    .su-p-size { flex:1 1 auto; display:flex; flex-direction:column; min-height:16.5rem; }
    .su-size-body { flex:1 1 auto; display:flex; flex-direction:column; min-height:0; }
    .su-chart { position:relative; flex:1 1 auto; min-height:7.5rem; margin-top:.65rem; background: rgba(4,7,22,.72); box-shadow: inset 0 0 0 1px var(--brass-line-2); overflow:hidden; }
    .su-chart-cv { position:absolute; inset:0; width:100%; height:100%; }
    .su-chart-tl, .su-chart-tr, .su-chart-bl { position:absolute; font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; color:var(--fog); pointer-events:none; }
    .su-chart-tl { left:.6rem; top:.45rem; } .su-chart-tr { right:.6rem; top:.45rem; color:var(--mist); } .su-chart-tr b { color:var(--brass-hi); font-weight:600; }
    .su-chart-bl { left:.6rem; bottom:.45rem; display:flex; align-items:center; gap:.4rem; }
    .su-chart-bl i { display:inline-block; width:.62rem; height:.62rem; } .su-chart-bl i.you { border:1.5px solid var(--brass-hi); border-radius:50%; } .su-chart-bl i.rival { margin-left:.6rem; background:var(--cyan); transform:rotate(45deg) scale(.8); }
    /* difficulty list */
    .su-p-diff { flex:1 1 auto; display:flex; flex-direction:column; }
    .su-diffs { flex:1 1 auto; display:grid; grid-auto-rows:minmax(2.3rem, 1fr); gap:.4rem; }
    .su-drow { --ch:.45rem; position:relative; isolation:isolate; display:grid; grid-template-columns:.75rem 6.2rem minmax(0,1fr); align-items:center; gap:.7rem; padding:.3rem .8rem; border:0; cursor:var(--hand); text-align:left; color:var(--mist);
      background:linear-gradient(135deg, var(--brass-lo), #2a3260 35%, #2a3260 65%, var(--brass-lo)); transition: filter .15s; }
    .su-drow::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(25,36,84,.96), rgba(10,15,40,.97)); transition: background .2s, box-shadow .2s; }
    .su-drow:hover { filter:brightness(1.16); }
    .su-drow-m { width:.62rem; height:.62rem; transform:rotate(45deg); box-shadow: inset 0 0 0 1px var(--fog); transition: background .2s, box-shadow .2s; }
    .su-drow-l { font:400 1.1rem/1.1 var(--font-display); color:var(--ivory); letter-spacing:.03em; }
    .su-drow-t { font-size:.85rem; line-height:1.25; }
    .su-drow[aria-checked=true] { background:linear-gradient(135deg, var(--brass-hi), var(--brass) 45%, var(--brass-lo)); color:var(--ivory); }
    .su-drow[aria-checked=true]::before { background:linear-gradient(180deg, rgba(54,62,120,.97), rgba(21,29,72,.98)); box-shadow: inset 0 0 1.5rem var(--brass-line-1); }
    .su-drow[aria-checked=true] .su-drow-m { background:var(--brass-hi); box-shadow:0 0 8px var(--brass); }
    .su-drow[aria-checked=true] .su-drow-l { color:var(--brass-hi); }
    .su-drow:focus-visible { outline:none; } .su-drow:focus-visible::before { box-shadow: inset 0 0 0 2px var(--cyan); }
    /* remake options (collapsed group) */
    .su-disc { width:100%; margin:0; padding:0; background:none; border:0; border-bottom:1px solid var(--brass-line-2); cursor:var(--hand); text-align:left; transition: margin .3s, padding .3s, border-color .3s; }
    .su-disc:hover { color:#fff6d8; }
    .su-disc:focus-visible { outline:none; box-shadow: inset 0 0 0 2px var(--cyan); }
    .su-disc .sub.changed { color:var(--ember); }
    .su-disc-i { width:1rem; height:1rem; color:var(--brass); transition: transform .28s var(--ease); }
    .su-p-remake.open .su-disc-i { transform:rotate(90deg); }
    .su-p-remake:not(.open) .su-disc { border-bottom-color:transparent; padding-bottom:0; margin-bottom:-.1rem; }
    .su-p-remake { flex:none; }
    .su-collapse { display:grid; grid-template-rows:0fr; transition: grid-template-rows .32s var(--ease); }
    .su-p-remake.open .su-collapse { grid-template-rows:1fr; }
    .su-collapse-in { min-height:0; overflow:hidden; visibility:hidden; transition: visibility 0s .32s; }
    .su-p-remake.open .su-collapse-in { visibility:visible; transition-delay:0s; }
    .su-sub-h { margin:.5rem 0 .3rem; font:400 .8rem var(--font-ui); letter-spacing:.2em; text-transform:uppercase; color:var(--fog); }
    .su-collapse-in > .su-sub-h:first-child { margin-top:.1rem; }
    .su-remake-foot { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-top:.6rem; color:var(--fog); font-size:.8rem; }
    .su-rules { display:grid; grid-template-columns:1fr; gap:.1rem; }
    .su-rules.two { grid-template-columns:1fr 1fr; gap:.4rem .6rem; }
    .su-rules.two .su-optrow { padding:.4rem .6rem; border:0; background:rgba(255,255,255,.03); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); }
    .su-rules.two .su-optrow:hover { background:rgba(255,255,255,.055); }
    .su-optrow { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:.42rem .2rem; border-bottom:1px solid rgba(255,255,255,.05); cursor:var(--hand); }
    .su-optrow:last-child { border-bottom:0; } .su-optrow:hover { background:rgba(255,255,255,.025); }
    .su-optrow-t { display:flex; flex-direction:column; min-width:0; } .su-optrow-t b { font-weight:500; color:var(--ivory); font-size:1rem; }
    .su-optrow-t span { color:var(--mist); font-size:.85rem; line-height:1.25; }
    .su-seed { flex:1; min-width:0; font-size:1rem; letter-spacing:.06em; }
    .su-dice { padding:.4em .7em; } .su-dice .ico { width:1.3em; height:1.3em; margin:0; }
    .field::placeholder { color:var(--fog); }

    /* step 2 */
    .su-roster { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-auto-rows:minmax(5.2rem, 1fr); gap:.55rem; min-height:100%; }
    .su-race { display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:.7rem; padding:.4rem .7rem .4rem .4rem; text-align:left; color:var(--ivory); }
    .su-thumb-w { display:block; height:100%; max-height:6.4rem; min-height:4.2rem; aspect-ratio:1; background:#050818; box-shadow:0 0 0 1px var(--brass-line-3); overflow:hidden; }
    .su-thumb { width:100%; height:100%; }
    .su-race-t { display:flex; flex-direction:column; gap:.15rem; min-width:0; }
    .su-race-n { font:400 1.2rem/1.1 var(--font-display); color:var(--brass-hi); letter-spacing:.03em; }
    .su-race[aria-checked=false] .su-race-n { color:var(--ivory); }
    .su-race-g { color:var(--mist); font-size:.85rem; line-height:1.2; }
    .su-pips { display:flex; gap:3px; margin-top:.2rem; } .su-pips i { width:.5rem; height:.5rem; transform:rotate(45deg) scale(.85); } .su-pips i.good { background:var(--leaf); } .su-pips i.bad { background:var(--rose); }
    .su-detail { display:flex; flex-direction:column; gap:.55rem; min-height:0; }
    .su-d-top { display:grid; grid-template-columns:minmax(0,48%) minmax(0,1fr); gap:1rem; align-items:start; }
    .su-pframe { --ch:.7rem; position:relative; width:100%; max-width:18rem; aspect-ratio:4/5; padding:2px; background:linear-gradient(135deg, var(--brass-hi), var(--brass-lo) 55%, var(--brass)); }
    .su-pframe::after { content:""; position:absolute; inset:2px; pointer-events:none; clip-path:var(--poly);
      background: repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 3px), linear-gradient(180deg, rgba(255,255,255,.09), transparent 24%, transparent 68%, rgba(2,4,14,.38)); }
    .su-pframe.swap { animation: su-swap .5s var(--ease) both; }
    @keyframes su-swap { from { opacity:.2; filter:brightness(1.8) blur(4px); transform:translateY(6px) scale(.985); } to { opacity:1; filter:none; transform:none; } }
    .su-portrait, .su-id-cv { display:block; width:100%; height:100%; background:#050818; }
    .su-homeart { position:relative; margin-top:.3rem; aspect-ratio:16/9; background:#050818; box-shadow:0 0 0 1px var(--brass-line-3); } .su-homeart::after { content:''; position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.7), inset 0 0 1.6rem rgba(0,0,0,.4); } .su-homeart:empty { display:none; } .su-homeart :is(canvas, img) { display:block; width:100%; height:100%; }
    .su-d-info { display:flex; flex-direction:column; gap:.35rem; min-width:0; }
    .su-d-name { margin:0; font:400 clamp(1.7rem, 4vh, 2.3rem)/1 var(--font-title); color:var(--brass-hi); letter-spacing:.03em; overflow-wrap:anywhere; }
    .su-d-tag { color:var(--cyan); font-size:1rem; letter-spacing:.02em; }
    .su-d-desc { margin:.15rem 0 .35rem; color:var(--ivory); opacity:.88; font-size:.95rem; line-height:1.4; }
    .su-facts { display:grid; grid-template-columns:repeat(auto-fit, minmax(6.5rem, 1fr)); gap:.4rem .9rem; } .su-facts.one { grid-template-columns:1fr; }
    .su-facts small { display:block; color:var(--fog); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; } .su-facts b { font-weight:500; color:var(--ivory); } .su-facts span { color:var(--mist); font-size:.9rem; overflow-wrap:anywhere; }
    .su-traits-h { margin-top:.2rem; } .su-traits-h .sub { display:flex; align-items:center; gap:.35rem; }
    .su-key { display:inline-block; width:.55rem; height:.55rem; transform:rotate(45deg) scale(.85); } .su-key.good { background:var(--leaf); } .su-key.bad { background:var(--rose); margin-left:.5rem; }
    .su-traits { display:flex; flex-direction:column; gap:.5rem; }
    .su-trait { display:grid; grid-template-columns:minmax(7.5rem, auto) minmax(0,1fr); align-items:center; gap:.7rem; font-size:.95rem; color:var(--mist); }
    .su-trait .chip { font-size:.9rem; padding:.18em .7em; }
    .su-trait .chip { justify-self:start; }

    /* step 3 */
    .su-banners { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.55rem; }
    .su-banner { display:flex; flex-direction:column; align-items:stretch; gap:.15rem; padding:.45rem .4rem .4rem; }
    .su-banner::after { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--c) 42%, transparent), transparent 74%); pointer-events:none; }
    .su-p-banner { display:flex; flex-direction:column; }
    .su-banner-body { flex:1 1 auto; display:flex; flex-direction:column; min-height:0; }
    .su-ship { display:block; width:100%; height:clamp(3.6rem, 10.5vh, 6.4rem); }
    .su-banner-n { display:flex; align-items:center; justify-content:center; font:400 1rem var(--font-display); color:var(--ivory); letter-spacing:.04em; }
    .su-banner[aria-checked=true] .su-banner-n { color:var(--brass-hi); }
    .su-fleet { position:relative; flex:1 1 auto; min-height:7rem; margin-top:.7rem; background:radial-gradient(ellipse at 50% 70%, color-mix(in srgb, var(--c, #62d8ff) 22%, transparent), transparent 68%), rgba(4,7,22,.75); box-shadow: inset 0 0 0 1px var(--brass-line-2); }
    .su-fleet-cv { position:absolute; inset:0; width:100%; height:100%; }
    .su-fields { display:flex; flex-direction:column; gap:.8rem; }
    .su-field label { display:block; margin-bottom:.3rem; font:400 1rem var(--font-display); color:var(--brass); letter-spacing:.04em; }
    .su-in { flex:1; min-width:0; font-size:1.1rem; padding:.5em .8em; }
    .su-right .su-id { flex:1 1 auto; }
    .su-id { display:grid; grid-template-columns:minmax(0,44%) minmax(0,1fr); gap:1.2rem; align-items:center; }
    .su-pframe.sm { width:100%; max-width:14.5rem; background:linear-gradient(135deg, var(--c, var(--brass)), color-mix(in srgb, var(--c, var(--brass)) 35%, #000)); }
    .su-id-t small { display:block; color:var(--fog); font-size:.7rem; letter-spacing:.14em; text-transform:uppercase; }
    .su-id-name { font:400 clamp(1.5rem, 3.6vh, 2.1rem)/1.05 var(--font-title); color:var(--ivory); margin:.1rem 0 .15rem; overflow-wrap:anywhere; }
    .su-id-race { color:var(--cyan); }
    .su-id-tag { margin:.1rem 0 .9rem; color:var(--mist); font-size:.9rem; }
    .su-id-ban { color:var(--ivory); }

    /* rail */
    .su-rail { min-height:0; overflow-y:auto; padding:2px; }
    .su-rail-body { display:flex; flex-direction:column; }
    .su-rail-empire { display:flex; align-items:center; gap:.75rem; padding:.1rem 0 .55rem; }
    .su-rail-race { font:400 1.3rem/1.1 var(--font-display); color:var(--brass-hi); } .su-rail-leader { color:var(--mist); font-size:.9rem; margin-top:.1rem; }
    .su-rr-h { margin:.5rem 0 .15rem; padding-top:.45rem; border-top:1px solid var(--brass-line-1); font:400 .8rem var(--font-ui); letter-spacing:.2em; text-transform:uppercase; color:var(--fog); }
    .su-rr { display:flex; align-items:baseline; justify-content:space-between; gap:.7rem; width:100%; padding:.22rem .3rem; border:0; background:none; cursor:var(--hand); text-align:left; color:inherit; }
    .su-rr:hover { background:rgba(214,179,106,.1); } .su-rr:focus-visible { outline:none; box-shadow: inset 0 0 0 2px var(--cyan); }
    .su-rr-l { color:var(--mist); font-size:.9rem; flex:none; } .su-rr-v { color:var(--ivory); text-align:right; font-variant-numeric:tabular-nums; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .su-rr-rules { display:flex; flex-wrap:wrap; gap:.3rem; padding:.2rem .3rem .1rem; }
    .su-rule { padding:.08rem .5rem; font-size:.8rem; color:var(--fog); background:rgba(255,255,255,.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); text-decoration:line-through; text-decoration-color:rgba(255,92,106,.55); }
    .su-rule.on { color:var(--brass-hi); background:rgba(214,179,106,.14); box-shadow: inset 0 0 0 1px var(--brass-line-3); text-decoration:none; }

    /* loading overlay */
    .su-loading { position:absolute; inset:0; z-index:20; display:none; place-items:center; background:rgba(3,5,18,.8); backdrop-filter:blur(5px); }
    .su-loading.on { display:grid; animation: scrim-in .25s ease-out both; }
    .su-load-box { display:flex; flex-direction:column; align-items:center; gap:.9rem; text-align:center; }
    .su-orrery { position:relative; width:9.5rem; height:9.5rem; margin-bottom:.6rem; }
    .su-orrery i { position:absolute; border:1px solid var(--brass-line-3); border-radius:50%; }
    .su-orrery i:nth-child(1) { inset:0; animation: su-spin 10s linear infinite; }
    .su-orrery i:nth-child(2) { inset:1.5rem; border-style:dashed; animation: su-spin 7s linear infinite reverse; }
    .su-orrery i:nth-child(3) { inset:3rem; animation: su-spin 4.5s linear infinite; }
    .su-orrery i::after { content:""; position:absolute; top:-.3rem; left:50%; width:.55rem; height:.55rem; margin-left:-.28rem; background:var(--brass-hi); transform:rotate(45deg); box-shadow:0 0 10px var(--brass); }
    .su-orrery b { position:absolute; inset:4rem; border-radius:50%; background:radial-gradient(circle, #fff6d8, var(--brass) 52%, transparent 72%); animation: su-pulse 1.9s ease-in-out infinite; }
    @keyframes su-spin { to { transform:rotate(360deg); } }
    @keyframes su-pulse { 50% { transform:scale(1.35); opacity:.75; } }
    .su-load-title { font:400 2rem var(--font-title); color:var(--brass-hi); letter-spacing:.06em; }
    .su-load-sub { min-height:1.4em; color:var(--mist); }
    .su-load-bar { width:min(20rem, 70vw); height:3px; background:rgba(255,255,255,.08); overflow:hidden; }
    .su-load-bar i { display:block; width:38%; height:100%; background:linear-gradient(90deg, transparent, var(--brass-hi), transparent); animation: su-sweep 1.5s ease-in-out infinite; }
    @keyframes su-sweep { from { transform:translateX(-110%); } to { transform:translateX(290%); } }
    .su-err { margin:.6rem 0 0; padding:.6rem .8rem; max-height:10rem; overflow:auto; white-space:pre-wrap; background:rgba(0,0,0,.35); color:var(--rose); font:.85rem/1.4 Consolas, monospace; }
    html.reduce-motion .su-orrery i, html.reduce-motion .su-orrery b, html.reduce-motion .su-load-bar i { animation:none; }
    @media (prefers-reduced-motion: reduce) { .su-orrery i, .su-orrery b, .su-load-bar i, .su-begin::after { animation:none; } }

    /* narrow windows: drop the rail, stack the columns */
    @media (max-width: 1020px) {
      .su-body { grid-template-columns:minmax(0,1fr); } .su-rail { display:none; }
      .su-s1, .su-s2, .su-s3 { grid-template-columns:minmax(0,1fr); }
      .su-foot-hint { display:none; }
    }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: copper-embossed option plates with black inset value boxes (original options panel), bevelled selection cards, gold selection.
  UI.css('setup-orig', bump(`
    .su-opt, .su-race, .su-banner, .su-drow { background:linear-gradient(135deg, rgba(255,255,255,.34), rgba(255,255,255,.08) 40%, rgba(0,0,0,.7)); }
    .su-opt::before, .su-race::before, .su-banner::before, .su-drow::before { background:linear-gradient(180deg, #232a33, #12161b); box-shadow:inset 1px 1px 0 rgba(255,255,255,.08), inset 0 -2px 6px rgba(0,0,0,.5); }
    .su-opt:hover::before, .su-race:hover::before, .su-banner:hover::before, .su-drow:hover::before { background:linear-gradient(180deg, #2c353f, #181d23); }
    .su-opt[aria-checked=true], .su-race[aria-checked=true], .su-banner[aria-checked=true], .su-drow[aria-checked=true] { background:linear-gradient(135deg, #f0a050, #c86a20 50%, #703010); color:#f4d890; }
    .su-opt[aria-checked=true]::before, .su-race[aria-checked=true]::before, .su-banner[aria-checked=true]::before, .su-drow[aria-checked=true]::before { background:linear-gradient(180deg, #4a2a14, #2a170a); box-shadow:inset 0 0 1.4rem rgba(240,160,80,.22), inset 1px 1px 0 rgba(255,200,140,.25); }
    .su-opt[aria-checked=true] .su-opt-l, .su-drow[aria-checked=true] .su-drow-l { color:#f4d890; text-shadow:0 1px 0 #000; }
    .su-opt[aria-checked=true] .su-opt-n b { color:#b8e0a0; }
    .su-drow[aria-checked=true] .su-drow-m { background:#f0a050; box-shadow:0 0 8px #c86a20; }
    .su-opt-bar u { background:linear-gradient(90deg, #703010, #e08a38); }
    .su-chart { background:#05070a; box-shadow:inset 1px 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.12); }
    .su-pframe { background:linear-gradient(135deg, #f0e8d8, #8a8478 55%, #d8d0c0); }
    .su-foot { border-top-color:rgba(255,255,255,.14); }
  `));
})(window.MOO);
