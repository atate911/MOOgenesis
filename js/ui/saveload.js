// Save / load slots: full screen ('saveload', params {mode:'save'|'load', from}) and modal (UI.openSaveLoad(mode)).
//   UI.openSaveLoad('save'|'load') -> Promise resolving to {action:'saved'|'loaded', slot} or null when closed without doing anything.
// Two places to keep saves: "This browser" (MOO.Save: auto + 6 slots in localStorage, via MOO.Game.saveSlot / loadSlot) and, when the game is
// hosted with server/moo-saves.py, "Server" (MOO.Save.Server: 6 slots, via MOO.Game.saveServer / loadServer). A toggle switches between them;
// the server is the default when it answers. Export/import use MOO.Save.exportFile / importFile (an imported file is written into a slot
// of your choice, then can be loaded like any other). Needs UI.Controls (setup.js).
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h;
  const C = () => UI.Controls;

  const game = () => M.Game || null;
  function hasGame() { const G = game(); try { return !!(G && typeof G.hasGame === 'function' && G.hasGame()); } catch (e) { return false; } }
  function storageOk() { try { return !!(M.Save && M.Save.available && M.Save.available()); } catch (e) { return false; } }
  const slotName = slot => (slot === 'auto' ? 'Autosave' : 'Slot ' + slot);
  const placeName = (b, slot) => (b.id === 'server' ? 'server ' : '') + slotName(slot);
  const SIZE_NAMES = { small: 'Small', medium: 'Medium', large: 'Large', huge: 'Huge', colossal: 'Colossal' };
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const titleOf = mode => (mode === 'save' ? 'Save game' : 'Load game');

  // the slot's thumbnail: the galaxy sketch saved in its metadata (MOO.Save meta.map: x, y, what the player knew of each star), drawn as a
  // star chart — dim points for unexplored stars, pale for explored free ones, banner colours for owned ones, a ring on the player's capital
  function mapThumb(meta) {
    const m = meta && meta.map, box = h('div.sl-map');
    if (!m || !m.d || typeof atob !== 'function') { box.classList.add('none'); return box; }
    const W = 120, H = 76, dpr = Math.min(2, window.devicePixelRatio || 1), c = h('canvas', { width: Math.round(W * dpr), height: Math.round(H * dpr) }), g = c.getContext('2d');
    box.appendChild(c);
    let raw = ''; try { raw = atob(m.d); } catch (e) { box.classList.add('none'); return box; }
    const cs = getComputedStyle(document.documentElement), emp = [0, 1, 2, 3, 4, 5].map(k => (cs.getPropertyValue('--emp' + k) || '').trim() || '#ccc');
    g.scale(dpr, dpr);
    const pad = 5, k = Math.min((W - 2 * pad) / m.w, (H - 2 * pad) / m.h), ox = (W - m.w * k) / 2, oy = (H - m.h * k) / 2;
    const X = v => ox + v / 255 * m.w * k, Y = v => oy + v / 255 * m.h * k;
    const pts = [];
    for (let i = 0; i + 2 < raw.length; i += 3) pts.push([X(raw.charCodeAt(i)), Y(raw.charCodeAt(i + 1)), raw.charCodeAt(i + 2)]);
    // territory glow first, then the points on top
    g.globalCompositeOperation = 'lighter';
    for (const [x, y, code] of pts) { const o = (code & 63) - 2; if (o < 0) continue; const gr = g.createRadialGradient(x, y, 0, x, y, 11); gr.addColorStop(0, emp[o] + '66'); gr.addColorStop(1, emp[o] + '00'); g.fillStyle = gr; g.fillRect(x - 11, y - 11, 22, 22); }
    g.globalCompositeOperation = 'source-over';
    for (const [x, y, code] of pts) {
      const c0 = code & 63;
      g.fillStyle = c0 >= 2 ? emp[c0 - 2] : c0 === 1 ? 'rgba(232,236,248,.95)' : 'rgba(170,180,215,.55)';
      const r = c0 >= 2 ? 2.3 : c0 === 1 ? 1.6 : 1.15; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
      if (code & 64) { g.strokeStyle = '#f3dca0'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 4.6, 0, 6.2832); g.stroke(); }
    }
    return box;
  }

  function describe(meta) {
    if (!meta) return 'an empty slot';
    const race = meta.race ? C().raceName(meta.race) : 'Unknown';
    return (meta.leader ? meta.leader + ' of the ' : 'the ') + race + ' empire, year ' + (meta.year === undefined ? '?' : C().calendarYear(meta.year));
  }
  const failMessage = () => (storageOk()
    ? 'The save could not be written. Browser storage may be full: delete an old save or export your game to a file, then try again.'
    : 'Browser storage is unavailable (a private window, or site data is blocked), so nothing can be kept between sessions. Use "Export current game" to keep a copy as a file.');
  // Both backends return Promises (or plain values, wrapped by run()) and throw Errors whose message is shown to the player.
  const LOCAL = {
    id: 'local', ok: storageOk,
    list: () => M.Save.list(),
    save: slot => { if (!game().saveSlot(slot)) throw new Error(failMessage()); return true; },
    load: slot => game().loadSlot(slot),
    remove: slot => M.Save.remove(slot),
    read: slot => M.Save.load(slot),
    put: (slot, S) => { if (!M.Save.save(slot, S)) throw new Error(failMessage()); },
  };
  const SERVER = {
    id: 'server', ok: () => true,
    list: () => M.Save.Server.list(),
    save: slot => game().saveServer(slot),
    load: slot => game().loadServer(slot),
    remove: slot => M.Save.Server.remove(slot),
    read: slot => M.Save.Server.load(slot),
    put: (slot, S) => M.Save.Server.save(slot, S),
  };
  const run = fn => { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } };
  const errText = e => String(e && e.message || e);
  let lastWhere = null;                                    // the player's last pick, kept while the page is open
  const exportName = (meta, slot) => ('orion-' + (meta && meta.race || 'save') + '-year' + (meta && meta.year !== undefined ? meta.year : 'x') + '-' + (slot === 'auto' ? 'auto' : 'slot' + slot)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');

  // ------------------------------------------------------------------ the slot browser (shared by screen + modal)
  function buildView(opts) {
    const ctl = C();
    let mode = opts.mode === 'save' ? 'save' : 'load';
    if (mode === 'save' && !hasGame()) mode = 'load';
    let sel = null, entries = [], where = lastWhere || 'local', serverOk = false, busy = false, listErr = null, gen = 0;
    const rows = {};
    const be = () => (where === 'server' ? SERVER : LOCAL);
    const listEl = h('div.sl-list', { role: 'listbox', 'aria-label': 'Save slots' });
    const warnEl = h('div.sl-warns'), countEl = h('span.sl-count');
    const modeSeg = ctl.segmented([{ id: 'save', label: 'Save', disabled: !hasGame() }, { id: 'load', label: 'Load' }], mode, v => { mode = v; render(); if (opts.onMode) opts.onMode(mode); }, { label: 'Mode' });
    const whereSeg = ctl.segmented([{ id: 'server', label: 'Server' }, { id: 'local', label: 'This browser' }], where, v => { where = lastWhere = v; sel = null; refresh(); }, { label: 'Saves kept on' });
    const whereEl = h('div.sl-where.hide', whereSeg);
    const fileIn = h('input.hide', { type: 'file', accept: '.json,application/json,text/plain', onchange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importFile(f); } });
    const importBtn = ctl.hotkey(ctl.iconButton('Import from file…', 'import', () => fileIn.click(), { small: true }), 'i');
    const exportBtn = ctl.hotkey(ctl.iconButton('Export current game', 'export', exportCurrent, { small: true }), 'e');
    const el = h('div.sl', h('div.sl-bar', modeSeg, whereEl, countEl), warnEl, listEl, h('div.sl-tools', importBtn, exportBtn, fileIn));

    const finish = res => { if (opts.onDone) opts.onDone(res); };
    const entryOf = slot => entries.find(e => e.slot === slot);

    // ---- actions
    function doSave(slot) {
      const G = game();
      if (!G || typeof G.saveSlot !== 'function' || !hasGame()) { UI.alert('There is no game in progress to save.', { title: 'Cannot save' }); return; }
      const e = entryOf(slot), b = be();
      const write = () => {
        if (busy) return;
        busy = true;
        run(() => b.save(slot)).then(() => {
          busy = false;
          UI.toast('Game saved to ' + placeName(b, slot), 'ok');
          finish({ action: 'saved', slot });
        }, err => { busy = false; console.error('[saveload] save failed', err); UI.alert(errText(err), { title: 'Save failed' }); refresh(); });
      };
      if (e && e.meta) ctl.confirmDanger('Overwrite save?', 'Overwrite ' + placeName(b, slot) + ' (' + describe(e.meta) + ') with the current game?', 'Overwrite', true).then(yes => { if (yes) write(); });
      else write();
    }
    function doLoad(slot) {
      const G = game();
      if (!G || typeof G.loadSlot !== 'function') { UI.alert('The game engine is not available yet, so nothing can be loaded.', { title: 'Cannot load' }); return; }
      const b = be();
      const go = () => {
        if (busy) return;
        busy = true;
        run(() => b.load(slot)).then(ok => {
          busy = false;
          if (!ok) throw new Error('That save could not be loaded. It may be damaged or from an incompatible version.');
          finish({ action: 'loaded', slot });
        }).catch(err => { busy = false; console.error('[saveload] load failed', err); UI.alert(errText(err), { title: 'Load failed' }); refresh(); });
      };
      if (hasGame() && opts.from !== 'menu') ctl.confirmDanger('Load ' + slotName(slot) + '?', 'Loading replaces the game in progress. Anything since your last save will be lost.', 'Load', true).then(yes => { if (yes) go(); });
      else go();
    }
    function doDelete(slot) {
      const e = entryOf(slot), b = be();
      if (!e || !e.meta) return;
      ctl.confirmDanger('Delete save', 'Delete ' + placeName(b, slot) + ' (' + describe(e.meta) + ')? This cannot be undone.', 'Delete', false).then(yes => {
        if (!yes) return;
        run(() => b.remove(slot)).then(() => UI.toast(placeName(b, slot) + ' deleted'), err => UI.alert(errText(err), { title: 'Delete failed' })).then(refresh);
      });
    }
    function doExport(slot) {
      const e = entryOf(slot);
      run(() => be().read(slot)).catch(() => null).then(S => {
        if (!S) { UI.alert('That save could not be read, so it cannot be exported.', { title: 'Export failed' }); return; }
        try { M.Save.exportFile(S, exportName(e && e.meta, slot)); UI.toast('Save exported to a file', 'ok'); } catch (err) { UI.alert('The file could not be created: ' + errText(err), { title: 'Export failed' }); }
      });
    }
    function exportCurrent() {
      const G = game();
      if (!G || !G.S) { UI.alert('There is no game in progress to export.', { title: 'Cannot export' }); return; }
      try { M.Save.exportFile(G.S, exportName(M.Save.meta(G.S), 'current')); UI.toast('Game exported to a file', 'ok'); } catch (err) { UI.alert('The file could not be created: ' + (err && err.message || err), { title: 'Export failed' }); }
    }
    function chooseSlot(meta) {
      const manual = entries.filter(e => e.slot !== 'auto');
      const firstFree = manual.find(e => !e.meta) || manual[0];
      const select = h('select.field', { style: { width: '100%', marginTop: '.5rem' } }, manual.map(e => h('option', { value: e.slot, selected: e === firstFree }, slotName(e.slot) + ' — ' + (e.meta ? 'replace ' + describe(e.meta) : 'empty'))));
      const warn = h('p.sl-importwarn');
      const upd = () => { const e = entryOf(select.value); warn.textContent = e && e.meta ? 'The existing save in ' + slotName(select.value) + ' will be overwritten.' : ''; };
      select.addEventListener('change', upd); upd();
      return UI.modal({
        title: 'Import save file',
        body: h('div', h('p', 'This file holds ' + describe(meta) + (meta.turn !== undefined ? ', turn ' + meta.turn : '') + '. Choose the slot to put it in:'), select, warn),
        buttons: [{ label: 'Cancel', value: null }, { label: 'Import', value: true, primary: true }],
      }).then(v => (v ? select.value : null));
    }
    function importFile(file) {
      const b = be();
      if (!b.ok()) { UI.alert('Importing needs browser storage, which is unavailable here.', { title: 'Cannot import' }); return; }
      M.Save.importFile(file).then(S => {
        const meta = M.Save.meta(S);
        return chooseSlot(meta).then(slot => {
          if (!slot) return;
          return run(() => b.put(slot, S)).then(() => {
            sel = slot; refresh();
            UI.toast('Imported into ' + placeName(b, slot), 'ok');
          }, err => UI.alert(errText(err), { title: 'Import failed' }));
        });
      }, err => UI.alert(h('div', h('p', 'That file is not a valid saved game.'), h('p.dim', errText(err))), { title: 'Import failed' }));
    }
    const primary = slot => {
      if (mode === 'save') { if (slot === 'auto') UI.toast('The autosave slot is written automatically at the start of every turn.', 'warn'); else if (be().ok()) doSave(slot); }
      else { const e = entryOf(slot); if (e && e.meta) doLoad(slot); }
    };

    // ---- rendering
    function select(slot, scroll) {
      sel = slot;
      Object.keys(rows).forEach(k => rows[k].classList.toggle('sel', k === slot));
      if (scroll && rows[slot]) { rows[slot].scrollIntoView({ block: 'nearest' }); rows[slot].focus({ preventScroll: true }); }
    }
    function iconBtn(name, tip, fn, cls) {
      const b = h('button.sl-ib' + (cls ? '.' + cls : ''), { type: 'button', tip, 'aria-label': tip, onclick: e => { e.stopPropagation(); UI.sfx('click'); fn(); } }, ctl.icon(name));
      return b;
    }
    function rowEl(e) {
      const { slot, meta } = e, auto = slot === 'auto';
      const actions = h('div.sl-act');
      if (mode === 'save') {
        const b = UI.button(meta ? 'Overwrite' : 'Save here', () => doSave(slot), { small: true, primary: !meta, disabled: auto || !be().ok() });
        actions.appendChild(auto ? h('span', { tip: 'The autosave slot is written automatically at the start of every turn.' }, b) : b);
      } else if (meta) actions.appendChild(UI.button('Load', () => doLoad(slot), { small: true, primary: true }));
      if (meta) actions.append(iconBtn('export', 'Export to a file', () => doExport(slot)), iconBtn('trash', 'Delete', () => doDelete(slot), 'del'));
      const slotCol = h('div.sl-slot', h('span.sl-slot-n', slotName(slot)), auto ? h('span.sl-slot-t', 'every turn') : null);
      let mid;
      if (meta) {
        const race = meta.race ? ctl.raceName(meta.race) : 'Unknown';
        const size = SIZE_NAMES[meta.size] || (meta.size ? U.cap(String(meta.size)) : null);
        mid = [
          h('div.sl-badge', meta.race ? ctl.raceBadge(meta.race, 2.9, meta.color) : h('div.sl-nobadge')),
          mapThumb(meta),
          h('div.sl-main.a', h('div.sl-lead', h('b', meta.leader || 'Unnamed emperor'), h('span', race)), h('div.sl-sub', 'Year ' + (meta.year === undefined ? '?' : ctl.calendarYear(meta.year)) + ' · Turn ' + (meta.turn === undefined ? '?' : meta.turn))),
          h('div.sl-main.b', h('div.sl-lead', h('span.t-ivory', plural(meta.planets || 0, 'colony', 'colonies'))),
            h('div.sl-sub', [size ? size + (meta.stars ? ' · ' + meta.stars + ' stars' : '') : null, meta.difficulty ? U.cap(String(meta.difficulty)) : null].filter(Boolean).join(' · ') || '—')),
          h('div.sl-time', { tip: meta.at ? new Date(meta.at).toLocaleString() : null }, meta.at ? ctl.ago(meta.at) : ''),
        ];
      } else mid = [h('div.sl-badge', h('div.sl-nobadge')), h('div.sl-map.none'), h('div.sl-empty', 'Empty slot'), h('div.sl-time')];
      if (!actions.childNodes.length) actions.classList.add('none');
      const row = h('div.cx.sl-row' + (meta ? '' : '.empty'), { role: 'option', tabindex: 0, dataset: { slot }, onclick: () => select(slot), ondblclick: () => primary(slot) }, slotCol, mid, actions);
      return row;
    }
    const emptySlots = () => (where === 'server' ? M.Save.Server.SLOTS : M.Save.SLOTS).map(s => ({ slot: s, meta: null }));
    function refresh() {
      const my = ++gen;                                    // a slower, older listing must not overwrite a newer one
      run(() => be().list()).then(list => { listErr = null; return list; }, err => { listErr = errText(err); return []; }).then(list => {
        if (my !== gen) return;
        entries = list && list.length ? list : emptySlots();
        render();
      });
    }
    function render() {
      if (mode === 'save' && !hasGame()) mode = 'load';
      whereEl.classList.toggle('hide', !serverOk);
      whereSeg.set(where);
      modeSeg.set(mode);
      UI.clear(listEl); Object.keys(rows).forEach(k => delete rows[k]);
      entries.forEach(e => { rows[e.slot] = rowEl(e); listEl.appendChild(rows[e.slot]); });
      if (!sel || !rows[sel]) { const first = entries.find(e => e.meta && e.slot !== 'auto') || entries.find(e => e.meta) || entries.find(e => e.slot !== 'auto') || entries[0]; sel = first && first.slot; }
      select(sel);
      const used = entries.filter(e => e.meta).length;
      countEl.textContent = used + ' of ' + entries.length + ' slots in use';
      UI.clear(warnEl);
      if (listErr) warnEl.appendChild(h('div.sl-warn', ctl.icon('warn'), h('div', h('b', 'The saves could not be listed.'), ' ' + listErr)));
      else if (where === 'local' && !storageOk()) warnEl.appendChild(h('div.sl-warn', ctl.icon('warn'), h('div', h('b', 'Browser storage is unavailable.'), ' Saves cannot be kept between sessions (private window, or site data blocked). You can still export your game to a file and import it later.')));
      importBtn.disabled = !be().ok();
      exportBtn.disabled = !hasGame();
    }
    entries = emptySlots(); render();
    refresh();
    M.Save.Server.probe().then(ok => {                    // the server is the default home for saves once it answers
      serverOk = ok;
      if (ok && !lastWhere) where = 'server';
      if (!ok) where = 'local';
      sel = null; refresh();
    });

    function move(d) {
      const keys = entries.map(e => e.slot), i = keys.indexOf(sel);
      select(keys[U.clamp((i < 0 ? 0 : i) + d, 0, keys.length - 1)], true);
      return true;
    }
    return {
      el, refresh,
      get mode() { return mode; },
      // keys: arrows move, Enter / Space = OK on the selected slot, Delete removes it, I / E = import / export
      bindKeys(scopeEl) {
        const ok = () => { if (sel) primary(sel); return true; };
        const off1 = ctl.keyScope(scopeEl, { ArrowDown: () => move(1), ArrowUp: () => move(-1), Enter: ok, ' ': ok, Delete: () => { if (sel) doDelete(sel); return true; } });
        const off2 = ctl.hotkeys(scopeEl, { i: importBtn, e: exportBtn });
        return () => { off1(); off2(); };
      },
    };
  }

  // ------------------------------------------------------------------ modal
  UI.openSaveLoad = function (mode) {
    const ctl = C();
    let pm = null;
    const view = buildView({ mode, from: 'game', onMode: m => { const t = pm && pm.el.querySelector('.modal-h'); if (t) t.textContent = titleOf(m); }, onDone: res => pm && pm.close(res) });
    const closeBtn = ctl.hotkey(UI.button('Close', () => pm.close(null), { kbd: 'Esc' }), 'c');
    const body = h('div.sl-modal-body', view.el, h('div.sl-foot', h('span.sl-foot-hint', 'Up / Down to choose a slot · Enter or Space to confirm · Delete to remove'), h('span.grow'), closeBtn));
    pm = UI.modal({ title: titleOf(view.mode), body, buttons: [], width: 'min(95vw, 64rem)', cls: 'sl-modal' });
    const off1 = view.bindKeys(pm.el), off2 = ctl.hotkeys(pm.el, { c: closeBtn }), off3 = ctl.trapFocus(pm.el);
    ctl.rightClick(pm.el.parentNode, () => pm.close(null));
    pm.then(() => { off1(); off2(); off3(); });
    return pm;
  };

  // ------------------------------------------------------------------ full-screen variant
  let bg = null, holder = null, titleEl = null, view = null, from = 'menu', rootEl = null, unbind = null;
  function goBack() {
    const target = UI.Screens.has(from) ? from : (UI.Screens.has('menu') ? 'menu' : null);
    if (target) UI.Screens.go(target); else UI.toast('Nowhere to go back to', 'warn');
  }
  UI.Screens.register('saveload', {
    create(el) {
      rootEl = el;
      bg = UI.Sky && UI.Sky.el ? null : C().backdrop('ui');           // the one sky shows through; the painted one is the fallback
      holder = h('div.sl-holder');
      titleEl = h('h1.ctl-title', 'Load game');
      const ctl = C(), backBtn = ctl.hotkey(UI.button('Back', goBack, { primary: true, big: true, kbd: 'Esc' }), 'b');
      el.appendChild(h('div.sl-wrap', bg, h('div.ctl-shade'),
        h('div.sl-frame', h('div.sl-inner',
          h('header.sl-head', h('div.ctl-eyebrow', 'Master of Orion'), titleEl),
          holder,
          h('footer.sl-foot', h('span.sl-foot-hint', 'Up / Down to choose a slot · Enter or Space to confirm · Delete to remove · right-click to go back'), h('span.grow'), backBtn)))));
      ctl.rightClick(el, goBack);
      ctl.hotkeys(el, { b: backBtn });
    },
    enter(params) {
      params = params || {};
      from = params.from || 'menu';
      if (bg) bg.paint();
      if (unbind) unbind();
      view = buildView({
        mode: params.mode, from,
        onMode: m => { titleEl.textContent = titleOf(m); },
        onDone: res => { if (res && res.action === 'saved') goBack(); },     // Game.loadSlot switches screens itself
      });
      titleEl.textContent = titleOf(view.mode);
      UI.mount(holder, view.el);
      unbind = view.bindKeys(rootEl);
    },
    resize() { if (bg) bg.paint(); },
  });
  UI.bindKey('Escape', goBack, { screen: 'saveload' });

  UI.css('saveload', `
    .sl-wrap { position:absolute; inset:0; overflow:hidden; background:var(--void); }
    .sl-frame { position:absolute; inset:0; display:flex; justify-content:center; padding: clamp(1rem, 5vh, 3.4rem) 1.5rem clamp(.8rem, 2.4vh, 1.4rem); }
    .sl-inner { width:min(100%, 66rem); display:flex; flex-direction:column; gap:.9rem; min-height:0; }
    .sl-head { flex:none; }
    .sl-holder { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
    .sl-foot { flex:none; display:flex; align-items:center; gap:.7rem; padding-top:.75rem; border-top:1px solid rgba(214,179,106,.28); }
    .sl-modal .sl-foot { margin-top:.8rem; }
    .sl-foot-hint { color:var(--fog); font-size:.85rem; }
    .sl { display:flex; flex-direction:column; gap:.7rem; min-height:0; flex:1 1 auto; }
    .sl-bar { display:flex; align-items:center; gap:.8rem; flex:none; }
    .sl-count { margin-left:auto; color:var(--mist); font-size:.9rem; }
    .sl-tools { display:flex; gap:.6rem; flex:none; }
    .sl-warns:empty { display:none; }
    .sl-warn { display:flex; align-items:flex-start; gap:.7rem; padding:.6rem .85rem; color:var(--ember); font-size:.92rem; line-height:1.35; background:rgba(255,148,64,.08); box-shadow: inset 0 0 0 1px rgba(255,148,64,.42); }
    .sl-warn .ico { width:1.3rem; height:1.3rem; flex:none; margin-top:.1rem; }
    .sl-warn b { color:#ffc08a; font-weight:600; }
    .sl-list { display:flex; flex-direction:column; gap:.45rem; min-height:0; flex:1 1 auto; overflow-y:auto; overflow-x:hidden; padding:2px 6px 2px 2px; }
    .sl-modal .sl-list { max-height:min(60vh, 34rem); }
    .sl-row { --ch:0; position:relative; isolation:isolate; flex:none; display:grid; grid-template-columns:6.6rem 3rem 5.6rem minmax(0,1.25fr) minmax(0,1.2fr) 6.2rem auto; align-items:center; gap:.9rem;
      padding:.34rem .9rem .34rem .8rem; cursor:var(--hand); outline:none; background:linear-gradient(135deg, var(--brass-lo), #2a3260 35%, #2a3260 65%, var(--brass-lo)); transition: filter .15s; }
    .sl-row::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(24,34,80,.96), rgba(10,15,40,.97)); transition: background .2s, box-shadow .2s; }
    .sl-row:hover { filter:brightness(1.14); }
    .sl-row.sel { background:linear-gradient(135deg, var(--brass-hi), var(--brass) 45%, var(--brass-lo)); }
    .sl-row.sel::before { background:linear-gradient(180deg, rgba(54,62,120,.97), rgba(21,29,72,.98)); box-shadow: inset 0 0 1.6rem rgba(214,179,106,.18); }
    .sl-row:focus-visible::before { box-shadow: inset 0 0 0 2px var(--cyan); }
    .sl-row.empty { opacity:.78; }
    .sl-slot { display:flex; flex-direction:column; min-width:0; }
    .sl-slot-n { font:400 1.15rem/1.1 var(--font-display); color:var(--brass-hi); letter-spacing:.03em; }
    .sl-slot-t { margin-top:.1rem; font-size:.68rem; letter-spacing:.16em; text-transform:uppercase; color:var(--fog); }
    .sl-badge { display:grid; place-items:center; }
    .sl-nobadge { width:2.9rem; height:2.9rem; border:1px dashed rgba(214,179,106,.3); border-radius:50%; }
    .sl-main { min-width:0; display:flex; flex-direction:column; gap:.12rem; }
    .sl-lead { display:flex; align-items:baseline; gap:.5rem; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sl-lead b { font-weight:500; font-size:1.08rem; color:var(--ivory); overflow:hidden; text-overflow:ellipsis; }
    .sl-lead span { color:var(--mist); font-size:.92rem; }
    .sl-sub { color:var(--mist); font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-variant-numeric:tabular-nums; }
    .sl-empty { grid-column:span 2; color:var(--fog); font:400 1.05rem var(--font-display); letter-spacing:.04em; }
    .sl-time { text-align:right; color:var(--mist); font-size:.88rem; white-space:nowrap; }
    .sl-act { display:flex; align-items:center; justify-content:flex-end; gap:.35rem; min-width:7.2rem; }
    .sl-ib { display:grid; place-items:center; width:1.9rem; height:1.9rem; padding:0; border:1px solid rgba(214,179,106,.38); background:rgba(255,255,255,.04); color:var(--brass-hi); cursor:var(--hand); transition: background .15s, color .15s, border-color .15s; }
    .sl-ib .ico { width:1.1rem; height:1.1rem; }
    .sl-ib:hover { background:rgba(214,179,106,.2); } .sl-ib.del:hover { background:rgba(255,92,106,.18); color:var(--rose); border-color:var(--rose); }
    .sl-ib:focus-visible { outline:none; box-shadow: inset 0 0 0 2px var(--cyan); }
    .sl-importwarn { margin:.5rem 0 0; min-height:1.2em; color:var(--ember); font-size:.9rem; }
    .sl-map { width:5.6rem; height:3.55rem; background:radial-gradient(ellipse at 50% 50%, #121a3c, #060a1c); box-shadow:inset 0 0 0 1px rgba(214,179,106,.28); }
    .sl-map canvas { display:block; width:100%; height:100%; }
    .sl-map.none { background:none; box-shadow:inset 0 0 0 1px rgba(214,179,106,.14); }
    /* narrow (phones, small windows): a card — the map, the slot with its leader and year beside it, the buttons on a line of their own. The old
       four-column row squeezed the leader and year to nothing beside the buttons and hid an empty slot's "Save here" */
    @media (max-width: 900px) {
      .sl-row { grid-template-columns:5.6rem minmax(0,1fr); grid-template-areas:"map slot" "map main" "act act"; row-gap:.25rem; column-gap:.8rem; padding:.5rem .8rem; }
      .sl-row > .sl-badge, .sl-row > .sl-main.b, .sl-row > .sl-time { display:none; }
      .sl-row > .sl-map { grid-area:map; align-self:center; } .sl-row > .sl-slot { grid-area:slot; flex-direction:row; align-items:baseline; gap:.6rem; }
      .sl-row > .sl-main.a, .sl-row > .sl-empty { grid-area:main; } .sl-row > .sl-act { grid-area:act; justify-content:flex-start; min-width:0; }
      .sl-row > .sl-act.none { display:none; }
    }
  `);
})(window.MOO);
