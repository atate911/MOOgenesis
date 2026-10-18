# Image-generation brief — Galactic Council chamber + star-system skies ("Master of Orion — Reborn")

Seven images: **one council chamber** (§1) and **six star-system skies** (§2). Each section has a copy-paste prompt
block, a layout guide to attach, and an acceptance checklist. The skies replace §3.4 of `docs/IMAGE-GEN-SPRITES.md`
(same files, more detailed prompts).

Layout guides (attach the plain one to the generator, and keep the annotated one for checking the result):

| Image | Attach to the generator | Annotated (for you) |
|---|---|---|
| Council chamber | `docs/art-guides/council-chamber-layout.png` | `docs/art-guides/council-chamber-layout-annotated.png` |
| System skies | `docs/art-guides/system-sky-layout.png` | `docs/art-guides/system-sky-layout-annotated.png` |

The plain guides have no text in them on purpose, because generators copy any lettering they see.

---

## 1. Galactic Council chamber — `scene-council-chamber.png`

### 1.1 What the game does with it

The council screen currently draws its chamber with vector shapes (`js/gfx/scenes.js`, `Scenes.council`) and pastes
the race photos into flat arches. This plate replaces the drawn chamber. The game draws these on top of it:

- **The delegates.** Each seated empire's leader photo (`assets/races/race-<id>-portrait.webp`) is composited into an
  **alcove**. The photos are square head-and-shoulders portraits, face slightly right of centre at about 36 % from
  the top, lit from the left, on dark studio backgrounds. The game feathers their edges, clips them to the alcove
  opening, grades them to the alcove's light and stands them on the lectern so the cut at the chest is hidden.
  This is why the alcoves must be **empty, near-black, evenly dark and seen head-on**.
- **The hologram.** A rotating galaxy hologram and, when someone speaks, a cyan hologram bust of the speaker, rise
  from the **emitter disc** on the central pedestal. The space above the pedestal must be dark and empty, because the
  hologram is drawn additively and only shows against dark.
- **Per-seat effects.** A gem in the empire's banner colour at each arch keystone, the delegate's name and vote count
  on each **plaque** (an HTML label), and a gold glow around the arch of whoever is speaking or has won.
- **The UI.** The vote-tally band across the top ~13 % and the ballot cards across the bottom ~30 % (the game shades
  that band). Both bands must be low-detail.

There are always **six alcoves** in the image. A council has 2–6 empires, and unused alcoves are left vacant (the
game darkens them a little further). A vacant seat reads well in-story: an empire that has fallen.

### 1.2 Layout (fractions of the 16:9 frame, see the guide)

| Element | Where | Notes |
|---|---|---|
| Alcoves 1–6 | centres at x = 11 %, 23.5 %, 36 %, 64 %, 76.5 %, 89 % | three left of centre, three right, mirror-symmetric |
| Alcove opening | 9.5 % of frame width wide; round arch top, crown at y ≈ 25 %, arch springs at y ≈ 33.5 %; straight vertical sides | all six the **same size and shape**; openings face the camera (outer ones turned ≤ 15°) |
| Lectern / balustrade | across the bottom of each opening, **top edge perfectly straight and horizontal at y ≈ 53 %**, front face down to y ≈ 66 % | hides where the photo ends; the straight edge lets the game clip cleanly |
| Plaque | on each lectern front, y ≈ 58.5–63.5 %, ~7 % of frame width wide | **blank**, plain brushed metal, no text or symbols |
| Keystone | top of each arch | plain stone or metal; the game adds the coloured gem |
| Central pedestal | centred, emitter disc top at y ≈ 60 %, ~14 % of frame width across | the emitter is a dark glass disc ringed with faint cyan, **no hologram, no object on it** |
| Hologram space | x 42.5–57.5 %, y 15–58 % | dark, empty air with a distant, shadowed back wall; nothing bright |
| Top band | y 0–13 % | dome rim and a softly glowing oculus, subdued (no blown-out white) |
| Floor | y > 66 % | a stepped circular dais and a dark polished floor, calm and low-contrast |
| Crop safety | keep all alcoves inside x 5–95 % | the image is cover-cropped on 16:10 screens; let the architecture run past the frame edges |

