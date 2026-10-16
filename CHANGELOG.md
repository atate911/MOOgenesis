# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

- Fun audit (`tools/handoff/fun-audit-2026-10.md`): the GNN now broadcasts only what the original treats as news (events, wars,
  peace, alliances, eliminations, council, stars reports, rankings) — battles, fleet losses, first contacts and treaties go to the
  archive only (83 → 21 newscasts in a 200-turn game); AI empires' random events reach the news (their headlines were dropped);
  the original's end-of-turn reports are back (population maximum, soil / Gaia / atmosphere projects, planetary shield, stargate,
  grouped fleet production) and stay on the map until the next turn, clicking one selects the colony; exploration and colonise
  cards show the wide planet plate, the planet's special, a line of flavour and mark the star on the map; the battle result card
  no longer clips in the side panel; the map camera keeps the view over the galaxy.
- Deploy/release fixes from the October review: re-running `install.sh` after certbot no longer fails on the http→https
  redirect or resets `tls=no` (it reads domain/email/web from `install.conf`, reuses an unchanged release, and only adds
  `python3-certbot-nginx` for apt certbot, not the snap); `upgrade.sh` refreshes scripts/templates/units/VERSION even
  when the game is unchanged and no longer overwrites itself while running (files are renamed into place; unit files
  via `mktemp`); releases are ordered version-aware (`sort -V`: `v1.0.10` > `v1.0.9`) for prune and rollback; each
  release is stamped with a build id (`window.MOO_BUILD` in `js/manifest.js`, `M.VERSION` from `VERSION`) and
  `js/loader.js` busts with `?v=<build>` instead of a per-load timestamp, so nginx/Caddy now cache fingerprinted css/js
  for a year while `index.html`/`manifest.js` stay `no-cache` (nginx also gets `image/webp` and keeps the security
  headers on `/version.txt`); `backup.sh` saves all of `/etc/letsencrypt` (certificate restorable) and skips the
  release tree; the doctor unit waits for the network and web server; CI checks `VERSION` against `js/core/ns.js`.
- Turn flow: prompts the turn waits on (explore/colonise cards, pre-battle choice, battle result) are held on screen and
  re-shown when the galaxy screen is re-entered, so a turn can no longer freeze on a panel nobody can see; the control
  that answers the pending step is highlighted and focused (Enter/Space); load / quit / new game abort a running turn;
  an engine error no longer overwrites the autosave; the "Skip this step" escape appears only when nothing visible can
  answer, and skipped steps take the harmless choice (battles auto-resolve, audiences reject, no bombardment).
- Immersion: the player's envoy in audiences, the GNN anchor and every photo placed on a scene use a bust-shaped soft
  mask (no square plate edges) and are graded only on their own pixels; the drawn hooded envoy, the throne-room victory
  set with its crown, banners and confetti, and the funeral procession are now fallbacks behind the race council,
  figure and devastated-world illustrations; the colony side panel shows the orbit illustration as the original's
  wide planet box; the galaxy map uses bracket-only selection, glint-style unexplored stars and a soft territory tint.
- Graphics: no synchronous planet or star texture generation on the main thread; shader warm-up never blocks a frame.
- AI: fleets no longer commute between unguarded colonies; the AI stops scrapping live fleets wholesale; planner
  errors are logged (`aiLog`).
- Deployment: installer re-runs keep TLS and read install.conf; atomic script updates; numeric release ordering;
  build-id cache busting with immutable caching for fingerprinted URLs; full certificate directory in backups.
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
