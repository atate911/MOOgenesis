# Visual system plan — one place, three layers

Brief from the product owner: close the "beauty gap" between the cinematic scenes (title, landing, audience, council, news) and the
screens a game is mostly played on (map, consoles, ledgers, combat). Direction agreed: the game is one place, built from three layers
on every screen — **the sky** at the back (the universe, continuous), **glass** in the middle (dark translucent surfaces that carry data
and art), **the frame** in front (the ship's chrome: leather, steel, brass). One sky, one glass, one frame, one light, one palette, one
motion. The original's layouts and screen families stay; what changes is the material each is made of.

## What is already there (tune, do not rebuild)

| System | Where | What it already does |
|---|---|---|
| Colour grade | `js/gfx/grade.js`, applied in `js/gfx/scenes.js` (`GRADE` table) | Per-scene presets (`room`, `scene`, `space`, `portrait`, `plate`): tone curve, cool multiply, vignette, grain, bloom; off on the low tier. |
| Space backdrops | `js/gfx/space.js`, `js/gfx/gl-space.js` | `makeBackdrop(w, h, seed, {palette, intensity, stars, dust, vignette})`, baked parallax starfields, `drawLive` (drifting nebula + twinkle), star sprites with spikes, animated star surfaces. The GL path has domain-warped nebulae and dust lanes. |
| Galaxy map | `js/ui/galaxymap.js` (`ensureAmbient`, `drawBackdrop`, `paintBackdropStatic`, `farRect`) | Two parallax star tiles, far-plane sky anchored to the galaxy (z^0.35), dust drift, 52 twinkling sparkles, living sun surfaces when zoomed in, a territory field, all gated by `Perf.q`. The static part is cached and blitted. |
| Combat board | `js/ui/combat-fx.js` (`buildGridLayer`, `drawGridNear`, `drawPlate`) | No full line grid already: faint checker, intersection dots, cells only near the cursor and the acting unit, corner brackets; a photoreal battle plate or the system plate behind it; the scene backdrop is graded and cached at 24 Hz. |
| Screen changes | `js/ui/screens.js`, `css/theme-v2.css` (`.screen.fade-in`, 180 ms) | A fade-in on the entering screen; no fade-out, no shared background. |
| Menu backdrops | `js/ui/setup.js` `UI.Controls.backdrop(seed)` | One cached 1280×720 nebula per seed, used by Options, Save/Load, Setup, Help. |
| Glass | `js/ui/galaxy.js` `.gx-hud` | Dark translucent slab, 4px blur, brass 1px edge, chamfered corners: the reference glass. |
| Planets | `js/gfx/gl-planets.js` | Fresnel atmosphere and halo, night lights, cloud shadows, rings. |
| Quality tiers | `js/core/perf.js` | `Perf.q` (dpr, nebula, glow, bloom, particles, animFps) per tier; `reduceMotion`; `<html data-fx>`. |

The gap is not missing machinery. It is five different skies, four different glasses, and mid-tone fills where there should be black.

## Phase 1 — the sky, the glass, the hairlines (code only, keeps every layout)

**1. One sky palette and exposure.**
- Add `Gfx.Space.SKY` (and read it in `GLSpace`): one palette and one set of knobs for the whole game. Today the map asks for
  `['#2a1d78', '#14357a', '#3a2a7a', '#0d4f7a']` at intensity 0.42 and the menus for `['#2b2a86', '#14357a', '#5b2a86', '#0d4f7a']` at 0.85:
  four indigos, no black, no warmth. Target: true black over most of the frame, one warm core (`#c9a26a` family, low alpha), cool violet
  wisps (`#2a1d78`), dust lanes on (GL `dust: 1`), intensity ≈ 0.3 at the fit view. Tune against `assets/art/scene/scene-galaxy.webp`,
  which is the canonical look (the title screen).
- `galaxymap.js ensureAmbient`: use `SKY`; drop the ambient cloud alpha (0.32 with an external backdrop) to ≈ 0.18; recolour the gameplay
  nebulae (`buildGameNebula`, purple additive) toward the same violet so they read as part of the sky, not a layer on top; raise the
  backdrop cap from 1600×900 to the canvas size on the high and ultra tiers (the cached `bdc` keeps the per-frame cost) so 4K is not an
  upscaled 1600-wide image.
- The Canvas2D fallback gradient (`amb.grad`) gets the same palette.

**2. A persistent sky under every screen.**
- `index.html`: a `<canvas id="sky">` before `#screens`; `js/ui/kit.js` (or a small `js/ui/sky.js`): paint it once from
  `Space.makeBackdrop(SKY)` at the window size (resize-aware, like `UI.Controls.backdrop`), never per frame; a slow 60-second drift
  via CSS transform on the high tiers only; still under `reduceMotion`.
- Screens that paint their own sky stop doing so and go transparent over `#sky`: Options (`.op-wrap`), Save/Load, Setup, Help, Almanac
  (`UI.Controls.backdrop` stays as the fallback when `#sky` is absent), the ledgers' `scene-galaxy` under brown (`.lp`, `.lf-body`), the
  Design screen's faint starfield. The galaxy map and the full-screen scenes stay opaque: they are the sky.
- `screens.js`: add a 180 ms fade-out on the leaving screen (`.fade-out`, removed with `.active` after the animation) so a screen change
  is a cross-fade within one place; phones keep the cheaper `ph-scr-in`.

**3. One glass.**
- `css/theme-v2.css`: tokens `--glass: rgba(6, 9, 20, .72)`, `--glass-edge: rgba(214, 179, 106, .35)`, `--glass-blur: 4px`, and a
  `.glass` helper (background, 1px edge, `backdrop-filter` on desktop tiers only, none on phones).
- Apply it to: `#tip`, `.toast`, the turn log, the map key (`.gmap-legend`), event cards (`.sm-event`), the system view's labels and
  planet-data box (`.sv-own`, `.sv-lab`, `.sv-data`), the pre-battle card, the combat unit plate (the steel command bar stays: it is the
  original's), the audience dialogue panel (`.au-panel`: teal fill becomes glass with a 3px rail in the speaking race's colour), the news
  lower third, the council tally bar, modal bodies. Rule: a family's colour (teal, indigo, brown) becomes a rail or a frame, never a fill.

**4. Dark wells, brass hairlines on the consoles and ledgers.**
- Tokens: `--well` → near-black (`#0b0d12` on steel, `#14100c` on leather), `--hair: rgba(255, 235, 200, .14)`, `--hair-w: max(1px, .06rem)`.
- `tech.js` `orig-brown` (`--o-well`, `--o-well2`, `--well`), `ledger-planets.js` / `ledger-fleets.js` (`--bz-slot`, the table rules),
  `side-colony.js` (`--slotbg`, `--slot-edge`), `design.js` panes: wells take the dark token, table and divider rules take the hairline,
  empty well areas show `#sky` through (the ledgers are mostly empty early in a game). Bevels stay on buttons, plates and panel frames.
- Check text contrast on the new wells (a 2-minute script over the screenshot set: sample ink over well pixels).

**5. Palette consolidation.**
- Replace the ad-hoc golds and tans (`#f3dca0` ×34, `#d6b36a` ×33, `#ffd54f` ×13, `#ffd36a`, `#f0d048`, `#ffc860`, `#fff1a8`, `#e8c850`,
  `#ffc04a`) with the tokens (`--brass-hi`, `--brass`, `--gold`, `--title-hi`, `--slot-ink`), one script, one screenshot diff per screen.

Done when: `tools/qa/art-shots.js` at 1920×1080 and 3840×2160 (`TIER=high` and `ultra`) shows one sky on every screen, before/after pairs
per screen are in `tools/out/`, phone QA (three profiles), rules tests and the layout fingerprint are green, and the owner has looked at
the map on a real GPU (the headless renderer is software: the GL nebula and bloom cannot be judged here).

## Phase 1 — done (branch `claude/visual-system`, five commits)

| Step | Commit | What landed | Notes for the next pass |
|---|---|---|---|
| 1.1 one sky | `Visual system 1.1` | `Gfx.Space.SKY` + `Space.sky(over)`; `floor` and `warm`/`warmK` options in both painters (`space.js`, `gl-space.js`: `uFloor`, `uWarm`); the map (`ensureAmbient`), the title fallback (`menu.js`) and `UI.Controls.backdrop` read it; the map's cloud layers recoloured, gameplay nebulae dustier, GPU backdrop at device resolution on the high tiers. | The CPU painter has no tone curve, so `sky()` marks its options and the CPU path halves the intensity (`opts.sky`). Tuned on contact sheets (`scratchpad/qa/skytest.js`, variants over `Space.sky`). The gameplay nebulae must stay readable (a rule): they are dustier, not dimmer; check them on a real GPU. |
| 1.2 persistent sky | `Visual system 1.2` | `js/ui/sky.js` (`UI.Sky.install()` from `main.js`): `<canvas id="sky">` under `#screens`, painted once per size, drift on the high tiers only, `--sky-img` data URL for the ledger wells (`background … fixed`), `<html class="has-sky">`; Options / Save-Load / Setup drop their painted backdrop; `screens.js` adds `.fade-out`. | `background-attachment: fixed` is not honoured on iOS, so phones keep the plain well (the rule is `:not([data-phone])`). The data URL is ~30–150 KB; encoded in an idle callback. |
| 1.3 one glass | `Visual system 1.3` | `--glass-bg`, `--glass-line`, `--glass-filter` and a central list of glass surfaces in `theme-v2.css` (section 7b, triple-`:root` so it beats the per-screen restyles): tooltip, toast, map key, planet-data box and labels, pre-battle boxes, turn log, council tally, audience panel (teal fill gone, brass frame + rails). | The news lower third is drawn on canvas (`gnn.js`), so it is not on the list: Phase 2 (scene grade) is where it changes. `backdrop-filter` is off on phones and `data-fx="off"`. |
| 1.4 wells + hairlines | `Visual system 1.4` | `--well-leather`, `--well-leather-2`, `--well-steel`, `--hair`, `--hair-w`; the brown family's wells (`tech.js` orig-brown tokens, `.tch-list`, `.tt-scroll`, `.rp-age`), the ledgers' `--bz-slot`, boxes and stat slots, the Map overview key face, the colony panel's `--slotbg`; table rules and dividers on the hairline. Contrast of every ink over the new wells is 7:1 or better (`scratchpad/qa/contrast.py`). | The Races screen's section boxes (`.rc-sec`) and the Design screen's panes were left as they are (already dark). |
| 1.5 palette | this commit | CSS contexts only: `#f0d048` → `--slot-ink`, `#e8c850` → `--title`, literal `#ffd36a` → `--title-hi`, `#ffc860` selection rings → `--sel-line`. | The ~90 remaining literal golds are in canvas code (tech motifs, news graphics, setup badges) where a CSS token cannot be read; they are the same three values everywhere (`#f3dca0`, `#d6b36a`, `#ffd54f`). A shared JS palette constant would be the next consolidation if one is wanted. |

Verified per step with screenshots (`scratchpad/shots/fix/vs*-*.png`, before/after pairs at the low and high tiers), `check.js`, the rules tests,
and at the end the three phone QA profiles and a 30-turn run. The headless GPU is software (SwiftShader): the GPU sky, bloom and
drift were seen here at `TIER=high` but judge them on real hardware.

## Phase 2 — combat, continuity, scenes

**6. Combat as a tactical hologram.** `combat-fx.js`: checker alpha from 0.028 to 0.015 and the intersection dots a shade dimmer; the
planet decor through `GLPlanets.sprite` with the atmosphere halo at the board's size; an idle engine glow on every unit (there is a
flame sprite in `Gfx.Ships`); beam bloom through `gl-fx` where `Perf.q.bloom`; when no battle plate fits, prefer the star's
`system-sky` plate (`WA.systemSky(color)`) over the bright system plate, graded `space`. Unit plate on glass. The board, the rules and the
steel bar stay.

