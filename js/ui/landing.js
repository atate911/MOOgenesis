// Landing, ground combat & bombardment scenes (research/06 §5.3 colonisation landing, §6.3 bombardment, §6.4 landing / ground combat).
//
//   MOO.UI.Landing.colony(planetId[, {name}]) → Promise<string|null>   the colony-ship landing animation + the rename-your-planet prompt. Resolves with the new
//        name (null = unchanged). The `rename` order is applied at once when the planet is already yours, otherwise (flow.js calls this inside the colonise
//        handler, before Turn.run founds the colony) it is queued and applied the moment the colony exists (end of the turn at the latest).
//   MOO.UI.Ground.show({result}) → Promise<{skipped}>                  the invasion scene for a Sim.Ground.invade() record (turn interrupt `ground`); records with
//        visible:false (no human involved) are ignored. Also accepts {type:'bombard', …event} and {type:'bombardPrompt', planet, preview} interrupts.
//   MOO.UI.Ground.bombardPrompt({planet, preview}) → Promise<boolean>  "Bomb?" panel (preview = Sim.Ground.bombPreview) — Bomb (B) / Cancel (Esc)
//   MOO.UI.Ground.bombardResult(r) → Promise                           explosion animation + "population killed / factories destroyed" (r = the {type:'bombard'} event of Ground.bombard)
//   MOO.UI.Ground.bombard(planetId[, {preview}]) → Promise<boolean>    prompt + order {t:'bombard', planet, yes}
//   MOO.UI.Ground.askPending() → Promise<n>                            runs the prompt for every entry of Sim.Ground.pending(S, player) (call before the bombardment phase)
//   MOO.UI.Landing.demo(kind) / MOO.UI.Ground.demo(kind)               plays a scene from live game state ('colony' | 'invade' | 'invadeLost' | 'bomb' | 'bombResult' | 'bombBio' | 'bombDestroy')
//   Screen 'landing' hosts all of them (the lead's soundscape maps it to the ground music); opened directly (?screen=landing&demo=invade) it plays a demo.
//   Keys: Space / click = skip to the next stage, Enter = confirm, Esc / right-click = skip all (or Cancel), B = Bomb, C = Continue.
//   Test hooks (like GNN's): Landing._frame(dt) advances the running scene by hand (rAF does not tick while the browser pane is hidden), Landing._state().
//   Optional deps (all guarded): Gfx.Scenes.surface / battle, Gfx.Ships, Gfx.Portraits, Gfx.Fx, Audio.Music / SFX, Settings (animSpeed, reduceMotion), Perf.q.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util;
  const Landing = (UI.Landing = {}), Ground = (UI.Ground = {});
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, min = Math.min, max = Math.max, floor = Math.floor, ceil = Math.ceil, round = Math.round;
  const sqrt = Math.sqrt, pow = Math.pow, hypot = Math.hypot, atan2 = Math.atan2;
  const clamp = U.clamp, lerp = U.lerp;

  // ================================================================================================================================ helpers
  const easeOut = t => 1 - pow(1 - clamp(t, 0, 1), 3);
  function hashStr(s) { s = String(s); let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function rng32(a) {
    a = a >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const plural = (n, one, many) => (n === 1 ? one : many || one + 's');
  const round1 = v => Math.round((+v || 0) * 10) / 10;
  const EMP = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];          // banner colours (css/base.css --emp0..5)
  const FIELDS = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];
  const FIELD_ICON = ['computers', 'construction', 'forcefield', 'planetology', 'propulsion', 'weapons'];
  const rgba = (hex, a) => U.rgba(hex, a);
  const warned = {};
  function warnOnce(k, e) { if (!warned[k]) { warned[k] = 1; console.warn('[landing] ' + k + ' failed — using fallback:', e && e.message || e); } }

  const gfx = n => (M.Gfx && M.Gfx[n]) || null;
  const fxQuality = () => clamp((M.Perf && M.Perf.q ? M.Perf.q.particles : 1), 0.25, 1);
  const reduceMotion = () => !!(M.Settings && M.Settings.get('reduceMotion'));
  function animSpeed() { const s = M.Settings ? M.Settings.get('animSpeed') : 1; return s === 0 ? 0 : s >= 2 ? 1.8 : 1; }
  function music(id, o) { try { const m = M.Audio && M.Audio.Music; if (m && m.play) m.play(id, o || { fade: 0.9 }); } catch (e) { /* audio is optional */ } }
  const sfx = (id, o) => UI.sfx(id, o);
  const displayYear = () => (G && G.S && M.Data && M.Data.Config ? M.Data.Config.displayYear(G.S) : '');

  function empInfo(id, raceFallback) {
    const S = G && G.S, E = S && S.empires ? S.empires[id] : null, races = (M.Data && M.Data.Races && M.Data.Races.races) || {};
    const rid = (E && E.race) || raceFallback || 'human', rc = races[rid] || {};
    return { id, race: rid, name: (E && E.name) || rc.name || cap(rid), plural: (E && E.plural) || rc.plural || cap(rid) + 's', adj: rc.adj || cap(rid),
      leader: E ? E.leader : '', human: !!(E && E.human), banner: E ? E.color | 0 : 0, color: E ? EMP[(E.color | 0) % 6] : '#98a5cf' };
  }
  function lookOf(p) { if (!p) return 'terran'; if (p.growth === 'gaia') return 'gaia'; if (p.type === 'none') return 'asteroids'; return p.type || 'terran'; }
  const planetName = (S, p) => (p && (p.name || (S.stars[p.starId] && S.stars[p.starId].name))) || 'the colony';
  function techOf(t) {
    const T = M.Data && M.Data.Techs; if (!T) return null;
    return (t.id && T.byId && T.byId[t.id]) || (T.techAt && T.techAt(t.field, t.level)) || null;
  }
  function badge(race, color, px) {
    const c = h('canvas', { width: px * 2, height: px * 2 }), P = gfx('Portraits');
    try { if (P && P.drawBadge) P.drawBadge(c.getContext('2d'), race, px, px, px - 2, { color, t: 0, _snap: true, key: '@ld-badge|' + race + color }); } catch (e) { warnOnce('badge', e); }
    return h('div.ld-badge', c);
  }

  // ================================================================================================================================ css
  UI.css('landing', `
    .ld { position:absolute; inset:0; overflow:hidden; background:#02030a; cursor:default; }
    .ld-cv { position:absolute; inset:0; width:100%; height:100%; }
    .ld-ui { position:absolute; inset:0; pointer-events:none; }
    .ld-ui > * { pointer-events:auto; }
    .ld-ui > .ld-top, .ld-ui > .ld-hud, .ld-ui > .ld-colhd, .ld-ui > .ld-colft { pointer-events:none; }
    .ld-top { position:absolute; left:0; right:0; top:0; display:flex; align-items:center; gap:.9rem; padding:.8rem 1.4rem 2.6rem; background:linear-gradient(180deg, rgba(3,5,16,.86), rgba(3,5,16,.4) 55%, rgba(3,5,16,0)); }
    .ld-badge { width:3.3rem; height:3.3rem; flex:none; } .ld-badge canvas { width:100%; height:100%; display:block; filter:drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
    .ld-year { font:400 1.9rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.07em; text-shadow:0 0 18px rgba(214,179,106,.35); font-variant-numeric:tabular-nums; }
    .ld-race { margin-top:.2rem; font-size:1rem; color:var(--mist); letter-spacing:.05em; }
    .ld-kind { margin-left:auto; text-align:right; font:400 1.1rem var(--font-display); color:var(--brass); letter-spacing:.2em; text-transform:uppercase; text-shadow:0 1px 6px #000; }
    .ld-hint { position:absolute; left:50%; bottom:.7rem; transform:translateX(-50%); font-size:.85rem; color:var(--mist); opacity:.85; letter-spacing:.08em; pointer-events:none; text-shadow:0 1px 4px #000; white-space:nowrap; }
    .ld-hint kbd { font:500 .78rem var(--font-ui); padding:.05em .45em; margin:0 .25em 0 .9em; color:var(--brass-hi); border:1px solid rgba(214,179,106,.5); background:rgba(8,12,34,.6); } .ld-hint kbd:first-child { margin-left:0; }
    .ld-panel { position:absolute; padding:.9rem 1.1rem 1rem; }
    .ld-panel::before { background:linear-gradient(180deg, rgba(14,21,56,.93), rgba(6,10,28,.95)) !important; }
    .ld-eyebrow { font:400 .9rem var(--font-display); color:var(--brass); letter-spacing:.22em; text-transform:uppercase; }
    .ld-title { margin:.1rem 0 .5rem; font:400 2.2rem/1.05 var(--font-title); color:var(--brass-hi); letter-spacing:.03em; text-shadow:0 0 22px rgba(214,179,106,.25); }
    .ld-chips { display:flex; flex-wrap:wrap; gap:.35rem; margin:0 0 .6rem; }
    .ld-body { margin:.2rem 0 .5rem; font-size:1.05rem; line-height:1.45; color:var(--ivory); }
    .ld-flav { margin:.1rem 0 .7rem; padding-left:.7rem; border-left:2px solid rgba(214,179,106,.45); font-size:.95rem; line-height:1.4; color:var(--mist); font-style:italic; }
    .ld-kv { display:grid; grid-template-columns:repeat(2, 1fr); gap:.3rem .7rem; margin:.2rem 0 .7rem; font-variant-numeric:tabular-nums; }
    .ld-kv > div { display:flex; justify-content:space-between; gap:.5rem; padding:.18rem .5rem; background:rgba(0,0,0,.3); border:1px solid rgba(214,179,106,.18); }
    .ld-kv span:first-child { color:var(--mist); } .ld-kv b { font-weight:600; }
    .ld-nameRow { display:block; margin:.2rem 0 .3rem; } .ld-nameRow > span { display:block; margin-bottom:.25rem; font:400 .92rem var(--font-display); letter-spacing:.14em; color:var(--brass); text-transform:uppercase; }
    .ld-name { width:100%; font:400 1.5rem/1.2 var(--font-title); letter-spacing:.03em; color:var(--brass-hi); padding:.3em .6em; }
    .ld-nameHint { margin:0 0 .6rem; font-size:.8rem; color:var(--fog); }
    .ld-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:.55rem; }
    .ld-colony { left:62%; top:14%; width:min(35%, 31rem); min-width:22rem; }
    @media (max-width:62rem), (max-aspect-ratio:1/1) { .ld-colony { left:50%; transform:translateX(-50%); top:auto; bottom:2.4rem; width:min(94%, 34rem); min-width:0; } .ld-title { font-size:1.7rem; } }
    .ld-hud { position:absolute; left:50%; top:4.3rem; transform:translateX(-50%); width:min(92%, 62rem); display:grid; gap:.3rem; transition:opacity .7s; }
    .ld-hud > div { display:flex; align-items:center; gap:.7rem; padding:.3rem .9rem; background:rgba(5,8,24,.78); border-left:3px solid var(--c, var(--brass)); font-size:1.12rem; letter-spacing:.02em; text-shadow:0 1px 3px #000; backdrop-filter:blur(3px); }
    .ld-hud b { font-weight:600; font-variant-numeric:tabular-nums; color:var(--c, var(--ivory)); } .ld-hud .dim { color:var(--mist); }
    .ld-hud .bad { color:var(--rose); }
    .ld-colhd { position:absolute; display:flex; align-items:center; gap:.6rem; padding:.25rem .8rem; color:var(--ivory); background:linear-gradient(90deg, color-mix(in srgb, var(--c) 26%, rgba(5,8,24,.9)), rgba(5,8,24,.78)); border-bottom:2px solid var(--c); box-shadow:0 2px 12px rgba(0,0,0,.5); opacity:0; transition:opacity .6s; }
    .ld-colhd.on { opacity:1; } .ld-colhd.att { flex-direction:row-reverse; text-align:right; background:linear-gradient(270deg, color-mix(in srgb, var(--c) 26%, rgba(5,8,24,.9)), rgba(5,8,24,.78)); }
    .ld-colhd .who { font:400 1.15rem var(--font-display); letter-spacing:.1em; color:var(--ivory); text-transform:uppercase; } .ld-colhd .role { font-size:.82rem; letter-spacing:.14em; color:var(--c); text-transform:uppercase; }
    .ld-colhd .n { margin-left:auto; font:400 1.7rem/1 var(--font-title); font-variant-numeric:tabular-nums; color:var(--ivory); } .ld-colhd.att .n { margin-left:0; margin-right:auto; }
    .ld-colhd .n small { font:400 .8rem var(--font-ui); color:var(--mist); margin-left:.4em; letter-spacing:.06em; }
    .ld-colft { position:absolute; text-align:center; font-size:.88rem; letter-spacing:.1em; color:var(--mist); text-transform:uppercase; opacity:0; transition:opacity .6s; text-shadow:0 1px 3px #000; }
    .ld-colft.on { opacity:1; } .ld-colft b { color:var(--ivory); font-weight:600; }
    .ld-result { left:50%; bottom:2.2rem; transform:translateX(-50%); width:min(94%, 50rem); animation:ld-rise .5s var(--ease) both; }
    @keyframes ld-rise { from { opacity:0; transform:translate(-50%, 18px); } to { opacity:1; transform:translate(-50%, 0); } }
    .ld-rtitle { font:400 2.3rem/1.05 var(--font-title); letter-spacing:.07em; text-transform:uppercase; margin:.1rem 0 .45rem; text-shadow:0 0 24px color-mix(in srgb, currentColor 40%, transparent); }
    .ld-rtitle.good { color:var(--leaf); } .ld-rtitle.bad { color:var(--rose); } .ld-rtitle.neutral { color:var(--brass-hi); }
    .ld-rline { margin:.15rem 0; font-size:1.08rem; line-height:1.4; } .ld-rline b { color:var(--brass-hi); font-weight:600; font-variant-numeric:tabular-nums; } .ld-rline.dim { color:var(--mist); }
    .ld-rchips { display:flex; flex-wrap:wrap; gap:.4rem; margin:.5rem 0 .2rem; }
    .ld-stat { display:inline-flex; align-items:baseline; gap:.4rem; padding:.2rem .65rem; background:rgba(0,0,0,.32); border:1px solid rgba(214,179,106,.22); font-size:.95rem; color:var(--mist); }
    .ld-stat b { font:400 1.25rem var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; } .ld-stat.good b { color:var(--leaf); } .ld-stat.bad b { color:var(--rose); } .ld-stat.gold b { color:var(--gold); }
    .ld-techs { margin:.7rem 0 .2rem; } .ld-techs > h4 { font:400 .92rem var(--font-display); letter-spacing:.16em; color:var(--cyan); text-transform:uppercase; margin-bottom:.35rem; }
    .ld-techgrid { display:grid; grid-template-columns:repeat(auto-fill, minmax(15rem, 1fr)); gap:.35rem .5rem; }
    .ld-tech { display:flex; gap:.55rem; align-items:center; padding:.3rem .55rem; background:rgba(98,216,255,.07); border:1px solid rgba(98,216,255,.28); opacity:0; animation:ld-techin .45s var(--ease) forwards; }
    .ld-tech .ico { width:1.5rem; height:1.5rem; color:var(--cyan); flex:none; } .ld-tech b { display:block; font-weight:600; font-size:1rem; color:var(--ivory); line-height:1.15; } .ld-tech span { display:block; font-size:.8rem; color:var(--mist); letter-spacing:.04em; }
    @keyframes ld-techin { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .ld-bomb { left:56%; top:15%; width:min(40%, 35rem); min-width:23rem; }
    .ld-bomb .ld-kv { grid-template-columns:1fr; } .ld-bomb .ld-kv > div.warn { border-color:rgba(255,148,64,.55); background:rgba(255,148,64,.1); } .ld-bomb .ld-kv > div.bad { border-color:rgba(255,92,106,.5); background:rgba(255,92,106,.08); }
    .ld-note { margin:.4rem 0; padding:.4rem .7rem; border-left:3px solid var(--ember); background:rgba(255,148,64,.09); font-size:.95rem; line-height:1.35; }
    .ld-note.bio { border-left-color:var(--leaf); background:rgba(95,220,143,.09); } .ld-note.dim { border-left-color:var(--fog); background:rgba(152,165,207,.07); color:var(--mist); }
    @media (max-width:62rem), (max-aspect-ratio:1/1) { .ld-bomb { left:50%; transform:translateX(-50%); top:auto; bottom:2.4rem; width:min(94%, 34rem); min-width:0; } }
    @media (max-height:46rem) { .ld-title { font-size:1.7rem; margin-bottom:.3rem; } .ld-rtitle { font-size:1.8rem; } .ld-flav { display:none; } }
  `);

  // ================================================================================================================================ pending renames
  // flow.js asks for the landing inside the colonise handler — the colony is founded a moment later, when Turn.run resumes.
  const pendingNames = {};
  function applyRename(planetId, name) {
    const S = G && G.S; if (!S || !name) return;
    const p = S.planets[planetId]; if (!p) return;
    if (p.owner === S.playerId) { if (name !== p.name) G.order({ t: 'rename', planet: planetId, name }); delete pendingNames[planetId]; return; }
    pendingNames[planetId] = { name, turn: S.turn };
  }
  function flushNames(final) {
    const S = G && G.S; if (!S) return;
    for (const id of Object.keys(pendingNames)) {
      const p = S.planets[id], e = pendingNames[id];
      if (p && p.owner === S.playerId) { delete pendingNames[id]; if (e.name !== p.name) G.order({ t: 'rename', planet: +id, name: e.name }); }
      else if (final || S.turn > e.turn + 1) delete pendingNames[id];
    }
  }
  if (M.Bus) { M.Bus.on('turn:end', () => flushNames(true)); M.Bus.on('state', () => flushNames(false)); M.Bus.on('game:new', () => { for (const k in pendingNames) delete pendingNames[k]; }); }

  // ================================================================================================================================ scene host (screen 'landing')
  const Host = { el: null, cv: null, ctx: null, ui: null, w: 2, h: 2, dpr: 1, fx: null, scene: null, run: null, queue: [], prev: null, hint: null };

  function buildHost(el) {
    Host.cv = h('canvas.ld-cv');
    Host.ui = h('div.ld-ui');
    Host.hint = h('div.ld-hint');
    Host.el = h('div.ld', Host.cv, Host.ui, Host.hint);
    el.appendChild(Host.el);
    Host.ctx = Host.cv.getContext('2d');
    Host.cv.addEventListener('pointerdown', e => { if (e.button === 0) act('click'); });
    Host.el.addEventListener('contextmenu', e => { e.preventDefault(); act('cancel'); });
    const fxm = (M.Gfx && M.Gfx.pick('fx')); if (fxm && fxm.create) { try { Host.fx = fxm.create({ maxParticles: 3500 }); } catch (e) { warnOnce('fx', e); } }
  }
  function fit() {
    if (!Host.cv) return;
    const r = Host.cv.getBoundingClientRect(), dpr = clamp(M.Perf && M.Perf.dpr ? M.Perf.dpr() : (window.devicePixelRatio || 1), 1, 2);
    const w = max(2, round(r.width)), hh = max(2, round(r.height));
    if (Host.cv.width !== round(w * dpr) || Host.cv.height !== round(hh * dpr)) { Host.cv.width = round(w * dpr); Host.cv.height = round(hh * dpr); }
    Host.w = w; Host.h = hh; Host.dpr = dpr;
    Host.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Host.scene && Host.scene.layout) Host.scene.layout(w, hh);
  }
  function act(kind) { if (Host.scene && Host.scene.input) Host.scene.input(kind); }
  function setHint(html) { if (Host.hint) Host.hint.innerHTML = html || ''; }
  const KEY = (k, label) => '<kbd>' + k + '</kbd>' + label;

  const MAKERS = {};      // kind → (host, data, run) => scene {layout(w,h), update(dt, speed), draw(ctx, w, h), input(kind), music(), dispose()}
  const FALSE_KINDS = { bombPrompt: 1 };
  function enqueue(kind, data) { return new Promise(resolve => { Host.queue.push({ kind, data, resolve }); pump(); }); }
  function pump() {
    if (Host.run || !Host.queue.length) return;
    if (!UI.Screens || !UI.Screens.has('landing')) { const r = Host.queue.shift(); r.resolve(FALSE_KINDS[r.kind] ? false : null); pump(); return; }
    const run = Host.queue.shift(); Host.run = run;
    const cur = UI.Screens.current;
    if (!cur || cur.id !== 'landing') Host.prev = cur ? { id: cur.id, params: cur.params } : null;
    UI.Screens.go('landing', { _run: run });
    // the soundscape glue switches the music when the screen changes; our own cue goes on top afterwards
    if (Host.run === run && run.scene && run.scene.music) run.scene.music();
  }
  function begin(run) {
    fit();
    if (Host.fx) { Host.fx.clear(); Host.fx.setQuality(fxQuality() * (reduceMotion() ? 0.5 : 1)); }
    UI.clear(Host.ui); setHint('');
    try { run.scene = MAKERS[run.kind](Host, run.data, run); }
    catch (e) { console.error('[landing] scene failed to start:', e); run.scene = null; endRun(run, FALSE_KINDS[run.kind] ? false : null); return; }
    Host.scene = run.scene;
    if (run.scene.layout) run.scene.layout(Host.w, Host.h);
    if (run.scene.music) run.scene.music();
  }
  function endRun(run, value) {
    if (Host.run !== run || run.ended) return;
    run.ended = true;
    try { if (run.scene && run.scene.dispose) run.scene.dispose(); } catch (e) { console.error(e); }
    Host.scene = null; Host.run = null; UI.clear(Host.ui); setHint('');
    if (Host.queue.length) { run.resolve(value); pump(); return; }
    const prev = Host.prev; Host.prev = null;
    run.leaving = true;
    try {
      const to = prev && UI.Screens.has(prev.id) && prev.id !== 'landing' ? prev : (G && G.S && UI.Screens.has('galaxy') ? { id: 'galaxy', params: {} } : null);
      if (to) UI.Screens.go(to.id, to.params);
    } catch (e) { console.error(e); }
    run.resolve(value);
  }
  function endRunSilently(run) {
    run.ended = true;
    try { if (run.scene && run.scene.dispose) run.scene.dispose(); } catch (e) { console.error(e); }
    Host.scene = null; Host.run = null; Host.prev = null;
    run.resolve(FALSE_KINDS[run.kind] ? false : null);
    if (Host.queue.length) setTimeout(pump, 0);
  }
  function frame(dt) {
    const sc = Host.scene; if (!sc || !Host.run) return;
    dt = min(dt, 0.05);
    if (Host.cv.width < 4) fit();
    const sp = animSpeed();
    if (Host.fx) Host.fx.update(dt * (sp || 1));
    sc.update(dt, sp);
    if (Host.scene !== sc) return;                           // the scene ended itself
    sc.draw(Host.ctx, Host.w, Host.h);
  }
  Landing._frame = frame;
  Landing._state = () => (Host.run ? { kind: Host.run.kind, phase: Host.scene && Host.scene.phase ? Host.scene.phase() : '', queued: Host.queue.length } : null);

  UI.Screens.register('landing', {
    create(el) { buildHost(el); },
    enter(params) {
      const run = params && params._run;
      if (run && Host.run === run) { if (!run.started) { run.started = true; begin(run); } return; }
      if (!Host.run && !run) Landing.demo(new URLSearchParams(location.search).get('demo') || 'colony');
    },
    leave() {
      const run = Host.run;
      if (run && !run.leaving && !run.ended) endRunSilently(run);       // somebody else navigated away mid-scene
    },
    update(dt) { frame(dt); },
    resize() { fit(); },
  });
  const bindScreenKey = (combo, kind) => UI.bindKey(combo, () => act(kind), { screen: 'landing' });
  bindScreenKey('space', 'space'); bindScreenKey('enter', 'enter'); bindScreenKey('escape', 'cancel'); bindScreenKey('b', 'b'); bindScreenKey('c', 'c'); bindScreenKey('n', 'n');

  // shared header (year · race · kind) and chamfered panel
  function topBar(race, color, kindText) {
    const rc = empInfo(-1, race);
    return h('div.ld-top', badge(race, color, 36), h('div', h('div.ld-year', 'Year ' + displayYear()), h('div.ld-race', rc.plural)), h('div.ld-kind', kindText));
  }
  const panelBox = (cls, ...kids) => h('div.panel.ld-panel.' + cls, ...kids);
  function drawFade(ctx, w, hh, a) { if (a > 0.003) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(a, 0, 1) + ')'; ctx.fillRect(0, 0, w, hh); } }
  function vignette(ctx, w, hh, strength) {
    const vg = ctx.createRadialGradient(w * 0.5, hh * 0.52, min(w, hh) * 0.42, w * 0.5, hh * 0.52, hypot(w, hh) * 0.62); vg.addColorStop(0, 'rgba(2,3,10,0)'); vg.addColorStop(1, 'rgba(2,3,10,' + strength + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, hh);
  }

  // ================================================================================================================================ 1. colonisation landing
  const COLONY_BODY = [
    'The first {adj} colonists step out of their ship onto the soil of {name}.',
    'Engines fall silent. The {plural} have a new home: {name}.',
    'The landing party raises the {adj} banner over {name}, and the long voyage is over.',
    'Shuttles unload tents, tools and seed stock; {name} is a new {adj} colony.',
  ];
  const SPECIAL_CHIP = { ultrapoor: ['Ultra poor minerals', 'warn'], poor: ['Poor minerals', 'warn'], rich: ['Mineral rich', 'cy'], ultrarich: ['Ultra rich minerals', 'cy'], artifacts: ['Ancient artifacts', 'vi'], orion: ['Orion', 'vi'] };

  MAKERS.colony = function (H, d, run) {
    const S = G.S, P = d.planet, EI = d.emp, T = { fadeIn: 0.9, start: 0.45, descend: 6.0 };
    const look = lookOf(P), seed = (P.id * 7919 + (P.gfx | 0)) | 0, defName = (d.opts && d.opts.name) || planetName(S, P);
    let tl = 0, touched = false, populated = false, flashT = -1, closing = -1, sfxDone = false, panelShown = false, panelAt = 1e9, result = null, ended = false;

    const text = M.Data && M.Data.text, flav = text && text.planetFlavor && text.planetFlavor[look];
    const body = COLONY_BODY[(P.id + hashStr(EI.race)) % COLONY_BODY.length].replace('{plural}', EI.plural).replace('{adj}', EI.adj).replace('{name}', defName);
    const chips = [h('span.chip', cap(P.type === 'none' ? 'barren' : P.type) + ' world')];
    if (P.growth === 'hostile') chips.push(h('span.chip.warn', 'Hostile environment'));
    else if (P.growth === 'fertile') chips.push(h('span.chip.ok', 'Fertile'));
    else if (P.growth === 'gaia') chips.push(h('span.chip.ok', 'Gaia'));
    if (SPECIAL_CHIP[P.special]) chips.push(h('span.chip.' + SPECIAL_CHIP[P.special][1], SPECIAL_CHIP[P.special][0]));

    const input = h('input.field.ld-name', { type: 'text', maxlength: 11, value: defName, spellcheck: false, autocomplete: 'off', 'aria-label': 'Planet name' });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirm(); } });
    input.addEventListener('input', () => { const v = input.value.replace(/[^\w \-']/g, ''); if (v !== input.value) input.value = v; });
    const okBtn = UI.button('Found the colony', () => confirm(), { primary: true, kbd: '↵' });
    const panel = panelBox('ld-colony', h('div.ld-eyebrow', 'Colony established'), h('div.ld-title', defName), h('div.ld-chips', chips), h('p.ld-body', body),
      flav ? h('p.ld-flav', flav[(P.id * 3 + 1) % flav.length]) : null,
      h('div.ld-kv', h('div', h('span', 'Colonists'), h('b.t-leaf', '2 million')), h('div', h('span', 'Maximum population'), h('b', (P.maxPop | 0) + ' million'))),
      h('label.ld-nameRow', h('span', 'Name this world'), input), h('div.ld-nameHint', 'Up to 11 characters — leave it as it is to keep the name.'), h('div.ld-actions', okBtn));
    panel.style.opacity = '0'; panel.style.pointerEvents = 'none';
    H.ui.appendChild(topBar(EI.race, EI.color, 'Colonisation'));
    H.ui.appendChild(panel);
    setHint(KEY('Space', ' skip the landing'));

    function fallback(ctx, w, hh, landing) {
      const g = ctx.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#102a5a'); g.addColorStop(0.6, '#6aa6e0'); g.addColorStop(0.6, '#3f7a45'); g.addColorStop(1, '#14301c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh);
      const y = lerp(hh * 0.05, hh * 0.62, landing); ctx.fillStyle = EI.color; ctx.beginPath(); ctx.moveTo(w * 0.3, y - 22); ctx.lineTo(w * 0.3 - 14, y + 14); ctx.lineTo(w * 0.3 + 14, y + 14); ctx.closePath(); ctx.fill();
      return { site: { x: w * 0.22, y: hh * 0.55, w: w * 0.16, h: hh * 0.1 } };
    }
    function reveal() {
      if (panelShown) return; panelShown = true;
      panel.style.transition = 'opacity .55s'; panel.style.opacity = '1'; panel.style.pointerEvents = 'auto';
      setHint(KEY('↵', ' accept the name') + KEY('Esc', ' keep the name'));
      setTimeout(() => { if (!ended) { try { input.focus({ preventScroll: true }); input.select(); } catch (e) { /* not focusable yet */ } } }, 300);
    }
    function touch(skip) {
      if (touched) return; touched = true;
      if (!sfxDone) { sfxDone = true; sfx('colonize'); }
      if (skip) { flashT = tl - 0.3; panelAt = tl + 0.7; } else { flashT = tl + 0.55; panelAt = tl + 1.5; }
    }
    function confirm() {
      if (closing >= 0 || !touched) return;
      const raw = input.value.replace(/[^\w \-']/g, '').trim().slice(0, 11);
      result = raw && raw !== defName ? raw : null;
      closing = tl; panel.style.transition = 'opacity .35s'; panel.style.opacity = '0'; panel.style.pointerEvents = 'none'; setHint('');
      sfx('confirm');
    }
    return {
      phase: () => (closing >= 0 ? 'closing' : panelShown ? 'name' : touched ? 'landed' : 'descend'),
      music() { music('galaxy1', { fade: 1.4 }); },
      update(dt, sp) {
        tl += dt * (sp === 0 ? 1e3 : sp);
        if (sp === 0 && !touched) { tl = T.start + T.descend + 0.01; touch(true); }
        if (!sfxDone && tl >= T.start + T.descend - 0.95) { sfxDone = true; sfx('colonize'); }
        if (!touched && tl >= T.start + T.descend) touch(false);
        if (touched && flashT >= 0 && tl - flashT > 0.55) populated = true;
        if (touched && !panelShown && tl >= panelAt) reveal();
        if (closing >= 0 && tl - closing > 0.5 && !ended) { ended = true; endRun(run, result); }
      },
      draw(ctx, w, hh) {
        const u = clamp((tl - T.start) / T.descend, 0, 1), landing = 1 - pow(1 - u, 2.3);
        let info = null; const Sc = gfx('Scenes');
        if (Sc && Sc.surface) { try { info = Sc.surface.draw(ctx, w, hh, tl, { look, seed, populated, landing, race: EI.race, color: EI.color }); } catch (e) { warnOnce('surface', e); } }
        if (!info) info = fallback(ctx, w, hh, landing);
        if (flashT >= 0) {                                               // "colony founded": a warm flash over the landing site, the settlement appears under it
          const f = sin(clamp((tl - flashT) / 1.3, 0, 1) * PI);
          if (f > 0.01) {
            const s = info.site, cx = s.x + s.w / 2, cy = s.y + s.h * 0.6, r = max(w, hh) * (0.18 + 0.5 * f);
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,244,210,' + 0.9 * f + ')'); g.addColorStop(0.35, 'rgba(255,200,120,' + 0.45 * f + ')'); g.addColorStop(1, 'rgba(255,170,80,0)');
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); ctx.restore();
          }
        }
        vignette(ctx, w, hh, 0.5);
        drawFade(ctx, w, hh, max(1 - tl / T.fadeIn, closing >= 0 ? (tl - closing) / 0.45 : 0));
      },
      input(k) {
        if (closing >= 0) return;
        if (!touched) { if (k === 'space' || k === 'click' || k === 'enter' || k === 'cancel') { tl = max(tl, T.start + T.descend); touch(true); } return; }
        if (!panelShown) { reveal(); return; }
        if (k === 'enter') confirm();
        else if (k === 'space' && document.activeElement !== input) confirm();
        else if (k === 'cancel') { input.value = defName; confirm(); }
      },
      dispose() { ended = true; },
    };
  };

  Landing.colony = function (planetId, opts) {
    const S = G && G.S, P = S && S.planets[planetId];
    if (!P) return Promise.resolve(null);
    return enqueue('colony', { planet: P, emp: empInfo(S.playerId), opts: opts || null }).then(name => { if (name) applyRename(planetId, name); return name; });
  };

  // ================================================================================================================================ 2. ground combat (invasion)
  const _sold = new Map();
  // a tiny soldier on a unit square, baked at px × px; face = +1 looks right, -1 left; dead = grave marker
  function soldierSprite(px, color, face, dead) {
    const key = px + '|' + color + '|' + face + '|' + (dead ? 1 : 0);
    let c = _sold.get(key); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d'); g.scale(px, px);
    if (dead) {
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0.5, 0.78, 0.3, 0.1, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,92,106,.78)'; g.lineWidth = 0.075; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0.3, 0.5); g.lineTo(0.7, 0.86); g.moveTo(0.7, 0.5); g.lineTo(0.3, 0.86); g.stroke();
    } else {
      if (face < 0) { g.translate(1, 0); g.scale(-1, 1); }
      const dk = U.darken(color, 0.55), mid = U.darken(color, 0.12), hi = U.lighten(color, 0.55);
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0.5, 0.94, 0.27, 0.05, 0, 0, TAU); g.fill();
      g.fillStyle = dk; g.fillRect(0.33, 0.66, 0.14, 0.27); g.fillRect(0.53, 0.66, 0.14, 0.27);                                // legs
      const tg = g.createLinearGradient(0.3, 0.4, 0.7, 0.7); tg.addColorStop(0, hi); tg.addColorStop(0.35, color); tg.addColorStop(1, dk);
      g.fillStyle = tg; g.beginPath(); g.moveTo(0.3, 0.42); g.lineTo(0.7, 0.42); g.lineTo(0.77, 0.69); g.lineTo(0.23, 0.69); g.closePath(); g.fill();   // torso
      g.strokeStyle = 'rgba(6,9,26,.8)'; g.lineWidth = 0.035; g.lineJoin = 'round'; g.stroke();
      g.fillStyle = '#0c1130'; g.fillRect(0.5, 0.49, 0.43, 0.065);                                                               // rifle
      g.fillStyle = mid; g.fillRect(0.52, 0.505, 0.3, 0.035);
      g.fillStyle = '#e8e2cc'; g.beginPath(); g.arc(0.5, 0.27, 0.14, 0, TAU); g.fill();                                          // head
      g.fillStyle = color; g.beginPath(); g.arc(0.5, 0.25, 0.155, PI, TAU); g.closePath(); g.fill();                              // helmet
      g.strokeStyle = 'rgba(6,9,26,.85)'; g.lineWidth = 0.03; g.beginPath(); g.arc(0.5, 0.27, 0.15, 0, TAU); g.stroke();
      g.fillStyle = hi; g.fillRect(0.4, 0.17, 0.1, 0.03);
    }
    _sold.set(key, c); if (_sold.size > 90) _sold.delete(_sold.keys().next().value);
    return c;
  }
  const PER_ROW = 15;

  MAKERS.ground = function (H, d, run) {
    const S = G.S, R = d.result, rebel = !!R.rebellion;
    const AT = empInfo(R.attacker, R.attackerRace), DF = empInfo(R.defender, R.defenderRace), P = S.planets[R.planet] || { id: R.planet, type: 'terran', growth: 'normal' };
    const look = lookOf(P), seed = (P.id * 7919 + (P.gfx | 0)) | 0, pname = R.planetName || planetName(S, P);
    const landed = max(0, R.landed | 0), nDef = max(0, R.defenders | 0);
    const sent = max(R.sent !== undefined ? R.sent | 0 : landed, landed), arrived = R.arrived !== undefined ? R.arrived | 0 : landed;
    const lostTotal = max(0, sent - arrived), gt = R.gauntlet || {};
    const rounds = R.rounds && R.rounds.length ? R.rounds : [{ a: landed, d: nDef }];
    const a0 = max(0, rounds[0].a | 0), d0 = max(0, rounds[0].d | 0), steps = rounds.length - 1, hasFight = steps > 0 && a0 > 0 && d0 > 0;
    const side = AT.human ? 'a' : DF.human ? 'd' : '';
    const humanWon = rebel ? !!R.success : side === 'a' ? !!R.success : side === 'd' ? !R.success : false;
    const humanLost = rebel ? !R.success : side ? !humanWon : false;
    const rnd = rng32(hashStr('ground' + R.planet + ':' + sent + ':' + nDef + ':' + landed));
    const TIME = { intro: 0.9, approach: sent > 0 && !rebel ? 4.1 : 0, land: 1.3, hold: 1.0 };
    TIME.fight = hasFight ? clamp(3.4 + steps * 0.05, 3.6, 10.5) : 0;

    // ---- the approach: up to 28 sprites stand for the transports -----------------------------------------------------------------------------------
    const ns = rebel ? 0 : clamp(sent, 0, 28), DESC = 2.3;                // seconds a transport needs for its descent
    const lostSprites = ns === 0 ? 0 : arrived <= 0 ? ns : clamp(round(lostTotal / max(1, sent) * ns), lostTotal > 0 ? 1 : 0, ns - 1);
    const shipsT = [];
    for (let i = 0; i < ns; i++) shipsT.push({ rx: 0.12 + 0.66 * ((i * 0.618034 + 0.07) % 1), ry: 0.66 + 0.18 * rnd(), delay: 0.05 + 0.85 * rnd(), phase: rnd() * TAU, doomed: false, deathT: 0, dead: false, done: false, shot: false, kind: '', launchU: 0, from: null, killAt: 0 });
    { const idx = shipsT.map((_, i) => i).sort(() => rnd() - 0.5); for (let k = 0; k < lostSprites; k++) { const s = shipsT[idx[k]]; s.doomed = true; s.deathT = 0.5 + 0.35 * rnd(); } }
    const shipSize = () => clamp(Host.h * 0.1 * (ns > 14 ? 0.8 : 1), 28, 120);

    // ---- soldier grids (structure of arrays: no allocation per frame) -------------------------------------------------------------------------------
    const nA = a0, nD = d0, deadA = new Uint8Array(nA), deadD = new Uint8Array(nD), flashA = new Float32Array(nA), flashD = new Float32Array(nD);
    const PA = { x: new Float32Array(nA), y: new Float32Array(nA) }, PD = { x: new Float32Array(nD), y: new Float32Array(nD) };
    const ordA = Array.from({ length: nA }, (_, i) => i).sort(() => rnd() - 0.5), ordD = Array.from({ length: nD }, (_, i) => i).sort(() => rnd() - 0.5);
    let killedA = 0, killedD = 0;
    const L = { def: { x: 0, y: 0, w: 1, h: 1 }, att: { x: 0, y: 0, w: 1, h: 1 }, cell: 20 };
    const tracers = { n: 0, d: new Float32Array(6 * 48) };

    // ---- state ---------------------------------------------------------------------------------------------------------------------------------------
    let tl = 0, phase = 'intro', ph0 = 0, shownAtt = sent, dimA = 0, panelA = 0, landFlash = 0, gunT = 0.2, stepIdx = 0, closing = -1, ended = false, resultShown = false, tracerClock = 0;
    const shake = [0, 0];

    // ---- DOM -----------------------------------------------------------------------------------------------------------------------------------------
    const hudAtt = h('div', { style: { '--c': AT.color } }, h('span', rebel ? 'Loyal troops' : 'Invasion force'), h('b', ''), h('span.dim', ''));
    const hudDef = h('div', { style: { '--c': DF.color } }, h('span', rebel ? 'Rebels' : 'Defenders'), h('b', ''), h('span.dim', ''));
    const hud = h('div.ld-hud', hudAtt, hudDef);
    const nDefEl = h('span.n', ''), nAttEl = h('span.n', '');
    const hdDef = h('div.ld-colhd.def', { style: { '--c': DF.color } }, h('div', h('div.who', rebel ? 'Rebels' : DF.plural), h('div.role', rebel ? 'Rebellion' : 'Defenders')), nDefEl);
    const hdAtt = h('div.ld-colhd.att', { style: { '--c': AT.color } }, h('div', h('div.who', rebel ? 'Loyalists' : AT.plural), h('div.role', rebel ? 'Loyal troops' : 'Invaders')), nAttEl);
    const ftDef = h('div.ld-colft', ''), ftAtt = h('div.ld-colft', '');
    H.ui.appendChild(topBar(AT.race, AT.color, rebel ? 'Rebellion' : 'Invasion')); H.ui.appendChild(hud); H.ui.appendChild(hdDef); H.ui.appendChild(hdAtt); H.ui.appendChild(ftDef); H.ui.appendChild(ftAtt);
    setHint(KEY('Space', ' skip') + KEY('Esc', ' skip all'));
    let resultEl = null;
    const showHeads = () => { for (const e of [hdDef, hdAtt, ftDef, ftAtt]) e.classList.add('on'); };

    function setNums() {
      const aLeft = nA - killedA, dLeft = nD - killedD;
      nAttEl.innerHTML = aLeft + '<small>' + plural(aLeft, 'trooper') + '</small>'; nDefEl.innerHTML = dLeft + '<small>' + plural(dLeft, 'trooper') + '</small>';
    }
    function setHud() {
      const a = hudAtt.children, dd = hudDef.children;
      if (rebel) {
        a[1].textContent = String(landed); a[2].textContent = plural(landed, 'loyal trooper lands', 'loyal troopers land');
        dd[1].textContent = String(nDef); dd[2].textContent = 'rebels hold ' + pname;
        return;
      }
      a[1].textContent = shownAtt + ' of ' + sent;
      a[2].innerHTML = AT.adj + ' ' + plural(sent, 'transport') + (shownAtt < sent ? ' <span class="bad">— ' + (sent - shownAtt) + ' lost</span>' : '');
      dd[1].textContent = String(nDef); dd[2].textContent = DF.adj + ' ' + plural(nDef, 'defender') + ' on ' + pname;
    }
    setNums(); setHud();

    // ---- approach geometry ----------------------------------------------------------------------------------------------------------------------------
    function shipPos(s, u) {
      const w = Host.w, hh = Host.h, e = easeOut(u);
      return { x: w * s.rx + sin(tl * 1.4 + s.phase) * 6 * (1 - e), y: lerp(-hh * 0.1, hh * s.ry, e) };
    }
    function planShots() {                          // who shoots each doomed transport, from where and when (so the hit lands where the sprite is)
      const w = Host.w, hh = Host.h;
      for (const s of shipsT) {
        if (!s.doomed) continue;
        const tgt = shipPos(s, s.deathT);
        if (gt.monster) { s.kind = 'ray'; s.from = { x: w * 0.5, y: -20 }; s.launchU = s.deathT; }
        else if ((gt.bases | 0) > 0) { s.kind = 'missile'; s.from = { x: clamp(tgt.x + (rnd() - 0.5) * w * 0.35, 30, w - 30), y: hh * 0.97 }; s.launchU = clamp(s.deathT - (hypot(tgt.x - s.from.x, tgt.y - s.from.y) / 470) / DESC, 0, 0.85); }
        else { s.kind = 'beam'; s.from = { x: rnd() < 0.5 ? -10 : w + 10, y: hh * (0.08 + 0.2 * rnd()) }; s.launchU = s.deathT; }
      }
    }
    function killShip(s) {
      if (s.dead) return; s.dead = true;
      const fx = H.fx, q = shipPos(s, clamp((ph0 - s.delay) / DESC, 0, 1));
      if (fx) fx.explosion(q.x, q.y, shipSize() * 1.5, { kind: 'fire' });
      sfx('explosion_small', { vol: 0.6, pan: clamp((q.x / Host.w - 0.5) * 1.4, -1, 1) });
      shownAtt = max(arrived, shownAtt - max(1, round(lostTotal / max(1, lostSprites)))); setHud();
    }
    function fireShot(s) {
      s.shot = true; const fx = H.fx; if (!fx) { s.dead = true; return; }
      const tgt = shipPos(s, s.deathT);
      if (s.kind === 'missile') { fx.missile(s.from.x, s.from.y, tgt.x, tgt.y, 520, 'nuclear', { scale: 0.7, onHit: () => killShip(s) }); sfx('missile_launch', { vol: 0.3 }); }
      else if (s.kind === 'ray') { fx.beam(s.from.x, s.from.y, tgt.x, tgt.y, 'deathray', 0.55, { scale: 0.6 }); s.killAt = ph0 + 0.1; }
      else { fx.beam(s.from.x, s.from.y, tgt.x, tgt.y, 'phasor', 0.4, { scale: 0.8 }); sfx('laser', { vol: 0.45 }); s.killAt = ph0 + 0.12; }
    }
    function updateApproach() {
      for (const s of shipsT) {
        if (s.dead) continue;
        const u = clamp((ph0 - s.delay) / DESC, 0, 1);
        if (s.doomed && !s.shot && ph0 >= s.delay && u >= s.launchU) fireShot(s);
        if (s.killAt && ph0 >= s.killAt) killShip(s);
      }
    }
    function drawApproach(ctx) {
      const Sh = gfx('Ships'); if (!Sh || !ns) return;
      const size = shipSize(), a = phase === 'land' ? 1 - easeOut(ph0 / 0.9) : 1;
      if (a < 0.02) return;
      ctx.globalAlpha = a;
      for (let i = 0; i < shipsT.length; i++) {
        const s = shipsT[i]; if (s.dead) continue;
        const u = phase === 'intro' ? 0 : phase === 'land' ? 1 : clamp((ph0 - s.delay) / DESC, 0, 1), q = shipPos(s, u);
        try { Sh.draw(ctx, { race: AT.race, hull: ns > 14 ? 0 : 1, x: q.x, y: q.y, size, angle: PI / 2, color: AT.color, t: tl + i, thrust: 1 - u * 0.85, flags: { troops: true } }); } catch (e) { warnOnce('ships', e); }
      }
      ctx.globalAlpha = 1;
    }

    // ---- ground fight ---------------------------------------------------------------------------------------------------------------------------------
    function layoutSoldiers() {
      const cell = L.cell, pad = 10;
      const fill = (Pn, r, n, right) => {
        const rows = ceil(n / PER_ROW);
        for (let i = 0; i < n; i++) { const col = i % PER_ROW, row = (i / PER_ROW) | 0; Pn.x[i] = right ? r.x + r.w - pad - (col + 1) * cell : r.x + pad + col * cell; Pn.y[i] = r.y + (r.h - rows * cell) / 2 + row * cell; }
      };
      fill(PD, L.def, nD, false); fill(PA, L.att, nA, true);
    }
    function kill(sideId, idx, quiet) {
      const dead = sideId === 'a' ? deadA : deadD; if (dead[idx]) return; dead[idx] = 1;
      (sideId === 'a' ? flashA : flashD)[idx] = 1;
      const Pn = sideId === 'a' ? PA : PD, fx = H.fx;
      if (fx && !quiet) fx.sparks(Pn.x[idx] + L.cell * 0.5, Pn.y[idx] + L.cell * 0.55, 5, sideId === 'a' ? '#ffb070' : '#ff8a60');
    }
    function applyStep(k, quiet) {
      k = clamp(k | 0, 0, steps); const r = rounds[k];
      const wantA = nA - clamp(r.a | 0, 0, nA), wantD = nD - clamp(r.d | 0, 0, nD);
      while (killedA < wantA && killedA < nA) { kill('a', ordA[killedA], quiet); killedA++; }
      while (killedD < wantD && killedD < nD) { kill('d', ordD[killedD], quiet); killedD++; }
      setNums();
    }
    function aliveIdx(sideId) {
      const dead = sideId === 'a' ? deadA : deadD, n = sideId === 'a' ? nA : nD;
      if (!n) return -1;
      for (let tries = 0; tries < 8; tries++) { const i = (rnd() * n) | 0; if (!dead[i]) return i; }
      for (let i = 0; i < n; i++) if (!dead[i]) return i;
      return -1;
    }
    function tracer(fromSide) {                       // a bullet streak from a random live soldier to a random live enemy (cosmetic: the kills come from the record)
      const other = fromSide === 'a' ? 'd' : 'a', a = aliveIdx(fromSide), b = aliveIdx(other); if (a < 0 || b < 0 || tracers.n >= 48) return;
      const p = fromSide === 'a' ? PA : PD, q = other === 'a' ? PA : PD, c = L.cell, o = tracers.n * 6, dd = tracers.d;
      dd[o] = p.x[a] + c * (fromSide === 'a' ? 0.1 : 0.9); dd[o + 1] = p.y[a] + c * 0.5; dd[o + 2] = q.x[b] + c * 0.5 + (rnd() - 0.5) * c * 0.5; dd[o + 3] = q.y[b] + c * 0.5 + (rnd() - 0.5) * c * 0.5; dd[o + 4] = 0;
      dd[o + 5] = 3.5 + rnd() * 2.5;                // progress per second
      const fl = fromSide === 'a' ? flashA : flashD; fl[a] = max(fl[a], 0.6); tracers.n++;
    }
    function updateFight(dt) {
      const fx = H.fx, prog = TIME.fight > 0 ? clamp(ph0 / TIME.fight, 0, 1) : 1, k = floor(prog * steps + 1e-6);
      if (k > stepIdx) { const dk = k - stepIdx; stepIdx = k; applyStep(k, false); for (let i = 0; i < min(5, 1 + dk); i++) tracer(rnd() < 0.5 ? 'a' : 'd'); }
      tracerClock -= dt; if (tracerClock <= 0 && ph0 < TIME.fight) { tracerClock = 0.05 + rnd() * 0.07; tracer(rnd() < 0.5 ? 'a' : 'd'); }
      gunT -= dt; if (gunT <= 0 && ph0 < TIME.fight) { gunT = 0.11 + rnd() * 0.15; sfx('ground_fire', { vol: 0.34, pan: (rnd() - 0.5) * 0.7 }); }
      if (fx && rnd() < dt * 5) { const sd = rnd() < 0.5 ? L.att : L.def; fx.flashAt(sd.x + rnd() * sd.w, sd.y + rnd() * sd.h, 14 + rnd() * 10, '#ffc890', 0.14); }
      decayFlashes(dt);
      if (ph0 >= TIME.fight) { applyStep(steps, false); go('hold'); }
    }
    function decayFlashes(dt) {
      for (let i = 0; i < nA; i++) if (flashA[i] > 0) flashA[i] = max(0, flashA[i] - dt * 3);
      for (let i = 0; i < nD; i++) if (flashD[i] > 0) flashD[i] = max(0, flashD[i] - dt * 3);
      const dd = tracers.d;
      for (let i = tracers.n - 1; i >= 0; i--) { const o = i * 6; dd[o + 4] += dt * dd[o + 5]; if (dd[o + 4] >= 1) { tracers.n--; const l = tracers.n * 6; for (let j = 0; j < 6; j++) dd[o + j] = dd[l + j]; } }
    }
    function panelFrame(ctx, r, col, a) {
      const c = 12, x = r.x, y = r.y, w = r.w, hh = r.h;
      ctx.save(); ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + hh - c); ctx.lineTo(x + w - c, y + hh); ctx.lineTo(x + c, y + hh); ctx.lineTo(x, y + hh - c); ctx.lineTo(x, y + c); ctx.closePath();
      const g = ctx.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, 'rgba(14,21,56,.72)'); g.addColorStop(1, 'rgba(5,8,24,.78)'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(214,179,106,.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    function drawGrid(ctx, Pn, n, dead, flash, col, face, t) {
      const cell = L.cell, px = max(8, round(cell * Host.dpr * 1.1)), alive = soldierSprite(px, col, face, false), grave = soldierSprite(px, col, face, true);
      const sz = cell * 0.98, ox = (cell - sz) / 2;
      for (let i = 0; i < n; i++) {
        const x = Pn.x[i], y = Pn.y[i];
        if (dead[i]) { ctx.globalAlpha *= 0.85; ctx.drawImage(grave, x + ox, y + ox, sz, sz); ctx.globalAlpha /= 0.85; continue; }
        ctx.drawImage(alive, x + ox, y + ox + sin(t * 2.6 + i * 1.7) * cell * 0.015, sz, sz);
        if (flash[i] > 0.02) {
          const mx = x + cell * (face > 0 ? 0.92 : 0.08), my = y + cell * 0.52, ga = ctx.globalAlpha;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * flash[i];
          const g = ctx.createRadialGradient(mx, my, 0, mx, my, cell * 0.5); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = g; ctx.fillRect(mx - cell * 0.5, my - cell * 0.5, cell, cell); ctx.restore();
        }
      }
    }
    function drawPanels(ctx) {
      const a = panelA, t = tl;
      panelFrame(ctx, L.def, DF.color, a); panelFrame(ctx, L.att, AT.color, a);
      ctx.globalAlpha = a;
      drawGrid(ctx, PD, nD, deadD, flashD, DF.color, 1, t); drawGrid(ctx, PA, nA, deadA, flashA, AT.color, -1, t);
      ctx.globalAlpha = 1;
      if (tracers.n) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
        const dd = tracers.d;
        for (let i = 0; i < tracers.n; i++) {
          const o = i * 6, p = dd[o + 4], q = max(0, p - 0.07);
          ctx.strokeStyle = 'rgba(255,224,170,' + (0.95 * (1 - p * 0.35)) + ')'; ctx.beginPath();
          ctx.moveTo(lerp(dd[o], dd[o + 2], q), lerp(dd[o + 1], dd[o + 3], q)); ctx.lineTo(lerp(dd[o], dd[o + 2], p), lerp(dd[o + 1], dd[o + 3], p)); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // ---- phases ---------------------------------------------------------------------------------------------------------------------------------------
    function settleShips() {
      for (const s of shipsT) { if (s.doomed) s.dead = true; s.done = true; }
      shownAtt = rebel ? sent : arrived; setHud();
    }
    function go(p) {
      phase = p; ph0 = 0;
      if (p === 'approach') sfx('open', { vol: 0.5 });
      else if (p === 'land') {
        settleShips(); hud.style.opacity = '0';
        if (landed > 0) sfx('troops_land');
        const fx = H.fx; if (fx) for (const s of shipsT) if (!s.dead) { const q = shipPos(s, 1); fx.ring(q.x, q.y + 6, 4, 40, '#ffd9a0', 0.7); }
        showHeads(); if (!hasFight) dimA = 0.6;
      } else if (p === 'fight') { gunT = 0.1; stepIdx = 0; dimA = 1; panelA = 1; landFlash = 0; hud.style.opacity = '0'; music('ground', { fade: 0.6 }); }
      else if (p === 'result') showResult();
    }
    function skipToFight() {
      settleShips(); if (H.fx) H.fx.clear(); showHeads(); dimA = 1; panelA = 1; landFlash = 0;
      if (hasFight) { phase = 'fight'; ph0 = 0; stepIdx = 0; gunT = 0.1; hud.style.opacity = '0'; } else go('result');
    }
    function skipToResult() {
      if (phase === 'result') return;
      settleShips(); if (H.fx) H.fx.clear(); showHeads(); dimA = 1; panelA = 1; landFlash = 0; hud.style.opacity = '0';
      applyStep(steps, true); phase = 'result'; ph0 = 0; showResult();
    }

    // ---- result ---------------------------------------------------------------------------------------------------------------------------------------
    function showResult() {
      if (resultShown) return; resultShown = true;
      settleShips(); applyStep(steps, true); tracers.n = 0;
      const win = !!R.success, tone = humanWon ? 'good' : humanLost ? 'bad' : 'neutral', surv = R.survivors | 0, left = R.defendersLeft | 0;
      const A = AT.human ? 'Our troops' : 'The ' + AT.plural, Dn = (DF.human ? 'our ' : 'the ') + '<b>' + nDef + '</b> ' + (DF.human ? '' : DF.adj + ' ');
      let title, line;
      if (rebel) {
        title = win ? 'Order restored' : 'The rebels hold on';
        line = win ? 'Loyal troops retake <b>' + pname + '</b>; <b>' + surv + '</b> ' + plural(surv, 'trooper') + ' survive and the rebellion is crushed.'
          : 'The loyal troops fail to break the rebels at <b>' + pname + '</b>; <b>' + left + '</b> ' + plural(left, 'rebel') + ' remain.';
      } else if (landed <= 0) {
        title = AT.human ? 'Invasion failed' : 'Invasion repelled';
        line = (arrived <= 0 && sent > 0)
          ? (gt.monster ? 'A monster guarding <b>' + pname + '</b> destroyed every transport before it could land.' : 'Every one of the <b>' + sent + '</b> ' + plural(sent, 'transport') + ' was shot down on the way in to <b>' + pname + '</b>.')
          : 'No troops reached the surface of <b>' + pname + '</b>.';
      } else if (win) {
        title = DF.human ? 'Planet lost' : 'Planet captured';
        line = A + ' overwhelm ' + Dn + plural(nDef, 'defender') + ' and take <b>' + pname + '</b>; <b>' + surv + '</b> ' + plural(surv, 'trooper') + ' survive' + (AT.human ? ' as its new garrison.' : '.');
      } else {
        title = AT.human ? 'Invasion failed' : 'Invasion repelled';
        line = (DF.human ? 'Our defenders' : 'The ' + DF.adj + ' defenders') + ' hold <b>' + pname + '</b> against <b>' + landed + '</b> ' + plural(landed, 'invader') + '; <b>' + left + '</b> ' + plural(left, 'defender') + ' remain.';
      }
      const chip = (label, v, cls) => h('span.ld-stat' + (cls ? '.' + cls : ''), label, h('b', String(v)));
      const chips = [];
      if (!rebel && sent > 0) chips.push(chip('Sent', sent), chip('Landed', landed, landed > 0 ? '' : 'bad'));
      if (!rebel && (R.overflow | 0) > 0) chips.push(chip('Over the 300 limit', R.overflow, 'bad'));
      if (hasFight || rebel) chips.push(chip(win ? 'Survivors' : 'Defenders left', win ? surv : left, win ? 'good' : ''));
      if (win && R.captured && R.captured.factories > 0) chips.push(chip(rebel ? 'Factories saved' : 'Factories captured', R.captured.factories, 'gold'));
      const techs = (R.captured && R.captured.techs) || [];
      let techBlock = null;
      if (win && !rebel && techs.length) {
        techBlock = h('div.ld-techs', h('h4', 'Technologies captured'), h('div.ld-techgrid', techs.map((t, i) => {
          const tt = techOf(t), nm = t.name || (tt && tt.name) || 'Technology';
          return h('div.ld-tech', { style: { animationDelay: (0.25 + i * 0.22) + 's' } }, UI.icon(FIELD_ICON[t.field] || 'tech'), h('div', h('b', nm), h('span', (FIELDS[t.field] || 'Technology') + ' · level ' + t.level)));
        })));
      } else if (win && !rebel && (R.theftRolls | 0) > 0) techBlock = h('div.ld-rline.dim', 'The captured laboratories held nothing the ' + AT.plural + ' did not already know.');
      resultEl = panelBox('ld-result', h('div.ld-rtitle.' + tone, title), h('div.ld-rline', { html: line }), chips.length ? h('div.ld-rchips', chips) : null, techBlock,
        h('div.ld-actions', UI.button('Continue', () => close(), { primary: true, kbd: 'Space' })));
      H.ui.appendChild(resultEl);
      setHint(KEY('Space', ' continue'));
      sfx(humanWon ? 'tech' : humanLost ? 'war' : 'alert', { vol: 0.8 });
      if (R.eliminated) setTimeout(() => { if (!ended) sfx('planet_destroyed', { vol: 0.5 }); }, 600);
    }
    function close() { if (closing >= 0) return; closing = tl; setHint(''); if (resultEl) { resultEl.style.transition = 'opacity .35s'; resultEl.style.opacity = '0'; resultEl.style.animation = 'none'; } sfx('click'); }

    const sc = {
      phase: () => phase,
      layout(w, hh) {
        // two panels facing each other; each hugs its grid (15 soldiers per row), both centred on the same band of the screen
        const m = w * 0.045, gap = w * 0.07, pw = (w - 2 * m - gap) / 2, stageTop = hh * 0.225, stageBot = hh * 0.62, pad = 10;
        const rows = ceil(max(nA, nD, 1) / PER_ROW);
        L.cell = floor(clamp(min((pw - 2 * pad) / PER_ROW, (stageBot - stageTop - 2 * pad) / max(rows, 3)), 8, 60));
        const gw = PER_ROW * L.cell + 2 * pad, gh = max(rows, 3) * L.cell + 2 * pad, top = stageTop + (stageBot - stageTop - gh) / 2;
        L.def = { x: w / 2 - gap / 2 - gw, y: top, w: gw, h: gh }; L.att = { x: w / 2 + gap / 2, y: top, w: gw, h: gh };
        layoutSoldiers();
        for (const [el, r] of [[hdDef, L.def], [hdAtt, L.att]]) { el.style.top = (r.y - el.offsetHeight - 6) + 'px'; el.style.left = r.x + 'px'; el.style.width = r.w + 'px'; }
        for (const [el, r] of [[ftDef, L.def], [ftAtt, L.att]]) { el.style.top = (r.y + r.h + 12) + 'px'; el.style.left = r.x + 'px'; el.style.width = r.w + 'px'; }
        const f = R.force || {};
        ftDef.innerHTML = f.d !== undefined ? 'Combat rating <b>+' + f.d + '</b>' : ''; ftAtt.innerHTML = f.a !== undefined ? 'Combat rating <b>+' + f.a + '</b>' : '';
        planShots();
      },
      music() { music('ground', { fade: 0.9 }); },
      update(dt, sp) {
        const k = sp === 0 ? 1e3 : sp, fx = H.fx; tl += dt * k; ph0 += dt * k;
        if (fx) { shake[0] = (rnd() - 0.5) * fx.shake * 0.55; shake[1] = (rnd() - 0.5) * fx.shake * 0.55; }
        if (closing >= 0) { if (tl - closing > 0.5 && !ended) { ended = true; endRun(run, { skipped: false }); } return; }
        switch (phase) {
          case 'intro': if (ph0 >= TIME.intro) go(TIME.approach > 0 ? 'approach' : hasFight ? 'land' : 'result'); break;
          case 'approach': updateApproach(); if (ph0 >= TIME.approach) go('land'); break;
          case 'land': dimA = clamp(ph0 / 0.9, 0, 1); panelA = clamp((ph0 - 0.3) / 0.8, 0, 1); landFlash = max(0, 1 - ph0 / 0.5); decayFlashes(dt * k); if (ph0 >= TIME.land) go(hasFight ? 'fight' : 'result'); break;
          case 'fight': updateFight(dt * k); break;
          case 'hold': decayFlashes(dt * k); if (ph0 >= TIME.hold) go('result'); break;
          default: decayFlashes(dt * k); break;
        }
        if (landFlash > 0 && phase !== 'land') landFlash = max(0, landFlash - dt * 2);
      },
      draw(ctx, w, hh) {
        const t = tl, fx = H.fx;
        ctx.save(); if (shake[0] || shake[1]) ctx.translate(shake[0], shake[1]);
        const Sc = gfx('Scenes'); let ok = false;
        if (Sc && Sc.surface) { try { Sc.surface.draw(ctx, w, hh, t, { look, seed, populated: true, color: DF.color }); ok = true; } catch (e) { warnOnce('surface', e); } }
        if (!ok) { const g = ctx.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#0a1030'); g.addColorStop(1, '#2a1a1a'); ctx.fillStyle = g; ctx.fillRect(-20, -20, w + 40, hh + 40); }
        if (dimA > 0) { ctx.fillStyle = 'rgba(2,4,14,' + 0.76 * dimA + ')'; ctx.fillRect(-20, -20, w + 40, hh + 40); }
        if (phase === 'approach' || phase === 'land' || phase === 'intro') drawApproach(ctx);
        if (panelA > 0) drawPanels(ctx);
        if (fx) fx.draw(ctx);
        if (landFlash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,230,180,' + 0.22 * landFlash + ')'; ctx.fillRect(-20, -20, w + 40, hh + 40); ctx.restore(); }
        ctx.restore();
        vignette(ctx, w, hh, 0.6);
        drawFade(ctx, w, hh, max(1 - tl / 0.7, closing >= 0 ? (tl - closing) / 0.45 : 0));
      },
      input(kind) {
        if (closing >= 0) return;
        if (kind === 'cancel') { if (phase === 'result') close(); else skipToResult(); return; }
        if (kind === 'space' || kind === 'click' || kind === 'enter' || kind === 'c') {
          if (phase === 'result') { if (kind !== 'click') close(); return; }
          if (kind === 'c') { skipToResult(); return; }
          if (phase === 'intro' || phase === 'approach' || phase === 'land') { skipToFight(); return; }
          if (phase === 'fight' || phase === 'hold') skipToResult();
        }
      },
      dispose() { ended = true; if (H.fx) H.fx.clear(); },
    };
    if (animSpeed() === 0) setTimeout(() => { if (!ended && !resultShown) { sc.layout(Host.w, Host.h); skipToResult(); } }, 0);
    return sc;
  };

  Ground.show = function (it) {
    it = it || {};
    if (it.type === 'bombard') return Ground.bombardResult(it);
    if (it.type === 'bombardPrompt' || it.type === 'bombPrompt') {
      const list = it.entries || (it.planet !== undefined ? [{ planet: it.planet, preview: it.preview }] : []);
      return list.reduce((p, e) => p.then(() => Ground.bombard(e.planet, { preview: e.preview })), Promise.resolve()).then(() => true);
    }
    const result = it.result || (it.attacker !== undefined && it.planet !== undefined ? it : null);
    if (!result || result.visible === false) return Promise.resolve({ skipped: true });
    return enqueue('ground', { result });
  };

  // ================================================================================================================================ 3. bombardment
  function bombBackdrop(ctx, w, hh, t, o) {
    const Sc = gfx('Scenes'); let info = null;
    if (Sc && Sc.battle) { try { info = Sc.battle.draw(ctx, w, hh, t, o); } catch (e) { warnOnce('battle', e); } }
    if (!info) {
      ctx.fillStyle = '#04061a'; ctx.fillRect(0, 0, w, hh);
      const r = hh * 0.62, x = w * 0.3, y = hh * 1.0, g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, '#6a8ab8'); g.addColorStop(1, '#101a3a');
      if (o.planet) { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      info = { planet: o.planet ? { x, y, r } : null };
    }
    return info;
  }
  function planetDesc(P, EI) { return { look: lookOf(P), seed: (P.id * 7919 + (P.gfx | 0)) | 0, inhabited: true, color: EI ? EI.color : undefined }; }
  // the bombing group hovering over the planet's limb; returns the ship positions
  function drawBombers(ctx, pl, n, race, color, t) {
    const Sh = gfx('Ships'), pts = []; if (!pl || n <= 0) return pts;
    const cnt = clamp(n, 1, 6);
    for (let i = 0; i < cnt; i++) {
      const a = -PI * (0.62 - 0.28 * (cnt === 1 ? 0.5 : i / (cnt - 1))) - 0.08, rr = pl.r * (1.2 + 0.05 * sin(t * 0.6 + i)), x = pl.x + cos(a) * rr + sin(t * 0.5 + i) * 4, y = pl.y + sin(a) * rr + cos(t * 0.7 + i * 2) * 3;
      pts.push({ x, y });
      if (Sh) { try { Sh.draw(ctx, { race, hull: 2, x, y, size: clamp(pl.r * 0.16, 26, 90), angle: atan2(pl.y - y, pl.x - x), color, t: t + i, thrust: 0.25, flags: { bomb: true } }); } catch (e) { warnOnce('ships', e); } }
    }
    return pts;
  }

  // ---- prompt ---------------------------------------------------------------------------------------------------------------------------------------------
  MAKERS.bombPrompt = function (H, d, run) {
    const S = G.S, P = S.planets[d.planet], pv = d.preview || {}, EI = empInfo(S.playerId), VI = empInfo(P.owner), pname = planetName(S, P), star = S.stars[P.starId] || {};
    let tl = 0, closing = -1, answer = false, ended = false;
    const ex = pv.expected || {}, can = pv.canBomb !== false;
    const row = (k, v, cls) => h('div' + (cls ? '.' + cls : ''), h('span', k), h('b', v));
    const rows = [row('Population', (pv.pop !== undefined ? pv.pop : P.pop | 0) + ' million' + (pv.inbound ? '  (' + pv.inbound + ' more landing)' : '')), row('Factories', pv.factories !== undefined ? pv.factories : P.factories | 0)];
    if ((pv.bases | 0) > 0) rows.push(row('Missile bases', pv.bases));
    if ((pv.shield | 0) > 0) rows.push(row('Planetary shield', 'Class ' + ({ 5: 'V', 10: 'X', 15: 'XV', 20: 'XX' }[pv.shield] || pv.shield)));
    if (pv.ships) rows.push(row('Bombarding fleet', pv.ships + ' ' + plural(pv.ships, 'warship') + (pv.comp ? ' · to-hit ' + pv.comp + '/20' : '')));
    const expLines = [];
    if (can) {
      if (pv.ineffective) expLines.push(h('div.ld-note.dim', 'Our weapons are unlikely to get through the planet’s defences — the bombardment would do almost no damage.'));
      else {
        expLines.push(row('Expected population loss', '≈ ' + round1(ex.popKilled) + ' million', 'warn'), row('Expected factories lost', '≈ ' + round1(ex.factoriesKilled), 'warn'));
        if ((ex.bioKilled || 0) > 0 || pv.bio) expLines.push(row('Biological attack', '≈ ' + round1(ex.bioKilled) + ' pop · max pop −' + round1(ex.maxPopLoss), 'bad'));
      }
    } else expLines.push(h('div.ld-note', pv.reason ? cap(String(pv.reason)) + '.' : 'Bombardment is not possible here.'));
    const bio = pv.bio ? h('div.ld-note.bio', 'Biological weapons ignore planetary shields, kill colonists and permanently shrink the planet’s capacity. Other empires will think less of you.') : null;
    const bombBtn = UI.button('Bomb', () => decide(true), { primary: true, kbd: 'B', disabled: !can }), cancelBtn = UI.button('Cancel', () => decide(false), { kbd: 'Esc' });
    const panel = panelBox('ld-bomb', h('div.ld-eyebrow', 'Orbital bombardment'), h('div.ld-title', 'Bombard ' + pname + '?'), h('div.ld-chips', h('span.chip', VI.plural), h('span.chip.warn', P.owner === S.playerId ? 'Our planet' : 'Enemy world')),
      h('div.ld-kv', rows), h('div.ld-kv', expLines), bio, h('div.ld-actions', cancelBtn, bombBtn));
    H.ui.appendChild(topBar(EI.race, EI.color, 'Bombardment')); H.ui.appendChild(panel);
    setHint(KEY('B', ' bomb') + KEY('Esc', ' cancel'));
    const bg = { starKind: star.color || 'yellow', seed: hashStr('bomb' + P.id), nebula: true };
    function decide(v) { if (closing >= 0) return; answer = !!v && can; closing = tl; sfx(v ? 'bomb' : 'cancel', { vol: 0.8 }); panel.style.transition = 'opacity .3s'; panel.style.opacity = '0'; panel.style.pointerEvents = 'none'; setHint(''); }
    return {
      phase: () => (closing >= 0 ? 'closing' : 'prompt'),
      music() { music('antarans', { fade: 1.0 }); },
      update(dt, sp) { tl += dt * (sp || 1); if (closing >= 0 && tl - closing > 0.4 && !ended) { ended = true; endRun(run, answer); } },
      draw(ctx, w, hh) {
        const info = bombBackdrop(ctx, w, hh, tl, Object.assign({ planet: { desc: planetDesc(P, VI), size: 1.08, x: 0.27, y: 1.0 } }, bg)), pl = info.planet;
        drawBombers(ctx, pl, pv.ships || 3, EI.race, EI.color, tl);
        if (pl) {                                                           // targeting reticle over the planet
          const rr = pl.r, cx = pl.x, cy = pl.y, a = tl * 0.35;
          ctx.save(); ctx.strokeStyle = 'rgba(255,92,106,.7)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -tl * 14;
          ctx.beginPath(); ctx.arc(cx, cy, rr * 1.02, PI * 1.04, PI * 1.96); ctx.stroke(); ctx.setLineDash([]);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,200,150,.9)';
          for (let k = 0; k < 4; k++) { const aa = a + k * PI / 2 - PI / 2; if (cy + sin(aa) * rr * 1.12 < cy + 4) { ctx.beginPath(); ctx.arc(cx, cy, rr * 1.12, aa - 0.06, aa + 0.06); ctx.stroke(); } }
          const ta = -PI * 0.55 + sin(tl * 0.9) * 0.4, sx = cx + cos(ta) * rr * 0.98, sy = cy + sin(ta) * rr * 0.98;
          ctx.strokeStyle = 'rgba(255,92,106,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, 18, 0, TAU);
          ctx.moveTo(sx - 28, sy); ctx.lineTo(sx - 10, sy); ctx.moveTo(sx + 10, sy); ctx.lineTo(sx + 28, sy); ctx.moveTo(sx, sy - 28); ctx.lineTo(sx, sy - 10); ctx.moveTo(sx, sy + 10); ctx.lineTo(sx, sy + 28); ctx.stroke();
          ctx.restore();
        }
        vignette(ctx, w, hh, 0.45);
        drawFade(ctx, w, hh, max(1 - tl / 0.6, closing >= 0 ? (tl - closing) / 0.35 : 0));
      },
      input(k) { if (k === 'b') decide(true); else if (k === 'cancel' || k === 'c' || k === 'n') decide(false); },
      dispose() { ended = true; },
    };
  };

  Ground.bombardPrompt = function (o) {
    o = o || {};
    const S = G && G.S; if (!S || !S.planets[o.planet]) return Promise.resolve(false);
    return enqueue('bombPrompt', { planet: o.planet, preview: o.preview || (M.Sim.Ground && M.Sim.Ground.bombPreview ? M.Sim.Ground.bombPreview(S, S.playerId, o.planet) : {}) });
  };
  Ground.bombard = function (planetId, o) {
    return Ground.bombardPrompt({ planet: planetId, preview: o && o.preview }).then(yes => {
      if (G && G.S) G.order({ t: 'bombard', planet: planetId, yes: !!yes });
      return !!yes;
    });
  };
  Ground.askPending = async function () {
    const S = G && G.S, SG = M.Sim.Ground; if (!S || !SG || !SG.pending) return 0;
    const list = SG.pending(S, S.playerId); let n = 0;
    for (const e of list) { await Ground.bombard(e.planet, { preview: e.preview }); n++; }
    return n;
  };

  // ---- result -----------------------------------------------------------------------------------------------------------------------------------------------
  MAKERS.bombResult = function (H, d, run) {
    const S = G.S, r = d.r, P = S.planets[r.planet] || { id: r.planet, type: 'terran', growth: 'normal', starId: r.planet }, AT = empInfo(r.empire, r.attackerRace), VI = empInfo(r.victim, r.victimRace);
    const pname = r.planetName || planetName(S, P), star = S.stars[P.starId] || {}, rnd = rng32(hashStr('bres' + r.planet + ':' + (r.damage | 0)));
    const popKilled = r.popKilled | 0, facKilled = r.factoriesKilled | 0, bioK = r.bioKilled | 0, destroyed = !!r.destroyed, ineffective = !!r.ineffective && !destroyed;
    const isBio = !!r.bio || bioK > 0, T = { start: 0.7, run: 3.4, text: 4.0 };
    const humanVictim = !!r.victimHuman, humanAtt = !!r.attackerHuman;
    let tl = 0, closing = -1, ended = false, shown = false, nextImpact = T.start, impacts = 0, planetGone = false, burn = 0, boomed = 0, flash = 0, beamClock = 0, panel = null, plLast = null, bombers = [];
    const bg = { starKind: star.color || 'yellow', seed: hashStr('bomb' + P.id), nebula: true };
    H.ui.appendChild(topBar(AT.race, AT.color, 'Bombardment'));
    setHint(KEY('Space', ' skip'));

    function reveal() {
      if (shown) return; shown = true;
      const lines = [], stat = (label, v, cls) => h('span.ld-stat' + (cls ? '.' + cls : ''), label, h('b', String(v)));
      const tone = destroyed ? 'bad' : ineffective ? 'neutral' : humanVictim ? 'bad' : 'good';
      const title = destroyed ? 'Planet destroyed' : ineffective ? 'Bombardment ineffective' : 'Bombardment';
      if (destroyed) lines.push(h('div.ld-rline', { html: '<b>' + pname + '</b> has been bombed into a lifeless cinder — all <b>' + (r.popBefore | 0) + '</b> million of its colonists are dead.' }));
      else if (ineffective) lines.push(h('div.ld-rline', { html: 'The ' + (humanAtt ? 'bombardment of ' : 'barrage on ') + '<b>' + pname + '</b> ' + ((r.shield | 0) > 0 ? 'barely scratched its planetary shield.' : 'did no lasting harm.') }));
      else lines.push(h('div.ld-rline', { html: humanVictim ? 'Enemy <b>' + AT.plural + '</b> warships rain destruction on <b>' + pname + '</b>.' : 'Our fleet pounds <b>' + pname + '</b> from orbit.' }));
      const chips = [];
      if (!ineffective) { chips.push(stat('Population killed', popKilled + ' million', 'bad')); chips.push(stat('Factories destroyed', facKilled, facKilled > 0 ? 'bad' : '')); }
      if (bioK > 0) lines.push(h('div.ld-note.bio', { html: 'Biological weapons killed <b>' + bioK + '</b> million colonists and shrank the planet’s maximum population by <b>' + (r.maxPopLost | 0) + '</b>.' }));
      if (!destroyed && !ineffective) chips.push(stat('Remaining', (r.popLeft | 0) + ' pop · ' + (r.factoriesLeft | 0) + ' fac', ''));
      if ((r.shield | 0) > 0 && !destroyed) lines.push(h('div.ld-rline.dim', 'The planetary shield absorbed ' + r.shield + ' damage from every hit.'));
      panel = panelBox('ld-result', h('div.ld-rtitle.' + tone, title), lines, chips.length ? h('div.ld-rchips', chips) : null, h('div.ld-actions', UI.button('Continue', () => close(), { primary: true, kbd: 'Space' })));
      H.ui.appendChild(panel); setHint(KEY('Space', ' continue'));
    }
    function close() { if (closing >= 0) return; closing = tl; setHint(''); if (panel) { panel.style.transition = 'opacity .3s'; panel.style.opacity = '0'; panel.style.animation = 'none'; } sfx('click'); }
    function jumpToEnd() { tl = max(tl, T.text); if (H.fx) H.fx.clear(); if (destroyed) planetGone = true; burn = 1; flash = 0; reveal(); }

    return {
      phase: () => (closing >= 0 ? 'closing' : shown ? 'result' : 'bombing'),
      music() { music(destroyed ? 'orion' : 'antarans', { fade: 0.8 }); },
      update(dt, sp) {
        tl += dt * (sp === 0 ? 1e3 : sp); flash = max(0, flash - dt * 2.4);
        const fx = H.fx;
        if (closing >= 0) { if (tl - closing > 0.4 && !ended) { ended = true; endRun(run, true); } return; }
        if (sp === 0 && !shown) { jumpToEnd(); return; }
        const pl = plLast; if (!pl || shown) return;
        if (tl >= 0.3 && !boomed) { boomed = 1; sfx('bomb', { vol: 0.9 }); }
        if (tl > T.start && tl < T.run) {
          beamClock -= dt;
          if (fx && beamClock <= 0 && bombers.length) {
            beamClock = 0.16 + rnd() * 0.18; const b = bombers[(rnd() * bombers.length) | 0], a = rnd() * PI + PI, rr = pl.r * rnd() * 0.85;
            fx.beam(b.x, b.y, pl.x + cos(a) * rr * 0.8, pl.y + sin(a) * rr * 0.55 - pl.r * 0.25, isBio ? 'neutron' : 'mass', 0.35, { scale: 0.8 });
          }
          if (fx && tl >= nextImpact) {
            nextImpact += 0.42 + rnd() * 0.25; impacts++;
            const a = -PI * (0.1 + 0.8 * rnd()), rr = pl.r * (0.2 + 0.7 * rnd());
            fx.explosion(pl.x + cos(a) * rr, pl.y + sin(a) * rr * 0.8 - pl.r * 0.1, clamp(pl.r * 0.2, 26, 90), { kind: isBio ? 'plasma' : 'fire' });
            if (impacts % 2 === 0) fx.planetImpact(pl.x, pl.y, pl.r);
            if (impacts === 2) sfx('planet_hit', { vol: 0.8 });
            burn = min(1, burn + 0.12);
          }
        }
        if (destroyed && tl >= T.run - 0.5 && !planetGone) { planetGone = true; if (fx) fx.novaBlast(pl.x, pl.y, pl.r * 0.5); flash = 1; sfx('planet_destroyed', { vol: 0.9 }); }
        else if (!destroyed && tl >= T.run - 0.7 && boomed === 1) { boomed = 2; sfx('explosion_big', { vol: 0.8 }); }
        if (tl >= T.text) reveal();
      },
      draw(ctx, w, hh) {
        const fx = H.fx, info = bombBackdrop(ctx, w, hh, tl, Object.assign({ planet: planetGone ? null : { desc: planetDesc(P, VI), size: 1.08, x: 0.27, y: 1.0 } }, bg));
        const pl = info.planet || plLast; plLast = pl;
        bombers = drawBombers(ctx, pl, r.ships || 3, AT.race, AT.color, tl);
        if (pl && !planetGone && burn > 0) {                                    // scorched, glowing planet
          ctx.save(); ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r, 0, TAU); ctx.clip();
          const g = ctx.createRadialGradient(pl.x, pl.y - pl.r * 0.2, pl.r * 0.1, pl.x, pl.y, pl.r);
          g.addColorStop(0, isBio ? 'rgba(120,255,90,' + 0.28 * burn + ')' : 'rgba(255,120,40,' + 0.34 * burn + ')'); g.addColorStop(0.7, isBio ? 'rgba(40,160,60,' + 0.22 * burn + ')' : 'rgba(120,30,10,' + 0.3 * burn + ')'); g.addColorStop(1, 'rgba(10,0,0,' + 0.4 * burn + ')');
          ctx.fillStyle = g; ctx.fillRect(pl.x - pl.r, pl.y - pl.r, pl.r * 2, pl.r * 2); ctx.restore();
        }
        if (fx) { const s = fx.shake; ctx.save(); if (s) ctx.translate((rnd() - 0.5) * s * 0.5, (rnd() - 0.5) * s * 0.5); fx.draw(ctx); ctx.restore(); }
        const fl = max(flash, fx ? min(0.4, fx.flash * 0.5) : 0);
        if (fl > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,236,200,' + fl * 0.55 + ')'; ctx.fillRect(0, 0, w, hh); ctx.restore(); }
        vignette(ctx, w, hh, 0.45);
        drawFade(ctx, w, hh, max(1 - tl / 0.6, closing >= 0 ? (tl - closing) / 0.35 : 0));
      },
      input(k) {
        if (closing >= 0) return;
        if (!shown) { if (k === 'space' || k === 'click' || k === 'enter' || k === 'cancel' || k === 'c') jumpToEnd(); return; }
        if (k === 'space' || k === 'enter' || k === 'c' || k === 'cancel') close();
      },
      dispose() { ended = true; if (H.fx) H.fx.clear(); },
    };
  };

  Ground.bombardResult = function (r) {
    r = r || {};
    const S = G && G.S; if (!S || r.visible === false) return Promise.resolve(null);
    return enqueue('bombResult', { r });
  };

  // ================================================================================================================================ demos (dev / QA)
  function demoSetup() {
    const S = G && G.S; if (!S) return null;
    const me = S.playerId, enemy = S.planets.find(p => p.owner >= 0 && p.owner !== me && p.pop > 0), free = S.planets.find(p => p.owner < 0 && p.typeIdx > 0), mine = S.planets.find(p => p.owner === me);
    return { S, me, enemy, free, mine };
  }
  function fakeGround(S, me, enemy, kind) {
    const SG = M.Sim.Ground, R = M.RNG && M.RNG.create ? M.RNG.create('demo-' + kind + S.turn) : null, lost = kind === 'invadeLost';
    const defId = enemy ? enemy.owner : (me + 1) % S.empires.length, P = enemy || S.planets[0];
    if (enemy && SG && SG.resolve && R) {
      const rec = SG.resolve(S, { empire: me, target: defId, planet: P.id, n: lost ? 12 : 60 }, R);
      if (rec) { rec.visible = true; return rec; }
    }
    const nA = lost ? 14 : 38, nD = lost ? 30 : 26, fa = 30, fd = 35;
    const f = SG && SG.fight && R ? SG.fight(nA, nD, fa, fd, R) : { a: lost ? 0 : 11, d: lost ? 9 : 0, rounds: [{ a: nA, d: nD }, { a: nA - 3, d: nD - 6 }, { a: lost ? 0 : 11, d: lost ? 9 : 0 }] };
    const win = f.d === 0;
    return { attacker: me, defender: defId, planet: P.id, star: P.starId, planetName: planetName(S, P), attackerRace: S.empires[me].race, defenderRace: S.empires[defId].race, attackerHuman: true, defenderHuman: false, visible: true, rebellion: false,
      sent: nA + 6, killed: 8, recovered: 2, arrived: nA, landed: nA, overflow: 0, defenders: nD, defendersLeft: f.d, force: { a: fa, d: fd }, rounds: f.rounds, exchanges: 0, survivors: f.a,
      captured: { factories: win ? 24 : 0, techs: win ? [{ field: 5, level: 11, id: 'we-11', name: 'Fusion Rifle' }, { field: 3, level: 6, id: 'pl-06', name: 'Controlled Tundra Environment' }] : [] }, theftRolls: win ? 2 : 0, success: win, eliminated: false,
      gauntlet: { hp: 15, speed: 1, level: 8, comp: 3, bases: 3, monster: '', damage: 0, shooters: [] } };
  }
  Landing.demo = function (kind) {
    const D = demoSetup(); if (!D) return Promise.resolve(null);
    kind = kind || 'colony';
    if (kind === 'colony') { const p = D.free || D.mine || D.S.planets[0]; return enqueue('colony', { planet: p, emp: empInfo(D.me), opts: null }); }
    if (kind === 'invade' || kind === 'invadeLost') return Ground.show({ type: 'ground', result: fakeGround(D.S, D.me, D.enemy, kind) });
    const p = D.enemy || D.mine || D.S.planets[0], pid = p.id, vic = p.owner >= 0 ? p.owner : D.me;
    const fake = { type: 'bombard', empire: D.me, victim: vic, planet: pid, star: p.starId, planetName: planetName(D.S, p), attackerRace: D.S.empires[D.me].race, victimRace: D.S.empires[vic].race,
      attackerHuman: true, victimHuman: false, visible: true, bio: kind === 'bombBio', bombs: true, ships: 5, popBefore: 42, factoriesBefore: 36, damage: 900, popKilled: kind === 'bombDestroy' ? 42 : 11, factoriesKilled: kind === 'bombDestroy' ? 36 : 9,
      bioKilled: kind === 'bombBio' ? 6 : 0, maxPopLost: kind === 'bombBio' ? 6 : 0, popLeft: kind === 'bombDestroy' ? 0 : 31, factoriesLeft: kind === 'bombDestroy' ? 0 : 27, shield: 5, comp: 12, destroyed: kind === 'bombDestroy', ineffective: false };
    if (kind === 'bomb') return Ground.bombardPrompt({ planet: pid, preview: { planet: pid, pop: (p.pop | 0) || 42, factories: (p.factories | 0) || 36, bases: 3, shield: 10, inbound: 8, canBomb: true, bio: false, ships: 5, comp: 12, expected: { popKilled: 6.4, factoriesKilled: 8.1, bioKilled: 0, maxPopLoss: 0 }, ineffective: false } });
    return Ground.bombardResult(fake);
  };
  Ground.demo = Landing.demo;

  // ================================================================================================================================ 4. event presentations ({type:'event'} interrupts of Sim.Events → flow.js H.event)
  const EVENT_ICON = { plague: 'plague', quake: 'warning', nova: 'nova', accident: 'warning', assassin: 'war', virus: 'warning', comet: 'nova', pirates: 'pirate', derelict: 'artifact', rebellion: 'rebel', crystal: 'monster', amoeba: 'monster', enviro: 'planet', rich: 'minerals', support: 'money', poor: 'minerals' };
  const EVENT_TITLE = { plague: 'Plague', quake: 'Earthquake', nova: 'Supernova', accident: 'Industrial accident', assassin: 'Assassination', virus: 'Computer virus', comet: 'Comet', pirates: 'Space pirates', derelict: 'Ancient derelict', rebellion: 'Rebellion', crystal: 'Space crystal', amoeba: 'Space amoeba', enviro: 'Fertile soil', rich: 'Rich minerals', support: 'Donation', poor: 'Depleted minerals' };
  const BAD_EVENTS = { plague: 1, quake: 1, nova: 1, accident: 1, assassin: 1, virus: 1, comet: 1, pirates: 1, rebellion: 1, crystal: 1, amoeba: 1, poor: 1 };
  UI.Events = {
    // a notice card for one event; plague / supernova cards offer to pay toward the cure from the reserve (order eventCure)
    show(it) {
      const S = G && G.S; if (!S || !it) return Promise.resolve(null);
      const p = it.planet >= 0 && S.planets[it.planet] ? S.planets[it.planet] : null, ended = it.stage === 'end' || it.stage === 'averted' || it.stage === 'destroyed';
      const bad = !!BAD_EVENTS[it.kind] && !ended, buttons = [{ label: 'Continue', value: true, primary: true }];
      if (p && p.event && (it.kind === 'plague' || it.kind === 'nova') && p.owner === S.playerId && (G.player().bc | 0) > 0) buttons.unshift({ label: 'Pay toward the cure', value: 'cure' });
      sfx(bad ? 'alert' : 'confirm', { vol: 0.7 });
      return UI.modal({ title: (EVENT_TITLE[it.kind] || 'Event') + (p ? ' — ' + planetName(S, p) : ''), cls: 'ld-event', width: '30rem', buttons,
        body: h('div', { style: { display: 'flex', gap: '.8rem', alignItems: 'flex-start' } }, h('div', { style: { color: bad ? 'var(--rose)' : 'var(--leaf)', width: '2.6rem', height: '2.6rem', flex: 'none' } }, UI.icon(EVENT_ICON[it.kind] || 'event')), h('p', { style: { lineHeight: 1.45, margin: 0 } }, it.text || '')) })
        .then(v => { if (v === 'cure' && p) G.order({ t: 'eventCure', planet: p.id }); return v; });
    },
  };
})(window.MOO);
