# QA through the real UI — report (headless Chromium, software GL)

Scripts: tools/qa/*.js. Console errors: none in any scenario.

Covered, all clean: tactical combat with real clicks; diplomacy (all menus + 18 AI-initiated shapes); council accept (exile) and defy (Final War); spy panels; bombard/landing scenes; 19 event kinds; the four endings (conquest and defeat also via endTurn); scrap with ships in orbit; save/load/Continue; 8 layout/setting modes (1920/1024/2560, low, GPU off, workers off, reduced motion, ultra); 3 fuzz runs of ~1,500 actions.

Fixed: Spies Caught button + C key (Races) + Game menu entry; GNN archive (N on Races) + Game menu entry; data-help hooks (design, races, overview, combat); design editor narrow layout; audience panel overlap; ~30 GNN categories mapped; stale audience note; title screen "year 4" -> calendar year; plurals; missing menu icons; favicon 404.

Sim bugs for owner:
- setup.js hard-codes the slot-0 objective (playerAI only).
- game.js 10 s watchdog warns on normal human-paced interrupts (council, gameover) — mitigated: the UI only shows it on the galaxy screen with no modal.
- No human spy steal/sabotage choice appeared in 12 turns with 25 spies per rival.
- Huge map with AI-played human slowed 285 ms/turn (T20) -> 756 ms (T60) under CPU contention; not investigated.
- A passive human is eliminated by ~T110 on Hard.

Not verified: real GPU/audio, frame rates.
