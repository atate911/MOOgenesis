// Master of Orion — Reborn · the score · screens, events and the title
// The title hymn, the battle and ground cues, the council and the procession, the news, Orion and the Antarans, the endings, espionage, two cues no screen plays any more (design, research).
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  Track('title', {
    desc: 'Main theme — the hymn: the men first, open, singing the commonwealth’s climb on the hymn’s harmony over the planetarium’s analogue bed, the air and points of light; the solo horn’s call over them as the strings, the deep pedal, a chime and the timpani’s pulse join; the horn sings the whole hymn alone over the chorus and the organ, the men taking up the answer; the horn section rises above the men on the hymn over the cellos’ counter-line; a flute breathes and an oboe answers it with the commonwealth’s tune, which leads into the crest — the horns high above everything, the trombones under them, the trumpets crowning the answer, the whole chamber open on ah, the timpani — and the solo horn closes it; one chord to a bar, harmonised to the tune the way a hymn is; every line shaped phrase by phrase and every long brass note swelling, from a hum to the full chamber',
    quotes: ['procession'],
    bpm: 70, root: 'D', mode: 'minor', loopFrom: 'A1', trim: 2.34, tens: false, rubato: 0.025, tone: { lo: 1.2, hi: 1.0 }, fx: { verb: 0.8, stage: 0.9, dly: 1.1 }, mix: { choir: 1.35, pad: 0.95, lead: 1.9, bass: 1.15 },
    sends: { lead: { verb: 0.1, stage: 0.34, dly: 0.05 }, choir: { verb: 0.3, stage: 0.12 } },   // the solo stands at the front of the stage, the bed behind it in the hall; the chorus close enough to be clear
    forms: [['A1', 'B', 'C', 'A2', 'E', 'C', 'A1', 'E'], ['A1', 'C', 'B', 'A2', 'C', 'E', 'A1', 'B', 'E']],
    alts: [{}, { choir2: 'choirWomen' }],
    inst: { pad: 'organ', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'strings', bell: 'glass', bell2: 'tpts', choir: 'choirMen', choir2: 'ooh', arp: 'strOst' },
    ph: {
      PAh: '1:3 2:1 | 3:2 5:2 | r:8',                                    // the commonwealth's climb, its head, sung by the men as the first gesture of the game
      PAm: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2! 2:2',                          // the second leitmotif (the commonwealth's oboe) in the minor, the oboe's answer to the flute in the breath; its third held over the dominant as an appoggiatura, resolving to the fifth
      H1: '@hymn.H1',             // the hymn: rising fourth, falling step (the game's leitmotif), noble descent, half cadence
      H2: '@hymn.H2',
      H3: '@hymn.H3',             // the answer, a fifth higher
      H4: '@hymn.H4',
      K: '@hymn.K',               // the call: the head of the hymn alone
      ST: '1:4 | r:4 | 5:4 | r:4', ST2: '1:4 | r:12', // the chime: one strike at the very start; under the call, one on the downbeat and one on the dominant
      CT: '@hymn.CT',             // the cellos' counter-line beneath the men
      F1: '5:1 8:1 7:1 5:1 | 6:1 5:1 3:1 5:1 | 4:2 5:2 | 8:4', // flute, the interlude, on the hymn's own harmony
    },
    // The harmony is the hymn's own: one chord to a bar, each bar's chord holding the tune's notes (i, the flat sixth, the fourth, the
    // flat-third seventh, the dominant seventh), a half close at the end of the first strain and a full close at the end of the answer.
    // The build: the solo horn over the humming chorus (intro, A1); the horn section with the men on the hymn (B); the breath (C); the
    // horns in full with the trumpets on the answer and the chamber open on ah (A2); the solo horn alone again (E). Every line carries
    // shape: a hairpin over each phrase, as a singer or a horn player phrases it. The opening: the men alone for four bars, open and present,
    // on the hymn's own harmony; then the horn's call in its heroic register (A4 to D5) over them as the strings, the deep pedal, a chime and
    // the timpani's pulse join. Soft and slow, but clear, and nothing idles. The horns play the hymn an octave below its written
    // octave (F3 to A4, the horn's own middle register) where it is a solo; at the build (B) and the crest (A2) the horn section rises above
    // the men in the written octave, the trombones an octave under it and the trumpets on the answer, every long note swelling (swell): the
    // horns above everything, in the Roll Tide manner. The solo horn's phrases carry a
    // dynamic plan ('H3*1': the answer, the top of the arc; 'H1*0.74': the statement, under it), deeper hairpins, a delayed vibrato and a
    // tone that darkens as it plays softer. Where the solo horn plays it has a window of its own: the organ and the men below D4, the women's
    // hum and the analogue halo above A4, the men's answer an octave under it, the solo near the centre and closer than the bed (sends.lead).
    sec: [
      { n: 'men', bars: 4, cres: [0.6, 0.68], prog: 'i:2 | bVI V7', choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.72 }, lead2: { ph: 'PAh', inst: 'choirMenAh', oct: -1, vel: 0.74, shape: 0.35 }, pad: { p: 'swell', inst: 'analog', n: 2, reg: [48, 64], vel: 0.32 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.28 }, arp: { inst: 'glass', pat: '0.......2.......', res: 2, vel: 0.3, reg: [72, 96] }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', sub: 0.6, att: 2.5, rel: 3.0 }, vel: 0.6 }, bell2: { ph: 'ST2', inst: 'chime', vel: 0.42 } },   // the men alone, open, on the hymn's harmony: the first sound of the game, their first phrase the commonwealth's climb — over the planetarium: a slow analogue bed beneath them, the air above, points of light echoing in the delay, one chime at the start, the deep pedal rising: solemn, vast
      { n: 'call', bars: 4, cres: [0.68, 0.76], prog: 'i bVI V7 i', pad: { p: 'sus', inst: 'strings', n: 4, reg: [48, 72], vel: 0.66 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [60, 81], vel: 0.42 }, arp: { inst: 'glass', pat: '0.......2.......', res: 2, vel: 0.28, reg: [72, 96], skip: 0.3 }, bass: { pat: ['1---', '1---', '1---', 'c---'], inst: { p: 'deep', sub: 0.8, att: 0.3, rel: 2.0 } },
        choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.68 }, choir2: { inst: 'ooh', n: 3, reg: [64, 79], vel: 0.4, soft: true },
        lead: { ph: 'K', inst: 'hornSolo', vel: 1.0, shape: 0.3, swell: 0.25, pan: -0.05 }, bell2: { ph: 'ST', inst: 'chime', vel: 0.5 }, timp: { kick: 'X...............', vel: 0.55 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.4 } },   // the horn's call over the men as the strings, the deep pedal, a chime and the timpani's pulse join
      { n: 'A1', bars: 16, cres: [0.62, 0.8], prog: 'i bVI i V7 | i iv bVI V | bVI i bIIIM7 bVII | iv bIIIM7 V i',
        pad: { p: 'sus', inst: 'strings', n: 3, reg: [45, 64], vel: 0.52 }, pad2: { p: 'swell', inst: 'analog', n: 2, reg: [69, 84], vel: 0.38 }, arp: { inst: 'glass', pat: '0.......', res: 2, vel: 0.24, reg: [72, 96], skip: 0.4 }, bass: { pat: ['1---', '1---', 'c---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.3, rel: 1.6 } },
        lead: { ph: 'H1*0.78 H2*0.86 H3*1 H4*0.9', inst: 'hornSolo', oct: -1, vel: 1.0, shape: 0.4, swell: 0.4, pan: -0.05 }, lead2: { ph: 'r8 H3 H4', inst: 'choirMen', oct: -2, vel: 0.5, shape: 0.4 },
        choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.5, soft: true }, choir2: { inst: 'ooh', n: 3, reg: [64, 79], vel: 0.4, soft: true }, bell: { dens: 0.05, res: 1, reg: [72, 96], vel: 0.34 } },
      { n: 'B', bars: 8, lv: 0.86, prog: 'i bVII i V7 | i iv bVI V', cr: true, pad: { p: 'sus', inst: 'organ', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [48, 69], vel: 0.75 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.3, rel: 1.4 } },
        arp: { pat: '0.......2.......', res: 2, vel: 0.4, reg: [55, 79], gate: 0.9 },
        lead: { ph: 'CT CT', inst: 'cello', oct: -1, vel: 0.6, art: 0.95, shape: 0.25 }, lead2: { ph: 'H1 H2', inst: 'choirMenAh', oct: -1, vel: 0.8, shape: 0.4 }, bell2: { ph: 'H1*0.85 H2*1', inst: 'horn', vel: 0.85, shape: 0.35, swell: 0.5 },
        choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.75 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.5 } },
      { n: 'C', bars: 8, lv: 0.4, prog: 'i bVI V7 i | i i iv V7', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [55, 79], vel: 0.6 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: ['c---', '1---'], inst: { p: 'deep', sub: 0.8, att: 1.2, rel: 2.4 } },
        lead: { ph: 'F1 r4', inst: 'flute', vel: 0.55, shape: 0.3 }, lead2: { ph: ['r4 PAm', 'r4 PAm', 'r8'], inst: 'oboe', vel: 0.6, shape: 0.35 }, arp: { inst: 'harp', p: 'up8', vel: 0.5, reg: [55, 84] }, choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.45, soft: true }, choir2: { inst: 'ooh', n: 3, reg: [57, 74], vel: 0.3, soft: true }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.4 }, drums: false, timp: false, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.92, 1.12], prog: 'i bVI i V7 | i iv bVI V | bVI i bIIIM7 bVII | iv bIIIM7 V i', cr: true,
        pad: { p: 'sus', inst: 'organ', n: 4, reg: [45, 72], vel: 0.5 }, pad2: { p: 'sus', inst: 'analog', n: 3, reg: [48, 69], vel: 0.85 }, bass: { pat: ['c---', 'c---', '1---', 'c---'], inst: { p: 'deep', sub: 0.85, att: 0.3, rel: 1.4 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.4, reg: [55, 79], gate: 0.9 },
        lead: { ph: 'H1*0.9 H2*0.95 H3*1 H4*0.96', inst: 'horn', vel: 1.0, shape: 0.35, swell: 0.5 }, lead2: { ph: 'H1*0.9 H2*0.95 H3*1 H4*0.96', inst: 'trombones', oct: -1, vel: 0.8, shape: 0.35, swell: 0.5 }, bell2: { ph: 'r8 H3 H4', inst: 'tpts', vel: 0.85, shape: 0.3, swell: 0.4 },
        choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.95 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.8 }, timp: { p: 'hits', vel: 0.6 },
        bell: { dens: 0.15, res: 1, reg: [76, 100], vel: 0.5 } },
      { n: 'E', bars: 8, cres: [0.72, 0.48], prog: 'iv bIIIM7 V i | iv bIIIM7 V i', pad: { p: 'sus', n: 3, reg: [43, 62] }, pad2: { p: 'sus', inst: 'warm', n: 2, reg: [69, 84], vel: 0.4 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.6, rel: 2.0 } },
        lead: { ph: 'H4*0.9 H4*0.65', inst: 'hornSolo', oct: -1, vel: 0.85, shape: 0.4, pan: -0.05 }, choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.6, soft: true }, choir2: { inst: 'ooh', n: 3, reg: [64, 79], vel: 0.33, soft: true }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.34 } },
    ],
  });

  Track('combat3', {
    desc: 'Battle — driving spiccato string ostinato, low-brass stabs, bass drum and snare, men’s choir, and the main theme hammered out by horns and full brass as the fight escalates',
    bpm: 118, trim: 1.49, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, choir: 0.3, lead: 0.42, bell: 0.6 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A1', 'C', 'B1', 'A2', 'B2', 'C'], ['A1', 'C', 'B1', 'A2', 'B2', 'C', 'A1', 'B1', 'B2', 'A2', 'C']],
    inst: { pad: 'lowBrass', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'brass', arp: 'strOst', bell: 'bell', choir: 'ooh' },
    ph: {
      B1: '5:1.5 8:.5 7:1 6:1 | 5:2 3:2 | 4:1.5 5:.5 6:1 4:1 | 5:4',
      B2: '5:1.5 8:.5 9:1 10:1 | 8:2 7:1 6:1 | 5:1.5 6:.5 5:1 4:1 | 3:2 5:2',
      B3: '8:.5 8:.5 8:1 10:1 7:1 | 8:.5 8:.5 8:1 5:1 3:1 | 4:1 5:1 6:1 8:1 | 7:2 5:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.62, prog: 'i', hit: 'tam', pad2: { p: 'sus', inst: 'analog', n: 3, reg: [38, 57], vel: 0.9 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.6, reg: [50, 62], gate: 0.7 }, drums: { bd: 'x.......x.......' }, timp: 'hits' },
      { n: 'A1', bars: 16, lv: 0.8, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2', vel: 0.85 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, fill: 'rollS' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 0.95, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.75 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.75, reg: [55, 79], gate: 0.9, jump: 0.05 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B3 B3', inst: 'brass', vel: 1.0, harm: -2 },
        lead2: { ph: 'B1 B2 B1 B2', inst: 'strings', oct: 1, vel: 0.55 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.0 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.75 }, fill: 'bigS' },
      { n: 'A2', bars: 16, lv: 0.88, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9, jump: 0.06 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2', vel: 0.88, harm: -2 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'rollS' },
      { n: 'C', bars: 8, lv: 0.45, prog: 'i:2 bVI:2 bVII:2 V:2', pad2: { p: 'sus', inst: 'strTrem', n: 4, reg: [55, 79], vel: 0.65 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.5, reg: [50, 62], gate: 0.7 },
        drums: { bdSoft: 'x...............', t5: '........x.......' }, timp: { p: 'hits', roll: 2 }, choir: { inst: 'choirMen', n: 3, reg: [40, 57], vel: 0.6 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.15, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', hit: true, cr: true, pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 1.0, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 81], vel: 0.8 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.78, reg: [55, 81], gate: 0.9, jump: 0.08 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B1 B2', inst: 'brass', vel: 1.0, harm: -2 },
        lead2: { ph: 'B3 B3 B1 B2', inst: 'strings', oct: 1, vel: 0.6 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.05 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.8 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'bigS' },
    ],
  });

  Track('design', {
    desc: 'Technical, light: bubbling marimba and sequenced plucks over a springy bass',
    bpm: 112, trim: 1.47, root: 'G', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'D', 'E', 'A1', 'B', 'C', 'A2', 'D', 'B2', 'E', 'A3', 'C', 'E'], ['A1', 'B', 'A2', 'D', 'C', 'A3', 'B2', 'E', 'A1', 'C', 'B', 'A2', 'E', 'D', 'B2', 'A3', 'C', 'E']],
    inst: { pad: 'glassPad', bass: 'pulse', lead: 'marimba', lead2: 'vibes', bell: 'vibes', arp: 'seq', choir: 'ooh' },
    ph: {
      T1: '5:.5 8:.5 5:.5 3:.5 5:1 r:1 | 6:.5 8:.5 6:.5 3:.5 6:1 r:1 | 4:.5 6:.5 4:.5 2:.5 4:1 r:1 | 5:.5 7:.5 5:.5 3:.5 2:1 r:1',
      T2: '8:1 7:.5 5:.5 3:1 5:1 | 8:1 6:.5 5:.5 6:1 8:1 | 9:1 8:.5 6:.5 4:1 6:1 | 5:2 r:1 5:1',
      T3: '8:1 6:.5 4:.5 6:1 8:1 | 7:1 5:.5 3:.5 5:1 7:1 | 6:1 4:.5 2:.5 4:1 6:1 | 5:2 r:1 5:1',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.55, prog: 'IM7 vi7 ii7 V7', pad: 'sus', arp: { pat: '0.2.1.3.', res: 2, vel: 0.4, reg: [60, 84] }, drums: { hat: 'x.x.x.x.x.x.x.x.' } },
      { n: 'A1', bars: 8, lv: 0.7, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T1 T1', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'A2', bars: 8, lv: 0.8, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T1 T2', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, bell: { dens: 0.3, res: 2, reg: [76, 93] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'B', bars: 8, lv: 0.88, prog: 'IV iii ii V | IV iii ii V', pad: 'sus', bass: 'oct8', lead: 'T3 T3', arp: { p: 'up', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
      { n: 'C', bars: 8, lv: 0.55, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: { p: 'swell' }, bass: 'half', lead: false, arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, bell: { dens: 0.35, res: 2, reg: [72, 91], vel: 0.55 }, drums: { hat: 'x.x.x.x.x.x.x.x.' } },
      { n: 'A3', bars: 8, lv: 0.9, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: { ph: 'T2 T1', harm: -2 }, arp: { p: 'updown', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'B2', bars: 8, lv: 0.98, prog: 'IV iii ii V | IV iii ii V', pad: 'sus', bass: 'oct8', lead: { ph: 'T3 T2', inst: 'marimba' }, lead2: { ph: 'T3 T2', inst: 'vibes', oct: 1, vel: 0.4 }, arp: { p: 'up', vel: 0.34, reg: [60, 86] }, drums: { kick: 'x...x...x...x...', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...', clap: '....o.......o...' }, fill: 'snare' },
      { n: 'D', bars: 8, lv: 0.82, prog: 'IV iii ii V | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: { ph: 'T3 T1', inst: 'vibes', vel: 0.75 }, arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x..x....x.x.....', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.3, res: 2, reg: [76, 93] } },
      { n: 'E', bars: 8, lv: 0.65, prog: 'IM7 vi7 ii7 V7 | IM7 vi7 ii7 V7', pad: 'sus', bass: 'sync', lead: 'T2 T1', arp: { pat: '0.2.1.3.', res: 2, vel: 0.36, reg: [60, 84] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' } },
    ],
  });

  Track('research', {
    desc: 'Shimmering discovery: crystal bells, rising sequences and a glassy lydian wash',
    bpm: 84, trim: 1.37, root: 'E', mode: 'lydian', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'E', 'C', 'A1', 'B', 'A2', 'B2', 'E', 'A3'], ['A1', 'B', 'A2', 'C', 'B2', 'E', 'A3', 'C', 'A1', 'A2', 'B', 'B2', 'E', 'A3']],
    inst: { pad: 'glassPad', bass: 'deep', lead: 'glass', lead2: 'glass', bell: 'crystal', arp: 'glass', choir: 'eeh' },
    ph: {
      R1: '5:1 8:.5 7:.5 5:1 3:1 | 6:1 8:.5 9:.5 8:1 6:1 | 5:1.5 6:.5 8:1 6:1 | 7:1 5:1 7:1 9:1',
      R2: '5:1 8:.5 7:.5 5:1 3:1 | 6:1 8:.5 9:.5 8:1 6:1 | 3:1.5 5:.5 7:1 5:1 | 7:1 9:1 12:2',
      R3: '6:1 8:1 10:1 12:1 | 7:1 9:1 12:1 9:1 | 8:1 10:1 12:1 10:1 | 9:1 11:1 13:1 11:1',
      R4: '6:1 8:1 10:1 12:1 | 7:1 9:1 12:1 9:1 | 9:1 11:1 13:1 11:1 | 12:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.45, prog: 'IM7:2 II:2', pad: { p: 'swell' }, bell: { dens: 0.35, res: 2, reg: [76, 96], vel: 0.55 } },
      { n: 'A1', bars: 8, lv: 0.66, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'whole', lead: 'R1 R2', arp: { pat: '0.2.', res: 4, vel: 0.3, reg: [64, 91] } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'half', lead: 'R1 R2', arp: { p: 'up', vel: 0.34, reg: [64, 93], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [79, 96], vel: 0.5 }, drums: { shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'vi V IM7 II | vi V II V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R3 R4', inst: 'glass' }, lead2: { ph: 'R3 R4', inst: 'crystal', oct: 1, vel: 0.4 }, arp: { p: 'updown', vel: 0.34, reg: [64, 93], jump: 0.1 }, choir: { v1: 'e', v2: 'i', vel: 0.6 }, drums: { kick: 'x.......x.......', shk: 'o.o.o.o.o.o.o.o.' } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'IM7:2 II:2 vi:2 V:2', pad: { p: 'swell' }, bass: false, lead: false, bell: { dens: 0.45, res: 2, reg: [72, 96], vel: 0.6 }, choir: { v1: 'i', v2: 'e', vel: 0.5 }, arp: { pat: '0.2.', res: 4, vel: 0.26, reg: [64, 91] } },
      { n: 'A3', bars: 8, lv: 0.92, prog: 'IM7 II vi V | IM7 II iii V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R1 R2', harm: -2 }, lead2: { ph: 'R1 R2', inst: 'glass', oct: 1, vel: 0.4 }, arp: { p: 'up', vel: 0.36, reg: [64, 93], jump: 0.1 }, bell: { dens: 0.3, res: 2, reg: [79, 96], vel: 0.5 }, drums: { kick: 'x.......x.......', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' } },
      { n: 'B2', bars: 8, lv: 1.02, prog: 'vi V IM7 II | vi V II V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'R3 R4', inst: 'glass', harm: -2 }, lead2: { ph: 'R3 R4', inst: 'crystal', oct: 1, vel: 0.45 }, arp: { p: 'run', vel: 0.34, reg: [64, 95], jump: 0.1 }, choir: { v1: 'e', v2: 'i', vel: 0.8 }, drums: { kick: 'x...x...x...x...', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, fill: 'snare' },
      { n: 'E', bars: 8, lv: 0.6, prog: 'IM7 II vi V | IM7 II iii V', pad: 'sus', bass: 'whole', lead: 'R2 R1', arp: { pat: '0.2.', res: 4, vel: 0.28, reg: [64, 91] }, bell: { dens: 0.25, res: 2, reg: [79, 96], vel: 0.45 } },
    ],
  });

  Track('combat1', {
    desc: 'Driving percussive tension: galloping bass, fast saw arps, timpani and a brass riff',
    bpm: 142, trim: 1.92, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'E', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, lead: 0.4, bell: 0.55 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A3', 'C', 'A1', 'B1', 'A2', 'B2', 'A3'], ['A1', 'C', 'B1', 'A2', 'B2', 'A3', 'A1', 'B1', 'C', 'A2', 'B2', 'A3']],
    inst: { pad: 'dark', bass: 'moog', lead: 'synth', lead2: 'brass', arp: 'arpSaw', bell: 'bell' },
    ph: {
      M1: '1:.5 1:.5 3:.5 1:.5 5:1 4:.5 3:.5 | 1:.5 1:.5 3:.5 1:.5 5:1 6:.5 5:.5',
      M2: '5:1 4:.5 3:.5 5:1 6:1 | 8:2 7:1 6:1 | 5:1 4:.5 3:.5 2:1 3:1 | 1:4',
      M3: '10:2 8:1 6:1 | 9:2 7:1 5:1 | 8:1 10:1 12:1 10:1 | 7#:2 9:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.6, prog: 'i', hit: true, pad: 'sus', bass: { pat: '1---', pedal: true }, timp: { p: 'roll', roll: 0 }, arp: { pat: '0.2.', res: 4, vel: 0.35, reg: [52, 76], gate: 0.5 } },
      { n: 'A1', bars: 16, lv: 0.85, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6 }, drums: 'drive', timp: 'hits', lead: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', fill: 'tom' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2 M3', inst: 'brass', harm: -2 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.92, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'hits', lead: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', lead2: { ph: 'r8 M1 M1-2 M1 M1-1', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bVI:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.2.', res: 4, vel: 0.3, reg: [52, 76], gate: 0.5 }, drums: { t5: 'X...............', t4: '........o.......', rim: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.2, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.52, reg: [52, 81], gate: 0.6, jump: 0.08 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2+3 M3', inst: 'brass', harm: -2 }, lead2: { ph: 'M2 M3 M2 M3', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
      { n: 'A3', bars: 16, lv: 1.0, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.1 }, drums: 'drive', timp: 'gallop', lead: { ph: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', harm: -2 }, lead2: { ph: 'r8 M1 M1-2 M1 M1-1', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
    ],
  });

  Track('combat2', {
    desc: 'Heavy half-time assault: syncopated stabs, chromatic phrygian bass, metal hits and a rapid pulse arp',
    bpm: 152, trim: 1.76, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'C#', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, lead: 0.4, bell: 0.55 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A3', 'C', 'A1', 'B1', 'A2', 'B2', 'A3', 'B2'], ['A1', 'C', 'B1', 'A2', 'B2', 'A3', 'A1', 'B1', 'C', 'A2', 'B2', 'A3', 'A3']],
    inst: { pad: 'dark', bass: 'pulse', lead: 'brass', lead2: 'horn', arp: 'seq', bell: 'bell' },
    ph: {
      N1: '1:1.5 1:1.5 3:1 | 2b:1.5 2b:1.5 4:1 | 5:1.5 3:1.5 1:1 | 7:1.5 5:1.5 4:1',
      N2: '8:1.5 8:1.5 10:1 | 9b:1.5 9b:1.5 11:1 | 11:2 9:1 7:1 | 5:2 3:1 1:1',
      N3: '8:2 6:1 8:1 | 9:2 7:1 9:1 | 10:2 8:2 | 5:4',
      N4: '10:2 8:1 10:1 | 11:2 9:1 11:1 | 12:2 11:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.6, prog: 'i', hit: true, pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X.......x.......', metal2: '..........o.....' }, timp: 'two' },
      { n: 'A1', bars: 16, lv: 0.86, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5 }, drums: 'heavy', timp: 'hits', lead: 'N1 N2 N1 N2', fill: 'tom' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'two', lead: { ph: 'N3 N4 N3 N4', harm: -2 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.94, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'hits', lead: { ph: 'N1 N2 N1 N2', inst: 'horn' }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X...............', t4: '........o.......', metal2: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.22, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.48, reg: [49, 78], gate: 0.5, jump: 0.08 }, drums: 'heavy', timp: 'beats', lead: { ph: 'N3 N4 N3 N4', harm: -2 }, lead2: { ph: 'N3 N4 N3 N4', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
      { n: 'A3', bars: 16, lv: 1.0, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.5, reg: [49, 78], gate: 0.5, jump: 0.1 }, drums: 'heavy', timp: 'gallop', lead: { ph: 'N1 N2 N1 N2', harm: -2 }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
    ],
  });

  Track('ground', {
    desc: 'Tense ground assault: low toms, a menacing plucked ostinato and brass swells in phrygian',
    tags: { solitude: 0, contact: 0.2, tension: 0.9, war: 1, grief: 0.3, grandeur: 0.3, energy: 0.6, dark: 0.8 },
    bpm: 100, trim: 2.99, root: 'A', mode: 'phrygian', loopFrom: 'A1', tens: { x1: false },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'D', 'E', 'A1', 'C', 'B1', 'A2', 'D', 'B2', 'E', 'A1', 'E'], ['A1', 'C', 'B1', 'A2', 'D', 'B2', 'E', 'A1', 'B1', 'C', 'A2', 'B2', 'D', 'E', 'A1', 'E']],
    inst: { pad: 'dark', bass: 'moog', lead: 'horn', lead2: 'brass', arp: 'seq', bell: 'chime' },
    ph: {
      G1: '8:3 7:1 | 5:2 3:2 | 9:3 8:1 | 6:2 4:2',
      G2: '5:2 8:2 | 7:2 5:2 | 7:3 5:1 | 4:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X...............', shk: 'o.o.o.o.o.o.o.o.' }, hit: true },
      { n: 'A1', bars: 8, lv: 0.7, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, bell: { dens: 0.15, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'B1', bars: 8, lv: 0.82, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, lead: 'G1 G2', timp: 'two', bell: { dens: 0.2, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [45, 69], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: '..o...o...o...o.', hat: 'o.o.o.o.o.o.o.o.' }, timp: 'beats' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: false, drums: { t5: 'X...............', metal2: '..........o.....' }, lead: false, bell: { dens: 0.2, res: 1, reg: [64, 86], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 0.95, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.52, reg: [45, 72], gate: 0.6, jump: 0.08 }, drums: 'ominous', lead: { ph: 'G1 G2', inst: 'brass', harm: -2 }, timp: 'beats', fill: 'tom' },
      { n: 'D', bars: 8, lv: 1.05, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.55, reg: [45, 72], gate: 0.6, jump: 0.1 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: 'o.o.o.o.o.o.o.o.', hat: 'xoxoxoxoxoxoxoxo', snare: '........x.......' }, timp: 'gallop', lead: { ph: 'G2 G1', inst: 'brass', harm: -2 }, fill: 'roll' },
      { n: 'E', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.45, reg: [45, 69], gate: 0.6 }, drums: 'ominous', lead: 'G1 G2' },
    ],
  });

  Track('gnn', {
    desc: 'Galactic News Network: a confident, upbeat broadcast bed with brass stabs and a bright ident theme',
    bpm: 120, trim: 0.95, root: 'C', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'D', 'E', 'A1', 'B', 'C', 'A2', 'D', 'B2', 'E', 'A3', 'C', 'A1', 'B', 'E'], ['A1', 'B', 'A2', 'D', 'C', 'A3', 'B2', 'E', 'A1', 'C', 'B', 'A2', 'E', 'D', 'B2', 'A3', 'A1', 'C', 'B', 'E']],
    inst: { pad: 'organ', bass: 'pulse', lead: 'synth', lead2: 'bell', arp: 'seq', bell: 'vibes' },
    ph: {
      G1: '5:.5 5:.5 8:1.5 5:.5 8:1 | 7:.5 7:.5 9:1.5 7:.5 9:1 | 8:.5 8:.5 10:1.5 8:.5 10:1 | 6:.5 6:.5 8:1 9:.5 10:.5 11:1',
      G2: '9:1 11:.5 9:.5 6:1 9:1 | 9:1 7:.5 9:.5 12:1 9:1 | 12:2 10:1 8:1 | 8:3 r:1',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.7, prog: 'I V vi IV', hit: true, pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.9 }, bass: 'sync', drums: 'news', fill: 'snare' },
      { n: 'A1', bars: 8, lv: 0.78, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.7 }, bass: 'sync', lead: 'G1 G1', drums: 'news', arp: { pat: '0.2.1.3.', res: 2, vel: 0.3, reg: [64, 88] } },
      { n: 'A2', bars: 8, lv: 0.88, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.7 }, bass: 'oct8', lead: { ph: 'G1 G1', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.32, reg: [64, 88] }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'ii V I I | vi IV V V', pad: { p: 'stab', pat: 'x.x.x.x.x.x.x.x.', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.55, gate: 0.5 }, bass: 'oct8', lead: 'G2 G2', drums: 'news', arp: { p: 'up', vel: 0.32, reg: [64, 88] } },
      { n: 'C', bars: 8, lv: 0.6, prog: 'I V vi IV | I V vi V', pad: { p: 'sus', inst: 'warm' }, bass: 'half', lead: false, arp: { pat: '0.2.1.3.', res: 2, vel: 0.34, reg: [64, 88] }, drums: { kick: 'x.......x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, bell: { dens: 0.35, res: 2, reg: [72, 95], vel: 0.55 } },
      { n: 'A3', bars: 8, lv: 0.95, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.75 }, bass: 'oct8', lead: { ph: 'G1 G1+2', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.34, reg: [64, 90], jump: 0.08 }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 }, fill: 'snare' },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'ii V I I | vi IV V V', pad: { p: 'stab', pat: 'x.x.x.x.x.x.x.x.', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.6, gate: 0.5 }, bass: 'oct8', lead: { ph: 'G2 G2', harm: -2 }, drums: 'news', arp: { p: 'up', vel: 0.34, reg: [64, 90], jump: 0.08 }, timp: 'two', fill: 'snare' },
      { n: 'D', bars: 8, lv: 0.82, prog: 'ii V I I | ii V I V', pad: { p: 'sus', inst: 'warm' }, bass: 'oct8', lead: { ph: 'G2 G2', inst: 'vibes', vel: 0.8 }, drums: { kick: 'x.....x.x.......', hat: 'x.x.x.x.x.x.x.x.', rim: '....x.......x...' }, arp: { p: 'up', vel: 0.3, reg: [64, 88] }, bell: { dens: 0.3, res: 2, reg: [76, 95], vel: 0.5 } },
      { n: 'E', bars: 8, lv: 0.8, prog: 'I V vi IV | I V vi IV', pad: { p: 'stab', pat: 'x..x..x.x..x.x..', inst: 'brassStab', n: 3, reg: [55, 76], vel: 0.65 }, bass: 'sync', lead: 'G1 G2', drums: 'news', arp: { pat: '0.2.1.3.', res: 2, vel: 0.3, reg: [64, 88] } },
    ],
  });

  Track('council', {
    desc: 'Galactic Council: grand ceremonial brass fanfare, hymn-like choir and timpani',
    bpm: 72, trim: 1.53, root: 'Bb', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B2', 'E', 'C', 'A1', 'B', 'E', 'A2', 'B2', 'E'], ['A1', 'B', 'A2', 'C', 'B2', 'E', 'A3', 'C', 'A1', 'A2', 'B', 'B2', 'E']],
    inst: { pad: 'organ', bass: 'deep', lead: 'horn', lead2: 'brass', arp: 'harp', bell: 'bell', choir: 'aah' },
    ph: {
      F1: '1:1 5:1 8:2 | 8:1.5 6:.5 5:1 3:1 | 5:2 7:2 | 7:3 r:1',
      CA: '1:1.5 3:.5 5:2 | 5:1.5 6:.5 7:1 8:1 | 8:1.5 7:.5 6:2 | 5:1.5 4:.5 3:2 | 4:2 6:1 8:1 | 8:1.5 6:.5 5:2 | 4:1.5 5:.5 6:1 4:1 | 5:3 r:1',
      CB: '1:1.5 3:.5 5:2 | 5:1.5 6:.5 7:1 8:1 | 8:1.5 7:.5 6:2 | 5:1.5 4:.5 3:2 | 4:2 6:2 | 5:2 7:2 | 8:3 5:1 | 5:2 1:2',
      CC: '6:2 5:1 3:1 | 4:2 6:2 | 5:2 3:1 1:1 | 2:2 5:2 | 6:2 8:2 | 6:2 4:2 | 5:2 7:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.7, prog: 'I:2 V:2', hit: true, pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'F1', inst: 'brass' }, timp: { p: 'beats', vel: 0.8 }, choir: { vel: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.8, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'CA', timp: 'two', choir: { vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.9, prog: 'I V vi iii | IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CB', inst: 'brass', harm: -2 }, timp: 'beats', choir: { vel: 0.7 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B', bars: 8, lv: 0.72, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'organ' }, bass: 'half', lead: { ph: 'CC', inst: 'horn' }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.85 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.6 }, bell: { dens: 0.2, res: 1, reg: [72, 91], vel: 0.5 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.3, res: 1, reg: [72, 91], vel: 0.55 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'A3', bars: 8, lv: 0.98, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CA', harm: -2 }, lead2: { ph: 'CA', inst: 'brass', oct: -1, vel: 0.6 }, timp: 'beats', choir: { vel: 0.9 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'CC', inst: 'brass', harm: -2 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.82, prog: 'I V vi iii | IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'CB', timp: 'two', choir: { vel: 0.6 } },
    ],
  });

  Track('procession', {
    desc: 'The procession: a processional march in the nobilmente manner — a solo horn carries a long-breathed theme over tuba and trombones on the step, the snare alone keeps the march with a firm bass drum on the one, strings and the organ of the chamber behind, the choir entering as the theme returns; the flat-sixth lift for the big phrase, a lyrical trio, the drums fall away for a hymn and the full chamber answers it; rare on the map once the empire stands among others, regular at war',
    tags: { solitude: 0.1, contact: 0.6, tension: 0.4, war: 0.6, grief: 0.1, grandeur: 1, energy: 0.7, dark: 0.2, ceremony: 1 },
    motif: '@hymn.K', motifInst: 'hornSolo',   // the call: the next interlude carries it as the council approaches
    bpm: 84, trim: 2.6, tone: { lo: 0.8, hi: -2.5 }, root: 'F', mode: 'major', loopFrom: 'A1', tens: false, rubato: 0.01, mix: { drums: 1.0, lead: 1.15, bass: 1.1, choir: 1.1 },
    fx: { stage: 0.7, verb: 1.2 }, sends: { drums: { stage: 0.06, verb: 0.03, dly: 0 } },
    forms: [['A1', 'A2', 'B', 'T', 'D', 'R', 'E'], ['A1', 'B', 'T', 'A2', 'D', 'R', 'E'], ['A1', 'A2', 'T', 'B', 'D', 'R', 'E'], ['A1', 'T', 'A2', 'B', 'D', 'R', 'E']],
    alts: [{}, { bell: 'glass', pad2: 'cellos' }, { pad: 'organSoft', choir: 'choirWomen' }],
    inst: { pad: 'strings', pad2: 'lowBrass', bass: 'lowBrass', lead: 'hornSolo', lead2: 'horn', arp: 'harp', bell: 'bell', choir: 'aah', choir2: 'choirMen' },
    ph: {
      A1: '@procession.A1', A2: '@procession.A2',             // the theme: a slow climb from the tonic, and its answer to the octave
      B1: '5:2 6:1 8:1 | 10:3 9:1 | 8:2 6:2 | 5:4', B2: '6:2 5:1 6:1 | 8:3 10:1 | 9:2 8:1 7:1 | 8:4',  // the big phrase, over the flat-sixth lift
      CD: '@procession.CD',                                                     // the cadence
      T1: '3:3 4:1 | 5:2 8:2 | 7:3 6:1 | 5:4', T2: '6:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4',                  // the trio, lyrical
      CT: '1:2 3:2 | 4:2 5:2 | 6:2 4:2 | 5:4',                                                          // the low brass beneath
      HY: '@procession.HY', HY2: '@procession.HY2',                                // the hymn while the votes are cast
      CL: '@hymn.K',                                                            // the call (the game's leitmotif) that opens
    },
    sec: [
      // the approach grows out of the interlude: strings and the horn call alone, the harp, then ghosted snare strokes under the horn, the cadence only with the theme
      { n: 'intro', bars: 8, cres: [0.5, 0.78], prog: 'I:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.5 }, bass: { pat: ['....', '....', '....', '....', '1---', '1---', '1---', '1---'], inst: { p: 'lowBrass', att: 0.14 }, vel: 0.75 },
        arp: { pat: '0...2...1...3...', res: 1, vel: 0.3, reg: [55, 81] }, lead: { ph: ['CL r2 CL', 'r2 CL r2'], oct: -1, vel: 0.72 },
        drums: { bd: ['................', '................', '................', '................', 'o...............', 'o...............', 'X.......o.......', 'X.......x.......'], sn: ['................', '................', '................', '................', 'o.......o.......', 'o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'X.o.x.o.x.x.xxxx'] } },
      { n: 'A1', bars: 16, lv: 0.78, prog: 'I I IV V | I vi ii V | I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [38, 55], vel: 0.65, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A1 A2 B1 CD'], oct: -1, vel: 0.85 }, drums: { p: 'field', vel: 0.85 }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.38 }, fill: 'snS' },
      { n: 'A2', bars: 16, lv: 0.86, prog: 'I I IV V | I vi ii V | I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.8 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.75, gate: 0.7 }, bass: { p: 'walk', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A2 A1 A2 CD'], oct: -1, vel: 0.9 }, lead2: { ph: ['CT CT CT CT', 'r4 CT r4 CT'], inst: 'lowBrass', oct: -1, vel: 0.6, skip: 0.3 }, drums: { p: 'field', vel: 0.95 }, timp: 'two', choir: { n: 3, reg: [60, 76], vel: 0.6 }, choir2: { n: 3, reg: [38, 57], vel: 0.5 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.4 }, fill: 'bigS' },
      { n: 'B', bars: 16, cres: [0.9, 1.0], prog: 'IV V | iii vi | bVI bVII | I I | IV V | iii vi | bVI bVII | V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.85, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B1 B2 B1 CD', 'B1 B2 B2 CD'], oct: -1, vel: 0.95 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.5 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.8 }, choir2: { n: 3, reg: [38, 57], vel: 0.7 }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.42 }, fill: 'bigS' },
      { n: 'T', bars: 16, lv: 0.6, prog: 'vi IV | I V | vi ii | V I | vi IV | I V | ii V | I I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.65 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { p: 'whole', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.7 },
        lead: { ph: ['T1 T2 T1 T2', 'T1 T2 A1 CD', 'r4 T1 T2 CD'], oct: -1, vel: 0.75 }, arp: { p: 'up8', vel: 0.3, reg: [55, 81], skip: 0.3 }, drums: { bd: 'X...............', sn: ['x...............', 'o...o...........', 'x...............', 'o.o.o.o.o.o.xxxx'], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [72, 96], vel: 0.4 } },
      { n: 'D', bars: 8, lv: 0.48, prog: 'ii:2 V:2 | iii:2 vi:2', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { p: 'whole', inst: 'deep' },
        lead: { ph: ['HY HY2', 'r4 HY2', 'HY r4'], oct: -1, vel: 0.6 }, arp: { p: 'up8', vel: 0.28, reg: [57, 81], skip: 0.3 }, choir2: { n: 3, reg: [38, 55], vel: 0.5, soft: true }, bell: { dens: 0.14, res: 1, reg: [72, 96], vel: 0.44 }, rise: 2 },
      { n: 'R', bars: 8, lv: 1.04, hit: 'tam', cr: true, prog: 'bVI bVII | I I | IV V | I I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.95, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B1 CD', 'B2 CD'], oct: -1, vel: 1.0 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.55 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.9 }, choir2: { n: 3, reg: [38, 57], vel: 0.8 }, bell: { dens: 0.18, res: 2, reg: [72, 96], vel: 0.5 }, fill: 'bigS' },
      { n: 'E', bars: 8, lv: 0.68, prog: 'I IV I V | vi IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [38, 55], vel: 0.55, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.08 }, vel: 0.8 },
        lead: { ph: ['A1 CD', 'A2 CD'], oct: -1, vel: 0.75 }, drums: { p: 'field', vel: 0.7 }, choir: { n: 3, reg: [60, 76], vel: 0.45 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.38 } },
    ],
  });

  // The council chamber is rarely open for more than a minute, so it plays an abbreviated, ceremonial reading of the procession: the same
  // composition with the long sections halved (phrase lists and progressions truncate with them) and forms that reach the big phrase within
  // the first quarter minute — but with the pomp of the chamber: a tam-tam and a timpani roll under a brass fanfare on the call, the organ
  // instead of the strings, the horn section and the brass doubling the solo horn, timpani on the step, the choir forward, a brighter room.
  (function () {
    const d = JSON.parse(JSON.stringify(Music._tracks.procession)); delete d._p; delete d.id;
    d.desc = 'Galactic Council: the procession in state — the same march, abbreviated and ceremonial: tam-tam and timpani under a brass fanfare on the call, the organ of the chamber, horns and brass doubling the theme, the big phrase within the first quarter minute, the hymn while the votes are cast, the full chamber for the result';
    d.bpm = 78; d.tone = { lo: 1.0 }; d.fx = { stage: 0.8, verb: 1.25 }; d.sends = { drums: { stage: 0.15, verb: 0.08, dly: 0 } };
    d.mix = Object.assign({}, d.mix, { choir: 1.3, lead: 1.1, drums: 1.0, pad: 1.1 });
    d.forms = [['B', 'A1', 'R', 'D', 'E'], ['B', 'A2', 'D', 'R', 'E'], ['A1', 'B', 'R', 'T', 'E'], ['B', 'T', 'A2', 'R', 'E']];
    for (const s of d.sec) {
      if (s.n === 'A1' || s.n === 'A2' || s.n === 'B' || s.n === 'T') s.bars = 8;
      if (s.pad && s.pad.inst === 'strings') s.pad = { p: 'sus', inst: 'organ', n: 4, reg: [50, 76], vel: 0.8, width: 1.3 };      // the chamber's organ carries the harmony, spread wide
      else if (s.pad) s.pad.width = 1.3;
      if (s.choir) s.choir.vel = Math.min(1.0, (s.choir.vel || 0.6) * 1.2);
      if (s.n === 'A1') { s.lead2 = { ph: '@', inst: 'horn', oct: -1, vel: 0.45 }; s.timp = 'two'; }
      if (s.n === 'A2') s.timp = 'two';
      // the military orchestra: a sustained brass-section bed under the big phrase and the result (the low brass keeps the step), cymbals on the entries
      if (s.n === 'B') { s.lead2 = { ph: '@', inst: 'brass', oct: -1, vel: 0.5 }; s.timp = 'beats'; s.pad2 = { p: 'sus', inst: 'brass', n: 4, reg: [45, 69], vel: 0.55, width: 1.3 }; s.bass = { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 }; s.cr = true; }
      if (s.n === 'R') { s.lead2 = { ph: '@', inst: 'brass', oct: -1, vel: 0.6 }; s.bell = { dens: 0.22, res: 2, reg: [72, 96], vel: 0.5 }; s.pad2 = { p: 'sus', inst: 'brass', n: 4, reg: [45, 69], vel: 0.65, width: 1.3 }; s.choir2 = { n: 3, reg: [38, 57], vel: 0.85 }; s.cr = true; }
      if (s.n === 'A2') { s.pad2 = { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 3, reg: [38, 57], vel: 0.8, gate: 0.7 }; s.choir2 = { n: 3, reg: [38, 57], vel: 0.6 }; }
      if (s.n === 'intro') {
        s.bars = 4; s.cres = [0.7, 0.92]; s.hit = 'tam'; s.prog = 'I:2 V:2';
        s.pad = { p: 'swell', inst: 'organ', n: 4, reg: [50, 76], vel: 0.85 }; s.pad2 = { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.6 }; s.arp = undefined;
        s.bass = { p: 'whole', inst: { p: 'lowBrass', att: 0.08 }, vel: 0.9 };
        s.lead = { ph: ['CL', 'r1 CL'], inst: 'brass', oct: -1, vel: 0.85 }; s.lead2 = { ph: '@', inst: 'horn', oct: -1, vel: 0.55 };
        s.timp = { p: 'two', roll: 2 }; s.choir = { n: 3, reg: [60, 76], vel: 0.55 };
        s.drums = { bd: 'X.......x.......', sn: ['o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'X.o.x.o.x.o.x.o.', 'X.x.x.x.x.x.xxxx'] };
      }
    }
    d.loopFrom = 'A1';
    Track('council2', d);
  })();

  Track('orion', {
    desc: 'Ancient and mysterious, awe: deep drones, metallic chimes and a double-harmonic melody',
    bpm: 54, trim: 3.19, root: 'D', mode: 'dblHarm', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'B', 'C', 'A1', 'A3'], ['A1', 'B', 'A2', 'C', 'A3', 'A1', 'B', 'C', 'A3']],
    inst: { pad: 'drone', bass: 'deep', lead: 'harp', lead2: 'chime', bell: 'chime', choir: 'ooh' },
    ph: {
      O1: '5:4 | 3:2 2:2! | 1:3! 2:1 | 4:4',
      O2: '6:3 5:1 | 4:4 | 3:2 5:2 | 1:4',
      O3: '8:2 6:2 | 4:2 6:2 | 6:3 4:1 | 2:4',
      O4: '3:2 5:2 | 8:3 5:1 | 6:4 | 1:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'I:4', hit: true, pad: { p: 'sus', n: 3, reg: [38, 57], vel: 0.9 }, bell: { dens: 0.3, res: 1, reg: [62, 86], vel: 0.55 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: 'O1 O2', bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.8 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A2', bars: 8, lv: 0.72, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: 'O1 O2', choir: { v1: 'o', v2: 'u', vel: 0.6 }, bell: { dens: 0.25, res: 1, reg: [62, 86], vel: 0.5 }, timp: { p: 'hits', vel: 0.5, dur: 3 } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bII:2 I:2 bII:1 I:1', pad: { p: 'sus', n: 3, reg: [38, 57] }, bass: 'whole', lead: { ph: 'O3 O4', inst: 'flute', vel: 0.8 }, lead2: { ph: 'O3 O4', inst: 'chime', oct: 0, vel: 0.35 }, choir: { v1: 'a', v2: 'o', vel: 0.75 }, timp: 'two', drums: { whisper: 'x...............' } },
      { n: 'C', bars: 8, lv: 0.45, prog: 'I:2 bII:2 I:2 iv:2', pad: { p: 'swell', n: 3, reg: [38, 57] }, bass: false, lead: false, bell: { dens: 0.35, res: 1, reg: [62, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, drums: { whisper: ['x...............', '................', 'x...............', '................'] }, timp: false, rise: 1 },
      { n: 'A3', bars: 8, lv: 0.95, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', inst: 'dark', n: 4, reg: [40, 62] }, bass: 'half', lead: { ph: 'O1 O2', inst: 'horn', vel: 0.8, harm: -2 }, lead2: { ph: 'O1 O2', inst: 'chime', oct: 0, vel: 0.35 }, choir: { v1: 'a', v2: 'a', vel: 0.9 }, timp: 'beats', drums: { kick: 'x...............', metal2: '................' }, bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.5 } },
    ],
  });

  Track('antarans', {
    desc: 'Menacing and dissonant: tritone brass, cluster chords, whispers and metal hits in an unsettled 5/4',
    bpm: 72, trim: 2.6, meter: 5, root: 'C#', mode: 'octaH', loopFrom: 'A1', lintMin: 0.7, tens: { x1: false },
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'D', 'A1', 'B', 'C', 'A2', 'D', 'A3'], ['A1', 'B', 'A2', 'C', 'D', 'A3', 'A1', 'C', 'B', 'A2', 'A3', 'D']],
    inst: { pad: 'dark', bass: 'moog', lead: 'horn', lead2: 'brass', arp: 'seq', bell: 'chime', choir: 'uuh' },
    ph: {
      X1: '1:3 2:2! | 1:3 5:2! | 2:3 1:2! | 2:5',
      X2: '1:3 5:2! | 6:3 5:2! | 5:3 8:2 | 5:5',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'icl:2 i:2', hit: true, pad: { p: 'swell', n: 4, reg: [36, 60] }, drums: { whisper: ['x.........', '..........'], t5: 'X.........' } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..x.......', click3: 'o.o.o.o.o.', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', t4: '..o...o...', metal2: '..x...x...', click3: 'o.o.o.o.o.', hat: 'o.o.o.o.o.' }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X1 X2', choir: { v1: 'u', v2: 'o', vel: 0.5 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'icl:1 bII:1 io:1 bV:1 icl:1 bII:1 io:1 V:1', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', snare: '..........', metal2: 'x.x.x.x.x.', click3: 'o.o.o.o.o.', hat: 'x.x.x.x.x.' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X2 X1', inst: 'brass', harm: -3 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'icl:2 bII:2 io:2 V:2', pad: { p: 'swell', n: 4, reg: [36, 60] }, bass: false, drums: { whisper: ['x.........', '..........', 'x.........', '..........'], whisper2: ['..........', '......x...', '..........', '......x...'] }, bell: { dens: 0.3, res: 1, reg: [60, 84], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, rise: 2 },
      { n: 'A3', bars: 8, lv: 1.0, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', metal2: 'o.o.o.o.o.', hat: 'x.x.x.x.x.', snare: '......x...' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X1 X2', inst: 'brass', harm: -3 }, choir: { v1: 'a', v2: 'o', vel: 0.8 }, fill: 'tom' },
      { n: 'D', bars: 8, lv: 0.7, prog: 'i:2 bII:2 icl:2 io:2', pad: { p: 'sus', n: 4, reg: [36, 60] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..o.......', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X2 X1' },
    ],
  });

  Track('victory', {
    desc: 'Triumphant: brass fanfares, rolling timpani and a soaring major theme',
    quotes: ['procession'],
    bpm: 100, trim: 1.69, root: 'D', mode: 'major', loopFrom: 'A1',
    forms: [['A1', 'B', 'A2', 'C', 'echo', 'B2', 'D', 'A3', 'C', 'A1', 'B', 'A2', 'D', 'B2', 'A3', 'C', 'A3'], ['A1', 'C', 'echo', 'B', 'A2', 'D', 'B2', 'A3', 'A1', 'B', 'C', 'A2', 'B2', 'D', 'A3', 'C', 'A3']],
    inst: { pad: 'strings', bass: 'sub', lead: 'brass', lead2: 'bell', arp: 'arp', bell: 'glass', choir: 'aah' },
    ph: {
      PA: '@procession.A1', PB: '@procession.A2',                            // the second leitmotif: the commonwealth's oboe tune, the horns' at the victory
      V1: '5:1 8:1 10:2 | 9:1.5 8:.5 7:1 5:1 | 10:1.5 8:.5 6:2 | 4:1 6:1 8:2',
      V2: '8:1.5 10:.5 12:2 | 12:1.5 11:.5 9:1 7:1 | 11:1.5 10:.5 8:2 | 7:2 9:2',
      V3: '11:1.5 10:.5 8:2 | 9:2 7:2 | 8:3 5:1 | 8:4',
      VB: '10:2 8:2 | 11:2 8:2 | 10:2 5:2 | 7:2 9:2',
      VC: '10:2 8:2 | 11:2 8:2 | 9:2 7:2 | 8:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.75, prog: 'I:2 V:2', hit: true, pad: 'sus', bass: 'whole', timp: { p: 'roll', roll: 1 }, lead: { ph: 'r1 V1', inst: 'brass' }, drums: false },
      { n: 'A1', bars: 8, lv: 0.85, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: 'V1 V2', timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'B', bars: 8, lv: 0.78, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'horn' }, choir: { v1: 'o', v2: 'a', vel: 0.8 }, timp: 'two', bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V1 V3', harm: -2 }, lead2: { ph: 'V1 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.7 }, arp: { p: 'up', vel: 0.3, reg: [57, 83] }, fill: 'roll' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { v1: 'a', v2: 'o', vel: 0.8 }, bell: { dens: 0.35, res: 2, reg: [72, 93], vel: 0.55 }, timp: { p: 'hits', roll: 1 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'brass', harm: -2 }, lead2: { ph: 'VB VC', inst: 'bell', oct: 1, vel: 0.4 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'D', bars: 8, lv: 0.9, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: { ph: 'V1 V2', inst: 'horn' }, timp: 'two', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.5 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 1.05, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V2 V3', harm: -2 }, lead2: { ph: 'V2 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], hat: 'x.x.x.x.x.x.x.x.' }, choir: { vel: 0.9 }, arp: { p: 'up', vel: 0.3, reg: [57, 83], jump: 0.1 }, fill: 'roll' },
      { n: 'echo', bars: 8, lv: 0.88, prog: 'I I IV V | I vi IV V', pad: 'sus', bass: 'half', lead: { ph: 'PA PB', inst: 'horn', vel: 0.92, shape: 0.3 }, lead2: { ph: 'r4 PA', inst: 'tpts', oct: 1, vel: 0.5, shape: 0.3 }, timp: 'two', choir: { vel: 0.6 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },   // the second leitmotif: the commonwealth's tune in the horns, the trumpets answering
    ],
  });

  Track('defeat', {
    desc: 'Somber defeat: slow falling lines, mourning strings and a lone bell',
    bpm: 56, trim: 2.73, root: 'F', mode: 'minor', loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'E', 'C', 'A1', 'E'], ['A1', 'B', 'A2', 'C', 'E', 'A3', 'C', 'A1', 'E']],
    inst: { pad: 'strings', bass: 'deep', lead: 'flute', lead2: 'glass', bell: 'glass', choir: 'uuh' },
    ph: {
      L1: '5:2 3:1 1:1 | 6:2 4:1 3:1 | 5:2 3:1 5:1 | 7:2 5:2',
      L2: '6:2 4:1 6:1 | 5:2 3:2 | 7#:2 5:2 | 3:2 1:2',
      L3: '8:3 7:1 | 6:2 5:2 | 5:2 3:1 5:1 | 3:4',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'i:2 bVI:2', pad: { p: 'swell' }, bell: { dens: 0.25, res: 1, reg: [60, 84], vel: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.55, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'glass', vel: 0.7 }, timp: { p: 'hits', vel: 0.4, dur: 3 } },
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', vel: 0.75 }, choir: { vel: 0.55 }, timp: { p: 'hits', vel: 0.4, dur: 3 }, bell: { dens: 0.2, res: 1, reg: [72, 93], vel: 0.45 } },
      { n: 'B', bars: 8, lv: 0.8, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'L3 L2', inst: 'horn', vel: 0.8 }, choir: { v1: 'o', v2: 'a', vel: 0.75 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.42, prog: 'bVI:2 iv:2 i:2 V:2', pad: { p: 'swell' }, bass: false, lead: false, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', harm: -2, vel: 0.7 }, lead2: { ph: 'L1 L2', inst: 'bell', oct: 1, vel: 0.35 }, choir: { vel: 0.6 }, timp: { p: 'hits', vel: 0.4, dur: 3 } },
      { n: 'E', bars: 8, lv: 0.45, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L3 L2', inst: 'glass', vel: 0.65 }, bell: { dens: 0.2, res: 1, reg: [72, 93], vel: 0.4 } },
    ],
  });

  // ================================================================== espionage (spy panels borrow the music, see js/ui/spyscenes.js)
  Track('spy', {
    desc: 'Espionage: noir intrigue — walking sub-bass, clock ticks and rim clicks, muted horn phrases, hushed pads in harmonic minor',
    tags: { solitude: 0.2, contact: 0.5, tension: 0.8, war: 0.6, grief: 0.2, grandeur: 0.2, energy: 0.6, dark: 0.7 },
    bpm: 94, trim: 1.87, root: 'C', mode: 'harmonic', loopFrom: 'A1', tens: false,
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'E', 'C', 'A1', 'B', 'A2', 'E', 'A3', 'C', 'E', 'A1'], ['A1', 'B', 'A2', 'C', 'E', 'A3', 'A1', 'C', 'B', 'A2', 'E', 'A3', 'C', 'A1', 'E']],
    inst: { pad: 'dark', bass: 'deep', lead: 'horn', lead2: 'vibes', arp: 'pizz', bell: 'vibes', choir: 'uuh' },
    ph: {
      Y1: '5:1.5 6:.5 5:1 3:1 | 1:2 2:1 1:1 | 4:1.5 3:.5 2:1 7:1 | 1:3 r:1',
      Y2: '3:1.5 5:.5 6:1 5:1 | 8:2 10:2 | 6:1.5 5:.5 4:1 3:1 | 2:2 7:2',
      Y3: '8:1 7:1 6:2 | 6:1 5:1 4:2 | 3:2 8:2 | 10:4',
      Y4: '6:4 | 4:2 2:2 | 7:4 | 2:2 7:2',
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 iv:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'half', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', lead2: { ph: 'Y1 Y2', inst: 'vibes', oct: 1, vel: 0.35 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', shk: '..o...o...o...o.' } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bVI:2 iiø:2 V7:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y3 Y4', inst: 'brass', vel: 0.75 }, choir: { v1: 'u', v2: 'o', vel: 0.45 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......' } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVI:2 iv:2 V7:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'whole', lead: false, bell: { dens: 0.25, res: 1, reg: [67, 88], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, drums: { click3: 'x...x...x...x...', whisper2: ['................', '........x.......'] } },
      { n: 'A3', bars: 8, lv: 0.82, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y2 Y1', harm: -2 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......', shk: '..o...o...o...o.' } },
      { n: 'E', bars: 8, lv: 0.6, prog: 'i iv i V7 | i bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'half', lead: 'Y1 Y4', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
    ],
  });

})(window.MOO);
