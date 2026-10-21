// Phone layout layer — the ship design editor (js/ui/design.js). Inert unless <html data-phone> is set; css/phone.css holds the rules.
// The editor's render functions fill fixed containers (design.js buildDom), so the phone editor is a re-arrangement of those same nodes,
// done once on the first entry (listeners and the ui.* references survive the move):
//   pinned header    Cancel / Done · the name field · Library · the hull-space bar and the cost (the budget never scrolls away)
//   scrolling body   hull size + Autofill · the hologram preview · the six stat tiles · components · weapons (each bank a card with a
//                    −10 −1 n +1 +10 Fill stepper, UI.Design.phoneRow) · special devices · the build message · ship look + readouts ·
//                    a fold holding the treasury line, Compare and the advice
//   pinned footer    Clear · Build
// The component pop-up table becomes a sheet of cards under the pinned header (UI.Design.phonePicker, called from design.js renderPopup:
// tap = fit it; what does not fit says how much more space it needs) and the design library a sheet opened from the header.
// design.js exposes what this needs as UI.Design._phone.
(function (M) {
  'use strict';
  const UI = M.UI, G = M.Game, h = UI.h, U = M.Util, D = M.Sim.Design, Q = M.Sim.Q, fmt = U.fmt;
  const active = () => !!(UI.Phone && UI.Phone.active());
  const X = () => UI.Design && UI.Design._phone;
  const KINDS = ['all', 'beam', 'missile', 'torpedo', 'bomb', 'bio'];
  let built = false, dzEl = null, headEl = null, libEl = null, libOpen = false;

  const pinHead = () => { if (dzEl && headEl) dzEl.style.setProperty('--ph-head', headEl.offsetHeight + 'px'); };   // sheets open under the budget strip
  function openLib(on) { libOpen = !!on; if (libOpen) pinHead(); if (libEl) libEl.classList.toggle('on', libOpen); if (libOpen && UI.Phone.hideTip) UI.Phone.hideTip(); }

  function build() {
    if (built) return;
    const x = X(); if (!x) return;
    const scr = UI.Screens.el('design'), dz = scr && scr.querySelector('.dz'); if (!dz) return;
    built = true; dzEl = dz;
    const ui = x.ui, q = sel => dz.querySelector(sel);
    const nameWrap = q('.dz-name'), auto = q('.dz-auto'), pv = q('.dz-pv'), lib = q('.dz-lib'), id = q('.dz-id');
    const wrapOf = el => el.parentElement;                                                   // the <div> holding a .dz-sec title and its list
    const libBtn = UI.button('Library', () => openLib(true), { small: true, tip: 'Your six designs: tap one to use it as the template' });
    headEl = h('div.ph-dz-head', h('div.ph-dz-hrow', ui.cancelBtn, nameWrap, libBtn), ui.spc);
    const fold = h('div.ph-fold', h('button.ph-fold-h', { type: 'button', onclick: () => fold.classList.toggle('open') }, h('span', 'Compare & advice'), h('span.ph-fold-ch', '›')),
      h('div.ph-fold-b', ui.fin, ui.cmp, ui.hints));
    const body = h('div.ph-dz-body', h('div.ph-dz-hulls', ui.hulls, auto), pv, ui.strip, wrapOf(ui.slots), wrapOf(ui.weap), wrapOf(ui.spec), ui.msg, h('div.ph-dz-id', id, ui.read), fold);
    const foot = h('div.ph-dz-foot', ui.clearBtn, ui.build);
    ['.dz-head', '.dz-main', '.dz-right'].forEach(s => { const e = q(s); if (e) e.remove(); });       // the old frames are empty now
    dz.classList.add('ph-dz');
    dz.appendChild(headEl); dz.appendChild(body); dz.appendChild(foot); dz.appendChild(ui.pop);
    // the library: a sheet opened from the header; a card tap loads the design (its own onclick) and closes the sheet
    libEl = lib; lib.classList.add('ph-lib'); dz.appendChild(lib);
    const ph = lib.querySelector('.panel-h'); if (ph) ph.appendChild(UI.button('Close', () => openLib(false), { small: true }));
    lib.addEventListener('click', e => { if (e.target.closest && e.target.closest('.dz-card') && !e.target.closest('.btn')) setTimeout(() => openLib(false), 60); });
    // the preview: a horizontal drag turns the ship (design.js), a vertical one scrolls the page; double-click's reset becomes a button
    const cvw = pv.querySelector('.dz-cvw'), tag = cvw && cvw.querySelector('.tag');
    if (tag) tag.textContent = 'drag to turn';
    if (cvw) cvw.appendChild(h('button.ph-pv-reset', { type: 'button', onclick: () => { x.PV.manual = null; } }, 'reset view'));
    // Escape / Back: the library first, then the picker, then the screen (registered after design.js's own binding, so it is asked first)
    UI.bindKey('Escape', () => { if (libOpen) openLib(false); else if (x.st.popup) x.closePopup(); else x.cancel(); }, { screen: 'design' });
    UI.Phone.backHidden.add('design');                                                       // the header's Cancel / Done is the Back here
    x.PV.refit = true;
  }

  // each weapon bank: a stepper under the weapon (css/phone.css hides the desktop spinner on phones)
  UI.Design.phoneRow = function (rowEl, bank, b, w) {
    if (!active() || !w) return;
    const x = X(); if (!x) return;
    rowEl.appendChild(UI.Phone.stepper({
      get: () => (x.st.draft.weapons[bank].count | 0),
      set: v => x.setCount(bank, v, rowEl),
      max: () => D.maxCount(G.S, G.player(), x.st.draft, bank, x.st.draft.weapons[bank].type),
    }));
  };

  // the pop-up as cards (design.js renderPopup hands over here on phones, with pop.rows already built)
  UI.Design.phonePicker = function (pop) {
    const x = X(), st = x.st, d = st.draft, kind = pop.kind, isW = kind === 'weapon', isMan = kind === 'man', free = st.stats.free;
    const cards = pop.rows.map((row, ri) => {
      const cls = ['ph-pc', row.cur && 'cur', row.none && 'none', !row.owned && 'lock', row.conf && 'conf', row.over && row.owned && !row.conf && 'over'].filter(Boolean).join('.');
      let name, desc = null, chips = [], fit = null, req = null, extra = null;
      if (isMan) {
        name = 'Rating ' + row.cols[0];
        chips = [['speed', row.cols[1]], ['defense', row.cols[2]], ['missile def', row.cols[3]], ['power', row.cols[4]], ['engines', row.cols[5]], ['cost', row.cols[6]], ['space', row.cols[7]]];
        if (row.over) fit = h('span.fit.no', 'does not fit');
      } else if (row.none) name = row.label;
      else {
        const it = row.it, inf = row.info; name = it.name; desc = x.rowDesc(pop, row);
        if (isW) chips.push(['dmg', x.dmgText(it)], ['rng', String(it.range + (it.kind === 'beam' ? (st.stats.rangeBonus | 0) : 0))]);
        chips.push(['cost', inf.cost ? inf.cost + ' BC' : 'free'], ['size', String(inf.space)], ['power', inf.power ? String(inf.power) : '—'], ['space', String(row.space)]);
        if (!row.owned) req = h('div.req', UI.icon('lock'), Q.FIELD_NAMES[it.tech.f] + ' tech level ' + it.tech.l);
        else if (row.conf) req = h('div.req', UI.icon('lock'), 'Only one of this type — remove the other first');
        else if (isW) fit = row.max > 0 ? h('span.fit', 'fits ' + row.max) : h('span.fit.no', 'needs ' + fmt(Math.max(1, row.space - free)) + ' more space');
        else if (row.over) fit = h('span.fit.no', 'needs ' + fmt(Math.max(1, -(row.after ? row.after.free : -1))) + ' more space');
        if (kind === 'special' && it.colonyMin) extra = h('div.ph-pc-x', x.planetTypeStrip(it.colonyMin), ' ', h('span.small', x.settleText(it.colonyMin)));
      }
      return h('div.' + cls, { onclick: () => x.pickRow(ri) },
        h('div.ph-pc-h', row.cur ? h('span.mk', '◆') : null, isW && row.it ? UI.icon(x.KIND_ICON[row.it.kind] || 'weapons') : null, h('span.nm', name), fit),
        desc ? h('div.ph-pc-d', desc) : null, req, extra,
        chips.length ? h('div.ph-pc-c', chips.map(([k, v]) => h('span.chip', h('b', v), ' ' + k))) : null);
    });
    pop.trs = cards;
    const title = 'Select ' + x.POP_TITLE[kind].toLowerCase() + (isW || kind === 'special' ? ' ' + (pop.ref + 1) : '');
    const head = h('div.dz-pop-h', h('span.t', title), h('span.sp'), UI.button('Cancel', () => x.closePopup(), { small: true }));
    const sub = h('div.ph-pop-s', h('span', x.HULL_LABEL[d.hull] + ' hull · free space ', h('b', fmt(free))),
      isMan ? null : h('label.ph-pop-lk', h('input', { type: 'checkbox', checked: !!pop.showLocked, onchange: ev => { pop.showLocked = ev.target.checked; st.prefLocked[kind] = pop.showLocked; x.renderPopup(); } }), 'Show unresearched'));
    const filter = isW ? h('div.dz-kf', KINDS.map(k => h('button.' + (st.prefKind === k ? 'on' : 'off'), { type: 'button', onclick: () => { st.prefKind = k; x.renderPopup(); } },
      k === 'all' ? 'All' : [UI.icon(x.KIND_ICON[k] || 'weapons'), x.KIND_LABEL[k]]))) : null;
    const nOwned = pop.rows.filter(r => r.owned && !r.none).length, nAll = (x.LIST[kind] || []).filter(it => !(it.flags && it.flags.monster)).length;
    pinHead();
    UI.mount(x.ui.pop, head, sub, filter, h('div.ph-pop-b', cards),
      h('div.dz-pfoot', h('span', isMan ? 'Each rating step adds engines and raises defense and combat speed.' : 'Cost, size and power are per unit on this hull.'),
        isMan ? null : h('span', { style: { marginLeft: 'auto' } }, nOwned + ' of ' + nAll + ' researched')));
    x.ui.pop.classList.add('on', 'ph-pop');
    const cur = pop.rows.findIndex(r => r.cur);
    if (cur > 0 && cards[cur]) setTimeout(() => { try { cards[cur].scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }, 0);
  };

  if (M.Bus) M.Bus.on('screen', id => { if (id === 'design') { if (active()) build(); } else openLib(false); });
})(window.MOO);
