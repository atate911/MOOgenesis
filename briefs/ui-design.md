# Brief: Ship Design editor

**Read `briefs/_ui-common.md` first.** Spec: `research/06-ui-presentation-audio.md` §5.11 (editor layout/behaviour) and §5.10 (6-design limit, Specs), `research/03-ships-combat.md` §1–§3 (hulls, formulas, every component), `js/sim/design.js` + `js/data/components.js` (another agent finishes these; code against `MOO.Sim.Design.{compute, stats, available, cost, hullSpace, maintenance, startDesigns}` and the `design`/`scrapDesign` orders in DESIGN.md B4 — read the files as soon as they appear).

## You own
`js/ui/design.js` (screen `design`).

## Requirements
- The **Design** button opens the editor directly with the last design loaded (library of the 6 designs on the left/top as tabs or slots; choose empty slot = new design). Layout follows the original: summary strip (Attack level, Missile defense, Hit points, Warp, Defense, Combat speed) over slots **Computer, Shield, ECM, Armor, Engine, Maneuver, Weapons 1–4 (count spinner ▲▼, damage, range, notes), Special 1–3**, hull selector **Small/Medium/Large/Huge**, ship icon/look picker (looks are cosmetic; colours come from the banner), name field, **Ship cost**, **Total space**, **Available space**, buttons **Cancel / Clear / Build** (hotkeys C/B), validity message when space < 0 or mandatory parts are missing, and the original's component **pop-up tables** (name, description, cost, size, power, space; weapons also MAX that fits, damage, range; unresearched/overweight rows dim).
- Modern upgrades (the point of the remake): a large live **3D-ish ship preview** (`Gfx.Ships.draw` animated, race + banner colour, hull class scales) that visibly gains turrets/engines as you add parts, **before/after stat deltas** vs the saved design and vs the best existing design, a space bar showing how the hull's space is used (engines/weapons/armor/specials colour-coded), cost breakdown tooltip, "what beats what" hints (e.g. warns if no ECM against missiles — keep tasteful), quick "Autofill" suggestions (max armor, max weapons) are optional extras. Ctrl = ±10 counts, Alt = max fit/zero as in the original.
- Weapon kinds: show icons (`UI.icon('beam'|'missile'|'bomb'|…)`). Bombs/bio weapons are listed for ground targets; Death Ray etc. only if owned. Colony bases show which planet types they settle.
- Saving: `Game.order({t:'design', slot, design})`; Scrap from the library (confirm; `scrapDesign`). Max 6 designs: when full, Build asks which to replace. Show maintenance (2%/turn) cost.
- Plays `Audio.Music.play('design')` if available and SFX on part selection.
Test via `?dev=1&screen=design&turns=30` (techs accumulate during the auto-played turns).
