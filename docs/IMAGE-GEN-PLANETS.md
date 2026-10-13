# Image-generation brief — planets, stars and surface scenes ("Master of Orion — Reborn")

Paste this whole document to the image-generating AI. This is a **first batch of 54 images**; it covers everything the game needs on day one. Section 6 explains what is deliberately held back for later.

## 1. Context
*Master of Orion — Reborn* is a serious, grounded science-fiction space-strategy game (remake of the 1993 classic). The player colonises a galaxy of stars. **Every star has exactly one planet** (or an asteroid field / nothing). There are **13 planet types**, ordered from the most hostile to the most Earth-like:
`Radiated · Toxic · Inferno · Dead · Tundra · Barren · Minimal · Desert · Steppe · Arid · Ocean · Jungle · Terran`
plus special conditions: **Gaia** (a perfect, lush world — the best a planet can be), **Rich** (mineral-rich), **Artifacts** (ancient ruins), and **Orion** (the legendary throne-world of the vanished Ancients, guarded by a monstrous automated Guardian). Hostile worlds can only be settled with advanced colony bases (domes, sealed habitats); friendly worlds get open cities. Colonies become industrial, populous, and eventually scarred by war.

**The look we want** (same as our race portraits): serious, cinematic, photoreal hard-science-fiction; the grandeur of space photography crossed with film concept art. Restrained, filmic colour; physically believable atmospheres, clouds, oceans, terrain and lighting. **Not** cartoonish, not glossy-game-icon, not painterly fantasy. The user interface framing the pictures is bevelled bronze/brown and gunmetal with gold type on deep black-indigo space, so **dark space backgrounds with a controlled bright planet** fit best; avoid pure-white blowouts and heavy borders.

**Where the images are used.** (a) **Planet card** — the picture that appears when a scout explores a world, when the player is asked "build a colony here?", and in the planet list: a single planet, centred, on black space. (b) **Landing scene** — shown full-screen when a colony ship lands, and on invasion/bombardment: the surface of that world. (c) **System screen** — the planet with its star glinting, as the backdrop for the star-system view. (d) **Colony-from-orbit** — planet with a settled colony, shown on the colony screen and in news broadcasts. (e) **Events and news** — bombarded, devastated or exploding worlds.

**Hard rules.** Completely original; no resemblance to any existing film/game artwork, no recognisable franchise planets. No text, labels, logos, watermarks, UI, borders or ships (unless stated). **No people** unless stated. Avoid cartoon, cel shading, outlines, painterly fantasy, rainbow saturation, sparkly "game icon" gloss.

**Creative freedom.** Each entry below gives only the essentials (the purpose and the atmosphere to hit). Invent geology, weather, colour palette variation, features, architecture details and lighting drama yourself, as long as the world reads instantly as its type and stays consistent in style across the set.

**Negative prompt:** cartoon, anime, cel shading, outline, illustration, toy, glossy icon, lens-flare overload, text, watermark, logo, border, UI, spaceship, person, rainbow colours, fantasy.

**Master prefix:** *"Cinematic photoreal science-fiction still, grounded and restrained, filmic colour grade, subtle film grain, physically believable lighting and atmosphere,"*

## 2. Formats
- **O = Orbit card:** 1:1, 1536×1536, planet centred filling ~70 % of the frame, pure dark space (soft, sparse stars), one light direction from the upper left, thin atmosphere limb glow where there is air. Keep corners dark (the image is used in a round-cornered/bevelled frame and is often scaled to ~200 px — silhouette and colour must read small).
- **S = Surface scene:** 16:9, 1920×1080, a landscape of that world seen from the ground at a believable "arrival site" hour, sky showing the star/planetary features; open foreground on the lower third (UI text overlays there).
- **Y = System backdrop:** 16:9, 1920×1080, planet in the lower-left or lower-right third, the star as a bright point or partial limb light, empty dark space top/right.
- **C = Colony from orbit:** 1:1, 1536×1536 (like O but with settlement evidence).
- **E = Event/news:** 16:9, 1920×1080.
PNG or lossless WebP. Sparse composition, deep blacks, no vignette frames.

