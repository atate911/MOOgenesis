# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

- Audio: measured pass over the procedural soundtrack and effects (`node tools/audio-report.js`, shared metrics in `tools/lib/audio-metrics.js`, also shown by `tools/test-audio.html`). Fixes: the battle's music-intensity level no longer leaks into the exploration music (tension overlays after a fight); the combat tracks build up with battle damage instead of ignoring intensity; voice pool 32 → 64 (combat1 was refusing notes, crossfades need the room); event stingers and big combat sounds re-trimmed to ≈ -14 LUFS and they duck the music a few dB; fades can no longer throw mid-crossfade; background tabs schedule 2.5 s ahead. New: hostile variants of all ten race themes (`race:<id>:war`, used when the ambassador is angry), a `spy` track for the espionage panels, the galaxy music rotates as a shuffled playlist with a pause between pieces, `Music.snapshot()/restore()` for scenes that borrow the music.
- World art wired into the game: `js/gfx/worldart.js` lazy-loads the 115 illustrations from `assets/art/*.webp` (webp conversions of the PNG masters in `assets/world-art/`, ~16 MB vs 266 MB). Used for the title galaxy, landing surfaces and ground-battle backdrop, diplomacy audience rooms, research scenes, planet cards, the GNN studio and GNN event stills, and the race-select homeworld card. Every use falls back to the procedural art when an image is missing; `?art=0` disables it.

## 1.0.1 — 2026-10-13

- Install: auto-detect Caddy (`--web caddy|nginx|auto`) so a machine whose ports 80/443 Caddy already owns works; Caddy handles TLS. nginx failures now print the port conflict and the log tail.

## 1.0.0 — 2026-10-13

- First deployable release: playable end to end (see `HANDOFF.md`).
- Server tooling for a home Ubuntu box behind nginx + Let's Encrypt:
  `scripts/install.sh`, `upgrade.sh`, `rollback.sh`, `backup.sh`, `doctor.sh`,
  `uninstall.sh`, a daily doctor timer, and `docs/DEPLOYMENT.md`.
