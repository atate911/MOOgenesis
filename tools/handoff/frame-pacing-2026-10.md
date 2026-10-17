# Frame pacing and per-frame cost — October 2026 (branch `claude/zealous-bohr-fxv562`)

Question from the user: can the animations be smoother and run at a higher frame rate?

## What was measured (headless Chromium, SwiftShader — CPU-side numbers only, no real GPU)
Scripts lived in the session scratchpad (not committed): a rAF-interval sampler + CDP CPU profile per screen, a per-frame counter
of `drawImage` / `fillRect` areas, `ctx.filter` sets, `GL.blit` and `Grade.apply` calls, and a pure-Node simulation of the frame gates.
- Main-thread JavaScript is cheap: the galaxy map's own render is ~1.3 ms per frame on a large map, the 25 ms music tick ~0 ms (3 ms max),
  no long tasks after warm-up. The profile is dominated by canvas rasterisation, i.e. on real hardware the frame cost is GPU fill rate.
- Per-frame fill at 1600×900, dpr 1 (before): galaxy 106 `drawImage` / 18.4 Mpx of mostly `lighter` draws on a 1 Mpx canvas (four full-canvas
  layers: sky, galaxy cloud, two parallax star tile layers, plus nebulae); combat 370 `drawImage` / 13.7 Mpx + 6.7 Mpx of fills + one filtered
  full-frame copy (the colour grade), ten full-size draws per frame; GNN 3.6 + 3.5 Mpx; menu 2 Mpx; design/tech negligible. At dpr 2 all of
  these are ×4.
- The frame gates (`acc += dt; if (acc < 1/fps - 0.002) return; acc = 0;` in ten screens) are the one hardware-independent defect: on a
  display whose refresh is not a multiple of the target they undershoot and jitter — 60-fps targets drew at 48 fps on 144 Hz, 37.5 on 75 Hz,
  45 on 90 Hz, 55 on 165 Hz; 40 / 24-fps targets drew at 30 / 20 on 60 Hz; the remainder was thrown away on every draw, so rAF jitter slipped
  a frame every few seconds.
- The adaptive governor (`MOO.Perf`) could oscillate: 3 slow seconds drop medium → low (30-fps gated, no GL); the rAF loop still runs at
  the display rate while screens draw every other frame, so "fast" is always true and it climbed back after 10 s + cooldown; a machine that
  is only slightly too slow for medium alternated between two looks and two frame rates every ~20 s. Tier changes have no listeners, so
  nothing told the player.

## What changed
- `js/ui/kit.js`: `UI.displayHz()` (25th percentile of a second of rAF intervals, smoothed) and `UI.pace(st, fps, dt)` — draws every frame when
  `fps` is at or above the display rate, otherwise every k-th display frame with `k = round(hz / fps)`, counting display frames (robust to
  jitter; a stall draws once and resumes the cadence). `st.dt` is the time since the last draw. `UI.rawDt` is the unclamped interval.
- Converted gates: galaxymap, audience, system, tech (field picture + lab scene), techtree, races portraits, design preview, gnn, endings,
  council. The galaxymap keeps a fallback for tool pages that load it without kit's loop. Targets are unchanged (60 for the painted scenes,
  40/24 for the tech picture, 30 for the tech-tree art, 10–20 for the race portraits, `Perf.q.animFps` for the map).
- `js/ui/galaxymap.js`: `paintBackdropStatic()` paints sky + galaxy cloud + parallax tiles into an offscreen canvas keyed on camera, size, dpr,
  quality and sky image; `drawBackdrop()` blits it (one opaque draw) and keeps the sparkles live. Idle frames: 18.4 → 7.4 Mpx of draws.
- `js/ui/combat-fx.js`: `drawBackdrop(dt, t)` repaints `Scenes.battle` (and its grade) at 24 Hz into a cache and blits it every frame; star
  layers drift < 0.25 px between repaints, the grain already stepped at 24 Hz. Verified at a small viewport: grade passes 1.0 → 0.38 per
  frame, draw area halved.
- `js/core/perf.js`: a tier dropped for slow frames is not climbed back into for 5 minutes (`RECLIMB_S`); the budget is the display rate
  when that is below 60; hidden-tab gaps / stalls are ignored via `UI.rawDt`; the F3 overlay shows `display N Hz` and `cap N` when the tier
  caps the draw rate.

## Verified
`node tools/check.js` (101 files), `node tools/rules-test.js` (813), `node tools/qa/combat.js tactical` (real battle, no errors), a console-
error sweep over galaxy / menu / combat / design / system / gnn / audience / landing / tech / races / council / endings / tech-tree, screenshots
of the galaxy map (idle, in flight, zoomed), combat and the system screen, and a Node test of the pacer at 60/75/90/120/144/165/240 Hz with
±8 % jitter (single cadence, correct rate, correct behaviour after a 300 ms stall).

## Not done / needs a real GPU
- Nobody has measured real frame rates per tier; run the game with F3 on a real machine (`?tier=high` / `?tier=ultra` to force) and note fps,
  display Hz and the tier the governor settles on. If an integrated-GPU laptop still drops to `low`, the next lever is the backdrop at half
  resolution (the sky and cloud layers are soft), then fewer `lighter` passes in `drawStarsPass`.
- The dialog scenes (audience, lab, council, GNN, endings) still apply the full colour grade every drawn frame; they are capped at 60 and
  their characters animate, so the combat-style cache was not applied there.
- The GL nebula live render (`gl-space.js`) still refreshes at 24 / 12 Hz by wall time; it is a slow drift and was left alone.