## 3. The 54 images

### 3.1 Orbit cards (O) — 14 images — one per planet type, plus asteroids
Purpose: the "explore" and "colonise?" card, planet lists, GNN item art. Each must be recognisable at 200 px at a glance and clearly different from the others in colour/texture. A *hint* of what makes it special is enough.

| # | File | World | Atmosphere / feel to hit |
|---|---|---|---|
| 1 | `orbit-radiated` | Radiated | A world blasted by its star or ancient war: glass-fused plains, ghostly green-white radiation glow along the terminator, aurora-like ionised haze. Eerie, lethal. |
| 2 | `orbit-toxic` | Toxic | Thick poisonous atmosphere, sulphur-yellow/green swirling cloud decks, chemical lakes glinting through gaps. Corrosive beauty. |
| 3 | `orbit-inferno` | Inferno | Molten surface under a boiling atmosphere; glowing lava seas, dark crust plates, smouldering orange night side. |
| 4 | `orbit-dead` | Dead | Airless, cratered, grey-brown, ancient and silent; long hard shadows; faint ghosts of old collapsed seas. |
| 5 | `orbit-tundra` | Tundra | Cold, thin-aired, white-blue ice caps meeting grey-brown frozen land; faint wind-scoured streaks; cold blue rim light. |
| 6 | `orbit-barren` | Barren | Rust-brown, thin atmosphere, bare rock and dust, canyons and ancient dry riverbeds, no clouds. |
| 7 | `orbit-minimal` | Minimal | Marginally habitable: pale thin-air world, patches of hardy lichen-green and ochre, wispy cloud, a few shallow seas. Struggling, almost life. |
| 8 | `orbit-desert` | Desert | Vast dunes and salt flats, ochre-orange, scattered white storm systems, dark mountain chains. |
| 9 | `orbit-steppe` | Steppe | Wind-swept grasslands: golden-olive plains, scattered lakes, broad cloud bands, sparse forests along rivers. |
| 10 | `orbit-arid` | Arid | Dry but livable: patchwork of red-brown highlands, dark scrub, small seas, thin high cloud; warm tones. |
| 11 | `orbit-ocean` | Ocean | Deep blue water world, a few island chains, towering white cloud spirals, bright specular glint on the sea. |
| 12 | `orbit-jungle` | Jungle | Dense deep-green and humid: cloud-wrapped, rain-belts, rivers like veins, saturated yet natural greens. |
| 13 | `orbit-terran` | Terran | Earth-like: blue seas, green and tan continents, white clouds, ice caps, city-light threads on the night side. Familiar, inviting. |
| 14 | `orbit-asteroids` | Asteroid field | A dense field of rocky bodies of varied size catching light against deep space, with one larger dominant asteroid; dust lanes; a sense of mining potential. |

### 3.2 Special worlds (O) — 3 images
| 15 | `orbit-gaia` | Gaia — a *perfect* world | Impossibly healthy: luminous blues and greens, thick elegant cloud, shimmering atmosphere glow, faint rings or a great moon; reads as paradise but still physically plausible. |
| 16 | `orbit-artifacts` | Artifacts world | A planet with unmistakably artificial ancient structures visible from orbit: long straight geometric scars, ring-like constructs, a faint warm glow from buried installations. Ancient, mysterious. |
| 17 | `orbit-orion` | **Orion**, throne-world of the Ancients | The most dramatic image: a majestic, slightly unnatural world crowned by a vast artificial ring or lattice, gold-white light from within, defended by a looming alien automated sentinel silhouette in orbit (the Guardian). Awe and menace. |

### 3.3 Surface / landing scenes (S) — 14 images
Purpose: full-screen when a colony ship lands ("a new colony is founded"), and as a backdrop when the planet is invaded or bombed. Show the **arrival site** with a first-landing feel (one small lander or beacon light is welcome but optional). Ground-level, 24-35 mm look, atmospheric perspective, the star and sky features of that world.

