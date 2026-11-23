# Concert Suite

Three movements re-composed from the game's score as concert music, to be listened to on their own. They're rendered through the game's own
engine and sampled orchestra, but they're written as finished pieces: no loops, no shuffled sections, real modulations, counter-melodies,
and an ending.

```
node tools/concert/render.js            # all three → tools/concert/out/*.wav (24-bit) and *.mp3 (320k)
node tools/concert/render.js --only 2   # one movement
node tools/concert/render.js --lint     # compile only: form, timings, any note the engine had to move onto its chord
node tools/concert/midi.js              # the score as MIDI → tools/concert/out/*.mid (one track per part, with the tempo map)
```

## What these recordings are, and aren't

The writing is meant to stand as concert music. The sound is a computer mock-up of an orchestra: free sample libraries (VSCO 2, Sonatina
and the University of Iowa soloists) played by the game's engine. The engine shapes phrasing and timing, but the libraries have no true
legato and only a few dynamic layers, and a trained ear will hear that.

To get a real symphonic sound, take the MIDI files to a professional orchestral library in a DAW, or to an orchestrator and players. The
MIDI has one track per part on the written beat grid, with every accelerando and ritardando in its tempo map.

## Revision 2: from underscore to concert writing

The first version was measured, and it read as game underscore:

- In about 20% of each movement, no melodic or bass voice moved within a 2-second window.
- The melody averaged one note every 2 to 2.5 seconds.
- The texture was mostly a tune over held chords.

The revision changed this:

- **The passacaglia now speeds up its rhythm across the variations**, as the form traditionally does: quarters, then eighths in the
  violins, a perpetual-motion scherzo for bassoon and oboe, an Alberti accompaniment under the B-major song, harp triplets under the
  hymn, and spiccato sixteenths into the climax, where the violins' eighths run against the hymn.
- **The melodies have more rhythmic shape**: dotted figures, pickups and passing eighths. Examples are the dawn theme's ornamented answer,
  the violin's quickened reading, the oboe's dancing one, and the horns' climb.
- **Accompaniment figures replace many held chords**: violas in broken chords, syncopated violas under the cloud, a spiccato ostinato
  under the sunrise, pizzicato under the day and the march, and counter-lines in the bassoon and clarinet.
- **The tempos are less funereal**, and the game's echo delay is gone; an orchestra plays in a hall.

Measured the same way afterwards, the static stretches fell to 7–14% of each movement, against 23–28% for the game's originals. Four or
more independent voices are moving in 43–53% of each movement. The quiet stretches that remain are deliberate.

The score is `tools/concert/suite.js`. The render tool loads it into `tools/test-audio.html` and nowhere else, so nothing here is part of the game.

## Programme notes

The game's music has to wait. It loops, fades in and out between screens, and stays out of the way so you can think. These three pieces
take the best of that music and let it go somewhere. The suite is cyclic: the score's two leitmotifs appear in every movement, and the
finale brings them together.

- **The hymn**: a rising fourth and a falling step. It's the game's main theme.
- **The commonwealth's climb**: 1–2–3–5, the procession's opening. It's the score's second leitmotif.

### I. First Light — Prelude *(D♭ major, about 5 minutes)*

From *The early years, first light*. In the game this is one long sunrise. Here it becomes a full day, from night to dusk.

1. **Night.** Violas and a low pedal in the basses, with a glimmer of celeste. The alto flute plays just the first two bars of the dawn
   theme.
2. **The grey.** The alto flute plays the whole dawn theme, a slow climb up the chord and back.
3. **The glow.** The solo violin takes the theme an octave higher, with a clarinet counter-line underneath, the strings, and a rolling
   harp.
4. **The cloud.** The music moves to B♭ minor. The cellos sing a new, darker tune over trembling strings while the clarinet sighs against
   them.
5. **The rise.** Back in D♭, the horns take up the dawn theme's climb in rising sequence (3–5–6, 4–6–7, 5–8–10). The voices enter, and
   the tempo presses forward.
6. **The sunrise.** The hymn arrives in the horns, with the solo horn an octave below, the trombones, the full choir, and the harp running
   up.
7. **The zenith.** The hymn's second half goes higher. The trumpets carry the tune, the men's choir sings it, and the violins play a
   descant above.
8. **The day.** The oboe plays the dawn theme pastorally, now with a cadence that comes home.
9. **Dusk.** The flute is alone over the pedal. A distant horn plays the commonwealth's climb, which looks ahead to the finale, and the
   piece ends on an open chord with an added ninth.

### II. The Long Night — Passacaglia *(B minor, about 6 minutes)*

From *The long night*, the score's highest-rated map piece. The ground is a lament: it falls from the tonic to the dominant, then steps
back up. It never stops. The variations above it are written as one arc.

| | Variation | Texture |
|---|---|---|
| | Theme | The ground alone, in the cellos and basses |
| 1 | Cor anglais | The game's original cor anglais theme, with violas |
| 2 | Violins | A new long-breathed line, with an automatic counter-line in the cor anglais and harp runs |
| 3 | Scherzando | Pizzicato. A staccato bassoon plays the theme in fragments, and the oboe answers in the gaps |
| 4 | **B major** | The night breaks open. The ground turns major, and a solo violin sings a new song over violas and a high air pad |
| 5 | B major | The violins carry the song, with a horn below it and soft voices |
| 6 | Minor again | The hymn in a solo horn, with the men's choir echoing it, over low tremolo |
| 7 | Gathering | Trembling strings and the violins high, with tubular bells, the flute's four slow notes, the trombones joining the ground, and a timpani roll |
| 8 | **Climax** | The ground in the trombones and tuba, the hymn in the horns in thirds with trumpets above, the men singing the hymn, and the full choir, tam-tam and timpani |
| | Coda | The cor anglais alone again, slowing to a stop. The last chord turns to B major (a Picardy third) |

