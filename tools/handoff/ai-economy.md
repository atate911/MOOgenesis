# Handoff — AI economy (planets / research / economy / designs)

DONE (real games: 12+ seeds × 150 turns, 0 step errors, 0 rejected orders from these steps; `node tools/rules-test.js ai-economy` 48/48; whole suite green; `node tools/check.js` ok)
* planets.js (step 50): p3 rebalance per research/07 §2.3–2.5 incl. ECO forced to the waste floor (no ratchet), War row, race/special adds, factories-maxed + base saturation; `slidersRaw` order for the overspend quirk.
* research.js (60): re-roll cadence (year % 10 == id), Propulsion-first before year 30, racial focus from Data.Races hooks, literal c7/c8 mapping (+ swap flag).
* economy.js (40): trans_own, panic (planned overlay, so step 50 sees it), fund_developing, tax (year ≥ 20: rnd(10)+d+2), plague/nova/comet/pirates cranks.
* designs.js (45): full p2 — countdown 9..20, role detection, aging 50/100, forced removal, refill colony → bomber → fighter, hull/tier/armor/special/bank rules, 3-newest build assignment + Stargate 50 %; publishes E.ai.p2Done.
* Difficulty audit (tests): production x1/0.8/1.25/1.5/2, base cost x1/0.9/0.8/0.7/0.5, AI tech cost fixed (human 20..40), aiPick (d−1)/6, Hard/Impossible start pop 40 — the sim honours all of them as is.

QUIRK FLAGS (default): sliderOverspend F · fleetCheatBug F · ecoWeightIsIndustry T · silicoidEcoRatchet T · researchSwap78 F · panicCountsAllies F · transOwnRebelSource F · transOwnOverwrite F · designExcludeNewest T · designScrapCounter F.
Unverified, kept flagged: newest-component window, r = 41 weapon shares, ecology weight = industry column, c7/c8 mapping.

SIM-SIDE PATCHES STILL NEEDED (not my files)
1. sim/fleet.js `Fleet.move`: the arrival merge can pick an already-emptied fleet and leave TWO stationary fleets of one owner at a star (from turn ~50; about 90 `fleetSend: no ships selected` per 12 games, because `Fleet.at` returns the first one).
   Fix: `const same = S.fleets.find(g => g !== f && g.star === f.star && g.owner === f.owner && total(g.ships) > 0);`
2. sim/colony.js `applyEcoFloor`, last line: `if (sum !== 100) s[TECH] += 100 - sum` → `s[TECH] = Math.max(0, s[TECH] + 100 - sum)` (negative TECH when sliders total > 100; only with quirk sliderOverspend).
3. ai/ctx.js `finish()`: optional raw-vector support (planets.js wraps finish to swap `sliders` for `slidersRaw` when the quirk is on).
4. sim/events.js crank funds the planet only on the first event turn; the original adds reserve/5 every event turn (economy.js adds the per-turn share).

MEASURED (30 games × 150 turns; medians techs/RP/production/ships/colonies at turn 100): simple 16/203/655/14/4 · easy 12/82/347/13/4 · average 20/481/1374/26/6 · hard 22/494/1620/100/6 · impossible 25/1066/2666/57/8.
Ecologist has the most RP (431), Militarist the most ships (167); Technologist is not separable at n = 26. AI.plan median 0.08 ms, p95 0.71 ms.

NEXT: a ≥ 200-game soak for objective/race separation and the Silicoid ratchet effect (191 RP at turn 100, not crippled); decide the designExcludeNewest default after it; unit tests for the off-by-default quirks transOwnRebelSource / transOwnOverwrite / designScrapCounter.
