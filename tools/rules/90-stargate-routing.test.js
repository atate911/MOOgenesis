// Stargate routing: a fleet sent somewhere takes the quickest route, straight or through the empire's stargates (fly to a gate, jump one
// turn to another, fly on), and follows it leg by leg (F.plan / F.send / F.move).
module.exports = function (M, t) {
  const Sim = M.Sim, F = Sim.Fleet, C = Sim.Colony, Geo = Sim.Geo;
  const game = (seed) => Sim.Setup.create({ size: 'medium', difficulty: 'average', opponents: 2, race: 'human', seed });
  const me = S => S.empires[S.playerId];
  const pc = (S, a, b) => Geo.parsecs(S, a, b);

  // the capital with a gate, a far colony with a gate, and a target star just past that colony (out of the capital's reach in one jump)
  function setup(seed) {
    const S = game(seed), E = me(S), cap = S.planets[E.capital];
    const free = S.planets.filter(p => p.owner < 0 && p.special !== 'orion').sort((a, b) => pc(S, cap.starId, b.starId) - pc(S, cap.starId, a.starId));
    const far = free[0];
    C.found(S, E, far, 20); E.explored[far.starId] = true;
    cap.stargate = true; far.stargate = true;
    F.updateRange(S);
    const tgt = S.stars.map((s, i) => i).filter(i => i !== far.starId && i !== cap.starId && S.planets[i].owner < 0 && pc(S, cap.starId, i) > pc(S, cap.starId, far.starId) * 0.6)
      .sort((a, b) => pc(S, far.starId, a) - pc(S, far.starId, b))[0];
    return { S, E, cap, far, tgt };
  }
  const fly = (S, f, max) => { let n = 0; while (S.fleets.includes(f) && f.star < 0 && n < max) { F.move(S); n++; } return n; };

  t.test('a far target is reached through the stargates in fewer turns, and in exactly the planned number', () => {
    const { S, E, cap, far, tgt } = setup('gr1');
    F.addShips(S, E.id, cap.starId, 0, 3);
    const warp = Sim.Design.stats(S, E, 0).warp, direct = F.eta(S, cap.starId, tgt, warp, false), pl = F.plan(S, E, cap.starId, tgt, warp);
    t.ok(pl.eta < direct, 'the gate route is quicker (' + pl.eta + ' vs ' + direct + ' turns)');
    t.eq(pl.legs[0].star, far.starId, 'first leg: the jump to the far gate'); t.ok(pl.legs[0].gate, 'that leg is a stargate jump');
    t.eq(pl.legs[pl.legs.length - 1].star, tgt, 'last leg: the target');
    const r = F.send(S, E, cap.starId, tgt, [3, 0, 0, 0, 0, 0]);
    t.ok(r.ok, r.msg); t.eq(r.eta, pl.eta);
    const f = r.fleet; t.eq(F.etaLeft(S, f), pl.eta, 'the map ETA agrees before launch');
    const n = fly(S, f, 60);
    t.eq(f.star, tgt, 'arrives at the target'); t.eq(n, pl.eta, 'in the planned number of turns');
  });

  t.test('a fleet at a colony without a gate flies to the nearest gate first when that is quicker', () => {
    const { S, E, cap, far, tgt } = setup('gr2');
    const near = S.planets.filter(p => p.owner < 0 && p.special !== 'orion' && p.starId !== tgt).sort((a, b) => pc(S, cap.starId, a.starId) - pc(S, cap.starId, b.starId))[0];
    C.found(S, E, near, 10); F.updateRange(S);
    F.addShips(S, E.id, near.starId, 0, 2);
    const warp = Sim.Design.stats(S, E, 0).warp, direct = F.eta(S, near.starId, tgt, warp, false), pl = F.plan(S, E, near.starId, tgt, warp);
    if (pl.eta >= direct) { t.ok(true, 'this map makes the straight route as quick: nothing to check'); return; }
    t.eq(pl.legs.map(l => l.star).slice(0, 2).join(','), cap.starId + ',' + far.starId, 'to the capital gate, then the jump');
    const r = F.send(S, E, near.starId, tgt, [2, 0, 0, 0, 0, 0]); t.ok(r.ok, r.msg);
    const n = fly(S, r.fleet, 80);
    t.eq(r.fleet.star, tgt); t.eq(n, pl.eta);
  });

  t.test('no detour when the straight route is as quick', () => {
    const { S, E, cap } = setup('gr3');
    const close = S.stars.map((s, i) => i).filter(i => i !== cap.starId).sort((a, b) => pc(S, cap.starId, a) - pc(S, cap.starId, b))[0];
    const pl = F.plan(S, E, cap.starId, close, Sim.Design.stats(S, E, 0).warp);
    t.eq(pl.legs.length, 1, 'one leg'); t.eq(pl.legs[0].star, close); t.ok(!pl.legs[0].gate);
  });

  t.test('a gate lost while the fleet is on its way: the route is re-planned from the waypoint, the fleet still arrives', () => {
    const { S, E, cap, far, tgt } = setup('gr4');
    const near = S.planets.filter(p => p.owner < 0 && p.special !== 'orion' && p.starId !== tgt).sort((a, b) => pc(S, cap.starId, a.starId) - pc(S, cap.starId, b.starId))[0];
    C.found(S, E, near, 10); F.updateRange(S); F.addShips(S, E.id, near.starId, 0, 2);
    const r = F.send(S, E, near.starId, tgt, [2, 0, 0, 0, 0, 0]); t.ok(r.ok, r.msg);
    if (!r.fleet.legs) { t.ok(true, 'straight route on this map: nothing to check'); return; }
    far.stargate = false;                                                    // the far gate is gone before the fleet reaches the capital gate
    fly(S, r.fleet, 120);
    t.eq(r.fleet.star, tgt, 'still arrives at the target');
  });

  t.test('the route preview (Q.route) reports the gate route and its waypoints', () => {
    const { S, E, cap, far, tgt } = setup('gr5');
    F.addShips(S, E.id, cap.starId, 0, 3);
    const q = Sim.Q.route(S, E, cap.starId, tgt, [3, 0, 0, 0, 0, 0]);
    t.ok(q.ok, q.reason); t.ok(q.stargate, 'flagged as a stargate route'); t.eq((q.via || []).join(','), String(far.starId), 'via the far gate');
  });
};
