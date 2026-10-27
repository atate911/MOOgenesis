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
    /* a side panel opened from a map click floats beside the cursor instead (fleet deployment): the controls are where the hand already is */
    .gx-float { position:absolute; grid-column:auto; grid-row:auto; z-index:8; width:min(24rem, calc(100% - 1rem)); max-height:min(72%, 36rem); display:none; padding:0; background:none; filter:drop-shadow(0 10px 26px rgba(0,0,0,.65)); }
    .gx-float.on { display:flex; }
    .gx-sidebody.reveal { animation: gx-reveal .16s ease-out; }                /* panel change: a short settle, never on refresh (immersion review, Phase C) */
    @keyframes gx-reveal { from { opacity:.35; transform:translateX(6px); } to { opacity:1; transform:none; } }
    :root[data-reduce-motion] .gx-sidebody.reveal { animation:none; }
    .gx-bar { grid-column:1 / -1; grid-row:2; display:flex; gap:.4rem; align-items:center; padding:.45rem .6rem; background:linear-gradient(180deg, rgba(14,20,52,.96), rgba(6,9,25,.98)); border-top:1px solid rgba(214,179,106,.45); }
    .gx-bar .btn { padding:.4em 1em; }
    .gx-bar .gx-spacer { flex:1; }
    .gx-top { position:absolute; left:.7rem; top:.6rem; right:.7rem; display:flex; gap:.5rem; align-items:flex-start; pointer-events:none; z-index:3; }
    .gx-hud { pointer-events:auto; display:flex; gap:1.1rem; align-items:center; padding:.35rem .9rem; background:rgba(8,12,34,.72); backdrop-filter:blur(4px); border:1px solid rgba(214,179,106,.35); clip-path:polygon(.45rem 0,100% 0,100% calc(100% - .45rem),calc(100% - .45rem) 100%,0 100%,0 .45rem); font-size:.98rem; }
    .gx-hud .y { font:400 1.3rem var(--font-display); color:var(--brass-hi); letter-spacing:.04em; }
    .gx-hudr, .gx-chip { display:contents; }                                      /* the HUD minus the year: rebuilt on every state change (phones lay them out as rows) */
    .gx-hud .od { display:inline-block; height:1.2em; line-height:1.2em; overflow:hidden; vertical-align:bottom; }
    .gx-hud .od-in { display:flex; flex-direction:column; animation:gx-od .6s cubic-bezier(.3,.7,.2,1) both; }
    .gx-hud .od-in > span { height:1.2em; }
    @keyframes gx-od { from { transform:translateY(0); } to { transform:translateY(-50%); } }
    .gx-hud b.chg { animation:gx-chg 1.1s ease-out both; }                       /* a value that changed over the turn */
    @keyframes gx-chg { 0%, 25% { color:#fff8dc; text-shadow:0 0 10px rgba(255,214,106,.95), 0 0 2px #fff; } 100% { } }
    .gx-hud .k { color:var(--mist); font-size:.82rem; margin-right:.3em; }
    .gx-hud b { font-weight:600; font-variant-numeric:tabular-nums; }
    .gx-att { display:flex; gap:.45rem; cursor:var(--hand); font-weight:600; font-variant-numeric:tabular-nums; } .gx-att span { padding:.05rem .4rem; border:1px solid currentColor; border-radius:.2rem; }
    .gx-att .r { color:#ff7a6a; } .gx-att .w { color:var(--ember, #f0a040); } .gx-att:hover span { background:rgba(255,255,255,.08); }
    .gx-logc { display:none; }                                                    /* the turn log's chip: portrait phones only (css/phone.css) */
    .gx-msg { pointer-events:auto; margin-left:auto; max-width:28rem; display:flex; flex-direction:column; gap:.3rem; }
    .gx-msg .m { padding:.3rem .7rem; background:rgba(8,12,34,.78); border-left:3px solid var(--brass); font-size:.9rem; }
    .gx-msg .m.bad { border-left-color:var(--rose); } .gx-msg .m.ok { border-left-color:var(--leaf); }
    .gx-msg .m { cursor:var(--hand); } .gx-msg .m.link:hover { background:rgba(214,179,106,.18); } .gx-msg .m.link::after { content:' ›'; color:var(--brass-hi); }
    .gx-wait { margin-right:.8rem; font:500 .85rem var(--font-display); letter-spacing:.06em; color:var(--brass-hi); opacity:.9; white-space:nowrap; }
    .gx-busy { position:absolute; inset:0; z-index:20; display:none; align-items:center; justify-content:center; background:rgba(3,5,16,.45); backdrop-filter:blur(1.5px); }
    .gx-busy.on { display:flex; } .gx-busy .box { padding:1rem 2rem; font:400 1.4rem var(--font-display); color:var(--brass-hi); background:rgba(8,12,34,.9); border:1px solid var(--brass-lo); }
    .gx-busy .spin { display:inline-block; width:1.1rem; height:1.1rem; margin-right:.7rem; vertical-align:-.15rem; border:2px solid var(--brass-lo); border-top-color:var(--brass-hi); border-radius:50%; animation:gx-spin 1s linear infinite; }
    @keyframes gx-spin { to { transform:rotate(360deg); } }
    .gx-side h3 { font:400 1.15rem var(--font-display); color:var(--brass-hi); }
    .side-title { display:flex; align-items:baseline; gap:.5rem; padding-bottom:.4rem; margin-bottom:.5rem; border-bottom:1px solid rgba(214,179,106,.3); }
    .side-title .nm { font:400 1.5rem var(--font-title); color:var(--brass-hi); letter-spacing:.02em; }
    .side-title .own { margin-left:auto; display:flex; align-items:center; gap:.35rem; color:var(--mist); font-size:.9rem; }
  `);

  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle (original-game feel, modern rendering): gunmetal bevelled frame, indigo/gold title plate, equal-width steel button row.
  UI.css('galaxy-orig', bump(`
    .gx { --bv-hi:rgba(255,255,255,.2); --bv-lo:rgba(0,0,0,.6); --gold-ink:var(--title, #e8c850);
      padding:.4rem; gap:.4rem; background:linear-gradient(135deg, #8d98a4 0%, #4d5662 38%, #2a313a 100%);
      box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.7), inset 0 0 0 .22rem rgba(0,0,0,.18); }
    .gx-mapwrap { background:#000; box-shadow:0 0 0 1px rgba(0,0,0,.9), 0 1px 0 1px rgba(255,255,255,.18); overflow:hidden; }
    .gx-mapwrap::after { content:""; position:absolute; inset:0; z-index:4; pointer-events:none; box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), inset 2px 2px 3px rgba(0,0,0,.65), inset -1px -1px 0 rgba(255,255,255,.1); }
    .gx-side { padding:0; background:none; }
    .gx-side .panel { clip-path:none; padding:.3rem; background:linear-gradient(180deg, #59636f, #3a424c); box-shadow:-10px 0 28px rgba(0,0,0,.45), inset 1px 1px 0 var(--bv-hi), inset -1px -1px 0 var(--bv-lo), 0 0 0 1px rgba(0,0,0,.8); }
    .gx-side .panel::before { inset:.2rem; clip-path:none; background:linear-gradient(180deg, #313840, #262c33); box-shadow:inset 1px 1px 0 var(--bv-lo), inset -1px -1px 0 rgba(255,255,255,.1); }
    .gx-side .panel::after { display:none; }
    .gx-sidebody { padding:.4rem .45rem; }
    .gx-bar { padding:.2rem 0 0; gap:.25rem; border-top:0; background:none; }
    .gx-bar .gx-spacer { display:none; }
    .gx-bar .btn { flex:1 1 0; min-width:0; clip-path:none; padding:.5em .3em; font:600 .86rem/1.1 var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:#ecf0f6; text-shadow:0 1px 0 rgba(0,0,0,.7);
      background:rgba(0,0,0,.85); box-shadow:none; }
    .gx-bar .btn::before { inset:1px; clip-path:none; background:linear-gradient(180deg, #6f7b94 0%, #4c566e 52%, #424b61 100%); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.45); }
    .gx-bar .btn:hover { filter:none; }
    .gx-bar .btn:hover::before { background:linear-gradient(180deg, #8794b0 0%, #5a6584 52%, #4e5873 100%); }
    .gx-bar .btn:active::before { background:linear-gradient(180deg, #3d4659, #4c566e); box-shadow:inset 1px 1px 0 rgba(0,0,0,.55), inset -1px -1px 0 rgba(255,255,255,.18); }
    .gx-bar .btn .kbd { display:none; }
    .gx-bar .btn.primary { flex:1.25 1 0; }   /* colours come from theme-v2 (gold primary slab) */
    .gx-hud { background:rgba(6,9,14,.78); border:1px solid rgba(255,255,255,.14); border-top-color:rgba(255,255,255,.28); clip-path:none; box-shadow:inset 0 1px 0 rgba(255,255,255,.08), var(--shadow-1); }
    .gx-hud .y { color:var(--gold-ink); text-shadow:0 1px 0 #6b4f12; }
    .gx-hud { background:rgba(6,9,14,.88); } .gx-hud .k { font-size:.92rem; color:#c9d3df; } .gx-hud b { font-size:1.02rem; }
    .gx-msg .m { background:rgba(6,9,14,.82); border-left-width:2px; }
    /* title plate (shared by every side panel) */
    .side-title { justify-content:center; align-items:center; gap:.6rem; margin:-.05rem 0 .5rem; padding:.28rem .5rem; border-bottom:0;
      background:linear-gradient(180deg, #3d4780 0%, #2a3263 55%, #202750 100%); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.6), 0 0 0 1px rgba(0,0,0,.7); }
    .side-title .nm { font:400 1.35rem/1.1 var(--font-title); letter-spacing:.06em; color:var(--title, #e8c850); text-shadow:0 1px 0 #6b4f12, 0 0 12px rgba(232,200,80,.25); }
    .side-title .own { margin-left:0; font-size:.8rem; letter-spacing:.06em; text-transform:uppercase; color:#cfd6ee; }
    .side-title .cyc { flex:none; width:1.35rem; height:1.35rem; padding:0; border:0; background:none; cursor:var(--hand); color:#cfd6ee; opacity:.7; }
    .side-title .cyc:first-child { margin-right:auto; } .side-title .cyc:last-child { margin-left:auto; }
    .side-title .cyc:hover { opacity:1; color:var(--title, #e8c850); }
    .side-title .cyc::after { content:''; display:block; width:.55rem; height:.7rem; margin:auto; background:currentColor; clip-path:polygon(100% 0,0 50%,100% 100%); }
    .side-title .cyc.nx::after { clip-path:polygon(0 0,100% 50%,0 100%); }
    .gx-side h3 { font:600 .95rem var(--font-display); letter-spacing:.14em; text-transform:uppercase; color:#e0553a; margin:.2rem 0 .4rem; text-align:center; }
  `));

  // ---- side-panel registry ------------------------------------------------------------------------------------------------------------------
  const panels = {}; let cur = null, host = null, floatEl = null, floatHost = null, lastPt = null;
  const ctx = params => ({ S: G.S, E: G.player(), Q, G, params: params || {}, show: (n, p) => UI.Side.show(n, p), defaultPanel: () => UI.Galaxy.showDefault(), map: UI.Galaxy.map, UI,
    // Enter / Esc answer the panel while it is up (unbound by the next show); the newest binding wins, so they shadow the screen's Esc = game menu
    keys: (enter, esc) => { if (!cur) return; const o = { screen: 'galaxy' }; cur.keyOffs = [enter && UI.bindKey('enter', enter, o), esc && UI.bindKey('Escape', esc, o)].filter(Boolean); },
    // a pick on the map moves the panel beside that click (re-rendered there with `extra` merged into its params); true when it moved
    follow: extra => {
      if (!cur || cur.params.float || !floatHost) return false;
      const name = cur.name, p = Object.assign({}, cur.params, extra, { float: true });
      UI.Galaxy.showDefault();                                                                              // the sidebar goes back to the star / colony it was showing
      UI.Side.show(name, p); return true;
    } });
  UI.Side = {
    register(name, def) { panels[name] = def; },
    has: n => !!panels[n],
    current: () => (cur ? cur.name : null),
    // A HELD panel is the turn's pending question (exploration/colonise card, pre-battle choice, battle result). While one is held nothing can replace it
    // and the galaxy screen re-shows it on enter(): a replaced prompt is a turn that waits forever on a panel nobody can see (the "Year … spinner" freeze).
    held: null,
    hold(name, params, onDrop) {
      if (UI.Side.held) { if (onDrop) { try { onDrop(); } catch (e) { console.error(e); } } return null; }     // the pipeline waits on ONE prompt: a second hold is a stale scene finishing late — settle it, keep the live one
      const hd = { name, params, onDrop }; UI.Side.held = hd; UI.Side.showHeld(); return hd;
    },
    release(hd) { if (UI.Side.held === hd) UI.Side.held = null; },
    showHeld() {
      const hd = UI.Side.held; if (!hd) return false;
      if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') { if (UI.Screens.has('galaxy')) UI.Screens.go('galaxy'); return true; }     // enter() shows it
      if (hd.params && hd.params.star !== undefined && hd.params.star >= 0 && UI.Galaxy.map) { try { UI.Galaxy.map.centerOn(hd.params.star, { animate: true }); } catch (e) { /* optional */ } }
      UI.Side.show(hd.name, hd.params, hd);
      return true;
    },
    drop() { const hd = UI.Side.held; UI.Side.held = null; if (hd && hd.onDrop) { try { hd.onDrop(); } catch (e) { console.error(e); } } },
    show(name, params, _hd) {
      if (!host) return;
      if (UI.Side.held && _hd !== UI.Side.held) return;                      // the prompt stays; the player may still click around the map (selection highlights, no panel change)
      const def = panels[name]; if (!def) { console.warn('no side panel', name); return; }
      if (cur && cur.keyOffs) { cur.keyOffs.forEach(off => off()); cur.keyOffs = null; }
      if (cur && cur.def.dispose) { try { cur.def.dispose(); } catch (e) { console.error(e); } }
      // params.float: render beside the last map click (UI.Side.place) and leave the sidebar as it is; any other panel closes the float
      const float = !!(params && params.float && floatHost), tgt = float ? floatHost : host;
      if (floatEl && (float || floatEl.classList.contains('on'))) { UI.clear(floatHost); floatEl.classList.toggle('on', float); }
      const changed = !cur || cur.name !== name || (cur.params && params && cur.params.star !== params.star);
      if (!float) UI.clear(host);
      if (changed && !(M.Settings && M.Settings.get && M.Settings.get('reduceMotion'))) { tgt.classList.remove('reveal'); void tgt.offsetWidth; tgt.classList.add('reveal'); }
      cur = { name, params: params || {}, def, host: tgt };
      if (float) delete floatEl.dataset.placed;
      try { def.render(tgt, ctx(cur.params)); if (float && !floatEl.dataset.placed) UI.Side.place(); }   // a panel that placed itself (with its own avoid list) keeps that spot
      catch (e) {
        console.error('[side panel ' + name + ']', e);
        if (float) floatEl.classList.remove('on');
        if (name !== 'star' && name !== 'colony') { cur = null; UI.clear(tgt); try { UI.Galaxy.showDefault(); } catch (e2) { console.error(e2); } }
      }
    },
    refresh() { if (cur && cur.def.refresh && cur.host) { try { cur.def.refresh(cur.host, ctx(cur.params)); } catch (e) { console.error('[side refresh]', e); } } },
    // move the floating panel beside the last click on the map, inside the map. avoid: points (map px) it should not cover, e.g. the stars the
    // fleet can reach: of the four sides of the click (right, left, below, above) it takes the one hiding the fewest, preferring the right
    place(avoid) {
      if (!floatEl || !floatEl.classList.contains('on') || !mapWrap) return;
      const W = mapWrap.clientWidth, H = mapWrap.clientHeight, pw = floatEl.offsetWidth, ph = floatEl.offsetHeight, gap = 30, m = 8, pad = 14;
      const p = lastPt || { x: W / 2, y: H / 2 };
      const fit = (x, y) => ({ x: Math.max(m, Math.min(W - pw - m, x)), y: Math.max(m, Math.min(H - ph - m, y)) });
      const cands = [fit(p.x + gap, p.y - ph * 0.4), fit(p.x - gap - pw, p.y - ph * 0.4), fit(p.x - pw * 0.4, p.y + gap), fit(p.x - pw * 0.4, p.y - gap - ph)];
      const covers = (c, q) => q.x > c.x - pad && q.x < c.x + pw + pad && q.y > c.y - pad && q.y < c.y + ph + pad;
      let best = cands[0], bs = Infinity;
      cands.forEach((c, i) => {
        let sc = i * 0.1 + (covers(c, p) ? 1000 : 0);                                                         // never over the click itself
        for (const q of avoid || []) if (covers(c, q)) sc += 1;
        if (sc < bs) { bs = sc; best = c; }
      });
      floatEl.style.left = Math.round(best.x) + 'px'; floatEl.style.top = Math.round(best.y) + 'px'; floatEl.dataset.placed = '1';
    },
    floating: () => !!(floatEl && floatEl.classList.contains('on')),
    title(star, owner) {                    // common header: planet/star name + owner banner
      const E = owner !== undefined && owner >= 0 ? G.S.empires[owner] : null;
      return h('div.side-title', h('span.nm', G.S.stars[star].name), E ? h('span.own', h('span.empire-dot', { style: { '--c': 'var(--emp' + E.color + ')' } }), E.plural) : null);
    },
  };

  // ---- the screen -----------------------------------------------------------------------------------------------------------------------------
  let el, mapWrap, hudEl, msgEl, busyEl, map = null, offs = [];
  const NAV = [['Game', 'g', () => UI.gameMenu && UI.gameMenu()], ['Design', 'd', () => go('design')], ['Fleet', 'f', () => go('fleets')], ['Map', 'm', () => go('mapoverview')],
    ['Races', 'r', () => go('races')], ['Planets', 'p', () => go('planets')], ['Tech', 't', () => go('tech')]];
  // while a turn is processing the other screens stay closed: a pending card/scene must keep the player's attention, and the state is mid-turn
  const turnLocked = () => { if (!G.busy) return false; if (G.pending) UI.toast('Answer the prompt in the side panel first (' + G.pending.type + ')', 'warn', 2200); else UI.toast('The turn is still being processed', 'warn', 1800); return true; };
  function go(screen, params) { if (turnLocked()) return; if (UI.Screens.has(screen)) UI.Screens.go(screen, Object.assign({ from: 'galaxy' }, params)); else UI.toast('That screen is not built yet', 'warn'); }
  UI.Galaxy = {
    map: null, go, pick: null,                    // pick: temporary star-click handler used by Reloc / Trans / fleet destination selection
    cycleColony: (dir, pred) => cycleColony(dir, pred),
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
    // opts.sticky: a turn report — stays until the next turn starts (or is clicked away); opts.star: clicking the line selects that star (the original's
    // notices sat over the map with the colony's sliders live underneath, so the ratios could be changed at once)
    message(text, kind, opts) {
      if (!msgEl) return; const o = opts || {};
      const m = h('div.m' + (kind ? '.' + kind : '') + (o.sticky ? '.sticky' : '') + (o.star >= 0 ? '.link' : ''), text);
      if (o.star >= 0) { m.title = 'Click to view'; m.addEventListener('click', () => { if (G.busy) return; UI.Galaxy.selectStar(o.star); if (map) map.centerOn(o.star, { animate: true }); m.remove(); }); }
      else m.addEventListener('click', () => m.remove());
      msgEl.appendChild(m);
      if (!o.sticky) setTimeout(() => m.remove(), 9000);
      while (msgEl.children.length > 6) msgEl.firstChild.remove();
    },
    clearMessages(all) { if (!msgEl) return; for (const m of [...msgEl.children]) if (all || m.classList.contains('sticky')) m.remove(); },
    floatSkip() { if (document.getElementById('gx-float-skip')) return; const b = UI.button('Skip this step', () => { if (G.skipWait) G.skipWait(); b.remove(); if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy'); }, { primary: true }); b.id = 'gx-float-skip'; b.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:99999'; document.body.appendChild(b); M.Bus.once('turn:end', () => b.remove()); },
    skipBtn(on) { if (!busyEl) return; let b = busyEl.querySelector('.skip'); if (!b) { b = h('div.skip', { style: { marginTop: '.8rem' } }, UI.button('Skip this step', () => { if (G.skipWait) G.skipWait(); UI.Galaxy.skipBtn(false); if (UI.Screens.current && UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy'); }, { primary: true })); busyEl.firstChild.appendChild(b); } b.style.display = on ? '' : 'none'; },
    busy(on, text) { if (!on) UI.Galaxy.skipBtn(false); if (!busyEl) return; busyEl.classList.toggle('on', !!on); if (text) { const sk = busyEl.querySelector('.skip'); UI.mount(busyEl.firstChild, h('span.spin'), text); if (sk) busyEl.firstChild.appendChild(sk); } },
    endTurn,
  };

  // the year is an odometer: it stays in place while the rest of the HUD is rebuilt (on every state change), and the digits that change at the end
  // of a turn roll over (css .od); a new or loaded game sets it without the roll. Reduce motion makes the roll instant (base.css / options.js).
  let yearEl = null, yearNum = null, chipEl = null, restEl = null, yearShown = '';
  // the values of the HUD as the turn began (hudSnap, taken at turn:processing) against which the first HUD after turn:end is compared: the
  // reserve, income, research and colony count that changed light up (css .chg), so the end of a turn reads as a beat, not a silent swap
  let hudSnap = null, hudFlashUntil = 0, hudChg = {};
  const hudVals = () => { const o = {}; if (restEl) restEl.querySelectorAll('b[data-k]').forEach(b => { o[b.dataset.k] = b.textContent; }); return o; };
  function setYear(y) {
    const s = String(y), prev = yearShown; yearShown = s;
    if (!prev || prev === s || prev.length !== s.length) { yearNum.textContent = s; return; }
    UI.clear(yearNum);
    for (let i = 0; i < s.length; i++) yearNum.appendChild(s[i] === prev[i] ? document.createTextNode(s[i]) : h('span.od', h('span.od-in', h('span', prev[i]), h('span', s[i]))));
    const settle = () => { if (yearShown === s && yearNum.querySelector('.od')) yearNum.textContent = s; };   // plain text again once rolled (screen readers, scripts)
    yearNum.addEventListener('animationend', settle, { once: true }); setTimeout(settle, 1200);
  }
  function updateHud() {
    if (!hudEl || !G.S) return;
    const S = G.S, E = G.player(), f = E.flow || {}, rp = E.research.total | 0;
    const colonies = S.planets.filter(p => p.owner === E.id).length;
    if (!yearEl) { yearNum = h('span.yn'); yearEl = h('span.y', 'Year ', yearNum); chipEl = h('span.gx-chip'); restEl = h('span.gx-hudr'); UI.mount(hudEl, yearEl, chipEl, restEl); }
    setYear(Q.year(S));
    UI.mount(chipEl, logChip());                                                       // phones only: the turn log's chip beside the year (css/phone.css lays the HUD out as year | chip / values)
    UI.mount(restEl,
      h('span', h('span.k', 'Reserve'), h('b.t-gold', { dataset: { k: 'bc' } }, U.fmt(E.bc)), ' ', h('span.t-gold', 'BC'), f.taxToReserve ? h('span.t-leaf.small', ' +' + f.taxToReserve) : null),
      h('span', h('span.k', 'Income'), h('b' + ((f.net | 0) < (f.gross | 0) * 0.6 ? '.t-rose' : '.t-leaf'), { dataset: { k: 'net' } }, U.fmt(f.net | 0)), h('span.k.gx-gross', ' of ' + U.fmt(f.gross | 0))),
      h('span', h('span.k', 'Research'), h('b.t-cyan', { dataset: { k: 'rp' } }, U.fmt(rp)), h('span.t-cyan', ' RP')),
      h('span', h('span.k', 'Colonies'), h('b', { dataset: { k: 'col' } }, colonies)), attentionChips());
    const now = performance.now();
    if (hudSnap && now < hudFlashUntil) { restEl.querySelectorAll('b[data-k]').forEach(b => { if (hudSnap[b.dataset.k] !== undefined && hudSnap[b.dataset.k] !== b.textContent) hudChg[b.dataset.k] = now + 1300; }); hudSnap = null; }
    for (const k in hudChg) { if (now < hudChg[k]) { const b = restEl.querySelector('b[data-k="' + k + '"]'); if (b) b.classList.add('chg'); } else delete hudChg[k]; }
  }
  // phones: the turn log's count in the HUD. In portrait the sidebar is a bottom sheet and the log under it was only seen at full height; the
  // chip opens the whole log (css/phone.css shows it in portrait only — landscape keeps the sidebar column with the log in it)
  function logChip() {
    if (!(M.Phone && M.Phone.active()) || !UI.TurnLog || !UI.TurnLog.counts) return null;
    const c = UI.TurnLog.counts(); if (!c.log && !c.next) return null;
    const tone = c.worst === 0 ? '.r' : c.worst === 1 ? '.w' : '';
    return h('span.gx-logc' + tone, { tip: 'What happened last turn and what is coming up. Tap to read it; each line takes you to its star.', onclick: () => UI.TurnLog.openSheet() },
      UI.icon('list'), c.log ? h('span', 'Last turn ', h('b', c.log)) : h('span', 'Coming up ', h('b', c.next)));
  }
  // the HUD's count of colonies needing a look: a click (or I) steps through them, most urgent first
  function attentionChips() {
    let L = []; try { L = attentionList(); } catch (e) { return null; }
    if (!L.length) return null;
    const raids = L.filter(x => x.a.threat).length, rest = L.length - raids;
    return h('span.gx-att', { tip: 'Colonies that need a look: raids on the way, unrest, shrinking population, waste, idle factories. Click or press <b>I</b> to step through them (Shift+I back).', onclick: () => cycleAttention(1) },
      raids ? h('span.r', '⚠ ' + raids) : null, rest ? h('span.w', '! ' + rest) : null);
  }

  async function endTurn() {
    if (!G.S || G.busy) return;
    if (UI.modalOpen()) return;
    if (UI.Galaxy.pendingSend && UI.Galaxy.pendingSend() === false) return;      // a queued fleet move is accepted automatically (an invalid one stops the turn with its message)
    if (M.Settings.get('confirmEndTurn')) {
      const S = G.S, E = G.player(), issues = [];
      for (const p of S.planets) if (p.owner === E.id && p.sliders[0] > 0 && !(p.build === -1 || (p.build >= 0 && E.designs[p.build]))) issues.push([p.starId, p.name, ' spends on ships with no design to build']);
      if (E.research && E.research.slider.every(v => !v) && (E.research.total | 0) > 0) issues.push([-2, 'No research field', ' is funded']);
      // each named colony is a link: it cancels the end of turn and opens that colony (the research line opens the Tech screen)
      const fix = id => { UI.closeAllModals(); if (id === -2) UI.Screens.go('tech', { from: 'galaxy' }); else { UI.Galaxy.selectStar(id); if (map) map.centerOn(id, { animate: true }); } };
      const li = ([id, name, rest]) => h('li', h('span.tl-a', { tip: id === -2 ? 'Open the Tech screen' : 'Go to this colony', onclick: () => fix(id) }, name), rest);
      if (issues.length) { const ok = await UI.confirm(h('div', h('p', 'End the turn anyway?'), h('ul', issues.slice(0, 6).map(li))), { title: 'Before you end the turn' }); if (!ok) return; }
    }
    UI.Galaxy.busy(true, 'Year ' + Q.year(G.S) + ' …');
    UI.sfx('turn');                                                                           // the stamp and rising sweep (the 'newturn' chime answers it at turn:end, soundscape.js)
    if (UI.Phone) UI.Phone.haptic('turn');                                                    // phones: a tick as the turn starts
    // 10 s without an answer is normal while the player reads a scene (combat, GNN, council, audience, landing), a modal or a held side-panel prompt:
    // those all carry their own controls, so the Skip escape is offered ONLY when nothing visible can answer the pending step (a genuinely stuck turn).
    let lateSkip = 0;
    const off = M.Bus.on('turn:waiting', type => {
      const onGalaxy = UI.Screens.current && UI.Screens.current.id === 'galaxy';
      if (!onGalaxy || UI.modalOpen() || UI.Side.held) {
        // a scene or a prompt is up and carries its own controls; only if the SAME step is still pending much later is the floating Skip offered there (a hung scene must not be a dead end)
        clearTimeout(lateSkip);
        const p = G.pending;
        const live = () => type === 'gnn' && UI.GNN && UI.GNN.isOnAir && UI.GNN.isOnAir();   // a GNN on air waits for the player by design (its last story never times out) and has its own Continue / Skip
        lateSkip = setTimeout(() => { if (G.busy && G.pending === p && !live()) UI.Galaxy.floatSkip(); }, 45000);
        return;
      }
      UI.Galaxy.busy(true, 'Year ' + Q.year(G.S) + ' … waiting on “' + type + '”'); UI.Galaxy.skipBtn(true);
    });
    try { await G.endTurn(); }
    catch (e) { UI.toast('The turn could not be completed: ' + (e && e.message || e) + '. Load a save or report this.', 'bad', 12000); }
    finally { if (typeof off === 'function') off(); clearTimeout(lateSkip); UI.Galaxy.busy(false); }
    if (UI.Screens.current && UI.Screens.current.id !== 'galaxy' && G.S && !(G.last && G.last.over)) UI.Screens.go('galaxy');
    UI.Galaxy.refresh();
    if (G.S) { const me = G.player(); if (me.alive) UI.Galaxy.selectStar(G.sel.star >= 0 ? G.sel.star : me.capital, { keepPanel: false }); }
  }

  // ---- hotkeys (research/06 §4.6) ------------------------------------------------------------------------------------------------------------------
  function cycleColony(dir, pred) {
    if (G.busy) return;
    const S = G.S, mine = S.planets.filter(p => p.owner === S.playerId && (!pred || pred(p)));
    if (!mine.length) return;
    let i = mine.findIndex(p => p.starId === G.sel.star); i = (i + dir + mine.length) % mine.length;
    if (i < 0) i = 0;
    const id = mine[i].starId; UI.Galaxy.selectStar(id); if (map) map.centerOn(id, { animate: true });
  }
  // colonies needing a look (Q.attention), most urgent first: raids by arrival, then red warnings, then amber ones
  function attentionList() {
    const S = G.S, A = Q.attention(S, S.playerId), rank = a => a.threat ? a.threat.eta : a.issues.some(x => x.k === 'bad') ? 100 : 200;
    return Object.keys(A).map(Number).sort((a, b) => rank(A[a]) - rank(A[b]) || a - b).map(id => ({ star: id, a: A[id] }));
  }
  function cycleAttention(dir) {
    if (G.busy || !G.S) return;
    const L = attentionList(); if (!L.length) { UI.toast('Nothing needs your attention right now.', 'ok', 2200); return; }
    let i = L.findIndex(x => x.star === G.sel.star); i = i < 0 ? (dir > 0 ? 0 : L.length - 1) : (i + dir + L.length) % L.length;
    const id = L[i].star; UI.Galaxy.selectStar(id); if (map) map.centerOn(id, { animate: true });
  }
  function bindKeys() {
    const scr = { screen: 'galaxy' };
    NAV.forEach(([name, key, fn]) => offs.push(UI.bindKey(key, fn, scr)));
    offs.push(UI.bindKey('n', endTurn, scr));
    offs.push(UI.bindKey('ctrl+enter', endTurn, scr));
    offs.push(UI.bindKey('F2', () => cycleColony(-1), scr)); offs.push(UI.bindKey('F3', () => cycleColony(1), scr));
    const withShips = p => !!M.Sim.Fleet.at(G.S, p.starId, G.S.playerId);
    offs.push(UI.bindKey('F4', () => cycleColony(1, withShips), scr)); offs.push(UI.bindKey('F5', () => cycleColony(-1, withShips), scr));
    offs.push(UI.bindKey('i', e => cycleAttention(e && e.shiftKey ? -1 : 1), scr));
    offs.push(UI.bindKey('F10', () => { if (G.saveSlot('auto')) UI.toast('Game saved', 'ok'); else UI.toast('The game could not be saved (browser storage full or blocked). Use Game › Save › Export to a file.', 'bad', 8000); }, scr));
    offs.push(UI.bindKey('Escape', () => { if (UI.gameMenu) UI.gameMenu(); }, scr));
    offs.push(UI.bindKey('Home', () => { if (map) map.centerOn(G.player().capital, { animate: true }); }, scr));
    offs.push(UI.bindKey('c', () => { if (map && G.sel.star >= 0) map.centerOn(G.sel.star, { animate: true }); }, { screen: 'galaxy' }));
    // the original's Alt-R (research/06 §4.6): point every colony's rally line at the selected colony; pressed again (all already point there) it resets them all
    offs.push(UI.bindKey('alt+r', () => {
      if (G.busy || !G.S) return;
      const S = G.S, E = G.player(), id = G.sel.star, q = id >= 0 ? S.planets[id] : null;
      if (!q || q.owner !== E.id) { UI.sfx('error'); UI.toast('Select one of your colonies first: Alt+R sends every colony\'s new ships there.', 'warn'); return; }
      const others = S.planets.filter(p => p.owner === E.id && p.id !== q.id), already = others.length && others.every(p => p.reloc === q.id);
      const r = G.order({ t: 'relocAll', to: already ? -1 : q.id }); if (!r.ok) { UI.toast(r.msg, 'bad'); return; }
      UI.sfx('click'); UI.toast(already ? 'Rally points cleared: new ships stay where they are built.' : 'Every colony now sends its new ships to ' + S.stars[q.starId].name + '. Alt+R again clears them.', 'ok');
      UI.Galaxy.refresh();
    }, scr));
  }

  UI.Screens.register('galaxy', {
    create(root) {
      mapWrap = h('div.gx-mapwrap');
      hudEl = h('div.gx-hud'); msgEl = h('div.gx-msg');
      busyEl = h('div.gx-busy', h('div.box'));
      host = h('div.gx-sidebody');
      const logEl = h('div');
      const side = h('aside.gx-side', h('div.panel', host), logEl);
      if (UI.TurnLog) UI.TurnLog.mount(logEl);                                                              // "Last turn": links to where things happened
      const navBtns = NAV.map(([name, key, fn]) => UI.button(name, fn, { kbd: key.toUpperCase() }));
    const nextBtn = UI.button('Next turn', () => endTurn(), { primary: true, big: true, kbd: 'N', sfx: false });   // endTurn plays the turn cue once the turn really starts
    const bar = h('nav.gx-bar', navBtns, h('span.gx-spacer'), nextBtn);
    const waitEl = h('span.gx-wait');
    bar.insertBefore(waitEl, nextBtn);
    let waitTimer = 0;
    const WAIT_LABEL = { explore: 'a scout report', colonize: 'the colony decision', battles: 'a battle', techChoice: 'a research choice', tech: 'a breakthrough', gnn: 'the news', council: 'the Council vote', councilResult: 'the Council ruling', diplomacy: 'an audience', ground: 'a ground battle', bombardPrompt: 'the bombard decision', bombard: 'the bombardment', event: 'an event', spyStealChoice: 'the spy choice', spySabotageChoice: 'the sabotage choice', aiPlan: 'the other empires', built: 'the shipyards', notice: 'a report' };
    const paintWait = () => { const p = G.pending; waitEl.textContent = !G.busy ? '' : p ? 'Waiting for ' + (WAIT_LABEL[p.type] || p.type) + '…' : 'Turn in progress…'; };
    M.Bus.on('turn:processing', on => {
      if (on) UI.Galaxy.clearMessages(false);                                                           // last turn's reports make way for this turn's
      navBtns.slice(1).forEach(b => b.classList.toggle('turn-locked', !!on)); nextBtn.classList.toggle('turn-locked', !!on);     // "Game" (menu) stays usable; its Save/Load/Quit are gated separately
      clearInterval(waitTimer); waitTimer = on ? setInterval(paintWait, 250) : 0; paintWait();
    });
      el = h('div.gx', mapWrap, side, bar);
      root.appendChild(el);
      mapWrap.appendChild(h('div.gx-top', hudEl, msgEl)); mapWrap.appendChild(busyEl);
      floatHost = h('div.gx-sidebody'); floatEl = h('aside.gx-side.gx-float', h('div.panel', floatHost)); mapWrap.appendChild(floatEl);
      mapWrap.addEventListener('pointerdown', e => {                                                       // where the hand is: the floating panel opens beside it
        if (floatEl.contains(e.target)) return;
        const r = mapWrap.getBoundingClientRect(); lastPt = { x: e.clientX - r.left, y: e.clientY - r.top };
      }, true);
      bindKeys();
      M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'galaxy') { updateHud(); UI.Side.refresh(); } });
      M.Bus.on('turnlog', () => updateHud());
      M.Bus.on('turn:processing', on => { if (on) hudSnap = hudVals(); });
      M.Bus.on('turn:end', () => { hudFlashUntil = performance.now() + 4000; });
      M.Bus.on('game:new', () => { yearShown = ''; }); M.Bus.on('game:loaded', () => { yearShown = ''; });   // a jump in years is not a turn: no roll
      M.Bus.on('turn:aborted', () => UI.Side.drop()); M.Bus.on('turn:skipped', () => UI.Side.drop());    // the prompt is moot: let it resolve and go
      let saveWarned = false;                                                                               // a silently failing autosave used to be discovered only at the Save screen
      M.Bus.on('save:failed', slot => { if (slot !== 'auto' || saveWarned) return; saveWarned = true; UI.toast('Autosave failed: browser storage is full or blocked. Export a save file from Game › Save.', 'bad', 10000); });
      M.Bus.on('saved', slot => { if (slot === 'auto') saveWarned = false; });
    },
    enter() {
      if (!G.S) { UI.Screens.go('menu'); return; }
      if (!map && M.UI.GalaxyMap) {
        map = UI.Galaxy.map = M.UI.GalaxyMap.create(mapWrap, {});
        map.on('selectStar', id => { if (UI.Galaxy.pick) UI.Galaxy.pick(id); else UI.Galaxy.selectStar(id); });
        map.on('dblStar', id => {
          G.sel.star = id; if (!UI.Screens.has('system')) return;
          // the system view is a continuation of the zoom (visual-system-plan.md 2.7): fly in on the star, then cross-fade; the galaxy
          // screen flies back out to this camera when the player returns. Reduce motion and phones cut straight across.
          const cam = map.getCamera ? map.getCamera() : null, cut = !cam || (M.Settings && M.Settings.get('reduceMotion')) || (M.Phone && M.Phone.active());
          const go = () => UI.Screens.go('system', { star: id, from: 'galaxy' });
          if (cut) { go(); return; }
          UI.Galaxy.camBeforeSystem = { x: cam.x, y: cam.y, zoom: cam.zoom };
          map.centerOn(id, { zoom: Math.min(cam.maxZoom || 12, Math.max(5, cam.zoom * 1.6)), animate: true });
          setTimeout(go, 420);
        });
        // your fleet in orbit opens its deployment in the sidebar, leaving the map clear; the panel floats beside the destination once one is picked
        map.on('selectFleet', fid => { G.sel.fleet = fid; const f = G.S.fleets.find(x => x.id === fid); if (f && f.owner === G.S.playerId) UI.Side.show(f.star >= 0 ? 'fleetDeploy' : 'fleetInfo', { star: f.star, fleet: fid }); else if (f) UI.Side.show('fleetInfo', { fleet: fid }); });
        map.on('moveOrder', o => {
          const f = G.S.fleets.find(x => x.id === o.fleetId); if (!f || f.star < 0 || f.owner !== G.S.playerId) return;
          if (UI.Side.current() === 'fleetDeploy' && UI.Galaxy.pick) { UI.Galaxy.pick(o.toStar); return; }      // the panel is open with the player's own counts: just set the destination
          UI.Side.show('fleetDeploy', { star: f.star, dest: o.toStar, send: true, float: true });                              // otherwise a right-click is "send the fleet there"
        });
      }
      UI.Galaxy.refresh();
      if (UI.Side.held) { UI.Side.showHeld(); return; }                                    // back from another screen while the turn waits on a prompt: the prompt, not the default panel
      const star = G.sel.star >= 0 ? G.sel.star : G.player().capital;
      if (map) map.centerOn(star, { animate: false });
      const back = UI.Galaxy.camBeforeSystem; UI.Galaxy.camBeforeSystem = null;
      if (map && back) map.centerOn({ x: back.x, y: back.y }, { zoom: back.zoom, animate: true });     // back from the system view: fly out to where the map was
      UI.Galaxy.selectStar(star);
    },
    leave() { },
    resize() { if (map && map.resize) map.resize(); },
  });
})(window.MOO);
