// Colony side panel (research/06 §4.5): planet card, POP/BASES/PRODUCTION, five spending sliders (Ship/Def/Ind/Eco/Tech) with locks and readouts,
// the build box with SHIPS / RELOC / TRANS, plus RELOC and TRANS sub-panels (destination picked on the map).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('side-colony', `
    .sc-card { display:flex; gap:.7rem; align-items:center; margin-bottom:.5rem; padding:.45rem; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.28); }
    .sc-card.wide { display:block; padding:0; position:relative; overflow:hidden; aspect-ratio:16 / 7; }
    .sc-card.wide .sc-pic { width:100%; height:100%; filter:none; } .sc-card.wide .sc-pic :is(canvas, img) { display:block; object-fit:cover; }
    .sc-card.wide .sc-info { position:absolute; right:.6rem; bottom:.45rem; text-align:right; text-shadow:0 1px 2px #000, 0 0 10px rgba(0,0,0,.9); }
    .sc-card.wide::after { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.55) 100%); }
    .sc-card.wide .sc-info { z-index:1; }
    .sc-pic { flex:none; width:5.6rem; height:5.6rem; display:grid; place-items:center; } .sc-pic :is(canvas, img) { width:100%; height:100%; }
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
    .sc-bbox { display:flex; align-items:center; gap:.5rem; padding:.35rem .5rem; cursor:var(--hand); background:rgba(0,0,0,.3); border:1px solid var(--brass-lo); min-height:4rem; position:relative; overflow:hidden; }
    .sc-bbox .yard { position:absolute; inset:0; z-index:0; pointer-events:none; filter:brightness(.45) saturate(.8); } .sc-bbox .yard :is(canvas, img) { display:block; width:100%; height:100%; }
    .sc-bbox .yard::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, rgba(0,0,0,.15), rgba(0,0,0,.6)); }
    .sc-bbox > :not(.yard) { position:relative; z-index:1; }
    .sc-bbox:hover { border-color:var(--brass-hi); background:rgba(214,179,106,.08); }
    .sc-bbox canvas { width:3.6rem; height:3rem; flex:none; object-fit:contain; } .sc-bbox .bn { font:400 1.05rem var(--font-display); color:var(--brass-hi); } .sc-bbox .bc { font-size:.82rem; color:var(--mist); }
    .sc-btns { display:flex; flex-direction:column; gap:.3rem; } .sc-btns .btn { padding:.25em .9em; font-size:.92rem; }
    .sc-note { margin:.4rem 0; padding:.35rem .6rem; border-left:3px solid var(--ember); background:rgba(255,148,64,.08); font-size:.88rem; }
    .sc-pickhint { margin:.6rem 0; padding:.6rem .7rem; background:rgba(98,216,255,.08); border:1px dashed var(--cyan); color:var(--ivory); }
    .sc-rally { grid-column:1 / -1; padding:.15rem .4rem; font-size:.85rem; color:var(--mist); cursor:var(--hand); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sc-rally .k { color:#9fb2d8; text-transform:uppercase; letter-spacing:.08em; font-size:.75rem; } .sc-rally b { color:var(--ivory); font-weight:600; }
    .sc-gate { color:#c7a6ff; }
    .sc-relocmsg { margin:.2rem 0 .5rem; text-align:center; color:var(--ivory); min-height:1.3em; }
    .sc-relocbtns { gap:.4rem; margin-top:.35rem; } .sc-relocbtns .btn { flex:1; justify-content:center; }
    .sc-trans .big { font:400 1.4rem var(--font-display); color:var(--brass-hi); text-align:center; margin:.4rem 0; }
    .sc-tpop { margin:.45rem 0 .3rem; font-variant-numeric:tabular-nums; }
    .sc-tpop .r { display:grid; grid-template-columns:2.6rem 1fr auto; gap:.4rem; align-items:baseline; padding:.12rem .3rem; }
    .sc-tpop .r + .r { border-top:1px solid rgba(214,179,106,.15); }
    .sc-tpop .k { color:var(--mist); font-size:.78rem; text-transform:uppercase; letter-spacing:.08em; } .sc-tpop .nm { color:var(--ivory); }
    .sc-tpop b { color:var(--leaf); } .sc-tpop b.over { color:var(--amber, #f0b050); }
    .empire-dot { display:inline-block; width:.7em; height:.7em; margin-right:.2em; transform:rotate(45deg); background:var(--c, var(--brass)); box-shadow:0 0 6px var(--c, var(--brass)); }
    .sc-stats .cell > span:last-child.chg { animation:sc-chg 1.2s ease-out both; }   /* a readout that changed over the turn (galaxy.js lights the HUD the same way) */
    @keyframes sc-chg { 0%, 25% { background:#7a5a14; color:#fff8dc; box-shadow:inset 0 0 0 1px var(--slot-ink, #f0d048), 0 0 8px rgba(240,208,72,.6); } 100% { } }
    /* the colony postcard under the build box (desktop): the panel's lower third was an empty band. The body becomes a column so the card takes
       whatever height is left; the container query hides it when that is too little to read. Phones: never (the sheet shows the controls). */
    .sc-post { display:none; }
    :root:not([data-phone]) .sc-post { position:relative; display:block; aspect-ratio:16 / 7; margin-top:.55rem; container-type:size; overflow:hidden; background:#05070a; }
    :root:not([data-phone]) .gx-sidebody:has(> .sc-post) { display:flex; flex-direction:column; }
    :root:not([data-phone]) .gx-sidebody:has(> .sc-post) > * { flex:none; }
    /* a flex column does not collapse margins: keep the block layout's collapsed gaps (card .5 | stats, stats .45 | sliders, sliders .5 | build,
       and a note's .4 against its neighbours) so nothing above the postcard moves */
    :root:not([data-phone]) .gx-sidebody:has(> .sc-post) > :is(.sc-stats, .sc-sliders, .sc-build), :root:not([data-phone]) .gx-sidebody:has(> .sc-post) .sc-note { margin-top:0; }
    :root:not([data-phone]) .gx-sidebody:has(> .sc-post) > .sc-post { flex:1 1 0; min-height:0; aspect-ratio:auto; max-height:26rem; }
    .sc-post > :is(canvas, img) { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:50% 60%; }
    .sc-post::after { content:""; position:absolute; inset:0; pointer-events:none; box-shadow:inset 0 0 0 1px rgba(214,179,106,.3), inset 0 0 2.5rem rgba(0,0,0,.55);
      background:linear-gradient(180deg, rgba(0,0,0,.5), rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,.75)); }
    .sc-pc { position:absolute; left:.65rem; top:.45rem; right:.65rem; z-index:1; line-height:1.25; text-shadow:0 1px 2px #000, 0 0 8px rgba(0,0,0,.9); }
    .sc-pc b { display:block; font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:var(--slot-ink, #f0d048); } .sc-pc span { font-size:.85rem; color:#e6e2d4; }
    .sc-orb { position:absolute; left:.5rem; right:.5rem; bottom:.4rem; z-index:1; display:flex; flex-wrap:wrap; align-items:center; gap:.3rem; }
    .sc-orb .k { font:600 .72rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#cfd6e2; text-shadow:0 1px 2px #000; margin-right:.15rem; }
    .sc-oc { display:inline-flex; align-items:center; gap:.15rem; padding:.05rem .4rem .05rem .1rem; background:rgba(6,9,16,.82); border:1px solid rgba(214,179,106,.45); cursor:var(--hand); font:600 .82rem var(--font-ui); color:#f3e6c0; font-variant-numeric:tabular-nums; }
    .sc-oc:hover { border-color:var(--slot-ink, #f0d048); background:rgba(40,32,12,.9); } .sc-oc canvas { width:3.2rem; height:1.9rem; }
    .sc-oc.foe { border-color:rgba(255,92,106,.65); color:#ffc2b8; cursor:default; } .sc-oc.none { cursor:default; color:#aab3c0; border-color:rgba(255,255,255,.18); font-weight:400; padding-left:.4rem; }
    @container (max-height: 5.5rem) { .sc-pc { display:none; } }
    @container (max-height: 3.2rem) { .sc-orb, .sc-post > :is(canvas, img) { display:none; } }
  `);

  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: red-framed planet portrait, inset readout slots, bevelled label plates, red-triangle slider arrows, gantry build box.
  UI.css('side-colony-orig', bump(`
    .gx-side { --slotbg:var(--well-steel, #0b0d12); --slot-edge:var(--hair, rgba(255,255,255,.14)); --amber:#f0e060; --lime:#70e060; --red-arrow:#c8453a; --frame-red:#d04030; --gold-frame:#c8a030; }
    .sc-card { gap:.6rem; padding:.3rem; background:radial-gradient(1px 1px at 12% 22%, #fff9 50%, transparent), radial-gradient(1px 1px at 38% 78%, #fff7 50%, transparent), radial-gradient(1px 1px at 88% 18%, #fff8 50%, transparent), radial-gradient(1px 1px at 63% 62%, #fff6 50%, transparent), linear-gradient(180deg, #0b0e13, #05070a); border:0; box-shadow:0 0 0 1px var(--frame-red), inset 0 0 0 1px rgba(0,0,0,.9), inset 0 0 18px rgba(208,64,48,.12); }
    .sc-pic { filter:drop-shadow(0 2px 6px rgba(0,0,0,.7)); }
    .sc-info { text-align:right; }
    .sc-info .cls { font:600 1rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:var(--slot-ink, #f0d048); text-shadow:0 1px 0 #000; }
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
    .sc-sliders .s-label { justify-content:center; padding:.1rem .2rem; background:linear-gradient(180deg, #6a7480, #4b535d); color:#fff; font:600 .78rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-shadow:0 1px 0 #000; box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.5), 0 0 0 1px rgba(0,0,0,.65); }
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
    .sc-sliders .s-val.dim { color:#a8b0bc; } .sc-sliders .s-val.warn { color:#ff7a5a; }
    .sc-sliders .s-lock { width:1.4rem; height:1.2rem; border:0; background:linear-gradient(180deg, #5f6974, #454d57); box-shadow:inset 1px 1px 0 rgba(255,255,255,.2), 0 0 0 1px rgba(0,0,0,.6); }
    .sc-build { gap:.4rem; }
    .sc-bbox { flex-direction:column; justify-content:flex-end; align-items:stretch; gap:.1rem; padding:.3rem .3rem 0; min-height:5.2rem; border:2px solid; border-color:#e0bc48 #8a6a18 #8a6a18 #e0bc48;
      background:repeating-linear-gradient(45deg, rgba(190,140,70,.2) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(190,140,70,.2) 0 2px, transparent 2px 9px), linear-gradient(180deg, #2a2016, #130d08); }
    .sc-bbox:hover { border-color:#f4d868 #a88420 #a88420 #f4d868; }
    .sc-bbox canvas { width:100%; height:3.2rem; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,.7)); }
    .sc-bbox > div { margin:0 -.3rem; padding:.12rem .3rem; text-align:center; background:#3a2810; border-top:1px solid #000; }
    .sc-bbox .bn { font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:var(--slot-ink, #f0d048); } .sc-bbox .bc { font-size:.7rem; color:#c8b078; }
    .sc-btns { gap:.25rem; min-width:4.8rem; }
    .sc-btns .btn, .sm-actions .btn { flex:1; clip-path:none; justify-content:center; padding:.2em .4em; font:600 .8rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#fff; text-shadow:0 1px 0 #000; background:rgba(0,0,0,.8); box-shadow:none; }
    .sc-btns .btn::before, .sm-actions .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #6a7480, #474f59); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.5); }
    .sc-btns .btn:hover::before, .sm-actions .btn:hover::before { background:linear-gradient(180deg, #7b8693, #565e69); }
    .sc-btns .btn:active::before, .sm-actions .btn:active::before { background:linear-gradient(180deg, #3a414a, #474f59); box-shadow:inset 1px 1px 0 rgba(0,0,0,.6); }
    .sm-actions .btn.primary::before { background:linear-gradient(180deg, #6f7fb0, #46548a); }
    .sc-note { background:rgba(208,64,48,.12); border-left-color:var(--frame-red); }
    .sc-pickhint { background:#12161b; border:0; color:#40e060; font:600 .78rem/1.35 var(--font-display); letter-spacing:.1em; text-transform:uppercase; text-align:center; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 1px 0 rgba(255,255,255,.12); }
    .sc-trans .big { font:600 1rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--amber); background:var(--slotbg); padding:.2rem; box-shadow:inset 1px 1px 2px rgba(0,0,0,.9); }
  `));

  const LABELS =[['Ship', 'ship', 'var(--c-ship)'], ['Def', 'def', 'var(--c-def)'], ['Ind', 'ind', 'var(--c-ind)'], ['Eco', 'eco', 'var(--c-eco)'], ['Tech', 'tech', 'var(--c-res)']];

  // the readouts as the turn began (taken from the panel on show at turn:processing): the first refresh after turn:end lights the ones that changed
  let statSnap = null, statFlashUntil = 0, statChg = {};
  const statVals = host => { const o = {}; host.querySelectorAll('.sc-stats .cell[data-k] > span:last-child').forEach(v => { o[v.parentElement.dataset.k] = v.textContent; }); return o; };
  M.Bus.on('turn:processing', on => { if (!on) return; const scr = UI.Screens.el && UI.Screens.el('galaxy'), host = scr && scr.querySelector('.gx-side:not(.gx-float) .gx-sidebody'); statSnap = host && host.querySelector('.sc-stats') ? { pid: G.sel.star, v: statVals(host) } : null; });
  M.Bus.on('turn:end', () => { statFlashUntil = performance.now() + 4000; });

  function planetCanvas(card, size) {
    const WA = M.Gfx && M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(card, M.Game && M.Game.S) : null;   // photoreal orbit card, else the procedural sprite
    if (art) return WA.image(art, { fit: 'contain' });
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
    try { const S = M.Gfx && M.Gfx.Ships; if (S && S.sprite && d) { const sp = S.sprite(E.race, d.hull, Math.min(w, hh) * 1.7, getComputedStyle(document.documentElement).getPropertyValue('--emp' + E.color), { view: '3q' }, S.designKey ? S.designKey(E.id, slot, d.name) : null); const k = Math.min(1, (w * 2 - 4) / sp.width, (hh * 2 - 4) / sp.height); c.getContext('2d').drawImage(sp, (w * 2 - sp.width * k) / 2, (hh * 2 - sp.height * k) / 2, sp.width * k, sp.height * k); } } catch (e) { /* ignore */ }
    return c;
  }

  // the build box backdrop: the spaceport still (docs/IMAGE-GEN-OTHER.md #52) when it exists, else the industrial colony plate, darkened by CSS
  function yardPlate() {
    const WA = M.Gfx && M.Gfx.WorldArt; if (!WA || !WA.enabled) return null;
    const still = WA.still('inst-spaceport'), path = still && WA.get(still) ? still : 'colony/colony-industrial';
    return h('div.yard', WA.image(path, { fx: 0.5, fy: 0.55 }));
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------
  UI.Side.register('colony', {
    render(host, ctx) {
      const S = ctx.S, pid = ctx.params.star !== undefined ? ctx.params.star : G.sel.star, p = S.planets[pid];
      const st = { pid, sliders: [], labels: [] };
      this.st = st;
      st.title = h('div.side-title'); st.card = h('div.sc-card'); st.stats = h('div.sc-stats'); st.note = h('div'); st.sl = h('div.sc-sliders'); st.build = h('div.sc-build'); st.post = h('div.sc-post');
      LABELS.forEach(([name, key, color], i) => {
        const lbl = h('span', name, h('small', ''));
        const s = UI.slider({ label: lbl, color, value: p.sliders[i], step: 4, min: 0, max: 100, fmt: () => '',
          onChange: v => { ctx.G.order({ t: 'slider', planet: pid, index: i, value: v }); st.sync(); },
          onLock: lk => { ctx.G.order({ t: 'sliderLock', planet: pid, index: i, locked: lk }); st.sync(); } });
        st.sliders.push(s); st.labels.push(lbl); st.sl.appendChild(s);
      });
      st.sync = () => this.refresh(host, ctx);
      host.appendChild(st.title); host.appendChild(st.card); host.appendChild(st.stats); host.appendChild(st.note); host.appendChild(st.sl); host.appendChild(st.build); host.appendChild(st.post);
      this.refresh(host, ctx);
    },
    refresh(host, ctx) {
      const S = G.S, st = this.st; if (!st) return;
      const c = Q.colony(S, st.pid); if (!c || c.owner !== S.playerId) { ctx.defaultPanel(); return; }
      const E = S.empires[c.owner];
      // title (click to rename)
      UI.mount(st.title, h('span.nm', { style: { cursor: 'var(--hand)' }, tip: 'Click to rename', onclick: async () => { const n = await UI.prompt('Rename this planet', c.name, { maxlength: 11 }); if (n) { G.order({ t: 'rename', planet: c.id, name: n }); } } }, c.name),
        h('span.own', h('span.empire-dot', { style: { '--c': 'var(--emp' + E.color + ')' } }), E.plural));
      if (S.planets.filter(p => p.owner === S.playerId).length > 1) {                 // ◀ ▶ step through your colonies without the map (F2 / F3)
        const cyc = (dir, tip) => h('button.cyc' + (dir > 0 ? '.nx' : ''), { type: 'button', 'aria-label': tip.replace(/<[^>]+>/g, ''), tip, onclick: () => UI.Galaxy.cycleColony(dir) });
        st.title.insertBefore(cyc(-1, 'Previous colony <b>F2</b>'), st.title.firstChild); st.title.appendChild(cyc(1, 'Next colony <b>F3</b>'));
      }
      const key = c.type + c.growth + c.id;
      if (UI.Phone && UI.Phone.active()) {                                             // phones: a thumbnail in the title row (the wide card shows when the sheet is fully open)
        if (st.thumbKey !== key) { st.thumbKey = key; st.thumb = h('span.ph-thumb', planetCanvas(c, 36)); }
        st.title.insertBefore(st.thumb, st.title.querySelector('.nm'));
      }
      // planet card
      if (st.cardKey !== key) {
        st.cardKey = key;
        const WA = M.Gfx && M.Gfx.WorldArt, art = WA && WA.enabled ? WA.orbit(c, G.S) : null;
        st.card.classList.toggle('wide', !!art);                                          // the original's wide landscape planet box, with the photoreal orbit plate
        st.picHost = h('div.sc-pic', art ? WA.image(art, { fx: 0.5, fy: 0.5 }) : planetCanvas(c, 52));   // an <img>: sharp at any pixel ratio, fills in when the plate lands
      }
      UI.mount(st.card, st.picHost, h('div.sc-info',
        h('div', h('span.cls', c.typeLabel), c.growthLabel ? h('span.tag' + (c.growth === 'hostile' ? '' : '.good'), c.growthLabel) : null, c.specialLabel ? h('span.tag.cy', c.specialLabel) : null),
        h('div', 'POP ', h('span.pm', c.maxPopShown + (c.canTerraform ? '+' : '')), ' max'),
        c.specialNote ? h('div.dim.small', c.specialNote) : null));
      // stats
      const grow = c.growthTenths; const popTxt = h('span', U.fmt(c.pop), grow ? h('span' + (grow > 0 ? '.t-leaf' : '.t-rose') + '.small', (grow > 0 ? ' ↑' : ' ↓') + Math.abs(grow / 10).toFixed(1)) : null);
      UI.mount(st.stats,
        h('div.cell', { dataset: { k: 'pop' } }, h('span', 'Pop'), popTxt), h('div.cell', { dataset: { k: 'bases' } }, h('span', 'Bases'), h('span', c.bases)),
        h('div.cell', { dataset: { k: 'fact' } }, h('span', 'Factories'), h('span', c.factories + ' / ' + c.maxFactories)), h('div.cell', { dataset: { k: 'waste' } }, h('span', 'Waste'), h('span' + (c.waste > 0 ? '.t-ember' : ''), c.waste)),
        h('div.cell.wide', { dataset: { k: 'prod' } }, h('span', 'Production'), h('span', h('b.t-ember', c.production), h('span.dim', ' (' + c.gross + ')'), c.shield ? h('span.t-azure.small', '  shield ' + c.shield) : null, c.stargate ? h('span.sc-gate.small', { tip: 'This colony has a stargate: ships and transports sent to another of your stargates arrive the next turn.' }, '  stargate') : null)));
      const tNow = performance.now();
      if (statSnap && statSnap.pid === st.pid && tNow < statFlashUntil) { const cur = statVals(st.stats); for (const k in cur) if (statSnap.v[k] !== undefined && statSnap.v[k] !== cur[k]) statChg[st.pid + ':' + k] = tNow + 1400; statSnap = null; }
      for (const key in statChg) { const [pid, k] = key.split(':'); if (tNow >= statChg[key]) delete statChg[key]; else if (+pid === st.pid) { const v = st.stats.querySelector('.cell[data-k="' + k + '"] > span:last-child'); if (v) v.classList.add('chg'); } }
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
      const yard = yardPlate(); if (yard) boxInner.unshift(yard);                              // the shipyard behind the design (the original's gantry picture)
      UI.mount(st.build,
        h('div.sc-bbox', { tip: 'Click (or wheel) to cycle ship designs · right-click goes back', onclick: () => cycleBuild(c, E), oncontextmenu: e => { e.preventDefault(); e.stopPropagation(); cycleBuild(c, E, -1); },
          onwheel: e => { const d = e.deltaY || e.deltaX; if (!d) return; e.preventDefault(); cycleBuild(c, E, d > 0 ? 1 : -1); } }, boxInner),
        h('div.sc-btns', UI.button('Ships', () => chooseBuild(c, E), { small: true }), UI.button('Reloc', () => ctx.show('reloc', { planet: c.id }), { small: true, tip: 'Set the rally point for newly built ships' }),
          UI.button('Trans', () => ctx.show('trans', { planet: c.id }), { small: true, tip: 'Send up to half of the population to another colony', disabled: c.pop < 2 })),
        rallyLine(c, E));
      postcard(st, c, E);
    },
    dispose() { this.st = null; },
  });

  // the colony postcard (desktop): the colony art for this world (domes on a hostile planet, mines on a barren one, a fortress when well defended,
  // smog when waste builds up, industry when the factories are many, else a city), what the colony is, and what is in orbit — your ships (a click
  // opens their deployment) and any foreign ones
  function postcard(st, c, E) {
    if (UI.Phone && UI.Phone.active()) return;
    const S = G.S, WA = M.Gfx && M.Gfx.WorldArt;
    const path = WA && WA.enabled && WA.colony ? WA.colony(c, { fortified: c.bases >= 8 || c.shield >= 10, polluted: c.waste > 0 && c.readouts.eco.text === 'WASTE', industrial: c.factories >= 120 }) : null;
    if (st.postKey !== path) { st.postKey = path; st.postArt = path ? WA.image(path, { fx: 0.5, fy: 0.6 }) : null; }
    if (!st.postArt) { UI.clear(st.post); st.post.style.display = 'none'; return; }
    st.post.style.display = '';
    const capital = E.capital === c.id, pop = U.fmt(c.pop) + ' million ' + (c.pop === 1 ? 'colonist' : 'colonists');
    const cap = h('div.sc-pc', h('b', capital ? 'Imperial capital' : c.factories >= 120 ? 'Industrial world' : c.bases >= 8 || c.shield >= 10 ? 'Fortified colony' : 'Colony'), h('span', pop + ' · ' + U.fmt(c.factories) + ' factories'));
    const orb = h('div.sc-orb', h('span.k', 'In orbit'));
    const mine = S.fleets.find(f => f.owner === E.id && f.star === c.id);
    if (mine) mine.ships.forEach((n, slot) => {
      if (!(n > 0) || !E.designs[slot]) return;
      orb.appendChild(h('span.sc-oc', { tip: '<b>' + E.designs[slot].name + '</b> × ' + n + '<br>Click to send them somewhere', onclick: () => { G.sel.fleet = mine.id; UI.Side.show('fleetDeploy', { star: c.id, fleet: mine.id }); } },
        shipCanvas(E, slot, 44, 26), U.fmt(n)));
    });
    for (const f of S.fleets) {
      if (f.owner === E.id || f.star !== c.id) continue;
      const O = S.empires[f.owner], n = f.ships.reduce((a, b) => a + (b | 0), 0); if (!O || !n) continue;
      orb.appendChild(h('span.sc-oc.foe', { tip: n + ' ' + O.name + ' ' + (n === 1 ? 'ship' : 'ships') + ' in orbit' }, UI.icon('warning'), U.fmt(n) + ' ' + O.name));
    }
    if (orb.children.length === 1) orb.appendChild(h('span.sc-oc.none', 'No ships'));
    UI.mount(st.post, st.postArt, cap, orb);
  }

  function cycleBuild(c, E, dir) {
    const slots = E.designs.map((d, i) => d ? i : -1).filter(i => i >= 0); if (E.mods.stargate && !G.S.planets[c.id].stargate) slots.push(-1);
    const i = slots.indexOf(c.build.stargate ? -1 : c.build.slot), n = slots.length; G.order({ t: 'build', planet: c.id, design: slots[(i + (dir || 1) + n) % n] });
  }
  // the choice list: the current build is focused, so Enter keeps it; 1–6 pick a design directly
  async function chooseBuild(c, E) {
    const pick = [], rows = [];
    E.designs.forEach((d, i) => { if (!d) return; const n = pick.push(i); rows.push(UI.button(n + '. ' + d.name + ' — ' + c.designs[i].cost + ' BC', () => choose(i), { block: true, active: !c.build.stargate && c.build.slot === i })); });
    if (E.mods.stargate && !c.stargate) { const n = pick.push(-1); rows.push(UI.button(n + '. Stargate — 3000 BC', () => choose(-1), { block: true, active: !!c.build.stargate })); }
    const choose = i => { G.order({ t: 'build', planet: c.id, design: i }); pr.close(true); };
    const pr = UI.modal({ title: 'Build at ' + c.name, body: h('div.col', rows), buttons: [{ label: 'Close', value: false }], width: '22rem' });
    const cur = pick.indexOf(c.build.stargate ? -1 : c.build.slot); if (rows[cur]) setTimeout(() => rows[cur].focus(), 0);
    const onKey = e => { const k = +e.key; if (k >= 1 && k <= pick.length && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); choose(pick[k - 1]); } };
    document.addEventListener('keydown', onKey, true);
    pr.then(() => document.removeEventListener('keydown', onKey, true));
  }

  // where this colony's new ships go: "Rally → Sol · 3 turns (stargate)", or nothing when they stay in orbit
  const turnsTxt = n => n + (n === 1 ? ' turn' : ' turns');
  function rallyLine(c, E) {
    const S = G.S, p = S.planets[c.id], r = M.Sim.Fleet.relocRoute ? M.Sim.Fleet.relocRoute(S, E, p) : null;
    if (!r) return null;
    return h('div.sc-rally', { tip: 'Ships finished here fly to ' + S.stars[r.to].name + ' automatically. Reloc changes it.', onclick: () => { if (UI.Galaxy.map) UI.Galaxy.map.centerOn(r.to, { animate: true }); } },
      h('span.k', 'Rally'), ' → ', h('b', S.stars[r.to].name), ' · ' + turnsTxt(r.eta) + (r.gate ? ' (stargate)' : ''));
  }

  // ---- RELOC: choose a rally point on the map (research/06 §5.6: click a colony, see the route and its time, Accept) ----------------------------------
  // "All colonies" is the original's Alt-R: every colony's new ships gather at the chosen planet.
  UI.Side.register('reloc', {
    render(host, ctx) {
      const S = G.S, E = G.player(), pid = ctx.params.planet, p = S.planets[pid];
      const st = { to: ctx.params.to !== undefined ? ctx.params.to : p.reloc !== p.starId && S.planets[p.reloc] && S.planets[p.reloc].owner === E.id ? p.reloc : -1 };
      const back = () => { UI.Galaxy.pick = null; if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview(null); ctx.show('colony', { star: pid }); };
      host.appendChild(UI.Side.title(pid, S.playerId));
      host.appendChild(h('div.sc-pickhint', UI.Phone.say('Click', 'Tap') + ' one of your colonies on the map: ships finished at ' + (p.name || S.stars[p.starId].name) + ' will fly there automatically.' + UI.Phone.say(' Enter accepts · Esc cancels.', '')));
      const msg = h('div.sc-relocmsg');
      const acc = UI.button('Accept', () => { const r = G.order({ t: 'reloc', planet: pid, to: st.to }); if (!r.ok) { UI.toast(r.msg, 'bad'); return; } UI.sfx('click'); back(); }, { primary: true, kbd: 'Space' });
      const all = UI.button('All colonies', () => {
        const r = G.order({ t: 'relocAll', to: st.to }); if (!r.ok) { UI.toast(r.msg, 'bad'); return; }
        UI.toast('Every colony now sends its new ships to ' + S.stars[st.to].name + '.', 'ok'); back();
      }, { tip: 'Point EVERY colony\'s rally line at this planet (Alt+R on the map does the same for the selected colony)' });
      const upd = () => {
        const ok = st.to >= 0 && st.to !== p.starId, r = ok ? M.Sim.Fleet.relocRoute(S, E, p, st.to) : null;
        UI.mount(msg, ok && r ? [h('b', S.stars[st.to].name), ' · ETA ' + turnsTxt(r.eta) + (r.gate ? ' by stargate' : ' at warp ' + r.warp)] : 'No rally point: new ships stay in orbit here.');
        for (const b of [acc, all]) { b.disabled = !ok; b.classList.toggle('disabled', !ok); }
        if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview(ok && r ? { from: p.starId, to: st.to, eta: r.eta, valid: true, gate: r.gate, kind: 'reloc', legs: r.legs } : null);
        if (ok) UI.attention(acc);
      };
      host.appendChild(msg);
      host.appendChild(h('div.row.sc-relocbtns', acc, all));
      host.appendChild(h('div.row.sc-relocbtns', UI.button('Cancel', back), UI.button('Stay here', () => { G.order({ t: 'reloc', planet: pid, to: pid }); back(); }, { tip: 'Clear the rally point: new ships stay at this colony' })));
      UI.Galaxy.pick = id => {
        const q = S.planets[id];
        if (!q || q.owner !== S.playerId) { UI.sfx('error'); UI.toast('The rally point must be one of your colonies', 'warn'); return; }
        const to = id === p.starId ? -1 : id;
        if (ctx.follow({ to })) return;                                                                  // the panel comes to the colony just clicked
        st.to = to; upd(); if (ctx.params.float && UI.Side.place) UI.Side.place();
      };
      ctx.keys(() => { if (!acc.disabled) acc.click(); }, back);
      upd();
    },
    dispose() { UI.Galaxy.pick = null; if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview(null); },
  });

  // ---- TRANS: send population ----------------------------------------------------------------------------------------------------------------------
  UI.Side.register('trans', {
    render(host, ctx) {
      const pid = ctx.params.planet, S = G.S, p = S.planets[pid], E = G.player(), max = Math.floor(p.pop / 2);
      const st = { to: ctx.params.to !== undefined ? ctx.params.to : p.trans ? p.trans.to : -1, n: ctx.params.n !== undefined ? ctx.params.n : p.trans ? p.trans.n : Math.min(max, 1) };
      this.st = st;
      const info = h('div.sc-pickhint'), big = h('div.big'), msg = h('div.small'), pops = h('div.sc-tpop');
      // both worlds' colonists now → after the move, against their maximum (amber when the destination would be over it)
      const popRow = (label, q, delta) => {
        const mx = M.Sim.Colony.maxPopDisplay(E, q), now = q.pop | 0, after = Math.max(0, now + delta), over = delta > 0 && after > mx;
        return h('div.r', h('span.k', label), h('span.nm', q.name || S.stars[q.starId].name), h('span.v', h('span.dim', now + ' → '), h('b' + (over ? '.over' : ''), after), h('span.dim', ' / ' + mx + 'M')));
      };
      const sl = UI.slider({ label: 'Pop', color: 'var(--c-eco)', min: 0, max: Math.max(1, max), step: 1, value: st.n, lockable: false, fmt: v => v + 'M', onChange: v => { st.n = v; upd(); } });
      const upd = () => {
        let t = '', ok = false, eta = 0;
        if (st.to >= 0) { const chk = M.Sim.Fleet.canTransportTo(S, E, p, st.to); ok = chk.ok && st.n > 0; if (!chk.ok) t = chk.msg; else { eta = M.Sim.Fleet.transEta(S, E, p.starId, st.to); const q = S.planets[st.to]; if (q.owner === E.id && q.pop + st.n > q.mp3) t = 'Warning: above maximum population'; } }
        const q = st.to >= 0 ? S.planets[st.to] : null;
        UI.mount(pops, popRow('From', p, -st.n), q && q.owner === E.id ? popRow('To', q, st.n) : h('div.r', h('span.k', 'To'), h('span.dim', q ? (q.owner >= 0 ? 'a foreign colony: the colonists land as troops' : 'an empty world') : '—')));
        big.textContent = 'Moving ' + st.n + ' Million'; msg.textContent = st.to >= 0 ? (S.stars[st.to].name + (ok ? ' — ETA ' + turnsTxt(eta) + (M.Sim.Fleet.gateLink(S, E, p.starId, st.to) ? ' by stargate' : '') : '') + (t ? ' · ' + t : '')) : 'Choose a destination on the map';
        acc.disabled = !ok; acc.classList.toggle('disabled', !ok);
        if (ok && ctx.params.float) UI.attention(acc);
      };
      const acc = UI.button('Accept', () => { const r = G.order({ t: 'trans', planet: pid, to: st.to, n: st.n }); if (!r.ok) UI.toast(r.msg, 'bad'); UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }, { primary: true });
      host.appendChild(UI.Side.title(pid, S.playerId)); host.appendChild(h('div.sc-trans', h('div.sc-pickhint', 'Choose number of colonists to transport, then ' + UI.Phone.say('click', 'tap') + ' the destination colony.' + UI.Phone.say(' Enter accepts · Esc cancels.', '')), big, sl, pops, msg));
      host.appendChild(h('div.row', { style: { marginTop: '.6rem' } }, UI.button('Cancel', () => { UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }), UI.button('Clear order', () => { G.order({ t: 'trans', planet: pid, n: 0 }); UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); }), acc));
      const preview = () => { const id = st.to; if (id < 0 || !UI.Galaxy.map) return; const ok = M.Sim.Fleet.canTransportTo(S, E, p, id).ok; UI.Galaxy.map.setRoutePreview({ from: p.starId, to: id, eta: ok ? M.Sim.Fleet.transEta(S, E, p.starId, id) : 0, valid: ok, gate: ok && M.Sim.Fleet.gateLink(S, E, p.starId, id) }); };
      UI.Galaxy.pick = id => { if (ctx.follow({ to: id, n: st.n })) return; st.to = id; upd(); preview(); if (ctx.params.float && UI.Side.place) UI.Side.place(); };   // the panel comes to the destination clicked
      ctx.keys(() => { if (!acc.disabled) acc.click(); }, () => { UI.Galaxy.pick = null; ctx.show('colony', { star: pid }); });
      upd(); preview(); void info;
    },
    dispose() { UI.Galaxy.pick = null; if (UI.Galaxy.map) UI.Galaxy.map.setRoutePreview(null); },
  });
})(window.MOO);