**7. Map → system continuity.** `galaxy.js` / `galaxymap.js`: opening the system view first flies the camera to the star
(`flyTo`, zoom ≈ 6, 0.4 s), then `Screens.go('system')` cross-fades; returning restores the previous camera. `system.js`: `.sv`
background from `SKY`, the fleet tiles and the planet-data box on glass, the GL planet with `atmosphere` and the ocean specular on
(`gl-planets.js` has both), a larger star corona (`Space.drawStarSurface` radius) on the high tiers.

**8. One grade on every scene and plate.** Audit every full-screen canvas: `landing.js` draws its own vignette/fade (route it through
`Grade.apply('scene')`), `menu.js` (galaxy plate: `plate`), `endings.js`, `gnn.js` studio (`room`), the Design pane (`plate`, light).
Align the `room` preset's exposure with `scene` so the audience, council and newsroom match the landing. DOM plates
(`WorldArt.image`) get a `.wa-plate` class with a CSS filter token (`saturate(.92) contrast(1.04)`) so canvas and DOM art match.
Slow drift on stills: a `drift` option in `WorldArt.draw` (zoom 1 → 1.04 over 40 s) used by the audience and council backdrops, the
Report dossier and the colony postcard; off under `reduceMotion`.

**9. Design screen.** The ship pane on glass with the same slow drift; the 3/4 render where it exists.

