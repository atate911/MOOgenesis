# Strategic choices — October 2026 (branch `claude/strategic-choices`)

Brief from the product owner: add the "decision" ideas from the Tech Lab review (colony specialisations, one-time galaxy projects, new
diplomatic options) as a Remake option, off by default. Built on top of `claude/tech-lab` (it uses the lab tools to tune).

## What exists now

| Item | Files | Notes |
|---|---|---|
| Option | `js/ui/setup.js` (`strategic` → `settings.options.strategic`), dev URL `&strat=1` (`js/core/game.js`) | Off by default. Classic games are byte-identical (state hashes at turn 150). |
| Rules | `js/sim/strat.js` (`Sim.Strat`) | Constants at the top: `FOCUS`, `RETOOL` (3), `PROJECTS`, `PACT_PCT` (5), `PACT_MAX` (2), `PACT_BREAK`, `PACT_REL`. Orders `focus` and `project`. `St.turn` (called from `Turn.run` only when on) ticks retooling and forms / breaks AI↔AI pacts. |
| Hooks | colony.js (gross, growth, defence), research.js (`planetRP`), econ.js (research total), ground.js (fortress troops), diplo.js (menu entry `research`, `propose`, `applyAccepted`, war ends a pact, `D.logEntry`) | Each reads `p.focus` / `relation.pact`, which only exist in a game with the option on. |
| AI | `js/ai/strat.js` (step 85, after all reserve spending) | Focus by role with hysteresis (`want`, `role`); projects in a fixed order with a 25% cushion. AIs never propose pacts to the human. |
| UI | `js/ui/side-colony.js` (focus row, phone tap sizes in `css/phone.css`), `js/ui/ledger-planets.js` (Projects window, key P), `flow.js` / `turnlog.js` (`project` notice) | The audience's Propose Treaty menu lists Research Agreement through `Diplo.menu`. |
| Tests | `tools/rules/24-strat.test.js` (5) | Off-by-default isolation, each focus, each project, pacts, the AI step. |
| QA | `tools/qa/strat-shots.js` | Setup option, focus row click, Projects window and funding. |

## Tuning (lab leagues, `node tools/techlab/league.js --pools classic,strat`, analysis `league-analyze.js --b strat`)

| Version | Research @100 | Production @100 | Techs @100 |
|---|---|---|---|
| First draft (Industry +15% / growth −25%, pacts +8% ×3) | +33% | +16% | +9.5% |
| Industry −30% research, pacts +5% ×2 | −13% | +2% | −4% |
| Final (Industry −20% research, AI Science on every third colony) | −2% | +3% | +0.1% |

Final, 479 paired games: tech level, colonies, population and research within about 3% of classic at turns 100 and 200; ships +13% at turn
100 (back to classic by 200); wars unchanged. The AI's colonies end up about 37% Industry, 33% Fortress, 20% Science, 10% Growth; a game
sees about 3 Cartographies, 2 Envoy Corps, 1 Habitats and 3 research pacts.

## Follow-ups

1. Human playtest; the AI sets Fortress on every colony with six or more bases, which may be too eager.
2. The AI never proposes a research agreement to the player; it only answers.
3. Almanac / help entries for the three features.
