# Photo ship art (Fleet AI set)

**What:** `Gfx.Ships` now draws pre-rendered hull art from `assets/ships/` for all 9 hull classes, shared by every race.
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

**Pipeline:** `python3 -I tools/build-ship-art.py` (needs Pillow and numpy) re-crops, downscales (1024 px long side) and splits
each pick into `ship-<key>.webp` (neutral grey; the magenta replaced by its own brightness) and `ship-<key>-team.webp`
(white, alpha = livery weight). It also detects engine nozzles and samples hardpoints, damage sites and nav lights. It writes
`assets/ships/ship-art.json` and the generated `SHIP_ART` block in `js/gfx/ships.js`. To swap a design, edit `PICKS` and rerun.

**Runtime:** the base image is drawn, then the team mask filled with the banner color is composited with `multiply`. Add-on
modules (colony pod, troop pods, bomb bay) are still vector-painted on the art's hardpoints. Engine flames, lights,
damage, shields and cloak use the existing dynamic layers. The lighting is baked into the art, so one bake serves every
heading (no light buckets). Pixels are never read back, so this works from file://.

**Known limits:** races no longer differ by silhouette, only by color. The art's lighting rotates with the ship. Hardpoints
are sampled from the alpha mask, not hand-placed. `assets/ships` is in `MOO_DEPLOY_PATHS`.
