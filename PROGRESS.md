# Master of Orion — Reborn · Progress & Plan
> **Current state and the prioritised to-do list live in `HANDOFF.md`** (written at the end of session 2). This file keeps the long-term plan, acceptance checklist and history.

Browser remake of Master of Orion (1993): vanilla JS + Canvas + Web Audio, no build step, runs from `index.html`.
Dev server: `python -m http.server 8765` (launch config `.claude/launch.json` → `moo-static`). Headless sim tests: `node tools/headless.js`.

## Phases
1. **Research** (`research/*.md`) — 6 parallel agents: races, tech, ships/combat, galaxy/economy, diplomacy/events/victory, UI/audio. ✔ screenshots reviewed → `research/00-original-screens-notes.md`
2. **Foundation** ✔ index.html, loader/manifest, CSS design system (indigo/brass), UI kit, screens manager, save/load, headless harness, RNG/util.
3. **Independent art/audio modules** (agents): space+planets, ships+fx, portraits, music+sfx → icons, scenes (later).
4. **Rules spec + data** (`DESIGN.md`, `js/data/*`) → core sim (galaxy gen, colony economy, research, design, fleets, turn pipeline).
5. **Systems**: combat (tactical+auto), ground combat/bombing, diplomacy+spies, council, events, Antarans/Orion, AI empires, GNN/news.
6. **Screens**: menu/setup, galaxy map, colony panel, planets, fleets, design, tech(+scientist scene), races/diplomacy, council, GNN, tactical combat, ground, events, options/save, game over.
7. **Integration & balance**: headless AI-vs-AI soak tests, browser playtests, polish.

## Accuracy plan (user priority: mechanics, balance, strategy, per-race/per-difficulty AI)
1. Wave-1 research docs 01–06 + **AI deep-dives 07 (economy/expansion) & 08 (military/diplomacy)**.
2. **Verification pass**: independent agents re-read the 1oom source for each doc's formulas/tables and list discrepancies → fix docs before coding.
3. Implement from the specs (no code transliteration — 1oom is GPL); keep a `RULES.md` that states every formula once.
4. **tools/rules-test.js**: headless assertions of formulas + known data points (e.g. start-of-game numbers seen in public playthroughs).
5. **tools/soak.js**: AI-vs-AI games for each race × difficulty (many seeds): expansion curve, tech pace, war frequency, win routes, runtime, exceptions → tune.
6. Race/personality/objective/difficulty profile table drives AI behaviour (see research 07/08).

## Acceptance checklist — the original's 25 iconic features (research/06 §14). Tick when implemented AND playable.
- [ ] 1 Five-slider colony mgmt (Ship/Def/Ind/Eco/Tech, locks, sum 100%) · [ ] 2 Ship designer (4 hulls, 6 base slots, 4 weapons, 3 specials, max 6 designs, miniaturisation)
- [ ] 3 Six-field slider research, per-game random tech availability, breakthrough chances, choose-next-tech scenes · [ ] 4 One planet per star, fuel-range expansion, 24/48/70/108-star galaxies (+colossal), nebulae
- [ ] 5 Ten asymmetric races · [ ] 6 AI leaders: personality + objective, memory, 17-step relations ladder · [ ] 7 Audience diplomacy (treaty/trade/tribute/tech exchange/threats, sweeteners, two music moods per race)
- [ ] 8 Galactic Council (pop-weighted, 2/3 majority, accept or defy → Final War) · [ ] 9 Orion + Guardian · [ ] 10 Espionage (hide/espionage/sabotage, steal, destroy, incite, frame, security)
- [ ] 11 Tactical combat 10×8 grid, rocks, missiles vs beams, specials, scan/wait/retreat/auto · [ ] 12 Planetary defence, bombardment, ground invasion · [ ] 13 Environments, ecology/waste, terraforming, Gaia, hostile-colonisation techs, colony bases
- [ ] 14 Planet specials + Map screen (Colonies/Environments/Minerals) · [ ] 15 BC economy (reserve, tax, transfers, maintenance, trade income, ledger) · [ ] 16 RELOC rally points + TRANS population transports
- [ ] 17 GNN newscaster with rankings/milestones/bulletins · [ ] 18 Random events · [ ] 19 Space monsters (Crystal, Amoeba) + Guardian · [ ] 20 Scanner/information model ("Last reported as…", report age, hidden data)
- [ ] 21 Five difficulty levels + tutor pop-ups on Simple/Easy · [ ] 22 Four endings with cinematics (good, tyrant, funeral, exile) · [ ] 23 Painted-vignette presentation (landing, hologram, council, scientist, newscaster)
- [ ] 24 Event-driven soundtrack (per-race two-mood themes; silent map in original, optional ambience here) · [ ] 25 Speed of play (hub screen, two-click rule, F-key cycling, Space/Esc/right-click grammar, first-letter hotkeys)

## Verified facts that overturned early assumptions (research/04, /06)
No food/farmers/scientists (research = % of planet output) · exactly ONE planet per star (13 types + none) · no outposts/freighters/starbases/natives/gravity/galaxy-age/Antarans in MOO1 ·
transports = moving population (1 BC each) · battles only in orbit over planets on a 10×8 grid · homeworld Terran/yellow/max pop 100, 30 factories, pop 50 (40 Hard/Impossible), 2 scouts + 1 colony ship, year 2300 ·
banners Blue/Green/Purple/Red/White/Yellow · Council: from ≥2/3 stars colonised, every 25 years, votes = pop/100.

