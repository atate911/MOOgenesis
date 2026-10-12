# QA report (session 3 — automated headless-Chromium pass; started HANDOFF item 1)

Tools: `tools/qa/smoke.js` (load + N end-turns, console capture), `tools/qa/screens.js` (every bottom-bar screen, resizes, 40 turns).
Run: `NODE_PATH=$(npm root -g) node tools/qa/screens.js` (Playwright + /opt/pw-browsers/chromium, SwiftShader GL).

## Checked (zero console errors/warnings)
- [x] Dev-URL boot into galaxy (human, medium, 3 opp, average, 30 auto turns)
- [x] Game menu (Esc), Design, Map, Races, Planets, Tech screens open/close
- [x] Viewports 1024×600, 1280×720, 1920×1080, 2560×1440 on the galaxy screen (1024×600 layout fine)
- [x] 40 consecutive end-turns via Enter
- Baseline: `check.js` 97/97 ok; `rules-test.js` 758 passed, 1 skipped.

## Added in later passes (all zero console errors/warnings)
- [x] `title.js`: title -> wizard (size, race step, Next, Begin) for all 10 races; each game starts and plays 6 turns
- [x] `saveload.js`: save slot 1 at T20, play a turn, load -> state restored exactly; turn after load runs
- [x] `combat.js`: tactical demo scenarios planet, fleet, defend, monster, crystal, amoeba, big, specials, nebula all boot, render, and resolve via Auto (planet/big hit the 51-round cap, nebula 42 rounds: worth a balance look, not a crash)
- [x] `modes.js`: GPU off, low tier, reduced motion, threads=1, and all combined: boot, 8 real endTurns, hotkey screens d/m/r/p/t
  - Caveat: headless SwiftShader auto-detects tier `low` in every run, so the high/ultra tiers and real GPU paths are untested here.

## Not yet covered (still open in HANDOFF item 1)
Fleet screen clicks, galaxy interactions (send fleets/colonise prompt), diplomacy audiences, spy/council choices, bombard + landing scenes,
event cards, the four endings, autosave/Continue, 4K / reduced-motion visuals, rapid clicking, keyboard-only play, audio.
Note: the combat run drives the demo fixtures, not a battle arising from `Game.endTurn`.

## Bugs found
None so far. (Script failures were my own: wrong button labels, race step needing Next, and script timeouts killing the browser.)
