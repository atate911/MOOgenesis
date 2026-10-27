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
