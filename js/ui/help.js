// Help system (research/06 §10, §7.3): the F1 overlay of annotated boxes with leader lines, the Almanac screen ('help'), and the one-time tutor pop-ups (Simple/Easy only).
//   MOO.UI.Help.overlay([screenId])      F1 — freezes the current screen under a dim veil and points boxes at its widgets; Space / click / → = next page, ← = back, any other key or right-click = close
//   MOO.UI.Help.register(screenId, pages | () => pages)   pages = [{title, text, items:[{sel:'css' | ['css',…], text, at:[fx,fy]?}]}] — `sel` may use [data-help="screen.part"] hooks other screens add
//   MOO.UI.Help.install()                 binds F1 (works on every screen, also over modals) + the tutor triggers; idempotent (also called once when this file loads)
//   MOO.UI.Help.close() · isOpen()        MOO.UI.Help.tutor.check() runs the tutor tests now · MOO.UI.Help.tutor.reset() forgets which topics were shown
//   Screen 'help' = the Almanac: Races · Technology · Ships & components · Planets & stars · Rules · Controls · Tips, with a search box (Esc / Space / right-click = back to params.from).
//   Reads Data.Races / Techs / Components / text, Settings ('tutor', 'tutorSeen'), Game.S (difficulty, player). Everything optional is guarded.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util, doc = document;
  const Help = (UI.Help = {});
  const clamp = U.clamp, min = Math.min, max = Math.max;
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const gfx = n => (M.Gfx && M.Gfx[n]) || null;

  // ================================================================================================================================ css
  UI.css('help', `
    .hp-ov { position:absolute; inset:0; z-index:60; pointer-events:auto; cursor:pointer; background:radial-gradient(ellipse at 50% 45%, rgba(3,5,18,.55), rgba(3,5,18,.82)); animation:scrim-in .2s ease-out both; }
    .hp-svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
    .hp-svg line { stroke:var(--brass-hi); stroke-width:1.6; } .hp-svg rect { fill:rgba(243,220,160,.07); stroke:var(--brass-hi); stroke-width:1.5; stroke-dasharray:6 4; } .hp-svg circle { fill:var(--brass-hi); }
    .hp-box { position:absolute; width:17rem; max-width:40vw; padding:.5rem .7rem .55rem; font-size:.95rem; line-height:1.35; color:var(--ivory); background:linear-gradient(135deg, var(--brass-lo), #2a3260 40%, #2a3260 60%, var(--brass-lo)); --ch:.4rem; clip-path:polygon(var(--ch) 0, calc(100% - var(--ch)) 0, 100% var(--ch), 100% calc(100% - var(--ch)), calc(100% - var(--ch)) 100%, var(--ch) 100%, 0 calc(100% - var(--ch)), 0 var(--ch)); isolation:isolate; }
    .hp-box::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:inherit; background:linear-gradient(180deg, rgba(18,26,66,.97), rgba(8,12,34,.98)); }
    .hp-box b { color:var(--brass-hi); font-weight:600; }
    .hp-main { left:50%; top:1.2rem; transform:translateX(-50%); width:min(46rem, 90vw); max-width:none; text-align:center; padding:.7rem 1.2rem .8rem; }
    .hp-main h2 { font:400 1.6rem var(--font-title); color:var(--brass-hi); letter-spacing:.04em; margin-bottom:.25rem; } .hp-main p { margin:.1rem 0; color:var(--ivory); }
    .hp-main small { display:block; margin-top:.4rem; color:var(--mist); letter-spacing:.08em; }
    .al { position:absolute; inset:0; display:flex; padding:1rem 1.3rem; overflow:hidden; background:radial-gradient(110% 80% at 10% 0%, #1a2672 0%, rgba(26,38,114,0) 58%), radial-gradient(90% 70% at 100% 100%, #2c1a5c 0%, rgba(44,26,92,0) 62%), var(--void); }
    .al-sheet { flex:1 1 auto; min-width:0; max-width:112rem; margin:0 auto; display:flex; flex-direction:column; min-height:0; padding:.8rem 1rem .9rem; }
    .al-head { display:flex; align-items:flex-end; gap:1rem; padding-bottom:.55rem; margin-bottom:.4rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .al-title { font:400 2.1rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; text-shadow:0 0 22px rgba(214,179,106,.28); } .al-sub { padding-bottom:.18rem; color:var(--mist); }
    .al-search { margin-left:auto; width:min(22rem, 40%); } .al-body { flex:1 1 auto; min-height:0; overflow:auto; padding:.2rem .3rem .6rem 0; }
    .al-foot { display:flex; justify-content:flex-end; gap:.6rem; padding-top:.6rem; border-top:1px solid rgba(214,179,106,.2); margin-top:.4rem; }
    .al .tabs { flex-wrap:wrap; } .al .tabs button .n { margin-left:.35em; font:500 .72rem var(--font-ui); color:var(--cyan); }
    .al-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(26rem, 1fr)); gap:.7rem; }
    .al-card { position:relative; padding:.6rem .8rem .7rem; background:linear-gradient(180deg, rgba(18,26,66,.7), rgba(8,12,34,.75)); border:1px solid rgba(214,179,106,.25); }
    .al-card h3 { font:400 1.35rem var(--font-title); color:var(--brass-hi); margin-bottom:.15rem; } .al-card h3 small { font:400 .85rem var(--font-ui); color:var(--mist); margin-left:.5rem; letter-spacing:.04em; }
    .al-card p { margin:.25rem 0; line-height:1.4; } .al-card ul { margin:.25rem 0 .1rem 1.1rem; padding:0; } .al-card li { margin:.18rem 0; line-height:1.35; }
    .al-race { display:grid; grid-template-columns:7.2rem 1fr; gap:.7rem; } .al-race canvas { width:100%; height:auto; display:block; background:rgba(0,0,0,.3); border:1px solid rgba(214,179,106,.3); }
    .al-chips { display:flex; flex-wrap:wrap; gap:.3rem; margin:.3rem 0; } .al-dim { color:var(--mist); font-size:.9rem; }
    .al-sec { margin:1rem 0 .4rem; font:400 1.25rem var(--font-display); color:var(--brass); letter-spacing:.1em; text-transform:uppercase; border-bottom:1px solid rgba(214,179,106,.25); padding-bottom:.2rem; }
    .al .tbl td, .al .tbl th { padding:.22rem .5rem; } .al .tbl td.d { color:var(--mist); font-size:.92rem; white-space:normal; min-width:16rem; } .al .tbl td.k { color:var(--cyan); white-space:nowrap; }
    .al-hit { background:rgba(243,220,160,.1); }
    .tu-box h4 { font:400 1.2rem var(--font-title); color:var(--brass-hi); margin-bottom:.4rem; } .tu-box p { line-height:1.45; }
  `);

  // ================================================================================================================================ the F1 overlay
  const registry = {};
  Help.register = function (screenId, pages) { registry[screenId] = pages; };
  let ov = null;
  Help.isOpen = () => !!ov;
  Help.close = function () {
    if (!ov) return;
    window.removeEventListener('keydown', ov.key, true); ov.el.remove(); ov = null;
  };
  function targetRect(sel) {
    const list = Array.isArray(sel) ? sel : [sel];
    for (const s of list) {
      if (!s) continue; let el = null;
      try { el = doc.querySelector(s); } catch (e) { el = null; }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }
    return null;
  }
  const hit = (a, b) => a.x < b.x + b.w + 8 && a.x + a.w + 8 > b.x && a.y < b.y + b.h + 8 && a.y + a.h + 8 > b.y;
  function render(page, idx, total) {
    const el = ov.el; UI.clear(el);
    const W = innerWidth, H = innerHeight, svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'hp-svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); el.appendChild(svg);
    const main = h('div.hp-box.hp-main', h('h2', page.title || 'Help'), page.text ? h('p', { html: page.text }) : null, h('small', (total > 1 ? 'Page ' + (idx + 1) + ' of ' + total + ' — ' : '') + (idx < total - 1 ? 'Space or click: next · Esc: close' : 'Press any key to close')));
    el.appendChild(main);
    const placed = [{ x: main.offsetLeft, y: main.offsetTop, w: main.offsetWidth, h: main.offsetHeight }];
    const line = (x1, y1, x2, y2) => { const l = doc.createElementNS(svg.namespaceURI, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); svg.appendChild(l); };
    const loose = []; let n = 0;
    for (const it of (page.items || [])) {
      const r = (it.sel && targetRect(it.sel)) || (it.at ? { left: it.at[0] * W, top: it.at[1] * H, right: it.at[0] * W, bottom: it.at[1] * H, width: 0, height: 0 } : null);
      const box = h('div.hp-box', { html: it.text }); box.style.visibility = 'hidden'; el.appendChild(box);
      const bw = box.offsetWidth, bh = box.offsetHeight;
      if (!r) { loose.push(box); box.style.visibility = ''; continue; }
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const cands = [[cx - bw / 2, r.bottom + 30], [cx - bw / 2, r.top - bh - 30], [r.right + 30, cy - bh / 2], [r.left - bw - 30, cy - bh / 2], [r.left + 16, r.top + 16], [W - bw - 14, H * 0.3 + n * 20]];
      let best = null;
      for (const c of cands) {
        const x = clamp(c[0], 10, W - bw - 10), y = clamp(c[1], 10, H - bh - 10), rc = { x, y, w: bw, h: bh };
        if (!placed.some(p => hit(p, rc))) { best = rc; break; }
        if (!best) best = rc;
      }
      box.style.left = best.x + 'px'; box.style.top = best.y + 'px'; box.style.visibility = ''; placed.push(best); n++;
      const bcx = best.x + bw / 2, bcy = best.y + bh / 2;
      if (r.width > 0) { const rect = doc.createElementNS(svg.namespaceURI, 'rect'); rect.setAttribute('x', r.left - 3); rect.setAttribute('y', r.top - 3); rect.setAttribute('width', r.width + 6); rect.setAttribute('height', r.height + 6); svg.appendChild(rect); }
      const tx = clamp(bcx, r.left, r.right), ty = clamp(bcy, r.top, r.bottom);
      const sx = clamp(tx, best.x, best.x + bw), sy = clamp(ty, best.y, best.y + bh);
      line(sx, sy, tx, ty); const dot = doc.createElementNS(svg.namespaceURI, 'circle'); dot.setAttribute('cx', tx); dot.setAttribute('cy', ty); dot.setAttribute('r', 4); svg.appendChild(dot);
    }
    let y = main.offsetTop + main.offsetHeight + 16;           // notes without a widget go in a column under the title
    for (const box of loose) { box.style.left = (W / 2 - box.offsetWidth / 2) + 'px'; box.style.top = y + 'px'; y += box.offsetHeight + 8; }
  }
  function fallbackPages(id) {
    return [{ title: 'Help', text: 'There is no annotated help for this screen yet. These keys work everywhere:', items: [
      { at: [0.5, 0.45], text: '<b>Space</b> accepts or continues, <b>Esc</b> or a right-click cancels or goes back. The first letter of a button is its hotkey.' },
      { at: [0.5, 0.6], text: '<b>F1</b> shows this help, <b>F10</b> quick-saves, <b>F3</b> toggles the performance overlay. The Almanac (Game menu) explains every rule.' }] }];
  }
  Help.overlay = function (screenId) {
    if (ov) { Help.close(); return true; }
    const cur = UI.Screens.current, id = screenId || (cur && cur.id) || 'galaxy';
    let pages = registry[id]; if (typeof pages === 'function') { try { pages = pages(); } catch (e) { console.error(e); pages = null; } }
    if (!pages || !pages.length) pages = fallbackPages(id);
    let idx = 0;
    const el = h('div.hp-ov');
    const key = e => {
      e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace' || e.key === 'PageUp') { if (idx > 0) { idx--; render(pages[idx], idx, pages.length); } }
      else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') Help.close();
    };
    const next = () => { if (idx < pages.length - 1) { idx++; render(pages[idx], idx, pages.length); UI.sfx('click'); } else Help.close(); };
    el.addEventListener('click', e => { e.preventDefault(); next(); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); Help.close(); });
    ov = { el, key }; (doc.getElementById('overlay') || doc.body).appendChild(el);
    window.addEventListener('keydown', key, true);
    render(pages[0], 0, pages.length);
    return true;
  };

  // ---- pages for the screens that exist (selectors are the real DOM classes; [data-help] hooks win when other screens add them) ---------------------------------
  const hp = (name, ...sel) => ['[data-help="' + name + '"]', ...sel];
  Help.register('galaxy', () => {
    const colony = UI.Side && UI.Side.current && UI.Side.current() === 'colony';
    return [{ title: 'The control screen', text: 'Everything starts here. The galaxy map on the left, the context panel on the right and the button row below.', items: [
      { sel: hp('galaxy.map', '.gx-mapwrap'), text: '<b>Galaxy map.</b> Drag to pan, wheel to zoom. Click a star to select it; double-click for its system view. Fleets are the small arrows; a green route is within fuel range, red is not.' },
      { sel: hp('galaxy.hud', '.gx-hud'), text: '<b>Year, reserve, income, research.</b> The reserve pays for upkeep, spies and tribute — keep some BC in it.' },
      { sel: hp('galaxy.side', '.gx-side'), text: '<b>Context panel.</b> Shows the selected colony, star or fleet. Your colonies show five spending sliders; other stars show what you know about them.' },
      { sel: hp('galaxy.bar', '.gx-bar'), text: '<b>Button row.</b> Game · Design · Fleet · Map · Races · Planets · Tech, and <b>Next turn</b>. Each opens with its first letter; N ends the turn.' }] },
    colony ? { title: 'The colony panel', text: 'Every colony divides its output among five sliders that always add up to 100%.', items: [
      { sel: hp('colony.stats', '.sc-stats'), text: '<b>Population, bases, factories, waste, production.</b> Production is what the colony can spend after upkeep (the number in brackets is its gross output).' },
      { sel: hp('colony.sliders', '.sc-sliders'), text: '<b>Ship · Def · Ind · Eco · Tech.</b> Click or drag; the padlock fixes a slider while the others rebalance. Eco never drops below the level that keeps the planet clean.' },
      { sel: hp('colony.build', '.sc-build'), text: '<b>Build box.</b> What the Ship slider builds. <b>Ships</b> chooses a design, <b>Reloc</b> sets the rally point for new ships, <b>Trans</b> moves up to half the population to another colony.' }] }
      : { title: 'Select a colony', text: 'Click one of your own stars to see its five sliders (Ship, Def, Ind, Eco, Tech), its build box and the Ships / Reloc / Trans buttons.', items: [] },
    { title: 'Keys on the control screen', text: 'Mouse-only play works everywhere; these make it fast.', items: [
      { at: [0.3, 0.45], text: '<b>G D F M R P T</b> open Game, Design, Fleet, Map, Races, Planets and Tech. <b>N</b> ends the turn. <b>Home</b> centres on your capital, <b>C</b> on the selection, <b>X</b> shows the spies caught.' },
      { at: [0.3, 0.65], text: '<b>F2 / F3</b> cycle your colonies, <b>F4 / F5</b> colonies with ships, <b>F10</b> quick-saves, <b>F1</b> is this help.' }] }];
  });
  Help.register('planets', [{ title: 'The planets ledger', text: 'One row per colony; click a row to open it. Sort by clicking a column heading.', items: [
    { sel: hp('planets.table', '.lp-tablewrap'), text: '<b>Colonies.</b> Population (with its growth), factories, shield, bases, waste, production and what the shipyard is building.' },
    { sel: hp('planets.sliders', '.lp-sl'), text: '<b>Tax and security.</b> Tax turns up to 20% of output into reserve (only half arrives). Security protects you from enemy spies.' },
    { sel: hp('planets.foot', '.lp-reserve', '.lp-foot'), text: '<b>Reserve.</b> The empire treasury. <b>Transfer</b> moves BC from it into a planet, which can then spend up to double its output.' }] }]);
  Help.register('fleets', [{ title: 'The fleet screen', text: 'Every ship you own, by star and design.', items: [
    { sel: hp('fleets.grid', '.lf-grid', '.lf-sheet'), text: '<b>Fleet grid.</b> One row per star with your ships, one column per design. Click a stack to select it, then choose what to do.' },
    { sel: hp('fleets.maint', '.lf-maint', '.lf-foot'), text: '<b>Upkeep.</b> Every ship costs about 2% of its price in BC every year. Scrapping an obsolete design refunds a quarter of its cost.' }] }]);
  Help.register('specs', [{ title: 'Ship specifications', text: 'The full numbers of one design: attack level, missile defence, hit points, warp, shields and cost.', items: [] }]);
  Help.register('tech', [{ title: 'Research', text: 'Six fields advance side by side. Each turn a share of your research points goes into the project of every field.', items: [
    { sel: hp('tech.tabs', '.tch-tabs'), text: '<b>Field tabs.</b> Computers, Construction, Force Fields, Planetology, Propulsion, Weapons — plus an overview.' },
    { sel: hp('tech.sliders', '.tch-sl'), text: '<b>Allocation sliders.</b> One per field, 2% steps; lock a field to keep its share. The total research comes from every colony’s Tech slider.' },
    { sel: hp('tech.project', '.tch-proj'), text: '<b>Current project.</b> When the invested points exceed its cost, the tech arrives with a growing chance each turn (the breakthrough meter).' },
    { sel: hp('tech.list', '.tch-listp', '.tch-list'), text: '<b>Known and available techs.</b> When a field finishes, you choose the next project from the list.' }] }]);
  Help.register('design', [{ title: 'The ship designer', text: 'A design is a hull plus components. You can keep six designs; a design is locked once ships of it exist.', items: [
    { sel: hp('design.parts', '.dz-mc'), at: [0.3, 0.3], text: '<b>Hull and slots.</b> Computer, shield, ECM, armor, engine and manoeuvre, four weapon slots and three special devices — everything must fit the hull’s space.' },
    { sel: hp('design.stats', '.dz-cmp'), at: [0.7, 0.55], text: '<b>Live numbers.</b> Attack level, missile defence, hit points, warp, cost and free space update as you choose. Newer tech makes components smaller and cheaper (miniaturisation).' },
    { sel: hp('design.build', '.dz-btns'), at: [0.5, 0.85], text: '<b>Build</b> stores the design; colonies then build it with their Ship slider. A colony ship needs a colony-base special on a large hull.' }] }]);
  Help.register('races', [{ title: 'Races and diplomacy', text: 'What you know about every empire.', items: [
    { sel: hp('races.cells', '.rc-grid'), at: [0.3, 0.4], text: '<b>Attitude bar.</b> From hostile (red) to friendly (green): it decides what a leader will agree to in an audience.' },
    { sel: hp('races.foot', '.rx-foot'), at: [0.7, 0.6], text: '<b>Spies.</b> Choose Hide, Espionage or Sabotage for each target and set the security slider. <b>Audience</b> opens talks: treaties, trade, tribute, tech exchange.' }] }]);
  Help.register('mapoverview', [{ title: 'Galaxy map overview', text: 'The whole galaxy in one picture.', items: [
    { sel: hp('overview.modes', '.ov-modes'), at: [0.8, 0.2], text: '<b>Colonies / Environments / Minerals.</b> Switch the filter: empire flags, which planets you can colonise now (green) and which you cannot yet (red), or the mineral and artifact specials.' }] }]);
  Help.register('combat', [{ title: 'Tactical combat', text: 'Ships fight on a 10 × 8 grid; each ship acts in initiative order.', items: [
    { sel: hp('combat.bar', '.cb-btns'), at: [0.5, 0.92], text: '<b>Command bar.</b> Auto · Planet · Scan · Missiles · Special · Retreat · Wait · Done. Click a square to move, an enemy to fire everything that reaches it.' },
    { sel: hp('combat.field', '.cb-field'), at: [0.5, 0.4], text: 'Beams never run out; missiles and torpedoes do. Rocks block movement and shield against missiles. Battles happen only in orbit over a planet.' }] }]);
  Help.register('landing', [{ title: 'Landings and bombardment', text: 'Space skips ahead, Esc skips the whole scene.', items: [
    { at: [0.5, 0.45], text: '<b>Invasion.</b> Transports run past the missile bases, then troops fight in rounds; each exchange rolls d100 plus the force rating of each side, the loser loses one trooper, ties go to the defender.' },
    { at: [0.5, 0.7], text: '<b>Bombardment.</b> After a battle your ships may bomb the planet: they kill colonists and factories; biological weapons also shrink its maximum population.' }] }]);
  Help.register('help', [{ title: 'The Almanac', text: 'A reference for every race, technology, ship part, planet type and rule.', items: [
    { sel: '.al .tabs', text: '<b>Tabs.</b> Races, Technology, Ships &amp; components, Planets &amp; stars, Rules, Controls and Tips.' },
    { sel: '.al-search', text: '<b>Search.</b> Type to filter the current tab; tabs that contain matches show a count.' }] }]);

  // ================================================================================================================================ tutor pop-ups (Simple / Easy only; once per topic; remembered in Settings)
  const TOPICS = [
    { id: 'start', title: 'Welcome, emperor', text: 'You rule one colony. Open it (click your home star) and look at the five spending sliders: Industry builds factories, Ecology keeps the planet clean, Tech funds research and Ship builds ships. Send your scouts out with the Fleet panel, and press <b>N</b> to end the turn.', test: S => S.turn === 0 },
    { id: 'noRP', title: 'No research', text: 'Your scientists have nothing to do: not one colony puts any of its output into <b>Tech</b>, so you produce 0 research points. Select a colony and drag its <b>Tech</b> slider up (or open <b>Tech</b> to see the six fields).', test: (S, E) => S.turn >= 1 && E.alive && (E.research.total | 0) <= 0 && S.planets.some(p => p.owner === E.id) },
    { id: 'contact', title: 'First contact', text: 'You have met another empire. Open <b>Races</b> to see its attitude and ask for an audience: a non-aggression pact is a cheap way to keep the peace while you grow.', test: (S, E) => (E.relations || []).some(r => r && r.contact && r.with !== E.id) },
    { id: 'bases', title: 'An undefended colony', text: 'A populous colony without missile bases invites raiders. Give it a few points on the <b>Def</b> slider so it can build bases and, later, a planetary shield.', test: (S, E) => S.planets.some(p => p.owner === E.id && p.pop >= 70 && !(p.bases > 0)) },
    { id: 'year30', title: 'Thirty years in', text: 'By now neighbours are growing too. Check the <b>Races</b> screen for rivals who out-produce you, and keep a few warships near your core.', test: S => S.turn >= 29 },
    { id: 'year70', title: 'The long game', text: 'After seventy years the Galactic Council and the big wars are close. Votes follow population, so a large, friendly empire wins elections.', test: S => S.turn >= 69 },
    { id: 'factories', title: 'Fifty factories', text: 'A big industrial base pollutes. Watch each colony’s waste figure and keep Ecology above the “clean” level or its population cap will fall.', test: (S, E) => E.race !== 'silicoid' && S.planets.some(p => p.owner === E.id && p.factories >= 50) },
    { id: 'engines', title: 'Better engines', text: 'Nuclear engines move ships two parsecs a turn. Design a new ship to use them: old hulls keep their old engines.', test: (S, E) => E.mods && E.mods.warp >= 2 },
    { id: 'shield', title: 'Planetary shields', text: 'A Class V planetary shield absorbs part of every hit on a colony. The Def slider pays for it before it builds more bases.', test: (S, E) => S.planets.some(p => p.owner === E.id && p.shield >= 5) },
    { id: 'soil', title: 'Soil enrichment', text: 'Soil enrichment makes a planet fertile: growth is faster and its maximum population rises 25%. The Ecology slider pays for it.', test: (S, E) => E.mods && E.mods.soil },
    { id: 'atmos', title: 'Atmospheric terraforming', text: 'You can now turn a hostile planet into a normal one. The project is paid from the Ecology slider.', test: (S, E) => E.mods && E.mods.atmos },
    { id: 'advsoil', title: 'Advanced soil enrichment', text: 'Advanced soil enrichment turns a planet into a Gaia world: growth doubles and its capacity rises by half.', test: (S, E) => E.mods && E.mods.advSoil },
    { id: 'stargate', title: 'Star gates', text: 'Intergalactic star gates move fleets and transports between two of your gated colonies in a single turn. A gate costs 3000 BC and cannot be scrapped.', test: (S, E) => E.mods && E.mods.stargate },
  ];
  const seen = () => { try { return Object.assign({}, M.Settings.get('tutorSeen') || {}); } catch (e) { return {}; } };
  let tutorBusy = false;
  const tutor = Help.tutor = {
    enabled() { const S = G && G.S; return !!S && (S.settings.diffIdx | 0) <= 1 && M.Settings.get('tutor') !== false; },
    reset() { M.Settings.set('tutorSeen', {}); },
    check() {
      const S = G && G.S; if (!S || tutorBusy || !tutor.enabled() || ov) return false;
      const cur = UI.Screens.current; if (!cur || cur.id !== 'galaxy' || UI.modalOpen()) return false;
      const E = G.player(), done = seen();
      for (const t of TOPICS) {
        if (done[t.id]) continue;
        let ok = false; try { ok = !!t.test(S, E); } catch (e) { ok = false; }
        if (!ok) continue;
        done[t.id] = true; M.Settings.set('tutorSeen', done); tutorBusy = true;
        UI.modal({ title: 'Tutor', cls: 'tu-box', width: '30rem', body: h('div.tu-box', h('h4', t.title), h('p', { html: t.text })), buttons: [{ label: 'Turn the tutor off', value: 'off' }, { label: 'Got it', value: true, primary: true }] })
          .then(v => { tutorBusy = false; if (v === 'off') M.Settings.set('tutor', false); });
        return true;
      }
      return false;
    },
  };

  // ================================================================================================================================ install
  let installed = false;
  Help.install = function () {
    if (installed) return; installed = true;
    UI.bindKey('F1', () => Help.overlay(), { modal: true });
    if (M.Bus) {
      M.Bus.on('turn:end', () => setTimeout(() => tutor.check(), 700));
      M.Bus.on('screen', id => { if (id === 'galaxy') setTimeout(() => tutor.check(), 900); });
    }
  };

  // ================================================================================================================================ the Almanac
  const T_ = () => M.Data && M.Data.Techs, C_ = () => M.Data && M.Data.Components, R_ = () => M.Data && M.Data.Races;
  const fldCode = f => (T_() ? T_().FIELD_CODES[f].toUpperCase() : f);
  const tbl = (cols, rows, o) => {
    const t = h('table.tbl'), head = h('tr'), body = h('tbody');
    cols.forEach(c => head.appendChild(h('th' + (c.r ? '.r' : ''), c.t)));
    t.appendChild(h('thead', head));
    rows.forEach(r => { const tr = h('tr.al-row', { dataset: { s: (r.map(x => (x && x.s) || (typeof x === 'string' || typeof x === 'number' ? String(x) : '')).join(' ')).toLowerCase() } });
      r.forEach((x, i) => tr.appendChild(h('td' + (cols[i].r ? '.r' : '') + (cols[i].cls ? '.' + cols[i].cls : ''), x && x.n ? x.n : x))); body.appendChild(tr); });
    t.appendChild(body); void o; return t;
  };
  const sec = txt => h('div.al-sec.al-row-keep', txt);
  const card = (title, sub, ...kids) => h('div.al-card.al-row', h('h3', title, sub ? h('small', sub) : null), ...kids);
  const bullets = list => h('ul', list.map(x => h('li', { html: x })));

  function racesTab() {
    const R = R_(); if (!R) return h('p', 'No race data.');
    const cards = [], jobs = [], Tc = T_(), mulLabels = ['CM', 'CN', 'FF', 'PL', 'PR', 'WE'];
    const MODS = { tradePts: v => 'Trade +' + v + ' pts', posActMul: v => 'Positive acts ×' + v, tributeMul: v => 'Tribute ×' + v, aiMoodBonus: v => 'AI mood +' + v, councilBonus: v => 'Council vote +' + v, compLevel: v => 'Ship computer +' + v, initiative: v => 'Initiative +' + v, defense: v => 'Beam defence +' + v,
      misDefense: v => 'Missile defence +' + v, groundBonus: v => 'Ground combat +' + v, workerMul: v => 'Worker output ×' + v, operBonus: v => '+' + v + ' factories per colonist', researchMul: v => 'Research ×' + v, growthMul: v => 'Growth ×' + v, ecoGrowthMul: v => 'Bought growth ×' + v, spyCostMul: v => 'Spy cost ×' + v,
      spyOff: v => 'Spying +' + v + '%', spyDef: v => 'Counter-spying +' + v + '%', allTerrain: () => 'Settles any planet', noWaste: () => 'No pollution', halfGrowth: () => 'Slow growth', noPlague: () => 'Immune to plague', noAccident: () => 'No industrial accidents', noSoil: () => 'No soil or terraform projects', noRefit: () => 'Free factory refits' };
    const REL = { 12: 'relaxed', 0: 'neutral', '-12': 'uneasy', '-24': 'wary', '-36': 'restless' };
    for (const id of R.ORDER) {
      const rc = R.races[id], cv = h('canvas', { width: 180, height: 225 });
      jobs.push(() => { try { const P = gfx('Portraits'); if (P && P.canvas) cv.getContext('2d').drawImage(P.canvas(id, 180, 225, { mood: 'neutral', color: rc.art && rc.art.primary }), 0, 0); } catch (e) { /* portraits are optional */ } });
      const mods = Object.keys(MODS).filter(k => rc.mod && rc.mod[k] && rc.mod[k] !== 1 && rc.mod[k] !== 0 && rc.mod[k] !== false).map(k => h('span.chip.cy', MODS[k](rc.mod[k])));
      const pc = Tc && Tc.RACE_COST_MUL && Tc.RACE_COST_MUL[id];
      const rel = Object.keys(rc.startRelations || {}).filter(o => o !== id && rc.startRelations[o] !== 12).map(o => (R.races[o].plural) + ' ' + (REL[rc.startRelations[o]] || rc.startRelations[o]));
      cards.push(h('div.al-card.al-row', { dataset: { s: [rc.name, rc.plural, rc.tagline, rc.desc, (rc.traits || []).map(t => t.label + ' ' + t.text).join(' ')].join(' ').toLowerCase() } }, h('div.al-race', h('div', cv),
        h('div', h('h3', rc.plural, h('small', rc.tagline)), h('p', rc.desc),
          h('div.al-chips', (rc.traits || []).map(t => h('span.chip.' + (t.good ? 'ok' : 'bad'), { tip: t.text }, t.label))),
          bullets((rc.traits || []).map(t => '<b>' + t.label + '.</b> ' + t.text)), mods.length ? h('div.al-chips', mods) : null,
          pc ? h('p.al-dim', 'Research cost per field: ' + mulLabels.map((l, i) => l + ' ' + pc[Tc.FIELD_CODES[i]] + '%').join(' · ')) : null,
          rel.length ? h('p.al-dim', 'Starts toward: ' + rel.join(', ') + '.') : null, h('p.al-dim', 'Homeworld ' + rc.homeworld + ' · leaders ' + (rc.leaders || []).slice(0, 4).join(', ') + '.')))));
    }
    setTimeout(() => jobs.forEach((j, i) => setTimeout(j, i * 40)), 30);
    return h('div.al-grid', cards);
  }
  function techTab() {
    const T = T_(); if (!T) return h('p', 'No technology data.');
    const S = G && G.S, E = S && G.player(), race = E ? E.race : 'human', di = S ? S.settings.diffIdx | 0 : 2, out = [];
    out.push(h('p.al-dim', 'Research cost is shown for ' + (E ? 'your empire' : 'a Human empire on Average') + ' (race and difficulty multiply a cost that grows with the square of the tech level). Each game offers a random subset of these techs.'));
    for (let f = 0; f < 6; f++) {
      const list = (T.byField[f] || []).filter(t => t.type !== 'advanced').slice().sort((a, b) => a.level - b.level);
      out.push(sec(T.FIELD_NAMES[f] + ' — ' + list.length + ' technologies'));
      out.push(tbl([{ t: 'Lv', r: 1 }, { t: 'Technology' }, { t: 'RP', r: 1 }, { t: 'Effect' }], list.map(t => [String(t.level), { n: h('b', t.name), s: t.name }, t.free ? 'start' : U.fmt(T.costHuman(t.level, race, f, di)), { n: t.desc, s: t.desc + ' ' + t.type }])));
    }
    out.push(h('p.al-dim', 'Each field also has ten “Advanced Tech” steps (levels 55–100) that unlock nothing but raise the field’s tech level.'));
    return h('div', out);
  }
  function shipsTab() {
    const C = C_(), T = T_(); if (!C) return h('p', 'No component data.');
    const tech = t => (t && t.tech ? fldCode(t.tech.f) + ' ' + t.tech.l : '');
    const bc = v => (v / 10).toFixed(1).replace(/\.0$/, '');
    const four = a => (a || []).map(bc).join(' / ');
    const out = [];
    out.push(sec('Hulls'), tbl([{ t: 'Hull' }, { t: 'Cost BC', r: 1 }, { t: 'Space', r: 1 }, { t: 'Hit points', r: 1 }, { t: 'Defence', r: 1 }], C.HULLS.map(x => [x.name, bc(x.cost), String(x.space / 10), String(x.hits), (x.defense > 0 ? '+' : '') + x.defense])));
    out.push(sec('Engines'), tbl([{ t: 'Engine' }, { t: 'Warp', r: 1 }, { t: 'Tech' }], C.ENGINES.map(x => [x.name, String(x.warp), tech(x)])));
    out.push(sec('Battle computers'), tbl([{ t: 'Computer' }, { t: 'Attack level', r: 1 }, { t: 'Cost S/M/L/H' }, { t: 'Tech' }], C.COMPUTERS.map(x => ['Mark ' + x.name, String(x.level), four(x.cost), tech(x)])));
    out.push(sec('ECM jammers'), tbl([{ t: 'Jammer' }, { t: 'Missile defence', r: 1 }, { t: 'Tech' }], C.ECM.map(x => [x.name, '+' + x.level, tech(x)])));
    out.push(sec('Deflector shields'), tbl([{ t: 'Shield' }, { t: 'Absorbs per hit', r: 1 }, { t: 'Tech' }], C.SHIELDS.map(x => ['Class ' + x.name.replace(/^Class /, ''), String(x.absorb), tech(x)])));
    out.push(sec('Armor'), tbl([{ t: 'Armor' }, { t: 'Hit points', r: 1 }, { t: 'Tech' }], C.ARMOR.map(x => [x.name + (x.heavy ? ' II' : ''), x.pct + '%', tech(x)])));
    out.push(sec('Special devices'), tbl([{ t: 'Device' }, { t: 'What it does' }, { t: 'Tech' }], C.SPECIALS.map(x => [{ n: h('b', x.name), s: x.name }, { n: x.desc, s: x.desc, cls: 'd' }, tech(x)])));
    out.push(sec('Weapons'), tbl([{ t: 'Weapon' }, { t: 'Kind' }, { t: 'Damage', r: 1 }, { t: 'Range', r: 1 }, { t: 'Notes' }, { t: 'Tech' }], C.WEAPONS.filter(x => x.grant).map(x => [{ n: h('b', x.name), s: x.name }, x.kind, x.dmg ? x.dmg[0] + '–' + x.dmg[1] : '', String(x.range), { n: x.desc, s: x.desc, cls: 'd' }, tech(x)])));
    void T; return h('div', out);
  }
  function planetsTab() {
    const out = [];
    out.push(sec('Planet types — one planet per star'), tbl([{ t: 'Type' }, { t: 'Class' }, { t: 'Max population' }, { t: 'Needed to settle' }], [
      ['Radiated', 'hostile', '10–40', 'Controlled Radiated Environment (Planetology 18)'], ['Toxic', 'hostile', '10–40', 'Controlled Toxic Environment (PL 15)'], ['Inferno', 'hostile', '10–40', 'Controlled Inferno Environment (PL 12)'],
      ['Dead', 'hostile', '20–50', 'Controlled Dead Environment (PL 9)'], ['Tundra', 'hostile', '20–50', 'Controlled Tundra Environment (PL 6)'], ['Barren', 'hostile', '30–50', 'Controlled Barren Environment (PL 3)'],
      ['Minimal', 'standard', '30–50', 'nothing — every colony ship can settle it'], ['Desert', 'standard', '35–50', 'nothing'], ['Steppe', 'standard', '45–60', 'nothing'], ['Arid', 'standard', '55–70', 'nothing'], ['Ocean', 'standard', '65–80', 'nothing'], ['Jungle', 'standard', '75–90', 'nothing'], ['Terran', 'standard', '85–100', 'nothing']]));
    out.push(h('p.al-dim', 'A planet’s “size” is its maximum population. Silicoids can settle every type. A hostile world grows at half speed until Atmospheric Terraforming turns it into a Minimal one.'));
    out.push(sec('Growth classes'), tbl([{ t: 'Class' }, { t: 'Growth' }, { t: 'How you get it' }], [['Hostile', '× ½', 'radiated … barren planets'], ['Normal', '× 1', 'most standard planets'], ['Fertile', '× 1.5, +25% max population', 'born that way (1 in 12) or Soil Enrichment (Planetology 16, 150 BC)'], ['Gaia', '× 2, +50% max population', 'Advanced Soil Enrichment (Planetology 30, 300 BC)']]));
    out.push(sec('Mineral and special richness'), tbl([{ t: 'Special' }, { t: 'Effect' }], [['Ultra poor', 'ship, defence and industry output × ⅓'], ['Poor', '× ½'], ['Normal', 'no change'], ['Rich', '× 2'], ['Ultra rich', '× 3'], ['Artifacts', 'research × 2; the first ship to explore it may find a technology'], ['Orion', 'research × 4 — guarded by the Guardian until it is destroyed']]));
    out.push(sec('Stars'), tbl([{ t: 'Star' }, { t: 'Share', r: 1 }, { t: 'Its planets' }], [['Yellow', '15%', 'the best odds of temperate, standard-habitable worlds'], ['Red', '30%', 'old dull stars; mostly poor, small worlds'], ['Green', '25%', 'a wide range of planet types'], ['Blue', '15%', 'young, mineral-rich, mostly lifeless worlds'], ['White', '10%', 'very hot; generally hostile'], ['Neutron', '5%', 'rare; the likeliest home of rich planets']]));
    return h('div', out);
  }
  function rulesTab() {
    const R = [
      ['Economy', ['Each operating factory makes 1 BC; workers add <b>pop × (3 × Planetology level + 50) / 100</b>. A worker runs 2 factories, up to 7 with Robotic Controls; a factory costs 10 BC, down to 2 with Construction tech.', 'Upkeep is <b>2%</b> of a ship’s or missile base’s price each year. The <b>tax</b> slider takes 0–20% of output, but only half of it reaches the reserve. 1 BC buys 1 research point.', 'Rich planets multiply Ship, Defence and Industry spending (not Ecology or Tech); Artifacts and Orion multiply research.']],
      ['The five sliders', ['Ship, Def, Ind, Eco and Tech always add up to 100% (4% steps) and can be locked. <b>Ind</b> builds factories up to population × factories-per-worker; <b>Def</b> pays for planetary shields first, then missile bases; <b>Eco</b> cleans waste first, then funds soil, terraforming and bought population; <b>Tech</b> is research.']],
      ['Population & ecology', ['Growth per year is about <b>0.1 × pop × (1 − (pop + waste) / max)</b>; hostile × ½, fertile × 1.5, Gaia × 2. A new colony starts with 2 million.', 'Each operating factory makes 1 waste a year (less with Construction techs); Ecology cleans 2, 3, 5, 10 or 20 per BC. Waste lowers the population cap.', '<b>Transports</b> carry up to half a planet’s population for 1 BC each; they travel at your best engine speed minus one.']],
      ['Research', ['Six fields, each with its own slider (2% steps). Points invested earn 15% interest. Once the project’s cost is covered, it completes with a chance of <b>(invested − cost) / (2 × cost)</b> every turn.', 'A tech’s cost grows with the square of its level; your race and the difficulty multiply it. Each game gives every empire a random subset of the tree, and you choose each next project from a short list.']],
      ['Movement & supply', ['A ship of warp N moves N parsecs a turn along a straight line. You can send ships only to stars within <b>fuel range</b> (3 parsecs) of a colony; Propulsion techs extend it and Reserve Fuel Tanks add 3. Ships left outside the range are lost.', 'Stargates (3000 BC each) link two of your own colonies instantly. Fleets fight only at stars; scanners see 3, 5, 7 or 9 parsecs.']],
      ['Invasion & bombardment', ['Troop transports first run past the planet’s missile bases and any warships in orbit; survivors (at most 300) land. Each exchange both sides roll <b>d100 + force</b>; the loser loses one trooper. Defenders get +5, Bulrathi +25 and ties go to the defender. Force comes from armor, suits, personal shields and weapon techs.', 'A captured planet keeps its factories but loses bases and shields. Each captured factory gives a 2% chance to steal a technology (up to 6).', 'After a battle your ships may <b>bombard</b>: bombs and missiles kill population and factories (planetary shields soak damage); biological weapons also cut the planet’s maximum population; a planet with no one left is destroyed.']],
      ['Diplomacy', ['Relations run from −100 to +100 in 17 steps. In an audience you can propose a non-aggression pact, alliance, trade, tribute or a tech exchange; every leader has a personality (xenophobic, ruthless, aggressive, erratic, honorable, pacifistic) and an objective. Breaking a treaty costs you trust everywhere.', 'Alliances share fuel range and bring allies into your wars; trade pays BC every year up to a quarter of the smaller economy.']],
      ['Espionage', ['Set a spy budget (0–10% of production) per target and a security budget (0–20%). Spies work in one of three modes: <b>Hide</b> (counter-intelligence), <b>Espionage</b> (steal a technology) or <b>Sabotage</b> (destroy factories or bases, or incite a revolt). Caught spies hurt relations.']],
      ['Galactic Council', ['Once two thirds of the stars are colonised, the Council meets every 25 years. Each empire casts <b>population ÷ 100</b> votes (rounded up) for one of the two largest empires. A two-thirds majority elects an Emperor; if it is you, you win; if it is a rival you may accept or defy — defying means a Final War against everyone.']],
      ['Events & monsters', ['From year 41 a random event can strike each year (sixteen kinds, each at most once): plague, earthquake, supernova warning, industrial accident, assassination, computer virus, comet, pirates, derelict ship, rebellion, fertile or rich planets, depleted planets and donations. After year 200 a Space Crystal or Amoeba may roam. The <b>Guardian of Orion</b> holds the richest world; destroying it yields the Death Ray.']],
      ['Victory & defeat', ['You win by being elected Emperor, or by eliminating every rival. You lose when your last colony falls (funeral) or when you accept a rival’s election (exile). There is no score — only the Racial Stats bars.']],
      ['Difficulty', ['Simple, Easy, Average, Hard and Impossible change AI production (× 1.0, 0.8, 1.25, 1.5, 2.0), your research costs (× 20, 25, 30, 35, 40) and event frequency. On Hard and Impossible you start with 40 population instead of 50. The tutor pop-ups appear only on Simple and Easy.']],
    ];
    return h('div.al-grid', R.map(([t, b]) => card(t, '', bullets(b))));
  }
  function controlsTab() {
    const K = [['Control screen', 'G Game · D Design · F Fleet · M Map · R Races · P Planets · T Tech · N Next turn'], ['Cycling', 'F2 / F3 colonies · F4 / F5 colonies with ships · Home capital · C centre on selection'], ['Everywhere', 'Space accept / continue · Esc or right-click cancel / back · first letter of a button = its hotkey · F1 help · F10 quick-save · F3 performance overlay'],
      ['Fleet deployment', 'choose numbers with ◀◀ ◀ ▶ ▶▶, click a destination star (green = in range), Space = Accept, Esc = Cancel'], ['Planets', 'T transfer · O or Space OK · click a heading to sort'], ['Tech', '= equalise sliders · + / − nudge · 1–6 pick a field'], ['Races', 'S status · R report · A audience'],
      ['Tactical combat', 'A auto · P planet · S scan · M missiles · X special · R retreat · W wait · D or Esc done'], ['Bombardment', 'B bomb · Esc cancel · C or Space continue'], ['Colonise / explore', 'Y yes · N no · C or Space continue'], ['Galactic Council', '1 / 2 / 0 vote · Y / N accept or defy · Space continue'], ['Scenes', 'Space or click skips ahead · Esc skips the whole scene']];
    return tbl([{ t: 'Where' }, { t: 'Keys' }], K.map(([a, b]) => [{ n: h('b', a), s: a }, { n: b, s: b }]));
  }
  function tipsTab() {
    const tips = (M.Data && M.Data.text && M.Data.text.tips) || [];
    return h('div.al-grid', tips.map((t, i) => h('div.al-card.al-row', { dataset: { s: t.toLowerCase() } }, h('p', h('b.t-brass', (i + 1) + '. '), t))));
  }
  const TABS = [['races', 'Races', racesTab], ['tech', 'Technology', techTab], ['ships', 'Ships & components', shipsTab], ['planets', 'Planets & stars', planetsTab], ['rules', 'Rules', rulesTab], ['controls', 'Controls', controlsTab], ['tips', 'Tips', tipsTab]];

  let al = null;
  function buildAlmanac(root) {
    const search = h('input.field.al-search', { type: 'search', placeholder: 'Search the almanac…', 'aria-label': 'Search the almanac' });
    const body = h('div.al-body'), tabsEl = h('div.tabs'), btns = {}, cache = {};
    al = { root, search, body, tabsEl, btns, cache, cur: 'races', from: 'galaxy' };
    for (const [id, label] of TABS) { btns[id] = h('button', { type: 'button', onclick: () => { UI.sfx('click'); show(id); } }, label, h('span.n')); tabsEl.appendChild(btns[id]); }
    const back = () => UI.Screens.go(al.from && UI.Screens.has(al.from) ? al.from : (G && G.S ? 'galaxy' : 'menu'));
    const sheet = h('div.panel.al-sheet', h('div.al-head', h('div.al-title', 'Almanac'), h('div.al-sub', 'Races · technology · ships · planets · rules'), search), tabsEl, body, h('div.al-foot', UI.button('OK', back, { primary: true, kbd: 'Space' })));
    root.appendChild(h('div.al', sheet));
    search.addEventListener('input', () => applyFilter());
    root.addEventListener('contextmenu', e => { e.preventDefault(); back(); });
    al.back = back;
    function show(id) {
      al.cur = id; for (const k in btns) btns[k].classList.toggle('active', k === id);
      if (!cache[id]) { const t = TABS.find(x => x[0] === id); try { cache[id] = t[2](); } catch (e) { console.error('[almanac]', id, e); cache[id] = h('p', 'This tab could not be built: ' + e.message); } }
      UI.mount(body, cache[id]); body.scrollTop = 0; applyFilter();
    }
    al.show = show;
    function applyFilter() {
      const q = search.value.trim().toLowerCase();
      for (const [id] of TABS) {                                              // match counts on every tab that has been built
        const c = cache[id]; if (!c) continue;
        const rows = c.querySelectorAll ? c.querySelectorAll('.al-row') : [];
        let n = 0; rows.forEach(r => { const m = !q || (r.dataset.s || r.textContent.toLowerCase()).indexOf(q) >= 0; if (id === al.cur) { r.style.display = m ? '' : 'none'; r.classList.toggle('al-hit', !!q && m); } if (m && q) n++; });
        btns[id].lastChild.textContent = q && n ? String(n) : '';
      }
    }
    show('races');
  }
  UI.Screens.register('help', {
    create(el) { buildAlmanac(el); },
    enter(params) { if (!al) return; al.from = (params && params.from) || (G && G.S ? 'galaxy' : 'menu'); al.search.value = ''; al.show(al.cur || 'races'); },
    leave() { },
    resize() { },
  });
  UI.bindKey('Escape', () => { if (al && document.activeElement === al.search && al.search.value) { al.search.value = ''; al.search.dispatchEvent(new Event('input')); } else if (al) al.back(); }, { screen: 'help' });
  UI.bindKey('space', () => { if (al) al.back(); }, { screen: 'help' });
  Help.install();
})(window.MOO);
