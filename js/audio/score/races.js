// Master of Orion — Reborn · the score · the races
// One theme per race for the audience chamber, and the hostile readings the engine derives from them (Music._warVariant: darker mode, lower key, faster, brass and martial drums).
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  // ================================================================== diplomacy race themes (45-70 s loops)
  Track('race:alkari', {
    desc: 'Alkari: airy flute over harp-like plucks, soaring major pentatonic and wind chimes',
    motif: '5:1.5 8:.5 6:1 5:1 | 9:1.5 8:.5 6:1 5:1', motifInst: 'flute',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 88, trim: 1.98, root: 'G', mode: 'major', tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'airPad', bass: 'deep', lead: 'flute', lead2: 'glass', arp: 'kora', bell: 'glass' },
    ph: {
      AL1: '5:1.5 8:.5 6:1 5:1 | 9:1.5 8:.5 6:1 5:1 | 10:1.5 9:.5 8:1 6:1 | 5:1.5 6:.5 8:2',
      AL2: '8:.5 9:.5 10:1 9:1 8:1 | 10:.5 12:.5 13:1 12:1 10:1 | 9:.5 10:.5 12:1 10:1 9:1 | 8:4',
      AL3: '6:2 5:1 3:1 | 5:2 6:2 | 8:3 6:1 | 5:4',
      AL4: '8:2 6:1 5:1 | 6:2 8:2 | 10:3 8:1 | 9:4',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.75, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'whole', lead: 'AL1 AL2', arp: { pat: '0121', res: 2, vel: 0.4, reg: [55, 79] }, drums: { shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'vi IV I V | vi IV I V', pad: 'sus', bass: 'half', lead: 'AL3 AL4', arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.3, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 0.85, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'half', lead: 'AL1 AL2', lead2: { ph: 'AL1 AL2', inst: 'glass', oct: 0, vel: 0.3 }, arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.25, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
    ],
  });

  // The Bulrathi (rewritten from nothing): hulking bear-like warriors, slow to anger and slower to befriend, gardeners at heart ("Nobody
  // hurries at our fire"). D minor, a mountain folk tune that lumbers (a long note and a short one, like a bear's heavy gait) on the solo horn
  // with the bassoon under it, at the fire (the low strings' open fifth, the crackle of wood, slow heavy steps on the bass drum, a growl in the
  // cellos' tremolo); the contrast is the garden, a tender pastoral on the cor anglais over the harp and the violas; the crest is the anger,
  // slow to come: the tune in the trombones and the tuba with the horns, the stomp, the timpani.
  Track('race:bulrathi', {
    desc: 'Bulrathi: a lumbering mountain folk tune on the solo horn at the fire, heavy steps and a growl; a tender garden on the cor anglais; the anger, slow to come, in the low brass with the stomp',
    motif: '1:3 3:1 | 4:1.5 3:.5 2:2', motifInst: 'horn',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 72, trim: 1.6, root: 'D', mode: 'minor', oct: -1, tens: false, loopFrom: 'A',
    forms: [['A', 'garden', 'anger', 'C', 'A2', 'garden', 'anger', 'C'], ['A', 'garden', 'anger', 'C', 'garden2', 'A2', 'anger', 'C']],
    inst: { pad: 'cellos', pad2: 'tremLo', bass: 'deep', lead: 'hornIowa', lead2: 'bassoonIowa', lead3: 'reed', lead4: 'trombones', arp: 'harp', arp2: 'violas' },
    ph: {
      B1: '1:3 3:1 | 4:1.5 3:.5 2:2 | 3:3 1:1 | 5:4',                 // the fire song: heavy, long and short
      B2: '1:3 3:1 | 4:1.5 5:.5 7:2 | 8:1.5 7:.5 6:1 4:1 | 1:4',
      BC: '5:2 3:2 | 2:2 4:2 | 1:2 3:2 | 2:2 5:2',                     // the bassoon under it
      TT: 'r:4 | 1:4',
      G1: '10:2 12:1 10:1 | 9:3 7:1 | 8:2 6:2 | 7#:4', G2: '10:2 12:1 13:1 | 12:3 9:1 | 8:2 11:2 | 12:4',   // the garden
    },
    sec: [
      { n: 'fire', bars: 2, cres: [0.46, 0.56], prog: 'i | i', pad: { p: 'swell', n: 2, open: true, reg: [38, 52], vel: 0.55 }, bass: { pat: '1---', vel: 0.6 },
        drums: { hat: ['..o....o...o..o.', '.o...o....o..o..'], bdSoft: ['x...............', 'x.......x.......'], vel: 0.5 } },
      { n: 'A', bars: 8, lv: 0.62, prog: 'i | bVII | bVI | v | i | bVII | iv | i', pad: { p: 'sus', n: 2, open: true, reg: [38, 52], vel: 0.5 }, pad2: { p: 'swell', n: 2, open: true, reg: [43, 55], vel: 0.3 }, bass: { pat: '1---', vel: 0.7 },
        lead: { ph: 'B1 B2', vel: 0.72, shape: 0.4, swell: 0.35 }, lead2: { ph: 'BC r4', oct: -1, vel: 0.5, shape: 0.35 },
        drums: { bdSoft: 'x.......x.......', hat: '..o....o...o..o.', vel: 0.5 } },
      { n: 'garden', bars: 4, lv: 0.54, prog: 'bIII | bVII | iv | V', pad: { p: 'sus', inst: 'strings', n: 3, reg: [55, 72], vel: 0.45 }, bass: { pat: '1---', vel: 0.55 },
        lead3: { ph: 'G1', vel: 0.7, shape: 0.45, swell: 0.35 }, arp: { pat: '0.1.2.3.2.1.', res: 3, vel: 0.36, reg: [55, 79] }, arp2: { pat: '0.......1.......', res: 4, vel: 0.3, reg: [57, 69] } },
      { n: 'garden2', bars: 8, lv: 0.52, prog: 'bIII | bVII | iv | V | bIII | bVII | iv | i', pad: { p: 'sus', inst: 'strings', n: 3, reg: [55, 72], vel: 0.45 }, bass: { pat: '1---', vel: 0.55 },
        lead3: { ph: 'G1 G2', inst: 'oboeIowa', vel: 0.66, shape: 0.45, swell: 0.35 }, arp: { pat: '0.1.2.3.2.1.', res: 3, vel: 0.34, reg: [55, 79] } },
      { n: 'anger', bars: 8, cres: [0.82, 0.98], prog: 'i | bVII | bVI | v | i | bVII | iv | i', pad: { p: 'sus', n: 3, open: true, reg: [38, 55], vel: 0.6 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [50, 74], vel: 0.55 }, bass: { pat: '1-1-', vel: 0.85 },
        lead4: { ph: 'B1 B2', vel: 0.85, shape: 0.35, swell: 0.35 }, lead: { ph: 'B1 B2', oct: 1, vel: 0.75, harm: -2, shape: 0.35, swell: 0.3 }, lead2: { ph: 'B1 B2', inst: 'tuba', oct: -1, vel: 0.6 },
        drums: { bd: 'x.......x.......', t5: 'x...x...x...x...', t4: '......x.......x.', hat: '..o....o...o..o.', vel: 0.75 }, timp: 'beats', hit: true, fill: 'tom' },
      { n: 'C', bars: 2, cres: [0.6, 0.44], prog: 'i | i', pad: { p: 'swell', n: 2, open: true, reg: [38, 52], vel: 0.5 }, bass: { pat: '1---', vel: 0.6 },
        lead2: { ph: 'TT', inst: 'tuba', vel: 0.55 }, drums: { bdSoft: ['x.......x.......', 'x...............'], hat: '.o...o....o..o..', vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'i | bVII | bVI | v | i | bVII | iv | i', pad: { p: 'sus', n: 2, open: true, reg: [38, 52], vel: 0.5 }, pad2: { p: 'sus', inst: 'violas', n: 3, reg: [55, 67], vel: 0.35 }, bass: { pat: '1---', vel: 0.7 },
        lead: { ph: 'B1 B2', inst: 'vcSolo', oct: 1, vel: 0.7, shape: 0.4, swell: 0.35 }, lead2: { ph: 'BC r4', vel: 0.55, shape: 0.35 }, drums: { bdSoft: 'x.......x.......', hat: '..o....o...o..o.', vel: 0.5 } },
    ],
  });

  Track('race:darlok', {
    desc: 'Darlok: eerie minor pads, whispering noise swells and plucked shadows',
    motif: '5:1.5 6:.5 5:1 3:1 | 1:2 3:2', motifInst: 'flute',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 66, trim: 2.61, root: 'F#', mode: 'harmonic', tens: false,
    forms: [['A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B', 'A', 'B'], ['A', 'A', 'B', 'B', 'A', 'A', 'B', 'B', 'A', 'A', 'B', 'B']],
    inst: { pad: 'airPad', bass: 'deep', lead: 'pizz', lead2: 'flute', bell: 'chime', choir: 'uuh' },
    ph: {
      DK1: '5:1.5 6:.5 5:1 3:1 | 1:2 3:2 | 4:2 6:2 | 6:3 4:1',
      DK2: '5:1.5 6:.5 5:1 3:1 | 3:2 1:2 | 5:2 7:2 | 5:3 r:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.7, prog: 'i:2 iv:2 i:2 V:2', pad: { p: 'sus', n: 3, reg: [45, 66] }, bass: 'whole', lead: 'DK1 DK2', choir: { vel: 0.45 }, drums: { whisper: ['x...............', '................'], whisper2: ['................', '........x.......'] } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'i:2 V:2 i:2 iv:2', pad: { p: 'swell', n: 3, reg: [45, 66] }, bass: 'whole', lead: { ph: 'DK2 DK1', inst: 'flute', vel: 0.55, shape: 0.35, swell: 0.2 }, lead2: { ph: 'DK2 DK1', inst: 'pizz', oct: -1, vel: 0.5 }, bell: { dens: 0.2, res: 1, reg: [66, 90], vel: 0.45 }, choir: { v1: 'u', v2: 'o', vel: 0.55 }, drums: { whisper: ['x...............', '................'], whisper2: ['................', '........x.......'], rim: '..o.......o.....' } },
    ],
  });

  Track('race:human', {
    desc: 'Human: a noble orchestral-synth march with snare, strings and brass',
    motif: '5:1.5 5:.5 8:2 | 8:1.5 6:.5 4:2', motifInst: 'horn',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 108, trim: 1.02, root: 'F', mode: 'major', tens: false,
    forms: [['A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C'], ['A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B']],
    inst: { pad: 'strings', bass: 'sub', lead: 'horn', lead2: 'brass', arp: 'stab', bell: 'glass' },
    ph: {
      HM1: '5:1.5 5:.5 8:2 | 8:1.5 6:.5 4:2 | 5:1.5 7:.5 9:2 | 8:3 r:1',
      HM2: '6:1.5 6:.5 8:2 | 8:1.5 9:.5 8:1 6:1 | 9:1.5 7:.5 5:2 | 8:4',
      HM3: '8:2 6:1 4:1 | 5:2 8:2 | 7:2 5:2 | 8:4',
      HM4: '6:2 8:2 | 8:2 6:2 | 9:2 7:2 | 8:4',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.8, prog: 'I IV V I | vi IV V I', pad: { p: 'stab', pat: '....x.......x...', inst: 'stab', n: 3, reg: [53, 72], vel: 0.7, gate: 0.6 }, bass: 'half', lead: 'HM1 HM2', timp: 'two', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'IV I V I | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'HM3 HM4', inst: 'brass', shape: 0.35, swell: 0.35 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I IV V I | vi IV V I', pad: { p: 'stab', pat: '....x.......x...', inst: 'stab', n: 3, reg: [53, 72], vel: 0.7, gate: 0.6 }, bass: 'walk', lead: { ph: 'HM1 HM2', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'HM1 HM2', inst: 'glass', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'C', bars: 4, lv: 0.9, prog: 'IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'HM3', inst: 'brass', shape: 0.35, swell: 0.35 }, timp: { p: 'beats', roll: 1 }, drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.'] } },
    ],
  });

  // The Klackon (second writing, after the user's direction: a hive work song; no human voices, an insect race): an earnest, tireless hive of ant-like workers digging for
  // their Queen. F mixolydian, earthy and warm, no synths. A work song: one worker calls (the clarinet), the colony answers in unison (the bassoon and the pizzicato, many as one);
  // the pickaxes strike on the beat (the anvil, the bass drum), the dirt shuffles (the shaker); a marimba and pizzicato ostinato that adds a
  // worker each bar, tireless. The contrast is the Queen, a warm regal horn while the digging goes on softly under her. The crest is the
  // whole colony in one broad tune in octaves (we are many, we are one: the cellos, the violas, the horns), stamping.
  Track('race:klackon', {
    desc: 'Klackon: a hive work song — one worker calls on the clarinet, the colony answers in unison, pickaxes on the beat, an ostinato that adds a worker each bar; the Queen a warm regal horn; the whole colony in octaves at the crest',
    motif: '5:1 5:.5 5:.5 8:1 5:1 | 3:2 r:2 | 6:1 4:1 6:1 5:1 | 1:4', motifInst: 'horn',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 104, trim: 2.18, root: 'F', mode: 'mixolydian', oct: -1, tens: false, loopFrom: 'A', rubato: 0.01,
    forms: [['A', 'queen', 'crest', 'C', 'A2', 'queen2', 'crest', 'C'], ['A', 'queen', 'crest', 'C', 'queen2', 'A2', 'crest', 'C'], ['A', 'queen', 'crest', 'C', 'A2', 'crest', 'queen2', 'C']],
    inst: { pad: 'cellos', pad2: 'strings', bass: 'deep', lead: 'clarIowa', lead2: 'bassoonIowa', lead3: 'pizz', lead4: 'horn', arp: 'marimba', arp2: 'pizz' },
    ph: {
      C1: '5:1 5:.5 5:.5 8:1 5:1 | 3:2 r:2', R1: '6:1 4:1 6:1 5:1 | 1:4',                   // the call (dig the tunnel) and the colony's answer (dig it deep)
      C2: '8:1 8:.5 8:.5 10:1 8:1 | 6:2 r:2', R2: '7:1 6:1 4:1 2:1 | 1:4',                  // the call again, higher; the answer home by the flat seventh
      S1: '4:2 6:2 | 5:2 3:2 | 4:1 6:1 8:2 | 7:2 5:2', S2: '4:2 6:2 | 5:2 8:2 | 7:1 6:1 4:2 | 1:4',   // the colony's broad tune
      Q1: '6:3 5:1 | 4:2 6:2 | 5:4 | 4:2 2:2', Q2: '6:3 8:1 | 8:2 6:2 | 7:2 5:2 | 5:4',      // the Queen
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.46, 0.56], prog: 'I | I | IV | I', pad: { p: 'swell', n: 2, open: true, reg: [41, 57], vel: 0.5 }, bass: { pat: '1---', vel: 0.6 },
        arp: { pat: ['................', '0...............', '0.......0.......', '0.......0...2...'], res: 4, vel: 0.5, reg: [53, 72] },
        drums: { metal2: ['x.......x.......', 'x.......x.......', 'x.......x.......', 'x.......x...x...'], bd: 'x.......x.......', shk: ['................', '..o...o...o...o.', '..o...o...o...o.', '..o...o...o.o.o.'], vel: 0.55 } },
      { n: 'A', bars: 8, lv: 0.64, prog: 'I | I | IV | I | I | vi | bVII | I', pad: { p: 'sus', n: 3, reg: [48, 62], vel: 0.5 }, bass: { pat: '1-5-', vel: 0.75 },
        lead: { ph: 'C1 r2 C2 r2', vel: 0.75, shape: 0.35 }, lead2: { ph: 'r2 R1 r2 R2', vel: 0.7, shape: 0.3 }, lead3: { ph: 'r2 R1 r2 R2', oct: 1, vel: 0.5 },
        arp: { pat: ['0.......2.......', '0...0...2.......', '0...0...2...2...', '0.1.0...2...2...', '0.1.0.1.2...2...', '0.1.0.1.2.1.2...', '0.1.0.1.2.1.2.1.', '0101010121212121'], res: 4, vel: 0.48, reg: [53, 72] },
        drums: { metal2: 'x.......x.......', bd: 'x.......x.......', shk: '..o...o...o...o.', vel: 0.6 } },
      { n: 'queen', bars: 8, lv: 0.56, prog: 'vi | IV | I | bVII | vi | IV | v | I', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 72], vel: 0.55 }, pad2: { p: 'sus', n: 2, open: true, reg: [41, 55], vel: 0.45 }, bass: { pat: '1---', vel: 0.65 },
        lead4: { ph: 'Q1 Q2', inst: 'hornSolo', vel: 0.72, shape: 0.45, swell: 0.4 }, arp2: { pat: '0.......2.......', res: 4, vel: 0.36, reg: [50, 69] },
        drums: { metal2: 'x.......x.......', vel: 0.32 } },
      { n: 'queen2', bars: 8, lv: 0.54, prog: 'vi | IV | I | bVII | vi | IV | v | I', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 72], vel: 0.52 }, bass: { pat: '1---', vel: 0.6 },
        lead4: { ph: 'Q1 Q2', inst: 'bassoonIowa', vel: 0.7, shape: 0.45, swell: 0.35 }, lead3: { ph: 'r4 Q2', inst: 'violas', vel: 0.45, shape: 0.45 }, arp2: { pat: '0.......2.......', res: 4, vel: 0.34, reg: [50, 69] }, drums: { metal2: 'x.......x.......', vel: 0.3 } },
      { n: 'crest', bars: 8, cres: [0.84, 0.98], prog: 'IV | I | IV | v | IV | I | bVII | I', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 74], vel: 0.65 }, pad2: { p: 'sus', n: 2, open: true, reg: [41, 55], vel: 0.55 }, bass: { pat: '1-5-', vel: 0.85 },
        lead2: { ph: 'S1 S2', inst: 'cellos', vel: 0.75, shape: 0.35 }, lead3: { ph: 'S1 S2', inst: 'violas', oct: 1, vel: 0.62, shape: 0.35 }, lead4: { ph: 'S1 S2', vel: 0.7, harm: -2, shape: 0.35, swell: 0.3 }, lead: { ph: 'S1 S2', inst: 'tpts', oct: 1, vel: 0.4, shape: 0.35 },
        arp: { pat: '0101010121212121', res: 4, vel: 0.5, reg: [53, 72] }, arp2: { pat: '0.2.0.2.', res: 2, vel: 0.42, reg: [48, 67] },
        drums: { metal2: 'x.......x.......', bd: 'x.......x.......', clap: '....x.......x...', shk: 'o.o.o.o.o.o.o.o.', vel: 0.75 }, timp: 'two', hit: true, fill: 'tom' },
      { n: 'C', bars: 4, cres: [0.6, 0.44], prog: 'IV | I | bVII | I', pad: { p: 'sus', n: 3, reg: [48, 62], vel: 0.5 }, bass: { pat: '1---', vel: 0.65 },
        lead2: { ph: 'R1 R2', vel: 0.62, shape: 0.3 }, arp: { pat: ['0.1.0.1.2.1.2...', '0...0...2...2...', '0.......2.......', '0...............'], res: 4, vel: 0.44, reg: [53, 72] },
        drums: { metal2: ['x.......x.......', 'x.......x.......', 'x.......x.......', 'x...............'], vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.7, prog: 'I | I | IV | I | I | vi | bVII | I', pad: { p: 'sus', n: 3, reg: [48, 62], vel: 0.55 }, bass: { pat: '1-5-', vel: 0.8 },
        lead: { ph: 'C1 r2 C2 r2', inst: 'horn', vel: 0.72, shape: 0.35, swell: 0.3 }, lead2: { ph: 'r2 R1 r2 R2', vel: 0.7, shape: 0.3 }, lead3: { ph: 'r2 R1 r2 R2', inst: 'violas', oct: 1, vel: 0.5, shape: 0.35 },
        arp: { pat: '0101010121212121', res: 4, vel: 0.48, reg: [53, 72] }, arp2: { pat: '0.2.0.2.', res: 2, vel: 0.4, reg: [48, 67] },
        drums: { metal2: 'x.......x.......', bd: 'x.......x.......', clap: '....x.......x...', shk: '..o...o...o...o.', vel: 0.65 } },
    ],
  });

  // The Meklar (third writing, after the user's direction: machine code — structured, robotic, a collective like the Borg; the 1970s
  // synthesizers kept, nothing organic, no human voice, no singable tune). C minor in open fifths. The directive is written as code: even
  // quarter notes alternating a fifth and a fourth on each chord's tones, then the same line transformed (its intervals turned over), then
  // closed; the sequencers write bit patterns that gain one bit a bar, the data bleeps run on the celeste, the bass ticks in eighths, the kick
  // is four on the floor, the anvil marks the cycle. Every block is exactly eight bars and repeats exactly. The contrast is the collective mind:
  // the directive at half speed in the low synth over a deep drone, a single tone pinging each beat. The crest is the collective: the brass
  // in locked unison octaves (no harmony, no swell), brass stabs on the grid, every sequencer in phase, the strings' spiccato in sixteenths.
  Track('race:meklar', {
    desc: 'Meklar: machine code — a directive of even quarter notes in fifths and fourths, sequencers writing bit patterns that gain a bit a bar, data bleeps, a four-on-the-floor clock; the collective mind on a deep drone; the brass in locked unison at the crest',
    motif: '1:1 5:1 1:1 5:1 | 4:1 8:1 4:1 8:1', motifInst: 'glass',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 116, trim: 1.53, root: 'C', mode: 'minor', tens: false, loopFrom: 'A',
    forms: [['A', 'mind', 'crest', 'C', 'A2', 'mind', 'crest', 'C'], ['A', 'mind', 'crest', 'C', 'mind', 'A2', 'crest', 'C']],
    inst: { pad: 'glassPad', pad2: 'drone', pad3: 'brassStab', bass: 'moogSyn', lead: 'synthSyn', lead2: 'glass', lead3: 'lowBrass', lead4: 'tpts', arp: 'seqSyn', arp2: 'pulseSyn', bell: 'glass' },
    ph: {
      D1: '1:1 5:1 1:1 5:1 | 4:1 8:1 4:1 8:1 | 6:1 3:1 6:1 3:1 | 7:1 4:1 7:1 2:1',      // the directive: a fifth and a fourth on each chord, even
      D2: '5:1 1:1 5:1 1:1 | 8:1 4:1 8:1 4:1 | 3:1 6:1 3:1 6:1 | 2:1 7:1 2:1 7:1',      // the same, its intervals turned over
      D3: '5:1 1:1 5:1 1:1 | 8:1 4:1 8:1 4:1 | 6:1 6:1 5:1 5:1 | 1:4',                  // closed
      H1: '1:2 5:2 | 4:2 8:2 | 6:2 3:2 | 7:2 4:2', H2: '1:2 5:2 | 4:2 8:2 | 6:2 5:2 | 1:4',   // the collective mind: the directive at half speed
    },
    sec: [
      { n: 'boot', bars: 4, cres: [0.54, 0.62], prog: 'i5 | i5 | i5 | i5', pad: { p: 'swell', n: 2, open: true, reg: [60, 72], vel: 0.45 },
        arp: { pat: ['0...............', '0.......0.......', '0...0...0...0...', '0.0.0.0.0.0.0.0.'], res: 4, vel: 0.3, reg: [48, 72], gate: 0.35 },
        drums: { click2: ['x...............', 'x.......x.......', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'], metal2: ['................', '................', '................', '..............x.'], vel: 0.5 } },
      { n: 'A', bars: 8, lv: 0.64, prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI | bVII', pad: { p: 'sus', n: 2, open: true, reg: [60, 72], vel: 0.42 }, bass: { pat: '11111111', vel: 0.7 },
        lead: { ph: 'D1 D2', vel: 0.62 }, lead2: { ph: '@', oct: 1, vel: 0.4 },
        arp: { pat: ['0.0.0.0.0.0.0.0.', '0.0.2.0.0.0.2.0.', '0.1.2.0.0.1.2.0.', '0.1.2.0.0.1.2.1.', '0.1.2.1.0.1.2.1.', '0112010201120102', '0112012101120121', '0121012101210121'], res: 4, vel: 0.3, reg: [48, 72], gate: 0.35 },
        bell: { dens: 0.2, res: 4, reg: [84, 100], vel: 0.32 }, drums: { kick: 'x...x...x...x...', click2: 'x.x.x.x.x.x.x.x.', hat: '..x...x...x...x.', metal2: ['................', '................', '................', '..............x.'], vel: 0.58 } },
      { n: 'mind', bars: 8, lv: 0.54, prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI:.5 V:.5 | i5', pad: { p: 'sus', n: 2, open: true, reg: [62, 74], vel: 0.45 }, pad2: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.6 }, bass: { pat: '1---', inst: 'subSwell', vel: 0.6 },
        lead: { ph: 'H1 H2', oct: -1, vel: 0.66 }, arp2: { pat: '0...0...0...0...', res: 4, vel: 0.28, reg: [72, 79], gate: 0.2 }, bell: { dens: 0.08, res: 4, reg: [84, 100], vel: 0.28 },
        drums: { click2: 'x...x...x...x...', vel: 0.4 } },
      { n: 'crest', bars: 8, cres: [0.86, 0.98], prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI:.5 V:.5 | i5', pad: { p: 'sus', n: 2, open: true, reg: [60, 72], vel: 0.5 }, pad2: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.55 }, pad3: { p: 'stab', pat: 'x...x...x...x...', n: 2, open: true, reg: [52, 67], vel: 0.6, gate: 0.4 }, bass: { pat: '11111111', vel: 0.85 },
        lead: { ph: 'D1 D3', inst: 'horn', vel: 0.85 }, lead3: { ph: '@', oct: -1, vel: 0.7 }, lead4: { ph: '@', oct: 1, vel: 0.5 }, lead2: { ph: '@', oct: 1, vel: 0.38 },
        arp: { pat: '0121012101210121', res: 4, vel: 0.32, reg: [48, 72], gate: 0.35 }, arp2: { inst: 'strOst', pat: '0101010101010101', res: 4, vel: 0.36, reg: [48, 67] }, bell: { dens: 0.25, res: 4, reg: [84, 100], vel: 0.34 },
        drums: { kick: 'x...x...x...x...', click2: 'xxxxxxxxxxxxxxxx', hat: '..x...x...x...x.', clap: '....x.......x...', metal2: '..............x.', metal: ['x...............', '................', '................', '................'], vel: 0.72 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.6, 0.44], prog: 'i5 | i5 | i5 | i5', pad: { p: 'swell', n: 2, open: true, reg: [60, 72], vel: 0.42 }, bass: { pat: ['11111111', '1.1.1.1.', '1...1...', '1.......'], vel: 0.6 },
        arp: { pat: ['0.1.2.1.0.1.2.1.', '0.0.2.0.0.0.2.0.', '0.......0.......', '0...............'], res: 4, vel: 0.3, reg: [48, 72], gate: 0.35 }, drums: { click2: ['x.x.x.x.x.x.x.x.', 'x...x...x...x...', 'x.......x.......', 'x...............'], vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI | bVII', pad: { p: 'sus', n: 2, open: true, reg: [60, 72], vel: 0.45 }, bass: { pat: '11111111', vel: 0.72 },
        lead: { ph: 'D2 D1', inst: 'glass', vel: 0.6 }, lead2: { ph: '@', inst: 'synthSyn', oct: -1, vel: 0.5 },
        arp: { pat: '0121012101210121', res: 4, vel: 0.3, reg: [48, 72], gate: 0.35 }, arp2: { pat: '0.......0.......', res: 4, vel: 0.26, reg: [72, 84], gate: 0.2 }, bell: { dens: 0.22, res: 4, reg: [84, 100], vel: 0.32 },
        drums: { kick: 'x...x...x...x...', click2: 'x.x.x.x.x.x.x.x.', hat: '..x...x...x...x.', metal2: '..............x.', vel: 0.6 } },
    ],
  });

  Track('race:mrrshan', {
    desc: 'Mrrshan: tribal polyrhythmic percussion under a snaking phrygian-dominant reed line',
    motif: '1:.5 2:.5 3:1 2:.5! 1:.5 3:1 | 6:1.5 5:.5 4:1 2:1', motifInst: 'reed',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 112, trim: 1.34, root: 'G', mode: 'phrygDom', tens: false,
    forms: [['A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C'], ['A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B']],
    inst: { pad: 'dark', bass: 'moog', lead: 'reed', lead2: 'flute', arp: 'kora', bell: 'chime', choir: 'uuh' },
    ph: {
      MR1: '1:.5 2:.5 3:1 2:.5! 1:.5 3:1 | 6:1.5 5:.5 4:1 2:1 | 1:.5 2:.5 3:1 2:.5! 1:.5 3:1 | 6:2 4:1 3:1',
      MR2: '5:1 6:.5 5:.5 3:1 5:1 | 9:2 6:1 4:1 | 5:1 6:.5 5:.5 3:1 5:1 | 4:1 3:1 1:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1 MR2', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR2 MR1', inst: 'flute', shape: 0.35, swell: 0.2 }, lead2: { ph: 'MR2 MR1', inst: 'reed', oct: -1, vel: 0.5 }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR1 MR2', harm: -2 }, choir: { v1: 'u', v2: 'o', vel: 0.5, reg: [55, 72] }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x.......x.......' }, fill: 'tom' },
      { n: 'C', bars: 4, lv: 0.8, prog: 'I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', shk: 'x.x.x.x.x.x.x.x.' } },
    ],
  });

  // The Psilon (rewritten from nothing): hairless, enormous-brained scholars who see the galaxy as an unsolved problem, cool and a little
  // smug. E lydian, the mode of the bright idea. A two-part invention in Bach's manner: the subject climbs the chord in a sequence (the
  // clarinet), the countersubject answers in long notes (the bassoon); the laboratory ticks (the pizzicato, the claves) and its glassware rings
  // (the celeste, the crotales); the contrast is the hypothesis, a cool slow line on the solo violin over the glass pad; the crest is the
  // proof, the subject and its countersubject together in the full strings with the celeste above, landing on a eureka (the strike).
  Track('race:psilon', {
    desc: 'Psilon: a cool two-part invention in lydian — the subject climbing in sequence on the clarinet, the countersubject in the bassoon, the laboratory ticking and its glassware ringing; the hypothesis on the solo violin; the proof and a eureka at the crest',
    motif: '1:.5 3:.5 5:.5 3:.5 8:1 7:.5 6:.5 | 2:.5 4:.5 6:.5 4:.5 9:1 8:.5 7:.5', motifInst: 'clarinet',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 92, trim: 1.6, root: 'E', mode: 'lydian', tens: false, loopFrom: 'A',
    forms: [['A', 'hyp', 'proof', 'C', 'A2', 'hyp2', 'proof', 'C'], ['A', 'hyp', 'proof', 'C', 'hyp2', 'A2', 'proof', 'C']],
    inst: { pad: 'glassPad', pad2: 'strings', bass: 'pizz', lead: 'clarIowa', lead2: 'bassoonIowa', lead3: 'vlnSolo', lead4: 'glass', arp: 'pizz', arp2: 'harp', bell: 'crystal' },
    ph: {
      PS1: '1:.5 3:.5 5:.5 3:.5 8:1 7:.5 6:.5 | 2:.5 4:.5 6:.5 4:.5 9:1 8:.5 7:.5 | 6:.5 8:.5 10:.5 8:.5 13:1 12:.5 11:.5 | 12:1 7:1 5:2',   // the subject: up the chord, in sequence
      PS2: '8:.5 6:.5 5:.5 3:.5 1:1 3:1 | 9:.5 7:.5 6:.5 4:.5 2:1 4:1 | 7:.5 5:.5 4:.5 2:.5 7:1 9:1 | 8:4',                               // and down again, home
      CS: '5:2 3:2 | 4:2 6:2 | 3:2 1:2 | 2:2 5:2', CS2: '5:2 3:2 | 4:2 6:2 | 5:2 7:2 | 8:4',                                           // the countersubject, and its close
      H1: '10:3 8:1 | 7:4 | 6:2 4:2 | 5:4', H2: '10:3 12:1 | 12:2 10:2 | 9:2 6:2 | 8:4',                                                // the hypothesis
    },
    sec: [
      { n: 'intro', bars: 2, cres: [0.46, 0.56], prog: 'IM7 | II', pad: { p: 'swell', n: 3, reg: [64, 80], vel: 0.45 },
        arp: { pat: ['0...0...0...0...', '0.0.0.0.0.2.0.2.'], res: 4, vel: 0.4, reg: [52, 71] }, bell: { dens: 0.12, res: 2, reg: [84, 103], vel: 0.35 },
        drums: { click3: ['o...o...o...o...', 'o.o.o.o.o.o.o.o.'], vel: 0.45 } },
      { n: 'A', bars: 8, lv: 0.62, prog: 'IM7 | II | vi | V | IM7 | II | V | I', pad: { p: 'sus', n: 3, reg: [64, 80], vel: 0.42 }, bass: { pat: '1.5.1.5.', vel: 0.7 },
        lead: { ph: 'PS1 PS2', vel: 0.72, shape: 0.3, swell: 0.2 }, lead2: { ph: 'CS r4', oct: -1, vel: 0.6, shape: 0.35 },
        arp2: { pat: '0.......2.......', res: 4, vel: 0.3, reg: [64, 83] }, bell: { dens: 0.1, res: 2, reg: [84, 103], vel: 0.32 }, drums: { click3: 'o...o...o...o...', vel: 0.4 } },
      { n: 'hyp', bars: 8, lv: 0.54, prog: 'vi | iii | II | V | vi | iii | II | IM7', pad: { p: 'sus', n: 3, reg: [64, 82], vel: 0.5 }, pad2: { p: 'sus', inst: 'tremHi', n: 2, reg: [76, 88], vel: 0.35 }, bass: { pat: '1---', inst: 'deep', vel: 0.55 },
        lead3: { ph: 'H1 H2', vel: 0.7, shape: 0.45, swell: 0.4 }, arp2: { pat: '0.1.2.3.', res: 2, vel: 0.3, reg: [60, 84] }, bell: { dens: 0.14, res: 2, reg: [84, 103], vel: 0.32 } },
      { n: 'hyp2', bars: 8, lv: 0.52, prog: 'vi | iii | II | V | vi | iii | II | IM7', pad: { p: 'sus', n: 3, reg: [64, 82], vel: 0.48 }, bass: { pat: '1---', inst: 'deep', vel: 0.55 },
        lead3: { ph: 'H1 H2', inst: 'altoFluteIowa', vel: 0.66, shape: 0.45, swell: 0.4 }, lead4: { ph: 'r4 H2', oct: 1, vel: 0.36 }, arp2: { pat: '0.1.2.3.', res: 2, vel: 0.3, reg: [60, 84] } },
      { n: 'proof', bars: 8, cres: [0.82, 0.96], prog: 'IM7 | II | vi | V | IM7 | II | V | I', pad: { p: 'sus', n: 3, reg: [64, 82], vel: 0.45 }, pad2: { p: 'sus', n: 4, reg: [52, 76], vel: 0.6 }, bass: { pat: '1.5.1.5.', inst: 'deep', vel: 0.8 },
        lead: { ph: 'PS1 PS2', inst: 'violas', oct: 1, vel: 0.75, shape: 0.3, swell: 0.25 }, lead3: { ph: 'PS1 PS2', vel: 0.55, shape: 0.3 }, lead2: { ph: 'CS CS2', inst: 'cellos', oct: -1, vel: 0.72, shape: 0.35, swell: 0.3 }, lead4: { ph: 'PS1 PS2', oct: 1, vel: 0.36 },
        arp: { pat: '0.1.2.1.0.1.2.1.', res: 4, vel: 0.4, reg: [52, 71] }, bell: { dens: 0.2, res: 2, reg: [84, 103], vel: 0.36 }, timp: 'two',
        drums: { click3: 'o.o.o.o.o.o.o.o.', tri: ['x...............', '................', '................', '................'], vel: 0.55 }, hit: true },
      { n: 'C', bars: 4, cres: [0.6, 0.44], prog: 'IM7 | II | V | I', pad: { p: 'swell', n: 3, reg: [64, 80], vel: 0.42 }, bass: { pat: '1---', inst: 'deep', vel: 0.6 },
        lead: { ph: 'PS2', vel: 0.6, shape: 0.3 }, arp: { pat: ['0.0.0.0.0.2.0.2.', '0...0...0...0...', '0.......0.......', '0...............'], res: 4, vel: 0.36, reg: [52, 71] }, drums: { click3: ['o...o...o...o...', 'o.......o.......'], vel: 0.38 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'IM7 | II | vi | V | IM7 | II | V | I', pad: { p: 'sus', n: 3, reg: [64, 80], vel: 0.42 }, bass: { pat: '1.5.1.5.', vel: 0.72 },
        lead: { ph: 'PS1 PS2', inst: 'vlnSolo', vel: 0.68, shape: 0.3, swell: 0.2 }, lead2: { ph: 'CS CS2', inst: 'clarIowa', vel: 0.5, shape: 0.35 }, arp2: { pat: '0.......2.......', res: 4, vel: 0.3, reg: [64, 83] }, bell: { dens: 0.12, res: 2, reg: [84, 103], vel: 0.32 },
        drums: { click3: 'o...o...o...o...', vel: 0.4 } },
    ],
  });

  // The Sakkra (rewritten from nothing): reptiles of the swamp worlds, warm-blooded and prolific; humid, coiled, patient until they strike.
  // D in the Ukrainian dorian (dorian with a raised fourth: the augmented second F to G-sharp, the sound of the souk and the snake charmer;
  // the major II and the augmented flat seventh in the harmony). The coil: an ornamented held note, a quick tensing up the augmented
  // second, a slow sinuous rise to the sixth and a chromatic slither down. A drone of the men humming an open fifth, finger-cymbal pings. A low marimba
  // in three-three-two under it like a reptile's gait, the harp for the light through the canopy, the hiss. The bass clarinet is the voice
  // (low, reedy, close), the alto flute the humid air of the contrast; the horns take the coil at the crest with the alto flute above. Built
  // for the minute and a half an audience lasts: the marimba and the hiss alone, the coil, the mist, the crest at 50 to 70 s, the settle.
  Track('race:sakkra', {
    desc: 'Sakkra: a humid, exotic coil (the Ukrainian dorian’s augmented second), ornamented and slithering, in the bass clarinet over a low marimba in three-three-two, the hiss and frame toms; the alto flute in the mist, the horns at the crest',
    motif: '1:3 3:.5 4:.5 | 5:2 6:1 5:1', motifInst: 'bassClar',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 96, trim: 2.1, root: 'D', mode: 'ukrDorian', oct: -1, tens: false, loopFrom: 'A', rubato: 0.015,
    forms: [['A', 'B', 'crest', 'C', 'A2', 'still', 'B', 'crest', 'C'], ['A', 'B', 'crest', 'C', 'still', 'A2', 'B', 'crest', 'C'], ['A', 'B', 'crest', 'C', 'A2', 'B', 'still', 'crest', 'C']],
    inst: { pad: 'cellos', pad2: 'strings', pad3: 'choirMen', bass: 'pulse', lead: 'bassClar', lead2: 'harp', lead3: 'altoFluteIowa', arp: 'marimba', arp2: 'harp', choir: 'choirWomen' },
    ph: {
      SA: '1:.5 2:.125! 1:.125 1:2.25 3:.5 4:.5 | 5:1.75 6:.125! 5:.125 6:1 5:1 | 4:.5 3#:.25! 3:.25 1:1 3:2 | 2:4',                    // the coil: held, tensing, the slow rise to the sixth, a slither down; to the half close
      SB: '1:.5 2:.125! 1:.125 1:2.25 3:.5 4:.5 | 5:2 6:1 8:1 | 7:1.5 6:.25 6b:.25! 5:1 4:1 | 3:1 2:.5 2b:.5! 1:2',             // the answer, up to the octave and home
      SC: '12:1.75 13:.125! 12:.125 10:1 9:1 | 9:3 7:1 | 13:1.5 12:.5 11:2 | 12:4',                         // the mist (alto flute), over the flat third and seventh
      SD: '10:2 12:2 | 14:2 11:1 9:1 | 9:1.5 11:.5 13:2 | 11:4',
      SE: '12:4 | 10:2 13:2 | 11:2 12:2 | 9:4',                                       // the descant over the coil at the crest
      SF: '12:4 | 10:2 15:2 | 14:2 12:2 | 10:2 8:2',
      SH: '5:3 4:1 | 3:2 1:2 | 2:3 2b:.5! 3:.5 | 1:4',                                        // the still: the bass clarinet alone over the drone
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.46, 0.56], prog: 'i | i | i:.5 II:.5 | v', pad3: { p: 'sus', n: 2, open: true, reg: [45, 57], vel: 0.35 }, bass: { pat: '1---', inst: 'deep', vel: 0.7 },
        arp: { pat: '0..1..2.', res: 2, vel: 0.42, reg: [45, 64] }, pad: { p: 'swell', n: 2, reg: [50, 62], vel: 0.4 },
        pad2: { p: 'swell', inst: 'tremLo', n: 2, open: true, reg: [43, 55], vel: 0.35 },
        drums: { hiss: '....x.......x...', t4: ['x...............', '................', 'x.....x.........', 'x.....x.....x...'], shk: ['..o...o...o...o.', '..o...o...o...o.', '..o...o...o...o.', '..o...o...xxxxxx'], whisper: ['x...............', '................', 'x...............', '................'], click3: ['................', '..........xx....', '................', '................'], vel: 0.6 } },
      { n: 'A', bars: 8, lv: 0.62, prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v | i | i:.5 II7:.5 | bVII+:.5 v:.5 | i', pad: { p: 'sus', n: 3, reg: [50, 65], vel: 0.55 }, pad3: { p: 'sus', n: 2, open: true, reg: [45, 57], vel: 0.3 }, bass: { pat: '1..5..1.', vel: 0.8 },
        lead: { ph: 'SA SB', vel: 0.72, shape: 0.4, swell: 0.3 }, lead2: { ph: '@', oct: 1, vel: 0.3, skip: 0.3 }, arp: { pat: '0..1..2.', res: 2, vel: 0.45, reg: [45, 64] },
        drums: { tri: '......x.......x.', hiss: '....x.......x...', t4: 'x.....x.....x...', shk: ['o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx'], click3: ['..........xx....', '................', '................', '................', '......xx........', '................', '................', '................'], whisper2: ['x...............', '................', '................', '................', 'x...............', '................', '................', '................'], rim: '........x.......', vel: 0.62 } },
      { n: 'B', bars: 8, cres: [0.56, 0.72], prog: 'bIII | v | II | v | bIII | bVII+ | II | II7', pad: { p: 'swell', inst: 'strings', n: 3, reg: [55, 72], vel: 0.5 }, pad2: { p: 'sus', inst: 'cellos', n: 2, reg: [45, 57], vel: 0.45 }, bass: { pat: '1---', inst: 'deep', vel: 0.75 },
        lead3: { ph: 'SC SD', vel: 0.7, shape: 0.4, swell: 0.3 }, arp2: { pat: '0.1.2.3.', res: 2, vel: 0.36, reg: [55, 79] }, choir: { n: 2, reg: [65, 77], vel: 0.3, soft: true },
        drums: { hiss: '....x.......x...', shk: ['o...o...o...o...', 'o...o...o...o...', 'o...o...o...o...', 'o...o.....xxxxxx'], whisper: ['x...............', '................', '................', '................'], click3: ['................', '......xx........'], vel: 0.5 } },
      { n: 'crest', bars: 8, cres: [0.8, 0.96], prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v | i | i:.5 II7:.5 | bVII+:.5 v:.5 | i', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 72], vel: 0.7 }, pad2: { p: 'sus', inst: 'cellos', n: 2, reg: [43, 55], vel: 0.6 }, bass: { pat: '1..5..1.', vel: 0.9 },
        lead: { ph: 'SA SB', inst: 'horn', vel: 0.8, harm: -2, shape: 0.4, swell: 0.35 }, lead2: { ph: '@', inst: 'bassClar', vel: 0.5 }, lead3: { ph: 'SE SF', vel: 0.55, shape: 0.4, swell: 0.3 },
        arp: { pat: '0..1..2.', res: 2, vel: 0.5, reg: [45, 64] }, arp2: { pat: '01230123', res: 2, vel: 0.34, reg: [60, 84] }, choir: { n: 3, reg: [62, 77], vel: 0.42 }, timp: 'two',
        drums: { t2: '..x..x.....x....', tri: '......x.......x.', hiss: '....x.......x...', t3: '...x.....x......', t4: 'x.....x.....x...', t5: 'x...............', shk: ['o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx'], click3: ['..........xx....', '................', '................', '................', '......xx........', '................', '................', '................'], whisper2: ['x...............', '................', '................', '................', 'x...............', '................', '................', '................'], rim: '....x.......x...', vel: 0.75 }, fill: 'tom', hit: true },
      { n: 'C', bars: 4, cres: [0.6, 0.42], prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v', pad: { p: 'sus', n: 3, reg: [50, 65], vel: 0.5 }, pad3: { p: 'sus', n: 2, open: true, reg: [45, 57], vel: 0.3 }, bass: { pat: '1---', inst: 'deep', vel: 0.7 },
        lead: { ph: 'SA', vel: 0.6, shape: 0.4, swell: 0.3 }, arp: { pat: ['0..1..2.', '0..1..2.', '0.....1.', '0.......'], res: 2, vel: 0.4, reg: [45, 64] }, pad2: { p: 'swell', inst: 'tremLo', n: 2, open: true, reg: [43, 55], vel: 0.3 }, drums: { hiss: '....x.......x...', shk: ['................', '................', '................', '..........xxxxxx'], whisper: ['................', 'x...............'], vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v | i | i:.5 II7:.5 | bVII+:.5 v:.5 | i', pad: { p: 'sus', n: 3, reg: [50, 65], vel: 0.55 }, bass: { pat: '1..5..1.', vel: 0.8 },
        lead: { ph: 'SA SB', inst: 'harp', oct: 1, vel: 0.75 }, lead2: { ph: '@', inst: 'pizz', oct: 1, vel: 0.4 }, lead3: { ph: 'SE SF', inst: 'bassClar', oct: -1, vel: 0.5, shape: 0.4, swell: 0.3 }, arp: { pat: '0..1..2.', res: 2, vel: 0.45, reg: [45, 64] },
        drums: { t2: '..x..x.....x....', tri: '......x.......x.', hiss: '....x.......x...', t4: 'x.....x.....x...', t3: '..........x.....', shk: ['o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.o.o.', 'o.o.o.o.o.o.xxxx'], click3: ['..........xx....', '................', '................', '................', '......xx........', '................', '................', '................'], whisper2: ['x...............', '................', '................', '................', 'x...............', '................', '................', '................'], vel: 0.62 } },
      { n: 'still', bars: 8, lv: 0.44, prog: 'i | i | II | i | i | i | II | i', pad: { p: 'swell', n: 2, reg: [50, 62], vel: 0.5 }, pad3: { p: 'sus', n: 2, open: true, reg: [45, 57], vel: 0.32 }, bass: { pat: '1---', inst: 'deep', vel: 0.6 },
        lead: { ph: 'SH r4', vel: 0.6, shape: 0.4, swell: 0.3 }, lead3: { ph: 'r4 SH^', vel: 0.55, shape: 0.4, swell: 0.3 }, choir: { n: 2, reg: [65, 77], vel: 0.26, soft: true }, arp2: { pat: '0.......', res: 2, vel: 0.3, reg: [62, 81] }, drums: { whisper: ['x...............', '................', '................', '................'], click3: ['................', '................', '..........xx....', '................'], vel: 0.4 } },
    ],
  });

  Track('race:silicoid', {
    desc: 'Silicoid: vast resonant drones with slow metallic chimes and deep geologic pulses',
    motif: '5:4 | 3:4', motifInst: 'chime',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 50, trim: 2.54, root: 'C#', mode: 'minor', tens: false,
    forms: [['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'], ['A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B']],
    inst: { pad: 'drone', bass: 'deep', lead: 'chime', lead2: 'chime', bell: 'chime', choir: 'uuh' },
    ph: {
      SL1: '5:4 | 3:4 | 4:4 | 2:4',
      SL2: '3:4 | 5:4 | 4:4 | 6:4',
      SL3: '8:4 | 6:4 | 5:4 | 2:4',
    },
    sec: [
      { n: 'A', bars: 4, lv: 0.7, prog: 'i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [48, 67], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL1', oct: 0, vel: 0.8, echo: 0.3 }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', whisper2: ['................', '........x.......', '................', '................'] } },
      { n: 'B', bars: 4, lv: 0.85, prog: 'i:2 bII:2', pad: { p: 'sus', n: 3, reg: [48, 67], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL2', oct: 0, vel: 0.8, echo: 0.3 }, choir: { v1: 'u', v2: 'o', vel: 0.45, reg: [49, 68] }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', metal2: ['................', '........o.......', '................', '................'] } },
      { n: 'C', bars: 4, lv: 0.8, prog: 'bVI:2 V:2', pad: { p: 'sus', n: 3, reg: [48, 67], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL3', oct: 0, vel: 0.8, echo: 0.3 }, lead2: { ph: 'SL3', inst: 'glass', oct: 1, vel: 0.35 }, choir: { v1: 'o', v2: 'a', vel: 0.5, reg: [49, 68] }, timp: { p: 'hits', vel: 0.6, dur: 3 }, drums: { metal: 'x...............' } },
    ],
  });

  // the hostile readings (research/06 §12.5: "same motif, lower register, faster, harsher timbre")
  const WAR = {
    alkari: { tempo: 1.2, down: 15, mode: 'mixolydian', inst: { lead: 'synth' } },                                                            // screeching, rapid
    darlok: { tempo: 1.08, inst: { lead: 'horn' }, drums: { kick: 'x..x....x..x....', rim: '......o.......o.', hiss: '....x.......x...' } },   // heartbeat pulse
    human: {},                                                                                                   // the march in minor, snare + brass
    mrrshan: { tempo: 1.15, down: 5, mode: 'phrygDom' },                                                                           // growling low brass
    silicoid: { tempo: 1.15, down: 2, inst: { lead: 'horn' }, drums: { t5: 'X.......X.......', metal: 'x.......x.......', hiss: '....x.......x...' } },   // grinding pulses
  };
  for (const r in WAR) Music._warVariant('race:' + r, WAR[r]);

  // ------------------------------------------------------------------ the written hostile readings: the theme's tune, its own music
  // The Meklar, hostile: resistance is futile. The directive in the low brass and the synth brass in unison over a harder sequencer (the pulse
  // synth) and the anvils; assimilation (no tune: the drone rising, every sequencer converging on one pattern, stabs on the grid); the
  // collective mind in the horns over the strings' tremolo; the brass in locked unison at the crest.
  Music._warVariant('race:meklar', { written: true, down: 2, bpm: 128, loopFrom: 'A',
    desc: 'Meklar, hostile: resistance is futile — the directive in the low brass and synth brass in unison over a harder sequencer and the anvils, assimilation (every sequencer converging on one pattern), the brass locked in unison at the crest',
    forms: [['A', 'assimilate', 'mind', 'crest', 'C', 'A', 'mind', 'assimilate', 'crest', 'C'], ['A', 'assimilate', 'mind', 'crest', 'C', 'assimilate', 'A', 'crest', 'C']],
    inst: { pad: 'drone', pad2: 'strTrem', pad3: 'brassStab', bass: 'moogSyn', lead: 'lowBrass', lead2: 'synthSyn', lead3: 'horn', lead4: 'tpts', arp: 'pulseSyn', arp2: 'seqSyn', bell: 'glass' },
    def: { trim: 1.58 },
    sec: [
      { n: 'boot', bars: 2, cres: [0.6, 0.74], prog: 'i5 | i5', pad: { p: 'swell', n: 2, open: true, reg: [43, 55], vel: 0.6 }, arp: { pat: ['0.0.0.0.0.0.0.0.', '0121012101210121'], res: 4, vel: 0.32, reg: [46, 70], gate: 0.35 },
        drums: { metal: ['x...............', 'x.......x.......'], kick: ['................', 'x...x...x...x...'], click2: 'xxxxxxxxxxxxxxxx', vel: 0.65 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI | bVII', pad: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.55 }, bass: { pat: '1111111111111111', vel: 0.75 },
        lead: { ph: 'D1 D2', vel: 0.85 }, lead2: { ph: '@', vel: 0.55 }, arp: { pat: '0121012101210121', res: 4, vel: 0.32, reg: [46, 70], gate: 0.35 },
        drums: { kick: 'x...x...x...x...', metal: 'x.......x.......', metal2: '..x...x...x...x.', click2: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...', vel: 0.78 }, timp: 'two' },
      { n: 'assimilate', bars: 4, cres: [0.74, 0.94], prog: 'i5 | i5 | bVI5 | bVII5', pad: { p: 'swell', n: 2, open: true, reg: [43, 55], vel: 0.7 }, pad2: { p: 'swell', n: 3, open: true, reg: [55, 72], vel: 0.6 }, pad3: { p: 'stab', pat: ['x...............', 'x.......x.......', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'], n: 2, open: true, reg: [48, 64], vel: 0.7, gate: 0.4 }, bass: { pat: '1111111111111111', vel: 0.8 },
        arp: { pat: ['0121012101210121', '0121012101210121', '0121012101210121', '0121012101210121'], res: 4, vel: 0.34, reg: [46, 70], gate: 0.35 }, arp2: { pat: ['2.1.0.2.1.0.2.1.', '0.1.2.0.1.2.0121', '0121012101210121', '0121012101210121'], res: 4, vel: 0.3, reg: [58, 82], gate: 0.35 },
        drums: { kick: 'x...x...x...x...', metal: ['x...............', 'x.......x.......', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'], click2: 'xxxxxxxxxxxxxxxx', vel: 0.82 } },
      { n: 'mind', bars: 8, lv: 0.84, prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI:.5 V:.5 | i5', pad: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.6 }, pad2: { p: 'sus', n: 3, open: true, reg: [55, 72], vel: 0.5 }, bass: { pat: '11111111', vel: 0.75 },
        lead3: { ph: 'H1 H2', vel: 0.85 }, lead: { ph: 'H1 H2', oct: -1, vel: 0.65 }, arp: { pat: '0...0...0...0...', res: 4, vel: 0.3, reg: [58, 70], gate: 0.2 },
        drums: { kick: 'x...x...x...x...', metal2: '..............x.', click2: 'x.x.x.x.x.x.x.x.', vel: 0.7 }, timp: 'two' },
      { n: 'crest', bars: 8, cres: [0.9, 1.0], prog: 'i5 | iv | bVI | bVII | i5 | iv | bVI:.5 V:.5 | i5', pad: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.6 }, pad2: { p: 'sus', n: 3, open: true, reg: [55, 72], vel: 0.55 }, pad3: { p: 'stab', pat: 'x...x...x...x...', n: 2, open: true, reg: [48, 64], vel: 0.7, gate: 0.4 }, bass: { pat: '1111111111111111', vel: 0.85 },
        lead3: { ph: 'D1 D3', vel: 0.88 }, lead: { ph: 'D1 D3', oct: -1, vel: 0.8 }, lead4: { ph: 'D1 D3', oct: 1, vel: 0.55 }, lead2: { ph: 'D1 D3', vel: 0.5 },
        arp: { pat: '0121012101210121', res: 4, vel: 0.34, reg: [46, 70], gate: 0.35 }, arp2: { pat: '0121012101210121', res: 4, vel: 0.28, reg: [58, 82], gate: 0.35 },
        drums: { kick: 'x...x...x...x...', metal: 'x.......x.......', metal2: '..x...x...x...x.', click2: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...', crash: ['x...............', '................', '................', '................'], vel: 0.85 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.8, 0.6], prog: 'i5 | i5 | i5 | i5', pad: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.55 }, bass: { pat: ['1111111111111111', '11111111', '1...1...', '1...'], vel: 0.75 },
        arp: { pat: ['0121012101210121', '0.1.2.1.0.1.2.1.', '0...0...0...0...', '0...............'], res: 4, vel: 0.32, reg: [46, 70], gate: 0.35 }, drums: { kick: ['x...x...x...x...', 'x...x...x...x...', 'x.......x.......', 'x...............'], metal: ['x...............', 'x...............', 'x...............', 'x...............'], vel: 0.72 } },
    ],
  });

  // The Klackon, hostile: the hive at war (every worker a soldier now). The work song barked: the calls in the horns, the answers shouted
  // back by the low brass, the pickaxes become war drums, the ostinato in the spiccato; the muster (no tune: stamping, the anvil, brass stabs); the
  // Queen commanding in the trumpets and horns; the colony's tune in the low brass, the horns and the strings at the crest.
  Music._warVariant('race:klackon', { written: true, down: 2, bpm: 120, loopFrom: 'A',
    desc: 'Klackon, hostile: the hive at war — the work song barked by the horns and answered by the low brass over war drums, a muster of stamping and brass stabs, the Queen commanding in the trumpets',
    forms: [['A', 'muster', 'queen', 'crest', 'C', 'A', 'queen', 'muster', 'crest', 'C'], ['A', 'muster', 'queen', 'crest', 'C', 'muster', 'A', 'crest', 'C']],
    inst: { pad: 'strTrem', pad2: 'cellos', pad3: 'brassStab', bass: 'deep', lead: 'horn', lead2: 'lowBrass', lead3: 'cellos', lead4: 'tpts', arp: 'strOst', arp2: 'marimba' },
    def: { trim: 1.89 },
    sec: [
      { n: 'march', bars: 2, cres: [0.58, 0.72], prog: 'I | I', pad2: { p: 'sus', n: 2, open: true, reg: [43, 57], vel: 0.6 },
        drums: { t5: 'x.......x.......', metal: 'x.......x.......', clap: ['................', '....x.......x.x.'], t3: ['................', '..........x.x.xx'], vel: 0.72 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'I | I | IV | I | I | vi | bVII | I', pad2: { p: 'sus', n: 2, open: true, reg: [43, 57], vel: 0.6 }, bass: { pat: '1-5-', vel: 0.85 },
        lead: { ph: 'C1 r2 C2 r2', vel: 0.85, shape: 0.3, swell: 0.3 }, lead2: { ph: 'r2 R1 r2 R2', vel: 0.75 }, arp: { pat: '0101010121212121', res: 4, vel: 0.5, reg: [53, 72] },
        drums: { t5: 'x.......x.......', metal: 'x.......x.......', clap: '....x.......x...', t3: '..x.......x.....', shk: 'x.x.x.x.x.x.x.x.', vel: 0.8 }, timp: 'two' },
      { n: 'muster', bars: 4, cres: [0.76, 0.92], prog: 'I | bVII | IV | I', pad3: { p: 'stab', pat: 'x.....x.....x...', n: 3, open: true, reg: [45, 60], vel: 0.75, gate: 0.4 }, bass: { pat: '1.1.1.1.', vel: 0.85 },
        arp2: { pat: '0.0.0.0.2.2.2.2.', res: 4, vel: 0.55, reg: [50, 69] },
        drums: { t5: 'x...x...x...x...', metal: 'x.......x.......', clap: '..x...x...x...x.', t4: 'x..x..x.x..x..x.', t3: '....x.......x...', vel: 0.85 }, timp: 'beats' },
      { n: 'queen', bars: 8, lv: 0.84, prog: 'vi | IV | I | bVII | vi | IV | v | I', pad: { p: 'sus', n: 4, reg: [52, 74], vel: 0.55 }, pad2: { p: 'sus', n: 2, open: true, reg: [43, 57], vel: 0.6 }, bass: { pat: '1-5-', vel: 0.8 },
        lead4: { ph: 'Q1 Q2', vel: 0.85, shape: 0.35, swell: 0.3 }, lead: { ph: 'Q1 Q2', oct: -1, vel: 0.7, shape: 0.35 }, arp: { pat: '0.2.0.2.', res: 2, vel: 0.45, reg: [53, 72] },
        drums: { t5: 'x.......x.......', metal: 'x.......x.......', clap: '....x.......x...', vel: 0.72 }, timp: 'two' },
      { n: 'crest', bars: 8, cres: [0.9, 1.0], prog: 'IV | I | IV | v | IV | I | bVII | I', pad: { p: 'sus', n: 4, reg: [52, 74], vel: 0.6 }, pad3: { p: 'stab', pat: 'x.......x.......', n: 3, open: true, reg: [45, 60], vel: 0.6, gate: 0.4 }, bass: { pat: '1-5-', vel: 0.9 },
        lead2: { ph: 'S1 S2', vel: 0.8 }, lead: { ph: 'S1 S2', vel: 0.88, harm: -2, shape: 0.3, swell: 0.3 }, lead3: { ph: 'S1 S2', oct: -1, vel: 0.7, shape: 0.3 }, lead4: { ph: 'S1 S2', oct: 1, vel: 0.5, shape: 0.3 },
        arp: { pat: '0101010121212121', res: 4, vel: 0.5, reg: [53, 72] },
        drums: { t5: 'x...x...x...x...', metal: 'x.......x.......', clap: '....x.......x...', t3: '..x.......x.....', shk: 'x.x.x.x.x.x.x.x.', crash: ['x...............', '................', '................', '................'], vel: 0.88 }, timp: 'beats', hit: 'tam', fill: 'tom' },
      { n: 'C', bars: 4, cres: [0.8, 0.6], prog: 'IV | I | bVII | I', pad2: { p: 'sus', n: 2, open: true, reg: [43, 57], vel: 0.6 }, bass: { pat: '1---', vel: 0.8 },
        lead2: { ph: 'R1 R2', vel: 0.72 }, drums: { t5: ['x.......x.......', 'x.......x.......', 'x...............', 'x...............'], metal: ['x...............', 'x...............', 'x...............', 'x...............'], vel: 0.75 } },
    ],
  });
  // The Psilon, hostile: the cold equation. The invention ticking in the strings' spiccato over a tritone pedal, the countersubject in the low
  // brass; the calculation (no tune: the claves, the clusters trembling high, the pedal); the hypothesis turned to a verdict in the horns; the
  // proof in the brass and the spiccato.
  Music._warVariant('race:psilon', { written: true, down: 3, bpm: 104, loopFrom: 'A',
    desc: 'Psilon, hostile: the cold equation — the invention ticking in the spiccato, the countersubject in the low brass, a calculation of clicks and trembling clusters, the verdict in the horns',
    forms: [['A', 'calc', 'verdict', 'proof', 'C', 'A', 'verdict', 'calc', 'proof', 'C'], ['A', 'calc', 'verdict', 'proof', 'C', 'calc', 'A', 'proof', 'C']],
    inst: { pad: 'strTrem', pad2: 'tremHi', bass: 'deep', lead: 'strOst', lead2: 'lowBrass', lead3: 'horn', lead4: 'glass', arp: 'pizz', bell: 'crystal' },
    def: { trim: 1.8 },
    sec: [
      { n: 'tick', bars: 2, cres: [0.56, 0.7], prog: 'IM7 | II', pad: { p: 'swell', n: 3, reg: [60, 76], vel: 0.5 }, bass: { pat: '1---', vel: 0.7 },
        drums: { click3: 'o.o.o.o.o.o.o.o.', click: ['................', '..x...x...x...x.'], vel: 0.6 } },
      { n: 'A', bars: 8, lv: 0.8, prog: 'IM7 | II | vi | V | IM7 | II | V | I', pad: { p: 'sus', n: 3, reg: [60, 76], vel: 0.45 }, bass: { pat: '1...5...1...5...', vel: 0.8 },
        lead: { ph: 'PS1 PS2', vel: 0.85 }, lead2: { ph: 'CS CS2', oct: -1, vel: 0.7, shape: 0.3 }, arp: { pat: '0.1.2.1.0.1.2.1.', res: 4, vel: 0.42, reg: [50, 69] },
        drums: { click3: 'o.o.o.o.o.o.o.o.', click: '..x...x...x...x.', t5: 'x.......x.......', vel: 0.72 }, timp: 'two' },
      { n: 'calc', bars: 4, cres: [0.72, 0.9], prog: 'Icl | IIcl | vicl | Vcl', pad2: { p: 'swell', n: 4, reg: [76, 91], vel: 0.6 }, bass: { pat: '1.......1.......', vel: 0.75 },
        bell: { dens: 0.35, res: 4, reg: [84, 103], vel: 0.38 }, drums: { click3: 'xxxxxxxxxxxxxxxx', click: ['x...............', 'x.......x.......', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.'], t5: ['x...............', 'x...............', 'x.......x.......', 'x...x...x...x...'], vel: 0.8 } },
      { n: 'verdict', bars: 8, lv: 0.84, prog: 'vi | iii | II | V | vi | iii | II | IM7', pad: { p: 'sus', n: 4, reg: [60, 80], vel: 0.55 }, bass: { pat: '1.1.1.1.', vel: 0.75 },
        lead3: { ph: 'H1 H2', vel: 0.85, shape: 0.35, swell: 0.3 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.4, reg: [50, 69] }, drums: { click3: 'o...o...o...o...', t5: 'x.......x.......', vel: 0.65 }, timp: 'two' },
      { n: 'proof', bars: 8, cres: [0.9, 1.0], prog: 'IM7 | II | vi | V | IM7 | II | V | I', pad: { p: 'sus', n: 4, reg: [60, 80], vel: 0.6 }, bass: { pat: '1.5.1.5.', vel: 0.9 },
        lead: { ph: 'PS1 PS2', vel: 0.88 }, lead3: { ph: 'PS1 PS2', vel: 0.82, harm: -2, shape: 0.3, swell: 0.3 }, lead2: { ph: 'CS CS2', oct: -1, vel: 0.8, shape: 0.3 }, lead4: { ph: 'PS1 PS2', oct: 1, vel: 0.35 },
        drums: { click3: 'o.o.o.o.o.o.o.o.', click: '..x...x...x...x.', t5: 'x...x...x...x...', crash: ['x...............', '................', '................', '................'], vel: 0.85 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.8, 0.6], prog: 'IM7 | II | V | I', pad: { p: 'sus', n: 3, reg: [60, 76], vel: 0.5 }, bass: { pat: '1---', vel: 0.75 },
        lead2: { ph: 'CS2', oct: -1, vel: 0.7, shape: 0.3 }, drums: { click3: ['o.o.o.o.o.o.o.o.', 'o...o...o...o...', 'o.......o.......', 'o...............'], vel: 0.62 } },
    ],
  });

  // The Bulrathi, hostile: roused. The fire song in the horns ripping in unison over war drums and the low brass; the roar (no tune: a drum
  // fill driving forward, the low brass and the cellos' tremolo); the garden scorched (its line in the trombones); the anger at full.
  Music._warVariant('race:bulrathi', { written: true, down: 2, bpm: 84, loopFrom: 'A',
    desc: 'Bulrathi, hostile: roused — the fire song ripping in the horns over war drums and the low brass, a roar of drums, the garden scorched in the trombones, the anger at full',
    forms: [['A', 'roar', 'scorched', 'anger', 'C', 'A', 'scorched', 'roar', 'anger', 'C'], ['A', 'roar', 'scorched', 'anger', 'C', 'roar', 'A', 'anger', 'C']],
    inst: { pad: 'tremLo', pad2: 'strTrem', pad3: 'brassStab', bass: 'deep', lead: 'horn', lead2: 'lowBrass', lead3: 'trombones', lead4: 'tuba' },
    def: { trim: 1.8 },
    sec: [
      { n: 'roused', bars: 2, cres: [0.6, 0.74], prog: 'i | i', pad: { p: 'swell', n: 2, open: true, reg: [38, 52], vel: 0.6 }, bass: { pat: '1---', vel: 0.75 },
        drums: { t5: ['x.......x.......', 'x...x...x...x...'], t4: ['................', '......x.....x.x.'], vel: 0.75 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'i | bVII | bVI | v | i | bVII | iv | i', pad: { p: 'sus', n: 2, open: true, reg: [38, 52], vel: 0.55 }, bass: { pat: '1-1-', vel: 0.85 },
        lead: { ph: 'B1 B2', vel: 0.88, shape: 0.3, swell: 0.3 }, lead2: { ph: 'B1 B2', oct: -1, vel: 0.65, shape: 0.3 },
        drums: { t5: 'x...x...x...x...', t4: '......x.......x.', bd: 'x.......x.......', vel: 0.8 }, timp: 'two' },
      { n: 'roar', bars: 4, cres: [0.78, 0.94], prog: 'i | bVI | bVII | i', pad: { p: 'swell', n: 2, open: true, reg: [38, 52], vel: 0.7 }, pad3: { p: 'stab', pat: 'x.....x.....x...', n: 3, open: true, reg: [43, 58], vel: 0.75, gate: 0.4 }, bass: { pat: '1.1.1.1.', vel: 0.85 },
        drums: { t5: 'x.x.x.x.x.x.x.x.', t4: 'x..x..x.x..x..x.', t3: '....x.......x.x.', bd: 'x...x...x...x...', vel: 0.85 }, timp: 'beats', fill: 'tom' },
      { n: 'scorched', bars: 4, lv: 0.84, prog: 'bIII | bVII | iv | V', pad2: { p: 'sus', n: 4, reg: [52, 72], vel: 0.55 }, bass: { pat: '1-1-', vel: 0.8 },
        lead3: { ph: 'G1', oct: -1, vel: 0.85, shape: 0.35, swell: 0.3 }, drums: { t5: 'x.......x.......', t4: '......x.......x.', vel: 0.7 }, timp: 'two' },
      { n: 'anger', bars: 8, cres: [0.9, 1.0], prog: 'i | bVII | bVI | v | i | bVII | iv | i', pad: { p: 'sus', n: 2, open: true, reg: [38, 52], vel: 0.6 }, pad2: { p: 'sus', n: 4, reg: [52, 72], vel: 0.55 }, pad3: { p: 'stab', pat: 'x.......x.......', n: 3, open: true, reg: [43, 58], vel: 0.7, gate: 0.4 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: 'B1 B2', oct: 1, vel: 0.88, harm: -2, shape: 0.3, swell: 0.3 }, lead3: { ph: 'B1 B2', vel: 0.85, shape: 0.3 }, lead4: { ph: 'B1 B2', oct: -1, vel: 0.65 },
        drums: { t5: 'x...x...x...x...', t4: '......x.......x.', bd: 'x.......x.......', crash: ['x...............', '................', '................', '................'], vel: 0.88 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 2, cres: [0.8, 0.62], prog: 'i | i', pad: { p: 'sus', n: 2, open: true, reg: [38, 52], vel: 0.6 }, bass: { pat: '1---', vel: 0.8 },
        lead4: { ph: 'TT', vel: 0.7 }, drums: { t5: ['x...x...x...x...', 'x...............'], vel: 0.75 } },
    ],
  });

  // The Sakkra, hostile: the hunt. The coil hammered in the strings' spiccato over the low brass, the toms driving the three-three-two the
  // marimba walked, the men's shouts; a passage of its own with no tune (drums and the low brass calling); the mist becomes the horns.
  Music._warVariant('race:sakkra', { written: true, down: 2, bpm: 112, loopFrom: 'A',
    desc: 'Sakkra, hostile: the hunt — the exotic coil hammered in the spiccato over the low brass, the toms driving three-three-two, the men shouting; the horns take the mist',
    forms: [['A', 'hunt', 'B', 'crest', 'C', 'A', 'B', 'hunt', 'crest', 'C'], ['A', 'hunt', 'B', 'crest', 'C', 'B', 'A', 'hunt', 'crest', 'C']],
    inst: { pad: 'strTrem', pad2: 'cellos', pad3: 'choirMen', bass: 'pulse', lead: 'strOst', lead2: 'lowBrass', lead3: 'horn', arp: 'strOst', arp2: 'marimba', choir: 'choirMen' },
    def: { trim: 2.26 },
    sec: [
      { n: 'stalk', bars: 2, cres: [0.55, 0.7], prog: 'i | v', pad3: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.5 }, bass: { pat: '1---', inst: 'deep', vel: 0.8 }, pad2: { p: 'sus', n: 2, open: true, reg: [36, 52], vel: 0.6 },
        pad: { p: 'swell', inst: 'tremLo', n: 2, open: true, reg: [40, 52], vel: 0.45 },
        drums: { hiss: '....x.......x...', t4: 'x.....x.....x...', t3: ['................', '......x.....x.x.'], shk: ['................', '..........xxxxxx'], whisper: ['x...............', '................'], vel: 0.75 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v | i | i:.5 II7:.5 | bVII+:.5 v:.5 | i', pad2: { p: 'sus', n: 2, open: true, reg: [43, 55], vel: 0.6 }, bass: { pat: '1..1..1.', vel: 0.9 },
        lead: { ph: 'SA SB', vel: 0.85 }, lead2: { ph: '@', vel: 0.6, shape: 0.3 },
        arp2: { pat: '0..1..2.0..1..2.', res: 4, vel: 0.55, reg: [48, 67] }, drums: { hiss: '....x.......x...', t4: 'x.....x.....x...', t3: '...x.....x....x.', bd: 'x.......x.......', shk: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.xxxxxx'], click3: ['..........xx....', '................', '......xx..xx....', '................'], vel: 0.8 } },
      { n: 'hunt', bars: 4, cres: [0.75, 0.9], prog: 'i | bVII+ | i | II7', pad: { p: 'stab', inst: 'lowBrass', pat: 'x.....x.....x...', n: 3, open: true, reg: [43, 58], vel: 0.8, gate: 0.5 }, pad2: { p: 'stab', inst: 'choirMenAh', pat: '......x.....x...', n: 3, reg: [48, 62], vel: 0.6, gate: 0.4 }, bass: { pat: '1..1..1.', vel: 0.9 },
        arp2: { pat: '0..1..2.0..1..2.', res: 4, vel: 0.55, reg: [48, 67] }, drums: { tri: '..x...x...x...x.', t4: 'x.....x.....x...', t3: 'x..x..x.x..x..x.', t5: 'x.......x.......', hiss: '....x.......x...', shk: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'], whisper: ['x...............', '................', 'x...............', '................'], vel: 0.85 }, timp: 'beats' },
      { n: 'B', bars: 8, lv: 0.84, prog: 'bIII | v | II | v | bIII | bVII+ | II | II7', pad: { p: 'sus', n: 4, reg: [52, 72], vel: 0.55 }, pad2: { p: 'sus', n: 2, open: true, reg: [48, 60], vel: 0.55 }, bass: { pat: '1..1..1.', vel: 0.85 },
        lead3: { ph: 'SC SD', oct: -1, vel: 0.8, shape: 0.35, swell: 0.3 }, arp: { pat: '0..1..2.', res: 2, vel: 0.5, reg: [50, 69] },
        drums: { hiss: '....x.......x...', t4: 'x.....x.....x...', shk: 'x.x.x.x.x.x.x.x.', vel: 0.72 }, timp: 'two' },
      { n: 'crest', bars: 8, cres: [0.9, 1.0], prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v | i | i:.5 II7:.5 | bVII+:.5 v:.5 | i', pad: { p: 'sus', n: 4, reg: [52, 72], vel: 0.65 }, pad2: { p: 'stab', inst: 'choirMenAh', pat: 'x.....x.....x...', n: 3, reg: [48, 62], vel: 0.6, gate: 0.4 }, bass: { pat: '1..1..1.', vel: 0.95 },
        lead: { ph: 'SA SB', vel: 0.85 }, lead2: { ph: '@', vel: 0.7, shape: 0.3 }, lead3: { ph: 'SA SB', vel: 0.85, harm: -2, shape: 0.35, swell: 0.3 },
        arp2: { pat: '0..1..2.0..1..2.', res: 4, vel: 0.55, reg: [48, 67] }, drums: { hiss: '....x.......x...', t4: 'x.....x.....x...', t3: '...x.....x....x.', t5: 'x.......x.......', shk: 'x.x.x.x.x.x.x.x.', crash: ['x...............', '................', '................', '................'], vel: 0.9 }, timp: 'beats', fill: 'tom', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.82, 0.62], prog: 'i | i:.5 II:.5 | II:.5 i:.5 | v', pad2: { p: 'sus', n: 2, open: true, reg: [36, 52], vel: 0.6 }, bass: { pat: '1---', inst: 'deep', vel: 0.8 },
        lead2: { ph: 'SA', vel: 0.7, shape: 0.3 }, drums: { t4: ['x.....x.....x...', 'x.....x.....x...', 'x...............', 'x...............'], hiss: '....x.......x...', vel: 0.75 } },
    ],
  });

})(window.MOO);
