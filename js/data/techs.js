// Technology data — research/02-technology.md (verified) as machine-readable tables plus tiny pure helpers. Worker-safe, JSON-friendly.
//
// MOO.Data.Techs
//   FIELDS FIELD_CODES FIELD_NAMES RACE_IDS         field index 0..5 = CM CN FF PL PR WE (computers construction forcefields planetology propulsion weapons)
//   list / byId / byField[f] / byFL[f][level]       every tech: 11 level-1 start techs, the 180 researchable techs, Death Ray (WE 36, Orion only),
//                                                   and the 60 advanced "general improvement" techs (levels 55..100 step 5, effects {tlOnly:true})
//   techAt(field, level) fieldIndex(field)          lookup (field as index, code 'cm' or name 'computers'); null when the level holds no tech
//   l1Bundle[f]                                     the free level-1 techs of a field (byFL[f][1] is the first one of them)
//   GROUPS                                          group name → tech ids ordered by level (the order of gtier)
//   researchTable[f][tier0..9]                      valid researchable levels per tier (a per-empire random list is a subset of this)
//   RACE_COST_MUL DIFF_COST_MUL costHuman costAI    RP cost of a tech (exact integer formulas, §1.5)
//   generateResearchList(R, raceId[, opts])         §1.7 → researchlist[6][10][≤3] (levels ascending) or null when the essential-tech check fails (caller retries);
//                                                   opts.silicoidFix also withholds PL 24 / 30 from Silicoids; essentialOk(lists, raceId[, opts]) is the check itself
//   visibleTiers(done) choiceList(fieldList, done)  §1.8 choose-next-tech window (tier unlock rule, 12 entries, advanced-tech fallback)
//   tl(field, done)                                 §1.6 tech level 1..99 (drives miniaturisation, worker output, hull space)
//   T50 T25 tm miniCost miniSpace                   Appendix C miniaturisation tables (51 entries each) and helpers
//   groundBonus(g) tradeValue(t) GROUP_TRADE_MUL    §5 ground-combat tech force; §1.10 AI tech value
//   EFFECT_KEYS GRANT_IDS GROUPS BASE_HP BASE_MISSILES BASE_SCATTER CONST   vocabularies and constants shared with other modules
//
// Tech record: { id, field, level, tier, name, type, desc, effects:{…}, grants:[{kind,id}], group, gtier?, never?, neverFix?, essential?, singular?, free?, special? }
//   id        '<field code>-<level 2 digits>-<slug>', e.g. 'cm-02-ecm-1', 'we-36-death-ray'          tier = ceil(level / 5)
//   type      computer industry special ecm scanner armor waste ground shield planetary eco terraform environment bio growth defense
//             engine fuel invasion beam missile bomb torpedo advanced          (the codes of research/02 Appendix A)
//   group     obsolescence / AI-valuation group (Appendix D): ecm battle-computer robotic-controls scanner waste industrial-tech armor repair deflector
//             planetary-shield anti-missile terraforming environment eco-restoration personal-armor personal-shield engine fuel beam rocket
//             personal-weapon bomb bio-weapon pulsar stream-projector penetrating-beam, 'singular' (all the rest, AI value x10) or 'advanced'.
//             gtier = rank inside the group by level (inferred from names, unverified in the research doc).
//   never     ['silicoid']  never offered to Silicoids (§1.7).  neverFix = additionally withheld when opts.silicoidFix (PL 24, PL 30: the 1oom bug-fix list)
//   essential true         flagged for the essential-tech check of the tree generator (§1.7)
//   free      true         level-1 start bundle (everybody owns it from turn 1)         special 'orion-only' = never researchable (Death Ray)
//
// EFFECT KEYS (tech.effects). sim/research.js folds all owned techs into E.mods, taking the best value per key
// (lowest for factoryCost / wasteScale / incPopCost / colonyFor, highest for every other number, OR for booleans):
//   key               value                 meaning (default when no owned tech sets it)
//   factoryCost       BC                    price of one factory (10)
//   robotic           n                     factories operated per colonist (2)
//   wasteScale        tenths                pollution per operated factory: 10 = full, 0 = none (10)
//   ecoRestore        n                     units of waste cleaned per BC of ecology spending (2)
//   fuel              parsecs               ship range from the nearest own colony, 30 = unlimited (3)
//   scan              parsecs               planet scan range (3)
//   transportSpeed    parsecs/turn          speed of colony / population transports (1)
//   warp              n                     warp factor of the best engine; a ship moves `warp` parsecs per turn (1)
//   stargate          flag                  stargates can be built
//   interdictor       flag                  enemy sub-space teleporters are nullified in battles over your planets
//   combatTransporter flag                  at least half of the invading troop ships land despite planetary defences
//   hyperComm         flag                  fleets already in transit can be redirected
//   scanFleetInfo     flag                  scanners also show destination and arrival time of enemy fleets
//   advScanner        flag                  planet size / environment / resources are visible inside scan range without a ship
//   colonyFor         planet type index     least hospitable type a colony base can settle: 7 minimal (default) 6 barren 5 tundra 4 dead 3 inferno 2 toxic 1 radiated
//   terraform         +N population         largest terraforming step known …
//   terraformCost     BC per +1 population  … and the price per population point of THAT step (set in the same tech: 5,5,4,4,3,3,2,2,2)
//   soil              flag                  Soil Enrichment project (Normal → Fertile growth) is available
//   advSoil           flag                  Advanced Soil Enrichment project (→ Gaia) is available from Normal OR Fertile growth; it does NOT set `soil` (only PL 16 does:
//                                           1oom have_soil_enrich = level 16 alone), so a tree with PL 30 but without PL 16 goes Normal → Gaia for 300 BC in one step
//   atmos             flag                  Atmospheric Terraforming project (Hostile → Normal growth) is available
//   incPopCost        BC                    price of +1 population bought with the ecology slider (20)
//   antidote          n                     population damage prevented per bio-weapon hit: 1 or 2 (0)
//   bioDefense        flag                  set together with antidote
//   planetShield      {level, cost}         planetary shield class 5/10/15/20 and its build cost in BC 500/1000/1500/2000
//   groundTier        {group, tier}         personal ground-combat gear; group armor 1-6, suit 1-3, shield 1-3, weapon 1-5 (see groundBonus)
//   baseHp            index 0..6            armour tier of missile bases, indexes BASE_HP (0)
//   baseComp          1..11                 Mark of the best battle computer (missile bases, spy rolls)
//   baseEcm           1..10                 Mark of the best ECM jammer
//   baseShield        absorb 1..15          damage absorbed per hit by the best deflector
//   baseMissile       1..8                  best 2-shot single-warhead missile = BASE_MISSILES[n-1]
//   baseScatter       1..3                  best scatter pack = BASE_SCATTER[n-1]
//   tlOnly            flag                  advanced tech: adds tech level (TL) only
//
// grants = ship parts the tech unlocks: {kind, id}. kinds: weapon (beam, missile, torpedo) · bomb (bombs and bio-weapons) · computer · ecm · shield ·
// armor · engine · special. research.js stores them as E.grants['kind:id']. Every id is listed in GRANT_IDS at the bottom for js/data/components.js.
// Level 1 is the only level shared by several techs (the free start bundle): research.js folds the whole l1Bundle[f] in for level 1, byFL[f][level] for every other level.
//
// NOTE: cross-check of Appendix A against the §2 tables (scripted when this file was written):
//   * names, levels, tiers and Appendix-A type codes agree on all 180 researchable techs; the RP column equals 30·L² on every row; counts 31/24/23/29/27/46.
//   * mismatch 1: §2.6 lists Laser and Heavy Laser as two level-1 rows (12 level-1 techs) while Appendix A has a single "Laser / Heavy Laser" row (11).
//     Like Ion Cannon / Heavy Ion Cannon etc. it is one tech granting both mounts here → l1Bundle sizes [3,2,1,1,1,3].
//   * mismatch 2: §2.1 spells "Robotic Controls (II)", Appendix A "Robotic Controls II" → Appendix A spelling.
//   * §2 "Type" cells ('ship special', 'bio weapon') are prose; the Appendix A codes (special, bio, …) are used.
//   * §1.7 says Silicoids "also never get PL 24 / PL 30 in 1oom's bug-fix mode"; the published ~96.1 techs per Silicoid tree only fits WITHOUT them,
//     so the default follows the §1.7 lists and PL 24/30 carry neverFix (generateResearchList(R, 'silicoid', {silicoidFix:true}) applies it).
//   * Appendix D group membership is inferred from names by the research doc (unverified); gtier is derived from level order inside a group.
//   * advanced tech names ("Advanced <Field> Tech I…X") are unverified English; effect/level/cost data are exact.
MOO.def(function (M) {
  'use strict';

  const FIELDS = ['computers', 'construction', 'forcefields', 'planetology', 'propulsion', 'weapons'];
  const FIELD_CODES = ['cm', 'cn', 'ff', 'pl', 'pr', 'we'];
  const FIELD_NAMES = ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons'];
  const RACE_IDS = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];

  // §1.5 research cost multipliers in percent (Excellent 60, Good 80, Average 100, Poor 125)
  const RACE_COST_MUL = {
    human:    { cm: 100, cn: 100, ff: 60,  pl: 80,  pr: 80,  we: 100 },
    mrrshan:  { cm: 100, cn: 125, ff: 100, pl: 100, pr: 100, we: 60 },
    silicoid: { cm: 80,  cn: 125, ff: 125, pl: 125, pr: 125, we: 125 },
    sakkra:   { cm: 100, cn: 100, ff: 100, pl: 60,  pr: 100, we: 100 },
    psilon:   { cm: 80,  cn: 80,  ff: 80,  pl: 80,  pr: 80,  we: 80 },
    alkari:   { cm: 100, cn: 100, ff: 125, pl: 100, pr: 60,  we: 100 },
    klackon:  { cm: 100, cn: 60,  ff: 100, pl: 100, pr: 125, we: 100 },
    bulrathi: { cm: 125, cn: 80,  ff: 100, pl: 100, pr: 100, we: 80 },
    meklar:   { cm: 60,  cn: 100, ff: 100, pl: 125, pr: 100, we: 100 },
    darlok:   { cm: 80,  cn: 100, ff: 100, pl: 100, pr: 100, we: 100 },
  };
  const DIFF_COST_MUL = [20, 25, 30, 35, 40];            // human multiplier by difficulty index simple … impossible
  const NEUTRAL = { cm: 100, cn: 100, ff: 100, pl: 100, pr: 100, we: 100 };

  // ---- the tech tables ---------------------------------------------------------------------------------------------------------
  // row keys: l level · id slug · n name · ty type · g group (omitted = singular) · fx effects · gr grants ('kind:id' or array) · d description
  //           flags: free (level-1 bundle) · nv (never offered to Silicoids) · nvf (also withheld in silicoidFix mode) · ess (essential check) · orion (Orion-only)
  const CM = [
    { l: 1, id: 'battle-computer-1', n: 'Battle Computer Mark I', ty: 'computer', g: 'battle-computer', free: 1, fx: { baseComp: 1 }, gr: 'computer:mark-1-computer',
      d: 'A rudimentary fire-control computer that gives every ship a slight edge when aiming.' },
    { l: 1, id: 'robotic-controls-2', n: 'Robotic Controls II', ty: 'industry', g: 'robotic-controls', free: 1, fx: { robotic: 2 },
      d: 'Basic factory automation that lets each colonist operate two factories.' },
    { l: 1, id: 'battle-scanner', n: 'Battle Scanner', ty: 'special', free: 1, gr: 'special:battle-scanner',
      d: 'Shipboard sensors that expose the full specifications of enemy vessels once a battle begins.' },
    { l: 2, id: 'ecm-1', n: 'ECM Jammer Mark I', ty: 'ecm', g: 'ecm', fx: { baseEcm: 1 }, gr: 'ecm:ecm-1',
      d: 'A first-generation jamming suite that makes incoming missiles slightly more likely to miss.' },
    { l: 4, id: 'deep-space-scanner', n: 'Deep Space Scanner', ty: 'scanner', g: 'scanner', fx: { scan: 5 },
      d: 'Upgraded long-range sensors that extend your view of neighbouring systems out to five parsecs.' },
    { l: 5, id: 'battle-computer-2', n: 'Battle Computer Mark II', ty: 'computer', g: 'battle-computer', fx: { baseComp: 2 }, gr: 'computer:mark-2-computer',
      d: 'A quicker targeting computer that tightens the aim of shipboard weapons to attack level 2.' },
    { l: 7, id: 'ecm-2', n: 'ECM Jammer Mark II', ty: 'ecm', g: 'ecm', fx: { baseEcm: 2 }, gr: 'ecm:ecm-2',
      d: 'Improved decoys and jamming that raise missile defence to level 2.' },
    { l: 8, id: 'robotic-controls-3', n: 'Improved Robotic Controls III', ty: 'industry', g: 'robotic-controls', ess: 1, fx: { robotic: 3 },
      d: 'Smarter automation that lets each colonist supervise three factories.' },
    { l: 10, id: 'battle-computer-3', n: 'Battle Computer Mark III', ty: 'computer', g: 'battle-computer', fx: { baseComp: 3 }, gr: 'computer:mark-3-computer',
      d: 'A third-generation battle computer that lifts ship accuracy to attack level 3.' },
    { l: 12, id: 'ecm-3', n: 'ECM Jammer Mark III', ty: 'ecm', g: 'ecm', fx: { baseEcm: 3 }, gr: 'ecm:ecm-3',
      d: 'Layered jamming across several bands that raises missile defence to level 3.' },
    { l: 13, id: 'improved-space-scanner', n: 'Improved Space Scanner', ty: 'scanner', g: 'scanner', fx: { scan: 7, scanFleetInfo: true },
      d: 'A wider sensor net that reaches seven parsecs and shows where enemy fleets are heading and when they will arrive.' },
    { l: 15, id: 'battle-computer-4', n: 'Battle Computer Mark IV', ty: 'computer', g: 'battle-computer', fx: { baseComp: 4 }, gr: 'computer:mark-4-computer',
      d: 'A fourth-generation fire-control system that brings ships to attack level 4.' },
    { l: 17, id: 'ecm-4', n: 'ECM Jammer Mark IV', ty: 'ecm', g: 'ecm', fx: { baseEcm: 4 }, gr: 'ecm:ecm-4',
      d: 'Adaptive jamming that retunes itself against each missile for missile defence level 4.' },
    { l: 18, id: 'robotic-controls-4', n: 'Improved Robotic Controls IV', ty: 'industry', g: 'robotic-controls', ess: 1, fx: { robotic: 4 },
      d: 'Self-directing assembly lines that let each colonist handle four factories.' },
    { l: 20, id: 'battle-computer-5', n: 'Battle Computer Mark V', ty: 'computer', g: 'battle-computer', fx: { baseComp: 5 }, gr: 'computer:mark-5-computer',
      d: 'A predictive targeting engine that pushes ship accuracy to attack level 5.' },
    { l: 22, id: 'ecm-5', n: 'ECM Jammer Mark V', ty: 'ecm', g: 'ecm', fx: { baseEcm: 5 }, gr: 'ecm:ecm-5',
      d: 'Advanced spoofing gear that fools missile seekers at defence level 5.' },
    { l: 23, id: 'advanced-space-scanner', n: 'Advanced Space Scanner', ty: 'scanner', g: 'scanner', fx: { scan: 9, scanFleetInfo: true, advScanner: true },
      d: 'Nine-parsec sensors that read the size, climate and resources of distant planets and follow enemy fleet movements.' },
    { l: 25, id: 'battle-computer-6', n: 'Battle Computer Mark VI', ty: 'computer', g: 'battle-computer', fx: { baseComp: 6 }, gr: 'computer:mark-6-computer',
      d: 'A multi-target tracking computer worth attack level 6.' },
    { l: 27, id: 'ecm-6', n: 'ECM Jammer Mark VI', ty: 'ecm', g: 'ecm', fx: { baseEcm: 6 }, gr: 'ecm:ecm-6',
      d: 'Sophisticated signal confusion that delivers missile defence level 6.' },
    { l: 28, id: 'robotic-controls-5', n: 'Improved Robotic Controls V', ty: 'industry', g: 'robotic-controls', ess: 1, fx: { robotic: 5 },
      d: 'Near-autonomous production lines that let each colonist oversee five factories.' },
    { l: 30, id: 'battle-computer-7', n: 'Battle Computer Mark VII', ty: 'computer', g: 'battle-computer', fx: { baseComp: 7 }, gr: 'computer:mark-7-computer',
      d: 'A seventh-generation combat mind that gives ships attack level 7.' },
    { l: 32, id: 'ecm-7', n: 'ECM Jammer Mark VII', ty: 'ecm', g: 'ecm', fx: { baseEcm: 7 }, gr: 'ecm:ecm-7',
      d: 'Dense false-signal generators that deliver missile defence level 7.' },
    { l: 34, id: 'hyperspace-communications', n: 'Hyperspace Communications', ty: 'special', fx: { hyperComm: true },
      d: 'Instant subspace messaging that lets you change the destination of fleets that are already in transit.' },
    { l: 35, id: 'battle-computer-8', n: 'Battle Computer Mark VIII', ty: 'computer', g: 'battle-computer', fx: { baseComp: 8 }, gr: 'computer:mark-8-computer',
      d: 'A battle computer of remarkable speed that provides attack level 8.' },
    { l: 37, id: 'ecm-8', n: 'ECM Jammer Mark VIII', ty: 'ecm', g: 'ecm', fx: { baseEcm: 8 }, gr: 'ecm:ecm-8',
      d: 'A powerful countermeasure array that provides missile defence level 8.' },
    { l: 38, id: 'robotic-controls-6', n: 'Improved Robotic Controls VI', ty: 'industry', g: 'robotic-controls', ess: 1, fx: { robotic: 6 },
      d: 'Fully networked robot workforces that let each colonist run six factories.' },
    { l: 40, id: 'battle-computer-9', n: 'Battle Computer Mark IX', ty: 'computer', g: 'battle-computer', fx: { baseComp: 9 }, gr: 'computer:mark-9-computer',
      d: 'A near-clairvoyant targeting system that grants attack level 9.' },
    { l: 42, id: 'ecm-9', n: 'ECM Jammer Mark IX', ty: 'ecm', g: 'ecm', fx: { baseEcm: 9 }, gr: 'ecm:ecm-9',
      d: 'Masterful signal manipulation that reaches missile defence level 9.' },
    { l: 45, id: 'battle-computer-10', n: 'Battle Computer Mark X', ty: 'computer', g: 'battle-computer', fx: { baseComp: 10 }, gr: 'computer:mark-10-computer',
      d: 'An extraordinarily fast fire-control brain that reaches attack level 10.' },
    { l: 46, id: 'oracle-interface', n: 'Oracle Interface', ty: 'special', gr: 'special:oracle-interface',
      d: 'A predictive targeting link meant to help the beam weapons of a ship cut through enemy defences.' },
    { l: 47, id: 'ecm-10', n: 'ECM Jammer Mark X', ty: 'ecm', g: 'ecm', fx: { baseEcm: 10 }, gr: 'ecm:ecm-10',
      d: 'The ultimate jamming suite, giving missile defence level 10.' },
    { l: 48, id: 'robotic-controls-7', n: 'Improved Robotic Controls VII', ty: 'industry', g: 'robotic-controls', ess: 1, fx: { robotic: 7 },
      d: 'Peak automation: each colonist can command seven factories at once.' },
    { l: 49, id: 'technology-nullifier', n: 'Technology Nullifier', ty: 'special', gr: 'special:technology-nullifier',
      d: 'A ship system that scrambles the targeting computers of enemy vessels and degrades their accuracy.' },
    { l: 50, id: 'battle-computer-11', n: 'Battle Computer Mark XI', ty: 'computer', g: 'battle-computer', fx: { baseComp: 11 }, gr: 'computer:mark-11-computer',
      d: 'The finest battle computer ever built, delivering attack level 11.' },
  ];

  const CN = [
    { l: 1, id: 'titanium-armor', n: 'Titanium Armor', ty: 'armor', g: 'armor', free: 1, fx: { baseHp: 0 }, gr: 'armor:titanium-armor',
      d: 'Plain titanium plating, the baseline hull protection every shipyard starts with.' },
    { l: 1, id: 'reserve-fuel-tanks', n: 'Reserve Fuel Tanks', ty: 'special', free: 1, gr: 'special:reserve-fuel-tanks',
      d: 'Extra fuel tanks that let a ship fly three parsecs beyond your normal supply range.' },
    { l: 3, id: 'industrial-tech-9', n: 'Improved Industrial Tech 9', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 9 },
      d: 'Streamlined factory design that cuts the price of a new factory to 9 BC.' },
    { l: 5, id: 'waste-80', n: 'Reduced Industrial Waste 80%', ty: 'waste', g: 'waste', nv: 1, fx: { wasteScale: 8 },
      d: 'Cleaner industrial processes that cut the pollution from each factory to four-fifths of normal.' },
    { l: 8, id: 'industrial-tech-8', n: 'Improved Industrial Tech 8', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 8 },
      d: 'Improved fabrication methods that lower the price of a factory to 8 BC.' },
    { l: 10, id: 'duralloy-armor', n: 'Duralloy Armor', ty: 'armor', g: 'armor', fx: { baseHp: 1, groundTier: { group: 'armor', tier: 1 } }, gr: 'armor:duralloy-armor',
      d: 'A tougher alloy plating that adds half again to hull strength and gives ground troops better body armour.' },
    { l: 11, id: 'battle-suits', n: 'Battle Suits', ty: 'ground', g: 'personal-armor', fx: { groundTier: { group: 'suit', tier: 1 } },
      d: 'Powered combat suits that give your invading troops a solid edge in ground fighting.' },
    { l: 13, id: 'industrial-tech-7', n: 'Improved Industrial Tech 7', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 7 },
      d: 'Modular production lines that bring the price of a factory down to 7 BC.' },
    { l: 14, id: 'automated-repair', n: 'Automated Repair System', ty: 'special', g: 'repair', gr: 'special:automated-repair',
      d: 'Damage-control robots that restore a slice of the hit points of a ship every combat round.' },
    { l: 15, id: 'waste-60', n: 'Reduced Industrial Waste 60%', ty: 'waste', g: 'waste', nv: 1, fx: { wasteScale: 6 },
      d: 'Closed-loop manufacturing that holds pollution from each factory to six-tenths of normal.' },
    { l: 17, id: 'zortium-armor', n: 'Zortium Armor', ty: 'armor', g: 'armor', fx: { baseHp: 2, groundTier: { group: 'armor', tier: 2 } }, gr: 'armor:zortium-armor',
      d: 'A dense plating that doubles the strength of a hull and further toughens ground troops.' },
    { l: 18, id: 'industrial-tech-6', n: 'Improved Industrial Tech 6', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 6 },
      d: 'Further factory refinements that cut the price of a factory to 6 BC.' },
    { l: 23, id: 'industrial-tech-5', n: 'Improved Industrial Tech 5', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 5 },
      d: 'High-efficiency fabricators that reduce the price of a factory to 5 BC.' },
    { l: 24, id: 'armored-exoskeleton', n: 'Armored Exoskeleton', ty: 'ground', g: 'personal-armor', fx: { groundTier: { group: 'suit', tier: 2 } },
      d: 'Powered exoskeletons that make ground troops much harder to stop than battle suits do.' },
    { l: 25, id: 'waste-40', n: 'Reduced Industrial Waste 40%', ty: 'waste', g: 'waste', nv: 1, fx: { wasteScale: 4 },
      d: 'Almost sealed industrial processes that limit pollution to four-tenths of normal.' },
    { l: 26, id: 'andrium-armor', n: 'Andrium Armor', ty: 'armor', g: 'armor', fx: { baseHp: 3, groundTier: { group: 'armor', tier: 3 } }, gr: 'armor:andrium-armor',
      d: 'A rare-metal plating that gives a hull two and a half times its base strength.' },
    { l: 28, id: 'industrial-tech-4', n: 'Improved Industrial Tech 4', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 4 },
      d: 'Self-replicating tooling that lowers the price of a factory to 4 BC.' },
    { l: 33, id: 'industrial-tech-3', n: 'Improved Industrial Tech 3', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 3 },
      d: 'Molecular assembly that brings the price of a factory down to 3 BC.' },
    { l: 34, id: 'tritanium-armor', n: 'Tritanium Armor', ty: 'armor', g: 'armor', fx: { baseHp: 4, groundTier: { group: 'armor', tier: 4 } }, gr: 'armor:tritanium-armor',
      d: 'A superdense plating that triples the strength of a hull.' },
    { l: 35, id: 'waste-20', n: 'Reduced Industrial Waste 20%', ty: 'waste', g: 'waste', nv: 1, fx: { wasteScale: 2 },
      d: 'Nearly clean industry that releases only a fifth of the normal pollution.' },
    { l: 36, id: 'advanced-damage-control', n: 'Advanced Damage Control', ty: 'special', g: 'repair', gr: 'special:advanced-damage-control',
      d: 'A ship system that restores a bigger share of hit points each round than the basic repair system.' },
    { l: 38, id: 'industrial-tech-2', n: 'Improved Industrial Tech 2', ty: 'industry', g: 'industrial-tech', fx: { factoryCost: 2 },
      d: 'Nanoscale fabrication that makes a factory cost only 2 BC.' },
    { l: 40, id: 'powered-armor', n: 'Powered Armor', ty: 'ground', g: 'personal-armor', fx: { groundTier: { group: 'suit', tier: 3 } },
      d: 'Full powered battle armour that gives infantry the best protection available.' },
    { l: 42, id: 'adamantium-armor', n: 'Adamantium Armor', ty: 'armor', g: 'armor', fx: { baseHp: 5, groundTier: { group: 'armor', tier: 5 } }, gr: 'armor:adamantium-armor',
      d: 'A near-impenetrable plating that gives a hull three and a half times its base strength.' },
    { l: 45, id: 'waste-elimination', n: 'Industrial Waste Elimination', ty: 'waste', g: 'waste', nv: 1, fx: { wasteScale: 0 },
      d: 'Recycling so thorough that your factories no longer pollute at all.' },
    { l: 50, id: 'neutronium-armor', n: 'Neutronium Armor', ty: 'armor', g: 'armor', fx: { baseHp: 6, groundTier: { group: 'armor', tier: 6 } }, gr: 'armor:neutronium-armor',
      d: 'Collapsed-matter plating that quadruples hull strength, the finest armour in the galaxy.' },
  ];

  const FF = [
    { l: 1, id: 'class-1-deflector', n: 'Class I Deflector Shield', ty: 'shield', g: 'deflector', free: 1, fx: { baseShield: 1 }, gr: 'shield:class-1-shield',
      d: 'The simplest deflector screen, shrugging off one point of damage from every hit.' },
    { l: 4, id: 'class-2-deflector', n: 'Class II Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 2 }, gr: 'shield:class-2-shield',
      d: 'A stronger deflector screen that absorbs two points of damage from every hit.' },
    { l: 8, id: 'personal-deflector', n: 'Personal Deflector Shield', ty: 'ground', g: 'personal-shield', fx: { groundTier: { group: 'shield', tier: 1 } },
      d: 'A personal force screen that improves the survival odds of your troops in ground combat.' },
    { l: 10, id: 'class-3-deflector', n: 'Class III Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 3 }, gr: 'shield:class-3-shield',
      d: 'A deflector screen that absorbs three points of damage from every hit.' },
    { l: 12, id: 'planetary-shield-5', n: 'Class V Planetary Shield', ty: 'planetary', g: 'planetary-shield', fx: { planetShield: { level: 5, cost: 500 } },
      d: 'A planet-wide shield that lets each missile base soak up five extra points of damage per hit.' },
    { l: 14, id: 'class-4-deflector', n: 'Class IV Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 4 }, gr: 'shield:class-4-shield',
      d: 'A deflector screen that absorbs four points of damage from every hit.' },
    { l: 16, id: 'repulsor-beam', n: 'Repulsor Beam', ty: 'special', gr: 'special:repulsor-beam',
      d: 'A ship system that shoves nearby enemy ships back and keeps them at a distance.' },
    { l: 20, id: 'class-5-deflector', n: 'Class V Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 5 }, gr: 'shield:class-5-shield',
      d: 'A deflector screen that absorbs five points of damage from every hit.' },
    { l: 21, id: 'personal-absorption-shield', n: 'Personal Absorption Shield', ty: 'ground', g: 'personal-shield', fx: { groundTier: { group: 'shield', tier: 2 } },
      d: 'A better personal shield that further bolsters your invading troops.' },
    { l: 22, id: 'planetary-shield-10', n: 'Class X Planetary Shield', ty: 'planetary', g: 'planetary-shield', fx: { planetShield: { level: 10, cost: 1000 } },
      d: 'A stronger planetary shield that gives each missile base ten extra points of absorption.' },
    { l: 24, id: 'class-6-deflector', n: 'Class VI Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 6 }, gr: 'shield:class-6-shield',
      d: 'A deflector screen that absorbs six points of damage from every hit.' },
    { l: 27, id: 'cloaking-device', n: 'Cloaking Device', ty: 'special', gr: 'special:cloaking-device',
      d: 'A ship system that makes a vessel far harder to hit, though the ship cannot fire while the cloak is on.' },
    { l: 30, id: 'class-7-deflector', n: 'Class VII Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 7 }, gr: 'shield:class-7-shield',
      d: 'A deflector screen that absorbs seven points of damage from every hit.' },
    { l: 31, id: 'zyro-shield', n: 'Zyro Shield', ty: 'special', g: 'anti-missile', gr: 'special:zyro-shield',
      d: 'A ship system that destroys most incoming missiles before they can strike.' },
    { l: 32, id: 'planetary-shield-15', n: 'Class XV Planetary Shield', ty: 'planetary', g: 'planetary-shield', fx: { planetShield: { level: 15, cost: 1500 } },
      d: 'A planetary shield that gives each missile base fifteen extra points of absorption.' },
    { l: 34, id: 'class-9-deflector', n: 'Class IX Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 9 }, gr: 'shield:class-9-shield',
      d: 'A deflector screen that absorbs nine points of damage from every hit.' },
    { l: 37, id: 'stasis-field', n: 'Stasis Field', ty: 'special', gr: 'special:stasis-field',
      d: 'A ship system that freezes a target ship, removing it from the battle for a round.' },
    { l: 38, id: 'personal-barrier-shield', n: 'Personal Barrier Shield', ty: 'ground', g: 'personal-shield', fx: { groundTier: { group: 'shield', tier: 3 } },
      d: 'The best personal shield, giving ground troops their strongest protection.' },
    { l: 40, id: 'class-11-deflector', n: 'Class XI Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 11 }, gr: 'shield:class-11-shield',
      d: 'A deflector screen that absorbs eleven points of damage from every hit.' },
    { l: 42, id: 'planetary-shield-20', n: 'Class XX Planetary Shield', ty: 'planetary', g: 'planetary-shield', fx: { planetShield: { level: 20, cost: 2000 } },
      d: 'The mightiest planetary shield, giving each missile base twenty extra points of absorption.' },
    { l: 43, id: 'black-hole-generator', n: 'Black Hole Generator', ty: 'special', gr: 'special:black-hole-generator',
      d: 'A ship system that opens a micro black hole to annihilate enemy ships, with strong shields reducing the odds.' },
    { l: 44, id: 'class-13-deflector', n: 'Class XIII Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 13 }, gr: 'shield:class-13-shield',
      d: 'A deflector screen that absorbs thirteen points of damage from every hit.' },
    { l: 46, id: 'lightning-shield', n: 'Lightning Shield', ty: 'special', g: 'anti-missile', gr: 'special:lightning-shield',
      d: 'A ship system that intercepts nearly every missile before it can hit.' },
    { l: 50, id: 'class-15-deflector', n: 'Class XV Deflector Shield', ty: 'shield', g: 'deflector', fx: { baseShield: 15 }, gr: 'shield:class-15-shield',
      d: 'The strongest deflector ever built, absorbing fifteen points of damage from every hit.' },
  ];

  const PL = [
    { l: 1, id: 'ecological-restoration', n: 'Ecological Restoration', ty: 'eco', g: 'eco-restoration', free: 1, fx: { ecoRestore: 2 }, gr: 'special:standard-colony-base',
      d: 'Ecology spending scrubs two units of industrial waste per BC, and the standard colony base becomes available.' },
    { l: 2, id: 'terraforming-10', n: 'Terraforming +10', ty: 'terraform', g: 'terraforming', fx: { terraform: 10, terraformCost: 5 },
      d: 'Lets ecology spending raise the population ceiling of a planet by up to 10.' },
    { l: 3, id: 'controlled-barren', n: 'Controlled Barren Environment', ty: 'environment', g: 'environment', nv: 1, fx: { colonyFor: 6 }, gr: 'special:barren-colony-base',
      d: 'Sealed habitats that let colonists settle barren worlds.' },
    { l: 5, id: 'eco-restoration-2', n: 'Improved Ecological Restoration', ty: 'eco', g: 'eco-restoration', nv: 1, fx: { ecoRestore: 3 },
      d: 'Better cleanup methods that remove three units of waste per BC.' },
    { l: 6, id: 'controlled-tundra', n: 'Controlled Tundra Environment', ty: 'environment', g: 'environment', nv: 1, fx: { colonyFor: 5 }, gr: 'special:tundra-colony-base',
      d: 'Insulated habitats that let colonists settle frozen tundra worlds.' },
    { l: 8, id: 'terraforming-20', n: 'Terraforming +20', ty: 'terraform', g: 'terraforming', fx: { terraform: 20, terraformCost: 5 },
      d: 'Improved terraforming that can raise a population ceiling by up to 20.' },
    { l: 9, id: 'controlled-dead', n: 'Controlled Dead Environment', ty: 'environment', g: 'environment', nv: 1, fx: { colonyFor: 4 }, gr: 'special:dead-colony-base',
      d: 'Life-support systems that let colonists settle airless dead worlds.' },
    { l: 10, id: 'death-spores', n: 'Death Spores', ty: 'bio', g: 'bio-weapon', gr: 'bomb:death-spores',
      d: 'A bio-weapon that kills population on a bombarded planet and ignores shields.' },
    { l: 12, id: 'controlled-inferno', n: 'Controlled Inferno Environment', ty: 'environment', g: 'environment', ess: 1, nv: 1, fx: { colonyFor: 3 }, gr: 'special:inferno-colony-base',
      d: 'Heat-proof habitats that let colonists settle scorching inferno worlds.' },
    { l: 13, id: 'eco-restoration-3', n: 'Enhanced Ecological Restoration', ty: 'eco', g: 'eco-restoration', nv: 1, fx: { ecoRestore: 5 },
      d: 'Advanced scrubbers that clear five units of waste per BC.' },
    { l: 14, id: 'terraforming-30', n: 'Terraforming +30', ty: 'terraform', g: 'terraforming', fx: { terraform: 30, terraformCost: 4 },
      d: 'Further terraforming advances that can raise a population ceiling by up to 30.' },
    { l: 15, id: 'controlled-toxic', n: 'Controlled Toxic Environment', ty: 'environment', g: 'environment', nv: 1, fx: { colonyFor: 2 }, gr: 'special:toxic-colony-base',
      d: 'Filtered habitats that let colonists settle poisonous toxic worlds.' },
    { l: 16, id: 'soil-enrichment', n: 'Soil Enrichment', ty: 'growth', nv: 1, fx: { soil: true },
      d: 'A costly ecology project that turns an ordinary planet fertile, raising its population capacity by a quarter.' },
    { l: 17, id: 'bio-toxin-antidote', n: 'Bio Toxin Antidote', ty: 'defense', fx: { antidote: 1, bioDefense: true },
      d: 'A defence that blunts bio-weapon attacks, saving one citizen per hit.' },
    { l: 18, id: 'controlled-radiated', n: 'Controlled Radiated Environment', ty: 'environment', g: 'environment', nv: 1, fx: { colonyFor: 1 }, gr: 'special:radiated-colony-base',
      d: 'Shielded habitats that let colonists settle even radiated worlds.' },
    { l: 20, id: 'terraforming-40', n: 'Terraforming +40', ty: 'terraform', g: 'terraforming', fx: { terraform: 40, terraformCost: 4 },
      d: 'Terraforming that can raise a population ceiling by up to 40.' },
    { l: 21, id: 'cloning', n: 'Cloning', ty: 'growth', fx: { incPopCost: 10 },
      d: 'Cheaper population growth: each new citizen now costs 10 BC instead of 20.' },
    { l: 22, id: 'atmospheric-terraforming', n: 'Atmospheric Terraforming', ty: 'growth', ess: 1, nv: 1, fx: { atmos: true },
      d: 'A major ecology project that remakes the atmosphere of a hostile planet into a livable one.' },
    { l: 24, id: 'eco-restoration-4', n: 'Advanced Ecological Restoration', ty: 'eco', g: 'eco-restoration', nv: 0, nvf: 1, fx: { ecoRestore: 10 },
      d: 'High-capacity reclamation plants that remove ten units of waste per BC.' },
    { l: 26, id: 'terraforming-50', n: 'Terraforming +50', ty: 'terraform', g: 'terraforming', fx: { terraform: 50, terraformCost: 3 },
      d: 'Terraforming that can raise a population ceiling by up to 50.' },
    { l: 27, id: 'doom-virus', n: 'Doom Virus', ty: 'bio', g: 'bio-weapon', gr: 'bomb:doom-virus',
      d: 'A deadlier bio-weapon that kills two population per hit and ignores shields.' },
    { l: 30, id: 'advanced-soil-enrichment', n: 'Advanced Soil Enrichment', ty: 'growth', nv: 0, nvf: 1, fx: { advSoil: true },
      d: 'A major ecology project that turns a planet into a lush gaia world, adding half again to its population capacity.' },
    { l: 32, id: 'terraforming-60', n: 'Terraforming +60', ty: 'terraform', g: 'terraforming', ess: 1, fx: { terraform: 60, terraformCost: 3 },
      d: 'Terraforming that can raise a population ceiling by up to 60.' },
    { l: 34, id: 'eco-restoration-5', n: 'Complete Ecological Restoration', ty: 'eco', g: 'eco-restoration', nv: 1, fx: { ecoRestore: 20 },
      d: 'Total environmental reclamation that clears twenty units of waste per BC.' },
    { l: 36, id: 'universal-antidote', n: 'Universal Antidote', ty: 'defense', fx: { antidote: 2, bioDefense: true },
      d: 'A second-generation antidote that cuts bio-weapon casualties by two per hit.' },
    { l: 38, id: 'terraforming-80', n: 'Terraforming +80', ty: 'terraform', g: 'terraforming', fx: { terraform: 80, terraformCost: 2 },
      d: 'Terraforming that can raise a population ceiling by up to 80.' },
    { l: 40, id: 'bio-terminator', n: 'Bio Terminator', ty: 'bio', g: 'bio-weapon', gr: 'bomb:bio-terminator',
      d: 'The deadliest bio-weapon, killing three population per hit while ignoring shields.' },
    { l: 42, id: 'advanced-cloning', n: 'Advanced Cloning', ty: 'growth', ess: 1, fx: { incPopCost: 5 },
      d: 'Perfected cloning that cuts the price of population growth to 5 BC per citizen.' },
    { l: 44, id: 'terraforming-100', n: 'Terraforming +100', ty: 'terraform', g: 'terraforming', fx: { terraform: 100, terraformCost: 2 },
      d: 'Terraforming that can raise a population ceiling by up to 100.' },
    { l: 50, id: 'complete-terraforming', n: 'Complete Terraforming', ty: 'terraform', g: 'terraforming', fx: { terraform: 120, terraformCost: 2 },
      d: 'The ultimate world-shaping process, able to raise a population ceiling by up to 120.' },
  ];

  const PR = [
    { l: 1, id: 'retro-engines', n: 'Retro Engines', ty: 'engine', g: 'engine', free: 1, fx: { warp: 1, transportSpeed: 1 }, gr: 'engine:retro-engine',
      d: 'The slow reaction engines every empire starts with, good for one parsec per turn.' },
    { l: 3, id: 'hydrogen-fuel-cells', n: 'Hydrogen Fuel Cells', ty: 'fuel', g: 'fuel', ess: 1, fx: { fuel: 4 },
      d: 'Longer-lasting fuel that extends ship range to four parsecs.' },
    { l: 5, id: 'deuterium-fuel-cells', n: 'Deuterium Fuel Cells', ty: 'fuel', g: 'fuel', ess: 1, fx: { fuel: 5 },
      d: 'Denser fuel cells that extend ship range to five parsecs.' },
    { l: 6, id: 'nuclear-engines', n: 'Nuclear Engines', ty: 'engine', g: 'engine', fx: { warp: 2, transportSpeed: 1 }, gr: 'engine:nuclear-engine',
      d: 'Nuclear drives that push ships to warp 2, though colony transports still crawl along at the old pace.' },
    { l: 9, id: 'irridium-fuel-cells', n: 'Irridium Fuel Cells', ty: 'fuel', g: 'fuel', fx: { fuel: 6 },
      d: 'Exotic fuel cells that extend ship range to six parsecs.' },
    { l: 10, id: 'inertial-stabilizer', n: 'Inertial Stabilizer', ty: 'special', gr: 'special:inertial-stabilizer',
      d: 'A ship system that makes a vessel considerably more maneuverable in combat.' },
    { l: 12, id: 'sub-light-drives', n: 'Sub-Light Drives', ty: 'engine', g: 'engine', fx: { warp: 3, transportSpeed: 2 }, gr: 'engine:sub-light-engine',
      d: 'Sub-light drives that push ships to warp 3 and speed up colony transports.' },
    { l: 14, id: 'dotomite-crystals', n: 'Dotomite Crystals', ty: 'fuel', g: 'fuel', fx: { fuel: 7 },
      d: 'Crystal fuel cells that extend ship range to seven parsecs.' },
    { l: 16, id: 'energy-pulsar', n: 'Energy Pulsar', ty: 'special', g: 'pulsar', gr: 'special:energy-pulsar',
      d: 'A ship system that opens a battle with a burst of energy that damages every adjacent ship.' },
    { l: 18, id: 'fusion-drives', n: 'Fusion Drives', ty: 'engine', g: 'engine', fx: { warp: 4, transportSpeed: 3 }, gr: 'engine:fusion-engine',
      d: 'Fusion drives that push ships to warp 4.' },
    { l: 19, id: 'uridium-fuel-cells', n: 'Uridium Fuel Cells', ty: 'fuel', g: 'fuel', fx: { fuel: 8 },
      d: 'Uridium fuel cells that extend ship range to eight parsecs.' },
    { l: 20, id: 'warp-dissipator', n: 'Warp Dissipator', ty: 'special', gr: 'special:warp-dissipator',
      d: 'A ship system that saps the maneuverability of an enemy ship each round, possibly leaving it stranded.' },
    { l: 23, id: 'reajax-ii-fuel-cells', n: 'Reajax II Fuel Cells', ty: 'fuel', g: 'fuel', fx: { fuel: 9 },
      d: 'Reajax fuel cells that extend ship range to nine parsecs.' },
    { l: 24, id: 'impulse-drives', n: 'Impulse Drives', ty: 'engine', g: 'engine', fx: { warp: 5, transportSpeed: 4 }, gr: 'engine:impulse-engine',
      d: 'Impulse drives that push ships to warp 5.' },
    { l: 27, id: 'intergalactic-star-gates', n: 'Intergalactic Star Gates', ty: 'planetary', fx: { stargate: true },
      d: 'Makes it possible to build stargates that carry ships between linked worlds in a single turn.' },
    { l: 29, id: 'trilithium-crystals', n: 'Trilithium Crystals', ty: 'fuel', g: 'fuel', fx: { fuel: 10 },
      d: 'Trilithium crystals that extend ship range to ten parsecs.' },
    { l: 30, id: 'ion-drives', n: 'Ion Drives', ty: 'engine', g: 'engine', fx: { warp: 6, transportSpeed: 5 }, gr: 'engine:ion-engine',
      d: 'Ion drives that push ships to warp 6.' },
    { l: 34, id: 'high-energy-focus', n: 'High Energy Focus', ty: 'special', gr: 'special:high-energy-focus',
      d: 'A ship system that extends the reach of direct-fire weapons by three squares.' },
    { l: 36, id: 'anti-matter-drives', n: 'Anti-Matter Drives', ty: 'engine', g: 'engine', fx: { warp: 7, transportSpeed: 6 }, gr: 'engine:anti-matter-engine',
      d: 'Anti-matter drives that push ships to warp 7.' },
    { l: 38, id: 'sub-space-teleporter', n: 'Sub Space Teleporter', ty: 'special', gr: 'special:sub-space-teleporter',
      d: 'A ship system that lets a vessel move first in battle and jump to any square.' },
    { l: 40, id: 'ionic-pulsar', n: 'Ionic Pulsar', ty: 'special', g: 'pulsar', gr: 'special:ionic-pulsar',
      d: 'A heavier pulsar that opens combat with a much stronger blast against adjacent ships.' },
    { l: 41, id: 'thorium-cells', n: 'Thorium Cells', ty: 'fuel', g: 'fuel', fx: { fuel: 30 },
      d: 'Near-limitless fuel that frees your ships from any range limit.' },
    { l: 42, id: 'inter-phased-drives', n: 'Inter-Phased Drives', ty: 'engine', g: 'engine', fx: { warp: 8, transportSpeed: 7 }, gr: 'engine:inter-phased-engine',
      d: 'Inter-phased drives that push ships to warp 8.' },
    { l: 43, id: 'sub-space-interdictor', n: 'Sub Space Interdictor', ty: 'planetary', fx: { interdictor: true },
      d: 'A planetary field that cancels enemy teleporters during battles at your worlds.' },
    { l: 45, id: 'combat-transporters', n: 'Combat Transporters', ty: 'invasion', fx: { combatTransporter: true },
      d: 'Lets at least half of your invasion troops land on a defended planet regardless of its defences.' },
    { l: 46, id: 'inertial-nullifier', n: 'Inertial Nullifier', ty: 'special', gr: 'special:inertial-nullifier',
      d: 'A ship system granting even greater combat maneuverability than the stabilizer.' },
    { l: 48, id: 'hyper-drives', n: 'Hyper Drives', ty: 'engine', g: 'engine', fx: { warp: 9, transportSpeed: 8 }, gr: 'engine:hyperthrust-engine',
      d: 'Hyper drives that push ships to warp 9, the fastest speed known.' },
    { l: 50, id: 'displacement-device', n: 'Displacement Device', ty: 'special', gr: 'special:displacement-device',
      d: 'A ship system that makes about a third of all attacks against the ship miss automatically.' },
  ];

  const WE = [
    { l: 1, id: 'laser', n: 'Laser / Heavy Laser', ty: 'beam', g: 'beam', free: 1, gr: ['weapon:laser', 'weapon:heavy-laser'],
      d: 'The basic beam weapon, with a heavier long-range mount for larger ships.' },
    { l: 1, id: 'nuclear-missile', n: 'Nuclear Missile', ty: 'missile', g: 'rocket', free: 1, fx: { baseMissile: 1 }, gr: 'weapon:nuclear-missile',
      d: 'A plain guided missile that does four damage per hit.' },
    { l: 1, id: 'nuclear-bomb', n: 'Nuclear Bomb', ty: 'bomb', g: 'bomb', free: 1, gr: 'bomb:nuclear-bomb',
      d: 'A bomb for bombarding planets, useless against ships.' },
    { l: 2, id: 'hand-lasers', n: 'Hand Lasers', ty: 'ground', g: 'personal-weapon', fx: { groundTier: { group: 'weapon', tier: 1 } },
      d: 'Light personal energy weapons that improve your troops in ground combat.' },
    { l: 4, id: 'hyper-v-rockets', n: 'Hyper-V Rockets', ty: 'missile', g: 'rocket', ess: 1, fx: { baseMissile: 2 }, gr: 'weapon:hyper-v',
      d: 'Faster rockets that hit for six damage.' },
    { l: 5, id: 'gatling-laser', n: 'Gatling Laser', ty: 'beam', g: 'beam', gr: 'weapon:gatling-laser',
      d: 'A rotary laser that fires four times each round.' },
    { l: 6, id: 'anti-missile-rockets', n: 'Anti-Missile Rockets', ty: 'special', g: 'anti-missile', gr: 'special:anti-missile-rockets',
      d: 'A ship system that launches interceptors to shoot down incoming missiles.' },
    { l: 7, id: 'neutron-pellet-gun', n: 'Neutron Pellet Gun', ty: 'beam', g: 'beam', gr: 'weapon:neutron-pellet-gun',
      d: 'A beam weapon whose neutron shells cut the effect of enemy shields in half.' },
    { l: 8, id: 'hyper-x-rockets', n: 'Hyper-X Rockets', ty: 'missile', g: 'rocket', ess: 1, fx: { baseMissile: 3 }, gr: 'weapon:hyper-x',
      d: 'Rockets that deal eight damage and track their targets more accurately.' },
    { l: 9, id: 'fusion-bomb', n: 'Fusion Bomb', ty: 'bomb', g: 'bomb', gr: 'bomb:fusion-bomb',
      d: 'A stronger planetary bomb than the nuclear model.' },
    { l: 10, id: 'ion-cannon', n: 'Ion Cannon / Heavy Ion Cannon', ty: 'beam', g: 'beam', gr: ['weapon:ion-cannon', 'weapon:heavy-ion-cannon'],
      d: 'A heavier beam cannon, with a long-range mount, that outclasses the laser.' },
    { l: 11, id: 'scatter-pack-v', n: 'Scatter Pack V Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseScatter: 1 }, gr: 'weapon:scatter-pack-v',
      d: 'A missile that splits into five warheads shortly before impact.' },
    { l: 12, id: 'ion-rifle', n: 'Ion Rifle', ty: 'ground', g: 'personal-weapon', fx: { groundTier: { group: 'weapon', tier: 2 } },
      d: 'A better infantry weapon that raises your ground combat strength.' },
    { l: 13, id: 'mass-driver', n: 'Mass Driver', ty: 'beam', g: 'beam', gr: 'weapon:mass-driver',
      d: 'A kinetic cannon whose heavy slugs halve the benefit of enemy shields.' },
    { l: 14, id: 'merculite-missiles', n: 'Merculite Missiles', ty: 'missile', g: 'rocket', fx: { baseMissile: 4 }, gr: 'weapon:merculite',
      d: 'Missiles with improved guidance that hit for ten damage.' },
    { l: 15, id: 'neutron-blaster', n: 'Neutron Blaster / Heavy Blast Cannon', ty: 'beam', g: 'beam', gr: ['weapon:neutron-blaster', 'weapon:heavy-blast-cannon'],
      d: 'A powerful neutron beam cannon, with a long-range heavy mount.' },
    { l: 16, id: 'anti-matter-bomb', n: 'Anti-Matter Bomb', ty: 'bomb', g: 'bomb', gr: 'bomb:anti-matter-bomb',
      d: 'A planetary bomb of far greater destructive power than the fusion bomb.' },
    { l: 17, id: 'graviton-beam', n: 'Graviton Beam', ty: 'beam', g: 'penetrating-beam', gr: 'weapon:graviton-beam',
      d: 'A beam whose excess damage spills over onto the next ship in line.' },
    { l: 18, id: 'stinger-missiles', n: 'Stinger Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseMissile: 5 }, gr: 'weapon:stinger',
      d: 'Missiles that hit for fifteen damage and strike accurately at long range.' },
    { l: 19, id: 'hard-beam', n: 'Hard Beam', ty: 'beam', g: 'beam', gr: 'weapon:hard-beam',
      d: 'A concentrated beam that halves the effect of enemy shields.' },
    { l: 20, id: 'fusion-beam', n: 'Fusion Beam / Heavy Fusion Beam', ty: 'beam', g: 'beam', gr: ['weapon:fusion-beam', 'weapon:heavy-fusion-beam'],
      d: 'A fusion-powered beam weapon, with a long-range heavy mount.' },
    { l: 21, id: 'ion-stream-projector', n: 'Ion Stream Projector', ty: 'special', g: 'stream-projector', gr: 'special:ion-stream-projector',
      d: 'A ship system that bathes a target in ions, stripping away a fraction of its hit points.' },
    { l: 22, id: 'omega-v-bomb', n: 'Omega-V Bomb', ty: 'bomb', g: 'bomb', gr: 'bomb:omega-v-bomb',
      d: 'A devastating planetary bomb with a very high damage ceiling.' },
    { l: 23, id: 'anti-matter-torpedoes', n: 'Anti-Matter Torpedoes', ty: 'torpedo', g: 'rocket', gr: 'weapon:anti-matter-torpedo',
      d: 'Heavy ship-killing torpedoes that fire every second round.' },
    { l: 24, id: 'fusion-rifle', n: 'Fusion Rifle', ty: 'ground', g: 'personal-weapon', fx: { groundTier: { group: 'weapon', tier: 3 } },
      d: 'A powerful infantry weapon that makes your troops far deadlier on the ground.' },
    { l: 25, id: 'megabolt-cannon', n: 'Megabolt Cannon', ty: 'beam', g: 'beam', gr: 'weapon:megabolt-cannon',
      d: 'A beam cannon with unusually accurate targeting.' },
    { l: 26, id: 'phasor', n: 'Phasor / Heavy Phasor', ty: 'beam', g: 'beam', gr: ['weapon:phasor', 'weapon:heavy-phasor'],
      d: 'A phased beam weapon, with a long-range heavy mount.' },
    { l: 27, id: 'scatter-pack-vii', n: 'Scatter Pack VII Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseScatter: 2 }, gr: 'weapon:scatter-pack-vii',
      d: 'A missile that bursts into seven warheads.' },
    { l: 28, id: 'auto-blaster', n: 'Auto Blaster', ty: 'beam', g: 'beam', gr: 'weapon:auto-blaster',
      d: 'A rapid-fire blaster that shoots three times each round.' },
    { l: 29, id: 'pulson-missiles', n: 'Pulson Missiles', ty: 'missile', g: 'rocket', fx: { baseMissile: 6 }, gr: 'weapon:pulson',
      d: 'Missiles that hit for twenty damage.' },
    { l: 30, id: 'tachyon-beam', n: 'Tachyon Beam', ty: 'beam', g: 'penetrating-beam', gr: 'weapon:tachyon-beam',
      d: 'A tachyon beam whose excess damage carries over to the next ship.' },
    { l: 31, id: 'hand-phasor', n: 'Hand Phasor', ty: 'ground', g: 'personal-weapon', fx: { groundTier: { group: 'weapon', tier: 4 } },
      d: 'A phased infantry weapon that gives your ground troops a stronger edge.' },
    { l: 32, id: 'gauss-autocannon', n: 'Gauss Autocannon', ty: 'beam', g: 'beam', gr: 'weapon:gauss-autocannon',
      d: 'A rapid-fire gauss cannon that fires four times each round and halves enemy shielding.' },
    { l: 33, id: 'particle-beam', n: 'Particle Beam', ty: 'beam', g: 'beam', gr: 'weapon:particle-beam',
      d: 'A heavy particle beam that halves the effect of enemy shields.' },
    { l: 34, id: 'hercular-missiles', n: 'Hercular Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseMissile: 7 }, gr: 'weapon:hercular',
      d: 'Missiles that hit for twenty-five damage.' },
    { l: 35, id: 'plasma-cannon', n: 'Plasma Cannon', ty: 'beam', g: 'beam', gr: 'weapon:plasma-cannon',
      d: 'A plasma cannon with a wide damage range.' },
    { l: 36, id: 'death-ray', n: 'Death Ray', ty: 'beam', orion: 1, gr: 'weapon:death-ray',
      d: 'A planet-cracking superweapon found only in the vault of the Orion guardian.' },
    { l: 37, id: 'disruptor', n: 'Disruptor', ty: 'beam', g: 'beam', gr: 'weapon:disruptor',
      d: 'A long-range beam that disrupts matter at two squares.' },
    { l: 38, id: 'pulse-phasor', n: 'Pulse Phasor', ty: 'beam', g: 'beam', gr: 'weapon:pulse-phasor',
      d: 'A phasor that pulses three times each round.' },
    { l: 39, id: 'neutronium-bomb', n: 'Neutronium Bomb', ty: 'bomb', g: 'bomb', gr: 'bomb:neutronium-bomb',
      d: 'The mightiest planetary bomb ever devised.' },
    { l: 40, id: 'hellfire-torpedoes', n: 'Hellfire Torpedoes', ty: 'torpedo', g: 'rocket', gr: 'weapon:hellfire-torpedo',
      d: 'Torpedoes whose warheads split into four separate hits.' },
    { l: 41, id: 'zeon-missiles', n: 'Zeon Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseMissile: 8 }, gr: 'weapon:zeon',
      d: 'Missiles that hit for thirty damage.' },
    { l: 42, id: 'plasma-rifle', n: 'Plasma Rifle', ty: 'ground', g: 'personal-weapon', fx: { groundTier: { group: 'weapon', tier: 5 } },
      d: 'The finest infantry weapon, giving your troops their deadliest edge on the ground.' },
    { l: 43, id: 'proton-torpedoes', n: 'Proton Torpedoes', ty: 'torpedo', g: 'rocket', gr: 'weapon:proton-torpedo',
      d: 'Torpedoes that hit for seventy-five damage.' },
    { l: 44, id: 'scatter-pack-x', n: 'Scatter Pack X Missiles', ty: 'missile', g: 'rocket', ess: 1, fx: { baseScatter: 3 }, gr: 'weapon:scatter-pack-x',
      d: 'A missile that bursts into ten warheads.' },
    { l: 45, id: 'tri-focus-plasma-cannon', n: 'Tri-Focus Plasma Cannon', ty: 'beam', g: 'beam', gr: 'weapon:tri-focus-plasma-cannon',
      d: 'A triple-focused plasma cannon with heavy damage.' },
    { l: 46, id: 'stellar-converter', n: 'Stellar Converter', ty: 'beam', g: 'beam', gr: 'weapon:stellar-converter',
      d: 'A devastating short-range beam that strikes with four separate shots.' },
    { l: 47, id: 'neutron-stream-projector', n: 'Neutron Stream Projector', ty: 'special', g: 'stream-projector', gr: 'special:neutron-stream-projector',
      d: 'A stronger stream projector that strips forty percent of the hit points of a target.' },
    { l: 48, id: 'mauler-device', n: 'Mauler Device', ty: 'beam', g: 'beam', gr: 'weapon:mauler-device',
      d: 'The most brutal beam weapon, capable of up to a hundred damage per hit.' },
    { l: 50, id: 'plasma-torpedoes', n: 'Plasma Torpedoes', ty: 'torpedo', g: 'rocket', gr: 'weapon:plasma-torpedo',
      d: 'The strongest torpedo, a 150-damage plasma charge that weakens as it travels.' },
  ];

  // ---- build the records -------------------------------------------------------------------------------------------------------
  const ROWS = [CM, CN, FF, PL, PR, WE];
  const ADV_NAMES = ['Computer', 'Construction', 'Force Field', 'Planetology', 'Propulsion', 'Weapon'];
  const ADV_NOUN = ['computer', 'construction', 'force field', 'planetology', 'propulsion', 'weapons'];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

  const toGrants = gr => (gr ? [].concat(gr) : []).map(s => { const i = s.indexOf(':'); return { kind: s.slice(0, i), id: s.slice(i + 1) }; });
  const pad2 = n => (n < 10 ? '0' + n : String(n));

  function make(f, r) {
    const t = {
      id: FIELD_CODES[f] + '-' + pad2(r.l) + '-' + r.id, field: f, level: r.l, tier: Math.ceil(r.l / 5), name: r.n, type: r.ty, desc: r.d,
      effects: r.fx || {}, grants: toGrants(r.gr), group: r.g || 'singular',
    };
    if (t.group === 'singular') t.singular = true;
    if (r.nv) t.never = ['silicoid'];
    if (r.nvf) t.neverFix = ['silicoid'];
    if (r.ess) t.essential = true;
    if (r.free) t.free = true;
    if (r.orion) t.special = 'orion-only';
    return t;
  }

  const list = [], byId = {}, byField = [[], [], [], [], [], []], byFL = [], l1Bundle = [[], [], [], [], [], []];
  for (let f = 0; f < 6; f++) {
    byFL.push(new Array(101).fill(null));
    const techs = ROWS[f].map(r => make(f, r));
    for (let i = 0; i < 10; i++) {                                    // advanced "general improvement" techs: levels 55..100
      const level = 55 + i * 5;
      techs.push({
        id: FIELD_CODES[f] + '-' + level + '-advanced-tech-' + (i + 1), field: f, level, tier: Math.ceil(level / 5), name: 'Advanced ' + ADV_NAMES[f] + ' Tech ' + ROMAN[i], type: 'advanced',
        desc: ORDINAL[i] + ' sweep of general refinements to existing ' + ADV_NOUN[f] + ' technology; it unlocks nothing new but raises the tech level of the field.',
        effects: { tlOnly: true }, grants: [], group: 'advanced',
      });
    }
    for (const t of techs) {
      list.push(t); byId[t.id] = t; byField[f].push(t);
      if (t.free) l1Bundle[f].push(t);
      else byFL[f][t.level] = t;
    }
    byFL[f][1] = l1Bundle[f][0];
  }

  // obsolescence groups (Appendix D): members by level; gtier = rank inside the group
  const GROUPS = {};
  for (const t of list) if (t.group !== 'singular' && t.group !== 'advanced') (GROUPS[t.group] = GROUPS[t.group] || []).push(t);
  for (const g in GROUPS) { GROUPS[g].sort((a, b) => a.level - b.level || a.field - b.field); GROUPS[g].forEach((t, i) => { t.gtier = i + 1; }); }
  for (const g in GROUPS) GROUPS[g] = GROUPS[g].map(t => t.id);

  // valid researchable levels per tier (§1.7): everything but the level-1 bundle, the Death Ray and the advanced techs
  const researchTable = byField.map(techs => {
    const tiers = [[], [], [], [], [], [], [], [], [], []];
    for (const t of techs) if (!t.free && !t.special && t.level <= 50) tiers[t.tier - 1].push(t.level);
    return tiers;
  });
  const ESSENTIAL = byField.map(techs => techs.filter(t => t.essential).map(t => t.level));

  // ---- costs (§1.5) ------------------------------------------------------------------------------------------------------------
  function fieldIdx(field) {
    if (typeof field === 'number') return field;
    const i = FIELD_CODES.indexOf(field);
    return i >= 0 ? i : FIELDS.indexOf(field);
  }
  const raceMul = (raceId, field) => (RACE_COST_MUL[raceId] || NEUTRAL)[FIELD_CODES[fieldIdx(field)]];
  // human player: ((L*L*racemul*diffmul)/1000 truncated) * 10;  AI: (L*L*racemul*20)/100 truncated (any difficulty)
  function costHuman(level, raceId, field, diffIdx) {
    const d = DIFF_COST_MUL[diffIdx === undefined || diffIdx === null ? 2 : Math.max(0, Math.min(4, diffIdx | 0))];
    return Math.floor(level * level * raceMul(raceId, field) * d / 1000) * 10;
  }
  function costAI(level, raceId, field) { return Math.floor(level * level * raceMul(raceId, field) * 20 / 100); }

  // ---- tech level (§1.6) -------------------------------------------------------------------------------------------------------
  function tl(field, done) {
    const n = done.length;
    if (!n) return 1;
    let tmax = 0;
    for (let i = 0; i < n; i++) if (done[i] > tmax) tmax = done[i];
    const v = n === 1 ? 1 : Math.floor((tmax - 1) / 5) + 2;
    return Math.max(1, Math.min(99, tmax + n - v));
  }

  // ---- choose-next-tech window (§1.8) ------------------------------------------------------------------------------------------
  const TECH_NEXT_MAX = 12;
  // number of visible tiers (tiers 1..n of the personal list): only tier 1 while just the start tech is known, else one tier above the best tech
  function visibleTiers(done) {
    if (done.length <= 1) return 1;
    let tmax = 0;
    for (let i = 0; i < done.length; i++) if (done[i] > tmax) tmax = done[i];
    return Math.min(10, Math.floor((tmax - 1) / 5) + 2);
  }
  // fieldList = researchlist[f] (10 tiers of ≤3 levels); done = completed levels of the field. Lowest tier first, ≤12 entries; advanced techs when the tree is exhausted.
  function choiceList(fieldList, done) {
    const maxTier = visibleTiers(done), out = [], lists = fieldList || [];
    for (let t = 0; t < maxTier; t++) {
      const tier = lists[t] || [];
      for (let i = 0; i < tier.length; i++) {
        const lvl = tier[i];
        if (lvl !== 0 && done.indexOf(lvl) < 0 && out.length < TECH_NEXT_MAX) out.push(lvl);
      }
    }
    if (!out.length) {
      let tmax = 0;
      for (let i = 0; i < done.length; i++) if (done[i] > tmax) tmax = done[i];
      tmax = tmax <= 50 ? 55 : Math.min(100, tmax + 5);
      for (let l = 55; l <= tmax; l += 5) if (done.indexOf(l) < 0) out.push(l);
    }
    return out;
  }

  // ---- per-empire random tech tree (§1.7) --------------------------------------------------------------------------------------
  function neverFor(f, level, raceId, opts) {
    const t = byFL[f][level];
    return !!(t && ((t.never && t.never.indexOf(raceId) >= 0) || (opts && opts.silicoidFix && t.neverFix && t.neverFix.indexOf(raceId) >= 0)));
  }
  // every field with essential techs (for this race) must contain at least one of them
  function essentialOk(lists, raceId, opts) {
    for (let f = 0; f < 6; f++) {
      const ess = ESSENTIAL[f].filter(l => !neverFor(f, l, raceId, opts));
      if (!ess.length) continue;
      let ok = false;
      for (const tier of lists[f]) for (const l of tier) if (ess.indexOf(l) >= 0) ok = true;
      if (!ok) return false;
    }
    return true;
  }
  // R = MOO.RNG generator (R.int(1,4)). Psilons keep each candidate with 3/4, everybody else with 1/2; a tier is re-rolled until it holds a tech; max 3 per tier,
  // scanning from the highest level down. Returns null when the essential-tech check fails (the original redoes the whole generation).
  function generateResearchList(R, raceId, opts) {
    const rmax = raceId === 'psilon' ? 3 : 2, lists = [];
    for (let f = 0; f < 6; f++) {
      const tiers = [];
      for (let t = 0; t < 10; t++) {
        const cand = [];
        for (let i = researchTable[f][t].length - 1; i >= 0; i--) if (!neverFor(f, researchTable[f][t][i], raceId, opts)) cand.push(researchTable[f][t][i]);
        const slots = [];
        while (cand.length && !slots.length) {
          for (let i = 0; i < cand.length; i++) if (R.int(1, 4) <= rmax && slots.length < 3) slots.push(cand[i]);
        }
        slots.sort((a, b) => a - b);
        tiers.push(slots);
      }
      lists.push(tiers);
    }
    return essentialOk(lists, raceId, opts) ? lists : null;
  }

  // ---- miniaturisation (Appendix C): tm = clamp(TL of the component's field - component tech level, 0, 50) -----------------------
  const T50 = [100, 93, 87, 81, 76, 71, 66, 62, 58, 54, 50,
    47, 44, 41, 38, 35, 33, 31, 29, 27, 25,
    23, 22, 20, 19, 18, 16, 15, 14, 13, 13,
    12, 11, 10, 9, 9, 8, 8, 7, 7, 6,
    6, 5, 5, 5, 4, 4, 4, 4, 3, 3];                                  // cost multiplier in percent
  const T25 = [100, 97, 94, 92, 89, 87, 84, 82, 79, 77, 75,
    73, 71, 69, 67, 65, 63, 61, 60, 58, 56,
    55, 53, 52, 50, 49, 47, 46, 45, 43, 42,
    41, 40, 39, 38, 37, 36, 35, 34, 33, 32,
    31, 30, 29, 28, 27, 27, 26, 25, 24, 24];                        // space multiplier in percent
  const tm = (techLevel, componentLevel) => Math.max(0, Math.min(50, techLevel - componentLevel));
  const miniCost = (raw, techLevel, componentLevel) => Math.floor(raw * T50[tm(techLevel, componentLevel)] / 100);    // no 0.5 BC item floor applied here
  const miniSpace = (raw, techLevel, componentLevel) => Math.floor(raw * T25[tm(techLevel, componentLevel)] / 100);

  // ---- ground combat force from owned tech tiers (§5): armor*5 + suit*10 + shield*10 + weapon'*5 (weapon' = tier, +1 above tier 2); max 120 ------------------
  function groundBonus(g) {
    const w = g.weapon || 0;
    return 5 * (g.armor || 0) + 10 * (g.suit || 0) + 10 * (g.shield || 0) + 5 * (w <= 2 ? w : w + 1);
  }

  // ---- AI tech valuation (§1.10): level^2 x group multiplier (the caller divides by 4 when a better tech of the group is owned, 0 for the same level) ----------
  const GROUP_TRADE_MUL = { singular: 10, 'robotic-controls': 6, waste: 3, 'eco-restoration': 3 };
  const tradeValue = t => t.level * t.level * (GROUP_TRADE_MUL[t.group] || 1);

  // ---- vocabularies shared with other modules ----------------------------------------------------------------------------------
  const EFFECT_KEYS = ['factoryCost', 'robotic', 'wasteScale', 'ecoRestore', 'fuel', 'scan', 'transportSpeed', 'warp', 'stargate', 'interdictor', 'combatTransporter',
    'hyperComm', 'scanFleetInfo', 'advScanner', 'colonyFor', 'terraform', 'terraformCost', 'soil', 'advSoil', 'atmos', 'incPopCost', 'antidote', 'bioDefense', 'planetShield',
    'groundTier', 'baseHp', 'baseComp', 'baseEcm', 'baseShield', 'baseMissile', 'baseScatter', 'tlOnly'];
  const BASE_HP = [50, 75, 100, 125, 150, 175, 200];                // missile-base hit points by armour tier index (Titanium … Neutronium)
  const BASE_MISSILES = ['nuclear-missile', 'hyper-v', 'hyper-x', 'merculite', 'stinger', 'pulson', 'hercular', 'zeon'];
  const BASE_SCATTER = ['scatter-pack-v', 'scatter-pack-vii', 'scatter-pack-x'];
  const CONST = { TECH_NEXT_MAX, TIERS: 10, MAX_LEVEL: 50, ADV_FIRST: 55, ADV_LAST: 100, PLANET_SHIELD_COST: [0, 500, 1000, 1500, 2000], SOIL_COST: 150, ADV_SOIL_COST: 300, ATMOS_COST: 200 };

  M.Data.Techs = {
    FIELDS, FIELD_CODES, FIELD_NAMES, RACE_IDS, list, byId, byField, byFL, l1Bundle, researchTable, GROUPS,
    RACE_COST_MUL, DIFF_COST_MUL, costHuman, costAI, tl, visibleTiers, choiceList, generateResearchList, essentialOk,
    T50, T25, tm, miniCost, miniSpace, groundBonus, GROUP_TRADE_MUL, tradeValue, EFFECT_KEYS, BASE_HP, BASE_MISSILES, BASE_SCATTER, CONST, TECH_NEXT_MAX,
    techAt: (field, level) => byFL[fieldIdx(field)][level] || null,
    fieldIndex: fieldIdx,
  };

  // ---- GRANT_IDS: every {kind, id} used by the grants above — js/data/components.js should define exactly these ids ------------------
  M.Data.Techs.GRANT_IDS = {
    // beams · missiles · torpedoes (weapon slots). Missiles/torpedoes come as 2-shot and 5-shot racks; heavy mounts are separate ids; Death Ray = Orion loot
    weapon: ['laser', 'heavy-laser', 'nuclear-missile', 'hyper-v', 'gatling-laser', 'neutron-pellet-gun', 'hyper-x', 'ion-cannon', 'heavy-ion-cannon', 'scatter-pack-v',
      'mass-driver', 'merculite', 'neutron-blaster', 'heavy-blast-cannon', 'graviton-beam', 'stinger', 'hard-beam', 'fusion-beam', 'heavy-fusion-beam', 'anti-matter-torpedo',
      'megabolt-cannon', 'phasor', 'heavy-phasor', 'scatter-pack-vii', 'auto-blaster', 'pulson', 'tachyon-beam', 'gauss-autocannon', 'particle-beam', 'hercular',
      'plasma-cannon', 'death-ray', 'disruptor', 'pulse-phasor', 'hellfire-torpedo', 'zeon', 'proton-torpedo', 'scatter-pack-x', 'tri-focus-plasma-cannon', 'stellar-converter',
      'mauler-device', 'plasma-torpedo'],
    bomb: ['nuclear-bomb', 'fusion-bomb', 'anti-matter-bomb', 'omega-v-bomb', 'neutronium-bomb', 'death-spores', 'doom-virus', 'bio-terminator'],
    computer: ['mark-1-computer', 'mark-2-computer', 'mark-3-computer', 'mark-4-computer', 'mark-5-computer', 'mark-6-computer', 'mark-7-computer', 'mark-8-computer',
      'mark-9-computer', 'mark-10-computer', 'mark-11-computer'],
    ecm: ['ecm-1', 'ecm-2', 'ecm-3', 'ecm-4', 'ecm-5', 'ecm-6', 'ecm-7', 'ecm-8', 'ecm-9', 'ecm-10'],
    // Class I-VII, IX, XI, XIII, XV deflectors (absorb 1-7, 9, 11, 13, 15)
    shield: ['class-1-shield', 'class-2-shield', 'class-3-shield', 'class-4-shield', 'class-5-shield', 'class-6-shield', 'class-7-shield', 'class-9-shield',
      'class-11-shield', 'class-13-shield', 'class-15-shield'],
    // the heavy ("II") variant of each armour is implied by the base id (armor 150/225/300/375/450/525/600 %)
    armor: ['titanium-armor', 'duralloy-armor', 'zortium-armor', 'andrium-armor', 'tritanium-armor', 'adamantium-armor', 'neutronium-armor'],
    // warp 1-9
    engine: ['retro-engine', 'nuclear-engine', 'sub-light-engine', 'fusion-engine', 'impulse-engine', 'ion-engine', 'anti-matter-engine', 'inter-phased-engine', 'hyperthrust-engine'],
    special: ['reserve-fuel-tanks', 'standard-colony-base', 'barren-colony-base', 'tundra-colony-base', 'dead-colony-base', 'inferno-colony-base', 'toxic-colony-base',
      'radiated-colony-base', 'battle-scanner', 'anti-missile-rockets', 'repulsor-beam', 'warp-dissipator', 'energy-pulsar', 'inertial-stabilizer', 'zyro-shield', 'automated-repair',
      'stasis-field', 'cloaking-device', 'ion-stream-projector', 'high-energy-focus', 'ionic-pulsar', 'black-hole-generator', 'sub-space-teleporter', 'lightning-shield',
      'neutron-stream-projector', 'advanced-damage-control', 'technology-nullifier', 'inertial-nullifier', 'oracle-interface', 'displacement-device'],
  };
});
