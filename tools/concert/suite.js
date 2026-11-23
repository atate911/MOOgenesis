// Master of Orion — Reborn · Concert Suite
// Three movements re-composed from the game's score as concert music: through-composed (no loops, no shuffled forms), each with its own
// long arc, real modulations, counter-melodies and an ending. Written in the notation of js/audio/music.js and rendered through the game's
// own engine and orchestra by tools/concert/render.js. A cyclic suite: the score's two leitmotifs (the hymn, a rising fourth and a falling
// step; and the commonwealth's climb, 1 2 3 5) run through all three, and the finale gathers them.
//
//   I.   First Light — Prelude              (from The early years, first light)        D-flat major
//   II.  The Long Night — Passacaglia        (from The long night)                      B minor, with a variation in B major
//   III. Commonwealth — Finale               (from The procession and the main theme)   B minor to D major
//
// Loaded only by the render tool: nothing here is part of the game.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;
  const E16 = '................';
  // a drum part that strikes only in the bars named: at(8, {0: 'x...............'}) is a crash on the first of eight bars
  const at = (bars, hits) => Array.from({ length: bars }, (_, i) => hits[i] || E16);

  // the stage every movement stands on: the orchestral profile in the recorded hall, the bass free to move with the harmony
  const STAGE = { orch: true, holdLow: false, tens: false, hidden: true, rubato: 0, hall: 'musikverein', fx: { verb: 1.2, stage: 0.8, dly: 0.25 },
    tone: { lo: 1.5, hi: 1.5, pres: 1.5 }, sends: { lead: { verb: 0.16, stage: 0.32, dly: 0.04 }, choir: { verb: 0.34, stage: 0.14 } }, lowBand: 2.5, bassC: 40 };

  // =====================================================================================================================================
  // I. FIRST LIGHT — Prelude
  // The game's sunrise, given the time a concert piece has. The dark (the violas and the basses on a pedal, a glimmer of celeste); the
  // alto flute's dawn theme, a slow climb up the chord; the theme again in the solo violin with a clarinet beneath; a cloud passes (the
  // relative minor, the cellos singing, the strings trembling); the climb taken up in sequence by the horns, an accelerando into the
  // sunrise; the hymn — the game's leitmotif — in horns and voices; its second half higher, the trumpets on the tune and the choir singing
  // it; the day, pastoral, the oboe; and dusk, the flute alone, the commonwealth's climb in a far horn, the last light.
  // =====================================================================================================================================
  Track('concert:1', Object.assign({}, STAGE, {
    desc: 'Concert suite I: First Light — prelude',
    bpm: 54, root: 'Db', mode: 'major', trim: 1.5, subBass: 0.35,
    mix: { lead: 1.45, pad: 1.0, bass: 1.5, choir: 1.25, arp: 0.85, bell: 0.9 },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'altoFluteIowa', lead2: 'clarinet', arp: { p: 'harp', rel: 3.5, hold: 2.2, cut: 4600 }, bell: 'glass', choir: 'choirOoh', choir2: 'choirMen' },
    quotes: ['hymn', 'procession', 'wonder'],
    ph: {
      DH: '1:4 | 3:2 5:2',                                                        // the dawn theme's head
      D1: '1:4 | 3:2 5:2 | 6:4 | 5:2 3:2', D2: '1:4 | 3:2 5:2 | 9:2 10:2 | 7:2 5:2', // the dawn theme: a climb up the chord, and back
      D5: '6:3 5:1 | 4:3 6:1 | 5:3 2:1 | 1:4',                                       // its close, home
      CV1: '5:4 | 7:4 | 8:4 | 6:2 8:2', CV2: '10:4 | 9:4 | 9:4 | 7:4',               // the counter-line beneath the violin (the clarinet)
      CL1: '5:3 6:1 | 5:2 3:2 | 4:3 3:1 | 2:4', CL2: '5:3 6:1 | 8:2 7:2 | 6:3 5:1 | 5:4',   // the cloud: the cellos in the relative minor
      CL3: '1:4 | 1:2 3:2 | 1:4 | 7#:4', CL4: '3:4 | 1:4 | 1:2 2:2 | 2:4',          // the clarinet's sigh against the cellos
      RS1: '3:2 5:2 | 6:4 | 4:2 6:2 | 7:4', RS2: '5:2 8:2 | 10:4 | 8:2 6:2 | 9:4',   // the climb in sequence: 3 5 6, 4 6 7, 5 8 10
      H1: '@hymn.H1', H2: '@hymn.H2', H3: '@hymn.H3', H4: '@hymn.H4',
      DS1: '10:4 | 12:4 | 13:4 | 12:4', DS2: '13:4 | 12:4 | 12:4 | 15:4',             // the descant over the hymn's second half
      DE: '1:4 | 3:2 2:2 | 3:8',                                                    // the flute's last phrase, left on the third
      PAh: '1:3 2:1 | 3:2 5:2 | r:8',                                                // the commonwealth's climb (the second leitmotif's head)
    },
    sec: [
      // the dark: the pedal and the violas, a glimmer, the flute's first notes
      { n: 'night', bars: 6, cres: [0.24, 0.36], prog: 'IM7:2 IVM7/I:2 IM7:2',
        pad: { p: 'swell', n: 3, reg: [50, 65], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [37, 50], vel: 0.55, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'cbSolo', att: 3, rel: 3 } }, choir2: { inst: 'choirHum', n: 2, reg: [60, 72], vel: 0.32, soft: true, att: 4 },
        bell: { dens: 0.06, res: 1, reg: [80, 96], vel: 0.3 }, lead: { ph: 'r4 DH', vel: 0.5, pan: -0.1 } },
      // the grey: the dawn theme whole
      { n: 'grey', bars: 8, cres: [0.36, 0.48], prog: 'IM7:2 IVM7:2 | IM7:2 V:2',
        pad: { p: 'sus', n: 3, reg: [50, 67], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [37, 50], vel: 0.55, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'deep', att: 1.6, rel: 2.8 } }, arp: { pat: '0.......2.......', res: 2, gate: 2.4, vel: 0.2, reg: [55, 79] },
        bell: { dens: 0.06, res: 1, reg: [80, 96], vel: 0.3 }, lead: { ph: 'D1 D2', vel: 0.55, pan: -0.1 } },
      // the glow: the theme in the solo violin an octave up, the clarinet's counter-line beneath, the strings and the harp rolling
      { n: 'glow', bars: 8, cres: [0.48, 0.62], prog: 'IM7:2 IVM7:2 | IM7:2 V:2',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 72], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [37, 52], vel: 0.55, open: true },
        bass: { pat: '1---', vel: 0.85, inst: { p: 'deep', att: 1.2, rel: 2.4 } }, arp: { pat: '01232101', res: 2, gate: 2.4, vel: 0.24, reg: [43, 67] },
        lead: { ph: 'D1 D2', inst: 'vlnSolo', oct: 1, vel: 0.62, pan: 0.05 }, lead2: { ph: 'CV1 CV2', oct: -1, vel: 0.5, pan: -0.25 },
        choir: { n: 2, reg: [64, 77], vel: 0.24, soft: true } },
      // the cloud: B-flat minor, the cellos singing, the strings trembling, the clarinet sighing against them
      { n: 'cloud', bars: 8, key: 'Bb', mode: 'minor', cres: [0.5, 0.64], prog: 'i i iv V | i bVI iv V',
        pad: { p: 'swell', inst: 'strTrem', n: 3, reg: [57, 74], vel: 0.42 }, pad2: { p: 'sus', inst: 'violas', n: 2, reg: [50, 62], vel: 0.5 },
        bass: { pat: '1---', vel: 0.9, inst: { p: 'deep', att: 0.8, rel: 2.2 } }, lead: { ph: 'CL1 CL2', inst: 'cello', oct: -1, vel: 0.78, pan: 0.15 },
        lead2: { ph: 'CL3 CL4', oct: 0, vel: 0.42, pan: -0.25 }, choir2: { inst: 'choirMen', n: 3, reg: [45, 58], vel: 0.32, soft: true }, timp: { p: 'hits', vel: 0.22, roll: 1 } },
      // the rise: home again, the climb in sequence in the horns, the voices entering, pressing forward into the light
      { n: 'rise', bars: 8, bpm: 54, bpmTo: 60, cres: [0.62, 0.95], prog: 'vi7 IVM7 | ii7 V | vi7 IVM7 | II7 V7sus4:.5 V:.5',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [52, 76], vel: 0.72 }, pad2: { p: 'sus', n: 2, reg: [40, 55], vel: 0.6 },
        bass: { pat: '1---', vel: 0.95, inst: { p: 'deep', att: 0.6, rel: 1.8 } }, arp: { pat: '01234321', res: 2, vel: 0.26, reg: [50, 79] },
        lead: { ph: 'RS1 RS2', inst: 'horn', oct: -1, vel: 0.8, harm: -2, hvel: 0.6 }, lead2: { ph: '@counter', inst: 'cello', reg: [48, 64], vel: 0.5 },
        choir: { n: 3, reg: [62, 76], vel: 0.42, soft: true }, choir2: { n: 3, reg: [45, 58], vel: 0.4, soft: true }, timp: { p: 'hits', vel: 0.4, roll: 2 } },
      // the sunrise: the hymn in the horns, the solo horn an octave beneath, the voices open, the harp running up
      { n: 'sunrise', bars: 8, bpm: 60, cres: [0.96, 1.06], prog: 'I | V:.5 IV:.5 | I | ii:.5 V:.5 | I | ii:.5 I/III:.5 | vi:.5 V:.5 | I',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [62, 86], vel: 0.82 }, pad2: { p: 'sus', n: 3, reg: [41, 57], vel: 0.65 },
        bass: { pat: '1---', vel: 1.1, inst: { p: 'deep', att: 0.2, rel: 1.6 }, fresh: true }, pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [37, 46], vel: 0.6 },
        lead: { ph: 'H1 H2', inst: 'horn', vel: 1.0 }, lead2: { ph: '@', inst: 'hornIowa', oct: -1, vel: 0.8 }, bell2: { ph: 'H1 H2', inst: 'trombones', oct: -1, vel: 0.55 },
        choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.95 }, choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.7 },
        arp: { p: 'up', vel: 0.3, reg: [55, 89] }, bell: { inst: 'bell', dens: 0.1, res: 2, reg: [84, 100], vel: 0.35 }, timp: { p: 'two', vel: 0.6 },
        drums: { crashS: at(8, { 0: 'x...............' }), tam: at(8, { 0: 'x...............' }) }, verb: 0.85, subBass: 0.7 },
      // the zenith: the hymn's second half higher, the trumpets on the tune, the horns beneath, the choir singing it, the violins' descant
      { n: 'zenith', bars: 8, bpm: 60, bpmTo: 54, cres: [1.04, 1.1], prog: 'I iii vi V | IV I/III V I',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [60, 84], vel: 0.85 }, pad2: { p: 'sus', n: 3, reg: [41, 57], vel: 0.7 },
        bass: { pat: '1---', vel: 1.1, inst: { p: 'deep', att: 0.3, rel: 1.8 } }, pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [37, 46], vel: 0.65 },
        lead: { ph: 'H3 H4', inst: 'tpts', vel: 0.95 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.85 }, lead3: { ph: 'H3 H4', inst: 'choirMenAhNew', oct: -1, vel: 0.85 },
        lead4: { ph: 'DS1 DS2', inst: 'strings', vel: 0.55 }, bell2: { ph: 'H3 H4', inst: 'trombones', oct: -1, vel: 0.55 },
        choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.75 }, arp: { p: 'updown', vel: 0.26, reg: [55, 89] }, timp: { p: 'beats', vel: 0.5, roll: 1 },
        drums: { crashS: at(8, { 0: 'x...............', 7: 'x...............' }) }, verb: 0.9, subBass: 0.75 },
      // the day: the oboe with the dawn theme and its close, the clarinet beneath, the harp
      { n: 'day', bars: 8, bpm: 56, lv: 0.56, prog: 'IM7 IM7 IVM7 IVM7 | IV ii7 V7sus4:.5 V:.5 I',
        pad: { p: 'sus', inst: 'strings', n: 3, reg: [52, 72], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [40, 52], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.85, inst: { p: 'deep', att: 1.0, rel: 2.4 } }, arp: { pat: '01232101', res: 2, gate: 2.4, vel: 0.22, reg: [43, 67] },
        lead: { ph: 'D1 D5', inst: 'oboe', vel: 0.62 }, lead2: { ph: '@counter', inst: 'clarinet', reg: [55, 70], vel: 0.38, pan: -0.25 },
        choir: { n: 2, reg: [64, 77], vel: 0.22, soft: true }, bell: { dens: 0.08, res: 1, reg: [80, 96], vel: 0.3 } },
      // dusk: the flute alone over the pedal, the climb in a far horn, the last light
      { n: 'dusk', bars: 8, bpm: 54, bpmTo: 44, cres: [0.46, 0.2], prog: 'IM7:2 IVM7/I:2 | Iadd9:4',
        pad: { p: 'swell', n: 3, reg: [50, 67], vel: 0.55 }, pad2: { p: 'swell', n: 2, reg: [37, 50], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.75, inst: { p: 'cbSolo', att: 2.5, rel: 4 } }, choir2: { inst: 'choirHum', n: 2, reg: [60, 72], vel: 0.3, soft: true },
        lead: { ph: 'D1 DE', vel: 0.5, pan: -0.1 }, lead2: { ph: 'r2 PAh r2', inst: 'hornIowa', oct: -1, vel: 0.42, pan: 0.3 },
        bell: { dens: 0.07, res: 1, reg: [80, 96], vel: 0.28 } },
    ],
  }));

  // =====================================================================================================================================
  // II. THE LONG NIGHT — Passacaglia
  // A ground that never stops (the lament's descent and the step back up to the dominant) and variations over it, each a texture of its
  // own and the whole a single arc: the ground alone in the cellos; the cor anglais's theme; the violins' long line with the cor anglais
  // drawing a counter beneath and the harp running; a scherzando in pizzicato for the bassoon and the oboe; then the night breaks into
  // B major — the ground in the major, a song for the solo violin, then the violins and a horn — the still centre; the minor again, the
  // hymn in the horn with the men; the strings trembling, the bells, the violins high, the brass gathering; the climax, the ground in the
  // trombones and tuba, the hymn in the horns with the trumpets above and the full choir; and the coda, the cor anglais alone again,
  // slowing, the last chord turned to the major.
  // =====================================================================================================================================
  const GROUND = 'i bVIM7 bIII V | i bVIM7 bIII V';
  const GBASS = ['1--b', '1--7', '1--2', '1---'];
  Track('concert:2', Object.assign({}, STAGE, {
    desc: 'Concert suite II: The Long Night — passacaglia',
    bpm: 50, root: 'B', mode: 'minor', trim: 1.7, subBass: 0.4,
    mix: { lead: 1.4, pad: 1.0, bass: 1.45, choir: 1.25, arp: 0.9, bell: 0.9 },
    inst: { pad: 'strings', pad2: 'cellos', bass: 'deep', lead: 'reed', lead2: 'cello', bell: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    quotes: ['hymn', 'planetarium'],
    ph: {
      GB: '1:3 7:1 | 6:3 5:1 | 3:3 4:1 | 5:4',                                                     // the ground
      P1: '3:2 4:1 5:1 | 6:3 5:1 | 5:2 3:1 1:1 | 2:4', P2: '8:3 7:1 | 6:3 5:1 | 5:3 4:1 | 2:2 7#:2',  // the cor anglais's theme and its answer
      Q1: '8:3 10:1 | 8:2 6:2 | 5:3 6:1 | 7#:4', Q2: '8:3 12:1 | 11:2 10:2 | 10:3 9:1 | 9:2 7#:2',    // the violins' long line
      PS: '3:1 4:1 5:1 r:1 | 6:1 5:1 r:2 | 5:1 3:1 1:1 r:1 | 2:1 r:3',                              // the theme, clipped, for the bassoon
      PO: 'r:2 8:1 r:1 | r:2 6:1 r:1 | r:2 8:1 5:1 | 7#:1 r:3',                                     // the oboe's answers between
      M1: '3:3 2:1 | 1:2 3:2 | 5:3 4:1 | 2:4', M2: '5:3 6:1 | 8:2 6:2 | 7:2 5:2 | 5:2 7:2',         // the song in B major
      M3: '10:3 9:1 | 8:2 10:2 | 12:3 11:1 | 9:4', M4: '10:2 8:2 | 8:2 6:2 | 5:2 3:2 | 5:4',
      MC: '5:4 | 3:4 | 3:4 | 2:4',                                                                 // the horn beneath the song
      H1: '@hymn.H1',
      FL: '7:6 r:2 | 4:6 r:2 | 5:6 r:2 | 10:8', CH: '8:8 | r:8 | 5:8 | r:8',                          // the four slow notes; two strokes of the bells
      DS: '10:4 | 10:4 | 10:4 | 9:4', DS2: '12:4 | 13:4 | 12:4 | 11:2 9:2',                          // the trumpets above the hymn
      GE: '1:4 | 4:4 | 5:4 | 1:8', CE: '5:2 3:2 | 4:2 6:2 | 2:2 7#:2 | 1:8',                          // the last ground, and the cor anglais's close
    },
    base: { bass: { pat: GBASS, inst: { p: 'deep', att: 0.9, rel: 2.2 }, vel: 0.9 } },
    sec: [
      { n: 'ground', bars: 4, cres: [0.36, 0.46], prog: 'i bVIM7 bIII V', bass: true, lead2: { ph: 'GB', oct: -1, vel: 0.66, art: 0.96 }, pad2: { p: 'swell', n: 2, reg: [40, 52], vel: 0.32, open: true } },
      { n: 'v1', bars: 8, lv: 0.5, prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.62, art: 0.96 }, pad: { p: 'sus', inst: 'violas', n: 2, reg: [52, 64], vel: 0.42 },
        lead: { ph: 'P1 P2', vel: 0.66 } },
      { n: 'v2', bars: 8, cres: [0.54, 0.66], prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.6, art: 0.96 }, pad: { p: 'sus', n: 3, reg: [52, 70], vel: 0.55 },
        lead: { ph: 'Q1 Q2', inst: 'strings', vel: 0.8 }, lead3: { ph: '@counter', inst: 'reed', reg: [55, 69], vel: 0.42 }, arp: { p: 'run', vel: 0.32, reg: [55, 86], gate: 0.8 },
        choir: { n: 2, reg: [66, 79], vel: 0.26, soft: true } },
      { n: 'v3', bars: 8, lv: 0.56, prog: GROUND, bass: { pat: GBASS, inst: 'moog', vel: 0.95 }, arp: { inst: 'pizz', pat: '0.2.1.2.', res: 2, vel: 0.46, reg: [50, 72], gate: 0.5 },
        lead: { ph: 'PS PS', inst: 'bassoon', vel: 0.66, art: 0.5 }, lead2: { ph: 'PO PO', inst: 'oboe', vel: 0.5, art: 0.5 }, bell: { ph: 'r4 GB', inst: 'glass', oct: 1, vel: 0.3 },
        drums: { click3: 'x.......x.......', vel: 0.26 } },
      { n: 'v4', bars: 8, key: 'B', mode: 'major', cres: [0.46, 0.56], prog: 'I vi7 iii V | I vi7 iii V', bass: { pat: ['1---', '1--7', '1---', '1---'], inst: { p: 'deep', att: 1.2, rel: 2.6 }, vel: 0.8 },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.55, art: 0.96 }, pad: { p: 'swell', inst: 'violas', n: 3, reg: [54, 68], vel: 0.48 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 86], vel: 0.32 },
        lead: { ph: 'M1 M2', inst: 'vlnSolo', oct: 1, vel: 0.66 }, arp: { pat: '0.......2...1...', res: 2, vel: 0.3, reg: [59, 86] }, bell: { inst: 'glass', dens: 0.08, res: 1, reg: [83, 99], vel: 0.3 } },
      { n: 'v5', bars: 8, key: 'B', mode: 'major', cres: [0.56, 0.7], prog: 'I vi7 iii V | I vi7 iii V', bass: { pat: ['1---', '1--7', '1---', '1---'], inst: { p: 'deep', att: 1.0, rel: 2.4 }, vel: 0.85 },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.58, art: 0.96 }, pad: { p: 'sus', n: 4, reg: [54, 74], vel: 0.6 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 86], vel: 0.32 },
        lead: { ph: 'M3 M4', inst: 'strings', vel: 0.78 }, lead3: { ph: 'MC MC', inst: 'hornIowa', oct: -1, vel: 0.5 }, choir: { n: 3, reg: [64, 79], vel: 0.34, soft: true },
        arp: { pat: '01232101', res: 2, vel: 0.28, reg: [55, 82] } },
      { n: 'v6', bars: 8, lv: 0.6, prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.6, art: 0.96 }, pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [47, 64], vel: 0.42 },
        lead: { ph: 'H1 H1*1.1', inst: 'hornSolo', vel: 0.72 }, lead3: { ph: 'r4 H1', inst: 'choirMenNew', oct: -1, vel: 0.5 }, choir2: { inst: 'choirMenOld', n: 3, reg: [43, 57], vel: 0.38, soft: true } },
      { n: 'v7', bars: 8, cres: [0.64, 0.96], prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.66, art: 0.96 }, bell2: { ph: 'r4 GB', inst: 'trombones', oct: -1, vel: 0.5 },
        pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [47, 64], vel: 0.5 }, pad2: { p: 'swell', inst: 'strTrem', n: 3, reg: [66, 84], vel: 0.42 },
        lead: { ph: 'Q1 Q2', inst: 'strings', oct: 1, vel: 0.82 }, lead3: { ph: 'FL', inst: 'flute', vel: 0.4 }, bell: { ph: 'CH CH', inst: 'chime', vel: 0.4 },
        choir2: { inst: 'choirMenOld', n: 3, reg: [43, 57], vel: 0.42 }, timp: { p: 'two', vel: 0.4, roll: 2 } },
      { n: 'v8', bars: 8, cres: [1.02, 1.12], prog: 'i bVIM7 bIII V | i bVIM7 bIII V7', bass: { pat: GBASS, inst: { p: 'deep', att: 0.3, rel: 1.8 }, vel: 1.05, fresh: true },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.7, art: 0.96 }, bell2: { ph: 'GB GB', inst: 'trombones', oct: -1, vel: 0.66 }, pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [35, 46], vel: 0.62 },
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.82 }, lead: { ph: 'H1 H1', inst: 'horn', vel: 1.0, harm: -2, hvel: 0.6 }, lead4: { ph: 'DS DS2', inst: 'tpts', vel: 0.6 },
        lead3: { ph: 'H1 H1', inst: 'choirMenAhNew', oct: -1, vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.7 }, timp: { p: 'beats', vel: 0.6 },
        drums: { crashS: at(8, { 0: 'x...............' }), tam: at(8, { 0: 'x...............' }) }, verb: 0.9, subBass: 0.8 },
      { n: 'coda', bars: 8, bpm: 50, bpmTo: 38, cres: [0.42, 0.2], prog: 'i bVIM7 bIII V | i iv V I', bass: { pat: ['1--b', '1--7', '1--2', '1---', '1---', '1---', '1---', '1---'], inst: { p: 'deep', att: 1.2, rel: 3 }, vel: 0.8 },
        lead2: { ph: 'GB GE', oct: -1, vel: 0.58, art: 0.96 }, pad: { p: 'swell', inst: 'violas', n: 3, reg: [52, 66], vel: 0.45 },
        lead: { ph: 'P1 CE', vel: 0.6 }, choir: { n: 3, reg: [62, 74], vel: 0.26, soft: true } },
    ],
  }));

  // =====================================================================================================================================
  // III. COMMONWEALTH — Finale
  // Out of the night: the hymn's call in a far horn over the low strings in B minor, which turns out to be the sixth of D major; the call
  // again in the trumpet, the timpani rolling. The procession (the commonwealth's theme, the score's second leitmotif) in the solo horn on
  // the step of the low brass and the field drums; the violins take it up; the big phrase with its flat-sixth lift. A trio in G for the
  // clarinet and then the strings. The call worked through in sequence — B-flat, C, D — gathering. The apotheosis: the hymn whole, broad,
  // in the trumpets and the horns and the choir, over the strings' ostinato; the procession's answer in full; and an amen, the major
  // subdominant turned minor before the last chord.
  // =====================================================================================================================================
  Track('concert:3', Object.assign({}, STAGE, {
    desc: 'Concert suite III: Commonwealth — finale',
    bpm: 84, root: 'D', mode: 'major', trim: 1.45, subBass: 0.4,
    mix: { lead: 1.35, pad: 1.0, bass: 1.4, choir: 1.25, drums: 0.95, arp: 0.85, bell: 0.9 },
    inst: { pad: 'strings', pad2: 'lowBrass', bass: 'lowBrass', lead: 'hornSolo', lead2: 'horn', arp: 'harp', bell: 'bell', choir: 'choirOoh', choir2: 'choirMen' },
    quotes: ['hymn', 'procession'],
    ph: {
      K: '@hymn.K', KH: '5:3 8:1 | 7:2 6:2',                                         // the call, and its head
      A1: '@procession.A1', A2: '@procession.A2', CD: '@procession.CD',
      B1: '5:2 6:1 8:1 | 10:3 9:1 | 8:2 6:2 | 5:4', B2: '8:2 11:1 8:1 | 9:3 11:1 | 10:2 9:1 8:1 | 8:4',   // the big phrase, and its lift
      CDb: '4:2 3:1! 2:1 | 5:3 4:1 | 3:2 2:2 | 1:4',                                  // the cadence, its passing third kept
      CT: '1:2 3:2 | 5:2 3:2 | 4:2 6:2 | 5:4', CT2: '4:2 6:2 | 4:2 6:2 | 5:2 7:2 | 8:4',                                        // the low brass beneath
      T1: '3:3 4:1 | 5:2 8:2 | 7:3 6:1 | 5:4', T2: '6:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4',   // the trio
      H1: '@hymn.H1', H2: '@hymn.H2', H3: '@hymn.H3', H4: '@hymn.H4',
      DS1: '10:4 | 12:4 | 13:4 | 12:4', DS2: '13:4 | 12:4 | 12:4 | 15:4',
      CDx: '4:2 2:2 | 5:3 4:1 | 3:2 2:2 | 1:4',                                        // the close
      AM: '6:4 | 6b:4', AMt: '8:4 | 8:4', FIN: '5:16', FINt: '8:16',                                 // the amen: the sixth, the flat sixth, home; the trumpets on the tonic
    },
    sec: [
      // the call out of the night (B minor)
      { n: 'call', bars: 4, key: 'B', mode: 'minor', bpm: 58, cres: [0.3, 0.4], prog: 'i bVI | i bVI',
        pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 62], vel: 0.45 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [38, 50], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'deep', att: 2, rel: 3 } }, lead: { ph: 'K', inst: 'hornIowa', oct: -1, vel: 0.62, pan: 0.25 }, choir2: { inst: 'choirMenOld', n: 3, reg: [43, 57], vel: 0.32, soft: true } },
      // the same chord heard as the sixth of D: the call in the trumpet, the timpani rolling into the march
      { n: 'call2', bars: 4, bpm: 58, bpmTo: 66, cres: [0.42, 0.72], prog: 'vi | V:.5 IV:.5 | ii7 | V7sus4:.5 V:.5',
        pad: { p: 'swell', n: 4, reg: [50, 74], vel: 0.6 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [38, 52], vel: 0.55, open: true },
        bass: { pat: '1---', vel: 0.85, inst: { p: 'deep', att: 1, rel: 2 } }, lead: { ph: 'K', inst: 'tptSolo', vel: 0.6, pan: -0.15 },
        choir2: { n: 3, reg: [45, 58], vel: 0.4, soft: true }, timp: { p: 'hits', vel: 0.5, roll: 2 },
        drums: { sn: at(4, { 3: '........o.o.o.xx' }) } },
      // the procession: the solo horn on the step of the low brass
      { n: 'march1', bars: 16, lv: 0.72, prog: 'I I IV V | I vi ii V | I I/III IV V | IVM7 IV V I',
        pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.66 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [43, 58], vel: 0.62, gate: 0.7 },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.95 }, lead: { ph: 'A1 A2 A1 CD', oct: -1, vel: 0.86 },
        drums: { p: 'field', vel: 0.72 }, bell: { dens: 0.05, res: 1, reg: [79, 96], vel: 0.34 } },
      // the violins take the theme, the woodwinds an octave above, the low brass's counter, the choir
      { n: 'march2', bars: 8, lv: 0.84, prog: 'I I IV V | IVM7 IV V I',
        pad: { p: 'sus', inst: 'violas', n: 3, reg: [50, 69], vel: 0.6 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [43, 58], vel: 0.72, gate: 0.7 },
        bass: { p: 'walk', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.95 }, lead: { ph: 'A2 CD', inst: 'strings', vel: 0.92 }, bell: { ph: 'A2 CD', inst: 'flute', oct: 1, vel: 0.45 },
        lead2: { ph: 'CT CT2', inst: 'trombones', oct: -1, vel: 0.5 }, drums: { p: 'field', vel: 0.85 }, timp: 'two', choir: { n: 3, reg: [60, 76], vel: 0.5 }, choir2: { n: 3, reg: [43, 58], vel: 0.45 } },
      // the big phrase and its flat-sixth lift
      { n: 'big', bars: 16, cres: [0.9, 1.02], prog: 'IV V | vi iii | bVI bVII | I I | IV V | vi iii | IV V | I/III:.5 V:.5 I',
        pad: { p: 'sus', n: 4, reg: [52, 79], vel: 0.82 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [43, 60], vel: 0.82, gate: 0.65 },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 }, lead: { ph: 'B1 B2 B1 CDb', inst: 'horn', oct: -1, vel: 0.98 }, lead2: { ph: '@', inst: 'strings', vel: 0.6 },
        lead4: { ph: 'B1 B2 B1 CDb', inst: 'tpts', vel: 0.42 }, drums: { p: 'field', vel: 0.95, crashS: at(16, { 0: 'x...............', 8: 'x...............' }) }, timp: 'beats',
        choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [79, 96], vel: 0.4 }, fill: 'bigS' },
      // a breath: the march draws back toward the trio
      { n: 'turn', bars: 2, bpm: 84, bpmTo: 70, cres: [0.7, 0.45], prog: 'IV:1 V7:1', breath: true,
        pad: { p: 'swell', n: 4, reg: [52, 74], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.4, rel: 2 }, vel: 0.8 }, lead: { ph: 'KH', inst: 'clarinet', vel: 0.5 } },
      // the trio in G: the clarinet, then the strings
      { n: 'trio1', bars: 8, key: 'G', bpm: 74, lv: 0.52, prog: 'vi IV | iii V | vi IV:.5 iii:.5 | V I',
        pad: { p: 'sus', n: 4, reg: [50, 72], vel: 0.55 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [40, 55], vel: 0.5 }, bass: { p: 'whole', inst: { p: 'deep', att: 0.4 }, vel: 0.75 },
        lead: { ph: 'T1 T2', inst: 'clarinet', vel: 0.7 }, arp: { p: 'up8', vel: 0.26, reg: [55, 81] }, bell: { inst: 'glass', dens: 0.06, res: 1, reg: [79, 96], vel: 0.3 } },
      { n: 'trio2', bars: 8, key: 'G', bpm: 74, cres: [0.56, 0.68], prog: 'vi IV | iii V | IVM7 V | I I',
        pad: { p: 'sus', inst: 'violas', n: 3, reg: [50, 67], vel: 0.55 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [40, 55], vel: 0.5 }, bass: { p: 'whole', inst: { p: 'deep', att: 0.4 }, vel: 0.8 },
        lead: { ph: 'T1 T2', inst: 'strings', oct: 1, vel: 0.78 }, lead2: { ph: '@', inst: 'cello', vel: 0.55 }, lead3: { ph: '@counter', inst: 'hornIowa', reg: [50, 64], vel: 0.42 },
        arp: { p: 'up8', vel: 0.24, reg: [55, 81] }, choir: { n: 3, reg: [62, 76], vel: 0.28, soft: true } },
      // the call worked through: B-flat, C, and the dominant of D, gathering
      { n: 'dev1', bars: 4, key: 'Bb', bpm: 80, cres: [0.6, 0.72], prog: 'I V:.5 IV:.5 | ii V',
        pad: { p: 'sus', inst: 'strTrem', n: 4, reg: [52, 76], vel: 0.6 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.9 },
        lead: { ph: 'K', inst: 'trombones', oct: -1, vel: 0.85 }, lead2: { ph: 'r2 KH', inst: 'horn', oct: -1, vel: 0.6 }, timp: { p: 'two', vel: 0.5 }, drums: { sn: 'o.o.o.o.o.o.o.o.', vel: 0.4 } },
      { n: 'dev2', bars: 4, key: 'C', bpm: 82, cres: [0.74, 0.86], prog: 'I V:.5 IV:.5 | ii V',
        pad: { p: 'sus', inst: 'strTrem', n: 4, reg: [52, 79], vel: 0.68 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.95 },
        lead: { ph: 'K', inst: 'horn', vel: 0.9 }, lead2: { ph: 'r2 KH', inst: 'tpts', vel: 0.6 }, choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.6 }, timp: { p: 'two', vel: 0.6 }, drums: { sn: 'o.o.o.o.o.o.o.o.', vel: 0.5 } },
      { n: 'dev3', bars: 4, bpm: 84, bpmTo: 62, cres: [0.88, 1.02], prog: 'V7sus4 V | V7sus4 V',
        pad: { p: 'sus', inst: 'strTrem', n: 4, reg: [55, 81], vel: 0.75 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.1 }, vel: 1.0 }, pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [33, 45], vel: 0.6 },
        lead: { ph: 'KH KH', inst: 'tpts', vel: 0.9 }, lead2: { ph: 'KH KH', inst: 'horn', oct: -1, vel: 0.75 }, choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.6 },
        timp: { p: 'hits', vel: 0.7, roll: 2 }, drums: { snRoll: at(4, { 2: 'x...............', 3: 'x.......x.......' }), vel: 0.6 } },
      // the apotheosis: the hymn whole, broad
      { n: 'hymn1', bars: 8, bpm: 60, cres: [1.0, 1.06], prog: 'I | V:.5 IV:.5 | I | ii:.5 V:.5 | I | ii:.5 I/III:.5 | vi:.5 V:.5 | I',
        pad: { p: 'sus', n: 4, reg: [62, 86], vel: 0.85 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.2, rel: 1.6 }, vel: 1.1, fresh: true },
        pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [33, 45], vel: 0.65 }, arp: { inst: 'strOst', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.32, reg: [50, 62] },
        lead: { ph: 'H1 H2', inst: 'horn', vel: 1.05 }, lead2: { ph: '@', inst: 'hornIowa', oct: -1, vel: 0.85 }, lead3: { ph: 'H1 H2', inst: 'choirMenAhNew', oct: -1, vel: 0.85 },
        choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.75 }, timp: { p: 'two', vel: 0.65 },
        drums: { crashS: at(8, { 0: 'x...............' }), tam: at(8, { 0: 'x...............' }), bd: at(8, { 0: 'X...............', 4: 'x...............' }) }, verb: 0.85, subBass: 0.8 },
      { n: 'hymn2', bars: 8, bpm: 60, cres: [1.06, 1.12], prog: 'I iii vi V | IV I/III V I',
        pad: { p: 'sus', n: 4, reg: [60, 86], vel: 0.88 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3, rel: 1.8 }, vel: 1.1 },
        pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [33, 45], vel: 0.68 }, arp: { inst: 'strOst', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.34, reg: [50, 62] },
        lead: { ph: 'H3 H4', inst: 'tpts', vel: 1.0 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.9 }, lead3: { ph: 'H3 H4', inst: 'choirMenAhNew', oct: -1, vel: 0.85 },
        lead4: { ph: 'DS1 DS2', inst: 'strings', vel: 0.6 }, choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.8 }, timp: { p: 'beats', vel: 0.62, roll: 1 },
        drums: { crashS: at(8, { 0: 'x...............', 7: 'x...............' }) }, verb: 0.9, subBass: 0.85 },
      // the procession's answer, in full
      { n: 'answer', bars: 8, bpm: 62, cres: [0.98, 1.06], prog: 'I I IV V | I vi ii V',
        pad: { p: 'sus', n: 4, reg: [55, 81], vel: 0.82 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 3, reg: [43, 60], vel: 0.85, gate: 0.8 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: 'A1 A2', inst: 'horn', vel: 1.0 }, lead2: { ph: '@', inst: 'strings', oct: 1, vel: 0.6 }, lead4: { ph: 'A1 A2', inst: 'tpts', oct: 1, vel: 0.5 }, bell2: { ph: 'A1 A2', inst: 'trombones', oct: -1, vel: 0.6 },
        choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.7 }, timp: 'two',
        drums: { p: 'field', vel: 0.8, crashS: at(8, { 0: 'x...............' }) } },
      // the close and the amen
      { n: 'close', bars: 4, bpm: 60, bpmTo: 54, cres: [1.0, 0.92], prog: 'ii | V | I/III:.5 V:.5 | I',
        pad: { p: 'sus', n: 4, reg: [57, 81], vel: 0.82 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3 }, vel: 1.0 },
        lead: { ph: 'CDx', inst: 'horn', vel: 0.95 }, lead2: { ph: '@', inst: 'strings', oct: 1, vel: 0.6 }, choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 0.85 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.7 }, timp: 'two' },
      { n: 'amen', bars: 2, bpm: 54, bpmTo: 46, cres: [0.9, 1.04], prog: 'IV iv',
        pad: { p: 'sus', n: 4, reg: [57, 84], vel: 0.85 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.4, rel: 3 }, vel: 1.05 },
        pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [33, 45], vel: 0.7 }, lead: { ph: 'AM', inst: 'horn', vel: 0.95 }, lead4: { ph: 'AMt', inst: 'tpts', vel: 0.7 },
        choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 1.0 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.85 }, timp: { p: 'hits', vel: 0.7, roll: 1 }, verb: 1.05, subBass: 0.9 },
      // the last chord, held: struck with the tam-tam and the cymbal, swelling once, then let go into the hall
      { n: 'final', bars: 4, bpm: 40, cres: [1.12, 0.62], prog: 'I:4',
        pad: { p: 'sus', n: 4, reg: [57, 86], vel: 0.88, rel: 4 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.62, rel: 3 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.2, rel: 4.5 }, vel: 1.1 },
        pad3: { p: 'sus', inst: 'tuba', root: true, n: 1, reg: [33, 45], vel: 0.7 }, lead: { ph: 'FIN', inst: 'horn', vel: 1.0 }, lead4: { ph: 'FINt', inst: 'tpts', vel: 0.75 },
        choir: { inst: 'choirMenAh', n: 3, reg: [45, 60], vel: 1.05, rel: 4 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.9, rel: 4 },
        timp: { kick: ['X...............', '................', '................', '................'], vel: 0.9 },
        drums: { crashS: at(4, { 0: 'x...............' }), tam: at(4, { 0: 'x...............' }), bd: at(4, { 0: 'X...............' }) }, verb: 1.3, subBass: 0.9 },
    ],
  }));

  window.CONCERT_SUITE = {
    title: 'Master of Orion — Reborn: Concert Suite', artist: 'MOOgenesis',
    movements: [
      { id: 'concert:1', file: '1-first-light', title: 'I. First Light — Prelude' },
      { id: 'concert:2', file: '2-the-long-night', title: 'II. The Long Night — Passacaglia' },
      { id: 'concert:3', file: '3-commonwealth', title: 'III. Commonwealth — Finale' },
    ],
  };
})(window.MOO);
