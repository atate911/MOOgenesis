// Expansion technology pool — the "Tech Lab" experiment (tools/techlab/, briefs/tech-lab.md). Worker-safe. Needs MOO.Data.Techs (loaded first).
//
// A new game with settings.options.techPool === 'expanded' deals every empire its classic random tree (research/02 §1.7, the SAME draws from S.rs as a
// classic game) and then SWAPS some of those slots for expansion techs of the same field and tier (expandList below, its own RNG stream). So:
//   * the size of every tier of every tree is exactly the classic one (pace, tier unlocks and tech-level growth are untouched);
//   * techs the original flags as essential (Robotic Controls III-VII, the fuel cells of PR tier 1, the missile line, PL 12/22/32/42) and the four
//     single-tech "always" tiers are never swapped out, so they keep their classic odds;
//   * every other slot of a tier holding k unprotected classic techs and n expansion techs is swapped with chance n / (k + n), which makes each tech of
//     the enlarged tier about equally likely to appear (the classic in-tier bias towards higher levels is kept for the classic techs).
// Classic games never see an expansion tech: they are absent from Techs.list / byField / researchTable (the classic tables the tests pin), present only
// in the lookups Techs.byId / byFL (so a game that owns one resolves it everywhere) and in Techs.X.
//
// MOO.Data.Techs.X
//   list byField[f] byTier[f][tier0..9]   expansion records (same shape as classic records + pool:'x', say:[[label, value]], tags)
//   researchTable[f][tier]              classic + expansion levels per tier (what an expanded empire can hold)
//   KEYS                                 effect vocabulary of the expansion (documented below); MIN_KEYS (lower is better) / BONUS_KEYS (added on top of a classic key)
//   expandList(lists, raceId, R)         the swap step (mutates and returns lists)   swapChance(f, tier, raceId) → q
//   protectedLevel(f, level)             essential / always-tier classic techs that are never swapped out
//   inPool(E, t) / poolOf(S|E)           does this empire's game use the expansion?  ('x' | '')
//
// EFFECT KEYS (fx) — folded by sim/research.js like the classic ones: numbers best value wins (highest; lowest for MIN_KEYS), booleans OR; BONUS_KEYS are
// then ADDED to a classic key (transBonus → transportSpeed). Every hook is a no-op unless owned.
//   survey            parsecs    stars within (scanner range + survey) of an own colony are explored (planets known)            sim/vis.js
//   civilRange        parsecs    unarmed ships (colony ships, scouts) reach this much further than your fuel cells; warships do not   sim/fleet.js
//   xcomp xmdef       levels     + attack / missile defence of every ship (tactical) — weights: sim/xtech.js
//   xabsorb           points     + shield absorption of every ship that carries a deflector
//   xmisshield        percent    ships shoot down at least this share of incoming missiles      xspeed / xinit  + combat speed / initiative
//   warheadPct        percent    + damage of missiles, torpedoes and bombs
//   mines             percent    enemy stacks fighting at your colony lose this share of their hit points as the battle opens (weights: × (1 − mines/100))
//   baseCompX         levels     + attack level of your missile bases       baseHpPct  percent  + missile-base hit points
//   baseCostPct       percent    price of a missile base (MIN)              planetWeight from the two keys above in AI-vs-AI battles (sim/combat.js)
//   spyOff            points     added to Computers TL in infiltration rolls      spyCostPct  percent  spy price (MIN)                  sim/spy.js
//   reserveInterest   percent    the reserve earns this share per turn, at most a tenth of gross production                         sim/econ.js
//   posAct            percent    + positive relation changes you cause                                                            sim/diplo.js
//   councilBonus      votes'     AI voters' weight for you in the Galactic Council                                                  sim/council.js
//   rpTreaty          percent    research output per empire you have a non-aggression pact or alliance with (at most 4 of them)   sim/econ.js
//   researchInterest  percent    research interest per year (classic 15) and its cap becomes 3 × this year's RP                    sim/research.js
//   colonyPop / colonyFac       a new colony starts with this many more colonists / these factories                                 sim/colony.js
//   asteroid          percent    production of colonies in systems with asteroid fields (dense fields: twice)
//   workerPct         percent    + output of the population term of production
//   groundDef / groundOff       ground force defending / attacking                                                                   sim/ground.js
//   salvage           percent    of the price of enemy ships destroyed in a battle you win goes to the reserve                        sim/combat.js
//   reverseEng        percent    chance per battle you win with kills to learn one of the loser's techs (level ≤ your TL + 5)
//   escape            percent    of your ships lost in a battle you LOSE escape with the retreating fleet instead
//   shipUpkeepPct     percent    ship maintenance (MIN)       shipCostPct  percent  every ship design (MIN)      colonyShipCostPct  colony designs (MIN)
//   bombPct           percent    + bombardment damage you deal          bombDefPct  percent  bombardment damage you suffer (MIN)
//   gauntletPct       percent    + transport losses of invaders approaching your colonies     gauntletOwnPct  percent  your own transport losses (MIN)
//   siegeFloor        percent    bombardment / bio-weapons / battle collateral never push a colony below this share of its max population
//   arcology / domes / smallWorld  percent  permanent max-population improvements (all worlds / hostile worlds / worlds of base max pop ≤ 40), min +5 each
//   hostileGrowth     flag       hostile worlds grow at the normal rate       growthPct  percent  + natural growth
//   terraformCostDelta  BC       terraforming is this much cheaper per point of max population
//   seedFertile       flag       new colonies on normal worlds are founded fertile
//   beaconWarp        warp       fleets and transports moving between two of your colonies fly faster      homeWarp  warp  every fleet bound for
//                                one of your colonies (reinforcements, rallies, coming home; never an attack, which the AI times badly when faster)
//   snare             warp       hostile fleets bound for your colonies slow down within 4 parsecs (never below warp 1)            sim/fleet.js
//   evacuate          percent    of the population of a colony you lose escapes to your nearest colony with room                       sim/ground.js
MOO.def(function (M) {
  'use strict';
  const T = M.Data.Techs;
  const CODES = T.FIELD_CODES;

  // row keys as in techs.js: l level · id slug · n name · ty type (picks the hologram art) · g group (omitted = singular) · fx effects · nv never Silicoid ·
  // d description · say [[label, value]] the effect lines the tech screen prints · tags (family labels for the lab report)
  const CM = [
    { l: 3, id: 'stellar-survey-probes', n: 'Stellar Survey Probes', ty: 'scanner', fx: { survey: 2 }, tags: ['logistics'],
      d: 'Cheap robot probes that chart every system just beyond your scanners, revealing its planets.',
      say: [['Survey', 'stars within scanner range + 2 parsecs are explored']] },
    { l: 11, id: 'tactical-combat-analyzers', n: 'Tactical Combat Analyzers', ty: 'computer', g: 'x-fire-control', fx: { xcomp: 1 }, tags: ['combat'],
      d: 'Battle analysis software that feeds every gunner live firing solutions.',
      say: [['Fleet attack', '+1 level for every ship']] },
    { l: 21, id: 'galactic-banking-network', n: 'Galactic Banking Network', ty: 'finance', fx: { reserveInterest: 5 }, tags: ['economy'],
      d: 'A subspace banking network that invests your treasury, earning interest on the reserve every year.',
      say: [['Reserve interest', '5% a year (at most 10% of gross production)']] },
    { l: 24, id: 'scientific-exchange-protocols', n: 'Scientific Exchange Protocols', ty: 'research', fx: { rpTreaty: 4 }, tags: ['research', 'diplomacy'],
      d: 'Shared research archives with friendly powers: every pact or alliance speeds your own research.',
      say: [['Research', '+4% per pact or alliance (up to +16%)']] },
    { l: 29, id: 'orbital-targeting-arrays', n: 'Orbital Targeting Arrays', ty: 'planetary', fx: { baseCompX: 2 }, tags: ['defence'],
      d: 'Planet-wide sensor grids that guide the missiles of your bases.',
      say: [['Missile bases', '+2 attack levels']] },
    { l: 31, id: 'predictive-fire-control', n: 'Predictive Fire Control', ty: 'computer', g: 'x-fire-control', fx: { xcomp: 2 }, tags: ['combat'],
      d: 'Fire control that predicts where an enemy ship will be before it gets there.',
      say: [['Fleet attack', '+2 levels for every ship']] },
    { l: 33, id: 'heuristic-research-engine', n: 'Heuristic Research Engine', ty: 'research', fx: { researchInterest: 20 }, tags: ['research'],
      d: 'Self-directing research computers that compound every result: research interest rises sharply.',
      say: [['Research interest', '20% a year (cap 3 × this year\'s funding)']] },
    { l: 36, id: 'holovision-broadcast-network', n: 'Holovision Broadcast Network', ty: 'diplomacy', fx: { councilBonus: 20, posAct: 25 }, tags: ['diplomacy'],
      d: 'Your culture on every screen in the galaxy: alien voters favour you and goodwill comes easier.',
      say: [['Galactic Council', '+20 weight with every AI voter'], ['Goodwill', '+25%']] },
    { l: 41, id: 'neural-infiltration-net', n: 'Neural Infiltration Net', ty: 'espionage', fx: { spyOff: 20, spyCostPct: 75 }, tags: ['espionage'],
      d: 'Neural-link agents that slip past security systems easily and cost less to train.',
      say: [['Infiltration', '+20'], ['Spy cost', '−25%']] },
  ];

  const CN = [
    { l: 4, id: 'prefabricated-colony-modules', n: 'Prefabricated Colony Modules', ty: 'industry', fx: { colonyPop: 1, colonyFac: 4 }, tags: ['expansion'],
      d: 'Colony ships carry flat-packed factories and extra berths for every new settlement.',
      say: [['New colonies', '+1 colonist, 4 factories']] },
    { l: 7, id: 'asteroid-mining', n: 'Asteroid Mining', ty: 'industry', fx: { asteroid: 5 }, tags: ['economy'],
      d: 'Mining drones that work the asteroid belts of a system, feeding the industry of its colony.',
      say: [['Asteroid systems', '+5% production (dense fields +10%)']] },
    { l: 12, id: 'robotic-garrisons', n: 'Robotic Garrisons', ty: 'ground', fx: { groundDef: 10 }, tags: ['defence', 'ground'],
      d: 'Armoured robot militias that stand beside your colonists whenever a colony is invaded.',
      say: [['Ground defence', '+10']] },
    { l: 21, id: 'battlefield-salvage', n: 'Battlefield Salvage', ty: 'salvage', fx: { salvage: 20 }, tags: ['combat', 'economy'],
      d: 'Salvage fleets that strip the wrecks after every battle you win and sell what they recover.',
      say: [['Salvage', '20% of the price of destroyed enemy ships, after battles you win']] },
    { l: 22, id: 'orbital-minefields', n: 'Orbital Minefields', ty: 'planetary', fx: { mines: 8 }, tags: ['defence'],
      d: 'Smart mines seeded around your colonies that tear into every fleet coming to attack them.',
      say: [['Minefields', 'enemy stacks attacking your colonies lose 8% of their hit points at once']] },
    { l: 27, id: 'orbital-drydocks', n: 'Orbital Drydocks', ty: 'industry', fx: { shipUpkeepPct: 75 }, tags: ['economy', 'combat'],
      d: 'Automated orbital docks that service your fleets between battles, cutting maintenance costs.',
      say: [['Ship maintenance', '−25%']] },
    { l: 31, id: 'hardened-missile-silos', n: 'Hardened Missile Silos', ty: 'planetary', fx: { baseHpPct: 50, baseCostPct: 80 }, tags: ['defence'],
      d: 'Missile bases sunk deep into bedrock: harder to destroy and cheaper to build.',
      say: [['Missile bases', '+50% hit points, −20% cost']] },
    { l: 32, id: 'siege-engineering', n: 'Siege Engineering', ty: 'bomb', fx: { bombPct: 50, groundOff: 5 }, tags: ['offence', 'ground'],
      d: 'The science of breaking fortified worlds: heavier bombardments and better-drilled assault troops.',
      say: [['Bombardment', '+50% damage'], ['Invading troops', '+5']] },
    { l: 37, id: 'modular-shipyards', n: 'Modular Shipyards', ty: 'industry', fx: { shipCostPct: 90 }, tags: ['economy', 'combat'],
      d: 'Standardised hull modules snapped together in orbit make every ship cheaper to build.',
      say: [['Ship cost', '−10%']] },
    { l: 39, id: 'reverse-engineering-labs', n: 'Reverse Engineering Labs', ty: 'research', fx: { reverseEng: 25 }, tags: ['research', 'combat'],
      d: 'Engineers who pick apart enemy wrecks: each victory may reveal one of the defeated empire\'s secrets.',
      say: [['Captured technology', '25% chance per battle won with enemy ships destroyed']] },
    { l: 43, id: 'arcology-projects', n: 'Arcology Projects', ty: 'growth', fx: { arcology: 10 }, tags: ['population'],
      d: 'Mile-high arcology cities that permanently raise the population limit of every colony.',
      say: [['Max population', '+10% on every colony (at least +5), a permanent improvement']] },
  ];

  const FF = [
    { l: 6, id: 'pressure-domes', n: 'Pressure Domes', ty: 'planetary', fx: { domes: 25 }, tags: ['population'],
      d: 'Force-field domes that seal whole cities against a hostile sky, raising the limit on harsh worlds.',
      say: [['Hostile worlds', '+25% max population (at least +5), a permanent improvement']] },
    { l: 17, id: 'repulsor-field-net', n: 'Repulsor Field Net', ty: 'planetary', fx: { gauntletPct: 30, bombDefPct: 75 }, tags: ['defence'],
      d: 'A repulsor net around your colonies that batters enemy landing craft and deflects bombardment.',
      say: [['Invaders', '+30% transport losses'], ['Bombardment', '−25% damage taken']] },
    { l: 25, id: 'stealth-landing-craft', n: 'Stealth Landing Craft', ty: 'invasion', fx: { gauntletOwnPct: 50 }, tags: ['offence', 'ground'],
      d: 'Troop transports wrapped in sensor-scattering fields, so far fewer are lost on the run in.',
      say: [['Troop transports', 'losses on approach halved']] },
    { l: 36, id: 'inertial-shield-harmonics', n: 'Inertial Shield Harmonics', ty: 'shield', fx: { xmdef: 2 }, tags: ['combat'],
      d: 'Shield pulses timed to deflect incoming warheads, raising the missile defence of every ship.',
      say: [['Ship missile defence', '+2']] },
    { l: 41, id: 'absorption-lattice', n: 'Absorption Lattice', ty: 'shield', fx: { xabsorb: 2 }, tags: ['combat'],
      d: 'A lattice of energy sinks behind each deflector that soaks up even more of every hit.',
      say: [['Ship deflectors', 'absorb +2 per hit']] },
    { l: 48, id: 'planetary-stasis-field', n: 'Planetary Stasis Field', ty: 'planetary', fx: { siegeFloor: 25 }, tags: ['defence'],
      d: 'A last-resort stasis field that freezes a besieged world before its last colonists can die.',
      say: [['Sieges', 'bombs, bio-weapons and battles never push a colony below 25% of its max population']] },
  ];

  const PL = [
    { l: 4, id: 'adaptive-genetics', n: 'Adaptive Genetics', ty: 'growth', nv: 1, fx: { hostileGrowth: true }, tags: ['population'],
      d: 'Gene therapy that adapts colonists to harsh worlds, so hostile planets grow as fast as normal ones.',
      say: [['Hostile worlds', 'population grows at the normal rate']] },
    { l: 7, id: 'accelerated-gestation', n: 'Accelerated Gestation', ty: 'growth', g: 'x-growth', fx: { growthPct: 25 }, tags: ['population'],
      d: 'Medical advances that shorten childhood and lengthen life: natural population growth is faster.',
      say: [['Population growth', '+25%']] },
    { l: 11, id: 'biomass-reactors', n: 'Biomass Reactors', ty: 'eco', fx: { workerPct: 10 }, tags: ['economy'],
      d: 'Reactors that turn colonial biomass into power, adding to the output of every worker.',
      say: [['Worker output', '+10%']] },
    { l: 19, id: 'gaia-seeding', n: 'Gaia Seeding', ty: 'growth', nv: 1, fx: { seedFertile: true }, tags: ['population', 'expansion'],
      d: 'Colony ships carry seed banks that make the soil of a new world fertile from the first day.',
      say: [['New colonies', 'normal worlds are founded fertile']] },
    { l: 25, id: 'terraforming-nanites', n: 'Terraforming Nanites', ty: 'terraform', fx: { terraformCostDelta: 1 }, tags: ['population'],
      d: 'Self-replicating nanites that reshape planets for less: every point of terraforming costs less.',
      say: [['Terraforming', '−1 BC per point (at least 1)']] },
    { l: 28, id: 'small-world-engineering', n: 'Small World Engineering', ty: 'terraform', fx: { smallWorld: 25 }, tags: ['population'],
      d: 'Artificial gravity and buried habitats that let small worlds hold more people.',
      say: [['Small worlds', '+25% max population on worlds of base size 40 or less (at least +5), permanent']] },
    { l: 33, id: 'clone-troopers', n: 'Clone Troopers', ty: 'ground', fx: { groundOff: 10 }, tags: ['offence', 'ground'],
      d: 'Vat-grown soldiers bred for war who fight much harder when your troops invade a planet.',
      say: [['Invading troops', '+10']] },
    { l: 39, id: 'hyper-fertility-treatments', n: 'Hyper-Fertility Treatments', ty: 'growth', g: 'x-growth', fx: { growthPct: 50 }, tags: ['population'],
      d: 'Advanced fertility medicine that makes natural population growth faster still.',
      say: [['Population growth', '+50%']] },
  ];

  const PR = [
    { l: 7, id: 'interstellar-ramscoops', n: 'Interstellar Ramscoops', ty: 'fuel', fx: { civilRange: 1 }, tags: ['expansion', 'logistics'],
      d: 'Ramscoops that harvest interstellar hydrogen in flight, stretching the range of colony ships and scouts.',
      say: [['Colony ships and scouts', '+1 parsec range on top of your fuel cells']] },
    { l: 13, id: 'navigation-beacons', n: 'Navigation Beacons', ty: 'logistics', fx: { beaconWarp: 1 }, tags: ['logistics'],
      d: 'A chain of subspace beacons that speeds every fleet and transport flying between your colonies.',
      say: [['Between your colonies', '+1 warp for fleets and transports']] },
    { l: 17, id: 'emergency-warp-capacitors', n: 'Emergency Warp Capacitors', ty: 'engine', fx: { escape: 30 }, tags: ['combat'],
      d: 'Capacitors that fling a doomed ship into warp, so part of a beaten fleet escapes destruction.',
      say: [['Lost battles', '30% of the ships that would be destroyed escape']] },
    { l: 22, id: 'cryogenic-colony-berths', n: 'Cryogenic Colony Berths', ty: 'logistics', fx: { colonyShipCostPct: 75 }, tags: ['expansion'],
      d: 'Colonists travel frozen in compact cryo berths, making every colony ship cheaper.',
      say: [['Colony ships', '−25% cost']] },
    { l: 28, id: 'combat-thrusters', n: 'Combat Thrusters', ty: 'engine', fx: { xspeed: 1, xinit: 2 }, tags: ['combat'],
      d: 'Vectored thrusters for close manoeuvring: every ship moves further in combat and strikes sooner.',
      say: [['Combat speed', '+1'], ['Initiative', '+2']] },
    { l: 37, id: 'warp-damping-field', n: 'Warp Damping Field', ty: 'planetary', fx: { snare: 2 }, tags: ['defence', 'logistics'],
      d: 'A damping field around your colonies that drags approaching hostile fleets out of warp.',
      say: [['Hostile fleets', '−2 warp within 4 parsecs of your colonies (never below 1)']] },
    { l: 39, id: 'lifeboat-protocols', n: 'Lifeboat Protocols', ty: 'logistics', fx: { evacuate: 30 }, tags: ['resilience'],
      d: 'Evacuation fleets stand ready at every colony, so some of its people escape when a world falls.',
      say: [['Lost colonies', '30% of the population escapes to your nearest colony with room']] },
    { l: 44, id: 'slipstream-drives', n: 'Slipstream Drives', ty: 'engine', fx: { homeWarp: 1 }, tags: ['logistics', 'defence'],
      d: 'Slipstream currents laid along your space: every fleet bound for one of your colonies flies faster.',
      say: [['Fleets bound for your colonies', '+1 warp']] },
    { l: 47, id: 'hyperlane-transports', n: 'Hyperlane Transports', ty: 'logistics', fx: { transBonus: 3 }, tags: ['logistics', 'offence'],
      d: 'Dedicated hyperlane carriers that rush colonists and troops between the stars.',
      say: [['Transports', '+3 parsecs per turn']] },
  ];

  const WE = [
    { l: 3, id: 'point-defense-lasers', n: 'Point Defense Lasers', ty: 'beam', fx: { xmisshield: 20 }, tags: ['combat'],
      d: 'Rapid-tracking lasers on every hull that shoot down part of every missile salvo.',
      say: [['Missile interception', '20% on every ship (anti-missile devices still apply)']] },
    { l: 49, id: 'antimatter-warheads', n: 'Antimatter Warheads', ty: 'missile', fx: { warheadPct: 25 }, tags: ['combat', 'offence'],
      d: 'Antimatter cores for every missile, torpedo and bomb, making each one hit far harder.',
      say: [['Missiles, torpedoes, bombs', '+25% damage']] },
  ];

  const ROWS = [CM, CN, FF, PL, PR, WE];
  const pad2 = n => (n < 10 ? '0' + n : String(n));
  const MIN_KEYS = ['shipUpkeepPct', 'shipCostPct', 'colonyShipCostPct', 'baseCostPct', 'spyCostPct', 'bombDefPct', 'gauntletOwnPct'];
  const BONUS_KEYS = { transBonus: 'transportSpeed' };
  const KEYS = ['survey', 'xcomp', 'xmdef', 'xabsorb', 'xmisshield', 'xspeed', 'xinit', 'warheadPct', 'mines', 'baseCompX', 'baseHpPct', 'baseCostPct', 'spyOff',
    'spyCostPct', 'reserveInterest', 'posAct', 'councilBonus', 'rpTreaty', 'researchInterest', 'colonyPop', 'colonyFac', 'asteroid', 'workerPct', 'groundDef', 'groundOff',
    'salvage', 'reverseEng', 'escape', 'shipUpkeepPct', 'shipCostPct', 'colonyShipCostPct', 'bombPct', 'bombDefPct', 'gauntletPct', 'gauntletOwnPct', 'siegeFloor',
    'arcology', 'domes', 'smallWorld', 'hostileGrowth', 'growthPct', 'terraformCostDelta', 'seedFertile', 'beaconWarp', 'homeWarp', 'snare', 'evacuate', 'civilRange',
    'transBonus'];

  function make(f, r) {
    const t = {
      id: CODES[f] + '-' + pad2(r.l) + '-' + r.id, field: f, level: r.l, tier: Math.ceil(r.l / 5), name: r.n, type: r.ty, desc: r.d,
      effects: r.fx || {}, grants: [], group: r.g || 'singular', pool: 'x', say: r.say || [], tags: r.tags || [],
    };
    if (t.group === 'singular') t.singular = true;
    if (r.nv) t.never = ['silicoid'];
    return t;
  }

  const list = [], byField = [[], [], [], [], [], []], byTier = [];
  for (let f = 0; f < 6; f++) {
    byTier.push([[], [], [], [], [], [], [], [], [], []]);
    for (const r of ROWS[f]) {
      const t = make(f, r);
      if (T.byFL[f][t.level]) throw new Error('techs-x: level ' + t.level + ' of field ' + f + ' is taken by ' + T.byFL[f][t.level].id);
      list.push(t); byField[f].push(t); byTier[f][t.tier - 1].push(t.level);
      T.byId[t.id] = t; T.byFL[f][t.level] = t;
    }
  }
  // obsolescence groups of the chains (gtier = rank by level inside the group); the classic GROUPS table is left alone
  const GROUPS = {};
  for (const t of list) if (t.group !== 'singular') (GROUPS[t.group] = GROUPS[t.group] || []).push(t);
  for (const g in GROUPS) { GROUPS[g].sort((a, b) => a.level - b.level); GROUPS[g].forEach((t, i) => { t.gtier = i + 1; }); GROUPS[g] = GROUPS[g].map(t => t.id); }

  const researchTable = T.researchTable.map((tiers, f) => tiers.map((lv, ti) => lv.concat(byTier[f][ti]).sort((a, b) => a - b)));

  // classic techs that are never swapped out: the essential-check sets (§1.7) and the single-tech "always" tiers
  function protectedLevel(f, level) {
    const t = T.byFL[f][level];
    if (!t || t.pool === 'x') return false;
    if (t.essential) return true;
    return T.researchTable[f][t.tier - 1].length === 1;
  }
  const neverFor = (t, raceId) => !!(t && t.never && t.never.indexOf(raceId) >= 0);
  // the per-slot swap chance of a tier for this race: n / (k + n), k = unprotected classic techs the race may hold, n = expansion techs it may hold
  function swapChance(f, ti, raceId) {
    const n = byTier[f][ti].filter(l => !neverFor(T.byFL[f][l], raceId)).length;
    const k = T.researchTable[f][ti].filter(l => !protectedLevel(f, l) && !neverFor(T.byFL[f][l], raceId)).length;
    return n && k ? n / (k + n) : 0;
  }
  // the swap step: lists = a classic research list (generateResearchList) — mutated and returned. R = a free-standing generator (never S.rs).
  function expandList(lists, raceId, R) {
    for (let f = 0; f < 6; f++) {
      for (let ti = 0; ti < 10; ti++) {
        const slots = lists[f][ti], q = swapChance(f, ti, raceId);
        if (!q || !slots || !slots.length) continue;
        const fresh = byTier[f][ti].filter(l => !neverFor(T.byFL[f][l], raceId));
        for (let i = 0; i < slots.length; i++) {
          const roll = R.next();                                              // one draw per slot, so the stream does not depend on the outcome
          if (protectedLevel(f, slots[i]) || roll >= q) continue;
          const free = fresh.filter(l => slots.indexOf(l) < 0);
          if (!free.length) continue;
          slots[i] = free[R.int(0, free.length - 1)];
        }
        slots.sort((a, b) => a - b);
      }
    }
    return lists;
  }

  const poolOf = x => {
    if (!x) return '';
    if (x.research) return x.research.pool === 'x' ? 'x' : '';
    return x.settings && x.settings.options && x.settings.options.techPool === 'expanded' ? 'x' : '';
  };
  const inPool = (E, t) => !!t && (t.pool !== 'x' || poolOf(E) === 'x');

  T.X = { list, byField, byTier, researchTable, GROUPS, KEYS, MIN_KEYS, BONUS_KEYS, protectedLevel, swapChance, expandList, poolOf, inPool };
});
