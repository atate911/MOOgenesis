# The score, reviewed

A review of every piece of music in Master of Orion: Reborn, written at the end of session 11 so the score could be judged whole
before it is called finished: the twenty-two map pieces, the sixteen cues, the ten race themes, the seven interludes and two bridges,
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

- **The main theme** changed chord every two beats through its A sections under the organ, and the hymn in the horn sat on a reduced
  lead bus under the choir, blurred by a parallel third at the climax. It is re-harmonised one chord to a bar, each chord chosen for the
  tune's own notes (so no note of the leitmotif is snapped onto a chord, where twelve percent were), the organ changes are regular and
  hymn-like, and the leitmotif is in front: the horn alone, then the men over the cellos' counter-line, then the full chamber with the
  trumpets doubling at the crest.

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

Six marks out of ten, weighted, then two measured adjustments:

- **Craft** (weight 2): the writing and the orchestration — melody on its chords, voice leading, arc, texture, every part in its instrument's reach.
- **Creativity** (1.5): the idea — a form, a device, a treatment that is the piece's own.
- **Uniqueness** (1.5): how distinct the piece is within the score, as music.
- **Pleasure** (1.5): how good it is to listen to — warmth, consonance, clarity, no mud, no harshness beyond what the drama asks.
- **Fit** (2): how well it does its job in the game — its role, its era, its level, its length, how it seams.
- **Identity** (1.5): how much it feels like this game — the space-symphony idiom of strings, choir, brass and the analogue sky, the leitmotif family, the Serrie drift.
- **Alike** (0 to −3): a weak penalty for sounding like other pieces, measured, not judged: each piece's three nearest neighbours by
  palette, tempo, mode and meter; no penalty under a likeness of 0.80, the full three points at 0.99 (the two older battle cues and the
  machine races' war readings are nearly the same sound).
- **Theme** (0 to +2.5): a weak bonus for carrying the score's shared themes, one point per theme quoted, capped; it fades when the
  theme is more than sixty percent of the piece's own melodic material and is nothing when the piece is all theme, so a piece that only
  repeats the hymn earns nothing for it.

The total is out of a hundred. Readings (a piece transformed by the engine) are judged as what they are.

| # | Piece | Kind | Craft | Creat. | Unique | Pleas. | Fit | Ident. | Alike | Theme | Total | Why |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Light (early) | map | 9 | 8.5 | 8 | 9 | 9 | 9.5 | -0.8 | +2.0 | **89.7** | The clearest arc on the map (0.3 to 1.05 and back to 0.4), a dawn theme that grows by climbing the chord, the hymn at the sunrise with both choirs; every strong beat sits on the chord. it reads as the first years, and it seams well. Not a 10 only because its harmony is simple (four chords). Sounds most like Wonder (calm exploration) and Deep Field (planetarium). |
| 2 | The Long Night (passacaglia) | map | 9 | 9.5 | 9 | 8.5 | 9 | 8.5 | -1.8 | +2.0 | **89.5** | A real form (a ground and seven variations, each a texture of its own), no melodic snaps at all, grave and patient. the strongest late-game and war piece. Held back only by the thick low register in its full variations. Sounds most like Defeat and Orion. |
| 3 | Main theme: the hymn | cue | 9 | 8 | 8 | 9 | 9.5 | 10 | -1.5 | +0.2 | **88.2** | Rebuilt after the review around the solo horn over the humming chorus, the horn section at the build and the full horns with the trumpets at the crest, with a real dynamic range and every line phrased; the best tune in the score, and the title screen's job exactly. (Ranked at the review's date; the total revised here.) |
| 4 | The Vigil (sung chorale) | map | 8.5 | 8 | 8 | 9 | 9 | 9 | -0.9 | +2.3 | **87.4** | A sung chorale with a real plan (men alone, SATB, an organ verse, a descant, brass only at the crest) on a theme shared with the rare tenth piece, now over the cellos with a clear low register. the late empire's night watch, graver and slower than before, and the choir interlude leads into it naturally. Sounds most like The Tide (rare) and The Tide, at war. |
| 5 | The Watch (nocturne) | map | 8.5 | 8.5 | 9 | 8.5 | 8 | 7.5 | 0 | +2.5 | **85.8** | The richest harmony on the map (ten chord types, add9 and sus4), a walking pizzicato bass, a soft solo trumpet whose line is its own; every strong beat on a chord tone. a nocturne for the quiet turns; its tubular bells were an octave high; corrected. |
| 6 | The Procession | cue | 8.5 | 8 | 8 | 8.5 | 9 | 9 | -2.1 | +2.0 | **85.2** | The best-built cue (theme, big phrase over the flat-sixth lift, trio, hymn, return), a long-breathed horn line over low brass on the step. it carries the council and the war programme and is rare on the map, so it stays an occasion. A few of its lead notes (13%) are snapped onto the chords. Sounds most like Council in state and Council fanfare (the older cue). |
| 7 | The Embers (sarabande) | map | 8.5 | 9 | 9 | 8 | 8.5 | 8 | -0.9 | +1.0 | **85.1** | The sarabande's stressed second beat, a cor anglais tune, the leitmotif turned upside down over the lament bass; genuinely a different kind of music. grief for the late years, in three, which keeps it apart from everything else in the late rotation. Sounds most like Orion and The Long Night (passacaglia). |
| 8 | The Nebula (Serrie drift) | map | 7.5 | 7 | 7.5 | 9 | 9 | 9.5 | -0.1 | +2.0 | **84.4** | As music it is a drift (four chords a minute, a few long flute notes); its craft is in the sound, not the writing. it is the Serrie flavour the score was asked for, it fits solitude, and it seams into anything. Sounds most like Deep Field (planetarium) and The Lanes (Serrie sequence). |
| 9 | The Survey (minimalist pulse) | map | 8 | 9 | 9 | 8 | 8.5 | 8 | -0.9 | +1.0 | **84.1** | Process writing, the cells of the leitmotif growing by a note each time over the violas' pulse; the one minimalist piece. early energy without weight. Its lines sit on the chords less often (66% of strong beats), which is the price of the cells; the glockenspiel line's octave corrected. Sounds most like Alkari theme and The Lanes (Serrie sequence). |
| 10 | The Commonwealth (woodwind canon) | map | 8 | 9 | 9.5 | 7.5 | 8 | 7 | 0 | +1.0 | **82.5** | A canon on the procession's theme over a walking bassoon, the one piece with no strings but the bassoon; a question-and-answer episode between the canons. contact music that sounds like the talk between peoples; a little dry for a long stretch of play. |
| 11 | Noon (brass chorale) | map | 8.5 | 8 | 8.5 | 8 | 8 | 8.5 | -2.1 | +2.0 | **82.4** | Four-part horn writing, the trumpets' own strain, the strings answering with the hymn, a plagal amen; the hymn's answer sits well in brass. grand for the middle years, but the densest texture in the score (21 voices at the full) makes it the heaviest piece in the calm rotation. Sounds most like Council fanfare (the older cue) and Council in state. |
| 12 | The Lanes (Serrie sequence) | map | 7.5 | 7.5 | 7.5 | 9 | 8.5 | 9 | -0.6 | +1.0 | **81.9** | A celeste sequence in the Serrie manner with an oboe tune of its own and the hymn at the crest; the analogue pad now sits above the bass, so the sequence is clear. the middle years' trade lanes, and it seams well. Sounds most like The Survey (minimalist pulse) and Wonder (calm exploration). |
| 13 | The Frontier (slow march) | map | 7.5 | 8 | 8 | 8 | 8.5 | 8.5 | -1.0 | +2.0 | **81.8** | Field drums at a whisper, the tuba on the step, trombones' dotted theme, the men chanting, the hymn at half speed at the crest; slower now, and the low register cleared. the border held, strong at war. Sounds most like The Long Night (passacaglia) and Orion. |
| 14 | The Lantern (chorale prelude in six) | map | 8.5 | 9 | 9 | 8 | 6.5 | 7 | 0 | +1.0 | **80.5** | A chorale prelude in Bach's manner, the cradle tune at half speed as a cantus firmus under a clarinet that never stops, a flute trio. at six minutes it is twice the length of its neighbours in the early rotation, and it asks for attention the early years rarely have. |
| 15 | Drift, the choir | interlude | 7 | 6.5 | 7.5 | 8.5 | 9 | 9 | 0 | 0 | **79.3** | The men's phrase under the women, nothing else but the hall and a chime. the breath before a very different piece, and the seam's choice after a choir piece. |
| 16 | The Abyss (phrygian) | map | 7.5 | 7 | 8.5 | 7 | 8 | 8 | -0.2 | +2.5 | **79.1** | The score's darkest colour, now on the ship's soft organ and the analogue drone instead of the cellos the passacaglia already has; its tune is harmonised to its own notes, the phrygian rubs kept on purpose where they are the point, and nothing is snapped onto a chord any more (nearly half its lead notes were); the low register is clear. the only truly dark piece in the calm set, and needed. Sounds most like The Long Night (passacaglia) and The Frontier (slow march). |
| 17 | Wonder (calm exploration) | map | 7.5 | 6 | 7 | 8.5 | 8.5 | 9 | -0.9 | +2.0 | **78.9** | The first piece, light and pleasant, the wonder tune every later piece glances back at, now harmonised to its lydian notes with the harp running and no choir until its still, which is the cello alone. the first turns, alone among the stars, and it fits them exactly. Sounds most like Deep Field (planetarium) and First Light (early). |
| 18 | The Tide (rare) | map | 8 | 7 | 7.5 | 7.5 | 8 | 9 | -1.3 | +1.0 | **78.3** | Deep swells rising to the hymn in full brass; the rise and the hymn are now each harmonised over their own bars, so the tune comes through whole (a fifth of its notes used to be bent), and the low register is clear. rare by design, so its weight is an event rather than a burden. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 19 | Council in state | cue | 8 | 6.5 | 6 | 8 | 9 | 9 | -2.3 | +2.0 | **77.9** | The procession abbreviated with pomp (tam-tam, timpani roll, brass fanfare on the call). the chamber is rarely open a minute, and this reaches the big phrase within a quarter minute. It ranks under the procession because it is the procession, cut. Sounds most like The Procession and Council fanfare (the older cue). |
| 20 | The Cradle (lullaby in six) | map | 7.5 | 7.5 | 8 | 8 | 7.5 | 7.5 | 0 | +1.0 | **77.5** | A lullaby in six with a clarinet tune and a rocking harp, its chords now chosen from the lullaby's own notes so the tune reads whole; its still is the glockenspiel and the harp with the women humming. the ship asleep, and its quick six makes a fine seam into slower pieces. |
| 21 | The Beacon | map | 7 | 7 | 8 | 7.5 | 7.5 | 8.5 | 0 | +1.0 | **76.5** | Soft horn chords and the low brass swaying between two chords on a sunken pedal, the horn's call from far away; its calls now land each where its notes are. a signal from the edge, and no longer the Nebula's twin. |
| 22 | Battle (the main cue) | cue | 7.5 | 7 | 7 | 7 | 9 | 9 | -2.0 | 0 | **76.0** | A real battle texture (spiccato ostinato, low-brass stabs, the men, the hymn in full brass) with a climax at 1.15. the main battle cue and the right one. Thirteen percent of its lead notes are snapped onto the chords, which is the cost of fast lines over fast changes. Sounds most like Sakkra theme, hostile and Human theme, hostile. |
| 23 | Deep Field (planetarium) | map | 6.5 | 6.5 | 6.5 | 8.5 | 8 | 9 | -0.8 | +2.0 | **76.0** | The stillest piece on the map (three and a half chords a minute, no climax at all); its craft is restraint. right for a player alone among the stars, and the planetarium drift is a colour the score needs. Sounds most like Wonder (calm exploration) and First Light (early). |
| 24 | Mrrshan theme | race | 7 | 7 | 8.5 | 7 | 8.5 | 7 | 0 | 0 | **75.3** | A snaking phrygian-dominant reed line over tribal toms; every strong beat on the chord. vivid, quick to place. |
| 25 | The Veil (waltz) | map | 7 | 7 | 8 | 8.5 | 7.5 | 7.5 | -0.5 | 0 | **75.0** | A waltz tune for oboe over harp arpeggios, the women far back; graceful, slight. the only waltz on the map, welcome for the change of step, not a piece a player will remember. Sounds most like Wonder (calm exploration) and The Embers (sarabande). |
| 26 | Darlok theme | race | 7 | 7 | 8 | 7 | 8.5 | 7.5 | -0.5 | 0 | **74.8** | Eerie harmonic-minor pads, whispers, plucked shadows; the lead is snapped onto the chords 17% of the time. it says the race in two bars. The hostile reading's choir now sings in the men's register. Sounds most like Orion and Determination. |
| 27 | Drift, the violas | interlude | 7 | 6 | 6.5 | 8.5 | 9 | 8.5 | -2.4 | +0.8 | **74.7** | Violas and cellos breathing under a trumpet far away. the interlude the seams choose most for the strings pieces, and the one that most sounds like the orchestra pausing. Sounds most like Drift, harp and Drift, horizon. |
| 28 | Silicoid theme | race | 6.5 | 7 | 9 | 6.5 | 8.5 | 7 | -0.2 | 0 | **74.0** | Drones, slow chimes and geologic pulses; the writing is minimal and the close low thirds are the sound rather than a fault. no other theme could be mistaken for it. The chimes were an octave above their range; corrected. Sounds most like Defeat and The Long Night (passacaglia). |
| 29 | Human theme | race | 7.5 | 6 | 6.5 | 8 | 8.5 | 8 | -1.5 | 0 | **73.3** | A noble march with snare, strings and brass; every strong beat on a chord tone; the most orchestral race theme. it places the race at once. Sounds most like GNN news bed and Victory. |
| 30 | Orion | cue | 7 | 7.5 | 8.5 | 7 | 8 | 7 | -1.8 | 0 | **73.2** | Drones, chimes and a double-harmonic melody; ancient and awed, and distinct from everything else. the Orion screen asks for exactly this. The chime line's octave corrected. Sounds most like Defeat and The Long Night (passacaglia). |
| 31 | Alkari theme | race | 7 | 6.5 | 7.5 | 8 | 8 | 7 | -0.3 | 0 | **73.2** | Airy flute over harp-like plucks, soaring pentatonic; its lines sit on the chords two-thirds of the time. light and quick to place. Its wind chimes were written two octaves above the tubular bells and are now the celeste. Sounds most like The Survey (minimalist pulse) and Wonder (calm exploration). |
| 32 | The Chorale (rare) | map | 8 | 6.5 | 6.5 | 7.5 | 7.5 | 8.5 | -1.6 | 0 | **72.9** | The men's choir carrying a hymn low over the organ and the low brass, grand at the crest, a touch more flowing than before; the chorale is harmonised line by line and nothing is snapped onto a chord. rare by design; still the Tide's nearest kin. Sounds most like Main theme: the hymn and The Tide (rare). |
| 33 | Bulrathi theme | race | 7 | 6.5 | 7.5 | 7 | 8.5 | 7.5 | -1.8 | 0 | **72.0** | Stomping drums and low heavy brass; the theme is simple but the sound is the race. unmistakable in the audience chamber. Sounds most like Darlok theme, hostile and Espionage. |
| 34 | Psilon theme | race | 6.5 | 6.5 | 8 | 7.5 | 8 | 6.5 | 0 | 0 | **71.8** | A cool lydian shimmer; its crystal bells were the crotales played two octaves below their range for the whole theme, which is why it sounded dull. Now the celeste. cool and clear for the race. |
| 35 | Determination | map | 7 | 6 | 7 | 7.5 | 8 | 8 | -1.1 | 0 | **71.7** | A steady pulse and a resolute horn theme; solid, not surprising. the calm piece that carries the war programme, and the one with a pulse. The horn's second strain now plays in its middle register. Sounds most like Darlok theme, hostile and Bulrathi theme. |
| 36 | Espionage | cue | 7 | 7 | 8 | 7.5 | 8 | 6.5 | -2.3 | 0 | **71.2** | Noir harmonic minor with a walking sub-bass and clock ticks; 14% of its lead notes snapped. the spy panels borrow it and it sits well there. Sounds most like Ground assault and Bulrathi theme, hostile. |
| 37 | Defeat | cue | 7 | 6 | 6.5 | 8 | 8.5 | 7.5 | -1.8 | 0 | **71.2** | Slow falling lines, mourning strings, a lone bell; plain and right. the ending it is for. Its bell line was written below the glockenspiel and is now the celeste. Sounds most like Orion and The Long Night (passacaglia). |
| 38 | Patience (dorian) | map | 7 | 6 | 6.5 | 8 | 7.5 | 7.5 | 0 | 0 | **71.0** | A marimba ostinato and a plucked reed melody over a warm dorian pad; clean, and the least distinctive of the calm set. good middle energy for the map. |
| 39 | Sakkra theme | race | 6.5 | 6.5 | 8 | 7 | 8 | 6.5 | 0 | 0 | **71.0** | Hissing percussion and dry skins under a kora line; its lines sit on the chords two-thirds of the time. it places the race. |
| 40 | Drift, voices | interlude | 6 | 5.5 | 6.5 | 8 | 8.5 | 8.5 | -0.9 | 0 | **70.9** | The women humming over the men, an air pad, one flute note. a soft seam into the choir pieces. Sounds most like Drift and Drift, the choir. |
| 41 | The Antarans | cue | 6.5 | 7.5 | 8.5 | 5.5 | 8 | 7 | -1.0 | 0 | **70.8** | Tritone brass, clusters, whispers and metal in 5/4; the clusters sit low on purpose and the writing is effect more than line. menacing as the Antarans must be. Sounds most like Darlok theme, hostile and Bulrathi theme. |
| 42 | Drift, horizon | interlude | 6.5 | 5.5 | 6 | 8 | 8.5 | 8.5 | -2.2 | +0.8 | **70.6** | Strings and the analogue sky swelling together, a horn calling the hymn from far away. the seam's choice between a strings piece and a Serrie one. Sounds most like Drift, harp and Drift, the violas. |
| 43 | Victory | cue | 7 | 5.5 | 6 | 8 | 8.5 | 7.5 | -1.2 | 0 | **70.3** | Fanfares, rolling timpani, a soaring theme; generic in the best sense, every strong beat on the chord. it does what a victory cue must and nothing it needn't. Sounds most like The Procession and Human theme. |
| 44 | The Tide, at war | reading | 7 | 5.5 | 6.5 | 6.5 | 8 | 8.5 | -1.3 | +1.0 | **70.3** | A reading, not a piece: The Tide with synthetic drum hits in its big sections. Marked a little under the original. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 45 | Drift, harp | interlude | 6.5 | 5.5 | 6 | 8.5 | 8.5 | 8 | -2.4 | 0 | **69.6** | A slow harp figure under one long cello line. a graceful seam for the lighter pieces. Sounds most like Drift, the violas and Drift, horizon. |
| 46 | Bridge, calm | bridge | 6.5 | 5 | 6 | 7.5 | 9 | 8 | -1.5 | 0 | **69.2** | One swell of the strings and the soft organ with a chime. the way back onto the map after a fight, and into the chamber. Sounds most like Drift, horizon and Drift. |
| 47 | Drift | interlude | 6 | 5 | 5.5 | 8 | 8.5 | 8.5 | -1.7 | +1.0 | **68.8** | One high pad, a pedal, a few points of light. the plainest breath, which is often what a seam wants. Sounds most like Drift, voices and Drift, horizon. |
| 48 | Bridge, tense | bridge | 6.5 | 5 | 6 | 6 | 9 | 7.5 | 0 | 0 | **67.8** | Two bars of tremolo strings and a timpani roll. it gets a battle cue in on the next beat without a cut. |
| 49 | Council fanfare (the older cue) | cue | 7 | 6 | 5.5 | 7.5 | 7 | 8 | -2.4 | 0 | **66.1** | Ceremonial brass, a hymn-like choir, timpani; its horn was written an octave above the instrument for the whole piece, corrected. the chamber also plays the procession in state, which is the better piece in every respect; this one could leave the list. Sounds most like Noon (brass chorale) and Council in state. |
| 50 | Klackon theme | race | 5.5 | 7 | 9 | 5 | 7.5 | 5 | 0 | 0 | **65.0** | Chittering clicks in whole-tone ostinati and a sequencer; electronic by design for the hive, and nearly half its strong beats are off the chord because the mode has no chords to speak of. it reads as the race. |
| 51 | The Chorale, at war | reading | 7 | 5 | 5.5 | 6.5 | 7.5 | 8 | -1.6 | 0 | **64.9** | A reading: The Chorale with drum hits in its big sections. Marked a little under the original. Sounds most like Main theme: the hymn and The Tide (rare). |
| 52 | GNN news bed | cue | 6 | 6 | 7.5 | 6.5 | 7.5 | 5.5 | -0.8 | 0 | **64.5** | A confident broadcast bed with brass stabs; deliberately un-symphonic. fit for the news and for nothing else, which is its job. Sounds most like Human theme and Victory. |
| 53 | Ground assault | cue | 6.5 | 6 | 6.5 | 6 | 8 | 6.5 | -2.2 | 0 | **64.3** | Low toms, a menacing plucked ostinato, brass swells; tense and functional, closer to its electronic origins than the rest. the ground-assault screen needs exactly this tension. Sounds most like Espionage and Alkari theme, hostile. |
| 54 | Human theme, hostile | reading | 7 | 5 | 5.5 | 6.5 | 8 | 7.5 | -2.7 | 0 | **64.1** | A reading: the march in minor with snare and brass, the most convincing of the hostile readings because the march was martial already. Sounds most like Sakkra theme, hostile and Mrrshan theme, hostile. |
| 55 | Drift, the held note (was: the pulse) | interlude | 6.5 | 6.5 | 6.5 | 7.5 | 8.5 | 7 | -2.4 | 0 | **68.9** | One low cello note held through the whole minute under the air, the harp touching the chord once a bar, nothing else. Rewritten in step 6; ranked at the review's date, its total revised here: the barest breath in the set, near the horizon by the colour measure and far from it by ear. |
| 56 | Darlok theme, hostile | reading | 6.5 | 5 | 6.5 | 6 | 8 | 7 | -2.1 | 0 | **63.7** | A reading: a heartbeat pulse under the horn; the choir now sings in the men's register instead of above it. Sounds most like Bulrathi theme and Bulrathi theme, hostile. |
| 57 | Bulrathi theme, hostile | reading | 6.5 | 5 | 6 | 6 | 8 | 7 | -1.9 | 0 | **63.1** | A reading: pounding, two semitones lower still; the theme survives the transform well. Sounds most like Espionage and Darlok theme, hostile. |
| 58 | Silicoid theme, hostile | reading | 6 | 5 | 7 | 5.5 | 8 | 6.5 | -1.3 | 0 | **62.7** | A reading: grinding pulses with the horn in place of the chimes; its lead no longer carries the chimes' octave. Sounds most like Darlok theme, hostile and Bulrathi theme. |
| 59 | Mrrshan theme, hostile | reading | 6.5 | 5 | 6 | 6 | 8 | 6.5 | -2.7 | 0 | **61.5** | A reading: growling low brass, five semitones down; the reed line loses some of its snake in the brass. Sounds most like Meklar theme and Human theme, hostile. |
| 60 | Battle, heavy | cue | 6.5 | 6.5 | 5.5 | 6 | 7.5 | 6 | -2.8 | 0 | **61.2** | Half-time assault, chromatic phrygian bass, metal hits; heavy and effective, with the same reservation as the driving cue. the third battle cue. Sounds most like Klackon theme, hostile and Meklar theme, hostile. |
| 61 | Psilon theme, hostile | reading | 5.5 | 4.5 | 6 | 6 | 7.5 | 6 | 0 | 0 | **59.8** | A reading: cold clusters; the brass stabs no longer carry the harp's octave, but a lydian shimmer made hostile is still a shimmer. |
| 62 | Battle, driving | cue | 6.5 | 6 | 5 | 6 | 7.5 | 6 | -2.9 | 0 | **59.6** | Galloping bass, saw arpeggios, timpani and a brass riff; effective, but the synth lead and saw arpeggios are the least orchestral sound in the score. a second battle cue for variety. Sounds most like Meklar theme, hostile and Klackon theme, hostile. |
| 63 | Meklar theme | race | 5.5 | 6 | 7 | 5 | 7.5 | 5 | -2.7 | 0 | **57.8** | A cold sequencer, a four-on-the-floor pulse and metal strikes; electronic by design for the machines. it reads as the race. The bell line was an octave below the glockenspiel; corrected. Sounds most like Mrrshan theme, hostile and Sakkra theme, hostile. |
| 64 | Sakkra theme, hostile | reading | 6 | 4.5 | 5.5 | 6 | 7.5 | 6 | -2.7 | 0 | **57.3** | A reading: fast tribal toms; serviceable. Sounds most like Human theme, hostile and Mrrshan theme, hostile. |
| 65 | Alkari theme, hostile | reading | 6 | 4.5 | 5.5 | 5.5 | 7.5 | 6 | -2.4 | 0 | **56.9** | A reading: screeching and rapid, the synth lead in place of the flute; the airiest theme suffers most from the transform. Sounds most like Sakkra theme, hostile and Ground assault. |
| 66 | Ship design (no screen plays it) | cue | 6 | 5.5 | 7 | 7 | 4 | 5 | 0 | 0 | **56.8** | Bubbling marimba and sequenced plucks; clean and light. no screen plays it any more. |
| 67 | Research (no screen plays it) | cue | 6 | 5.5 | 6.5 | 7 | 4 | 5.5 | 0 | 0 | **56.8** | Crystal bells and rising sequences in a lydian wash; its lead and arpeggio were the crotales two octaves low and are now the celeste. no screen plays it any more. |
| 68 | Klackon theme, hostile | reading | 5 | 4.5 | 6.5 | 4.5 | 7 | 4.5 | -3.0 | 0 | **51.0** | A reading: buzzing saw swarms; the base theme is already electronic, so the transform adds little. Sounds most like Meklar theme, hostile and Battle, driving. |
| 69 | Meklar theme, hostile | reading | 5 | 4 | 5 | 4.5 | 7 | 4.5 | -3.0 | 0 | **48.0** | A reading: a harsh clock; the base theme is already a machine, so the transform adds little. Sounds most like Battle, driving and Klackon theme, hostile. |

