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
- `full10.js`: full9f's climax reviewed for clarity (the tune 2.5 dB over the rest there, against 7.5 in the interlude): the women
  above the horns, the ostinato below, the strings thinner and higher, the horns +1.5 dB and the men -1 dB at the climax, and a new
  section setting `verb` (the hall's send, ridden: 0.7 through the climax and the rise, 0.85 in the resolution): 3.1 dB. The user heard
  the alto flute as flat: its tuning in the theme's range is within 5 cents (and the bed within 3), so it is its dull tone there.
- `full11.js`: more bass (the solo double bass x1.4, the tone's lo 1.3: +2 dB at 60-120 Hz; below 60 Hz unchanged, since the bass
  sits at D2-A2), the first statement on the solo violin (Iowa, D4-D5, expr 1.6, vibK 1.3, its level raised to 2.4 dB over the bed),
  the horn's first entry vel 0.8 (4.9 dB over the rest).
- `full12.js` (`full12g/h.js`): the first statement on the oboe (Iowa, level raised: it sat 4.4 dB under the bed) or the cor anglais, about 3 dB over the bed; more bass mass and presence: the master's shelves via `tone` (lo 2.5 dB at 120 Hz, hi 3.0 dB at 5 kHz), the solo bass x1.6 (+1.4 dB at 40-80 Hz, +1.3 dB at 5-12 kHz). The double-bass section at D1-A1 was tried for mass and rejected: rough overtones (the old plucking).
- `full12h.js` approved (the cor anglais). `full13.js`: an organ pedal (a new third bed part `pad3`, and a bed's `root: true`, only the
  chord's root) tried for sub-bass: the library's organ recordings carry almost no fundamental (-72 dB at 25-60 Hz alone), so no
  effect. The tuba's D1 and the section basses' D1 and G1 are rough. `full14.js`: a piece's `subBass` (a sine an octave under the
  bass, allowed again for the bass only in this orchestral piece, as a film mix reinforces its low strings): 25-45 Hz +14 dB.
- `full14.js` (the cor anglais approved, "no more experimenting"): the sub (subBass 0.6), 50-120 Hz body (the solo bass x1.9, the low
  cellos x1.2) and a piece's `lowBand` (new: lifts the master's low band, which its 2:1 compressor otherwise holds even: +2.5 dB):
  50-120 Hz +2.8 dB absolute, the sub +2.7.
- `full15.js`: the bass at the swell as a new register: a bass `fresh` entry (new: not tied or legato from before) with a strong attack,
  the section tuba on the roots (pad3, root) through the climax and the rise, and a section's `subBass` (new) opening the sub there.
- `full16.js` (current): another low bass instrument (the bass clarinet on the roots, D2-B2, in every section but the climax and the
  rise, clean on its held notes) and the sub +1 dB throughout, the low band 3.5: the sub +1.7 dB, 50-120 Hz +0.7; at the swell the sub
  about 5 dB over the bars before.
- `full17.js`: full16 in a recorded hall (a piece's `hall`, new): Voxengo's Musikvereinsaal impulse, stored unaltered with its license
  in assets/audio/ir/voxengo/, decoded once (A.loadIR), resampled per engine, its energy matched to the generated hall's. The tune
  +0.5 dB clearer in the interlude and at the climax; loudness and range unchanged.

## The refresh: every other piece brought to the theme's standard

The user: "apply what we've learned about mastering and sound design to all the other pieces. I don't want to re-write them, let's just
optimize them." Then: the best samples, playing nicely together, the fine tuning matching; and the dynamic recording chosen to suit
the movement, consistent with the notes around it.

- `js/audio/score/refresh.js`: one entry per piece (47), changing only how it is performed and mastered (`?refresh=0` plays the pieces
  as they were). The notes, forms and instruments' parts are untouched.
- `sweep.js` measures a piece's first 100 s (after 8): level, six band shares (sub 25-50, low 50-120, low mids 120-400, mids 400-2k,
  presence 2-5k, air 5-12k), the tune over the rest and the choir against the strings (250 Hz-4 kHz); `sweep.js IDS PORT JSON PATCH`
  tries refresh entries before they are written. Three passes, four processes at a time (the machine's four cores):
  - baseline: most map pieces 10-16 dB lighter in the sub than the theme, many with their top cut 2.5 dB, the tune under 1 dB over the
    accompaniment in half of them;
  - pass 1 (the recipe from the theme): the orchestral profile, the hall, presence and low shelves, the low band, a sine sub, the hall
    ridden down in climaxes (sections at 0.95+), the solo lifted toward 2.5 dB over the rest, the choir toward -3 dB of the strings.
    The battle cue lost its bite under the profile (presence -7.2 -> -14.7 dB): mastering only. The plucked basses keep their pluck
    (the profile no longer ties or low-passes pizzicato, harp, mallets);
  - pass 2: presence restored where the profile's sul tasto beds dulled it, the low shelf trimmed where 50-120 Hz passed +2.5 dB, The
    Tide's low end returned to its own; a `subBass` floor for the synth-era cues (the engine allows it outside the profile now);
  - pass 3: `tone.pres` (new: a broad lift at 3 kHz, where the 5 kHz shelf does not reach) toward each piece's former presence (-14 dB
    at least), the last solo and choir lifts, the trim (the master's compression takes back about half a trim change).
  - after: every piece within 0.5 dB of its former level; the tune over the accompaniment positive in all but two ambient pieces.
- The recordings (`upgrade` in an entry): the one-layer flute, oboe, clarinet, alto flute, bassoon, solo horn and solo trumpet
  replaced by the library's three-layer recordings of the same instruments (Iowa), at matched loudness (old against new on the same
  held notes at two dynamics). Their dynamic range widens from 1-6 dB to 7-13 dB; the old alto flute sat about 20 dB under its own
  setting, the old solo horn louder soft than loud.
- Tuning (`tools/qa/tuning.js`, every pitched zone as played against A440): the looped zones were already tuned at decode; now the
  struck and plucked ones are too (just after the attack, a stricter estimator), bells and drums excepted. Three recordings too far
  out for the correction window fixed at the source: the solo double bass's loud Bb3 (57 cents flat), the Iowa clarinet's loud Ab6
  (52 flat), and the soft Iowa alto flute G3 (its pitch wanders +-60 cents: kept at its written root, `fix`).
- The layer flow (`layerFlow`, music.js; the sampler's `flowLayer`): which recording (soft, mid, loud) a note plays from follows the
  phrase and the section rather than each note's written dynamic, with hysteresis inside a phrase. Recording changes between
  neighbouring notes of a phrase, over the refreshed pieces: 10.3 per 100 notes before, 0.2 after.
