// ETAs shown for ships under way are the turns still to go from where they are now, not the length of the whole trip (F.etaLeft):
// your fleets, other empires' fleets and troop transports, on the map (Q.mapFleets), whose ETA also drives tooltips and raid warnings.
module.exports = function (M, t) {
  const Sim = M.Sim, F = Sim.Fleet, Q = Sim.Q;
  const game = seed => Sim.Setup.create({ size: 'medium', difficulty: 'average', opponents: 2, race: 'human', seed });

  // a trip of several turns between two stars, flown until about half of it is left
  function trip(S, from, to, mk) {
    const o = mk(); const total = F.eta(S, from, to, o.speed, !o.ships);
    for (let i = 0; i < Math.floor(total / 2); i++) F.move(S);
    return { o, total };
  }
  const far = (S, a) => S.stars.map((x, i) => i).filter(i => i !== a).sort((x, y) => Sim.Geo.parsecs(S, a, y) - Sim.Geo.parsecs(S, a, x))[0];

  t.test('a foreign fleet half way: the map shows the turns left, not the whole trip', () => {
    const S = game('eta1'), E = S.empires[S.playerId], foe = S.empires.find(x => x.id !== E.id);
    const from = S.planets[foe.capital].starId, to = far(S, from);
    F.addShips(S, foe.id, from, 0, 2);
    const f = S.fleets.find(x => x.owner === foe.id && x.star === from), s0 = S.stars[from];
    const { total } = trip(S, from, to, () => Object.assign(f, { star: -1, from, to, x: s0.x, y: s0.y, speed: 1, legs: null }));
    t.ok(total >= 4, 'a long trip (' + total + ' turns)');
    const left = F.etaLeft(S, f, true), m = Q.mapFleets(S, foe.id).find(x => x.id === f.id);
    t.ok(left < total, 'fewer turns left (' + left + ') than the whole trip');
    t.eq(m.eta, left, 'the owner\'s map shows the turns left');
    E.explored[to] = true;
    const seen = Q.mapFleets(S, E.id).find(x => x.id === f.id); if (seen) t.eq(seen.eta, left, 'so does a viewer who can see it');
    let n = 0; while (S.fleets.includes(f) && f.star < 0 && n < 50) { F.move(S); n++; }
    t.eq(n, left, 'and it arrives in exactly that many turns');
  });

  t.test('a troop transport half way: the turns left', () => {
    const S = game('eta2'), E = S.empires[S.playerId], cap = S.planets[E.capital], to = far(S, cap.starId), A = S.stars[cap.starId];
    S.trans = S.trans || [];
    const tr = { id: 99001, owner: E.id, from: cap.starId, to, n: 5, x: A.x, y: A.y, speed: 1 }; S.trans.push(tr);
    const total = F.eta(S, cap.starId, to, 1, true);
    for (let i = 0; i < Math.floor(total / 2); i++) F.move(S);
    t.ok(total >= 4, 'a long trip (' + total + ' turns)'); t.ok(S.trans.includes(tr), 'still in flight');
    const m = Q.mapFleets(S, E.id).find(x => x.id === 't' + tr.id);
    t.ok(m.eta < total, 'turns left (' + m.eta + ') below the whole trip (' + total + ')');
  });
};
