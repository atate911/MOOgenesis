// Ship design — research/03 §2 (cost / space / power / hit-point maths, derived combat stats), §6 (production, scrapping), §8 (start designs);
// research/04 §3.10 (missile-base price), §4.1–4.2 (ship cost formula, start designs). Worker-safe. Needs Data.Components (and Data.Config / Sim.Orders).
//
// MOO.Sim.Design
//   A design record lives in E.designs[0..5] (null = empty slot):
//     { name (≤12 chars), hull 0..3, comp idx|-1, ecm idx|-1, shield idx|-1, armor idx (0 = Titanium, free), engine idx, man (maneuver rating − 1, 0..engine idx),
//       weapons:[{type idx|-1, count 0..99} × 4], specials:[idx|-1 × 3], icon }          idx = index into Data.Components.<LIST> (see data/components.js)
//   E.dstats[slot] caches compute() for that slot (plain JSON, saved with the game). Costs are in BC (integers); the maths runs in tenths of BC like the original.
//
//   compute(S,E,draft) → stats            pure; works for any draft (the UI calls it for every click). Fields:
//        valid, reason ('' when valid) · cost (BC) costTenths · space (hull total) spaceUsed free · power engines (tenths of an engine) warp · hp · man rating (= man+1)
//        combatSpeed beamDef missDef attack (computer level, +1 Battle Scanner) absorb repair (% of one ship's HP per round) extraman misshield rangeBonus (beam range +3)
//        pulsar stream cloak teleport scanner stasis repulsor dissipator blackhole technull oracle displacement · tanks (+3 parsecs) colonyMin (0 | planet type index 1..7)
//        weapons:[{slot,type,id,n,name,kind,count,dmg,range (incl. High Energy Focus for beams),rof,ammo,speed,acc,racks,warheads,mul,heavy,flags,tl}] specials:[ids]
//        weaponCount (all weapons) armed (beam/missile/torpedo) bombs bio · hull hullW (ship-points weight) compLevel ecmLevel key
//   refresh(S,E)            recompute and cache all six slots (Econ.stepShips at the ship-building step and Turn.run at the end of every turn call it)
//   stats(S,E,slot)         cached compute() of that slot (computed lazily; recomputed when the design record changed; callers must treat it as READ-ONLY);
//                           empty slot → {valid:false,cost:1,warp:1,tanks:false,colonyMin:0,…}
//   cost(S,E,slot)          BC of one ship (1 for an empty slot). PRESETS: startDesigns() seeds E.dstats with the ORIGINAL's preset costs 10/15/66/86/591 (D.PRESET_COST) which
//                           stay in force until the first refresh(); from then on the formula applies (8/14/74/65/570) — research/03 §8, research/04 §4.1.
//   baseCost(S,E)           price of one missile base in BC (research/04 §3.10; 254 at game start; AI difficulty discount; never below 50)
//   baseLoadout(S,E)        what a missile base carries: {comp,ecm,shield,armor,armorTier,weapon,weapon2,hp}  (component indexes of the BEST owned items; -1 = none)
//   maintenance(S,E)        {ships,bases,gates,total} BC per turn: floor(Σ ships × cost / 50) + floor(bases × baseCost / 50) + 100 per stargate
//   available(E,kind)       indexes of the components the empire may fit. kind: hulls|engines|computers|ecm|shields|armor|specials|weapons (singular / short forms accepted)
//   hullSpace(E,hull)       total space of a hull = base + floor(base × TL_construction / 50)
//   itemInfo(E,kind,idx,hull)  {id,name,tm,cost (BC, as the design popups print it),costTenths,space,power} for one component on one hull
//   maxCount(S,E,draft,bank,type)  the largest count (0..99) of weapon `type` that still fits into `bank` of the draft
//   check(E,draft) → '' | reason      is every part of the draft researched?   normalize(draft) → clean copy   blank(hull) → empty draft   defaultName(E,hull)
//   startDesigns(E[,{armedColony}])   the six premade designs Scout / Fighter / Destroyer / Bomber / Colony Ship / (empty)
//   scrapRefund(S,E,slot,count)       floor(count × cost / 4) — 25% of the ship value goes to the reserve (research/03 §6)
//   PRESET_COST  [10,15,66,86,591]
//
// ORDERS
//   {t:'design', slot?, design}   store a NEW design. slot omitted/-1 = first free slot; fails when all six slots are taken, when the draft is invalid or uses unresearched
//                                 parts, or when the chosen slot holds a design that already has ships (designs are locked once a ship exists — scrap it first).
//   {t:'scrapDesign', slot}       removes every ship of that design (the empire's own fleets, stationary and in flight), repoints planets that were building it to the first
//                                 remaining valid design, pays the 25% refund into E.bc and empties the slot.
//
// NOTE (conflicts between research documents): hull space +2% per Construction level (Manual: 1%); base cost at start 254 BC (OSG: 283); the preset start-design costs differ from the
// formula (see PRESET_COST); armor term of the base cost uses the best STANDARD armor's Large price (research/04 words it "armor index minus 1" — same value at the start);
// AI base discounts (empires with human === false only) are applied before the 50 BC floor so the floor always holds.
MOO.def(function (M) {
  'use strict';
  const D = M.Sim.Design = {};
  const O = M.Sim.Orders;
  const SLOTS = 6, BANKS = 4, SPEC_SLOTS = 3, NAME_LEN = 12, MAX_BANK = 99, BAD = 1e9;
  const BASE_HP = [50, 75, 100, 125, 150, 175, 200];             // missile-base hit points by armor tier (Titanium … Neutronium)
  const AI_BASE_MUL = [100, 90, 80, 70, 50];                      // percent of the base price an AI pays: Simple … Impossible
  D.SLOTS = SLOTS; D.BANKS = BANKS; D.SPEC_SLOTS = SPEC_SLOTS; D.NAME_LEN = NAME_LEN; D.MAX_BANK = MAX_BANK;
  D.PRESET_COST = [10, 15, 66, 86, 591];

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const cfg = () => M.Data.Config || {};
  const int = (v, dflt) => {
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    return typeof v === 'number' && isFinite(v) ? Math.trunc(v) : dflt;
  };
  // tech level (percent) of research field f; 1 when the empire has no research state (tests, fresh empires)
  const tlOf = (E, f) => { const t = E && E.research && E.research.tl; const v = t ? t[f] : 1; return v >= 1 ? v : 1; };
  const tmOf = (E, tech) => clamp(tlOf(E, tech.f) - tech.l, 0, 50);
  // does the empire own this component? (level-1 items are free; otherwise the level is in completed[field] or the grant key is set)
  function owned(E, it) {
    if (!it.tech || (it.flags && it.flags.monster)) return false;
    if (it.tech.l <= 1) return true;
    const rs = E && E.research, done = rs && rs.completed && rs.completed[it.tech.f];
    if (done && done.indexOf(it.tech.l) >= 0) return true;
    return !!(it.grant && E && E.grants && E.grants[it.grant]);
  }

  // ---- draft clean-up ----------------------------------------------------------------------------------------------------------------------------
  // component reference: index, or a string id (looked up in `map`; unknown id → BAD so compute() reports it), or `none`
  function ref(map, v, none) {
    if (typeof v === 'string') { const i = map[v]; return i === undefined ? BAD : i; }
    if (typeof v === 'number' && isFinite(v)) return v < 0 ? -1 : Math.trunc(v);
    return none;
  }
  // canonical copy: exactly 4 weapon banks and 3 special slots (empty = type/idx -1), counts ≥ 0, string ids resolved. Banks beyond the 4th / specials beyond the 3rd that
  // are not empty are only counted (extraBanks / extraSpecials) so compute() can flag the draft as invalid instead of silently dropping them.
  function normalize(src) {
    const K = M.Data.Components, I = K.idx, s = src || {};
    const out = {
      name: typeof s.name === 'string' ? s.name.trim().slice(0, NAME_LEN) : '', hull: ref(I.hulls, s.hull, 0), comp: ref(I.computers, s.comp, -1), ecm: ref(I.ecm, s.ecm, -1),
      shield: ref(I.shields, s.shield, -1), armor: ref(I.armor, s.armor, 0), engine: ref(I.engines, s.engine, -1), man: int(s.man, 0), weapons: [], specials: [],
      icon: int(s.icon, 0), extraBanks: Math.max(0, int(s.extraBanks, 0)), extraSpecials: Math.max(0, int(s.extraSpecials, 0)),     // (idempotent: flags survive re-normalising)
    };
    const ws = Array.isArray(s.weapons) ? s.weapons : [];
    for (let i = 0; i < ws.length; i++) {
      const b = ws[i] || {}, type = ref(I.weapons, b.type !== undefined ? b.type : b.id, -1), count = type < 0 ? 0 : Math.max(0, int(b.count, 0));
      if (i < BANKS) out.weapons.push(count > 0 ? { type, count } : { type: -1, count: 0 });
      else if (count > 0) out.extraBanks++;
    }
    while (out.weapons.length < BANKS) out.weapons.push({ type: -1, count: 0 });
    const ss = Array.isArray(s.specials) ? s.specials : [];
    for (let i = 0; i < ss.length; i++) {
      const v = ref(I.specials, ss[i], -1);
      if (i < SPEC_SLOTS) out.specials.push(v); else if (v >= 0) out.extraSpecials++;
    }
    while (out.specials.length < SPEC_SLOTS) out.specials.push(-1);
    return out;
  }
  D.normalize = normalize;
  D.blank = hull => ({ name: '', hull: hull | 0, comp: -1, ecm: -1, shield: -1, armor: 0, engine: 0, man: 0, weapons: [0, 1, 2, 3].map(() => ({ type: -1, count: 0 })), specials: [-1, -1, -1], icon: 0 });

  // change detector for the cache: every field that influences the numbers (works on raw records too)
  function keyOf(d) {
    let k = d.hull + '|' + d.comp + '|' + d.ecm + '|' + d.shield + '|' + d.armor + '|' + d.engine + '|' + d.man;
    const ws = d.weapons || [], ss = d.specials || [];
    for (let i = 0; i < ws.length; i++) k += '|' + (ws[i] ? ws[i].type + 'x' + ws[i].count : '-');
    for (let i = 0; i < ss.length; i++) k += '|s' + ss[i];
    return k;
  }

  // cost / space / power of one component on hull h after miniaturisation (power never shrinks)
  function part(E, it, h, isWeapon) {
    const K = M.Data.Components, tm = tmOf(E, it.tech), at = v => (Array.isArray(v) ? v[h] : v);
    return { cost: K.miniCost(at(it.cost), tm), space: K.miniSpace(at(it.space), tm, isWeapon), power: it.power === undefined ? 0 : at(it.power), tm };
  }

  // a structurally broken draft: no numbers at all
  function bad(d, reason) {
    return {
      valid: false, structural: true, reason, hull: d.hull, cost: 1, costTenths: 0, space: 0, spaceUsed: 0, free: 0, power: 0, engines: 0, warp: 1, hp: 0, man: 0, rating: 1,
      combatSpeed: 1, beamDef: 0, missDef: 0, attack: 0, absorb: 0, repair: 0, extraman: 0, misshield: 0, rangeBonus: 0, pulsar: 0, stream: 0, cloak: 0, teleport: false, scanner: false,
      stasis: false, repulsor: false, dissipator: false, blackhole: false, technull: false, oracle: false, displacement: 0, tanks: false, colonyMin: 0,
      weapons: [], specials: [], weaponCount: 0, armed: false, bombs: 0, bio: 0, hullW: 1, compLevel: 0, ecmLevel: 0, key: keyOf(d),
    };
  }

  // ---- the design maths (research/03 §2.2–2.7) -----------------------------------------------------------------------------------------------------
  function calc(E, draft) {
    const K = M.Data.Components, d = normalize(draft);
    if (!(d.hull >= 0 && d.hull < K.HULLS.length)) return bad(d, 'Unknown hull');
    const h = d.hull, hull = K.HULLS[h], eng = K.ENGINES[d.engine], arm = K.ARMOR[d.armor];
    if (!eng) return bad(d, 'An engine is required');
    if (!arm) return bad(d, 'Unknown armor');
    const comp = d.comp >= 0 ? K.COMPUTERS[d.comp] : null, ecm = d.ecm >= 0 ? K.ECM[d.ecm] : null, shd = d.shield >= 0 ? K.SHIELDS[d.shield] : null;
    if (d.comp >= 0 && !comp) return bad(d, 'Unknown battle computer');
    if (d.ecm >= 0 && !ecm) return bad(d, 'Unknown ECM jammer');
    if (d.shield >= 0 && !shd) return bad(d, 'Unknown deflector shield');

    const man = clamp(d.man, 0, d.engine);                     // maneuver rating R = man + 1 can never exceed the engine's warp
    let reason = '', power = hull.power * (man + 1), cost = hull.cost, used = 0, count = 0, bombs = 0, bio = 0, armed = false;
    if (d.extraBanks) reason = 'At most ' + BANKS + ' weapon types';
    if (d.extraSpecials) reason = reason || 'At most ' + SPEC_SLOTS + ' special devices';

    const weapons = [];
    for (let i = 0; i < BANKS; i++) {
      const b = d.weapons[i]; if (b.type < 0) continue;
      const w = K.WEAPONS[b.type]; if (!w) return bad(d, 'Unknown weapon');
      const p = part(E, w, h, true);
      cost += Math.max(p.cost, 5) * b.count; used += p.space * b.count; power += p.power * b.count; count += b.count;
      if (b.count > MAX_BANK) reason = reason || 'At most ' + MAX_BANK + ' weapons per bank';
      if (w.kind === 'bomb') bombs += b.count; else if (w.kind === 'bio') bio += b.count; else armed = true;
      weapons.push({ slot: i, type: b.type, id: w.id, n: w.n, name: w.name, kind: w.kind, count: b.count, dmg: w.dmg.slice(), range: w.range, rof: w.rof, ammo: w.ammo, speed: w.speed, acc: w.acc,
        racks: w.racks, warheads: w.warheads, mul: w.mul, heavy: w.heavy, flags: Object.assign({}, w.flags), tl: w.tech.l });
    }

    const specials = [], groups = {};
    let extraman = 0, repair = 0, misshield = 0, extrarange = 0, pulsar = 0, stream = 0, cloak = 0, displacement = 0, colonyMin = 0, tanks = false;
    let scanner = false, teleport = false, stasis = false, repulsor = false, dissipator = false, blackhole = false, technull = false, oracle = false;
    for (let i = 0; i < SPEC_SLOTS; i++) {
      const si = d.specials[i]; if (si < 0) continue;
      const sp = K.SPECIALS[si]; if (!sp) return bad(d, 'Unknown special device');
      if (groups[sp.group]) reason = reason || 'Only one device of this type: ' + groups[sp.group] + ' / ' + sp.name;
      else groups[sp.group] = sp.name;
      const p = part(E, sp, h, false), fx = sp.fx;
      cost += Math.max(p.cost, 5); used += p.space; power += p.power; specials.push(sp.id);
      extraman = Math.max(extraman, fx.extraman || 0); repair = Math.max(repair, fx.repair || 0); misshield = Math.max(misshield, fx.misshield || 0);
      extrarange = Math.max(extrarange, fx.extrarange || 0); pulsar = Math.max(pulsar, fx.pulsar || 0); stream = Math.max(stream, fx.stream || 0);
      cloak = Math.max(cloak, fx.cloak || 0); displacement = Math.max(displacement, fx.displacement || 0);
      if (fx.scanner) scanner = true; if (fx.teleport) teleport = true; if (fx.stasis) stasis = true; if (fx.repulsor) repulsor = true; if (fx.dissipator) dissipator = true;
      if (fx.blackhole) blackhole = true; if (fx.technull) technull = true; if (fx.oracle) oracle = true;
      if (sp.tanks) tanks = true;
      if (sp.colonyMin) colonyMin = Math.max(colonyMin, sp.colonyMin);
    }
    if (extrarange) for (const w of weapons) if (w.kind === 'beam') w.range += extrarange;

    let compLevel = 0, ecmLevel = 0, absorb = 0;
    if (comp) { const p = part(E, comp, h, false); cost += Math.max(p.cost, 1); used += p.space; power += p.power; compLevel = comp.level; }
    if (ecm) { const p = part(E, ecm, h, false); cost += Math.max(p.cost, 1); used += p.space; power += p.power; ecmLevel = ecm.level; }
    if (shd) { const p = part(E, shd, h, false); cost += Math.max(p.cost, 5); used += p.space; power += p.power; absorb = shd.absorb; }
    { const p = part(E, arm, h, false); if (arm.cost[h] > 0) cost += Math.max(p.cost, 5); used += p.space; }     // Titanium (free) is never 'fitted'

    // engines: power / (warp) tenths of an engine, at least 1 tenth
    const warp = eng.warp, engines = Math.max(1, Math.floor(power / (eng.power / 10)));
    { const p = part(E, eng, h, false); cost += Math.floor(Math.max(p.cost, 5) * engines / 10); used += Math.floor(p.space * engines / 10); }

    const xc = costPct(E, colonyMin > 0);                                    // expansion: Modular Shipyards / Cryogenic Colony Berths
    if (xc !== 100) cost = Math.floor(cost * xc / 100);
    const space = hull.space + Math.floor(hull.space * tlOf(E, 1) / 50), free = space - used;
    if (free < 0) reason = reason || 'Not enough space (' + (-free) + ' over)';
    const beamDef = man + hull.defense + extraman + 1;
    return {
      valid: !reason, reason, hull: h, cost: Math.max(1, Math.floor((cost + 5) / 10)), costTenths: cost, space, spaceUsed: used, free, power, engines, warp,
      hp: Math.floor(hull.hits * arm.pct / 100), man, rating: man + 1, combatSpeed: Math.floor((man + 3) / 2) + Math.floor(extraman / 2),
      beamDef, missDef: beamDef + ecmLevel, attack: compLevel + (scanner ? 1 : 0), absorb, repair, extraman, misshield, rangeBonus: extrarange, pulsar, stream, cloak, teleport, scanner,
      stasis, repulsor, dissipator, blackhole, technull, oracle, displacement, tanks, colonyMin, weapons, specials, weaponCount: count, armed, bombs, bio, hullW: hull.w,
      compLevel, ecmLevel, key: keyOf(draft || d), ...(xc !== 100 ? { xc } : {}),
    };
  }
  // percent of the normal price an empire pays for a design (expansion techs; 100 in a classic game)
  function costPct(E, colony) {
    const m = (E && E.mods) || {};
    let pct = m.shipCostPct || 100;
    if (colony && m.colonyShipCostPct) pct = Math.floor(pct * m.colonyShipCostPct / 100);
    return pct;
  }

  // ---- public queries ---------------------------------------------------------------------------------------------------------------------------------
  D.compute = (S, E, draft) => calc(E, draft);

  const emptyStats = () => ({
    valid: false, empty: true, reason: 'No design', cost: 1, warp: 1, tanks: false, colonyMin: 0, hp: 0, attack: 0, absorb: 0, beamDef: 0, missDef: 0, combatSpeed: 1, repair: 0,
    weapons: [], specials: [], weaponCount: 0, armed: false, bombs: 0, bio: 0, free: 0, space: 0, spaceUsed: 0,
  });

  D.stats = function (S, E, slot) {
    const d = E.designs && E.designs[slot];
    if (!d) return emptyStats();
    if (!E.dstats) E.dstats = [];
    let c = E.dstats[slot];
    if (!c || c.key !== keyOf(d) || (c.valid !== undefined && (c.xc || 100) !== costPct(E, (c.colonyMin | 0) > 0))) c = E.dstats[slot] = calc(E, d);
    return c;
  };
  D.cost = (S, E, slot) => D.stats(S, E, slot).cost;

  D.refresh = function (S, E) {
    if (!E.designs) E.designs = [];
    while (E.designs.length < SLOTS) E.designs.push(null);
    E.dstats = [];
    for (let i = 0; i < SLOTS; i++) E.dstats[i] = E.designs[i] ? calc(E, E.designs[i]) : null;
  };

  D.hullSpace = function (E, hull) {
    const base = M.Data.Components.HULLS[hull].space;
    return base + Math.floor(base * tlOf(E, 1) / 50);
  };

  // ---- component lists --------------------------------------------------------------------------------------------------------------------------------
  const LISTS = { hulls: 'HULLS', hull: 'HULLS', engines: 'ENGINES', engine: 'ENGINES', computers: 'COMPUTERS', computer: 'COMPUTERS', comp: 'COMPUTERS', ecm: 'ECM', jammer: 'ECM',
    jammers: 'ECM', shields: 'SHIELDS', shield: 'SHIELDS', armor: 'ARMOR', armour: 'ARMOR', specials: 'SPECIALS', special: 'SPECIALS', weapons: 'WEAPONS', weapon: 'WEAPONS' };
  const listOf = kind => { const n = LISTS[kind]; return n ? M.Data.Components[n] : null; };

  D.available = function (E, kind) {
    const list = listOf(kind), out = [];
    if (!list) return out;
    for (let i = 0; i < list.length; i++) if (!list[i].tech || owned(E, list[i])) out.push(i);
    return out;
  };

  D.itemInfo = function (E, kind, idx, hull) {
    const K = M.Data.Components, list = listOf(kind), it = list && list[idx];
    if (!it) return null;
    if (!it.tech) return { id: it.id, name: it.name, tm: 0, cost: Math.floor((it.cost + 5) / 10), costTenths: it.cost, space: it.space, power: it.power };
    const h = hull | 0, isW = list === K.WEAPONS, p = part(E, it, h, isW);
    const raw = Array.isArray(it.cost) ? it.cost[h] : it.cost, floor = (list === K.COMPUTERS || list === K.ECM) ? 1 : 5;
    return { id: it.id, name: it.name, tm: p.tm, cost: raw <= 0 ? 0 : Math.max(1, Math.floor((Math.max(p.cost, floor) + 5) / 10)), costTenths: p.cost, space: p.space, power: p.power };
  };

  // every part researched? → '' or the first offender
  D.check = function (E, draft) {
    const K = M.Data.Components, d = normalize(draft);
    const need = (list, i) => { const it = list[i]; return it && owned(E, it) ? '' : (it ? it.name + ' is not researched' : ''); };
    let r = '';
    if (d.engine >= 0) r = need(K.ENGINES, d.engine);
    if (!r && d.comp >= 0) r = need(K.COMPUTERS, d.comp);
    if (!r && d.ecm >= 0) r = need(K.ECM, d.ecm);
    if (!r && d.shield >= 0) r = need(K.SHIELDS, d.shield);
    if (!r) r = need(K.ARMOR, d.armor);
    for (let i = 0; !r && i < BANKS; i++) if (d.weapons[i].type >= 0) r = need(K.WEAPONS, d.weapons[i].type);
    for (let i = 0; !r && i < SPEC_SLOTS; i++) if (d.specials[i] >= 0) r = need(K.SPECIALS, d.specials[i]);
    return r;
  };

  // the UI's MAX column: how many of weapon `type` fit into `bank` (space only; engines grow with the weapons' power)
  D.maxCount = function (S, E, draft, bank, type) {
    const d = normalize(draft); d.weapons[bank] = { type, count: 1 };
    const probe = n => { d.weapons[bank] = { type, count: n }; const c = calc(E, d); return !c.structural && c.free >= 0; };
    if (!probe(1)) return 0;
    let lo = 1, hi = MAX_BANK;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (probe(mid)) lo = mid; else hi = mid - 1; }
    return lo;
  };

  // ---- names / icons -------------------------------------------------------------------------------------------------------------------------------------
  const HULL_NAMES = [['Fighter', 'Gunboat', 'Courier'], ['Frigate', 'Destroyer', 'Corvette'], ['Cruiser', 'Escort', 'Warship'], ['Dreadnought', 'Battleship', 'Dreadstar']];
  D.defaultName = function (E, hull) {
    const used = {}; for (const d of (E.designs || [])) if (d && d.name) used[d.name.toLowerCase()] = 1;
    const list = HULL_NAMES[clamp(hull | 0, 0, 3)];
    for (const n of list) if (!used[n.toLowerCase()]) return n;
    for (let i = 2; i < 100; i++) { const n = list[0].slice(0, NAME_LEN - String(i).length - 1) + ' ' + i; if (!used[n.toLowerCase()]) return n; }
    return list[0];
  };
  const freeIcon = (E, except) => {
    const used = {}; (E.designs || []).forEach((d, i) => { if (d && i !== except) used[d.icon | 0] = 1; });
    let i = 0; while (used[i]) i++;
    return i;
  };

  // ---- the missile-base price (research/04 §3.10 = research/03 §5.1) ------------------------------------------------------------------------------
  D.baseLoadout = function (S, E) {
    const K = M.Data.Components;
    const best = (list, ok) => {
      let b = -1, bl = -1;
      for (let i = 0; i < list.length; i++) { const it = list[i]; if ((!ok || ok(it)) && owned(E, it) && it.tech.l >= bl) { b = i; bl = it.tech.l; } }
      return b;
    };
    const std = Math.max(0, best(K.ARMOR, a => !a.heavy));
    const m2 = best(K.WEAPONS, w => w.kind === 'missile' && w.racks === 2 && w.warheads === 1);
    const sc = best(K.WEAPONS, w => w.kind === 'missile' && w.racks === 2 && w.warheads > 1);
    return { comp: best(K.COMPUTERS), ecm: best(K.ECM), shield: best(K.SHIELDS), armor: std, armorTier: std >> 1, weapon: m2, weapon2: sc >= 0 ? sc : m2, hp: BASE_HP[E.mods && E.mods.baseHp !== undefined ? clamp(E.mods.baseHp | 0, 0, 6) : std >> 1] };      // HP of the LAST acquired armour tech (research/03-verification #6); the cost terms use the best
  };
  D.baseCost = function (S, E) {
    const K = M.Data.Components, b = D.baseLoadout(S, E), L = 2;                       // all terms use the LARGE hull column
    const m = f => K.T50[clamp(tlOf(E, f), 1, 50) - 1];                               // 'm' of the research doc: T50[min(TL,50)-1] of the component's field
    let sum = Math.floor((K.ARMOR[b.armor].cost[L] + K.HULLS[L].cost) * m(1) / 1500);
    if (b.weapon >= 0) sum += Math.floor(K.WEAPONS[b.weapon].cost * (m(5) * 9) / 1000);
    const term = (it, f) => Math.floor(it.cost[L] * m(f) / 1000) + Math.floor(it.power[L] / 10);
    if (b.shield >= 0) sum += term(K.SHIELDS[b.shield], 2);
    if (b.comp >= 0) sum += term(K.COMPUTERS[b.comp], 0);
    if (b.ecm >= 0) sum += term(K.ECM[b.ecm], 0);
    let cost = Math.floor(sum * 3 / 5);
    if (E && E.human === false) {                                                      // AI empires only (a bare stub empire without the flag pays full price)
      const tab = cfg().AI_BASE_COST || AI_BASE_MUL, di = S && S.settings ? (S.settings.diffIdx | 0) : 2;
      cost = Math.floor(cost * tab[clamp(di, 0, tab.length - 1)] / 100);
    }
    if (E && E.mods && E.mods.baseCostPct) cost = Math.floor(cost * E.mods.baseCostPct / 100);      // expansion: Hardened Missile Silos (the 50 BC floor still holds)
    return Math.max(50, cost);
  };

  // ---- upkeep ---------------------------------------------------------------------------------------------------------------------------------------------
  D.maintenance = function (S, E) {
    const cost = [];
    for (let i = 0; i < SLOTS; i++) cost[i] = E.designs && E.designs[i] ? D.cost(S, E, i) : 0;
    let value = 0, bases = 0, gates = 0;
    for (const f of (S.fleets || [])) if (f.owner === E.id) for (let i = 0; i < SLOTS; i++) value += (f.ships[i] | 0) * cost[i];
    for (const p of (S.planets || [])) if (p.owner === E.id) { bases += p.bases | 0; if (p.stargate) gates++; }
    const div = cfg().SHIP_UPKEEP_DIV || 50, upk = (E.mods && E.mods.shipUpkeepPct) || 100;     // upk: expansion Orbital Drydocks
    const ships = Math.min(32000, Math.floor(upk === 100 ? value / div : value * upk / (100 * div))), baseM = Math.floor(bases * D.baseCost(S, E) / div), gateM = gates * (cfg().STARGATE_UPKEEP || 100);
    return { ships, bases: baseM, gates: gateM, total: ships + baseM + gateM };
  };

  D.scrapRefund = (S, E, slot, count) => Math.floor(Math.max(0, count | 0) * D.cost(S, E, slot) * (cfg().SCRAP_REFUND || 0.25));

  // ---- the premade designs (research/03 §8, research/04 §4.1) ----------------------------------------------------------------------------------
  D.startDesigns = function (E, opts) {
    const I = M.Data.Components.idx, w = (id, count) => ({ type: I.weapons[id], count }), sp = id => I.specials[id];
    const mk = (name, hull, weapons, specials, icon) => {
      const d = D.blank(hull); d.name = name; d.icon = icon;
      weapons.forEach((x, i) => { d.weapons[i] = x; }); specials.forEach((x, i) => { d.specials[i] = x; });
      return d;
    };
    const armed = !!(opts && opts.armedColony);
    E.designs = [
      mk('Scout', 0, [], [sp('reserve-fuel-tanks')], 0),
      mk('Fighter', 0, [w('laser', 1)], [], 1),
      mk('Destroyer', 1, [w('nuclear-missile', 1), w('laser', 3)], [], 2),
      mk('Bomber', 1, [w('nuclear-bomb', 2), w('laser', 2)], [], 3),
      mk('Colony Ship', 2, armed ? [w('laser', 1)] : [], [sp('standard-colony-base')], 4),
      null,
    ];
    E.dstats = [];
    E.designs.forEach((d, i) => {
      if (!d) { E.dstats[i] = null; return; }
      const st = calc(E, d);
      if (D.PRESET_COST[i] && !(armed && i === 4)) { st.formulaCost = st.cost; st.cost = D.PRESET_COST[i]; st.preset = true; }   // used for the first turn's upkeep only
      E.dstats[i] = st;
    });
    return E.designs;
  };

  // ---- orders ------------------------------------------------------------------------------------------------------------------------------------------------
  const shipsOf = (S, E, slot) => { let n = 0; for (const f of (S.fleets || [])) if (f.owner === E.id) n += f.ships[slot] | 0; return n; };

  if (O) {
    O.register('design', function (S, E, o) {
      const raw = o.design || o, norm = normalize(raw);
      if (!E.designs) E.designs = [];
      while (E.designs.length < SLOTS) E.designs.push(null);
      let slot = o.slot === undefined || o.slot === null ? -1 : int(o.slot, -1);
      if (slot < 0) { slot = E.designs.findIndex(x => !x); if (slot < 0) return O.fail('Six designs already exist - scrap one first'); }
      if (slot >= SLOTS) return O.fail('Bad design slot');
      if (E.designs[slot] && shipsOf(S, E, slot) > 0) return O.fail('That design is in use - scrap it first');
      const why = D.check(E, norm); if (why) return O.fail(why);
      const st = calc(E, norm); if (!st.valid) return O.fail(st.reason);
      const rec = {
        name: norm.name || D.defaultName(E, norm.hull), hull: norm.hull, comp: norm.comp, ecm: norm.ecm, shield: norm.shield, armor: norm.armor, engine: norm.engine, man: st.man,
        weapons: norm.weapons.map(b => ({ type: b.type, count: b.count })), specials: norm.specials.slice(), icon: raw.icon !== undefined ? norm.icon : freeIcon(E, slot),
      };
      E.designs[slot] = rec;
      if (!E.dstats) E.dstats = [];
      E.dstats[slot] = calc(E, rec);
      return O.ok({ slot, cost: E.dstats[slot].cost, stats: E.dstats[slot] });
    });

    O.register('scrapDesign', function (S, E, o) {
      const slot = int(o.slot, -1);
      if (!(slot >= 0 && slot < SLOTS) || !E.designs || !E.designs[slot]) return O.fail('No such design');
      const n = shipsOf(S, E, slot), refund = D.scrapRefund(S, E, slot, n);
      for (const f of (S.fleets || [])) if (f.owner === E.id) f.ships[slot] = 0;
      S.fleets = (S.fleets || []).filter(f => f.ships.some(c => c > 0));
      E.designs[slot] = null;
      if (!E.dstats) E.dstats = [];
      E.dstats[slot] = null;
      let repl = -1;
      for (let i = 0; i < SLOTS; i++) if (E.designs[i] && D.stats(S, E, i).valid) { repl = i; break; }
      for (const p of (S.planets || [])) if (p.owner === E.id && p.build === slot) p.build = repl >= 0 ? repl : 0;
      E.bc = (E.bc || 0) + refund;
      return O.ok({ slot, ships: n, refund });
    });
  }
});
