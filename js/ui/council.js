// Galactic (High) Council — the arched chamber: nomination, every empire's ballot replayed in turn, YOUR ballot, the tally and the verdict
// (research/06 §5.19, research/05 §6). Scene art = Gfx.Scenes.council (alcove portraits, pedestal hologram); this file adds the tally bar, the message line,
// the speaker's hologram bust, the numbered ballot cards and the Accept / Defy dialog.
//
//   MOO.UI.Council.show(interrupt)    -> Promise<vote>   interrupt = {type:'council', info}  (info = Sim.Council.convene(...)). The AI ballots in info.ballots are
//                                                         replayed one by one, then you pick  1 candidate A / 2 candidate B / 0 abstain  (keys or cards; Esc = abstain).
//                                                         Resolves with the value Council.resolve expects: a candidate EMPIRE ID, or -1 (abstain). The chamber stays up
//                                                         so that result() continues in the same scene.
//   MOO.UI.Council.result(interrupt)  -> Promise<void>   interrupt = {type:'councilResult', result}  (result = Council.resolve(...)). Counts the votes, names the winner,
//                                                         and when result.needsAnswer is set asks "Accept the ruling?" (Y / N) and calls result.finish(accepted) itself
//                                                         (accepting a verdict ends the game -> the 'gameover' interrupt follows; defying = Final War). "No winner" is a message.
//   MOO.UI.Council.titleFor(S, empireId, year?) -> string   the pompous title (Data.names.councilTitles) the elected ruler receives (deterministic per game + year).
//   MOO.UI.Council.isActive() -> bool
//   screen 'council'  (params {_run}; opened without one it shows a demo chamber with the live electorate, Esc closes it)
// Keys: Space / Enter / click = next · Esc / right-click = skip the replay (and abstain at the ballot) · 1 / 2 / 0 = your vote · Y / N = accept / defy.
// Soft dependencies (all guarded): Gfx.Scenes.council, Gfx.Portraits, Audio.Music ('council') / SFX ('vote','gavel','war'), Settings ('animSpeed','reduceMotion'), Perf.q.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, G = M.Game, doc = document;
  const PI = Math.PI, TAU = PI * 2, min = Math.min, max = Math.max, round = Math.round;
  const Council = (UI.Council = {});

  // ================================================================== small helpers
  const clamp = U.clamp;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const setting = (k, d) => { try { const v = M.Settings && M.Settings.get ? M.Settings.get(k) : undefined; return v === undefined ? d : v; } catch (e) { return d; } };
  const reduced = () => !!setting('reduceMotion', false) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const animSpeed = () => { const v = +setting('animSpeed', 1); return v <= 0 ? 0 : v >= 2 ? 2 : 1; };
  const PQ = () => (M.Perf && M.Perf.q) || { dpr: 1.5, animFps: 60 };
  const Mu = () => (M.Audio && M.Audio.Music) || null;
  const musicPlay = (id, o) => { try { const m = Mu(); if (m && m.play) return m.play(id, o); } catch (e) { /* audio is optional */ } return null; };
  let sfxIds = null;
  function sfx(id, fb) {
    try {
      const S = M.Audio && M.Audio.SFX; if (!S || !S.play) return;
      if (!sfxIds && S.list) sfxIds = S.list().map(x => (typeof x === 'string' ? x : x && x.id));
      S.play(sfxIds && sfxIds.indexOf(id) < 0 && fb ? fb : id);
    } catch (e) { /* audio is optional */ }
  }
  const hexCache = {};
  function empHex(c) {
    c = clamp(round(+c || 0), 0, 5);
    if (hexCache[c]) return hexCache[c];
    let v = '';
    try { v = getComputedStyle(doc.documentElement).getPropertyValue('--emp' + c).trim(); } catch (e) { /* no styles yet */ }
    return (hexCache[c] = /^#[0-9a-f]{6}$/i.test(v) ? v : ['#4a90e8', '#4ed17a', '#b45be8', '#e8504d', '#f1eee4', '#e8c94a'][c]);
  }
  const sceneOf = () => (M.Gfx && M.Gfx.Scenes && M.Gfx.Scenes.council) || null;
  const mkCanvas = (w, hh) => { const c = doc.createElement('canvas'); c.width = max(1, round(w)); c.height = max(1, round(hh)); return c; };

  // round banner badge (Portraits.drawBadge) painted once into a canvas; falls back to a banner-coloured medallion
  function badgeEl(race, px, hex) {
    const dpr = min(window.devicePixelRatio || 1, 2), S = round(px * dpr), c = h('canvas');
    c.width = c.height = S; c.style.width = c.style.height = px + 'px';
    const g = c.getContext('2d'), P = M.Gfx && M.Gfx.Portraits;
    let ok = false;
    const paint = () => { P.drawBadge(g, race, S / 2, S / 2, S / 2 - 1, { t: 0, color: hex, bg: true, _snap: true, key: 'cou-badge|' + race + '|' + hex }); };
    try { if (P && P.drawBadge && (!P.RACES || P.RACES.indexOf(race) >= 0)) { paint(); ok = true; if (P.photo && !P.photo.ready(race)) P.photo.whenReady(race, () => { try { g.clearRect(0, 0, S, S); paint(); } catch (e) { /* ignore */ } }); } } catch (e) { ok = false; }
    if (!ok) {
      g.fillStyle = hex || '#d6b36a'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 1, 0, TAU); g.fill();
      g.fillStyle = 'rgba(6,9,25,.85)'; g.font = '700 ' + round(S * 0.5) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(race || '?').charAt(0).toUpperCase(), S / 2, S / 2 + 1);
    }
    return c;
  }

  // the pompous title of the elected ruler (names.js); endings.js uses the same algorithm
  Council.titleFor = function (S, empireId, year) {
    const list = (M.Data && M.Data.names && M.Data.names.councilTitles) || ['High Master of the New Republic'];
    const y = year !== undefined ? year : (S && S.gameOver && S.gameOver.year) || (S && S.year) || 0;
    return list[U.hash(String(S && S.seed) + '|' + y + '|' + empireId) % list.length];
  };

  // ================================================================== styles
  UI.css('council', `
    .cou { position:absolute; inset:0; overflow:hidden; background:#02040e; outline:none; user-select:none; }
    .cou-cv { position:absolute; inset:0; width:100%; height:100%; }
    .cou-shade { position:absolute; left:0; right:0; bottom:0; height:30%; pointer-events:none; background:linear-gradient(0deg, rgba(2,4,14,.86), rgba(2,4,14,.5) 58%, rgba(2,4,14,0)); }
    .cou-top { position:absolute; left:50%; top:1.3%; width:min(78%, 76rem); transform:translateX(-50%); pointer-events:none; z-index:3; }
    .cou-tally { padding:.4rem .95rem .85rem; }
    .cou-trow { display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); align-items:center; gap:1rem; }
    .cou-cand { display:flex; align-items:center; gap:.65rem; min-width:0; --c:var(--brass); }
    .cou-cand.r { flex-direction:row-reverse; text-align:right; }
    .cou-cand canvas { flex:none; }
    .cou-cand .nm { min-width:0; font:400 1.12rem/1.1 var(--font-display); color:var(--c); letter-spacing:.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:0 0 12px color-mix(in srgb, var(--c) 40%, transparent); }
    .cou-cand .nm small { display:block; margin-top:.12rem; font:400 .78rem var(--font-ui); color:var(--mist); letter-spacing:.02em; text-shadow:none; overflow:hidden; text-overflow:ellipsis; }
    .cou-cand .vt { margin-left:auto; flex:none; font:400 2.05rem/1 var(--font-title); color:var(--gold); text-shadow:0 0 16px rgba(255,213,79,.4); font-variant-numeric:tabular-nums; }
    .cou-cand.r .vt { margin-left:0; margin-right:auto; }
    .cou-cand .vt small { font:400 .78rem var(--font-ui); color:var(--mist); margin-left:.3rem; text-shadow:none; }
    .cou-cand.win .nm { color:var(--gold); }
    .cou-mid { text-align:center; line-height:1.12; white-space:nowrap; }
    .cou-mid b { display:block; font:400 1.45rem/1 var(--font-title); color:var(--ivory); font-variant-numeric:tabular-nums; }
    .cou-mid span { display:block; margin-top:.2rem; font:400 .74rem var(--font-ui); color:var(--mist); letter-spacing:.09em; text-transform:uppercase; }
    .cou-meter { position:relative; height:.46rem; margin-top:.6rem; background:rgba(255,255,255,.07); box-shadow:inset 0 0 0 1px rgba(214,179,106,.22); }
    .cou-meter i { position:absolute; top:0; bottom:0; width:0; transition:width .6s var(--ease); }
    .cou-meter i.a { left:0; background:linear-gradient(90deg, color-mix(in srgb, var(--ca) 50%, #000), var(--ca)); box-shadow:0 0 10px color-mix(in srgb, var(--ca) 55%, transparent); }
    .cou-meter i.b { right:0; background:linear-gradient(270deg, color-mix(in srgb, var(--cb) 50%, #000), var(--cb)); box-shadow:0 0 10px color-mix(in srgb, var(--cb) 55%, transparent); }
    .cou-meter u { position:absolute; top:-.28rem; bottom:-.28rem; width:2px; margin-left:-1px; background:var(--brass-hi); box-shadow:0 0 6px rgba(243,220,160,.85); }
    .cou-meter u::after { content:attr(data-l); position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:.08rem; font:500 .66rem var(--font-ui); color:var(--brass-hi); letter-spacing:.06em; white-space:nowrap; }
    .cou-vtags { position:absolute; inset:0; pointer-events:none; z-index:2; }
    .cou-vt { position:absolute; display:flex; justify-content:center; align-items:center; gap:.3rem; flex-wrap:nowrap; white-space:nowrap; }
    .cou-vt .chip-t { display:inline-flex; align-items:center; gap:.3em; padding:.08em .55em; font:600 .66rem var(--font-ui); letter-spacing:.09em; text-transform:uppercase; color:#1d1606; background:linear-gradient(180deg, #f0d596, #bf9748);
      clip-path:polygon(.3rem 0,calc(100% - .3rem) 0,100% .3rem,100% calc(100% - .3rem),calc(100% - .3rem) 100%,.3rem 100%,0 calc(100% - .3rem),0 .3rem); }
    .cou-vt .chip-t .ico { width:.95em; height:.95em; }
    .cou-vt .chip-t.you { background:linear-gradient(180deg, #a8ecff, #4fb6d8); }
    .cou-vt .chip-t.nom { background:linear-gradient(180deg, #ffe58a, #d9a526); }
    .cou-vt .arrow { display:inline-flex; align-items:center; gap:.4em; padding:.1em .65em .1em .5em; font:500 .78rem var(--font-ui); color:var(--ivory); background:rgba(6,9,25,.84); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--c) 70%, #000);
      clip-path:polygon(.3rem 0,calc(100% - .3rem) 0,100% .3rem,100% calc(100% - .3rem),calc(100% - .3rem) 100%,.3rem 100%,0 calc(100% - .3rem),0 .3rem); animation:cou-pop .35s var(--ease) both; }
    .cou-vt .arrow i { width:.55em; height:.55em; transform:rotate(45deg); background:var(--c); box-shadow:0 0 6px var(--c); }
    .cou-vt .arrow.none { color:var(--mist); box-shadow:inset 0 0 0 1px rgba(152,165,207,.45); }
    @keyframes cou-pop { from { opacity:0; transform:translateY(-4px) scale(.92); } to { opacity:1; transform:none; } }
    .cou-bottom { position:absolute; left:50%; bottom:1.5%; width:min(82%, 80rem); transform:translateX(-50%); display:flex; flex-direction:column; gap:.55rem; z-index:3; }
    .cou-msg { min-height:2.9rem; display:flex; align-items:center; justify-content:center; padding:.1rem 1rem; text-align:center; pointer-events:none;
      font:400 clamp(1.1rem, 2.55vh, 1.75rem)/1.22 var(--font-title); color:var(--ivory); letter-spacing:.012em; text-shadow:0 2px 14px #000, 0 0 3px #000, 0 0 24px rgba(0,0,0,.8); }
    .cou-msg > span { max-width:100%; }
    .cou-msg b { font-weight:400; color:var(--c, var(--brass-hi)); text-shadow:0 2px 14px #000, 0 0 3px #000, 0 0 18px color-mix(in srgb, var(--c, #f3dca0) 45%, transparent); }
    .cou-msg.bad { color:#ffb0b6; }
    .cou-msg.say > span { animation:cou-say .5s var(--ease) both; }
    @keyframes cou-say { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:none; } }
    .cou-cards { display:flex; gap:.75rem; justify-content:center; align-items:stretch; }
    .cou-cards:empty { display:none; }
    .cou-card { --ch:.55rem; --poly:polygon(var(--ch) 0, calc(100% - var(--ch)) 0, 100% var(--ch), 100% calc(100% - var(--ch)), calc(100% - var(--ch)) 100%, var(--ch) 100%, 0 calc(100% - var(--ch)), 0 var(--ch));
      position:relative; isolation:isolate; flex:1 1 0; min-width:0; max-width:27rem; display:flex; align-items:center; gap:.75rem; padding:.5rem .95rem .5rem .6rem; border:0; cursor:pointer; text-align:left; color:var(--ivory);
      font:inherit; background:linear-gradient(180deg, var(--cc, var(--brass)), var(--brass-lo)); clip-path:var(--poly); transition:filter .15s, transform .08s, opacity .25s; animation:cou-pop .4s var(--ease) both; }
    .cou-card::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, #25316b, #131b46); transition:background .15s; }
    .cou-card:hover { filter:brightness(1.14); } .cou-card:hover::before { background:linear-gradient(180deg, #34448c, #1a2459); }
    .cou-card:active { transform:translateY(1px); }
    .cou-card:focus-visible { outline:none; filter:brightness(1.2); }
    .cou-card.dim { opacity:.35; pointer-events:none; filter:grayscale(.7); }
    .cou-card.picked { --cc:var(--gold); filter:brightness(1.2); }
    .cou-card .key { flex:none; display:grid; place-items:center; width:2.25rem; height:2.25rem; font:400 1.4rem/1 var(--font-display); color:#261b06; background:linear-gradient(180deg, #f6dc9c, #bf9748);
      clip-path:polygon(28% 0,72% 0,100% 28%,100% 72%,72% 100%,28% 100%,0 72%,0 28%); }
    .cou-card canvas { flex:none; }
    .cou-card .tx { min-width:0; display:flex; flex-direction:column; gap:.1rem; }
    .cou-card .t1 { font:400 1.12rem/1.1 var(--font-display); letter-spacing:.03em; color:var(--c, var(--brass-hi)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cou-card .t2 { font:400 .82rem/1.2 var(--font-ui); color:var(--mist); }
    .cou-card .cnt { margin-left:auto; flex:none; text-align:right; font:400 1.55rem/1 var(--font-title); color:var(--gold); font-variant-numeric:tabular-nums; }
    .cou-card .cnt small { display:block; margin-top:.12rem; font:400 .68rem var(--font-ui); color:var(--mist); letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
    .cou-card.bad { --cc:var(--rose); } .cou-card.bad .key { background:linear-gradient(180deg, #ffb0b6, #c8404f); color:#2a0709; }
    .cou-card.bad .t1 { color:#ffb0b6; }
    .cou-card.big { padding:.65rem 1.1rem .65rem .7rem; } .cou-card.big .t1 { font-size:1.3rem; }
    .cou-card.big .t2 { white-space:normal; }
    .cou-card.go { flex:0 1 22rem; justify-content:center; padding:.7rem 1.4rem; } .cou-card.go .t1 { color:var(--brass-hi); font-size:1.25rem; }
    .cou-card.go .tx { align-items:center; text-align:center; }
    .cou-card.shake { animation:cou-shake .35s linear both; }
    @keyframes cou-shake { 20% { transform:translateX(-5px); } 40% { transform:translateX(5px); } 60% { transform:translateX(-3px); } 80% { transform:translateX(3px); } }
    .cou-hint { position:absolute; left:1rem; bottom:.55rem; z-index:4; display:flex; gap:.9rem; align-items:center; font:400 .8rem var(--font-ui); color:var(--mist); opacity:.85; pointer-events:none; }
    .cou-hint kbd { padding:.04rem .38rem; margin-right:.3rem; font:600 .72rem var(--font-ui); color:var(--brass-hi); background:rgba(214,179,106,.14); box-shadow:inset 0 0 0 1px rgba(214,179,106,.4); }
    .cou-skip { position:absolute; right:1rem; bottom:.55rem; z-index:4; }
    .cou-year { position:absolute; left:1.1rem; top:1.5%; z-index:3; pointer-events:none; text-align:left; text-shadow:0 2px 12px #000; }
    .cou-year b { display:block; font:400 1.6rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.04em; }
    .cou-year span { display:block; margin-top:.18rem; font:400 .74rem var(--font-ui); color:var(--mist); letter-spacing:.14em; text-transform:uppercase; }
    @media (max-width: 1000px) { .cou-year { display:none; } .cou-card .cnt { display:none; } }
  `);

  // "original" restyle (research/ui-ref C 7b): lime vote-tally band on top, amber-gold dialogue band at the bottom, bronze/teal framing.
  UI.css('council-orig', `
    .cou-tally { --bev-hi:#c08a50; --bev-mid:#6a4326; --bev-lo:#2a160a; }
    :root:root .cou-tally::before { background:linear-gradient(180deg,rgba(24,12,6,.93),rgba(10,5,3,.95)); }
    .cou-cand .nm { color:var(--c, #a0e050); text-shadow:1px 1px 0 #000; letter-spacing:.05em; text-transform:uppercase; font-size:1rem; }
    .cou-cand .vt { color:#a0e050; text-shadow:1px 1px 0 #1c3408; }
    .cou-mid b { color:#a0e050; text-shadow:1px 1px 0 #1c3408; } .cou-mid span { color:#d0a040; }
    .cou-meter { background:#10080a; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 rgba(208,160,64,.5); }
    .cou-meter u { background:#d0a040; box-shadow:none; } .cou-meter u::after { color:#d0a040; }
    .cou-shade { background:linear-gradient(0deg, rgba(6,2,2,.9), rgba(6,2,2,.55) 58%, rgba(6,2,2,0)); }
    .cou-msg { color:#e0b040; font-family:var(--font-display); font-weight:600; letter-spacing:.04em; text-shadow:1px 1px 0 #2a1808, 0 2px 12px #000; }
    .cou-msg b { color:var(--c, #f0d070); text-shadow:1px 1px 0 #2a1808, 0 2px 12px #000; }
    .cou-card { clip-path:none; background:linear-gradient(180deg,#e8c070,var(--cc, #b07a38) 30%,#4a2c12); box-shadow:0 0 0 1px #000; } .cou-card::before { clip-path:none; background:linear-gradient(180deg,#0e3a3a,#06201f); inset:2px; }
    .cou-card:hover::before { background:linear-gradient(180deg,#165252,#0a2e2e); }
    .cou-card .t1 { text-transform:uppercase; letter-spacing:.05em; color:#e8d098; } .cou-card .t2 { color:#9ed8cc; } .cou-card .cnt { color:#a0e050; }
  `);

  // ================================================================== DOM
  const CN = {};
  let RUN = null, chain = Promise.resolve();
  const ABORT = { aborted: true };

  function buildTally() {
    CN.cA = h('div.cou-cand.l'); CN.cB = h('div.cou-cand.r');
    CN.tot = h('b', '0'); CN.need = h('span', '');
    CN.mA = h('i.a'); CN.mB = h('i.b'); CN.tA = h('u'); CN.tB = h('u');
    CN.meter = h('div.cou-meter', CN.mA, CN.mB, CN.tA, CN.tB);
    return h('div.panel.cou-tally', h('div.cou-trow', CN.cA, h('div.cou-mid', CN.tot, CN.need), CN.cB), CN.meter);
  }
  function build(root) {
    CN.cv = h('canvas.cou-cv');
    CN.tags = h('div.cou-vtags');
    CN.year = h('div.cou-year');
    CN.top = h('div.cou-top', buildTally());
    CN.msg = h('div.cou-msg', { 'aria-live': 'polite' });
    CN.cards = h('div.cou-cards');
    CN.hint = h('div.cou-hint');
    CN.skip = UI.button('Skip', () => act('skip'), { small: true, kbd: 'Esc', tip: 'Skip the replay of the ballots' });
    CN.root = h('div.cou', { tabindex: '-1' }, CN.cv, h('div.cou-shade'), CN.tags, CN.year, CN.top, h('div.cou-bottom', CN.msg, CN.cards), CN.hint, h('div.cou-skip', CN.skip));
    CN.root.addEventListener('contextmenu', e => { e.preventDefault(); act('skip'); });
    CN.root.addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('button')) act('next'); });
    root.appendChild(CN.root);
    UI.watchSize(CN.cv, () => { CN.dirty = true; });
  }

  // ================================================================== sequencing helpers
  function beat(R, ms) {                                        // wait ms (skippable by Space / click; instant while skipping everything); throws ABORT when the scene was left
    if (R.leaving) throw ABORT;
    if (R.skipAll || R.speed === 0 || ms <= 0) return Promise.resolve();
    return new Promise(res => {
      const w = { res, timer: setTimeout(() => { if (R.waiter === w) R.waiter = null; res(); }, ms / (R.speed === 2 ? 2 : 1)) };
      R.waiter = w;
    }).then(() => { if (R.leaving) throw ABORT; });
  }
  function nudge(R) { if (R && R.waiter) { clearTimeout(R.waiter.timer); const w = R.waiter; R.waiter = null; w.res(); } }
  const who = (e, text) => h('b', { style: { '--c': empHex(e.color) } }, text);
  const gold = text => h('b', { style: { '--c': '#ffd54f' } }, text);
  const brass = text => h('b', { style: { '--c': '#f3dca0' } }, text);
  function say(R, parts, cls) {
    const m = CN.msg; UI.clear(m);
    const span = h('span'); for (const p of [].concat(parts)) span.appendChild(typeof p === 'string' ? doc.createTextNode(p) : p);
    m.appendChild(span);
    m.className = 'cou-msg' + (cls ? ' ' + cls : '');
    if (R && !R.rm) { void m.offsetWidth; m.classList.add('say'); }
  }
  const leaderOf = e => 'Emperor ' + e.leader;
  const nameIt = (e, text) => who(e, text || leaderOf(e));
  const votesText = n => n + (n === 1 ? ' vote' : ' votes');

  // ================================================================== run state
  function arrange(ids, A, B) {                                 // the candidates take the two seats nearest the pedestal, everyone else fills in
    const n = ids.length, slots = new Array(n).fill(-1);
    let ia = -1, ib = -1;
    if (n >= 2) { if (n % 2 === 0) { ia = n / 2 - 1; ib = n / 2; } else { ia = max(0, (n - 1) / 2 - 1); ib = min(n - 1, (n - 1) / 2 + 1); } }
    if (ia >= 0 && ids.indexOf(A) >= 0) slots[ia] = A;
    if (ib >= 0 && ids.indexOf(B) >= 0) slots[ib] = B;
    const rest = ids.filter(id => slots.indexOf(id) < 0);
    for (let i = 0; i < n; i++) if (slots[i] < 0) slots[i] = rest.shift();
    return slots;
  }
  function newRun(spec) {
    const S = G.S, info = spec.info || null, res = spec.res || null;
    const el = info ? info.electorate : (S && M.Sim.Council ? M.Sim.Council.electorate(S) : []);
    const E = {};
    for (const e of el) E[e.empire] = { id: e.empire, race: e.race, name: e.name, plural: e.plural, leader: e.leader, color: e.color, human: !!e.human, alive: !!e.alive, votes: e.votes | 0, pop: e.pop | 0 };
    const cand = (info ? info.candidates : res ? res.candidates : []).slice();
    const ids = el.filter(e => e.alive).map(e => e.empire);
    const order = arrange(ids.slice(0, 6), cand[0], cand[1]);
    const R = {
      spec, kind: spec.kind, S, info, res, E, ids: order, A: cand[0], B: cand[1], total: info ? info.total : res ? res.total : 0, need: info ? info.need : res ? res.need : 0,
      t: 0, acc: 0, rm: reduced(), speed: animSpeed(), holo: 'galaxy', speaker: -1, speakT: 0, skipAll: false, waiter: null, cast: {}, seatOf: {}, seats: [], meta: [], prompt: null,
      awaiting: false, orphan: 0, finishing: false, leaving: false, prevId: spec.prevId, prevParams: spec.prevParams, tagKey: '', lay: null, demo: !!spec.demo, phase: '',
    };
    for (const id of ids) R.cast[id] = 0;
    order.forEach((id, i) => {
      const e = E[id]; R.seatOf[id] = i;
      R.seats.push({ race: e.race, name: e.name, color: empHex(e.color), state: 'idle', votes: e.votes });
      R.meta.push({ id, vote: -2, nominee: false, tag: h('div.cou-vt') });
    });
    return R;
  }
  function resetTags(R) {
    UI.clear(CN.tags);
    for (const m of R.meta) CN.tags.appendChild(m.tag);
    R.tagKey = '';
  }
  function refreshTags(R) {                                      // chips under each plaque: YOU · NOMINEE · → whom they voted for
    for (const m of R.meta) {
      const e = R.E[m.id], t = m.tag; UI.clear(t);
      if (e.human) t.appendChild(h('span.chip-t.you', 'You'));
      if (m.nominee) t.appendChild(h('span.chip-t.nom', UI.icon('crown'), m.vote === -2 ? 'Nominee' : null));
      if (m.vote >= 0) { const c = R.E[m.vote]; t.appendChild(h('span.arrow', { style: { '--c': empHex(c.color) } }, h('i'), m.vote === m.id ? 'Self' : c.leader)); }
      else if (m.vote === -1) t.appendChild(h('span.arrow.none', 'Abstains'));
    }
  }
  function paintTally(R) {
    const A = R.E[R.A], B = R.E[R.B]; if (!A || !B) return;
    const side = (box, e, votes) => {
      UI.clear(box);
      box.classList.toggle('win', !!(R.res && R.res.winner === e.id));
      box.style.setProperty('--c', empHex(e.color));
      box.appendChild(badgeEl(e.race, 38, empHex(e.color)));
      box.appendChild(h('div.nm', e.human ? 'Yourself' : leaderOf(e), h('small', (e.human ? e.leader + ' of the ' : 'of the ') + e.name + ' · ' + votesText(e.votes))));
      box.appendChild(h('div.vt', String(votes), h('small', votes === 1 ? 'vote' : 'votes')));
    };
    side(CN.cA, A, R.cast[A.id] | 0); side(CN.cB, B, R.cast[B.id] | 0);
    CN.tot.textContent = String(R.total);
    CN.need.textContent = (R.total === 1 ? 'vote in all' : 'votes in all') + ' · ' + R.need + ' needed';
    const tot = max(1, R.total), fa = (R.cast[A.id] | 0) / tot, fb = (R.cast[B.id] | 0) / tot, nd = R.need / tot;
    CN.meter.style.setProperty('--ca', empHex(A.color)); CN.meter.style.setProperty('--cb', empHex(B.color));
    CN.mA.style.width = (clamp(fa, 0, 1) * 100).toFixed(2) + '%'; CN.mB.style.width = (clamp(fb, 0, 1) * 100).toFixed(2) + '%';
    CN.tA.style.left = (clamp(nd, 0, 1) * 100).toFixed(2) + '%'; CN.tB.style.left = (clamp(1 - nd, 0, 1) * 100).toFixed(2) + '%';
    CN.tA.setAttribute('data-l', String(R.need)); CN.tB.setAttribute('data-l', String(R.need));
  }

  // ================================================================== painting
  function fit() {
    const cv = CN.cv, dpr = min(window.devicePixelRatio || 1, PQ().dpr || 1.5, 1.75);
    const w = cv.clientWidth, hh = cv.clientHeight;
    if (w < 40 || hh < 40) return null;
    const bw = round(w * dpr), bh = round(hh * dpr);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hh, dpr };
  }
  function fallbackScene(g, w, hh, t, R) {                       // plain chamber when Gfx.Scenes.council is missing
    const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, '#0a1030'); gr.addColorStop(1, '#02040e'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    const n = R.seats.length, P = M.Gfx && M.Gfx.Portraits, seats = [];
    for (let i = 0; i < n; i++) {
      const s = R.seats[i], bw = min(w / (n + 1), hh * 0.42), bh = bw * 1.25, x = w * (i + 1) / (n + 1) - bw / 2, y = hh * 0.2;
      g.fillStyle = 'rgba(214,179,106,.25)'; g.fillRect(x - 2, y - 2, bw + 4, bh + 4);
      try { if (P && P.draw) P.draw(g, s.race, x, y, bw, bh, { t, bg: true, color: s.color, mood: 'neutral', talking: s.state === 'speaking', key: 'cou-fb' + i }); } catch (e) { /* no portrait */ }
      g.fillStyle = s.state === 'abstain' ? '#98a5cf' : '#ece6d3'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText(s.name + '  ' + s.votes, x + bw / 2, y + bh + 24);
      seats.push({ x, y, w: bw, h: bh, plaque: { x: x, y: y + bh + 8, w: bw, h: 24 }, cx: x + bw / 2 });
    }
    return { seats, hologram: { x: w * 0.4, y: hh * 0.3, w: w * 0.2, h: hh * 0.3 }, pedestal: { cx: w / 2, cy: hh * 0.6, rx: 60, ry: 6 } };
  }
  function applyLayout(R, lay, w, hh) {
    if (!lay || !lay.seats) return;
    let key = w + 'x' + hh + ':';
    for (let i = 0; i < R.meta.length; i++) { const p = lay.seats[i] && lay.seats[i].plaque; if (p) key += round(p.x) + ',' + round(p.y) + ',' + round(p.w) + ';'; }
    if (key === R.tagKey) return;
    R.tagKey = key;
    for (let i = 0; i < R.meta.length; i++) {
      const s = lay.seats[i], p = s && s.plaque; if (!p) continue;
      const st = R.meta[i].tag.style;
      st.left = round(p.x - p.w * 0.1) + 'px'; st.width = round(p.w * 1.2) + 'px'; st.top = round(p.y + p.h + 5) + 'px';
    }
  }
  // the speaker's bust, projected over the pedestal hologram (tinted portrait + scanlines)
  function drawBust(R, g, lay, t, dt) {
    const P = M.Gfx && M.Gfx.Portraits, ho = lay && lay.hologram, pe = lay && lay.pedestal;
    const want = R.speaker >= 0 && R.speaker in R.seatOf ? R.speaker : -1;
    if (want >= 0) { if (R.bustFor !== want) { R.bustFor = want; R.bustK = R.bustK > 0.25 ? 0.25 : R.bustK; } R.bustK = min(1, (R.bustK || 0) + dt * 5); }
    else R.bustK = max(0, (R.bustK || 0) - dt * 5);
    if (!P || !ho || !pe || !(R.bustK > 0.01) || R.bustFor === undefined) return;
    const e = R.E[R.bustFor], seat = R.seats[R.seatOf[R.bustFor]]; if (!e || !seat) return;
    const bh = ho.h * 0.96, bw = bh * 0.8;
    let bc = R.bustCv; if (!bc || bc.width !== round(bw) || bc.height !== round(bh)) { bc = R.bustCv = mkCanvas(bw, bh); R.bustG = bc.getContext('2d'); }
    const b = R.bustG; b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, bc.width, bc.height);
    try { P.draw(b, e.race, 0, 0, bc.width, bc.height, { t, mood: 'neutral', talking: true, bg: false, color: seat.color, key: 'cou-bust' }); } catch (er) { return; }
    b.globalCompositeOperation = 'source-atop'; b.fillStyle = 'rgba(64,176,255,0.55)'; b.fillRect(0, 0, bc.width, bc.height);
    b.fillStyle = 'rgba(190,240,255,0.18)'; b.fillRect(0, 0, bc.width, bc.height);
    b.globalCompositeOperation = 'destination-out'; b.fillStyle = 'rgba(0,0,0,0.42)';
    const step = max(3, round(bc.height / 90)), off = round((t * 24) % step);
    for (let y = off; y < bc.height; y += step) b.fillRect(0, y, bc.width, max(1, step / 3));
    const k = R.bustK * (0.9 + 0.1 * Math.sin(t * 31) * Math.sin(t * 9.7)), cx = pe.cx, base = pe.cy - ho.h * 0.02;
    g.save();
    const rg = g.createRadialGradient(cx, base - bh * 0.5, bh * 0.1, cx, base - bh * 0.5, bh * 0.78);
    rg.addColorStop(0, 'rgba(2,6,28,' + (0.78 * k).toFixed(3) + ')'); rg.addColorStop(0.7, 'rgba(2,6,28,' + (0.5 * k).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(2,6,28,0)');
    g.fillStyle = rg; g.fillRect(cx - bh, base - bh * 1.3, bh * 2, bh * 1.5);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.9 * k;
    g.drawImage(bc, cx - bw / 2, base - bh, bw, bh);
    g.globalAlpha = 0.4 * k; g.drawImage(bc, cx - bw / 2 - 1.5, base - bh, bw, bh);
    const gl = g.createRadialGradient(cx, base, 2, cx, base, bw * 0.7); gl.addColorStop(0, 'rgba(98,216,255,' + (0.5 * k).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(98,216,255,0)');
    g.globalAlpha = 1; g.fillStyle = gl; g.fillRect(cx - bw, base - bw * 0.3, bw * 2, bw * 0.6);
    g.restore();
  }
  function paint(R, dt) {
    const f = fit(); if (!f) return;
    const sc = sceneOf(), t = R.rm ? 1.4 : R.t;
    let lay = null;
    if (sc) { try { lay = sc.draw(f.ctx, f.w, f.h, t, { seats: R.seats, hologram: R.holo }); } catch (e) { if (!R.sceneFailed) { R.sceneFailed = true; console.warn('[council] scene failed, using the plain chamber', e); } } }
    if (!lay) lay = fallbackScene(f.ctx, f.w, f.h, t, R);
    R.lay = lay; applyLayout(R, lay, f.w, f.h);
    try { drawBust(R, f.ctx, lay, t, dt); } catch (e) { if (!R.bustFailed) { R.bustFailed = true; console.warn('[council] speaker hologram failed', e); } }
  }

  // ================================================================== prompts (cards in the dock)
  function setHint(parts) {
    UI.clear(CN.hint);
    for (const p of parts) CN.hint.appendChild(h('span', h('kbd', p[0]), p[1]));
  }
  function showCards(list) {
    UI.clear(CN.cards);
    const els = list.map(c => {
      const kids = [];
      if (c.key) kids.push(h('span.key', c.key));
      if (c.badge) kids.push(badgeEl(c.badge.race, 42, c.badge.color));
      kids.push(h('span.tx', h('span.t1', c.t1), c.t2 ? h('span.t2', c.t2) : null));
      if (c.cnt !== undefined) kids.push(h('span.cnt', String(c.cnt), h('small', c.cnt === 1 ? 'vote so far' : 'votes so far')));
      const b = h('button.cou-card' + (c.cls ? '.' + c.cls.split(' ').join('.') : ''), { type: 'button', style: c.color ? { '--c': c.color } : null, onclick: () => { UI.sfx('click'); c.pick(); } }, kids);
      if (c.tip) UI.setTip(b, c.tip);
      return b;
    });
    els.forEach(e => CN.cards.appendChild(e));
    return els;
  }
  const clearCards = () => UI.clear(CN.cards);

  function waitContinue(R, label) {                             // a single "Continue" card (Space / Enter / click)
    if (R.leaving) throw ABORT;
    return new Promise((res, rej) => {
      const done = () => { if (R.prompt && R.prompt.type === 'continue') { R.prompt = null; clearCards(); res(); } };
      R.prompt = { type: 'continue', done, abort: () => rej(ABORT) };
      showCards([{ cls: 'go big', t1: label || 'Continue', t2: 'Space', pick: done }]);
      setHint([['Space', 'continue']]);
    });
  }
  function promptVote(R, hu) {
    return new Promise((res, rej) => {
      const info = R.info, me = R.E[hu.empire];
      let settled = false;
      const choose = vote => {
        if (settled) return; settled = true; R.prompt = null;
        els.forEach((e, i) => e.classList.add(cards[i].vote === vote ? 'picked' : 'dim'));
        res(vote);
      };
      const cards = (info.choices || []).map(c => {
        if (c.empire < 0) return { key: String(c.key), vote: -1, t1: 'Abstain', t2: 'Let the Council stall for another ' + ((M.Data.Config && M.Data.Config.COUNCIL_EVERY) || 25) + ' years', tip: 'Abstaining slights both candidates a little, but commits you to nobody.', pick: () => choose(-1) };
        const e = R.E[c.empire], self = c.empire === hu.empire;
        return { key: String(c.key), vote: c.empire, badge: { race: e.race, color: empHex(e.color) }, color: empHex(e.color), t1: self ? 'Yourself' : leaderOf(e), t2: self ? e.leader + ' of the ' + e.name : 'of the ' + e.name + ' · ' + votesText(e.votes), cnt: R.cast[c.empire] | 0,
          tip: self ? 'Cast your votes for your own claim.' : 'Backing a candidate warms them to you and cools the other candidate.', pick: () => choose(c.empire) };
      });
      const els = showCards(cards);
      R.prompt = { type: 'vote', cards, choose, armed: false, abort: () => rej(ABORT) };
      setTimeout(() => { if (R.prompt && R.prompt.type === 'vote') R.prompt.armed = true; }, 700);
      setHint([['1', 'first'], ['2', 'second'], ['0', 'abstain'], ['Esc', 'abstain']]);
      say(R, [me.leader + ', your vote — you command ', gold(votesText(hu.votes)), '.']);
      sfx('open');
    });
  }
  function promptVerdict(R, res) {
    return new Promise((resolve, rej) => {
      const W = R.E[res.winner], mine = !!W.human;
      let settled = false;
      const choose = yes => {
        if (settled) return; settled = true; R.prompt = null;
        els.forEach((e, i) => e.classList.add((i === 0) === yes ? 'picked' : 'dim'));
        resolve(yes);
      };
      const cards = [
        { key: 'Y', cls: 'big', color: '#f3dca0', t1: mine ? 'Accept the crown' : 'Accept the ruling', t2: mine ? 'You become ruler of the galaxy and the game ends in victory.' : leaderOf(W) + ' rules. You go into exile and the game ends.', pick: () => choose(true) },
        { key: 'N', cls: 'big bad', color: '#ff5c6a', t1: 'Defy the Council', t2: 'Final War: every other empire unites against you and pools its technology.', pick: () => choose(false) },
      ];
      const els = showCards(cards);
      R.prompt = { type: 'verdict', choose, cards, els, abort: () => rej(ABORT) };
      setHint([['Y', 'accept'], ['N', 'defy']]);
      sfx('open');
    });
  }

  // ================================================================== the replay (show)
  function applyBallot(R, b) {
    const i = R.seatOf[b.empire]; if (i === undefined) return;
    const m = R.meta[i], s = R.seats[i];
    if (b.choice >= 0 && b.votes > 0) { R.cast[b.choice] = (R.cast[b.choice] | 0) + b.votes; m.vote = b.choice; s.state = 'voted'; }
    else if (b.votes > 0) { m.vote = -1; s.state = 'abstain'; }
    else { m.vote = -2; s.state = 'idle'; }
  }
  function ballotLine(R, b) {
    const e = R.E[b.empire], n = b.votes, cnt = votesText(n);
    if (n <= 0) return ['The ', who(e, e.name), ' hold no votes.'];
    if (b.choice < 0) return ['The ', who(e, e.name), ' abstain. (' + cnt + ')'];
    const c = R.E[b.choice];
    if (b.choice === b.empire) return ['The ', who(e, e.name), ' cast ' + cnt + ' for their own ', nameIt(c), '.'];
    return ['The ', who(e, e.name), ' cast ' + cnt + ' for ', nameIt(c), ' of the ' + c.name + '.'];
  }
  async function runVote(R) {
    const info = R.info, A = R.E[R.A], B = R.E[R.B], seatA = R.seats[R.seatOf[R.A]], seatB = R.seats[R.seatOf[R.B]];
    R.phase = 'replay';
    setHint([['Space', 'next'], ['Esc', 'skip']]);
    say(R, ['The Galactic Council convenes in the year ', brass(String(info.year)), '.']);
    sfx('gavel'); await beat(R, 1900);
    R.meta[R.seatOf[R.A]].nominee = true; R.meta[R.seatOf[R.B]].nominee = true; refreshTags(R);
    seatA.state = 'speaking'; R.speaker = R.A;
    say(R, [nameIt(A), ' of the ' + A.name + ' and ', nameIt(B), ' of the ' + B.name + ' have been nominated.']);
    await beat(R, 1700);
    seatA.state = 'idle'; seatB.state = 'speaking'; R.speaker = R.B; await beat(R, 1500);
    seatB.state = 'idle'; R.speaker = -1;
    say(R, ['A candidate needs ' + R.need + ' of the ' + R.total + ' votes — two thirds — to be elected.']);
    await beat(R, 2100);
    for (const b of info.ballots || []) {
      const i = R.seatOf[b.empire]; if (i === undefined) continue;
      R.seats[i].state = 'speaking'; R.speaker = b.empire; R.speakT = 0;
      say(R, ballotLine(R, b));
      await beat(R, b.votes > 0 ? 1600 : 800);
      applyBallot(R, b); R.speaker = -1; paintTally(R); refreshTags(R);
      if (b.votes > 0) sfx(b.choice >= 0 ? 'vote' : 'click');
      await beat(R, 520);
    }
    // your ballot
    const hu = (info.humans || [])[0];
    let vote = -1;
    R.phase = 'ballot';
    if (hu && hu.votes > 0 && hu.empire in R.seatOf) {
      R.seats[R.seatOf[hu.empire]].state = 'speaking'; R.speaker = hu.empire; R.speakT = 0;
      vote = await promptVote(R, hu);
      if (R.leaving) throw ABORT;
      clearCards();
      applyBallot(R, { empire: hu.empire, votes: hu.votes, choice: vote }); R.speaker = -1; R.holo = 'ballot';
      paintTally(R); refreshTags(R); sfx(vote >= 0 ? 'vote' : 'click');
      const nv = votesText(hu.votes);
      say(R, vote < 0 ? ['You abstain.'] : vote === hu.empire ? ['You cast ' + nv + ' for yourself.'] : ['You cast ' + nv + ' for ', nameIt(R.E[vote]), '.']);
      await beat(R, 1100);
    } else if (hu) {
      say(R, ['Your empire holds no votes in this Council.']);
      await beat(R, 1700);
    }
    clearCards(); R.holo = 'ballot';
    setHint([]);
    return vote;
  }

  // ================================================================== the outcome (result)
  async function runResult(R, res) {
    R.res = res; R.phase = 'result'; R.holo = 'ballot'; R.speaker = -1;
    const S = G.S;
    for (const id of R.ids) R.cast[id] = 0;                       // sync every ballot of the final tally (idempotent)
    for (const m of R.meta) m.vote = -2;
    for (const b of res.ballots || []) applyBallot(R, b);
    for (const id of R.ids) { const s = R.seats[R.seatOf[id]]; if (s.state === 'speaking') s.state = 'idle'; }
    paintTally(R); refreshTags(R);
    setHint([['Space', 'next']]);
    say(R, ['The votes are counted…']); sfx('vote');
    await beat(R, 1500);
    const A = R.E[R.A], B = R.E[R.B];
    if (res.noWinner || res.winner < 0) {
      R.holo = 'galaxy';
      say(R, ['Neither ', nameIt(A), ' (' + (res.votes[A.id] | 0) + ') nor ', nameIt(B), ' (' + (res.votes[B.id] | 0) + ') reaches ' + res.need + ' of the ' + res.total + ' votes. The Council adjourns without a ruler.']);
      sfx('gavel');
      await beat(R, 1200);
      await waitContinue(R, 'Continue');
      return { over: false };
    }
    const W = R.E[res.winner], mine = !!W.human;
    R.holo = 'crown';
    for (const id of R.ids) { const s = R.seats[R.seatOf[id]]; s.state = id === res.winner ? 'winner' : (R.meta[R.seatOf[id]].vote === -1 ? 'abstain' : 'idle'); }
    refreshTags(R); paintTally(R); sfx('gavel');
    const title = Council.titleFor(S, res.winner, S ? S.year : undefined);
    say(R, ['In the year ', brass(String(res.year)), ', the Council has chosen ', who(W, W.leader), ' of the ' + W.name + ' as ', gold(title), '.']);
    await beat(R, 2800);
    if (res.needsAnswer) {
      say(R, mine ? ['The throne is yours, ', who(W, W.leader), '. Do you accept the ruling?'] : ['Do you accept the ruling of the Council?']);
      const yes = await promptVerdict(R, res);
      if (R.leaving) throw ABORT;
      clearCards();
      try { if (typeof res.finish === 'function') res.finish(yes); else if (M.Sim.Council && M.Sim.Council.finish) M.Sim.Council.finish(S, null, yes); } catch (e) { console.error('[council] finish failed', e); }
      if (yes) {
        say(R, mine ? ['So it is decided. The galaxy is yours.'] : ['So it is decided. ', who(W, W.leader), ' rules, and you leave the throne behind.']);
        await beat(R, 1900);
        return { over: true };
      }
      sfx('war', 'alert');
      say(R, [res.text || 'So be it. You defy the Council. Now you will feel the wrath of the New Republic!'], 'bad');
      await beat(R, 1600);
      await waitContinue(R, 'The Final War begins');
      return { over: false };
    }
    await beat(R, 900);
    await waitContinue(R, 'Continue');
    return { over: !!res.gameOver };
  }

  // ================================================================== run lifecycle
  function goBack(R) {
    const cur = UI.Screens.current;
    if (cur && cur.id === 'council') UI.Screens.go(R.prevId && UI.Screens.has(R.prevId) ? R.prevId : 'galaxy', R.prevParams || undefined);
  }
  function startRun(spec) {
    const R = RUN = newRun(spec);
    CN.dirty = true; CN.root.classList.remove('out');
    resetTags(R); paintTally(R); refreshTags(R);
    const year = (spec.info && spec.info.year) || (spec.res && spec.res.year) || (G.S ? M.Data.Config.displayYear(G.S) : '');
    UI.clear(CN.year); CN.year.appendChild(h('b', 'Year ' + year)); CN.year.appendChild(h('span', 'Galactic Council'));
    CN.skip.style.display = spec.kind === 'vote' ? '' : 'none';
    UI.clear(CN.cards); say(R, ['']); setHint([]);
    try { CN.root.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
    musicPlay('council', { fade: 1.0 });
    drive(R);
  }
  async function drive(R) {
    try {
      if (R.kind === 'vote') {
        const vote = await runVote(R);
        if (R.demo) { R.phase = 'demo'; say(R, ['Demonstration chamber — press Esc to leave.']); setHint([['Esc', 'leave']]); return; }
        R.awaiting = true;
        R.orphan = setTimeout(() => { if (RUN === R && R.awaiting) { R.awaiting = false; endRun(R, false); } }, 3200);     // result() normally arrives within a frame
        R.spec.resolve(vote);
      } else {
        const out = await runResult(R, R.spec.res);
        endRun(R, out.over);
        R.spec.resolve();
      }
    } catch (e) {
      if (e !== ABORT) {
        console.error('[council] scene failed', e);
        try { R.spec.resolve(R.kind === 'vote' ? -1 : undefined); } catch (e2) { /* ignore */ }
        if (RUN === R) endRun(R, false);
      }
    }
  }
  function endRun(R, over) {                                      // normal end: hand the screen back (or leave it to the endings)
    if (!R || R.finishing) return;
    R.finishing = true; clearTimeout(R.orphan);
    if (RUN === R) RUN = null;
    R.leaving = true; nudge(R);
    if (over) setTimeout(() => goBack(R), 2800);                // the 'gameover' interrupt opens the ending right away; this is only the safety net
    else goBack(R);
  }
  function abortRun(R) {                                          // someone else took the screen: settle every promise and stop the script
    if (!R || R.leaving) return;
    R.leaving = true; clearTimeout(R.orphan);
    nudge(R);
    if (R.prompt && R.prompt.abort) { const p = R.prompt; R.prompt = null; p.abort(); }
    if (RUN === R) RUN = null;
    try { if (R.kind === 'vote' && !R.awaiting) R.spec.resolve(-1); else if (R.kind === 'result') R.spec.resolve(); } catch (e) { /* ignore */ }
  }
  function begin(kind, payload) {
    return new Promise(resolve => {
      const cur = UI.Screens.current;
      const spec = Object.assign({ kind, resolve }, payload);
      if (RUN && RUN.awaiting && kind === 'result' && cur && cur.id === 'council') {         // same chamber, second act
        const R = RUN;
        clearTimeout(R.orphan); R.awaiting = false; R.spec = spec; R.kind = 'result'; R.res = spec.res; R.skipAll = false; R.prompt = null;
        CN.skip.style.display = 'none';
        drive(R);
        return;
      }
      spec.prevId = cur && cur.id !== 'council' ? cur.id : 'galaxy';
      spec.prevParams = cur && cur.id !== 'council' ? cur.params : undefined;
      try { UI.Screens.go('council', { _run: spec }); } catch (e) { console.error('[council]', e); resolve(kind === 'vote' ? -1 : undefined); }
    });
  }
  const serial = fn => { const p = chain.then(fn); chain = p.then(() => {}, () => {}); return p; };

  Council.show = function (it) {
    const info = it && it.info ? it.info : it;
    if (!info || !info.electorate || !info.candidates) return Promise.resolve(-1);
    return serial(() => begin('vote', { info }));
  };
  Council.result = function (it) {
    const res = it && it.result ? it.result : it;
    if (!res || !res.candidates) return Promise.resolve();
    return serial(() => begin('result', { res }));
  };
  Council.isActive = () => !!RUN;

  // ================================================================== input
  function act(a) {
    const R = RUN; if (!R || R.finishing || R.leaving) return;
    const p = R.prompt;
    if (a === 'skip') {
      if (R.phase === 'demo') { goBack(R); return; }
      if (p && p.type === 'vote') { if (p.armed) { sfx('cancel', 'click'); p.choose(-1); } return; }
      if (p && p.type === 'verdict') { for (const e of p.els) { e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); } return; }   // never auto-accept an irreversible verdict
      if (p && p.type === 'continue') { p.done(); return; }
      if (R.kind === 'vote' && R.phase === 'replay') R.skipAll = true;
      nudge(R);
    } else if (a === 'next') {
      if (p && p.type === 'continue') { p.done(); return; }
      if (!p) nudge(R);
    } else if (a === 'y' || a === 'n') {
      if (p && p.type === 'verdict') p.choose(a === 'y');
    } else if (a === '1' || a === '2' || a === '0') {
      if (p && p.type === 'vote') { const c = p.cards.find(x => x.key === a); if (c) { UI.sfx('click'); c.pick(); } }
    }
  }
  (function bindKeys() {
    const scr = { screen: 'council' };
    const key = (combo, a) => UI.bindKey(combo, e => { if (e && e.repeat) return; act(a); }, scr);
    key('space', 'next'); key('enter', 'next'); key('escape', 'skip'); key('y', 'y'); key('n', 'n'); key('1', '1'); key('2', '2'); key('0', '0');
  })();

  // ================================================================== frame / screen
  function frame(dt) {
    const R = RUN; if (!R) return;
    dt = min(dt, 0.1); R.t += dt; R.acc += dt;
    if (R.speaker >= 0) R.speakT += dt;
    const fps = R.rm ? 0 : (PQ().animFps || 60);
    if (R.rm ? !CN.dirty : (fps < 59 && R.acc < 1 / fps - 0.002)) return;
    const d = R.acc; R.acc = 0; CN.dirty = false;
    paint(R, d);
  }
  UI.Screens.register('council', {
    create(el) { build(el); },
    enter(params) {
      const spec = params && params._run;
      if (RUN && spec && RUN.spec === spec) return;                                 // Screens.refresh() while the scene is up
      if (RUN) abortRun(RUN);
      if (!spec) {                                                                  // opened by hand: a demo chamber with the live electorate
        const S = G.S, C = M.Sim.Council;
        if (!S || !C) { UI.Screens.go(UI.Screens.has('galaxy') ? 'galaxy' : 'menu'); return; }
        const el = C.electorate(S), alive = el.filter(e => e.alive).sort((a, b) => b.votes - a.votes || a.empire - b.empire);
        if (alive.length < 2) { UI.Screens.go('galaxy'); return; }
        const total = alive.reduce((a, e) => a + e.votes, 0), prev = UI.Screens.current && UI.Screens.current.prev;
        startRun({ kind: 'vote', demo: true, resolve: () => {}, prevId: prev && prev !== 'council' ? prev : 'galaxy',
          info: { year: M.Data.Config.displayYear(S), electorate: el, candidates: [alive[0].empire, alive[1].empire], total, need: C.need(total), ballots: [], humans: [], choices: [] } });
        return;
      }
      startRun(spec);
    },
    leave() { if (RUN) abortRun(RUN); },
    update(dt) { frame(dt); },
    resize() { CN.dirty = true; if (RUN) RUN.tagKey = ''; },
  });
})(window.MOO);
