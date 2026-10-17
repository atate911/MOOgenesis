# Graphics pass 3 — finishing the object layer (plan)

Input: `tools/handoff/graphics-inventory-2026-10.md` (what is still flat or procedural, with screenshots from
`tools/qa/art-shots.js`). The character/scene layer is done; this pass finishes ships, the battlefield, the system view,
the map glyphs and the flat markers, and it consumes the delivered-but-unused plates.

## Do we need more rendered graphics?

Yes, but a bounded set, and most of it is already written up. `docs/IMAGE-GEN-OTHER.md` (60 images: ships, tech headers,
battle backdrops, monsters, ground war, endings, installations, UI textures) was never generated — nothing from it is in
`assets/`. Its ship entries are cinematic 16:9 *stills* (ship + background), which are right for cards and the design
hologram but cannot replace the *sprites* that the lander, the bombard scene, the exile ending, the title fly-by and the
combat grid draw: those need cutouts with the magenta livery mask that `tools/build-ship-art.py` recolours per empire.
So the art ask is in two parts:

| Part | What | Count | Brief |
|---|---|---|---|
| **A — sprites (new brief)** | 3/4-view cutouts of the nine hull classes already chosen (same ships as the top-down set), asteroid and debris cutouts, a missile-platform cutout, six star-system skies without a planet | 9 + 11 + 1 + 6 = **27** (ideal: +14 ship variants = 41) | `docs/IMAGE-GEN-SPRITES.md` |
| **B — stills (existing brief, trimmed)** | battle backdrops 26–30, exile ending 48, spaceport 52 (build box), title key art 41; later the tech headers 20–25 | **8** now, 6 later | `docs/IMAGE-GEN-OTHER.md` §4.3, §4.7, §4.8 |

Everything else in the inventory is code work with art that already exists. The rest of the 60-image brief (flagships,
monsters, installations, UI textures) is still worth having but is not what makes the game look cartoonish today; hold it.

## Phase 0 — code only, no new art (start now, one session)

Each item names its file and the plate it uses. Acceptance is a re-run of `node tools/qa/art-shots.js` (both tiers).

1. **Galaxy map unexplored stars** (`js/ui/galaxymap.js`): draw unexplored stars with the same `Gfx.Space.starSprite`
   family as explored ones at ~60 % size and brightness, blackbody tint, no dotted ring (the ring moves to hover only).
   Keep the existing bracket reticle and territory tint. Result: the map reads as lit points at every zoom.
2. **Title wordmark** (`js/ui/menu.js` CSS): layered metallic treatment — a steel-to-gold vertical gradient clipped to
   the text, a 1 px bright bevel (text-shadow stack), a dark extrusion of 4–6 steps, the existing sweep highlight on top.
   No asset.
3. **Exile ending interim** (`js/ui/endings.js paintExile`): `scene-galaxy` plate as the backdrop with a slow push-out,
   the player's race `homeworld` plate shrinking into the distance, the ship as a dark silhouette with engine glow. The
   `end-exile` still from part B replaces the backdrop when it lands; the ship switches to the 3/4 sprite in Phase 1.
4. **Invasion troop markers** (`js/ui/landing.js soldierSprite`): render the figures as photo-treated silhouettes —
   near-black fill, warm rim from the battlefield's key light, contact shadow, 2 % grain, 40 % size — and cap the visible
   count (readout carries the number). No flat vector over the plate.
5. **Bombard overlay** (`js/ui/landing.js` bombard): shield as an additive limb glow that follows the planet's edge
   (radial gradient, banner-tinted), reticle as a lit sprite with bloom; drop the dotted circle.
6. **Combat screen, cheap wins** (`js/ui/combat-fx.js`): selection frame brick red (`#b0303a`, restyle note); grid lines
   only within two cells of the cursor and around the selected unit; missile bases as a lit ring sprite instead of orange
   gears; planet limb glow (same gradient as 5); backdrop: use the `system-<colour>` plate scaled so its own planet is
   off-frame, until the battle backdrops from part B arrive.
7. **System view** (`js/ui/system.js`): until the planet-free skies from part A arrive, place the `system-<colour>` plate
   as the far layer cropped so its planet sits behind the live GL planet, and take the sun from the plate (hide the
   procedural disc). On the GL path, fix the star shader's limb darkening and granulation contrast (`gl-planets.js`);
   this is what the title and map also use.
8. **Consume unused plates**: Planets ledger row thumbnail = `orbit-*` crop (`ledger-planets.js`); Fleets ledger
   thumbnail = the same; event cards show the matching `event-*` plate above the text (`landing.js UI.Events.show`);
   Races "Not Present" slabs show the player's `homeworld-square` dimmed (`races.js`); colony side panel build box uses
   `colony-industrial` darkened behind the design sprite (`side-colony.js`) until `inst-spaceport` arrives.
9. **Tech picture pane** (`js/ui/tech.js TechArt`): keep the blueprint, but draw the ship as the 3/4 sprite once Phase 1
   lands; optional later: the six `tech-*` headers behind the blueprint.

## Phase 1 — ships and rocks (after part A lands, one session)

1. `tools/build-ship-art.py`: accept a second view per class (`*-beauty*` filenames or a `3q/` folder), key, crop,
   mask and sample the same way, write `ship-<class>-<n>-3q.webp` + `-3q-team.webp` and a `views` entry in `SHIP_ART`.
2. `js/gfx/ships.js`: `o.view = 'top' | '3q'` on `draw()` / `sprite()`; `3q` ignores `o.angle` (or mirrors for
   left/right), engine glow and lights come from the 3/4 sample points; procedural fallback stays the top-down painter.
3. Consumers switch to `3q`: design hologram (`design.js`), fleet/system/pre-battle cards (`ledger-fleets.js`,
   `system.js`, `combat.js`), lander and bombers (`landing.js`), title fly-by (`menu.js`), exile ending, GNN ship
   graphic (`gnn.js`). Combat grid and map glyphs keep `top`.
4. Asteroids: `combat-fx.js rockSprite` loads `assets/fx/rock-<n>.webp` (8 rocks, 3 debris), random variant per rock
   seed, slow spin kept; the procedural blob stays as the fallback.
5. Missile bases: `assets/fx/base-platform.webp` ringed around the planet, banner-tinted.
6. System view skies: `assets/art/system-sky/*.webp` replace the Phase 0 crop.

## Phase 2 — combat and ambience (code, one to two sessions)

Per `research/09-art-direction.md` §2.6 and the immersion review Phase C: HDR-ish beams, four-stage explosions,
missile plumes, shockwave on kills, camera nudge; battle backdrops 26–30 behind the grid with slow parallax; map
ambience (1 Hz twinkle, drifting dust, fleet trails, 160 ms panel reveals). Then the real-hardware check that is still
owed: `tools/test-hw.html?auto=1` on an iGPU and a dGPU, F3 overlay numbers into `tools/handoff/graphics-v2.md`.

## Phase 3 — housekeeping

Move the PNG masters (`assets/world-art/`, `MOOg images/`, `Race photos/`, ~330 MB) to git-lfs or an assets-source
repo; keep only the shipped webp in the main tree (review item 44). Do it after the next art drop so it happens once.

## Order and dependencies

Phase 0 and the art generation run in parallel. Phase 1 needs part A (ships + rocks + skies). Phase 2 needs nothing
from the art except the five battle backdrops (part B), and can start after Phase 0. Phase 3 last.
