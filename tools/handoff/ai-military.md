# Handoff — AI military & espionage

Files: `js/ai/military.js` (step 30), `js/ai/spy.js` (step 70), `js/ai/diplomacy.js` (empty documented stub so the manifest entry resolves), `tools/rules/82-ai-military.test.js` (71 tests), `tools/ai-notes/military.md`.
State: `node tools/check.js` 0 errors · `node tools/rules-test.js` 719 passed / 0 failed · 6 real AI games (simple→impossible, 100–250 turns, 3–6 empires) ran with zero planner exceptions.

## Done
* planet ratings + target list, send_attack (40 % gate, strict force > D, whole stack, used markers, Expansionist treaty-break odds → `diplomacy breakTreaty expand` order), send_defend, send_idle (<8 fleets), invasion transports (pop/2, >20, ships in orbit), strategic-retreat helper, spy/security planner (year>30, 8·diff, modes, 1-in-3, d5+5, Darlok).
* No double use of ships (shares the `AI.Intel` orbit overlay); deterministic and pure (JSON-hash tests per step and per plan).

## Not done / by design
* Bombardment decision is the Ground engine's (`Ground.aiBombs`); planner `bombard` orders would be wiped because `Combat.findBattles` resets `S.bombard`.
* Idle clean-up wrong-index bug (unspecified), Classic ship deletion, 32-bit masks: not reproduced.
* Phase B of the attack planner stays dead (quirk `attackPhaseBDead=true`); `transNoWarRequired=true` keeps "conquest by lingering scout" (see below).

## Patches wanted in other files (exact)
1. `js/sim/ground.js` `G.inbound`: count ALL transports of the bomber heading to the planet (`t.owner === a && t.to === p.starId`), not only those already at the star's x,y (1oom `game_turn_bomb`).
2. `js/sim/ground.js` `G.bombard` AI branch: never bomb a human owner while `Diplo.ceasefire(S, owner, bomber) > 0` (research/08 §4.8, §5.4) — currently missing.
3. `js/ai/intel.js` `Intel.designThreat`: use `w.tl * w.count` and `2 * K.SPECIALS[sid].tech.l` (tech levels, 1oom `tech_i`) instead of the enum numbers `w.n` / `sid+1`, so fronts' force share and `sh.force` use the same scale as military.js.
4. `js/sim/diplo.js` `breakTreaty` order with `expand`: source caps rel1 to 20 only when it was > 30 (NAP branch); Diplo caps at 20 whenever > 20 (minor).

## Quirk flags (AI.QUIRKS; true = original) — defaults
attackPhaseBDead **true** · transNoWarRequired **true** · attackDesignBound false · targetSortEarlyStop false · transFromRebellion false · threatCountsAllies false · threat16 false · spyCeasefireIndex false.

## Measured
200–250-turn games: impossible/6 empires → 63 wars, 138 attacks, 57 transports, 20 conquests; average/5 → 8 wars, 47 attacks, 52 transports, 25 conquests; simple → 0 wars, 7 conquests via lingering ships. military+spy ≈ 0.05 ms, full plan ≈ 0.14 ms.

## Next steps
1. `node tools/soak.js --matrix --games 12` with the Diplo war log: wars per race/difficulty, "gangs up on the leader", stalemate / suicide-wave counts (08 §16).
2. Decide `transNoWarRequired` (faithful: true) once conquest-by-scout frequency is seen in soak.
3. Apply patches 1–3; optionally implement the idle clean-up bug if the original behaviour is ever documented.
