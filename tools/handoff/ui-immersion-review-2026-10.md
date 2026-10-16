# UI immersion review — "the original, made today" (October 2026)

Brief from the product owner: the game should feel like a remake of the 1993 original — same screens, flows and feel,
recognisably descended from it — but improved in every way, as if MOO were made today. This review compares every screen
at 1920×1080 (software GL, so planets/nebulae render on the CPU fallback; GL-only effects were judged from the code and
the test pages) against the original's documented look (`research/00-original-screens-notes.md`, `research/ui-ref/A–C`)
and the project's own style guide (`research/09-art-direction.md`, `D-restyle-comparison.md`).

Screenshots used: `tools/qa/shots.js 1920x1080 galaxy,system,design,fleets,mapoverview,races,planets,tech,audience,menu,setup`
plus GNN, tech-choice, landing, council, endings and tactical combat captured through the demo hooks.

## 1. Verdict in one paragraph

The structure is right: the control screen (map + steel side panel + eight-button bar), bronze tool screens with gold
titles, five sliders, the scene screens with characters. The illustrated layer (race portraits, audience halls, the
scientist's lab, the GNN studio, landing surfaces, orbit cards) is excellent and already looks like a 2026 game. What
breaks immersion is that **two art worlds share the same frame**: photoreal illustration next to flat procedural or
vector elements — the hooded blue "envoy" blob in audiences, clip-art crown and flat banners in the endings, plan-view
cartoon ships on a photoreal beach, grey blob asteroids on the combat grid, flat coloured discs for stars on the map.
The screen you look at 90 % of the time, the galaxy map, is the least modern one. Fixing the collisions and the map
gives most of the "made today" feeling; a ship-art commission closes the rest.

## 2. Screen by screen (what the original did → what we do → gap)

| Screen | Original | Now | Gap / opportunity |
|---|---|---|---|
| **Title** | Chrome-extruded 3-D "ORION" wordmark, head-on fighter with glowing engines, vortex | Flat gold text wordmark on a photo galaxy, cartoon plan-view ship, GL planet | Wordmark should be a lit metallic 3-D treatment (the original's signature); the ship is the clip-art holdout; menu items lack a focus ring at rest |
| **New game** | Copper plate on a moonscape; race list on a gas-giant limb with a framed portrait + trait line | Three-step wizard with sector chart, race cards with photoreal portraits, homeworld art | Good. Step 2/3 could use the race `homeworld` art full-bleed behind the list like the original's backdrop |
| **Galaxy / control screen** | 4-point sparkle stars, green bracket reticle, arrow-ships with 1 px route lines, dense static starfield | Flat coloured discs with soft halos, blue glowing selection ring + brackets, chevron fleets, faint smoke nebula, lots of empty black | Biggest gap. Stars need blackbody-tinted sprites with a tight core, diffraction spikes on the brightest, no "candy" halo; a faint territory tint per empire; fleet chevrons with short motion trails; reticle = brackets only; parallax deep-star layer on pan; nebula with dust lanes (GLSpace has it — verify on a real GPU) |
| **Colony side panel** | Wide landscape planet picture box (red frame), POP/BASES plates, production, 5 sliders, build box with a gantry picture, SHIPS/RELOC/TRANS | Small square orbit card, plates, sliders, build box with a mesh texture, three buttons; lower half of the panel empty | Make the orbit illustration the hero: full panel width, landscape crop (it exists for all 17 planet types); build box with a lit shipyard/gantry image and the ship illustration; use the empty lower third for a colony "postcard" (the `colony/*` art) or the planet's data readouts |
| **System view** | (none in 1993; our addition) | CPU planet (pixelated on low tier), flat orange gradient sun, procedural nebula, tiny ship cards | The six `system-<colour>` illustrations exist and are unused: use them as the backdrop with the GL planet in front; the sun must be the photo, never a gradient disc |
| **Ship design** | Library grid + slot editor + hologram icon | Dense, polished editor; hologram of a clip-art sprite | Ship illustration (3/4 "beauty" angle) in the preview; otherwise finished |
| **Fleets / Planets ledgers** | Brown tool screens | Brown tool screens, legible, but 80 % empty early on; dim grey labels on brown | Raise secondary-text contrast (D-report #1); put the orbit thumbnail in each Planets row; empty states could show the homeworld art dimmed |
| **Tech screen** | Six field tabs, allocation sliders, light-bulb markers, picture pane | Same, plus overview/tree; blueprint pane shows the sprite | Fine. Blueprint pane → tech illustration or the ship illustration |
| **Tech choice / breakthrough scene** | Scientist at a console | Photoreal lab scene with the race scientist, list on the right | **This is the target quality for every scene.** Nothing to fix |
| **Races** | Three rows: portrait, treaty, attitude bar, spy slider | Same with photoreal portraits; "NOT PRESENT" boxes are large empty bronze slabs | Fill absent slots with a dimmed race line-up or the player's own homeworld; everything else echoes well |
| **Audience** | Hologram diplomat, teal text box with Greek-key brackets | Photoreal leader + hall, teal box with bracket columns, **a flat blue hooded "envoy" silhouette in the foreground** | Replace the blob with the unused race `figure` art (full-length photoreal envoy, 10 races), rim-lit and slightly out of focus; soften the grade (the hall photo is dimmed to near-grey — the lab scene shows the right balance) |
| **Council** | Arched chamber, portraits in alcoves, tally at the top | Arched chamber, portraits in alcoves, galaxy hologram, tallies | Good echo; too murky overall (raise key light 20 %), the unused race `council` art could sit in the alcoves at full height |
| **GNN** | Anchor at a desk, broadcast panels | Photoreal studio, anchor, lower third, ticker | Excellent; only the cartoon ships in the news graphic let it down |
| **Landing / ground / bombard** | (scene screens) | Photoreal surfaces, chips, name prompt | Excellent backdrop; the plan-view ship sprite is out of scale and unlit on it — an illustrated lander (or a photo-treated silhouette with ground glow and shadow) |
| **Combat** | Black starfield, tiny sprites, red selection box, 8-button bar | Blue grid on black, cartoon sprites, grey blob asteroids, flat planet, clear command bar | Backdrop from the `system` or `scene-galaxy` art with a slow parallax; lit ship art; asteroids from rendered sprites; planet with limb glow; grid lines only near the cursor; beam/explosion FX pass (09 §2.6) |
| **Endings** | Full-screen illustration | Photoreal portrait inside a flat vector set (clip-art crown, flat banners, flat skyline) | Rebuild each ending from the race `council` / `homeworld` art with a photo-treated crown or wreath; the portrait already carries it |

## 3. The rules that would make it coherent

1. **Nothing flat or vector sits in front of a photograph.** Every foreground element over illustrated art is itself
   illustrated, or rendered with light, shadow and grain (`Gfx.Grade` at scene strength) so it belongs to the plate.
2. **One light per screen.** Scenes already have it. The map and combat need a key light too: a warm glare from the
   nearest bright star, cool fill from the nebula, so sprites and planets read as lit objects, not stickers.
3. **The original's layout is the layout.** Keep the wide landscape planet box, the gantry build box, the bracket
   reticle, the 4-point star glyph (as a modern sprite), the chrome wordmark, the hand cursor (as a custom cursor
   on hover targets — a cheap, instantly recognisable touch).
4. **Grade for cinema, not for gloom.** The current grade pass darkens halls and the council to grey; target the lab
   scene's balance (full-colour art, vignette 15 %, grain 2 %).
5. **Ships are one family.** Whatever renders a ship (map glyph, card, combat, landing, GNN) must come from the same
   source so the fleet the player builds is the fleet they see fighting.

## 4. Plan, in priority order

**Phase A — remove the collisions and modernise the map (1–2 days, no new assets)**
1. Audience: replace the envoy silhouette with the race `figure` art (crop to waist, rim light, 4 px blur, grain).
2. Endings: rebuild the four ending sets from race `council`/`homeworld` art; crown/wreath as a photo-treated layer.
3. System view: `system-<colour>` illustration as backdrop; sun from the plate; keep the GL planet in front.
4. Colony panel: full-width landscape orbit card, bigger build box with the shipyard look, fill the empty lower third.
5. Galaxy map: star sprites (blackbody tint, tight core, spikes on the brightest), territory tint, trails on fleet
   chevrons, bracket-only reticle, parallax deep layer. Verify the GL nebula on a real GPU and cap its luminance.
6. Grade: soften the hall/council darkening to the lab scene's level; raise key light in the council.
7. Title: metallic 3-D wordmark treatment (CSS/canvas, no asset); focus ring on the menu.

**Phase B — ship art commission (the same pipeline that produced the 115 world illustrations)**
- 10 races × 5 hulls, two views each: a 3/4 beauty angle for cards/design/landing/GNN and a lit top-down for the combat
  grid; plus 8 asteroid/debris renders and 6 combat backdrops. Transparent webp, ~110 files, ~10 MB.
- Integrate: design preview, fleets ledger, system cards, pre-battle card, combat grid, landing lander, title hero,
  GNN graphics. Keep the procedural sprite only as the map glyph and the offline fallback.

**Phase C — combat and ambience (2–3 days)**
- Combat FX pass (HDR-ish beams, 4-stage explosions, missile plumes, shockwave) per `research/09` §2.6, grid near cursor
  only, planet limb glow, camera nudge on hits.
- Map ambience: 1 Hz low-amplitude twinkle, drifting dust, slow planet rotation in the side panel, 160 ms panel reveals.
- Chrome contrast pass on the bronze screens (D-report items 1, 4, 5) and the hand cursor.

**Not recommended now**: the procedural 3-D ship/portrait renderers from `research/09` §8 — the illustration pipeline
has already delivered higher quality faster; spend the effort on commissioning and integration instead.

## 5. Acceptance (screenshot-testable)

- No flat/vector element over an illustrated plate on audience, endings, landing, GNN, system view.
- Map at 1080p: stars read as lit points with tint variation; a selected star shows brackets only; fleets show trails.
- Colony panel: planet image ≥ 70 % of panel width; no empty band taller than 10 % of the panel.
- Every ship the player sees (card, grid, scene) comes from the same art source per race × hull.
- Scene grade: mean luminance of the audience hall within 15 % of the lab scene's.
- Zero console errors at tiers low/high and GPU off; works from `file://`.