**Camera:** eye level at a standing delegate's head height, looking straight at the centre of the room, no tilt, a
normal (35–50 mm) lens. One-point perspective with the vanishing point at the pedestal. The alcoves sit on a
**shallow** curve (the chamber is a wide rotunda), so all six openings are seen nearly face-on. A steep curve would
show the side alcoves at an angle the frontal photos can't match.

**Light:** warm amber lamplight from high on the left and from the oculus above, so faces composited later read as lit
from the same direction as the photos. A faint cool cyan comes only from the emitter ring. Alcove interiors are a
deep warm shadow (roughly RGB 20–40), with at most a soft downlight falloff and no hot spots.

### 1.3 Prompt (paste as-is, and attach `council-chamber-layout.png` as the composition reference)

```
Use case: game background plate. ONE finished 16:9 image, 2560x1440 (or larger at 16:9), for the science-fiction
strategy game "Master of Orion — Reborn". Filename: scene-council-chamber.png.

Subject: the interior of the Galactic Council chamber, a monumental neutral rotunda where the leaders of rival alien
empires meet to vote. It belongs to no single species: ancient, solemn, ceremonial, built of dark basalt, aged bronze
and brushed gunmetal, with fluted columns, coffered dome ribs and worn, lived-in surfaces. Serious prestige
science-fiction drama, not fantasy.

Composition (follow the attached layout guide exactly; it is a blocking sketch, not a style reference):
- Eye-level camera at standing head height, looking straight at the centre of the room, no tilt, 40mm lens,
  symmetric one-point perspective.
- SIX identical empty delegate alcoves set into the curved back wall, three on the left and three on the right of
  centre, mirror-symmetric, on a shallow curve so every alcove opening faces the camera almost head-on. Each alcove is
  a tall round-arched niche about 9.5% of the image width wide; the arch crown sits about a quarter of the way down
  the image. The inside of every alcove is EMPTY: no person, no chair, no statue, no object, no banner, no light
  fixture, just a deep, evenly shadowed recess, nearly black with a faint warm tone.
- Across the bottom of each alcove opening is a waist-high bronze-and-stone lectern rail whose top edge is perfectly
  straight and horizontal, a little above the middle of the image. On the front of each lectern is a blank, plain
  brushed-metal plaque with no writing, symbols or engraving.
- In the centre between the two groups of alcoves: a stepped circular dais with a waist-high pedestal; its top is a
  dark glass hologram emitter disc with a faint cyan ring. Nothing on the disc and no hologram. Above it, empty dark
  air with the far wall in deep shadow.
- At the very top, the rim of the dome with a softly glowing round oculus, partly cut off by the top edge, subdued.
- The lower third: polished dark floor and the dais steps, calm, low detail, falling into shadow toward the bottom.
- Architecture continues past the left and right edges of the frame.

Lighting: warm amber lamplight from high on the left and soft daylight-gold from the oculus; deep shadows; the alcove
interiors stay dark and evenly lit; the only cool light is the faint cyan emitter ring. Dust motes in the oculus light
are fine, but no strong god rays crossing the alcoves.

Visual treatment: photorealistic cinematic hard sci-fi concept still, physically believable materials and light,
restrained filmic grade, subtle film grain, muted palette of bronze, basalt, umber and gunmetal with one cyan accent.

Avoid: people, aliens, figures, statues or silhouettes anywhere; anything inside the alcoves; text, letters, numbers,
glyphs, runes, logos, flags, emblems, watermark, border, interface; cartoon, anime, illustration, cel shading, toy,
plastic, saturated colours, neon; fantasy or medieval throne room, church or cathedral iconography, stained glass;
lens flare; fisheye; tilted camera; asymmetric or unevenly sized alcoves.
```

### 1.4 Check before accepting (open the annotated guide side by side)

- [ ] Six alcoves, the same size, symmetric, all inside x 5–95 %, openings nearly face-on.
- [ ] Every alcove interior is empty and dark, with no figures or objects (generators often put a statue in at least
      one, so look closely).
- [ ] Lectern tops are straight and horizontal, at about the same height in all six.
- [ ] Plaques are blank, and there is no text anywhere.
- [ ] The emitter disc is empty, and the space above the pedestal is dark.
- [ ] The top ~13 % and the bottom ~30 % are calm.
- [ ] Light comes from the upper left / above, and nothing glows inside the alcoves.