## Status log
**2026-10-11 (session 2, ~23:00) — restart recovery.** The first session's 19 in-flight agents were stopped by a context reset; deliverables on disk were checked and the agents resumed via `SendMessage(agentId)` (their transcripts persist).
- LANDED & green (155 rules tests): races data (30 tests), tech data (52), components + design module (36), galaxy map component, GNN screen (`js/ui/gnn.js`, now in manifest), GPU planet shaders (`gl-planets.js`), research docs 07 + 08 (AI economy / AI military-diplomacy; being refined), soak runner.
- IN FLIGHT: engines — combat, ground, diplomacy, spy/council/events/artifacts; UI — ledgers/overview/system, research+tech tree, design editor; GPU nebula/FX; audio (music/SFX); verification — tech, economy, combat/ground (`research/03-verification.md`), diplomacy/spy/council (`research/05-verification.md`); **AI planners** — expansion (`js/ai/intel.js`, `colonize.js`), economy (`designs.js`, `economy.js`, `planets.js`, `research.js`), military (`military.js`, `spy.js`).
- AI framework (lead): step table 10 intel · 20 scouts · 25 colonize · 30 military · 40 economy · 45 designs · 50 planets · 60 research · 70 spy · 80 diplomacy; `ctx` planned-state helpers (`sliders/setSliders/build/setBuild/reserve/fund`), `ctx.shared`, quirk flags (`AI.QUIRKS`, `ctx.quirk`, option `aiClassic`). Briefs: `briefs/_ai-common.md`, `ai-expansion.md`, `ai-economy.md`, `ai-military.md`. Treaty/war/council logic lives in the Diplo/Council engines, not in AI planners.
- Scoring: the original has NO numeric score — `Sim.powerBars/Sim.stats().score` implement the Racial Stats bars (fleet/tech/production/population/planets, Total Power best = 100).
- **USER DIRECTIVE (queued, runs after the functional build + QA):** a second graphics pass — *"more modern, like a serious game, less cartoonish, and with more of a serious sci-fi flair"*. Plan: (1) art-direction research + style guide (`research/09-art-direction.md`: palette, materials, lighting, type, HUD language, post-FX, per-module before/after targets); (2) parallel re-do of portraits, scenes/GNN, ships, planets/space, icons, UI chrome (css/base+kit), effects against that guide; (3) QA with screenshots at 1280×720/1920×1080 on all tiers. Keep WebGL2 accelerators + Canvas2D fallbacks and `MOO.Perf` scaling.
- NEXT: launch UI agents for diplomacy / council+spy+endings / combat / ground+help+almanac once engine APIs land; wire GPU renderers into consumers (GLPlanets/GLSpace/GLFx); audio glue (SFX/music moods per screen); soak/balance per race × difficulty; QA pass of the full click-through; README/polish.

**2026-10-11 ~22:35 — foundation + core sim done; subsystem/UI agents in flight.**
- DONE (lead): project skeleton, loader/manifest, design system CSS/UI kit, worker pool (`core/workers.js`, 23 workers here, ×12 speed-up), adaptive `Perf` tiers + F3 overlay, GL core (`gfx/gl.js`), RNG/save/settings,
  headless harness + `tools/check.js` + rules-test runner; sim: geo (parsec stepping), galaxy generation (12 tests), vis, research (probabilistic breakthroughs, per-empire random tree), colony economy (20 tests vs the research's worked examples),
  fleets/movement/fuel/transports/colonisation, econ pipeline, setup, turn generator, auto driver, Q view-models, news compiler; UI: galaxy control screen (HUD, bottom bar, hotkeys, side-panel registry), colony panel (5 sliders), star/fleet/card panels, flow handlers, title screen.
- DONE (agents): research docs 01–06 (+00 notes); text/names data; icons (101); planets+space renderer; ships+fx; portraits; scenes; setup/options/save screens; tech data (`data/techs.js`, 252 techs); races data; components data.
- IN FLIGHT (agents): components+design module, combat engine, ground/bombardment, diplomacy, spy/council/events, GNN screen, galaxy-map component, GPU renderers (planets, space/fx), audio, soak runner, ledger screens, tech screen, design editor, verification (tech, economy), research 07/08 (AI logic).
- QUEUED briefs (`briefs/`): ui-diplomacy, ui-council-spy-endings, ui-combat, ui-ground-help; AI economy + AI military (after research 07/08); verification of research 03/05; difficulty/personality wiring audit; balance soak + tuning; final integration/QA.
- KNOWN: concurrency cap = 20 subagents (CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS); briefs-as-files pattern lets each launch with a one-line prompt.

## Key decisions
- Look: "imperial observatory" — indigo void, brass hairlines, ivory ink, chamfered panels, Marcellus SC + IBM Plex Sans Condensed.
- Research system = original: six fields with separate allocation sliders; each field you pick the next tech from a list of available ones.
- Turn pipeline is a generator yielding interrupts (combat, colonise prompt, tech choice, diplomacy, council, GNN…) so UI and headless runs share one code path.
- Max 6 ship designs per empire (original limit); sizes Small/Medium/Large/Huge (+Doom Star).
