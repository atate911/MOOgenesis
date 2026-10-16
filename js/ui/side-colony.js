// Colony side panel (research/06 §4.5): planet card, POP/BASES/PRODUCTION, five spending sliders (Ship/Def/Ind/Eco/Tech) with locks and readouts,
// the build box with SHIPS / RELOC / TRANS, plus RELOC and TRANS sub-panels (destination picked on the map).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('side-colony', `
    .sc-card { display:flex; gap:.7rem; align-items:center; margin-bottom:.5rem; padding:.45rem; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.28); }
    .sc-pic { flex:none; width:5.6rem; height:5.6rem; display:grid; place-items:center; } .sc-pic canvas { width:100%; height:100%; }
    .sc-info { flex:1; min-width:0; line-height:1.25; }
    .sc-info .cls { font:400 1.25rem var(--font-display); color:var(--brass-hi); }
    .sc-info .tag { display:inline-block; margin-left:.4rem; padding:0 .4em; font-size:.74rem; color:var(--ember); border:1px solid var(--ember); }
    .sc-info .tag.good { color:var(--leaf); border-color:var(--leaf); } .sc-info .tag.cy { color:var(--cyan); border-color:var(--cyan); }
    .sc-info .pm { color:var(--leaf); font-weight:600; font-variant-numeric:tabular-nums; }
    .sc-stats { display:grid; grid-template-columns: repeat(2, 1fr); gap:.3rem .6rem; margin:.3rem 0 .45rem; font-variant-numeric:tabular-nums; }
    .sc-stats .cell { display:flex; justify-content:space-between; padding:.12rem .45rem; background:rgba(0,0,0,.25); border:1px solid rgba(214,179,106,.18); }
    .sc-stats .cell span:first-child { color:var(--mist); } .sc-stats .wide { grid-column:1 / -1; }
    .sc-sliders { margin:.2rem 0 .5rem; }
    .sc-sliders .slider { grid-template-columns: 4.1rem 1.35rem 1fr 1.35rem 4.1rem 1.4rem; margin:.2rem 0; font-size:.95rem; }
    .sc-sliders .s-val { font-size:.78rem; letter-spacing:.02em; color:var(--ivory); text-align:right; white-space:nowrap; }
    .sc-sliders .s-val.warn { color:var(--rose); } .sc-sliders .s-val.dim { color:var(--mist); }
    .sc-sliders .s-label small { color:var(--mist); margin-left:.25rem; font-size:.72rem; }
    .sc-build { display:grid; grid-template-columns: 1fr auto; gap:.5rem; align-items:stretch; margin-top:.2rem; }
    .sc-bbox { display:flex; align-items:center; gap:.5rem; padding:.35rem .5rem; cursor:pointer; background:rgba(0,0,0,.3); border:1px solid var(--brass-lo); min-height:4rem; }
    .sc-bbox:hover { border-color:var(--brass-hi); background:rgba(214,179,106,.08); }
    .sc-bbox canvas { width:3.6rem; height:3rem; flex:none; object-fit:contain; } .sc-bbox .bn { font:400 1.05rem var(--font-display); color:var(--brass-hi); } .sc-bbox .bc { font-size:.82rem; color:var(--mist); }
    .sc-btns { display:flex; flex-direction:column; gap:.3rem; } .sc-btns .btn { padding:.25em .9em; font-size:.92rem; }
    .sc-note { margin:.4rem 0; padding:.35rem .6rem; border-left:3px solid var(--ember); background:rgba(255,148,64,.08); font-size:.88rem; }
    .sc-pickhint { margin:.6rem 0; padding:.6rem .7rem; background:rgba(98,216,255,.08); border:1px dashed var(--cyan); color:var(--ivory); }
    .sc-trans .big { font:400 1.4rem var(--font-display); color:var(--brass-hi); text-align:center; margin:.4rem 0; }
    .empire-dot { display:inline-block; width:.7em; height:.7em; margin-right:.2em; transform:rotate(45deg); background:var(--c, var(--brass)); box-shadow:0 0 6px var(--c, var(--brass)); }
  `);

  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: red-framed planet portrait, inset readout slots, bevelled label plates, red-triangle slider arrows, gantry build box.
  UI.css('side-colony-orig', bump(`
    .gx-side { --slotbg:#12161b; --slot-edge:rgba(255,255,255,.14); --amber:#f0e060; --lime:#70e060; --red-arrow:#c8453a; --frame-red:#d04030; --gold-frame:#c8a030; }
    .sc-card { gap:.6rem; padding:.3rem; background:radial-gradient(1px 1px at 12% 22%, #fff9 50%, transparent), radial-gradient(1px 1px at 38% 78%, #fff7 50%, transparent), radial-gradient(1px 1px at 88% 18%, #fff8 50%, transparent), radial-gradient(1px 1px at 63% 62%, #fff6 50%, transparent), linear-gradient(180deg, #0b0e13, #05070a); border:0; box-shadow:0 0 0 1px var(--frame-red), inset 0 0 0 1px rgba(0,0,0,.9), inset 0 0 18px rgba(208,64,48,.12); }
    .sc-pic { filter:drop-shadow(0 2px 6px rgba(0,0,0,.7)); }
    .sc-info { text-align:right; }
    .sc-info .cls { font:600 1rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#f0d048; text-shadow:0 1px 0 #000; }
    .sc-info .tag { display:block; margin:.15rem 0 0; border:0; padding:0; font:600 .78rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; }
    .sc-info .tag.good, .sc-info .tag.cy { color:#8ab0f0; }
    .sc-info .pm { font-family:var(--font-mono, monospace); color:var(--lime); text-shadow:0 0 8px rgba(112,224,96,.35); }
    .sc-stats { gap:.2rem .3rem; }
    .sc-stats .cell { align-items:center; padding:.1rem .2rem .1rem .4rem; background:linear-gradient(180deg, #5a636e, #454d57); border:0; box-shadow:inset 1px 1px 0 rgba(255,255,255,.22), inset -1px -1px 0 rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.6); }
    .sc-stats .cell span:first-child { color:#eef1f5; font:600 .78rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-shadow:0 1px 0 rgba(0,0,0,.6); }
    .sc-stats .cell > span:last-child { min-width:3.3rem; text-align:right; padding:.04rem .4rem; background:var(--slotbg); color:var(--amber); font-family:var(--font-mono, monospace); font-size:.92rem; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 var(--slot-edge); }
    .sc-stats .cell b.t-ember { color:var(--amber); } .sc-stats .cell .dim { color:var(--lime); opacity:1; }
    .sc-sliders { padding:.3rem .2rem; background:rgba(0,0,0,.18); box-shadow:inset 1px 1px 0 rgba(0,0,0,.5), inset -1px -1px 0 rgba(255,255,255,.08); }
    .sc-sliders .slider { grid-template-columns:4.4rem 1.2rem 1fr 1.2rem 4.2rem 1.4rem; gap:.25rem; margin:.22rem 0; }
    .sc-sliders .s-label { justify-content:center; padding:.1rem .2rem; background:linear-gradient(180deg, #6a7480, #4b535d); color:#fff; font:600 .78rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-shadow:0 1px 0 #000; box-shadow:inset 1px 1px 0 rgba(255,255,255,.28), inset -1px -1px 0 rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.65); }
    .sc-sliders .slider.locked .s-label { background:linear-gradient(180deg, #a85a3a, #7c3a24); }
    .sc-sliders .s-label small { display:none; }
    .sc-sliders .s-btn { font-size:0; width:1.2rem; height:1.2rem; border:0; background:var(--slotbg); box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 var(--slot-edge); position:relative; }
    .sc-sliders .s-btn::before { content:""; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); border:.32rem solid transparent; }
    .sc-sliders .slider > .s-btn:nth-child(2)::before { border-right:.46rem solid var(--red-arrow); border-left:0; }
    .sc-sliders .slider > .s-btn:nth-child(4)::before { border-left:.46rem solid var(--red-arrow); border-right:0; }
    .sc-sliders .s-btn:hover::before { filter:brightness(1.4); }
    .sc-sliders .s-track { height:1rem; background:#1a1210; box-shadow:inset 1px 1px 3px rgba(0,0,0,.95), 0 1px 0 var(--slot-edge); }
    .sc-sliders .s-fill { background:linear-gradient(180deg, color-mix(in srgb, var(--c) 82%, #fff), color-mix(in srgb, var(--c) 78%, #000)); box-shadow:inset 0 1px 0 rgba(255,255,255,.35); opacity:1; }
    .sc-sliders .slider.locked .s-fill { background:linear-gradient(180deg, #d4693a, #a84418); }
    .sc-sliders .s-knob { display:none; }
    .sc-sliders .s-val { padding:.12rem .35rem; background:var(--slotbg); color:var(--amber); font-family:var(--font-mono, monospace); font-size:.74rem; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 var(--slot-edge); overflow:hidden; text-overflow:ellipsis; }
    .sc-sliders .s-val.dim { color:#8a94a0; } .sc-sliders .s-val.warn { color:#ff7a5a; }
    .sc-sliders .s-lock { width:1.4rem; height:1.2rem; border:0; background:linear-gradient(180deg, #5f6974, #454d57); box-shadow:inset 1px 1px 0 rgba(255,255,255,.2), 0 0 0 1px rgba(0,0,0,.6); }
    .sc-build { gap:.4rem; }
    .sc-bbox { flex-direction:column; justify-content:flex-end; align-items:stretch; gap:.1rem; padding:.3rem .3rem 0; min-height:5.2rem; border:2px solid; border-color:#e0bc48 #8a6a18 #8a6a18 #e0bc48;
      background:repeating-linear-gradient(45deg, rgba(190,140,70,.2) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(190,140,70,.2) 0 2px, transparent 2px 9px), linear-gradient(180deg, #2a2016, #130d08); }
    .sc-bbox:hover { border-color:#f4d868 #a88420 #a88420 #f4d868; }
    .sc-bbox canvas { width:100%; height:3.2rem; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,.7)); }
    .sc-bbox > div { margin:0 -.3rem; padding:.12rem .3rem; text-align:center; background:#3a2810; border-top:1px solid #000; }
    .sc-bbox .bn { font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#f0d048; } .sc-bbox .bc { font-size:.7rem; color:#c8b078; }
    .sc-btns { gap:.25rem; min-width:4.8rem; }
    .sc-btns .btn, .sm-actions .btn { flex:1; clip-path:none; justify-content:center; padding:.2em .4em; font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#fff; text-shadow:0 1px 0 #000; background:rgba(0,0,0,.8); box-shadow:none; }
    .sc-btns .btn::before, .sm-actions .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #6a7480, #474f59); box-shadow:inset 1px 1px 0 rgba(255,255,255,.28), inset -1px -1px 0 rgba(0,0,0,.5); }
    .sc-btns .btn:hover::before, .sm-actions .btn:hover::before { background:linear-gradient(180deg, #7b8693, #565e69); }
    .sc-btns .btn:active::before, .sm-actions .btn:active::before { background:linear-gradient(180deg, #3a414a, #474f59); box-shadow:inset 1px 1px 0 rgba(0,0,0,.6); }
    .sm-actions .btn.primary::before { background:linear-gradient(180deg, #6f7fb0, #46548a); }
    .sc-note { background:rgba(208,64,48,.12); border-left-color:var(--frame-red); }
    .sc-pickhint { background:#12161b; border:0; color:#40e060; font:600 .78rem/1.35 var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-align:center; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); }
    .sc-trans .big { font:600 1rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--amber); background:var(--slotbg); padding:.2rem; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9); }
  `));

  const LABELS =[['Ship', 'ship', 'var(--c-ship)'], ['Def', 'def', 'var(--c-def)'], ['Ind', 'ind', 'var(--c-ind)'], ['Eco', 'eco', 'var(--c-eco)'], ['Tech', 'tech', 'var(--c-res)']];

  function planetCanvas(card, size) {
    const WA = M.Gfx && M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(card, M.Game && M.Game.S) : null;   // photoreal orbit card, else the procedural sprite
    if (art) return WA.canvas(art, size * 2, size * 2, { fit: 'contain' });
    const c = h('canvas', { width: size * 2, height: size * 2 });
    const look = card.type === 'none' ? 'asteroids' : (card.growth === 'gaia' ? 'gaia' : card.type);
    const P = M.Gfx && M.Gfx.pick('planets');
    try {
      if (P && P.sprite) { const sp = P.sprite({ look, seed: card.id * 7919 + (card.gfx | 0), inhabited: card.owner >= 0, color: card.owner >= 0 ? getComputedStyle(document.documentElement).getPropertyValue('--emp' + G.S.empires[card.owner].color) : undefined }, size * 2, { onReady: s2 => { if (c.isConnected) { const g = c.getContext('2d'); g.clearRect(0, 0, size * 2, size * 2); g.drawImage(s2, 0, 0, size * 2, size * 2); } } }); c.getContext('2d').drawImage(sp, 0, 0, size * 2, size * 2); return c; }
    } catch (e) { console.warn('planet sprite', e); }
    const x = c.getContext('2d'); x.fillStyle = '#556'; x.beginPath(); x.arc(size, size, size * 0.8, 0, 6.3); x.fill(); return c;
  }
  function shipCanvas(E, slot, w, hh) {
    const c = h('canvas', { width: w * 2, height: hh * 2 }), d = E.designs[slot];
    try { const S = M.Gfx && M.Gfx.Ships; if (S && S.sprite && d) { const sp = S.sprite(E.race, d.hull, Math.min(w, hh) * 1.7, getComputedStyle(document.documentElement).getPropertyValue('--emp' + E.color), {}); const k = Math.min(1, (w * 2 - 4) / sp.width, (hh * 2 - 4) / sp.height); c.getContext('2d').drawImage(sp, (w * 2 - sp.width * k) / 2, (hh * 2 - sp.height * k) / 2, sp.width * k, sp.height * k); } } catch (e) { /* ignore */ }
    return c;
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------
  UI.Side.register('colony', {
    render(host, ctx) {
      const S = ctx.S, pid = ctx.params.star !== undefined ? ctx.params.star : G.sel.star, p = S.planets[pid];
      const st = { pid, sliders: [], labels: [] };
      this.st = st;
      st.title = h('div.side-title'); st.card = h('div.sc-card'); st.stats = h('div.sc-stats'); st.note = h('div'); st.sl = h('div.sc-sliders'); st.build = h('div.sc-build');
      LABELS.forEach(([name, key, color], i) => {
        const lbl = h('span', name, h('small', ''));
        const s = UI.slider({ label: lbl, color, value: p.sliders[i], step: 4, min: 0, max: 100, fmt: () => '',
          onChange: v => { ctx.G.order({ t: 'slider', planet: pid, index: i, value: v }); st.sync(); },
          onLock: lk => { ctx.G.order({ t: 'sliderLock', planet: pid, index: i, locked: lk }); st.sync(); } });
        st.sliders.push(s); st.labels.push(lbl); st.sl.appendChild(s);
      });
      st.sync = () => this.refresh(host, ctx);
      host.appendChild(st.title); host.appendChild(st.card); host.appendChild(st.stats); host.appendChild(st.note); host.appendChild(st.sl); host.appendChild(st.build);
      this.refresh(host, ctx);
    },
    refresh(host, ctx) {
      const S = G.S, st = this.st; if (!st) return;
      const c = Q.colony(S, st.pid); if (!c || c.owner !== S.playerId) { ctx.defaultPanel(); return; }
      const E = S.empires[c.owner];
      // title (click to rename)
      UI.mount(st.title, h('span.nm', { style: { cursor: 'pointer' }, tip: 'Click to rename', onclick: async () => { const n = await UI.prompt('Rename this planet', c.name, { maxlength: 11 }); if (n) { G.order({ t: 'rename', planet: c.id, name: n }); } } }, c.name),
        h('span.own', h('span.empire-dot', { style: { '--c': 'var(--emp' + E.color + ')' } }), E.plural));
      // planet card
      const key = c.type + c.growth + c.id;
      if (st.cardKey !== key) { st.cardKey = key; st.picHost = h('div.sc-pic', planetCanvas(c, 52)); }
      UI.mount(st.card, st.picHost, h('div.sc-info',
        h('div', h('span.cls', c.typeLabel), c.growthLabel ? h('span.tag' + (c.growth === 'hostile' ? '' : '.good'), c.growthLabel) : null, c.specialLabel ? h('span.tag.cy', c.specialLabel) : null),
        h('div', 'POP ', h('span.pm', c.maxPopShown + (c.canTerraform ? '+' : '')), ' max'),
        c.specialNote ? h('div.dim.small', c.specialNote) : null));
      // stats
      const grow = c.growthTenths; const popTxt = h('span', U.fmt(c.pop), grow ? h('span' + (grow > 0 ? '.t-leaf' : '.t-rose') + '.small', (grow > 0 ? ' ↑' : ' ↓') + Math.abs(grow / 10).toFixed(1)) : null);
      UI.mount(st.stats,
        h('div.cell', h('span', 'Pop'), popTxt), h('div.cell', h('span', 'Bases'), h('span', c.bases)),
        h('div.cell', h('span', 'Factories'), h('span', c.factories + ' / ' + c.maxFactories)), h('div.cell', h('span', 'Waste'), h('span' + (c.waste > 0 ? '.t-ember' : ''), c.waste)),
        h('div.cell.wide', h('span', 'Production'), h('span', h('b.t-ember', c.production), h('span.dim', ' (' + c.gross + ')'), c.shield ? h('span.t-azure.small', '  shield ' + c.shield) : null)));
      UI.mount(st.note, c.rebels || c.unrest ? h('div.sc-note', c.unrest === 2 ? 'Rebellion! Production has stopped.' : 'Unrest: ' + c.rebels + 'M rebels.') : (c.event ? h('div.sc-note', 'Event: ' + c.event.type) : null));
      // sliders
      c.sliders.forEach((v, i) => {
        const sl = st.sliders[i], ro = c.readouts[LABELS[i][1]];
        if (sl.api.get() !== v) sl.api.set(v);
        sl.api.setLocked(c.lock[i]);
        const val = sl.querySelector('.s-val'); val.textContent = ro.text; val.classList.toggle('warn', ro.text === 'WASTE'); val.classList.toggle('dim', ro.text === 'NONE');
        st.labels[i].lastChild.textContent = ' ' + v + '%';
      });
      // build box + buttons
      const b = c.build, d = E.designs[b.slot];
      const boxInner = b.stargate ? [h('div.bn', 'Stargate'), h('div.bc', U.fmt(Math.floor(b.progress)) + ' / 3000 BC')] : [shipCanvas(E, b.slot, 58, 48), h('div', h('div.bn', b.name), h('div.bc', b.cost + ' BC' + (b.progress ? ' · ' + U.fmt(b.progress) + ' stored' : '')))];
      UI.mount(st.build,
        h('div.sc-bbox', { tip: 'Click to cycle ship designs', onclick: () => cycleBuild(c, E) }, boxInner),
        h('div.sc-btns', UI.button('Ships', () => chooseBuild(c, E), { small: true }), UI.button('Reloc', () => ctx.show('reloc', { planet: c.id }), { small: true, tip: 'Set the rally point for newly built ships' }),
          UI.button('Trans', () => ctx.show('trans', { planet: c.id }), { small: true, tip: 'Send up to half of the population to another colony', disabled: c.pop < 2 })));
    },
    dispose() { this.st = null; },
  });

  function cycleBuild(c, E) {
    const slots = E.designs.map((d, i) => d ? i : -1).filter(i => i >= 0); if (E.mods.stargate && !G.S.planets[c.id].stargate) slots.push(-1);
    const i = slots.indexOf(c.build.stargate ? -1 : c.build.slot); G.order({ t: 'build', planet: c.id, design: slots[(i + 1) % slots.length] });
  }
  async function chooseBuild(c, E) {
    const rows = E.designs.map((d, i) => d ? UI.button(d.name + ' — ' + c.designs[i].cost + ' BC', () => { G.order({ t: 'build', planet: c.id, design: i }); pr.close(true); }, { block: true, active: !c.build.stargate && c.build.slot === i }) : null).filter(Boolean);
    if (E.mods.stargate && !c.stargate) rows.push(UI.button('Stargate — 3000 BC', () => { G.order({ t: 'build', planet: c.id, design: -1 }); pr.close(true); }, { block: true, active: !!c.build.stargate }));
    const pr = UI.modal({ title: 'Build at ' + c.name, body: h('div.col', rows), buttons: [{ label: 'Close', value: false }], width: '22rem' });
  }

  // ---- RELOC: choose a rally point on the map ------------------------------------------------------------------------------------------------------
  UI.Side.register('reloc', {
    render(host, ctx) {
      const pid = ctx.params.planet, p = G.S.planets[pid];
      host.appendChild(UI.Side.title(pid, G.S.playerId));
      const info = h('div.sc-pickhint', 'Choose a colony on the map where ships built at ' + p.name + ' will gather.' + (p.reloc !== p.starId ? ' Current rally point: ' + G.S.stars[p.reloc].name + '.' : ''));
      host.appendChild(info);
      host.appendChild(h('div.row', UI.button('Cancel', () => { UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }), UI.button('Reset to this planet', () => { G.order({ t: 'reloc', planet: pid, to: pid }); UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); })));
      UI.Galaxy.pick = id => {
        const q = G.S.planets[id];
        if (q.owner !== G.S.playerId) { UI.toast('The rally point must be one of your colonies', 'warn'); return; }
        const r = G.order({ t: 'reloc', planet: pid, to: id }); if (!r.ok) UI.toast(r.msg, 'bad');
        UI.Galaxy.pick = null; ctx.show('colony', { star: pid });
      };
    },
    dispose() { UI.Galaxy.pick = null; },
  });

  // ---- TRANS: send population ----------------------------------------------------------------------------------------------------------------------
  UI.Side.register('trans', {
    render(host, ctx) {
      const pid = ctx.params.planet, S = G.S, p = S.planets[pid], E = G.player(), max = Math.floor(p.pop / 2);
      const st = { to: p.trans ? p.trans.to : -1, n: p.trans ? p.trans.n : Math.min(max, 1) };
      this.st = st;
      const info = h('div.sc-pickhint'), big = h('div.big'), msg = h('div.small');
      const sl = UI.slider({ label: 'Pop', color: 'var(--c-eco)', min: 0, max: Math.max(1, max), step: 1, value: st.n, lockable: false, fmt: v => v + 'M', onChange: v => { st.n = v; upd(); } });
      const upd = () => {
        let t = '', ok = false, eta = 0;
        if (st.to >= 0) { const chk = M.Sim.Fleet.canTransportTo(S, E, p, st.to); ok = chk.ok && st.n > 0; if (!chk.ok) t = chk.msg; else { eta = M.Sim.Fleet.eta(S, p.starId, st.to, M.Sim.Fleet.transSpeed(E), true); const q = S.planets[st.to]; if (q.owner === E.id && q.pop + st.n > q.mp3) t = 'Warning: above maximum population'; } }
        big.textContent = 'Moving ' + st.n + ' Million'; msg.textContent = st.to >= 0 ? (S.stars[st.to].name + (ok ? ' — ETA ' + eta + ' turns' : '') + (t ? ' · ' + t : '')) : 'Choose a destination on the map';
        acc.disabled = !ok; acc.classList.toggle('disabled', !ok);
      };
      const acc = UI.button('Accept', () => { const r = G.order({ t: 'trans', planet: pid, to: st.to, n: st.n }); if (!r.ok) UI.toast(r.msg, 'bad'); UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }, { primary: true });
      host.appendChild(UI.Side.title(pid, S.playerId)); host.appendChild(h('div.sc-trans', h('div.sc-pickhint', 'Choose number of colonists to transport, then click the destination colony.'), big, sl, msg));
      host.appendChild(h('div.row', { style: { marginTop: '.6rem' } }, UI.button('Cancel', () => { UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }), UI.button('Clear order', () => { G.order({ t: 'trans', planet: pid, n: 0 }); UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }), acc));
      UI.Galaxy.pick = id => { st.to = id; upd(); if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview({ from: p.starId, to: id, eta: 0, valid: M.Sim.Fleet.canTransportTo(S, E, p, id).ok }); };
      upd(); void info;
    },
    dispose() { UI.Galaxy.pick = null; if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview(null); },
  });
})(window.MOO);
