# Handoff: UI ground / landing / bombardment / events / help (js/ui/landing.js, js/ui/help.js)

## Done (verified in the browser against the real js/sim/ground.js + events.js, no console errors from these files)
- `UI.Landing.colony(planetId[,{name}])` -> Promise<name|null>. Surface-scene descent, settlement flash, inline rename. `rename` order is applied at once if the planet is yours,
  otherwise queued and applied on the next Bus 'state' / 'turn:end' once the colony exists (flow.js calls it BEFORE Turn.run founds the colony).
- `UI.Ground.show({type:'ground', result})` -> invasion scene from a real `Ground.invade/resolve` record (approach with gauntlet fire, 15-per-row soldier grids with
  death markers, tracers + gunfire SFX, result panel with survivors / factories / captured techs). `visible:false` records are ignored. Rebellion (`rebellion:true`) reuses it.
  `show` also dispatches `{type:'bombard',…}` (result) and `{type:'bombardPrompt', planet, preview | entries}` (prompt).
- `UI.Ground.bombardPrompt({planet, preview}) -> Promise<bool>`; `UI.Ground.bombard(planetId)` = prompt + order `{t:'bombard', planet, yes}` (checked: S.bombard gets the entry);
  `UI.Ground.askPending()` loops `Sim.Ground.pending(S, player)`; `UI.Ground.bombardResult(event)` plays the `{type:'bombard'}` event of `Ground.bombard`.
- `UI.Events.show(interrupt)` for `{type:'event'}` (flow.js H.event already calls it): notice modal, plague/nova offer `eventCure`.
- `UI.Help`: `overlay(screenId)` (F1, chained pages, leader lines, selectors + `[data-help="screen.part"]` hooks), `register`, `install` (also runs when the file loads), `tutor`.
  Pages: galaxy (+colony panel), planets, fleets, specs, tech, design, races, mapoverview, combat, landing, help. Unknown screens get a generic page.
- Almanac = screen `help` (menu + game menu already link to it): Races, Technology (192 techs), Ships & components, Planets & stars, Rules, Controls, Tips + search with per-tab counts.
- Tutor pop-ups (Simple/Easy only, 12 topics, once each, `Settings.tutorSeen`, `Settings.tutor=false` turns them off) fire on turn:end / entering the galaxy screen.
- Test hooks: `UI.Landing._frame(dt)` / `_state()` (rAF does not tick while the browser pane is hidden); `UI.Landing.demo('colony'|'invade'|'invadeLost'|'bomb'|'bombResult'|'bombBio'|'bombDestroy')`;
  `?dev=1&screen=landing&demo=invade` plays a demo.

## Lead must wire (not my files)
- flow.js `H.colonize`: after a "Yes" call `await UI.Landing.colony(it.planet)` before returning true.
- turn.js: yield the events returned by `Sim.Ground.bombard(S,R)` (currently discarded) and, before it, an interrupt for `Ground.pending()`; handler = `UI.Ground.show` / `UI.Ground.askPending()`.
  flow.js: `H.bombard = it => UI.Ground.show(it)`, `H.bombardPrompt = it => UI.Ground.show(it)`.
- Hotkey F1 is bound by `Help.install()` (modal:true). galaxy.js also binds F3 (Perf binds it too) - unrelated.

## Not done / known gaps
- Help pages for design / races / mapoverview / combat use fractional anchor points (no widget selectors) until those screens add `data-help` hooks (names used: galaxy.map/hud/side/bar, colony.stats/sliders/build,
  planets.table/sliders/foot, fleets.grid/maint, tech.tabs/sliders/project/list).
- Overlay does not freeze animations underneath (only veils them). Boxes can overlap on very small windows.
- Invasion approach: sprites are plain troop-flag frigates; the gauntlet effects (missiles from bases, beams, monster ray) were not visually verified with a lossy record, only coded.
- Bombard result: impact explosions + bio/destroyed variants coded, only the plain variant was screenshotted. Tutor topics are not tuned (texts are short).
- Almanac tech costs use the current player's race/difficulty; races tab portraits are drawn lazily (tiny delay). Screens < 1000 px wide put the side panels at the bottom.
- No sound polish: SFX ids used: open, troops_land, ground_fire, missile_launch, explosion_small/big, laser, bomb, planet_hit, planet_destroyed, tech, war, alert, colonize, confirm.

## Next steps
1. Add `data-help` hooks to design/races/overview/combat and replace the anchor-point items.
2. Eyeball the lossy-gauntlet approach and bio/destroyed bombard variants at 1080p; tune ship size/timing.
3. Optional: freeze the underlying screen (pause its update) while the overlay is open; per-screen tutor topics (hostile planets in range, weapon milestone).
