// Q — read-only queries / view-models for the UI and AI. Nothing here mutates S. Worker-safe.
// Shapes follow research/06 (original screens): colony panel, planets ledger, fleet deployment/route, star panel, research screen, status/races bars.
MOO.def(function (M) {
  'use strict';
  const Q = M.Sim.Q = {};
  const S_ = () => M.Sim;
  const Geo = M.Sim.Geo;

  Q.TYPE_LABEL = { none: 'NO PLANET', radiated: 'RADIATED', toxic: 'TOXIC', inferno: 'INFERNO', dead: 'DEAD', tundra: 'TUNDRA', barren: 'BARREN', minimal: 'MINIMAL', desert: 'DESERT', steppe: 'STEPPE', arid: 'ARID', ocean: 'OCEAN', jungle: 'JUNGLE', terran: 'TERRAN' };
  Q.GROWTH_LABEL = { hostile: 'HOSTILE', normal: '', fertile: 'FERTILE', gaia: 'GAIA' };
  Q.SPECIAL_LABEL = { ultrapoor: 'ULTRA POOR', poor: 'POOR', normal: '', artifacts: 'ARTIFACTS', rich: 'RICH', ultrarich: 'ULTRA RICH', orion: 'ORION' };
  Q.SPECIAL_NOTE = { ultrapoor: '1/3 production', poor: '1/2 production', rich: '2× production', ultrarich: '3× production', artifacts: '2× research', orion: '4× research' };
  Q.FIELD_NAMES = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];
  const hostile = p => p.typeIdx >= 1 && p.typeIdx <= 6;

  // the real-year label
  Q.year = S => M.Data.Config.displayYear(S);

  // ---- planets -------------------------------------------------------------------------------------------------------------------------------
  Q.growthTenths = function (S, E, p) {
    const c = Object.assign({}, p); M.Sim.Colony.growPop(S, E, c, 0);
    return (c.pop - p.pop) * 10 + (c.popFrac - p.popFrac);
  };
  Q.planetCard = function (S, pid) {            // what is shown in the planet info box (works for any planet; no hidden info — callers gate by exploration)
    const p = S.planets[pid];
    return { id: p.id, star: p.starId, name: p.name || S.stars[p.starId].name, type: p.type, typeLabel: Q.TYPE_LABEL[p.type], hostile: hostile(p), growth: p.growth, growthLabel: Q.GROWTH_LABEL[p.growth],
      special: p.special, specialLabel: Q.SPECIAL_LABEL[p.special], specialNote: Q.SPECIAL_NOTE[p.special] || '', maxPop: p.maxPop, rocks: p.rocks, gfx: p.gfx, owner: p.owner };
  };
  Q.colony = function (S, pid) {
    const p = S.planets[pid]; if (!p || p.owner < 0) return null;
    const E = S.empires[p.owner], C = M.Sim.Colony, Dz = M.Sim.Design;
    const card = Q.planetCard(S, pid), floor = C.ecoFloorPct(S, E, p), d = p.build >= 0 ? E.designs[p.build] : null;
    return Object.assign(card, {
      ownerName: E.plural, pop: p.pop, popFrac: p.popFrac, maxPopShown: C.maxPopDisplay(E, p), canTerraform: !!(E.mods.terraform && p.mp3 - p.mp2 < E.mods.terraform), growthTenths: Q.growthTenths(S, E, p),
      bases: p.bases | 0, shield: p.shield | 0, factories: p.factories, maxFactories: C.maxFactories(E, p), waste: p.waste | 0, rebels: p.rebels | 0, unrest: p.unrest | 0,
      gross: p.gross | 0, production: p.spendable | 0, sliders: p.sliders.slice(), lock: p.lock.slice(), ecoFloor: floor, readouts: C.readouts(S, E, p),
      build: p.build === -1 ? { stargate: true, name: 'Stargate', cost: 3000, progress: p.acc.ship } : { slot: p.build, name: d ? d.name : '—', cost: d ? Dz.cost(S, E, p.build) : 0, progress: p.acc.ship },
      reloc: p.reloc, relocName: S.stars[p.reloc] ? S.stars[p.reloc].name : '', stargate: !!p.stargate, canStargate: !!E.mods.stargate && !p.stargate, transNote: p.trans ? p.trans : null,
      designs: E.designs.map((x, i) => x ? { slot: i, name: x.name, cost: Dz.cost(S, E, i) } : null), event: p.event || null,
    });
  };
  // planets ledger (research/06 §5.8)
  Q.ledger = function (S, eid) {
    const E = S.empires[eid], rows = [];
    let n = 0;
    for (const p of S.planets) {
      if (p.owner !== eid) continue;
      const d = p.build >= 0 ? E.designs[p.build] : null;
      rows.push({ n: ++n, id: p.id, star: p.starId, name: p.name, pop: p.pop, growth: Q.growthTenths(S, E, p), factories: p.factories, shield: p.shield | 0, bases: p.bases | 0, waste: p.waste | 0,
        prod: p.spendable | 0, dock: p.sliders[0] > 0 ? (p.build === -1 ? 'Stargate' : d ? d.name : '') : '', note: (p.event && p.event.type) || (p.unrest === 2 ? 'rebellion' : p.unrest === 1 ? 'unrest' : p.stargate ? '*' : '') });
    }
    const f = E.flow || {}, G = Math.max(1, f.gross || 1);
    return { rows, spending: { ships: pct((f.shipM || 0) / G), spying: pct((f.spying || 0) / G), bases: pct((f.baseM || 0) / G), security: pct((f.security || 0) / G) },
      income: { trade: f.trade || 0, planets: f.gross || 0 }, reserve: E.bc, tax: E.tax | 0, taxToReserve: f.taxToReserve || 0, net: f.net || 0 };
    function pct(x) { return Math.round(x * 1000) / 10; }
  };

  // ---- fleets & routes ---------------------------------------------------------------------------------------------------------------------------------
  Q.fleetsAt = function (S, eid, star) {                     // the empire's stationary stack at a star → [{slot, name, count}]
    const f = M.Sim.Fleet.at(S, star, eid); if (!f) return [];
    const E = S.empires[eid]; const out = [];
    for (let i = 0; i < 6; i++) if (f.ships[i] > 0 && E.designs[i]) out.push({ slot: i, name: E.designs[i].name, count: f.ships[i] });
    return out;
  };
  // preview of sending `counts` from one star to another (research/06 §5.4)
  Q.route = function (S, E, from, to, counts) {
    const F = M.Sim.Fleet; let withTanks = true, speed = 99, any = 0;
    for (let i = 0; i < 6; i++) { if (!(counts[i] > 0)) continue; any += counts[i]; const st = M.Sim.Design.stats(S, E, i); if (!st.tanks) withTanks = false; speed = Math.min(speed, st.warp); }
    const pc = Geo.parsecs(S, from, to), flag = E.frange ? E.frange[to] : 0;
    const ok = any > 0 && from !== to && F.canReach(S, E, to, withTanks);
    let reason = ''; if (!any) reason = 'No ships selected'; else if (from === to) reason = 'Already there'; else if (!ok) reason = flag === 2 ? 'Needs Reserve Fuel Tanks' : 'Out of range';
    // the route F.send will fly: straight, or through the empire's stargates when that is quicker (via = the waypoints before `to`)
    const pl = any && from !== to && speed < 99 ? F.plan(S, E, from, to, speed) : null, gate = !!pl && pl.legs.some(l => l.gate);
    return { ok, parsecs: pc, eta: pl ? pl.eta : 0, speed: speed === 99 ? 0 : gate && pl.legs.length === 1 ? 35 : speed, stargate: gate, flag, reason,
      via: pl && pl.legs.length > 1 ? pl.legs.slice(0, -1).map(l => l.star) : null, legs: pl ? pl.legs : null };
  };
  Q.distToNearestOwn = function (S, eid, star) { let best = 99; for (const p of S.planets) if (p.owner === eid) best = Math.min(best, p.starId === star ? 0 : Geo.parsecs(S, p.starId, star)); return best; };

  // fleets the viewer may see, ready for the map renderer
  Q.mapFleets = function (S, eid) {
    const E = S.empires[eid], V = M.Sim.Vis, out = [];
    for (const f of S.fleets) {
      if (f.ships.reduce((a, b) => a + b, 0) <= 0) continue;
      if (f.owner !== eid && !V.canSee(S, E, f)) continue;
      out.push({ id: f.id, owner: f.owner, star: f.star, from: f.from, to: f.to, x: f.x, y: f.y, speed: f.speed, ships: f.ships.slice(), kind: Q.fleetKind(S, f),
        eta: f.star < 0 ? (f.owner === eid ? M.Sim.Fleet.etaLeft(S, f) : M.Sim.Fleet.eta(S, f.from, f.to, f.speed, false)) : 0,
        legs: f.owner === eid && f.legs ? f.legs.map(l => ({ star: l.star, gate: !!l.gate })) : null });   // own routed fleets: the stops after f.to
    }
    for (const t of (S.trans || [])) {
      if (t.owner !== eid && !(E.explored[t.to] && V.canSee(S, E, { owner: t.owner, star: -1, x: t.x, y: t.y }))) continue;
      out.push({ id: 't' + t.id, owner: t.owner, star: -1, from: t.from, to: t.to, x: t.x, y: t.y, speed: t.speed, ships: [0, 0, 0, 0, 0, 0], kind: 'transport', n: t.n, eta: M.Sim.Fleet.eta(S, t.from, t.to, t.speed, true) });
    }
    return out;
  };
  Q.fleetKind = function (S, f) {
    const E = S.empires[f.owner]; let war = 0, col = 0, scout = 0;
    for (let i = 0; i < 6; i++) { if (!f.ships[i]) continue; const st = M.Sim.Design.stats(S, E, i); if (st.colonyMin) col++; else if (st.attack !== undefined && st.weaponCount > 0) war++; else scout++; }
    return war && (col || scout) ? 'mixed' : war ? 'war' : col ? 'colony' : 'scout';
  };

  // what does `eid` know about a star? (research/06 §4.4 panel states)
  Q.star = function (S, eid, star) {
    const E = S.empires[eid], s = S.stars[star], p = S.planets[star], explored = !!E.explored[star], live = !!E.scanned[star];
    const seen = E.seen[star] || null;
    return { id: star, name: s.name, color: s.color, nebula: s.nebula, explored, live, range: Q.distToNearestOwn(S, eid, star), inFuelRange: E.frange ? E.frange[star] : 0,
      planet: explored ? Q.planetCard(S, star) : null, owner: explored ? (live ? p.owner : (seen ? seen.owner : -1)) : -1, lastSeen: seen, orion: !!s.orion, ownedByViewer: p.owner === eid };
  };

  // ---- research (research/06 §5.12) ----------------------------------------------------------------------------------------------------------------
  Q.research = function (S, eid) {
    const E = S.empires[eid], rs = E.research, R = M.Sim.Research, out = { total: rs.total | 0, fields: [] };
    for (let f = 0; f < 6; f++) {
      const proj = rs.project[f] ? R.techAt(f, rs.project[f]) : null;
      out.fields.push({ field: f, name: Q.FIELD_NAMES[f], slider: rs.slider[f], lock: rs.lock[f], tl: rs.tl[f], level: rs.completed[f].length,
        project: proj ? { level: rs.project[f], name: proj.name, desc: proj.desc, cost: rs.cost[f], invest: rs.invest[f], chance: R.breakthroughChance(E, f) } : null,
        done: rs.completed[f].map(l => { const t = R.techAt(f, l); return { level: l, name: t ? t.name : 'Tech ' + l, desc: t ? t.desc : '' }; }),
        choices: rs.project[f] ? [] : R.choices(E, f).map(l => { const t = R.techAt(f, l); return { level: l, name: t ? t.name : 'Tech ' + l, desc: t ? t.desc : '', cost: R.projectCost(S, E, f, l) }; }) });
    }
    return out;
  };

  // ---- empire comparison bars (Status screen: fleet strength, population, technology, planets, production, total power) ----------------------------
  Q.status = function (S) {
    const rows = M.Sim.stats(S), W = [1, 5, 25, 125];
    return rows.map(r => {
      const E = S.empires[r.id]; let fleet = 0;
      for (const f of S.fleets) if (f.owner === r.id) for (let i = 0; i < 6; i++) if (f.ships[i]) { const d = E.designs[i]; fleet += f.ships[i] * (d ? W[d.hull] : 1); }
      const tech = E.research.tl.reduce((a, b) => a + b, 0);
      return { id: r.id, race: r.race, alive: r.alive, color: E.color, fleet, pop: Math.floor(r.pop), tech, planets: r.colonies, production: r.production, power: 0 };
    }).map((r, _, a) => { const mx = k => Math.max(1, ...a.map(x => x[k])); r.power = Math.round((r.fleet / mx('fleet') + r.pop / mx('pop') + r.tech / mx('tech') + r.planets / mx('planets') + r.production / mx('production')) * 20); return r; });
  };

  // ---- tutor hints (data only; the Help/tutor UI decides whether and how to show them) -------------------------------------------------------------
  // [{id, severity:'tip'|'warn', text, planet?}] for the human's situation. Today: no research at all (the default sliders put everything into industry until Tech is set, research/04).
  Q.hints = function (S, empireId) {
    const E = S.empires[empireId === undefined ? S.playerId : empireId], out = [];
    if (!E || !E.alive) return out;
    const mine = S.planets.filter(p => p.owner === E.id);
    if (mine.length && !((E.research && E.research.total) > 0)) {
      const p = mine.slice().sort((a, b) => (b.pop | 0) - (a.pop | 0))[0];
      out.push({ id: 'noResearch', severity: 'tip', planet: p.id, text: 'No research points: your planets spend nothing on Tech. Open a colony and drag its Tech slider (the last one) up to start discovering new technologies.' });
    }
    return out;
  };
});
