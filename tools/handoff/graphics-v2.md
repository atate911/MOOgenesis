# Graphics v2 + GPU wiring — hand-off notes

## Done
**Theme v2 is the default.** `index.html` sets `<html data-theme="v2">` before first paint; `?theme=v1` restores the old look, `?accent=cyan|amber|leaf`, `?fx=off` (vignette/scanlines). `css/theme-v2.css` is loaded from `js/manifest.js`.
Fonts: Oxanium / IBM Plex Mono added to the (optional) Google Fonts link; system fallbacks (Bahnschrift, Segoe UI) apply offline.

**Palette retint without touching 40 screens.** Most per-screen CSS has indigo/brass literals. `UI.css()` (js/ui/kit.js) now runs `UI.retintCss()` in v2: dark blue/violet literals are pulled to the gunmetal ramp (hue ~210, low saturation) and the v1 brass ramp maps to steel. Canvas art with its own palettes was patched individually: `scenes.js` (C palette + display font), `combat-fx.js`, `gnn.js` (steel/ SVG logo), portraits badge ring.

**Grade pass** (`js/gfx/grade.js`, `Gfx.Grade.apply(ctx,w,h,t,preset)`): contrast/exposure/saturation (ctx.filter on a copy, skipped on the low tier), cool multiply, low-key gradient, vignette, film grain (not on low tier / reduceMotion). Every `Gfx.Scenes.*.draw` is wrapped (preset per scene: rooms stronger, battle/warp light); `Portraits.draw` grades its rect unless inside a scene (`Grade.depth`). Opt out per call with `{grade:false}`. Inactive in v1.

**GL tweaks** (gl-planets.js): granulation on stars is now low-contrast/fine (was a cracked-plate pattern), detached prominences off for yellow/orange, calmer terran clouds (cover .31, 1 cyclone).

**GNN fix**: wire/feed monitor text overlapped the DOM tag and caption (pre-existing in v1); the list now sits between them.

**GPU wiring.** `js/gfx/pick.js`: `Gfx.pick('planets'|'space'|'fx')` returns a GL-backed facade (GLPlanets/GLSpace/GLFx for the hot calls, everything else passes through to the 2D module) when `Gfx.GL.supported()` (honours Settings gpu and Perf tier) else the plain Canvas2D module. Consumers switched: scenes.js (all scenes incl. audience/council/lab/newsroom/surface/battle/victory), gnn.js, landing.js (Fx), endings, tech, side-colony/side-misc, ledger-fleets, combat.js (pre-battle sprite), setup, galaxymap (backdrop, star sprites/surfaces, planets), menu. Already GL: system.js, combat-fx.js, menu vortex. The GL modules also fall back to 2D per call if a program is still compiling.
`?tier=low|medium|high|ultra` forces a Perf tier for one page load (software GL is classified 'low' = GL off, so QA needs `TIER=medium` env for tools/qa scripts; added to tools/qa/lib.js).
AI planning (`Game.planAI`) now measures inline vs pool and uses the faster path (re-samples every 25th turn): on a 4-thread box with a medium map the pool is ~3x SLOWER early (snapshot clone cost > plan cost), so inline wins until maps/AI get heavy. Plans are identical either way.
`tools/test-hw.html` (`?auto=1&turns=100` runs everything; sets `window.__hw`): threads/GPU info, GPU-vs-2D timings per tier (planet live/sprite, backdrop, star, vortex, fx frame), pool vs inline game with a determinism check (all AI plan batches + final state hash).

