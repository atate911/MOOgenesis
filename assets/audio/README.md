# assets/audio — sampled instruments for the music engine

`instruments.json` lists the playable instruments as MP3 multisamples (one file per recorded note, one to three dynamic layers,
round robins where repetition would show). `js/audio/sampler.js` loads them lazily after the first click (never from `file://`,
where `fetch` is blocked) and plays them through the same voice graph as the synth voices; every preset keeps a synth fallback,
so the score sounds the way it always did until the files arrive, and on a machine without them.

Provenance
- Per family, the source was chosen by measuring the raw recordings' top end and keeping the more natural one.
  **VSCO 2 Community Edition** (Versilian Studios, CC0 1.0; https://github.com/sgossner/VSCO-2-CE): violin, viola and cello sections
  and the solo contrabass (sustain, tremolo, spiccato, pizzicato, two dynamic layers), trumpet, tenor trombone, flute, bassoon, marimba,
  bass drum, snare, cymbals, gong, tambourine, claves, anvil, snare taps, field drums, pipe organ.
  **Sonatina Symphonic Orchestra 2.0** (Mattias Westlund, Peter Eastman and contributors; Creative Commons Sampling Plus 1.0,
  https://creativecommons.org/licenses/sampling+/1.0/ ; https://github.com/peastman/sso): section horns (mp and ff), solo horn, tuba,
  oboe, cor anglais, clarinet, the mixed chorus (men and women), concert harp, glockenspiel, celeste, crotales, tubular chimes, timpani
  (hits in two layers, looped rolls), triangle, bell tree, sleigh bells, wood blocks, shakers, and the Swell Gamba 8' organ stop.
  Stereo recordings stay stereo (sections) or use one microphone channel (the side of the stage the player sits on); nothing is
  equalised: the recordings' own balance is what plays.
  `tools/samples/build.py` reads the library's own SFZ definitions (`tools/samples/sfz.py`) for key ranges,
  root pitches, tuning and volume corrections, start offsets, loop points, round robins and dynamic layers, then trims, level-matches,
  shortens the loops to a memory budget and encodes each sample. Mono instruments are one microphone channel of the stereo recording
  (the side of the stage the section sits on), never the left+right sum: these recordings are wide and nearly uncorrelated, and a sum
  comb-filters them.
- The orchestra core (violin, viola and cello sections, solo contrabass, horn, trumpet, trombone, tuba, flute, oboe, clarinet, bassoon,
  harp, glockenspiel, marimba, bass drum, snare, cymbals, gong, tambourine, claves, anvil, snare taps, field drums, pipe organ):
  **VSCO 2 Community Edition** by Versilian Studios (Sam Gossner, Simon Dalzell;
  sample cutting Elan Hickler), **CC0 1.0** (public domain). Source: https://github.com/sgossner/VSCO-2-CE.
- Analogue ensemble pads and the sub bass: synthesized for this game by `tools/samples/synth.py` (nine-voice stereo unison with
  per-voice drift, a slowly breathing four-pole lowpass, tape-like saturation and a wide three-tap chorus).

Rebuild: `python3 tools/samples/build.py --sso "/path/to/sso/Sonatina Symphonic Orchestra" --vsco /path/to/VSCO-2-CE --out assets/audio`
(needs ffmpeg + numpy; about 6 minutes). `calib.mp3` carries one impulse at 0.100 s so the browser can measure its MP3 decoder delay
and correct the loop points. The whole set (about 32 MB of MP3 at LAME VBR q0) decodes to roughly 380 MB of PCM in the browser; `?samples=0` plays the
procedural fallback instead.
