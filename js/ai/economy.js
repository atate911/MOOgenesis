// AI step 40 — economy tail of the original p1 (research/07 §2.6, §2.10–§2.12, §1.3 steps 11–14, §12 P42 · research/08 §4.7, §5.2): population relocation between own planets (`trans_own`),
// panic mode (`build_defending_ships`), reserve funding of developing planets (`fund_developing`), the AI tax roll, and the AI's reactions to planet events (`crank_tech` / `crank_ship`).
// Pure planner: emits `trans`, `transfer` and `tax` orders and edits the PLANNED sliders through the ctx overlay (ctx.sliders/setSliders) so the p3 step (50) sees the panic sliders.
// Invasion transports (`trans_en`) belong to the military agent; they run first (step 30) and this step never reuses a source planet they already committed (it reads ctx.orders).
//
// ORDER INSIDE THE STEP (the original's p1 order, with the event cranks first because the original runs them in the previous turn's event phase, i.e. before this turn's p1):
//   events (cranks) → trans_own → build_defending_ships (panic) → fund_developing → tax
//
// RULES (research/07):
//   trans_own    destinations = my planets with pop < max_pop3/3 (integer) or in rebellion, minus those that already have one of my transports on the way; sources = my planets with
//                pop > (max_pop3·3)/4 (not in rebellion — Classic did not check); outer loop over destinations in planet order, the FIRST source in planet order within (BS·20+20) map units
//                (dist_fast, strict <, BS = best engine tech level + 3, see ctx.shared.bestSpeed) sends pop/3; every source serves one destination per turn.  → `trans {planet,to,n}`.
//   panic        a planet is threatened when an en-route fleet of ANOTHER empire has it as destination (allied fleets too in Classic).  SHIP += DEF+IND+TECH, those three := 0 (ECO
//                untouched), then 1/5 of the (remaining) empire reserve is moved onto the planet (`transfer`).  Every threatened planet in planet order, the pool shrinks each time.
//   developing   every planet with pop < 20 takes 1/5 of the remaining reserve, in planet order.
//   tax          from year 20: per-mille tax = rnd(10) + difficulty + 2 (3..12 Simple … 7..16 Impossible); before year 20 it is 0.  (Half the tax goes to the reserve — Econ.stepReserve.)
//   events       plague / nova planets (planet.event.type): TECH += SHIP+IND+DEF, those := 0; comet / pirates (the pirates' star planet): SHIP += TECH+IND+DEF, those := 0; plus 1/5 of the
//                reserve onto the planet — every turn the event lasts.  (Sim/events.js already applies the slider part itself in the event phase; here it is idempotent and adds the per-turn
//                reserve share, which the sim only pays once.)
//
// QUIRKS (AI.QUIRKS.<name>; true = original v1.3 behaviour, false = fixed; options.aiClassic switches all on).  Defaults in brackets.
//   panicCountsAllies    [false] Classic counts ALLIED fleets heading for my planet as threats; Classic+/fixed ignores them.
//   transOwnRebelSource  [false] Classic lets a planet in rebellion with pop > 3/4 max act as a relocation source (it can even pair with itself); fixed: rebels never send.
//   transOwnOverwrite    [false] Classic does not look at a source that already sends an invasion transport this turn (the second order overwrites the first); fixed: such a planet is skipped.
//
// EXPORTS AI.Economy = { bestSpeed, threatened, transOwn, panic, developing, taxValue, events }  (for tests and tools).
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, Geo = M.Sim.Geo;
  AI.QUIRKS = AI.QUIRKS || {};
  const QDEF = { panicCountsAllies: false, transOwnRebelSource: false, transOwnOverwrite: false };
  for (const q in QDEF) if (AI.QUIRKS[q] === undefined) AI.QUIRKS[q] = QDEF[q];
  const ENGINE_LEVELS = [6, 12, 18, 24, 30, 36, 42, 48];
  const total = a => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };

  // BS = P + 3, P = highest owned engine tech level (research/07 §8.4); the intel step publishes it in ctx.shared.bestSpeed
  function bestSpeed(ctx) {
    if (typeof ctx.shared.bestSpeed === 'number') return ctx.shared.bestSpeed;
    const done = ctx.E.research && ctx.E.research.completed ? ctx.E.research.completed[4] : null;
    let P = 0;
    if (done) for (const L of ENGINE_LEVELS) if (done.indexOf(L) >= 0) P = L;
    return P + 3;
  }

  // ---- trans_own ------------------------------------------------------------------------------------------------------------------------------------------
  function transOwn(ctx) {
    const S = ctx.S, mine = ctx.mine();
    const lim = bestSpeed(ctx) * 20 + 20;
    const rebelSrc = ctx.quirk('transOwnRebelSource'), overwrite = ctx.quirk('transOwnOverwrite');
    const from = new Set(), to = new Set();
    for (const p of mine) {
      if (p.pop < Math.floor(p.mp3 / 3) || p.unrest === 2) to.add(p.id);
      if (p.pop > Math.floor(p.mp3 * 3 / 4) && (rebelSrc || p.unrest !== 2)) from.add(p.id);
    }
    for (const t of S.trans || []) if (t.owner === ctx.id) to.delete(t.to);                      // a transport of mine is already on its way there
    if (!overwrite) for (const o of ctx.orders) if (o.t === 'trans') from.delete(o.planet);      // that planet already sends an invasion transport this turn
    for (const p of mine) if (p.trans && p.trans.n > 0 && !overwrite) from.delete(p.id);
    const sent = [];
    for (const d of mine) {
      if (!to.has(d.id)) continue;
      for (const s of mine) {                                                                     // first source in planet order, not the nearest
        if (!from.has(s.id)) continue;
        if (Geo.unitDist(S, s.starId, d.starId) < lim) {
          from.delete(s.id);
          const n = Math.floor(s.pop / 3);
          if (s.id !== d.id && n > 0) { ctx.order({ t: 'trans', planet: s.id, to: d.starId, n }); sent.push({ from: s.id, to: d.id, n }); }
          break;
        }
      }
    }
    return sent;
  }

  // ---- panic mode + developing planets ----------------------------------------------------------------------------------------------------------------------
  // ids of my planets that an en-route fleet of another empire is heading for
  function threatened(ctx) {
    const S = ctx.S, out = new Set(), allies = ctx.quirk('panicCountsAllies');
    for (const f of S.fleets) {
      if (f.owner === ctx.id || f.star >= 0 || f.to < 0 || !total(f.ships)) continue;
      const dest = S.planets[f.to];
      if (!dest || dest.owner !== ctx.id) continue;
      if (!allies && ctx.allied(f.owner)) continue;
      out.add(dest.id);
    }
    return out;
  }
  function panic(ctx) {
    const hot = threatened(ctx), done = [];
    for (const p of ctx.mine()) {
      if (!hot.has(p.id)) continue;
      const s = ctx.sliders(p);
      s[0] += s[1] + s[2] + s[4]; s[1] = 0; s[2] = 0; s[4] = 0;                                  // ECO untouched
      ctx.setSliders(p, s);
      ctx.fund(p, Math.floor(ctx.reserve() / 5));
      done.push(p.id);
    }
    return done;
  }
  function developing(ctx) {
    const done = [];
    for (const p of ctx.mine()) if (p.pop < 20) { ctx.fund(p, Math.floor(ctx.reserve() / 5)); done.push(p.id); }
    return done;
  }

  // ---- tax -----------------------------------------------------------------------------------------------------------------------------------------------------
  const taxValue = (R, year, diff) => (year >= 20 ? R.int(1, 10) + diff + 2 : 0);

  // ---- event reactions (crank_tech / crank_ship) ------------------------------------------------------------------------------------------------------------------
  function events(ctx) {
    const S = ctx.S, done = [];
    const pir = S.events && S.events.pirates && S.events.pirates.hp > 0 ? S.events.pirates.star : -1;
    for (const p of ctx.mine()) {
      const t = p.event && p.event.type;
      const kind = t === 'plague' || t === 'nova' ? 'tech' : t === 'comet' || p.starId === pir ? 'ship' : null;
      if (!kind) continue;
      const s = ctx.sliders(p);
      if (kind === 'tech') { s[4] += s[0] + s[1] + s[2]; s[0] = 0; s[1] = 0; s[2] = 0; }
      else { s[0] += s[4] + s[2] + s[1]; s[4] = 0; s[2] = 0; s[1] = 0; }
      ctx.setSliders(p, s);
      ctx.fund(p, Math.floor(ctx.reserve() / 5));
      done.push({ planet: p.id, kind });
    }
    return done;
  }

  AI.step('economy', 40, function (ctx) {
    if (!ctx.mine().length) return;
    events(ctx);
    transOwn(ctx);
    panic(ctx);
    developing(ctx);
    const value = taxValue(ctx.R, ctx.year, ctx.diff);
    if (value !== (ctx.E.tax | 0)) ctx.order({ t: 'tax', value });
  });

  AI.Economy = { bestSpeed, threatened, transOwn, panic, developing, taxValue, events, QDEF };
});
