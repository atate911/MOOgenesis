# assets/audio — sampled instruments for the music engine

`instruments.json` lists the playable instruments as MP3 multisamples (one file per recorded note, one to three dynamic layers,
round robins where repetition would show). `js/audio/sampler.js` loads them lazily after the first click (never from `file://`,
where `fetch` is blocked) and plays them through the same voice graph as the synth voices; every preset keeps a synth fallback,
so the score sounds the way it always did until the files arrive, and on a machine without them.

Provenance
- Orchestra, chorus and percussion: **Sonatina Symphonic Orchestra 2.0** (SSO), created by Mattias Westlund (2011) and developed
  further by Peter Eastman and contributors, released under the **Creative Commons Sampling Plus 1.0** licence
  (https://creativecommons.org/licenses/sampling+/1.0/ — sampling, transforming and redistributing the samples inside another work is
  allowed, commercially or not; the samples may not be used in advertising). Source: https://github.com/peastman/sso.
  Used here: 1st violins, 2nd violins (staccato), violas, celli and basses (sustain, tremolo, staccato, pizzicato), section horns
  (mp and ff), trumpets, trombones and tuba (sustain, staccato), solo horn and trumpet, flutes, solo flute, alto flute, oboe,
  cor anglais, clarinet, bassoon, the mixed chorus (men and women), concert harp, glockenspiel, celeste, crotales, tubular chimes,
  timpani (hits in two layers, looped rolls, crescendo rolls), bass drum, snare, snare roll, piatti, cymbal rolls, tam-tams,
  triangle, tambourine, bell tree, bar chimes, sleigh bells, wood blocks, shakers, and two pipe-organ stops (Swell Gamba 8',
  Great Open Diapason 8'). `tools/samples/build.py` reads the library's own SFZ definitions (`tools/samples/sfz.py`) for key ranges,
  root pitches, tuning and volume corrections, start offsets, loop points, round robins and dynamic layers, then trims, level-matches,
  shortens the loops to a memory budget and encodes each sample.
- Marimba, claves, anvil, snare taps and field drums: **VSCO 2 Community Edition** by Versilian Studios (Sam Gossner, Simon Dalzell;
  sample cutting Elan Hickler), **CC0 1.0** (public domain). Source: https://github.com/sgossner/VSCO-2-CE.
- Analogue ensemble pads and the sub bass: synthesized for this game by `tools/samples/synth.py` (nine-voice stereo unison with
  per-voice drift, a slowly breathing four-pole lowpass, tape-like saturation and a wide three-tap chorus).

Rebuild: `python3 tools/samples/build.py --sso "/path/to/sso/Sonatina Symphonic Orchestra" --vsco /path/to/VSCO-2-CE --out assets/audio`
(needs ffmpeg + numpy; about 6 minutes). `calib.mp3` carries one impulse at 0.100 s so the browser can measure its MP3 decoder delay
and correct the loop points. The whole set (about 21 MB of MP3) decodes to roughly 350 MB of PCM in the browser; `?samples=0` plays the
procedural fallback instead.
