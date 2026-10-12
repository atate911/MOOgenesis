# Handoff — economy / galaxy / movement verification (research/04 vs 1oom, code audit)

Full report: `research/04-verification.md` (61 Part-A rows: 51 verified, 6 wrong/incomplete, 4 unverifiable; findings B1-B18; corrections C1-C12).
Reference = 1oom `master` via a summarising fetch tool (numbers/rules only, no code copied). Load-bearing numbers were read twice.

## FIXED (code + test, suite green in my areas; full suite 753 pass / 3 fail in 60-diplo, not mine)
- `js/sim/geo.js` — parsec metric rewritten to the original: heading from the four `floor(256 tan)` tables (+ the 43 / 90 quirks), sin/cos steps TRUNCATED (not rounded), quadrant folding,
  `dist<=0` guard, >255 halving, `star_dist` measured from the lower to the higher star id. Mean 9.16 units/parsec (was ~11); 91 % of Large-galaxy pairs changed; stars within 3 pc of a home 2.5 -> 1.3.
  Tests: `10-galaxy.test.js` (replaced the "euclid/11 +-1" test; hand-simulated (0,0)->(30,10) = 4, (0,0)->(100,2) = 12).
- `js/sim/colony.js` — `applyEcoFloor` = original (SHIP/DEF/IND lose `value*diff/100`, TECH = remainder, Silicoid skipped); project blocks sequential with the 150-BC carry
  (Normal->Fertile->Gaia = 301 BC, 301 BC in one turn finishes both); stargate completion carries the excess, resets the build item and moves a human's SHIP % to TECH (`C.shipToTech`);
  Silicoid growth uses truncating division (cosmetic). Tests in `40-colony.test.js`; `22-research-rules.test.js` expectation adjusted (200 BC -> Fertile, 301 BC -> Gaia).
- `js/sim/turn.js` — second `Econ.stepProduction` before defence/ships/industry (1oom "hidden child labor", default in v1.3). Switch: `Data.Config.QUIRKS.hiddenChildLabor = false`. Test: real turn order in `45-economy-verify.test.js`.
- `js/sim/galaxy.js` — `G.rocksFor` strict `<15` / `<40`. `js/sim/vis.js` — only OWN planets scan / auto-explore (allies extend fuel range only).
- New: `tools/rules/45-economy-verify.test.js` (rocks, ally scanning, turn order).

## OPEN (patches are in the report, nothing changed)
- B3 pop-tenths double carry (original adds `pop_tenths` inside the natural-growth routine AND in build_eco): growth of small colonies is ~2x too slow now; the Let's-Play anchor (max 35 passes 19 after "a couple of decades") needs it (18 vs 41 turns).
- B7 `Econ.autoSwitch` vs the original end-of-turn slider disabling (IND only on the turn the max is reached; ECO -> IND/TECH rules; shield complete DEF -> TECH).
- B8 quirks not implemented: waste second term, SHIP +1 BC, soil-rounding quirk (the last was a documented decision for the "intended" rule).
- B9 factory refit / overflow-to-reserve details; B10 missile-base upgrade billing (`cost_diff * bases`); B14-B16 small things (upkeep cap, 260/100 limits, colony-ship choice, rebel landings).

## UNCERTAIN
- Whether a transport costs 1 BC at processing time: 1oom clears `trans_num` at launch BEFORE the first production update (no deduction), the Strategy Guide says "cost deducted". Code still deducts (`transCost`).
- Exact last digit of ~15 of 180 trig-table entries (only sin 30 = 32768 / cos 60 = 32767 matter); `FLEET_SPEED_STARGATE` value; transport HP table (1oom `(armour tier+1)*15` vs SG 15/22/30/...).
- Not read: improved homeworld generator, random events (§3.13), trade update, ground/ship combat, AI.

## Notes for others
- research/04 §1.2 text "about 9.8-10.3 units on diagonals" and §7 (no second production pass) should be corrected from the report (C1, C5).
- The Strategy Guide nominal map sizes (21/27/33/39 parsecs wide) fit ~9.2 units/parsec, not 11 — independent support for the new metric.
- AI agents: `Colony.applyEcoFloor` may now leave the slider sum at 101-102 (original truncation quirk) and never goes negative.
