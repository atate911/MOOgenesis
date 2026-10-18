# Image-generation prompts — 3/4-view ships and combat pieces ("Master of Orion — Reborn")

Full copy-paste prompts for priority items 1 and 2 in `ART-NEEDED.md`. They supersede the short tables in
`docs/IMAGE-GEN-SPRITES.md` §3.1–3.3.

---

## 1. Ships, 3/4 view — 9 images

**How to use.** Paste the shared prompt (§1.1). Then replace its last line with the ship's block from §1.2. Attach the
listed reference image from `MOOg images/fleet-ai-evaluation/`, which is the top-down render of the same ship.
Generate one image per ship.

**Drop-in.** Put the PNGs in `MOOg images/ship-variants/` with the exact file names below, then run
`python3 -I tools/build-ship-art.py`. It keys out the background, crops, and splits the magenta into the empire-colour
mask.

### 1.1 Shared prompt

```
Use case: game sprite cutout. ONE ship, isolated, for the science-fiction strategy game "Master of Orion — Reborn".

The attached image is the top-down render of this exact ship. Recreate THE SAME SHIP seen from a 3/4 angle:
identical silhouette and proportions, the same panel layout, the same number and placement of engines, turrets
and modules, and the magenta livery panels in the same places. Do not redesign, simplify, or add parts.

Camera: the 3/4 "beauty" view. The camera is above and in front of the ship's right side; the ship's nose points
to the LOWER RIGHT of the frame, about 30 degrees below horizontal and about 35 degrees off the camera axis, so the
top deck and the right flank are both visible. Gentle perspective (85 mm lens), no fisheye. The whole ship is in
frame with a small margin, nothing cropped, filling about 80% of the image width.

Materials: photoreal hard science fiction, industrial and weathered. Neutral mid-grey hull plating with no colour
tint, panel seams, small surface detail, scorching and wear around the engines. Team livery panels in PURE MAGENTA
#FF00FF exactly where the reference has them (about 15-20% of the hull), shaded by the same light and shadow as
the hull but never shifted toward red, purple or pink. Engines and running lights glow white-cyan and stay inside
the nozzles; no long exhaust plumes.

Light: key light from the upper left, soft fill from the right, no coloured rim light. Shadows fall only on the
ship itself.

Background: transparent PNG with clean alpha edges. If transparency is not possible: a perfectly flat #00FF00
green with no gradient and no shadow on it, and no green anywhere on the ship.

Output: one PNG, at least 1536 px on the long side.

Avoid: background scenery, stars, nebula, planets, other ships, text, numbers, logos, insignia, watermark, border,
a cast shadow on the background, motion blur, lens flare, exhaust trails, cartoon, toy, plastic, glossy CG render,
cel shading, magenta anywhere except the livery panels.

This ship: <paste the ship's block here>
```

### 1.2 Ship blocks

| # | Save as | Attach |
|---|---|---|
| 1 | `frigate-3q.png` | `original--01-frigate.png` |
| 2 | `destroyer-3q.png` | `revised--02-destroyer.png` |
| 3 | `cruiser-3q.png` | `revised--03-cruiser.png` |
| 4 | `battleship-3q.png` | `revised--04-battleship.png` |
| 5 | `doomstar-3q.png` | `alternatives--05-doomstar-eclipse.png` |
| 6 | `starbase-3q.png` | `original--06-starbase.png` |
| 7 | `battlestation-3q.png` | `revised--07-battlestation.png` |
| 8 | `star-fortress-3q.png` | `alternatives--08-star-fortress-crown.png` |
| 9 | `stargate-3q.png` | `original--09-stargate.png` |

1. **Frigate**
   ```
   The Frigate, the smallest warship: a slim dart-shaped escort with a pointed nose, a narrow central spine, and two
   engine pods side by side at the stern; magenta stripes along both pods.
   ```
2. **Destroyer**
   ```
   The Destroyer, the "tuning fork": two long, thin, parallel prongs reaching forward from a compact rear hull block,
   each prong ending at the stern in a large round engine; magenta panels along both prongs. Keep the prongs' full
   length and the gap between them.
   ```
