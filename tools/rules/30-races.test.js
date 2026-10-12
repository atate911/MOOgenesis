// Races data (js/data/races.js) vs the verified research/01-races.md: identities (§0.1, §1.1, §3), leader roll tables (§1.5), starting attitudes (§1.4),
// rule hooks (§1.3, §4), AI hooks (§3, §5.4-§5.5, §5.14). Every table below is typed from the research text, independently of the module,
// so a transcription slip on either side fails a test.
// NOTE: research/01 §11 START_REL carries +1 (= +12) on the Darlok/Darlok diagonal while §1.4 shows "-"; the diagonal here is 0 (it is never used).
module.exports = function (M, t) {
  const Races = M.Data.Races;
  const IDS = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  const NAMES = ['Human', 'Mrrshan', 'Silicoid', 'Sakkra', 'Psilon', 'Alkari', 'Klackon', 'Bulrathi', 'Meklar', 'Darlok'];
  const PLURALS = ['Humans', 'Mrrshans', 'Silicoids', 'Sakkras', 'Psilons', 'Alkaris', 'Klackons', 'Bulrathis', 'Meklars', 'Darloks'];     // §0.1
  const HOMEWORLDS = ['Sol', 'Fierias', 'Cryslon', 'Sssla', 'Mentar', 'Altair', 'Kholdan', 'Ursa', 'Meklon', 'Nazin'];                    // §1.1
  const HEADLINES = ['EXPERT TRADERS AND MAGNIFICENT DIPLOMATS', 'SUPERIOR GUNNERS', 'IMMUNE TO HOSTILE PLANET ENVIRONMENTS', 'INCREASED POPULATION GROWTH',
    'SUPERIOR RESEARCH TECHNIQUES', 'SUPERIOR PILOTS', 'INCREASED WORKER PRODUCTION', 'TERRIFIC GROUND FIGHTERS', 'ENHANCED FACTORY CONTROLS', 'SUPREME SPIES'];
  const THEMES = [0x16, 0x14, 0x22, 0x20, 0x1c, 0x12, 0x18, 0x24, 0x1a, 0x1e];                                                           // §11 AUDIENCE_MUSIC

  // §1.5 raw slot tables
  const T1 = [[4, 4, 4, 4, 4, 4, 4, 5, 5, 3], [1, 1, 1, 1, 1, 1, 1, 2, 2, 0], [0, 0, 0, 0, 0, 0, 0, 2, 2, 3], [2, 2, 2, 2, 2, 2, 2, 3, 3, 1], [5, 5, 5, 5, 5, 5, 5, 4, 3, 3],
    [4, 4, 4, 4, 4, 4, 4, 5, 5, 3], [0, 0, 0, 0, 0, 0, 0, 2, 2, 1], [2, 2, 2, 2, 2, 2, 2, 3, 3, 1], [3, 3, 3, 3, 3, 3, 3, 2, 2, 0], [2, 2, 2, 2, 2, 2, 2, 1, 1, 0]];
  const T2 = [[0, 0, 0, 0, 1, 2, 3, 4, 4, 0, 3, 5], [0, 1, 1, 1, 1, 3, 2, 2, 3, 3, 4, 5], [0, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5], [0, 3, 1, 5, 5, 3, 4, 2, 2, 2, 2, 2],
    [0, 0, 3, 1, 2, 3, 3, 3, 3, 4, 4, 5], [0, 1, 1, 1, 2, 2, 2, 3, 4, 2, 3, 5], [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 5, 5], [0, 5, 5, 5, 5, 2, 2, 3, 3, 3, 4, 5],
    [0, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5], [0, 0, 3, 3, 1, 2, 0, 3, 3, 4, 4, 5]];
  // §1.5 decoded odds in percent. Personality order: xenophobic ruthless aggressive erratic honorable pacifistic. Objective: diplomat militarist expansionist technologist industrialist ecologist.
  const P_ODDS = [
    [0, 0, 0, 10, 70, 20],    // Human     Honorable 70, Pacifistic 20, Erratic 10
    [10, 70, 20, 0, 0, 0],    // Mrrshan   Ruthless 70, Aggressive 20, Xenophobic 10
    [70, 0, 20, 10, 0, 0],    // Silicoid  Xenophobic 70, Aggressive 20, Erratic 10
    [0, 10, 70, 20, 0, 0],    // Sakkra    Aggressive 70, Erratic 20, Ruthless 10
    [0, 0, 0, 20, 10, 70],    // Psilon    Pacifistic 70, Erratic 20, Honorable 10
    [0, 0, 0, 10, 70, 20],    // Alkari    Honorable 70, Pacifistic 20, Erratic 10
    [70, 10, 20, 0, 0, 0],    // Klackon   Xenophobic 70, Aggressive 20, Ruthless 10
    [0, 10, 70, 20, 0, 0],    // Bulrathi  Aggressive 70, Erratic 20, Ruthless 10
    [10, 0, 20, 70, 0, 0],    // Meklar    Erratic 70, Aggressive 20, Xenophobic 10
    [10, 20, 70, 0, 0, 0],    // Darlok    Aggressive 70, Ruthless 20, Xenophobic 10
  ];
  const O_ODDS = [
    [41.7, 8.3, 8.3, 16.7, 16.7, 8.3], [8.3, 33.3, 16.7, 25.0, 8.3, 8.3], [8.3, 8.3, 33.3, 25.0, 16.7, 8.3], [8.3, 8.3, 41.7, 16.7, 8.3, 16.7],
    [16.7, 8.3, 8.3, 41.7, 16.7, 8.3], [8.3, 25.0, 33.3, 16.7, 8.3, 8.3], [8.3, 16.7, 16.7, 16.7, 8.3, 33.3], [8.3, 0, 16.7, 25.0, 8.3, 41.7],
    [8.3, 8.3, 16.7, 25.0, 33.3, 8.3], [25.0, 8.3, 8.3, 33.3, 16.7, 8.3],
  ];
  // §11 START_REL in units of 12 DP (diagonal 0, see NOTE above)
  const REL12 = [[0, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 0, -2, 0, -3, -1, -1, 0, -1], [1, 0, 0, 0, 0, 0, -1, 0, 1, -1], [1, -2, 0, 0, 0, -1, -1, 0, -1, -1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, -1], [1, -3, 0, -1, 0, 0, -1, 0, 0, -1], [1, -1, -1, -1, 0, -1, 0, 0, 0, -1], [1, -1, 0, 0, 0, 0, 0, 0, 0, -1],
    [1, 0, 1, -1, 0, 0, 0, 0, 0, -1], [1, -1, -1, -1, -1, -1, -1, -1, -1, 0]];
  // §1.2 research cost percent per field [computers construction forcefields planetology propulsion weapons]
  const COST = [[100, 100, 60, 80, 80, 100], [100, 125, 100, 100, 100, 60], [80, 125, 125, 125, 125, 125], [100, 100, 100, 60, 100, 100], [80, 80, 80, 80, 80, 80],
    [100, 100, 125, 100, 60, 100], [100, 60, 100, 100, 125, 100], [125, 80, 100, 100, 100, 80], [60, 100, 100, 125, 100, 100], [80, 100, 100, 100, 100, 100]];
  // §3 leader pools and exact ship names (3 per hull Small, Medium, Large, Huge)
  const LEADERS = [
    ['Alexander', 'Strader', 'Durash IV', 'Johann III', 'Caesar', 'Bladrov II'], ['Jasana', 'Prrsha', 'Yalara', 'Miamar', 'Shandra', 'Mirana'],
    ['Igneous', 'Geode', 'Sedimen', 'Crystous', 'Granid', 'Carnax'], ['Guanar', 'Tyranid', 'Saurak', 'Sauron', 'Hissa', 'Kryssta'],
    ['Meson', 'Kelvan', 'Quark', 'Zygot', 'Tachaon', 'Amios'], ['Skylord', 'Sharpclaw', 'Redwing', 'Farseer', 'Highsoar', 'Ariel'],
    ['Ixitixl', 'Kikitik', 'Klaquan', 'Kaxal', "K'kalak", 'Xantak'], ['Monch', 'Durpp', 'Grunk', 'Bullux', 'Smurch', 'Krungo'],
    ['CB-715', 'QX-537', 'INT-986', 'TVC-15', 'TX-1138', 'M5-35'], ['Nazgur', 'Narzina', 'Morfane', 'Shador', "Dar'Quan", 'Ssithra'],
  ];
  const SHIPS = [
    'FIGHTER GUNBOAT COURIER|FRIGATE DESTROYER CORVETTE|CRUISER ESCORT WARSHIP|DREADNOUGHT BATTLESHIP DREADSTAR',
    'WOLVERINE GRIFFIN FERRET|LYNX CHEETAH BOBCAT|PANTHER LEOPARD WARCAT|SABRETOOTH PUMA TIGER',
    'PIRANHA STINGRAY MINNOW|MANTA BARRACUDA MOREY|SHARK MAKO WHALE|KRAKEN MONITOR POLARIS',
    'GOBLIN CYCLOPS DAEMON|BANSHEE SPECTRE SPIRIT|JUGGERNAUT VALKYRIE HYDRA|TITAN COLOSSUS DRAGON',
    'STARFIGHTER COMET SEEKER|STAR WING,STAR BLAZER,STAR STREAK|STAR BLADE,DARK STAR,CORAONA|SUN FIRE,STAR FURY,NOVA',
    'FOXBAT SPARROWHAWK PELICAN|FALCON,SKY HAWK,SPACE GULL|WARBIRD WARHAWK WAREAGLE|CONDOR,DREADWING,SKY MASTER',
    'SABRE CUTLASS DAGGER|LANCER PEGASUS HORSEMAN|RANGER KNIGHT AVENGER|DRAGOON PALADIN EXCALIBER',
    'PAW PANDA PATROL|HUNTER GLADIATOR SENTINEL|CLAW TOOTH WARBEAR|GRIZZLY PUNISHER RHINO',
    'MARAUDER HYPERION DRACHMA|INTRUDER PENETRATOR TORMENTER|AJAX TORNADO NEXUS|NEMESIS DEVASTATOR ANNIHILATOR',
    'SPIDER BUMBLEBEE NEEDLE|HORNET SCORPION VENOM|TARANTULA VIPER COBRA|KING COBRA,BLACK WIDOW,DEATH WYN',
  ];

  // rule hooks expected per race (everything not listed keeps the neutral default)
  const MOD_DEFAULT = {
    tradePts: 0, posActMul: 1, tributeMul: 1, aiMoodBonus: 0, councilBonus: 0, compLevel: 0, initiative: 0, defense: 0, misDefense: 0, groundBonus: 0,
    workerMul: 1, operBonus: 0, noRefit: false, researchMul: 1, growthMul: 1, ecoGrowthMul: 1, popCost: [1, 1], spyCostMul: 1, spyOff: 0, spyDef: 0,
    allTerrain: false, noWaste: false, halfGrowth: false, noPlague: false, noAccident: false, noSoil: false,
  };
  const MOD = {
    human: { tradePts: 25, posActMul: 2, tributeMul: 2, aiMoodBonus: 50, councilBonus: 20 },
    mrrshan: { compLevel: 4, initiative: 4 },
    silicoid: { allTerrain: true, noWaste: true, halfGrowth: true, noPlague: true, noAccident: true, noSoil: true },
    sakkra: { growthMul: 2, ecoGrowthMul: 2, popCost: [2, 3] },
    psilon: { researchMul: 1.5 },
    alkari: { defense: 3, misDefense: 3, initiative: 3 },
    klackon: { workerMul: 2 },
    bulrathi: { groundBonus: 25 },
    meklar: { operBonus: 2, noRefit: true },
    darlok: { spyCostMul: 0.5, spyOff: 30, spyDef: 20 },
  };
  const AI_DEFAULT = {
    hull: 0, shipSlider: 0, indSlider: 0, techSlider: 0, ecoSlider: { add: 0, belowMp2: false }, researchFocus: null, researchFocusFields: [],
    autoResolveWeight: 0, autoResolveWeightPlus: 0, invasionMul: 1, invasionMulPlus: 1, alwaysSpy: false, spyRating: 0, proposeBonus: 0,
  };
  const AI = {
    human: { proposeBonus: 50 },
    mrrshan: { shipSlider: 15, researchFocus: 'weapons', researchFocusFields: [5], autoResolveWeight: 15, autoResolveWeightPlus: 20 },
    silicoid: { hull: 3 },
    sakkra: { ecoSlider: { add: 10, belowMp2: true }, researchFocus: 'planetology', researchFocusFields: [3] },
    psilon: { techSlider: 20, spyRating: 10 },
    alkari: { hull: -3, researchFocus: 'propulsion', researchFocusFields: [4], autoResolveWeight: 15 },
    klackon: { hull: -3, ecoSlider: { add: 15, belowMp2: true } },
    bulrathi: { hull: 3, ecoSlider: { add: 10, belowMp2: true }, researchFocus: 'weapons', researchFocusFields: [5], invasionMul: 1.2, invasionMulPlus: 2.15 },
    meklar: { hull: 3, indSlider: 20, researchFocus: 'construction/planetology', researchFocusFields: [1, 3] },
    darlok: { researchFocus: 'computers', researchFocusFields: [0], alwaysSpy: true, spyRating: 30 },
  };

  const rec = id => Races.races[id];
  const sum = a => a.reduce((x, y) => x + y, 0);
  // JSON with sorted object keys: comparisons must not depend on key order
  const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  const merged = (defaults, over) => Object.assign(JSON.parse(JSON.stringify(defaults)), over);
  const decode = (row, n) => { const c = new Array(n).fill(0); row.forEach(v => { c[v]++; }); return c.map(x => x / row.length * 100); };

  // ---- identity ------------------------------------------------------------------------------------------------------------------
  t.test('ten races in the original data order, exported as Data.Races / Data.races / Data.raceList', () => {
    t.deep(Races.ORDER, IDS); t.eq(M.Data.raceList, Races.ORDER); t.eq(M.Data.races, Races.races);
    t.eq(Races.ORDER.length, 10); t.eq(Races.list.length, 10); t.eq(Object.keys(Races.races).length, 10);
    IDS.forEach((id, i) => {
      const r = rec(id);
      t.eq(r.id, id); t.eq(r.idx, i, id + ' idx'); t.eq(r.name, NAMES[i]); t.eq(r.adj, NAMES[i]); t.eq(r.plural, PLURALS[i]); t.eq(Races.list[i], r);
      t.eq(r.homeworld, HOMEWORLDS[i]); t.eq(r.audienceTheme, THEMES[i], id + ' audience theme');
    });
    t.eq(new Set(IDS.map(id => rec(id).name)).size, 10, 'names are unique');
    t.eq(new Set(IDS.map(id => rec(id).plural)).size, 10, 'plurals are unique');
  });

  t.test('personality / objective enums use the research index order', () => {
    t.deep(Races.PERSONALITIES, ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic']);
    t.deep(Races.OBJECTIVES, ['diplomat', 'militarist', 'expansionist', 'technologist', 'industrialist', 'ecologist']);
  });

  // ---- leader roll tables (§1.5) ------------------------------------------------------------------------------------------------
  t.test('TRAIT1 has 10 slots and TRAIT2 12 slots per race, values in range, and they equal the raw research tables', () => {
    t.deep(Object.keys(Races.TRAIT1), IDS); t.deep(Object.keys(Races.TRAIT2), IDS);
    IDS.forEach((id, i) => {
      t.eq(Races.TRAIT1[id].length, 10, id + ' trait1 slots'); t.eq(Races.TRAIT2[id].length, 12, id + ' trait2 slots');
      Races.TRAIT1[id].forEach(v => t.ok(Number.isInteger(v) && v >= 0 && v <= 5, id + ' trait1 value ' + v));
      Races.TRAIT2[id].forEach(v => t.ok(Number.isInteger(v) && v >= 0 && v <= 5, id + ' trait2 value ' + v));
      t.deep(Races.TRAIT1[id], T1[i], id + ' trait1'); t.deep(Races.TRAIT2[id], T2[i], id + ' trait2');
    });
  });

  t.test('personality decode reproduces the §1.5 percentages for every race', () => {
    IDS.forEach((id, i) => {
      const pct = decode(Races.TRAIT1[id], 6);
      t.near(sum(pct), 100, 1e-9, id + ' total');
      pct.forEach((p, k) => t.near(p, P_ODDS[i][k], 1e-9, id + ' ' + Races.PERSONALITIES[k]));
    });
    const h = decode(Races.TRAIT1.human, 6);
    t.eq(h[4], 70); t.eq(h[5], 20); t.eq(h[3], 10);                                      // Human: honorable 70 / pacifistic 20 / erratic 10
    const modal = (tbl, names, id) => { const c = decode(tbl[id], 6); return names[c.indexOf(Math.max(...c))]; };
    // the default (most likely) personality: the one thing [1oom], [OSG] and [SW] all agree on; Meklar is the only race normally led by an erratic emperor
    t.deep(IDS.map(id => modal(Races.TRAIT1, Races.PERSONALITIES, id)), ['honorable', 'ruthless', 'xenophobic', 'aggressive', 'pacifistic', 'honorable', 'xenophobic', 'aggressive', 'erratic', 'aggressive']);
    IDS.forEach(id => t.eq(Math.max(...decode(Races.TRAIT1[id], 6)), 70, id + ' has a 70% default personality'));
  });

  t.test('objective decode reproduces the §1.5 percentages for every race (e.g. Mrrshan militarist 33.3%, Bulrathi militarist 0%)', () => {
    IDS.forEach((id, i) => {
      const pct = decode(Races.TRAIT2[id], 6);
      t.near(sum(pct), 100, 1e-9, id + ' total');
      pct.forEach((p, k) => t.near(p, O_ODDS[i][k], 0.05, id + ' ' + Races.OBJECTIVES[k]));
    });
    t.near(decode(Races.TRAIT2.mrrshan, 6)[1], 33.3, 0.05);
    t.eq(decode(Races.TRAIT2.bulrathi, 6)[1], 0);
    t.near(decode(Races.TRAIT2.human, 6)[0], 41.7, 0.05);
    // most likely objective per race ([1oom]; [OSG]/[SW] name Militarist for Alkari, Industrialist for Klackon and Diplomat for Darlok instead - see races.js NOTE 4)
    const modal = id => { const c = decode(Races.TRAIT2[id], 6); return Races.OBJECTIVES[c.indexOf(Math.max(...c))]; };
    t.deep(IDS.map(modal), ['diplomat', 'militarist', 'expansionist', 'expansionist', 'technologist', 'expansionist', 'ecologist', 'ecologist', 'industrialist', 'technologist']);
  });

  t.test('Monte-Carlo: 20,000 rollPersonality draws per race match the table shares within ±2 points', () => {
    const N = 20000;
    IDS.forEach((id, i) => {
      const R = M.RNG.create('personality:' + id), n = new Array(6).fill(0);
      for (let k = 0; k < N; k++) n[Races.rollPersonality(R, id)]++;
      t.eq(sum(n), N, id + ': every draw is a valid personality index');
      n.forEach((c, p) => t.near(c / N * 100, P_ODDS[i][p], 2, id + ' ' + Races.PERSONALITIES[p]));
    });
  });

  t.test('Monte-Carlo: 20,000 rollObjective draws per race match the table shares within ±2 points', () => {
    const N = 20000;
    IDS.forEach((id, i) => {
      const R = M.RNG.create('objective:' + id), n = new Array(6).fill(0);
      for (let k = 0; k < N; k++) n[Races.rollObjective(R, id)]++;
      t.eq(sum(n), N, id + ': every draw is a valid objective index');
      n.forEach((c, p) => t.near(c / N * 100, O_ODDS[i][p], 2, id + ' ' + Races.OBJECTIVES[p]));
    });
  });

  t.test('rolls take one R.int draw each (slot index = the draw), accept id / index / record, and reject unknown races', () => {
    IDS.forEach((id, i) => {
      const a = M.RNG.create('slots:' + id), b = M.RNG.create('slots:' + id);
      for (let k = 0; k < 40; k++) {
        t.eq(Races.rollPersonality(a, id), T1[i][b.int(0, 9)], id + ' personality slot');
        t.eq(Races.rollObjective(a, id), T2[i][b.int(0, 11)], id + ' objective slot');
      }
      t.deep(a.state(), b.state(), id + ': RNG state advanced by exactly the same draws');
    });
    const r1 = M.RNG.create('forms'), r2 = M.RNG.create('forms'), r3 = M.RNG.create('forms');
    const x = Races.rollPersonality(r1, 'sakkra'), y = Races.rollPersonality(r2, 3), z = Races.rollPersonality(r3, rec('sakkra'));
    t.eq(x, y); t.eq(x, z);
    t.throws(() => Races.rollPersonality(M.RNG.create(1), 'zorg')); t.throws(() => Races.rollObjective(M.RNG.create(1), 10)); t.throws(() => Races.rollObjective(M.RNG.create(1), undefined));
    const u = M.RNG.create('unchanged'), before = u.state().join(',');
    try { Races.rollPersonality(u, 'zorg'); } catch (e) { /* expected */ }
    t.eq(u.state().join(','), before, 'a failed lookup must not consume randomness');
  });

  // ---- starting attitudes (§1.4) -------------------------------------------------------------------------------------------------
  t.test('RELATIONS is the 10x10 §1.4 matrix: symmetric, diagonal 0, multiples of 12 in -36..+12', () => {
    const R = Races.RELATIONS;
    t.eq(R.length, 10);
    for (let i = 0; i < 10; i++) {
      t.eq(R[i].length, 10);
      t.eq(R[i][i], 0, 'diagonal ' + IDS[i]);
      for (let j = 0; j < 10; j++) {
        t.eq(R[i][j], REL12[i][j] * 12, IDS[i] + ' -> ' + IDS[j]);
        t.eq(R[i][j], R[j][i], 'symmetry ' + IDS[i] + '/' + IDS[j]);
        t.eq(R[i][j] % 12, 0); t.between(R[i][j], -36, 12);
      }
    }
  });

  t.test('attitude facts: Human +12 with everybody, Darlok -12 with everybody else, Alkari-Mrrshan -36, Mrrshan-Sakkra -24, Silicoid-Meklar +12', () => {
    const R = Races.RELATIONS, ix = id => IDS.indexOf(id);
    for (let j = 1; j < 10; j++) { t.eq(R[0][j], 12, 'Human row'); t.eq(R[j][0], 12, 'Human column'); }
    for (let j = 1; j < 9; j++) { t.eq(R[9][j], -12, 'Darlok row'); t.eq(R[j][9], -12, 'Darlok column'); }
    t.eq(R[ix('alkari')][ix('mrrshan')], -36); t.eq(R[ix('mrrshan')][ix('alkari')], -36);
    t.eq(R[ix('mrrshan')][ix('sakkra')], -24); t.eq(R[ix('sakkra')][ix('mrrshan')], -24);
    t.eq(R[ix('silicoid')][ix('meklar')], 12); t.eq(R[ix('meklar')][ix('sakkra')], -12);
    t.eq(R[ix('silicoid')][ix('klackon')], -12, '[1oom] unease, not the [OSG] "relaxed"');
    IDS.forEach((id, i) => { if (id !== 'human' && id !== 'darlok') t.eq(R[i][ix('psilon')], 0, id + ' is neutral toward Psilon'); });
    t.deep(IDS.map((id, i) => R[i].filter(v => v < 0).length), [0, 5, 2, 5, 1, 4, 5, 2, 2, 8], 'how many races each one starts uneasy-or-worse with (Mrrshan: five)');
  });

  t.test('startRelations mirrors each RELATIONS row, keyed by race id', () => {
    IDS.forEach((id, i) => {
      t.deep(Object.keys(rec(id).startRelations), IDS, id + ' keys');
      IDS.forEach((o, j) => t.eq(rec(id).startRelations[o], Races.RELATIONS[i][j], id + ' -> ' + o));
    });
  });

  // ---- rule hooks (§1.3, §4) -----------------------------------------------------------------------------------------------------
  t.test('mod hooks equal the §1.3 values and nothing else deviates from the neutral default', () => {
    t.eq(canon(Races.MOD_DEFAULTS), canon(MOD_DEFAULT));
    IDS.forEach(id => t.eq(canon(rec(id).mod), canon(merged(MOD_DEFAULT, MOD[id])), id + ' mod'));
  });

  t.test('headline numbers: Bulrathi 25, Mrrshan 4, Alkari 3, Human 25, Darlok halving/+30/+20, Klackon x2, Meklar +2, Psilon 1.5, Sakkra 2', () => {
    t.eq(rec('bulrathi').mod.groundBonus, 25);
    t.eq(rec('mrrshan').mod.compLevel, 4); t.eq(rec('mrrshan').mod.initiative, 4);
    t.eq(rec('alkari').mod.defense, 3); t.eq(rec('alkari').mod.misDefense, 3); t.eq(rec('alkari').mod.initiative, 3);
    t.eq(rec('human').mod.tradePts, 25); t.eq(rec('human').mod.posActMul, 2); t.eq(rec('human').mod.councilBonus, 20); t.eq(rec('human').mod.aiMoodBonus, 50);
    t.eq(rec('darlok').mod.spyCostMul, 0.5); t.eq(rec('darlok').mod.spyOff, 30); t.eq(rec('darlok').mod.spyDef, 20);
    t.eq(rec('klackon').mod.workerMul, 2); t.eq(rec('meklar').mod.operBonus, 2); t.eq(rec('psilon').mod.researchMul, 1.5); t.eq(rec('sakkra').mod.growthMul, 2);
  });

  t.test('Mrrshan initiative is the complevel term (no double counting); only Alkari carries an explicit extra initiative', () => {
    IDS.forEach(id => { const m = rec(id).mod; if (id === 'mrrshan') t.eq(m.initiative - m.compLevel, 0); else if (id === 'alkari') t.eq(m.initiative - m.compLevel, 3); else t.eq(m.initiative, 0, id); });
  });

  t.test('Sakkra: x2 natural and ecology growth, pop price x2/3 stays exact in integers (20/10/5 -> 13/6/3)', () => {
    const m = rec('sakkra').mod, cost = base => Math.floor(base * m.popCost[0] / m.popCost[1]);
    t.eq(m.ecoGrowthMul, 2); t.deep([cost(20), cost(10), cost(5)], [13, 6, 3]);
    IDS.filter(id => id !== 'sakkra').forEach(id => { const p = rec(id).mod.popCost; t.deep(p, [1, 1]); t.eq(Math.floor(20 * p[0] / p[1]), 20); });
  });

  t.test('Psilon research x1.5 equals the original integer rule v + v/2', () => {
    const k = rec('psilon').mod.researchMul;
    for (let v = 0; v <= 2000; v++) t.eq(Math.floor(v * k), v + Math.floor(v / 2));
  });

  t.test('Silicoid is the only race with environment flags; every other race has them all off', () => {
    const FLAGS = ['allTerrain', 'noWaste', 'halfGrowth', 'noPlague', 'noAccident', 'noSoil'];
    IDS.forEach(id => FLAGS.forEach(f => t.eq(rec(id).mod[f], id === 'silicoid', id + '.' + f)));
    t.eq(rec('silicoid').mod.growthMul, 1, 'halfGrowth is its own flag: growthMul must not halve a second time');
  });

  t.test('every record carries the full mod / ai key set with its own (unshared) arrays and objects', () => {
    const seen = new Set();
    IDS.forEach(id => {
      t.deep(Object.keys(rec(id).mod).sort(), Object.keys(MOD_DEFAULT).sort(), id + ' mod keys');
      t.deep(Object.keys(rec(id).ai).sort(), Object.keys(AI_DEFAULT).sort(), id + ' ai keys');
      [rec(id).mod.popCost, rec(id).ai.ecoSlider, rec(id).ai.researchFocusFields, rec(id).startRelations].forEach(o => seen.add(o));
    });
    t.eq(seen.size, 40, 'no array/object is shared between races');
    t.ok(!seen.has(Races.MOD_DEFAULTS.popCost) && !seen.has(Races.AI_DEFAULTS.ecoSlider));
  });

  // ---- AI hooks (§3 bullets, §5.4, §5.5, §5.14) ----------------------------------------------------------------------------------
  t.test('AI hooks equal the research values and nothing else deviates from the neutral default', () => {
    t.eq(canon(Races.AI_DEFAULTS), canon(AI_DEFAULT));
    IDS.forEach(id => t.eq(canon(rec(id).ai), canon(merged(AI_DEFAULT, AI[id])), id + ' ai'));
  });

  t.test('AI hull modifiers: Silicoid/Bulrathi/Meklar +3, Alkari/Klackon -3, the other five 0; slider bonuses Mrrshan ship 15, Meklar ind 20, Psilon tech 20, eco 10/10/15', () => {
    const hull = IDS.map(id => rec(id).ai.hull);
    t.deep(hull, [0, 0, 3, 0, 0, -3, -3, 3, 3, 0]);
    t.eq(rec('mrrshan').ai.shipSlider, 15); t.eq(rec('meklar').ai.indSlider, 20); t.eq(rec('psilon').ai.techSlider, 20);
    t.eq(rec('bulrathi').ai.ecoSlider.add, 10); t.eq(rec('sakkra').ai.ecoSlider.add, 10); t.eq(rec('klackon').ai.ecoSlider.add, 15);
    IDS.forEach(id => t.eq(rec(id).ai.ecoSlider.belowMp2, ['bulrathi', 'sakkra', 'klackon'].indexOf(id) >= 0, id));
  });

  t.test('research focus: Bulrathi/Mrrshan weapons, Darlok computers, Meklar construction-or-planetology, Alkari propulsion, Sakkra planetology, others none', () => {
    const FOCUS = { human: null, mrrshan: 'weapons', silicoid: null, sakkra: 'planetology', psilon: null, alkari: 'propulsion', klackon: null, bulrathi: 'weapons', meklar: 'construction/planetology', darlok: 'computers' };
    const NAME_OF = ['computers', 'construction', 'forcefields', 'planetology', 'propulsion', 'weapons'];
    IDS.forEach(id => {
      const a = rec(id).ai;
      t.eq(a.researchFocus, FOCUS[id], id);
      t.eq(a.researchFocusFields.map(f => NAME_OF[f]).join('/'), FOCUS[id] || '', id + ' field indices');
    });
  });

  t.test('auto-resolve weight +15 for Mrrshan and Alkari only; Bulrathi AI invasion estimate x1.2 (x2.15 Classic+); Darlok AI always spies', () => {
    IDS.forEach(id => t.eq(rec(id).ai.autoResolveWeight, id === 'mrrshan' || id === 'alkari' ? 15 : 0, id));
    t.eq(rec('mrrshan').ai.autoResolveWeightPlus, 20);
    t.eq(rec('bulrathi').ai.invasionMul, 1.2); t.eq(rec('bulrathi').ai.invasionMulPlus, 2.15);
    IDS.forEach(id => t.eq(rec(id).ai.alwaysSpy, id === 'darlok', id));
    t.eq(rec('psilon').ai.spyRating, 10); t.eq(rec('darlok').ai.spyRating, 30);
  });

  // ---- names and presentation ----------------------------------------------------------------------------------------------------
  t.test('every race has six leaders (the §3 pool, unique across all races) and twelve ship names (3 per hull, the §3 lists)', () => {
    const all = new Set();
    IDS.forEach((id, i) => {
      const r = rec(id);
      t.deep(r.leaders, LEADERS[i], id + ' leaders'); t.eq(r.leaders.length, 6);
      r.leaders.forEach(n => { t.ok(n.length >= 3 && n.length <= 11, id + ' leader "' + n + '" fits the 11-character name field'); all.add(n.toLowerCase()); });
      t.eq(r.shipNames.length, 12, id + ' ship names'); t.eq(new Set(r.shipNames).size, 12, id + ' ship names unique');
      const exp = SHIPS[i].split('|').map(g => (g.indexOf(',') >= 0 ? g.split(',') : g.split(' '))).reduce((a, b) => a.concat(b), []);
      t.deep(r.shipNames.map(s => s.toUpperCase()), exp, id + ' ship names');
      r.shipNames.forEach(s => t.ok(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/.test(s), id + ' "' + s + '" is Title Case'));
    });
    t.eq(all.size, 60, 'leader names are unique across races');
  });

  t.test('New Game text: tagline <= 6 words and a paraphrase, 1-2 sentence description, 2-4 traits with label/text/good incl. a weakness', () => {
    IDS.forEach((id, i) => {
      const r = rec(id), words = r.tagline.trim().split(/\s+/).length;
      t.between(words, 2, 6, id + ' tagline words'); t.ok(/^[A-Z]/.test(r.tagline) && !/[.!?]$/.test(r.tagline), id + ' tagline is sentence case without a full stop');
      t.ok(r.tagline.toLowerCase() !== HEADLINES[i].toLowerCase(), id + ' tagline must paraphrase, not copy, the headline');
      const sentences = (r.desc.match(/[.!?](\s|$)/g) || []).length;
      t.between(sentences, 1, 2, id + ' desc sentences'); t.ok(r.desc.length >= 60 && r.desc.length <= 330, id + ' desc length ' + r.desc.length);
      t.between(r.traits.length, 2, 4, id + ' traits');
      r.traits.forEach(tr => {
        t.ok(typeof tr.label === 'string' && tr.label.length >= 3 && tr.label.length <= 28, id + ' label "' + tr.label + '"');
        t.ok(typeof tr.text === 'string' && tr.text.length >= 12 && tr.text.length <= 140, id + ' text length ' + tr.text.length);
        t.eq(typeof tr.good, 'boolean');
      });
      t.ok(r.traits.some(x => x.good) && r.traits.some(x => !x.good), id + ' lists strengths and weaknesses');
      t.eq(new Set(r.traits.map(x => x.label)).size, r.traits.length, id + ' trait labels unique');
    });
  });

  t.test('art palettes are #rrggbb, primary colours are distinct per race', () => {
    IDS.forEach(id => {
      const a = rec(id).art;
      t.ok(/^#[0-9a-f]{6}$/.test(a.primary) && /^#[0-9a-f]{6}$/.test(a.secondary), id + ' palette');
      t.ok(a.primary !== a.secondary, id + ' secondary differs');
    });
    t.eq(new Set(IDS.map(id => rec(id).art.primary)).size, 10);
  });

  // ---- the prose must not contradict the numbers ---------------------------------------------------------------------------------
  const FIELD_RX = [/comput/i, /construct/i, /force[- ]?field/i, /planetolog/i, /propuls/i, /weapon/i];
  const ALL6 = [0, 1, 2, 3, 4, 5];
  function costClaims(r) {                     // field index -> 'less40' | 'less20' | 'more25', read back out of the trait texts
    const out = {};
    r.traits.forEach(tr => tr.text.split(/[;,]|\.(?!\d)/).forEach(clause => {
      const m = /(\d+)% (less|more)/.exec(clause);
      if (!m) return;
      let f = ALL6.filter(i => FIELD_RX[i].test(clause));
      if (/all fields/i.test(clause)) f = ALL6; else if (/every other field/i.test(clause)) f = ALL6.filter(i => !(i in out));
      f.forEach(i => { out[i] = m[2] + m[1]; });
    }));
    return out;
  }
  const costExpect = row => { const o = {}; row.forEach((p, i) => { if (p < 100) o[i] = 'less' + (100 - p); else if (p > 100) o[i] = 'more' + (p - 100); }); return o; };

  t.test('trait texts state exactly the research-cost advantages and penalties of the §1.2 table (60 -> 40% less, 80 -> 20% less, 125 -> 25% more)', () => {
    IDS.forEach((id, i) => t.eq(canon(costClaims(rec(id))), canon(costExpect(COST[i])), id + ' cost claims'));
  });

  t.test('trait texts quote the numbers of their mod hooks', () => {
    const text = id => rec(id).traits.map(x => x.text).join(' ');
    const m = id => rec(id).mod;
    t.ok(text('human').indexOf(String(m('human').tradePts)) >= 0 && /double/.test(text('human')));
    t.ok(text('mrrshan').indexOf('+' + m('mrrshan').compLevel * 10 + ' to hit') >= 0 && text('mrrshan').indexOf('+' + m('mrrshan').initiative + ' initiative') >= 0 && /four levels/.test(text('mrrshan')));
    t.ok(text('alkari').indexOf('-' + m('alkari').defense * 10) >= 0 && /three levels/.test(text('alkari')) && /three steps/.test(text('alkari')));
    t.ok(text('bulrathi').indexOf('+' + m('bulrathi').groundBonus) >= 0);
    t.ok(text('darlok').indexOf('+' + m('darlok').spyOff) >= 0 && text('darlok').indexOf('+' + m('darlok').spyDef) >= 0 && /half/.test(text('darlok')));
    t.ok(/twice/.test(text('klackon')) && /twice/.test(text('sakkra')) && /two more factories/.test(text('meklar')) && /no refit/.test(text('meklar')));
    t.ok(text('psilon').indexOf('×' + m('psilon').researchMul) >= 0 && /any planet/.test(text('silicoid')));
  });

  t.test('data/techs.js research costs agree with the research table (skips until techs.js is present)', () => {
    const T = M.Data.Techs;
    if (!T || !T.RACE_COST_MUL || typeof T.costAI !== 'function' || typeof T.costHuman !== 'function') t.skip('data/techs.js not loaded');
    IDS.forEach((id, i) => {
      t.deep(T.FIELD_CODES.map(c => T.RACE_COST_MUL[id][c]), COST[i], id + ' cost multipliers');
      for (let f = 0; f < 6; f++) {
        t.eq(T.costAI(10, id, f), 20 * COST[i][f], id + ' AI level-10 cost, field ' + f);
        t.eq(T.costHuman(10, id, f, 2), 30 * COST[i][f], id + ' human level-10 cost at Average, field ' + f);
      }
    });
  });

  // ---- plumbing ------------------------------------------------------------------------------------------------------------------
  t.test('JSON-safe: only finite numbers, strings, booleans, null, arrays and plain objects', () => {
    const bad = [];
    const walk = (v, path) => {
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
      if (typeof v === 'number') { if (!isFinite(v)) bad.push(path); return; }
      if (typeof v === 'object') { Object.keys(v).forEach(k => walk(v[k], path + '.' + k)); return; }
      bad.push(path + ' (' + typeof v + ')');
    };
    ['races', 'TRAIT1', 'TRAIT2', 'RELATIONS', 'MOD_DEFAULTS', 'AI_DEFAULTS', 'ORDER', 'PERSONALITIES', 'OBJECTIVES'].forEach(k => walk(Races[k], k));
    t.deep(bad, []);
    t.eq(canon(JSON.parse(JSON.stringify(Races.races))), canon(Races.races));
  });

  t.test('worker-safe: the source registered by MOO.def runs against a bare namespace and rebuilds identical data', () => {
    const src = M.__defs.find(s => s.indexOf('M.Data.Races = {') >= 0);
    t.ok(src, 'js/data/races.js must be a MOO.def module');
    const bare = { Data: {} };
    new Function('M', '(' + src + ')(M);')(bare);
    const B = bare.Data.Races;
    t.eq(canon(B.races), canon(Races.races)); t.eq(canon(B.TRAIT1), canon(Races.TRAIT1)); t.eq(canon(B.TRAIT2), canon(Races.TRAIT2)); t.eq(canon(B.RELATIONS), canon(Races.RELATIONS));
    t.eq(bare.Data.raceList, B.ORDER); t.eq(bare.Data.races, B.races);
    const r = M.RNG.create('worker'), r2 = M.RNG.create('worker');
    t.eq(B.rollPersonality(r, 'darlok'), Races.rollPersonality(r2, 'darlok'));
  });
};
