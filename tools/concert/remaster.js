// Remasters of the game's own pieces: each piece exactly as the game's score writes it (js/audio/score), played and mixed with what the
// concert suite learned — the concert stage with a register and a channel EQ for every section, pure-tuned chords, a professional
// ensemble on or behind the beat, every note started as its recording speaks, slides for soloists only, clean timpani, the low strings
// with their bow, a clean sub in a register of its own, the clearer hall and the flat concert master.
//   node tools/concert/render.js --score remaster.js
// Loaded after tools/concert/suite.js (it borrows the suite's stage and its register plan). Nothing here is part of the game.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define, K = window.CONCERT_KIT;
  const clone = id => { const d = JSON.parse(JSON.stringify(Music._tracks[id])); delete d._p; delete d.id; delete d._sym; return d; };
  // the suite's stage over the piece's own settings, the piece's notes and form untouched; then the suite's register plan
  function remaster(id, own) {
    const d = clone(id);
    for (const k of ['mix', 'sends', 'fx', 'lowBand', 'tone', 'accept']) delete d[k];   // the game's mix was made for the game's master and its compressors
    Object.assign(d, JSON.parse(JSON.stringify(K.STAGE)), { hidden: true, loopFrom: undefined, forms: undefined }, own || {});
    d.mix = Object.assign({ lead: 1.4, pad: 1.0, choir: 1.2, arp: 0.85, bell: 0.9 }, (own && own.mix) || {});
    return K.clarify(d);
  }

  // The main theme: the commonwealth's tune as a question on the cor anglais, the brooding interlude on the cello and the horn, the theme
  // building to the climax, the majestic rise and resolution, the release, the echo, the conclusion (js/audio/score/cues.js, 'title')
  Track('remaster:title', remaster('title', { desc: 'Remaster: the main theme', trim: 0.62 }));

  // =====================================================================================================================================
  // The main theme, rewritten: the title's own material and the score's two leitmotifs, in the manner the suite arrived at — a register
  // for every section, a legato tune over a short motor with a counter-melody moving in its gaps, the texture built a layer at a time to
  // the full orchestra and broken apart again, the full orchestra only at the peaks.
  // =====================================================================================================================================
  const E16 = '................', at = K.at;
  const T = Music._tracks.title;   // its phrases (the commonwealth's tune, the interlude, the rise and the resolution) are the material
  const RUN = 'r:2 5:.25! 6:.25! 7:.25! 8:.25! 9:.25! 10:.25! 11:.25! 12:.25!';
  const MAIN = Object.assign(JSON.parse(JSON.stringify(K.STAGE)), {
    desc: 'The main theme, rewritten', hidden: true, bpm: 58, root: 'D', mode: 'major', trim: 0.62, subBass: 0.4, bassC: 40,
    mix: { lead: 1.4, pad: 1.0, choir: 1.2, arp: 0.85, bell: 0.9 },
    inst: { pad: 'strings', pad2: 'cellos', bass: 'deep', lead: 'horn', lead2: 'strings', arp: 'strOst', bell: 'glass', choir: 'choirOoh', choir2: 'choirMen' },
    quotes: ['hymn', 'procession'],
    ph: Object.assign({}, T.ph, {
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
        bass: { pat: '1---', vel: 0.7, inst: { p: 'cbSolo', att: 2, rel: 2.5 } }, choir2: { inst: 'choirHum', n: 2, reg: [55, 67], vel: 0.3, soft: true },
        lead: { ph: 'PA PB', inst: { p: 'reed', lvl: 0.55 }, vel: 0.9 } },
      // the interlude: the cello's brooding theme, the harp touching the chords
      { n: 'interlude', bars: 8, cres: [0.38, 0.5], prog: 'vi IV I V | vi IV ii V',
        pad: { p: 'swell', inst: 'violas', n: 3, reg: [52, 67], vel: 0.5 }, bass: { pat: '1---', vel: 0.75, inst: { p: 'deep', att: 1.2, rel: 2.4 } },
        lead: { ph: 'I1', inst: 'vcSolo', oct: -1, vel: 0.9 }, arp: { inst: 'harp', pat: '0...2...1...2...', res: 2, vel: 0.14, reg: [55, 76] } },
      // the build, a layer at a time: the strings' spiccato motor alone, then the low brass's foundation beneath
      { n: 'motor1', bars: 2, bpm: 76, lv: 0.6, prog: 'I I', arp: { pat: '0.120.120.120.12', res: 4, vel: 0.26, reg: [55, 69] }, drums: { sn: 'o...o...o...o.o.', vel: 0.4 } },
      { n: 'motor2', bars: 2, bpm: 76, lv: 0.68, prog: 'I V', arp: { pat: '0.120.120.120.12', res: 4, vel: 0.26, reg: [55, 69] },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.66 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.6, gate: 0.7, open: true },
        timp: { p: 'two', vel: 0.4 }, drums: { bd: 'x.......x.......', sn: 'o...o...o...o.xx', vel: 0.5 } },
      // the theme: the hymn, broad and legato in the horns, over the motor and the foundation; the flute's counter-melody in its gaps
      { n: 'theme1', bars: 8, bpm: 76, lv: 0.78, prog: 'I | V:.5 IV:.5 | I | ii:.5 V:.5 | I | ii:.5 I/III:.5 | vi:.5 V:.5 | I',
        arp: { pat: '0.120.120.120.12', res: 4, vel: 0.24, reg: [55, 69] }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 0.68 },
        pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.6, gate: 0.7, open: true },
        lead: { ph: 'H1 H2', inst: 'horn', vel: 0.92 }, bell: { ph: '@counter', inst: 'flute', reg: [74, 88], vel: 0.4 },
        timp: { p: 'two', vel: 0.4 }, drums: { p: 'field', vel: 0.5 } },
      // everyone: the hymn's second half, the trumpets on the tune above the horns, the violins' own counter-melody high, the choir
      { n: 'theme2', bars: 8, bpm: 76, cres: [0.92, 1.04], prog: 'I iii vi V | IV I/III V I',
        pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.55 }, arp: { pat: '0123210123210123', res: 4, vel: 0.24, reg: [55, 72] },
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 0.72 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 2, reg: [45, 58], vel: 0.72, gate: 0.65, open: true },
        lead: { ph: 'H3 H4', inst: 'tpts', vel: 0.95 }, lead3: { ph: 'H3 H4', inst: 'horn', oct: -1, vel: 0.85 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.5 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.75 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.6 },
        timp: { p: 'beats', vel: 0.5 }, drums: { p: 'field', vel: 0.62, crashS: at(8, { 0: 'x...............' }) } },
      // the lyrical middle in G, broken apart: the interlude's answer on the oboe, the harp, the strings softly
      { n: 'lyric1', bars: 8, key: 'G', bpm: 66, lv: 0.5, prog: 'IV V iii vi | IV I V I',
        pad: { p: 'sus', n: 3, reg: [55, 72], vel: 0.45 }, pad2: { p: 'swell', n: 2, reg: [43, 57], vel: 0.45, open: true }, bass: { p: 'whole', inst: { p: 'deep', att: 0.5 }, vel: 0.68 },
        lead: { ph: 'I2', inst: 'oboe', vel: 0.62 }, arp: { inst: 'harp', pat: '0.2.1.2.', res: 2, vel: 0.12, reg: [55, 79] } },
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
        bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 0.75 }, pad2: { p: 'stab', inst: 'lowBrass', pat: 'x.......x.......', n: 2, reg: [45, 58], vel: 0.8, gate: 0.8, open: true },
        lead: { ph: 'PA PB', inst: 'horn', vel: 1.0 }, lead4: { ph: 'PA PB', inst: 'tpts', oct: 1, vel: 0.5 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.5 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.85 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.65 },
        timp: { p: 'two', vel: 0.55 }, drums: { p: 'field', vel: 0.62, crashS: at(8, { 0: 'x...............' }) } },
      // the rise and the resolution: the title's own climax, broad, the choir open, the organ's pedal beneath
      { n: 'rise', bars: 8, bpm: 70, cres: [1.04, 1.1], prog: 'I IV I V | IV I vi V',
        pad: { p: 'sus', n: 4, reg: [57, 81], vel: 0.6 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3 }, vel: 0.8 },
        ...K.ORGAN(0.5, 0), arp: { pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.24, reg: [50, 62] },
        lead: { ph: 'RISE', inst: 'tpts', vel: 0.92 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.85 }, lead3: { ph: 'RISE', inst: 'choirMenAhNew', oct: -1, vel: 0.8 },
        choir2: { inst: 'choirWomen', n: 3, reg: [66, 81], vel: 0.75 }, timp: { p: 'beats', vel: 0.5 }, drums: { crashS: at(8, { 0: 'x...............' }) } },
      { n: 'resolve', bars: 8, bpm: 70, bpmTo: 62, cres: [1.06, 0.9], prog: 'I IV I V | IV V I I',
        pad: { p: 'sus', n: 4, reg: [57, 81], vel: 0.58 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.5 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.3 }, vel: 0.78 },
        ...K.ORGAN(0.5, 0), lead: { ph: 'RES', inst: 'horn', vel: 0.92 }, lead2: { ph: '@counter', inst: 'strings', reg: [69, 86], vel: 0.48 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.8 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 79], vel: 0.65 }, timp: { p: 'two', vel: 0.45 } },
      // the coda: the call once more over the amen — the subdominant turned minor — and the last chord held, the organ beneath
      { n: 'amen', bars: 4, bpm: 58, bpmTo: 50, cres: [0.85, 1.0], prog: 'IV iv | I I',
        pad: { p: 'sus', n: 4, reg: [57, 84], vel: 0.6 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.4, rel: 3 }, vel: 0.8 },
        ...K.ORGAN(0.6, 0), lead: { ph: 'AM r2', inst: 'horn', vel: 0.9 }, lead4: { ph: 'AMt r2', inst: 'tpts', vel: 0.65 }, lead2: { ph: 'r2 KE', inst: 'hornSolo', oct: -1, vel: 0.6 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 0.9 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.75 }, timp: { p: 'hits', vel: 0.55, roll: 1 } },
      { n: 'final', bars: 4, bpm: 40, cres: [1.08, 0.6], prog: 'I:4',
        pad: { p: 'sus', n: 4, reg: [57, 86], vel: 0.65, rel: 4 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [45, 60], vel: 0.55, rel: 3 }, bass: { pat: '1---', inst: { p: 'deep', att: 0.2, rel: 4.5 }, vel: 0.85 },
        ...K.ORGAN(0.8, 0.45), lead: { ph: 'FIN', inst: 'horn', vel: 0.95 }, lead4: { ph: 'FINt', inst: 'tpts', vel: 0.7 },
        choir: { inst: 'choirMenAh', n: 3, reg: [48, 62], vel: 1.0, rel: 4 }, choir2: { inst: 'choirWomen', n: 3, reg: [64, 81], vel: 0.85, rel: 4 },
        timp: { kick: ['X...............', E16, E16, E16], vel: 0.8 }, drums: { crashS: at(4, { 0: 'x...............' }), tam: at(4, { 0: 'x...............' }), bd: at(4, { 0: 'X...............' }) } },
    ],
  });
  Track('remaster:main', K.clarify(MAIN));

  window.CONCERT_REMASTER = {
    title: 'Master of Orion — Reborn: Remasters', artist: 'MOOgenesis',
    movements: [{ id: 'remaster:title', file: 'remaster-main-theme', title: 'Main Theme (remastered)' }, { id: 'remaster:main', file: 'main-theme-new', title: 'Main Theme (rewritten)' }],
  };
})(window.MOO);