## The plan: the map, its interludes and its bridges

Ten steps, in the order they should be done, each aimed at the issues above that a player would actually hear on the map and at the
seams into and out of the cut scenes. The cues themselves (battles, council, endings) are out of scope here except where the map
meets them.

1. **Clear the low register across the map.** A rule in the chord voicer: a second or a third between two voices below C3 costs,
   so the voicer prefers the open fifth or an octave down there (the low-interval limit every orchestration book teaches). Then the
   four worst pieces by hand, as the main theme was done: the men's choir above the bass pedal's third, the analogue pad and the
   organ from middle C's octave. The Chorale (85% of its length in close low intervals), The Frontier (85%), The Abyss (81%), The Tide
   (65%), The Vigil (57%) and The Lanes (45%) are the targets; the proof is the review tool's mud column falling under 15%.
2. **Harmonise the tunes to their notes, not the notes to the chords.** Where the engine snaps a written melody note onto the chord,
   the heard tune is not the written one. Re-harmonise The Abyss (45% of lead notes snapped), The Tide (22%), The Chorale (19%),
   The Cradle (13%) and Wonder (9%) the way the title was: one chord to a bar chosen for the tune's own notes, cadences at the phrase
   ends, and the modal notes (the phrygian step, the lydian fourth) marked to keep where the colour is the point. Proof: snaps at zero
   in the review tool, the written phrase audible.
