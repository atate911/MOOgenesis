// Artifact worlds and the Orion/Guardian prize (research/04 §3.9, research/02 §1.10, research/05 §7.5-7.6). Worker-safe.
//
//   Artifacts.loot(S, E, planet, R)          first exploration of an ARTIFACTS planet by a SHIP of a human empire (turn.js calls it from the explore step):
//                                            one random tech — random field, level = rnd(30), accepted when level <= min(TL[field] + 10, 50), the tech
//                                            exists in the master table and is not owned (<= 200 tries). AI empires never collect. Returns {field, level, tech} | null.
//   Artifacts.guardianLoot(S, E, R)          Death Ray (WE 36, not researchable) + up to 3 techs: random field, level = rnd(31) + 19 (20..50), accepted when
//                                            level <= min(TL[field] + 25, 50) (techs outside the empire's own research list are fine), <= 200 tries per draw.
//   Artifacts.processGuardian(S, R)          call every turn (Events.coups/Events.turn do): when Combat has set S.guardian.alive = false and S.guardian.killer
//                                            (empire id) the killer is paid ONCE (S.guardian.looted) and the news item is pushed.
//   Artifacts.clearOrion(S)                  while the Guardian lives every fleet still in orbit at Orion after the battle phase is removed (research/05 §7.5).
//   Artifacts.draw(E, R, spec)               the shared random-tech draw (exported for tests / other modules).
// Techs are granted with Research.grant(S, E, field, level, source) — source 'loot' (artifacts) / 'orion' (Guardian) — which queues the breakthrough scene for humans.
MOO.def(function (M) {
  'use strict';
  const A = M.Sim.Artifacts = {};
  const Sim = M.Sim;

  // draw specs: level = base + rnd(n); acceptance cap = min(TL + reach, cap)
  A.ARTIFACT = { base: 0, n: 30, reach: 10, cap: 50, tries: 200 };
  A.ORION = { base: 19, n: 31, reach: 25, cap: 50, tries: 200, draws: 3 };
  A.DEATH_RAY = { field: 5, level: 36 };

  const techs = () => M.Data.Techs;
  const newsPush = (S, ev) => { if (Sim.Ev) Sim.Ev.push(S, Object.assign({ type: 'news' }, ev)); };

  // One random draw (research/02 §1.10): random field, random level; null when 200 tries find nothing acceptable.
  A.draw = function (E, R, spec, tl) {
    const rs = E.research, Tc = techs(), TL = tl || rs.tl;
    for (let i = 0; i < spec.tries; i++) {
      const f = R.int(0, 5);
      const level = spec.base + R.int(1, spec.n);
      const cap = Math.min((TL[f] | 0) + spec.reach, spec.cap);
      if (level > cap) continue;
      const t = Tc.byFL[f][level];
      if (!t || t.group === 'advanced') continue;
      if (t.pool === 'x' && rs.pool !== 'x') continue;                             // expansion techs exist only in expanded games
      if (rs.completed[f].indexOf(level) >= 0) continue;
      return { field: f, level, tech: t };
    }
    return null;
  };

  A.loot = function (S, E, planet, R) {
    if (!E || !E.human || !planet || planet.special !== 'artifacts') return null;       // AI empires get nothing (§7.6)
    const seen = planet.looted || (planet.looted = []);
    if (seen.indexOf(E.id) >= 0) return null;
    seen.push(E.id);
    const d = A.draw(E, R, A.ARTIFACT);
    if (!d) return null;
    Sim.Research.grant(S, E, d.field, d.level, 'loot');
    newsPush(S, { cat: 'artifactFound', empire: E.id, planet: planet.id, star: planet.starId, tech: d.tech.name, field: techs().FIELD_NAMES[d.field] });
    return d;
  };

  A.guardianLoot = function (S, E, R) {
    const out = { empire: E.id, deathRay: false, techs: [] };
    const tl = E.research.tl.slice();                                              // caps use the tech levels BEFORE the prize (the Death Ray alone lifts Weapons by ~28)
    if (Sim.Research.grant(S, E, A.DEATH_RAY.field, A.DEATH_RAY.level, 'orion')) out.deathRay = true;
    for (let k = 0; k < A.ORION.draws; k++) {
      const d = A.draw(E, R, A.ORION, tl);
      if (d && Sim.Research.grant(S, E, d.field, d.level, 'orion')) out.techs.push({ field: d.field, level: d.level, name: d.tech.name, id: d.tech.id });
    }
    return out;
  };

  A.processGuardian = function (S, R) {
    const g = S.guardian;
    if (!g || g.alive !== false || g.looted) return null;
    if (!(g.killer >= 0) || !S.empires[g.killer]) return null;
    const E = S.empires[g.killer];
    g.looted = true;
    const loot = A.guardianLoot(S, E, R);
    g.loot = loot;
    const already = Sim.Ev && Sim.Ev.of(S, 'news').some(e => e.cat === 'guardianSlain');
    if (!already) newsPush(S, { cat: 'guardianSlain', empire: E.id, star: g.star !== undefined ? g.star : S.orion, importance: 2 });
    return loot;
  };

  A.clearOrion = function (S) {
    const g = S.guardian;
    if (!g || g.alive === false || S.orion === undefined || S.orion < 0) return 0;
    let n = 0;
    for (const f of S.fleets) if (f.star === S.orion) { for (let i = 0; i < f.ships.length; i++) { n += f.ships[i]; f.ships[i] = 0; } }
    if (n && Sim.Fleet && Sim.Fleet.cleanup) Sim.Fleet.cleanup(S);
    return n;
  };
});
