// GNN - Galactic News Network broadcast screen: studio backdrop + anchor, typed lower-thirds, graphics window,
// empire rankings, scrolling ticker, breaking-news styling, plus a searchable news archive.
//
//   MOO.UI.GNN.show(intr) -> Promise<{skipped, shown}>   intr = {type:'gnn', year, turn, items:[...], rankings, ticker, anchorRace?}
//       item = {cat, headline, sub?, graphic:'planet'|'battle'|'map'|'chart'|'ticker', planet:{look,seed,inhabited,color}|null,
//               star:{name,kind}|null, race, race2, importance:0|1|2}
//       rankings = {production|research|military|population: [{empire, race, name, color, value}]}
//       Switches to screen 'gnn' (UI.Screens.go) and back to the previous screen when done; resolves when finished or skipped.
//   MOO.UI.GNN.archive(S) -> Promise                      modal listing S.newsLog = [{year, cat, headline, race, race2}] (newest first)
//   Keys: Space / Enter / click = next (completes typing first), Left = back, P = pause, Esc / right-click = skip all.
//   Optional deps (all guarded; a built-in fallback studio / placeholders are used when absent): Gfx.Scenes.newsroom, Gfx.Portraits,
//   Gfx.Planets, Gfx.Ships, Gfx.Space, Gfx.Fx, Gfx.Icons, Audio.Music ('gnn'), Audio.SFX ('news','typing','alert'), Data.text, Data.races,
//   Settings ('animSpeed', 'reduceMotion'), Perf.q.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, doc = document;
  const PI = Math.PI, TAU = PI * 2;
  const sin = Math.sin, cos = Math.cos, abs = Math.abs, min = Math.min, max = Math.max, floor = Math.floor, ceil = Math.ceil;
  const sqrt = Math.sqrt, pow = Math.pow, atan2 = Math.atan2, round = Math.round, hypot = Math.hypot;
  const GNN = (UI.GNN = {});

  // ================================================================== small helpers
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => { t = clamp(t, 0, 1); return 1 - pow(1 - t, 3); };
  const fract = v => v - floor(v);
  function hashStr(s) { s = String(s); let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  function rng32(a) {
    a = a >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function h2(a, b) {
    let x = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b)) | 0;
    x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); x = Math.imul(x ^ (x >>> 12), 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  }
  const mkCanvas = (w, hh) => { const c = doc.createElement('canvas'); c.width = max(1, ceil(w)); c.height = max(1, ceil(hh)); return c; };
  const humanize = s => String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  const FONT_D = "'Marcellus SC','Marcellus','Palatino Linotype','Book Antiqua',Georgia,serif";
  const FONT_U = "'IBM Plex Sans Condensed','Bahnschrift SemiCondensed','Bahnschrift','Segoe UI',system-ui,sans-serif";

  // ---- colours (hex in, hex/rgba out). CSS variables are read once; the fallbacks equal css/base.css.
  const VARS = {
    '--emp0': '#4a90e8', '--emp1': '#4ed17a', '--emp2': '#b45be8', '--emp3': '#e8504d', '--emp4': '#f1eee4', '--emp5': '#e8c94a',
    '--rose': '#ff5c6a', '--leaf': '#5fdc8f', '--violet': '#a98bff', '--cyan': '#62d8ff', '--ember': '#ff9440', '--gold': '#ffd54f',
    '--teal': '#38d6c4', '--azure': '#5b8cff', '--mist': '#98a5cf', '--fog': '#5d6a96', '--brass': '#d6b36a', '--brass-hi': '#f3dca0',
    '--brass-lo': '#8a7040', '--ivory': '#ece6d3',
  };
  const _cssv = {};
  function cssHex(name) {
    if (_cssv[name]) return _cssv[name];
    let v = '';
    try { v = getComputedStyle(doc.documentElement).getPropertyValue(name).trim(); } catch (e) { /* no styles yet */ }
    if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map(c => c + c).join('');
    return (_cssv[name] = /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : (VARS[name] || '#d6b36a'));
  }
  const empHex = i => cssHex('--emp' + clamp(round(+i || 0), 0, 5));
  const _hex = {};
  function toHex(c, fb) {
    if (c === undefined || c === null || c === '') return fb || '#d6b36a';
    if (typeof c === 'number') return empHex(c);
    c = String(c).trim();
    if (_hex[c]) return _hex[c];
    let out = null, m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(c))) out = '#' + m[1].split('').map(x => x + x).join('').toLowerCase();
    else if (/^#[0-9a-f]{6}$/i.test(c)) out = c.toLowerCase();
    else if ((m = /^var\(\s*(--[\w-]+)/.exec(c))) out = cssHex(m[1]);
    else if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(c))) out = '#' + [m[1], m[2], m[3]].map(v => ('0' + min(255, +v).toString(16)).slice(-2)).join('');
    else if (/^\d+$/.test(c)) out = empHex(+c);
    return (_hex[c] = out || fb || '#d6b36a');
  }
  const _rgb = {};
  function rgb(hex) { let v = _rgb[hex]; if (!v) { const n = parseInt(hex.slice(1), 16); v = _rgb[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } return v; }
  const rgba = (hex, a) => { const v = rgb(hex); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)) + ')'; };
  function mix(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + [0, 1, 2].map(i => ('0' + round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2)).join(''); }
  const lite = (c, k) => mix(c, '#ffffff', k);
  const dark = (c, k) => mix(c, '#000000', k);
  function lgr(g, x0, y0, x1, y1, st) { const r = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]); return r; }
  function rgr(g, x, y, r0, r1, st) { const r = g.createRadialGradient(x, y, r0, x, y, r1); for (let i = 0; i < st.length; i += 2) r.addColorStop(st[i], st[i + 1]); return r; }

  // ---- user settings / perf / audio (every one of them optional)
  const setting = (k, d) => { try { const v = M.Settings && M.Settings.get ? M.Settings.get(k) : undefined; return v === undefined ? d : v; } catch (e) { return d; } };
  const animSpeed = () => { const v = +setting('animSpeed', 1); return v <= 0 ? 0 : v >= 2 ? 2 : 1; };
  const reduced = () => !!setting('reduceMotion', false) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PQ = () => (M.Perf && M.Perf.q) || { dpr: 1.5, particles: 0.7, animFps: 60 };
  const dprFor = cap => min(window.devicePixelRatio || 1, PQ().dpr || 1.5, cap || 2);
  let _sfxList = null;
  function sfx(id, fb) {
    try {
      const S = M.Audio && M.Audio.SFX;
      if (!S || typeof S.play !== 'function') return;
      let use = id;
      if (fb && typeof S.list === 'function') {
        if (!_sfxList || !_sfxList.length) { const l = S.list(); _sfxList = Array.isArray(l) ? l.map(x => (typeof x === 'string' ? x : x && x.id)) : []; }
        if (_sfxList.length && _sfxList.indexOf(id) < 0) use = fb;
      }
      S.play(use);
    } catch (e) { /* audio is optional */ }
  }
  const Mu = () => (M.Audio && M.Audio.Music) || null;
  function musicPlay(id, o) { try { const m = Mu(); if (m && typeof m.play === 'function') return m.play(id, o); } catch (e) { /* audio is optional */ } return null; }
  function musicStop(o) { try { const m = Mu(); if (m && typeof m.stop === 'function') m.stop(o); } catch (e) { /* audio is optional */ } }
  function musicCur() { try { const m = Mu(); return m && typeof m.current === 'function' ? m.current() : null; } catch (e) { return null; } }

  // ---- races
  const RACE_IDS = ['alkari', 'bulrathi', 'darlok', 'human', 'klackon', 'meklar', 'mrrshan', 'psilon', 'sakkra', 'silicoid'];
  const RACE_COL = { alkari: '#4aa3df', bulrathi: '#b0663a', darlok: '#8a6ab8', human: '#4a8be0', klackon: '#6ab04c', meklar: '#9aa6c0', mrrshan: '#e0a030', psilon: '#c06bd8', sakkra: '#3fb58a', silicoid: '#c8b088' };
  const raceIds = () => (M.Data && Array.isArray(M.Data.raceList) && M.Data.raceList.length ? M.Data.raceList : RACE_IDS);
  const raceRec = id => (M.Data && M.Data.races && M.Data.races[id]) || null;
  const raceName = id => { const r = raceRec(id); return (r && r.name) || (id ? U.cap(String(id)) : ''); };
  const racePlural = id => { const r = raceRec(id); if (r && r.plural) return r.plural; const n = raceName(id); return /i$/i.test(n) ? n : n + 's'; };
  function raceColor(id) {
    const r = raceRec(id), p = r && r.art && r.art.primary;
    if (p && /^#[0-9a-f]{3,6}$/i.test(p)) return toHex(p);
    return RACE_COL[id] || '#98a5cf';
  }
  const probeCache = {};
  // true when Gfx.Portraits actually paints this race (draw() silently ignores races without a painter)
  function portraitReady(race) {
    const P = M.Gfx && M.Gfx.Portraits;
    if (!P || typeof P.draw !== 'function' || !race) return false;
    if (probeCache[race] !== undefined) return probeCache[race];
    let ok = false;
    try {
      if (P.RACES && P.RACES.indexOf(race) < 0) throw new Error('unknown race');
      const c = typeof P.canvas === 'function' ? P.canvas(race, 12, 15, { t: 0, bg: false }) : null;
      if (c) {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { ok = true; break; }
      }
    } catch (e) { ok = false; }
    return (probeCache[race] = ok);
  }
  // round brass-ringed badge: Portraits.drawBadge or a plain medallion with the race initial
  function paintBadge(g, race, cx, cy, r, color) {
    const P = M.Gfx && M.Gfx.Portraits;
    if (portraitReady(race) && typeof P.drawBadge === 'function') {
      try { P.drawBadge(g, race, cx, cy, r, { t: 0, color: color, bg: true, key: 'gnn-badge|' + race + '|' + color }); return; } catch (e) { /* fall through */ }
    }
    const c = color || raceColor(race);
    g.save();
    g.fillStyle = rgr(g, cx - r * 0.3, cy - r * 0.35, r * 0.1, r * 1.1, [0, lite(c, 0.25), 1, dark(c, 0.7)]);
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.lineWidth = max(1.5, r * 0.12); g.strokeStyle = '#d6b36a'; g.stroke();
    g.fillStyle = '#f3dca0'; g.font = '400 ' + round(r * 1.1) + 'px ' + FONT_D; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(raceName(race).charAt(0).toUpperCase() || '?', cx, cy + r * 0.06);
    g.restore();
  }
  function badge(race, sizePx, color) {
    const dpr = min(window.devicePixelRatio || 1, 2), px = max(8, round(sizePx));
    const cv = h('canvas.gnn-badge', { width: round(px * dpr), height: round(px * dpr) });
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { paintBadge(g, race, px / 2, px / 2, px / 2 - 1, color); } catch (e) { /* leave empty */ }
    return cv;
  }

  // ================================================================== news categories
  // group: label shown in the kicker / archive filter; css = signal colour token; mood = anchor expression; gfx = default graphic
  const GROUPS = {
    war:       { label: 'War',         icon: 'war',       css: '--rose',   mood: 'worried',  gfx: 'battle' },
    colony:    { label: 'Colonies',    icon: 'colony',    css: '--leaf',   mood: 'pleased',  gfx: 'planet' },
    diplomacy: { label: 'Diplomacy',   icon: 'diplomacy', css: '--violet', mood: 'neutral',  gfx: 'map' },
    spy:       { label: 'Espionage',   icon: 'spy',       css: '--violet', mood: 'scheming', gfx: 'map' },
    science:   { label: 'Science',     icon: 'research',  css: '--cyan',   mood: 'pleased',  gfx: 'chart' },
    disaster:  { label: 'Disaster',    icon: 'warning',   css: '--ember',  mood: 'worried',  gfx: 'planet' },
    council:   { label: 'Council',     icon: 'council',   css: '--gold',   mood: 'neutral',  gfx: 'chart' },
    economy:   { label: 'Economy',     icon: 'money',     css: '--gold',   mood: 'pleased',  gfx: 'chart' },
    space:     { label: 'Deep space',  icon: 'monster',   css: '--teal',   mood: 'worried',  gfx: 'planet' },
    life:      { label: 'Galaxy life', icon: 'news',      css: '--mist',   mood: 'pleased',  gfx: 'ticker' },
  };
  const GROUP_ORDER = ['war', 'space', 'disaster', 'colony', 'diplomacy', 'spy', 'science', 'council', 'economy', 'life'];
  const CAT_GROUP = {};
  [
    ['war', 'warDeclared battleWon battleLost fleetDestroyed invasionSuccess invasionRepelled bombardment planetDestroyed empireDestroyed antaranRaid piracy'],
    ['space', 'guardianSlain monsterAttack monsterSpawn monsterVanishes monsterKilled'],
    ['colony', 'colonyFounded colonyLost planetRebels terraform'],
    ['disaster', 'systemNova plague planetStarving earthquake accident accidentCleaned novaWarning novaProgress novaAverted comet cometProgress cometDestroyed virus plagueProgress plagueCured'],
    ['diplomacy', 'peaceTreaty napSigned allianceFormed allianceBroken tradeSigned treatyBroken tributeDemanded tributePaid firstContact'],
    ['spy', 'spyCaught techStolen sabotage'],
    ['science', 'techBreakthrough artifactFound derelict orionColonised'],
    ['council', 'councilConvened councilVote emperorElected councilRefused'],
    ['economy', 'economicBoom rankings richPlanet poorPlanet donation starsReport'],
    ['life', 'flavor coup'],
  ].forEach(([g, list]) => list.split(' ').forEach(c => { CAT_GROUP[c] = g; }));
  const groupOf = cat => CAT_GROUP[cat] || 'life';
  // per-category overrides of the default graphic and of the special effect played on it
  const CAT_GFX = {
    planetDestroyed: ['planet', 'explode'], systemNova: ['planet', 'nova'], colonyFounded: ['planet', 'land'], colonyLost: ['planet', 'glitch'],
    planetRebels: ['planet', 'glitch'], planetStarving: ['planet', 'hunger'], plague: ['planet', 'plague'], terraform: ['planet', 'sparkle'],
    artifactFound: ['planet', 'sparkle'], bombardment: ['planet', 'strike'], invasionSuccess: ['planet', 'strike'], invasionRepelled: ['planet', 'strike'],
    monsterAttack: ['battle', ''], antaranRaid: ['battle', ''], piracy: ['battle', ''], guardianSlain: ['battle', ''],
    warDeclared: ['map', 'alarm'], empireDestroyed: ['map', 'alarm'], allianceBroken: ['map', 'alarm'], treatyBroken: ['map', 'alarm'],
    earthquake: ['planet', 'strike'], accident: ['planet', 'plague'], novaWarning: ['planet', 'nova'], novaProgress: ['planet', 'nova'], comet: ['planet', 'strike'], cometProgress: ['planet', 'strike'],
    richPlanet: ['planet', 'sparkle'], poorPlanet: ['planet', 'hunger'], plagueProgress: ['planet', 'plague'], monsterSpawn: ['battle', ''], monsterKilled: ['battle', ''], piracyProgress: ['battle', ''], genocide: ['map', 'alarm'],
    spyCaught: ['ticker', 'redact'], techStolen: ['ticker', 'redact'], sabotage: ['ticker', 'redact'],
  };
  const GFX_KINDS = { planet: 1, battle: 1, map: 1, chart: 1, ticker: 1 };

  function normalizeItem(it) {
    const cat = it.cat || 'flavor', grp = groupOf(cat), ov = CAT_GFX[cat] || [];
    const gfx = GFX_KINDS[it.graphic] ? it.graphic : (ov[0] || GROUPS[grp].gfx);
    return {
      cat: cat, grp: grp, headline: String(it.headline).trim(), sub: it.sub ? String(it.sub).trim() : '', graphic: gfx, fx: ov[1] || '',
      planet: it.planet && typeof it.planet === 'object' ? it.planet : null, star: it.star && typeof it.star === 'object' ? it.star : null,
      race: it.race || '', race2: it.race2 || '', importance: clamp(round(+it.importance || 0), 0, 2),
    };
  }

  const RANK_META = {
    production: { title: 'Production', sub: 'Industrial output', unit: 'BC', icon: 'industry', css: '--ember', cat: 'production' },
    research: { title: 'Research', sub: 'Scientific output', unit: 'RP', icon: 'research', css: '--cyan', cat: 'research' },
    military: { title: 'Military', sub: 'Fleet strength', unit: '', icon: 'warship', css: '--azure', cat: 'military' },
    population: { title: 'Population', sub: 'Citizens across the empire', unit: '', icon: 'pop', css: '--leaf', cat: 'population' },
  };
  const RANK_ORDER = ['production', 'research', 'military', 'population'];

  // ================================================================== styles
  UI.css('gnn', `
    .gnn { position:absolute; inset:0; overflow:hidden; background:#04061a; color:var(--ivory); font-family:var(--font-ui); cursor:pointer; outline:none;
      --u:12.8px; --cat:var(--cyan); --tone:var(--brass); --tone-hi:var(--brass-hi); --tone-lo:var(--brass-lo); --tone-ink:#261b06; user-select:none; -webkit-user-select:none; }
    .gnn[data-tone=breaking] { --tone:#ff8d97; --tone-hi:#ffd0d4; --tone-lo:#a3303d; --tone-ink:#3a0710; }
    .gnn[data-tone=top] { --tone:#ffd54f; --tone-hi:#fff0b0; --tone-lo:#a8842a; --tone-ink:#2e2204; }
    .gnn[data-grp=war] { --cat:var(--rose); } .gnn[data-grp=colony] { --cat:var(--leaf); } .gnn[data-grp=diplomacy], .gnn[data-grp=spy] { --cat:var(--violet); }
    .gnn[data-grp=science] { --cat:var(--cyan); } .gnn[data-grp=disaster] { --cat:var(--ember); } .gnn[data-grp=council], .gnn[data-grp=economy] { --cat:var(--gold); }
    .gnn[data-grp=space] { --cat:var(--teal); } .gnn[data-grp=life] { --cat:var(--mist); }
    .gnn[data-grp=production] { --cat:var(--ember); } .gnn[data-grp=research] { --cat:var(--cyan); } .gnn[data-grp=military] { --cat:var(--azure); } .gnn[data-grp=population] { --cat:var(--leaf); }
    .gnn-stage { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .gnn-shade { position:absolute; inset:0; pointer-events:none; z-index:2; background:radial-gradient(ellipse at 50% 46%, transparent 58%, rgba(2,3,12,.5) 100%); }
    .gnn-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    .gnn-chf { --ch:calc(var(--u)*.8); --poly:polygon(var(--ch) 0, calc(100% - var(--ch)) 0, 100% var(--ch), 100% calc(100% - var(--ch)), calc(100% - var(--ch)) 100%, var(--ch) 100%, 0 calc(100% - var(--ch)), 0 var(--ch)); clip-path:var(--poly); }

    /* ---- graphics window (sits exactly on the studio's video wall) ---- */
    .gnn-mon { position:absolute; z-index:3; pointer-events:none; display:none; transform-origin:0 0; background:#02040f; }
    .gnn[data-mode=item] .gnn-mon { display:block; }
    .gnn-mon-cv { position:absolute; inset:0; width:100%; height:100%; display:block; }
    .gnn-mon.in .gnn-mon-cv { animation:gnn-pop .5s var(--ease) both; }
    .gnn-mon-tag { position:absolute; left:calc(var(--u)*1.3); top:calc(var(--u)*1.2); display:flex; align-items:center; gap:calc(var(--u)*.7); padding:calc(var(--u)*.45) calc(var(--u)*1.3) calc(var(--u)*.4) calc(var(--u)*1);
      font:400 max(.78rem, calc(var(--u)*1.08))/1 var(--font-display); letter-spacing:.2em; text-transform:uppercase; color:var(--cat); background:rgba(4,7,24,.82); --ch:calc(var(--u)*.5);
      box-shadow:inset 3px 0 0 var(--cat); }
    .gnn-mon-tag .ico { width:1.25em; height:1.25em; }
    .gnn-mon.in .gnn-mon-tag { animation:gnn-slide .5s .15s var(--ease) both; }
    .gnn-mon-live { position:absolute; right:calc(var(--u)*1.3); top:calc(var(--u)*1.2); display:flex; align-items:center; gap:calc(var(--u)*.6); padding:calc(var(--u)*.35) calc(var(--u)*1);
      font:600 max(.7rem, calc(var(--u)*.95))/1 var(--font-ui); letter-spacing:.2em; color:#ffd9dc; background:rgba(150,24,44,.62); --ch:calc(var(--u)*.4); }
    .gnn-mon-live i { width:calc(var(--u)*.7); height:calc(var(--u)*.7); background:#ff5566; box-shadow:0 0 calc(var(--u)*.9) #ff5566; animation:gnn-blink 1.4s ease-in-out infinite; }
    .gnn-mon-live.feed { background:rgba(10,16,48,.7); color:var(--mist); } .gnn-mon-live.feed i { background:var(--mist); box-shadow:none; animation:none; opacity:.7; }
    .gnn-mon-cap { position:absolute; left:0; right:0; bottom:0; padding:calc(var(--u)*2.4) calc(var(--u)*1.6) calc(var(--u)*1.1); display:flex; align-items:flex-end; justify-content:space-between; gap:calc(var(--u)*1.5);
      background:linear-gradient(0deg, rgba(3,5,20,.92), rgba(3,5,20,0)); }
    .gnn-mon-cap b { display:block; font:400 max(1rem, calc(var(--u)*2.1))/1.1 var(--font-display); letter-spacing:.12em; text-transform:uppercase; color:#fff5dd; text-shadow:0 1px 0 #000; }
    .gnn-mon-cap span { display:block; margin-top:calc(var(--u)*.3); font:500 max(.8rem, calc(var(--u)*1.2))/1.2 var(--font-ui); color:var(--mist); letter-spacing:.04em; }
    .gnn-mon-cap em { font:500 max(.75rem, calc(var(--u)*1.05))/1.2 var(--font-ui); font-style:normal; color:var(--fog); letter-spacing:.14em; text-transform:uppercase; text-align:right; white-space:nowrap; }

    /* ---- lower third ---- */
    .gnn-lt { position:absolute; z-index:5; pointer-events:none; display:none; filter:drop-shadow(0 calc(var(--u)*.5) calc(var(--u)*1.3) rgba(0,0,0,.65)); }
    .gnn[data-mode=item] .gnn-lt, .gnn[data-mode=rank] .gnn-lt { display:block; }
    .gnn-lt-flag { position:absolute; left:calc(var(--u)*9.6); bottom:100%; margin-bottom:-1px; display:none; align-items:center; gap:calc(var(--u)*.8); --ch:calc(var(--u)*.7);
      padding:calc(var(--u)*.5) calc(var(--u)*2.2) calc(var(--u)*.45) calc(var(--u)*1.3); font:400 max(.8rem, calc(var(--u)*1.2))/1 var(--font-display); letter-spacing:.24em; text-transform:uppercase;
      color:var(--tone-ink); background:linear-gradient(180deg, var(--tone-hi), var(--tone)); clip-path:polygon(0 0, calc(100% - var(--ch)) 0, 100% 100%, 0 100%); }
    .gnn-lt-flag i { width:calc(var(--u)*.8); height:calc(var(--u)*.8); transform:rotate(45deg); background:var(--tone-ink); }
    .gnn[data-tone=breaking] .gnn-lt-flag, .gnn[data-tone=top] .gnn-lt-flag { display:flex; }
    .gnn[data-tone=breaking] .gnn-lt-flag { animation:gnn-flash .9s steps(1, end) infinite; }
    .gnn-lt-bar { position:relative; isolation:isolate; display:flex; align-items:stretch; min-height:100%; --ch:calc(var(--u)*.9);
      background:linear-gradient(180deg, var(--tone-hi), var(--tone) 40%, var(--tone-lo)); }
    .gnn-lt-bar::before { content:""; position:absolute; inset:max(2px, calc(var(--u)*.2)); z-index:-1; clip-path:var(--poly);
      background:linear-gradient(180deg, rgba(24,34,86,.985) 0%, rgba(10,15,42,.99) 62%, rgba(6,9,28,1) 100%); }
    .gnn[data-tone=breaking] .gnn-lt-bar::before { background:linear-gradient(180deg, rgba(86,18,38,.985) 0%, rgba(40,9,24,.99) 62%, rgba(22,6,16,1) 100%); }
    .gnn-lt-bar::after { content:""; position:absolute; inset:0; z-index:1; pointer-events:none; clip-path:var(--poly); opacity:0;
      background:linear-gradient(100deg, transparent 38%, rgba(255,255,255,.28) 50%, transparent 62%); transform:translateX(-120%); }
    .gnn-lt.in .gnn-lt-bar::after { animation:gnn-sheen 1s .1s ease-out both; }
    .gnn-lt-logo { flex:none; width:calc(var(--u)*9); display:grid; place-items:center; margin:max(2px, calc(var(--u)*.2)) 0 max(2px, calc(var(--u)*.2)) max(2px, calc(var(--u)*.2));
      border-right:1px solid rgba(214,179,106,.4); background:radial-gradient(circle at 50% 42%, rgba(70,96,210,.5), rgba(20,28,80,0) 72%); }
    .gnn-lt-logo svg { width:calc(var(--u)*6.8); height:auto; display:block; }
    .gnn-lt-txt { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; gap:calc(var(--u)*.45); padding:calc(var(--u)*1) calc(var(--u)*1.6) calc(var(--u)*1.1) calc(var(--u)*2); }
    .gnn-lt.in .gnn-lt-txt { animation:gnn-reveal .55s .08s var(--ease) both; }
    .gnn-lt-kick { display:flex; align-items:center; gap:calc(var(--u)*.8); font:400 max(.78rem, calc(var(--u)*1.12))/1 var(--font-display); letter-spacing:.2em; text-transform:uppercase; color:var(--cat); white-space:nowrap; overflow:hidden; }
    .gnn-lt-kick .ico { width:1.25em; height:1.25em; flex:none; }
    .gnn-lt-kick b { font-weight:400; color:var(--ivory); opacity:.72; letter-spacing:.14em; overflow:hidden; text-overflow:ellipsis; }
    .gnn-lt-hl { font:600 max(1.15rem, calc(var(--u)*2.3))/1.17 var(--font-ui); color:#fff8e8; text-shadow:0 1px 0 rgba(0,0,0,.65), 0 0 calc(var(--u)*1.4) rgba(0,0,0,.45); letter-spacing:.003em; overflow-wrap:anywhere; }
    .gnn-lt-sub { font:400 max(.95rem, calc(var(--u)*1.55))/1.3 var(--font-ui); color:#c3cdf2; overflow-wrap:anywhere; }
    .gnn-lt-sub:empty { display:none; }
    .gnn .r { visibility:hidden; }
    .gnn .typing .t::after { content:""; display:inline-block; width:.5em; height:.82em; margin-left:.12em; vertical-align:-.06em; background:var(--tone); animation:gnn-caret .7s steps(2, start) infinite; }
    .gnn-lt-badges { flex:none; display:flex; align-items:center; padding:0 calc(var(--u)*1.8) 0 calc(var(--u)*.4); }
    .gnn-badge { width:calc(var(--u)*5.6); height:calc(var(--u)*5.6); display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,.6)); }
    .gnn-badge + .gnn-badge { margin-left:calc(var(--u)*-1.5); }

    /* ---- ticker ---- */
    .gnn-tk { position:absolute; z-index:6; display:flex; align-items:stretch; overflow:hidden; --ch:calc(var(--u)*.7); background:linear-gradient(180deg, #0c1340, #060a22); }
    .gnn-tk::before { content:""; position:absolute; inset:0; z-index:4; pointer-events:none; box-shadow:inset 0 0 0 max(1px, calc(var(--u)*.14)) var(--tone-lo), inset 0 1px 0 var(--tone); clip-path:var(--poly); }
    .gnn-tk-tag { flex:none; position:relative; z-index:3; display:flex; align-items:center; gap:calc(var(--u)*.8); padding:0 calc(var(--u)*3.6) 0 calc(var(--u)*2.2); margin-right:calc(var(--u)*-1.4);
      font:400 max(.8rem, calc(var(--u)*1.5))/1 var(--font-display); letter-spacing:.2em; text-transform:uppercase; color:var(--tone-ink); background:linear-gradient(180deg, var(--tone-hi), var(--tone) 60%, var(--tone-lo));
      clip-path:polygon(0 0, 100% 0, calc(100% - var(--u)*1.4) 100%, 0 100%); white-space:nowrap; }
    .gnn-tk-win { flex:1; min-width:0; position:relative; overflow:hidden; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 3%, #000 97%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 3%, #000 97%, transparent 100%); }
    .gnn-tk-track { position:absolute; left:0; top:0; bottom:0; display:flex; align-items:center; will-change:transform; animation:gnn-tk var(--tk-dur, 60s) linear infinite; }
    .gnn-tk-seq { display:flex; align-items:center; flex:none; }
    .gnn-tk-i { font:500 max(.9rem, calc(var(--u)*1.7))/1 var(--font-ui); color:#dfe6ff; white-space:nowrap; padding:0 calc(var(--u)*.4); }
    .gnn-tk-sep { flex:none; width:calc(var(--u)*.75); height:calc(var(--u)*.75); transform:rotate(45deg); background:var(--tone); margin:0 calc(var(--u)*1.6); opacity:.9; }
    .gnn-tk.static .gnn-tk-track { animation:none; left:calc(var(--u)*2); }
    .gnn-tk.static .gnn-tk-i { animation:gnn-fade .6s ease both; }

    /* ---- controls strip (below the ticker) ---- */
    .gnn-hud { position:absolute; z-index:8; display:flex; align-items:center; justify-content:space-between; gap:calc(var(--u)*1.2); padding:0 calc(var(--u)*1); }
    .gnn-hint { color:var(--fog); font:500 max(.7rem, calc(var(--u)*1.05))/1 var(--font-ui); letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .gnn-hint b { color:var(--mist); font-weight:600; }
    .gnn-hud-r { display:flex; align-items:center; gap:calc(var(--u)*.9); flex:none; }
    .gnn-hud .btn.small { padding:.18em .75em; font-size:max(.78rem, calc(var(--u)*1.12)); }
    .gnn-pips { display:flex; align-items:center; gap:calc(var(--u)*.55); margin-right:calc(var(--u)*.8); color:var(--mist); font:500 max(.72rem, calc(var(--u)*1.05))/1 var(--font-ui); letter-spacing:.1em; }
    .gnn-pip { width:calc(var(--u)*.72); height:calc(var(--u)*.72); transform:rotate(45deg); background:rgba(214,179,106,.2); box-shadow:inset 0 0 0 1px rgba(214,179,106,.5); }
    .gnn-pip.done { background:var(--brass); } .gnn-pip.cur { background:var(--brass-hi); box-shadow:0 0 calc(var(--u)*.9) var(--brass-hi); transform:rotate(45deg) scale(1.4); }
    /* ---- ranking panel ---- */
    .gnn-rank { position:absolute; z-index:4; display:none; filter:drop-shadow(0 calc(var(--u)*.6) calc(var(--u)*1.6) rgba(0,0,0,.65)); }
    .gnn[data-mode=rank] .gnn-rank { display:block; }
    .gnn-rank-fr { position:relative; isolation:isolate; height:100%; --ch:calc(var(--u)*1.1); padding:max(2px, calc(var(--u)*.4)); background:linear-gradient(135deg, var(--brass-hi), var(--brass-lo) 40%, var(--brass) 70%, var(--brass-lo)); }
    .gnn-rank-in { height:100%; display:flex; flex-direction:column; padding:calc(var(--u)*1.5) calc(var(--u)*2) calc(var(--u)*1.2); --ch:calc(var(--u)*.78);
      background:linear-gradient(180deg, rgba(20,30,84,.975), rgba(7,12,38,.985)); overflow:hidden; }
    .gnn-rank.in .gnn-rank-in { animation:gnn-pop .5s var(--ease) both; }
    .gnn-rank-h { display:flex; align-items:center; gap:calc(var(--u)*1.1); padding-bottom:calc(var(--u)*.8); margin-bottom:calc(var(--u)*.6); border-bottom:1px solid rgba(214,179,106,.3); }
    .gnn-rank-h .ico { width:calc(var(--u)*2.8); height:calc(var(--u)*2.8); color:var(--cat); flex:none; filter:drop-shadow(0 0 calc(var(--u)*.6) var(--cat)); }
    .gnn-rank-h h2 { font:400 max(1.2rem, calc(var(--u)*2.7))/1 var(--font-display); letter-spacing:.07em; color:var(--brass-hi); }
    .gnn-rank-h span { display:block; margin-top:calc(var(--u)*.35); color:var(--mist); font:500 max(.8rem, calc(var(--u)*1.2))/1 var(--font-ui); letter-spacing:.05em; }
    .gnn-rank-tabs { margin-left:auto; display:flex; gap:calc(var(--u)*.5); align-self:flex-start; }
    .gnn-rank-tab { display:grid; place-items:center; width:calc(var(--u)*3.2); height:calc(var(--u)*3.2); color:var(--fog); border-bottom:2px solid transparent; }
    .gnn-rank-tab .ico { width:calc(var(--u)*1.8); height:calc(var(--u)*1.8); }
    .gnn-rank-tab.on { color:var(--brass-hi); border-color:var(--brass); background:linear-gradient(180deg, transparent, rgba(214,179,106,.16)); }
    .gnn-rank-list { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:space-evenly; }
    .gnn-rk { display:grid; grid-template-columns:calc(var(--u)*2) calc(var(--u)*3.7) 1fr; align-items:center; gap:calc(var(--u)*1.1); padding:calc(var(--u)*.16) calc(var(--u)*.9); position:relative; }
    .gnn-rk.in { animation:gnn-slide-r .5s var(--ease) both; animation-delay:calc(var(--i) * .09s); }
    .gnn-rk-n { font:400 max(1rem, calc(var(--u)*2))/1 var(--font-display); color:var(--fog); text-align:center; }
    .gnn-rk .gnn-badge { width:calc(var(--u)*3.7); height:calc(var(--u)*3.7); margin:0; }
    .gnn-rk-main { min-width:0; }
    .gnn-rk-top { display:flex; align-items:baseline; justify-content:space-between; gap:calc(var(--u)*1); margin-bottom:calc(var(--u)*.3); }
    .gnn-rk-name { font:500 max(.95rem, calc(var(--u)*1.6))/1.15 var(--font-ui); color:var(--ivory); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .gnn-rk-name em { font-style:normal; color:var(--mist); margin-left:.6em; font-size:.8em; }
    .gnn-rk-name u { text-decoration:none; margin-left:.7em; padding:.1em .55em; font:600 .62em/1.4 var(--font-ui); letter-spacing:.16em; text-transform:uppercase; color:#261b06; background:var(--brass-hi); vertical-align:.15em; }
    .gnn-rk-val { font:600 max(1rem, calc(var(--u)*1.9))/1.1 var(--font-ui); font-variant-numeric:tabular-nums; color:var(--ivory); white-space:nowrap; }
    .gnn-rk-val small { font-size:.62em; color:var(--mist); margin-left:.35em; font-weight:500; letter-spacing:.06em; }
    .gnn-rk-bar { position:relative; height:calc(var(--u)*1); background:rgba(255,255,255,.07); box-shadow:inset 0 0 0 1px rgba(214,179,106,.2); overflow:hidden; }
    .gnn-rk-bar i { position:absolute; inset:0; transform-origin:left center; transform:scaleX(0); background:linear-gradient(90deg, color-mix(in srgb, var(--c) 52%, #000), var(--c)); box-shadow:0 0 calc(var(--u)*1.2) color-mix(in srgb, var(--c) 55%, transparent); }
    .gnn-rk.lead { background:linear-gradient(90deg, rgba(214,179,106,.2), rgba(214,179,106,0) 88%); box-shadow:inset 3px 0 0 var(--brass-hi); }
    .gnn-rk.lead .gnn-rk-n { color:var(--gold); text-shadow:0 0 calc(var(--u)*1) rgba(255,213,79,.6); }
    .gnn-rk.lead .gnn-rk-name { color:#fff2cf; }
    .gnn-rk.lead .gnn-rk-bar i::after { content:""; position:absolute; inset:0; background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%); transform:translateX(-120%); animation:gnn-sheen 2.4s 1.6s ease-in-out infinite; }
    .gnn-rk.me .gnn-rk-name { color:#d9f4ff; }

    /* ---- title card (opening stinger) ---- */
    .gnn-title { position:absolute; inset:0; z-index:7; display:none; place-items:center; pointer-events:none; background:radial-gradient(ellipse at 50% 46%, rgba(8,14,46,.7), rgba(2,4,14,.95) 76%); }
    .gnn[data-mode=title] .gnn-title { display:grid; }
    .gnn-title-in { display:flex; flex-direction:column; align-items:center; gap:calc(var(--u)*2.4); text-align:center; }
    .gnn-title-logo svg { width:calc(var(--u)*14); height:auto; display:block; filter:drop-shadow(0 0 calc(var(--u)*2) rgba(120,170,255,.45)); }
    .gnn[data-mode=title] .gnn-title-logo { animation:gnn-zoom 1s var(--ease) both; }
    .gnn-title-name { margin:0; font:400 calc(var(--u)*4.6)/1 var(--font-title); letter-spacing:.2em; text-transform:uppercase; color:transparent; padding-left:.2em;
      background:linear-gradient(100deg, transparent 36%, rgba(255,255,255,.95) 50%, transparent 64%) no-repeat 160% 0 / 260% 100%, linear-gradient(180deg,#fff6d8 0%,#e9cf90 40%,#c39a50 72%,#7d6334 100%);
      -webkit-background-clip:text; background-clip:text; filter:drop-shadow(0 calc(var(--u)*.3) 0 rgba(0,0,0,.5)) drop-shadow(0 0 calc(var(--u)*2) rgba(214,179,106,.3)); }
    .gnn[data-mode=title] .gnn-title-name { animation:gnn-up .8s .35s var(--ease) both, gnn-gloss 1.8s .9s ease-out both; }
    .gnn-title-year { display:flex; align-items:center; gap:calc(var(--u)*2); font:400 calc(var(--u)*2.6)/1 var(--font-display); letter-spacing:.5em; color:var(--brass-hi); padding-left:.5em; }
    .gnn-title-year::before, .gnn-title-year::after { content:""; width:calc(var(--u)*9); height:1px; background:linear-gradient(90deg, transparent, var(--brass)); }
    .gnn-title-year::after { transform:scaleX(-1); }
    .gnn[data-mode=title] .gnn-title-year { animation:gnn-up .8s .7s var(--ease) both; }
    .gnn-title-meta { color:var(--mist); font:500 calc(var(--u)*1.3)/1 var(--font-ui); letter-spacing:.3em; text-transform:uppercase; }
    .gnn[data-mode=title] .gnn-title-meta { animation:gnn-up .8s 1s var(--ease) both; }

    /* ---- transitions ---- */
    .gnn-cut { position:absolute; inset:-3% -12%; z-index:9; pointer-events:none; overflow:hidden; transform:skewX(-12deg); visibility:hidden; }
    .gnn-cut.go { visibility:visible; }
    .gnn-cut-p { position:absolute; inset:0; clip-path:inset(0 100% 0 0); background:linear-gradient(100deg, #070b2a 0%, #16205e 46%, #070b2a 100%);
      box-shadow:inset 0 0 0 calc(var(--u)*.3) rgba(214,179,106,.0); }
    .gnn-cut-p::before { content:""; position:absolute; inset:0; opacity:.5; background:repeating-linear-gradient(100deg, rgba(214,179,106,.18) 0 1px, transparent 1px calc(var(--u)*2.4)); }
    .gnn-cut-e { position:absolute; top:0; bottom:0; left:0; width:calc(var(--u)*1.1); margin-left:calc(var(--u)*-.55); background:linear-gradient(180deg, var(--brass-hi), var(--brass), var(--brass-lo)); box-shadow:0 0 calc(var(--u)*2.2) var(--brass), 0 0 calc(var(--u)*.6) #fff; opacity:0; }
    .gnn-flash { position:absolute; inset:0; z-index:9; pointer-events:none; opacity:0; background:radial-gradient(ellipse at 50% 50%, rgba(255,200,205,.85), rgba(255,92,106,.4) 70%); mix-blend-mode:screen; }
    .gnn-fade { position:absolute; inset:0; z-index:10; pointer-events:none; background:#02030a; opacity:0; transition:opacity .5s ease; }
    .gnn.out .gnn-fade { opacity:1; }
    .gnn.out { cursor:default; }

    /* ---- keyframes ---- */
    @keyframes gnn-blink { 50% { opacity:.25; } }
    @keyframes gnn-caret { to { opacity:0; } }
    @keyframes gnn-flash { 0%, 100% { opacity:1; } 55% { opacity:.2; } }
    @keyframes gnn-fade { from { opacity:0; } }
    @keyframes gnn-pop { from { opacity:0; transform:scale(.94); } }
    @keyframes gnn-slide { from { opacity:0; transform:translateX(calc(var(--u)*-3)); } }
    @keyframes gnn-slide-r { from { opacity:0; transform:translateX(calc(var(--u)*5)); } }
    @keyframes gnn-reveal { from { clip-path:inset(0 100% 0 0); } to { clip-path:inset(0 0 0 0); } }
    @keyframes gnn-sheen { 0% { opacity:1; transform:translateX(-120%); } 100% { opacity:1; transform:translateX(120%); } }
    @keyframes gnn-up { from { opacity:0; transform:translateY(calc(var(--u)*1.6)); } }
    @keyframes gnn-zoom { from { opacity:0; transform:scale(.6) rotate(-6deg); } }
    @keyframes gnn-gloss { from { background-position:160% 0, 0 0; } to { background-position:-60% 0, 0 0; } }
    @keyframes gnn-tk { from { transform:translateX(0); } to { transform:translateX(calc(var(--tk-w, 1000px) * -1)); } }
    @media (prefers-reduced-motion: reduce) { .gnn *, .gnn *::before, .gnn *::after { animation:none !important; transition:none !important; } }
    .gnn.rm *, .gnn.rm *::before, .gnn.rm *::after { animation:none !important; }
    .gnn.rm .gnn-lt.in .gnn-lt-txt, .gnn.rm .gnn-mon.in .gnn-mon-cv { animation:gnn-fade .35s ease both !important; }
    .gnn.rm .gnn-tk-track { animation:none !important; }
    .gnn.rm .gnn-fade { transition:opacity .25s linear; }

    /* ---- archive modal ---- */
    .gnn-arch-modal { width:min(92vw, 60rem); }
    .gnn-arch { display:flex; flex-direction:column; gap:.7rem; height:min(66vh, 38rem); min-width:min(80vw, 46rem); }
    .gnn-arch-bar { display:flex; flex-wrap:wrap; align-items:center; gap:.45rem .6rem; }
    .gnn-arch-chips { display:flex; flex-wrap:wrap; gap:.3rem; flex:1 1 100%; }
    .gnn-arch-chips .btn { padding:.15em .7em; font-size:.88rem; }
    .gnn-arch-chips .btn .n { margin-left:.4em; font:500 .72rem var(--font-ui); opacity:.75; }
    .gnn-arch-bar .field { min-width:0; padding:.2em .6em; font-size:.92rem; }
    .gnn-arch-bar input.field { flex:1 1 12rem; }
    .gnn-arch-count { margin-left:auto; color:var(--mist); font-size:.88rem; white-space:nowrap; }
    .gnn-arch-list { flex:1; min-height:0; overflow:auto; padding-right:.3rem; user-select:text; -webkit-user-select:text; }
    .gnn-arch-y { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:.7rem; margin:.3rem 0 .15rem; padding:.3rem .6rem; font:400 1.1rem var(--font-display); letter-spacing:.08em; color:var(--brass-hi);
      background:linear-gradient(90deg, #121b52, #0c1440); border-bottom:1px solid rgba(214,179,106,.4); }
    .gnn-arch-y small { margin-left:auto; font:500 .8rem var(--font-ui); color:var(--mist); letter-spacing:.04em; }
    .gnn-arow { display:grid; grid-template-columns:11rem 1fr auto; align-items:center; gap:.7rem; padding:.34rem .6rem; border-bottom:1px solid rgba(255,255,255,.05); }
    .gnn-arow:hover { background:rgba(98,216,255,.06); }
    .gnn-achip { display:inline-flex; align-items:center; gap:.4rem; color:var(--c, var(--mist)); font:400 .86rem var(--font-display); letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .gnn-achip .ico { width:1.05rem; height:1.05rem; }
    .gnn-ahl { color:var(--ivory); line-height:1.3; }
    .gnn-arace { display:inline-flex; align-items:center; gap:.35rem; margin-left:.4rem; color:var(--mist); font-size:.82rem; white-space:nowrap; }
    .gnn-arace i { width:.62rem; height:.62rem; transform:rotate(45deg); background:var(--c, var(--brass)); box-shadow:0 0 5px var(--c, var(--brass)); }
    .gnn-arch-empty { padding:2.2rem 1rem; text-align:center; color:var(--mist); }
    .gnn-arch-more { display:flex; justify-content:center; padding:.8rem 0; }
  `);

  // ================================================================== canvas toolkit
  const warned = {};
  function warnOnce(k, e) { if (!warned[k]) { warned[k] = 1; console.warn('[gnn] ' + k + ' failed - using a fallback:', e && e.message || e); } }
  // size a canvas backing store to its layout box (ignores CSS transforms) and return {ctx, w, h, S} in CSS px
  function fit(cv, cap) {
    const w = cv.clientWidth, hh = cv.clientHeight;
    if (w < 2 || hh < 2) return null;
    const dpr = dprFor(cap), pw = round(w * dpr), ph = round(hh * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(pw / w, 0, 0, ph / hh, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return { ctx: ctx, w: w, h: hh, S: pw / w };
  }
  const _glow = {};
  function glowSpr(hex) {
    let c = _glow[hex];
    if (c) return c;
    c = mkCanvas(96, 96);
    const g = c.getContext('2d');
    g.fillStyle = rgr(g, 48, 48, 0, 48, [0, rgba(hex, 1), 0.16, rgba(hex, 0.6), 0.4, rgba(hex, 0.2), 0.7, rgba(hex, 0.05), 1, rgba(hex, 0)]);
    g.fillRect(0, 0, 96, 96);
    return (_glow[hex] = c);
  }
  function glow(g, hex, x, y, r, a) {
    if (a <= 0.004 || r < 0.5) return;
    const oa = g.globalAlpha, oc = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = oa * (a > 1 ? 1 : a);
    g.drawImage(glowSpr(hex), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = oa; g.globalCompositeOperation = oc;
  }
  const _hasLS = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
  function text(g, s, x, y, size, col, align, font, weight, ls) {
    g.font = (weight || 400) + ' ' + size + 'px ' + (font || FONT_U);
    g.textAlign = align || 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = col;
    if (_hasLS) g.letterSpacing = (ls || 0) + 'px';
    g.fillText(s, x, y);
    if (_hasLS && ls) g.letterSpacing = '0px';
  }
  function chamferPath(g, x, y, w, hh, c) {
    c = min(c, w / 2, hh / 2);
    g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + hh - c);
    g.lineTo(x + w - c, y + hh); g.lineTo(x + c, y + hh); g.lineTo(x, y + hh - c); g.lineTo(x, y + c); g.closePath();
  }
  const brassGrad = (g, x0, y0, x1, y1) => lgr(g, x0, y0, x1, y1, [0, '#f3dca0', 0.3, '#d6b36a', 0.62, '#8a7040', 0.85, '#d6b36a', 1, '#f3dca0']);
  function brassFrame(g, x, y, w, hh, c, lw) {
    lw = lw || 2;
    chamferPath(g, x, y, w, hh, c); g.lineWidth = lw; g.strokeStyle = brassGrad(g, x, y, x + w, y + hh); g.stroke();
    chamferPath(g, x + lw * 1.6, y + lw * 1.6, w - lw * 3.2, hh - lw * 3.2, max(1, c - lw)); g.lineWidth = max(0.6, lw * 0.35); g.strokeStyle = rgba('#8a7040', 0.8); g.stroke();
  }
  function beamShape(g, x0, y0, x1, y1, w0, w1, col, a) {
    const dx = x1 - x0, dy = y1 - y0, L = hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    g.fillStyle = lgr(g, x0, y0, x1, y1, [0, rgba(col, a), 1, rgba(col, 0)]);
    g.beginPath(); g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2); g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); g.closePath(); g.fill();
  }
  const _scan = {};
  function scanPattern(g) {
    if (!_scan.p) {
      const c = mkCanvas(2, 3), cg = c.getContext('2d');
      cg.fillStyle = 'rgba(0,0,10,.3)'; cg.fillRect(0, 1, 2, 1); cg.fillStyle = 'rgba(0,0,0,.08)'; cg.fillRect(0, 2, 2, 1);
      _scan.p = g.createPattern(c, 'repeat');
    }
    return _scan.p;
  }

  // the GNN emblem: a blue globe ringed by a tilted brass orbit with a bright satellite (drawn live, any size)
  function drawLogo(g, cx, cy, r, t, a, label) {
    g.save(); g.globalAlpha *= a; g.translate(cx, cy);
    const tilt = -0.36, rx = r * 1.72, ry = r * 0.5, th = t * 0.7;
    const ring = front => {
      g.save(); g.rotate(tilt);
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, front ? 0 : PI, front ? PI : TAU);
      g.lineWidth = r * 0.13; g.strokeStyle = lgr(g, -rx, 0, rx, 0, [0, '#8a7040', 0.5, '#f3dca0', 1, '#8a7040']); g.stroke();
      g.lineWidth = r * 0.03; g.strokeStyle = 'rgba(255,247,216,.7)'; g.stroke();
      const sx = cos(th) * rx, sy = sin(th) * ry;
      if ((sin(th) > 0) === front) { glow(g, '#9fe4ff', sx, sy, r * 0.5, 0.9); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, r * 0.085, 0, TAU); g.fill(); }
      g.restore();
    };
    ring(false);
    const gg = g.createRadialGradient(-r * 0.38, -r * 0.4, r * 0.05, -r * 0.38, -r * 0.4, r * 1.15);
    gg.addColorStop(0, '#d8f0ff'); gg.addColorStop(0.28, '#5b9be0'); gg.addColorStop(0.65, '#1b3a8e'); gg.addColorStop(1, '#071040');
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fillStyle = gg; g.fill();
    g.save(); g.clip();
    g.strokeStyle = 'rgba(230,244,255,.42)'; g.lineWidth = max(0.8, r * 0.035);
    for (let i = 1; i < 4; i++) { g.beginPath(); g.ellipse(0, 0, r * i / 4, r, 0, 0, TAU); g.stroke(); }
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-r, i * r * 0.36); g.quadraticCurveTo(0, i * r * 0.36 + (i ? i * r * 0.13 : 0), r, i * r * 0.36); g.stroke(); }
    g.fillStyle = 'rgba(2,6,30,.5)'; g.beginPath(); g.arc(r * 0.42, r * 0.4, r * 1.05, 0, TAU); g.arc(0, 0, r, 0, TAU, true); g.fill('evenodd');
    g.restore();
    g.lineWidth = r * 0.06; g.strokeStyle = brassGrad(g, -r, -r, r, r); g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    ring(true);
    if (label) text(g, label, r * 2.3, r * 0.46, r * 1.28, '#ece6d3', 'left', FONT_D, 400, r * 0.1);
    g.restore();
  }

  // ================================================================== studio backdrop (Scenes.newsroom, or the built-in set)
  function defaultRects(w, hh) {
    return {
      wall: { x: w * 0.455, y: hh * 0.135, w: w * 0.485, h: hh * 0.43 },
      lowerThird: { x: w * 0.055, y: hh * 0.8, w: w * 0.89, h: hh * 0.092 },
      ticker: { x: w * 0.055, y: hh * 0.905, w: w * 0.89, h: hh * 0.05 },
      logo: { x: w * 0.9, y: hh * 0.04, w: w * 0.06, h: hh * 0.07 },
      anchor: { x: w * 0.16, y: hh * 0.095, w: hh * 0.512, h: hh * 0.64 },
    };
  }
  const okRect = r => !!r && isFinite(r.x) && isFinite(r.y) && isFinite(r.w) && isFinite(r.h) && r.w > 2 && r.h > 2;
  function sanitizeRects(L, w, hh) {
    const d = defaultRects(w, hh);
    if (L && typeof L === 'object') for (const k in d) if (okRect(L[k])) d[k] = { x: L[k].x, y: L[k].y, w: L[k].w, h: L[k].h };
    return d;
  }

  // ---- robot anchor placeholder (used when no portrait is painted): a chamfered brass android bust in a 400x500 frame
  function drawRobot(g, x, y, w, hh, t, talking) {
    const sc = min(w / 400, hh / 500);
    g.save(); g.translate(x + w / 2, y + hh); g.scale(sc, sc);
    // suit
    g.fillStyle = lgr(g, 0, -190, 0, 0, [0, '#26357e', 1, '#0a1038']);
    g.beginPath(); g.moveTo(-190, 0); g.lineTo(-176, -118); g.lineTo(-64, -176); g.lineTo(64, -176); g.lineTo(176, -118); g.lineTo(190, 0); g.closePath(); g.fill();
    g.strokeStyle = '#d6b36a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-64, -176); g.lineTo(0, -122); g.lineTo(64, -176); g.stroke();
    g.fillStyle = brassGrad(g, -110, -130, -80, -100); g.beginPath(); g.moveTo(-96, -128); g.lineTo(-82, -118); g.lineTo(-82, -102); g.lineTo(-96, -92); g.lineTo(-110, -102); g.lineTo(-110, -118); g.closePath(); g.fill();
    // neck
    g.fillStyle = lgr(g, -26, 0, 26, 0, [0, '#1a2252', 0.5, '#3a4a94', 1, '#141b46']); g.fillRect(-26, -236, 52, 64);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-26, -228 + i * 14); g.lineTo(26, -228 + i * 14); g.stroke(); }
    // head
    chamferPath(g, -86, -430, 172, 196, 38);
    g.fillStyle = lgr(g, -86, -430, 86, -234, [0, '#f6e3b0', 0.3, '#d6b36a', 0.7, '#a07f3c', 1, '#6e5830']); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#3a2c10'; g.stroke();
    // ears + antenna
    for (const s of [-1, 1]) { g.fillStyle = brassGrad(g, s * 90, -340, s * 120, -300); g.beginPath(); g.arc(s * 98, -332, 22, 0, TAU); g.fill(); g.fillStyle = '#62d8ff'; g.beginPath(); g.arc(s * 98, -332, 7, 0, TAU); g.fill(); }
    g.fillStyle = '#8a7040'; g.fillRect(-4, -462, 8, 34); glow(g, '#ff6a7a', 0, -466, 14, 0.5 + 0.5 * sin(t * 4)); g.fillStyle = '#ff6a7a'; g.beginPath(); g.arc(0, -466, 6, 0, TAU); g.fill();
    // visor
    chamferPath(g, -68, -372, 136, 50, 14); g.fillStyle = lgr(g, 0, -372, 0, -322, [0, '#1b2766', 1, '#05081f']); g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#3a2c10'; g.stroke();
    const blink = (sin(t * 0.9) > 0.985) ? 0.12 : 1;
    for (const s of [-1, 1]) { g.fillStyle = '#7ee4ff'; g.fillRect(s * 30 - 15, -347 - 8 * blink, 30, 16 * blink); glow(g, '#62d8ff', s * 30, -347, 30, 0.6); }
    // mouth: equaliser bars
    for (let i = 0; i < 7; i++) { const k = talking ? 4 + abs(sin(t * 11 + i * 1.7)) * 18 : 4; g.fillStyle = '#2a1d08'; g.fillRect(-42 + i * 12.5, -280 - k / 2, 9, k); }
    g.restore();
  }

  // portrait drawn into a feathered buffer so the frame edges melt into the set
  let _fb = null;
  function drawAnchor(g, race, x, y, w, hh, t, talking, mood) {
    const P = M.Gfx && M.Gfx.Portraits;
    if (portraitReady(race)) {
      try {
        let S = 1; try { S = g.getTransform().a || 1; } catch (e) { /* old browser */ }
        const bw = ceil(w * S), bh = ceil(hh * S);
        if (!_fb) _fb = mkCanvas(bw, bh);
        if (_fb.width < bw || _fb.height < bh) { _fb.width = max(_fb.width, bw); _fb.height = max(_fb.height, bh); }
        const b = _fb.getContext('2d');
        b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.clearRect(0, 0, _fb.width, _fb.height);
        b.setTransform(S, 0, 0, S, 0, 0);
        P.draw(b, race, 0, 0, w, hh, { t: t, mood: mood || 'neutral', talking: !!talking, color: '#d6b36a', bg: false, key: 'gnn-anchor' });
        b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'destination-in';
        b.fillStyle = lgr(b, 0, 0, bw, 0, [0, 'rgba(0,0,0,0)', 0.06, '#000', 0.94, '#000', 1, 'rgba(0,0,0,0)']); b.fillRect(0, 0, bw, bh);
        b.globalCompositeOperation = 'source-over';
        g.drawImage(_fb, 0, 0, bw, bh, x, y, w, hh);
        return;
      } catch (e) { warnOnce('Portraits.draw', e); }
    }
    drawRobot(g, x, y, w, hh, t, talking);
  }

  // ---- built-in studio (same composition as Scenes.newsroom so every overlay lines up in both cases)
  let _st = null;
  function studioStatic(w, hh, S) {
    const key = round(w) + 'x' + round(hh) + '*' + S.toFixed(2);
    if (_st && _st.key === key) return _st;
    const cv = mkCanvas(w * S, hh * S), g = cv.getContext('2d'), R = defaultRects(w, hh), wl = R.wall;
    g.scale(S, S);
    g.fillStyle = lgr(g, 0, 0, 0, hh, [0, '#02031a', 0.35, '#0b1342', 0.7, '#0a1038', 1, '#03051a']); g.fillRect(0, 0, w, hh);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgr(g, w * 0.7, hh * 0.34, 0, w * 0.55, [0, 'rgba(60,90,220,.34)', 0.5, 'rgba(60,40,160,.14)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, hh);
    g.fillStyle = rgr(g, w * 0.1, hh * 0.4, 0, w * 0.4, [0, 'rgba(120,70,220,.24)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, hh);
    g.restore();
    for (let i = 0; i < 14; i++) { const x = w * i / 13; g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, 0, w * 0.034, hh * 0.72); g.fillStyle = rgba('#8a7040', 0.45); g.fillRect(x, 0, 1, hh * 0.72); }
    // left logo panel
    const lp = { x: w * 0.045, y: hh * 0.11, w: w * 0.165, h: hh * 0.52 };
    chamferPath(g, lp.x, lp.y, lp.w, lp.h, 14); g.fillStyle = lgr(g, 0, lp.y, 0, lp.y + lp.h, [0, '#101a5a', 1, '#070c30']); g.fill(); brassFrame(g, lp.x, lp.y, lp.w, lp.h, 14, 2);
    glow(g, '#6aa0ff', lp.x + lp.w / 2, lp.y + lp.h * 0.4, lp.w * 0.8, 0.3);
    text(g, 'GALACTIC', lp.x + lp.w / 2, lp.y + lp.h * 0.77, max(10, lp.w * 0.12), rgba('#f3dca0', 0.95), 'center', FONT_D, 400, lp.w * 0.02);
    text(g, 'NEWS NETWORK', lp.x + lp.w / 2, lp.y + lp.h * 0.85, max(10, lp.w * 0.12), rgba('#f3dca0', 0.95), 'center', FONT_D, 400, lp.w * 0.02);
    // video wall frame
    const fx = wl.x - w * 0.016, fy = wl.y - w * 0.016, fw = wl.w + w * 0.032, fh = wl.h + w * 0.032;
    chamferPath(g, fx, fy, fw, fh, 16); g.fillStyle = lgr(g, 0, fy, 0, fy + fh, [0, '#2a387e', 0.5, '#101a58', 1, '#070c30']); g.fill(); brassFrame(g, fx, fy, fw, fh, 16, 2.4);
    g.fillStyle = '#01030c'; g.fillRect(wl.x, wl.y, wl.w, wl.h);
    glow(g, '#7090ff', wl.x + wl.w / 2, wl.y + wl.h / 2, wl.w * 0.85, 0.2);
    // truss + lamps
    g.fillStyle = '#04061c'; g.fillRect(0, 0, w, hh * 0.055);
    g.fillStyle = brassGrad(g, 0, 0, w, 0); g.fillRect(0, hh * 0.055, w, 2); g.fillRect(0, hh * 0.02, w, 1.2);
    const lamps = [];
    for (let i = 0; i < 8; i++) {
      const x = w * (0.07 + i * 0.123), cols = ['#8fd0ff', '#ffe0a0', '#c8a8ff', '#8fd0ff'];
      g.fillStyle = '#0a0f2c'; chamferPath(g, x - 14, hh * 0.05, 28, 22, 5); g.fill(); g.lineWidth = 1; g.strokeStyle = rgba('#d6b36a', 0.7); g.stroke();
      lamps.push({ x: x, y: hh * 0.07, col: cols[i % 4] });
    }
    // floor + desk
    const fy2 = hh * 0.735;
    g.fillStyle = lgr(g, 0, fy2, 0, hh, [0, '#0e1650', 0.3, '#070b2c', 1, '#02030f']); g.fillRect(0, fy2, w, hh - fy2);
    g.strokeStyle = rgba('#d6b36a', 0.4); g.lineWidth = 2; g.beginPath(); g.ellipse(w * 0.34, hh * 0.99, w * 0.5, hh * 0.22, 0, PI, TAU); g.stroke();
    g.fillStyle = brassGrad(g, 0, 0, w, 0); g.fillRect(0, fy2 - 1, w, 2.5);
    const yT = hh * 0.715, x1 = w * 0.62;
    g.beginPath(); g.moveTo(-w * 0.02, yT); g.lineTo(x1, yT); g.bezierCurveTo(x1 + w * 0.025, yT + hh * 0.02, x1 + w * 0.01, yT + hh * 0.06, x1 - w * 0.02, yT + hh * 0.075);
    g.bezierCurveTo(w * 0.45, hh * 0.835, w * 0.2, hh * 0.84, -w * 0.02, hh * 0.8); g.closePath();
    g.fillStyle = lgr(g, 0, yT, 0, hh * 0.84, [0, '#2a387e', 0.14, '#16206a', 0.5, '#0a1040', 1, '#04061c']); g.fill();
    g.lineWidth = 2.4; g.strokeStyle = brassGrad(g, 0, 0, x1, 0); g.beginPath(); g.moveTo(-w * 0.02, yT); g.lineTo(x1, yT); g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#8fe0ff', 0.8); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-w * 0.02, yT + hh * 0.021); g.bezierCurveTo(w * 0.2, yT + hh * 0.029, w * 0.45, yT + hh * 0.027, x1 + 2, yT + hh * 0.014); g.stroke(); g.restore();
    return (_st = { key: key, cv: cv, R: R, lamps: lamps });
  }
  function fallbackStudio(g, w, hh, t, o, S) {
    const st = studioStatic(w, hh, S), R = st.R, wl = R.wall;
    g.drawImage(st.cv, 0, 0, w, hh);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < st.lamps.length; i++) {
      const Lm = st.lamps[i], sw = sin(t * 0.25 + i * 1.7) * w * 0.04, tx = Lm.x + (w * 0.5 - Lm.x) * 0.25 + sw;
      beamShape(g, Lm.x, Lm.y, tx, hh * 0.76, 10, w * 0.12, Lm.col, 0.07 + 0.015 * sin(t * 0.9 + i));
      glow(g, Lm.col, Lm.x, Lm.y + 4, 26, 0.5 + 0.1 * sin(t * 3 + i));
    }
    g.restore();
    // the emblem on the logo panel
    const lp = { x: w * 0.045, y: hh * 0.11, w: w * 0.165, h: hh * 0.52 };
    drawLogo(g, lp.x + lp.w * 0.5, lp.y + lp.h * 0.4, lp.w * 0.24, t, 1);
    // wall shimmer
    g.save(); g.beginPath(); g.rect(wl.x, wl.y, wl.w, wl.h); g.clip();
    g.fillStyle = scanPattern(g); g.globalAlpha = 0.35; g.fillRect(wl.x, wl.y, wl.w, wl.h); g.globalAlpha = 1;
    const sweep = fract(t * 0.12);
    g.fillStyle = lgr(g, 0, wl.y + sweep * wl.h * 1.4 - wl.h * 0.2, 0, wl.y + sweep * wl.h * 1.4, [0, 'rgba(160,200,255,0)', 1, 'rgba(160,200,255,.07)']); g.fillRect(wl.x, wl.y, wl.w, wl.h);
    g.restore();
    // anchor
    const a = R.anchor;
    glow(g, '#6e96ff', a.x + a.w / 2, a.y + a.h * 0.4, a.w * 0.8, 0.26);
    drawAnchor(g, o.anchorRace, a.x, a.y, a.w, a.h, t, o.talking, o.mood);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = lgr(g, a.x + a.w * 0.5, 0, a.x + a.w, 0, [0, 'rgba(120,160,255,0)', 1, 'rgba(120,160,255,.1)']); g.fillRect(a.x + a.w * 0.5, a.y + a.h * 0.1, a.w * 0.5, a.h * 0.8); g.restore();
    // desk edge in front of the anchor
    g.fillStyle = lgr(g, 0, hh * 0.715, 0, hh * 0.84, [0, '#2a387e', 0.14, '#16206a', 0.5, '#0a1040', 1, '#04061c']);
    g.beginPath(); g.moveTo(-w * 0.02, hh * 0.722); g.lineTo(w * 0.62, hh * 0.722); g.lineTo(w * 0.6, hh * 0.84); g.lineTo(-w * 0.02, hh * 0.84); g.closePath(); g.fill();
    g.lineWidth = 2.4; g.strokeStyle = brassGrad(g, 0, 0, w * 0.62, 0); g.beginPath(); g.moveTo(-w * 0.02, hh * 0.722); g.lineTo(w * 0.62, hh * 0.722); g.stroke();
    // channel bug (top right)
    const lg = R.logo;
    drawLogo(g, w * 0.925, hh * 0.075, hh * 0.026, t, 0.95);
    text(g, 'GNN', w * 0.925 - hh * 0.1, hh * 0.087, hh * 0.04, rgba('#ece6d3', 0.92), 'right', FONT_D, 400, 1.5);
    g.fillStyle = rgba('#ff5c6a', sin(t * 4) > -0.2 ? 0.95 : 0.2); g.beginPath(); g.arc(w * 0.925 + hh * 0.06, hh * 0.075, hh * 0.008, 0, TAU); g.fill();
    void lg;
    // vignette
    g.fillStyle = rgr(g, w / 2, hh * 0.48, min(w, hh) * 0.38, hypot(w, hh) * 0.62, [0, 'rgba(2,3,12,0)', 1, 'rgba(2,3,12,.45)']); g.fillRect(0, 0, w, hh);
    return R;
  }

  // Scenes.newsroom when present (its layout rects drive every DOM overlay), otherwise the built-in set. Returns {L, scene, cam}.
  let sceneBroken = false;
  function paintBackdrop(g, w, hh, t, o, S) {
    const SC = M.Gfx && M.Gfx.Scenes, ns = SC && SC.newsroom;
    if (!sceneBroken && ns && typeof ns.draw === 'function') {
      try {
        const L = ns.draw(g, w, hh, t, o);
        const I = o.cut > 0 && o.cut < 1 ? pow(sin(o.cut * PI), 1.2) : 0;
        // the newsroom drifts its whole set slowly (camera); the video wall must follow it exactly
        const cam = L && L.cam && isFinite(L.cam.z) ? L.cam : { z: 1.035 + 0.008 * sin(t * 0.13) + 0.05 * I, dx: sin(t * 0.21) * w * 0.006, dy: cos(t * 0.17) * hh * 0.004 };
        return { L: sanitizeRects(L, w, hh), scene: true, cam: cam };
      } catch (e) {
        sceneBroken = true; warnOnce('Scenes.newsroom', e);
        try { g.restore(); } catch (_) { /* nothing saved */ }
        g.setTransform(S, 0, 0, S, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
    }
    return { L: fallbackStudio(g, w, hh, t, o, S), scene: false, cam: { z: 1, dx: 0, dy: 0 } };
  }

  // opening-stinger light show painted over the studio
  function titleFx(g, w, hh, t, k) {
    if (k <= 0.01) return;
    const cx = w * 0.5, cy = hh * 0.4, n = 28, rot = t * 0.08, Rr = hypot(w, hh);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const a0 = rot + i / n * TAU, a1 = a0 + TAU / n * 0.38;
      g.fillStyle = rgba('#d6b36a', 0.05 * k * (0.6 + 0.4 * sin(t * 1.2 + i)));
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cos(a0) * Rr, cy + sin(a0) * Rr); g.lineTo(cx + cos(a1) * Rr, cy + sin(a1) * Rr); g.closePath(); g.fill();
    }
    for (let i = 0; i < 3; i++) { const q = fract(t * 0.45 + i / 3); g.strokeStyle = rgba('#f3dca0', (1 - q) * 0.4 * k); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, hh * (0.14 + q * 0.6), 0, TAU); g.stroke(); }
    glow(g, '#ffd98a', cx, cy, hh * 0.55, 0.32 * k);
    g.restore();
  }

  // ================================================================== graphics window renderers
  const HULL_LEN = { frigate: 1, destroyer: 1.45, cruiser: 2.1, battleship: 3, doomstar: 4.4 };
  const LOOK_COL = { terran: '#2f6fc0', jungle: '#238a58', ocean: '#1b6cc8', arid: '#b0623a', steppe: '#8a8a3c', desert: '#c8883c', minimal: '#7a6a76', barren: '#74747c', tundra: '#a4bcd8', dead: '#5e5a54', inferno: '#9a2c10', toxic: '#6a8a22', radiated: '#5a3a7a', gaia: '#2a8ad8', gasgiant: '#c48858', asteroids: '#7a7068' };
  const STAR_COL = { yellow: '#ffd25a', orange: '#ff9a3a', red: '#ff4a2e', blue: '#5a9cff', white: '#d6e2ff', green: '#58f08c', purple: '#9a50ff', blackhole: '#ff9a40', brown: '#c0703a', neutron: '#9a50ff' };
  const STAR_TXT = { yellow: 'Yellow star', orange: 'Orange star', red: 'Red dwarf', blue: 'Blue giant', white: 'White star', green: 'Green star', purple: 'Neutron star', blackhole: 'Black hole', brown: 'Brown dwarf', neutron: 'Neutron star' };
  const starCol = kind => STAR_COL[kind] || STAR_COL.yellow;

  // cached nebula + starfield behind a graphic
  const _gbg = new Map();
  function gfxBg(w, hh, S, seed, pal) {
    const key = seed + '|' + round(w) + 'x' + round(hh) + '*' + S.toFixed(2);
    let c = _gbg.get(key);
    if (c) return c;
    const pw = max(8, round(w * S)), ph = max(8, round(hh * S)), Sp = (M.Gfx && M.Gfx.pick && M.Gfx.pick('space')) || (M.Gfx && M.Gfx.Space);
    if (Sp && typeof Sp.makeBackdrop === 'function') {
      try { c = Sp.makeBackdrop(pw, ph, 'gnn' + seed, { intensity: 0.8, stars: 1, palette: pal }); } catch (e) { warnOnce('Space.makeBackdrop', e); c = null; }
    }
    if (!c) {
      c = mkCanvas(pw, ph);
      const g = c.getContext('2d'), rnd = rng32(seed);
      g.fillStyle = lgr(g, 0, 0, pw, ph, [0, '#04061a', 0.5, '#0a1240', 1, '#03040f']); g.fillRect(0, 0, pw, ph);
      for (let i = 0; i < 3; i++) glow(g, pal[i % pal.length] || '#2b2a86', pw * rnd(), ph * rnd(), max(pw, ph) * 0.5, 0.2);
      for (let i = 0, n = floor(pw * ph / 2200); i < n; i++) { g.fillStyle = rgba('#ffffff', 0.25 + rnd() * 0.7); g.fillRect(rnd() * pw, rnd() * ph, 1 + (rnd() < 0.08 ? 1 : 0), 1 + (rnd() < 0.08 ? 1 : 0)); }
    }
    _gbg.set(key, c);
    if (_gbg.size > 8) _gbg.delete(_gbg.keys().next().value);
    return c;
  }

  // effects: the real Gfx.Fx pool when available, otherwise a tiny stand-in with the same calls
  function miniFx() {
    const items = [];
    return {
      real: false,
      beam(x1, y1, x2, y2, kind, dur, o) { items.push({ k: 'beam', x1: x1, y1: y1, x2: x2, y2: y2, t: 0, dur: dur || 0.25, col: (o && o.color) || '#8fd8ff' }); return { done: false }; },
      explosion(x, y, size) { items.push({ k: 'boom', x: x, y: y, r: size || 30, t: 0, dur: 0.6, col: '#ffb060' }); },
      novaBlast(x, y, r) { r = r || 100; items.push({ k: 'boom', x: x, y: y, r: r * 1.7, t: 0, dur: 1.4, col: '#ffe9b0' }); items.push({ k: 'ring', x: x, y: y, r: r * 2.6, t: 0, dur: 1.5, col: '#ffd9a0' }); },
      planetImpact(x, y, r) { items.push({ k: 'boom', x: x, y: y, r: (r || 60) * 0.8, t: 0, dur: 0.9, col: '#ff8a40' }); },
      pulse(x, y, r, col) { items.push({ k: 'ring', x: x, y: y, r: r || 80, t: 0, dur: 1.2, col: col || '#62d8ff' }); },
      debris() {}, sparks() {},
      update(dt) { for (let i = items.length - 1; i >= 0; i--) { items[i].t += dt; if (items[i].t >= items[i].dur) items.splice(i, 1); } },
      draw(g) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const e of items) {
          const p = e.t / e.dur;
          if (e.k === 'beam') { g.globalAlpha = 1 - p; g.strokeStyle = e.col; g.lineWidth = 2.4; g.beginPath(); g.moveTo(e.x1, e.y1); g.lineTo(e.x2, e.y2); g.stroke(); g.lineWidth = 7; g.globalAlpha = 0.18 * (1 - p); g.stroke(); }
          else if (e.k === 'boom') { glow(g, e.col, e.x, e.y, e.r * (0.4 + 1.1 * p), 1 - p); }
          else { g.globalAlpha = (1 - p) * 0.8; g.strokeStyle = e.col; g.lineWidth = 2; g.beginPath(); g.arc(e.x, e.y, e.r * p, 0, TAU); g.stroke(); }
        }
        g.restore();
      },
    };
  }
  function makeFx() {
    const F = (M.Gfx && M.Gfx.pick && M.Gfx.pick('fx')) || (M.Gfx && M.Gfx.Fx);
    if (F && typeof F.create === 'function') {
      try { const f = F.create({ maxParticles: 1800, maxEntities: 160 }); if (f && typeof f.explosion === 'function' && typeof f.beam === 'function' && typeof f.update === 'function') { f.real = true; if (f.setQuality) f.setQuality(clamp(PQ().particles || 0.7, 0.3, 1)); return f; } } catch (e) { warnOnce('Gfx.Fx', e); }
    }
    return miniFx();
  }

  // ---- planet / ship / star wrappers with plain fallbacks
  function drawPlanetSafe(g, desc, cx, cy, r, t, opt) {
    const P = (M.Gfx && M.Gfx.pick && M.Gfx.pick('planets')) || (M.Gfx && M.Gfx.Planets);
    if (P && typeof P.draw === 'function') {
      try { P.draw(g, desc, cx, cy, r, t, opt); return; } catch (e) { warnOnce('Planets.draw', e); }
    }
    const col = LOOK_COL[desc && desc.look] || '#2f6fc0', la = (opt && opt.lightAngle) || -2.3;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip();
    g.fillStyle = col; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    const rnd = rng32(hashStr((desc && desc.seed) + '' + (desc && desc.look)));
    for (let i = 0; i < 14; i++) { g.fillStyle = rgba(rnd() < 0.5 ? dark(col, 0.4) : lite(col, 0.3), 0.25); g.beginPath(); g.ellipse(cx + (rnd() - 0.5) * r * 1.5, cy + (rnd() - 0.5) * r * 1.5, r * (0.1 + rnd() * 0.3), r * (0.06 + rnd() * 0.2), rnd() * PI, 0, TAU); g.fill(); }
    const lx = cx + cos(la) * r * 0.45, ly = cy + sin(la) * r * 0.45;
    const sh = g.createRadialGradient(lx, ly, r * 0.1, lx, ly, r * 1.6);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.5, 'rgba(2,4,14,.35)'); sh.addColorStop(1, 'rgba(2,4,14,.95)');
    g.fillStyle = sh; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.strokeStyle = rgba(lite(col, 0.4), 0.5); g.lineWidth = max(1, r * 0.04); g.beginPath(); g.arc(cx, cy, r - g.lineWidth / 2, la - 1.1, la + 1.1); g.stroke();
  }
  function drawShipSafe(g, o) {
    const S = M.Gfx && M.Gfx.Ships;
    if (S && typeof S.draw === 'function' && o.race) {
      try { S.draw(g, o); return; } catch (e) { warnOnce('Ships.draw', e); }
    }
    drawRaider(g, o.x, o.y, o.size * (HULL_LEN[o.hull] || 1), o.angle || 0, o.color || '#ff5c6a', o.t || 0);
  }
  function drawRaider(g, x, y, len, ang, col, t) {
    const L = len / 2;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = lgr(g, -L, 0, L, 0, [0, dark(col, 0.8), 1, dark(col, 0.4)]);
    g.beginPath(); g.moveTo(L, 0); g.lineTo(L * 0.1, -L * 0.55); g.lineTo(-L * 0.7, -L * 0.9); g.lineTo(-L * 0.5, -L * 0.2); g.lineTo(-L, 0); g.lineTo(-L * 0.5, L * 0.2); g.lineTo(-L * 0.7, L * 0.9); g.lineTo(L * 0.1, L * 0.55); g.closePath(); g.fill();
    g.strokeStyle = rgba(col, 0.75); g.lineWidth = max(1, L * 0.05); g.stroke();
    glow(g, col, L * 0.55, 0, L * 0.35, 0.55 + 0.3 * sin(t * 5)); glow(g, '#ff9a60', -L * 1.02, 0, L * 0.3, 0.6);
    g.restore();
  }
  function starSurface(g, kind, cx, cy, r, t, S) {
    const Sp = M.Gfx && M.Gfx.Space, GP = (M.Gfx && M.Gfx.pick && M.Gfx.pick('planets'));
    const kk = kind === 'brown' ? 'red' : kind === 'neutron' ? 'purple' : kind;
    if (GP && GP !== M.Gfx.Planets && GP.drawStar) { try { if (GP.drawStar(g, kk, cx, cy, r, t, { dpr: S, spin: 0.012 })) return; } catch (e) { warnOnce('GLPlanets.drawStar', e); } }
    if (Sp && typeof Sp.drawStarSurface === 'function') {
      try { Sp.drawStarSurface(g, kind === 'brown' ? 'red' : kind === 'neutron' ? 'purple' : kind, cx, cy, r, t, { dpr: S, spin: 0.012 }); return; } catch (e) { warnOnce('Space.drawStarSurface', e); }
    }
    const col = starCol(kind);
    glow(g, col, cx, cy, r * 3, 0.55);
    g.fillStyle = rgr(g, cx, cy, 0, r, [0, '#ffffff', 0.55, lite(col, 0.45), 1, col]); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  }

  // ---- per-segment graphic state
  const NEB_BASE = ['#2b2a86', '#14357a', '#3b1d86', '#0d4f7a'];
  function makeGfx(it, t0) {
    const seed = hashStr(it.cat + '|' + it.headline), rnd = rng32(seed), gc = cssHex(GROUPS[it.grp].css);
    return { item: it, kind: it.graphic, fx: it.fx, seed: seed, rnd: rnd, t0: t0, planet: it.planet, star: it.star, grp: it.grp, init: false, fxs: null,
      next: 0.5, pend: [], pal: [dark(gc, 0.6), NEB_BASE[seed % 4], NEB_BASE[(seed >>> 3) % 4], mix(gc, '#3b1d86', 0.55)], cyc: -1, lastK: [-1, -1, -1, -1] };
  }
  function ensureFx(s) { if (!s.fxs) s.fxs = makeFx(); return s.fxs; }

  // ---- PLANET / STAR (colony, disaster, deep-space stories)
  function explodeChunks(s, pr) {
    const rnd = s.rnd, col = LOOK_COL[s.planet && s.planet.look] || '#8a7a6a', out = [];
    for (let i = 0; i < 30; i++) {
      const a = rnd() * TAU, sp = (0.45 + rnd() * 1.7) * pr, sz = pr * (0.05 + rnd() * 0.17), pts = [];
      for (let k = 0; k < 6; k++) pts.push(0.55 + rnd() * 0.6);
      out.push({ a: a, sp: sp, sz: sz, rot: rnd() * TAU, vr: (rnd() - 0.5) * 7, pts: pts, col: i % 3 === 0 ? lite(col, 0.25) : i % 3 === 1 ? col : dark(col, 0.45) });
    }
    return out;
  }
  function gPlanet(g, w, hh, t, lt, dt, s, S) {
    const fx = s.fx, it = s.item, star = s.star, kind = (star && star.kind) || 'yellow', scol = starCol(kind);
    const hero = !s.planet || fx === 'nova';
    if (hero) { gStarHero(g, w, hh, t, lt, dt, s, S, kind, scol); return; }
    const pr = min(hh * 0.37, w * 0.21), px = w * 0.62, py = hh * 0.55, sx = w * 0.08, sy = hh * 0.12, sr = hh * 0.17;
    glow(g, scol, sx, sy, hh * 1.2, 0.38);
    starSurface(g, kind, sx, sy, sr, t, S);
    const la = atan2(sy - py, sx - px);
    g.strokeStyle = rgba('#98a5cf', 0.2); g.lineWidth = 1; g.beginPath(); g.ellipse(px, py, pr * 1.6, pr * 0.5, -0.28, 0, TAU); g.stroke();
    const ma = t * 0.5, mx = px + cos(ma) * pr * 1.6 * cos(-0.28) - sin(ma) * pr * 0.5 * sin(-0.28), my = py + cos(ma) * pr * 1.6 * sin(-0.28) + sin(ma) * pr * 0.5 * cos(-0.28);
    const moon = () => { g.fillStyle = rgr(g, mx - pr * 0.03, my - pr * 0.03, 0, pr * 0.13, [0, '#e6e2dc', 1, '#6c6660']); g.beginPath(); g.arc(mx, my, pr * 0.1, 0, TAU); g.fill(); };
    if (sin(ma) < 0) moon();
    const desc = s.planet, opt = { lightAngle: la, spin: 0.012, dpr: S };
    let showPlanet = true, shx = 0, shy = 0, alpha = 1;
    if (fx === 'explode') {
      const per = 6.8, p = lt % per, cyc = floor(lt / per);
      if (!s.chunks) s.chunks = explodeChunks(s, pr);
      if (p < 2.3) { const k = sstep(0.4, 2.3, p); shx = sin(lt * 63) * pr * 0.02 * k; shy = cos(lt * 57) * pr * 0.02 * k; }
      if (p >= 2.3 && s.cyc !== cyc) { s.cyc = cyc; ensureFx(s).novaBlast(px, py, pr * 0.8); }
      if (p >= 2.3 && p < 5.7) showPlanet = false;
      if (p >= 5.7) alpha = sstep(5.7, 6.5, p);
      if (p < 2.3) { const k = sstep(1.0, 2.3, p); glow(g, '#ff8a40', px, py, pr * (1 + 0.4 * k), 0.5 * k); }
      if (showPlanet && alpha > 0.01) { g.save(); g.globalAlpha = alpha; drawPlanetSafe(g, desc, px + shx, py + shy, pr, t, opt); g.restore(); }
      if (p >= 2.3 && p < 6.1) {
        const q = p - 2.3, fade = 1 - sstep(3.4, 5.6, p);
        for (const c of s.chunks) {
          const d = c.sp * (1 - exp1(q * 0.5)) * 1.5, x = px + cos(c.a) * d, y = py + sin(c.a) * d * 0.85;
          g.save(); g.translate(x, y); g.rotate(c.rot + c.vr * q); g.globalAlpha = fade; g.fillStyle = c.col; g.beginPath();
          for (let k = 0; k < 6; k++) { const aa = k / 6 * TAU, rr = c.sz * c.pts[k]; if (k) g.lineTo(cos(aa) * rr, sin(aa) * rr); else g.moveTo(cos(aa) * rr, sin(aa) * rr); }
          g.closePath(); g.fill(); g.restore();
          glow(g, '#ff9a50', x, y, c.sz * 2.2, fade * 0.35 * (1 - sstep(0, 1.6, q)));
        }
        g.save(); g.globalCompositeOperation = 'lighter'; const rq = q / 1.4; if (rq < 1) { g.strokeStyle = rgba('#ffe0b0', (1 - rq) * 0.8); g.lineWidth = 3 * (1 - rq) + 1; g.beginPath(); g.arc(px, py, pr * (0.3 + rq * 2.6), 0, TAU); g.stroke(); } g.restore();
      }
    } else {
      drawPlanetSafe(g, desc, px, py, pr, t, opt);
    }
    if (sin(ma) >= 0 && showPlanet) moon();
    // story effects
    if (fx === 'land') {
      const per = 7, p = lt % per, tx = px + cos(-0.95) * pr * 0.9, ty = py + sin(-0.95) * pr * 0.9;
      if (p < 3.6) {
        const k = easeOut(p / 3.6), x = lerp(w * 1.04, tx, k), y = lerp(-hh * 0.08, ty, k) - sin(k * PI) * hh * 0.1, sz = lerp(hh * 0.15, hh * 0.05, k);
        glow(g, '#8fe0ff', x, y, sz * 1.1, 0.5 * (1 - k * 0.6));
        drawShipSafe(g, { race: it.race || 'human', hull: 'frigate', x: x, y: y, size: sz, angle: atan2(ty - y, tx - x) + 0.15, color: it.race ? raceColor(it.race) : '#d6b36a', t: t, thrust: 0.9, flags: { colony: true } });
      } else {
        const q = p - 3.6;
        for (let i = 0; i < 3; i++) { const u = fract(q / 1.5 + i / 3); g.strokeStyle = rgba('#5fdc8f', (1 - u) * 0.8); g.lineWidth = 1.2 + (1 - u) * 1.6; g.beginPath(); g.ellipse(tx, ty, pr * 0.55 * u + 2, pr * 0.28 * u + 1, -0.9, 0, TAU); g.stroke(); }
        glow(g, '#fff0b0', tx, ty, pr * 0.16, 0.55 + 0.35 * sin(t * 6));
      }
    } else if (fx === 'plague') {
      g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip(); g.fillStyle = 'rgba(120,225,80,' + (0.22 + 0.1 * sin(t * 2.4)) + ')'; g.fillRect(px - pr, py - pr, pr * 2, pr * 2); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 34; i++) { const q = fract(lt * 0.16 + i * 0.137), a = h2(i, 5) * TAU + sin(lt * 0.7 + i) * 0.4, d = pr * (0.9 + q * 0.9); glow(g, '#9bff6a', px + cos(a) * d, py + sin(a) * d, 2.5 + 3 * h2(i, 9), (1 - q) * 0.75); }
      g.restore();
      glow(g, '#7cff5a', px, py, pr * 1.3, 0.16 + 0.06 * sin(t * 2.4));
    } else if (fx === 'glitch') {
      const sl = 9;
      for (let i = 0; i < sl; i++) {
        if (h2(floor(t * 9), i + 3) < 0.55) continue;
        const y0 = py - pr + (i / sl) * pr * 2, off = (h2(floor(t * 9), i + 11) - 0.5) * pr * 0.45;
        g.save(); g.beginPath(); g.rect(px - pr * 1.1, y0, pr * 2.2, pr * 2 / sl); g.clip(); g.fillStyle = 'rgba(255,70,90,.22)'; g.fillRect(px - pr * 1.1, y0, pr * 2.2, pr * 2 / sl);
        g.globalAlpha = 0.6; drawPlanetSafe(g, desc, px + off, py, pr, t, opt); g.restore();
      }
      g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip(); g.fillStyle = 'rgba(255,40,70,.12)'; g.fillRect(px - pr, py - pr, pr * 2, pr * 2); g.restore();
      if (sin(t * 5) > -0.2) text(g, 'SIGNAL LOST', px, py + pr * 0.08, max(10, pr * 0.2), rgba('#ff5c6a', 0.95), 'center', FONT_D, 400, 2);
    } else if (fx === 'hunger') {
      g.save(); g.beginPath(); g.arc(px, py, pr, 0, TAU); g.clip(); g.fillStyle = 'rgba(120,60,10,.28)'; g.fillRect(px - pr, py - pr, pr * 2, pr * 2); g.restore();
      for (let i = 0; i < 3; i++) { const u = fract(lt / 1.8 + i / 3); g.strokeStyle = rgba('#ff9440', (1 - u) * 0.75); g.lineWidth = 1.5 + (1 - u) * 2; g.beginPath(); g.arc(px, py, pr * (1.02 + u * 0.5), 0, TAU); g.stroke(); }
    } else if (fx === 'sparkle') {
      glow(g, '#ffd54f', px, py, pr * 1.5, 0.12 + 0.05 * sin(t * 2));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const a = h2(i, 1) * TAU, d = pr * (0.7 + h2(i, 2) * 0.9), k = 0.5 + 0.5 * sin(t * (1.5 + h2(i, 3)) + i * 2), x = px + cos(a) * d, y = py + sin(a) * d, r = (2 + 4 * h2(i, 4)) * k;
        g.strokeStyle = rgba('#fff3c0', k); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - r * 2, y); g.lineTo(x + r * 2, y); g.moveTo(x, y - r * 2); g.lineTo(x, y + r * 2); g.stroke(); glow(g, '#ffd54f', x, y, r * 2.5, k * 0.6);
      }
      g.restore();
    } else if (fx === 'strike') {
      for (let i = 0; i < 4; i++) {
        const u = lt * 0.8 + i * 0.25, k = floor(u), ph = u - k, a = h2(k * 7 + i, 3) * TAU, d = pr * 0.8 * sqrt(h2(k * 5 + i, 9));
        const ix = px + cos(a) * d, iy = py + sin(a) * d * 0.9, fromX = lerp(w * 0.1, w * 0.45, h2(k, i + 20)), fromY = -hh * 0.1, e = ph * ph;
        if (ph < 0.9) {
          const hx = lerp(fromX, ix, e), hy = lerp(fromY, iy, e), e2 = max(0, e - 0.14), tx = lerp(fromX, ix, e2), ty = lerp(fromY, iy, e2);
          g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = lgr(g, tx, ty, hx, hy, [0, 'rgba(255,150,80,0)', 1, 'rgba(255,230,180,.95)']); g.lineWidth = 2.2; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke(); g.restore();
          glow(g, '#ffd9a0', hx, hy, 5, 0.9);
        } else { const q = (ph - 0.9) / 0.1; glow(g, '#ff9a50', ix, iy, pr * (0.1 + 0.3 * q), (1 - q * 0.6)); if (s.lastK[i] !== k) { s.lastK[i] = k; ensureFx(s).planetImpact(ix, iy, pr * 0.35); } }
      }
    }
    if (s.fxs) { s.fxs.update(dt); s.fxs.draw(g); }
  }
  const exp1 = x => Math.exp(-x);
  // star as the hero (novae, deep-space events, stories about a system rather than a world)
  function gStarHero(g, w, hh, t, lt, dt, s, S, kind, scol) {
    const cx = w * 0.56, cy = hh * 0.52, r0 = min(hh * 0.27, w * 0.15);
    if (s.fx === 'nova') {
      const per = 7.6, p = lt % per, cyc = floor(lt / per);
      if (p >= 2.9 && s.cyc !== cyc) { s.cyc = cyc; ensureFx(s).novaBlast(cx, cy, r0 * 1.1); }
      const swell = sstep(0, 2.9, p);
      if (p < 6.4) {
        const gone = p >= 2.9;
        if (!gone) {
          glow(g, '#fff0c8', cx, cy, r0 * (3 + swell * 2.4), 0.25 + 0.5 * swell);
          starSurface(g, kind, cx + sin(lt * 70) * swell * 2, cy + cos(lt * 83) * swell * 2, r0 * (1 + 0.32 * swell), t, S);
          g.fillStyle = rgba('#ffffff', 0.55 * swell * swell); g.beginPath(); g.arc(cx, cy, r0 * (1 + 0.32 * swell), 0, TAU); g.fill();
        } else {
          const q = p - 2.9, ring = q / 3.4;
          g.save(); g.globalCompositeOperation = 'lighter';
          if (ring < 1) {
            g.strokeStyle = rgba('#ffe9b0', (1 - ring) * 0.85); g.lineWidth = 2 + 10 * (1 - ring); g.beginPath(); g.arc(cx, cy, r0 * 0.5 + ring * w * 0.55, 0, TAU); g.stroke();
            g.strokeStyle = rgba(scol, (1 - ring) * 0.5); g.lineWidth = 1.5 + 4 * (1 - ring); g.beginPath(); g.arc(cx, cy, r0 * 0.3 + ring * w * 0.42, 0, TAU); g.stroke();
          }
          glow(g, '#ffd9a0', cx, cy, r0 * (1.4 + 3 * easeOut(q / 2)), 0.7 * (1 - sstep(0.4, 3.2, q)));
          for (let i = 0; i < 40; i++) { const a = h2(i, 4) * TAU, v = (0.5 + h2(i, 7) * 1.2) * w * 0.28, d = v * easeOut(q / 3.2) + r0 * 0.4; glow(g, '#ffcf8a', cx + cos(a) * d, cy + sin(a) * d * 0.8, 2 + 4 * h2(i, 8), (1 - q / 3.5) * 0.7); }
          g.restore();
          const rem = sstep(1.8, 3.5, q); if (rem > 0) glow(g, '#ff7a40', cx, cy, r0 * 0.5, 0.45 * rem * (0.7 + 0.3 * sin(t * 6)));
        }
      } else {
        const k = sstep(6.4, 7.4, p); g.save(); g.globalAlpha = k; glow(g, scol, cx, cy, r0 * 3, 0.4); starSurface(g, kind, cx, cy, r0, t, S); g.restore();
      }
      if (p >= 2.9 && p < 3.5) { g.fillStyle = 'rgba(255,248,230,' + (0.85 * (1 - (p - 2.9) / 0.6)) + ')'; g.fillRect(0, 0, w, hh); }
    } else {
      glow(g, scol, cx, cy, r0 * 4.2, 0.4);
      starSurface(g, kind, cx, cy, r0 * (1 + 0.02 * sin(t * 0.8)), t, S);
      // orbiting survey marks
      for (let i = 0; i < 3; i++) {
        const rr = r0 * (1.9 + i * 0.75), a = t * (0.35 - i * 0.07) + i * 2.1;
        g.strokeStyle = rgba('#98a5cf', 0.18); g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.34, -0.2, 0, TAU); g.stroke();
        const ox = cx + cos(a) * rr * cos(-0.2) - sin(a) * rr * 0.34 * sin(-0.2), oy = cy + cos(a) * rr * sin(-0.2) + sin(a) * rr * 0.34 * cos(-0.2);
        g.fillStyle = rgba('#dff1ff', 0.9); g.beginPath(); g.arc(ox, oy, 2 + i * 0.6, 0, TAU); g.fill();
      }
    }
    if (s.fxs) { s.fxs.update(dt); s.fxs.draw(g); }
  }

  // ---- BATTLE
  function initBattle(s) {
    const rnd = s.rnd, it = s.item, loserLeft = ['battleLost', 'fleetDestroyed', 'antaranRaid', 'piracy', 'monsterAttack'].indexOf(it.cat) >= 0;
    s.loser = it.cat === 'battleWon' || it.cat === 'invasionRepelled' ? 1 : loserLeft ? -1 : (rnd() < 0.5 ? -1 : 1);
    const col1 = it.race ? raceColor(it.race) : '#62d8ff', col2 = it.race2 ? raceColor(it.race2) : '#ff5c6a';
    s.fleet = [];
    for (const side of [-1, 1]) {
      const n = 4 + ((rnd() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const cap = i === 0;
        s.fleet.push({ side: side, nx: side < 0 ? 0.1 + rnd() * 0.18 : 0.72 + rnd() * 0.18, ny: 0.2 + 0.6 * (i + 0.5) / n + (rnd() - 0.5) * 0.05, len: cap ? 0.27 : 0.14 + rnd() * 0.06,
          hull: cap ? 'battleship' : (i % 2 ? 'cruiser' : 'destroyer'), ph: rnd() * TAU, race: side < 0 ? it.race : it.race2, col: side < 0 ? col1 : col2 });
      }
    }
  }
  function shipAt(f, t, w, hh) {
    const u = min(w, hh * 1.7), len = f.len * u;
    return { x: f.nx * w + sin(t * 0.5 + f.ph) * w * 0.008 + f.side * -1 * 0, y: f.ny * hh + sin(t * 0.7 + f.ph * 1.3) * hh * 0.012, len: len };
  }
  function gBattle(g, w, hh, t, lt, dt, s, S) {
    if (!s.fleet) initBattle(s);
    const it = s.item, fx = ensureFx(s);
    // a planet or star glow gives the fight a place
    if (it.planet) { const r = hh * 0.6; drawPlanetSafe(g, it.planet, w * 0.5, hh * 1.16, r, t, { lightAngle: -1.4, spin: 0.008, dpr: S }); }
    else glow(g, starCol((s.star && s.star.kind) || 'yellow'), w * 0.5, -hh * 0.1, hh * 0.9, 0.22);
    const order = s.fleet.slice().sort((a, b) => a.ny - b.ny);
    for (const f of order) {
      const p = shipAt(f, t, w, hh);
      drawShipSafe(g, { race: f.race, hull: f.hull, x: p.x, y: p.y, size: p.len / (HULL_LEN[f.hull] || 1), angle: f.side < 0 ? 0 : PI, color: f.col, t: t, thrust: 0.75, seed: f.ph });
    }
    // volleys
    while (lt >= s.next) {
      s.next += 0.2 + s.rnd() * 0.42;
      const fromSide = s.rnd() < (s.loser < 0 ? 0.62 : 0.38) ? 1 : -1;       // the winner shoots more
      const sh = s.fleet.filter(f => f.side === fromSide), tg = s.fleet.filter(f => f.side !== fromSide);
      const a = sh[(s.rnd() * sh.length) | 0], b = tg[(s.rnd() * tg.length) | 0], pa = shipAt(a, t, w, hh), pb = shipAt(b, t, w, hh);
      const kind = s.rnd() < 0.7 ? (fromSide < 0 ? 'laser' : 'phasor') : 'neutron';
      fx.beam(pa.x - fromSide * pa.len * 0.45, pa.y, pb.x + fromSide * pb.len * 0.42, pb.y, kind, 0.3, { color: a.col, scale: clamp(w / 520, 0.6, 1.5) });
      const hitLoser = b.side === s.loser;
      s.pend.push({ at: lt + 0.26, x: pb.x, y: pb.y, big: hitLoser && s.rnd() < 0.33 });
    }
    for (let i = s.pend.length - 1; i >= 0; i--) {
      const p = s.pend[i];
      if (lt >= p.at) { fx.explosion(p.x, p.y, (p.big ? 34 : 14) * clamp(w / 520, 0.6, 1.4), { kind: 'fire' }); s.pend.splice(i, 1); }
    }
    fx.update(dt); fx.draw(g);
  }

  // ---- MAP (mini star chart with a pulsing marker; slow push-in)
  function initMap(s) {
    const rnd = s.rnd, it = s.item, name = (s.star && s.star.name) || it.headline;
    const mx = 0.34 + 0.32 * h2(hashStr(name), 1), my = 0.32 + 0.36 * h2(hashStr(name), 2);
    s.mark = { x: mx, y: my };
    s.pts = [{ x: mx, y: my, k: 5, sz: 2 }];
    for (let i = 0; i < 74; i++) s.pts.push({ x: -0.05 + rnd() * 1.1, y: -0.05 + rnd() * 1.1, k: (rnd() * 6) | 0, sz: 0.7 + rnd() * 1.3 });
    s.lanes = [];
    for (let i = 0; i < s.pts.length && s.lanes.length < 140; i++) for (let j = i + 1; j < s.pts.length; j++) { const dx = s.pts[i].x - s.pts[j].x, dy = (s.pts[i].y - s.pts[j].y) * 0.55; if (dx * dx + dy * dy < 0.011) s.lanes.push([i, j]); }
    s.terr = [];
    const c1 = it.race ? raceColor(it.race) : empHex(0), c2 = it.race2 ? raceColor(it.race2) : empHex(3);
    s.terr.push({ x: mx - 0.2 - rnd() * 0.08, y: my + (rnd() - 0.5) * 0.3, r: 0.26, col: c1 });
    s.terr.push({ x: mx + 0.2 + rnd() * 0.08, y: my + (rnd() - 0.5) * 0.3, r: 0.26, col: c2 });
    s.terr.push({ x: 0.5 + (rnd() - 0.5) * 0.7, y: 0.5 + (rnd() - 0.5) * 0.6, r: 0.18, col: empHex((rnd() * 6) | 0) });
  }
  function gMap(g, w, hh, t, lt, dt, s, S) {
    if (!s.pts) initMap(s);
    const it = s.item, mk = s.mark, k = easeOut(lt / 7), z = 1 + 0.5 * k, alarm = s.fx === 'alarm';
    g.save();
    g.translate(w * mk.x, hh * mk.y); g.scale(z, z); g.translate(-w * mk.x, -hh * mk.y);
    // chart grid
    g.strokeStyle = rgba('#62d8ff', 0.07); g.lineWidth = 1; g.beginPath();
    for (let i = -2; i <= 12; i++) { const x = w * i / 10; g.moveTo(x, -hh * 0.5); g.lineTo(x, hh * 1.5); }
    for (let i = -2; i <= 12; i++) { const y = hh * i / 6; g.moveTo(-w * 0.5, y); g.lineTo(w * 1.5, y); }
    g.stroke();
    for (const T of s.terr) glow(g, T.col, T.x * w, T.y * hh, T.r * w, 0.22 + 0.05 * sin(t * 0.8 + T.x * 9));
    g.strokeStyle = rgba('#98a5cf', 0.2); g.lineWidth = 1; g.beginPath();
    for (const L of s.lanes) { const a = s.pts[L[0]], b = s.pts[L[1]]; g.moveTo(a.x * w, a.y * hh); g.lineTo(b.x * w, b.y * hh); }
    g.stroke();
    const cols = [empHex(0), empHex(1), empHex(2), empHex(3), empHex(4), empHex(5)];
    for (let i = 0; i < s.pts.length; i++) {
      const p = s.pts[i], tw = 0.55 + 0.45 * sin(t * 1.6 + i * 1.7), r = p.sz * (0.8 + 0.2 * tw);
      g.fillStyle = i % 4 === 0 ? cols[p.k] : rgba('#dbe8ff', 0.5 + 0.4 * tw);
      g.fillRect(p.x * w - r, p.y * hh - r, r * 2, r * 2);
    }
    // marker
    const x = mk.x * w, y = mk.y * hh, col = alarm ? '#ff5c6a' : cssHex(GROUPS[it.grp].css);
    for (let i = 0; i < 3; i++) { const u = fract(t * 0.5 + i / 3); g.strokeStyle = rgba(col, (1 - u) * 0.9); g.lineWidth = 2 * (1 - u) + 0.8; g.beginPath(); g.arc(x, y, 7 + u * hh * 0.17, 0, TAU); g.stroke(); }
    glow(g, col, x, y, hh * 0.1, 0.55 + 0.25 * sin(t * 5));
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    g.strokeStyle = col; g.lineWidth = 1.5; const b = 9 + 1.5 * sin(t * 5), q = 5;
    g.beginPath(); g.moveTo(x - b, y - b + q); g.lineTo(x - b, y - b); g.lineTo(x - b + q, y - b); g.moveTo(x + b - q, y - b); g.lineTo(x + b, y - b); g.lineTo(x + b, y - b + q);
    g.moveTo(x + b, y + b - q); g.lineTo(x + b, y + b); g.lineTo(x + b - q, y + b); g.moveTo(x - b + q, y + b); g.lineTo(x - b, y + b); g.lineTo(x - b, y + b - q); g.stroke();
    g.restore();
    // callout (not scaled)
    const sx = w * mk.x + (w * mk.x - w * mk.x) * z, sy = hh * mk.y;
    const lbl = String((s.star && s.star.name) || (it.race && raceName(it.race)) || GROUPS[it.grp].label).toUpperCase();
    const flip = sx > w * 0.6, lx = sx + (flip ? -1 : 1) * w * 0.07, ly = sy - hh * 0.2, ex = lx + (flip ? -1 : 1) * min(w * 0.2, 150);
    const reveal = easeOut((lt - 0.4) / 0.6);
    g.strokeStyle = rgba(col, 0.9 * reveal); g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx + (flip ? -1 : 1) * 12, sy - 10); g.lineTo(lx, ly); g.lineTo(lx + (ex - lx) * reveal, ly); g.stroke();
    g.globalAlpha = reveal;
    text(g, lbl, flip ? ex : lx + 4, ly - 6, max(11, hh * 0.058), '#fff5dd', flip ? 'right' : 'left', FONT_D, 400, 1.5);
    text(g, (alarm ? 'HOSTILITIES' : 'SECTOR ' + (10 + (s.seed % 80)) + '-' + (10 + ((s.seed >> 7) % 80))), flip ? ex : lx + 4, ly + hh * 0.07, max(9, hh * 0.04), rgba(col, 0.95), flip ? 'right' : 'left', FONT_U, 600, 2);
    g.globalAlpha = 1;
  }

  // ---- CHART (animated bars + trend line)
  function initChart(s) {
    const rnd = s.rnd, it = s.item, n = 6, bars = [], used = {};
    const want = [it.race, it.race2].filter(Boolean);
    const pool = raceIds().filter(r => want.indexOf(r) < 0);
    for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    const races = want.concat(pool).slice(0, n);
    for (let i = 0; i < n; i++) {
      const hi = i < want.length;
      bars.push({ race: races[i], v: hi ? 0.62 + rnd() * 0.34 : 0.2 + rnd() * 0.5, hl: hi, col: raceColor(races[i]) });
    }
    bars.sort((a, b) => b.v - a.v); void used;
    s.bars = bars;
    s.title = { science: 'RESEARCH INDEX', economy: 'OUTPUT INDEX', council: 'COUNCIL VOTE TALLY' }[it.grp] || 'TREND';
  }
  function gChart(g, w, hh, t, lt, dt, s, S) {
    if (!s.bars) initChart(s);
    const gc = cssHex(GROUPS[s.item.grp].css), px = w * 0.1, pw = w * 0.82, py = hh * 0.25, ph = hh * 0.44, n = s.bars.length, bw = pw / n;
    g.fillStyle = 'rgba(3,6,22,.55)'; g.fillRect(0, 0, w, hh);
    text(g, s.title, w * 0.5, hh * 0.17, max(11, hh * 0.058), rgba(gc, 0.95), 'center', FONT_D, 400, 3);
    g.strokeStyle = rgba('#98a5cf', 0.16); g.lineWidth = 1; g.beginPath();
    for (let i = 0; i <= 4; i++) { const y = py + ph * i / 4; g.moveTo(px, y); g.lineTo(px + pw, y); }
    g.stroke();
    const pts = [];
    for (let i = 0; i < n; i++) {
      const b = s.bars[i], k = easeOut((lt - 0.15 - i * 0.12) / 0.9), v = b.v * k, bh = ph * v, bx = px + i * bw + bw * 0.17, bwid = bw * 0.66, by = py + ph - bh;
      g.fillStyle = lgr(g, 0, by, 0, py + ph, [0, b.col, 1, dark(b.col, 0.62)]); g.globalAlpha = b.hl ? 1 : 0.62; g.fillRect(bx, by, bwid, bh); g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(bx, by, bwid, 2);
      if (b.hl && k > 0.2) glow(g, b.col, bx + bwid / 2, by, bwid * 1.2, 0.45 * k * (0.75 + 0.25 * sin(t * 4)));
      text(g, (b.race ? raceName(b.race) : '').slice(0, 3).toUpperCase(), bx + bwid / 2, py + ph + hh * 0.065, max(9, hh * 0.045), b.hl ? '#fff5dd' : '#98a5cf', 'center', FONT_D, 400, 1);
      if (k > 0.3) text(g, String(round(b.v * 100 * k)), bx + bwid / 2, by - 6, max(9, hh * 0.05), '#ece6d3', 'center', FONT_U, 600);
      pts.push(bx + bwid / 2, by - hh * 0.035);
    }
    const draw = easeOut((lt - 0.5) / 1.6), nd = max(2, floor(draw * n * 2));
    g.strokeStyle = rgba(gc, 0.95); g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < nd && i < pts.length / 2; i++) { if (i) g.lineTo(pts[2 * i], pts[2 * i + 1]); else g.moveTo(pts[0], pts[1]); }
    g.stroke();
    const hd = min(pts.length / 2 - 1, nd - 1); if (hd >= 0) glow(g, gc, pts[2 * hd], pts[2 * hd + 1], hh * 0.05, 0.9);
  }

  // ---- WIRE (news feed / redacted dossier)
  function gWire(g, w, hh, t, lt, dt, s, S, lines) {
    const gc = cssHex(GROUPS[s.item.grp].css), redact = s.fx === 'redact', rowH = hh * 0.095, top = hh * 0.2, n = ceil((hh * 0.8) / rowH) + 1;
    g.fillStyle = 'rgba(3,6,22,.6)'; g.fillRect(0, 0, w, hh);
    text(g, redact ? 'CLASSIFIED DOSSIER' : 'GNN WIRE - LIVE FEED', w * 0.05, hh * 0.15, max(11, hh * 0.058), rgba(gc, 0.95), 'left', FONT_D, 400, 3);
    g.strokeStyle = rgba(gc, 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(w * 0.05, hh * 0.175); g.lineTo(w * 0.95, hh * 0.175); g.stroke();
    const sc = (t * rowH * 0.45) % rowH, base = floor(t * 0.45);
    g.save(); g.beginPath(); g.rect(0, hh * 0.19, w, hh * 0.78); g.clip();
    for (let i = -1; i < n; i++) {
      const idx = base + i, y = top + i * rowH - sc + rowH * 0.7, a = clamp(min((y - top) / rowH + 0.4, (hh * 0.97 - y) / rowH + 0.3), 0, 1);
      const ln = lines.length ? lines[((idx % lines.length) + lines.length) % lines.length] : '';
      g.globalAlpha = a;
      text(g, String(1000 + ((idx * 37) % 9000)), w * 0.05, y, max(9, hh * 0.05), rgba('#62d8ff', 0.8), 'left', FONT_U, 600);
      if (redact) {
        let x = w * 0.15; const R = rng32(hashStr(ln) + idx);
        while (x < w * 0.92) { const ww = w * (0.04 + R() * 0.12); g.fillStyle = R() < 0.55 ? '#05081c' : rgba('#98a5cf', 0.35); g.fillRect(x, y - hh * 0.045, ww, hh * 0.055); x += ww + w * 0.015; }
      } else {
        let L = ln; const maxW = w * 0.78, fs = max(10, hh * 0.052);
        g.font = '500 ' + fs + 'px ' + FONT_U; while (L.length > 4 && g.measureText(L).width > maxW) L = L.slice(0, -2);
        text(g, L === ln ? L : L.trim() + '...', w * 0.15, y, fs, '#dfe6ff', 'left', FONT_U, 500);
      }
    }
    g.restore(); g.globalAlpha = 1;
    if (redact) {
      g.save(); g.translate(w * 0.62, hh * 0.58); g.rotate(-0.2); const k = easeOut((lt - 0.6) / 0.35), sz = max(22, hh * 0.15) * (1 + (1 - k) * 0.6);
      g.globalAlpha = k; g.strokeStyle = rgba('#ff5c6a', 0.9); g.lineWidth = 4; g.strokeRect(-sz * 2.1, -sz * 0.62, sz * 4.2, sz * 1.1);
      text(g, 'CLASSIFIED', 0, sz * 0.22, sz, '#ff5c6a', 'center', FONT_D, 400, 4); g.restore();
    }
  }

  // ---- window dispatcher
  function drawGfx(g, w, hh, t, dt, s, S, lines) {
    const lt = t - s.t0;
    g.drawImage(gfxBg(w, hh, S, s.seed % 9973, s.pal), 0, 0, w, hh);
    switch (s.kind) {
      case 'planet': gPlanet(g, w, hh, t, lt, dt, s, S); break;
      case 'battle': gBattle(g, w, hh, t, lt, dt, s, S); break;
      case 'map': gMap(g, w, hh, t, lt, dt, s, S); break;
      case 'chart': gChart(g, w, hh, t, lt, dt, s, S); break;
      default: gWire(g, w, hh, t, lt, dt, s, S, lines);
    }
    // glass: faint scan lines + corner shade
    g.fillStyle = scanPattern(g); g.globalAlpha = 0.28; g.fillRect(0, 0, w, hh); g.globalAlpha = 1;
    g.fillStyle = rgr(g, w / 2, hh / 2, min(w, hh) * 0.55, hypot(w, hh) * 0.62, [0, 'rgba(2,3,12,0)', 1, 'rgba(2,3,12,.5)']); g.fillRect(0, 0, w, hh);
  }

  // ================================================================== typewriter
  function Typer(tEl, rEl, box) { this.t = tEl; this.r = rEl; this.box = box; this.full = ''; this.n = 0; this.acc = 0; this.cps = 0; this.wait = 0; this.state = 'done'; }
  Typer.prototype.set = function (text, cps, wait, armed) {
    this.full = text || ''; this.n = 0; this.acc = 0; this.cps = cps; this.wait = wait || 0;
    this.state = !this.full || cps <= 0 ? 'done' : (armed ? 'wait' : 'type');
    if (this.state === 'done') this.n = this.full.length;
    this.paint();
  };
  Typer.prototype.release = function () { if (this.state === 'wait') { this.state = 'type'; this.paint(); } };
  Typer.prototype.finish = function () { this.n = this.full.length; this.state = 'done'; this.paint(); };
  Typer.prototype.step = function (dt) {
    if (this.state !== 'type') return 0;
    if (this.wait > 0) { this.wait -= dt; return 0; }
    this.acc += dt * this.cps;
    const add = floor(this.acc);
    if (!add) return 0;
    this.acc -= add;
    const before = this.n;
    this.n = min(this.full.length, this.n + add);
    if (this.n >= this.full.length) this.state = 'done';
    this.paint();
    return this.n - before;
  };
  Typer.prototype.paint = function () { this.t.textContent = this.full.slice(0, this.n); this.r.textContent = this.full.slice(this.n); this.box.classList.toggle('typing', this.state === 'type'); };
  Object.defineProperty(Typer.prototype, 'busy', { get() { return this.state === 'type' || this.state === 'wait'; } });

  // ================================================================== DOM
  let _logoN = 0;
  function logoSvg(label) {
    const id = 'gnnlg' + (++_logoN), t = doc.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 120 ' + (label ? 152 : 120) + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<linearGradient id="' + id + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3b0"/><stop offset=".35" stop-color="#d6b36a"/><stop offset=".7" stop-color="#8a7040"/><stop offset="1" stop-color="#e0c27a"/></linearGradient>' +
      '<radialGradient id="' + id + 'b" cx=".36" cy=".32" r=".8"><stop offset="0" stop-color="#d8f0ff"/><stop offset=".3" stop-color="#5b9be0"/><stop offset=".68" stop-color="#1b3a8e"/><stop offset="1" stop-color="#071040"/></radialGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="60" cy="60" r="34"/></clipPath></defs>' +
      '<g transform="rotate(-20 60 60)"><path d="M5 60A55 17 0 0 1 115 60" fill="none" stroke="url(#' + id + 'a)" stroke-width="5"/></g>' +
      '<circle cx="60" cy="60" r="34" fill="url(#' + id + 'b)"/>' +
      '<g clip-path="url(#' + id + 'c)" fill="none" stroke="#e6f4ff" stroke-opacity=".38" stroke-width="1.1"><ellipse cx="60" cy="60" rx="9" ry="34"/><ellipse cx="60" cy="60" rx="20" ry="34"/><ellipse cx="60" cy="60" rx="29" ry="34"/>' +
      '<path d="M26 47Q60 53 94 47M26 60H94M26 73Q60 67 94 73"/><circle cx="82" cy="78" r="38" fill="#02061e" fill-opacity=".5" stroke="none"/></g>' +
      '<circle cx="60" cy="60" r="34" fill="none" stroke="url(#' + id + 'a)" stroke-width="2.4"/>' +
      '<g transform="rotate(-20 60 60)"><path d="M115 60A55 17 0 0 1 5 60" fill="none" stroke="url(#' + id + 'a)" stroke-width="5"/><path d="M115 60A55 17 0 0 1 5 60" fill="none" stroke="#fff7d8" stroke-opacity=".6" stroke-width="1"/>' +
      '<circle r="3.6" fill="#fff"><animateMotion dur="6s" repeatCount="indefinite" path="M5 60A55 17 0 1 1 115 60A55 17 0 1 1 5 60"/></circle></g>' +
      (label ? '<text x="60" y="140" text-anchor="middle" font-family="\'Marcellus SC\',\'Marcellus\',Georgia,serif" font-size="30" letter-spacing="6" fill="url(#' + id + 'a)">GNN</text>' : '') + '</svg>';
    return t.content.firstChild;
  }

  let root, stage, mon, monCv, monTag, monLive, monCapB, monCapS, monCapE, lt, ltBar, ltFlag, ltFlagTxt, ltKick, hlBox, hlT, hlR, subBox, subT, subR, ltBadges, srLive;
  let tk, tkWin, tkTrack, hud, pips, btnPause, btnArch, ttl, ttlYear, ttlMeta, rank, rkIco, rkTitle, rkSub, rkTabs, rkList, cutEl, cutP, cutE, flashEl, fadeEl;
  let R = null, curU = 12.8, layKey = '';

  function build(el) {
    stage = h('canvas.gnn-stage');
    monCv = h('canvas.gnn-mon-cv'); monTag = h('div.gnn-mon-tag.gnn-chf'); monLive = h('div.gnn-mon-live.gnn-chf');
    monCapB = h('b'); monCapS = h('span'); monCapE = h('em');
    mon = h('div.gnn-mon', monCv, monTag, monLive, h('div.gnn-mon-cap', h('div', monCapB, monCapS), monCapE));
    ltFlagTxt = h('span'); ltFlag = h('div.gnn-lt-flag', h('i'), ltFlagTxt);
    ltKick = h('div.gnn-lt-kick');
    hlT = h('span.t'); hlR = h('span.r'); hlBox = h('div.gnn-lt-hl', { 'aria-hidden': 'true' }, hlT, hlR);
    subT = h('span.t'); subR = h('span.r'); subBox = h('div.gnn-lt-sub', { 'aria-hidden': 'true' }, subT, subR);
    ltBadges = h('div.gnn-lt-badges');
    ltBar = h('div.gnn-lt-bar.gnn-chf', h('div.gnn-lt-logo', logoSvg(true)), h('div.gnn-lt-txt', ltKick, hlBox, subBox), ltBadges);
    lt = h('div.gnn-lt', ltFlag, ltBar);
    srLive = h('div.gnn-sr', { 'aria-live': 'polite', role: 'status' });
    tkTrack = h('div.gnn-tk-track'); tkWin = h('div.gnn-tk-win', tkTrack);
    tk = h('div.gnn-tk.gnn-chf', h('div.gnn-tk-tag', 'GNN Wire'), tkWin);
    rkIco = h('div'); rkTitle = h('h2'); rkSub = h('span'); rkTabs = h('div.gnn-rank-tabs'); rkList = h('div.gnn-rank-list');
    rank = h('div.gnn-rank', h('div.gnn-rank-fr.gnn-chf', h('div.gnn-rank-in.gnn-chf', h('div.gnn-rank-h', rkIco, h('div', rkTitle, rkSub), rkTabs), rkList)));
    ttlYear = h('div.gnn-title-year'); ttlMeta = h('div.gnn-title-meta');
    ttl = h('div.gnn-title', h('div.gnn-title-in', h('div.gnn-title-logo', logoSvg(false)), h('h1.gnn-title-name', 'Galactic News Network'), ttlYear, ttlMeta));
    pips = h('div.gnn-pips');
    btnArch = UI.button('Archive', () => openArchive(), { small: true, icon: 'list' });
    btnPause = UI.button('Pause', () => act('pause'), { small: true, icon: 'pause', kbd: 'P' });
    hud = h('div.gnn-hud', h('div.gnn-hint', h('b', 'Space'), ' next  ·  ', h('b', 'P'), ' pause  ·  ', h('b', 'Esc'), ' skip'),
      h('div.gnn-hud-r', pips, btnArch, btnPause, UI.button('Next', () => act('next'), { small: true, icon: 'right', kbd: 'Space' }), UI.button('Skip', () => act('skip'), { small: true, icon: 'nextturn', kbd: 'Esc' })));
    cutP = h('div.gnn-cut-p'); cutE = h('div.gnn-cut-e'); cutEl = h('div.gnn-cut', cutP, cutE);
    flashEl = h('div.gnn-flash'); fadeEl = h('div.gnn-fade');
    root = h('div.gnn', { tabindex: '-1', role: 'region', 'aria-label': 'Galactic News Network broadcast' },
      stage, h('div.gnn-shade'), mon, rank, lt, tk, hud, ttl, srLive, flashEl, cutEl, fadeEl);
    root.addEventListener('click', e => { if (e.target.closest && e.target.closest('.gnn-hud')) return; act('next'); });
    root.addEventListener('contextmenu', e => { e.preventDefault(); act('skip'); });
    el.appendChild(root);
    R = null;
  }

  // position every overlay from the studio's layout rects (and --u, the unit all sizes derive from)
  function applyLayout(L, w, hh) {
    const u = clamp(min(w / 100, hh / 56.25), 4, 40), W = L.wall, T = L.lowerThird, K = L.ticker, G = L.logo;
    const key = [w, hh, W.x, W.y, W.w, W.h, T.x, T.y, T.w, T.h, K.x, K.y, K.w, K.h, G.x, G.y, G.w, G.h].map(v => round(v)).join(',');
    if (key === layKey) return;
    layKey = key; curU = u;
    const px = v => v.toFixed(1) + 'px';
    root.style.setProperty('--u', u.toFixed(3) + 'px');
    mon.style.left = px(W.x); mon.style.top = px(W.y); mon.style.width = px(W.w); mon.style.height = px(W.h);
    mon.style.transformOrigin = px(w / 2 - W.x) + ' ' + px(hh / 2 - W.y);
    lt.style.left = px(T.x); lt.style.width = px(T.w); lt.style.bottom = px(hh - (T.y + T.h)); ltBar.style.minHeight = px(T.h);
    tk.style.left = px(K.x); tk.style.top = px(K.y); tk.style.width = px(K.w); tk.style.height = px(K.h);
    hud.style.left = px(K.x); hud.style.width = px(K.w); hud.style.top = px(K.y + K.h + hh * 0.004); hud.style.height = px(max(hh - (K.y + K.h) - hh * 0.006, 22));
    rank.style.left = px(W.x - w * 0.012); rank.style.top = px(hh * 0.118); rank.style.width = px(W.w + w * 0.032); rank.style.height = px(hh * 0.628);
    if (R && R.tkU && abs(R.tkU - u) > 0.4) buildTicker();
  }
  function layoutNow() {
    const w = root.clientWidth || window.innerWidth, hh = root.clientHeight || window.innerHeight;
    layKey = ''; applyLayout(R && R.L ? R.L : defaultRects(w, hh), w, hh);
  }

  // ---- ticker
  const FALLBACK_TICKERS = [
    'Freight convoys running ahead of schedule on the central lanes', 'Analysts predict a slow quarter for dust, the galaxy\'s most abundant commodity',
    'Cartographers\' guild sells updated star charts; the stars are, as ever, where they were', 'Solar flare watch: expect radio static and a mild rise in philosophy',
    'Border tariffs lowered on goods nobody wanted in the first place', 'Zero-G skyball: the home team floated the match away, and the crowd floated after it',
    'Scientists discover a new moon; the moon had been there the whole time', 'Customs reminds captains that contraband includes anything not declared',
  ];
  function tickerLines(intr) {
    const lines = Array.isArray(intr.ticker) ? intr.ticker.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) : [];
    const T = M.Data && M.Data.text, pool = (T && Array.isArray(T.tickers) && T.tickers.length ? T.tickers : FALLBACK_TICKERS).filter(s => lines.indexOf(s) < 0);
    const rnd = rng32(hashStr('tk' + (intr.year || 0) + ':' + (intr.turn || 0)));
    for (let i = pool.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const x = pool[i]; pool[i] = pool[j]; pool[j] = x; }
    for (let n = 0; lines.length < 8 && n < pool.length; n++) lines.push(pool[n]);
    return lines.slice(0, 16);
  }
  function buildTicker() {
    if (!R) return;
    UI.clear(tkTrack);
    R.tkU = curU;
    const lines = R.tkLines;
    tk.classList.toggle('static', !!R.rm);
    if (R.rm) { R.tkIdx = 0; R.tkT = 0; tkTrack.appendChild(h('span.gnn-tk-i', lines[0] || '')); return; }
    const seq = () => { const s = h('div.gnn-tk-seq'); lines.forEach(l => { s.appendChild(h('span.gnn-tk-i', l)); s.appendChild(h('i.gnn-tk-sep')); }); return s; };
    const probe = seq(); tkTrack.appendChild(probe);
    const unit = max(probe.getBoundingClientRect().width, 1), win = tkWin.clientWidth || 900, reps = max(1, ceil(win / unit));
    const group = h('div.gnn-tk-seq'); for (let i = 0; i < reps; i++) group.appendChild(seq());
    UI.clear(tkTrack); tkTrack.appendChild(group); tkTrack.appendChild(group.cloneNode(true));
    const gw = group.getBoundingClientRect().width || unit * reps;
    tkTrack.style.setProperty('--tk-w', gw.toFixed(1) + 'px');
    tkTrack.style.setProperty('--tk-dur', (gw / (curU * 6.2)).toFixed(2) + 's');
  }

  // ---- segments
  function quietItem(intr) {
    const T = M.Data && M.Data.text, fl = T && T.news && T.news.flavor;
    let head = 'A quiet year across the galaxy: no major developments reported.';
    if (Array.isArray(fl)) { const ok = fl.filter(s => s.indexOf('{') < 0); if (ok.length) head = ok[hashStr('q' + (intr.year || 0) + ':' + (intr.turn || 0)) % ok.length]; }
    return { cat: 'flavor', headline: head, sub: 'GNN will keep watching the skies.', graphic: 'ticker', importance: 0 };
  }
  function buildSegments(intr) {
    const segs = [{ kind: 'title' }];
    const hasRank = RANK_ORDER.some(k => intr.rankings && Array.isArray(intr.rankings[k]) && intr.rankings[k].length);
    const items = (Array.isArray(intr.items) ? intr.items : []).filter(it => it && it.headline && !(hasRank && it.cat === 'rankings')).map(normalizeItem);   // the ranking panels carry their own commentary
    items.map((it, i) => [it, i]).sort((a, b) => (b[0].importance - a[0].importance) || (a[1] - b[1])).forEach(p => segs.push({ kind: 'item', item: p[0] }));
    const rk = intr.rankings || {};
    RANK_ORDER.forEach(key => { const list = Array.isArray(rk[key]) ? rk[key].filter(e => e && isFinite(+e.value)) : []; if (list.length) segs.push({ kind: 'rank', key: key, list: list }); });
    if (segs.length === 1) segs.push({ kind: 'item', item: normalizeItem(quietItem(intr)) });
    return segs;
  }
  function pickAnchor(intr) {
    if (intr.anchorRace && RACE_IDS.concat(raceIds()).indexOf(intr.anchorRace) >= 0) return intr.anchorRace;
    const ready = raceIds().filter(portraitReady), pool = ready.length ? ready : raceIds();
    return pool[floor(Math.random() * pool.length)] || 'human';
  }

  const restart = el => { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); };
  function setTone(imp) { root.dataset.tone = imp >= 2 ? 'breaking' : imp === 1 ? 'top' : 'normal'; R.tone = root.dataset.tone; }
  function cps() { return R.rm || R.speed === 0 ? 0 : R.speed === 2 ? 78 : 44; }
  function setBadges(races, color) {
    UI.clear(ltBadges);
    races.filter(Boolean).slice(0, 2).forEach(r => ltBadges.appendChild(badge(r, round(curU * 5.6), color)));
  }
  function updatePips() {
    UI.clear(pips);
    const n = R.segs.length;
    if (n > 16) { pips.appendChild(doc.createTextNode((R.idx + 1) + ' / ' + n)); return; }
    for (let i = 0; i < n; i++) pips.appendChild(h('i.gnn-pip' + (i < R.idx ? '.done' : i === R.idx ? '.cur' : '')));
  }
  function iconNode(name, cls) { try { return UI.icon(name, cls); } catch (e) { return h('i'); } }

  function applyTitle() {
    root.dataset.mode = 'title'; root.dataset.tone = 'normal'; root.dataset.grp = 'life'; R.tone = 'normal';
    const y = R.intr.year;
    ttlYear.textContent = y !== undefined && y !== null ? 'Year ' + y : '';
    ttlMeta.textContent = R.intr.turn !== undefined && R.intr.turn !== null ? 'Turn ' + R.intr.turn : '';
    R.titleDur = [0.9, 2.7, 1.9][R.speed];
    R.mood = 'neutral'; R.gfx = null; R.rk = null;
    R.hl.set('', 0); R.sub.set('', 0);
    srLive.textContent = 'Galactic News Network' + (y !== undefined && y !== null ? ', year ' + y : '');
    sfx('news');
  }
  function applyItem(seg) {
    const it = seg.item, g = GROUPS[it.grp];
    root.dataset.mode = 'item'; root.dataset.grp = it.grp; setTone(it.importance);
    R.mood = it.importance >= 2 ? 'worried' : g.mood; R.rk = null;
    ltFlagTxt.textContent = it.importance >= 2 ? 'Breaking news' : 'Top story';
    UI.clear(ltKick);
    ltKick.appendChild(iconNode(g.icon)); ltKick.appendChild(h('span', g.label));
    const who = it.race2 && it.race ? raceName(it.race) + (it.grp === 'war' ? ' vs ' : ' & ') + raceName(it.race2) : it.race ? raceName(it.race) : '';
    const bits = [who, it.star && it.star.name].filter(Boolean);
    if (bits.length) ltKick.appendChild(h('b', '· ' + bits.join(' · ')));
    setBadges([it.race, it.race2], null);
    // graphics window captions
    UI.clear(monTag); monTag.appendChild(iconNode(g.icon)); monTag.appendChild(h('span', g.label));
    monLive.className = 'gnn-mon-live gnn-chf' + (it.importance >= 1 ? '' : ' feed'); UI.clear(monLive); monLive.appendChild(h('i')); monLive.appendChild(h('span', it.importance >= 1 ? 'Live' : 'Feed'));
    const star = it.star, pl = it.planet;
    if (star && star.name) { monCapB.textContent = star.name; monCapS.textContent = (STAR_TXT[star.kind] || 'Star') + (pl ? ' · ' + humanize(pl.look) + ' world' : ''); }
    else if (pl) { monCapB.textContent = humanize(pl.look) + ' world'; monCapS.textContent = pl.inhabited ? 'Inhabited' : 'Uninhabited'; }
    else if (it.race) { monCapB.textContent = raceName(it.race) + (it.race2 ? (it.grp === 'war' ? ' vs ' : ' & ') + raceName(it.race2) : ''); monCapS.textContent = humanize(it.cat); }
    else { monCapB.textContent = humanize(it.cat); monCapS.textContent = g.label; }
    monCapE.textContent = R.intr.year !== undefined ? 'GNN · ' + R.intr.year : 'GNN';
    // text
    const c = cps();
    R.hl.set(it.headline, c, 0.18); R.sub.set(it.sub, c * 1.7, 0.1, true);
    srLive.textContent = (it.importance >= 2 ? 'Breaking news. ' : '') + g.label + '. ' + it.headline + (it.sub ? '. ' + it.sub : '');
    R.gfx = makeGfx(it, R.t); R.curPlanet = it.planet;
    restart(lt); restart(mon);
    sfx('news'); if (it.importance >= 2) sfx('alert', 'news');
    R.shown++;
  }
  function rankComment(key, leader) {
    const T = M.Data && M.Data.text, arr = T && T.news && T.news.rankings && T.news.rankings[key], pl = racePlural(leader.race);
    if (Array.isArray(arr) && arr.length) return U.tpl(arr[hashStr(key + ':' + (R.intr.year || 0)) % arr.length], { race: pl });
    return pl + ' lead the galaxy in ' + RANK_META[key].title.toLowerCase() + '.';
  }
  function applyRank(seg) {
    const meta = RANK_META[seg.key], list = seg.list.slice().sort((a, b) => b.value - a.value).slice(0, 6);
    root.dataset.mode = 'rank'; root.dataset.grp = meta.cat; setTone(0); R.mood = 'pleased'; R.gfx = null;
    UI.clear(rkIco); rkIco.appendChild(iconNode(meta.icon)); rkTitle.textContent = meta.title; rkSub.textContent = meta.sub;
    UI.clear(rkTabs);
    RANK_ORDER.forEach(k => { if (R.segs.some(s => s.kind === 'rank' && s.key === k)) rkTabs.appendChild(h('span.gnn-rank-tab' + (k === seg.key ? '.on' : ''), { tip: RANK_META[k].title }, iconNode(RANK_META[k].icon))); });
    UI.clear(rkList);
    let pid = null; try { pid = R.intr.playerEmpire !== undefined ? R.intr.playerEmpire : (M.Game && M.Game.S ? M.Game.S.playerId : null); } catch (e) { pid = null; }
    const mx = max(1, list[0].value), rows = [], instant = R.rm || R.speed === 0;
    list.forEach((e, i) => {
      const col = toHex(e.color !== undefined && e.color !== null && e.color !== '' ? e.color : e.empire, '#98a5cf'), nm = e.name || raceName(e.race);
      const bar = h('i'), val = h('div.gnn-rk-val', '0', meta.unit ? h('small', meta.unit) : null), me = pid !== null && pid !== undefined && e.empire === pid;
      const showRace = e.name && e.race && e.name.toLowerCase().indexOf(raceName(e.race).toLowerCase()) < 0;
      const row = h('div.gnn-rk.in' + (i === 0 ? '.lead' : '') + (me ? '.me' : ''), { style: { '--c': col, '--i': i } },
        h('div.gnn-rk-n', String(i + 1)), badge(e.race, round(curU * 3.7), col),
        h('div.gnn-rk-main', h('div.gnn-rk-top', h('div.gnn-rk-name', nm, showRace ? h('em', raceName(e.race)) : null, i === 0 ? h('u', 'Leader') : null, me ? h('u', { style: { background: 'var(--cyan)' } }, 'You') : null), val), h('div.gnn-rk-bar', bar)));
      rkList.appendChild(row);
      rows.push({ bar: bar, val: val, frac: clamp(e.value / mx, 0, 1), value: e.value, delay: 0.25 + i * 0.14 });
    });
    R.rk = { rows: rows, t: instant ? 99 : 0, dur: 1.1, done: false };
    const lead = list[0], c = cps();
    UI.clear(ltKick); ltKick.appendChild(iconNode(meta.icon)); ltKick.appendChild(h('span', 'Rankings')); ltKick.appendChild(h('b', '· ' + meta.title));
    ltFlagTxt.textContent = '';
    const comment = rankComment(seg.key, lead);
    R.hl.set(comment, c, 0.3); R.sub.set('', 0);
    setBadges([lead.race], toHex(lead.color !== undefined && lead.color !== null && lead.color !== '' ? lead.color : lead.empire, null));
    srLive.textContent = 'Rankings, ' + meta.title + '. ' + comment;
    restart(lt); restart(rank);
    sfx('news');
    R.shown++;
  }
  function applySegment(i) {
    const seg = R.segs[i];
    R.idx = i; R.segT = 0; R.hold = 0; R.holdSet = false; R.wasTyping = false; R.talkTail = 0;
    if (seg.kind === 'title') applyTitle(); else if (seg.kind === 'item') applyItem(seg); else applyRank(seg);
    updatePips();
  }

  // ---- transitions
  function playWipe(toBreaking) {
    cutEl.classList.add('go');
    const d = 700;
    R.anims = [
      cutP.animate([
        { clipPath: 'inset(0 100% 0 0)', offset: 0, easing: 'cubic-bezier(.5,0,.9,.5)' }, { clipPath: 'inset(0 0% 0 0)', offset: 0.4 },
        { clipPath: 'inset(0 0% 0 0)', offset: 0.46, easing: 'cubic-bezier(.1,.5,.4,1)' }, { clipPath: 'inset(0 0 0 100%)', offset: 1 },
      ], { duration: d, fill: 'both' }),
      cutE.animate([
        { left: '0%', opacity: 1, offset: 0, easing: 'cubic-bezier(.5,0,.9,.5)' }, { left: '100%', opacity: 1, offset: 0.4 }, { left: '100%', opacity: 0, offset: 0.41 },
        { left: '0%', opacity: 0, offset: 0.45 }, { left: '0%', opacity: 1, offset: 0.46, easing: 'cubic-bezier(.1,.5,.4,1)' }, { left: '100%', opacity: 1, offset: 0.98 }, { left: '100%', opacity: 0, offset: 1 },
      ], { duration: d, fill: 'both' }),
    ];
    if (toBreaking) R.anims.push(flashEl.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.18 }, { opacity: 0 }], { duration: 520, delay: 300, fill: 'both' }));
  }
  function stopWipe() {
    if (R && R.anims) { R.anims.forEach(a => { try { a.cancel(); } catch (e) { /* already gone */ } }); R.anims = null; }
    cutEl.classList.remove('go');
  }
  function startCut(to) {
    R.phase = 'cut'; R.cut = { to: to, t: 0, swapped: false, dur: 0.72 };
    const seg = R.segs[to];
    playWipe(seg.kind === 'item' && seg.item.importance >= 2);
  }
  function endCut() { if (R.cut && !R.cut.swapped) applySegment(R.cut.to); R.cut = null; R.phase = 'play'; stopWipe(); }
  function stepCut(dt) {
    R.cut.t += dt;
    if (!R.cut.swapped && R.cut.t >= 0.3) { R.cut.swapped = true; applySegment(R.cut.to); }
    if (R.cut.t >= R.cut.dur) endCut();
  }

  // ---- navigation
  function isBusy() {
    const seg = R.segs[R.idx];
    if (!seg || seg.kind === 'title') return false;
    return R.hl.busy || R.sub.busy || !!(R.rk && !R.rk.done);
  }
  function fastForward() { R.hl.finish(); R.sub.finish(); if (R.rk) { R.rk.t = 99; stepRank(0); } R.holdSet = false; }
  function goTo(n) {
    if (n >= R.segs.length) { finish(false); return; }
    if (n < 1 || n === R.idx) return;
    if (R.speed === 0 || R.rm) { applySegment(n); return; }
    startCut(n);
  }
  function act(a) {
    if (!R || R.finishing) return;
    if (a === 'next') {
      if (R.phase === 'cut') { endCut(); fastForward(); return; }
      if (isBusy()) { fastForward(); return; }
      goTo(R.idx + 1);
    } else if (a === 'prev') {
      if (R.phase === 'cut') { endCut(); }
      goTo(R.idx - 1);
    } else if (a === 'skip') finish(true);
    else if (a === 'pause') { R.paused = !R.paused; syncPause(); }
  }
  function syncPause() {
    UI.clear(btnPause);
    btnPause.appendChild(iconNode(R.paused ? 'play' : 'pause')); btnPause.appendChild(doc.createTextNode(R.paused ? 'Resume' : 'Pause')); btnPause.appendChild(h('span.kbd', 'P'));
    btnPause.classList.toggle('active', !!R.paused);
    root.dataset.paused = R.paused ? '1' : '0';
  }
  function holdFor(seg) {
    const f = [0.8, 1, 0.7][R.speed];
    if (seg.kind === 'rank') return 3.6 * f;
    const it = seg.item, chars = it.headline.length + (it.sub ? it.sub.length * 0.5 : 0);
    return clamp(2.2 + chars * 0.02, 2.8, 3.5) * (it.importance >= 2 ? 1.12 : 1) * f;
  }
  function stepRank(dt) {
    const rk = R.rk;
    if (!rk || (rk.done && dt)) return;
    rk.t += dt;
    let all = true;
    for (const r of rk.rows) {
      const p = easeOut((rk.t - r.delay) / rk.dur);
      r.bar.style.transform = 'scaleX(' + (r.frac * p).toFixed(4) + ')';
      r.val.firstChild.nodeValue = U.fmt(r.value * p);
      if (p < 1) all = false;
    }
    if (all) rk.done = true;
  }
  function typeTick(n) {
    R.tickAcc = (R.tickAcc || 0) + n;
    if (R.tickAcc >= 3 && R.t - (R.lastTick || -1) > 0.07) { sfx('typing'); R.lastTick = R.t; R.tickAcc = 0; }
  }
  function stepSegment(dt) {
    const seg = R.segs[R.idx];
    if (!seg) return;
    R.segT += dt;
    if (UI.modalOpen && UI.modalOpen()) return;                              // overlays (game menu, archive) freeze the broadcast timeline
    if (seg.kind === 'title') { if (!R.paused && R.segT >= R.titleDur) goTo(R.idx + 1); return; }
    const added = R.hl.step(dt) + R.sub.step(dt);
    if (added) typeTick(added);
    if (!R.hl.busy) R.sub.release();
    if (R.rk) stepRank(dt);
    const typing = R.hl.busy || R.sub.busy;
    if (R.wasTyping && !typing) R.talkTail = 0.45;
    R.wasTyping = typing;
    if (R.talkTail > 0) R.talkTail -= dt;
    if (!isBusy()) {
      if (!R.holdSet) { R.holdSet = true; R.hold = holdFor(seg); }
      if (!R.paused) { R.hold -= dt; if (R.hold <= 0) goTo(R.idx + 1); }
    }
  }

  // ---- finishing
  function musicRestore(run) {
    if (!run.musicStarted) return;
    run.musicStarted = false;
    if (musicCur() !== 'gnn') return;
    if (run.prevTrack && run.prevTrack !== 'gnn') musicPlay(run.prevTrack, { fade: 1.4 }); else musicStop({ fade: 1.4 });
  }
  function finish(skipped) {
    if (!R || R.finishing) return;
    R.finishing = true; R.skipped = !!skipped; R.fadeT = 0; R.fadeDur = R.rm || R.speed === 0 ? 0.25 : 0.55;
    stopWipe(); R.cut = null; R.phase = 'play';
    root.classList.add('out');
  }
  function complete() {
    const run = R; R = null;
    run.leaving = true;
    musicRestore(run);
    const p = run.pending;
    try {
      if (p.prev && UI.Screens.has(p.prev)) UI.Screens.go(p.prev, p.prevParams || undefined);
      else if (p.demo && UI.Screens.has('menu')) UI.Screens.go('menu');
    } catch (e) { console.error('[gnn] could not return to the previous screen:', e); }
    p.resolve({ skipped: run.skipped, shown: run.shown });
  }

  // ---- per-frame
  function frame(dt) {
    if (!R) return;
    dt = min(dt, 0.1);
    R.t += dt; R.accDt += dt;
    if (R.finishing) { R.fadeT += dt; if (R.fadeT >= R.fadeDur + 0.05) { complete(); return; } }
    else if (R.phase === 'cut') stepCut(dt);
    else stepSegment(dt);
    if (!R) return;
    // rotating one ticker line at a time in reduced-motion mode
    if (R.rm && R.tkLines && R.tkLines.length > 1) {
      R.tkT += dt;
      if (R.tkT > 6) { R.tkT = 0; R.tkIdx = (R.tkIdx + 1) % R.tkLines.length; UI.clear(tkTrack); tkTrack.appendChild(h('span.gnn-tk-i', R.tkLines[R.tkIdx])); }
    }
    const fps = PQ().animFps || 60;
    if (fps < 59 && R.accDt < 1 / fps - 0.002) return;
    const gdt = R.accDt; R.accDt = 0;
    drawFrame(gdt);
  }
  function drawFrame(gdt) {
    const f = fit(stage, 1.5);
    if (!f) return;
    const g = f.ctx, w = f.w, hh = f.h, t = R.t, seg = R.segs[R.idx], talking = R.hl.busy || R.sub.busy || R.talkTail > 0;
    const o = { anchorRace: R.anchor, graphic: R.gfx ? R.gfx.kind : 'ticker', headline: '', ticker: '', cut: R.cut ? clamp(R.cut.t / R.cut.dur, 0, 1) : 0, talking: talking, mood: R.mood, t: t, color: '#d6b36a', newsPlanet: R.curPlanet };
    const res = paintBackdrop(g, w, hh, t, o, f.S), L = res.L, cam = res.cam;
    R.L = L;
    applyLayout(L, w, hh);
    mon.style.transform = 'translate(' + cam.dx.toFixed(2) + 'px,' + cam.dy.toFixed(2) + 'px) scale(' + cam.z.toFixed(4) + ')';
    // scene present but the anchor race has no painted portrait: stand in a robot at the anchor's spot
    if (res.scene && !portraitReady(R.anchor)) {
      g.save(); g.beginPath(); g.rect(0, 0, w, hh * 0.715); g.clip();
      g.translate(w / 2 + cam.dx, hh / 2 + cam.dy); g.scale(cam.z, cam.z); g.translate(-w / 2, -hh / 2);
      drawRobot(g, L.anchor.x, L.anchor.y, L.anchor.w, L.anchor.h, t, talking);
      g.restore();
    }
    if (R.tone === 'breaking') {
      const k = R.rm ? 0.5 : 0.5 + 0.5 * sin(t * 6.5);
      g.fillStyle = 'rgba(170,22,48,' + (0.1 + 0.07 * k).toFixed(3) + ')'; g.fillRect(0, 0, w, hh);
      if (!R.rm) { const s1 = max(0, sin(t * 5)), s2 = max(0, -sin(t * 5)); glow(g, '#ff3b4e', w * 0.04, hh * 0.08, hh * 0.45, 0.7 * s1); glow(g, '#ff3b4e', w * 0.96, hh * 0.08, hh * 0.45, 0.7 * s2); }
    }
    const tk0 = seg && seg.kind === 'title' && !R.cut && !R.finishing ? 1 : 0;
    R.titleK += (tk0 - R.titleK) * min(1, gdt * 5);
    titleFx(g, w, hh, t, R.titleK);
    if (R.gfx && root.dataset.mode === 'item') {
      const mf = fit(monCv, 2);
      if (mf) { try { drawGfx(mf.ctx, mf.w, mf.h, t, gdt, R.gfx, mf.S, R.tkLines); } catch (e) { if (!R.gfx.failed) { R.gfx.failed = true; console.error('[gnn] graphic failed:', e); } } }
    }
  }

  // ---- starting a broadcast
  function startRun(pend) {
    const intr = pend.intr || {};
    layKey = '';
    root.classList.remove('out');
    root.classList.toggle('rm', reduced());
    stopWipe();
    R = {
      pending: pend, intr: intr, segs: buildSegments(intr), idx: -1, t: 0, accDt: 0, segT: 0, phase: 'play', cut: null, paused: false, finishing: false, fadeT: 0, fadeDur: 0.5,
      speed: animSpeed(), rm: reduced(), anchor: pickAnchor(intr), mood: 'neutral', tone: 'normal', talkTail: 0, wasTyping: false, hold: 0, holdSet: false, titleDur: 2.5, titleK: 0,
      hl: new Typer(hlT, hlR, hlBox), sub: new Typer(subT, subR, subBox), gfx: null, rk: null, curPlanet: null, L: null, shown: 0, skipped: false, leaving: false,
      tkLines: tickerLines(intr), tkIdx: 0, tkT: 0, tkU: 0, anims: null, prevTrack: musicCur(), musicStarted: false,
    };
    R.rm = root.classList.contains('rm');
    btnArch.style.display = M.Game && M.Game.S && Array.isArray(M.Game.S.newsLog) ? '' : 'none';
    syncPause();
    layoutNow();
    buildTicker();
    applySegment(0);
    try { root.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
    musicPlay('gnn', { fade: 0.8 }); R.musicStarted = true;
  }

  // ================================================================== screen + public API
  function openArchive() {
    const S = M.Game && M.Game.S ? M.Game.S : null;
    return GNN.archive(S);
  }
  UI.Screens.register('gnn', {
    create(el) { build(el); },
    enter(params) {
      const pend = params && params._run;
      if (R && pend && R.pending === pend) return;                       // UI.Screens.refresh() while on air
      if (R) { const old = R; R = null; stopWipe(); musicRestore(old); old.pending.resolve({ skipped: true, shown: old.shown, interrupted: true }); }
      const p = pend || { intr: {}, prev: null, prevParams: null, resolve: () => {}, demo: true };
      try { startRun(p); } catch (e) {
        console.error('[gnn] broadcast failed to start:', e);
        R = null; musicRestore({ musicStarted: true, prevTrack: null });
        try { if (p.prev && UI.Screens.has(p.prev)) UI.Screens.go(p.prev, p.prevParams || undefined); } catch (e2) { console.error(e2); }
        p.resolve({ skipped: true, shown: 0, error: String(e && e.message || e) });
      }
    },
    leave() {
      if (R && !R.leaving) {                                              // somebody else navigated away mid-broadcast
        const run = R; R = null; stopWipe(); musicRestore(run);
        run.pending.resolve({ skipped: true, shown: run.shown, interrupted: true });
      }
    },
    update(dt) { frame(dt); },
    resize() { layKey = ''; if (R) R.accDt = 1; },
  });
  UI.bindKey('space', e => { if (!e || !e.repeat) act('next'); }, { screen: 'gnn' });
  UI.bindKey('enter', e => { if (!e || !e.repeat) act('next'); }, { screen: 'gnn' });
  UI.bindKey('arrowright', e => { if (!e || !e.repeat) act('next'); }, { screen: 'gnn' });
  UI.bindKey('arrowleft', e => { if (!e || !e.repeat) act('prev'); }, { screen: 'gnn' });
  UI.bindKey('p', e => { if (!e || !e.repeat) act('pause'); }, { screen: 'gnn' });
  UI.bindKey('escape', () => act('skip'), { screen: 'gnn' });

  let chain = Promise.resolve();
  GNN.show = function (intr) {
    const run = () => new Promise(resolve => {
      const cur = UI.Screens.current;
      const prev = cur && cur.id !== 'gnn' ? cur.id : null;
      UI.Screens.go('gnn', { _run: { intr: intr || {}, prev: prev, prevParams: prev ? cur.params : null, resolve: resolve, demo: false } });
    });
    const p = chain.then(run);
    chain = p.then(() => {}, () => {});
    return p;
  };
  GNN.isOnAir = () => !!R;
  GNN.skip = () => act('skip');
  GNN._jump = (n, ff) => { if (!R || R.finishing) return false; stopWipe(); R.cut = null; R.phase = 'play'; applySegment(clamp(n | 0, 0, R.segs.length - 1)); if (ff) fastForward(); return true; };
  GNN._state = () => (R ? { idx: R.idx, kind: R.segs[R.idx] && R.segs[R.idx].kind, segs: R.segs.length, phase: R.phase, busy: isBusy(), t: R.t, hold: R.hold, paused: R.paused, anchor: R.anchor, shown: R.shown, tone: R.tone, mode: root.dataset.mode } : null);

  // ================================================================== archive (S.newsLog = [{year, cat, headline, race, race2}])
  GNN.archive = function (state) {
    const PAGE = 120, log = state && Array.isArray(state.newsLog) ? state.newsLog : [];
    const all = log.map((e, i) => ({ i: i, year: e && e.year !== undefined && e.year !== null ? e.year : '?', cat: (e && e.cat) || 'flavor', headline: String((e && e.headline) || '').trim(),
      race: (e && e.race) || '', race2: (e && e.race2) || '', grp: groupOf(e && e.cat) })).filter(e => e.headline);
    const counts = {};
    all.forEach(e => { counts[e.grp] = (counts[e.grp] || 0) + 1; });
    const races = Array.from(new Set(all.reduce((a, e) => a.concat([e.race, e.race2]), []).filter(Boolean))).sort((a, b) => raceName(a).localeCompare(raceName(b)));
    const flt = { grp: 'all', race: 'all', q: '', limit: PAGE };
    const listEl = h('div.gnn-arch-list'), countEl = h('div.gnn-arch-count'), chips = h('div.gnn-arch-chips'), chipEls = {};
    const addChip = (id, label, n) => {
      const b = UI.button(label, () => { flt.grp = id; flt.limit = PAGE; sync(); }, { small: true });
      b.appendChild(h('span.n', String(n))); chipEls[id] = b; chips.appendChild(b);
    };
    addChip('all', 'All', all.length);
    GROUP_ORDER.forEach(g => { if (counts[g]) addChip(g, GROUPS[g].label, counts[g]); });
    const raceSel = h('select.field', { 'aria-label': 'Filter by race' }, h('option', { value: 'all' }, 'All races'), races.map(r => h('option', { value: r }, raceName(r))));
    raceSel.addEventListener('change', () => { flt.race = raceSel.value; flt.limit = PAGE; render(); });
    const search = h('input.field', { type: 'text', placeholder: 'Search headlines...', maxlength: 60, 'aria-label': 'Search headlines' });
    search.addEventListener('input', U.debounce(() => { flt.q = search.value.trim().toLowerCase(); flt.limit = PAGE; render(); }, 120));
    const row = e => {
      const g = GROUPS[e.grp];
      return h('div.gnn-arow', h('span.gnn-achip', { style: { '--c': cssHex(g.css) } }, iconNode(g.icon), humanize(e.cat)), h('span.gnn-ahl', e.headline),
        h('span', [e.race, e.race2].filter(Boolean).map(r => h('span.gnn-arace', { style: { '--c': raceColor(r) } }, h('i'), raceName(r)))));
    };
    function render() {
      const keep = listEl.scrollTop;
      const rows = all.filter(e => (flt.grp === 'all' || e.grp === flt.grp) && (flt.race === 'all' || e.race === flt.race || e.race2 === flt.race) && (!flt.q || e.headline.toLowerCase().indexOf(flt.q) >= 0));
      rows.sort((a, b) => ((+b.year || 0) - (+a.year || 0)) || (b.i - a.i));
      countEl.textContent = rows.length === all.length ? rows.length + (rows.length === 1 ? ' report' : ' reports') : rows.length + ' of ' + all.length + ' reports';
      UI.clear(listEl);
      if (!rows.length) { listEl.appendChild(h('div.gnn-arch-empty', all.length ? 'No reports match these filters.' : 'The archive is empty. News is recorded here as the years turn.')); return; }
      const perYear = {};
      rows.forEach(e => { perYear[e.year] = (perYear[e.year] || 0) + 1; });
      let shown = 0, curY = null;
      for (const e of rows) {
        if (shown >= flt.limit) break;
        if (e.year !== curY) { curY = e.year; listEl.appendChild(h('div.gnn-arch-y', 'Year ' + e.year, h('small', perYear[e.year] + (perYear[e.year] === 1 ? ' report' : ' reports')))); }
        listEl.appendChild(row(e)); shown++;
      }
      if (shown < rows.length) listEl.appendChild(h('div.gnn-arch-more', UI.button('Show older reports (' + (rows.length - shown) + ' more)', () => { flt.limit += PAGE; render(); }, { small: true })));
      listEl.scrollTop = keep;
    }
    function sync() { for (const k in chipEls) chipEls[k].classList.toggle('active', k === flt.grp); render(); }
    const body = h('div.gnn-arch', h('div.gnn-arch-bar', chips, raceSel, search, countEl), listEl);
    const pm = UI.modal({ title: 'GNN archive', body: body, buttons: [{ label: 'Close', value: true, primary: true }], cls: 'gnn-arch-modal', width: 'min(92vw, 60rem)' });
    sync();
    return pm;
  };
})(window.MOO);
