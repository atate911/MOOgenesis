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
| 1 | First Light (early) | map | 9 | 8.5 | 8 | 9 | 9 | 9.5 | -1.4 | +2.5 | **89.6** | The clearest arc on the map (0.3 to 1.05 and back to 0.4), a dawn theme that grows by climbing the chord, the hymn at the sunrise with both choirs; every strong beat sits on the chord. it reads as the first years, and it seams well. Not a 10 only because its harmony is simple (four chords). Sounds most like Noon (brass chorale) and Wonder (calm exploration). |
| 2 | The Long Night (passacaglia) | map | 9 | 9.5 | 9 | 8 | 9 | 8.5 | -2.2 | +2.0 | **88.3** | A real form (a ground and seven variations, each a texture of its own), no melodic snaps at all, grave and patient. the strongest late-game and war piece. Held back only by the thick low register in its full variations. Sounds most like The Abyss (phrygian) and Defeat. |
| 3 | Main theme: the hymn | cue | 8.5 | 7.5 | 8 | 8.5 | 9.5 | 10 | -1.3 | +0.2 | **86.0** | The hymn is the score's best tune and the piece builds to a true climax (level 1.08) and settles; the organ-and-men scoring is distinctive. it is the leitmotif every other piece quotes, and the title screen's job is exactly this. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 4 | The Watch (nocturne) | map | 8.5 | 8.5 | 9 | 8.5 | 8 | 7.5 | 0 | +2.5 | **85.8** | The richest harmony on the map (ten chord types, add9 and sus4), a walking pizzicato bass, a soft solo trumpet whose line is its own; every strong beat on a chord tone. a nocturne for the quiet turns; its tubular bells were an octave high; corrected. |
| 5 | The Vigil (sung chorale) | map | 8.5 | 8 | 8 | 8.5 | 9 | 9 | -1.9 | +2.3 | **85.7** | A sung chorale with a real plan (men alone, SATB, an organ verse, a descant, brass only at the crest) on a theme shared with the rare tenth piece. the late empire's night watch, and the choir interlude leads into it naturally. Its tubular bells were an octave high; corrected. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 6 | The Procession | cue | 8.5 | 8 | 8 | 8.5 | 9 | 9 | -2.1 | +2.0 | **85.2** | The best-built cue (theme, big phrase over the flat-sixth lift, trio, hymn, return), a long-breathed horn line over low brass on the step. it carries the council and the war programme and is rare on the map, so it stays an occasion. A few of its lead notes (13%) are snapped onto the chords. Sounds most like Council in state and Council fanfare (the older cue). |
| 7 | The Embers (sarabande) | map | 8.5 | 9 | 9 | 8 | 8.5 | 8 | -0.9 | +1.0 | **85.1** | The sarabande's stressed second beat, a cor anglais tune, the leitmotif turned upside down over the lament bass; genuinely a different kind of music. grief for the late years, in three, which keeps it apart from everything else in the late rotation. Sounds most like Orion and The Long Night (passacaglia). |
| 8 | The Survey (minimalist pulse) | map | 8 | 9 | 9 | 8 | 8.5 | 8 | -0.9 | +2.0 | **85.1** | Process writing, the cells of the leitmotif growing by a note each time over the violas' pulse; the one minimalist piece. early energy without weight. Its lines sit on the chords less often (66% of strong beats), which is the price of the cells; the glockenspiel line's octave corrected. Sounds most like Alkari theme and The Lanes (Serrie sequence). |
| 9 | The Commonwealth (woodwind canon) | map | 8 | 9 | 9.5 | 7.5 | 8 | 7 | 0 | +2.0 | **83.5** | A canon on the procession's theme over a walking bassoon, the one piece with no strings but the bassoon; a question-and-answer episode between the canons. contact music that sounds like the talk between peoples; a little dry for a long stretch of play. |
| 10 | The Nebula (Serrie drift) | map | 7.5 | 7 | 7 | 9 | 9 | 9.5 | -1.1 | +2.5 | **83.1** | As music it is a drift (four chords a minute, a few long flute notes); its craft is in the sound, not the writing. it is the Serrie flavour the score was asked for, it fits solitude, and it seams into anything. Sounds most like The Beacon and Deep Field (planetarium). |
| 11 | Noon (brass chorale) | map | 8.5 | 8 | 8 | 8 | 8 | 8.5 | -1.5 | +2.5 | **82.8** | Four-part horn writing, the trumpets' own strain, the strings answering with the hymn, a plagal amen; the hymn's answer sits well in brass. grand for the middle years, but the densest texture in the score (21 voices at the full) makes it the heaviest piece in the calm rotation. Sounds most like Council fanfare (the older cue) and First Light (early). |
| 12 | The Lanes (Serrie sequence) | map | 7.5 | 7.5 | 7.5 | 8.5 | 8.5 | 9 | -0.7 | +2.0 | **82.0** | A celeste sequence in the Serrie manner with an oboe tune of its own and the hymn at the crest. the middle years' trade lanes, and it seams well. Its analogue pad sits low enough to muddy the bass nearly half the time, which keeps the music mark down. Sounds most like The Survey (minimalist pulse) and The Beacon. |
| 13 | The Lantern (chorale prelude in six) | map | 8.5 | 9 | 9 | 8 | 6.5 | 7 | 0 | +1.0 | **80.5** | A chorale prelude in Bach's manner, the cradle tune at half speed as a cantus firmus under a clarinet that never stops, a flute trio. at six minutes it is twice the length of its neighbours in the early rotation, and it asks for attention the early years rarely have. |
| 14 | The Frontier (slow march) | map | 7.5 | 8 | 8 | 7 | 8.5 | 8.5 | -1.5 | +2.0 | **79.8** | Field drums at a whisper, the tuba on the step, a dotted trombone theme, the hymn at half speed at the crest, the abyss's step in the still. the border held, strong at war. The low register (cellos, men, tuba) is in close intervals most of the time, which costs it. Sounds most like The Long Night (passacaglia) and Orion. |
| 15 | Drift, the choir | interlude | 7 | 6.5 | 7.5 | 8.5 | 9 | 9 | 0 | 0 | **79.3** | The men's phrase under the women, nothing else but the hall and a chime. the breath before a very different piece, and the seam's choice after a choir piece. |
| 16 | Council in state | cue | 8 | 6.5 | 6 | 8 | 9 | 9 | -2.0 | +2.0 | **78.3** | The procession abbreviated with pomp (tam-tam, timpani roll, brass fanfare on the call). the chamber is rarely open a minute, and this reaches the big phrase within a quarter minute. It ranks under the procession because it is the procession, cut. Sounds most like The Procession and Council fanfare (the older cue). |
| 17 | The Cradle (lullaby in six) | map | 7 | 7.5 | 8 | 8 | 7.5 | 7.5 | 0 | +1.0 | **76.5** | A lullaby in six with a clarinet tune and a rocking harp; its sixth degree over the IV chord is snapped a dozen times a pass, so the tune is a little plainer than written. the ship asleep, and its quick six makes a fine seam into slower pieces. |
| 18 | Wonder (calm exploration) | map | 7 | 6 | 6 | 8.5 | 8.5 | 9 | -1.5 | +2.5 | **76.2** | Pleasant and light, the wonder tune every later piece glances back at, but its lines sit on the chords less than the newer pieces (73%) and its form is the standard A-B-C. the first turns, alone among the stars, and it fits them exactly. Sounds most like First Light (early) and Deep Field (planetarium). |
| 19 | Battle (the main cue) | cue | 7.5 | 7 | 7 | 7 | 9 | 9 | -2.0 | 0 | **76.0** | A real battle texture (spiccato ostinato, low-brass stabs, the men, the hymn in full brass) with a climax at 1.15. the main battle cue and the right one. Thirteen percent of its lead notes are snapped onto the chords, which is the cost of fast lines over fast changes. Sounds most like Sakkra theme, hostile and Human theme, hostile. |
| 20 | The Tide (rare) | map | 7.5 | 7 | 7.5 | 7 | 8 | 9 | -1.4 | +0.5 | **75.8** | Deep swells rising to the hymn in full brass; felt when it comes. A fifth of its lead notes are snapped onto the chords and its low register is thick. rare by design, so its weight is an event rather than a burden. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 21 | Mrrshan theme | race | 7 | 7 | 8.5 | 7 | 8.5 | 7 | 0 | 0 | **75.3** | A snaking phrygian-dominant reed line over tribal toms; every strong beat on the chord. vivid, quick to place. |
| 22 | Deep Field (planetarium) | map | 6.5 | 6.5 | 6.5 | 8.5 | 8 | 9 | -1.6 | +2.0 | **75.2** | The stillest piece on the map (three and a half chords a minute, no climax at all); its craft is restraint. right for a player alone among the stars, and the planetarium drift is a colour the score needs. Sounds most like The Beacon and Wonder (calm exploration). |
| 23 | The Veil (waltz) | map | 7 | 7 | 7.5 | 8.5 | 7.5 | 7.5 | -0.7 | +1.0 | **75.0** | A waltz tune for oboe over harp arpeggios, the women far back; graceful, slight. the only waltz on the map, welcome for the change of step, not a piece a player will remember. Sounds most like Wonder (calm exploration) and The Embers (sarabande). |
| 24 | Darlok theme | race | 7 | 7 | 8 | 7 | 8.5 | 7.5 | -0.5 | 0 | **74.8** | Eerie harmonic-minor pads, whispers, plucked shadows; the lead is snapped onto the chords 17% of the time. it says the race in two bars. The hostile reading's choir now sings in the men's register. Sounds most like Orion and Determination. |
| 25 | Drift, the violas | interlude | 7 | 6 | 6.5 | 8.5 | 9 | 8.5 | -2.4 | +0.8 | **74.7** | Violas and cellos breathing under a trumpet far away. the interlude the seams choose most for the strings pieces, and the one that most sounds like the orchestra pausing. Sounds most like Drift, harp and Drift, horizon. |
| 26 | Silicoid theme | race | 6.5 | 7 | 9 | 6.5 | 8.5 | 7 | -0.2 | 0 | **74.0** | Drones, slow chimes and geologic pulses; the writing is minimal and the close low thirds are the sound rather than a fault. no other theme could be mistaken for it. The chimes were an octave above their range; corrected. Sounds most like Defeat and The Long Night (passacaglia). |
| 27 | Alkari theme | race | 7 | 6.5 | 7.5 | 8 | 8 | 7 | 0 | 0 | **73.5** | Airy flute over harp-like plucks, soaring pentatonic; its lines sit on the chords two-thirds of the time. light and quick to place. Its wind chimes were written two octaves above the tubular bells and are now the celeste. |
| 28 | Human theme | race | 7.5 | 6 | 6.5 | 8 | 8.5 | 8 | -1.5 | 0 | **73.3** | A noble march with snare, strings and brass; every strong beat on a chord tone; the most orchestral race theme. it places the race at once. Sounds most like GNN news bed and Victory. |
| 29 | Orion | cue | 7 | 7.5 | 8.5 | 7 | 8 | 7 | -2.0 | 0 | **73.0** | Drones, chimes and a double-harmonic melody; ancient and awed, and distinct from everything else. the Orion screen asks for exactly this. The chime line's octave corrected. Sounds most like Defeat and The Long Night (passacaglia). |
| 30 | The Abyss (phrygian) | map | 6 | 7 | 8 | 6 | 8 | 8 | -1.6 | +2.5 | **72.4** | The score's darkest colour, but nearly half its written lead notes are snapped onto the chords (the phrygian rubs are exactly what the engine removes), so the heard tune is plainer than the written one, and the low texture is thick. the only truly dark piece in the calm set, and needed. Sounds most like The Long Night (passacaglia) and Defeat. |
| 31 | The Beacon | map | 6.5 | 7 | 7 | 7.5 | 7.5 | 8.5 | -1.7 | +1.0 | **72.3** | A glass synth and strings on a sunken pedal, a horn calling the leitmotif from far away; atmospheric, but its lines sit on the chords less than any other map piece (54% of strong beats). a signal from the edge; the weakest of the eight planetarium pieces. Sounds most like The Nebula (Serrie drift) and Deep Field (planetarium). |
| 32 | Bulrathi theme | race | 7 | 6.5 | 7.5 | 7 | 8.5 | 7.5 | -1.8 | 0 | **72.0** | Stomping drums and low heavy brass; the theme is simple but the sound is the race. unmistakable in the audience chamber. Sounds most like Darlok theme, hostile and Espionage. |
| 33 | Determination | map | 7 | 6 | 6.5 | 7.5 | 8 | 8 | -1.1 | +1.0 | **71.9** | A steady pulse and a resolute horn theme; solid, not surprising. the calm piece that carries the war programme, and the one with a pulse. The horn's second strain now plays in its middle register. Sounds most like Darlok theme, hostile and Bulrathi theme. |
| 34 | Psilon theme | race | 6.5 | 6.5 | 8 | 7.5 | 8 | 6.5 | 0 | 0 | **71.8** | A cool lydian shimmer; its crystal bells were the crotales played two octaves below their range for the whole theme, which is why it sounded dull. Now the celeste. cool and clear for the race. |
| 35 | Patience (dorian) | map | 7 | 6 | 6 | 8 | 7.5 | 7.5 | 0 | +1.0 | **71.3** | A marimba ostinato and a plucked reed melody over a warm dorian pad; clean, and the least distinctive of the calm set. good middle energy for the map. |
| 36 | Espionage | cue | 7 | 7 | 8 | 7.5 | 8 | 6.5 | -2.3 | 0 | **71.2** | Noir harmonic minor with a walking sub-bass and clock ticks; 14% of its lead notes snapped. the spy panels borrow it and it sits well there. Sounds most like Ground assault and Bulrathi theme, hostile. |
| 37 | Defeat | cue | 7 | 6 | 6.5 | 8 | 8.5 | 7.5 | -2.0 | 0 | **71.0** | Slow falling lines, mourning strings, a lone bell; plain and right. the ending it is for. Its bell line was written below the glockenspiel and is now the celeste. Sounds most like Orion and The Long Night (passacaglia). |
| 38 | Sakkra theme | race | 6.5 | 6.5 | 8 | 7 | 8 | 6.5 | 0 | 0 | **71.0** | Hissing percussion and dry skins under a kora line; its lines sit on the chords two-thirds of the time. it places the race. |
| 39 | Drift, voices | interlude | 6 | 5.5 | 6.5 | 8 | 8.5 | 8.5 | -0.9 | 0 | **70.9** | The women humming over the men, an air pad, one flute note. a soft seam into the choir pieces. Sounds most like Drift and Drift, the choir. |
| 40 | The Chorale (rare) | map | 7.5 | 6.5 | 6.5 | 7 | 7.5 | 8.5 | -1.9 | 0 | **70.8** | The men's choir carrying a hymn low over the organ, grand at the crest. rare by design, but the organ, the analogue pad and the men all crowd the octave below middle C, and it is the muddiest piece on the map. Sounds most like The Vigil (sung chorale) and The Tide (rare). |
| 41 | The Antarans | cue | 6.5 | 7.5 | 8.5 | 5.5 | 8 | 7 | -1.0 | 0 | **70.8** | Tritone brass, clusters, whispers and metal in 5/4; the clusters sit low on purpose and the writing is effect more than line. menacing as the Antarans must be. Sounds most like Darlok theme, hostile and Bulrathi theme. |
| 42 | Drift, horizon | interlude | 6.5 | 5.5 | 6 | 8 | 8.5 | 8.5 | -2.2 | +0.8 | **70.6** | Strings and the analogue sky swelling together, a horn calling the hymn from far away. the seam's choice between a strings piece and a Serrie one. Sounds most like Drift, harp and Drift, the violas. |
| 43 | Victory | cue | 7 | 5.5 | 6 | 8 | 8.5 | 7.5 | -1.2 | 0 | **70.3** | Fanfares, rolling timpani, a soaring theme; generic in the best sense, every strong beat on the chord. it does what a victory cue must and nothing it needn't. Sounds most like The Procession and Human theme. |
| 44 | Drift, harp | interlude | 6.5 | 5.5 | 6 | 8.5 | 8.5 | 8 | -2.4 | 0 | **69.6** | A slow harp figure under one long cello line. a graceful seam for the lighter pieces. Sounds most like Drift, the violas and Drift, horizon. |
| 45 | The Tide, at war | reading | 7 | 5.5 | 6.5 | 6.5 | 8 | 8.5 | -1.4 | +0.5 | **69.6** | A reading, not a piece: The Tide with synthetic drum hits in its big sections. Marked a little under the original. Sounds most like The Chorale (rare) and The Chorale, at war. |
| 46 | Bridge, calm | bridge | 6.5 | 5 | 6 | 7.5 | 9 | 8 | -1.5 | 0 | **69.2** | One swell of the strings and the soft organ with a chime. the way back onto the map after a fight, and into the chamber. Sounds most like Drift, horizon and Drift. |
| 47 | Drift | interlude | 6 | 5 | 5.5 | 8 | 8.5 | 8.5 | -1.7 | +1.0 | **68.8** | One high pad, a pedal, a few points of light. the plainest breath, which is often what a seam wants. Sounds most like Drift, voices and Drift, horizon. |
| 48 | Bridge, tense | bridge | 6.5 | 5 | 6 | 6 | 9 | 7.5 | 0 | 0 | **67.8** | Two bars of tremolo strings and a timpani roll. it gets a battle cue in on the next beat without a cut. |
| 49 | Council fanfare (the older cue) | cue | 7 | 6 | 5.5 | 7.5 | 7 | 8 | -2.1 | 0 | **66.4** | Ceremonial brass, a hymn-like choir, timpani; its horn was written an octave above the instrument for the whole piece, corrected. the chamber also plays the procession in state, which is the better piece in every respect; this one could leave the list. Sounds most like Council in state and The Procession. |
| 50 | Klackon theme | race | 5.5 | 7 | 9 | 5 | 7.5 | 5 | 0 | 0 | **65.0** | Chittering clicks in whole-tone ostinati and a sequencer; electronic by design for the hive, and nearly half its strong beats are off the chord because the mode has no chords to speak of. it reads as the race. |
| 51 | The Chorale, at war | reading | 7 | 5 | 5.5 | 6.5 | 7.5 | 8 | -1.9 | 0 | **64.6** | A reading: The Chorale with drum hits in its big sections. Marked a little under the original. Sounds most like The Vigil (sung chorale) and The Tide (rare). |
| 52 | GNN news bed | cue | 6 | 6 | 7.5 | 6.5 | 7.5 | 5.5 | -0.8 | 0 | **64.5** | A confident broadcast bed with brass stabs; deliberately un-symphonic. fit for the news and for nothing else, which is its job. Sounds most like Human theme and Victory. |
| 53 | Ground assault | cue | 6.5 | 6 | 6.5 | 6 | 8 | 6.5 | -2.2 | 0 | **64.3** | Low toms, a menacing plucked ostinato, brass swells; tense and functional, closer to its electronic origins than the rest. the ground-assault screen needs exactly this tension. Sounds most like Espionage and Alkari theme, hostile. |
| 54 | Human theme, hostile | reading | 7 | 5 | 5.5 | 6.5 | 8 | 7.5 | -2.7 | 0 | **64.1** | A reading: the march in minor with snare and brass, the most convincing of the hostile readings because the march was martial already. Sounds most like Sakkra theme, hostile and Mrrshan theme, hostile. |
| 55 | Drift, pulse | interlude | 5.5 | 5.5 | 6.5 | 7.5 | 7.5 | 7 | -1.8 | 0 | **63.9** | A marimba figure keeping time under a warm pad. the least like a breath; the seams now rarely choose it after a choir or brass piece. Sounds most like Drift, the violas and Drift, harp. |
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
now favour them for strings and choir pieces; the marimba pulse is the least like a breath and is rarely chosen after a choir or brass
piece. The two bridges do what they must in five seconds.
