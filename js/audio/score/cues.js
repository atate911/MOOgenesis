// Master of Orion — Reborn · the score · screens, events and the title
// The title hymn, the battle and ground cues, the council and the procession, the news, Orion and the Antarans, the endings, espionage, two cues no screen plays any more (design, research).
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  Track('title', {
    desc: 'Main theme — the undercurrent: a deep bed first (deep open chords in the low strings, the double bass on a slow line with its sub nearly sub-bass, the planetarium’s analogue glow, one chime), the men entering humming low; the solo horn’s first part the commonwealth’s tune itself, as the Commonwealth plays it, in the major, whole and slow over them, then its sequence a step up and its fall in descending thirds; the men state the tune low once more and the horn answers in the relative minor; the bassoon low and the horn in variation, a soft trumpet high above once; the oboe’s lyrical variation in the breath; the tune back whole for the crescendo in two steps, a high horn and a low brass voice in canon, then the full brass with the timpani, the strings and the mallets for the build and the chamber open on ah; the fade on variations, the solo horn alone, down into the drone',
    quotes: ['procession'],
    bpm: 58, root: 'D', mode: 'major', loopFrom: 'A1', trim: 2.5, tens: false, rubato: 0.025, tone: { lo: 1.4, hi: 0.6 }, fx: { verb: 1.0, stage: 0.8, dly: 1.6 }, mix: { choir: 1.15, pad: 0.95, lead: 2.2, bass: 1.25 }, duck: 0.6,
    sends: { lead: { verb: 0.08, stage: 0.36, dly: 0.06 }, choir: { verb: 0.32, stage: 0.12 }, bell: { verb: 0.5, stage: 0.2 } },   // the solo at the front of the stage and dry, the bed behind it in the hall; the high trumpet and the points far back
    forms: [['A1', 'B', 'C', 'A2', 'A3', 'E', 'A1', 'C', 'E'], ['A1', 'C', 'B', 'A2', 'A3', 'E', 'A1', 'B', 'E']],
    alts: [{}, { choir2: 'choirWomen' }],
    inst: { pad: 'cellos', pad2: 'analog', bass: 'deep', lead: 'hornSolo', lead2: 'cello', bell: 'crystal', bell2: 'tpts', choir: 'choirMen', choir2: 'ooh', arp: 'glass' },
    ph: {
      PA: '@procession.A1', PB: '@procession.A2',      // the commonwealth's tune, the game's theme, as the Commonwealth plays it: the strain (1 2 3 5 | 6 5 3 2) and its answer to the octave
      L2: '1:4 | 2:4 | 3:4 | 5:4',                      // its head in whole notes: the foundation the cellos lay before the return
      L3: '6:3 5:1 | 3:2 2:2 | 1:4 | r:4',              // its second half slowed: the fall home from the sixth (the climax's last phrase)
      V1: '2:3 3:1 | 4:2 6:2 | 7:3 6:1 | 4:2 3:2',      // the variations, each a classical device on the tune: the strain as a real sequence a step up, to a half close (over ii IV V V)
      V2: '6:2 4:2 | 5:2 3:2 | 4:2 2:2 | 1:4',          // the fall as a chain of descending thirds to the cadence (over IV I V I)
      V3: '6:4 | 7:2 8:2 | 10:4 | 11:2 10:2',           // the head answered in the relative minor, in augmentation, through the major seventh to the dominant (over vi IM7 iii V)
      V4: '8:2 7:1 6:1 | 5:2 3:2 | 4:3 2:1 | 2:4',      // the answer's octave falling to hang on the dominant (over IM7 I ii V)
      V5: '3:3 5:1 | 6:2 5:2 | 3:2 2:1 1:1 | 2:4',      // the lyrical one, the oboe's, from the third (over I I vi V)
      TH: '5:4 | 5:4 | r:4 | r:4',                      // the high trumpet holding the fifth, once
      ST2: '1:4 | r:12',                                // one chime at the very start
    },
    // The title is an undercurrent, not a song or a march: the feel of a game loading, the possibilities. It is the commonwealth's tune
    // and nothing else: in the major, as the Commonwealth plays it (the same tune in the minor over a men's choir was heard as Crimson
    // Tide, and so was the hymn's rising fourth, which is gone from here). The brooding is in the bed, not the mode: deep open chords in
    // the low strings (C2-E3, roots and fifths), the double bass on a slow line with its sub nearly sub-bass, the men humming low two
    // voices to a chord, the flat seventh and the sixth degree in the harmony, 58 to the beat, one chord to a bar; never busy. One melody
    // at a time, and the tune itself only where it counts: the solo horn's first part states it whole (D3-D4) and the men state it low
    // once more; everything between is variation drawn from it by the classical means (V1-V5: the strain as a real sequence a step up,
    // the fall as a chain of descending thirds, the head answered in the relative minor in augmentation through a major seventh, the
    // answer's octave hanging on the dominant, the oboe's lyrical one from the third); the tune returns whole for the crescendo, and the
    // fade is variation again; the bass echoes the head (root, second, third, fifth on each chord) under the variations and the cellos lay
    // it in whole notes under the breath, so the whole piece leans toward the hook's return. The section brass at the crest holds one
    // recorded dynamic layer per line (shape light, no swell): a hand-over mid-note sounded like a different horn. Then the crest in two steps: a high horn and a low brass voice in a two-bar canon on the tune (the duet), then the full brass on the
    // answer and the fall with the timpani on the beat, the strings and the mallets' sparkle (the build), and the quiet section after it. The
    // solo has a window: nothing else in its octave (the low strings below it, the glow and the violas above A4), the hum spread to the
    // sides (width 0.85), the beds ducking 4.4 dB under every solo note (duck), its sends dry, its fader high (mix.lead). Accents are few:
    // one soft trumpet high above, the timpani only at the crest. 'title:reed' (below) is the same piece with the cor anglais as the first
    // soloist an octave above the horn, its window moved up with it.
    sec: [
      { n: 'drone', bars: 2, cres: [0.56, 0.62], prog: 'I:2', pad: { p: 'swell', n: 2, reg: [36, 52], vel: 0.55, open: true }, pad2: { p: 'swell', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.95, att: 1.6, rel: 2.8 } }, bell2: { ph: 'ST2', inst: 'chime', vel: 0.4 }, choir: false, timp: false, drums: false },   // the bed alone: deep open chords, the pedal, the glow, one chime
      { n: 'men', bars: 8, cres: [0.62, 0.7], prog: 'I I IV I | I vi IV I', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.52, open: true }, pad2: { p: 'swell', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: ['1---', '1--5'], inst: { p: 'deep', sub: 0.95, att: 1.0, rel: 2.4 } },
        choir: { n: 2, reg: [43, 52], vel: 0.55, soft: true, width: 0.85 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, timp: false, drums: false },   // the men enter humming low, one chord to a bar
      { n: 'horn', bars: 16, cres: [0.68, 0.76], prog: 'I I IV I | I I IV V | ii IV V V | IV I V I', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.5, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.3 }, bass: { pat: ['1--5', '1---', '1--5', '1---', '1--5', '1---', '1--5', '1---', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------'], inst: { p: 'deep', sub: 0.95, att: 0.6, rel: 2.0 } },
        lead: { ph: 'PA*0.9 PB*1 V1*0.95 V2*0.9', oct: -1, vel: 0.95, shape: 0.45, swell: 0.4, pan: -0.05 }, choir: { n: 2, reg: [43, 52], vel: 0.55, soft: true, width: 0.85 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 },
        drums: { bdSoft: ['................', 'x...............'], vel: 0.2 }, timp: false },   // the horn's first part: the tune whole, slow and low over the men, then its sequence a step up and the fall in thirds; the undercurrent begins under it
      { n: 'A1', bars: 16, cres: [0.68, 0.78], prog: 'I I IV I | I I IV V | vi IM7 iii V | IM7 I ii V', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.52, open: true }, pad2: { p: 'sus', inst: 'violas', n: 2, reg: [74, 86], vel: 0.34 }, bass: { pat: ['1--5', '1---', '1--5', '1---', '1--5', '1---', '1--5', '1---', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------', '1---2---3---5---', '1-------'], inst: { p: 'deep', sub: 0.95, att: 0.6, rel: 2.0 } },
        lead: { ph: 'PA PB r8', inst: 'choirMenAh', oct: -1, vel: 0.84, shape: 0.4, width: 0.5 }, lead2: { ph: ['r8 V3 V4', 'r8 V3 r4'], inst: 'hornSolo', oct: -1, vel: 0.92, shape: 0.45, swell: 0.4, pan: -0.05 },
        choir: { n: 2, reg: [43, 52], vel: 0.55, soft: true, width: 0.85 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 }, drums: { bdSoft: 'x...............', vel: 0.22 }, timp: false },   // the men take the tune, low, over the deep chords and the bass line; the horn answers in the relative minor and with the answer's octave when they stop; the violas' pedal far above
      { n: 'B', bars: 8, cres: [0.68, 0.78], prog: 'IV I V I | ii IV V V', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.52, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.3 }, bass: { pat: ['1---2---3---5---', '1-------'], inst: { p: 'deep', sub: 0.95, att: 0.6, rel: 2.0 } },
        lead2: { ph: 'V2 r4', inst: 'bassoon', oct: -2, vel: 0.62, shape: 0.35, swell: 0.2 }, lead: { ph: 'r4 V1', oct: -1, vel: 0.92, shape: 0.45, swell: 0.4, pan: -0.05 }, bell2: { ph: 'r4 TH', inst: 'tptSolo', oct: 1, vel: 0.26, shape: 0.4, swell: 0.35 }, choir: { n: 2, reg: [43, 52], vel: 0.55, soft: true, width: 0.85 },
        bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 }, drums: { bdSoft: 'x...............', vel: 0.22 }, timp: false },   // the bassoon low with the fall in thirds, the horn answering with the sequence; the soft trumpet high above once
      { n: 'C', bars: 8, lv: 0.44, prog: 'I I vi V | I I vi V', pad: { p: 'swell', inst: 'organSoft', n: 3, reg: [50, 72], vel: 0.48 }, pad2: { p: 'sus', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.85, att: 1.4, rel: 2.6 } },
        lead: { ph: 'L2 L2', inst: 'cello', oct: -1, vel: 0.5, shape: 0.3 }, lead2: { ph: ['r4 V5', 'V5 r4'], inst: 'oboe', vel: 0.6, shape: 0.35, swell: 0.2 }, arp: { inst: 'harp', pat: '0...2...1...3...', res: 1, vel: 0.34, reg: [55, 81], skip: 0.3 }, choir: { n: 2, reg: [43, 52], vel: 0.45, soft: true, width: 0.85 }, choir2: { n: 2, reg: [69, 81], vel: 0.24, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.32 }, drums: false, timp: false, rise: 2 },   // the breath: the oboe's own lyrical variation over the harp, the hum, the women; under it the cellos lay the head in whole notes, the foundation for the return
      { n: 'A2', bars: 8, cres: [0.78, 0.9], prog: 'I I IV I | I I IV V', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.52, open: true }, pad2: { p: 'sus', inst: 'violas', n: 2, reg: [62, 74], vel: 0.36 }, bass: { pat: ['1--5', '1---'], inst: { p: 'deep', sub: 0.95, att: 0.6, rel: 1.8 } },
        lead: { ph: 'PA PB', inst: 'hornSolo', oct: 0, vel: 0.9, shape: 0.4, swell: 0.3, pan: -0.08 }, lead2: { ph: 'r2 PA PB', inst: 'trombones', oct: -1, vel: 0.74, shape: 0.15, swell: 0, pan: 0.12 },
        choir: { n: 2, reg: [43, 52], vel: 0.55, soft: true, width: 0.85 }, timp: { kick: ['X...............', '................', '................', '................', 'X...............', '................', '................', '................'], vel: 0.5 }, bell: false, drums: { bdSoft: 'x...............', vel: 0.22 } },   // the duet: a high horn on the tune, a low brass voice two bars behind it in canon; the violas arrive
      { n: 'A3', bars: 8, cres: [0.9, 1.08], prog: 'I I IV I | IV vi I I', cr: true, pad: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.6 }, pad2: { p: 'sus', n: 3, reg: [36, 57], vel: 0.62, open: true }, bass: { pat: '1---5---1---5---', inst: { p: 'deep', sub: 0.95, att: 0.4, rel: 1.6 } },
        lead: { ph: 'PB L3', inst: 'horn', vel: 0.86, shape: 0.15, swell: 0 }, lead2: { ph: 'PB L3', inst: 'trombones', oct: -1, vel: 0.74, shape: 0.15, swell: 0 }, bell2: { ph: 'r4 L3', inst: 'tpts', vel: 0.62, shape: 0.15, swell: 0 },
        arp: { inst: 'marimba', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.46, reg: [72, 96] }, choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.85 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.66 }, timp: { p: 'beats', vel: 0.6 },
        bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.36 }, drums: { bdSoft: 'x...............', vel: 0.26 } },   // the build: the full brass on the answer and the fall, the timpani on the beat, the strings and the mallets' sparkle, the chamber open on ah; the quiet section follows
      { n: 'E', bars: 8, cres: [0.7, 0.4], prog: 'vi IM7 iii V | IV I V I', pad: { p: 'sus', n: 2, reg: [36, 52], vel: 0.5, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.95, att: 1.2, rel: 2.6 } },
        lead: { ph: 'V3 V2', oct: -1, vel: 0.88, shape: 0.45, swell: 0.3, pan: -0.05 }, choir: { n: 2, reg: [43, 52], vel: 0.5, soft: true, width: 0.85 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, drums: false, timp: false },   // the fade: the solo horn alone, the head in the relative minor and the fall in thirds, down into the drone
    ],
  });

  // The same piece with a double reed as the first soloist: the cor anglais an octave above the horn's register (D4 to D5, its plaintive
  // middle), the window in the bed moved up with it (the cellos under it, the glow, the violas and the women higher still). The crest keeps
  // the horn section; the breath keeps the oboe. Hidden: the menu plays the title; this reading is for the player page and for later.
  (function () {
    const d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the reed reading — the same undercurrent with the cor anglais as the first soloist, an octave above the horn: the commonwealth’s tune whole and slow over the humming men, as the Commonwealth plays it, then its variations; the men state it low once more, the bassoon and the horn in variation; the tune back whole for the crescendo, the horns in canon, then the full brass; the fade on variations';
    d.hidden = true; d.variantOf = 'title';
    for (const s of d.sec) {
      if (s.lead && typeof s.lead === 'object' && !s.lead.inst) {        // the solo sections (horn, A1, B, E): the track's hornSolo
        s.lead.inst = 'reed'; s.lead.oct = 0; s.lead.vel = Math.min(1, (s.lead.vel || 0.9) * 0.96);
        s.lead.ph = [].concat(s.lead.ph).map(p => p.replace(/L2\^/g, 'L2').replace(/L3\^/g, 'L3')); if (s.lead.ph.length === 1) s.lead.ph = s.lead.ph[0];
        if (s.pad2 && s.pad2.reg && s.pad2.reg[0] === 72) s.pad2.reg = [76, 91];               // the glow higher still
        if (s.pad2 && s.pad2.inst === 'violas') s.pad2.reg = [77, 89];
        if (s.pad && s.pad.inst === 'organSoft') s.pad.reg = [74, 86];
        if (s.choir2 && s.choir2.reg) s.choir2.reg = [74, 86];
      }
    }
    Track('title:reed', d);
  })();

  // The organ reading, ready though the game may never play it: the pipe organ is the instrument, in a great hall (a pipes-and-snare
  // reading was built from the oboe and the bassoon and dropped: without real bagpipe samples it did not sound like pipes).
  (function () {
    const d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the organ reading — the pipe organ is the instrument, in a great hall: one vast open chord first across five octaves with the pedal under it, the men humming low; the full stop plays the commonwealth’s tune whole and slow with the octave coupler above it over the soft foundation, then its variations; the men state the tune low once more and the organ answers in the relative minor; the organ in three octaves at once on the variations; the soft stop’s lyrical one in the breath; the tune back whole for the crescendo, the full stop and the 16’ in canon, then the full organ with the chamber open on ah and the timpani; the fade on variations, the soft stop alone over the pedal';
    d.hidden = true; d.variantOf = 'title';
    d.inst = Object.assign({}, d.inst, { pad: 'organSoft', pad2: 'organ', lead: 'organ', lead2: 'organ', bell2: 'organ' });
    d.mix = Object.assign({}, d.mix, { pad: 1.05, lead: 2.1, choir: 1.0, bass: 1.2 }); d.fx = { verb: 1.7, stage: 0.5, dly: 0.6 }; d.tone = { lo: 1.3, hi: 0.9 }; d.duck = 0.66;
    d.sends = { lead: { verb: 0.3, stage: 0.25, dly: 0.04 }, choir: { verb: 0.4, stage: 0.1 }, bell: { verb: 0.45, stage: 0.15 } };
    const PED = pat => ({ pat, inst: { p: 'organ', sub: 0.55, att: 0.08, rel: 1.2 } });                       // the pedal: the organ's own 16' with a 32' under it
    const LOW = (vel, p) => ({ p: p || 'sus', inst: 'organ', n: 2, reg: [24, 43], vel, open: true });          // the great's foundation: roots and fifths from C1
    const FND = (vel, p) => ({ p: p || 'sus', inst: 'organSoft', n: 3, reg: [43, 60], vel });                   // the soft foundation under the melody's octave
    const HUM = vel => ({ n: 2, reg: [43, 52], vel, soft: true, width: 0.85 });
    const SOLO = (ph, vel) => ({ ph, inst: 'organ', oct: 0, vel, shape: 0.3, swell: 0.3 });                      // the full stop, D4 to D5
    const S = {};
    S.drone = { pad: { p: 'swell', inst: 'organ', n: 4, reg: [43, 79], vel: 0.6 }, pad2: LOW(0.6, 'swell'), bass: Object.assign(PED('c---'), { pedal: true }), choir: false, bell2: { ph: 'ST2', inst: 'chime', vel: 0.36 }, bell: false, arp: false, timp: false, drums: false, cres: [0.6, 0.7] };
    S.men = { pad: FND(0.5), pad2: LOW(0.55), bass: PED(['1---', '1--5']), choir: HUM(0.5), bell: false, arp: false, timp: false, drums: false, cres: [0.66, 0.72] };
    S.horn = { pad: FND(0.48), pad2: LOW(0.55), bass: PED(['1--5', '1---']), lead: SOLO('PA*0.9 PB*1 V1*0.95 V2*0.9', 0.86), lead2: { ph: 'PA*0.9 PB*1 V1*0.95 V2*0.9', inst: 'organ', oct: 1, vel: 0.34, shape: 0.3 }, choir: HUM(0.5), bell: false, arp: false, drums: false, timp: false, cres: [0.7, 0.78] };
    S.A1 = { pad: FND(0.5), pad2: LOW(0.56), bass: PED(['1--5', '1---']), lead: { ph: 'PA PB r8', inst: 'choirMenAh', oct: -1, vel: 0.84, shape: 0.4, width: 0.5 }, lead2: { ph: ['r8 V3 V4', 'r8 V3 r4'], inst: 'organ', oct: 0, vel: 0.84, shape: 0.3, swell: 0.3 }, bell2: false, choir: HUM(0.5), bell: false, arp: false, drums: false, timp: false, cres: [0.72, 0.8] };
    S.B = { pad: { p: 'sus', inst: 'organ', n: 4, reg: [43, 79], vel: 0.6 }, pad2: LOW(0.6), bass: PED(['1--5', '1---']), lead: SOLO('V2 V1', 0.9), lead2: { ph: 'V2 V1', inst: 'organ', oct: -1, vel: 0.62, shape: 0.3 }, bell2: { ph: 'V2 V1', inst: 'organ', oct: 1, vel: 0.4, shape: 0.3 }, choir: HUM(0.5), bell: false, arp: false, drums: false, timp: false, cres: [0.76, 0.86] };
    S.C = { pad: { p: 'swell', inst: 'organSoft', n: 3, reg: [43, 62], vel: 0.42 }, pad2: LOW(0.4, 'swell'), bass: Object.assign(PED('c---'), { pedal: true }), lead: { ph: 'L2 L2', inst: 'organ', oct: -1, vel: 0.5, shape: 0.2 }, lead2: { ph: ['r4 V5', 'V5 r4'], inst: 'organSoft', oct: 0, vel: 0.62, shape: 0.3 }, bell2: false, choir: HUM(0.4), choir2: false, bell: false, arp: false, drums: false, timp: false, lv: 0.46, rise: 2 };
    S.A2 = { pad: { p: 'sus', inst: 'organ', n: 4, reg: [43, 79], vel: 0.62 }, pad2: LOW(0.6), bass: PED(['1--5', '1---']), lead: SOLO('PA PB', 0.9), lead2: { ph: 'r2 PA PB', inst: 'organ', oct: -1, vel: 0.66, shape: 0.3 }, bell2: false, choir: HUM(0.5), choir2: false, bell: false, arp: false, drums: false, timp: { kick: ['X...............', '................', '................', '................', 'X...............', '................', '................', '................'], vel: 0.5 }, cres: [0.8, 0.92] };
    S.A3 = { pad: { p: 'sus', inst: 'organ', n: 5, reg: [43, 84], vel: 0.74 }, pad2: LOW(0.68), bass: PED(['1--5', '1---']), lead: SOLO('PB L3', 0.98), lead2: { ph: 'PB L3', inst: 'organ', oct: -1, vel: 0.8, shape: 0.3, swell: 0.4 }, bell2: { ph: 'PB L3', inst: 'organ', oct: 1, vel: 0.5, shape: 0.3 }, choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.88 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.68 }, bell: false, arp: false, drums: false, timp: { p: 'beats', vel: 0.6 }, cres: [0.92, 1.08] };
    S.E = { pad: FND(0.46), pad2: LOW(0.5), bass: Object.assign(PED('c---'), { pedal: true }), lead: { ph: 'V3 V2', inst: 'organSoft', oct: 0, vel: 0.7, shape: 0.3 }, lead2: false, bell2: false, choir: HUM(0.46), choir2: false, bell: false, arp: false, drums: false, timp: false, cres: [0.72, 0.44] };
    for (const sec of d.sec) { const o = S[sec.n]; if (!o) continue; for (const k in o) sec[k] = o[k]; }
    Track('title:organ', d);
  })();

  // A reading in John Williams's manner, ready though the game may never play it: a concert fanfare on the theme. A dotted fanfare on the
  // tune's head in the trumpets with the horns under; the tune in the horns over pulsing strings with the strings doubling it an octave up,
  // the snare and the timpani on the beat, the glockenspiel on the answer, the harp running; a soaring variation in the trumpets built
  // on wide leaps (the fifth to the octave, the sixth to the tenth) over I V IV ii; the lydian lift (the raised fourth held against the
  // tonic) with the harp and the glass; a quiet middle for the oboe; the return with the tune in the trumpets and the horns two bars
  // behind in canon over the low brass, both choirs and the full battery; a cadence coda. Brighter, quicker (76), the wonder rather than
  // the undercurrent.
  Track('title:williams', {
    desc: 'Main theme, the Williams reading — a concert fanfare on the commonwealth’s tune: a dotted fanfare on its head in the trumpets, the tune in the horns over pulsing strings doubled an octave up with the snare and the timpani, a soaring variation in wide leaps, the lydian lift with the harp, a quiet middle for the oboe, the return in the trumpets with the horns in canon over the low brass and both choirs, a cadence coda',
    quotes: ['procession'], hidden: true, variantOf: 'title',
    bpm: 76, root: 'D', mode: 'major', loopFrom: 'theme', trim: 2.2, tens: false, rubato: 0.015, tone: { lo: 1.1, hi: 1.1 }, fx: { verb: 1.0, stage: 1.0, dly: 0.5 }, mix: { lead: 1.6, drums: 0.9, choir: 1.0, bass: 1.1 }, duck: 0.72,
    sends: { lead: { verb: 0.12, stage: 0.3, dly: 0.03 }, drums: { stage: 0.12, verb: 0.05, dly: 0 } },
    forms: [['theme', 'soar', 'lydian', 'quiet', 'return', 'coda'], ['theme', 'soar', 'quiet', 'return', 'lydian', 'coda']],
    inst: { pad: 'strings', pad2: 'horn', bass: 'deep', lead: 'tpts', lead2: 'horn', bell: 'glass', bell2: 'bell', arp: 'harp', choir: 'aah', choir2: 'choirMen' },
    ph: {
      PA: '@procession.A1', PB: '@procession.A2',                           // the tune
      W1: '5:1 8:2 10:1 | 9:1 8:1 5:2 | 6:1 11:2 12:1 | 11:2 9:2',          // the soaring one: the fifth to the octave, the sixth up to the eleventh (over I V IV ii)
      W2: '1:.75 1:.25 1:1 5:2 | 8:1.5 10:.5 8:1 5:1 | 6:.75 6:.25 6:1 8:2 | 5:4',   // the fanfare on the head: the dotted upbeat (over I I IV V)
      W3: '5:2 4#:2! | 5:2 8:2 | 10:3 9:1 | 8:4',                            // the lydian lift: the raised fourth held against the tonic (over I I vi I)
      W4: '6:2 8:2 | 10:2 8:1 6:1 | 5:3 4:1 | 3:2 1:2',                      // the cadence: up to the tenth, down to the tonic (over IV I V I)
      V5: '3:3 5:1 | 6:2 5:2 | 3:2 2:1 1:1 | 2:4',                          // the oboe's lyrical one (over I I vi V)
      L2: '1:4 | 2:4 | 3:4 | 5:4',                                           // the head in whole notes
    },
    sec: [
      { n: 'fanfare', bars: 4, cres: [0.8, 0.95], prog: 'I I IV V', hit: true, pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.6 }, bass: { pat: '1---', inst: { p: 'deep', sub: 0.6, att: 0.2, rel: 1.2 } },
        lead: { ph: 'W2', vel: 0.9, shape: 0.15 }, lead2: { ph: 'W2', oct: -1, vel: 0.7, shape: 0.15 }, bell2: { ph: 'W2', oct: 1, vel: 0.4 }, timp: { p: 'beats', vel: 0.65 }, drums: { snare: 'x..x.xx.x..x.xx.', vel: 0.45 } },   // the dotted fanfare on the head, trumpets over horns, the glockenspiel above
      { n: 'theme', bars: 8, lv: 0.92, prog: 'I I IV V | I vi IV V', pad: { p: 'pulse', pat: 'x.x.x.x.x.x.x.x.', n: 3, reg: [55, 76], vel: 0.5 }, pad2: { p: 'sus', n: 3, reg: [50, 69], vel: 0.4 }, bass: { pat: '1-5-', inst: { p: 'deep', sub: 0.6, att: 0.1, rel: 1.0 } },
        lead: { ph: 'PA PB', inst: 'horn', vel: 0.9, shape: 0.15 }, lead2: { ph: 'PA PB', inst: 'strings', oct: 1, vel: 0.55, shape: 0.2 }, bell2: { ph: 'r4 PB', oct: 1, vel: 0.4 }, arp: { p: 'up8', vel: 0.3, reg: [55, 81] }, choir: { n: 3, reg: [57, 74], vel: 0.45 }, timp: { p: 'two', vel: 0.55 }, drums: { snare: 'x...x...x...x...', vel: 0.4 } },   // the tune in the horns over pulsing strings, the strings doubling it an octave up
      { n: 'soar', bars: 8, cres: [0.9, 1.0], prog: 'I V IV ii | I V IV V', pad: { p: 'pulse', pat: 'x.x.x.x.x.x.x.x.', n: 3, reg: [55, 76], vel: 0.52 }, pad2: { p: 'sus', n: 3, reg: [50, 69], vel: 0.42 }, bass: { pat: '1-5-', inst: { p: 'deep', sub: 0.6, att: 0.1, rel: 1.0 } },
        lead: { ph: 'W1 W1', vel: 0.86, shape: 0.15 }, lead2: { ph: 'W1 W1', oct: -1, vel: 0.6, shape: 0.15 }, bell2: { ph: 'W1 r4', oct: 1, vel: 0.35 }, choir: { n: 3, reg: [57, 74], vel: 0.5 }, timp: { p: 'beats', vel: 0.6 }, drums: { snare: 'x..x.xx.x..x.xx.', vel: 0.42 } },   // the soaring variation in the trumpets, wide leaps, the horns under
      { n: 'lydian', bars: 8, lv: 0.78, prog: 'I I vi I | I I vi I', pad: { p: 'sus', n: 4, reg: [55, 79], vel: 0.55 }, pad2: { p: 'swell', inst: 'air', n: 2, reg: [72, 88], vel: 0.3 }, bass: { pat: '1---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 0.6, rel: 1.8 } },
        lead: { ph: 'W3 W3', inst: 'horn', vel: 0.8, shape: 0.2 }, lead2: { ph: 'W3 W3', inst: 'strings', oct: 1, vel: 0.5, shape: 0.2 }, arp: { p: 'up', vel: 0.36, reg: [55, 84] }, bell: { dens: 0.2, res: 1, reg: [76, 100], vel: 0.4 }, choir: { inst: 'ooh', n: 2, reg: [64, 79], vel: 0.35, soft: true }, timp: false, drums: false },   // the lydian lift: the raised fourth held against the tonic, the harp and the glass, the wonder
      { n: 'quiet', bars: 8, lv: 0.46, prog: 'I I vi V | IV I vi V', pad: { p: 'swell', n: 3, reg: [55, 76], vel: 0.45 }, pad2: false, bass: { pat: '1---', pedal: true, inst: { p: 'deep', sub: 0.7, att: 1.0, rel: 2.0 } },
        lead: { ph: ['V5 r4', 'r4 V5'], inst: 'oboe', vel: 0.6, shape: 0.35, swell: 0.2 }, lead2: { ph: 'r4 L2', inst: 'cello', oct: -1, vel: 0.45, shape: 0.3 }, arp: { p: 'up8', vel: 0.3, reg: [55, 81], skip: 0.3 }, bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.34 }, choir: { inst: 'ooh', n: 2, reg: [64, 79], vel: 0.3, soft: true }, timp: false, drums: false, rise: 2 },   // the quiet middle: the oboe, the cellos laying the head under it, the roll into the return
      { n: 'return', bars: 8, cres: [1.0, 1.12], prog: 'I I IV V | I vi IV V', cr: true, pad: { p: 'pulse', pat: 'x.x.x.x.x.x.x.x.', n: 4, reg: [55, 79], vel: 0.62 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [43, 62], vel: 0.55 }, bass: { pat: '1-5-', inst: { p: 'deep', sub: 0.7, att: 0.1, rel: 1.0 } },
        lead: { ph: 'PA PB', vel: 0.95, shape: 0.15 }, lead2: { ph: 'r2 PA PB', vel: 0.8, shape: 0.15 }, bell2: { ph: 'PA PB', oct: 1, vel: 0.45 }, arp: { p: 'up', vel: 0.35, reg: [55, 84] }, choir: { n: 3, reg: [57, 74], vel: 0.7 }, choir2: { n: 3, reg: [43, 60], vel: 0.6 }, timp: { p: 'beats', vel: 0.7 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......', vel: 0.5 }, fill: 'roll' },   // the return: the tune in the trumpets, the horns two bars behind in canon, the low brass, both choirs, the full battery
      { n: 'coda', bars: 8, cres: [1.08, 0.92], prog: 'IV I V I | IV I V I', pad: { p: 'pulse', pat: 'x.x.x.x.x.x.x.x.', n: 4, reg: [55, 79], vel: 0.6 }, pad2: { p: 'sus', inst: 'trombones', n: 3, reg: [43, 62], vel: 0.5 }, bass: { pat: '1-5-', inst: { p: 'deep', sub: 0.7, att: 0.1, rel: 1.0 } },
        lead: { ph: 'W4 W4', vel: 0.92, shape: 0.15 }, lead2: { ph: 'W4 W4', oct: -1, vel: 0.75, shape: 0.15 }, bell2: { ph: 'W4 W4', oct: 1, vel: 0.4 }, choir: { n: 3, reg: [57, 74], vel: 0.65 }, choir2: { n: 3, reg: [43, 60], vel: 0.55 }, timp: { p: 'beats', vel: 0.65, roll: 1 }, drums: { snare: 'x..x.xx.x..x.xx.', kick: 'x.......x.......', vel: 0.48 } },   // the cadence coda, twice, the roll into the last bar
    ],
  });

  Track('combat3', {
    desc: 'Battle — driving spiccato string ostinato, low-brass stabs, bass drum and snare, men’s choir, and the main theme hammered out by horns and full brass as the fight escalates',
    bpm: 118, trim: 1.49, tone: { hi: 1.0, lo: 1.0 }, mix: { drums: 1.2, choir: 1.15 }, root: 'D', mode: 'minor', loopFrom: 'A1', tens: false, gate: { drums: 0.2, choir: 0.3, lead: 0.42, bell: 0.6 },
    forms: [['A1', 'B1', 'A2', 'C', 'B2', 'A1', 'C', 'B1', 'A2', 'B2', 'C'], ['A1', 'C', 'B1', 'A2', 'B2', 'C', 'A1', 'B1', 'B2', 'A2', 'C']],
    inst: { pad: 'lowBrass', pad2: 'analog', bass: 'deep', lead: 'horn', lead2: 'brass', arp: 'strOst', bell: 'bell', choir: 'ooh' },
    ph: {
      B1: '5:1.5 8:.5 7:1 6:1 | 5:2 3:2 | 4:1.5 5:.5 6:1 4:1 | 5:4',
      B2: '5:1.5 8:.5 9:1! 10:1 | 8:2 7:1 6:1 | 5:1.5 6:.5 5:1 4:1 | 3:2 5:2',
      B3: '8:.5 8:.5 8:1 10:1 7:1 | 8:.5 8:.5 8:1 5:1 3:1 | 4:1 5:1 6:1! 8:1 | 7:2 5:2',
      B2b: '5:1.5 8:.5 9:1! 10:1 | 8:2 7:1 6:1 | 6:1.5 8:.5 6:1 4:1 | 3:2 5:2',       // the answer's second reading, its third bar over the flat sixth
      B4: '6:2 8:2 | 7:2 9:2 | 5:1.5 8:.5 6:1! 4:1 | 5:4', B5: '6:2 8:2 | 7:2 9:2 | 5:2 9:2 | 8:4',   // the strings' counter-line over bVI bVII i i / bVI bVII V i
      B6: '6:1.5 8:.5 7:1 6:1 | 7:2 5:2 | 4:1.5 5:.5 6:1! 4:1 | 5:4', B7: '6:1.5 8:.5 10:1 9:1 | 8:2 7:1 9:1 | 5:1.5 4:.5 5:1 9:1 | 8:4',   // the theme's readings over the crest's harmony
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.62, prog: 'i', hit: 'tam', pad2: { p: 'sus', inst: 'analog', n: 3, reg: [38, 57], vel: 0.9 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.6, reg: [50, 62], gate: 0.7 }, drums: { bd: 'x.......x.......' }, timp: 'hits' },
      { n: 'A1', bars: 16, lv: 0.8, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2b', vel: 0.85, shape: 0.35, swell: 0.35 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, fill: 'rollS' },
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 0.95, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.75 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.75, reg: [55, 79], gate: 0.9, jump: 0.05 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B3 B3', inst: 'brass', vel: 1.0, harm: -2, shape: 0.35, swell: 0.35 },
        lead2: { ph: 'B4 B5 B4 B5', inst: 'strings', oct: 1, vel: 0.55, shape: 0.35 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.0 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.75 }, fill: 'bigS' },
      { n: 'A2', bars: 16, lv: 0.88, prog: 'i i bVI bVII | i bII i V | i i bVI bVII | i bII bVI V', pad: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [38, 55], vel: 0.9, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.7 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.72, reg: [55, 79], gate: 0.9, jump: 0.06 }, drums: 'warS', timp: 'beats', lead: { ph: 'B1 B2 B1 B2b', vel: 0.88, harm: -2, shape: 0.35, swell: 0.35 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 0.75 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'rollS' },
      { n: 'C', bars: 8, lv: 0.45, prog: 'i:2 bVI:2 bVII:2 V:2', pad2: { p: 'sus', inst: 'strTrem', n: 4, reg: [55, 79], vel: 0.65 }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.0.0.0.0.0.0.0.', res: 4, vel: 0.5, reg: [50, 62], gate: 0.7 },
        drums: { bdSoft: 'x...............', t5: '........x.......' }, timp: { p: 'hits', roll: 2 }, choir: { inst: 'choirMen', n: 3, reg: [40, 57], vel: 0.6 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.15, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', hit: true, cr: true, pad: { p: 'stab', pat: 'x.......x.x.....', n: 2, reg: [38, 55], vel: 1.0, gate: 0.5 }, pad2: { p: 'sus', inst: 'strings', n: 4, reg: [55, 81], vel: 0.8 },
        bass: 'oct8', arp: { pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.78, reg: [55, 81], gate: 0.9, jump: 0.08 }, drums: 'marchS', timp: 'gallop', lead: { ph: 'B3 B3 B6 B7', inst: 'brass', vel: 1.0, harm: -2, shape: 0.35, swell: 0.35 },
        lead2: { ph: 'B4 B5 B4 B5', inst: 'strings', oct: 1, vel: 0.6, shape: 0.35 }, choir: { inst: 'choirMen', n: 3, reg: [38, 57], vel: 1.05 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.8 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, fill: 'bigS' },
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
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2 M3', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.92, prog: 'i:2 bVI:2 i:2 bVII:2 i:2 bVI:2 bII:2 bVII:2', pad: 'sus', bass: 'gallop', arp: { p: 'run', vel: 0.5, reg: [52, 79], gate: 0.6, jump: 0.06 }, drums: 'drive', timp: 'hits', lead: 'M1 M1-2 M1 M1-1 M1 M1-2 M1 M1-1', lead2: { ph: 'r8 M1 M1-2 M1 M1-1', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bVI:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: { pat: '0.2.', res: 4, vel: 0.3, reg: [52, 76], gate: 0.5 }, drums: { t5: 'X...............', t4: '........o.......', rim: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.2, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'i bVI bVII i | bVI bVII i V | i bVI bVII i | bVI bVII i V', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { p: 'run', vel: 0.52, reg: [52, 81], gate: 0.6, jump: 0.08 }, drums: 'drive', timp: 'beats', lead: { ph: 'M2 M3 M2+3 M3', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'M2 M3 M2 M3', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
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
      { n: 'B1', bars: 16, lv: 1.08, hit: 'tam', prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'two', lead: { ph: 'N3 N4 N3 N4', harm: -2, shape: 0.35, swell: 0.35 }, fill: 'snare' },
      { n: 'A2', bars: 16, lv: 0.94, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.46, reg: [49, 76], gate: 0.5, jump: 0.06 }, drums: 'heavy', timp: 'hits', lead: { ph: 'N1 N2 N1 N2', inst: 'horn', shape: 0.35, swell: 0.35 }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, drums: { t5: 'X...............', t4: '........o.......', metal2: '..o...o...o...o.' }, timp: { p: 'hits', roll: 2 }, bell: { dens: 0.22, res: 2, reg: [76, 93], vel: 0.5 }, rise: 2 },
      { n: 'B2', bars: 16, lv: 1.06, prog: 'bVI bVII i i | bVI bVII V i | bVI bVII i i | bVI bVII V i', pad: { p: 'sus', inst: 'strings' }, bass: 'oct8', arp: { pat: '0201 3231', res: 4, vel: 0.48, reg: [49, 78], gate: 0.5, jump: 0.08 }, drums: 'heavy', timp: 'beats', lead: { ph: 'N3 N4 N3 N4', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'N3 N4 N3 N4', inst: 'bell', oct: 1, vel: 0.4 }, fill: 'roll' },
      { n: 'A3', bars: 16, lv: 1.0, prog: 'i bII i bVII | i bII bVII i | i bII i bVII | i bII bVII i', pad: 'sus', bass: 'sync', arp: { pat: '0201 3231', res: 4, vel: 0.5, reg: [49, 78], gate: 0.5, jump: 0.1 }, drums: 'heavy', timp: 'gallop', lead: { ph: 'N1 N2 N1 N2', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'N1 N2 N1 N2', inst: 'brassStab', oct: -1, vel: 0.5 }, fill: 'tom' },
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
      { n: 'A1', bars: 8, lv: 0.7, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [48, 72], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, bell: { dens: 0.15, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'B1', bars: 8, lv: 0.82, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [48, 72], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', rim: '..o...o...o...o.', shk: 'o.o.o.o.o.o.o.o.', hat: 'o.o.o.o.o.o.o.o.' }, lead: 'G1 G2', timp: 'two', bell: { dens: 0.2, res: 1, reg: [64, 88], vel: 0.6 } },
      { n: 'A2', bars: 8, lv: 0.78, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.5, reg: [48, 72], gate: 0.6 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: '..o...o...o...o.', hat: 'o.o.o.o.o.o.o.o.' }, timp: 'beats' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bII:2 bVII:2 V:2', pad: { p: 'swell' }, bass: { pat: '1---', pedal: true }, arp: false, drums: { t5: 'X...............', metal2: '..........o.....' }, lead: false, bell: { dens: 0.2, res: 1, reg: [64, 86], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 0.95, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.52, reg: [48, 72], gate: 0.6, jump: 0.08 }, drums: 'ominous', lead: { ph: 'G1 G2', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, timp: 'beats', fill: 'tom' },
      { n: 'D', bars: 8, lv: 1.05, prog: 'i:2 bII:2 i:2 bVII:2', pad: { p: 'sus', inst: 'strings' }, bass: 'gallop', arp: { pat: '0.00.3.1', res: 2, vel: 0.55, reg: [48, 72], gate: 0.6, jump: 0.1 }, drums: { t5: 'X.....x...x.....', t4: '........x.....o.', t3: '..o.......o.....', rim: 'o.o.o.o.o.o.o.o.', hat: 'xoxoxoxoxoxoxoxo', snare: '........x.......' }, timp: 'gallop', lead: { ph: 'G2 G1', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, fill: 'roll' },
      { n: 'E', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bVII:2', pad: 'sus', bass: 'half', arp: { pat: '0.00.3.1', res: 2, vel: 0.45, reg: [48, 72], gate: 0.6 }, drums: 'ominous', lead: 'G1 G2' },
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
      { n: 'intro', bars: 4, lv: 0.7, prog: 'I:2 V:2', hit: true, pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'F1', inst: 'brass', shape: 0.35, swell: 0.35 }, timp: { p: 'beats', vel: 0.8 }, choir: { vel: 0.5 } },
      { n: 'A1', bars: 8, lv: 0.8, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: 'CA', timp: 'two', choir: { vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.9, prog: 'I V vi iii | IV V I I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CB', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, timp: 'beats', choir: { vel: 0.7 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B', bars: 8, lv: 0.72, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'organ' }, bass: 'half', lead: { ph: 'CC', inst: 'horn', shape: 0.35, swell: 0.35 }, choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.85 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.6 }, bell: { dens: 0.2, res: 1, reg: [72, 91], vel: 0.5 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { inst: 'choirMen', n: 3, reg: [43, 60], vel: 0.75 }, bell: { dens: 0.3, res: 1, reg: [72, 91], vel: 0.55 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'A3', bars: 8, lv: 0.98, prog: 'I V vi iii | IV I IV V', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'CA', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'CA', inst: 'brass', oct: -1, vel: 0.6, shape: 0.35, swell: 0.35 }, timp: 'beats', choir: { vel: 0.9 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......' }, fill: 'roll' },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'CC', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 }, timp: 'beats' },
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
      B1: '5:2 6:1 8:1 | 10:3 9:1 | 8:2 6:2 | 5:4', B2: '8:2 11:1 8:1 | 9:3 11:1 | 10:2 9:1 8:1 | 8:4',  // the big phrase: the first over IV V vi iii, the second over the flat-sixth lift
      B3: '8:3 11:1 | 12:2 9:2 | 10:3 8:1 | 10:4',                                                   // the return's reading of the lift
      CD: '@procession.CD',                                                     // the cadence
      T1: '3:3 4:1 | 5:2 8:2 | 7:3 6:1 | 5:4', T2: '6:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4',                  // the trio, lyrical
      CT: '1:2 3:2 | 4:2 5:2 | 6:2 4:2 | 5:4',                                                          // the low brass beneath
      HY: '@procession.HY', HY2: '@procession.HY2',                                // the hymn while the votes are cast
      CL: '@hymn.K',                                                            // the call (the game's leitmotif) that opens
    },
    sec: [
      // the approach grows out of the interlude: strings and the horn call alone, the harp, then ghosted snare strokes under the horn, the cadence only with the theme
      { n: 'intro', bars: 8, cres: [0.5, 0.78], prog: 'I:2 IV:2 | I:2 V:2', pad: { p: 'swell', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.5 }, bass: { pat: ['....', '....', '....', '....', '1---', '1---', '1---', '1---'], inst: { p: 'lowBrass', att: 0.14 }, vel: 0.75 },
        arp: { pat: '0...2...1...3...', res: 1, vel: 0.3, reg: [55, 81] }, lead: { ph: ['CL r2 CL', 'r2 CL r2'], oct: -1, vel: 0.72, shape: 0.35, swell: 0.35 },
        drums: { bd: ['................', '................', '................', '................', 'o...............', 'o...............', 'X.......o.......', 'X.......x.......'], sn: ['................', '................', '................', '................', 'o.......o.......', 'o...o...o...o...', 'o.o.o.o.o.o.o.o.', 'X.o.x.o.x.x.xxxx'] } },
      { n: 'A1', bars: 16, lv: 0.78, prog: 'I I IV V | I vi ii V | I IV I V | IVM7 IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [43, 58], vel: 0.65, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A1 A2 B1 CD'], oct: -1, vel: 0.85, shape: 0.35, swell: 0.35 }, drums: { p: 'field', vel: 0.85 }, bell: { dens: 0.06, res: 1, reg: [72, 96], vel: 0.38 }, fill: 'snS' },
      { n: 'A2', bars: 16, lv: 0.86, prog: 'I I IV V | I vi ii V | I IV I V | IVM7 IV V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.8 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 2, reg: [43, 58], vel: 0.75, gate: 0.7 }, bass: { p: 'walk', inst: { p: 'lowBrass', att: 0.06 }, vel: 1.0 },
        lead: { ph: ['A1 A2 A1 CD', 'A2 A1 A2 CD'], oct: -1, vel: 0.9, shape: 0.35, swell: 0.35 }, lead2: { ph: ['CT CT CT CT', 'r4 CT r4 CT'], inst: 'lowBrass', oct: -1, vel: 0.6, skip: 0.3, shape: 0.35, swell: 0.35 }, drums: { p: 'field', vel: 0.95 }, timp: 'two', choir: { n: 3, reg: [60, 76], vel: 0.6 }, choir2: { n: 3, reg: [43, 60], vel: 0.5 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.4 }, fill: 'bigS' },
      { n: 'B', bars: 16, cres: [0.9, 1.0], prog: 'IV V | vi iii | bVI bVII | I I | IV V | vi iii | bVI bVII | V I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [43, 60], vel: 0.85, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B1 B2 B1 CD', 'B1 B2 B2 CD'], oct: -1, vel: 0.95, shape: 0.35, swell: 0.35 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.5, shape: 0.35, swell: 0.35 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.8 }, choir2: { n: 3, reg: [43, 60], vel: 0.7 }, bell: { dens: 0.12, res: 1, reg: [72, 96], vel: 0.42 }, fill: 'bigS' },
      { n: 'T', bars: 16, lv: 0.6, prog: 'vi IV | I V | vi ii | V I | vi IV | I V | IVM7 V | I I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.65 }, pad2: { p: 'swell', inst: 'cellos', n: 2, reg: [43, 60], vel: 0.55 }, bass: { p: 'whole', inst: { p: 'lowBrass', att: 0.12 }, vel: 0.7 },
        lead: { ph: ['T1 T2 T1 T2', 'T1 T2 A1 CD', 'r4 T1 T2 CD'], oct: -1, vel: 0.75, shape: 0.35, swell: 0.35 }, arp: { p: 'up8', vel: 0.3, reg: [55, 81], skip: 0.3 }, drums: { bd: 'X...............', sn: ['x...............', 'o...o...........', 'x...............', 'o.o.o.o.o.o.xxxx'], vel: 0.6 }, bell: { dens: 0.1, res: 1, reg: [72, 96], vel: 0.4 } },
      { n: 'D', bars: 8, lv: 0.48, prog: 'ii:2 V:2 | iii:2 vi:2', pad: { p: 'swell', inst: 'organSoft', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, bass: { p: 'whole', inst: 'deep' },
        lead: { ph: ['HY HY2', 'r4 HY2', 'HY r4'], oct: -1, vel: 0.6, shape: 0.35, swell: 0.35 }, arp: { p: 'up8', vel: 0.28, reg: [57, 81], skip: 0.3 }, choir2: { n: 3, reg: [43, 58], vel: 0.5, soft: true }, bell: { dens: 0.14, res: 1, reg: [72, 96], vel: 0.44 }, rise: 2 },
      { n: 'R', bars: 8, lv: 1.04, hit: 'tam', cr: true, prog: 'bVI bVII | I I | IVM7 V | I I', pad: { p: 'sus', n: 4, reg: [50, 78], vel: 0.85 }, pad2: { p: 'stab', pat: 'x.......x...x...', n: 3, reg: [43, 60], vel: 0.95, gate: 0.65 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.05 }, vel: 1.0 },
        lead: { ph: ['B2 CD', 'B3 CD'], oct: -1, vel: 1.0, shape: 0.35, swell: 0.35 }, lead2: { ph: '@', inst: 'horn', oct: -1, vel: 0.55, shape: 0.35, swell: 0.35 }, drums: { p: 'field', vel: 1.0 }, timp: 'beats', choir: { v1: 'a', v2: 'a', n: 3, reg: [60, 78], vel: 0.9 }, choir2: { n: 3, reg: [43, 60], vel: 0.8 }, bell: { dens: 0.18, res: 2, reg: [72, 96], vel: 0.5 }, fill: 'bigS' },
      { n: 'E', bars: 8, lv: 0.68, prog: 'I IV I V | IVM7 IV V I', pad: { p: 'sus', n: 4, reg: [50, 76], vel: 0.7 }, pad2: { p: 'stab', pat: 'x.......x.......', n: 2, reg: [43, 58], vel: 0.55, gate: 0.7 }, bass: { p: 'half', inst: { p: 'lowBrass', att: 0.08 }, vel: 0.8 },
        lead: { ph: ['A1 CD', 'A2 CD'], oct: -1, vel: 0.75, shape: 0.35, swell: 0.35 }, drums: { p: 'field', vel: 0.7 }, choir: { n: 3, reg: [60, 76], vel: 0.45 }, bell: { dens: 0.08, res: 1, reg: [72, 96], vel: 0.38 } },
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
      if (s.n === 'R') { s.lead2 = { ph: '@', inst: 'brass', oct: -1, vel: 0.6 }; s.bell = { dens: 0.22, res: 2, reg: [72, 96], vel: 0.5 }; s.pad2 = { p: 'sus', inst: 'brass', n: 4, reg: [45, 69], vel: 0.65, width: 1.3 }; s.choir2 = { n: 3, reg: [43, 60], vel: 0.85 }; s.cr = true; }
      if (s.n === 'A2') { s.pad2 = { p: 'stab', inst: 'lowBrass', pat: 'x.......x...x...', n: 3, reg: [43, 60], vel: 0.8, gate: 0.7 }; s.choir2 = { n: 3, reg: [43, 60], vel: 0.6 }; }
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
      { n: 'intro', bars: 4, lv: 0.4, prog: 'I:4', hit: true, pad: { p: 'sus', n: 3, reg: [43, 62], vel: 0.9 }, bell: { dens: 0.3, res: 1, reg: [62, 86], vel: 0.55 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A1', bars: 8, lv: 0.6, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [43, 62] }, bass: 'whole', lead: 'O1 O2', bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.8 }, timp: { p: 'hits', vel: 0.45, dur: 3 } },
      { n: 'A2', bars: 8, lv: 0.72, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', n: 3, reg: [43, 62] }, bass: 'whole', lead: 'O1 O2', choir: { v1: 'o', v2: 'u', vel: 0.6 }, bell: { dens: 0.25, res: 1, reg: [62, 86], vel: 0.5 }, timp: { p: 'hits', vel: 0.5, dur: 3 } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bII:2 I:2 bII:1 I:1', pad: { p: 'sus', n: 3, reg: [43, 62] }, bass: 'whole', lead: { ph: 'O3 O4', inst: 'flute', vel: 0.8, shape: 0.35, swell: 0.2 }, lead2: { ph: 'O3 O4', inst: 'chime', oct: 0, vel: 0.35 }, choir: { v1: 'a', v2: 'o', vel: 0.75 }, timp: 'two', drums: { whisper: 'x...............' } },
      { n: 'C', bars: 8, lv: 0.45, prog: 'I:2 bII:2 I:2 iv:2', pad: { p: 'swell', n: 3, reg: [43, 62] }, bass: false, lead: false, bell: { dens: 0.35, res: 1, reg: [62, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, drums: { whisper: ['x...............', '................', 'x...............', '................'] }, timp: false, rise: 1 },
      { n: 'A3', bars: 8, lv: 0.95, prog: 'I:2 bII:2 iv:2 I:2', pad: { p: 'sus', inst: 'dark', n: 4, reg: [43, 64] }, bass: 'half', lead: { ph: 'O1 O2', inst: 'horn', vel: 0.8, harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'O1 O2', inst: 'chime', oct: 0, vel: 0.35 }, choir: { v1: 'a', v2: 'a', vel: 0.9 }, timp: 'beats', drums: { kick: 'x...............', metal2: '................' }, bell: { dens: 0.25, res: 1, reg: [62, 90], vel: 0.5 } },
    ],
  });

  Track('antarans', {
    desc: 'Menacing and dissonant: tritone brass, cluster chords, whispers and metal hits in an unsettled 5/4',
    bpm: 72, trim: 2.6, meter: 5, root: 'C#', mode: 'octaH', loopFrom: 'A1', lintMin: 0.7, tens: { x1: false },
    forms: [['A1', 'A2', 'B', 'C', 'A3', 'D', 'A1', 'B', 'C', 'A2', 'D', 'A3'], ['A1', 'B', 'A2', 'C', 'D', 'A3', 'A1', 'C', 'B', 'A2', 'A3', 'D']],
    inst: { pad: 'dark', bass: 'moog', lead: 'horn', lead2: 'brass', arp: 'seq', bell: 'chime', choir: 'uuh' },
    ph: {
      X1: '1:3 2:2! | 1:3 6:2 | 2:3 3:2 | 2:3 1:2!', X2: '6:3 5:2! | 6:3 1:2 | 5:3 8:2 | 5:5',          // over i i bII bII | i i bV bV
      X3: '1:3 5:2! | 2:3 6:2! | 5:3 1:2 | 5:3 2:2', X4: '1:3 2:2! | 2:3 5:2! | 1:3 2:2! | 6:5',         // over icl bII io bV | icl bII io V: the tritone leap, the grind
      X5: '6:3 5:2! | 6:3 1:2 | 2:3 3:2 | 2:3 1:2!', X6: '1:3 2:2! | 1:3 5:2! | 5:3 7:2 | 5:3 1:2',       // over i i bII bII | icl icl io io
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.4, prog: 'icl:2 i:2', hit: true, pad: { p: 'swell', n: 4, reg: [43, 64] }, drums: { whisper: ['x.........', '..........'], t5: 'X.........' } },
      { n: 'A1', bars: 8, lv: 0.62, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [43, 64] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..x.......', click3: 'o.o.o.o.o.', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', n: 4, reg: [43, 64] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', t4: '..o...o...', metal2: '..x...x...', click3: 'o.o.o.o.o.', hat: 'o.o.o.o.o.' }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X1 X2', choir: { v1: 'u', v2: 'o', vel: 0.5 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 } },
      { n: 'B', bars: 8, lv: 0.9, prog: 'icl:1 bII:1 io:1 bV:1 icl:1 bII:1 io:1 V:1', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', snare: '..........', metal2: 'x.x.x.x.x.', click3: 'o.o.o.o.o.', hat: 'x.x.x.x.x.' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X3 X4', inst: 'brass', harm: -3, shape: 0.35, swell: 0.35 }, bell: { dens: 0.3, res: 1, reg: [60, 88], vel: 0.7 }, fill: 'tom' },
      { n: 'C', bars: 8, lv: 0.5, prog: 'icl:2 bII:2 io:2 V:2', pad: { p: 'swell', n: 4, reg: [43, 64] }, bass: false, drums: { whisper: ['x.........', '..........', 'x.........', '..........'], whisper2: ['..........', '......x...', '..........', '......x...'] }, bell: { dens: 0.3, res: 1, reg: [60, 84], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.6 }, rise: 2 },
      { n: 'A3', bars: 8, lv: 1.0, prog: 'i:2 bII:2 i:2 bV:2', pad: { p: 'sus', inst: 'strings', n: 4, reg: [40, 64] }, bass: { pat: '1.1.1.1.1.' }, drums: { t5: 'X.....x...', t4: '..x...x...', metal2: 'o.o.o.o.o.', hat: 'x.x.x.x.x.', snare: '......x...' }, timp: { p: 'hits', kick: 'X..x..x...' }, lead: { ph: 'X1 X2', inst: 'brass', harm: -3, shape: 0.35, swell: 0.35 }, choir: { v1: 'a', v2: 'o', vel: 0.8 }, fill: 'tom' },
      { n: 'D', bars: 8, lv: 0.7, prog: 'i:2 bII:2 icl:2 io:2', pad: { p: 'sus', n: 4, reg: [43, 64] }, bass: { pat: '1-----1---' }, drums: { t5: 'X.....x...', metal2: '..o.......', whisper: ['x.........', '..........'] }, timp: { p: 'hits', kick: 'X.....x...' }, lead: 'X5 X6' },
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
      { n: 'intro', bars: 4, lv: 0.75, prog: 'I:2 V:2', hit: true, pad: 'sus', bass: 'whole', timp: { p: 'roll', roll: 1 }, lead: { ph: 'r1 V1', inst: 'brass', shape: 0.35, swell: 0.35 }, drums: false },
      { n: 'A1', bars: 8, lv: 0.85, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: 'V1 V2', timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] } },
      { n: 'B', bars: 8, lv: 0.78, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'horn', shape: 0.35, swell: 0.35 }, choir: { v1: 'o', v2: 'a', vel: 0.8 }, timp: 'two', bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A2', bars: 8, lv: 0.95, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V1 V3', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'V1 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.7 }, arp: { p: 'up', vel: 0.3, reg: [57, 83] }, fill: 'roll' },
      { n: 'C', bars: 8, lv: 0.55, prog: 'vi:2 IV:2 I:2 V:2', pad: { p: 'swell' }, bass: 'whole', lead: false, choir: { v1: 'a', v2: 'o', vel: 0.8 }, bell: { dens: 0.35, res: 2, reg: [72, 93], vel: 0.55 }, timp: { p: 'hits', roll: 1 }, rise: 1 },
      { n: 'B2', bars: 8, lv: 1.0, prog: 'vi IV I V | vi IV V I', pad: { p: 'sus', inst: 'strings' }, bass: 'walk', lead: { ph: 'VB VC', inst: 'brass', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'VB VC', inst: 'bell', oct: 1, vel: 0.4 }, choir: { v1: 'a', v2: 'a', vel: 1.0 }, timp: 'beats', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, fill: 'roll' },
      { n: 'D', bars: 8, lv: 0.9, prog: 'I V vi IV | I V IV V', pad: 'sus', bass: 'half', lead: { ph: 'V1 V2', inst: 'horn', shape: 0.35, swell: 0.35 }, timp: 'two', drums: { kick: 'x.......x.......', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'] }, choir: { vel: 0.5 }, arp: { p: 'up8', vel: 0.3, reg: [57, 81] }, bell: { dens: 0.25, res: 2, reg: [72, 91], vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 1.05, prog: 'I V vi IV | IV V I I', pad: 'sus', bass: 'half', lead: { ph: 'V2 V3', harm: -2, shape: 0.35, swell: 0.35 }, lead2: { ph: 'V2 V3', inst: 'bell', oct: 1, vel: 0.4 }, timp: 'beats', drums: { kick: 'x...x...x...x...', snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], hat: 'x.x.x.x.x.x.x.x.' }, choir: { vel: 0.9 }, arp: { p: 'up', vel: 0.3, reg: [57, 83], jump: 0.1 }, fill: 'roll' },
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
      { n: 'A2', bars: 8, lv: 0.68, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', vel: 0.75, shape: 0.35, swell: 0.2 }, choir: { vel: 0.55 }, timp: { p: 'hits', vel: 0.4, dur: 3 }, bell: { dens: 0.2, res: 1, reg: [72, 93], vel: 0.45 } },
      { n: 'B', bars: 8, lv: 0.8, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'half', lead: { ph: 'L3 L2', inst: 'horn', vel: 0.8, shape: 0.35, swell: 0.35 }, choir: { v1: 'o', v2: 'a', vel: 0.75 }, timp: 'two' },
      { n: 'C', bars: 8, lv: 0.42, prog: 'bVI:2 iv:2 i:2 V:2', pad: { p: 'swell' }, bass: false, lead: false, bell: { dens: 0.3, res: 1, reg: [64, 90], vel: 0.55 }, choir: { v1: 'u', v2: 'o', vel: 0.5 } },
      { n: 'A3', bars: 8, lv: 0.7, prog: 'i bVI bIII bVII | iv i V i', pad: { p: 'sus', inst: 'strings' }, bass: 'whole', lead: { ph: 'L1 L2', inst: 'flute', harm: -2, vel: 0.7, shape: 0.35, swell: 0.2 }, lead2: { ph: 'L1 L2', inst: 'bell', oct: 1, vel: 0.35 }, choir: { vel: 0.6 }, timp: { p: 'hits', vel: 0.4, dur: 3 } },
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
      Y5: '6:4 | 8:2 3:2 | 4:4 | 2:2 7:2',   // the hushed answer over iv bVI iiø V7
    },
    sec: [
      { n: 'intro', bars: 4, lv: 0.5, prog: 'i:2 iv:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'half', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
      { n: 'A1', bars: 8, lv: 0.68, prog: 'i iv V7 i | iv bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...' } },
      { n: 'A2', bars: 8, lv: 0.76, prog: 'i iv V7 i | iv bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'walk', lead: 'Y1 Y2', lead2: { ph: 'Y1 Y2', inst: 'vibes', oct: 1, vel: 0.35 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', shk: '..o...o...o...o.' } },
      { n: 'B', bars: 8, lv: 0.85, prog: 'iv:2 bVI:2 iiø:2 V7:2', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y3 Y4', inst: 'brass', vel: 0.75, shape: 0.35, swell: 0.35 }, choir: { v1: 'u', v2: 'o', vel: 0.45 }, bell: { dens: 0.2, res: 2, reg: [72, 91], vel: 0.45 }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......' } },
      { n: 'C', bars: 8, lv: 0.5, prog: 'i:2 bVI:2 iv:2 V7:2', pad: { p: 'swell', n: 3, reg: [48, 67] }, bass: 'whole', lead: false, bell: { dens: 0.25, res: 1, reg: [67, 88], vel: 0.5 }, choir: { v1: 'u', v2: 'o', vel: 0.5 }, drums: { click3: 'x...x...x...x...', whisper2: ['................', '........x.......'] } },
      { n: 'A3', bars: 8, lv: 0.82, prog: 'iv bVI iiø V7 | i iv V7 i', pad: { p: 'sus', inst: 'strings', n: 3, reg: [50, 69] }, bass: 'walk', lead: { ph: 'Y2 Y1', harm: -2, shape: 0.35, swell: 0.35 }, arp: { pat: '0.2.', res: 2, vel: 0.3, reg: [55, 76] }, drums: { click3: 'x...x...x...x...', hat: 'o.o.o.o.o.o.o.o.', rim: '....x.......x...', kick: 'x.......x.......', shk: '..o...o...o...o.' } },
      { n: 'E', bars: 8, lv: 0.6, prog: 'i iv V7 i | iv bVI iiø V7', pad: { p: 'sus', n: 3, reg: [48, 67] }, bass: 'half', lead: 'Y1 Y5', drums: { click3: 'x...x...x...x...', hat: 'o...o...o...o...' } },
    ],
  });

})(window.MOO);
