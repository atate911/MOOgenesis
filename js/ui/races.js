// Races / Report / Status screens (research/06 §5.14–§5.16): the diplomacy overview, the intelligence report on one empire, and the Racial Stats bars.
//   UI.Screens.go('races',  {from})                       up to five rival slots: portrait, name plate, treaty + trade, relations bar (17-step ladder), spy network + mode, overall security.
//                                                           Status (S) · Report (R, then a portrait / 1-5) · Audience (A, then a portrait / 1-5) · OK (O / Space / Esc / right-click)
//   UI.Screens.go('report', {empire, from, fromParams})   personality + objective, report age, Alliances / Wars, the techs known per field (those you lack are highlighted)
//   UI.Screens.go('status', {from, fromParams})           "Racial Stats": six bar groups, animated bars, hover values, history sparklines
//   Orders used: spyBudget {target,value} · spyMode {target,mode} · security {value}.   Reads Diplo.status / Spy.reports / Sim.powerBars / Q.status — never mutates S.
//   Shared with js/ui/audience.js:  MOO.UI.Races = {BANNER, TREATY, LADDER, PERS, OBJ, pair(S,a,b), labelIdx, inkOn, makePic, …}
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;
  const clamp = U.clamp;

  // ================================================================ vocabulary (ours, written fresh)
  const BANNER = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];          // = --emp0..5
  const PERS = ['Xenophobic', 'Ruthless', 'Aggressive', 'Erratic', 'Honorable', 'Pacifistic'];
  const OBJ = ['Diplomat', 'Militarist', 'Expansionist', 'Technologist', 'Industrialist', 'Ecologist'];
  const TREATY = ['No treaty', 'Non-aggression pact', 'Alliance', 'War', 'Final war'];
  const LADDER = ['Feud', 'Hate', 'Discord', 'Troubled', 'Tense', 'Restless', 'Wary', 'Unease', 'Neutral', 'Relaxed', 'Amiable', 'Calm', 'Affable', 'Peaceful', 'Friendly', 'Unity', 'Harmony'];
  const FIELD = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];
  const FIELD_ICON = ['computers', 'construction', 'forcefield', 'planetology', 'propulsion', 'weapons'];
  const PERS_TIP = [
    'Distrusts everyone who is not of its own kind: drives the hardest bargains, takes offence quickly and warms up slowly.',
    'Cold and calculating: a hard bargainer that never sweetens its own offers.',
    'Warlike and impatient: reluctant to sign treaties and quick to reach for the sword.',
    'Unpredictable: may declare war without any warning.',
    'Values its word: easier to deal with, but takes every offence, and every broken pact, to heart.',
    'Peace-loving: the easiest leader to strike a bargain with.',
  ];
  const OBJ_TIP = [
    'Courts friends and treaties.',
    'Measures its neighbours against its own fleets and looks for fights it can win.',
    'Hungry for new worlds, and more willing to break a pact to get them.',
    'Pours its resources into research.',
    'Maximises factories and production.',
    'Cleans, terraforms and grows its worlds.',
  ];
  const MODE_NAME = ['Hide', 'Espionage', 'Sabotage'];                                         // E.spyMode values (the screen lists Hide / Sabotage / Espionage)
  const MODE_TIP = [
    'Your spies lie low. There is a small risk that they are found, but they run no missions.',
    'Your spies try to steal a technology from this empire.',
    'Your spies try to destroy factories or missile bases, or to incite a revolt.',
  ];

  const lumin = hex => { const c = U.hexToRgb(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
  const inkOn = hex => (lumin(hex) > 0.5 ? '#0a0e24' : '#f6f0dc');
  const bannerOf = E => BANNER[(E && E.color | 0) % 6];
  const labelIdx = dp => clamp(Math.trunc(dp / 12) + 8, 0, 16);
  const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const plural = (n, a, b) => (n === 1 ? a : b || a + 's');

  function treatyIdx(t) {
    if (typeof t === 'number') return clamp(t | 0, 0, 4);
    const s = String(t === undefined || t === null ? '' : t).toLowerCase().replace(/[^a-z]/g, '');
    if (s === 'nap' || s === 'nonaggressionpact' || s === 'pact') return 1;
    if (s === 'alliance' || s === 'allied') return 2;
    if (s === 'war') return 3;
    if (s === 'finalwar' || s === 'final') return 4;
    return 0;
  }

  // ---- one view-model for a human↔empire pair: the Diplo engine when it exists, E.relations (written by Setup) otherwise ----
  function pair(S, a, b) {
    const A = S.empires[a], B = S.empires[b], D = M.Sim.Diplo;
    let st = null;
    if (D && typeof D.status === 'function') { try { st = D.status(S, a, b) || null; } catch (e) { st = null; } }
    const rel = (A && A.relations && A.relations[b]) || {};
    const dp = st && typeof st.attitude === 'number' ? st.attitude : (rel.attitude | 0);
    const treaty = treatyIdx(st && st.treaty !== undefined ? st.treaty : rel.treaty);
    const contact = st && st.contact !== undefined ? !!st.contact : !!rel.contact;
    let tr = { bc: rel.trade | 0, percent: 0 };
    if (st && st.trade !== undefined && st.trade !== null) tr = typeof st.trade === 'object' ? st.trade : { bc: st.trade | 0, percent: st.tradePercent | 0 };
    let li = labelIdx(dp);
    if (st && typeof st.label === 'string') { const k = LADDER.findIndex(x => x.toLowerCase() === st.label.toLowerCase()); if (k >= 0) li = k; }
    return {
      a, b, contact, alive: !!(B && B.alive), treaty, treatyName: TREATY[treaty], trade: { bc: tr.bc | 0, percent: tr.percent | 0 },
      attitude: clamp(dp, -100, 100), labelIdx: li, label: LADDER[li], trust: (st && st.trust) | 0, ceasefire: (st && st.ceasefire) | 0,
      canAudience: st && st.canAudience !== undefined ? !!st.canAudience : !!(contact && B && B.alive), met: !!(st && st.met),
    };
  }
  const moodOf = pv => (pv.treaty >= 3 || pv.attitude <= -36 ? 'angry' : pv.attitude >= 36 ? 'pleased' : 'neutral');
  const rivals = S => S.empires.filter(e => e.id !== S.playerId);
  const raceMod = E => { const r = M.Data && M.Data.Races && M.Data.Races.races[E.race]; return (r && r.mod) || {}; };

  // empires you have met (kept for the "gone" overlay: a destroyed empire no longer has contact)
  let metKey = '', met = {};
  function noteMet(S) {
    const key = S ? String(S.seed) : '';
    if (key !== metKey) { metKey = key; met = {}; hist = { key, rows: [] }; }
    if (!S) return;
    for (const E of rivals(S)) if (pair(S, S.playerId, E.id).contact) met[E.id] = true;
  }
  const isMet = (S, j) => { noteMet(S); return !!met[j]; };

  // ---- animated portraits (one canvas each; redrawn ~20x per second while their screen is active) ----------------------------------------------
  let picSeq = 0;
  const pics = new Set();
  function makePic(o) {
    o = o || {};
    const cv = h('canvas');
    const p = { cv, ctx: null, w: 0, h: 0, race: o.race || '', color: o.color || '', mood: o.mood || 'neutral', talking: false, key: 'rx' + (++picSeq), dim: !!o.dim };
    p.fit = () => { if (!cv.isConnected) return; const f = UI.fitCanvas(cv, { maxDpr: M.Perf ? M.Perf.dpr() : 2 }); p.ctx = f.ctx; p.w = f.w; p.h = f.h; };
    p.draw = t => {
      if (!p.ctx || !p.w || !p.race || !cv.isConnected) return;
      const P = M.Gfx && M.Gfx.Portraits;
      try { if (!P || !P.draw) throw new Error('no portraits'); P.draw(p.ctx, p.race, 0, 0, p.w, p.h, { t, mood: p.mood, color: p.color || undefined, key: p.key, talking: p.talking }); }
      catch (e) { const g = p.ctx; g.fillStyle = '#0d153a'; g.fillRect(0, 0, p.w, p.h); g.fillStyle = p.color || '#d6b36a'; g.font = '700 ' + Math.round(p.h * 0.35) + 'px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((p.race || '?').charAt(0).toUpperCase(), p.w / 2, p.h / 2); }
    };
    pics.add(p);
    return p;
  }
  const picPace = {};
  function drawPics(dt, t, root) {
    const fps = Math.max(10, Math.min(30, (M.Perf && M.Perf.q ? M.Perf.q.animFps : 60) / 3));
    if (!UI.pace(picPace, fps, dt)) return;
    for (const p of pics) if (p.cv.isConnected && root.contains(p.cv)) p.draw(t);
  }
  function fitPics(root) { for (const p of pics) { if (p.cv.isConnected && root.contains(p.cv)) { p.fit(); p.draw(performance.now() / 1000); } else if (!p.cv.isConnected) pics.delete(p); } }

  // ================================================================ styles
  UI.css('races', `
    .rx { position:absolute; inset:0; display:flex; padding:1rem 1.3rem; overflow:hidden;
      background: radial-gradient(110% 80% at 10% 0%, #1a2672 0%, rgba(26,38,114,0) 58%), radial-gradient(90% 70% at 100% 100%, #2c1a5c 0%, rgba(44,26,92,0) 62%), var(--void); }
    .rx::before { content:""; position:absolute; inset:0; pointer-events:none; opacity:.8;
      background: repeating-radial-gradient(circle at 82% 118%, rgba(214,179,106,.075) 0 1px, transparent 1px 3.6rem), repeating-radial-gradient(circle at 6% -14%, rgba(98,216,255,.05) 0 1px, transparent 1px 4.4rem); }
    .rx-sheet { position:relative; flex:1 1 auto; min-width:0; max-width:112rem; margin:0 auto; display:flex; flex-direction:column; min-height:0; padding:.8rem 1rem .9rem; }
    .rx-head { display:flex; align-items:flex-end; gap:1rem; padding-bottom:.55rem; margin-bottom:.65rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .rx-title { font:400 2.1rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; text-shadow:0 0 22px rgba(214,179,106,.28); }
    .rx-sub { padding-bottom:.18rem; color:var(--mist); font-size:.98rem; } .rx-sub b { color:var(--ivory); font-weight:600; font-variant-numeric:tabular-nums; }
    .rx-chips { margin-left:auto; display:flex; gap:.4rem; flex-wrap:wrap; justify-content:flex-end; padding-bottom:.15rem; }
    .rx-foot { display:flex; align-items:center; gap:.6rem; margin-top:.7rem; }
    .rx-foot .rx-prompt { flex:1 1 auto; min-width:0; color:var(--mist); font-size:1rem; }
    .rx-foot .rx-prompt b { color:var(--brass-hi); font-weight:600; }
    .rx-foot .rx-prompt.hot { color:var(--brass-hi); animation:rx-pulse 1.4s ease-in-out infinite; }
    @keyframes rx-pulse { 50% { color:#fff; text-shadow:0 0 14px rgba(243,220,160,.7); } }
    .rx-plate { display:inline-block; --ch:.3rem; padding:.1em .8em .14em; font:400 1.2rem/1.15 var(--font-display); letter-spacing:.06em; white-space:nowrap; background:var(--c, var(--brass)); color:var(--ink, #0a0e24); clip-path:var(--poly); }
    .rx-dot { display:inline-block; flex:none; width:.7em; height:.7em; transform:rotate(45deg); background:var(--c, var(--brass)); box-shadow:0 0 6px var(--c, var(--brass)); }
    .rx-box { --ch:.5rem; position:relative; isolation:isolate; padding:.5rem .75rem .6rem; background:linear-gradient(135deg, var(--brass-lo), #2a3260 40%, #2a3260 60%, var(--brass-lo)); }
    .rx-box::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(16,23,62,.95), rgba(7,11,30,.96)); }
    .rx-bt { display:flex; align-items:center; gap:.45rem; margin-bottom:.35rem; padding-bottom:.25rem; border-bottom:1px solid rgba(214,179,106,.28); font:400 1.02rem var(--font-display); letter-spacing:.06em; color:var(--brass); text-transform:uppercase; }
    .rx-bt .ico { width:1.05em; height:1.05em; color:var(--brass-hi); } .rx-bt .r { margin-left:auto; text-transform:none; letter-spacing:0; font:400 .82rem var(--font-ui); color:var(--mist); }

    /* ---------------------------------------------------- Races */
    .rc-grid { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); grid-template-rows:repeat(3, minmax(0,1fr)); grid-auto-flow:column; gap:.7rem; }
    .rc-cell { position:relative; min-width:0; min-height:0; }
    .rc-slot { --ch:.6rem; --c:var(--brass); --e1:var(--brass-lo); --e2:#2a3260; position:absolute; inset:0; isolation:isolate; display:flex; gap:.8rem; padding:.55rem .8rem .55rem .7rem;
      background:linear-gradient(135deg, var(--e1), var(--e2) 40%, var(--e2) 60%, var(--e1)); transition:filter .2s; }
    .rc-slot::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(19,28,70,.96), rgba(7,11,30,.97)); }
    .rc-slot .rc-acc { position:absolute; left:0; top:0; bottom:0; width:.3rem; background:var(--c); box-shadow:0 0 16px color-mix(in srgb, var(--c) 70%, transparent); }
    .rc-slot[data-t="1"] { --e1:var(--cyan); --e2:#1d3f63; } .rc-slot[data-t="2"] { --e1:var(--leaf); --e2:#1f4a3a; }
    .rc-slot[data-t="3"], .rc-slot[data-t="4"] { --e1:var(--rose); --e2:#5a2436; }
    .rc-slot[data-t="4"] { animation:rc-war 1.6s ease-in-out infinite; } @keyframes rc-war { 50% { filter:brightness(1.25) saturate(1.2); } }
    .rc-slot.sel { filter:brightness(1.12); } .rc-slot.sel::after { content:""; position:absolute; inset:3px; pointer-events:none; border:1px solid var(--brass-hi); clip-path:var(--poly); opacity:.7; }
    .rc-slot.pickable .rc-pic { animation:rc-pick 1.4s ease-in-out infinite; }
    @keyframes rc-pick { 0%, 100% { box-shadow:0 0 0 2px rgba(243,220,160,.55); } 50% { box-shadow:0 0 0 2px rgba(243,220,160,.95), 0 0 .9rem rgba(243,220,160,.55); } }
    @media (prefers-reduced-motion: reduce) { .rc-slot.pickable .rc-pic { animation:none; box-shadow:0 0 0 2px rgba(243,220,160,.85); } }
    .rc-pic { --ch:.4rem; position:relative; flex:none; height:100%; aspect-ratio:4 / 5; cursor:var(--hand); background:linear-gradient(135deg, var(--brass-hi), var(--c) 30%, #12183e 60%, var(--c)); }
    .rc-pic canvas { position:absolute; left:3px; top:3px; width:calc(100% - 6px); height:calc(100% - 6px); background:#050818; }
    .rc-pic .rc-key { position:absolute; left:.2rem; top:.15rem; z-index:2; min-width:1.15rem; padding:0 .3rem; text-align:center; font:700 .8rem/1.3rem var(--font-ui); color:var(--brass-hi); background:rgba(5,8,24,.78); border:1px solid rgba(214,179,106,.5); }
    .rc-main { flex:1 1 0; min-width:0; display:flex; flex-direction:column; justify-content:space-between; gap:.2rem; }
    .rc-top { display:flex; align-items:center; gap:.6rem; min-width:0; }
    .rc-leader { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--mist); font-size:.92rem; }
    .rc-tt { display:flex; justify-content:space-between; align-items:baseline; gap:.6rem; }
    .rc-treaty { font:400 1.06rem/1.2 var(--font-display); letter-spacing:.04em; color:var(--mist); } .rc-treaty.t1 { color:var(--cyan); } .rc-treaty.t2 { color:var(--leaf); } .rc-treaty.t3, .rc-treaty.t4 { color:var(--rose); }
    .rc-trade { font-size:.95rem; color:var(--fog); font-variant-numeric:tabular-nums; } .rc-trade.on { color:var(--gold); }
    .rc-rel { display:grid; grid-template-columns:minmax(0,1fr) 6.4rem; gap:.65rem; align-items:center; }
    .rc-bar { position:relative; height:.72rem; background:linear-gradient(90deg, #ff4a5c 0%, #ff8a48 27%, #e6d56a 50%, #82e28a 73%, #38e0a4 100%); box-shadow:inset 0 0 0 1px rgba(0,0,0,.55), 0 0 0 1px rgba(214,179,106,.4); }
    .rc-bar::after { content:""; position:absolute; inset:0; pointer-events:none; background:repeating-linear-gradient(90deg, transparent 0 calc(100% / 17 - 1px), rgba(0,0,0,.3) calc(100% / 17 - 1px) calc(100% / 17)); }
    .rc-bar::before { content:""; position:absolute; left:50%; top:-.18rem; bottom:-.18rem; width:1px; background:rgba(255,255,255,.55); z-index:1; }
    .rc-ptr { position:absolute; z-index:2; top:-.36rem; bottom:-.36rem; width:.62rem; margin-left:-.31rem; transition:left .45s var(--ease); filter:drop-shadow(0 1px 2px #000);
      background:var(--brass-hi); clip-path:polygon(50% 0, 100% 24%, 62% 24%, 62% 76%, 100% 76%, 50% 100%, 0 76%, 38% 76%, 38% 24%, 0 24%); }
    .rc-lab { font:400 1.04rem/1.1 var(--font-display); letter-spacing:.07em; text-transform:uppercase; text-align:right; color:var(--ivory); white-space:nowrap; } .rc-lab.pos { color:var(--leaf); } .rc-lab.neg { color:var(--rose); } .rc-lab.mid { color:#e6d56a; }
    .rc-spy { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.15rem .7rem; align-items:center; }
    .rc-spy .slider { --c:var(--violet); grid-template-columns:1.4rem minmax(3rem,1fr) 1.4rem 3.2rem; margin:0; }
    .rc-spy .slider .s-label, .rc-spy .slider .s-lock { display:none; } .rc-spy .slider .s-val { font-size:.92rem; }
    .rc-spy .rd { display:flex; flex-direction:column; align-items:flex-end; line-height:1.15; font-size:.88rem; color:var(--mist); white-space:nowrap; } .rc-spy .rd b { color:var(--ivory); font-weight:600; } .rc-spy .rd .nx { color:var(--fog); }
    .rc-modes { display:flex; gap:.35rem; align-items:center; } .rc-modes .lbl { color:var(--fog); font-size:.82rem; margin-right:.1rem; text-transform:uppercase; letter-spacing:.08em; }
    .rc-modes .btn { padding:.18em .75em; font-size:.88rem; }
    .rc-void { position:absolute; inset:0; isolation:isolate; --ch:.6rem; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.3rem; text-align:center; color:var(--fog);
      background:linear-gradient(135deg, rgba(93,106,150,.5), rgba(42,50,96,.4) 50%, rgba(93,106,150,.5)); isolation:isolate; }
    .rc-void::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:repeating-linear-gradient(135deg, rgba(255,255,255,.022) 0 .5rem, transparent .5rem 1rem), rgba(5,8,24,.72); }
    .rc-void .big { font:400 1.5rem var(--font-display); letter-spacing:.14em; text-transform:uppercase; } .rc-void .sm { font-size:.9rem; color:var(--fog); opacity:.85; } .rc-void .ico { width:2rem; height:2rem; opacity:.55; }
    .rc-void .hw { position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); opacity:.35; filter:saturate(.7) brightness(.8); pointer-events:none; } .rc-void .hw :is(canvas, img) { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .rc-void .hw::after { content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 50%, rgba(5,8,24,.1), rgba(5,8,24,.75) 100%); }
    .rc-void.gone .big { color:var(--rose); } .rc-void .gpic { position:absolute; left:.8rem; top:.7rem; bottom:.7rem; aspect-ratio:4 / 5; opacity:.55; filter:grayscale(1) brightness(.7); } .rc-void .gpic canvas { position:absolute; inset:0; width:100%; height:100%; }
    .rc-sec { position:absolute; inset:0; --ch:.6rem; display:flex; flex-direction:column; justify-content:space-between; padding:.6rem .85rem .65rem; isolation:isolate; background:linear-gradient(135deg, var(--brass-lo), #2a3260 40%, #2a3260 60%, var(--brass-lo)); }
    .rc-sec::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(19,28,70,.96), rgba(7,11,30,.97)); }
    .rc-sec .rx-bt { margin-bottom:.3rem; } .rc-sec .rd { display:flex; align-items:baseline; gap:.7rem; }
    .rc-sec .big { font:400 2.1rem/1 var(--font-title); color:var(--azure); letter-spacing:.02em; text-shadow:0 0 18px rgba(91,140,255,.35); font-variant-numeric:tabular-nums; }
    .rc-sec .slider { --c:var(--azure); grid-template-columns:1.5rem minmax(3rem,1fr) 1.5rem; margin:.2rem 0; } .rc-sec .slider .s-label, .rc-sec .slider .s-lock, .rc-sec .slider .s-val { display:none; }
    .rc-sec .hint { color:var(--mist); font-size:.88rem; line-height:1.3; } .rc-sec .alloc { font-size:.98rem; color:var(--ivory); } .rc-sec .alloc b { color:var(--violet); font-weight:600; font-variant-numeric:tabular-nums; }

    /* ---------------------------------------------------- Report */
    .rp-body { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(15rem, 20rem) minmax(0,1fr); gap:1.1rem; }
    .rp-left { min-height:0; display:flex; flex-direction:column; gap:.55rem; overflow:auto; padding-right:.2rem; }
    .rp-pic { --ch:.6rem; position:relative; flex:none; height:38%; max-width:100%; aspect-ratio:4 / 5; align-self:center; background:linear-gradient(135deg, var(--brass-hi), var(--c) 30%, #12183e 60%, var(--c)); }
    .rp-pic canvas { position:absolute; left:4px; top:4px; width:calc(100% - 8px); height:calc(100% - 8px); background:#050818; }
    .rp-left .rx-plate { align-self:stretch; text-align:center; font-size:1.5rem; padding:.18em .5em .2em; }
    .rp-traits { display:flex; flex-direction:column; gap:.05rem; align-items:center; text-align:center; }
    .rp-traits .p { font:400 1.5rem/1.1 var(--font-title); color:var(--brass-hi); letter-spacing:.03em; cursor:help; } .rp-traits .o { font:400 1.2rem/1.2 var(--font-display); color:var(--ivory); letter-spacing:.06em; text-transform:uppercase; cursor:help; }
    .rp-age { display:flex; align-items:baseline; justify-content:center; gap:.5rem; padding:.3rem .5rem; background:rgba(0,0,0,.3); border-top:1px solid rgba(214,179,106,.28); border-bottom:1px solid rgba(214,179,106,.28); font-size:.95rem; color:var(--mist); }
    .rp-age b { font:400 1.15rem var(--font-display); color:var(--brass-hi); letter-spacing:.05em; text-transform:uppercase; } .rp-age .n { color:var(--ivory); font-weight:600; } .rp-age.none .n { color:var(--rose); }
    .rp-list { display:flex; flex-direction:column; gap:.2rem; min-height:1.4rem; } .rp-list .it { display:flex; align-items:center; gap:.5rem; font-size:1rem; } .rp-list .none { color:var(--fog); font-size:.95rem; }
    .rp-left .rx-box { padding:.4rem .7rem .5rem; }
    .rp-techs { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); grid-template-rows:repeat(2, minmax(0,1fr)); gap:.65rem; }
    .rp-tb { min-height:0; display:flex; flex-direction:column; }
    .rp-tb .rp-tl { min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:.1rem; padding-right:.2rem; }
    .rp-t { display:flex; align-items:baseline; gap:.45rem; padding:.08rem .35rem; font-size:.95rem; color:var(--fog); border-left:2px solid transparent; cursor:default; }
    .rp-t.have { color:var(--mist); } .rp-t .lv { flex:none; min-width:1.7rem; font-size:.75rem; color:var(--fog); font-variant-numeric:tabular-nums; }
    .rp-t.lack { color:#fff; font-weight:600; border-left-color:var(--gold); background:linear-gradient(90deg, rgba(255,213,79,.14), rgba(255,213,79,0)); text-shadow:0 0 10px rgba(255,255,255,.18); }
    .rp-t.lack .lv { color:var(--gold); }
    .rp-tb .empty { color:var(--fog); font-size:.92rem; padding:.2rem .35rem; }
    .rp-legend { display:flex; gap:1rem; align-items:center; margin-bottom:.5rem; color:var(--mist); font-size:.9rem; } .rp-legend i { display:inline-block; width:.7rem; height:.7rem; margin-right:.35rem; vertical-align:-.05rem; } .rp-legend .l i { background:var(--gold); } .rp-legend .h i { background:var(--fog); }
    .rp-right { min-height:0; display:flex; flex-direction:column; }
    .rp-note { margin:.2rem 0 .6rem; padding:.5rem .8rem; border-left:3px solid var(--rose); background:rgba(255,92,106,.07); font-size:.98rem; } .rp-note b { color:var(--ivory); }
    /* nothing on file: one dossier card over their homeworld instead of six empty field boxes */
    .rp-dossier { --ch:.6rem; position:relative; flex:1 1 auto; min-height:12rem; overflow:hidden; display:flex; flex-direction:column; justify-content:flex-end; gap:.6rem; padding:1.2rem 1.4rem; background:#05070f; box-shadow:inset 0 0 0 1px rgba(214,179,106,.35); }
    .rp-dossier > :is(canvas, img) { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:saturate(.75) brightness(.5); }
    .rp-dossier::before { content:""; position:absolute; inset:0; z-index:1; background:linear-gradient(180deg, rgba(3,5,14,.12) 25%, rgba(3,5,14,.9) 62%, rgba(3,5,14,.96)); }
    .rp-dossier > :not(canvas, img) { position:relative; z-index:2; }
    .rp-dossier .k { font:400 .82rem var(--font-display); letter-spacing:.24em; text-transform:uppercase; color:var(--rose); }
    .rp-dossier .t { font:400 1.6rem/1.15 var(--font-title); color:var(--ivory); }
    .rp-dossier .d { max-width:40rem; color:#d5dbea; font-size:1rem; line-height:1.4; }
    .rp-dossier .hw { position:absolute; right:1rem; top:.8rem; font:400 .85rem var(--font-display); letter-spacing:.14em; text-transform:uppercase; color:rgba(236,230,211,.75); }
    .rp-dossier .btn { align-self:flex-start; }
    .rp-noteh { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }

    /* ---------------------------------------------------- Status */
    .sx-grid { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); grid-template-rows:repeat(2, minmax(0,1fr)); gap:.75rem; }
    .sx-box { min-height:0; display:flex; flex-direction:column; }
    .sx-box .rx-bt { font-size:1.12rem; } .sx-spark { width:6.2rem; height:1.7rem; opacity:.95; } .sx-spark svg { width:100%; height:100%; display:block; overflow:visible; }
    .sx-rows { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; justify-content:space-evenly; gap:.15rem; }
    .sx-row { display:grid; grid-template-columns:.85rem 6.2rem minmax(0,1fr) 2.4rem; align-items:center; gap:.5rem; padding:.12rem .3rem; border-left:2px solid transparent; transition:opacity .2s, background .15s; cursor:default; }
    .sx-row .nm { font-size:1rem; color:var(--ivory); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .sx-row.me .nm { color:var(--brass-hi); font-weight:600; }
    .sx-row .tr { position:relative; height:.8rem; background:rgba(255,255,255,.055); box-shadow:inset 0 0 0 1px rgba(214,179,106,.18); overflow:hidden; }
    .sx-row .tr i { position:absolute; inset:0 auto 0 0; width:0; background:linear-gradient(90deg, color-mix(in srgb, var(--c) 55%, #000), var(--c)); box-shadow:0 0 12px color-mix(in srgb, var(--c) 50%, transparent); transition:width .85s var(--ease) calc(var(--i, 0) * 70ms); }
    .sx-row .tr::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(0,0,0,.4) calc(10% - 1px) 10%); }
    .sx-row .v { text-align:right; font-variant-numeric:tabular-nums; color:var(--mist); font-size:.92rem; }
    .sx-row.top .v { color:var(--gold); font-weight:600; } .sx-row.dead { opacity:.4; } .sx-row.dead .nm { text-decoration:line-through; }
    .sx-grid[data-hl] .sx-row { opacity:.38; } .sx-grid[data-hl] .sx-row.hl { opacity:1; background:rgba(98,216,255,.09); border-left-color:var(--c); }
    .sx-scale { margin-left:auto; font:400 .8rem var(--font-ui); color:var(--fog); letter-spacing:.04em; text-transform:none; cursor:help; } .sx-scale + .sx-spark { margin-left:.6rem; }
    .sx-year { display:flex; align-items:baseline; gap:.6rem; margin-left:1.2rem; padding:.1rem .8rem; background:rgba(0,0,0,.4); box-shadow:inset 0 0 0 1px rgba(255,92,106,.35); }
    .sx-year .k { color:var(--mist); font-size:.9rem; letter-spacing:.1em; text-transform:uppercase; } .sx-year .y { font:400 1.9rem/1.2 var(--font-display); color:var(--rose); letter-spacing:.14em; text-shadow:0 0 14px rgba(255,92,106,.7), 0 0 2px #ffd0d4; font-variant-numeric:tabular-nums; }
    .sx-hist { color:var(--fog); font-size:.85rem; }
    @media (max-width: 70rem) { .sx-grid { grid-template-columns:repeat(2, minmax(0,1fr)); grid-template-rows:repeat(3, minmax(0,1fr)); } .rp-techs { grid-template-columns:repeat(2, minmax(0,1fr)); grid-template-rows:repeat(3, minmax(0,1fr)); } }
  `);

  // ================================================================ Races
  const R = { from: 'galaxy', fromParams: null, mode: null, sel: -1, cells: [], secCell: null, el: null, built: false };

  function goBack(snd, params) {
    if (snd) UI.sfx(snd);
    const to = (params && params.from) || 'galaxy';
    UI.Screens.go(UI.Screens.has(to) ? to : 'galaxy', params && params.fromParams ? params.fromParams : undefined);
  }
  const selfRef = () => ({ from: 'races', fromParams: { from: R.from, fromParams: R.fromParams } });

  function openReport(j) { UI.Screens.go('report', Object.assign({ empire: j }, selfRef())); UI.sfx('open'); }
  function openAudience(j) {
    UI.sfx('open');
    if (UI.Audience && UI.Audience.open) UI.Audience.open(j, selfRef());
    else if (UI.Screens.has('audience')) UI.Screens.go('audience', Object.assign({ empire: j }, selfRef()));
    else UI.toast('The audience chamber is not built yet', 'warn');
  }
  function openStatus() { UI.sfx('open'); UI.Screens.go('status', selfRef()); }

  function pick(j) {
    const S = G.S, pv = pair(S, S.playerId, j);
    if (!pv.contact || !S.empires[j].alive) { UI.sfx('error'); UI.toast(S.empires[j].alive ? 'No contact with the ' + S.empires[j].name + ' yet' : 'That empire is gone', 'warn'); return; }
    if (R.mode === 'report') { openReport(j); return; }
    if (R.mode === 'audience') { openAudience(j); return; }
    R.sel = j; UI.sfx('click'); paintSel();
  }
  function act(kind) {
    const S = G.S, usable = R.sel >= 0 && S.empires[R.sel] && S.empires[R.sel].alive && pair(S, S.playerId, R.sel).contact;
    if (usable) { if (kind === 'report') openReport(R.sel); else openAudience(R.sel); return; }
    const any = rivals(S).some(e => e.alive && pair(S, S.playerId, e.id).contact);
    if (!any) { UI.sfx('error'); UI.toast('You have not met any other empire yet', 'warn'); return; }
    setMode(R.mode === kind ? null : kind); UI.sfx('click');
  }
  function setMode(m) { R.mode = m; paintSel(); }
  function paintSel() {
    const S = G.S; if (!S) return;
    for (const c of R.cells) {
      if (!c.ref || c.ref.kind !== 'active') continue;
      c.ref.el.classList.toggle('sel', c.ref.emp === R.sel);
      c.ref.el.classList.toggle('pickable', !!R.mode);
    }
    const p = R.prompt; if (!p) return;
    p.classList.toggle('hot', !!R.mode);
    if (R.mode) UI.mount(p, 'Choose an empire for the ', h('b', R.mode === 'report' ? 'report' : 'audience'), UI.Phone.say([' — click its portrait or press ', h('b', '1–5'), '.  Esc cancels.'], ' — tap its portrait. Back cancels.'));
    else if (R.sel >= 0 && S.empires[R.sel]) UI.mount(p, h('span.rx-dot', { style: { '--c': bannerOf(S.empires[R.sel]), marginRight: '.4rem' } }), 'The ', h('b', S.empires[R.sel].name), ' are selected: ', h('b', 'Report'), ' or ', h('b', 'Audience'), '.');
    else UI.mount(p, UI.Phone.say('Click a portrait to select an empire, or press ', 'Tap a portrait to select an empire, or tap '), h('b', 'Report'), ' / ', h('b', 'Audience'), ' first.');
    if (R.btnR) { R.btnR.classList.toggle('active', R.mode === 'report'); R.btnA.classList.toggle('active', R.mode === 'audience'); }
  }

  // ---- slots ----------------------------------------------------------------------------------------------------------------------------------
  function mkVoid(kind, big, small, icon) {
    return h('div.rc-void.ch' + (kind ? '.' + kind : ''), icon ? UI.icon(icon) : null, h('div.big', big), small ? h('div.sm', small) : null);
  }
  function buildActive(E, i) {
    const S = G.S, me = G.player(), j = E.id, col = bannerOf(E);
    const ref = { kind: 'active', emp: j, i };
    ref.pic = makePic({ race: E.race, color: col });
    const pic = h('div.rc-pic.ch', { onclick: () => pick(j), ondblclick: () => { if (pair(S, me.id, j).contact) openAudience(j); } }, ref.pic.cv, h('span.rc-key', String(i + 1)));
    UI.setTip(pic, () => 'Click to select the ' + E.name + '. Double-click for an audience.');
    ref.plate = h('span.rx-plate', E.name);
    ref.leader = h('span.rc-leader', E.leader);
    ref.treaty = h('span.rc-treaty', ''); ref.trade = h('span.rc-trade', '');
    ref.ptr = h('i.rc-ptr'); ref.bar = h('div.rc-bar', ref.ptr); ref.lab = h('span.rc-lab', '');
    ref.sl = UI.slider({ min: 0, max: 100, step: 4, value: me.spyBudget[j] | 0, color: 'var(--violet)', lockable: false, fmt: v => (v / 10).toFixed(1) + '%',
      onChange: v => { const r = G.order({ t: 'spyBudget', target: j, value: v }); if (!r.ok) { UI.toast(r.msg || 'Could not change the spy budget', 'bad'); UI.sfx('error'); paintSlots(); } } });
    UI.setTip(ref.sl, () => 'Spy network: the share of your gross production spent on hiring spies in the ' + E.name + ' empire. <b>One click = 0.4%.</b>');
    ref.rd1 = h('b', ''); ref.rd2 = h('span.nx', '');
    ref.modes = [[0, 'Hide'], [2, 'Sabotage'], [1, 'Espionage']].map(([m, label]) => {
      const b = UI.button(label, () => { const r = G.order({ t: 'spyMode', target: j, mode: m }); if (!r.ok) { UI.toast(r.msg || 'Could not change the spy mode', 'bad'); UI.sfx('error'); } paintSlots(); }, { small: true, tip: '<b>' + label + '</b><br>' + MODE_TIP[m] });
      b.dataset.mode = m; return b;
    });
    ref.el = h('div.rc-slot.ch', { dataset: { t: 0 }, style: { '--c': col } }, h('i.rc-acc'), pic,
      h('div.rc-main',
        h('div.rc-top', ref.plate, ref.leader),
        h('div.rc-tt', ref.treaty, ref.trade),
        h('div.rc-rel', ref.bar, ref.lab),
        h('div.rc-spy', ref.sl, h('div.rd', ref.rd1, ref.rd2)),
        h('div.rc-modes', h('span.lbl', 'Spies'), ref.modes)));
    ref.plate.style.setProperty('--ink', inkOn(col));
    return ref;
  }
  function paintActive(ref, E, pv) {
    const S = G.S, me = G.player(), j = E.id, Sp = M.Sim.Spy;
    ref.el.dataset.t = pv.treaty;
    ref.treaty.textContent = pv.treatyName; ref.treaty.className = 'rc-treaty t' + pv.treaty;
    UI.setTip(ref.treaty, pv.ceasefire > 0 ? 'A cease-fire holds for ' + pv.ceasefire + ' more ' + plural(pv.ceasefire, 'year') + '.' : pv.treaty === 3 ? 'At war: their fleets will attack yours.' : pv.treaty === 2 ? 'Allies never fight each other, share fuel range and vote for each other in the Council.' : pv.treaty === 1 ? 'Neither side attacks the other away from their own colonies.' : null);
    const tradeOn = pv.trade.bc > 0;
    ref.trade.textContent = tradeOn ? U.fmt(pv.trade.bc) + ' BC per year' : 'No trade'; ref.trade.className = 'rc-trade' + (tradeOn ? ' on' : '');
    UI.setTip(ref.trade, tradeOn ? 'Trade agreement worth <b>' + U.fmt(pv.trade.bc) + ' BC</b> a year at <b>' + pv.trade.percent + '%</b> efficiency — it grows while relations stay good.' : 'No trade agreement. Ask for one in an audience.');
    ref.ptr.style.left = ((pv.attitude + 100) / 2) + '%';
    ref.lab.textContent = pv.label; ref.lab.className = 'rc-lab ' + (pv.labelIdx >= 10 ? 'pos' : pv.labelIdx <= 6 ? 'neg' : pv.labelIdx === 8 ? '' : 'mid');
    UI.setTip(ref.bar, 'Their attitude towards you: <b>' + pv.label + '</b> (' + (pv.attitude > 0 ? '+' : pv.attitude < 0 ? '−' : '') + Math.abs(pv.attitude) + ' of ±100).');
    ref.pic.mood = moodOf(pv);
    // spy network
    const n = me.spies ? me.spies[j] | 0 : 0, bud = me.spyBudget ? me.spyBudget[j] | 0 : 0, gross = (me.flow && me.flow.gross) | 0;
    const cost = Sp && Sp.baseCost ? Sp.baseCost(S, me) : 2 * (me.research.tl[0] | 0) + 25, perYear = Math.floor(gross * bud / 1000), fund = me.spyFund ? me.spyFund[j] | 0 : 0;
    ref.sl.api.set(bud);
    ref.rd1.textContent = n > 0 ? n + ' ' + plural(n, 'spy', 'spies') : 'No spies';
    let nx = '—';
    if (bud > 0) {
      if (perYear >= cost) { const k = Sp && Sp.buyPlan ? Sp.buyPlan(cost, perYear + fund).n : Math.floor(perYear / cost); nx = k + ' ' + plural(k, 'spy', 'spies') + ' / year'; }
      else if (perYear > 0) { const yrs = Math.max(1, Math.ceil((cost - fund) / perYear)); nx = 'next in ~' + yrs + ' yr'; }
    } else nx = 'spy: ' + cost + ' BC';
    ref.rd2.textContent = nx;
    UI.setTip(ref.rd2, () => 'A spy costs <b>' + cost + ' BC</b> (2 × your Computers level + 25' + (raceMod(me).spyCostMul === 0.5 ? ', halved for the Darlok' : '') + '); each extra spy bought in the same year costs double.<br>Spending <b>' + U.fmt(perYear) + ' BC</b> a year on this network.');
    const mode = me.spyMode ? me.spyMode[j] | 0 : 0;
    for (const b of ref.modes) b.classList.toggle('active', +b.dataset.mode === mode);
  }

  function paintSlots() {
    const S = G.S; if (!S || !R.built) return;
    const me = G.player(), riv = rivals(S);
    noteMet(S);
    for (let i = 0; i < 5; i++) {
      const E = riv[i], cell = R.cells[i];
      let kind = 'absent', pv = null;
      if (E) {
        pv = pair(S, me.id, E.id);
        if (pv.contact) met[E.id] = true;
        kind = !E.alive ? (met[E.id] || pv.met ? 'dead' : 'nocontact') : pv.contact ? 'active' : 'nocontact';
      }
      const emp = E ? E.id : -1;
      if (!cell.ref || cell.ref.kind !== kind || cell.ref.emp !== emp) {
        UI.clear(cell.el);
        if (cell.ref && cell.ref.pic) pics.delete(cell.ref.pic);
        if (kind === 'active') { cell.ref = buildActive(E, i); cell.el.appendChild(cell.ref.el); }
        else if (kind === 'dead') {
          const pic = makePic({ race: E.race, color: bannerOf(E) }), gp = h('div.gpic', pic.cv);
          cell.el.appendChild(h('div.rc-void.ch.gone', gp, h('div.big', 'Destroyed'), h('div.sm', 'The ' + E.name + ' empire is no more'), h('i.rc-acc', { style: { background: bannerOf(E), position: 'absolute', left: 0, top: 0, bottom: 0, width: '.3rem' } })));
          cell.ref = { kind, emp, i, pic };
        } else if (kind === 'nocontact') { cell.el.appendChild(mkVoid('', 'No Contact', 'Not yet within range', 'galaxy')); cell.ref = { kind, emp, i }; }
        else {
          const v = mkVoid('', 'Not Present', '', null), WA = M.Gfx && M.Gfx.WorldArt, hp = WA && WA.enabled ? WA.race(me.race, 'homeworld-square') : null;   // the player's own world, dimmed, instead of an empty slab
          if (hp) v.insertBefore(h('div.hw', WA.image(hp, { fx: 0.5, fy: 0.45 })), v.firstChild);
          cell.el.appendChild(v); cell.ref = { kind, emp, i };
        }
        fitPics(R.el);
      }
      if (kind === 'active') paintActive(cell.ref, E, pv);
    }
    // security + allocations
    const sec = R.sec, tot = (me.security | 0) + (me.spyBudget || []).reduce((a, b) => a + (b | 0), 0), dark = raceMod(me).spyDef | 0;
    sec.sl.api.set(me.security | 0);
    sec.big.textContent = '+' + (Math.floor((me.security | 0) / 5) + dark) + '%';
    UI.mount(sec.alloc, 'Allocations: ', h('b', (tot / 10).toFixed(1).replace(/\.0$/, '') + '%'), ' of planetary resources');
    UI.setTip(sec.big, 'Every 1% of production spent on security adds <b>+2%</b> to the chance of catching an enemy spy.' + (dark ? '<br>The Darlok start with a further <b>+' + dark + '%</b>.' : ''));
    // header
    const contacts = riv.filter(e => e.alive && pair(S, me.id, e.id).contact).length;
    UI.mount(R.sub, 'Year ', h('b', Q.year(S)), ' · ', h('b', contacts), plural(contacts, ' empire', ' empires'), ' in contact');
    const wars = riv.filter(e => e.alive && pair(S, me.id, e.id).treaty >= 3).length, pacts = riv.filter(e => e.alive && pair(S, me.id, e.id).treaty === 1 || pair(S, me.id, e.id).treaty === 2).length;
    UI.mount(R.chips, wars ? UI.chip(wars + ' at war', 'bad') : null, pacts ? UI.chip(pacts + ' ' + plural(pacts, 'treaty', 'treaties'), 'ok') : null);
    paintSel();
  }

  function buildRaces(root) {
    R.cells = [];
    const grid = h('div.rc-grid');
    for (let i = 0; i < 5; i++) { const el = h('div.rc-cell'); R.cells.push({ el, ref: null }); grid.appendChild(el); }
    // overall security (the sixth cell)
    const sec = R.sec = { big: h('span.big', '+0%'), alloc: h('div.alloc'), sl: null };
    sec.sl = UI.slider({ min: 0, max: 200, step: 10, value: 0, color: 'var(--azure)', lockable: false, fmt: v => v / 10 + '%',
      onChange: v => { const r = G.order({ t: 'security', value: v }); if (!r.ok) UI.toast(r.msg || 'Could not change security', 'bad'); paintSlots(); } });
    UI.setTip(sec.sl, 'Overall security: the share of your gross production spent on counter-espionage. <b>One click = 1%.</b>');
    const secEl = h('div.rc-sec.ch', h('div', h('div.rx-bt', UI.icon('spy'), 'Overall security'), h('div.rd', sec.big, h('span.hint', 'Security increases the chance of catching all enemy spies.'))), sec.sl, sec.alloc);
    grid.appendChild(h('div.rc-cell', secEl));
    R.sub = h('div.rx-sub'); R.chips = h('div.rx-chips');
    R.prompt = h('div.rx-prompt');
    R.btnS = UI.button('Status', () => openStatus(), { kbd: 'S', tip: 'The Racial Stats: how every empire compares' });
    R.btnR = UI.button('Report', () => act('report'), { kbd: 'R', tip: 'What your spies know about one empire' });
    R.btnA = UI.button('Audience', () => act('audience'), { kbd: 'A', tip: 'Speak with an empire’s ambassador' });
    R.btnC = UI.button('Spies caught', () => { if (UI.Spy && UI.Spy.caught) UI.Spy.caught(); }, { kbd: 'C', tip: 'The Spies Caught table: your spies caught by each empire, and theirs caught by you' });
    R.btnN = UI.button('News archive', () => { if (UI.GNN && UI.GNN.archive) UI.GNN.archive(G.S); }, { kbd: 'N', tip: 'Every GNN report so far, searchable' });
    R.btnO = UI.button('OK', () => goBack('confirm', R), { primary: true, kbd: 'Space', sfx: 'confirm' });
    const sheet = h('div.rx-sheet.panel', h('div.rx-head', h('div.rx-title', 'Races'), R.sub, R.chips), grid, h('div.rx-foot', R.prompt, R.btnS, R.btnR, R.btnA, R.btnC, R.btnN, R.btnO));
    R.el = h('div.rx', sheet);
    root.appendChild(R.el);
    for (const [sel, name] of [['.rc-grid', 'races.grid'], ['.rc-sec', 'races.security'], ['.rx-foot', 'races.foot']]) { const e = R.el.querySelector(sel); if (e) e.dataset.help = name; }      // F1 help anchors
    R.built = true;
    const scr = { screen: 'races' };
    UI.bindKey('c', () => R.btnC.click(), scr); UI.bindKey('n', () => R.btnN.click(), scr);
    UI.bindKey('s', openStatus, scr); UI.bindKey('r', () => act('report'), scr); UI.bindKey('a', () => act('audience'), scr);
    UI.bindKey('o', () => goBack('confirm', R), scr); UI.bindKey('space', () => goBack('confirm', R), scr);
    UI.bindKey('escape', () => { if (R.mode) { setMode(null); UI.sfx('cancel'); } else goBack('cancel', R); }, scr);
    for (let k = 1; k <= 5; k++) UI.bindKey(String(k), () => { const E = rivals(G.S)[k - 1]; if (E) pick(E.id); else UI.sfx('error'); }, scr);
    root.addEventListener('contextmenu', e => { e.preventDefault(); if (R.mode) { setMode(null); UI.sfx('cancel'); } else goBack('cancel', R); });
    M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'races') paintSlots(); });
  }

  UI.Screens.register('races', {
    create(root) { buildRaces(root); },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      R.from = (params && params.from) || 'galaxy'; R.fromParams = (params && params.fromParams) || null; R.mode = null;
      noteMet(G.S);
      if (!(R.sel >= 0 && G.S.empires[R.sel] && G.S.empires[R.sel].alive && pair(G.S, G.S.playerId, R.sel).contact)) R.sel = -1;
      paintSlots();
    },
    update(dt, t) { if (R.el) drawPics(dt, t, R.el); },
    resize() { if (R.el) fitPics(R.el); },
  });

  // ================================================================ Report
  const P = { from: 'races', fromParams: null, emp: -1, el: null };
  function reportOf(S, me, j) {
    const T = S.empires[j], Sp = M.Sim.Spy, Tc = M.Data.Techs;
    let rep = null;
    if (Sp && Sp.reports) { try { const row = Sp.reports(S, me).rows.find(r => r.empire === j); rep = row && row.report ? { year: row.report.year, best: row.report.fields.map(f => f.level) } : null; } catch (e) { rep = null; } }
    else if (me.spyReport && me.spyReport[j]) rep = { year: me.spyReport[j].year, best: me.spyReport[j].best.slice() };
    const fields = [];
    for (let f = 0; f < 6; f++) {
      const out = [];
      if (rep) {
        const levels = T.research.completed[f].slice().sort((a, b) => a - b).filter(l => l <= rep.best[f]);
        for (const l of levels) {
          const list = l === 1 && Tc.l1Bundle && Tc.l1Bundle[f] ? Tc.l1Bundle[f] : [Tc.byFL[f][l]];
          for (const t of list) if (t) out.push({ level: l, name: t.name, desc: t.desc || '', have: me.research.completed[f].indexOf(l) >= 0 });
        }
      }
      fields.push(out);
    }
    return { rep, fields, spies: me.spies ? me.spies[j] | 0 : 0 };
  }
  function relNames(S, T, wantTreaty) {
    const out = [];
    for (const O of S.empires) {
      if (O.id === T.id || !O.alive) continue;
      const pv = pair(S, T.id, O.id);
      if (wantTreaty === 'alliance' ? pv.treaty === 2 : pv.treaty >= 3) out.push(O);
    }
    return out;
  }
  function paintReport() {
    const S = G.S, me = G.player(), j = P.emp, T = S.empires[j];
    if (!T) { goBack(null, P); return; }
    const col = bannerOf(T), data = reportOf(S, me, j), pv = pair(S, me.id, j);
    P.pic.race = T.race; P.pic.color = col; P.pic.mood = moodOf(pv);
    P.left.style.setProperty('--c', col);
    P.plate.textContent = T.name; P.plate.style.setProperty('--c', col); P.plate.style.setProperty('--ink', inkOn(col));
    P.pers.textContent = PERS[T.personality | 0] || '—'; P.obj.textContent = OBJ[T.objective | 0] || '—';
    UI.setTip(P.pers, '<b>' + (PERS[T.personality | 0] || '') + '</b><br>' + (PERS_TIP[T.personality | 0] || ''));
    UI.setTip(P.obj, '<b>' + (OBJ[T.objective | 0] || '') + '</b><br>' + (OBJ_TIP[T.objective | 0] || ''));
    const age = data.rep ? Math.max(0, S.year - data.rep.year) : -1;
    P.age.className = 'rp-age' + (data.rep ? '' : ' none');
    UI.mount(P.age, h('b', 'Report'), data.rep ? h('span.n', age === 0 ? 'this year' : age + ' ' + plural(age, 'year') + ' old') : h('span.n', 'none on file'));
    UI.setTip(P.age, data.rep ? 'Your spies last reported on the ' + T.name + ' in the year ' + M.Data.Config.displayYear({ year: data.rep.year }) + '. The report is refreshed every year while you have a spy there.' : 'You have never had a spy in the ' + T.name + ' empire.');
    const names = list => (list.length ? list.slice(0, 3).map(O => h('div.it', h('i.rx-dot', { style: { '--c': bannerOf(O) } }), O.id === me.id ? h('b', 'You') : h('span', O.name))) : [h('div.none', 'None')]);
    UI.mount(P.allies, names(relNames(S, T, 'alliance')));
    UI.mount(P.wars, names(relNames(S, T, 'war')));
    // techs
    const known = data.fields.reduce((a, f) => a + f.length, 0), lack = data.fields.reduce((a, f) => a + f.filter(t => !t.have).length, 0);
    for (let f = 0; f < 6; f++) {
      const box = P.boxes[f], list = data.fields[f];
      UI.mount(box.r, data.rep ? list.length + ' known' : '');
      if (!list.length) UI.mount(box.list, h('div.empty', data.rep ? 'Nothing known yet' : '—'));
      else UI.mount(box.list, list.map(t => h('div.rp-t.' + (t.have ? 'have' : 'lack'), { tip: '<b>' + U.esc(t.name) + '</b>' + (t.desc ? '<br>' + U.esc(t.desc) : '') + (t.have ? '' : '<br><span class="t-gold">You do not have this technology.</span>') }, h('span.lv', t.level > 1 ? 'L' + t.level : '·'), h('span', t.name))));
    }
    // nothing on file: one dossier card over their homeworld (the six field boxes would all read "—")
    P.techs.style.display = data.rep ? '' : 'none'; if (P.prompt) P.prompt.style.visibility = data.rep ? '' : 'hidden';
    if (data.rep) UI.clear(P.note);
    else {
      const WA = M.Gfx && M.Gfx.WorldArt, path = WA && WA.enabled ? WA.race(T.race, 'homeworld') : null, R = M.Data.Races && M.Data.Races[T.race];
      if (P.dossKey !== path) { P.dossKey = path; P.dossArt = path ? WA.image(path, { fx: 0.5, fy: 0.45 }) : null; }
      const toRaces = () => { UI.sfx('click'); if (P.from === 'races') goBack(null, P); else UI.Screens.go('races', { from: 'galaxy' }); };
      UI.mount(P.note, h('div.rp-dossier.ch', P.dossArt, R && R.homeworld ? h('div.hw', 'Homeworld · ' + R.homeworld) : null,
        h('div.k', 'No intelligence on file'), h('div.t', 'What the ' + T.name + ' know is still their secret'),
        h('div.d', 'Put part of your budget into a spy network against the ' + T.name + ' on the Races screen. Your agents will report their technologies here every year they stay hidden.'),
        UI.button('Spy networks', toRaces, { small: true })));
    }
    P.note.className = data.rep ? '' : 'rp-noteh';
    UI.mount(P.legend, data.rep ? [h('span.l', h('i'), 'You lack it (' + lack + ')'), h('span.h', h('i'), 'You have it (' + (known - lack) + ')')] : null);
    UI.mount(P.sub, 'Intelligence on the ', h('b', T.name), ' · leader ', h('b', T.leader), ' · ', h('b', pv.treatyName.toLowerCase()), ' · attitude ', h('b', pv.label.toLowerCase()));
    P.btnA.disabled = !(pv.contact && T.alive); P.btnA.classList.toggle('disabled', P.btnA.disabled);
  }
  function cycleReport(dir) {
    const S = G.S, me = G.player(), ids = rivals(S).filter(e => e.alive && pair(S, me.id, e.id).contact).map(e => e.id);
    if (ids.length < 2) { UI.sfx('error'); return; }
    let i = ids.indexOf(P.emp); i = (i + dir + ids.length) % ids.length;
    P.emp = ids[i]; UI.sfx('click'); paintReport(); fitPics(P.el);
  }
  function buildReport(root) {
    P.pic = makePic({}); P.plate = h('span.rx-plate', ''); P.pers = h('div.p', ''); P.obj = h('div.o', ''); P.age = h('div.rp-age'); P.allies = h('div.rp-list'); P.wars = h('div.rp-list');
    P.left = h('div.rp-left', h('div.rp-pic.ch', P.pic.cv), P.plate, h('div.rp-traits', P.pers, P.obj), P.age,
      h('div.rx-box.ch', h('div.rx-bt', UI.icon('alliance'), 'Alliances'), P.allies), h('div.rx-box.ch', h('div.rx-bt', UI.icon('war'), 'Wars'), P.wars));
    P.boxes = FIELD.map((name, f) => {
      const r = h('span.r'), list = h('div.rp-tl');
      return { r, list, el: h('div.rx-box.ch.rp-tb', h('div.rx-bt', UI.icon(FIELD_ICON[f]), name, r), list) };
    });
    P.note = h('div'); P.legend = h('div.rp-legend'); P.techs = h('div.rp-techs', P.boxes.map(b => b.el));
    const right = h('div.rp-right', P.note, P.legend, P.techs);
    P.sub = h('div.rx-sub');
    P.btnPrev = UI.button('◀', () => cycleReport(-1), { small: true, tip: 'Previous empire (←)' }); P.btnNext = UI.button('▶', () => cycleReport(1), { small: true, tip: 'Next empire (→)' });
    P.btnA = UI.button('Audience', () => { const j = P.emp; UI.sfx('open'); if (UI.Audience && UI.Audience.open) UI.Audience.open(j, { from: 'report', fromParams: { empire: j, from: P.from, fromParams: P.fromParams } }); else UI.toast('The audience chamber is not built yet', 'warn'); }, { kbd: 'A' });
    P.btnO = UI.button('OK', () => goBack('confirm', P), { primary: true, kbd: 'Space', sfx: 'confirm' });
    P.el = h('div.rx', h('div.rx-sheet.panel', h('div.rx-head', h('div.rx-title', 'Report'), P.sub), h('div.rp-body', P.left, right),
      h('div.rx-foot', P.prompt = h('div.rx-prompt', 'Techs in white are ones you do not have yet.'), P.btnPrev, P.btnNext, P.btnA, P.btnO)));
    root.appendChild(P.el);
    const scr = { screen: 'report' };
    for (const k of ['o', 'space']) UI.bindKey(k, () => goBack('confirm', P), scr);
    UI.bindKey('escape', () => goBack('cancel', P), scr);
    UI.bindKey('arrowleft', () => cycleReport(-1), scr); UI.bindKey('arrowright', () => cycleReport(1), scr);
    UI.bindKey('a', () => { if (!P.btnA.disabled) P.btnA.click(); }, scr);
    root.addEventListener('contextmenu', e => { e.preventDefault(); goBack('cancel', P); });
  }
  UI.Screens.register('report', {
    create(root) { buildReport(root); },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      P.from = (params && params.from) || 'races'; P.fromParams = (params && params.fromParams) || null;
      const S = G.S; let j = params && params.empire !== undefined ? params.empire : -1;
      if (!(S.empires[j] && j !== S.playerId)) { const f = rivals(S).find(e => e.alive && pair(S, S.playerId, e.id).contact) || rivals(S)[0]; j = f ? f.id : -1; }
      if (j < 0) { goBack(null, P); return; }
      P.emp = j; paintReport();
    },
    update(dt, t) { if (P.el) drawPics(dt, t, P.el); },
    resize() { if (P.el) fitPics(P.el); },
  });

  // ================================================================ Status ("Racial Stats")
  let hist = { key: '', rows: [] };                                    // [{turn, year, by:{[empireId]:{fleet,pop,tech,planets,prod,total}}}]
  const STATS = [
    { key: 'fleet', title: 'Fleet strength', icon: 'fleet' }, { key: 'pop', title: 'Population', icon: 'pop' }, { key: 'tech', title: 'Technology', icon: 'tech' },
    { key: 'planets', title: 'Planets', icon: 'planet' }, { key: 'prod', title: 'Production', icon: 'industry' }, { key: 'total', title: 'Total power', icon: 'crown' },
  ];
  function statRows(S) {
    const out = {}, bars = M.Sim.powerBars ? M.Sim.powerBars(S) : null;
    let raw = [];
    try { raw = Q.status ? Q.status(S) : []; } catch (e) { raw = []; }
    for (const E of S.empires) {
      const b = bars ? bars.find(r => r.id === E.id) : null, r = raw.find(x => x.id === E.id) || {};
      out[E.id] = b ? { fleet: b.bars.fleet, pop: b.bars.pop, tech: b.bars.tech, planets: b.bars.planets, prod: b.bars.prod, total: b.total, raw: r }
        : { fleet: r.fleet | 0, pop: r.pop | 0, tech: r.tech | 0, planets: r.planets | 0, prod: r.production | 0, total: r.power | 0, raw: r };
    }
    return out;
  }
  function captureHist() {
    const S = G.S; if (!S) return;
    noteMet(S);
    const last = hist.rows[hist.rows.length - 1];
    if (last && last.turn === S.turn) return;
    hist.rows.push({ turn: S.turn, year: Q.year(S), by: statRows(S) });
    if (hist.rows.length > 150) hist.rows.shift();
  }
  const SX = { from: 'galaxy', fromParams: null, el: null, boxes: [], full: false };
  const spark = (key, S) => {
    const rows = hist.rows, n = rows.length; if (n < 2) return '';
    const W = 100, H = 28, x = i => (i / (n - 1) * W).toFixed(1), y = v => (H - 1 - clamp(v, 0, 100) / 100 * (H - 2)).toFixed(1);
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="M0 ' + (H - 0.5) + 'H' + W + '" stroke="rgba(214,179,106,.25)" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>';
    const order = S.empires.slice().sort((a, b) => (a.id === S.playerId ? 1 : 0) - (b.id === S.playerId ? 1 : 0));         // yours is drawn last (on top)
    for (const E of order) {
      let d = '', started = false;
      for (let i = 0; i < n; i++) { const r = rows[i].by[E.id]; if (!r) continue; d += (started ? 'L' : 'M') + x(i) + ' ' + y(r[key]); started = true; }
      if (d) svg += '<path d="' + d + '" fill="none" stroke="' + bannerOf(E) + '" stroke-width="' + (E.id === S.playerId ? 2 : 1.2) + '" vector-effect="non-scaling-stroke" opacity="' + (E.alive ? 0.95 : 0.35) + '" stroke-linejoin="round"/>';
    }
    return svg + '</svg>';
  };
  function rawTip(S, E, key, r) {
    const q = r.raw || {};
    switch (key) {
      case 'fleet': return 'Fleet strength — ' + r.fleet + ' of 100';
      case 'pop': return 'Population — ' + U.fmt(q.pop === undefined ? 0 : q.pop) + ' million (' + r.pop + ' of 100)';
      case 'tech': return 'Technology — ' + r.tech + ' of 100' + (q.tech ? ' (tech levels summed: ' + U.fmt(q.tech) + ')' : '');
      case 'planets': return 'Planets — ' + (q.planets === undefined ? '' : q.planets + ' colonies, ') + r.planets + ' of 100';
      case 'prod': return 'Production — ' + (q.production === undefined ? '' : U.fmt(q.production) + ' BC a year, ') + r.prod + ' of 100';
      default: return 'Total power — ' + r.total + ' of 100';
    }
  }
  function paintStatus(animate) {
    const S = G.S; if (!S) return;
    captureHist();
    const rows = statRows(S), me = S.playerId, order = [me].concat(S.empires.filter(e => e.id !== me).map(e => e.id));
    UI.mount(SX.year, h('span.k', 'Year'), h('span.y', String(Q.year(S))));
    STATS.forEach((st, bi) => {
      const box = SX.boxes[bi];
      const lead = Math.max.apply(null, S.empires.filter(e => e.alive).map(e => rows[e.id][st.key]));
      const axis = SX.full || st.key === 'total' ? 100 : clamp(Math.ceil(lead * 1.25 / 5) * 5, 20, 100);
      box.scale.textContent = '0–' + axis; UI.setTip(box.scale, axis < 100 ? 'These bars are drawn to a scale of 0–' + axis + ' so small values stay visible. Press <b>Full scale</b> for the original 0–100 length.' : 'Full scale: 0–100, as on the original screen.');
      UI.clear(box.rows);
      order.forEach((id, k) => {
        const E = S.empires[id], r = rows[id], v = r[st.key], col = bannerOf(E);
        const wd = Math.min(100, v / axis * 100), tr = h('i'); tr.style.width = animate ? '0%' : wd + '%';
        const row = h('div.sx-row' + (id === me ? '.me' : '') + (!E.alive ? '.dead' : '') + (E.alive && v === lead && lead > 0 ? '.top' : ''), { dataset: { emp: id }, style: { '--c': col, '--i': k }, tip: () => '<b>' + U.esc(E.name) + '</b><br>' + rawTip(S, E, st.key, r) },
          h('i.rx-dot'), h('span.nm', id === me ? E.name + ' (you)' : E.name), h('div.tr', tr), h('span.v', E.alive ? String(v) : '—'));
        const hl = () => { SX.grid.dataset.hl = id; for (const x of SX.grid.querySelectorAll('.sx-row')) x.classList.toggle('hl', +x.dataset.emp === id); };
        row.addEventListener('mouseenter', hl);
        row.addEventListener('click', () => { if (!(M.Phone && M.Phone.active())) return; if (SX.grid.dataset.hl === String(id)) delete SX.grid.dataset.hl; else hl(); });   // phones: a tap highlights that empire in every box
        row.addEventListener('mouseleave', () => { delete SX.grid.dataset.hl; });
        box.rows.appendChild(row);
        if (animate) requestAnimationFrame(() => requestAnimationFrame(() => { tr.style.width = wd + '%'; }));
      });
      box.spark.innerHTML = spark(st.key, S);
      UI.setTip(box.spark, hist.rows.length > 1 ? 'Each line is one empire over the last ' + hist.rows.length + ' years (0–100).' : 'The history of this chart is recorded year by year from now on.');
    });
    const n = hist.rows.length;
    UI.mount(SX.sub, n > 1 ? h('span.sx-hist', 'History: ' + n + ' years recorded') : h('span.sx-hist', 'History is recorded from now on'));
  }
  function buildStatus(root) {
    SX.year = h('div.sx-year'); SX.sub = h('div.rx-sub');
    SX.grid = h('div.sx-grid');
    SX.boxes = STATS.map(st => {
      const rows = h('div.sx-rows'), spark = h('div.sx-spark'), scale = h('span.sx-scale');
      SX.grid.appendChild(h('div.rx-box.ch.sx-box', h('div.rx-bt', UI.icon(st.icon), st.title, scale, spark), rows));
      return { rows, spark, scale };
    });
    SX.btnO = UI.button('OK', () => goBack('confirm', SX), { primary: true, kbd: 'Space', sfx: 'confirm' });
    SX.btnScale = UI.button('Full scale', () => { SX.full = !SX.full; SX.btnScale.classList.toggle('active', SX.full); paintStatus(true); }, { small: true, tip: 'Draw every bar to the original 0–100 length instead of zooming to the leader' });
    SX.el = h('div.rx', h('div.rx-sheet.panel', h('div.rx-head', h('div.rx-title', 'Racial Stats'), SX.year, SX.sub, h('div.rx-chips', SX.btnScale, SX.btnO)), SX.grid));
    root.appendChild(SX.el);
    const scr = { screen: 'status' };
    for (const k of ['o', 'space', 'enter']) UI.bindKey(k, () => goBack('confirm', SX), scr);
    UI.bindKey('escape', () => goBack('cancel', SX), scr);
    root.addEventListener('contextmenu', e => { e.preventDefault(); goBack('cancel', SX); });
    M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'status') paintStatus(false); });
  }
  UI.Screens.register('status', {
    create(root) { buildStatus(root); },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      SX.from = (params && params.from) || 'galaxy'; SX.fromParams = (params && params.fromParams) || null;
      paintStatus(true);
    },
  });

  // keep the history even when the screen is closed
  if (M.Bus) { M.Bus.on('turn:end', () => { try { captureHist(); } catch (e) { /* the screens are optional */ } }); M.Bus.on('game:new', () => { metKey = ''; }); M.Bus.on('game:loaded', () => { metKey = ''; }); }

  // ================================================================ exports for the audience screen
  UI.Races = { BANNER, PERS, OBJ, TREATY, LADDER, FIELD, PERS_TIP, OBJ_TIP, pair, labelIdx, inkOn, bannerOf, moodOf, rivals, raceMod, makePic, drawPics, fitPics, isMet, treatyIdx, cap };
})(window.MOO);
