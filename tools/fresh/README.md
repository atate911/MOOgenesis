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
- `step4v.js`: d, the choir 1.5 throughout (more choir over the horn); e, d with the first statement's French horn an octave lower (D3-D4).
