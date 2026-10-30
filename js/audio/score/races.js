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
    inst: { pad: 'airPad', bass: 'deep', lead: 'flute', lead2: 'chime', arp: 'kora', bell: 'chime' },
    ph: {
      AL1: '5:1.5 8:.5 6:1 5:1 | 9:1.5 8:.5 6:1 5:1 | 10:1.5 9:.5 8:1 6:1 | 5:1.5 6:.5 8:2',
      AL2: '8:.5 9:.5 10:1 9:1 8:1 | 10:.5 12:.5 13:1 12:1 10:1 | 9:.5 10:.5 12:1 10:1 9:1 | 8:4',
      AL3: '6:2 5:1 3:1 | 5:2 6:2 | 8:3 6:1 | 5:4',
      AL4: '8:2 6:1 5:1 | 6:2 8:2 | 10:3 8:1 | 9:4',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.75, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'whole', lead: 'AL1 AL2', arp: { pat: '0121', res: 2, vel: 0.4, reg: [55, 79] }, drums: { shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'vi IV I V | vi IV I V', pad: 'sus', bass: 'half', lead: 'AL3 AL4', arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.3, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 0.85, prog: 'I V vi IV | I V vi IV', pad: 'sus', bass: 'half', lead: 'AL1 AL2', lead2: { ph: 'AL1 AL2', inst: 'chime', oct: 1, vel: 0.3 }, arp: { pat: '0121', res: 2, vel: 0.42, reg: [55, 81] }, bell: { dens: 0.25, res: 2, reg: [79, 100], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.', kick: 'x...............' } },
    ],
  });

  Track('race:bulrathi', {
    desc: 'Bulrathi: deep stomping drums and low, heavy brass in D minor',
    motif: '1:2 3:1 5:1 | 6:2 4:2', motifInst: 'horn',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 76, trim: 1.45, root: 'D', mode: 'minor', tonic: 50, tens: false,
    forms: [['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'], ['A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'C', 'B']],
    inst: { pad: 'dark', bass: 'deep', lead: 'horn', lead2: 'brass', bell: 'chime', choir: 'uuh' },
    ph: {
      B1: '1:2 3:1 5:1 | 6:2 4:2 | 5:2 7:2 | 1:4',
      B2: '8:2 7:1 5:1 | 6:2 8:2 | 7:2 5:2 | 5:2 7#:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i bVI bVII i | i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: 'B1 B2', timp: 'two', drums: { t5: 'X.......x.......', t4: '....x.......x.x.', kick: 'x...............', shk: 'o.o.o.o.o.o.o.o.', rim: '..o.......o.....' }, bell: { dens: 0.2, res: 1, reg: [64, 90], vel: 0.7 } },
      { n: 'B', bars: 8, lv: 0.95, prog: 'i bVI bVII i | i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: { ph: 'B1 B2', harm: -2 }, lead2: { ph: 'B1 B2', inst: 'horn', oct: -1, vel: 0.6 }, timp: 'beats', choir: { v1: 'u', v2: 'o', vel: 0.55, reg: [50, 69] }, drums: { t5: 'X.....x.X.......', t4: '....x.......x.x.', t3: '..o.......o.....', kick: 'x.......x.......', clap: '....o.......o...', shk: 'x.x.x.x.x.x.x.x.', rim: '..o.......o.....' }, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.7 }, fill: 'tom' },
      { n: 'C', bars: 4, lv: 0.85, prog: 'i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: 'B1', timp: { p: 'hits', roll: 1 }, drums: { t5: 'X.......x.......', t4: '....x.......x.x.' } },
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
      { n: 'B', bars: 8, lv: 0.85, prog: 'i:2 iv:2 i:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 66] }, bass: 'whole', lead: { ph: 'DK2 DK1', inst: 'flute', vel: 0.55 }, lead2: { ph: 'DK2 DK1', inst: 'pizz', oct: -1, vel: 0.5 }, bell: { dens: 0.2, res: 1, reg: [66, 90], vel: 0.45 }, choir: { v1: 'u', v2: 'o', vel: 0.55 }, drums: { whisper: ['x...............', '................'], whisper2: ['................', '........x.......'], rim: '..o.......o.....' } },
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
      { n: 'B', bars: 8, lv: 0.88, prog: 'IV I V I | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'HM3 HM4', inst: 'brass' }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I IV V I | vi IV V I', pad: { p: 'stab', pat: '....x.......x...', inst: 'stab', n: 3, reg: [53, 72], vel: 0.7, gate: 0.6 }, bass: 'walk', lead: { ph: 'HM1 HM2', harm: -2 }, lead2: { ph: 'HM1 HM2', inst: 'glass', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'C', bars: 4, lv: 0.9, prog: 'IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'HM3', inst: 'brass' }, timp: { p: 'beats', roll: 1 }, drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.'] } },
    ],
  });

  Track('race:klackon', {
    desc: 'Klackon: chittering insect clicks in whole-tone buzzing ostinati and skittering rhythms',
    motif: '1:.5 2:.5 1:.5 2:.5 3:1 r:1 | 3:.5 4:.5 3:.5 4:.5 5:1 r:1', motifInst: 'marimba',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 132, trim: 1.39, root: 'C', mode: 'wholetone', tens: false,
    forms: [['A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2'], ['A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B']],
    inst: { pad: 'glassPad', bass: 'pulseSyn', lead: 'seqSyn', lead2: 'marimba', arp: 'seqSyn', bell: 'vibes' },
    ph: {
      KL1: '1:.25 2:.25 1:.25 2:.25 1:.25 2:.25 3:.5 r:2 | 3:.25 4:.25 3:.25 4:.25 3:.25 4:.25 5:.5 r:2 | 5:.25 6:.25 5:.25 6:.25 5:.25 6:.25 7:.5 r:.5 7:.5 6:.5 5:.5 | 5:1 3:1 1:2',
      KL2: '1:.5 7:.5 1:.5 7:.5 3:.5 9:.5 3:.5 9:.5 | 2:.5 8:.5 2:.5 8:.5 4:.5 10:.5 4:.5 10:.5 | 3:.5 9:.5 3:.5 9:.5 5:.5 11:.5 5:.5 11:.5 | 6:1 5:1 4:1 2:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL1 KL1', arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: '....x.......x...', kick: 'x.......x.......' } },
      { n: 'B', bars: 8, lv: 0.92, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL2 KL2+1', arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: 'xxxx....xxxx....', click3: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...' } },
      { n: 'A2', bars: 8, lv: 0.85, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL1 KL1', lead2: { ph: 'KL1 KL1', inst: 'marimba', oct: 1, vel: 0.4 }, arp: { pat: '0120', res: 4, vel: 0.35, reg: [60, 84], gate: 0.45 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: '....x.......x...', kick: 'x.......x.......', rim: '..o...o...o...o.' } },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'I+:2 II+:2 I+:2 II+:2', pad: 'sus', bass: 'sync', lead: 'KL2 KL2+1', lead2: { ph: 'KL2 KL2+1', inst: 'vibes', oct: 1, vel: 0.4 }, arp: { pat: '0120', res: 4, vel: 0.36, reg: [60, 86], gate: 0.45, jump: 0.1 }, drums: { click: 'x.xx.x.xx.x.xx.x', click2: 'xxxx....xxxx....', click3: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...', clap: '....o.......o...' } },
    ],
  });

  Track('race:meklar', {
    desc: 'Meklar: cold industrial sequencer arps, four-on-the-floor machine pulse and metal strikes',
    motif: '1:.5 5:.5 1:.5 4:.5 1:.5 3:.5 1:.5 2:.5 | 1:.5 5:.5 1:.5 4:.5 1:.5 3:.5 1:.5 2:.5', motifInst: 'glass',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 128, trim: 0.96, root: 'B', mode: 'minor', tens: false,
    forms: [['A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2', 'A', 'B', 'A2', 'B2'], ['A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B', 'A', 'B2', 'A2', 'B']],
    inst: { pad: 'dark', bass: 'moogSyn', lead: 'synthSyn', lead2: 'seqSyn', arp: 'arpSawSyn', bell: 'bell' },
    ph: {
      MK1: '1:.5 5:.5 1:.5 4:.5 1:.5 3:.5 1:.5 2:.5',
      MK2: '1:.5 3:.5 5:.5 8:.5 5:.5 3:.5 1:.5 3:.5 | -1:.5 1:.5 3:.5 6:.5 3:.5 1:.5 -1:.5 1:.5 | 0:.5 2:.5 4:.5 7:.5 4:.5 2:.5 0:.5 2:.5 | 1:2 5:1 8:1',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i i bVI bVII | i i bVI bVII', pad: 'sus', bass: 'drive16', lead: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5 }, drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...', metal2: '..............x.' } },
      { n: 'B', bars: 8, lv: 0.92, prog: 'i bVI bVII i | i bVI bVII i', pad: { p: 'sus', inst: 'strings' }, bass: 'drive16', lead: 'MK2 MK2', arp: { pat: '0123210132012301', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5 }, drums: { kick: 'x...x...x...x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....x.......x...', metal2: '..x...x...x...x.', metal: 'x...............' } },
      { n: 'A2', bars: 8, lv: 0.88, prog: 'i i bVI bVII | i i bVI bVII', pad: 'sus', bass: 'drive16', lead: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', lead2: { ph: 'MK1 MK1 MK1-2 MK1-1 MK1 MK1 MK1-2 MK1-1', inst: 'seq', oct: 1, vel: 0.4 }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [47, 78], gate: 0.5, jump: 0.08 }, drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...', metal2: '..............x.' } },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'i bVI bVII i | i bVI bVII i', pad: { p: 'sus', inst: 'strings' }, bass: 'drive16', lead: 'MK2 MK2', lead2: { ph: 'MK2 MK2', inst: 'bell', oct: 1, vel: 0.35 }, arp: { pat: '0123210132012301', res: 4, vel: 0.42, reg: [47, 80], gate: 0.5, jump: 0.1 }, drums: { kick: 'x...x...x...x...', hat: 'xoxoxoxoxoxoxoxo', clap: '....x.......x...', metal2: '..x...x...x...x.', metal: 'x.......x.......' }, fill: 'snare' },
    ],
  });

  Track('race:mrrshan', {
    desc: 'Mrrshan: tribal polyrhythmic percussion under a snaking phrygian-dominant reed line',
    motif: '1:.5 2:.5 3:1 2:.5 1:.5 3:1 | 6:1.5 5:.5 4:1 2:1', motifInst: 'reed',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 112, trim: 1.34, root: 'G', mode: 'phrygDom', tens: false,
    forms: [['A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C', 'A', 'B', 'A2', 'C'], ['A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B', 'A', 'C', 'A2', 'B']],
    inst: { pad: 'dark', bass: 'moog', lead: 'reed', lead2: 'flute', arp: 'kora', bell: 'chime', choir: 'uuh' },
    ph: {
      MR1: '1:.5 2:.5 3:1 2:.5 1:.5 3:1 | 6:1.5 5:.5 4:1 2:1 | 1:.5 2:.5 3:1 2:.5 1:.5 3:1 | 6:2 4:1 3:1',
      MR2: '5:1 6:.5 5:.5 3:1 5:1 | 9:2 6:1 4:1 | 5:1 6:.5 5:.5 3:1 5:1 | 4:1 3:1 1:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1 MR2', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR2 MR1', inst: 'flute' }, lead2: { ph: 'MR2 MR1', inst: 'reed', oct: -1, vel: 0.5 }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x...............' } },
      { n: 'A2', bars: 8, lv: 1.0, prog: 'I bII I iv | I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: { ph: 'MR1 MR2', harm: -2 }, choir: { v1: 'u', v2: 'o', vel: 0.5, reg: [55, 72] }, arp: { pat: '0.21.0.2', res: 2, vel: 0.35, reg: [55, 79] }, drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', t3: 'x.......x.x.....', t4: '....x..x....x...', shk: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', kick: 'x.......x.......' }, fill: 'tom' },
      { n: 'C', bars: 4, lv: 0.8, prog: 'I bII I iv', pad: { p: 'sus', n: 3, reg: [43, 65] }, bass: 'pulse8', lead: 'MR1', drums: { t1: 'x..x..x.x..x..x.', t2: '..x...x...x.x...', shk: 'x.x.x.x.x.x.x.x.' } },
    ],
  });

  Track('race:psilon', { trim: 1.65,
    desc: 'Psilon: crystalline FM bells and glass-harmonica overtones in a cool lydian shimmer',
    motif: '8:.5 7:.5 5:.5 3:.5 5:1 1:1 | 9:.5 8:.5 6:.5 4:.5 6:1 2:1', motifInst: 'crystal',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 90, root: 'C', mode: 'lydian', oct: 1, tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'glassPad', bass: 'deep', lead: 'crystal', lead2: 'harp', arp: 'shimmer', bell: 'crystal' },
    ph: {
      PS1: '8:.5 7:.5 5:.5 3:.5 5:1 1:1 | 9:.5 8:.5 6:.5 4:.5 6:1 2:1 | 8:.5 7:.5 5:.5 7:.5 8:1 5:1 | 7:1 5:1 2:1 5:1',
      PS2: '6:2 8:2 | 8:2 6:2 | 7:2 5:2 | 5:2 2:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.72, prog: 'IM7 II IM7 V | IM7 II IM7 V', pad: 'sus', bass: 'whole', lead: 'PS1 PS1', arp: { p: 'up8', vel: 0.28, reg: [60, 88] }, drums: { click3: 'o...o...o...o...' } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'vi IV IM7 V | vi IV IM7 V', pad: { p: 'sus', inst: 'airPad' }, bass: 'half', lead: { ph: 'PS2 PS2', inst: 'harp', vel: 0.7 }, lead2: { ph: 'PS2 PS2', inst: 'crystal', oct: 1, vel: 0.45 }, arp: { p: 'up', vel: 0.28, reg: [60, 90] }, bell: { dens: 0.3, res: 2, reg: [84, 103], vel: 0.45 }, drums: { click3: 'o...o...o...o...' } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'IM7 II IM7 V | vi IV IM7 V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'PS1 PS2', lead2: { ph: 'PS1 PS2', inst: 'harp', oct: 1, vel: 0.4 }, arp: { p: 'updown', vel: 0.3, reg: [60, 90], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [84, 103], vel: 0.45 }, drums: { click3: 'o...o...o...o...', shk: 'o.o.o.o.o.o.o.o.' } },
    ],
  });

  Track('race:sakkra', { trim: 1.66,
    desc: 'Sakkra: hissing percussion and dry skins under a dorian-pentatonic kora line',
    motif: '1:.5 3:.5 5:1 3:1 2:1 | 5:1.5 6:.5 5:1 3:1', motifInst: 'kora',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 100, root: 'A', mode: 'dorian', oct: 1, tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'airPad', bass: 'pulse', lead: 'kora', lead2: 'flute', arp: 'pizz', bell: 'vibes' },
    ph: {
      SK1: '1:.5 3:.5 5:1 3:1 2:1 | 5:1.5 6:.5 5:1 3:1 | 6:1.5 5:.5 3:1 2:1 | 1:4',
      SK2: '5:.5 6:.5 8:1 6:1 5:1 | 8:1.5 6:.5 5:1 3:1 | 8:1.5 6:.5 5:1 2:1 | 2:2 1:2',
    },
    sec: [
      { n: 'A', bars: 8, lv: 0.78, prog: 'i:2 IV:2 i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: 'SK1 SK2', arp: { pat: '0.20.1.0', res: 2, vel: 0.3, reg: [57, 81] }, drums: { hiss: 'x.......x.......', shk: 'o.xo.xo.o.xo.xo.', t3: 'x...x..x....x...', rim: '....o.......o...' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'i:2 bVII:2 i:2 IV:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: { ph: 'SK2 SK1', inst: 'flute' }, lead2: { ph: 'SK2 SK1', inst: 'kora', oct: -1, vel: 0.5 }, arp: { pat: '0.20.1.0', res: 2, vel: 0.3, reg: [57, 81] }, drums: { hiss: 'x.......x.......', shk: 'xoxxoxoxxoxxoxox', t3: 'x...x..x....x...', t4: '......x.....x...', rim: '....o.......o...', kick: 'x.......x.......' } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'i:2 IV:2 i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [48, 69] }, bass: 'offbeat', lead: { ph: 'SK1 SK2', harm: -2 }, arp: { pat: '0.20.1.0', res: 2, vel: 0.32, reg: [57, 83], jump: 0.08 }, bell: { dens: 0.25, res: 2, reg: [76, 93], vel: 0.45 }, drums: { hiss: 'x.......x.......', shk: 'o.xo.xo.o.xo.xo.', t3: 'x...x..x....x...', t4: '......x.....x...', rim: '....o.......o...', kick: 'x.......x.......' }, fill: 'tom' },
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
      { n: 'A', bars: 4, lv: 0.7, prog: 'i:2 bVII:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL1', oct: 1, vel: 0.8, echo: 0.3 }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', whisper2: ['................', '........x.......', '................', '................'] } },
      { n: 'B', bars: 4, lv: 0.85, prog: 'i:2 bII:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL2', oct: 1, vel: 0.8, echo: 0.3 }, choir: { v1: 'u', v2: 'o', vel: 0.45, reg: [49, 68] }, timp: { p: 'hits', vel: 0.55, dur: 3 }, drums: { metal: 'x...............', metal2: ['................', '........o.......', '................', '................'] } },
      { n: 'C', bars: 4, lv: 0.8, prog: 'bVI:2 V:2', pad: { p: 'sus', n: 3, reg: [37, 56], vel: 0.9 }, bass: 'whole', lead: { ph: 'SL3', oct: 1, vel: 0.8, echo: 0.3 }, lead2: { ph: 'SL3', oct: 2, vel: 0.35 }, choir: { v1: 'o', v2: 'a', vel: 0.5, reg: [49, 68] }, timp: { p: 'hits', vel: 0.6, dur: 3 }, drums: { metal: 'x...............' } },
    ],
  });

  // the hostile readings (research/06 §12.5: "same motif, lower register, faster, harsher timbre")
  const WAR = {
    alkari: { tempo: 1.2, inst: { lead: 'synth' } },                                                            // screeching, rapid
    bulrathi: { tempo: 1.1, down: 2 },                                                                           // pounding, lower still
    darlok: { tempo: 1.08, inst: { lead: 'horn' }, drums: { kick: 'x..x....x..x....', rim: '......o.......o.', hiss: '....x.......x...' } },   // heartbeat pulse
    human: {},                                                                                                   // the march in minor, snare + brass
    klackon: { tempo: 1.1, inst: { lead: 'synth', arp: 'arpSaw' } },                                             // buzzing saw swarms
    meklar: { inst: { lead: 'synth' }, drums: { kick: 'x...x...x...x...', metal2: 'x.x.x.x.x.x.x.x.', click2: 'xx.xxx.x.xx.x.xx' } },   // harsh clock
    mrrshan: { tempo: 1.15, down: 5 },                                                                           // growling low brass
    psilon: { inst: { lead: 'crystal' }, drums: { t5: 'X.......x.......', click3: 'o.o.o.o.o.o.o.o.' } },         // cold clusters, tremolo bells
    sakkra: { tempo: 1.18, drums: { t3: 'x..x..x.x..x..x.', t4: '....x.......x...', kick: 'x.......x.......', shk: 'x.x.x.x.x.x.x.x.' } },   // fast tribal toms
    silicoid: { tempo: 1.15, down: 2, inst: { lead: 'horn' }, drums: { t5: 'X.......X.......', metal: 'x.......x.......', hiss: '....x.......x...' } },   // grinding pulses
  };
  for (const r in WAR) Music._warVariant('race:' + r, WAR[r]);

})(window.MOO);
