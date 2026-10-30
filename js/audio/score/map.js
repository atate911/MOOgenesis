// Master of Orion — Reborn · the score · the map
// The exploration programme: the eight planetarium pieces, the twelve movements, the rare pieces and their war readings, the interludes between pieces and the bridges into cues that cannot wait.
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  Track('galaxy4', {
    desc: 'Deep field — slow analogue pads under a high air pad, distant women’s voices, high strings that swell and fade, a celeste and harp as single points of light, a lone flute: the planetarium, in the Serrie manner',
    tags: { solitude: 1, contact: 0.2, tension: 0.1, war: 0, grief: 0.1, grandeur: 0.2, energy: 0.1, dark: 0.3 },
    bpm: 50, trim: 4.48, tone: { hi: -2.5 }, root: 'A', mode: 'lydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.25 },
    forms: [['A1', 'breath1', 'B', 'breath2', 'C', 'breath3', 'E'], ['A1', 'breath1', 'C', 'breath2', 'B', 'breath3', 'E'], ['A1', 'breath2', 'B', 'breath1', 'E', 'breath3', 'C'], ['A1', 'C', 'breath1', 'B', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute', choir: 'choirMen' }, { lead: 'clarinet', lead2: 'cello', choir: 'cellos' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'flute', lead2: 'glass', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'ooh' },
    ph: {
      S1: '5:4 | 8:4 | 7:4 | 5:4', S2: '6:4 | 8:2 9:2 | 8:4 | 5:4', S3: '10:4 | 9:4 | 8:2 7:2 | 5:4', S4: '5:2 8:2 | 7:3 6:1 | 5:4 | 3:4',
      FL: '@planetarium.FL',          // four slow notes, the Shine On shape, with the delay answering in the rests
      CL: '1:8 | 3:8 | 2:6 1:2 | 5:8',
      CM: '@men.CM',                    // the men, one sung phrase, low and slow                    // the cello: long, low, patient
    },
    sec: [
      { n: 'intro', bars: 8, cres: [0.45, 0.58], prog: 'IM7:4 II:4', pad: { p: 'swell', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.62 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.35 } },
      { n: 'A1', bars: 16, lv: 0.56, prog: 'IM7:4 II:4 | IM7:4 vi:4 | IM7:4 II:4 | V:4 IM7:4', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.62 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['S1 r8 S2', 'S2 r8 S1', 'r4 S3 r4 S4', 'S1 r4 S4'], vel: 0.45 }, choir: { n: 2, reg: [67, 81], vel: 0.35, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.32, soft: true }, arp: { pat: '0...2...1...3...', res: 1, vel: 0.4, reg: [57, 84], skip: 0.3 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.35 } },
      { n: 'breath1', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },   // nothing but the hall and, perhaps, one bell
      { n: 'B', bars: 16, lv: 0.58, prog: 'vi:4 II:4 | IM7:4 V:4 | vi:4 II:4 | IM7:4 II:4', pad: { p: 'sus', n: 4, reg: [48, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['r4 FL r8', 'FL r8 S4', 'r8 FL', 'r2 FL r2 S3'], inst: 'glass', vel: 0.45, echo: 0.3 }, lead2: { ph: ['r8 CL', 'r4 CL r4', 'CL r4 CL'], inst: 'cello', oct: -1, vel: 0.5, skip: 0.25 }, choir: { n: 2, reg: [67, 81], vel: 0.35, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.36, soft: true }, bell2: { ph: ['r8 CM', 'r4 CM', 'CM r8'], inst: 'choirMen', oct: -1, vel: 0.36, skip: 0.3 }, arp: { pat: '0.......2.......', res: 1, vel: 0.38, reg: [57, 84] }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'C', bars: 8, lv: 0.38, prog: 'IM7:4 II:4', pad: { p: 'swell', inst: 'strings', n: 3, reg: [52, 76] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.5 }, bass: false, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.3, soft: true }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath3', bars: 1, lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'IM7:4 II:4 | IM7:4 V:4', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.62 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } },
        lead: { ph: ['r4 S1', 'S4 r4', 'r2 FL r2'], vel: 0.42 }, lead2: { ph: ['r4 CL', 'CL r4'], inst: 'cello', oct: -1, vel: 0.45, skip: 0.4 }, arp: { pat: '0...2...1...3...', res: 1, vel: 0.36, reg: [57, 84] }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.35 } },
    ],
  });

  Track('galaxy1', {
    desc: 'Calm exploration, wonder: airy flute, glassy bells, the harp running and a floating lydian pad over the strings; the women only in its still',
    tags: { solitude: 0.9, contact: 0.3, tension: 0, war: 0, grief: 0, grandeur: 0.1, energy: 0.3, dark: 0 },
    bpm: 60, trim: 2.83, tone: { hi: -2.5 }, root: 'G', mode: 'lydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.2, verb: 1.25 },
    forms: [['A1', 'B', 'breath1', 'C', 'A2', 'breath2', 'B2', 'A3', 'E'], ['A1', 'C', 'breath1', 'A2', 'B', 'breath2', 'B2', 'E'], ['A1', 'A2', 'B', 'breath1', 'C', 'breath2', 'A3', 'E'], ['A1', 'B', 'A2', 'breath3', 'C', 'breath2', 'B2', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute', choir: 'choirMen' }, { lead: 'oboe', lead2: 'cello', arp: 'harp' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead2: 'cello' },
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'flute', lead2: 'glass', bell: 'glass', arp: 'harp', choir: 'choirWomen' },
    ph: {
      W1: '@wonder.W1',
      W2: '5:2 7:1 8:1 | 10:3 8:1 | 8:2! 7:1 5:1 | 5:4',
      W3: '6:3 8:1 | 10:2 9:1 8:1 | 7:3 6:1 | 4:4',
      W4: '8:2 5:2 | 7:3 5:1 | 5:2 6:1 7:1 | 7:4',
      C1: '10:4 | 9:4 | 8:4! | 7:4',
      FL: '@planetarium.FL',
      C2: '5:4 | 7:4 | 6:4 | 4:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.45, prog: 'IM7:2 II:2', pad: { p: 'swell' }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.62 }, bell: { dens: 0.14, res: 1, vel: 0.4 } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, lead: { ph: ['W1 W2','W1 W4','W1 r4','r4 W2'] }, bell: { dens: 0.12, res: 1, vel: 0.45 } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, arp: { pat: '0.2.1.3.', res: 1, vel: 0.4, reg: [62, 86], skip: 0.3 }, lead: { ph: ['W1 W2','W1 W4','W4 W2'] }, bell: { dens: 0.14, res: 1, vel: 0.45 } },
      { n: 'breath1', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.08, res: 1, vel: 0.35 } },
      { n: 'B', bars: 8, lv: 0.66, prog: 'vi iii V II | IM7 IM7 V V', pad: 'sus', bass: 'whole', arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [64, 91] }, lead: { ph: ['W3 W4','W3 W2','W3 r4'] }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.4, skip: 0.35 }, bell: { dens: 0.12, res: 1, vel: 0.45 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'vi:2 IM7:2 | V:2 II:2', pad: { p: 'swell' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.6 }, bass: false, arp: { inst: 'harp', pat: '0.......2.......', res: 2, vel: 0.3, reg: [57, 84] }, lead: { ph: ['FL C2','FL r4','r4 C2'], inst: 'cello', oct: -1, vel: 0.62 }, bell: { dens: 0.18, res: 1, vel: 0.4 }, choir2: { v1: 'u', v2: 'o', vel: 0.4, skip: 0.4 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: 'sus', pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: 'whole', arp: { pat: '0...2...1...3...', res: 1, vel: 0.34, reg: [62, 88] }, lead: { ph: ['W1 W2','W1 W4'] }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.4, skip: 0.3 }, bell: { dens: 0.3, res: 2 } },
      { n: 'B2', bars: 8, lv: 0.72, prog: 'vi iii V II | IM7 IM7 V V', pad: 'sus', pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: 'whole', arp: { p: 'up', vel: 0.36, reg: [60, 88] }, lead: { ph: ['W3 W4','W3 W2'] }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.45 }, bell: { dens: 0.35, res: 2 } },
      { n: 'breath3', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'E', bars: 8, lv: 0.6, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: 'sus', bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, lead: { ph: ['W1 W4','W4 W2','r4 W4'] }, bell: { dens: 0.2, res: 2, vel: 0.45 } },
    ],
  });

  Track('galaxy2', {
    desc: 'Calm exploration, patience: marimba ostinato, plucked reed melody, warm dorian pad',
    tags: { solitude: 0.5, contact: 0.6, tension: 0.2, war: 0.3, grief: 0.1, grandeur: 0.2, energy: 0.5, dark: 0.2 },
    quotes: ['procession'],
    bpm: 60, trim: 2.37, tone: { hi: -2.5 }, root: 'D', mode: 'dorian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.0, verb: 1.2 },
    forms: [['A1', 'B', 'A2', 'C', 'breath', 'echo', 'B2', 'A3'], ['A1', 'A2', 'C', 'breath', 'echo', 'B', 'B2'], ['A1', 'B', 'C', 'breath', 'echo', 'A3', 'B2'], ['A1', 'C', 'breath', 'echo', 'A2', 'B2', 'A3']],
    alts: [{}, { lead: 'cello', lead2: 'glass' }, { lead: 'clarinet', lead2: 'cello' }], eraAlts: { pad: 'cellos', lead: 'cello' },
    inst: { pad: 'warm', bass: 'deep', lead: 'reed', lead2: 'vibes', bell: 'vibes', arp: 'marimba' },
    ph: {
      PAm: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 2:2!',                          // the second leitmotif (the commonwealth's oboe) in the minor: its second degree kept against the tonic
      P1: '5:1.5 6:.5 8:2 | 8:1.5 7:.5 6:2 | 5:2 3:2 | 4:1 5:1 6:2',
      P2: '7:2 5:2 | 4:2 6:2 | 5:2 8:2 | 8:3 r:1',
      P3: '9:2 8:1 7:1 | 5:2 7:2 | 8:2 6:1 4:1 | 6:2 5:2',
      P4: '8:2 10:2 | 9:2 7:2 | 8:2 6:2 | 5:2 1:2',
      Q1: '5:4 | 6:4 | 8:4 | 5:4',
      Q2: '4:4 | 3:4 | 5:4 | 1:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 IV:2', pad: { p: 'swell' }, arp: { pat: '0.2.', res: 1, vel: 0.36, reg: [57, 76] } },
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: 'sus', bass: 'half', arp: { pat: '0.2.', res: 1, vel: 0.4, reg: [57, 76] }, lead: { ph: ['P1 P2', 'P1 P4', 'P3 P2'] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: 'sus', bass: 'half', arp: { pat: '0.2.', res: 1, vel: 0.4, reg: [57, 76] }, lead: { ph: ['P1 P2', 'P4 P2'] }, bell: { dens: 0.25, res: 2, reg: [76, 93], vel: 0.45, skip: 0.3 } },
      { n: 'B', bars: 8, lv: 0.68, prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.6 }, bass: 'whole', arp: { pat: '0.1.', res: 1, vel: 0.38, reg: [57, 78] }, lead: { ph: ['P3 P4', 'P3 P2', 'P4 P1'] }, lead2: { ph: '@', inst: 'vibes', oct: 1, vel: 0.4, skip: 0.3 } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVII:2 IV:2 i:2', pad: { p: 'swell' }, bass: 'whole', arp: false, lead: { ph: 'Q1 Q2', inst: 'vibes', vel: 0.62 }, bell: { dens: 0.2, res: 1, reg: [76, 93], vel: 0.4 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.72, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: 'half', arp: { pat: '0.2.1.3.', res: 1, vel: 0.44, reg: [57, 81] }, lead: { ph: ['P1 P2', 'P3 P4'] }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'B2', bars: 8, lv: 0.72, prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'organSoft', n: 3, reg: [55, 74], vel: 0.6 }, bass: 'whole', arp: { pat: '0.1.', res: 1, vel: 0.38, reg: [57, 80] }, lead: { ph: ['P3 P4', 'P4 P2'], inst: 'cello', vel: 0.65 }, lead2: { ph: '@', inst: 'vibes', oct: 1, vel: 0.45 }, choir: { vel: 0.6, skip: 0.3 } },
      { n: 'echo', bars: 4, lv: 0.44, prog: 'i i IV i', pad: { p: 'swell', inst: 'strings' }, bass: 'whole', lead: { ph: 'PAm', inst: 'oboe', vel: 0.54, shape: 0.35 } },   // the second leitmotif: an oboe's glance
    ],
  });

  Track('galaxy3', {
    desc: 'Calm exploration, determination: steady pulse, strings and a resolute horn theme',
    tags: { solitude: 0.3, contact: 0.5, tension: 0.5, war: 0.6, grief: 0.1, grandeur: 0.4, energy: 0.6, dark: 0.3 },
    quotes: ['procession'],
    bpm: 72, trim: 2.14, tone: { hi: -2.5 }, root: 'A', mode: 'minor', oct: 1, loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 1.6, verb: 1.2 },
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'echo', 'B2', 'A3', 'E'], ['A1', 'B', 'A2', 'breath', 'echo', 'C', 'B2', 'E'], ['A1', 'C', 'breath', 'echo', 'A2', 'B', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'echo', 'B2', 'A3', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'flute' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead2: 'cello' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'pulse', lead: 'horn', lead2: 'bell', bell: 'glass', arp: 'arp', choir: 'aah' },
    ph: {
      PAm: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 2:2!',                          // the second leitmotif (the commonwealth's oboe) in the minor: its second degree kept against the tonic
      D1: '1:1.5 3:.5 5:1 3:1 | 6:1.5 5:.5 3:2 | 7:1.5 5:.5 2:2 | 1:3 r:1',
      D2: '5:1.5 6:.5 8:1 6:1 | 8:1.5 6:.5 3:2 | 4:1.5 6:.5 8:2 | 7#:2 5:2',
      D3: '8:2 6:2 | 7:2 5:2 | 8:2 5:2 | 3:4',
      D4: '10:2 8:2 | 9:2 7:2 | 7#:2 9:2 | 5:4',
      D5: '8:4 | 6:4 | 5:4 | 3:4',
      D6: '6:4 | 8:4 | 7#:4 | 5:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 bVI:1 bVII:1', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'i bVI bVII i | i bVI bVII i', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [48, 67], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D1', 'D1 D2', 'r2 D1'] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [48, 67], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D2 D1'] }, arp: { p: 'up8', vel: 0.34, reg: [57, 81], skip: 0.3 } },
      { n: 'B', bars: 8, lv: 0.7, prog: 'bVI bVII i i | bVI bVII V V', pad: 'sus', bass: 'half', lead: { ph: ['D3 D4', 'D3 D6', 'D5 D4'], oct: -1 }, lead2: { ph: '@', inst: 'bell', oct: 1, vel: 0.4, skip: 0.3 }, arp: { p: 'up8', vel: 0.34, reg: [57, 81] } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'iv:2 i:2 bVI:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: false }, lead: { ph: 'D5 D6', inst: 'flute', vel: 0.7 }, bell: { dens: 0.2, res: 1, vel: 0.45 }, choir: { vel: 0.38, soft: true } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [48, 67], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D1 D1'] }, arp: { p: 'up', vel: 0.34, reg: [57, 84] }, choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.38, soft: true } },
      { n: 'B2', bars: 8, lv: 0.74, prog: 'bVI bVII i i | bVI bVII V V', pad: 'sus', bass: 'half', lead: { ph: ['D3 D4', 'D5 D6'], oct: -1 }, lead2: { ph: '@', inst: 'brass', oct: -1, vel: 0.45 }, arp: { p: 'up', vel: 0.36, reg: [57, 84] }, choir: { vel: 0.8 }, timp: { p: 'two', vel: 0.35 } },
      { n: 'E', bars: 8, lv: 0.64, prog: 'i bVI bVII i | i bVI iv V', pad: 'sus', pad2: { p: 'sus', n: 3, reg: [48, 67], vel: 0.45 }, bass: 'half', lead: { ph: ['D1 D2', 'D1 D5', 'D2 D1'] } },
      { n: 'echo', bars: 4, lv: 0.46, prog: 'i i iv V', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, lead: { ph: 'PAm', inst: 'hornSolo', vel: 0.6, shape: 0.35 } },   // the second leitmotif: the solo horn's glance
    ],
  });

  Track('galaxy5', {
    desc: 'Calm exploration, the veil: a slow waltz of the spheres — harp arpeggios, an oboe singing over the strings, women far back, celeste points of light; in three',
    tags: { solitude: 0.7, contact: 0.5, tension: 0, war: 0, grief: 0.1, grandeur: 0.2, energy: 0.4, dark: 0.1 },
    quotes: ['procession'],
    bpm: 54, meter: 3, trim: 3.12, tone: { hi: -2.5 }, root: 'Eb', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.0, verb: 1.25 },
    forms: [['A1', 'B', 'A2', 'C', 'breath', 'echo', 'B2', 'A3', 'E'], ['A1', 'A2', 'C', 'breath', 'echo', 'B', 'B2', 'E'], ['A1', 'B', 'C', 'breath', 'echo', 'A3', 'E'], ['A1', 'C', 'breath', 'echo', 'A2', 'B', 'B2', 'A3', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'clarinet', arp: 'vibes', choir: 'aah' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'air', bass: 'deep', lead: 'oboe', lead2: 'glass', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PA3: '1:2 2:1 | 3:1 5:2 | 6:2 5:1 | 3:2 2:1',                           // the second leitmotif (the commonwealth's oboe) read in three
      V1: '5:2 6:1 | 8:3 | 7:2 5:1 | 6:3', V1b: '5:1 6:1 8:1 | 8:3 | 7:1 6:1 5:1 | 6:3',          // the waltz tune and a more flowing reading of it
      V2: '8:2 9:1 | 10:3 | 9:2 8:1 | 5:3', V2b: '8:3 | 10:2 9:1 | 8:2 7:1 | 5:3',
      V3: '3:2 5:1 | 6:2 5:1 | 4:2 3:1 | 2:3',
      V4: '6:2 8:1 | 7:2 6:1 | 5:2 4:1 | 5:3', V4b: '6:2 8:1 | 7:2 6:1 | 5:2 2:1 | 1:3',          // half close / full close
      GL: '10:3 | 8:3 | 9:3 | 5:3',                                                               // the celeste answer
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.52], prog: 'I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.2', res: 1, vel: 0.34, reg: [55, 84] }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.4, reg: [55, 84] },
        lead: { ph: ['V1 V2', 'V1b V2', 'V1 V2b', 'r1 V1'], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 8, lv: 0.7, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42, skip: 0.3 }, bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.42, reg: [55, 84] },
        lead: { ph: ['V1 V2', 'V1b V2b', 'V3 V4'], vel: 0.62 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.36, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'vi IV | I V | vi ii | V I', pad: 'sus', pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: ['1--', '1-5'], inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.38, reg: [55, 84] },
        lead: { ph: ['V3 V4', 'V3 V4b', 'V4 V3'], vel: 0.6 }, lead2: { ph: 'GL GL', inst: 'glass', vel: 0.34, skip: 0.4, rest: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'I ii V I | I ii V I', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.45 }, bass: false, arp: { pat: '0..', res: 1, vel: 0.3, reg: [55, 84], skip: 0.5 },
        lead: { ph: ['V4 V4b', 'V4 r4'], inst: 'oboe', vel: 0.5 }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'I IV | vi IV | ii V | I I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1--', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.42, reg: [55, 86] },
        lead: { ph: ['V1 V2', 'V1b V2b'], vel: 0.62 }, lead2: { ph: '@', inst: 'flute', vel: 0.45 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, bell: { dens: 0.2, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 8, lv: 0.66, prog: 'vi IV | I V | vi ii | V I', pad: 'sus', pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: ['1--', '1-5'], inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '012021', res: 2, vel: 0.4, reg: [55, 86] },
        lead: { ph: ['V3 V4b', 'V4 V3'], vel: 0.62 }, choir: { n: 3, reg: [62, 79], vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.2, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I IV | I V | IV I | I I', pad: 'sus', bass: { pat: '1--', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.5 } }, arp: { pat: '0.1.2.', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['V1 V4b', 'V4b r4', 'r1 V1b'], vel: 0.56 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'echo', bars: 4, lv: 0.44, prog: 'I I IV V', pad: { p: 'swell', n: 3, reg: [52, 74] }, bass: false, arp: { pat: '0..', res: 1, vel: 0.3, reg: [55, 84], skip: 0.5 }, lead: { ph: 'PA3', inst: 'oboe', vel: 0.52, shape: 0.35 } },   // the second leitmotif: the oboe's glance, in three
    ],
  });

  Track('galaxy6', {
    desc: 'Calm exploration, the abyss: the dark between the stars — the ship\u2019s soft organ and the analogue drone on a sunken pedal, a bassoon far below, an alto flute far above, the men chanting the phrygian step; the flat second held against the tonic where it is the point; sparse, uneasy, patient',
    tags: { solitude: 0.6, contact: 0.2, tension: 0.7, war: 0.4, grief: 0.4, grandeur: 0.2, energy: 0.1, dark: 1 },
    quotes: ['men'],
    bpm: 46, trim: 4.68, tone: { hi: -3 }, root: 'E', mode: 'phrygian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.8 }, fx: { dly: 2.4, verb: 1.3 },
    forms: [['A1', 'breath1', 'B', 'C', 'breath2', 'A2', 'E'], ['A1', 'C', 'breath1', 'B', 'breath2', 'E'], ['A1', 'B', 'breath2', 'C', 'A2', 'breath1', 'E'], ['A1', 'breath1', 'C', 'A2', 'E']],
    alts: [{}, { lead: 'altoFlute', lead2: 'cello' }, { lead: 'cello', lead2: 'bassoon', pad: 'organSoft' }], eraAlts: { pad2: 'strings', lead2: 'cello' },
    inst: { pad: 'organSoft', pad2: 'drone', bass: 'deep', lead: 'bassoon', lead2: 'altoFlute', bell: 'chime', arp: 'harp', choir: 'choirMen', choir2: 'uuh' },
    ph: {
      Z1: '@procession.HY', Z1b: '5:6 6:2 | 5:2 4:2 3:4',                      // the bassoon: a step up, a slow fall
      Z2: '@abyss.Z2', Z2b: '3:4 | 2:2 3:2 | 2:4 | 1:4',                       // the phrygian descent onto the tonic
      Z3: '8:4 | 9:2! 8:2 | 6:4 | 5:4',                                 // the flat second held against the tonic: the phrygian rub, kept
      Z4: '4:4 | 5:2 6:2! | 2:4 | 1:4',
      AF: '8:6 r:2 | 6:6 r:2 | 5:8 | r:8',                                                // the alto flute, three long notes far above
      CM: '1:8 | 2:8 | 1:6 7:2 | 1:8',                                                    // the men: tonic, the half step, tonic
    },
    sec: [
      { n: 'intro', bars: 6, cres: [0.4, 0.52], prog: 'i:6', pad: { p: 'swell', n: 3, reg: [45, 67] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.4 } },
      { n: 'A1', bars: 16, lv: 0.56, prog: 'i bVI i bVI | bVI bII i i | i bVI i bVI | bVI bII i i', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z1 Z2 Z1b Z2','Z1b Z2 Z1 Z2','Z1 Z2 Z1 Z2'], rest: 0.15, vel: 0.5 }, lead2: { ph: ['r3 AF r5','r11 AF'], vel: 0.42, skip: 0.3 }, choir: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath1', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.36 } },
      { n: 'B', bars: 16, lv: 0.6, prog: 'i bVI bVI i | iv i bII i | i bVI bVI i | iv i bII i', pad: { p: 'sus', inst: 'strings', n: 3, reg: [48, 70] }, pad2: { p: 'swell', inst: 'cellos', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z3 Z4 Z3 Z4','Z3 Z4 r4 Z4','Z3 r4 Z3 Z4'], vel: 0.52 }, choir: { n: 3, reg: [43, 60], vel: 0.4, soft: true }, choir2: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.5 },
        drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'i:2 bII:2 | i:2 i:2', pad: { p: 'swell', n: 3, reg: [45, 67] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        lead2: { ph: ['CM','r8'], inst: 'choirMen', oct: -1, vel: 0.42 }, choir: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, bell: { dens: 0.1, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.6, prog: 'i bVI i bVI | bVI bII i i | i bVI i bVI | bVI bII i i', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z1 Z2 Z1b Z2','Z1b Z2 Z1 Z2'], vel: 0.52 }, lead2: { ph: ['r3 AF r5','r11 AF'], vel: 0.44, skip: 0.25 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir2: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.4 }, drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.5 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.48, prog: 'bVI bII i i | bVI bII i i', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['Z2 Z2','Z2 r4','r4 Z2'], vel: 0.48 }, choir: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.4 } },
    ],
  });

  Track('galaxy7', {
    desc: 'Calm exploration, the cradle: a lullaby in six — a rocking harp, a clarinet humming the tune, glockenspiel points, the women humming, the men beneath; the ship asleep between the stars',
    tags: { solitude: 0.9, contact: 0.2, tension: 0, war: 0, grief: 0.1, grandeur: 0, energy: 0.3, dark: 0 },
    bpm: 156, meter: 6, trim: 3.2, tone: { hi: -2.5 }, root: 'F', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 1.6, verb: 1.2 },
    forms: [['A1', 'B', 'A2', 'C', 'breath', 'B2', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E'], ['A1', 'B', 'breath', 'C', 'A3', 'E'], ['A1', 'A2', 'B', 'C', 'breath', 'B2', 'A3', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'vibes' }, { lead: 'cello', arp: 'vibes', bell: 'glass' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'warm', pad2: 'air', bass: 'deep', lead: 'clarinet', lead2: 'glass', bell: 'bell', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      L1: '@cradle.L1', L1b: '5:3 8:3 | 7:2 6:1 5:3 | 3:3 5:3 | 6:6',     // the lullaby, and a simpler reading
      L2: '8:2 9:1 10:3 | 9:2 8:1 7:3 | 6:2 5:1 6:3 | 5:6', L2b: '8:3 10:3 | 9:2 8:1 7:3 | 6:3 6:3 | 5:6',
      L3: '3:3 5:3 | 6:3 8:3 | 7:2 6:1 5:3 | 4:6',
      L4: '6:2 8:1 10:3 | 9:2 8:1 6:3 | 5:2 4:1 3:3 | 1:6',
      GL: '10:6 | 8:6 | 9:6 | 5:6',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.42, 0.52], prog: 'I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 72] }, arp: { pat: '0.1.2.', res: 1, vel: 0.36, reg: [53, 81] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 16, lv: 0.62, prog: 'I V vi V | I V ii I | I V vi V | I V ii I', pad: 'sus', bass: { pat: '1.....', inst: { p: 'deep', att: 0.6, rel: 1.6, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.4, reg: [53, 81] },
        lead: { ph: ['L1 L2 L1b L2b','L1b L2 L1 L2b','L1 L2b L1b L2'], vel: 0.58 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 16, lv: 0.7, prog: 'I V vi V | I V ii I | I V vi V | I V ii I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.3 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 81] },
        lead: { ph: ['L1 L2 L1b L2b','L1b L2b L1 L2'], vel: 0.6 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.34, skip: 0.4, rest: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 16, lv: 0.64, prog: 'I IV V IV | vi ii V I | I IV V IV | vi ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.38, reg: [53, 81] },
        lead: { ph: ['L3 L4 L3 L4','L3 L4 L3 r4','r4 L4 L3 L4'], vel: 0.58 }, lead2: { ph: 'GL GL GL GL', inst: 'glass', vel: 0.32, skip: 0.4, rest: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'vi:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: false, lead: { ph: ['GL GL', 'r4 GL'], inst: 'glass', vel: 0.42, echo: 0.3 }, arp: { inst: 'harp', pat: '0.1.2.', res: 1, vel: 0.34, reg: [53, 81] }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 16, lv: 0.7, prog: 'I V vi V | I V ii I | I V vi V | I V ii I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 83] },
        lead: { ph: ['L1 L2 L1b L2b','L1 L2 L1 L2b'], vel: 0.6 }, lead2: { ph: '@', inst: 'flute', oct: 1, vel: 0.34, skip: 0.3 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 16, lv: 0.66, prog: 'I IV V IV | vi ii V I | I IV V IV | vi ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.4, reg: [53, 83] },
        lead: { ph: ['L3 L4 L3 L4','L3 L4 L3 r4'], vel: 0.6 }, choir: { n: 3, reg: [62, 79], vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I V vi V | vi ii V I', pad: 'sus', bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.34, reg: [53, 81] },
        lead: { ph: ['L1 L4','L1b L4','r4 L4'], vel: 0.54 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  Track('galaxy8', {
    desc: 'Calm exploration, the beacon: soft horn chords and the low brass on a sunken pedal swaying between two chords, slow pizzicato, a horn calling the leitmotif from very far away, crotales and tubular bells answered by the delay; a signal from the edge',
    tags: { solitude: 0.8, contact: 0.3, tension: 0.3, war: 0, grief: 0.1, grandeur: 0.3, energy: 0.2, dark: 0.4 },
    bpm: 46, trim: 3.23, tone: { hi: -2.5 }, root: 'C', mode: 'mixolydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.85 }, fx: { dly: 2.6, verb: 1.3 },
    forms: [['A1', 'B', 'C', 'breath', 'A2', 'E'], ['A1', 'C', 'breath', 'B', 'A2', 'E'], ['A1', 'breath', 'A2', 'C', 'E'], ['A1', 'B', 'breath', 'C', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'glass' }, { lead: 'cello', pad: 'strings', pad2: 'analog' }], eraAlts: { pad2: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'horn', pad2: 'lowBrass', bass: 'deep', lead: 'hornSolo', lead2: 'crystal', bell: 'crystal', bell2: 'chime', arp: 'pizz' },
    ph: {
      K1: '@hymn.K', K1b: '5:4 | 8:2 7:2 | 6:2 5:2 | r:4',          // the leitmotif head (rising fourth, falling step) as a distant call
      K2: '8:3 10:1 | 9:2 8:2 | 7:4 | 5:4',
      K3: '4:4 | 5:2 7:2 | 6:4 | 5:4',
      K4: '5:2 8:2 | 7:3 6:1 | 5:4 | 1:4',
      CH: '8:8 | r:8 | 5:8 | r:8',                                                         // tubular bells: two strokes, the delay answers in the rests
      CR: '12:4 | 10:4 | 9:4 | 8:4',                                                        // crotales descending
    },
    sec: [
      { n: 'intro', bars: 8, cres: [0.4, 0.52], prog: 'I:4 | bVII:4', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } },
        bell2: { ph: ['r2 CH', 'CH r2', 'r4 CH'], vel: 0.4, echo: 0.3 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'A1', bars: 16, lv: 0.58, prog: 'I:2 bVII:2 | I:2 bVII:2 | I:2 bVII:2 | I:2 bVII:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.34, reg: [50, 72], skip: 0.3 },
        lead: { ph: ['K1 K2 K1 K4','K1 K2 r4 K4','r4 K1 K2 K4'], vel: 0.42 }, lead2: { ph: ['r8 CR r4', 'r12 CR'], vel: 0.34, oct: 1, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'B', bars: 8, lv: 0.6, prog: 'IV I IV I | I I bVII I', pad: { p: 'sus', n: 3, reg: [50, 69] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, arp: { pat: '0...2...1...3...', res: 4, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K3 K4','K3 r4','r4 K4'], vel: 0.46 }, lead2: { ph: ['CR CR', 'r4 CR'], vel: 0.34, oct: 1, skip: 0.35, rest: 0.3 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'I:4 | bVII:4', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        bell2: { ph: ['CH', 'r2 CH'], vel: 0.42, echo: 0.3 }, lead2: { ph: ['r4 CR', 'CR r4'], vel: 0.32, oct: 1, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.62, prog: 'I:2 bVII:2 | I:2 bVII:2 | I:2 bVII:2 | I:2 bVII:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K1 K2 K1 K4','r4 K2 K1 K4'], vel: 0.46 }, lead2: { ph: ['r4 K1 K2 K4', 'r8 K1 K4'], inst: 'tptSolo', vel: 0.36, skip: 0.3 }, bell2: { ph: ['r8 CH', 'r12 CH'], vel: 0.38, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'I:2 bVII:2 | I:2 bVII:2', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['K1 r4','K4 r4','r4 K1'], vel: 0.42 }, bell2: { ph: ['r4 CH', 'r6 CH'], vel: 0.36, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
    ],
  });

  // The interludes between two pieces of the exploration programme (hidden; the rotation re-roots one of them to the key and mode of the
  // piece that follows, see interludeFor). Each is a minute of one idea: drift (the hall, one high pad, a pedal, a few points of light and
  // perhaps the first notes of the hymn), drift2 (harp and a cello line), drift3 (voices), drift4 (strings, the analogue sky and a distant
  // horn), drift5 (one low cello note held), drift6 (the choir alone: the men's phrase under the women), drift7 (violas and cellos, a trumpet far away). The music never stops between pieces: a piece crossfades into the interlude and the interlude
  // into the next piece.
  Track('drift', {
    desc: 'Drift — an interlude: one high pad, a pedal, a few points of light and perhaps the first notes of the hymn, in the key of the piece that follows',
    bpm: 52, trim: 4.93, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.25, energy: 0.2 }, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.35 },
    alts: [{}, { bell: 'crystal', lead: 'crystal' }, { lead: 'hornSolo', bell: 'chime' }, { pad: 'strings', lead: 'flute' }],
    inst: { pad: 'air', pad2: 'strings', bass: 'deep', lead: 'glass', bell: 'glass', arp: 'harp', choir: 'ooh' },
    quotes: ['hymn'], ph: { H: '5:3 8:1 | 7:2! 6:2 | 5:4 | r:4', T: '8:4 | 5:4 | r:8', U: '3:4 | 5:4 | 4:4 | r:4' },   // the hymn's head, its falling step kept over the pedal
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.46], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.2, rel: 3.2, sub: 0.5 } }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A', bars: 8, lv: 0.44, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, pad2: { p: 'swell', n: 3, reg: [50, 72], vel: 0.5, skip: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } },
        lead: { ph: ['r2 H', 'H r4', 'r2 T r2', 'r4 U', 'r8'], vel: 0.36, echo: 0.3 }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [57, 84], skip: 0.5 }, choir: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.34 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', pad: { p: 'swell', n: 2, reg: [64, 81] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift2', {
    desc: 'Drift, harp — a slow harp figure under one long cello line, the air and the ship\u2019s soft organ far back; an interlude in the key of the piece that follows',
    bpm: 54, trim: 5.89, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.35, energy: 0.3 }, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.2, verb: 1.3 },
    alts: [{}, { arp: 'vibes', lead: 'altoFlute' }, { lead: 'clarinet' }],
    inst: { pad: 'air', pad2: 'organSoft', bass: 'deep', lead: 'cello', bell: 'glass', arp: 'harp', choir: 'ooh' },
    ph: { C1: '1:8 | 3:8 | 2:6 1:2 | 5:8', C2: '5:8 | 6:8 | 5:6 4:2 | 3:8' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [60, 79] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.34, reg: [55, 84] } },
      { n: 'A', bars: 8, lv: 0.46, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [60, 79] }, pad2: { p: 'swell', n: 3, reg: [52, 72], vel: 0.42 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } },
        arp: { pat: '0.1.2.3.', res: 2, vel: 0.36, reg: [55, 84] }, lead: { ph: ['C1', 'C2', 'r2 C1', 'r8'], oct: -1, vel: 0.5 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.36, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [60, 79] }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift3', {
    desc: 'Drift, voices — the women humming over the men, an air pad, one flute note; an interlude in the key of the piece that follows',
    bpm: 52, trim: 4.54, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.3, energy: 0.15 }, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.4, verb: 1.35 },
    alts: [{}, { lead: 'glass' }, { choir: 'aah', lead: 'altoFlute' }],
    inst: { pad: 'air', pad2: 'strings', bass: 'deep', lead: 'flute', bell: 'glass', choir: 'choirWomen', choir2: 'choirMen' },
    ph: { F: '8:4 | 5:4 | r:8', G: '5:4 | 6:4 | 5:8' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true } },
      { n: 'A', bars: 8, lv: 0.46, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, pad2: { p: 'swell', n: 3, reg: [50, 72], vel: 0.45, skip: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } },
        choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, lead: { ph: ['r2 F r2', 'r4 G', 'r8'], vel: 0.34, echo: 0.3 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.36, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.3 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift4', {
    desc: 'Drift, horizon — strings and the analogue sky swelling together, a horn calling the hymn from far away, crotales; an interlude in the key of the piece that follows',
    bpm: 52, trim: 8.4, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.4, energy: 0.35 }, rubato: 0.04, mix: { bass: 0.75 }, fx: { dly: 2.2, verb: 1.3 },
    alts: [{}, { lead: 'cello' }, { lead: 'oboe', pad2: 'air' }],
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'hornSolo', bell: 'crystal', choir: 'ooh' },
    quotes: ['hymn'], ph: { H: '5:3 8:1 | 7:2! 6:2 | 5:4 | r:4', H2: '8:3 10:1 | 9:2 8:2 | 7:4 | 5:4' },   // the hymn's head, its falling step kept over the pedal
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.5], prog: 'I:2', pad: { p: 'swell', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.55 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.55 } } },
      { n: 'A', bars: 8, lv: 0.5, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'sus', n: 3, reg: [48, 70] }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.55 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.55 } },
        lead: { ph: ['r2 H r2', 'H r4', 'r4 H2', 'r8'], vel: 0.4 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.34 }, choir: { n: 2, reg: [60, 76], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.38, prog: 'I:2', pad: { p: 'swell', n: 3, reg: [48, 70] }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  Track('drift5', {
    desc: 'Drift, the held note — one low cello note held through the whole interlude under the air, the harp touching the chord once a bar; nothing else; an interlude in the key of the piece that follows',
    bpm: 54, trim: 6.4, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.4, energy: 0.1 }, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.2, verb: 1.35 },
    alts: [{}, { arp: 'glass' }, { pad: 'strings' }],
    inst: { pad: 'air', bass: 'deep', lead: 'cello', bell: 'glass', arp: 'harp', choir: 'ooh' },
    ph: { N: '1:16! | 1:16!', N2: '5:16 | 5:16', N3: '1:8 | 1:8 | 2:8 | 1:8!' },           // the one note: the tonic held eight bars, or the fifth, or the tonic stepping once
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.46], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.4, rel: 3.4, sub: 0.5 } } },
      { n: 'A', bars: 8, lv: 0.44, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.2, rel: 3.2, sub: 0.5 } },
        lead: { ph: ['N', 'N2', 'N3'], oct: -1, vel: 0.5 }, arp: { pat: '0...............', res: 2, vel: 0.28, reg: [55, 79], skip: 0.3 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.3 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.34, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81] } },
    ],
  });

  Track('drift6', {
    desc: 'Drift, the choir — the men hold one low phrase and the women hum above them, nothing else but the hall and a chime; an interlude in the key of the piece that follows',
    bpm: 52, trim: 5.44, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.55, energy: 0.15 }, rubato: 0.04, mix: { bass: 0.7, choir: 1.15 }, fx: { dly: 1.8, verb: 1.35 },
    alts: [{}, { choir: 'aah' }, { choir2: 'choirMenAh', bell: 'glass' }],
    inst: { pad: 'air', bass: 'deep', lead: 'choirMen', bell: 'chime', choir: 'choirWomen', choir2: 'choirMen' },
    ph: { CM: '@men.CM', CM2: '@men.CM2' },
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.48], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81], vel: 0.6 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } }, choir2: { n: 3, reg: [43, 60], vel: 0.38, soft: true } },
      { n: 'A', bars: 8, lv: 0.46, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 2, reg: [64, 81], vel: 0.6, skip: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } },
        lead: { ph: ['CM', 'CM2', 'r8'], oct: -1, vel: 0.44 }, choir: { n: 2, reg: [65, 79], vel: 0.38, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true }, bell: { dens: 0.05, res: 1, reg: [64, 88], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.36, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [64, 81], vel: 0.6 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.3 } },
    ],
  });

  Track('drift7', {
    desc: 'Drift, the violas — the viola section and the cellos breathing together under an alto flute far away, the harp; an interlude in the key of the piece that follows',
    bpm: 54, trim: 6.49, tone: { hi: -3 }, root: 'C', mode: 'major', hidden: true, interlude: true, tens: false, gentle: true, tags: { dark: 0.5, energy: 0.3 }, rubato: 0.04, mix: { bass: 0.7 }, fx: { dly: 2.2, verb: 1.3 },
    alts: [{}, { lead: 'flute' }, { lead: 'clarinet', arp: 'glass' }],
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'altoFlute', bell: 'glass', arp: 'harp', choir: 'ooh' },
    quotes: ['hymn'], ph: { K: '5:3 8:1 | 7:2! 6:2 | 5:4 | r:4', P: '1:3 2:1 | 3:2 5:2 | r:8' },   // the hymn's head, its falling step kept over the pedal
    sec: [
      { n: 'in', bars: 2, cres: [0.38, 0.5], prog: 'I:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [43, 60], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } } },
      { n: 'A', bars: 8, lv: 0.48, prog: 'I:2 IV:2 | vi:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [43, 60], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } },
        lead: { ph: ['r2 K r2', 'r4 P', 'K r4', 'r8'], vel: 0.36 }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'out', bars: 2, barsVar: [1, 2], lv: 0.38, prog: 'I:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.3 } },
    ],
  });

  // The bridges: two bars in the key of a cue that cannot wait (a battle, a landing, the council chamber, the map after a fight), so the
  // cue is led into instead of cut to; startTrack builds one with interludeFor when asked for `bridge: 'tense' | 'calm' | 'dark' | 'bright'`; the first bar is on the tonic of the piece that is ending, the second on the cue's dominant (interludeFor).
  Track('bridge:tense', {
    desc: 'A bridge into a cue that cannot wait: the strings tremble and swell with a timpani roll over two bars, in the key of the piece that follows',
    bpm: 92, trim: 2.92, root: 'C', mode: 'minor', hidden: true, interlude: true, bridge: true, tens: false, rubato: 0,
    inst: { pad: 'strTrem', pad2: 'lowBrass', bass: 'deep' },
    sec: [{ n: 'B', bars: 2, cres: [0.45, 0.95], prog: 'i:2', pad: { p: 'swell', n: 4, reg: [50, 76], vel: 0.85 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', att: 0.6, sub: 0.6 } }, timp: { kick: '................', roll: 2, vel: 0.9 } }],
  });

  Track('bridge:dark', {
    desc: 'A bridge into a cue that cannot wait: the low strings tremble on a sunk pedal under the drone, the tam-tam and a timpani roll, over two bars, in the key of the piece that follows',
    bpm: 60, trim: 3.29, root: 'C', mode: 'minor', hidden: true, interlude: true, bridge: true, tens: false, rubato: 0,
    inst: { pad: 'tremLo', pad2: 'drone', bass: 'deep' },
    sec: [{ n: 'B', bars: 2, cres: [0.45, 0.9], prog: 'i:2', pad: { p: 'swell', n: 3, reg: [40, 62], vel: 0.8 }, pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', att: 0.8, sub: 0.65 } }, timp: { kick: '................', roll: 2, vel: 0.7 }, drums: { tam: 'x...............', vel: 0.7 } }],
  });

  Track('bridge:bright', {
    desc: 'A bridge into a cue that cannot wait: one swell of the brass and the strings together, the harp running up, two timpani strokes, over two bars, in the key of the piece that follows',
    bpm: 72, trim: 2.6, root: 'C', mode: 'major', hidden: true, interlude: true, bridge: true, tens: false, rubato: 0,
    inst: { pad: 'brass', pad2: 'strings', bass: 'deep', arp: 'harp' },
    sec: [{ n: 'B', bars: 2, cres: [0.5, 0.95], prog: 'I:2', pad: { p: 'swell', n: 4, reg: [52, 76], vel: 0.8 }, pad2: { p: 'swell', n: 4, reg: [50, 76], vel: 0.7 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 0.6, rel: 1.6, sub: 0.5 } }, arp: { p: 'up8', vel: 0.5, reg: [55, 88] }, timp: { p: 'two', vel: 0.7 } }],
  });

  Track('bridge:calm', {
    desc: 'A bridge into a cue that cannot wait: one swell of the strings and the soft organ with a chime, over two bars, in the key of the piece that follows',
    bpm: 60, trim: 5.33, root: 'C', mode: 'major', hidden: true, interlude: true, bridge: true, tens: false, rubato: 0,
    inst: { pad: 'strings', pad2: 'organSoft', bass: 'deep', bell: 'chime' },
    sec: [{ n: 'B', bars: 2, cres: [0.45, 0.8], prog: 'I:2', pad: { p: 'swell', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', n: 3, reg: [45, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.0, rel: 2.0, sub: 0.5 } }, bell: { dens: 0.3, res: 1, reg: [72, 96], vel: 0.5 } }],
  });

  // ---------------------------------------------------------------- the rare pieces (the Crimson Tide manner): once a cycle or so, with impact
  Track('galaxy9', {
    desc: 'The tide — deep bass swells rising out of the dark, the analogue sky and cellos over them, low brass and the men entering, the hymn in the horns at the crest; rare on the map, and felt when it comes',
    tags: { solitude: 0.3, contact: 0.3, tension: 0.7, war: 0.6, grief: 0.3, grandeur: 0.9, energy: 0.6, dark: 0.6 },
    bpm: 54, trim: 2.52, tone: { lo: 1.0 }, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0.02, mix: { bass: 1.25, choir: 1.2, pad: 1.05 }, fx: { dly: 1.2, verb: 1.15 },
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'A2', 'B', 'E'], ['A1', 'B', 'A2', 'E']],
    alts: [{}, { lead: 'cello', pad2: 'strings' }, { pad: 'dark', lead2: 'brass' }],
    inst: { pad: 'analog', pad2: 'cellos', bass: 'subSwell', lead: 'horn', lead2: 'lowBrass', bell: 'crystal', choir: 'choirMen', choir2: 'aah' },
    ph: {
      H1: '@hymn.H1',                         // the hymn (the game's leitmotif)
      T1: '@tide.T1', T2: '@tide.T2',    // the slow rise
      T3: '8:2 7:2 | 6:2 5:2 | 4:4 | 5:4',                                   // the brass answer
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.62], prog: 'i:4', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.7 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.4, rel: 1.8 } } },
      { n: 'A1', bars: 16, cres: [0.62, 0.78], prog: 'i bVI i iv | i bVI i bVII | i bVI i V7 | i bVII iv V', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.75 }, pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.2, rel: 1.8 } },
        lead: { ph: ['T1 T2 H1 T3','T1 T2 r4 T3','T1 T2 H1 r4'], vel: 0.6 }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
      { n: 'B', bars: 8, lv: 0.95, hit: 'tam', cr: true, prog: 'i bVI i V7 | i bVII iv V', pad: { p: 'sus', n: 3, reg: [48, 69], vel: 0.8 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.6 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.2, rel: 1.6 } },
        lead: { ph: ['H1 T3','H1 r4'], vel: 0.85, harm: -2 }, choir: { n: 3, reg: [43, 60], vel: 0.9 }, choir2: { n: 3, reg: [57, 74], vel: 0.5, skip: 0.4 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:4 | i:2 bVI:2', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.0 } }, choir: { n: 3, reg: [43, 60], vel: 0.45, soft: true }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.85, 1.08], hit: 'tam', prog: 'i bVI i iv | i bVI i bVII | i bVI i V7 | i bVII iv V', pad: { p: 'sus', n: 3, reg: [48, 69], vel: 0.8 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.6, rel: 1.6 } },
        lead: { ph: ['T1 T2 H1 T3','r4 T2 H1 T3'], inst: 'brass', vel: 0.95, harm: -2 }, lead2: { ph: ['r8 H1 r4','r8 H1 T3','r4 H1 H1 r4'], inst: 'choirMen', oct: -1, vel: 0.8 }, choir: { n: 3, reg: [43, 60], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.6 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.55, prog: 'i bVI i bVII | i bVI i i', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.65 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } }, lead: { ph: ['r4 H1','T2 r4','T2 H1'], inst: 'hornSolo', vel: 0.55 }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
    ],
  });

  Track('galaxy10', {
    desc: 'The chorale — the men’s choir carries everything: a hymn sung low over the organ and the analogue bed, a horn counter-line, the women joining at the crest, timpani underneath; rare on the map',
    tags: { solitude: 0.3, contact: 0.4, tension: 0.3, war: 0.3, grief: 0.4, grandeur: 0.9, energy: 0.4, dark: 0.5 },
    bpm: 64, trim: 1.69, tone: { lo: 0.8 }, root: 'G', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0.02, mix: { choir: 1.4, bass: 1.1 }, fx: { dly: 1.0, verb: 1.2 },
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'A2', 'B', 'E'], ['A1', 'B', 'A2', 'C', 'E']],
    alts: [{}, { pad: 'organSoft', lead: 'cello' }, { pad2: 'cellos', choir2: 'choirWomen' }],
    inst: { pad: 'organ', pad2: 'lowBrass', bass: 'deep', lead: 'horn', lead2: 'choirMen', bell: 'glass', choir: 'choirMen', choir2: 'aah' },
    ph: {
      HY1: '@chorale.HY1', HY2: '@chorale.HY2',     // the chorale, two lines
      HY3: '@chorale.HY3', HY4: '@chorale.HY4',     // its answer, higher
      CT: '@hymn.CT',                                             // the horn beneath
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.62], prog: 'i:2 bVI:2', pad: { p: 'swell', n: 4, reg: [45, 72], vel: 0.9 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.0 } }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
      { n: 'A1', bars: 16, cres: [0.68, 0.82], prog: 'i bVII V7 i | i iv V i | i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.85 }, pad2: { p: 'sus', n: 3, reg: [48, 69], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.5, rel: 1.6 } },
        lead2: { ph: ['HY1 HY2 HY3 HY4'], inst: 'choirMen', oct: -1, vel: 0.85 }, lead: { ph: ['r8 CT r4','r16'], vel: 0.5, skip: 0.3 }, choir: { n: 3, reg: [43, 60], vel: 0.75 } },
      { n: 'B', bars: 8, lv: 1.0, hit: 'tam', cr: true, prog: 'i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.8 }, pad2: { p: 'sus', n: 3, reg: [48, 69], vel: 0.8 }, bass: { pat: 'c---', inst: { p: 'deep', sub: 0.85, att: 0.4, rel: 1.4 } },
        lead2: { ph: ['HY3 HY4'], inst: 'choirMen', oct: -1, vel: 1.0 }, lead: { ph: ['HY3 HY4'], vel: 0.75, harm: -2 }, choir: { n: 3, reg: [43, 60], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.65 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i bVII V7 i | i iv V i', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.85, att: 1.2, rel: 2.4 } }, lead2: { ph: ['HY1 HY2','r4 HY2'], inst: 'choirMen', oct: -1, vel: 0.6 }, choir: { n: 3, reg: [43, 60], vel: 0.55, soft: true }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.88, 1.1], hit: 'tam', prog: 'i bVII V7 i | i iv V i | i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.7 }, pad2: { p: 'sus', n: 3, reg: [48, 69], vel: 0.9 }, bass: { pat: ['c---', 'c---', '1---', 'c---'], inst: { p: 'deep', sub: 0.9, att: 0.3, rel: 1.4 } },
        lead2: { ph: ['HY1 HY2 HY3 HY4'], inst: 'choirMen', oct: -1, vel: 1.0 }, lead: { ph: '@', inst: 'horn', vel: 0.7, harm: -2 }, choir: { n: 3, reg: [43, 60], vel: 1.05 }, choir2: { n: 3, reg: [57, 76], vel: 0.7 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.58, prog: 'i iv V i | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [45, 72], vel: 0.8 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.2 } }, lead2: { ph: ['HY2 HY4','r4 HY4'], inst: 'choirMen', oct: -1, vel: 0.7 }, choir: { n: 3, reg: [43, 60], vel: 0.6, soft: true } },
    ],
  });

  Music._hitsVariant('galaxy9'); Music._hitsVariant('galaxy10');   // the war-time readings of the rare pieces

  // ---------------------------------------------------------------- the twelve movements written in session 11
  // The themes are shared (the leitmotif H1, the men's phrase CM, the procession's theme, the chorale, the four slow notes of the planetarium
  // pieces); what makes each a movement of its own is its foundation: a planetarium drift, a passacaglia's variations, a nocturne's walking bass,
  // one long sunrise, a chorale prelude, a minimalist pulse, a canon, a sequence, a brass choir, a slow march, a sarabande, a sung chorale.
  Track('galaxy11', {
    desc: 'The nebula: a drift in the Serrie manner — the analogue pad and the air pad on chords that change every four bars, sub-bass swelling out of the dark, crotales and a celeste answered by the long delay, an alto flute in a few long notes, the four slow notes in the celeste, the women far back; the strings and the horn’s hymn rise through it once, then it drifts on',
    tags: { solitude: 1, contact: 0.1, tension: 0.1, war: 0, grief: 0, grandeur: 0.3, energy: 0.1, dark: 0.3 },
    bpm: 50, trim: 8.54, tone: { hi: -2.5 }, root: 'Bb', mode: 'major', loopFrom: 'drift1', tens: false, gentle: true, rubato: 0.03, mix: { bass: 0.75, bell: 1.2 }, fx: { dly: 2.8, verb: 1.3 },
    forms: [['drift1', 'lights', 'drift2', 'rise', 'breath', 'drift3', 'out'], ['drift1', 'drift2', 'lights', 'rise', 'breath', 'out'], ['drift1', 'lights', 'rise', 'breath', 'drift2', 'out'], ['drift1', 'drift3', 'lights', 'rise', 'breath', 'out']],
    alts: [{}, { lead: 'flute', bell: 'glass' }, { pad: 'padGlass', lead: 'cello', lead2: 'horn' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'analog', pad2: 'air', bass: 'subSwell', lead: 'altoFlute', lead2: 'hornSolo', bell: 'crystal', bell2: 'glass', arp: 'glass', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      NB1: '5:6 r:2 | 8:6 r:2 | 10:4 9:4 | 8:8', NB2: '6:6 r:2 | 8:6 r:2 | 10:4 8:4 | 5:8',                   // the flute: a few long notes, the delay answering in the rests
      FL: '@planetarium.FL',                                                               // the four slow notes (the planetarium pieces)
      H1: '@hymn.H1',
    },
    sec: [
      { n: 'void', bars: 8, cres: [0.34, 0.5], prog: 'IM7:4 IVM7:4', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.66 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.56 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.34 } },
      { n: 'drift1', bars: 16, lv: 0.52, prog: 'IM7:4 IVM7:4 vi7:4 IVM7:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.68 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.58 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.4, rel: 2.0 } },
        lead: { ph: ['NB1 NB2', 'NB1 r8', 'r8 NB2'], vel: 0.5, echo: 0.35 }, arp: { pat: '0.......2.......', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'lights', bars: 8, lv: 0.5, prog: 'IV:4 IM7:4', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.64 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } },
        bell2: { ph: ['FL', 'r2 FL'], vel: 0.44, echo: 0.35 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true }, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'drift2', bars: 16, lv: 0.58, prog: 'IM7:4 IVM7:4 vi7:4 IVM7:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.66 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.5 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.2, rel: 2.0 } },
        lead: { ph: ['NB1 NB2', 'r8 NB2'], vel: 0.52, echo: 0.35 }, arp: { pat: '0...2...', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 2, reg: [67, 81], vel: 0.34, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.5 }, bell: { dens: 0.18, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'rise', bars: 8, cres: [0.62, 0.82], prog: 'IM7:2 V:2 | IM7:2 V:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.55 } }, arp: { p: 'up8', inst: 'harp', vel: 0.34, reg: [55, 84] },
        lead2: { ph: 'H1 H1', vel: 0.56, harm: -2 }, lead: { ph: ['r4 NB1'], vel: 0.4, skip: 0.5 }, choir: { n: 3, reg: [64, 81], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.45 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.34 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'drift3', bars: 16, lv: 0.54, prog: 'IM7:4 IVM7:4 vi7:4 IVM7:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.68 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.58 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.4, rel: 2.0 } },
        lead: { ph: ['NB1 NB2', 'NB2 NB2'], vel: 0.44, echo: 0.3, harm: -2 }, arp: { pat: '0.......2.......', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 3, reg: [64, 81], vel: 0.36, soft: true }, bell: { dens: 0.18, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'out', bars: 8, cres: [0.5, 0.36], prog: 'IM7:4 IVM7:4', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.62 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.56 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.8, rel: 2.4 } },
        lead: { ph: ['NB1', 'r8'], vel: 0.4, echo: 0.3 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.34 } },
    ],
  });

  Track('galaxy12', {
    desc: 'The long night: a passacaglia — a ground that never stops in the basses, and a set of variations over it, each a texture of its own: the cellos alone, the cor anglais, the harp running, all pizzicato with a staccato bassoon, the hymn in the horn with the men, trembling strings and tubular bells, the full chorale; grave, patient',
    tags: { solitude: 0.4, contact: 0.3, tension: 0.6, war: 0.5, grief: 0.7, grandeur: 0.4, energy: 0.3, dark: 0.8 },
    quotes: ['planetarium'],
    bpm: 50, trim: 6.01, tone: { hi: -2.5 }, root: 'B', mode: 'minor', loopFrom: 'V1', tens: false, gentle: true, rubato: 0.02, fx: { dly: 1.4, verb: 1.25 },
    forms: [['V1', 'V2', 'V3', 'V4', 'V5', 'breath', 'V6', 'V7', 'E'], ['V1', 'V3', 'V2', 'V5', 'breath', 'V4', 'V6', 'E'], ['V1', 'V2', 'V4', 'breath', 'V3', 'V5', 'V6', 'V7', 'E'], ['V1', 'V5', 'V3', 'breath', 'V2', 'V4', 'V6', 'E']],
    alts: [{}, { lead: 'cello', lead2: 'bassoon' }, { lead: 'oboe', bell: 'glass' }], eraAlts: { pad: 'cellos', choir: 'choirMen', lead: 'cello' },
    inst: { pad: 'strings', pad2: 'cellos', bass: 'deep', lead: 'reed', lead2: 'cello', bell: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      GB: '1:3 7:1 | 6:3 5:1 | 3:3 4:1 | 5:4',                                                 // the ground: the lament's descent, and the step back up to the dominant
      P1: '3:2 4:1 5:1 | 6:3 5:1 | 5:2 3:1 1:1 | 2:4', P2: '8:3 7:1 | 6:3 5:1 | 5:3 4:1 | 2:2 7#:2',   // the cor anglais' theme and its answer, left on the leading tone
      PS: '3:1 4:1 5:1 r:1 | 6:1 5:1 r:2 | 5:1 3:1 1:1 r:1 | 2:1 r:3',                       // the same theme, clipped, for the staccato bassoon
      H1: '@hymn.H1',                                              // the hymn, which the ground was written to carry
      FL: '7:6 r:2 | 4:6 r:2 | 5:6 r:2 | 10:8', CH: '8:8 | r:8 | 5:8 | r:8',                     // the four slow notes; two strokes of the bells
      CD: '5:2 3:2 | 4:2 6:2 | 4:2 7#:2 | 1:4',                                                  // the cadence the cor anglais closes on
    },
    base: { bass: { pat: ['1--b', '1--7', '1--2', '1---'], inst: { p: 'deep', att: 0.9, rel: 2.2, sub: 0.55 }, vel: 0.9 } },
    sec: [
      { n: 'ground', bars: 4, cres: [0.42, 0.54], prog: 'i bVIM7 bIII V', bass: true, lead2: { ph: 'GB', vel: 0.62, art: 0.96 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.4 } },
      { n: 'V1', bars: 8, lv: 0.6, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: true, lead2: { ph: 'GB GB', vel: 0.6, art: 0.96 }, pad2: { p: 'sus', n: 2, reg: [45, 62], vel: 0.45 },
        lead: { ph: ['P1 P2', 'r4 P1', 'P2 P1'], vel: 0.58 } },
      { n: 'V2', bars: 8, lv: 0.64, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: true, pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.6 },
        arp: { p: 'run', vel: 0.44, reg: [55, 86], gate: 0.8 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'V3', bars: 8, lv: 0.62, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: { pat: ['1--b', '1--7', '1--2', '1---'], inst: 'moog', vel: 0.95 }, arp: { inst: 'pizz', pat: '0.2.1.2.', res: 2, vel: 0.46, reg: [50, 72], gate: 0.5 },
        lead: { ph: ['PS PS', 'PS r4'], inst: 'bassoon', vel: 0.62, art: 0.5 }, lead2: { ph: ['r4 PS', 'r8'], inst: 'oboe', vel: 0.5, art: 0.5 }, drums: { click3: 'x.......x.......', vel: 0.3 } },
      { n: 'V4', bars: 8, lv: 0.72, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: true, pad: { p: 'sus', n: 4, reg: [50, 74], vel: 0.7 }, pad2: { p: 'sus', n: 2, reg: [43, 60], vel: 0.55 },
        lead: { ph: ['H1 P2', 'P1 H1', 'H1 H1'], inst: 'horn', vel: 0.58 }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
      { n: 'V5', bars: 8, lv: 0.5, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: { pat: ['1--b', '1--7', '1--2', '1---'], inst: { p: 'deep', att: 1.2, rel: 2.6, sub: 0.55 }, vel: 0.8 }, pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 66], vel: 0.5 }, pad2: { p: 'swell', inst: 'strTrem', n: 2, reg: [67, 84], vel: 0.4 },
        lead: { ph: ['FL', 'r2 FL'], inst: 'glass', vel: 0.44, echo: 0.3 }, lead2: { ph: ['CH', 'r2 CH'], inst: 'chime', oct: 0, vel: 0.42, echo: 0.3 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'V6', bars: 8, cres: [0.76, 0.9], prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: true, pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.8 }, pad2: { p: 'sus', n: 3, reg: [40, 60], vel: 0.65 }, lead2: { ph: 'GB GB', vel: 0.62, art: 0.96 },
        lead: { ph: ['H1 H1', 'H1 P2'], inst: 'horn', vel: 0.64, harm: -2 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, timp: { p: 'two', vel: 0.4 }, drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.4 } },
      { n: 'V7', bars: 8, lv: 0.5, prog: 'i bVIM7 bIII V | i bVIM7 bIII V', bass: true, lead2: { ph: 'GB GB', vel: 0.58, art: 0.96 }, pad2: { p: 'sus', n: 2, reg: [45, 62], vel: 0.42 },
        lead: { ph: ['P1 P2', 'P2 P1'], vel: 0.56 }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [52, 79] } },
      { n: 'E', bars: 8, cres: [0.52, 0.4], prog: 'i bVIM7 bIII V | i bVIM7 iv:.5 V:.5 i', bass: { pat: ['1--b', '1--7', '1--2', '1---', '1--b', '1--7', '1-1-', '1---'], inst: { p: 'deep', att: 1.0, rel: 2.4, sub: 0.55 }, vel: 0.85 }, lead2: { ph: 'GB GB', vel: 0.56, art: 0.96 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.4 },
        lead: { ph: ['P1 CD', 'r4 CD'], vel: 0.54 } },
    ],
  });

  Track('galaxy13', {
    desc: 'The watch: a nocturne — a walking pizzicato bass under harp chords placed off the beat, an air pad far back, and a lone trumpet, very soft, with a line of its own: a fifth, then the octave, and the slow way down; the horn answers once with the procession’s theme and once with the leitmotif from across the ship, the chimes strike midnight, the strings come in only at the end of the watch',
    tags: { solitude: 0.8, contact: 0.3, tension: 0.2, war: 0, grief: 0.2, grandeur: 0.2, energy: 0.2, dark: 0.4 },
    bpm: 56, trim: 6.2, tone: { hi: -2.5 }, root: 'Ab', mode: 'major', oct: -1, loopFrom: 'W1', tens: false, gentle: true, rubato: 0.03, fx: { dly: 2.2, verb: 1.2 },
    forms: [['W1', 'W2', 'H', 'mid', 'breath', 'W3', 'dawn', 'E'], ['W1', 'H', 'mid', 'breath', 'W2', 'dawn', 'E'], ['W1', 'W2', 'mid', 'breath', 'H', 'W3', 'E'], ['W1', 'mid', 'breath', 'W2', 'H', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'oboe', lead2: 'horn', arp2: 'glass' }], eraAlts: { pad: 'cellos', lead: 'hornSolo', choir: 'choirMen' },
    inst: { pad: 'air', pad2: 'harp', bass: 'moog', lead: 'tptSolo', lead2: 'hornSolo', bell: 'bell', bell2: 'chime', arp: 'harp', arp2: 'vibes', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      N1: '1:2 5:2 | 8:3 7:1 | 6:2 5:1 3:1 | 2:4', N2: '1:2 5:2 | 10:3 9:1 | 8:2 6:1 5:1 | 5:4',                   // the nocturne: a fifth, then the octave, and the slow way down
      N3: '3:3 2:1 | 5:3 4:1 | 3:2 1:2 | 4:2 5:2', N4: '6:2 8:2 | 8:3 5:1 | 3:2 2:2 | 1:4',
      PA: '@procession.A1', CD: '@procession.CD',                    // the procession's theme and its cadence, quoted once by the horn
      H1: '@hymn.H1', K: '@hymn.K',
      CM: '@men.CM', CH: '8:8 | r:8 | 5:8 | r:8',
    },
    sec: [
      { n: 'tread', bars: 4, cres: [0.45, 0.56], prog: 'Iadd9:2 IVM7:2', bass: { pat: '1-5-', vel: 0.9 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.6, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.36 } },
      { n: 'W1', bars: 8, lv: 0.6, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', bass: { pat: '1-5-', vel: 0.9 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.6, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.36 },
        lead: { ph: ['N1 N2', 'N1 r4', 'r4 N2'], vel: 0.5 } },
      { n: 'W2', bars: 8, lv: 0.66, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', bass: { pat: ['1-5-', '1-3-'], vel: 0.9 }, pad2: { p: 'stab', pat: '..x...x.', n: 3, reg: [55, 74], vel: 0.6, gate: 1.2 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.36 },
        lead: { ph: ['N1 N2', 'N2 N1'], vel: 0.52 }, lead2: { ph: ['r4 PA', 'r8'], vel: 0.38, skip: 0.3 }, arp2: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [67, 86], skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'H', bars: 8, lv: 0.62, prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.9 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.55, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.38 },
        lead2: { ph: ['H1 r4', 'K r4'], vel: 0.44 }, lead: { ph: ['r4 N4', 'N3 N4', 'r4 CD'], vel: 0.52 }, choir: { n: 2, reg: [65, 79], vel: 0.32, soft: true } },
      { n: 'mid', bars: 8, lv: 0.44, prog: 'Iadd9:2 Vsus4:2 | IVM7:2 I:2', pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.45 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.5 } },
        bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.44, echo: 0.3 }, lead2: { ph: ['CM', 'r2 CM'], inst: 'choirMen', oct: -1, vel: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.34 } },
      { n: 'W3', bars: 8, lv: 0.68, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', bass: { pat: ['1-5-', '1-3-'], vel: 0.95 }, pad2: { p: 'stab', pat: '..x...x.', n: 3, reg: [55, 74], vel: 0.62, gate: 1.2 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.38 },
        lead: { ph: ['N1 N2', 'N2 N1'], vel: 0.54, harm: -2 }, lead2: { ph: '@', vel: 0.36, skip: 0.3 }, arp2: { pat: '0.......2.......', res: 2, vel: 0.32, reg: [67, 86] }, choir: { n: 3, reg: [62, 79], vel: 0.4 } },
      { n: 'dawn', bars: 8, cres: [0.66, 0.76], prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.95 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.55, gate: 1.4 }, pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76], vel: 0.6 },
        lead2: { ph: 'H1 r4', vel: 0.46 }, lead: { ph: ['N3 N4', 'r4 N4'], vel: 0.56, harm: -2 }, choir: { n: 3, reg: [62, 79], vel: 0.48 }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'E', bars: 8, cres: [0.56, 0.42], prog: 'I Isus2 IVadd9 V | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.85 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.5, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.34 },
        lead: { ph: ['N1 r4', 'r4 N2', 'N1 N2'], vel: 0.5 } },
    ],
  });

  Track('galaxy14', {
    desc: 'The early years, first light: one long sunrise — the violas alone in the dark, the cellos and an alto flute at the grey with a dawn theme that climbs the chord, the harp and the strings as it glows, the horns and both choirs as it rises, the hymn blazing in brass and voices with timpani at the sunrise itself, then the warmth of the day and the fall to dusk',
    tags: { solitude: 0.9, contact: 0.2, tension: 0, war: 0, grief: 0, grandeur: 0.5, energy: 0.5, dark: 0.1 },
    bpm: 54, trim: 5.74, tone: { hi: -2.5 }, root: 'Db', mode: 'major', loopFrom: 'grey', tens: false, gentle: true, rubato: 0.03, eraWin: [0, 0.55], mix: { choir: 0.85 }, fx: { dly: 1.8, verb: 1.25 },
    forms: [['grey', 'glow', 'rise', 'sunrise', 'day', 'dusk'], ['grey', 'glow', 'day', 'rise', 'sunrise', 'dusk'], ['grey', 'day', 'glow', 'rise', 'sunrise', 'dusk']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'clarinet', arp: 'vibes' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'altoFlute', lead2: 'horn', bell: 'crystal', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      D1: '1:4 | 3:2 5:2 | 6:4 | 5:2 3:2', D2: '1:4 | 3:2 5:2 | 9:2 10:2 | 7:2 5:2',                                // the dawn theme: a slow climb up the chord, and back
      D3: '6:2 8:2 | 10:3 9:1 | 8:2 6:2 | 5:4', D4: '10:2 8:2 | 7:3 5:1 | 6:2 5:2 | 5:4',                            // the climb from higher up, as the light rises
      FL1: '@wonder.W1',                                                                 // the wonder tune (the first piece), one glance back at the day
      H1: '@hymn.H1', H2: '@hymn.H2',                 // the hymn
    },
    sec: [
      { n: 'night', bars: 8, cres: [0.3, 0.42], prog: 'IM7:4 IVM7:4', pad: { p: 'swell', n: 2, reg: [48, 64], vel: 0.6 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.5 } } },
      { n: 'grey', bars: 8, cres: [0.42, 0.55], prog: 'IM7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'swell', n: 3, reg: [48, 67], vel: 0.65 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.5 } },
        lead: { ph: ['D1 r4', 'r4 D2', 'D1 D2'], vel: 0.48 }, arp: { pat: '0.......', res: 2, vel: 0.3, reg: [55, 79], skip: 0.3 } },
      { n: 'glow', bars: 8, cres: [0.55, 0.7], prog: 'IM7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.7 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.5 } }, arp: { pat: '0...2...', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['D1 D2', 'D2 D1'], vel: 0.54 }, lead2: { ph: ['r4 D1', 'r8'], inst: 'cello', oct: -1, vel: 0.42, skip: 0.4 }, choir: { n: 2, reg: [67, 81], vel: 0.36, soft: true }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.36 } },
      { n: 'rise', bars: 8, cres: [0.7, 0.9], prog: 'vi7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76], vel: 0.8 }, pad2: { p: 'sus', inst: 'horn', n: 3, reg: [50, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.55 } }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.38, reg: [55, 84] },
        lead: { ph: 'D3 D4', vel: 0.6 }, lead2: { ph: ['r4 D4', 'r8'], vel: 0.46 }, choir: { n: 3, reg: [64, 81], vel: 0.44 }, choir2: { n: 3, reg: [43, 60], vel: 0.4 }, timp: { kick: '................', roll: 2, vel: 0.5 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'sunrise', bars: 8, cres: [0.95, 1.05], prog: 'IM7:2 V:2 | IVM7:2 IM7:2', cr: false, pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 78], vel: 0.9 }, pad2: { p: 'sus', inst: 'horn', n: 3, reg: [50, 69], vel: 0.7 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.6 } }, arp: { p: 'up8', vel: 0.4, reg: [55, 86] },
        lead2: { ph: 'H1 H2', inst: 'horn', vel: 0.75, harm: -2 }, lead: { ph: 'H1 H2', inst: 'tpts', oct: 0, vel: 0.5 }, bell2: { ph: 'H1 H2', inst: 'choirWomen', vel: 0.48 }, choir: { n: 3, reg: [64, 81], vel: 0.64 }, choir2: { n: 3, reg: [43, 60], vel: 0.62 }, timp: { p: 'two', vel: 0.6 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.45 } },
      { n: 'day', bars: 8, lv: 0.68, prog: 'IM7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.7 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: '0...2...', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['D1 D2', 'FL1 D2'], vel: 0.56 }, choir: { n: 3, reg: [64, 81], vel: 0.42, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'dusk', bars: 8, cres: [0.6, 0.4], prog: 'IM7:2 V:2 | IM7:4', pad: { p: 'swell', n: 3, reg: [48, 67], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [45, 62], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } },
        lead: { ph: ['D1 r4', 'r4 D1', 'D1 D1'], vel: 0.46 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true, skip: 0.4 }, arp: { pat: '0.......', res: 2, vel: 0.28, reg: [55, 79] } },
    ],
  });

  Track('galaxy15', {
    desc: 'The early years, the lantern: a chorale prelude in a broad six — the cradle tune in long notes as a cantus firmus (the horn, then the men, then both) under a clarinet that never stops running its arpeggio figure, the ship’s soft organ holding the chords, a flute trio in the middle, the glockenspiel in the still; Bach’s manner for a sleeping ship, in four minutes',
    tags: { solitude: 0.9, contact: 0.2, tension: 0, war: 0, grief: 0, grandeur: 0.1, energy: 0.4, dark: 0.1 },
    quotes: ['cradle'],
    bpm: 56, meter: 6, trim: 4.59, tone: { hi: -2.5 }, root: 'A', mode: 'major', loopFrom: 'CF1', tens: false, gentle: true, rubato: 0.02, eraWin: [0, 0.55], fx: { dly: 1.0, verb: 1.2 },
    forms: [['CF1', 'trio', 'CF2', 'still', 'CF3', 'E'], ['CF1', 'still', 'CF2', 'trio', 'E'], ['CF1', 'trio', 'still', 'CF3', 'E']],
    alts: [{}, { arp: 'flute', lead: 'cello' }, { arp: 'oboe', arp2: 'harp' }], eraAlts: { pad: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'organSoft', pad2: 'strings', bass: 'deep', lead: 'horn', lead2: 'choirMen', bell: 'glass', arp: 'clarinet', arp2: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      CF1: '5:4 6:2 8:6 | 7:4 6:2 5:6 | 3:5 4:1 5:6 | 6:12',                                    // the cradle tune at half speed: the cantus firmus
      CF2: '8:4 9:2 10:6 | 9:5 8:1 7:6 | 6:4 5:2 6:6 | 5:6 1:6',
      TR1: '3:1 5:1 8:3 6:1 | 5:2 3:1 2:3 | 2:1 3:1 5:3 6:1 | 5:6', TR2: '6:1 8:1 10:3 8:1 | 6:2 5:1 4:3 | 3:1 5:1 6:3 5:1 | 1:6',   // the trio: a tune of its own for the flute
      GL: '10:6 | 7:6 | 8:6 | 6:6',
    },
    sec: [
      { n: 'fig', bars: 4, cres: [0.45, 0.58], prog: 'I:2 IV:2', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.7 }, arp: { pat: '012321012321', res: 2, vel: 0.5, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', pedal: true, inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } } },
      { n: 'CF1', bars: 8, lv: 0.64, prog: 'I:2 V:2 | I:2 IV:2', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.75 }, arp: { pat: '012321012321', res: 2, vel: 0.5, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } },
        lead: { ph: 'CF1', vel: 0.56 }, drums: { tri: ['x...........', '............'], vel: 0.4 } },
      { n: 'trio', bars: 8, lv: 0.56, prog: 'I IV V ii | vi ii I I', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.5 } }, arp2: { pat: '0.1.2.', res: 1, vel: 0.36, reg: [53, 81] },
        lead: { ph: ['TR1 TR2', 'TR1 r4'], inst: 'flute', vel: 0.56 }, lead2: { ph: '@', inst: 'oboe', oct: 0, vel: 0.4, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'CF2', bars: 8, lv: 0.7, prog: 'I:2 V:2 | IV:2 V:1 I:1', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.75 }, arp: { pat: '012321012321', res: 2, vel: 0.52, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } },
        lead2: { ph: 'CF2', oct: -1, vel: 0.6 }, lead: { ph: ['CF2', 'r8'], inst: 'oboe', oct: 1, vel: 0.36, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true }, drums: { tri: ['x...........', '............'], vel: 0.4 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:2 I:2', pad: { p: 'swell', n: 4, reg: [48, 72], vel: 0.65 }, bass: false, bell2: { ph: ['GL GL', 'r4 GL'], inst: 'bell', oct: 1, vel: 0.36, rest: 0.3 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'CF3', bars: 8, cres: [0.7, 0.82], prog: 'I:2 V:2 | IV:2 V:1 I:1', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.8 }, pad2: { p: 'sus', n: 3, reg: [52, 74], vel: 0.5 }, arp: { pat: '012321012321', res: 2, vel: 0.54, reg: [57, 81], gate: 0.9 }, arp2: { inst: 'flute', pat: '0.....1.....', res: 2, vel: 0.3, reg: [72, 91], skip: 0.4 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.5 } },
        lead: { ph: 'CF2', vel: 0.62, harm: -2 }, lead2: { ph: '@', oct: -1, vel: 0.62 }, choir: { n: 3, reg: [62, 79], vel: 0.48 }, choir2: { n: 3, reg: [43, 60], vel: 0.5 }, drums: { tri: ['x...........', '............'], vel: 0.42 } },
      { n: 'E', bars: 8, cres: [0.58, 0.42], prog: 'I V I IV | I V I I', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.7 }, arp: { pat: ['012321012321', '012321012321', '012321012321', '012321012321', '012321012321', '012321......', '0.2.........', '0...........'], res: 2, vel: 0.46, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } } },
    ],
  });

  Track('galaxy16', {
    desc: 'The early years, the survey: a minimalist pulse — the violas in soft even eighths with a marimba on the chord tones, a pizzicato bass, a flute in short cells of the leitmotif that lengthen as the piece goes, the glockenspiel echoing them, the harp running and the women singing one long line over the cells at the full; no sustained strings until the voices come; the scouts going out, star by star',
    tags: { solitude: 0.7, contact: 0.3, tension: 0.1, war: 0, grief: 0, grandeur: 0.1, energy: 0.7, dark: 0 },
    quotes: ['procession', 'hymn'],
    bpm: 76, trim: 6.9, tone: { hi: -2.0 }, root: 'D', mode: 'major', loopFrom: 'cell1', tens: false, gentle: true, rubato: 0.015, eraWin: [0, 0.55], fx: { dly: 1.3, verb: 0.95, stage: 1.15 }, sends: { arp: { verb: 0.1, stage: 0.3 } },
    forms: [['cell1', 'cell2', 'add', 'full', 'thin', 'echo', 'full2', 'out'], ['cell1', 'add', 'thin', 'echo', 'cell2', 'full', 'out'], ['cell1', 'cell2', 'thin', 'echo', 'add', 'full2', 'out']],
    alts: [{}, { lead: 'oboe', lead2: 'vibes' }, { lead: 'clarinet', arp: 'pizz' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'violas', pad2: 'air', bass: 'pulse', lead: 'flute', lead2: 'bell', bell: 'bell', arp: 'marimba', arp2: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PA: '@procession.A1',                                                   // the second leitmotif: the commonwealth's oboe tune
      CE1: '5:.5 8:.5 7:1 r:2 | 5:.5 8:.5 7:.5 6:.5 5:2 | r:4 | r:4',                                              // the leitmotif's head as a cell, and the cell grown by a note
      CE2: 'r:4 | 5:.5 8:.5 7:1 6:.5 5:.5 3:1 | 2:.5 3:.5 5:2 r:1 | r:4',
      CE3: '5:.5 8:.5 7:1 6:.5 5:.5 3:1 | 2:.5 3:.5 5:2 6:.5 8:.5 | 7:1 6:.5 5:.5 3:2 | 2:4',                        // the cells joined into the line
      SV1: '8:3 7:1 | 6:2 5:2 | 3:3 2:1 | 1:4', SV2: '4:3 6:1 | 8:2 6:2 | 7:3 5:1 | 5:4',                           // the chart: one long line sung over the cells
      S5: '4:2 6:2 | 5:2 3:2 | 2:2 3:2 | 1:4', FL: '4:6 r:2 | 1:6 r:2 | 2:6 r:2 | 6:8',
    },
    sec: [
      { n: 'pulse', bars: 4, cres: [0.5, 0.6], prog: 'IM7:2 IVM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.55, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.4, reg: [60, 81], gate: 0.5 } },
      { n: 'cell1', bars: 8, lv: 0.64, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.58, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.42, reg: [60, 81], gate: 0.5 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE1 CE1', 'CE1 CE2', 'r4 CE1'], vel: 0.56, art: 0.7 } },
      { n: 'cell2', bars: 8, lv: 0.68, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.6, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.42, reg: [60, 81], gate: 0.5 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE1 CE2', 'CE2 CE1', 'CE1 CE1'], vel: 0.58, art: 0.7 }, lead2: { ph: ['r2 CE1 r2', 'r6 CE1'], oct: 1, vel: 0.34, skip: 0.3 }, drums: { click: 'x.......x.......', vel: 0.3, skip: 0.5 } },
      { n: 'add', bars: 8, lv: 0.7, prog: 'vi7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.6, gate: 0.6 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.44, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.34, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE3 CE3', 'CE3 r4', 'r4 CE3'], vel: 0.58, art: 0.8 }, lead2: { ph: ['r1 CE3 r3', 'r8'], oct: 1, vel: 0.34, skip: 0.3 } },
      { n: 'full', bars: 8, cres: [0.72, 0.82], prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.62, gate: 0.6 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.5 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.46, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.36, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.95 },
        lead: { ph: ['CE3 CE3', 'CE1 CE3'], vel: 0.6, art: 0.8 }, lead2: { ph: 'SV1 SV2', inst: 'choirWomen', vel: 0.5 }, choir: { n: 3, reg: [62, 79], vel: 0.42 }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'thin', bars: 8, lv: 0.46, prog: 'IVM7:2 IM7:2 | IM7:2 IVM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x...x...x...x...', n: 2, reg: [60, 74], vel: 0.42, gate: 0.6 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: false,
        lead: { ph: 'FL', inst: 'glass', vel: 0.42, echo: 0.3 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true } },
      { n: 'full2', bars: 8, cres: [0.74, 0.84], prog: 'vi7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.62, gate: 0.6 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.55 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.46, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.36, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.95 },
        lead: { ph: ['CE3 CE3', 'CE3 r4'], vel: 0.6, art: 0.8 }, lead2: { ph: 'SV1 SV2', inst: 'choirWomen', vel: 0.52 }, bell2: { ph: 'SV1 SV2', inst: 'oboe', vel: 0.4, skip: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.45 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true } },
      { n: 'out', bars: 8, cres: [0.58, 0.4], prog: 'IM7:2 vi7:2 | IVM7:2 IM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: ['x.x.x.x.', 'x.x.x.x.', 'x.x.x.x.', 'x.x.x.x.', 'x...x...', 'x...x...', 'x.......', 'x.......'], n: 3, reg: [55, 74], vel: 0.5, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.38, reg: [60, 81], gate: 0.5 }, bass: { pat: '1---', vel: 0.85 },
        lead: { ph: ['CE1 S5', 'r4 S5'], vel: 0.5, art: 0.8 } },
      { n: 'echo', bars: 4, lv: 0.46, prog: 'I I IV V', pad: { p: 'swell', n: 3, reg: [52, 74], vel: 0.5 }, bass: { pat: '1---', pedal: true }, lead: { ph: 'PA', inst: 'flute', vel: 0.52, shape: 0.35 } },   // the second leitmotif: the flute's glance
    ],
  });

  Track('galaxy17', {
    desc: 'The middle years, the commonwealth: a canon for woodwinds — an oboe states the procession’s theme alone over a walking bassoon and the horns’ soft chord, a clarinet follows it two bars behind, a flute four bars behind, three voices of one tune; a dialogue between the strains, the men for one phrase, a triangle; no strings but the bassoon; the talk between peoples',
    tags: { solitude: 0.1, contact: 1, tension: 0.1, war: 0, grief: 0, grandeur: 0.4, energy: 0.6, dark: 0 },
    bpm: 66, trim: 3.86, tone: { hi: -2.0 }, root: 'E', mode: 'major', loopFrom: 'theme', tens: false, gentle: true, rubato: 0.03, eraWin: [0.15, 0.9], fx: { dly: 1.2, verb: 1.1, stage: 1.1 },
    forms: [['theme', 'talk', 'canon2', 'canon3', 'still', 'canon3b', 'E'], ['theme', 'canon2', 'talk', 'still', 'canon3', 'E'], ['theme', 'talk', 'canon3', 'still', 'canon2', 'canon3b', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'oboe', bell2: 'clarinet' }, { lead: 'clarinet', lead2: 'cello', bell2: 'flute' }], eraAlts: { pad2: 'cellos', lead2: 'cello', choir: 'choirMen' },
    inst: { pad: 'horn', pad2: 'cellos', bass: 'bassoon', lead: 'oboe', lead2: 'clarinet', bell: 'glass', bell2: 'flute', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      Q1: '1:3 2:1 | 3:2 5:2', R1: '6:3 5:1 | 3:2 2:2', Q2: '5:3 8:1 | 7:2 6:2', R2: '5:3 3:1 | 2:2 1:2',           // the talk: a question, an answer
      PA: '@procession.A1', PB: '@procession.A2',                      // the procession's theme: the canon's subject
      EP: '5:3 6:1 | 8:2 5:2 | 6:3 5:1 | 3:4', EP2: '5:3 6:1 | 8:2 9:2 | 8:3 6:1 | 5:4',                              // the episode: the oboe's own thought between the canons
    },
    sec: [
      { n: 'walk', bars: 4, cres: [0.45, 0.58], prog: 'I:2 IV:2', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.38 }, bass: { p: 'walk', vel: 0.8 } },
      { n: 'theme', bars: 8, lv: 0.62, prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.38 }, bass: { p: 'walk', vel: 0.85 },
        lead: { ph: 'PA PB', vel: 0.56 } },
      { n: 'talk', bars: 8, lv: 0.64, prog: 'I I vi V | I V ii V:.5 I:.5', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.4 }, bass: { p: 'half', vel: 0.85 }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead: { ph: ['Q1 r2 Q2 r2', 'Q1 r2 Q1 r2'], vel: 0.54 }, lead2: { ph: ['r2 R1 r2 R2', 'r2 R1 r4'], vel: 0.5 }, drums: { tri: ['x...............', '................'], vel: 0.4 } },
      { n: 'canon2', bars: 8, lv: 0.66, prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.4 }, bass: { p: 'walk', vel: 0.9 },
        lead: { ph: 'PA PB', vel: 0.56 }, lead2: { ph: 'r2 PA PB', vel: 0.5 }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'canon3', bars: 8, lv: 0.7, prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.42 }, bass: { p: 'walk', vel: 0.9 },
        lead: { ph: 'PA PB', vel: 0.56 }, lead2: { ph: 'r2 PA PB', vel: 0.5 }, bell2: { ph: 'r4 PA PB', oct: 1, vel: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, drums: { tri: ['x...............', '................'], vel: 0.4 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 69], vel: 0.42 }, pad2: { p: 'swell', n: 2, reg: [43, 60], vel: 0.5 }, bass: false, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead: { ph: ['EP EP2', 'r4 EP2'], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'canon3b', bars: 8, cres: [0.7, 0.8], prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 4, reg: [50, 72], vel: 0.48 }, pad2: { p: 'sus', n: 2, reg: [43, 60], vel: 0.5 }, bass: { p: 'walk', vel: 0.95 },
        lead: { ph: 'PA PB', vel: 0.6, harm: -2 }, lead2: { ph: 'r2 PA PB', vel: 0.52 }, bell2: { ph: 'r4 PA PB', oct: 1, vel: 0.42 }, choir: { n: 3, reg: [62, 79], vel: 0.46 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true, skip: 0.4 }, drums: { tri: ['x...............', '................'], vel: 0.42 } },
      { n: 'E', bars: 8, cres: [0.56, 0.42], prog: 'I I vi V | I V ii V:.5 I:.5', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.38 }, bass: { p: 'half', vel: 0.8 },
        lead: { ph: ['Q1 r2 Q2 r2', 'Q1 r6'], vel: 0.5 }, lead2: { ph: ['r2 R1 r2 R2', 'r6 R2'], vel: 0.46 } },
    ],
  });

  Track('galaxy18', {
    desc: 'The middle years, the lanes: a sequence in the Serrie manner — a celeste running in sixteenths with a faint synth pluck on the beats, the analogue pad beneath, the strings over it and an oboe with a tune of its own; the sequence stops for the men in the still, and the horn brings the hymn at the crest with both choirs; the trade lanes between the stars',
    tags: { solitude: 0.3, contact: 0.8, tension: 0.1, war: 0, grief: 0, grandeur: 0.4, energy: 0.6, dark: 0.1 },
    quotes: ['procession'],
    bpm: 66, trim: 4.27, tone: { hi: -2.0 }, root: 'G', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0.02, eraWin: [0.15, 0.9], fx: { dly: 2.2, verb: 1.2 }, sends: { arp: { verb: 0.14, stage: 0.2 } },
    forms: [['A1', 'A2', 'B', 'still', 'breath', 'echo', 'A3', 'crest', 'E'], ['A1', 'B', 'still', 'breath', 'echo', 'A2', 'crest', 'E'], ['A1', 'A2', 'still', 'breath', 'echo', 'B', 'crest', 'E'], ['A1', 'B', 'A2', 'breath', 'echo', 'still', 'crest', 'E']],
    alts: [{}, { lead: 'flute', arp: 'vibes' }, { lead: 'clarinet', arp2: 'arp', pad2: 'padGlass' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'oboe', lead2: 'hornSolo', bell: 'glass', bell2: 'crystal', arp: 'glass', arp2: 'seqSyn', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PA: '@procession.A1',                                                   // the second leitmotif: the commonwealth's oboe tune
      LN1: '5:3 8:1 | 7:2 6:2 | 5:4 | 3:4', LN2: '4:3 6:1 | 8:2 6:2 | 7:3 5:1 | 5:4',                      // the lanes: the oboe's tune
      LN3: '8:3 7:1 | 6:2 5:2 | 8:2 5:2 | 6:4', LN4: '6:2 8:2 | 7:3 5:1 | 5:2 6:1 7:1 | 7:4',
      H1: '@hymn.H1',
    },
    sec: [
      { n: 'seq', bars: 4, cres: [0.46, 0.58], prog: 'IM7:2 vi7:2', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.2, reg: [55, 79], gate: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.55 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.2, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN1 LN2', 'LN1 r4', 'r4 LN2'], vel: 0.54 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.58 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN1 LN2', 'r4 LN2'], vel: 0.56 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.3, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'vi7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.6 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 67], vel: 0.5 }, bass: { pat: '1-1-', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN3 LN4', 'LN3 r4', 'r4 LN4'], vel: 0.56 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.5 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:4', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.65 }, pad: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [67, 91], skip: 0.3 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.68, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.6 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.44, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: 'LN1 LN2', vel: 0.56, harm: -2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.32, skip: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.42, soft: true } },
      { n: 'crest', bars: 8, cres: [0.7, 0.84], prog: 'IM7:2 V:2 | IM7:2 V:2', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1-1-', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.55 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.44, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.24, reg: [55, 79], gate: 0.5 },
        lead2: { ph: 'H1 H1', vel: 0.58, harm: -2 }, lead: { ph: ['r4 LN2', 'r8'], vel: 0.5 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.45 } },
      { n: 'E', bars: 8, cres: [0.56, 0.4], prog: 'IM7:2 vi7:2 | IVM7:2 IM7:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.5 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: ['0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.......', '0.2.1...........', '0...............', '0...............'], res: 4, vel: 0.4, reg: [67, 91], gate: 0.6 },
        lead: { ph: ['LN1 r4', 'r4 LN2'], vel: 0.5 } },
      { n: 'echo', bars: 4, lv: 0.44, prog: 'I I IV V', pad: { p: 'swell', n: 3, reg: [52, 74], vel: 0.5 }, bass: { pat: '1---', pedal: true }, lead: { ph: 'PA', inst: 'oboe', vel: 0.54, shape: 0.35 } },   // the second leitmotif: the oboe's glance
    ],
  });

  Track('galaxy19', {
    desc: 'The middle years, noon: a chorale for brass choir — horns in four parts, the trumpets soft on a chorale strain of its own, trombones beneath, the low brass as the bass, timpani on the step; the strings answer with the title’s hymn as the second strain, the two choirs join the brass at the full, and a plagal amen closes it; the empire at its height',
    tags: { solitude: 0.1, contact: 0.6, tension: 0.1, war: 0.1, grief: 0, grandeur: 1, energy: 0.6, dark: 0 },
    quotes: ['procession'],
    bpm: 68, trim: 4.07, tone: { hi: -1.5, lo: 0.5 }, root: 'C', mode: 'major', loopFrom: 'ch1', tens: false, gentle: true, rubato: 0.02, eraWin: [0.15, 0.9], mix: { choir: 1.15, lead: 0.9 }, fx: { dly: 0.8, verb: 1.25 },
    forms: [['ch1', 'str', 'ch2', 'still', 'echo', 'ch3', 'amen'], ['ch1', 'still', 'echo', 'str', 'ch2', 'ch3', 'amen'], ['ch1', 'str', 'still', 'echo', 'ch3', 'amen']],
    alts: [{}, { lead: 'horn', lead2: 'lowBrass' }, { lead: 'hornSolo', pad2: 'strings', lead2: 'cello' }], eraAlts: { pad2: 'lowBrass', lead: 'trombones', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'horn', bass: 'lowBrass', lead: 'tpts', lead2: 'trombones', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PA: '@procession.A1',                                                   // the second leitmotif: the commonwealth's oboe tune
      NC1: '3:2 5:2 | 6:3 5:1 | 4:2 6:2 | 5:4', NC2: '8:2 10:2 | 6:3 4:1 | 5:2 7:2 | 8:4',                       // the chorale's own first strain: up through the chord, a reach, a close
      H3: '@hymn.H3', H4: '@hymn.H4',            // the hymn's answer (the title), the second strain
      TB: '3:4 | 1:4 | 1:4 | 2:4', TB2: '3:4 | 6:4 | 7:4 | 3:4',                                                  // the trombones beneath the first strain
      T1: '@tide.T1', T2: '@tide.T2',
    },
    sec: [
      { n: 'call', bars: 4, cres: [0.5, 0.62], prog: 'I:2 V:2', pad2: { p: 'swell', n: 3, reg: [50, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'lowBrass', att: 0.2 }, vel: 0.7 }, lead2: { ph: 'T1', vel: 0.5 }, timp: { p: 'hits', vel: 0.4 } },
      { n: 'ch1', bars: 8, lv: 0.66, prog: 'I vi IV V | I IV V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.8 },
        lead: { ph: ['NC1 NC2', 'NC1 r4'], vel: 0.5 }, lead2: { ph: ['TB TB2', 'r4 TB2'], vel: 0.48 }, timp: { p: 'two', vel: 0.42 } },
      { n: 'str', bars: 8, lv: 0.6, prog: 'I IV I V | IV I V I', pad: { p: 'sus', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['H3 H4', 'H3 r4'], inst: 'strings', oct: 1, vel: 0.5 }, lead2: { ph: ['r4 H4', 'r8'], inst: 'cello', oct: -1, vel: 0.46, skip: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'ch2', bars: 8, cres: [0.72, 0.84], prog: 'I vi IV V | I IV V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.65 }, pad: { p: 'sus', n: 3, reg: [55, 76], vel: 0.45 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.85 },
        lead: { ph: 'NC1 NC2', vel: 0.54, harm: -2 }, lead2: { ph: 'TB TB2', vel: 0.5 }, bell2: { ph: 'NC1 NC2', inst: 'choirWomen', vel: 0.45 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.5 }, timp: { p: 'two', vel: 0.46 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:4', pad: { p: 'swell', n: 3, reg: [52, 74], vel: 0.6 }, pad2: { p: 'swell', n: 3, reg: [50, 69], vel: 0.35 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.5 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead2: { ph: ['TB2', 'r8'], vel: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'ch3', bars: 8, cres: [0.82, 0.96], prog: 'I IV I V | IV I V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.7 }, pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'lowBrass', att: 0.1 }, vel: 0.9 },
        lead: { ph: 'H3 H4', vel: 0.58, harm: -2 }, lead2: { ph: 'TB TB2', vel: 0.54 }, bell2: { ph: 'H3 H4', inst: 'strings', oct: 1, vel: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.65 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, timp: { p: 'beats', vel: 0.5 }, drums: { bdSoft: 'x...............', vel: 0.35 } },
      { n: 'amen', bars: 8, cres: [0.6, 0.44], prog: 'IV:2 I:2 | IV:2 I:4', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.5 }, pad: { p: 'swell', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.2 }, vel: 0.7 },
        lead: { ph: ['r4 T2', 'r8'], inst: 'hornSolo', vel: 0.46 }, choir: { n: 3, reg: [62, 79], vel: 0.4, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
      { n: 'echo', bars: 4, lv: 0.46, prog: 'I I IV V', pad: { p: 'swell', n: 3, reg: [52, 74], vel: 0.5 }, bass: { pat: '1---', pedal: true }, lead: { ph: 'PA', inst: 'tptSolo', vel: 0.5, shape: 0.35 } },   // the second leitmotif: a solo trumpet's glance
    ],
  });

  Track('galaxy20', {
    desc: 'The late years, the frontier: a slow march — field drums at a whisper, the tuba on the step, the trombones with a dotted march theme of their own, the men chanting beneath, tubular bells; the strings tremble in the trio while the horn plays the hymn, a side-drum roll leads to the crest where the trombones intone the hymn at half speed, the drums fall silent for the phrygian step of the abyss; the border, held',
    tags: { solitude: 0.2, contact: 0.3, tension: 0.8, war: 0.8, grief: 0.3, grandeur: 0.7, energy: 0.4, dark: 0.7 },
    quotes: ['abyss'],
    bpm: 44, trim: 6.44, tone: { hi: -2.5, lo: 0.6 }, root: 'F#', mode: 'minor', oct: -1, loopFrom: 'M1', tens: false, gentle: true, rubato: 0.015, eraWin: [0.4, 1], mix: { bass: 0.9, choir: 1.1, drums: 0.9 }, fx: { dly: 0.9, verb: 1.2 }, sends: { drums: { stage: 0.08, verb: 0.05, dly: 0 } },
    forms: [['M1', 'M2', 'trio', 'M3', 'still', 'M4', 'E'], ['M1', 'trio', 'M2', 'still', 'M3', 'E'], ['M1', 'M2', 'still', 'trio', 'M4', 'E']],
    alts: [{}, { lead: 'horn', lead2: 'trombones' }, { lead: 'cello', pad: 'strings', bass: 'deep' }],
    inst: { pad: 'cellos', pad2: 'tremLo', bass: 'tuba', lead: 'trombones', lead2: 'horn', bell: 'chime', bell2: 'chime', arp: 'harp', choir: 'choirMen', choir2: 'aah' },
    ph: {
      MT: '1:3 1:1 | 3:2 1:2 | 7:3 7:1 | 6:2 3:2 | 1:3 1:1 | 3:2 5:2 | 4:3 3:1 | 5:4',                             // the march: the dotted step, a rise to the fifth
      HA: '5:6 8:2 | 7:4 6:4 | 5:6 3:2 | 4:4 5:4', H1: '@hymn.H1', TA: '3:4 | 4:4 | 5:4 | 1:4',   // the hymn at half speed (the climax), at its own pace (the trio), the answer
      Z: '3:4 | 2b:4 | 1:8', CH: '8:8 | r:8 | 5:8 | r:8', CMF: '1:8 | 7:8 | 5:4 3:4 | 4:4 5:4',
    },
    sec: [
      { n: 'drums', bars: 4, cres: [0.42, 0.56], prog: 'i:4', bass: { pat: 'c---', pedal: true, inst: { p: 'tuba', att: 0.6, rel: 1.8 } }, drums: { bd: 'x.......x.......', sn: ['....x.......x...', '....x.......x.x.'], vel: 0.32 }, choir: { n: 3, reg: [43, 60], vel: 0.36, soft: true } },
      { n: 'M1', bars: 8, lv: 0.62, prog: 'i:2 bVII bVI i:2 iv V', pad: { p: 'sus', n: 3, reg: [45, 69], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['....x.......x...', '....x.......x.x.'], vel: 0.34 },
        lead: { ph: 'MT', vel: 0.52 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true } },
      { n: 'M2', bars: 8, lv: 0.68, prog: 'i:2 bVII bVI i:2 iv V', pad: { p: 'sus', n: 3, reg: [45, 69], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.36 },
        lead: { ph: 'MT', vel: 0.54 }, lead2: { ph: 'CMF', inst: 'choirMen', oct: -1, vel: 0.44 }, choir: { n: 3, reg: [43, 60], vel: 0.45, soft: true }, bell2: { ph: ['r4 CH', 'r8'], oct: 0, vel: 0.36, skip: 0.3 } },
      { n: 'trio', bars: 8, lv: 0.56, prog: 'i bVII i iv:.5 V:.5 | bVI iv V i', pad2: { p: 'swell', n: 3, reg: [45, 66], vel: 0.5 }, pad: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.55 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [52, 76] },
        lead2: { ph: ['H1 TA', 'H1 r4'], inst: 'horn', vel: 0.52 }, choir2: { n: 3, reg: [57, 74], vel: 0.36, soft: true } },
      { n: 'M3', bars: 8, cres: [0.7, 0.84], prog: 'i bVII i iv:.5 V:.5 | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.65 }, pad2: { p: 'swell', n: 3, reg: [45, 66], vel: 0.45 }, bass: { pat: ['1---', '1---', '1---', '1-1-', '1---', '1---', '1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.4 }, fill: 'rollS',
        lead2: { ph: 'H1 TA', inst: 'horn', vel: 0.58, harm: -2 }, lead: { ph: ['r4 TA', 'r8'], vel: 0.52 }, choir: { n: 3, reg: [43, 60], vel: 0.62 }, choir2: { n: 3, reg: [57, 74], vel: 0.42, skip: 0.4 }, timp: { p: 'two', vel: 0.42 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i bII i:2 | i bII i:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: 'c---', pedal: true, inst: { p: 'tuba', att: 1.2, rel: 2.4 } },
        lead: { ph: ['Z Z', 'r4 Z'], inst: 'cello', vel: 0.5 }, bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.4, echo: 0.3 }, choir: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
      { n: 'M4', bars: 8, cres: [0.76, 0.9], prog: 'i:2 bVII bVI i:2 iv V', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.65 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.42 }, fill: 'rollS',
        lead: { ph: 'HA', vel: 0.58, harm: -2 }, lead2: { ph: 'CMF', inst: 'choirMen', oct: -1, vel: 0.48 }, choir: { n: 3, reg: [43, 60], vel: 0.65 }, choir2: { n: 3, reg: [57, 74], vel: 0.45 }, timp: { p: 'two', vel: 0.45 } },
      { n: 'E', bars: 8, cres: [0.58, 0.4], prog: 'i:2 bVII bVI i:2 iv i', pad: { p: 'sus', n: 3, reg: [45, 69], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.6, rel: 1.8 } }, drums: { bd: 'x.......x.......', sn: ['....x.......x...', '....x.......x...', '....x.......x...', '....x...........', '....x...........', '................', '....x...........', '................'], vel: 0.3 },
        lead: { ph: ['MT', 'r8'], vel: 0.48 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, bell2: { ph: ['r4 CH', 'r6 CH'], oct: 0, vel: 0.36, skip: 0.4 } },
    ],
  });

  Track('galaxy21', {
    desc: 'The late years, the embers: a sarabande — the low strings place the dance’s stressed second beat in every bar, the harp answers on the third, a cor anglais carries a sarabande melody with the long second beat, and in the middle turns the leitmotif upside down (the fourth falls, the steps climb back) over the lament’s descending bass from the passacaglia; the cellos tremble and a timpani roll leads to the crest, the women above it; what the wars cost',
    tags: { solitude: 0.3, contact: 0.2, tension: 0.5, war: 0.4, grief: 1, grandeur: 0.3, energy: 0.3, dark: 0.8 },
    quotes: ['procession', 'hymn'],
    bpm: 54, meter: 3, trim: 4.84, tone: { hi: -2.5, lo: 0.5 }, root: 'C#', mode: 'minor', loopFrom: 'S1', tens: false, gentle: true, rubato: 0.02, eraWin: [0.4, 1], fx: { dly: 1.2, verb: 1.25 },
    forms: [['S1', 'S2', 'L', 'still', 'breath', 'echo', 'S3', 'L2', 'E'], ['S1', 'L', 'still', 'breath', 'echo', 'S2', 'L2', 'E'], ['S1', 'S2', 'still', 'breath', 'echo', 'L', 'S3', 'E']],
    alts: [{}, { lead: 'altoFlute', lead2: 'horn' }, { lead: 'cello', pad2: 'cellos', arp: 'pizz' }],
    inst: { pad: 'cellos', pad2: 'strings', bass: 'deep', lead: 'reed', lead2: 'cello', bell: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      PAm3: '1:2 2:1 | 3:1 5:2 | 6:2 5:1 | 3:2 2:1!',                         // the second leitmotif (the commonwealth's oboe) in the minor, in three
      SB1: '5:1 6:1.5 5:.5 | 3:1 4:1.5 3:.5 | 5:1 8:1.5 7:.5 | 6:1 5:1 3:1', SB2: '5:1 8:1.5 7:.5 | 6:1 8:1.5 6:.5 | 4:1 5:1.5 4:.5 | 7#:3',   // the sarabande: the long second beat
      HI: '5:2 2:1 | 3:2 4:1 | 5:2 7:1 | 6:2 5:1', HI2: '5:2 2:1 | 3:2 4:1 | 3:2 2:1 | 7#:3',                                      // the leitmotif inverted: the fourth falls, the steps climb
      E1: '3:2 4:1 | 5:3 | 3:2 2:1 | 2:3', E2: '5:2 6:1 | 5:2 3:1 | 1:2 7:1 | 1:3', LB: '1:3 | 7:3 | 6:3 | 5:3',
    },
    sec: [
      { n: 'step', bars: 4, cres: [0.45, 0.56], prog: 'i:2 bVI:2', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.7, gate: 1.0 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.36, reg: [55, 79] } },
      { n: 'S1', bars: 8, lv: 0.62, prog: 'i bVI bIII iv | i bVI iv V', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.7, gate: 1.0 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.38, reg: [55, 79] },
        lead: { ph: ['SB1 SB2', 'SB1 r4', 'r4 SB2'], vel: 0.56 } },
      { n: 'S2', bars: 8, lv: 0.68, prog: 'i bVI bIII iv | i bVI iv V', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.72, gate: 1.0 }, pad2: { p: 'sus', n: 2, reg: [62, 79], vel: 0.4 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.4, reg: [55, 79] },
        lead: { ph: ['SB1 SB2', 'HI HI2', 'SB1 HI2'], vel: 0.58 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true, skip: 0.4 } },
      { n: 'L', bars: 8, lv: 0.66, prog: 'i bVII bVI V | i bVII bVI i', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.7, gate: 1.0 }, pad2: { p: 'sus', n: 3, reg: [55, 76], vel: 0.45 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.38, reg: [55, 79] },
        lead: { ph: ['E1 E2', 'E1 r4', 'r4 E2'], vel: 0.58 }, lead2: { ph: 'LB LB', oct: -1, vel: 0.52 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true, skip: 0.3 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i bVII bVI V | i bVII bVI i', pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 66], vel: 0.48 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1--', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.55 } },
        lead2: { ph: 'LB LB', oct: -1, vel: 0.48 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, timp: { kick: '................', roll: 2, vel: 0.42 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad2: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'S3', bars: 8, cres: [0.68, 0.78], prog: 'i bVI bIII iv | i bVI iv V', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.74, gate: 1.0 }, pad2: { p: 'sus', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.4, reg: [55, 79] },
        lead: { ph: ['SB1 SB2', 'HI SB2'], vel: 0.6, harm: -2 }, lead2: { ph: '@', inst: 'cello', oct: -1, vel: 0.44, skip: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.44, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true } },
      { n: 'L2', bars: 8, cres: [0.74, 0.86], prog: 'i bVII bVI V | i bVII bVI i', pad: { p: 'stab', pat: 'x.x...', n: 4, reg: [45, 66], vel: 0.76, gate: 1.0 }, pad2: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 66], vel: 0.55 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.6 } }, arp: { pat: '....02', res: 2, vel: 0.4, reg: [55, 79] },
        lead: { ph: 'E1 E2', vel: 0.62, harm: -2 }, lead2: { ph: 'LB LB', oct: -1, vel: 0.54 }, choir: { n: 3, reg: [62, 79], vel: 0.52 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, timp: { kick: 'X..', vel: 0.4 } },
      { n: 'E', bars: 8, cres: [0.56, 0.4], prog: 'i bVI bIII iv | i bVII bVI i', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.6, gate: 1.0 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.4, rel: 1.8, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.34, reg: [55, 79] },
        lead: { ph: ['SB1 E2', 'r4 E2'], vel: 0.52 } },
      { n: 'echo', bars: 4, lv: 0.44, prog: 'i i iv V', pad: { p: 'swell', n: 3, reg: [50, 72], vel: 0.5 }, bass: { pat: '1--', pedal: true }, lead: { ph: 'PAm3', inst: 'cello', vel: 0.56, shape: 0.35 } },   // the second leitmotif: the cello's glance, in three
    ],
  });

  Track('galaxy22', {
    desc: 'The late years, the vigil: a sung chorale — the men alone at first on the chorale of the tenth piece, then the women above them in octaves, the organ beneath as a pedal, tubular bells; the organ takes a verse of its own, the women rise to a descant over the men’s second strain, the brass comes in only at the crest with timpani; the council’s hymn as the last verse; the long night watch of an old empire',
    tags: { solitude: 0.3, contact: 0.3, tension: 0.5, war: 0.4, grief: 0.6, grandeur: 0.8, energy: 0.3, dark: 0.7 },
    bpm: 48, trim: 4.27, tone: { hi: -2.0, lo: 0.6 }, root: 'F', mode: 'minor', loopFrom: 'men', tens: false, gentle: true, rubato: 0.02, eraWin: [0.4, 1], mix: { choir: 1.2, lead: 1.1, pad: 1.0 }, fx: { dly: 0.9, verb: 1.4 },
    forms: [['men', 'satb', 'organ', 'satb2', 'still', 'crest', 'amen'], ['men', 'satb', 'still', 'organ', 'crest', 'amen'], ['men', 'organ', 'satb', 'still', 'satb2', 'amen']],
    alts: [{}, { lead: 'aah', lead2: 'choirMenAh' }, { pad: 'strings', pad2: 'cellos' }],
    inst: { pad: 'cellos', pad2: 'trombones', bass: 'deep', lead: 'choirWomen', lead2: 'choirMen', bell: 'chime', bell2: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      HY1: '@chorale.HY1', HY2: '@chorale.HY2',
      HY3: '@chorale.HY3', HY4: '@chorale.HY4',
      DS1: '5:2 8:2 | 7:2 5:2 | 8:3 6:1 | 6:4', DS2: '7:2 5:2 | 6:2 4:2 | 5:3 4:1 | 5:4',                           // the women's descant over the chorale's second strain
      OV: '1:2 3:2 | 4:2 5:2 | 6:3 5:1 | 4:4', OV2: '5:2 7:2 | 6:2 4:2 | 5:2 2:2 | 8:4',                              // the organ's own verse
      HY: '@procession.HY', CM2: '@men.CM2', CH: '8:8 | r:8 | 5:8 | r:8',
    },
    sec: [
      { n: 'pedal', bars: 4, cres: [0.42, 0.54], prog: 'i:2 bVI:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 1.0, rel: 2.2 } }, bell2: { ph: ['r2 CH', 'CH r2'], oct: 0, vel: 0.38, echo: 0.3 } },
      { n: 'men', bars: 8, lv: 0.6, prog: 'i iv i bVI | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead2: { ph: ['HY1 HY2', 'HY1 r4'], oct: -1, vel: 0.6 }, choir2: { n: 3, reg: [43, 60], vel: 0.45, soft: true } },
      { n: 'satb', bars: 8, lv: 0.68, prog: 'i iv i bVI | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead: { ph: 'HY1 HY2', vel: 0.55 }, lead2: { ph: 'HY1 HY2', oct: -1, vel: 0.6 }, choir: { n: 3, reg: [60, 77], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.55 } },
      { n: 'organ', bars: 8, lv: 0.6, prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', inst: 'organ', n: 4, reg: [45, 72], vel: 0.8 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.4, rel: 1.6 } },
        lead: { ph: ['OV OV2', 'OV r4'], inst: 'organ', vel: 0.6 }, bell2: { ph: ['r4 CH', 'r8'], oct: 0, vel: 0.36, skip: 0.4 } },
      { n: 'satb2', bars: 8, cres: [0.7, 0.8], prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.6 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 67], vel: 0.5 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.4, rel: 1.6 } },
        lead: { ph: 'DS1 DS2', vel: 0.58 }, lead2: { ph: 'HY3 HY4', oct: -1, vel: 0.62 }, choir: { n: 3, reg: [60, 77], vel: 0.55 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84], skip: 0.3 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i:2 bVI:2 | bVII:2 i:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 1.2, rel: 2.4 } },
        lead2: { ph: 'CM2', oct: -1, vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.32, soft: true }, bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.38, echo: 0.3 } },
      { n: 'crest', bars: 8, cres: [0.82, 0.96], prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', inst: 'organ', n: 4, reg: [45, 72], vel: 0.75 }, pad2: { p: 'sus', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.3, rel: 1.4 } },
        lead: { ph: 'DS1 DS2', vel: 0.62 }, lead2: { ph: 'HY3 HY4', oct: -1, vel: 0.66 }, bell2: { ph: 'HY3 HY4', inst: 'horn', vel: 0.5, harm: -2 }, choir: { n: 3, reg: [60, 77], vel: 0.7 }, choir2: { n: 3, reg: [43, 60], vel: 0.75 }, timp: { p: 'two', vel: 0.45 }, drums: { bdSoft: 'x...............', vel: 0.3 } },
      { n: 'amen', bars: 8, cres: [0.62, 0.44], prog: 'i bVI i iv | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead: { ph: ['HY HY2', 'HY r4'], vel: 0.52 }, lead2: { ph: ['HY HY2', 'HY r4'], oct: -1, vel: 0.56 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
    ],
  });


})(window.MOO);
