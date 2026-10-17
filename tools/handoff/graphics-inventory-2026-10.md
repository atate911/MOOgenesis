# Graphics upgrade audit — what is still cartoonish (October 2026)

Question from the product owner: *have all of the old cartoonish graphics been upgraded? If not, what is left?*

Method: every screen where art appears was captured at 1920×1080 through the real UI (`node tools/qa/art-shots.js`,
Playwright + headless Chromium), once on the default tier of this sandbox (software GL = Canvas2D fallbacks) and once
with `TIER=medium` (the WebGL2 planets and nebulae real hardware gets). Each element was then traced to the module that
draws it, so "photo", "GL" and "procedural" below are what the code does, not an impression.

## Verdict

**The character and scene layer is done.** Every place a face, a room, a surface or a planet plate is shown now uses the
commissioned illustrations: portraits (10), audience halls + the envoy figure, scientist labs, GNN studio + event stills,
landing / ground / bombard surfaces, orbit plates in the colony panel and the discovery cards, the title galaxy, the
setup wizard, and three of the four endings. Theme v2 chrome is the default everywhere. None of these read as cartoonish.

**What is left is the *object* layer**: ships, the tactical battlefield, the star-system view, the galaxy map's star glyphs
and a handful of flat markers drawn on top of photo plates. These are the same holdouts the immersion review named as
Phase B / Phase C; Phase A was delivered, Phase B was delivered in a reduced form (one top-down view, no race variants),
Phase C was not started.

## Inventory — done (no action)

| Where | Now drawn with | Verified |
|---|---|---|
| Race portraits everywhere (setup, Races, Council alcoves, audience bust, GNN anchor, badges, almanac) | `assets/races/*.webp` via `Gfx.Portraits` photo path | setup-2, races, council, audience, gnn, help |
| Audience | race `audience` hall + leader photo + player's race `figure` as the envoy (`audience.js drawEnvoyArt`) | audience |
| Breakthrough / choose-next scenes | race `scientist` plate (`tech.js` TechScenes) | techscene-break, techscene-choose |
| Council | drawn chamber (procedural, cinematic quality) + photo portraits in the alcoves, hologram | council |
| GNN | `gnn` studio plate, bust-masked anchor, event stills on the video wall (`gnn.js photoStudio`) | gnn |
| Landing / invasion / bombardment backdrops | `surface-*` plates, `scene-ground-battle` | landing-colony, landing-invade |
| Colony side panel, explore / colonise cards | wide `orbit-*` plate (`side-colony.js`, `side-misc.js`) | galaxy-colony |
| Endings: Council victory, conquest, defeat | race `council` + `figure` plates; `event-devastated` | ending-council, ending-conquest, ending-defeat |
| Title backdrop | `scene-galaxy` plate + live planet | menu |
| Planets (GL tier) | `GLPlanets` relief / clouds / lights | system-gl, landing-bomb-gl |
| UI chrome, icons | theme v2, the chamfered vector glyph set (consistent, not cartoonish) | all |
| Ship hulls (first pass) | `assets/ships/*.webp` top-down renders, 9 classes × 2–3 variants, banner recolour (`ships.js` PHOTO) | design, fleets, system, combat |

## Inventory — still cartoonish / flat (action needed), by effect on the game

1. **Ships exist in one view only (top-down, race-neutral).** Every ship the player sees is the same plan-view render,
   including places where the camera is not above the ship: the lander hovering over the beach at ground level
   (landing-colony), the bombers over the planet's limb (landing-bomb), the exile ending, the title fly-by, the design
   hologram, the fleet and system cards. The 3/4 "beauty" view and the per-race silhouettes from the immersion review's
   Phase B were never commissioned; `tools/handoff/ship-art.md` lists "races no longer differ by silhouette" as a known
   limit. *Action:* commission the 3/4 view (10 races × 5 hulls, or at least one 3/4 set per hull class) and use it for
   design preview, cards, landing, bombard, title and endings; keep the top-down set for the combat grid and the map.
2. **Tactical combat screen** (combat-planet, combat-big, combat-planet-gl): asteroids are the grey procedural blobs
   (`combat-fx.js rockSprite`), the backdrop is a plain grid over a faint starfield with no plate, the star is a flat glow,
   missile bases are small orange gear icons ringed around the planet, the selection frame is still gold (the restyle note
   asked for the original's brick red). Phase C (FX pass, grid near the cursor only, planet limb glow, rendered asteroid
   sprites, a backdrop plate) was not started. *Action:* 6–8 rendered asteroid/debris sprites + a backdrop per star colour
   (the unused `system-*` plates can serve), base icons as lit sprites, the FX pass.
