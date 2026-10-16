# Master of Orion — Reborn · Hand-off (read this first next session)

A browser remake of *Master of Orion* (1993): vanilla JS + Canvas2D (+ optional WebGL2) + Web Audio, no build step, no dependencies.
**Run it:** double-click `index.html` (works from `file://`), or `python -m http.server 8765` in this folder → http://localhost:8765/ (launch config `moo-static` in `.claude/launch.json`).
Dev shortcut (skips the menu, auto-plays N turns first): `index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&diff=average&turns=20` (`ai=1` = AI plays your empire too).
Docs: `PROGRESS.md` (plan/status/25-feature acceptance checklist) · `CONVENTIONS.md` · `DESIGN.md` (architecture, state schema, orders, interrupts) · `research/*.md` (verified rules = the spec; `*-verification.md` = errata from independent verifiers; `09-art-direction.md` = the graphics-pass plan) · `briefs/*.md` (agent briefs — ready-to-launch ones for QA, balance, GPU wiring, verification) · `tools/handoff/*.md` + `tools/ai-notes/*.md` (every builder's done / not done / next steps — read the one for the area you touch).
Commands: `node tools/check.js` (syntax of every manifest file) · `node tools/rules-test.js [area]` · `node tools/soak.js` (24-thread AI-vs-AI soak/balance; `tools/SOAK.md`) · `node tools/headless.js`.
Browser-pane tip: animations use requestAnimationFrame, so in the built-in browser pane a tab must be fronted (`tabs_select`) for anything animated (GNN, audiences, scenes, combat) to advance.

## Session 4 (October 2026) — branch `fix/turn-flow-robustness`
Full review in `tools/handoff/review-2026-10.md` (50 items, priorities, what is fixed) and the UI/immersion review in
`tools/handoff/ui-immersion-review-2026-10.md`. Fixed on the branch: the stuck-turn class (held side-panel prompts,
abortable turns, safe skip answers, highlighted "answer" controls), the P1 sim bugs (unanswered audience ≠ accept,
bombard needs an explicit yes, locked-Tech eco floor, dead empires' fleets, bombs vs empty planets, order validation,
tech-choice fallback, save-failure toast), the AI defend ping-pong and scrap policy, the graphics hitches, the
deployment scripts, and the first smoothness round (one-click fleet send, auto-battle option, brief news, etc.).
Immersion round: photo art everywhere a figure is shown (envoy, endings, GNN anchor masks), wide planet card, calmer
map. Still open: ship illustrations (Phase B), the star sprite, the galaxy map's first frame, repo size (PNG masters).
Verification used: `node tools/check.js`, `node tools/rules-test.js` (806), `node tools/soak.js … --strict`,
`tools/qa/turns.js`, `tools/qa/combat.js`, `tools/qa/fuzz.js`, plus the Playwright reproductions in the session notes.

## Where we are (end of session 3)
Session 3 worked through the session-2 list, mostly unattended. **781 rules tests green (21 areas), `check.js` clean (99 files).** Read these notes for detail: `tools/handoff/verification-fixes.md` (quirk flags + combat errata), `tools/balance/REPORT.md` + `tools/handoff/balance.md` (soak numbers, A/B of every AI quirk), `tools/qa/REPORT.md` (headless-Chromium UI QA: no console errors in combat/diplomacy/council/spy/bombard/events/endings/layouts/fuzz), `tools/handoff/graphics-v2.md`, `tools/handoff/followups.md`.

Done this session
- Verification: `Data.Config.QUIRKS.{wasteSub1,shipBonusBC,soilRounding}`; combat errata 6-7; ground `inbound` + ceasefire; callToArms; Econ.refresh research total; breakthrough scene before techChoice; base/transport HP + ground gear use the last acquired tech; dead empires' transports no longer land (DEAD_OWNER).
- Balance: 1000-game robustness run clean; `QUIRKS.aiFirstTechCost` fixed by default (`options.aiClassic` restores); Easy<Simple and Klackon (~47 %) kept as original; war stalemates and passive-human elimination on Hard match the original (no change). `options.aiProdGuide` exists but is not exposed in the UI.
- UI QA fixes: Spies Caught + GNN archive access, data-help hooks, narrow design layout, audience overlap, GNN categories, many small bugs.
- GPU: `Gfx.pick()` routes scenes/GNN/landing/endings/tech/side panels/map/setup/menu through GL renderers with Canvas2D fallback; `?tier=` forces a perf tier (software GL counts as 'low': use `TIER=medium` for QA); `tools/test-hw.html`; `Game.planAI` picks pool vs inline by measured speed. **Only SwiftShader numbers exist: run `tools/test-hw.html?auto=1` on a real GPU.**
- Graphics v2: theme v2 is now the default (`?theme=v1` = old look), per-screen retint, colour-grade pass. Portrait faces and the bright audience halls are still cartoonish; ships/portraits "rebuilt as lit 3-D" was NOT done.
- Turn-freeze report (user saw the "Year …" spinner and could not continue after moving ships on turn 1): NOT reproduced in ~15 UI configs. Added worker job timeout (30 s, re-runs inline) and a stalled-interrupt hint in the spinner after 10 s (`turn:waiting`). If it recurs, get the console log + which interrupt it names.

Still open
1. Real-hardware checks: GPU timings, audio, touch, other browsers, frame rates.
2. Graphics: portraits/ships/audience halls (see graphics-v2.md); music/SFX never listened to.
3. UI exposure: `Sim.Q.hints` no-research tip, `options.aiProdGuide`, a spy-panel tutor line ("set the network to Espionage" — human spy choices only fire in modes 1/2).
4. Verification: combat.js still only partly audited (AI tactical turn, Crystal/Amoeba/Guardian logic, beam/special/gauntlet paths); spy mission internals, event table/monster stats, most of the difficulty table; ground tie rule product decision.
5. Smaller: Guide-only event rules skipped; `js/ai/diplomacy.js` is an intentionally empty stub; autosave/Continue and Almanac lightly exercised; huge-map turn time grew 285→756 ms by T60 under CPU contention (not investigated on a quiet box).

## Design guardrail from the user (applies to the graphics pass and all UI work)
The new interface should **echo the original's interface** — same overall screen structure and flows (galaxy control screen with right-hand side panel, bottom button bar, five colony sliders, scene-style screens, the original's hotkeys) — not an exact copy, but recognisably descended from it with an upgraded, newer look. The "serious sci-fi, less cartoonish" pass must modernise rendering and chrome while keeping the original's layouts and feel; where `research/09-art-direction.md` conflicts, prefer the original's layout. Original screenshots are reference only and are never committed (copyright).

## Architecture in one paragraph
Plain-JSON state `S`; every change is an *order* (`Sim.Orders.apply`); the turn is a generator (`Sim.Turn.run`) yielding interrupts (aiPlan, battles, techChoice, explore, colonize, bombardPrompt/bombard, ground, diplomacy, council/councilResult, spy choices, event, gnn, gameover) answered by `Game.handlers.*` (UI, `js/ui/flow.js` + each screen module) or defaults (headless `Sim.autoTurn`). AI planners are pure (`AI.plan(snapshot, id, seed) → orders`, step table in `js/ai/ai.js`, helpers in `js/ai/ctx.js`) and run on the worker pool; battle auto-resolution too. Treaty/war/council decisions live in the engines (`Sim.Diplo`, `Sim.Council`), not in AI planners. All modules load through `js/manifest.js` (single source of truth for the browser and the Node harness).
