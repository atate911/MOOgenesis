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
    .menu-col { position:absolute; left:clamp(2rem, 7vw, 8rem); top:50%; transform:translateY(-50%); width:min(34rem, 86vw); }
    .menu-kicker { font:400 clamp(1rem,1.4vw,1.5rem) var(--font-display); color:var(--brass); letter-spacing:.35em; margin:0 0 .3rem .15rem; opacity:0; animation: menu-fade 1.2s .2s ease-out forwards; }
    .menu-title { margin:0; font:400 clamp(3.2rem, 7.4vw, 8.4rem)/.92 var(--font-title); letter-spacing:.045em; color:transparent;
      background: linear-gradient(100deg, transparent 38%, rgba(255,255,255,.95) 50%, transparent 62%) no-repeat 160% 0 / 260% 100%,
                  linear-gradient(180deg,#fff6d8 0%,#e9cf90 38%,#c39a50 70%,#7d6334 100%);
      -webkit-background-clip:text; background-clip:text; filter: drop-shadow(0 0 28px rgba(214,179,106,.28)) drop-shadow(0 4px 0 rgba(0,0,0,.45));
      animation: menu-sweep 2.6s .5s cubic-bezier(.3,.6,.2,1) 1 both; }
    .menu-sub { margin:.7rem 0 2.4rem .2rem; color:var(--mist); font-size:clamp(1rem,1.25vw,1.35rem); max-width:28rem; opacity:0; animation: menu-fade 1.4s 1.1s ease-out forwards; }
    .menu-list { display:flex; flex-direction:column; gap:.7rem; width:min(21rem, 80vw); opacity:0; animation: menu-fade 1s 1.5s ease-out forwards; }
    .menu-list .btn { justify-content:flex-start; padding:.6em 1.3em; font-size:1.25rem; }
    .menu-foot { position:absolute; left:0; right:0; bottom:.8rem; text-align:center; font-size:.8rem; color:var(--fog); }
    .menu-meta { margin:.2rem 0 0 .2rem; font-size:.82rem; color:var(--mist); }
    @keyframes menu-fade { from { opacity:0; transform:translateY(10px);} to { opacity:1; transform:none; } }
    @keyframes menu-sweep { from { background-position: 160% 0, 0 0; } to { background-position: -60% 0, 0 0; } }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: the original's title menu is plain gold text on the art — no boxes; hover brightens, keyboard focus gets a marker.
  UI.css('menu-orig', bump(`
    .menu-list { gap:.15rem; }
    .menu-list .btn { clip-path:none; background:none; box-shadow:none; padding:.35em .2em; font:400 clamp(1.3rem, 2.2vh, 1.9rem)/1.1 var(--font-title); letter-spacing:.08em; text-transform:none;
      color:#e8b830; text-shadow:0 2px 0 #4a3408, 0 0 18px rgba(232,184,48,.18); transition:color .15s, text-shadow .15s, padding-left .15s; }
    .menu-list .btn::before { display:none; }
    .menu-list .btn:hover, .menu-list .btn:focus-visible { background:none; color:#fff1a8; padding-left:.8em; text-shadow:0 2px 0 #4a3408, 0 0 22px rgba(255,226,120,.55); }
    .menu-list .btn:hover::after, .menu-list .btn:focus-visible::after { content:""; position:absolute; left:.1em; top:50%; width:.45em; height:.45em; margin-top:-.22em; inset:auto; border:0; background:#fff1a8; clip-path:polygon(0 0, 100% 50%, 0 100%); transform:none; left:.1em; top:50%; }
    .menu-list .btn.disabled, .menu-list .btn:disabled { opacity:.35; }
    .menu-list .btn .kbd { display:none; }
    .menu-foot { color:#7d6f9a; letter-spacing:.08em; text-transform:uppercase; font-size:.7rem; }
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
  let canvas, ctx, vortex, bg = null, bgKey = '', t0 = 0, listEl, metaEl;

  function rebuildBackdrop(w, hh) {
    const key = w + 'x' + hh;
    if (key === bgKey || !M.Gfx.pick('space') || !M.Gfx.pick('space').makeBackdrop) return;
    bgKey = key;
    bg = M.Gfx.pick('space').makeBackdrop(Math.min(w, 1600), Math.min(hh, 900), 'menu', { intensity: .9, stars: 1.3, palette: ['#3b1d86', '#14357a', '#7a2a86', '#0d5a7a'] });
  }

  function buildMenu() {
    UI.clear(listEl);
    const latest = M.Save.available() && M.Save.latest();
    if (latest) {
      listEl.appendChild(UI.button('Continue', () => M.Game && M.Game.loadSlot ? M.Game.loadSlot(latest.slot) : UI.toast('Game controller not ready yet', 'warn'), { primary: true }));
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
          h('h1.menu-title', 'Master of Orion'),
          h('div.menu-sub', 'Ten races. One throne-world. Seize the stars, outwit your rivals, and win the vote of the Galactic Council — or end it by force.'),
          listEl, metaEl),
        h('div.menu-foot', 'Master of Orion Reborn · a fan remake — all art, music and text are original')));
      vortex = makeVortex(1);
    },
    enter() {
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
      if (bg) ctx.drawImage(bg, 0, 0, w, hh); else { ctx.fillStyle = '#04061a'; ctx.fillRect(0, 0, w, hh); }
      const R = Math.min(w, hh) * 0.62, rot = -0.35 + Math.sin(t * .05) * .04;
      // GPU vortex (260k stars + bloom for < 1 ms) when WebGL2 is available and the tier allows it; the CPU vortex is the always-working fallback
      const GS = M.Gfx && M.Gfx.GLSpace;
      let drew = false;
      if (GS && GS.supported && GS.supported()) { try { drew = GS.vortex(ctx, w * 0.66, hh * 0.46, R, t, { tilt: 0.42, rot }) !== false; } catch (e) { drew = false; } }
      if (!drew) vortex.draw(ctx, w * 0.66, hh * 0.46, R, t, 0.42, rot);
      // a big slow planet low-left of the vortex (GLPlanets falls back to the CPU renderer by itself)
      const P = M.Gfx && (M.Gfx.pick('planets'));
      if (P && P.draw) {
        try { P.draw(ctx, { look: 'terran', seed: 'menu-world', inhabited: true, color: '#d6b36a' }, w * 0.9, hh * 1.02, Math.min(w, hh) * 0.36, t, { lightAngle: -2.45, spin: 0.01 }); } catch (e) { /* ignore */ }
      }
      // ship fly-by
      const S = M.Gfx && M.Gfx.Ships;
      if (S && S.draw) {
        const u = ((t - t0) * 0.045) % 1.35 - 0.2;
        try { S.draw(ctx, { race: 'human', hull: 3, x: w * (1.1 - u * 1.35), y: hh * (0.2 + u * .1), size: Math.min(w, hh) * 0.2, angle: Math.PI + 0.08, color: '#d6b36a', t, thrust: 0.8 }); } catch (e) { /* ignore */ }
      }
    },
  });
})(window.MOO);
