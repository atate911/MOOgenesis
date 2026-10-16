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
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
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
    .sm-step .btn { clip-path:none; padding:.05em .4em; color:#0b0e13; font-weight:700; background:#000; box-shadow:none; }
    .sm-step .btn::before { clip-path:none; background:linear-gradient(180deg, #8791a0, #5b646f); box-shadow:inset 1px 1px 0 rgba(255,255,255,.35), inset -1px -1px 0 rgba(0,0,0,.45); }
    .sm-step .n { padding:.05rem .3rem; background:#12161b; color:#f0e060; font-family:var(--font-mono, monospace); box-shadow:inset 1px 1px 2px rgba(0,0,0,.9); }
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
  function planetPic(card, size, owner) {
    const WA = M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(card, M.Game && M.Game.S) : null;   // photoreal orbit card, else the procedural sprite
    if (art) return h('div.sm-pic', WA.canvas(art, size * 2, size * 2, { fit: 'contain' }));
    const c = h('canvas', { width: size * 2, height: size * 2 });
    try {
      const P = M.Gfx.pick('planets'); const look = card.type === 'none' ? 'asteroids' : card.growth === 'gaia' ? 'gaia' : card.type;
      const sp = P.sprite({ look, seed: card.id * 7919 + (card.gfx | 0), inhabited: owner !== undefined && owner >= 0 }, size * 2); c.getContext('2d').drawImage(sp, 0, 0, size * 2, size * 2);
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
      const S = G.S, E = G.player(), star = ctx.params.star; this.star = star; this.rows = {}; this.sel = (M.Sim.Fleet.at(S, star, E.id) || { ships: [0, 0, 0, 0, 0, 0] }).ships.slice(); this.dest = ctx.params.dest !== undefined ? ctx.params.dest : -1;
      const fl = M.Sim.Fleet.at(S, star, E.id);
      host.appendChild(UI.Side.title(star, S.playerId)); host.appendChild(h('h3', 'Fleet deployment'));
      if (!fl) { host.appendChild(h('p.dim', 'No ships in orbit.')); host.appendChild(UI.button('Close', () => ctx.defaultPanel())); return; }
      for (let i = 0; i < 6; i++) {
        if (!fl.ships[i] || !E.designs[i]) continue;
        const total = fl.ships[i], step = Math.max(1, Math.floor(total / 10)), nEl = h('span.n', '0');
        const set = v => { this.sel[i] = Math.max(0, Math.min(total, v)); nEl.textContent = this.sel[i] + ' / ' + total; this.update(ctx); this.reach(); };
        nEl.textContent = this.sel[i] + ' / ' + total;
        host.appendChild(h('div.sm-fleet', shipPic(E, i, 58, 42), h('div', h('div.nm', E.designs[i].name), h('div.ct', 'speed ' + M.Sim.Design.stats(S, E, i).warp + (M.Sim.Design.stats(S, E, i).tanks ? ' · extra fuel' : ''))),
          h('div.sm-step', UI.button('◀◀', () => set(0), { small: true }), UI.button('◀', () => set(this.sel[i] - step), { small: true }), nEl, UI.button('▶', () => set(this.sel[i] + step), { small: true }), UI.button('▶▶', () => set(total), { small: true }))));
      }
      this.hint = h('div.sc-pickhint', 'Choose destination and number to send.'); this.route = h('div'); this.acc = UI.button('Accept', () => this.accept(ctx), { primary: true, disabled: true });
      host.appendChild(this.hint); host.appendChild(this.route);
      host.appendChild(h('div.sm-actions', UI.button('Cancel', () => { UI.Galaxy.pick = null; if (UI.Galaxy.map) { UI.Galaxy.map.setRoutePreview(null); UI.Galaxy.map.setReach(null); } ctx.defaultPanel(); }), this.acc));
      UI.Galaxy.pick = id => { this.dest = id; this.update(ctx); };
      this.reach();
      UI.Galaxy.pendingSend = () => { if (this.dest < 0 || this.acc.disabled) return true; return this.accept(ctx, true); };   // Next turn auto-accepts the queued move
      this.update(ctx);
    },
    // dim every star the selected ships cannot reach (fuel range; Reserve Fuel Tanks only count when every selected design has them, as Q.route does)
    reach() {
      const map = UI.Galaxy.map; if (!map || !map.setReach) return;
      const S = G.S, E = G.player(), F = M.Sim.Fleet; let tanks = true, any = 0;
      for (let i = 0; i < 6; i++) { if (!(this.sel[i] > 0)) continue; any += this.sel[i]; if (!M.Sim.Design.stats(S, E, i).tanks) tanks = false; }
      if (!any) tanks = false;
      const ok = []; for (let i = 0; i < S.stars.length; i++) if (i === this.star || (any && F.canReach(S, E, i, tanks))) ok.push(i);
      map.setReach(ok);
    },
    update(ctx) {
      const S = G.S, E = G.player(); if (this.dest < 0) { this.acc.disabled = true; return; }
      const r = Q.route(S, E, this.star, this.dest, this.sel);
      UI.mount(this.route, h('div.sm-route' + (r.ok ? '' : '.bad'), h('b', S.stars[this.dest].name), ' — ', r.ok ? 'ETA ' + r.eta + (r.eta === 1 ? ' turn' : ' turns') + (r.stargate ? ' (stargate)' : '') + ' · ' + r.parsecs + ' parsecs' : r.reason));
      this.acc.disabled = !r.ok; this.acc.classList.toggle('disabled', !r.ok);
      if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview({ from: this.star, to: this.dest, eta: r.eta, valid: r.ok, reason: r.reason });
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
      if (f.star < 0) host.appendChild(h('div.sm-range', 'ETA ' + M.Sim.Fleet.eta(S, f.from, f.to, f.speed, false) + ' turns · destination ', h('b', S.stars[f.to].name)));
      else host.appendChild(h('div.sm-range', 'In orbit at ', h('b', S.stars[f.star].name)));
      for (let i = 0; i < 6; i++) { if (!f.ships[i]) continue; if (mine || E.designs[i]) host.appendChild(h('div.sm-fleet', mine ? shipPic(E, i, 58, 42) : h('div'), h('div', h('div.nm', mine ? E.designs[i].name : 'Ship class ' + (i + 1)), h('div.ct', '× ' + f.ships[i])), h('span'))); }
      host.appendChild(h('div.sm-actions', UI.button('Close', () => ctx.defaultPanel())));
    },
  });

  // ---- generic event card (exploration, colonisation prompt, notices, pre-battle) ---------------------------------------------------------------------
  //   UI.Flow.card({title, planetCard?, owner?, body:[strings|Nodes], flags:[{text,good}], buttons:[{label,value,primary}]}) → Promise(value)
  UI.Side.register('card', {
    render(host, ctx) {
      const p = ctx.params;
      host.appendChild(p.star !== undefined ? UI.Side.title(p.star, p.ownerId) : h('div.side-title', h('span.nm', p.heading || '')));
      const body = h('div.sm-event');
      if (p.planetCard) body.appendChild(h('div.sm-card', planetPic(p.planetCard, 44, p.ownerId), h('div.sc-info', h('div', h('span.cls', { style: { font: '400 1.2rem var(--font-display)', color: 'var(--brass-hi)' } }, p.planetCard.typeLabel), p.planetCard.growthLabel ? h('span.chip' + (p.planetCard.growth === 'hostile' ? '.warn' : '.ok'), { style: { marginLeft: '.4rem' } }, p.planetCard.growthLabel) : null), p.planetCard.type !== 'none' ? h('div', 'POP ', h('b.t-leaf', p.planetCard.maxPop), ' max') : null)));
      if (p.title) body.appendChild(h('h4', p.title));
      for (const b of (p.body || [])) body.appendChild(typeof b === 'string' ? h('p', b) : b);
      for (const f of (p.flags || [])) body.appendChild(h('div.flag' + (f.good ? '.good' : ''), h('b', f.head || ''), ' ', f.text));
      host.appendChild(body);
      const btns = p.buttons || [{ label: 'Continue', value: true, primary: true }], prim = btns.find(b => b.primary) || btns[0], offs = [];
      const fire = v => { offs.splice(0).forEach(off => off()); if (p.resolve) p.resolve(v); };            // the original advances on any key: Space/Enter = the primary button, letters = their hotkeys
      const scr = { screen: 'galaxy' };
      offs.push(UI.bindKey('space', () => fire(prim.value), scr), UI.bindKey('enter', () => fire(prim.value), scr));
      for (const b of btns) if (b.kbd && String(b.kbd).length === 1) offs.push(UI.bindKey(String(b.kbd).toLowerCase(), () => fire(b.value), scr));
      host.appendChild(h('div.sm-actions', btns.map(b => UI.button(b.label, () => fire(b.value), { primary: !!b.primary, kbd: b.kbd }))));
    },
  });
})(window.MOO);
