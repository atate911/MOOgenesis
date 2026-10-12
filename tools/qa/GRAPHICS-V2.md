# Graphics pass v2 — before/after notes (session 3)

Directive: "more modern, like a serious game, less cartoonish, more serious sci-fi flair". Plan: `research/09-art-direction.md`.
Judged by Playwright screenshots (SwiftShader, 1280x720 and 1920x1080). `?theme=v1` restores the old look everywhere below.

## What changed (DONE, visible)

| Area | Before | After | Files |
|---|---|---|---|
| Theme switch | v2 CSS prototype existed but was not loaded | Loaded after kit.css; **v2 is the default**. `?theme=v1\|v2` (remembered in localStorage `moo.theme`), `?accent=cyan\|amber\|leaf`, `?fx=off`. Set before first paint in `index.html`; Oxanium + IBM Plex Mono added to the optional web-font link (system fallbacks otherwise). | `index.html`, `js/manifest.js` (1 line), `css/theme-v2.css` |
| Chrome (all screens) | Indigo/brass chamfered "jewel" panels, serif headings | Graphite panels, single-cut corners + accent ticks, uppercase tracked display headings, flat buttons, accent primary action, tick-mark sliders, mono numerals, vignette + faint scanline overlay | `css/theme-v2.css` |
| Per-screen hard-coded colours | ~280 rules in `js/ui/*.js` `<style>` blocks (indigo gradients, brass borders, gold active states) | Generated override block (`tools/codemod-theme.js`, re-run after changing screen styles) re-colours them to gunmetal / steel / accent without touching the screens | `tools/codemod-theme.js`, GENERATED block of `css/theme-v2.css` |
| Icons | Solid glyphs | Line style under v2 (outline + 13 % fill) via CSS; `data-icons="solid"` on `<html>` brings the solid set back | `css/theme-v2.css` |
| Portraits | Saturated royal-blue backdrop, glossy brass badge ring, flat key | Dark graphite control-room backdrop with defocused practical lights; every cached layer graded once (saturation -28 %, key falloff to the shadow side, cool rim light on the right silhouette) so zero per-frame cost; badge ring is steel | `js/gfx/portraits.js` |
| Ships | Bright pastel hulls, strong team halos | Hull sprites graded once: saturation -34 %, key/shadow gradient along the light axis, panel seams (groove + lit bevel), rivet rows (>= 90 px), cool rim opposite the key; halos/glow layers at 40-70 % | `js/gfx/ships.js` |
| Planets (Canvas2D) | Saturated land, hard white clouds | Per-pixel grade: land saturation -22 %, highlight shoulder, warm scattering band at the terminator | `js/gfx/planets.js` |
| Star kinds / default nebula palette | Primary-colour stars | Pastel blackbody-style tints (identity of each kind kept), nebula palette desaturated | `js/gfx/space.js` |
| Scenes (lab, council, newsroom, audience, surface, battle, endings) | Cobalt + gold | `C` palette swapped to graphite/steel; every baked static layer graded once (saturation x0.48, brightness 0.88); stronger vignette; film grain on at medium+ tiers and when reduce-motion is off (`grainOK()`) | `js/gfx/scenes.js` |
| GL backdrops (title vortex/nebula, galaxy map) | Saturated violet | CSS stop-gap filter (`saturate .8` title, `.84` map) until the shaders are re-graded; `data-fx="off"` removes it | `css/theme-v2.css` |
| Style guide | v1 text/swatches | v2 wording and ramp swatches | `js/ui/styleguide.js` |

Checks: `node tools/check.js` 97/97 ok; `node tools/rules-test.js` 774 passed, 0 failed; no console errors in the screens exercised (title, galaxy+colony, design, tech, planets, fleets, races, game menu, test-portraits/ships/planets/scenes).
Screenshot commands used: `tools/qa/lib.js` `open()`; compare v1/v2 by loading `?theme=v1|v2` (test pages: set `data-theme` on `<html>` before scripts run).

## Only partly done / not done (open items)

1. **Portraits are graded, not rebuilt.** The SDF G-buffer relight (research/09 spike S1) was not attempted: faces still have the old painted proportions (large eyes, almond outlines, hair blobs). The grade removes the saturated backdrop and adds low-key shading + rim, which helps a lot, but the uncanny/cartoon read of faces (esp. Psilon glowing eyes, Mrrshan) remains. Lips stay pink after the grade.
2. **Ships are graded + panel-lined, not meshes.** Silhouettes unchanged: Alkari feather wings, Darlok manta and Klackon antennae are still decorative. Panel seams are procedural and not shape-aware (they can cross hull holes, hidden by the source-atop clip).
3. **GL shaders untouched** (`gl-space.js`, `gl-planets.js`, `gl-fx.js`; owned by the GL-wiring agent): nebula saturation, star table (`gl-space.js` has its own `STAR` table that overrides `Space.starColor` — copy the pastel values from `js/gfx/space.js` there), planet grade, vortex core blow-out. The CSS filter is a stop-gap; it also desaturates empire-colour glyphs on the map by 16 %. No `post.js` / bloom / tone-map chain, no `Gfx.Theme` token reader.
4. **FX (`fx.js`)** reviewed only: the existing 4-stage explosion/beam code already has white-hot cores, debris and rings; no changes made.
5. **Canvas-drawn UI** (`galaxymap.js`, `gnn.js`, `design.js`, `tech.js`, `combat-fx.js`) keeps its own palette copies and Marcellus font strings (outside scope); star glyph "candy dots", selection reticle and fleet chevrons not redrawn. GNN lower-third/ticker are re-coloured only by the generated CSS.
6. **Icons** are a CSS restyle of the solid set, not a redrawn 1.5 px duotone set; small glyphs (<16 px) get busy; the icon test page (`tools/test-icons.html`) does not load `theme-v2.css`, so check them in-game.
7. Not done: web-font self-hosting (needs network or base64), `Settings` UI for theme/accent/fx (needs `js/ui/options.js`, `js/core/settings.js`), perf-tier hooks (`Perf.TIERS.post/grain/chromeFx`; the overlay, filters and grain should be switched off on the low tier — currently only `data-fx="off"` and scenes' `grainOK()`), banner shapes/patterns, contrast/saturation audit pages, 1920x1080 QA for scenes/GNN/combat/audience, Firefox/Safari (the grades use `ctx.filter`, which Safari lacks: they silently skip and fall back to ungraded art), measuring bake costs on a weak iGPU (grades add ~2-8 ms once per cached sprite/layer; the portrait test page showed a higher first-draw time).
8. Known visual leftovers: some inline-styled gold accents (current selection chips, `#ffd54f` BC amounts) are semantic and intentionally unchanged; planets screen bottom boxes keep a slight blue tint; the galaxy nebula is still violet-leaning behind the filter.
