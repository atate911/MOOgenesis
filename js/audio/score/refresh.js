// The refresh (loaded last): what the main theme taught about sound, applied to every other piece without rewriting it. The notes, forms
// and instruments stay as written; each entry below changes only how a piece is performed and mastered, measured against the theme
// (tools/fresh/sweep.js before and after; README there):
//  - orch: the orchestral profile (held beds and bass, phrase expression, staged dynamics, a clean bass tone with a sine sub) for
//    pieces played by recorded orchestral instruments;
//  - hall: the recorded Musikverein in place of the generated hall (clearer, the parts better separated, a real room);
//  - tone: presence (the 5 kHz shelf) and weight (the 120 Hz shelf), dB; lowBand: the master's low band, dB (the low-band compressor
//    otherwise takes back what a piece adds below 160 Hz); subBass: the sine under a recorded bass (orch only);
//  - verb: the hall ridden down in a piece's climaxes (sections, by name) so the tutti stays clear, as in the theme;
//  - mix: layer balance (the solo about 3 dB over the bed, the choir and strings within 4.5 dB); trim: the level kept where it was.
// A piece's war-time copy (':war') takes the same refresh. Turn it all off with ?refresh=0 to hear the pieces as they were.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, T = Music._tracks;
  const off = typeof location !== 'undefined' && /[?&]refresh=0\b/.test(location.search || '');
  const R = {
    // measured in three passes over each piece's first 100 s (tools/fresh/sweep.js; the numbers in tools/fresh/README.md): the cues,
    // the galaxy and the race themes. The orchestral pieces take the profile and the three-layer solo recordings; the synth-era cues
    // and the race themes (and the battle cue, whose bite the profile softened) the mastering alone, with a sub under their bass. Then
    // the choir's sung lead in twelve of them (sing), room for every melody (space: tools/fresh/space.js) and one low end across the score
    // (the sub toward -5 dB and 50-120 Hz toward +2 dB of the whole, the main theme's family).
    // the main theme's grand reading for a new game (investigatory): the whole orchestra, free of the score's general rules, its own dynamics;
    // the original's opening and first statement kept
    'title:grand': {dyn: {ratio: 1.6, thresh: -20}, settled: true, brassHarm: false, upgrade: false, oldMen: {vel: 0.4, min: 0.3, reg: [38, 52]}, orch: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.5, pres: 3}, lowBand: 4.5, subBass: 0.9, mix: {lead: 2.0, arp: 6.0, bell: 4.0, bass: 0.55, choir: 0.6}, secs: {A: {lead4: {ph: '@', inst: {p: 'strings', lvl: 0.2}, oct: 1, vel: 0.7, shape: 0.4, swell: 0.35}, bell2: {ph: '@counter', inst: 'cellos', reg: [45, 62], vel: 0.55}}, I1: {lead: {inst: 'strings', oct: 1, vel: 0.85, shape: 0.4, swell: 0.35}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.55}}, I2: {lead: {inst: 'horn', harm: -2, hvel: 0.8, vel: 0.85, shape: 0.4, swell: 0.3}, lead3: {ph: '@', inst: 'flutes', oct: 1, vel: 0.4, shape: 0.4}}, A2: {cres: [0.75, 0.92], lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, vel: 0.95, shape: 0.4, swell: 0.3}, lead2: {ph: '@', inst: 'horn', oct: -1, harm: -2, hvel: 0.8, vel: 0.75, shape: 0.4, swell: 0.3}, lead4: {ph: '@', inst: {p: 'strings', lvl: 0.32}, oct: 1, vel: 0.85, shape: 0.4, swell: 0.3}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.62, shape: 0.4, swell: 0.3}, bell2: {ph: '@counter', inst: 'cellos', reg: [45, 62], vel: 0.55}}, B: {lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, vel: 0.95, shape: 0.4, swell: 0.3}, lead2: {ph: '@', inst: 'horn', oct: -1, harm: -2, hvel: 0.8, vel: 0.75, shape: 0.4, swell: 0.3}, lead4: {ph: '@', inst: {p: 'strings', lvl: 0.32}, oct: 1, vel: 0.85, shape: 0.4, swell: 0.3}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.62, shape: 0.4, swell: 0.3}, choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.7, gate: 0.4}, drums: {bd: 'X.......x.......', crash: ['X...............', '................', '................', '................'], vel: 0.85}, timp: 'beats', arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.36, reg: [67, 91], gate: 0.8}, arp2: {inst: 'flutes', pat: '01010101........', res: 4, vel: 0.42, reg: [79, 96], gate: 0.6}}, M: {lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, vel: 0.95, shape: 0.4, swell: 0.3}, lead2: {ph: '@', inst: 'horn', oct: -1, harm: -2, hvel: 0.8, vel: 0.75, shape: 0.4, swell: 0.3}, lead4: {ph: '@', inst: {p: 'strings', lvl: 0.32}, oct: 1, vel: 0.85, shape: 0.4, swell: 0.3}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.62, shape: 0.4, swell: 0.3}, choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.7, gate: 0.4}, drums: {bd: 'X.......x.......', crash: ['X...............', '................', '................', '................'], vel: 0.85}, timp: 'beats', arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.36, reg: [67, 91], gate: 0.8}, arp2: {inst: 'flutes', pat: '01010101........', res: 4, vel: 0.42, reg: [79, 96], gate: 0.6}}, R: {lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, vel: 0.95, shape: 0.4, swell: 0.3}, lead2: {ph: '@', inst: 'horn', oct: -1, harm: -2, hvel: 0.8, vel: 0.75, shape: 0.4, swell: 0.3}, lead4: {ph: '@', inst: {p: 'strings', lvl: 0.32}, oct: 1, vel: 0.85, shape: 0.4, swell: 0.3}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.62, shape: 0.4, swell: 0.3}, timp: {p: 'two', roll: 2}, arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.36, reg: [67, 91], gate: 0.8}}}, space: {A2: {pad3: {velK: 1.6}}, B: {pad3: {velK: 1.6}}, M: {pad3: {velK: 1.6}}, R: {pad3: {velK: 1.6}}}, trim: 1.35},
    'title': {settled: true, oldMen: {vel: 0.4, min: 0.3, reg: [38, 52]}, mix: {lead: 2.25}, choirFwd: false, brassHarm: false},   // the main theme as approved (its mix, hall, tone, arrangement and choir seat: the solo and the brass in front); only the new choir recordings, like every other piece
    'combat3': {secs: {A2: {prog: 'i i bVI bVII | i bIIM7 i bVI:.5 V:.5 | i i bVI bVII | i bIIM7 bVI i:.5 V:.5'}, A1: {prog: 'i i bVI bVII | i bIIM7 i bVI:.5 V:.5 | i i bVI bVII | i bIIM7 bVI i:.5 V:.5'}}, quietPerc: false, hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2.3}, lowBand: 3, subBass: 0.1, space: {A1: {pad2: {velK: 0.7}}, B1: {pad2: {velK: 0.7}}, A2: {pad2: {velK: 0.7}}, B2: {pad2: {velK: 0.7}}}, trim: 1.42},
    'combat1': {secs: {A3: {prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bIII:2 bVII:2'}, A2: {prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bIII:2 bVII:2'}, A1: {prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bIII:2 bVII:2'}}, quietPerc: false, hall: 'musikverein', tone: {lo: 1.7, hi: 1, pres: 2}, lowBand: 3, subBass: 0.28, space: {A1: {pad: {reg: [74,88]}}, A2: {pad: {reg: [74,88]}}, A3: {pad: {reg: [74,88]}}}, trim: 1.37},
    'combat2': {quietPerc: false, hall: 'musikverein', tone: {lo: 1.6, hi: 1, pres: 1.6}, lowBand: 3, subBass: 0.4, space: {A1: {pad: {velK: 0.7}}, A2: {pad: {velK: 0.7}}, A3: {pad: {velK: 0.7}}}, trim: 1.33},
    'ground': {secs: {D: {prog: 'i:2 bII:2 i:2 bvii:2'}}, hall: 'musikverein', tone: {lo: 3, hi: 0, pres: 0.5}, lowBand: 3, subBass: 0.78, mix: {lead: 2.54, choir: 2.97}, space: {B1: {pad: {reg: [72,86]}}, B2: {pad: {reg: [72,86]}}, D: {pad: {reg: [73,87]}}, E: {pad: {reg: [72,86]}}}, trim: 1.88},
    // Council in state: a ceremonial march-fanfare for the Grand Council (the user: Sousa, the Tijuana Brass, the Imperial March's ways and the
    // last scene of Star Wars; a piece of its own, free of the score's general rules, the game's hall and choir kept): in the strains the tune
    // in octaves through the trumpets, horns and trombones over the low strings' driving ostinato, the horns' afterbeats, the tuba on the
    // beats; at the big phrase, the refrain and the horn section the tune opens into close harmony (a triad in the trumpets, the trombones in
    // thirds an octave down), the trumpets' chords held and swelling, the violins sweeping over the brass and the flutes trilling; the
    // violins soaring an octave above the tune and the full strings under the band (the film march's strings and brass together); it opens
    // on the drums alone (a snare march beat, the bass drum, the tuba and the timpani, rolling into the entry), and the band enters as one:
    // every section on the downbeat at full, the brass struck at once, the crash, the bass drum, the timpani and the tam-tam exploding with it,
    // the march drums big from there (the entry struck at full, every instrument at full strength from its first note: no swell into it); the drums begin softly and build so the band's entry lands far above them (louder than the map, as an
    // occasion should be); tam-tam, timpani and cymbals
    // at the arrivals; the throne room's ways: a stately tempo, the trumpets' triplet calls between the tune's phrases, a grand close (the last
    // section rising to full, the timpani rolling under the last chord); the film main title's: the band's entry after the drums a full
    // crash, the tune doubled two octaves up in the flutes and an octave up in the violins on every statement, the horns' countermelody
    // answering the tune (moving where it holds), the brass chords struck and swelling (sforzando, then the swell), borrowed chords at the
    // cadences (the flat-six and flat-seven into the horn section's close, as in the big phrase and the refrain), a forward tempo
    'council2': {dyn: {ratio: 1.4, thresh: -18}, settled: true, brassHarm: false, secs: {F: {lead: null, lead2: null, lead4: null, pad: {p: 'sus', inst: 'tpts', n: 4, reg: [60, 79], vel: 0.85, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 1.0}, pad3: {p: 'sus', inst: 'trombones', n: 4, reg: [38, 58], vel: 1.0}, choir2: {inst: 'strings', n: 6, reg: [31, 91], vel: 0.95, width: 1.4, att: 0.04, open: true}, choir: {n: 3, reg: [60, 76], vel: 0.7}, bass: {pat: '1---', inst: {p: 'tuba', att: 0.05, sub: 0.9}, vel: 1.0}, drums: {bd: 'X...............', crash: ['X...............', '................', 'X...............', '................'], vel: 1.0}, timp: {p: 'two', roll: 1}, lead3: null, arp: {inst: 'tpts', pat: ['............', '............', '000.2...444.', '000.2.555...'], res: 3, vel: 0.85, reg: [65, 84], gate: 0.85}, arp2: {inst: 'flutes', pat: '0101010101010101', res: 4, vel: 0.5, reg: [79, 98], gate: 0.7}}, intro: {bars: 4, cres: [0.6, 0.78], hit: false, cr: false, lead: null, lead2: null, pad: null, pad2: null, pad3: null, choir: null, choir2: null, arp: null, arp2: null, drums: {bd: 'X.......X.......', sn: ['X.x.x.x.X.x.x.x.', 'X.x.x.xxX.x.x.x.', 'X.x.x.x.X.x.x.x.', 'X.xxX.xxX.xxXxxx']}, timp: 'beats', bass: {pat: '1-5-', inst: {p: 'tuba', att: 0.06}, vel: 0.9}}, A1: {choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.95, gate: 0.45}, lv: 1.0, cres: null, drums: {bd: 'X...x...X...x...', sn: ['X.x.x.x.x.x.xxx.', 'x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.xxX.x.'], crash: ['X...............', '................', '................', '................'], vel: 1.0}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.5, shape: 0.4, swell: 0.3}, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.85, width: 1.3, att: 0.05}, cr: true, lead: {inst: 'tpts', harm: -7, hvel: 0.95, vel: 1.0, shape: 0, swell: 0}, lead2: {ph: '@', inst: 'trombones', oct: -1, vel: 0.9, shape: 0, swell: 0}, pad: {p: 'sus', inst: 'tpts', n: 3, reg: [62, 77], vel: 0.28, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 1.0}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp2: {inst: 'strOst', pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.60, reg: [43, 55], gate: 0.7}, arp: {inst: 'clarinet', pat: '..1...1...1...1.', res: 4, vel: 0.32, reg: [62, 79], gate: 0.5}}, A2: {lv: 0.62, drums: {bd: 'x.......x.......', sn: ['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x.oo', 'x.o.x.o.x.o.x.o.', 'x.o.x.oox.o.x.o.'], vel: 0.6}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, lead3: null, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.5, width: 1.3}, cr: false, lead: {inst: 'tpts', harm: -7, hvel: 0.85, shape: 0.4, swell: 0.4}, lead2: {ph: '@', inst: 'trombones', oct: -1, vel: 0.62, shape: 0.4, swell: 0.4}, pad: null, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp2: {inst: 'strOst', pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.60, reg: [43, 55], gate: 0.7}, arp: {inst: 'clarinet', pat: '..1...1...1...1.', res: 4, vel: 0.32, reg: [62, 79], gate: 0.5}}, B: {lv: 1.15, cres: null, drums: {bd: 'X...x...X...x...', sn: ['X.x.x.x.x.x.xxx.', 'x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.xxX.x.'], crash: ['X...............', '................', '................', '................'], vel: 1.0}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.95, gate: 0.45}, hit: 'tam', lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.5, shape: 0.4, swell: 0.3}, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.85, width: 1.3, att: 0.05}, cr: true, lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.95, vel: 1.0, shape: 0, swell: 0}, lead2: {ph: '@', inst: 'trombones', oct: -1, harm: -2, hvel: 0.8, vel: 0.9, shape: 0, swell: 0}, pad: {p: 'sus', inst: 'tpts', n: 4, reg: [60, 79], vel: 0.44, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 1.0}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.34, reg: [67, 91], gate: 0.8}, arp2: {inst: 'tpts', pat: '000.2.......', res: 3, vel: 0.61, reg: [67, 84], gate: 0.9}}, R: {lv: 1.0, cres: null, drums: {bd: 'X...x...X...x...', sn: ['X.x.x.x.x.x.xxx.', 'x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.xxX.x.'], crash: ['X...............', '................', '................', '................'], vel: 1.0}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.6, gate: 0.35}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.5, shape: 0.4, swell: 0.3}, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.66, width: 1.3}, hit: 'tam', timp: 'beats', cr: true, lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, shape: 0.4, swell: 0.4}, lead2: {ph: '@', inst: 'trombones', oct: -1, harm: -2, hvel: 0.8, vel: 0.62, shape: 0.4, swell: 0.4}, pad: {p: 'swell', inst: 'tpts', n: 4, reg: [60, 79], vel: 0.47, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 1.00}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.34, reg: [67, 91], gate: 0.8}, arp2: {inst: 'tpts', pat: '000.2.......', res: 3, vel: 0.61, reg: [67, 84], gate: 0.9}}, T: {lv: 1.0, cres: null, drums: {bd: 'X...x...X...x...', sn: ['X.x.x.x.x.x.xxx.', 'x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.xxX.x.'], crash: ['X...............', '................', '................', '................'], vel: 1.0}, prog: 'vi IV | I V | vi ii | V I | vi IV | I V | bVI bVII | I I', bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, choir3: {p: 'stab', inst: 'brassStab', pat: 'x.......x.......', n: 4, reg: [55, 76], vel: 0.6, gate: 0.35}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.5, shape: 0.4, swell: 0.3}, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.64, width: 1.3}, lv: 0.95, cres: null, timp: 'beats', cr: true, lead: {inst: 'tpts', harm: [-2, -4], hvel: 0.85, shape: 0.4, swell: 0.4}, lead2: {ph: '@', inst: 'trombones', oct: -1, harm: -2, hvel: 0.8, vel: 0.62, shape: 0.4, swell: 0.4}, pad: {p: 'swell', inst: 'tpts', n: 4, reg: [60, 79], vel: 0.45, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 1.00}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp: {inst: 'strOst', pat: '0123456776543210', res: 4, vel: 0.34, reg: [67, 91], gate: 0.8}, arp2: {inst: 'flutes', pat: '01010101........', res: 4, vel: 0.45, reg: [79, 96], gate: 0.6}}, D: {lv: 0.62, drums: {bd: 'x.......x.......', sn: ['x.o.x.o.x.o.x.o.', 'x.o.x.o.x.o.x.oo', 'x.o.x.o.x.o.x.o.', 'x.o.x.oox.o.x.o.'], vel: 0.6}, bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, lead3: null, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.52, width: 1.3}, cr: false, lead: {inst: 'tpts', harm: -7, hvel: 0.85, shape: 0.4, swell: 0.4}, lead2: {ph: '@', inst: 'trombones', oct: -1, vel: 0.62, shape: 0.4, swell: 0.4}, pad: null, pad2: {p: 'stab', inst: 'horn', pat: '....x.......x...', n: 4, reg: [53, 72], vel: 0.72, gate: 1.1}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 1.00}, bass: {inst: {p: 'tuba', att: 0.06}}, arp2: {inst: 'strOst', pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.60, reg: [43, 55], gate: 0.7}, arp: {inst: 'clarinet', pat: '..1...1...1...1.', res: 4, vel: 0.32, reg: [62, 79], gate: 0.5}}, E: {bell2: {ph: '@counter', inst: 'horn', reg: [53, 70], vel: 0.56}, lead3: {ph: '@', inst: 'flutes', oct: 2, vel: 0.5, shape: 0.4, swell: 0.3}, cres: [0.8, 1.0], timp: {p: 'two', roll: 2}, cr: true, choir2: {inst: 'strings', n: 4, reg: [55, 84], vel: 0.45, width: 1.3}, lead: {inst: 'tpts', harm: -7, hvel: 0.85, shape: 0.4, swell: 0.4}, lead2: {ph: '@', inst: 'trombones', oct: -1, vel: 0.62, shape: 0.4, swell: 0.4}, pad: {p: 'swell', inst: 'tpts', n: 3, reg: [62, 77], vel: 0.25, width: 1.3}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53, 72], vel: 0.80}, pad3: {p: 'sus', inst: 'trombones', n: 3, reg: [41, 58], vel: 0.90}, bass: {inst: {p: 'tuba', att: 0.06}}}}, descant: {sections: ['A1', 'A2', 'B', 'R', 'T', 'D', 'E'], inst: 'strings', oct: 1, lvl: 0.22}, sends: {drums: {verb: 0.04, stage: 0.4}, lead: {verb: 0.06, stage: 0.42, dly: 0.03}}, orch: true, upgrade: false, holdLow: false, hall: 'musikverein', tone: {lo: 4, hi: 4.5, pres: 5}, lowBand: 5.5, subBass: 1.0, mix: {lead: 2.3, pad: 0.95, bass: 3.2, arp: 5.6, drums: 0.6, bell: 2.5}, verb: {B: 0.8, R: 0.8}, sing: {sections: ['B', 'R'], inst: 'choirOoh', oct: 0, lvl: 0.286}, space: {B: {pad: {velK: 0.75}}, R: {pad: {velK: 0.75}}}, trim: 1.35},
    'procession': {settled: true, brassHarm: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.32, pres: 2.6}, lowBand: 3.5, subBass: 0.35, mix: {lead: 1.6, bass: 1.95, drums: 1.7, arp: 1.78}, sends: {drums: {verb: 0.05, stage: 0.36}, lead: {verb: 0.08, stage: 0.4, dly: 0.04}}, verb: {B: 0.8, R: 0.8}, sing: {sections: ['B', 'R'], inst: 'choirOoh', oct: 0, lvl: 0.264}, descant: {sections: ['A2', 'B', {n: 'T', harm: -2}, 'R'], inst: 'tpts', oct: 1, lvl: 0.4}, secs: {T: {lv: 0.85, cres: null, lead: {harm: -2}, pad2: {p: 'sus', inst: 'horn', n: 4, reg: [53,72], vel: 0.75}}}, space: {B: {pad: {velK: 0.75}}}, trim: 1.26},
    'victory': {secs: {A3: {prog: 'I V ii7 V | IV V I I'}}, quietPerc: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.35, hi: 0, pres: 1.9}, lowBand: 2.5, subBass: 0.72, mix: {lead: 1.23, choir: 1.2, arp: 1.6}, verb: {A2: 0.8, B2: 0.8, A3: 0.72}, trim: 1.1},
    'defeat': {secs: {E: {prog: 'i bVIM7 bIII bVIIsus4 | iv i V i'}, B: {prog: 'i bVIM7 bIII bVIIsus4 | iv i V i'}}, quietPerc: false, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.5, hi: 1.2, pres: 1.6}, lowBand: 2.5, subBass: 0.47, mix: {lead: 1.24}, trim: 1.68},
    'spy': {quietPerc: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.08, hi: 0.35, pres: 4}, lowBand: 2.5, subBass: 0.57, mix: {choir: 1.79, lead: 1.3, arp: 2.5}, trim: 1.16},
    'gnn': {secs: {A3: {prog: 'I V vi IV | IM7 V vi IV'}, D: {prog: 'ii V I I | ii V I Vsus4'}, B2: {prog: 'ii V I I | vi IV V Vsus4'}, B: {prog: 'ii V I I | vi IV V Vsus4'}}, hall: 'musikverein', tone: {lo: 3, hi: 0.06}, lowBand: 4, subBass: 0.56, mix: {lead: 1.46, arp: 2.0, pad: 0.85}, trim: 0.7},
    'orion': {quietPerc: false, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.55, hi: 1.34, pres: 2.3}, lowBand: 2.5, subBass: 0.32, mix: {lead: 2.13}, verb: {A3: 0.8}, sing: {sections: ['A3'], inst: 'choirOoh', oct: 0, lvl: 0.207}, trim: 1.88},
    'antarans': {quietPerc: false, hall: 'musikverein', tone: {lo: 3, hi: 0}, lowBand: 4, subBass: 0.1, mix: {lead: 2.11, choir: 2.18, bass: 1.22}, space: {A2: {choir: {velK: 0.7}}, A3: {choir: {velK: 0.7}}}, trim: 1.56},
    // the laboratory (the research screen): bright and near, a light foundation
    'lab1': {choirFwd: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2}, lowBand: 2, subBass: 0.25, trim: 7.60},
    'lab2': {choirFwd: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2}, lowBand: 2, subBass: 0.25, trim: 5.22},
    'lab3': {choirFwd: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.5, hi: 1.5, pres: 2}, lowBand: 2, subBass: 0.25, trim: 9.47},
    'galaxy1': {orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.95, hi: -0.68, pres: 1}, lowBand: 2.5, subBass: 0.42, mix: {lead: 1.23}, trim: 2.42},
    'galaxy2': {secs: {B2: {prog: 'bVIIsus4:1 bVII:1 IV:2 i:1 ii:1 IV:1 i:1'}, B: {prog: 'bVIIsus4:1 bVII:1 IV:2 i:1 ii:1 IV:1 i:1'}, A3: {prog: 'Isus2:1 IVsus4:1 i:1 IV:1 bVIIsus4:1 IVsus4:1 i:2'}, A2: {prog: 'i:1 IVsus4:1 i:1 IV:1 bVII:1 IV:1 i:2'}, A1: {prog: 'Isus2:1 IVsus4:1 i:1 IV:1 bVII:1 IV:1 i:2'}}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.52, hi: -0.98, pres: 4}, lowBand: 2.5, subBass: 0.26, trim: 2.22},
    'galaxy3': {secs: {E: {prog: 'i bVI bVII i | i bVI bIII bVI'}, A1: {prog: 'i bVI bVII i | i bVI bVII V:.5 i:.5'}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.68, pres: 1.7}, lowBand: 3.5, subBass: 0.25, mix: {choir: 2.74, lead: 0.85, bass: 1.16}, sing: {sections: ['B2'], inst: 'choirOoh', oct: 0, lvl: 0.238}, space: {A3: {pad: {velK: 0.75}}}, trim: 2.02},
    'galaxy4': {secs: {A1: {prog: 'IM7:4 II:4 | IM7:4 IM7:4'}, B: {prog: 'vi:4 IM7:4 | IM7:4 vi:4'}, E: {prog: 'IM7:4 vi7:4 | IM7:4 V:4'}}, choirFwd: false, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.53, hi: -0.92, pres: 3.3}, lowBand: 2.5, subBass: 1.2, mix: {lead: 3.53, choir: 1.23, arp: 1.78}, space: {A1: {pad2: {velK: 0.75}}}, trim: 3.19},
    'galaxy5': {secs: {B2: {prog: 'vi V | I V | vi ii | V I'}, B: {prog: 'vi V | I V | vi ii | V I'}, A3: {prog: 'I IV | iii IV | ii V | I I'}, A2: {prog: 'I IV | ii7 IV | ii V | I I'}, A1: {prog: 'I IV | vi V | ii V | I I'}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.15, hi: -1, pres: 2.4}, lowBand: 2.5, subBass: 0.35, mix: {lead: 2.84, choir: 2.68}, trim: 2.45},
    'galaxy6': {oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 3, pres: 4}, lowBand: 2.5, subBass: 0.22, mix: {lead: 3.37, choir: 1.5, bass: 1.41}, space: {A1: {pad: {velK: 0.75}}, B: {pad: {velK: 0.75}}, C: {choir: {velK: 0.6}}, A2: {pad: {velK: 0.75}}}, trim: 3.92},
    'galaxy7': {bassHold: false, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -1, pres: 1.5}, lowBand: 2.5, subBass: 0.67, mix: {lead: 2.51, choir: 2.97, bass: 1.39}, trim: 2.26},
    'galaxy8': {secs: {A1: {prog: 'I:2 bVIIM7:2 | I:2 bVII:2 | Isus4:2 bVIIM7:2 | I:2 bVII:2', lead: {ph: ["K1b K2 K3 K4", "K1b K2 r4 K4", "r4 K1b K2 K4"]}}, A2: {prog: 'I:2 bVII:2 | Isus4:2 bVIIM7:2 | Isus4:2 bVIIM7:2 | I:2 bVII:2', lead: {ph: ["K1 K2 K3 K4", "r4 K2 K1 K4"]}, lead2: {ph: ["r4 K3 K2 K4", "r8 K3 K4"]}}, E: {prog: 'I:2 bVIIM7:2 | I:2 bVII:2', lead: {ph: ["K1b r4", "K4 r4", "r4 K1b"]}}}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 3.14, pres: 4}, lowBand: 2.5, subBass: 0.28, mix: {lead: 3.39, bass: 1.25, arp: 3.0}, trim: 2.61},
    'galaxy9': {settled: true, oldMen: {vel: 0.6}, secs: {A2: {lead2: {inst: 'choirMenOldLine'}}}, brassHarm: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 1.5, pres: 4}, lowBand: 0, subBass: 0.07, mix: {lead: 1.15}, verb: {B: 0.8, A2: 0.72}, sing: {sections: ['B', 'A2'], inst: 'choirOoh', oct: 0, lvl: 0.209}, space: {A1: {pad: {velK: 0.75}}, A2: {pad2: {reg: [76,88]}, pad3: {velK: 0.75}}, B: {pad3: {velK: 0.75}}}, trim: 1.72},
    'galaxy10': {settled: true, brassHarm: false, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.9, hi: 1.08}, lowBand: 2.5, subBass: 0.41, mix: {lead: 2.75}, verb: {B: 0.8, A2: 0.72}, space: {intro: {pad: {reg: [60,76]}}, A1: {pad: {reg: [60,76]}, pad2: {velK: 0.7}}, B: {pad: {reg: [69,83]}, pad2: {velK: 0.7}, choir2: {velK: 0.6}}, A2: {pad: {reg: [69,83]}, pad2: {velK: 0.7}, choir2: {velK: 0.6}}}, trim: 1.23},
    'galaxy11': {choirFwd: false, secs: {rise: {prog: 'IM7:2 V:2 | IM7:2 Vsus4:2', lead2: {ph: "H1 NB2"}}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0.38, hi: -0.62, pres: 2.4}, lowBand: 2.5, subBass: 0.06, mix: {lead: 4.3, choir: 1.36}, sing: {sections: ['rise'], inst: 'choirOoh', oct: 0, lvl: 0.238}, trim: 3.32},
    'galaxy12': {secs: {V4: {lead: {ph: ["P1 P2", "P2 P1"]}}, V5: {lead: {inst: 'altoFluteIowa'}, lead2: null}, V6: {lead: {ph: "H1 P2"}}},   // V5: the four slow notes on the alto flute, the chime gone (out of place in the refreshed sound)
    oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.9, hi: 3.23, pres: 1.2}, lowBand: 1.5, subBass: 0.36, mix: {lead: 2.81}, sing: {sections: ['V6'], inst: 'choirOoh', oct: 0, lvl: 0.187}, space: {V4: {pad: {velK: 0.75}}, V6: {pad: {velK: 0.75}}}, trim: 2.62},
    'galaxy13': {secs: {W2: {lead2: null}, H: {lead2: null}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -1.5}, lowBand: 2.5, subBass: 0.32, mix: {lead: 3.08, choir: 2.62, arp: 1.78}, space: {mid: {choir2: {velK: 0.6}}}, trim: 3.14},
    'galaxy14': {settled: true, brassHarm: false, sing: {sections: ['sunrise'], inst: 'choirOoh', oct: 0, lvl: 0.238}, trim: 2.91},   // first light, rewritten (simpler): its own definition carries the standard; the choir sings the hymn with the horns
    'galaxy15': {secs: {still: {prog: 'IM7:2 IV:2 | IM7:2 I:2'}}, bassHold: false, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 2.18, pres: 1.2}, lowBand: 3.5, subBass: 0.93, mix: {lead: 3.89, choir: 1.88, bass: 1.41, arp: 1.78}, space: {CF2: {pad: {reg: [63,77]}, choir2: {velK: 0.6}}, CF3: {pad: {reg: [63,77]}, choir2: {velK: 0.6}, pad2: {reg: [63,77]}}}, trim: 3.36},
    'galaxy16': {secs: {full2: {prog: 'vi7:2 V/IV:1 IVM7:1 | Isus4:1 IM7:1 V:2'}, full: {prog: 'IM7:2 vi9:2 | IVM7:2 V:2'}, add: {prog: 'vi7:2 V/IV:2 | IM7:2 V:2'}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.9, hi: -1, pres: 3.1}, lowBand: 2.5, subBass: 0.29, mix: {lead: 3.2}, trim: 3.66},
    'galaxy17': {oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: -0.39}, lowBand: 3.5, subBass: 0.56, mix: {lead: 1.99, choir: 2.97, bass: 1.41}, space: {still: {pad: {velK: 0.75}}, canon3b: {pad: {velK: 0.75}}}, trim: 4.01},
    'galaxy18': {secs: {crest: {prog: 'IM7:2 V:2 | IM7:2 V:1.5 Vsus4:.5', lead2: {ph: "H1 LN5"}}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 2.84, hi: 0.24}, lowBand: 2.5, subBass: 0.23, mix: {lead: 3.53}, sing: {sections: ['crest'], inst: 'choirOoh', oct: 0, lvl: 0.238}, trim: 2.56},
    'galaxy19': {secs: {ch3: {prog: 'I IV I V | IVM7 I V I'}, str: {prog: 'I IV ii V | IVM7 I V I', lead: {ph: ["NC1 NC2", "NC1 r4"]}, lead2: {ph: ["r4 NC2", "r8"]}}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 1.99}, lowBand: 2.5, subBass: 0.26, mix: {lead: 4.15, choir: 1.7, bass: 1.32}, verb: {ch3: 0.8}, sing: {sections: ['ch3'], inst: 'choirOoh', oct: 0, lvl: 0.155}, space: {ch2: {pad: {velK: 0.75}}, ch3: {pad: {velK: 0.75}}, amen: {pad: {reg: [60,79]}}}, trim: 1.83},
    'galaxy20': {quietPerc: false, secs: {trio: {prog: 'i bVII i iv:.5 V:.5 | bVIM7 iv V i', lead2: {ph: "CMF"}}}, oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 3, hi: 3.5, pres: 4}, lowBand: 2.5, subBass: 0.32, mix: {lead: 2.95, bass: 1.35}, sing: {sections: ['M3', 'M4'], inst: 'choirMen', oct: 0, lvl: 0.28}, space: {M2: {pad: {reg: [54,68]}, choir: {velK: 0.6}}, M3: {pad: {reg: [60,76]}}, M4: {pad: {reg: [68,82]}, choir: {velK: 0.6}}}, trim: 2.88},
    'galaxy21': {oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 0, hi: 3.3, pres: 3.3}, lowBand: 1.5, subBass: 0.24, trim: 3.98},
    'galaxy22': {oldMen: {vel: 0.35}, orch: true, upgrade: true, holdLow: false, hall: 'musikverein', tone: {lo: 1.7, hi: 1.56, pres: 1.1}, lowBand: 1.5, subBass: 0.22, mix: {lead: 1.91}, verb: {crest: 0.8}, space: {men: {pad: {reg: [62,76]}, choir2: {velK: 0.6}}, satb: {pad: {velK: 0.7}, choir2: {velK: 0.6}}, satb2: {pad: {velK: 0.75}, pad2: {velK: 0.7}, choir: {velK: 0.6}}, still: {pad: {reg: [58,72]}, choir2: {velK: 0.6}}, crest: {pad: {velK: 0.7}, choir: {velK: 0.6}, pad2: {velK: 0.7}}}, trim: 3.61},
    'galaxy23': {settled: true, oldMen: {vel: 0.3, reg: [38, 52]}, trim: 4.97},
    'race:alkari': {hall: 'musikverein', tone: {lo: 1.15, hi: 0, pres: 1.5}, lowBand: 3, mix: {lead: 0.88}, trim: 1.59},
    'race:bulrathi': {secs: {C: {prog: 'i bVI bVII Vsus4'}}, hall: 'musikverein', tone: {lo: 1.15, hi: 2.28, pres: 0.6}, lowBand: 3, subBass: 0.1, mix: {lead: 1.45, choir: 1.58}, space: {A: {pad: {reg: [64,78]}}, B: {pad: {reg: [64,78]}, choir: {velK: 0.7}}, C: {pad: {reg: [62,76]}}}, trim: 1.04},
    'race:darlok': {hall: 'musikverein', tone: {lo: 0, hi: 0.3, pres: 1.4}, lowBand: 3, subBass: 0.37, mix: {lead: 2.84}, space: {A: {choir: {velK: 0.7}}, B: {choir: {velK: 0.7}}}, trim: 1.53},
    'race:human': {secs: {C: {prog: 'IV Vsus4 V I'}}, hall: 'musikverein', tone: {lo: 1.2, hi: 1.44, pres: 0.7}, lowBand: 3, mix: {lead: 1.2}, trim: 0.77},
    'race:klackon': {hall: 'musikverein', tone: {lo: 0.5, hi: 0, pres: 1.2}, lowBand: 3, subBass: 0.82, mix: {lead: 1.26}, space: {A: {pad: {velK: 0.7}}, B: {pad: {velK: 0.7}}, A2: {pad: {velK: 0.7}}, B2: {pad: {velK: 0.7}}}, trim: 1.26},
    'race:meklar': {hall: 'musikverein', tone: {lo: 0.6, hi: 0, pres: 1.1}, lowBand: 3, mix: {lead: 1.14}, space: {A: {pad: {reg: [68,82]}}, B: {pad: {reg: [73,87]}}, A2: {pad: {reg: [68,82]}}, B2: {pad: {reg: [73,87]}}}, trim: 0.82},
    'race:mrrshan': {hall: 'musikverein', tone: {lo: 1.8, hi: 0.3, pres: 1.1}, lowBand: 3, subBass: 0.46, mix: {lead: 2.09, choir: 1.58}, trim: 0.93},
    'race:psilon': {hall: 'musikverein', tone: {lo: 1.7, hi: 1.2, pres: 0.9}, lowBand: 3, subBass: 0.57, trim: 1.21},
    'race:sakkra': {hall: 'musikverein', tone: {lo: 1, hi: 0, pres: 1.4}, lowBand: 3, subBass: 0.63, mix: {lead: 1.16}, trim: 1.48},
    'race:silicoid': {hall: 'musikverein', tone: {lo: 0.5, hi: 0.96}, lowBand: 3, mix: {lead: 4.45}, space: {A: {pad: {reg: [70,84]}}, B: {pad: {reg: [71,85]}, choir: {velK: 0.7}}}, trim: 1.6},
  };
  // upgrade: the solo winds and brass from the one-layer recordings to the library's three-layer ones of the same instruments (soft, mid
  // and loud each recorded, so a phrase's dynamics change the tone as a player's do). The factor is the loudness of the old against the
  // new at the same notes and dynamics (tools/fresh: the level match), so the part keeps its place in the mix; its dynamic range widens.
  // (the flute and the alto flute set from their melodies' level in the pieces: the matched notes misjudged them by 4 and 20 dB)
  const UPGRADE = { flute: ['fluteIowa', 4.3], oboe: ['oboeIowa', 1.27], clarinet: ['clarIowa', 3.05], altoFlute: ['altoFluteIowa', 1.0],
    bassoon: ['bassoonIowa', 1.92], hornSolo: ['hornIowa', 0.62], tptSolo: ['tptIowa', 2.43] };
  // the choirs, in every refreshed piece: the mixed and the women's voices from the Sonatina sets to the Pianobook choir the main theme
  // uses (much the better recordings: an ooh, and a hum for the closed 'uuh'); the men too, the new choir's lowest recordings carried
  // down through the men's deep register in place of the Sonatina men's modulated sound. Matched in loudness the same way.
  const CHOIRS = { ooh: ['choirOoh', 1.33], aah: ['choirOoh', 0.71], eeh: ['choirOoh', 0.68], choirWomen: ['choirOoh', 0.76], uuh: ['choirHum', 0.80],
    choirMen: ['choirMenNew', 1], choirMenAh: ['choirMenAhNew', 1] };   // the men too, through their whole register
  function upgrade(v, MAP) {
    const INST = Music._INST, name = typeof v === 'string' ? v : v && typeof v === 'object' ? v.p : null, u = name && (MAP || UPGRADE)[name];
    if (!u || !INST[u[0]] || !INST[name]) return v;
    const lvl = (typeof v === 'object' && v.lvl !== undefined ? v.lvl : INST[name].lvl) * u[1] * INST[u[0]].lvl / INST[name].lvl;
    return Object.assign({}, typeof v === 'object' ? v : {}, { p: u[0], lvl: Math.round(lvl * 1000) / 1000 });
  }
  function upgradeAll(d, MAP) {
    // a layer the piece plays without naming its instrument takes the engine's default: name it, so it is upgraded as well
    const D = Music._DEF_INST || {}; d.inst = d.inst || {};
    for (const sc of d.sec) for (const k in D) if (sc[k] && d.inst[k] === undefined && MAP && MAP[D[k]]) d.inst[k] = D[k];
    for (const k in d.inst || {}) d.inst[k] = upgrade(d.inst[k], MAP);
    for (const a of d.alts || []) for (const k in a) a[k] = upgrade(a[k], MAP);
    for (const k in d.eraAlts || {}) d.eraAlts[k] = upgrade(d.eraAlts[k], MAP);
    for (const s of d.sec) for (const k in s) if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && s[k].inst !== undefined) s[k] = Object.assign({}, s[k], { inst: upgrade(s[k].inst, MAP) });
  }
  // sing: the choir takes the tune in a piece's big statements (the sections named), singing the melody with its instrument: the
  // section's lead line, as written, given to the second line on a choir (inst; oct moves it by octaves into the voices' range; vel and
  // lvl set it beside the instrument, so it leads with it rather than under it). Its own recorded vibrato: none added.
  function sing(d, o) {
    for (const n of o.sections) for (const sc of d.sec.filter(x => x.n === n)) {
      if (!sc.lead || typeof sc.lead !== 'object' || sc.lead3) continue;
      // the pipe organ beneath the voices, as in the Chorale (the user: the voices and the organ are the feel of the game)
      if (o.organ !== false && !sc.pad3) sc.pad3 = { p: 'swell', inst: 'organ', n: 3, reg: [55, 72], vel: 0.5 };   // a little above the low mids: its colour without thickening the bottom
      sc.lead3 = Object.assign({}, sc.lead, { inst: { p: o.inst, lvl: o.lvl * CHOIR_FWD.sing }, oct: num(sc.lead.oct, 0) + (o.oct || 0), vel: num(sc.lead.vel, 0.9) * (o.vel || 0.95), pan: -num(sc.lead.pan, 0) * 0.6 + 0.08, vibK: 0, harm: undefined, echo: undefined, skip: undefined });   // it sings whenever the section plays (where the instrument rests, the choir carries the tune alone)
    }
  }
  const num = (v, f) => (typeof v === 'number' && isFinite(v) ? v : f);
  const CHOIR_FWD = { mix: 1.4, verb: 0.28, stage: 0.28, sing: 1.25 };   // +2.9 dB; the hall 0.42 -> 0.28, the close stage 0.18 -> 0.28; sung lines 1 dB under their instrument -> 1 dB over
  // descant: a section of high voices over the tune in a piece's crowning statement (the sections named): the melody, as written, an
  // octave (oct) above on its own line (lead4), loud and bright (the music's full dynamic gives it the brassy recording), at the front.
  function descant(d, o) {
    for (const it of o.sections) { const n = typeof it === 'string' ? it : it.n, harm = typeof it === 'object' ? it.harm : undefined;   // { n, harm }: the section's descant in two parts
      for (const sc of d.sec.filter(x => x.n === n)) {
        if (!sc.lead || typeof sc.lead !== 'object' || sc.lead4) continue;
        sc.lead4 = Object.assign({}, sc.lead, { inst: { p: o.inst, lvl: o.lvl }, oct: num(sc.lead.oct, 0) + (o.oct === undefined ? 1 : o.oct), vel: num(sc.lead.vel, 0.9) * (o.vel || 1), pan: num(o.pan, 0.12), vibK: num(o.vibK, 0.6), harm, echo: undefined, skip: undefined });
      } }
  }
  // space: room in a crowded section, without changing what is written. A bed or a chordal choir that sits on the melody's notes, or a
  // third sustained sound stacked in the low mids (A2-C4) where two already are, is voiced elsewhere (reg: the range its chord notes are
  // drawn from) or steps back (velK); found by measurement (tools/fresh/space.js), section by section: { section: { layer: {reg, velK} } }.
  function space(d, o) {
    for (const n in o) for (const sc of d.sec.filter(x => x.n === n)) for (const ly in o[n]) {
      const c = o[n][ly], v = sc[ly]; if (!v) continue;
      const spec = typeof v === 'string' ? { p: v } : Object.assign({}, v);
      if (c.reg) spec.reg = c.reg.slice();
      if (c.velK) spec.vel = num(spec.vel, 1) * c.velK;
      sc[ly] = spec;
    }
  }
  // secs: a section reshaped for its part in the piece: { section: { key: value } }; a layer's object merges into its own (a preset
  // name becomes { p: name }), anything else (lv, cres) replaces
  function secs(d, o) {
    for (const n in o) for (const sc of d.sec.filter(x => x.n === n)) for (const k in o[n]) {
      const v = o[n][k], cur = sc[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) sc[k] = Object.assign({}, typeof cur === 'string' ? { p: cur } : (cur && typeof cur === 'object' ? cur : {}), v);
      else if (v === null) delete sc[k]; else sc[k] = v;
    }
  }
  // oldMen: the old men's choir layered gently under the new one (the user: its darker, modulated sound has its place): in the sections
  // where the choir sings (or those named), a held bed in the men's deep register, voice-led through the changes (notes the chords
  // share carry on, the moving voices glide), long in and out, low in the mix
  function oldMen(d, o) {
    for (const sc of d.sec) { if (o.sections ? !o.sections.includes(sc.n) : !(sc.choir || sc.choir2 || sc.lead3)) continue; if (sc.choir3) continue;
      if ((sc.cres ? sc.cres[1] : num(sc.lv, 1)) < (o.min === undefined ? 0.55 : o.min)) continue;
      sc.choir3 = { p: 'sus', inst: 'choirMenOld', n: 3, reg: o.reg || [43, 57], vel: o.vel || 0.35, tie: true };
    }
  }
  // The general rules (below) are the score's defaults, not its law: a piece breaks one where the rule would erase what makes it itself, each
  // exemption a musical decision (the user: rules are made to be broken, deliberately). settled: a piece set by ear keeps all of its own;
  // bassHold: false keeps a bass rhythm that is the piece's character (the lullaby's and the prelude's rocking bass in six); quietPerc: false
  // keeps percussion that is drama, not decoration (the cues' opening strikes, timpani and swells, the spy theme's pulse, the slow march's
  // drums); choirFwd: false keeps voices distant where distance is the point (the planetarium pieces, the laboratory); brassHarm: false keeps
  // a brass line as written; upgrade: false keeps the original instruments (Council in state's sections).
  function apply(d, p) {
    for (const k in p) {
      if (k === 'choirFwd' || k === 'brassHarm' || k === 'settled' || k === 'bassHold' || k === 'quietPerc') continue;   // the rules' switches (below)
      if (k === 'upgrade') { if (p.upgrade) upgradeAll(d); }
      else if (k === 'sing') sing(d, p.sing);
      else if (k === 'descant') descant(d, p.descant);
      else if (k === 'secs') secs(d, p.secs);
      else if (k === 'oldMen') oldMen(d, p.oldMen);
      else if (k === 'space') space(d, p.space);
      else if (k === 'verb') { for (const n in p.verb) { const s = d.sec.find(x => x.n === n); if (s) s.verb = p.verb[n]; } }
      else if (k === 'mix' || k === 'tone') d[k] = Object.assign({}, d[k] || {}, p[k]);
      else if (k === 'sends') { d.sends = Object.assign({}, d.sends || {}); for (const ly in p.sends) d.sends[ly] = Object.assign({}, d.sends[ly] || {}, p.sends[ly]); }
      else d[k] = p[k];
    }
    // the melody at the front of the stage, as in the main theme: little hall, the close stage's reflections, a touch of delay (an
    // orchestral piece that does not seat its own lead); the key instrument heard close and alive, the atmosphere behind it
    if (d.orch && !(d.sends && d.sends.lead)) d.sends = Object.assign({}, d.sends || {}, { lead: { verb: 0.12, stage: 0.36, dly: 0.05 } });
    // the choir forward, in every piece (the user: a choir and brass is the game's signature sound): about 3 dB up, nearer (less hall,
    // more of the close stage), its sung melodies over their instruments rather than under them
    // the user's rules for the rest of the score (a piece settled by ear keeps its own: settled: true):
    if (!p.settled) {
      for (const sc of d.sec) {
        const top = sc.cres ? sc.cres[1] : num(sc.lv, 1);
        // a solid bass foundation: in an orchestral piece's moderate and full sections a sustained bass holds through its pattern's gaps
        if (p.bassHold !== false && d.orch && top >= 0.5 && sc.bass && typeof sc.bass === 'object') {   // (bassHold: false, a piece whose bass rhythm is its character)
          const iv = sc.bass.inst !== undefined ? sc.bass.inst : (d.inst && d.inst.bass), nm = typeof iv === 'string' ? iv : iv && iv.p;
          if (!/pulse|moog|pizz|Pizz|marimba|harp|piano/i.test(nm || '')) { const hold = x => typeof x === 'string' && /^\d/.test(x) ? x.replace(/\./g, '-') : x; if (sc.bass.pat) sc.bass = Object.assign({}, sc.bass, { pat: Array.isArray(sc.bass.pat) ? sc.bass.pat.map(hold) : hold(sc.bass.pat) }); }
        }
        // no isolated percussion: in a quiet section (under 0.6) no timpani, cymbal swells, hits, crashes or fills (nor lone drums in an
        // orchestral piece)
        if (p.quietPerc !== false && top < 0.6) { sc.timp = false; sc.rise = false; sc.hit = false; sc.cr = false; sc.fill = false; if (d.orch) sc.drums = false; }
      }
      d.mix = Object.assign({}, d.mix || {}, { bell: ((d.mix && d.mix.bell) || 1) * 0.7 });   // no loud bells: about 3 dB down
    }
    // the brass at a piece's height a harmonic section (as the procession's trio): a brass melody in a full section (0.95 and over)
    // gains a second part a third below, where it has none; a piece settled by ear keeps its own (brassHarm: false)
    if (d.orch && p.brassHarm !== false) for (const sc of d.sec) {
      const top = sc.cres ? sc.cres[1] : num(sc.lv, 1), L = sc.lead; if (top < 0.95 || !L || typeof L !== 'object' || L.harm !== undefined) continue;
      const iv = L.inst !== undefined ? L.inst : (d.inst && d.inst.lead), name = typeof iv === 'string' ? iv : iv && iv.p;
      if (name && /^(horn|brass|tpt|tbn|trombone|tuba|lowBrass|hornSolo|hornIowa)/.test(name)) sc.lead = Object.assign({}, L, { harm: -2 });
    }
    // (a piece built around its soloist keeps its own choir seat: choirFwd: false, the main theme)
    if (p.choirFwd !== false) {
      d.mix = Object.assign({}, d.mix || {}, { choir: ((d.mix && d.mix.choir) || 1) * CHOIR_FWD.mix });
      d.sends = Object.assign({}, d.sends || {}); d.sends.choir = Object.assign({}, d.sends.choir || {}, { verb: CHOIR_FWD.verb, stage: CHOIR_FWD.stage });
    }
    upgradeAll(d, CHOIRS);
    d.refreshed = true; delete d._p;   // the engine's prepared form of the piece, made again from the refreshed definition
  }
  Music._refresh = R; Music._applyRefresh = apply;   // tools try a refresh before it is written here (tools/fresh/sweep.js --patch)
  if (off) { Music._dbg.noLayerFlow = true; return; }   // as they were: the layer flow and its rare exceptions too (the main theme's A)
  for (const id in R) {
    const b = T[id], w = T[id + ':war'], p = R[id]; if (!b) continue;
    const k = p.trim ? p.trim / b.trim : 1; apply(b, p);
    if (w) apply(w, Object.assign({}, p, p.trim ? { trim: w.trim * k } : {}));   // its own trim, moved by the same ratio
  }
})(window.MOO);
