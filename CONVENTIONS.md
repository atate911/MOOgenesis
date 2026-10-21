# Master of Orion — Reborn · Conventions (read first)

A from-scratch browser remake of the 1993 4X classic *Master of Orion* with modern graphics, procedural audio and all the
original systems (races, tech, ship design, tactical + ground combat, diplomacy, spies, Galactic Council, GNN, Antarans, Orion).
Original screenshots were used only as a layout/feel reference (`research/00-original-screens-notes.md`). **All art, music and
text are original — never imitate or reproduce original assets.**

## Stack & hard constraints
- **Vanilla JavaScript (ES2020), HTML5 Canvas 2D, Web Audio, CSS.** No frameworks, no bundler, no npm packages, no network at runtime
  (web fonts are optional). Must run by opening `index.html` (file://) in current Chrome/Edge/Firefox. **No ES modules** — classic scripts only.
- Every JS file is an IIFE that hangs its exports off the shared namespace:
  ```js
  (function (M) {
    'use strict';
    M.Gfx.Planets = { ... };          // namespaces pre-created by js/core/ns.js:  Data Sim AI Gfx Audio UI Util
  })(window.MOO);
  ```
  No other globals. `MOO.Util` (js/core/util.js) and `MOO.RNG` (js/core/rng.js) are available to anything loaded after core, but
  **gfx/ and audio/ modules must be self-contained** (carry their own tiny helpers) so they work in isolated test pages.
- Load order = `js/manifest.js` (single source of truth). **Only the lead edits manifest.js, kit.js, css/base.css, css/kit.css, ns.js.**
  Create only the files you own. If you need something changed in a shared file, say so in your final report.
- **Headless rule:** files under `js/core`, `js/data`, `js/sim`, `js/ai` must not touch the DOM/`window` beyond `window.MOO` — they are also
  executed by Node (`tools/headless.js`) for simulation tests.
- Sim code is **functional over plain data**: game state `S` is a JSON-serialisable object (no class instances, no functions, no cycles — reference
  things by numeric id). Functions take `S` as first argument. All randomness comes from `S.rng` (seeded, serialisable) — never `Math.random()` in sim.
- Style: 2-space indent, semicolons, `const`/`let`, short functions, comments only for non-obvious intent. Be performance-aware in per-frame code
  (no allocation in hot loops, cache gradients/sprites in offscreen canvases).

## Phone layout layer (`tools/handoff/phone-2026-10.md`)
- `index.html` decides `<html data-phone>` before any CSS loads; `js/core/phone.js` exposes it (`MOO.Phone.active()`; it reads the
  `window.MOO_PHONE` flag, undefined in Node). Perf, workers and audio read it once at start-up.
- Phone rules live only in `css/phone.css`, every selector starting `html[data-phone]` (or `html:root:root[data-phone]` to beat a
  bumped restyle). Phone behaviour lives in `js/ui/phone*.js`. A screen file gets at most a one-line `M.Phone && M.Phone.active()`
  branch; never change a desktop rule to make a phone layout work.
- Back on phones is a synthetic Escape: keep every screen's Escape binding equal to its right-click / Cancel.
- Check a change with `node tools/qa/phone.js` (and `landscape`), and diff `tools/qa/layout-fingerprint.js` against `main` for desktop.

## Threads, GPU & portability (the game uses the hardware it finds — and never requires it)
- **Worker-safe modules** (`core/util|rng|ops`, `data/*` that sim needs, `sim/*`, `ai/*`) are written `MOO.def(function (M) { … });` instead of an IIFE
  (see `js/core/ns.js`). `MOO.def` runs the function and remembers its source so `MOO.Workers` can boot identical code in a pool of Web Workers (works from
  file://) and `tools/headless.js` can load it in Node. They must be self-contained (reference only `M`, never outer variables), DOM-free and deterministic.
  Large static text (`data/text.js`, `data/names.js`) stays IIFE (main thread only).
- **Ops**: expose parallelisable work as `M.Ops.name = function (payload) { …return result; }`; call via `MOO.Workers.run/map/mapChunked(op, payload, {snap:true})`.
  Payloads/results = plain structured-clonable data (no functions/RNG objects — pass seeds or `rs` state arrays). With `{snap:true}` the op reads the per-turn game
  snapshot `MOO.snap` (set by `MOO.Workers.setSnapshot(S)`; treat as READ-ONLY). If workers are unavailable everything runs inline automatically.
- **Parallel turn design**: AI planning is a PURE function `AI.plan(snapshot, empireId, seed) → orders[]` (no mutation of S; one worker per AI empire), battle
  auto-resolution is pure `Combat.resolve(battle, seed) → result` (all AI-vs-AI battles run concurrently; the player's odds preview runs Monte-Carlo across the pool),
  planet textures are built in workers. Anything that MUTATES game state runs on the main thread in deterministic empire order (orders applied by `Sim.Orders.apply`).
- **GPU**: WebGL2 renderers are optional accelerators. `MOO.Gfx.GL` (js/gfx/gl.js) provides one shared offscreen context, shader/FBO helpers and GLSL noise; a renderer does
  `GL.begin(w,h) … draw … GL.blit(ctx2d,dx,dy,dw,dh)`. EVERY GL path must have a Canvas2D fallback with the same API/look (choose with `MOO.Gfx.GL.supported()`).
- **Adaptive quality**: scale effort from `MOO.Perf.q` (dpr, particles, planetDetail, nebula, glow, maxFx, gl, animFps) — never hard-code counts. `MOO.Perf` probes the
  device, picks a tier (low/medium/high/ultra) and re-tunes live from measured frame times; F3 shows an overlay. Target: ≥60 fps on a modern iGPU laptop at 'medium',
  ≥144 fps headroom on a high-end desktop at 'ultra'. No feature may *require* workers, WebGL2, big memory or many cores. Respect `MOO.HW.memoryGB` for caches.

## Look & feel (UI)
"Imperial observatory": indigo void, brass hairlines, ivory ink; chamfered (45°-cut) panels, **no rounded corners**; Marcellus SC for headings/buttons,
IBM Plex Sans Condensed for body. Tokens/classes live in `css/base.css` and `css/kit.css` (see `?screen=styleguide`). Use CSS variables
(`--brass`, `--ivory`, `--cyan`, `--ember`, `--leaf`, `--rose`, `--violet`, `--gold`, `--c-ship`…), the kit builders (`MOO.UI.h`, `UI.button`, `UI.panel`,
`UI.slider`, `UI.table`, `UI.modal`, …) and per-screen styles injected with `MOO.UI.css('<id>', cssText)`.
Colour semantics are fixed: gold = BC/money, ember = industry, leaf = food/growth, cyan = research/focus, rose = danger/war, violet = diplomacy, teal = ecology, azure = ships/defense.

## Dev server & testing
- A static server is **already running at http://localhost:8765/** (serves `E:\claude\MOO`). Do not start/stop servers.
- Make a standalone test page `tools/test-<yourmodule>.html` that loads `css/base.css`, `css/kit.css`, `js/core/ns.js` (+ whatever you need) and shows your module working
  (grids of examples, animation loops, console-error free). Check syntax with `node --check <file>`.
- Browser verification (visual work): the built-in browser tools `mcp__Claude_Browser__*` exist. **Open your own tab** (`tabs_create`, remember its `tabId`),
  pass that `tabId` on every call (other agents share the pane!), screenshot with `computer` (use `scale` 0.5–0.7 to save tokens), read console errors with
  `read_console_messages`, and **close your tab when finished**. Prefer fixing what you see over describing it.
- Final reply: **≤150 words** — files written, public API (one line each), known gaps. No code dumps.

## Namespaces & key contracts (filled in as modules land)
`MOO.Gfx.{Icons,Space,Planets,Ships,Portraits,Fx,Scenes}` · `MOO.Audio.{init,Music,SFX}` · `MOO.UI.*` · `MOO.Data.*` · `MOO.Sim.*` · `MOO.AI.*` · `MOO.Game`
