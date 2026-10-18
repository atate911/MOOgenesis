// Fleets, movement, supply range, transports, colonisation (research/04 §5–6). Worker-safe.
//   S.fleets[i] = {id, owner, star (≥0 while in orbit, else -1), from, to (-1 if stationary), x, y, speed (warp, 35 = stargate), ships:[6 counts per design slot]}
//   S.trans[i]  = {id, owner, from, to, n (pop in flight), x, y, speed}       (population transports — not ships you build)
//   E.frange[star] = 0 unreachable | 1 within fuel range | 2 reachable only with Reserve Fuel Tanks        (recomputed every turn)
MOO.def(function (M) {
  'use strict';
  const F = M.Sim.Fleet = {};
  const Geo = M.Sim.Geo, O = M.Sim.Orders;
  const STARGATE_SPEED = 35;

  const nextId = S => (S.nextId = (S.nextId || 1), S.nextId++);
  const total = ships => ships.reduce((a, b) => a + b, 0);
  F.total = total;
  const allied = (S, a, b) => a === b || (M.Sim.Diplo && M.Sim.Diplo.isAllied && M.Sim.Diplo.isAllied(S, a, b));
  const stats = (S, E, slot) => M.Sim.Design.stats(S, E, slot);

  // ---- orbit groups ---------------------------------------------------------------------------------------------------------------
  F.at = function (S, star, owner) { for (const f of S.fleets) if (f.star === star && f.owner === owner) return f; return null; };
  F.atStar = (S, star) => S.fleets.filter(f => f.star === star);
  F.addShips = function (S, owner, star, slot, count) {
    let f = F.at(S, star, owner);
    if (!f) { const st = S.stars[star]; f = { id: nextId(S), owner, star, from: star, to: -1, x: st.x, y: st.y, speed: 0, ships: [0, 0, 0, 0, 0, 0] }; S.fleets.push(f); }
    f.ships[slot] = Math.min(32000, f.ships[slot] + count);
    return f;
  };
  F.cleanup = function (S) { S.fleets = S.fleets.filter(f => total(f.ships) > 0); };

  // ---- supply range (§5.3) -----------------------------------------------------------------------------------------------------------
  F.fuelRange = E => (E.mods && E.mods.fuel) || 3;
  F.updateRange = function (S) {
    const n = S.stars.length;
    for (const E of S.empires) {
      if (!E.alive) continue;
      const fuel = F.fuelRange(E); E.range = fuel;
      if (!E.frange || E.frange.length !== n) E.frange = new Array(n).fill(0);
      const best = new Array(n).fill(255);
      for (const p of S.planets) {
        if (p.owner < 0 || !allied(S, E.id, p.owner)) continue;
        for (let j = 0; j < n; j++) { const d = p.starId === j ? 0 : Geo.parsecs(S, p.starId, j); if (d < best[j]) best[j] = d; }
      }
      for (let j = 0; j < n; j++) E.frange[j] = best[j] <= fuel ? 1 : best[j] <= fuel + 3 ? 2 : 0;
    }
  };
  F.canReach = function (S, E, toStar, withTanks) { const v = E.frange ? E.frange[toStar] : 0; return v === 1 || (v === 2 && withTanks); };

  // ---- movement (§5.2): 20 frames; speed N active on frames 0..2N-1; 5 units on even frames, 6 on odd ------------------------------------
  const nebulaAt = (S, x, y) => S.nebulae.some(nb => nb.rects.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]));
  function stepTurn(S, x, y, tx, ty, speed, isTrans) {
    if (speed >= STARGATE_SPEED) return [tx, ty];
    for (let frame = 0; frame < 20; frame++) {
      if (x === tx && y === ty) break;
      if (frame >= 2 * speed) break;
      if (S.nebulae.length && nebulaAt(S, x, y)) {
        if (!isTrans && frame >= 2 && frame % 2 === 0) continue;         // fleets skip even frames ≥ 2 inside a nebula
        if (isTrans && frame % 2 === 1) continue;                        // transports skip odd frames inside a nebula
      }
      const p = Geo.goLine(x, y, tx, ty, frame % 2 === 0 ? 5 : 6); x = p[0]; y = p[1];
    }
    return [x, y];
  }
  F.eta = function (S, from, to, speed, isTrans) {
    if (from === to) return 0;
    if (speed >= STARGATE_SPEED) return 1;
    const A = S.stars[from], B = S.stars[to];
    let x = A.x, y = A.y, turns = 0;
    while ((x !== B.x || y !== B.y) && turns < 200) { const p = stepTurn(S, x, y, B.x, B.y, Math.max(1, speed), isTrans); x = p[0]; y = p[1]; turns++; }
    return turns;
  };
  F.transSpeed = E => (E.mods && E.mods.transportSpeed) || 1;

  // can both ends use a stargate?
  F.gateLink = (S, E, a, b) => !!(S.planets[a].owner === E.id && S.planets[b].owner === E.id && S.planets[a].stargate && S.planets[b].stargate);
  // ETA of a population transport as it will actually launch (stargate pair = 1 turn), for the Trans panel
  F.transEta = (S, E, from, to) => F.eta(S, from, to, F.gateLink(S, E, from, to) ? STARGATE_SPEED : F.transSpeed(E), true);
  // where ships finished at planet p will go and how long they take: {to, eta, gate, warp} | null (no rally point). Uses the design in the
  // build box (its warp), or the slowest existing design while a stargate is being built.
  F.relocRoute = function (S, E, p, to) {
    if (to === undefined) to = p.reloc;
    if (to === undefined || to < 0 || to === p.starId || !S.planets[to] || S.planets[to].owner !== E.id) return null;
    let warp = 0;
    if (p.build >= 0 && E.designs[p.build]) warp = stats(S, E, p.build).warp;
    else for (let i = 0; i < 6; i++) if (E.designs[i]) { const w = stats(S, E, i).warp; warp = warp ? Math.min(warp, w) : w; }
    const pl = F.plan(S, E, p.starId, to, Math.max(1, warp || 1)), gate = pl.legs.some(l => l.gate);   // the route the new ships will fly (stargates included)
    return { to, gate, warp: gate && pl.legs.length === 1 ? STARGATE_SPEED : Math.max(1, warp || 1), eta: pl.eta, via: pl.legs.length > 1 ? pl.legs.slice(0, -1).map(l => l.star) : null, legs: pl.legs };
  };

  // ---- stargate routing ---------------------------------------------------------------------------------------------------------------------
  // The quickest way from star `from` to star `to` at warp `speed`: straight there, or fly to one of the empire's stargates, jump (one turn)
  // to another and fly on. With g gates that is g² candidate routes, each a sum of straight legs, so no general path search is needed.
  // Returns {eta, legs:[{star, gate}]}: the stops after `from` in order, the last one `to`; gate = that leg is a stargate jump.
  F.plan = function (S, E, from, to, speed) {
    const link = F.gateLink(S, E, from, to);
    let best = { eta: link ? 1 : F.eta(S, from, to, speed, false), legs: [{ star: to, gate: link }] };
    if (link || from === to) return best;
    const gates = []; for (const p of S.planets) if (p.owner === E.id && p.stargate) gates.push(p.starId);
    if (gates.length < 2) return best;
    const toA = gates.map(a => F.eta(S, from, a, speed, false)), fromB = gates.map(b => F.eta(S, b, to, speed, false));
    let bi = -1, bj = -1;
    for (let i = 0; i < gates.length; i++) for (let j = 0; j < gates.length; j++) {
      if (i === j) continue;
      const e = toA[i] + 1 + fromB[j];
      if (e < best.eta) { best.eta = e; bi = i; bj = j; }
    }
    if (bi < 0) return best;
    const legs = [];
    if (gates[bi] !== from) legs.push({ star: gates[bi], gate: false });
    legs.push({ star: gates[bj], gate: true });
    if (gates[bj] !== to) legs.push({ star: to, gate: false });
    best.legs = legs;
    return best;
  };
  // turns left for a fleet under way: from where it is now to its current stop, plus the stops still ahead (f.legs)
  F.etaLeft = function (S, f) {
    if (f.star >= 0 || f.to < 0) return 0;
    const B = S.stars[f.to]; let x = f.x, y = f.y, n = 0;
    while ((x !== B.x || y !== B.y) && n < 200) { const p = stepTurn(S, x, y, B.x, B.y, Math.max(1, f.speed), false); x = p[0]; y = p[1]; n++; }
    let at = f.to;
    for (const l of f.legs || []) { n += l.gate ? 1 : F.eta(S, at, l.star, f.warp || 1, false); at = l.star; }
    return n;
  };
  // start the next leg of a routed fleet that has reached a waypoint. A jump whose gates are gone (lost colony) is re-planned from here.
  function nextLeg(S, f) {
    const E = S.empires[f.owner], at = f.to, warp = f.warp || 1;
    let nx = f.legs.shift();
    if (nx.gate && !F.gateLink(S, E, at, nx.star)) { const fin = f.legs.length ? f.legs[f.legs.length - 1].star : nx.star, pl = F.plan(S, E, at, fin, warp); nx = pl.legs[0]; f.legs = pl.legs.slice(1); }
    f.from = at; f.to = nx.star; f.speed = nx.gate ? STARGATE_SPEED : warp;
    if (!f.legs.length) { delete f.legs; delete f.warp; }
  }

  // ---- sending ---------------------------------------------------------------------------------------------------------------------------
  // counts = [6] ships per design slot to send from the orbit group at `fromStar`. Returns {ok, fleet, eta} | {ok:false,msg}
  F.send = function (S, E, fromStar, toStar, counts) {
    const g = F.at(S, fromStar, E.id);
    if (!g) return O.fail('no fleet there');
    if (!S.stars[toStar] || fromStar === toStar) return O.fail(fromStar === toStar ? 'already there' : 'no such star');
    counts = O.counts(counts, 6);                                       // exactly six non-negative ints: a negative count used to CREATE ships and delete the group
    let any = 0, withTanks = true, speed = 99;
    for (let i = 0; i < 6; i++) {
      const n = Math.min(counts[i], g.ships[i] | 0); counts[i] = n; if (n <= 0) continue;
      any += n; const st = stats(S, E, i);
      if (!st.tanks) withTanks = false;
      speed = Math.min(speed, st.warp);
    }
    if (!any) return O.fail('no ships selected');
    if (!F.canReach(S, E, toStar, withTanks)) return O.fail('out of range');
    // the quickest route, through the empire's stargates when that saves turns: the fleet flies its first leg, the rest wait in f.legs
    const plan = F.plan(S, E, fromStar, toStar, speed), first = plan.legs[0], warp = speed;
    speed = first.gate ? STARGATE_SPEED : warp;
    const st = S.stars[fromStar];
    const moving = { id: nextId(S), owner: E.id, star: -1, from: fromStar, to: first.star, x: st.x, y: st.y, speed, ships: counts.slice() };
    if (plan.legs.length > 1) { moving.legs = plan.legs.slice(1); moving.warp = warp; }
    for (let i = 0; i < 6; i++) g.ships[i] -= counts[i];
    // merge with an identical in-flight group (same owner/origin/destination/speed; never a routed one)
    const twin = !moving.legs && S.fleets.find(f => f.star < 0 && !f.legs && f.owner === E.id && f.from === fromStar && f.to === first.star && f.speed === speed && f.x === st.x && f.y === st.y);
    let fleet = moving;
    if (twin) { for (let i = 0; i < 6; i++) twin.ships[i] += counts[i]; fleet = twin; } else S.fleets.push(moving);
    F.cleanup(S);
    return { ok: true, fleet, eta: plan.eta, legs: plan.legs };
  };

  // ---- the movement step ---------------------------------------------------------------------------------------------------------------
  // Moves every in-flight fleet and transport one turn. Returns {arrived:[fleet], landed:[transport]}.
  F.move = function (S) {
    const arrived = [], landed = [];
    for (const f of S.fleets) {
      if (f.star >= 0) continue;
      const B = S.stars[f.to];
      const p = stepTurn(S, f.x, f.y, B.x, B.y, f.speed, false); f.x = p[0]; f.y = p[1];
      if (f.x === B.x && f.y === B.y) { if (f.legs && f.legs.length) nextLeg(S, f); else arrived.push(f); }   // a waypoint (stargate) of a routed fleet: on to the next leg
    }
    for (const f of arrived) {
      f.star = f.to; f.from = f.to; f.to = -1; f.speed = 0;
      const same = S.fleets.find(g => g !== f && g.star === f.star && g.owner === f.owner && total(g.ships) > 0);       // never merge into a fleet that was just emptied this step
      if (same) { for (let i = 0; i < 6; i++) same.ships[i] += f.ships[i]; f.ships = [0, 0, 0, 0, 0, 0]; }
    }
    F.cleanup(S);
    for (const t of S.trans) {
      const B = S.stars[t.to];
      const p = stepTurn(S, t.x, t.y, B.x, B.y, t.speed, true); t.x = p[0]; t.y = p[1];
      if (t.x === B.x && t.y === B.y) landed.push(t);
    }
    return { arrived: arrived.filter(f => total(f.ships) > 0), landed };
  };

  // ---- fuel check (§5.3): ships stranded out of range are lost ---------------------------------------------------------------------------
  F.fuelCheck = function (S) {
    const lost = [];
    for (const f of S.fleets) {
      if (f.star < 0) continue;
      const E = S.empires[f.owner]; if (!E || !E.frange) continue;
      const flag = E.frange[f.star];
      if (flag === 1) continue;
      for (let i = 0; i < 6; i++) {
        if (!f.ships[i]) continue;
        const keep = flag === 2 && stats(S, E, i).tanks;
        if (!keep) { lost.push({ empire: f.owner, star: f.star, slot: i, count: f.ships[i] }); f.ships[i] = 0; }
      }
    }
    F.cleanup(S);
    return lost;
  };

  // ---- population transports (§6.2) -------------------------------------------------------------------------------------------------------
  F.canTransportTo = function (S, E, p, toStar) {
    const q = S.planets[toStar];
    if (!q) return { ok: false, msg: 'no such planet' };
    if (toStar === p.starId) return { ok: false, msg: 'that is this planet' };
    if (!E.explored[toStar]) return { ok: false, msg: 'unexplored' };
    if (q.owner < 0) return { ok: false, msg: 'transports cannot found colonies' };
    if (!F.canReach(S, E, toStar, false)) return { ok: false, msg: 'out of range' };
    if (q.typeIdx < (E.mods.colonyFor || 7) && E.race !== 'silicoid') return { ok: false, msg: 'cannot colonise that environment yet' };
    return { ok: true };
  };
  // start of turn: pop leaves; costs 1 BC of the planet's output per pop. Returns number of transports launched.
  F.launchTransports = function (S) {
    let n = 0; S.trans = S.trans || [];
    for (const p of S.planets) {
      if (p.owner < 0 || !p.trans || !(p.trans.n > 0)) continue;
      const E = S.empires[p.owner], tr = p.trans;
      const q = F.canTransportTo(S, E, p, tr.to);
      let cnt = Math.min(tr.n, Math.max(0, p.pop - 1), Math.floor(p.pop / 2));
      if (!q.ok || tr.to === p.starId || cnt <= 0) { p.trans = null; continue; }
      p.pop -= cnt; p.rebels = Math.max(0, (p.rebels | 0) - (Math.floor(cnt / 2) + 1)); p.transCost = cnt;
      const A = S.stars[p.starId];
      const speed = F.gateLink(S, E, p.starId, tr.to) ? STARGATE_SPEED : F.transSpeed(E);
      S.trans.push({ id: nextId(S), owner: E.id, from: p.starId, to: tr.to, n: cnt, x: A.x, y: A.y, speed });
      p.trans = null; n++;
    }
    return n;
  };
  // transports that reached their star (own planet: reinforce; enemy planet: handled by ground combat module)
  F.landTransports = function (S, landed) {
    const out = [];
    for (const t of landed) {
      S.trans = S.trans.filter(x => x !== t);
      const p = S.planets[t.to], E = S.empires[t.owner];
      if (E && !E.alive) out.push({ kind: 'lost', empire: t.owner, planet: p.id, n: t.n });     // never let a dead empire's transports capture anything
      else if (p.owner === t.owner) { p.pop = Math.min(p.pop + t.n, p.mp3); out.push({ kind: 'reinforce', empire: t.owner, planet: p.id, n: t.n }); }
      else if (p.owner < 0) out.push({ kind: 'lost', empire: t.owner, planet: p.id, n: t.n });
      else if (allied(S, t.owner, p.owner)) out.push({ kind: 'lost', empire: t.owner, planet: p.id, n: t.n });
      else out.push({ kind: 'invade', empire: t.owner, target: p.owner, planet: p.id, n: t.n });
    }
    return out;
  };

  // ---- colonisation (§6.1) ----------------------------------------------------------------------------------------------------------------------
  // Which design slots in this fleet can colonise the planet? (colony base min type ≤ planet type; Silicoids settle anything)
  F.colonyShips = function (S, E, fleet, planet) {
    const out = [];
    if (planet.owner >= 0 || planet.typeIdx === 0) return out;
    if (planet.special === 'orion' && S.guardian && S.guardian.alive) return out;
    for (let i = 0; i < 6; i++) {
      if (!fleet.ships[i]) continue;
      const st = stats(S, E, i);
      if (!st.colonyMin) continue;
      const min = E.race === 'silicoid' ? 1 : st.colonyMin;
      if (planet.typeIdx >= min) out.push(i);
    }
    // the most modest colony base that can do the job is used first (an Outpost-class base before a Terran-class one)
    out.sort((a, b) => (stats(S, E, a).colonyMin - stats(S, E, b).colonyMin) || (a - b));
    return out;
  };
  F.colonize = function (S, E, fleet, slot, planet) {
    fleet.ships[slot] -= 1; F.cleanup(S);
    M.Sim.Colony.found(S, E, planet, 2);
    if (M.Sim.Vis) { M.Sim.Vis.explore(S, E, planet.starId); M.Sim.Vis.snapshot(S, E, planet.starId); }
    if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'colony', empire: E.id, planet: planet.id, star: planet.starId });
    return planet;
  };

  // ---- upkeep ---------------------------------------------------------------------------------------------------------------------------------
  // total BC value of all of an empire's ships (stationary and in flight) at current design costs
  F.shipValue = function (S, E) {
    let sum = 0;
    const cost = []; for (let i = 0; i < 6; i++) cost[i] = E.designs[i] ? M.Sim.Design.cost(S, E, i) : 0;
    for (const f of S.fleets) if (f.owner === E.id) for (let i = 0; i < 6; i++) sum += f.ships[i] * cost[i];
    return sum;
  };

  // ---- orders ---------------------------------------------------------------------------------------------------------------------------------
  O.register('fleetSend', function (S, E, o) {
    const r = F.send(S, E, o.from, o.to, (o.counts || []).slice()); return r.ok ? O.ok({ eta: r.eta }) : r;
  });
  O.register('trans', function (S, E, o) {
    const p = S.planets[o.planet];
    if (!p || p.owner !== E.id) return O.fail('not your planet');
    const n = O.num(o.n, 0, 1e6); if (n === null && o.n !== undefined && o.n !== null) return O.fail('bad count');
    if (n === null || n <= 0) { p.trans = null; return O.ok(); }
    const chk = F.canTransportTo(S, E, p, o.to); if (!chk.ok) return O.fail(chk.msg);
    p.trans = { to: o.to, n: Math.min(Math.floor(n), Math.floor(p.pop / 2)) };
    return O.ok();
  });
  O.register('reloc', function (S, E, o) {
    const p = S.planets[o.planet];
    if (!p || p.owner !== E.id) return O.fail('not your planet');
    const q = S.planets[o.to]; if (!q || q.owner !== E.id) return O.fail('rally point must be one of your planets');
    p.reloc = o.to; return O.ok();
  });
  // the original's Alt-R: point EVERY colony's rally line at one of your planets (the target itself keeps its ships), or with to < 0 reset them all
  O.register('relocAll', function (S, E, o) {
    const to = o.to === undefined || o.to === null ? -1 : o.to | 0;
    if (to >= 0) { const q = S.planets[to]; if (!q || q.owner !== E.id) return O.fail('rally point must be one of your planets'); }
    let n = 0;
    for (const p of S.planets) { if (p.owner !== E.id) continue; const v = to < 0 || p.id === to ? p.starId : to; if (p.reloc !== v) { p.reloc = v; n++; } }
    return O.ok({ changed: n });
  });
  // a rally point that is no longer one of the empire's planets (captured, destroyed, abandoned) points back at the colony itself (research/04 §5.6).
  // Run after ownership changes each turn and before ship dispatch; returns the number of rally lines reset.
  F.fixReloc = function (S) {
    let n = 0;
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      const q = p.reloc >= 0 ? S.planets[p.reloc] : null;
      if (p.reloc !== p.starId && (!q || q.owner !== p.owner)) { p.reloc = p.starId; n++; }
    }
    return n;
  };
  O.register('colonize', function (S, E, o) {
    const fleet = S.fleets.find(f => f.id === o.fleet && f.owner === E.id), planet = S.planets[o.planet];
    if (!fleet || fleet.star !== o.planet || !planet) return O.fail('no such colony ship');
    const ok = F.colonyShips(S, E, fleet, planet);
    if (!ok.length) return O.fail('cannot colonise that planet');
    F.colonize(S, E, fleet, o.slot !== undefined && ok.includes(o.slot) ? o.slot : ok[0], planet); return O.ok();
  });
});
