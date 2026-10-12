// tools/mockstate.js — believable MOCK game state for UI development & tests.   Plain script: exports window.MOCK (and module.exports in Node).
//
//   const S = MOCK.makeState({ stars: 90, empires: 5, seed: 7 });   // stars 8..400, empires 1..6, seed any string/number; {exotic:true} adds orange stars + a black hole
//   MOCK.advance(S)                 // "end turn": moves fleets, arrivals (fleet.arrived = true), colony ships settle, exploration, new AI orders
//   MOCK.addFleet(S, {owner, from, to, kind, ships})   // new fleet (moving if `to` given or chosen at random); returns the fleet
//   MOCK.sendFleet(S, fleetId, toStarId)                // order a fleet to move (first step is taken immediately)
//   MOCK.colonize(S, starId, empireId)                  // settle the star's planet (if free); returns the planet or null
//   MOCK.revealAll(S) / MOCK.resetFog(S)                // player's vis[] = 2 everywhere / back to range-based
//   MOCK.pc(S, starA, starB)                            // parsec distance = ceil(euclid / 11)
//
// Shape (a subset of the real game state S = MOO.Game.S — plain JSON, ids are array indices). UNITS: star/fleet x,y are MAP UNITS, 1 parsec ≈ 11 units;
// empire.range / empire.scan / fleet.speed are in PARSECS (speed = pc per turn). There is exactly ONE planet per star (planet id === star id).
//   S.turn, S.year, S.playerId (=0), S.orion (star id), S.guardian = {alive:true, star}
//   S.galaxy = {w, h}                               map units (e.g. 108 stars -> ~370 x ~320)
//   S.stars[i]   = {id, name, x, y, color:'yellow|red|green|blue|white|purple(neutron)', nebula:bool}   (+ legacy aliases kind, inNebula, planets:[i], special)
//   S.planets[i] = {id, starId, type:'none|radiated|toxic|inferno|dead|tundra|barren|minimal|desert|steppe|arid|ocean|jungle|terran|gaia',
//                   maxPop 10-120, special:'ultrapoor|poor|normal|artifacts|rich|ultrarich|orion', growth:'hostile|normal|fertile|gaia', rocks:'none|some|many', owner(-1|empireId), pop}
//   S.nebulae    = [{rects:[[x0,y0,x1,y1] x 4]}]    map units; soft purple clouds (ships slow down and shields fail inside)
//   S.empires[e] = {id, race, name, leader, color 0-5 (Blue Green Purple Red White Yellow = --emp0..5), human, alive, capital(planetId), range(pc), mods:{scan(pc)} (+ alias scan),
//                   vis:[0 unexplored | 1 explored, out of scanner range | 2 explored and live], explored[], scanned[], seen:{star:{turn,owner,pop}}}
//   S.fleets[i]  = {id, owner, star(-1 when moving), from, to(-1 when stationary), x, y, eta(turns), speed(pc/turn), ships:[{d,hp}] (the real sim uses 6 counts),
//                   kind:'war|colony|transport|scout|mixed', arrived}
// Everything is deterministic for a given seed (advance() uses S.mockRs, a small RNG state kept inside S).
(function (root) {
  'use strict';
  const PC = 11;   // map units per parsec

  // ---------------------------------------------------------------- tiny seeded RNG
  function hashSeed(seed) {
    const s = String(seed); let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function makeRng(state) {            // mulberry32 over a 1-element state array (serialisable)
    const r = {
      next() { let a = (state[0] = (state[0] + 0x6D2B79F5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
      range(a, b) { return a + (b - a) * r.next(); },
      int(a, b) { return a + Math.floor(r.next() * (b - a + 1)); },
      chance(p) { return r.next() < p; },
      pick(arr) { return arr[Math.floor(r.next() * arr.length)]; },
      shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; },
      weighted(pairs) { let t = 0; for (const p of pairs) t += p[1]; let x = r.next() * t; for (const p of pairs) { x -= p[1]; if (x < 0) return p[0]; } return pairs[pairs.length - 1][0]; },
    };
    return r;
  }

  const STAR_NAMES = ('Acamar Achernar Acrux Adhara Albireo Alcor Aldebaran Alderamin Algenib Algol Alhena Alioth Alkaid Almach Alnair Alnilam Alnitak Alphard Alphecca ' +
    'Alpheratz Alrescha Alshain Altair Ankaa Antares Arcturus Arneb Ascella Aspidiske Atria Avior Azha Baham Barnard Becrux Bellatrix Betelgeuse Canopus Capella Caph Castor ' +
    'Cebalrai Chara Chertan Cursa Dabih Deneb Denebola Diadem Diphda Dschubba Dubhe Edasich Electra Elnath Eltanin Enif Etamin Fomalhaut Furud Gacrux Gienah Girtab Gomeisa ' +
    'Graffias Hadar Hamal Heze Homam Izar Jabbah Kaus Kochab Kornephoros Larawag Lesath Maia Marfik Markab Matar Mebsuta Megrez Meissa Mekbuda Menkalinan Menkar Menkent Merak ' +
    'Merope Mesarthim Miaplacidus Mimosa Mintaka Mira Mirach Mirfak Mirzam Mizar Muphrid Naos Nashira Nekkar Nihal Nunki Nusakan Peacock Phact Phecda Polaris Pollux Porrima ' +
    'Procyon Propus Rasalgethi Rasalhague Regulus Rigel Rotanev Ruchbah Rukbat Sabik Sadalmelik Sadr Saiph Sargas Sarin Scheat Schedar Segin Sham Shaula Sheliak Sirius Situla ' +
    'Skat Spica Sualocin Subra Suhail Sulafat Syrma Tarazed Taygeta Tegmine Thuban Tiaki Tureis Unukalhai Vega Vindemiatrix Wasat Wezen Yed Zaniah Zaurak Zavijava Zosma Zubenelgenubi').split(' ');
  const GREEK = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Sigma'];

  const KIND_W = [['yellow', 28], ['red', 26], ['green', 8], ['blue', 14], ['white', 18], ['purple', 6]];
  const KIND_W_EXOTIC = [['yellow', 22], ['orange', 16], ['red', 20], ['green', 6], ['blue', 12], ['white', 14], ['purple', 6]];
  // empire colour ids 0..5 = Blue Green Purple Red White Yellow
  const RACES = [
    ['human', 'Solar Concord', 'Aurelia Voss'], ['mrrshan', 'Mrrshan Dominion', 'Rhazz-Kal'], ['sakkra', 'Sakkra Brood', 'Ssethik'],
    ['klackon', 'Klackon Hive', 'Click-Thrum'], ['bulrathi', 'Bulrathi Holdfast', 'Grom Ursak'], ['psilon', 'Psilon Collegium', 'Thaum Ael'],
    ['alkari', 'Alkari Flock', 'Skyrie Vahn'], ['darlok', 'Darlok Veil', 'Nyx Marrow'], ['meklar', 'Meklar Directorate', 'Unit 7-Aeon'], ['silicoid', 'Silicoid Reach', 'Quartz Prime'],
  ];
  const HOME_TYPE = { human: 'terran', mrrshan: 'jungle', sakkra: 'arid', klackon: 'desert', bulrathi: 'tundra', psilon: 'ocean', alkari: 'steppe', darlok: 'minimal', meklar: 'terran', silicoid: 'barren' };
  const SPEED = { scout: 4, war: 2, colony: 2, transport: 2, mixed: 2 };      // parsecs per turn
  const HOSTILE = ['radiated', 'toxic', 'inferno', 'dead', 'tundra', 'barren'];
  const STANDARD = ['minimal', 'desert', 'steppe', 'arid', 'ocean', 'jungle', 'terran'];
  const TYPE_W = [['none', 5], ['radiated', 6], ['toxic', 6], ['inferno', 6], ['dead', 9], ['tundra', 8], ['barren', 9],
    ['minimal', 8], ['desert', 8], ['steppe', 8], ['arid', 8], ['ocean', 7], ['jungle', 7], ['terran', 5], ['gaia', 1.5]];
  const POP_RANGE = { radiated: [10, 25], toxic: [10, 30], inferno: [10, 30], dead: [15, 40], tundra: [20, 45], barren: [15, 45], minimal: [25, 40], desert: [30, 55], steppe: [45, 70],
    arid: [40, 65], ocean: [60, 95], jungle: [60, 95], terran: [70, 110], gaia: [100, 120], none: [0, 0] };

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);                 // map units
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const round5 = v => Math.round(v / 5) * 5;

  // ---------------------------------------------------------------- stars: jittered grid (cells 28 x 32 units, jitter 43 x 51, reject if too close)
  const GRIDS = { 24: [6, 4], 48: [8, 6], 70: [10, 7], 108: [12, 9], 140: [14, 10] };
  function gridFor(n) {
    if (GRIDS[n]) return GRIDS[n];
    const rows = Math.max(2, Math.round(Math.sqrt(n / 1.35))), cols = Math.ceil(n / rows);
    return [cols, rows];
  }
  function placeStars(n, R) {
    const g = gridFor(n), cols = g[0], rows = g[1], CW = 28, CH = 32, JX = 43, JY = 51, MIN = 20, M = 9;
    const cells = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
    R.shuffle(cells); cells.length = Math.min(cells.length, n);
    const pts = [];
    for (const cell of cells) {
      let p = null, md = MIN;
      for (let k = 0; k < 40 && !p; k++) {
        if (k === 24) md = MIN * 0.8;
        const x = M + cell[0] * CW + R.range(0, JX), y = M + cell[1] * CH + R.range(0, JY);
        if (pts.every(q => Math.hypot(q.x - x, q.y - y) >= md)) p = { x, y };
      }
      if (!p) { for (let k = 0; k < 200 && !p; k++) { const x = M + R.range(0, (cols - 1) * CW + JX), y = M + R.range(0, (rows - 1) * CH + JY); if (pts.every(q => Math.hypot(q.x - x, q.y - y) >= 14)) p = { x, y }; } }
      if (p) pts.push(p);
    }
    const w = Math.ceil(Math.max.apply(null, pts.map(p => p.x)) + M), h = Math.ceil(Math.max.apply(null, pts.map(p => p.y)) + M);
    return { pts, w: Math.max(w, 60), h: Math.max(h, 60) };
  }

  // ---------------------------------------------------------------- planets (one per star)
  function makePlanet(S, star, R) {
    const type = R.weighted(TYPE_W), pr = POP_RANGE[type];
    const special = type === 'none' ? 'normal' : R.weighted([['ultrapoor', 7], ['poor', 20], ['normal', 49], ['rich', 17], ['ultrarich', 4], ['artifacts', 3]]);
    const growth = type === 'gaia' ? 'gaia' : HOSTILE.indexOf(type) >= 0 ? 'hostile' : type === 'none' ? 'hostile' : (R.chance(0.14) ? 'fertile' : 'normal');
    const p = { id: star.id, starId: star.id, type, maxPop: type === 'none' ? 0 : round5(R.range(pr[0], pr[1])), special, growth, rocks: R.weighted([['none', 55], ['some', 30], ['many', 15]]), owner: -1, pop: 0 };
    S.planets[star.id] = p; star.planets = [star.id];
    return p;
  }
  const isStandard = p => STANDARD.indexOf(p.type) >= 0 || p.type === 'gaia';

  // ---------------------------------------------------------------- nebulae (4 overlapping rects each)
  function makeNebulae(S, R, caps) {
    const n = clamp(Math.round(S.stars.length / 32), 1, 5), out = [];
    for (let tries = 0; out.length < n && tries < 60; tries++) {
      const cx = R.range(40, S.galaxy.w - 40), cy = R.range(40, S.galaxy.h - 40), rects = [];
      for (let i = 0; i < 4; i++) {
        const w = R.range(24, 58), h = R.range(22, 50), ox = i === 0 ? 0 : R.range(-0.7, 0.7) * 38, oy = i === 0 ? 0 : R.range(-0.7, 0.7) * 34;
        rects.push([Math.round(cx + ox - w / 2), Math.round(cy + oy - h / 2), Math.round(cx + ox + w / 2), Math.round(cy + oy + h / 2)]);
      }
      const inside = (x, y) => rects.some(r => x >= r[0] - 8 && x <= r[2] + 8 && y >= r[1] - 8 && y <= r[3] + 8);
      if (caps.some(c => inside(c.x, c.y))) continue;
      if (out.some(o => Math.hypot(o.cx - cx, o.cy - cy) < 90)) continue;
      out.push({ rects, cx, cy });
    }
    S.nebulae = out.map(o => ({ rects: o.rects }));
    for (const st of S.stars) st.inNebula = st.nebula = S.nebulae.some(nb => nb.rects.some(r => st.x >= r[0] && st.x <= r[2] && st.y >= r[1] && st.y <= r[3]));
  }

  // ---------------------------------------------------------------- vis (fog of war)
  function computeVis(S, e) {            // real model: explored is permanent; scanned = inside scanner range of a colony; vis 0 unexplored | 1 explored (last report) | 2 live
    const emp = S.empires[e], cols = [];
    for (const st of S.stars) if (S.planets[st.id].owner === e) cols.push(st);
    const rU = emp.range * PC, sU = emp.mods.scan * PC, n = S.stars.length;
    if (emp.explored.length !== n) { emp.explored = new Array(n).fill(0); emp.scanned = new Array(n).fill(0); emp.seen = {}; emp.firstVis = true; }
    for (const st of S.stars) {
      let d = Infinity; for (const c of cols) d = Math.min(d, dist(st, c));
      if (emp.firstVis && d <= rU * 1.25) emp.explored[st.id] = 1;
      emp.scanned[st.id] = d <= sU ? 1 : 0;
      if (emp.scanned[st.id]) emp.explored[st.id] = emp.explored[st.id] || 1;
    }
    emp.firstVis = false;
    const v = new Array(n).fill(0);
    for (const st of S.stars) {
      v[st.id] = emp.explored[st.id] ? (emp.scanned[st.id] ? 2 : 1) : 0;
      if (emp.scanned[st.id] && emp.explored[st.id]) { const p = S.planets[st.id]; emp.seen[st.id] = { turn: S.turn, owner: p.owner, pop: p.owner >= 0 ? Math.floor(p.pop) : 0 }; }
    }
    if (emp.revealed) v.fill(2);
    return v;
  }

  // ---------------------------------------------------------------- fleets
  function newFleet(S, owner, kind, ships) {
    const n = ships || (kind === 'scout' || kind === 'colony' ? 1 : 2);
    const f = { id: S.fleets.length, owner, star: -1, from: -1, to: -1, x: 0, y: 0, eta: 0, speed: SPEED[kind] || 2, ships: [], kind, arrived: false };
    for (let i = 0; i < n; i++) f.ships.push({ d: kind === 'scout' ? 0 : kind === 'colony' ? 1 : kind === 'transport' ? 2 : 3 + (i % 3), hp: 60 + (i * 17) % 60 });
    S.fleets.push(f); return f;
  }
  function placeAt(S, f, starId) { const st = S.stars[starId]; f.star = starId; f.from = starId; f.to = -1; f.x = st.x; f.y = st.y; f.eta = 0; }
  function step(S, f) {                // advance one turn toward f.to (straight line); returns true on arrival
    const to = S.stars[f.to], sp = f.speed * PC;
    const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy);
    if (d <= sp + 1e-6) { f.x = to.x; f.y = to.y; f.star = f.to; f.from = f.to; f.to = -1; f.eta = 0; f.arrived = true; return true; }
    f.x += dx / d * sp; f.y += dy / d * sp; f.star = -1; f.eta = Math.ceil((d - sp) / sp - 1e-9);
    return false;
  }
  function sendFleet(S, id, toId) {
    const f = S.fleets[id]; if (!f || toId === f.star) return f;
    const from = f.star >= 0 ? f.star : f.from;
    f.from = from; f.to = toId; f.arrived = false;
    if (f.star >= 0) { f.x = S.stars[f.star].x; f.y = S.stars[f.star].y; }
    f.star = -1;
    step(S, f);
    return f;
  }
  function nearbyStars(S, st, maxU, minU) {
    const out = []; for (const o of S.stars) { if (o.id === st.id) continue; const d = dist(st, o); if (d <= maxU && d >= (minU || 0)) out.push(o); }
    return out;
  }
  function ownedStars(S, e) { return S.stars.filter(st => S.planets[st.id].owner === e); }

  // ---------------------------------------------------------------- makeState
  function makeState(o) {
    o = o || {};
    const nStars = clamp(Math.round(o.stars || 90), 8, 400), nEmp = clamp(Math.round(o.empires || 5), 1, 6);
    const seed = o.seed === undefined ? 1 : o.seed;
    const state = [hashSeed('mock:' + seed)], R = makeRng(state);
    const S = { turn: 1, year: 2401, playerId: 0, guardian: true, galaxy: { w: 0, h: 0 }, stars: [], planets: [], nebulae: [], empires: [], fleets: [], mockRs: state, seedName: String(seed) };

    // stars
    const placed = placeStars(nStars, R);
    S.galaxy.w = placed.w; S.galaxy.h = placed.h;
    const names = STAR_NAMES.slice(); R.shuffle(names);
    placed.pts.forEach((p, i) => {
      const nm = i < names.length ? names[i] : GREEK[i % GREEK.length] + ' ' + names[(i * 7) % names.length];
      S.stars.push({ id: i, name: nm, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, kind: null, color: R.weighted(o.exotic ? KIND_W_EXOTIC : KIND_W), planets: [], special: null, inNebula: false, nebula: false });
      S.stars[i].kind = S.stars[i].color;
    });
    if (o.exotic && S.stars.length > 20) { const b = S.stars[R.int(0, S.stars.length - 1)]; b.kind = b.color = 'blackhole'; }
    for (const st of S.stars) makePlanet(S, st, R);
    // Orion: the star nearest the centre
    let orion = null, od = Infinity;
    for (const st of S.stars) { const d = Math.hypot(st.x - S.galaxy.w / 2, st.y - S.galaxy.h / 2); if (d < od) { od = d; orion = st; } }
    if (orion) { S.orion = orion.id; S.guardian = { alive: true, star: orion.id }; orion.name = 'Orion'; orion.special = 'orion'; Object.assign(S.planets[orion.id], { type: 'gaia', maxPop: 120, special: 'orion', growth: 'gaia', rocks: 'many', owner: -1, pop: 0 }); }

    // empires: capitals >= 80 units apart (farthest-point sampling over stars)
    const cand = S.stars.filter(st => st.special !== 'orion' && S.planets[st.id].type !== 'none');
    const caps = [R.pick(cand)];
    while (caps.length < nEmp && caps.length < cand.length) {
      let best = null, bd = -1;
      for (const c of cand) { let d = Infinity; for (const k of caps) d = Math.min(d, dist(c, k)); const score = (d >= 80 ? 1000 : 0) + d + R.next() * 6; if (score > bd) { bd = score; best = c; } }
      caps.push(best);
    }
    const races = RACES.slice(1); R.shuffle(races);
    caps.forEach((st, e) => {
      const r = e === 0 ? RACES[0] : races[e - 1];
      const emp = { id: e, race: r[0], name: r[1], leader: r[2], color: e, human: e === 0, alive: true, capital: st.id, vis: [], range: 4 + (e % 3), scan: 4 + (e % 2), mods: { scan: 4 + (e % 2) }, explored: [], scanned: [], seen: {} };
      S.empires.push(emp);
      const hw = S.planets[st.id];
      Object.assign(hw, { type: HOME_TYPE[emp.race] || 'terran', maxPop: 100 + (e % 3) * 5, special: 'normal', growth: 'normal', rocks: 'some', owner: e, pop: 55 + e * 4 });
      // colonies: nearest stars with a decent free planet
      const near = S.stars.filter(s => s.id !== st.id && s.special !== 'orion').sort((a, b) => dist(a, st) - dist(b, st));
      const want = Math.max(1, Math.round(nStars * 0.34 / nEmp) - 1 + R.int(0, 2)); let got = 0;
      for (const s of near) {
        if (got >= want || dist(s, st) > emp.range * PC * 3.4) break;
        const p = S.planets[s.id];
        if (p.owner >= 0 || !isStandard(p) || (p.type === 'minimal' && R.chance(0.5))) continue;
        p.owner = e; p.pop = R.int(4, Math.max(5, Math.round(p.maxPop * 0.55))); got++;
      }
    });
    makeNebulae(S, R, caps);
    // fleets
    for (const emp of S.empires) {
      const own = ownedStars(S, emp.id);
      for (const st of own) {
        if (R.chance(0.6)) { const f = newFleet(S, emp.id, 'war', R.int(2, 7)); placeAt(S, f, st.id); }
        if (R.chance(0.25)) { const f = newFleet(S, emp.id, R.pick(['scout', 'transport', 'mixed']), R.int(1, 3)); placeAt(S, f, st.id); }
      }
      const nMove = 3 + R.int(0, 3);
      for (let i = 0; i < nMove; i++) {
        const from = R.pick(own), kind = R.pick(['scout', 'war', 'war', 'colony', 'transport', 'mixed']);
        const f = newFleet(S, emp.id, kind, kind === 'war' ? R.int(2, 6) : kind === 'mixed' ? R.int(2, 4) : R.int(1, 2));
        const opts = nearbyStars(S, from, emp.range * PC * 1.5, 22); if (!opts.length) { placeAt(S, f, from.id); continue; }
        const to = R.pick(opts), prog = R.range(0.1, 0.85);
        f.from = from.id; f.to = to.id; f.star = -1;
        f.x = from.x + (to.x - from.x) * prog; f.y = from.y + (to.y - from.y) * prog;
        f.eta = Math.max(1, Math.ceil(Math.hypot(to.x - f.x, to.y - f.y) / (f.speed * PC)));
      }
    }
    // a few rival fleets approaching the player (so fog / scan range has something to show)
    const mine = ownedStars(S, 0);
    for (let i = 0; i < 3 && S.empires.length > 1 && mine.length; i++) {
      const e = 1 + (i % (S.empires.length - 1)), target = R.pick(mine), f = newFleet(S, e, i === 1 ? 'scout' : 'war', i === 1 ? 1 : R.int(2, 5));
      const ang = R.range(0, Math.PI * 2), d = R.range(28, 46);
      f.x = clamp(target.x + Math.cos(ang) * d, 4, S.galaxy.w - 4); f.y = clamp(target.y + Math.sin(ang) * d, 4, S.galaxy.h - 4);
      f.from = -1; f.to = target.id; f.star = -1; f.eta = Math.max(1, Math.ceil(Math.hypot(target.x - f.x, target.y - f.y) / (f.speed * PC)));
    }
    for (const emp of S.empires) emp.vis = computeVis(S, emp.id);
    S.fleets.forEach((f, i) => { f.id = i; });
    return S;
  }

  // ---------------------------------------------------------------- turn simulation (just enough to exercise the map)
  function colonize(S, starId, empireId) {
    const p = S.planets[starId]; if (!p || p.owner >= 0 || p.type === 'none') return null;
    p.owner = empireId; p.pop = 3; return p;
  }
  function advance(S) {
    const R = makeRng(S.mockRs), keep = [];
    S.turn++; S.year++;
    for (const f of S.fleets) f.arrived = false;
    for (const f of S.fleets) {
      if (f.to >= 0 && f.star < 0) {
        const arrived = step(S, f);
        if (arrived) {
          const emp = S.empires[f.owner], st = S.stars[f.star];
          if (f.owner === S.playerId) emp.explored[st.id] = 1;                       // exploration (scanners refresh vis below)
          if (f.kind === 'colony') { const p = colonize(S, st.id, f.owner); if (p) continue; }     // settled: ship consumed
        }
      } else if (f.owner !== S.playerId && f.star >= 0 && R.chance(0.16)) {          // AI sends idle fleets out
        const emp = S.empires[f.owner], opts = nearbyStars(S, S.stars[f.star], emp.range * PC * 1.5, 22);
        if (opts.length) { f.to = R.pick(opts).id; f.from = f.star; f.arrived = false; f.star = -1; step(S, f); }
      }
      keep.push(f);
    }
    S.fleets = keep; S.fleets.forEach((f, i) => { f.id = i; });
    for (const emp of S.empires) emp.vis = computeVis(S, emp.id);
    for (const p of S.planets) if (p.owner >= 0) p.pop = Math.min(p.maxPop, p.pop + 1 + (p.pop >> 4));      // growth
    return S;
  }
  function addFleet(S, o) {
    o = o || {};
    const R = makeRng(S.mockRs), owner = o.owner === undefined ? S.playerId : o.owner, kind = o.kind || R.pick(['war', 'scout', 'colony', 'transport', 'mixed']);
    const own = ownedStars(S, owner), from = S.stars[o.from !== undefined ? o.from : (own.length ? R.pick(own).id : R.pick(S.stars).id)];
    const f = newFleet(S, owner, kind, o.ships || (kind === 'war' ? R.int(2, 6) : R.int(1, 2)));
    placeAt(S, f, from.id);
    let to = o.to;
    if (to === undefined) { const opts = nearbyStars(S, from, 95, 22); to = opts.length ? R.pick(opts).id : -1; }
    if (to >= 0 && to !== from.id) sendFleet(S, f.id, to);
    return f;
  }
  function revealAll(S) { const e = S.empires[S.playerId]; for (let i = 0; i < e.explored.length; i++) { e.explored[i] = 1; e.scanned[i] = 1; } e.vis = e.vis.map(() => 2); e.revealed = true; return S; }
  function resetFog(S) { const e = S.empires[S.playerId]; e.revealed = false; e.explored = []; e.firstVis = true; e.vis = computeVis(S, S.playerId); return S; }

  const MOCK = { PC, makeState, advance, addFleet, sendFleet, colonize, revealAll, resetFog, pc: (S, a, b) => Math.ceil(dist(S.stars[a], S.stars[b]) / PC), STAR_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = MOCK;
  if (root) root.MOCK = MOCK;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
