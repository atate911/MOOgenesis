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
      { n: 'B', bars: 8, lv: 0.95, prog: 'i bVI bVII i | i bVI bVII V', pad: { p: 'sus', n: 3, reg: [38, 62] }, bass: 'half', lead: { ph: 'B1 B2', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'B1 B2', inst: 'horn', oct: -1, vel: 0.6, shape: 0.35, swell: 0.35 }, timp: 'beats', choir: { v1: 'u', v2: 'o', vel: 0.55, reg: [50, 69] }, drums: { t5: 'X.....x.X.......', t4: '....x.......x.x.', t3: '..o.......o.....', kick: 'x.......x.......', clap: '....o.......o...', shk: 'x.x.x.x.x.x.x.x.', rim: '..o.......o.....' }, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.7 }, fill: 'tom' },
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

  // The Klackon (rewritten from nothing): an insect hive, one mind in a million bodies, endlessly industrious. E in the half-whole octatonic
  // scale, whose chords stand a minor third apart (I, bIII, bV, VI: the hive's geometry, round and round) and whose semitones chitter. The
  // gesture: a chitter (a semitone trill in sixteenths), then a leap up the chord, a beat of stillness. The colony assembles the way a hive
  // does: one worker's cell, then the same cell in canon a beat behind in another voice, then more; the wings buzz (the violins' tremolo high,
  // the sequencer), the mandibles click (wood block, claves). The contrast is the queen: a slow, eerie line sung by the women over the
  // buzzing. Electronic where the hive is a machine of bodies (the sequencer, the pulse bass, the glass pad), acoustic where it is a body
  // (the marimba, the pizzicato, the strings, the voices).
  Track('race:klackon', {
    desc: 'Klackon: an insect hive in the octatonic, chittering semitone cells passed between the marimba and the sequencer in canon, the wings buzzing, the mandibles clicking; the queen sings, slow and eerie; the colony strikes at the crest',
    motif: '1:.25 2:.25 1:.25 2:.25 1:.5 4:.5 6:1 r:1 | 3:.25 4:.25 3:.25 4:.25 3:.5 6:.5 8:1 r:1', motifInst: 'marimba',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 132, trim: 2.03, root: 'E', mode: 'octaH', tens: false, loopFrom: 'A',
    forms: [['A', 'B', 'queen', 'crest', 'C', 'B', 'queen2', 'crest', 'C'], ['A', 'B', 'queen', 'crest', 'C', 'queen2', 'A', 'crest', 'C'], ['A', 'B', 'queen', 'crest', 'C', 'A', 'B', 'queen2', 'crest', 'C']],
    inst: { pad: 'tremHi', pad2: 'glassPad', bass: 'pulseSyn', lead: 'marimba', lead2: 'seqSyn', lead3: 'choirWomen', arp: 'seqSyn', arp2: 'pizz', choir: 'choirWomen' },
    ph: {
      // the workers: a chitter, a leap up the chord, a beat of stillness; up the hive's minor thirds, and down again
      KA: '1:.25 2:.25 1:.25 2:.25 1:.5 4:.5 6:1 r:1 | 3:.25 4:.25 3:.25 4:.25 3:.5 6:.5 8:1 r:1 | 5:.25 4:.25 5:.25 4:.25 5:.5 8:.5 10:1 r:1 | 7:.25 8:.25 7:.25 8:.25 7:.5 10:.5 12:1 r:1',
      KB: '12:.25 11:.25 12:.25 11:.25 12:.5 10:.5 7:1 r:1 | 10:.25 9:.25 10:.25 9:.25 10:.5 8:.5 5:1 r:1 | 8:.25 7:.25 8:.25 7:.25 8:.5 6:.5 3:1 r:1 | 6:.5 4:.5 1:3',
      // the same, a beat behind: the canon
      KAc: 'r:1 1:.25 2:.25 1:.25 2:.25 1:.5 4:.5 6:1 | r:1 3:.25 4:.25 3:.25 4:.25 3:.5 6:.5 8:1 | r:1 5:.25 4:.25 5:.25 4:.25 5:.5 8:.5 10:1 | r:1 7:.25 8:.25 7:.25 8:.25 7:.5 10:.5 12:1',
      KBc: 'r:1 12:.25 11:.25 12:.25 11:.25 12:.5 10:.5 7:1 | r:1 10:.25 9:.25 10:.25 9:.25 10:.5 8:.5 5:1 | r:1 8:.25 7:.25 8:.25 7:.25 8:.5 6:.5 3:1 | r:1 6:.5 4:.5 1:2',
      // the queen: slow, eerie, sung
      Q1: '6:4 | 5:2 4:2 | 3:4 | 4:4', Q2: '9:4 | 8:2 6:2 | 7:4 | 6:4',
      // the queen over the colony at the crest: the fifth of each chord, round the minor thirds
      QC: '6:4 | 8:4 | 10:4 | 12:4', QD: '12:4 | 10:4 | 8:4 | 6:4',
      KS: '1:.25 2:.25 1:.25 2:.25 1:.5 4:.5 6:1 r:1 | r:4 | 1:.25 2:.25 1:.25 2:.25 1:1 r:2 | r:4',
    },
    sec: [
      { n: 'intro', bars: 4, cres: [0.5, 0.6], prog: 'I | I | bIII | I', pad: { p: 'swell', n: 2, reg: [76, 88], vel: 0.45 }, pad2: { p: 'swell', n: 3, reg: [57, 72], vel: 0.35 }, arp: { pat: ['0...0...0...0...', '0.0.0.0.0.0.0.0.', '0120012001200120', '0120012001200120'], res: 4, vel: 0.24, reg: [64, 84], gate: 0.4 }, 
        drums: { click2: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.xxxx', 'x.x.x.x.x.x.x.x.', 'x.xxx.x.x.xxxxxx'], click: ['................', '................', '..x.......x.....', '..x...x...x...x.'], vel: 0.55 } },
      { n: 'A', bars: 8, lv: 0.64, prog: 'I | bIII | bV | VI | VI | bV | bIII | I', pad: { p: 'swell', n: 2, reg: [76, 88], vel: 0.38 }, pad2: { p: 'sus', n: 3, reg: [57, 72], vel: 0.4 }, bass: { pat: '1..1..1...1.1...', vel: 0.75 },
        lead: { ph: 'KA KB', vel: 0.75 }, arp: { pat: '0120', res: 4, vel: 0.28, reg: [64, 84], gate: 0.4 },
        drums: { click2: 'x.x.x.x.x.x.x.x.', click: '..x.......x.....', click3: ['..............xx', '................', '..........xxx...', '................'], kick: 'x.......x.......', vel: 0.6 } },
      { n: 'B', bars: 8, cres: [0.66, 0.78], prog: 'I | bIII | bV | VI | VI | bV | bIII | I', pad: { p: 'swell', n: 2, reg: [76, 88], vel: 0.42 }, pad2: { p: 'sus', n: 3, reg: [57, 72], vel: 0.42 }, bass: { pat: '1..1..1...1.1...', vel: 0.8 },
        lead: { ph: 'KA KB', inst: 'seqSyn', vel: 0.6 }, lead2: { ph: 'KAc KBc', inst: 'marimba', vel: 0.62 }, arp2: { pat: '0.1.2.1.', res: 2, vel: 0.4, reg: [52, 72] }, arp: { pat: '0120', res: 4, vel: 0.3, reg: [64, 84], gate: 0.4 },
        drums: { click2: 'x.x.x.x.x.x.x.x.', click: '..x...x...x...x.', click3: ['..............xx', '................', '..........xxx...', '................'], kick: 'x..x....x.x.....', metal2: '....o.......o...', vel: 0.65 } },
      { n: 'queen', bars: 8, lv: 0.56, prog: 'I | bV:.5 I:.5 | bIII | I | I | bIII | VI | I', pad: { p: 'sus', n: 3, reg: [76, 91], vel: 0.5 }, pad2: { p: 'sus', n: 2, reg: [52, 64], vel: 0.4 }, bass: { pat: '1---', inst: 'subSwell', vel: 0.6 },
        lead3: { ph: 'Q1 Q2', vel: 0.62, shape: 0.45, swell: 0.4 }, lead2: { ph: 'Q1 Q2', inst: 'hornSolo', oct: -1, vel: 0.36, shape: 0.4, swell: 0.3 }, arp: { pat: '0120', res: 4, vel: 0.2, reg: [72, 88], gate: 0.35 },
        drums: { click2: ['x.......x.......', 'x.......x.....xx'], click: '................', vel: 0.4 } },
      { n: 'queen2', bars: 8, lv: 0.5, prog: 'I | bV:.5 I:.5 | bIII | I | I | bIII | VI | I', pad: { p: 'sus', n: 3, reg: [76, 91], vel: 0.48 }, bass: { pat: '1---', inst: 'subSwell', vel: 0.55 },
        lead3: { ph: 'Q1 Q2', inst: 'altoFluteIowa', vel: 0.6, shape: 0.45, swell: 0.4 }, lead2: { ph: 'r4 Q2', inst: 'choirWomen', vel: 0.45, shape: 0.45 }, drums: { click2: ['x.......x.......', '................'], vel: 0.35 } },
      { n: 'crest', bars: 8, cres: [0.84, 0.98], prog: 'I | bIII | bV | VI | VI | bV | bIII | I', pad: { p: 'sus', n: 3, reg: [72, 91], vel: 0.55 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [52, 72], vel: 0.6 }, bass: { pat: '1..1..1...1.1...', vel: 0.9 },
        lead: { ph: 'KA KB', inst: 'marimba', vel: 0.85 }, lead2: { ph: 'KAc KBc', inst: 'seqSyn', vel: 0.6 }, lead3: { ph: 'QC QD', vel: 0.62, shape: 0.4, swell: 0.35 }, lead4: { ph: 'QC QD', inst: 'horn', oct: -1, vel: 0.6, shape: 0.4, swell: 0.35 },
        arp: { pat: '0120', res: 4, vel: 0.34, reg: [64, 86], gate: 0.4 }, arp2: { pat: '0.1.2.1.', res: 2, vel: 0.45, reg: [52, 72] }, choir: { n: 3, reg: [64, 79], vel: 0.35 },
        drums: { click2: 'x.x.x.x.x.x.x.x.', click: '..x...x...x...x.', click3: ['..............xx', '..........xxx...'], kick: 'x..x....x.x.....', metal2: '....o.......o...', clap: '....o.......o...', vel: 0.75 }, hit: true },
      { n: 'C', bars: 4, cres: [0.6, 0.42], prog: 'I | bIII | I | I', pad: { p: 'swell', n: 2, reg: [76, 88], vel: 0.38 }, bass: { pat: ['1..1..1...1.1...', '1..1..1.........', '1...............', '................'], vel: 0.7 },
        lead: { ph: 'KS', vel: 0.65 }, drums: { click2: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x...x...x...x...', 'x.......x.......'], vel: 0.5 } },
    ],
  });

  // The Meklar (rewritten from nothing): a cybernetic race, cold, exact, tireless. B minor with the thirds mostly gone (open fifths and
  // suspended chords: the machine's cold harmony). The gesture is an algorithm: four notes rotated one place each bar in the sequencer, while
  // the directive above it moves in long even notes by fourths and fifths and, at the crest, in parallel fourths in the horns. Its ornament is
  // the glitch (a note stuttered). Its palette is the machine's: the clock (the wood block in sixteenths), the anvil's clank, data bleeps on
  // the celeste, a robotic chant of the men on open fifths in strict rhythm, a four-on-the-floor pulse (no gallop, no saws: those are the
  // battle cues'). The contrast is the ghost in the machine: a solo cello over the cold glass pad while the pulse stops.
  Track('race:meklar', {
    desc: 'Meklar: a cold machine in open fifths — an algorithm rotating in the sequencer, a directive in long even notes, the horns in parallel fourths at the crest; the clock, the anvil, data bleeps, the men chanting like machines; a ghost in the machine on the solo cello',
    motif: '1:2 5:2 | 8:1 7:1 6:1 5:1', motifInst: 'glass',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 120, trim: 1.63, root: 'B', mode: 'minor', tonic: 59, tens: false, loopFrom: 'A',
    forms: [['A', 'core', 'crest', 'C', 'A2', 'core', 'crest', 'C'], ['A', 'core', 'crest', 'C', 'core2', 'A2', 'crest', 'C'], ['A', 'core', 'crest', 'C', 'A2', 'core2', 'crest', 'C']],
    inst: { pad: 'glassPad', pad2: 'strings', pad3: 'choirMen', bass: 'moogSyn', lead: 'synthSyn', lead2: 'glass', lead3: 'seqSyn', arp: 'seqSyn', arp2: 'strOst', bell: 'glass' },
    ph: {
      MA: '1:.5 5:.5 4:.5 8:.5 1:.5 5:.5 4:.5 8:.5 | 5:.5 4:.5 8:.5 1:.5 5:.5 4:.5 8:.5 1:.5 | 4:.5 8:.5 1:.5 5:.5 4:.5 8:.5 1:.5 5:.5 | 8:.5 1:.5 5:.5 4:.5 8:.5 1:.5 5:.5 4:.5',   // the algorithm: four notes, rotated
      MT1: '1:2 5:2 | 8:1 7:1 6:1 5:1 | 3:2 5:1 7:1 | 4:4',                                    // the directive: long, even, by fourths and fifths
      MT2: '1:2 5:2 | 8:1 7:1 6:1 8:1 | 8:2 6:1 4:1 | 5:2 2:2',
      MG1: '1:2 5:2 | 8:.25 8:.25 8:.5 7:1 6:1 5:1 | 3:2 5:.25 5:.25 5:.5 7:1 | 4:.25 4:.25 4:3.5',   // the directive, glitching
      MC1: '8:3 7:1 | 5:4 | 4:3 2:1 | 1:4', MC2: '8:3 10:1 | 7:4 | 6:2 4:2 | 5:4',             // the ghost in the machine
    },
    sec: [
      { n: 'boot', bars: 4, cres: [0.42, 0.56], prog: 'i5 | i5 | Isus4 | i5', pad: { p: 'swell', n: 3, reg: [59, 76], vel: 0.45 },
        lead3: { ph: 'MA', vel: 0.5 }, drums: { click2: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'], metal2: ['................', '..............x.', '................', '..........x...x.'], vel: 0.5 } },
      { n: 'A', bars: 8, lv: 0.64, prog: 'i | bVI | bIII | bVII | i | bVI | ivsus2:.5 iv:.5 | V', pad: { p: 'sus', n: 3, open: true, reg: [59, 76], vel: 0.45 }, bass: { pat: '11111111', vel: 0.7 },
        lead: { ph: 'MT1 MT2', vel: 0.7, shape: 0.25 }, lead2: { ph: '@', oct: 1, vel: 0.4 }, arp: { pat: '0213', res: 4, vel: 0.28, reg: [59, 79], gate: 0.4 }, bell: { dens: 0.18, res: 4, reg: [84, 100], vel: 0.35 },
        drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', click2: 'x.x.x.x.x.x.x.x.', metal2: '..............x.', vel: 0.6 } },
      { n: 'core', bars: 8, lv: 0.57, prog: 'bVI | bIII | bVII | i | bVI | bIII | iv | V', pad: { p: 'sus', n: 3, reg: [62, 79], vel: 0.55 }, pad3: { p: 'sus', n: 2, open: true, reg: [45, 57], vel: 0.32 }, bass: { pat: '1---', inst: 'subSwell', vel: 0.5 },
        lead: { ph: 'MC1 MC2', inst: 'vcSolo', vel: 0.75, shape: 0.45, swell: 0.4 }, bell: { dens: 0.08, res: 2, reg: [84, 100], vel: 0.3 }, drums: { click2: 'x...x...x...x...', vel: 0.35 } },
      { n: 'core2', bars: 8, lv: 0.55, prog: 'bVI | bIII | bVII | i | bVI | bIII | iv | V', pad: { p: 'sus', n: 3, reg: [62, 79], vel: 0.48 }, bass: { pat: '1---', inst: 'subSwell', vel: 0.5 },
        lead: { ph: 'MC1 MC2', inst: 'glass', vel: 0.55 }, lead2: { ph: 'r4 MC2', inst: 'vcSolo', oct: -1, vel: 0.5, shape: 0.45, swell: 0.4 }, drums: { click2: 'x...x...x...x...', vel: 0.3 } },
      { n: 'crest', bars: 8, cres: [0.84, 0.98], prog: 'i | bVI | bIII | bVII | i | bVI | ivsus2:.5 iv:.5 | V', pad: { p: 'sus', n: 3, open: true, reg: [62, 79], vel: 0.5 }, pad2: { p: 'sus', n: 4, reg: [50, 74], vel: 0.55 }, pad3: { p: 'stab', pat: 'x...x...x...x...', n: 2, open: true, reg: [45, 57], vel: 0.6, gate: 0.5 }, bass: { pat: '11111111', vel: 0.85 },
        lead: { ph: 'MG1 MT2', inst: 'horn', vel: 0.82, harm: -3, shape: 0.3, swell: 0.3 }, lead2: { ph: '@', inst: 'synthSyn', vel: 0.45 }, arp: { pat: '0213', res: 4, vel: 0.3, reg: [59, 79], gate: 0.4 }, arp2: { pat: '01010101', res: 2, vel: 0.42, reg: [47, 62] }, bell: { dens: 0.25, res: 4, reg: [84, 100], vel: 0.38 },
        drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', clap: '....x.......x...', click2: 'xxxxxxxxxxxxxxxx', metal2: '......x.......x.', metal: ['x...............', '................', '................', '................'], vel: 0.72 }, timp: 'two', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.6, 0.42], prog: 'i5 | i5 | Isus4 | i5', pad: { p: 'swell', n: 3, reg: [59, 76], vel: 0.42 }, bass: { pat: ['11111111', '1.1.1.1.', '1...1...', '1.......'], vel: 0.65 },
        lead3: { ph: 'MA', vel: 0.55 }, drums: { kick: ['x...x...x...x...', 'x...x...x...x...', 'x.......x.......', 'x...............'], click2: ['xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.', 'x...x...x...x...', 'x...............'], vel: 0.55 } },
      { n: 'A2', bars: 8, lv: 0.66, prog: 'i | bVI | bIII | bVII | i | bVI | ivsus2:.5 iv:.5 | V', pad: { p: 'sus', n: 3, open: true, reg: [59, 76], vel: 0.45 }, bass: { pat: '11111111', vel: 0.72 },
        lead: { ph: 'MG1 MT2', inst: 'glass', vel: 0.65 }, lead2: { ph: 'MT1 MT2', inst: 'vcSolo', oct: -1, vel: 0.45, shape: 0.3 }, arp: { pat: '0213', res: 4, vel: 0.28, reg: [59, 79], gate: 0.4 }, bell: { dens: 0.2, res: 4, reg: [84, 100], vel: 0.35 },
        drums: { kick: 'x...x...x...x...', hat: '..x...x...x...x.', click2: 'x.x.x.x.x.x.x.x.', metal2: '......x.......x.', vel: 0.62 } },
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

  Track('race:psilon', { trim: 1.65,
    desc: 'Psilon: crystalline FM bells and glass-harmonica overtones in a cool lydian shimmer',
    motif: '8:.5 7:.5 5:.5 3:.5 5:1 1:1 | 9:.5 8:.5 6:.5 4:.5 6:1 2:1', motifInst: 'crystal',   // the first bars of the theme: the next interlude carries them when this race is met
    bpm: 90, root: 'C', mode: 'lydian', oct: 1, tens: false,
    forms: [['A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2', 'A', 'B', 'A2'], ['A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B', 'A', 'A2', 'B']],
    inst: { pad: 'glassPad', bass: 'deep', lead: 'glass', lead2: 'harp', arp: 'glass', bell: 'crystal' },
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
    bulrathi: { tempo: 1.1, down: 2, mode: 'minor' },                                                                           // pounding, lower still
    darlok: { tempo: 1.08, inst: { lead: 'horn' }, drums: { kick: 'x..x....x..x....', rim: '......o.......o.', hiss: '....x.......x...' } },   // heartbeat pulse
    human: {},                                                                                                   // the march in minor, snare + brass
    mrrshan: { tempo: 1.15, down: 5, mode: 'phrygDom' },                                                                           // growling low brass
    psilon: { inst: { lead: 'crystal' }, drums: { t5: 'X.......x.......', click3: 'o.o.o.o.o.o.o.o.' } },         // cold clusters, tremolo bells
    silicoid: { tempo: 1.15, down: 2, inst: { lead: 'horn' }, drums: { t5: 'X.......X.......', metal: 'x.......x.......', hiss: '....x.......x...' } },   // grinding pulses
  };
  for (const r in WAR) Music._warVariant('race:' + r, WAR[r]);

  // ------------------------------------------------------------------ the written hostile readings: the theme's tune, its own music
  // The Meklar, hostile: the factory. The directive in the low brass over the strings' spiccato and the anvils; the factory itself (no tune:
  // machinery, the anvil's pattern, low-brass hits, the men's mechanical shouts); the ghost in the machine overridden (its line in the horns
  // over the strings' tremolo); the crest in parallel fourths, glitching. No saws, no gallop.
  Music._warVariant('race:meklar', { written: true, down: 2, bpm: 132, loopFrom: 'A',
    desc: 'Meklar, hostile: the factory — the directive in the low brass over the spiccato and the anvils, a passage of machinery alone, the ghost in the machine overridden by the horns, the crest in parallel fourths',
    forms: [['A', 'factory', 'override', 'crest', 'C', 'A', 'override', 'factory', 'crest', 'C'], ['A', 'factory', 'override', 'crest', 'C', 'factory', 'A', 'crest', 'C']],
    inst: { pad: 'strTrem', pad2: 'lowBrass', pad3: 'choirMenAh', bass: 'moogSyn', lead: 'lowBrass', lead2: 'strOst', lead3: 'horn', arp: 'seqSyn', arp2: 'strOst', bell: 'glass' },
    def: { trim: 1.46 },
    sec: [
      { n: 'power', bars: 2, cres: [0.55, 0.72], prog: 'i5 | i5', pad: { p: 'swell', n: 2, open: true, reg: [52, 64], vel: 0.55 },
        drums: { click2: ['xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'], metal: ['x...............', 'x.......x...x...'], kick: ['................', 'x...x...x...x...'], vel: 0.65 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'i | bVI | bIII | bVII | i | bVI | ivsus2:.5 iv:.5 | V', pad: { p: 'sus', n: 3, open: true, reg: [55, 72], vel: 0.45 }, bass: { pat: '11111111', vel: 0.8 },
        lead: { ph: 'MT1 MT2', vel: 0.85, shape: 0.25 }, lead2: { ph: '@', oct: 1, vel: 0.55 }, arp: { pat: '0213', res: 4, vel: 0.26, reg: [59, 79], gate: 0.4 },
        drums: { kick: 'x...x...x...x...', metal: 'x.......x.......', metal2: '....x.......x.x.', click2: 'xxxxxxxxxxxxxxxx', vel: 0.78 } },
      { n: 'factory', bars: 4, cres: [0.78, 0.92], prog: 'i5 | bVI5 | i5 | bVII5', pad2: { p: 'stab', pat: 'x..x..x.....x...', n: 2, open: true, reg: [40, 55], vel: 0.8, gate: 0.4 }, pad3: { p: 'stab', pat: '....x.......x...', n: 2, open: true, reg: [47, 59], vel: 0.6, gate: 0.4 }, bass: { pat: '11111111', vel: 0.85 },
        drums: { kick: 'x...x...x...x...', metal: 'x..x..x.....x...', metal2: '..x...x...x.x.x.', click2: 'xxxxxxxxxxxxxxxx', clap: '....x.......x...', vel: 0.85 }, timp: 'beats' },
      { n: 'override', bars: 8, lv: 0.84, prog: 'bVI | bIII | bVII | i | bVI | bIII | iv | V', pad: { p: 'sus', n: 4, reg: [55, 76], vel: 0.55 }, bass: { pat: '1.1.1.1.', vel: 0.8 },
        lead3: { ph: 'MC1 MC2', vel: 0.85, shape: 0.35, swell: 0.3 }, arp2: { pat: '01010101', res: 2, vel: 0.45, reg: [47, 62] },
        drums: { kick: 'x...x...x...x...', metal2: '......x.......x.', click2: 'x.x.x.x.x.x.x.x.', vel: 0.72 }, timp: 'two' },
      { n: 'crest', bars: 8, cres: [0.9, 1.0], prog: 'i | bVI | bIII | bVII | i | bVI | ivsus2:.5 iv:.5 | V', pad: { p: 'sus', n: 4, reg: [55, 76], vel: 0.6 }, pad3: { p: 'stab', pat: 'x...x...x...x...', n: 2, open: true, reg: [47, 59], vel: 0.65, gate: 0.4 }, bass: { pat: '11111111', vel: 0.9 },
        lead: { ph: 'MG1 MT2', oct: -1, vel: 0.85, shape: 0.25 }, lead3: { ph: 'MG1 MT2', vel: 0.88, harm: -3, shape: 0.3, swell: 0.3 }, lead2: { ph: 'MG1 MT2', oct: 1, vel: 0.5 }, bell: { dens: 0.2, res: 4, reg: [84, 100], vel: 0.35 },
        drums: { kick: 'x...x...x...x...', metal: 'x.......x.......', metal2: '..x...x...x...x.', clap: '....x.......x...', click2: 'xxxxxxxxxxxxxxxx', crash: ['x...............', '................', '................', '................'], vel: 0.88 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.8, 0.6], prog: 'i5 | i5 | Isus4 | i5', pad2: { p: 'sus', n: 2, open: true, reg: [40, 55], vel: 0.6 }, bass: { pat: ['11111111', '1.1.1.1.', '1...1...', '1.......'], vel: 0.75 },
        lead2: { ph: 'MA', vel: 0.65 }, drums: { kick: ['x...x...x...x...', 'x...x...x...x...', 'x.......x.......', 'x...............'], metal: ['x...............', 'x...............', 'x...............', 'x...............'], click2: ['xxxxxxxxxxxxxxxx', 'x.x.x.x.x.x.x.x.', 'x...x...x...x...', 'x...............'], vel: 0.72 } },
    ],
  });

  // The Klackon, hostile: the swarm. The workers' cells hammered in the spiccato with the brass a beat behind, the saws for wings; the swarm
  // itself (no tune: the saws entering one by one, the hive's chords turning to clusters, the clicks thickening); the queen commanding in the
  // horns; the colony and the queen together at the crest.
  Music._warVariant('race:klackon', { written: true, down: 2, bpm: 145, loopFrom: 'A',
    desc: 'Klackon, hostile: the swarm — the workers’ cells hammered in the spiccato with the brass a beat behind, saws for wings, the hive’s chords turning to clusters; the queen commands in the horns',
    forms: [['A', 'swarm', 'queen', 'crest', 'C', 'A', 'queen', 'swarm', 'crest', 'C'], ['A', 'swarm', 'queen', 'crest', 'C', 'swarm', 'A', 'queen', 'crest', 'C']],
    inst: { pad: 'strTrem', pad2: 'lowBrass', bass: 'pulseSyn', lead: 'strOst', lead2: 'synth', lead3: 'horn', lead4: 'choirWomen', arp: 'arpSawSyn', arp2: 'arpSawSyn' },
    def: { trim: 1.86 },
    sec: [
      { n: 'alarm', bars: 2, cres: [0.55, 0.72], prog: 'I | bIII', pad: { p: 'swell', n: 3, reg: [64, 84], vel: 0.55 },
        drums: { click2: ['xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'], click: ['................', '..x...x...x.x.xx'], kick: ['................', '............x...'], vel: 0.6 } },
      { n: 'A', bars: 8, lv: 0.82, prog: 'I | bIII | bV | VI | VI | bV | bIII | I', pad: { p: 'sus', n: 3, reg: [64, 84], vel: 0.45 }, bass: { pat: '1111111111111111', vel: 0.7 },
        lead: { ph: 'KA KB', vel: 0.85 }, lead2: { ph: 'KAc KBc', vel: 0.6 }, arp: { pat: '0120', res: 4, vel: 0.3, reg: [62, 84], gate: 0.4 },
        drums: { click2: 'x.xxx.xxx.xxx.xx', click: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...', vel: 0.75 } },
      { n: 'swarm', bars: 8, cres: [0.6, 0.95], prog: 'I | bIII | bV | VI | Icl | bIIIcl | bVcl | VIcl', pad: { p: 'swell', n: 4, reg: [64, 88], vel: 0.6 }, pad2: { p: 'stab', pat: ['................', '................', '................', '................', 'x.....x.....x...', 'x.....x.....x...', 'x..x..x..x..x...', 'x..x..x..x..x.x.'], n: 3, reg: [43, 60], vel: 0.75, gate: 0.4 }, bass: { pat: '1111111111111111', vel: 0.75 },
        arp: { pat: '0123', res: 4, vel: 0.34, reg: [60, 84], gate: 0.4 }, arp2: { pat: ['................', '................', '3210321032103210', '3210321032103210', '3210321032103210', '3210321032103210', '3210321032103210', '3210321032103210'], res: 4, vel: 0.32, reg: [67, 91], gate: 0.4 },
        drums: { click2: ['x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'x.xxx.xxx.xxx.xx', 'x.xxx.xxx.xxx.xx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx', 'xxxxxxxxxxxxxxxx'], click: ['................', '................', '..x...x...x...x.', '..x...x...x...x.', '..x.x.x.x.x.x.x.', '..x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'], kick: 'x..x....x.x.....', metal2: ['................', '................', '................', '................', '....o.......o...', '....o.......o...', '....o...o...o...', 'o...o...o...o.o.'], vel: 0.8 }, fill: 'snare' },
      { n: 'queen', bars: 8, lv: 0.86, prog: 'I | bV:.5 I:.5 | bIII | I | I | bIII | VI | I', pad: { p: 'sus', n: 4, reg: [64, 88], vel: 0.55 }, bass: { pat: '1.1.1.1.1.1.1.1.', vel: 0.75 },
        lead3: { ph: 'Q1 Q2', vel: 0.85, harm: -3, shape: 0.35, swell: 0.3 }, arp: { pat: '0120', res: 4, vel: 0.26, reg: [64, 86], gate: 0.4 },
        drums: { click2: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.......', metal2: '....o.......o...', vel: 0.7 }, timp: 'two' },
      { n: 'crest', bars: 8, cres: [0.9, 1.0], prog: 'I | bIII | bV | VI | VI | bV | bIII | I', pad: { p: 'sus', n: 4, reg: [64, 88], vel: 0.6 }, pad2: { p: 'stab', pat: 'x.....x.....x...', n: 3, reg: [43, 60], vel: 0.7, gate: 0.4 }, bass: { pat: '1111111111111111', vel: 0.8 },
        lead: { ph: 'KA KB', vel: 0.9 }, lead2: { ph: 'KAc KBc', vel: 0.7 }, lead3: { ph: 'QC QD', oct: -1, vel: 0.8, shape: 0.35, swell: 0.3 }, lead4: { ph: 'QC QD', vel: 0.55, shape: 0.4 },
        arp: { pat: '0123', res: 4, vel: 0.32, reg: [60, 84], gate: 0.4 }, arp2: { pat: '3210', res: 4, vel: 0.3, reg: [67, 91], gate: 0.4 },
        drums: { click2: 'xxxxxxxxxxxxxxxx', click: '..x...x...x...x.', kick: 'x..x....x.x.....', metal2: '....o.......o...', clap: '....o.......o...', crash: ['x...............', '................', '................', '................'], vel: 0.85 }, timp: 'beats', hit: 'tam' },
      { n: 'C', bars: 4, cres: [0.8, 0.6], prog: 'I | bIII | I | I', pad: { p: 'swell', n: 3, reg: [64, 84], vel: 0.5 }, bass: { pat: ['1111111111111111', '1.1.1.1.1.1.1.1.', '1...1...1...1...', '1...............'], vel: 0.7 },
        lead: { ph: 'KS', vel: 0.8 }, drums: { click2: ['xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx', 'x.x.x.x.x.x.x.x.', 'x...x...x...x...'], vel: 0.65 } },
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
