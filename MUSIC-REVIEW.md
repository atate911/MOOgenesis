# The score, reviewed

A review of every piece of music in Master of Orion: Reborn, written at the end of session 11 so the score could be judged whole
before it is called finished: the twenty-two map pieces, the seventeen cues, the ten race themes, the seven interludes and two bridges,
and the twelve derived readings (the rare pieces and the race themes at war). Each was read in its definition (js/audio/score) and
measured through the engine with `node tools/score-review.js`, which compiles every piece and reports its dynamic arc, harmonic
vocabulary and rhythm, how well the written melody sits on the chords (the share of lead notes the engine has to snap onto a chord
tone), notes written outside the real instrument's range, texture (polyphony and the low-interval limit), and the loop seam. The four
seam examples and the hour on the demo page were heard. Loudness was measured by the headless render (`tools/audio-report.js`).

## What was wrong, and is fixed

The engine now carries the sounding range of every recording (the horn to F5, the trumpets to D6, the tubular bells C4 to G5, the
glockenspiel from G5, the crotales from C6, the men's choir D2 to A4, the basses with the C extension). A pad, choir, arpeggio or
sparkle keeps its register inside it; a written line folds a stray note by an octave, as a player would. Before that guard, these
passages were written out of reach and the sampler simply pitch-shifted the recording, which is what a listener hears as a thin or
false instrument:

- **Council fanfare**: the whole horn line an octave above the instrument (B♭5 to B♭6) because the piece carried an octave shift. The
  shift is removed; the horn now sits B♭3 to B♭4.
- **First Light**: the trumpets doubling the hymn at the sunrise an octave too high (to F6). Now in unison with the horns.
- **Tubular bells** written an octave above their range in The Vigil, The Watch, The Long Night, The Frontier and Orion (the
  bell lines carried an octave shift and an octave echo on top). The shift is gone; the strokes now ring C4 to F5.
- **Glockenspiel** lines an octave below the instrument in The Lantern, The Survey, the Meklar theme and the Defeat cue. Raised;
  the defeat cue's lone bell is now the celeste, which is softer and in range at the written pitch.
- **Crotales** used as a melody and arpeggio two octaves below their range for the whole of the Psilon theme and the Research cue
  (the "crystal" preset is the crotales recording). Both now use the celeste for the lines and keep the crotales for the sparkle, which
  the guard holds above C6.
- **Alkari** wind chimes (tubular bells written to D8) and the **Silicoid** chimes (an octave above the bells) rewritten in range;
  the Silicoid's upper line is now the celeste.
- **Determination**: the horn's second strain reached E6; it now plays an octave down, in the horn's middle register.
- **The war readings** carried a bell line's octave into the brass stabs (the Psilon reading had brass written to G7) and sang the
  men's choir on the mixed choir's register (the Darlok reading had the men on B♭4 for most of the piece). Both corrected in the
  reading itself.

Fifty-one pieces compile to slightly different notes after the guard: in every case a note or a register that no player could give.
The eighteen others are untouched. All 840 seam pairings compile, the QA passes, and the lint reports no problems.

## What remains (judgment, not errors)

- **Low thirds.** Four pieces spend most of their length with a third (or a second) sounding below C3: The Chorale (the organ, the
  analogue bed and the men all in the octave below middle C), The Frontier (cellos, men and tuba), The Abyss (men and bass) and The
  Tide; The Vigil, The Lanes and the Antarans about half. Where it is voices it is the sound of a bass section and acceptable; where it
  is the analogue pad or the organ under the choir it is mud. A one-line rule in the chord voicer (cost a third below C3, prefer the
  open fifth) would clear it across the score; it changes the voicing of twenty pieces, so it is left for a listening pass.
- **The snap.** The engine moves a written note onto the chord when it clashes by a semitone on a strong beat or for two beats. In
  The Abyss that is 45% of the lead's notes: the phrygian sigh (C over E minor, E over F major) is exactly what gets removed, so the
  tune heard is plainer than the one written. The Tide (22%), the Chorale (19%), Espionage, the Darlok theme and the main battle cue
  (13 to 17%) are the others. Either the phrases are rewritten against their chords or the modal notes are marked to keep ('!');
  the second is a two-minute change per piece and is recommended for The Abyss.
- **Two council cues.** The chamber plays either the older fanfare or the procession in state. The procession is the better piece in
  every respect; the fanfare could leave the mood list.
- **Two orphan cues.** Ship design and Research are played by no screen. They are clean and could go, or be given a screen.
- **The Lantern** is six minutes in the early rotation, twice the length of its neighbours; a form without the second trio would
  bring it to four.
- **The Beacon**'s lines sit on their chords less than any other map piece (54% of strong beats on a chord tone): its hymn head is
  written over I and ♭VII in mixolydian and lands on fourths. It is atmospheric and it is the weakest of the eight planetarium
  pieces.
- **The machine races.** Klackon and Meklar are electronic by design (sequencer, saw arpeggios, clicks); they are the right sound for
  those races and the least like the rest of the score.

## The ranking

Two marks out of ten: musical quality (melody, harmony, orchestration, form, variation) and how well the piece does its job in the
game (its role, its place in the era, its level, how it seams). The total is the sum. Readings (a piece transformed by the engine)
are marked a little under their original.

| # | Piece | Kind | Music | Game | Total | Length | Note |
|---|---|---|---|---|---|---|---|
| 1 | First Light (early) | map | 9 | 9 | **18** | 213 s | One long sunrise with the clearest arc in the score: violas alone, a dawn theme that climbs the chord, the hymn blazing with both choirs, then dusk. The trumpets' octave corrected. |
| 2 | The Long Night (passacaglia) | map | 9 | 9 | **18** | 274 s | A real form: a ground that never stops and seven variations, each a texture of its own. Grave, patient, no melodic snaps at all; the strongest late-game piece. |
| 3 | Main theme: the hymn | cue | 8.5 | 9.5 | **18** | 329 s | The leitmotif itself: organ, the men low beneath it, the analogue sky, the deep pedal; a true climax and a quiet close. Everything else quotes it. |
| 4 | The Procession | cue | 8.5 | 9 | **17.5** | 251 s | A nobilmente march with a trio and a hymn for the vote; the solo horn's long-breathed theme over low brass on the step. The best-built cue; rare on the map, regular at war. |
| 5 | The Vigil (sung chorale) | map | 8.5 | 9 | **17.5** | 222 s | Men alone, then the women in octaves, an organ verse, a descant, brass only at the crest. The chorale theme shared with the rare tenth piece. Its tubular bells were an octave high; corrected. |
| 6 | The Embers (sarabande) | map | 8.5 | 8.5 | **17** | 163 s | A sarabande's stressed second beat in the low strings, a cor anglais tune, the leitmotif turned upside down over the lament bass. Distinct, grief-coloured, in three. |
| 7 | Council in state | cue | 8 | 9 | **17** | 123 s | The procession abbreviated for the chamber: tam-tam, timpani roll, brass fanfare on the call, the organ, the big phrase within a quarter minute. Does its job exactly. |
| 8 | Noon (brass chorale) | map | 8.5 | 8 | **16.5** | 192 s | Horns in four parts, the trumpets' own strain, trombones beneath, the strings answering with the hymn, a plagal amen. The densest texture in the score (21 voices at the full); grand for the middle years. |
| 9 | The Watch (nocturne) | map | 8.5 | 8 | **16.5** | 214 s | Walking pizzicato bass, harp chords off the beat, a very soft solo trumpet, the richest harmony on the map (add9, sus4); every strong beat a chord tone. The chimes' octave corrected. |
| 10 | The Survey (minimalist pulse) | map | 8 | 8.5 | **16.5** | 152 s | Violas in soft eighths with a marimba, flute cells of the leitmotif that grow by a note each time, the women's long line at the full. Process writing; the glockenspiel line's octave corrected. |
| 11 | The Nebula (Serrie drift) | map | 7.5 | 9 | **16.5** | 274 s | The analogue and air pads on chords that change every four bars, bells answered by the long delay, a few long flute notes. The Serrie flavour asked for; seams into anything. |
| 12 | Battle (the main cue) | cue | 7.5 | 9 | **16.5** | 309 s | Spiccato string ostinato, low-brass stabs, the men's choir, the main theme hammered out by horns and full brass. The right battle music; a few lead notes snapped onto the chords. |
| 13 | Drift, the violas | interlude | 7.5 | 9 | **16.5** | 49 s | Violas and cellos breathing together under a trumpet far away, the harp. The interlude the seams choose most for the strings pieces, and the one that sounds most like the orchestra pausing. |
| 14 | Drift, the choir | interlude | 7.5 | 9 | **16.5** | 55 s | The men hold one low phrase and the women hum above; nothing else but the hall and a chime. The breath before a very different piece. |
| 15 | The Commonwealth (woodwind canon) | map | 8 | 8 | **16** | 175 s | An oboe states the procession's theme over a walking bassoon, a clarinet and a flute follow it in canon; no strings but the bassoon. The talk between peoples, and it sounds like it. |
| 16 | The Lanes (Serrie sequence) | map | 7.5 | 8.5 | **16** | 178 s | A celeste in sixteenths, the analogue pad beneath, an oboe tune, the hymn at the crest. Works beautifully in rotation; the analogue pad sits low enough to muddy the bass at times. |
| 17 | The Frontier (slow march) | map | 7.5 | 8.5 | **16** | 240 s | Field drums at a whisper, the tuba on the step, trombones' dotted theme, the men chanting, the hymn at half speed at the crest. Strong at war; the low texture (cellos, men, tuba) is thick. |
| 18 | Human theme | race | 7.5 | 8.5 | **16** | 311 s | A noble march with snare, strings and brass; every strong beat a chord tone. The most orchestral of the race themes. |
| 19 | The Tide (rare) | map | 7.5 | 8 | **15.5** | 224 s | Deep bass swells, the analogue sky and cellos, low brass and the men, the hymn in the horns at the crest. Felt when it comes; a fifth of its lead notes are snapped onto the chords. |
| 20 | Wonder (calm exploration) | map | 7 | 8.5 | **15.5** | 219 s | The first piece: airy flute, glassy bells, a floating lydian pad, the wonder tune every later piece glances back at. Light, pleasant, exactly right for the first turns. |
| 21 | Victory | cue | 7 | 8.5 | **15.5** | 307 s | Brass fanfares, rolling timpani, a soaring major theme. Generic in the best sense: it does what a victory cue must. |
| 22 | Defeat | cue | 7 | 8.5 | **15.5** | 309 s | Slow falling lines in F minor, mourning strings, a lone bell. The bell line was written below the glockenspiel; it is now the celeste, in range and softer. |
| 23 | Bulrathi theme | race | 7 | 8.5 | **15.5** | 316 s | Deep stomping drums and low heavy brass in D minor. Unmistakable for the race. |
| 24 | Darlok theme | race | 7 | 8.5 | **15.5** | 349 s | Eerie harmonic-minor pads, whispering noise swells, plucked shadows. The war reading's choir sang above a men's range; corrected. |
| 25 | Mrrshan theme | race | 7 | 8.5 | **15.5** | 300 s | Tribal polyrhythm under a snaking phrygian-dominant reed line. Vivid and quick to place. |
| 26 | Drift, harp | interlude | 7 | 8.5 | **15.5** | 53 s | A slow harp figure under one long cello line, strings far back. |
| 27 | Drift, horizon | interlude | 7 | 8.5 | **15.5** | 51 s | Strings and the analogue sky swelling together, a horn calling the hymn from far away, crotales. |
| 28 | Bridge, tense | bridge | 6.5 | 9 | **15.5** | 5 s | Two bars: the strings tremble and swell with a timpani roll into a cue that cannot wait. |
| 29 | Bridge, calm | bridge | 6.5 | 9 | **15.5** | 8 s | Two bars: one swell of the strings and the soft organ with a chime, back onto the map or into the chamber. |
| 30 | The Lantern (chorale prelude in six) | map | 8 | 7 | **15** | 360 s | The cradle tune at half speed as a cantus firmus under a clarinet that never stops; a flute trio; Bach's manner for a sleeping ship. Finely made, but at six minutes it is the longest piece in the early rotation. |
| 31 | The Chorale (rare) | map | 7.5 | 7.5 | **15** | 240 s | The men's choir carries a hymn sung low over the organ and the analogue bed, the women at the crest. Grand; the organ, the analogue pad and the men all crowd the octave below middle C. |
| 32 | Determination | map | 7 | 8 | **15** | 163 s | A steady pulse, strings and a resolute horn theme in A minor; the calm piece that carries the war programme. The horn's second strain now sits in its middle register. |
| 33 | Orion | cue | 7 | 8 | **15** | 320 s | Deep drones, metallic chimes and a double-harmonic melody: ancient, awed. The chime line's octave corrected. |
| 34 | Espionage | cue | 7 | 8 | **15** | 306 s | Noir intrigue in harmonic minor: walking sub-bass, clock ticks and rim clicks, muted horn phrases. Borrowed by the spy panels and sits well there. |
| 35 | Alkari theme | race | 7 | 8 | **15** | 327 s | Airy flute over harp-like plucks, soaring pentatonic. Its wind chimes were written two octaves above the tubular bells; they are now the celeste. |
| 36 | The Tide, at war | reading | 7 | 8 | **15** | 224 s | The same piece with the synthetic drum hits in its big sections. |
| 37 | Human theme, hostile | reading | 7 | 8 | **15** | 278 s | The march in minor with snare and brass; the most convincing of the hostile readings. |
| 38 | Silicoid theme | race | 6.5 | 8.5 | **15** | 346 s | Vast resonant drones with slow chimes and geologic pulses. Unmistakable; the chimes were an octave above their range and the drones sit in close thirds very low, which here is the point. |
| 39 | Drift | interlude | 6.5 | 8.5 | **15** | 55 s | One high pad, a pedal, a few points of light and perhaps the first notes of the hymn. |
| 40 | Drift, voices | interlude | 6.5 | 8.5 | **15** | 55 s | The women humming over the men, an air pad, one flute note. |
| 41 | The Veil (waltz) | map | 7 | 7.5 | **14.5** | 167 s | A slow waltz of the spheres: harp arpeggios, an oboe tune, the women far back, celeste points. The only waltz on the map, and welcome for it. |
| 42 | The Cradle (lullaby in six) | map | 7 | 7.5 | **14.5** | 187 s | A rocking harp, a clarinet humming the tune, the women humming. Its sixth degree over the IV chord is snapped a dozen times a pass; the lullaby still reads. |
| 43 | Patience (dorian) | map | 7 | 7.5 | **14.5** | 168 s | A marimba ostinato, a plucked reed melody, a warm dorian pad. Good middle energy for the map; the least distinctive of the calm set. |
| 44 | The Chorale, at war | reading | 7 | 7.5 | **14.5** | 240 s | The same piece with the drum hits in its big sections. |
| 45 | Ground assault | cue | 6.5 | 8 | **14.5** | 307 s | Low toms, a menacing plucked ostinato, brass swells in phrygian. Tense and functional; closer to its electronic origins than the rest. |
| 46 | Deep Field (planetarium) | map | 6.5 | 8 | **14.5** | 245 s | Slow analogue pads, distant women, points of light, a lone flute; the stillest piece on the map (three and a half chords a minute, no climax). Right for solitude, by design static. |
| 47 | Sakkra theme | race | 6.5 | 8 | **14.5** | 346 s | Hissing percussion and dry skins under a dorian-pentatonic kora line. |
| 48 | Psilon theme | race | 6.5 | 8 | **14.5** | 320 s | A cool lydian shimmer. Its crystal bells were the crotales played two octaves below their range for the whole theme; the lead and arpeggio are now the celeste. |
| 49 | The Antarans | cue | 6.5 | 8 | **14.5** | 400 s | Tritone brass, cluster chords, whispers and metal in an unsettled 5/4. Menacing as it should be; the clusters sit low on purpose. |
| 50 | Bulrathi theme, hostile | reading | 6.5 | 8 | **14.5** | 286 s | Pounding, lower still. |
| 51 | Darlok theme, hostile | reading | 6.5 | 8 | **14.5** | 325 s | A heartbeat pulse under the horn; the choir now in the men's register. |
| 52 | Mrrshan theme, hostile | reading | 6.5 | 8 | **14.5** | 260 s | Growling low brass, five semitones down. |
| 53 | Council fanfare (the older cue) | cue | 7 | 7 | **14** | 347 s | Ceremonial brass, a hymn-like choir, timpani. Its horn was written an octave above the instrument for the whole piece; corrected. Now largely superseded by the procession in state, which the chamber also plays. |
| 54 | The Beacon | map | 6.5 | 7.5 | **14** | 268 s | A glass synth and strings on a sunken pedal, a horn calling the leitmotif from far away, crotales and tubular bells with the delay. Atmospheric; its lines sit on the chords less often than any other map piece. |
| 55 | Battle, driving | cue | 6.5 | 7.5 | **14** | 297 s | Galloping bass, fast saw arpeggios, timpani and a brass riff. Effective, but the synth lead and saw arpeggios are the least orchestral of the three battle cues. |
| 56 | Battle, heavy | cue | 6.5 | 7.5 | **14** | 303 s | Half-time assault, syncopated stabs, chromatic phrygian bass, metal hits, a rapid pulse arpeggio. Heavy and effective; the same reservation as the driving cue. |
| 57 | The Abyss (phrygian) | map | 6 | 8 | **14** | 266 s | Cellos on a sunken pedal, a bassoon below, an alto flute above, the men chanting the phrygian step. The score's darkest colour and needed; but nearly half its written lead notes are snapped onto the chords, so the heard tune is plainer than the written one, and the low texture is thick. |
| 58 | Silicoid theme, hostile | reading | 6 | 8 | **14** | 303 s | Grinding pulses, the horn in place of the chimes; its lead no longer carries the chimes' octave. |
| 59 | GNN news bed | cue | 6 | 7.5 | **13.5** | 320 s | A confident broadcast bed with brass stabs and a bright ident. Fit for purpose and deliberately un-symphonic. |
| 60 | Drift, pulse | interlude | 6 | 7.5 | **13.5** | 46 s | A soft marimba figure keeps time under a warm pad, a celeste phrase above. The least like a breath; the seams rarely choose it after a choir or brass piece now. |
| 61 | Alkari theme, hostile | reading | 6 | 7.5 | **13.5** | 272 s | Screeching and rapid; the synth lead in place of the flute. |
| 62 | Sakkra theme, hostile | reading | 6 | 7.5 | **13.5** | 293 s | Fast tribal toms. |
| 63 | Klackon theme | race | 5.5 | 7.5 | **13** | 349 s | Chittering clicks in whole-tone ostinati and a sequencer; electronic by design for the hive, and it reads as such. |
| 64 | Meklar theme | race | 5.5 | 7.5 | **13** | 300 s | Cold industrial sequencer, a machine pulse, metal strikes; electronic by design for the machines. The bell line was an octave below the glockenspiel; corrected. |
| 65 | Psilon theme, hostile | reading | 5.5 | 7.5 | **13** | 285 s | Cold clusters; the brass stabs no longer carry the harp's octave. |
| 66 | Klackon theme, hostile | reading | 5 | 7 | **12** | 318 s | Buzzing saw swarms. |
| 67 | Meklar theme, hostile | reading | 5 | 7 | **12** | 269 s | A harsh clock. |
| 68 | Ship design (no screen plays it) | cue | 6 | 5 | **11** | 309 s | Bubbling marimba and sequenced plucks over a springy bass. Clean and light, but nothing in the game asks for it any more. |
| 69 | Research (no screen plays it) | cue | 6 | 5 | **11** | 320 s | Crystal bells and rising sequences in a lydian wash. Its lead and arpeggio were the crotales two octaves low (now the celeste); unused by any screen. |

## By group

**Map.** The three strongest map pieces are the three with real forms: the sunrise, the passacaglia and the sung chorale. The nocturne,
the sarabande, the brass chorale, the canon and the survey are each a different kind of music and sit together because they share the
themes; that is the score's great strength. The planetarium pieces (the first eight) are the thinnest as music, which is also their job:
Deep Field barely moves and is right for a player alone among the stars. The Abyss is the weakest written piece and still needed, being
the only truly dark colour in the calm set.

**Cues.** The title hymn and the procession lead; the procession in state is the chamber's best cue. The main battle cue is the right
battle music; the two older battle cues are effective but closer to their electronic origins. The news bed is deliberately un-symphonic.
Victory and Defeat are plain and do their work.

**Races.** The Human march is the most orchestral; Bulrathi, Darlok and Mrrshan are the most vivid; the two machine races are
electronic by design.

**Interludes and bridges.** The violas and the choir are the two interludes that most sound like the orchestra pausing, and the seams
now favour them for strings and choir pieces; the marimba pulse is the least like a breath and is rarely chosen after a choir or brass
piece. The two bridges do what they must in five seconds.
