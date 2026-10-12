// The control screen (research/06 §4): galaxy map + context side panel + bottom nav bar + top HUD. Everything else opens from here.
//   MOO.UI.Side.register('colony', {render(host, ctx), refresh(host, ctx), dispose()})   MOO.UI.Side.show('colony', {planet})
//   MOO.UI.Galaxy.map  (MOO.UI.GalaxyMap instance)   MOO.UI.Galaxy.selectStar(id)   MOO.UI.Galaxy.refresh()
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('galaxy', `
    .gx { position:absolute; inset:0; display:grid; grid-template-columns: 1fr clamp(19rem, 25vw, 27rem); grid-template-rows: 1fr auto; background:var(--void); }
    .gx-mapwrap { position:relative; grid-column:1; grid-row:1; min-width:0; min-height:0; }
    .gx-side { grid-column:2; grid-row:1; min-height:0; padding:.55rem .55rem .35rem .35rem; display:flex; flex-direction:column; background:linear-gradient(90deg, rgba(6,9,25,.0), rgba(6,9,25,.9) 12%); }
    .gx-side .panel { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
    .gx-sidebody { min-height:0; overflow-y:auto; flex:1 1 auto; padding-right:.2rem; }
    .gx-bar { grid-column:1 / -1; grid-row:2; display:flex; gap:.4rem; align-items:center; padding:.45rem .6rem; background:linear-gradient(180deg, rgba(14,20,52,.96), rgba(6,9,25,.98)); border-top:1px solid rgba(214,179,106,.45); }
    .gx-bar .btn { padding:.4em 1em; }
    .gx-bar .gx-spacer { flex:1; }
    .gx-top { position:absolute; left:.7rem; top:.6rem; right:.7rem; display:flex; gap:.5rem; align-items:flex-start; pointer-events:none; z-index:3; }
    .gx-hud { pointer-events:auto; display:flex; gap:1.1rem; align-items:center; padding:.35rem .9rem; background:rgba(8,12,34,.72); backdrop-filter:blur(4px); border:1px solid rgba(214,179,106,.35); clip-path:polygon(.45rem 0,100% 0,100% calc(100% - .45rem),calc(100% - .45rem) 100%,0 100%,0 .45rem); font-size:.98rem; }
    .gx-hud .y { font:400 1.3rem var(--font-display); color:var(--brass-hi); letter-spacing:.04em; }
    .gx-hud .k { color:var(--mist); font-size:.82rem; margin-right:.3em; }
    .gx-hud b { font-weight:600; font-variant-numeric:tabular-nums; }
    .gx-msg { pointer-events:auto; margin-left:auto; max-width:28rem; display:flex; flex-direction:column; gap:.3rem; }
    .gx-msg .m { padding:.3rem .7rem; background:rgba(8,12,34,.78); border-left:3px solid var(--brass); font-size:.9rem; }
    .gx-msg .m.bad { border-left-color:var(--rose); } .gx-msg .m.ok { border-left-color:var(--leaf); }
    .gx-busy { position:absolute; inset:0; z-index:20; display:none; align-items:center; justify-content:center; background:rgba(3,5,16,.45); backdrop-filter:blur(1.5px); }
    .gx-busy.on { display:flex; } .gx-busy .box { padding:1rem 2rem; font:400 1.4rem var(--font-display); color:var(--brass-hi); background:rgba(8,12,34,.9); border:1px solid var(--brass-lo); }
    .gx-busy .spin { display:inline-block; width:1.1rem; height:1.1rem; margin-right:.7rem; vertical-align:-.15rem; border:2px solid var(--brass-lo); border-top-color:var(--brass-hi); border-radius:50%; animation:gx-spin 1s linear infinite; }
    @keyframes gx-spin { to { transform:rotate(360deg); } }
    .gx-side h3 { font:400 1.15rem var(--font-display); color:var(--brass-hi); }
    .side-title { display:flex; align-items:baseline; gap:.5rem; padding-bottom:.4rem; margin-bottom:.5rem; border-bottom:1px solid rgba(214,179,106,.3); }
    .side-title .nm { font:400 1.5rem var(--font-title); color:var(--brass-hi); letter-spacing:.02em; }
    .side-title .own { margin-left:auto; display:flex; align-items:center; gap:.35rem; color:var(--mist); font-size:.9rem; }
  `);

  // ---- side-panel registry ------------------------------------------------------------------------------------------------------------------
  const panels = {}; let cur = null, host = null;
  const ctx = params => ({ S: G.S, E: G.player(), Q, G, params: params || {}, show: (n, p) => UI.Side.show(n, p), defaultPanel: () => UI.Galaxy.showDefault(), map: UI.Galaxy.map, UI });
  UI.Side = {
    register(name, def) { panels[name] = def; },
    has: n => !!panels[n],
    current: () => (cur ? cur.name : null),
    show(name, params) {
      if (!host) return;
      const def = panels[name]; if (!def) { console.warn('no side panel', name); return; }
      if (cur && cur.def.dispose) { try { cur.def.dispose(); } catch (e) { console.error(e); } }
      UI.clear(host);
      cur = { name, params: params || {}, def };
      def.render(host, ctx(cur.params));
    },
    refresh() { if (cur && cur.def.refresh && host) { try { cur.def.refresh(host, ctx(cur.params)); } catch (e) { console.error('[side refresh]', e); } } },
    title(star, owner) {                    // common header: planet/star name + owner banner
      const E = owner !== undefined && owner >= 0 ? G.S.empires[owner] : null;
      return h('div.side-title', h('span.nm', G.S.stars[star].name), E ? h('span.own', h('span.empire-dot', { style: { '--c': 'var(--emp' + E.color + ')' } }), E.plural) : null);
    },
  };

  // ---- the screen -----------------------------------------------------------------------------------------------------------------------------
  let el, mapWrap, hudEl, msgEl, busyEl, map = null, offs = [];
  const NAV = [['Game', 'g', () => UI.gameMenu && UI.gameMenu()], ['Design', 'd', () => go('design')], ['Fleet', 'f', () => go('fleets')], ['Map', 'm', () => go('mapoverview')],
    ['Races', 'r', () => go('races')], ['Planets', 'p', () => go('planets')], ['Tech', 't', () => go('tech')]];
  function go(screen, params) { if (UI.Screens.has(screen)) UI.Screens.go(screen, Object.assign({ from: 'galaxy' }, params)); else UI.toast('That screen is not built yet', 'warn'); }
  UI.Galaxy = {
    map: null, go, pick: null,                    // pick: temporary star-click handler used by Reloc / Trans / fleet destination selection
    refresh() { if (!el || !G.S) return; if (map) { map.setState(G.S); map.refresh(); } updateHud(); UI.Side.refresh(); },
    selectStar(id, opts) {
      if (!G.S || id < 0) return; G.sel.star = id; if (map) map.select(id);
      if (!(opts && opts.keepPanel)) UI.Galaxy.showDefault();
    },
    showDefault() {
      const S = G.S, id = G.sel.star; if (!S || id < 0) return;
      const p = S.planets[id];
      UI.Side.show(p.owner === S.playerId ? 'colony' : 'star', { star: id });
    },
    message(text, kind) { if (!msgEl) return; const m = h('div.m' + (kind ? '.' + kind : ''), text); msgEl.appendChild(m); setTimeout(() => m.remove(), 7000); while (msgEl.children.length > 4) msgEl.firstChild.remove(); },
    busy(on, text) { if (!busyEl) return; busyEl.classList.toggle('on', !!on); if (text) UI.mount(busyEl.firstChild, h('span.spin'), text); },
    endTurn,
  };

  function updateHud() {
    if (!hudEl || !G.S) return;
    const S = G.S, E = G.player(), f = E.flow || {}, rp = E.research.total | 0;
    const colonies = S.planets.filter(p => p.owner === E.id).length;
    UI.mount(hudEl,
      h('span.y', 'Year ' + Q.year(S)),
      h('span', h('span.k', 'Reserve'), h('b.t-gold', U.fmt(E.bc)), ' ', h('span.t-gold', 'BC'), f.taxToReserve ? h('span.t-leaf.small', ' +' + f.taxToReserve) : null),
      h('span', h('span.k', 'Income'), h('b' + ((f.net | 0) < (f.gross | 0) * 0.6 ? '.t-rose' : '.t-leaf'), U.fmt(f.net | 0)), h('span.k', ' of ' + U.fmt(f.gross | 0))),
      h('span', h('span.k', 'Research'), h('b.t-cyan', U.fmt(rp)), h('span.t-cyan', ' RP')),
      h('span', h('span.k', 'Colonies'), h('b', colonies)));
  }

  async function endTurn() {
    if (!G.S || G.busy) return;
    if (UI.modalOpen()) return;
    if (M.Settings.get('confirmEndTurn')) { const ok = await UI.confirm('End the turn?'); if (!ok) return; }
    UI.Galaxy.busy(true, 'Year ' + Q.year(G.S) + ' …');
    const off = M.Bus.on('turn:waiting', type => UI.Screens.current && UI.Screens.current.id === 'galaxy' && !UI.modalOpen() && UI.Galaxy.busy(true, 'Year ' + Q.year(G.S) + ' … waiting on “' + type + '”'));
    try { await G.endTurn(); } finally { if (typeof off === 'function') off(); UI.Galaxy.busy(false); }
    if (UI.Screens.current && UI.Screens.current.id !== 'galaxy' && G.S && !(G.last && G.last.over)) UI.Screens.go('galaxy');
    UI.Galaxy.refresh();
    if (G.S) { const me = G.player(); if (me.alive) UI.Galaxy.selectStar(G.sel.star >= 0 ? G.sel.star : me.capital, { keepPanel: false }); }
  }

  // ---- hotkeys (research/06 §4.6) ------------------------------------------------------------------------------------------------------------------
  function cycleColony(dir, pred) {
    const S = G.S, mine = S.planets.filter(p => p.owner === S.playerId && (!pred || pred(p)));
    if (!mine.length) return;
    let i = mine.findIndex(p => p.starId === G.sel.star); i = (i + dir + mine.length) % mine.length;
    if (i < 0) i = 0;
    const id = mine[i].starId; UI.Galaxy.selectStar(id); if (map) map.centerOn(id, { animate: true });
  }
  function bindKeys() {
    const scr = { screen: 'galaxy' };
    NAV.forEach(([name, key, fn]) => offs.push(UI.bindKey(key, fn, scr)));
    offs.push(UI.bindKey('n', endTurn, scr));
    offs.push(UI.bindKey('ctrl+enter', endTurn, scr));
    offs.push(UI.bindKey('F2', () => cycleColony(-1), scr)); offs.push(UI.bindKey('F3', () => cycleColony(1), scr));
    const withShips = p => !!M.Sim.Fleet.at(G.S, p.starId, G.S.playerId);
    offs.push(UI.bindKey('F4', () => cycleColony(1, withShips), scr)); offs.push(UI.bindKey('F5', () => cycleColony(-1, withShips), scr));
    offs.push(UI.bindKey('F10', () => { if (G.saveSlot('auto')) UI.toast('Game saved', 'ok'); }, scr));
    offs.push(UI.bindKey('Escape', () => { if (UI.gameMenu) UI.gameMenu(); }, scr));
    offs.push(UI.bindKey('Home', () => { if (map) map.centerOn(G.player().capital, { animate: true }); }, scr));
    offs.push(UI.bindKey('c', () => { if (map && G.sel.star >= 0) map.centerOn(G.sel.star, { animate: true }); }, { screen: 'galaxy' }));
  }

  UI.Screens.register('galaxy', {
    create(root) {
      mapWrap = h('div.gx-mapwrap');
      hudEl = h('div.gx-hud'); msgEl = h('div.gx-msg');
      busyEl = h('div.gx-busy', h('div.box'));
      host = h('div.gx-sidebody');
      const side = h('aside.gx-side', h('div.panel', host));
      const bar = h('nav.gx-bar',
        NAV.map(([name, key, fn]) => UI.button(name, fn, { kbd: key.toUpperCase() })),
        h('span.gx-spacer'),
        UI.button('Next turn', () => endTurn(), { primary: true, big: true, kbd: 'N' }));
      el = h('div.gx', mapWrap, side, bar);
      root.appendChild(el);
      mapWrap.appendChild(h('div.gx-top', hudEl, msgEl)); mapWrap.appendChild(busyEl);
      bindKeys();
      M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'galaxy') { updateHud(); UI.Side.refresh(); } });
    },
    enter() {
      if (!G.S) { UI.Screens.go('menu'); return; }
      if (!map && M.UI.GalaxyMap) {
        map = UI.Galaxy.map = M.UI.GalaxyMap.create(mapWrap, {});
        map.on('selectStar', id => { if (UI.Galaxy.pick) UI.Galaxy.pick(id); else UI.Galaxy.selectStar(id); });
        map.on('dblStar', id => { G.sel.star = id; if (UI.Screens.has('system')) UI.Screens.go('system', { star: id, from: 'galaxy' }); });
        map.on('selectFleet', fid => { G.sel.fleet = fid; const f = G.S.fleets.find(x => x.id === fid); if (f && f.owner === G.S.playerId) UI.Side.show(f.star >= 0 ? 'fleetDeploy' : 'fleetInfo', { star: f.star, fleet: fid }); else if (f) UI.Side.show('fleetInfo', { fleet: fid }); });
        map.on('moveOrder', o => UI.Side.show('fleetDeploy', { star: G.S.fleets.find(f => f.id === o.fleetId).star, dest: o.toStar }));
      }
      UI.Galaxy.refresh();
      const star = G.sel.star >= 0 ? G.sel.star : G.player().capital;
      if (map) map.centerOn(star, { animate: false });
      UI.Galaxy.selectStar(star);
    },
    leave() { },
    resize() { if (map && map.resize) map.resize(); },
  });
})(window.MOO);