Small position errors are fine (a few percent), because the game reads the alcove positions from a measured map
(§1.5), not from the guide. Re-roll for wrong alcove count, figures in alcoves, text, or alcoves turned sharply sideways.

### 1.5 Drop-in and code plan (after the image lands)

1. Put the PNG in `assets/world-art/scene/`, then
   `convert scene-council-chamber.png -quality 85 -define webp:method=4 assets/art/scene/scene-council-chamber.webp`.
2. Measure the plate into `assets/art/scene/scene-council-chamber.json`, all in image fractions: each alcove's centre
   x, arch radius, spring-line y and lectern-top y, plus the plaque rectangles, the emitter ellipse and the hologram box.
3. Code (`js/gfx/scenes.js` `Scenes.council`, with `'council-chamber'` added to `SCENES` in `js/gfx/worldart.js`):
   - **The plate.** Draw it cover-cropped and map the JSON into screen pixels.
   - **Each delegate.** Clip to the niche path (arch + sides, down to the lectern top) and draw the race photo with
     `bg:false` (feathered) at about 84 % of the opening height, standing on the lectern line. Reuse the existing
     grading: lift its blacks to the niche tone sampled from the plate, warm multiply, overhead light. Keep the per-state
     grades too (speaking/winner brighter, abstain desaturated, idle sunk into shade).
   - **Per-seat effects.** The speaking/winner glow follows the measured arch edge, and the keystone gem sits at the
     measured crown.
   - **Vacant alcoves.** A darker veil.
   - **The return value.** The same layout object as today (`seats[].plaque`, `hologram`, `pedestal`), so
     `js/ui/council.js` (name tags, hologram bust, galaxy) works unchanged.
   - **Fallback.** The drawn chamber stays as the fallback until the plate has loaded.
4. Seat → alcove mapping (alcoves numbered 1–6 from left to right; seats keep their left-to-right order):

   | Empires | Alcoves used | Vacant |
   |---|---|---|
   | 2 | 3, 4 | 1, 2, 5, 6 |
   | 3 | 2, 3, 4 | 1, 5, 6 |
   | 4 | 2, 3, 4, 5 | 1, 6 |
   | 5 | 1, 2, 3, 4, 5 | 6 |
   | 6 | all | — |

5. Check with `tools/test-scenes.html#council` (seat count 2–6, speaking / winner / abstain states) and
   `node tools/qa/art-shots.js`.

---

## 2. Star-system skies — `system-sky-<colour>.png` (6)

### 2.1 What the game does with them

This is the background of the star-system screen (`js/ui/system.js`). The game takes the **star from the image**
(it draws no sun of its own over a sky, only a faint breathing bloom) and draws:

- **The planet,** live and rotating, large in the **lower left**: centred at about (25 %, 80 %), radius up to 40 % of the
  image height, lit from the direction of the star.
- **The readouts** along the bottom ~14 %.

So each sky has **no planet**, a **dark, calm lower-left**, and **one star in the upper right at a fixed spot**. The
code expects it there (`SKY_STAR` in `js/ui/system.js`):

| | Value |
|---|---|
| Star centre | x = 86 %, y = 16 % of the image |
| Star disc diameter | 12 % of the image width (≈ 230 px at 1920 wide) |
| Format | 16:9, 2560×1440 preferred (1920×1080 minimum), cover-cropped with the focus at (50 %, 35 %) |

If a result's star lands more than ~2 % off, either crop/shift the image when converting, or tell me and I'll make the
star position per-image.

### 2.2 Shared prompt (used by all six; paste it, then append the colour block from §2.3)

Attach `system-sky-layout.png` as the composition reference.

