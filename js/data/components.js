// Ship components — hulls, engines, battle computers, ECM, deflector shields, armor, special devices and weapons.
// Sources: research/03-ships-combat.md §1–§3 (VERIFIED, 1oom `game_shiptech.c` literal tables) and research/02-technology.md §3 + Appendix C. Worker-safe plain data.
//
// MOO.Data.Components
//   UNITS: 1oom raw units. Every COST is in TENTHS of BC (hull 'small' = 60 = 6 BC). Space is "tons", power is power units.
//   Arrays marked [4] are per hull, ordered [Small, Medium, Large, Huge]; 'fixed' values of the original tables are repeated x4.
//   Weapons and engines are SCALARS (one mount / one engine; they do not depend on the hull).
//
//   HULLS      4 x {id,name,cost,space,hits,power,defense,w}
//                hits = hit points with Titanium · power = maneuver power per rating step · defense = beam/missile defense modifier (+2/+1/0/-1)
//                w = 'ship points' weight 1/5/25/125 (AI auto-resolve, comet/pirate damage, fleet-strength bars)
//   ENGINES    9 x {id,name,warp,power,space,cost,tech:{f:4,l}}       scalars per ONE engine (power = 10*warp); a design uses engines in TENTHS (sim/design.js)
//   COMPUTERS 11 x {id,name,level,power:[4],space:[4],cost:[4],tech:{f:0,l}}     level = attack level (Mark number); power == space
//   ECM       10 x {id,name,level,power:[4],space:[4],cost:[4],tech:{f:0,l}}     level = missile-defense bonus
//   SHIELDS   11 x {id,name,absorb,power:[4],space:[4],cost:[4],tech:{f:2,l}}    Class I..VII, IX, XI, XIII, XV (VIII, X, XII, XIV do not exist); power == space
//   ARMOR     14 x {id,name,pct,space:[4],cost:[4],tech:{f:1,l},heavy}           HP = floor(hull.hits * pct / 100); heavy = the 'II' double hull (same tech as its base)
//   SPECIALS  30 x {n,id,name,desc,group,power:[4],space:[4],cost:[4],tech:{f,l},fx:{…},range,colonyMin,tanks}
//                group = exclusivity group (the 'Type' column of research/03 §3.6): a design may carry at most ONE device per group
//                fx    = numeric / flag effects, folded by best value into the design stats:  extraman (+maneuver 2|4) · repair (% of one ship's HP per round 15|30)
//                        misshield (% missiles shot down 40|75|100) · extrarange (+3 beam range) · pulsar (1|2) · stream (1|2) · cloak (+5 defense) · scanner (+1 attack, +3 initiative)
//                        teleport · stasis · repulsor · dissipator · blackhole · technull · oracle · displacement (34 = % of non-special attacks that miss)
//                range = reach of the device in squares (0 = passive / self)
//                colonyMin = lowest planet-type index the colony base can settle (7 minimal … 1 radiated), 0 for every other device · tanks = Reserve Fuel Tanks (+3 parsecs)
//   WEAPONS   63 x {n,id,name,desc,kind,power,space,cost,tech:{f,l},dmg:[min,max],range,rof,ammo,speed,acc,racks,warheads,mul,heavy,flags:{…},grant}
//                ALL weapons in 1oom enum order: WEAPONS[i].n === i + 1 (n = the '#' column of research/03 §3.7; the 2-shot and 5-shot rack of a missile are two entries,
//                ids 'nuclear-missile' / 'nuclear-missile-5'). kind: beam | missile | torpedo | bomb | bio | special (monster-only weapons).
//                power/space/cost are scalars (cost in tenths of BC). tech.f = 5 (Weapons), bio weapons 3 (Planetology).
//                dmg = [min,max] per hit (missiles/torpedoes: fixed value twice) · range = squares (missile/torpedo: launch range) · rof = shots per round per weapon
//                ammo = volleys per battle for the whole group (-1 unlimited; missiles = racks; bombs 10; bio 5) · speed = missile squares/round · acc = attack-level bonus
//                racks = 2|5 for missiles, else 0 · warheads = missiles per launcher (scatter packs 5/7/10) · mul = attacks per hit (Stellar Converter / Hellfire / Crystal Ray: 4)
//                flags: halfShield (halves target shield absorb) · streaming (excess damage carries to the next ship) · enveloping (one hit roll, `mul` attacks, each reduced by shield)
//                       everyOtherRound (torpedoes) · damageFade (Plasma Torpedo loses 1 damage per 2 px flown, ~16 per square) · scatter (warheads > 1)
//                       groundOnly (bombs, bio) · ignoreShield (bio) · monster (never obtainable by a player)
//   Every researchable component also has `grant` = the exact key research.js stores in E.grants ('weapon:laser', 'bomb:death-spores', 'armor:duralloy-armor' …);
//   the ids equal Data.Techs.GRANT_IDS. Monster weapons have grant ''.
//   T50 / T25   51-entry miniaturisation tables (percent) — identical to Data.Techs.T50 / T25.
//   miniCost(raw, tm)  = floor(raw * T50[tm] / 100)                      cost of every component
//   miniSpace(raw, tm, isWeapon) = floor(raw * (isWeapon ? T50 : T25)[tm] / 100), at least 1 when raw > 0      space (weapons shrink twice as fast as everything else)
//   tm = clamp(TL of the component's field - component tech level, 0, 50)   (sim/design.js)
//   idx.{hulls,engines,computers,ecm,shields,armor,specials,weapons}[id] -> array index
//
// NOTE (conflicts between the research documents; the 1oom value is used everywhere, see research/03 §12):
//   * Hull space growth is +2% of base per Construction level (Manual says 1%); applied in sim/design.js.
//   * Computer Mark I-XI small/medium space (OSG prints them one row lower) — 1oom table used. Shield IV huge space 675 (OSG 625), Shield VI tech 24 (OSG 25).
//   * Heavy ('II') armor on the Small hull needs 20/25/30/35/40/45/50 tons (OSG: 14/17/20/23/26/30/35).  Neutronium II huge cost 2500 (the 1.5x pattern would give 2250).
//   * ECM X small cost 5.0 BC (the +0.25 pattern would give 4.7); Class XIII / XV shield small cost 8.0 / 9.0 BC (pattern 7.5 / 8.5) — both research docs print the 1oom value.
//   * Displacement Device space = power = 10/50/225/1250 (OSG: size 15/75/375/1875, power 5/25/125/625).
//   * Manual vs 1oom weapons: Neutron Blaster cost 6 (Manual 5) · Graviton Beam 6/20/50 (Manual 5/30/60) · Tachyon power 70 (80) · Plasma Cannon power 100 (110)
//     Plasma Torpedo cost 60 (150) · Fusion Bomb cost 3 / level 9 (4 / 8) · Neutronium Bomb cost 9 (10) · Proton Torpedo damage 75 (60) · Hyper-X level 8, range 7/5 (7, 4)
//     Zeon range 9/7 (10) · Scatter Pack X range 10/10 (7) · Scatter Pack V accuracy +1 (0). Hyper-X speed 3.0/2.5 is below Hyper-V's 3.5/2.5 exactly as printed.
//   * Ion and Neutron Stream Projector have different exclusivity groups (12 vs 16) in 1oom, OSG says they exclude each other — the design screen of 1oom allows both.
//   * Oracle Interface: 1oom does not apply the shield halving in damage rolls (only the AI assumes it); SW says 'armor-piercing'. fx.oracle is just a flag.
//   * Armor names: the tech / grant ids use 1oom's spelling 'zortium-armor'; the design list shows 'Zortrium' (name).
//   * Special-device descriptions: the wording of research/03 §3.6 / research/06 §5.11 is quoted where it exists; the remaining devices use short mechanical notes in the same style.
MOO.def(function (M) {
  'use strict';

  // ---- miniaturisation tables (research/02 Appendix C; index tm 0..50) ---------------------------------------------------------------------
  const T50 = [100, 93, 87, 81, 76, 71, 66, 62, 58, 54, 50,
    47, 44, 41, 38, 35, 33, 31, 29, 27, 25,
    23, 22, 20, 19, 18, 16, 15, 14, 13, 13,
    12, 11, 10, 9, 9, 8, 8, 7, 7, 6,
    6, 5, 5, 5, 4, 4, 4, 4, 3, 3];
  const T25 = [100, 97, 94, 92, 89, 87, 84, 82, 79, 77, 75,
    73, 71, 69, 67, 65, 63, 61, 60, 58, 56,
    55, 53, 52, 50, 49, 47, 46, 45, 43, 42,
    41, 40, 39, 38, 37, 36, 35, 34, 33, 32,
    31, 30, 29, 28, 27, 27, 26, 25, 24, 24];
  const clampTm = tm => (tm < 0 ? 0 : tm > 50 ? 50 : tm | 0);
  const miniCost = (raw, tm) => Math.floor(raw * T50[clampTm(tm)] / 100);
  const miniSpace = (raw, tm, isWeapon) => {
    if (!(raw > 0)) return 0;
    const v = Math.floor(raw * (isWeapon ? T50 : T25)[clampTm(tm)] / 100);
    return v < 1 ? 1 : v;
  };
  const x4 = v => [v, v, v, v];

  // ---- hulls (research/03 §1.1) -------------------------------------------------------------------------------------------------------------
  const HULLS = [
    { id: 'small',  name: 'Small',  cost: 60,    space: 40,   hits: 3,   power: 2,   defense: 2,  w: 1 },
    { id: 'medium', name: 'Medium', cost: 360,   space: 200,  hits: 18,  power: 15,  defense: 1,  w: 5 },
    { id: 'large',  name: 'Large',  cost: 2000,  space: 1000, hits: 100, power: 100, defense: 0,  w: 25 },
    { id: 'huge',   name: 'Huge',   cost: 12000, space: 5000, hits: 600, power: 700, defense: -1, w: 125 },
  ];

  // ---- engines (research/03 §3.1; Propulsion) -------------------------------------------------------------------------------------------------
  const ENGINES = [
    { id: 'retro-engine',        name: 'Retro',        warp: 1, power: 10, space: 10, cost: 20,  tech: { f: 4, l: 1 } },
    { id: 'nuclear-engine',      name: 'Nuclear',      warp: 2, power: 20, space: 18, cost: 40,  tech: { f: 4, l: 6 } },
    { id: 'sub-light-engine',    name: 'Sub-Light',    warp: 3, power: 30, space: 26, cost: 60,  tech: { f: 4, l: 12 } },
    { id: 'fusion-engine',       name: 'Fusion',       warp: 4, power: 40, space: 33, cost: 80,  tech: { f: 4, l: 18 } },
    { id: 'impulse-engine',      name: 'Impulse',      warp: 5, power: 50, space: 36, cost: 100, tech: { f: 4, l: 24 } },
    { id: 'ion-engine',          name: 'Ion',          warp: 6, power: 60, space: 40, cost: 120, tech: { f: 4, l: 30 } },
    { id: 'anti-matter-engine',  name: 'Anti-Matter',  warp: 7, power: 70, space: 44, cost: 140, tech: { f: 4, l: 36 } },
    { id: 'inter-phased-engine', name: 'Inter-Phased', warp: 8, power: 80, space: 47, cost: 160, tech: { f: 4, l: 42 } },
    { id: 'hyperthrust-engine',  name: 'Hyperthrust',  warp: 9, power: 90, space: 50, cost: 180, tech: { f: 4, l: 48 } },
  ];

  // ---- battle computers (research/03 §3.2; Computers field 0) ---------------------------------------------------------------------------------
  const COMPUTERS = [
    { id: 'mark-1-computer',  name: 'Mark I',    level: 1,  power: [5, 10, 20, 100],   space: [5, 10, 20, 100],   cost: [40, 200, 1000, 5000],   tech: { f: 0, l: 1 } },
    { id: 'mark-2-computer',  name: 'Mark II',   level: 2,  power: [7, 15, 30, 150],   space: [7, 15, 30, 150],   cost: [50, 240, 1200, 6000],   tech: { f: 0, l: 5 } },
    { id: 'mark-3-computer',  name: 'Mark III',  level: 3,  power: [10, 20, 40, 200],  space: [10, 20, 40, 200],  cost: [60, 280, 1400, 7000],   tech: { f: 0, l: 10 } },
    { id: 'mark-4-computer',  name: 'Mark IV',   level: 4,  power: [12, 25, 50, 250],  space: [12, 25, 50, 250],  cost: [70, 320, 1600, 8000],   tech: { f: 0, l: 15 } },
    { id: 'mark-5-computer',  name: 'Mark V',    level: 5,  power: [15, 30, 60, 300],  space: [15, 30, 60, 300],  cost: [80, 360, 1800, 9000],   tech: { f: 0, l: 20 } },
    { id: 'mark-6-computer',  name: 'Mark VI',   level: 6,  power: [17, 35, 70, 350],  space: [17, 35, 70, 350],  cost: [90, 400, 2000, 10000],  tech: { f: 0, l: 25 } },
    { id: 'mark-7-computer',  name: 'Mark VII',  level: 7,  power: [20, 40, 80, 400],  space: [20, 40, 80, 400],  cost: [100, 440, 2200, 11000], tech: { f: 0, l: 30 } },
    { id: 'mark-8-computer',  name: 'Mark VIII', level: 8,  power: [22, 45, 90, 450],  space: [22, 45, 90, 450],  cost: [110, 480, 2400, 12000], tech: { f: 0, l: 35 } },
    { id: 'mark-9-computer',  name: 'Mark IX',   level: 9,  power: [25, 50, 100, 500], space: [25, 50, 100, 500], cost: [120, 520, 2600, 13000], tech: { f: 0, l: 40 } },
    { id: 'mark-10-computer', name: 'Mark X',    level: 10, power: [27, 55, 110, 550], space: [27, 55, 110, 550], cost: [130, 560, 2800, 14000], tech: { f: 0, l: 45 } },
    { id: 'mark-11-computer', name: 'Mark XI',   level: 11, power: [30, 60, 120, 600], space: [30, 60, 120, 600], cost: [140, 600, 3000, 15000], tech: { f: 0, l: 50 } },
  ];

  // ---- ECM jammers (research/03 §3.3; Computers field 0) --------------------------------------------------------------------------------------
  const ECM = [
    { id: 'ecm-1',  name: 'Jammer I',    level: 1,  power: [10, 20, 40, 170],  space: [10, 20, 40, 170],  cost: [25, 150, 1000, 6250],   tech: { f: 0, l: 2 } },
    { id: 'ecm-2',  name: 'Jammer II',   level: 2,  power: [15, 30, 60, 250],  space: [15, 30, 60, 250],  cost: [27, 165, 1100, 6875],   tech: { f: 0, l: 7 } },
    { id: 'ecm-3',  name: 'Jammer III',  level: 3,  power: [20, 40, 80, 330],  space: [20, 40, 80, 330],  cost: [30, 180, 1200, 7500],   tech: { f: 0, l: 12 } },
    { id: 'ecm-4',  name: 'Jammer IV',   level: 4,  power: [25, 50, 100, 410], space: [25, 50, 100, 410], cost: [32, 195, 1300, 8125],   tech: { f: 0, l: 17 } },
    { id: 'ecm-5',  name: 'Jammer V',    level: 5,  power: [30, 60, 120, 490], space: [30, 60, 120, 490], cost: [35, 210, 1400, 8750],   tech: { f: 0, l: 22 } },
    { id: 'ecm-6',  name: 'Jammer VI',   level: 6,  power: [35, 70, 140, 570], space: [35, 70, 140, 570], cost: [37, 225, 1500, 9375],   tech: { f: 0, l: 27 } },
    { id: 'ecm-7',  name: 'Jammer VII',  level: 7,  power: [40, 80, 160, 650], space: [40, 80, 160, 650], cost: [40, 240, 1600, 10000],  tech: { f: 0, l: 32 } },
    { id: 'ecm-8',  name: 'Jammer VIII', level: 8,  power: [45, 90, 180, 730], space: [45, 90, 180, 730], cost: [42, 255, 1700, 10625],  tech: { f: 0, l: 37 } },
    { id: 'ecm-9',  name: 'Jammer IX',   level: 9,  power: [50, 100, 200, 810], space: [50, 100, 200, 810], cost: [45, 270, 1800, 11250], tech: { f: 0, l: 42 } },
    { id: 'ecm-10', name: 'Jammer X',    level: 10, power: [55, 110, 220, 900], space: [55, 110, 220, 900], cost: [50, 285, 1900, 11875], tech: { f: 0, l: 47 } },
  ];

  // ---- deflector shields (research/03 §3.4; Force Fields field 2) -----------------------------------------------------------------------------
  const SHIELDS = [
    { id: 'class-1-shield',  name: 'Class I',    absorb: 1,  power: [5, 20, 60, 250],     space: [5, 20, 60, 250],     cost: [30, 190, 1200, 7500],    tech: { f: 2, l: 1 } },
    { id: 'class-2-shield',  name: 'Class II',   absorb: 2,  power: [10, 35, 90, 375],    space: [10, 35, 90, 375],    cost: [35, 220, 1400, 8750],    tech: { f: 2, l: 4 } },
    { id: 'class-3-shield',  name: 'Class III',  absorb: 3,  power: [15, 50, 120, 500],   space: [15, 50, 120, 500],   cost: [40, 250, 1600, 10000],   tech: { f: 2, l: 10 } },
    { id: 'class-4-shield',  name: 'Class IV',   absorb: 4,  power: [20, 65, 150, 675],   space: [20, 65, 150, 675],   cost: [45, 280, 1800, 11250],   tech: { f: 2, l: 14 } },
    { id: 'class-5-shield',  name: 'Class V',    absorb: 5,  power: [25, 80, 180, 750],   space: [25, 80, 180, 750],   cost: [50, 310, 2000, 12500],   tech: { f: 2, l: 20 } },
    { id: 'class-6-shield',  name: 'Class VI',   absorb: 6,  power: [30, 95, 210, 875],   space: [30, 95, 210, 875],   cost: [55, 340, 2200, 13750],   tech: { f: 2, l: 24 } },
    { id: 'class-7-shield',  name: 'Class VII',  absorb: 7,  power: [35, 110, 240, 1000], space: [35, 110, 240, 1000], cost: [60, 370, 2400, 15000],   tech: { f: 2, l: 30 } },
    { id: 'class-9-shield',  name: 'Class IX',   absorb: 9,  power: [40, 125, 270, 1125], space: [40, 125, 270, 1125], cost: [65, 400, 2600, 16250],   tech: { f: 2, l: 34 } },
    { id: 'class-11-shield', name: 'Class XI',   absorb: 11, power: [45, 140, 300, 1250], space: [45, 140, 300, 1250], cost: [70, 430, 2800, 17500],   tech: { f: 2, l: 40 } },
    { id: 'class-13-shield', name: 'Class XIII', absorb: 13, power: [50, 155, 330, 1375], space: [50, 155, 330, 1375], cost: [80, 460, 3000, 18750],   tech: { f: 2, l: 44 } },
    { id: 'class-15-shield', name: 'Class XV',   absorb: 15, power: [55, 160, 360, 1500], space: [55, 160, 360, 1500], cost: [90, 490, 3200, 20000],   tech: { f: 2, l: 50 } },
  ];

  // ---- armor (research/03 §3.5; Construction field 1). Each metal has a standard and a heavy 'II' version (same tech level) -----------------------
  const ARMOR = [
    { id: 'titanium-armor',        name: 'Titanium',       pct: 100, space: [0, 0, 0, 0],          cost: [0, 0, 0, 0],            tech: { f: 1, l: 1 },  heavy: false },
    { id: 'titanium-armor-ii',     name: 'Titanium II',    pct: 150, space: [20, 80, 400, 2000],   cost: [20, 100, 500, 2500],    tech: { f: 1, l: 1 },  heavy: true },
    { id: 'duralloy-armor',        name: 'Duralloy',       pct: 150, space: [2, 10, 60, 300],      cost: [20, 100, 600, 3000],    tech: { f: 1, l: 10 }, heavy: false },
    { id: 'duralloy-armor-ii',     name: 'Duralloy II',    pct: 225, space: [25, 85, 425, 2100],   cost: [30, 150, 900, 4500],    tech: { f: 1, l: 10 }, heavy: true },
    { id: 'zortium-armor',         name: 'Zortrium',       pct: 200, space: [4, 20, 100, 500],     cost: [40, 200, 1000, 5000],   tech: { f: 1, l: 17 }, heavy: false },
    { id: 'zortium-armor-ii',      name: 'Zortrium II',    pct: 300, space: [30, 100, 500, 2500],  cost: [60, 300, 1500, 7500],   tech: { f: 1, l: 17 }, heavy: true },
    { id: 'andrium-armor',         name: 'Andrium',        pct: 250, space: [6, 30, 150, 750],     cost: [60, 300, 1500, 7500],   tech: { f: 1, l: 26 }, heavy: false },
    { id: 'andrium-armor-ii',      name: 'Andrium II',     pct: 375, space: [35, 115, 575, 2875],  cost: [90, 450, 2250, 11250],  tech: { f: 1, l: 26 }, heavy: true },
    { id: 'tritanium-armor',       name: 'Tritanium',      pct: 300, space: [8, 40, 200, 1000],    cost: [80, 400, 2000, 10000],  tech: { f: 1, l: 34 }, heavy: false },
    { id: 'tritanium-armor-ii',    name: 'Tritanium II',   pct: 450, space: [40, 130, 650, 3250],  cost: [120, 600, 3000, 15000], tech: { f: 1, l: 34 }, heavy: true },
    { id: 'adamantium-armor',      name: 'Adamantium',     pct: 350, space: [10, 50, 250, 1250],   cost: [100, 500, 2500, 12500], tech: { f: 1, l: 42 }, heavy: false },
    { id: 'adamantium-armor-ii',   name: 'Adamantium II',  pct: 525, space: [45, 150, 750, 3750],  cost: [150, 750, 3750, 18750], tech: { f: 1, l: 42 }, heavy: true },
    { id: 'neutronium-armor',      name: 'Neutronium',     pct: 400, space: [12, 60, 300, 1500],   cost: [120, 600, 3000, 15000], tech: { f: 1, l: 50 }, heavy: false },
    { id: 'neutronium-armor-ii',   name: 'Neutronium II',  pct: 600, space: [50, 175, 875, 4375],  cost: [180, 900, 4500, 25000], tech: { f: 1, l: 50 }, heavy: true },
  ];

  // ---- special devices (research/03 §3.6; n = the '#' column, group = the 'Type' column) --------------------------------------------------------
  const SPECIALS = [
    { n: 1,  id: 'reserve-fuel-tanks',       name: 'Reserve Fuel Tanks',       desc: 'extends ship range by 3 parsecs',         group: 1,  power: x4(0), space: [20, 100, 500, 2500], cost: [20, 100, 500, 2500], tech: { f: 1, l: 1 },  fx: {}, range: 0, colonyMin: 0, tanks: true },
    { n: 2,  id: 'standard-colony-base',     name: 'Standard Colony Base',     desc: 'allows normal planet landings',           group: 2,  power: x4(0), space: x4(700), cost: x4(3500), tech: { f: 3, l: 1 },  fx: {}, range: 0, colonyMin: 7, tanks: false },
    { n: 3,  id: 'barren-colony-base',       name: 'Barren Colony Base',       desc: 'allows barren planet landings',           group: 2,  power: x4(0), space: x4(700), cost: x4(3750), tech: { f: 3, l: 3 },  fx: {}, range: 0, colonyMin: 6, tanks: false },
    { n: 4,  id: 'tundra-colony-base',       name: 'Tundra Colony Base',       desc: 'allows tundra planet landings',           group: 2,  power: x4(0), space: x4(700), cost: x4(4000), tech: { f: 3, l: 6 },  fx: {}, range: 0, colonyMin: 5, tanks: false },
    { n: 5,  id: 'dead-colony-base',         name: 'Dead Colony Base',         desc: 'allows dead planet landings',             group: 2,  power: x4(0), space: x4(700), cost: x4(4250), tech: { f: 3, l: 9 },  fx: {}, range: 0, colonyMin: 4, tanks: false },
    { n: 6,  id: 'inferno-colony-base',      name: 'Inferno Colony Base',      desc: 'allows inferno planet landings',          group: 2,  power: x4(0), space: x4(700), cost: x4(4500), tech: { f: 3, l: 12 }, fx: {}, range: 0, colonyMin: 3, tanks: false },
    { n: 7,  id: 'toxic-colony-base',        name: 'Toxic Colony Base',        desc: 'allows toxic planet landings',            group: 2,  power: x4(0), space: x4(700), cost: x4(4750), tech: { f: 3, l: 15 }, fx: {}, range: 0, colonyMin: 2, tanks: false },
    { n: 8,  id: 'radiated-colony-base',     name: 'Radiated Colony Base',     desc: 'allows radiated planet landings',         group: 2,  power: x4(0), space: x4(700), cost: x4(5000), tech: { f: 3, l: 18 }, fx: {}, range: 0, colonyMin: 1, tanks: false },
    { n: 9,  id: 'battle-scanner',           name: 'Battle Scanner',           desc: 'displays enemy ship stats',               group: 3,  power: x4(50), space: x4(50), cost: x4(300), tech: { f: 0, l: 1 },  fx: { scanner: 1 }, range: 0, colonyMin: 0, tanks: false },
    { n: 10, id: 'anti-missile-rockets',     name: 'Anti-Missile Rockets',     desc: '40% chance missiles destroyed',           group: 4,  power: [8, 40, 200, 1000], space: [2, 10, 50, 250], cost: x4(100), tech: { f: 5, l: 6 },  fx: { misshield: 40 }, range: 0, colonyMin: 0, tanks: false },
    { n: 11, id: 'repulsor-beam',            name: 'Repulsor Beam',            desc: 'pushes adjacent enemy ships away',        group: 5,  power: x4(200), space: x4(100), cost: x4(550), tech: { f: 2, l: 16 }, fx: { repulsor: 1 }, range: 1, colonyMin: 0, tanks: false },
    { n: 12, id: 'warp-dissipator',          name: 'Warp Dissipator',          desc: '50% chance to slow target ship, range 3', group: 6,  power: x4(300), space: x4(100), cost: x4(650), tech: { f: 4, l: 20 }, fx: { dissipator: 1 }, range: 3, colonyMin: 0, tanks: false },
    { n: 13, id: 'energy-pulsar',            name: 'Energy Pulsar',            desc: 'damages all adjacent ships, 1-5',         group: 7,  power: x4(250), space: x4(150), cost: x4(750), tech: { f: 4, l: 16 }, fx: { pulsar: 1 }, range: 1, colonyMin: 0, tanks: false },
    { n: 14, id: 'inertial-stabilizer',      name: 'Inertial Stabilizer',      desc: '+2 maneuverability',                      group: 8,  power: [8, 40, 200, 1000], space: [4, 20, 100, 500], cost: [20, 75, 500, 2700], tech: { f: 4, l: 10 }, fx: { extraman: 2 }, range: 0, colonyMin: 0, tanks: false },
    { n: 15, id: 'zyro-shield',              name: 'Zyro Shield',              desc: '75% chance missiles destroyed',           group: 4,  power: [12, 60, 300, 1500], space: [4, 20, 100, 500], cost: [50, 100, 200, 300], tech: { f: 2, l: 31 }, fx: { misshield: 75 }, range: 0, colonyMin: 0, tanks: false },
    { n: 16, id: 'automated-repair',         name: 'Automated Repair',         desc: "heals 15% of ship's hits a turn",         group: 9,  power: [3, 10, 50, 300], space: [3, 15, 100, 600], cost: [2, 8, 50, 300], tech: { f: 1, l: 14 }, fx: { repair: 15 }, range: 0, colonyMin: 0, tanks: false },
    { n: 17, id: 'stasis-field',             name: 'Stasis Field',             desc: 'freezes an adjacent enemy ship',          group: 10, power: x4(275), space: x4(200), cost: x4(2500), tech: { f: 2, l: 37 }, fx: { stasis: 1 }, range: 1, colonyMin: 0, tanks: false },
    { n: 18, id: 'cloaking-device',          name: 'Cloaking Device',          desc: '+5 defense while cloaked',                group: 11, power: [10, 50, 250, 1250], space: [5, 25, 120, 600], cost: [30, 150, 750, 3750], tech: { f: 2, l: 27 }, fx: { cloak: 5 }, range: 0, colonyMin: 0, tanks: false },
    { n: 19, id: 'ion-stream-projector',     name: 'Ion Stream Projector',     desc: 'reduces enemy armor by 20%',              group: 12, power: x4(500), space: x4(250), cost: x4(1000), tech: { f: 5, l: 21 }, fx: { stream: 1 }, range: 2, colonyMin: 0, tanks: false },
    { n: 20, id: 'high-energy-focus',        name: 'High Energy Focus',        desc: 'increases weapon ranges by 3',            group: 13, power: [65, 200, 350, 1000], space: [35, 100, 150, 500], cost: [30, 135, 625, 3500], tech: { f: 4, l: 34 }, fx: { extrarange: 3 }, range: 0, colonyMin: 0, tanks: false },
    { n: 21, id: 'ionic-pulsar',             name: 'Ionic Pulsar',             desc: 'damages all adjacent ships, 2-10',        group: 7,  power: x4(750), space: x4(400), cost: x4(1500), tech: { f: 4, l: 40 }, fx: { pulsar: 2 }, range: 1, colonyMin: 0, tanks: false },
    { n: 22, id: 'black-hole-generator',     name: 'Black Hole Generator',     desc: 'kills 25%-100% of an adjacent fleet',     group: 14, power: x4(750), space: x4(750), cost: x4(2750), tech: { f: 2, l: 43 }, fx: { blackhole: 1 }, range: 1, colonyMin: 0, tanks: false },
    { n: 23, id: 'sub-space-teleporter',     name: 'Sub Space Teleporter',     desc: 'teleports ship anywhere, fires first',    group: 15, power: [16, 80, 400, 2000], space: [4, 20, 100, 500], cost: [25, 100, 450, 2250], tech: { f: 4, l: 38 }, fx: { teleport: 1 }, range: 0, colonyMin: 0, tanks: false },
    { n: 24, id: 'lightning-shield',         name: 'Lightning Shield',         desc: '100% chance missiles destroyed',          group: 4,  power: [15, 70, 350, 1750], space: [6, 30, 150, 750], cost: [200, 300, 400, 500], tech: { f: 2, l: 46 }, fx: { misshield: 100 }, range: 0, colonyMin: 0, tanks: false },
    { n: 25, id: 'neutron-stream-projector', name: 'Neutron Stream Projector', desc: 'reduces enemy armor by 40%',              group: 16, power: x4(1250), space: x4(500), cost: x4(2000), tech: { f: 5, l: 47 }, fx: { stream: 2 }, range: 2, colonyMin: 0, tanks: false },
    { n: 26, id: 'advanced-damage-control',  name: 'Advanced Damage Control',  desc: "heals 30% of ship's hits a turn",         group: 9,  power: [9, 30, 150, 450], space: [9, 45, 300, 1800], cost: [40, 200, 1000, 5000], tech: { f: 1, l: 36 }, fx: { repair: 30 }, range: 0, colonyMin: 0, tanks: false },
    { n: 27, id: 'technology-nullifier',     name: 'Technology Nullifier',     desc: 'lowers enemy attack and ECM levels by 2-6', group: 17, power: x4(1000), space: x4(750), cost: x4(3000), tech: { f: 0, l: 49 }, fx: { technull: 1 }, range: 4, colonyMin: 0, tanks: false },
    { n: 28, id: 'inertial-nullifier',       name: 'Inertial Nullifier',       desc: '+4 maneuverability',                      group: 8,  power: [12, 60, 300, 1500], space: [6, 30, 150, 750], cost: [60, 200, 1500, 5000], tech: { f: 4, l: 46 }, fx: { extraman: 4 }, range: 0, colonyMin: 0, tanks: false },
    { n: 29, id: 'oracle-interface',         name: 'Oracle Interface',         desc: 'halves target shields against beams',     group: 20, power: [12, 60, 300, 1500], space: [8, 40, 200, 1000], cost: [30, 150, 600, 2750], tech: { f: 0, l: 46 }, fx: { oracle: 1 }, range: 0, colonyMin: 0, tanks: false },
    { n: 30, id: 'displacement-device',      name: 'Displacement Device',      desc: '1/3 of all enemy attacks miss',           group: 21, power: [10, 50, 225, 1250], space: [10, 50, 225, 1250], cost: [30, 150, 300, 2750], tech: { f: 4, l: 50 }, fx: { displacement: 34 }, range: 0, colonyMin: 0, tanks: false },
  ];

  // ---- weapons (research/03 §3.7; 1oom enum order) ----------------------------------------------------------------------------------------------
  const WEAPONS = [];
  const add = (n, id, name, kind, f, l, o) => {
    const w = Object.assign({ n, id, name, desc: '', kind, power: 0, space: 0, cost: 0, tech: { f, l }, dmg: [0, 0], range: 1, rof: 1, ammo: -1, speed: 0, acc: 0, racks: 0, warheads: 1, mul: 1, heavy: false }, o);
    w.flags = Object.assign({}, o && o.flags);
    WEAPONS.push(w);
  };
  // beam(n, id, name, techLevel, dmgMin, dmgMax, range, cost, space, power, extra)
  const beam = (n, id, name, l, min, max, range, cost, space, power, o) => add(n, id, name, 'beam', 5, l, Object.assign({ dmg: [min, max], range, cost, space, power }, o));
  const heavy = { heavy: true, desc: 'heavy mount, range 2' };
  const half = { flags: { halfShield: true }, desc: '1/2 shields' };
  const stream = { flags: { streaming: true }, desc: 'streaming, excess damage hits the next ship' };
  const bomb = (n, id, name, l, min, max, cost, space) => add(n, id, name, 'bomb', 5, l, { desc: 'ground targets only, 10 per battle', dmg: [min, max], cost, space, power: 10, ammo: 10, flags: { groundOnly: true } });
  const bio = (n, id, name, l, max, cost, space) => add(n, id, name, 'bio', 3, l, { desc: 'kills population, ignores shields, 5 per battle', dmg: [0, max], cost, space, power: 10, ammo: 5, flags: { groundOnly: true, ignoreShield: true } });
  // missile(n of the 2-shot rack, id, name, techLevel, damage, accuracy, [range 2|5], [speed 2|5], [cost 2|5], [space 2|5], [power 2|5], warheads)
  const missile = (n, id, name, l, dmg, acc, rng, spd, cost, space, power, wh) => [0, 1].forEach(k => add(n + k, k ? id + '-5' : id, k ? name + ' (5)' : name, 'missile', 5, l, {
    desc: (k ? '5 shots' : '2 shots, +1 speed') + (wh > 1 ? ', splits into ' + wh : ''), dmg: [dmg, dmg], range: rng[k], speed: spd[k], acc, cost: cost[k], space: space[k], power: power[k],
    ammo: k ? 5 : 2, racks: k ? 5 : 2, warheads: wh, flags: wh > 1 ? { scatter: true } : {},
  }));
  const torpedo = (n, id, name, l, dmg, acc, range, speed, cost, space, power, o) => add(n, id, name, 'torpedo', 5, l, Object.assign({
    desc: 'fires one per 2 turns', dmg: [dmg, dmg], range, speed, acc, cost, space, power, flags: { everyOtherRound: true } }, o));

  bomb(1, 'nuclear-bomb', 'Nuclear Bomb', 1, 3, 12, 30, 40);
  beam(2, 'laser', 'Laser', 1, 1, 4, 1, 30, 10, 25);
  missile(3, 'nuclear-missile', 'Nuclear Missile', 1, 4, 0, [6, 4], [3.0, 2.0], [70, 105], [50, 75], [20, 30], 1);
  beam(5, 'heavy-laser', 'Heavy Laser', 1, 1, 7, 2, 90, 30, 75, heavy);
  missile(6, 'hyper-v', 'Hyper-V Rocket', 4, 6, 0, [7, 5], [3.5, 2.5], [90, 135], [70, 105], [20, 30], 1);
  beam(8, 'gatling-laser', 'Gatling Laser', 5, 1, 4, 1, 90, 20, 70, { rof: 4, desc: 'fires 4x' });
  beam(9, 'neutron-pellet-gun', 'Neutron Pellet Gun', 7, 2, 5, 1, 30, 15, 25, half);
  missile(10, 'hyper-x', 'Hyper-X Rocket', 8, 8, 1, [7, 5], [3.0, 2.5], [120, 180], [100, 150], [20, 30], 1);
  bomb(12, 'fusion-bomb', 'Fusion Bomb', 9, 5, 20, 30, 50);
  beam(13, 'ion-cannon', 'Ion Cannon', 10, 3, 8, 1, 40, 15, 35);
  beam(14, 'heavy-ion-cannon', 'Heavy Ion Cannon', 10, 3, 15, 2, 110, 45, 105, heavy);
  missile(15, 'scatter-pack-v', 'Scatter Pack V', 11, 6, 1, [7, 5], [3.0, 2.5], [180, 270], [115, 170], [50, 80], 5);
  bio(17, 'death-spores', 'Death Spores', 10, 1, 100, 100);
  beam(18, 'mass-driver', 'Mass Driver', 13, 5, 8, 1, 90, 55, 50, half);
  missile(19, 'merculite', 'Merculite Missile', 14, 10, 2, [8, 6], [4.0, 3.0], [130, 195], [105, 155], [20, 30], 1);
  beam(21, 'neutron-blaster', 'Neutron Blaster', 15, 3, 12, 1, 60, 20, 60);
  beam(22, 'heavy-blast-cannon', 'Heavy Blast Cannon', 15, 3, 24, 2, 180, 60, 180, heavy);
  bomb(23, 'anti-matter-bomb', 'Anti-Matter Bomb', 16, 10, 40, 50, 75);
  beam(24, 'graviton-beam', 'Graviton Beam', 17, 1, 15, 1, 60, 20, 50, stream);
  missile(25, 'stinger', 'Stinger Missile', 18, 15, 3, [9, 7], [4.5, 3.5], [190, 270], [155, 230], [30, 45], 1);
  beam(27, 'hard-beam', 'Hard Beam', 19, 8, 12, 1, 120, 50, 100, half);
  beam(28, 'fusion-beam', 'Fusion Beam', 20, 4, 16, 1, 70, 20, 75);
  beam(29, 'heavy-fusion-beam', 'Heavy Fusion Beam', 20, 4, 30, 2, 210, 60, 225, heavy);
  bomb(30, 'omega-v-bomb', 'Omega-V Bomb', 22, 20, 50, 80, 140);
  torpedo(31, 'anti-matter-torpedo', 'Anti-Matter Torpedo', 23, 30, 4, 8, 4.0, 300, 75, 300);
  beam(32, 'megabolt-cannon', 'Megabolt Cannon', 25, 2, 20, 1, 80, 30, 65, { acc: 3, desc: '+3 to hit' });
  beam(33, 'phasor', 'Phasor', 26, 5, 20, 1, 90, 20, 90);
  beam(34, 'heavy-phasor', 'Heavy Phasor', 26, 5, 40, 2, 260, 60, 270, heavy);
  missile(35, 'scatter-pack-vii', 'Scatter Pack VII', 27, 10, 2, [8, 6], [4.0, 3.0], [280, 420], [170, 230], [50, 80], 7);
  bio(37, 'doom-virus', 'Doom Virus', 27, 2, 150, 200);
  beam(38, 'auto-blaster', 'Auto Blaster', 28, 4, 16, 1, 140, 30, 90, { rof: 3, desc: 'fires 3x' });
  missile(39, 'pulson', 'Pulson Missile', 29, 20, 4, [10, 8], [5.0, 4.0], [200, 300], [160, 240], [40, 60], 1);
  beam(41, 'tachyon-beam', 'Tachyon Beam', 30, 1, 25, 1, 90, 30, 70, stream);
  beam(42, 'gauss-autocannon', 'Gauss Autocannon', 32, 7, 10, 1, 280, 105, 105, { rof: 4, flags: { halfShield: true }, desc: '1/2 shields, fires 4x' });
  beam(43, 'particle-beam', 'Particle Beam', 33, 10, 20, 1, 150, 90, 75, half);
  missile(44, 'hercular', 'Hercular Missile', 34, 25, 5, [10, 9], [5.5, 4.5], [260, 390], [220, 330], [40, 60], 1);
  beam(46, 'plasma-cannon', 'Plasma Cannon', 35, 6, 30, 1, 120, 30, 100);
  beam(47, 'disruptor', 'Disruptor', 37, 10, 40, 2, 210, 70, 160, heavy);
  beam(48, 'pulse-phasor', 'Pulse Phasor', 38, 5, 20, 1, 250, 40, 120, { rof: 3, desc: 'fires 3x' });
  bomb(49, 'neutronium-bomb', 'Neutronium Bomb', 39, 40, 70, 90, 200);
  bio(50, 'bio-terminator', 'Bio Terminator', 40, 3, 200, 300);
  torpedo(51, 'hellfire-torpedo', 'Hellfire Torpedo', 40, 25, 6, 10, 5.0, 500, 150, 350, { mul: 4, desc: 'hits all four shields, fires one per 2 turns', flags: { everyOtherRound: true, enveloping: true } });
  missile(52, 'zeon', 'Zeon Missile', 41, 30, 6, [9, 7], [6.0, 5.0], [300, 450], [250, 375], [50, 75], 1);
  torpedo(54, 'proton-torpedo', 'Proton Torpedo', 43, 75, 6, 10, 8.0, 500, 100, 400);
  missile(55, 'scatter-pack-x', 'Scatter Pack X', 44, 15, 3, [10, 10], [4.5, 3.5], [300, 450], [250, 420], [50, 80], 10);
  beam(57, 'tri-focus-plasma-cannon', 'Tri-Focus Plasma Cannon', 45, 20, 50, 1, 250, 70, 180);
  beam(58, 'stellar-converter', 'Stellar Converter', 46, 10, 35, 3, 500, 200, 300, { mul: 4, desc: 'hits all four shields, range 3', flags: { enveloping: true } });
  beam(59, 'mauler-device', 'Mauler Device', 48, 20, 100, 1, 550, 150, 300);
  torpedo(60, 'plasma-torpedo', 'Plasma Torpedo', 50, 150, 7, 10, 6.0, 600, 150, 450, { desc: 'fires one per 2 turns, loses damage with distance', flags: { everyOtherRound: true, damageFade: true } });
  add(61, 'crystal-ray', 'Crystal Ray', 'special', 5, 99, { desc: 'monster weapon: 4 attacks per hit', dmg: [100, 300], range: 3, cost: 600, space: 200, power: 400, mul: 4, flags: { enveloping: true, monster: true } });
  beam(62, 'death-ray', 'Death Ray', 36, 200, 1000, 1, 1000, 2000, 2000, { desc: 'Guardian of Orion treasure' });
  add(63, 'amoeba-stream', 'Amoeba Stream', 'special', 5, 99, { desc: 'monster weapon: streaming', dmg: [250, 1000], range: 3, cost: 600, space: 200, power: 400, flags: { streaming: true, monster: true } });
  WEAPONS.sort((a, b) => a.n - b.n);

  // ---- grant keys (E.grants) and id -> index maps ----------------------------------------------------------------------------------------------
  const tag = (list, kind, fn) => list.forEach(it => { it.grant = kind + ':' + (fn ? fn(it) : it.id); });
  tag(COMPUTERS, 'computer'); tag(ECM, 'ecm'); tag(SHIELDS, 'shield'); tag(ENGINES, 'engine'); tag(SPECIALS, 'special');
  tag(ARMOR, 'armor', it => it.id.replace(/-ii$/, ''));
  WEAPONS.forEach(w => { w.grant = w.flags.monster ? '' : ((w.kind === 'bomb' || w.kind === 'bio') ? 'bomb:' : 'weapon:') + w.id.replace(/-5$/, ''); });
  const idx = {};
  const mk = (name, list) => { const m = {}; list.forEach((it, i) => { m[it.id] = i; }); idx[name] = m; };
  mk('hulls', HULLS); mk('engines', ENGINES); mk('computers', COMPUTERS); mk('ecm', ECM); mk('shields', SHIELDS); mk('armor', ARMOR); mk('specials', SPECIALS); mk('weapons', WEAPONS);

  M.Data.Components = { T50, T25, HULLS, ENGINES, COMPUTERS, ECM, SHIELDS, ARMOR, SPECIALS, WEAPONS, miniCost, miniSpace, idx };
});