3. **Break the "still" formula.** Fifteen pieces put the men's one sung phrase over a swell in their quiet middle; it is the single
   biggest reason the map pieces sound alike. Keep it in five (Deep Field, The Abyss, The Watch, The Frontier, The Vigil) and give the
   others a still of their own: a solo instrument alone, the harp, a pedal with the bells, the women alone, nothing but the hall.
4. **Thin the sparkle.** The celeste-or-glockenspiel sparkle layer runs through twenty of the twenty-two map pieces. Leave it to the
   planetarium pieces and the nocturne; take it out of the brass chorale, the march, the sarabande, the canon and the passacaglia, which
   have their own points of light.
5. **Separate the pairs that sound the same.** Measured likeness above 0.9 between Deep Field and The Beacon, The Nebula and The
   Beacon, The Vigil and The Chorale, The Long Night and The Abyss, First Light and Noon. For each pair, one piece changes its bed
   (the air pad for the strings, the cellos for the violas, the organ for the analogue), its lead voice or its bell, so the two are
   kin and not twins. Proof: likeness under 0.88 for every map pair.
6. **The interludes: fewer twins, no marimba.** The harp and the violas interludes are the same bed (likeness 0.98); give the harp
   interlude the air pad and the soft organ instead of the strings. Retire the marimba pulse or rewrite it as the one interlude with a
   held low string note and nothing else; the seams already avoid it after a choir or brass piece.
