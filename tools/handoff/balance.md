# Balance & AI audit (session 3) - done / not done / next

Full numbers and the kept-vs-fixed table: `tools/balance/REPORT.md` (scripts in `tools/balance/`, decisions pinned by `tools/rules/83-balance.test.js`).

Done: pace + difficulty ladder, tech pace (new flag `Data.Config.QUIRKS.aiFirstTechCost`, default false = fixed; `options.aiClassic` restores `level^2*50`), every AI/sim quirk flag A/B-tested and its default confirmed (only that one default changed),
Easy < Simple kept + new `options.aiProdGuide` (monotone guide table for one game; `Config.aiProdFactor(diff, S)`), Klackon kept (spec-verified economy), signatures, war statistics, 1000-game robustness, save/load round trip, perf numbers.
Tool changes: `MOO_OVERRIDES` env hook in `tools/soak-worker.js` (dotted-path overrides for A/B runs).
Not done / next: expose `aiProdGuide` in the new-game wizard (js/ui); display `Sim.Q.hints` (tutor); two-empire AI-only games rarely finish (council needs 2/3); stalemate wars; one DEAD_OWNER warning (seed 24052, simple/medium/young, 4 opp) undiagnosed;

## Session-4 findings (war AI / passive human; no code change, matches research/08)
- Stalemate wars: the war layer (diplo.js warCheck/warDo, AI peace tick) and the ops layer (military.js targets, 40 % gate, force > D, trans_en) match research/08 3.2-3.7, 4.7, 9.1. Causes of "no planet changes hands": (a) allies are dragged into wars unconditionally and many pairs are 90-190 units apart (out of fuel range); (b) trans_en sends pop/2 with no troop estimate, so ~70 % of AI-vs-AI landings fail (30 games: 790 landings, 234 won; 113 died in the gauntlet); (c) need_conquer is cleared while ANY colonisable free planet exists anywhere, so a 43-planet empire never attacks a 2-planet neighbour (2-empire games). Fixing any of these would deviate from the original.
- Passive human on Hard, 5 rivals: eliminated T90-T155 by need_conquer invasions/bombardment with NO war declared (treaty none), once free planets run out. This is the original's behaviour (3.5 + 4.7 "no war requirement"); not an over-aggression bug.
- DEAD_OWNER: an empire with no planet/colony ship was marked dead while its population transports were still in flight; on landing they 'invade' and captured a planet for the dead empire. Fixed (Turn.checkDeaths drops the transports, Fleet.landTransports never invades for a dead owner). The seed no longer reproduces after the AI changes, so the fix is pinned by a synthetic test.
