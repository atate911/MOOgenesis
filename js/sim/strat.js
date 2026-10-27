// Strategic choices — an optional rule set (settings.options.strategic, New game › Remake options, off by default). Three decisions the original lacks:
//   colony focus      every colony may take one focus; it needs RETOOL turns to start working after each change
//                       industry  production +10 %, the colony's research −20 %
//                       science   production −10 %, the colony's research +30 %
//                       growth    production −10 %, population growth +50 %
//                       fortress  production −10 %, defence spending +50 %, ground troops +15 when defending it
//   galactic projects one-time empire projects bought from the reserve, unlocked by a field's tech level (PROJECTS below)
//   research pacts    a new treaty kind proposed in the audience (Propose Treaty › Research Agreement) and formed between AIs: each pact adds
//                       PACT_PCT % to both partners' research, at most PACT_MAX pacts count; war ends it, so does a relation below PACT_BREAK
// Every hook is a no-op in a game without the option: the state fields (p.focus, E.projects, relation.pact) only ever exist when it is on.
//   St.on(S) · St.focusOf(p) · St.prodPct(p) · St.growthPct(p) · St.rpPct(p) · St.defPct(p) · St.ground(p) · St.project(id) · St.projectCost(S,E,id)
//   St.canBuy(S,E,id) → '' | reason · St.pacts(S,E) · St.setPact(S,a,b,on) · St.turn(S,R)        orders: {t:'focus', planet, focus} · {t:'project', id}
MOO.def(function (M) {
  'use strict';
  const St = M.Sim.Strat = {};
  const MAX_POP = 300;
  St.RETOOL = 3;
  St.PACT_PCT = 5; St.PACT_MAX = 2; St.PACT_BREAK = -10; St.PACT_REL = 25;
  St.FOCUS = {
    industry: { name: 'Industry', prod: 10, rp: -20, text: 'Production +10%, research from this colony −20%' },
    science: { name: 'Science', prod: -10, rp: 30, text: 'Research from this colony +30%, production −10%' },
    growth: { name: 'Growth', prod: -10, growth: 50, text: 'Population growth +50%, production −10%' },
    fortress: { name: 'Fortress', prod: -10, def: 50, ground: 15, text: 'Defence spending +50%, ground troops +15 when defending, production −10%' },
  };
  St.FOCUS_KEYS = Object.keys(St.FOCUS);
  // field: 0 Computers … 5 Weapons; tl: that field's tech level needed; cost(S, E) in BC
  const colonies = (S, E) => S.planets.filter(p => p.owner === E.id).length;
  St.PROJECTS = [
    { id: 'cartography', name: 'Stellar Cartography', field: 0, tl: 5, cost: () => 150, text: 'Every star in the galaxy is charted: its planet and specials become known.' },
    { id: 'envoys', name: 'Envoy Corps', field: 0, tl: 8, cost: () => 300, text: 'Ambassadors to every empire you have met improve their relations with you.' },
    { id: 'habitats', name: 'Orbital Habitats', field: 1, tl: 12, cost: (S, E) => Math.max(400, 100 * colonies(S, E)), text: 'Every colony you own now gains 10% max population (at least 3), for good.' },
    { id: 'archive', name: 'Grand Archive', field: 0, tl: 14, cost: (S, E) => Math.max(300, 2 * (E.research.total | 0)), text: 'Three turns of research at once, shared out as your research sliders are set.' },
  ];

  St.on = S => !!(S && S.settings && S.settings.options && S.settings.options.strategic);
  St.focusOf = p => (p && p.focus && !(p.focusT > 0) ? p.focus : null);
  const fx = (p, k) => { const f = St.focusOf(p); return f ? (St.FOCUS[f][k] | 0) : 0; };
  St.prodPct = p => fx(p, 'prod');
  St.growthPct = p => fx(p, 'growth');
  St.rpPct = p => fx(p, 'rp');
  St.defPct = p => fx(p, 'def');
  St.ground = p => fx(p, 'ground');
  St.project = id => St.PROJECTS.find(x => x.id === id) || null;
  St.projectCost = (S, E, id) => { const x = St.project(id); return x ? x.cost(S, E) | 0 : 0; };
  St.canBuy = function (S, E, id) {
    const x = St.project(id);
    if (!St.on(S) || !x) return 'not available';
    if (E.projects && E.projects[id] !== undefined) return 'already done';
    if ((E.research.tl[x.field] | 0) < x.tl) return M.Data.Techs.FIELD_NAMES[x.field] + ' tech level ' + x.tl + ' needed';
    if ((E.bc | 0) < St.projectCost(S, E, id)) return 'not enough BC in the reserve';
    return '';
  };

  // ---- research pacts -------------------------------------------------------------------------------------------------------------------------
  const relOf = (S, a, b) => { const E = S.empires[a]; return E && E.relations ? E.relations[b] : null; };
  St.hasPact = (S, a, b) => { const r = relOf(S, a, b); return !!(r && r.pact); };
  St.pacts = function (S, E) { let n = 0; for (const O of S.empires) if (O.id !== E.id && O.alive && St.hasPact(S, E.id, O.id)) n++; return n; };
  St.researchPct = (S, E) => (St.on(S) ? St.PACT_PCT * Math.min(St.PACT_MAX, St.pacts(S, E)) : 0);
  St.setPact = function (S, a, b, on) {
    const ra = relOf(S, a, b), rb = relOf(S, b, a); if (!ra || !rb) return false;
    if (on) { ra.pact = rb.pact = (S.turn | 0) + 1; } else { delete ra.pact; delete rb.pact; }             // the turn signed + 1 (never 0: falsy)
    return true;
  };
  St.mayPact = function (S, a, b) {
    const r = relOf(S, a, b), D = M.Sim.Diplo;
    if (!St.on(S) || !r || !r.contact || r.pact) return false;
    return !(D && D.T && r.treaty >= D.T.WAR);
  };

  // ---- orders ---------------------------------------------------------------------------------------------------------------------------------
  const O = M.Sim.Orders;
  O.register('focus', function (S, E, o) {
    if (!St.on(S)) return O.fail('strategic choices are off');
    const p = S.planets[o.planet];
    if (!p || p.owner !== E.id) return O.fail('not your colony');
    const f = o.focus === null || o.focus === '' || o.focus === undefined ? null : String(o.focus);
    if (f !== null && !St.FOCUS[f]) return O.fail('no such focus');
    if ((p.focus || null) === f) return O.ok();
    if (f === null) { delete p.focus; delete p.focusT; delete p.focusSince; return O.ok(); }
    p.focus = f; p.focusT = St.RETOOL; p.focusSince = S.turn | 0;
    return O.ok({ retool: St.RETOOL });
  });
  O.register('project', function (S, E, o) {
    const why = St.canBuy(S, E, o.id);
    if (why) return O.fail(why);
    const cost = St.projectCost(S, E, o.id);
    E.bc -= cost;
    (E.projects || (E.projects = {}))[o.id] = S.turn | 0;
    const out = St.applyProject(S, E, o.id);
    if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'notice', kind: 'project', empire: E.id, project: o.id, name: St.project(o.id).name, cost, result: out });
    return O.ok({ cost, result: out });
  });

  St.applyProject = function (S, E, id) {
    if (id === 'cartography') { let n = 0; for (let s = 0; s < S.stars.length; s++) if (M.Sim.Vis.explore(S, E, s)) n++; return { stars: n }; }
    if (id === 'envoys') {
      let n = 0; const D = M.Sim.Diplo;
      for (const O2 of S.empires) { const r = relOf(S, E.id, O2.id); if (O2.id === E.id || !O2.alive || !r || !r.contact || !D || !D.act) continue; if (D.act(S, 20, E.id, O2.id, 0)) n++; }
      return { empires: n };
    }
    if (id === 'habitats') {
      let total = 0;
      for (const p of S.planets) {
        if (p.owner !== E.id) continue;
        const a = Math.max(3, Math.round((p.mp1 || p.maxPop || 0) / 10));
        p.mp1 = Math.min(MAX_POP, (p.mp1 | 0) + a); p.mp2 = Math.min(MAX_POP, (p.mp2 | 0) + a); p.mp3 = Math.min(MAX_POP, (p.mp3 | 0) + a);
        (p.xi || (p.xi = {})).habitats = a; total += a;
      }
      return { pop: total };
    }
    if (id === 'archive') {
      const rs = E.research, rp = 3 * (rs.total | 0); let given = 0;
      const sum = rs.slider.reduce((a, b) => a + (b | 0), 0) || 1;
      for (let f = 0; f < 6; f++) { const add = Math.floor(rp * (rs.slider[f] | 0) / sum); rs.invest[f] = (rs.invest[f] | 0) + add; given += add; }
      return { rp: given };
    }
    return {};
  };

  // ---- per turn: retooling, AI↔AI research pacts and their breaking ------------------------------------------------------------------------------
  St.turn = function (S, R) {
    if (!St.on(S)) return;
    for (const p of S.planets) if (p.focusT > 0) { p.focusT--; if (p.owner < 0) { delete p.focus; delete p.focusT; } }
    const n = S.empires.length, D = M.Sim.Diplo;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const A = S.empires[a], B = S.empires[b], ra = relOf(S, a, b), rb = relOf(S, b, a);
      if (!ra || !rb) continue;
      if (ra.pact) {
        const atWar = D && D.T && ra.treaty >= D.T.WAR;
        if (!A.alive || !B.alive || atWar || !ra.contact || (!A.human && ra.rel1 < St.PACT_BREAK) || (!B.human && rb.rel1 < St.PACT_BREAK)) St.setPact(S, a, b, false);
        continue;
      }
      if (A.human || B.human || !A.alive || !B.alive || !St.mayPact(S, a, b)) continue;
      if (ra.rel1 >= St.PACT_REL && rb.rel1 >= St.PACT_REL && R.int(1, 12) === 1) { St.setPact(S, a, b, true); if (D && D.logEntry) D.logEntry(S, 'pact', a, b); }
    }
  };
});
