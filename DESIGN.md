# Master of Orion — Reborn · Design (architecture & contracts)

Part A (this section) is final. Part B (state schema, data schemas, Query API) is appended once the research docs are verified.
Read `CONVENTIONS.md` first (stack, module styles, threading/GPU rules, look & feel).

## A1. Layers
```
Data (static tables)  →  Sim (pure functions over plain-JSON state S)  →  AI (pure planners)  →  Game (owns S, drives the turn)  →  UI (screens)  ←  Gfx / Audio
```
* **Data** `MOO.Data.*` — races, techs, components, hulls, planets, config, events, text, names. Plain objects, worker-safe except text/names.
* **Sim** `MOO.Sim.*` — worker-safe `MOO.def` modules. Functions take `S` first. Mutating functions are named by verb (`apply`, `process`, `advance`);
  readers live in `MOO.Sim.Q` (queries — what the UI/AI ask; never mutate). All randomness through `MOO.RNG.bind(S.rs)` (or a forked seed in pure/parallel code).
* **AI** `MOO.AI.*` — `AI.plan(snapshot, empireId, seed) → orders[]` is PURE (reads a snapshot, returns orders; no mutation) so every AI empire plans on its own worker thread.
* **Game** `MOO.Game` (main thread) — holds `S`, runs turns, routes interrupts to the UI, saves/loads, selection state.
* **UI** screens register with `MOO.UI.Screens`; they read through `Sim.Q`/`Game`, and change the world ONLY by issuing orders (`Game.order(o)`).

## A2. Orders (the single write path)
Every change a player or AI makes is an **order**: a small plain object `{t:'type', …}` validated and executed by `MOO.Sim.Orders.apply(S, empireId, order) → {ok, msg, …}`.
The UI calls `Game.order(o)` (applies immediately for the human empire, emits `'state'` on the bus). AI planners return arrays of orders that the main thread applies
in empire order at the start of the turn. One validation path = identical rules for humans and AIs (cost checks, range checks, treaty checks).
Order types (extend as needed; each has a doc comment in `sim/orders.js`):
`sliders` `build` `reloc` `trans` `tax` `researchAlloc` `researchPick` `design` `scrapDesign` `refit` `fleetSend` `fleetMerge` `fleetScrap` `colonize` `invade`
`bombard` `diplomacy` (propose/accept/reject/declare/break/tribute…) `spy` `vote` `council` `rename` `rally`.

## A3. Turn pipeline = generator with interrupts
`MOO.Sim.Turn.run(S)` is a generator. It performs the turn phases in order and **yields an interrupt object whenever a human decision or presentation is required**;
the driver resumes it with the answer (`gen.next(answer)`).
```
phases:  start-of-turn upkeep → AI planning (parallel, pure) + apply AI orders → human orders already applied → fleet movement →
         arrivals (scan/explore, colonise prompts, transports) → battles (yield 'combat' for the human; all AI-vs-AI resolved in parallel) →
         invasions/bombing → colony economy (production, growth, waste, builds) → research (yield 'techChoice' when a field completes) →
         treasury/upkeep → diplomacy (treaty effects, proposals → yield 'diplomacy') → spies → random events/Orion/Antarans → council (yield 'council') →
         victory check (yield 'gameover') → news/GNN (yield 'gnn') → advance turn counter, autosave
interrupt types: combat · colonize · invade · techChoice · diplomacy · council · event · gnn · gameover · message
```
`MOO.Game.endTurn()` drives it: `for (r = gen.next(); !r.done; r = gen.next(await Game.handlers[r.value.type](r.value)))`. The UI installs handlers (screens/modals);
the headless driver (`Sim.autoTurn`) installs auto-answering handlers, so UI and soak tests share ONE code path.

## A4. Parallel work (see CONVENTIONS "Threads, GPU & portability")
`Workers.setSnapshot(S)` once per turn → `Workers.map('aiPlan', empires, {snap:true})`; `Workers.map('resolveBattle', battles, {snap:true})`; Monte-Carlo odds for the
pre-battle screen; planet-texture jobs. Inline fallback is automatic. Pure ops never touch `S` (they read `MOO.snap`) and return plain data.

