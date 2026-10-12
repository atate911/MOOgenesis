# Handoff — tactical combat (`js/sim/combat.js`, tests `tools/rules/50-combat*.test.js`)

## Done (131 rule tests green: `node tools/rules-test.js combat`; `node tools/check.js` ok; 3x120-turn headless AI games ran 27 battles, 0 errors)
- ONE file `js/sim/combat.js` (5 `MOO.def` blocks, load position already in manifest): data/maths + `findBattles` · tactical engine · tactical AI · resolve/applyResults/ops.
- API in the header comment of combat.js (full UI contract + event catalogue): `findBattles(S,R)`, `resolve(battle,R[,{full}])`, `applyResults(S,results,R)`,
  `create/legalMoves/targets/act/endRound/aiTurn/isOver/finish/retreatAll/scanInfo/hitChance`, `odds`, `retreatBeforeBattle`, `MOO.Ops.resolveBattle`.
- Rules implemented from research/03 §4: 10x8 grid, initiative (Mrrshan/Alkari/scanner/teleporter), Chebyshev movement, to-hit with 95 precap quirk + cumulative accuracy,
  beams/bombs/bio/missiles/torpedoes (fuel 2, planet +12, rocks, interception), shields/halving/streaming/enveloping/displacement, stack carry-over, planet collateral,
  all special devices, repair, reaction fire, wait/done/retreat, AI retreat formula, weight auto-resolve, monsters (Guardian/Crystal/Amoeba), loser flees to nearest planet.
- Integrates with: Design.stats snapshots, Diplo.canFight / incident('combat'), Events monster model (attackable/killer, Events.killMonster), Ground (S.bombard), News (battleWon/battleLost/fleetDestroyed/guardianSlain/planetDestroyed).

## Decisions / deviations (also in the header comment)
- Human is always the LEFT side; at most one battle per star per turn (a star with a monster: one battle per empire party). A planet with 0 bases and no ships is NOT a party
  (original rule) -> unopposed bombard candidates are written to S.bombard by findBattles. "No treaty" is hostile (via Diplo.canFight).
- 51 rounds (the original's off-by-one, verifier-confirmed); Wait does not repeat start-of-turn effects but a waiting group still gives reaction fire; Oracle does not halve shields; Black Hole single-ship inversion kept (CONFIG.bhBug);
  Guardian repair per v1.3 table (CONFIG.guardianFix); Amoeba repair 50%; AI-vs-AI 32-bit overflow NOT reproduced (CONFIG.overflowBug).
- Missiles advance only at the END of their target's turn (chase the final position), not step by step during its move.

## Verifier errata (research/03-verification.md) — applied: wait=reaction fire, 51 rounds, planet Interdictor +1000 initiative and teleporters back when the last base dies,
   displacement rolled once per missile stack, missile collateral halving tested before the volley's kills, no rock +30 at the planet, pulsar kill rule (hploss > hp1).
   NOT applied: bio weapons also running the normal damage loop vs planets (item 7); rock +30 'last obstructing cell' nuance for non-planet targets (item 6).

## NOT done / known gaps
- No UI wiring checks: `js/ui/combat.js` (controller) did not exist when I finished; `js/ui/combat-fx.js` already matches my event names (spot-checked, not run in a browser).
- Battle AI is a simplified version of research/08 §6 (no per-missile "inc" accounting, no random 20-cell tie lists beyond best-cell pick, cloaked-distance rule skipped).
- Orbital bombardment itself is Ground's; combat only fills S.bombard. Combat Transporters/gauntlet = Ground.
- Retreat fleets get `retreat:true` and speed = slowest warp; no stargate/fuel-range check (original: none).
- Weight model `survivors` uses floor(count*remaining/W); ties go to the left side (defender).

## Next steps
1. Run the real battle screen against `Combat.create/act/aiTurn/endRound` (see header contract); fix any field mismatch in events.
2. Optional balance: AI target scoring (`rank`, `bestRange`) vs research/08 §6.2-6.3; planet slot choice.
3. Add soak assertions (tools/soak.js) for battle counts per 100 turns and Guardian kills.
