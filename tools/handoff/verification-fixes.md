# Verification fixes (HANDOFF item 3, sim side) - decisions: kept quirk vs fixed

## Economy quirks - `Data.Config.QUIRKS` (js/data/config.js; true = original v1.3, false = fixed)
| Flag | Default | Why |
|---|---|---|
| popTenthsTwice (C7) | true (kept) | existing decision: pop 2 -> 50 in 29 turns, matches the Let's-Play observation |
| hiddenChildLabor (C5) | true (kept) | existing decision |
| wasteSub1 (C8) | false (fixed) | second waste term (~+20 % waste) is an unadvertised handicap on every colony; code is there (`Colony.buildEco`), flip to reproduce |
| shipBonusBC (C9) | false (fixed) | source calls it a bug (+1 BC per planet with SHIP > 0, in `Colony.buildShips`) |
| soilRounding (2.3) | false (fixed) | research/04 chose the guide's "round up to 5"; the 1oom increments (Fertile m/20, Gaia m/10) are in `Colony.soilInc` |
Absent keys read as the default. Tests: `40-colony` (defaults + each quirk).
Still open from 04-verification: B7 `autoSwitch` differences, B10 defence-upgrade billing (needs `Design.baseCost(basePrev)`), transports' BC cost timing.

## Combat (js/sim/combat.js) - research/03-verification
Already in code before this pass: Wait keeps `canRetaliate`, 51 rounds, interdictor +1000, Displacement once per missile stack, collateral halving timing (missiles before kills, beams/bombs after), pulsar/ion/neutron-stream rules.
Fixed now: rock +30 only when the LAST obstruction on the line is a rock (a planet cell behind it cancels it; ships never count; never vs the planet); warp dissipator is cumulative (`actman -= total unman`, defence -2 only while movement is left); bio weapons also run the bomb damage loop on the planet (damage = weapon max 1/2/3 minus absorb) after the population step (extra events filtered so the UI sees no duplicate beam).
Not applied / unaudited (research does not allow more): base HP and transport HP from the LAST researched armour rather than the best (`Design.stats` baseHp, `Ground.groupTier`); dissipator retarget-to-last-enemy; missile-base cost, build/upkeep/scrap, starting designs, AI tactical turn, Crystal/Amoeba/Guardian logic, transport cap. `Ground.tie` default stays 'defender' (product decision; `Ground.CLASSIC_RULES` for v1.3).

## Ground / intel / diplo
- `Ground.inbound` counts ALL of the bomber's transports in flight to the planet's star; `Ground.aiBombs` returns false vs a human holding a ceasefire (kept: the check is on the planet owner, AI bomber only).
- `Intel.designThreat` already used tech levels (`w.tl`, `special.tech.l`) and delegates to `Military.designThreat`; nothing to change.
- `callToArms` now clears `dipType` itself (the `dispatch` quiet-turn branch already zeroed it first).

## Smaller sim items
- `Econ.refresh` recomputes `E.research.total` (after the ECO floor).
- `Turn.run` yields the human's `tech` (breakthrough/discovery) scenes before the `techChoice` prompts.
- Soak: `RE_WAR/RE_CONTACT/RE_TREATY` rewritten; `Ev.push` records news categories in `S.newsThisTurn`, `autoTurn` tags all of them as `news:<cat>` (AI-vs-AI wars, contact via `Diplo.updateContact`), so NO_WARS/NO_CONTACT no longer fire.
- Tutor hint data: `Sim.Q.hints(S, empire)` -> `[{id:'noResearch', severity, planet, text}]`; the UI (js/ui/help.js, not touched) still has to display it.
