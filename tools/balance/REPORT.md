# Balance & AI audit report (session 3)

Scripts (all under `tools/balance/`, reproducible; JSON lands in `tools/out/bal-*.json`): `pace.js` (checks 1-2, 300 games all difficulties) · `techpace.js` (first-tech timing, A/B-able) · `signatures.js` (3+4) · `wars.js` (war AI statistics) · `quirks.js` (A/B of every quirk flag) ·
`robust.js` (5, 6: 1000 games, all sizes/opponents/difficulties/ages) · `roundtrip.js` (save/load) · `perf.js` (7). A/B experiments use `MOO_OVERRIDES='{"AI.QUIRKS.x":true,...}'` (applied by `tools/soak-worker.js` on every loaded sim).
Default setup of the runs: medium galaxy, 3 AI opponents + slot 0 played by the AI, average age, seeds in the script headers. `node tools/rules-test.js balance` pins every decision below.

## Headlines
* 1000 games across sizes small..colossal x 1-5 opponents x 5 difficulties x 3 ages: **0 exceptions, 0 crashes, 0 timeouts, 0 ERROR-level sanity warnings** (NaN, negative values, non-plain state, round trip, cycles, Math.random). Save/load mid-game (turn 60) then 40 more turns hashes identical to continuing (12 games, `roundtrip.js`).
* Difficulty ladder is monotonic in AI strength (production, RP, techs, ships, colonies at every checkpoint) **except the documented Easy < Simple oddity** (kept, see decisions).
* Median techs at T100 (all empires): simple 19 / easy 15 / average 22 / hard 25 / impossible 31. Median colonies T25/50/100/150 at average: 3 / 5 / 8 / 9 (medium galaxy has 48 stars; the count saturates around 9 because the map is full).
* AI first tech: median turn of the first completed tech 22 (p10 17, p90 29) after the fix, 28 before it; empires with a >30 turn research drought before T100: 3 % (27 % with the original quirk).
* Games end mostly by Galactic Council (T175 median when it happens); 20-30 % of AI-only games with 2-4 AI opponents reach the 300-turn cap, 93 % of two-empire games do (a 2/3 council vote cannot exist between two similar empires; conquest is rare).

