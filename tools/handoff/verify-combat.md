# Handoff - verify-combat (independent verification of research/03 vs 1oom source)

Report: `research/03-verification.md` (tables, CORRECTIONS, code audit, unverified list). Source = 1oom `src/game/*.c|h` (GPL; numbers only, no code copied).

## Result
- Every cell of research/03 §3 (63 weapons, 11 computers, 10 ECM, 11 shields, 14 armors, 9 engines, 30 specials, 4 hulls), T50/T25 tables, design cost/space/power/HP formulas, tech-percent formula and tech-level map: VERIFIED, 0 wrong.
- Rules verified: initiative, to-hit (precap + cumulative accuracy), damage/kill loop, missiles, planets/bases, specials, repair, retreat, AI retreat formula, AI-vs-AI weights, monsters, transport gauntlet, ground combat, orbital bombardment, planet_destroy.
- Wrong/now corrected: (1) waiting groups DO react (source sets can_retaliate=true on Wait); (2) 51 rounds really are played (timeout when num_turn>50 is checked before the increment).
- Omissions added: planet+Subspace Interdictor gets +1000 initiative; rock +30 only when last obstruction on the line is a rock and never vs the planet; Displacement rolled once per missile stack; bio weapons also run the normal damage loop vs planets; pulsar/stream extra one-ship loss rules; warp dissipator cumulative actman loss + retarget; ceasefire AI attacker fleet is retreated; base/transport/ground tiers use the LAST researched tech of a group.

## Audit state
- combat.js (1760 lines) only ~15% read in depth; ground.js formulas read. Tests: combat 130/0, ground 68/0 (they encode research/03, so they inherit its errors).
- Findings: C1 Wait sets canRetaliate=false (combat.js:1128; must be true); C2 maxRounds 50 (should be 51 for exact v1.3); C3 planet interdictor +1000 priority missing; C4 displacement per missile instead of per stack; C5 collateral halving timing for missile hits; G1 ground default tie rule 'defender' differs from v1.3 classic (use RULES preset 'classic' for exactness); G2 ground groupTier uses max tier, source uses last researched.
- Messages sent: combat agent adc98214843dff9b4 (items 1-8 of errata). Ground agent a62eda13f37a192f3 not messaged (no definite bug; G1/G2 are config/minor).

## Still unverified / not audited
Missile base cost formula; build/upkeep/scrap values; starting designs; AI tactical turn; Crystal/Amoeba/Guardian event logic and loot; transport 'half pop per turn' cap; beam/bio/special/bombard/gauntlet code paths in combat.js/ground.js line by line; missile base upgrade billing.

## Next steps for whoever continues
1. Apply C1-C5 (small edits), update tests that assert "waiting groups do not react".
2. Decide product policy for G1 (classic vs defender tie) and maxRounds 51.
3. Fetch game_get_base_cost (game_aux/game_misc), game_turn_build_ship/scrap, game_new.c start designs to close the unverified list.
4. Audit combat.js fireBeam/fireBio/special devices/gauntlet against research/03-verification.md §2.
