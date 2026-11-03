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
- `step2.js`: the choir on step 1c. a: the Sonatina men (G2-C4, three parts) with the Pianobook ooh above; b: the men alone (G2-E4,
  four parts). Both sit 1.5 to 2 dB under the strings at 250 Hz-4 kHz (`render-step.js` prints the figure). The user also wants to
  try Pianobook's "Choir of the Fallen" (one singer's low throat singing, binaurally processed: check it in mono); it needs a
  Pianobook login, so the user downloads it and shares a Dropbox or Google Drive link.
