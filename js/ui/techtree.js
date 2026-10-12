// Tech overview (research/06 §13 "tech tree view, search, ETA per tech"): all six fields as columns of ten tiers.
//   MOO.UI.TechTree.create({onPick(field, level), onClose}) -> {el, refresh(), focusSearch(), select(field, level)}      (the tab inside the Tech screen)
//   screen 'techtree' params {from, field, level}                                                                       (the same view full-screen)
// Every technology of your own random tree is shown as researched / under way / available now / queued (visible tier, beyond the 12-entry choose list) /
// locked (tier not unlocked yet); technologies that exist in the game but not in YOUR tree show as '?' (research/02 §1.7: each empire gets about half).
// Reads Sim.Research + Data.Techs + the helpers exported by tech.js (UI.TechInfo / UI.TechArt); changes only through the researchPick order (opts.onPick).
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, G = M.Game, doc = document;
  const clamp = U.clamp, fmt = U.fmt, min = Math.min, max = Math.max, round = Math.round;
  const TI = () => UI.TechInfo, RS = () => M.Sim.Research, TD = () => M.Data.Techs;
  const reduced = () => !!(M.Settings && M.Settings.get('reduceMotion')) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PQ = () => (M.Perf && M.Perf.q) || { dpr: 1.5, animFps: 60 };

  UI.css('techtree', `
    .tt { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0, 1fr) clamp(19rem, 25vw, 25rem); gap:.85rem; }
    .tt-main { min-width:0; min-height:0; display:flex; flex-direction:column; }
    .tt-bar { flex:none; display:flex; align-items:center; flex-wrap:wrap; gap:.5rem .9rem; padding:0 0 .55rem; }
    .tt-search { position:relative; display:flex; align-items:center; }
    .tt-search input { min-width:16rem; padding-right:2rem; }
    .tt-search .x { position:absolute; right:.35rem; width:1.4rem; height:1.4rem; padding:0; border:0; background:none; color:var(--mist); cursor:pointer; font-size:1rem; line-height:1; }
    .tt-search .x:hover { color:var(--ivory); }
    .tt-count { color:var(--mist); font-size:.88rem; min-width:7rem; }
    .tt-leg { margin-left:auto; display:flex; align-items:center; flex-wrap:wrap; gap:.3rem 1rem; font-size:.8rem; color:var(--mist); }
    .tt-leg span { display:inline-flex; align-items:center; gap:.35rem; }
    .tt-leg i { display:inline-block; width:.85rem; height:.85rem; border-left:3px solid var(--sw); background:rgba(255,255,255,.06); }
    .tt-leg i.unk { border:1px dashed var(--fog); border-left:1px dashed var(--fog); background:none; }
    .tt-scroll { position:relative; flex:1 1 auto; min-height:0; overflow:auto; padding-right:.2rem; background:rgba(5,8,26,.4); box-shadow:inset 0 0 0 1px rgba(214,179,106,.2); }
    .tt-grid { display:grid; grid-template-columns:3.3rem repeat(6, minmax(8.4rem, 1fr)); gap:0 .3rem; }
    .tt-h { position:sticky; top:0; z-index:3; display:flex; align-items:center; gap:.45rem; padding:.45rem .55rem .4rem; background:#0b1236; border-bottom:2px solid var(--fc); }
    .tt-h.corner { left:0; z-index:4; }
    .tt-h .ico { width:1.25rem; height:1.25rem; flex:none; color:var(--fc); }
    .tt-h b { font:400 1.02rem/1.1 var(--font-display); color:var(--ivory); white-space:nowrap; }
    .tt-h small { margin-left:auto; color:var(--mist); font-size:.74rem; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .tt-tier { position:sticky; left:0; z-index:2; display:flex; flex-direction:column; align-items:center; padding:.5rem 0 0; background:#0b1236; border-top:1px solid rgba(214,179,106,.18); font:400 .95rem/1.1 var(--font-display); color:var(--brass); }
    .tt-tier small { font:400 .68rem var(--font-ui); color:var(--fog); }
    .tt-tier.adv { color:var(--gold); }
    .tt-cell { display:flex; flex-direction:column; gap:.2rem; min-width:0; padding:.3rem .1rem .3rem; border-top:1px solid rgba(214,179,106,.18); }
    .tt-chip { position:relative; display:flex; align-items:center; gap:.4rem; min-width:0; padding:.22rem .45rem; border-left:3px solid var(--sw, transparent); background:rgba(255,255,255,.045); cursor:pointer;
      font-size:.84rem; line-height:1.12; transition:background .1s, opacity .12s; }
    .tt-chip .ico { width:.95rem; height:.95rem; flex:none; color:var(--sw); opacity:.9; }
    .tt-chip .nm { flex:1; min-width:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .tt-chip .lv { flex:none; font-size:.68rem; color:var(--fog); font-variant-numeric:tabular-nums; }
    .tt-chip:hover { background:rgba(98,216,255,.12); }
    .tt-chip.sel { background:rgba(214,179,106,.22); box-shadow:inset 0 0 0 1px var(--brass); }
    .tt-chip.done { --sw:var(--leaf); background:rgba(95,220,143,.08); } .tt-chip.done .nm { color:var(--ivory); }
    .tt-chip.proj { --sw:var(--cyan); background:rgba(98,216,255,.16); box-shadow:inset 0 0 0 1px rgba(98,216,255,.55); animation:tt-pulse 2.2s ease-in-out infinite; }
    .tt-chip.avail { --sw:var(--brass-hi); background:rgba(214,179,106,.1); } .tt-chip.avail .nm { color:var(--brass-hi); }
    .tt-chip.queued { --sw:var(--brass-lo); } .tt-chip.queued .nm { color:var(--mist); }
    .tt-chip.locked { --sw:var(--fog); opacity:.5; } .tt-chip.locked .nm { color:var(--mist); }
    .tt-chip.miss { opacity:.16; } .tt-chip.hit { box-shadow:inset 0 0 0 1px var(--cyan); background:rgba(98,216,255,.14); opacity:1; }
    .tt-unk { display:flex; flex-wrap:wrap; gap:.2rem; }
    .tt-q { display:inline-grid; place-items:center; width:1.5rem; height:1.25rem; border:1px dashed var(--fog); color:var(--fog); font-size:.8rem; cursor:help; }
    .tt-q:hover { color:var(--mist); border-color:var(--mist); }
    @keyframes tt-pulse { 50% { box-shadow:inset 0 0 0 1px rgba(98,216,255,.55), 0 0 12px rgba(98,216,255,.35); } }
    .tt-side { min-height:0; display:flex; flex-direction:column; }
    .tt-side .panel { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; padding:.7rem .8rem; overflow:hidden; }
    .tt-art { flex:none; width:100%; height:11rem; display:block; background:#040715; box-shadow:0 0 0 1px rgba(214,179,106,.4); margin-bottom:.6rem; }
    .tt-d { flex:1 1 auto; min-height:0; overflow-y:auto; padding-right:.2rem; }
    .tt-d .tn { font:400 1.35rem/1.12 var(--font-title); color:var(--brass-hi); }
    .tt-d .chips { display:flex; flex-wrap:wrap; gap:.3rem; margin:.35rem 0 .5rem; }
    .tt-d p { margin:0 0 .5rem; line-height:1.38; color:var(--ivory); font-size:.97rem; }
    .tt-d .note { margin:.3rem 0 .55rem; padding:.35rem .6rem; border-left:3px solid var(--brass-lo); background:rgba(214,179,106,.07); font-size:.87rem; line-height:1.35; color:var(--mist); }
    .tt-d .note.warn { border-left-color:var(--rose); background:rgba(255,92,106,.08); }
    .tt-d .note.ok { border-left-color:var(--leaf); background:rgba(95,220,143,.08); }
    .tt-d .tch-fx .k { min-width:6.2rem; }
    .tt-act { flex:none; display:flex; align-items:center; gap:.6rem; padding-top:.55rem; margin-top:.4rem; border-top:1px solid rgba(214,179,106,.25); }
    .tt-sum { color:var(--mist); font-size:.92rem; line-height:1.45; }
    .tt-sum b { color:var(--ivory); font-weight:500; }
    .tt-bars { margin:.7rem 0; display:flex; flex-direction:column; gap:.4rem; }
    .tt-bars .r { display:grid; grid-template-columns:8rem 1fr 3.6rem; align-items:center; gap:.5rem; font-size:.86rem; color:var(--mist); }
    .tt-bars .r b { text-align:right; color:var(--ivory); font-weight:500; font-variant-numeric:tabular-nums; }
    .ttp { position:absolute; inset:0; display:flex; flex-direction:column; gap:.6rem; padding:.75rem 1.2rem .85rem; background:radial-gradient(ellipse at 14% -8%, rgba(98,216,255,.09), transparent 52%), var(--void); }
    .ttp-head { flex:none; display:flex; align-items:flex-end; gap:1rem; padding-bottom:.5rem; border-bottom:1px solid rgba(214,179,106,.35); }
    .ttp-head h1 { font:400 1.85rem/1 var(--font-title); color:var(--brass-hi); }
    .ttp-head .btn { margin-left:auto; align-self:center; }
  `);

  const STATE_LABEL = { done: 'Researched', proj: 'Under way', avail: 'Available', queued: 'Queued', locked: 'Locked', unknown: 'Not in your tree' };

  // ---- the data model: per field, per tier, the chips and their state ---------------------------------------------------------------------------------
  function model(E) {
    const T = TD(), R = RS(), rs = E.research, fields = [];
    for (let f = 0; f < 6; f++) {
      const done = rs.completed[f], doneSet = new Set(done), choices = R.choices(E, f), cset = new Set(choices), vis = T.visibleTiers(done), proj = rs.project[f];
      const tiers = []; let inTree = 0, valid = 0, doneN = 0, availN = 0;
      for (let ti = 0; ti < 10; ti++) {
        const mine = (rs.list[f] && rs.list[f][ti]) || [], chips = [];
        for (const lvl of T.researchTable[f][ti]) {
          const t = TI().techOf(f, lvl); valid++;
          let state;
          if (doneSet.has(lvl)) { state = 'done'; doneN++; }
          else if (proj === lvl) state = 'proj';
          else if (mine.indexOf(lvl) >= 0) state = cset.has(lvl) ? 'avail' : (ti < vis ? 'queued' : 'locked');
          else state = 'unknown';
          if (state === 'avail') availN++;
          if (mine.indexOf(lvl) >= 0 || state === 'done') inTree++;
          chips.push({ f, ti, level: lvl, t, state });
        }
        tiers.push(chips);
      }
      // advanced "general improvement" techs show once the personal tree is exhausted (or when they are already owned)
      const adv = [];
      const exhausted = !tiers.some(c => c.some(x => x.state === 'avail' || x.state === 'queued' || x.state === 'locked' || x.state === 'proj'));
      for (let lvl = 55; lvl <= 100; lvl += 5) {
        const t = TI().techOf(f, lvl);
        if (!t) continue;
        const state = doneSet.has(lvl) ? 'done' : proj === lvl ? 'proj' : cset.has(lvl) ? 'avail' : 'locked';
        if (state === 'done') doneN++;
        adv.push({ f, ti: 10, level: lvl, t, state });
      }
      fields.push({ f, tiers, adv: exhausted || done.some(l => l >= 55) ? adv : [], inTree, valid, doneN, availN, vis });
    }
    return fields;
  }
  const costOf = (E, c) => RS().projectCost(G.S, E, c.f, c.level);

  function why(c, E) {
    const rs = E.research, T = c.ti + 1;
    switch (c.state) {
      case 'locked': return 'Locked: tier ' + T + ' opens when you know a ' + FIELD(c.f) + ' technology of level ' + (T <= 2 ? 'above the starting one' : (5 * T - 9) + ' or higher') + '.';
      case 'queued': return 'Not offered yet. The choice list holds at most 12 technologies, oldest tiers first: research some older ones and this one will appear.';
      case 'unknown': return 'This technology is not in your research tree. Each empire is dealt about half of the tree at the start of the game, so other empires may know it: steal it, trade for it, or find it.';
      case 'avail': return rs.project[c.f] && rs.invest[c.f] > 1 ? 'A project is already under way in this field. Finish it first, then this technology can be chosen.' : '';
      default: return '';
    }
  }
  const FIELD = f => TI().FIELDS[f].name;

  // ---- the widget --------------------------------------------------------------------------------------------------------------------------------------
  function create(opts) {
    opts = opts || {};
    const W = { sel: null, q: '', models: null, chips: [], scrollTo: true, offFrame: null };
    const TIf = TI();
    const search = h('input.field', { type: 'text', placeholder: 'Search technologies…', maxlength: 40, 'aria-label': 'Search technologies' });
    const clearBtn = h('button.x', { type: 'button', title: 'Clear', onclick: () => { search.value = ''; onSearch(); search.focus(); } }, '×');
    const count = h('span.tt-count');
    const SW = { done: 'var(--leaf)', proj: 'var(--cyan)', avail: 'var(--brass-hi)', queued: 'var(--brass-lo)', locked: 'var(--fog)' };
    const leg = h('div.tt-leg', [['done', 'researched'], ['proj', 'under way'], ['avail', 'available'], ['queued', 'queued'], ['locked', 'locked']].map(([k, l]) => h('span', h('i', { style: { '--sw': SW[k] } }), l)),
      h('span', h('i.unk'), '? not in your tree'));
    const grid = h('div.tt-grid'), scroll = h('div.tt-scroll', grid);
    const main = h('div.tt-main', h('div.tt-bar', h('div.tt-search', search, clearBtn), count, leg), scroll);
    const art = h('canvas.tt-art'), d = h('div.tt-d'), act = h('div.tt-act');
    const side = h('div.tt-side', h('div.panel', art, d, act));
    const el = h('div.tt', main, side);

    function onSearch() {
      W.q = search.value.trim().toLowerCase(); clearBtn.style.display = W.q ? '' : 'none';
      let n = 0;
      for (const ch of W.chips) {
        const c = ch.rec; let hit = false;
        if (W.q && c.t && c.state !== 'unknown') { const hay = (c.t.name + ' ' + c.t.desc + ' ' + TIf.typeInfo(c.t.type).label + ' ' + FIELD(c.f)).toLowerCase(); hit = hay.indexOf(W.q) >= 0; }
        ch.el.classList.toggle('hit', !!(W.q && hit)); ch.el.classList.toggle('miss', !!(W.q && !hit && c.state !== 'unknown'));
        if (W.q && hit) n++;
      }
      count.textContent = W.q ? n + (n === 1 ? ' match' : ' matches') : '';
    }
    search.addEventListener('input', onSearch);
    search.addEventListener('keydown', e => { if (e.key === 'Escape') { if (search.value) { search.value = ''; onSearch(); e.stopPropagation(); } else search.blur(); } });
    clearBtn.style.display = 'none';

    function chipEl(c, E) {
      const ti = c.t ? TIf.typeInfo(c.t.type) : { ico: 'tech' };
      const e = h('div.tt-chip.' + c.state + (W.sel && W.sel.f === c.f && W.sel.level === c.level ? '.sel' : ''), { onclick: () => select(c.f, c.level), tip: () => tipFor(c, E) },
        UI.icon(c.state === 'done' ? 'ok' : c.state === 'locked' ? 'lock' : ti.ico), h('span.nm', c.t ? c.t.name : 'Level ' + c.level), h('span.lv', 'L' + c.level));
      W.chips.push({ el: e, rec: c });
      return e;
    }
    function tipFor(c, E) {
      const t = c.t; if (!t) return '';
      const cost = c.state === 'done' ? '' : '<br>Cost ' + fmt(costOf(E, c)) + ' RP';
      return '<b>' + t.name + '</b> · ' + STATE_LABEL[c.state] + ' · level ' + t.level + cost + '<br>' + t.desc;
    }

    function renderGrid(E) {
      const top = scroll.scrollTop, left = scroll.scrollLeft;
      UI.clear(grid); W.chips = [];
      const ms = W.models = model(E);
      grid.appendChild(h('div.tt-h.corner'));
      ms.forEach(m => {
        const F = TIf.FIELDS[m.f];
        grid.appendChild(h('div.tt-h', { style: { '--fc': F.col }, tip: '<b>' + F.name + '</b><br>' + m.doneN + ' researched · ' + m.availN + ' available now<br>' + m.inTree + ' of ' + m.valid + ' technologies are in your tree' },
          UI.icon(F.icon), h('b', F.name), h('small', m.doneN + ' / ' + m.inTree)));
      });
      for (let ti = 0; ti < 10; ti++) {
        grid.appendChild(h('div.tt-tier', 'T' + (ti + 1), h('small', 'L' + (ti * 5 + 1) + '–' + (ti * 5 + 5))));
        ms.forEach(m => {
          const cell = h('div.tt-cell'), unk = h('div.tt-unk');
          m.tiers[ti].forEach(c => { if (c.state === 'unknown') unk.appendChild(h('span.tt-q', { tip: '<b>Not in your tree</b><br>Another empire may know a technology of level ' + c.level + ' here.', onclick: () => select(c.f, c.level) }, '?')); else cell.appendChild(chipEl(c, E)); });
          if (unk.firstChild) cell.appendChild(unk);
          grid.appendChild(cell);
        });
      }
      if (ms.some(m => m.adv.length)) {
        grid.appendChild(h('div.tt-tier.adv', 'ADV', h('small', 'L55+')));
        ms.forEach(m => { const cell = h('div.tt-cell'); m.adv.slice(0, 6).forEach(c => cell.appendChild(chipEl(c, E))); grid.appendChild(cell); });
      }
      scroll.scrollTop = top; scroll.scrollLeft = left;
      onSearch();
    }

    function renderSide(E) {
      UI.clear(d); UI.clear(act); act.style.display = 'none';
      const ms = W.models, c = W.sel && ms ? (ms[W.sel.f].tiers.flat().concat(ms[W.sel.f].adv).find(x => x.level === W.sel.level)) : null;
      W.art = c && c.state !== 'unknown' ? c : null;
      if (!c) {
        const tot = ms.reduce((a, m) => a + m.valid, 0), mine = ms.reduce((a, m) => a + m.inTree, 0), dn = ms.reduce((a, m) => a + m.doneN, 0), av = ms.reduce((a, m) => a + m.availN, 0);
        d.appendChild(h('div.tn', 'Your research tree'));
        d.appendChild(h('p.tt-sum', 'Like every empire you were dealt only part of the tree when the game began: ', h('b', mine + ' of ' + tot), ' technologies can be researched by your scientists. The rest show as ', h('b', '?'), ' and can only be stolen, traded for or found.'));
        d.appendChild(h('div.tt-bars', ms.map(m => { const F = TIf.FIELDS[m.f]; return h('div.r', h('span', F.name), UI.bar(m.inTree ? m.doneN / m.inTree : 0, { color: F.col }), h('b', m.doneN + '/' + m.inTree)); })));
        d.appendChild(h('p.tt-sum', h('b', dn), ' researched · ', h('b', av), ' available now. Click any technology for its picture, cost and what it does.'));
        return;
      }
      const t = c.t, F = TIf.FIELDS[c.f], cost = costOf(E, c);
      d.appendChild(h('div.tn', c.state === 'unknown' ? 'Unknown technology' : t.name));
      d.appendChild(h('div.chips', UI.chip(F.name, ''), UI.chip('Tier ' + (c.ti + 1) + ' · level ' + c.level), UI.chip(STATE_LABEL[c.state], c.state === 'done' ? 'ok' : c.state === 'proj' ? 'cy' : c.state === 'avail' ? 'warn' : ''), c.state !== 'done' && c.state !== 'unknown' ? UI.chip(fmt(cost) + ' RP') : null));
      if (c.state !== 'unknown' && t) {
        d.appendChild(h('p', t.desc));
        const fx = TIf.effectLines(t);
        if (fx.length) d.appendChild(h('ul.tch-fx', fx.map(l => h('li', h('span.k', l.k), h('span.v', String(l.v))))));
      }
      const note = why(c, E);
      if (note) d.appendChild(h('div.note' + (c.state === 'unknown' ? '' : c.state === 'avail' ? '.warn' : ''), note));
      if (c.state === 'proj') { const rs = E.research; d.appendChild(h('div.note.ok', fmt(rs.invest[c.f]) + ' of ' + fmt(rs.cost[c.f]) + ' RP invested (' + round(100 * rs.invest[c.f] / max(1, rs.cost[c.f])) + '%). ' + TIf.etaText(TIf.forecast(E, c.f, rs.invest[c.f], rs.cost[c.f])))); }
      if (c.state === 'avail') {
        const rs = E.research, can = !(rs.project[c.f] && rs.invest[c.f] > 1), fc = TIf.forecast(E, c.f, can ? rs.invest[c.f] : 0, cost);
        d.appendChild(h('div.note', fc ? (fc.never ? 'No research share is assigned to ' + F.name + ' yet.' : 'At ' + fmt(fc.rp) + ' RP per turn: ' + TIf.etaText(fc)) : ''));
        act.appendChild(UI.button(rs.project[c.f] && can ? 'Switch to this' : 'Research this', () => { if (opts.onPick) opts.onPick(c.f, c.level); }, { primary: true, disabled: !can, tip: can ? 'Make this the ' + F.name + ' project' : 'Finish the current project first' }));
      }
      act.style.display = act.firstChild ? '' : 'none';
    }

    function select(f, level) { W.sel = { f, level }; refresh(true); }
    function refresh(keepGrid) {
      const E = G.player(); if (!E || !G.S) return;
      renderGrid(E); renderSide(E); drawArt(0);
      if (W.scrollTo && !keepGrid) {
        W.scrollTo = false;
        const ms = W.models, first = ms.map(m => { for (let ti = 0; ti < 10; ti++) if (m.tiers[ti].some(c => c.state === 'avail' || c.state === 'proj')) return ti; return 9; });
        const row = Math.max(0, Math.min.apply(null, first) - 1), tier = grid.querySelectorAll('.tt-tier')[row];
        const hd = grid.querySelector('.tt-h'); if (tier) scroll.scrollTop = max(0, tier.offsetTop - (hd ? hd.offsetHeight : 40) - 2);
      }
    }
    // the picture of the selected tech: a slow hologram, only while the view is on screen
    let acc = 0;
    function drawArt(t) {
      if (!art.isConnected || art.offsetParent === null) return;
      const E = G.player(); if (!E) return;
      const f = UI.fitCanvas(art, { maxDpr: PQ().dpr });
      if (f.w < 20 || f.h < 20) return;
      const col = W.sel ? TIf.FIELDS[W.sel.f].col : '#d6b36a';
      UI.TechArt.draw(f.ctx, f.w, f.h, t, W.art ? W.art.t : null, { col, race: E.race, banner: TIf.bannerCss(E), hull: 2 });
      if (!W.art) { const g = f.ctx; g.font = '400 ' + round(f.h * 0.4) + 'px "Marcellus SC", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(152,165,207,.35)'; g.fillText('?', f.w / 2, f.h * 0.5); }
    }
    W.offFrame = UI.onFrame((dt, t) => {
      if (!el.isConnected || el.offsetParent === null) return;
      acc += dt; const fps = reduced() ? 1 : 30;
      if (acc < 1 / fps) return; acc = 0; drawArt(t);
    });
    W.focusSearch = () => { search.focus(); search.select(); };
    return { el, refresh: () => refresh(false), focusSearch: W.focusSearch, select, destroy() { if (W.offFrame) W.offFrame(); el.remove(); } };
  }

  UI.TechTree = { create, model };

  // ---- stand-alone screen -----------------------------------------------------------------------------------------------------------------------------
  let tree = null, from = 'galaxy';
  function back() { UI.Screens.go(from && UI.Screens.has(from) && from !== 'techtree' ? from : 'galaxy'); }
  UI.Screens.register('techtree', {
    create(el) {
      const host = h('div.ttp'); tree = null;
      host.appendChild(h('div.ttp-head', h('h1', 'Technology overview'), UI.button('OK', back, { primary: true, big: true, kbd: 'Space' })));
      host.appendChild(h('div', { style: { display: 'flex', flex: '1 1 auto', minHeight: 0 }, class: 'ttp-body' }));
      el.appendChild(host);
      el.addEventListener('contextmenu', e => { if (e.target && e.target.tagName === 'INPUT') return; e.preventDefault(); back(); });
    },
    enter(params) {
      from = (params && params.from) || (UI.Screens.current && UI.Screens.current.prev) || 'galaxy';
      const body = UI.Screens.el('techtree').querySelector('.ttp-body');
      if (!tree) { tree = UI.TechTree.create({ onPick: (f, level) => { const r = G.order({ t: 'researchPick', field: f, level }); if (!r.ok) UI.toast(r.msg || 'Not possible', 'bad'); tree.refresh(); }, onClose: back }); tree.el.style.flex = '1 1 auto'; body.appendChild(tree.el); }
      tree.refresh();
      if (params && params.level) tree.select(params.field | 0, params.level | 0);
    },
    leave() { UI.hideTip(); },
  });
  M.Bus.on('state', () => { if (tree && UI.Screens.current && UI.Screens.current.id === 'techtree') tree.refresh(); });
  M.Bus.on('game:new', () => { if (tree) { tree.destroy(); tree = null; } });
  M.Bus.on('game:loaded', () => { if (tree) { tree.destroy(); tree = null; } });
  UI.bindKey('Escape', () => { const a = doc.activeElement; if (a && a.tagName === 'INPUT') return; back(); }, { screen: 'techtree' });
  UI.bindKey('Space', () => { const a = doc.activeElement; if (a && a.tagName === 'INPUT') return; back(); }, { screen: 'techtree' });
  UI.bindKey('/', e => { if (tree) tree.focusSearch(); }, { screen: 'techtree' });
})(window.MOO);
