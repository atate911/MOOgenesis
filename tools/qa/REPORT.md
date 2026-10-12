# QA report (session 3 — automated headless-Chromium pass; started HANDOFF item 1)

Tools: `tools/qa/smoke.js` (load + N end-turns, console capture), `tools/qa/screens.js` (every bottom-bar screen, resizes, 40 turns).
Run: `NODE_PATH=$(npm root -g) node tools/qa/screens.js` (Playwright + /opt/pw-browsers/chromium, SwiftShader GL).

## Checked (zero console errors/warnings)
- [x] Dev-URL boot into galaxy (human, medium, 3 opp, average, 30 auto turns)
- [x] Game menu (Esc), Design, Map, Races, Planets, Tech screens open/close
- [x] Viewports 1024×600, 1280×720, 1920×1080, 2560×1440 on the galaxy screen (1024×600 layout fine)
- [x] 40 consecutive end-turns via Enter
- Baseline: `check.js` 97/97 ok; `rules-test.js` 758 passed, 1 skipped.

## Not yet covered (still open in HANDOFF item 1)
Title/new-game wizard clicks, Fleet screen, tactical battle + animations, diplomacy audiences, spy/council choices,
bombard/landing scenes, event cards, the four endings, save/load round-trip, GPU-off / workers-off / low tier.

## Bugs found
None so far. (Two script failures were wrong button labels in the test, not game defects: there is no "Colonies" button; "Fleet" not "Fleets".)
