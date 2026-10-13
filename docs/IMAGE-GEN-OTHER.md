# Image-generation brief — ships, technology, battles, scenes, endings, textures ("Master of Orion — Reborn")

Paste this whole document to the image-generating AI. It is the **third batch** after the race portraits/scenes (`IMAGE-GEN-HANDOFF.md`) and the planets (`IMAGE-GEN-PLANETS.md`). It asks for **60 images**; section 6 lists what is held back for later and why. (Warships are covered *here*; ignore the optional "warship" line in the race brief.)

## 1. Context (short)
*Master of Orion — Reborn* is a serious, grounded space-strategy game, a remake of the 1993 classic: expand across a galaxy of one-planet stars, research six fields of technology (**Computers, Construction, Force Fields, Planetology, Propulsion, Weapons**), design ships from four hull classes (**Small, Medium, Large, Huge**) and fight tactical battles, invade planets, negotiate and spy, and win by conquest or by being elected Emperor by the Galactic Council. Ten races (Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok) each have an architectural and engineering culture (see the race brief; recap in §3).

**Look.** Photoreal, cinematic hard sci-fi: lived-in, industrial, riveted and weathered hardware; believable light and materials; restrained filmic palette with **one accent colour** per subject; deep blacks, no blown whites; subtle film grain. **Not** cartoon, toy, anime, glossy game-icon or fantasy. The interface that frames these images is bevelled bronze/leather-brown and gunmetal with gold type on deep indigo-black space, so low-key, dark-surround images sit best; keep the lower ~20 % of 16:9 images calm (UI text overlays) unless stated.

**Hard rules.** Completely original — no recognisable ships, characters, logos or locations from any film, game or franchise (including the original Master of Orion). No text, logos, watermarks, borders, UI. No real-world flags or symbols.

**Creative freedom.** Entries give only purpose, format and the feel to hit. Invent shapes, greebles, colours, props and lighting. Keep a family resemblance within each group.

**Negative prompt:** cartoon, anime, cel shading, outline, illustration, toy, plastic, glossy icon, rainbow saturation, text, watermark, logo, border, UI, fantasy armour, medieval, lens-flare overload.

**Master prefix:** *"Cinematic photoreal science-fiction still, grounded hard sci-fi, industrial and weathered, filmic muted colour grade, subtle film grain, physically believable lighting,"*

## 2. Formats
**H** = 16:9, 1920×1080 · **Q** = 1:1, 1536×1536 · **T** = seamless tileable texture 1024×1024 (must tile in both directions, no visible seams, no focal object, no vignette). PNG or lossless WebP.

## 3. Race style recap (for ship and installation shots)
Human: practical grey-blue, navy trim, modular · Mrrshan: gun-heavy, brass, amber, proud · Silicoid: crystal-and-basalt, glowing seams · Sakkra: organic bone-and-bronze, spined, jade · Psilon: elegant gold-white lattice, minimal · Alkari: sleek winged fighters, sky blue/white, clan crests · Klackon: modular hive-barges, rust-chitin, repetitive · Bulrathi: blunt armoured slabs, olive-green, riveted · Meklar: spiky automated foundry-ships, cold cyan, exposed machinery · Darlok: dark, angular, low-signature, red running lights.

## 4. The 60 images

### 4.1 Warships — 19 images
Purpose: the ship-design editor's hologram hero, fleet cards, news items, combat introductions, and the Races screen. Ships appear mostly small (~300 px), so the **silhouette and colour must read instantly**. Ships are shown in space against a dark star-field with soft rim light; a nearby planet limb or nebula glow is optional.

*Hull classes (generic, deliberately race-neutral grey-steel hard-surface), 3/4 view, scale cues (hatches, windows, running lights):*
| # | File | Brief |
|---|---|---|
| 1 | `ship-hull-small` | A **Small** craft — a fighter/scout; sleek, one or two engines, tiny cockpit. Format H. |
| 2 | `ship-hull-medium` | A **Medium** corvette/destroyer-class ship; weapon pods, several engines. H. |
| 3 | `ship-hull-large` | A **Large** cruiser: long hull, turret clusters, hangar bay, great engine bank. H. |
| 4 | `ship-hull-huge` | A **Huge** capital ship / dreadnought: vast, cathedral-like, tiny fighters beside it for scale. H. |

*Special-purpose ships (generic):*
| 5 | `ship-colony` | A **colony ship**: bulbous habitat modules and sealed cargo, engines at the rear, nursery-like hope. H. |
| 6 | `ship-scout` | A **scout**: very light, big sensor dish, huge fuel tanks, tiny crew pod. H. |
| 7 | `ship-transport` | A **troop transport**: blunt armoured box with drop-ramps and heat-shield plates. H. |
| 8 | `ship-stargate` | A **stargate**: a vast ring structure, one ship passing through, energy shimmer. H. |
| 9 | `ship-doomstar` | The **Doom Star**: a planet-killing super-weapon, huge, spherical or ring-based, menacing, with a charging beam emitter; a planet and fleets dwarfed beside it. H. |

