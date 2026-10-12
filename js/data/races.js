// Master of Orion - Reborn - the ten races (research/01-races.md §0.1, §1, §3-§5). Worker-safe, DOM-free, JSON-safe plain data.
//
//   MOO.Data.Races = { ORDER, PERSONALITIES, OBJECTIVES, TRAIT1, TRAIT2, RELATIONS, MOD_DEFAULTS, AI_DEFAULTS,
//                      races, list, rollPersonality(R, race), rollObjective(R, race) }
//   MOO.Data.races = Races.races  (id -> record)          MOO.Data.raceList = Races.ORDER
//
// Ids are the lower-case race names. ORDER is the original data order AND the New Game menu order (record.idx = the original race id 0..9).
// Wherever a function takes `race` it accepts the id ('psilon'), the index (4) or a record.
// Research COST multipliers per field (Excellent 60 / Good 80 / Average 100 / Poor 125, research/01 §1.2), Psilon's 75% research-list pick and
// the Silicoid NEVER tech flags live ONLY in data/techs.js and are deliberately not repeated here; the trait texts below merely describe them.
//
// ENUMS     PERSONALITIES (trait1)  0 xenophobic 1 ruthless 2 aggressive 3 erratic 4 honorable 5 pacifistic
//           OBJECTIVES    (trait2)  0 diplomat 1 militarist 2 expansionist 3 technologist 4 industrialist 5 ecologist
//           field indices (researchFocusFields) follow Data.Techs.FIELDS: 0 computers 1 construction 2 forcefields 3 planetology 4 propulsion 5 weapons
// ROLLS     TRAIT1[race] = 10 raw slots, TRAIT2[race] = 12 raw slots (v1.3 tables, §1.5): rollPersonality(R, race) = TRAIT1[race][R.int(0, 9)],
//           rollObjective(R, race) = TRAIT2[race][R.int(0, 11)] - exactly one R.int draw each. Only AI empires roll an objective (the human keeps 0).
//           A coup re-rolls BOTH traits uniformly with R.int(0, 5), NOT from these tables (§5.12).
// RELATIONS 10x10 in ORDER order, row = holder of the attitude, column = the other race, DP at game start (relation1 = relation2).
//           Symmetric, diagonal 0, multiples of 12 (+12 relaxed, 0 neutral, -12 unease, -24 wary, -36 restless).
//
// RECORD    races[id] = { id, idx, name, plural, adj, tagline, desc, homeworld, leaders[6], shipNames[12], mod, traits[], ai, startRelations, art,
//                         audienceTheme }
//   leaders        the six default emperor names (the "probable" MOO1 pool, §7.1); setup picks one per empire
//   shipNames      default design names, 3 per hull class in ascending size: Small 0-2, Medium 3-5, Large 6-8, Huge 9-11 (§3.0)
//   traits         [{ label, text, good }] for the New Game screen: strengths (good:true) and weaknesses (good:false), wording is ours
//   startRelations { raceId: DP } - this race's RELATIONS row (self = 0)
//   art            { primary, secondary } '#rrggbb' UI palette          audienceTheme  original audience-music index (informational only)
//
// MOD  exact numeric rule hooks for the sim. EVERY race carries EVERY key (default = no effect), so consumers never null-check.
//   diplomacy / trade / council (§1.1, §4.4, §5.6, §5.10)
//     tradePts      percentage points added to each trade partner's trade_percent in the income formula                        Human 25
//     posActMul     multiplier on every POSITIVE relation change caused by this race's empire (AI or human)                    Human 2
//     tributeMul    multiplier on the relation an AI gains from tribute (BC and tech) given by this race                       Human 2
//     aiMoodBonus   added to an AI leader's mood sum in audience / treaty / tech-scale tests when the PLAYER is this race
//                   (AI-vs-AI deals never get it)                                                                              Human 50
//     councilBonus  added to every AI voter's weight for a candidate of this race                                              Human 20
//   ship combat (§4.6)
//     compLevel     added to every design's computer level in battle; each level = 10 points on the to-hit roll (beams, missiles)  Mrrshan 4
//     initiative    TOTAL racial initiative bonus (Mrrshan 4, Alkari 3). The original reaches Mrrshan's +4 through the complevel term of
//                   prio = complevel + man - unman (+3 scanner) (+3 Alkari); code that feeds the race-adjusted complevel into prio must add only
//                   (initiative - compLevel), never both.
//     defense       added to every design's beam defense  (each point lowers the attacker's to-hit by 10 points)                Alkari 3
//     misDefense    added to every design's missile defense                                                                     Alkari 3
//   ground combat (§4.5)
//     groundBonus   troop strength added attacking OR defending (the defender's own +5 is a rule for every race, not here)     Bulrathi 25
//   production (§4.2)
//     workerMul     multiplier on the population term of planet output, pop*(3*PlanetologyTL+50)/100                          Klackon 2
//     operBonus     extra factories operated per colonist (on top of the Robotic Controls level)                              Meklar 2
//     noRefit       true: factory refit after a Robotic Controls upgrade costs nothing and takes effect at once                Meklar
//   research (§4.1)
//     researchMul   multiplier on a planet's research output (before the Artifacts x2 / Orion x4 planet bonuses)              Psilon 1.5
//   population (§4.3)
//     growthMul     multiplier on natural growth v (after the planet growth-class adjustment)                                  Sakkra 2
//     ecoGrowthMul  multiplier on ecology-funded growth                                                                        Sakkra 2
//     popCost       [num, den]: cost to buy one pop = floor(base * num / den); base 20 / 10 / 5 -> 13 / 6 / 3                  Sakkra [2, 3]
//   spying (§4.7)
//     spyCostMul    multiplier on the spy hiring cost                                                                         Darlok 0.5
//     spyOff        added to the spy's own Computers% in infiltration rolls                                                    Darlok 30
//     spyDef        added to the empire's Computers% in counter-espionage rolls; also the "+20%" security bonus the Races screen shows   Darlok 20
//   Silicoid flags (§3.3, §4.3, §4.8)
//     allTerrain    can colonise every planet type from turn 1          noWaste    no waste / pollution, no ecology spending needed for it
//     halfGrowth    natural growth v = (100 - pop%)/2 with growth class and waste ignored, ecology-funded growth halved (no growthMul involved)
//     noPlague      never the target of the Plague event               noAccident  never the target of the Industrial Accident event
//     noSoil        soil enrichment, advanced soil enrichment and atmospheric terraforming have no effect
//                   (the matching techs are never offered to Silicoids: that is the `never` flag in data/techs.js, which spying must honour too)
//
// AI  per-race hooks for the classic AI (§3 "AI hooks" bullets, §5.4, §5.5, §5.14); every race carries every key. (The Silicoid AI settles every
//     planet type: it follows mod.allTerrain, which stands for the original `can_colonize = RADIATED`.)
//     hull                 preferred-hull roll modifier: v = rnd_0_nm1(12) + hull, clamped to 0..11 (Silicoid/Bulrathi/Meklar +3, Alkari/Klackon -3)
//     shipSlider           added to the planet SHIP slider at each re-allocation                                                Mrrshan 15
//     indSlider            ... to the IND slider                                                                                 Meklar 20
//     techSlider           ... to the TECH slider                                                                                Psilon 20
//     ecoSlider            { add, belowMp2 }: add to the ECO slider, only while planet pop < planet mp2 when belowMp2 is true   Bulrathi/Sakkra 10, Klackon 15
//     researchFocus        the race's 25% "focus" pick of the tech re-allocation (§5.5): 'weapons' | 'computers' | 'propulsion' | 'planetology' |
//                          'construction/planetology' (50/50) | null.   researchFocusFields = the same as FIELDS indices.
//     autoResolveWeight    added to this race's ship weight when AI-vs-AI battles are auto-resolved; ...Plus = the "Classic+" variant
//     invasionMul          multiplier on the AI's expected invasion strength when judging a bombardment/invasion; ...Plus = "Classic+"   Bulrathi 1.2 / 2.15
//     alwaysSpy            skips the 50% gate on considering espionage                                                           Darlok
//     spyRating            [OSG] AI base spy rating bonus (design-intent table 12-5; the 1oom rule of §5.9 ignores it)            Psilon 10, Darlok 30
//     proposeBonus         quirk: an AI-controlled Human adds +50 to the v of its own proposals (copy of the player bonus); replicate only if wanted
//
// NOTE (research contradictions found while writing this module):
//  1. research/01 §11 START_REL has +1 (= +12) on the Darlok/Darlok diagonal; §1.4 shows "-" there. The diagonal is unused (races are unique per
//     game); RELATIONS keeps 0. Silicoid<->Klackon is -12 per [1oom] (the research's own choice over [OSG]/[LP] "relaxed").
//  2. research/01 §0.1 gives the plurals "Alkaris" and "Bulrathis"; data/text.js documents {race} as "Alkari" and ui/gnn.js falls back to
//     no "s" after an "i". The research is followed here - change two strings if the news text should say "the Alkari".
//  3. research/01 §4.1 deduces flag 4 = ALWAYS (taken in pass 1 of the research-list build, "identical for every race"), while research/02 §1.7
//     reads flag 4 as the "essential" re-roll check and says ALWAYS (bit 2) is unused; Planetology #12 and #22 are in 01's ALWAYS list yet in the
//     Silicoid NEVER list. data/techs.js follows 02 (essential check, NEVER wins); nothing here depends on it.
//  4. research/02 §6.7 repeats the [SW] objective defaults (60%/20%); the [1oom] slot tables of 01 §1.5 differ for Alkari (Expansionist 33%,
//     not Militarist), Klackon (Ecologist 33%) and Darlok (Technologist 33%). The tables here are the [1oom] ones, as 01 recommends.
//  5. Disputed numbers, code value used: Human diplomacy +50 ([OSG] +60), Mrrshan +4 levels ([LP] +3), Bulrathi ground +25 (manual +20),
//     Sakkra growth x2 ([AW] +50%), Darlok spy +30 attack / +20 defend ([OSG] +20/+20).
//  6. Ship names keep the research spelling, typos included (Coraona, Morey, Excaliber, Death Wyn); only the case is normalised.
MOO.def(function (M) {
  'use strict';

  const ORDER = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  const PERSONALITIES = ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic'];
  const OBJECTIVES = ['diplomat', 'militarist', 'expansionist', 'technologist', 'industrialist', 'ecologist'];

  // ---- leader roll tables: the raw v1.3 slot tables (research/01 §1.5), index = slot, value = enum index ----
  const TRAIT1 = {
    human:    [4, 4, 4, 4, 4, 4, 4, 5, 5, 3],
    mrrshan:  [1, 1, 1, 1, 1, 1, 1, 2, 2, 0],
    silicoid: [0, 0, 0, 0, 0, 0, 0, 2, 2, 3],
    sakkra:   [2, 2, 2, 2, 2, 2, 2, 3, 3, 1],
    psilon:   [5, 5, 5, 5, 5, 5, 5, 4, 3, 3],
    alkari:   [4, 4, 4, 4, 4, 4, 4, 5, 5, 3],
    klackon:  [0, 0, 0, 0, 0, 0, 0, 2, 2, 1],
    bulrathi: [2, 2, 2, 2, 2, 2, 2, 3, 3, 1],
    meklar:   [3, 3, 3, 3, 3, 3, 3, 2, 2, 0],
    darlok:   [2, 2, 2, 2, 2, 2, 2, 1, 1, 0],
  };
  const TRAIT2 = {
    human:    [0, 0, 0, 0, 1, 2, 3, 4, 4, 0, 3, 5],
    mrrshan:  [0, 1, 1, 1, 1, 3, 2, 2, 3, 3, 4, 5],
    silicoid: [0, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5],
    sakkra:   [0, 3, 1, 5, 5, 3, 4, 2, 2, 2, 2, 2],
    psilon:   [0, 0, 3, 1, 2, 3, 3, 3, 3, 4, 4, 5],
    alkari:   [0, 1, 1, 1, 2, 2, 2, 3, 4, 2, 3, 5],
    klackon:  [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 5, 5],
    bulrathi: [0, 5, 5, 5, 5, 2, 2, 3, 3, 3, 4, 5],
    meklar:   [0, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5],
    darlok:   [0, 0, 3, 3, 1, 2, 0, 3, 3, 4, 4, 5],
  };

  // ---- starting attitudes in DP (research/01 §1.4) ----
  const RELATIONS = [
    //  Hum  Mrr  Sil  Sak  Psi  Alk  Kla  Bul  Mek  Dar
    [  0,  12,  12,  12,  12,  12,  12,  12,  12,  12],    // Human
    [ 12,   0,   0, -24,   0, -36, -12, -12,   0, -12],    // Mrrshan
    [ 12,   0,   0,   0,   0,   0, -12,   0,  12, -12],    // Silicoid
    [ 12, -24,   0,   0,   0, -12, -12,   0, -12, -12],    // Sakkra
    [ 12,   0,   0,   0,   0,   0,   0,   0,   0, -12],    // Psilon
    [ 12, -36,   0, -12,   0,   0, -12,   0,   0, -12],    // Alkari
    [ 12, -12, -12, -12,   0, -12,   0,   0,   0, -12],    // Klackon
    [ 12, -12,   0,   0,   0,   0,   0,   0,   0, -12],    // Bulrathi
    [ 12,   0,  12, -12,   0,   0,   0,   0,   0, -12],    // Meklar
    [ 12, -12, -12, -12, -12, -12, -12, -12, -12,   0],    // Darlok
  ];

  // ---- neutral defaults (fresh objects per race so no array is shared) ----
  const modDefaults = () => ({
    tradePts: 0, posActMul: 1, tributeMul: 1, aiMoodBonus: 0, councilBonus: 0,
    compLevel: 0, initiative: 0, defense: 0, misDefense: 0,
    groundBonus: 0,
    workerMul: 1, operBonus: 0, noRefit: false,
    researchMul: 1,
    growthMul: 1, ecoGrowthMul: 1, popCost: [1, 1],
    spyCostMul: 1, spyOff: 0, spyDef: 0,
    allTerrain: false, noWaste: false, halfGrowth: false, noPlague: false, noAccident: false, noSoil: false,
  });
  const aiDefaults = () => ({
    hull: 0, shipSlider: 0, indSlider: 0, techSlider: 0,
    ecoSlider: { add: 0, belowMp2: false },
    researchFocus: null, researchFocusFields: [],
    autoResolveWeight: 0, autoResolveWeightPlus: 0,
    invasionMul: 1, invasionMulPlus: 1,
    alwaysSpy: false, spyRating: 0, proposeBonus: 0,
  });

  // ---- the ten records (mod / ai list only the non-default values; they are merged with the defaults below) ----
  const RECORDS = [
    {
      id: 'human', idx: 0, name: 'Human', plural: 'Humans', adj: 'Human',
      tagline: 'Born traders and diplomats',
      desc: 'Adaptable, sociable and relentlessly commercial, humanity bargained its way into the galactic club and has been charming its rivals ever since. Its scientists favor shield engineering above all else.',
      homeworld: 'Sol',
      leaders: ['Alexander', 'Strader', 'Durash IV', 'Johann III', 'Caesar', 'Bladrov II'],
      shipNames: ['Fighter', 'Gunboat', 'Courier', 'Frigate', 'Destroyer', 'Corvette', 'Cruiser', 'Escort', 'Warship', 'Dreadnought', 'Battleship', 'Dreadstar'],
      mod: { tradePts: 25, posActMul: 2, tributeMul: 2, aiMoodBonus: 50, councilBonus: 20 },
      traits: [
        { label: 'Expert traders', text: 'Every trade treaty pays 25 percentage points more income.', good: true },
        { label: 'Magnificent diplomats', text: 'Positive diplomatic acts count double, every race starts friendly toward you, and your Council vote carries extra weight.', good: true },
        { label: 'Shield engineers', text: 'Force-field research costs 40% less; planetology and propulsion cost 20% less.', good: true },
        { label: 'No martial edge', text: 'No bonus to combat, production, growth or spying.', good: false },
      ],
      ai: { proposeBonus: 50 },
      art: { primary: '#4a8be0', secondary: '#e2b84a' },
      audienceTheme: 0x16,
    },
    {
      id: 'mrrshan', idx: 1, name: 'Mrrshan', plural: 'Mrrshans', adj: 'Mrrshan',
      tagline: 'Deadliest gunners in the galaxy',
      desc: 'Proud feline hunters who treat gunnery as an art form and diplomacy as an insult. Their pride has bought them few friends, and the Alkari none at all.',
      homeworld: 'Fierias',
      leaders: ['Jasana', 'Prrsha', 'Yalara', 'Miamar', 'Shandra', 'Mirana'],
      shipNames: ['Wolverine', 'Griffin', 'Ferret', 'Lynx', 'Cheetah', 'Bobcat', 'Panther', 'Leopard', 'Warcat', 'Sabretooth', 'Puma', 'Tiger'],
      mod: { compLevel: 4, initiative: 4 },
      traits: [
        { label: 'Superior gunners', text: 'Every ship fights with computers four levels better: +40 to hit with beams and missiles, and +4 initiative.', good: true },
        { label: 'Weapon savants', text: 'Weapons research costs 40% less.', good: true },
        { label: 'Poor engineers', text: 'Construction research costs 25% more.', good: false },
        { label: 'Prickly neighbors', text: 'Five races start uneasy or worse toward you, the Alkari most of all.', good: false },
      ],
      ai: { shipSlider: 15, researchFocus: 'weapons', researchFocusFields: [5], autoResolveWeight: 15, autoResolveWeightPlus: 20 },
      art: { primary: '#e0a030', secondary: '#a85a1e' },
      audienceTheme: 0x14,
    },
    {
      id: 'silicoid', idx: 2, name: 'Silicoid', plural: 'Silicoids', adj: 'Silicoid',
      tagline: 'At home on any world',
      desc: 'Living crystal and cooling lava, the Silicoids shrug off poison air, ash and radiation that would kill any other colonist. They breed slowly, speak rarely, and strike early, before the rest of the galaxy catches up.',
      homeworld: 'Cryslon',
      leaders: ['Igneous', 'Geode', 'Sedimen', 'Crystous', 'Granid', 'Carnax'],
      shipNames: ['Piranha', 'Stingray', 'Minnow', 'Manta', 'Barracuda', 'Morey', 'Shark', 'Mako', 'Whale', 'Kraken', 'Monitor', 'Polaris'],
      mod: { allTerrain: true, noWaste: true, halfGrowth: true, noPlague: true, noAccident: true, noSoil: true },
      traits: [
        { label: 'Immune to environments', text: 'Colonize any planet type from the first turn.', good: true },
        { label: 'Pollution-free', text: 'Produce no waste, need no ecology spending, and never suffer plague or industrial accidents.', good: true },
        { label: 'Slow breeders', text: 'Natural population growth is halved and ignores planet quality.', good: false },
        { label: 'Narrow science', text: 'Computers cost 20% less, every other field 25% more; no environment, waste or soil technologies.', good: false },
      ],
      ai: { hull: 3 },
      art: { primary: '#38c7c0', secondary: '#8a5cd6' },
      audienceTheme: 0x22,
    },
    {
      id: 'sakkra', idx: 3, name: 'Sakkra', plural: 'Sakkras', adj: 'Sakkra',
      tagline: 'Explosive population growth',
      desc: 'Egg-laying saurians from the steaming jungles of Sssla, whose breeding rate forces them to expand or starve. They worship strength and have little patience for the soft arts of diplomacy.',
      homeworld: 'Sssla',
      leaders: ['Guanar', 'Tyranid', 'Saurak', 'Sauron', 'Hissa', 'Kryssta'],
      shipNames: ['Goblin', 'Cyclops', 'Daemon', 'Banshee', 'Spectre', 'Spirit', 'Juggernaut', 'Valkyrie', 'Hydra', 'Titan', 'Colossus', 'Dragon'],
      mod: { growthMul: 2, ecoGrowthMul: 2, popCost: [2, 3] },
      traits: [
        { label: 'Explosive growth', text: 'Population grows twice as fast, and ecology spending buys new colonists far more cheaply.', good: true },
        { label: 'Terraforming prodigies', text: 'Planetology research costs 40% less.', good: true },
        { label: 'Strained relations', text: 'Start wary of the Mrrshan and uneasy with the Alkari, Klackon, Meklar and Darlok.', good: false },
      ],
      ai: { ecoSlider: { add: 10, belowMp2: true }, researchFocus: 'planetology', researchFocusFields: [3] },
      art: { primary: '#34c37f', secondary: '#1f7a52' },
      audienceTheme: 0x20,
    },
    {
      id: 'psilon', idx: 4, name: 'Psilon', plural: 'Psilons', adj: 'Psilon',
      tagline: 'Peerless researchers',
      desc: 'Hairless, enormous-brained scholars who regard the galaxy as an unsolved problem and war as an inefficient way of solving it. Nobody out-thinks them, though plenty of races would rather out-shoot them.',
      homeworld: 'Mentar',
      leaders: ['Meson', 'Kelvan', 'Quark', 'Zygot', 'Tachaon', 'Amios'],
      shipNames: ['Starfighter', 'Comet', 'Seeker', 'Star Wing', 'Star Blazer', 'Star Streak', 'Star Blade', 'Dark Star', 'Coraona', 'Sun Fire', 'Star Fury', 'Nova'],
      mod: { researchMul: 1.5 },
      traits: [
        { label: 'Superior researchers', text: 'Research output ×1.5 and all fields cost 20% less.', good: true },
        { label: 'Wider tree', text: 'A broader tech tree: roughly 130 technologies to discover instead of 100.', good: true },
        { label: 'No combat edge', text: 'No bonus to ships, troops, production or spying.', good: false },
      ],
      ai: { techSlider: 20, spyRating: 10 },
      art: { primary: '#e8d6a0', secondary: '#5fb8b0' },
      audienceTheme: 0x1c,
    },
    {
      id: 'alkari', idx: 5, name: 'Alkari', plural: 'Alkaris', adj: 'Alkari',
      tagline: 'Ace pilots of the star lanes',
      desc: 'Proud, clan-minded descendants of great raptors, still able to glide on their own wings, who fly their fighters as extensions of their bodies. An old blood feud with the Mrrshan colors every border they touch.',
      homeworld: 'Altair',
      leaders: ['Skylord', 'Sharpclaw', 'Redwing', 'Farseer', 'Highsoar', 'Ariel'],
      shipNames: ['Foxbat', 'Sparrowhawk', 'Pelican', 'Falcon', 'Sky Hawk', 'Space Gull', 'Warbird', 'Warhawk', 'Wareagle', 'Condor', 'Dreadwing', 'Sky Master'],
      mod: { defense: 3, misDefense: 3, initiative: 3 },
      traits: [
        { label: 'Superior pilots', text: 'Ships are three levels harder to hit by beams and missiles (-30 points) and act three steps earlier in combat.', good: true },
        { label: 'Propulsion masters', text: 'Propulsion research costs 40% less.', good: true },
        { label: 'Weak shield science', text: 'Force-field research costs 25% more.', good: false },
        { label: 'Mrrshan feud', text: 'Start restless toward the Mrrshan, and uneasy with the Sakkra, Klackon and Darlok.', good: false },
      ],
      ai: { hull: -3, researchFocus: 'propulsion', researchFocusFields: [4], autoResolveWeight: 15 },
      art: { primary: '#f08a2c', secondary: '#f4efe6' },
      audienceTheme: 0x12,
    },
    {
      id: 'klackon', idx: 6, name: 'Klackon', plural: 'Klackons', adj: 'Klackon',
      tagline: 'Tireless hive workforce',
      desc: 'A vast, orderly hive of ant-like workers who almost never rebel and each labor as two. They trust few outsiders, and their weak engines keep them close to home.',
      homeworld: 'Kholdan',
      leaders: ['Ixitixl', 'Kikitik', 'Klaquan', 'Kaxal', "K'kalak", 'Xantak'],
      shipNames: ['Sabre', 'Cutlass', 'Dagger', 'Lancer', 'Pegasus', 'Horseman', 'Ranger', 'Knight', 'Avenger', 'Dragoon', 'Paladin', 'Excaliber'],
      mod: { workerMul: 2 },
      traits: [
        { label: 'Tireless workers', text: 'Every colonist produces twice the usual base output.', good: true },
        { label: 'Master builders', text: 'Construction research costs 40% less.', good: true },
        { label: 'Short-range drives', text: 'Propulsion research costs 25% more.', good: false },
        { label: 'Insular hive', text: 'Start uneasy with the Mrrshan, Silicoid, Sakkra, Alkari and Darlok.', good: false },
      ],
      ai: { hull: -3, ecoSlider: { add: 15, belowMp2: true } },
      art: { primary: '#8a9a3a', secondary: '#b5532a' },
      audienceTheme: 0x18,
    },
    {
      id: 'bulrathi', idx: 7, name: 'Bulrathi', plural: 'Bulrathis', adj: 'Bulrathi',
      tagline: 'Unbeatable ground fighters',
      desc: 'Hulking, bear-like warriors who are slow to anger and slower to befriend, yet unmatched in the trenches of a planetary assault. At heart they are gardeners, devoted to taming hostile worlds.',
      homeworld: 'Ursa',
      leaders: ['Monch', 'Durpp', 'Grunk', 'Bullux', 'Smurch', 'Krungo'],
      shipNames: ['Paw', 'Panda', 'Patrol', 'Hunter', 'Gladiator', 'Sentinel', 'Claw', 'Tooth', 'Warbear', 'Grizzly', 'Punisher', 'Rhino'],
      mod: { groundBonus: 25 },
      traits: [
        { label: 'Terrific ground fighters', text: 'Troops fight with +25 strength, attacking or defending.', good: true },
        { label: 'Armorers and gunsmiths', text: 'Construction and weapons research cost 20% less.', good: true },
        { label: 'Poor computing', text: 'Computer research costs 25% more.', good: false },
      ],
      ai: { hull: 3, ecoSlider: { add: 10, belowMp2: true }, researchFocus: 'weapons', researchFocusFields: [5], invasionMul: 1.2, invasionMulPlus: 2.15 },
      art: { primary: '#a8693a', secondary: '#d08a4e' },
      audienceTheme: 0x24,
    },
    {
      id: 'meklar', idx: 8, name: 'Meklar', plural: 'Meklars', adj: 'Meklar',
      tagline: 'Masters of automated industry',
      desc: 'Cyborgs fused to their own machines, running the most efficient assembly lines in the galaxy and its least predictable councils. Where others hire more workers, the Meklar simply add more arms.',
      homeworld: 'Meklon',
      leaders: ['CB-715', 'QX-537', 'INT-986', 'TVC-15', 'TX-1138', 'M5-35'],
      shipNames: ['Marauder', 'Hyperion', 'Drachma', 'Intruder', 'Penetrator', 'Tormenter', 'Ajax', 'Tornado', 'Nexus', 'Nemesis', 'Devastator', 'Annihilator'],
      mod: { operBonus: 2, noRefit: true },
      traits: [
        { label: 'Enhanced factory controls', text: 'Every colonist runs two more factories, and robotic-control upgrades need no refit.', good: true },
        { label: 'Computing masters', text: 'Computer research costs 40% less.', good: true },
        { label: 'Poor planetologists', text: 'Planetology research costs 25% more.', good: false },
      ],
      ai: { hull: 3, indSlider: 20, researchFocus: 'construction/planetology', researchFocusFields: [1, 3] },
      art: { primary: '#9aa8bd', secondary: '#d04545' },
      audienceTheme: 0x1a,
    },
    {
      id: 'darlok', idx: 9, name: 'Darlok', plural: 'Darloks', adj: 'Darlok',
      tagline: 'Supreme masters of espionage',
      desc: 'Cloaked, shape-shifting and perpetually suspected, the Darlok trade in secrets rather than goods. Every race but Humanity expects to be robbed by them, and most are right.',
      homeworld: 'Nazin',
      leaders: ['Nazgur', 'Narzina', 'Morfane', 'Shador', "Dar'Quan", 'Ssithra'],
      shipNames: ['Spider', 'Bumblebee', 'Needle', 'Hornet', 'Scorpion', 'Venom', 'Tarantula', 'Viper', 'Cobra', 'King Cobra', 'Black Widow', 'Death Wyn'],
      mod: { spyCostMul: 0.5, spyOff: 30, spyDef: 20 },
      traits: [
        { label: 'Supreme spies', text: 'Spies cost half as much, with +30 on your spy rolls and +20 on counter-espionage.', good: true },
        { label: 'Sharp computers', text: 'Computer research costs 20% less.', good: true },
        { label: 'Universally mistrusted', text: 'Every race but the Humans starts uneasy toward you.', good: false },
      ],
      ai: { researchFocus: 'computers', researchFocusFields: [0], alwaysSpy: true, spyRating: 30 },
      art: { primary: '#7568d8', secondary: '#a864d8' },
      audienceTheme: 0x1e,
    },
  ];

  // ---- build: merge defaults, derive startRelations, validate order ----
  const races = {};
  RECORDS.forEach((r, i) => {
    if (ORDER[i] !== r.id || r.idx !== i) throw new Error('Data.Races: record "' + r.id + '" is out of order');
    r.mod = Object.assign(modDefaults(), r.mod);
    r.ai = Object.assign(aiDefaults(), r.ai);
    r.startRelations = {};
    ORDER.forEach((other, j) => { r.startRelations[other] = RELATIONS[i][j]; });
    races[r.id] = r;
  });

  function key(race) {
    const k = typeof race === 'number' ? ORDER[race] : (race && typeof race === 'object' ? race.id : race);
    if (typeof k !== 'string' || !Object.prototype.hasOwnProperty.call(races, k)) throw new Error('Data.Races: unknown race ' + JSON.stringify(race));
    return k;
  }
  function rollPersonality(R, race) { const t = TRAIT1[key(race)]; return t[R.int(0, t.length - 1)]; }
  function rollObjective(R, race) { const t = TRAIT2[key(race)]; return t[R.int(0, t.length - 1)]; }

  M.Data.Races = {
    ORDER, PERSONALITIES, OBJECTIVES, TRAIT1, TRAIT2, RELATIONS, MOD_DEFAULTS: modDefaults(), AI_DEFAULTS: aiDefaults(),
    races, list: ORDER.map(id => races[id]), rollPersonality, rollObjective,
  };
  M.Data.races = M.Data.Races.races;          // UI / GNN contract: id -> record
  M.Data.raceList = M.Data.Races.ORDER;       // UI / GNN contract: ids in menu order
});
