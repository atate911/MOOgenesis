// Planets ledger (research/06 §5.8): one row per colony, the spending-cost / income / reserve footer, tax + security sliders and the reserve TRANSFER dialog.
//   UI.Screens.go('planets', {from})     OK = O / Space / Esc / right-click · T = transfer mode · ↑ ↓ PgUp PgDn Home End move the selection · Enter / click opens the colony
//   Orders used: tax {value} · security {value} · transfer {planet, amount}.  Reads Sim.Q.ledger + Sim.Colony; never mutates the state directly.
(function (M) {
  'use strict';
  const UI = M.UI, h = UI.h, G = M.Game, Q = M.Sim.Q, U = M.Util;

  UI.css('ledger-planets', `
    .lp { position:absolute; inset:0; display:flex; padding:1rem 1.3rem; overflow:hidden;
      background: radial-gradient(110% 80% at 10% 0%, #1a2672 0%, rgba(26,38,114,0) 58%), radial-gradient(90% 70% at 100% 100%, #2c1a5c 0%, rgba(44,26,92,0) 62%), var(--void); }
    .lp-sheet { flex:1 1 auto; min-width:0; max-width:112rem; margin:0 auto; display:flex; flex-direction:column; min-height:0; padding:.8rem 1rem .9rem; }
    .lp-head { display:flex; align-items:flex-end; gap:1rem; padding-bottom:.55rem; margin-bottom:.55rem; border-bottom:1px solid rgba(214,179,106,.38); }
    .lp-title { font:400 2.1rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.05em; text-shadow:0 0 22px rgba(214,179,106,.28); }
    .lp-sub { padding-bottom:.18rem; color:var(--mist); font-size:.98rem; }
    .lp-sub b { color:var(--ivory); font-weight:600; font-variant-numeric:tabular-nums; }
    .lp-chips { margin-left:auto; display:flex; gap:.4rem; flex-wrap:wrap; justify-content:flex-end; padding-bottom:.15rem; }
    .lp-banner { margin:0 0 .5rem; padding:.4rem .8rem; display:none; align-items:center; gap:.6rem; color:var(--gold); border:1px solid rgba(255,213,79,.55); background:rgba(255,213,79,.08); animation:lp-pulse 1.8s ease-in-out infinite; }
    .lp-banner.on { display:flex; } .lp-banner .ico { width:1.2em; height:1.2em; }
    @keyframes lp-pulse { 50% { background:rgba(255,213,79,.16); } }
    .lp-tablewrap { flex:1 1 auto; min-height:0; overflow:auto; background:rgba(3,5,18,.5); box-shadow:inset 0 0 0 1px rgba(214,179,106,.2); }
    .lp-tbl { font-size:1rem; }
    .lp-tbl th { padding:.42rem .65rem; font-size:.92rem; letter-spacing:.07em; text-transform:uppercase; background:#0d1540; }
    .lp-tbl th.sortable { user-select:none; }
    .lp-tbl td { padding:.32rem .65rem; white-space:nowrap; border-bottom:var(--hair-w, 1px) solid var(--hair, rgba(255,255,255,.045)); }
    .lp-tbl td.idx { color:var(--rose); opacity:.85; width:2.4rem; }
    .lp-tbl td.nm { font-family:var(--font-title); font-size:1.1rem; color:var(--brass-hi); }
    .lp-tbl td.dim, .lp-tbl .dim { color:var(--fog); opacity:1; }
    .lp-tbl tbody tr { cursor:var(--hand); }
    .lp-tbl tbody tr:hover { background:rgba(98,216,255,.09); }
    .lp-tbl tbody tr.sel { background:rgba(214,179,106,.17); box-shadow:inset 3px 0 0 var(--brass); }
    .lp-tbl tbody tr.unrest td:first-child { box-shadow:inset 3px 0 0 var(--ember); } .lp-tbl tbody tr.rebel td:first-child { box-shadow:inset 3px 0 0 var(--rose); }
    .lp-tbl tbody tr.rebel { background:rgba(255,92,106,.07); }
    .lp-xfer .lp-tbl tbody tr:hover { background:rgba(255,213,79,.17); box-shadow:inset 3px 0 0 var(--gold); }
    .lp-tbl tfoot td { position:sticky; bottom:0; padding:.4rem .65rem; background:#0d1540; border-top:1px solid rgba(214,179,106,.45); border-bottom:0; font-weight:600; color:var(--ivory); }
    .lp-tbl tfoot td.nm { font-family:var(--font-display); font-size:.95rem; letter-spacing:.07em; color:var(--brass); }
    .lp-nm { display:inline-flex; align-items:center; gap:.5rem; }
    .lp-orb { flex:none; width:2.75rem; height:1.75rem; display:block; box-shadow:0 0 0 1px rgba(0,0,0,.8), 0 0 6px rgba(0,0,0,.5); background:#06080f; } .lp-orb :is(canvas, img) { display:block; width:100%; height:100%; }
    .lp-dot { flex:none; width:.95rem; height:.95rem; border-radius:50%; background:radial-gradient(circle at 32% 30%, #fff9, var(--c) 42%, color-mix(in srgb, var(--c) 35%, #000) 100%); box-shadow:0 0 7px color-mix(in srgb, var(--c) 55%, transparent); }
    .lp-cap { width:.95em; height:.95em; color:var(--gold); }
    .lp-pop { position:relative; display:inline-flex; align-items:baseline; gap:.45rem; min-width:6.5rem; padding-bottom:.18rem; }
    .lp-pop b { font-weight:600; min-width:2ch; text-align:right; }
    .lp-fill { position:absolute; left:0; bottom:0; height:2px; background:linear-gradient(90deg, var(--c-eco), var(--leaf)); box-shadow:0 0 5px rgba(95,220,143,.6); }
    .lp-pop.full .lp-fill { background:var(--brass); box-shadow:0 0 5px rgba(214,179,106,.6); }
    .lp-pop .gr { font-size:.85rem; font-weight:600; } .gr.up { color:var(--leaf); } .gr.dn { color:var(--rose); }
    .lp-tag { display:inline-block; margin-right:.3rem; padding:0 .42em; font-size:.8rem; line-height:1.45; border:1px solid currentColor; color:var(--mist); letter-spacing:.02em; }
    .lp-tag.bad { color:var(--rose); background:rgba(255,92,106,.1); } .lp-tag.warn { color:var(--ember); background:rgba(255,148,64,.09); } .lp-tag.ok { color:var(--leaf); }
    .lp-tag.cy { color:var(--cyan); } .lp-tag.vi { color:var(--violet); } .lp-tag.az { color:var(--azure); } .lp-tag.teal { color:var(--teal); } .lp-tag.dim { color:var(--fog); border-color:rgba(93,106,150,.6); }
    .lp-warn { color:var(--ember); font-weight:600; } .lp-bad { color:var(--rose); font-weight:600; }
    .lp-foot { margin-top:.7rem; display:grid; grid-template-columns:1.05fr 1fr 1.7fr auto; gap:.7rem; align-items:stretch; }
    .lp-box { --ch:.5rem; position:relative; isolation:isolate; padding:.5rem .75rem .6rem; background:linear-gradient(135deg, var(--brass-lo), #2a3260 40%, #2a3260 60%, var(--brass-lo)); }
    .lp-box::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(16,23,62,.95), rgba(7,11,30,.96)); }
    .lp-bt { margin-bottom:.35rem; padding-bottom:.25rem; border-bottom:1px solid rgba(214,179,106,.28); font:400 1rem var(--font-display); letter-spacing:.06em; color:var(--brass); text-transform:uppercase; }
    .lp-line { display:grid; grid-template-columns:5.4rem 1fr 3.6rem; align-items:center; gap:.5rem; margin:.2rem 0; font-size:.95rem; }
    .lp-line .k { color:var(--mist); } .lp-line .v { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
    .lp-line.inc { grid-template-columns:1fr auto; } .lp-line.inc .v { font-size:1.1rem; }
    .lp-reserve { display:flex; align-items:baseline; gap:.5rem; margin:.1rem 0 .15rem; } .lp-reserve b { font:400 2.3rem/1 var(--font-title); color:var(--gold); letter-spacing:.02em; text-shadow:0 0 18px rgba(255,213,79,.3); font-variant-numeric:tabular-nums; }
    .lp-reserve span { color:var(--gold); font-size:1.1rem; }
    .lp-hint { margin-top:.25rem; color:var(--mist); font-size:.85rem; line-height:1.3; } .lp-hint b { color:var(--ivory); font-weight:600; }
    .lp-sl .slider { grid-template-columns:4.7rem 1.5rem 1fr 1.5rem 5.2rem; margin:.28rem 0; }
    .lp-sl .slider .s-val { font-size:.95rem; }
    .lp-btns { display:flex; flex-direction:column; justify-content:flex-end; gap:.5rem; min-width:9.5rem; padding:0 0 .1rem; }
    .lp-btns .btn { width:100%; }
    .lp-xo { margin:.6rem 0 .3rem; padding:.5rem .7rem; background:rgba(0,0,0,.28); border-left:3px solid var(--gold); font-size:1.05rem; }
    .lp-q { display:flex; gap:.4rem; margin:.5rem 0 .2rem; }
    @media (max-width: 62rem) { .lp-foot { grid-template-columns:1fr 1fr; } .lp-btns { flex-direction:row; justify-content:flex-end; } }
  `);
  const bump = css => css.replace(/(^|[}])([^{}]*)[{]/g, (m, a, sel) => a + sel.replace(/[/][*][^]*?[*][/]/g, '').split(',').map(s => s.trim()).filter(Boolean).map(s => ':root:root ' + s).join(', ') + ' {');   // raise specificity over the theme-v2 .panel/.btn rules
  // Restyle: tool-screen family — bronze bevel frame, recessed dark-brown cells, gold embossed title, blue selected row, lime production.
  UI.css('ledger-planets-orig', bump(`
    .lp { --bz-hi:#857561; --bz-md:#66584a; --bz-lo:#372d25; --bz-slot:var(--well-leather, #181411); --bz-gold:#ff9a20; --bz-pale:#f0dcc0;
      background:radial-gradient(90% 70% at 50% 0%, #2f2218 0%, rgba(47,34,24,0) 70%), #0f0e0b; }
    .lp-sheet { padding:.7rem .9rem .8rem; background:linear-gradient(135deg, var(--bz-hi), var(--bz-md) 8%, #54463a 60%, var(--bz-lo)); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.65), 0 0 0 1px #000, var(--shadow-3); }
    .lp-sheet::before, .lp-sheet::after { display:none; }
    .lp-head { border-bottom:0; padding-bottom:.4rem; }
    .lp-title { color:var(--title-hi); text-shadow:var(--title-shadow); font:400 1.85rem/1 var(--font-display); letter-spacing:.06em; text-transform:uppercase; }   /* one title style on every tool screen */
    .lp-sub { color:#f0dcc0; font-size:1.05rem; } .lp-sub b { color:var(--bz-pale); }
    .lp-tablewrap { background:#2b241e; box-shadow:inset 1px 1px 3px rgba(0,0,0,.9), 0 0 0 1px rgba(0,0,0,.7), 0 1px 0 1px rgba(255,235,200,.15); }
    .lp-tablewrap { background:linear-gradient(180deg, rgba(25,21,17,.92) 0%, rgba(25,21,17,.8) 22%, rgba(25,21,17,.62) 100%), url('assets/art/scene/scene-galaxy.webp') 50% 60% / cover no-repeat #0f0e0b; }   /* a faint chart under the rows: an early ledger is mostly empty (phones: css/phone.css keeps the plain slot) */
    .lp-tbl { border-collapse:separate; border-spacing:0 2px; }
    .lp-tbl th { background:#45392f; color:var(--bz-pale); border-bottom:0; box-shadow:inset 1px 1px 0 rgba(255,235,200,.18), inset -1px -1px 0 rgba(0,0,0,.6); font-family:var(--font-display); }
    .lp-tbl td { color:var(--bz-pale); background:var(--bz-slot); border-bottom:0; box-shadow:inset 0 1px 0 rgba(0,0,0,.6), inset 0 -1px 0 rgba(255,235,200,.07); }
    .lp-tbl td.idx { color:var(--bz-gold); opacity:1; } .lp-tbl td.nm { color:var(--bz-gold); }
    .lp-tbl td.dim, .lp-tbl .dim { color:#d2bc9a; }
    .lp-tbl tbody tr:hover td { background:#4d4138; }
    .lp-tbl tbody tr.sel td { background:#7a4c12; color:#fff4d8; box-shadow:inset 0 1px 0 rgba(255,255,255,.25), inset 0 -1px 0 rgba(0,0,0,.5); }
    .lp-tbl tbody tr.sel { box-shadow:none; }
    .lp-tbl tbody tr.rebel td { background:#3a1c17; }
    .lp-tbl tfoot td { background:#45392f; border-top:0; color:var(--bz-pale); }
    .lp-tbl tfoot td.nm { color:var(--bz-gold); }
    .lp-fill { background:linear-gradient(90deg, #4aa84a, var(--bz-lime, #70e060)); box-shadow:none; }
    .lp-box { clip-path:none; padding:.45rem .7rem .55rem; background:linear-gradient(135deg, var(--bz-hi), var(--bz-md) 25%, var(--bz-lo)); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.6), 0 0 0 1px #000; }
    .lp-box::before { inset:.2rem; clip-path:none; background:var(--well-leather, #181411); box-shadow:inset 1px 1px 2px rgba(0,0,0,.9), 0 0 0 1px rgba(255,235,200,.12); }
    .lp-bt { margin:0 0 .35rem; padding:0 0 .25rem; border-bottom:1px solid rgba(255,235,200,.14); font:600 .95rem var(--font-display); letter-spacing:.1em; color:var(--head-orange); text-shadow:0 1px 0 #000; }   /* the orange box-title tier of Map Key and Research */
    .lp-line .k { color:#f0b868; font-weight:600; font-size:.9rem; letter-spacing:.06em; text-transform:uppercase; } .lp-line .v { color:var(--bz-pale); }
    .lp-reserve b { color:var(--bz-gold); text-shadow:0 1px 0 #6b4f12; } .lp-reserve span { color:var(--bz-gold); }
    .lp-btns .btn { clip-path:none; background:rgba(0,0,0,.85); box-shadow:none; color:#fff; text-shadow:0 1px 0 #000; font:600 .85rem var(--font-display); letter-spacing:.12em; text-transform:uppercase; }
    .lp-btns .btn::before { clip-path:none; inset:1px; background:linear-gradient(180deg, #848792, #4e525c); box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.5); }
    .lp-btns .btn:hover::before { background:linear-gradient(180deg, #a0a4b0, #6c707c); }
    .lp-tag { border-radius:0; }
  `));

  // ---- vocabulary -------------------------------------------------------------------------------------------------------------------------
  const TYPE_COL = { none: '#6e7ba6', radiated: '#ff5c6a', toxic: '#b6e04a', inferno: '#ff7a3a', dead: '#9a8f86', tundra: '#9fd6e8', barren: '#b49670', minimal: '#d6c27a', desert: '#e6b45a',
    steppe: '#a6c860', arid: '#d0905a', ocean: '#4aa0f0', jungle: '#3ec86a', terran: '#5fdc8f', gaia: '#38d6c4' };
  const EVENT_LABEL = { plague: 'Plague', nova: 'Nova', comet: 'Comet', pirates: 'Pirates', accident: 'Accident', rebellion: 'Rebellion' };
  const SPECIAL_TAG = { ultrapoor: ['Ultra poor', 'dim'], poor: ['Poor', 'dim'], rich: ['Rich', 'cy'], ultrarich: ['Ultra rich', 'cy'], artifacts: ['Artifacts', 'vi'], orion: ['Orion', 'vi'] };
  const GROWTH_TAG = { hostile: ['Hostile', 'warn'], fertile: ['Fertile', 'ok'], gaia: ['Gaia', 'teal'] };
  const SEV = { bad: 3, warn: 2, ok: 1 };

  let el = null;
  const st = { from: 'galaxy', sel: -1, xfer: false, rows: [], gross: 0, sortKey: null, sortDir: 1, sorted: [] };

  // ---- data ---------------------------------------------------------------------------------------------------------------------------------
  function notesOf(r) {
    const n = [];
    if (r.unrest === 2) n.push({ t: 'Rebellion', k: 'bad' });
    else if (r.unrest === 1) n.push({ t: 'Unrest' + (r.rebels ? ' · ' + r.rebels + 'M' : ''), k: 'bad' });
    if (r.event) n.push({ t: EVENT_LABEL[r.event] || U.cap(String(r.event)), k: 'bad' });
    if (r.grow < 0 && r.pop > 0) n.push({ t: 'Shrinking', k: 'bad' });
    if (r.wasteWarn) n.push({ t: 'Waste!', k: 'warn' });
    if (r.idle > 0) n.push({ t: 'Idle factories', k: 'warn' });
    if (r.stargate) n.push({ t: 'Stargate', k: 'az' });
    const g = GROWTH_TAG[r.growthClass]; if (g) n.push({ t: g[0], k: g[1] });
    const s = SPECIAL_TAG[r.special]; if (s) n.push({ t: s[0], k: s[1] });
    return n;
  }
  function collect() {
    const S = G.S, E = G.player(), C = M.Sim.Colony, L = Q.ledger(S, E.id), oper = C.oper(E);
    const rows = L.rows.map(r => {
      const p = S.planets[r.id], ro = C.readouts(S, E, p);
      const workers = Math.max(0, p.pop - (p.rebels | 0)), opFact = Math.min(p.factories, workers * oper);
      const row = {
        n: r.n, id: r.id, star: r.star, name: r.name, type: p.type, growthClass: p.growth, special: p.special, pop: r.pop, grow: r.growth, maxPop: C.maxPopDisplay(E, p),
        terraform: !!(E.mods.terraform && p.mp3 - p.mp2 < E.mods.terraform), factories: r.factories, maxFact: C.maxFactories(E, p), idle: Math.max(0, p.factories - opFact),
        shield: r.shield, bases: r.bases, waste: r.waste, prod: r.prod, gross: p.gross | 0, dock: r.dock, dockEta: p.sliders[0] > 0 && ro.ship.text !== 'NONE' ? ro.ship.text : '',
        capital: p.id === E.capital, unrest: p.unrest | 0, rebels: p.rebels | 0, event: p.event ? p.event.type : '', stargate: !!p.stargate, ind: p.sliders[2], wasteWarn: ro.eco.text === 'WASTE', bank: p.bank | 0,
      };
      row.notes = notesOf(row); row.sev = row.notes.reduce((m, x) => Math.max(m, SEV[x.k] || 0), 0);
      return row;
    });
    return { S, E, L, rows };
  }

  // ---- the table (own implementation: sorting, keyboard selection, sticky totals) ----------------------------------------------------------------
  const dimIf = (v, txt) => (v ? txt : h('span.dim', '—'));
  // the orbit plate as a small landscape thumbnail (Gfx.WorldArt), else the coloured type dot
  function orbThumb(r) {
    const WA = M.Gfx && M.Gfx.WorldArt, path = WA && WA.enabled ? WA.orbit({ type: r.type, growth: r.growthClass, special: r.special }, G.S) : null;
    if (path) return h('span.lp-orb', WA.image(path, { fx: 0.5, fy: 0.5 }));
    return h('i.lp-dot', { style: { '--c': TYPE_COL[r.growthClass === 'gaia' ? 'gaia' : r.type] || '#889' } });
  }
  const COLS = [
    { key: 'n', label: '#', cls: 'idx', align: 'r', value: r => r.n, fmt: r => r.n },
    { key: 'name', label: 'Planet', cls: 'nm', value: r => r.name.toLowerCase(),
      fmt: r => h('span.lp-nm', orbThumb(r), h('span', r.name), r.capital ? UI.icon('home', 'lp-cap') : null) },
    { key: 'pop', label: 'Population', dir: -1, value: r => r.pop, fmt: r => {
      const g = r.grow, fill = r.maxPop > 0 ? Math.min(1, r.pop / r.maxPop) : 0;
      return h('div.lp-pop' + (fill >= 1 ? '.full' : ''), { tip: 'Population <b>' + r.pop + '</b> of ' + r.maxPop + ' max' + (g ? '<br>' + (g > 0 ? 'Growing' : 'Shrinking') + ' ' + Math.abs(g / 10).toFixed(1) + ' million per turn' : '') },
        h('i.lp-fill', { style: { width: (fill * 100).toFixed(0) + '%' } }), h('b', U.fmt(r.pop)), g ? h('span.gr.' + (g > 0 ? 'up' : 'dn'), (g > 0 ? '↑' : '↓') + Math.abs(g / 10).toFixed(1)) : null);
    } },
    { key: 'max', label: 'Max', align: 'r', dir: -1, value: r => r.maxPop, fmt: r => h('span.dim', { tip: r.terraform ? 'Terraforming can still raise this' : null }, U.fmt(r.maxPop) + (r.terraform ? '+' : '')) },
    { key: 'fact', label: 'Fact', align: 'r', dir: -1, value: r => r.factories, fmt: r => h('span' + (r.idle > 0 ? '.lp-warn' : '.t-ember'),
      { tip: r.idle > 0 ? '<b>' + r.idle + '</b> factories are idle: not enough workers to run them' : 'Maximum ' + r.maxFact + (r.factories >= r.maxFact ? ' — reached' : '') }, U.fmt(r.factories), h('span.dim', ' / ' + U.fmt(r.maxFact))) },
    { key: 'shd', label: 'Shd', align: 'c', dir: -1, value: r => r.shield, fmt: r => (r.shield ? h('b.t-azure', { tip: 'Planetary shield, class ' + U.roman(r.shield) }, U.roman(r.shield)) : h('span.dim', '—')) },
    { key: 'base', label: 'Base', align: 'r', dir: -1, value: r => r.bases, fmt: r => dimIf(r.bases, h('span.t-azure', U.fmt(r.bases))) },
    { key: 'wst', label: 'Wst', align: 'r', dir: -1, value: r => r.waste, fmt: r => (r.waste ? h('span' + (r.wasteWarn ? '.lp-bad' : '.t-ember'), { tip: r.wasteWarn ? 'Waste is piling up: raise Ecology spending' : 'Waste being cleaned up' }, U.fmt(r.waste)) : h('span.dim', '0')) },
    { key: 'prod', label: 'Prod', align: 'r', dir: -1, value: r => r.prod, fmt: r => h('b.t-ember', { tip: 'Production after costs <b>' + U.fmt(r.prod) + '</b> BC · gross ' + U.fmt(r.gross) + (r.bank ? '<br>Reserve bank ' + U.fmt(r.bank) + ' BC' : '') }, U.fmt(r.prod)) },
    { key: 'dock', label: 'Space dock', value: r => r.dock.toLowerCase(), fmt: r => (r.dock ? h('span', r.dock, r.dockEta ? h('span.dim', '  ' + r.dockEta) : null) : h('span.dim', '—')) },
    { key: 'notes', label: 'Notes', dir: -1, value: r => r.sev * 100 + r.notes.length, fmt: r => {
      if (!r.notes.length) return h('span.dim', '—');
      const shown = r.notes.slice(0, 3), more = r.notes.length - shown.length;
      return h('span', { tip: more ? r.notes.map(x => x.t).join('<br>') : null }, shown.map(x => h('span.lp-tag.' + x.k, x.t)), more ? h('span.dim', '+' + more) : null);
    } },
  ];

  function buildTable() {
    const thead = h('thead'), tbody = h('tbody'), tfoot = h('tfoot'), table = h('table.tbl.lp-tbl', thead, tbody, tfoot);
    const al = c => (c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : '');
    function head() {
      UI.clear(thead);
      thead.appendChild(h('tr', COLS.map(c => h('th', {
        class: (al(c) + ' sortable').trim(),
        onclick: () => { UI.sfx('click'); if (st.sortKey === c.key) st.sortDir = -st.sortDir; else { st.sortKey = c.key; st.sortDir = c.dir || 1; } paint(); },
      }, c.label + (st.sortKey === c.key ? (st.sortDir > 0 ? ' ▴' : ' ▾') : '')))));
    }
    function order() {
      const list = st.rows.slice();
      if (st.sortKey) { const c = COLS.find(x => x.key === st.sortKey); list.sort((a, b) => { const x = c.value(a), y = c.value(b); return ((x < y ? -1 : x > y ? 1 : 0) * st.sortDir) || (a.n - b.n); }); }
      return list;
    }
    function paint() {
      head(); UI.clear(tbody);
      st.sorted = order();
      if (!st.sorted.length) { tbody.appendChild(h('tr', h('td.dim.c', { colSpan: COLS.length, style: { padding: '2rem' } }, 'You have no colonies.'))); return; }
      for (const r of st.sorted) {
        const tr = h('tr', { class: [r.id === st.sel && 'sel', r.unrest === 2 ? 'rebel' : r.unrest ? 'unrest' : ''].filter(Boolean).join(' '), dataset: { id: r.id } });
        for (const c of COLS) tr.appendChild(h('td', { class: [c.cls, al(c)].filter(Boolean).join(' ') }, c.fmt(r)));
        tbody.appendChild(tr);
      }
    }
    tbody.addEventListener('click', e => { const tr = e.target.closest && e.target.closest('tr[data-id]'); if (!tr) return; const r = st.rows.find(x => x.id === +tr.dataset.id); if (r) activate(r); });
    table.paint = paint; table.tfoot = tfoot; table.tbody = tbody;
    return table;
  }

  function paintFoot(d) {
    const rows = d.rows, sum = k => rows.reduce((a, r) => a + r[k], 0), t = st.table.tfoot;
    UI.mount(t, h('tr', COLS.map(c => {
      let v = '';
      if (c.key === 'name') v = 'Total · ' + rows.length;
      else if (c.key === 'pop') v = U.fmt(sum('pop'));
      else if (c.key === 'max') v = U.fmt(sum('maxPop'));
      else if (c.key === 'fact') v = U.fmt(sum('factories'));
      else if (c.key === 'base') v = U.fmt(sum('bases'));
      else if (c.key === 'wst') v = U.fmt(sum('waste'));
      else if (c.key === 'prod') v = U.fmt(sum('prod'));
      return h('td', { class: [c.cls === 'nm' ? 'nm' : '', c.align === 'r' ? 'r' : c.align === 'c' ? 'c' : ''].join(' ').trim() }, v);
    })));
  }

  // ---- footer ---------------------------------------------------------------------------------------------------------------------------------
  const box = (title, ...kids) => h('div.lp-box.ch', h('div.lp-bt', title), ...kids);
  function buildFooter() {
    const E = G.player() || { tax: 0, security: 0 }, sp = st.sp = {};
    const costLine = (key, label, color, tip) => { const v = h('span.v', '0%'), b = UI.bar(0, { color }); sp[key] = { v, b }; return h('div.lp-line', { tip }, h('span.k', label), b, v); };
    const spending = box('Spending costs',
      costLine('ships', 'Ships', 'var(--c-ship)', 'Upkeep of your ships and stargates, as a share of gross production'),
      costLine('spying', 'Spying', 'var(--violet)', 'Your spy budget'),
      costLine('bases', 'Bases', 'var(--c-def)', 'Upkeep of missile bases'),
      costLine('security', 'Security', 'var(--azure)', 'Counter-espionage spending (the Security slider)'));
    const inc = st.inc = { trade: h('span.v.t-gold', '0'), planets: h('span.v.t-gold', '0'), net: h('span.v.t-gold', '0') };
    const income = box('Total income',
      h('div.lp-line.inc', h('span.k', 'Trade'), h('span', inc.trade, h('span.t-gold', ' BC'))),
      h('div.lp-line.inc', h('span.k', 'Planets'), h('span', inc.planets, h('span.t-gold', ' BC'))),
      h('div.lp-line.inc', { tip: 'What your colonies actually have to spend after every cost and tax' }, h('span.k', 'Colony budget'), h('span', inc.net, h('span.t-gold', ' BC'))));
    st.reserve = h('b', '0'); st.reserveD = h('span.small.t-leaf', '');
    st.taxHint = h('div.lp-hint');
    st.tax = UI.slider({ label: 'Tax', min: 0, max: 200, step: 5, value: E.tax | 0, color: 'var(--gold)', lockable: false,
      fmt: v => '+' + U.fmt(Math.floor(st.gross * v / 2000)) + ' BC', onChange: v => { G.order({ t: 'tax', value: v }); } });
    st.sec = UI.slider({ label: 'Security', min: 0, max: 200, step: 5, value: E.security | 0, color: 'var(--azure)', lockable: false,
      fmt: v => (v / 10).toFixed(1) + '%', onChange: v => { G.order({ t: 'security', value: v }); } });
    UI.setTip(st.tax, 'Taxes take a share of your gross production; <b>half</b> of it reaches the reserve each turn');
    UI.setTip(st.sec, 'Counter-espionage: protects you from enemy spies and costs a share of production');
    const reserve = box('Reserve', h('div.lp-reserve', st.reserve, h('span', 'BC'), st.reserveD), h('div.lp-sl', st.tax, st.sec), st.taxHint);
    st.btnX = UI.button('Transfer', () => toggleXfer(), { kbd: 'T', tip: 'Move reserve BC into a colony: it can then spend up to twice its normal output' });
    st.btnOk = UI.button('OK', () => close(), { primary: true, kbd: 'Space', sfx: 'confirm' });
    return h('div.lp-foot', spending, income, reserve, h('div.lp-btns', st.btnX, st.btnOk));
  }
  function paintFooter(d) {
    const E = d.E, L = d.L, f = E.flow || {};
    st.gross = f.gross | 0;
    for (const k of ['ships', 'spying', 'bases', 'security']) { const v = L.spending[k] || 0; st.sp[k].v.textContent = v.toFixed(1).replace(/\.0$/, '') + '%'; st.sp[k].b.set(Math.min(1, v / 40)); }
    st.inc.trade.textContent = U.fmt(L.income.trade); st.inc.planets.textContent = U.fmt(L.income.planets); st.inc.net.textContent = U.fmt(L.net);
    st.reserve.textContent = U.fmt(L.reserve);
    st.reserveD.textContent = L.taxToReserve ? '+' + U.fmt(L.taxToReserve) + ' / turn' : '';
    st.tax.api.set(E.tax | 0); st.sec.api.set(E.security | 0);                          // (re)draw: the tax readout depends on gross production
    const taxCost = Math.floor(st.gross * (E.tax | 0) / 1000), secCost = Math.floor(st.gross * (E.security | 0) / 1000);
    UI.mount(st.taxHint, 'Tax takes ', h('b', U.fmt(taxCost) + ' BC'), ' of production each turn; ', h('b.t-leaf', '+' + U.fmt(L.taxToReserve)), ' reaches the reserve. Security costs ', h('b', U.fmt(secCost) + ' BC'), '.');
    const can = L.reserve > 0;
    st.btnX.disabled = !can && !st.xfer; st.btnX.classList.toggle('disabled', !can && !st.xfer); st.btnX.classList.toggle('active', st.xfer);
  }
  function paintHead(d) {
    const rows = d.rows, bad = rows.filter(r => r.unrest).length, shrink = rows.filter(r => r.grow < 0 && r.pop > 0).length, waste = rows.filter(r => r.wasteWarn).length, idle = rows.filter(r => r.idle > 0).length;
    const pop = rows.reduce((a, r) => a + r.pop, 0), prod = rows.reduce((a, r) => a + r.prod, 0);
    UI.mount(st.sub, 'Year ', h('b', Q.year(d.S)), ' · ', h('b', rows.length), (rows.length === 1 ? ' colony' : ' colonies') + ' · population ', h('b', U.fmt(pop)), ' million · production ', h('b.t-ember', U.fmt(prod)), ' BC');
    const chips = [];
    if (bad) chips.push(UI.chip(bad + ' in unrest', 'bad'));
    if (shrink) chips.push(UI.chip(shrink + ' shrinking', 'bad'));
    if (waste) chips.push(UI.chip(waste + ' polluted', 'warn'));
    if (idle) chips.push(UI.chip(idle + ' with idle factories', 'warn'));
    UI.mount(st.chips, chips);
  }

  // ---- behaviour ------------------------------------------------------------------------------------------------------------------------------
  function refresh(showSel) {
    if (!el || !G.S) return;
    const d = collect();
    st.rows = d.rows;
    if (!st.rows.some(r => r.id === st.sel)) st.sel = st.rows.length ? st.rows[0].id : -1;
    st.table.paint(); paintFoot(d); paintFooter(d); paintHead(d);
    if (showSel) { const tr = st.table.tbody.querySelector('tr.sel'); if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' }); }
  }
  function close(snd) { if (snd) UI.sfx(snd); UI.Screens.go(st.from || 'galaxy'); }
  function setXfer(on) {
    st.xfer = !!on;
    el.classList.toggle('lp-xfer', st.xfer); st.banner.classList.toggle('on', st.xfer);
    st.btnX.classList.toggle('active', st.xfer);
    if (st.xfer) UI.sfx('open');
  }
  function toggleXfer() {
    const E = G.player();
    if (!st.xfer && !(E.bc > 0)) { UI.toast('The reserve is empty: raise the tax to fill it', 'warn'); UI.sfx('error'); return; }
    setXfer(!st.xfer);
  }
  function activate(r) {
    st.sel = r.id;
    if (st.xfer) { openTransfer(r); return; }
    G.sel.star = r.star; G.sel.fleet = -1;
    UI.sfx('click'); UI.Screens.go('galaxy');
  }
  function moveSel(delta, abs) {
    if (!st.sorted.length) return;
    let i = st.sorted.findIndex(r => r.id === st.sel);
    i = abs === undefined ? (i < 0 ? 0 : i + delta) : (abs < 0 ? st.sorted.length - 1 : abs);
    i = Math.max(0, Math.min(st.sorted.length - 1, i));
    st.sel = st.sorted[i].id; st.table.paint();
    const tr = st.table.tbody.querySelector('tr.sel'); if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest' });
  }
  async function openTransfer(r) {
    const E = G.player();
    if (!(E.bc > 0)) { UI.toast('The reserve is empty', 'warn'); return; }
    let pct = 50;
    const amt = () => Math.floor(E.bc * pct / 100), out = h('div.lp-xo');
    const paint = () => UI.mount(out, h('b.t-gold', U.fmt(amt()) + ' BC'), ' to ', h('b.t-brass', r.name), h('div.small.dim', 'Reserve afterwards: ' + U.fmt(E.bc - amt()) + ' BC'));
    const sl = UI.slider({ label: 'Amount', min: 0, max: 100, step: 1, value: pct, color: 'var(--gold)', lockable: false, fmt: v => v + '%', onChange: v => { pct = v; paint(); } });
    const quick = h('div.lp-q', [25, 50, 75, 100].map(v => UI.button(v + '%', () => { pct = v; sl.api.set(v); paint(); }, { small: true })));
    paint();
    const body = h('div', h('p', 'Reserve: ', h('b.t-gold', U.fmt(E.bc) + ' BC'), '. A colony can spend up to twice its normal output while it holds transferred funds.'), sl, quick, out);
    const pr = UI.modal({ title: 'Transfer to ' + r.name, body, width: '27rem', buttons: [{ label: 'Cancel', value: false }, { label: 'Transfer', value: true, primary: true }] });
    pr.el.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !(e.target.tagName === 'BUTTON')) { e.preventDefault(); pr.close(true); } });
    const ok = await pr;
    if (!ok || amt() <= 0) return;
    const res = G.order({ t: 'transfer', planet: r.id, amount: amt() });
    if (!res.ok) { UI.toast(res.msg || 'Transfer failed', 'bad'); UI.sfx('error'); return; }
    UI.sfx('coins'); UI.toast('Transferred ' + U.fmt(res.moved === undefined ? amt() : res.moved) + ' BC to ' + r.name, 'ok');
    setXfer(false);
  }

  // ---- screen -------------------------------------------------------------------------------------------------------------------------------
  UI.Screens.register('planets', {
    create(root) {
      st.table = buildTable();
      st.sub = h('div.lp-sub'); st.chips = h('div.lp-chips');
      st.banner = h('div.lp-banner', UI.icon('money'), h('span', 'Transfer: choose the colony that receives funds from the reserve. ' + UI.Phone.say('Press Esc to cancel.', 'Back cancels.')));
      const head = h('div.lp-head', h('div.lp-title', 'Planets'), st.sub, st.chips);
      el = h('div.lp', h('div.lp-sheet.panel', head, st.banner, h('div.lp-tablewrap', st.table), buildFooter()));
      root.appendChild(el);
      const scr = { screen: 'planets' };
      UI.bindKey('o', () => close('confirm'), scr); UI.bindKey('space', () => close('confirm'), scr);
      UI.bindKey('escape', () => { if (st.xfer) setXfer(false); else close('cancel'); }, scr);
      UI.bindKey('t', toggleXfer, scr);
      UI.bindKey('arrowdown', () => moveSel(1), scr); UI.bindKey('arrowup', () => moveSel(-1), scr);
      UI.bindKey('pagedown', () => moveSel(10), scr); UI.bindKey('pageup', () => moveSel(-10), scr);
      UI.bindKey('.', () => moveSel(10), scr); UI.bindKey(',', () => moveSel(-10), scr);
      UI.bindKey('home', () => moveSel(0, 0), scr); UI.bindKey('end', () => moveSel(0, -1), scr);
      UI.bindKey('enter', () => { const r = st.rows.find(x => x.id === st.sel); if (r) activate(r); }, scr);
      root.addEventListener('contextmenu', e => { e.preventDefault(); if (st.xfer) setXfer(false); else close('cancel'); });
      M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'planets') refresh(false); });
    },
    enter(params) {
      if (!G.S) { UI.Screens.go('menu'); return; }
      st.from = (params && params.from) || 'galaxy';
      const sid = G.sel.star, own = sid >= 0 && G.S.planets[sid] && G.S.planets[sid].owner === G.S.playerId;
      st.sel = own ? sid : -1;
      setXfer(false); refresh(true);
    },
  });
})(window.MOO);
