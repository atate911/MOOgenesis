# Brief: Balance & AI-behaviour audit (soak-driven) — per race × difficulty × personality/objective

Product-owner priority (verbatim): *"Make sure to spend extra time ensuring the mechanics, balance, gameplay, and strategy of the game are accurate… Also make sure the competing races have their own correct competitive play logic at the difficulty selected."*
You are the balance auditor. Everything is implemented (sim engines, AI planners); your job is to PROVE the game plays like the original and fix what does not. You may edit AI planner files and sim/data files when a discrepancy is provable against the research (`research/01…08` and the `*-verification.md` errata); every change needs a test and a note.

## Tools
`node tools/soak.js` (24 threads; read `tools/SOAK.md`): `--matrix --games 12` (race × difficulty grids), `--difficulty hard --size large --opponents 5`, `--replay <n> <race> <diff>` for one verbose game, `--determinism`, `--profile`. `node tools/rules-test.js` must stay green. `Sim.autoPlay`, `Sim.stats` (incl. `score` = Racial-Stats total power and the five bars).

## Checks (write each as a script under `tools/balance/` and record numbers in `tools/balance/REPORT.md`)
1. **Pace vs the original** (research/04 §9, research/07 §1.5/§9 playbooks, Official Strategy Guide timelines in the research): colonies / production / RP / techs / ships at turns 25/50/100/150/200 for Average difficulty; is the early game (first 50 turns) paced like the original (expansion in ~15–20 turns for first colony ships, research starting ~T15–20 for AIs…)?
2. **Difficulty ladder**: Simple < Easy < Average < Hard < Impossible in AI strength (production multipliers, tech pace, expansion), except documented oddities; the human's research-cost multiplier (20/25/30/35/40) really applies; event frequency scaling; monsters/Guardian by difficulty.
3. **Objective & personality signatures** (research/07 §7, 08 §13/§16): Militarist builds more ships and wages more wars; Expansionist colonises faster and breaks treaties more; Technologist leads RP; Industrialist leads factories; Ecologist leads pop/growth; Diplomat signs more treaties; Pacifistic/Honorable wage fewer wars; Erratic random wars; Ruthless/Aggressive stronger war odds. Measure frequencies over ≥ 200 games and compare to the documented probabilities.
4. **Race signatures**: each of the 10 races' traits show up in outcomes (Psilon research, Meklar production, Sakkra growth, Klackon workers, Bulrathi ground, Darlok espionage, Alkari/Mrrshan combat, Silicoid terrain, Human trade/diplomacy) — no race ≥ 2× or ≤ ½ the median win-rate without a documented reason (the original has strong/weak races; compare qualitatively with the strategy guide tiering).
5. **Game-length & endings**: median end turn, share of Council victories vs conquest vs turn-cap; runaway leaders; stalemates (perpetual wars with no progress), suicide waves (fleets sent into stronger defences), AI stuck states (no research project, no production target, idle colony ships), starving/negative economies.
6. **Robustness**: no exceptions/NaN/negative values over ≥ 1 000 games across all sizes (24/48/70/108/160 stars), 1–5 opponents; deterministic replays; save/load round-trip mid-game equals continuing (hash).
7. **Performance**: AI planning ms per empire, whole-turn ms on Huge/Colossal with 5 opponents, memory; confirm 24-thread scaling of the soak.

## Method & output
For every discrepancy: find the cause (spec vs code), fix it in the owning file with the smallest correct change, add/adjust a rules test, re-run the affected soak slice. Keep a decisions list: "kept as original quirk" vs "fixed". Final reply ≤ 150 words: headline numbers, fixes made, remaining concerns. `tools/balance/REPORT.md` has the full tables.
