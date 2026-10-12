# Handoff — Diplomacy engine (`js/sim/diplo.js`, `tools/rules/60-diplo.test.js`)

Single file, worker-safe `MOO.def`, ~1400 lines; load order unchanged (`js/sim/diplo.js` is already in the manifest; it reads `Data.Races`, `Data.Techs`, `Sim.Research/Geo/Fleet/Ev/Orders` only at call time).
`node tools/check.js` clean · `node tools/rules-test.js diplo` = **86 tests, all green** · a 120-turn real game (`Setup.create` + `Turn.run`, human present, everybody in contact, 3 seeds x 3 difficulties) runs with no exception.

## State (all plain JSON)
`E.relations[j]` = E's record about j (rel1/rel2/trust/four moods/treaty 0..4/contact/met/hatred/blunder/broken/trade+tradePct/ceasefire/dipType+dipVal+dipP1/dipP2/bounty/gift); `attitude`==rel1.
`S.diplo = {finalWar, refusers, pending (counter-offer), inbox (AI proposals to humans), techList, owners, lastTaker, dead, log[≤600 {turn,k,a,b,x}]}`. Header of the file documents every field and function.

## Done
- DP engine `act` (all 10 steps), start/stop war, break treaty, trade (set_trade blend, growth, income incl. Human +25, negative start-up kept), contact + first contact, per-turn mood regen/relax, blunder memory, relation drift (errata: lower-index row only → a human player 0 never drifts), treaty goodwill, fleet/growth complaints.
- Player audience: `audience`, `menu`, `propose` (nap, alliance, peace, askWar, askBreak, trade, tributeBC, tributeTech, threat, breakTreaty, breakTrade, techExchange), counter-offers (`answerCounter`), `leave`, tribute/trade/tech helpers, exact `check_mood` bands.
- AI side: war paths A–E + `wage_war_do`, AI↔AI tick (alliance toggle quirk, tech swap, trade, stale-v peace, ally cascade), AI→human dispatcher (proposals, bounty, reaction ladder, peace feelers, ally calls, demand to break an alliance) as chained `{type:'diplomacy'…}` interrupts with `answer(choice)`; `answer(undefined)` = accept.
- Incidents API (`Diplo.incident`, also drains `{type:'incident'}` events), battle fallout, genocide/killer tracking, `finalWar/finalWarShare`, `canFight` combat gate, order `diplomacy {to, act}`.
- News events: warDeclared peaceTreaty napSigned allianceFormed allianceBroken treatyBroken tradeSigned tributePaid firstContact (alliance news throttled to once per pair per 30 turns because of the v1.3 NAP/alliance oscillation).
- Defaults keep every v1.3 quirk (research/08 §17); flip `Diplo.CFG.*` to get the intended rules (trust sign, cash tribute, peace mood, bounty payment, threat hides AI spies, …).

## Known gaps / deviations
- `Diplo.turn` runs before the Council (turn.js order); council-vote reactions (types 79/80) are therefore never delivered. Fix: call `Diplo.turn` after `Council.resolve` in turn.js (the engine does not care).
- Combat should gate fights with `Diplo.canFight(S, attacker, defender, starOwner)` (None = fight; NAP only at a partner's planet; allies never; AI attackers withdraw from a human under cease-fire) — `atWar` alone is not the original rule.
- Other modules must report to `Diplo.incident(S, kind, from, to, magnitude, extra)`: Combat → `'combat'` {popLost, force, bio, planet}; Ground → `'capture'`/`'depopulate'` (human takes or empties an AI planet), `'popKilled'`, `'aiGround'`, `'bio'`; Spy → `'spyTheft'` `'spyFrameTheft'` `'sabotage'` `'spyFrameSabotage'`; Council → `'councilVote'` (+24/-12/-6); Turn.checkDeaths → nothing needed (killer tracked from planet ownership).
- AI tech-swap offers (type 29) fire only on exact value equality, as in v1.3 (practically never). Tribute BC buys no relations (v1.3).
- `answer()` of an AI audience applies mood costs after `Diplo.turn` already relaxed moods (+10) — ≤10 DP difference vs the original ordering.
- Not tested: AI↔AI tick frequency by Monte-Carlo (1/(15-2d)); sweetener page for peace offers; `Diplo.warCheck` path D (needs a human at war with an ally of the aggressor).
- Message-type → dialogue mapping (`Diplo.MSG_SITUATION`) is my own choice for types with no text.js situation (counter-offers and incentives use generated English lines in `reply.counter.text`).

## Next steps
1. Move `Diplo.turn` below the Council block in `sim/turn.js`; wire Combat/Ground/Spy/Council to the incident API above and to `canFight`.
2. Click-test counter-offers, trade, tribute and tech exchange in the audience UI (`tools/test-diplomacy.html`).
3. Soak with the real AI planners: tune nothing in diplo — check war/alliance counts per difficulty with `tools/soak.js` and compare with research/08 §16 (two-bloc galaxies, pile-on on the human).
