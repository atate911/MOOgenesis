// Master of Orion - Reborn - name pools (original text, DOM-free). Exposes MOO.Data.names.
//
// Shape (all strings are plain ASCII; no digits in star names):
//   stars           [string]            ~340 distinct star-system names (traditional + invented). "Orion" is deliberately absent (reserved).
//   homeworldStars  {raceId: string}    default home-system name per race (only "Sol" also appears in `stars`; dedupe in galaxy gen)
//   homeworlds      {raceId: string}    default homeworld name per race (one word)
//   leaders         {raceId: [string]}  24 leader names per race (single names or "Name Epithet")
//   leaderTitles    {raceId: string}    how a leader is styled, e.g. "Hive-Voice"
//   shipNames       {raceId: [string]}  30 evocative individual ship names per race
//   fleetNames      [string]            20 generic fleet names
//   monsters        {guardian, guardianAliases[], amoeba[3], crystal[3], hydra[3], dragon[3], antaran[6]}
//   councilTitles   [string]            12 pompous titles for the elected galactic ruler
(function (M) {
  'use strict';

  const stars = [
    // ---- traditional / real star names ----
    'Sol', 'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella', 'Rigel', 'Procyon', 'Achernar', 'Betelgeuse',
    'Hadar', 'Altair', 'Acrux', 'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Deneb', 'Mimosa',
    'Regulus', 'Adhara', 'Castor', 'Gacrux', 'Shaula', 'Bellatrix', 'Elnath', 'Miaplacidus', 'Alnilam', 'Alnair',
    'Alnitak', 'Alioth', 'Dubhe', 'Mirfak', 'Wezen', 'Sargas', 'Avior', 'Alkaid', 'Menkalinan', 'Atria',
    'Alhena', 'Peacock', 'Mirzam', 'Alphard', 'Polaris', 'Hamal', 'Algieba', 'Diphda', 'Mizar', 'Nunki',
    'Menkent', 'Mirach', 'Alpheratz', 'Rasalhague', 'Kochab', 'Saiph', 'Denebola', 'Algol', 'Suhail', 'Alphecca',
    'Mintaka', 'Sadr', 'Eltanin', 'Schedar', 'Naos', 'Almach', 'Caph', 'Izar', 'Merak', 'Ankaa',
    'Enif', 'Scheat', 'Sabik', 'Phecda', 'Aludra', 'Markab', 'Albireo', 'Alcor', 'Alcyone', 'Atlas',
    'Electra', 'Maia', 'Merope', 'Taygeta', 'Pleione', 'Celaeno', 'Thuban', 'Rastaban', 'Alderamin', 'Alfirk',
    'Errai', 'Mebsuta', 'Tejat', 'Propus', 'Wasat', 'Biham', 'Homam', 'Matar', 'Sadalsuud', 'Skat',
    'Ancha', 'Situla', 'Alshain', 'Tarazed', 'Zosma', 'Chertan', 'Arkab', 'Ascella', 'Cebalrai', 'Unukalhai',
    'Alya', 'Gienah', 'Algorab', 'Kraz', 'Minkar', 'Alchiba', 'Porrima', 'Vindemiatrix', 'Heze', 'Syrma',
    'Zavijava', 'Zaniah', 'Mufrid', 'Seginus', 'Nekkar', 'Edasich', 'Giausar', 'Chara', 'Talitha', 'Muscida',
    'Phad', 'Megrez', 'Mira', 'Menkar', 'Zaurak', 'Rana', 'Acamar', 'Beid', 'Keid', 'Cursa',
    'Zibal', 'Arneb', 'Nihal', 'Furud', 'Phact', 'Wazn', 'Mekbuda', 'Alzirr',

    // ---- invented: soft, Latinate ----
    'Aurelis', 'Belmora', 'Caldora', 'Delvane', 'Elarion', 'Faldrin', 'Galdren', 'Haldora', 'Ilmeris', 'Jovanth',
    'Kestrane', 'Lunaris', 'Marendi', 'Nolvaris', 'Ostelle', 'Quenara', 'Revelin', 'Soravia', 'Tavernis', 'Ulderan',
    'Valmora', 'Westenra', 'Zorinth', 'Amberon', 'Brevane', 'Calithra', 'Dorvenna', 'Esmara', 'Fennora', 'Gavrenne',
    'Hesperon', 'Illiandra', 'Jessamy', 'Kalmara', 'Lorvane', 'Mirelle', 'Navaris', 'Obernis', 'Pyrenth', 'Quillon',
    'Rovena', 'Saphrel', 'Talvera', 'Umbrane', 'Vexilla', 'Wendral', 'Xandrel', 'Ysolane', 'Zephyrine', 'Cassivane',

    // ---- invented: hard, industrial, martial ----
    'Brakkar', 'Drovath', 'Garrak', 'Hrungar', 'Korvane', 'Mordai', 'Skarrow', 'Thundrak', 'Urrakai', 'Vorgath',
    'Zhakar', 'Kragmoor', 'Dunmarrow', 'Grimholt', 'Ironvale', 'Ashgrave', 'Cindermar', 'Embermoor', 'Granthos', 'Rimvale',
    'Brynhold', 'Dannoch', 'Meshkar', 'Urdane', 'Kelthane', 'Jorvane', 'Praxell', 'Tolvane', 'Morvain', 'Oskarra',

    // ---- invented: compound, homely, evocative ----
    'Emberfall', 'Stormreach', 'Thornwick', 'Brightwater', 'Cinderhall', 'Dawnmark', 'Eventide', 'Frostmere', 'Goldmoor', 'Hollowmere',
    'Larkspur', 'Moonbridge', 'Oakhaven', 'Silverreach', 'Tidewrack', 'Umberfield', 'Starhollow', 'Windmere', 'Yarrowdale', 'Arkenfell',
    'Ironhollow', 'Jadewater', 'Kingsmarch', 'Lanternfall', 'Marrowgate', 'Nettlemoor', 'Oldhaven', 'Pinewatch', 'Quarrydeep', 'Rookhaven',
    'Saltspire', 'Thistledown', 'Undercroft', 'Vesperlane', 'Wrenfield', 'Yewhollow', 'Aldmere', 'Harrowmere', 'Glimmerdeep', 'Highmarrow',
    'Wintermark', 'Sundermere', 'Dellamar', 'Edrimont', 'Parlowe', 'Rasmere', 'Eldervane', 'Farrowen', 'Brindle', 'Corvane',

    // ---- invented: exotic, far-flung ----
    'Ixthara', 'Qalamar', 'Zyphon', 'Tavuun', 'Okaris', 'Yaldabar', 'Nuvakh', 'Pelagon', 'Xerith', 'Vhalor',
    'Quorrin', 'Uzmael', 'Zenkara', 'Xylith', 'Kharzul', 'Draxxon', 'Fhalara', 'Gyrel', 'Hyvern', 'Jhazad',
    'Lhoran', 'Mharak', 'Nhalis', 'Ohmara', 'Phyrros', 'Qhenet', 'Rhazul', 'Sythar', 'Thyrax', 'Vyrnax',
    'Wharn', 'Xhorda', 'Yzmir', 'Zhelos', 'Alvenar', 'Dremmen', 'Eskarra', 'Fyrnal', 'Heliara', 'Iskarra',
    'Lysenne', 'Nysaria', 'Quendar', 'Sorrelan', 'Ulmenar', 'Vesterra', 'Wynthar', 'Xanthea', 'Yarrowen', 'Zelvane',

    // ---- invented: bright words and gentle names ----
    'Bellwether', 'Calliope', 'Dulcet', 'Fairhaven', 'Gossamer', 'Idlewild', 'Juniper', 'Kismet', 'Lodestar', 'Meridian',
    'Nightingale', 'Opaline', 'Quicksilver', 'Solstice', 'Tranquil', 'Verity', 'Ambrosyne', 'Beryllis', 'Cobalten', 'Dioptra',
    'Eclipsa', 'Fulgora', 'Gnomon', 'Ionis', 'Jasperon', 'Lumera', 'Magnara', 'Nebulara', 'Obsidara', 'Pulsara',
    'Quasaris', 'Radiance', 'Tesseris', 'Zodiara', 'Heliora', 'Vortessa', 'Zarathel', 'Cormaris', 'Ordaine', 'Taverel',
    'Valtoria', 'Quistara', 'Norvane', 'Leonoris', 'Kelvaris', 'Ithrane', 'Sunderlay', 'Ravenmoor', 'Whitlow', 'Cressida',
  ];

  // Race ids: alkari bulrathi darlok human klackon meklar mrrshan psilon sakkra silicoid
  const homeworldStars = {
    alkari: 'Cirrath', bulrathi: 'Gorrim', darlok: 'Nyxara', human: 'Sol', klackon: 'Tzikara',
    meklar: 'Kyberon', mrrshan: 'Shrakesh', psilon: 'Lexara', sakkra: 'Kessarat', silicoid: 'Ammerath',
  };

  const homeworlds = {
    alkari: 'Kyrrelai', bulrathi: 'Ursheim', darlok: 'Veshaal', human: 'Tellus', klackon: 'Zhirrak',
    meklar: 'Ferrodine', mrrshan: 'Khaizar', psilon: 'Theorica', sakkra: 'Sethrava', silicoid: 'Lithara',
  };

  const leaderTitles = {
    alkari: 'Sky Sovereign', bulrathi: 'Hearthlord', darlok: 'Veilmaster', human: 'Chancellor', klackon: 'Hive-Voice',
    meklar: 'Prime Director', mrrshan: 'Pridelord', psilon: 'Archscholar', sakkra: 'Clutchlord', silicoid: 'Grand Lattice',
  };

  const leaders = {
    alkari: [
      'Skirael the Highborne', 'Tavienne', 'Aurekai', 'Kestrelle', 'Ysskaar Longwing', 'Pelliar', 'Orreleth', 'Quillora',
      'Serapheen', 'Corvane Dawnfeather', 'Larkhest', 'Aelwyn Skyborn', 'Thissaly', 'Vaelisk', 'Ruaviel', 'Zephiren',
      'Talonne', 'Cirruin the Unperched', 'Halcyris', 'Pinionelle', 'Eyrinn', 'Falconel', 'Mirellai Goldcrest', 'Ibisar',
    ],
    bulrathi: [
      'Brundar', 'Hrolgar Deepfang', 'Korgath', 'Ulgrim', 'Brogdan', 'Vrakka', 'Dunmar', 'Rhogash',
      'Yorgath', 'Kodiak the Unmoved', 'Gorrund the Vast', 'Mhorak', 'Throdain', 'Ulfrek', 'Brannoch', 'Dorgoth',
      'Hulgar Winterhide', 'Ormund', 'Skorvald', 'Grumbarn', 'Torvak Ironpelt', 'Mokhara', 'Haldrek', 'Drogmar the Hearthbound',
    ],
    darlok: [
      'Veyl', 'Sethrik', 'Nyssara', 'Shadrael', 'Mirrow', 'Thessik', 'Vesperel', 'Sylvareth',
      'Ilvane the Unseen', 'Zhael', 'Umbrisa', 'Kaelvesh', 'Dravenna', 'Nethrel', 'Silvash', 'Morvessa',
      'Quillion Veil', 'Sorrel the Veiled', 'Ysmene the Silent', 'Dahlquin Nightsworn', 'Wraithe', 'Pellamar', 'Obscura Vane', 'Tessel the Unrecorded',
    ],
    human: [
      'Isadora Venn', 'Cassian Holt', 'Maren Ashby', 'Tobias Wren', 'Lucinda Frost', 'Alaric Penhallow', 'Soraya Quill', 'Dimitri Vance',
      'Odalys Marr', 'Everett Strand', 'Keiko Lindqvist', 'Fabian Crowe', 'Imani Thorne', 'Rafael Montclair', 'Genevieve Lark', 'Anselm Rook',
      'Thea Calloway', 'Basil Hargreave', 'Noor Whitlock', 'Cormac Dray', 'Philippa Stone', 'Jasper Ellery', 'Yara Voss', 'Desmond Albright',
    ],
    klackon: [
      'Klixxa', 'Thrik-Ora', 'Zzentha', 'Chorrik', 'Kvessa', 'Brak-Zhi', 'Xirrik', 'Quilth',
      'Chitral', 'Zzirik', 'Tkavo', 'Skritch-Ula', 'Klaxo', 'Vorrik-Tsa', 'Chelka', 'Thoraxa',
      'Zhizzik', 'Kekkri', 'Carapex', 'Skitterix', 'Tetrak', 'Mandrel-Ko', 'Tsk-Varrow', 'Pulsar-of-the-Third-Brood',
    ],
    meklar: [
      'Vektor-Prime', 'Ferrix', 'Kallibrax', 'Axiom Rho', 'Quantor', 'Ferrovane', 'Vanadis', 'Titanor',
      'Cobaltus', 'Chromax', 'Dynamar', 'Mechrone', 'Hexalor', 'Servok', 'Alloyon', 'Torquen',
      'Gantry-Prime', 'Ordinator Vex', 'Tolerance', 'Kyberan', 'Foundrius', 'Duraxis', 'Calibrus Prime', 'Synthor',
    ],
    mrrshan: [
      'Mrrava', 'Shaarik', 'Rrakhesh', 'Tzarra', 'Khaishari', 'Murrakesh', 'Sreeva', 'Nashriq Duskpaw',
      'Rhishra the Patient', 'Khazaar Swiftclaw', 'Sorrahn', 'Zhrissa', 'Prrasha', 'Mraikhan', 'Sahkrii', 'Ruukesh',
      'Thrassa', 'Kheerak', 'Mrrowen', 'Zhaarin', 'Ashkeri', 'Rrhuun Silentstep', 'Sshavra', 'Tsarrai',
    ],
    psilon: [
      'Epistemon', 'Thessaloren', 'Eudoxeus', 'Pythanor', 'Anaximon', 'Lexandrine', 'Praxeon', 'Ontharis the Unrefuted',
      'Syllogos', 'Oraxis the Correct', 'Vellum the Peerless', 'Asclepian the Always-Right', 'Cogitor', 'Theorema', 'Axiomara', 'Quillibert the Cited',
      'Heuristes', 'Dialecta', 'Methodius', 'Corollarian', 'Empiricus', 'Taxonomar', 'Mathesis', 'Postulus',
    ],
    sakkra: [
      'Ssarrik', 'Kasshan', 'Zeshra', 'Thessk', 'Ssikkara', 'Vashkrel', 'Sskor-Ta', 'Rasskin',
      'Hekassa', 'Ssurahl', 'Kethis', 'Zzaressh', 'Vessikar', 'Ssarrik the Many-Clutched', 'Kasha Sunbasker', 'Ixxara',
      'Sauresh', 'Tarsskel', 'Zhesska', 'Ssevrak', 'Krassa', 'Thaskor', 'Hissandra', 'Ssethik the Unhatched',
    ],
    silicoid: [
      'Aaluum', 'Beryl-of-Tides', 'Corund', 'Geodrel', 'Quarzhaan', 'Ammolith', 'Veluum', 'Thaaloreen',
      'Prismaul', 'Sillimar', 'Oolith', 'Haamoth', 'Drusen', 'Pyrrhelos', 'Amethaal', 'Beryllian',
      'Corundar', 'Ilmenar', 'Zirconel', 'Selenaum', 'Talcoom', 'Baryton', 'Third Resonance', 'Slow-Chord-of-Dusk',
    ],
  };

  const shipNames = {
    alkari: [
      'Dawnspire', 'Cloudpiercer', 'Highwind Accord', 'Gilded Talon', 'Aerie Eternal', 'Zenith Plume', 'Skyward Oath', 'Feathered Thunder',
      'Lofty Disdain', 'Cirrus Regent', 'Needle of Dawn', 'Updraft Sovereign', 'Crown of Plumes', 'Third Wind', 'Gale Regent', "Eyrie's Verdict",
      'Thermal Majesty', 'Silver Pinion', 'Peregrine Edict', 'Sunlit Perch', 'Stormcrest', 'Azure Talon', 'Haughty Ascent', 'Gossamer Lance',
      'Windborne Duty', 'Plume of Reckoning', 'High Court', 'Cloudhammer', 'Soaring Pedigree', 'Dusk Raptor',
    ],
    bulrathi: [
      'Hearthbreaker', "Winter's Fist", 'Thunder Den', 'Oathmaw', 'Ironpelt', 'Great Hibernation', "Mountain's Wrath", 'Frostfang',
      'Boulder Prince', 'Grudgekeeper', 'Clanfather', 'Saga of Embers', 'Iron Covenant', 'Bellow of Ages', 'Deep Cavern', 'Stonehide',
      'Avalanche', "Mammoth's Reply", 'Clawmarch', 'Hungry Winter', 'Elder Oath', 'Anvil Tide', 'Longhouse', 'Granite Roar',
      'Hammerfall', 'Warhorn', 'Snowbound Vengeance', 'Elder Claw', 'Cairnbreaker', 'Thorn Crown',
    ],
    darlok: [
      'Whispered Ledger', 'Velvet Knife', 'Moth in Glass', 'Lantern Unlit', 'Quiet Arithmetic', 'Masked Tide', 'Shade Broker', 'Hollow Key',
      'Ninth Alibi', 'Dusk Contract', 'The Unrecorded', 'Sealed Envelope', 'Midnight Dividend', 'Pale Informant', 'Cipher Wake', 'Shuttered Window',
      'Smoke Without Fire', 'Thin Veil', 'Footnote of Ash', 'Last Rumor', 'Silent Auction', 'Gloved Hand', 'Counterfeit Dawn', 'Quill and Dagger',
      'Shadowed Bargain', 'Thread of Secrets', 'Opaque Intent', 'Cloak of Midnight', 'Pocketed Moon', 'Unlit Corridor',
    ],
    human: [
      'Fair Bargain', 'Gilded Handshake', 'Silver Tongue', 'Lucky Margin', 'Good Faith Effort', 'Open Hand', 'Parley', 'Honest Broker',
      'Second Chance', 'Resolute Hope', 'Compromise', 'Long Odds', 'Final Offer', 'Bright Prospect', "Gambler's Dawn", 'Charter of Stars',
      'Neighborly Concern', 'Diplomatic Immunity', 'Happy Accident', 'Unexpected Ally', 'Safe Passage', 'Olive Branch', 'Treaty of Tomorrow', 'Wild Card',
      'Persuader', "Fortune's Envoy", 'Handshake Protocol', 'Better Terms', 'Plan B', 'The Last Word',
    ],
    klackon: [
      'Chamber Eight', 'Ceaseless Tunnel', 'Clattering Dawn', 'Tenfold Labor', 'Amber Colonnade', 'Honeycomb Resolve', 'Brood Anthem', 'Many-Legged Ambition',
      'Gleaming Mandible', 'Union of Shells', 'Endless Shift', 'The Work Continues', 'Lattice of Claws', 'Swarm Chorus', 'Tireless Wing', 'Working Hymn',
      'Voice of Many', 'Carapace Harmony', 'Thousand Hands', 'Clicking Thunder', 'Pollen Road', 'Gallery of Wax', 'One Great Task', 'Resin Sovereign',
      'Marching Orders', 'Mound Triumphant', 'Antennae Raised', "Foragers' Pride", 'Diligent Storm', 'Shared Burden',
    ],
    meklar: [
      'Perfect Tolerance', 'Torque Imperative', 'Efficiency Absolute', 'Cold Furnace', 'Iron Syllogism', 'Output Maximal', 'Forge Meridian', 'Ratio Eternal',
      'Servo Majesty', 'Quota Fulfilled', 'Titan Assembly', 'Calibrated Fury', 'Obsidian Mill', 'Weld and Pinnacle', 'Gear of Ages', 'Zero Defect',
      'Lathe of Dawn', 'Chrome Verdict', 'Inevitable Yield', 'Precision Unbound', 'Alloy Throne', 'Overclocked Zeal', 'Rivet Storm', 'Optimal Path',
      'Flawless Cog', 'Smelter Prime', 'Linear Progress', 'Autonomous Will', 'Piston Dynasty', 'Final Specification',
    ],
    mrrshan: [
      'Silent Pounce', 'Moonlit Stalk', 'Claws of Dusk', "Hunter's Grace", 'Velvet Fang', 'Prowler Eternal', 'Tall Grass', 'Amber Eye',
      'Sunset Ambush', 'Whisker Storm', 'Pride Unbroken', 'Nine Lives', 'The Long Stalk', 'First Kill', 'Dawn Prowl', 'Thorn Paw',
      'Crescent Leap', 'Gleaming Whisker', 'Shadow Runner', 'Great Hunt', 'Treetop Ghost', 'Purring Doom', 'Tawny Fury', 'Roar of the Pride',
      'Lunar Predator', 'Quiet Paws', 'Spotted Thunder', "Stalker's Moon", 'Fang and Ember', 'Alpha Prowl',
    ],
    psilon: [
      'Footnote', 'Quod Erat Demonstrandum', 'Peer Reviewed', 'Unrefuted Hypothesis', 'Axiom Ascendant', 'Elegant Proof', 'Lemma', 'Thesis Armed',
      'Rigorous Doubt', 'Corollary', 'Marginalia', 'Obvious Conclusion', 'Superior Methodology', 'Citation Pending', 'Grand Theorem', 'Empirical Wrath',
      'Controlled Variable', 'Syllogism of Fire', 'Erudite Fury', 'Appendix of Doom', 'Null Hypothesis Denied', 'Footnote of Doom', 'Dissertation', 'Curious Conclusion',
      'Theory Applied', 'Correct Again', 'Learned Disdain', 'Postulate', 'Journal of Impact', 'Final Examination',
    ],
    sakkra: [
      'Clutch of Fire', 'Hatchling Tide', 'Basking Wrath', 'Sunscale', 'Ten Thousand Eggs', 'Brood Ascendant', 'Hissing Dawn', 'Molten Scale',
      'Fang of the Sun', 'Dune Serpent', 'Warm Rock Triumph', 'Swarm of Tails', 'Egg Tooth', 'Evening Molt', 'Many Hatchlings', 'Scale and Ember',
      'Sandstorm Brood', 'Crest of the Brood', 'Cold-Blooded Verdict', 'Venom Dawn', 'Nest Aflame', 'Burrow Thunder', 'Tail Lash', 'Sun-Baked Vengeance',
      "Serpent's Reach", 'Third Clutch', 'Thousand Scales', 'Coil and Strike', 'Heat Haze', "Clutchmother's Wrath",
    ],
    silicoid: [
      'Slow Chord', 'Facets of Dusk', 'Geode Meditation', 'Resonant Patience', 'Deep Lattice', 'Fault Line', 'Crystalline Verdict', 'Aeon Cleave',
      'Hum of Strata', 'Prism Eternal', 'Pressure Dream', 'Lattice of Ages', 'Sediment Throne', 'The Long Cooling', 'Quartz Intention', 'Slow Avalanche',
      'Seam of Ages', 'Echoing Cleft', 'Glacial Thought', 'Faceted Silence', 'Vein of Stars', 'Tectonic Courtesy', 'Patient Shard', 'Mineral Doctrine',
      'Opaline Drift', 'Cave of Echoes', 'Century Hum', 'Cooling Crown', 'Refracted Sun', 'Fracture Sovereign',
    ],
  };

  const fleetNames = [
    'Vanguard', 'Wanderers', 'Longwatch', 'Ember Armada', 'Cinder Guard', 'Starlit Host', 'Meridian Flotilla', 'Silent Reach',
    'Iron Tide', 'Pale Lanterns', 'Far Horizon', 'Radiant Wake', 'Dawn Patrol', 'Deepwatch', 'Hammer Squadron', 'Gilded Armada',
    'Rimrunners', 'The Long Patrol', 'Shield Wall', 'Sunward Host',
  ];

  const monsters = {
    guardian: 'The Guardian',
    guardianAliases: ['The Orion Guardian', 'Warden of the Ancient Gate', 'The Eternal Sentry', 'Keeper of the Vault'],
    amoeba: ['Void Amoeba', 'The Drifting Maw', 'Great Protoplast'],
    crystal: ['Shard Leviathan', 'The Singing Crystal', 'Prism Colossus'],
    hydra: ['Void Hydra', 'The Nine-Maw', 'Starcoil Hydra'],
    dragon: ['Void Dragon', 'Ember Wyrm', 'Nebula Drake'],
    antaran: ['Riftskimmer', 'Veilblade', 'Voidlancer', 'Umbral Cruiser', 'Harbinger', 'Eclipse Dreadnought'],
  };

  const councilTitles = [
    'Supreme Arbiter of the Known Stars',
    'Lord High Gavel-Bearer of the Spiral Arm',
    'Grand Chair of Absolutely Everything',
    'Eminent Custodian of the Galactic Commons',
    'Most Serene Overseer of Concord and Paperwork',
    'Exalted Convener of the Thousand Delegations',
    'Imperial Sovereign of the Starlit Parliament',
    'First Among Equals, Second to None',
    'Illustrious Warden of the Quorum',
    'High Chancellor of the Cosmos (Provisional)',
    'Most Honorable Keeper of the Minutes',
    'Eternal Moderator of the Great Debate',
  ];

  M.Data.names = {
    stars, homeworldStars, homeworlds, leaders, leaderTitles, shipNames, fleetNames, monsters, councilTitles,
  };
})(window.MOO);
