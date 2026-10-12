# Balance & AI audit (session 3) - done / not done / next

Full numbers and the kept-vs-fixed table: `tools/balance/REPORT.md` (scripts in `tools/balance/`, decisions pinned by `tools/rules/83-balance.test.js`).

Done: pace + difficulty ladder, tech pace (new flag `Data.Config.QUIRKS.aiFirstTechCost`, default false = fixed; `options.aiClassic` restores `level^2*50`), every AI/sim quirk flag A/B-tested and its default confirmed (only that one default changed),
Easy < Simple kept + new `options.aiProdGuide` (monotone guide table for one game; `Config.aiProdFactor(diff, S)`), Klackon kept (spec-verified economy), signatures, war statistics, 1000-game robustness, save/load round trip, perf numbers.
Tool changes: `MOO_OVERRIDES` env hook in `tools/soak-worker.js` (dotted-path overrides for A/B runs).
Not done / next: expose `aiProdGuide` in the new-game wizard (js/ui); display `Sim.Q.hints` (tutor); two-empire AI-only games rarely finish (council needs 2/3); stalemate wars; one DEAD_OWNER warning (seed 24052, simple/medium/young, 4 opp) undiagnosed;
