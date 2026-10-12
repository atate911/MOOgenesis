# Handoff — Ship Design editor (`js/ui/design.js`, screen `design`)

Owner file: `js/ui/design.js` only (no other file touched). Test: `?dev=1&screen=design&turns=30` (or the galaxy bottom-bar **Design** button / key **D**).
Verified in the built-in browser at 1280x720 and 1920x1080 (also 1024x600 fallback): no console errors from this file; Build / Replace / Scrap / popups exercised end to end.

## Done
- Screen `design` registered; opens with the last (armed) design loaded as a template. `Screens.go('design', {from, slot?, hull?})`; `MOO.UI.Design.{flags, open, emblem}`.
- Layout: 6-design library (cards: hull sprite with add-ons, cost, atk/hp/warp, ships, Scrap) · summary strip (Attack, Missile def, Hit points, Warp, Defense, Combat speed) with delta vs saved design + best-owned marker + racial bonus badge · Computer/Armor/Shield/Engine/ECM/Maneuver rows · 4 weapon banks (count spinner, wheel, Ctrl +-10, Alt max/zero, damage, range, notes) · 3 specials (colony bases show settleable planet types) · hull selector (keys 1-4) · look (emblem) picker · name · Ship cost / Total / Available space · Cancel(Esc)/Clear(C)/Build(B) · validity banner.
- Pop-up tables for every slot (name, description, cost, size, power, resulting space; weapons: MAX, dmg, rng, kind filter; unresearched + overweight rows dimmed; "Show unresearched" toggle; hover = live preview; arrows/Enter/Space/Esc). Maneuver table too.
- Right column: Gfx.Ships hologram (banner colour, hull class scale, add-on flags, thrust by warp, shield bubble, callout pills via `Ships.anchors`, drag to turn, change flashes), colour-coded space bar + cost bar (tooltip breakdown), 9-stat compare table (vs saved / vs best warship), 2 matchup hints, Autofill (Best parts / Max armor / Max weapons).
- Orders: `design` (new slot, replace when full via dialog, unique names, unique emblems) and `scrapDesign` (confirm with refund). Music `design`, SFX on actions.

## NOT done / deviations
- "Looks" are cosmetic **emblems** (6 glyphs): `Gfx.Ships` has one livery per race/hull, so there is nothing else to switch. Other screens ignore `design.icon`.
- Build keeps you in the editor (original returns to the map); Cancel/Done leaves. Designs with ships are locked by the sim, so editing = "load copy, Build new" (or replace an empty-of-ships slot).
- No standalone test page, no unit tests (UI only).
- Start-of-game library costs show the original preset costs (10/15/66/86/591) while the editor shows formula costs until the first order/turn refresh (sim behaviour, `Design.PRESET_COST`).

## Known issues
- Built-in browser pane is shared: screenshots need `tabs_select` right before them; hidden-pane rAF throttling means animation/fps was not measured live (Ships.draw measured 0.02-0.05 ms).
- Below ~1240 px width the layout falls back to one slot column and the main panel scrolls; callout pills can overlap the ship on very short canvases.
- `node tools/rules-test.js` currently fails in `[82-ai-military]` (not this area).

## Next steps
1. Playtest Build/Scrap with ships in orbit (scrapDesign path with a real fleet) and with Fleet/Specs screens once `ledger-fleets.js` exists; let them open the editor via `Screens.go('design', {slot})`.
2. Optionally let other screens use `UI.Design.flags(stats)` for add-on sprites so thumbnails match.
3. If Gfx.Ships gains look variants, map `design.icon` to it and drop the emblem picker.
4. Add `tools/rules`-style checks only if Design API changes (`Design.maxCount`, `itemInfo`, `compute` are what the UI relies on).
