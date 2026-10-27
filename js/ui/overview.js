// Galaxy Map overview (research/06 §5.1): the whole galaxy with Colonies / Environments / Minerals filters and the Map Key, on top of MOO.UI.GalaxyMap.
//   UI.Screens.go('mapoverview', {from, mode:'colonies'|'environments'|'minerals'})     C / E / M switch the filter · O / Space / Esc / right-click = OK · click a star = close and focus it
// The map component draws the stars, flags, rings and glows; this screen adds the Map Key, the outlines of your fuel / scanner reach (Colonies) and, when the
// map is too small to print them, the environment letters and mineral notes of every explored star.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util, TAU = Math.PI * 2;

  UI.css('map-overview', `
    .ov { position:absolute; inset:0; display:flex; background:var(--void); }
    .ov-main { position:relative; flex:1 1 auto; min-width:0; }
    .ov-side { flex:none; width:clamp(18rem, 22vw, 24rem); padding:.7rem .7rem .7rem .3rem; display:flex; flex-direction:column; background:linear-gradient(90deg, rgba(6,9,25,0), rgba(6,9,25,.92) 10%); }
    .ov-side .panel { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; gap:.65rem; padding:.8rem .9rem; }
    .ov-title { font:400 1.9rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; text-shadow:0 0 20px rgba(214,179,106,.28); padding-bottom:.5rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .ov-title small { display:block; margin-top:.35rem; font:400 .85rem var(--font-ui); color:var(--mist); letter-spacing:0; }
    .ov-modes { display:flex; flex-direction:column; gap:.4rem; } .ov-modes .btn { justify-content:flex-start; padding:.5em 1em; width:100%; } .ov-modes .btn .kbd { margin-left:auto; }
    .ov-key { flex:1 1 auto; min-height:0; overflow:auto; padding:.5rem .7rem .6rem; background:rgba(3,5,18,.55); box-shadow:inset 0 0 0 1px rgba(214,179,106,.28); }
    .ov-kt { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:.4rem; padding-bottom:.3rem; border-bottom:1px solid rgba(214,179,106,.28); font:400 1.1rem var(--font-display); letter-spacing:.06em; color:var(--brass-hi); }
    .ov-kt small { font:400 .8rem var(--font-ui); color:var(--mist); letter-spacing:0; }
    .ov-kh { margin:.55rem 0 .2rem; font:400 .85rem var(--font-display); letter-spacing:.09em; color:var(--brass); text-transform:uppercase; }
    .ov-kr { display:flex; align-items:center; gap:.6rem; padding:.14rem 0; font-size:.95rem; line-height:1.2; } .ov-kr .n { margin-left:auto; color:var(--mist); font-variant-numeric:tabular-nums; }
    .ov-kr.zero { opacity:.58; } .ov-kr small { display:block; color:var(--mist); font-size:.76rem; }
    .ov-sw { flex:none; width:.9rem; height:.9rem; background:var(--c); box-shadow:0 0 7px var(--c); transform:rotate(45deg) scale(.85); }
    .ov-sw.dot { transform:none; border-radius:50%; width:.78rem; height:.78rem; margin:0 .06rem; } .ov-sw.ring { transform:none; border-radius:50%; background:transparent; box-shadow:none; border:1.5px solid var(--c); width:.82rem; height:.82rem; }
    .ov-sw.line { transform:none; width:1.3rem; height:0; background:none; box-shadow:0 0 6px var(--c); border-top:2px solid var(--c); } .ov-sw.dash { transform:none; width:1.3rem; height:0; background:none; box-shadow:none; border-top:2px dotted var(--c); }
    .ov-let { flex:none; width:1.35rem; height:1.35rem; display:grid; place-items:center; font:700 .85rem/1 var(--font-ui); color:var(--c); border:1.5px solid var(--c); background:rgba(0,0,0,.35); box-shadow:0 0 6px color-mix(in srgb, var(--c) 40%, transparent); }
    .ov-note { margin-top:.6rem; padding-top:.45rem; border-top:1px solid rgba(214,179,106,.2); color:var(--mist); font-size:.82rem; line-height:1.35; }
    .ov-cv { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
    .ov-ok { display:flex; gap:.5rem; } .ov-ok .btn { flex:1; }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: tool-screen family — bronze frame around the map, gold embossed plate, stacked steel mode buttons, brown "Map Key" box.
  UI.css('map-overview-orig', bump(`
    .ov { padding:.4rem; gap:.4rem; background:linear-gradient(135deg, #857561, #66584a 8%, #54463a 60%, #372d25); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.65); }
    .ov-main { background:#000; box-shadow:0 0 0 1px #000, 0 1px 0 1px rgba(255,235,200,.2); overflow:hidden; }
    .ov-main::after { content:""; position:absolute; inset:0; pointer-events:none; box-shadow:inset 2px 2px 4px rgba(0,0,0,.7), inset -1px -1px 0 rgba(255,235,200,.1); }
    .ov-side { padding:0; background:none; width:clamp(18rem, 21vw, 23rem); }
    .ov-side .panel { clip-path:none; padding:.3rem; gap:.5rem; background:linear-gradient(180deg, #66584a, #372d25); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.6), 0 0 0 1px #000; }
    .ov-side .panel::before { inset:.2rem; clip-path:none; background:var(--well-leather, #181411); box-shadow:inset 1px 1px 2px rgba(0,0,0,.8); }
    .ov-side .panel::after { display:none; }
    .ov-side .panel > * { position:relative; margin-left:.45rem; margin-right:.45rem; } .ov-side .panel > :first-child { margin-top:.45rem; } .ov-side .panel > :last-child { margin-bottom:.45rem; }
    .ov-title { text-align:center; padding:.35rem .4rem; font:400 1.35rem/1 var(--font-display); letter-spacing:.06em; text-transform:uppercase; color:var(--title-hi); text-shadow:var(--title-shadow); border-bottom:0;
      background:linear-gradient(180deg, #54463a, #372d25); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.6); }
    .ov-title small { color:#f0dcc0; font-size:1rem; margin-top:.3rem; text-transform:none; letter-spacing:0; }
    .ov-side .panel { flex:0 1 auto; }
    .ov-modes .btn { clip-path:none; justify-content:center; padding:.4em .6em; background:rgba(0,0,0,.85); box-shadow:none; color:#0b0e13; font:700 .92rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; }
    .ov-modes .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #a0a3ae, #6c707c); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.45); }
    .ov-modes .btn.active { color:#25100a; text-shadow:0 1px 0 rgba(255,230,170,.5); } .ov-modes .btn.active::before { background:linear-gradient(180deg, #ffd070, #c8741a); box-shadow:inset 1px 1px 3px rgba(0,0,0,.35), 0 0 0 1px #ffc860; }
    .ov-modes .btn .kbd { display:none; }
    .ov-key { background:#372d25; box-shadow:inset 1px 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.14); }
    .ov-kt { color:var(--head-orange); border-bottom-color:rgba(255,235,200,.14); font-size:1.05rem; text-shadow:0 1px 0 #000; text-transform:uppercase; letter-spacing:.08em; } .ov-kt small { text-transform:none; letter-spacing:0; }   /* the box-title tier: as Planets' SPENDING COSTS and Research's section heads */
    .ov-kh { color:#f0b868; font-size:.92rem; } .ov-kr { color:#f0dcc0; } .ov-kr small { font-size:.85rem; color:#e0cba8; } .ov-kt small { font-size:.9rem; color:#e0cba8; } .ov-note { color:#ead4b0; font-size:.9rem; border-top-color:rgba(255,235,200,.14); }
    .ov-ok .btn { clip-path:none; background:rgba(0,0,0,.85); box-shadow:none; color:#0b0e13; font:700 .85rem var(--font-display); letter-spacing:.14em; text-transform:uppercase; }
    .ov-ok .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #a0a3ae, #6c707c); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.45); }
  `));

  // ---- vocabulary (letters match the map component's own) ---------------------------------------------------------------------------------------
  const LETTER = { gaia: 'G', terran: 'T', ocean: 'O', jungle: 'J', arid: 'A', steppe: 'S', desert: 'D', minimal: 'M', tundra: 'U', barren: 'B', dead: 'X', inferno: 'I', toxic: 'Y', radiated: 'R' };
  const TYPE_NAME = { terran: 'Terran', jungle: 'Jungle', ocean: 'Ocean', arid: 'Arid', steppe: 'Steppe', desert: 'Desert', minimal: 'Minimal', barren: 'Barren', tundra: 'Tundra', dead: 'Dead', inferno: 'Inferno', toxic: 'Toxic', radiated: 'Radiated' };
  const ORDER = ['terran', 'jungle', 'ocean', 'arid', 'steppe', 'desert', 'minimal', 'barren', 'tundra', 'dead', 'inferno', 'toxic', 'radiated'];
  const MIN_TEXT = { ultrapoor: 'ULTRA POOR', poor: 'POOR', rich: 'RICH', ultrarich: 'ULTRA RICH', artifacts: 'ARTIFACTS', orion: 'ORION' };
  const MIN_KEY = [['ultrapoor', 'Ultra poor', '1/3 production'], ['poor', 'Poor', '1/2 production'], ['normal', 'Normal', ''], ['rich', 'Rich', '2× production'], ['ultrarich', 'Ultra rich', '3× production'], ['artifacts', 'Artifacts', '2× research'], ['orion', 'Orion', '4× research']];
  const KIND_S = { yellow: 1.0, orange: 0.94, red: 0.88, blue: 1.22, white: 1.06, green: 1.0, purple: 0.9 };
  const MODES = [['colonies', 'Colonies', 'C'], ['environments', 'Environments', 'E'], ['minerals', 'Minerals', 'M']];
  const clamp = U.clamp;

  let el = null, map = null, cv = null, cx = null, mapHost, keyEl, subEl, modeBtns = {}, sizeW = 0, sizeH = 0, sizeDirty = true;
  const st = { mode: 'colonies', from: 'galaxy', fuel: [], tanks: [], scan: [], ranges: null, pcU: 11, uk: 1 };
  const css = n => { try { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { return ''; } };
  let TH = null;
  const readTheme = () => (TH = { leaf: css('--leaf') || '#5fdc8f', rose: css('--rose') || '#ff5c6a', teal: css('--teal') || '#38d6c4', cyan: css('--cyan') || '#62d8ff', ivory: css('--ivory') || '#ece6d3',
    lav: '#b9a6ff', font: css('--font-ui') || 'sans-serif' });
  const uiScale = () => clamp((parseFloat(css('font-size')) || parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16, 0.85, 1.35);
  const empHex = E => css('--emp' + E.color) || '#9aa';

  // ---- rules ------------------------------------------------------------------------------------------------------------------------------
  const E_ = () => G.player();
  function canLive(E, p) {                                 // can this empire plant a colony on that planet type right now?
    if (!p || p.typeIdx === 0) return false;
    if (p.special === 'orion' && G.S.guardian && G.S.guardian.alive) return false;
    if (E.race === 'silicoid') return true;
    return p.typeIdx >= ((E.mods && E.mods.colonyFor) || 7);
  }
  function envClass(p) {                                   // class index into GalaxyMap.ENV: 0 none · 1 red (cannot yet) · 4 green · 5 terran · 6 gaia
    if (!p || p.type === 'none') return 0;
    if (p.growth === 'gaia') return 6;
    if (!canLive(E_(), p)) return 1;
    return p.type === 'terran' ? 5 : 4;
  }
  const known = (E, i) => !!(E.explored && E.explored[i]) || !!(E.vis && E.vis[i] >= 1) || G.S.planets[i].owner === E.id;

  // ---- outlines of reach: the boundary of the union of equal circles ----------------------------------------------------------------------------
  function unionArcs(pts, r) {
    const arcs = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1], cov = []; let full = false;
      for (let j = 0; j < pts.length && !full; j += 2) {
        if (j === i) continue;
        const dx = pts[j] - x, dy = pts[j + 1] - y, d = Math.hypot(dx, dy);
        if (d >= 2 * r) continue;
        if (d < 1e-6) { if (j < i) full = true; continue; }
        const half = Math.acos(clamp(d / (2 * r), -1, 1)), mid = Math.atan2(dy, dx);
        let a = mid - half, b = mid + half;
        while (a < 0) { a += TAU; b += TAU; }
        if (b > TAU) { cov.push([a, TAU], [0, b - TAU]); } else cov.push([a, b]);
      }
      if (full) continue;
      cov.sort((p, q) => p[0] - q[0]);
      let at = 0;
      for (const c of cov) { if (c[0] > at + 1e-4) arcs.push([x, y, at, c[0], r]); at = Math.max(at, c[1]); }
      if (at < TAU - 1e-4) arcs.push([x, y, at, TAU, r]);
    }
    return arcs;
  }
  function computeReach() {
    const S = G.S, E = E_(), D = M.Sim.Diplo, pc = (S.galaxy && S.galaxy.pc) || 11, pts = [];
    st.pcU = pc;
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      if (p.owner !== E.id && !(D && D.isAllied && D.isAllied(S, E.id, p.owner))) continue;
      const s = S.stars[p.starId]; pts.push(s.x, s.y);
    }
    const fuel = E.range || (E.mods && E.mods.fuel) || 3, scan = (M.Sim.Vis && M.Sim.Vis.scanRange ? M.Sim.Vis.scanRange(E) : (E.mods && E.mods.scan) || 3);
    st.ranges = { fuel, scan, pts };
    st.fuel = unionArcs(pts, fuel * pc); st.tanks = unionArcs(pts, (fuel + 3) * pc); st.scan = unionArcs(pts, scan * pc);
  }

  // ---- the overlay canvas ---------------------------------------------------------------------------------------------------------------------
  function arcsPath(arcs, z, ox, oy) {
    cx.beginPath();
    for (let i = 0; i < arcs.length; i++) { const a = arcs[i], x = (a[0] - ox) * z + sizeW / 2, y = (a[1] - oy) * z + sizeH / 2, r = a[4] * z; cx.moveTo(x + Math.cos(a[2]) * r, y + Math.sin(a[2]) * r); cx.arc(x, y, r, a[2], a[3]); }
  }
  function drawOverlay(t) {
    const S = G.S, E = E_(), cam = map.getCamera(), z = cam.pxPerUnit, th = TH;
    const dpr = cv.width / sizeW;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, sizeW, sizeH);
    const znv = z * 30, uk = st.uk;
    const baseR = clamp(1.4 + znv * 0.032, 2.2, 9.5 + Math.max(0, znv - 260) * 0.05) * uk;
    if (st.mode === 'colonies' && st.ranges) {
      // dotted: reach with Reserve Fuel Tanks and the scanner coverage; solid lavender with a soft halo: the fuel range
      cx.save();
      cx.lineJoin = 'round'; cx.lineCap = 'round';
      arcsPath(st.tanks, z, cam.x, cam.y); cx.lineWidth = 1.2; cx.setLineDash([2, 6]); cx.strokeStyle = 'rgba(185,166,255,0.38)'; cx.stroke();
      cx.setLineDash([]);
      arcsPath(st.fuel, z, cam.x, cam.y); cx.lineWidth = 5; cx.strokeStyle = 'rgba(185,166,255,0.14)'; cx.stroke();
      cx.lineWidth = 1.8; cx.strokeStyle = th.lav; cx.shadowColor = 'rgba(185,166,255,0.8)'; cx.shadowBlur = 8; cx.stroke();
      cx.shadowBlur = 0;
      arcsPath(st.scan, z, cam.x, cam.y); cx.setLineDash([2, 6]); cx.lineDashOffset = -t * 9; cx.lineWidth = 2; cx.strokeStyle = 'rgba(98,216,255,0.9)'; cx.stroke();    // the scanner sweeps along its own edge
      cx.restore();
    }
    if (st.mode === 'environments' && znv <= 150) {
      const fs = Math.round(clamp(13 * uk + znv * 0.02, 11, 17));
      cx.font = '800 ' + fs + 'px ' + th.font; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.lineJoin = 'round'; cx.lineWidth = 3.2; cx.strokeStyle = 'rgba(3,5,18,0.92)';
      const sx0 = -30, sx1 = sizeW + 30, sy0 = -30, sy1 = sizeH + 30;
      for (const s of S.stars) {
        const x = (s.x - cam.x) * z + sizeW / 2, y = (s.y - cam.y) * z + sizeH / 2;
        if (x < sx0 || x > sx1 || y < sy0 || y > sy1 || !known(E, s.id)) continue;
        const p = S.planets[s.id]; if (!p || p.type === 'none') continue;
        const letter = p.growth === 'gaia' ? 'G' : LETTER[p.type]; if (!letter) continue;
        const rr = baseR * (KIND_S[s.color] || 1) * 1.8 + 3.5;
        cx.fillStyle = p.growth === 'gaia' ? th.teal : canLive(E, p) ? th.leaf : th.rose;
        const px = x + rr * 0.72 + 1, py = y + rr * 0.72 + 2;
        cx.strokeText(letter, px, py); cx.fillText(letter, px, py);
      }
    }
    if (st.mode === 'minerals' && znv >= 55) {
      const fs = Math.round(clamp(8.5 * uk + znv * 0.02, 9, 12.5));
      cx.font = '600 ' + fs + 'px ' + th.font; cx.textAlign = 'center'; cx.textBaseline = 'alphabetic'; cx.lineJoin = 'round'; cx.lineWidth = 3.2; cx.strokeStyle = 'rgba(3,5,18,0.92)';
      const MN = (UI.GalaxyMap && UI.GalaxyMap.MINERALS) || [], colOf = {}; MN.forEach(m => { colOf[m.id] = m.col; });
      for (const s of S.stars) {
        const x = (s.x - cam.x) * z + sizeW / 2, y = (s.y - cam.y) * z + sizeH / 2;
        if (x < -40 || x > sizeW + 40 || y < -20 || y > sizeH + 20 || !known(E, s.id)) continue;
        const p = S.planets[s.id], txt = p && p.type !== 'none' ? MIN_TEXT[p.special] : null; if (!txt) continue;
        const rr = baseR * (KIND_S[s.color] || 1) * 1.8 + 3.5;
        cx.fillStyle = colOf[p.special] || th.ivory;
        cx.strokeText(txt, x, y - rr - 4); cx.fillText(txt, x, y - rr - 4);
      }
    }
  }

  // ---- the Map Key -------------------------------------------------------------------------------------------------------------------------------
  const kt = (title, sub) => h('div.ov-kt', title, h('small', sub));
  const kr = (swatch, text, n, sub) => h('div.ov-kr' + (n === 0 ? '.zero' : ''), swatch, h('span', text, sub ? h('small', sub) : null), n === undefined ? null : h('span.n', n));
  const sw = (cls, color) => h('i.ov-sw' + (cls ? '.' + cls : ''), { style: { '--c': color } });
  function paintKey() {
    const S = G.S, E = E_(), kids = [];
    const total = S.stars.length, kn = S.stars.filter(s => known(E, s.id)).length;
    if (st.mode === 'colonies') {
      kids.push(kt('Map Key', 'Colonies'));
      const per = {}; for (const s of S.stars) { if (!known(E, s.id)) continue; const o = S.planets[s.id].owner; if (o >= 0) per[o] = (per[o] || 0) + 1; }
      const ids = Object.keys(per).map(Number).sort((a, b) => (a === E.id ? -1 : b === E.id ? 1 : a - b));
      for (const id of ids) { const e = S.empires[id]; kids.push(kr(sw('', empHex(e)), e.plural + (id === E.id ? ' (you)' : ''), per[id])); }
      const free = S.stars.filter(s => known(E, s.id) && S.planets[s.id].owner < 0).length;
      kids.push(h('div.ov-kh', 'Stars'));
      kids.push(kr(sw('dot', '#c9d4ff'), 'Free stars', free, 'explored, no colony'));
      kids.push(kr(sw('ring', '#7b89bd'), 'Unexplored', total - kn));
      kids.push(h('div.ov-kh', 'Your reach'));
      const r = st.ranges || { fuel: 3, scan: 3 };
      kids.push(kr(sw('line', '#b9a6ff'), 'Fuel range', r.fuel + ' pc', 'ships can travel within it'));
      kids.push(kr(sw('dash', '#b9a6ff'), 'With fuel tanks', (r.fuel + 3) + ' pc', 'only ships with Reserve Fuel Tanks'));
      kids.push(kr(sw('dash', '#62d8ff'), 'Scanner range', r.scan + ' pc', 'colonies see ships and stars here'));
    } else if (st.mode === 'environments') {
      kids.push(kt('Map Key', 'Environments'));
      const cnt = {}; let gaia = 0;
      for (const s of S.stars) { if (!known(E, s.id)) continue; const p = S.planets[s.id]; if (p.type === 'none') continue; cnt[p.type] = (cnt[p.type] || 0) + 1; if (p.growth === 'gaia') gaia++; }
      const th = TH;
      kids.push(h('div.ov-kh', 'You can colonise'));
      const okTypes = ORDER.filter(t => canLive(E, { typeIdx: M.Sim.Galaxy.TYPES.indexOf(t), special: 'normal' })), noTypes = ORDER.filter(t => okTypes.indexOf(t) < 0);
      for (const t of okTypes) kids.push(kr(h('i.ov-let', { style: { '--c': th.leaf } }, LETTER[t]), TYPE_NAME[t], cnt[t] || 0));
      if (gaia) kids.push(kr(h('i.ov-let', { style: { '--c': th.teal } }, 'G'), 'Gaia worlds', gaia, 'any race thrives here'));
      if (noTypes.length) kids.push(h('div.ov-kh', 'Unable to land on'));
      for (const t of noTypes) kids.push(kr(h('i.ov-let', { style: { '--c': th.rose } }, LETTER[t]), TYPE_NAME[t], cnt[t] || 0));
      kids.push(h('div.ov-note', 'Green worlds can be settled with your current colony bases. Planetology research opens the red ones, one type at a time.'));
    } else {
      kids.push(kt('Map Key', 'Minerals'));
      const cnt = {}; for (const s of S.stars) { if (!known(E, s.id)) continue; const p = S.planets[s.id]; if (p.type === 'none') continue; cnt[p.special] = (cnt[p.special] || 0) + 1; }
      const MN = (UI.GalaxyMap && UI.GalaxyMap.MINERALS) || [], colOf = {}; MN.forEach(m => { colOf[m.id] = m.col; });
      for (const [id, name, sub] of MIN_KEY) kids.push(kr(sw('', colOf[id] || '#ddd'), name, cnt[id] || 0, sub));
      kids.push(kr(sw('ring', '#7b89bd'), 'Unexplored', total - kn));
      kids.push(h('div.ov-note', 'Production bonuses apply to industry, ships and defense. Research bonuses multiply what the colony spends on research.'));
    }
    UI.mount(keyEl, kids);
  }

  // ---- behaviour ---------------------------------------------------------------------------------------------------------------------------------
  function setMode(m, silent) {
    st.mode = m;
    for (const k in modeBtns) modeBtns[k].classList.toggle('active', k === m);
    if (map) map.setMode(m);
    paintKey(); if (!silent) UI.sfx('click');
  }
  function close(snd) { if (snd) UI.sfx(snd); UI.Screens.go(st.from || 'galaxy'); }
  function refreshMap() {
    if (!map || !G.S) return;
    map.setState(G.S); map.refresh(); computeReach(); paintKey();
    const S = G.S, E = E_();
    UI.mount(subEl, 'Year ' + M.Sim.Q.year(S) + ' · ' + S.stars.filter(s => known(E, s.id)).length + ' of ' + S.stars.length + ' stars explored');
  }
  function buildMap() {
    map = UI.GalaxyMap.create(mapHost, { minimap: false, legend: false, controls: true, keys: true, hud: true, ruler: true, tooltips: true, fog: true, initialView: 'fit', clearOnEmptyClick: false, envOf: envClass });
    cv = h('canvas.ov-cv'); cx = cv.getContext('2d');
    map.canvas.insertAdjacentElement('afterend', cv);
    map.on('selectStar', id => { if (id === null || id === undefined) return; G.sel.star = id; G.sel.fleet = -1; UI.sfx('click'); UI.Screens.go('galaxy'); });
    UI.watchSize(mapHost, () => { sizeDirty = true; });
    // registered after the map's own frame callback, so the overlay always follows the camera the map has just drawn
    UI.onFrame((dt, t) => {
      if (!UI.Screens.current || UI.Screens.current.id !== 'mapoverview') return;
      if (sizeDirty) { const r = UI.fitCanvas(cv); sizeW = r.w; sizeH = r.h; sizeDirty = false; }
      if (sizeW > 0 && sizeH > 0) drawOverlay(t);
    });
  }

  UI.Screens.register('mapoverview', {
    create(root) {
      mapHost = h('div.ov-main'); keyEl = h('div.ov-key'); subEl = h('small');
      MODES.forEach(([id, label, key]) => { modeBtns[id] = UI.button(label, () => setMode(id, true), { kbd: key, block: true, sfx: 'click' }); });
      const ok = UI.button('OK', () => close(), { primary: true, kbd: 'Space', sfx: 'confirm', block: true });
      const side = h('aside.ov-side', h('div.panel', h('div.ov-title', 'Galaxy Map', subEl), h('div.ov-modes', MODES.map(m => modeBtns[m[0]])), keyEl, h('div.ov-ok', ok)));
      el = h('div.ov', mapHost, side);
      root.appendChild(el);
      mapHost.dataset.help = 'overview.map'; keyEl.dataset.help = 'overview.key'; side.querySelector('.ov-modes').dataset.help = 'overview.modes';      // F1 help anchors
      const scr = { screen: 'mapoverview' };
      MODES.forEach(([id, , key]) => UI.bindKey(key.toLowerCase(), () => setMode(id), scr));
      UI.bindKey('o', () => close('confirm'), scr); UI.bindKey('space', () => close('confirm'), scr); UI.bindKey('escape', () => close('cancel'), scr);
      root.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); close('cancel'); }, true);
      M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'mapoverview') refreshMap(); });
    },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      params = params || {};
      readTheme(); st.uk = uiScale();
      st.from = params.from || 'galaxy';
      if (!map) buildMap();
      refreshMap();
      map.select(null); map.selectFleet(null);
      setMode(MODES.some(m => m[0] === params.mode) ? params.mode : 'colonies', true);
      map.fit();
    },
    leave() { if (map) map.select(null); },
    resize() { sizeDirty = true; st.uk = uiScale(); if (map) map.resize(); },
  });
})(window.MOO);
