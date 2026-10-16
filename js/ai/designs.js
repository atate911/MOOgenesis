// AI step 45 — ship-design maintenance and build orders (the original "p2"; research/07 §5, §2.9, §12 P45 · research/01 §3.0 (ship names), §5.14 (hull lean) · research/05 §10.6, §13.4).
// Pure planner: emits `scrapDesign`, `design` (in that order) and, through the planned-state overlay, one `build` item per owned planet (ctx.finish() appends the builds last, so they always
// refer to designs that already exist).  Persistent memory in E.ai (all small JSON, written with ctx.patch):
//   p2 countdown (setup.js: rnd(10); reset rnd(12)+8 = 9..20; decremented first, the run fires at ≤ 0) · dyear[6] creation year of each slot's design (0 for the start designs — unverified) ·
//   order[] the slots in the original's compact-array order (creation order; "first/last design" rules use it) · shipiColony / shipiBomber role slots (-1 none) · p2Done true after the first run.
//
// ONE RUN (turn_p2_do):  scan the HUMAN empires' designs (Energy/Ionic Pulsar → hull roll +1; Repulsor Beam / Warp Dissipator → no range-1 weapons) → roles re-detected (colony = last design
//   with a colony base, bomber = last design whose FIRST weapon bank holds a bomb) → age scrap (while more than one design holds ships: year < 100 → older than 50, else older than 100) →
//   remove ONE more design (> 4 designs with ships: the oldest, even with ships; else the first design without ships) → refill the six slots, first missing role colony → bomber → fighter →
//   roles re-detected → EVERY owned planet gets a build item: Stargate (50 %, when the empire has the tech and the planet no gate) else one of the three newest designs (colony design = year 0).
// ONE DESIGN (design_ship, research/07 §5.5): hull (colony: Large; others rnd0(12)+race offset, +1 pulsar, table S M M M L L L L L H H H) → engine → colony base/tanks → computer → shield → armor
//   (best metal, "II" variant kept with 1/2/4/8 %) → specials 0,1 (per-device chance table, last success wins) → maneuver → ECM → special 2 → Battle Scanner/Inertial Stabilizer (Large+) →
//   weapon banks (1–4 by hull, highest fitting weapon below the newest, share of what fits) → rejects (HEF+missile/bomb, Oracle+missile, empty bank 0) rebuild the design.
//   The tiered pick tier(K, c): rank K (best) is taken with chance c %; otherwise the chance doubles and the rank drops by one (the draw happens even when K = 1).
//
// QUIRKS (AI.QUIRKS.<name>; true = original v1.3/1oom behaviour, false = fixed; options.aiClassic switches all on).  Defaults in brackets.
//   designExcludeNewest  [true]  §5.4: the candidate window of engines, computers, ECM, shields, maneuver and WEAPONS is "fitting items strictly below the newest owned item" (1oom's `i < v`,
//                        marked FIXME in the source) — the newest owned component of those categories can never be chosen, engines run 1–2 tiers behind and the AI ships carry the second-newest
//                        weapon.  OFF: the newest item is a candidate too.  Armor and specials are never windowed.  (Unverified against the original binary — keep flagged.)
//   designScrapCounter   [false] §5.2 / 1oom "BUG this could be a non-non0 ship design": scrapping an aged design with NO ships still lowers the "designs with ships" counter, which can end the
//                        aging loop early.  OFF: the counter only drops when the scrapped design held ships.
// FIXES (AI.FIXES.<name>; true = fixed (default), false = original; aiClassic turns them off — outside the quirk table because tools/rules/83-balance pins that one to REPORT.md)
//   designKeepFleet      [true]  the original scraps LIVE fleets wholesale: the age scrap takes any aged design whatever it flies and the forced removal (> 4 designs with ships)
//                        takes the OLDEST design (measured: 1,938 of ~5,500 ships built over a 200-turn large game were scrapped by the AI itself, single events of 98 of 697).
//                        Fixed: the age scrap skips a design flying more than 10 % of the empire's hulls and the forced removal takes the design with the lowest
//                        ships × cost (a slot is still always freed: with six designs either one flies nothing or the cheapest loss goes).  false reproduces the original.
//   (not reproduced, no flag: the original's compact array shifts after a scrap so the loop skips the next design — irrelevant with fixed slots; the original's over-filled weapon counts
//    (101–141 % of what fits) — the sim's `design` order rejects negative free space, so counts are clamped to what fits; reserve tanks / the forced colony Laser are only added when they fit.)
//
// EXPORTS AI.Designs = { tier, hullFor, generate, detectRoles, SPECIAL_CHANCE, CH, QDEF }  (for tests and tools).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI;
  AI.QUIRKS = AI.QUIRKS || {};
  const QDEF = { designExcludeNewest: true, designScrapCounter: false };
  for (const q in QDEF) if (AI.QUIRKS[q] === undefined) AI.QUIRKS[q] = QDEF[q];
  AI.FIXES = AI.FIXES || {}; if (AI.FIXES.designKeepFleet === undefined) AI.FIXES.designKeepFleet = true;

  const COLONY = 0, FIGHTER = 1, BOMBER = 2;                                  // the original's shiptype
  const HULL_TBL = [0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3];
  // base chances by hull (Small, Medium, Large, Huge)
  const CH = { comp: [10, 20, 35, 50], shield: [5, 15, 40, 70], armor: [1, 2, 4, 8], man: [30, 20, 20, 15], ecm: [2, 8, 20, 30], engine: 60 };
  const P2 = [0, 50, 75, 100], P3 = [0, 0, 50, 100], P4 = [0, 0, 25, 50];      // nested chances for the 2nd / 3rd / 4th weapon bank
  const C1 = [[100, 100, 100, 100], [60, 100, 100, 100], [40, 40, 100, 100], [40, 40, 60, 100]];       // bank share bounds by bank count (row) and bank (column)
  const C2 = [[100, 100, 100, 100], [80, 100, 100, 100], [70, 70, 100, 100], [60, 60, 80, 100]];
  // tbl_chance_special[special n][hull] — n = the 1oom special id = Data.Components.SPECIALS[i].n (research/05 §13.4, research/07 §5.5); unlisted devices 0
  const SPECIAL_CHANCE = {
    9: [0, 0, 30, 80], 10: [0, 10, 50, 80], 11: [0, 0, 25, 80], 12: [0, 0, 20, 70], 13: [0, 5, 20, 60], 14: [20, 30, 50, 80], 15: [0, 10, 40, 70], 16: [0, 0, 25, 50], 17: [0, 0, 20, 40],
    18: [20, 30, 40, 70], 19: [0, 0, 20, 30], 20: [10, 20, 25, 35], 21: [0, 0, 20, 30], 22: [0, 0, 20, 40], 23: [10, 20, 30, 40], 24: [0, 10, 30, 50], 25: [0, 0, 30, 60], 26: [0, 0, 0, 50],
    27: [0, 10, 20, 30], 28: [10, 20, 40, 60], 29: [10, 20, 40, 60], 30: [10, 20, 40, 60],
  };

  const K = () => M.Data.Components;
  const D = () => M.Sim.Design;
  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

  // ---- the tiered pick ------------------------------------------------------------------------------------------------------------------------------------------
  // rank K = best.  Draw rnd(100); while it exceeds the current chance and more than one rank remains: chance doubles, rank drops.  (The draw is made even when K ≤ 1.)
  function tier(R, count, chance) {
    let num = count;
    while (R.int(1, 100) > chance && num > 1) { chance *= 2; num--; }
    return num;
  }

  // hull roll: rnd0(12) + race offset, ≥ 0, +1 if a human has pulsars, ≤ 11 → Small/Medium/Large/Huge (index 0..3)
  function hullFor(R, offset, pulsar) {
    let v = R.int(0, 11) + (offset | 0);
    if (v < 0) v = 0;
    if (pulsar) v += 1;
    if (v > 11) v = 11;
    return HULL_TBL[v];
  }

  // ---- role detection -------------------------------------------------------------------------------------------------------------------------------------------
  // designs: array of 6 draft/design records (null = empty); order: slots in compact order.  The LAST match wins (the original overwrites).
  function detectRoles(designs, order) {
    const Kc = K();
    let colony = -1, bomber = -1;
    for (const s of order) {
      const d = designs[s]; if (!d) continue;
      if ((d.specials || []).some(i => i >= 0 && Kc.SPECIALS[i] && Kc.SPECIALS[i].colonyMin > 0)) colony = s;
      const w0 = d.weapons && d.weapons[0];
      if (w0 && w0.type >= 0 && w0.count > 0 && Kc.WEAPONS[w0.type] && Kc.WEAPONS[w0.type].kind === 'bomb') bomber = s;
    }
    return { colony, bomber };
  }

  // ---- one new design ---------------------------------------------------------------------------------------------------------------------------------------------
  // generate(S, E, R, role, opts) → a draft for the `design` order, or null.   opts: { pulsar, repulwarp, includeNewest, race (record), names }.
  function generate(S, E, R, role, opts) {
    opts = opts || {};
    const Kc = K(), Dz = D(), I = Kc.idx;
    const inc = !!opts.includeNewest;
    const aiMod = opts.aiMod || {};
    let repulwarp = !!opts.repulwarp;
    const tl = f => (E.research && E.research.tl ? E.research.tl[f] : 1) | 0;
    const freeOf = d => { const c = Dz.compute(S, E, d); return c.structural ? -1e9 : c.free; };
    const fits = d => freeOf(d) >= 0;
    const fitsSet = (d, field, val) => { const old = d[field]; d[field] = val; const ok = fits(d); d[field] = old; return ok; };
    const owned = kind => Dz.available(E, kind);

    // the candidate window + tiered pick of one component category.  hasNone: option "none" (-1) exists and is rank 1.
    function pickOpt(d, field, kind, chance, hasNone) {
      const own = owned(kind), v = own.length ? own[own.length - 1] : -1, opts = hasNone ? [-1] : [];
      for (const i of own) if ((inc || i < v) && fitsSet(d, field, i)) opts.push(i);
      if (!opts.length) return hasNone ? -1 : (own.length ? own[0] : 0);
      return opts[tier(R, opts.length, chance) - 1];
    }
    const specOwned = () => owned('specials').filter(i => Kc.SPECIALS[i].n >= 9);               // everything above the colony bases (Battle Scanner …)
    function canPlace(d, slot, i) {
      const g = Kc.SPECIALS[i].group;
      for (let s = 0; s < 3; s++) if (s !== slot && d.specials[s] >= 0 && Kc.SPECIALS[d.specials[s]].group === g) return false;
      const old = d.specials[slot]; d.specials[slot] = i; const ok = fits(d); d.specials[slot] = old; return ok;
    }
    function rollSpecial(d, slot, hull) {
      let pick = -1;
      for (const i of specOwned()) {
        if (!canPlace(d, slot, i)) continue;
        const row = SPECIAL_CHANCE[Kc.SPECIALS[i].n];
        if (R.int(1, 100) <= (row ? row[hull] : 0)) pick = i;                                  // ascending scan, the last success wins
      }
      d.specials[slot] = pick;
    }

    // design_ship_base: everything but weapons.  Returns when the free space drops below a third of what was free after the engine.
    function baseDesign(hull, isColony) {
      const d = Dz.blank(hull);
      d.engine = pickOpt(d, 'engine', 'engines', CH.engine, false);
      const baseline = Math.floor(freeOf(d) / 3), low = () => freeOf(d) < baseline;
      if (isColony) {
        const bases = owned('specials').filter(i => Kc.SPECIALS[i].colonyMin > 0);
        d.specials[0] = bases.length ? bases[bases.length - 1] : I.specials['standard-colony-base'];
        if (tl(1) > 5 && fitsSet(d, 'specials', d.specials.map((x, k) => (k === 1 ? I.specials['reserve-fuel-tanks'] : x)))) d.specials[1] = I.specials['reserve-fuel-tanks'];
      }
      d.comp = pickOpt(d, 'comp', 'computers', CH.comp[hull], true);
      if (low()) return d;
      d.shield = pickOpt(d, 'shield', 'shields', CH.shield[hull], true);
      if (low()) return d;
      const arm = owned('armor'), best = arm.length ? arm[arm.length - 1] : 0;                   // best owned = the heavy "II" of the best metal
      const keep = R.int(1, 100) <= CH.armor[hull];                                              // the roll is consumed even when the best index is even
      d.armor = (best & 1) && keep ? best : (best & ~1);
      if (isColony) return d;
      rollSpecial(d, 0, hull); if (low()) return d;
      rollSpecial(d, 1, hull); if (low()) return d;
      const e = d.engine, manOpts = [];                                                           // maneuver: ratings 0 … engine−1 (… engine with the newest included) that fit
      for (let m = 0; m < (inc ? e + 1 : e); m++) if (fitsSet(d, 'man', m)) manOpts.push(m);
      d.man = manOpts.length ? manOpts[tier(R, manOpts.length, CH.man[hull]) - 1] : 0;
      if (low()) return d;
      d.ecm = pickOpt(d, 'ecm', 'ecm', CH.ecm[hull], true);
      rollSpecial(d, 2, hull);
      return d;
    }

    // design_ship_sub2: Large/Huge hulls with slot 2 still empty get the Battle Scanner there, and an Inertial Stabilizer in slot 1 once Propulsion is high enough
    function sub2(d, hull) {
      if (hull < 2 || d.specials[2] >= 0) return;
      const scan = I.specials['battle-scanner'], stab = I.specials['inertial-stabilizer'];
      if (owned('specials').indexOf(scan) >= 0 && canPlace(d, 2, scan)) d.specials[2] = scan;
      if (tl(4) < 30 || d.specials[1] >= 0) return;
      if (owned('specials').indexOf(stab) >= 0 && canPlace(d, 1, stab)) d.specials[1] = stab;
    }

    // design_ship_weapon(s): 1–4 banks, each takes the highest fitting weapon below the newest owned one, filled to a random share of what fits
    function weapons(d, hull, shiptype) {
      const ignore = R.int(0, 1) ? 2 : 5;                                                         // never both missile rack sizes
      let nb = 1;
      if (R.int(1, 100) <= P2[hull]) { nb = 2; if (R.int(1, 100) <= P3[hull]) { nb = 3; if (R.int(1, 100) <= P4[hull]) nb = 4; } }
      const own = owned('weapons'), used = [];
      if (!own.length) return;
      const top = own[own.length - 1];
      for (let b = 0; b < nb; b++) {
        let cut = inc ? top + 1 : top;                                                            // candidates are the owned weapons with index < cut
        if (b === 0 && Kc.WEAPONS[top].kind === 'bomb' && shiptype !== BOMBER) cut -= 1;            // the bomb test only looks at the top weapon (original quirk)
        const cands = [];
        for (const j of own) {
          if (j >= cut) break;
          const w = Kc.WEAPONS[j];
          if (w.racks === ignore || (repulwarp && w.range === 1) || used.indexOf(j) >= 0) continue;
          cands.push(j);
        }
        let pick = -1;
        for (let k = cands.length - 1; k >= 0; k--) {
          const old = d.weapons[b]; d.weapons[b] = { type: cands[k], count: 1 };
          const ok = fits(d); d.weapons[b] = old;
          if (ok) { pick = cands[k]; break; }
        }
        if (pick < 0) continue;
        used.push(pick);
        const maxFit = Dz.maxCount(S, E, d, b, pick), w = Kc.WEAPONS[pick];
        const r = (w.rof > 0 || w.racks > 0) ? 41 : 11;                                           // unverified: true for every real weapon (research/07 §5.6)
        const c1 = C1[nb - 1][b], c2 = C2[nb - 1][b];
        const count = Math.min(maxFit, Math.floor(maxFit * (c1 + R.int(1, c2 - c1 + r)) / 100));      // original: up to 141 % of maxFit; the validator needs ≤ 100 %
        d.weapons[b] = count > 0 ? { type: pick, count } : { type: -1, count: 0 };
      }
    }

    function compact(d) {
      d.specials = d.specials.filter(x => x >= 0); while (d.specials.length < 3) d.specials.push(-1);
      d.weapons = d.weapons.filter(w => w.type >= 0 && w.count > 0); while (d.weapons.length < 4) d.weapons.push({ type: -1, count: 0 });
    }
    const rejected = d => {
      const w = d.weapons[0].type >= 0 ? Kc.WEAPONS[d.weapons[0].type] : null;
      if (!w) return false;
      const missile = w.dmg[0] === w.dmg[1], bomb = w.kind === 'bomb';
      const hef = d.specials.indexOf(I.specials['high-energy-focus']) >= 0, oracle = d.specials.indexOf(I.specials['oracle-interface']) >= 0;
      return ((missile || bomb) && hef) || (missile && oracle);
    };

    const isColony = role === COLONY;
    for (let again = 0; again < 30; again++) {
      const hull = isColony ? 2 : hullFor(R, aiMod.hull, opts.pulsar);
      let d = null;
      for (let inner = 0; inner < 30 && !d; inner++) {
        const c = baseDesign(hull, isColony);
        sub2(c, hull); weapons(c, hull, role); compact(c);
        if (c.weapons[0].count > 0) d = c;
        else if (isColony) {                                                                      // the colony ship is always armed: one Laser (only if it fits)
          c.weapons[0] = { type: I.weapons['laser'], count: 1 };
          if (!fits(c) && c.specials[1] >= 0 && Kc.SPECIALS[c.specials[1]].tanks) { c.specials[1] = -1; c.specials = c.specials.filter(x => x >= 0); while (c.specials.length < 3) c.specials.push(-1); }
          if (!fits(c)) c.weapons[0] = { type: -1, count: 0 };
          d = c;
        }
      }
      if (!d) { if (repulwarp && hull > 0) repulwarp = false; continue; }                          // "relaxing 1 rng limit"
      if (rejected(d)) continue;
      const st = Dz.compute(S, E, d);
      if (!st.valid) continue;
      const rd = opts.race || (M.Data.Races && M.Data.Races.races ? M.Data.Races.races[E.race] : null);
      d.name = isColony ? 'Colony Ship' : designName(E, rd, hull, R);
      delete d.icon;
      return d;
    }
    return null;
  }

  // names: names[hull*3 + rnd0(3)], skipping names already used by the empire's designs (search upward, then downward from the top, then name 0)
  function designName(E, rd, hull, R) {
    const names = rd && rd.shipNames && rd.shipNames.length >= 12 ? rd.shipNames : null;
    if (!names) return M.Sim.Design.defaultName(E, hull);
    const used = {};
    for (const d of E.designs || []) if (d && d.name) used[d.name.toLowerCase()] = 1;
    const free = i => !used[names[i].toLowerCase()];
    const cand = hull * 3 + R.int(0, 2);
    if (free(cand)) return names[cand];
    for (let i = cand + 1; i < names.length; i++) if (free(i)) return names[i];
    for (let i = names.length - 1; i >= 0; i--) if (free(i)) return names[i];
    return names[0];
  }

  // ---- the p2 run -------------------------------------------------------------------------------------------------------------------------------------------------
  function shipCounts(S, E) {
    const n = [0, 0, 0, 0, 0, 0];
    for (const f of S.fleets) if (f.owner === E.id) for (let i = 0; i < 6; i++) n[i] += f.ships[i] | 0;
    return n;
  }
  const hasSpecial = (E, ids) => (E.designs || []).some(d => d && d.specials && d.specials.some(i => i >= 0 && ids.indexOf(i) >= 0));

  function runP2(ctx) {
    const S = ctx.S, E = ctx.E, R = ctx.R, Kc = K(), I = Kc.idx, st = ctx.state;
    const classicCount = ctx.quirk('designScrapCounter');
    // 1. what the humans fly (pulsars lean the hull roll, repulsors/dissipators drop the range-1 weapons)
    const pul = [I.specials['energy-pulsar'], I.specials['ionic-pulsar']], rep = [I.specials['repulsor-beam'], I.specials['warp-dissipator']];
    let pulsar = false, repulwarp = false;
    for (const e of S.empires) if (e.alive && e.human && e.id !== E.id) { if (hasSpecial(e, pul)) pulsar = true; if (hasSpecial(e, rep)) repulwarp = true; }
    // 2. the working copy of the design table (V), ship counts, creation years and the compact order
    const V = [], ships = shipCounts(S, E), dy = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) { V[i] = E.designs[i] ? E.designs[i] : null; if (st.dyear && st.dyear[i] !== undefined) dy[i] = st.dyear[i] | 0; }
    let order = (st.order || []).filter((s, k, a) => V[s] && a.indexOf(s) === k);
    for (let i = 0; i < 6; i++) if (V[i] && order.indexOf(i) < 0) order.push(i);
    const scrap = slot => { ctx.order({ t: 'scrapDesign', slot }); V[slot] = null; ships[slot] = 0; dy[slot] = 0; order = order.filter(s => s !== slot); };

    // 3. roles, aging, one forced removal
    let roles = detectRoles(V, order);
    const keepLive = ctx.fix('designKeepFleet'), hulls = total(ships);
    let non0 = 0; for (const s of order) if (ships[s] !== 0) non0++;
    for (const s of order.slice()) {
      if (non0 <= 1) break;
      const age = S.year - dy[s];
      if (order.length > 1 && ((S.year < 100 && age > 50) || (S.year >= 100 && age > 100))) {
        if (keepLive && ships[s] * 10 > hulls) continue;                                            // (fixed) a design flying more than 10 % of the empire's hulls is never aged out
        const had = ships[s] !== 0;
        scrap(s);
        if (had || classicCount) non0--;
      }
    }
    non0 = 0; for (const s of order) if (ships[s] !== 0) non0++;
    let rem = -1;
    if (non0 > 4) {
      if (keepLive) { let best = Infinity; for (const s of order) { const v = ships[s] * ctx.designStats(s).cost; if (v < best) { best = v; rem = s; } } }   // (fixed) the cheapest loss: fewest hulls × cost, ties → oldest
      else { let oldest = 0xffff; for (const s of order) if (dy[s] < oldest) { oldest = dy[s]; rem = s; } }                                               // original: the oldest, however many ships it has
    } else if (order.length > 1) for (const s of order) if (ships[s] === 0) { rem = s; break; }
    if (rem >= 0 && order.length > 1) scrap(rem);
    roles = detectRoles(V, order);
    // 4. refill the six slots: first missing role colony → bomber → fighter
    const made = [];
    for (let guard = 0; order.length < 6 && guard < 12; guard++) {
      const role = roles.colony < 0 ? COLONY : roles.bomber < 0 ? BOMBER : FIGHTER;
      const draft = generate(S, E, R, role, { pulsar, repulwarp, includeNewest: !ctx.quirk('designExcludeNewest'), aiMod: ctx.aiMod });
      if (!draft) break;
      let slot = 0; while (V[slot]) slot++;
      ctx.order({ t: 'design', slot, design: draft });
      V[slot] = draft; order.push(slot); dy[slot] = S.year; ships[slot] = 0; made.push({ slot, role });
      if (role === COLONY) roles.colony = slot; else if (role === BOMBER) roles.bomber = slot;     // the new design takes the role it was made for …
    }
    roles = detectRoles(V, order);                                                                 // … until the second detection pass re-reads the real designs
    // 5. build items: sorted newest first, colony design = year 0 (stable: ties keep the compact order)
    const sorted = order.map(s => ({ s, y: s === roles.colony ? 0 : dy[s] })).sort((a, b) => b.y - a.y).map(x => x.s);
    const gate = !!(E.mods && E.mods.stargate);
    if (sorted.length) for (const p of ctx.mine()) {
      if (!p.stargate && gate && R.int(0, 1) === 1) ctx.setBuild(p, -1);
      else ctx.setBuild(p, sorted[Math.min(R.int(0, 2), sorted.length - 1)]);
    }
    ctx.patch({ p2: R.int(1, 12) + 8, p2Done: true, dyear: dy, order, shipiColony: roles.colony, shipiBomber: roles.bomber });
    return { made, sorted, roles };
  }

  AI.step('designs', 45, function (ctx) {
    const st = ctx.state;
    const cd = (st.p2 === undefined ? ctx.R.int(1, 10) : st.p2) - 1;                          // decremented first; the run fires at ≤ 0
    if (cd > 0 || !ctx.mine().length) { ctx.patch({ p2: cd > 0 ? cd : 1 }); return; }          // (an empire without planets waits)
    runP2(ctx);
  });

  AI.Designs = { tier, hullFor, generate, detectRoles, runP2, designName, SPECIAL_CHANCE, CH, QDEF, COLONY, FIGHTER, BOMBER };
});