| # | File | World | Atmosphere / feel |
|---|---|---|---|
| 18 | `surface-radiated` | Radiated | Glassy fused plain under a sickly sky, dust-devils of glowing ash, ruined shapes hinting at an ancient catastrophe. |
| 19 | `surface-toxic` | Toxic | Yellow-green sky, chemical lake shore with steaming vents, crusted salt formations, orange sun a smear in the haze. |
| 20 | `surface-inferno` | Inferno | Lava river across black rock, burning horizon, heat distortion, ash fall, huge swollen sun. |
| 21 | `surface-dead` | Dead | Silent cratered plain, black sky full of stars, a huge planetary neighbour or ringed horizon, long shadows. |
| 22 | `surface-tundra` | Tundra | Frozen plain and ice ridges, low sun, blowing snow, steel-blue shadows. |
| 23 | `surface-barren` | Barren | Rust canyon rim, dust haze, thin pink-brown sky, dry riverbed below. |
| 24 | `surface-minimal` | Minimal | Pale thin-air plain with tough scrub and lichen, small hills, a cold tentative dawn. |
| 25 | `surface-desert` | Desert | Towering dunes at golden hour, wind-rippled sand, distant rock spires. |
| 26 | `surface-steppe` | Steppe | Endless grass under a vast sky and cloud shadows, a winding river, big-sky light. |
| 27 | `surface-arid` | Arid | Red-brown mesas, dry scrubland, a small oasis lake, warm late light. |
| 28 | `surface-ocean` | Ocean | A rocky island beach at dusk with an immense sea, giant moon rising, surf and kelp; floating habitat hints optional. |
| 29 | `surface-jungle` | Jungle | Dense humid canopy, shafts of light, giant ferns and vines, a clearing where a lander could rest, mist. |
| 30 | `surface-terran` | Terran | A fertile river valley with forest and meadow, soft morning light, snow peaks beyond; peaceful, hopeful. |
| 31 | `surface-asteroid` | Asteroid base | An asteroid surface at the airless horizon, drilling platforms and tethered hab-modules, the star as a hard bright disc, sparkling dust. |

### 3.4 System backdrops (Y) — 6 images — by star colour
Purpose: behind the system screen; the star colour sets the mood of the whole system. The planet is generic here (a mid-hostile, grey-brown or blue-green world is fine — **invent**) so one image per star colour can be reused for all planet types.
| 32 | `system-yellow` | Yellow (Sun-like), warm white-gold light, calm. |
| 33 | `system-red` | Red dwarf: huge dim red-orange star, long red shadows, sullen. |
| 34 | `system-green` | A rare green-tinged star, eerie, luminous teal haze. |
| 35 | `system-blue` | Hot blue-white star, harsh bright light, hard shadows, a strong flare. |
| 36 | `system-white` | White star, clean cold light, crisp. |
| 37 | `system-purple` | Violet-white star, strange, ultraviolet-feeling, mysterious, with a hint of nebula behind. |

### 3.5 Settled planets (C) — 6 images
Purpose: the colony screen and news items show a *living* colony. Night-side and day-side views, signs of civilisation proportional to the environment.
| 38 | `colony-terran-city` | Terran/Ocean/Jungle-type: sprawling lit cities, road networks, orbital elevator or shipyard, busy. |
| 39 | `colony-dome-hostile` | Hostile world (toxic/radiated/inferno): small sealed domes and pressure habitats scattered on a harsh surface, a few lights. |
| 40 | `colony-barren-mining` | Barren/dead: strip mines, tailings, massive industrial complexes, refinery glows, thin smog. |
| 41 | `colony-industrial` | Heavily industrialised world: continents of glowing factories, pollution haze, orbital dockyards — a production powerhouse. |
| 42 | `colony-polluted` | An over-industrialised world suffering waste: brown/grey haze, discoloured seas, still inhabited (used to warn the player). |
| 43 | `colony-fortress` | A world fortified with missile bases and defence satellites; glints of orbital weapons; wary. |