```
Use case: game background plate. ONE finished 16:9 image, 2560x1440, for the science-fiction strategy game
"Master of Orion — Reborn". It is the sky behind a star-system view; the game draws a planet over it later.

Composition (follow the attached layout guide exactly; it is a blocking sketch, not a style reference):
- ONE star in the upper right: its disc is centred 86% from the left and 16% from the top, and the disc is 12% of the
  image width across. Realistic stellar photosphere: limb darkening (the edge dimmer and redder than the centre),
  fine granulation, a few small active regions, and a soft corona and glare falling off smoothly into space. The disc
  is not blown out to a flat white circle; its surface texture must remain visible.
- NO planet, moon, ring, asteroid, ship, station or structure anywhere in the image.
- The lower-left two thirds of the image are deep space: dark, calm, low contrast, only a sparse star field and the
  faintest trace of dust, because a large planet will be placed there later.
- Behind everything: a faint, muted nebula and a natural star field (many tiny stars of varied brightness, a few
  slightly brighter, no cross-shaped spikes on small stars), densest toward the upper middle, thinning to near-black
  at the bottom and the left.
- The bottom 15% is near-black.
- The star is the only light source; no other bright objects.

Visual treatment: photorealistic astrophotography / cinematic space plate, physically plausible, restrained filmic
grade, subtle grain, deep blacks, not saturated. Original, nothing recognisable from any film or game.

Avoid: planets, moons, rings, spacecraft, text, numbers, logos, watermark, border, interface, lens-flare hexagons,
anamorphic streaks, cartoon, illustration, painterly brush strokes, rainbow colours, neon, fantasy galaxy swirls,
over-saturated nebula, multiple suns, a flat white disc.
```

### 2.3 Colour blocks (append one to the shared prompt; the filename goes with it)

**`system-sky-yellow.png`**
```
Star: a yellow main-sequence star like the Sun, warm gold-white disc with a slightly deeper orange limb and fine
rice-grain granulation, a soft golden corona. Sky tint: warm; the nebula is thin amber and smoky brown dust lanes
near the star, fading to neutral dark space. Overall mood: familiar, temperate, calm.
```

**`system-sky-red.png`**
```
Star: a red dwarf, deep ember-orange to red disc, darker and dimmer than a sun, with two or three dark starspots
and a faint arc of a flare loop on the limb; a low, dull red corona. Sky tint: the darkest of the set; faint
rust-red and maroon dust, very sparse, most of the frame almost black. Overall mood: old, cold, quiet.
```

**`system-sky-green.png`**
```
Star: a pale white star with a distinct soft green cast (a game convention, keep it subtle and believable),
pale green-white disc, granulation still visible, a corona tinged mint. Sky tint: thin teal-green and slate dust
lanes with a hint of cyan near the star, otherwise neutral dark. Overall mood: strange but serene.
```

**`system-sky-blue.png`**
```
Star: a hot blue-white giant, intense and crisp, the disc bright blue-white with a cooler blue limb and very fine
granulation, a large sharp corona with faint radial streamers. Sky tint: cold; a wispy blue reflection nebula near
the star and more background stars than the other skies, fading to deep navy-black. Overall mood: harsh, brilliant.
```

**`system-sky-white.png`**
```
Star: a white main-sequence star, neutral white disc with a faint warm limb, clean and crisp, a neutral silver
corona. Sky tint: neutral; faint grey-blue and pewter dust lanes, a balanced star field. Overall mood: clear,
clinical, still.
```

**`system-sky-purple.png`**
```
Star: a neutron star / pulsar, so the star is unusual: a small, intensely bright violet-white core at the star
position, surrounded by a glowing violet accretion haze that fills the 12%-wide disc area, with two thin, faint,
straight polar jets leaving it in opposite directions (one up-left, one down-right, faint, not crossing the lower-left
area strongly). Sky tint: dark indigo and violet; faint magenta-violet nebula filaments near the star, the rest deep
space. Overall mood: exotic, dangerous, high-energy.
```

### 2.4 Check before accepting

- [ ] There is no planet or other object, and exactly one star.
- [ ] The star's centre is close to (86 %, 16 %) and its disc is about 12 % of the width (hold the annotated guide over it).
- [ ] The star's surface is visible (limb darkening, texture), not a flat white disc.
- [ ] The lower left is dark and calm, and the bottom is near-black.
- [ ] The tint matches the colour, and the six look like one set (same grade, star field density and darkness level).
- [ ] There is no text, no flare hexagons, and no streaks.

### 2.5 Drop-in

Put the PNGs in `assets/world-art/system-sky/`, then for each one:
`convert system-sky-<colour>.png -quality 85 -define webp:method=4 assets/art/system-sky/system-sky-<colour>.webp`.
No code change is needed: `js/ui/system.js` already uses the sky when the file is present and falls back to the old
system plate or the procedural backdrop otherwise. Check with `node tools/qa/art-shots.js` (the system screens).
