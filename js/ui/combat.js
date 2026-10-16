// Tactical combat — pre-battle card, the 10×8 tactical screen, scan / planet overlays and the result card (research/06 §6.1–6.2, research/03 §4).
//
//   MOO.UI.Combat.fight(battle, S, opts?) → Promise<result>     the Game.handlers.battle entry point: 1) pre-battle card in the galaxy side panel (odds estimate, Continue / Auto /
//                                                               Retreat), 2) the tactical screen (screen id 'combat'), 3) result card; resolves with Combat.finish(B) / Combat.resolve().
//   MOO.UI.Combat.demo(opts) → {battle, S}                      fixture battle built with the Design API (opts.scn: 'planet' | 'fleet' | 'defend' | 'monster' | 'crystal' | 'amoeba' | 'big' | 'specials' | 'nebula')
//   MOO.UI.Combat.session() → {B, battle, S, view} | null       the running tactical session (read-only; for tools and tests)
//   Screen 'combat' without params (?dev=1&screen=combat[&scn=…]) boots a demo battle straight into the tactical screen.
// The engine contract is the header of js/sim/combat.js: create / legalMoves / targets / act / endRound / aiTurn / isOver / finish; every call returns events[] that js/ui/combat-fx.js animates.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util;
  const Combat = UI.Combat = {};
  const E = () => M.Sim.Combat;
  const CF = () => UI.CombatFx;
  const EMPCOL = ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sum = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] | 0; return s; };
  const pct = p => Math.round(p * 100) + '%';

  UI.css('combat', `
    /* ---- tactical screen ------------------------------------------------------------------------------------------------------------------ */
    .cb { position:absolute; inset:0; display:grid; grid-template-rows:1fr auto; background:var(--void); }
    .cb-field { position:relative; min-height:0; overflow:hidden; }
    .cb-canvas { position:absolute; inset:0; width:100%; height:100%; touch-action:none; }
    .cb-canvas.hit { cursor:crosshair; } .cb-canvas.go { cursor:pointer; } .cb-canvas.wait { cursor:progress; }
    .cb-top { position:absolute; left:.6rem; right:.6rem; top:.4rem; display:grid; grid-template-columns:1fr auto 1fr; gap:.6rem; align-items:start; pointer-events:none; z-index:3; }
    .cb-glass { background:rgba(8,12,34,.74); backdrop-filter:blur(4px); border:1px solid rgba(214,179,106,.35); clip-path:polygon(.4rem 0,100% 0,100% calc(100% - .4rem),calc(100% - .4rem) 100%,0 100%,0 .4rem); pointer-events:auto; }
    .cb-side { display:flex; align-items:center; gap:.55rem; padding:.28rem .75rem; min-width:0; max-width:19rem; justify-self:start; }
    .cb-side.r { justify-self:end; flex-direction:row-reverse; text-align:right; }
    .cb-side .tx { min-width:0; flex:1; } .cb-side .nm { font:400 1.02rem/1.1 var(--font-display); color:var(--brass-hi); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cb-side .sb { font-size:.76rem; color:var(--mist); white-space:nowrap; } .cb-side .sb b { color:var(--ivory); font-variant-numeric:tabular-nums; }
    .cb-side .bar { margin-top:.2rem; height:.38rem; min-width:7rem; }
    .cb-side .cb-dot { width:.95rem; height:.95rem; flex:none; transform:rotate(45deg); background:var(--c); box-shadow:0 0 .5rem var(--c); }
    .cb-order { display:flex; align-items:center; gap:.28rem; padding:.26rem .55rem .26rem .4rem; }
    .cb-order .rd { font:400 .88rem var(--font-display); color:var(--brass-hi); padding:0 .5rem 0 .3rem; margin-right:.15rem; border-right:1px solid rgba(214,179,106,.3); white-space:nowrap; letter-spacing:.04em; }
    .cb-chip { position:relative; width:2.55rem; height:2.1rem; flex:none; display:grid; place-items:center; background:linear-gradient(180deg, rgba(30,42,92,.9), rgba(12,18,50,.95)); border:1px solid var(--c, #667);
      clip-path:polygon(.26rem 0,100% 0,100% calc(100% - .26rem),calc(100% - .26rem) 100%,0 100%,0 .26rem); transition:opacity .25s, transform .2s, filter .25s; cursor:default; }
    .cb-chip canvas { width:2.15rem; height:1.55rem; object-fit:contain; } .cb-chip .n { position:absolute; right:.14rem; bottom:-.02rem; font:700 .62rem var(--font-ui); text-shadow:0 1px 2px #000, 0 0 3px #000; }
    .cb-chip.done { opacity:.38; filter:saturate(.4); } .cb-chip.active { transform:scale(1.2); z-index:2; border-color:var(--brass-hi); box-shadow:0 0 .9rem var(--c); } .cb-chip.dead { display:none; }
    .cb-chip.pl { background:linear-gradient(180deg, rgba(40,58,96,.9), rgba(14,22,50,.95)); } .cb-chip .pi { width:1.25rem; height:1.25rem; color:var(--c); }
    .cb-ticker { position:absolute; left:50%; top:3.35rem; transform:translateX(-50%); max-width:56%; padding:.18rem .8rem; font-size:.8rem; color:var(--mist); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; z-index:3;
      background:linear-gradient(90deg, transparent, rgba(6,9,26,.72) 15%, rgba(6,9,26,.72) 85%, transparent); opacity:0; transition:opacity .4s; } .cb-ticker.on { opacity:1; }
    .cb-tip { position:absolute; z-index:7; pointer-events:none; min-width:11.5rem; max-width:19rem; padding:.45rem .65rem .5rem; font-size:.86rem; line-height:1.3; display:none;
      background:linear-gradient(135deg, var(--brass), var(--brass-lo)); isolation:isolate; clip-path:polygon(.35rem 0,100% 0,100% calc(100% - .35rem),calc(100% - .35rem) 100%,0 100%,0 .35rem); }
    .cb-tip::before { content:""; position:absolute; inset:1px; z-index:-1; background:#0a1030f2; clip-path:polygon(.35rem 0,100% 0,100% calc(100% - .35rem),calc(100% - .35rem) 100%,0 100%,0 .35rem); }
    .cb-tip .t1 { display:flex; align-items:baseline; gap:.4rem; font:400 1.05rem var(--font-display); color:var(--brass-hi); } .cb-tip .t1 .c { margin-left:auto; color:var(--ivory); font:600 .85rem var(--font-ui); }
    .cb-tip .hp { margin:.25rem 0 .1rem; } .cb-tip .row { display:flex; justify-content:space-between; gap:.8rem; } .cb-tip .row .v { font-weight:600; font-variant-numeric:tabular-nums; }
    .cb-tip .hit { margin-top:.3rem; padding-top:.25rem; border-top:1px solid rgba(214,179,106,.25); } .cb-tip .big { font:400 1.5rem/1 var(--font-title); }
    .cb-tip .ok { color:var(--leaf); } .cb-tip .warn { color:var(--ember); } .cb-tip .bad { color:var(--rose); } .cb-tip .mut { color:var(--mist); font-size:.78rem; }
    .cb-bar { display:grid; grid-template-columns:minmax(16rem, 1.25fr) auto minmax(8.5rem, .5fr); gap:.9rem; align-items:center; padding:.4rem .75rem .45rem; min-height:4.6rem;
      background:linear-gradient(180deg, rgba(14,20,52,.96), rgba(6,9,25,.98)); border-top:1px solid rgba(214,179,106,.45); }
    .cb-info { min-width:0; } .cb-who { display:flex; align-items:baseline; gap:.5rem; white-space:nowrap; min-width:0; }
    .cb-who .nm { font:400 1.2rem/1.1 var(--font-display); color:var(--brass-hi); overflow:hidden; text-overflow:ellipsis; } .cb-who .ct { color:var(--ivory); font-weight:600; }
    .cb-who .hp { margin-left:auto; color:var(--mist); font-size:.85rem; font-variant-numeric:tabular-nums; } .cb-who .hp b { color:var(--ivory); }
    .cb-who .tag { font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; padding:0 .4em; border:1px solid currentColor; } .cb-who .tag.me { color:var(--cyan); } .cb-who .tag.foe { color:var(--rose); }
    .cb-stats, .cb-weps { display:flex; gap:.3rem; flex-wrap:wrap; margin-top:.22rem; font-size:.78rem; }
    .cb-st { display:inline-flex; align-items:center; gap:.3em; padding:.04em .45em; background:rgba(255,255,255,.05); border:1px solid rgba(214,179,106,.2); color:var(--mist); white-space:nowrap; } .cb-st b { color:var(--ivory); font-variant-numeric:tabular-nums; }
    .cb-st .ico { width:.95em; height:.95em; }
    .cb-wp { display:inline-flex; align-items:center; gap:.3em; padding:.04em .5em; background:rgba(98,216,255,.07); border:1px solid rgba(98,216,255,.28); color:var(--ivory); white-space:nowrap; }
    .cb-wp.mis { background:rgba(91,140,255,.09); border-color:rgba(91,140,255,.34); } .cb-wp.bomb { background:rgba(255,92,106,.09); border-color:rgba(255,92,106,.34); }
    .cb-wp.spent { opacity:.38; } .cb-wp.sel { box-shadow:0 0 0 1px var(--brass-hi) inset; } .cb-wp .ico { width:1em; height:1em; } .cb-wp .m { color:var(--mist); }
    .cb-btns { display:flex; gap:.34rem; justify-content:center; flex-wrap:wrap; } .cb-btns .btn { padding:.4em .85em; min-width:4.6rem; }
    .cb-btns .btn.on { color:#261b06; } .cb-btns .btn.on::before { background:linear-gradient(180deg, #e9cb86, #b48d44); }
    .cb-right { display:flex; flex-direction:column; align-items:flex-end; gap:.28rem; } .cb-seg { display:flex; } .cb-seg .btn { padding:.18em .6em; font-size:.82rem; min-width:0; }
    .cb-right .hint { font-size:.72rem; color:var(--fog); text-align:right; line-height:1.25; } .cb-right .hint kbd { font:600 .72rem var(--font-ui); color:var(--mist); }
    .cb-ov { position:absolute; inset:0; z-index:8; display:grid; place-items:center; background:rgba(2,4,14,.58); backdrop-filter:blur(2px); animation:scrim-in .2s ease-out both; }
    .cb-ov .panel { max-width:min(95%, 66rem); max-height:94%; display:flex; flex-direction:column; } .cb-ov .scrl { overflow:auto; min-height:0; }
    .cb-pinfo { position:absolute; top:3.9rem; left:50%; transform:translateX(-50%); z-index:6; width:min(34rem, 92%); }
    .cb-pinfo .panel { padding:.6rem .85rem .7rem; } .cb-pinfo .top { display:flex; gap:.8rem; align-items:center; margin-bottom:.4rem; } .cb-pinfo canvas { width:4.6rem; height:4.6rem; flex:none; }
    .cb-pinfo .nm { font:400 1.4rem/1.1 var(--font-title); color:var(--brass-hi); } .cb-pinfo .own { color:var(--mist); font-size:.9rem; }
    .cb-kv { display:grid; grid-template-columns:repeat(4, 1fr); gap:.35rem; } .cb-kv > div { padding:.25rem .35rem .3rem; text-align:center; background:rgba(0,0,0,.34); border:1px solid rgba(214,179,106,.22); }
    .cb-kv .v { display:block; font:400 1.35rem/1.1 var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; } .cb-kv .l { display:block; font-size:.68rem; letter-spacing:.07em; text-transform:uppercase; color:var(--mist); }
    .cb-kv .v.bad { color:var(--rose); } .cb-kv .v.ok { color:var(--leaf); } .cb-kv .v.az { color:var(--azure); }
    .cb-pinfo .ln { margin-top:.4rem; font-size:.88rem; color:var(--mist); } .cb-pinfo .ln b { color:var(--ivory); }
    .cb-scan table { font-size:.9rem; } .cb-scan td { vertical-align:top; } .cb-scan .nm { font:400 1.02rem var(--font-display); color:var(--brass-hi); white-space:nowrap; }
    .cb-scan .wl { display:flex; flex-direction:column; gap:.1rem; } .cb-scan .wl .ln { display:flex; gap:.35rem; align-items:center; white-space:nowrap; } .cb-scan .wl .ico { width:1em; height:1em; color:var(--ember); }
    .cb-scan .wl .ln.mis .ico { color:var(--azure); } .cb-scan .wl .ln.bomb .ico { color:var(--rose); } .cb-scan .sp { color:var(--violet); font-size:.84rem; line-height:1.35; } .cb-scan .num { text-align:center; font-variant-numeric:tabular-nums; }
    .cb-scan .dmg { color:var(--rose); } .cb-scan .dead td { opacity:.4; }
    .cb-sum { width:min(46rem, 94vw); } .cb-sum .ttl { text-align:center; font:400 2.6rem/1.05 var(--font-display); letter-spacing:.14em; text-shadow:0 0 28px currentColor; margin:.1rem 0 .15rem; }
    .cb-sum .sub { text-align:center; color:var(--mist); margin-bottom:.7rem; } .cb-sum .cols { display:grid; grid-template-columns:1fr 1fr; gap:.8rem; }
    .cb-sum .side { padding:.35rem .5rem .45rem; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.24); } .cb-sum .side h4 { display:flex; align-items:center; gap:.4rem; font-size:1.05rem; margin-bottom:.3rem; }
    .cb-sum .side h4 .tag { margin-left:auto; font:600 .68rem var(--font-ui); letter-spacing:.08em; text-transform:uppercase; color:var(--mist); }
    .cb-sum .row { display:grid; grid-template-columns:2.4rem 1fr 2.1rem 2.1rem 2.1rem; gap:.3rem; align-items:center; padding:.12rem 0; border-bottom:1px solid rgba(255,255,255,.05); font-size:.92rem; font-variant-numeric:tabular-nums; }
    .cb-sum .row.hd { color:var(--mist); font-size:.68rem; letter-spacing:.07em; text-transform:uppercase; border-bottom:1px solid rgba(214,179,106,.3); } .cb-sum .row .r { text-align:right; }
    .cb-sum .row canvas { width:2.2rem; height:1.5rem; object-fit:contain; } .cb-sum .lost { color:var(--rose); } .cb-sum .left { color:var(--leaf); } .cb-sum .vol { color:var(--ember); }
    .cb-sum .pl { margin-top:.6rem; padding:.4rem .6rem; border:1px solid rgba(214,179,106,.24); background:rgba(0,0,0,.25); font-size:.92rem; line-height:1.5; } .cb-sum .pl b { color:var(--ivory); }
    .cb-sum .notes { margin-top:.55rem; color:var(--mist); font-size:.9rem; line-height:1.45; } .cb-sum .notes li { margin-left:1.1rem; }
    .cb-sum .foot { display:flex; justify-content:space-between; align-items:center; margin-top:.8rem; gap:1rem; } .cb-sum .foot .rd { color:var(--mist); font-size:.85rem; }
    /* ---- pre-battle card (galaxy side panel) ------------------------------------------------------------------------------------------------ */
    .pb-head { display:flex; align-items:baseline; gap:.5rem; padding-bottom:.35rem; margin-bottom:.45rem; border-bottom:1px solid rgba(255,92,106,.5); }
    .pb-head .ti { font:400 1.55rem/1 var(--font-title); letter-spacing:.06em; color:var(--rose); text-shadow:0 0 14px rgba(255,92,106,.4); text-transform:uppercase; } .pb-head .st { margin-left:auto; color:var(--mist); font-size:.9rem; }
    .pb-pic { display:block; width:100%; height:9.2rem; margin-bottom:.45rem; border:1px solid rgba(214,179,106,.4); }
    .pb-vs { font-size:1.02rem; line-height:1.3; margin-bottom:.4rem; } .pb-vs b { font-weight:600; } .pb-vs .v { color:var(--mist); }
    .pb-pl { display:flex; gap:.6rem; align-items:center; padding:.35rem .45rem; margin-bottom:.45rem; background:rgba(0,0,0,.3); border:1px solid rgba(214,179,106,.25); } .pb-pl canvas { width:3.4rem; height:3.4rem; flex:none; }
    .pb-pl .a { font:400 1.1rem var(--font-display); color:var(--brass-hi); } .pb-pl .b { font-size:.86rem; color:var(--mist); line-height:1.4; } .pb-pl .b b { color:var(--ivory); }
    .pb-forces { display:grid; grid-template-columns:1fr 1fr; gap:.45rem; margin-bottom:.45rem; } .pb-f { padding:.3rem .4rem .35rem; background:rgba(0,0,0,.28); border:1px solid rgba(214,179,106,.24); min-width:0; }
    .pb-f h5 { margin:0 0 .25rem; display:flex; align-items:center; gap:.35rem; font:400 .98rem var(--font-display); color:var(--brass-hi); white-space:nowrap; overflow:hidden; } .pb-f h5 small { margin-left:auto; font:600 .64rem var(--font-ui); letter-spacing:.08em; color:var(--mist); text-transform:uppercase; }
    .pb-f .d { display:grid; grid-template-columns:2.2rem 1fr auto; gap:.3rem; align-items:center; font-size:.86rem; padding:.05rem 0; } .pb-f .d canvas { width:2.2rem; height:1.4rem; object-fit:contain; } .pb-f .d .n { font-weight:600; font-variant-numeric:tabular-nums; }
    .pb-f .d span:nth-child(2) { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .pb-str { margin-top:.3rem; } .pb-str .l { display:flex; justify-content:space-between; font-size:.68rem; letter-spacing:.07em; text-transform:uppercase; color:var(--mist); }
    .pb-odds { padding:.4rem .55rem .5rem; margin-bottom:.5rem; background:rgba(98,216,255,.06); border:1px solid rgba(98,216,255,.3); } .pb-odds .l { font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; color:var(--mist); }
    .pb-odds .big { font:400 2rem/1 var(--font-title); } .pb-odds .row { display:flex; align-items:baseline; gap:.6rem; } .pb-odds .tx { font-size:.82rem; color:var(--mist); line-height:1.35; } .pb-odds .bar { margin:.3rem 0 .2rem; height:.55rem; }
    .pb-acts { display:flex; gap:.45rem; justify-content:flex-end; margin-top:.4rem; flex-wrap:wrap; } .pb-note { margin-top:.4rem; padding:.3rem .5rem; border-left:3px solid var(--ember); background:rgba(255,148,64,.08); font-size:.84rem; }
  `);

  // "original" restyle (research/ui-ref C 1): a slim steel command bar, ship name on a blue-steel plate, buttons coloured by availability
  // (red = auto-resolve, green = a live action, grey = unavailable), steel-bevel top plates, brick-red accents.
  UI.css('combat-orig', `
    .cb-bar { background:linear-gradient(180deg,#4a4e58 0,#33363e 8%,#23262c 100%); border-top:0; box-shadow:0 -1px 0 #000, 0 -2px 0 #9298a6, inset 0 1px 0 rgba(255,255,255,.18); }
    .cb-who { align-items:center; }
    .cb-who .nm { padding:.1em .7em .12em; font:700 1rem/1.15 var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:#e8f0ff; text-shadow:1px 1px 0 #10204a;
      background:linear-gradient(180deg,#6890d0,#3860a0 50%,#2c4c88); box-shadow:inset 1px 1px 0 #9ab8ee, inset -1px -1px 0 #14264d, 0 0 0 1px #000; }
    .cb-who .ct { color:#fff; } .cb-who .tag.me { color:#8fe6c8; } .cb-who .tag.foe { color:#ff7a68; }
    .cb-st { background:#14161b; border:0; color:#c8d0e4; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #596070; } .cb-st b { color:#fff; }
    .cb-wp { background:#14161b; border:0; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #596070; }
    .cb-btns { gap:.14rem; }
    .cb-btns .btn { min-width:4.4rem; }
    :root:root .cb-btns .btn { clip-path:none; font-weight:700; letter-spacing:.08em; border-radius:0; color:#10200a; text-shadow:0 1px 0 rgba(220,255,200,.45);
      background:linear-gradient(180deg,#8cf04e,#58d030 50%,#3a9c1c); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #c8ff9c, inset -1px -1px 0 #1f5a0c; }
    :root:root .cb-btns .btn::before, :root:root .cb-btns .btn::after { display:none; }
    :root:root .cb-btns .btn:hover:not(:disabled) { filter:brightness(1.12); }
    :root:root .cb-btns .btn:active:not(:disabled) { filter:brightness(.9); box-shadow:0 0 0 1px #000, inset -1px -1px 0 #c8ff9c, inset 1px 1px 0 #1f5a0c; }
    :root:root .cb-btns .btn:nth-child(1) { color:#fff; text-shadow:1px 1px 0 #3a0600; background:linear-gradient(180deg,#e04a34,#c02818 50%,#8c1608); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #ff9a88, inset -1px -1px 0 #5a0c02; }
    :root:root .cb-btns .btn:nth-child(n+2):nth-child(-n+5):not(:disabled) { color:#fff; text-shadow:1px 1px 0 #101830; background:linear-gradient(180deg,#6a7cb0,#4a5a90 50%,#323f70); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #a4b4e4, inset -1px -1px 0 #1a2248; }
    :root:root .cb-btns .btn.on { color:#2a1405; background:linear-gradient(180deg,#ffd36a,#e3a420 50%,#a86c08); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #fff0b0, inset -1px -1px 0 #6a4004; }
    :root:root .cb-btns .btn:disabled { color:#808088; text-shadow:none; filter:none; opacity:1; background:#505058; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #6a6a72, inset -1px -1px 0 #34343a; }
    .cb-btns .btn .kbd { color:inherit; opacity:.6; border-color:currentColor; }
    .cb-glass { background:linear-gradient(180deg,rgba(58,62,72,.92),rgba(28,30,36,.92)); border:0; clip-path:none; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #9298a6, inset -1px -1px 0 #14161a; }
    .cb-side .nm, .cb-order .rd { text-transform:uppercase; letter-spacing:.08em; color:#e8f0ff; text-shadow:1px 1px 0 #000; }
    .cb-chip { clip-path:none; background:#14161b; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #596070; }
    .cb-chip.active { box-shadow:0 0 0 1px #c04030, 0 0 .9rem var(--c); border-color:#c04030; }
    .cb-ticker { color:#c8d0e4; }
  `);

  // ===================================================================================================================================================
  //  small helpers
  // ===================================================================================================================================================
  const dpr = () => Math.min(2, (M.Perf && M.Perf.dpr ? M.Perf.dpr() : window.devicePixelRatio) || 1);
  const empCol = (S, e) => { const em = S && S.empires && S.empires[e]; return em ? EMPCOL[em.color % 6] : '#c8d2f0'; };
  const sideCol = (battle, S, i) => { const s = battle.sides[i]; if (s.monster) return CF() ? CF().MON[s.monster.kind] || '#9dff6a' : '#9dff6a'; return empCol(S, s.empire); };
  const mySide = battle => { const i = battle.sides.findIndex(s => s.human); return i < 0 ? 0 : i; };
  const MON_NAME = { guardian: 'Guardian of Orion', crystal: 'Space Crystal', amoeba: 'Space Amoeba' };
  const HULLN = ['Small', 'Medium', 'Large', 'Huge'];
  const SHIELD_CLASS = { 0: '—', 5: 'Class V', 10: 'Class X', 15: 'Class XV', 20: 'Class XX' };
  const unitHp = u => (u.count > 0 ? (u.count - 1) * u.hp1 + Math.max(0, u.hp1 - u.hploss) : 0);
  const hullFit = [0.58, 0.7, 0.82, 0.94];

  function shipCanvas(race, hull, color, flags, w, hh) {
    const c = h('canvas', { width: Math.round(w * 2), height: Math.round(hh * 2) });
    try {
      const size = Math.round(w * 2 * (hullFit[clamp(hull | 0, 0, 3)]));
      const sp = M.Gfx.Ships.sprite(race === 'monster' ? 'sakkra' : race, clamp(hull | 0, 0, 3), size, color, flags || {});
      const k = Math.min(c.width / sp.width, c.height / sp.height, 1.6), g = c.getContext('2d');
      g.drawImage(sp, (c.width - sp.width * k) / 2, (c.height - sp.height * k) / 2, sp.width * k, sp.height * k);
    } catch (e) { /* art is optional */ }
    return c;
  }
  function designFlags(d) {
    const f = { colony: !!(d && d.colonyMin > 0), beams: false, missiles: false, bomb: !!(d && ((d.bombs | 0) + (d.bio | 0)) > 0) };
    if (d) for (const w of d.weapons || []) { if (w.kind === 'beam') f.beams = true; else if (w.kind === 'missile' || w.kind === 'torpedo') f.missiles = true; }
    return f;
  }
  function planetCanvas(battle, S, size) {
    const c = h('canvas', { width: size * 2, height: size * 2 }), pl = battle.planet;
    try {
      const sp = S && S.planets && pl ? S.planets[pl.id] : null;
      const look = sp ? (sp.type === 'none' ? 'asteroids' : sp.growth === 'gaia' ? 'gaia' : sp.type) : (pl && pl.type) || 'barren';
      const spr = M.Gfx.pick('planets').sprite({ look, seed: sp ? sp.id * 7919 + (sp.gfx | 0) : 7, inhabited: true }, size * 2);
      c.getContext('2d').drawImage(spr, 0, 0, size * 2, size * 2);
    } catch (e) { const x = c.getContext('2d'); x.fillStyle = '#445'; x.beginPath(); x.arc(size, size, size * 0.8, 0, 6.3); x.fill(); }
    return c;
  }
  function sideTitle(battle, i) {
    const s = battle.sides[i];
    return s.monster ? (MON_NAME[s.monster.kind] || s.name) : (s.name || 'Fleet');
  }
  function sideBlurb(battle) {
    const a = battle.sides.find(s => s.role === 'attacker') || battle.sides[1], d = battle.sides.find(s => s !== a) || battle.sides[0];
    const an = a.monster ? (MON_NAME[a.monster.kind] || a.name) : a.name, dn = d.name;
    return { a, d, an, dn, verb: a.monster || !/s$/i.test(an) ? 'attacks' : 'attack' };
  }

  // ===================================================================================================================================================
  //  PRE-BATTLE CARD (side panel 'prebattle')
  // ===================================================================================================================================================
  function strengthOf(battle, i) { try { return E().sideWeight(battle, i); } catch (e) { return 0; } }
  function hasRefuge(S, battle, me) {
    const emp = battle.sides[me].empire;
    return !!(S && S.planets && S.planets.some(p => p.owner === emp && p.starId !== battle.star));
  }
  function forceBlock(battle, S, i, me) {
    const s = battle.sides[i], col = sideCol(battle, S, i), box = h('div.pb-f');
    box.appendChild(h('h5', h('span.cb-dot', { style: { width: '.7rem', height: '.7rem', display: 'inline-block', transform: 'rotate(45deg)', background: col, boxShadow: '0 0 .4rem ' + col } }), h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, sideTitle(battle, i)), h('small', i === me ? 'You' : (s.role === 'attacker' ? 'Attacker' : 'Defender'))));
    let any = false;
    for (let k = 0; k < 6; k++) {
      const n = s.ships ? s.ships[k] | 0 : 0, d = s.designs && s.designs[k];
      if (n <= 0 || !d) continue;
      any = true;
      box.appendChild(h('div.d', shipCanvas(s.monster ? 'sakkra' : s.race, s.monster ? 3 : d.hull, col, designFlags(d), 36, 24), h('span', d.name || HULLN[d.hull | 0]), h('span.n', '×' + n)));
    }
    if (battle.planet && battle.planetSide === i && (battle.planet.bases | 0) > 0) {
      any = true;
      box.appendChild(h('div.d', h('span', { style: { display: 'grid', placeItems: 'center' } }, UI.icon('defense')), h('span', 'Missile bases'), h('span.n', '×' + battle.planet.bases)));
    }
    if (!any) box.appendChild(h('div.dim', 'No ships'));
    return box;
  }

  function buildPreBattle(p, host, finish) {
    const battle = p.battle, S = p.S || G.S, me = mySide(battle), foe = 1 - me, B = sideBlurb(battle), cleanup = [];
    const colA = sideCol(battle, S, battle.sides.indexOf(B.a)), colD = sideCol(battle, S, battle.sides.indexOf(B.d));
    const tacticalDefault = !(S && S.settings && S.settings.options && S.settings.options.tactical === false);
    const root = h('div.pb');
    root.appendChild(h('div.pb-head', h('span.ti', 'Space Combat'), h('span.st', battle.starName || (S && S.stars[battle.star] && S.stars[battle.star].name) || '')));

    // header picture: the real backdrop with a taste of both fleets
    const pic = h('canvas.pb-pic');
    root.appendChild(pic);
    let t0 = 0;
    const picDraw = (dt, t) => {
      if (!pic.isConnected) return;
      const o = UI.fitCanvas(pic, { maxDpr: 1.5 }), g = o.ctx;
      try {
        const star = (S && S.stars && S.stars[battle.star] && S.stars[battle.star].color) || 'yellow', sp = S && S.planets && S.planets[battle.star];
        let desc = null;
        if (sp && sp.type !== 'none') desc = { look: sp.growth === 'gaia' ? 'gaia' : sp.type, seed: sp.id * 7919 + (sp.gfx | 0), inhabited: sp.owner >= 0 };
        M.Gfx.Scenes.battle.draw(g, o.w, o.h, t, { starKind: star, seed: (battle.star | 0) * 131 + (battle.bg | 0) * 17 + 5, nebula: !!battle.nebula || (battle.bg | 0) % 2 === 0, planet: desc ? { desc, size: 0.72 } : null });
      } catch (e) { g.fillStyle = '#060919'; g.fillRect(0, 0, o.w, o.h); }
      try {
        for (let s = 0; s < 2; s++) {
          const sd = battle.sides[s]; let best = -1;
          for (let k = 0; k < 6; k++) if ((sd.ships[k] | 0) > 0 && sd.designs[k] && (best < 0 || sd.designs[k].hull > sd.designs[best].hull)) best = k;
          if (best < 0) continue;
          const d = sd.designs[best], len = o.h * (sd.monster ? 0.62 : [0.34, 0.42, 0.52, 0.62][clamp(d.hull | 0, 0, 3)]);
          const x = s === 0 ? o.w * 0.22 : o.w * 0.78, y = o.h * 0.64 + Math.sin(t * 0.9 + s * 2) * 3;
          M.Gfx.Ships.draw(g, { race: sd.monster ? (sd.monster.kind === 'crystal' ? 'silicoid' : 'meklar') : sd.race, hull: sd.monster ? 4 : clamp(d.hull | 0, 0, 3), x, y, size: len, angle: s === 0 ? 0 : Math.PI, color: sideCol(battle, S, s), flags: designFlags(d), t, thrust: 0.4 });
        }
      } catch (e) { /* art is optional */ }
      t0 = t;
    };
    cleanup.push(UI.onFrame(picDraw));

    root.appendChild(h('div.pb-vs', h('b', { style: { color: colA } }, B.an), ' ', h('span.v', B.verb), ' ', h('b', { style: { color: colD } }, B.dn)));
    if (battle.planet) {
      const pl = battle.planet, ownerSide = battle.planetSide >= 0 ? battle.sides[battle.planetSide] : null;
      root.appendChild(h('div.pb-pl', planetCanvas(battle, S, 40), h('div',
        h('div.a', pl.name), h('div.b', 'Pop ', h('b', pl.pop), ' · Factories ', h('b', pl.factories), h('br'), 'Missile bases ', h('b', pl.bases | 0), ' · Shield ', h('b', SHIELD_CLASS[pl.shield | 0] || ('+' + pl.shield)), ownerSide ? h('br') : null, ownerSide ? h('span', { style: { color: sideCol(battle, S, battle.planetSide) } }, ownerSide.name + ' world') : null))));
    }
    const forces = h('div.pb-forces', forceBlock(battle, S, me, me), forceBlock(battle, S, foe, me));
    root.appendChild(forces);
    // strength bars
    const w0 = strengthOf(battle, me), w1 = strengthOf(battle, foe), wm = Math.max(1, w0, w1);
    root.appendChild(h('div.pb-str', h('div.l', h('span', 'Fleet strength'), h('span', U.fmt ? U.fmt(Math.round(w0)) + ' : ' + U.fmt(Math.round(w1)) : Math.round(w0) + ' : ' + Math.round(w1))),
      UI.bar(w0 / wm, { color: 'var(--cyan)' }), h('div', { style: { height: '.2rem' } }), UI.bar(w1 / wm, { color: 'var(--rose)' })));

    // odds (Monte-Carlo across the worker pool)
    const oddsBig = h('span.big', '…'), oddsTx = h('div.tx', 'Simulating the battle…'), oddsBar = UI.bar(0, { color: 'var(--leaf)' });
    root.appendChild(h('div.pb-odds', h('div.l', 'Estimated odds of victory'), h('div.row', oddsBig, oddsTx), oddsBar));
    const token = { dead: false };
    cleanup.push(() => { token.dead = true; });
    estimateOdds(battle, me, token, r => {
      if (token.dead) return;
      const p0 = r.win / Math.max(1, r.n);
      oddsBig.textContent = Math.round(p0 * 100) + '%'; oddsBig.style.color = p0 >= 0.6 ? 'var(--leaf)' : p0 >= 0.35 ? 'var(--ember)' : 'var(--rose)';
      oddsBar.set(p0); oddsBar.style.setProperty('--c', p0 >= 0.6 ? 'var(--leaf)' : p0 >= 0.35 ? 'var(--ember)' : 'var(--rose)');
      oddsTx.innerHTML = 'Expected losses: <b>' + (r.lost[0] / r.n).toFixed(1) + '</b> of yours, <b>' + (r.lost[1] / r.n).toFixed(1) + '</b> of theirs <span class="dim">(' + r.n + ' simulated battles)</span>';
    });

    const refuge = hasRefuge(S, battle, me), canRetreat = sum(battle.sides[me].ships || []) > 0;
    if (canRetreat && !refuge) root.appendChild(h('div.pb-note', 'You own no other colony: a fleet that withdraws has nowhere to go and is lost.'));
    const go = fn => () => { fn(); };
    const acts = h('div.pb-acts');
    const bFight = UI.button('Continue', go(() => finish('fight')), { primary: tacticalDefault, kbd: 'C', tip: 'Fight the battle yourself on the tactical map (C / Space)' });
    const bAuto = UI.button('Auto', go(() => finish('auto')), { primary: !tacticalDefault, kbd: 'A', tip: 'Let the computer fight it out and show only the result (A)' });
    const bRet = UI.button('Retreat', go(async () => {
      if (!refuge && !(await UI.confirm('Your fleet has no other colony to retreat to and will be lost. Withdraw anyway?', { title: 'Retreat' }))) return;
      finish('retreat');
    }), { danger: false, kbd: 'R', disabled: !canRetreat, tip: canRetreat ? 'Withdraw the whole fleet without a fight (R)' : 'You have no ships to withdraw' });
    acts.appendChild(bRet); acts.appendChild(bAuto); acts.appendChild(bFight);
    root.appendChild(acts);
    host.appendChild(root);

    const onKey = e => {
      if (UI.modalOpen && UI.modalOpen()) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let btn = null;
      if (k === 'c' || k === ' ' || k === 'Enter') btn = bFight; else if (k === 'a') btn = bAuto; else if (k === 'r') btn = bRet;
      if (btn && !btn.disabled) { e.preventDefault(); e.stopPropagation(); UI.sfx('click'); btn.click(); }
    };
    window.addEventListener('keydown', onKey, true);
    cleanup.push(() => window.removeEventListener('keydown', onKey, true));
    void t0;
    return () => cleanup.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  }

  // Monte-Carlo odds: every sample is a full Combat.resolve on the worker pool (inline when the pool is unavailable)
  function estimateOdds(battle, me, token, onUpdate) {
    const Wk = M.Workers, N = Wk && Wk.size && Wk.size() > 0 ? clamp(Wk.size() * 5, 32, 120) : 12, res = { n: 0, win: 0, lost: [0, 0] };
    let pending = false;
    const push = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; onUpdate(res); }); };
    const one = i => {
      const seed = String(battle.seed) + ':odds:' + i;
      const p = Wk && Wk.run ? Wk.run('resolveBattle', { battle, seed }) : Promise.resolve(E().resolve(battle, M.RNG.create(seed)));
      return p.then(r => {
        if (token.dead || !r) return;
        res.n++; if (r.winner === me) res.win++;
        for (let s = 0; s < 2; s++) res.lost[s] += sum(r.sides[s === 0 ? me : 1 - me].lost);
        push();
      }).catch(err => { console.warn('[Combat] odds sample failed', err); });
    };
    const jobs = []; for (let i = 0; i < N; i++) jobs.push(one(i));
    Promise.all(jobs).then(() => { if (!token.dead && res.n) onUpdate(res); });
  }

  UI.Side.register('prebattle', {
    render(host, ctx) {
      this.off = buildPreBattle(ctx.params, host, v => { if (this.off) { this.off(); this.off = null; } if (ctx.params.resolve) ctx.params.resolve(v); });
    },
    dispose() { if (this.off) { this.off(); this.off = null; } },
  });

  // ===================================================================================================================================================
  //  RESULT CARD (shared by the tactical screen overlay and the galaxy side panel after Auto / Retreat)
  // ===================================================================================================================================================
  function nearestRefuge(S, empire, star) {
    if (!S) return null;
    const A = S.stars[star]; let best = null, bd = Infinity;
    for (const p of S.planets) { if (p.owner !== empire || p.starId === star) continue; const B = S.stars[p.starId], d = Math.hypot(B.x - A.x, B.y - A.y); if (d < bd) { bd = d; best = S.stars[p.starId].name; } }
    return best;
  }
  function buildSummary(res, battle, S, onContinue) {
    const me = mySide(battle), foe = 1 - me, win = res.winner === me;
    const mine = res.sides[me], theirs = res.sides[foe];
    const withdrew = res.reason === 'retreat';
    const left = sum(mine.survivors);
    let title, col;
    if (withdrew) { title = 'Withdrawn'; col = 'var(--ember)'; } else if (win) { title = 'Victory'; col = 'var(--leaf)'; } else if (left > 0) { title = 'Defeat'; col = 'var(--rose)'; } else { title = 'Defeat'; col = 'var(--rose)'; }
    const root = h('div.cb-sum');
    root.appendChild(h('div.ttl', { style: { color: col } }, title));
    const blurb = sideBlurb(battle);
    root.appendChild(h('div.sub', res.summary && res.summary[0] ? res.summary[0] : blurb.an + ' ' + blurb.verb + ' ' + blurb.dn));
    const cols = h('div.cols');
    for (const i of [me, foe]) {
      const sd = battle.sides[i], rs = res.sides[i], c = sideCol(battle, S, i), box = h('div.side');
      box.appendChild(h('h4', h('span.empire-dot', { style: { '--c': c } }), sideTitle(battle, i), h('span.tag', i === me ? 'You' : (rs.destroyed ? 'Destroyed' : i === res.winner ? 'Victorious' : 'Defeated'))));
      box.appendChild(h('div.row.hd', h('span'), h('span', 'Ship'), h('span.r', 'Start'), h('span.r', 'Lost'), h('span.r', 'Left')));
      let any = false;
      for (let k = 0; k < 6; k++) {
        const n = sd.ships ? sd.ships[k] | 0 : 0, d = sd.designs && sd.designs[k];
        if (n <= 0 || !d) continue;
        any = true;
        const lost = rs.lost[k] | 0, surv = rs.survivors[k] | 0, vol = rs.voluntary ? rs.voluntary[k] | 0 : 0;
        box.appendChild(h('div.row', shipCanvas(sd.monster ? 'sakkra' : sd.race, sd.monster ? 3 : d.hull, c, designFlags(d), 36, 24), h('span', d.name), h('span.r', n), h('span.r' + (lost ? '.lost' : ''), lost || '—'), h('span.r' + (surv ? '.left' : ''), surv || '—', vol ? h('sup.vol', { title: 'left the field by retreat' }, '↯') : null)));
      }
      if (!any) box.appendChild(h('div.dim', 'No ships'));
      cols.appendChild(box);
    }
    root.appendChild(cols);
    if (res.planet && battle.planet) {
      const p = res.planet, pl = battle.planet, bits = [];
      bits.push(h('span', h('b', pl.name), ': missile bases ', h('b', (pl.bases | 0)), ' → ', h('b', p.basesLeft), p.basesLost ? h('span.lost', ' (−' + p.basesLost + ')') : null));
      if (p.popKilled) bits.push(h('span', ' · population ', h('b.lost', '−' + p.popKilled), ' → ', h('b', p.popLeft)));
      if (p.factoriesKilled) bits.push(h('span', ' · factories ', h('b.lost', '−' + p.factoriesKilled), ' → ', h('b', p.factoriesLeft)));
      if (p.bioDamage) bits.push(h('span', ' · bio damage ', h('b.lost', p.bioDamage)));
      root.appendChild(h('div.pl', bits));
    }
    const notes = [];
    const emp = battle.sides[me].empire;
    if (!win && left > 0 && !withdrew) { const to = nearestRefuge(S, emp, battle.star); notes.push(to ? 'The surviving ships retreat to ' + to + '.' : 'With no other colony to fall back on, the surviving ships are lost.'); }
    if (withdrew) { const to = nearestRefuge(S, emp, battle.star); notes.push(to ? 'The fleet withdraws to ' + to + '.' : 'The fleet had no refuge and is lost.'); }
    if (win && battle.planet && battle.planet.owner !== emp && battle.planet.owner >= 0 && left > 0) notes.push('The planet is open to bombardment and invasion.');
    if (win && battle.sides[foe].monster && res.sides[foe].destroyed) notes.push(MON_NAME[battle.sides[foe].monster.kind] + ' has been slain.');
    if (notes.length) root.appendChild(h('ul.notes', notes.map(n => h('li', n))));
    const btn = UI.button('Continue', onContinue, { primary: true, kbd: 'Space' });
    root.appendChild(h('div.foot', h('span.rd', 'Rounds fought: ', h('b', res.rounds | 0)), btn));
    root.btn = btn;
    return root;
  }

  UI.Side.register('combatResult', {
    render(host, ctx) {
      const p = ctx.params, self = this;
      const wrap = h('div', { style: { padding: '.1rem' } });
      const finish = () => { self.dispose(); if (p.resolve) p.resolve(true); };
      wrap.appendChild(h('div.pb-head', h('span.ti', 'Space Combat'), h('span.st', p.battle.starName || '')));
      const node = buildSummary(p.result, p.battle, p.S, finish);
      node.style.width = 'auto';
      wrap.appendChild(node); host.appendChild(wrap);
      this.onKey = e => { if (UI.modalOpen && UI.modalOpen()) return; if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'c') { e.preventDefault(); e.stopPropagation(); UI.sfx('click'); finish(); } };
      window.addEventListener('keydown', this.onKey, true);
    },
    dispose() { if (this.onKey) { window.removeEventListener('keydown', this.onKey, true); this.onKey = null; } },
  });

  // ===================================================================================================================================================
  //  fight(): the interrupt handler
  // ===================================================================================================================================================
  function showOnGalaxy(name, params, last) {                       // last: the final card of the battle → put the default side panel back afterwards
    return new Promise(resolve => {
      const done = v => { resolve(v); if (last) setTimeout(() => { if (UI.Galaxy && UI.Galaxy.showDefault && UI.Screens.current && UI.Screens.current.id === 'galaxy') UI.Galaxy.showDefault(); }, 0); };
      if (UI.Screens.has('galaxy')) {
        if (!UI.Screens.current || UI.Screens.current.id !== 'galaxy') UI.Screens.go('galaxy');
        try { if (UI.Galaxy.map && params.battle.star >= 0) UI.Galaxy.map.centerOn(params.battle.star, { animate: true }); } catch (e) { /* map optional */ }
        UI.Side.show(name, Object.assign({}, params, { resolve: done }));
      } else {                                                    // no galaxy screen (test pages): show the card in a modal
        const host = h('div'); let off = null;
        const pr = UI.modal({ title: '', body: host, buttons: [], closable: false, width: '30rem', onOpen: () => { if (name === 'prebattle') off = buildPreBattle(params, host, v => pr.close(v)); else host.appendChild(buildSummary(params.result, params.battle, params.S, () => pr.close(true))); } });
        pr.then(v => { if (off) off(); done(v); });
      }
    });
  }

  Combat.fight = async function (battle, S, opts) {
    opts = opts || {};
    S = S || G.S;
    const Cb = E(), me = mySide(battle), seed = String(battle.seed) + ':ui';
    if (!battle.sides.some(s => s.human)) return Cb.resolve(battle, M.RNG.create(seed));          // nobody to ask: pure auto-resolve
    let choice = opts.skipCard ? 'fight' : await showOnGalaxy('prebattle', { battle, S });
    if (choice === 'retreat') {
      const res = Cb.retreatBeforeBattle(battle, me);
      await showOnGalaxy('combatResult', { battle, S, result: res }, true);
      return res;
    }
    if (choice === 'auto') {
      const res = Cb.resolve(battle, M.RNG.create(seed + ':auto'));
      UI.sfx('explosion_small', { vol: 0.5 });
      await showOnGalaxy('combatResult', { battle, S, result: res }, true);
      return res;
    }
    return new Promise(resolve => {
      const sess = { battle, S, resolve, from: opts.from || (UI.Screens.current && UI.Screens.current.id !== 'combat' ? UI.Screens.current.id : 'galaxy'), seed };
      UI.Screens.go('combat', { session: sess });
    });
  };

  // ===================================================================================================================================================
  //  THE TACTICAL SCREEN
  // ===================================================================================================================================================
  const st = {                                                       // controller state (one battle at a time)
    sess: null, B: null, S: null, battle: null, view: null, me: 0, token: 0, busy: true, waiter: null, cur: null, moves: [], targets: [], missileOn: true, special: null,
    hover: null, overlay: null, auto: false, roundOrder: [], logIdx: 0, hp0: [1, 1], tickT: 0, offKeys: [], ready: false, summary: false,
  };
  let el = null, ui = null;
  const sfxOn = () => { try { return M.Settings.get('animSpeed') !== 0; } catch (e) { return true; } };

  function buildScreen(root) {
    const canvas = h('canvas.cb-canvas');
    const tip = h('div.cb-tip');
    const sideL = h('div.cb-glass.cb-side'), sideR = h('div.cb-glass.cb-side.r');
    const order = h('div.cb-glass.cb-order'), ticker = h('div.cb-ticker');
    const top = h('div.cb-top', sideL, order, sideR);
    const field = h('div.cb-field', canvas, top, ticker, tip);
    const who = h('div.cb-who'), stats = h('div.cb-stats'), weps = h('div.cb-weps');
    const info = h('div.cb-info', who, stats, weps);
    const btn = (label, key, fn, o) => UI.button(label, fn, Object.assign({ kbd: key }, o));
    const b = {
      auto: btn('Auto', 'A', () => doAuto(), { tip: 'Let the computer play the rest of the battle (A)' }),
      planet: btn('Planet', 'P', () => toggleOverlay('planet'), { tip: 'Planet and missile-base status (P)' }),
      scan: btn('Scan', 'S', () => toggleOverlay('scan'), { tip: 'Battle scanner: full specs of every ship (S)' }),
      missile: btn('Missiles', 'M', () => toggleMissile(), { tip: 'Missiles and torpedoes on / off (M)' }),
      special: btn('Special', 'X', () => openSpecial(), { tip: 'Use a special device (X)' }),
      retreat: btn('Retreat', 'R', () => doRetreat(false), { tip: 'Retreat this group; it leaves next turn (R). Shift+R: the whole fleet' }),
      wait: btn('Wait', 'W', () => submit({ type: 'wait' }), { tip: 'Act later this round (W)' }),
      done: btn('Done', 'D', () => submit({ type: 'done' }), { primary: true, tip: 'End this group\'s turn (D, Esc or Space)' }),
    };
    const btns = h('div.cb-btns', b.auto, b.planet, b.scan, b.missile, b.special, b.retreat, b.wait, b.done);
    const spd = {};
    const seg = h('div.cb-seg', [['1×', 1], ['2×', 2], ['Skip', 0]].map(([l, v]) => (spd[v] = UI.button(l, () => setSpeed(v), { small: true, tip: v === 0 ? 'Instant: no animation' : v === 2 ? 'Fast animation' : 'Normal animation' }))));
    const right = h('div.cb-right', seg, h('div.hint', h('kbd', 'Space'), ' skips animation · click a lit cell to move, an enemy to fire'));
    const bar = h('div.cb-bar', info, btns, right);
    const wrap = h('div.cb', field, bar);
    root.appendChild(wrap);
    field.dataset.help = 'combat.field'; btns.dataset.help = 'combat.buttons'; info.dataset.help = 'combat.info'; order.dataset.help = 'combat.order';      // F1 help anchors
    ui = { canvas, tip, sideL, sideR, order, ticker, field, who, stats, weps, b, btns, spd, bar, chips: new Map(), ov: null, pinfo: null };
    // pointer input
    let lastCell = null;
    canvas.addEventListener('pointermove', e => { const c = st.view ? st.view.cellAt(e.clientX, e.clientY) : null; if (!c !== !lastCell || (c && lastCell && (c.x !== lastCell.x || c.y !== lastCell.y))) { lastCell = c; onHover(c); } placeTip(e); });
    canvas.addEventListener('pointerleave', () => { lastCell = null; onHover(null); });
    canvas.addEventListener('pointerdown', e => {
      if (e.button === 2) return;
      if (st.view && st.view.busy()) { st.view.skip(); return; }
      const c = st.view ? st.view.cellAt(e.clientX, e.clientY) : null;
      if (c) onClick(c, e);
    });
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); onRight(); });
    root.addEventListener('contextmenu', e => e.preventDefault());
  }

  function bindKeys() {
    const scr = { screen: 'combat' };
    const k = (combo, fn) => st.offKeys.push(UI.bindKey(combo, fn, scr));
    k('a', () => ui.b.auto.click()); k('p', () => ui.b.planet.click()); k('s', () => ui.b.scan.click()); k('m', () => ui.b.missile.click()); k('x', () => ui.b.special.click());
    k('r', e => { if (e && e.shiftKey) doRetreat(true); else ui.b.retreat.click(); });
    k('w', () => ui.b.wait.click()); k('d', () => ui.b.done.click());
    k('escape', () => { if (st.overlay) closeOverlay(); else if (st.special) cancelSpecial(); else ui.b.done.click(); });
    k('space', () => { if (st.view && st.view.busy()) st.view.skip(); else if (st.summary) { if (st.summaryBtn) st.summaryBtn.click(); } else if (st.overlay) closeOverlay(); else ui.b.done.click(); });
    k('enter', () => { if (st.summary && st.summaryBtn) st.summaryBtn.click(); });
    k('l', () => toggleLog());
  }

  UI.Screens.register('combat', {
    create(root) { el = root; buildScreen(root); bindKeys(); },
    enter(params) {
      if (!E()) { UI.toast('The combat engine is not loaded', 'bad'); UI.Screens.go('galaxy'); return; }
      let sess = params && params.session;
      if (!sess) {                                                       // dev: ?screen=combat → straight into a demo battle
        const q = new URLSearchParams(location.search), d = Combat.demo({ scn: q.get('scn') || 'planet' });
        sess = { battle: d.battle, S: d.S, resolve: () => {}, from: 'galaxy', seed: String(d.battle.seed) + ':ui', demo: true };
      }
      start(sess);
    },
    leave() { stop(); },
    update(dt, t) { if (st.view) st.view.frame(dt, t); if (st.tickT > 0) { st.tickT -= dt; if (st.tickT <= 0) ui.ticker.classList.remove('on'); } },
    resize() { if (st.view) { st.view.resize(); } },
  });

  function stop() {
    st.token++; st.waiter = null; st.busy = true;
    if (st.view) st.view.dispose();
    closeOverlay(true); hideTip();
    setIntensity(0);                                            // the music's tension level belongs to this battle only
  }

  function start(sess) {
    st.token++;
    const token = st.token;
    st.sess = sess; st.S = sess.S; st.battle = sess.battle; st.me = mySide(sess.battle);
    st.auto = false; st.summary = false; st.summaryBtn = null; st.waiter = null; st.busy = true; st.special = null; st.missileOn = true; st.hover = null; st.overlay = null; st.logIdx = 0; st.roundOrder = []; st.cur = null; st.moves = []; st.targets = [];
    const Cb = E();
    const B = st.B = Cb.create(st.S, sess.battle, M.RNG.create(sess.seed || String(sess.battle.seed)));
    if (!st.view) { st.view = CF().createView(ui.canvas); }
    const view = st.view;
    view.resize();
    view.setSpeed(M.Settings.get('animSpeed') === undefined ? 1 : M.Settings.get('animSpeed'));
    view.load({ B, battle: sess.battle, S: sess.S });
    for (const k in ui.spd) ui.spd[k].classList.toggle('active', +k === (+M.Settings.get('animSpeed')));
    buildOrderChips();
    // total hit points per side (for the music intensity and the side bars)
    st.hp0 = [1, 1]; for (const u of B.units) st.hp0[u.side] += u.hp2 * u.count;
    ui.ticker.classList.remove('on');
    ui.canvas.className = 'cb-canvas wait';
    updateSides(); updateInfo(); updateButtons();
    setIntensity(0.12);
    run(token).catch(err => { console.error('[Combat] battle loop failed', err); UI.toast('Combat error: ' + (err && err.message), 'bad', 8000); });
  }

  // ---- the battle loop -------------------------------------------------------------------------------------------------------------------------------
  const alive = u => !u.gone && u.count > 0;
  const isHumanUnit = u => st.B.sides[u.side].ctl === 'human';

  async function run(token) {
    const Cb = E(), B = st.B, view = st.view;
    const ok = () => st.token === token;
    await playEvents(B.pend.splice(0), true);
    while (ok() && !B.over) {
      if (B.active === null) { await playEvents(Cb.endRound(B), true); continue; }
      const u = B.units[B.active];
      if (isHumanUnit(u) && !st.auto) await playerTurn(u, token); else await aiTurn(u, token);
      if (!ok()) return;
    }
    if (!ok()) return;
    await finishBattle(token);
    void view;
  }

  function trackEvents(evs) {
    for (const e of evs) {
      if (e.type === 'round-start') st.roundOrder = e.order.slice();
      else if (e.type === 'invalid') UI.toast(e.reason ? e.reason.charAt(0).toUpperCase() + e.reason.slice(1) : 'Not possible', 'warn');
    }
  }
  async function playEvents(evs, sync) {
    trackEvents(evs);
    if (!evs.length) { if (sync) afterPlay(); return; }
    await st.view.play(evs);
    if (sync) afterPlay();
  }
  function afterPlay() {
    const B = st.B;
    st.view.sync(B);
    updateTicker(); updateSides(); updateOrder();
    const tot = [1, 1]; for (const u of B.units) tot[u.side] += unitHp(u);
    setIntensity(0.12 + 0.88 * clamp(1 - (tot[0] + tot[1]) / (st.hp0[0] + st.hp0[1]), 0, 1));
  }

  async function aiTurn(u, token) {
    const Cb = E(), B = st.B;
    clearTurnUi();
    const out = Cb.aiTurn(B, u.side);
    for (const o of out) { if (st.token !== token) return; trackEvents(o.events); await st.view.play(o.events); }
    afterPlay();
    if (B.active === u.id && !B.over) await playEvents(Cb.act(B, u.id, { type: 'done' }), true);
  }

  async function playerTurn(u, token) {
    const Cb = E(), B = st.B, id = u.id;
    while (st.token === token && !B.over && B.active === id && !st.auto) {
      refreshTurn();
      const action = await waitAction();
      if (st.token !== token) return;
      if (!action) continue;
      if (action.type === '__auto') break;
      let evs;
      if (action.type === '__retreatAll') { evs = Cb.retreatAll(B, st.me); evs.ok = true; await playEvents(evs, false); evs = Cb.act(B, id, { type: 'retreat' }); }
      else evs = Cb.act(B, id, action);
      if (evs.ok === false) { trackEvents(evs); st.view.setHighlights({}); continue; }
      st.special = null;
      clearTurnUi();
      await playEvents(evs, true);
    }
    if (st.auto && st.token === token && !B.over) await doAutoPlay(token);
  }

  function waitAction() {
    const p = new Promise(res => { st.waiter = res; });
    st.busy = false; ui.canvas.className = 'cb-canvas';
    updateButtons();
    if (st.hover) onHover(st.hover);
    return p;
  }
  function submit(action) {
    if (!st.waiter || st.busy) return false;
    const w = st.waiter; st.waiter = null; st.busy = true; hideTip();
    w(action); return true;
  }
  function clearTurnUi() { st.busy = true; st.special = null; st.moves = []; st.targets = []; if (st.view) st.view.setHighlights({}); updateButtons(); if (ui) ui.canvas.className = 'cb-canvas wait'; }

  async function doAutoPlay(token) {
    const Cb = E(), B = st.B;
    clearTurnUi();
    Cb.autoPlay(B);
    if (st.token !== token) return;
    if (st.view.busy()) st.view.skip();
    st.view.sync(B);
    UI.sfx('explosion_big', { vol: 0.5 });
    afterPlay();
  }
  function doAuto() {
    if (st.summary) return;
    if (st.waiter && !st.busy) { st.auto = true; submit({ type: '__auto' }); }
    else if (st.view && st.view.busy()) { st.auto = true; }
  }

  async function finishBattle(token) {
    const Cb = E(), B = st.B;
    const res = Cb.finish(B);
    st.view.sync(B);
    clearTurnUi(); updateAll();
    await new Promise(r => setTimeout(r, st.view.isInstant() ? 0 : 450));
    if (st.token !== token) return;
    await showSummary(res);
    if (st.token !== token) return;
    const sess = st.sess;
    stop();
    UI.Screens.go(sess.from && UI.Screens.has(sess.from) ? sess.from : 'galaxy');
    setTimeout(() => { if (UI.Galaxy && UI.Galaxy.showDefault && UI.Screens.current && UI.Screens.current.id === 'galaxy') UI.Galaxy.showDefault(); }, 0);
    sess.resolve(res);
  }
  function showSummary(res) {
    return new Promise(resolve => {
      st.summary = true;
      const node = buildSummary(res, st.battle, st.S, () => { st.summary = false; st.summaryBtn = null; closeOverlay(); resolve(); });
      st.summaryBtn = node.btn;
      const panel = UI.panel(null, node);
      openOverlay(h('div.cb-ov', panel), 'summary');
      UI.sfx(res.winner === st.me ? 'confirm' : 'alert', { vol: 0.7 });
    });
  }

  // ---- music ---------------------------------------------------------------------------------------------------------------------------------------------
  let lastInt = -1;
  function setIntensity(x) {
    if (Math.abs(x - lastInt) < 0.03) return; lastInt = x;
    try { if (M.Audio && M.Audio.Music && M.Audio.Music.setIntensity) M.Audio.Music.setIntensity(x); } catch (e) { /* audio optional */ }
  }

  // ---- turn UI ---------------------------------------------------------------------------------------------------------------------------------------------
  function computeTargets(u) {
    const Cb = E(), B = st.B;
    if (st.special) return Cb.targets(B, u.id, 'special').filter(t => t.devices && t.devices.indexOf(st.special.device) >= 0);
    if (u.kind === 'planet' || st.missileOn) return Cb.targets(B, u.id, 'all');
    const a = Cb.targets(B, u.id, 'beam'), b = Cb.targets(B, u.id, 'bomb'), seen = new Set(a.map(t => t.id));
    for (const t of b) if (!seen.has(t.id)) a.push(t);
    return a;
  }
  function refreshTurn() {
    const B = st.B, Cb = E(), u = B.active !== null ? B.units[B.active] : null;
    st.cur = u;
    if (!u || B.over) { st.moves = []; st.targets = []; st.view.setHighlights({}); updateAll(); return; }
    st.moves = u.kind === 'planet' || st.special ? [] : Cb.legalMoves(B, u.id);
    st.targets = computeTargets(u);
    st.view.setActive(u.id);
    st.view.setHighlights({ moves: st.moves, targets: st.targets.map(t => ({ id: t.id, hit: t.hitChance })), hover: st.hover, path: true });
    updateAll();
    ui.canvas.className = 'cb-canvas';
    if (st.hover) onHover(st.hover);
  }
  function updateAll() { updateButtons(); updateInfo(); updateOrder(); updateSides(); }

  function actionable(u) {
    const sp = u.sp || {}, out = [];
    if (sp.stasis) out.push({ id: 'stasis', label: 'Stasis Field', range: 1, need: 'target', desc: 'Freeze an adjacent ship for a round' });
    if (sp.pulsar) out.push({ id: 'pulsar', label: sp.pulsar === 2 ? 'Ionic Pulsar' : 'Energy Pulsar', range: 1, need: 'none', desc: 'Damage every adjacent group, friend or foe' });
    if (sp.stream) out.push({ id: 'stream', label: sp.stream === 2 ? 'Neutron Stream Projector' : 'Ion Stream Projector', range: 2, need: 'target', desc: 'Strip armor from a ship within 2 squares' });
    if (sp.bh) out.push({ id: 'blackhole', label: 'Black Hole Generator', range: 1, need: 'target', desc: 'Swallow part of an adjacent stack' });
    if (sp.wd) out.push({ id: 'dissipator', label: 'Warp Dissipator', range: 3, need: 'target', desc: 'Slow a ship within 3 squares' });
    if (sp.tn) out.push({ id: 'technull', label: 'Technology Nullifier', range: 4, need: 'target', desc: 'Cut a target\'s attack and missile defence' });
    if (sp.repulsor) out.push({ id: 'repulsor', label: 'Repulsor Beam', range: 1, need: 'target', desc: 'Push an adjacent ship back one square' });
    return out;
  }
  function usedDevice(u, id) { return !!(u.st && u.st.used && u.st.used[id]); }

  function updateButtons() {
    if (!ui) return;
    const B = st.B, u = st.cur, b = ui.b, active = !!(u && B && !B.over && !st.busy && st.waiter && isHumanUnit(u));
    const set = (btn, on, tip) => { btn.disabled = !on; if (tip !== undefined) UI.setTip(btn, tip); };
    if (!B) { for (const k in b) b[k].disabled = true; return; }
    const hasPlanet = !!B.planet, hasScanner = !!B.sides[st.me].scanner;
    const mis = !!(u && u.weapons.some(w => (w.kind === 'missile' || w.kind === 'torpedo') && w.count > 0));
    const specials = u ? actionable(u).filter(d => !usedDevice(u, d.id)) : [];
    const canTele = !!(u && u.sp && u.sp.teleport && u.st.subspace === 1 && !(u.st.used && u.st.used.teleport));
    set(b.auto, !st.summary && !B.over);
    set(b.planet, hasPlanet);
    set(b.scan, hasScanner && !B.over, hasScanner ? 'Battle scanner: full specs of every ship (S)' : 'Needs a ship with a Battle Scanner');
    b.missile.disabled = !(active && (u.kind === 'planet' || mis));
    if (u && u.kind === 'planet') { const w = u.weapons[u.planetSlot | 0]; b.missile.firstChild && (b.missile.childNodes.forEach(n => { if (n.nodeType === 3) n.nodeValue = 'Base: ' + (w ? w.name.replace(/ Missile| Rocket/, '') : 'Missiles'); })); b.missile.classList.add('on'); UI.setTip(b.missile, 'Switch the weapon the missile bases fire (M)'); }
    else { b.missile.childNodes.forEach(n => { if (n.nodeType === 3) n.nodeValue = 'Missiles'; }); b.missile.classList.toggle('on', st.missileOn && mis); UI.setTip(b.missile, 'Missiles and torpedoes ' + (st.missileOn ? 'ON' : 'OFF') + ' — click to toggle (M)'); }
    b.special.disabled = !(active && (specials.length || canTele));
    b.special.classList.toggle('on', !!st.special);
    b.retreat.disabled = !(active && u.kind !== 'planet' && u.speed - u.unman >= 1 && !(u.st.stasis > 0));
    b.wait.disabled = !(active && !u.st.waited && B.order.length > 0);
    b.done.disabled = !active;
    b.auto.disabled = B.over || st.summary;
  }

  function toggleMissile() {
    const u = st.cur, B = st.B;
    if (!u || st.busy) return;
    if (u.kind === 'planet') { submit({ type: 'planet-weapon', slot: 1 - (u.planetSlot | 0) }); return; }
    if (!u.weapons.some(w => (w.kind === 'missile' || w.kind === 'torpedo') && w.count > 0)) return;
    st.missileOn = !st.missileOn; UI.sfx('toggle', { rate: st.missileOn ? 1 : 0.8 });
    void B; refreshTurn();
  }
  function doRetreat(all) {
    const u = st.cur; if (!u || st.busy || u.kind === 'planet') return;
    if (all) submit({ type: '__retreatAll' }); else submit({ type: 'retreat' });
  }
  function openSpecial() {
    const u = st.cur, B = st.B; if (!u || st.busy || !B) return;
    const devs = actionable(u).filter(d => !usedDevice(u, d.id)), canTele = u.sp && u.sp.teleport && u.st.subspace === 1 && !(u.st.used && u.st.used.teleport);
    if (st.special) { cancelSpecial(); return; }
    if (!devs.length && !canTele) return;
    if (devs.length === 1 && !canTele) { chooseDevice(devs[0]); return; }
    const list = h('div.col', { style: { gap: '.35rem', minWidth: '19rem' } });
    for (const d of devs) list.appendChild(UI.button(d.label + (d.need === 'target' ? '  (range ' + d.range + ')' : ''), () => { pr.close(d); }, { block: true, tip: d.desc }));
    if (canTele) list.appendChild(h('div.dim.small', { style: { marginTop: '.2rem' } }, 'Sub Space Teleporter: click any empty cell to jump there.'));
    const pr = UI.modal({ title: 'Special devices', body: list, buttons: [{ label: 'Cancel', value: null }], width: '24rem' });
    pr.then(d => { if (d) chooseDevice(d); });
  }
  function chooseDevice(d) {
    const u = st.cur; if (!u) return;
    if (d.need === 'none') { submit({ type: 'special', device: d.id }); return; }
    st.special = { device: d.id, label: d.label, range: d.range };
    refreshTurn();
    if (!st.targets.length) { UI.toast(d.label + ': no target within ' + d.range + (d.range > 1 ? ' squares' : ' square'), 'warn'); st.special = null; refreshTurn(); return; }
    UI.toast(d.label + ': click a highlighted ship (Esc cancels)', null, 2200);
    ui.b.special.classList.add('on');
  }
  function cancelSpecial() { st.special = null; refreshTurn(); }

  // ---- input -------------------------------------------------------------------------------------------------------------------------------------------
  function unitAtCell(B, x, y) {
    for (const u of B.units) {
      if (u.kind === 'planet') { if (u.x === x && u.y === y && B.planet) return u; continue; }
      if (alive(u) && u.x === x && u.y === y) return u;
    }
    return null;
  }
  function onClick(cell) {
    const B = st.B; if (!B || st.busy || !st.waiter || !st.cur) return;
    const u = st.cur, t = unitAtCell(B, cell.x, cell.y);
    if (t && t.side !== u.side) {
      const tg = st.targets.find(q => q.id === t.id);
      if (!tg) { UI.sfx('error', { vol: 0.5 }); const d = Math.max(Math.abs(u.x - t.x), Math.abs(u.y - t.y)); st.view.floatText(t.x, t.y, 'Out of range (' + d + ')', '#c8d2f0', 12); return; }
      if (st.special) submit({ type: 'special', device: st.special.device, target: t.id });
      else submit({ type: 'fire', target: t.id, weapons: u.kind === 'planet' || st.missileOn ? 'all' : 'beams' });
      return;
    }
    if (!t && !st.special) {
      const mv = st.moves.find(c => c.x === cell.x && c.y === cell.y);
      if (mv) { submit({ type: 'move', x: cell.x, y: cell.y }); return; }
      UI.sfx('error', { vol: 0.35 });
    }
  }
  function onRight() { if (st.overlay) closeOverlay(); else if (st.special) cancelSpecial(); }
  function onHover(cell) {
    st.hover = cell;
    const B = st.B; if (!B || !st.view) return;
    st.view.setHover(cell, !!st.cur && !st.busy);
    const t = cell ? unitAtCell(B, cell.x, cell.y) : null;
    // cursor
    let cls = 'cb-canvas' + (st.busy ? ' wait' : '');
    if (!st.busy && cell) { if (t && st.targets.some(q => q.id === t.id)) cls = 'cb-canvas hit'; else if (!t && st.moves.some(c => c.x === cell.x && c.y === cell.y)) cls = 'cb-canvas go'; }
    ui.canvas.className = cls;
    updateInfo(t);
    showTip(t, cell);
  }

  // ---- tooltip ---------------------------------------------------------------------------------------------------------------------------------------------
  let tipPos = { x: 0, y: 0 };
  function placeTip(e) {
    tipPos.x = e.clientX; tipPos.y = e.clientY;
    if (ui.tip.style.display !== 'block') return;
    const r = ui.field.getBoundingClientRect(), w = ui.tip.offsetWidth, hh = ui.tip.offsetHeight;
    let x = e.clientX - r.left + 18, y = e.clientY - r.top + 16;
    if (x + w > r.width - 6) x = e.clientX - r.left - w - 14;
    if (y + hh > r.height - 6) y = e.clientY - r.top - hh - 12;
    ui.tip.style.left = Math.max(4, x) + 'px'; ui.tip.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() { if (ui) ui.tip.style.display = 'none'; }
  function showTip(t, cell) {
    if (!t || st.busy || !st.cur || st.overlay) { hideTip(); return; }
    const B = st.B, u = st.cur, enemy = t.side !== u.side, col = unitColor(t);
    const hpMax = t.hp2 * (t.kind === 'planet' ? Math.max(t.count, B.planet ? B.planet.bases0 : t.count) : (B.sides[t.side].initial[t.slot] | 0 || t.count));
    const hp = unitHp(t), scanner = !!B.sides[st.me].scanner;
    const box = [];
    box.push(h('div.t1', h('span.empire-dot', { style: { '--c': col } }), t.name, h('span.c', t.kind === 'planet' ? (t.count ? t.count + ' bases' : 'no bases') : '×' + t.count)));
    box.push(h('div.hp', UI.bar(hpMax > 0 ? hp / hpMax : 0, { color: hp / Math.max(1, hpMax) > 0.6 ? 'var(--leaf)' : hp / Math.max(1, hpMax) > 0.3 ? 'var(--ember)' : 'var(--rose)' })));
    box.push(h('div.row', h('span.mut', 'Hit points'), h('span.v', U.fmt ? U.fmt(hp) : hp, ' / ', U.fmt ? U.fmt(hpMax) : hpMax)));
    if (!enemy || scanner) box.push(h('div.row.mut', h('span', 'Attack ' + t.comp + ' · Def ' + t.def + '/' + t.mdef), h('span', (t.absorb ? 'Shield ' + t.absorb + ' · ' : '') + 'Speed ' + t.speed)));
    if (enemy) {
      const tg = st.targets.find(q => q.id === t.id), d = Math.max(Math.abs(u.x - t.x), Math.abs(u.y - t.y));
      if (tg) {
        const hit = h('div.hit');
        if (st.special) hit.appendChild(h('div.ok', 'In range (' + tg.range + ') — ' + st.special.label));
        else {
          hit.appendChild(h('div', h('span.big', { class: tg.hitChance >= 0.6 ? 'ok' : tg.hitChance >= 0.35 ? 'warn' : 'bad' }, pct(tg.hitChance)), ' ', h('span.mut', 'to hit · range ' + tg.range)));
          for (const c of tg.chances || []) { const w = u.weapons[c.slot]; if (w) hit.appendChild(h('div.row', h('span', w.name + ' ×' + (w.count * u.count)), h('span.v', pct(c.hit)))); }
          if (tg.cloaked) hit.appendChild(h('div.mut', 'Cloaked: +50 to the miss chance'));
          hit.appendChild(h('div.mut', 'Click to fire every weapon in reach'));
        }
        box.push(hit);
      } else box.push(h('div.hit', h('div.warn', 'Out of range'), h('div.mut', 'Distance ' + d + ' — move closer to fire')));
    } else if (t.id === u.id) {
      box.push(h('div.hit.mut', 'Moves left: ' + u.actman));
    }
    UI.mount(ui.tip, box);
    ui.tip.style.display = 'block';
    placeTip({ clientX: tipPos.x, clientY: tipPos.y });
  }
  function unitColor(u) { const s = st.battle.sides[u.side]; return sideCol(st.battle, st.S, u.side); }

  // ---- info panel (bottom left) ---------------------------------------------------------------------------------------------------------------------
  function weaponChips(u, B) {
    const out = [];
    u.weapons.forEach((w, i) => {
      if (w.count <= 0) return;
      const mis = w.kind === 'missile' || w.kind === 'torpedo', bomb = w.kind === 'bomb' || w.kind === 'bio';
      const spent = w.numfire <= 0 || w.shots === 0, tot = w.count * (u.kind === 'planet' ? 1 : u.count);
      let m = 'r' + (w.range >= 40 ? '∞' : w.range);
      if (w.shots > 0) m += ' · ' + w.shots + (mis ? ' volley' + (w.shots > 1 ? 's' : '') : ' left');
      const sel = u.kind === 'planet' && (u.planetSlot | 0) === i;
      out.push(h('span.cb-wp' + (mis ? '.mis' : bomb ? '.bomb' : '') + (spent ? '.spent' : '') + (sel ? '.sel' : ''), { tip: w.name + ': ' + w.dmin + (w.dmax !== w.dmin ? '–' + w.dmax : '') + ' damage' + (w.acc ? ', +' + w.acc + ' accuracy' : '') + (w.half ? ', halves shields' : '') + (w.stream ? ', streaming' : '') }, UI.icon(mis ? 'missile' : bomb ? 'bomb' : 'beam'), w.name, ' ×' + tot, h('span.m', m)));
    });
    void B;
    return out;
  }
  function updateInfo(hoverUnit) {
    if (!ui || !st.B) return;
    const B = st.B, u = hoverUnit || st.cur;
    if (!u) { UI.mount(ui.who, h('span.dim', B.over ? 'Battle over' : 'Waiting…')); UI.mount(ui.stats, null); UI.mount(ui.weps, null); return; }
    const mine = u.side === st.me, scanner = !!B.sides[st.me].scanner, show = mine || scanner || u.kind === 'planet';
    const hpMax = u.hp2 * (u.kind === 'planet' ? Math.max(1, B.planet ? B.planet.bases0 : u.count) : (B.sides[u.side].initial[u.slot] | 0 || u.count));
    UI.mount(ui.who, h('span.empire-dot', { style: { '--c': unitColor(u) } }), h('span.nm', u.name), u.kind === 'planet' ? h('span.ct', u.count + ' bases') : h('span.ct', '×' + u.count),
      u === st.cur && !hoverUnit ? h('span.tag.me', 'Acting') : h('span.tag' + (mine ? '.me' : '.foe'), mine ? 'Yours' : 'Enemy'), h('span.hp', 'HP ', h('b', U.fmt ? U.fmt(unitHp(u)) : unitHp(u)), ' / ', U.fmt ? U.fmt(hpMax) : hpMax));
    const stats = [];
    if (show) {
      const chip = (icon, label, val, tip) => h('span.cb-st', { tip }, UI.icon(icon), label + ' ', h('b', val));
      stats.push(chip('target', 'Attack', u.comp, 'Battle computer level: +1 attack = +10% to hit'));
      stats.push(chip('defense', 'Def', u.def + ' / ' + u.mdef, 'Beam defense / missile defense'));
      if (u.absorb) stats.push(chip('shield', 'Shield', u.absorb, 'Damage absorbed from every hit'));
      stats.push(chip('speed', 'Speed', u.speed, 'Squares per round'));
      if (u === st.cur && !hoverUnit && u.kind !== 'planet') stats.push(chip('range', 'Moves', u.actman, 'Squares of movement left this turn'));
      if (u.repair) stats.push(chip('repair', 'Repair', u.repair + '%', 'Heals this share of one ship per turn'));
      if (u.misshield) stats.push(chip('shield', 'Anti-missile', u.misshield + '%', 'Chance to shoot down an incoming missile (minus its weapon level)'));
      if (u.st && u.st.cloak === 1) stats.push(chip('cloak', 'Cloaked', '+5', 'Cloaking device: +5 defense until it fires'));
      if (u.sp && u.sp.scanner) stats.push(chip('eye', 'Scanner', '', 'Battle scanner'));
    }
    UI.mount(ui.stats, stats);
    UI.mount(ui.weps, show ? weaponChips(u, B) : h('span.dim.small', 'Scan the enemy for details'));
  }

  // ---- initiative strip + side summaries ---------------------------------------------------------------------------------------------------------------
  function buildOrderChips() {
    ui.chips.clear(); UI.clear(ui.order);
    const B = st.B;
    ui.rd = h('span.rd', 'Round 1'); ui.order.appendChild(ui.rd);
    for (const u of B.units) {
      const col = unitColor(u), chip = h('div.cb-chip' + (u.kind === 'planet' ? '.pl' : ''), { style: { '--c': col }, tip: u.name });
      if (u.kind === 'planet') chip.appendChild(UI.icon('defense', 'pi'));
      else chip.appendChild(shipCanvas(B.sides[u.side].race === 'monster' ? 'sakkra' : B.sides[u.side].race, u.kind === 'monster' ? 3 : u.hull, col, designFlags(st.battle.sides[u.side].designs[u.slot]), 40, 28));
      chip.appendChild(h('span.n', { style: { color: '#fff' } }, u.count));
      chip.addEventListener('mouseenter', () => { st.view && st.view.setActive; });
      ui.chips.set(u.id, chip);
    }
  }
  function updateOrder() {
    if (!ui || !st.B) return;
    const B = st.B, seq = [];
    ui.rd.textContent = 'Round ' + B.round;
    const pending = (B.active !== null ? [B.active] : []).concat(B.order);
    const done = st.roundOrder.filter(id => pending.indexOf(id) < 0 && alive(B.units[id]));
    for (const id of done) seq.push([id, 'done']);
    for (let i = 0; i < pending.length; i++) seq.push([pending[i], i === 0 && B.active !== null ? 'active' : '']);
    const keep = new Set(seq.map(s => s[0]));
    for (const [id, chip] of ui.chips) {
      if (!keep.has(id)) { chip.classList.add('dead'); if (chip.parentNode === ui.order) ui.order.removeChild(chip); }
    }
    for (const [id, cls] of seq) {
      const chip = ui.chips.get(id), u = B.units[id]; if (!chip || !u) continue;
      chip.classList.remove('dead', 'done', 'active'); if (cls) chip.classList.add(cls);
      chip.querySelector('.n').textContent = u.kind === 'planet' ? u.count : '×' + u.count;
      ui.order.appendChild(chip);                                     // re-appending moves the node: this is the reorder
    }
  }
  function updateSides() {
    if (!ui || !st.B) return;
    const B = st.B;
    for (let s = 0; s < 2; s++) {
      const box = s === 0 ? ui.sideL : ui.sideR, sd = B.sides[s];
      let ships = 0, hp = 0, bases = 0, sdn = B.units.filter(u => u.side === s);
      for (const u of sdn) { if (u.kind === 'planet') bases = u.count; else if (alive(u)) ships += u.count; hp += unitHp(u); }
      const lost = sd.initial.reduce((a, b) => a + b, 0) - ships - sdn.reduce((a, u) => a + (u.kind === 'planet' || !u.left ? 0 : u.count), 0);
      const col = sideCol(st.battle, st.S, s), isMe = s === st.me;
      let bar = box.querySelector('.bar');
      if (!bar) { bar = UI.bar(1, { color: col }); }
      bar.set(hp / Math.max(1, st.hp0[s]));
      UI.mount(box, h('span.cb-dot', { style: { '--c': col } }), h('div.tx', h('div.nm', sideTitle(st.battle, s)),
        h('div.sb', h('b', ships), ' ship' + (ships === 1 ? '' : 's'), bases || B.planet && B.planetSide === s ? [' · ', h('b', bases), ' base' + (bases === 1 ? '' : 's')] : null, lost > 0 ? h('span', { style: { color: 'var(--rose)' } }, '  (−' + lost + ')') : null, ' · ', isMe ? 'you' : (sd.role || '')), bar));
    }
  }

  // ---- ticker + log -----------------------------------------------------------------------------------------------------------------------------------
  function updateTicker() {
    const B = st.B; if (!B || !ui) return;
    if (B.log.length > st.logIdx) {
      const line = B.log[B.log.length - 1];
      ui.ticker.textContent = line; ui.ticker.classList.add('on'); st.tickT = 4.5;
      st.logIdx = B.log.length;
      if (st.overlay === 'log') renderLog();
    }
  }
  function toggleLog() { if (st.overlay === 'log') closeOverlay(); else if (!st.overlay && st.B) { openOverlay(h('div.cb-ov', { onclick: e => { if (e.target.classList.contains('cb-ov')) closeOverlay(); } }, UI.panel('Battle log', h('div.scrl.cb-logb', { style: { maxHeight: '60vh', minWidth: '30rem', fontSize: '.92rem', lineHeight: '1.5' } }))), 'log'); renderLog(); } }
  function renderLog() { const b = ui.ov && ui.ov.querySelector('.cb-logb'); if (!b) return; UI.mount(b, st.B.log.map(l => h('div', l))); b.scrollTop = b.scrollHeight; }

  // ---- overlays (scan, planet, summary, log) -----------------------------------------------------------------------------------------------------
  function openOverlay(node, name) {
    closeOverlay(true);
    ui.ov = node; st.overlay = name;
    if (name === 'planet') ui.field.appendChild(node); else ui.field.appendChild(node);
    hideTip();
    updateButtons();
    ui.b.scan.classList.toggle('on', name === 'scan'); ui.b.planet.classList.toggle('on', name === 'planet');
  }
  function closeOverlay(quiet) {
    if (ui && ui.ov) { ui.ov.remove(); ui.ov = null; }
    st.overlay = null;
    if (ui && !quiet) { ui.b.scan.classList.remove('on'); ui.b.planet.classList.remove('on'); }
  }
  function toggleOverlay(name) {
    if (st.summary) return;
    if (st.overlay === name) { closeOverlay(); UI.sfx('close', { vol: 0.5 }); return; }
    if (name === 'scan') { if (!st.B.sides[st.me].scanner) { UI.toast('You need a ship with a Battle Scanner to scan', 'warn'); return; } UI.sfx('scan', { vol: 0.6 }); openOverlay(buildScan(), 'scan'); }
    else if (name === 'planet') { if (!st.B.planet) { UI.toast('There is no planet in this battle', 'warn'); return; } UI.sfx('open', { vol: 0.5 }); openOverlay(buildPlanetInfo(), 'planet'); }
  }

  const SPECIAL_LABEL = { scanner: 'Battle Scanner', cloak: 'Cloaking Device', stasis: 'Stasis Field', bh: 'Black Hole Generator', tn: 'Technology Nullifier', wd: 'Warp Dissipator', repulsor: 'Repulsor Beam', teleport: 'Sub Space Teleporter', oracle: 'Oracle Interface', disp: 'Displacement Device' };
  function specialList(u) {
    const sp = u.sp || {}, out = [];
    for (const k in SPECIAL_LABEL) if (sp[k]) out.push(SPECIAL_LABEL[k]);
    if (sp.pulsar) out.push(sp.pulsar === 2 ? 'Ionic Pulsar' : 'Energy Pulsar');
    if (sp.stream) out.push(sp.stream === 2 ? 'Neutron Stream Projector' : 'Ion Stream Projector');
    if (u.misshield) out.push(u.misshield >= 100 ? 'Lightning Shield' : u.misshield >= 75 ? 'Zyro Shield' : 'Anti-Missile Rockets');
    if (u.repair) out.push('Auto repair ' + u.repair + '%');
    return out;
  }
  function buildScan() {
    const B = st.B, Cb = E();
    const wrap = h('div.cb-scan'), tabs = [['Enemy', 1 - st.me], ['Your fleet', st.me]];
    let cur = tabs[0][1];
    const body = h('div.scrl');
    const render = () => {
      const cols = [
        { key: 'name', label: 'Ship', sort: false, fmt: r => h('span.nm', r.name) },
        { key: 'count', label: 'Qty', align: 'c', sort: false, fmt: r => h('span.num', r.count) },
        { key: 'comp', label: 'Attack', align: 'c', sort: false, fmt: r => h('span.num', r.comp) },
        { key: 'def', label: 'Beam def.', align: 'c', sort: false, fmt: r => h('span.num', r.def) },
        { key: 'mdef', label: 'Missile def.', align: 'c', sort: false, fmt: r => h('span.num', r.mdef) },
        { key: 'absorb', label: 'Shield', align: 'c', sort: false, fmt: r => h('span.num', r.absorb || '—') },
        { key: 'hp', label: 'Hit points', align: 'c', sort: false, fmt: r => h('span.num' + (r.hploss > 0 || r.hp1 < r.hp2 ? '.dmg' : ''), Math.max(0, r.hp1 - r.hploss), ' / ', r.hp2, r.count > 1 ? h('div.dim.small', 'total ' + (U.fmt ? U.fmt(r.hp) : r.hp)) : null) },
        { key: 'speed', label: 'Speed', align: 'c', sort: false, fmt: r => h('span.num', r.speed) },
        { key: 'weapons', label: 'Weapons', sort: false, fmt: r => h('div.wl', r.weapons.length ? r.weapons.map(w => { const mis = w.kind === 'missile' || w.kind === 'torpedo', bomb = w.kind === 'bomb' || w.kind === 'bio'; return h('div.ln' + (mis ? '.mis' : bomb ? '.bomb' : ''), UI.icon(mis ? 'missile' : bomb ? 'bomb' : 'beam'), w.name + ' ×' + w.count * (r.kind === 'planet' ? 1 : r.count), h('span.dim', ' ' + w.dmin + (w.dmax > w.dmin ? '–' + w.dmax : '') + ' dmg · r' + (w.range >= 40 ? '∞' : w.range) + (w.shots > 0 ? ' · ' + w.shots + (mis ? ' volley' + (w.shots === 1 ? '' : 's') : ' left') : ''))); }) : h('span.dim', 'unarmed')) },
        { key: 'specials', label: 'Specials', sort: false, fmt: r => h('div.sp', r.specials.length ? r.specials.join(', ') : h('span.dim', '—')) },
      ];
      const rows = [];
      for (const u of B.units) if (u.side === cur) { const inf = Cb.scanInfo(B, u.id); const uu = B.units[u.id]; inf.sp = uu.sp; inf.hp2 = uu.hp2; inf.specials = specialList(uu); inf.hp1 = uu.hp1; inf.hploss = uu.hploss; rows.push(inf); }
      const tbl = UI.table(cols, rows, { rowClass: r => (r.count <= 0 ? 'dead' : '') });
      UI.mount(body, tbl);
    };
    const bar = h('div.row', { style: { marginBottom: '.5rem' } }, tabs.map(([l, side]) => { const b = UI.button(l, () => { cur = side; Array.from(bar.children).forEach(c => c.classList.remove('active')); b.classList.add('active'); render(); }, { small: true, active: side === cur }); return b; }),
      h('span.dim.small', { style: { marginLeft: 'auto' } }, 'Battle scanner — Esc closes'));
    wrap.appendChild(bar); wrap.appendChild(body); render();
    const ov = h('div.cb-ov', { onclick: e => { if (e.target.classList.contains('cb-ov')) closeOverlay(); } }, UI.panel('Scan', wrap, { icon: 'eye', sub: 'full specification of every group' }));
    return ov;
  }
  function buildPlanetInfo() {
    const B = st.B, pu = B.units[0], P = B.planet, pl = st.battle.planet, ownerCol = sideCol(st.battle, st.S, P.side);
    const kv = (v, l, cls) => h('div', h('span.v' + (cls ? '.' + cls : ''), v), h('span.l', l));
    const w = pu && pu.weapons ? pu.weapons : [], slot = pu ? pu.planetSlot | 0 : 0;
    const inflight = B.missiles.filter(m => m.shooter === (pu ? pu.id : -9)).reduce((a, m) => a + m.n, 0);
    const node = h('div.cb-pinfo', { onclick: () => closeOverlay() }, UI.panel(null, h('div',
      h('div.top', planetCanvas(st.battle, st.S, 46), h('div', h('div.nm', P.name), h('div.own', h('span.empire-dot', { style: { '--c': ownerCol } }), st.battle.sides[P.side].name + (P.side === st.me ? ' (yours)' : '') + (pl ? ' · max population ' + pl.maxPop : '')))),
      h('div.cb-kv', kv(P.pop, 'Population', P.popKilled ? 'bad' : ''), kv(P.factories, 'Factories', P.factoriesKilled ? 'bad' : ''), kv(pu ? pu.count : 0, 'Missile bases', pu && pu.count < P.bases0 ? 'bad' : ''), kv(SHIELD_CLASS[P.shield] || (P.shield ? P.shield : '—'), 'Planet shield', 'az')),
      h('div.cb-kv', { style: { marginTop: '.35rem' } }, kv(pu ? pu.hp1 : 0, 'HP per base'), kv(pu ? unitHp(pu) : 0, 'Total base HP'), kv(pu ? pu.comp : '—', 'Attack level'), kv(pu ? pu.mdef : '—', 'Missile defense')),
      h('div.ln', 'Defense: ', h('b', pu ? 'absorbs ' + pu.absorb + ' per hit' : '—'), ' · beam defense ', h('b', pu ? pu.def : '—'), B.nebula ? ' · nebula: shields are down' : ''),
      h('div.ln', 'Bases fire: ', w.map((x, i) => h('span', { style: { marginRight: '.6rem', color: i === slot ? 'var(--brass-hi)' : '' } }, (i === slot ? '▶ ' : '') + x.name + ' ×' + x.count * (pu ? pu.count : 0))), inflight ? h('span', ' · ', h('b', inflight), ' missiles in flight') : null))));
    return node;
  }

  // ---- speed ---------------------------------------------------------------------------------------------------------------------------------------------
  function setSpeed(v) {
    try { M.Settings.set('animSpeed', v); } catch (e) { /* ignore */ }
    if (st.view) { st.view.setSpeed(v); if (v === 0 && st.view.busy()) st.view.skip(); }
    for (const k in ui.spd) ui.spd[k].classList.toggle('active', +k === v);
  }

  Combat.session = () => (st.B && st.token ? { B: st.B, battle: st.battle, S: st.S, view: st.view } : null);

  // ===================================================================================================================================================
  //  DEMO FIXTURES (Design API) — also used by ?dev=1&screen=combat
  // ===================================================================================================================================================
  Combat.demo = function (o) {
    o = o || {};
    if (!G.S) { try { G.devBoot(new URLSearchParams({ size: 'medium', opp: '3', race: 'psilon', seed: 'combat-demo' })); } catch (e) { console.error(e); } }
    const S = G.S, Cb = E(), D = M.Sim.Design, K = M.Data.Components, I = K.idx, scn = o.scn || 'planet';
    const me = S.empires[S.playerId], foeE = S.empires.find(e => e.id !== me.id && e.alive) || S.empires[1];
    function draft(name, hull, d) {
      const x = D.blank(hull); x.name = name;
      if (d.comp) x.comp = I.computers[d.comp]; if (d.ecm) x.ecm = I.ecm[d.ecm]; if (d.shield) x.shield = I.shields[d.shield];
      if (d.armor) x.armor = I.armor[d.armor]; x.engine = I.engines[d.engine || 'nuclear-engine']; x.man = d.man || 0;
      (d.weapons || []).forEach((w, i) => { x.weapons[i] = { type: I.weapons[w[0]], count: w[1] }; });
      (d.specials || []).forEach((s, i) => { x.specials[i] = I.specials[s]; });
      return x;
    }
    function side(E, drafts, counts, role, human) {
      const E2 = Object.assign({}, E, { designs: drafts.slice(), dstats: [] }), snaps = [null, null, null, null, null, null], ships = [0, 0, 0, 0, 0, 0];
      drafts.forEach((d, i) => { if (d && counts[i]) { snaps[i] = Cb.snapshotDesign(S, E2, i); ships[i] = counts[i]; } });
      return { empire: E.id, fleetId: -1, ships, designs: snaps, role, race: E.race, name: E.plural, human: !!human, mod: Cb.raceMod(E.race), tl: E.research.tl.slice(), autoWeight: Cb.raceWeight(E.race), antidote: 0 };
    }
    const mine = [
      draft('Hammer', 3, { comp: 'mark-4-computer', ecm: 'ecm-3', shield: 'class-5-shield', armor: 'zortium-armor', engine: 'ion-engine', man: 4, weapons: [['heavy-laser', 4], ['hyper-x-5', 3], ['gatling-laser', 3]], specials: ['battle-scanner', 'automated-repair'] }),
      draft('Lance', 2, { comp: 'mark-3-computer', ecm: 'ecm-2', shield: 'class-3-shield', armor: 'duralloy-armor', engine: 'fusion-engine', man: 3, weapons: [['laser', 3], ['nuclear-missile', 2]], specials: ['battle-scanner'] }),
      draft('Dart', 1, { comp: 'mark-2-computer', shield: 'class-1-shield', armor: 'titanium-armor', engine: 'nuclear-engine', man: 2, weapons: [['laser', 2]] }),
      draft('Moth', 0, { comp: 'mark-1-computer', armor: 'titanium-armor', engine: 'retro-engine', man: 0, weapons: [['laser', 1]] }),
      draft('Breaker', 1, { comp: 'mark-2-computer', armor: 'titanium-armor', engine: 'nuclear-engine', man: 1, weapons: [['nuclear-bomb', 3], ['laser', 1]] }),
      null];
    const foe = [
      draft('Raptor', 2, { comp: 'mark-3-computer', ecm: 'ecm-2', shield: 'class-3-shield', armor: 'duralloy-armor', engine: 'fusion-engine', man: 3, weapons: [['phasor', 3], ['nuclear-missile', 2]] }),
      draft('Wasp', 1, { comp: 'mark-2-computer', shield: 'class-1-shield', armor: 'titanium-armor', engine: 'nuclear-engine', man: 2, weapons: [['laser', 2]] }),
      draft('Brute', 3, { comp: 'mark-3-computer', shield: 'class-3-shield', armor: 'duralloy-armor', engine: 'ion-engine', man: 3, weapons: [['heavy-ion-cannon', 3], ['hyper-v-5', 2]], specials: ['cloaking-device'] }),
      draft('Drone', 0, { comp: 'mark-1-computer', armor: 'titanium-armor', engine: 'retro-engine', man: 0, weapons: [['laser', 1]] }), null, null];
    const spec = [
      draft('Nova', 2, { comp: 'mark-3-computer', armor: 'duralloy-armor', engine: 'fusion-engine', man: 3, weapons: [['laser', 2]], specials: ['energy-pulsar', 'stasis-field', 'battle-scanner'] }),
      draft('Maw', 3, { comp: 'mark-3-computer', armor: 'duralloy-armor', engine: 'fusion-engine', man: 3, weapons: [['heavy-laser', 2]], specials: ['black-hole-generator', 'repulsor-beam', 'warp-dissipator'] }),
      draft('Ghost', 1, { comp: 'mark-4-computer', armor: 'titanium-armor', engine: 'fusion-engine', man: 3, weapons: [['phasor', 2]], specials: ['cloaking-device', 'sub-space-teleporter', 'technology-nullifier'] }),
      null, null, null];
    const star = (S.planets[foeE.capital] || S.planets[0]).starId, p = S.planets[star];
    const planetSnap = (owner, pop, fac, bases, shield) => ({ id: p.id, owner, name: p.name, pop, factories: fac, bases, shield, type: p.type, special: p.special, maxPop: 100, baseHp: 100, comp: 2, ecm: 1, absorb: 3, weapon: 'hyper-v', weapon2: 'scatter-pack-v', interdictor: false, antidote: 0 });
    const diff = (S.settings && S.settings.diffIdx) | 0;
    function monsterSide(kind) {
      const ss = Cb.monsterStats(kind, diff);
      return { empire: -1, fleetId: -1, ships: [1, 0, 0, 0, 0, 0], designs: [ss, null, null, null, null, null], role: 'attacker', race: 'monster', name: ss.name, human: false, mod: { compLevel: 0, initiative: 0, defense: 0, misDefense: 0 }, tl: [1, 1, 1, 1, 1, 1], autoWeight: 0, antidote: 0, monster: { kind, id: kind === 'guardian' ? -2 : 1 } };
    }
    let sides, planet = null, planetSide = -1, rocks = 'some', nebula = false, attacker = me.id, defender = foeE.id;
    switch (scn) {
      case 'fleet': sides = [side(me, mine, [2, 6, 10, 16, 4, 0], 'attacker', true), side(foeE, foe, [3, 10, 2, 14, 0, 0], 'defender')]; rocks = 'many'; break;
      case 'defend': sides = [side(me, mine, [1, 3, 6, 0, 0, 0], 'defender', true), side(foeE, foe, [4, 12, 3, 20, 0, 0], 'attacker')]; planet = planetSnap(me.id, 50, 30, 8, 15); planetSide = 0; attacker = foeE.id; defender = me.id; break;
      case 'monster': case 'crystal': case 'amoeba': {
        const kind = scn === 'monster' ? 'guardian' : scn;
        sides = [side(me, mine, [3, 8, 14, 20, 0, 0], 'defender', true), monsterSide(kind)]; attacker = -1; defender = me.id; rocks = 'some'; break;
      }
      case 'big': sides = [side(me, mine, [40, 60, 70, 20, 10, 0], 'attacker', true), side(foeE, foe, [30, 80, 50, 40, 0, 0], 'defender')]; planet = planetSnap(foeE.id, 80, 60, 24, 20); planetSide = 1; rocks = 'many'; break;
      case 'specials': sides = [side(me, spec, [3, 2, 3, 0, 0, 0], 'attacker', true), side(foeE, foe, [4, 8, 3, 12, 0, 0], 'defender')]; rocks = 'some'; break;
      case 'nebula': sides = [side(me, mine, [2, 6, 10, 16, 4, 0], 'attacker', true), side(foeE, foe, [4, 8, 0, 6, 0, 0], 'defender')]; planet = planetSnap(foeE.id, 50, 30, 6, 10); planetSide = 1; nebula = true; break;
      default: sides = [side(me, mine, [2, 6, 10, 16, 4, 0], 'attacker', true), side(foeE, foe, [4, 8, 0, 6, 0, 0], 'defender')]; planet = planetSnap(foeE.id, 50, 30, 6, 10); planetSide = 1;
    }
    const battle = { v: 1, star, starName: S.stars[star].name, planet, sides, planetSide, nebula, bg: o.bg === undefined ? 1 : o.bg, rocks, attacker, defender, human: true, diff, seed: 'demo:' + scn + ':' + (o.seed || 1) };
    return { battle, S };
  };

  // (flow.js already routes Game.handlers.battle → UI.Combat.fight)
})(window.MOO);
