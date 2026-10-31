// Master of Orion — Reborn · the score · screens, events and the title
// The title hymn, the battle and ground cues, the council and the procession, the news, Orion and the Antarans, the endings, espionage, two cues no screen plays any more (design, research).
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  Track('title', {
    desc: 'Main theme — the undercurrent: a deep bed first (deep open chords in the low strings, the double bass on a slow line with its sub nearly sub-bass, the planetarium’s analogue glow, one chime), the men entering humming low; the solo horn’s first part the commonwealth’s tune itself, as the Commonwealth plays it, in the major, whole and slow over them, twice; then its variations with the men echoing its head between them, the bassoon low and the horn in variation, a soft trumpet high above once; the oboe’s lyrical variation in the breath over the cellos laying the head; the tune back whole for the crescendo in two steps, a high horn and a low brass voice in canon, then the full brass on the motif strongly with the snare, the timpani, the strings and the mallets and the chamber open on ah; the wind-down over the strings with the men’s last echo; the fade on variations, the solo horn alone, down into the drone',
    quotes: ['procession'],
    bpm: 58, root: 'D', mode: 'major', loopFrom: 'A1', trim: 2.5, orch: true, tens: false, rubato: 0.025, tone: { lo: 1.4, hi: 0.6 }, fx: { verb: 1.0, stage: 0.8, dly: 1.6 }, mix: { choir: 1.45, pad: 0.95, lead: 2.2, bass: 0.96 }, duck: 0.7,
    sends: { lead: { verb: 0.08, stage: 0.36, dly: 0.06 }, choir: { verb: 0.32, stage: 0.12 }, bell: { verb: 0.5, stage: 0.2 } },   // the solo at the front of the stage and dry, the bed behind it in the hall; the high trumpet and the points far back
    forms: [['A1', 'B', 'C', 'A2', 'A3', 'D', 'E'], ['A1', 'C', 'B', 'A2', 'A3', 'D', 'E']],
    alts: [{}, { choir2: 'choirWomen' }],
    inst: { pad: 'cellos', pad2: 'strings', bass: 'deep', lead: 'hornSolo', lead2: 'cello', bell: 'crystal', bell2: 'tpts', choir: 'choirHum', choir2: 'choirOoh', arp: 'glass' },
    ph: {
      PA: '@procession.A1', PB: '@procession.A2',      // the commonwealth's tune, the game's theme, as the Commonwealth plays it: the strain (1 2 3 5 | 6 5 3 2) and its answer to the octave
      PAh: '1:3 2:1 | 3:2 5:2 | r:8',                   // its head alone, the men's echo of the theme between the variations
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
    // at a time, and the tune itself only where it counts: the solo horn's first part states it whole (D3-D4) twice, the second time
    // fuller; after it everything is variation drawn from it by the classical means, the men echoing its head between the variations (V1-V5: the strain as a real sequence a step up,
    // the fall as a chain of descending thirds, the head answered in the relative minor in augmentation through a major seventh, the
    // answer's octave hanging on the dominant, the oboe's lyrical one from the third); the tune returns whole for the crescendo, and the
    // fade is variation again; the bass echoes the head (root, second, third, fifth on each chord) under the variations and the cellos lay
    // it in whole notes under the breath, so the whole piece leans toward the hook's return. The section brass at the crest holds one
    // recorded dynamic layer per line (shape light, no swell): a hand-over mid-note sounded like a different horn. Then the crest in two steps: a high horn and a low brass voice in a two-bar canon on the tune (the duet), then the full brass on the
    // answer and the fall with the timpani on the beat, the strings and the mallets' sparkle (the build), and the quiet section after it. The
    // The choir is a real one: St. Helen's Cantores humming (above the horn's octave here, D4 to B4, a halo over the solo with the low strings and the bass under it;
    // the reed and cello readings, whose soloist sings an octave higher, have the hum below it, E3 to D4) and the women's ooh above; the men's echoes
    // of the theme's head are one cantor (Micah), a sung line rather than a section; the crest keeps the Sonatina chorus's open ah.
    // An orchestra and a choir, nothing synthesized: the glow is soft high strings, the bass the section alone (no sine), no chorus effect;
    // the low end mono below 250 Hz (lowMono); the women's ooh above the men from the first bar.
    // The low instruments sit under the men, never through them: the bass a deep octave down (D1, its fundamental below the hum's band),
    // the bass low-passed at 85 Hz (65 where the roots move through G1 to B1, whose second harmonics fall in the hum's band; every
    // note's fundamental kept) and its sine sub eased (its fundamental and its depth, not the growl that reached into the voices), the low strings' open
    // chords C2 to B2 and 6 dB back (their tones and first overtones are the hum's own band), the hum A2 to G3 above them (with the bass at D2 and the strings to E3, the hum's own band
    // was 5 to 6 dB louder in the bass and the strings than in the voices: the chorus sounded covered, not carried).
    // solo has a window: nothing else in its octave (the low strings below it, the glow and the violas above A4), the hum spread to the
    // sides (width 0.85), the beds ducking 4.4 dB under every solo note (duck), its sends dry, its fader high (mix.lead). Accents are few:
    // one soft trumpet high above, the timpani only at the crest. 'title:reed' (below) is the same piece with the cor anglais as the first
    // soloist an octave above the horn, its window moved up with it.
    sec: [
      { n: 'drone', bars: 4, cres: [0.3, 0.62], prog: 'I:4', pad: { p: 'swell', n: 2, reg: [36, 47], vel: 0.25, open: true }, pad2: { p: 'swell', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 6, rel: 2.8 } }, bell2: { ph: 'r2 ST2', inst: 'chime', vel: 0.36 }, choir: { n: 2, reg: [62, 71], vel: 0.56, soft: true, width: 0.85, att: 6 }, choir2: { n: 2, reg: [64, 76], vel: 0.2, soft: true, width: 0.7, att: 8 }, timp: false, drums: false },   // the bed alone: deep open chords, the pedal, the glow, one chime
      { n: 'men', bars: 8, cres: [0.62, 0.7], prog: 'I I IV I | I vi IV I', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.22, open: true }, pad2: { p: 'swell', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 1.0, rel: 2.4 } },
        choir: { n: 2, reg: [62, 71], vel: 0.62, soft: true, width: 0.85 }, choir2: { n: 2, reg: [64, 76], vel: 0.22, soft: true, width: 0.7 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, timp: false, drums: false },   // the men enter humming low, one chord to a bar
      { n: 'horn', bars: 16, cres: [0.68, 0.78], prog: 'I I IV I | I I IV V | I I IV I | I I IV V', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.26, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.3 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 0.6, rel: 2.0 } },
        lead: { ph: 'PA*0.88 PB*0.94 PA*1 PB*1', oct: -1, vel: 0.95, shape: 0.45, swell: 0.4, pan: -0.05 }, choir: { n: 2, reg: [62, 71], vel: 0.55, soft: true, width: 0.85 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 },
        drums: false, timp: false },   // the horn's first part: the tune whole, slow and low over the men, twice, the second time fuller; the undercurrent begins under it
      { n: 'A1', bars: 16, cres: [0.7, 0.8], prog: 'ii IV V V | I I IV I | IV I V I | I I vi V', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.27, open: true }, pad2: { p: 'sus', inst: 'violas', n: 2, reg: [74, 86], vel: 0.34 }, bass: { pat: 'c---', vel: 0.8, inst: { p: 'deep', sub: 0, cut: 65, att: 0.6, rel: 2.0 } },
        lead: { ph: 'V1 r4 V2 r4', oct: -1, vel: 0.94, shape: 0.45, swell: 0.4, pan: -0.05 }, lead2: { ph: 'r4 PAh r4 PAh', inst: 'cantor', oct: -1, vel: 0.74, shape: 0.4 },
        choir: { n: 2, reg: [62, 71], vel: 0.55, soft: true, width: 0.85 }, bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 }, drums: false, timp: false },   // the first variations (the sequence a step up, the fall in thirds), the men echoing the theme's head after each; the violas' pedal far above
      { n: 'B', bars: 8, cres: [0.68, 0.78], prog: 'IV I V I | ii IV V V', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.23, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.3 }, bass: { pat: 'c-------', vel: 0.8, inst: { p: 'deep', sub: 0, cut: 65, att: 0.6, rel: 2.0 } },
        lead2: { ph: 'V2 r4', inst: 'bassoonIowa', oct: -2, vel: 0.78, shape: 0.35, swell: 0.2 }, lead: { ph: 'r4 V1', oct: -1, vel: 0.92, shape: 0.45, swell: 0.4, pan: -0.05 }, bell2: { ph: 'r4 TH', inst: 'tptSolo', oct: 1, vel: 0.26, shape: 0.4, swell: 0.35 }, choir: { n: 2, reg: [62, 71], vel: 0.45, soft: true, width: 0.85 },
        bell: { dens: 0.05, res: 1, reg: [76, 100], vel: 0.3 }, drums: false, timp: false },   // the bassoon low with the fall in thirds, the horn answering with the sequence; the soft trumpet high above once
      { n: 'C', bars: 8, lv: 0.44, prog: 'I I vi V | I I vi V', pad: { p: 'swell', inst: 'organSoft', n: 3, reg: [50, 72], vel: 0.48 }, pad2: { p: 'sus', n: 2, reg: [60, 76], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 1.4, rel: 2.6 } },
        lead: { ph: 'L2 L2', inst: 'cello', oct: -1, vel: 0.5, shape: 0.3 }, lead2: { ph: ['r4 V5', 'V5 r4'], inst: 'oboe', vel: 0.6, shape: 0.35, swell: 0.2 }, arp: { inst: 'harp', pat: '0...2...1...3...', res: 1, vel: 0.34, reg: [55, 81], skip: 0.3 }, choir: { n: 2, reg: [62, 71], vel: 0.45, soft: true, width: 0.85 }, choir2: { n: 2, reg: [66, 78], vel: 0.24, soft: true }, bell: { dens: 0.08, res: 1, reg: [76, 100], vel: 0.32 }, drums: false, timp: false, rise: 2 },   // the breath: the oboe's own lyrical variation over the harp, the hum, the women; under it the cellos lay the head in whole notes, the foundation for the return
      { n: 'A2', bars: 8, cres: [0.78, 0.9], prog: 'I I IV I | I I IV V', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.27, open: true }, pad2: { p: 'sus', inst: 'violas', n: 2, reg: [62, 74], vel: 0.36 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 0.6, rel: 1.8 } },
        lead: { ph: 'PA PB', inst: 'hornSolo', oct: 0, vel: 0.9, shape: 0.4, swell: 0.3, pan: -0.08 }, lead2: { ph: 'r2 PA PB', inst: 'tbnSolo', oct: -1, vel: 0.78, shape: 0.3, swell: 0.2, pan: 0.12 },
        choir: { n: 2, reg: [62, 71], vel: 0.55, soft: true, width: 0.85 }, timp: { kick: ['X...............', '................', '................', '................', 'X...............', '................', '................', '................'], vel: 0.5 }, bell: false, drums: false },   // the duet: a high horn on the tune, a solo trombone two bars behind it in canon; the violas arrive
      { n: 'A3', bars: 8, cres: [0.92, 1.1], prog: 'I I IV V | I vi IV V', cr: true, pad: { p: 'sus', inst: 'strings', n: 4, reg: [55, 79], vel: 0.6 }, pad2: { p: 'sus', n: 3, reg: [36, 57], vel: 0.62, open: true }, bass: { pat: 'c---', inst: { p: 'deep', sub: 0, cut: 85, att: 0.4, rel: 1.6 } },
        lead: { ph: 'PA PB', inst: 'horn', vel: 0.9, shape: 0.15, swell: 0 }, lead2: { ph: 'PA PB', inst: 'trombones', oct: -1, vel: 0.78, shape: 0.15, swell: 0 }, bell2: { ph: 'PA PB', inst: 'tpts', vel: 0.66, shape: 0.15, swell: 0 },
        arp: { inst: 'marimba', pat: '0.2.1.3.0.2.3.1.', res: 4, vel: 0.46, reg: [72, 96] }, choir: { inst: 'choirMenAh', n: 3, reg: [43, 60], vel: 0.85 }, choir2: { inst: 'aah', n: 3, reg: [57, 74], vel: 0.66 }, timp: { p: 'beats', vel: 0.65 },
        bell: { dens: 0.1, res: 1, reg: [76, 100], vel: 0.36 }, drums: { snare: ['x..x.xx.x..x.xx.', 'x..x.xx.x..xxxxx'], kick: 'x.......x.......', vel: 0.5 } },   // the full brass on the motif, strongly: horns, trombones and trumpets in octaves, the snare and the bass drum, the timpani on the beat, the strings, the mallets' sparkle, the chamber open on ah
      { n: 'D', bars: 8, cres: [0.9, 0.58], prog: 'IV I I I | IV vi I I', pad: { p: 'sus', inst: 'strings', n: 3, reg: [55, 76], vel: 0.5 }, pad2: { p: 'sus', n: 2, reg: [36, 47], vel: 0.26, open: true }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 1.0, rel: 2.4 } },
        lead: { ph: 'L3 r4', oct: -1, vel: 0.9, shape: 0.45, swell: 0.3, pan: -0.05 }, lead2: { ph: 'r4 PAh', inst: 'cantor', oct: -1, vel: 0.66, shape: 0.4 }, choir: { n: 2, reg: [62, 71], vel: 0.55, soft: true, width: 0.85 }, choir2: { n: 2, reg: [66, 78], vel: 0.26, soft: true },
        timp: { kick: ['X...............', '................', '................', '................', '................', '................', '................', '................'], vel: 0.5 }, bell: { dens: 0.06, res: 1, reg: [76, 100], vel: 0.3 }, drums: false },   // the wind-down: the brass gone, the solo's fall over the strings, the men's last echo of the head, one timpani stroke
      { n: 'E', bars: 8, cres: [0.58, 0.36], prog: 'vi IM7 iii V | IV I V I', pad: { p: 'sus', n: 2, reg: [36, 47], vel: 0.26, open: true }, pad2: { p: 'swell', n: 2, reg: [72, 88], vel: 0.28 }, bass: { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0, cut: 85, att: 1.2, rel: 2.6 } },
        lead: { ph: 'V3 V2', oct: -1, vel: 0.84, shape: 0.45, swell: 0.3, pan: -0.05 }, choir: { n: 2, reg: [62, 71], vel: 0.5, soft: true, width: 0.85 }, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, drums: false, timp: false },   // the fade: the solo horn alone, the head in the relative minor and the fall in thirds, down into the drone
    ],
  });

  // The same piece with a double reed as the first soloist: the cor anglais an octave above the horn's register (D4 to D5, its plaintive
  // middle), the window in the bed moved up with it (the cellos under it, the glow, the violas and the women higher still). The crest keeps
  // the horn section; the breath keeps the oboe. Hidden: the menu plays the title; this reading is for the player page and for later.
  (function () {
    const d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the reed reading — the same undercurrent with the cor anglais as the first soloist, an octave above the horn: the commonwealth’s tune whole and slow over the humming men, as the Commonwealth plays it, twice; then its variations with the men echoing its head, the bassoon and the horn in variation; the tune back whole for the crescendo, the horns in canon, then the full brass on the motif; the wind-down and the fade on variations';
    d.hidden = true; d.variantOf = 'title';
    for (const s of d.sec) {
      if (s.lead && typeof s.lead === 'object' && !s.lead.inst) {        // the solo sections (horn, A1, B, E): the track's hornSolo
        s.lead.inst = 'reed'; s.lead.oct = 0; s.lead.vel = Math.min(1, (s.lead.vel || 0.9) * 0.96);
        s.lead.ph = [].concat(s.lead.ph).map(p => p.replace(/L2\^/g, 'L2').replace(/L3\^/g, 'L3')); if (s.lead.ph.length === 1) s.lead.ph = s.lead.ph[0];
        if (s.pad2 && s.pad2.reg && s.pad2.reg[0] === 72) s.pad2.reg = [76, 91];               // the glow higher still
        if (s.pad2 && s.pad2.inst === 'violas') s.pad2.reg = [77, 89];
        if (s.pad && s.pad.inst === 'organSoft') s.pad.reg = [74, 86];
        if (s.choir2 && s.choir2.reg) s.choir2.reg = [70, 78];
      }
    }
    for (const s of d.sec) if (s.choir && s.choir.reg && s.choir.reg[0] === 62) s.choir.reg = [52, 62];   // the hum below this reading's soloist
    Track('title:reed', d);
  })();

  // The cello reading: one cello (the Iowa recordings) as the first soloist, an octave above the horn's place, in the cello's singing tenor:
  // in the horn's own register it sat in unison with the cello section's chords and the men's hum (D3 over D3) and the low strings, the
  // bass and the soloist ran together into one low cluster. So it takes the reed reading's window (the glow, the violas and the women
  // moved higher still), the beds and the bass below it untouched. The crest keeps the horns; the cello returns for the wind-down and fade.
  (function () {
    const d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the cello reading — the same undercurrent with one cello as the first soloist, high in its singing register above the low strings and the humming men, the commonwealth’s tune whole and slow, twice; then its variations with the men echoing its head, the bassoon low, the oboe in the breath; the horns in canon and the full brass on the motif for the crescendo; the cello back for the wind-down and the fade';
    d.hidden = true; d.variantOf = 'title';
    d.mix = Object.assign({}, d.mix, { lead: 2.4 });
    for (const s of d.sec) {
      if (s.lead && typeof s.lead === 'object' && !s.lead.inst) {
        s.lead.inst = 'vcSolo'; s.lead.width = 0.6; s.lead.oct = 0; s.lead.echo = 0;
        s.lead.ph = [].concat(s.lead.ph).map(p => p.replace(/L2\^/g, 'L2').replace(/L3\^/g, 'L3')); if (s.lead.ph.length === 1) s.lead.ph = s.lead.ph[0];
        if (s.pad2 && s.pad2.reg && s.pad2.reg[0] === 72) s.pad2.reg = [76, 91];
        if (s.pad2 && s.pad2.inst === 'violas') s.pad2.reg = [77, 89];
        if (s.pad && s.pad.inst === 'organSoft') s.pad.reg = [74, 86];
        if (s.choir2 && s.choir2.reg) s.choir2.reg = [70, 78];
      }
    }
    for (const s of d.sec) if (s.choir && s.choir.reg && s.choir.reg[0] === 62) s.choir.reg = [52, 62];   // the hum below this reading's soloist
    Track('title:cello', d);
  })();

  // Two more readings on the settled shape. The symphony: the full orchestra and no choir; the violins state the tune twice with the cellos
  // an octave below, the winds carry the variations (the flute and the oboe, the clarinet echoing the head), the horns in canon, the full
  // brass on the motif with the snare and the timpani over pulsing strings and woodwind runs, the violins' fall and the flute's fade. The
  // chamber: strings alone, nothing struck or blown; the violins state the tune over the violas and the open low strings with the basses
  // pizzicato, the cellos echo the head and take the fall, the violas sing the breath, the full strings on the motif in three octaves over
  // the spiccato ostinato and the tremolo, the cello's wind-down, the violins' fade high.
  (function () {
    const ECHO = '1---2---3---5---';
    const LOWS = (vel, p, n) => ({ p: p || 'sus', inst: 'cellos', n: n || 2, reg: n === 3 ? [36, 57] : [36, 52], vel, open: true });
    const VLA = (vel, p) => ({ p: p || 'sus', inst: 'violas', n: 2, reg: [55, 69], vel });
    const STR = (vel, p, n, reg) => ({ p: p || 'sus', inst: 'strings', n: n || 3, reg: reg || [55, 76], vel });
    const BASS = (pat, sub, pedal) => ({ pat, pedal: !!pedal, inst: { p: 'deep', sub: sub || 0.8, att: 0.6, rel: 2.0 } });   // held (the title's bassTie): a pedal or the chords' roots, never struck again each bar
    const PED = { pat: 'c---', pedal: true, inst: { p: 'deep', sub: 0.8, att: 6, rel: 2.6 } };   // the opening's pedal fades in with the bed
    const VLN = (ph, vel, oct) => ({ ph, inst: 'strings', oct: oct || 0, vel, shape: 0.4, swell: 0.3, width: 0.6 });
    const VC = (ph, vel) => ({ ph, inst: 'cello', oct: -1, vel, shape: 0.35, swell: 0.2 });
    const SVC = (ph, vel) => ({ ph, inst: 'vcSolo', oct: -1, vel, shape: 0.35, swell: 0.2, width: 0.6 });   // one cello (the Iowa recordings) where a line is one voice's
    const SVLA = (ph, vel) => ({ ph, inst: 'violas', oct: 0, vel, shape: 0.4, swell: 0.2, width: 0.6 });   // the viola section: the Iowa viola is out of tune by a third of a semitone and more
    const ONE = { kick: ['X...............', '................', '................', '................', '................', '................', '................', '................'], vel: 0.5 };
    const apply = (d, S, all) => { for (const sec of d.sec) { for (const k in all) sec[k] = all[k]; const o = S[sec.n]; if (o) for (const k in o) sec[k] = o[k]; } };
    // the symphony
    let d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the symphony reading — the full orchestra, no choir: the low strings and the basses first, the violins stating the commonwealth’s tune twice with the cellos an octave below, the winds carrying the variations with the bass clarinet echoing the head low, the bassoon low and the oboe answering, the oboe’s breath over the cellos, the horns in canon, the full brass on the motif with the snare and the timpani over pulsing strings and woodwind runs, the violins’ fall for the wind-down, the flute’s fade';
    d.hidden = true; d.variantOf = 'title';
    d.inst = Object.assign({}, d.inst, { pad: 'strings', pad2: 'cellos', lead: 'strings', choir: 'choirMen' });
    d.mix = Object.assign({}, d.mix, { lead: 2.0, pad: 1.0, bass: 1.15, choir: 1.0 }); d.fx = { verb: 1.1, stage: 0.9, dly: 0.8 }; d.tone = { lo: 1.2, hi: 1.0 }; d.duck = 0.66;
    apply(d, {
      drone: { pad: STR(0.5, 'swell'), pad2: LOWS(0.55, 'swell'), bass: PED, cres: [0.3, 0.62] },
      men: { pad: STR(0.5, 'sus', 4, [50, 72]), pad2: LOWS(0.55), bass: BASS('1---', 0.8, true), lead2: { ph: 'r4 L2', inst: 'clarinet', oct: 0, vel: 0.5, shape: 0.3 }, arp: false, bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, cres: [0.62, 0.7] },
      horn: { pad: VLA(0.4), pad2: LOWS(0.55), bass: BASS('1---', 0.8, true), lead: VLN('PA*0.88 PB*0.94 PA*1 PB*1', 0.92), lead2: VC('PA*0.88 PB*0.94 PA*1 PB*1', 0.55), bell: { dens: 0.04, res: 1, reg: [76, 100], vel: 0.28 }, drums: false, cres: [0.68, 0.78] },
      A1: { pad: VLA(0.42), pad2: LOWS(0.56), bass: BASS('1---'), lead: { ph: 'V1 r4 V2 r4', inst: 'flute', oct: 0, vel: 0.82, shape: 0.4, swell: 0.2 }, lead2: { ph: 'r4 PAh r4 PAh', inst: 'bassClar', oct: -1, vel: 0.7, shape: 0.4 }, drums: false, cres: [0.7, 0.8] },
      B: { pad: STR(0.5), pad2: LOWS(0.52), lead: { ph: 'r4 V1', inst: 'oboe', oct: 0, vel: 0.8, shape: 0.4, swell: 0.2 } },
      C: { pad: STR(0.45, 'swell'), pad2: VLA(0.3, 'swell') },
      A3: { pad: { p: 'pulse', inst: 'strings', pat: 'x.x.x.x.x.x.x.x.', n: 4, reg: [55, 79], vel: 0.6 }, pad2: LOWS(0.62, 'sus', 3), arp: { inst: 'flutes', p: 'up', res: 2, vel: 0.4, reg: [72, 96] } },
      D: { pad: VLA(0.5), pad2: LOWS(0.5), lead: VLN('L3 r4', 0.82), lead2: { ph: 'r4 PAh', inst: 'clarinet', oct: 0, vel: 0.6, shape: 0.4 }, timp: ONE },
      E: { pad: STR(0.42), pad2: LOWS(0.46), lead: { ph: 'V3 V2', inst: 'flute', oct: 0, vel: 0.72, shape: 0.45, swell: 0.2 } },
    }, { choir: false, choir2: false });
    Track('title:symphony', d);
    // the chamber
    d = JSON.parse(JSON.stringify(Music._tracks.title)); delete d._p; delete d.id;
    d.desc = 'Main theme, the chamber reading — strings alone, nothing struck or blown: the low strings and the basses first, the violas entering, the violins stating the commonwealth’s tune twice with the cellos an octave below and the basses plucked under them, one cello echoing the head between the variations and taking the fall low, the violas singing the breath, the violins and the cellos in canon, the full strings on the motif in three octaves over the spiccato ostinato and the tremolo, the cello’s wind-down, the violins’ fade high';
    d.hidden = true; d.variantOf = 'title';
    d.inst = Object.assign({}, d.inst, { pad: 'violas', pad2: 'cellos', lead: 'strings', arp: 'pizz' });
    d.mix = Object.assign({}, d.mix, { lead: 2.0, pad: 1.0, bass: 1.1 }); d.fx = { verb: 1.15, stage: 0.8, dly: 0.6 }; d.tone = { lo: 1.1, hi: 1.0 }; d.duck = 0.7;
    const PZ = { inst: 'pizz', pat: '0.......2.......', res: 2, vel: 0.32, reg: [43, 67] };
    apply(d, {
      drone: { pad: VLA(0.4, 'swell'), pad2: LOWS(0.55, 'swell'), bass: PED, bell2: false, cres: [0.3, 0.62] },
      men: { pad: VLA(0.45), pad2: LOWS(0.55), bass: BASS('1---', 0.7, true), lead2: SVC('r4 L2', 0.6), cres: [0.62, 0.7] },
      horn: { pad: VLA(0.42), pad2: LOWS(0.55), bass: BASS('1---', 0.7, true), lead: VLN('PA*0.88 PB*0.94 PA*1 PB*1', 0.92), lead2: VC('PA*0.88 PB*0.94 PA*1 PB*1', 0.52), arp: false, cres: [0.68, 0.78] },
      A1: { pad: VLA(0.42), pad2: LOWS(0.56), bass: BASS('1---', 0.7), lead: VLN('V1 r4 V2 r4', 0.9), lead2: SVC('r4 PAh r4 PAh', 0.7), arp: false, cres: [0.7, 0.8] },
      B: { pad: VLA(0.38), pad2: LOWS(0.44), bass: BASS('1-------', 0.7), lead2: SVC('V2 r4', 0.9), lead: VLN('r4 V1', 1), bell2: false, arp: false },
      C: { pad: STR(0.4, 'swell'), pad2: LOWS(0.4, 'swell'), lead2: SVLA(['r4 V5', 'V5 r4'], 0.7), arp: { inst: 'pizz', p: 'up8', vel: 0.22, reg: [43, 67], skip: 0.4 } },
      A2: { pad: VLA(0.45), pad2: LOWS(0.56), lead: VLN('PA PB', 0.9), lead2: VC('r2 PA PB', 0.72), arp: false, timp: false },
      A3: { pad: { p: 'sus', inst: 'strTrem', n: 3, reg: [55, 76], vel: 0.55 }, pad2: LOWS(0.62, 'sus', 3), bass: BASS('1---', 0.75), lead: VLN('PA PB', 0.92, 1), lead2: VC('PA PB', 0.8), bell2: { ph: 'PA PB', inst: 'violas', oct: 0, vel: 0.6, shape: 0.2 }, arp: { inst: 'strOst', pat: '0.1.0.2.0.1.0.3.', res: 4, vel: 0.6, reg: [50, 69], gate: 0.9 }, timp: false, cr: false },
      D: { pad: STR(0.45), pad2: LOWS(0.5), lead: SVC('L3 r4', 0.86), lead2: SVLA('r4 PAh', 0.6), timp: false, arp: false },
      E: { pad: VLA(0.34), pad2: LOWS(0.4), lead: VLN('V3 V2', 0.92, 1), arp: false },
    }, { choir: false, choir2: false, drums: false, bell: false });
    Track('title:chamber', d);
  })();


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
