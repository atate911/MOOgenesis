// Research (Tech) screen and the scientist scenes (research/06 §5.12-5.13, research/02 §1).
//
//   screen 'tech'   params {from, field}    six field tabs (keys 1-6) + a tech-overview tab (7), the six research sliders (2% steps, lock by clicking
//                                           the name, '=' equalises), light-bulb breakthrough gauges, field levels, capability lines, the current
//                                           project with progress / ETA / "choose" button, the researched-tech list and a hologram picture pane.
//   MOO.UI.TechScenes.choose(interrupt)        -> Promise<level>  lab scene "Choose the area of research ..."  interrupt = {empire, field, choices:[{level,cost,tech}], manual?}
//   MOO.UI.TechScenes.breakthrough(interrupt)  -> Promise<void>   lab scene "<Race> scientists achieve a <Field> breakthrough"
//                                                                 interrupt = {empire, field, level, id, source:'research'|'spy'|'loot'|'trade'|'orion'}
//   MOO.UI.TechScenes.followUp(tech)           -> Promise<bool>   the optional "adjust colony spending?" dialogs (0 / 25 / 50 / 75 %)
//   MOO.UI.TechArt.draw(ctx, w, h, t, tech, o)                    procedural hologram / blueprint of any tech record (also used by techtree.js)
//   MOO.UI.Tech = {open(params)}   MOO.UI.TechInfo = {capability, effectLines, forecast, partLines, FIELDS}   (shared helpers for techtree.js)
// Reads the sim through Sim.Research / Sim.Q / Data.Techs; every change goes through Game.order (researchSlider/Lock/Equalize/Set/Pick).
// Soft dependencies (all guarded): Gfx.Scenes.lab, Gfx.Portraits, Gfx.Ships, Gfx.Planets, Gfx.Icons, Audio.Music/SFX, Settings.reduceMotion, Perf.
(function (M) {
  'use strict';
  const UI = M.UI, U = M.Util, h = UI.h, G = M.Game, doc = document;
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, min = Math.min, max = Math.max, floor = Math.floor, round = Math.round, abs = Math.abs, sqrt = Math.sqrt;
  const clamp = U.clamp, fmt = U.fmt;

  // ================================================================== soft dependencies
  const RS = () => M.Sim.Research, TD = () => M.Data.Techs;
  const setting = (k, d) => { try { const v = M.Settings && M.Settings.get ? M.Settings.get(k) : undefined; return v === undefined ? d : v; } catch (e) { return d; } };
  const reduced = () => !!setting('reduceMotion', false) || !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const PQ = () => (M.Perf && M.Perf.q) || { dpr: 1.5, animFps: 60 };
  const Mu = () => (M.Audio && M.Audio.Music) || null;
  const musicPlay = (id, o) => { try { const m = Mu(); if (m && m.play) return m.play(id, o); } catch (e) { /* audio is optional */ } return null; };
  const musicStop = o => { try { const m = Mu(); if (m && m.stop) m.stop(o); } catch (e) { /* audio is optional */ } };
  const musicCur = () => { try { const m = Mu(); return m && m.current ? m.current() : null; } catch (e) { return null; } };
  const musicSnap = () => { try { const m = Mu(); return m && m.snapshot ? m.snapshot() : null; } catch (e) { return null; } };
  const bannerCss = E => { try { return getComputedStyle(doc.documentElement).getPropertyValue('--emp' + (E ? E.color : 0)).trim() || '#4a90e8'; } catch (e) { return '#4a90e8'; } };

  // ================================================================== field + type metadata
  const FIELDS = [
    { id: 0, key: 'computers', icon: 'computers', name: 'Computers', col: '#62d8ff', lab: 'computers' },
    { id: 1, key: 'construction', icon: 'construction', name: 'Construction', col: '#ffb04a', lab: 'construction' },
    { id: 2, key: 'forcefields', icon: 'forcefield', name: 'Force Fields', col: '#a98bff', lab: 'forcefield' },
    { id: 3, key: 'planetology', icon: 'planetology', name: 'Planetology', col: '#5fdc8f', lab: 'planetology' },
    { id: 4, key: 'propulsion', icon: 'propulsion', name: 'Propulsion', col: '#5b8cff', lab: 'propulsion' },
    { id: 5, key: 'weapons', icon: 'weapons', name: 'Weapons', col: '#ff7a86', lab: 'weapons' },
  ];
  const TYPES = {
    computer: { ico: 'computers', label: 'Battle computer' }, ecm: { ico: 'ecm', label: 'ECM jammer' }, scanner: { ico: 'range', label: 'Scanner' },
    industry: { ico: 'industry', label: 'Industry' }, special: { ico: 'special', label: 'Ship system' }, armor: { ico: 'armor', label: 'Armor' },
    waste: { ico: 'waste', label: 'Waste control' }, ground: { ico: 'troops', label: 'Ground combat' }, shield: { ico: 'shield', label: 'Deflector shield' },
    planetary: { ico: 'defense', label: 'Planetary' }, eco: { ico: 'ecology', label: 'Ecology' }, terraform: { ico: 'terraform', label: 'Terraforming' },
    environment: { ico: 'planet', label: 'Environment' }, bio: { ico: 'skull', label: 'Bio weapon' }, growth: { ico: 'pop', label: 'Growth' },
    defense: { ico: 'repair', label: 'Bio defence' }, engine: { ico: 'engine', label: 'Engine' }, fuel: { ico: 'fuel', label: 'Fuel cells' },
    invasion: { ico: 'troops', label: 'Invasion' }, beam: { ico: 'beam', label: 'Beam weapon' }, missile: { ico: 'missile', label: 'Missile' },
    bomb: { ico: 'bomb', label: 'Bomb' }, torpedo: { ico: 'missile', label: 'Torpedo' }, advanced: { ico: 'tech', label: 'General improvement' },
  };
  const typeInfo = t => TYPES[t] || { ico: 'tech', label: 'Technology' };
  const PLANET_TYPES = { 1: 'radiated', 2: 'toxic', 3: 'inferno', 4: 'dead', 5: 'tundra', 6: 'barren', 7: 'minimal' };
  const humanize = s => String(s || '').replace(/-/g, ' ').replace(/\b([a-z])/g, c => c.toUpperCase());
  const techOf = (f, level) => { try { return RS().techAt(f, level); } catch (e) { return null; } };

  // the researched techs of a field, oldest (lowest level) first; the free level-1 bundle expands to all of its techs
  function ownedTechs(E, f) {
    const out = [], T = TD();
    for (const lvl of E.research.completed[f]) {
      if (lvl === 1) { const b = T.l1Bundle && T.l1Bundle[f]; if (b && b.length) { for (const t of b) out.push(t); continue; } }
      const t = techOf(f, lvl); if (t) out.push(t);
    }
    return out;
  }

  // ---- ship parts a tech unlocks (names + a key number from Data.Components) -----------------------------------------------------------------------
  const partCache = new Map();
  function findPart(g) {
    const key = g.kind + ':' + g.id;
    if (partCache.has(key)) return partCache.get(key);
    let found = null; const C = M.Data && M.Data.Components;
    if (C) for (const l of [C.WEAPONS, C.COMPUTERS, C.ECM, C.SHIELDS, C.ENGINES, C.ARMOR, C.SPECIALS]) { if (!l) continue; found = l.find(it => it.grant === key); if (found) break; }
    partCache.set(key, found);
    return found;
  }
  function partLines(t) {
    const out = [];
    for (const g of (t.grants || [])) {
      const p = findPart(g);
      if (!p) { out.push(humanize(g.id)); continue; }
      let s = p.name;
      if (p.dmg && p.kind !== 'special') s += ' · ' + (p.dmg[0] === p.dmg[1] ? p.dmg[0] : p.dmg[0] + '–' + p.dmg[1]) + ' damage' + (p.range ? ', range ' + p.range : '');
      else if (p.absorb) s += ' · absorbs ' + p.absorb;
      else if (p.level && p.mark === undefined && (g.kind === 'computer' || g.kind === 'ecm')) s += ' · level ' + p.level;
      else if (p.warp) s += ' · warp ' + p.warp;
      else if (p.pct) s += ' · armor ' + p.pct + '%';
      out.push(s);
    }
    return out;
  }
  function effectLines(t) {
    const fx = t.effects || {}, out = [], T = TD(), add = (k, v) => out.push({ k, v });
    if (fx.scan) add('Scanner range', fx.scan + ' parsecs');
    if (fx.scanFleetInfo) add('Enemy fleets', 'destination and arrival time shown');
    if (fx.advScanner) add('Planets', 'size, climate and resources seen from afar');
    if (fx.robotic) add('Robotic controls', fx.robotic + ' factories per colonist');
    if (fx.factoryCost) add('Factory cost', fx.factoryCost + ' BC');
    if (fx.wasteScale !== undefined) add('Factory waste', (fx.wasteScale * 10) + '% of normal');
    if (fx.ecoRestore) add('Waste cleanup', fx.ecoRestore + ' per BC of ecology');
    if (fx.fuel) add('Ship range', fx.fuel >= 30 ? 'unlimited' : fx.fuel + ' parsecs');
    if (fx.warp) add('Warp factor', fx.warp);
    if (fx.stargate) add('Unlocks', 'stargates');
    if (fx.interdictor) add('Defence', 'cancels enemy teleporters over your worlds');
    if (fx.combatTransporter) add('Invasion', 'at least half of the troops always land');
    if (fx.hyperComm) add('Fleets in flight', 'can be redirected');
    if (fx.colonyFor) add('Colony bases', 'can settle ' + (PLANET_TYPES[fx.colonyFor] || 'hostile') + ' worlds');
    if (fx.terraform) add('Terraforming', '+' + fx.terraform + ' population cap · ' + fx.terraformCost + ' BC per point');
    if (fx.advSoil) add('Advanced soil', 'worlds become Gaia (+50% population)');
    else if (fx.soil) add('Soil enrichment', 'Normal worlds become Fertile (+25%)');
    if (fx.atmos) add('Atmosphere', 'Hostile worlds become Normal');
    if (fx.incPopCost) add('Population growth', fx.incPopCost + ' BC per +1');
    if (fx.antidote) add('Bio-weapon defence', '−' + fx.antidote + ' casualties per hit');
    if (fx.planetShield) add('Planetary shield', 'class ' + fx.planetShield.level + ' · ' + fmt(fx.planetShield.cost) + ' BC');
    if (fx.groundTier) add('Ground combat', '+' + T.groundBonus({ [fx.groundTier.group]: fx.groundTier.tier }) + '%');
    if (fx.baseShield) add('Deflector', 'absorbs ' + fx.baseShield + ' damage per hit');
    if (fx.baseComp) add('Attack level', fx.baseComp);
    if (fx.baseEcm) add('Missile defence', fx.baseEcm);
    if (fx.tlOnly) add('Effect', 'raises the tech level of the field');
    const parts = partLines(t);
    if (parts.length) add('Ship parts', parts.join('; '));
    return out;
  }

  // ================================================================== derived empire numbers
  // capability line per field (research/06 §5.12): derived from E.mods
  function capability(E, f) {
    const m = E.mods || {}, T = TD(), C = M.Sim.Colony, g = m.ground || {};
    const gb = o => '+' + T.groundBonus(o) + '%';
    const oper = C && C.oper ? C.oper(E) : (m.robotic || 2);
    const waste = E.race === 'silicoid' ? 'none' : ((m.wasteScale === undefined ? 10 : m.wasteScale) * 10) + '%';
    const range = (m.fuel || 3) >= 30 ? 'unlimited' : (m.fuel || 3) + ' parsecs';
    const BM = T.BASE_MISSILES, bm = BM[(m.baseMissile || 1) - 1] || 'nuclear-missile', CW = M.Data.Components, bw = CW && CW.WEAPONS.find(x => x.id === bm);
    const bmName = bw ? bw.name.replace(/ (Rocket|Missile)$/, '') : humanize(bm);
    switch (f) {
      case 0: return { items: [['Scanner range', (m.scan || 3) + ' parsecs'], ['Robot controls', oper + '/col']], tip: ['Battle computer: Mark ' + (m.baseComp || 1), 'ECM jammer: ' + (m.baseEcm ? 'Mark ' + m.baseEcm : 'none'), 'Scanner range ' + (m.scan || 3) + ' parsecs', 'Robotic controls: ' + oper + ' factories per colonist'] };
      case 1: return { items: [['Factory waste', waste], ['Ground combat', gb({ armor: g.armor, suit: g.suit })]], tip: ['Factory cost ' + (m.factoryCost || 10) + ' BC', 'Factory pollution ' + waste + ' of normal', 'Armor tier ' + (g.armor || 0) + ', combat suit tier ' + (g.suit || 0)] };
      case 2: return { items: [['Planet shield', m.planetShield ? 'class ' + m.planetShield : 'none'], ['Ground combat', gb({ shield: g.shield })]], tip: ['Best deflector absorbs ' + (m.baseShield || 1) + ' damage per hit', 'Planetary shield ' + (m.planetShield ? 'class ' + m.planetShield + ' (' + fmt(m.planetShieldCost) + ' BC)' : 'not yet available'), 'Personal shield tier ' + (g.shield || 0)] };
      case 3: return { items: [['Terraform', '+' + (m.terraform | 0)], ['Waste elimination', (m.ecoRestore || 2) + '/BC']], tip: ['Population growth costs ' + (m.incPopCost || 20) + ' BC per +1', 'Colony bases can settle ' + (PLANET_TYPES[m.colonyFor || 7]) + ' worlds or better', 'Soil enrichment: ' + (m.advSoil ? 'to Gaia' : m.soil ? 'to Fertile' : 'no') + ' · atmosphere: ' + (m.atmos ? 'yes' : 'no')] };
      case 4: return { items: [['Ship range', range], ['Warp', m.warp || 1]], tip: ['Fuel range ' + range + ' from your colonies', 'Best engine: warp ' + (m.warp || 1), 'Colony transports: ' + (m.transportSpeed || 1) + ' parsec per turn' + (m.stargate ? ' · stargates available' : '')] };
      default: return { items: [['Ground combat', gb({ weapon: g.weapon })], ['Missile bases', bmName]], tip: ['Personal weapon tier ' + (g.weapon || 0), 'Missile bases fire ' + bmName + ' missiles'] };
    }
  }

  // RP actually flowing into a field this turn (before interest) and a forecast of the breakthrough (research/02 §1.4)
  const rpOf = (E, f) => Math.floor(E.research.slider[f] * (E.research.total | 0) / 100);
  // returns {rp, exp (expected turns), first (earliest turn with a chance), sure (turn it is certain), never}
  function forecast(E, f, invest, cost, rp) {
    if (!cost) return null;
    if (rp === undefined) rp = rpOf(E, f);
    if (rp <= 0) return { rp: 0, never: true };
    let inv = invest, surv = 1, exp = 0, first = 0, sure = 0;
    for (let y = 1; y <= 300; y++) {
      const t1 = min(floor(inv * 3 / 20), 2 * rp);
      inv += rp + t1;
      const p = inv > cost ? min(1, floor((inv - cost) * 250 / cost) / 500) : 0;
      if (p > 0 && !first) first = y;
      exp += y * surv * p; surv *= 1 - p;
      if (p >= 1) { sure = y; break; }
    }
    if (!sure) { exp += surv * 300; sure = 300; }
    return { rp, exp: max(1, round(exp)), first: first || sure, sure };
  }
  const etaText = fc => (!fc ? '' : fc.never ? 'no funding' : '≈ ' + fc.exp + (fc.exp === 1 ? ' turn' : ' turns') + (fc.first < fc.exp - 1 || fc.sure > fc.exp + 1 ? ' (earliest ' + fc.first + ', certain by ' + fc.sure + ')' : ''));

  // empire research points for display, kept consistent with the colony sliders (a documented sim function; derived data only)
  function syncTotal(S) { try { if (M.Sim.Econ && M.Sim.Econ.stepResearchTotal) M.Sim.Econ.stepResearchTotal(S); } catch (e) { /* display only */ } }

  // ================================================================== light bulb gauge (fill = true breakthrough chance this turn)
  let bulbSeq = 0;
  const GLASS = 'M12 1.5C6.6 1.5 2.8 5.5 2.8 10.6c0 3.4 1.7 5.6 3.4 7.4.9 1 1.5 1.9 1.7 3.2v1.4h8.2v-1.4c.2-1.3.8-2.2 1.7-3.2 1.7-1.8 3.4-4 3.4-7.4C21.2 5.5 17.4 1.5 12 1.5z';
  function makeBulb() {
    const id = 'tchb' + (++bulbSeq), el = h('div.tch-bulb');
    el.innerHTML = '<svg viewBox="0 0 24 32" aria-hidden="true"><defs><clipPath id="' + id + '"><path d="' + GLASS + '"/></clipPath>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff9440"/><stop offset="1" stop-color="#fff0b8"/></linearGradient></defs>' +
      '<path class="gl" d="' + GLASS + '"/><g clip-path="url(#' + id + ')"><rect class="fill" x="0" y="22.5" width="24" height="0" fill="url(#' + id + 'g)"/></g>' +
      '<path class="ol" d="' + GLASS + '"/><path class="bs" d="M8.6 25.2h6.8M9.3 27.8h5.4M10.6 30.4h2.8"/></svg><span class="pc"></span>';
    const fill = el.querySelector('.fill'), pc = el.querySelector('.pc');
    el.set = (chance, has) => {                              // chance 0..1, has = a funded project exists
      const f = clamp(chance, 0, 1), hh = 21 * f;
      fill.setAttribute('y', (22.5 - hh).toFixed(2)); fill.setAttribute('height', hh.toFixed(2));
      el.classList.toggle('off', !has); el.classList.toggle('lit', f > 0);
      pc.textContent = !has ? '—' : f <= 0 ? '0%' : (f < 0.01 ? '<1%' : round(f * 100) + '%');
    };
    return el;
  }

  // ================================================================== procedural hologram art (picture pane)
  const bgCache = new Map();
  const glowSprites = new Map();
  function rgbOf(c) { const n = parseInt(String(c).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (c, a) => { const v = rgbOf(c); return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)) + ')'; };
  const mixHex = (a, b, k) => { const A = rgbOf(a), B = rgbOf(b), x = i => ('0' + round(A[i] + (B[i] - A[i]) * k).toString(16)).slice(-2); return '#' + x(0) + x(1) + x(2); };
  function glowSprite(col) {
    let c = glowSprites.get(col);
    if (c) return c;
    c = doc.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), gr = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.18, rgba(col, 0.55)); gr.addColorStop(0.5, rgba(col, 0.14)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 96, 96);
    glowSprites.set(col, c);
    return c;
  }
  function glow(g, x, y, r, col, a) { if (r < 1 || a <= 0) return; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = min(1, a); g.drawImage(glowSprite(col), x - r, y - r, r * 2, r * 2); g.restore(); }
  function chamfer(g, x, y, w, hh, c) { g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + hh - c); g.lineTo(x + w - c, y + hh); g.lineTo(x + c, y + hh); g.lineTo(x, y + hh - c); g.lineTo(x, y + c); g.closePath(); }
  function poly(g, pts, close) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); if (close) g.closePath(); }
  function txt(g, s, x, y, size, col, align, ls) {
    g.font = '400 ' + size + 'px "Marcellus SC","Marcellus","Palatino Linotype",Georgia,serif'; g.textAlign = align || 'center'; g.textBaseline = 'middle'; g.fillStyle = col;
    if (ls && 'letterSpacing' in g) g.letterSpacing = ls + 'px';
    g.fillText(s, x, y);
    if (ls && 'letterSpacing' in g) g.letterSpacing = '0px';
  }
  const hashStr = s => { let x = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const rnd = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  function shipAt(g, o, x, y, size, ang, alpha) {
    const S = M.Gfx && M.Gfx.Ships;
    g.save(); g.translate(x, y); g.rotate(ang || 0); if (alpha !== undefined) g.globalAlpha = alpha;
    try {
      if (S && S.sprite) { const c = S.sprite(o.race || 'human', o.hull === undefined ? 2 : o.hull, size, o.banner || '#62d8ff', { view: '3q' }); g.drawImage(c, -c.cx, -c.cy); g.restore(); return; }
    } catch (e) { /* draw the fallback */ }
    g.fillStyle = '#9fb4e8'; poly(g, [size * 0.5, 0, -size * 0.4, -size * 0.3, -size * 0.2, 0, -size * 0.4, size * 0.3], true); g.fill();
    g.restore();
  }
  function planetAt(g, look, x, y, r, seed, inhabited) {
    const P = M.Gfx && M.Gfx.pick('planets');
    try {
      if (P && P.sprite) { const d = max(16, round(r * 2)), c = P.sprite({ look, seed: seed || 7, inhabited: !!inhabited }, d); g.drawImage(c, x - r, y - r, r * 2, r * 2); return; }
    } catch (e) { /* fall through */ }
    g.fillStyle = '#445'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  // blueprint background: grid, vignette, corner brackets (cached per size + colour)
  function backdrop(w, hh, col, k) {
    const key = w + 'x' + hh + col + '@' + k;
    let c = bgCache.get(key);
    if (c) return c;
    c = doc.createElement('canvas'); c.width = max(1, round(w * k)); c.height = max(1, round(hh * k));
    const g = c.getContext('2d'); g.scale(k, k);
    g.fillStyle = '#040715'; g.fillRect(0, 0, w, hh);
    const gr = g.createRadialGradient(w * 0.5, hh * 0.52, 0, w * 0.5, hh * 0.52, max(w, hh) * 0.7);
    gr.addColorStop(0, rgba(col, 0.2)); gr.addColorStop(0.55, rgba(col, 0.06)); gr.addColorStop(1, 'rgba(2,4,12,0.9)');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    const step = max(10, round(min(w, hh) / 9));
    g.lineWidth = 1; g.strokeStyle = rgba(col, 0.07);
    g.beginPath(); for (let x = (w % step) / 2; x < w; x += step) { g.moveTo(round(x) + 0.5, 0); g.lineTo(round(x) + 0.5, hh); } for (let y = (hh % step) / 2; y < hh; y += step) { g.moveTo(0, round(y) + 0.5); g.lineTo(w, round(y) + 0.5); } g.stroke();
    g.strokeStyle = rgba(col, 0.14); g.beginPath(); g.moveTo(w / 2 + 0.5, 0); g.lineTo(w / 2 + 0.5, hh); g.moveTo(0, hh / 2 + 0.5); g.lineTo(w, hh / 2 + 0.5); g.stroke();
    const kb = max(8, min(w, hh) * 0.09), m = 4; g.lineWidth = 1.5; g.strokeStyle = 'rgba(214,179,106,0.85)';
    g.beginPath();
    g.moveTo(m, m + kb); g.lineTo(m, m); g.lineTo(m + kb, m); g.moveTo(w - m - kb, m); g.lineTo(w - m, m); g.lineTo(w - m, m + kb);
    g.moveTo(m, hh - m - kb); g.lineTo(m, hh - m); g.lineTo(m + kb, hh - m); g.moveTo(w - m - kb, hh - m); g.lineTo(w - m, hh - m); g.lineTo(w - m, hh - m - kb);
    g.stroke();
    if (bgCache.size > 24) bgCache.delete(bgCache.keys().next().value);
    bgCache.set(key, c);
    return c;
  }

  // ---- motif painters: (g, cx, cy, s, col, t, tech, o) -------------------------------------------------------------------------------------------
  function ringPulse(g, x, y, r0, r1, col, t, n, a) { for (let i = 0; i < n; i++) { const u = ((t * 0.5) + i / n) % 1; g.strokeStyle = rgba(col, (1 - u) * a); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r0 + (r1 - r0) * u, 0, TAU); g.stroke(); } }
  function target(g, x, y, r, col, a) { g.strokeStyle = rgba(col, a); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r, 0, TAU); g.moveTo(x - r * 1.5, y); g.lineTo(x - r * 0.5, y); g.moveTo(x + r * 0.5, y); g.lineTo(x + r * 1.5, y); g.moveTo(x, y - r * 1.5); g.lineTo(x, y - r * 0.5); g.moveTo(x, y + r * 0.5); g.lineTo(x, y + r * 1.5); g.stroke(); }

  // every motif puts its one-line figure on the same bottom line (set per draw by drawArt)
  const LAB = { x: 0, y: 0, top: 0, size: 10 };
  const caption = (g, str) => { if (str) txt(g, str, LAB.x, LAB.y, LAB.size, '#f3dca0', 'center', 2); };
  const captionTop = (g, str) => { if (str) txt(g, str, LAB.x, LAB.top, LAB.size, '#f3dca0', 'center', 2); };
  const ART = {};
  ART.chip = function (g, cx, cy, s, col, t, tech) {
    const fx = tech.effects || {}, n = fx.baseComp || fx.baseEcm || 1;
    g.lineWidth = 1.6; g.strokeStyle = col; g.fillStyle = rgba(col, 0.1);
    chamfer(g, cx - s * 0.62, cy - s * 0.62, s * 1.24, s * 1.24, s * 0.2); g.fill(); g.stroke();
    chamfer(g, cx - s * 0.4, cy - s * 0.4, s * 0.8, s * 0.8, s * 0.12); g.strokeStyle = rgba(col, 0.55); g.stroke();
    g.strokeStyle = rgba(col, 0.8); g.beginPath();
    for (let i = 0; i < 6; i++) { const u = cx - s * 0.5 + i * s * 0.2; g.moveTo(u, cy - s * 0.62); g.lineTo(u, cy - s * 0.86); g.moveTo(u, cy + s * 0.62); g.lineTo(u, cy + s * 0.86); g.moveTo(cx - s * 0.62, u - cx + cy); g.lineTo(cx - s * 0.86, u - cx + cy); g.moveTo(cx + s * 0.62, u - cx + cy); g.lineTo(cx + s * 0.86, u - cx + cy); }
    g.stroke();
    for (let i = 0; i < 6; i++) {                                  // data pulses running along the pins
      const u = (t * 0.7 + i * 0.17) % 1, x = cx - s * 0.5 + i * s * 0.2;
      glow(g, x, cy - s * (0.62 + 0.24 * (1 - u)), s * 0.12, col, 0.9 * (1 - u)); glow(g, cx + s * (0.62 + 0.24 * u), cy - s * 0.5 + i * s * 0.2, s * 0.12, col, 0.9 * (1 - u));
    }
    txt(g, (tech.type === 'ecm' ? 'ECM ' : 'MK ') + (n > 1 ? n : 'I'), cx, cy - s * 0.05, s * 0.34, '#f3dca0');
    for (let i = 0; i < min(11, n); i++) { g.fillStyle = rgba(col, 0.9); g.fillRect(cx - s * 0.33 + i * s * 0.065, cy + s * 0.2, s * 0.045, s * 0.08); }
    glow(g, cx, cy, s * 1.4, col, 0.25);
  };
  ART.ecm = function (g, cx, cy, s, col, t, tech, o) {
    const n = (tech.effects && tech.effects.baseEcm) || 1;
    for (let i = 0; i < 4; i++) { const u = (t * 0.5 + i / 4) % 1, r = s * (0.3 + u * 1.0); g.strokeStyle = rgba(col, (1 - u) * 0.8); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(cx, cy, r, PI - 0.9, PI + 0.9); g.stroke(); }
    shipAt(g, o, cx, cy, s * 0.7, -PI / 2);
    for (let i = 0; i < 3; i++) {                                   // incoming missiles veering away
      const u = (t * 0.45 + i * 0.33) % 1, y0 = cy + (i - 1) * s * 0.55, x = cx + s * 1.5 - u * s * 0.9, y = y0 + (u > 0.55 ? (u - 0.55) * (i - 1 || 1) * s * 1.5 : 0);
      g.strokeStyle = rgba('#ff7a86', 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.22, y - (u > 0.55 ? (i - 1 || 1) * s * 0.08 : 0)); g.stroke();
      if (u > 0.55 && u < 0.62) { g.strokeStyle = rgba(col, 0.9); g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); }
    }
    caption(g, 'JAM ' + n);
  };
  ART.radar = function (g, cx, cy, s, col, t, tech) {
    const range = (tech.effects && tech.effects.scan) || 3, rnd1 = rnd(hashStr(tech.id));
    g.lineWidth = 1.2; g.strokeStyle = rgba(col, 0.6);
    for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(cx, cy, s * i * 0.42, 0, TAU); g.stroke(); }
    g.beginPath(); g.moveTo(cx - s * 1.3, cy); g.lineTo(cx + s * 1.3, cy); g.moveTo(cx, cy - s * 1.3); g.lineTo(cx, cy + s * 1.3); g.stroke();
    const a = t * 1.4;
    for (let i = 0; i < 18; i++) { const k = i / 18; g.fillStyle = rgba(col, 0.32 * (1 - k)); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, s * 1.26, a - (k + 0.06) * 0.8, a - k * 0.8); g.closePath(); g.fill(); }
    g.strokeStyle = rgba(col, 0.95); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cos(a) * s * 1.26, cy + sin(a) * s * 1.26); g.stroke();
    const blips = 3 + range;
    for (let i = 0; i < blips; i++) {
      const ang = rnd1() * TAU, r = (0.25 + rnd1() * 0.95) * s, d = ((a - ang) % TAU + TAU) % TAU, v = max(0, 1 - d / 2.4);
      glow(g, cx + cos(ang) * r, cy + sin(ang) * r, s * 0.22, '#f3dca0', v * 0.95); g.fillStyle = rgba('#f3dca0', 0.35 + v * 0.65); g.fillRect(cx + cos(ang) * r - 2, cy + sin(ang) * r - 2, 4, 4);
    }
    caption(g, range + ' PC');
  };
  ART.gear = function (g, cx, cy, s, col, t, tech) {
    const fx = tech.effects || {}, n = fx.robotic || 0;
    const gearPath = (x, y, r, teeth, rot) => { g.beginPath(); for (let i = 0; i < teeth * 2; i++) { const a = rot + i * PI / teeth, rr = (i % 2 ? r * 0.8 : r); const a0 = a - PI / teeth * 0.5, a1 = a + PI / teeth * 0.5; g.lineTo(x + cos(a0) * rr, y + sin(a0) * rr); g.lineTo(x + cos(a1) * rr, y + sin(a1) * rr); } g.closePath(); };
    const sp = reduced() ? 0 : 1;
    g.lineWidth = 1.8; g.strokeStyle = col; g.fillStyle = rgba(col, 0.1);
    gearPath(cx - s * 0.2, cy + s * 0.05, s * 0.85, 12, t * 0.3 * sp); g.fill(); g.stroke();
    g.beginPath(); g.arc(cx - s * 0.2, cy + s * 0.05, s * 0.28, 0, TAU); g.stroke();
    gearPath(cx + s * 0.78, cy - s * 0.55, s * 0.42, 8, -t * 0.3 * sp * 1.5 + 0.2); g.fill(); g.stroke();
    if (n) {                                                         // robotic controls: an articulated arm
      const a1 = -0.9 + sin(t * 1.3) * 0.25 * sp, a2 = 0.7 + cos(t * 1.1) * 0.3 * sp, x1 = cx - s * 0.2 + cos(a1) * s * 0.7, y1 = cy + s * 0.05 + sin(a1) * s * 0.7;
      g.lineWidth = 4; g.strokeStyle = '#f3dca0'; g.beginPath(); g.moveTo(cx - s * 0.2, cy + s * 0.05); g.lineTo(x1, y1); g.lineTo(x1 + cos(a2 + a1) * s * 0.55, y1 + sin(a2 + a1) * s * 0.55); g.stroke();
      glow(g, x1, y1, s * 0.2, col, 0.7);
    }
    caption(g, n ? n + ' / COLONIST' : (fx.factoryCost ? fx.factoryCost + ' BC' : ''));
  };
  ART.plume = function (g, cx, cy, s, col, t, tech) {
    const sc = tech.effects && tech.effects.wasteScale !== undefined ? tech.effects.wasteScale / 10 : 1;
    g.lineWidth = 1.6; g.strokeStyle = col; g.fillStyle = rgba(col, 0.1);
    chamfer(g, cx - s * 0.95, cy + s * 0.25, s * 1.9, s * 0.7, s * 0.08); g.fill(); g.stroke();
    for (const dx of [-0.55, 0.15]) { g.fillRect(cx + s * dx, cy - s * 0.35, s * 0.28, s * 0.62); g.strokeRect(cx + s * dx, cy - s * 0.35, s * 0.28, s * 0.62); }
    for (let i = 0; i < 8; i++) {
      for (const dx of [-0.41, 0.29]) {
        const u = (t * 0.35 + i / 8 + (dx > 0 ? 0.5 / 8 : 0)) % 1, r = s * (0.07 + u * 0.28) * (0.3 + sc * 0.7), a = (1 - u) * 0.55 * (sc > 0 ? 0.35 + sc * 0.65 : 0);
        if (a > 0.01) { g.fillStyle = rgba('#98a5cf', a); g.beginPath(); g.arc(cx + s * dx + sin(u * 5 + i) * s * 0.08, cy - s * 0.42 - u * s * 0.9, r, 0, TAU); g.fill(); }
      }
    }
    for (let i = 0; i < 5; i++) { g.fillStyle = rgba(col, 0.5 + 0.4 * sin(t * 2 + i)); g.fillRect(cx - s * 0.75 + i * s * 0.32, cy + s * 0.45, s * 0.14, s * 0.2); }
    caption(g, round(sc * 100) + '% WASTE');
  };
  ART.plates = function (g, cx, cy, s, col, t, tech) {
    const fx = tech.effects || {}, tier = (fx.baseHp || 0) + 1, hit = tech.id + 'x';
    for (let i = 0; i < tier; i++) {
      const y = cy + s * 0.75 - i * s * 0.22, k = mixHex('#8a7040', '#f3dca0', i / 7);
      g.fillStyle = rgba(k, 0.35); g.strokeStyle = k; g.lineWidth = 1.5; chamfer(g, cx - s * 0.95, y - s * 0.1, s * 1.9, s * 0.2, s * 0.05); g.fill(); g.stroke();
    }
    g.strokeStyle = rgba('#98a5cf', 0.6); g.strokeRect(cx - s * 0.95, cy + s * 0.78, s * 1.9, s * 0.1);
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.6 + i * 0.33) % 1, x = cx - s * 0.5 + i * s * 0.5, y = cy - s * 1.1 + u * s * (1.1 + 0.85 - tier * 0.22 + 0.3);
      glow(g, x, y, s * 0.18, '#ff7a86', 0.9); g.strokeStyle = rgba('#ff7a86', 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - s * 0.3); g.lineTo(x, y); g.stroke();
    }
    caption(g, hit && tech.type === 'armor' ? 'PLATING ×' + (1 + (fx.baseHp || 0) * 0.5).toFixed(1) : '');
  };
  ART.trooper = function (g, cx, cy, s, col, t, tech) {
    const bob = reduced() ? 0 : sin(t * 2) * s * 0.02;
    g.lineWidth = 1.8; g.strokeStyle = col; g.fillStyle = rgba(col, 0.12);
    poly(g, [cx - s * 0.2, cy - s * 0.95 + bob, cx + s * 0.2, cy - s * 0.95 + bob, cx + s * 0.3, cy - s * 0.65 + bob, cx + s * 0.2, cy - s * 0.5 + bob, cx - s * 0.2, cy - s * 0.5 + bob, cx - s * 0.3, cy - s * 0.65 + bob], true); g.fill(); g.stroke();
    poly(g, [cx - s * 0.62, cy - s * 0.45 + bob, cx + s * 0.62, cy - s * 0.45 + bob, cx + s * 0.5, cy + s * 0.25 + bob, cx + s * 0.28, cy + s * 0.25 + bob, cx + s * 0.28, cy + s * 0.95, cx + s * 0.06, cy + s * 0.95, cx + s * 0.06, cy + s * 0.25 + bob, cx - s * 0.06, cy + s * 0.25 + bob, cx - s * 0.06, cy + s * 0.95, cx - s * 0.28, cy + s * 0.95, cx - s * 0.28, cy + s * 0.25 + bob, cx - s * 0.5, cy + s * 0.25 + bob], true); g.fill(); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#f3dca0'; g.beginPath(); g.moveTo(cx + s * 0.55, cy - s * 0.2 + bob); g.lineTo(cx + s * 1.2, cy - s * 0.5 + bob); g.stroke(); g.lineWidth = 1.2;
    const gt = (tech.effects && tech.effects.groundTier) || {};
    if (gt.group === 'shield') { g.strokeStyle = rgba('#a98bff', 0.8); g.beginPath(); g.arc(cx, cy, s * 1.15, -PI * 0.8, PI * 0.8); g.stroke(); glow(g, cx, cy, s * 1.3, '#a98bff', 0.2); }
    if (gt.group === 'weapon') { glow(g, cx + s * 1.2, cy - s * 0.5 + bob, s * 0.3, '#ff7a86', 0.5 + 0.4 * sin(t * 8)); }
    if (gt.group === 'armor' || gt.group === 'suit') { g.strokeStyle = rgba('#f3dca0', 0.7); for (let i = 0; i < (gt.tier || 1); i++) { g.beginPath(); g.moveTo(cx - s * 0.5 + i * s * 0.18, cy - s * 0.32 + bob); g.lineTo(cx - s * 0.4 + i * s * 0.18, cy - s * 0.18 + bob); g.stroke(); } }
    caption(g, gt.group ? '+' + TD().groundBonus({ [gt.group]: gt.tier }) + '% GROUND' : '');
  };
  ART.bubble = function (g, cx, cy, s, col, t, tech, o) {
    const ab = (tech.effects && tech.effects.baseShield) || 1, k = clamp(ab / 15, 0.2, 1);
    shipAt(g, o, cx, cy, s * 0.9, 0);
    const r = s * 1.05; g.save(); g.beginPath(); g.ellipse(cx, cy, r * 1.15, r * 0.9, 0, 0, TAU); g.clip();
    g.strokeStyle = rgba(col, 0.2 + 0.25 * k); g.lineWidth = 1;
    for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(cx + i * s * 0.2, cy - r); g.lineTo(cx + i * s * 0.2 + s * 0.12, cy + r); g.stroke(); g.beginPath(); g.moveTo(cx - r * 1.2, cy + i * s * 0.17); g.lineTo(cx + r * 1.2, cy + i * s * 0.17 + s * 0.07); g.stroke(); }
    g.restore();
    g.strokeStyle = rgba(col, 0.9); g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, r * 1.15, r * 0.9, 0, 0, TAU); g.stroke();
    glow(g, cx, cy, s * 1.6, col, 0.12 + 0.18 * k);
    for (let i = 0; i < 2; i++) { const u = (t * 0.7 + i * 0.5) % 1, a = -0.6 + i * 2.4, px = cx + cos(a) * r * 1.15, py = cy + sin(a) * r * 0.9; glow(g, px, py, s * 0.1 + u * s * 0.45, col, (1 - u) * 0.9); g.strokeStyle = rgba('#ff7a86', (1 - u)); g.lineWidth = 2; g.beginPath(); g.moveTo(px + cos(a) * s * (0.7 - u * 0.5), py + sin(a) * s * (0.7 - u * 0.5)); g.lineTo(px, py); g.stroke(); }
    caption(g, 'ABSORBS ' + ab);
  };
  ART.dome = function (g, cx, cy, s, col, t, tech) {
    const lv = (tech.effects && tech.effects.planetShield && tech.effects.planetShield.level) || 5;
    planetAt(g, 'terran', cx, cy + s * 1.15, s * 1.0, 11, true);
    g.strokeStyle = rgba(col, 0.95); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy + s * 1.15, s * 1.45, PI * 1.12, PI * 1.88); g.stroke();
    g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = PI * (1.12 + i * 0.76 / 6); g.beginPath(); g.moveTo(cx + cos(a) * s * 1.0, cy + s * 1.15 + sin(a) * s * 1.0); g.lineTo(cx + cos(a) * s * 1.45, cy + s * 1.15 + sin(a) * s * 1.45); g.stroke(); }
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(cx, cy + s * 1.15, s * (1.15 + i * 0.1), PI * 1.15, PI * 1.85); g.stroke(); }
    glow(g, cx, cy + s * 0.2, s * 1.7, col, 0.18);
    const u = (t * 0.6) % 1; glow(g, cx + (u - 0.5) * s * 1.6, cy - s * 0.08 + abs(u - 0.5) * s * 0.4, s * 0.25, '#ff7a86', 0.85 * (1 - u));
    captionTop(g, 'CLASS ' + lv);
  };
  ART.planet = function (g, cx, cy, s, col, t, tech) {
    const fx = tech.effects || {}, ty = tech.type;
    let look = 'terran', inh = false, label = '';
    if (ty === 'environment') { look = { 6: 'barren', 5: 'tundra', 4: 'dead', 3: 'inferno', 2: 'toxic', 1: 'radiated' }[fx.colonyFor] || 'barren'; label = (PLANET_TYPES[fx.colonyFor] || '').toUpperCase() + ' COLONIES'; }
    else if (ty === 'eco') { look = 'toxic'; label = (fx.ecoRestore || 2) + ' WASTE / BC'; }
    else if (ty === 'terraform') { look = 'barren'; label = fx.terraform ? '+' + fx.terraform + ' POPULATION' : ''; }
    else if (fx.advSoil) { look = 'gaia'; label = 'GAIA WORLDS'; } else if (fx.soil) { look = 'jungle'; label = 'FERTILE SOIL'; } else if (fx.atmos) { look = 'arid'; label = 'NEW ATMOSPHERE'; }
    const r = s * 0.95;
    if (ty === 'terraform') {                                        // barren half → living half
      planetAt(g, 'barren', cx, cy, r, 5);
      g.save(); g.beginPath(); g.rect(cx - r * 1.1 + (t * 0.35 % 1.2) * r * 2.4 - r * 0.2, cy - r * 1.1, r * 2.4, r * 2.2); g.clip(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); planetAt(g, 'terran', cx, cy, r, 5, true); g.restore();
    } else planetAt(g, look, cx, cy, r, ty === 'environment' ? 21 : 9, inh);
    if (ty === 'environment') { g.strokeStyle = '#f3dca0'; g.lineWidth = 2; g.fillStyle = rgba(col, 0.35); g.beginPath(); g.arc(cx + r * 0.25, cy - r * 0.55, r * 0.26, PI, TAU); g.closePath(); g.fill(); g.stroke(); glow(g, cx + r * 0.25, cy - r * 0.6, r * 0.5, col, 0.5); }
    if (ty === 'eco') { const R = rnd(7); for (let i = 0; i < 14; i++) { const a = R() * TAU, d = r * (1.08 + R() * 0.35), u = (t * 0.25 + R()) % 1; g.fillStyle = rgba('#98a5cf', (1 - u) * 0.8); g.fillRect(cx + cos(a) * d * (1 + u * 0.1), cy + sin(a) * d * (1 + u * 0.1), 3, 3); } g.strokeStyle = rgba(col, 0.8); g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, r * 1.18, t * 1.2, t * 1.2 + 1.1); g.stroke(); }
    if (fx.atmos || fx.soil || fx.advSoil) ringPulse(g, cx, cy, r * 1.02, r * 1.5, fx.atmos ? '#62d8ff' : col, t, 3, 0.7);
    glow(g, cx, cy, r * 1.7, col, 0.1);
    caption(g, label);
  };
  ART.helix = function (g, cx, cy, s, col, t, tech) {
    const n = 18, ph = reduced() ? 0 : t * 1.4;
    for (let i = 0; i < n; i++) {
      const y = cy - s * 1.1 + i * (s * 2.2 / (n - 1)), a = ph + i * 0.5, x1 = cx + sin(a) * s * 0.6, x2 = cx - sin(a) * s * 0.6, z = cos(a);
      g.strokeStyle = rgba(col, 0.25 + 0.2 * abs(z)); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke();
      g.fillStyle = rgba('#f3dca0', 0.55 + 0.45 * z); g.beginPath(); g.arc(x1, y, s * 0.06 * (1 + z * 0.4), 0, TAU); g.fill();
      g.fillStyle = rgba(col, 0.55 - 0.45 * z); g.beginPath(); g.arc(x2, y, s * 0.06 * (1 - z * 0.4), 0, TAU); g.fill();
    }
    caption(g, tech.effects && tech.effects.incPopCost ? tech.effects.incPopCost + ' BC / CITIZEN' : '');
  };
  ART.bio = function (g, cx, cy, s, col, t, tech) {
    const dmg = (tech.effects && tech.effects.antidote) || 0;
    g.lineWidth = 2; g.strokeStyle = rgba('#ff7a86', 0.9); g.fillStyle = rgba('#ff7a86', 0.12);
    for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3 + (reduced() ? 0 : t * 0.25); g.beginPath(); g.arc(cx + cos(a) * s * 0.5, cy + sin(a) * s * 0.5, s * 0.52, 0, TAU); g.fill(); g.stroke(); }
    g.beginPath(); g.arc(cx, cy, s * 0.14, 0, TAU); g.stroke();
    if (dmg || tech.type === 'defense') { g.strokeStyle = '#f3dca0'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - s * 1.05, cy); g.lineTo(cx + s * 1.05, cy); g.moveTo(cx, cy - s * 1.05); g.lineTo(cx, cy + s * 1.05); g.stroke(); }
    glow(g, cx, cy, s * 1.5, '#ff7a86', 0.18);
    const comp = M.Data.Components, w = comp && comp.WEAPONS.find(x => (tech.grants || []).some(gr => x.grant === gr.kind + ':' + gr.id));
    caption(g, w ? '−' + w.dmg[1] + ' POPULATION / HIT' : (dmg ? '−' + dmg + ' CASUALTIES / HIT' : ''));
  };
  ART.engine = function (g, cx, cy, s, col, t, tech, o) {
    const fx = tech.effects || {}, warp = fx.warp || 1, fuel = tech.type === 'fuel';
    if (fuel) {
      g.lineWidth = 1.8; g.strokeStyle = col; g.fillStyle = rgba(col, 0.12);
      chamfer(g, cx - s * 0.32, cy - s * 0.85, s * 0.64, s * 1.5, s * 0.14); g.fill(); g.stroke();
      g.fillStyle = rgba('#f3dca0', 0.9); g.fillRect(cx - s * 0.12, cy - s * 1.0, s * 0.24, s * 0.15);
      for (let i = 0; i < 8; i++) { g.fillStyle = rgba(col, 0.25 + 0.55 * (0.5 + 0.5 * sin(t * 2 - i * 0.7))); g.fillRect(cx - s * 0.22, cy + s * 0.5 - i * s * 0.17, s * 0.44, s * 0.1); }
      ringPulse(g, cx + s * 0.15, cy + s * 0.15, s * 0.5, s * 1.6, col, t, 3, 0.6);
      caption(g, (fx.fuel >= 30 ? 'UNLIMITED' : (fx.fuel || 3) + ' PARSECS'));
      return;
    }
    const len = s * (0.35 + warp * 0.14);
    shipAt(g, o, cx + s * 0.35, cy, s * 1.15, 0);
    for (let i = 0; i < 2; i++) { const y = cy + (i ? 1 : -1) * s * 0.14, gr = g.createLinearGradient(cx - s * 0.5, 0, cx - s * 0.5 - len, 0); gr.addColorStop(0, rgba('#fff0b8', 0.95)); gr.addColorStop(0.3, rgba(col, 0.7)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; const fl = len * (0.9 + 0.1 * sin(t * 18 + i)); poly(g, [cx - s * 0.48, y - s * 0.08, cx - s * 0.48 - fl, y, cx - s * 0.48, y + s * 0.08], true); g.fill(); }
    g.strokeStyle = rgba(col, 0.35); g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const u = (t * (0.5 + warp * 0.1) + i * 0.17) % 1, y = cy + (i - 2.5) * s * 0.3; g.beginPath(); g.moveTo(cx + s * 1.3 - u * s * 2.6, y); g.lineTo(cx + s * 1.3 - u * s * 2.6 - s * 0.35, y); g.stroke(); }
    caption(g, 'WARP ' + warp);
  };
  ART.beam = function (g, cx, cy, s, col, t, tech, o) {
    const comp = M.Data.Components, w = comp && comp.WEAPONS.find(x => (tech.grants || []).some(gr => x.grant === gr.kind + ':' + gr.id)), dmg = w ? w.dmg[1] : 8;
    const thick = clamp(1.5 + Math.log2(max(2, dmg)) * 0.9, 2, 8), rof = w && w.rof ? w.rof : 1;
    shipAt(g, o, cx - s * 0.85, cy, s * 0.9, 0);
    const tx = cx + s * 1.0, fire = ((t * (0.6 + rof * 0.25)) % 1);
    g.strokeStyle = rgba(col, 0.25); g.lineWidth = 1; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(cx - s * 0.4, cy); g.lineTo(tx, cy); g.stroke(); g.setLineDash([]);
    if (fire < 0.55) {
      const a = 1 - fire / 0.55; g.lineWidth = thick; g.strokeStyle = rgba(col, 0.9 * a); g.beginPath(); g.moveTo(cx - s * 0.4, cy); g.lineTo(tx - s * 0.2, cy); g.stroke();
      g.lineWidth = max(1, thick * 0.4); g.strokeStyle = rgba('#ffffff', 0.9 * a); g.beginPath(); g.moveTo(cx - s * 0.4, cy); g.lineTo(tx - s * 0.2, cy); g.stroke();
      glow(g, tx - s * 0.2, cy, s * (0.3 + dmg / 120), col, a);
    }
    target(g, tx, cy, s * 0.22, '#ff7a86', 0.9);
    caption(g, w ? (w.dmg[0] === w.dmg[1] ? w.dmg[0] : w.dmg[0] + '–' + w.dmg[1]) + ' DAMAGE' + (rof > 1 ? ' ×' + rof : '') : '');
  };
  ART.missile = function (g, cx, cy, s, col, t, tech, o) {
    const fx = tech.effects || {}, tor = tech.type === 'torpedo', warheads = fx.baseScatter ? [5, 7, 10][fx.baseScatter - 1] : 1;
    shipAt(g, o, cx - s * 1.05, cy, s * 0.8, 0);
    const u = (t * 0.4) % 1, x = cx - s * 0.6 + u * s * 1.8;
    const missile = (mx, my, ang, sc) => {
      g.save(); g.translate(mx, my); g.rotate(ang);
      const gr = g.createLinearGradient(-s * 0.6 * sc, 0, 0, 0); gr.addColorStop(0, rgba('#ff9440', 0)); gr.addColorStop(1, rgba('#ffd54f', 0.9)); g.fillStyle = gr; g.fillRect(-s * 0.6 * sc, -s * 0.03 * sc, s * 0.6 * sc, s * 0.06 * sc);
      g.fillStyle = tor ? '#ff9ec0' : '#ece6d3'; poly(g, [s * 0.16 * sc, 0, -s * 0.04 * sc, -s * 0.07 * sc, -s * 0.04 * sc, s * 0.07 * sc], true); g.fill(); g.restore();
    };
    if (tor) { glow(g, x, cy, s * 0.4, '#ff7a86', 0.8); g.fillStyle = '#ffd0d8'; g.beginPath(); g.arc(x, cy, s * 0.1, 0, TAU); g.fill(); g.strokeStyle = rgba('#ff7a86', 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.8, cy); g.lineTo(x, cy); g.stroke(); }
    else if (warheads > 1) {
      const split = clamp((u - 0.3) / 0.5, 0, 1);
      for (let i = 0; i < warheads; i++) { const k = (i - (warheads - 1) / 2) / max(1, (warheads - 1) / 2); missile(cx + s * 0.15 + split * s * 0.9, cy + k * split * s * 0.55, k * split * 0.28, 0.7); }
      if (split <= 0) missile(x, cy, 0, 1.2);
    } else missile(x, cy, 0, 1.4);
    target(g, cx + s * 1.2, cy, s * 0.25, '#ff7a86', 0.9);
    const comp = M.Data.Components, w = comp && comp.WEAPONS.find(z => (tech.grants || []).some(gr => z.grant === gr.kind + ':' + gr.id));
    caption(g, w ? w.dmg[1] + ' DAMAGE' + (warheads > 1 ? ' × ' + warheads : '') : '');
  };
  ART.bomb = function (g, cx, cy, s, col, t, tech) {
    planetAt(g, 'terran', cx, cy + s * 1.55, s * 1.4, 3, true);
    const u = (t * 0.45) % 1, y = cy - s * 1.3 + u * s * 1.5;
    if (u < 0.78) { g.save(); g.translate(cx, y); g.fillStyle = '#d9d2bd'; g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.ellipse(0, 0, s * 0.17, s * 0.3, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = rgba(col, 0.8); poly(g, [-s * 0.17, -s * 0.28, 0, -s * 0.45, s * 0.17, -s * 0.28], true); g.fill(); g.restore(); glow(g, cx, y, s * 0.35, col, 0.4); }
    else { const k = (u - 0.78) / 0.22; glow(g, cx, cy + s * 0.2, s * (0.5 + k * 1.4), '#ffd54f', 1 - k); ringPulse(g, cx, cy + s * 0.2, s * 0.2, s * 1.5, '#ff9440', t * 2, 2, 0.8); }
    const comp = M.Data.Components, w = comp && comp.WEAPONS.find(z => (tech.grants || []).some(gr => z.grant === gr.kind + ':' + gr.id));
    captionTop(g, w ? w.dmg[0] + '–' + w.dmg[1] + ' VS GROUND' : '');
  };
  // ship systems: one function, many devices (keyed by tech id)
  ART.fx = function (g, cx, cy, s, col, t, tech, o) {
    const id = tech.id.replace(/^[a-z]{2}-\d+-/, ''), ph = reduced() ? 0 : t;
    const ship = (x, y, sz, a, al) => shipAt(g, o, x === undefined ? cx : x, y === undefined ? cy : y, sz || s * 0.95, a || 0, al);
    let label = '';
    switch (id) {
      case 'cloaking-device': ship(cx, cy, s, 0, 0.35 + 0.35 * sin(ph * 2)); g.strokeStyle = rgba(col, 0.6); g.setLineDash([5, 5]); g.lineDashOffset = -ph * 10; g.beginPath(); g.ellipse(cx, cy, s * 0.8, s * 0.38, 0, 0, TAU); g.stroke(); g.setLineDash([]); label = 'CLOAKED'; break;
      case 'displacement-device': for (let i = -1; i <= 1; i++) ship(cx + i * s * 0.28 + sin(ph * 3 + i) * s * 0.05, cy + i * s * 0.1, s * 0.9, 0, i ? 0.3 : 0.95); label = '1 IN 3 MISS'; break;
      case 'stasis-field': ship(cx, cy, s * 0.9, 0); g.strokeStyle = rgba('#bfe4ff', 0.9); g.fillStyle = rgba('#bfe4ff', 0.12); g.lineWidth = 2; for (const k of [1, 0.7]) { poly(g, [cx + s * 1.1 * k, cy, cx + s * 0.55 * k, cy - s * 0.95 * k, cx - s * 0.55 * k, cy - s * 0.95 * k, cx - s * 1.1 * k, cy, cx - s * 0.55 * k, cy + s * 0.95 * k, cx + s * 0.55 * k, cy + s * 0.95 * k], true); g.fill(); g.stroke(); } label = 'FROZEN'; break;
      case 'repulsor-beam': ship(cx - s * 0.85, cy, s * 0.7, 0); for (let i = 0; i < 3; i++) { const u = (ph * 0.8 + i / 3) % 1; g.strokeStyle = rgba(col, 1 - u); g.lineWidth = 2; g.beginPath(); g.arc(cx - s * 0.5, cy, s * (0.2 + u * 1.2), -0.7, 0.7); g.stroke(); } ship(cx + s * (0.7 + 0.35 * ((ph * 0.8) % 1)), cy, s * 0.6, 0); label = 'PUSH 2 SQUARES'; break;
      case 'inertial-stabilizer': case 'inertial-nullifier': ship(cx, cy, s, 0); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 2; for (let i = 0; i < (id === 'inertial-nullifier' ? 3 : 2); i++) { g.beginPath(); g.arc(cx, cy - s * 0.9 - i * s * 0.12, s * (0.9 + i * 0.18), PI * 0.15, PI * 0.85, false); g.stroke(); poly(g, [cx - s * 0.9 - i * s * 0.1, cy - s * 0.65, cx - s * 1.05 - i * s * 0.1, cy - s * 0.7, cx - s * 0.97 - i * s * 0.1, cy - s * 0.55]); g.fill(); } label = id === 'inertial-nullifier' ? '+4 MANEUVER' : '+2 MANEUVER'; break;
      case 'energy-pulsar': case 'ionic-pulsar': ship(cx, cy, s * 0.6, 0); ringPulse(g, cx, cy, s * 0.2, s * 1.4, col, ph, id === 'ionic-pulsar' ? 4 : 3, 0.9); label = id === 'ionic-pulsar' ? '10 DAMAGE' : '5 DAMAGE'; break;
      case 'warp-dissipator': ship(cx - s * 0.6, cy, s * 0.7, 0); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(cx - s * 0.2, cy + (i - 1) * s * 0.15); for (let k = 1; k <= 8; k++) g.lineTo(cx - s * 0.2 + k * s * 0.13, cy + (i - 1) * s * 0.15 + (k % 2 ? -1 : 1) * s * 0.07 * (1 + sin(ph * 6 + k))); g.stroke(); } ship(cx + s * 1.0, cy, s * 0.6, 0, 0.55); label = 'SLOWS TARGET'; break;
      case 'black-hole-generator': for (let a = 0; a < 3; a++) { g.strokeStyle = rgba('#a98bff', 0.7); g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 40; k++) { const th = a * TAU / 3 + k * 0.17 + ph * 1.2, r = s * (0.08 + k * 0.026); g.lineTo(cx + cos(th) * r, cy + sin(th) * r * 0.7); } g.stroke(); } g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, s * 0.15, 0, TAU); g.fill(); glow(g, cx, cy, s * 1.3, '#a98bff', 0.35); label = 'DESTROYS SHIPS'; break;
      case 'sub-space-teleporter': ship(cx - s * 0.85, cy, s * 0.7, 0, 0.45); ship(cx + s * 0.85, cy - s * 0.1, s * 0.7, 0); g.strokeStyle = rgba(col, 0.8); g.setLineDash([3, 6]); g.lineDashOffset = -ph * 20; g.beginPath(); g.moveTo(cx - s * 0.45, cy); g.quadraticCurveTo(cx, cy - s * 0.8, cx + s * 0.45, cy - s * 0.1); g.stroke(); g.setLineDash([]); glow(g, cx + s * 0.85, cy - s * 0.1, s * 0.5, col, 0.4 + 0.3 * sin(ph * 6)); label = 'MOVES FIRST'; break;
      case 'automated-repair': case 'advanced-damage-control': ship(cx, cy, s * 0.9, 0); g.strokeStyle = rgba('#5fdc8f', 0.95); g.lineWidth = 5; g.beginPath(); g.moveTo(cx - s * 0.28, cy - s * 0.85); g.lineTo(cx + s * 0.28, cy - s * 0.85); g.moveTo(cx, cy - s * 1.13); g.lineTo(cx, cy - s * 0.57); g.stroke(); for (let i = 0; i < 6; i++) { const a = ph * 1.5 + i * TAU / 6; glow(g, cx + cos(a) * s * 0.8, cy + sin(a) * s * 0.4, s * 0.1, '#5fdc8f', 0.9); } label = id === 'automated-repair' ? 'REPAIRS 15%' : 'REPAIRS 30%'; break;
      case 'anti-missile-rockets': case 'zyro-shield': case 'lightning-shield': ship(cx - s * 0.5, cy, s * 0.8, 0); for (let i = 0; i < 3; i++) { const u = (ph * 0.5 + i * 0.33) % 1, x = cx + s * 1.5 - u * s * 1.7, y = cy + (i - 1) * s * 0.4; g.strokeStyle = rgba('#ff7a86', 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 0.2, y); g.stroke(); if (u > 0.62 && u < 0.78) { glow(g, x, y, s * 0.35, '#ffd54f', 1 - (u - 0.62) / 0.16); ringPulse(g, x, y, 0, s * 0.3, col, u * 4, 1, 0.9); } } label = id === 'lightning-shield' ? 'STOPS 100% OF MISSILES' : id === 'zyro-shield' ? 'STOPS 75% OF MISSILES' : 'STOPS 40% OF MISSILES'; break;
      case 'high-energy-focus': ship(cx - s * 0.95, cy, s * 0.75, 0); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 2; g.beginPath(); g.ellipse(cx - s * 0.2, cy, s * 0.2, s * 0.55, 0, 0, TAU); g.stroke(); g.fillStyle = rgba(col, 0.1); g.fill(); g.beginPath(); g.moveTo(cx - s * 0.2, cy - s * 0.5); g.lineTo(cx + s * 1.3, cy); g.lineTo(cx - s * 0.2, cy + s * 0.5); g.stroke(); glow(g, cx + s * 1.3, cy, s * 0.4, col, 0.8); label = '+3 BEAM RANGE'; break;
      case 'ion-stream-projector': case 'neutron-stream-projector': ship(cx - s * 0.95, cy, s * 0.75, 0); for (let i = 0; i < 24; i++) { const u = (ph * 0.7 + i / 24) % 1; glow(g, cx - s * 0.5 + u * s * 1.7, cy + sin(i * 2 + ph * 4) * s * 0.12 * u, s * 0.1, col, 1 - u * 0.4); } target(g, cx + s * 1.25, cy, s * 0.25, '#ff7a86', 0.9); label = id === 'ion-stream-projector' ? '20% OF HIT POINTS' : '40% OF HIT POINTS'; break;
      case 'technology-nullifier': ship(cx - s * 0.7, cy, s * 0.7, 0); g.strokeStyle = rgba('#ff7a86', 0.9); g.lineWidth = 3; g.beginPath(); g.arc(cx + s * 0.9, cy, s * 0.5, 0, TAU); g.moveTo(cx + s * 0.55, cy - s * 0.35); g.lineTo(cx + s * 1.25, cy + s * 0.35); g.stroke(); g.strokeStyle = rgba(col, 0.9); g.lineWidth = 1.5; g.strokeRect(cx + s * 0.7, cy - s * 0.2, s * 0.4, s * 0.4); label = 'ATTACK LEVEL −2 TO −6'; break;
      case 'oracle-interface': g.strokeStyle = rgba(col, 0.95); g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx - s * 1.1, cy); g.quadraticCurveTo(cx, cy - s * 0.9, cx + s * 1.1, cy); g.quadraticCurveTo(cx, cy + s * 0.9, cx - s * 1.1, cy); g.stroke(); g.fillStyle = rgba(col, 0.25); g.beginPath(); g.arc(cx + sin(ph) * s * 0.12, cy, s * 0.36, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#f3dca0'; g.beginPath(); g.arc(cx + sin(ph) * s * 0.12, cy, s * 0.14, 0, TAU); g.fill(); glow(g, cx, cy, s * 1.5, col, 0.25); label = 'ARMOR-PIERCING BEAMS'; break;
      case 'hyperspace-communications': g.strokeStyle = rgba(col, 0.9); g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy + s * 0.9); g.lineTo(cx, cy - s * 0.2); g.stroke(); g.beginPath(); g.arc(cx, cy - s * 0.3, s * 0.45, PI * 0.1, PI * 0.9); g.stroke(); ringPulse(g, cx, cy - s * 0.3, s * 0.5, s * 1.5, col, ph, 3, 0.8); label = 'REDIRECT FLEETS'; break;
      case 'battle-scanner': target(g, cx, cy, s * 0.55, col, 0.9); ship(cx, cy, s * 0.6, 0, 0.8); g.fillStyle = rgba(col, 0.8); for (let i = 0; i < 4; i++) g.fillRect(cx + s * 0.9, cy - s * 0.4 + i * s * 0.22, s * (0.7 - i * 0.12) * (0.6 + 0.4 * sin(ph * 2 + i)), s * 0.07); label = 'SHOWS ENEMY SPECS'; break;
      case 'reserve-fuel-tanks': ship(cx, cy, s, 0); g.fillStyle = rgba(col, 0.3); g.strokeStyle = col; g.lineWidth = 1.5; for (const sy of [-1, 1]) { chamfer(g, cx - s * 0.3, cy + sy * s * 0.5 - s * 0.1, s * 0.6, s * 0.2, s * 0.05); g.fill(); g.stroke(); } label = '+3 PARSECS'; break;
      case 'standard-colony-base': break;
      default: ship(cx, cy, s, 0); ringPulse(g, cx, cy, s * 0.4, s * 1.3, col, ph, 2, 0.7);
    }
    if (label) caption(g, label);
  };
  ART.gate = function (g, cx, cy, s, col, t) {
    const ph = reduced() ? 0 : t;
    for (let k = 0; k < 2; k++) {
      const r = s * (k ? 0.82 : 1.0), rot = PI / 8 + ph * (k ? -0.2 : 0.2), pts = [];
      for (let i = 0; i < 8; i++) pts.push(cx + cos(rot + i * TAU / 8) * r, cy + sin(rot + i * TAU / 8) * r);
      g.strokeStyle = rgba(k ? '#f3dca0' : col, 0.9); g.lineWidth = k ? 1.5 : 3; poly(g, pts, true); g.stroke();
    }
    for (let i = 0; i < 4; i++) { g.strokeStyle = rgba(col, 0.55); g.lineWidth = 1.5; g.beginPath(); for (let k = 0; k < 30; k++) { const th = i * PI / 2 + k * 0.2 - ph * 1.6, r = s * 0.7 * (1 - k / 32); g.lineTo(cx + cos(th) * r, cy + sin(th) * r); } g.stroke(); }
    glow(g, cx, cy, s * 0.9, col, 0.5);
  };
  ART.advanced = function (g, cx, cy, s, col, t, tech) {
    const n = max(1, (tech.level - 50) / 5);
    for (let i = 0; i < 10; i++) { const k = (i + 1) / 10, on = i < n, x = cx - s * 1.0 + i * s * 0.2, hh = s * (0.2 + k * 0.95); g.fillStyle = on ? rgba(col, 0.55 + 0.3 * sin(t * 2 + i)) : rgba(col, 0.12); g.fillRect(x, cy + s * 0.7 - hh, s * 0.15, hh); g.strokeStyle = rgba(col, 0.6); g.strokeRect(x, cy + s * 0.7 - hh, s * 0.15, hh); }
    caption(g, 'LEVEL +' + n * 5);
  };
  ART.generic = function (g, cx, cy, s, col, t) {
    for (let k = 0; k < 3; k++) { g.strokeStyle = rgba(col, 0.85 - k * 0.2); g.lineWidth = 1.6; const n = 5 + k, r = s * (1 - k * 0.27), rot = t * (k % 2 ? -0.3 : 0.3); poly(g, Array.from({ length: n }, (_, i) => [cx + cos(rot + i * TAU / n) * r, cy + sin(rot + i * TAU / n) * r]).flat(), true); g.stroke(); }
    glow(g, cx, cy, s * 1.3, col, 0.3);
  };

  function pickPainter(t) {
    const ty = t.type, id = t.id;
    if (ty === 'computer' || ty === 'ecm') return ty === 'ecm' ? ART.ecm : ART.chip;
    if (ty === 'scanner') return ART.radar;
    if (ty === 'industry') return ART.gear;
    if (ty === 'waste') return ART.plume;
    if (ty === 'armor') return ART.plates;
    if (ty === 'ground' || ty === 'invasion') return ART.trooper;
    if (ty === 'shield') return ART.bubble;
    if (ty === 'planetary') return /stargate|star-gates/.test(id) ? ART.gate : /interdictor/.test(id) ? ART.fx : ART.dome;
    if (ty === 'eco' || ty === 'terraform' || ty === 'environment') return ART.planet;
    if (ty === 'growth') return t.effects && t.effects.incPopCost ? ART.helix : ART.planet;
    if (ty === 'bio' || ty === 'defense') return ART.bio;
    if (ty === 'engine' || ty === 'fuel') return ART.engine;
    if (ty === 'beam') return ART.beam;
    if (ty === 'missile' || ty === 'torpedo') return ART.missile;
    if (ty === 'bomb') return ART.bomb;
    if (ty === 'advanced') return ART.advanced;
    if (ty === 'special') return ART.fx;
    return ART.generic;
  }
  // draw one tech into a w x h area. o = {col, race, banner, scan:true}
  function drawArt(g, w, hh, t, tech, o) {
    o = o || {};
    const f = tech ? tech.field : 0, col = o.col || FIELDS[f].col;
    let k = 1; try { k = clamp(round(g.getTransform().a * 2) / 2, 1, 3); } catch (e) { /* plain 1x */ }
    g.drawImage(backdrop(w, hh, col, k), 0, 0, w, hh);
    if (!tech) return;
    const s = min(w * 0.34, hh * 0.29), cy = hh * 0.43;
    LAB.x = w * 0.5; LAB.y = hh - max(13, hh * 0.085); LAB.top = max(24, hh * 0.17); LAB.size = max(9, min(hh * 0.06, w * 0.052));
    g.save(); g.beginPath(); g.rect(2, 2, w - 4, hh - 4); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    try { pickPainter(tech)(g, w * 0.5, cy, s, col, t, tech, o); } catch (e) { ART.generic(g, w * 0.5, cy, s, col, t, tech, o); if (!drawArt.warned) { drawArt.warned = true; console.warn('[techart]', e); } }
    g.restore();
    if (!reduced() && o.scan !== false) {                                  // holographic scan line + faint flicker band
      const u = (t * 0.22) % 1, y = u * hh;
      const gr = g.createLinearGradient(0, y - hh * 0.06, 0, y + hh * 0.02); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.16));
      g.fillStyle = gr; g.fillRect(0, y - hh * 0.06, w, hh * 0.08);
    }
    txt(g, FIELDS[f].name.toUpperCase() + ' · LEVEL ' + tech.level, max(8, w * 0.04), max(10, hh * 0.07), max(8, min(hh * 0.05, w * 0.042)), rgba(col, 0.7), 'left', 1.5);
  }
  UI.TechArt = { draw: drawArt };
  UI.TechInfo = { FIELDS, TYPES, typeInfo, capability, effectLines, partLines, forecast, etaText, ownedTechs, rpOf, techOf, humanize, syncTotal, bannerCss, makeBulb, glow, rgba };

  // ================================================================== the Tech screen
  UI.css('tech', `
    .tch { position:absolute; inset:0; display:flex; flex-direction:column; gap:.6rem; padding:.75rem 1.2rem .85rem; --fc:#62d8ff;
      background: radial-gradient(ellipse at 14% -8%, rgba(98,216,255,.09), transparent 52%), radial-gradient(ellipse at 100% 108%, rgba(169,139,255,.08), transparent 50%), var(--void); }
    .tch-head { flex:none; display:flex; align-items:flex-end; gap:1.1rem; padding-bottom:.5rem; border-bottom:1px solid var(--brass-line-3); }
    .tch-title { display:flex; align-items:baseline; gap:.8rem; font:400 1.8rem/1 var(--font-title); color:var(--brass-hi); letter-spacing:.03em; }
    .tch-title .ico { width:1.5rem; height:1.5rem; align-self:center; color:var(--cyan); }
    .tch-title small { font:400 .95rem var(--font-ui); color:var(--mist); letter-spacing:0; }
    .tch-total { margin-left:auto; display:flex; align-items:baseline; gap:.55rem; padding-bottom:.05rem; }
    .tch-total .k { font:400 .8rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--mist); }
    .tch-total b { font:400 2.1rem/1 var(--font-title); color:var(--cyan); font-variant-numeric:tabular-nums; text-shadow:0 0 16px rgba(98,216,255,.45); }
    .tch-total .u { font:400 1rem var(--font-display); color:var(--cyan); }
    .tch-head .btn { align-self:center; }
    .tch-tabs { flex:none; display:flex; gap:.4rem; }
    .tch-tab { --ch:.38rem; position:relative; isolation:isolate; flex:1 1 0; min-width:0; display:flex; align-items:center; gap:.5rem; padding:.45rem .75rem; border:0; cursor:var(--hand); color:var(--mist);
      font:400 1rem/1.1 var(--font-display); letter-spacing:.03em; white-space:nowrap; background:linear-gradient(180deg, var(--brass-lo), #2a3260); transition:filter .15s; }
    .tch-tab::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, #1a2358, #0e1540); transition:background .15s; }
    .tch-tab:hover { filter:brightness(1.15); color:var(--ivory); }
    .tch-tab .ico { width:1.25rem; height:1.25rem; flex:none; color:var(--tc, var(--brass)); }
    .tch-tab .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; text-align:left; }
    .tch-tab .tl { font:600 .8rem var(--font-ui); color:var(--fog); font-variant-numeric:tabular-nums; }
    .tch-tab .kb { font:500 .7rem var(--font-ui); color:var(--fog); opacity:1; }
    .tch-tab.on { color:var(--ivory); background:linear-gradient(180deg, var(--tc, var(--brass-hi)), var(--brass-lo)); }
    .tch-tab.on::before { background:linear-gradient(180deg, color-mix(in srgb, var(--tc, #d6b36a) 34%, #0e1540), #0e1540 85%); }
    .tch-tab.on .tl { color:var(--brass-hi); }
    .tch-tab.ovw { flex:0 0 auto; }
    .tch-body { flex:1 1 auto; min-height:0; display:grid; grid-template-columns:minmax(0, 11fr) minmax(0, 14fr); gap:.85rem; }
    .tch-body.ovw { grid-template-columns:minmax(0, 1fr); }
    .tch-body.ovw .tch-left, .tch-body.ovw .tch-right { display:none; }
    .tch-body:not(.ovw) .tch-ovw { display:none; }
    .tch-ovw { min-height:0; display:flex; flex-direction:column; }
    .tch-left, .tch-right { min-height:0; display:flex; flex-direction:column; gap:.75rem; }
    .tch-right { overflow-y:auto; overflow-x:hidden; }
    .tch-listp { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
    .tch-listp .panel-h .ico { width:1.2rem; height:1.2rem; color:var(--fc); }
    .tch-list { flex:1 1 auto; min-height:0; overflow-y:auto; margin-right:-.35rem; padding-right:.25rem; }
    .tch-trow { position:relative; display:flex; align-items:center; gap:.55rem; padding:.3rem .55rem; border-left:3px solid transparent; cursor:var(--hand); font-size:1rem; line-height:1.2; }
    .tch-trow + .tch-trow { border-top:1px solid rgba(255,255,255,.04); }
    .tch-trow .ico { width:1.1rem; height:1.1rem; flex:none; color:var(--fc); opacity:.9; }
    .tch-trow .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tch-trow .lv { flex:none; color:var(--fog); font-size:.8rem; font-variant-numeric:tabular-nums; }
    .tch-trow:hover { background:rgba(98,216,255,.07); }
    .tch-trow.sel { background:rgba(214,179,106,.16); border-left-color:var(--brass); }
    .tch-trow.proj { background:linear-gradient(90deg, rgba(98,216,255,.24) var(--p, 0%), rgba(98,216,255,.06) var(--p, 0%)); }
    .tch-trow.proj .nm { color:var(--cyan); }
    .tch-trow.proj.sel { box-shadow:inset 0 0 0 1px rgba(98,216,255,.5); }
    .tch-trow.proj .lv { color:var(--cyan); }
    .tch-sep { margin:.35rem .55rem .15rem; font:400 .8rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--fog); border-top:1px solid var(--brass-line-1); padding-top:.3rem; }
    .tch-empty { padding:.8rem .6rem; color:var(--mist); font-size:.95rem; line-height:1.4; }
    /* one row the panel's height: the picture's own height attribute used to size an auto row, so the canvas grew to twice the panel and its
       motif (drawn at 43 % of the canvas) sat below the visible edge, leaving an empty grid */
    .tch-detail { flex:0 0 clamp(14.2rem, 34%, 21rem); display:grid; grid-template-columns:clamp(13.4rem, 38%, 19rem) minmax(0, 1fr); grid-template-rows:minmax(0, 1fr); gap:.85rem; padding:.6rem; min-height:0; }
    .tch-pic { width:100%; height:100%; min-height:0; display:block; background:#040715; box-shadow:0 0 0 1px var(--brass-line-3); }
    .tch-dtxt { min-width:0; min-height:0; overflow-y:auto; padding-right:.2rem; }
    .tch-dn { font:400 1.3rem/1.12 var(--font-title); color:var(--brass-hi); }
    .tch-dm { display:flex; flex-wrap:wrap; gap:.3rem; margin:.3rem 0 .45rem; }
    .tch-dd { margin:0 0 .4rem; color:var(--ivory); font-size:.95rem; line-height:1.36; }
    .tch-fx { list-style:none; margin:0; padding:0; font-size:.85rem; line-height:1.3; }
    .tch-fx li { display:flex; gap:.6rem; padding:.08rem 0; border-top:1px solid rgba(255,255,255,.05); }
    .tch-fx .k { flex:none; min-width:7.2rem; color:var(--mist); } .tch-fx .v { color:var(--ivory); min-width:0; }
    .tch-sl { flex:none; padding:.6rem .8rem .55rem; }
    .tch-sl .panel-h .ico { width:1.2rem; height:1.2rem; color:var(--cyan); }
    .tch-sl .panel-h .btn { margin-left:auto; }
    .tch-sl .panel-h .sub + .btn { margin-left:.6rem; }
    .tch-colh { display:grid; grid-template-columns:minmax(0, 1fr) 4.9rem 3.5rem; gap:.4rem; padding:0 .5rem .15rem; font:400 .75rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--fog); }
    .tch-colh span:nth-child(n+2) { text-align:center; }
    .tch-row { position:relative; padding:.32rem .5rem .38rem; border-left:3px solid transparent; }
    .tch-row + .tch-row { border-top:1px solid rgba(255,255,255,.05); }
    .tch-row.sel { background:linear-gradient(90deg, color-mix(in srgb, var(--rc) 17%, transparent), transparent 85%); border-left-color:var(--rc); }
    .tch-r1 { display:grid; grid-template-columns:minmax(0, 1fr) 4.9rem 3.5rem; gap:.4rem; align-items:center; }
    .tch-row .slider { grid-template-columns:8.9rem 1.45rem minmax(3rem, 1fr) 1.45rem 2.7rem 1.45rem; margin:0; gap:.3rem; }
    .tch-row .slider .s-label { cursor:var(--hand); white-space:nowrap; font-size:.95rem; transition:color .12s; }
    .tch-row .slider .s-label:hover { color:var(--brass-hi); }
    .tch-row .slider .s-label .ico { width:1.1rem; height:1.1rem; }
    .tch-row .slider.locked .s-label { color:var(--rose); }
    .tch-row .slider.locked .s-fill { filter:saturate(.35) brightness(.85); }
    .tch-row .slider .s-val { font-size:1rem; }
    .tch-row .slider .s-track { height:1rem; }
    .tch-lvl { text-align:center; font:400 1.4rem/1 var(--font-title); color:var(--brass-hi); font-variant-numeric:tabular-nums; cursor:default; }
    .tch-lvl.max { font-size:1rem; color:var(--gold); letter-spacing:.08em; }
    .tch-bulb { display:flex; align-items:center; justify-content:center; gap:.25rem; cursor:default; transition:opacity .2s; }
    .tch-bulb svg { width:1.05rem; height:1.45rem; flex:none; overflow:visible; }
    .tch-bulb .gl { fill:rgba(255,255,255,.05); } .tch-bulb .ol { fill:none; stroke:var(--brass-lo); stroke-width:1.5; stroke-linejoin:round; }
    .tch-bulb .bs { fill:none; stroke:var(--brass-lo); stroke-width:1.7; stroke-linecap:square; }
    .tch-bulb.lit .ol { stroke:var(--brass-hi); } .tch-bulb.lit svg { filter:drop-shadow(0 0 4px rgba(255,214,120,.65)); }
    .tch-bulb.off { opacity:.45; }
    .tch-bulb .pc { min-width:2.1rem; text-align:right; font:600 .85rem var(--font-ui); font-variant-numeric:tabular-nums; color:var(--ivory); }
    .tch-r2 { display:flex; align-items:center; gap:.8rem; margin:.14rem 0 0 .12rem; min-height:1.3rem; font-size:.8rem; color:var(--mist); }
    .tch-cap { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:default; }
    .tch-cap b { color:var(--ivory); font-weight:500; } .tch-cap i { font-style:normal; color:var(--fog); margin:0 .35rem; }
    .tch-mini { flex:none; display:flex; align-items:center; gap:.45rem; font-variant-numeric:tabular-nums; }
    .tch-mini .bar { width:5.2rem; height:.34rem; } .tch-mini .bar > i { transition:none; }
    .tch-mini .btn { padding:.05em .75em; font-size:.8rem; }
    .tch-sl .foot { display:flex; align-items:center; gap:.7rem; margin-top:.45rem; padding-top:.45rem; border-top:1px solid var(--brass-line-1); color:var(--fog); font-size:.8rem; }
    .tch-proj { flex:1 0 auto; min-height:9.5rem; padding:.55rem .85rem .6rem; }   /* never clip: the column scrolls if the content is taller than the screen */
    .tch-proj .ph { display:flex; align-items:center; gap:.55rem; font:400 .8rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--mist); }
    .tch-proj .ph .ico { width:1.15rem; height:1.15rem; color:var(--fc); } .tch-proj .ph .btn { margin-left:auto; }
    .tch-proj .pn { margin:.1rem 0 0; font:400 1.5rem/1.1 var(--font-title); color:var(--cyan); }
    .tch-proj .pn small { margin-left:.6rem; font:400 .9rem var(--font-ui); color:var(--mist); }
    .tch-proj .pb { margin:.35rem 0 .2rem; } .tch-proj .pb .bar { height:1.05rem; }
    .tch-proj .pb .bar > span { font-size:.8rem; }
    .tch-proj .kv { grid-template-columns:auto 1fr; gap:.1rem 1.1rem; margin-top:.35rem; font-size:.95rem; line-height:1.25; }
    .tch-proj .kv > :nth-child(even) { text-align:left; color:var(--ivory); }
    .tch-proj .warn { margin-top:.5rem; padding:.3rem .6rem; border-left:3px solid var(--rose); background:rgba(255,92,106,.09); font-size:.85rem; }
    .tch-proj .none { margin:.55rem 0 .4rem; color:var(--ivory); font-size:1rem; line-height:1.4; }
    .tch-xtra { margin-top:.4rem; padding-top:.3rem; border-top:1px solid var(--brass-line-2); }
    .tch-xtra .xh { margin:.35rem 0 .2rem; font:400 .8rem var(--font-display); letter-spacing:.1em; text-transform:uppercase; color:var(--fog); }
    .tch-xtra .tch-fx .k { display:none; } .tch-xtra .tch-fx { display:grid; grid-template-columns:1fr 1fr; gap:0 1rem; }
    .tch-xtra .xh { font-size:.85rem; color:var(--mist); margin:.2rem 0 .1rem; } .tch-xtra .tch-nx { padding:.06rem .4rem; }
    .tch-nx { display:flex; align-items:center; gap:.55rem; padding:.2rem .4rem; cursor:var(--hand); font-size:.9rem; }
    .tch-nx:hover { background:rgba(98,216,255,.08); }
    .tch-nx .ico { width:1rem; height:1rem; flex:none; color:var(--fc); } .tch-nx .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .tch-nx .co { flex:none; color:var(--mist); font-size:.8rem; font-variant-numeric:tabular-nums; }
    /* the UI scale is proportional to the window (58 rem tall at 16:9), so 'spare height' only exists in taller-than-3:2 windows */
    @media (min-aspect-ratio:3/2) { .tch-xtra { display:none; } .tch-proj .pn { font-size:1.3rem; } }
  `);

  const st = { el: null, E: null, field: 0, view: 'field', sel: null, from: 'galaxy', rows: [], tabs: [], listKey: '', detailKey: '', picDirty: true, pace: {}, tree: null, ready: false };

  function closeTech() { const to = st.from && UI.Screens.has(st.from) ? st.from : 'galaxy'; UI.Screens.go(to); }
  function toastFail(r) { if (r && !r.ok) UI.toast(r.msg || 'That did not work', 'bad'); return r && r.ok; }

  // ---- orders ---------------------------------------------------------------------------------------------------------------------------------
  function orderSlider(f, v) { toastFail(G.order({ t: 'researchSlider', field: f, value: v })); }
  function orderLock(f, locked) { toastFail(G.order({ t: 'researchLock', field: f, locked: !!locked })); }
  function nudge(f, d) {
    const E = G.player(); if (!E || E.research.lock[f]) return;
    orderSlider(f, clamp(E.research.slider[f] + d, 0, 100));
  }
  function equalise() {
    const E = G.player(), rs = E.research, lk = rs.lock;
    if (!lk.some(Boolean)) { toastFail(G.order({ t: 'researchEqualize' })); return; }       // the original's fixed 16/17/17/16/17/17
    const free = []; let fixed = 0;                                                         // with locks: spread the unlocked share evenly
    for (let i = 0; i < 6; i++) { if (lk[i]) fixed += rs.slider[i]; else free.push(i); }
    if (!free.length) return;
    const rest = 100 - fixed, vals = rs.slider.slice();
    free.forEach((i, k) => { vals[i] = floor(rest / free.length) + (k < rest % free.length ? 1 : 0); });
    toastFail(G.order({ t: 'researchSet', values: vals }));
  }
  async function chooseProject(f) {
    const E = G.player(), R = RS(), S = G.S, list = R.choices(E, f);
    if (!list.length) { UI.toast('Nothing is left to research in ' + FIELDS[f].name, 'warn'); return; }
    const choices = list.map(l => ({ level: l, cost: R.projectCost(S, E, f, l), tech: R.techAt(f, l) }));
    const level = await UI.TechScenes.choose({ empire: E.id, field: f, choices, manual: true, current: E.research.project[f] || 0 });
    if (level) { toastFail(G.order({ t: 'researchPick', field: f, level })); }
    refresh();
  }

  // ---- building the screen --------------------------------------------------------------------------------------------------------------------
  function buildRow(f) {
    const F = FIELDS[f];
    const sl = UI.slider({ label: h('span.nm', F.name), icon: F.icon, color: F.col, min: 0, max: 100, step: 2, value: 0, fmt: v => v + '%', lockable: true,
      onChange: v => { orderSlider(f, v); if (st.field !== f || st.view !== 'field') selectField(f); },
      onLock: lk => { orderLock(f, lk); selectField(f); } });
    const lab = sl.querySelector('.s-label');
    UI.setTip(lab, '<b>' + F.name + '</b><br>Click the name to lock or unlock this slider. Locked sliders keep their share when you move the others.');
    lab.addEventListener('click', () => { const E = G.player(); const nl = !E.research.lock[f]; sl.api.setLocked(nl); orderLock(f, nl); selectField(f); });
    sl.querySelector('.s-track').addEventListener('wheel', e => { e.preventDefault(); nudge(f, e.deltaY < 0 ? 2 : -2); }, { passive: false });
    const bulb = makeBulb();
    UI.setTip(bulb, '<b>Breakthrough chance</b><br>The real probability that this project is finished this turn, from the research already invested plus this turn\'s funding.');
    const lvl = h('div.tch-lvl'); UI.setTip(lvl, '<b>' + F.name + ' level</b><br>The tech level of the field: it drives miniaturisation, hull space and worker output.');
    const cap = h('div.tch-cap'), mini = h('div.tch-mini');
    const row = h('div.tch-row', { style: { '--rc': F.col }, dataset: { f }, onclick: e => { if (!e.target.closest('.slider, .btn')) selectField(f); } },
      h('div.tch-r1', sl, bulb, lvl), h('div.tch-r2', cap, mini));
    return { f, row, sl, bulb, lvl, cap, mini, capKey: '', miniKey: '' };
  }

  function build(el) {
    st.el = el;
    const root = h('div.tch');
    // header
    st.title = h('small'); st.totalNum = h('b'); st.eqBtn = UI.button('Equalise', equalise, { kbd: '=', tip: 'Spread research evenly over all six fields (unlocked ones when some are locked)' });
    // phones: the total sits in the allocation panel's foot (the app bar carries the title, the foot's hint goes), so six fields fit the screen without scrolling
    const phone = !!(UI.Phone && UI.Phone.active()), total = h('div.tch-total', h('span.k', 'Total research'), st.totalNum, h('span.u', 'RP'));
    const head = h('div.tch-head', h('div.tch-title', UI.icon('research'), 'Research', st.title), phone ? null : total,
      UI.button('OK', closeTech, { primary: true, big: true, kbd: 'Space' }));
    // tabs
    st.tabsEl = h('nav.tch-tabs');
    FIELDS.forEach((F, i) => {
      const tl = h('span.tl'), b = h('button.tch-tab.ch', { type: 'button', style: { '--tc': F.col }, onclick: () => { UI.sfx('click'); selectField(i); } }, UI.icon(F.icon), h('span.nm', F.name), tl, h('span.kb', String(i + 1)));
      UI.setTip(b, '<b>' + F.name + '</b> · key ' + (i + 1));
      st.tabs.push({ b, tl }); st.tabsEl.appendChild(b);
    });
    st.ovwTab = h('button.tch-tab.ch.ovw', { type: 'button', style: { '--tc': '#d6b36a' }, onclick: () => { UI.sfx('click'); setView('overview'); } }, UI.icon('map'), h('span.nm', 'Overview'), h('span.kb', '7'));
    UI.setTip(st.ovwTab, '<b>Tech overview</b><br>Every technology of the six fields by tier: researched, available, locked, or not in your tree.');
    st.tabsEl.appendChild(st.ovwTab);
    // left column: researched list + picture/description
    st.listHead = h('div.panel-h'); st.list = h('div.tch-list');
    const listPanel = h('div.panel.tch-listp', st.listHead, st.list);
    st.pic = h('canvas.tch-pic'); st.dtxt = h('div.tch-dtxt');
    const detail = h('div.panel.tch-detail', st.pic, st.dtxt);
    const left = h('div.tch-left', listPanel, detail);
    // right column: six sliders + project card
    st.rows = FIELDS.map((F, i) => buildRow(i));
    st.slTitle = h('span', 'Research allocation'); st.slSub = h('span.sub');
    const slPanel = h('div.panel.tch-sl', h('div.panel-h', UI.icon('tech'), st.slTitle, st.slSub),
      h('div.tch-colh', h('span', 'Field · research share (2% steps)'), h('span', 'Chance'), h('span', 'Level')), st.rows.map(r => r.row),
      h('div.foot', phone ? total : h('span', 'Click a name to lock it · wheel or +/− to nudge · = equalises'), h('span.grow'), st.eqBtn));
    st.proj = h('div.panel.tch-proj');
    const right = h('div.tch-right', slPanel, st.proj);
    st.ovw = h('div.tch-ovw');
    st.body = h('div.tch-body', left, right, st.ovw);
    root.appendChild(head); root.appendChild(st.tabsEl); root.appendChild(st.body);
    el.appendChild(root);
    el.addEventListener('contextmenu', e => { if (e.target && e.target.tagName === 'INPUT') return; e.preventDefault(); closeTech(); });
    st.list.addEventListener('keydown', e => e.stopPropagation());
    st.ready = true;
  }

  // ---- selection / views -----------------------------------------------------------------------------------------------------------------------
  function selectField(f) {
    f = clamp(f | 0, 0, 5);
    const changed = f !== st.field || st.view !== 'field';
    st.field = f; st.view = 'field';
    if (changed) { st.sel = null; st.listKey = ''; st.detailKey = ''; st.picDirty = true; }
    refresh();
  }
  function setView(v) {
    if (v === 'overview' && !(UI.TechTree && UI.TechTree.create)) { UI.toast('The tech overview is not available yet', 'warn'); return; }
    st.view = v; st.picDirty = true; refresh();
  }
  function selectTech(id) { st.sel = id; st.picDirty = true; st.listKey = ''; st.detailKey = ''; refresh(); }

  // ---- rendering --------------------------------------------------------------------------------------------------------------------------------
  function renderHead(E) {
    const S = G.S;
    st.title.textContent = 'Year ' + M.Data.Config.displayYear(S);
    st.totalNum.textContent = fmt(E.research.total | 0);
    st.slSub.textContent = ' ';
  }
  function renderTabs(E) {
    const rs = E.research, R = RS();
    st.tabs.forEach((t, i) => {
      t.b.classList.toggle('on', st.view === 'field' && i === st.field);
      const max = rs.tl[i] >= 99 && !R.choices(E, i).length;
      t.tl.textContent = max ? 'MAX' : 'L' + rs.tl[i];
    });
    st.ovwTab.classList.toggle('on', st.view === 'overview');
  }
  function renderRows(E) {
    const rs = E.research, R = RS();
    let lockedSum = 0; rs.lock.forEach((l, i) => { if (l) lockedSum += rs.slider[i]; });
    let top = 0;
    for (let f = 0; f < 6; f++) {
      const r = st.rows[f], v = rs.slider[f], proj = rs.project[f] ? techOf(f, rs.project[f]) : null, hasProj = !!proj;
      if (r.sl.api.get() !== v) r.sl.api.set(v);
      r.sl.api.setLocked(!!rs.lock[f]);
      r.sl.api.setMax(100 - (lockedSum - (rs.lock[f] ? v : 0)));
      r.bulb.set(hasProj ? R.breakthroughChance(E, f) : 0, hasProj);
      const done = rs.tl[f] >= 99 && !R.choices(E, f).length;
      r.lvl.textContent = done ? 'MAX' : rs.tl[f]; r.lvl.classList.toggle('max', done);
      const cap = capability(E, f), capKey = cap.items.map(x => x.join(':')).join('|');
      if (capKey !== r.capKey) {
        r.capKey = capKey;
        UI.clear(r.cap);
        cap.items.forEach((it, i) => { if (i) r.cap.appendChild(h('i', '·')); r.cap.appendChild(doc.createTextNode(it[0] + ' ')); r.cap.appendChild(h('b', String(it[1]))); });
        UI.setTip(r.cap, '<b>' + FIELDS[f].name + '</b><br>' + cap.tip.join('<br>'));
      }
      const frac = hasProj && rs.cost[f] ? clamp(rs.invest[f] / rs.cost[f], 0, 1) : 0;
      const nCh = R.choices(E, f).length;
      const miniKey = hasProj ? 'p' + proj.id + ':' + round(frac * 1000) + ':' + rs.cost[f] : nCh ? 'c' + nCh : 'x';
      if (miniKey !== r.miniKey) {
        r.miniKey = miniKey; UI.clear(r.mini);
        if (hasProj) { const b = UI.bar(frac, { color: FIELDS[f].col }); r.mini.appendChild(h('span', { style: { color: 'var(--mist)' } }, proj.name.length > 22 ? proj.name.slice(0, 21) + '…' : proj.name)); r.mini.appendChild(b); r.mini.appendChild(h('span', round(frac * 100) + '%')); UI.setTip(r.mini, '<b>' + proj.name + '</b><br>' + fmt(rs.invest[f]) + ' of ' + fmt(rs.cost[f]) + ' RP invested'); }
        else if (nCh) { r.mini.appendChild(UI.button('Choose project', () => chooseProject(f), { small: true, tip: 'Pick the next technology to research in ' + FIELDS[f].name })); UI.setTip(r.mini, null); }
        else r.mini.appendChild(h('span.dim', 'field complete'));
      }
      r.row.classList.toggle('sel', st.view === 'field' && f === st.field);
      top += v;
    }
    st.slSub.textContent = top === 100 ? '' : 'sum ' + top + '%';
  }
  function renderList(E) {
    const f = st.field, F = FIELDS[f], rs = E.research, R = RS(), owned = ownedTechs(E, f), proj = rs.project[f] ? techOf(f, rs.project[f]) : null;
    if (!st.sel || !(owned.some(t => t.id === st.sel) || (proj && proj.id === st.sel) || (TD().byId[st.sel] && TD().byId[st.sel].field === f))) st.sel = proj ? proj.id : (owned.length ? owned[owned.length - 1].id : null);
    const key = f + '|' + owned.length + '|' + (proj ? proj.id + ':' + round(100 * rs.invest[f] / max(1, rs.cost[f])) : '') + '|' + st.sel;
    st.listHead.style.setProperty('--fc', F.col);
    UI.mount(st.listHead, UI.icon(F.icon), h('span', F.name + ' technology'), h('span.sub', owned.length + ' researched'));
    if (key === st.listKey) return;
    st.listKey = key;
    const top = st.list.scrollTop, first = !st.list.firstChild || st.list.dataset.f !== String(f);
    UI.clear(st.list); st.list.dataset.f = String(f);
    owned.forEach(t => st.list.appendChild(trow(t, false, 0)));
    if (proj) {
      st.list.appendChild(h('div.tch-sep', 'Current project'));
      st.list.appendChild(trow(proj, true, rs.cost[f] ? clamp(rs.invest[f] / rs.cost[f], 0, 1) : 0));
    } else {
      const n = R.choices(E, f).length;
      st.list.appendChild(h('div.tch-sep', 'Current project'));
      st.list.appendChild(h('div.tch-empty', n ? 'Nothing is being researched in this field. ' + n + (n === 1 ? ' technology is' : ' technologies are') + ' available.' : 'Every technology of this field is known.'));
    }
    const sel = st.list.querySelector('.tch-trow.sel');
    if (first) { if (sel) sel.scrollIntoView({ block: 'nearest' }); } else st.list.scrollTop = top;
  }
  function trow(t, isProj, frac) {
    const ti = typeInfo(t.type);
    const r = h('div.tch-trow' + (isProj ? '.proj' : '') + (st.sel === t.id ? '.sel' : ''), { style: isProj ? { '--p': round(frac * 100) + '%' } : null, onclick: () => selectTech(t.id), tip: '<b>' + t.name + '</b><br>' + t.desc },
      UI.icon(ti.ico), h('span.nm', t.name), h('span.lv', isProj ? round(frac * 100) + '%' : (t.level > 1 ? 'L' + t.level : '')));
    return r;
  }
  function renderDetail(E) {
    const t = st.sel ? TD().byId[st.sel] : null, rs = E.research, f = st.field;
    const dkey = (t ? t.id + ':' + (rs.completed[t.field].indexOf(t.level) >= 0 ? 'd' : rs.project[t.field] === t.level ? 'p' : 'a') + ':' + (t.field === f ? '' : '?') : '-') + '|' + G.S.settings.diffIdx;
    if (dkey === st.detailKey) return;
    st.detailKey = dkey;
    UI.clear(st.dtxt);
    if (!t) { st.dtxt.appendChild(h('div.tch-empty', 'Select a technology to see its picture and description.')); return; }
    const owned = rs.completed[t.field].indexOf(t.level) >= 0, isProj = rs.project[t.field] === t.level && !owned;
    const state = owned ? UI.chip('Researched', 'ok') : isProj ? UI.chip('Under way', 'cy') : UI.chip('Available');
    const cost = !owned ? RS().projectCost(G.S, E, t.field, t.level) : 0;
    st.dtxt.appendChild(h('div.tch-dn', t.name));
    st.dtxt.appendChild(h('div.tch-dm', UI.chip(typeInfo(t.type).label, 'cy'), UI.chip('Level ' + t.level), state, cost ? UI.chip(fmt(cost) + ' RP') : null));
    st.dtxt.appendChild(h('p.tch-dd', t.desc));
    const fx = effectLines(t);
    if (fx.length) st.dtxt.appendChild(h('ul.tch-fx', fx.map(l => h('li', h('span.k', l.k), h('span.v', String(l.v))))));
    void f;
  }
  function renderProject(E) {
    const f = st.field, F = FIELDS[f], rs = E.research, R = RS(), S = G.S, proj = rs.project[f] ? techOf(f, rs.project[f]) : null, choices = R.choices(E, f);
    st.proj.style.setProperty('--fc', F.col);
    UI.clear(st.proj);
    const canSwap = proj && rs.invest[f] <= 1 && choices.length > 1;
    const xtra = () => xtraBlocks(E, f);
    const head = h('div.ph', UI.icon(F.icon), h('span', F.name + ' · current research'),
      !proj && choices.length ? UI.button('Choose project', () => chooseProject(f), { primary: true, small: true, kbd: 'C' }) : canSwap ? UI.button('Change', () => chooseProject(f), { small: true, tip: 'Nothing has been invested yet, so you can still pick another technology' }) : null);
    st.proj.appendChild(head);
    if (!proj) {
      const done = !choices.length;
      st.proj.appendChild(h('div.none', done ? 'Every technology in ' + F.name + ' is known. Further research would only raise the tech level.' : 'No technology is being researched in ' + F.name + '. ' + choices.length + (choices.length === 1 ? ' is' : ' are') + ' available to choose from.'));
      if (rs.invest[f] > 1) st.proj.appendChild(h('div.warn', 'Without a project the ' + fmt(rs.invest[f]) + ' RP already invested here shrink by 10% each turn.'));
      if (!done && rs.slider[f] === 0) st.proj.appendChild(h('div.dim.small', 'This field receives no research share yet.'));
      st.proj.appendChild(xtra());
      return;
    }
    const cost = rs.cost[f], inv = rs.invest[f], frac = cost ? clamp(inv / cost, 0, 1) : 0, fc = forecast(E, f, inv, cost), chance = R.breakthroughChance(E, f), rp = rpOf(E, f);
    st.proj.appendChild(h('div.pn', proj.name, h('small', 'Level ' + proj.level)));
    const bar = UI.bar(frac, { color: F.col, thick: true, label: fmt(inv) + ' / ' + fmt(cost) + ' RP' });
    st.proj.appendChild(h('div.pb', bar));
    const kv = h('div.kv',
      h('span', 'Funding'), h('span', h('b.t-cyan', '+' + fmt(rp) + ' RP'), ' per turn (' + rs.slider[f] + '% of ' + fmt(rs.total | 0) + ')' + (inv > 1 && rp > 0 ? ', plus ' + fmt(min(floor(inv * 3 / 20), 2 * rp)) + ' interest' : '')),
      h('span', 'Breakthrough'), h('span', chance > 0 ? h('b', (chance < 0.01 ? '<1' : round(chance * 100)) + '%') : '0%', ' chance this turn', inv > cost ? '' : h('span.dim', ' · ' + fmt(max(0, cost - inv)) + ' RP to go before it can happen')),
      h('span', 'Estimate'), h('span', fc ? (fc.never ? h('span.t-rose', 'no research share assigned') : etaText(fc)) : '—'),
      h('span', 'Available next'), h('span', Math.max(0, choices.length - 1) + (choices.length - 1 === 1 ? ' technology' : ' technologies') + ' in this field'));
    st.proj.appendChild(kv);
    if (rs.slider[f] === 0 || (rs.total | 0) === 0) st.proj.appendChild(h('div.warn', (rs.total | 0) === 0 ? 'No research points are produced. Give your colonies a Tech share to start researching.' : 'Unfunded: the ' + fmt(inv) + ' RP invested here shrink by 10% each turn.'));
    st.proj.appendChild(xtra());
    void S;
  }
  // taller windows: what the field gives you, and the cheapest technologies available next (click one to see it in the overview)
  function xtraBlocks(E, f) {
    const F = FIELDS[f], R = RS(), cap = capability(E, f), proj = E.research.project[f], list = R.choices(E, f).filter(l => l !== proj).slice(0, 2);
    return h('div.tch-xtra',
      h('div.xh', 'What ' + F.name + ' gives you'), h('ul.tch-fx', cap.tip.map(s => h('li', h('span.v', s)))),
      list.length ? h('div.xh', 'Available next') : null,
      list.map(l => { const t = techOf(f, l); return h('div.tch-nx', { onclick: () => { setView('overview'); if (st.tree) st.tree.select(f, l); }, tip: t ? '<b>' + t.name + '</b><br>' + t.desc : '' }, UI.icon(typeInfo(t ? t.type : 'special').ico), h('span.nm', t ? t.name : 'Level ' + l), h('span.co', fmt(R.projectCost(G.S, E, f, l)) + ' RP')); }));
  }
  function drawPic(t) {
    const E = st.E || G.player(); if (!E || !st.pic.isConnected) return;
    const f = UI.fitCanvas(st.pic, { maxDpr: PQ().dpr });
    if (f.w < 20 || f.h < 20) return;
    const tech = st.sel ? TD().byId[st.sel] : null;
    drawArt(f.ctx, f.w, f.h, t, tech, { col: FIELDS[st.field].col, race: E.race, banner: bannerCss(E), hull: 2 });
    st.picDirty = false;
  }
  function renderOverview(E) {
    if (!st.tree && UI.TechTree && UI.TechTree.create) {
      st.tree = UI.TechTree.create({ onPick: (f, level) => { if (toastFail(G.order({ t: 'researchPick', field: f, level }))) refresh(); } });
      st.ovw.appendChild(st.tree.el);
    }
    if (st.tree) st.tree.refresh();
  }

  function refresh() {
    if (!st.ready || !G.S) return;
    const S = G.S, E = G.player(); if (!E) return;
    st.E = E; syncTotal(S);
    st.el.firstChild.style.setProperty('--fc', FIELDS[st.field].col);
    st.body.classList.toggle('ovw', st.view === 'overview');
    renderHead(E); renderTabs(E); renderRows(E);
    if (st.view === 'field') { renderList(E); renderDetail(E); renderProject(E); } else renderOverview(E);
  }

  UI.Screens.register('tech', {
    create(el) { build(el); },
    enter(params) {
      if (!G.S) { UI.Screens.go(UI.Screens.has('menu') ? 'menu' : 'galaxy'); return; }
      params = params || {};
      st.from = params.from || (UI.Screens.current && UI.Screens.current.prev) || 'galaxy';
      if (st.from === 'tech') st.from = 'galaxy';
      if (params.field !== undefined) { st.field = clamp(params.field | 0, 0, 5); st.sel = null; }
      st.view = params.view === 'overview' ? 'overview' : 'field';
      st.listKey = ''; st.detailKey = ''; st.picDirty = true;
      refresh();
    },
    leave() { UI.hideTip(); },
    update(dt, t) {
      if (!st.ready || st.view !== 'field') return;
      const fps = reduced() ? 1 : ((PQ().animFps || 60) > 59 ? 40 : 24);
      const due = UI.pace(st.pace, fps, dt);
      if (!due && !st.picDirty) return;
      drawPic(t);
    },
    resize() { st.picDirty = true; },
  });
  M.Bus.on('state', () => { if (UI.Screens.current && UI.Screens.current.id === 'tech') refresh(); });
  M.Bus.on('game:new', () => { st.sel = null; st.field = 0; st.listKey = ''; st.detailKey = ''; if (st.tree) { st.tree.el.remove(); st.tree = null; } });
  M.Bus.on('game:loaded', () => { st.sel = null; st.listKey = ''; st.detailKey = ''; if (st.tree) { st.tree.el.remove(); st.tree = null; } });

  // hotkeys (research/06 App. A): 1-6 field, Space/Enter/Esc = OK, '=' equalise, +/- nudge the selected slider (Ctrl = 10), L lock, C choose project
  (function bindKeys() {
    const scr = { screen: 'tech' };
    for (let i = 0; i < 6; i++) UI.bindKey(String(i + 1), () => selectField(i), scr);
    UI.bindKey('7', () => setView('overview'), scr);
    UI.bindKey('/', () => { if (st.view !== 'overview') setView('overview'); if (st.tree && st.tree.focusSearch) st.tree.focusSearch(); }, scr);
    const onSlider = () => { const a = doc.activeElement; return !!(a && a.classList && a.classList.contains('s-track')); };   // arrows belong to a focused slider
    const next = () => { if (st.view === 'overview') selectField(0); else if (st.field === 5) setView('overview'); else selectField(st.field + 1); };
    const prev = () => { if (st.view === 'overview') selectField(5); else selectField((st.field + 5) % 6); };
    UI.bindKey('ArrowRight', () => { if (!onSlider()) next(); }, scr);
    UI.bindKey('ArrowLeft', () => { if (!onSlider()) prev(); }, scr);
    UI.bindKey('=', () => equalise(), scr);
    UI.bindKey('+', () => nudge(st.field, 2), scr);
    UI.bindKey('-', () => nudge(st.field, -2), scr);
    UI.bindKey('ctrl++', () => nudge(st.field, 10), scr);
    UI.bindKey('ctrl+-', () => nudge(st.field, -10), scr);
    UI.bindKey('l', () => { const E = G.player(); if (st.view === 'field' && E) { const nl = !E.research.lock[st.field]; orderLock(st.field, nl); } }, scr);
    UI.bindKey('c', () => { if (st.view === 'field') { const E = G.player(); if (E && !E.research.project[st.field]) chooseProject(st.field); } }, scr);
    UI.bindKey('ArrowDown', () => { if (!onSlider()) stepSel(1); }, scr);
    UI.bindKey('ArrowUp', () => { if (!onSlider()) stepSel(-1); }, scr);
    const ok = e => { const a = doc.activeElement; if (a && a.tagName === 'BUTTON' && e && e.key === 'Enter') { a.click(); return; } closeTech(); };
    UI.bindKey('Space', ok, scr); UI.bindKey('Enter', ok, scr);
    UI.bindKey('Escape', () => { const a = doc.activeElement; if (a && a.tagName === 'INPUT' && a.value) { a.value = ''; a.dispatchEvent(new Event('input')); return; } if (a && a.blur) a.blur(); closeTech(); }, scr);
  })();
  function stepSel(d) {
    if (st.view !== 'field') return;
    const E = G.player(), owned = ownedTechs(E, st.field), proj = E.research.project[st.field] ? techOf(st.field, E.research.project[st.field]) : null;
    const ids = owned.map(t => t.id).concat(proj ? [proj.id] : []); if (!ids.length) return;
    const i = ids.indexOf(st.sel); selectTech(ids[clamp((i < 0 ? ids.length - 1 : i + d), 0, ids.length - 1)]);
    const sel = st.list.querySelector('.tch-trow.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  UI.Tech = { open(params) { if (UI.Screens.has('tech')) UI.Screens.go('tech', Object.assign({ from: UI.Screens.current ? UI.Screens.current.id : 'galaxy' }, params)); } };
  UI.Tech._phone = { st, selectField, setView, refresh };                                   // js/ui/phone-research.js (the phone layout's segments)

  // ================================================================== "original" restyle — brown leather family (research/ui-ref B §0, C §0)
  // Tech, Races, Report and the tech-tree screens: warm terracotta/leather body, bevelled frames, dark-brown wells, orange/amber headings,
  // cream ink, dark-red selection bar. Colours are tokens re-mapped locally so the shared kit (panels, buttons, sliders, bars) follows.
  const LEATHER = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n' x='0' y='0'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .18 0 0 0 0 .1 0 0 0 0 .06 0 0 0 .55 -.12'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")`;
  const bx = s => ['.tch', '.rx', '.ttp'].map(x => ':root:root ' + x + ' ' + s).join(',');
  // raise specificity by one :root so these win over the per-screen sheets regardless of load order
  const up = css => css.replace(/(^|})(s*)([^{}@]+){/g, (m, a, ws, sel) => a + ws + sel.split(',').map(x => { x = x.trim(); return x.startsWith(':root') ? x : ':root ' + x; }).join(', ') + ' {');
  UI.css('orig-brown', up(`
    .tch, .rx, .ttp {
      --o-fill:#66584a; --o-hi:#857561; --o-lo:#2b241e; --o-well:var(--well-leather, #181411); --o-well2:var(--well-leather-2, #13100d); --o-row:#66584a; --o-sel:#5c3810;
      --o-head:var(--head-orange, #ff9420); --o-amber:#e3b327; --o-mint:#7fd8c0; --o-green:#40d040; --o-cream:#f0dcc0; --o-tan:#d9bf9c; --o-dim:#e0c9a6;
      --void:#54463a; --night:#45392f; --deep:#372d25; --glass:rgba(58,44,33,.94); --glass-hi:rgba(98,78,60,.96); --steel:#66584a; --steel-hi:#93866f;
      --brass:#e3b327; --brass-hi:#ffd36a; --brass-lo:#7a5a36; --ivory:var(--o-cream); --mist:var(--o-tan); --fog:var(--o-dim);
      --cyan:#7fe0cc; --leaf:#6fe070; --ember:#ff9a3c; --gold:#ffd54f; --violet:#c9a8ff; --rose:#ff9a88; --azure:#8fc0ff;
      --bg-0:#372d25; --bg-1:#45392f; --bg-2:#54463a; --bg-3:#54463a; --bg-4:#66584a;
      --line-0:#372d25; --line-1:#66584a; --line-2:#93866f; --line-3:#c9ae88;
      --ink-0:var(--o-cream); --ink-1:var(--o-tan); --ink-2:var(--o-dim); --ink-3:#d0b890;
      --bev-hi:#857561; --bev-mid:#7a604b; --bev-lo:#372d25; --face-1:#8e745d; --face-2:#54463a; --plate-1:#54463a; --plate-2:#372d25; --well:var(--well-leather-2, #13100d); --well-2:var(--well-leather, #181411); --title:var(--head-orange, #ff9420); --title-lo:#8a4a08;
      --accent:var(--o-amber); --accent-dim:rgba(227,179,39,.16); --accent-line:#b08a2e; --on-accent:#2a1405;
      color:var(--o-cream);
    }
    .tch, .rx, .ttp { background:${LEATHER}, radial-gradient(120% 90% at 50% 0%, #93745d 0%, #66584a 45%, #645446 100%); }
    .rx::before { display:none; }
    /* outer frame: bevelled lighter-brown rim */
    .tch::after, .rx::after, .ttp::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:50; box-shadow:inset 0 0 0 .22rem #66584a, inset .22rem .22rem 0 .22rem #857561, inset -.22rem -.22rem 0 .22rem #3f3028; opacity:.9; }
    .tch, .ttp { padding-left:1.5rem; padding-right:1.5rem; }
    /* headings: orange slab with a hard 1px drop shadow */
    .tch-title, .rx-title, .ttp-head h1 { color:var(--title-hi); text-shadow:var(--title-shadow); letter-spacing:.06em; text-transform:uppercase; font-family:var(--font-display); }
    .tch-title small, .rx-sub, .tch-total .k { color:var(--o-tan); text-shadow:0 1px 0 rgba(0,0,0,.35); }
    .tch-total b, .tch-total .u { color:var(--o-green); text-shadow:0 1px 0 #10300f; }
    .tch-head, .rx-head, .ttp-head { border-bottom:0; box-shadow:0 1px 0 #372d25, 0 2px 0 #93866f; }
    .tch .panel-h, .rx .panel-h, .ttp .panel-h { font-weight:600; }
    /* panels: flat bevel instead of the chamfered hairline */
    ${bx('.panel')}, ${bx('.rx-box')}, ${bx('.rc-slot')}, ${bx('.rc-sec')}, ${bx('.rc-void')} { clip-path:none; background:#66584a; box-shadow:0 0 0 1px #2b241e, inset 1px 1px 0 var(--spec, #857561), inset -1px -1px 0 #4a382a; }
    ${bx('.panel::before')}, ${bx('.rx-box::before')}, ${bx('.rc-slot::before')}, ${bx('.rc-sec::before')}, ${bx('.rc-void::before')} { clip-path:none; inset:.2rem; background:linear-gradient(180deg,#594b40,#4d4138); box-shadow:inset 1px 1px 0 #2b241e, inset -1px -1px 0 #93866f; }
    ${bx('.panel::after')}, ${bx('.rc-slot.sel::after')} { display:none; }
    .rx .rx-sheet { background:transparent; box-shadow:none; }
    .rx .rx-sheet::before, .rx .rx-sheet::after { display:none; }
    /* section headings sit on a rule, in amber/orange slab caps */
    ${bx('.rx-bt')} { color:var(--o-head); font-weight:600; text-shadow:0 1px 0 #2f1a0c; border-bottom-color:#2b241e; box-shadow:0 1px 0 #93866f; }
    ${bx('.tch-proj .ph')}, ${bx('.tch-sep')}, ${bx('.tch-xtra .xh')}, ${bx('.tch-colh')} { color:var(--o-tan); font-weight:600; text-shadow:0 1px 0 #2f1a0c; border-bottom-color:#2b241e; box-shadow:0 1px 0 #93866f; }   /* column and section heads: the ledgers' cream caps; orange is the box-title tier only */
        ${bx('.rx-bt .r')} { color:var(--o-tan); text-shadow:none; }
    ${bx('.rx-bt .ico')}, ${bx('.panel-h .ico')} { color:var(--o-amber); }
    /* tabs: embossed tiles, selected = field colour slab */
    .tch-tab { background:linear-gradient(180deg,#857561,#4a382a); color:var(--o-cream); text-shadow:0 1px 0 rgba(0,0,0,.5); }
    .tch-tab::before { background:linear-gradient(180deg,#7a604b,#54463a); box-shadow:inset 1px 1px 0 rgba(255,235,205,.25); }
    .tch-tab:hover { filter:brightness(1.12); }
    .tch-tab.on { background:linear-gradient(180deg,#e8c88e,var(--tc,#e3b327) 40%,#4a382a); color:#fff; }
    .tch-tab.on::before { background:linear-gradient(180deg, color-mix(in srgb, var(--tc,#e3b327) 55%, #4a382a), color-mix(in srgb, var(--tc,#e3b327) 28%, #372d25)); }
    .tch-tab .tl, .tch-tab .kb { color:var(--o-tan); } .tch-tab.on .tl { color:#fff; }
    /* lists: dark wells, ALL-CAPS rows, dark-red selection with white text */
    .tch-list, .tt-scroll { background:var(--well-leather, #181411); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #93866f; padding:.15rem; }
    .tch-trow { color:var(--o-tan); text-transform:uppercase; letter-spacing:.03em; font-size:.9rem; border-left-width:0; }
    .tch-trow + .tch-trow { border-top:0; }
    .tch-trow:hover { background:#4d4138; color:#fff; }
    .tch-trow.sel, .tt-chip.sel { background:var(--o-sel); color:#fff; box-shadow:inset 0 0 0 1px var(--sel-line, #ffc860); border-left-color:transparent; }
    .tch-trow.sel .lv, .tch-trow.sel .nm { color:#fff; }
    .tch-trow.proj { background:linear-gradient(90deg, rgba(64,208,64,.32) var(--p,0%), rgba(64,208,64,.08) var(--p,0%)); } .tch-trow.proj .nm, .tch-trow.proj .lv { color:var(--o-green); }
    .tch-row { border-left-width:0; } .tch-row + .tch-row { border-top:1px solid #4a382a; box-shadow:0 1px 0 rgba(179,150,119,.35) inset; }
    .tch-row.sel { background:linear-gradient(90deg, rgba(92,56,16,.6), transparent 90%); }
    .tch-cap b, .tch-proj .kv > :nth-child(even), .tch-dd { color:var(--o-cream); }
    .tch-pic, .tt-art { background:#0b0907; box-shadow:0 0 0 1px #2b241e, 0 0 0 .2rem #66584a, 0 0 0 calc(.2rem + 1px) #3f3028, inset 0 0 0 1px #000; margin:.2rem; }
    .tch-pic { width:calc(100% - .4rem); height:calc(100% - .4rem); }
    .tch-dn, .tt-d .tn, .tch-proj .pn { color:var(--o-amber); text-shadow:0 1px 0 #2f1a0c; font-family:var(--font-display); letter-spacing:.04em; text-transform:uppercase; }
    .tch-lvl { color:var(--o-cream); font-size:1.15rem; } .tch-lvl.max { color:var(--o-amber); }
    .tch-total .u { color:var(--o-cream); } .tch-tab.on .kb { color:#fff; }
    .tch-bulb .ol, .tch-bulb .bs { stroke:#2b241e; } .tch-bulb.lit .ol { stroke:#ffe9a0; }
    .tch-proj .warn { background:rgba(98,11,3,.45); border-left-color:#ff4a3a; }
    /* tech tree chips */
    .tt-h { background:#372d25; border-bottom-color:var(--fc); } .tt-h b { color:var(--o-head); text-shadow:0 1px 0 #2f1a0c; }
    .tt-tier { background:#372d25; color:var(--o-tan); border-top-color:#4d4138; } .tt-cell { border-top-color:#4d4138; }
    .tt-chip { background:#54463a; color:var(--o-tan); box-shadow:inset 1px 1px 0 rgba(255,235,205,.18), inset -1px -1px 0 rgba(0,0,0,.35); text-transform:uppercase; letter-spacing:.02em; }
    .tt-chip:hover { background:#66584a; }
    .tt-chip.done { background:#4a5a36; } .tt-chip.avail { background:#7a5a36; } .tt-chip.avail .nm { color:#fff; } .tt-chip.proj { background:#2f5a2c; box-shadow:inset 0 0 0 1px #40d040; animation:none; }
    .tt-chip.queued .nm, .tt-chip.locked .nm { color:var(--o-tan); } .tt-chip.hit { box-shadow:inset 0 0 0 1px var(--title-hi, #ffd36a); background:#7a5a36; }
    .tt-leg, .tt-count { color:var(--o-tan); }
    /* races */
    .rc-slot { --e1:#93866f; --e2:#66584a; }
    .rc-slot .rc-acc { width:.22rem; box-shadow:none; }
    .rc-slot.sel { filter:brightness(1.1); box-shadow:0 0 0 2px var(--title-hi, #ffd36a), 0 0 0 3px #2b241e; }
    .rc-pic, .rp-pic { clip-path:none; background:#2b241e; box-shadow:0 0 0 1px #000, 0 0 0 .2rem var(--c, #857561), 0 0 0 calc(.2rem + 1px) #2b241e; margin:.25rem; }
    .rc-pic canvas, .rp-pic canvas { left:0; top:0; width:100%; height:100%; background:#000; }
    .rc-treaty { color:var(--o-cream); text-transform:uppercase; text-shadow:0 1px 0 rgba(0,0,0,.45); }
    .rc-leader { color:var(--o-tan); }
    .rc-bar { box-shadow:inset 0 0 0 1px #000, 0 0 0 1px #93866f, 0 0 0 2px #2b241e; }
    .rc-void { background:#54463a; color:var(--o-dim); } .rc-void::before { background:repeating-linear-gradient(135deg, rgba(255,235,205,.04) 0 .5rem, transparent .5rem 1rem), #45392f; }
    .rc-void .big { color:var(--o-head); text-shadow:0 1px 0 #2f1a0c; }
    .rc-sec .big { color:var(--o-green); text-shadow:0 1px 0 #10300f; }
    .rp-age { background:var(--well-leather, #181411); box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #93866f; border:0; }
    .rp-traits .p { color:var(--o-amber); } .rp-traits .o { color:var(--o-cream); }
    ${bx('.rx-plate')} { clip-path:none; border:1px solid #2b241e; box-shadow:inset 1px 1px 0 var(--spec, rgba(255,245,225,.22)), inset -1px -1px 0 rgba(0,0,0,.35); text-transform:uppercase; }
    .rx-foot .rx-prompt { color:var(--o-tan); } .rx-foot .rx-prompt b { color:var(--o-amber); }
    /* buttons inside brown screens: grey-brown bevel tiles with slab caps; primary = orange pillow */
    /* sliders + bars: recessed trough, bevelled thumb */
    ${bx('.slider .s-label')} { color:var(--o-cream); text-transform:uppercase; letter-spacing:.03em; } ${bx('.slider .s-val')} { color:var(--o-green); }
    ${bx('.kv > :nth-child(odd)')} { color:var(--o-tan); } ${bx('.kv > :nth-child(even)')} { color:var(--o-cream); }
    ${bx('.rx-plate')} { background:linear-gradient(180deg,#45392f,#2b241e); color:var(--o-cream); border-left:.45rem solid var(--c, #e3b327); text-shadow:0 1px 0 #000; }
    .rx-foot .rx-prompt, .rc-trade, .rc-spy .rd .nx, .rp-t .lv { color:var(--o-tan); } .rc-trade.on { color:var(--o-amber); } .rp-t .lv { font-size:.85rem; } .rc-spy .rd { font-size:.95rem; }
    /* legibility pass: min ~12px, no tiny caps */
    .tch-tab .tl, .tch-trow .lv, .tch-sep { font-size:.85rem; } .tch-tab .kb, .tch-colh { font-size:.8rem; }
    .tch-proj .pb .bar > span { font-size:.85rem; } .tch-trow { font-size:.95rem; } .tch-tab .tl { color:var(--o-tan); }
    .tt-count, .tch-total .k, .tch-title small { color:var(--o-cream); }
  `));

  // ================================================================== the scientist scenes (research/06 §5.13)
  UI.css('techscene', `
    .tsc { position:absolute; inset:0; overflow:hidden; background:#02040e; user-select:none; transition:opacity .26s ease, filter .26s ease; }
    .tsc.out { opacity:0; filter:brightness(1.6) blur(3px); }
    .tsc-cv { position:absolute; inset:0; width:100%; height:100%; }
    .tsc-cap { position:absolute; display:flex; align-items:flex-end; padding:0 .35rem .55rem; pointer-events:none; color:#ff6b74;
      font:400 clamp(1.2rem, 3.1vh, 2.3rem)/1.14 var(--font-title); letter-spacing:.015em; text-shadow:0 2px 14px #000, 0 0 3px #000, 0 0 26px rgba(255,80,96,.35); }
    .tsc-cap.gold { color:var(--brass-hi); text-shadow:0 2px 14px #000, 0 0 3px #000, 0 0 26px rgba(243,220,160,.35); }
    .tsc-cap.cyan { color:#9be9ff; text-shadow:0 2px 14px #000, 0 0 3px #000, 0 0 26px rgba(98,216,255,.4); }
    .tsc-cap .rest { visibility:hidden; }
    .tsc-panel { position:absolute; display:flex; flex-direction:column; justify-content:flex-start; }
    .tsc-box { position:relative; isolation:isolate; max-height:100%; display:flex; flex-direction:column; padding:.6rem .75rem .75rem; --ch:.7rem; clip-path:var(--poly);
      background:linear-gradient(135deg, var(--brass), var(--brass-lo) 45%, var(--brass)); }
    .tsc-box::before { content:""; position:absolute; inset:1px; z-index:-1; clip-path:var(--poly); background:linear-gradient(180deg, rgba(14,21,56,.9), rgba(5,8,26,.93)); backdrop-filter:blur(3px); }
    .tsc-box-h { flex:none; display:flex; align-items:center; gap:.6rem; padding:.05rem .15rem .5rem; margin-bottom:.4rem; border-bottom:1px solid var(--brass-line-3);
      font:400 1.3rem/1.1 var(--font-display); color:var(--brass-hi); letter-spacing:.03em; }
    .tsc-box-h .ico { width:1.35rem; height:1.35rem; color:var(--fc); }
    .tsc-box-h small { margin-left:auto; font:400 .8rem var(--font-ui); color:var(--mist); letter-spacing:0; }
    .tsc-list { flex:0 1 auto; min-height:0; overflow-y:auto; }
    .tsc-item { display:flex; align-items:center; gap:.6rem; padding:.36rem .65rem; cursor:var(--hand); border-left:3px solid transparent; font-size:1.1rem; line-height:1.2; transition:background .08s; }
    .tsc-item + .tsc-item { border-top:1px solid rgba(255,255,255,.045); }
    .tsc-item .ico { width:1.15rem; height:1.15rem; flex:none; color:var(--fc); opacity:.9; }
    .tsc-item .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .tsc-item .co { flex:none; color:var(--fog); font-size:.85rem; font-variant-numeric:tabular-nums; }
    .tsc-item.on { background:linear-gradient(90deg, rgba(214,179,106,.28), rgba(214,179,106,.08)); border-left-color:var(--brass); color:var(--brass-hi); }
    .tsc-item.on .co { color:var(--leaf); }
    .tsc-info { flex:none; margin-top:.55rem; padding:.55rem .7rem .6rem; min-height:7.6rem; background:rgba(0,0,0,.4); border:1px solid var(--brass-line-2); }
    .tsc-info .tn { display:flex; align-items:baseline; gap:.6rem; margin-bottom:.2rem; }
    .tsc-info .tn b { font:400 1.15rem var(--font-title); color:var(--brass-hi); } .tsc-info .cost { margin-left:auto; font:600 1.2rem var(--font-ui); color:var(--leaf); font-variant-numeric:tabular-nums; white-space:nowrap; }
    .tsc-info p { margin:0 0 .3rem; font-size:.95rem; line-height:1.36; color:var(--ivory); }
    .tsc-info .eta { font-size:.85rem; color:var(--mist); }
    .tsc-acts { flex:none; display:flex; align-items:center; gap:.6rem; margin-top:.6rem; }
    .tsc-acts .grow { flex:1; }
    .tsc-acts .note { font-size:.8rem; color:var(--fog); }
    .tsc-art { flex:none; width:100%; height:12rem; display:block; background:#040715; box-shadow:0 0 0 1px var(--brass-line-3); margin-bottom:.6rem; }
    .tsc-card-b { flex:1 1 auto; min-height:0; overflow-y:auto; padding-right:.2rem; }
    .tsc-tn { font:400 clamp(1.5rem, 3.1vh, 2.2rem)/1.08 var(--font-title); color:var(--brass-hi); text-shadow:0 0 18px rgba(243,220,160,.28); }
    .tsc-chips { display:flex; flex-wrap:wrap; gap:.3rem; margin:.4rem 0 .5rem; }
    .tsc-td { margin:0 0 .55rem; font-size:1.05rem; line-height:1.4; color:var(--ivory); }
    .tsc-td .rest { visibility:hidden; }
    .tsc-hint { position:absolute; left:0; right:0; bottom:.9rem; text-align:center; pointer-events:none; color:rgba(190,205,255,.8); font-size:.85rem; letter-spacing:.05em; text-shadow:0 1px 6px #000; }
    .tsc-hint kbd { font:600 .8rem var(--font-ui); padding:.05em .5em; margin:0 .15em; border:1px solid var(--brass-line-3); color:var(--brass-hi); background:rgba(0,0,0,.45); }
    .tsc-fu p { margin:0 0 .6rem; line-height:1.45; } .tsc-fu .dim { font-size:.85rem; }
  `);

  // "original" restyle (research/ui-ref B 7a / C 7a): red caption over the lab, grey bevelled choice box with a green title bar, black list wells,
  // dark-red selected row, light-grey description, mint tech name and yellow-cream effect line on a darkened strip.
  UI.css('techscene-orig', `
    .tsc-cap { color:#ec3a34; font-family:var(--font-display); font-weight:700; letter-spacing:.03em;
      text-shadow:-1px -1px 0 #200404, 1px -1px 0 #200404, -1px 1px 0 #200404, 1px 1px 0 #200404, var(--shadow-2); }
    .tsc-cap.gold { color:#f8e080; text-shadow:-1px -1px 0 #1c1604, 1px -1px 0 #1c1604, -1px 1px 0 #1c1604, 1px 1px 0 #1c1604, var(--shadow-2); }
    .tsc-cap.cyan { color:#50e8b0; text-shadow:-1px -1px 0 #04201a, 1px -1px 0 #04201a, -1px 1px 0 #04201a, 1px 1px 0 #04201a, var(--shadow-2); text-transform:uppercase; }
    .tsc-box { clip-path:none; background:linear-gradient(135deg,#b4b4bc,#6a6a70 25%,#505058 70%,#24242a); box-shadow:0 0 0 1px #000, var(--shadow-2); padding:.55rem .6rem .65rem; }
    .tsc-box::before { clip-path:none; inset:3px; background:linear-gradient(180deg,#6e6e76,#585860); backdrop-filter:none; box-shadow:inset 1px 1px 0 #2a2a30, inset -1px -1px 0 #a8a8b0; }
    .tsc-box-h { margin:.1rem 0 .45rem; padding:.28rem .7rem .3rem; border-bottom:0; font:700 1.1rem/1.1 var(--font-display); letter-spacing:.06em; text-transform:uppercase; color:#68f068; text-shadow:0 1px 0 #0a1c0a;
      background:linear-gradient(180deg,#34503a,#223a26); box-shadow:inset 1px 1px 0 #567a5c, inset -1px -1px 0 #0c1a0e, 0 0 0 1px #000; }
    .tsc-box-h .ico { color:#68f068; } .tsc-box-h small { color:#a8d8a8; }
    .tsc-list { background:#141414; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #8a8a92; padding:.15rem; }
    .tsc-item { color:#f0f0f0; text-transform:uppercase; letter-spacing:.03em; font-size:1rem; border-left-width:0; }
    .tsc-item + .tsc-item { border-top:0; }
    .tsc-item:hover { background:#2c2c32; }
    .tsc-item.on { background:#701808; color:#fff; box-shadow:inset 0 0 0 1px #b8432c; }
    .tsc-item.on .co { color:#68f068; } .tsc-item .co { color:#a0a0a8; }
    .tsc-info { background:#141414; border:0; box-shadow:inset 1px 1px 0 #000, inset -1px -1px 0 #8a8a92; }
    .tsc-info .tn b { color:#f0f0f0; text-transform:uppercase; letter-spacing:.04em; font-family:var(--font-display); } .tsc-info .cost { color:#68f068; }
    .tsc-info p { color:#c8c8c8; } .tsc-info .eta { color:#a8a8b0; }
    .tsc-art { box-shadow:0 0 0 1px #000, 0 0 0 .2rem #6a6a70, 0 0 0 calc(.2rem + 1px) #000; margin:.2rem .2rem .7rem; }
    .tsc-tn { color:#50e8b0; font-family:var(--font-display); text-transform:uppercase; letter-spacing:.06em; text-shadow:0 1px 0 #04201a; }
    .tsc-td { color:#f8e080; text-shadow:0 1px 0 #1c1604; }
    .tsc-hint kbd { border-color:#8a8a92; color:#f0f0f0; }
  `);

  const SC = { run: null, pending: 0, chain: Promise.resolve(), prev: null, prevParams: null, prevTrack: null, prevSnap: null, musicOn: false, cv: null, root: null };

  function Typer(el) { this.el = el; this.s = ''; this.n = 0; this.acc = 0; this.busy = false; }
  Typer.prototype.paint = function () { const a = this.s.slice(0, this.n), b = this.s.slice(this.n); this.el.textContent = ''; this.el.appendChild(doc.createTextNode(a)); if (b) this.el.appendChild(h('span.rest', b)); };
  Typer.prototype.set = function (s, instant) { this.s = String(s); this.n = instant ? this.s.length : 0; this.acc = 0; this.busy = this.n < this.s.length; this.paint(); };
  Typer.prototype.step = function (dt, cps) { if (!this.busy) return 0; this.acc += dt * cps; const k = floor(this.acc); if (!k) return 0; this.acc -= k; this.n = min(this.s.length, this.n + k); if (this.n >= this.s.length) this.busy = false; this.paint(); return k; };
  Typer.prototype.finish = function () { if (!this.busy) return; this.n = this.s.length; this.busy = false; this.paint(); };

  function buildScene(el) {
    SC.cv = h('canvas.tsc-cv'); SC.cap = h('div.tsc-cap'); SC.panel = h('div.tsc-panel'); SC.hint = h('div.tsc-hint');
    SC.root = h('div.tsc', SC.cv, SC.cap, SC.panel, SC.hint);
    el.appendChild(SC.root);
    SC.root.addEventListener('contextmenu', e => { e.preventDefault(); act('skip'); });
  }

  // ---- the lab backdrop ------------------------------------------------------------------------------------------------------------------------
  function paintLab(R) {
    const f = UI.fitCanvas(SC.cv, { maxDpr: PQ().dpr }), g = f.ctx, w = f.w, hh = f.h;
    if (w < 40 || hh < 40) return;
    let rects = null;
    const Sc = M.Gfx && M.Gfx.Scenes, WA = M.Gfx && M.Gfx.WorldArt;
    if (WA && WA.draw(g, WA.race(R.race, 'scientist'), 0, 0, w, hh, { fx: 0.3, fy: 0.5, exposure: WA.raceExposure ? WA.raceExposure(R.race, 'scientist') : 1 })) {          // photoreal scientist scene; its right 40% is left clear for the panel
      glow(g, w * 0.34, hh * 0.78, hh * 0.55, R.F.col, 0.07 + 0.03 * Math.sin(R.t * 1.4));              // research-field tint on the console
      rects = { panel: { x: w * 0.6, y: hh * 0.12, w: w * 0.37, h: hh * 0.7 } };
    } else if (Sc && Sc.lab && Sc.lab.draw && !R.labFailed) {
      try { rects = Sc.lab.draw(g, w, hh, R.rm ? 1.2 : R.t, { race: R.race, field: R.F.lab, mood: R.mood, talking: R.talking, color: R.banner, planet: R.planet }); }
      catch (e) { R.labFailed = true; console.warn('[techscene] lab scene failed, using the plain backdrop', e); }
    }
    if (!rects) {                                               // plain backdrop: indigo gradient + the scientist portrait when available
      const gr = g.createLinearGradient(0, 0, w, hh); gr.addColorStop(0, '#0a1030'); gr.addColorStop(1, '#02040e'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      glow(g, w * 0.25, hh * 0.5, hh * 0.7, R.F.col, 0.18);
      const P = M.Gfx && M.Gfx.Portraits;
      try { if (P && P.draw) { const ph = hh * 0.72, pw = ph * 0.8; P.draw(g, R.race, w * 0.04, hh - ph, pw, ph, { t: R.t, mood: R.mood, talking: R.talking, color: R.banner }); } } catch (e) { /* no portrait */ }
      rects = { panel: { x: w * 0.6, y: hh * 0.12, w: w * 0.37, h: hh * 0.7 } };
    }
    layoutScene(rects.panel, w, hh);
  }
  function layoutScene(p, w, hh) {
    if (M.Phone && M.Phone.active() && hh > w) p = { x: w * 0.04, y: hh * 0.4, w: w * 0.92, h: hh * 0.56 };   // phones in portrait: the choice panel spans the lower half
    const key = round(p.x) + ',' + round(p.y) + ',' + round(p.w) + ',' + round(p.h) + ',' + round(w) + 'x' + round(hh);
    if (key === SC.layKey) return;
    SC.layKey = key;
    const pn = SC.panel.style, cp = SC.cap.style;
    pn.left = p.x + 'px'; pn.top = p.y + 'px'; pn.width = p.w + 'px'; pn.height = p.h + 'px';
    cp.left = p.x + 'px'; cp.width = p.w + 'px'; cp.top = max(4, p.y - hh * 0.115) + 'px'; cp.height = hh * 0.115 + 'px';
  }
  function paintArt(R) {
    if (!R.art || !R.art.isConnected) return;
    const f = UI.fitCanvas(R.art, { maxDpr: PQ().dpr });
    if (f.w < 20 || f.h < 20) return;
    drawArt(f.ctx, f.w, f.h, R.t, R.tech, { col: R.F.col, race: R.E.race, banner: R.banner, hull: 2 });
  }

  // ---- run lifecycle ------------------------------------------------------------------------------------------------------------------------------
  function typeTick(n) { const R = SC.run; if (!R) return; R.tickAcc = (R.tickAcc || 0) + n; if (R.tickAcc >= 5 && R.t - (R.lastTick || -1) > 0.09) { UI.sfx('typing', { vol: 0.35 }); R.lastTick = R.t; R.tickAcc = 0; } }
  const CAPTION = {
    research: (E, F) => E.name + ' scientists achieve a ' + F.name + ' breakthrough',
    spy: (E, F) => E.name + ' spies steal a ' + F.name + ' secret',
    loot: (E, F) => E.name + ' explorers uncover ' + F.name + ' secrets of the Ancients',
    orion: (E, F) => 'The vaults of Orion yield ' + F.name + ' secrets to the ' + E.name,
    trade: (E, F) => E.name + ' diplomats secure ' + F.name + ' technology in a trade',
  };

  function startRun(spec) {
    const S = G.S, it = spec.it || {}, E = S.empires[it.empire !== undefined ? it.empire : S.playerId] || G.player(), f = clamp(it.field | 0, 0, 5), F = FIELDS[f];
    const home = S.planets[E.capital];
    const R = SC.run = { kind: spec.kind, spec, it, E, f, F, t: 0, acc: 0, dirty: true, rm: reduced(), race: E.race, banner: bannerCss(E), mood: 'neutral', talking: false, talkTail: 0, finishing: false, hi: 0,
      planet: home ? { look: home.type && home.type !== 'none' ? home.type : 'terran', seed: (home.id | 0) + 5, rings: false } : null, art: null, tech: null, capT: new Typer(SC.cap), descT: null };
    try { const WA = M.Gfx && M.Gfx.WorldArt; if (WA) WA.get(WA.race(E.race, 'scientist')); } catch (e) { /* optional */ }
    SC.layKey = ''; SC.root.classList.remove('out'); UI.clear(SC.panel); UI.clear(SC.cap); UI.hideTip();
    SC.root.style.setProperty('--fc', F.col);
    if (spec.kind === 'choose') buildChoose(R); else buildBreak(R);
    /* the lab scene plays over the current underscore (no cue switch for a 20-second scene) */
    R.capT.set(R.caption, R.rm);
    SC.root.focus && SC.root.setAttribute('tabindex', '-1');
    try { SC.root.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
  }

  function finishRun(value, silent) {
    const R = SC.run; if (!R || R.finishing) return;
    R.finishing = true;
    const spec = R.spec;
    const done = () => {
      if (SC.run === R) SC.run = null;
      SC.pending = max(0, SC.pending - 1);
      spec.resolve(value);
      spec.done();
      setTimeout(leaveScene, 0);
    };
    if (silent || R.rm) { done(); return; }
    SC.root.classList.add('out');
    setTimeout(done, 230);
  }
  function leaveScene() {
    if (SC.pending > 0 || SC.run) return;                                          // another scene is already queued: keep the room
    if (SC.musicOn) {
      SC.musicOn = false;
      if (musicCur() === 'research') {
        const m = Mu();
        if (SC.prevSnap && SC.prevSnap.id !== 'research' && m && m.restore) { try { m.restore(SC.prevSnap, { fade: 1.2 }); } catch (e) { musicStop({ fade: 1.2 }); } }
        else if (SC.prevTrack && SC.prevTrack !== 'research') musicPlay(SC.prevTrack, { fade: 1.2 }); else musicStop({ fade: 1.2 });
      }
    }
    const cur = UI.Screens.current;
    if (cur && cur.id === 'techscene') {
      let to = SC.prev && UI.Screens.has(SC.prev) && SC.prev !== 'techscene' ? SC.prev : 'galaxy', params = SC.prevParams;
      if (to === 'tech') params = Object.assign({}, params, { field: st.field, view: st.view, from: st.from });
      UI.Screens.go(to, params || undefined);
    }
  }
  function enqueue(spec) {
    SC.pending++;
    const p = new Promise(resolve => { spec.resolve = resolve; });
    SC.chain = SC.chain.then(() => new Promise(done => {
      spec.done = done;
      const cur = UI.Screens.current;
      if (cur && cur.id !== 'techscene') { SC.prev = cur.id; SC.prevParams = cur.params; }
      try { UI.Screens.go('techscene', { _run: spec }); } catch (e) { console.error('[techscene]', e); spec.resolve(0); SC.pending = max(0, SC.pending - 1); done(); }
    }));
    return p;
  }

  // ---- choose the area of research ----------------------------------------------------------------------------------------------------------------
  function buildChoose(R) {
    const it = R.it, E = R.E, f = R.f, F = R.F, S = G.S, rs = E.research;
    const list = (it.choices || []).slice().sort((a, b) => (a.cost - b.cost) || (a.level - b.level));
    R.choices = list; R.manual = !!it.manual; R.caption = 'Choose the area of research our scientists now focus on'; R.mood = 'neutral';
    SC.cap.className = 'tsc-cap';
    if (!list.length) { setTimeout(() => finishRun(0, true), 0); return; }
    const cur = it.current || 0;
    R.hi = max(0, list.findIndex(c => c.level === cur));
    R.items = list.map((c, i) => {
      const t = c.tech || techOf(f, c.level), ti = typeInfo(t ? t.type : 'special');
      const row = h('div.tsc-item', { onmouseenter: e => { if (!R.finishing) setHi(i); }, onclick: e => { if (e.pointerType === 'mouse' || R.hi === i) pick(i); else setHi(i); } },
        UI.icon(ti.ico), h('span.nm', t ? t.name : 'Level ' + c.level), h('span.co', fmt(c.cost) + ' RP'));
      return row;
    });
    R.listEl = h('div.tsc-list', R.items);
    R.infoEl = h('div.tsc-info');
    R.okBtn = UI.button('Research', () => pick(R.hi), { primary: true, kbd: 'Space' }); UI.attention(R.okBtn);
    R.skipBtn = UI.button(R.manual ? 'Cancel' : 'Decide for me', () => act('skip'), { kbd: 'Esc', tip: R.manual ? 'Keep things as they are' : 'Let the scientists take the cheapest technology' });
    const box = h('div.tsc-box.ch', h('div.tsc-box-h', UI.icon(F.icon), h('span', F.name + ' Technology'), h('small', list.length + (list.length === 1 ? ' choice' : ' choices'))), R.listEl, R.infoEl,
      h('div.tsc-acts', R.skipBtn, h('span.grow'), R.okBtn));
    SC.panel.appendChild(box);
    SC.hint.innerHTML = UI.Phone.say('<kbd>↑</kbd><kbd>↓</kbd> choose &nbsp;·&nbsp; <kbd>Space</kbd> research &nbsp;·&nbsp; <kbd>Esc</kbd> ' + (R.manual ? 'cancel' : 'let the scientists decide'), '');
    setHi(R.hi, true);
    void S; void rs;
  }
  function setHi(i, scroll) {
    const R = SC.run; if (!R || R.kind !== 'choose') return;
    i = clamp(i, 0, R.choices.length - 1);
    const changed = i !== R.hi || scroll === true;
    R.hi = i;
    R.items.forEach((row, k) => row.classList.toggle('on', k === i));
    if (!changed && R.infoEl.firstChild) return;
    const c = R.choices[i], t = c.tech || techOf(R.f, c.level), E = R.E, rs = E.research;
    const fc = forecast(E, R.f, rs.invest[R.f], c.cost);
    UI.clear(R.infoEl);
    R.infoEl.appendChild(h('div.tn', h('b', t ? t.name : 'Level ' + c.level), h('span.cost', '(' + fmt(c.cost) + ' RP)')));
    R.infoEl.appendChild(h('p', t ? t.desc : ''));
    R.infoEl.appendChild(h('div.eta', fc ? (fc.never ? 'No research points reach ' + R.F.name + ' yet: raise a colony\'s Tech slider, or this field\'s share on the Tech screen.' : 'At ' + fmt(fc.rp) + ' RP per turn: ' + etaText(fc)) : ''));
    if (scroll === true) { const row = R.items[i]; if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' }); }      // keys scroll the list; the pointer never does
    if (R.hiSfx) UI.sfx('hover');
    R.hiSfx = true;
  }
  function pick(i) {
    const R = SC.run; if (!R || R.finishing) return;
    const c = R.choices[clamp(i, 0, R.choices.length - 1)];
    UI.sfx('confirm'); finishRun(c.level);
  }

  // ---- breakthrough ---------------------------------------------------------------------------------------------------------------------------------
  function buildBreak(R) {
    const it = R.it, E = R.E, F = R.F, f = R.f, src = CAPTION[it.source] ? it.source : 'research';
    const t = (it.id && TD().byId[it.id]) || techOf(f, it.level);
    R.tech = t; R.src = src; R.caption = CAPTION[src](E, F);
    R.mood = src === 'spy' ? 'scheming' : 'pleased';
    SC.cap.className = 'tsc-cap ' + (src === 'spy' ? 'cyan' : 'gold');
    const ti = typeInfo(t ? t.type : 'special');
    R.art = h('canvas.tsc-art'); R.descEl = h('p.tsc-td'); R.descT = new Typer(R.descEl);
    const fx = t ? effectLines(t) : [];
    const SRC = { research: 'Researched', spy: 'Stolen', loot: 'Found', orion: 'Orion vault', trade: 'Traded' };
    const body = h('div.tsc-card-b',
      h('div.tsc-tn', t ? t.name : 'Level ' + it.level),
      h('div.tsc-chips', UI.chip(ti.label, 'cy'), UI.chip(F.name), UI.chip('Level ' + (t ? t.level : it.level)), UI.chip(SRC[src], src === 'spy' ? 'vi' : 'ok'), E.research ? UI.chip(F.name + ' tech level ' + E.research.tl[f]) : null),
      R.descEl,
      fx.length ? h('ul.tch-fx', fx.map(l => h('li', h('span.k', l.k), h('span.v', String(l.v))))) : null);
    R.okBtn = UI.button('Continue', () => act('ok'), { primary: true, kbd: 'Space' }); UI.attention(R.okBtn);
    SC.panel.appendChild(h('div.tsc-box.ch', R.art, body, h('div.tsc-acts', h('span.grow'), R.okBtn)));
    R.fu = t ? followSpec(t, E) : null;
    SC.hint.innerHTML = '<kbd>Space</kbd> continue';
    R.descT.set(t ? t.desc : '', R.rm);
    UI.sfx(src === 'spy' ? 'alert' : 'tech');
  }
  async function continueBreak(skip) {
    const R = SC.run; if (!R || R.finishing || R.busyFu) return;
    if (R.fu && !skip) {
      R.busyFu = true;
      try { await followUp(R.tech, R.E); } catch (e) { console.error('[techscene] follow-up failed', e); }
      R.busyFu = false;
    }
    if (SC.run === R) { UI.sfx('click'); finishRun(0); }
  }

  // ---- follow-up dialogs: re-balance the colony sliders after techs that change what a colony needs (research/02 §1.9, §4.9) ----------------------
  function followSpec(t, E) {
    if (!E || E.race === 'silicoid' || !E.human) return null;
    const fx = t.effects || {};
    if (t.type === 'waste' || t.type === 'eco') return { mode: 'eco-min', name: 'Ecology', slider: 3, text: 'Cleaner industry means colonies need less ecology spending to stay clean.' };
    if (fx.robotic && fx.robotic > 2) return { mode: 'raise', name: 'Industry', slider: 2, text: 'Every colonist can now run more factories, so more industry spending is worthwhile.' };
    if (fx.terraform || fx.soil || fx.advSoil || fx.atmos) return { mode: 'raise', name: 'Ecology', slider: 3, text: fx.atmos ? 'Atmospheric terraforming is paid for out of ecology spending.' : fx.soil || fx.advSoil ? 'Soil enrichment is paid for out of ecology spending.' : 'Terraforming is paid for out of ecology spending.' };
    if (fx.planetShield) return { mode: 'raise', name: 'Defence', slider: 1, text: 'Planetary shields are paid for out of defence spending.' };
    return null;
  }
  function applyFollow(spec, pct) {
    const S = G.S, E = G.player(), C = M.Sim.Colony; let n = 0;
    for (const p of S.planets) {
      if (p.owner !== E.id) continue;
      if (spec.mode === 'eco-min') {
        const floorPct = C.ecoFloorPct(S, E, p);
        if (p.sliders[3] > floorPct && !p.lock[3]) { G.order({ t: 'slider', planet: p.id, index: 3, value: floorPct }); n++; }
      } else {
        const d = round(p.sliders[4] * pct / 100);
        if (d > 0 && !p.lock[spec.slider]) { G.order({ t: 'slider', planet: p.id, index: spec.slider, value: p.sliders[spec.slider] + d }); n++; }
      }
    }
    return n;
  }
  function followUp(t, E) {
    E = E || G.player();
    const spec = t ? followSpec(t, E) : null;
    if (!spec) return Promise.resolve(false);
    const S = G.S, mine = S.planets.filter(p => p.owner === E.id).length;
    const yesNo = spec.mode === 'eco-min';
    const body = h('div.tsc-fu', h('p', h('b.t-brass', t.name), '. ', spec.text),
      h('p', yesNo ? 'Lower the ecology slider on all ' + mine + ' colonies to the minimum needed to stay clean? The freed production goes to research.' :
        'Move part of every colony\'s research budget into ' + spec.name + '? Locked sliders are left alone.'),
      h('p.dim', 'You can always change each colony by hand.'));
    const buttons = yesNo ? [{ label: 'No', value: 0, kbd: 'N' }, { label: 'Yes', value: 100, primary: true, kbd: 'Y' }] :
      [{ label: 'No change', value: 0, kbd: 'N' }, { label: '25%', value: 25, kbd: '2' }, { label: '50%', value: 50, kbd: '5' }, { label: '75%', value: 75, kbd: '7' }];
    let off = null;
    const pm = UI.modal({ title: yesNo ? 'Adjust ecology spending?' : 'Adjust ' + spec.name.toLowerCase() + ' spending?', body, buttons, closable: true, width: '30rem', autofocus: false,
      onOpen: (modal, close) => {
        setTimeout(() => { const b = modal.querySelector('.modal-f .btn'); if (b) b.focus(); }, 30);          // the safe answer is focused, never the biggest change
        const keys = { n: 0, y: 100, '2': 25, '5': 50, '7': 75 };
        const on = e => {
          const k = e.key.toLowerCase(), v = keys[k];
          if (v === undefined || (yesNo && (k === '2' || k === '5' || k === '7')) || (!yesNo && k === 'y')) return;
          e.preventDefault(); e.stopPropagation(); close(v);
        };
        window.addEventListener('keydown', on, true); off = () => window.removeEventListener('keydown', on, true);
      },
      onClose: () => { if (off) off(); } });
    return pm.then(v => { if (v) { const n = applyFollow(spec, v); if (n) UI.toast(spec.name + ' spending adjusted on ' + n + (n === 1 ? ' colony' : ' colonies'), 'ok'); return true; } return false; });
  }

  // ---- keys / frame ---------------------------------------------------------------------------------------------------------------------------------
  function act(a) {
    const R = SC.run; if (!R || R.finishing) return;
    if (R.kind === 'choose') {
      if (a === 'ok') pick(R.hi);
      else if (a === 'skip') { UI.sfx(R.manual ? 'cancel' : 'click'); finishRun(0); }
      else if (a === 'up') setHi(R.hi - 1, true);
      else if (a === 'down') setHi(R.hi + 1, true);
      else if (a === 'home') setHi(0, true);
      else if (a === 'end') setHi(R.choices.length - 1, true);
    } else if (a === 'ok') {
      if (R.capT.busy || R.descT.busy) { R.capT.finish(); R.descT.finish(); } else continueBreak(false);
    } else if (a === 'skip') continueBreak(true);
  }
  (function bindSceneKeys() {
    const scr = { screen: 'techscene' };
    const key = (combo, a) => UI.bindKey(combo, e => { if (e && e.repeat && (a === 'ok' || a === 'skip')) return; act(a); }, scr);
    key('space', 'ok'); key('enter', 'ok'); key('escape', 'skip'); key('arrowup', 'up'); key('arrowdown', 'down'); key('home', 'home'); key('end', 'end');
  })();

  function frame(dt) {
    const R = SC.run; if (!R || R.finishing) return;
    dt = min(dt, 0.1); R.t += dt; R.acc += dt;
    let typed = R.capT.step(dt, 52); if (R.descT) typed += R.descT.step(dt, 95);
    if (typed) typeTick(typed);
    const busy = R.capT.busy || (R.descT && R.descT.busy);
    if (R.wasBusy && !busy) R.talkTail = 0.5;
    R.wasBusy = busy; if (R.talkTail > 0) R.talkTail -= dt;
    const talking = !R.rm && (busy || R.talkTail > 0);
    if (talking !== R.talking) { R.talking = talking; R.dirty = true; }
    const fps = min(60, PQ().animFps || 60);                       // the lab is a big painting: never repaint it faster than 60 per second
    const due = R.rm ? R.dirty : UI.pace(R.pace || (R.pace = {}), fps, dt);
    if (!due) return;
    R.acc = 0; R.dirty = false;
    paintLab(R);
    if (R.art) paintArt(R);
  }

  UI.Screens.register('techscene', {
    create(el) { buildScene(el); },
    enter(params) {
      const spec = params && params._run;
      if (!spec) { UI.Screens.go(UI.Screens.has('tech') ? 'tech' : 'galaxy'); return; }
      if (SC.run) finishRun(0, true);
      startRun(spec);
    },
    leave() { if (SC.run && !SC.run.finishing) finishRun(0, true); },
    update(dt) { frame(dt); },
    resize() { SC.layKey = ''; if (SC.run) SC.run.dirty = true; },
  });

  UI.TechScenes = {
    // a field with a single technology left has no real choice: the scientists simply start on it (research/06 §5.13), no scene
    choose(it) {
      it = it || {};
      const only = it.choices && it.choices.length === 1 && !it.manual ? it.choices[0] : null;
      if (only) {
        const t = only.tech || techOf(clamp(it.field | 0, 0, 5), only.level);
        try { if (UI.Galaxy && UI.Galaxy.message && t) UI.Galaxy.message(FIELDS[clamp(it.field | 0, 0, 5)].name + ': our scientists begin work on ' + t.name + '.', 'ok'); } catch (e) { /* message line is optional */ }
        return Promise.resolve(only.level);
      }
      return enqueue({ kind: 'choose', it });
    },
    breakthrough(it) { return enqueue({ kind: 'break', it: it || {} }).then(() => undefined); },
    followUp,
    isActive: () => !!SC.run,
  };
})(window.MOO);