7. **Bridges that start where the music is.** The two bridges are entirely in the cue's key, so a map piece in D♭ cut into a battle in
   D minor jumps a tritone in five seconds. Give the bridges the modulating opening the interludes have: their first bar on the outgoing
   tonic, their second on the cue's dominant, at the outgoing pulse. Then add two more: a dark bridge (low strings, a tam-tam, a sunk
   pedal) for Orion and the Antarans, and a bright one (one brass swell, the harp) for victory and the council, and route the news bed
   and the spy panels through the calm bridge both ways.
8. **The breath for every change, not only the director's.** The long quiet interlude plays only when the director chooses the next
   piece; a programme change (war declared, peace made, a screen returning to the map) takes the plain seam. Let the soft change take
   the breath too when the two pieces are far apart, and let the return from a battle land on the quiet half of the next piece, not its
   first bar.
9. **Levels across the seams.** Render every map piece and interlude whole and bring their integrated loudness within two decibels of
   one another, the interludes three to four below the pieces, so no seam is a step up or down; then listen through one hour with the
   director and the new seams and fix anything that still jumps. The headless render was cut short in this session; run it again.
10. **Form and length where they hurt.** The Lantern loses its second trio and comes down from six minutes to four. The eight
    planetarium pieces share one form (A1, A2, B, C, breath, A3, B2, E) and one climax device (the melody doubled a third below);
    give each of the eight its own order of sections and its own crest, so the oldest pieces stop sounding like one piece in eight keys.

