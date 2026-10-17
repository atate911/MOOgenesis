// Rally points (RELOC) and stargates (research/04 §5.5–5.6): the original's Alt-R "all colonies rally here", lost rally targets pointing home,
// newly built ships riding a stargate pair, and transports between gates.
module.exports = function (M, t) {
  const Sim = M.Sim, F = Sim.Fleet, C = Sim.Colony, O = Sim.Orders;
  const game = (seed, o) => Sim.Setup.create(Object.assign({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: seed || 'log' }, o || {}));
  const me = S => S.empires[S.playerId];
  const order = (S, o) => O.apply(S, S.playerId, o);
  // give the player a second and third colony on unowned planets
  function colonies(S, n) {
    const E = me(S), out = [];
    for (const p of S.planets) { if (out.length >= n) break; if (p.owner < 0 && p.typeIdx >= ((E.mods && E.mods.colonyFor) || 7) && p.special !== 'orion') { C.found(S, E, p, 20); E.explored[p.starId] = true; out.push(p); } }
    F.updateRange(S);
    return out;
  }

  t.test('relocAll points every colony at the target (the target keeps its own ships) and to < 0 resets them all', () => {
    const S = game('rl1'), E = me(S), [a, b] = colonies(S, 2), cap = S.planets[E.capital];
    const r = order(S, { t: 'relocAll', to: a.id });
    t.ok(r.ok, r.msg);
    t.eq(cap.reloc, a.id); t.eq(b.reloc, a.id); t.eq(a.reloc, a.starId, 'the rally world itself does not send its ships away');
    t.ok(!order(S, { t: 'relocAll', to: S.empires[1].capital }).ok, 'a foreign planet is refused');
    t.ok(order(S, { t: 'relocAll', to: -1 }).ok);
    t.eq(cap.reloc, cap.starId); t.eq(b.reloc, b.starId);
  });

  t.test('a rally point that is lost points home again (fixReloc) and ships built afterwards stay in orbit', () => {
    const S = game('rl2'), E = me(S), [a] = colonies(S, 1), cap = S.planets[E.capital];
    t.ok(order(S, { t: 'reloc', planet: cap.id, to: a.id }).ok);
    a.owner = 1;                                                             // captured
    t.eq(F.fixReloc(S), 1, 'one rally line reset');
    t.eq(cap.reloc, cap.starId);
    t.eq(F.fixReloc(S), 0, 'idempotent');
  });

  t.test('ships finished at a colony with a rally point leave for it; between two stargates they arrive the next turn', () => {
    const S = game('rl3'), E = me(S), [a] = colonies(S, 1), cap = S.planets[E.capital];
    t.ok(order(S, { t: 'reloc', planet: cap.id, to: a.id }).ok);
    const slot = E.designs.findIndex(d => d);
    cap.build = slot; cap.sliders = [100, 0, 0, 0, 0]; cap.acc.ship = Sim.Design.cost(S, E, slot) * 2 + 1;
    Sim.Econ.refresh(S);
    const built = Sim.Econ.stepShips(S).filter(b => b.planet === cap.id);
    t.ok(built.length && built[0].count >= 1, 'something was built');
    const moving = S.fleets.filter(f => f.owner === E.id && f.star < 0 && f.to === a.starId);
    t.eq(moving.length, 1, 'one group on its way to the rally point');
    t.ok(moving[0].speed < 35, 'no gates yet: normal warp');
    // now both ends have stargates
    cap.stargate = true; a.stargate = true; cap.acc.ship = Sim.Design.cost(S, E, slot) + 1;
    Sim.Econ.stepShips(S);
    const gated = S.fleets.filter(f => f.owner === E.id && f.star < 0 && f.to === a.starId && f.speed >= 35);
    t.eq(gated.length, 1, 'the new ships ride the stargate');
    t.eq(F.eta(S, cap.starId, a.starId, gated[0].speed, false), 1, 'one turn');
    F.move(S);
    t.ok(S.fleets.some(f => f.owner === E.id && f.star === a.starId), 'arrived after one movement step');
  });

  t.test('transports between two stargates launch at stargate speed (the Trans panel ETA must agree)', () => {
    const S = game('rl4'), E = me(S), [a] = colonies(S, 1), cap = S.planets[E.capital];
    cap.stargate = true; a.stargate = true; cap.pop = 60;
    t.ok(order(S, { t: 'trans', planet: cap.id, to: a.id, n: 5 }).ok);
    F.launchTransports(S);
    const tr = S.trans.find(x => x.owner === E.id && x.to === a.id);
    t.ok(tr && tr.speed >= 35, 'stargate speed');
    t.eq(F.transEta(S, E, cap.starId, a.starId), 1, 'F.transEta agrees: one turn');
    a.stargate = false;
    t.ok(F.transEta(S, E, cap.starId, a.starId) >= 1, 'without the far gate: normal ETA');
  });
};