### 3.6 Events and news (E) — 8 images
Purpose: GNN broadcast stills and event cards.
| 44 | `event-bombarded` | A planet under orbital bombardment: burning impact craters, firestorm glows on the night side, smoke plumes, distant bombers silhouetted (small). |
| 45 | `event-devastated` | A scorched, lifeless former colony: black ruins, fire-glassed cities, ash sky. |
| 46 | `event-nova` | A star going supernova over a doomed system: blinding expanding shell, the planet silhouetted, shockwave rings. |
| 47 | `event-comet` | A great comet on a collision course with a planet, long tail across the sky, the planet's night side lit by it. |
| 48 | `event-plague` | A quarantined world: warning-beacon lights in orbit, ghostly darkened cities, a sickly green aurora of contaminant. |
| 49 | `event-rebellion` | A city district in revolt seen from the ground/low orbit: smoke, fires, barricades, flickering emergency lights. |
| 50 | `event-planet-destroyed` | A world breaking apart (final-weapon or planetary-doom event): fractured crust, debris cloud, brilliant core light. |
| 51 | `event-pirates` | A raided orbital freight lane: wrecked cargo ships drifting past a planet, a few sinister raider silhouettes (small). |

### 3.7 Anchor scenes — 3 images
| 52 | `scene-first-landing` | 16:9 — a colony ship descending toward a planet's surface at dawn (generic, hopeful), thruster glow, dust. |
| 53 | `scene-ground-battle` | 16:9 — a dark battlefield of troop transports and entrenched defenders under flares and tracer fire; no recognisable faces/races (silhouettes). Used for ground combat. |
| 54 | `scene-galaxy` | 16:9 — a majestic spiral galaxy seen from outside with thousands of stars and dust lanes, one empire's territory suggested by a faint glow. Used as a menu/news backdrop. |

## 4. Consistency checklist (the set must look like one series)
- same photoreal, filmic, restrained treatment; same star-light direction on O/C cards (upper left);
- each world instantly readable by colour/texture at ~200 px;
- no two types share a dominant colour (radiated=ghost green-white, toxic=yellow-green, inferno=orange/black, dead=grey, tundra=ice blue, barren=rust, minimal=pale ochre/green, desert=orange-ochre, steppe=gold-olive, arid=red-brown/green, ocean=deep blue, jungle=deep green, terran=blue-green-white);
- deep blacks; bright areas never clip to pure white; lower third of S and Y images calm.

## 5. Delivery
File names exactly as in the tables, `.png`. Deliver in batches: **3.1+3.2 (17 orbit cards) first** (they appear most), then 3.3 surfaces, 3.4 systems, 3.5, 3.6, 3.7. If something looks cartoonish or oversaturated, regenerate with "photoreal, restrained filmic grade, real atmospheric physics".

## 6. What is deliberately not in this batch (and why) — to be generated later if needed
- **Variants per planet type** (2–3 looks each, ~40 more): the same type recurs across a whole galaxy, so variety will matter after the first long game. Worth doing once we see which types the player meets most.
- **Moons and ring systems** as separate cards, and **gas-giant-like** looks (the game has none today; only if we add them).
- **Race-flavoured colonies** (how each of the 10 races builds on a world, ~10–20 images): high value for identity once the race art is wired in.
- **Race-specific surface landings** and **leader-on-planet** shots.
- **Seasonal/time-of-day variants** and **animated cloud layers** (sprite or loop assets, not stills).
- **Special events beyond the eight** (crystal and amoeba space monsters, industrial accident, computer virus, derelict ship, donations, assassination, Guardian battle) — 8–10 more stills.
- **Terraforming/atmosphere-processing before/after** pairs (for tech scenes).
- **Orion/Guardian** extra angles, ending-scene art (victory, tyrant, funeral, exile), and loading screens.
