# assets/audio — sampled instruments for the music engine

`instruments.json` lists 40 playable instruments as MP3 multisamples (one file every few semitones, one or two dynamic layers,
round robins where repetition would show). `js/audio/sampler.js` loads them lazily after the first click (never from `file://`,
where `fetch` is blocked) and plays them through the same voice graph as the synth voices; every preset keeps a synth fallback,
so the score sounds the way it always did until the files arrive, and on a machine without them.

Provenance
- Recorded orchestra (strings, brass, flute, harp, organ, timpani, bass drum, snare, cymbals, gong): **VSCO 2 Community Edition**
  by Versilian Studios (Sam Gossner, Simon Dalzell; sample cutting Elan Hickler), released under **CC0 1.0** (public domain).
  Source: https://github.com/sgossner/VSCO-2-CE — only the files listed in `tools/samples/build.py` are used, trimmed, level-matched,
  looped and encoded by that script.
- Choir (men "oh" / "ah", mixed upper voices), analogue ensemble pads and the sub bass: synthesized for this game by
  `tools/samples/synth.py` (additive formant voices with independent vibrato, breath and stereo placement; detuned saw banks through
  a four-pole filter and a three-tap chorus).

Rebuild: `python3 tools/samples/build.py --vsco /path/to/VSCO-2-CE --out assets/audio` (needs ffmpeg + numpy; ~5 minutes).
`calib.mp3` carries one impulse at 0.100 s so the browser can measure its MP3 decoder delay and correct the loop points.
