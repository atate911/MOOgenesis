// Technology tree (js/data/techs.js) and research system (js/sim/research.js) vs research/02-technology.md.
// The tables below are independent copies of the document (Appendix A/B/C, §1.5, §1.7, §3 component levels) so a typo in the data module cannot hide behind itself.
module.exports = function (M, t) {
  const T = M.Data.Techs, Rs = M.Sim.Research;
  const CODES = ['CM', 'CN', 'FF', 'PL', 'PR', 'WE'];

  // research/02 Appendix A (field,level,tier,name,type): the machine-readable source list (the Death Ray is omitted there)
  const APPENDIX_A = `
CM,1,1,Battle Computer Mark I,computer
CM,1,1,Robotic Controls II,industry
CM,1,1,Battle Scanner,special
CM,2,1,ECM Jammer Mark I,ecm
CM,4,1,Deep Space Scanner,scanner
CM,5,1,Battle Computer Mark II,computer
CM,7,2,ECM Jammer Mark II,ecm
CM,8,2,Improved Robotic Controls III,industry
CM,10,2,Battle Computer Mark III,computer
CM,12,3,ECM Jammer Mark III,ecm
CM,13,3,Improved Space Scanner,scanner
CM,15,3,Battle Computer Mark IV,computer
CM,17,4,ECM Jammer Mark IV,ecm
CM,18,4,Improved Robotic Controls IV,industry
CM,20,4,Battle Computer Mark V,computer
CM,22,5,ECM Jammer Mark V,ecm
CM,23,5,Advanced Space Scanner,scanner
CM,25,5,Battle Computer Mark VI,computer
CM,27,6,ECM Jammer Mark VI,ecm
CM,28,6,Improved Robotic Controls V,industry
CM,30,6,Battle Computer Mark VII,computer
CM,32,7,ECM Jammer Mark VII,ecm
CM,34,7,Hyperspace Communications,special
CM,35,7,Battle Computer Mark VIII,computer
CM,37,8,ECM Jammer Mark VIII,ecm
CM,38,8,Improved Robotic Controls VI,industry
CM,40,8,Battle Computer Mark IX,computer
CM,42,9,ECM Jammer Mark IX,ecm
CM,45,9,Battle Computer Mark X,computer
CM,46,10,Oracle Interface,special
CM,47,10,ECM Jammer Mark X,ecm
CM,48,10,Improved Robotic Controls VII,industry
CM,49,10,Technology Nullifier,special
CM,50,10,Battle Computer Mark XI,computer
CN,1,1,Titanium Armor,armor
CN,1,1,Reserve Fuel Tanks,special
CN,3,1,Improved Industrial Tech 9,industry
CN,5,1,Reduced Industrial Waste 80%,waste
CN,8,2,Improved Industrial Tech 8,industry
CN,10,2,Duralloy Armor,armor
CN,11,3,Battle Suits,ground
CN,13,3,Improved Industrial Tech 7,industry
CN,14,3,Automated Repair System,special
CN,15,3,Reduced Industrial Waste 60%,waste
CN,17,4,Zortium Armor,armor
CN,18,4,Improved Industrial Tech 6,industry
CN,23,5,Improved Industrial Tech 5,industry
CN,24,5,Armored Exoskeleton,ground
CN,25,5,Reduced Industrial Waste 40%,waste
CN,26,6,Andrium Armor,armor
CN,28,6,Improved Industrial Tech 4,industry
CN,33,7,Improved Industrial Tech 3,industry
CN,34,7,Tritanium Armor,armor
CN,35,7,Reduced Industrial Waste 20%,waste
CN,36,8,Advanced Damage Control,special
CN,38,8,Improved Industrial Tech 2,industry
CN,40,8,Powered Armor,ground
CN,42,9,Adamantium Armor,armor
CN,45,9,Industrial Waste Elimination,waste
CN,50,10,Neutronium Armor,armor
FF,1,1,Class I Deflector Shield,shield
FF,4,1,Class II Deflector Shield,shield
FF,8,2,Personal Deflector Shield,ground
FF,10,2,Class III Deflector Shield,shield
FF,12,3,Class V Planetary Shield,planetary
FF,14,3,Class IV Deflector Shield,shield
FF,16,4,Repulsor Beam,special
FF,20,4,Class V Deflector Shield,shield
FF,21,5,Personal Absorption Shield,ground
FF,22,5,Class X Planetary Shield,planetary
FF,24,5,Class VI Deflector Shield,shield
FF,27,6,Cloaking Device,special
FF,30,6,Class VII Deflector Shield,shield
FF,31,7,Zyro Shield,special
FF,32,7,Class XV Planetary Shield,planetary
FF,34,7,Class IX Deflector Shield,shield
FF,37,8,Stasis Field,special
FF,38,8,Personal Barrier Shield,ground
FF,40,8,Class XI Deflector Shield,shield
FF,42,9,Class XX Planetary Shield,planetary
FF,43,9,Black Hole Generator,special
FF,44,9,Class XIII Deflector Shield,shield
FF,46,10,Lightning Shield,special
FF,50,10,Class XV Deflector Shield,shield
PL,1,1,Ecological Restoration,eco
PL,2,1,Terraforming +10,terraform
PL,3,1,Controlled Barren Environment,environment
PL,5,1,Improved Ecological Restoration,eco
PL,6,2,Controlled Tundra Environment,environment
PL,8,2,Terraforming +20,terraform
PL,9,2,Controlled Dead Environment,environment
PL,10,2,Death Spores,bio
PL,12,3,Controlled Inferno Environment,environment
PL,13,3,Enhanced Ecological Restoration,eco
PL,14,3,Terraforming +30,terraform
PL,15,3,Controlled Toxic Environment,environment
PL,16,4,Soil Enrichment,growth
PL,17,4,Bio Toxin Antidote,defense
PL,18,4,Controlled Radiated Environment,environment
PL,20,4,Terraforming +40,terraform
PL,21,5,Cloning,growth
PL,22,5,Atmospheric Terraforming,growth
PL,24,5,Advanced Ecological Restoration,eco
PL,26,6,Terraforming +50,terraform
PL,27,6,Doom Virus,bio
PL,30,6,Advanced Soil Enrichment,growth
PL,32,7,Terraforming +60,terraform
PL,34,7,Complete Ecological Restoration,eco
PL,36,8,Universal Antidote,defense
PL,38,8,Terraforming +80,terraform
PL,40,8,Bio Terminator,bio
PL,42,9,Advanced Cloning,growth
PL,44,9,Terraforming +100,terraform
PL,50,10,Complete Terraforming,terraform
PR,1,1,Retro Engines,engine
PR,3,1,Hydrogen Fuel Cells,fuel
PR,5,1,Deuterium Fuel Cells,fuel
PR,6,2,Nuclear Engines,engine
PR,9,2,Irridium Fuel Cells,fuel
PR,10,2,Inertial Stabilizer,special
PR,12,3,Sub-Light Drives,engine
PR,14,3,Dotomite Crystals,fuel
PR,16,4,Energy Pulsar,special
PR,18,4,Fusion Drives,engine
PR,19,4,Uridium Fuel Cells,fuel
PR,20,4,Warp Dissipator,special
PR,23,5,Reajax II Fuel Cells,fuel
PR,24,5,Impulse Drives,engine
PR,27,6,Intergalactic Star Gates,planetary
PR,29,6,Trilithium Crystals,fuel
PR,30,6,Ion Drives,engine
PR,34,7,High Energy Focus,special
PR,36,8,Anti-Matter Drives,engine
PR,38,8,Sub Space Teleporter,special
PR,40,8,Ionic Pulsar,special
PR,41,9,Thorium Cells,fuel
PR,42,9,Inter-Phased Drives,engine
PR,43,9,Sub Space Interdictor,planetary
PR,45,9,Combat Transporters,invasion
PR,46,10,Inertial Nullifier,special
PR,48,10,Hyper Drives,engine
PR,50,10,Displacement Device,special
WE,1,1,Laser / Heavy Laser,beam
WE,1,1,Nuclear Missile,missile
WE,1,1,Nuclear Bomb,bomb
WE,2,1,Hand Lasers,ground
WE,4,1,Hyper-V Rockets,missile
WE,5,1,Gatling Laser,beam
WE,6,2,Anti-Missile Rockets,special
WE,7,2,Neutron Pellet Gun,beam
WE,8,2,Hyper-X Rockets,missile
WE,9,2,Fusion Bomb,bomb
WE,10,2,Ion Cannon / Heavy Ion Cannon,beam
WE,11,3,Scatter Pack V Missiles,missile
WE,12,3,Ion Rifle,ground
WE,13,3,Mass Driver,beam
WE,14,3,Merculite Missiles,missile
WE,15,3,Neutron Blaster / Heavy Blast Cannon,beam
WE,16,4,Anti-Matter Bomb,bomb
WE,17,4,Graviton Beam,beam
WE,18,4,Stinger Missiles,missile
WE,19,4,Hard Beam,beam
WE,20,4,Fusion Beam / Heavy Fusion Beam,beam
WE,21,5,Ion Stream Projector,special
WE,22,5,Omega-V Bomb,bomb
WE,23,5,Anti-Matter Torpedoes,torpedo
WE,24,5,Fusion Rifle,ground
WE,25,5,Megabolt Cannon,beam
WE,26,6,Phasor / Heavy Phasor,beam
WE,27,6,Scatter Pack VII Missiles,missile
WE,28,6,Auto Blaster,beam
WE,29,6,Pulson Missiles,missile
WE,30,6,Tachyon Beam,beam
WE,31,7,Hand Phasor,ground
WE,32,7,Gauss Autocannon,beam
WE,33,7,Particle Beam,beam
WE,34,7,Hercular Missiles,missile
WE,35,7,Plasma Cannon,beam
WE,37,8,Disruptor,beam
WE,38,8,Pulse Phasor,beam
WE,39,8,Neutronium Bomb,bomb
WE,40,8,Hellfire Torpedoes,torpedo
WE,41,9,Zeon Missiles,missile
WE,42,9,Plasma Rifle,ground
WE,43,9,Proton Torpedoes,torpedo
WE,44,9,Scatter Pack X Missiles,missile
WE,45,9,Tri-Focus Plasma Cannon,beam
WE,46,10,Stellar Converter,beam
WE,47,10,Neutron Stream Projector,special
WE,48,10,Mauler Device,beam
WE,50,10,Plasma Torpedoes,torpedo
`;

  // research/02 Appendix B: level, human cost at Simple Easy Average Hard Impossible, AI cost (neutral race)
  const APPENDIX_B = `
1 20 20 30 30 40 20
2 80 100 120 140 160 80
3 180 220 270 310 360 180
4 320 400 480 560 640 320
5 500 620 750 870 1000 500
6 720 900 1080 1260 1440 720
7 980 1220 1470 1710 1960 980
8 1280 1600 1920 2240 2560 1280
9 1620 2020 2430 2830 3240 1620
10 2000 2500 3000 3500 4000 2000
11 2420 3020 3630 4230 4840 2420
12 2880 3600 4320 5040 5760 2880
13 3380 4220 5070 5910 6760 3380
14 3920 4900 5880 6860 7840 3920
15 4500 5620 6750 7870 9000 4500
16 5120 6400 7680 8960 10240 5120
17 5780 7220 8670 10110 11560 5780
18 6480 8100 9720 11340 12960 6480
19 7220 9020 10830 12630 14440 7220
20 8000 10000 12000 14000 16000 8000
21 8820 11020 13230 15430 17640 8820
22 9680 12100 14520 16940 19360 9680
23 10580 13220 15870 18510 21160 10580
24 11520 14400 17280 20160 23040 11520
25 12500 15620 18750 21870 25000 12500
26 13520 16900 20280 23660 27040 13520
27 14580 18220 21870 25510 29160 14580
28 15680 19600 23520 27440 31360 15680
29 16820 21020 25230 29430 33640 16820
30 18000 22500 27000 31500 36000 18000
31 19220 24020 28830 33630 38440 19220
32 20480 25600 30720 35840 40960 20480
33 21780 27220 32670 38110 43560 21780
34 23120 28900 34680 40460 46240 23120
35 24500 30620 36750 42870 49000 24500
36 25920 32400 38880 45360 51840 25920
37 27380 34220 41070 47910 54760 27380
38 28880 36100 43320 50540 57760 28880
39 30420 38020 45630 53230 60840 30420
40 32000 40000 48000 56000 64000 32000
41 33620 42020 50430 58830 67240 33620
42 35280 44100 52920 61740 70560 35280
43 36980 46220 55470 64710 73960 36980
44 38720 48400 58080 67760 77440 38720
45 40500 50620 60750 70870 81000 40500
46 42320 52900 63480 74060 84640 42320
47 44180 55220 66270 77310 88360 44180
48 46080 57600 69120 80640 92160 46080
49 48020 60020 72030 84030 96040 48020
50 50000 62500 75000 87500 100000 50000
55 60500 75620 90750 105870 121000 60500
60 72000 90000 108000 126000 144000 72000
65 84500 105620 126750 147870 169000 84500
70 98000 122500 147000 171500 196000 98000
75 112500 140620 168750 196870 225000 112500
80 128000 160000 192000 224000 256000 128000
85 144500 180620 216750 252870 289000 144500
90 162000 202500 243000 283500 324000 162000
95 180500 225620 270750 315870 361000 180500
100 200000 250000 300000 350000 400000 200000
`;

  // research/02 Appendix C (index tm = 0..50): cost multiplier % and space multiplier %
  const APPENDIX_C_T50 = `
tm  0-10 : 100 93 87 81 76 71 66 62 58 54 50
tm 11-20 :  47 44 41 38 35 33 31 29 27 25
tm 21-30 :  23 22 20 19 18 16 15 14 13 13
tm 31-40 :  12 11 10  9  9  8  8  7  7  6
tm 41-50 :   6  5  5  5  4  4  4  4  3  3
`;
  const APPENDIX_C_T25 = `
tm  0-10 : 100 97 94 92 89 87 84 82 79 77 75
tm 11-20 :  73 71 69 67 65 63 61 60 58 56
tm 21-30 :  55 53 52 50 49 47 46 45 43 42
tm 31-40 :  41 40 39 38 37 36 35 34 33 32
tm 41-50 :  31 30 29 28 27 27 26 25 24 24
`;

  // research/02 §1.7 tier composition: valid researchable levels per tier (tier 1..10)
  const TIER_TABLE = {
    CM: [[2, 4, 5], [7, 8, 10], [12, 13, 15], [17, 18, 20], [22, 23, 25], [27, 28, 30], [32, 34, 35], [37, 38, 40], [42, 45], [46, 47, 48, 49, 50]],
    CN: [[3, 5], [8, 10], [11, 13, 14, 15], [17, 18], [23, 24, 25], [26, 28], [33, 34, 35], [36, 38, 40], [42, 45], [50]],
    FF: [[4], [8, 10], [12, 14], [16, 20], [21, 22, 24], [27, 30], [31, 32, 34], [37, 38, 40], [42, 43, 44], [46, 50]],
    PL: [[2, 3, 5], [6, 8, 9, 10], [12, 13, 14, 15], [16, 17, 18, 20], [21, 22, 24], [26, 27, 30], [32, 34], [36, 38, 40], [42, 44], [50]],
    PR: [[3, 5], [6, 9, 10], [12, 14], [16, 18, 19, 20], [23, 24], [27, 29, 30], [34], [36, 38, 40], [41, 42, 43, 45], [46, 48, 50]],
    WE: [[2, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20], [21, 22, 23, 24, 25], [26, 27, 28, 29, 30], [31, 32, 33, 34, 35], [37, 38, 39, 40], [41, 42, 43, 44, 45], [46, 47, 48, 50]],
  };

  // research/02 §1.5 race research cost multipliers in percent, columns CM CN FF PL PR WE
  const RACE_MUL_DOC = {
    human: [100, 100, 60, 80, 80, 100],
    mrrshan: [100, 125, 100, 100, 100, 60],
    silicoid: [80, 125, 125, 125, 125, 125],
    sakkra: [100, 100, 100, 60, 100, 100],
    psilon: [80, 80, 80, 80, 80, 80],
    alkari: [100, 100, 125, 100, 60, 100],
    klackon: [100, 60, 100, 100, 125, 100],
    bulrathi: [125, 80, 100, 100, 100, 80],
    meklar: [60, 100, 100, 125, 100, 100],
    darlok: [80, 100, 100, 100, 100, 100],
  };

  // ---- helpers ---------------------------------------------------------------------------------------------------------------------
  const F = code => CODES.indexOf(code);
  const at = (code, level) => T.byFL[F(code)][level];
  const key = x => CODES[x.field] + x.level;                                   // 'CM8'
  const sortKeys = o => { const r = {}; Object.keys(o).sort().forEach(k => { r[k] = o[k]; }); return r; };
  const levelsOf = (f, pred) => T.byField[f].filter(pred).map(x => x.level);
  const allLevels = f => [1].concat(T.researchTable[f].reduce((a, tier) => a.concat(tier), []));     // every researchable level + the start tech
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const nums = block => block.split('\n').filter(l => l.indexOf(':') >= 0).reduce((a, l) => a.concat(l.split(':')[1].trim().split(/\s+/).map(Number)), []);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  // =================================================================================================================================
  // 1. the data tables
  // =================================================================================================================================
  t.test('techs: 31/24/23/29/27/46 researchable (180), start bundles 3/2/1/1/1/3, Death Ray, 60 advanced, 252 records (§2.7)', () => {
    const res = [0, 0, 0, 0, 0, 0];
    for (const x of T.list) if (!x.free && !x.special && x.level <= 50) res[x.field]++;
    t.deep(res, [31, 24, 23, 29, 27, 46]);
    t.eq(res.reduce((a, b) => a + b, 0), 180);
    t.deep(T.l1Bundle.map(a => a.length), [3, 2, 1, 1, 1, 3]);
    t.deep(T.FIELDS, ['computers', 'construction', 'forcefields', 'planetology', 'propulsion', 'weapons']);
    t.deep(T.FIELD_CODES, ['cm', 'cn', 'ff', 'pl', 'pr', 'we']);
    t.deep(T.FIELD_NAMES, ['Computers', 'Construction', 'Force Fields', 'Planetology', 'Propulsion', 'Weapons']);
    const dr = T.byId['we-36-death-ray'];
    t.ok(dr && dr.field === 5 && dr.level === 36 && dr.special === 'orion-only' && !dr.free && dr.name === 'Death Ray');
    t.deep([dr.type, dr.group, dr.tier, dr.singular, dr.grants.length, dr.grants[0].kind + ':' + dr.grants[0].id], ['beam', 'singular', 8, true, 1, 'weapon:death-ray']);
    t.eq(T.list.filter(x => x.special).length, 1);
    t.eq(T.list.filter(x => x.type === 'advanced').length, 60);
    t.eq(T.list.length, 180 + 11 + 1 + 60);
    t.eq(T.byFL[5][36], dr);
    t.ok(T.researchTable[5].every(tier => tier.indexOf(36) < 0), 'the Death Ray is never offered');
  });

  t.test('techs: every row of Appendix A (field, level, tier, name, type) is in the module, and nothing else', () => {
    const doc = APPENDIX_A.trim().split('\n');
    t.eq(doc.length, 191);                                                                   // 180 researchable + 11 level-1 techs
    const mod = T.list.filter(x => x.type !== 'advanced' && !x.special).map(x => [CODES[x.field], x.level, x.tier, x.name, x.type].join(','));
    t.deep(mod.slice().sort(), doc.slice().sort());
  });

  t.test('techs: ids, indexes, one tech per level, tier = ceil(level/5)', () => {
    const seen = {};
    for (const x of T.list) {
      t.ok(/^(cm|cn|ff|pl|pr|we)-\d\d\d?-[a-z0-9]+(-[a-z0-9]+)*$/.test(x.id), x.id);
      t.ok(!seen[x.id], 'duplicate id ' + x.id); seen[x.id] = 1;
      t.eq(T.byId[x.id], x);
      t.eq(x.id.slice(0, 2), T.FIELD_CODES[x.field]);
      t.ok(x.id.indexOf(T.FIELD_CODES[x.field] + '-' + (x.level < 10 ? '0' : '') + x.level + '-') === 0, x.id + ': level is zero-padded to two digits');
      t.eq(Number(x.id.slice(3, x.id.indexOf('-', 3))), x.level, x.id);
      t.eq(x.tier, Math.ceil(x.level / 5), x.id);
      t.ok(T.byField[x.field].indexOf(x) >= 0);
      t.ok(typeof x.name === 'string' && x.name.length > 2 && typeof x.type === 'string' && typeof x.group === 'string', x.id);
      t.ok(Array.isArray(x.grants) && x.effects && typeof x.effects === 'object', x.id);
    }
    t.eq(Object.keys(T.byId).length, T.list.length);
    for (let f = 0; f < 6; f++) {
      const lv = {};
      for (const x of T.byField[f]) if (!x.free) { t.ok(!lv[x.level], 'two techs on level ' + x.level + ' of field ' + f); lv[x.level] = 1; t.eq(T.byFL[f][x.level], x); }
      t.eq(T.byFL[f][1], T.l1Bundle[f][0]);
      t.ok(T.l1Bundle[f].every(x => x.free === true && x.level === 1 && x.tier === 1 && x.field === f));
      t.eq(T.techAt(f, 20) === T.byFL[f][20], true);
    }
    t.eq(T.techAt('we', 36), T.byId['we-36-death-ray']);
    t.eq(T.techAt('cm', 3), null);
    t.deep([T.fieldIndex('we'), T.fieldIndex('computers'), T.fieldIndex(3), T.fieldIndex('forcefields'), T.fieldIndex('pr'), T.fieldIndex('cn')], [5, 0, 3, 2, 4, 1]);
  });

  t.test('techs: tier composition equals the §1.7 table, totals 31/24/23/29/27/46, single-tech tiers FF1 PR7 CN10 PL10', () => {
    for (const c of CODES) {
      t.deep(T.researchTable[F(c)], TIER_TABLE[c], c);
      t.eq(TIER_TABLE[c].length, 10);
    }
    t.deep(CODES.map(c => TIER_TABLE[c].reduce((a, tier) => a + tier.length, 0)), [31, 24, 23, 29, 27, 46]);
    const single = [];
    T.researchTable.forEach((tiers, f) => tiers.forEach((lv, i) => { if (lv.length === 1) single.push(CODES[f] + lv[0] + '@T' + (i + 1)); }));
    t.deep(single.sort(), ['CN50@T10', 'FF4@T1', 'PL50@T10', 'PR34@T7']);
  });

  t.test('techs: advanced techs are Advanced <Field> Tech I..X on levels 55..100, tlOnly, no grants', () => {
    for (let f = 0; f < 6; f++) {
      const adv = T.byField[f].filter(x => x.type === 'advanced');
      t.eq(adv.length, 10);
      adv.forEach((x, i) => {
        t.eq(x.level, 55 + 5 * i);
        t.eq(x.tier, 11 + i);
        t.ok(/^Advanced (Computer|Construction|Force Field|Planetology|Propulsion|Weapon) Tech [IVX]+$/.test(x.name), x.name);
        t.ok(x.name.endsWith(' ' + ROMAN[i]), x.name);
        t.deep(x.effects, { tlOnly: true });
        t.deep(x.grants, []);
        t.eq(x.group, 'advanced');
      });
    }
    t.eq(T.byFL[0][55].name, 'Advanced Computer Tech I'); t.eq(T.byFL[5][100].name, 'Advanced Weapon Tech X');
  });

  t.test('techs: descriptions are single, unique, original-sentence strings', () => {
    const seen = {};
    for (const x of T.list) {
      t.eq(typeof x.desc, 'string', x.id);
      t.between(x.desc.length, 25, 230, x.id);
      t.ok(/^[A-Z0-9]/.test(x.desc) && x.desc.charAt(x.desc.length - 1) === '.', x.id + ': ' + x.desc);
      t.ok(!/[\n\r]/.test(x.desc), x.id);
      t.eq((x.desc.match(/[.!?](\s|$)/g) || []).length, 1, x.id + ' must be one sentence');
      t.ok(!seen[x.desc], 'duplicate description: ' + x.desc); seen[x.desc] = 1;
    }
  });

  t.test('techs: records are plain JSON (no undefined / functions / shared effect objects) and the module boots from its own source like in a worker', () => {
    const effectObjects = new Set();
    for (const x of T.list) {
      for (const k in x) { t.ok(x[k] !== undefined && typeof x[k] !== 'function', x.id + '.' + k); }
      t.ok(!effectObjects.has(x.effects), x.id + ' shares its effects object'); effectObjects.add(x.effects);
    }
    t.eq(JSON.stringify(JSON.parse(JSON.stringify(T.list))), JSON.stringify(T.list));
    // MOO.def keeps the function source for the worker pool: run it against an empty namespace (no outer variables may be needed)
    const src = M.__defs.filter(s => s.indexOf('M.Data.Techs = {') >= 0);
    t.eq(src.length, 1, 'exactly one registered module defines Data.Techs');
    const ns = { Data: {}, Sim: {}, Util: {} };
    new Function('return (' + src[0] + ')')()(ns);
    const B = ns.Data.Techs;
    t.eq(JSON.stringify(B.list), JSON.stringify(T.list));
    t.eq(JSON.stringify(B.researchTable), JSON.stringify(T.researchTable)); t.eq(JSON.stringify(B.GRANT_IDS), JSON.stringify(T.GRANT_IDS));
    t.eq(B.costHuman(20, 'human', 0, 2), 12000); t.eq(B.tl(0, [1, 2, 4]), 5);
    t.eq(JSON.stringify(B.generateResearchList(M.RNG.create('boot'), 'human')), JSON.stringify(T.generateResearchList(M.RNG.create('boot'), 'human')));
  });

  t.test('constants: tier count, choice window, soil / atmosphere project prices, advanced range', () => {
    t.deep([T.CONST.TIERS, T.CONST.TECH_NEXT_MAX, T.CONST.MAX_LEVEL, T.CONST.ADV_FIRST, T.CONST.ADV_LAST], [10, 12, 50, 55, 100]);
    t.deep([T.CONST.SOIL_COST, T.CONST.ADV_SOIL_COST, T.CONST.ATMOS_COST], [150, 300, 200]);
  });

  // =================================================================================================================================
  // 2. effects (§4 derived-stat tables)
  // =================================================================================================================================
  const holders = k => { const o = {}; for (const x of T.list) if (k in x.effects) o[key(x)] = x.effects[k]; return sortKeys(o); };
  const same = (k, expected) => t.deep(holders(k), sortKeys(expected), k);
  const tier = (group, tierNo) => ({ group, tier: tierNo });

  t.test('effects: only documented keys, right value types, every documented key is used', () => {
    const doc = {}; T.EFFECT_KEYS.forEach(k => { doc[k] = 1; });
    t.eq(T.EFFECT_KEYS.length, 32);
    const used = {};
    for (const x of T.list) {
      for (const k in x.effects) {
        t.ok(doc[k], x.id + ' uses the undocumented effect key ' + k); used[k] = 1;
        const v = x.effects[k];
        if (k === 'planetShield') t.ok(v.level > 0 && v.cost === v.level * 100, x.id);
        else if (k === 'groundTier') t.ok(['armor', 'suit', 'shield', 'weapon'].indexOf(v.group) >= 0 && v.tier >= 1 && v.tier <= 6, x.id);
        else if (/^(stargate|interdictor|combatTransporter|hyperComm|scanFleetInfo|advScanner|soil|advSoil|atmos|bioDefense|tlOnly)$/.test(k)) t.eq(v, true, x.id + '.' + k);
        else t.ok(typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v, x.id + '.' + k);
      }
      t.eq('terraform' in x.effects, 'terraformCost' in x.effects, x.id + ': terraform and terraformCost travel together');
    }
    for (const k of T.EFFECT_KEYS) t.ok(used[k], 'documented effect never used: ' + k);
  });

  t.test('effects §4.1 factories: build cost 10 → 9..2, robotic controls 2 → 7, waste scale 10 → 0, eco restoration 2 → 20', () => {
    same('factoryCost', { CN3: 9, CN8: 8, CN13: 7, CN18: 6, CN23: 5, CN28: 4, CN33: 3, CN38: 2 });
    same('robotic', { CM1: 2, CM8: 3, CM18: 4, CM28: 5, CM38: 6, CM48: 7 });
    same('wasteScale', { CN5: 8, CN15: 6, CN25: 4, CN35: 2, CN45: 0 });
    same('ecoRestore', { PL1: 2, PL5: 3, PL13: 5, PL24: 10, PL34: 20 });
  });

  t.test('effects §4.2 range and sensing: fuel 4..10 + unlimited, scanner 5/7/9, transport speed, warp, flags', () => {
    same('fuel', { PR3: 4, PR5: 5, PR9: 6, PR14: 7, PR19: 8, PR23: 9, PR29: 10, PR41: 30 });
    same('scan', { CM4: 5, CM13: 7, CM23: 9 });
    same('transportSpeed', { PR1: 1, PR6: 1, PR12: 2, PR18: 3, PR24: 4, PR30: 5, PR36: 6, PR42: 7, PR48: 8 });
    same('warp', { PR1: 1, PR6: 2, PR12: 3, PR18: 4, PR24: 5, PR30: 6, PR36: 7, PR42: 8, PR48: 9 });
    same('stargate', { PR27: true }); same('interdictor', { PR43: true }); same('combatTransporter', { PR45: true }); same('hyperComm', { CM34: true });
    same('scanFleetInfo', { CM13: true, CM23: true }); same('advScanner', { CM23: true });
  });

  t.test('effects §4.3 population: colony types, terraform step + price (5,5,4,4,3,3,2,2,2), soil/atmos/adv soil, cloning, antidotes', () => {
    same('colonyFor', { PL3: 6, PL6: 5, PL9: 4, PL12: 3, PL15: 2, PL18: 1 });
    same('terraform', { PL2: 10, PL8: 20, PL14: 30, PL20: 40, PL26: 50, PL32: 60, PL38: 80, PL44: 100, PL50: 120 });
    same('terraformCost', { PL2: 5, PL8: 5, PL14: 4, PL20: 4, PL26: 3, PL32: 3, PL38: 2, PL44: 2, PL50: 2 });
    same('soil', { PL16: true }); same('advSoil', { PL30: true }); same('atmos', { PL22: true });     // 1oom: soil enrichment = PL 16 alone; advanced soil (PL 30) does not imply it
    same('incPopCost', { PL21: 10, PL42: 5 });
    same('antidote', { PL17: 1, PL36: 2 }); same('bioDefense', { PL17: true, PL36: true });
    // each terraform step: cost per point = max(2, 5 - (techLevel - 2) / 12)  (research/02 §2.4)
    for (const x of T.list) if ('terraform' in x.effects) t.eq(x.effects.terraformCost, Math.max(2, 5 - Math.floor((x.level - 2) / 12)), x.id);
  });

  t.test('effects §4.4 / §5 defence: planetary shields 5/10/15/20 for 500..2000 BC, ground tiers, missile-base armour index', () => {
    same('planetShield', { FF12: { level: 5, cost: 500 }, FF22: { level: 10, cost: 1000 }, FF32: { level: 15, cost: 1500 }, FF42: { level: 20, cost: 2000 } });
    same('groundTier', {
      CN10: tier('armor', 1), CN17: tier('armor', 2), CN26: tier('armor', 3), CN34: tier('armor', 4), CN42: tier('armor', 5), CN50: tier('armor', 6),
      CN11: tier('suit', 1), CN24: tier('suit', 2), CN40: tier('suit', 3),
      FF8: tier('shield', 1), FF21: tier('shield', 2), FF38: tier('shield', 3),
      WE2: tier('weapon', 1), WE12: tier('weapon', 2), WE24: tier('weapon', 3), WE31: tier('weapon', 4), WE42: tier('weapon', 5),
    });
    same('baseHp', { CN1: 0, CN10: 1, CN17: 2, CN26: 3, CN34: 4, CN42: 5, CN50: 6 });
    t.deep(T.BASE_HP, [50, 75, 100, 125, 150, 175, 200]);
    t.deep(T.CONST.PLANET_SHIELD_COST, [0, 500, 1000, 1500, 2000]);
  });

  t.test('effects: component marks follow the §3 tables (computers 1..11, ECM 1..10, deflector absorb, base missiles/scatter packs)', () => {
    same('baseComp', { CM1: 1, CM5: 2, CM10: 3, CM15: 4, CM20: 5, CM25: 6, CM30: 7, CM35: 8, CM40: 9, CM45: 10, CM50: 11 });
    same('baseEcm', { CM2: 1, CM7: 2, CM12: 3, CM17: 4, CM22: 5, CM27: 6, CM32: 7, CM37: 8, CM42: 9, CM47: 10 });
    same('baseShield', { FF1: 1, FF4: 2, FF10: 3, FF14: 4, FF20: 5, FF24: 6, FF30: 7, FF34: 9, FF40: 11, FF44: 13, FF50: 15 });
    same('baseMissile', { WE1: 1, WE4: 2, WE8: 3, WE14: 4, WE18: 5, WE29: 6, WE34: 7, WE41: 8 });
    same('baseScatter', { WE11: 1, WE27: 2, WE44: 3 });
    t.deep(T.BASE_MISSILES, ['nuclear-missile', 'hyper-v', 'hyper-x', 'merculite', 'stinger', 'pulson', 'hercular', 'zeon']);
    t.deep(T.BASE_SCATTER, ['scatter-pack-v', 'scatter-pack-vii', 'scatter-pack-x']);
    t.eq(Object.keys(holders('tlOnly')).length, 60);
  });

  t.test('effects: groundBonus (§5) = 5·armor + 10·suit + 10·shield + 5·weapon\' (+1 above tier 2); maximum 120', () => {
    t.eq(T.groundBonus({ armor: 0, suit: 0, shield: 0, weapon: 0 }), 0);
    t.eq(T.groundBonus({ armor: 6, suit: 3, shield: 3, weapon: 5 }), 120);
    t.deep([1, 2, 3, 4, 5].map(w => T.groundBonus({ weapon: w })), [5, 10, 20, 25, 30]);                 // Hand Laser .. Plasma Rifle
    t.deep([1, 2, 3, 4, 5, 6].map(a => T.groundBonus({ armor: a })), [5, 10, 15, 20, 25, 30]);
    t.deep([1, 2, 3].map(s => T.groundBonus({ suit: s })), [10, 20, 30]);
    t.deep([1, 2, 3].map(s => T.groundBonus({ shield: s })), [10, 20, 30]);
  });

  // =================================================================================================================================
  // 3. flags, groups, grants
  // =================================================================================================================================
  t.test('flags: essential techs (§1.7) and the Silicoid NEVER lists (+ opt-in fix list)', () => {
    t.deep(levelsOf(0, x => x.essential), [8, 18, 28, 38, 48]);
    t.deep(levelsOf(1, x => x.essential), []);
    t.deep(levelsOf(2, x => x.essential), []);
    t.deep(levelsOf(3, x => x.essential), [12, 22, 32, 42]);
    t.deep(levelsOf(4, x => x.essential), [3, 5]);
    t.deep(levelsOf(5, x => x.essential), [4, 8, 11, 18, 27, 34, 41, 44]);
    t.deep(levelsOf(1, x => x.never), [5, 15, 25, 35, 45]);
    t.deep(levelsOf(3, x => x.never), [3, 5, 6, 9, 12, 13, 15, 16, 18, 22, 34]);
    for (const f of [0, 2, 4, 5]) t.deep(levelsOf(f, x => x.never), []);
    t.deep(levelsOf(3, x => x.neverFix), [24, 30]);
    t.ok(T.list.every(x => !x.never || (x.never.length === 1 && x.never[0] === 'silicoid')));
    t.ok(T.list.every(x => x.free || x.special || x.type === 'advanced' || x.level >= 2));
  });

  t.test('flags: free level-1 techs and the singular group (all techs outside the other groups, AI value x10)', () => {
    t.deep(T.list.filter(x => x.free).map(x => x.name), ['Battle Computer Mark I', 'Robotic Controls II', 'Battle Scanner', 'Titanium Armor', 'Reserve Fuel Tanks',
      'Class I Deflector Shield', 'Ecological Restoration', 'Retro Engines', 'Laser / Heavy Laser', 'Nuclear Missile', 'Nuclear Bomb']);
    const singular = T.list.filter(x => x.singular).map(key).sort();
    const expected = ['CM1' /* Battle Scanner */, 'CM34', 'CM46', 'CM49', 'CN1' /* Reserve Fuel Tanks */, 'FF16', 'FF27', 'FF37', 'FF43',
      'PL16', 'PL17', 'PL21', 'PL22', 'PL30', 'PL36', 'PL42', 'PR10', 'PR20', 'PR27', 'PR34', 'PR38', 'PR43', 'PR45', 'PR46', 'PR50', 'WE36' /* Death Ray */];
    t.deep(singular, expected.sort());
    t.ok(T.list.every(x => x.singular === undefined ? x.group !== 'singular' : x.group === 'singular'));
    t.eq(T.tradeValue(at('CM', 34)), 34 * 34 * 10);                       // hyperspace communications: singular x10
    t.eq(T.tradeValue(at('CM', 8)), 8 * 8 * 6);                            // improved robotic controls x6
    t.eq(T.tradeValue(at('CN', 25)), 25 * 25 * 3);                         // reduced industrial waste x3
    t.eq(T.tradeValue(at('PL', 13)), 13 * 13 * 3);                         // eco restoration x3
    t.eq(T.tradeValue(at('WE', 32)), 32 * 32 * 1);                         // any other group x1
    t.deep(T.GROUP_TRADE_MUL, { singular: 10, 'robotic-controls': 6, waste: 3, 'eco-restoration': 3 });
  });

  t.test('groups (Appendix D): membership, gtier ranks inside a group', () => {
    const D = {
      ecm: 'CM2 CM7 CM12 CM17 CM22 CM27 CM32 CM37 CM42 CM47', 'battle-computer': 'CM1 CM5 CM10 CM15 CM20 CM25 CM30 CM35 CM40 CM45 CM50',
      'robotic-controls': 'CM1 CM8 CM18 CM28 CM38 CM48', scanner: 'CM4 CM13 CM23',                      // CM1 = the free Robotic Controls II (module extension)
      waste: 'CN5 CN15 CN25 CN35 CN45', 'industrial-tech': 'CN3 CN8 CN13 CN18 CN23 CN28 CN33 CN38', armor: 'CN1 CN10 CN17 CN26 CN34 CN42 CN50', repair: 'CN14 CN36',
      deflector: 'FF1 FF4 FF10 FF14 FF20 FF24 FF30 FF34 FF40 FF44 FF50', 'planetary-shield': 'FF12 FF22 FF32 FF42', 'anti-missile': 'WE6 FF31 FF46',
      terraforming: 'PL2 PL8 PL14 PL20 PL26 PL32 PL38 PL44 PL50', environment: 'PL3 PL6 PL9 PL12 PL15 PL18', 'eco-restoration': 'PL1 PL5 PL13 PL24 PL34',
      'personal-armor': 'CN11 CN24 CN40', 'personal-shield': 'FF8 FF21 FF38', engine: 'PR1 PR6 PR12 PR18 PR24 PR30 PR36 PR42 PR48', fuel: 'PR3 PR5 PR9 PR14 PR19 PR23 PR29 PR41',
      beam: 'WE1 WE5 WE7 WE10 WE13 WE15 WE19 WE20 WE25 WE26 WE28 WE32 WE33 WE35 WE37 WE38 WE45 WE46 WE48',
      rocket: 'WE1 WE4 WE8 WE11 WE14 WE18 WE23 WE27 WE29 WE34 WE40 WE41 WE43 WE44 WE50', 'personal-weapon': 'WE2 WE12 WE24 WE31 WE42', bomb: 'WE1 WE9 WE16 WE22 WE39',
      'bio-weapon': 'PL10 PL27 PL40', pulsar: 'PR16 PR40', 'stream-projector': 'WE21 WE47', 'penetrating-beam': 'WE17 WE30',
    };
    for (const g in D) {
      const got = T.list.filter(x => x.group === g);
      t.deep(got.map(key).sort(), D[g].split(' ').sort(), g);
      const ranked = got.slice().sort((a, b) => a.level - b.level || a.field - b.field);
      ranked.forEach((x, i) => t.eq(x.gtier, i + 1, x.id));
      t.deep(T.GROUPS[g], ranked.map(x => x.id), g);
    }
    for (const x of T.list) if (x.group === 'singular' || x.group === 'advanced') t.eq(x.gtier, undefined, x.id);
    const known = {}; Object.keys(D).forEach(g => { known[g] = 1; }); known.singular = known.advanced = 1;
    for (const x of T.list) t.ok(known[x.group], 'unknown group ' + x.group);
  });

  // the tech level that §3 gives for each component ("Tech lvl" columns): where the grant must sit
  const GRANT_AT = {
    'weapon:laser': 'WE1', 'weapon:heavy-laser': 'WE1', 'weapon:nuclear-missile': 'WE1', 'bomb:nuclear-bomb': 'WE1', 'weapon:hyper-v': 'WE4', 'weapon:gatling-laser': 'WE5',
    'weapon:neutron-pellet-gun': 'WE7', 'weapon:hyper-x': 'WE8', 'bomb:fusion-bomb': 'WE9', 'weapon:ion-cannon': 'WE10', 'weapon:heavy-ion-cannon': 'WE10', 'bomb:death-spores': 'PL10',
    'weapon:scatter-pack-v': 'WE11', 'weapon:mass-driver': 'WE13', 'weapon:merculite': 'WE14', 'weapon:neutron-blaster': 'WE15', 'weapon:heavy-blast-cannon': 'WE15',
    'bomb:anti-matter-bomb': 'WE16', 'weapon:graviton-beam': 'WE17', 'weapon:stinger': 'WE18', 'weapon:hard-beam': 'WE19', 'weapon:fusion-beam': 'WE20', 'weapon:heavy-fusion-beam': 'WE20',
    'bomb:omega-v-bomb': 'WE22', 'weapon:anti-matter-torpedo': 'WE23', 'weapon:megabolt-cannon': 'WE25', 'weapon:phasor': 'WE26', 'weapon:heavy-phasor': 'WE26',
    'weapon:scatter-pack-vii': 'WE27', 'bomb:doom-virus': 'PL27', 'weapon:auto-blaster': 'WE28', 'weapon:pulson': 'WE29', 'weapon:tachyon-beam': 'WE30', 'weapon:gauss-autocannon': 'WE32',
    'weapon:particle-beam': 'WE33', 'weapon:hercular': 'WE34', 'weapon:plasma-cannon': 'WE35', 'weapon:death-ray': 'WE36', 'weapon:disruptor': 'WE37', 'weapon:pulse-phasor': 'WE38',
    'bomb:neutronium-bomb': 'WE39', 'bomb:bio-terminator': 'PL40', 'weapon:hellfire-torpedo': 'WE40', 'weapon:zeon': 'WE41', 'weapon:proton-torpedo': 'WE43', 'weapon:scatter-pack-x': 'WE44',
    'weapon:tri-focus-plasma-cannon': 'WE45', 'weapon:stellar-converter': 'WE46', 'weapon:mauler-device': 'WE48', 'weapon:plasma-torpedo': 'WE50',
    'special:reserve-fuel-tanks': 'CN1', 'special:standard-colony-base': 'PL1', 'special:barren-colony-base': 'PL3', 'special:tundra-colony-base': 'PL6', 'special:dead-colony-base': 'PL9',
    'special:inferno-colony-base': 'PL12', 'special:toxic-colony-base': 'PL15', 'special:radiated-colony-base': 'PL18', 'special:battle-scanner': 'CM1', 'special:anti-missile-rockets': 'WE6',
    'special:repulsor-beam': 'FF16', 'special:warp-dissipator': 'PR20', 'special:energy-pulsar': 'PR16', 'special:inertial-stabilizer': 'PR10', 'special:zyro-shield': 'FF31',
    'special:automated-repair': 'CN14', 'special:stasis-field': 'FF37', 'special:cloaking-device': 'FF27', 'special:ion-stream-projector': 'WE21', 'special:high-energy-focus': 'PR34',
    'special:ionic-pulsar': 'PR40', 'special:black-hole-generator': 'FF43', 'special:sub-space-teleporter': 'PR38', 'special:lightning-shield': 'FF46',
    'special:neutron-stream-projector': 'WE47', 'special:advanced-damage-control': 'CN36', 'special:technology-nullifier': 'CM49', 'special:inertial-nullifier': 'PR46',
    'special:oracle-interface': 'CM46', 'special:displacement-device': 'PR50',
  };
  [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50].forEach((l, i) => { GRANT_AT['computer:mark-' + (i + 1) + '-computer'] = 'CM' + l; });
  [2, 7, 12, 17, 22, 27, 32, 37, 42, 47].forEach((l, i) => { GRANT_AT['ecm:ecm-' + (i + 1)] = 'CM' + l; });
  [[1, 1], [2, 4], [3, 10], [4, 14], [5, 20], [6, 24], [7, 30], [9, 34], [11, 40], [13, 44], [15, 50]].forEach(c => { GRANT_AT['shield:class-' + c[0] + '-shield'] = 'FF' + c[1]; });
  [['titanium', 1], ['duralloy', 10], ['zortium', 17], ['andrium', 26], ['tritanium', 34], ['adamantium', 42], ['neutronium', 50]].forEach(a => { GRANT_AT['armor:' + a[0] + '-armor'] = 'CN' + a[1]; });
  [['retro', 1], ['nuclear', 6], ['sub-light', 12], ['fusion', 18], ['impulse', 24], ['ion', 30], ['anti-matter', 36], ['inter-phased', 42], ['hyperthrust', 48]]
    .forEach(e => { GRANT_AT['engine:' + e[0] + '-engine'] = 'PR' + e[1]; });

  t.test('grants: every ship part sits on the tech level the §3 component tables require, each is granted once and declared in GRANT_IDS', () => {
    const kinds = ['weapon', 'bomb', 'computer', 'ecm', 'shield', 'armor', 'engine', 'special'];
    const used = {};
    for (const x of T.list) for (const g of x.grants) {
      t.ok(kinds.indexOf(g.kind) >= 0, x.id + ' kind ' + g.kind);
      t.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(g.id), 'id not kebab-case: ' + g.id);
      const k = g.kind + ':' + g.id;
      t.eq(used[k], undefined, k + ' granted twice'); used[k] = key(x);
      t.eq(GRANT_AT[k], key(x), k + ' should be granted by ' + GRANT_AT[k] + ', is by ' + key(x));
    }
    t.deep(Object.keys(used).sort(), Object.keys(GRANT_AT).sort());
    const declared = [];
    for (const k in T.GRANT_IDS) { t.ok(kinds.indexOf(k) >= 0, 'GRANT_IDS kind ' + k); T.GRANT_IDS[k].forEach(id => declared.push(k + ':' + id)); }
    t.deep(declared.sort(), Object.keys(used).sort());
    t.eq(declared.length, 42 + 8 + 11 + 10 + 11 + 7 + 9 + 30);
    t.eq(new Set(declared).size, declared.length);
  });

  t.test('grants: the free level-1 bundle holds the start parts (laser, heavy laser, nuclear missile + bomb, battle scanner, titanium, class I, retro, colony base)', () => {
    const start = [];
    T.l1Bundle.forEach(b => b.forEach(x => x.grants.forEach(g => start.push(g.kind + ':' + g.id))));
    t.deep(start.sort(), ['armor:titanium-armor', 'bomb:nuclear-bomb', 'computer:mark-1-computer', 'engine:retro-engine', 'shield:class-1-shield', 'special:battle-scanner',
      'special:reserve-fuel-tanks', 'special:standard-colony-base', 'weapon:heavy-laser', 'weapon:laser', 'weapon:nuclear-missile']);
  });

  t.test('grants vs js/data/components.js: each component grant key is a tech grant on the same field/level, and every tech grant has a component', () => {
    const C = M.Data.Components;
    if (!C) t.skip('components.js not loaded');
    const at2 = {};
    for (const x of T.list) x.grants.forEach(g => { at2[g.kind + ':' + g.id] = x.field + ':' + x.level; });
    const seen = {};
    for (const group in C) {
      if (!Array.isArray(C[group])) continue;
      for (const c of C[group]) {
        if (!c || !c.grant) continue;
        t.ok(at2[c.grant] !== undefined, group + ' ' + c.id + ' grant ' + c.grant + ' is not granted by any tech');
        if (c.tech) t.eq(c.tech.f + ':' + c.tech.l, at2[c.grant], c.grant);
        seen[c.grant] = true;
      }
    }
    t.deep(Object.keys(seen).sort(), Object.keys(at2).sort());
  });

  // =================================================================================================================================
  // 4. costs (§1.5, Appendix B)
  // =================================================================================================================================
  t.test('cost: human RP = ((L*L*racemul*diffmul)/1000)*10 matches every Appendix B row at all five difficulties; AI = L*L*racemul*20/100', () => {
    const rows = APPENDIX_B.trim().split('\n');
    t.eq(rows.length, 60);
    for (const line of rows) {
      const v = line.split(' ').map(Number), L = v[0];
      for (let d = 0; d < 5; d++) t.eq(T.costHuman(L, 'neutral', 0, d), v[1 + d], 'level ' + L + ' difficulty ' + d);
      t.eq(T.costAI(L, 'neutral', 0), v[6], 'AI level ' + L);
    }
    t.deep(T.DIFF_COST_MUL, [20, 25, 30, 35, 40]);
  });

  t.test('cost: published samples — Average L20 = 12,000, Easy L1 = 20, Hard L1 = 30, L50 = 75,000, AI L10 Psilon = 1,600', () => {
    t.eq(T.costHuman(20, 'neutral', 0, 2), 12000);
    t.eq(T.costHuman(1, 'neutral', 0, 1), 20);
    t.eq(T.costHuman(1, 'neutral', 0, 3), 30);
    t.eq(T.costHuman(50, 'neutral', 0, 2), 75000);
    t.eq(T.costAI(10, 'psilon', 0), Math.floor(10 * 10 * 80 * 20 / 100)); t.eq(T.costAI(10, 'psilon', 0), 1600);
    t.eq(T.costHuman(2, 'neutral', 0), 120);                                       // difficulty defaults to Average
    t.eq(T.costHuman(20, 'neutral', 0, 99), T.costHuman(20, 'neutral', 0, 4));     // clamped
    t.eq(T.costHuman(20, 'neutral', 0, null), 12000); t.eq(T.costHuman(20, 'neutral', 0, undefined), 12000);
    for (const tech of T.list) t.eq(T.costHuman(tech.level, 'neutral', tech.field, 2), 30 * tech.level * tech.level, tech.id);   // the RP column of §2
  });

  t.test('cost: race multipliers (§1.5) — Good 9,600 / Excellent 7,200 / Poor 15,000 at L20 Average; field given as index, code or name', () => {
    for (const r of T.RACE_IDS) t.deep(['cm', 'cn', 'ff', 'pl', 'pr', 'we'].map(c => T.RACE_COST_MUL[r][c]), RACE_MUL_DOC[r], r);
    t.eq(T.RACE_IDS.length, 10); t.eq(Object.keys(T.RACE_COST_MUL).length, 10);
    t.eq(T.costHuman(20, 'human', 3, 2), 9600);                                   // Good (80): human planetology
    t.eq(T.costHuman(20, 'human', 2, 2), 7200);                                   // Excellent (60): human force fields
    t.eq(T.costHuman(20, 'silicoid', 2, 2), 15000);                               // Poor (125): silicoid force fields
    t.eq(T.costHuman(20, 'human', 0, 2), 12000);                                  // Average (100)
    t.eq(T.costHuman(20, 'human', 'ff', 2), 7200); t.eq(T.costHuman(20, 'human', 'forcefields', 2), 7200);
    // every table entry is one of the four ratings
    for (const r of T.RACE_IDS) for (const c in T.RACE_COST_MUL[r]) t.ok([60, 80, 100, 125].indexOf(T.RACE_COST_MUL[r][c]) >= 0);
    t.eq(T.costAI(10, 'human', 2), Math.floor(100 * 60 * 20 / 100));
    t.eq(T.costAI(7, 'darlok', 0), Math.floor(49 * 80 * 20 / 100));
    // every race x field x level against the document's multiplier table (field index 0..5 must pick the right column)
    for (const r of T.RACE_IDS) for (let f = 0; f < 6; f++) for (const L of [3, 17, 50]) {
      t.eq(T.costHuman(L, r, f, 2), Math.floor(L * L * RACE_MUL_DOC[r][f] * 30 / 1000) * 10, r + ' ' + CODES[f] + ' L' + L);
      t.eq(T.costHuman(L, r, f, 4), Math.floor(L * L * RACE_MUL_DOC[r][f] * 40 / 1000) * 10, r + ' ' + CODES[f] + ' L' + L + ' impossible');
      t.eq(T.costAI(L, r, f), Math.floor(L * L * RACE_MUL_DOC[r][f] * 20 / 100), 'AI ' + r + ' ' + CODES[f] + ' L' + L);
    }
  });

  // =================================================================================================================================
  // 5. tech level and miniaturisation (§1.6, Appendix C)
  // =================================================================================================================================
  t.test('tl (§1.6): start 1, +L2 → 2, +L4 → 5, complete fields 71/64/63/69/67/86, advanced steps 76..99, clamps', () => {
    t.eq(T.tl(0, [1]), 1);
    t.eq(T.tl(0, [1, 2]), 2);
    t.eq(T.tl(0, [1, 2, 4]), 5);
    t.deep([0, 1, 2, 3, 4, 5].map(f => T.tl(f, allLevels(f))), [71, 64, 63, 69, 67, 86]);
    const cm = allLevels(0), seq = [];
    for (let l = 55; l <= 80; l += 5) { cm.push(l); seq.push(T.tl(0, cm)); }
    t.deep(seq, [76, 81, 86, 91, 96, 99]);
    t.eq(T.tl(0, []), 1); t.eq(T.tl(0, [0]), 1);                                   // never below 1
    t.eq(T.tl(0, allLevels(0).concat([55, 60, 65, 70, 75, 80, 85, 90, 95, 100])), 99);
    t.eq(T.tl(0, [5, 1, 4, 2]), T.tl(0, [1, 2, 4, 5]));                           // order does not matter
    for (let f = 0; f < 6; f++) t.ok(T.tl(f, allLevels(f)) >= 1 && T.tl(f, allLevels(f)) <= 99);
  });

  t.test('miniaturisation: T50 / T25 are the 51-entry Appendix C tables; helpers clamp tm = TL - level to 0..50', () => {
    t.deep(T.T50, nums(APPENDIX_C_T50)); t.deep(T.T25, nums(APPENDIX_C_T25));
    t.eq(T.T50.length, 51); t.eq(T.T25.length, 51);
    t.eq(T.T50[0], 100); t.eq(T.T50[10], 50); t.eq(T.T50[20], 25); t.eq(T.T50[50], 3);
    t.eq(T.T25[0], 100); t.eq(T.T25[10], 75); t.eq(T.T25[20], 56); t.eq(T.T25[50], 24);
    for (let i = 1; i <= 50; i++) { t.ok(T.T50[i] <= T.T50[i - 1], 'T50 non-increasing at ' + i); t.ok(T.T25[i] <= T.T25[i - 1], 'T25 non-increasing at ' + i); }
    t.eq(T.tm(10, 5), 5); t.eq(T.tm(5, 10), 0); t.eq(T.tm(99, 1), 50); t.eq(T.tm(30, 10), 20);
    t.eq(T.miniCost(1000, 20, 10), 500); t.eq(T.miniSpace(1000, 20, 10), 750);        // tm 10: half price, three quarters size
    t.eq(T.miniCost(30, 11, 1), 15); t.eq(T.miniSpace(10, 11, 1), 7);                  // a Laser (cost 30, space 10) at Weapons TL 11
    t.eq(T.miniCost(9, 11, 1), 4); t.eq(T.miniCost(7, 11, 1), 3);                      // costs truncate like the space does
    t.eq(T.miniCost(1000, 1, 1), 1000); t.eq(T.miniCost(1000, 99, 1), 30); t.eq(T.miniSpace(1000, 99, 1), 240);
    t.eq(T.miniCost(1000, 3, 9), 1000);                                                // component newer than the TL: no bonus
  });

  // =================================================================================================================================
  // 6. choosing the next tech (§1.8)
  // =================================================================================================================================
  const CMLIKE = [[2, 4, 5], [7, 8, 10], [12, 13, 15], [17, 18, 20], [22, 23, 25], [27, 28, 30], [32, 34, 35], [37, 38, 40], [42, 45], [46, 47, 48]];

  t.test('visibleTiers: tier 1 while only the start tech is known, then one tier above the best tech; tier T unlocks at level 5T-9', () => {
    t.eq(T.visibleTiers([1]), 1);
    t.eq(T.visibleTiers([1, 2]), 2);
    t.eq(T.visibleTiers([1, 5]), 2);
    for (let tierNo = 3; tierNo <= 10; tierNo++) {
      t.eq(T.visibleTiers([1, 5 * tierNo - 10]), tierNo - 1, 'level ' + (5 * tierNo - 10));
      t.eq(T.visibleTiers([1, 5 * tierNo - 9]), tierNo, 'level ' + (5 * tierNo - 9));
    }
    t.eq(T.visibleTiers([1, 50]), 10); t.eq(T.visibleTiers([1, 55]), 10); t.eq(T.visibleTiers([1, 100]), 10);
    t.eq(T.visibleTiers([50, 1, 2]), T.visibleTiers([1, 2, 50]));
  });

  t.test('choiceList: only tier 1 while just the start tech is known; one tech of a tier opens the next; lower-tier leftovers reappear', () => {
    t.deep(T.choiceList(CMLIKE, [1]), [2, 4, 5]);
    t.deep(T.choiceList(CMLIKE, [1, 2]), [4, 5, 7, 8, 10]);                          // tiers 1-2 visible after one L2 tech
    t.deep(T.choiceList(CMLIKE, [1, 5]), [2, 4, 7, 8, 10]);                          // passed-over L2, L4 are still offered
    t.deep(T.choiceList(CMLIKE, [1, 2, 4, 5]), [7, 8, 10]);                          // tier 1 finished, tier 2 on offer, tier 3 still hidden
    t.deep(T.choiceList(CMLIKE, [1, 6]), [2, 4, 5, 7, 8, 10, 12, 13, 15]);           // level 6 (any tech >= 6) opens tier 3
    t.deep(T.choiceList(CMLIKE, [1, 2, 8, 10]), [4, 5, 7, 12, 13, 15]);
    t.deep(T.choiceList(CMLIKE, [10, 1, 2]), [4, 5, 7, 8, 12, 13, 15]);              // unsorted input is fine
    t.deep(T.choiceList([], [1]), [55]);                                              // nothing at all in the list → straight to the advanced techs
  });

  t.test('choiceList: at most 12 entries, lowest tier first (a backlog pushes newer techs off the list)', () => {
    const got = T.choiceList(CMLIKE, [1, 50]);                                        // loot made tier 10 visible; the 12 lowest levels win
    t.deep(got, [2, 4, 5, 7, 8, 10, 12, 13, 15, 17, 18, 20]);
    t.eq(got.length, T.TECH_NEXT_MAX); t.eq(T.TECH_NEXT_MAX, 12);
    t.deep(T.choiceList(CMLIKE, [1, 2, 4, 5, 7, 8, 10, 12, 13, 15, 17, 18, 20, 41]), [22, 23, 25, 27, 28, 30, 32, 34, 35, 37, 38, 40]);
  });

  t.test('choiceList: with the whole personal tree done the advanced techs come one at a time (55, 60 … 100), then nothing', () => {
    const done = [1].concat(CMLIKE.reduce((a, tr) => a.concat(tr), []));
    t.deep(T.choiceList(CMLIKE, done), [55]);
    for (let l = 55; l <= 100; l += 5) {
      t.deep(T.choiceList(CMLIKE, done), [l]);
      done.push(l);
    }
    t.deep(T.choiceList(CMLIKE, done), []);
    // advanced techs obtained by other means (tmax > 50) still leave the not-yet-owned ones below tmax on offer
    t.deep(T.choiceList(CMLIKE, [1].concat(CMLIKE.reduce((a, tr) => a.concat(tr), []), [55, 65])), [60, 70]);
    t.deep(T.choiceList([[0, 0, 0]], [1]), [55]);                                     // zero padding (empty slots) is ignored
    t.deep(T.choiceList(CMLIKE, [55, 1].concat(CMLIKE.reduce((a, tr) => a.concat(tr), []))), [60]);   // the order of the completed list never matters
    t.deep(T.choiceList(null, [1]), [55]); t.deep(T.choiceList(undefined, [1, 2]), [55]);              // no personal list at all
  });

  // =================================================================================================================================
  // 7. the per-empire random tech tree (§1.7)
  // =================================================================================================================================
  function gens(race, n, seed, opts) {
    const R = M.RNG.create(seed), lists = []; let nulls = 0;
    while (lists.length < n) { const L = T.generateResearchList(R, race, opts); if (L) lists.push(L); else nulls++; }
    return { lists, nulls, attempts: n + nulls };
  }
  const total = L => L.reduce((a, tiers) => a + tiers.reduce((b, tr) => b + tr.length, 0), 0);
  const present = (L, f, level) => L[f].some(tr => tr.indexOf(level) >= 0);

  t.test('generate: shape — 6 fields x 10 tiers x 1..3 ascending levels, all from the tier table, never the start tech / Death Ray / advanced', () => {
    for (const race of ['human', 'psilon', 'silicoid']) {
      for (const L of gens(race, 60, 'shape-' + race).lists) {
        t.eq(L.length, 6);
        for (let f = 0; f < 6; f++) {
          t.eq(L[f].length, 10);
          L[f].forEach((tr, i) => {
            t.between(tr.length, 1, 3, race + ' ' + CODES[f] + ' tier ' + (i + 1));
            tr.forEach((lv, k) => { t.ok(T.researchTable[f][i].indexOf(lv) >= 0, 'level ' + lv + ' not in tier ' + (i + 1)); if (k) t.ok(lv > tr[k - 1], 'ascending'); });
          });
        }
      }
    }
  });

  t.test('generate: the single-tech tiers (FF 4, PR 34, CN 50, PL 50) are in every tree of every race', () => {
    for (const race of T.RACE_IDS) for (const L of gens(race, 200, 'single-' + race).lists) {
      t.ok(present(L, 2, 4), race + ' FF4'); t.ok(present(L, 4, 34), race + ' PR34'); t.ok(present(L, 1, 50), race + ' CN50'); t.ok(present(L, 3, 50), race + ' PL50');
    }
  });

  t.test('generate: keep rates — P(present) = p/(1-(1-p)^k) for tiers of k <= 3 techs (p = 1/2, Psilon 3/4), all other races like humans', () => {
    for (const [race, p] of [['human', 0.5], ['psilon', 0.75], ['klackon', 0.5], ['meklar', 0.5]]) {
      const { lists } = gens(race, 1200, 'keep-' + race);
      for (const k of [1, 2, 3]) {
        let hit = 0, tot = 0;
        for (const L of lists) for (let f = 0; f < 6; f++) T.researchTable[f].forEach((lv, i) => { if (lv.length === k) lv.forEach(l => { tot++; if (L[f][i].indexOf(l) >= 0) hit++; }); });
        t.near(hit / tot, p / (1 - Math.pow(1 - p, k)), 0.03, race + ' k=' + k);
      }
    }
  });

  t.test('generate: rank rates — scanning from the top keeps the lowest levels of 4-5 tech tiers less often (k=4 lowest ≈ 47 %, k=5: 35 / 45 / 52 %; Psilon k=5 lowest ≈ 20 %)', () => {
    const binCdf = (n, p, c) => { let s = 0; for (let i = 0; i <= Math.min(n, c); i++) { let comb = 1; for (let j = 0; j < i; j++) comb = comb * (n - j) / (j + 1); s += comb * Math.pow(p, i) * Math.pow(1 - p, n - i); } return s; };
    for (const [race, p] of [['human', 0.5], ['psilon', 0.75]]) {
      const { lists } = gens(race, 1500, 'rank-' + race), hit = {}, tot = {};
      for (const L of lists) for (let f = 0; f < 6; f++) T.researchTable[f].forEach((lv, i) => {
        lv.slice().reverse().forEach((level, j) => {                                // j = 0 is the highest level of the tier, the first one scanned
          const k = lv.length + ':' + (j + 1);
          tot[k] = (tot[k] || 0) + 1; if (L[f][i].indexOf(level) >= 0) hit[k] = (hit[k] || 0) + 1;
        });
      });
      for (const k in tot) {
        const n = Number(k.split(':')[0]), rank = Number(k.split(':')[1]);
        // a candidate is taken with p, only while fewer than 3 are taken yet; a tier that comes out empty is re-rolled (divide by 1 - q^n)
        t.near((hit[k] || 0) / tot[k], p * binCdf(rank - 1, p, 2) / (1 - Math.pow(1 - p, n)), 0.03, race + ' tier of ' + n + ', rank ' + rank + ' from the top');
      }
    }
    t.near(0.5 * binCdf(4, 0.5, 2) / (1 - Math.pow(0.5, 5)), 0.355, 0.002); t.near(0.75 * binCdf(4, 0.75, 2) / (1 - Math.pow(0.25, 5)), 0.1965, 0.002);   // the doc's figures
  });

  t.test('generate: opts.silicoidFix is opt-in only, and the Silicoid essential check ignores flagged techs they can never be offered', () => {
    let has24 = 0;
    for (const L of gens('silicoid', 200, 'sil-empty-opts', {}).lists) if (present(L, 3, 24)) has24++;
    t.ok(has24 > 100, 'an options object without silicoidFix must not withhold PL 24: ' + has24);
    const base = gens('silicoid', 1, 'sil-ess').lists[0];
    const pl = base.map((fl, i) => (i === 3 ? fl.map(tr => tr.filter(l => l !== 32 && l !== 42)) : fl));
    pl[3][2] = [12];                                                                  // an impossible Controlled Inferno entry must not satisfy the Silicoid check
    t.eq(T.essentialOk(pl, 'silicoid'), false); t.eq(T.essentialOk(pl, 'human'), true);
    t.eq(T.essentialOk(pl.map((fl, i) => (i === 3 ? fl.map((tr, k) => (k === 6 ? [32] : tr)) : fl)), 'silicoid'), true);
  });

  t.test('generate: expected tree sizes ≈ 101.9 techs (humans), 129.1 (Psilon), 96.1 (Silicoid; 95.4 with the bug-fix list); per field like the doc', () => {
    const avg = (race, opts, seed) => {
      const { lists } = gens(race, 1500, seed, opts), per = [0, 1, 2, 3, 4, 5].map(f => mean(lists.map(L => L[f].reduce((a, tr) => a + tr.length, 0))));
      return { all: mean(lists.map(total)), per };
    };
    const h = avg('human', undefined, 'sizes-h'), p = avg('psilon', undefined, 'sizes-p'), s = avg('silicoid', undefined, 'sizes-s'), sf = avg('silicoid', { silicoidFix: true }, 'sizes-sf');
    t.near(h.all, 101.9, 0.8, 'human'); t.near(p.all, 129.1, 1.0, 'psilon'); t.near(s.all, 96.1, 0.9, 'silicoid'); t.near(sf.all, 95.4, 0.9, 'silicoid fix');
    [17.4, 14.9, 14.5, 16.8, 16.0, 22.3].forEach((v, f) => t.near(h.per[f], v, 0.35, 'human ' + CODES[f]));
    [22.8, 18.6, 18.1, 21.4, 20.3, 27.8].forEach((v, f) => t.near(p.per[f], v, 0.45, 'psilon ' + CODES[f]));
    t.ok(p.all - h.all > 25, 'Psilons get a much bigger tree');
  });

  t.test('generate: Silicoids never get the NEVER techs (CN 5,15,25,35,45; PL 3,5,6,9,12,13,15,16,18,22,34); the fix list also drops PL 24 and 30', () => {
    const never = [[1, [5, 15, 25, 35, 45]], [3, [3, 5, 6, 9, 12, 13, 15, 16, 18, 22, 34]]];
    let has24 = 0, has30 = 0;
    for (const L of gens('silicoid', 500, 'sil').lists) {
      for (const [f, lv] of never) for (const l of lv) t.ok(!present(L, f, l), 'silicoid offered ' + CODES[f] + l);
      L.forEach(fl => fl.forEach(tr => t.ok(tr.length >= 1)));
      if (present(L, 3, 24)) has24++; if (present(L, 3, 30)) has30++;
    }
    t.ok(has24 > 150 && has30 > 150, 'by default (original behaviour) Silicoids still see PL 24 / 30: ' + has24 + ' / ' + has30);
    for (const L of gens('silicoid', 300, 'sil-fix', { silicoidFix: true }).lists) { t.ok(!present(L, 3, 24) && !present(L, 3, 30)); for (const [f, lv] of never) for (const l of lv) t.ok(!present(L, f, l)); }
    // everybody else does get the never-techs
    const humans = gens('human', 300, 'sil-h').lists;
    t.ok(humans.some(L => present(L, 1, 5)) && humans.some(L => present(L, 3, 16)) && humans.some(L => present(L, 3, 22)) && humans.some(L => present(L, 3, 34)));
    const psilons = gens('psilon', 100, 'sil-p').lists;
    t.ok(psilons.some(L => present(L, 1, 45)));
  });

  t.test('generate: essential-tech check — every returned tree holds an essential tech per flagged field; failing trees come back as null', () => {
    const ess = f => T.byField[f].filter(x => x.essential).map(x => x.level);
    for (const race of ['human', 'psilon', 'silicoid']) for (const L of gens(race, 400, 'ess-' + race).lists) {
      for (let f = 0; f < 6; f++) {
        const flagged = ess(f).filter(l => !(race === 'silicoid' && at(CODES[f], l).never));
        if (flagged.length) t.ok(flagged.some(l => present(L, f, l)), race + ' ' + CODES[f] + ' has none of ' + flagged.join(','));
      }
    }
    // the Silicoid planetology check only counts {32, 42}
    t.deep(T.byField[3].filter(x => x.essential && !x.never).map(x => x.level), [32, 42]);
    // essentialOk on crafted trees
    const ok = gens('human', 1, 'ess-craft').lists[0];
    t.eq(T.essentialOk(ok, 'human'), true);
    for (const [f, levels] of [[0, [8, 18, 28, 38, 48]], [3, [12, 22, 32, 42]], [5, [4, 8, 11, 18, 27, 34, 41, 44]]]) {
      const bad = ok.map((fl, i) => (i === f ? fl.map(tr => tr.filter(l => levels.indexOf(l) < 0)) : fl));
      t.eq(T.essentialOk(bad, 'human'), false, CODES[f]);
    }
    // a scripted dice sequence that keeps exactly one non-essential candidate per tier fails the check → null; one that keeps the essential ones passes
    function scripted(preferEssential) {
      const seq = [];
      for (let f = 0; f < 6; f++) for (let ti = 0; ti < 10; ti++) {
        const cand = T.researchTable[f][ti].slice().reverse();                      // the generator scans from the highest level down, one die per candidate
        const pool = cand.filter(l => !!at(CODES[f], l).essential === preferEssential);
        const keep = (pool.length ? pool : cand)[0];
        cand.forEach(l => seq.push(l === keep ? 1 : 4));
      }
      let i = 0;
      return { int: () => seq[i++] };
    }
    t.eq(T.generateResearchList(scripted(false), 'human'), null);
    const good = T.generateResearchList(scripted(true), 'human');
    t.ok(good && good.length === 6);
    good.forEach(fl => fl.forEach(tr => t.eq(tr.length, 1)));
    // failure rate: a few per cent for humans (≈4.3 %), lower for Psilons (≈0.7 %)
    const hu = gens('human', 1500, 'null-h'), ps = gens('psilon', 1500, 'null-p');
    t.between(hu.nulls / hu.attempts, 0.02, 0.075, 'human null rate'); t.between(ps.nulls / ps.attempts, 0.002, 0.025, 'psilon null rate');
  });

  t.test('generate: deterministic for a seed, different for another', () => {
    const a = T.generateResearchList(M.RNG.create('same'), 'sakkra'), b = T.generateResearchList(M.RNG.create('same'), 'sakkra'), c = T.generateResearchList(M.RNG.create('other'), 'sakkra');
    t.deep(a, b); t.ok(JSON.stringify(a) !== JSON.stringify(c));
    const st = M.RNG.seedState('state-bound'), R = M.RNG.bind(st), before = st.join(',');
    T.generateResearchList(R, 'human'); t.ok(st.join(',') !== before, 'consumes the shared RNG state');
  });

  // =================================================================================================================================
  // 8. js/sim/research.js on top of the data
  // =================================================================================================================================
  const mkS = diff => ({ turn: 1, settings: { diffIdx: diff === undefined ? 2 : diff } });
  function fresh(race, diff, seed, human) {
    const S = mkS(diff), E = { id: 0, race: race || 'human', human: human !== false };
    Rs.init(S, E, M.RNG.create(seed || 'techs-test'));
    return { S, E, rs: E.research };
  }
  const NEVER_DONE = { int: () => 500 };                                              // dice that only complete a project at a probability of 100 %
  const ALWAYS_DONE = { int: () => 1 };

  t.test('research.init: start state, a valid random tree, only tier 1 on offer, default effect values', () => {
    const { E, rs } = fresh('human');
    t.deep(rs.completed, [[1], [1], [1], [1], [1], [1]]);
    t.deep(rs.slider, [20, 10, 15, 15, 20, 20]); t.deep(rs.tl, [1, 1, 1, 1, 1, 1]); t.deep(rs.project, [0, 0, 0, 0, 0, 0]); t.deep(rs.invest, [0, 0, 0, 0, 0, 0]);
    t.eq(rs.list.length, 6);
    for (let f = 0; f < 6; f++) {
      const ch = Rs.choices(E, f);
      t.between(ch.length, 1, 3, CODES[f]);
      ch.forEach(l => t.ok(T.researchTable[f][0].indexOf(l) >= 0));                  // tier 1 only
    }
    t.eq(E.mods.factoryCost, 10); t.eq(E.mods.robotic, 2); t.eq(E.mods.fuel, 3); t.eq(E.mods.scan, 3); t.eq(E.mods.colonyFor, 7); t.eq(E.mods.wasteScale, 10);
    t.eq(E.mods.baseComp, 1); t.eq(E.mods.baseMissile, 1); t.eq(E.mods.baseShield, 1); t.eq(E.mods.baseHp, 0); t.eq(E.mods.warp, 1);     // the whole level-1 bundle is folded in
    t.deep(Object.keys(E.grants).sort(), ['armor:titanium-armor', 'bomb:nuclear-bomb', 'computer:mark-1-computer', 'engine:retro-engine', 'shield:class-1-shield', 'special:battle-scanner',
      'special:reserve-fuel-tanks', 'special:standard-colony-base', 'weapon:heavy-laser', 'weapon:laser', 'weapon:nuclear-missile']);
    const sil = fresh('silicoid', 2, 'init-sil');
    t.ok(!present(sil.rs.list, 1, 5) && !present(sil.rs.list, 3, 3));
  });

  t.test('research.advance: §1.4 worked example — cost 1000, 100 RP/yr → investments 100, 215, 347, 499, 673, 873, 1103', () => {
    const { S, E, rs } = fresh();
    rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 100; rs.project[0] = 2; rs.cost[0] = 1000;
    const inv = [];
    for (let y = 1; y <= 7; y++) { Rs.advance(S, E, NEVER_DONE); inv.push(rs.invest[0]); }
    t.deep(inv, [100, 215, 347, 499, 673, 873, 1103]);
    t.deep(rs.invest.slice(1), [0, 0, 0, 0, 0]);
  });

  t.test('research.breakthroughChance: 5, 18, 33, 48, 63, 78, 93 % in years 7..13, 100 % in year 14; expected completion ≈ 9.6 years', () => {
    const { S, E, rs } = fresh();
    rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 100; rs.project[0] = 2; rs.cost[0] = 1000;
    const chances = [];
    for (let y = 1; y <= 14; y++) { if (y >= 7) chances.push(Rs.breakthroughChance(E, 0)); if (y < 14) Rs.advance(S, E, NEVER_DONE); }
    t.deep(chances.slice(0, 7).map(c => Math.floor(c * 100 + 1e-9)), [5, 18, 33, 48, 63, 78, 93]);
    [25, 92, 167, 242, 317, 392, 467].forEach((v, i) => t.near(chances[i], v / 500, 1e-12, 'year ' + (7 + i)));
    t.eq(chances[7], 1);
    let alive = 1, expected = 0;
    chances.forEach((c, i) => { expected += (7 + i) * alive * c; alive *= 1 - c; });
    t.near(expected, 9.63, 0.05, 'expected completion year');
    // edges of the formula: 0 % at exactly the cost, 50 % at 2x, 100 % at 3x (this year adds 1 RP + 2 interest, so the pile starts 3 short of the target)
    rs.total = 1;
    rs.invest[0] = 1000 - 3; t.eq(Rs.breakthroughChance(E, 0), 0);
    rs.invest[0] = 2000 - 3; t.eq(Rs.breakthroughChance(E, 0), 0.5);
    rs.invest[0] = 3000 - 3; t.eq(Rs.breakthroughChance(E, 0), 1);
    rs.invest[0] = 5000 - 3; t.eq(Rs.breakthroughChance(E, 0), 1);
    rs.project[0] = 0; rs.cost[0] = 0; t.eq(Rs.breakthroughChance(E, 0), 0);
  });

  t.test('research.advance: Monte-Carlo completion time of the worked example averages ≈ 9.6 years, never before year 7', () => {
    const { S, E, rs } = fresh('human', 2, 'mc');
    const R = M.RNG.create('mc-dice'), years = [];
    for (let run = 0; run < 3000; run++) {
      rs.completed[0] = [1]; rs.project[0] = 2; rs.cost[0] = 1000; rs.invest[0] = 0; rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 100; S.ev = [];
      let y = 0;
      for (; y < 40; y++) if (Rs.advance(S, E, R).length) break;
      years.push(y + 1);
    }
    t.near(mean(years), 9.63, 0.12); t.ok(Math.min.apply(null, years) >= 7); t.ok(Math.max.apply(null, years) <= 14);
  });

  t.test('research.advance: completion wastes the overshoot — project 0, investment 1, tech owned, TL and effects refreshed, event pushed', () => {
    const { S, E, rs } = fresh();
    rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 100; rs.project[0] = 5; rs.cost[0] = 1000; rs.invest[0] = 2000;
    const done = Rs.advance(S, E, ALWAYS_DONE);
    t.deep(done, [{ field: 0, level: 5 }]);
    t.eq(rs.project[0], 0); t.eq(rs.invest[0], 1); t.eq(rs.cost[0], 0);
    t.deep(rs.completed[0], [1, 5]); t.eq(rs.tl[0], T.tl(0, [1, 5])); t.eq(E.mods.baseComp, 2);
    const ev = S.ev.filter(e => e.type === 'tech');
    t.eq(ev.length, 1); t.eq(ev[0].id, 'cm-05-battle-computer-2'); t.eq(ev[0].field, 0); t.eq(ev[0].level, 5);
    t.eq(E.grants['computer:mark-2-computer'], true);
  });

  t.test('research.advance: interest is 15 % of the pile but capped at twice this year\'s RP; unfunded piles decay 10 % a year', () => {
    const { S, E, rs } = fresh();
    rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 10; rs.project[0] = 2; rs.cost[0] = 1e9; rs.invest[0] = 10000;
    Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[0], 10000 + 10 + 20);                          // min(1500, 2*10)
    rs.total = 1000; rs.invest[0] = 1000; Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[0], 1000 + 1000 + 150);   // under the cap
    rs.slider = [0, 0, 0, 0, 0, 0]; rs.invest[0] = 1000; Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[0], 900);   // slider 0 → no interest, -10 %
    rs.slider = [100, 0, 0, 0, 0, 0]; rs.total = 0; rs.invest[0] = 1000; Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[0], 900);   // no RP at all
    rs.total = 100; rs.project[0] = 0; rs.cost[0] = 0; rs.invest[0] = 0; Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[0], 90);    // RP into a field without a project decays too
    rs.invest[2] = 500; rs.slider = [0, 0, 0, 0, 0, 0]; Rs.advance(S, E, NEVER_DONE); t.eq(rs.invest[2], 450);
  });

  t.test('research: project cost uses the human formula (difficulty) for the player and the AI formula for AIs', () => {
    const h = fresh('human', 2, 'cost-h');
    t.eq(Rs.projectCost(h.S, h.E, 0, 20), 12000); t.eq(Rs.projectCost(h.S, h.E, 2, 20), 7200); t.eq(Rs.projectCost(h.S, h.E, 3, 20), 9600);
    h.S.settings.diffIdx = 0; t.eq(Rs.projectCost(h.S, h.E, 0, 20), 8000); h.S.settings.diffIdx = 4; t.eq(Rs.projectCost(h.S, h.E, 0, 20), 16000);
    const a = fresh('psilon', 4, 'cost-a', false);
    t.eq(Rs.projectCost(a.S, a.E, 0, 10), T.costAI(10, 'psilon', 0)); t.eq(Rs.projectCost(a.S, a.E, 0, 10), 1600);
    a.S.settings.diffIdx = 0; t.eq(Rs.projectCost(a.S, a.E, 0, 10), 1600);                                // AI RP cost ignores the difficulty
    const ch = Rs.choices(h.E, 4)[0];
    h.S.settings.diffIdx = 2;
    t.eq(Rs.start(h.S, h.E, 4, ch), true); t.eq(h.rs.project[4], ch); t.eq(h.rs.cost[4], T.costHuman(ch, 'human', 4, 2));
    t.eq(Rs.start(h.S, h.E, 4, 50), false);                                                              // not on offer
    t.eq(Rs.start(h.S, h.E, 4, 1), false);
  });

  t.test('research.start: starting from no project keeps the pile, restarting the same project changes nothing, replacing one under way throws the pile away', () => {
    const { S, E, rs } = fresh('human', 2, 'start-semantics');
    rs.list[0] = CMLIKE.map(x => x.slice());                                           // tier 1 offers 2, 4, 5
    rs.invest[0] = 500;                                                                // RP put into an idle field keep accumulating
    t.eq(Rs.start(S, E, 0, 4), true); t.eq(rs.project[0], 4); t.eq(rs.invest[0], 500); t.eq(rs.cost[0], T.costHuman(4, 'human', 0, 2));
    rs.invest[0] = 777; t.eq(Rs.start(S, E, 0, 4), true); t.eq(rs.invest[0], 777); t.eq(rs.project[0], 4);
    t.eq(Rs.start(S, E, 0, 5), true); t.eq(rs.project[0], 5); t.eq(rs.invest[0], 0); t.eq(rs.cost[0], T.costHuman(5, 'human', 0, 2));
    rs.invest[0] = 300; t.eq(Rs.start(S, E, 0, 99), false); t.eq(rs.project[0], 5); t.eq(rs.invest[0], 300);       // an unavailable tech changes nothing
  });

  t.test('research.aiFirst: an AI opens a field with a uniform tier-1 pick whatever the difficulty and pays level² x 50 whatever the race (original quirk, flag ON)', () => { const Q = M.Data.Config.QUIRKS, was = Q.aiFirstTechCost; Q.aiFirstTechCost = true; try {
    for (const race of ['human', 'psilon', 'silicoid', 'meklar']) for (const d of [0, 4]) {
      const { S, E, rs } = fresh(race, d, 'ai-first-' + race, false);
      rs.list[1] = CMLIKE.map(x => x.slice());
      const R = M.RNG.create('ai-first-dice'), seen = {};
      for (let i = 0; i < 300; i++) {
        rs.project[1] = 0; const lvl = Rs.aiFirst(S, E, 1, R);
        seen[lvl] = (seen[lvl] || 0) + 1; t.eq(rs.project[1], lvl); t.eq(rs.cost[1], lvl * lvl * 50);
      }
      t.deep(Object.keys(seen).sort(), ['2', '4', '5']);
      for (const k in seen) t.between(seen[k], 60, 150, race + ' difficulty ' + d + ': level ' + k);
    }
    const { S, E, rs } = fresh('human', 2, 'ai-first-empty', false);
    rs.completed[0] = allLevels(0).concat(55, 60, 65, 70, 75, 80, 85, 90, 95, 100);
    t.eq(Rs.aiFirst(S, E, 0, M.RNG.create(1)), 0);
  } finally { Q.aiFirstTechCost = was; } });

  t.test('research.planetRP: planet output x tech slider, Psilon +50 %, artifacts x2, Orion x4, capped at 32767', () => {
    const pl = (slider, special) => ({ sliders: [0, 0, 0, 0, slider], special: special || '' });
    t.eq(Rs.planetRP({ race: 'human' }, pl(50), 100), 50);
    t.eq(Rs.planetRP({ race: 'psilon' }, pl(50), 100), 75);
    t.eq(Rs.planetRP({ race: 'psilon' }, pl(33), 101), 33 + 16);                                          // integer maths: 33 + floor(33/2)
    t.eq(Rs.planetRP({ race: 'human' }, pl(33), 101), 33);
    t.eq(Rs.planetRP({ race: 'human' }, pl(0), 500), 0);
    t.eq(Rs.planetRP({ race: 'human' }, pl(50, 'artifacts'), 100), 100); t.eq(Rs.planetRP({ race: 'psilon' }, pl(50, 'artifacts'), 100), 150);
    t.eq(Rs.planetRP({ race: 'human' }, pl(50, 'orion'), 100), 200);
    t.eq(Rs.planetRP({ race: 'human' }, pl(100, 'orion'), 100000), 32767);
    for (const r of T.RACE_IDS) t.eq(Rs.planetRP({ race: r }, pl(100), 200), r === 'psilon' ? 300 : 200, r);
  });

  t.test('research.setSlider: the six sliders always sum to 100, locked ones never move, the others give way by the greedy group rule of the original game', () => {
    const { E, rs } = fresh();
    Rs.setSlider(E, 0, 40);
    t.eq(rs.slider[0], 40); t.eq(rs.slider.reduce((a, b) => a + b, 0), 100);
    rs.slider = [20, 10, 15, 15, 20, 20]; rs.lock = [false, true, false, false, false, false];
    Rs.setSlider(E, 0, 95); t.eq(rs.slider[1], 10); t.eq(rs.slider[0], 90); t.deep(rs.slider, [90, 10, 0, 0, 0, 0]);        // clamped by the locked 10
    Rs.setSlider(E, 2, 30); t.eq(rs.slider[1], 10); t.eq(rs.slider.reduce((a, b) => a + b, 0), 100); t.eq(rs.slider[2], 30); t.eq(rs.slider[0], 60);
    rs.slider = [20, 10, 15, 15, 20, 20]; rs.lock = [true, true, true, true, true, false];
    Rs.setSlider(E, 5, 0); t.eq(rs.slider[5], 20); t.eq(rs.slider.reduce((a, b) => a + b, 0), 100);                       // nobody can take the freed share
    rs.lock = [false, false, false, false, false, false]; rs.slider = [100, 0, 0, 0, 0, 0];
    Rs.setSlider(E, 3, 50); t.deep(rs.slider, [50, 0, 0, 50, 0, 0]);
    Rs.equalize(E); t.deep(rs.slider, [16, 17, 17, 16, 17, 17]); t.eq(rs.slider.reduce((a, b) => a + b, 0), 100);
    // the group rule (same as the planet sliders): the others keep their value in index order while the budget lasts, the first that no longer fits is cut
    // to what is left, later ones drop to 0, a surplus goes to the LAST unlocked slider (or to the FIRST one when the moved slider is itself the last)
    const from = () => { rs.slider = [20, 10, 15, 15, 20, 20]; rs.lock = [false, false, false, false, false, false]; };
    from(); Rs.setSlider(E, 0, 40); t.deep(rs.slider, [40, 10, 15, 15, 20, 0]);
    from(); Rs.setSlider(E, 5, 30); t.deep(rs.slider, [20, 10, 15, 15, 10, 30]);
    from(); Rs.setSlider(E, 0, 0); t.deep(rs.slider, [0, 10, 15, 15, 20, 40]);
    from(); Rs.setSlider(E, 5, 0); t.deep(rs.slider, [40, 10, 15, 15, 20, 0]);
    from(); rs.lock[4] = true; Rs.setSlider(E, 1, 40); t.deep(rs.slider, [20, 40, 15, 5, 20, 0]);                           // the locked Propulsion slider keeps its 20, the others fill the remaining 80 in index order (15 fits, the next is cut to 5)
  });

  t.test('research.setSlider: fuzz — sum stays 100, values 0..100, locked sliders untouched, moved slider honours the clamp', () => {
    const { E, rs } = fresh(), R = M.RNG.create('slider-fuzz');
    for (let n = 0; n < 4000; n++) {
      for (let i = 0; i < 6; i++) rs.lock[i] = R.chance(0.3);
      const f = R.int(0, 5); rs.lock[f] = false;
      const before = rs.slider.slice(), v = R.chance(0.1) ? R.range(-50, 200) : R.int(0, 100);
      Rs.setSlider(E, f, v);
      t.eq(rs.slider.reduce((a, b) => a + b, 0), 100, JSON.stringify(rs.slider));
      let locked = 0, free = 0;
      for (let i = 0; i < 6; i++) {
        t.ok(rs.slider[i] >= 0 && rs.slider[i] <= 100 && Math.floor(rs.slider[i]) === rs.slider[i], JSON.stringify(rs.slider));
        if (rs.lock[i] && i !== f) { t.eq(rs.slider[i], before[i], 'locked slider ' + i + ' moved'); locked += before[i]; } else if (i !== f) free++;
      }
      // with every other slider locked the moved one simply keeps what is left
      t.eq(rs.slider[f], free ? Math.min(Math.max(0, Math.min(100, Math.round(v))), 100 - locked) : 100 - locked);
    }
  });

  t.test('research.aiPick: harder AIs lean to the highest level on offer — P(last) = (d-1)/6 + (1-(d-1)/6)/n', () => {
    for (const d of [0, 1, 2, 3, 4]) {
      const { S, E, rs } = fresh('human', d, 'ai-pick', false);
      rs.list[0] = CMLIKE.map(x => x.slice());
      const R = M.RNG.create('ai-pick-dice'), N = 6000; let last = 0;
      for (let i = 0; i < N; i++) { rs.project[0] = 0; const lvl = Rs.aiPick(S, E, 0, R); t.ok(lvl === 2 || lvl === 4 || lvl === 5); t.eq(rs.project[0], lvl); t.eq(rs.cost[0], T.costAI(lvl, 'human', 0)); if (lvl === 5) last++; }
      const pf = Math.max(0, d - 1) / 6;
      t.near(last / N, pf + (1 - pf) / 3, 0.025, 'difficulty ' + d);
    }
    const { S, E, rs } = fresh('human', 4, 'ai-pick-empty', false);
    rs.completed[0] = allLevels(0).concat(55, 60, 65, 70, 75, 80, 85, 90, 95, 100); rs.list[0] = T.researchTable[0].map(x => x.slice(0, 3));
    t.eq(Rs.aiPick(S, E, 0, M.RNG.create(1)), 0);                                                         // nothing left to pick
  });

  t.test('research.recompute: owning every tech gives the best value of every effect key, every grant, and TL 71/64/63/69/67/86', () => {
    const { E, rs } = fresh();
    for (let f = 0; f < 6; f++) rs.completed[f] = allLevels(f);
    Rs.recompute(E);
    const m = E.mods;
    t.eq(m.factoryCost, 2); t.eq(m.robotic, 7); t.eq(m.wasteScale, 0); t.eq(m.ecoRestore, 20); t.eq(m.fuel, 30); t.eq(m.scan, 9); t.eq(m.transportSpeed, 8); t.eq(m.warp, 9);
    t.eq(m.colonyFor, 1); t.eq(m.terraform, 120); t.eq(m.terraformCost, 2); t.eq(m.incPopCost, 5); t.eq(m.antidote, 2); t.eq(m.planetShield, 20); t.eq(m.planetShieldCost, 2000);
    t.eq(m.baseHp, 6); t.deep(m.ground, { armor: 6, suit: 3, shield: 3, weapon: 5 });
    for (const k of ['stargate', 'interdictor', 'combatTransporter', 'hyperComm', 'scanFleetInfo', 'advScanner', 'soil', 'advSoil', 'atmos', 'bioDefense']) t.eq(m[k], true, k);
    t.eq(m.baseComp, 11); t.eq(m.baseEcm, 10); t.eq(m.baseShield, 15); t.eq(m.baseMissile, 8); t.eq(m.baseScatter, 3); t.eq(m.tlOnly, undefined);
    t.deep(rs.tl, [71, 64, 63, 69, 67, 86]);
    for (const k of ['weapon:plasma-torpedo', 'weapon:heavy-phasor', 'armor:neutronium-armor', 'shield:class-15-shield', 'computer:mark-11-computer', 'ecm:ecm-10', 'engine:hyperthrust-engine',
      'special:displacement-device', 'special:radiated-colony-base', 'bomb:bio-terminator', 'bomb:neutronium-bomb', 'special:advanced-damage-control']) t.eq(E.grants[k], true, k);
    t.eq(E.grants['weapon:death-ray'], undefined);
    // every part of every tech (the whole level-1 bundle included) is granted, the Orion-only Death Ray is not
    const want = {};
    for (const x of T.list) if (!x.special) x.grants.forEach(g => { want[g.kind + ':' + g.id] = true; });
    t.deep(Object.keys(E.grants).sort(), Object.keys(want).sort());
    t.eq(Object.keys(want).length, 127);
  });

  t.test('research.recompute: the best tech of each family wins (lowest factory cost / waste / colony type, highest everything else, paired terraform price)', () => {
    const { E, rs } = fresh();
    const own = (f, levels) => { rs.completed[f] = [1].concat(levels); Rs.recompute(E); return E.mods; };
    let m = own(1, [3, 8, 13]); t.eq(m.factoryCost, 7);
    m = own(1, [13, 3]); t.eq(m.factoryCost, 7);
    m = own(1, [5, 15]); t.eq(m.wasteScale, 6);
    m = own(3, [2, 8]); t.eq(m.terraform, 20); t.eq(m.terraformCost, 5);
    m = own(3, [14]); t.eq(m.terraform, 30); t.eq(m.terraformCost, 4);
    m = own(3, [14, 8, 2]); t.eq(m.terraform, 30); t.eq(m.terraformCost, 4);
    m = own(3, [2, 8, 14, 20, 26, 32, 38, 44, 50]); t.eq(m.terraform, 120); t.eq(m.terraformCost, 2);
    m = own(3, [3, 18, 9]); t.eq(m.colonyFor, 1);
    m = own(3, [6]); t.eq(m.colonyFor, 5);
    m = own(3, [21]); t.eq(m.incPopCost, 10); m = own(3, [21, 42]); t.eq(m.incPopCost, 5);
    m = own(3, [30]); t.eq(m.advSoil, true); t.eq(m.soil, undefined); t.eq(m.atmos, undefined);
    m = own(3, [16]); t.eq(m.soil, true); t.eq(m.advSoil, undefined);
    m = own(2, [12, 22]); t.eq(m.planetShield, 10); t.eq(m.planetShieldCost, 1000);
    m = own(2, [42, 12]); t.eq(m.planetShield, 20); t.eq(m.planetShieldCost, 2000);
    m = own(1, [10, 11, 17, 24]); t.deep(m.ground, { armor: 2, suit: 2, shield: 0, weapon: 0 }); t.eq(m.baseHp, 2);
    m = own(4, [3, 9]); t.eq(m.fuel, 6);
    m = own(4, [6, 12, 18]); t.eq(m.transportSpeed, 3); t.eq(m.warp, 4);
    m = own(0, [4, 13]); t.eq(m.scan, 7); t.eq(m.scanFleetInfo, true); t.eq(m.advScanner, undefined);
    m = own(3, [17]); t.eq(m.antidote, 1); t.eq(m.bioDefense, true);
  });

  t.test('research.grant: a granted tech widens the choice window; a granted Death Ray adds its weapon, the loot event carries the tech id', () => {
    const { S, E, rs } = fresh('human', 2, 'grant');
    rs.list[5] = CMLIKE.map(x => x.slice());
    t.deep(Rs.choices(E, 5), [2, 4, 5]);
    t.eq(Rs.grant(S, E, 5, 14, 'loot'), true);
    t.eq(Rs.grant(S, E, 5, 14, 'loot'), false);                                                         // already owned
    t.deep(Rs.choices(E, 5), [2, 4, 5, 7, 8, 10, 12, 13, 15, 17, 18, 20]);                             // tmax 14 → tiers 1-4 visible (12 entries)
    t.eq(E.grants['weapon:merculite'], true); t.eq(E.mods.baseMissile, 4);
    t.eq(Rs.grant(S, E, 5, 36, 'orion'), true);
    t.eq(E.grants['weapon:death-ray'], true);
    t.deep(rs.completed[5], [1, 14, 36]); t.eq(rs.tl[5], T.tl(5, [1, 14, 36]));
    const ev = S.ev.filter(e => e.type === 'tech' && e.level === 36);
    t.eq(ev.length, 1); t.eq(ev[0].id, 'we-36-death-ray'); t.eq(ev[0].source, 'orion');
    // receiving the tech under research clears the project and resets the pile to 1
    rs.project[0] = 5; rs.invest[0] = 777; rs.cost[0] = 750;
    t.eq(Rs.grant(S, E, 0, 5, 'spy'), true); t.eq(rs.project[0], 0); t.eq(rs.invest[0], 1); t.eq(rs.cost[0], 0);
  });

  t.test('research: a whole game of research — every field ends with its tree plus Advanced Tech I..X at tech level 99, nothing left to choose', () => {
    for (const race of ['human', 'psilon', 'silicoid']) {
      const { S, E, rs } = fresh(race, 2, 'full-' + race);
      rs.total = 4000000; rs.slider = [16, 17, 17, 16, 17, 17];
      const R = M.RNG.create('full-dice-' + race);
      const size = rs.list.map(tiers => tiers.reduce((a, tr) => a + tr.length, 0));
      let year = 0, adv = [[], [], [], [], [], []];
      for (; year < 500; year++) {
        let open = 0;
        for (let f = 0; f < 6; f++) {
          if (!rs.project[f]) { const ch = Rs.choices(E, f); if (ch.length) Rs.start(S, E, f, ch[0]); }
          if (rs.project[f]) open++;
        }
        if (!open) break;
        for (const d of Rs.advance(S, E, R)) if (d.level > 50) adv[d.field].push(d.level);
      }
      t.ok(year < 500, race + ': research never finished');
      for (let f = 0; f < 6; f++) {
        t.eq(rs.completed[f].length, 1 + size[f] + 10, race + ' ' + CODES[f]);
        t.deep(adv[f], [55, 60, 65, 70, 75, 80, 85, 90, 95, 100], race + ' ' + CODES[f] + ' advanced order');
        t.eq(rs.tl[f], 99); t.deep(Rs.choices(E, f), []);
      }
      t.eq(E.mods.tlOnly, true);
    }
  });
};
