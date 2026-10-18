# Art needed

The code for graphics pass 3 is in place and every screen below already asks for these files; until they exist each
screen keeps its fallback (top-down ships, procedural rocks, the system plate, the galaxy plate). Tick a row when the
file is in the tree. Briefs: `docs/IMAGE-GEN-SPRITES.md` (batch 4, cutouts and skies) and `docs/IMAGE-GEN-OTHER.md`
(batch 3, cinematic stills; only the rows listed here are needed now). Plan: `briefs/graphics-pass-3.md`.

## How to drop art in

| Kind | Put the generated PNG in | Then | Served from |
|---|---|---|---|
| Ship 3/4 cutouts | `MOOg images/ship-variants/` | `python3 -I tools/build-ship-art.py` (needs Pillow + numpy) | `assets/ships/ship-<class>-<n>-3q.webp` (+ `-team`) |
| Rocks, debris, base platform | `MOOg images/fx/` | `convert x.png -quality 85 -define webp:method=4 assets/art/fx/x.webp` (keep alpha) | `assets/art/fx/` |
| System skies | `assets/world-art/system-sky/` | same `convert`, into `assets/art/system-sky/` | `assets/art/system-sky/` |
| Battle backdrops | `assets/world-art/battle/` | same `convert`, into `assets/art/battle/` | `assets/art/battle/` |
| Stills (exile, spaceport, title) | `assets/world-art/still/` | same `convert`, into `assets/art/still/` | `assets/art/still/` |

Paths are resolved in `js/gfx/worldart.js` (`systemSky`, `battle`, `fx`, `still`) and `js/gfx/ships.js` (`view: '3q'`).
Check the result with `node tools/qa/art-shots.js` (and `TIER=medium`): a missing file shows as one 404 in the log.

## Batch 4 — sprites and skies (`docs/IMAGE-GEN-SPRITES.md`), 27 files

Full prompts for the ships, rocks, debris and platform: `docs/IMAGE-GEN-SHIPS-AND-COMBAT.md`.

### Ship hulls, 3/4 view (9) — unlock: design hologram, fleet/system/pre-battle cards, lander, bombers, title fly-by, exile ending, GNN ship graphic, tech blueprint
- [x] `frigate-3q.png` (reference: `MOOg images/fleet-ai-evaluation/original--01-frigate.png`)
- [x] `destroyer-3q.png` (`revised--02-destroyer.png`)
- [x] `cruiser-3q.png` (`revised--03-cruiser.png`)
- [x] `battleship-3q.png` (`revised--04-battleship.png`)
- [x] `doomstar-3q.png` (`alternatives--05-doomstar-eclipse.png`)
- [x] `starbase-3q.png` (`original--06-starbase.png`)
- [x] `battlestation-3q.png` (`revised--07-battlestation.png`)
- [x] `star-fortress-3q.png` (`alternatives--08-star-fortress-crown.png`)
- [x] `stargate-3q.png` (`original--09-stargate.png`)
- [ ] optional, later: `<class>-<n>-3q.png` for the other 14 top-down variants so every design's two views match

### Asteroids and debris, top-down cutouts (11) — unlock: combat board rocks and kill debris
- [x] `rock-1.png` … `rock-8.png` (eight distinct shapes; cut from `MOOg images/fx/fx-sheet.png`)
- [x] `debris-1.png` … `debris-24.png` (24 wreckage pieces from two sheets; the game picks one at random per fragment)

### Missile platform (1) — unlock: missile bases around the planet on the combat board
- [x] `base-platform.png` (the empire-colour glow sits on its beacon lens, right edge)

### Star-system skies, 16:9, no planet (6) — unlock: the system screen backdrop with the star upper-right
Detailed prompts + layout guide: `docs/IMAGE-GEN-COUNCIL-AND-SKIES.md` §2.
- [x] `system-sky-yellow.png`
- [x] `system-sky-red.png`
- [x] `system-sky-green.png`
- [x] `system-sky-blue.png`
- [x] `system-sky-white.png`
- [x] `system-sky-purple.png`

## Council chamber (`docs/IMAGE-GEN-COUNCIL-AND-SKIES.md` §1), 1 file — unlock: a photoreal Galactic Council hall
- [x] `scene-council-chamber.png` — delivered and wired in (`Scenes.council` draws it with the race photos in its alcoves; alcove map
      `CPLATE` in `js/gfx/scenes.js`). A replacement image needs its alcoves re-measured into `CPLATE`.

## Batch 3 — stills (`docs/IMAGE-GEN-OTHER.md`), 8 files now

### Battle backdrops §4.3 (5) — unlock: combat board backdrop per battle kind
- [ ] `battle-planet.png` (#26)
- [ ] `battle-nebula.png` (#27)
- [ ] `battle-asteroids.png` (#28)
- [ ] `battle-star.png` (#29)
- [ ] `battle-deep.png` (#30)

### Stills — unlock: exile ending backdrop, colony build box, title backdrop
- [ ] `end-exile.png` (#48)
- [ ] `inst-spaceport.png` (#52)
- [ ] `title-key-art.png` (#41; not wired yet, the title uses `scene-galaxy` until then)

### Later (not needed to remove the last procedural art)
- [ ] tech field headers `tech-*` (#20–25) behind the blueprint pane
- [ ] the remaining batch-3 rows (flagships, monsters, ground war, installations, UI textures)

## After the drop
Run `node tools/qa/art-shots.js` on both tiers and compare with `tools/handoff/graphics-inventory-2026-10.md`; then
Phase 3 of the plan (move the PNG masters out of git) can happen in one go.