3. **Cruiser**
   ```
   The Cruiser, an arrowhead or manta wing: a sharply swept-back chevron hull with the point forward and the wing tips
   trailing back, a row of engines along each trailing edge, and magenta chevron panels on top of the wings.
   ```
4. **Battleship**
   ```
   The Battleship, a blocky armoured monolith: a long rectangular hull, three square turret blocks in a row along the
   spine, a bank of four large engines across the stern, and magenta bands wrapped across the hull.
   ```
5. **Doomstar**
   ```
   The Doomstar, the super-weapon: a massive round reactor drum amidships with radial armour ribs and magenta
   segments, a cluster of four engines behind it, and a forward boom ending in a curved emitter dish that glows
   blue-white at the bow.
   ```
6. **Starbase** (a station, so it replaces the camera paragraph)
   ```
   The Starbase, a space station with no front or back: a central hub ringed with magenta segments, and eight radial
   arms each ending in a module with a pair of dark solar panels. Camera override: look down at the station from
   about 30 degrees above its plane, so the whole wheel is visible as an ellipse with its top face and rim showing;
   keep the reference's rotation.
   ```
7. **Battlestation** (station)
   ```
   The Battlestation, a space station with no front or back: a six-pointed star fortress with a hexagonal armoured
   core, a magenta triangular panel on each point, and gun turrets along the edges. Camera override: look down from
   about 30 degrees above its plane so the top face and the thick rim are both visible.
   ```
8. **Star Fortress** (station)
   ```
   The Star Fortress, a space station with no front or back: a six-lobed crown or gear-shaped ring around an open
   central hole, domed turrets on each lobe, and a magenta band around the inner ring. The centre hole is open: the
   background shows through it. Camera override: look down from about 30 degrees above its plane.
   ```
9. **Stargate** (structure)
   ```
   The Stargate: a thick armoured ring with magenta blocks spaced around its outer face and glowing cyan energy
   lattice segments lining the inside of the ring. The aperture is open: the background shows through it, with no
   swirl or portal effect. Camera override: seen from about 30 degrees off its face, so the ring reads as an ellipse
   and its thickness shows.
   ```

### 1.3 Check before accepting
- [ ] It's the same ship as the reference: silhouette, engine count and livery areas match.
- [ ] Mobile ships point to the lower right, with both the top and the right flank visible.
- [ ] The livery is pure magenta, and there's no magenta or green anywhere else.
- [ ] The background is clean (transparent or flat green), with no shadow on it, no stars and no text.
- [ ] Engines glow but don't trail.

---

## 2. Combat pieces — rocks, debris, missile platform (12 images in 2 prompts)

What the game does with them (`js/ui/combat-fx.js`):
- **Drawn as delivered.** Rocks, debris and the platform go on the board straight from the files, with no keying or
  recolouring, so they need **real transparency**.
- **Spun to random angles.** Every piece is rotated, so the light has to come from nearly **overhead**. Side lighting
  would point the wrong way most of the time.
- **Small on screen.** They show at roughly **40–120 px**, so a strong silhouette and mid-tone values matter more than
  fine detail.
- **Rocks and debris come as one sheet.** One prompt makes all eleven, which keeps them consistent; I cut the sheet
  into `rock-1` … `rock-8` and `debris-1` … `debris-3`.
- **The platform gets no magenta.** The game draws a pulsing glow in the empire's colour at its right edge instead.

**Drop-in.** Put the files in `MOOg images/fx/` and I'll cut and convert them into `assets/art/fx/`. The game uses
them as soon as they're present.

### 2.1 Prompt: asteroid and wreckage sheet (11 pieces), save as `fx-sheet.png`

