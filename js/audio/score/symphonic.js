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
    'galaxy18': {A1: {arp: 0.09, pad: 0.398, bass: 0.424}, A2: {arp: 0.098, pad: 0.424, bass: 0.45}, B: {arp: 0.156, pad: 0.598, bass: 0.562}, A3: {arp: 0.112, bass: 0.448, pad: 0.846}, crest: {arp: 0.184, bass: 0.211, pad: 0.73, choir: 0.791}, E: {arp: 0.156, bass: 0.575, pad: 0.92}},
    'galaxy19': {call: {bass: 0.61}, ch1: {pad: 0.716, bass: 0.192}, str: {arp: 0.096, bass: 0.606, pad: 0.756}, ch2: {pad: 0.704, bass: 0.391, choir: 0.921}, ch3: {pad: 0.663, bass: 0.619, choir: 0.761}},
    'galaxy11': {drift1: {arp: 0.378, pad: 0.376, bass: 0.344}, drift2: {arp: 0.205, bass: 0.28, pad: 0.576}, rise: {arp: 0.248, pad: 0.312, bass: 0.585, choir: 0.432}, drift3: {arp: 0.275, bass: 0.254, pad: 0.577}},
    'galaxy23': {A1: {arp: 0.168, choir: 0.881}, A2: {arp: 0.23, bass: 0.396, choir: 0.921, pad: 0.98}, E: {arp: 0.152, choir: 0.91}},
    'galaxy13': {W1: {pad: 0.064, bass: 0.348}, W2: {arp: 0.182, pad: 0.033, bass: 0.429}, H: {pad: 0.135, bass: 0.587}, mid: {pad: 0.217, choir: 0.515, bass: 0.03}, W3: {arp: 0.446, pad: 0.297, bass: 0.467}, dawn: {pad: 0.09, bass: 0.511, choir: 0.884}},
    'galaxy20': {M1: {pad: 0.267, bass: 0.242}, M2: {pad: 0.245, bass: 0.253}, trio: {arp: 0.351, pad: 0.247, bass: 0.453, choir: 0.96}, M3: {pad: 0.454, choir: 0.764, bass: 0.96}, M4: {pad: 0.389, bass: 0.694}},
    'galaxy21': {S1: {arp: 0.148, bass: 0.388, pad: 0.679}, S2: {arp: 0.238, pad: 0.331, bass: 0.402, choir: 0.643}, L: {arp: 0.527, pad: 0.717, bass: 0.516}, still: {pad: 0.353, choir: 0.637}, S3: {arp: 0.287, pad: 0.251, bass: 0.091, choir: 0.904}, L2: {pad: 0.284, bass: 0.112, arp: 0.467}, E: {arp: 0.342, bass: 0.7}},
    'galaxy22': {men: {pad: 0.708, bass: 0.365, choir: 0.478}, satb: {bass: 0.309, choir: 0.319, pad: 0.634}, organ: {pad: 0.109, bass: 0.073}, satb2: {pad: 0.095, bass: 0.127, choir: 0.211, arp: 0.245}, still: {pad: 0.241, choir: 0.314}, crest: {pad: 0.324, bass: 0.161, choir: 0.267}, amen: {pad: 0.248, bass: 0.405, choir: 0.476}},
    'galaxy7': {A1: {arp: 0.06, pad: 0.311}, B: {arp: 0.06, pad: 0.166}, A2: {arp: 0.043, pad: 0.209}, C: {arp: 0.057, pad: 0.38}, B2: {arp: 0.034, pad: 0.168, choir: 0.941}, E: {arp: 0.045, pad: 0.24}, breath: {pad: 0.053}},
    'galaxy8': {A1: {bass: 0.567, pad: 0.271}, B: {bass: 0.774}, A2: {pad: 0.517, bass: 0.656}},
    'galaxy9': {A1: {pad: 0.325, bass: 0.74}, B: {bass: 0.578, choir: 0.62, pad: 0.98}, A2: {bass: 0.98}, E: {pad: 0.672, choir: 0.757, bass: 0.828}},
    'galaxy10': {A1: {pad: 0.5, bass: 0.299, choir: 0.269}, B: {pad: 0.48, choir: 0.499}, C: {choir: 0.672}, A2: {pad: 0.408, choir: 0.374}, E: {pad: 0.521, choir: 0.233}},
    'galaxy6': {breath1: {pad: 0.098}, breath2: {pad: 0.475, choir: 0.389}, A1: {pad: 0.281, choir: 0.497, bass: 0.742}, A2: {pad: 0.243, choir: 0.473, bass: 0.683}},
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

  piece('galaxy13', {
    desc: 'The watch: a nocturne — a walking pizzicato bass under harp chords placed off the beat, an air pad far back, and a lone trumpet, very soft, with a line of its own: a fifth, then the octave, and the slow way down; the horn answers once with the procession’s theme and once with the leitmotif from across the ship, the chimes strike midnight, the strings come in only at the end of the watch',
    tags: { solitude: 0.8, contact: 0.3, tension: 0.2, war: 0, grief: 0.2, grandeur: 0.2, energy: 0.2, dark: 0.4 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 56, trim: 6.2, root: 'Ab', mode: 'major', oct: -1, loopFrom: 'W1', tens: false, gentle: true, rubato: 0,
    forms: [['W1', 'W2', 'H', 'mid', 'breath', 'W3', 'dawn', 'E'], ['W1', 'H', 'mid', 'breath', 'W2', 'dawn', 'E'], ['W1', 'W2', 'mid', 'breath', 'H', 'W3', 'E'], ['W1', 'mid', 'breath', 'W2', 'H', 'E']],
    alts: [{}, { lead: 'flute', lead2: 'cello' }, { lead: 'oboe', lead2: 'horn', arp2: 'glass' }], eraAlts: { pad: 'cellos', lead: 'hornSolo', choir: 'choirMen' },
    inst: { pad: 'air', pad2: 'harp', bass: 'pizz', lead: 'tptSolo', lead2: 'hornSolo', bell: 'bell', bell2: 'chime', arp: 'harp', arp2: 'vibes', choir: 'choirWomen', choir2: 'choirMen' },
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
        lead: { ph: ['N1 N2', 'N1 r4', 'r4 N2'], vel: 0.41, shape: 0.35, swell: 0.15 } },
      { n: 'W2', bars: 8, lv: 0.66, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', bass: { pat: ['1-5-', '1-3-'], vel: 0.9 }, pad2: { p: 'stab', pat: '..x...x.', n: 3, reg: [55, 74], vel: 0.6, gate: 1.2 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.36 },
        lead: { ph: ['N1 N2', 'N2 N1'], vel: 0.43, shape: 0.35, swell: 0.15 }, lead2: { ph: ['r4 PA', 'r8'], vel: 0.38, skip: 0.3, shape: 0.35, swell: 0.35 }, arp2: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [67, 86], skip: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 } },
      { n: 'H', bars: 8, lv: 0.62, prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.9 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.55, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.38 },
        lead2: { ph: ['H1 r4', 'K r4'], vel: 0.44, shape: 0.35, swell: 0.35 }, lead: { ph: ['r4 N4', 'N3 N4', 'r4 CD'], vel: 0.43, shape: 0.35, swell: 0.15 }, choir: { n: 2, reg: [65, 79], vel: 0.32, soft: true } },
      { n: 'mid', bars: 8, lv: 0.44, prog: 'Iadd9:2 Vsus4:2 | IVM7:2 I:2', pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.45 }, pad2: { p: 'swell', inst: 'analog', n: 3, reg: [52, 69], vel: 0.5 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.5 } },
        bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.44, echo: 0.3 }, lead2: { ph: ['CM', 'r2 CM'], inst: 'choirMen', oct: -1, vel: 0.4, shape: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.32, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 91], vel: 0.26 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.34 } },
      { n: 'W3', bars: 8, lv: 0.68, prog: 'I Isus2 IVadd9 V | I vi7 IVM7 Vsus4:.5 V:.5', bass: { pat: ['1-5-', '1-3-'], vel: 0.95 }, pad2: { p: 'stab', pat: '..x...x.', n: 3, reg: [55, 74], vel: 0.62, gate: 1.2 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.38 },
        lead: { ph: ['N1 N2', 'N2 N1'], vel: 0.44, harm: -2, shape: 0.35, swell: 0.15 }, lead2: { ph: '@', vel: 0.36, skip: 0.3, shape: 0.35, swell: 0.35 }, arp2: { pat: '0.......2.......', res: 2, vel: 0.32, reg: [67, 86] }, choir: { n: 3, reg: [62, 79], vel: 0.4 } },
      { n: 'dawn', bars: 8, cres: [0.66, 0.76], prog: 'I V I IV:.5 V:.5 | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.95 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.55, gate: 1.4 }, pad: { p: 'sus', inst: 'strings', n: 4, reg: [50, 76], vel: 0.6 },
        lead2: { ph: 'H1 r4', vel: 0.46, shape: 0.35, swell: 0.35 }, lead: { ph: ['N3 N4', 'r4 N4'], vel: 0.46, harm: -2, shape: 0.35, swell: 0.15 }, choir: { n: 3, reg: [62, 79], vel: 0.48 }, choir2: { n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 91], vel: 0.26 } },
      { n: 'E', bars: 8, cres: [0.56, 0.42], prog: 'I Isus2 IVadd9 V | IVM7 Vsus4 I:.5 V7:.5 I', bass: { pat: '1-5-', vel: 0.85 }, pad2: { p: 'stab', pat: '..x.....', n: 3, reg: [55, 74], vel: 0.5, gate: 1.4 }, pad: { p: 'swell', n: 2, reg: [72, 88], vel: 0.34 },
        lead: { ph: ['N1 r4', 'r4 N2', 'N1 N2'], vel: 0.41, shape: 0.35, swell: 0.15 } },
    ],
  });

  piece('galaxy20', {
    desc: 'The late years, the frontier: a slow march — field drums at a whisper, the tuba on the step, the trombones with a dotted march theme of their own, the men chanting beneath, tubular bells; the strings tremble in the trio while the horn plays the hymn, a side-drum roll leads to the crest where the trombones intone the hymn at half speed, the drums fall silent for the phrygian step of the abyss; the border, held',
    tags: { solitude: 0.2, contact: 0.3, tension: 0.8, war: 0.8, grief: 0.3, grandeur: 0.7, energy: 0.4, dark: 0.7 },
    quotes: ['abyss'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 44, trim: 5.23, root: 'F#', mode: 'minor', oct: -1, loopFrom: 'M1', tens: false, gentle: true, rubato: 0, eraWin: [0.4, 1], mix: { bass: 0.9, choir: 1.1, drums: 0.9, lead: 2.6 }, sends: { drums: { stage: 0.08, verb: 0.05, dly: 0 } },
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
        lead: { ph: 'MT', vel: 0.52, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true } },
      { n: 'M2', bars: 8, lv: 0.68, prog: 'i:2 bVII bVI i:2 iv V', pad: { p: 'sus', n: 3, reg: [45, 69], vel: 0.6 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.36 },
        lead: { ph: 'MT', vel: 0.54, shape: 0.35, swell: 0.35 }, lead2: { ph: 'CMF', inst: 'choirMen', oct: -1, vel: 0.44, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 0.45, soft: true }, bell2: { ph: ['r4 CH', 'r8'], oct: 0, vel: 0.36, skip: 0.3 } },
      { n: 'trio', bars: 8, lv: 0.56, prog: 'i bVII i iv:.5 V:.5 | bVIM7 iv V i', pad2: { p: 'swell', n: 3, reg: [45, 66], vel: 0.5 }, pad: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.0, rel: 2.2, sub: 0.55 } }, arp: { pat: '0.......2.......', res: 2, vel: 0.3, reg: [52, 76] },
        lead2: { ph: ['H1 TA', 'H1 r4'], inst: 'horn', vel: 0.52, shape: 0.35, swell: 0.35 }, choir2: { n: 3, reg: [57, 74], vel: 0.36, soft: true } },
      { n: 'M3', bars: 8, cres: [0.7, 0.84], prog: 'i bVII i iv:.5 V:.5 | bVI iv V i', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.65 }, pad2: { p: 'swell', n: 3, reg: [45, 66], vel: 0.45 }, bass: { pat: ['1---', '1---', '1---', '1-1-', '1---', '1---', '1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.4 }, fill: 'rollS',
        lead2: { ph: 'H1 TA', inst: 'horn', vel: 0.58, harm: -2, shape: 0.35, swell: 0.35 }, lead: { ph: ['r4 TA', 'r8'], vel: 0.52, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.62 }, choir2: { n: 3, reg: [57, 74], vel: 0.42, skip: 0.4 }, timp: { p: 'two', vel: 0.42 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i bII i:2 | i bII i:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: 'c---', pedal: true, inst: { p: 'tuba', att: 1.2, rel: 2.4 } },
        lead: { ph: ['Z Z', 'r4 Z'], inst: 'cello', vel: 0.5, shape: 0.35 }, bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.4, echo: 0.3 }, choir: { n: 3, reg: [43, 60], vel: 0.4, soft: true } },
      { n: 'M4', bars: 8, cres: [0.76, 0.9], prog: 'i:2 bVII bVI i:2 iv V', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.65 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.4, rel: 1.6 } }, drums: { bd: 'x.......x.......', sn: ['x...x...x...x...', 'x...x...x...x.x.'], vel: 0.42 }, fill: 'rollS',
        lead: { ph: 'HA', vel: 0.58, harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'CMF', inst: 'choirMen', oct: -1, vel: 0.48, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 0.65 }, choir2: { n: 3, reg: [57, 74], vel: 0.45 }, timp: { p: 'two', vel: 0.45 } },
      { n: 'E', bars: 8, cres: [0.58, 0.4], prog: 'i:2 bVII bVI i:2 iv i', pad: { p: 'sus', n: 3, reg: [45, 69], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'tuba', att: 0.6, rel: 1.8 } }, drums: { bd: 'x.......x.......', sn: ['....x.......x...', '....x.......x...', '....x.......x...', '....x...........', '....x...........', '................', '....x...........', '................'], vel: 0.3 },
        lead: { ph: ['MT', 'r8'], vel: 0.48, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, bell2: { ph: ['r4 CH', 'r6 CH'], oct: 0, vel: 0.36, skip: 0.4 } },
    ],
  });

  piece('galaxy21', {
    desc: 'The late years, the embers: a sarabande — the low strings place the dance’s stressed second beat in every bar, the harp answers on the third, a cor anglais carries a sarabande melody with the long second beat, and in the middle turns the leitmotif upside down (the fourth falls, the steps climb back) over the lament’s descending bass from the passacaglia; the cellos tremble and a timpani roll leads to the crest, the women above it; what the wars cost',
    tags: { solitude: 0.3, contact: 0.2, tension: 0.5, war: 0.4, grief: 1, grandeur: 0.3, energy: 0.3, dark: 0.8 },
    quotes: ['hymn'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 54, meter: 3, trim: 4.84, root: 'C#', mode: 'minor', loopFrom: 'S1', tens: false, gentle: true, rubato: 0, eraWin: [0.4, 1],
    forms: [['S1', 'S2', 'L', 'still', 'breath', 'S3', 'L2', 'E'], ['S1', 'L', 'still', 'breath', 'S2', 'L2', 'E'], ['S1', 'S2', 'still', 'breath', 'L', 'S3', 'E']],
    alts: [{}, { lead: 'altoFlute', lead2: 'horn' }, { lead: 'cello', pad2: 'cellos', arp: 'pizz' }],
    inst: { pad: 'cellos', pad2: 'strings', bass: 'deep', lead: 'reed', lead2: 'cello', bell: 'chime', arp: 'harp', choir: 'choirWomen', choir2: 'choirMen' },
    ph: {
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
        lead: { ph: ['E1 E2', 'E1 r4', 'r4 E2'], vel: 0.58 }, lead2: { ph: 'LB LB', oct: -1, vel: 0.52, shape: 0.35 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true, skip: 0.3 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i bVII bVI V | i bVII bVI i', pad: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 66], vel: 0.48 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.42 }, bass: { pat: '1--', pedal: true, inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.55 } },
        lead2: { ph: 'LB LB', oct: -1, vel: 0.48, shape: 0.35 }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, timp: { kick: '................', roll: 2, vel: 0.42 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:4', tens: false, pad2: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'S3', bars: 8, cres: [0.68, 0.78], prog: 'i bVI bIII iv | i bVI iv V', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.74, gate: 1.0 }, pad2: { p: 'sus', n: 3, reg: [55, 76], vel: 0.5 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.4, reg: [55, 79] },
        lead: { ph: ['SB1 SB2', 'HI SB2'], vel: 0.6, harm: -2 }, lead2: { ph: '@', inst: 'cello', oct: -1, vel: 0.44, skip: 0.4, shape: 0.35 }, choir: { n: 3, reg: [62, 79], vel: 0.44, soft: true }, choir2: { n: 3, reg: [43, 60], vel: 0.36, soft: true } },
      { n: 'L2', bars: 8, cres: [0.74, 0.86], prog: 'i bVII bVI V | i bVII bVI i', pad: { p: 'stab', pat: 'x.x...', n: 4, reg: [45, 66], vel: 0.76, gate: 1.0 }, pad2: { p: 'swell', inst: 'tremLo', n: 3, reg: [45, 66], vel: 0.55 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.3, rel: 1.6, sub: 0.6 } }, arp: { pat: '....02', res: 2, vel: 0.4, reg: [55, 79] },
        lead: { ph: 'E1 E2', vel: 0.62, harm: -2 }, lead2: { ph: 'LB LB', oct: -1, vel: 0.54, shape: 0.35 }, choir: { n: 3, reg: [62, 79], vel: 0.52 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, timp: { kick: 'X..', vel: 0.4 } },
      { n: 'E', bars: 8, cres: [0.56, 0.4], prog: 'i bVI bIII iv | i bVII bVI i', pad: { p: 'stab', pat: 'x.x...', n: 3, reg: [45, 64], vel: 0.6, gate: 1.0 }, bass: { pat: '1--', inst: { p: 'deep', att: 0.4, rel: 1.8, sub: 0.55 } }, arp: { pat: '....02', res: 2, vel: 0.34, reg: [55, 79] },
        lead: { ph: ['SB1 E2', 'r4 E2'], vel: 0.52 } },
    ],
  });

  piece('galaxy22', {
    desc: 'The late years, the vigil: a sung chorale — the men alone at first on the chorale of the tenth piece, then the women above them in octaves, the organ beneath as a pedal, tubular bells; the organ takes a verse of its own, the women rise to a descant over the men’s second strain, the brass comes in only at the crest with timpani; the council’s hymn as the last verse; the long night watch of an old empire',
    tags: { solitude: 0.3, contact: 0.3, tension: 0.5, war: 0.4, grief: 0.6, grandeur: 0.8, energy: 0.3, dark: 0.7 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 48, trim: 4.27, root: 'F', mode: 'minor', loopFrom: 'men', tens: false, gentle: true, rubato: 0, eraWin: [0.4, 1], mix: { choir: 1.2, lead: 1.1, pad: 1.0 },
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
      { n: 'pedal', bars: 4, cres: [0.42, 0.54], prog: 'i:2 bVI:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 1.0, rel: 2.2 } }, bell2: { ph: ['r2 CH', 'CH r2'], oct: 0, vel: 0.24, echo: 0.3 } },
      { n: 'men', bars: 8, lv: 0.6, prog: 'i iv i bVI | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead2: { ph: ['HY1 HY2', 'HY1 r4'], oct: -1, vel: 0.6, shape: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.45, soft: true } },
      { n: 'satb', bars: 8, lv: 0.68, prog: 'i iv i bVI | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead: { ph: 'HY1 HY2', vel: 0.55, shape: 0.4 }, lead2: { ph: 'HY1 HY2', oct: -1, vel: 0.6, shape: 0.4 }, choir: { n: 3, reg: [60, 77], vel: 0.5 }, choir2: { n: 3, reg: [43, 60], vel: 0.55 } },
      { n: 'organ', bars: 8, lv: 0.6, prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', inst: 'organ', n: 4, reg: [48, 72], vel: 0.75 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.4, rel: 1.6 } },
        lead: { ph: ['OV OV2', 'OV r4'], inst: 'organ', vel: 0.6 }, bell2: { ph: ['r4 CH', 'r8'], oct: 0, vel: 0.36, skip: 0.4 } },
      { n: 'satb2', bars: 8, cres: [0.7, 0.8], prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', n: 4, reg: [45, 69], vel: 0.6 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [48, 67], vel: 0.5 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.7, att: 0.4, rel: 1.6 } },
        lead: { ph: 'DS1 DS2', vel: 0.58, shape: 0.4 }, lead2: { ph: 'HY3 HY4', oct: -1, vel: 0.62, shape: 0.4 }, choir: { n: 3, reg: [60, 77], vel: 0.55 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, arp: { pat: '0...2...', res: 2, vel: 0.3, reg: [55, 84], skip: 0.3 } },
      { n: 'still', bars: 8, lv: 0.46, prog: 'i:2 bVI:2 | bVII:2 i:2', pad: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 1.2, rel: 2.4 } },
        lead2: { ph: 'CM2', oct: -1, vel: 0.5, shape: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.32, soft: true }, bell2: { ph: ['CH', 'r2 CH'], oct: 0, vel: 0.38, echo: 0.3 } },
      { n: 'crest', bars: 8, cres: [0.82, 0.96], prog: 'i bIII bVII iv | bVII iv V i', pad: { p: 'sus', inst: 'organ', n: 4, reg: [48, 72], vel: 0.72 }, pad2: { p: 'sus', n: 3, reg: [50, 69], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.3, rel: 1.4 } },
        lead: { ph: 'DS1 DS2', vel: 0.62, shape: 0.4 }, lead2: { ph: 'HY3 HY4', oct: -1, vel: 0.66, shape: 0.4 }, bell2: { ph: 'HY3 HY4', inst: 'horn', vel: 0.5, harm: -2, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [60, 77], vel: 0.7 }, choir2: { n: 3, reg: [43, 60], vel: 0.75 }, timp: { p: 'two', vel: 0.45 }, drums: { bdSoft: 'x...............', vel: 0.3 } },
      { n: 'amen', bars: 8, cres: [0.62, 0.44], prog: 'i bVI i iv | bVI iv V i', pad: { p: 'sus', n: 3, reg: [45, 67], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.65, att: 0.6, rel: 1.8 } },
        lead: { ph: ['HY HY2', 'HY r4'], vel: 0.52, shape: 0.4 }, lead2: { ph: ['HY HY2', 'HY r4'], oct: -1, vel: 0.56, shape: 0.4 }, choir2: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true } },
    ],
  });

  piece('galaxy6', {
    desc: 'Calm exploration, the abyss: the dark between the stars — the ship\u2019s soft organ and the analogue drone on a sunken pedal, a bassoon far below, an alto flute far above, the men chanting the phrygian step; the flat second held against the tonic where it is the point; sparse, uneasy, patient',
    tags: { solitude: 0.6, contact: 0.2, tension: 0.7, war: 0.4, grief: 0.4, grandeur: 0.2, energy: 0.1, dark: 1 },
    quotes: ['men'],
    orch: true, holdLow: false, hall: 'musikverein', bpm: 46, trim: 4.68, root: 'E', mode: 'phrygian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0, mix: { bass: 0.8, lead: 2.1 },
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
        lead: { ph: ['Z1 Z2 Z1b Z2','Z1b Z2 Z1 Z2','Z1 Z2 Z1 Z2'], rest: 0.15, vel: 0.5, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r3 AF r5','r11 AF'], vel: 0.42, skip: 0.3, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath1', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [64, 88], vel: 0.36 } },
      { n: 'B', bars: 16, lv: 0.6, prog: 'i bVI bVI i | iv i bII i | i bVI bVI i | iv i bII i', pad: { p: 'sus', inst: 'strings', n: 3, reg: [48, 70] }, pad2: { p: 'swell', inst: 'cellos', n: 3, reg: [45, 67], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z3 Z4 Z3 Z4','Z3 Z4 r4 Z4','Z3 r4 Z3 Z4'], vel: 0.52, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [43, 60], vel: 0.4, soft: true }, choir2: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.5 },
        drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'i:2 bII:2 | i:2 i:2', pad: { p: 'swell', n: 3, reg: [45, 67] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        lead2: { ph: ['CM','r8'], inst: 'choirMen', oct: -1, vel: 0.42, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 0.36, soft: true }, bell: { dens: 0.1, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'breath2', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'i:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.6, prog: 'i bVI i bVI | bVI bII i i | i bVI i bVI | bVI bII i i', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } },
        lead: { ph: ['Z1 Z2 Z1b Z2','Z1b Z2 Z1 Z2'], vel: 0.52, shape: 0.35, swell: 0.2 }, lead2: { ph: ['r3 AF r5','r11 AF'], vel: 0.44, skip: 0.25, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [43, 60], vel: 0.42, soft: true }, choir2: { n: 2, reg: [62, 76], vel: 0.3, soft: true, skip: 0.4 }, drums: { bdSoft: 'x...............', vel: 0.3, skip: 0.5 }, bell: { dens: 0.08, res: 1, reg: [64, 88], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.48, prog: 'bVI bII i i | bVI bII i i', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['Z2 Z2','Z2 r4','r4 Z2'], vel: 0.48, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [43, 60], vel: 0.34, soft: true }, bell: { dens: 0.06, res: 1, reg: [64, 88], vel: 0.4 } },
    ],
  });

  piece('galaxy7', {
    desc: 'Calm exploration, the cradle: a lullaby in six — a rocking harp, a clarinet humming the tune, glockenspiel points, the women humming, the men beneath; the ship asleep between the stars',
    tags: { solitude: 0.9, contact: 0.2, tension: 0, war: 0, grief: 0.1, grandeur: 0, energy: 0.3, dark: 0 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 156, meter: 6, trim: 3.2, root: 'F', mode: 'major', loopFrom: 'A1', tens: false, gentle: true, rubato: 0,
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
        lead: { ph: ['L1 L2 L1b L2b','L1b L2 L1 L2b','L1 L2b L1b L2'], vel: 0.58, shape: 0.35, swell: 0.2 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'A2', bars: 16, lv: 0.7, prog: 'I V vi V | I V ii I | I V vi V | I V ii I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4, skip: 0.3 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 81] },
        lead: { ph: ['L1 L2 L1b L2b','L1b L2b L1 L2'], vel: 0.6, shape: 0.35, swell: 0.2 }, lead2: { ph: '@', inst: 'glass', oct: 1, vel: 0.34, skip: 0.4, rest: 0.3 }, choir: { n: 2, reg: [65, 79], vel: 0.36, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'B', bars: 16, lv: 0.64, prog: 'I IV V IV | vi ii V I | I IV V IV | vi ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.38, reg: [53, 81] },
        lead: { ph: ['L3 L4 L3 L4','L3 L4 L3 r4','r4 L4 L3 L4'], vel: 0.58, shape: 0.35, swell: 0.2 }, lead2: { ph: 'GL GL GL GL', inst: 'glass', vel: 0.32, skip: 0.4, rest: 0.4 }, choir: { n: 2, reg: [65, 79], vel: 0.34, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.46, prog: 'vi:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.42 }, bass: false, lead: { ph: ['GL GL', 'r4 GL'], inst: 'glass', vel: 0.42, echo: 0.3 }, arp: { inst: 'harp', pat: '0.1.2.', res: 1, vel: 0.34, reg: [53, 81] }, choir: { n: 2, reg: [65, 79], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:4', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A3', bars: 16, lv: 0.7, prog: 'I V vi V | I V ii I | I V vi V | I V ii I', pad: 'sus', pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.4 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.42, reg: [53, 83] },
        lead: { ph: ['L1 L2 L1b L2b','L1 L2 L1 L2b'], vel: 0.6, shape: 0.35, swell: 0.2 }, lead2: { ph: '@', inst: 'flute', oct: 1, vel: 0.34, skip: 0.3, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [62, 79], vel: 0.5 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'B2', bars: 16, lv: 0.66, prog: 'I IV V IV | vi ii V I | I IV V IV | vi ii V I', pad: { p: 'sus', inst: 'strings' }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [45, 64], vel: 0.55 }, bass: { pat: '1..5..', inst: { p: 'deep', att: 0.5, rel: 1.4, sub: 0.45 } }, arp: { pat: '012021', res: 1, vel: 0.4, reg: [53, 83] },
        lead: { ph: ['L3 L4 L3 L4','L3 L4 L3 r4'], vel: 0.6, shape: 0.35, swell: 0.2 }, choir: { n: 3, reg: [62, 79], vel: 0.55 }, choir2: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.3, soft: true, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.42 } },
      { n: 'E', bars: 8, lv: 0.54, prog: 'I V vi V | vi ii V I', pad: 'sus', bass: { pat: '1.....', inst: { p: 'deep', att: 0.8, rel: 2.0, sub: 0.45 } }, arp: { pat: '0.1.2.', res: 1, vel: 0.34, reg: [53, 81] },
        lead: { ph: ['L1 L4','L1b L4','r4 L4'], vel: 0.54, shape: 0.35, swell: 0.2 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
    ],
  });

  piece('galaxy8', {
    desc: 'Calm exploration, the beacon: soft horn chords and the low brass on a sunken pedal swaying between two chords, slow pizzicato, a horn calling the leitmotif from very far away, crotales and tubular bells answered by the delay; a signal from the edge',
    tags: { solitude: 0.8, contact: 0.3, tension: 0.3, war: 0, grief: 0.1, grandeur: 0.3, energy: 0.2, dark: 0.4 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 46, trim: 3.23, root: 'C', mode: 'mixolydian', loopFrom: 'A1', tens: false, gentle: true, rubato: 0, mix: { bass: 0.85, pad: 0.6, lead: 2.4 },
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
      { n: 'A1', bars: 16, lv: 0.58, prog: 'I:2 bVIIM7:2 | I:2 bVII:2 | Isus4:2 bVIIM7:2 | I:2 bVII:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.34, reg: [50, 72], skip: 0.3 },
        lead: { ph: ['K1 K2 K1 K4','K1 K2 r4 K4','r4 K1 K2 K4'], vel: 0.42, shape: 0.35, swell: 0.35 }, lead2: { ph: ['r8 CR r4', 'r12 CR'], vel: 0.34, oct: 1, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
      { n: 'B', bars: 8, lv: 0.6, prog: 'IV I IV I | I I bVII I', pad: { p: 'sus', n: 3, reg: [50, 69] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.4, rel: 2.6, sub: 0.55 } }, arp: { pat: '0...2...1...3...', res: 4, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K3 K4','K3 r4','r4 K4'], vel: 0.46, shape: 0.35, swell: 0.35 }, lead2: { ph: ['CR CR', 'r4 CR'], vel: 0.34, oct: 1, skip: 0.35, rest: 0.3 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'C', bars: 8, lv: 0.44, prog: 'I:4 | bVII:4', pad: { p: 'swell', n: 3, reg: [52, 74] }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.45 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 2.0, rel: 3.0, sub: 0.65 } },
        bell2: { ph: ['CH', 'r2 CH'], vel: 0.42, echo: 0.3 }, lead2: { ph: ['r4 CR', 'CR r4'], vel: 0.32, oct: 1, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'breath', bars: 2, barsVar: [1, 2], lv: 0.3, prog: 'I:8', tens: false, pad: { p: 'swell', n: 2, reg: [62, 79], vel: 0.32 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.32 } },
      { n: 'A2', bars: 16, lv: 0.62, prog: 'I:2 bVII:2 | Isus4:2 bVIIM7:2 | Isus4:2 bVIIM7:2 | I:2 bVII:2', pad: 'sus', pad2: { p: 'swell', n: 3, reg: [45, 67], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 1.6, rel: 2.8, sub: 0.6 } }, arp: { pat: '0...2...', res: 2, vel: 0.36, reg: [50, 74] },
        lead: { ph: ['K1 K2 K1 K4','r4 K2 K1 K4'], vel: 0.46, shape: 0.35, swell: 0.35 }, lead2: { ph: ['r4 K1 K2 K4', 'r8 K1 K4'], inst: 'tptSolo', vel: 0.36, skip: 0.3, shape: 0.35, swell: 0.35 }, bell2: { ph: ['r8 CH', 'r12 CH'], vel: 0.38, skip: 0.4 }, bell: { dens: 0.12, res: 1, reg: [76, 100], vel: 0.4 } },
      { n: 'E', bars: 8, lv: 0.5, prog: 'I:2 bVIIM7:2 | I:2 bVII:2', pad: 'sus', bass: { pat: '1---', pedal: true, inst: { p: 'deep', att: 1.8, rel: 3.0, sub: 0.6 } }, lead: { ph: ['K1 r4','K4 r4','r4 K1'], vel: 0.42, shape: 0.35, swell: 0.35 }, bell2: { ph: ['r4 CH', 'r6 CH'], vel: 0.36, skip: 0.4 }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.38 } },
    ],
  });

  piece('galaxy9', {
    desc: 'The tide — deep bass swells rising out of the dark, the analogue sky and cellos over them, low brass and the men entering, the hymn in the horns at the crest; rare on the map, and felt when it comes',
    tags: { solitude: 0.3, contact: 0.3, tension: 0.7, war: 0.6, grief: 0.3, grandeur: 0.9, energy: 0.6, dark: 0.6 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 54, trim: 2.52, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0, mix: { bass: 1.25, choir: 1.2, pad: 1.05, lead: 1.4 },
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
        lead: { ph: ['T1 T2 H1 T3','T1 T2 r4 T3','T1 T2 H1 r4'], vel: 0.6, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
      { n: 'B', bars: 8, lv: 0.95, hit: 'tam', cr: true, prog: 'i bVI i V7 | i bVII iv V', pad: { p: 'sus', n: 3, reg: [48, 69], vel: 0.8 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.6 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.2, rel: 1.6 } },
        lead: { ph: ['H1 T3','H1 r4'], vel: 0.85, harm: -2, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.9 }, choir2: { n: 3, reg: [57, 74], vel: 0.5, skip: 0.4 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:4 | i:2 bVI:2', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.0 } }, choir: { n: 3, reg: [43, 60], vel: 0.45, soft: true }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.85, 1.08], hit: 'tam', prog: 'i bVI i iv | i bVI i bVII | i bVI i V7 | i bVII iv V', pad: { p: 'sus', n: 3, reg: [48, 69], vel: 0.8 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 }, bass: { pat: 'c---', inst: { p: 'subSwell', att: 1.6, rel: 1.6 } },
        lead: { ph: ['T1 T2 H1 T3','r4 T2 H1 T3'], inst: 'brass', vel: 0.95, harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: ['r8 H1 r4','r8 H1 T3','r4 H1 H1 r4'], inst: 'choirMen', oct: -1, vel: 0.8, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.6 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.55, prog: 'i bVI i bVII | i bVI i i', pad: { p: 'swell', n: 3, reg: [48, 69], vel: 0.65 }, bass: { pat: 'c---', pedal: true, inst: { p: 'subSwell', att: 2.6, rel: 2.2 } }, lead: { ph: ['r4 H1','T2 r4','T2 H1'], inst: 'hornSolo', vel: 0.55, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
    ],
  });

  piece('galaxy10', {
    desc: 'The chorale — the men’s choir carries everything: a hymn sung low over the organ and the analogue bed, a horn counter-line, the women joining at the crest, timpani underneath; rare on the map',
    tags: { solitude: 0.3, contact: 0.4, tension: 0.3, war: 0.3, grief: 0.4, grandeur: 0.9, energy: 0.4, dark: 0.5 },
    orch: true, holdLow: false, hall: 'musikverein', bpm: 64, trim: 1.69, root: 'G', mode: 'minor', loopFrom: 'A1', tens: false, rubato: 0, mix: { choir: 1.4, bass: 1.1, lead: 1.3 },
    forms: [['A1', 'B', 'C', 'A2', 'E'], ['A1', 'C', 'A2', 'B', 'E'], ['A1', 'B', 'A2', 'C', 'E']],
    alts: [{}, { pad: 'organSoft', lead: 'cello' }, { pad2: 'cellos', choir2: 'choirWomen' }],
    inst: { pad: 'organ', pad2: 'lowBrass', bass: 'deep', lead: 'horn', lead2: 'choirMen', bell: 'glass', choir: 'choirMen', choir2: 'aah' },
    ph: {
      HY1: '@chorale.HY1', HY2: '@chorale.HY2',     // the chorale, two lines
      HY3: '@chorale.HY3', HY4: '@chorale.HY4',     // its answer, higher
      CT: '@hymn.CT',                                             // the horn beneath
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.62], prog: 'i:2 bVI:2', pad: { p: 'swell', n: 4, reg: [48, 72], vel: 0.85 }, pad2: { p: 'swell', n: 3, reg: [48, 69], vel: 0.5 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.0 } }, choir: { n: 3, reg: [43, 60], vel: 0.5, soft: true } },
      { n: 'A1', bars: 16, cres: [0.68, 0.82], prog: 'i bVII V7 i | i iv V i | i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.8 }, pad2: { p: 'sus', n: 3, reg: [52, 69], vel: 0.55 }, bass: { pat: ['1---', 'c---'], inst: { p: 'deep', sub: 0.75, att: 0.5, rel: 1.6 } },
        lead2: { ph: ['HY1 HY2 HY3 HY4'], inst: 'choirMen', oct: -1, vel: 0.85, shape: 0.4 }, lead: { ph: ['r8 CT r4','r16'], vel: 0.5, skip: 0.3, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 0.75 } },
      { n: 'B', bars: 8, lv: 1.0, hit: 'tam', cr: true, prog: 'i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.75 }, pad2: { p: 'sus', n: 3, reg: [52, 69], vel: 0.75 }, bass: { pat: 'c---', inst: { p: 'deep', sub: 0.85, att: 0.4, rel: 1.4 } },
        lead2: { ph: ['HY3 HY4'], inst: 'choirMen', oct: -1, vel: 1.0, shape: 0.4 }, lead: { ph: ['HY3 HY4'], vel: 0.75, harm: -2, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 1.0 }, choir2: { n: 3, reg: [57, 76], vel: 0.65 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i bVII V7 i | i iv V i', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.6 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.85, att: 1.2, rel: 2.4 } }, lead2: { ph: ['HY1 HY2','r4 HY2'], inst: 'choirMen', oct: -1, vel: 0.6, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 0.55, soft: true }, rise: 2 },
      { n: 'A2', bars: 16, cres: [0.88, 1.1], hit: 'tam', prog: 'i bVII V7 i | i iv V i | i bVII bVIM7 bVII | bVIM7 iv V i', pad: { p: 'sus', n: 4, reg: [48, 72], vel: 0.7 }, pad2: { p: 'sus', n: 3, reg: [52, 69], vel: 0.85 }, bass: { pat: ['c---', 'c---', '1---', 'c---'], inst: { p: 'deep', sub: 0.9, att: 0.3, rel: 1.4 } },
        lead2: { ph: ['HY1 HY2 HY3 HY4'], inst: 'choirMen', oct: -1, vel: 1.0, shape: 0.4 }, lead: { ph: '@', inst: 'horn', vel: 0.7, harm: -2, shape: 0.35, swell: 0.35 }, choir: { n: 3, reg: [43, 60], vel: 1.05 }, choir2: { n: 3, reg: [57, 76], vel: 0.7 }, timp: 'beats' },
      { n: 'E', bars: 8, lv: 0.58, prog: 'i iv V i | bVIM7 iv V i', pad: { p: 'sus', n: 3, reg: [48, 72], vel: 0.8 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 0.8, rel: 2.2 } }, lead2: { ph: ['HY2 HY4','r4 HY4'], inst: 'choirMen', oct: -1, vel: 0.7, shape: 0.4 }, choir: { n: 3, reg: [43, 60], vel: 0.6, soft: true } },
    ],
  });
})(window.MOO);