## Decisions: kept original quirk vs fixed
| Flag | Default | Decision / evidence (A/B over 48 games, average, T150 cap; differences below ~10 % are noise at that size, so fidelity to the research decided) |
|---|---|---|
| `Config.QUIRKS.aiFirstTechCost` (new) | **false = FIXED** | AI first project costs `level^2*50` (2.5-4x the normal cost at tier 1) in v1.3. Fix (1oom `ai_first_tech_cost_fix`): first new tech T22 instead of T28, techs at T100 22 vs 20 (+10 %), RP T100 +17 %, droughts >30 turns 3 % vs 27 %. The ladder is unchanged. `options.aiClassic` restores the quirk. This is the "slow AI tech pace" answer; the remaining slowness (techs T150 34, T200 48 at average) is the tech cost curve itself, which is verified (research/02), not a bug. |
| `popTenthsTwice` / `hiddenChildLabor` | true (kept) | existing decisions (verification-fixes.md); removing popTenthsTwice cuts RP at T100 by 14 % and ends games earlier |
| `wasteSub1`, `shipBonusBC`, `soilRounding` | false (fixed) | unchanged; flipping them gave +/-3-9 % production, no stability change |
| `designExcludeNewest` | true (kept) | original design-quality feel (engines 1-2 tiers behind); false: ships T100 36 vs 44.5, otherwise equal |
| `designScrapCounter`, `transOwnRebelSource`, `transOwnOverwrite`, `attackDesignBound`, `transFromRebellion`, `threat16`, `spyCeasefireIndex` | false (fixed) | no measurable effect (identical or within noise); either they are dormant in AI-vs-AI games (spy ceasefire index only matters against a human) or too rare |
| `panicCountsAllies`, `threatCountsAllies` | false (fixed) | Classic counts allied fleets as threats: more defence ships (54 vs 44 at T100), games end earlier (100 vs 125); Classic+ behaviour kept |
| `fourthColonyShip` | false (fixed) | the "4th colony-ship curse" costs ~1 colony and ~7 % RP at T100 |
| `colonyDesignIndex`, `staleColonyOrbit` | false (fixed) | per research/07 s3 Classic delays recognising the colony design / wastes sources; the A/B shows no benefit from the quirk; fixed variants are the 1oom/Classic+ behaviour |
| `colonyRangeCap` | false (fixed) | cap lowers colonies (7 vs 8) and RP (-8 %) |
| `sliderOverspend`, `fleetCheatBug` | false (fixed) | `fleetCheatBug` makes planets dump everything into ships: RP -13 %, games end ~T107 vs T125 |
| `ecoWeightIsIndustry`, `silicoidEcoRatchet` | true (kept) | original table reading; flipping gives +/-5 % RP, no collapse |
| `researchSwap78` | false | literal code reading of the research weights (research/07 s4.3) |
| `attackPhaseBDead` | true (kept) | keeps besiegers in place for invasion transports; false = more aggressive (end T100 vs T125) but not what the original does |
| `targetSortEarlyStop` | false (fixed) | slight effect on target choice only |
| `transNoWarRequired` | true (kept) | "conquest by a lingering scout" is the original feel; false ends games sooner (T100) |
| `options.aiClassic=true` (all on) | off | available as the "authentic buggy AI" mode: colonies 6 vs 8, RP -37 %, techs T150 27.5 vs 34 |
| **Easy < Simple** (`Config.AI_PROD` '1oom': 1.0/0.8/1.25/1.5/2.0) | **kept** (research/07 #13) | measured: production T100 744 (simple) vs 478 (easy), RP 232 vs 121, techs 19 vs 15. New option **`options.aiProdGuide`** (and `Config.aiProdFactor(diff, S)`) switches one game to the monotonic strategy-guide table 0.8/0.9/1.0/1.25/1.5. The setup UI does not expose it yet (js/ui is owned elsewhere): one checkbox `aiProdGuide` is all that is needed. |
| **Klackon ~47-75 % win rate** | **kept (documented reason)** | `Colony.gross` doubles the worker term (spec-verified, OSG tutorial 82 BC gross); the race also builds small hulls (hull -3: ship count x2.5) and gets +15 ECO while growing. 47 % of finished games over 300 mixed games (chance 25 %), 75 % in the 1000-game soak where large maps favour it; ratios to the game mean at T100: production +14 % factories, RP x1.35. It is the strongest race in the original too (production), not an implementation bug. Test: `balance: Klackon worker term`. |

## 1-2 Pace and difficulty ladder (`pace.js`, 60 games per difficulty, medians over living empires)
### colonies
| difficulty | T10 | T25 | T50 | T75 | T100 | T150 | T200 |
|---|---|---|---|---|---|---|---|
| simple | 2 | 2 | 3 | 4 | 5 | 8 | 9 |
| easy | 2 | 2 | 3 | 4 | 5 | 7 | 9 |
| average | 2 | 3 | 5 | 7 | 8 | 9 | 9 |
| hard | 2 | 3 | 6 | 7 | 8 | 9 | 9 |
| impossible | 2 | 4 | 6 | 8 | 9 | 9 | 9 |

### production
| difficulty | T10 | T25 | T50 | T75 | T100 | T150 | T200 |
|---|---|---|---|---|---|---|---|
| simple | 117 | 249 | 382 | 538 | 744 | 1357 | 2129 |
| easy | 67 | 149 | 237 | 342 | 477.5 | 798.5 | 1144 |
| average | 174 | 327 | 613 | 1087 | 1695 | 2880 | 3999.5 |
| hard | 229 | 378.5 | 908 | 1666 | 2337 | 3760 | 5990.5 |
| impossible | 348 | 533 | 1507 | 2801 | 4074.5 | 7666 | 11662 |

### research
| difficulty | T10 | T25 | T50 | T75 | T100 | T150 | T200 |
|---|---|---|---|---|---|---|---|
| simple | 0 | 67.5 | 112 | 165 | 231.5 | 417.5 | 667 |
| easy | 0 | 35 | 53.5 | 81 | 120.5 | 205.5 | 332 |
| average | 0 | 83 | 177.5 | 350.5 | 554.5 | 942 | 1465 |
| hard | 0 | 102 | 273 | 554 | 889 | 1402 | 2368.5 |
| impossible | 104 | 162 | 524.5 | 1054.5 | 1643.5 | 2796.5 | 4284 |

### techs
| difficulty | T10 | T25 | T50 | T75 | T100 | T150 | T200 |
|---|---|---|---|---|---|---|---|
| simple | 6 | 6 | 11 | 15 | 19 | 26 | 35 |
| easy | 6 | 6 | 9 | 12 | 15 | 21 | 28 |
| average | 6 | 7 | 12 | 17 | 22 | 34 | 48 |
| hard | 6 | 7 | 13 | 19 | 25 | 40 | 59.5 |
| impossible | 6 | 9 | 15.5 | 22 | 31 | 52 | 77 |

### ships
| difficulty | T10 | T25 | T50 | T75 | T100 | T150 | T200 |
|---|---|---|---|---|---|---|---|
| simple | 6 | 8 | 16 | 10 | 16 | 46 | 107.5 |
| easy | 4 | 5 | 9 | 6 | 9 | 28 | 49.5 |
| average | 8.5 | 13 | 26 | 21 | 44 | 133.5 | 149 |
| hard | 9 | 15 | 28 | 29 | 62.5 | 187.5 | 228 |
| impossible | 17 | 25 | 42.5 | 44 | 120 | 259 | 242 |

### Slot-0 / all-empire outcomes by difficulty

| difficulty | games | finished | median end | slot0 win % (of finished) | techs T100 | first-tech turn (median empire) |
|---|---|---|---|---|---|---|
| simple | 60 | 43 | 175 | 30.2 | 19 |  |
| easy | 60 | 34 | 175 | 23.5 | 15 |  |
| average | 60 | 42 | 150 | 40.5 | 22 |  |
| hard | 60 | 49 | 129 | 20.4 | 25 |  |
| impossible | 60 | 39 | 125 | 15.4 | 31 |  |

Early game: 2 colonies at T10 on every difficulty (the free colony ship), RP present from T10 only on Impossible and by T25 on the others (AI start sliders), first new tech T22 median. Colonies per difficulty differ little (Simple and Easy throttle colony spawning, Hard/Impossible start with pop 40).
Slot 0 (an AI-played empire with the rotating race) wins 30 / 24 / 41 / 20 / 15 % of finished games at simple..impossible (chance ~25 %): the rate falls at Hard/Impossible because the other AIs get the production multipliers.

## 3-4 Objective, personality and race signatures (`signatures.js`, 240 games, T100; cell = ratio to the game mean, 1.00 = average)
### by objective at T100
| obj | n | wars | treaties | col | pop | fac | rp | techs | ships | wars/game (abs) |
|---|---|---|---|---|---|---|---|---|---|---|
| diplomat | 363 | 0.24 | 1.02 | 1.01 | 1.02 | 1.01 | 0.98 | 0.99 | 1.06 | 0.26 |
| ecologist | 141 | 0.13 | 0.97 | 1.05 | 1.06 | 1.05 | 1.17 | 1.03 | 1.11 | 0.19 |
| expansionist | 163 | 0.21 | 0.98 | 1.07 | 1.03 | 0.99 | 1.01 | 0.99 | 1.05 | 0.25 |
| industrialist | 119 | 0.13 | 1.05 | 1.00 | 0.98 | 1.00 | 0.94 | 1.00 | 0.63 | 0.18 |
| militarist | 130 | 0.21 | 0.94 | 0.90 | 0.92 | 0.96 | 0.90 | 0.96 | 1.32 | 0.21 |
| technologist | 220 | 0.24 | 0.97 | 0.96 | 0.97 | 0.98 | 1.00 | 1.02 | 0.80 | 0.27 |

### by personality at T100
| pers | n | wars | treaties | col | pop | fac | rp | techs | ships | wars/game (abs) |
|---|---|---|---|---|---|---|---|---|---|---|
| aggressive | 324 | 0.16 | 0.97 | 0.94 | 0.98 | 0.92 | 0.87 | 0.97 | 0.77 | 0.18 |
| erratic | 208 | 0.29 | 1.06 | 0.95 | 0.97 | 1.31 | 1.24 | 1.05 | 0.67 | 0.30 |
| honorable | 172 | 0.20 | 1.19 | 0.94 | 0.97 | 0.86 | 0.83 | 0.97 | 1.24 | 0.24 |
| pacifistic | 121 | 0.21 | 1.24 | 0.98 | 0.99 | 0.87 | 1.27 | 1.14 | 1.01 | 0.27 |
| ruthless | 109 | 0.19 | 0.72 | 0.84 | 0.87 | 0.73 | 0.60 | 0.87 | 1.08 | 0.24 |
| xenophobic | 202 | 0.21 | 0.78 | 1.28 | 1.16 | 1.16 | 1.15 | 1.01 | 1.46 | 0.24 |

### by race at T100
| race | n | wars | treaties | col | pop | fac | rp | techs | ships | wars/game (abs) |
|---|---|---|---|---|---|---|---|---|---|---|
| alkari | 124 | 0.13 | 1.18 | 0.94 | 0.97 | 0.85 | 0.76 | 0.94 | 1.77 | 0.15 |
| bulrathi | 108 | 0.16 | 1.06 | 0.84 | 0.91 | 0.76 | 0.72 | 0.93 | 0.26 | 0.17 |
| darlok | 113 | 0.16 | 0.80 | 0.79 | 0.83 | 0.78 | 0.68 | 0.92 | 0.73 | 0.13 |
| human | 107 | 0.21 | 1.28 | 0.91 | 0.93 | 0.86 | 0.80 | 0.96 | 0.81 | 0.26 |
| klackon | 110 | 0.17 | 0.76 | 0.99 | 1.02 | 1.14 | 1.35 | 1.11 | 2.53 | 0.23 |
| meklar | 126 | 0.27 | 0.99 | 0.86 | 0.91 | 1.70 | 1.37 | 1.05 | 0.46 | 0.29 |
| mrrshan | 108 | 0.24 | 0.69 | 0.79 | 0.81 | 0.65 | 0.48 | 0.84 | 1.05 | 0.29 |
| psilon | 114 | 0.33 | 1.15 | 1.00 | 1.02 | 0.89 | 1.58 | 1.25 | 0.71 | 0.38 |
| sakkra | 116 | 0.18 | 0.95 | 1.08 | 1.19 | 1.01 | 1.13 | 1.05 | 1.20 | 0.23 |
| silicoid | 110 | 0.24 | 1.06 | 1.82 | 1.42 | 1.29 | 1.07 | 0.94 | 0.44 | 0.27 |


Reading: the **race** signatures are clear and match the traits - Psilon RP 1.58 / techs 1.25, Meklar factories 1.70 / RP 1.37, Silicoid colonies 1.82 (any terrain), Sakkra pop 1.19 (growth), Klackon ships 2.53 and RP 1.35, Alkari ships 1.77, Bulrathi the weakest builder (ships 0.26). Mrrshan RP 0.48 is the lowest (its +15 SHIP slider add and no research bonus), Darlok colonies 0.79 - both consistent with research/07 s2.3 and the race data, kept.
**Personality** signatures: Erratic starts the most wars (0.29 vs 0.17-0.24: the d300<=difficulty path A), Pacifistic/Honorable sign the most treaties (1.24/1.19 vs Ruthless 0.72, Xenophobic 0.78), Xenophobic expands/builds most (colonies 1.28, ships 1.46).
**Objective** signatures are deliberately faint in the original (research/07 s2.4: weight rows differ by 1-2 points of 13): Militarist builds the most ships (1.32) and Industrialist the fewest (0.63), Ecologist leads RP/pop slightly; Technologist RP is only average and wars/game barely differ (0.18-0.27) because war checks depend on relative fleet/production envy and relations, not on the aggressor's objective (research/08 s3.2: only Erratic and the Militarist/Expansionist fleet-envy path differ). No code change: this is the specified behaviour.
Win rates (300 mixed games, council wins weighted by population): klackon 47 %, silicoid 47, sakkra 46, psilon 38, human 21, meklar 19, alkari 12, bulrathi 10 (chance 25 %). Bulrathi/Alkari are combat races (ground troops, speed) whose edge rarely shows because AI-vs-AI games are decided by the council economy, so they sit at ~0.4-0.5x - documented, not changed. Klackon is 1.9x (see decisions).

## 5 Game length, endings, wars (`robust.js`, `wars.js`)
games 1000 ok 1000 exceptions 0 crashes 0 timeouts 0 ERROR warnings 0
| opponents | games | finished | hit turn cap | median end turn (finished) | council | conquest/other |
|---|---|---|---|---|---|---|
| 1 | 200 | 15 | 93% | 260 | 0 | 15 |
| 2 | 200 | 140 | 30% | 175 | 139 | 1 |
| 3 | 200 | 154 | 23% | 175 | 154 | 0 |
| 4 | 200 | 154 | 23% | 175 | 154 | 0 |
| 5 | 200 | 160 | 20% | 175 | 160 | 0 |
warnings (code sev: occurrences) {"STUCK_RESEARCH warn":67,"NO_EXPANSION warn":68,"CAP_RATE info":1,"STUCK_TECH warn":15,"BALANCE info":34,"DEAD_OWNER warn":1}

War AI (90 games to T200): 9.5 wars per game started, but 37 of 90 games have no war at all, so wars cluster in a few contact-heavy games. **Gang-up on the leader: not observed** - 21.7 % of wars target the production leader at declaration vs 23.7 % chance. Median war length 22 turns, p90 60. Of the 88 wars lasting >= 60 turns 61 saw no planet change hands (stalemate-style wars; these are open-ended in the original too since peace needs mood/relation conditions). `stopWar` hooks miss some peace paths, so "still open at end" (478) over-counts. No change.
Stuck states (1000 games): STUCK_RESEARCH 67 / NO_EXPANSION 68 / STUCK_TECH 15 occurrences, almost all Simple/Easy on small *young* galaxies (few habitable planets: one colony at T40; research slider 0 because the ECO share needed for waste takes 60-70 % of a lone homeworld early on). One DEAD_OWNER warning (a planet owned by an eliminated empire, simple/medium/young, seed 24052, 4 opponents) - logged, not diagnosed. No negative economies or NaNs.

## 6 Robustness
See the headline; `node tools/balance/robust.js --det` adds the soak's determinism replay. Round trip: `node tools/balance/roundtrip.js` (12 games, sizes small..huge, 0 mismatches).

## 7 Performance (soak timings over 56 404 AI turns, medium galaxy)
Whole turn: p50 6.8 ms, p90 31 ms, p99 127 ms, max 1.0 s; AI planning p50 1 ms / p90 9 ms / p99 50 ms. Save size median 118 KB, max 174 KB. Run `node tools/balance/perf.js` for Huge/Colossal with 5 opponents (single thread).

## Remaining concerns
1. The 1-opponent (two-empire) AI-only case almost never finishes; a human plays it to conquest, so only soak statistics suffer.
2. Stalemate-style long wars (69 % of wars >= 60 turns changed no planet) - faithful to the diplomacy dice, but the war planner could use a "no progress" give-up; unmeasured vs the original.
3. Research 0 on a lone ECO-heavy homeworld (Simple/Easy, small young maps): matches the verified waste/ECO rules; a tutor hint exists for the human (`Sim.Q.hints`), UI display pending.
4. Easy < Simple stays; expose `options.aiProdGuide` in the new-game wizard if a monotone ladder is wanted.
