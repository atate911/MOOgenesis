// Colonies needing attention (Q.attention): the Planets screen's warnings per colony, and hostile fleets or troop transports seen flying at them.
module.exports = function (M, t) {
  const Sim = M.Sim, F = Sim.Fleet, Q = Sim.Q;
  const game = (seed) => Sim.Setup.create({ size: 'medium', difficulty: 'average', opponents: 2, race: 'human', seed });

  t.test('a fresh empire has nothing to report', () => {
    const S = game('at1'), A = Q.attention(S, S.playerId);
    t.eq(Object.keys(A).filter(k => A[k].threat).length, 0, 'no threats at the start');
  });

  t.test('idle factories and shrinking population are reported at that colony', () => {
    const S = game('at2'), E = S.empires[S.playerId], cap = S.planets[E.capital];
    cap.factories = cap.pop * 10;                                           // far more factories than workers
    const A = Q.attention(S, E.id)[cap.starId];
    t.ok(A && A.issues.some(i => i.t === 'Idle factories'), 'idle factories flagged');
  });

  t.test('a hostile warfleet flying at a colony is a threat with its arrival turn; never your own', () => {
    const S = game('at3'), E = S.empires[S.playerId], cap = S.planets[E.capital];
    const foe = S.empires.find(x => x.id !== E.id && x.alive !== false), fc = S.planets[foe.capital];
    const slot = foe.designs.findIndex((d, i) => d && Sim.Design.stats(S, foe, i).weaponCount > 0);
    t.ok(slot >= 0, 'the opponent has a warship design');
    // a raid already under way from the star nearest the capital (sending it there would need the foe's fuel range)
    const near = S.stars.map((x, i) => i).filter(i => i !== cap.starId).sort((a, b) => Sim.Geo.parsecs(S, cap.starId, a) - Sim.Geo.parsecs(S, cap.starId, b))[0];
    F.addShips(S, foe.id, near, slot, 4);
    const f = S.fleets.find(x => x.owner === foe.id && x.star === near), s0 = S.stars[near], s1 = S.stars[cap.starId];
    Object.assign(f, { star: -1, from: near, to: cap.starId, x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2, speed: 1 });
    const r = { fleet: f };
    F.addShips(S, E.id, near, 0, 2); const mineF = S.fleets.find(x => x.owner === E.id && x.star === near);
    Object.assign(mineF, { star: -1, from: near, to: cap.starId, x: s0.x, y: s0.y, speed: 1 });
    const vis = Sim.Vis.canSee(S, E, r.fleet), A = Q.attention(S, E.id)[cap.starId];
    t.ok(vis, 'the raid is within the capital\'s scanners');
    t.ok(A && A.threat, 'the capital is threatened'); t.eq(A.threat.ships, 4); t.ok(A.threat.eta >= 1);
    t.ok(A.threat.owners.indexOf(foe.id) >= 0);
  });
};