Steps 1, 2 and 7 are the ones a player hears first; 3 to 6 are what makes the map feel like twenty-two pieces rather than one;
8 to 10 are polish. Each step ends with the lint, the QA, the review tool and the compile-hash listing of exactly which pieces changed.

## Steps 1 to 5: done

1. **The low register.** The chord voicer now costs a second or a third below C3 and open spacing below G2, and across the map the
   men's chanted pad sits from G2, the analogue and cello beds from the octave below middle C. The share of a map piece's length with a
   close interval below C3 fell from a mean of 28% to 1.5%; the worst piece (The Long Night) is at 10%, where the Chorale, the Frontier
   and the Abyss were above 80%.
2. **The tunes on their own chords.** The Abyss, The Tide, The Chorale, The Cradle, Wonder and The Beacon are re-harmonised bar by bar
   from their melodies, the phrases placed on the bars their chords are, with variation by leaving a phrase out rather than shifting it.
   The engine snaps no note of theirs onto a chord now (it bent 65%, 28%, 47%, 13%, 11% and 9% of their lead notes before); the Abyss
   keeps its two phrygian rubs on purpose, marked to stay.
3. **The stills.** The men's one sung phrase stays in Deep Field, the Abyss, the Watch and the Vigil (the Frontier has its own); the other
   eleven pieces have a still of their own: the cello alone with the harp (Wonder), the vibes alone (Patience), the oboe alone (the Veil),
   the glockenspiel and the harp with the women (the Cradle), the trombones alone (Noon), the lament bass in the cello (the Embers), the
   nebula's bells, the lantern's glockenspiel, the survey's celeste, the oboe's episode (the Commonwealth), the celeste over the pads
   (the Lanes).