**10. Phones.** Map the `--pk-*` family tokens (`css/phone-skin.css`) to the new well, hairline and glass values so the phone is the same
system compressed; surfaces stay flat (no blur on phones).

## Phase 2 — done (same branch, one commit)

| Step | What landed | Notes |
|---|---|---|
| 2.6 combat | `combat-fx.js`: checker .028 → .015, dots .22 → .16; `drawPlate` tries `WA.systemSky(star)` (mode `sky`, star position from a local `SKY_STAR` table, lighter darkening) before the system plate; idle `thrust` breathes; the planet is `GLPlanets`/`Planets.draw` with `atmosphere, clouds, cloudShadows, lights` and `R` ×1.1. | The steel command bar and its blue-steel name plate stay (the original's). Beam bloom through `gl-fx` was not added: the beams already go through `Gfx.Fx`, and a bloom pass needs the GL path, which cannot be judged here. |
| 2.7 continuity | `galaxy.js` `dblStar`: `centerOn(id, {zoom: max(5, zoom×1.6), animate})`, then `Screens.go('system')` 420 ms later; `UI.Galaxy.camBeforeSystem` holds the camera and `enter()` flies back to it. `system.js`: the no-art fallback backdrop is `Space.sky({warm: starColor(kind).glow})`. | Reduce motion and phones cut straight across. The system view's star corona was left: with the sky plates the plate carries the star. |
| 2.8 grade | `WorldArt.draw` gains `drift` (+`t`): a slow push-in over ~40 s, off under reduce motion; the audience hall uses it (`scenes.js`). `WorldArt.image` tags `img.wa-plate`; `theme-v2.css` 7c gives it the plate grade as a CSS filter (a screen's own filter wins). `Grade.apply('plate')` on the title's galaxy (`menu.js`), the news studio photo (`gnn.js`), the exile plate (`endings.js`); `'scene'` on the ground-battle art (`landing.js`). | The council plate was not given drift: its booths are placed in plate coordinates and would slide. The `room` preset was not re-tuned (owner's call on hardware). |
| 2.9 design | `design.js` `makeBg`: the one sky under the hologram grid, the indigo dome as the fallback. | |
| 2.10 phones | `phone-skin.css`: gunmetal / bronze / leather `--pk-well` → the phase 1 well blacks, `--pk-sep` → the hairline. | |

## Balance pass — done (same branch, one commit)

The owner asked for a look at spacing, overuse of visuals, colour and luminosity balance, specular highlights and contrast before a live
review. Harness: `scratchpad/qa/audit.js` (per screen: a screenshot plus every visible text element's rect, colour, size and every box's
padding / gap) and `audit.py` (WCAG contrast of each text against the most common colour behind it in the screenshot; mean luminance,
black and highlight shares, saturation; distinct spacing values in rem). Worth keeping as `tools/qa/audit.js` if the owner wants it.

| Finding | Numbers | Fix |
|---|---|---|
| The leather family was far brighter than the rest and its frame text failed | mean luma 65–95 vs 18–37 elsewhere; `.lp-sub`, `.lf-sub`, `.rx-sub`, `.rx-prompt`, even `.lp-title` on the bright corner: 2.3–3.0:1 | `--bz-hi`/`--bz-md`, `--o-fill`/`--o-hi`, `--bronze*` and the literal leathers darkened (#b39677 → #8c7458, #826551 → #6d5645), sheet gradients reach the mid tone at 8 % instead of 18 %; frame text now 4.2–5:1; Report 95 → 55 mean luma |
| Copper primary buttons | dark ink sampled at 2.9–3.7:1 at 15 px (its light text shadow haloed it) | `--gold-2` #c8741a → #dc8c2c, `--copper-2` → #c06a20, ink #1a0a02, shadow alpha .3 |
| Disabled buttons | whole-button opacity .45: 1.5–2.5:1 | opacity .72 + grayscale; a disabled primary (and the Design screen's `.dz-off`) is a grey plate with cream ink |
| Report dossier caption | 2.3–2.6:1 on dimmed clouds: the `::before` scrim was under the `<img>` (DOM order) | scrim `z-index:1`, caption `z-index:2`, scrim darker from 62 % |
| Dim text in black wells | `.lf-srow.none` 1.9:1, `.gl-row.dim` 2.9, `.ov-kr.zero` 2.6, `.tt-chip.locked` 2.2 | opacities lifted (.55→.7, .45→.6, .42→.58, .5→.68); the empty-slot name is pale, not dim orange |
| Orange box-title tier | `#f48201` 3.4:1 on the box faces at 19–21 px regular | `--head-orange` #ff9420 in 600 weight (large-text rule); the family's `--title` and `--o-head` read it |
| Research screen | tab hotkeys 3.4, rose 3.4, selected row 3.3, unit "RP" 3.2; the per-row level number was a loud green | hotkeys full opacity (white on the active tab), rose #ff9a88, `--o-sel` #5c3810, unit cream, level numbers cream at 1.15rem |
| Design screen | white on orange hull pick 2.2:1; five bright orange section slabs; selected card's orange/teal ink 3.3–3.6 | copper tier with dark ink for the slabs and the pick; cream ink on the selected card; steel button faces a shade darker (4.1 → 4.6) |
| Overuse | full-screen 1px scanlines on `#app::after`; teal scanlines on `.au-panel::after`; the territory haze | scanlines removed (vignette stays); haze ×0.75 |
| Specular | 12 distinct bevel-highlight alphas (.08–.4) | `--spec: rgba(255,245,225,.22)` replaces every value ≥ .25 |

Spacing, measured and left: 14–39 distinct padding/gap values per screen, 66–98 % of them off a ⅛-rem step. At the root size that is
sub-pixel noise (0.36 vs 0.375 rem = 0.2 px) and the macro rhythm (head bands, box gaps, footers) is consistent screen to screen, so a
mechanical normalisation to a {.25 .5 .75 1 1.5} scale would move layouts for no visible gain. Recommended as a separate cleanup with the
layout fingerprint and the phone QA as the guard, not here.

Still failing by the numbers, on purpose: locked tech chips and zero-count key rows at ~3:1 (dimness is their meaning), the phone tab bar's
Next turn (the sampler reads the bar as its background; the gold plate is 9:1 in the pixels), and the headless sampler's 3.5–3.9 on the
copper buttons (anti-aliased glyph edges; the ink itself is 5:1).

## Finish pass — done (same branch, one commit)

The owner asked for the tells of an unfinished interface, for where shading and shadowing are strong or weak, and for the histograms of
the raster art against each other and against the interface. Harness in the scratchpad: `finish.js` (per screen, in the DOM: clipped
text, sibling buttons of unequal height, distinct font sizes, edge colours, drop shadows, chamfers, mixed capitalisation inside one
container, three-dot truncations, the light direction of every bevel) and `histo.py` (RGB statistics of every raster by set, the outliers
inside each set, and the same statistics for regions of the audit screenshots). Worth promoting to `tools/qa/` with `audit.js`.

### Histograms (RGB; L = mean luma 0–255, p50 its median, warm = R − B of the mean colour)

| Set | n | L | p50 | warm | blacks < 8 | whites > 248 |
|---|---|---|---|---|---|---|
| audience halls | 10 | 48 | 31 | +20 | 19 % | 0.1 % |
| council chambers | 10 | 54 | 42 | +23 | 8 % | 0.1 % |
| figures | 10 | 30 | 17 | +11 | 13 % | 0 |
| scientists | 10 | 49 | 30 | +19 | 7 % | 0.1 % |
| homeworlds | 10 | 58 | 39 | +10 | 29 % | 0.2 % |
| portraits | 10 | 39 | 25 | +9 | 14 % | 0 |
| orbits | 17 | 41 | 9 | +7 | 49 % | 0.1 % |
| surfaces | 14 | 78 | 71 | +33 | 3 % | 0 |
| events | 8 | 43 | 28 | +10 | 18 % | 0.1 % |
| colony plates | 6 | 42 | 18 | +5 | 43 % | 0.1 % |
| system skies | 6 | 21 | 7 | −1 | 57 % | 0 |
| battle boards | 4 | 9 | 4 | −7 | 71 % | 0 |

Reading: one family. Every peopled set sits between L 30 and 58, warm by +9 to +23 with a slight magenta tint (G two to four below
the R/B mean), deep blacks (p1 at 0–4) and nothing clipped at the top (p99 150–230, whites under half a percent). The space sets (skies,
orbits, battle boards) are neutral-to-cool and black-heavy; the surfaces are the one high-key warm set. That is the same cool-space /
warm-people split the interface draws between the sky and the leather, so the two halves already agree. The outliers inside a set are
semantic, not errors: the Darlok files are a third as bright as their peers (L 16–28 against 39–54), the Psilon files up to twice
(56–85), the Alkari homeworld is a white planet (93–109), the nova is a nova, inferno is red.

The interface, from the same statistics on the audit screenshots:

| Region | L | warm | note |
|---|---|---|---|
| sky (map, no panel) | 21 | −10 | the system skies are L 21, −1: the map is cooler on purpose |
| colony console (steel) | 57 | 0 | neutral |
| leather frame (ledger head) | 88 | **+42 → +30** | the art it frames is +9 to +23 |
| leather boxes (ledger foot) | 36 | +16 → +13 | |
| Research screen | 67 | +29 → +22 | |
| options (indigo cards) | 42 | −14 | |
| design (grey metal) | 25 | +5 | |
| system view | 48 | +16 | |

The one real mismatch was the leather: a third warmer than anything it frames, so a portrait or a planet inside it read cooler and
greener than it is. Retoned: every leather literal and token (`--o-fill`, `--o-hi`, `--bronze*`, the `--pk-*` phone leathers, the ledger
well gradients, 26 literals) moved toward neutral at the same luminance (#6d5645 → #66584a, #8c7458 → #857561, #5b4533 → #55473b …;
L within ±1, R − B down by 30 %). The frame sits at +30 now, the same distance from the art as the art sets are from each other.
Judgement call: it reads as a cooler, greyer leather; the literal map is in the finish-pass commit if the owner wants it half-way back.

Per-race exposure. The outliers above sit side by side in the council booths, the Races cards and the Report, where a jump of two to
three times in brightness from one empire to the next reads as a mistake, not a mood. `WorldArt.raceExposure(race, purpose)` holds a
brightness nudge (Darlok ×1.3–1.45, Psilon ×0.72–0.82, the Alkari homeworld ×0.72–0.75) and every draw path reads it: `draw`'s
`exposure` option as a canvas filter, `image`'s `--expo` custom property on the DOM plates and the Report dossier, the portrait scaler,
the audience and council scenes, the Research scientist. Brightness only, so the blacks stay black and the mood stays. It is a stand-in
until those files are re-rendered (rows in Phase 3).

### Shading and shadowing

Strong: the console and ledger bevels (one light, top-left, on every face; the recessed wells' far-wall rims are the only "light from
below" and read correctly as the inside of a well), the ledger sheet's cast shadow, the modal and tooltip elevations, the GL planets'
terminator and limb, the title screen's relit world, the glass panels' inner rim. Weak, fixed here:

| Finding | Fix |
|---|---|
| 24 distinct drop shadows in the code (14 y/blur signatures across the desktop screens, five on Research alone) | three elevations: `--shadow-1` chips and bars, `--shadow-2` panels, keys and tips, `--shadow-3` sheets and modals; 17 literals replaced; 12 signatures remain, nine of them glows (y = 0) |
| the DOM art plates (colony card, side cards, setup homeworld, Report dossier) sat flat on the panel like stickers while the canvas plates have an inset vignette | one recessed-well vignette on every plate: `inset 0 0 0 1px rgba(0,0,0,.7), inset 0 0 1.6rem rgba(0,0,0,.4)` |
| the side console on the galaxy map cast nothing onto the map and read as a layer in the same plane | `-10px 0 28px rgba(0,0,0,.45)` on `.gx-side .panel` |
| two text-shadow conventions: `1px 1px 0` (light from top-left) in seven files, `0 1px 0` everywhere else | one direction, `0 1px 0` (29 rules) |
| the Fleets cell plate was a lighter brown than the black well it sits in | the well's own tones (`#2a241f → #110e0b`) |

### Finished-game consistency (`finish.js`, 15 desktop screens)

| Tell | Before → after |
|---|---|
| clipped text (overflow hidden, no ellipsis) | 0 → 0 |
| sibling buttons of unequal height | Report's ◀ ▶ at 25 px beside 33 px → equal; Design and Options keep the big primary (convention) |
| chamfers on a rectangular theme | Save/Load 7 → 0, Races 3 → 0 (the race name plates); Design 9 kept (the trapezoid tabs are the family motif) |
| distinct font sizes per screen | Research 22 → 16, Design 15 → 11, Races 17 → 14, Fleets 13 → 11 (.84–.88 → .85, .93–.97 → .95, 1.01–1.04 → 1) |
| three-dot truncation | the GNN ticker's `...` → `…` |
| mixed case inside one group | "No trade" beside NO TREATY → NO TRADE; "Honorable" over MILITARIST → caps |
| redundant marks | the ledger's growth "↑ +1.8" → "↑1.8" |
| unreadable ink | the disabled Build button's key chip kept the copper's dark ink on the grey plate (1.5:1) → cream |

Left on purpose: the Design/Options big primary; the Design trapezoid tabs; CAPS labels beside sentence-case values (the convention);
14–16 font sizes per screen (a display scale, a UI scale and a mono scale with four to six steps each).

Verification: `check.js` 118 files clean, `rules-test.js` 845 pass; the three phone QA profiles 263 / 231 / 254 pass; 30 turns on hard
with no errors; the desktop layout fingerprint differs from the previous commit on 5 of 296 lines, all sub-pixel heights from the type
collapse (a Design label row 2 px higher, the Fleets ship row 1–3 px shorter), no grid or width change. Contrast against the balance-pass
baseline: mean luminance per screen within ±0.5 (the retone kept it, by construction), the fail lists the same class as before (Races
15 → 10, Report 9 → 6, Design 6 → 5 after the key-chip fix; Research 16 → 19 by count, every one a 15–16 px orange or cream label on a
box face at 3.9–4.4:1 that sat at 4.0–4.5 before). The small orange label tier on the leather box faces is the one open contrast item:
a lighter orange (#ffa73a) or cream for the 15 px column heads would clear 4.5:1 at the cost of the tier's identity. Owner's call.

## Synthesis — how it all works together (read this before the next pass)

Six passes (harmony and art, visual system 1 and 2, balance, finish, unify) measured and moved the same few things. Put together they
are one system, and every later change should be checked against it:

**1. Three layers, one place.** The sky at the back (the universe: procedural, persistent under every screen, continuous across screen
changes), glass in the middle (dark translucent surfaces that carry data and art), the frame in front (the ship's chrome). Every screen
is built from these three; a screen's family changes only the frame's material and the colour of its rails. Nothing in the original's
layouts moved.

**2. Four materials, each with a measured target anchored on the art.** The raster art is one family (`histo.py`): mid-key (L 30–58),
warm (+9 to +23 red over blue), a slight magenta tint, deep blacks, nothing clipped. The rendered materials sit on one warm axis around it:

| Material | Where | L | warm (R − B) | Role |
|---|---|---|---|---|
| sky | map, menus, ledger wells, the design pane | 21 | −9 (was −10; the art's skies −1) | the deep background; the one cool surface, by design |
| glass and wells | overlays, data boxes, every art plate | ≤ 35 | 0 to +3 | near-black and neutral so the art carries the colour |
| steel | galaxy console, nav bar, map controls, combat bar | 43–98 | −8 to −19 (was −10 to −20) | cool chrome: the bridge |
| leather | Research, Races, Report, Status, Tech tree, the ledgers' frames, Map overview | 86 frame / 35 boxes | +30 / +13 (was +42 / +16) | warm chrome: the original's screens |
| indigo rails, grey metal | Options and menus, Design | 42 / 25 | −14 / +5 | the family colour as a rail or plate, never a fill |

The rule that falls out: the art is the middle of the axis. Whatever frames art is warmer than it (leather); whatever shows art is darker
and more neutral than it (wells, glass); the sky is cooler than everything and the steel sits between the sky and the art. The files that
fall outside their own set (Darlok, Psilon, the Alkari homeworld) are corrected in code (`WorldArt.raceExposure`) until re-rendered.

**3. One light.** Top-left. Every raised face has `--bv-hi` / `--bv-lo` and the one `--spec`; a recessed well shows its far-wall rim (the
only light from below, and it reads as a well); everything that floats takes one of three elevations (`--shadow-1/2/3`); text shadows go
one way (`0 1px 0`); every art plate is a window (inset vignette), never a sticker; the console casts onto the map.

**4. One palette, tiered by job.** Gold display for screen titles and section heads (`--title`, `--title-hi`); orange bold for box titles
(`--head-orange`, large-text rule, never below 18 px); cream caps for column and field heads (`--o-tan`, `--fog`); cream for body
(`--ivory`, `--mist`); yellow in a well for every slider readout (`--slot-ink`); copper for the one primary action with near-black ink;
a family colour (teal, indigo, bronze) only as a rail, a plate or a frame; brass lines in three weights for dividers, rules and frame
edges (`--brass-line-1/2/3`), the pale `--hair` on wells. Green means research points, red means danger, nothing else.

**5. One type scale.** .7 .75 .8 .85 .9 .95 1 1.05 1.1 1.15 1.2 rem, then tenths (36 distinct sizes, down from 65): a display face for
titles and heads, the UI face for body, the mono face for figures, each with four to six steps on a screen.

**6. One motion.** A cross-fade between screens; slow drift on stills; idle breathing on drives; the HUD year's roll and the changed
readouts' flash; all off under reduce motion and cheaper on phones. Nothing moves that is not information or atmosphere.

**7. Verification is part of the system.** `check.js`, the rules tests, the three phone QA profiles, the turn soak, the layout fingerprint,
and the measured audits (`audit.js` + `audit.py` for contrast and balance, `finish.js` for the tells, `histo.py` for the histograms).
A visual change is done when the numbers say the same thing the eye does.

## Unify pass — done (same branch, one commit)

The owner asked for the conclusions above to be reviewed as one system and for the interface to be cleaned up against it, including
nudging the rendered screens toward the art's histograms. What moved:

| Gap | What landed | Measured |
|---|---|---|
| The sky was the one rendered surface far from the art skies' histogram (warm −10, tint −7 against −1 / −2) | `Space.SKY` palette toward the art's neutrals (dusty violet · slate · dusty umber · slate blue), the warm core a shade warmer and stronger (`#e4b690`, k .9), intensity .85, floor .05; chosen on two GL contact sheets (`scratchpad/shots/fix/sky-unify*.png`) | map sky warm −10 → −9, tint −7 → −4, L 21 → 22 |
| The gameplay nebulae sat on the sky like stickers (saturated violet) | a third less saturated in two steps, same hue and alpha; the in-nebula star ring the same lilac | still the one violet thing on the map: readable |
| Steel was blue-steel (−12 to −37 red over blue) while every art set is neutral or warm | every low-saturation blue-grey in the steel family (console gradients, the galaxy screen's button faces, the v2 base and line tokens, the combat bar, the phone gunmetal) has half its blue taken out at the same luminance (51 literals, programmatic) | console face −10 → −9, button faces −37 → −18, base tokens −21 → −10 |
| Two label tiers for the same job: Research's column, section and project heads in orange at 13–15 px, the ledgers' and console's in cream caps | the Research heads take the cream caps (`--o-tan`, 600); orange is the bold box-title tier only | the 15 px orange fails on Research gone; one convention |
| 65 distinct rem type sizes | every size snaps to a .05 step below 1.2 rem and a .1 step above (290 declarations) | 36 distinct sizes; 8–14 per screen |
| 175 brass `rgba(214,179,106,a)` literals at fourteen alphas on borders, rules and edges | three tokens by weight: `--brass-line-1` (.2, faint divider), `-2` (.3, rule), `-3` (.45, frame edge); 148 border / box-shadow / outline sites | one hairline system with `--hair` on wells |

Left by choice, and why: the indigo title plates (`--plate-1/2`, the original's #302870, an identity element); the Design and Options
big primary; the Design trapezoid tabs; CAPS labels beside sentence-case values; the spacing rhythm (sub-pixel); the Research rows'
orange field names at 16 px (4.2:1, the row's own title); the ~90 gold literals in canvas code (same three values; a shared JS palette
constant when wanted); the `room` grade and the GL bloom (hardware); Phase 3 assets.

Verification: `check.js` 118 files clean, `rules-test.js` 845 pass; the three phone QA profiles 263 / 231 / 254 pass; 30 turns on hard
with no errors; the layout fingerprint against the finish-pass commit: 35 of 186 entries differ, every one a height within 3 px from the
type snap except the Almanac's article grid (+5 / +10 px over a 2,770 px scroll, body text .98 → 1 rem), no display, grid, position or
width change. Contrast against the finish-pass baseline: per-screen mean luminance within ±1; fail counts flat or down (Research 19 → 15,
Design 5 → 3, the rest unchanged); the finished-game sweep shows fewer distinct type sizes on every screen (Galaxy 16 → 9, Research
16 → 12, Options 13 → 9) and no new clipping, unequal buttons or chamfers. Histograms after: sky L 22 warm −9 tint −4; console −1;
leather frame +29; options cards −9 (was −14, the de-blued base); Research +21; system view +16. Known and left: the Tech tree's locked
chips at 2.9:1 (dim by meaning) and the sampler's copper-glyph edges.

## Phase 3 — assets (rows for `ART-NEEDED.md`)

**11. Full-screen scenes at 3840×2160**, in order of screen time: `scene-galaxy` (title, boot, ledgers), the 10 audience halls, the
council chamber, the news studio, the 14 surfaces, the 8 event plates, the 4 battle backdrops, the 6 system skies. `worldart.js`
gains an `@2x` lookup (`W.hi`: use `<name>@2x.webp` when `devicePixelRatio × box width > 2200`, fall back to the 1080p file), so the
code is ready before the art is.

**12. 3/4 ship renders for variants 2 and 3** (9 classes × 2): `ships.js` `photoFor` already picks them up when present; until then
a design on those variants shows a top-down sprite beside 3/4 ones on the pre-battle card.

**13. Per-type landing scenes** (14, optional): the colonise card and the landing vignette would pick by planet type.

## Order, verification, guardrails

- Phase 1 as a series of small commits on a `claude/visual-system` branch: 1 → 2 → 3 → 4 → 5, each with its screenshot pair, phone QA,
  rules tests and fingerprint. Phase 2 after the owner has seen Phase 1 on real hardware. Phase 3 runs in parallel as art arrives.
- Performance: `#sky` is static; nothing new runs per frame on the map; every effect reads `Perf.q`; `reduceMotion` stops drift and grain.
- The original's layouts and families stay; only materials change. Nothing moves that is not information or atmosphere.
- Headless QA cannot see the GL path; the owner checks the map, the system view and combat on a GPU after each phase.
- Contrast is checked after the well change (ink over well); the colour-blind Empire marks option is re-shot.
