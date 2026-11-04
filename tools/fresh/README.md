# The main theme, rebuilt from scratch

The user asked to start the main theme fresh after a run of fixes that each broke something else. The rebuild is a plain orchestral
texture aimed at an epic, wide sound (big sustained strings, deep drones, then the choir as a wall of sound and the horn), built one
layer at a time; each step is a short excerpt the user approves by ear before the next layer goes on. Nothing here is in the game's
score yet: a step is written into `js/audio/score/cues.js` once approved.

- `step1.js`: the string orchestra alone holding the tune's harmony (12 bars). a: the low strings hold a drone; b: they move with the
  chords. The user chose b, but heard plucking during the held bass notes.
- `step1c.js` (approved): b with the bass on the solo double bass (Iowa), D2 to A2. The double-bass section's D2 recording carries scrapes its
  loop repeats (`bass-bursts.js`: 51 bursts over 6 dB in 20 s); the solo bass is clean on every note it plays here (`transients.js`).

Render a step: `node tools/fresh/render-step.js tools/fresh/step1c.js 52 OUTDIR` (WAV and MP3, LUFS, the low end's movement).
- `step2.js` (approved: a): the choir on step 1c. a: the Sonatina men (G2-C4, three parts) with the Pianobook ooh above; b: the men alone (G2-E4,
  four parts). Both sit 1.5 to 2 dB under the strings at 250 Hz-4 kHz (`render-step.js` prints the figure). The user also wants to
  try Pianobook's "Choir of the Fallen" (one singer's low throat singing), listened to it and found it the wrong sound. The user heard
  a and b alike; a goes forward (its upper voices for the climax).
- `step3.js` (approved: a, the solo French horn): the horn with the tune on step 2a, the commonwealth's strain and its answer twice (D4-D5) after a bar of the bed alone,
  closing on the tonic (18 bars). a: the solo horn (Iowa); b: the horn section in unison. The solo stands 4 to 5.5 dB over the
  strings and choir; both are clean in their tone band (the section has more texture above 1.5 kHz).
- `step4.js`: the build. 3a states the tune once softly (cres 0.38-0.58, a breath and a timpani roll), then the crest: the horn
  section with the trombones an octave below, the timpani on the strong beats, the strings higher, the men on ah with the women
  above (cres 0.95-1.15), a closing tonic bar. The crest about 5 dB over the first statement (LRA 7.1).
  Revised after the user's notes (background music: no louder; the timpani and brass right; a little more choir; a little more
  energy at the crest): the choir 1.3 (level with the strings), the strings' spiccato ostinato in eighths under the crest; the
  loudness unchanged within 0.2 dB.
  Then more choir at the build (the men 1.25, the women 0.78 at the crest), the crest strings 0.9: the same loudness.
- `step4v.js` (approved: e): d, the choir 1.5 throughout (more choir over the horn); e, d with the first statement's French horn an octave lower (D3-D4).
- `full.js`: the whole piece from 4e: intro (4 bars, the bed alone), A (8, the low French horn's tune), A2 (8, fuller, a breath and
  a roll), B (the crest), D (8, the wind-down, the horn's strain once more), E (4, settling); loops from A. About 2:50, -17 to -10 to
  -19 LUFS short-term, LRA 8.9. Not yet in the game's score: it replaces the title once the user approves it.
- `full2.js` (approved: x, the production variation): the climax's horns fuller. x: the horn section at D4-D5 with the solo French horn an octave below, the trombones under them; y: the horn section with a second horn a third below (harm -2), the trombones an octave below.
- `full3.js`: the production arrangement in the user's form: theme (the question) - interlude (brooding) - theme (building) -
  majestic resolution (the answer) - conclusion. intro 4, A 8 (the low French horn, PA PB, ending open), I 8 (the solo cello, V3 V4
  through the relative minor, the men low, no brass), A2 8 (fuller, a breath, a roll), B 8 (the climax of x), M 8 (HY CD in the horns,
  falling home to the tonic), Z 8 (the low horn recalls the head, settling). About 3:30, loops from A; -18 in the interlude, -10 at
  the climax and the answer (no louder), LRA 10.3.
- `full4.js`: the user found the interlude filler and the answer weak, and asked for about 5 min, more time away from the theme, an
  answer that rises above the climax and then resolves, a release on the strings and choir, an echo of the interlude. intro 4, A 8,
  I1 8 (the cello, the rising idea from the sixth, a half close), I2 8 (the horn answers, the cello lays the head beneath), A2 8,
  B 8, M 8 (RISE: the rising idea in sequence to a peak on V), R 8 (RES: the head broadened, falling home), L 4 (strings and choir),
  E 8 (I2 on the cello), Z 6. About 5:20; the rise about 1 dB over the climax.
- `full5.js`: full4 with a held tutti peak (P, 3 bars on V) before the resolution: strings across the octaves (cellos open A2-A3 below, the section to E6), the trombones A3, the horn section E5, the trumpets A5, the flutes C#6, the choir full (the women to E5), the timpani rolling. About 5:35; the peak about -9 LUFS short-term.
- `full5.js` now has a high solo trumpet (Iowa) at the peak on the theme's 4th-6th notes an octave up (A5 B5 A5); `full5b.js` the 5th-8th (B5 A5 F#5 E5).
- `full6.js`: the user heard 3:10-3:50 (the rise and peak) as muddy, unmusical, over the top, hard to hear: thinned to fewer lines in clear registers (`clarity.js`: the tune 2.3 -> 3.4 dB over the rest there; the peak no louder than the climax).
- `full7.js` (the production candidate): full4 (before the held peak, which the user found too much) with full6's clearer rise. The tune 3.6 dB over the rest at the rise; about 5:20.
- `full8.js`: full7 paced with breathing room: soft bed-only passages S1 (3 bars after the theme), S2 (2, before the theme builds), S3 (2, after the climax), the release 6 bars. About 6:00, LRA 11.8; the soft passages about -21 LUFS short-term.
- `full9.js` (`full9a/b/c.js`): full8 with a gentler opening (6 bars, the theme's first statement at cres 0.3-0.42, vel 0.8) on a softer voice: a the alto flute, b the solo trombone (an octave down), c the clarinet. The first statement about -20 LUFS short-term (was -14 to -15 on the horn).
  d (`full9d.js`): the concert flute (Iowa) an octave up, D5-D6, with its level raised (lvl 0.73; the preset's 0.071 left it 16 dB under the bed): 2.8 dB over the rest in the first statement. The user heard the trombone faintly and the clarinet not at all (the trombone measured 2.8 dB under; the Iowa clarinet's preset level 0.084 is as low as the flute's).
  e/f (`full9e.js`, `full9f.js`): the alto flute and the concert flute with more lift (about 3.3 dB over the bed), feeling and dynamics: `expr: 1.6` (the phrase's arc and the long notes' swells half again as strong) and `vibK: 2.2` (a deeper vibrato on held notes), new options on a line in the orchestral profile (1 = as before); the statement's crescendo 0.26-0.48.
