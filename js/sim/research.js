// Research (research/02 §1): six fields, per-field sliders, probabilistic breakthroughs with 15% "interest", per-empire random tech lists,
// choose-next-tech, RP from planet output, tech effects aggregated into E.mods / E.grants. Worker-safe. Needs MOO.Data.Techs.
//
// E.research = { slider:[6], lock:[6], completed:[[levels]×6], project:[6], invest:[6], cost:[6], list:[6][10][≤3], tl:[6], total }
// E.mods     = derived numeric/flag modifiers from owned techs (see recompute) ;  E.grants = { 'kind:id': true } ship parts etc. unlocked
MOO.def(function (M) {
  'use strict';
  const Rs = M.Sim.Research = {};
  const MIN_KEYS = { factoryCost: 1, wasteScale: 1, incPopCost: 1, colonyFor: 1 };   // lower is better; every other numeric key: higher is better
  const DEFAULT_SLIDERS = [20, 10, 15, 15, 20, 20];

  const TECHS = () => M.Data.Techs;

  Rs.init = function (S, E, R) {
    const T = TECHS();
    let list = null;
    for (let i = 0; i < 50 && !list; i++) list = T.generateResearchList(R, E.race);
    E.research = {
      slider: DEFAULT_SLIDERS.slice(), lock: [false, false, false, false, false, false],
      completed: [[1], [1], [1], [1], [1], [1]], project: [0, 0, 0, 0, 0, 0], invest: [0, 0, 0, 0, 0, 0], cost: [0, 0, 0, 0, 0, 0],
      list, tl: [1, 1, 1, 1, 1, 1], total: 0,
    };
    Rs.recompute(E);
    return E.research;
  };

  // ---- derived numbers ------------------------------------------------------------------------------------------------
  Rs.tl = function (E, f) { return TECHS().tl(f, E.research.completed[f]); };
  Rs.refreshTL = function (E) { for (let f = 0; f < 6; f++) E.research.tl[f] = Rs.tl(E, f); };
  Rs.techAt = function (f, level) { const T = TECHS(); return T.byFL ? T.byFL[f][level] : T.byField[f].find(t => t.level === level); };
  Rs.has = function (E, f, level) { return E.research.completed[f].indexOf(level) >= 0; };

  // Aggregate every owned tech's effects. Numeric keys: best value wins (lowest for MIN_KEYS); booleans OR; groundTier keeps best tier per group.
  Rs.recompute = function (E) {
    const rs = E.research, mods = { factoryCost: 10, robotic: 2, wasteScale: 10, ecoRestore: 2, fuel: 3, scan: 3, transportSpeed: 1, colonyFor: 7,
      terraform: 0, terraformCost: 0, incPopCost: 20, antidote: 0, planetShield: 0, planetShieldCost: 0, baseHp: 0, ground: { armor: 0, suit: 0, shield: 0, weapon: 0 } };
    const grants = {};
    const T = TECHS();
    // processing order: every tech in ascending level, except those acquired later (rs.seq = acquisition order of Rs.grant) which come last in that order.
    // base HP / transport HP / ground gear tiers take the LAST acquired tech of their group, not the best (research/03-verification #6, G2): a lower tier traded or stolen
    // after a higher one overwrites it. Without rs.seq (old saves, the starting techs) the order is ascending, i.e. last = best as before.
    const order = [], seq = Array.isArray(rs.seq) ? rs.seq : [], inSeq = {};
    for (const x of seq) inSeq[x[0] * 1000 + x[1]] = true;
    for (let f = 0; f < 6; f++) for (const lvl of rs.completed[f]) if (!inSeq[f * 1000 + lvl]) order.push([f, lvl]);
    for (const x of seq) if (rs.completed[x[0]].indexOf(x[1]) >= 0) order.push(x);
    for (const [f, lvl] of order) {
      {
        // level 1 is the free starting BUNDLE (several techs share it); every other level is exactly one tech
        const list = lvl === 1 ? (T.l1Bundle && T.l1Bundle[f] ? T.l1Bundle[f] : [Rs.techAt(f, 1)]) : [Rs.techAt(f, lvl)];
        for (const t of list) {
          if (!t) continue;
          const fx = t.effects || {};
          for (const k in fx) {
            const v = fx[k];
            if (k === 'planetShield') { if (v.level > mods.planetShield) { mods.planetShield = v.level; mods.planetShieldCost = v.cost; } }
            else if (k === 'groundTier') mods.ground[v.group] = v.tier;
            else if (k === 'baseHp') mods.baseHp = v;
            else if (k === 'terraform') { if (v > mods.terraform) mods.terraform = v; }
            else if (k === 'terraformCost') { mods.terraformCost = (fx.terraform >= mods.terraform) ? v : mods.terraformCost; }
            else if (typeof v === 'number') { if (MIN_KEYS[k]) mods[k] = Math.min(mods[k] === undefined ? v : mods[k], v); else mods[k] = Math.max(mods[k] === undefined ? v : mods[k], v); }
            else if (typeof v === 'boolean') { if (v) mods[k] = true; }
          }
          if (t.grants) for (const g of t.grants) grants[g.kind + ':' + g.id] = true;
        }
      }
    }
    // Silicoids (original override): colony bases settle anything (Radiated is the floor) and the soil / atmosphere projects never exist for them, whatever they own
    if (E.race === 'silicoid') { mods.colonyFor = 1; delete mods.soil; delete mods.advSoil; delete mods.atmos; }
    E.mods = mods; E.grants = grants;
    Rs.refreshTL(E);
    return mods;
  };

  // ---- RP income ------------------------------------------------------------------------------------------------------
  // planet research output (BC -> RP is 1:1): production after upkeep x tech slider; Psilon +50%, artifacts x2, Orion x4. `prodAfterMaint` supplied by the colony module.
  Rs.planetRP = function (E, planet, prodAfterMaint) {
    let v = Math.floor(prodAfterMaint * planet.sliders[4] / 100);
    if (E.race === 'psilon') v += Math.floor(v / 2);
    if (planet.special === 'artifacts') v *= 2;
    if (planet.special === 'orion') v *= 4;
    return Math.min(v, 32767);
  };

  // ---- projects ----------------------------------------------------------------------------------------------------------
  Rs.choices = function (E, f) { return TECHS().choiceList(E.research.list[f], E.research.completed[f]); };
  Rs.projectCost = function (S, E, f, level) {
    const T = TECHS();
    if (E.human) return T.costHuman(level, E.race, f, S.settings.diffIdx);
    return T.costAI(level, E.race, f);
  };
  // Start (or replace) the project of a field. Replacing a project that is under way throws the accumulated pile away (original: investment = 0);
  // starting from "no project" keeps whatever pile there is (completion leaves 1, RP put into an idle field keeps accumulating).
  Rs.start = function (S, E, f, level) {
    const rs = E.research;
    if (!Rs.choices(E, f).includes(level)) return false;
    if (rs.project[f] === level) return true;
    if (rs.project[f] !== 0) rs.invest[f] = 0;
    rs.project[f] = level;
    rs.cost[f] = Rs.projectCost(S, E, f, level);
    return true;
  };
  // AI project choice: harder AIs lean to the highest-level entry
  Rs.aiPick = function (S, E, f, R) {
    const ch = Rs.choices(E, f); if (!ch.length) return 0;
    const diff = S.settings.diffIdx | 0;
    const level = (R.int(1, 6) < diff) ? ch[ch.length - 1] : ch[R.int(0, ch.length - 1)];
    Rs.start(S, E, f, level);
    return level;
  };
  // The AI's very FIRST project of a field (new game): uniformly one of its tier-1 entries whatever the difficulty, and — an original quirk — its RP cost is
  // level² × 50 for every race (instead of the normal AI formula). Returns the level (0 when the field offers nothing).
  Rs.aiFirst = function (S, E, f, R) {
    const ch = Rs.choices(E, f); if (!ch.length) return 0;
    const level = ch[R.int(0, ch.length - 1)];
    if (!Rs.start(S, E, f, level)) return 0;
    // QUIRK Config.QUIRKS.aiFirstTechCost (default ON = original v1.3; OFF = 1oom's ai_first_tech_cost_fix: the normal AI cost, Techs.costAI); options.aiClassic forces ON
    const Q = M.Data.Config && M.Data.Config.QUIRKS, classic = !!(S.settings && S.settings.options && S.settings.options.aiClassic);
    if (classic || !Q || Q.aiFirstTechCost !== false) E.research.cost[f] = level * level * 50;
    return level;
  };

  // grant a tech by any route (research completion, spy theft, loot, trade…). Returns true if new.
  Rs.grant = function (S, E, f, level, source) {
    const rs = E.research;
    if (rs.completed[f].indexOf(level) >= 0) return false;
    rs.completed[f].push(level); rs.completed[f].sort((a, b) => a - b);
    (rs.seq || (rs.seq = [])).push([f, level]);
    if (rs.project[f] === level) { rs.project[f] = 0; rs.invest[f] = 1; rs.cost[f] = 0; }
    Rs.recompute(E);
    const t = Rs.techAt(f, level);
    if (M.Sim.Ev) M.Sim.Ev.push(S, { type: 'tech', empire: E.id, field: f, level, id: t ? t.id : null, source: source || 'research' });
    return true;
  };

  // ---- yearly update (§1.4) ---------------------------------------------------------------------------------------------
  // Adds this year's RP to every field, applies interest, rolls breakthroughs. Returns [{field, level}] completed this turn.
  Rs.advance = function (S, E, R) {
    const rs = E.research, total = rs.total | 0, done = [];
    for (let f = 0; f < 6; f++) {
      let inv = rs.invest[f];
      const t3 = Math.floor(rs.slider[f] * total / 100);
      let t1 = Math.floor(inv * 3 / 20); t1 = Math.min(t1, 2 * t3);
      inv += t3 + t1;
      rs.invest[f] = inv;
      const c = rs.cost[f];
      if (c !== 0 && rs.slider[f] !== 0 && total !== 0) {
        if (inv > c) {
          const v = Math.floor((inv - c) * 250 / c);
          if (R.int(1, 500) <= v) { const lvl = rs.project[f]; if (Rs.grant(S, E, f, lvl, 'research')) done.push({ field: f, level: lvl }); }
        }
      } else {
        rs.invest[f] = Math.floor(inv * 9 / 10);          // unfunded / no project: the pile decays
      }
    }
    Rs.refreshTL(E);
    return done;
  };
  // chance of completing THIS turn if funded as now (for the UI light-bulb): 0..1
  Rs.breakthroughChance = function (E, f) {
    const rs = E.research, c = rs.cost[f]; if (!c) return 0;
    if (rs.slider[f] === 0 || (rs.total | 0) === 0) return 0;                  // unfunded: advance() never rolls (the pile just decays)
    const t3 = Math.floor(rs.slider[f] * (rs.total | 0) / 100);
    let t1 = Math.floor(rs.invest[f] * 3 / 20); t1 = Math.min(t1, 2 * t3);
    const inv = rs.invest[f] + t3 + t1;
    if (inv <= c) return 0;
    return Math.min(1, Math.floor((inv - c) * 250 / c) / 500);
  };

  // ---- sliders (sum always 100) ---------------------------------------------------------------------------------------------------
  // The original's greedy group rule (same as the planet sliders, Colony.setSlider): budget = 100 − locked sliders; the moved slider is clamped to the budget; the other
  // unlocked sliders keep their value in index order while budget lasts (the first that no longer fits is cut to what is left, every later one drops to 0); a surplus
  // goes to the LAST unlocked slider (Weapons normally), or to the FIRST unlocked one when the moved slider is itself the last. The moved slider's own lock is ignored.
  Rs.setSlider = function (E, f, value) {
    const rs = E.research, s = rs.slider, lk = rs.lock;
    value = Math.max(0, Math.min(100, Math.round(value)));
    let budget = 100;
    for (let i = 0; i < 6; i++) if (lk[i] && i !== f) budget -= s[i];
    s[f] = Math.min(value, budget);
    let rest = budget - s[f], first = -1, last = -1;
    for (let i = 0; i < 6; i++) {
      if (lk[i] && i !== f) continue;
      if (first < 0) first = i;
      last = i;
      if (i === f) continue;
      const keep = Math.min(s[i], rest); s[i] = keep; rest -= keep;
    }
    if (rest > 0) s[last === f ? first : last] += rest;
  };
  Rs.equalize = function (E) { E.research.slider = [16, 17, 17, 16, 17, 17]; };

  // ---- orders ---------------------------------------------------------------------------------------------------------
  const O = M.Sim.Orders;
  O.register('researchSlider', function (S, E, o) { const f = O.int(o.field, 0, 5), v = O.num(o.value, 0, 100); if (f === null || v === null) return O.fail('bad field'); Rs.setSlider(E, f, v); return O.ok(); });
  O.register('researchSet', function (S, E, o) {       // set all six field sliders at once (values sum to 100) — AI planners
    const v = (Array.isArray(o.values) ? o.values : []).map(x => (Number.isFinite(x) ? Math.max(0, Math.round(x)) : NaN));
    if (v.length !== 6 || v.some(x => !Number.isFinite(x)) || v.reduce((a, b) => a + b, 0) !== 100) return O.fail('research sliders must sum to 100');
    E.research.slider = v; return O.ok();
  });
  O.register('researchLock', function (S, E, o) { const f = O.int(o.field, 0, 5); if (f === null) return O.fail('bad field'); E.research.lock[f] = !!o.locked; return O.ok(); });
  O.register('researchEqualize', function (S, E) { Rs.equalize(E); return O.ok(); });
  O.register('researchPick', function (S, E, o) {
    const rs = E.research;
    if (O.int(o.field, 0, 5) === null || O.int(o.level, 1, 99) === null) return O.fail('bad field');
    if (rs.project[o.field] && rs.invest[o.field] > 1 && rs.project[o.field] !== o.level && !o.force) return O.fail('a project is already under way');
    return Rs.start(S, E, o.field, o.level) ? O.ok() : O.fail('that technology is not available');
  });
});