```
Use case: game sprite sheet for the tactical combat board of the science-fiction strategy game "Master of
Orion — Reborn". ONE square image, 2048x2048, containing 11 separate objects on a TRANSPARENT background.

Layout: an even 4-column by 3-row grid. Each object sits alone in the centre of its own cell, about 65% of the
cell's size, with generous empty space around it; no object touches or overlaps another or the image edge. The
last cell (row 3, column 4) is empty.

Rows 1 and 2, eight distinct asteroids, each with a clearly different outline:
 1. a lumpy potato shape
 2. a rock split by a deep crack into two halves still touching
 3. a near-spherical rock covered in craters
 4. a long, elongated shard-like rock
 5. a tight cluster of three small rocks touching
 6. a flat, angular slab
 7. a dark rock with veins of pale blue-white ice
 8. a metallic iron-nickel rock with dull bronze-grey metal showing through
Row 3, three pieces of spaceship wreckage:
 9. a torn hull plate with a jagged, buckled edge and exposed ribs
 10. a broken engine nacelle with a cracked nozzle
 11. a bent structural truss with snapped struts
The wreckage is neutral grey metal, scorched black at the tears, with a faint orange ember glow along the freshest
torn edges; no colour livery.

Camera: straight down from directly above, orthographic, no perspective tilt.

Light: soft light from almost directly overhead (very slightly from the upper left), gentle form shading only, no
long shadows and no strong one-sided highlight. Every piece will be rotated to random angles in the game, so its
lighting must look right at any rotation.

Look: photoreal, physically plausible materials. Asteroids are grey-brown cratered stone with fine regolith dust,
in mid-tone values (not black) with a slightly lighter edge so they read against a dark starfield. Objects appear
small in the game (60-120 pixels), so each needs a bold, readable silhouette with detail that survives shrinking.

Background: fully transparent with clean alpha edges. If transparency is not possible: perfectly flat #00FF00
green, with no shadows on it and no green in the objects.

Avoid: stars, space background, planets, glow halos around rocks, cast shadows on the background, text, numbers,
grid lines, labels, borders, cartoon, illustration, low-poly, clay, toy, plastic, glossy CG, magenta.
```

### 2.2 Prompt: orbital missile platform (1 piece), save as `base-platform.png`

```
Use case: game sprite cutout for the tactical combat board of the science-fiction strategy game "Master of
Orion — Reborn". ONE object, an orbital missile battery, seen straight from above, on a TRANSPARENT background.
Square image, 1024x1024, the object centred and filling about 75% of the frame.

The object: a hardened hexagonal defence platform, with a raised armoured core in the middle, six circular missile
silo hatches around it (two of them open, showing a missile tip inside), a short radar mast with a dish, and two
small stubby heat-radiator fins. On its RIGHT edge (3 o'clock) is a small dark glass beacon lens; the game adds a
coloured glow there, so it must stay dark and empty. Neutral gunmetal-grey armour, worn and weathered, small white
navigation lights at three of the corners. NO coloured paint or livery; no magenta.

Camera: straight down, orthographic, no tilt.

Light: soft light from almost directly overhead, gentle form shading, no long shadows. The game rotates the
platform as it orbits, so the lighting must look right at any rotation.

Readability: shown small in the game (30-50 pixels), so it needs a bold, simple hexagonal silhouette with clear
light/dark structure; fine detail is secondary.

Look: photoreal hard science fiction, industrial, physically plausible materials.

Background: fully transparent with clean alpha edges. If transparency is not possible: perfectly flat #00FF00
green, with no shadow on it and no green on the object.

Avoid: planet, stars, space background, glow halos, exhaust, cast shadow on the background, text, numbers,
insignia, logos, border, cartoon, toy, plastic, glossy CG, coloured paint.
```

### 2.3 Check before accepting
- [ ] The background is truly transparent, or flat green.
- [ ] Rocks: eight clearly different outlines, none touching, mid-grey-brown (not black). Debris: three distinct pieces.
- [ ] Everything is lit from above; nothing looks wrong when you rotate it by eye.
- [ ] The platform is hexagonal and grey with no colour, with a dark lens at its right edge.
- [ ] There is no text and no grid lines.
- [ ] At thumbnail size (shrink the image to about 100 px), each piece still reads clearly.