*One signature **flagship per race** (the race's Huge-class ship), in the race's architectural and engineering style from §3, in orbit of a planet fitting its homeworld mood (invent). H:*
| 10–19 | `ship-flagship-human`, `-mrrshan`, `-silicoid`, `-sakkra`, `-psilon`, `-alkari`, `-klackon`, `-bulrathi`, `-meklar`, `-darlok` | Use §3 as direction and the race's accent colour as running lights/engine glow. Make each unmistakably *theirs* at thumbnail size. |

### 4.2 Technology fields — 6 images
Purpose: the header art for the Research screen and the **breakthrough scene** background when a field produces a discovery. One per field. H; keep the right 40 % darker and uncluttered (tech text overlays). No people.
| 20 | `tech-computers` | Computers — dense holographic data-lattices, server-vaults, fibre light, targeting overlays; cyan accent. |
| 21 | `tech-construction` | Construction — enormous automated shipyard/foundry interior, gantries, robotic arms, sparks, molten steel; orange accent. |
| 22 | `tech-forcefields` | Force Fields — a ship or planet wrapped in a shimmering deflector bubble absorbing incoming fire; violet-blue accent. |
| 23 | `tech-planetology` | Planetology — terraforming: an atmospheric processor over a barren world, half rust and half newly green, soil engines; teal-green accent. |
| 24 | `tech-propulsion` | Propulsion — an engine test bay or ship's drive core, plasma torus, warp distortion rings, star-streaks; electric-blue accent. |
| 25 | `tech-weapons` | Weapons — a weapons proving ground: a massive beam emitter discharging, tracer streams, target hulks glowing; red-amber accent. |

### 4.3 Battle backdrops — 5 images
Purpose: the background of the **tactical combat** screen (a 10×8 board; the ships are drawn over it, so the image must be **low-contrast, calm and uncluttered in the middle**, with interest at the edges). H.
| 26 | `battle-planet` | Battle in orbit of a generic planet filling the lower or side area, star light grazing it. |
| 27 | `battle-nebula` | Inside a luminous nebula (colourful but muted); soft volumetric light. (Shields are weaker here.) |
| 28 | `battle-asteroids` | A dense asteroid field with rocky cover; light rakes across the rocks. |
| 29 | `battle-star` | Close to a star: bright limb on one side, flares, deep shadow elsewhere. |
| 30 | `battle-deep` | Open deep space: faint distant galaxy and dust, minimal features. |

### 4.4 Monsters and guardians — 3 images
Purpose: unique hostile encounters shown in the pre-battle card and in news. H, dark, readable, with scale cues.
| 31 | `monster-crystal` | The **Space Crystal**: a gigantic, living crystalline entity drifting through space, refracting starlight, shedding shards; beauty and menace. |
| 32 | `monster-amoeba` | The **Space Amoeba**: a vast translucent organism with visible internal structures, tendrils engulfing a wrecked ship. |
| 33 | `monster-guardian` | The **Guardian of Orion**: an ancient automated sentinel of the vanished Ancients — a colossal, angular, god-like machine of dark metal and gold light, partly sleeping, lit from below; absolute awe. |

### 4.5 Ground war — 2 images
Purpose: the invasion, landing and bombardment screens (the race is not specified — silhouettes/armour only).
| 34 | `ground-transports` | Troop transports descending in formation through flak and smoke over an embattled city; dusk light. H. |
| 35 | `ground-troopers` | A squad of anonymous armoured troopers advancing through a ruined street; helmets fully covering faces, no race identifiers, strong backlight. H. |

### 4.6 Broadcast and espionage — 5 images
| 36 | `gnn-studio` | The **Galactic News Network** studio: a slick sci-fi broadcast set, curved desk, holographic globe and wall screens (blank — no text), cool key light with warm accents; **no anchor** (the anchor is composited separately). H, clear space centre-left. |
| 37 | `gnn-studio-closeup` | Tight view of the same set: desk edge, holo-projector, camera drones; shallow depth of field. H. |
| 38 | `council-hall` | The **Galactic Council chamber** empty: a circular domed hall of alcoves around a central podium, light pools in each alcove, polished stone and brass, grandeur and stillness. H. (Delegates are composited separately.) |
| 39 | `spy-infiltration` | A spy infiltrating a facility: dark corridor, a hooded silhouette bypassing a laser grid, red alarm glow. H. |
| 40 | `spy-sabotage` | Sabotage in progress: a factory floor with a sparking explosion mid-bloom, workers scattering (silhouettes), fire-light. H. |

### 4.7 Title, loading and endings — 8 images
| 41 | `title-key-art` | **Title screen key art:** a heroic, atmospheric composition for "Master of Orion": a mysterious ringed throne-world (Orion) in the distance, fleets of several races converging toward it through a luminous nebula, a lone ship in the foreground. Wide 21:9 safe — compose for 16:9 but keep the key subject centre-right and extend background to the left (the game title and menu go on the left third). H. |
| 42 | `title-key-art-alt` | A second, calmer title option: the galaxy seen from a ship's dark observation deck, a single hand-held holographic star-chart glowing. H. |
| 43 | `loading-fleet` | Loading screen: a fleet at rest in orbit, quiet before the storm. H. |
| 44 | `loading-frontier` | Loading screen: a lone survey ship approaching an unexplored star system. H. |
| 45 | `end-victory` | **Good ending:** the elected Emperor's ship rising toward the Orion throne-world, shafts of golden light, an honour guard of ships, hope. H. |
| 46 | `end-tyrant` | **Conquest ending:** a conqueror's fleet over a subjugated galaxy, dark red light, a looming throne-fortress, oppressive beauty. H. |
| 47 | `end-funeral` | **Defeat / funeral:** a long procession of silent ships and lanterns drifting past a dead empire's homeworld, mourning blue light. H. |
| 48 | `end-exile` | **Exile ending:** a single ship leaving the galaxy's edge into the void, its home star a tiny dot behind, loneliness and defiant hope. H. |

### 4.8 Installations — 6 images
Purpose: the colony screen and tech scenes illustrate structures a colony builds. H or Q as noted; planetside or orbital, industrial and believable, **no people**.
| 49 | `inst-factory` | A giant automated **factory complex** at night, towers and smoke, glowing furnaces. H. |
| 50 | `inst-missile-base` | A **missile base**: hardened silos and launch rails on a ridge, warhead gantries, a night patrol light. H. |
| 51 | `inst-planetary-shield` | A **planetary shield** projector: pylons ringing a city, a shimmering energy dome rippling where debris strikes. H. |
| 52 | `inst-spaceport` | A busy **spaceport/shipyard** with ships under construction in a dry-dock, cranes and welding sparks. H. |
| 53 | `inst-research-lab` | A **research campus** at dusk: domed observatories, glowing glass labs, data-towers, quiet purpose. H. |
| 54 | `inst-terraformer` | An **atmosphere processor** complex: chimney-towers venting into a thin sky, patches of new green on the barren ground. H. |

### 4.9 Interface textures — 6 tileable images (T)
Purpose: **surfaces of the UI panels**, so they must tile seamlessly, be **low-contrast** (UI text sits on them), and have no strong focal feature or vignette. They are tinted and bevelled in code, so keep them neutral and slightly dark.
| 55 | `tex-bronze-plate` | Aged bronze/brass metal plate with fine brushing and subtle scratches. |
| 56 | `tex-leather-brown` | Dark brown embossed leather with fine grain and faint stitching/pebbling. |
| 57 | `tex-gunmetal` | Brushed dark steel, subtle machining marks. |
| 58 | `tex-dark-glass` | Smoked glass/ink panel with faint internal sheen and micro dust. |
| 59 | `tex-indigo-void` | Deep indigo-black star-dust (very sparse faint stars, soft nebular mottling) for backgrounds. |
| 60 | `tex-rivet-strip` | A horizontal strip (2048×256, tileable horizontally only): riveted steel band with panel seams, for dividers. |

## 5. Delivery
Files named exactly as above (`.png`). Suggested order: **4.1 ships first** (most visible), then 4.2 and 4.9 (they restyle whole screens), then 4.3, 4.7, 4.6, 4.4, 4.5, 4.8. If anything looks cartoonish or over-saturated, regenerate with "photoreal, weathered industrial hard sci-fi, restrained filmic grade".

## 6. Not in this batch — why, and when
- **Race-specific hull sets** (4 hulls × 10 races = 40 ships) — high value for identity; do after the flagships show which styles work.
- **Per-technology illustrations** (the game has 252 techs): too many; start with the six field headers. Candidates later: the ~30 most visually distinct techs (Death Ray, Stargate, Black Hole generator, Planetary Shield, Terraforming, Cloaking, Scanners).
- **Weapon-effect plates** (beams, missiles, explosions, shields hit) — mostly produced procedurally in the engine; only reference stills later if needed.
- **Race ground troops and race-flavoured installations** (10 each).
- **Empire banner/emblem crests** for the six banner colours (needs transparency; best made as vector/SVG).
- **Event scenes beyond planets/this batch** (industrial accident, computer virus, derelict ship, donation, assassination).
- **Tutorial/Almanac illustrations** and per-screen "empty state" art.
- **Animated assets** (cloud layers, engine glow loops, news-ticker graphics) — produced in code.
