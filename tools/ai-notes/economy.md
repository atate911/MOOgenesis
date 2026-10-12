# AI economy notes (planets.js, research.js, economy.js, designs.js) — spec: research/07 §2, §4, §5, §6, §12 (P42/P45/P50/P60)

## Where each rule lives
| Spec | File / function |
|---|---|
| §2.3 p3 rebalance (ECO forced to `Colony.ecoFloorPct`, floors 5/5/10/25, young IND 50, race + special adds, 3..10 % chunks by weight row, War row at war) | `planets.js` `allocate`, step 50 |
| §2.4 weight rows, thresholds (w_eco reuses column 2) | `AI.Planets.W / thresholds` |
| §2.5 factories-maxed + base saturation (integer `pop/(5-d)`, shield ≥ empire level) | `AI.Planets.tweak` |
| §2.7 end-of-turn normaliser (only emulated under quirk sliderOverspend) | `AI.Planets.normalise`, `slidersRaw` order |
| §4.3 research re-roll (year % 10 == id, 50 % Propulsion before year 30, 25 % racial focus from `Data.Races ai.researchFocusFields`, d16 row, War row) | `research.js` `pick` |
| §2.6 panic + developing planets (planned-sliders overlay, reserve/5 per planet, shrinking pool) | `economy.js` `panic`, `developing` |
| §2.10 tax `rnd(10)+d+2` from year 20 | `economy.js` `taxValue` |
| §2.11 `trans_own` (dest pop < max/3 or rebelling, src pop > 3/4 max, first source in planet order, `dist_fast < 20·BS+20`, pop/3) | `economy.js` `transOwn` |
| §2.12 plague/nova → TECH, comet/pirates → SHIP, reserve/5 per event turn | `economy.js` `events` |
| §5.1–5.2 p2 countdown, roles, aging (>50 / >100), forced removal, refill colony → bomber → fighter | `designs.js` `runP2` |
| §5.3–5.6 hull roll, tiered pick, candidate window, armor II, special chances, banks, bank shares | `designs.js` `generate`, `tier`, `hullFor` |
| §5.8 build assignment (3 newest, colony = year 0, Stargate 50 %) | `designs.js` `runP2` step 5 |

State in `E.ai`: `countdown` (p3), `p2`, `p2Done`, `dyear[6]`, `order[]`, `shipiColony`, `shipiBomber`.  `ctx.shared.rawSliders` (quirk path only).
New order registered: `slidersRaw {planet, values[5]}` (AI empires only, integers 0..32767, no sum-100 rule).

## Quirk flags (AI.QUIRKS.name = default; true = original behaviour; `options.aiClassic` forces all true)
sliderOverspend=false · fleetCheatBug=false · ecoWeightIsIndustry=true · silicoidEcoRatchet=true · researchSwap78=false · panicCountsAllies=false ·
transOwnRebelSource=false · transOwnOverwrite=false · designExcludeNewest=true · designScrapCounter=false.
Unverified items kept flagged (spec §11.7): the newest-component window (`designExcludeNewest`), `r = 41` for every weapon (bank share formula), ecology weight = industry column, c7/c8 field mapping.

## Documented deviations
* Weapon counts are clamped to what fits (original: 101–141 % of the fitting maximum; the sim `design` order rejects negative free space). Reserve tanks, the colony Laser and the Inertial Stabilizer are only added when they fit.
* The original age-scrap loop skips the design that shifts into a scrapped slot (compact array); with fixed slots there is no skip. Start designs have year 0 (unverified): the first p2 run builds two fighters and the Scout can be one of the "3 newest".
* Overspend OFF: totals are trimmed to 100 (TECH, IND, DEF, SHIP in that order, ECO never).  Overspend ON: the normaliser is `TECH := max(0, 100 − SHIP − DEF − IND − ECO)`, applied one plan late (equivalent to end of turn); SHIP/DEF/IND/ECO are never trimmed, so such a planet keeps a total above 100 until the next rebalance.
* sim/events.js already applies the crank sliders itself (and funds only on the first event turn); economy.js re-applies them idempotently and adds the per-turn reserve share.

## Measured (30 games × 150 turns, medium galaxy, 5 empires, 6 seeds per difficulty; medians over empires) — techs / RP / production / ships / colonies
| difficulty | turn 50 | turn 100 | turn 150 |
|---|---|---|---|
| simple | 8/104/338/11/2 | 16/203/655/14/4 | 23/324/1156/37/6 |
| easy | 7/46/212/8/3 | 12/82/347/13/4 | 16/127/611/29/5 |
| average | 9/138/468/22/4 | 20/481/1374/26/6 | 32/851/2093/104/8 |
| hard | 10/189/646/26/4 | 22/494/1620/100/6 | 32/752/1880/41/5 |
| impossible | 12/333/1014/40/5 | 25/1066/2666/57/8 | 38/1208/4107/86/7 |

Easy is below Simple everywhere (original x0.8 vs x1.0 oddity). Average → Impossible rise monotonically except Hard vs Average at turn 150 (war losses, n = 30).
By objective at turn 100 (RP / production / ships): ecologist 431/1050/19 (most research, as §2.4 predicts), militarist 483/2049/167 (most ships; sample Mrrshan/Klackon-heavy), technologist 203/913/19 — not separated from diplomat (220/833/25) at n = 26 (race confounds).
By race at turn 100: Psilon 843 RP, Meklar 729 RP and 2399 production, Klackon 602 RP; Silicoid (ratchet on) 16 techs / 191 RP / 754 production — below Psilon/Klackon but not crippled (n = 11). Every empire holds six designs by turn 100.
Performance: `AI.plan` median 0.08 ms, p95 0.71 ms (70 stars, 6 empires, turn 80). Smoke: 12 games × 150 turns → 0 step errors and 0 rejected orders from these four files.

## Known gaps / next steps
A larger soak (≥ 200 games, per-race normalisation) is needed for objective separation. Not implemented: the Classic+ engine re-pick rule; `startColonyDelay` (the expansion agent reads `E.ai.p2Done`).
