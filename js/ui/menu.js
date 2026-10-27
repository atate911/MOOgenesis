// Title screen: animated vortex + planet + ship fly-by, wordmark and main menu.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h;

  UI.css('menu', `
    .menu-wrap { position:absolute; inset:0; overflow:hidden; background:#04061a; }
    .menu-wrap canvas { position:absolute; inset:0; width:100%; height:100%; }
    .menu-shade { position:absolute; inset:0; pointer-events:none;
      background: radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(2,3,12,.75) 100%),
                  linear-gradient(90deg, rgba(3,5,18,.85) 0%, rgba(3,5,18,.35) 38%, transparent 62%); }
    .menu-col { position:absolute; left:clamp(2rem, 7vw, 8rem); top:50%; transform:translateY(-50%); width:min(34rem, 86vw); isolation:isolate; }   /* stacking context for the wordmark's extrusion (::before, z-index -1); on the h1 itself it would stop Chromium painting the background-clip:text face */
    .menu-kicker { font:400 clamp(1rem,1.4vw,1.5rem) var(--font-display); color:var(--brass); letter-spacing:.35em; margin:0 0 .3rem .15rem; opacity:0; animation: menu-fade .5s .05s ease-out forwards; }
    /* metallic 3-D wordmark: the face is a steel-to-gold gradient clipped to the glyphs (with the sweep highlight on top), the extrusion and
       bevel are a second copy of the text underneath (::before, same metrics) carrying a stacked text-shadow: 1 px bright bevel up-left,
       six dark steps down-right, a warm glow. The face cannot carry text-shadow itself (background-clip:text clips it away). */
    .menu-title { position:relative; margin:0; font:400 clamp(3.2rem, 7.4vw, 8.4rem)/.92 var(--font-title); letter-spacing:.045em; color:transparent;
      background: linear-gradient(100deg, transparent 38%, rgba(255,255,255,.95) 50%, transparent 62%) no-repeat 160% 0 / 260% 100%,
                  linear-gradient(180deg,#fffbe9 0%,#f4dfa6 22%,#d9b86a 44%,#8e7340 50%,#e6c77e 56%,#b58f4a 76%,#5c4524 100%);
      -webkit-background-clip:text; background-clip:text;   /* no filter here: a filter on a background-clip:text element stops Chromium painting the face; the glow is on ::before */
      animation: menu-sweep 2.6s .5s cubic-bezier(.3,.6,.2,1) 1 both; }
    .menu-title::before { content:attr(data-text); position:absolute; inset:0; z-index:-1; color:#6b542a; -webkit-text-fill-color:#6b542a; background:none;
      text-shadow: -1px -1px 0 rgba(255,250,230,.55), 1px 1px 0 #3a2c12, 2px 2px 0 #332710, 3px 3px 0 #2c210d, 4px 4px 0 #251b0a, 5px 5px 0 #1e1607, 6px 6px 1px #140e04,
                   7px 9px 14px rgba(0,0,0,.6), 0 0 34px rgba(214,179,106,.18); }
    .menu-ver { margin:.7rem 0 0 .3rem; font:400 clamp(.8rem, 1vw, .98rem) var(--font-display); color:var(--brass); letter-spacing:.2em; opacity:0; animation: menu-fade .5s .1s ease-out forwards; }
    .menu-sub { margin:.5rem 0 2.4rem .2rem; color:var(--mist); font-size:clamp(1rem,1.25vw,1.35rem); max-width:28rem; opacity:0; animation: menu-fade .5s .15s ease-out forwards; }
    .menu-list { display:flex; flex-direction:column; gap:.7rem; width:min(21rem, 80vw); opacity:0; animation: menu-fade .4s .1s ease-out forwards; }
    .menu-list .btn { justify-content:flex-start; padding:.6em 1.3em; font-size:1.25rem; }
    .menu-foot { position:absolute; left:0; right:0; bottom:.8rem; text-align:center; font-size:.8rem; color:var(--fog); }
    .menu-meta { margin:.2rem 0 0 .2rem; font-size:.82rem; color:var(--mist); }
    /* a short landscape screen (a phone on its side, a small window): the column was taller than the screen and its centre crop cut the wordmark
       and the last entries. Wordmark and text on the left, the entries beside them on the right. */
    @media (orientation: landscape) and (max-height: 520px) {
      .menu-col { left:clamp(1.2rem, 5vw, 4rem); right:clamp(1.2rem, 5vw, 4rem); width:auto; display:grid; grid-template-columns:minmax(0, 1.3fr) minmax(0, 1fr); column-gap:clamp(1rem, 4vw, 3rem); align-items:start; }
      .menu-kicker, .menu-title, .menu-ver, .menu-sub { grid-column:1; }
      .menu-list { grid-column:2; grid-row:1 / span 4; align-self:center; width:auto; }
      .menu-meta { grid-column:2; }
      .menu-title { font-size:clamp(2.2rem, 10vh, 3.8rem); }
      .menu-kicker { font-size:.9rem; }
      .menu-sub { margin-bottom:0; font-size:.95rem; }
      .menu-foot { bottom:.35rem; font-size:.7rem; }
    }
    @keyframes menu-fade { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:none; } }
    @keyframes menu-sweep { from { background-position: 160% 0, 0 0; } to { background-position: -60% 0, 0 0; } }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // the wordmark face must stay a clipped gradient: theme-v2's generic h1 rule paints headings solid gold with a text-shadow, so these win on specificity
  UI.css('menu-wordmark', bump(`
    .menu-title { color:transparent; -webkit-text-fill-color:transparent; text-shadow:none; }
    .menu-title::before { color:#6b542a; -webkit-text-fill-color:#6b542a; }
  `));
  // Restyle: the original's title menu is plain gold text on the art — no boxes; hover brightens, keyboard focus gets a marker.
  UI.css('menu-orig', bump(`
    .menu-list { gap:.15rem; }
    .menu-list .btn { clip-path:none; background:none; box-shadow:none; padding:.35em .2em; font:400 clamp(1.3rem, 2.2vh, 1.9rem)/1.1 var(--font-title); letter-spacing:.08em; text-transform:none;
      color:#e8b830; text-shadow:0 2px 0 #4a3408, 0 0 18px rgba(232,184,48,.18); transition:color .15s, text-shadow .15s, padding-left .15s; }
    .menu-list .btn::before { display:none; }
    .menu-list .btn:hover, .menu-list .btn:focus-visible { background:none; color:#fff1a8; padding-left:.8em; text-shadow:0 2px 0 #4a3408, 0 0 22px rgba(255,226,120,.55); }
    /* the marker: one small triangle in the row's left padding, on the default row and on the hovered / focused one. inset:auto (which
       clears the kit's focus-ring box) has to come BEFORE left/top: the shorthand resets both, and a marker with auto offsets sits at its
       static position, which in this flex row is on top of the label's first letter */
    .menu-list .btn:hover::after, .menu-list .btn:focus-visible::after, .menu-list .btn.primary::after, .menu-list .btn:first-child::after {
      content:""; position:absolute; inset:auto; left:.1em; top:50%; width:.45em; height:.45em; margin-top:-.22em; border:0; background:#ffd860;
      clip-path:polygon(0 0, 100% 50%, 0 100%); transform:none; pointer-events:none; }
    .menu-list .btn:hover::after, .menu-list .btn:focus-visible::after { background:#fff1a8; }
    .menu-list .btn { color:#f2c640; font-size:clamp(1.4rem, 2.4vh, 2rem); }
    .menu-list .btn.primary, .menu-list .btn:first-child { color:#fff1a8; padding-left:.8em; }
    .menu-list .btn.primary.primary.primary.primary { background:none; box-shadow:none; color:#fff1a8; text-shadow:0 2px 0 #4a3408, 0 0 22px rgba(255,226,120,.45); }
    .menu-list .btn.disabled, .menu-list .btn:disabled { opacity:.5; }
    .menu-list .btn .kbd { display:none; }
    .menu-foot { color:#b8b0d0; letter-spacing:.06em; text-transform:uppercase; font-size:.8rem; } .menu-sub { color:#d8dff5; } .menu-meta { color:#d8dff5; font-size:.92rem; }
    .menu-ver { color:#dcc07c; text-shadow:0 1px 0 rgba(0,0,0,.6); }
  `));

  // ---------------------------------------------------------------- vortex renderer
  function makeSprite(r, g, b) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d'), gr = x.createRadialGradient(8, 8, 0, 8, 8, 8);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.35, `rgba(${r},${g},${b},.45)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 16, 16);
    return c;
  }

  function makeVortex(seed) {
    const rnd = M.RNG.create('vortex' + seed);
    const sprites = [makeSprite(255, 190, 255), makeSprite(150, 120, 255), makeSprite(110, 200, 255), makeSprite(255, 230, 190)];
    const N = 4200, p = [];
    for (let i = 0; i < N; i++) {
      const arm = i % 3;
      const r = Math.pow(rnd.next(), 0.7) * 1.0 + 0.04;
      p.push({ a: arm * 2.0944 + r * 5.2 + (rnd.next() - .5) * .55, r, s: 0.35 + rnd.next() * .8, z: 0.5 + rnd.next() * 1.6, k: rnd.next() < .1 ? 3 : rnd.next() < .45 ? 0 : rnd.next() < .6 ? 2 : 1 });
    }
    return {
      draw(ctx, cx, cy, R, t, tilt, rot) {
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.globalCompositeOperation = 'lighter';
        // core glow
        let g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * .5);
        g.addColorStop(0, 'rgba(255,240,255,.95)'); g.addColorStop(.12, 'rgba(255,170,255,.55)'); g.addColorStop(.4, 'rgba(120,70,220,.22)'); g.addColorStop(1, 'rgba(60,30,160,0)');
        ctx.save(); ctx.scale(1, tilt); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * .5, 0, 6.2832); ctx.fill(); ctx.restore();
        for (let i = 0; i < p.length; i++) {
          const q = p[i];
          // spiral inward; faster near the core
          q.r -= (0.012 + 0.03 / (q.r * 4 + .3)) * q.s * 0.016;
          q.a += (0.16 / Math.sqrt(q.r + .06)) * q.s * 0.016;
          if (q.r < 0.035) { q.r = 0.95 + Math.random() * 0.1; }
          const rr = q.r * R, x = Math.cos(q.a) * rr, y = Math.sin(q.a) * rr * tilt;
          const sz = (1.6 + (1 - q.r) * 5) * q.z * (R / 520);
          ctx.globalAlpha = Math.min(1, .25 + (1 - q.r) * .9) * (.6 + .4 * Math.sin(t * 1.5 + i));
          ctx.drawImage(sprites[q.k], x - sz, y - sz, sz * 2, sz * 2);
        }
        ctx.restore();
      },
    };
  }

  // ---------------------------------------------------------------- screen
  let canvas, ctx, vortex, bg = null, bgKey = '', t0 = 0, listEl, metaEl, scratch = null;
  function shipScratch(w, hh) {
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width !== w || scratch.height !== hh) { scratch.width = w; scratch.height = hh; }
    return scratch;
  }

  function rebuildBackdrop(w, hh) {
    const key = w + 'x' + hh;
    if (key === bgKey || !M.Gfx.pick('space') || !M.Gfx.pick('space').makeBackdrop) return;
    bgKey = key;
    const Sp = M.Gfx.pick('space');
    bg = Sp.makeBackdrop(Math.min(w, 1600), Math.min(hh, 900), 'menu', Sp.sky ? Sp.sky({ intensity: .7, stars: 1.3, floor: 0.08 }) : { intensity: .9, stars: 1.3, palette: ['#3b1d86', '#14357a', '#7a2a86', '#0d5a7a'] });   // the one sky (the photoreal galaxy covers it when loaded)
  }

  // Continue = the newest save, in this browser or on the save server (that list arrives a moment later and rebuilds the menu if newer)
  let menuGen = 0;
  function buildMenu() {
    const my = ++menuGen;
    const local = M.Save.available() && M.Save.latest();
    drawMenu(local);
    M.Save.Server.probe().then(ok => (ok ? M.Save.Server.list() : [])).then(list => {
      const remote = list.filter(e => e.meta).sort((a, b) => (b.meta.at || 0) - (a.meta.at || 0))[0];
      if (my === menuGen && remote && (!local || (remote.meta.at || 0) > (local.meta.at || 0))) drawMenu(Object.assign({ server: true }, remote));
    }).catch(() => { /* server slots are optional */ });
  }
  function cannotContinue(err) { if (err) console.error('[continue]', err); UI.alert((err && err.message) || 'The last save could not be loaded. It may be damaged or from an older version.', { title: 'Cannot continue' }); }
  function drawMenu(latest) {
    UI.clear(listEl);
    if (latest) {
      listEl.appendChild(UI.button('Continue', () => {
        if (!(M.Game && M.Game.loadSlot)) { UI.toast('Game controller not ready yet', 'warn'); return; }
        if (latest.server) { M.Game.loadServer(latest.slot).then(ok => { if (!ok) cannotContinue(); }, cannotContinue); return; }
        let ok = false; try { ok = M.Game.loadSlot(latest.slot); } catch (e) { console.error('[continue]', e); }
        if (!ok) cannotContinue();
      }, { primary: true }));
    }
    listEl.appendChild(UI.button('New game', () => UI.Screens.has('setup') ? UI.Screens.go('setup') : UI.toast('New game setup is not available yet', 'warn'), { primary: !latest }));
    listEl.appendChild(UI.button('Load game', () => UI.Screens.has('saveload') ? UI.Screens.go('saveload', { mode: 'load', from: 'menu' }) : UI.toast('Load screen is not available yet', 'warn')));
    listEl.appendChild(UI.button('Options', () => UI.Screens.has('options') ? UI.Screens.go('options', { from: 'menu' }) : UI.toast('Options are not available yet', 'warn')));
    listEl.appendChild(UI.button('Almanac', () => UI.Screens.has('help') ? UI.Screens.go('help', { from: 'menu' }) : UI.toast('The almanac is not available yet', 'warn')));
    metaEl.textContent = latest && latest.meta ? `Last played: ${M.Util.cap(latest.meta.race || '')} · year ${latest.meta.year >= 1000 ? latest.meta.year : M.Data.Config.displayYear({ year: latest.meta.year })} · ${latest.meta.planets} colonies` : '';
  }

  UI.Screens.register('menu', {
    create(el) {
      canvas = h('canvas');
      listEl = h('div.menu-list'); metaEl = h('div.menu-meta');
      el.appendChild(h('div.menu-wrap', canvas, h('div.menu-shade'),
        h('div.menu-col',
          h('div.menu-kicker', 'The galaxy awaits'),
          h('h1.menu-title', { 'data-text': 'Master of Orion' }, 'Master of Orion'),
          h('div.menu-ver', 'Version ' + (M.VERSION || '') + ' · © Andrew Tate, 2026'),
          h('div.menu-sub', 'Ten races. One throne-world. Seize the stars, outwit your rivals, and win the vote of the Galactic Council — or end it by force.'),
          listEl, metaEl),
        h('div.menu-foot', 'Master of Orion Reborn · a fan remake — all art, music and text are original')));
      vortex = makeVortex(1);
    },
    enter() {
      try { const WA = M.Gfx.WorldArt; if (WA) WA.get(WA.scene('galaxy')); } catch (e) { /* optional */ }
      t0 = performance.now() / 1000;
      buildMenu();
      try { if (M.Audio && M.Audio.Music) M.Audio.Music.play('title', { fade: 2.5 }); } catch (e) { /* audio optional */ }
    },
    leave() { },
    resize() { bgKey = ''; },
    update(dt, t) {
      const f = UI.fitCanvas(canvas, { maxDpr: 1.5 }); ctx = f.ctx;
      const w = f.w, hh = f.h;
      rebuildBackdrop(w, hh);
      ctx.globalCompositeOperation = 'source-over';
      const WA = M.Gfx && M.Gfx.WorldArt, art = WA && WA.draw(ctx, WA.scene('galaxy'), 0, 0, w, hh, { fx: 0.62, fy: 0.46, zoom: 1.04 + 0.03 * Math.sin(t * 0.05) });   // photoreal galaxy replaces the painted sky + vortex
      if (art) { ctx.fillStyle = 'rgba(2,4,14,.28)'; ctx.fillRect(0, 0, w, hh); }
      else if (bg) ctx.drawImage(bg, 0, 0, w, hh); else { ctx.fillStyle = '#04061a'; ctx.fillRect(0, 0, w, hh); }
      const R = Math.min(w, hh) * 0.62, rot = -0.35 + Math.sin(t * .05) * .04;
      // GPU vortex (260k stars + bloom for < 1 ms) when WebGL2 is available and the tier allows it; the CPU vortex is the always-working fallback
      const GS = M.Gfx && M.Gfx.GLSpace;
      let drew = false;
      if (art) drew = true;
      else if (GS && GS.supported && GS.supported()) { try { drew = GS.vortex(ctx, w * 0.66, hh * 0.46, R, t, { tilt: 0.42, rot }) !== false; } catch (e) { drew = false; } }
      if (!drew) vortex.draw(ctx, w * 0.66, hh * 0.46, R, t, 0.42, rot);
      // a big slow world low-right, its upper half on screen (GLPlanets falls back to the CPU renderer by itself). The seed is one whose
      // axis tilts away from the viewer, so what we see is mid-latitudes sweeping past, not a polar cap turning in place; one turn in about a minute;
      // the sun low from the upper-left (the galaxy's side), so the terminator, the city lights and the cloud shadows cross the visible
      // part; and a little parallax against the galaxy's slow breathing zoom (same phase, a larger excursion: it is nearer)
      const P = M.Gfx && (M.Gfx.pick('planets'));
      if (P && P.draw) {
        const par = Math.sin(t * 0.05);
        try { P.draw(ctx, { look: 'terran', seed: 'menu-world-32', inhabited: true, color: '#d6b36a' }, w * (0.9 + 0.012 * par), hh * (1.02 + 0.02 * par), Math.min(w, hh) * 0.36, t, { lightAngle: -2.9, lightElev: 0.15, spin: 0.016, cloudShadows: true }); } catch (e) { /* ignore */ }
      }
      // ship fly-by, right to left across the top (a path that stays above the wordmark). The 3/4 render carries its own studio light,
      // which read as a cut-out against the scene: it is drawn to a scratch canvas and relit there — exposure down (it is far from any
      // sun), the side away from the planet's sun (upper-left) in shadow, a cool fill from the galaxy, a quieter drive — then composited.
      const S = M.Gfx && M.Gfx.Ships;
      if (S && S.draw) {
        const u = ((t - t0) * 0.045) % 1.35 - 0.2, sz = Math.min(w, hh) * 0.19, sx = w * (1.1 - u * 1.35), sy = hh * (0.07 + u * .07);
        try {
          const sc = shipScratch(Math.ceil(sz * 1.6), Math.ceil(sz * 1.1)), g = sc.getContext('2d');
          g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, sc.width, sc.height);
          S.draw(g, { race: 'human', hull: 3, x: sc.width * 0.5, y: sc.height * 0.5, size: sz, angle: Math.PI + 0.08, color: '#d6b36a', t, thrust: 0.4, view: '3q' });
          g.globalCompositeOperation = 'source-atop';
          let lg = g.createLinearGradient(sc.width * 0.2, 0, sc.width, sc.height * 0.6);
          lg.addColorStop(0, 'rgba(6,8,22,0)'); lg.addColorStop(0.45, 'rgba(6,8,22,.32)'); lg.addColorStop(1, 'rgba(6,8,22,.78)');
          g.fillStyle = lg; g.fillRect(0, 0, sc.width, sc.height);
          lg = g.createLinearGradient(0, sc.height, 0, 0);
          lg.addColorStop(0, 'rgba(120,150,255,0)'); lg.addColorStop(1, 'rgba(120,150,255,.14)');
          g.fillStyle = lg; g.fillRect(0, 0, sc.width, sc.height);
          g.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 0.86;
          ctx.drawImage(sc, sx - sc.width * 0.5, sy - sc.height * 0.5);
          ctx.globalAlpha = 1;
        } catch (e) { /* ignore */ }
      }
      if (art && M.Gfx.Grade) { try { M.Gfx.Grade.apply(ctx, w, hh, t, 'plate'); } catch (e) { /* optional */ } }   // one grade on every plate (visual-system-plan.md 2.8)
    },
  });
})(window.MOO);
