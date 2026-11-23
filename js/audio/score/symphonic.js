// Master of Orion — Reborn · the score · the symphonic rewrite (loaded last)
// The score rewritten piece by piece in what the concert suite learned (tools/concert/README.md): every section in a register of its own
// (the sub under 60 Hz, the basses, the cellos from G2, the violas and the horns, the men's chords from C3, the violins, the trumpets on
// top); a legato tune over a short motor with a counter-melody moving in its gaps; the texture built a layer at a time to the full
// orchestra and broken apart again, the full orchestra only at the peaks; the accompaniment under the tune. The profile that plays it
// (the concert stage, pure-tuned chords, the professional ensemble, the clean master) is js/audio/music.js's symphonize.
// Each piece here replaces the one of the same id (its role in the programme kept: its tags, its motif, its era window); only when the
// symphonic profile is on — `?symphonic=0` plays the whole score as it was. Each one passes tools/concert/piece.js before it is here.
(function (M) {
  'use strict';
  const A = M.Audio, Music = A.Music, Track = Music._define;
  if (!A.symphonic) return;
  const T = id => JSON.parse(JSON.stringify(Music._tracks[id], (k, v) => (k === '_p' || k === '_sym' ? undefined : v)));
  const KEEP = ['tags', 'motif', 'motifInst', 'eraWin', 'gentle', 'eraSens', 'interlude', 'bridge', 'hidden', 'variantOf'];   // a piece's role in the programme
  // BAL: each piece's balance by section, measured (tools/concert/balance.js --write): { id: { section: { bus: gain } } } — the
  // accompaniment kept under the tune (figures 10 dB, beds 5, the bass line 6, the voices 4, the percussion 8 under the whole)
  const BAL = {
    'galaxy17': {theme: {pad: 0.61, bass: 0.265}, talk: {pad: 0.679, bass: 0.256}, canon2: {bass: 0.295, pad: 0.883}, canon3: {pad: 0.57, bass: 0.296}, still: {pad: 0.263, choir: 0.745}, canon3b: {pad: 0.405, bass: 0.232}, E: {bass: 0.295, pad: 0.748}},
    'galaxy18': {A1: {arp: 0.09, pad: 0.398, bass: 0.424}, A2: {arp: 0.098, pad: 0.424, bass: 0.45}, B: {arp: 0.156, pad: 0.598, bass: 0.562}, breath: {arp: 0.1, pad: 0.506}, A3: {arp: 0.112, bass: 0.448, pad: 0.846}, crest: {arp: 0.184, bass: 0.211, pad: 0.73, choir: 0.791}, E: {arp: 0.156, bass: 0.575, pad: 0.92}},
    'galaxy19': {call: {bass: 0.61}, ch1: {pad: 0.716, bass: 0.192}, str: {arp: 0.096, bass: 0.606, pad: 0.756}, ch2: {pad: 0.704, bass: 0.391, choir: 0.921}, ch3: {pad: 0.663, bass: 0.619, choir: 0.761}},
    'galaxy11': {drift1: {arp: 0.378, pad: 0.376, bass: 0.344}, drift2: {arp: 0.205, bass: 0.28, pad: 0.576}, rise: {arp: 0.248, pad: 0.312, bass: 0.585, choir: 0.432}, breath: {pad: 0.242, choir: 0.99}, drift3: {arp: 0.275, bass: 0.254, pad: 0.577}},
    'galaxy23': {A1: {arp: 0.168, choir: 0.881}, A2: {arp: 0.23, bass: 0.396, choir: 0.921, pad: 0.98}, E: {arp: 0.152, choir: 0.91}},
  };
  function piece(id, def) {
    const old = Music._tracks[id]; if (old) for (const k of KEEP) if (def[k] === undefined && old[k] !== undefined) def[k] = JSON.parse(JSON.stringify(old[k]));
    const b = BAL[id]; if (b) for (const sec of def.sec || []) if (b[sec.n]) sec.mixK = Object.assign({}, sec.mixK || {}, b[sec.n]);
    delete def.id; Track(id, def); return def;
  }
  const E16 = '................';
  const at = (bars, hits) => Array.from({ length: bars }, (_, i) => hits[i] || E16);   // a drum part that strikes only in the bars named
  // the pipe organ at the back of the hall: a 16-foot pedal in the sub, and the manuals where asked
  const ORGAN = (pedal, manual) => Object.assign({ pad3: { p: 'sus', inst: { p: 'organ', rel: 0.9 }, root: true, n: 1, reg: [24, 36], vel: pedal } },
    manual ? { choir3: { p: 'sus', inst: { p: 'organ', rel: 0.9 }, n: 4, reg: [55, 76], vel: manual } } : {});
  const RUN = 'r:2 5:.25! 6:.25! 7:.25! 8:.25! 9:.25! 10:.25! 11:.25! 12:.25!';   // the run up into an arrival (strings, the flute above)

  // =====================================================================================================================================
  // The main theme (the menu, the title, now and then on the map): the title's own material and the score's two leitmotifs
  // =====================================================================================================================================
  const TP = Music._tracks.title.ph;   // the title's phrases (the commonwealth's tune, the interlude, the rise, the resolution)
  piece('title', {
    desc: 'Main theme: a fanfare on the hymn\'s call; the commonwealth\'s tune as a question on the cor anglais; the cello\'s interlude; the motor and the foundation built a layer at a time; the hymn legato in the horns over them, a counter-melody in its gaps; everyone for its second half; a lyrical middle in G broken apart; the return gathering; the commonwealth\'s tune in full; the rise and the resolution; an amen',
    bpm: 58, root: 'D', mode: 'major', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 1.3, subBass: 0.4, bassC: 40, loopFrom: 'question',
    mix: { lead: 1.4, pad: 1.0, choir: 1.2, arp: 0.85, bell: 0.9, bass: 0.75, drums: 0.7 },
    inst: { pad: 'strings', pad2: 'cellos', bass: 'deep', lead: 'horn', lead2: 'strings', arp: 'strOst', bell: 'glass', choir: 'choirOoh', choir2: 'choirMen' },
    quotes: ['hymn', 'procession'],
    ph: Object.assign({}, TP, {
      K: '@hymn.K', KH: '5:3 8:1 | 7:2 6:2', KE: '5:3 8:1 | 5:4',   // the call; its head; its rising fourth closing home
      H1: '@hymn.H1', H2: '@hymn.H2', H3: '@hymn.H3', H4: '@hymn.H4',
      CT: '1:2 3:2 | 5:2 3:2 | 4:2 6:2 | 5:4', CT2: '4:2 6:2 | 4:2 6:2 | 5:2 7:2 | 8:4',
      RUN, AM: '6:4 | 6b:4', AMt: '8:4 | 8:4', FIN: '5:16', FINt: '8:16',
    }),
    sec: [
      // the fanfare: the call in the brass over a timpani roll, the whole orchestra on its first chord, then the hall
      { n: 'fanfare', bars: 4, bpm: 72, bpmTo: 60, cres: [1.0, 0.7], prog: 'I | V:.5 IV:.5 | I | I',
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.7 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.2, rel: 2.5 }, vel: 0.9 },
        lead: { ph: 'K', inst: 'tpts', vel: 0.95 }, lead2: { ph: 'K', inst: 'horn', oct: -1, vel: 0.85 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.6 }, timp: { p: 'hits', vel: 0.75, roll: 1 },
        drums: { crashS: at(4, { 0: 'x...............' }), tam: at(4, { 0: 'x...............' }) } },
      // the question: the commonwealth's tune on the cor anglais, alone over the strings, the cellos and the men humming
      { n: 'question', bars: 8, cres: [0.26, 0.42], prog: 'I I IV I | I I IV V',
        pad: { p: 'swell', n: 3, reg: [55, 74], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.7, inst: { p: 'deep', att: 2, rel: 2.5 } }, choir2: { inst: 'choirHum', n: 2, reg: [55, 67], vel: 0.3, soft: true },
        lead: { ph: 'PA PB', inst: { p: 'reed', lvl: 0.55 }, vel: 0.9 } },
      // the interlude: the cello's brooding theme, the harp touching the chords
      { n: 'interlude', bars: 8, cres: [0.38, 0.5], prog: 'vi IV I V | vi IV ii V',
        pad: { p: 'swell', inst: 'violas', n: 3, reg: [52, 67], vel: 0.5 }, bass: { pat: '1---', vel: 0.75, inst: { p: 'deep', att: 1.2, rel: 2.4 } },
        lead: { ph: 'I1', inst: 'vcSolo', oct: -1, vel: 0.9 }, arp: { inst: 'harp', pat: '0...2...1...2...', res: 2, vel: 0.14, reg: [55, 76] } },
      // the build, a layer at a time: the strings' spiccato motor alone, then the low brass's foundation beneath
      { n: 'motor1', bars: 2, bpm: 76, lv: 0.6, prog: 'I I', arp: { pat: '0.120.120.120.12', res: 4, vel: 0.26, reg: [55, 69] }, drums: { sn: 'o...o...o...o.o.', vel: 0.4 } },
      { n: 'motor2', bars: 2, bpm: 76, lv: 0.68, prog: 'I V', arp: { pat: '0.120.120.120.12', res: 4, vel: 0.26, reg: [55, 69] },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06, cut: 1800 }, vel: 0.66 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.6, gate: 0.7, open: true },
        timp: { p: 'two', vel: 0.4 }, drums: { bd: 'x.......x.......', sn: 'o...o...o...o.xx', vel: 0.5 } },
      // the theme: the hymn, broad and legato in the horns, over the motor and the foundation; the flute's counter-melody in its gaps
      { n: 'theme1', bars: 8, bpm: 76, lv: 0.78, prog: 'I | V:.5 IV:.5 | I | ii:.5 V:.5 | I | ii:.5 I/III:.5 | vi:.5 V:.5 | I',
        arp: { pat: '0.120.120.120.12', res: 4, vel: 0.24, reg: [55, 69] }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06, cut: 1800 }, vel: 0.68 },
        pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.6, gate: 0.7, open: true },
        lead: { ph: 'H1 H2', inst: 'horn', vel: 0.92 }, bell: { ph: '@counter', inst: 'flute', reg: [74, 88], vel: 0.4 },
        timp: { p: 'two', vel: 0.4 }, drums: { p: 'field', vel: 0.5 } },
      // everyone: the hymn's second half, the trumpets on the tune above the horns, the violins' own counter-melody high, the choir
      { n: 'theme2', bars: 8, bpm: 76, cres: [0.92, 1.04], prog: 'I iii vi V | IV I/III V I',
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.55 }, arp: { pat: '0123210123210123', res: 4, vel: 0.24, reg: [55, 72] },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05, cut: 1800 }, vel: 0.72 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 2, reg: [45, 58], vel: 0.72, gate: 0.65, open: true },
        lead: { ph: 'H3 H4', inst: 'tpts', vel: 0.95 }, lead3: { ph: 'H3 H4', inst: 'horn', oct: -1, vel: 0.85 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.5 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.75 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.6 },
        timp: { p: 'beats', vel: 0.5 }, drums: { p: 'field', vel: 0.62, crashS: at(8, { 0: 'x...............' }) } },
      // the lyrical middle in G, broken apart: the interlude's answer on the oboe, the harp, the strings softly
      { n: 'lyric1', bars: 8, key: 'G', bpm: 66, lv: 0.5, prog: 'IV V iii vi | IV I V I',
        pad: { p: 'sus', n: 3, reg: [55, 72], vel: 0.22 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.22, open: true }, bass: { p: 'whole', inst: { p: 'deep', att: 0.5 }, vel: 0.6 },
        lead: { ph: 'I2', inst: 'oboe', vel: 0.8 }, arp: { inst: 'harp', pat: '0.2.1.2.', res: 2, vel: 0.05, reg: [55, 79] } },
      // the same in the violins in octaves, the horn's counter-line in their gaps, the women humming
      { n: 'lyric2', bars: 8, key: 'G', bpm: 66, cres: [0.56, 0.7], prog: 'vi IV I V | vi IV ii V',
        pad: { p: 'sus', inst: 'violas', n: 3, reg: [52, 67], vel: 0.45 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.45, open: true }, bass: { p: 'whole', inst: { p: 'deep', att: 0.5 }, vel: 0.72 },
        lead: { ph: 'I1', inst: 'strings', vel: 0.75 }, lead2: { ph: '@', inst: 'cello', oct: -1, vel: 0.55 }, lead3: { ph: '@counter', inst: 'hornIowa', reg: [50, 64], vel: 0.42 },
        choir: { inst: 'choirOoh', n: 3, reg: [64, 76], vel: 0.26, soft: true }, arp: { inst: 'harp', pat: '0.2.1.2.', res: 2, vel: 0.1, reg: [55, 79] } },
      // the return gathers: the dominant of D, the call's head in the trumpets and the horns, the rolls, the run up into the theme
      { n: 'gather', bars: 4, bpm: 66, bpmTo: 74, cres: [0.7, 1.0], prog: 'V7sus4 V | V7sus4 V',
        pad: { p: 'sus', inst: 'strTrem', n: 4, reg: [55, 79], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.1 }, vel: 0.8 },
        lead: { ph: 'KH KH', inst: 'tpts', vel: 0.85 }, lead2: { ph: 'KH KH', inst: 'horn', oct: -1, vel: 0.72 }, lead3: { ph: 'r3 RUN', inst: 'strings', vel: 0.62 }, lead4: { ph: 'r3 RUN', inst: 'flute', oct: 1, vel: 0.5 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.6 }, timp: { p: 'hits', vel: 0.6, roll: 2 }, drums: { snRoll: at(4, { 2: 'x...............', 3: 'x.......x.......' }), vel: 0.5 } },
      // the commonwealth's tune in full: the horns and the trumpets, the violins' counter-melody, the motor, the choir
      { n: 'grand', bars: 8, bpm: 74, cres: [1.0, 1.06], prog: 'I I IV V | I vi ii V',
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.55 }, arp: { pat: '0.120.120.120.12', res: 4, vel: 0.26, reg: [55, 69] },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05, cut: 1800 }, vel: 0.75 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.8, gate: 0.8, open: true },
        lead: { ph: 'PA PB', inst: 'horn', vel: 1.0 }, lead4: { ph: 'PA PB', inst: 'tpts', oct: 1, vel: 0.5 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.5 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.85 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.65 },
        timp: { p: 'two', vel: 0.55 }, drums: { p: 'field', vel: 0.62, crashS: at(8, { 0: 'x...............' }) } },
      // the rise and the resolution: the title's own climax, broad, the choir open, the organ's pedal beneath
      { n: 'rise', bars: 8, bpm: 70, cres: [1.04, 1.1], prog: 'I IV I V | IV I vi V',
        pad: { p: 'sus', n: 4, reg: [57, 81], vel: 0.6 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3 }, vel: 0.8 },
        ...ORGAN(0.5, 0), arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.24, reg: [50, 62] },
        lead: { ph: 'RISE', inst: 'tpts', vel: 0.92 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.85 }, lead3: { ph: 'RISE', inst: 'choirMenAhNew', oct: -1, vel: 0.8 },
        choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.75 }, timp: { p: 'beats', vel: 0.5 }, drums: { crashS: at(8, { 0: 'x...............' }) } },
      { n: 'resolve', bars: 8, bpm: 70, bpmTo: 62, cres: [1.06, 0.9], prog: 'I IV I V | IV V I I',
        pad: { p: 'sus', n: 4, reg: [57, 81], vel: 0.58 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3 }, vel: 0.78 },
        ...ORGAN(0.5, 0), lead: { ph: 'RES', inst: 'horn', vel: 0.92 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.48 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.65 }, timp: { p: 'two', vel: 0.45 } },
      // the coda: the call once more over the amen — the subdominant turned minor — and the last chord held, the organ beneath
      { n: 'amen', bars: 4, bpm: 58, bpmTo: 50, cres: [0.85, 1.0], prog: 'IV iv | I I',
        pad: { p: 'sus', n: 4, reg: [57, 84], vel: 0.6 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.4, rel: 3 }, vel: 0.8 },
        ...ORGAN(0.6, 0), lead: { ph: 'AM r2', inst: 'horn', vel: 0.9 }, lead4: { ph: 'AMt r2', inst: 'tpts', vel: 0.65 }, lead2: { ph: 'r2 KE', inst: 'hornSolo', oct: -1, vel: 0.6 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.75 }, timp: { p: 'hits', vel: 0.55, roll: 1 } },
      { n: 'final', bars: 4, bpm: 40, cres: [1.08, 0.6], prog: 'I:4',
        pad: { p: 'sus', n: 4, reg: [57, 86], vel: 0.65, rel: 4 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55, rel: 3 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.2, rel: 4.5 }, vel: 0.85 },
        ...ORGAN(0.8, 0.45), lead: { ph: 'FIN', inst: 'horn', vel: 0.95 }, lead4: { ph: 'FINt', inst: 'tpts', vel: 0.7 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 1.0, rel: 4 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.85, rel: 4 },
        timp: { kick: ['X...............', E16, E16, E16], vel: 0.8 }, drums: { crashS: at(4, { 0: 'x...............' }), tam: at(4, { 0: 'x...............' }), bd: at(4, { 0: 'X...............' }) } },
    ],
  });
  // the menu's reading for a new game is the same theme (the fanfare opens it)
  piece('title:grand', Object.assign({}, T('title'), { hidden: true, desc: 'Main theme, for a new game: the same theme, the fanfare first' }));

  // =====================================================================================================================================
  // First Light (the early years): the concert suite's first movement, looping from the grey
  // =====================================================================================================================================
  piece('galaxy14', {
    desc: 'The early years, first light: one long day — the dark, the alto flute\'s dawn theme at the grey, the violin\'s reading with a clarinet beneath, a cloud in B-flat minor, the horns climbing in sequence into the sunrise, the hymn in horns and voices, its second half higher, the day, and dusk with the commonwealth\'s climb in a far horn',
    bpm: 52, root: 'Db', mode: 'major', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.2, subBass: 0.4, bassC: 40, loopFrom: 'grey',
    forms: [['grey', 'glow', 'cloud', 'rise', 'sunrise', 'zenith', 'day', 'dusk'], ['grey', 'glow', 'rise', 'sunrise', 'zenith', 'day', 'dusk']],
    mix: { lead: 1.45, pad: 1.0, bass: 1.05, choir: 1.25, arp: 0.85, bell: 0.9, drums: 0.7 },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'altoFluteIowa', lead2: 'clarinet', arp: { p: 'harp', rel: 3.5, hold: 2.2, cut: 4600 }, bell: 'glass', choir: 'choirOoh', choir2: 'choirMen' },
    quotes: ['hymn', 'procession', 'wonder'],
    ph: {
      DH: '1:4 | 3:2 5:2',                                                        // the dawn theme's head
      D1: '1:4 | 3:2 5:2 | 6:4 | 5:2 3:2', D2: '1:4 | 3:2 5:2 | 9:2 10:2 | 7:2 5:2', // the dawn theme: a climb up the chord, and back
      D5: '6:3 5:1 | 4:3 6:1 | 5:3 2:1 | 1:4',                                       // its close, home
      CV1: '5:4 | 7:4 | 8:4 | 6:2 8:2', CV2: '10:4 | 9:4 | 9:4 | 7:4',               // the counter-line beneath the violin (the clarinet)
      CL1: '5:3 6:1 | 5:2 3:2 | 4:3 3:1 | 2:4', CL2: '5:3 6:1 | 8:2 7:2 | 6:3 5:1 | 5:4',   // the cloud: the cellos in the relative minor
      CL3: '1:4 | 1:2 3:2 | 1:4 | 7#:4', CL4: '3:4 | 1:4 | 1:2 2:2 | 2:4',          // the clarinet's sigh against the cellos
      RS1: '3:1.5 4:.5 5:2 | 6:3 5:1 | 4:1.5 5:.5 6:2 | 7:4', RS2: '5:1.5 6:.5 8:2 | 10:3 9:1 | 8:1.5 7:.5 6:2 | 9:4',   // the climb in sequence: 3 5 6, 4 6 7, 5 8 10
      H1: '@hymn.H1', H2: '@hymn.H2', H3: '@hymn.H3', H4: '@hymn.H4',
      DS1: '10:4 | 12:4 | 13:4 | 12:4', DS2: '13:4 | 12:4 | 12:4 | 15:4',             // the descant over the hymn's second half
      DE: '1:4 | 3:2 2:2 | 3:8',
      D2r: '1:3 2:1 | 3:1.5 4:.5 5:2 | 9:2 10:1.5 9:.5 | 7:2 5:2',                    // the theme's answer, ornamented
      D1g: '1:2 3:1 5:1 | 8:3 7:1 | 6:2 4:1 6:1 | 5:4', D2g: '1:2 3:1 5:1 | 8:2 9:1 10:1 | 9:3 8:1 | 7:2 5:2',   // the violin's reading: the climb quickened
      D1d: '1:1.5 2:.5 3:1 5:1 | 5:3 3:1 | 6:2 8:1 6:1 | 5:4',                        // the oboe's, dancing
      NL: '8:4 | 7:4 | 6:4 | 6:2 5:2 | 5:4 | 3:4',                                    // the cellos' slow descent in the dark                                                    // the flute's last phrase, left on the third
      PAh: '1:3 2:1 | 3:2 5:2 | r:8',                                                // the commonwealth's climb (the second leitmotif's head)
      RUN: 'r:2 5:.25! 6:.25! 7:.25! 8:.25! 9:.25! 10:.25! 11:.25! 12:.25!',            // the run up into the arrival (strings, flute above)
    },
    sec: [
      // the dark: the pedal and the violas, a glimmer, the flute's first notes
      { n: 'night', pad3: { p: 'swell', inst: 'analog', n: 3, reg: [60, 79], vel: 0.3 }, bars: 6, cres: [0.24, 0.36], prog: 'IM7:2 IVM7/I:2 IM7:2',
        pad: { p: 'swell', n: 3, reg: [52, 65], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.4, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'cbSolo', att: 3, rel: 3 } }, choir2: { inst: 'choirHum', n: 2, reg: [60, 72], vel: 0.32, soft: true, att: 4 },
        bell: { dens: 0.06, res: 1, reg: [80, 96], vel: 0.3 }, lead: { ph: 'r4 DH', vel: 0.5, pan: -0.1 } },
      // the grey: the dawn theme whole
      { n: 'grey', pad3: { p: 'swell', inst: 'analog', n: 3, reg: [60, 79], vel: 0.3 }, bars: 8, cres: [0.36, 0.48], prog: 'IM7:2 IVM7:2 | IM7:2 V:2',
        pad: { p: 'sus', n: 3, reg: [52, 67], vel: 0.32 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.4, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'deep', att: 1.6, rel: 2.8 } }, arp: { pat: '0...2...1...2...', res: 2, gate: 2.4, vel: 0.18, reg: [55, 74] },
        bell: { dens: 0.06, res: 1, reg: [80, 96], vel: 0.3 }, lead: { ph: 'D1 D2', vel: 0.55, pan: -0.1 } },
      // the glow: the theme in the solo violin an octave up, the clarinet's counter-line beneath, the strings and the harp rolling
      { n: 'glow', bars: 8, bpm: 54, cres: [0.48, 0.62], prog: 'IM7:2 IVM7:2 | IM7:2 V:2',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [55, 74], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.85, inst: { p: 'deep', att: 1.2, rel: 2.4 } }, arp: { pat: '0.2.1.2.', res: 2, gate: 2.4, vel: 0.1, reg: [55, 79] },
        lead: { ph: 'D1 D2', inst: 'vlnSolo', oct: 1, vel: 0.6, pan: 0.05 }, lead2: { ph: 'CV1 CV2', oct: -1, vel: 0.5, pan: -0.25 },
        choir: { n: 2, reg: [64, 77], vel: 0.24, soft: true } },
      // the cloud: B-flat minor, the cellos singing, the strings trembling, the clarinet sighing against them
      { n: 'cloud', bars: 8, key: 'Bb', mode: 'minor', bpm: 56, cres: [0.5, 0.64], prog: 'i i iv V | i bVI iv V',
        pad: { p: 'swell', inst: 'strTrem', n: 3, reg: [57, 74], vel: 0.38 }, pad2: { p: 'stab', inst: 'violas', pat: 'x..x..x.x..x..x.', n: 3, reg: [50, 64], vel: 0.42, gate: 0.85 },
        bass: { pat: '1---', vel: 0.65, inst: { p: 'deep', att: 0.8, rel: 2.2 } }, lead: { ph: 'CL1 CL2', inst: 'cello', oct: -1, vel: 0.78, pan: 0.15 },
        lead2: { ph: 'CL3 CL4', oct: 0, vel: 0.42, pan: -0.25 }, choir2: { inst: 'choirMen', n: 3, reg: [50, 62], vel: 0.3, soft: true }, timp: { p: 'hits', vel: 0.22, roll: 1 } },
      // the rise: home again, the climb in sequence in the horns, the voices entering, pressing forward into the light
      { n: 'rise', arp2: { inst: 'arpSawSyn', pat: '01230123', res: 2, vel: 0.15, reg: [55, 74] }, bars: 8, bpm: 56, bpmTo: 62, cres: [0.62, 0.95], prog: 'vi7 IVM7 | ii7 V | vi7 IVM7 | II7 V7sus4:.5 V:.5',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [55, 76], vel: 0.5 }, pad2: { p: 'sus', n: 2, reg: [43, 57], vel: 0.45, open: true },
        bass: { pat: '1---', vel: 0.55, inst: { p: 'deep', att: 0.6, rel: 1.8 } },
        lead: { ph: 'RS1 RS2', inst: 'horn', oct: -1, vel: 0.8, harm: -2, hvel: 0.6 }, lead3: { ph: 'r7 RUN', inst: 'strings', vel: 0.62 }, lead4: { ph: 'r7 RUN', inst: 'flute', oct: 1, vel: 0.5 }, lead2: { ph: '@counter', inst: 'cello', reg: [48, 64], vel: 0.5 },
        choir: { n: 3, reg: [62, 76], vel: 0.42, soft: true }, choir2: { n: 3, reg: [50, 62], vel: 0.36, soft: true }, timp: { p: 'hits', vel: 0.35, roll: 2 } },
      // the sunrise: the hymn in the horns, the solo horn an octave beneath, the voices open, the harp running up
      { n: 'sunrise', choir3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.3 }, bars: 8, bpm: 60, cres: [0.96, 1.06], prog: 'I | V:.5 IV:.5 | I | ii:.5 V:.5 | I | ii:.5 I/III:.5 | vi:.5 V:.5 | I',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [62, 86], vel: 0.82 }, pad2: { p: 'sus', n: 2, reg: [43, 57], vel: 0.6, open: true },
        bass: { pat: '1---', vel: 1.1, inst: { p: 'deep', att: 0.2, rel: 1.6 }, fresh: true }, ...ORGAN(0.5, 0),
        lead: { ph: 'H1 H2', inst: 'horn', vel: 1.0 }, lead2: { ph: '@', inst: 'hornIowa', oct: -1, vel: 0.8 }, bell2: { ph: 'H1 H2', inst: 'trombones', oct: -1, vel: 0.55 },
        choir: { inst: 'choirMenAh', n: 3, reg: [50, 62], vel: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.7 },
        arp: { p: 'up', vel: 0.15, reg: [55, 89] }, bell: { inst: 'bell', dens: 0.1, res: 2, reg: [84, 100], vel: 0.35 }, timp: { p: 'two', vel: 0.6 },
        drums: { crashS: at(8, { 0: 'x...............' }), tam: at(8, { 0: 'x...............' }) }, verb: 0.85, subBass: 0.7 },
      // the zenith: the hymn's second half higher, the trumpets on the tune, the horns beneath, the choir singing it, the violins' descant
      { n: 'zenith', choir3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.3 }, bars: 8, bpm: 60, bpmTo: 54, cres: [1.04, 1.1], prog: 'I iii vi V | IV I/III V I',
        pad: { p: 'sus', inst: 'strings', n: 4, reg: [60, 84], vel: 0.65 }, pad2: { p: 'sus', n: 2, reg: [43, 57], vel: 0.62, open: true },
        bass: { pat: '1---', vel: 0.8, inst: { p: 'deep', att: 0.3, rel: 1.8 } }, ...ORGAN(0.55, 0),
        lead: { ph: 'H3 H4', inst: 'tpts', vel: 0.95 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.85 }, lead3: { ph: 'H3 H4', inst: 'choirMenAhNew', oct: -1, vel: 0.85 },
        lead4: { ph: 'DS1 DS2', inst: 'strings', vel: 0.55 }, bell2: { ph: 'H3 H4', inst: 'trombones', oct: -1, vel: 0.55 },
        choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.75 }, arp: { p: 'updown', vel: 0.13, reg: [55, 89] }, timp: { p: 'beats', vel: 0.45, roll: 1 },
        drums: { crashS: at(8, { 0: 'x...............', 7: 'x...............' }) }, verb: 0.9, subBass: 0.75 },
      // the day: the oboe with the dawn theme and its close, the clarinet beneath, the harp
      { n: 'day', bars: 8, bpm: 56, lv: 0.56, prog: 'IM7 IM7 IVM7 IVM7 | IV ii7 V7sus4:.5 V:.5 I',
        pad: { p: 'sus', inst: 'strings', n: 3, reg: [52, 72], vel: 0.35 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.5, open: true },
        bass: { pat: '1---', vel: 0.85, inst: { p: 'deep', att: 1.0, rel: 2.4 } }, arp: { pat: '0.2.1.2.', res: 2, gate: 2.4, vel: 0.1, reg: [55, 79] },
        lead: { ph: 'D1 D5', inst: 'oboe', vel: 0.6 }, lead2: { ph: '@counter', inst: 'bassoon', reg: [46, 60], vel: 0.38, pan: -0.25 },
        choir: { n: 2, reg: [64, 77], vel: 0.22, soft: true }, bell: { dens: 0.08, res: 1, reg: [80, 96], vel: 0.3 } },
      // dusk: the flute alone over the pedal, the climb in a far horn, the last light
      { n: 'dusk', pad3: { p: 'swell', inst: 'analog', n: 3, reg: [60, 79], vel: 0.3 }, bars: 8, bpm: 52, bpmTo: 42, cres: [0.46, 0.2], prog: 'IM7:2 IVM7/I:2 | Iadd9:4',
        pad: { p: 'swell', n: 3, reg: [52, 67], vel: 0.55 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.36, open: true },
        bass: { pat: '1---', vel: 0.75, inst: { p: 'cbSolo', att: 2.5, rel: 4 } }, choir2: { inst: 'choirHum', n: 2, reg: [60, 72], vel: 0.3, soft: true },
        lead: { ph: 'D1 DE', vel: 0.5, pan: -0.1 }, lead2: { ph: 'r2 PAh r2', inst: 'hornIowa', oct: -1, vel: 0.42, pan: 0.3 },
        bell: { dens: 0.07, res: 1, reg: [80, 96], vel: 0.28 } },
    ],
  });

  // =====================================================================================================================================
  // The Long Night (the late years, war): the concert suite's passacaglia, its variations in their order (the arc is the piece)
  // =====================================================================================================================================
  const GROUND = 'i bVIM7 bIII V | i bVIM7 bIII V', GBASS = ['1--b', '1--7', '1--2', '1---'];
  piece('galaxy12', {
    desc: 'The long night: a passacaglia — a ground that never stops, and variations over it that quicken as they go: the cor anglais, the violins in eighths, a pizzicato scherzo, the night breaking into B major for a violin\'s song, the hymn in the horn with the men, the strings trembling and gathering, the climax with the hymn in the horns and the trumpets above, and the cor anglais alone again',
    bpm: 52, root: 'B', mode: 'minor', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.6, subBass: 0.4, bassC: 40, loopFrom: 'v1',
    mix: { lead: 1.4, pad: 1.0, bass: 1.05, choir: 1.25, arp: 0.9, bell: 0.9, drums: 0.7 },
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
      GE: '1:4 | 4:4 | 5:4 | 1:8',
      RUN: 'r:2 5:.25! 6:.25! 7#:.25! 8:.25! 9:.25! 10:.25! 11:.25! 12:.25!',
      E1: '5:1 4:.5 3:.5 5:1 8:1 | 8:.5 7:.5 6:1 5:1 3:1 | 5:.5 6:.5 7:1 7:.5 6:.5 5:1 | 5:1 7#:1 9:2',    // the violins in eighths
      E2: '8:1 10:.5 9:.5 8:1 5:1 | 6:1.5 5:.5 3:1 6:1 | 5:1 3:.5 5:.5 7:1 5:1 | 7#:1.5 9:.5 9:2',
      PSE: '1:.5 3:.5 5:.5 3:.5 8:.5 5:.5 3:.5 5:.5 | 6:.5 8:.5 3:.5 8:.5 6:.5 5:.5 3:.5 5:.5 | 3:.5 5:.5 7:.5 5:.5 3:.5 5:.5 7:.5 8:.5 | 7#:.5 9:.5 5:.5 r:2.5',   // the perpetual motion
      PO2: 'r:4 | r:4 | r:4 | r:1.5 8:.5 7#:.5 9:.5 5:1',                                                   // the answer in its gap
      M1r: '3:1.5 2:.5 1:1 3:1 | 1:2 3:1 5:1 | 5:1.5 4:.5 3:1 4:1 | 2:4', M2r: '5:1.5 6:.5 8:1 6:1 | 8:2 6:1 5:1 | 7:1 5:1 7:1 9:1 | 9:3 7:1',
      M1s: '3:3 4:1 | 5:2 3:2 | 5:3 6:1 | 5:2 2:2', M2s: '8:3 7:1 | 6:2 8:2 | 7:3 5:1 | 5:4',   // the song, a long arc in steps
      M3r: '10:1.5 9:.5 8:1 10:1 | 12:2 10:1 8:1 | 12:1.5 11:.5 10:1 12:1 | 9:3 7:1', M4r: '10:1 12:1 10:1 8:1 | 8:1.5 6:.5 8:1 6:1 | 5:1 7:1 5:1 3:1 | 5:4', CE: '5:2 3:2 | 4:2 6:2 | 2:2 7#:2 | 1:8',                          // the last ground, and the cor anglais's close
    },
    base: { bass: { pat: GBASS, inst: { p: 'deep', att: 0.9, rel: 2.2 }, vel: 0.7 } },
    sec: [
      { n: 'ground', bars: 4, cres: [0.36, 0.46], prog: 'i bVIM7 bIII V', bass: true, lead2: { ph: 'GB', oct: -1, vel: 0.66, art: 0.96 } },
      { n: 'v1', bars: 8, lv: 0.5, prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.62, art: 0.96 }, pad: { p: 'sus', inst: 'violas', n: 2, reg: [52, 64], vel: 0.42 },
        lead: { ph: 'P1 P2', vel: 0.66 } },
      { n: 'v2', bars: 8, cres: [0.54, 0.66], prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.6, art: 0.96 }, pad: { p: 'sus', n: 3, reg: [52, 70], vel: 0.55 },
        lead: { ph: 'E1 E2', inst: 'strings', vel: 0.8 }, lead3: { ph: '@counter', inst: 'reed', reg: [55, 69], vel: 0.42 }, arp: { p: 'run', vel: 0.14, reg: [55, 86], gate: 0.8 },
        choir: { n: 2, reg: [66, 79], vel: 0.26, soft: true } },
      { n: 'v3', bars: 8, lv: 0.56, prog: GROUND, bass: { pat: GBASS, inst: 'moog', vel: 0.6 },   // the scherzo: the theme's perpetual motion in pizzicato (a real pluck, not a cut-off bow), the bassoon and then the clarinet answering it legato
        lead: { ph: 'PSE^ PSE^', inst: 'pizz', vel: 0.55 } /* an octave up: bright plucks, not a thud in the low mids */, lead2: { ph: 'PO2_ r4', inst: 'bassoon', vel: 0.52 }, lead3: { ph: 'r4 PO2', inst: 'clarinet', vel: 0.5 }, bell: { ph: 'r4 GB', inst: 'glass', oct: 1, vel: 0.26 } },
      { n: 'v4', bars: 8, key: 'B', mode: 'major', cres: [0.46, 0.56], prog: 'I vi7 iii V | I vi7 iii V', bass: { pat: ['1---', '1--7', '1---', '1---'], inst: { p: 'deep', att: 1.2, rel: 2.6 }, vel: 0.8 },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.55, art: 0.96 }, pad: { p: 'swell', inst: 'violas', n: 3, reg: [54, 68], vel: 0.48 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 86], vel: 0.32 },
        lead: { ph: 'M1s M2s', inst: 'vlnSolo', oct: 1, vel: 0.64 }, arp: { pat: '0.......2...1...', res: 2, vel: 0.28, reg: [59, 86] }, arp2: { inst: 'violas', pat: '0212', res: 2, gate: 0.9, vel: 0.11, reg: [54, 68] }, bell: { inst: 'glass', dens: 0.08, res: 1, reg: [83, 99], vel: 0.3 } },
      { n: 'v5', bars: 8, key: 'B', mode: 'major', cres: [0.56, 0.7], prog: 'I vi7 iii V | I vi7 iii V', bass: { pat: ['1---', '1--7', '1---', '1---'], inst: { p: 'deep', att: 1.0, rel: 2.4 }, vel: 0.85 },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.58, art: 0.96 }, pad: { p: 'sus', n: 4, reg: [54, 74], vel: 0.6 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 86], vel: 0.32 },
        lead: { ph: 'M3r M4r', inst: 'strings', vel: 0.78 }, arp2: { inst: 'violas', pat: '0212', res: 2, gate: 0.9, vel: 0.11, reg: [54, 68] }, lead3: { ph: 'MC MC', inst: 'hornIowa', oct: -1, vel: 0.5 }, choir: { n: 3, reg: [64, 79], vel: 0.34, soft: true },
        arp: { pat: '01232101', res: 2, vel: 0.14, reg: [55, 82] } },
      { n: 'v6', bars: 8, lv: 0.6, prog: GROUND, bass: true, lead2: { ph: 'GB GB', oct: -1, vel: 0.6, art: 0.96 }, pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [52, 67], vel: 0.4 },
        lead: { ph: 'H1 H1*1.1', inst: 'hornSolo', vel: 0.72 }, arp: { pat: '012321012321', res: 3, vel: 0.1, reg: [55, 76] }, lead3: { ph: 'r4 H1', inst: 'choirMenNew', oct: -1, vel: 0.5 }, choir2: { inst: 'choirMenOld', n: 2, reg: [48, 60], vel: 0.28, soft: true } },
      { n: 'v7', arp2: { inst: 'seqSyn', pat: '0213021302130213', res: 4, vel: 0.12, reg: [62, 79] }, pad3: { p: 'swell', inst: { p: 'analog', smp: 'padDark' }, n: 2, reg: [55, 70], vel: 0.32 }, bars: 8, cres: [0.64, 0.96], prog: GROUND, bass: { pat: GBASS, inst: { p: 'deep', att: 0.9, rel: 2.2 }, vel: 0.5 }, lead2: { ph: 'GB GB', oct: -1, vel: 0.66, art: 0.96 }, bell2: { ph: 'r4 GB', inst: 'trombones', oct: -1, vel: 0.5 },
        pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [52, 67], vel: 0.46 }, pad2: { p: 'swell', inst: 'strTrem', n: 3, reg: [66, 84], vel: 0.42 },
        lead4: { ph: 'r7 RUN', inst: 'strings', vel: 0.6 }, lead: { ph: 'E1 E2', inst: 'strings', oct: 1, vel: 0.8 }, arp: { inst: 'strOst', pat: '0121012101210121', res: 4, vel: 0.26, reg: [50, 66] }, lead3: { ph: 'FL', inst: 'flute', vel: 0.4 }, bell: { ph: 'CH CH', inst: 'chime', vel: 0.4 },
        timp: { p: 'two', vel: 0.3, roll: 2 } },
      { n: 'v8', choir3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.3 }, bars: 8, cres: [1.02, 1.12], prog: 'i bVIM7 bIII V | i bVIM7 bIII V7', bass: { pat: GBASS, inst: { p: 'deep', att: 0.3, rel: 1.8 }, vel: 0.62, fresh: true },
        lead2: { ph: 'GB GB', oct: -1, vel: 0.7, art: 0.96 }, bell2: { ph: 'GB GB', inst: 'trombones', oct: -1, vel: 0.66 }, ...ORGAN(0.5, 0),
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.82 }, lead: { ph: 'H1 H1', inst: 'horn', vel: 1.0, harm: -2, hvel: 0.6 }, lead4: { ph: 'DS DS2', inst: 'tpts', vel: 0.6 },
        lead3: { ph: 'H1 H1', inst: 'choirMenAhNew', oct: -1, vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.7 }, timp: { p: 'beats', vel: 0.6 },
        arp: { inst: 'strOst', pat: '0121012101210121', res: 4, vel: 0.3, reg: [50, 66] }, bell: { ph: 'E1 E2', inst: 'strings', oct: 1, vel: 0.46 },
        drums: { crashS: at(8, { 0: 'x...............' }), tam: at(8, { 0: 'x...............' }) }, verb: 0.9, subBass: 0.8 },
      { n: 'coda', bars: 8, bpm: 50, bpmTo: 38, cres: [0.42, 0.2], prog: 'i bVIM7 bIII V | i iv V I', bass: { pat: ['1--b', '1--7', '1--2', '1---', '1---', '1---', '1---', '1---'], inst: { p: 'deep', att: 1.2, rel: 3 }, vel: 0.8 },
        lead2: { ph: 'GB GE', oct: -1, vel: 0.58, art: 0.96 }, pad: { p: 'swell', inst: 'violas', n: 3, reg: [52, 66], vel: 0.45 },
        lead: { ph: 'P1 CE', vel: 0.6 }, choir: { n: 3, reg: [62, 74], vel: 0.26, soft: true } },
    ],
  });

  // =====================================================================================================================================
  // Wonder (calm exploration, the early years): the flute's lydian tune and its answers, the harp's gentle motor, celesta points
  // =====================================================================================================================================
  piece('galaxy1', {
    desc: 'Calm exploration, wonder: the flute\'s tune in G lydian over a light string bed and a gently rolling harp; the clarinet answers it with the flute moving in its gaps; a solo violin high with a horn beneath; a still for the cello and the women humming; the violins and the flute together at the gentle peak; the flute alone to close',
    bpm: 60, root: 'G', mode: 'lydian', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.4, bassC: 40, loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'breath', 'C', 'A3', 'E'], ['A1', 'B', 'A2', 'breath', 'C', 'A3', 'E'], ['A1', 'A2', 'C', 'breath', 'B', 'A3', 'E']],
    mix: { lead: 1.45, pad: 1.0, choir: 1.15, arp: 0.85, bell: 0.85, bass: 0.65 },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'flute', lead2: 'clarinet', arp: { p: 'harp', rel: 2.5, hold: 1.4 }, bell: 'glass', choir: 'choirOoh', choir2: 'choirHum' },   /* the women humming (their open vowel rang at 3 kHz in the quiet) */
    quotes: ['wonder', 'planetarium'],
    ph: {
      W1: '@wonder.W1', W2: '5:2 7:1 8:1 | 10:3 8:1 | 8:2! 7:1 5:1 | 5:4', W3: '6:3 8:1 | 10:2 9:1 8:1 | 7:3 6:1 | 4:4', W4: '8:2 5:2 | 7:3 5:1 | 5:2 6:1 7:1 | 7:4',
      FL: '@planetarium.FL', C2: '5:4 | 7:4 | 6:4 | 4:4',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.3, 0.42], prog: 'IM7:2 II:2', pad: { p: 'swell', n: 3, reg: [55, 71], vel: 0.5 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.35, open: true },
        arp: { pat: '0.......2.......', res: 2, vel: 0.14, reg: [55, 79] }, bell: { dens: 0.1, res: 1, reg: [79, 91], vel: 0.32 } },
      // the tune: the flute alone over the light bed, the harp rolling gently
      { n: 'A1', bars: 8, lv: 0.6, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: { p: 'sus', n: 3, reg: [55, 71], vel: 0.26 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.3, open: true },
        bass: { pat: '1---', vel: 0.6, inst: { p: 'deep', att: 1.2, rel: 2.4 } }, arp: { pat: '0.2.1.3.', res: 2, vel: 0.12, reg: [55, 79] },
        lead: { ph: 'W1 W2', vel: 0.62 }, bell: { dens: 0.08, res: 1, reg: [79, 91], vel: 0.3 } },
      // the answer: the clarinet takes the tune, the flute's counter-line in its gaps
      { n: 'A2', bars: 8, lv: 0.64, prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: { p: 'sus', n: 3, reg: [55, 71], vel: 0.3 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.3, open: true },
        bass: { pat: '1---', vel: 0.6, inst: { p: 'deep', att: 1.2, rel: 2.4 } }, arp: { pat: '0.2.1.3.', res: 2, vel: 0.12, reg: [55, 79] },
        lead: { ph: 'W1 W4', inst: 'clarinet', vel: 0.62 }, lead2: { ph: '@counter', inst: 'flute', reg: [74, 88], vel: 0.4 } },
      // the B phrase: a solo violin high, a horn's counter-line low, the women humming
      { n: 'B', bars: 8, lv: 0.66, prog: 'vi iii V II | IM7 IM7 V V', pad: { p: 'sus', n: 3, reg: [55, 71], vel: 0.3 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.3, open: true },
        bass: { pat: '1---', vel: 0.62, inst: { p: 'deep', att: 1.0, rel: 2.2 } }, arp: { pat: '0...2...1...3...', res: 2, vel: 0.12, reg: [55, 79] },
        lead: { ph: 'W3 W4', inst: 'vlnSolo', vel: 0.6 }, lead2: { ph: '@counter', inst: 'hornIowa', reg: [50, 62], vel: 0.38 },   /* the violin at pitch: an octave up its top was B6, piercing */
        choir2: { n: 2, reg: [64, 76], vel: 0.22, soft: true } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', pad: { p: 'swell', n: 2, reg: [62, 74], vel: 0.3 }, bell: { dens: 0.08, res: 1, reg: [79, 91], vel: 0.3 } },
      // the still: the cello's slow line, the women humming, no bass, the harp barely moving
      { n: 'C', bars: 8, lv: 0.46, prog: 'vi:2 IM7:2 | V:2 II:2', pad: { p: 'swell', n: 3, reg: [57, 72], vel: 0.32 },
        lead: { ph: 'FL C2', inst: 'cello', oct: -1, vel: 0.62 }, choir2: { n: 2, reg: [64, 76], vel: 0.26, soft: true },
        arp: { pat: '0.......2.......', res: 2, vel: 0.1, reg: [55, 79] }, bell: { dens: 0.12, res: 1, reg: [79, 91], vel: 0.32 } },
      // the gentle peak: the violins and the flute together on the tune, the clarinet's counter-line, the horns and the voices softly
      { n: 'A3', bars: 8, cres: [0.56, 0.78], prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: { p: 'sus', inst: 'strings', n: 3, reg: [57, 72], vel: 0.36 },
        pad2: { p: 'swell', inst: 'horn', n: 3, reg: [50, 64], vel: 0.32 }, bass: { pat: '1---', vel: 0.5, inst: { p: 'deep', att: 0.8, rel: 2.0 } },
        arp: { pat: '0.2.1.3.', res: 2, vel: 0.13, reg: [55, 79] }, lead: { ph: 'W1 W2', inst: 'strings', vel: 0.6 }, lead3: { ph: 'W1 W2', inst: 'flute', vel: 0.36 } /* in unison with the violins: warm (an octave above, its D6 dominated the arrival) */,
        lead2: { ph: '@counter', inst: 'clarinet', reg: [55, 70], vel: 0.38 }, choir2: { n: 3, reg: [62, 76], vel: 0.26, soft: true }, choir: { n: 2, reg: [50, 62], vel: 0.22, soft: true } },
      // the close: the flute alone again
      { n: 'E', bars: 8, cres: [0.56, 0.42], prog: 'IM7 IM7 V II | IM7 IM7 V V', pad: { p: 'sus', n: 3, reg: [55, 71], vel: 0.22 }, pad2: { p: 'swell', n: 2, reg: [43, 55], vel: 0.22, open: true },
        bass: { pat: '1---', vel: 0.55, inst: { p: 'deep', att: 1.2, rel: 2.6 } }, arp: { pat: '0...2...1...3...', res: 2, vel: 0.11, reg: [55, 79] },
        lead: { ph: 'W1 W4', vel: 0.66 }, bell: { dens: 0.1, res: 1, reg: [79, 91], vel: 0.3 } },
    ],
  });

  // =====================================================================================================================================
  // Deep Field (the planetarium, in the Serrie manner): kept spacious and still by design — the analog sky, a lone flute, points of light
  // =====================================================================================================================================
  piece('galaxy4', {
    desc: 'Deep field — the analog sky and a high air, a lone flute with its slow phrases, a celesta answering with the four slow notes, the cello\'s long line and the men\'s chant far below, the harp and the celesta as single points of light: the planetarium, in the Serrie manner',
    bpm: 50, root: 'A', mode: 'lydian', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 4.4, bassC: 40, loopFrom: 'A1',
    forms: [['A1', 'breath', 'B', 'C', 'E'], ['A1', 'C', 'breath', 'B', 'E']],
    mix: { lead: 1.45, pad: 1.0, choir: 1.1, arp: 0.8, bell: 0.85, bass: 0.6 },
    inst: { pad: 'analog', pad2: 'violas', bass: 'deep', lead: 'flute', lead2: 'cello', bell: 'glass', arp: { p: 'harp', rel: 3, hold: 2 }, choir: 'choirHum', choir2: 'choirMen' },
    quotes: ['planetarium', 'men'],
    ph: { S1: '5:4 | 8:4 | 7:4 | 5:4', S2: '6:4 | 8:2 9:2 | 8:4 | 5:4', S3: '10:4 | 9:4 | 8:2 7:2 | 5:4', S4: '5:2 8:2 | 7:3 6:1 | 5:4 | 3:4',
      FL: '@planetarium.FL', CL: '1:8 | 3:8 | 2:6 1:2 | 5:8', CM: '@men.CM' },
    sec: [
      { n: 'intro', bars: 8, cres: [0.3, 0.42], prog: 'IM7:4 II:4', pad: { p: 'swell', n: 3, reg: [57, 74], vel: 0.5 }, pad3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.32 },
        bass: { pat: '1---', vel: 0.5, inst: { p: 'deep', att: 2, rel: 3 } }, bell: { dens: 0.06, res: 1, reg: [79, 93], vel: 0.28 } },
      // the flute's slow phrases under the sky
      { n: 'A1', bars: 16, lv: 0.5, prog: 'IM7:4 II:4 | IM7:4 vi:4 | IM7:4 II:4 | V:4 IM7:4', pad: { p: 'sus', n: 3, reg: [57, 74], vel: 0.42 }, pad2: { p: 'swell', n: 2, reg: [52, 64], vel: 0.24 },
        bass: { pat: '1---', vel: 0.5, inst: { p: 'deep', att: 1.6, rel: 2.8 } }, lead: { ph: 'S1 r8 S2 r4', vel: 0.58 },
        arp: { pat: '0...............', res: 1, vel: 0.1, reg: [57, 81] }, bell: { dens: 0.06, res: 1, reg: [79, 93], vel: 0.28 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.28, prog: 'IM7:8', pad: { p: 'swell', n: 2, reg: [62, 76], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [79, 93], vel: 0.26 } },
      // the four slow notes in the celesta, the cello's long line beneath, the men's chant far below
      { n: 'B', bars: 16, lv: 0.5, prog: 'vi:4 II:4 | IM7:4 IM7:4', pad: { p: 'sus', n: 3, reg: [57, 74], vel: 0.4 }, pad3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.3 },
        bass: { pat: '1---', vel: 0.48, inst: { p: 'deep', att: 1.6, rel: 2.8 } }, lead: { ph: 'r4 FL r8', inst: 'glass', vel: 0.42 }, lead2: { ph: 'r8 CL', oct: -1, vel: 0.5 },
        bell2: { ph: 'CM r8', inst: 'choirMenOldLine', oct: -1, vel: 0.32 }, arp: { pat: '0.......2.......', res: 1, vel: 0.09, reg: [57, 81] } },
      // the still: the strings and the air, the women humming, no bass
      { n: 'C', bars: 8, lv: 0.36, prog: 'IM7:4 II:4', pad: { p: 'swell', inst: 'strings', n: 3, reg: [60, 76], vel: 0.36 }, pad3: { p: 'swell', inst: 'air', n: 2, reg: [74, 88], vel: 0.32 },
        choir: { n: 2, reg: [62, 74], vel: 0.24, soft: true }, bell: { dens: 0.1, res: 1, reg: [79, 93], vel: 0.3 } },
      // the flute again, and away
      { n: 'E', bars: 8, cres: [0.46, 0.3], prog: 'IM7:8', pad: { p: 'sus', n: 3, reg: [57, 74], vel: 0.38 }, bass: { pat: '1---', vel: 0.45, inst: { p: 'deep', att: 1.6, rel: 3 } },
        lead: { ph: 'r4 S4', vel: 0.5 }, bell: { dens: 0.07, res: 1, reg: [79, 93], vel: 0.26 } },
    ],
  });

  // =====================================================================================================================================
  // The Veil (calm exploration): a waltz of the spheres — the harp's waltz under the oboe, answers and counter-lines, a gentle peak
  // =====================================================================================================================================
  piece('galaxy5', {
    desc: 'Calm exploration, the veil: a slow waltz of the spheres — the bass on the one and the harp on two and three under the oboe\'s tune; the flute answers with the oboe in its gaps; a clarinet with a horn beneath; a still; the violins take the tune at the gentle peak; the commonwealth\'s tune in three to close',
    bpm: 54, meter: 3, root: 'Eb', mode: 'major', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.6, bassC: 40, loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'E'], ['A1', 'B', 'A2', 'C', 'breath', 'A3', 'E']],
    mix: { lead: 1.45, pad: 1.0, choir: 1.1, arp: 0.85, bell: 0.85, bass: 0.65 },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'oboe', lead2: 'flute', bell: 'glass', arp: { p: 'harp', rel: 1.6, hold: 0.6 }, choir: 'choirHum', choir2: 'choirMen' },
    quotes: ['procession'],
    ph: {
      PA3: '1:2 2:1 | 3:1 5:2 | 6:2 5:1 | 3:2 2:1',
      V1: '5:2 6:1 | 8:3 | 7:2 5:1 | 6:3', V1b: '5:1 6:1 8:1 | 8:3 | 7:1 6:1 5:1 | 6:3',
      V2: '8:2 9:1 | 10:3 | 9:2 8:1 | 5:3', V2b: '8:3 | 10:2 9:1 | 8:2 7:1 | 5:3',
      V3: '3:2 5:1 | 6:2 5:1 | 4:2 3:1 | 2:3', V4: '6:2 8:1 | 7:2 6:1 | 5:2 4:1 | 5:3', V4b: '6:2 8:1 | 7:2 6:1 | 5:2 2:1 | 1:3',
    },
    sec: [
      // the waltz alone: the bass on the one, the harp on two and three
      { n: 'intro', bars: 4, cres: [0.4, 0.5], prog: 'I IV | I V', bass: { pat: '1--', vel: 0.55, inst: { p: 'deep', att: 0.4, rel: 1.6 } },
        arp: { pat: '.12', res: 1, vel: 0.16, reg: [55, 79] }, bell: { dens: 0.08, res: 1, reg: [79, 93], vel: 0.3 } },
      // the oboe's tune over it
      { n: 'A1', bars: 8, lv: 0.6, prog: 'I IV | V IV | ii V | I I', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, bass: { pat: '1--', vel: 0.55, inst: { p: 'deep', att: 0.4, rel: 1.6 } },
        arp: { pat: '.12', res: 1, vel: 0.15, reg: [55, 79] }, lead: { ph: 'V1 V2', vel: 0.66 } },
      // the flute answers, the oboe moving in its gaps
      { n: 'A2', bars: 8, lv: 0.64, prog: 'I IV | V IV | ii V | I I', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, bass: { pat: '1--', vel: 0.55, inst: { p: 'deep', att: 0.4, rel: 1.6 } },
        arp: { pat: '.12', res: 1, vel: 0.15, reg: [55, 79] }, lead: { ph: 'V1b V2b', inst: 'flute', vel: 0.62 }, lead2: { ph: '@counter', inst: 'oboe', reg: [60, 74], vel: 0.38 } },
      // the clarinet, a horn's counter-line beneath, the women humming
      { n: 'B', bars: 8, lv: 0.62, prog: 'vi IV | IV V | vi ii | V I', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.28, open: true },
        bass: { pat: ['1--', '1-5'], vel: 0.55, inst: { p: 'deep', att: 0.4, rel: 1.6 } }, arp: { pat: '.12', res: 1, vel: 0.14, reg: [55, 79] },
        lead: { ph: 'V3 V4', inst: 'clarinet', vel: 0.62 }, lead2: { ph: '@counter', inst: 'hornIowa', reg: [50, 62], vel: 0.36 }, choir: { n: 2, reg: [62, 74], vel: 0.22, soft: true } },
      // the still: the oboe alone over the strings, no bass
      { n: 'C', bars: 8, lv: 0.44, prog: 'I ii V I | I ii V I', pad: { p: 'swell', n: 3, reg: [57, 72], vel: 0.3 }, lead: { ph: 'V4 V4b', vel: 0.55 },
        arp: { pat: '1..', res: 1, vel: 0.1, reg: [55, 79] }, bell: { dens: 0.1, res: 1, reg: [79, 93], vel: 0.3 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:2', pad: { p: 'swell', n: 2, reg: [62, 74], vel: 0.3 }, bell: { dens: 0.06, res: 1, reg: [79, 93], vel: 0.28 } },
      // the gentle peak: the violins on the tune, the oboe's counter-line, the voices softly
      { n: 'A3', bars: 8, cres: [0.6, 0.74], prog: 'I IV | V IV | ii V | I I', pad: { p: 'sus', inst: 'strings', n: 3, reg: [57, 72], vel: 0.3 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.28, open: true },
        bass: { pat: '1--', vel: 0.58, inst: { p: 'deep', att: 0.4, rel: 1.6 } }, arp: { pat: '.12', res: 1, vel: 0.15, reg: [55, 79] },
        lead: { ph: 'V1 V2', inst: 'strings', vel: 0.62 }, lead2: { ph: '@counter', inst: 'oboe', reg: [60, 74], vel: 0.36 }, choir: { n: 3, reg: [60, 74], vel: 0.15, soft: true } },
      // the close: the commonwealth's tune in three on the oboe, then home
      { n: 'E', bars: 8, cres: [0.54, 0.4], prog: 'I V | IV I | IV V | I I', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.22 }, bass: { pat: '1--', vel: 0.5, inst: { p: 'deep', att: 0.6, rel: 2 } },
        arp: { pat: '.12', res: 1, vel: 0.13, reg: [55, 79] }, lead: { ph: 'PA3 V4b', vel: 0.58 }, bell: { dens: 0.07, res: 1, reg: [79, 93], vel: 0.28 } },
    ],
  });

  // =====================================================================================================================================
  // Patience (calm exploration): the marimba's short ostinato as the motor under the cor anglais's legato tune, counter-lines in its gaps
  // =====================================================================================================================================
  piece('galaxy2', {
    desc: 'Calm exploration, patience: a marimba\'s short ostinato under the cor anglais\'s tune in D dorian; a bassoon\'s counter-line in its gaps; a clarinet with a horn beneath; a still for the celesta; the violins on the tune with the cor anglais beneath at the peak; the cello to close',
    bpm: 60, root: 'D', mode: 'dorian', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.4, bassC: 40, loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'breath', 'A3', 'B2'], ['A1', 'B', 'A2', 'C', 'breath', 'B2', 'A3']],
    mix: { lead: 1.45, pad: 1.0, choir: 1.1, arp: 0.85, bell: 0.85, bass: 0.65 },
    inst: { pad: 'violas', pad2: 'cellos', bass: 'deep', lead: 'reed', lead2: 'bassoon', bell: 'glass', arp: 'marimba', choir: 'choirHum', choir2: 'choirMen' },
    quotes: ['procession'],
    ph: {
      P1c: '1:1.5 2:.5 3:2 | 5:1.5 6:.5 5:2 | 5:2 3:2 | 4:1 5:1 6:2', P1: '5:1.5 6:.5 8:2 | 8:1.5 7:.5 6:2 | 5:2 3:2 | 4:1 5:1 6:2',
      P2: '7:2 5:2 | 4:2 6:2 | 5:2 8:2 | 8:3 r:1', P3: '9:2 8:1 7:1 | 5:2 7:2 | 8:2 6:1 4:1 | 6:2 5:2', P4: '8:2 10:2 | 9:2 7:2 | 8:2 6:2 | 5:2 1:2',
      Q1: '5:4 | 6:4 | 8:4 | 5:4', Q2: '4:4 | 3:4 | 5:4 | 1:4',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.44, 0.54], prog: 'i:2 IV:2', pad: { p: 'swell', n: 3, reg: [55, 70], vel: 0.32 }, arp: { pat: '0.2.1.2.', res: 2, vel: 0.16, reg: [57, 76] } },
      // the cor anglais's tune over the marimba's motor
      { n: 'A1', bars: 8, lv: 0.64, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, bass: { p: 'half', vel: 0.55, inst: { p: 'deep', att: 0.3 } },
        arp: { pat: '0.2.1.2.', res: 2, vel: 0.15, reg: [57, 76] }, lead: { ph: 'P1 P2', vel: 0.7 } },
      // the bassoon's counter-line moves in the tune's gaps
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, bass: { p: 'half', vel: 0.55, inst: { p: 'deep', att: 0.3 } },
        arp: { pat: '0.2.1.2.', res: 2, vel: 0.15, reg: [57, 76] }, lead: { ph: 'P1c P2', vel: 0.7 }, lead2: { ph: '@counter', reg: [46, 60], vel: 0.42 } },
      // the clarinet, a horn beneath, the cellos
      { n: 'B', bars: 8, lv: 0.66, prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.3, open: true },
        bass: { p: 'whole', vel: 0.55, inst: { p: 'deep', att: 0.5 } }, arp: { pat: '0.1.0.1.', res: 2, vel: 0.13, reg: [57, 76] },
        lead: { ph: 'P3 P4', inst: 'clarinet', vel: 0.66 }, lead2: { ph: '@counter', inst: 'hornIowa', reg: [50, 62], vel: 0.38 } },
      // the still: the celesta's long notes over the strings, no bass, the marimba silent
      { n: 'C', bars: 8, lv: 0.46, prog: 'i:2 bVII:2 IV:2 i:2', pad: { p: 'swell', n: 3, reg: [57, 72], vel: 0.3 }, lead: { ph: 'Q1 Q2', inst: 'vibes', vel: 0.5 },
        choir: { n: 2, reg: [60, 72], vel: 0.22, soft: true } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'i:4', pad: { p: 'swell', n: 2, reg: [62, 74], vel: 0.3 } },
      // the peak: the violins on the tune, the cor anglais's counter-line, the horns warm beneath, the voices softly
      { n: 'A3', bars: 8, cres: [0.62, 0.76], prog: 'i:1 IV:1 i:1 IV:1 bVII:1 IV:1 i:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [57, 72], vel: 0.28 }, pad2: { p: 'swell', inst: 'horn', n: 3, reg: [50, 64], vel: 0.26 },
        bass: { p: 'half', vel: 0.58, inst: { p: 'deep', att: 0.3 } }, arp: { pat: '0.2.1.2.', res: 2, vel: 0.15, reg: [57, 76] },
        lead: { ph: 'P1c P2', inst: 'strings', vel: 0.62 }, lead2: { ph: '@counter', inst: 'reed', reg: [57, 70], vel: 0.38 }, choir: { n: 3, reg: [60, 74], vel: 0.22, soft: true } },
      // the cello to close
      { n: 'B2', bars: 8, cres: [0.6, 0.48], prog: 'bVII:2 IV:2 i:1 v:1 IV:1 i:1', pad: { p: 'sus', n: 3, reg: [55, 70], vel: 0.24 }, bass: { p: 'whole', vel: 0.5, inst: { p: 'deep', att: 0.5 } },
        arp: { pat: '0.1.0.1.', res: 2, vel: 0.13, reg: [57, 76] }, lead: { ph: 'P3 P4', inst: 'cello', vel: 0.66 } },
    ],
  });

  // =====================================================================================================================================
  // Determination (calm exploration, contested): a march-like build — the motor, the pizzicato basses, the horn's resolute theme on top
  // =====================================================================================================================================
  piece('galaxy3', {
    desc: 'Calm exploration, determination: the strings\' spiccato motor alone, the pizzicato basses beneath, then the horn\'s resolute theme legato on top; the violins\' counter-line joins; everyone at the big phrase; a still for the flute; the theme again; the horn quieter to close',
    bpm: 72, root: 'A', mode: 'minor', orch: true, holdLow: false, tens: false, rubato: 0, hall: 'musikverein', trim: 2.3, bassC: 40, loopFrom: 'A1',
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'E'], ['A1', 'B', 'A2', 'C', 'A3', 'E']],
    mix: { lead: 1.4, pad: 1.0, choir: 1.1, arp: 0.85, bell: 0.85, bass: 0.7, drums: 0.7 },
    inst: { pad: 'strings', pad2: 'cellos', bass: 'deep', lead: 'horn', lead2: 'strings', bell: 'glass', arp: 'strOst', choir: 'choirMenAh', choir2: 'choirWomen' },
    quotes: ['procession'],
    ph: {
      D1c: '1:1.5 2:.5 3:1 5:1 | 6:1.5 5:.5 3:2 | 7:1.5 5:.5 2:2 | 1:3 r:1', D1: '1:1.5 3:.5 5:1 3:1 | 6:1.5 5:.5 3:2 | 7:1.5 5:.5 2:2 | 1:3 r:1',
      D2: '5:1.5 6:.5 8:1 6:1 | 8:1.5 6:.5 3:2 | 4:1.5 6:.5 8:2 | 7#:2 5:2', D3: '8:2 6:2 | 7:2 5:2 | 8:2 5:2 | 3:4', D4: '10:2 8:2 | 9:2 7:2 | 7#:2 9:2 | 5:4',
      D5: '8:4 | 6:4 | 5:4 | 3:4', D6: '6:4 | 8:4 | 7#:4 | 5:4',
    },
    sec: [
      // the motor alone, then the pizzicato basses beneath
      { n: 'intro', bars: 2, lv: 0.56, prog: 'i i', arp: { pat: '0.1.2.1.', res: 2, vel: 0.22, reg: [57, 69] } },
      { n: 'intro2', bars: 2, lv: 0.6, prog: 'i V', arp: { pat: '0.1.2.1.', res: 2, vel: 0.22, reg: [57, 69] }, bass: { p: 'half', vel: 0.7, inst: 'moog' }, timp: { p: 'two', vel: 0.16 } },
      // the horn's theme on top
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i bVI bVII i | i bVI bVII i', arp: { pat: '0.1.2.1.', res: 2, vel: 0.2, reg: [57, 69] }, bass: { p: 'half', vel: 0.7, inst: 'moog' },
        pad: { p: 'sus', inst: 'violas', n: 2, reg: [55, 67], vel: 0.2 }, lead: { ph: 'D1 D1c', oct: -1, vel: 0.86 } },
      // the violins' counter-line joins, high, in the theme's gaps
      { n: 'A2', bars: 8, lv: 0.74, prog: 'i bVI bVII i | i bVI iv V', arp: { pat: '0.1.2.1.', res: 2, vel: 0.2, reg: [57, 69] }, bass: { p: 'half', vel: 0.72, inst: 'moog' },
        pad: { p: 'sus', inst: 'violas', n: 2, reg: [55, 67], vel: 0.2 }, lead: { ph: 'D1 D2', oct: -1, vel: 0.88 }, lead2: { ph: '@counter', reg: [69, 84], vel: 0.42 }, timp: { p: 'two', vel: 0.32 } },
      // everyone: the big phrase, the horns and the trumpets, the strings full, the voices, the low brass beneath
      { n: 'B', bars: 8, cres: [0.8, 0.92], prog: 'bVI bVII i i | bVI bVII V V', pad: { p: 'sus', n: 4, reg: [57, 76], vel: 0.42 }, pad2: { p: 'sus', n: 2, reg: [43, 57], vel: 0.32, open: true },
        arp: { pat: '0123210123210123', res: 4, vel: 0.2, reg: [57, 72] }, bass: { p: 'half', vel: 0.66, inst: { p: 'lowBrass', att: 0.06, cut: 1800 } },
        lead: { ph: 'D3 D4', oct: -1, vel: 0.92 }, lead4: { ph: 'D3 D4', inst: 'tpts', vel: 0.42 }, lead2: { ph: '@counter', reg: [69, 84], vel: 0.4 },
        choir: { n: 3, reg: [50, 62], vel: 0.5 }, choir2: { n: 3, reg: [64, 76], vel: 0.38 }, timp: { p: 'two', vel: 0.42 } },
      // the still: the flute over the strings, the women humming, no motor
      { n: 'C', bars: 8, lv: 0.48, prog: 'iv:2 i:2 bVI:2 V:2', pad: { p: 'swell', n: 3, reg: [57, 72], vel: 0.3 }, lead: { ph: 'D5 D6', inst: 'flute', vel: 0.72 },
        choir2: { inst: 'choirHum', n: 2, reg: [60, 72], vel: 0.22, soft: true }, bass: { pat: '1---', vel: 0.45, inst: { p: 'deep', att: 1, rel: 2 } } },
      // the theme again over the motor, the violins' counter-line above
      { n: 'A3', bars: 8, cres: [0.68, 0.8], prog: 'i bVI bVII i | i bVI iv V', arp: { pat: '0.1.2.1.', res: 2, vel: 0.2, reg: [57, 69] }, bass: { p: 'half', vel: 0.7, inst: 'moog' },
        pad: { p: 'sus', inst: 'violas', n: 2, reg: [55, 67], vel: 0.22 }, lead: { ph: 'D1c D2', oct: -1, vel: 0.88 }, lead2: { ph: '@counter', reg: [69, 84], vel: 0.42 }, timp: { p: 'two', vel: 0.3 } },
      // the close: the horn quieter, the motor thinning
      { n: 'E', bars: 8, cres: [0.62, 0.48], prog: 'i bVI bVII i | i bVI i i', arp: { pat: '0...2...1...2...', res: 2, vel: 0.18, reg: [57, 69] }, bass: { p: 'whole', vel: 0.6, inst: 'moog' },
        pad: { p: 'sus', inst: 'violas', n: 2, reg: [55, 67], vel: 0.2 }, lead: { ph: 'D1 D5', oct: -1, vel: 0.76 } },
    ],
  });

  piece('galaxy15', {
    desc: 'The early years, the lantern: a chorale prelude in a broad six — the cradle tune in long notes as a cantus firmus (the horn, then the men, then both) under a clarinet that never stops running its arpeggio figure, the ship’s soft organ holding the chords, a flute trio in the middle, the glockenspiel in the still; Bach’s manner for a sleeping ship, in four minutes',
    tags: { solitude: 0.9, contact: 0.2, tension: 0, war: 0, grief: 0, grandeur: 0.1, energy: 0.4, dark: 0.1 },
    quotes: ['cradle'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 56, meter: 6, trim: 2.8, root: 'A', mode: 'major', loopFrom: 'CF1', tens: false, gentle: true, rubato: 0, eraWin: [0, 0.55], mix: { lead: 1.6, pad: 0.8, arp: 0.85, bass: 0.7 },
    forms: [['CF1', 'trio', 'CF2', 'still', 'CF3', 'E'], ['CF1', 'still', 'CF2', 'trio', 'E'], ['CF1', 'trio', 'still', 'CF3', 'E']],
    alts: [{}, { arp: 'flute', lead: 'cello' }, { arp: 'oboe', arp2: 'harp' }], eraAlts: { pad: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'organSoft', pad2: 'strings', bass: 'deep', lead: 'horn', lead2: 'choirMen', bell: 'glass', arp: 'clarinet', arp2: 'harp', choir: 'choirOoh', choir2: 'choirMen' },
    ph: {
      CF1: '5:4 6:2 8:6 | 7:4 6:2 5:6 | 3:5 4:1 5:6 | 6:12',                                    // the cradle tune at half speed: the cantus firmus
      CF2: '8:4 9:2 10:6 | 9:5 8:1 7:6 | 6:4 5:2 6:6 | 5:6 1:6',
      TR1: '3:1 5:1 8:3 6:1 | 5:2 3:1 2:3 | 2:1 3:1 5:3 6:1 | 5:6', TR2: '6:1 8:1 10:3 8:1 | 6:2 5:1 4:3 | 3:1 5:1 6:3 5:1 | 1:6',   // the trio: a tune of its own for the flute
      GL: '10:6 | 7:6 | 8:6 | 6:6',
    },
    sec: [
      { n: 'fig', bars: 4, cres: [0.45, 0.58], prog: 'I:2 IV:2', pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.42 }, arp: { pat: '012321012321', res: 2, vel: 0.5, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', pedal: true, inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } } },
      { n: 'CF1', bars: 8, lv: 0.64, prog: 'I:2 V:2 | I:2 IV:2', pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.44 }, arp: { pat: '012321012321', res: 2, vel: 0.5, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } },
        lead: { ph: 'CF1', vel: 0.56, shape: 0.35, swell: 0.35 } },
      { n: 'trio', bars: 8, lv: 0.56, prog: 'I IV V ii | vi ii I I', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.5 } }, arp2: { pat: '0.1.2.', res: 1, vel: 0.16, reg: [53, 81] },
        lead: { ph: ['TR1 TR2', 'TR1 r4'], inst: 'flute', vel: 0.56, shape: 0.35, swell: 0.2 }, lead2: { ph: '@counter', inst: 'oboe', reg: [64, 77], vel: 0.38 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'CF2', bars: 8, lv: 0.7, prog: 'I:2 V:2 | IV:2 V:1 I:1', pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.44 }, arp: { pat: '012321012321', res: 2, vel: 0.52, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } },
        lead2: { ph: 'CF2', oct: -1, vel: 0.6, shape: 0.4 }, lead: { ph: ['CF2', 'r8'], inst: 'oboe', oct: 1, vel: 0.36, skip: 0.4, shape: 0.35, swell: 0.2 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'IM7:2 IV:2 | IM7:2 I:2', pad: { p: 'swell', n: 3, reg: [52, 72], vel: 0.4 }, bass: false, bell2: { ph: ['GL GL', 'r4 GL'], inst: 'bell', oct: 1, vel: 0.36, rest: 0.3 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'CF3', bars: 8, cres: [0.7, 0.82], prog: 'I:2 V:2 | IV:2 V:1 I:1', pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.48 }, pad2: { p: 'sus', n: 3, reg: [52, 74], vel: 0.5 }, arp: { pat: '012321012321', res: 2, vel: 0.54, reg: [57, 81], gate: 0.9 }, arp2: { inst: 'flute', pat: '0.....1.....', res: 2, vel: 0.2, reg: [67, 84], skip: 0.4 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.5 } },
        lead: { ph: 'CF2', vel: 0.62, harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: '@', oct: -1, vel: 0.62, shape: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.48 }, choir2: { n: 3, reg: [43, 60], vel: 0.5 } },
      { n: 'E', bars: 8, cres: [0.58, 0.42], prog: 'I V I IV | I V I I', pad: { p: 'sus', n: 3, reg: [52, 72], vel: 0.42 }, arp: { pat: ['012321012321', '012321012321', '012321012321', '012321012321', '012321012321', '012321......', '0.2.........', '0...........'], res: 2, vel: 0.46, reg: [57, 79], gate: 0.9 }, bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } } },
    ],
  });

  piece('galaxy16', {
    desc: 'The early years, the survey: a minimalist pulse — the violas in soft even eighths with a marimba on the chord tones, a pizzicato bass, a flute in short cells of the leitmotif that lengthen as the piece goes, the glockenspiel echoing them, the harp running and the women singing one long line over the cells at the full; no sustained strings until the voices come; the scouts going out, star by star',
    tags: { solitude: 0.7, contact: 0.3, tension: 0.1, war: 0, grief: 0, grandeur: 0.1, energy: 0.7, dark: 0 },
    quotes: ['procession', 'hymn'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 76, trim: 3.8, root: 'D', mode: 'major', loopFrom: 'cell1', tens: false, gentle: true, rubato: 0, eraWin: [0, 0.55], mix: { lead: 1.5, pad: 0.85, arp: 0.8, bass: 0.7 },
    forms: [['cell1', 'cell2', 'add', 'full', 'thin', 'full2', 'out'], ['cell1', 'add', 'thin', 'cell2', 'full', 'out'], ['cell1', 'cell2', 'thin', 'add', 'full2', 'out']],
    alts: [{}, { lead: 'oboe', lead2: 'vibes' }, { lead: 'clarinet', arp: 'pizz' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'violas', pad2: 'air', bass: 'pulse', lead: 'flute', lead2: 'bell', bell: 'bell', arp: 'marimba', arp2: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      CE4: '1:.5 2:.5 3:1 5:2 | r:4 | 1:.5 2:.5 3:1 5:2 | r:4',                                            // a cell from the commonwealth's climb (the second leitmotif), beside the hymn's
      SV3: '1:3 2:1 | 3:2 5:2 | 6:3 1:1 | 3:2 2:2!',                                                     // the chart drawn toward the climb
      CE1: '5:.5 8:.5 7:1 r:2 | 5:.5 8:.5 7:.5 6:.5 5:2 | r:4 | r:4',                                              // the leitmotif's head as a cell, and the cell grown by a note
      CE2: 'r:4 | 5:.5 8:.5 7:1 6:.5 5:.5 3:1 | 2:.5 3:.5 5:2 r:1 | r:4',
      CE3: '5:.5 8:.5 7:1 6:.5 5:.5 3:1 | 2:.5 3:.5 5:2 6:.5 8:.5 | 7:1 6:.5 5:.5 3:2 | 2:4',                        // the cells joined into the line
      SV1: '8:3 7:1 | 6:2 5:2 | 3:3 2:1 | 1:4', SV2: '4:3 6:1 | 8:2 6:2 | 7:3 5:1 | 5:4',                           // the chart: one long line sung over the cells
      S5: '4:2 6:2 | 5:2 3:2 | 2:2 3:2 | 1:4', FL: '4:6 r:2 | 1:6 r:2 | 2:6 r:2 | 6:8',
    },
    sec: [
      { n: 'pulse', bars: 4, cres: [0.5, 0.6], prog: 'IM7:2 IVM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.36, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.10, reg: [60, 81], gate: 0.5 } },
      { n: 'cell1', bars: 8, lv: 0.64, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.38, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.11, reg: [60, 81], gate: 0.5 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE1 CE1', 'CE1 CE2', 'r4 CE1'], vel: 0.70, art: 0.7, shape: 0.35, swell: 0.2 } },
      { n: 'cell2', bars: 8, lv: 0.68, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.39, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.11, reg: [60, 81], gate: 0.5 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE1 CE2', 'CE4 CE2', 'CE2 CE1', 'CE1 CE1'], vel: 0.72, art: 0.7, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r2 CE1 r2', 'r6 CE1'], oct: 1, vel: 0.2, skip: 0.3 }, drums: { click: 'x.......x.......', vel: 0.3, skip: 0.5 } },
      { n: 'add', bars: 8, lv: 0.7, prog: 'vi7:2 V/IV:2 | IM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.39, gate: 0.6 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.12, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.12, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.9 },
        lead: { ph: ['CE3 CE3', 'CE3 r4', 'r4 CE3'], vel: 0.72, art: 0.8, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r1 CE3 r3', 'r8'], oct: 1, vel: 0.2, skip: 0.3 } },
      { n: 'full', bars: 8, cres: [0.72, 0.82], prog: 'IM7:2 vi9:2 | IVM7:2 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.40, gate: 0.6 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.5 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.12, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.36, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.95 },
        lead: { ph: ['CE3 CE3', 'CE4 CE3', 'CE1 CE3'], vel: 0.74, art: 0.8, shape: 0.35, swell: 0.2 }, lead2: { ph: ['SV1 SV2', 'SV3 SV2'], inst: 'choirOoh', vel: 0.5, shape: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.42 }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'thin', bars: 8, lv: 0.46, prog: 'IVM7:2 IM7:2 | IM7:2 IVM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x...x...x...x...', n: 2, reg: [60, 74], vel: 0.27, gate: 0.6 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.22 }, bass: false,
        lead: { ph: 'FL', inst: 'glass', vel: 0.72, echo: 0.3 }, choir2: { n: 3, reg: [43, 60], vel: 0.1, soft: true } },
      { n: 'full2', bars: 8, cres: [0.74, 0.84], prog: 'vi7:2 V/IV:1 IVM7:1 | Isus4:1 IM7:1 V:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: 'x.x.x.x.', n: 3, reg: [55, 74], vel: 0.40, gate: 0.6 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.55 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.12, reg: [60, 81], gate: 0.5 }, arp2: { p: 'run', vel: 0.36, reg: [62, 88], gate: 0.7 }, bass: { pat: '1-1-', vel: 0.95 },
        lead: { ph: ['CE3 CE3', 'CE3 r4'], vel: 0.74, art: 0.8, shape: 0.35, swell: 0.2 }, lead2: { ph: 'SV1 SV2', inst: 'choirOoh', vel: 0.52, shape: 0.4 }, bell2: { ph: 'SV1 SV2', inst: 'oboe', vel: 0.4, skip: 0.4, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [62, 79], vel: 0.45 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true } },
      { n: 'out', bars: 8, cres: [0.58, 0.4], prog: 'IM7:2 vi7:2 | IVM7:2 IM7:2', pad: { p: 'pulse', inst: { p: 'violas', att: 0.04, rel: 0.15 }, pat: ['x.x.x.x.', 'x.x.x.x.', 'x.x.x.x.', 'x.x.x.x.', 'x...x...', 'x...x...', 'x.......', 'x.......'], n: 3, reg: [55, 74], vel: 0.33, gate: 0.6 }, arp: { pat: '0.1.2.1.', res: 2, vel: 0.10, reg: [60, 81], gate: 0.5 }, bass: { pat: '1---', vel: 0.85 },
        lead: { ph: ['CE1 S5', 'r4 S5'], vel: 0.64, art: 0.8, shape: 0.35, swell: 0.2 } },
    ],
  });

  piece('galaxy17', {
    desc: 'The middle years, the commonwealth: a canon for woodwinds — an oboe states the procession’s theme alone over a walking bassoon and the horns’ soft chord, a clarinet follows it two bars behind, a flute four bars behind, three voices of one tune; a dialogue between the strains, the men for one phrase, a triangle; no strings but the bassoon; the talk between peoples',
    tags: { solitude: 0.1, contact: 1, tension: 0.1, war: 0, grief: 0, grandeur: 0.4, energy: 0.6, dark: 0 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 66, trim: 3.86, root: 'E', mode: 'major', loopFrom: 'theme', tens: false, gentle: true, rubato: 0, eraWin: [0.15, 0.9],
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
        lead: { ph: 'PA PB', vel: 0.56, shape: 0.35, swell: 0.2 } },
      { n: 'talk', bars: 8, lv: 0.64, prog: 'I I vi V | I V ii V:.5 I:.5', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.4 }, bass: { p: 'half', vel: 0.85 }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead: { ph: ['Q1 r2 Q2 r2', 'Q1 r2 Q1 r2'], vel: 0.54, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r2 R1 r2 R2', 'r2 R1 r4'], vel: 0.5, shape: 0.35, swell: 0.2 } },
      { n: 'canon2', bars: 8, lv: 0.66, prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.4 }, bass: { p: 'walk', vel: 0.9 },
        lead: { ph: 'PA PB', vel: 0.56, shape: 0.35, swell: 0.2 }, lead2: { ph: 'r2 PA PB', vel: 0.5, shape: 0.35, swell: 0.2 }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'canon3', bars: 8, lv: 0.7, prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.42 }, bass: { p: 'walk', vel: 0.9 },
        lead: { ph: 'PA PB', vel: 0.56, shape: 0.35, swell: 0.2 }, lead2: { ph: 'r2 PA PB', vel: 0.5, shape: 0.35, swell: 0.2 }, bell2: { ph: 'r4 PA PB', oct: 1, vel: 0.4, shape: 0.35, swell: 0.2 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:2 IV:2', pad: { p: 'swell', n: 3, reg: [50, 69], vel: 0.42 }, pad2: { p: 'swell', n: 2, reg: [43, 60], vel: 0.5 }, bass: false, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead: { ph: ['EP EP2', 'r4 EP2'], vel: 0.5, shape: 0.35, swell: 0.2 }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'canon3b', bars: 8, cres: [0.7, 0.8], prog: 'I I IV V | I vi IV V', pad: { p: 'sus', n: 4, reg: [50, 72], vel: 0.48 }, pad2: { p: 'sus', n: 2, reg: [43, 60], vel: 0.5 }, bass: { p: 'walk', vel: 0.95 },
        lead: { ph: 'PA PB', vel: 0.6, harm: -2, shape: 0.35, swell: 0.2 }, lead2: { ph: 'r2 PA PB', vel: 0.52, shape: 0.35, swell: 0.2 }, bell2: { ph: 'r4 PA PB', oct: 1, vel: 0.42, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [62, 79], vel: 0.46 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true, skip: 0.4 } },
      { n: 'E', bars: 8, cres: [0.56, 0.42], prog: 'I I vi V | I V ii V:.5 I:.5', pad: { p: 'sus', n: 3, reg: [50, 69], vel: 0.38 }, bass: { p: 'half', vel: 0.8 },
        lead: { ph: ['Q1 r2 Q2 r2', 'Q1 r6'], vel: 0.5, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r2 R1 r2 R2', 'r6 R2'], vel: 0.46, shape: 0.35, swell: 0.2 } },
    ],
  });

  piece('galaxy18', {
    desc: 'The middle years, the lanes: a sequence in the Serrie manner — a celeste running in sixteenths with a faint synth pluck on the beats, the analogue pad beneath, the strings over it and an oboe with a tune of its own; the sequence stops for the men in the still, and the horn brings the hymn at the crest with both choirs; the trade lanes between the stars',
    tags: { solitude: 0.3, contact: 0.8, tension: 0.1, war: 0, grief: 0, grandeur: 0.4, energy: 0.6, dark: 0.1 },
    quotes: ['procession'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 66, trim: 4.27, root: 'G', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0, eraWin: [0.15, 0.9], sends: { arp: { verb: 0.14, stage: 0.2 } },
    forms: [['A1', 'A2', 'B', 'still', 'breath', 'A3', 'crest', 'E'], ['A1', 'B', 'still', 'breath', 'A2', 'crest', 'E'], ['A1', 'A2', 'still', 'breath', 'B', 'crest', 'E'], ['A1', 'B', 'A2', 'breath', 'still', 'crest', 'E']],
    alts: [{}, { lead: 'flute', arp: 'vibes' }, { lead: 'clarinet', arp2: 'arp', pad2: 'padGlass' }], eraAlts: { pad2: 'cellos', lead: 'cello', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'analog', bass: 'deep', lead: 'oboe', lead2: 'hornSolo', bell: 'glass', bell2: 'crystal', arp: 'glass', arp2: 'seqSyn', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      LN5: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 1:2',                                               // the lanes' tune drawn toward the commonwealth's climb (the second leitmotif), closing on the tonic
      LN1: '5:3 8:1 | 7:2 6:2 | 5:4 | 3:4', LN2: '4:3 6:1 | 8:2 6:2 | 7:3 5:1 | 5:4',                      // the lanes: the oboe's tune
      LN3: '8:3 7:1 | 6:2 5:2 | 8:2 5:2 | 6:4', LN4: '6:2 8:2 | 7:3 5:1 | 5:2 6:1 7:1 | 7:4',
      H1: '@hymn.H1',
    },
    sec: [
      { n: 'seq', bars: 4, cres: [0.46, 0.58], prog: 'IM7:2 vi7:2', pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.55 }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.4, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.2, reg: [55, 79], gate: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.55 }, pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.2, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN1 LN2', 'LN1 r4', 'r4 LN2'], vel: 0.54, shape: 0.35, swell: 0.2 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.58 }, pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN1 LN2', 'LN5 LN2', 'r4 LN2'], vel: 0.56, shape: 0.35, swell: 0.2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.3, skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'B', bars: 8, lv: 0.64, prog: 'vi7:2 IVM7:2 | IM7:2 V:2', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.6 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 67], vel: 0.5 }, bass: { pat: '1-1-', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.42, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN3 LN4', 'LN3 r4', 'r4 LN4'], vel: 0.56, shape: 0.35, swell: 0.2 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.5 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:4', pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.6 }, pad: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.5 } }, choir2: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [67, 91], skip: 0.3 } },
      { n: 'breath', bars: 1, barsVar: [1, 2], lv: 0.3, prog: 'IM7:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A3', bars: 8, lv: 0.68, prog: 'IM7:2 vi7:2 | IVM7:2 V:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.6 }, pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.44, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.22, reg: [55, 79], gate: 0.5 },
        lead: { ph: ['LN1 LN2', 'LN5 LN2'], vel: 0.56, harm: -2, shape: 0.35, swell: 0.2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.32, skip: 0.4 }, choir: { n: 3, reg: [62, 79], vel: 0.42, soft: true } },
      { n: 'crest', bars: 8, cres: [0.7, 0.84], prog: 'IM7:2 V:2 | IM7:2 V:1.5 Vsus4:.5', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.55 }, bass: { pat: '1-1-', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.55 } }, arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.44, reg: [67, 91], gate: 0.6 }, arp2: { pat: '0...2...1...3...', res: 4, vel: 0.24, reg: [55, 79], gate: 0.5 },
        lead2: { ph: 'H1 H1', vel: 0.58, harm: -2, shape: 0.35, swell: 0.35 }, lead: { ph: ['r4 LN2', 'r8'], vel: 0.5, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.45 } },
      { n: 'E', bars: 8, cres: [0.56, 0.4], prog: 'IM7:2 vi7:2 | IVM7:2 IM7:2', pad: { p: 'sus', n: 3, reg: [50, 72], vel: 0.5 }, pad2: { p: 'swell', n: 2, reg: [52, 72], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.2, rel: 2.4, sub: 0.5 } }, arp: { pat: ['0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.2.3.1.', '0.2.1.3.0.......', '0.2.1...........', '0...............', '0...............'], res: 4, vel: 0.4, reg: [67, 91], gate: 0.6 },
        lead: { ph: ['LN1 r4', 'r4 LN2'], vel: 0.5, shape: 0.35, swell: 0.2 } },
    ],
  });

  piece('galaxy19', {
    desc: 'The middle years, noon: a chorale for brass choir — horns in four parts, the trumpets soft on a chorale strain of its own, trombones beneath, the low brass as the bass, timpani on the step; the strings answer with the title’s hymn as the second strain, the two choirs join the brass at the full, and a plagal amen closes it; the empire at its height',
    tags: { solitude: 0.1, contact: 0.6, tension: 0.1, war: 0.1, grief: 0, grandeur: 1, energy: 0.6, dark: 0 },
    quotes: ['procession'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 68, trim: 3.39, root: 'C', mode: 'major', loopFrom: 'ch1', tens: false, gentle: true, rubato: 0, eraWin: [0.15, 0.9], mix: { choir: 1.15, lead: 1.9 },
    forms: [['ch1', 'str', 'ch2', 'still', 'ch3', 'amen'], ['ch1', 'still', 'str', 'ch2', 'ch3', 'amen'], ['ch1', 'str', 'still', 'ch3', 'amen']],
    alts: [{}, { lead: 'horn', lead2: 'lowBrass' }, { lead: 'hornSolo', pad2: 'strings', lead2: 'cello' }], eraAlts: { pad2: 'lowBrass', lead: 'trombones', choir: 'choirMen' },
    inst: { pad: 'strings', pad2: 'horn', bass: 'lowBrass', lead: 'tpts', lead2: 'trombones', bell: 'glass', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
      NC3: '1:3 2:1 | 3:2 6:2 | 6:3 5:1 | 3:2 2:2',                                                     // the first strain drawn toward the commonwealth's climb (the second leitmotif), bent to the chorale's vi
      NC1: '3:2 5:2 | 6:3 5:1 | 4:2 6:2 | 5:4', NC2: '8:2 10:2 | 6:3 4:1 | 5:2 7:2 | 8:4',                       // the chorale's own first strain: up through the chord, a reach, a close
      H3: '@hymn.H3', H4: '@hymn.H4',            // the hymn's answer (the title), the second strain
      TB: '3:4 | 1:4 | 1:4 | 2:4', TB2: '3:4 | 6:4 | 7:4 | 3:4',                                                  // the trombones beneath the first strain
      T1: '@tide.T1', T2: '@tide.T2',
    },
    sec: [
      { n: 'call', bars: 4, cres: [0.5, 0.62], prog: 'I:2 V:2', pad2: { p: 'swell', n: 3, reg: [50, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'lowBrass', att: 0.2 }, vel: 0.7 }, lead2: { ph: 'T1', vel: 0.5, shape: 0.35, swell: 0.35 }, timp: { p: 'hits', vel: 0.4 } },
      { n: 'ch1', bars: 8, lv: 0.66, prog: 'I vi IV V | I IV V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.8 },
        lead: { ph: ['NC1 NC2', 'NC3 NC2', 'NC1 r4'], vel: 0.45, shape: 0.3, swell: 0.15 }, lead2: { ph: ['TB TB2', 'r4 TB2'], vel: 0.48, shape: 0.35, swell: 0.35 }, timp: { p: 'two', vel: 0.42 } },
      { n: 'str', bars: 8, lv: 0.6, prog: 'I IV vi V | IVM7 I V I', pad: { p: 'sus', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.5 } }, arp: { pat: '0.1.2.3.', res: 2, vel: 0.34, reg: [55, 84] },
        lead: { ph: ['H3 H4', 'H3 r4'], inst: 'strings', vel: 0.55, shape: 0.35 }, lead2: { ph: ['r4 H4', 'r8'], inst: 'cello', oct: -1, vel: 0.46, skip: 0.3, shape: 0.35 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
      { n: 'ch2', bars: 8, cres: [0.72, 0.84], prog: 'I vi IV V | I IV V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.65 }, pad: { p: 'sus', n: 3, reg: [55, 76], vel: 0.45 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.85 },
        lead: { ph: ['NC1 NC2', 'NC3 NC2'], vel: 0.44, harm: -2, shape: 0.3, swell: 0.15 }, lead2: { ph: 'TB TB2', vel: 0.5, shape: 0.35, swell: 0.35 }, bell2: { ph: '@', inst: 'choirWomen', vel: 0.45, shape: 0.4 }, choir: { n: 3, reg: [57, 74], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.5 }, timp: { p: 'two', vel: 0.46 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'I:2 V:2 | I:4', pad: { p: 'swell', n: 3, reg: [52, 74], vel: 0.6 }, pad2: { p: 'swell', n: 3, reg: [50, 69], vel: 0.35 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.5 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [55, 84], skip: 0.4 },
        lead2: { ph: ['TB2', 'r8'], vel: 0.4, shape: 0.35, swell: 0.35 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'ch3', bars: 8, cres: [0.82, 0.96], prog: 'I IV I V | IVM7 I V I', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.7 }, pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'lowBrass', att: 0.1 }, vel: 0.9 },
        lead: { ph: 'H3 H4', inst: 'horn', vel: 0.56, harm: -2, shape: 0.3, swell: 0.2 }, lead2: { ph: 'TB TB2', vel: 0.54, shape: 0.35, swell: 0.35 }, bell2: { ph: 'H3 H4', inst: 'strings', oct: 1, vel: 0.4, shape: 0.35 }, choir: { n: 3, reg: [57, 74], vel: 0.62 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, timp: { p: 'beats', vel: 0.5 }, drums: { bdSoft: 'x...............', vel: 0.35 } },
      { n: 'amen', bars: 8, cres: [0.6, 0.44], prog: 'IV:2 I:2 | IV:2 I:4', pad2: { p: 'sus', n: 4, reg: [50, 72], vel: 0.5 }, pad: { p: 'swell', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'lowBrass', att: 0.2 }, vel: 0.7 },
        lead: { ph: ['r4 T2', 'r8'], inst: 'hornSolo', vel: 0.46, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [62, 79], vel: 0.4, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
    ],
  });

  piece('galaxy11', {
    desc: 'The nebula: a drift in the Serrie manner — the analogue pad and the air pad on chords that change every four bars, sub-bass swelling out of the dark, crotales and a celeste answered by the long delay, an alto flute in a few long notes, the four slow notes in the celeste, the women far back; the strings and the horn’s hymn rise through it once, then it drifts on',
    tags: { solitude: 1, contact: 0.1, tension: 0.1, war: 0, grief: 0, grandeur: 0.3, energy: 0.1, dark: 0.3 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 50, trim: 7.27, root: 'Bb', mode: 'major', loopFrom: 'drift1', tens: false, gentle: true, rubato: 0, mix: { bass: 0.75, bell: 1.2 },
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
        lead: { ph: ['NB1 NB2', 'NB1 r8', 'r8 NB2'], vel: 0.5, echo: 0.35, shape: 0.35, swell: 0.2 }, arp: { pat: '0.......2.......', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.16, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'lights', bars: 8, lv: 0.5, prog: 'IV:4 IM7:4', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.64 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } },
        bell2: { ph: ['FL', 'r2 FL'], vel: 0.44, echo: 0.35 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true }, choir: { n: 2, reg: [67, 81], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'drift2', bars: 16, lv: 0.58, prog: 'IM7:4 IVM7:4 vi7:4 IVM7:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.66 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [50, 72], vel: 0.5 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.2, rel: 2.0 } },
        lead: { ph: ['NB1 NB2', 'r8 NB2'], vel: 0.52, echo: 0.35, shape: 0.35, swell: 0.2 }, arp: { pat: '0...2...', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 2, reg: [67, 81], vel: 0.34, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.5 }, bell: { dens: 0.18, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'rise', bars: 8, cres: [0.62, 0.82], prog: 'IM7:2 V:2 | IM7:2 Vsus4:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.55 } }, arp: { p: 'up8', inst: 'harp', vel: 0.34, reg: [55, 84] },
        lead2: { ph: 'H1 H1', vel: 0.56, harm: -2, shape: 0.35, swell: 0.35 }, lead: { ph: ['r4 NB1'], vel: 0.4, skip: 0.5, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [64, 81], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.45 }, bell: { dens: 0.14, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'IM7:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.34 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'drift3', bars: 16, lv: 0.54, prog: 'IM7:4 IVM7:4 vi7:4 IVM7:2 V:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.68 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.58 }, bass: { pat: ['c---', '1---'], inst: { p: 'subSwell', att: 2.4, rel: 2.0 } },
        lead: { ph: ['NB1 NB2', 'NB2 NB2'], vel: 0.44, echo: 0.3, harm: -2, shape: 0.35, swell: 0.2 }, arp: { pat: '0.......2.......', res: 2, vel: 0.38, reg: [67, 91] }, choir: { n: 3, reg: [64, 81], vel: 0.36, soft: true }, bell: { dens: 0.18, res: 1, reg: [76, 100], vel: 0.44 } },
      { n: 'out', bars: 8, cres: [0.5, 0.36], prog: 'IM7:4 IVM7:4', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.62 }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.56 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.8, rel: 2.4 } },
        lead: { ph: ['NB1', 'r8'], vel: 0.4, echo: 0.3, shape: 0.35, swell: 0.2 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.34 } },
    ],
  });

  piece('galaxy23', {
    desc: 'Calm exploration, the weaver: a nocturne in three over a low, held bed of men\'s voices and soft organ — the alto flute\'s own tune, the men singing a tune in the minor, a few slow harp sweeps over a held pedal, and the game theme once at the return, the flute and the choir together',
    tags: { solitude: 0.75, contact: 0.25, tension: 0, war: 0, grief: 0.15, grandeur: 0.35, energy: 0.2, dark: 0.15 },
    bpm: 63, meter: 3, trim: 5.2,
    root: 'G', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0, quotes: ['procession'],
    eraWin: [0, 0.75],
    orch: true, holdLow: false, hall: 'musikverein', lowBand: 2.5, subBass: 0.8,   // the Tide's and the Abyss's deep foundation beneath the voices
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'B', 'A2', 'E']],
    inst: { pad: 'strings', pad2: 'organSoft', bass: 'deep', lead: 'altoFluteIowa', lead2: 'choirMen', arp: { p: 'harp', rel: 1.8, hold: 1.2, cut: 5200 }, choir: 'choirOoh', choir2: 'choirMen' },
    mix: { lead: 1.5, arp: 1.5, choir: 1.1 },
    ph: {
      W1: '5:3 | 8:2 7:1 | 6:2 5:1 | 3:3 | 4:2 5:1 | 6:2 8:1 | 7:3 | 5:3',          // the flute's tune: up to the octave, and an answering climb
      W2: '6:2 5:1 | 4:2 3:1 | 2:2 3:1 | 5:3 | 4:2 3:1 | 2:2 1:1 | 2:3 | 1:3',          // and the slow way home
      HB1: '3:1 5:1 6:1 | 8:2 7:1 | 6:1 5:1 3:1 | 5:3 | 4:1 6:1 7:1 | 9:2 8:1 | 7:1 6:1 4:1 | 6:3',   // the men's tune: a rising sequence
      HB2: '10:2 9:1 | 8:1 6:2 | 7:2 6:1 | 5:3 | 6:2 5:1 | 4:1 2:2 | 3:2 2:1 | 1:3',                 // and its way down
      PA3: '1:2 2:1 | 3:1 5:2 | 6:2 5:1 | 3:3 | 3:2 2:1 | 3:1 5:2 | 8:2 7:1 | 5:3',          // the game's theme, read in three (the return only)
      PB3: '6:2 5:1 | 4:1 3:2 | 5:2 4:1 | 2:3 | 3:2 4:1 | 5:1 6:2 | 5:2 2:1 | 1:3',
      WE: '5:3 | 8:2 7:1 | 6:3 | 5:3', PE: '4:3 | 3:3 | 2:3 | 1:3',                   // the close: the tune's head, then home
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.32, 0.44], prog: 'I:2 IV:1 I:1', pad2: { p: 'swell', n: 3, reg: [50, 67], vel: 0.42 }, bass: { pat: '1--', pedal: true, vel: 0.5, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.7 } },
        choir2: { n: 3, reg: [43, 57], vel: 0.3, soft: true } },
      // the flute alone over the bed; the harp one soft roll every other bar, ringing within its bar
      { n: 'A1', bars: 16, lv: 0.54, prog: 'I vi IV V | IV vi V V | I IV ii V | ii V V I', pad: { p: 'swell', n: 3, reg: [55, 69], vel: 0.4 }, pad2: { p: 'sus', n: 3, reg: [48, 64], vel: 0.38 },
        bass: { pat: '1--', vel: 0.6, inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.7 } }, arp: { pat: '01234.......', res: 2, gate: 2, vel: 0.24, reg: [50, 67] },
        lead: { ph: 'W1 W2', vel: 0.56, shape: 0.35, swell: 0.25 }, choir2: { n: 3, reg: [43, 57], vel: 0.32, soft: true } },
      // the men's tune in the relative minor, the flute silent; the organ and the women far above
      { n: 'B', bars: 16, lv: 0.62, prog: 'vi I vi V | ii IV ii vi | iii vi V I | IV ii V I', pad2: { p: 'sus', n: 4, reg: [48, 67], vel: 0.48 }, bass: { pat: '1--', vel: 0.62, inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.7 } },
        lead2: { ph: 'HB1 HB2', oct: -1, vel: 0.62, shape: 0.4 }, choir: { n: 2, reg: [67, 79], vel: 0.22, soft: true } },
      // the harp's moment: a few slow sweeps over a held pedal, the men humming
      { n: 'C', bars: 8, lv: 0.46, prog: 'IV:2 ii:1 | V:3', pad2: { p: 'swell', n: 3, reg: [50, 67], vel: 0.36 }, bass: { pat: '1--', pedal: true, vel: 0.5, inst: { p: 'deep', att: 1.4, rel: 2.8, sub: 0.7 } },
        arp: { pat: ['01234567....', '76543210....'], res: 4, gate: 3, vel: 0.26, reg: [48, 84] }, choir2: { n: 3, reg: [43, 57], vel: 0.3, soft: true } },
      // the theme, once: the flute and the choir together, the strings and the men beneath, the harp rolling softly
      { n: 'A2', bars: 16, cres: [0.62, 0.78], prog: 'I V vi iii | I V IV V | I V vi IV | V IV V I', pad: { p: 'sus', n: 4, reg: [55, 74], vel: 0.55 }, pad2: { p: 'sus', n: 3, reg: [48, 64], vel: 0.42 },
        bass: { pat: '1--', vel: 0.7, inst: { p: 'deep', att: 0.6, rel: 1.8, sub: 0.7 } }, arp: { pat: '01234.', res: 2, gate: 2, vel: 0.24, reg: [50, 67] },
        lead: { ph: 'PA3 PB3', vel: 0.6, shape: 0.35, swell: 0.25 }, lead3: { ph: 'PA3 PB3', inst: 'choirOoh', vel: 0.36, shape: 0.4, swell: 0.3 }, choir2: { n: 3, reg: [43, 57], vel: 0.4, soft: true } },
      // the close: the flute's tune, home
      { n: 'E', bars: 8, cres: [0.48, 0.3], prog: 'I IV I V | IV V I I', pad2: { p: 'swell', n: 3, reg: [48, 64], vel: 0.38 }, bass: { pat: '1--', vel: 0.5, inst: { p: 'deep', att: 1.2, rel: 2.6, sub: 0.7 } },
        arp: { pat: '01234.......', res: 2, gate: 2, vel: 0.22, reg: [50, 67] }, lead: { ph: 'WE PE', vel: 0.5, shape: 0.35, swell: 0.25 }, choir2: { n: 3, reg: [43, 57], vel: 0.28, soft: true } },
    ],
  });
})(window.MOO);
