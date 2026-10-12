# Handoff — UI diplomacy (Races · Report · Status · Audience)

Files: `js/ui/races.js` (screens `races`, `report`, `status`; exports `MOO.UI.Races` helpers), `js/ui/audience.js` (screen `audience`, `MOO.UI.Audience.open/show/isOpen`),
`tools/test-diplomacy.html` (boots the real game + fixtures: `?dev=1&screen=races&race=psilon&opp=4&turns=30&seed=abc`, flags `a1..a3 t1..t3 tr1 fx=0|raw`).
Both UI files are in the manifest already; both pass `node --check` and load with no console errors (only 404s for other agents' unwritten files).

## Done (verified in the browser against the real js/sim/diplo.js at 1280x720)
- Races: 2x3 grid (5 rivals + security cell), portraits (Gfx.Portraits, animated ~20 fps), banner name plate, treaty / trade text, 17-step relations bar + pointer,
  spy-network slider (`spyBudget`, step 4 = 0.4%), Hide / Sabotage / Espionage (`spyMode`), overall security slider (`security`), allocations %, No Contact / Not Present / Destroyed
  states, keys S R A O Space Esc 1-5, right-click, Report/Audience "pick an empire" mode, double-click portrait = audience. Galaxy key R / bottom-bar Races opens it.
- Report: portrait, personality + objective (tooltips), report age, Alliances / Wars, six tech boxes (techs you lack highlighted) from `Spy.reports`; left/right cycles empires.
- Status: six bar groups from `Sim.powerBars` (+ `Q.status` raw values in tooltips), animated bars, cross-highlight on hover, year LED, history sparklines (in-memory, from first open /
  `turn:end`), "Full scale" toggle (default auto-zooms each box so early-game bars are visible; original is fixed 0-100).
- Audience: `Scenes.audience` hall per race + procedural hooded emperor (banner colour, from behind) + typed dialogue (Data.text.diplomacy, personality voice) + original menus.
  Tested: greeting, Propose Treaty submenu, refusal with gate note ("will not even consider"), Good Bye, AI-initiated `Audience.show` with real `Diplo.turn` interrupt
  (first contact -> Continue -> returns 'ok' to `it.answer`), AI proposal (Accept/Reject, Y/N keys), consecutive interrupts keep the same scene, exit returns to the caller screen.
- Game.handlers.diplomacy (flow.js) already calls `UI.Audience.show`; a full `Game.endTurn()` ran clean.

## Not verified / not done
- Not click-tested: accepted proposals + counter-offers (sweeteners Agree / Forget It), trade levels, tribute (BC / tech), threaten / break treaty (confirm modal), tech exchange (2-step),
  "ambassador recalled" ending (code path `recalled()` written, never triggered), war outcome -> Continue -> end.
- Not checked at 1920x1080 or ultrawide; Perf throttling of the scene draw only by `Perf.q.animFps`.
- Trade hologram table (`Scenes.audience` option `table`) unused. Report age is "N years old" (simplified from the original "15 / 72 years old").
- Music: only one track per race exists (`race:<id>`); code tries `race:<id>:war` for hostile attitude if such a track is ever added.
- Incentive lines ("what if we also offered …") and the offer "terms" chips are our own wording in audience.js (no text.js situation exists for them).
- The Report lists techs <= the spy report's best level that the target has completed (slight over-reveal if a low tech finished after the report).

## Known bugs / quirks
- Audience typing and animation run on requestAnimationFrame: with the browser tab hidden nothing advances (headless tests must front the tab).
- `Diplo.turn()` recomputes contact geometrically, so fixture contacts set by hand disappear after a turn (test page only).
- In the dev pane, `resize_window` emulation sometimes degrades to a cropped zoomed screenshot; use `tabs_select` + re-apply the size.

## Next steps
1. Click-through every menu with the engine (use `tools/test-diplomacy.html` with a1/t1 params to reach alliance/trade/peace gates); check counter-offer UX and effect chips.
2. 1920x1080 + 967x735 layout pass of the audience panel (menu height vs. ambassador face) and Races slot density.
3. Optional: trade-table hologram in the Trade submenu, spy "Spies Caught" overlay (key C) on Races, lab scene (`UI.TechScenes`) when a tech is received.