3. **Star-system view** (system, system-gl): procedural nebula smear + procedural sun; on the GL tier the sun renders as a
   blotchy yellow disc with no limb darkening (the "cheese" look), on the CPU tier as a cracked orange texture. The six
   `system-<colour>` illustrations are still unused (`assets/world-art/README.md`, confirmed: no caller in `system.js`).
   The CPU planet at this radius is visibly pixelated. *Action:* use the system plate as the backdrop (sun from the plate,
   GL planet in front), or at minimum fix the GL star shader's limb/granulation.
4. **Galaxy map star glyphs** (galaxy, galaxy-late-gl): explored stars now have proper sprites with spikes, bracket-only
   selection and the territory tint are in, but unexplored stars — most of the map for most of the game — are still flat
   coloured discs with a dotted ring. The nebula is a soft procedural smoke on both tiers; dust lanes, parallax depth
   and fleet trails from the review's item 5 are partial. *Action:* blackbody-tinted point sprites for unexplored stars
   (dim, no ring), verify the GL nebula on real hardware, finish trails/parallax.
5. **Exile ending** (ending-exile): the only ending without a plate — procedural starfield, CPU planet (pixelated), a
   top-down ship. *Action:* a plate (race `homeworld` receding, or `scene-galaxy`) with the ship as a 3/4 silhouette.
6. **Invasion troop markers** (landing-invade): the two armies are rows of flat vector figures (`landing.js soldierSprite`)
   standing on a photoreal battlefield — the "flat element over a photograph" collision the review's rule 1 forbids.
   *Action:* photo-treated silhouettes (grain, ground shadow, heat shimmer) or a count readout instead of figures.
7. **Title wordmark** (menu): flat gold gradient text; the original's signature is a lit metallic 3-D wordmark. The
   title ship is a tiny top-down sprite. *Action:* a layered CSS/canvas metallic treatment; a 3/4 hero ship once (1) lands.
8. **Bombardment overlay** (landing-bomb): the shield is a dotted red circle and the targeting reticle a thin vector
   cross over the GL planet. *Action:* a soft shield glow + limb-hugging rim, a lit reticle.
9. **Smaller flat spots** (low priority): the Planets ledger shows a coloured dot instead of an orbit thumbnail; the
   Fleets ledger's planet thumbnail is the CPU sprite; the colony build box is a mesh texture with a tiny sprite (the
   original had a gantry picture); event cards are icon + text modals although 8 `event-*` plates exist (used only in the
   GNN); the Races screen fills absent rivals with empty "NOT PRESENT" slabs; the tech picture pane is a vector blueprint
   hologram (clean, but the last vector art on an otherwise illustrated screen).

## Delivered art that is still unused

`system/*` (6), race `homeworld-square` (10), colony `fortress` / `industrial` / `polluted` (3; `WorldArt.colonyPath`
accepts the flags but no caller passes them), race `council` outside the endings (10; the council alcoves use portraits).
Items 3, 5 and 9 above would consume most of these.

## Tier dependence (not cartoon, but a quality cliff)

Without WebGL2 (software GL, `?tier=low`, GPU off) every planet is the Canvas2D sphere, which is pixelated at the
system-view and bombard radii, and the sun loses its surface. Real-hardware timings were never captured
(`tools/test-hw.html?auto=1` is still due). The illustrated layer does not depend on the tier.

## Housekeeping flagged on the way

The PNG masters (`assets/world-art/`, 266 MB), the fleet evaluation set (`MOOg images/`, 41 MB) and `Race photos/`
(22 MB) are tracked in git (pack ≈ 467 MB; review item 44). Not a graphics defect, but every clone and CI checkout pays
for it; git-lfs or a separate assets-source repo is the fix once the next art drop lands.

## Re-checking

`node tools/qa/art-shots.js [WxH]` (add `TIER=medium` for the GL look) writes one PNG per screen to `tools/out/art/`.
Acceptance for the next pass, from the immersion review: no flat or vector element over an illustrated plate on audience,
endings, landing, GNN and system view; every ship the player sees comes from one art source per race × hull; a selected
star shows brackets only; stars read as lit points with tint variation.