## A5. Ownership of files (so parallel agents never collide)
* Lead only: `index.html`, `js/manifest.js`, `js/loader.js`, `js/main.js`, `js/core/ns.js`, `js/ui/kit.js`, `js/ui/screens.js`, `css/*`, `CONVENTIONS.md`, `DESIGN.md`.
* Every other file has exactly one owner (named in the agent brief). Need a change in someone else's file? Say so in your final report.
* New files must be pre-registered by the lead in `manifest.js` (agents may be asked to tell the lead their load-order needs).

## A6. Quality gates (see end of file for the commands)

# Part B — State schema, module APIs, interrupts (AS IMPLEMENTED — keep this section in sync with the code)

## B1. Time & units
`S.year` is the *internal* year (starts at 1; displayed year = `Data.Config.displayYear(S)` = 2299 + year); `S.turn` = year − 1. One turn = one year. Map units: integers, ≈ 11 units per parsec;
**parsecs** between stars = `Sim.Geo.parsecs(S,a,b)`. BC = money, RP = research points, population in millions (integers; tenths carried in `popFrac`).

## B2. State `S` (plain JSON; reference by id, never by object)
```
S = { v, seed, rs:[4]            // RNG state — always use MOO.RNG.bind(S.rs)
      turn, year, settings:{size,difficulty,diffIdx 0..4,opponents,options:{randomEvents,council,monsters,fogOfWar,tactical},playerAI}, playerId:0,
      galaxy:{cols,rows,w,h}, stars:[…], planets:[…], nebulae:[{type,ox,oy,rects:[[x0,y0,x1,y1]×4]}], orion:starId, guardian:{alive,star},
      empires:[…], fleets:[…], trans:[…], nextId, ev:[…turn events…], news/newsLog:[…], council:{held,lastYear,emperor}, events:{year,done:{}}, diplo:{…}(Diplo module) }
star    = { id, name, x, y, color:'yellow'|'red'|'green'|'blue'|'white'|'purple', look, frame, nebula:bool, orion?:true }
planet  = ONE per star (planets[i].starId === i): { id, starId, name, type:'none'|'radiated'|…|'terran', typeIdx 0..13, maxPop, mp1, mp2, mp3 (max-pop variables), special:'ultrapoor'|'poor'|'normal'|'artifacts'|'rich'|'ultrarich'|'orion',
          growth:'hostile'|'normal'|'fertile'|'gaia', rocks:'none'|'some'|'many', bg, gfx, owner:-1|empireId,
          // colony fields when owned: pop, popFrac, waste, factories, operTier, rebels, unrest(0|1|2), bank, bases, shield(0|5|10|15|20), stargate, sliders[ship,def,ind,eco,tech], lock[5], acc{ship,factory,base,baseUpg,shield,eco,refit},
          //   build (design slot 0..5 | -1 stargate), reloc (star id), trans {to,n}|null, gross, spendable, baseCostPaid, event? }
empire  = { id, race, name, plural, leader, color (banner 0..5 = blue green purple red white yellow), human, alive, capital (planet id), bc (reserve), tax (0..200 per-mille of gross), security, spyBudget[6], spies[6], spyMode[6],
          personality 0..5, objective 0..5 (indices into Data.Races.PERSONALITIES/OBJECTIVES), designs[6] (null|design), dstats[6] (cached Design.compute), flow{gross,shipM,baseM,trade,net,factor,taxToReserve,…},
          research{slider[6],lock[6],completed[6][levels],project[6],invest[6],cost[6],list[6][10][≤3],tl[6],total}, mods{…}, grants{…}, relations[…], explored[], scanned[], vis[] (0 unexplored|1 explored|2 live), seen{}, frange[] (0|1|2), range, ai{…} }
fleet   = { id, owner, star (≥0 in orbit | -1 moving), from, to (-1 if stationary), x, y, speed (warp; 35 = stargate), ships:[6 counts per design slot] }       // one stationary fleet per (star, owner)
trans   = { id, owner, from, to, n, x, y, speed }       // population in flight
```
## B3. Modules (all `MOO.Sim.*` unless noted; every one worker-safe)
`Geo` distances · `Galaxy.generate/chooseHomeworlds/makeHomeworld` · `Setup.create(settings)→S` · `Research` (init, advance, choices, start, aiPick, grant, recompute, setSlider, planetRP, breakthroughChance) · `Design` (compute, stats, refresh, cost, baseCost, startDesigns, available, maintenance, scrapRefund; orders design/scrapDesign) ·
`Colony` (found, gross, setSlider, ecoFloorPct, applyEcoFloor, buildEco/Defense/Ships/Industry, growPop, soilEnrich, atmosTerraform, readouts, maxFactories, factoryCost, maxPopDisplay) · `Fleet` (at, addShips, send, eta, move, updateRange, canReach, fuelCheck, launchTransports, landTransports, colonyShips, colonize, shipValue) ·
`Econ` (stepProduction/Eco/ResearchTotal/Defense/Ships/Reserve/Industry, autoSwitch, refresh; orders slider/sliderLock/build/tax/security/transfer) · `Vis` (init, explore, snapshot, update, canSee) · `Turn.run(S)` generator · `autoTurn/autoPlay/stats/newGame/isOver` (sim/auto.js) · `Ev` event buffer · `Orders.register/apply`.
**To be provided by the remaining subsystems** (each registers orders and exposes hooks the pipeline already calls when present): `Combat` (findBattles, resolve, applyResults, tactical API, Ops.resolveBattle) · `Ground` (bombard, invade) · `Diplo` (init, isAllied, atWar, tradeIncome, preTurn, economyTurn, turn, status, propose…) · `Spy` (buildTurn, turn) · `Council` (due, convene, resolve, autoVote) · `Events` (turn, coups) · `Artifacts.loot` · `News.compile` · `AI.plan` (+ Ops.aiPlan) · `Q` (UI queries).
## B4. Orders implemented so far (Orders.apply(S, empireId, {t:…}))
`researchSlider{field,value}` `researchSet{values[6]}` `researchLock{field,locked}` `researchEqualize` `researchPick{field,level}` · `slider{planet,index,value}` (greedy auto-balance like the UI) `sliders{planet,values[5]}` (set all, sum 100 — AI) `sliderLock{planet,index,locked}` `build{planet,design|-1}` `rename{planet,name}` `tax{value}` `security{value}` `transfer{planet,amount}` `aiState{patch}` (merge into E.ai — planners are pure) ·
`fleetSend{from,to,counts[6]}` `trans{planet,to,n}` `reloc{planet,to}` `colonize{fleet,planet,slot?}` · `design{slot,design}` `scrapDesign{slot}` (Design module) · to come: `aiState{patch}` `spyBudget` `spyMode` `diplomacy{…}` `vote`.
## B5. Interrupts yielded by Turn.run → Game.handlers[type](it, S) → answer
`aiPlan`→{[empireId]:orders[]} · `battles{battles[]}`→{results[]} · `colonize{empire,planet,fleet,slots}`→bool · `explore{empire,star}` · `techChoice{empire,field,choices:[{level,cost,tech}]}`→level · `tech{empire,field,level,id,source}` (breakthrough scene) · `notice{kind,…}` ·
`ground{result}` · `diplomacy{…}` (AI proposal/message to the human; may carry `answer(fn)`) · `council{info}`→vote · `councilResult{result}` · `gnn{year,turn,items[],rankings,ticker}` · `gameover{reason:'conquest'|'council'|'defeat'|'exile',winner}`.
## B6. Worker ops (MOO.Ops.*) — `aiPlan{empire,seed}`→orders[] (reads MOO.snap) · `resolveBattle{battle,seed}`→result · `burn/echo/snapInfo` (tests). Orders applied by the main thread in empire order.

## Commands
`node tools/check.js` · `node tools/headless.js` · `node tools/rules-test.js [area]` · `node tools/soak.js …` · browser: `http://localhost:8765/index.html?dev=1&screen=galaxy&race=psilon&size=large&opp=4&seed=abc`.
`node tools/check.js` (syntax of every manifest file) · `node tools/headless.js` (loads sim modules) · `node tools/rules-test.js` (formula tests — written from the verified specs) ·
`node tools/soak.js` (24-thread AI-vs-AI soak/balance across race × difficulty) · browser smoke tests with `MOO.Game.devBoot` URLs (`?screen=galaxy&dev=1`).
