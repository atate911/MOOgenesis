// "Last turn": a compact log under the galaxy sidebar of what happened to the player during the turn just played — battles, bombardments,
// invasions, random events, colony notices, exploration, ships built, breakthroughs — each line a link to the star where it happened.
// Fed by the turn driver ('turn:item' on the bus: every interrupt with its answer), reset when the next turn starts. Similar lines are
// grouped (one "Explored" line with every star; ships built per colony) and the list shows the most important few until expanded.
//   MOO.UI.TurnLog.mount(el)   (galaxy.js)       MOO.UI.TurnLog.entries() → [{cat, pri, text, star, stars?, screen?}]
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game;
  const TL = UI.TurnLog = {};
  const SHOWN = 6;                                    // lines shown before "all N"
  let log = [], year = null, el = null, expanded = false;
  const open = () => !(M.Settings && M.Settings.get('turnLogOpen') === false);

  UI.css('turnlog', `
    .tl { flex:none; margin-top:.45rem; max-height:38%; display:flex; flex-direction:column; min-height:0; font-size:.86rem; }
    .tl.empty { display:none; }
    .tl-h { display:flex; align-items:center; gap:.5rem; padding:.3rem .55rem; cursor:pointer; user-select:none; background:rgba(8,12,34,.85); border:1px solid rgba(214,179,106,.28); color:var(--brass-hi); font:400 .9rem var(--font-display); letter-spacing:.05em; }
    .tl-h .n { margin-left:auto; color:var(--mist); font:400 .78rem var(--font-ui); }
    .tl-h .car { color:var(--mist); transition:transform .15s; } .tl.shut .tl-h .car { transform:rotate(-90deg); }
    .tl-b { overflow-y:auto; min-height:0; background:rgba(5,8,24,.78); border:1px solid rgba(214,179,106,.18); border-top:0; padding:.2rem 0; }
    .tl.shut .tl-b { display:none; }
    .tl-r { display:flex; gap:.45rem; align-items:baseline; padding:.18rem .55rem; line-height:1.3; }
    .tl-r i { flex:none; width:.5rem; height:.5rem; border-radius:50%; background:var(--c, var(--mist)); transform:translateY(-.05rem); }
    .tl-r .tx { min-width:0; }
    .tl-a { color:var(--ivory); cursor:pointer; text-decoration:underline; text-decoration-color:rgba(214,179,106,.35); text-underline-offset:2px; }
    .tl-a:hover { color:var(--brass-hi); text-decoration-color:var(--brass-hi); }
    .tl-a.seen { color:var(--mist); }
    .tl-more { display:block; margin:.15rem .55rem .2rem; color:var(--brass-hi); cursor:pointer; font-size:.8rem; }
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
        const txt = String(it.text || it.kind || 'Event').replace(/\s+/g, ' '), first = txt.split(/(?<=[.!?])\s/)[0];
        add(1, first.length > 90 ? first.slice(0, 87) + '…' : first, -1, { link: st });
        break;
      }
      default: break;
    }
  }

  function go(star) { if (star < 0 || G.busy) return; if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy'); UI.Galaxy.selectStar(star); if (UI.Galaxy.map) UI.Galaxy.map.centerOn(star, { animate: true }); }
  const link = (star, label) => { const a = h('span.tl-a', label || starName(star)); a.addEventListener('click', e => { e.stopPropagation(); a.classList.add('seen'); go(star); }); return a; };

  function row(l) {
    const tx = h('span.tx');
    if (l.cat === 'explore') { tx.appendChild(document.createTextNode('Explored: ')); l.stars.forEach((s, k) => { if (k) tx.appendChild(document.createTextNode(' · ')); tx.appendChild(link(s)); }); }
    else if (l.screen) { const a = h('span.tl-a', l.text); a.addEventListener('click', () => { a.classList.add('seen'); if (!G.busy && UI.Screens.has(l.screen)) UI.Screens.go(l.screen, { from: 'galaxy' }); }); tx.appendChild(a); }
    else if (l.link !== undefined) tx.appendChild(l.link >= 0 ? link(l.link, l.text) : document.createTextNode(l.text));
    else { if (l.text) tx.appendChild(document.createTextNode(l.text)); if (l.star >= 0) tx.appendChild(link(l.star)); if (l.suffix) tx.appendChild(document.createTextNode(l.suffix)); }
    return h('div.tl-r', { style: { '--c': COL[l.pri] } }, h('i'), tx);
  }

  function render() {
    if (!el) return;
    UI.clear(el);
    el.classList.toggle('empty', !log.length); el.classList.toggle('shut', !open());
    if (!log.length) return;
    const list = log.slice().sort((a, b) => a.pri - b.pri), shown = expanded ? list : list.slice(0, SHOWN);
    const head = h('div.tl-h', { title: 'Show or hide what happened last turn' }, h('span.car', '▾'), 'Last turn' + (year !== null ? ' · ' + year : ''), h('span.n', list.length + (list.length === 1 ? ' event' : ' events')));
    head.addEventListener('click', () => { if (M.Settings) M.Settings.set('turnLogOpen', !open()); render(); });
    const body = h('div.tl-b', shown.map(row));
    if (list.length > SHOWN) { const more = h('span.tl-more', expanded ? 'Fewer ‹' : 'All ' + list.length + ' ›'); more.addEventListener('click', () => { expanded = !expanded; render(); }); body.appendChild(more); }
    el.appendChild(head); el.appendChild(body);
  }

  TL.mount = function (host) { el = host; el.classList.add('tl'); render(); };
  TL.entries = () => log.slice();
  M.Bus.on('turn:processing', on => { if (!on) { render(); return; } log = []; expanded = false; year = null; render(); });
  M.Bus.on('turn:item', (it, ans) => { try { take(it, ans); } catch (e) { console.warn('[turn log]', e); } });
  M.Bus.on('turn:end', S => { try { year = M.Data.Config.displayYear(S) - 1; } catch (e) { year = null; } render(); });
  M.Bus.on('game:new', () => { log = []; render(); }); M.Bus.on('game:loaded', () => { log = []; render(); });
})(window.MOO);
