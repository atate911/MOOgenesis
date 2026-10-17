# Image-generation brief — sprites: 3/4-view hulls, asteroids, missile platform, system skies ("Master of Orion — Reborn")

Paste this whole document to the image-generating AI. It is the **fourth batch**. Unlike the earlier batches these are
**cutouts for the game engine, not scenes**: transparent background (or a flat `#00FF00` green that the build keys out),
no backdrop, no stars, no text, no border. The build (`tools/build-ship-art.py`) crops, scales and recolours them, so
margins and exact size do not matter. **27 images** (41 with the optional variants).

## 1. Look (same as every batch)
Photoreal hard sci-fi, industrial and weathered, physically believable light, restrained filmic grade, subtle grain.
**Not** cartoon, toy, anime, glossy icon. Original designs only — nothing recognisable from any film, game or franchise.

**Negative prompt:** cartoon, anime, cel shading, outline, illustration, toy, plastic, glossy icon, saturated rainbow,
text, watermark, logo, border, background, stars, nebula, planet, lens flare.

## 2. Ship rules (the ones the engine depends on)
- **Neutral grey hull.** Team livery panels in pure magenta `#FF00FF` (15–20 % of the hull, with value shading); the
  engine recolours the magenta to each empire's banner colour at runtime. Engine and running-light emission white-cyan.
- **Key light from the upper left**, soft fill from the right, no coloured rim.
- **Transparent PNG** (preferred) or flat `#00FF00` background. Clean alpha edges. 1536 px on the long side or more.
- **3/4 view** ("beauty angle"): the camera slightly above and to the front-right, the ship's nose pointing to the
  **lower right**, about 30° below the horizontal and 35° off the axis, so the top deck and the right flank are both
  visible. Same angle for every ship so they can be lined up.
- **Attach the matching top-down image** from `MOOg images/fleet-ai-evaluation/` (listed below) and ask for *the same
  ship* seen from the 3/4 angle: same silhouette, same panel layout, same engine count and placement, same livery areas.

## 3. The 27 images

### 3.1 Hull classes, 3/4 view — 9 images (`ship-<class>-3q.png`)
| # | File | Attach as reference | Notes |
|---|---|---|---|
| 1 | `frigate-3q` | `original--01-frigate.png` | small escort, one or two engines |
| 2 | `destroyer-3q` | `revised--02-destroyer.png` | the twin-prong "tuning fork" |
| 3 | `cruiser-3q` | `revised--03-cruiser.png` | the crescent / manta wing |
| 4 | `battleship-3q` | `revised--04-battleship.png` | blocky monolith, turret rows |
| 5 | `doomstar-3q` | `alternatives--05-doomstar-eclipse.png` | reactor drum + emitter dish |
| 6 | `starbase-3q` | `original--06-starbase.png` | eight-arm wheel with solar arrays (structures: view from 30° above, no forward direction) |
| 7 | `battlestation-3q` | `revised--07-battlestation.png` | hexagonal citadel |
| 8 | `star-fortress-3q` | `alternatives--08-star-fortress-crown.png` | gear / crown |
| 9 | `stargate-3q` | `original--09-stargate.png` | ring with the cyan lattice aperture |

Relative sizes do not matter (the engine scales per class). Optional, for a second round: the other 14 variants in
`MOOg images/fleet-ai-evaluation/` and `MOOg images/ship-variants/`, named `<class>-<n>-3q.png` to match.

### 3.2 Asteroids and debris, top-down — 11 images
Purpose: the tactical combat board (seen from directly above). Key light upper left, grey-brown rock, cratered, some with
ice or metal veins; transparent background. 1024 px.
| 10–17 | `rock-1` … `rock-8` | eight distinct asteroid shapes: potato, split, cratered sphere, elongated, cluster of three, flat shard, ice-veined, metallic |
| 18–20 | `debris-1` … `debris-3` | tumbling wreckage fragments: a hull plate with a torn edge, an engine nacelle, a bent truss — neutral grey, scorched |

### 3.3 Missile platform, top-down — 1 image
| 21 | `base-platform` | an orbital missile battery as seen from above: a hardened disc or hexagon with silo covers and radar masts, magenta livery panels, white nav lights; transparent. 1024 px |

### 3.4 Star-system skies — 6 images (16:9, 1920×1080, these DO have a background)
Purpose: the background of the star-system screen. The engine draws the planet itself (lower left, large) and its
readouts (bottom), so the image must contain **no planet** and keep the lower-left quarter calm. The star sits in the
**upper right**, about 12 % of the frame wide, with a soft corona and realistic limb; a faint nebula and star field
behind it, muted.
| 22–27 | `system-sky-yellow`, `-red`, `-green`, `-blue`, `-white`, `-purple` | the star's colour sets the whole sky's tint: yellow warm gold; red deep ember; green (a game colour: a pale green-white star with a green-tinged nebula); blue hot blue-white; white neutral; purple = a neutron star / pulsar, small, violet, with a thin jet or ring |

## 4. Delivery
PNG, exact names above. Put the ship cutouts in `MOOg images/ship-variants/` (the build picks them up by class name),
rocks, debris and the platform in `MOOg images/fx/`, skies in `assets/world-art/system-sky/`. Suggested order: 3.1,
3.2, 3.4, 3.3.
