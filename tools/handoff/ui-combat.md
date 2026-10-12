# Handoff — tactical combat UI (js/ui/combat.js, js/ui/combat-fx.js)

## Done (verified in the browser against the real js/sim/combat.js)
- `Game.handlers.battle` (flow.js) -> `UI.Combat.fight(battle, S)`: pre-battle card in the galaxy side panel (`prebattle`): backdrop picture,
  "<A> attack(s) <D>", planet row, both forces, fleet-strength bars, Monte-Carlo odds (`Workers.run('resolveBattle')`, 32-120 samples),
  buttons Continue (C/Space) / Auto (A) / Retreat (R; confirm when no other colony exists). Keys use a capture listener and are released on choice.
- Auto = `Combat.resolve`; Retreat = `Combat.retreatBeforeBattle`; both end in a result card (`combatResult`) in the side panel; promise resolves with the result.
- Continue -> screen `combat`: 10x8 grid over `Gfx.Scenes.battle`, rocks, planet (Gfx.GLPlanets/Planets) with orbiting bases + shield bubble, ship stacks
  (`Gfx.Ships.draw`: count badge, HP bar, damage smoke, cloak/frost tint), selection frame, legal-move cells, enemies in reach, hover hit-chance tooltip
  (real `Combat.targets` numbers per weapon slot), initiative strip (round, done/active/pending), side panels, command bar
  Auto/Planet/Scan/Missiles/Special/Retreat/Wait/Done + hotkeys A P S M X R W D/Esc/Space, Shift+R retreat all, L log, speed 1x/2x/Skip (Settings.animSpeed).
- Event animation (combat-fx.js `view.play(events)`): beams (per weapon family), missiles in flight (missile-move/hit/lost), shield ripples, explosions,
  floating damage numbers, camera shake, warp-out, stasis/pulsar/black hole/dissipator/technull/stream/repulsor effects, planet impacts, round banner.
  The view is event-sourced and re-synced to the engine state `B` after every action, so a missed event cannot desync the screen.
- AI turns via `Combat.aiTurn`; mid-battle Auto = `Combat.autoPlay` then summary; summary overlay (victory/defeat/withdrawn, per-design start/lost/left, planet losses).
- Scan overlay (needs a Battle Scanner, `Combat.scanInfo`), planet info overlay, special-device picker + target mode, planet weapon-slot toggle (Missiles button).
- Dev: `?dev=1&screen=combat&scn=planet|fleet|defend|monster|crystal|amoeba|big|specials|nebula`; `UI.Combat.demo({scn})`, `UI.Combat.session()`.

## Not done / not verified
- Visual QA at 1280x720 and 1920x1080 and with a foreground tab: the embedded browser pane throttles requestAnimationFrame, so animations were exercised by
  pumping `view.frame()` manually (logic OK, but beams/missiles/explosions were not eyeballed). Scan/planet overlays, tooltip placement, log panel,
  `scn=big` (200 ships), nebula and amoeba/crystal art are untested visually.
- Bombardment / invasion prompts after a win: only a note in the result card ("open to bombardment") — wire to the Ground UI when it lands.
- No click-to-select of own units for info (hover shows it); no per-weapon targeting (all weapons in reach fire, as in the original).
- Music: only `Music.setIntensity` is driven (soundscape.js picks the combat mood from the screen id).

## Known bugs / risks
- Odds fall back to 12 inline samples if the worker pool is not up yet (first 400 ms after boot).
- Pre-battle card shows enemy design names and counts (information design choice; the original hid them without a scanner).
- If animSpeed is 0 (Skip) no sound/FX are played for the player's own actions (instant mode by design).

## Next steps
1. Open `?dev=1&screen=combat&scn=planet` in a foreground tab at 1280x720 / 1920x1080, play a few rounds, tune ship sizes (HULL_LEN), beam scale, label sizes.
2. Check `scn=specials`, `monster`, `big`, `nebula`; fix anything cut off in the bottom bar at 1280x720.
3. Add own-unit click info, hit-chance label on the canvas, and Ground-UI hooks for bombard/invade prompts.
