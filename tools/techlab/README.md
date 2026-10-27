# Tech Lab

Tools for the expansion tech pool (`js/data/techs-x.js`, hooks in `js/sim/xtech.js`, design brief `briefs/tech-lab.md`, results `tools/techlab/REPORT.md`).
They answer three questions about every candidate technology: is it worth roughly what a classic tech of its level is worth, does it ever matter, and
does the whole pool leave the game's pace and balance where it was. Everything runs headless on worker threads; output lands in `tools/out/techlab/`
(git-ignored), summaries in `REPORT.md`.

| Script | Question | How |
|---|---|---|
| `combat.js` | What is a combat effect worth to the AI's battle model? | Real AI battles, rebalanced to an even fight, fought out in the tactical engine with the effect and with the subject's ships scaled. The ship multiplier with the same win rate is the effect's weight in the AI-vs-AI weight model (`XTech.WEIGHT`). |
| `twins.js` | What is a tech worth? | Copy a game at turn 40 / 80 / 120 and give one empire the tech in BOTH copies, with its effects switched off in the control copy (`research.nullify`). Play both 10 / 25 / 50 turns on and compare that empire: the difference is what the tech's effect adds, without the tech-level bump that any tech of that level would give. Every classic tech goes through the same trial and forms the reference band. A placebo (one extra RNG draw) measures the butterfly-effect noise. |
| `analyze.js` | Verdicts | Paired log ratios of production, population, fleet, tech level; composite empire power index (EPI = 0.4 production + 0.25 population + 0.2 fleet + 0.15 tech level); activity (share of trials in which the tech changed anything); percentile against the classic techs within ±6 levels. |
| `league.js` + `league-analyze.js` | Does the pool keep the game's balance? | Whole games, classic pool against expanded pool, on the same seeds; pace, economy, endings, difficulty ladder, race signatures; per tech: dealt %, researched %, intent-to-treat effect. |
| `report.js` | Write-up | `REPORT.md` from the JSON outputs. |

```
node tools/techlab/combat.js --games 32 --runs 32               # ~4 min on 4 threads
node tools/techlab/twins.js --games 64                          # every candidate + 180 classic subjects, ~45 min
node tools/techlab/twins.js --games 96 --first 64 --classic 0   # more trials for the candidates only, on fresh games
node tools/techlab/analyze.js --in twins-r2.json,twins-r3.json --replace twins-r2c.json --out analysis-final.json
node tools/techlab/league.js --games 240 [--drop id,id]         # --drop removes techs from the pool (a cull before editing the data)
node tools/techlab/league-analyze.js --in league-r3.json
node tools/techlab/rounds.js                                    # round record (cuts, moves, ablations) from tools/techlab/decisions.json
node tools/techlab/report.js --combat combat-r1.json --analysis analysis-final.json --league league-analysis.json --rounds rounds.json
```

`--replace` (analyze) names files that re-ran some subjects on the same base games: their trials replace every other file's trials of those subjects and
their placebo pairs are not counted twice. Trials of techs the data no longer has (cut, or moved to another level, which changes the id) are skipped.

`--set path=value,...` (twins, league) overrides any value under `MOO` for that run, e.g.
`--set Data.Techs.byId.cn-21-battlefield-salvage.effects.salvage=10` to try a weaker Battlefield Salvage before editing the data.

## Rounds run (October 2026)

| Round | What | Outcome |
|---|---|---|
| 1 | `combat.js` on 32 games; `twins.js` on 64 games with a plain control | Combat weights calibrated. The plain control credited every tech with its tech-level bump (Planetology's drives worker output), so Planetology candidates looked overpowered. |
| 2 | `twins.js` with the effects-off control, same 64 games | Values per candidate. 15 cut (duds, near-duplicates, one harmful), Gaia Seeding moved from level 39 to 19. |
| 2c | the 112 classic component techs again | Ship components were invisible to the effects-off control (designs read the completed list); fixed in `Design.owned`, re-run for the reference band. |
| 3 | `twins.js --classic 0` on 96 fresh games; `league.js` on 240 + 480 paired games | The final 45 at their final levels: 7 strong, 37 typical, 1 low. Pace and economy within about 2 % of classic; AI empires fight about 22 % more battles. |
| 3b | ablations (`--set` effects off by family, by tech); Slipstream Drives re-test | The extra battles come from the reach and growth effects together. Slipstream Drives retuned (fleets bound for your own colonies only). |
