// AI step 10 — intel: the prologue of the original p1 (territory centres, "fronts", force tables) and the HAND-OVER every later AI step reads.
// Spec: research/07 §3.2–3.3 (inputs, fronts), §8.4 (bestspeed terms), §1.3 (p1 order) · research/08 §4.1–4.2 (threat, fronts & anchor planets), §3.5.
// Pure planner (worker-safe): it only READS the snapshot; everything it "changes" lives in `ctx.shared` for the rest of this one plan.
//
// ctx.shared  (filled by step 10, kept up to date by steps 20/25 and by AI.Intel.send; the military agent consumes it — keep the shape stable)
//   centre        {[empireId]: {x, y}}   territory centre of every empire: integer mean of its planets' map coordinates, (0,0) when it owns none
//   bestSpeed     S = P + 3  (P = best owned engine tech level in {6,12,…,48}, else 0 — the "BS" of research/07 §8.4). Original distance terms (map units):
//                 front merge 10·S+10 · idle staging 20·S+20 · defend range 30·S+20 · invasion transports 30·S+30 · pop relocation 20·S+20
//   contact       {[empireId]: bool}     do I have contact with that empire (Diplo.hasContact, else the geometric rule); ended/refusers: final-war state
//   humanContact  bool                   a human empire has contact with me (flag_send_colony)
//   colonyFor     my colonisable-type threshold ("have_colony_for": 7 Minimal … 1 Radiated; Silicoid always 1)
//   haveColonizable  bool                any unowned planet anywhere with typeIdx ≥ colonyFor (Orion excluded while the Guardian lives)
//   colonizable   [planetId]             those planets that are inside my fuel range (frange 1 or 2), planet-index order
//   needConquer   bool                   filled by step 20 (scouts): 1-in-(8−difficulty) roll, cleared when a colonisable planet exists or the game has ended
//   orbit         {[star]: [6]}          PLANNED stationary ships of mine per star and design slot (snapshot minus everything dispatched so far in this plan)
//   moving        [{to, counts[6]}]      my fleets in flight (snapshot) + the ones this plan sends
//   inFlight      number                 = moving.length — "fleets in flight" for the idle-fleet gate (< 8); whoever adds a fleet increments it (AI.Intel.send does)
//   galaxyMoving  number                 fleets in flight of ALL empires (dispatches stop at Intel.ENROUTE_MAX = 208, like FLEET_ENROUTE_AI_MAX)
//   fronts        [{anchor, star, enemy, enemies[], dist, x, y, rel, value, force}]   ordered like the original (merged by anchor planet):
//                   anchor  my planet id used as the front's anchor (a star id as well: planet.id === star id) · star = same value, kept for the contract
//                   enemy   the empire that created the front (−1 for the dummy front of an isolated empire) · enemies = all empires merged into it
//                   x,y     the front point (40 % of the way from my centre toward the rival's centre) · dist = distFast(anchor star, point)
//                   rel     relation weight: min(relation, 0) summed over merged fronts (the dummy front has +80)
//                   value   rel + force share of the anchor (force[anchor]·100/forceSum) — the number idle fleets minimise (research/08 §4.5) · force = force at the anchor
//                 Rebuilt by AI.Intel.fronts(ctx): step 10 (initial), end of step 20 (= the original's first `front` call), end of step 25 (= the second one).
//   force         [star] = Σ planned own ships × design threat, only at stars owned by me or unowned (research/08 §4.1) · forceSum · forceOwnSum = forceSum/25
//   threat        [6] design threat values of my six slots (Intel.designThreat)
//   (steps 20/25 add: scoutsSent, colonyOrdersSent … for tests/diagnostics.)
//
// Helpers other steps may call:  AI.Intel.send(ctx, fromStar, toStar[, onlyCounts]) → counts|null — emits one `fleetSend` (all designs present that can reach the target;
//   range-flag-2 targets take only designs with Reserve Fuel Tanks), updates orbit/moving/inFlight/force.  AI.Intel.init(ctx) · AI.Intel.fronts(ctx) · AI.Intel.threats(ctx)
//   AI.Intel.colonyFor(ctx) · AI.Intel.scanColonizable(ctx) · AI.Intel.contactWith(S,a,b) · AI.Intel.bestPropulsion(E) · AI.Intel.centres(S).
//
// Differences from the original (all documented in tools/ai-notes/expansion.md): masks of the threat table (16/32-bit Classic wrap) are not reproduced;
// an empire that owns no planet gets NO fronts (the original anchors them at planet 0).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, Geo = M.Sim.Geo;
  const Intel = AI.Intel = AI.Intel || {};
  Intel.ENROUTE_MAX = 208;
  const ENGINE_LEVELS = [6, 12, 18, 24, 30, 36, 42, 48];
  const trunc = Math.trunc;

  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

  // ---- planned fleet overlay (the pure planner's stand-in for the original's in-place updates of the orbit tables) ----------------------------------------------
  Intel.init = function (ctx) {
    const sh = ctx.shared;
    if (sh.orbit) return sh;
    const S = ctx.S, me = ctx.id;
    sh.orbit = {}; sh.moving = []; sh.galaxyMoving = 0;
    for (const f of S.fleets) {
      if (!total(f.ships)) continue;
      if (f.star < 0) sh.galaxyMoving++;
      if (f.owner !== me) continue;
      if (f.star >= 0) {
        const o = sh.orbit[f.star] || (sh.orbit[f.star] = [0, 0, 0, 0, 0, 0]);
        for (let i = 0; i < 6; i++) o[i] += f.ships[i];
      } else sh.moving.push({ to: f.to, counts: f.ships.slice() });
    }
    sh.inFlight = sh.moving.length;
    if (sh.needConquer === undefined) sh.needConquer = false;
    return sh;
  };

  const hasTanks = (ctx, slot) => !!ctx.designStats(slot).tanks;

  // Dispatch the planned stack at `from` to `to` the way the original's fleet-send helper does: EVERY design present joins (escorts too) unless the target's range flag excludes it
  // (0 = nobody, 2 = only designs with reserve tanks). `only` (optional [6]) limits the counts (the scouts send a quarter of one stack). Returns the counts sent or null.
  Intel.send = function (ctx, from, to, only) {
    const sh = Intel.init(ctx);
    if (from === to) return null;
    const have = sh.orbit[from]; if (!have) return null;
    const fr = ctx.range(to), counts = [0, 0, 0, 0, 0, 0]; let any = 0;
    if (fr === 0) return null;
    for (let i = 0; i < 6; i++) {
      const n = only ? Math.min(only[i] | 0, have[i]) : have[i];
      if (n <= 0) continue;
      if (fr === 2 && !hasTanks(ctx, i)) continue;
      counts[i] = n; any += n;
    }
    if (!any) return null;
    ctx.order({ t: 'fleetSend', from, to, counts: counts.slice() });
    for (let i = 0; i < 6; i++) have[i] -= counts[i];
    sh.moving.push({ to, counts }); sh.inFlight++; sh.galaxyMoving++;
    if (sh.force) sh.force[from] = 0;                                   // the original's send helper zeroes the force entry of the source
    return counts;
  };

  // ---- inputs ---------------------------------------------------------------------------------------------------------------------------------------------------
  Intel.centres = function (S) {
    const sx = {}, sy = {}, n = {}, out = {};
    for (const e of S.empires) { sx[e.id] = 0; sy[e.id] = 0; n[e.id] = 0; }
    for (const p of S.planets) {
      if (p.owner < 0) continue;
      const s = S.stars[p.starId]; sx[p.owner] += s.x; sy[p.owner] += s.y; n[p.owner]++;
    }
    for (const e of S.empires) out[e.id] = n[e.id] ? { x: trunc(sx[e.id] / n[e.id]), y: trunc(sy[e.id] / n[e.id]) } : { x: 0, y: 0 };
    return out;
  };

  // "best speed" of the original = best engine tech level (6,12,…,48; 0 when only the Retro engine is known) + 3
  Intel.bestPropulsion = function (E) {
    const done = E.research && E.research.completed ? E.research.completed[4] : null;
    let P = 0;
    if (done) for (const L of ENGINE_LEVELS) if (done.indexOf(L) >= 0) P = L;
    return P;
  };

  // diplomatic contact: the Diplo engine when it exists, else the geometric rule (some planet of a within max(fuel range) parsecs of some planet of b)
  Intel.contactWith = function (S, a, b) {
    const D = M.Sim.Diplo;
    if (D && typeof D.hasContact === 'function') { try { return !!D.hasContact(S, a, b); } catch (e) { /* fall back to geometry */ } }
    const A = S.empires[a], B = S.empires[b];
    if (!A || !B || !A.alive || !B.alive || a === b) return false;
    const range = Math.max((A.range | 0) || 3, (B.range | 0) || 3);
    for (const p of S.planets) {
      if (p.owner !== a) continue;
      for (const q of S.planets) if (q.owner === b && Geo.parsecs(S, p.starId, q.starId) <= range) return true;
    }
    return false;
  };

  const relation = (ctx, o) => {
    const D = M.Sim.Diplo;
    if (D && typeof D.status === 'function') { try { const st = D.status(ctx.S, ctx.id, o); if (st && typeof st.attitude === 'number') return st.attitude; } catch (e) { /* placeholder below */ } }
    const r = ctx.E.relations && ctx.E.relations[o];
    return r && typeof r.attitude === 'number' ? r.attitude : 0;
  };

  Intel.gameEnded = S => !!(S.gameOver || (S.council && (S.council.finalWar || S.council.over)));
  Intel.refusers = S => (S.council && S.council.finalWar && S.council.finalWar.refusers ? S.council.finalWar.refusers.slice() : []);

  // the colonisable-type threshold ("have_colony_for"): Planetology tech level of the empire, Silicoids settle everything
  Intel.colonyFor = function (ctx) {
    if ((ctx.mod && ctx.mod.allTerrain) || ctx.race === 'silicoid') return 1;
    const v = ctx.E.mods && ctx.E.mods.colonyFor;
    return v >= 1 && v <= 7 ? v : 7;
  };

  // free planets worth colonising: unowned, type ≥ threshold, not the guarded Orion planet. `have` = any anywhere, `list` = those in my fuel range
  Intel.scanColonizable = function (ctx) {
    const S = ctx.S, thr = Intel.colonyFor(ctx), guard = !!(S.guardian && S.guardian.alive);
    let have = false; const list = [];
    for (const p of S.planets) {
      if (p.owner >= 0 || !(p.typeIdx >= thr)) continue;
      if (guard && p.id === S.orion) continue;
      have = true;
      if (ctx.range(p.id) > 0) list.push(p.id);
    }
    return { thr, have, list };
  };

  // ---- design threat & force (research/08 §4.1; Classic's 16/32-bit masks are not reproduced) -------------------------------------------------------------------
  // One source of truth: the military planner's formula when it is loaded (AI.Military.designThreat), this identical reading of research/07 §8.5 otherwise
  // (Σ non-bomb weapon banks: weapon tech level × count; + (shield class + 10) × hp / 50 if that sum ≠ 0; + 2 × tech level of every special from the Battle Scanner on; ×2 for AI designs after the first council election, ×2 at game end).
  Intel.designThreat = function (S, E, slot) {
    const flags = { held: !!(S.council && S.council.held), ended: Intel.gameEnded(S) };
    if (AI.Military && AI.Military.designThreat) return AI.Military.designThreat(S, E, slot, flags);
    const d = E.designs && E.designs[slot];
    if (!d) return 0;
    const K = M.Data.Components, st = M.Sim.Design.stats(S, E, slot);
    if (!st || st.empty) return 0;
    let v = 0;
    for (const w of st.weapons) if (w.count > 0 && w.kind !== 'bomb' && w.kind !== 'bio') v += (w.tl | 0) * w.count;
    if (v !== 0) v += Math.floor((((d.shield >= 0 ? d.shield + 1 : 0) + 10) * (st.hp | 0)) / 50);
    for (const sid of (d.specials || [])) { const sp = sid >= 0 ? K.SPECIALS[sid] : null; if (sp && sp.n >= 9) v += 2 * sp.tech.l; }
    if (!E.human) { if (flags.held) v *= 2; if (flags.ended) v *= 2; }
    return v;
  };
  Intel.threats = function (ctx) {
    const sh = ctx.shared;
    if (sh.threat) return sh.threat;
    const th = [];
    for (let i = 0; i < 6; i++) th.push(Intel.designThreat(ctx.S, ctx.E, i));
    return (sh.threat = th);
  };

  // ---- fronts (research/07 §3.3, research/08 §4.2): where the free colony ships appear and where the idle fleets gather -----------------------------------------
  // anchor planet of a front point: the nearest owned planet, overridden by the nearest "defended" one (a missile base, or exactly ONE ship in the first non-empty stack — a quirk)
  function anchorFor(ctx, x, y) {
    const S = ctx.S, mine = ctx.mine(), orbit = ctx.shared.orbit;
    let best = mine[0].id, bd = 10000;
    for (const p of mine) {
      const s = S.stars[p.starId], d = Geo.distFast(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = p.id; }
    }
    bd = 10000;
    for (const p of mine) {
      let def = (p.bases | 0) > 0 ? 1 : 0;
      if (!def) { const o = orbit[p.starId]; if (o) for (let j = 0; j < 6 && !def; j++) def += o[j]; }
      if (def !== 1) continue;
      const s = S.stars[p.starId], d = Geo.distFast(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = p.id; }
    }
    return best;
  }

  Intel.fronts = function (ctx) {
    const S = ctx.S, me = ctx.id, sh = Intel.init(ctx), mine = ctx.mine();
    sh.fronts = []; sh.force = []; sh.forceSum = 0; sh.forceOwnSum = 0;
    if (!mine.length || !sh.centre) return sh.fronts;
    const merge = sh.bestSpeed * 10 + 10, cm = sh.centre[me], raw = [];
    for (const o of S.empires) {
      if (o.id === me || !sh.contact || !sh.contact[o.id]) continue;
      if (sh.ended && sh.refusers.indexOf(o.id) < 0) continue;
      const c = sh.centre[o.id];
      const x = trunc((c.x * 4 + cm.x * 6) / 10), y = trunc((c.y * 4 + cm.y * 6) / 10);
      if (raw.some(f => Geo.distFast(f.x - x, f.y - y) <= merge)) continue;                    // within merge range of an earlier front: dropped (not summed)
      raw.push({ x, y, rel: Math.min(relation(ctx, o.id), 0), enemy: o.id, enemies: [o.id] });
    }
    if (!raw.length) raw.push({ x: cm.x, y: cm.y, rel: 80, enemy: -1, enemies: [] });          // isolated: one dummy front at home, "peaceful" (+80)
    for (const f of raw) f.anchor = anchorFor(ctx, f.x, f.y);
    for (let pass = 0; pass < 5; pass++) {                                                      // fronts sharing an anchor planet are merged, relation weights add
      let i = 0;
      while (i < raw.length) {
        let m = -1;
        for (let j = i + 1; j < raw.length; j++) if (raw[j].anchor === raw[i].anchor) m = j;
        if (m >= 0) { raw[i].rel += raw[m].rel; raw[i].enemies = raw[i].enemies.concat(raw[m].enemies); raw.splice(m, 1); } else i++;
      }
    }
    const th = Intel.threats(ctx);
    let sum = 0;
    for (let s = 0; s < S.stars.length; s++) {
      const ow = S.planets[s].owner, o = sh.orbit[s];
      let v = 0;
      if ((ow === me || ow < 0) && o) for (let i = 0; i < 6; i++) if (o[i]) v += th[i] * o[i];
      sh.force[s] = v; sum += v;
    }
    sh.forceSum = sum; sh.forceOwnSum = trunc(sum / 25);
    sh.fronts = raw.map(f => {
      const a = S.stars[S.planets[f.anchor].starId], force = sh.force[f.anchor] || 0;
      return { anchor: f.anchor, star: S.planets[f.anchor].starId, enemy: f.enemy, enemies: f.enemies, dist: Geo.distFast(a.x - f.x, a.y - f.y), x: f.x, y: f.y,
        rel: f.rel, value: f.rel + (sum ? trunc(force * 100 / sum) : 0), force };
    });
    return sh.fronts;
  };

  // ---- step 10 --------------------------------------------------------------------------------------------------------------------------------------------------
  AI.step('intel', 10, function (ctx) {
    const S = ctx.S, sh = Intel.init(ctx);
    sh.centre = Intel.centres(S);
    sh.bestSpeed = Intel.bestPropulsion(ctx.E) + 3;
    sh.ended = Intel.gameEnded(S); sh.refusers = Intel.refusers(S);
    sh.contact = {}; sh.humanContact = false;
    for (const o of S.empires) {
      if (o.id === ctx.id) continue;
      const c = !!(o.alive && Intel.contactWith(S, ctx.id, o.id));
      sh.contact[o.id] = c;
      if (c && o.human) sh.humanContact = true;
    }
    const col = Intel.scanColonizable(ctx);
    sh.colonyFor = col.thr; sh.haveColonizable = col.have; sh.colonizable = col.list;
    Intel.threats(ctx);
    Intel.fronts(ctx);
  });
});
