# Handoff — espionage, Galactic Council, random events, monsters, Orion/Guardian, artifacts, victory
Owner files: `js/sim/spy.js` `council.js` (also defines `Sim.Victory`) `events.js` `artifacts.js` · tests `tools/rules/80-spy` `81-council` `82-events` (133 tests, green; `node tools/rules-test.js spy|council|events`).
Specs: research/05 §5–§9, 08 §10–§12/§17, 04 §3.9/§3.13, 02 §1.10, 01 §4.7/§5.9–5.12. Every file has a header comment with state shapes, interrupt shapes and decisions.

## Done (works headless end-to-end: AI-only games end by council ~year 175, human games show spy notices/sabotage/events)
- Spy: hiring (2×CompTL+25, Darlok ½, doubling per turn, fund carry), contact loss, roll tables (hide >85; mission 50/70/99; infiltration 84, frame 100; dt1/dt2, security/5, Darlok +30/+20), espionage (cap = best roll × best TL/100, ≤6 random distinct candidates, 12 group rules, Silicoid bans, value ranking, human offer = best per field after 5 rounds), sabotage (units = Σd5 over (WeaponTL+9)·n/10; bases 25 %/unit human, units/5 AI; factories; incite via `Ground.incite`), frame-ups, notices, `Spy.reports(S,E)`, orders `spyBudget{target,value}` `spyMode{target,mode}` (validated like human orders). DP via `Diplo.incident(spyTheft|spyFrameTheft|sabotage|spyFrameSabotage)`.
- Council: `due/convene/autoVote/resolve/finish`, weights ceil(pop/100) (rebels excluded), need ⌊(t+1)·2/3⌋, AI ballot rules, ±24/−12/−6 via `Diplo.incident('councilVote')`, accept/defy, Final War (`Diplo.finalWar`, `finalWarShare`; fallback pooling), `Victory.check/payload` (conquest/council/exile/funeral).
- Events: roll (chance, victim weights, rejections, once-per-game), all 16 events with numbers, `planet.event` timers (plague, nova, comet, accident), `eventCure{planet,amount}`, pirates, Crystal/Amoeba (`S.monsters`, `Events.monsterAt`, `killMonster`), coups (`Ground.coupCheck/applyCoup`), Guardian prize + Orion clearing + "Orion colonised" news. `Artifacts.loot` (humans only) and `guardianLoot`.

## NOT done / gaps
- No UI: `spySabotageChoice` has no handler (default settles automatically); `councilResult` accept/defy needs `UI.Council.result` to call `result.finish(accepted)`.
- GNN has no templates for my new `cat`s (earthquake, accident, virus, comet, derelict, richPlanet, poorPlanet, donation, coup, monsterSpawn, monsterKilled, *Cured/*Averted…): every item carries a ready `headline`.
- [Guide]-only rules skipped: plague blocks transports, event spreading, per-ship comet damage reduction. Monsters destroying transports at their star is Fleet/Ground's job.
- Genocide −36 is Diplo.preTurn's (not duplicated here).

## Known quirks / decisions
- Kept v1.3 quirks (research/08 §17): human sabotage costs no DP (`Spy.QUIRKS.humanSabotagePenalty`), AI-vs-AI sabotage frame-up GIVES the scapegoat DP (`aiFrameSabotageSign`); comet damage uses design #0's hull; Crystal keeps the (empty) planet owned; doubling of spy cost restarts every turn.
- Monsters move at the END of the events phase, so next turn's `Combat.findBattles` sees them on the star before the strike.
- `monsters` option off disables Crystal/Amoeba spawns (Guardian is Combat's).
- Victim weights SETTLED by the verifier (game_event.c): research/05 §7.1.1 is right (small empires weigh 1, dead empires too — drawing one ends the attempt silently). A coup funeral needs a human AND exactly one human alive; otherwise it is an ordinary coup.
- Hide-mode catches are per spy (research/08 §10.3); the Guide's per-living-spy cost doubling is NOT used.

## Next steps (lead / other owners)
1. `js/sim/turn.js` spy loop: `for (const ev of sp) { const a = yield ev; if (ev.answer) ev.answer(a); }` (today unanswered choices default via the array's iterator).
2. `T.victory = S => Sim.Victory.check(S)` (returns council/exile/coup verdicts; headless `autoPlay`/soak otherwise never see a council win) and yield `Victory.payload(S, over)` for the endings screen.
3. After `yield {type:'councilResult'}` in turn.js: `const ans = yield …; if (out.needsAnswer) Sim.Council.finish(S, info, ans)` (or let UI call `result.finish(bool)`); unanswered rulings are auto-accepted at the next `due()`.
4. UI: handlers for `spySabotageChoice` (answer `{planet, action:'factories'|'bases'|'revolt', frame?}`), `event` cards, notices `techStolen|sabotage|spiesCaught|spiesLost|spyNothing`.
5. Add GNN templates for the new cats (or make `News.compile` fall back to `ev.headline`).
6. Combat could use `Events.monsterAt(S, star)` (it already honours `m.resting`/`m.killer`).
