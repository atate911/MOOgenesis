# Tech Lab

Tools for the expansion tech pool (`js/data/techs-x.js`, hooks in `js/sim/xtech.js`, design brief `briefs/tech-lab.md`, results `tools/techlab/REPORT.md`).
They answer three questions about every candidate technology: is it worth roughly what a classic tech of its level is worth, does it ever matter, and
does the whole pool leave the game's pace and balance where it was. Everything runs headless on worker threads; output lands in `tools/out/techlab/`
(git-ignored), summaries in `REPORT.md`.

| Script | Question | How |
|---|---|---|
| `combat.js` | What is a combat effect worth to the AI's battle model? | Real AI battles, rebalanced to an even fight, fought out in the tactical engine with the effect and with the subject's ships scaled. The ship multiplier with the same win rate is the effect's weight in the AI-vs-AI weight model (`XTech.WEIGHT`). |
| `twins.js` | What is a tech worth? | Copy a game at turn 40 / 80 / 120, give one empire the tech in one copy only, play both 10 / 25 / 50 turns on, compare that empire. Every classic tech goes through the same trial and forms the reference band. A placebo (one extra RNG draw) measures the butterfly-effect noise. |
| `analyze.js` | Verdicts | Paired log ratios of production, population, fleet, tech level; composite empire power index (EPI); percentile against the classic techs within ±6 levels. |
| `league.js` + `league-analyze.js` | Does the pool keep the game's balance? | Whole games, classic pool against expanded pool, on the same seeds; pace, economy, endings, difficulty ladder, race signatures; per tech: dealt %, researched %, intent-to-treat effect. |

```
node tools/techlab/combat.js --games 32 --runs 32            # ~4 min on 4 threads
node tools/techlab/twins.js --games 64                       # all 240 subjects, ~35 min
node tools/techlab/twins.js --games 96 --first 64 --classic 0   # more trials for the candidates only
node tools/techlab/analyze.js --in twins-r1.json,twins-r1b.json
node tools/techlab/league.js --games 240 [--drop id,id]      # --drop removes techs from the pool (the cull)
node tools/techlab/league-analyze.js --in league.json
```

`--set path=value,...` (twins, league) overrides any value under `MOO` for that run, e.g.
`--set Data.Techs.byId.cn-21-battlefield-salvage.effects.salvage=10` to try a weaker Battlefield Salvage before editing the data.