4. **The sparkle** stays in the eight planetarium pieces, the Nebula, the Watch and First Light; it is gone from the Tide, the Chorale, the
   passacaglia, the lantern, the lanes, the sarabande and the vigil.
5. **The twins.** The Beacon has soft horn chords and the low brass for its bed at 46 (it was the Nebula's and Deep Field's twin); Wonder
   has the harp running and no choir until its still; the Abyss has the ship's organ and the drone; the Chorale moves at 64 over the organ
   and the low brass, the Vigil at 48 over the cellos, the Tide at 54, the Frontier at 44; Noon at 68 with the soft organ under its strings'
   strain. No two map pieces now measure above 0.89 in likeness (the Tide and the Chorale, both rare, are the pair at 0.89); eight pairs were
   above 0.90.

Thirty-seven pieces compile to different notes after these steps (the voicer touches every piece with a chord below C3); the QA, the lint
and all 840 seam pairings pass. The marks of the changed pieces are revised above.

## Steps 6 to 10: done

6. **The interludes.** The harp interlude has the air and the ship's soft organ for its bed (it was the violas' twin at 0.98 by the colour
   measure; it is nearest the voices now, at 0.89); the violas have an alto flute far away instead of the trumpet; the marimba pulse is gone,
   and in its place is the held note: one low cello note through the whole minute under the air, the harp touching the chord once a bar,
   nothing else — the one interlude that is only a breath, and the seams count it among the quiet ones for the long breath. The hymn's head
   in the three interludes that quote it keeps its falling step over the pedal (the engine was bending the seventh onto the chord; it does not
   now). By the colour measure, which weighs families of sound and not how many voices carry them, the held note sits next to the horizon
   (0.97: both are a string voice over a synth pad); by ear they are the two ends of the set, one cello against a section swelling with a
   horn. The measure now weighs a one-voice bed as a third of a three-voice one, which is as far as a family count can go.
