// Side panels for everything that is not an owned colony: star info, fleet deployment (research/06 §5.4), fleets in flight, generic event cards.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('side-misc', `
    .sm-card { display:flex; gap:.7rem; align-items:center; margin:.2rem 0 .55rem; padding:.45rem; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.28); }
    .sm-card.unexp { border-color:var(--rose); } .sm-card .un { font:400 1.3rem var(--font-display); color:var(--leaf); letter-spacing:.12em; }
    .sm-pic { flex:none; width:5.2rem; height:5.2rem; } .sm-pic canvas { width:100%; height:100%; }
    .sm-desc { margin:.4rem 0; color:var(--mist); font-size:.92rem; line-height:1.35; }
    .sm-range { margin:.5rem 0; padding:.35rem .6rem; border-left:3px solid var(--cyan); background:rgba(98,216,255,.07); }
    .sm-range.out { border-left-color:var(--rose); background:rgba(255,92,106,.07); }
    .sm-fleet { display:grid; grid-template-columns: 3.6rem 1fr auto; align-items:center; gap:.5rem; padding:.3rem .4rem; margin:.25rem 0; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.2); }
    .sm-fleet canvas { width:3.6rem; height:2.6rem; object-fit:contain; } .sm-fleet .nm { font:400 1rem var(--font-display); color:var(--brass-hi); } .sm-fleet .ct { color:var(--mist); font-size:.85rem; }
    .sm-step { display:flex; align-items:center; gap:.2rem; } .sm-step .btn { padding:.1em .5em; font-size:.85rem; } .sm-step .n { min-width:2.2rem; text-align:center; font-weight:600; font-variant-numeric:tabular-nums; }
    .sm-route { margin:.5rem 0; padding:.45rem .6rem; font-size:.92rem; border:1px solid var(--leaf); background:rgba(95,220,143,.08); } .sm-route.bad { border-color:var(--rose); background:rgba(255,92,106,.08); }
    .sm-actions { display:flex; gap:.5rem; justify-content:flex-end; margin-top:.6rem; }
    .sm-event h4 { font:400 1.15rem var(--font-display); color:var(--brass-hi); margin:.2rem 0 .4rem; line-height:1.2; }
    .sm-event p { color:var(--ivory); margin:.3rem 0; line-height:1.4; } .sm-event .flag { margin:.35rem 0; padding:.3rem .55rem; border-left:3px solid var(--ember); background:rgba(255,148,64,.08); font-size:.9rem; }
    .sm-event .flag.good { border-left-color:var(--leaf); background:rgba(95,220,143,.07); }
    .sm-card.wide { display:block; padding:0; position:relative; overflow:hidden; aspect-ratio:16 / 7; }
    .sm-card.wide .sm-pic { width:100%; height:100%; } .sm-card.wide .sm-pic canvas { display:block; width:100%; height:100%; object-fit:cover; }
    .sm-card.wide .sc-info { position:absolute; right:.6rem; bottom:.45rem; z-index:1; text-align:right; text-shadow:0 1px 2px #000, 0 0 10px rgba(0,0,0,.9); }
    .sm-card.wide::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%); }
    .sm-flavor { margin:.35rem 0 .1rem; color:var(--mist); font-size:.88rem; line-height:1.4; font-style:italic; }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // the fleet steppers: the sliders' steel buttons with drawn red arrows (single = one step, double = none / all), not text glyphs
  const sbtn = (dir, tip, fn) => { const b = h('button.sm-sb.' + dir, { type: 'button', 'aria-label': tip, onclick: fn }); if (UI.setTip) UI.setTip(b, tip); else b.title = tip; return b; };
  // Restyle: black picture tiles with name plates, framed portrait, green hint text, bevelled steel steppers.
  UI.css('side-misc-orig', bump(`
    .sm-card { gap:.6rem; padding:.3rem; border:0; background:linear-gradient(180deg, #0b0e13, #05070a); box-shadow:0 0 0 1px #d04030, inset 0 0 0 1px rgba(0,0,0,.9); }
    .sm-card.unexp { box-shadow:0 0 0 1px #d04030, inset 0 0 18px rgba(208,64,48,.18); } .sm-card .un { font:600 1.05rem var(--font-display); color:#50e050; letter-spacing:.14em; }
    .sm-desc { color:#e4e8ee; font-size:.88rem; }
    .sm-range { border-left:0; background:#12161b; color:#40e060; font:600 .78rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-align:center; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); }
    .sm-range.out { color:#ff7a5a; background:#1a1210; }
    .sm-fleet { grid-template-columns:3.8rem 1fr auto; gap:.4rem; padding:.2rem; border:0; background:linear-gradient(180deg, #59636f, #454d57); box-shadow:inset 1px 1px 0 rgba(255,255,255,.2), inset -1px -1px 0 rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.6); }
    .sm-fleet canvas { background:#000; box-shadow:inset 0 0 0 1px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.12); }
    .sm-fleet .nm { display:inline-block; padding:.05rem .35rem; font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#f0d048; background:#3a2810; box-shadow:inset 1px 1px 2px rgba(0,0,0,.8); }
    .sm-fleet .ct { margin-top:.15rem; color:#e4e8ee; font-size:.78rem; }
    .sm-step { gap:.22rem; }
    .sm-sb { position:relative; width:1.45rem; height:1.45rem; padding:0; border:0; cursor:pointer; background:linear-gradient(135deg, var(--bev-hi, #8a9aac), var(--bev-mid, #3a4656) 35%, var(--bev-lo, #11161e)); box-shadow:0 0 0 1px #000; }
    .sm-sb:hover { background:linear-gradient(135deg, #8fa3b8, #3a4a60 35%, #141b26); } .sm-sb:active { background:linear-gradient(135deg, var(--bev-lo, #11161e), var(--bev-mid, #3a4656) 70%, var(--bev-hi, #8a9aac)); }
    .sm-sb:focus-visible { outline:1px solid var(--brass-hi); outline-offset:1px; }
    .sm-sb::after { content:""; position:absolute; inset:24% 26%; background:#d04a4a; filter:drop-shadow(0 1px 0 #000); }
    .sm-sb:hover::after { background:#ff6a5a; }
    .sm-sb.prev::after { clip-path:polygon(100% 0, 100% 100%, 0 50%); } .sm-sb.next::after { clip-path:polygon(0 0, 100% 50%, 0 100%); }
    .sm-sb.first::after { inset:24% 18%; clip-path:polygon(0 50%, 50% 0, 50% 50%, 100% 0, 100% 100%, 50% 50%, 50% 100%); }
    .sm-sb.last::after { inset:24% 18%; clip-path:polygon(0 0, 50% 50%, 50% 0, 100% 50%, 50% 100%, 50% 50%, 0 100%); }
    .sm-step .n { min-width:3.4rem; padding:.12rem .35rem; text-align:center; font:600 .85rem var(--font-mono, monospace); color:var(--lime, #b8f060); background:var(--well, #0b0f14); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 rgba(255,255,255,.08); }
    .sm-route { border:0; background:#12161b; color:#40e060; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); } .sm-route.bad { color:#ff7a5a; background:#1a1210; }
    .sm-actions { justify-content:stretch; }
    .sm-event h4 { font:600 .95rem var(--font-display); letter-spacing:.08em; color:#f0d8b0; text-shadow:0 1px 0 #000; }
    .sm-event .flag { border-left:0; background:rgba(0,0,0,.35); color:#d8c8a8; font:600 .74rem/1.4 var(--font-display); letter-spacing:.07em; text-transform:uppercase; box-shadow:inset 1px 1px 2px rgba(0,0,0,.7); }
  `));

  const STAR_TEXT = {
    yellow: 'A yellow star — the best odds of temperate, standard-habitable planets.', red: 'An old, dull star — worlds here are commonly poor in minerals.',
    green: 'A moderately bright star with a wide range of planet types.', blue: 'A young blue star — mineral-rich, mostly lifeless worlds.',
    white: 'A white star burning very hot — its planets are generally hostile.', purple: 'A neutron star — rare, and the likeliest home of rich planets.',
  };
  const emp = e => 'var(--emp' + e.color + ')';
  // one line of scout's-eye flavour per planet (Data.text.planetFlavor), fixed per planet so a card re-shown reads the same
  function planetFlavor(card) {
    const T = M.Data && M.Data.text && M.Data.text.planetFlavor; if (!T) return null;
    const look = card.type === 'none' ? 'asteroids' : card.growth === 'gaia' ? 'gaia' : card.type, pool = T[look];
    if (!pool || !pool.length) return null;
    return pool[((card.id | 0) * 31 + (card.gfx | 0)) % pool.length];
  }
  function planetPic(card, size, owner) {
    const WA = M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(card, M.Game && M.Game.S) : null;   // photoreal orbit card, else the procedural sprite
    if (art) return h('div.sm-pic', WA.canvas(art, size * 2, size * 2, { fit: 'contain' }));
    const c = h('canvas', { width: size * 2, height: size * 2 });
    try {
      const P = M.Gfx.pick('planets'); const look = card.type === 'none' ? 'asteroids' : card.growth === 'gaia' ? 'gaia' : card.type;
      const paint = s2 => { const g = c.getContext('2d'); g.clearRect(0, 0, size * 2, size * 2); g.drawImage(s2, 0, 0, size * 2, size * 2); };
      const sp = P.sprite({ look, seed: card.id * 7919 + (card.gfx | 0), inhabited: owner !== undefined && owner >= 0 }, size * 2, { onReady: s2 => { if (c.isConnected) paint(s2); } }); paint(sp);
    } catch (e) { const x = c.getContext('2d'); x.fillStyle = '#445'; x.beginPath(); x.arc(size, size, size * .8, 0, 6.3); x.fill(); }
    return h('div.sm-pic', c);
  }
  function shipPic(E, slot, w, hh) {
    const c = h('canvas', { width: w * 2, height: hh * 2 }), d = E.designs[slot];
    try { const Sh = M.Gfx.Ships, sp = Sh.sprite(E.race, d.hull, Math.min(w, hh) * 1.8, getComputedStyle(document.documentElement).getPropertyValue('--emp' + E.color), {}, Sh.designKey ? Sh.designKey(E.id, slot, d.name) : null); const k = Math.min(1, (w * 2 - 4) / sp.width, (hh * 2 - 4) / sp.height); c.getContext('2d').drawImage(sp, (w * 2 - sp.width * k) / 2, (hh * 2 - sp.height * k) / 2, sp.width * k, sp.height * k); } catch (e) { /* ignore */ }
    return c;
  }

  // ---- star info -------------------------------------------------------------------------------------------------------------------------------------
  UI.Side.register('star', {
    render(host, ctx) { this.pid = ctx.params.star !== undefined ? ctx.params.star : G.sel.star; this.box = h('div'); host.appendChild(this.box); this.refresh(host, ctx); },
    refresh(host, ctx) {
      const S = G.S, me = G.player(), q = Q.star(S, me.id, this.pid), s = S.stars[this.pid], parts = [];
      const owner = q.owner >= 0 ? S.empires[q.owner] : null;
      parts.push(UI.Side.title(this.pid, q.owner));
      if (!q.explored) {
        parts.push(h('div.sm-card.unexp', h('span.un', 'UNEXPLORED')));
        parts.push(h('div.sm-desc', STAR_TEXT[s.color]));
      } else {
        const c = q.planet;
        parts.push(h('div.sm-card', planetPic(c, 44, q.owner), h('div.sc-info', h('div', h('span.cls.disp', { style: { fontSize: '1.25rem', color: 'var(--brass-hi)' } }, c.typeLabel), c.growthLabel ? h('span.chip' + (c.growth === 'hostile' ? '.warn' : '.ok'), { style: { marginLeft: '.4rem' } }, c.growthLabel) : null),
          c.type === 'none' ? h('div.dim', 'No habitable planet') : h('div', 'POP ', h('b.t-leaf', c.maxPop), ' max'), c.specialLabel ? h('div.t-cyan.small', c.specialLabel + (c.specialNote ? ' — ' + c.specialNote : '')) : null)));
        if (c.id === S.orion && S.guardian && S.guardian.alive) parts.push(h('div.sm-card.unexp', h('span.t-rose', 'The Guardian of Orion stands watch over this world.')));
        if (owner) {
          const seen = q.live ? { pop: S.planets[this.pid].pop, bases: S.planets[this.pid].bases } : q.lastSeen;
          parts.push(h('div.sm-desc', h('b', { style: { color: emp(owner) } }, owner.plural + ' colony'), seen ? (q.live ? '' : ' (last reported)') : ''), seen ? h('div.cell', h('span.dim', 'Pop '), seen.pop, h('span.dim', '   Bases '), seen.bases | 0) : null);
        } else if (c.type !== 'none') parts.push(h('div.sm-desc', 'No colonies.'));
      }
      const out = q.inFuelRange === 0;
      parts.push(h('div.sm-range' + (out ? '.out' : ''), q.range === 0 ? 'Within your territory.' : 'Range ' + q.range + ' parsecs' + (q.inFuelRange === 2 ? ' — reachable only with Reserve Fuel Tanks' : out ? ' — out of fuel range' : '')));
      // fleets in orbit we can see
      const fl = S.fleets.filter(f => f.star === this.pid && f.owner !== me.id && M.Sim.Vis.canSee(S, me, f));
      for (const f of fl) { const E = S.empires[f.owner]; parts.push(h('div.sm-desc', h('b', { style: { color: emp(E) } }, E.plural + ' fleet'), ' — ' + f.ships.reduce((a, b) => a + b, 0) + ' ships in orbit')); }
      const mine = M.Sim.Fleet.at(S, this.pid, me.id);
      if (mine) parts.push(h('div.sm-actions', UI.button('Fleet deployment', () => ctx.show('fleetDeploy', { star: this.pid }), { primary: true })));
      UI.mount(this.box, parts);
    },
  });

  // ---- fleet deployment (original: << < > >> steppers, click destination, Accept) ---------------------------------------------------------------------
  UI.Side.register('fleetDeploy', {
    render(host, ctx) {
      const S = G.S, E = G.player(), star = ctx.params.star; this.star = star; this.rows = {}; this.sel = ctx.params.counts ? ctx.params.counts.slice() : (M.Sim.Fleet.at(S, star, E.id) || { ships: [0, 0, 0, 0, 0, 0] }).ships.slice(); this.dest = ctx.params.dest !== undefined ? ctx.params.dest : -1;
      const fl = M.Sim.Fleet.at(S, star, E.id);
      host.appendChild(UI.Side.title(star, S.playerId)); host.appendChild(h('h3', 'Fleet deployment'));
      if (!fl) { host.appendChild(h('p.dim', 'No ships in orbit.')); host.appendChild(UI.button('Close', () => ctx.defaultPanel())); return; }
      for (let i = 0; i < 6; i++) {
        if (!fl.ships[i] || !E.designs[i]) continue;
        const total = fl.ships[i], step = Math.max(1, Math.floor(total / 10)), nEl = h('span.n', '0');
        const set = v => { this.sel[i] = Math.max(0, Math.min(total, v)); nEl.textContent = this.sel[i] + ' / ' + total; this.update(ctx); this.reach(); };
        nEl.textContent = this.sel[i] + ' / ' + total;
        const row = h('div.sm-fleet', shipPic(E, i, 58, 42), h('div', h('div.nm', E.designs[i].name), h('div.ct', 'speed ' + M.Sim.Design.stats(S, E, i).warp + (M.Sim.Design.stats(S, E, i).tanks ? ' · extra fuel' : ''))),
          h('div.sm-step', sbtn('first', 'None', () => set(0)), sbtn('prev', 'Fewer (' + step + ')', () => set(this.sel[i] - step)), nEl, sbtn('next', 'More (' + step + ')', () => set(this.sel[i] + step)), sbtn('last', 'All', () => set(total))));
        // the wheel over a row: one ship per notch (Shift: a tenth of the group), so a count is set without hunting for the small arrows
        row.addEventListener('wheel', e => { const d = -(e.deltaY || e.deltaX); if (!d) return; e.preventDefault(); set(this.sel[i] + Math.sign(d) * (e.shiftKey ? step : 1)); }, { passive: false });
        host.appendChild(row);
      }
      const float = !!ctx.params.float;
      this.hint = h('div.sc-pickhint', 'Click a destination star · Enter sends · Esc cancels'); this.route = h('div'); this.acc = UI.button('Accept', () => this.accept(ctx), { primary: true, disabled: true });
      const cancel = () => { UI.Galaxy.pick = null; if (UI.Galaxy.map) { UI.Galaxy.map.setRoutePreview(null); UI.Galaxy.map.setReach(null); } ctx.defaultPanel(); };
      host.appendChild(this.hint); host.appendChild(this.route);
      host.appendChild(h('div.sm-actions', UI.button('Cancel', cancel), this.acc));
      // floating beside the click (opened from the map): it follows the hand to each destination clicked, and Enter / Esc answer it from the keyboard
      const place = () => { if (float && UI.Side.place) UI.Side.place(this.avoid()); };
      UI.Galaxy.pick = id => { if (ctx.follow({ dest: id, counts: this.sel.slice() })) return; this.dest = id; this.update(ctx); place(); };   // from the sidebar: the first map pick brings the panel to the hand
      ctx.keys(() => { if (this.dest >= 0 && !this.acc.disabled) this.accept(ctx); }, cancel);
      this.reach(); place();
      UI.Galaxy.pendingSend = () => { if (this.dest < 0 || this.acc.disabled) return true; return this.accept(ctx, true); };   // Next turn auto-accepts the queued move
      this.update(ctx);
      // "select and move on": a right-click on the destination (or a click in route mode) is an explicit send — accept at once when the whole group can go;
      // an invalid route stays on the panel with its reason so the player can change ships or destination
      if (ctx.params.send && this.dest >= 0 && !this.acc.disabled) { setTimeout(() => { if (UI.Side.current() === 'fleetDeploy' && this.dest >= 0 && !this.acc.disabled) this.accept(ctx); }, 0); }
      else if (this.dest >= 0) UI.attention(this.acc);
    },
    // the stars the floating panel should leave visible: every one the fleet can reach, in map pixels
    avoid() {
      const map = UI.Galaxy.map, S = G.S; if (!map || !map.worldToScreen) return [];
      return (this.okStars || []).map(i => map.worldToScreen(S.stars[i].x, S.stars[i].y));
    },
    // dim every star the selected ships cannot reach (fuel range; Reserve Fuel Tanks only count when every selected design has them, as Q.route does)
    reach() {
      const map = UI.Galaxy.map; if (!map || !map.setReach) return;
      const S = G.S, E = G.player(), F = M.Sim.Fleet; let tanks = true, any = 0;
      for (let i = 0; i < 6; i++) { if (!(this.sel[i] > 0)) continue; any += this.sel[i]; if (!M.Sim.Design.stats(S, E, i).tanks) tanks = false; }
      if (!any) tanks = false;
      const ok = []; for (let i = 0; i < S.stars.length; i++) if (i === this.star || (any && F.canReach(S, E, i, tanks))) ok.push(i);
      this.okStars = ok; map.setReach(ok);
    },
    update(ctx) {
      const S = G.S, E = G.player(); if (this.dest < 0) { this.acc.disabled = true; return; }
      const r = Q.route(S, E, this.star, this.dest, this.sel);
      UI.mount(this.route, h('div.sm-route' + (r.ok ? '' : '.bad'), h('b', S.stars[this.dest].name), ' — ', r.ok ? 'ETA ' + r.eta + (r.eta === 1 ? ' turn' : ' turns') + (r.stargate ? ' (stargate)' : '') + ' · ' + r.parsecs + ' parsecs' : r.reason));
      this.acc.disabled = !r.ok; this.acc.classList.toggle('disabled', !r.ok);
      if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview({ from: this.star, to: this.dest, eta: r.eta, valid: r.ok, reason: r.reason, gate: r.ok && r.stargate, legs: r.ok ? r.legs : null });
    },
    accept(ctx, quiet) {
      if (!this.sel.some(n => n > 0)) return true;
      const r = G.order({ t: 'fleetSend', from: this.star, to: this.dest, counts: this.sel.slice() });
      if (!r.ok) { UI.toast(r.msg, 'bad'); return false; }
      UI.sfx('warp'); UI.Galaxy.pick = null; if (UI.Galaxy.map) { UI.Galaxy.map.setRoutePreview(null); UI.Galaxy.map.setReach(null); }
      ctx.defaultPanel(); UI.Galaxy.refresh(); return true;
    },
    dispose() { UI.Galaxy.pendingSend = null; UI.Galaxy.pick = null; if (UI.Galaxy.map) { UI.Galaxy.map.setRoutePreview(null); UI.Galaxy.map.setReach(null); } },
  });

  // ---- fleets in flight / foreign fleets ---------------------------------------------------------------------------------------------------------------
  UI.Side.register('fleetInfo', {
    render(host, ctx) {
      const S = G.S, f = S.fleets.find(x => x.id === ctx.params.fleet); if (!f) { ctx.defaultPanel(); return; }
      const E = S.empires[f.owner], mine = f.owner === S.playerId;
      host.appendChild(h('div.side-title', h('span.nm', E.plural + ' fleet'), h('span.own', h('span.empire-dot', { style: { '--c': emp(E) } }))));
      if (f.star < 0) {
        const fin = mine && f.legs && f.legs.length ? f.legs[f.legs.length - 1].star : f.to, n = mine ? M.Sim.Fleet.etaLeft(S, f) : M.Sim.Fleet.eta(S, f.from, f.to, f.speed, false);
        host.appendChild(h('div.sm-range', 'ETA ' + n + ' turns · destination ', h('b', S.stars[fin].name), mine && f.legs ? ' (via stargate)' : ''));
      }
      else host.appendChild(h('div.sm-range', 'In orbit at ', h('b', S.stars[f.star].name)));
      for (let i = 0; i < 6; i++) { if (!f.ships[i]) continue; if (mine || E.designs[i]) host.appendChild(h('div.sm-fleet', mine ? shipPic(E, i, 58, 42) : h('div'), h('div', h('div.nm', mine ? E.designs[i].name : 'Ship class ' + (i + 1)), h('div.ct', '× ' + f.ships[i])), h('span'))); }
      host.appendChild(h('div.sm-actions', UI.button('Close', () => ctx.defaultPanel())));
    },
  });

  // ---- generic event card (exploration, colonisation prompt, notices, pre-battle) ---------------------------------------------------------------------
  //   UI.Flow.card({title, planetCard?, owner?, body:[strings|Nodes], flags:[{text,good}], buttons:[{label,value,primary}]}) → Promise(value)
  let cardOffs = [];
  UI.Side.register('card', {
    render(host, ctx) {
      const p = ctx.params;
      cardOffs.splice(0).forEach(off => off());
      host.appendChild(p.star !== undefined ? UI.Side.title(p.star, p.ownerId) : h('div.side-title', h('span.nm', p.heading || '')));
      const body = h('div.sm-event');
      if (p.planetCard) {
        const c = p.planetCard, WA = M.Gfx && M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(c, G.S) : null;     // the original's wide planet box: the orbit plate, else the sprite
        body.appendChild(h('div.sm-card' + (art ? '.wide' : ''), art ? h('div.sm-pic', WA.canvas(art, 560, 245, { fx: 0.5, fy: 0.5 })) : planetPic(c, 44, p.ownerId),
          h('div.sc-info', h('div', h('span.cls', { style: { font: '400 1.2rem var(--font-display)', color: 'var(--brass-hi)' } }, c.typeLabel), c.growthLabel ? h('span.chip' + (c.growth === 'hostile' ? '.warn' : '.ok'), { style: { marginLeft: '.4rem' } }, c.growthLabel) : null),
            c.type !== 'none' ? h('div', 'POP ', h('b.t-leaf', c.maxPop), ' max') : h('div.dim', 'No habitable planet'), c.specialLabel ? h('div.t-cyan.small', c.specialLabel) : null)));
      }
      if (p.title) body.appendChild(h('h4', p.title));
      // "Go there": fly the map in close on the star the card is about and select it (the card stays; the turn still waits on it)
      if (p.star !== undefined && p.star >= 0 && UI.Galaxy.map) body.appendChild(h('div.sm-goto', h('span.tl-a', { tip: 'Zoom the galaxy map in on ' + G.S.stars[p.star].name + ' and select it', onclick: () => {
        const m = UI.Galaxy.map; G.sel.star = p.star; m.select(p.star); m.centerOn(p.star, { animate: true, zoom: Math.max(4, (m.getCamera && m.getCamera().zoom) || 0) });
      } }, 'Go there ›')));
      if (p.planetCard && p.flavor !== false) { const line = planetFlavor(p.planetCard); if (line) body.appendChild(h('p.sm-flavor', line)); }
      if (p.star !== undefined && p.star >= 0 && UI.Galaxy.map && G.sel.star !== p.star) { G.sel.star = p.star; try { UI.Galaxy.map.select(p.star); } catch (e) { /* optional */ } }   // the brackets show WHICH star the card is about
      for (const b of (p.body || [])) body.appendChild(typeof b === 'string' ? h('p', b) : b);
      for (const f of (p.flags || [])) body.appendChild(h('div.flag' + (f.good ? '.good' : ''), h('b', f.head || ''), ' ', f.text));
      host.appendChild(body);
      const btns = p.buttons || [{ label: 'Continue', value: true, primary: true }], prim = btns.find(b => b.primary) || btns[0], offs = cardOffs;
      const fire = v => { offs.splice(0).forEach(off => off()); if (p.resolve) p.resolve(v); };            // the original advances on any key: Space/Enter = the primary button, letters = their hotkeys
      const scr = { screen: 'galaxy' };
      offs.push(UI.bindKey('space', () => fire(prim.value), scr), UI.bindKey('enter', () => fire(prim.value), scr));
      for (const b of btns) if (b.kbd && String(b.kbd).length === 1) offs.push(UI.bindKey(String(b.kbd).toLowerCase(), () => fire(b.value), scr));
      const els = btns.map(b => UI.button(b.label, () => fire(b.value), { primary: !!b.primary, kbd: b.kbd }));
      host.appendChild(h('div.sm-actions', els));
      UI.attention(els[btns.indexOf(prim)]);                                                               // the answer the turn is waiting for: highlighted + focused (Enter/Space)
    },
    dispose() { cardOffs.splice(0).forEach(off => off()); },                                               // replaced/removed: its hotkeys go with it (it is re-shown by Flow while pending)
  });
})(window.MOO);
