# Common brief for UI screen agents (read this first, then your own brief)

You are building screens for **Master of Orion — Reborn**, a faithful browser remake of the 1993 4X game with much better graphics. Product-owner priorities: **faithful mechanics and information design** (the original's screens, labels and flows — see `research/06-ui-presentation-audio.md`) **plus a gorgeous modern look** ("imperial observatory": indigo void, brass hairlines, ivory ink, chamfered panels; fresh original art only — never copy original assets).

## Read, in this order
1. `E:\claude\MOO\CONVENTIONS.md` (stack, module style, look & feel, threads/GPU/portability, testing etiquette) and `E:\claude\MOO\DESIGN.md` (Part B = state schema, module APIs, orders, interrupts).
2. `E:\claude\MOO\research\00-original-screens-notes.md` and the sections of `research/06-ui-presentation-audio.md` named in your brief (layout, information shown, hotkeys, flow, music cues).
3. The code you build on: `js/ui/kit.js` (UI.h, button, panel, slider, table, tabs, modal/alert/confirm/prompt, toast, css, icon, fitCanvas, onFrame, bindKey, setTip, sfx), `js/ui/screens.js`, `js/ui/galaxy.js` (the control screen: side-panel registry `UI.Side`, `UI.Galaxy`), `js/ui/side-colony.js` + `js/ui/side-misc.js` (examples of finished panels), `js/ui/flow.js` (how interrupts reach UI modules), `js/sim/q.js` (read-only view-model queries — extend by asking the lead, or compute locally from `Game.S` using the Sim modules), `js/core/game.js` (`MOO.Game`: `S`, `order(o)`, `player()`, `sel`, `handlers`), `js/sim/orders.js` + the orders listed in DESIGN B4.
4. Art/audio modules (all optional — guard with `if (M.Gfx.X)`): `Gfx.Planets` (draw/sprite), `Gfx.Ships` (draw/sprite/drawFleetMarker), `Gfx.Portraits` (draw/canvas/drawBadge), `Gfx.Scenes` (lab, council, newsroom, audience, surface, battle, ending, warp), `Gfx.Fx` (particles/beams), `Gfx.Icons` (UI.icon(name)), `Gfx.Space`, GPU variants `Gfx.GLPlanets/GLSpace/GLFx` (use when `MOO.Gfx.GL.supported()`), `Audio.Music.play(id)` / `Audio.SFX.play(id)`.

## Working with the real game (no mocks needed)
The whole simulation runs in the page. Boot a ready-made game with the dev URL and jump straight to your screen:
`http://localhost:8765/index.html?dev=1&screen=<yourScreenId>&race=psilon&size=medium&opp=3&seed=abc&turns=20`
(`dev=1` creates a game via `MOO.Game.devBoot`; `turns=N` auto-plays N turns first so there is something to look at; `ai=1` makes the human empire AI-controlled too). The galaxy screen is `screen=galaxy`. Use the **console** (`javascript_tool`) to poke state: `MOO.Game.S`, `MOO.Sim.Q`, `MOO.Game.order({...})`. If a sim module you depend on is still being written by another agent (Combat, Diplo, Spy, Council, Events, AI), code against its documented API in DESIGN.md/the brief and guard calls with existence checks; hand-craft fixture data in your test page so you can work now, then re-test against the real thing when its file appears in `js/sim/`.
Also make a standalone `tools/test-<yourscreen>.html` only if you need fixtures that the dev URL cannot provide.

## Rules
- Only create/edit the files named in your brief. Register new screens with `MOO.UI.Screens.register(id, {create(el), enter(params), leave(), update(dt,t), resize()})`; navigate with `MOO.UI.Screens.go(id, params)`; the screen that opened you passes `params.from` — close with OK/Space/Esc/right-click back to `params.from || 'galaxy'`.
- Inject CSS with `MOO.UI.css('<id>', css)`; use kit widgets and the colour tokens; Marcellus SC for headings; chamfered panels; no rounded cards. Fluid layout (rem units; works from 1280×720 up to 4K); canvases via `UI.fitCanvas` with `MOO.Perf.dpr()`.
- Hotkeys per the original (first-letter button hotkeys, Space = OK/continue, Esc and right-click = cancel/back) via `UI.bindKey(combo, fn, {screen:id})`; every screen playable by mouse alone.
- All state changes go through `MOO.Game.order(...)` (validated orders). Never mutate `Game.S` directly from UI except through the Sim modules' documented functions.
- Use `UI.sfx('click'|…)` and `Audio.Music.play(...)` where the research says (research/06 §12); remember the original's galaxy map is silent — music belongs to scenes/screens.
- Performance: no per-frame allocations in animation loops; scale effort with `MOO.Perf.q`.
- Browser verification: open your **own tab** (`tabs_create`, pass `tabId` everywhere, close it when done), screenshot at ~1280×720 and 1920×1080 (`resize_window`, then reset to preset `desktop`), read console errors (`read_console_messages`), iterate until it is polished, aligned and bug-free. Don't leave debugging code behind.
- Keep your final reply ≤150 words: files, exported API (one line each), known gaps, anything you need from the lead.
