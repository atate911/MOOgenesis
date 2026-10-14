# MOOgenesis — cinematic world art

## GNN studio

The [GNN studio backdrop](gnn/README.md) provides an empty race-neutral broadcast set, with room for a live anchor, story graphics, and headlines. Its [asset manifest](gnn/asset-manifest.json) records composition and integration guidance, including the baked-in desk. The image has embedded metadata and a matching JSON sidecar; it is not yet connected to the game renderer.

## Race artwork collection

The [races collection](races/README.md) adds 60 images across all ten races: audience halls, scientists, full-body leaders, homeworlds, council delegates, and square homeworld companions. Browse its [gallery](races/index.html) or use its [AI asset manifest](races/asset-manifest.json). Each PNG retains race/purpose filenames, embedded metadata, and a matching JSON sidecar. Paths in that manifest are relative to `assets/world-art/races/`. This collection uses the case-sensitive PNG metadata key `MOOgenesis.asset`; the original world collection below uses `MOOgenesis.Asset`.

## Original world artwork collection

54 original PNG illustrations generated with the built-in image generation tool, using the supplied brief and the local MOOgenesis repository for context.

Open `index.html` to browse the collection. For AI-assisted integration, start with `asset-manifest.json`. Each PNG has both a same-name JSON sidecar and embedded PNG iTXt metadata under the key `MOOgenesis.Asset`. The sidecar additionally supplies the collection-relative `file` path. Full generation and revision prompts are in `generation-prompts.json`.

## File organization

| Folder and filename prefix | Count | Intended placement |
| --- | ---: | --- |
| `orbit/orbit-*.png` | 17 | Exploration, colonisation confirmation, planet-list thumbnails, planet news |
| `surface/surface-*.png` | 14 | Surface arrival, invasion and bombardment backgrounds |
| `system/system-*.png` | 6 | System backgrounds selected by star color |
| `colony/colony-*.png` | 6 | Settled-world colony screens and news |
| `event/event-*.png` | 8 | Specific GNN event and news illustrations |
| `scene/scene-*.png` | 3 | First landing, ground battle and galaxy/menu scenes |

Filenames exactly match the supplied brief, including `orbit-asteroids.png` versus `surface-asteroid.png`.

## Dimensions

These are native generator outputs: square cards are **1254 × 1254**, and landscape images are **1672 × 940 or 941**. They have not been upscaled. They therefore do **not** meet the brief's exact 1536 × 1536 and 1920 × 1080 dimensions. Every metadata record contains both actual and requested dimensions; consult the actual dimensions when laying out or exporting. Landscape aspect ratios are approximately 16:9.

## AI integration guidance

- Treat `asset_id` as the stable identifier and `file` as the relative image path. `intended_uses`, `selection_hints`, `semantic_subject`, `colony_state_hint`, `composition`, and `usage_constraints` describe placement and selection.
- The repository uses `planet.type` for base terrain, `planet.growth === 'gaia'` for Gaia, `planet.special` for Artifacts and Orion, and `star.color` for the six system colors. Type `none` is rendered as asteroids. Selection hints describe these data properties; they are not a new API.
- The manifest's precedence is a suggested art-selection policy, not an existing implementation. Preserve exploration visibility and game rules when deciding what a player can see.
- Orion contains a visible Guardian. Use it only while the Guardian is alive; a separate post-defeat image would be needed. The Terran orbit card includes city lights because the brief requested them.
- Orbit/surface partners match a world category and art direction, not exact geographic features. The visible moons and structures are illustration details; they do not add simulation objects.
- These are finished flat illustrations, not equirectangular maps, transparent sprites, or textures for a rotating sphere. Preserve their aspect ratio. Prefer `contain` for orbit cards; inspect crops and text contrast on wide backgrounds.
- System art is generic terrain selected by star color. Green and purple are game art cues; the repository identifies purple as a neutron-star category.
- Colony and event descriptions are semantic selection guidance, not verified numeric thresholds or event API names.
- Candidate source modules are listed in each record. Integration should retain lazy loading, procedural fallback and offline `file://` support, following the existing portrait-image approach. No game source code has been changed by this asset delivery.
- Embedded metadata was added without changing image pixels or removing original PNG chunks. Keep sidecars with images if an image optimizer strips embedded metadata.

## Repository reference

Repository: https://github.com/atate911/MOOgenesis

Local checkout consulted: `E:\claude\MOO`.

Context came from `README.md`, `briefs/art-direction.md`, `tools/handoff/portraits-photo.md`, an existing human race portrait, `js/gfx/planets.js`, `js/sim/galaxy.js`, and the system, landing and colony UI modules. Candidate module paths are repository-relative.

## Verification

`validation-report.json` records the image count, dimensions, PNG checksums and metadata consistency results. Exact requested dimensions remain an acknowledged limitation.