## Measurements (this sandbox: 4 vCPU, SwiftShader software GL — absolute GL numbers are NOT representative)
- 100-turn medium game: inline 515 ms (AI planning 159 ms); pool 665 ms (planning 492 ms). Determinism: identical plans and final state hash.
- Pool burn benchmark x2.0 on 3 workers.
- Per tier (ms): 2D low: live planet 22, backdrop 117, star 6, fx frame 2.2. SwiftShader GL medium/high/ultra: planet ~500, backdrop 260-320, fx 280-480, vortex 3.8-9.9 s. Only relative ratios between tiers (dpr 1.5/2/2.5) are meaningful here. **Not measured:** real iGPU/dGPU fps; run `tools/test-hw.html?auto=1` on the target machines (especially the iGPU) and the F3 overlay.
- Galaxy map with GL facades at medium: ~54 fps in SwiftShader (map is mostly 2D); menu 0.3 fps in software GL (live planet + vortex every frame) — fine on hardware, fallback path is `?tier=low`.

## Visual differences GPU vs 2D
GL planets have real relief lighting, cloud shadows, city lights, atmosphere; 2D planets are the older pixel-loop look. GL backdrop nebulae are warped/volumetric, the 2D ones flatter. Same API and framing; colours differ slightly (GL slightly more saturated).

## Not done / next
- Portraits/ships were graded, not re-rendered as lit 3-D (research/09 section 8 spikes untouched). Alien cartoon proportions remain the biggest "cartoon" holdout; audience halls are bright sunlit sets even after grading (hall palettes in scenes.js `HALLS` are the next target).
- Selected-state gold (size tile, rival count) is still gold; consider cyan accent. The attitude bar rainbow is unchanged.
- Hard-coded indigo in canvas-drawn UI (council hall, design stage background) only gets cooled by the grade pass.
- GL star sprites in the galaxy map were not reviewed on real hardware.
- Software-GL perf: first GL draw in a page can take seconds (shader compile); `main.js` warms after first paint.
  **Oct 2026 hitch pass** (review items 22–24, 27, 29, 30, 32): nothing in the gfx layer blocks a frame on shader
  compiles or texture generation any more —
  - `Gfx.Planets.sprite()` / `draw()` draw a 64 px placeholder texture on the first frame of a new planet and build the
    real tiers in the sliced background queue; a sprite made before its tier exists is repainted IN PLACE when the tier
    lands (`cv.pending`, `opts.onReady(cv)`, Bus `planets:sprite (desc, cv, final)`). UI code that copies a sprite into
    its own canvas (side-colony `planetCanvas`, combat pre-battle card) only picks the sharp version up on its next
    render; wire `onReady` or the bus event there if the soft first paint is noticeable. `opts.sync = true` restores the
    blocking form (scenes.js `planetStatic` uses it: static layers are baked once).
  - `Gfx.Space.drawStarSurface` builds the 512×256 surface texture row by row in the background and draws a graded
    disc meanwhile (`opts.sync` blocks).
  - `GLPlanets.supported()` never blocks: it starts `warm()` (noise volume in ~14 idle slices, one shader compile per
    slice, two texture uploads, then polling) and returns false until ready; `supported(true)` is the blocking form for
    tools/benchmarks (test-glplanets.html uses it).
  - `GL.precompile(name, vs, fs)` + `GL.ready(name)`: background compiles, one program per idle slot, no status query
    until `KHR_parallel_shader_compile` says it is done (or a 400 ms grace period without the extension). `GLSpace.warm()`
    / `GLFx.warm({async:true})` use it; `GLFx.warm()` without options is still the blocking form `create()` relies on.
    `GLSpace.warm({vortex:true})` is now opt-in (it builds a large CPU buffer).
  - `GL.begin` caps each dimension at MAX_TEXTURE_SIZE and shrinks the shared canvas back to the recent peak.
  - `Perf`: never raises above the heuristic cap on a software renderer; sets `<html data-fx>` for theme-v2.
  - Measured on this sandbox (SwiftShader): low tier system screen long task 908 → 233 ms; GPU-off zoom 306 → 92 ms;
    high-tier boot long tasks 6 (1.56 s) → 3 (0.85 s). Still open: the galaxy map's first frame (0.3–0.9 s: galaxymap.js
    nebula + `Space.makeBackdrop` on the CPU, or GL backdrop/star sprites + blit on software GL) and the per-frame cost
    of the CPU planet renderer at R ≥ 200 (system screen, ~100 ms per repaint).