7. **The bridges start where the music is.** Every bridge now opens on the tonic of the piece that is playing and lands on the cue's dominant
   seventh (its two bars are the ends of the pivot walk the interludes take), so a map piece in D-flat cut into a battle in D minor no longer
   jumps a tritone. Two new ones: the dark bridge (the low strings trembling on a sunk pedal under the drone, the tam-tam, a timpani roll) for
   Orion, the Antarans and the defeat; the bright one (the brass and the strings in one swell, the harp running up, two timpani strokes) for
   the chamber and the victory. The calm bridge leads back onto the map from any cue and into and out of the news bed; the tense one into
   fights as before. The QA proves the bridge's two chords against the pivot walk.
8. **The breath for every change.** A soft programme change between two far-apart pieces (energy, darkness or key) now takes the long quiet
   interlude and the longer fades the director's seam takes; the map back from a fight lands on the quiet half of its piece (its first section
   at or under half level after the loop point), not on its first bar.
9. **Levels.** Every map piece rendered whole: integrated loudness ran from -13.4 (First Light) to -19.3 LUFS (Determination), a six-decibel
   step at the worst seam. Trims are now set for -17 within a decibel (no single change beyond three decibels: Wonder, Patience,
   Determination, the Abyss and the Watch up by one to two and a half, the Beacon, the Tide, the Chorale and First Light down by one and a half
   to two and a half); the interludes at -20.5, three and a half below; the bridges near -18 (the calm one was five decibels under).
10. **Form and length.** The Lantern's three cantus sections are eight bars each with one phrase apiece (the loop is 257 s where it was 360).
    The eight planetarium pieces each have an order of their own and a crest of their own in place of the one device (the tune a third below):
    Wonder's harp runs up through its crest, Patience has its whole bed and the marimba in sixteenths, Determination's horn theme comes back in
    the full brass with the timpani, the Veil's oboe and flute sing in unison, the Abyss has the women above the men, the Cradle's lullaby is in
    two octaves with the flute, the Beacon's horn is answered by a trumpet a phrase behind.

Twenty-two pieces compile to different notes after these steps; the QA (27 checks), the lint and the review tool pass.

## After the plan: the main theme, First Light, the loops, a second leitmotif

**The main theme** is rebuilt around the horn, as asked, with Mutiny's opening and Roll Tide's horns as the models and the planetarium under
it. It opens with the men right away, open and present, singing the commonwealth's climb (the second leitmotif's head, 1 2 3 5) on the hymn's
own harmony over a slow analogue bed, the air above them and points of light echoing in the long delay, one chime at the very start and the
deep pedal rising: solemn and vast. The horn's call answers in its heroic register as the strings, a chime and the timpani's pulse join. An
earlier opening hummed on the tonic for fourteen seconds at a third of the level before anything happened, over the organ's low mids, and
read as muddy and idle; measured on the first forty seconds the men alone now sit at -19 LUFS, the call at -15 and the strain at -17. Then
the solo horn sings the whole hymn alone over the chorus and the strings while the men take up the answer an octave under it (A1); the horn section joins the men on the
hymn over the cellos' counter-line (B); the flute breathes and the commonwealth's oboe glances in (C, the echo); then the crest: the horns
in full, the trumpets crowning the answer from its ninth bar, the whole chamber open on ah, the timpani (A2); and the solo horn closes it
alone (E). The horns play the hymn an octave below its written octave, F3 to A4, the horn's own middle register (they were at F4 to A5, its
top, where a solo horn shouts); the trumpets alone take the written octave at the crest. The solo horn is played as a soloist plays: a dynamic plan across the four phrases (the statement at three quarters, the answer on top), deeper
hairpins within each, a delayed vibrato on its long notes, a tone that darkens as it plays softer and opens as it swells, a presence lift, and
a place of its own — near the centre, at the front of the stage with the bed behind it in the hall, and a window in the texture: while it plays
the organ and the men sit below D4, the women's hum and the analogue halo above A4, and the men's answer is an octave under it rather than in
unison with it. Measured on the first strain, the solo horn alone against its bed alone (the pads, the chorus and the bass), the horn sits
2.2 dB above the bed where it was 6.4 dB under it; it has a presence lift at 2.8 kHz, it no longer darkens much when soft, and every long note
swells from softer to its written dynamic. At the build and the crest the horns rise above everything in the Roll Tide manner: the section in
the written octave, F4 to A5, high above the men who sing the hymn an octave under them, the trombones an octave under the horns, the trumpets
on the answer, and every long brass note swelling through the recorded layers. The dynamic range is wider: the introduction opens at 0.4, the crest reaches 1.12, the end dies to 0.48, and the rubato is up a
little. Every sung and blown line carries the engine's new `shape`: each phrase a hairpin, soft at its ends, full at its middle and its top,
the long notes blooming — a singer's phrasing rather than a sequencer's. The chorus hums (uuh, ooh) until the crest, where it opens to ah.

