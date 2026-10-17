# Photo ship art (Fleet AI set)

**What:** `Gfx.Ships` now draws pre-rendered hull art from `assets/ships/` for all 9 hull classes, shared by every race.
Each class can have several image **variants**. A ship design gets a stable pseudo-random variant: a hash of
`Ships.designKey(empire, slot, name)` passed as `o.vkey` to `draw()` (or as the 6th argument of `sprite()` / `prewarm()`), or an
explicit `o.variant`. Callers that pass neither get variant 1. Combat, the combat FX, ledgers, side panels and the design
screen pass the key; the design preview re-rolls as the name changes. New variants go in `MOOg images/ship-variants/`
(see the README there).
The livery panels are recolored to the empire's banner color at runtime. The procedural race painters are still there.
They are used until the images load, if a file is missing, or when the art is disabled (`?shipart=0` or `MOO.Gfx.Ships.photos = false`).

**Source:** `MOOg images/fleet-ai-evaluation/` (27 candidates: original / revised / alternatives). Picks, chosen for a distinct
silhouette per class at 48–64 px and a frigate→doomstar progression that reads clearly:

| Class | File | Why |
|---|---|---|
| Frigate | `original--01-frigate.png` | Clean small escort; the hammerhead alternative reads too heavy for the smallest class |
| Destroyer | `revised--02-destroyer.png` | Twin-prong "tuning fork": unmistakable at icon size |
| Cruiser | `revised--03-cruiser.png` | Crescent/manta wing: very different from the long hulls around it |
| Battleship | `revised--04-battleship.png` | Blocky monolith: reads as heavy |
| Doomstar | `alternatives--05-doomstar-eclipse.png` | Reactor drum + emitter dish: a planet-killer, not a longer battleship |
| Starbase | `original--06-starbase.png` | Eight-arm wheel with solar arrays |
| Battlestation | `revised--07-battlestation.png` | Solid hexagonal citadel: no confusion with the starbase wheel |
| Star Fortress | `alternatives--08-star-fortress-crown.png` | Gear/crown: distinct from the stargate ring |
| Stargate | `original--09-stargate.png` | Ring with a cyan lattice; the animated event horizon fits its aperture |

**Pipeline:** `python3 -I tools/build-ship-art.py [DIR ...]` (needs Pillow and numpy) collects images per class by filename
from `MOOg images/fleet-ai-evaluation/` and `MOOg images/ship-variants/`, skips near-duplicates, and makes the pick in the
table above variant 1 (23 distinct variants today: 2–3 per class). Combat orbital bases vary per planet (`vkey: 'planet|<id>'`). It keys out flat green
backgrounds, re-crops, downscales (1024 px long side) and splits
each variant into `ship-<class>-<n>.webp` (neutral grey; the magenta replaced by its own brightness) and `ship-<class>-<n>-team.webp`
(white, alpha = livery weight). It also detects engine nozzles and samples hardpoints, damage sites and nav lights. It writes
`assets/ships/ship-art.json` and the generated `SHIP_ART` block in `js/gfx/ships.js`. To change a fallback design, edit `DEFAULT_PICKS` and rerun.

**Runtime:** the base image is drawn, then the team mask filled with the banner color is composited with `multiply`. Add-on
modules (colony pod, troop pods, bomb bay) are still vector-painted on the art's hardpoints. Engine flames, lights,
damage, shields and cloak use the existing dynamic layers. The lighting is baked into the art, so one bake serves every
heading (no light buckets). Pixels are never read back, so this works from file://.

**Second view (October 2026, code ready, art pending):** `docs/IMAGE-GEN-SPRITES.md` asks for a 3/4 cutout of each of the
nine picks above. The build takes any source whose name contains the class and the token `3q` (`frigate-3q.png`,
`frigate-2-3q.png` for variant 2; one image per class serves every variant), keys / crops / splits it the same way, writes
`ship-<class>-<n>-3q.webp` + `-3q-team.webp` and records `q: {ext, hw, hl, eng, lights, sites, dir}` on the variant.
Units for the 3q view: the longer visible side = 1. Engines: white-cyan blobs whose projection on the ship axis (nose to
the lower right, `Q_AXIS_DEG` = 30° below the horizontal) lies in the rear 40 %; the nozzle is the blob's rear edge along
that axis; `dir` (radians, 210°) is the direction the flames point. `Gfx.Ships.draw / sprite / prewarm` take
`view: '3q'` (also `vo.view`); the 3q render is never rotated, only mirrored when the heading points left (`cos(angle) < 0`,
which also mirrors the baked key light), engine flames and lights come from `q`, hardpoints are the top view's stretched
to the 3q extents (callouts only), the vector add-on modules (pods, bomb bay) are not drawn on it, and while the images
are missing or loading the call falls back to the top view. `Ships.hasView(hull, '3q')` / `photoReady(hull, '3q')` tell
callers which path is live. Wired: design hologram + library thumbs, GNN ship graphics, the pre-battle card; other
screens pass `view: '3q'` from their own modules. Verified with a synthetic 3q frigate (rotated top view) in the
sandbox; no 3q art is in the repo yet, so today's output is byte-identical to before.

**Known limits:** races no longer differ by silhouette, only by color. The art's lighting rotates with the ship. Hardpoints
are sampled from the alpha mask, not hand-placed. `assets/ships` is in `MOO_DEPLOY_PATHS`.
