// Visibility & exploration (research/04 §1.15, research/02 §4.2). All stars are drawn from turn 1; what is hidden is planet detail until explored.
//   E.explored[star] 0|1   permanent: set when any ship of the empire is in orbit, or by the Advanced Space Scanner (≤110 map units of an owned planet)
//   E.scanned[star]  0|1   recomputed each turn: star within planet-scanner range (parsecs) of an owned/allied planet
//   E.vis[star]      0 unexplored | 1 explored but out of scan range ("last reported") | 2 explored and live      (derived; what UIs read)
//   E.seen[star]     last-known snapshot {turn, owner, pop, bases, factories, shield} refreshed while scanned
// Transit detection (1oom game_check_coord_is_visible; research/02 §4.2 corrected): a fleet or transport on its way is seen within 10 × scan range map units of ANY owned
// planet (30 / 50 / 70 / 90 for scan 3 / 5 / 7 / 9 — the planet scanner radius), and within (5 × scan − 15) units (0 / 10 / 20 / 30) of a star where the empire has ships in
// orbit or of its own fleets in transit. (The doc's "ships seen at 0 / 1 / 2 / 3 pc" is that second, small ship radius, not the radius around planets.)
// Worker-safe.
MOO.def(function (M) {
  'use strict';
  const V = M.Sim.Vis = {};
  const Geo = M.Sim.Geo;

  V.init = function (S, E) {
    const n = S.stars.length;
    E.explored = new Array(n).fill(0); E.scanned = new Array(n).fill(0); E.vis = new Array(n).fill(0); E.seen = {};
  };
  V.scanRange = E => (E.mods && E.mods.scan) || 3;
  V.planetReach = E => 10 * V.scanRange(E);                                          // map units: fleets in transit are seen this close to an owned planet
  V.shipReach = E => Math.floor((10 * V.scanRange(E) - 30) / 2);                      // map units 0/10/20/30: ... and this close to own ships (orbiting or in transit)
  V.transitRange = E => V.shipReach(E) / 10;                                          // the small ship radius in parsecs (0..3)
  const allied = (S, a, b) => a === b || (M.Sim.Diplo && M.Sim.Diplo.isAllied && M.Sim.Diplo.isAllied(S, a, b));

  // mark a star explored for E (returns true the first time)
  V.explore = function (S, E, starId) {
    if (E.explored[starId]) return false;
    E.explored[starId] = 1;
    V.snapshot(S, E, starId);
    return true;
  };
  V.snapshot = function (S, E, starId) {
    const p = S.planets[starId];
    E.seen[starId] = { turn: S.turn, owner: p.owner, pop: p.owner >= 0 ? Math.floor(p.pop) : 0, bases: p.bases | 0, factories: p.factories | 0, shield: p.owner >= 0 ? (M.Sim.Colony && M.Sim.Colony.shieldLevel ? M.Sim.Colony.shieldLevel(S, p) : 0) : 0 };
  };

  // Recompute scanned[] / vis[] / seen[] for every empire. Call once per turn after movement + colonisation.
  V.update = function (S) {
    const n = S.stars.length;
    for (const E of S.empires) {
      if (!E.alive) continue;
      E.scanned.fill(0);
      const range = V.scanRange(E), adv = E.mods && E.mods.advScanner, survey = (E.mods && E.mods.survey) | 0;   // survey: expansion Stellar Survey Probes
      for (const p of S.planets) {
        if (p.owner !== E.id) continue;                                    // planet scanners are OWN planets only — allied planets extend fuel range, not scanning (1oom game_update_within_range)
        const sid = p.starId;
        E.scanned[sid] = 1;
        for (let j = 0; j < n; j++) {
          if (j === sid) continue;
          if (Geo.parsecs(S, sid, j) <= range) E.scanned[j] = 1;
          if (adv && !E.explored[j] && Geo.unitDist(S, sid, j) <= 110) V.explore(S, E, j);   // Advanced Space Scanner auto-explores
          if (survey && !E.explored[j] && Geo.parsecs(S, sid, j) <= range + survey) V.explore(S, E, j);
        }
      }
      // ships in orbit explore and see their own star
      for (const f of S.fleets) {
        if (f.owner !== E.id || f.star < 0) continue;
        E.scanned[f.star] = 1; V.explore(S, E, f.star);
      }
      for (let i = 0; i < n; i++) {
        E.vis[i] = E.explored[i] ? (E.scanned[i] ? 2 : 1) : 0;
        if (E.scanned[i] && E.explored[i]) V.snapshot(S, E, i);
      }
    }
  };

  // can empire E see fleet f right now?
  V.canSee = function (S, E, f) {
    if (f.owner === E.id || allied(S, E.id, f.owner)) return true;
    if (f.star >= 0) return !!E.scanned[f.star];                       // in orbit at a star we are currently scanning
    // in transit (map units, octagonal dist_fast): near an owned planet (full scanner radius) or near own ships (orbiting a star, or in transit: the small radius)
    const x = f.x, y = f.y, big = V.planetReach(E), small = V.shipReach(E);
    for (const p of S.planets) {
      if (p.owner !== E.id) continue;
      const A = S.stars[p.starId];
      if (Geo.distFast(x - A.x, y - A.y) <= big) return true;
    }
    for (const g of S.fleets) {
      if (g.owner !== E.id) continue;
      const A = g.star >= 0 ? S.stars[g.star] : g;
      if (Geo.distFast(x - A.x, y - A.y) <= small) return true;
    }
    return false;
  };
});
