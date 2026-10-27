# QA through the real UI — report (headless Chromium, software GL)

Scripts: tools/qa/*.js. Console errors: none in any scenario.

Measured visual audits (added with the visual-system passes; outputs in the ignored `tools/out/`, the `.py` scores need Python 3 + Pillow):
- `audit.js [desktop|phone]` + `audit.py [prof] [screen]`: a screenshot and every visible text element per screen; WCAG contrast of each text against the pixels behind it, luminance / saturation / highlight balance, spacing rhythm.
- `finish.js [desktop|phone]`: the tells of an unfinished interface in the DOM (clipped text, unequal sibling buttons, distinct type sizes, edge colours, shadows, chamfers, mixed case, "...", bevel light direction).
- `histo.py`: RGB histogram statistics of every raster in assets/art and the race portraits by set, with outliers, and the same statistics for regions of the audit screenshots.
- `racesite.js <tag>` + `racesite2.js <tag>` + `racesite.py <tag> [<tag2>]`: every race photo in situ (Races cards, Report, audience, Almanac, council, New game, research scene) scored against its surround; two tags give a before → after table.
- `phone-fit.js [sizes] [views]`: every phone screen, scene and dialog at seven iPhone sizes (SE, 15 and 15 Pro Max; in Safari, from the home screen, and on its side) with the iPhone safe areas emulated (every `env(safe-area-inset-*)` in the CSS and JS is rewritten to the device's insets, which headless Chromium reports as 0). Lists text cut by its own box or a box that does not scroll, text off the screen, text buried in a small inner scroll box, keyboard hints on a touch screen, controls or text covered by another element (after scrolling them to the middle of their list), and anything under the notch, Dynamic Island or home indicator. Exit code 1 when anything is found.
- `skytest.js <name>` (env VARIANTS, TIER=high, CPU=1): a contact sheet of sky palette variants over `Space.SKY`.

Covered, all clean: tactical combat with real clicks; diplomacy (all menus + 18 AI-initiated shapes); council accept (exile) and defy (Final War); spy panels; bombard/landing scenes; 19 event kinds; the four endings (conquest and defeat also via endTurn); scrap with ships in orbit; save/load/Continue; 8 layout/setting modes (1920/1024/2560, low, GPU off, workers off, reduced motion, ultra); 3 fuzz runs of ~1,500 actions.

Fixed: Spies Caught button + C key (Races) + Game menu entry; GNN archive (N on Races) + Game menu entry; data-help hooks (design, races, overview, combat); design editor narrow layout; audience panel overlap; ~30 GNN categories mapped; stale audience note; title screen "year 4" -> calendar year; plurals; missing menu icons; favicon 404.

Sim bugs for owner:
- setup.js hard-codes the slot-0 objective (playerAI only).
- game.js 10 s watchdog warns on normal human-paced interrupts (council, gameover) — mitigated: the UI only shows it on the galaxy screen with no modal.
- No human spy steal/sabotage choice appeared in 12 turns with 25 spies per rival.
- Huge map with AI-played human slowed 285 ms/turn (T20) -> 756 ms (T60) under CPU contention; not investigated.
- A passive human is eliminated by ~T110 on Hard.

Not verified: real GPU/audio, frame rates.
