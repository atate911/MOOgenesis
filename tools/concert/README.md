# Concert Suite

Three movements re-composed from the game's score as concert music, to be listened to on their own. They're rendered through the game's own
engine and sampled orchestra, but they're written as finished pieces: no loops, no shuffled sections, real modulations, counter-melodies,
and an ending.

```
node tools/concert/render.js            # all three → tools/concert/out/*.wav (24-bit) and *.mp3 (320k)
node tools/concert/render.js --only 2   # one movement
node tools/concert/render.js --lint     # compile only: form, timings, any note the engine had to move onto its chord
```

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