### III. Commonwealth — Finale *(B minor → D major, about 6½ minutes)*

From *The procession* and the main theme.

1. **The call.** It comes out of the night: the hymn's head in a distant horn over the low strings in B minor, the key where the
   passacaglia ended. That B minor chord turns out to be the sixth degree of D major. A trumpet repeats the call, and the timpani roll.
2. **The procession.** The commonwealth's theme in the solo horn, over the low brass on the step and the field drums. Then the violins take
   it, with the flute an octave above and the trombones' counter-line below.
3. **The big phrase**, with its flat-sixth lift (B♭–C–D), and the trumpets joining.
4. **Trio in G**: first the clarinet, then the violins and cellos in octaves, with a horn counter-line.
5. **Development.** The call works through rising keys, B♭ then C, and arrives on the dominant of D, with snare and timpani rolls.
6. **Apotheosis.** The hymn played whole and broad. The horns, the men's choir and the trumpets carry it over the strings' spiccato
   ostinato, with a violin descant at the top. It's harmonised the same way as the sunrise in the first movement, so the suite closes its
   own circle.
7. **The answer.** The procession theme played in full by the whole orchestra.
8. **Amen.** A plagal close: the major subdominant turns minor (6, then ♭6, then 5) before the final D major chord, with tam-tam and
   timpani.

## How it was made

The movements are written in the score engine's notation (`js/audio/music.js`): phrases are scale degrees, chords are Roman numerals,
and sections switch layers on and off. The orchestral profile adds phrasing, breathing, ensemble timing and the choice of recorded
dynamic layer.

For this suite, the engine gained one feature: a section can declare its own `key` and `mode`. Chords are then read in that key, and
phrase degrees count from its tonic. The tonic is placed nearest the piece's home tonic, so lines don't jump an octave at the
modulation. Every game piece compiles byte-for-byte the same as before.

Every movement compiles with no notes moved onto a chord: each written note either sits on its chord or is meant as a passing tone.

The levels are one gain for the whole suite. It's set so the loudest movement reaches about −16 LUFS, with peaks under −1 dBFS, so the
quiet movements stay quiet relative to the loud ones.

## Revision 3: a stage, a symphony's low end, and singing soloists

**The stage.** The pieces set `seating`. In that mode, every recording plays from its seat on a concert stage, heard from about 12 m back
in the stalls. The seats and their geometry are in `js/audio/music.js`, under "the concert stage". The orchestra sits the usual way:

- The first and second violins on the left; the violas, cellos and basses on the right.
- The woodwinds in two rows in the middle.
- The horns behind on the left; the trumpets, trombones and tuba across the back.
- The timpani and percussion at the very back; the harp and celesta on the left.
- The choir on risers behind the orchestra.

Each seat gets:

- **Angle**: panned by its real angle to the listener, with the far channel up to 0.4 ms late.
- **Distance**: its direct sound slightly later, softer and duller the farther back it sits.
- **Early reflections**: from the side walls, the stage's back wall, the floor and the ceiling, using an image-source model of the hall.
  Every seat gets its own reflection pattern, and that's the main cue the ear uses to judge distance.
- **Hall**: a send into the recorded Musikverein hall that grows toward the back.

The full-ensemble recordings, whose stereo image spans the whole stage, are narrowed to their section's width. Their chords are split by
register into the sections that would play them. A melodic line stays in one seat.

**The low end.** The first renders had a film-score bass: 20–160 Hz within 0–8 dB of the loudest band, and a hole at 160–320 Hz where the
cellos, violas, horns and low voices live. The causes, all from the game's mix:

- A sine sub-bass under the basses.
- The basses low-passed at 200 Hz, leaving a boom without a bow.
- A low-band lift and a +2 dB shelf at 55 Hz.
- A −2.5 dB "mud" cut at 220 Hz.
- A compressor on the 160–450 Hz band alone, flattening the orchestra's body.
- Cellos doubling the basses an octave up.

Concert renders now set `A.concert`, which keeps the master flat: no band compression, no glue compression, no saturation and no added
width. The peak limiter stays only as a safety. The suite also removes the sine, lets the basses' bow through, and gives the cellos their
own register. After the change, 20–40 Hz sits about 35 dB under the loudest band and 160–320 Hz about 5 dB under it.

**Singing soloists.** The pieces set `sing`. In that mode, a legato note reached by a leap and held is joined to the one before:

- **Strings and voices** slide from the old pitch onto the new on a third or more. The slide takes 80–200 ms, longer for a wider leap,
  like a string player shifting or a singer carrying the line.
- **Winds and brass** get only a short shade of the old pitch.

Each part is now followed separately, so two lines on one bus are treated as two players.

The game's own pieces don't use any of this. Every game track compiles byte-for-byte as before, and the game's master chain is untouched.
