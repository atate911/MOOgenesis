// Ship Design editor (screen 'design') — research/06 §5.10–5.11, research/03 §1–§3.
// The Design button opens the editor directly with the last design loaded. Layout follows the original (summary strip, Computer/Shield/ECM/Armor/Engine/Maneuver,
// four weapon banks with count spinners, three special slots, hull selector, look picker, name, cost/space readouts, Cancel/Clear/Build, component pop-up tables)
// and adds: a live hologram preview (Gfx.Ships, race + banner colour, hull class scales, add-ons and engine thrust follow the parts), before/after deltas against the
// saved design and the best design you own, a colour-coded space bar + cost breakdown, matchup hints, autofill helpers and the six-design library with Scrap.
//
//   Screens.go('design', {from, slot?, hull?})   slot = load that saved design as the template · hull = start a blank draft of that hull (0..3)
//   MOO.UI.Design.flags(statsOrDesign) → {beams, missiles, bomb, colony}   add-on flags for Gfx.Ships.draw/sprite (other screens may reuse them)
//   MOO.UI.Design.open(params)                                              convenience: Screens.go('design', params)
// Keys: C clear · B build · Esc / right-click cancel (closes a pop-up first) · 1–4 hull · arrows/Enter/Space inside pop-ups · Ctrl = ±10 and Alt = max/zero on counts.
// Writes only through Game.order({t:'design'|'scrapDesign'}).
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, U = M.Util;
  const D = M.Sim.Design, K = M.Data.Components, Q = M.Sim.Q;
  const fmt = U.fmt, esc = U.esc, clamp = U.clamp;

  const HULL_LABEL = ['Small', 'Medium', 'Large', 'Huge'];
  const HULL_SCALE = [1, 1.45, 2.1, 3.0];                    // Gfx.Ships.HULLS[i].length — relative drawing size of the four hull classes
  const NSLOT = D.SLOTS, BANKS = D.BANKS, NSPEC = D.SPEC_SLOTS;
  const PLANET_TYPES = ['Radiated', 'Toxic', 'Inferno', 'Dead', 'Tundra', 'Barren', 'Minimal', 'Desert', 'Steppe', 'Arid', 'Ocean', 'Jungle', 'Terran'];   // planet typeIdx 1..13
  const PLANET_COLORS = ['#a6d94a', '#b2c43a', '#e66a3a', '#9d8f86', '#a9cfe6', '#c9a46c', '#cdbb7b', '#e8c26e', '#c9d36e', '#dba75c', '#4f8fe6', '#43c466', '#4fd6ae'];
  const KIND_ICON = { beam: 'beam', missile: 'missile', torpedo: 'missile', bomb: 'bomb', bio: 'plague', special: 'special' };
  const KIND_LABEL = { beam: 'Beam', missile: 'Missile', torpedo: 'Torpedo', bomb: 'Bomb', bio: 'Bio', special: 'Special' };
  const KIND_ORDER = { beam: 0, missile: 1, torpedo: 2, bomb: 3, bio: 4, special: 5 };
  const LIST = { comp: K.COMPUTERS, shield: K.SHIELDS, ecm: K.ECM, armor: K.ARMOR, engine: K.ENGINES, weapon: K.WEAPONS, special: K.SPECIALS };
  const KIND = { comp: 'computers', shield: 'shields', ecm: 'ecm', armor: 'armor', engine: 'engines', weapon: 'weapons', special: 'specials' };
  const POP_TITLE = { comp: 'Battle Computer', shield: 'Deflector Shield', ecm: 'ECM Jammer', armor: 'Armor', engine: 'Engine', man: 'Maneuverability', weapon: 'Weapon', special: 'Special Device' };
  const SEGS = [['engine', 'Engines', 'var(--ember)'], ['weapon', 'Weapons', 'var(--rose)'], ['armor', 'Armor', 'var(--azure)'], ['systems', 'Systems', 'var(--cyan)'], ['special', 'Specials', 'var(--violet)']];

  // ship "look" emblems (cosmetic insignia — Gfx.Ships has one livery per race/hull, the banner colour comes from the empire)
  const EMBLEMS = [
    '<path fill-rule="evenodd" d="M12 2.5l8 9.5-8 9.5-8-9.5zM12 8l4 4-4 4-4-4z"/>',
    '<path d="M2.5 18L12 5l9.5 13h-5L12 11.6 7.5 18z"/>',
    '<path fill-rule="evenodd" d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z"/>',
    '<path d="M3 5h4.5v14H3zM9.75 5h4.5v14h-4.5zM16.5 5H21v14h-4.5z"/>',
    '<path d="M12 2l2.7 6.3L21.5 12l-6.8 3.7L12 22l-2.7-6.3L2.5 12l6.8-3.7z"/>',
    '<path fill-rule="evenodd" d="M3 12l5-7.5h8L21 12l-5 7.5H8zM9.2 12l2.8-4.2 2.8 4.2-2.8 4.2z"/>',
  ];
  const emblem = (i, cls) => {
    const t = document.createElement('template');
    t.innerHTML = '<svg class="ico dz-emb ' + (cls || '') + '" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' + EMBLEMS[((i | 0) % EMBLEMS.length + EMBLEMS.length) % EMBLEMS.length] + '</svg>';
    return t.content.firstChild;
  };

  // ===================================================================================================================================================
  UI.css('design', `
    .dz { --gv:max(0px, calc(100vh - 58rem)); --row:calc(2rem + var(--gv) * .035); position:absolute; inset:0; display:grid; grid-template-columns:clamp(15rem,17.5vw,20rem) minmax(0,1fr) clamp(25rem,31vw,38rem); grid-template-rows:auto minmax(0,1fr);
      gap:.5rem .6rem; padding:.5rem .7rem .6rem; color:var(--ivory);
      background:radial-gradient(ellipse at 72% 6%, rgba(46,64,150,.30), transparent 55%), radial-gradient(ellipse at 4% 98%, rgba(24,70,104,.26), transparent 50%), var(--void); }
    .dz-head { grid-column:1 / -1; display:flex; align-items:baseline; gap:.9rem; padding:0 .2rem .32rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .dz-head h1 { font:400 1.7rem/1 var(--font-title); letter-spacing:.06em; color:var(--brass-hi); text-shadow:0 0 18px rgba(214,179,106,.25); }
    .dz-head .sub { color:var(--mist); font-size:.95rem; }
    .dz-head .sp { flex:1; }
    .dz-head .fin { display:flex; gap:1.3rem; align-items:baseline; color:var(--mist); font-size:.95rem; }
    .dz-head .fin b { color:var(--ivory); font-weight:600; font-variant-numeric:tabular-nums; }
    .dz-head .fin .up { cursor:help; border-bottom:1px dotted rgba(214,179,106,.5); }

    /* library */
    .dz-lib { display:flex; flex-direction:column; min-height:0; }
    .dz-cards { flex:1 1 auto; display:flex; flex-direction:column; gap:.38rem; min-height:0; overflow:hidden auto; padding-right:.1rem; }
    .dz-card { position:relative; flex:1 1 0; min-height:4.5rem; display:grid; grid-template-columns:5rem minmax(0,1fr); gap:0 .45rem; align-items:center; padding:.25rem .45rem .25rem .2rem; cursor:var(--hand);
      border:1px solid rgba(214,179,106,.26); background:linear-gradient(135deg, rgba(25,34,77,.55), rgba(9,14,36,.72)); transition:border-color .12s, background .12s, box-shadow .12s; }
    .dz-card:hover { border-color:var(--brass); background:linear-gradient(135deg, rgba(40,54,116,.6), rgba(12,18,48,.78)); }
    .dz-card.sel { border-color:var(--brass-hi); box-shadow:inset 3px 0 0 var(--brass), 0 0 16px rgba(214,179,106,.16); background:linear-gradient(135deg, rgba(58,70,136,.6), rgba(14,20,52,.82)); }
    .dz-card.tgt::after { content:"build here"; position:absolute; right:.4rem; bottom:.2rem; font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--cyan); }
    .dz-card.empty { grid-template-columns:1fr; border-style:dashed; color:var(--fog); }
    .dz-card.empty .em { display:flex; flex-direction:column; align-items:center; gap:.15rem; font-size:.9rem; }
    .dz-card.empty .em .ico { width:1.3rem; height:1.3rem; opacity:.7; }
    .dz-card .no { position:absolute; left:.3rem; top:.15rem; font:600 .72rem var(--font-ui); color:var(--fog); }
    .dz-card.empty .no { left:.4rem; top:.3rem; }
    .dz-card .thw { position:relative; align-self:stretch; display:grid; }
    .dz-card .cardemb { position:absolute; right:.1rem; bottom:.05rem; width:.95rem; height:.95rem; color:var(--c, var(--brass)); opacity:.85; }
    .dz-th { width:100%; height:100%; min-height:3.7rem; display:grid; place-items:center; }
    .dz-th canvas { width:100%; height:100%; object-fit:contain; }
    .dz-ci { min-width:0; line-height:1.2; display:flex; flex-direction:column; gap:.08rem; }
    .dz-ci .nm { display:flex; align-items:center; gap:.3rem; font:400 1.04rem var(--font-display); color:var(--brass-hi); white-space:nowrap; }
    .dz-ci .nm .t { min-width:0; overflow:hidden; text-overflow:ellipsis; }
    .dz-ci .co { color:var(--mist); font-size:.82rem; white-space:nowrap; } .dz-ci .co b { color:var(--gold); font-weight:600; font-variant-numeric:tabular-nums; font-size:.9rem; }
    .dz-ci .mt { color:var(--mist); font-size:.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dz-ci .ft { display:flex; align-items:center; gap:.4rem; color:var(--mist); font-size:.8rem; min-height:1.3rem; }
    .dz-ci .ft .lk { color:var(--ember); white-space:nowrap; } .dz-ci .ft .lk .ico { width:.8rem; height:.8rem; vertical-align:-.1rem; }
    .dz-ci .ft .btn { margin-left:auto; padding:.02em .55em; font-size:.74rem; }
    .dz-libfoot { margin-top:.5rem; padding-top:.45rem; border-top:1px solid rgba(214,179,106,.25); font-size:.86rem; color:var(--mist); line-height:1.35; }
    .dz-libfoot b { color:var(--ivory); }

    /* main column */
    .dz-main { position:relative; display:flex; flex-direction:column; min-height:0; }
    .dz-mc { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; gap:calc(.5rem + var(--gv) * .008); overflow:hidden auto; margin:0 -.3rem; padding:0 .3rem; }
    .dz-sec { display:flex; align-items:center; gap:.6rem; margin:0 0 .16rem; font:400 .78rem var(--font-ui); letter-spacing:.14em; text-transform:uppercase; color:var(--brass); }
    .dz-sec .hint { margin-left:auto; letter-spacing:0; text-transform:none; color:var(--fog); font-size:.8rem; }
    .dz-strip { display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:.4rem; }
    .dz-tile { position:relative; padding:.28rem .5rem .3rem; min-height:calc(4.3rem + var(--gv) * .05); display:flex; flex-direction:column; justify-content:space-between; cursor:help;
      border:1px solid rgba(214,179,106,.26); background:linear-gradient(180deg, rgba(26,36,84,.7), rgba(9,14,36,.82)); transition:border-color .15s, background .15s; }
    .dz-tile.ghost { border-color:var(--cyan); background:linear-gradient(180deg, rgba(30,70,110,.55), rgba(9,18,44,.85)); }
    .dz-tile .k { font:400 .72rem var(--font-ui); letter-spacing:.05em; text-transform:uppercase; color:var(--mist); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dz-tile .v { font:400 1.95rem/1.05 var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; text-shadow:0 0 14px rgba(98,216,255,.18); }
    .dz-tile .v { display:flex; align-items:baseline; gap:.4rem; }
    .dz-tile .v .rb { margin-left:auto; font:600 .72rem var(--font-ui); color:var(--gold); white-space:nowrap; }
    .dz-tile .d { display:flex; align-items:baseline; gap:.4rem; min-height:1rem; font-size:.82rem; font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; }
    .dz-tile .d > :first-child { flex:none; }
    .dz-tile .d .bs { margin-left:auto; min-width:0; overflow:hidden; text-overflow:ellipsis; color:var(--fog); font-size:.74rem; }
    .dz-tile .d .bs.star { color:var(--gold); }
    .dz-d { font-weight:600; } .dz-d.up { color:var(--leaf); } .dz-d.dn { color:var(--rose); } .dz-d.eq { color:var(--fog); font-weight:400; }

    .dz-slots { display:grid; grid-template-columns:1fr 1fr; gap:calc(.3rem + var(--gv) * .008) 1rem; }
    .dz-slot { display:grid; grid-template-columns:6.3rem minmax(0,1fr); align-items:center; gap:.5rem; }
    .dz-lb { display:flex; align-items:center; gap:.35rem; font:400 .98rem var(--font-display); color:var(--brass-hi); letter-spacing:.04em; }
    .dz-lb .ico { width:1.05rem; height:1.05rem; color:var(--brass); }
    .dz-sel { position:relative; display:flex; align-items:center; gap:.5rem; width:100%; min-height:var(--row); padding:.18rem .5rem .18rem .6rem; text-align:left; cursor:var(--hand); color:var(--ivory);
      font:500 1rem var(--font-ui); border:1px solid rgba(214,179,106,.42); background:linear-gradient(180deg, rgba(30,42,96,.66), rgba(12,18,48,.82)); transition:border-color .12s, background .12s, box-shadow .12s; }
    .dz-sel:hover { border-color:var(--brass-hi); background:linear-gradient(180deg, rgba(46,62,132,.76), rgba(18,26,66,.86)); box-shadow:0 0 12px rgba(214,179,106,.16); }
    .dz-sel:focus-visible { outline:2px solid var(--cyan); outline-offset:1px; }
    .dz-sel .ico { width:1.1rem; height:1.1rem; color:var(--brass); flex:none; }
    .dz-sel .nm { flex:1 1 auto; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dz-sel .sp { flex:none; color:var(--mist); font-size:.8rem; white-space:nowrap; font-variant-numeric:tabular-nums; }
    .dz-sel .chev { flex:none; width:.85rem; height:.85rem; color:var(--brass); transform:rotate(90deg); opacity:.8; }
    .dz-sel .x { flex:none; width:1.3rem; height:1.3rem; display:grid; place-items:center; color:var(--fog); }
    .dz-sel .x:hover { color:var(--rose); } .dz-sel .x .ico { width:.8rem; height:.8rem; color:inherit; }
    .dz-sel.none .nm { color:var(--fog); font-style:italic; }
    .dz-sel.bad { border-color:var(--rose); }

    .dz-wh, .dz-wr { display:grid; grid-template-columns:6.3rem minmax(10rem,1.5fr) 4.6rem 2.5rem minmax(7rem,1.2fr); gap:.5rem; align-items:center; }
    .dz-wh { padding-bottom:.18rem; margin-bottom:.22rem; border-bottom:1px solid rgba(214,179,106,.25); font:400 .74rem var(--font-ui); letter-spacing:.12em; text-transform:uppercase; color:var(--brass); }
    .dz-wh .c { text-align:center; }
    .dz-wr { margin-bottom:calc(.25rem + var(--gv) * .006); }
    .dz-wr .dmg, .dz-wr .rng { text-align:center; font-variant-numeric:tabular-nums; font-weight:500; }
    .dz-wr .note { color:var(--mist); font-size:.82rem; line-height:1.18; }
    .dz-wr.empty .dmg, .dz-wr.empty .rng { color:var(--fog); }
    .dz-count { display:flex; align-items:stretch; gap:.15rem; height:var(--row); }
    .dz-count .n { flex:1; min-width:2.2rem; display:grid; place-items:center; font:600 1.15rem var(--font-ui); font-variant-numeric:tabular-nums; background:rgba(0,0,0,.36); border:1px solid rgba(214,179,106,.3); }
    .dz-count .n.zero { color:var(--fog); }
    .dz-count .ud { display:flex; flex-direction:column; width:1.45rem; gap:1px; }
    .dz-count .ud button { flex:1; padding:0; display:grid; place-items:center; cursor:var(--hand); color:var(--brass-hi); background:rgba(214,179,106,.1); border:1px solid rgba(214,179,106,.42); }
    .dz-count .ud button:hover { background:rgba(214,179,106,.32); }
    .dz-count .ud button:active { transform:translateY(1px); }
    .dz-count .ud svg { width:.62rem; height:.62rem; fill:currentColor; }
    .dz-count.off .n { opacity:.55; }
    @keyframes dz-shake { 0%,100% { transform:none; } 20% { transform:translateX(-4px); } 40% { transform:translateX(4px); } 60% { transform:translateX(-3px); } 80% { transform:translateX(2px); } }
    .shake { animation:dz-shake .3s linear; }

    .dz-sp { display:grid; grid-template-columns:6.3rem minmax(11rem,1.1fr) minmax(0,1.4fr); gap:.5rem; align-items:center; margin-bottom:calc(.25rem + var(--gv) * .006); }
    .dz-sp .desc { color:var(--mist); font-size:.86rem; line-height:1.2; display:flex; flex-wrap:wrap; align-items:center; gap:.15rem .5rem; }
    .dz-ptypes { display:inline-flex; gap:1px; vertical-align:middle; }
    .dz-ptypes i { display:block; width:.55rem; height:.8rem; background:var(--pc); opacity:.9; }
    .dz-ptypes i.off { background:rgba(255,255,255,.1); opacity:.7; }

    .dz-msg { min-height:1.7rem; display:flex; align-items:center; gap:.55rem; padding:.2rem .65rem; border-left:3px solid var(--fog); background:rgba(255,255,255,.03); font-size:.92rem; color:var(--mist); }
    .dz-msg .ico { width:1.05rem; height:1.05rem; flex:none; }
    .dz-msg.bad { border-left-color:var(--rose); background:rgba(255,92,106,.1); color:#ffd0d3; }
    .dz-msg.warn { border-left-color:var(--ember); background:rgba(255,148,64,.09); color:#ffdcbd; }
    .dz-msg.ok { border-left-color:var(--leaf); background:rgba(95,220,143,.08); color:#cdf5da; }
    .dz-msg b { color:var(--ivory); font-weight:600; }

    .dz-foot { margin-top:auto; padding-top:calc(.5rem + var(--gv) * .006); display:grid; grid-template-columns:minmax(0,1fr) 13.4rem 8.6rem; gap:.8rem; align-items:stretch; border-top:1px solid rgba(214,179,106,.3); }
    .dz-hulls { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:.35rem; }
    .dz-hull { display:flex; flex-direction:column; align-items:center; gap:0; padding:.22rem .2rem .25rem; cursor:var(--hand); color:var(--ivory); border:1px solid rgba(214,179,106,.32); background:linear-gradient(180deg, rgba(26,36,84,.6), rgba(9,14,36,.8)); transition:border-color .12s, background .12s; }
    .dz-hull:hover { border-color:var(--brass-hi); }
    .dz-hull.on { border-color:var(--brass-hi); background:linear-gradient(180deg, #e9cb86, #a98338); color:#241a05; box-shadow:0 0 14px rgba(214,179,106,.28); }
    .dz-hull .sil { height:.9rem; display:flex; align-items:flex-end; } .dz-hull .sil i { display:block; height:.6rem; background:currentColor; opacity:.85; clip-path:polygon(0 0,70% 0,100% 50%,70% 100%,0 100%); }
    .dz-hull .nm { font:400 1rem var(--font-display); letter-spacing:.05em; }
    .dz-hull .sub { font-size:.74rem; opacity:.75; font-variant-numeric:tabular-nums; }
    .dz-id { display:flex; align-items:center; gap:.55rem; margin-top:.3rem; }
    .dz-look { display:flex; align-items:center; gap:.2rem; flex:none; }
    .dz-look .btn { padding:.2em .5em; font-size:.8rem; }
    .dz-look .pic { width:2.3rem; height:2.1rem; display:grid; place-items:center; border:1px solid rgba(214,179,106,.4); background:rgba(0,0,0,.3); color:var(--c, var(--brass)); }
    .dz-look .pic .dz-emb { width:1.4rem; height:1.4rem; }
    .dz-name { flex:1; min-width:0; display:flex; align-items:center; gap:.45rem; }
    .dz-name label { font:400 .74rem var(--font-ui); letter-spacing:.12em; text-transform:uppercase; color:var(--brass); }
    .dz-name input { flex:1; min-width:0; }
    .dz-read { display:grid; grid-template-columns:1fr auto; gap:.12rem .5rem; align-content:center; }
    .dz-read .l { color:var(--mist); letter-spacing:.06em; text-transform:uppercase; font-size:.75rem; align-self:center; }
    .dz-read .v { text-align:right; font:600 1.15rem var(--font-ui); font-variant-numeric:tabular-nums; }
    .dz-read .v.gold { color:var(--gold); } .dz-read .v.bad { color:var(--rose); } .dz-read .v.low { color:var(--ember); }
    .dz-read .v.tip, .dz-read .l.tip { cursor:help; }
    .dz-read .sm { grid-column:1 / -1; text-align:right; color:var(--fog); font-size:.76rem; margin-top:-.05rem; }
    .dz-btns { display:flex; flex-direction:column; gap:.4rem; justify-content:center; }
    .dz-btns .btn { width:100%; }
    .btn.dz-off { opacity:.5; filter:grayscale(.55); }

    /* narrower windows (below the 1280 px design size): tighter columns, one slot column, the main panel scrolls */
    @media (max-width: 1000px) {
      .dz { grid-template-columns:clamp(11.5rem,16vw,14rem) minmax(0,1fr) clamp(21rem,29vw,26rem); gap:.5rem .5rem; }
      .dz-slots { grid-template-columns:1fr; }
      .dz-slot { grid-template-columns:5.8rem minmax(0,1fr); }
      .dz-card { grid-template-columns:3.8rem minmax(0,1fr); }
      .dz-wh, .dz-wr { grid-template-columns:5.6rem minmax(8rem,1.4fr) 3.8rem 2.2rem minmax(5rem,1fr); gap:.4rem; }
      .dz-sp { grid-template-columns:5.8rem minmax(9rem,1fr); } .dz-sp .desc { display:none; }
      .dz-foot { grid-template-columns:minmax(0,1fr) 11rem 7.5rem; gap:.5rem; }
      .dz-tile .v { font-size:1.6rem; }
      .dz-cmpg { grid-template-columns:1fr; }
    }

    @media (max-width: 1000px) { .dz-auto { flex-wrap:wrap; } .dz-cvw .tag { display:none; } }
    /* small windows (about 1024 px and below): one scrolling column — library strip, the editor, then the preview and numbers */
    @media (max-width: 960px) {
      .dz { grid-template-columns:minmax(0,1fr); grid-template-rows:none; grid-auto-rows:min-content; overflow-y:auto; overflow-x:hidden; align-content:start; }
      .dz-lib { max-height:15rem; } .dz-cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(11rem, 1fr)); gap:.4rem; overflow-y:auto; }
      .dz-main { overflow:visible; } .dz-mc { overflow:visible; max-height:none; }
      .dz-pv { min-height:16rem; }
    }

    /* pop-up tables */
    .dz-pop { position:absolute; inset:.3rem; z-index:6; display:none; flex-direction:column; border:1px solid var(--brass);
      background:linear-gradient(180deg, rgba(12,18,48,.985), rgba(6,9,25,.992)); box-shadow:0 0 0 1px rgba(0,0,0,.6), 0 12px 46px rgba(0,0,0,.65); }
    .dz-pop.on { display:flex; animation:dz-pop-in .18s var(--ease) both; }
    @keyframes dz-pop-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
    .dz-pop-h { display:flex; align-items:center; gap:.8rem; padding:.45rem .8rem; border-bottom:1px solid rgba(214,179,106,.42); background:linear-gradient(180deg, rgba(214,179,106,.12), rgba(214,179,106,.03)); }
    .dz-pop-h .t { font:400 1.3rem var(--font-title); color:var(--brass-hi); letter-spacing:.04em; white-space:nowrap; }
    .dz-pop-h .s { color:var(--mist); font-size:.88rem; }
    .dz-pop-h .sp { flex:1; }
    .dz-pop-h label { display:inline-flex; align-items:center; gap:.4rem; color:var(--mist); font-size:.88rem; cursor:var(--hand); white-space:nowrap; }
    .dz-kf { display:flex; gap:.25rem; padding:.3rem .8rem 0; flex-wrap:wrap; }
    .dz-kf button { padding:.1rem .6rem; cursor:var(--hand); color:var(--mist); font-size:.84rem; border:1px solid rgba(214,179,106,.28); background:rgba(255,255,255,.03); }
    .dz-kf button:hover { color:var(--ivory); border-color:var(--brass); }
    .dz-kf button.on { color:#241a05; background:var(--brass); border-color:var(--brass-hi); }
    .dz-kf button .ico { width:.9rem; height:.9rem; margin-right:.25rem; vertical-align:-.15rem; }
    .dz-pop-b { flex:1; min-height:0; overflow:auto; padding:.25rem .5rem .5rem; }
    .dz-pt { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
    .dz-pt th { position:sticky; top:0; z-index:1; padding:.28rem .5rem; text-align:left; background:#0c1440; color:var(--brass); font:400 .9rem var(--font-display); letter-spacing:.04em; border-bottom:1px solid rgba(214,179,106,.4); white-space:nowrap; }
    .dz-pt th.r, .dz-pt td.r { text-align:right; } .dz-pt th.c, .dz-pt td.c { text-align:center; }
    .dz-pt td { padding:.24rem .5rem; border-bottom:1px solid rgba(255,255,255,.05); vertical-align:middle; }
    .dz-pt tr.pr { cursor:var(--hand); transition:background .08s; }
    .dz-pt tr.pr:hover, .dz-pt tr.pr.hi { background:rgba(98,216,255,.1); }
    .dz-pt tr.pr.hi { box-shadow:inset 3px 0 0 var(--cyan); }
    .dz-pt tr.pr.cur td:first-child, .dz-pt tr.pr.cur td.nm { color:var(--brass-hi); }
    .dz-pt tr.pr.cur { background:rgba(214,179,106,.12); }
    .dz-pt tr.pr.over td { opacity:.5; } .dz-pt tr.pr.over td.sp { color:var(--rose); opacity:1; }
    .dz-pt tr.pr.lock { cursor:not-allowed; } .dz-pt tr.pr.lock td { opacity:.36; }
    .dz-pt tr.pr.conf { cursor:not-allowed; } .dz-pt tr.pr.conf td { opacity:.4; }
    .dz-pt tr.pr.none td { color:var(--mist); font-style:italic; }
    .dz-pt td.nm { font-weight:600; white-space:nowrap; } .dz-pt td.nm .ico { width:1rem; height:1rem; margin-right:.35rem; color:var(--brass); vertical-align:-.18rem; }
    .dz-pt td.ds { color:var(--mist); font-size:.88rem; line-height:1.2; width:36%; min-width:11rem; }
    .dz-pt td.mx { text-align:center; font-weight:600; color:var(--leaf); } .dz-pt td.mx.zero { color:var(--rose); }
    .dz-pt .req { color:var(--ember); white-space:nowrap; } .dz-pt .req .ico { width:.8rem; height:.8rem; vertical-align:-.1rem; margin-right:.2rem; }
    .dz-pt .mk { color:var(--brass-hi); margin-right:.3rem; }
    .dz-pfoot { display:flex; gap:1rem; padding:.3rem .8rem; border-top:1px solid rgba(214,179,106,.25); color:var(--fog); font-size:.82rem; }

    /* right column */
    .dz-right { display:flex; flex-direction:column; gap:.5rem; min-height:0; overflow:hidden; }
    .dz-pv { flex:1 1 0; min-height:15rem; display:flex; flex-direction:column; padding:.4rem .5rem .45rem; }
    .dz-pvh { display:flex; align-items:baseline; gap:.6rem; padding:0 .15rem .3rem; }
    .dz-pvh .nm { font:400 1.15rem var(--font-display); color:var(--brass-hi); letter-spacing:.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .dz-pvh .cl { margin-left:auto; color:var(--mist); font-size:.84rem; white-space:nowrap; }
    .dz-cvw { position:relative; flex:1 1 auto; min-height:0; border:1px solid rgba(214,179,106,.3); background:#050816; cursor:grab; }
    .dz-cvw:active { cursor:grabbing; }
    .dz-cvw canvas { position:absolute; inset:0; width:100%; height:100%; }
    .dz-cvw .tag { position:absolute; right:.45rem; top:.3rem; font-size:.7rem; letter-spacing:.1em; text-transform:uppercase; color:var(--fog); pointer-events:none; }
    .dz-auto { display:flex; align-items:center; gap:.4rem; padding-top:.4rem; }
    .dz-auto .lb { font:400 .74rem var(--font-ui); letter-spacing:.12em; text-transform:uppercase; color:var(--brass); margin-right:.15rem; }
    .dz-auto .btn { padding:.18em .7em; font-size:.84rem; }
    .dz-spc { flex:none; padding:.45rem .65rem .5rem; }
    .dz-spc .row { margin-bottom:.2rem; font-size:.9rem; }
    .dz-spc .sec { font:400 .74rem var(--font-ui); letter-spacing:.12em; text-transform:uppercase; color:var(--brass); }
    .dz-spc .num { font-variant-numeric:tabular-nums; color:var(--mist); }
    .dz-spc .num b { color:var(--ivory); font-weight:600; }
    .dz-sbar { display:flex; height:.95rem; background:rgba(255,255,255,.06); box-shadow:inset 0 0 0 1px rgba(214,179,106,.28); overflow:hidden; cursor:help; }
    .dz-sbar > i { display:block; height:100%; background:var(--c); min-width:0; transition:flex-basis .28s var(--ease); box-shadow:inset -1px 0 0 rgba(0,0,0,.45); }
    .dz-sbar > i.free { background:repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 5px, rgba(255,255,255,.015) 5px 10px); }
    .dz-sbar.over { box-shadow:inset 0 0 0 1px var(--rose); }
    .dz-sbar.cost { height:.55rem; }
    .dz-legend { display:flex; flex-wrap:wrap; gap:.1rem .8rem; margin:.3rem 0 .45rem; font-size:.8rem; color:var(--mist); font-variant-numeric:tabular-nums; }
    .dz-legend span { display:inline-flex; align-items:center; gap:.3rem; white-space:nowrap; }
    .dz-legend i { display:inline-block; width:.6rem; height:.6rem; background:var(--c); }
    .dz-legend b { color:var(--ivory); font-weight:600; }
    .dz-cmp { flex:none; padding:.35rem .6rem .4rem; }
    .dz-cmpg { display:grid; grid-template-columns:1fr 1fr; gap:0 .9rem; }
    .dz-cmp table { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; font-size:.84rem; table-layout:fixed; }
    .dz-cmp th { padding:.04rem .2rem .16rem; text-align:right; font:400 .68rem var(--font-ui); letter-spacing:.08em; text-transform:uppercase; color:var(--brass); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dz-cmp th:first-child { text-align:left; width:34%; }
    .dz-cmp td { padding:.03rem .2rem; text-align:right; border-top:1px solid rgba(255,255,255,.05); white-space:nowrap; }
    .dz-cmp td:first-child { text-align:left; color:var(--mist); }
    .dz-cmp td.me { font-weight:600; color:var(--ivory); }
    .dz-cmp .na { color:var(--fog); }
    .dz-hints { flex:0 1 auto; min-height:0; overflow:hidden; padding:.35rem .6rem .4rem; }
    .dz-hint { display:flex; gap:.5rem; align-items:flex-start; margin:.18rem 0; font-size:.86rem; line-height:1.28; color:var(--mist); }
    .dz-hint .ico { width:1rem; height:1rem; margin-top:.12rem; flex:none; }
    .dz-hint.warn .ico { color:var(--ember); } .dz-hint.tip .ico { color:var(--cyan); } .dz-hint.good .ico { color:var(--leaf); }
    .dz-hint b { color:var(--ivory); font-weight:600; }
    .dz-rep { display:grid; grid-template-columns:5.4rem 1fr auto; gap:.6rem; align-items:center; padding:.3rem .4rem; margin:.25rem 0; border:1px solid rgba(214,179,106,.25); background:rgba(0,0,0,.25); }
    .dz-rep canvas { width:100%; height:3rem; object-fit:contain; } .dz-rep .nm { font:400 1.05rem var(--font-display); color:var(--brass-hi); } .dz-rep .mt { color:var(--mist); font-size:.84rem; } .dz-rep.locked .mt { color:var(--ember); }
  `);

  // "original" restyle: grey-metal family (research/ui-ref B 1c): steel bezel, black inset panes, orange title plates / chevrons, teal labels,
  // orange-yellow component names, dark-red selection bar, orange spinners. Colour tokens are re-mapped locally so kit controls follow.
  UI.css('design-orig', `
    .dz { --bev-hi:#9a9a9a; --bev-mid:#6c6c6c; --bev-lo:#2a2a2a; --face-1:#7d7d7d; --face-2:#4a4a4a; --plate-1:#ffa31f; --plate-2:#c26500; --well:#040404; --well-2:#0b0b0b;
      --title:#ffa31f; --title-lo:#8a4a00; --accent:#f38600; --on-accent:#1a0c00; --accent-dim:rgba(243,134,0,.16); --accent-line:#b86400;
      --bg-0:#0a0a0a; --bg-1:#121212; --bg-2:#1a1a1a; --bg-3:#2a2a2a; --bg-4:#3a3a3a; --line-0:#1a1a1a; --line-1:#4d4d4d; --line-2:#797979; --line-3:#b5b5b5;
      --brass:#bdbdbd; --brass-hi:#ffffff; --brass-lo:#6a6a6a; --mist:#d2d2d2; --fog:#8e8e8e; --ivory:#f2f2f2; --gold:#ffb020; --cyan:#3fd1ac; --leaf:#43d843;
      --o-teal:#3fd1ac; --o-orange:#ffb020; --o-sel:#7a4c12; --o-green:#40d040;
      background:radial-gradient(ellipse 60% 40% at 18% 112%, rgba(120,32,20,.45), transparent 70%), radial-gradient(ellipse 30% 60% at 50% 40%, rgba(70,84,104,.20), transparent 70%), linear-gradient(180deg,#171717,#0b0b0b); }
    .dz::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:30; box-shadow:inset 0 0 0 .28rem #6c6c6c, inset .28rem .28rem 0 .28rem #9a9a9a, inset -.28rem -.28rem 0 .28rem #2a2a2a, inset 0 0 0 .62rem #121212; }
    .dz { padding:.9rem 1.1rem .95rem; }
    /* title plate: orange tab with cut corners */
    .dz-head { position:relative; border-bottom:0; padding:0 .2rem .4rem; box-shadow:0 1px 0 #2a2a2a, 0 2px 0 #797979; }
    .dz-head h1 { position:relative; padding:.18em 1.1em .2em; font:700 1.35rem/1 var(--font-display); letter-spacing:.16em; text-transform:uppercase; color:#1a0c00; text-shadow:0 1px 0 rgba(255,220,170,.5);
      background:linear-gradient(180deg,#ffb23c,#f38600 55%,#b85c00); box-shadow:inset 1px 1px 0 #ffd79a, inset -1px -1px 0 #7a3a00, 0 0 0 1px #000;
      clip-path:polygon(.55rem 0,calc(100% - .55rem) 0,100% 100%,0 100%); }
    :root:root .dz-head h1 { color:#1a0c00; text-shadow:0 1px 0 rgba(255,220,170,.5); }
    :root:root .dz .panel::before { background:linear-gradient(180deg,#0d0d0d,#050505); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 rgba(255,255,255,.1); }
:root:root .dz .panel-h { color:#1a0c00; text-shadow:0 1px 0 rgba(255,220,170,.45); } :root:root .dz .panel-h .sub { color:#3a1c00; }
    .dz-head .sub { color:var(--mist); } .dz-head .fin b { color:#fff; }
    .dz-head .fin .up { border-bottom-color:#f38600; }
    /* panes: black insets with a light/dark bevel line, no blue gradients */
    .dz-card, .dz-tile, .dz-count .n { background:linear-gradient(180deg,#0e0e0e,#050505); border:0; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #6c6c6c; }
    .dz-card:hover { background:linear-gradient(180deg,#1c1c1c,#0b0b0b); }
    .dz-card.sel { background:linear-gradient(180deg,#9a6218,#6d430d); box-shadow:0 0 0 1px #000, inset 0 0 0 1px var(--sel-line, #ffc860); }
    .dz-card .no { color:#f38600; } .dz-card.empty { border:0; background:#0a0a0a; color:#6a6a6a; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #3a3a3a; }
    .dz-ci .nm { color:var(--o-orange); text-transform:uppercase; letter-spacing:.05em; }
    .dz-ci .co b, .dz-ci .mt { color:var(--o-teal); } .dz-ci .co { color:#d2d2d2; }
    .dz-tile .k { color:var(--o-teal); letter-spacing:.08em; } .dz-tile .v { color:#fff; text-shadow:none; font-family:var(--font-ui); font-weight:600; }
    .dz-tile.ghost { background:linear-gradient(180deg,#0c2a24,#04120f); box-shadow:0 0 0 1px #000, inset 0 0 0 1px var(--o-teal); }
    .dz-sec { color:#1a0c00; font:700 .76rem var(--font-display); letter-spacing:.16em; padding:.12rem .8rem .14rem; width:max-content; background:linear-gradient(180deg,#ffb23c,#e87a00); box-shadow:inset 1px 1px 0 #ffd79a, inset -1px -1px 0 #7a3a00, 0 0 0 1px #000;
      clip-path:polygon(.4rem 0,calc(100% - .4rem) 0,100% 100%,0 100%); margin:.2rem 0 .3rem; }
    .dz-sec .hint { color:#3a1c00; font-weight:600; letter-spacing:.04em; }
    .dz-lb { color:var(--o-teal); text-transform:uppercase; letter-spacing:.03em; font-size:.88rem; } .dz-lb .ico { color:var(--o-teal); }
    .dz-sel { background:linear-gradient(180deg,#0e0e0e,#040404); border:0; color:var(--o-orange); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #797979; text-transform:uppercase; letter-spacing:.03em; }
    .dz-sel:hover { background:linear-gradient(180deg,#9a6218,#6d430d); color:#fff; box-shadow:0 0 0 1px #000, inset 0 0 0 1px var(--sel-line, #ffc860); }
    .dz-sel .ico, .dz-sel .chev { color:var(--o-teal); } .dz-sel .sp { color:#bdbdbd; } .dz-sel.none .nm { color:var(--o-teal); opacity:.7; font-style:normal; }
    .dz-wh { color:var(--o-green); border-bottom:1px solid #4d4d4d; text-shadow:1px 1px 0 #000; }
    .dz-wr .dmg, .dz-wr .rng { color:#fff; } .dz-wr .note { color:#bdbdbd; }
    .dz-count .ud button { background:linear-gradient(180deg,#ff9a14,#a85500); border:1px solid #000; color:#1a0c00; box-shadow:inset 1px 1px 0 #ffd79a; } .dz-count .ud button:hover { background:linear-gradient(180deg,#ffb23c,#c26500); }
    .dz-count .n { color:#43d843; }
    .dz-msg { background:#0a0a0a; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #3a3a3a; }
    .dz-foot { border-top:0; box-shadow:0 -1px 0 #2a2a2a, 0 -2px 0 #797979; background:linear-gradient(180deg,#3d3d3d,#2c2c2c); margin:.3rem -.3rem -.3rem; padding:.5rem .6rem .5rem; }
    .dz-hull { background:linear-gradient(180deg,#0e0e0e,#040404); border:0; color:#9a9a9a; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #2a2a2a, inset -1px -1px 0 #6c6c6c; }
    .dz-hull:hover { color:#fff; }
    .dz-hull.on { background:linear-gradient(180deg,#ffb23c,#f38600); color:#fff; box-shadow:0 0 0 1px #000, inset 1px 1px 0 #ffd79a, inset -1px -1px 0 #7a3a00; text-shadow:0 1px 0 rgba(0,0,0,.6); }
    .dz-hull .nm { text-transform:uppercase; }
    .dz-look .pic { border:0; background:#000; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #797979; color:var(--o-orange); }
    .dz-name label, .dz-read .l { color:#fff; font-weight:600; } .dz-read .v { color:#fff; } .dz-read .v.gold { color:var(--o-orange); }
    .dz-name input { background:#000; color:#fff; border:0; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #797979; }
    /* preview + readouts */
    .dz-cvw { border:0; background:radial-gradient(ellipse at 50% 40%, #1c2430, #050608 75%); box-shadow:0 0 0 1px #000, inset 1px 1px 0 #000, inset -1px -1px 0 #797979; }
    .dz-pvh .nm { color:var(--o-orange); text-transform:uppercase; letter-spacing:.06em; } .dz-auto .lb, .dz-spc .sec { color:var(--o-teal); }
    .dz-sbar { background:#000; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #797979; }
    .dz-pop { border:0; background:rgba(4,4,4,.97); box-shadow:0 0 0 1px #000, inset 0 0 0 2px #6c6c6c; }
    .dz-pop-h { background:linear-gradient(180deg,#3d3d3d,#2c2c2c); border-bottom:1px solid #000; } .dz-pop-h .t { color:var(--o-green); text-transform:uppercase; letter-spacing:.14em; font-family:var(--font-display); text-shadow:1px 1px 0 #000; }
    .dz-pt th { background:#000; color:var(--o-green); text-transform:uppercase; border-bottom:1px solid #4d4d4d; }
    .dz-pt tr.pr:hover, .dz-pt tr.pr.hi { background:rgba(255,255,255,.08); box-shadow:none; }
    .dz-pt tr.pr.cur { background:var(--o-sel); } .dz-pt tr.pr.cur td { color:#fff; } .dz-pt tr.pr.lock td, .dz-pt tr.pr.conf td { color:#707070; }
    .dz-pt td.nm .ico { color:var(--o-teal); }
    .dz-kf button { background:#1a1a1a; border:0; box-shadow:inset 1px 1px 0 #4d4d4d, inset -1px -1px 0 #000; color:#d2d2d2; } .dz-kf button.on { background:var(--o-sel); color:#fff; border:0; box-shadow:inset 0 0 0 1px var(--sel-line, #ffc860); }
    /* legibility pass: lighter greys (>= 4.5:1 on the black insets), no tiny all-caps */
    .dz { --fog:#b4b4b4; --brass-lo:#9a9a9a; }
    .dz-card.empty { color:#a8a8a8; } .dz-pt tr.pr.lock td, .dz-pt tr.pr.conf td { color:#a0a0a0; } .dz-hull { color:#c8c8c8; }
    .dz-card .no { font-size:.84rem; color:#d2d2d2; } .dz-card.tgt::after { font-size:.78rem; }
    .dz-sec { font-size:.88rem; } .dz-tile .k { font-size:.84rem; letter-spacing:.03em; } .dz-tile .v .rb { font-size:.82rem; } .dz-tile .d .bs { font-size:.84rem; }
    .dz-wh { font-size:.86rem; } .dz-ci .ft { font-size:.88rem; } .dz-ci .ft .btn { font-size:.84rem; }
    .dz-hull .sub { font-size:.84rem; opacity:.9; } .dz-name label, .dz-auto .lb, .dz-spc .sec { font-size:.84rem; letter-spacing:.08em; }
    .dz-read .l { font-size:.84rem; } .dz-read .sm { font-size:.86rem; } .dz-cvw .tag { font-size:.8rem; color:#c8c8c8; }
    .dz-cmp th { font-size:.8rem; letter-spacing:.04em; color:#f0b868; } .dz-cmp td { color:#e6e6e6; }
    .dz-sel.none .nm { opacity:1; text-transform:none; } .dz-sel .nm { font-size:.94rem; } .dz-sel .sp { font-size:.8rem; }
    .dz-wr .note { color:#d2d2d2; }
  `);

  // ===================================================================================================================================================
  // model
  const st = {
    draft: null, stats: null, baseStats: null, best: null, base: -1, target: -1, baseline: '', hover: null, popup: null, from: 'galaxy',
    prefLocked: {}, prefKind: 'all',
  };
  let memo = null, lastBuilt = -1;
  const ui = {};                                                    // DOM references
  const PV = { cv: null, ctx: null, w: 0, h: 0, dpr: 1, refit: true, bg: null, scan: null, manual: null, drag: null, sizeCur: 0, lastHull: -1, fx: [], view: null, acc: 0, fs: 12, color: '#62d8ff' };

  const E_ = () => G.player();
  const copy = d => JSON.parse(JSON.stringify(d));
  const compute = d => D.compute(G.S, E_(), d);
  function cleanDraft(d) { const n = D.normalize(d); delete n.extraBanks; delete n.extraSpecials; return n; }
  const sigOf = d => JSON.stringify([d.name || '', d.icon | 0, d.hull, d.comp, d.ecm, d.shield, d.armor, d.engine, Math.min(d.man | 0, d.engine), d.weapons.map(b => (b.count > 0 && b.type >= 0 ? [b.type, b.count] : [-1, 0])), d.specials]);
  const dirty = () => !!st.draft && sigOf(st.draft) !== st.baseline;
  const shipsOf = slot => { let n = 0; for (const f of G.S.fleets) if (f.owner === G.S.playerId) n += f.ships[slot] | 0; return n; };
  const buildersOf = slot => G.S.planets.filter(p => p.owner === G.S.playerId && p.build === slot).length;
  const usedSlots = () => E_().designs.filter(Boolean).length;
  const firstFree = () => E_().designs.findIndex(x => !x);
  const bannerColor = E => (getComputedStyle(document.documentElement).getPropertyValue('--emp' + E.color) || '').trim() || '#62d8ff';

  let availCache = null;
  const avail = kind => { if (!availCache) availCache = {}; return availCache[kind] || (availCache[kind] = new Set(D.available(E_(), kind))); };
  const bestAvail = kind => { const a = D.available(E_(), kind); return a.length ? a[a.length - 1] : -1; };
  const usedIcons = except => { const s = new Set(); E_().designs.forEach((d, i) => { if (d && i !== except) s.add(d.icon | 0); }); return s; };
  const freeIcons = except => { const used = usedIcons(except), out = []; for (let i = 0; i < EMBLEMS.length; i++) if (!used.has(i)) out.push(i); return out.length ? out : [0]; };

  // add-on flags for Gfx.Ships from a stats record (or a design record, which is computed on the fly)
  function shipFlags(x) {
    const s = (x && x.weaponCount !== undefined ? x : (x && x.engine !== undefined ? compute(x) : null)) || {};
    let beams = false, missiles = false, bomb = false;
    for (const w of (s.weapons || [])) {
      if (!(w.count > 0)) continue;
      if (w.kind === 'beam' || w.kind === 'special') beams = true; else if (w.kind === 'missile' || w.kind === 'torpedo') missiles = true; else if (w.kind === 'bomb' || w.kind === 'bio') bomb = true;
    }
    return { beams, missiles, bomb, colony: (s.colonyMin | 0) > 0 };
  }

  function firepower(s) {
    let v = 0;
    for (const w of (s.weapons || [])) {
      if (!(w.count > 0) || w.kind === 'bomb' || w.kind === 'bio') continue;
      v += w.count * (w.rof || 1) * ((w.dmg[0] + w.dmg[1]) / 2) * (w.mul || 1) * (w.warheads || 1) * (w.flags && w.flags.everyOtherRound ? 0.5 : 1);
    }
    return Math.round(v * 10) / 10;
  }

  // damage a design can keep up over a battle: missiles run dry after their volleys, so they count for less than beams of the same punch
  function sustained(s) {
    let v = 0;
    for (const w of (s.weapons || [])) {
      if (!(w.count > 0) || w.kind === 'bomb' || w.kind === 'bio') continue;
      let f = w.count * (w.rof || 1) * ((w.dmg[0] + w.dmg[1]) / 2) * (w.mul || 1) * (w.warheads || 1) * (w.flags && w.flags.everyOtherRound ? 0.5 : 1);
      if (w.kind === 'missile') f *= Math.min(1, (w.ammo > 0 ? w.ammo : 6) / 6);
      v += f;
    }
    return v;
  }

  function dmgText(w) {
    if (!w) return '';
    if (w.kind === 'bio') return '0–' + w.dmg[1];
    const base = w.dmg[0] === w.dmg[1] ? String(w.dmg[0]) : w.dmg[0] + '–' + w.dmg[1];
    return base + (w.mul > 1 ? ' ×' + w.mul : '') + (w.warheads > 1 ? ' ×' + w.warheads : '');
  }
  const rangeOf = (w, s) => w.range + (w.kind === 'beam' && s && s.rangeBonus ? s.rangeBonus : 0);

  function planetTypeStrip(colonyMin) {
    const el = h('span.dz-ptypes');
    PLANET_TYPES.forEach((n, i) => el.appendChild(h('i', { class: (i + 1) >= colonyMin ? '' : 'off', style: { '--pc': PLANET_COLORS[i] }, tip: n + ((i + 1) >= colonyMin ? ' — can be settled' : ' — too hostile for this base') })));
    return el;
  }
  const settleText = colonyMin => (colonyMin > 0 ? 'Settles ' + PLANET_TYPES[colonyMin - 1] + ' and kinder worlds (' + (14 - colonyMin) + ' of 13 types)' : '');

  // ===================================================================================================================================================
  // actions
  function toast(msg, kind) { UI.toast(msg, kind || 'warn'); }
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 340); }
  function reject(el, msg) { UI.sfx('error'); shake(el); if (msg) toast(msg, 'warn'); }

  function freshDraft(hull) {
    const d = D.blank(hull);
    const eng = bestAvail('engines'); d.engine = eng >= 0 ? eng : 0; d.man = 0;
    d.icon = freeIcons(-1)[0];
    return d;
  }

  function loadDraft(d, o) {
    o = o || {};
    st.draft = d; st.base = o.base === undefined ? -1 : o.base;
    st.target = o.target === undefined ? firstFree() : o.target;
    st.baseline = o.baseline !== undefined ? o.baseline : sigOf(d);
    st.hover = null; st.popup = null;
    if (ui.pop) closePopup(true);
    if (ui.name) ui.name.value = d.name || '';
    remember(); refreshAll();
  }
  function remember() { if (st.draft) memo = { S: G.S, draft: copy(st.draft), base: st.base, target: st.target, baseline: st.baseline }; }

  function selectDesign(slot) {                                        // click a saved design: load a copy as the template; Build writes a NEW design
    const E = E_(), d = E.designs[slot]; if (!d) return;
    const c = cleanDraft(d);
    loadDraft(c, { base: slot, target: firstFree(), baseline: sigOf(c) });
    flash('hull'); UI.sfx('click');
  }
  function selectEmpty(slot) {
    const d = freshDraft(st.draft ? st.draft.hull : 1);
    loadDraft(d, { base: -1, target: slot, baseline: '' });
    d.name = ''; flash('hull'); UI.sfx('click');
  }

  function changed(kind) {
    st.hover = null;
    refreshAll(); flash(kind); remember();
  }
  function setHull(i) {
    if (i === st.draft.hull) return;
    st.draft.hull = i; changed('hull'); UI.sfx('toggle');
  }
  function doClear() {
    if (!st.draft) return;
    const k = { name: st.draft.name, icon: st.draft.icon, hull: st.draft.hull };
    st.draft = freshDraft(k.hull); st.draft.name = k.name; st.draft.icon = k.icon;
    changed('hull'); UI.sfx('cancel');
  }
  function clearField(kind, ref) {
    const d = st.draft;
    if (kind === 'weapon') { d.weapons[ref] = { type: -1, count: 0 }; }
    else if (kind === 'special') d.specials[ref] = -1;
    else d[kind] = -1;
    changed(kind); UI.sfx('cancel');
  }

  function setCount(bank, want, anchorEl) {
    const d = st.draft, b = d.weapons[bank];
    if (b.type < 0) { openPopup('weapon', bank); return; }
    want = clamp(Math.round(want), 0, D.MAX_BANK);
    const cur = b.count | 0;
    if (want === cur) { if (want > 0) reject(anchorEl); return; }
    if (want > cur) {
      const max = D.maxCount(G.S, E_(), d, bank, b.type);
      const n = Math.min(want, max);
      if (n <= cur) { reject(anchorEl, 'No room left in the hull — free some space first'); return; }
      b.count = n;
    } else b.count = want;
    changed('weapon'); UI.sfx('slider');
  }

  // ----- Build / scrap ----------------------------------------------------------------------------------------------------------------------------
  // an existing design with identical parts AND the same (or an empty) name — building it again would only waste a slot
  function duplicateOf(d) {
    const E = E_(), key = compute(cleanDraft(d)).key, name = (d.name || '').trim().toLowerCase();
    for (let i = 0; i < NSLOT; i++) { const x = E.designs[i]; if (x && compute(cleanDraft(x)).key === key && (!name || name === (x.name || '').toLowerCase())) return i; }
    return -1;
  }
  async function doBuild() {
    if (!st.draft || G.busy) return;
    const E = E_(), s = st.stats;
    if (!s.valid) { reject(ui.build, s.reason); return; }
    const dup = duplicateOf(st.draft);
    if (dup >= 0) { reject(ui.build, 'You already have this exact design: «' + E.designs[dup].name + '» — change a part or give it another name'); return; }
    let slot = st.target;
    if (slot >= 0 && E.designs[slot] && shipsOf(slot) > 0) slot = -1;                // locked slot → somewhere else
    if (slot < 0) slot = firstFree();
    if (slot < 0) {
      const pick = await pickReplace();
      if (pick === null || pick === undefined) return;
      if (pick.scrap !== undefined) { const ok = await scrap(pick.scrap); if (!ok) return; slot = pick.scrap; }
      else slot = pick.slot;
    } else if (E.designs[slot]) {
      const old = E.designs[slot], b = buildersOf(slot);
      const ok = await confirmBox('Replace «' + old.name + '»?', h('div', h('p', 'The new design takes over this slot' + (b ? '; the ' + b + ' planet' + (b === 1 ? '' : 's') + ' building «' + old.name + '» will build «' + (st.draft.name || D.defaultName(E, st.draft.hull)) + '» instead.' : '.')), h('p.dim', 'No ships of the old design exist, so nothing is lost.')), 'Replace', false);
      if (!ok) return;
    }
    const design = cleanDraft(st.draft);
    design.name = uniqueName((st.draft.name || '').trim().slice(0, D.NAME_LEN), slot);
    const usedI = usedIcons(slot); design.icon = usedI.has(st.draft.icon | 0) ? freeIcons(slot)[0] : (st.draft.icon | 0);
    const r = G.order({ t: 'design', slot, design });
    if (!r.ok) { reject(ui.build, r.msg || 'The design could not be built'); return; }
    UI.sfx('confirm');
    const saved = E.designs[r.slot];
    toast('«' + saved.name + '» is ready to build — ' + r.cost + ' BC per ship', 'ok');
    lastBuilt = r.slot;
    const c = cleanDraft(saved);
    st.draft = c; st.base = r.slot; st.target = firstFree(); st.baseline = sigOf(c); st.hover = null;
    ui.name.value = c.name; availCache = null;
    remember(); refreshAll(); flash('hull');
  }

  // two designs may not share a name: «Bomber» → «Bomber 2»
  function uniqueName(name, slot) {
    if (!name) return name;
    const taken = n => E_().designs.some((d, i) => d && i !== slot && (d.name || '').toLowerCase() === n.toLowerCase());
    if (!taken(name)) return name;
    const stem = name.replace(/\s+\d+$/, '') || name;
    for (let i = 2; i < 100; i++) { const suf = ' ' + i, n = stem.slice(0, D.NAME_LEN - suf.length) + suf; if (!taken(n)) return n; }
    return name;
  }
  function confirmBox(title, body, okLabel, danger) {
    return UI.modal({ title, body, width: '30rem', buttons: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: !danger, danger: !!danger }] }).then(v => !!v);
  }
  async function scrap(slot) {
    const E = E_(), S = G.S, d = E.designs[slot]; if (!d) return false;
    const n = shipsOf(slot), refund = D.scrapRefund(S, E, slot, n), b = buildersOf(slot), left = E.designs.filter((x, i) => x && i !== slot).length;
    const lines = [h('p', n ? 'All ' + fmt(n) + ' ' + (n === 1 ? 'ship' : 'ships') + ' of this design — in orbit and in flight — will be scrapped for a refund of ' : 'No ships of this design exist. Refund: ', h('b.t-gold', fmt(refund) + ' BC'), ' (25% of their value).')];
    if (b) lines.push(h('p', b + ' planet' + (b === 1 ? ' is' : 's are') + ' building this design and will switch to another one.'));
    if (!left) lines.push(h('p.t-rose', 'This is your last design — you will not be able to build ships until you create a new one.'));
    const ok = await confirmBox('Scrap «' + d.name + '»?', h('div', lines), 'Scrap', true);
    if (!ok) return false;
    const r = G.order({ t: 'scrapDesign', slot });
    if (!r.ok) { toast(r.msg || 'Could not scrap that design', 'bad'); return false; }
    UI.sfx('explosion_small');
    toast('Scrapped «' + d.name + '»' + (r.refund ? ' — +' + fmt(r.refund) + ' BC' : ''), 'ok');
    if (st.base === slot) { st.base = -1; st.baseline = ''; }
    st.target = st.target === slot || st.target < 0 ? slot : st.target;
    if (lastBuilt === slot) lastBuilt = -1;
    remember(); refreshAll();
    return true;
  }

  function pickReplace() {
    return new Promise(resolve => {
      const E = E_(), rows = [];
      let m = null;
      for (let i = 0; i < NSLOT; i++) {
        const d = E.designs[i], n = shipsOf(i), s = D.stats(G.S, E, i), b = buildersOf(i);
        const act = n ? UI.button('Scrap…', () => m.close({ scrap: i }), { small: true, danger: true, tip: 'Scrap the ships to free this slot' }) : UI.button('Replace', () => m.close({ slot: i }), { small: true, primary: true });
        rows.push(h('div.dz-rep' + (n ? '.locked' : ''), thumb(d.hull, shipFlags(s), 90, 48, vkey(E, i, d.name)), h('div', h('div.nm', d.name), h('div.mt', D.cost(G.S, E, i) + ' BC · ' + (n ? fmt(n) + ' ships exist — scrap them first' : b ? 'building at ' + b + ' planet' + (b === 1 ? '' : 's') : 'no ships'))), act));
      }
      m = UI.modal({ title: 'All six design slots are in use', width: '34rem', body: h('div', h('p', 'Choose a design to replace. Designs with ships cannot be overwritten — scrap them first.'), rows), buttons: [{ label: 'Cancel', value: null }] });
      m.then(v => resolve(v === undefined ? null : v));
    });
  }

  function cancel() {
    if (st.popup) { closePopup(); return; }
    if (dirty()) memo = null;                              // Cancel discards the working draft: the editor re-opens with the last saved design
    else remember();
    const to = st.from || 'galaxy';
    UI.Screens.go(UI.Screens.has(to) && to !== 'design' ? to : 'galaxy', {});
  }

  // ----- autofill ------------------------------------------------------------------------------------------------------------------------------------
  function autoBest() {
    const d = st.draft, tryField = (field, idx) => { const old = d[field]; d[field] = idx; if (compute(d).free < 0) { d[field] = old; return false; } return true; };
    const E = E_(); let n = 0;
    const eng = bestAvail('engines'); if (eng >= 0 && d.engine !== eng) { const o = [d.engine, d.man]; d.engine = eng; if (compute(d).free < 0) { d.engine = o[0]; d.man = o[1]; } else n++; }
    const arm = D.available(E, 'armor').filter(i => !K.ARMOR[i].heavy).pop();
    if (arm !== undefined && arm > d.armor && tryField('armor', arm)) n++;
    for (const [field, kind] of [['shield', 'shields'], ['comp', 'computers'], ['ecm', 'ecm']]) { const b = bestAvail(kind); if (b >= 0 && b !== d[field] && tryField(field, b)) n++; }
    if (!n) { toast('Nothing better fits into this hull', 'info'); return; }
    changed('engine'); UI.sfx('construct', { vol: .6 });
  }
  function autoArmor() {
    const d = st.draft, E = E_(); let bestIdx = d.armor, bestHp = compute(d).hp;
    for (const i of D.available(E, 'armor')) { const old = d.armor; d.armor = i; const s = compute(d); d.armor = old; if (s.free >= 0 && s.hp > bestHp) { bestHp = s.hp; bestIdx = i; } }
    if (bestIdx === d.armor) { toast('This is already the strongest armor that fits', 'info'); return; }
    d.armor = bestIdx; changed('armor'); UI.sfx('construct', { vol: .6 });
  }
  function autoWeapons() {
    const d = st.draft, E = E_();
    let bank = d.weapons.findIndex(b => !(b.count > 0)); if (bank < 0) { toast('All four weapon banks are in use', 'info'); return; }
    let best = null, bestV = 0;
    for (const i of D.available(E, 'weapons')) {
      const w = K.WEAPONS[i]; if (w.kind === 'bomb' || w.kind === 'bio' || d.weapons.some(b => b.type === i && b.count > 0)) continue;
      const max = D.maxCount(G.S, E, d, bank, i); if (!max) continue;
      const probe = copy(d); probe.weapons[bank] = { type: i, count: max };
      const v = sustained(compute(probe)); if (v > bestV) { bestV = v; best = { type: i, count: max }; }
    }
    if (!best) { toast('No weapon fits into the remaining space', 'info'); return; }
    d.weapons[bank] = best; changed('weapon'); UI.sfx('construct', { vol: .6 });
  }

  // ===================================================================================================================================================
  // derived views
  const viewOf = () => (st.hover ? { d: st.hover.draft, s: st.hover.stats, hover: true } : { d: st.draft, s: st.stats, hover: false });

  function computeBest() {                         // per-stat best among the designs the empire owns (formula numbers, not the cached preset costs)
    const E = E_(), keys = ['attack', 'missDef', 'hp', 'warp', 'beamDef', 'combatSpeed', 'absorb', 'fire'], best = {};
    keys.forEach(k => { best[k] = { v: -Infinity, name: '' }; });
    best.cost = { v: Infinity, name: '' };
    E.designs.forEach(x => {
      if (!x) return; const s = compute(x); if (!s.valid) return;
      const vals = { attack: s.attack, missDef: s.missDef, hp: s.hp, warp: s.warp, beamDef: s.beamDef, combatSpeed: s.combatSpeed, absorb: s.absorb, fire: firepower(s) };
      keys.forEach(k => { if (vals[k] > best[k].v) best[k] = { v: vals[k], name: x.name }; });
      if (s.cost < best.cost.v && s.armed) best.cost = { v: s.cost, name: x.name };
    });
    return best;
  }

  function breakdown(d, s) {
    const E = E_(), hh = d.hull, hull = K.HULLS[hh], cost = { hull: hull.cost, weapon: 0, engine: 0, armor: 0, systems: 0, special: 0 }, space = { weapon: 0, engine: 0, armor: 0, systems: 0, special: 0 };
    const nd = D.normalize(d);
    nd.weapons.forEach(b => { if (b.type < 0 || b.count <= 0) return; const i = D.itemInfo(E, 'weapons', b.type, hh); cost.weapon += Math.max(i.costTenths, 5) * b.count; space.weapon += i.space * b.count; });
    nd.specials.forEach(si => { if (si < 0) return; const i = D.itemInfo(E, 'specials', si, hh); cost.special += Math.max(i.costTenths, 5); space.special += i.space; });
    if (nd.comp >= 0) { const i = D.itemInfo(E, 'computers', nd.comp, hh); cost.systems += Math.max(i.costTenths, 1); space.systems += i.space; }
    if (nd.ecm >= 0) { const i = D.itemInfo(E, 'ecm', nd.ecm, hh); cost.systems += Math.max(i.costTenths, 1); space.systems += i.space; }
    if (nd.shield >= 0) { const i = D.itemInfo(E, 'shields', nd.shield, hh); cost.systems += Math.max(i.costTenths, 5); space.systems += i.space; }
    { const a = K.ARMOR[nd.armor], i = D.itemInfo(E, 'armor', nd.armor, hh); if (a && a.cost[hh] > 0) cost.armor += Math.max(i.costTenths, 5); space.armor += i ? i.space : 0; }
    { const e = D.itemInfo(E, 'engines', nd.engine, hh); if (e) { cost.engine = Math.floor(Math.max(e.costTenths, 5) * s.engines / 10); space.engine = Math.floor(e.space * s.engines / 10); } }
    const sumS = space.weapon + space.engine + space.armor + space.systems + space.special;
    space.engine += s.spaceUsed - sumS;                                       // fold any rounding difference into the engines
    const sumC = cost.hull + cost.weapon + cost.engine + cost.armor + cost.systems + cost.special;
    cost.engine += s.costTenths - sumC;
    return { cost, space };
  }

  function hintsFor(d, s) {
    const E = E_(), out = [];
    const armed = s.armed, nCompAvail = D.available(E, 'computers').length, nEcmAvail = D.available(E, 'ecm').length, nShAvail = D.available(E, 'shields').length;
    if (s.colonyMin) out.push({ l: 'tip', t: '<b>Colony base:</b> ' + settleText(s.colonyMin).replace(/^S/, 's') + '. A better base settles harsher worlds.', p: 1 });
    if (!s.armed && !s.colonyMin && !s.tanks && !(s.bombs || s.bio)) out.push({ l: 'tip', t: 'No weapons, base or fuel tanks — Reserve Fuel Tanks (+3 parsecs) turn a small hull into a scout.', p: 2 });
    if ((s.bombs || s.bio) && !armed) out.push({ l: 'warn', t: '<b>Bombs and bio weapons only hit planets</b> — this ship needs an escort.', p: 0 });
    if (armed && nEcmAvail && d.ecm < 0) out.push({ l: 'warn', t: '<b>No ECM jammer:</b> enemy missiles, torpedoes and bombs hit at full accuracy. Each ECM level cuts their hit chance by 10%.', p: 1 });
    if (armed && nShAvail && d.shield < 0) out.push({ l: 'warn', t: '<b>No deflector shield:</b> a class-N shield removes N damage from every hit, shrugging off small weapons entirely.', p: 2 });
    if (armed && nCompAvail && d.comp < 0) out.push({ l: 'warn', t: '<b>No battle computer:</b> attack level 0 hits a defense-3 ship only ~20% of the time; each Mark adds 10%.', p: 2 });
    if (armed && s.combatSpeed <= 1 && s.free >= 0) out.push({ l: 'tip', t: 'Combat speed ' + s.combatSpeed + ' leaves this ship a sitting duck — raise Maneuver (it costs engine power).', p: 4 });
    const mx = Math.max(0, ...s.weapons.filter(w => w.count > 0 && w.kind !== 'bomb' && w.kind !== 'bio').map(w => (w.flags && w.flags.halfShield ? 0 : w.dmg[1])));
    if (armed && mx > 0 && mx <= 4) out.push({ l: 'tip', t: 'Biggest hit is only ' + mx + ': a class-' + mx + ' shield absorbs it completely. Shield-halving weapons (Mass Driver, Hard Beam…) cut through.', p: 3 });
    if (s.misshield) out.push({ l: 'good', t: '<b>Missile screen:</b> shoots down ' + s.misshield + '% of incoming missiles (less against high-tech ones).', p: 5 });
    else if (s.ecmLevel >= 3) out.push({ l: 'good', t: '<b>Strong ECM:</b> missile defense ' + s.missDef + ' makes enemy missiles miss often.', p: 5 });
    if (armed && s.free > 0 && s.free >= s.space * 0.22 && s.space - s.free > 0) out.push({ l: 'tip', t: Math.round(100 * s.free / s.space) + '% of the hull is unused — add armor or weapons (see Autofill).', p: 3 });
    if (s.valid && armed && s.free >= 0 && s.warp < Math.max(1, ...D.available(E, 'engines').map(i => K.ENGINES[i].warp))) out.push({ l: 'tip', t: 'Warp ' + s.warp + ' trails your best engine (warp ' + K.ENGINES[bestAvail('engines')].warp + '): a fleet flies at its slowest ship.', p: 6 });
    out.sort((a, b) => a.p - b.p);
    return out.slice(0, 2);
  }

  // ===================================================================================================================================================
  // rendering
  function refreshAll() {
    if (!st.draft) return;
    const E = E_();
    if (st.base >= 0 && !E.designs[st.base]) st.base = -1;
    st.stats = compute(st.draft);
    st.baseStats = st.base >= 0 ? compute(E.designs[st.base]) : null;
    st.best = computeBest();
    renderHead(); renderLibrary(); renderStrip(); renderSlots(); renderWeapons(); renderSpecials(); renderMsg(); renderFoot(); renderRight();
    if (st.popup) renderPopup();
  }
  function refreshView() { renderStrip(); renderRight(); }

  function renderHead() {
    const S = G.S, E = E_(), m = D.maintenance(S, E);
    UI.mount(ui.fin,
      h('span', 'Reserve ', h('b.t-gold', fmt(E.bc)), ' BC'),
      h('span.up', { tip: '<b>Ship upkeep</b> is 2% of every ship\'s cost per turn.<br>Ships ' + fmt(m.ships) + ' · missile bases ' + fmt(m.bases) + ' · stargates ' + fmt(m.gates) + ' BC' }, 'Fleet upkeep ', h('b', fmt(m.total)), ' BC / yr'));
    ui.sub.textContent = E.plural + ' shipyards · Year ' + Q.year(S);
  }

  // art-variant key of a design (Gfx.Ships picks one of the hull class's images from it; matches the ledgers and combat)
  const vkey = (E, slot, name) => (M.Gfx && M.Gfx.Ships && M.Gfx.Ships.designKey ? M.Gfx.Ships.designKey(E.id, slot, name) : null);
  function thumb(hull, flags, w, hh, vk) {
    const E = E_(), dpr = 2, c = h('canvas', { width: w * dpr, height: hh * dpr });
    try {
      const Sh = M.Gfx && M.Gfx.Ships;
      if (Sh && Sh.sprite) {
        const px = [50, 74, 104, 144][hull] * (w / 90), sp = Sh.sprite(E.race, hull, px, bannerColor(E), flags || {}, vk || null, '3q');   // the 3/4 render when the class has one
        const k = Math.min(1, (w * dpr - 6) / sp.width, (hh * dpr - 6) / sp.height), dw = sp.width * k, dh = sp.height * k;
        c.getContext('2d').drawImage(sp, (w * dpr - dw) / 2, (hh * dpr - dh) / 2, dw, dh);
      }
    } catch (e) { /* art is optional */ }
    return h('div.dz-th', c);
  }

  function renderLibrary() {
    const E = E_(), S = G.S, cards = [];
    for (let i = 0; i < NSLOT; i++) {
      const d = E.designs[i], tgt = st.target === i;
      if (!d) { cards.push(h('div.dz-card.empty' + (tgt ? '.tgt' : ''), { onclick: () => selectEmpty(i), tip: 'Empty slot — click to start a new design here' }, h('span.no', i + 1), h('div.em', UI.icon('add'), 'New design'))); continue; }
      const s = D.stats(S, E, i), n = shipsOf(i), b = buildersOf(i), cost = D.cost(S, E, i);
      cards.push(h('div.dz-card' + (st.base === i ? '.sel' : '') + (tgt ? '.tgt' : ''), { onclick: () => selectDesign(i), tip: designTip(d, s, i, n, b), style: { '--c': bannerColor(E) } },
        h('span.no', i + 1), h('div.thw', thumb(d.hull, shipFlags(s), 80, 64, vkey(E, i, d.name)), emblem(d.icon, 'cardemb')),
        h('div.dz-ci',
          h('div.nm', h('span.t', d.name)),
          h('div.co', h('b', cost + ' BC'), ' · ' + HULL_LABEL[d.hull]),
          h('div.mt', 'atk ' + (s.attack | 0) + ' · hp ' + fmt(s.hp | 0) + ' · warp ' + s.warp),
          h('div.ft', n ? h('span.lk', UI.icon('lock'), ' ' + fmt(n) + (n === 1 ? ' ship' : ' ships')) : h('span', 'no ships'),
            UI.button('Scrap', ev => { ev.stopPropagation(); scrap(i); }, { small: true, danger: true, tip: 'Scrap this design' + (n ? ' and its ' + n + ' ships' : '') + ' — 25% of the ships\' value is refunded' })))));
    }
    UI.mount(ui.cards, cards);
    const used = usedSlots();
    UI.mount(ui.libfoot, h('div', 'Designs ', h('b', used + ' / ' + NSLOT)), h('div.dim', used >= NSLOT ? 'All slots are in use — Build asks which design to replace.' : UI.Phone.say('Click', 'Tap') + ' a design to use it as a template, or an empty slot to start fresh.'));
  }
  function designTip(d, s, slot, n, b) {
    let t = '<b>' + esc(d.name) + '</b> — ' + HULL_LABEL[d.hull] + ' hull, ' + D.cost(G.S, E_(), slot) + ' BC<br>Attack ' + (s.attack | 0) + ' · defense ' + (s.beamDef | 0) + '/' + (s.missDef | 0) + ' · hits ' + (s.hp | 0) + ' · warp ' + s.warp + ' · speed ' + (s.combatSpeed | 0);
    if (s.weapons && s.weapons.length) t += '<br>' + s.weapons.filter(w => w.count > 0).map(w => w.count + '× ' + esc(w.name)).join(', ');
    if (s.colonyMin) t += '<br>' + settleText(s.colonyMin);
    if (n) t += '<br><span style="color:#ff9440">Locked: ' + fmt(n) + ' ships exist — scrap the design to replace it.</span>';
    return t;
  }

  const STRIP = [
    ['attack', 'Attack level', 'high', 'The battle computer\'s Mark level (+1 with a Battle Scanner). Each point above the target\'s defense adds 10% to your chance to hit — even odds at equal levels.'],
    ['missDef', 'Missile def', 'high', 'Beam defense plus the ECM level. Each point lowers the hit chance of enemy missiles, torpedoes and bombs by 10%.'],
    ['hp', 'Hit points', 'high', 'Hull hit points × armor strength. Shields subtract from every hit before it reaches the hull.'],
    ['warp', 'Warp', 'high', 'Speed on the star map in parsecs per turn. A fleet moves at the speed of its slowest ship.'],
    ['beamDef', 'Defense', 'high', 'Beam defense = maneuver rating + hull size modifier (+2 small … −1 huge) + inertial devices. Each point lowers an attacker\'s hit chance by 10%.'],
    ['combatSpeed', 'Combat speed', 'high', 'Squares moved per round in tactical combat: (rating + 2) ÷ 2, +1 with an Inertial Stabilizer, +2 with a Nullifier.'],
  ];
  function deltaChip(diff, better) {
    diff = Math.round(diff * 10) / 10;
    if (!diff) return h('span.dz-d.eq', '=');
    const good = better === 'low' ? diff < 0 : diff > 0;
    return h('span.dz-d.' + (good ? 'up' : 'dn'), (diff > 0 ? '+' : '−') + (Number.isInteger(diff) ? fmt(Math.abs(diff)) : Math.abs(diff).toFixed(1)));
  }
  const RACE_KEY = { attack: 'compLevel', beamDef: 'defense', missDef: 'misDefense' };
  function renderStrip() {
    const v = viewOf(), cur = v.s, ref = v.hover ? st.stats : st.baseStats, best = st.best, base = st.base >= 0 ? E_().designs[st.base] : null;
    const E = E_(), rd = M.Data.Races && M.Data.Races.races && M.Data.Races.races[E.race], rmod = (rd && rd.mod) || {};
    UI.mount(ui.strip, STRIP.map(([key, label, better, tip]) => {
      const val = cur[key] | 0, bs = best && best[key];
      let delta = null;
      if (ref) delta = deltaChip(val - (ref[key] | 0), better);
      const star = bs && val > bs.v && val > 0;
      const bestEl = bs && bs.v > -Infinity ? h('span.bs' + (star ? '.star' : ''), star ? '★ best' : 'best ' + bs.v) : null;
      let t = '<b>' + label + '</b><br>' + tip;
      const rb = RACE_KEY[key] ? rmod[RACE_KEY[key]] | 0 : 0;
      if (rb) t += '<br><span style="color:#ffd54f">' + esc(E.plural) + ' bonus: +' + rb + ' in battle — added when the fight starts, not shown here.</span>';
      if (ref) t += '<br><br>' + (v.hover ? 'Change vs your current draft: ' : 'vs «' + esc(base ? base.name : '') + '»: ') + '<b>' + (val - (ref[key] | 0) >= 0 ? '+' : '') + (val - (ref[key] | 0)) + '</b>';
      if (bs && bs.v > -Infinity) t += '<br>Best you own: <b>' + bs.v + '</b> («' + esc(bs.name) + '»)';
      return h('div.dz-tile' + (v.hover ? '.ghost' : ''), { tip: t }, h('div.k', label), h('div.v', String(val), rb ? h('span.rb', '+' + rb + ' race') : null), h('div.d', delta, bestEl));
    }));
  }

  const SLOT_DEFS = [
    { key: 'comp', label: 'Computer', icon: 'computers', kind: 'computers', opt: true },
    { key: 'armor', label: 'Armor', icon: 'armor', kind: 'armor' },
    { key: 'shield', label: 'Shield', icon: 'shield', kind: 'shields', opt: true },
    { key: 'engine', label: 'Engine', icon: 'engine', kind: 'engines' },
    { key: 'ecm', label: 'ECM', icon: 'ecm', kind: 'ecm', opt: true },
    { key: 'man', label: 'Maneuver', icon: 'speed' },
  ];
  function renderSlots() {
    const d = st.draft, s = st.stats, E = E_(), rows = [];
    for (const def of SLOT_DEFS) {
      let name, spec = '', none = false, clearable = false;
      if (def.key === 'man') {
        const max = d.engine + 1;
        name = 'Rating ' + Math.min(d.man + 1, max) + ' of ' + max; spec = 'speed ' + s.combatSpeed + ' · def ' + s.beamDef;
      } else {
        const idx = d[def.key], list = LIST[def.key];
        if (idx < 0) { name = 'none'; none = true; } else {
          const it = list[idx], info = D.itemInfo(E, def.kind, idx, d.hull); name = it ? it.name : '?';
          spec = info ? (info.cost || info.space ? (info.cost ? info.cost + ' BC · ' : '') + info.space + ' sp' : 'free') : '';
          if (def.key === 'engine') spec = (s.engines / 10).toFixed(1) + ' engines · ' + Math.floor(info.space * s.engines / 10) + ' sp';
          clearable = !!def.opt;
          if (!avail(def.kind).has(idx)) name += ' (not researched)';
        }
      }
      const btn = h('button.dz-sel' + (none ? '.none' : ''), { type: 'button', onclick: () => openPopup(def.key), tip: slotTip(def, s) },
        h('span.nm', name), spec ? h('span.sp', spec) : null,
        clearable ? h('span.x', { tip: 'Remove', onclick: ev => { ev.stopPropagation(); clearField(def.key); } }, UI.icon('close')) : UI.icon('chevron', 'chev'));
      rows.push(h('div.dz-slot', h('div.dz-lb', UI.icon(def.icon), def.label), btn));
    }
    UI.mount(ui.slots, rows);
  }
  function slotTip(def, s) {
    switch (def.key) {
      case 'comp': return '<b>Battle computer</b><br>Attack level ' + s.attack + (s.scanner ? ' (includes +1 Battle Scanner)' : '') + '. Click to choose.';
      case 'shield': return '<b>Deflector shield</b><br>Absorbs ' + s.absorb + ' damage from every hit. Click to choose.';
      case 'ecm': return '<b>ECM jammer</b><br>Missile defense ' + s.missDef + ' (beam defense ' + s.beamDef + ' + ECM ' + s.ecmLevel + '). Click to choose.';
      case 'armor': return '<b>Armor</b><br>' + s.hp + ' hit points. Heavy ("II") armor is stronger but takes much more room. Click to choose.';
      case 'engine': return '<b>Engine</b><br>Warp ' + s.warp + '. The ship carries ' + (s.engines / 10).toFixed(1) + ' engines: as many as its total power needs. Click to choose.';
      default: return '<b>Maneuverability</b><br>Rating ' + s.rating + ' gives combat speed ' + s.combatSpeed + ' and beam defense ' + s.beamDef + ', but costs ' + K.HULLS[st.draft.hull].power + ' power per step (≤ engine warp). Click to choose.';
    }
  }

  function renderWeapons() {
    const d = st.draft, s = st.stats, rows = [];
    for (let i = 0; i < BANKS; i++) {
      const b = d.weapons[i], w = b.type >= 0 ? K.WEAPONS[b.type] : null, sw = s.weapons ? s.weapons.find(x => x.slot === i) : null;
      const cnt = h('div.n' + (b.count > 0 ? '' : '.zero'), { tip: 'Mouse wheel: ±1 · Ctrl ±10 · Alt = max / zero', onwheel: ev => { if (b.type < 0) return; ev.preventDefault(); setCount(i, b.count + (ev.deltaY < 0 ? 1 : -1) * (ev.ctrlKey ? 10 : 1), cnt); } }, String(b.count | 0));
      const up = h('button', { type: 'button', tip: 'More (Ctrl +10 · Alt max)', onclick: ev => { UI.sfx('slider'); setCount(i, ev.altKey ? D.MAX_BANK : b.count + (ev.ctrlKey ? 10 : 1), cnt); } });
      up.innerHTML = '<svg viewBox="0 0 10 6"><path d="M5 0l5 6H0z"/></svg>';
      const dn = h('button', { type: 'button', tip: 'Fewer (Ctrl −10 · Alt zero)', onclick: ev => { UI.sfx('slider'); setCount(i, ev.altKey ? 0 : b.count - (ev.ctrlKey ? 10 : 1), cnt); } });
      dn.innerHTML = '<svg viewBox="0 0 10 6"><path d="M5 6L0 0h10z"/></svg>';
      const dis = !w;
      const sel = h('button.dz-sel' + (w ? '' : '.none'), { type: 'button', onclick: () => openPopup('weapon', i), tip: w ? weaponTip(w, sw, s) : '<b>Weapon bank ' + (i + 1) + '</b><br>Empty — click to choose a weapon.' },
        w ? UI.icon(KIND_ICON[w.kind] || 'weapons') : null, h('span.nm', w ? w.name : '— weapon ' + (i + 1) + ' —'),
        w ? h('span.x', { tip: 'Remove', onclick: ev => { ev.stopPropagation(); clearField('weapon', i); } }, UI.icon('close')) : UI.icon('chevron', 'chev'));
      const rowEl = h('div.dz-wr' + (w ? '' : '.empty'),
        h('div.dz-count' + (dis ? '.off' : ''), cnt, h('div.ud', up, dn)),
        sel,
        h('div.dmg', w ? dmgText(w) : '—'), h('div.rng', w ? String(rangeOf(w, s)) : '—'),
        h('div.note', w ? weaponNote(w) : ''));
      if (UI.Design.phoneRow) UI.Design.phoneRow(rowEl, i, b, w);                  // phones: a −10 −1 n +1 +10 Fill stepper (js/ui/phone-design.js)
      rows.push(rowEl);
    }
    UI.mount(ui.weap, h('div.dz-wh', h('span.c', 'Count'), h('span', 'Ship weapons'), h('span.c', 'Damage'), h('span.c', 'Rng'), h('span', 'Notes')), rows);
  }
  function weaponNote(w) {
    const bits = [];
    if (w.desc) bits.push(w.desc);
    if (w.kind === 'missile' && w.warheads === 1 && w.acc) bits.push('+' + w.acc + ' to hit');
    return bits.join(' · ');
  }
  function weaponTip(w, sw, s) {
    const info = D.itemInfo(E_(), 'weapons', K.WEAPONS.indexOf(w), st.draft.hull), per = firepower({ weapons: [Object.assign({}, w, { count: 1 })] });
    let t = '<b>' + esc(w.name) + '</b> (' + KIND_LABEL[w.kind] + ')<br>' + dmgText(w) + ' damage · range ' + rangeOf(w, s) + (w.rof > 1 ? ' · fires ' + w.rof + '×' : '') + '<br>' + info.cost + ' BC · size ' + info.space + ' · power ' + info.power;
    if (per) t += '<br>≈ ' + per + ' damage per round each (before shields)';
    if (w.kind === 'missile' || w.kind === 'torpedo') t += '<br>Speed ' + w.speed + ' squares/round · ' + (w.ammo > 0 ? w.ammo + (w.ammo === 1 ? ' volley' : ' volleys') + ' per battle' : 'unlimited');
    return t;
  }

  function renderSpecials() {
    const d = st.draft, rows = [];
    for (let i = 0; i < NSPEC; i++) {
      const si = d.specials[i], sp = si >= 0 ? K.SPECIALS[si] : null;
      const sel = h('button.dz-sel' + (sp ? '' : '.none'), { type: 'button', onclick: () => openPopup('special', i), tip: sp ? '<b>' + esc(sp.name) + '</b><br>' + esc(sp.desc) : '<b>Special device ' + (i + 1) + '</b><br>Empty — click to choose.' },
        sp ? UI.icon('special') : null, h('span.nm', sp ? sp.name : '— none —'),
        sp ? h('span.x', { tip: 'Remove', onclick: ev => { ev.stopPropagation(); clearField('special', i); } }, UI.icon('close')) : UI.icon('chevron', 'chev'));
      const desc = h('div.desc', sp ? sp.desc : '');
      if (sp && sp.colonyMin) { desc.appendChild(planetTypeStrip(sp.colonyMin)); }
      rows.push(h('div.dz-sp', h('div.dz-lb', 'Special ' + (i + 1)), sel, desc));
    }
    UI.mount(ui.spec, rows);
  }

  function renderMsg() {
    const s = st.stats, d = st.draft;
    let kind = 'ok', txt = null, icon = 'ok';
    if (!s.valid) { kind = 'bad'; icon = 'warning'; txt = h('span', h('b', 'Cannot build: '), s.reason, s.free < 0 ? ' — remove parts, use smaller ones or pick a bigger hull.' : '.'); }
    else {
      const dup = duplicateOf(d), used = usedSlots();
      if (dup >= 0) { kind = 'warn'; icon = 'info'; txt = h('span', 'This is identical to ', h('b', '«' + E_().designs[dup].name + '»'), ' — change a part or give it another name to build a variant.'); }
      else if (st.target < 0 && used >= NSLOT) { kind = 'warn'; icon = 'info'; txt = h('span', 'All six slots are used — Build will ask which design to replace.'); }
      else if (st.target >= 0 && E_().designs[st.target]) { kind = 'warn'; icon = 'info'; txt = h('span', 'Build will replace ', h('b', '«' + E_().designs[st.target].name + '»'), ' (no ships of it exist).'); }
      else txt = h('span', 'Ready to build into slot ', h('b', String(st.target >= 0 ? st.target + 1 : firstFree() + 1)), '. Upkeep per ship: ', h('b', (s.cost / 50).toFixed(2)), ' BC / turn (2% of its cost).');
    }
    ui.msg.className = 'dz-msg ' + kind;
    UI.mount(ui.msg, UI.icon(icon), txt);
  }

  function renderFoot() {
    const d = st.draft, s = st.stats, E = E_();
    UI.mount(ui.hulls, [0, 1, 2, 3].map(i => {
      const hl = K.HULLS[i], sp = D.hullSpace(E, i);
      return h('button.dz-hull' + (d.hull === i ? '.on' : ''), { type: 'button', onclick: () => setHull(i), tip: '<b>' + HULL_LABEL[i] + ' hull</b> <span style="opacity:.7">[' + (i + 1) + ']</span><br>Space ' + fmt(sp) + ' · hits ' + hl.hits + ' · hull cost ' + (hl.cost / 10) + ' BC<br>Defense ' + (hl.defense >= 0 ? '+' : '') + hl.defense + ' · ' + hl.power + ' maneuver power per rating step<br>Bigger hulls carry more but are easier to hit; space grows 2% per Construction level.' },
        h('span.sil', h('i', { style: { width: (0.55 + i * 0.4) + 'rem' } })), h('span.nm', HULL_LABEL[i]), h('span.sub', fmt(sp) + ' space'));
    }));
    // look picker
    const cur = d.icon | 0;
    const step = dir => { const list = freeIcons(st.target >= 0 ? st.target : -1); let i = list.indexOf(st.draft.icon | 0); i = (i + dir + list.length) % list.length; st.draft.icon = list[i]; remember(); renderLibrary(); renderFoot(); renderRight(); UI.sfx('click'); };
    UI.mount(ui.look, UI.button('◀', () => step(-1), { small: true, tip: 'Previous ship look' }), h('div.pic', { style: { '--c': bannerColor(E) }, tip: 'Ship look — a cosmetic emblem; every design needs its own' }, emblem(cur)), UI.button('▶', () => step(1), { small: true, tip: 'Next ship look' }));
    ui.name.placeholder = D.defaultName(E, d.hull);
    const freeCls = s.free < 0 ? 'bad' : s.space && s.free < s.space * 0.05 ? 'low' : '';
    UI.mount(ui.read,
      h('span.l.tip', { tip: costTip(d, s) }, 'Ship cost'), h('span.v.gold.tip', { tip: costTip(d, s) }, fmt(s.cost) + ' BC'),
      h('span.l', 'Total space'), h('span.v', fmt(s.space)),
      h('span.l', 'Available space'), h('span.v' + (freeCls ? '.' + freeCls : ''), (s.free < 0 ? '−' : '') + fmt(Math.abs(s.free))),
      h('span.sm', (s.engines / 10).toFixed(1) + ' engines · power ' + fmt(s.power)));
    ui.build.classList.toggle('dz-off', !s.valid || duplicateOf(d) >= 0);
    ui.cancelBtn.firstChild.textContent = dirty() ? 'Cancel' : 'Done';
  }
  function costTip(d, s) {
    const b = breakdown(d, s).cost, t = v => (v / 10).toFixed(1), rows = [['Hull', b.hull, 'var(--brass)'], ['Engines', b.engine, 'var(--ember)'], ['Weapons', b.weapon, 'var(--rose)'], ['Armor', b.armor, 'var(--azure)'], ['Systems', b.systems, 'var(--cyan)'], ['Specials', b.special, 'var(--violet)']];
    return '<b>Ship cost ' + s.cost + ' BC</b><br>' + rows.filter(r => r[1] > 0).map(r => '<span style="color:' + r[2] + '">■</span> ' + r[0] + ' ' + t(r[1]) + ' BC').join('<br>') + '<br><span style="opacity:.7">Upkeep ' + (s.cost / 50).toFixed(2) + ' BC per ship per turn</span>';
  }

  function renderRight() {
    const v = viewOf(), s = v.s, d = v.d, E = E_();
    PV.view = v;
    // header of the preview
    UI.mount(ui.pvh, h('span.nm', (st.draft.name || '').trim() || D.defaultName(E, st.draft.hull)), h('span.cl', (v.hover ? 'previewing · ' : '') + HULL_LABEL[d.hull] + ' hull · ' + E.plural));
    // space + cost bars
    const bd = breakdown(d, s), tot = Math.max(s.space, s.spaceUsed, 1), over = s.free < 0;
    const sb = h('div.dz-sbar' + (over ? '.over' : ''), { tip: '<b>Hull space ' + fmt(s.spaceUsed) + ' / ' + fmt(s.space) + '</b><br>' + SEGS.filter(g => bd.space[g[0]] > 0).map(g => '<span style="color:' + g[2] + '">■</span> ' + g[1] + ' ' + fmt(bd.space[g[0]])).join('<br>') + '<br>Free ' + (s.free < 0 ? '−' : '') + fmt(Math.abs(s.free)) });
    SEGS.forEach(g => { const v2 = bd.space[g[0]]; if (v2 > 0) sb.appendChild(h('i', { style: { flexBasis: (100 * v2 / tot).toFixed(2) + '%', flexGrow: 0, flexShrink: over ? 1 : 0, '--c': g[2] } })); });
    if (!over) sb.appendChild(h('i.free', { style: { flexBasis: (100 * s.free / tot).toFixed(2) + '%', flexGrow: 1, flexShrink: 1 } }));
    const legend = h('div.dz-legend', SEGS.filter(g => bd.space[g[0]] > 0).map(g => h('span', h('i', { style: { '--c': g[2] } }), g[1] + ' ', h('b', fmt(bd.space[g[0]])))), over ? h('span.t-rose', h('b', '−' + fmt(-s.free)), ' over') : h('span', h('i', { style: { '--c': 'rgba(255,255,255,.12)' } }), 'Free ', h('b', fmt(s.free))));
    const cb = h('div.dz-sbar.cost', { tip: costTip(d, s) });
    const ctot = Math.max(s.costTenths, 1);
    [['hull', 'var(--brass)'], ['engine', 'var(--ember)'], ['weapon', 'var(--rose)'], ['armor', 'var(--azure)'], ['systems', 'var(--cyan)'], ['special', 'var(--violet)']].forEach(([k, c]) => { const v2 = bd.cost[k]; if (v2 > 0) cb.appendChild(h('i', { style: { flexBasis: (100 * v2 / ctot).toFixed(2) + '%', flexGrow: 0, flexShrink: 1, '--c': c } })); });
    UI.mount(ui.spc, h('div.row.between', h('span.sec', 'Hull space'), h('span.num', h('b', fmt(s.spaceUsed)), ' / ' + fmt(s.space))), sb, legend,
      h('div.row.between', h('span.sec', 'Cost'), h('span.num', h('b.t-gold', fmt(s.cost)), ' BC · upkeep ', h('b', (s.cost / 50).toFixed(2)), ' / turn')), cb);
    renderCompare(s); renderHints(d, s);
  }

  const CMP = [['Cost', s => s.cost, 'low', ' BC'], ['Hit points', s => s.hp, 'high'], ['Attack', s => s.attack, 'high'], ['Defense', s => s.beamDef, 'high'], ['Missile def', s => s.missDef, 'high'],
    ['Shield', s => s.absorb, 'high'], ['Warp', s => s.warp, 'high'], ['Speed', s => s.combatSpeed, 'high'], ['Firepower', s => firepower(s), 'high']];
  function renderCompare(s) {
    const E = E_(), base = st.baseStats, baseName = st.base >= 0 && E.designs[st.base] ? E.designs[st.base].name : '';
    let bestDesign = null, bestStats = null, bestScore = -1;                                    // the strongest warship you own: damage × hit points × shield
    E.designs.forEach(x => { if (!x) return; const q = compute(x); if (!q.valid || !q.armed) return; const sc = (firepower(q) + 1) * (q.hp + 1) * (1 + q.absorb / 10); if (sc > bestScore) { bestScore = sc; bestDesign = x; bestStats = q; } });
    const num = v => (Number.isInteger(v) ? fmt(v) : v.toFixed(1));
    const rowFor = ([label, fn, better, suf]) => {
      const me = fn(s), a = base ? fn(base) : null, b = bestStats ? fn(bestStats) : null;
      const cell = ref => (ref === null ? h('td.na', '—') : h('td', deltaChip(me - ref, better)));
      return h('tr', h('td', label), h('td.me', num(me) + (suf || '')), cell(a), cell(b));
    };
    const tbl = (rows, first) => h('table', h('thead', h('tr', h('th', first ? 'Compare' : ''), h('th', 'This'),
      h('th', { tip: base ? 'Change against the saved design <b>«' + esc(baseName) + '»</b>' : 'No saved design is loaded as the template' }, 'Saved'),
      h('th', { tip: bestDesign ? 'Change against your strongest warship <b>«' + esc(bestDesign.name) + '»</b> (damage × hit points × shield)' : 'You own no armed design yet' }, 'Best'))), h('tbody', rows.map(rowFor)));
    UI.mount(ui.cmp, h('div.dz-cmpg', tbl(CMP.slice(0, 5), true), tbl(CMP.slice(5), false)));
  }
  function renderHints(d, s) {
    const list = hintsFor(d, s);
    UI.mount(ui.hints, list.length ? list.map(x => { const el = h('div.dz-hint.' + x.l, UI.icon(x.l === 'warn' ? 'warning' : x.l === 'good' ? 'ok' : 'info')); const t = h('span'); t.innerHTML = x.t; el.appendChild(t); return el; })
      : h('div.dz-hint.good', UI.icon('ok'), h('span', 'A balanced design — nothing to warn about.')));
  }

  // ===================================================================================================================================================
  // pop-up tables
  function openPopup(kind, ref) {
    const p = { kind, ref: ref === undefined ? -1 : ref, hi: -1, rows: [], showLocked: !!st.prefLocked[kind] };
    st.popup = p; availCache = null; UI.sfx('open', { vol: .6 });
    renderPopup();
  }
  function closePopup(silent) {
    st.popup = null; if (st.hover) { st.hover = null; if (!silent) refreshView(); }
    if (ui.pop) { ui.pop.classList.remove('on'); UI.clear(ui.pop); }
    if (!silent) UI.sfx('close', { vol: .5 });
  }

  function altFor(pop, row) {                                       // the draft with this row applied (null when it cannot be applied)
    const d = copy(st.draft);
    switch (pop.kind) {
      case 'comp': case 'shield': case 'ecm': case 'armor': d[pop.kind] = row.idx; break;
      case 'engine': d.engine = row.idx; d.man = Math.min(d.man, row.idx); break;
      case 'man': d.man = row.idx; break;
      case 'special': d.specials[pop.ref] = row.idx; break;
      case 'weapon': {
        if (row.idx < 0) { d.weapons[pop.ref] = { type: -1, count: 0 }; break; }
        const b = d.weapons[pop.ref], max = row.max !== undefined ? row.max : D.maxCount(G.S, E_(), st.draft, pop.ref, row.idx);
        if (max < 1) return null;
        d.weapons[pop.ref] = { type: row.idx, count: clamp(b.count > 0 ? b.count : 1, 1, max) }; break;
      }
    }
    return d;
  }

  function buildRows(pop) {
    const E = E_(), S = G.S, d = st.draft, hull = d.hull, kind = pop.kind, rows = [];
    if (kind === 'man') {
      const maxR = d.engine + 1, base = compute(Object.assign(copy(d), { man: 0 }));
      for (let r = 1; r <= maxR; r++) {
        const alt = copy(d); alt.man = r - 1; const sa = compute(alt);
        rows.push({ idx: r - 1, owned: true, cur: Math.min(d.man, d.engine) === r - 1, cols: [String(r), String(sa.combatSpeed), String(sa.beamDef), String(sa.missDef), fmt(sa.power), (sa.engines / 10).toFixed(1), (sa.cost - base.cost >= 0 ? '+' : '−') + Math.abs(sa.cost - base.cost) + ' BC', (sa.spaceUsed - base.spaceUsed >= 0 ? '+' : '−') + fmt(Math.abs(sa.spaceUsed - base.spaceUsed))], over: sa.free < 0, alt });
      }
      return rows;
    }
    const list = LIST[kind], lk = KIND[kind], own = avail(lk), isW = kind === 'weapon';
    if (kind === 'comp' || kind === 'shield' || kind === 'ecm') rows.push({ idx: -1, none: true, owned: true, cur: d[kind] < 0, label: kind === 'comp' ? 'No battle computer' : kind === 'shield' ? 'No deflector shield' : 'No ECM jammer' });
    if (isW) rows.push({ idx: -1, none: true, owned: true, cur: d.weapons[pop.ref].type < 0, label: 'Empty bank' });
    if (kind === 'special') rows.push({ idx: -1, none: true, owned: true, cur: d.specials[pop.ref] < 0, label: 'No device' });
    const order = list.map((it, i) => i);
    if (isW) order.sort((a, b) => (KIND_ORDER[list[a].kind] - KIND_ORDER[list[b].kind]) || (list[a].tech.l - list[b].tech.l) || (list[a].n - list[b].n));
    const other = kind === 'special' ? d.specials.filter((x, i) => i !== pop.ref && x >= 0).map(x => K.SPECIALS[x]) : [];
    for (const idx of order) {
      const it = list[idx];
      if (it.flags && it.flags.monster) continue;
      const owned = own.has(idx);
      if (!owned && (!pop.showLocked || it.id === 'death-ray')) continue;
      if (isW && st.prefKind !== 'all' && it.kind !== st.prefKind) continue;
      const info = D.itemInfo(E, lk, idx, hull);
      const row = { idx, it, owned, cur: false, info };
      if (kind === 'weapon') {
        const bank = d.weapons[pop.ref]; row.cur = bank.type === idx;
        const empty = copy(d); empty.weapons[pop.ref] = { type: -1, count: 0 };
        const one = copy(d); one.weapons[pop.ref] = { type: idx, count: 1 };
        const sb = compute(empty), so = compute(one);
        row.space = so.spaceUsed - sb.spaceUsed; row.max = owned ? D.maxCount(S, E, d, pop.ref, idx) : 0; row.over = row.max < 1;
      } else {
        const alt = copy(d), base = copy(d);
        if (kind === 'special') { alt.specials[pop.ref] = idx; base.specials[pop.ref] = -1; row.cur = d.specials[pop.ref] === idx; row.conf = other.some(o => o.group === it.group); }
        else if (kind === 'armor') { alt.armor = idx; base.armor = 0; row.cur = d.armor === idx; }
        else if (kind === 'engine') { alt.engine = idx; alt.man = Math.min(alt.man, idx); base.engine = idx; row.cur = d.engine === idx; }
        else { alt[kind] = idx; base[kind] = -1; row.cur = d[kind] === idx; }
        const sa = compute(alt), sb = compute(base);
        row.space = kind === 'engine' ? Math.floor(info.space * sa.engines / 10) : sa.spaceUsed - sb.spaceUsed;
        row.over = sa.free < 0; row.after = sa; row.alt = alt;
        if (kind === 'engine') row.engines = (sa.engines / 10).toFixed(1);
      }
      rows.push(row);
    }
    return rows;
  }

  function rowDesc(pop, row) {
    const it = row.it; if (!it) return '';
    switch (pop.kind) {
      case 'comp': return 'Attack level ' + it.level;
      case 'shield': return 'Absorbs ' + it.absorb + ' damage from every hit';
      case 'ecm': return 'Missile defense +' + it.level;
      case 'armor': return it.pct + '% hull strength → ' + (row.after ? row.after.hp : Math.floor(K.HULLS[st.draft.hull].hits * it.pct / 100)) + ' hit points' + (it.heavy ? ' · heavy plating' : '');
      case 'engine': return 'Warp ' + it.warp + ' · carries ' + row.engines + ' engines';
      case 'special': return it.desc;
      default: return it.desc || '';
    }
  }

  function renderPopup() {
    const pop = st.popup, kind = pop.kind, E = E_(), d = st.draft;
    pop.rows = buildRows(pop);
    if (M.Phone && M.Phone.active() && UI.Design.phonePicker) { UI.Design.phonePicker(pop); return; }      // phones: a sheet of cards (js/ui/phone-design.js)
    const isW = kind === 'weapon', isMan = kind === 'man';
    const cols = isMan ? ['Rating', 'Combat speed', 'Defense', 'Missile def', 'Power', 'Engines', 'Cost', 'Space'] : isW ? ['Max', 'Weapon', 'Description', 'Dmg', 'Rng', 'Cost', 'Size', 'Power', 'Space'] : ['Name', 'Description', 'Cost', 'Size', 'Power', 'Space'];
    const numStart = isMan ? 0 : isW ? 3 : 2;
    const head = h('tr', cols.map((c, i) => h('th', { class: isMan || (isW && (i === 0 || i === 3 || i === 4)) ? 'c' : i >= numStart ? 'r' : '' }, c)));
    const tbody = h('tbody');
    const trs = [];
    pop.rows.forEach((row, ri) => {
      let tr;
      const cls = ['pr', row.cur && 'cur', row.none && 'none', !row.owned && 'lock', row.conf && 'conf', row.over && row.owned && !row.conf && 'over'].filter(Boolean).join(' ');
      if (isMan) {
        tr = h('tr', { class: cls }, row.cols.map((c, i) => h('td', { class: 'c' + (i === 7 && row.over ? ' sp' : '') }, i === 0 && row.cur ? [h('span.mk', '◆'), c] : c)));
      } else if (row.none) {
        tr = h('tr', { class: cls }, h('td.nm', { colSpan: cols.length }, row.cur ? h('span.mk', '◆') : null, row.label));
      } else {
        const it = row.it, i = row.info, tds = [];
        const nameCell = h('td.nm', row.cur ? h('span.mk', '◆') : null, isW ? UI.icon(KIND_ICON[it.kind] || 'weapons') : null, it.name);
        const dsCell = h('td.ds', rowDesc(pop, row));
        if (!row.owned) { dsCell.appendChild(h('div.req', UI.icon('lock'), Q.FIELD_NAMES[it.tech.f] + ' tech level ' + it.tech.l)); }
        else if (row.conf) dsCell.appendChild(h('div.req', UI.icon('lock'), 'Only one of this type — remove the other first'));
        if (kind === 'special' && it.colonyMin) { dsCell.appendChild(h('div', planetTypeStrip(it.colonyMin), ' ', h('span.small', settleText(it.colonyMin)))); }
        if (isW) {
          tds.push(h('td.mx' + (row.max < 1 ? '.zero' : ''), row.owned ? String(row.max) : '—'), nameCell, dsCell, h('td.c', dmgText(it)), h('td.c', String(it.range + (it.kind === 'beam' ? (st.stats.rangeBonus | 0) : 0))));
        } else tds.push(nameCell, dsCell);
        tds.push(h('td.r', i.cost ? String(i.cost) : '—'), h('td.r', String(i.space)), h('td.r', i.power ? String(i.power) : '—'), h('td.r.sp', row.over && row.owned && !row.conf ? h('span', { tip: 'Does not fit into the remaining space' }, String(row.space) + ' ⚠') : String(row.space)));
        tr = h('tr', { class: cls }, tds);
      }
      if (isW && row.it) UI.setTip(tr, weaponTip(row.it, null, st.stats));
      tr.addEventListener('click', () => pickRow(ri));
      tr.addEventListener('mouseenter', () => hoverRow(ri));
      trs.push(tr); tbody.appendChild(tr);
    });
    pop.trs = trs;
    const hint = [
      isMan ? 'Each rating step adds the hull\'s maneuver power (' + K.HULLS[d.hull].power + ') — more engines — and raises defense and combat speed. Maximum = the engine\'s warp.' :
        'Cost, size and power are per unit on a ' + HULL_LABEL[d.hull] + ' hull. Space includes the engine room the power needs.' + (isW ? ' Max = how many fit into the free space.' : ''),
    ];
    const head2 = h('div.dz-pop-h', h('span.t', 'Select ' + POP_TITLE[kind].toLowerCase() + (isW ? ' ' + (pop.ref + 1) : kind === 'special' ? ' ' + (pop.ref + 1) : '')), h('span.s', HULL_LABEL[d.hull] + ' hull · free space ' + fmt(st.stats.free)), h('span.sp'),
      isMan ? null : h('label', h('input', { type: 'checkbox', checked: !!pop.showLocked, onchange: ev => { pop.showLocked = ev.target.checked; st.prefLocked[kind] = pop.showLocked; renderPopup(); } }), 'Show unresearched'),
      UI.button('Cancel', () => closePopup(), { small: true, kbd: 'Esc' }));
    const filter = isW ? h('div.dz-kf', ['all', 'beam', 'missile', 'torpedo', 'bomb', 'bio'].map(k => h('button.' + (st.prefKind === k ? 'on' : 'off'), { type: 'button', onclick: () => { st.prefKind = k; renderPopup(); } }, k === 'all' ? 'All' : [UI.icon(KIND_ICON[k]), KIND_LABEL[k]]))) : null;
    const nOwned = pop.rows.filter(r => r.owned && !r.none).length, nAll = (LIST[kind] || []).filter(x => !(x.flags && x.flags.monster)).length;
    UI.mount(ui.pop, head2, filter, h('div.dz-pop-b', h('table.dz-pt', h('thead', head), tbody)), h('div.dz-pfoot', h('span', hint), h('span', { style: { marginLeft: 'auto' } }, isMan ? '' : nOwned + ' of ' + nAll + ' researched')));
    ui.pop.classList.add('on');
    const cur = pop.rows.findIndex(r => r.cur), first = cur >= 0 ? cur : pop.rows.findIndex(r => selectable(r));
    setHi(first);
    const tr = pop.trs[first], pb = ui.pop.querySelector('.dz-pop-b');       // bring the current choice into view, roughly centred
    if (tr && pb && tr.offsetTop > pb.clientHeight * 0.7) pb.scrollTop = tr.offsetTop - pb.clientHeight * 0.4;
  }
  function selectable(row) { return row && row.owned && !row.conf; }
  function setHi(i) {
    const pop = st.popup; if (!pop) return;
    pop.hi = i; (pop.trs || []).forEach((tr, k) => tr.classList.toggle('hi', k === i));
  }
  function hoverRow(ri) {
    const pop = st.popup; if (!pop) return; const row = pop.rows[ri];
    if (!selectable(row)) { if (st.hover) { st.hover = null; refreshView(); } return; }
    setHi(ri);
    const alt = row.alt || altFor(pop, row); if (!alt) { st.hover = null; refreshView(); return; }
    st.hover = { draft: alt, stats: compute(alt) }; refreshView();
  }
  function popMove(dir) {
    const pop = st.popup; if (!pop || !pop.rows.length) return; let i = pop.hi < 0 ? (dir > 0 ? -1 : 0) : pop.hi;
    for (let n = 0; n < pop.rows.length; n++) { i = (i + dir + pop.rows.length) % pop.rows.length; if (selectable(pop.rows[i])) break; }
    hoverRow(i); const tr = pop.trs[i]; if (tr) tr.scrollIntoView({ block: 'nearest' });
  }
  function pickRow(ri) {
    const pop = st.popup; if (!pop) return; const row = pop.rows[ri];
    if (!row.owned) { reject(null, 'That component has not been researched yet'); return; }
    if (row.conf) { reject(null, 'Only one device of that type fits on a ship'); return; }
    const alt = row.alt || altFor(pop, row);
    if (!alt) { reject(null, 'Not even one fits — free some space first'); return; }
    st.draft = alt; closePopup(true);
    changed(pop.kind === 'man' ? 'engine' : pop.kind);
    UI.sfx(row.none ? 'cancel' : 'construct', { vol: .7 });
  }

  // ===================================================================================================================================================
  // hologram preview
  function flash(kind) { PV.fx.push({ kind, t0: -1 }); if (PV.fx.length > 6) PV.fx.shift(); }
  function fitPreview() {
    const cv = PV.cv; if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, (M.Perf && M.Perf.q && M.Perf.q.dpr) || 2);
    const r = cv.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); }
    PV.w = w; PV.h = hh; PV.dpr = dpr; PV.ctx = cv.getContext('2d'); PV.bg = null; PV.refit = false;
    PV.fs = Math.max(10, Math.round(parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.84));
  }
  function makeBg(w, hh, dpr) {
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    // the one sky behind the hologram (visual-system-plan.md 2.9), else the old indigo dome + starfield
    let sky = null;
    try { const Sp = M.Gfx && M.Gfx.pick ? M.Gfx.pick('space') : null; if (Sp && Sp.makeBackdrop && Sp.sky) sky = Sp.makeBackdrop(Math.min(1280, Math.round(w)), Math.min(720, Math.round(hh)), 'design', Sp.sky({ intensity: 0.55, stars: 0.8, floor: 0.06 })); } catch (e) { sky = null; }
    if (sky && (sky.width || sky.naturalWidth)) g.drawImage(sky, 0, 0, w, hh);
    else {
      const gr = g.createRadialGradient(w * .5, hh * .5, 0, w * .5, hh * .5, Math.max(w, hh) * .72);
      gr.addColorStop(0, '#16235f'); gr.addColorStop(.5, '#0b1239'); gr.addColorStop(1, '#04060f');
      g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < Math.round(w * hh / 2600); i++) { const x = rnd() * w, y = rnd() * hh, a = 0.1 + rnd() * 0.5; g.fillStyle = 'rgba(190,210,255,' + a.toFixed(2) + ')'; g.fillRect(x, y, rnd() < .15 ? 2 : 1, 1); }
    }
    // blueprint grid
    g.strokeStyle = 'rgba(98,150,255,.07)'; g.lineWidth = 1; const step = Math.max(16, Math.round(w / 22));
    g.beginPath(); for (let x = (w % step) / 2; x < w; x += step) { g.moveTo(x + .5, 0); g.lineTo(x + .5, hh); } for (let y = (hh % step) / 2; y < hh; y += step) { g.moveTo(0, y + .5); g.lineTo(w, y + .5); } g.stroke();
    // vignette
    const vg = g.createRadialGradient(w * .5, hh * .5, Math.min(w, hh) * .35, w * .5, hh * .5, Math.max(w, hh) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, hh);
    return c;
  }
  function makeScan(w, hh, dpr) {                                   // faint horizontal hologram lines, drawn over the ship
    const c = document.createElement('canvas'); c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr); g.fillStyle = 'rgba(140,200,255,.045)';
    for (let y = 0; y < hh; y += 3) g.fillRect(0, y, w, 1);
    return c;
  }
  function hexA(hex, a) { const c = U.hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function drawPlatform(ctx, cx, cy, rx, t, col) {
    const ry = rx * 0.2;
    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    glow.addColorStop(0, hexA(col, .28)); glow.addColorStop(.6, hexA(col, .08)); glow.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 1;
    [[1, .5], [.72, .35], [.44, .5]].forEach(([k, a]) => { ctx.strokeStyle = hexA(col, a * .8); ctx.beginPath(); ctx.ellipse(cx, cy, rx * k, ry * k, 0, 0, 6.2832); ctx.stroke(); });
    // rotating tick marks on the outer ring
    ctx.strokeStyle = hexA(col, .7); ctx.beginPath();
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.2832 + t * .12, c = Math.cos(a), s = Math.sin(a), r0 = i % 4 ? .94 : .9; ctx.moveTo(cx + c * rx * r0, cy + s * ry * r0); ctx.lineTo(cx + c * rx, cy + s * ry); }
    ctx.stroke();
    ctx.restore();
  }

  function frame(dt, t) {
    if (!PV.cv || !st.draft || !PV.cv.offsetParent) return;
    const fps = (M.Perf && M.Perf.q && M.Perf.q.animFps) || 60;
    if (!UI.pace(PV.pace || (PV.pace = {}), fps, dt)) return;
    const step = Math.min(PV.pace.dt, 0.1);
    drawPreview(step, t);
  }

  function drawPreview(dt, t) {
    if (PV.refit || !PV.ctx) fitPreview();
    const ctx = PV.ctx, cw = PV.w, ch = PV.h, E = E_(), Sh = M.Gfx && M.Gfx.Ships;
    if (!PV.bg) { PV.bg = makeBg(cw, ch, PV.dpr); PV.scan = makeScan(cw, ch, PV.dpr); }
    const view = PV.view || viewOf(), vs = view.s, vd = view.d, hull = clamp(vd.hull | 0, 0, 3);
    ctx.setTransform(PV.dpr, 0, 0, PV.dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch); ctx.drawImage(PV.bg, 0, 0, cw, ch);
    const col = PV.color, cx = cw * 0.5, cy = ch * 0.46;
    drawPlatform(ctx, cx, ch * 0.78, cw * 0.43, t, col);
    // size + hull change easing (the ship is always drawn at its final size and scaled in via a transform — no re-baking at in-between sizes)
    const unit = Math.min(cw * 0.262, ch * 0.34), target = unit * HULL_SCALE[hull];
    if (PV.lastHull !== hull) { if (PV.lastHull >= 0 && PV.sizeCur > 0) PV.scale = PV.sizeCur / target; PV.lastHull = hull; }
    if (PV.scale === undefined) PV.scale = 1;
    PV.scale += (1 - PV.scale) * Math.min(1, dt * 9); if (Math.abs(PV.scale - 1) < 0.004) PV.scale = 1;
    PV.sizeCur = target * PV.scale;
    const sc = PV.scale, ang = PV.manual !== null ? PV.manual : -0.1 + 0.09 * Math.sin(t * 0.5), bob = Math.sin(t * 1.15) * ch * 0.007, TILT = 0.88;
    const flags = shipFlags(vs), warp = vs.warp | 1;
    const thrust = clamp(0.18 + 0.82 * (warp - 1) / 8, 0.15, 1);
    let shield = vs.absorb > 0 ? clamp(0.22 + vs.absorb * 0.035, 0.25, 0.85) : 0;
    const fxs = PV.fx;
    for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; if (f.t0 < 0) f.t0 = t; if (t - f.t0 > 0.95) fxs.splice(i, 1); }
    for (const f of fxs) if (f.kind === 'shield') shield = Math.max(shield, 1 - (t - f.t0) / 0.95);
    // ground shadow
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, ch * 0.78, sc * target * 0.46, sc * target * 0.07, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    if (Sh && Sh.draw) {
      ctx.save(); ctx.translate(cx, cy + bob); ctx.scale(sc, sc * TILT);
      // the look the design will get: the slot it will land in (target, else first free) + its name, so renaming re-rolls the variant
      const pslot = st.target >= 0 ? st.target : (E.designs || []).findIndex(x => !x), pk = vkey(E, pslot < 0 ? 0 : pslot, vd.name);
      try { Sh.draw(ctx, { race: E.race, hull, x: 0, y: 0, size: target, angle: ang, color: col, t, thrust, flags, shield, cloaked: vs.cloak ? 0.28 : 0, shadow: false, seed: 3, vkey: pk, view: '3q' }); } catch (e) { /* ignore */ }   // 3/4 beauty render when the class has one (else the top view turns with the drag)
      ctx.restore();
      ctx.drawImage(PV.scan, 0, 0, cw, ch);
      if (sc === 1) drawCallouts(ctx, Sh, E, vs, vd, hull, cx, cy + bob, target, ang, flags, TILT, t, cw, ch);
    }
    // fx: scan sweep for any part change
    for (const f of fxs) {
      const a = (t - f.t0) / 0.95; if (a < 0 || a > 1) continue;
      if (f.kind === 'hull' || f.kind === 'comp' || f.kind === 'ecm' || f.kind === 'armor' || f.kind === 'man' || f.kind === 'special') {
        const len = target * 1.15, x = cx + len * (0.55 - 1.1 * a);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
        g.addColorStop(0, hexA(col, 0)); g.addColorStop(.5, hexA('#ffffff', .5 * (1 - a))); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g; ctx.fillRect(x - 18, cy - target * 0.5 * TILT, 36, target * TILT); ctx.restore();
      }
    }
    // hull caption (dropped on very short canvases, where the callouts need the room)
    if (ch >= 250) {
      ctx.save(); ctx.font = '400 ' + Math.round(PV.fs * 1.15) + 'px "Marcellus SC", Marcellus, Georgia, serif'; ctx.fillStyle = hexA('#f3dca0', .85); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(HULL_LABEL[hull].toUpperCase() + ' HULL', 10, 8);
      ctx.font = '500 ' + PV.fs + 'px "IBM Plex Sans Condensed", system-ui, sans-serif'; ctx.fillStyle = 'rgba(152,165,207,.9)';
      ctx.fillText('space ' + fmt(vs.space) + ' · ' + (vs.engines / 10).toFixed(1) + ' engines', 10, 8 + PV.fs * 1.5);
      ctx.restore();
    }
  }

  function drawCallouts(ctx, Sh, E, vs, vd, hull, cx, cy, size, ang, flags, TILT, t, cw, ch) {
    let an; try { an = Sh.anchors({ race: E.race, hull, x: 0, y: 0, size, angle: ang, flags, color: PV.color, view: '3q' }); } catch (e) { return; }
    const P = pt => ({ x: cx + pt.x, y: cy + pt.y * TILT });
    const items = [], fs = PV.fs;
    const pickAnchor = (arr, k) => (arr && arr.length ? arr[k % arr.length] : null);
    let ti = 0, ri = 0;
    for (const w of vs.weapons) {
      if (!(w.count > 0)) continue;
      let a = null, color = '#ff8f98';
      if (w.kind === 'beam' || w.kind === 'special') a = pickAnchor(an.turrets, ti++);
      else if (w.kind === 'missile' || w.kind === 'torpedo') { a = pickAnchor(an.racks, ri++); color = '#ffb070'; }
      else { a = an.bay; color = '#c8a0ff'; }
      if (a) items.push({ pt: P(a), text: w.count + '× ' + w.name, color });
    }
    if (flags.colony && an.pod) items.push({ pt: P(an.pod), text: 'Colony base', color: '#7fe8a8' });
    if (an.engines && an.engines.length) { let m = an.engines[0]; for (const e of an.engines) if (e.x < m.x) m = e; items.push({ pt: P(m), text: (vs.engines / 10).toFixed(1) + '× ' + K.ENGINES[vd.engine].name + ' · warp ' + vs.warp, color: '#ffb36a' }); }
    if (vs.absorb > 0) items.push({ pt: { x: cx + size * 0.12, y: cy - size * 0.42 * TILT }, text: K.SHIELDS[vd.shield].name + ' shield', color: '#8fe3ff', bubble: true });
    // fx rings at the anchors that just changed
    for (const f of PV.fx) {
      const a = (t - f.t0) / 0.95; if (a < 0 || a > 1) continue;
      const pts = f.kind === 'weapon' ? [].concat(an.turrets || [], an.racks || [], an.bay ? [an.bay] : []) : f.kind === 'engine' ? (an.engines || []) : null; if (!pts) continue;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = f.kind === 'engine' ? 'rgba(255,170,90,' + (1 - a) + ')' : 'rgba(255,120,130,' + (1 - a) + ')'; ctx.lineWidth = 2;
      for (const p0 of pts) { const p = P(p0); ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 + a * 26, (5 + a * 26) * TILT, 0, 0, 6.2832); ctx.stroke(); }
      ctx.restore();
    }
    // label layout: pills in rows along the top / bottom edge, kept near their anchors and pushed apart where they would overlap
    ctx.save(); ctx.font = '500 ' + fs + 'px "IBM Plex Sans Condensed", system-ui, sans-serif'; ctx.textBaseline = 'middle';
    const rowH = fs + 8, margin = 6, top = [], bot = [];
    items.forEach(it => { it.w = Math.ceil(ctx.measureText(it.text).width) + 12; });
    items.forEach(it => { if (it.pt.y < cy - size * 0.03) top.push(it); else if (it.pt.y > cy + size * 0.03) bot.push(it); else (top.length <= bot.length ? top : bot).push(it); });
    if (top.length > 2 && !bot.length) bot.push(top.pop());
    if (bot.length > 2 && !top.length) top.push(bot.pop());
    const settle = rowItems => {
      rowItems.sort((a, b) => a.pt.x - b.pt.x);
      rowItems.forEach(it => { it.x = clamp(it.pt.x - it.w / 2, margin, cw - margin - it.w); });
      for (let pass = 0; pass < 8; pass++) {
        for (let i = 1; i < rowItems.length; i++) { const a = rowItems[i - 1], b = rowItems[i], over = a.x + a.w + 6 - b.x; if (over > 0) { a.x -= over / 2; b.x += over / 2; } }
        rowItems.forEach(it => { it.x = clamp(it.x, margin, cw - margin - it.w); });
      }
    };
    const arrange = arr => {
      arr.sort((a, b) => a.pt.x - b.pt.x);
      const need = arr.reduce((sum, it) => sum + it.w + 6, 0), rowsN = need > cw - margin * 2 ? 2 : 1;
      for (let r = 0; r < rowsN; r++) { const sub = arr.filter((it, i) => i % rowsN === r); sub.forEach(it => { it.row = r; }); settle(sub); }
    };
    arrange(top); arrange(bot);
    const topY = ch < 250 ? 10 : 8 + fs * 3.5;
    for (const it of items) {
      const isTop = top.indexOf(it) >= 0;
      const ly = isTop ? topY + it.row * rowH : ch - 8 - rowH * 0.5 - it.row * rowH;
      const lx = clamp(it.pt.x, it.x + 6, it.x + it.w - 6), ey = isTop ? ly + rowH * 0.42 : ly - rowH * 0.42;
      ctx.strokeStyle = hexA(it.color, .75); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ey); ctx.lineTo(it.pt.x, it.pt.y); ctx.stroke();
      ctx.fillStyle = it.color; ctx.beginPath(); ctx.arc(it.pt.x, it.pt.y, 2.6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(5,8,22,.84)'; ctx.fillRect(it.x, ly - rowH * 0.42, it.w, rowH * 0.84); ctx.strokeStyle = hexA(it.color, .7); ctx.strokeRect(it.x + .5, ly - rowH * 0.42 + .5, it.w - 1, rowH * 0.84 - 1);
      ctx.fillStyle = '#ece6d3'; ctx.textAlign = 'left'; ctx.fillText(it.text, it.x + 6, ly + 0.5);
    }
    ctx.restore();
  }

  // ===================================================================================================================================================
  // DOM
  function buildDom(root) {
    ui.root = root;
    ui.sub = h('span.sub'); ui.fin = h('div.fin');
    ui.cards = h('div.dz-cards'); ui.libfoot = h('div.dz-libfoot');
    ui.strip = h('div.dz-strip'); ui.slots = h('div.dz-slots'); ui.weap = h('div.dz-wt'); ui.spec = h('div.dz-spw'); ui.msg = h('div.dz-msg');
    ui.hulls = h('div.dz-hulls'); ui.look = h('div.dz-look'); ui.read = h('div.dz-read');
    ui.name = h('input.field', { type: 'text', maxlength: D.NAME_LEN, placeholder: 'Design name', spellcheck: 'false', oninput: ev => { st.draft.name = ev.target.value.slice(0, D.NAME_LEN); remember(); renderMsg(); renderFoot(); renderPvHead(); } });
    ui.build = UI.button('Build', () => doBuild(), { primary: true, big: true, kbd: 'B', tip: 'Save this design (creates a new design; ships of existing designs are never changed)' });
    ui.cancelBtn = UI.button('Cancel', () => cancel(), { kbd: 'Esc', tip: 'Leave the design screen' });
    ui.clearBtn = UI.button('Clear', () => doClear(), { kbd: 'C', tip: 'Start over with an empty hull of the same size' });
    ui.pop = h('div.dz-pop');
    ui.pvh = h('div.dz-pvh'); ui.cvw = h('div.dz-cvw', PV.cv = h('canvas'), h('div.tag', 'drag to turn · double-click resets'));
    ui.spc = h('div.panel.tight.dz-spc'); ui.cmp = h('div.panel.tight.dz-cmp'); ui.hints = h('div.panel.tight.dz-hints');
    const auto = h('div.dz-auto', h('span.lb', 'Autofill'), UI.button('Best parts', () => autoBest(), { small: true, tip: 'Install the best researched engine, armor, shield, computer and ECM that fit' }),
      UI.button('Max armor', () => autoArmor(), { small: true, tip: 'Swap to the strongest armor that still fits' }), UI.button('Max weapons', () => autoWeapons(), { small: true, tip: 'Fill the next empty bank with the weapon that does the most damage in the space left' }));

    const dom = h('div.dz',
      h('div.dz-head', h('h1', 'Ship Design'), ui.sub, h('span.sp'), ui.fin),
      h('aside.panel.dz-lib', h('div.panel-h', UI.icon('design'), h('span', 'Design library')), ui.cards, ui.libfoot),
      h('section.panel.dz-main',
        h('div.dz-mc',
          ui.strip,
          h('div', h('div.dz-sec', 'Components'), ui.slots),
          h('div', h('div.dz-sec', 'Weapons', h('span.hint', 'wheel ±1 · Ctrl ±10')), ui.weap),
          h('div', h('div.dz-sec', 'Special devices'), ui.spec),
          ui.msg,
          h('div.dz-foot',
            h('div', h('div.dz-sec', 'Ship size'), ui.hulls, h('div.dz-id', h('div.dz-look', ui.look), h('div.dz-name', h('label', 'Name'), ui.name))),
            ui.read, h('div.dz-btns', ui.cancelBtn, ui.clearBtn, ui.build))),
        ui.pop),
      h('aside.dz-right',
        h('div.panel.dz-pv', ui.pvh, ui.cvw, auto), ui.spc, ui.cmp, ui.hints));
    root.appendChild(dom);
    for (const [sel, name] of [['.dz-lib', 'design.library'], ['.dz-mc', 'design.parts'], ['.dz-pv', 'design.preview'], ['.dz-cmp', 'design.compare'], ['.dz-foot', 'design.build']]) { const e = dom.querySelector(sel); if (e) e.dataset.help = name; }      // F1 help anchors

    // preview interaction: drag to turn, double-click to reset
    const cv = PV.cv;
    cv.addEventListener('pointerdown', ev => { cv.setPointerCapture(ev.pointerId); PV.drag = { x: ev.clientX, a: PV.manual !== null ? PV.manual : -0.1 }; });
    cv.addEventListener('pointermove', ev => { if (PV.drag) PV.manual = PV.drag.a + (ev.clientX - PV.drag.x) * 0.012; });
    cv.addEventListener('pointerup', () => { PV.drag = null; });
    cv.addEventListener('dblclick', () => { PV.manual = null; });
    UI.watchSize(ui.cvw, () => { PV.refit = true; });

    root.addEventListener('contextmenu', ev => { if (ev.target && ev.target.tagName === 'INPUT') return; ev.preventDefault(); if (st.popup) closePopup(); else cancel(); });
  }
  function renderPvHead() { const E = E_(); UI.mount(ui.pvh, h('span.nm', (st.draft.name || '').trim() || D.defaultName(E, st.draft.hull)), h('span.cl', HULL_LABEL[st.draft.hull] + ' hull · ' + E.plural)); }

  function bindKeys() {
    const scr = { screen: 'design' };
    UI.bindKey('Escape', () => { if (st.popup) closePopup(); else cancel(); }, scr);
    UI.bindKey('b', () => { if (!st.popup) doBuild(); }, scr);
    UI.bindKey('c', () => { if (!st.popup) doClear(); }, scr);
    [0, 1, 2, 3].forEach(i => UI.bindKey(String(i + 1), () => { if (!st.popup) setHull(i); }, scr));
    // pop-up navigation lives on its own listener so Enter / Space / arrows keep their normal meaning (activating a focused button) when no table is open
    window.addEventListener('keydown', e => {
      if (!st.popup || UI.modalOpen() || !UI.Screens.current || UI.Screens.current.id !== 'design') return;
      const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key;
      if (k === 'ArrowDown') popMove(1); else if (k === 'ArrowUp') popMove(-1);
      else if (k === 'PageDown') popMove(8); else if (k === 'PageUp') popMove(-8);
      else if (k === 'Home') { st.popup.hi = -1; popMove(1); } else if (k === 'End') { st.popup.hi = 0; popMove(-1); }
      else if ((k === 'Enter' || k === ' ') && st.popup.hi >= 0) pickRow(st.popup.hi);
      else return;
      e.preventDefault();
    });
  }

  // ===================================================================================================================================================
  UI.Screens.register('design', {
    create(root) { buildDom(root); bindKeys(); },
    enter(params) {
      params = params || {};
      if (!G.S) { UI.Screens.go('menu'); return; }
      const E = E_(); availCache = null;
      st.from = params.from || (UI.Screens.current && UI.Screens.current.prev) || 'galaxy';
      PV.color = bannerColor(E); PV.refit = true; PV.manual = null; PV.fx.length = 0; PV.lastHull = -1; PV.scale = 1;
      if (!E.designs) E.designs = [];
      if (params.slot !== undefined && E.designs[params.slot]) selectDesign(params.slot);
      else if (params.hull !== undefined) { const d = freshDraft(clamp(params.hull | 0, 0, 3)); loadDraft(d, { base: -1, target: firstFree(), baseline: '' }); }
      else if (memo && memo.S === G.S && memo.draft) { loadDraft(copy(memo.draft), { base: memo.base, target: memo.target, baseline: memo.baseline }); st.target = E.designs[st.target] && shipsOf(st.target) > 0 ? firstFree() : st.target; }
      else {                                                           // the last (armed) design is loaded as the template
        let slot = lastBuilt >= 0 && E.designs[lastBuilt] ? lastBuilt : -1;
        if (slot < 0) for (let i = NSLOT - 1; i >= 0; i--) if (E.designs[i] && D.stats(G.S, E, i).armed) { slot = i; break; }
        if (slot < 0) for (let i = NSLOT - 1; i >= 0; i--) if (E.designs[i]) { slot = i; break; }
        if (slot >= 0) selectDesign(slot); else loadDraft(freshDraft(1), { base: -1, target: 0, baseline: '' });
      }
      closePopup(true);
      refreshAll();
      /* the designer keeps whatever underscore is playing (soundscape.js): a menu is not a scene change */
      flash('hull');
    },
    leave() {
      closePopup(true);
      try { const A = M.Audio && M.Audio.Music; if (A && A.stop && (!A.current || A.current() === 'design')) A.stop({ fade: 0.8 }); } catch (e) { /* ignore */ }
    },
    update(dt, t) { frame(dt, t); },
    resize() { PV.refit = true; },
  });

  M.Bus.on('game:new', () => { memo = null; lastBuilt = -1; });
  M.Bus.on('game:loaded', () => { memo = null; lastBuilt = -1; });
  M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'design' && st.draft && !G.busy) { availCache = null; renderHead(); } });

  UI.Design = { flags: shipFlags, open: params => UI.Screens.go('design', params || {}), emblem,
    // the editor's internals for the phone layout layer (js/ui/phone-design.js): it re-arranges these containers and draws the picker as cards
    _phone: { ui, st, PV, pickRow, closePopup, renderPopup, setCount, cancel, rowDesc, dmgText, planetTypeStrip, settleText, HULL_LABEL, KIND_ICON, KIND_LABEL, POP_TITLE, LIST } };
})(window.MOO);
