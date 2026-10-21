// UI kit — DOM builders & widgets shared by every screen. See css/kit.css for styling.
//   UI.h('div.panel.tight#id', {onclick, style:{}, tip:'html'}, ...children)   hyperscript
//   UI.button / panel / bar / slider / table / tabs / modal / alert / confirm / prompt / toast / icon / setTip
//   UI.fitCanvas(canvas)  UI.onFrame(fn)  UI.bindKey('ctrl+s', fn, {screen:'galaxy'})
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, doc = document;

  // ------------------------------------------------------------------ hyperscript
  const TAG_RE = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/;
  const PROPS = { value: 1, checked: 1, selected: 1, disabled: 1, indeterminate: 1, readOnly: 1 };
  const isAttrs = x => x && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Node) && Object.getPrototypeOf(x) === Object.prototype;

  function append(el, kids) {
    for (const k of kids) {
      if (k === null || k === undefined || k === false || k === true) continue;
      if (Array.isArray(k)) append(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else el.appendChild(doc.createTextNode(String(k)));
    }
  }
  function h(tag, ...args) {
    let attrs = null;
    if (args.length && isAttrs(args[0])) attrs = args.shift();
    const m = TAG_RE.exec(tag) || [];
    const el = doc.createElement(m[1] || 'div');
    if (m[2]) m[2].replace(/([.#])([\w-]+)/g, (_, k, v) => { if (k === '.') el.classList.add(v); else el.id = v; return ''; });
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class' || k === 'className') String(v).split(/\s+/).forEach(c => c && el.classList.add(c));
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText += v;
          else for (const sk in v) { if (v[sk] === undefined || v[sk] === null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; }
        } else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'tip') UI.setTip(el, v);
        else if (k.length > 2 && k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (PROPS[k]) el[k] = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    append(el, args);
    return el;
  }
  UI.h = h;
  UI.$ = (sel, root) => (root || doc).querySelector(sel);
  UI.$$ = (sel, root) => Array.from((root || doc).querySelectorAll(sel));
  UI.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  UI.mount = (el, ...kids) => { UI.clear(el); append(el, kids); return el; };

  // ------------------------------------------------------------------ per-module CSS
  // UI.css('galaxy', '.galaxy-panel { ... }')  — injects (or replaces) a <style id="css-galaxy">; lets each screen own its styles.
  // Theme v2 retint: the per-screen stylesheets were written with indigo literals (#0d1540, rgba(8,12,34,.9) ...). In v2 every dark indigo/violet
  // literal is pulled to the cool gunmetal ramp (hue ~210, low saturation) at injection time, so all screens follow the new palette without edits.
  // Bright accents (cyan, azure, violet text, ...) are left alone: only dark/mid, blue-dominant colours with r<=150 and b<=200 are touched.
  function retint(r, g, b) {
    if (!(b > r + 14 && b > g + 5 && r <= 150 && b <= 200)) return null;
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, d = mx - mn, l = (mx + mn) / 2;
    if (!d) return null;
    const sat = d / (1 - Math.abs(2 * l - 1));
    let hue = mx === b / 255 ? 4 + (r - g) / 255 / d : mx === g / 255 ? 2 + (b - r) / 255 / d : ((g - b) / 255 / d + 6) % 6; hue *= 60;
    if (hue < 205 || hue > 295) return null;                       // cyan / teal / green / red families untouched
    const ns = Math.min(sat * 0.36, 0.26), nh = 208 + (hue - 208) * 0.12, nl = l * 0.94, c = (1 - Math.abs(2 * nl - 1)) * ns, hp = nh / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = nl - c / 2;
    const rgb = [0, x, c];                                         // nh is always 208..219 deg -> sector 3 of the hue wheel
    return [Math.round((rgb[0] + m) * 255), Math.round((rgb[1] + m) * 255), Math.round((rgb[2] + m) * 255)];
  }
  const hex2 = n => (n < 16 ? '0' : '') + n.toString(16);
  const BRASS = { f6e3b0: 'dbe7f1', f3dca0: 'd2e0ec', e0c27a: 'a9bccd', d6b36a: '8ea4ba', c9a35c: '7b90a5', a07f3c: '5f758a', '8a7040': '46596c', '6e5830': '34455a' };     // the v1 brass ramp -> steel
  const BRASS_RGB = { '214,179,106': '142,164,186', '243,220,160': '210,224,236', '138,112,64': '70,89,108' };
  UI.retintCss = function (text) {
    text = text.replace(/#(f6e3b0|f3dca0|e0c27a|d6b36a|c9a35c|a07f3c|8a7040|6e5830)\b/gi, (m, h) => '#' + BRASS[h.toLowerCase()])
      .replace(/rgba?\((214|243|138),\s*(179|220|112),\s*(106|160|64)/g, (m, a, b, c) => { const k = a + ',' + b + ',' + c; return BRASS_RGB[k] ? m.slice(0, m.indexOf('(') + 1) + BRASS_RGB[k] : m; });
    return text.replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => { const o = retint(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)); return o ? '#' + hex2(o[0]) + hex2(o[1]) + hex2(o[2]) : m; })
      .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => { const o = retint(+r, +g, +b); return o ? (a ? 'rgba(' : 'rgb(') + o[0] + ',' + o[1] + ',' + o[2] + (a ? a.replace(/\s+/g, '') : '') + ')' : m; });
  };
  UI.css = function (id, text) {
    if (doc.documentElement.getAttribute('data-theme') === 'v2') { try { text = UI.retintCss(text); } catch (e) { /* keep original */ } }
    let s = doc.getElementById('css-' + id);
    if (!s) { s = doc.createElement('style'); s.id = 'css-' + id; doc.head.appendChild(s); }
    s.textContent = text;
  };

  // ------------------------------------------------------------------ sound hook
  UI.sfx = (id, o) => { try { if (M.Audio && M.Audio.SFX && M.Audio.SFX.play) M.Audio.SFX.play(id, o); } catch (e) { /* audio is optional */ } };

  // ------------------------------------------------------------------ icons
  const BUILTIN_ICONS = {
    lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0zm3 4a1.6 1.6 0 0 0-.8 3v2h1.6v-2a1.6 1.6 0 0 0-.8-3z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="square"/>',
    chevron: '<path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" fill="none"/>',
    dot: '<circle cx="12" cy="12" r="4"/>',
  };
  UI.icon = function (name, cls) {
    let svg = null;
    try { const I = M.Gfx && M.Gfx.Icons; if (I && I.has && I.has(name)) svg = I.svg(name); } catch (e) { /* fall through */ }
    if (!svg) svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + (BUILTIN_ICONS[name] || BUILTIN_ICONS.dot) + '</svg>';
    const t = doc.createElement('template');
    t.innerHTML = svg.trim();
    const el = t.content.firstChild;
    el.classList.add('ico');
    if (cls) String(cls).split(/\s+/).forEach(c => c && el.classList.add(c));
    return el;
  };

  // ------------------------------------------------------------------ tooltips
  const tipFns = new WeakMap();
  let tipEl = null, tipTarget = null;
  UI.setTip = function (el, v) {
    if (v === null || v === undefined || v === '') { el.removeAttribute('data-tip'); tipFns.delete(el); return el; }
    if (typeof v === 'function') { tipFns.set(el, v); el.setAttribute('data-tip', '*'); } else { tipFns.delete(el); el.setAttribute('data-tip', v); }
    return el;
  };
  function tipHtml(el) { const f = tipFns.get(el); return f ? f() : el.getAttribute('data-tip'); }
  UI.tipHtml = tipHtml;                                                     // js/ui/phone.js shows tips on long-press
  function placeTip(x, y) {
    const w = tipEl.offsetWidth, hh = tipEl.offsetHeight;
    let l = x + 16, t = y + 18;
    if (l + w > innerWidth - 6) l = x - w - 12;
    if (t + hh > innerHeight - 6) t = y - hh - 12;
    tipEl.style.left = Math.max(4, l) + 'px'; tipEl.style.top = Math.max(4, t) + 'px';
  }
  UI.hideTip = () => { if (tipEl) tipEl.style.display = 'none'; tipTarget = null; };
  function initTips() {
    tipEl = doc.getElementById('tip');
    doc.addEventListener('mouseover', e => {
      const t = e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!t) { if (tipTarget) UI.hideTip(); return; }
      if (t === tipTarget) return;
      const html = tipHtml(t);
      if (!html) { UI.hideTip(); return; }
      tipTarget = t; tipEl.innerHTML = html; tipEl.style.display = 'block'; placeTip(e.clientX, e.clientY);
    });
    doc.addEventListener('mousemove', e => { if (tipTarget) { if (!doc.body.contains(tipTarget)) UI.hideTip(); else placeTip(e.clientX, e.clientY); } });
    doc.addEventListener('mousedown', () => UI.hideTip());
  }

  // ------------------------------------------------------------------ buttons / panels / bars
  UI.button = function (label, onclick, o) {
    o = o || {};
    const cls = ['btn', o.primary && 'primary', o.danger && 'danger', o.small && 'small', o.big && 'big', o.block && 'block', o.active && 'active', o.cls].filter(Boolean).join(' ');
    const b = h('button', { class: cls, type: 'button', disabled: !!o.disabled });
    if (o.icon) b.appendChild(UI.icon(o.icon));
    b.appendChild(doc.createTextNode(label === undefined || label === null ? '' : String(label)));
    if (o.kbd) b.appendChild(h('span.kbd', o.kbd));
    if (o.tip) UI.setTip(b, o.tip);
    b.addEventListener('click', e => { UI.sfx(o.sfx || 'click'); if (onclick) onclick(e); });
    return b;
  };
  UI.panel = function (title, body, o) {
    o = o || {};
    const p = h('div.panel' + (o.cls ? '.' + o.cls.split(/\s+/).join('.') : ''));
    if (title) p.appendChild(h('div.panel-h', o.icon ? UI.icon(o.icon) : null, h('span', title), o.sub ? h('span.sub', o.sub) : null));
    append(p, [body]);
    return p;
  };
  UI.bar = function (frac, o) {
    o = o || {};
    const fill = h('i'), el = h('div.bar' + (o.thick ? '.thick' : ''), { style: o.color ? { '--c': o.color } : null }, fill);
    el.set = (f, label) => {
      fill.style.width = (U.clamp(f, 0, 1) * 100) + '%';
      if (label !== undefined) { let s = el.querySelector('span'); if (!s) { s = h('span'); el.appendChild(s); } s.textContent = label; }
    };
    el.set(frac, o.label);
    return el;
  };
  // original-echo helpers: section heading centred on a rule (kind: 'mint'|'gold'|'red'|'' = amber), recessed numeric readout, title plate
  UI.secHead = (text, kind) => h('div.sec-h' + (kind ? '.' + kind : ''), h('span', text));
  UI.readout = (text, o) => { o = o || {}; return h('span.readout' + (o.cls ? '.' + o.cls.split(/\s+/).join('.') : ''), { style: o.color ? { color: o.color } : null }, text); };
  UI.plate = (text, cls) => h('div.plate' + (cls ? '.' + cls.split(/\s+/).join('.') : ''), text);
  UI.chip = (text, kind) => h('span.chip' + (kind ? '.' + kind : ''), text);

  // ------------------------------------------------------------------ slider
  // value-agnostic slider. onChange(value, byUser). Returns element; element.api = {set,get,setLocked,isLocked,setMax}
  UI.slider = function (o) {
    o = Object.assign({ min: 0, max: 100, step: 1, value: 0, color: 'var(--cyan)', locked: false, label: '', icon: null, fmt: v => v + '%', lockable: true }, o);
    let value = U.clamp(o.value, o.min, o.max), locked = !!o.locked, max = o.max;
    const fill = h('i.s-fill'), knob = h('b.s-knob'), val = h('div.s-val');
    const track = h('div.s-track', { tabindex: 0 }, fill, knob);
    // Shift-click on − / + jumps to the end (min / max) instead of one step
    const minus = h('button.s-btn', { type: 'button', onclick: e => user(e && e.shiftKey ? o.min : value - o.step) }, '−');
    const plus = h('button.s-btn', { type: 'button', onclick: e => user(e && e.shiftKey ? max : value + o.step) }, '+');
    const lock = o.lockable ? h('button.s-lock', { type: 'button', tip: 'Lock this slider', onclick: () => { locked = !locked; draw(); if (o.onLock) o.onLock(locked); } }, UI.icon('lock')) : h('span');
    const root = h('div.slider', { style: { '--c': o.color } },
      h('div.s-label', o.icon ? UI.icon(o.icon) : null, o.label), minus, track, plus, val, lock);
    function draw() {
      const f = (value - o.min) / ((o.max - o.min) || 1);
      fill.style.width = (f * 100) + '%'; knob.style.left = (f * 100) + '%';
      val.textContent = o.fmt(value);
      root.classList.toggle('locked', locked); lock.classList && lock.classList.toggle('on', locked);
    }
    function user(v) {
      if (locked) return;
      v = U.clamp(Math.round(v / o.step) * o.step, o.min, max);
      if (v === value) return;
      value = v; draw(); if (o.onChange) o.onChange(value, true);
    }
    function fromEvent(e) { const r = track.getBoundingClientRect(); user(o.min + U.clamp((e.clientX - r.left) / r.width, 0, 1) * (o.max - o.min)); }
    track.addEventListener('pointerdown', e => { if (locked) return; track.setPointerCapture(e.pointerId); fromEvent(e); track.onpointermove = fromEvent; });
    track.addEventListener('pointerup', () => { track.onpointermove = null; });
    track.addEventListener('pointercancel', () => { track.onpointermove = null; });
    // the wheel anywhere over the slider: one step per notch (up / right = more), Shift five steps; the page does not scroll meanwhile
    root.addEventListener('wheel', e => {
      if (locked) return;
      const d = -(e.deltaY || e.deltaX); if (!d) return;                     // Shift+wheel arrives as deltaX in most browsers: same direction as plain wheel
      e.preventDefault(); user(value + Math.sign(d) * o.step * (e.shiftKey ? 5 : 1));
    }, { passive: false });
    track.addEventListener('keydown', e => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowDown') { user(value - o.step); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'ArrowUp') { user(value + o.step); e.preventDefault(); }
    });
    root.api = {
      set(v) { value = U.clamp(v, o.min, o.max); draw(); },
      get: () => value, setLocked(b) { locked = !!b; draw(); }, isLocked: () => locked,
      setMax(m) { max = m; },
    };
    draw();
    return root;
  };

  // ------------------------------------------------------------------ table
  // cols: [{key,label,align:'l'|'r'|'c',width,value:(row)=>sortValue,fmt:(row,val)=>Node|string,sort:false}]
  UI.table = function (cols, rows, o) {
    o = o || {};
    let sortKey = o.sortKey || null, sortDir = o.sortDir || 1, data = rows || [];
    const thead = h('thead'), tbody = h('tbody'), table = h('table.tbl', thead, tbody);
    const al = c => (c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : '');
    function head() {
      UI.clear(thead);
      const tr = h('tr');
      cols.forEach(c => tr.appendChild(h('th', {
        class: al(c) + (c.sort === false ? '' : ' sortable'), style: c.width ? { width: c.width } : null,
        onclick: () => { if (c.sort === false) return; if (sortKey === c.key) sortDir = -sortDir; else { sortKey = c.key; sortDir = c.dir || 1; } render(); },
      }, (c.label || '') + (sortKey === c.key ? (sortDir > 0 ? ' ▴' : ' ▾') : ''))));
      thead.appendChild(tr);
    }
    function render() {
      head(); UI.clear(tbody);
      const list = data.slice();
      if (sortKey) {
        const c = cols.find(x => x.key === sortKey), get = c && c.value ? c.value : r => r[sortKey];
        list.sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
      }
      if (!list.length && o.empty) { tbody.appendChild(h('tr', h('td.dim.c', { colSpan: cols.length }, o.empty))); return; }
      list.forEach(r => {
        const tr = h('tr', { class: [o.onRow && 'clickable', o.selected && o.selected(r) && 'sel', o.rowClass && o.rowClass(r)].filter(Boolean).join(' ') });
        cols.forEach(c => { const v = c.value ? c.value(r) : r[c.key]; tr.appendChild(h('td', { class: al(c) }, c.fmt ? c.fmt(r, v) : v)); });
        if (o.onRow) tr.addEventListener('click', ev => { UI.sfx('click'); o.onRow(r, ev); });
        if (o.onDbl) tr.addEventListener('dblclick', ev => o.onDbl(r, ev));
        tbody.appendChild(tr);
      });
    }
    table.update = rs => { data = rs; render(); };
    table.render = render;
    render();
    return table;
  };

  // ------------------------------------------------------------------ tabs
  // items: [{id,label,icon,render:()=>Node}] -> {el, body, show(id), current()}
  UI.tabs = function (items, o) {
    o = o || {};
    let cur = null;
    const bar = h('div.tabs'), body = h('div.tab-body' + (o.bodyCls ? '.' + o.bodyCls : ''));
    const el = h('div.tabs-wrap', bar, body);
    const btns = {};
    items.forEach(it => {
      btns[it.id] = h('button', { type: 'button', onclick: () => { UI.sfx('click'); show(it.id); } }, it.icon ? UI.icon(it.icon) : null, it.label);
      bar.appendChild(btns[it.id]);
    });
    function show(id) {
      const it = items.find(x => x.id === id) || items[0];
      cur = it.id;
      for (const k in btns) btns[k].classList.toggle('active', k === it.id);
      UI.mount(body, it.render ? it.render() : null);
      if (o.onChange) o.onChange(cur);
    }
    show(o.initial || items[0].id);
    return { el, body, show, current: () => cur };
  };

  // ------------------------------------------------------------------ modals
  const modalStack = [];
  UI.modal = function (o) {
    o = Object.assign({ title: '', buttons: [{ label: 'OK', value: true, primary: true }], closable: true, width: null, cls: '' }, o);
    const overlay = doc.getElementById('overlay');
    let resolve, entry;
    const p = new Promise(r => { resolve = r; });
    const body = h('div.modal-b'); append(body, [o.body]);
    if (typeof o.body === 'string') body.innerHTML = o.body;
    const foot = (o.buttons && o.buttons.length) ? h('div.modal-f', o.buttons.map(b => UI.button(b.label, () => close(b.value), b))) : null;
    const modal = h('div.modal' + (o.cls ? '.' + o.cls : ''), { style: o.width ? { width: o.width } : null, role: 'dialog' }, o.title ? h('div.modal-h', o.title) : null, body, foot);
    const scrim = h('div.scrim', { onmousedown: e => { if (e.target === scrim && o.closable) close(null); } }, modal);
    function close(v) {
      if (entry.closed) return; entry.closed = true;
      U.remove(modalStack, entry);
      scrim.style.transition = 'opacity .15s'; scrim.style.opacity = '0';
      setTimeout(() => { scrim.remove(); restoreAttention(); }, 150);       // the card / scene underneath gets its pulsing light back
      if (o.onClose) o.onClose(v);
      resolve(v);
    }
    entry = { close, closable: o.closable, closed: false, el: scrim };
    modalStack.push(entry);
    overlay.appendChild(scrim);
    if (o.onOpen) o.onOpen(modal, close);
    // a modal the turn is waiting on (event card, spy report, …) lights its default button: the primary one, or a lone affirmative one
    // (never a lone Cancel / Abort). Modals the player opened (options, menus) stay quiet unless o.attention === true.
    if (foot && o.attention !== false && (o.attention === true || (M.Game && M.Game.busy)) && !modal.querySelector('.needs-answer')) {
      const bs = Array.from(foot.querySelectorAll('.btn')), lone = bs.length === 1 && o.buttons[0] && o.buttons[0].value;
      const def = bs.find(b => b.classList.contains('primary')) || (lone ? bs[0] : null);
      if (def) UI.attention(def, { focus: false });
    }
    if (o.choices) UI.attentionGroup(body.querySelectorAll(o.choices));      // o.choices: selector of the options of a real decision (soft group light)
    const first = modal.querySelector('.btn.primary') || modal.querySelector('input,select,textarea');
    if (first && o.autofocus !== false) setTimeout(() => first.focus && first.focus(), 30);
    p.close = close; p.el = modal;
    return p;
  };
  UI.modalOpen = () => modalStack.length > 0;
  // Waiting-for-input lights (css/kit.css):
  //   UI.attention(el, {focus})  the ONE control that moves the game on (Continue / OK / Next / the card's default answer): a pulsing gold
  //                              light + keyboard focus so Enter/Space act on it (focus:false leaves focus alone). One at a time.
  //   UI.attentionGroup(els)     every option of a real decision with no safe default (Council vote, accept/defy, a treaty offer, a spy
  //                              target): a softer pulse on all of them, so it is clear the game waits without recommending one.
  //   UI.attentionClear(els)     drop the group light once the choice is made (removed elements need nothing).
  // A modal opened over a waiting card takes the light; when it closes the light returns to the control the turn still waits on.
  const attnStack = [];
  UI.attention = function (btn, o) {
    if (!btn) return btn;
    try { doc.querySelectorAll('.needs-answer').forEach(x => { if (x !== btn) x.classList.remove('needs-answer'); }); } catch (e) { /* ignore */ }
    btn.classList.add('needs-answer');
    const i = attnStack.indexOf(btn); if (i >= 0) attnStack.splice(i, 1);
    attnStack.push(btn); if (attnStack.length > 16) attnStack.shift();
    if (!o || o.focus !== false) setTimeout(() => { try { if (btn.isConnected && !btn.disabled && !(doc.activeElement && doc.activeElement.closest && doc.activeElement.closest('.modal') && !btn.closest('.modal'))) btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return btn;
  };
  UI.attentionGroup = function (els) {
    const list = Array.from(els || []).filter(e => e && !e.disabled);
    list.forEach(e => e.classList.add('needs-choice'));
    return list;
  };
  UI.attentionClear = function (els) { Array.from(els || []).forEach(e => e && e.classList.remove('needs-choice', 'needs-answer')); };
  function restoreAttention() {
    if (doc.querySelector('.needs-answer')) return;
    for (let i = attnStack.length - 1; i >= 0; i--) {
      const e = attnStack[i];
      if (!e.isConnected || e.disabled || e.offsetParent === null) { attnStack.splice(i, 1); continue; }
      e.classList.add('needs-answer'); return;
    }
  }
  UI.restoreAttention = restoreAttention;
  UI.closeAllModals = () => modalStack.slice().forEach(m => m.close(null));
  UI.alert = (msg, o) => UI.modal(Object.assign({ title: 'Notice', body: typeof msg === 'string' ? h('p', msg) : msg, buttons: [{ label: 'OK', value: true, primary: true }] }, o));
  UI.confirm = (msg, o) => UI.modal(Object.assign({ title: 'Confirm', body: typeof msg === 'string' ? h('p', msg) : msg, buttons: [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }] }, o)).then(v => !!v);
  UI.prompt = function (msg, def, o) {
    const inp = h('input.field', { type: 'text', value: def || '', style: { width: '100%', marginTop: '.5rem' }, maxlength: (o && o.maxlength) || 40 });
    const pr = UI.modal(Object.assign({ title: 'Enter', body: h('div', h('p', msg), inp), buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: true, primary: true }], autofocus: false }, o));
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') pr.close(true); });
    return pr.then(v => (v ? inp.value.trim() : null));
  };

  // ------------------------------------------------------------------ toasts
  UI.toast = function (msg, kind, ms) {
    const box = doc.getElementById('toasts');
    const t = h('div.toast' + (kind ? '.' + kind : ''), msg);
    box.appendChild(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 360); }, ms || 3200);
    return t;
  };

  // ------------------------------------------------------------------ canvas helpers
  // Sizes the canvas backing store to its CSS box × devicePixelRatio. Returns {ctx,w,h,dpr} with w/h in CSS px.
  UI.fitCanvas = function (canvas, o) {
    o = o || {};
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    // device ratio, capped by the caller (o.maxDpr), the Perf tier (MOO.Perf.q.dpr) and a ~14 Mpx backing-store budget (4K / ultrawide)
    const pq = M.Perf && M.Perf.q && M.Perf.q.dpr > 0 ? M.Perf.q.dpr : 2;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, o.maxDpr || 2, pq, Math.sqrt(14e6 / Math.max(1, w * hh))));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hh * dpr); }
    const ctx = canvas.getContext('2d', o.ctxOpts);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hh, dpr };
  };
  // calls cb(w,h) when el's size changes (and once at start)
  UI.watchSize = function (el, cb) {
    if (typeof ResizeObserver === 'undefined') { cb(el.clientWidth, el.clientHeight); return () => {}; }
    const ro = new ResizeObserver(() => cb(el.clientWidth, el.clientHeight));
    ro.observe(el); return () => ro.disconnect();
  };

  // ------------------------------------------------------------------ frame loop
  const frameFns = [];
  let lastT = 0, looping = false;
  UI.onFrame = fn => { frameFns.push(fn); return () => U.remove(frameFns, fn); };
  UI.rawDt = 0;                                   // the last rAF interval before the 0.1 s clamp (MOO.Perf ignores hidden-tab gaps with it)
  // Display refresh estimate (UI.displayHz()): the 25th percentile of one second of rAF intervals is one display period on any machine that
  // keeps up at least a quarter of the time; on a machine that never keeps up it is the rate frames actually arrive at, which is what the
  // pacer should divide anyway. 60 until the first second is in, then smoothed; clamped to 24..360.
  let hz = 60, hzSeen = false, hzSum = 0; const hzBuf = []; 
  UI.displayHz = () => hz;
  function noteInterval(dt) {
    if (!(dt > 0.001) || dt > 0.25) return;
    hzBuf.push(dt); hzSum += dt;
    if (hzSum < 1 || hzBuf.length < 8) return;
    hzBuf.sort((a, b) => a - b);
    const cand = Math.min(360, Math.max(24, 1 / hzBuf[Math.floor(hzBuf.length * 0.25)]));
    hz = hzSeen ? Math.round((hz + (cand - hz) * 0.5) * 10) / 10 : Math.round(cand * 10) / 10; hzSeen = true;
    hzBuf.length = 0; hzSum = 0;
  }
  // UI.pace(st, fps, dt) → true when this frame should be drawn. st is the caller's own {} (it keeps acc/since); fps the wanted draw rate;
  // dt the loop's frame interval. Draws every display frame when fps is at or above the display rate, otherwise every k-th display frame
  // with k = round(displayHz / fps): an even cadence at the nearest achievable rate. (The former "accumulate, draw when >= 1/fps, reset"
  // gates drew at 48 fps on a 144 Hz monitor, 37.5 on 75 Hz, 45 on 90 Hz, and 30 / 20 for 40 / 24 fps targets on 60 Hz, with the
  // remainder thrown away each draw.) st.dt is the time since the previous draw, for callers that step animations per draw.
  UI.pace = function (st, fps, dt) {
    st.since = (st.since || 0) + dt;
    if (!(fps > 0) || fps >= hz * 0.92) { st.n = 0; st.dt = st.since; st.since = 0; return true; }
    const k = Math.max(1, Math.round(hz / fps));
    st.n = (st.n || 0) + Math.max(1, Math.round(dt * hz));   // display frames elapsed (a missed frame counts as two; rAF jitter rounds away)
    if (st.n < k) return false;
    st.n = 0; st.dt = st.since; st.since = 0;                // surplus after a stall is dropped: one draw, then the cadence again
    return true;
  };
  function loop(ts) {
    const t = ts / 1000, raw = t - lastT, dt = Math.min(0.1, raw); lastT = t;
    UI.rawDt = raw; noteInterval(raw);
    for (const fn of frameFns.slice()) { try { fn(dt, t); } catch (e) { console.error('[frame]', e); } }
    requestAnimationFrame(loop);
  }
  UI.startLoop = () => { if (!looping) { looping = true; requestAnimationFrame(ts => { lastT = ts / 1000; loop(ts); }); } };

  // ------------------------------------------------------------------ hotkeys
  // combos: 'Escape' 'Enter' 'Space' 'F1' 'n' 'ctrl+s' 'shift+Tab'. opts.screen restricts to a screen id; opts.modal allows while modal open.
  const keymap = [];
  UI.bindKey = function (combo, fn, o) {
    const e = { combo: combo.toLowerCase(), fn, o: o || {} };
    keymap.push(e); return () => U.remove(keymap, e);
  };
  function comboOf(e) {
    let k = e.key; if (k === ' ') k = 'space';
    k = k.length === 1 ? k.toLowerCase() : k.toLowerCase();
    return (e.ctrlKey || e.metaKey ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + (e.shiftKey && k.length > 1 ? 'shift+' : '') + k;
  }
  function initKeys() {
    window.addEventListener('keydown', e => {
      const tag = e.target && e.target.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === 'Escape' && modalStack.length) { const top = modalStack[modalStack.length - 1]; if (top.closable) { top.close(null); e.preventDefault(); } return; }
      if (typing && e.key !== 'Escape') return;
      const c = comboOf(e), cur = UI.Screens && UI.Screens.current && UI.Screens.current.id;
      // the most recently registered binding wins: a prompt's own keys (card "N", scene "Space") shadow the screen's
      // and boot-time bindings (Next turn "N", perf overlay "F3") for as long as the prompt is up
      for (const k of keymap.slice().reverse()) {
        if (k.combo !== c) continue;
        if (k.o.screen && k.o.screen !== cur) continue;
        if (modalStack.length && !k.o.modal) continue;
        e.preventDefault(); k.fn(e); return;
      }
    });
  }

  // generic click sound for any .btn / tab (buttons built via UI.button already play their own)
  UI.init = function () {
    initTips(); initKeys();
    doc.addEventListener('click', e => {
      const t = e.target.closest && e.target.closest('.tabs button, .s-btn, .s-lock');
      if (t) UI.sfx('click');
    });
  };
})(window.MOO);
