# AI military & espionage — notes (js/ai/military.js step 30, js/ai/spy.js step 70, js/ai/diplomacy.js = empty stub)

Spec: research/08 §3.5–3.8, §4, §5, §10, §13–§18 · research/07 §2.11, §2.13, §8.4–8.5. Details cross-checked against 1oom `game_ai_classic.c` (rules/numbers only, nothing copied).
Tests: `tools/rules/82-ai-military.test.js` (71 tests: formulas at boundary values, Monte-Carlo of every gate ≥ 20 000 draws, war fixtures, determinism, purity, perf).

## Spec § → where
| § | rule | code |
|---|---|---|
| 08 §4.1 | design threat Σ(weapon tech level × n, bombs/bio excluded) + (shield idx+10)·hp/50 + 2·tech level of specials ≥ Battle Scanner; ×2 AI after election, ×2 final war | `Mil.designThreat` |
| 08 §4.1 | force table (own/unowned stars only), force_own_sum = Σ/25 halved after election and at game end | `Mil.newPlan` |
| 08 §3.6 | planet_w: effective owner of unowned stars with foreign ships, war/need_conquer/ended, frange==1, type ≥ colonyFor, Orion after year 120, weight pop−10·bases+30·special−20, sorted desc | `Mil.buildTargets`, `Mil.planetWeight` |
| 08 §3.7 | send_attack: per front, walk targets (used / range < fuel·15 / d100<40 / force > D) → whole stack; ally 1/4 (5/8 Expansionist), NAP 1/2 (always Expansionist) → `diplomacy breakTreaty expand` order, no fleet | `Mil.attack`, `Mil.defenderWeight` |
| 08 §5.1 | send_defend: flat 50 (<5 bases, no ships, overwrites), list force·4/3<threat, first list planet within 30S+20, only if threat·5/3<force, then threat=huge | `Mil.defend` |
| 08 §4.5 | send_idle: only <8 fleets in flight, anchors stay, force<force_own_sum stays, front minimising dist·10/(20S+20)+value | `Mil.idle` |
| 08 §4.7 | trans_en: source pop ≥ max/2 and >20, target = non-allied enemy planet with my ship in orbit, nearest source in 30S+30, pop/2, ceasefire(human) skip | `Mil.invade` |
| 08 §4.8 | bombing: **engine** (Ground.aiBombs); planner orders would be wiped by Combat.findBattles (it resets S.bombard) | – |
| 08 §5.3 | retreat: no planner order; `Mil.retreatTarget` = same rule Combat applies | helper |
| 08 §10.1 | security 8·diff (+coin·spies on me) ≤100; modes Hide/Sabotage(war)/Espionage(d200>200+2·rel); human always, AI 1 turn in 3; budget d5+5 ‰; year>30 | `js/ai/spy.js` |

Ships go out through `AI.Intel.send` (whole stack, range-flag filter, orbit overlay, inFlight) so nothing is used twice; the 208-fleet table limit is honoured.
`ctx.shared.mil` = {targets, used, forceSum, forceOwnSum, threat, attacks, breaks, defends, idles, transports}; `ctx.shared.spy` = {security, planned, applied, spiesOnMe}.

## Quirk flags (AI.QUIRKS.name; true = original v1.3)
| flag | default | meaning |
|---|---|---|
| attackPhaseBDead | **true** | second attack pass never runs (stacks over enemy planets stay put = what the invasion transports need). false = run it (60 % roll, 3/2·force > hull weights) |
| transNoWarRequired | **true** | trans_en has no war test: a scout lingering over a foreign planet triggers invasion transports (original; produces conquest without war). false = require war/need_conquer/ended |
| attackDesignBound | false | original summed foes' ships over my own design count (1oom fixed it) |
| targetSortEarlyStop | false | original bubble sort resets its flag per comparison and can stop early |
| transFromRebellion | false | Classic lets rebelling planets launch transports |
| threatCountsAllies | false | Classic counts allied fleets as threats (shared with economy panic mode) |
| threat16 | false | 16-bit wrap of design threat |
| spyCeasefireIndex | false | original tests ceasefire[e][e] → AI spies never hide during a human ceasefire |
Kept as the original (no flag): defend takes the FIRST list planet in range and never tries a second; flat-50 overwrite; unit mismatch hull-weight threat vs design-threat force (doom stacks are never intercepted); fleets over enemy planets get no orders.
Not reproduced: idle clean-up "writes the wrong index" (effect unspecified); Classic deleting ships that cannot travel; 32-bit masks.

## Decisions on ambiguous spec
* Threat uses TECH LEVELS (`w.tl`, special `tech.l`) — 1oom `tech_i`; shield term uses the design's shield index (array idx+1). js/ai/intel.js uses enum numbers for its own `sh.force/threat`; military.js keeps its own consistent tables (only the fronts' force-share differs slightly).
* D's shield term = the owner's planetary-shield TECH level (`E.mods.planetShield`), per source, not the planet's own shield.
* Spy activation: human target always, AI target 1-in-3 (source confirmed; the first fetch summary had it inverted).
* Bombs and biological weapons are both flagged "bomb" in 1oom → excluded from threat.

## Measured (6 real AI-only games, no planner exceptions; 71 + whole suite 719 tests green)
* average/large/5 empires (k1) 200 t: 8 wars, 47 attacks, 52 invasion transports, 25 planet ownership changes (0 by t100, 5 by t150); k2: 2 wars, 10 attacks, 3 conquests; k3: council end at t99 (no war).
* simple/250 t: 0 wars, 1 attack, 7 conquests (lingering-ship transports); hard/medium: council at t107.
* impossible/huge/6 empires 250 t: 63 wars, 138 attacks, 57 transports, 20 conquests (1@50, 1@100, 4@150, 14@200, 20@250); Diplo broke 14 NAP / 26 alliances, 17 peaces.
* Cost: military+spy ≈ 0.05 ms median, full AI.plan ≈ 0.14 ms on a 108-star 6-empire game (tests assert ≤ 2 / ≤ 5 ms).

## Known gaps / to verify
* "gangs up on the leader" (08 §16) and stalemate/suicide-wave statistics need `tools/soak.js --matrix` runs with the war log; wars come from Diplo.
* Huge stacks (1000–3000 ships) appear late: the economy's missile-base-saturation quirk (Classic), not this planner.