**First Light.** The chorus sits lower against the orchestra (the choir bus down 2.2 dB, the rise and the sunrise voices down a seventh).
The "looping" heard in its opening alto flute solo had three causes, all fixed in the engine rather than the score:

- The sample loops breathe. A loop of a second carries one cycle of the player's breath, a swell of four to six decibels in the winds, and a
  held note repeats it at the loop rate. The sampler now evens every loop's level when the file is decoded, and for the solo winds and brass
  evens each partial's slow cycle on its own (a short-time spectrum of the loop, each bin divided by its 300 ms trend); vibrato stays, the
  breath cycle does not. Loop ends are tuned to a whole number of periods; loops shorter than half a second (the oboe's run from 0.18 to
  0.37 s, a flutter) are moved onto the file's longest steady stretch (the oboe's are 0.7 to 1.4 s now).
- The bus had a comb in it. The music bus's multiband stage runs its middle band through a compressor, which looks ahead six milliseconds,
  and its high band through nothing, so the bands recombined through a comb with a notch every 167 Hz; at the pitches near a notch a held
  note's own vibrato became a level ripple (1.8 dB at the alto flute's A-flat, nothing a fourth away). The high band is delayed the same six
  milliseconds now; the ripple is 0.3 dB.
- The sections pulsed for another reason. A sustain with two recorded dynamics (the horn section, the cellos, the bassoon, the trumpets)
  blended both layers across most of a swell, and two recordings of one note beat against each other (their pitches drift inside their loops,
  each its own way): a held horn-section note at the blend swung by nine decibels while either layer alone was flat. The sampler now plays
  one layer at a time and hands over to the next in a quarter of a second at the moment the written dynamic crosses between them; the zones'
  roots are also measured to a fraction of a cent when their files are decoded.
- A new check holds one note per recorded zone of every sustain instrument through the bus (`node tools/qa/loops.js`) and flags a pulse or a
  click, measuring the mono sum and reporting the stereo image's sway apart. The alto flute's slow swing is 0.2 to 0.4 dB on every zone (it
  was 3.5 at the pitch First Light opens on); the oboe 0.7, the flute 0.9, the clarinet 1.1, the trumpets 1.6, the horn section 1.4 (its
  worst zone 3.1, from 11.3), the bassoon 0.5 (from 4.2). What remains is in the sections and the choirs: the cellos 2.3 on average, the
  string ensemble 1.6, the men 1.6, the women 2.0, with the worst zones near 5, and a stereo sway of 4 to 12 dB between left and right on
  the cellos' upper zones. Both come from the same thing: the pitch inside a loop drifts a few cents as the players' did, and through the
  delay and the hall's early reflections that drift returns as a level ripple once a loop, while the two channels of a stereo recording
  drift against each other. Evening the level cannot touch it; only resampling each loop to a constant pitch would, which is a next step
  if the sections are heard to breathe. In a texture of several voices they mask one another.

**The soundstage.** Every piece now stands on a subtly wider, more live stage: the pads and the chorus, which had the hall only and so sat
in a different space from the melody, are sent lightly into the stage's early reflections too (0.16 and 0.18 against the lines' 0.22 to 0.26),
and the bus's side is lifted from 1.15 to 1.3. On a minute each of the Commonwealth, First Light and the title the side-to-mid ratio rises by
1.1 dB and the stereo correlation falls by 0.03 to 0.10 with the loudness unchanged; `?soundstage=0` plays the old staging, and the player page
has the Commonwealth's first minute both ways.

**The second leitmotif.** The commonwealth's oboe tune is the procession's first strain; it is now declared the score's second leitmotif.
A first pass put it in a four-bar aside of its own in eight pieces, which was a cut-in rather than an echo, so it is woven in instead. The
climb's head (1 2 3 5) fits any tonic bar, so in six map pieces the piece's own tune is drawn toward it in one of its variation readings, in
the piece's own rhythm and over its own chords: Patience's dotted phrase opens with the climb; Determination's horn theme steps up 1 2 3 5
in its first bar; the Lanes' oboe tune may open with the whole strain and close on the tonic; Noon's first strain climbs the commonwealth's
way bent to its own vi; the Survey grows a cell from the climb beside the cells it grows from the hymn's head, and its women's chart may
sing it; the Veil's oboe plays the strain in three in its ending, where its chords run I V IV I. In the title the breath is a call and an
answer: the flute's phrase, then an oboe with the commonwealth's tune in the minor over a cadence that leads into the crest. The victory's
horns state it in full. The Embers are left alone. Fourteen pieces quote it, the title's hymn fifteen; none of the readings bends a note
except the title's, which holds the third over the dominant as an appoggiatura on purpose.

## By group

**Map.** The strongest map pieces are the ones with real forms and ideas of their own: the sunrise, the passacaglia, the nocturne, the sung chorale, the sarabande and the survey's growing cells. The nocturne,
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
now favour them for strings and choir pieces; the held note is the barest of the set and the one the long breath reaches for. The four
bridges open where the music is and land on the cue's dominant.
