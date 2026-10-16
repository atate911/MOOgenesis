// Planning context handed to every AI step: read-only views of the game from one empire's point of view + helpers to emit orders. Worker-safe.
//   ctx.S ctx.E ctx.id ctx.R (forked RNG) ctx.diff (0..4) ctx.pers (personality idx) ctx.obj (objective idx) ctx.race (id) ctx.rd (Data.Races record) ctx.mod (race mods) ctx.aiMod (race AI hooks)
//   ctx.order(o) · ctx.patch({k:v}) · ctx.log(msg) · ctx.errors · ctx.finish()
//   ctx.mine() → my planets · ctx.dist(starA, starB) parsecs · ctx.fleets(owner?) · ctx.known(starId) → explored by me · ctx.range(starId) → my fuel flag 0/1/2
//   ctx.enemies() / ctx.atWar(e) / ctx.treaty(e) (via Diplo when present) · ctx.designStats(slot) · ctx.state → E.ai (read-only; use ctx.patch)
// Planned-state helpers — later steps see what earlier steps decided in the SAME plan (the snapshot S itself never changes):
//   ctx.sliders(p) → planned [ship,def,ind,eco,tech] of planet p (or id) · ctx.setSliders(p, arr)  (emitted once per planet, at finish, as one `sliders` order)
//   ctx.build(p) → planned build item (design slot | -1 stargate) · ctx.setBuild(p, item)           (emitted once per planet as one `build` order)
//   ctx.reserve() → planned empire reserve BC · ctx.fund(p, bc) → emits `transfer` and lowers the planned reserve (never more than is left)
//   ctx.shared → scratch object for cross-step hand-over within one plan (documented by the step that fills it: intel.js fronts/centres, colonize.js needConquer…)
//   ctx.quirk(name) → bool: original-game bugs are switchable (`AI.QUIRKS[name]`, default = fixed; `S.settings.options.aiClassic` flips every quirk to the original behaviour)
//   ctx.fix(name) → bool: behaviour fixes outside the quirk table (`AI.FIXES[name]`, default true = fixed; aiClassic turns them all off)
MOO.def(function (M) {
  'use strict';
  const AI = M.AI, Geo = M.Sim.Geo;
  const PERS = ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic'];
  const OBJ = ['diplomat', 'militarist', 'expansionist', 'technologist', 'industrialist', 'ecologist'];
  AI.PERS = PERS; AI.OBJ = OBJ;
  AI.QUIRKS = AI.QUIRKS || {};            // modules register their own: AI.QUIRKS.fourthColonyShip = false (false = fixed, true = original behaviour)
  // Behaviour fixes OUTSIDE the audited quirk table (tools/rules/83-balance pins AI.QUIRKS to the decisions in tools/balance/REPORT.md): modules register AI.FIXES.<name> = true
  // (true = fixed, the default; false = the original behaviour).  `options.aiClassic` switches every one off, like it switches every quirk on.  Read with ctx.fix(name).
  AI.FIXES = AI.FIXES || {};

  AI.ctx = function (S, eid, seed) {
    const E = S.empires[eid];
    const R = M.RNG.create(S.seed + ':ai:' + eid + ':' + seed);
    const rd = M.Data.Races && M.Data.Races.races ? M.Data.Races.races[E.race] : null;
    const patchObj = {}, orders = [], cache = {}, slidersPlan = {}, buildPlan = {};
    let reservePlan = E.bc | 0;
    const pid = p => (p !== null && typeof p === 'object' ? p.id : p);
    const classic = !!(S.settings && S.settings.options && S.settings.options.aiClassic);
    const ctx = {
      S, E, id: eid, R, diff: S.settings.diffIdx | 0, pers: E.personality, obj: E.objective, race: E.race, rd, mod: rd ? rd.mod : {}, aiMod: rd ? rd.ai : {},
      year: S.year, turn: S.turn, state: E.ai || {}, errors: [], orders, shared: {},
      order(o) { orders.push(o); return o; },
      patch(p) { Object.assign(patchObj, p); },
      log(msg) { if (AI.debug && typeof console !== 'undefined') console.log('[AI ' + eid + ']', msg); },
      persName: () => PERS[E.personality], objName: () => OBJ[E.objective],
      quirk: name => (classic ? true : !!AI.QUIRKS[name]),
      fix: name => (classic ? false : AI.FIXES[name] !== false),
      dist: (a, b) => (a === b ? 0 : Geo.parsecs(S, a, b)),
      mine() { return cache.mine || (cache.mine = S.planets.filter(p => p.owner === eid)); },
      planetsOf(e) { return S.planets.filter(p => p.owner === e); },
      known: star => !!E.explored[star],
      range: star => (E.frange ? E.frange[star] : 0),
      fleets(owner) { const o = owner === undefined ? eid : owner; return S.fleets.filter(f => f.owner === o && f.ships.reduce((a, b) => a + b, 0) > 0); },
      myStationary() { return S.fleets.filter(f => f.owner === eid && f.star >= 0 && f.ships.reduce((a, b) => a + b, 0) > 0); },
      designStats(slot) { return M.Sim.Design.stats(S, E, slot); },
      designSlot(pred) { for (let i = 0; i < 6; i++) { if (E.designs[i] && pred(M.Sim.Design.stats(S, E, i), E.designs[i], i)) return i; } return -1; },
      alive() { return S.empires.filter(e => e.alive && e.id !== eid); },
      atWar(e) { return !!(M.Sim.Diplo && M.Sim.Diplo.atWar && M.Sim.Diplo.atWar(S, eid, e)); },
      allied(e) { return !!(M.Sim.Diplo && M.Sim.Diplo.isAllied && M.Sim.Diplo.isAllied(S, eid, e)); },
      contact(e) { return !!(M.Sim.Diplo && M.Sim.Diplo.hasContact && M.Sim.Diplo.hasContact(S, eid, e)); },
      treaty(e) { const st = M.Sim.Diplo && M.Sim.Diplo.status ? M.Sim.Diplo.status(S, eid, e) : null; return st ? st.treaty : 'none'; },
      enemies() { return S.empires.filter(e => e.alive && e.id !== eid && ctx.atWar(e.id)); },

      // ---- planned state ----------------------------------------------------------------------------------------------------------------------
      sliders(p) { const id = pid(p); return (slidersPlan[id] || S.planets[id].sliders).slice(); },
      setSliders(p, arr) { slidersPlan[pid(p)] = arr.slice(); },
      build(p) { const id = pid(p); return id in buildPlan ? buildPlan[id] : S.planets[id].build; },
      setBuild(p, item) { buildPlan[pid(p)] = item; },
      reserve() { return reservePlan; },
      fund(p, bc) {
        const amt = Math.max(0, Math.min(Math.floor(bc), reservePlan)); if (!amt) return 0;
        reservePlan -= amt; orders.push({ t: 'transfer', planet: pid(p), amount: amt }); return amt;
      },
      finish() {
        for (const k of Object.keys(slidersPlan)) {
          const p = S.planets[+k], v = slidersPlan[k];
          if (p.sliders.some((x, i) => x !== v[i])) orders.push({ t: 'sliders', planet: p.id, values: v });
        }
        for (const k of Object.keys(buildPlan)) { const p = S.planets[+k]; if (p.build !== buildPlan[k]) orders.push({ t: 'build', planet: p.id, design: buildPlan[k] }); }
        if (Object.keys(patchObj).length) orders.push({ t: 'aiState', patch: patchObj });
        if (ctx.errors.length) orders.push({ t: 'aiLog', errors: ctx.errors.map(e => ({ step: String(e.step), msg: String(e.msg).slice(0, 600) })) });   // step exceptions → S.aiLog (js/ai/ai.js)
        return orders;
      },
    };
    return ctx;
  };
});
