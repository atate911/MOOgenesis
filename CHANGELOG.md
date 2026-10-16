# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

- Turn flow: prompts the turn waits on (explore/colonise cards, pre-battle choice, battle result) are held on screen and
  re-shown when the galaxy screen is re-entered, so a turn can no longer freeze on a panel nobody can see; the control
  that answers the pending step is highlighted and focused (Enter/Space); load / quit / new game abort a running turn;
  an engine error no longer overwrites the autosave; the "Skip this step" escape appears only when nothing visible can
  answer, and skipped steps take the harmless choice (battles auto-resolve, audiences reject, no bombardment).
- Smoother play: right-click a destination to send the selected fleet at once; "Auto-resolve every battle this game"
  on the pre-battle card; Options for the colony landing scene and a brief one-page news mode; "Waiting for …" in the
  bottom bar during a turn; the control that advances each scene is highlighted and focused; arrow keys work on the
  colony sliders; "Confirm end of turn" checks ships-without-design and unfunded research; "Keep playing" after a
  victory; the Council ruling re-opens instead of auto-accepting if its screen is lost.
- Sim fixes from the October review: an unanswered audience is no longer an acceptance (it could declare war or break an
  alliance); bombardment needs an explicit yes; locking the Tech slider while the Eco floor rises no longer breaks the
  100 % slider sum; dead empires take their fleets with them; bombs hit a planet whose bases are gone; order values are
  validated (negative fleet counts, NaN sliders, bad build keys, transports to the same planet); an invalid tech pick
  falls back to the first choice; failed autosaves are reported.

- World art wired into the game: `js/gfx/worldart.js` lazy-loads the 115 illustrations from `assets/art/*.webp` (webp conversions of the PNG masters in `assets/world-art/`, ~16 MB vs 266 MB). Used for the title galaxy, landing surfaces and ground-battle backdrop, diplomacy audience rooms, research scenes, planet cards, the GNN studio and GNN event stills, and the race-select homeworld card. Every use falls back to the procedural art when an image is missing; `?art=0` disables it.

## 1.0.1 — 2026-10-13

- Install: auto-detect Caddy (`--web caddy|nginx|auto`) so a machine whose ports 80/443 Caddy already owns works; Caddy handles TLS. nginx failures now print the port conflict and the log tail.

## 1.0.0 — 2026-10-13

- First deployable release: playable end to end (see `HANDOFF.md`).
- Server tooling for a home Ubuntu box behind nginx + Let's Encrypt:
  `scripts/install.sh`, `upgrade.sh`, `rollback.sh`, `backup.sh`, `doctor.sh`,
  `uninstall.sh`, a daily doctor timer, and `docs/DEPLOYMENT.md`.
