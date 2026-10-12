# Handoff: Council scene, spy scenes, endings (js/ui/council.js, spyscenes.js, endings.js)

## Done
- **council.js** (`MOO.UI.Council`, screen `council`): full chamber on `Gfx.Scenes.council` (candidates seated nearest the pedestal),
  tally bar (n votes A | N total | m votes B + 2/3 meter), replay of `info.ballots` (nomination, each empire speaks, "→ whom" chips),
  speaker hologram bust on the pedestal, YOUR ballot (cards + keys 1/2/0, Esc = abstain after 0.7 s), then `result()` in the same chamber:
  counting, winner + crown + `Data.names.councilTitles` title, Accept/Defy dialog (Y/N; Esc is ignored on purpose), "no winner" message.
  `show()` resolves the vote (candidate empire id | -1); `result()` calls `result.finish(accepted)` itself. Tested against real `Sim.Council.convene/resolve`.
- **spyscenes.js** (`MOO.UI.Spy`): `steal(it)` (six field buttons, tech preview, Esc aborts, frame-a-rival step, calls `it.answer(pick)`,
  then plays `TechScenes.breakthrough` using the queued `tech` event), `sabotage(it)` (colony table, Destroy factories/bases/Incite revolt,
  frame step, explosion result card), `victimNotice(ev)`, `caught()` (Spies Caught table from `Sim.Spy.reports`). Modal-based, not full-screen scenes.
  Self-wires `Game.handlers.spySabotageChoice` and wraps `Game.handlers.notice` for kinds techStolen/sabotage/spiesCaught/spiesLost/spyNothing.
- **endings.js** (`MOO.UI.Endings`, screen `endings`): good / tyrant (Gfx.Scenes.victory), funeral (Gfx.Scenes.defeat + procession), exile (drifting ship,
  parallax stars); race epilogue from `Data.text.epilogue`, closing GNN-style line, "Return to title" (`Game.quitToMenu`). Space = next, Esc = skip to last card.

## Not done / simplified
- Spy scenes are dialogs, not the original full-screen map backdrop with planet picture / mini-map; no spy music cues (no dedicated tracks).
- No per-colony mini-map or planet picture in the sabotage panel; explosion is a CSS animation, not `Gfx.Fx`.
- Endings: no animated GNN newsroom cut (closing line is a lower-third card); no "Keep playing" unless `interrupt.canContinue` is set (sim has no continue mode).
- Council: no relation-change preview numbers; seats > 6 are not supported (scene limit).

## Known issues / notes for the lead
- **Spies Caught key**: `C` is already "center on selection" in galaxy.js. Bind `UI.Spy.caught()` to another key / the Races screen.
- `Soundscape` maps screen `spyscenes` to council music; my spy UI has no screen, so nothing to change. Endings use screen id `endings` (matches the glue).
- `turn.js` does not call `ev.answer(a)` for spy interrupts; the UI calls `it.answer(pick)` itself (idempotent). `flow.js` could route `spySabotageChoice` + spy notices (currently self-wired).
- `Endings` "Return to title" calls `Game.quitToMenu()`, which autosaves the finished game into the continue slot.
- Headless-browser checks only (Browser pane was hidden); 1280x720 looked right, 1920x1080 not inspected.

## Next steps
1. Look at the screens at 1920x1080 / 4K and tune card sizes (`.cou-card`, `.spy-*`, `.end-*`).
2. Full-screen steal/sabotage scenes per research/06 §5.18 (planet picture via `Gfx.Planets`, mini-map of the target's colonies, music cues).
3. Newsroom cut (`Gfx.Scenes.newsroom` with `cut`) for the victory GNN line; keep-playing mode if the sim grows one.
4. Race-specific vote-request lines (`Data.text.diplomacy.*.councilVoteRequest`) before your ballot.
