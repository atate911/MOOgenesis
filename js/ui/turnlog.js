// "Last turn": a compact log under the galaxy sidebar of what happened to the player during the turn just played — battles, bombardments,
// invasions, random events, colony notices, exploration, ships built, breakthroughs — each line a link to the star where it happened.
// Fed by the turn driver ('turn:item' on the bus: every interrupt with its answer), reset when the next turn starts. Similar lines are
// grouped (one "Explored" line with every star; ships built per colony) and the list shows the most important few until expanded.
//   MOO.UI.TurnLog.mount(el)   (galaxy.js)       MOO.UI.TurnLog.entries() → [{cat, pri, text, star, stars?, screen?}]
//   MOO.UI.TurnLog.counts() → {log, next, worst}  MOO.UI.TurnLog.openSheet()  the whole log in a dialog (the phone HUD's chip opens it)
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game;
  const TL = UI.TurnLog = {};
  const SHOWN = 6;                                    // lines shown before "all N"
  let log = [], year = null, el = null, expanded = false;
  const open = () => !(M.Settings && M.Settings.get('turnLogOpen') === false);

  UI.css('turnlog', `
    .tl { flex:none; margin-top:.45rem; max-height:38%; display:flex; flex-direction:column; min-height:0; font-size:.85rem; }
    .tl.empty { display:none; }
    .tl-h { display:flex; align-items:center; gap:.5rem; padding:.3rem .55rem; cursor:var(--hand); user-select:none; background:rgba(8,12,34,.85); border:1px solid var(--brass-line-2); color:var(--brass-hi); font:400 .9rem var(--font-display); letter-spacing:.05em; }
    .tl-h .n { margin-left:auto; color:var(--mist); font:400 .8rem var(--font-ui); }
    .tl-h .car { color:var(--mist); transition:transform .15s; } .tl.shut .tl-h .car { transform:rotate(-90deg); }
    .tl-b { overflow-y:auto; min-height:0; background:rgba(5,8,24,.78); border:1px solid var(--brass-line-1); border-top:0; padding:.2rem 0; }
    .tl.shut .tl-b { display:none; }
    .tl-r { display:flex; gap:.45rem; align-items:baseline; padding:.18rem .55rem; line-height:1.3; }
    .tl-r i { flex:none; width:.5rem; height:.5rem; border-radius:50%; background:var(--c, var(--mist)); transform:translateY(-.05rem); }
    .tl-r .tx { min-width:0; }
    .tl-a { color:var(--ivory); cursor:var(--hand); text-decoration:underline; text-decoration-color:rgba(214,179,106,.35); text-underline-offset:2px; }
    .tl-a:hover { color:var(--brass-hi); text-decoration-color:var(--brass-hi); }
    .tl-a.seen { color:var(--mist); }
    .tl-sub { margin:.25rem .55rem .1rem; padding-top:.2rem; border-top:1px solid var(--brass-line-1); color:var(--brass-hi); font:400 .8rem var(--font-display); letter-spacing:.08em; text-transform:uppercase; }
    .tl-more { display:block; margin:.15rem .55rem .2rem; color:var(--brass-hi); cursor:var(--hand); font-size:.8rem; }
    .tl.tl-sheet { margin:0; max-height:60vh; } .tl-sheet .tl-b { border:0; background:none; padding:0; }
  `);

  // importance: 0 = fighting / losses, 1 = events, 2 = colony notices, 3 = discoveries, 4 = production / research
  const COL = ['var(--rose)', 'var(--amber, #f0b050)', 'var(--leaf)', 'var(--cyan)', 'var(--brass)'];
  const S_ = () => G.S, me = () => G.player();
  const starName = id => (S_() && S_().stars[id] ? S_().stars[id].name : '?');
  const plName = pid => { const S = S_(), p = S && S.planets[pid]; return p ? (p.name || starName(p.starId)) : '?'; };
  const add = (pri, text, star, extra) => log.push(Object.assign({ pri, text, star: star === undefined ? -1 : star }, extra || {}));

  // one interrupt (and the player's answer) → log lines
  function take(it, ans) {
    const S = S_(), E = me(); if (!S || !E || !it) return;
    switch (it.type) {
      case 'explore': { const g = log.find(l => l.cat === 'explore'); if (g) g.stars.push(it.star); else add(3, 'Explored', -1, { cat: 'explore', stars: [it.star] }); break; }
      case 'colonize': if (ans) add(2, 'Colony founded at ', S.planets[it.planet] ? S.planets[it.planet].starId : -1); break;
      case 'built': for (const b of it.items || []) { const d = E.designs[b.design]; add(4, b.count + ' × ' + (d ? d.name : 'ship') + ' built at ', S.planets[b.planet] ? S.planets[b.planet].starId : -1); } break;
      case 'tech': { const t = M.Sim.Research && M.Sim.Research.techAt(it.field, it.level); add(4, 'Breakthrough: ' + (t ? t.name : 'level ' + it.level), -1, { screen: 'tech' }); break; }
      case 'notice': {
        const p = it.planet !== undefined && it.planet >= 0 ? S.planets[it.planet] : null, st = p ? p.starId : (it.star !== undefined ? it.star : -1);
        const T = { industryMax: [2, ': factories at maximum'], popMax: [2, ': population at maximum'], ecoDone: [2, ': terraformed (' + (it.growth === 'gaia' ? 'Gaia' : 'fertile') + ')'], atmosDone: [2, ': atmosphere terraformed'],
          shieldDone: [2, ': planetary shield finished'], stargate: [2, ': stargate finished'], outOfFuel: [0, 'Ships lost, out of fuel, at '], transportLost: [0, 'Transports lost at '] }[it.kind];
        if (T) { if (T[1].startsWith(':')) add(T[0], '', st, { suffix: T[1] }); else add(T[0], T[1], st); }
        else if (it.kind === 'contactLost') add(1, 'Lost contact with the ' + (S.empires[it.other] ? S.empires[it.other].plural : 'other empire'));
        break;
      }
      case 'battles': {
        const rs = (ans && ans.results) || [];
        (it.battles || []).forEach((b, i) => {
          if (!b.sides || !b.sides.some(s => s.empire === E.id)) return;
          const r = rs[i], won = r && r.winnerEmpire === E.id, lost = r && r.winnerEmpire !== undefined && r.winnerEmpire !== E.id && r.winnerEmpire >= 0;
          add(0, 'Battle at ', b.star, { suffix: won ? ': won' : lost ? ': lost' : '' });
        });
        break;
      }
      case 'bombard': if (it.empire === E.id) add(0, 'Bombarded ', it.star); else if (it.victim === E.id) add(0, '', it.star, { suffix: ' was bombarded' }); break;
      case 'ground': {
        const r = it.result; if (!r) break;
        if (r.attacker === E.id) add(0, r.success ? 'Captured ' : 'Invasion failed at ', r.star);
        else if (r.defender === E.id) add(0, r.success ? '' : 'Invasion repelled at ', r.star, r.success ? { suffix: ' was captured by the ' + (S.empires[r.attacker] ? S.empires[r.attacker].plural : 'enemy') } : null);
        break;
      }
      case 'event': {
        const st = it.star !== undefined && it.star >= 0 ? it.star : it.planet !== undefined && it.planet >= 0 && S.planets[it.planet] ? S.planets[it.planet].starId : -1;
        const txt = String(it.text || it.kind || 'Event').replace(/\s+/g, ' '), first = txt.replace(/([.!?])\s[\s\S]*$/, '$1');
        add(1, first.length > 90 ? first.slice(0, 87) + '…' : first, -1, { link: st });
        break;
      }
      default: break;
    }
  }

  function go(star) { if (star < 0 || G.busy) return; if (UI.closeAllModals && UI.modalOpen && UI.modalOpen()) UI.closeAllModals(); if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy'); UI.Galaxy.selectStar(star); if (UI.Galaxy.map) UI.Galaxy.map.centerOn(star, { animate: true }); }
  const link = (star, label) => { const a = h('span.tl-a', label || starName(star)); a.addEventListener('click', e => { e.stopPropagation(); a.classList.add('seen'); go(star); }); return a; };

  function row(l) {
    const tx = h('span.tx');
    if (l.cat === 'explore') { tx.appendChild(document.createTextNode(l.label || 'Explored: ')); l.stars.forEach((s, k) => { if (k) tx.appendChild(document.createTextNode(' · ')); tx.appendChild(link(s)); }); }
    else if (l.screen) { const a = h('span.tl-a', l.text); a.addEventListener('click', () => { a.classList.add('seen'); if (!G.busy && UI.Screens.has(l.screen)) UI.Screens.go(l.screen, { from: 'galaxy' }); }); tx.appendChild(a); }
    else if (l.link !== undefined) tx.appendChild(l.link >= 0 ? link(l.link, l.text) : document.createTextNode(l.text));
    else { if (l.text) tx.appendChild(document.createTextNode(l.text)); if (l.star >= 0) tx.appendChild(link(l.star)); if (l.suffix) tx.appendChild(document.createTextNode(l.suffix)); }
    return h('div.tl-r', { style: { '--c': COL[l.pri] } }, h('i'), tx);
  }

  // "Coming up": read from the live state, not the turn's events — raids seen flying at your colonies, your fleets and transports landing
  // next turn, colony ships sitting in orbit
  function upcoming() {
    const S = S_(), E = me(), out = []; if (!S || !E || G.busy) return out;
    const A = M.Sim.Q.attention(S, E.id);
    Object.keys(A).map(Number).filter(k => A[k].threat).sort((a, b) => A[a].threat.eta - A[b].threat.eta).forEach(k => {
      const t = A[k].threat, what = [t.ships ? t.ships + ' hostile ' + (t.ships === 1 ? 'ship' : 'ships') : '', t.troops ? t.troops + 'M troops' : ''].filter(Boolean).join(' and ');
      out.push({ pri: 0, text: '⚠ ' + what + ' reach ', star: k, suffix: ' in ' + t.eta + (t.eta === 1 ? ' turn' : ' turns') });
    });
    const F = M.Sim.Fleet, land = [];
    for (const f of S.fleets) if (f.owner === E.id && f.star < 0 && f.to >= 0 && F.etaLeft(S, f) === 1 && land.indexOf(f.to) < 0) land.push(f.to);
    for (const t of (S.trans || [])) if (t.owner === E.id && F.etaLeft(S, t) <= 1 && land.indexOf(t.to) < 0) land.push(t.to);
    if (land.length) out.push({ pri: 3, cat: 'explore', label: 'Arriving next turn: ', stars: land });
    const col = [];
    for (const f of S.fleets) if (f.owner === E.id && f.star >= 0 && f.ships.some((n, i) => n > 0 && E.designs[i] && M.Sim.Design.stats(S, E, i).colonyMin)) col.push(f.star);
    if (col.length) out.push({ pri: 2, cat: 'explore', label: (col.length === 1 ? 'Colony ship' : 'Colony ships') + ' in orbit: ', stars: col });
    return out.sort((a, b) => a.pri - b.pri);
  }

  // the rows: last turn's lines (the most important SHOWN unless expanded or all), then "Coming up"
  function body(list, next, all) {
    const shown = all || expanded ? list : list.slice(0, SHOWN), b = h('div.tl-b', shown.map(row));
    if (!all && list.length > SHOWN) { const more = h('span.tl-more', expanded ? 'Fewer ‹' : 'All ' + list.length + ' ›'); more.addEventListener('click', () => { expanded = !expanded; render(); }); b.appendChild(more); }
    if (next.length) { if (list.length) b.appendChild(h('div.tl-sub', 'Coming up')); next.forEach(l => b.appendChild(row(l))); }
    return b;
  }
  const title = list => (list.length ? 'Last turn' + (year !== null ? ' · ' + year : '') : 'Coming up');
  let lastNext = [], lastKey = '';
  function render() {
    if (!el) return;
    UI.clear(el);
    let next = []; try { next = upcoming(); } catch (e) { console.warn('[turn log]', e); }
    lastNext = next;
    const key = log.length + '/' + next.length + '/' + TL.counts().worst; if (key !== lastKey) { lastKey = key; M.Bus.emit('turnlog'); }   // the phone HUD's chip repaints
    el.classList.toggle('empty', !log.length && !next.length); el.classList.toggle('shut', !open());
    if (!log.length && !next.length) return;
    const list = log.slice().sort((a, b) => a.pri - b.pri);
    const head = h('div.tl-h', { title: 'Show or hide what happened last turn and what is coming up' }, h('span.car', '▾'), title(list),
      h('span.n', list.length ? list.length + (list.length === 1 ? ' event' : ' events') : next.length + ' ahead'));
    head.addEventListener('click', () => { if (M.Settings) M.Settings.set('turnLogOpen', !open()); render(); });
    el.appendChild(head); el.appendChild(body(list, next, false));
  }
  let pend = 0;
  const soon = () => { if (pend) return; pend = setTimeout(() => { pend = 0; if (!G.busy) render(); }, 60); };   // orders change what is coming up

  TL.mount = function (host) { el = host; el.classList.add('tl'); render(); };
  TL.entries = () => log.slice();
  // what the log holds now: {log, next, worst} (worst = the most important line's priority, 0 = fighting / losses; -1 when empty). The phone HUD's
  // chip reads it (galaxy.js): in portrait the sidebar is a bottom sheet and the log under it was only reachable at full height.
  TL.counts = function () {                                            // read from the last render (debounced on state changes), not recomputed per HUD update
    const all = log.concat(lastNext); return { log: log.length, next: lastNext.length, worst: all.length ? Math.min.apply(null, all.map(l => l.pri)) : -1 };
  };
  // the whole log (every line, no fold) in a dialog; its links close it and go to the star
  TL.openSheet = function () {
    let next = []; try { next = upcoming(); } catch (e) { next = []; }
    const list = log.slice().sort((a, b) => a.pri - b.pri);
    const b = list.length || next.length ? h('div.tl.tl-sheet', body(list, next, true)) : h('p.dim', 'Nothing to report yet.');
    return UI.modal({ title: title(list), cls: 'tl-modal', width: '30rem', body: b, buttons: [{ label: 'Close', value: true, primary: true }] });
  };
  M.Bus.on('turn:processing', on => { if (!on) { render(); return; } log = []; expanded = false; year = null; render(); });
  M.Bus.on('turn:item', (it, ans) => { try { take(it, ans); } catch (e) { console.warn('[turn log]', e); } });
  M.Bus.on('turn:end', S => { try { year = M.Data.Config.displayYear(S) - 1; } catch (e) { year = null; } render(); });
  M.Bus.on('state', soon);
  M.Bus.on('game:new', () => { log = []; render(); }); M.Bus.on('game:loaded', () => { log = []; render(); });
})(window.MOO);
