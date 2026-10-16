# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

- Sampled orchestra for the score (`assets/audio/`, 9 MB of MP3 multisamples): string sections (sustain, spiccato, tremolo), horns, trumpet,
  trombone, tuba, flute, harp, pipe organ, timpani, bass drum, snare, cymbals and gong from the CC0 VSCO 2 Community Edition, plus a
  synthesized men’s and mixed choir, analogue ensemble pads and a sub bass (`tools/samples/synth.py`). `js/audio/sampler.js` streams
  them in after the first click and plays them through the engine (loop points corrected by a decoder-delay calibration, velocity
  layers, round robins, per-voice ensemble detune, a three-tap chorus on the pad and choir buses); every preset keeps its synth
  fallback, so `file://` and offline play sound as before. Three new pieces written for the new palette: the main theme (a horn and
  men’s-choir hymn that builds to a full tutti with snare, bass drum and cymbals), a deep-field exploration ambience, and a battle
  cue with spiccato ostinato, low-brass stabs and the theme in the horns; all other tracks are re-orchestrated through the presets.
  Rebuild with `python3 tools/samples/build.py --vsco <VSCO-2-CE checkout> --out assets/audio`.
- Sound effects pass: the most frequent sounds (button click, cancel, panel open/close, new turn, GNN blips, lasers, shield and armour
  hits, small explosions, missiles, gunfire) rotate between two or three takes with small random pitch, level and timing differences so
  they never repeat identically; stingers gain sampled sweeteners once the instrument set is loaded (bass drum, gong, cymbal, harp
  runs, a breath of choir, a low-brass stab under "war declared"); every beam-weapon family has its own voice (laser, rapid-fire
  cannon, mass driver, neutron, phasor/ion, plasma/fusion, disruptor, death ray) chosen by `combat-fx.js`; new cues for a newly
  explored star (`discover`), first contact (`contact`) and the GNN broadcast ident (`gnn_ident`: snare roll, three brass hits, chime);
  the new-turn chime is a soft chord in fifths over a low tap. Levels measured: interface ≈ -30 LUFS, frequent weapons ≈ -22,
  stingers ≈ -13, the music dips 2-5 dB under the stingers.
- Audio: measured pass over the procedural soundtrack and effects (`node tools/audio-report.js`, shared metrics in `tools/lib/audio-metrics.js`, also shown by `tools/test-audio.html`). Fixes: the battle's music-intensity level no longer leaks into the exploration music (tension overlays after a fight); the combat tracks build up with battle damage instead of ignoring intensity; voice pool 32 → 64 (combat1 was refusing notes, crossfades need the room); event stingers and big combat sounds re-trimmed to ≈ -14 LUFS and they duck the music a few dB; fades can no longer throw mid-crossfade; background tabs schedule 2.5 s ahead. New: hostile variants of all ten race themes (`race:<id>:war`, used when the ambassador is angry), a `spy` track for the espionage panels, the galaxy music rotates as a shuffled playlist with a pause between pieces, `Music.snapshot()/restore()` for scenes that borrow the music.
- World art wired into the game: `js/gfx/worldart.js` lazy-loads the 115 illustrations from `assets/art/*.webp` (webp conversions of the PNG masters in `assets/world-art/`, ~16 MB vs 266 MB). Used for the title galaxy, landing surfaces and ground-battle backdrop, diplomacy audience rooms, research scenes, planet cards, the GNN studio and GNN event stills, and the race-select homeworld card. Every use falls back to the procedural art when an image is missing; `?art=0` disables it.

## 1.0.1 — 2026-10-13

- Install: auto-detect Caddy (`--web caddy|nginx|auto`) so a machine whose ports 80/443 Caddy already owns works; Caddy handles TLS. nginx failures now print the port conflict and the log tail.

## 1.0.0 — 2026-10-13

- First deployable release: playable end to end (see `HANDOFF.md`).
- Server tooling for a home Ubuntu box behind nginx + Let's Encrypt:
  `scripts/install.sh`, `upgrade.sh`, `rollback.sh`, `backup.sh`, `doctor.sh`,
  `uninstall.sh`, a daily doctor timer, and `docs/DEPLOYMENT.md`.
