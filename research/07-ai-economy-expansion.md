# 07 - MOO1 AI: Economy, Expansion, Research and Ship-Design Logic (spec for implementers)

Scope: the strategic/economic half of the 1993 Master of Orion (MicroProse/SimTex, v1.3 DOS) AI - how AI empires set planet sliders, expand, research, design ships and use their difficulty handicaps/cheats. Military tactics and the diplomacy state machine belong to the sibling slice (`05-diplomacy-events-victory.md`); they appear here only where they touch the economy. Where this file and `05` disagree, the disagreement is flagged `(conflict: ...)`.

Status: v2 (2026-10-11): v1 written under a "write now" instruction; v2 completes every section and adds the **planner cards (s12)** - implementation contracts for pure planners that emit orders - plus a comparison with the code already in `js/ai/` and `js/sim/` (s11) and a verified/inferred ledger (s13). Everything is behaviour description + numbers; **no source code is reproduced** (1oom is GPL). Identifiers are quoted only as pointers so a second analyst can verify.

Task-item -> section map: (1) AI turn structure = s1; (4) planet management = s2; (5) colonisation = s3; (6) research = s4; (7) ship design = s5; (3) difficulty = s6; (2) personality/objective/race = s7; (8) production planning + (9) scouting/range = s8; (10) playbooks + constants = s9, s10; mismatches vs the existing JS, quirks, conflicts, gaps = s11; planner contracts = s12; verified/inferred ledger = s13; revision log = s14; appendices A-C.

Evidence tags used in s11-s13 (and inline where it matters): **[V]** verified - read in the 1oom source at least twice or by line quote; **[V1]** single clear read; **[I]** inferred/derived by me from verified rules (e.g. probability tables); **[G]** only the strategy guide says so; **[X]** conflict between sources.

---------------------------------------------------------------------------------------------------

## 0. Provenance, conventions, confidence

### 0.1 Sources and tags

* **[1oom]** = open-source 1oom engine, fork `1oom-fork/1oom`, branch `master`, `src/game/*.c`. It re-implements the **v1.3** executable bug-for-bug in its "**Classic**" AI (default AI of the fork since v1.8.1) and offers "**Classic+**" (small fixes, many from kyrub's unofficial 1.40m patch). Citation form: `GAC::x` = `game_ai_classic.c`, function `game_ai_classic_x` (e.g. `GAC::turn_p3`); `GM` = game_misc.c, `GT` = game_turn.c, `GTe` = game_tech.c, `GD` = game_design.c, `GN` = game_num.c, `GNew` = game_new.c, `GS` = game_spy.c, `GP` = game_planet.c/.h, `GF` = game_fleet.c, `GE` = game_event.c, `GSD` = game_shipdesign.c, `GST` = game_shiptech.c/.h, `GDip` = game_diplo.c.
* **[Guide]** = *Master of Orion: The Official Strategy Guide* (Emrich & Hughes, Prima 1994), OCR on archive.org (`MasterOfOrionStrategyGuide_201704`). Designers' intent, probably an earlier version than v1.3; numbers often differ from the shipped code.
* **[Patch]** = archive.org readmes: MOO v1.3 patch notes and kyrub's community patch 1.40m/1.40i/"Embryonic 18".
* **[LP]** = lparchive.org "Master of Orion" Let's Play (anecdotal). **[Steam]** = Steam community race guide (anecdotal).
* `(unverified)` = could not be confirmed. `(conflict: ...)` = sources disagree. `(BUG)` = original v1.3 quirk that 1oom Classic preserves; every one is listed in s11 so the choice to reproduce or fix is conscious.
* Method note: the fetch tool summarises pages. For the load-bearing functions (`turn_p3`, `design_ship*`, `have_colony_ship`, `tech_next`, `crank_*`, `game_update_production`, `game_get_base_cost`, `game_tech_get_next_rp`) I obtained near-verbatim line quotes and re-read them; other numbers were read at least twice. Numbers not flagged are consistent across reads.

### 0.2 Notation

* `rnd(n)` = uniform integer 1..n; `rnd0(n)` = uniform integer 0..n-1 (same as sibling slice 05). `x/y` = C integer division. "chance c%" = success when `rnd(100) <= c`.
* `T` = turn counter (`g->year`), starts at 1; displayed stardate = 2299 + T.
* Planet sliders: SHIP, DEF, IND, ECO, TECH (int16 percent; normally sum to 100). Empire tech sliders: COMPUTER, CONSTRUCTION, FORCE FIELD, PLANETOLOGY, PROPULSION, WEAPON (sum 100).
* `TP` = empire total production (`total_production_bc`) = sum over planets of planet output after the AI difficulty multiplier and after the planet-reserve top-up. `prod_after_maint` = a planet's BC after empire-wide maintenance/tax/security scaling; sliders are percentages of this.
* Distances: **map units** (the planet x,y coordinates; AI heuristics use `dist_fast = max(dx,dy) + min(dx,dy)/2`) versus **parsecs** (the `star_dist` table, computed by stepping 5+6 = 11 units per step; used for fuel range). Ships move 11 units per speed point per turn, so 1 parsec ~ 11 map units (unverified exact rounding). Fuel range is 3..10 parsecs (30 = unlimited) from owned/allied planets.
* Enumerations (race, trait1, trait2, difficulty, treaty, planet type/special, tech field, ship special...) are in Appendix A.

### 0.3 What the AI knows

The Classic AI is **omniscient about the map**: it reads every empire's orbit tables, en-route fleets and planet owner/type/pop/special directly (the `seen` tables are "not used by the classical AI"); fuel range (`within_frange`) is the only geometric gate; "contact" is used only to build "fronts" and for spying/diplomacy. It targets unexplored planets for colonisation without scouting them first.

---------------------------------------------------------------------------------------------------

## Executive summary - the 25 facts that matter most

1. **Three planners per turn.** `p1` every turn (scouts, colony ships, fleet orders, transports, panic funding, tax); `p2` every 9..20 turns (ship-design maintenance + what every planet builds); `p3` slider rebalance every 2..6 turns (first at turn 15..20, or 25..30 for isolated starts), research focus every 10 turns per empire. Tech choice is event-driven (`tech_next`).
2. **AI never builds colony ships.** One is **conjured for free** at a random "front" planet with probability `min(500, 0.4*TP)/500` per turn while any colonisable unowned planet exists anywhere (Simple/Easy lose that roll 5/6 and 4/6 of the time).
3. **Colonisation has no target scoring.** Candidates = every unowned planet in fuel range whose type is >= the colony ship's base type (Minimal at start; lower with Planetology techs; Silicoid = anything). They are served in **planet-index order**; each takes the nearest colony-ship stack; the whole stack **plus every other ship in that orbit (escorts)** is sent. Size, specials, minerals, gravity, ownership history, threats are ignored. On arrival the colony is founded automatically (pop 2).
4. **4th-colony-ship curse (BUG):** if 4+ colony ships exist, the AI neither spawns nor sends any more (fixed in 1.40i and Classic+).
5. **Planet sliders are randomised** every 2..6 turns: floors (SHIP 5 / DEF 5 / IND 10 / TECH 25 gated on ECO), young planets IND 50, racial/special bonuses, then the rest dealt in 3..10% chunks by an objective-specific weight row (War row if at war with anyone). ECO is first forced to the waste-neutralising percentage. Mature planets with maxed factories convert IND into DEF+TECH every turn.
6. **Sliders can total > 100%** on a rebalance turn (young planets, Meklar, rich planets) - a free over-spend; the end-of-turn normaliser then sets TECH = remainder (>= 0).
7. **No explicit fleet/defence targets.** Ships = SHIP% x production / design cost; defence = DEF slider (shield first, then missile bases). Threatened planets (hostile fleet en route) shove DEF+IND+TECH into SHIP and receive 1/5 of the empire reserve. Planets with > 4 bases and `bases*3 >= pop/(5-difficulty)` double their SHIP slider each turn (BUG "obscenely large fleets").
8. **Research:** planet TECH sliders feed one pool; the six field sliders are re-rolled every 10 turns (offset by player index) to **75% in one field + 5% in the other five**; the field comes from a 25% racial focus or an objective-weighted d16. Within a field the AI picks the next tech at random from the frontier, except with probability (difficulty-1)/6 it takes the highest-tier candidate.
9. **Ship designs are random, 6 slots, 1 new design per run.** Roles: exactly one colony design (Large hull, **armed**), one bomber, rest "fighters". Hull from a d12 roll shifted by race (+3 Silicoid/Bulrathi/Meklar, -3 Alkari/Klackon, +1 if a human has Pulsars). Components: tiered random picks (best 5..70% by hull, doubling chance per step down) that, in the 1oom code, **exclude the newest owned item** of each category; armor = best type (heavy "II" variant only 1/2/4/8%). Planets build one of the **3 newest designs** at random (colony design never; Stargate 50% when available).
10. **Difficulty cheats (v1.3 code):** AI planet output x1.0/0.8/1.25/1.5/2.0 (Simple..Impossible); AI missile-base cost x1.0/0.9/0.8/0.7/0.5; AI tech cost factor fixed 20 vs human 20/25/30/35/40; AI picks best-tier tech (d-1)/6; AI taxes/security scale with d; colony spawn throttled on Simple/Easy; Hard/Impossible also start **every** empire (human too) at pop 40/prod 50 instead of 50/55. Ship costs are NOT discounted.
11. **Objective (trait2) drives the economy; personality (trait1) is diplomacy-only.** Objective sets slider weights, research weights, colony-ship throttle exemption (Expansionist) and treaty-breaking odds; personality only shifts diplomacy numbers.
12. **Race tweaks:** slider bonuses (Mrrshan SHIP+15, Meklar IND+20, Psilon TECH+20, Bulrathi/Sakkra ECO+10, Klackon ECO+15), 25% racial research focus (Bulrathi/Mrrshan Weapon, Darlok Computer, Meklar Construction/Planetology, Alkari Propulsion, Sakkra Planetology), hull offsets, Silicoid colonises everything, Darlok spy emphasis.
13. **Taxes and reserve are tiny:** AI tax = `rnd(10)+d+2` per mille of production from T20 (0.3..1.6%); half goes to the empire reserve, which is spent only on planets with pop < 20 and on threatened planets (1/5 per planet per turn).
14. **Population "transports" are free logistics:** planets with pop >= half max (and > 20) ship pop/2 to enemy planets they have ships over; planets above 3/4 max ship pop/3 to colonies below 1/3 max or in rebellion.
15. **Event reactions:** Plague/Nova -> all non-ECO production to TECH; Comet/Pirates -> all to SHIP; both add 1/5 of the empire reserve to the planet.

---------------------------------------------------------------------------------------------------

## 1. AI TURN STRUCTURE AND TIMING

### 1.1 Where the AI sits in the game turn [GT::game_turn_process]

AI-relevant order (everything else omitted):
1. Pre-turn: ceasefire countdown, mood/blunder update, refresh per-design "has reserve fuel" flags.
2. **AI p1** (all non-human empires, player-index order), then **AI p2**, refresh reserve-fuel flags, then **AI p3**.
3. Transports leave (planets with `trans_num > 0`, set by p1), production recomputed (**AI difficulty multiplier applied here**), ecology/waste/population growth, research totals, trade, spy hiring, diplomatic bookkeeping.
4. Spending order: defence (DEF slider: upgrade bases, planetary shield, missile bases) -> ships (SHIP slider) -> reserve decay + tax income -> factories (IND slider).
5. Ship movement, combat, spying, **tech research (RP applied; a finished project triggers the AI `tech_next` pick)**.
6. Exploration/colonisation (**AI colony ships found a colony automatically on arrival**), bombing, transport landings, ground combat, coups, end checks, random events (event hooks call the AI "crank" routines), then diplomacy phases, council, audiences.
7. End of turn: unrefuel stranded ships, production recompute, **`game_update_eco_on_waste` for every empire (AI slider normalisation, s2.7)**, `T += 1`, range/visibility updates.

Consequence: an AI decision made in turn N uses the state left at the end of turn N-1 and affects the spending of turn N.

### 1.2 Hooks and cadence

| Hook | Scope | Cadence | Content |
|---|---|---|---|
| `turn_p1` [GAC::turn_p1] | every non-human empire (dead AIs are **not** skipped) | every turn | threat tables, territory centres, scouts, fronts, colony-ship spawn/send, attack/defend/idle fleet orders, population transports, panic funding, developing-planet funding, tax |
| `turn_p2` [GAC::turn_p2 -> turn_p2_do] | AI and alive | per-empire countdown: first fire after `rnd(10)` turns (1..10), then every `rnd(12)+8` (9..20) | ship-design maintenance (scrap, create), build order for every owned planet |
| `turn_p3` [GAC::turn_p3] | non-human | slider rebalance on countdown (first `rnd(6)+14` = 15..20 turns, or `rnd(6)+24` = 25..30 if the home star has no other planet of type >= Minimal within 30 map units; afterwards `rnd(5)+1` = 2..6); factory/base tweaks **every turn**; research focus when `T % 10 == player index`; security/spy settings every turn when `T > 30` | planet sliders, tech sliders, spying |
| `tech_next` [GAC::tech_next via GTe::game_tech_ai_tech_next] | per field | when a project completes (and at game start) | next tech choice |
| `plague/nova/comet/pirates` [GAC::crank_tech / crank_ship, called from GE::game_event_run each event turn] | affected AI planet | event-driven | emergency slider shifts |
| `turn_diplo_p1/p2`, audiences, `vote`, `bomb`, `ground`, battle hooks | - | - | sibling slice 05 |

Timer semantics: the countdown is decremented first and the routine runs when the result is <= 0, so an initial value `c` fires on the c-th turn.

### 1.3 p1 internal order [GAC::turn_p1]

Once per turn for all empires: (a) **ship-threat table** per design (s8.5) and `game_update_maint_costs`; (b) **territory centre** of every living empire (mean x,y of its planets, integer division; (0,0) if none).
Then for each non-human empire, in player order:
1. `flag_send_colony = true`. If trait2 is **not** Expansionist: `num_planets` = owned planets; `num_developing` = owned planets with `missile_bases < max_pop3/20` **and** `pop < (max_pop3*2)/3`; if `num_planets/2 < num_developing` and **any human empire has contact with this AI**, `flag_send_colony = false`.
2. `send_scout` (s8.1). 3. `front` (builds "fronts", s3.3). 4. `have_colony_ship` (may conjure a ship, s3.4); only if it returns true **and** `flag_send_colony`: `send_colony_ships` (s3.5-3.6). 5. `front` again. 6. `planet_w` (rate own/enemy planets, s8.5). 7. `send_attack` (only if the enemy-target list is non-empty). 8. `send_defend`. 9. `send_idle` - only if the empire has **fewer than 8** fleets in flight (counted fresh at that point, including fleets created by steps 2-8). 10. `trans_en` (invasion transports, s2.11). 11. `trans_own` (pop relocation, s2.11). 12. `build_defending_ships` (panic sliders, s2.6). 13. `fund_developing` (reserve to pop<20 planets, s2.6). 14. `tax` (s2.10).

Military steps 7-9 are specified by the sibling slice; their economy-relevant effects are noted in s8.5.

### 1.4 Persistent AI state vs per-turn scratch

* **Persistent (empire):** `ai_p2_countdown`, `ai_p3_countdown`, the 6 ship designs with per-design build year and ship counts, `shipi_colony`, `shipi_bomber` (indices into the design list), the six tech sliders and research projects/investments, `tax`, `security`, `spying[]`/`spymode[]` (re-rolled every turn), `spymode_next[]`, `reserve_bc`, plus all diplomacy memory (relations, trust, moods, blunders, bounty/offer fields - sibling slice).
* **Persistent (planet):** the five sliders, `buildship` (design index 0..5 or Stargate = 6), `reserve` (planet reserve), `trans_num`/`trans_dest` (set by p1, consumed the same turn), `reloc` (always = the planet itself; **the AI never uses relocation rally points**).
* **Scratch rebuilt every turn (no memory):** threat table, fronts, own/enemy planet lists, force tables, `need_conquer`, `have_colonizable`, target lists. There is **no wish-list, target memory or plan**; every decision is recomputed from the current galaxy state plus fresh random rolls.

### 1.5 Typical early timeline of an Average-difficulty AI with at least one neighbour planet (derived from the code; (unverified) as an observed trace)

| Turn | What happens |
|---|---|
| 1 | Home planet: SHIP 10 / IND 90 (others 0); tech sliders fixed 20/20/0/40/20/0; **no research** (planet TECH = 0). 2 scouts sent to the two lowest-index unexplored in-range planets (1 ship per target). `shipi_colony` still points at the *Fighter* design (index bug), so the real colony ship (design 4) sits idle. Colony "magic" roll each turn, p ~ 4..6% at TP ~ 55..70. |
| 1..10 (random) | First `p2_do`: roles re-detected (colony = design 4), oldest empty design removed, new designs created to fill 6 slots, `buildship` assigned on every planet from the 3 newest designs. Real colony ship dispatched from the next turn. |
| 15..20 | First `p3` rebalance: planets get randomised sliders (TECH becomes substantial -> research starts); empire tech sliders persist until the player's `T % 10` turn. |
| every 10 turns | Research focus re-rolled (75/5/5/5/5/5). Before T 30 a 50% roll forces Propulsion 75. |
| >= 20 | Tax re-rolled each turn. |
| > 30 | Security/spy settings re-rolled each turn. |
| 50 / 100 | Design aging: designs older than 50 turns scrapped while T < 100, afterwards older than 100. |
| > 120 | The Orion planet becomes eligible as an **attack target** (planet rating, s8.5) after T 120. Scouts never target Orion at all (`send_scout` excludes it; its "T < 150" ignore clause is redundant), and colony ships skip it while the Guardian lives. |

---------------------------------------------------------------------------------------------------

## 2. PLANET SLIDERS, BUILD DECISIONS, RESERVE, TAXES, TRANSPORTS

### 2.1 Start-of-game state [GNew::game_generate_home_etc, GAC::new_game_init, GAC::new_game_tech, GSD::tbl_startship]

* Home planet (every empire): Terran, yellow star, max pop 100 (option), growth Normal; `pop/factories/total_prod` = **50/30/55** at Simple..Average, **40/30/50** at Hard/Impossible (applies to the human too).
* Start fleet (all difficulties): 2 Scouts (design 0), 1 Colony Ship (design 4), 0 others. Start designs: 0 Scout (Small hull, reserve fuel tanks), 1 Fighter (Small, 1 laser), 2 Destroyer (Medium, 1 nuclear missile + 3 lasers), 3 Bomber (Medium, 2 nuclear bombs + 2 lasers), 4 Colony Ship (Large hull, standard colony base), slot 5 unused. `have_colony_for = Minimal`, fuel range 3, `colonist_oper_factories = 2`, factory cost 10.
* AI init: count planets of type >= Minimal within **30 map units** of home (the home planet itself counts) = `n`.
  * `n > 1`: home sliders SHIP 10, DEF 0, IND 90, ECO 0, TECH 0; empire tech sliders COMPUTER 20, CONSTRUCTION 20, FORCE FIELD 0, PLANETOLOGY 40, PROPULSION 20, WEAPON 0; p3 countdown `rnd(6)+14`.
  * `n <= 1` (isolated): SHIP 0, DEF 0, IND 60, ECO 10, TECH 40 (sums to 110; the first normalisation trims TECH to 30); tech sliders 100% PROPULSION; p3 countdown `rnd(6)+24`.
  * p2 countdown `rnd(10)`; `shipi_colony = 1`, `shipi_bomber = 4` (deliberately wrong - the source says "fixed next turn"; they are corrected only at the first p2 run).
* AI starting research: per field, `researchlist[field][tier 0][rnd0(3)]`, re-rolled while 0; Classic sets the project cost to `tech*tech*50` (Classic+ / `ai_first_tech_cost_fix` uses the normal cost formula, s4.5). The human starts with tech sliders 20/10/15/15/20/20.

### 2.2 New colony defaults [GNew, GP::game_planet_destroy, GT::game_turn_explore]

A freshly colonised planet has pop 2, factories 0, sliders **IND 100 / others 0**, `buildship = 0`, `reloc` = itself, no shield. It keeps these until the empire's next p3 rebalance (<= 6 turns later, typically 2..6) and builds **design slot 0** (whatever design sits there) until the next p2 run (<= 20 turns).

### 2.3 The p3 slider rebalance (when the empire's countdown expires) [GAC::turn_p3]

Row selection: weight row = the empire's objective (trait2) **unless it has any treaty value >= War (War or Final War) with any empire, then the War row** (index 6). (In v1.3 this selector was computed inside the countdown branch and reused stale outside it - the research part sometimes used the wrong race/objective; fixed by kyrub 1.40; 1oom computes it correctly. Implement the correct behaviour.)

Procedure (`E` = ECO slider after step 2):
1. Reset the countdown to `rnd(5)+1`.
2. **Force ecology:** every owned planet of a non-Silicoid empire gets ECO set to exactly the waste-neutralising percentage `W = ceil(100*waste/prod_after_maint)` (0..100), and SHIP/DEF/IND are each reduced by `slider*(W-oldECO)/100`. (Silicoids have no waste: ECO is left as it was and therefore **accumulates** across rebalances.)
3. Thresholds from the row: `w_ship = c0`, `w_def = c0+c1`, `w_ind = w_def+c2`, `w_eco = w_ind+c2` (**BUG/quirk: the ecology weight reuses column 2; column 3 is never read**).
4. For each owned planet:
   a. SHIP = DEF = IND = TECH = 0 (ECO kept).
   b. Floors by ecology: if E < 96, SHIP = 5; if E < 91, DEF = 5; if E < 81, IND = 10; if E < 71, TECH = 25.
   c. If `pop < (max_pop3*3)/4`: IND = 50 (replaces step b's IND).
   d. Racial adds: Bulrathi or Sakkra with `pop < max_pop2`: ECO += 10; Klackon with `pop < max_pop2`: ECO += 15; Meklar: IND += 20; Psilon: TECH += 20; Mrrshan: SHIP += 15.
   e. Special adds: planet special Artifacts or 4X-Tech: TECH += 20; special >= Rich (Rich, Ultra-Rich, 4X-Tech): IND += 20 and SHIP += 10.
   f. `left = 100 - (SHIP+DEF+IND+ECO+TECH)`. While `left > 0`: draw `r1 = rnd(13)`, `r2 = min(left, rnd(8)+2)` (3..10); `left -= r2`; add `r2` to SHIP if `r1 <= w_ship`, else DEF if `r1 <= w_def`, else IND if `r1 <= w_ind`, else ECO if `r1 <= w_eco`, else TECH.
   g. No other clamp: if b-e already exceed 100 the loop is skipped and the planet keeps **> 100% total** (young planets with E > 15, Meklar, rich planets...). This is a free over-spend that lasts until the next normalisation.

### 2.4 Weight rows, chunk probabilities and expected results

Raw table `ai_p3_tbl_w` (c0..c3 = Ship, Def, Ind, Eco [c3 unused]; c4..c8 = Computer, Construction, Force Field, "col7", "col8" - see s4.3 for the column/field question):

| Row (trait2) | c0 | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 |
|---|---|---|---|---|---|---|---|---|---|
| 0 Diplomat | 1 | 2 | 4 | 1 | 2 | 2 | 4 | 2 | 3 |
| 1 Militarist | 4 | 1 | 2 | 1 | 3 | 1 | 4 | 2 | 1 |
| 2 Expansionist | 2 | 4 | 1 | 1 | 1 | 1 | 3 | 5 | 2 |
| 3 Technologist | 1 | 2 | 3 | 1 | 4 | 2 | 3 | 2 | 2 |
| 4 Industrialist | 1 | 2 | 4 | 1 | 1 | 5 | 4 | 1 | 2 |
| 5 Ecologist | 1 | 1 | 2 | 4 | 1 | 2 | 4 | 1 | 5 |
| 6 War | 4 | 1 | 1 | 1 | 2 | 2 | 4 | 2 | 1 |

Cumulative thresholds `(w_ship, w_def, w_ind, w_eco)` and chunk probabilities (out of 13; `r1` above `w_eco` = TECH):

| Row | thresholds | SHIP | DEF | IND | ECO | TECH |
|---|---|---|---|---|---|---|
| Diplomat | 1,3,7,11 | 1/13 | 2/13 | 4/13 | 4/13 | 2/13 |
| Militarist | 4,5,7,9 | 4/13 | 1/13 | 2/13 | 2/13 | 4/13 |
| Expansionist | 2,6,7,8 | 2/13 | 4/13 | 1/13 | 1/13 | 5/13 |
| Technologist | 1,3,6,9 | 1/13 | 2/13 | 3/13 | 3/13 | 4/13 |
| Industrialist | 1,3,7,11 | 1/13 | 2/13 | 4/13 | 4/13 | 2/13 |
| Ecologist | 1,2,4,6 | 1/13 | 1/13 | 2/13 | 2/13 | 7/13 |
| War | 4,5,6,7 | 4/13 | 1/13 | 1/13 | 1/13 | 6/13 |

Sanity-check expectations (derived; chunk granularity adds variance; no race/special adds; E = waste% of the planet):

| Row | Mature planet, E = 20 (left = 35): SHIP/DEF/IND/ECO/TECH | Young planet (pop < 3/4 max), E = 0 (left = 15): SHIP/DEF/IND/ECO/TECH |
|---|---|---|
| Diplomat / Industrialist | 7.7 / 10.4 / 20.8 / 30.8 / 30.4 | 6.2 / 7.3 / 54.6 / 4.6 / 27.3 |
| Militarist | 15.8 / 7.7 / 15.4 / 25.4 / 35.8 | 9.6 / 6.2 / 52.3 / 2.3 / 29.6 |
| Expansionist | 10.4 / 15.8 / 12.7 / 22.7 / 38.5 | 7.3 / 9.6 / 51.2 / 1.2 / 30.8 |
| Technologist | 7.7 / 10.4 / 18.1 / 28.1 / 35.8 | 6.2 / 7.3 / 53.5 / 3.5 / 29.6 |
| Ecologist | 7.7 / 7.7 / 15.4 / 25.4 / 43.9 | 6.2 / 6.2 / 52.3 / 2.3 / 33.1 |
| War | 15.8 / 7.7 / 12.7 / 22.7 / 41.2 | 9.6 / 6.2 / 51.2 / 1.2 / 31.9 |

Reading: the *Ecologist* row gives the **most research and little ecology** (the ecology weight is the industry weight); the *Expansionist* row gives the **most defence**; *Militarist* and the *War* row give the most ships (~16% of a mature planet).

### 2.5 Every-turn tweaks (after any rebalance, same turn) [GAC::turn_p3]

* **Factories maxed:** if `factories >= pop * colonist_oper_factories`: `DEF += IND/2`, `TECH += IND/2 + IND%2`, `IND = 0` (so a developed planet stops funding factories and splits that share between defence and research).
* **Missile-base saturation:** if `missile_bases > 4` **and** `missile_bases*3 >= pop/(5 - difficulty)` (i.e. bases >= pop/15, /12, /9, /6, /3 for Simple..Impossible) **and** planet `shield >= empire planetary-shield level`: Classic (BUG, "very large fleets") does `SHIP += SHIP` and `DEF = 0`; with `ai_fleet_cheating_fix` (Classic+/recommended) `SHIP += DEF`, `DEF = 0`. In Classic the SHIP slider doubles every turn (stored as int16: it would wrap negative after ~12 doublings and the end-of-turn clamp then resets it to 0 - (inferred); 1oom's option text says it "could reach 1000% or more") - effectively all of that planet's production plus a large free surplus goes into ships. [Patch 1.40: "AI defence and ship production when a planet has too many MBases adjusted".]

### 2.6 Panic mode and reserve funding [GAC::turn_p1_build_defending_ships, fund_developing, add_reserve]

* **Threat:** a planet owned by the AI is "threatened" when any en-route fleet of another empire has it as destination (Classic counts allies' fleets too; Classic+ ignores allied fleets). For every threatened planet: `SHIP += DEF + IND + TECH`; DEF = IND = TECH = 0 (ECO untouched); then `v = empire reserve_bc / 5` moves from the empire reserve to the planet's reserve. Because p3 runs after p1, a rebalance on the same turn overwrites this; on other turns it persists until the next rebalance. The end-of-turn normaliser then sets TECH = max(0, 100 - others).
* **Developing planets:** every owned planet with `pop < 20` takes `reserve_bc/5` from the empire reserve (sequentially, so the pool shrinks per planet).
* **What a planet reserve does** [GM::game_update_production, GT::game_turn_reserve]: each turn the planet's output gets `min(planet reserve, output)` added (up to a doubling), and the planet reserve then drains by `prod_after_maint/2`.

### 2.7 End-of-turn normaliser [GM::game_update_eco_on_waste, called for every empire at the end of every turn]

For each owned planet of a non-Silicoid empire: if ECO < waste% then ECO := waste% and SHIP/DEF/IND shrink by `slider*(waste%-oldECO)/100`; then SHIP/DEF/IND clamped >= 0, ECO clamped 0..100, and **TECH := max(0, 100 - SHIP - DEF - IND - ECO)**. Consequences: (a) AI research is whatever the other four sliders leave; (b) an over-100% planet loses its TECH but keeps SHIP/DEF/IND/ECO as set; (c) ECO never drops below the waste-neutralising level.

### 2.8 What each slider buys (AI-relevant mechanics; formulas are common to human and AI)

* **SHIP:** `(SHIP% * prod_after_maint)/100` (special-adjusted) + carry-over, **+1 BC whenever SHIP > 0** (1oom-noted bug). Buys as many ships of `buildship` as `cost` fits; ships appear in the planet's orbit (reloc = self). Stargate build (`buildship = 6`) costs 3000 BC and 100 BC/turn upkeep each.
* **DEF:** first re-tools existing missile bases to the current base tech (cost difference x bases), then fills the **planetary shield** (cost by shield level; skipped on planets in nebulae / battlebg 0), then builds missile bases at the empire's current base cost (AI difficulty-discounted, s6).
* **IND:** if the planet's operated-factories-per-colonist is below the empire's Robotic Controls level it first pays the (Classic: tiny, `gap * factory_cost/2`) re-tool, then buys factories at `factory_adj_cost` each up to `pop*pop_oper_fact`; any excess BC (half value) goes to the **empire reserve**.
* **ECO:** first neutralises waste (cost = waste/restoration factor), then runs the automatic chain atmosphere (200 BC, needs tech + Hostile) -> soil enrichment (150) -> advanced soil (300) -> terraform (+max pop at 5..2 BC per point, up to the tech limit 10..120) -> population growth. **The AI never chooses projects**: terraform/soil techs are used simply because ECO money flows through this chain.
* **TECH:** planet output x TECH% (Psilon x1.5, Artifacts planet x2, 4X-tech planet x4, cap 32767) to the empire pool, split by the six tech sliders.
* AI planets never get "finished" slider auto-switches (those are human-only).

### 2.9 Build selection [GAC::turn_p2_do] - details in s5.8. Summary: every p2 run, every owned planet's `buildship` = one of the **3 newest designs** (uniform, independent per planet; the colony design is forced to age 0 so it never qualifies) or, if the planet has no Stargate, the empire has Stargate tech and `rnd0(2) == 1` (50%), a **Stargate**.

### 2.10 Tax and empire reserve [GAC::turn_p1_tax, GT::game_turn_reserve, GM::game_update_production]

* From T >= 20 the AI re-rolls `tax = rnd(10) + difficulty + 2` **every turn** (units: per mille of total production; the human slider is 0..200 in steps of 5); before T 20, tax = 0. Range 3..12 (Simple) to 7..16 (Impossible) = 0.3..1.6% of production.
* Tax cost = `TP*tax/1000` off production; **half** of it (`TP*tax/2000`) is added to `reserve_bc` each turn. Other reserve inflows: scrapped designs (25% of design cost per ship), factory-cap overflow, the "Support" random event (max(500, floor(T/10)*100)).
* The reserve is spent only through `fund_developing` and `build_defending_ships` (1/5 per planet per turn). The AI never "buys" things with it.

### 2.11 Population transfers [GAC::turn_p1_trans_en, trans_own; GF::game_send_transport; GT::game_turn_transport]

* **Invasion transports (`trans_en`)** - for every enemy-owned planet `D` that qualifies: owner != self, (owner is AI or no ceasefire with the human), no alliance, `have_colony_for <= D.type`, **and the AI has at least one ship in orbit there**, (with `ai_trans_range_fix` also within fuel range; Classic has no range check): the nearest owned planet `S` with `pop >= max_pop3/2` and `pop > 20` (Classic+: and not in rebellion) that is within `bestspeed*30+30` map units sends `trans_num = pop/2`; each source sends once per turn; each destination is served at most once and skipped if an AI transport already goes there. Transports leave this turn; the source keeps >= 1 pop, production drops by the transported pop for the turn.
* **Relocation (`trans_own`)** - destinations: own planets with `pop < max_pop3/3` or in rebellion; sources: own planets with `pop > (max_pop3*3)/4` (Classic+: not in rebellion); the **first** source in planet-index order within `bestspeed*20+20` units sends `pop/3`. A planet in rebellion with high pop can be both (Classic).
* Distance thresholds (map units, `dist_fast`): with `P` = the highest owned PROPULSION tech level in {6,12,...,48} (0 if none) and `BS = P + 3`: `trans_en` range = `30*BS + 30`; `trans_own` range = `20*BS + 20` (e.g. at game start BS = 3 -> 120 and 80 units; with the first engine tech BS = 9 -> 300 and 200). Full list of the `bestspeed` terms in s8.4. Landing on an own planet adds pop up to `max_pop3`; on a rebelling own planet it becomes garrison; on an unowned planet nothing happens (the AI never colonises with transports).

### 2.12 Event reactions [GAC::crank_tech / crank_ship / add_reserve; GE::game_event_run]

| Event | AI hook | Effect on that planet |
|---|---|---|
| Plague, Nova | crank_tech | TECH += SHIP+IND+DEF; SHIP = IND = DEF = 0 (research output is what burns off the plague/nova counter); planet reserve += empire reserve/5 |
| Comet, Pirates | crank_ship | SHIP += TECH+IND+DEF; TECH = IND = DEF = 0 (ship damage kills the comet/pirates); reserve += reserve/5 |
Only for AI owners; hooks run every event turn while the event lasts.

### 2.13 Spy and security funding [GAC::turn_p3, turn_p3_sub1; GS::game_spy_build/turn]

Every turn when `T > 30`:
* `security` (tenths of % of production) = `(totalspies == 0 ? 0 : rnd0(2)*totalspies) + 8*difficulty`, capped 100, where `totalspies` = sum over contacted empires `e` of `e.spies[this AI]` (spies others have on the AI).
* `spymode_next[e]` per empire: HIDE by default; if `e` is human with `ceasefire[e][e] > 0` (indexing BUG, should be [e][AI]) stays HIDE; else if in contact: treaty >= War -> **Sabotage**; otherwise (Darlok always; others only if `rnd0(2) != 0`) -> **Espionage** when `rnd(200) > 2*relation1[e] + 200` (so only toward empires with negative relation; chance ~ -relation/100). The "else" branch (Sabotage by relation) is unreachable.
* Actual `spymode[e]`/`spying[e]`: cleared, then for contacted `e` with `spymode_next != HIDE` and (e human, or `rnd0(3) == 0` for AI targets): set to `spymode_next`, `spying[e] = rnd(5)+5` tenths of % of production (0.6..1.0%) funding new spies; spy cost `2*computer% + 25` BC (Darlok halved), doubling within a turn.
* Spy resolution, tech-steal value function and caught rolls: s4.6 and `05` s5.

### 2.14 What the AI never does

No relocation rally points, no trade goods/housing (not in MOO1), no terraform/soil project selection, no colony-ship purchase, no scrapping of planets/factories, no tax-for-reserve management, no explicit fleet-size or defence targets, no response to being behind in tech/economy (other than difficulty-scaled tech picks), no re-design when new tech arrives (only on the p2 timer).

---------------------------------------------------------------------------------------------------

## 3. COLONISATION (target selection, colony-ship policy, logistics)

### 3.1 What the original does - and does not do [V]

* **No target scoring.** The AI never looks at planet size, max population, richness/specials, "minerals", distance ranking, threats, claims or contested status when choosing a colony target. Tested attributes: owner (must be unowned), the fuel-range flag of the planet, the Orion Guardian (skip while alive), and planet **type >= the colony ship's base threshold**. (MOO1 has no gravity, no outposts, no freighters.)
* **No colony-ship build policy.** The colony-ship design is deliberately excluded from every planet's build order (s5.8). Colony ships are **conjured for free** at a front planet (s3.4); the AI pays only the normal ship upkeep (cost/50 BC per turn per ship) once they exist.
* **Target order = ascending planet index** (= star id = row-major scan of the galaxy grid: top row left-to-right, next row, ...). Each target in turn claims the **nearest** stack of colony ships; the **entire orbit stack (every design, i.e. escorts too)** leaves for that one target.
* **Founding is automatic on arrival** (pop 2) for AI empires - no decision is taken (s3.7).
* Net effect (for balance): AI expansion speed is governed by (a) the random spawn rate (s3.9), (b) how many free in-range planets exist, (c) the 4-ship curse and the `flag_send_colony` throttle; it is *not* governed by planet quality. AIs settle poor/small/hostile worlds as readily as good ones, ignore enemy-held neighbourhoods, and fill the map in index order within fuel range.

### 3.2 Inputs the colonisation planner reads (snapshot, omniscient) [V]

`E.mods.colonyFor` (lowest planet-type index the empire can colonise: 7 = Minimal at start, down to 1 = Radiated via Planetology tech levels 3/6/9/12/15/18); the colony design slot (`shipi_colony`: the last design that carries a colony-base special) with its `colonyMin` threshold and Reserve-Fuel-Tanks flag; ship counts per design in every orbit and in every moving fleet; per star: owner, `typeIdx`, `E.frange[star]` (0 / 1 within fuel range / 2 within range + 3 parsecs, reachable only by designs with tanks), the Orion star + `S.guardian.alive`; `TP = E.flow.gross`; `S.settings.diffIdx`; `E.objective`; contact bits and territory centres (for fronts); "does any human empire have contact with me".

### 3.3 Fronts (they decide **where** free colony ships appear) [V: line-quoted]

1. `BS = P + 3` (P = highest owned PROPULSION tech level in {6,12,...,48}, else 0); `mergeRange = 10*BS + 10` map units.
2. Territory centre of every living empire = integer mean of its planets' x and y (0,0 if none).
3. For each other empire `o` in index order such that I have **contact** with `o` and (the game has not ended, or `o` is in the "refuse" set of a final war): front point = `((cx[o]*4 + cx[me]*6)/10, (cy[o]*4 + cy[me]*6)/10)` - i.e. 40% of the way from my centre toward `o`'s centre. If the point is within `mergeRange` (dist_fast) of any front already created, it is dropped; otherwise it becomes a new front with relation weight `min(0, relation1[me][o])`.
4. No fronts at all -> one dummy front at my own centre with relation weight 80 (so there is always >= 1 front).
5. Each front is anchored to a planet: first compute the nearest owned planet to the point (fallback, index 0 if I own nothing); then, among owned planets that are "defended", pick the nearest to the point. **"Defended" = the planet has at least one missile base, OR the first design slot (lowest index) that has ships in its orbit holds exactly ONE ship** (quirk: a planet with 2+ ships in that first stack and no bases does *not* qualify). If no planet is defended the fallback planet is used.
6. Fronts with the same anchor planet are merged (5 passes): relation weights add. (Force/relation weights matter only for idle-fleet staging, s8.5.)

Fronts are recomputed twice per turn (before colony ships and again before the attack planner); only the anchor list matters for colonisation.

### 3.4 Free colony ships - `have_colony_ship` [V: line-quoted]

Inputs: `slot = shipi_colony`; `count = total ships of that design anywhere (orbits + moving fleets)`.
1. Return **false** if there are no fronts, or no colony design (`slot == -1`), or `TP == 0`.
2. **Curse (BUG):** if `count > 3` (Classic; `ai_4_colony_curse_fix` off) -> return false (no spawn, and the caller then never sends). With the fix: if `count > 3` -> return true (send what exists, spawn nothing).
3. Pick one anchor planet uniformly: `rnd0(numFronts)` (this roll is consumed even when no spawn follows).
4. `prod = clamp(floor(TP*2/5), 1, 500)`.
5. Difficulty throttle: if `difficulty < Average (2)` and `rnd0(6) > difficulty` -> `prod = 0`. (Simple keeps the roll with probability 1/6, Easy 2/6.)
6. If **no colonisable planet exists anywhere** (`have_colonizable` false: no unowned planet with `typeIdx >= colonyFor`, excluding the Orion planet while the Guardian lives) **or** `rnd(500) > prod` -> **no spawn**; return `count > 0` (true if any colony ship already exists, so previously idle ships get dispatched).
7. Otherwise **spawn**: add one colony-design ship to the anchor planet's orbit and return true.
`flag_send_colony` (s1.3) is evaluated by the caller *after* this function, so spawning still happens while sending is suppressed (ships then accumulate toward the curse).

### 3.5 Dispatch - `send_colony_ships` [V: two reads + line-quotes of the helper]

Run only if `have_colony_ship` returned true and `flag_send_colony`.
1. `can_colonize` = the colony design's threshold (`colonyMin`; default Minimal = 7); **Silicoid: always Radiated (1)** (= every habitable type).
2. `range = fuel_range_parsecs * 15` map units (Classic only; i.e. 1.36x the real fuel range).
3. **Ignore set:** planets that are owned, or have `frange == 0`, or are the destination of one of my fleets that contains >= 1 colony-design ship.
4. **Candidate list (ascending planet index):** unowned, not ignored, not the Orion planet while the Guardian lives, `typeIdx >= can_colonize`. No sorting, no weighting.
5. Snapshot `orbitCount[i]` = my colony-design ships stationary at planet i.
6. For each candidate `t` in order: let `ok = (frange[t] == 1) or (frange[t] == 2 and the colony design has tanks)`; if not ok skip. Find the **nearest** planet `j` with `orbitCount[j] > 0` by `dist_fast` (strict "<", start 10000, so ties go to the lowest index). If none, skip. **Classic:** also require `dist_fast(t, j) <= range` (Classic+ does not). If the number of fleets in flight in the whole galaxy (all empires) is `>= 208` skip. Otherwise **send** (s3.6) from `j` to `t`. **Classic does not refresh `orbitCount`** after a send (source stays "occupied" in the local copy but the helper finds nothing to send, so later targets get nothing from that source this turn); **Classic+ refreshes it.** Net: each source stack serves exactly one target per turn.

### 3.6 The send helper - `game_turn_fleet_send` [V]

* For every design present in the source orbit: it joins the fleet unless the destination's range flag is 0, or 2 for a design without tanks. Speed = slowest design (Classic stargate: both ends mine with stargates -> gate speed). **All designs go**, so an escort of warships stationed at the colony-ship's planet travels with it (matches the v1.3 patch note "colony ships will usually travel with armed escorts").
* Classic BUG: ships in the source orbit that were *not* eligible (out of range / no tanks) are deleted anyway; fixed in Classic+ (they stay). **Do not replicate** the deletion.
* The helper also zeroes the planet's entry in the force table, so ships sent as escorts are not reused by the attack/defend/idle planners that turn.

### 3.7 Arrival and founding [V: GT::game_turn_explore]

Each turn, for every planet that is unowned and habitable (`typeIdx > 0`) and has an AI fleet in orbit containing a colony-design ship whose threshold `<= planet type` (Silicoid: any), the AI **founds the colony automatically**: owner set, pop 2, one ship consumed (the design with the lowest threshold); remaining ships and escorts stay in orbit and become a source stack for the next target. No check for enemy ships/monsters is made at this point (combat resolved earlier in the turn). Colony defaults: s2.2.

### 3.8 Environment, tolerance, hostile worlds, terraforming

* Thresholds: Standard Colony Base = Minimal; Barren (Planetology tech 3) = Barren; Tundra (6); Dead (9); Inferno (12); Toxic (15); Radiated (18) = Radiated. The AI's colony design always carries the **best colony base it owns** [V - the "newest item excluded" quirk of s5.4 does not bite here because the Battle Scanner, a non-colony special with a higher index, is owned from the start]. The design is only refreshed when the colony design is scrapped (aged > 50 turns before T100 / > 100 afterwards, or removed by the p2 rules), so a new colony tech can take up to that long to reach new colony ships [I].
* `have_colonizable` uses `colonyFor` (the empire's *tech* threshold), the dispatch uses the *design's* threshold - they can differ for a while after a new colony tech.
* **Silicoid:** tolerates every planet type from turn 1 (the original `can_colonize = RADIATED`), no waste, no soil/atmosphere/terraform techs (s2.8).
* **Hostile / poor / small worlds:** no special handling: they are ordinary candidates in index order.
* **Terraform / soil / atmosphere techs:** used automatically through the ECO slider chain (s2.8); the AI makes no project decisions.
* **Orion:** skipped while the Guardian lives; afterwards an ordinary candidate.

### 3.9 Spawn probability (derived) [I]

Per-turn spawn chance (Average and up, at least one colonisable planet exists, `count <= 3`): `p = clamp(floor(0.4*TP), 1, 500) / 500`.

| TP (BC/turn) | 55 | 100 | 150 | 200 | 300 | 500 | 800 | >= 1250 |
|---|---|---|---|---|---|---|---|---|
| p per turn | 4.4% | 8.0% | 12.0% | 16.0% | 24.0% | 40.0% | 64.0% | 100% |
| Simple (x1/6) | 0.7% | 1.3% | 2.0% | 2.7% | 4.0% | 6.7% | 10.7% | 16.7% |
| Easy (x2/6) | 1.5% | 2.7% | 4.0% | 5.3% | 8.0% | 13.3% | 21.3% | 33.3% |

TP includes the difficulty production multiplier (x1.25 / 1.5 / 2.0 at Average / Hard / Impossible), so harder AIs also spawn colony ships faster.

### 3.10 Edge cases and gotchas

* Initial colony ship: until the first `p2` run (turn 1..10) `shipi_colony` wrongly points at the Fighter design, so the real colony ship (slot 4) is not dispatched before turn `c2 + 1` (c2 = first p2 turn) [V from `new_game_init`; the exact consequence is derived].
* The colony stack that arrives and founds a colony leaves `count-1` colony ships behind; with the curse rule `count > 3` an AI that accumulates idle ships (spawned while nothing was in range) **stops expanding permanently** in Classic.
* `flag_send_colony == false` (non-Expansionist, > half of planets "developing", a human in contact) blocks dispatch but not spawning.
* The planet list is global: an AI will send a colony ship to a planet deep inside another empire's space if it is within the AI's fuel range of *any* of its planets and unowned. The Classic range check is measured from the *source stack*, not from the supply network.
* No re-targeting: a fleet already en route to a planet that gets colonised by someone else simply arrives and idles (becomes a normal stack).

### 3.11 Optional "competence upgrades" (NOT in the original; implement only behind an option)

(1) Score candidates (e.g. by expected max population for the race, specials, distance to own supply, enemy presence) instead of index order; (2) allow >1 target per source stack by splitting colony ships from escorts; (3) keep colony-ship spawn but cap spawn near planets with free targets in range. None of this is verified behaviour; the faithful default is s3.4-s3.7 exactly.

---------------------------------------------------------------------------------------------------

## 4. RESEARCH (field sliders, project choice, costs, trading/stealing)

### 4.1 Two-level allocation [V]

1. **How much** research: the planet TECH sliders (s2.3-2.7). Planet research = `spendable * TECH% / 100` (Psilon x1.5, Artifacts planet x2, Orion x4, cap 32767), summed over planets that are not under Plague/Nova -> the empire pool `E.research.total`.
2. **Where it goes:** six empire field sliders (sum 100). The AI never touches them except (a) at game start, (b) on the turns when `T % 10 == empire index`.
3. Each field accumulates RP independently into its current project; the first project per field is chosen at game start; later projects are chosen by `tech_next` the turn a project completes (s4.4).

### 4.2 Initial field sliders [V]

`n > 1` (another habitable planet within 30 map units): Computer 20, Construction 20, Force Field 0, Planetology 40, Propulsion 20, Weapon 0; otherwise Propulsion 100. With `n > 1` the home TECH slider is 0, so no RP is produced until the first p3 rebalance (turn 15..20) - the field sliders just wait.

### 4.3 The 10-year field re-roll [V: full code quoted]

Runs on turns where `T % 10 == empire index` (index 0..5; each AI therefore re-decides every 10 turns, staggered). All six sliders = 5, then exactly one field = 75:
1. If `T < 30` and `rnd0(2) == 1` (50%): **Propulsion**.
2. Else `focus = (rnd0(4) == 0)` (25%). If `focus`:
   Bulrathi or Mrrshan -> Weapon; Darlok -> Computer; Meklar -> `rnd0(2) ? Construction : Planetology`; Alkari -> Propulsion; Sakkra -> Planetology; (Human, Psilon, Silicoid, Klackon have no focus and fall through).
3. Else (no focus, or a race without one): `r = rnd(16)`; weight row = the objective row, or the **War row if the empire has any treaty >= War with anyone**; cumulative thresholds in this order: Computer `c4`, Construction `+c5`, Force Field `+c6`, **Propulsion `+c8`**, **Planetology `+c7`**, otherwise Weapon.

Effective probabilities of the step-3 roll (per 16):

| Row | Computer | Construction | Force Field | Propulsion (c8) | Planetology (c7) | Weapon (rest) |
|---|---|---|---|---|---|---|
| Diplomat | 2 | 2 | 4 | 3 | 2 | 3 |
| Militarist | 3 | 1 | 4 | 1 | 2 | 5 |
| Expansionist | 1 | 1 | 3 | 2 | 5 | 4 |
| Technologist | 4 | 2 | 3 | 2 | 2 | 3 |
| Industrialist | 1 | 5 | 4 | 2 | 1 | 3 |
| Ecologist | 1 | 2 | 4 | 5 | 1 | 3 |
| War | 2 | 2 | 4 | 1 | 2 | 5 |

(conflict / unverified) The 1oom source *comments* the columns as "...planetology, propulsion" for c7/c8 and uses c8 for Propulsion, c7 for Planetology - literal behaviour is as in the table. The manual says Ecologists focus on Planetology+Construction; under the literal mapping the Ecologist row favours **Propulsion 5/16** and Planetology only 1/16. If c7/c8 were swapped (c7 = Propulsion, c8 = Planetology) the table would match the manual (Ecologist Planetology 5, Expansionist Propulsion 5/Planetology 2). Recommended default: follow the code (as `js/ai/research.js` does); keep a config switch `AI_RESEARCH_SWAP78`.

Effective all-in probability for a race with a focus (e.g. Alkari, T >= 30): 25% Propulsion + 75% x row. Before T 30: 50% Propulsion first.

### 4.4 Choosing the next project - `tech_next` [V: code quoted]

* Candidate list (`game_tech_get_next_techs`; implemented as `Data.Techs.choiceList`): the not-yet-completed techs of the empire's own research list, scanned **tier 0 upward**, up to `maxtier = min((highest completed level - 1)/5 + 2, 10)` tiers (1 tier while only the first tech is done), 3 slots per tier, **at most 12 entries**; if the list is empty, the "advanced" fallback steps of 5 (levels 55, 60, ... up to 100). The list is ordered by tier ascending, so its **last entry is the highest-tier candidate** (note the 12-entry cap can cut off the top tiers when many low-tier techs are still open).
* Pick: `if rnd(6) < difficulty` -> the **last** candidate (highest tier); else a uniformly random candidate. So P(best) = 0 at Simple/Easy, 1/6 at Average, 2/6 at Hard, 3/6 at Impossible (computed as `P(rnd(6) < d)`).
* The pick is made the turn the previous project completes (and for all six fields at game start). There is no field/priority logic here: which *field* progresses fastest is decided only by the sliders (s4.3).
* At game start (`new_game_tech`) the first project of each field is a uniform pick among the first three entries of the tier-0 list (re-roll if 0) **without** the difficulty bias; cost = `level^2 * 50` (Classic quirk) instead of the normal AI cost (`ai_first_tech_cost_fix` removes it).

### 4.5 Costs and speed [V]

* AI project cost = `floor(level^2 * racialPercent * 20 / 100)` (racialPercent from the race x field table, e.g. 60..125). Human cost = `level^2 * racialPercent * costmuld[d] / 100` with costmuld = 20/25/30/35/40 (Simple..Impossible); so the human pays 1.0/1.25/1.5/1.75/2.0 x the AI's per-tech cost.
* RP application is common to AI and human (15% interest capped at 2x the slider's contribution; breakthrough chance `(invest - cost)*250/cost` out of 500 per turn; unfunded piles decay 10%/turn).
* Effective AI research speed relative to a human at equal slider shares: production multiplier x cost ratio = 1.0 / 1.0 / 1.875 / 2.625 / 4.0 (s6).

### 4.6 Tech trading and stealing preferences [V1/I - detail lives in sibling slice 05 s4.7, s5]

* **Stealing (AI spy -> any empire):** per successful mission the AI takes **one** tech: the first entry of a random list (up to 6 distinct entries, 500 attempts) drawn from techs the target has and the spy lacks; for 12 "tiered" groups (robotic controls, space scanner, reduced industrial waste, improved industrial tech, planetary shield, improved terraforming, controlled environment, eco restoration, personal armor/shield/weapons, fuel cells) a tech is excluded when the spy already owns an equal-or-higher tier of that group; Silicoid spies never take waste/environment/eco-restoration techs. A value function exists (level^2 x group multiplier 10/6/3/3, /4 if a better tech of that group is owned, Death Ray 30000) but the AI only uses it to drop zero-value entries - **there is no "steal the best tech" preference**. Level cap: techs with level above `max(spy d100 rolls) * target's highest field TL / 100` are removed.
* **AI-AI trading (`turn_diplo_p1`):** per AI pair, with probability `1/(15-2d)` per turn, and when `mood_tech + 80 < v` (`v = trust + relation1 + reldiff + rnd(100)`, +10 non-aggression, +20 alliance, +10 with trade) and both sides have a candidate, each gives one tech chosen **pseudo-randomly** (index `(T xor r) % n` over the fields in order, r = rnd(3), skipping the owner's r newest techs) - swaps are 1-for-1, with no tier or value preference.
* **AI sweeteners to the human:** BC = `((rnd(8)+rnd(8))*T/25)*25` (0 if above the reserve) and/or the first candidate tech of the same random list.

### 4.7 Reaction to being behind [V: absent]

None. The only catch-up mechanisms are the difficulty-scaled production/cost advantages and `tech_next`'s best-tier bias. The Guide's "AIs research one sector at a time with racial priority tables" (Table 11-8) is **not** what v1.3 does (s11).

---------------------------------------------------------------------------------------------------

## 5. SHIP DESIGN (selection rules by tech / race / threat; design-set management; build orders)

Objective and personality have **no** influence on design. Design depends on: the empire's owned components, the race hull offset, whether a human empire has Pulsars / Repulsor Beams / Warp Dissipators, and random rolls.

### 5.1 When and how often [V]

`p2_do` fires per empire on a countdown: first after `rnd(10)` turns (1..10), then every `rnd(12)+8` turns (9..20) ([Guide] says "every 6..15 turns, one new design" - (conflict) follow the code). Nothing triggers a redesign when new technology arrives. Each run: age/scrap -> remove at most one more design -> refill all six slots -> assign build orders.

### 5.2 Slot management [V]

1. `num_non0` = number of designs that have >= 1 ship anywhere (orbit or in flight). Roles are re-detected: `shipi_colony` = the last design carrying a colony-base special; `shipi_bomber` = the last design whose **first weapon bank holds a bomb**.
2. **Age scrap:** walk the designs in slot order while `num_non0 > 1`: scrap a design when `T < 100` and `T - year > 50`, or `T >= 100` and `T - year > 100`; each scrap does `num_non0 -= 1` even if the design had no ships (original BUG) and, in the original, the list shifts down so the next design is skipped. (The JS sim leaves holes instead of shifting, so simply scrap every aged design; effect negligible [I].)
3. Recount `num_non0`. **Remove one more:** if `num_non0 > 4`: remove the design with the smallest `year` (first on ties) *even if it has ships*; else if more than one design exists: remove the **first design with zero ships**; else none.
4. Scrapping a design destroys its ships everywhere and refunds 25% of `count*cost` BC into the empire reserve; planets building it fall back to design 0 (original) / the first valid design (JS sim).
5. **Refill** until six designs exist: the first missing role in the order **colony ship -> bomber -> fighter**. Because there is always exactly one colony design and one bomber design, every p2 run adds roughly one fighter-type design.
6. Re-detect `shipi_colony` / `shipi_bomber`; record the creation year of each new design (the JS design record has no `year`: keep it in the AI's own state).
7. Start state: slot 0 Scout, 1 Fighter, 2 Destroyer, 3 Bomber, 4 Colony Ship (armed colony ships optional), 5 empty; at the first run the empty Fighter/Destroyer/Bomber (no ships) are removed one per run and replaced by random designs.

### 5.3 Hull choice [V]

* Colony design: **Large**.
* Others: `v = rnd0(12) + offset(race)`, `v = max(v, 0)`, `+1` if any **human** empire owns a design with an Energy Pulsar or Ionic Pulsar, `v = min(v, 11)`, hull = `[Small, Medium, Medium, Medium, Large, Large, Large, Large, Large, Huge, Huge, Huge][v]`.
* Offsets: **+3** Silicoid, Bulrathi, Meklar; **-3** Alkari, Klackon; 0 others.

| Offset / pulsar | Small | Medium | Large | Huge |
|---|---|---|---|---|
| 0, no pulsar | 8.3% | 25% | 41.7% | 25% |
| 0, pulsar | 0 | 25% | 41.7% | 33.3% |
| +3, no pulsar | 0 | 8.3% | 41.7% | 50% |
| +3, pulsar | 0 | 0 | 41.7% | 58.3% |
| -3, no pulsar | 33.3% | 25% | 41.7% | 0 |
| -3, pulsar | 0 | 50% | 41.7% | 8.3% |

(derived [I]; [Guide]: "Alkari/Klackon smaller; Bulrathi/Meklar/Silicoid larger; larger after meeting Pulsars" - consistent.)

### 5.4 The tiered pick and the candidate window [V code; the exclusion is the 1oom reading]

**Tiered pick `tier(K, c)`:** given `K` ranked options (rank K = best) and a base chance `c` percent: draw `rnd(100)`; while the draw exceeds the current chance and more than one option remains: current chance doubles (uncapped) and the rank drops by one; redraw. Result: P(best) = c; P(next) = (1-c)*min(1,2c); ...; the lowest option takes the remainder. (Exactly reproduces the [Guide] Table 9-12 distributions, e.g. Shield/Medium 15/25.5/35.7/23.8; Computer/Small 10/18/28.8/34.6/8.6.) The first draw happens even when `K = 1`.

**Candidate window (1oom):** for engines, computers, ECM jammers, shields, maneuver and weapons the options are the **fitting items whose index is strictly below the newest owned item's index**, plus the "none" option (index 0) where the category has one. In other words the **newest owned item of each category can never be chosen** (kyrub's patch note "AI always uses one of their best engines" fixed only engines, and 1oom's Classic+ keeps this window too). Armor is the exception (below). This is marked `FIXME <= v ?` in 1oom for weapons. **(unverified against the original binary)**. Recommended: implement with a switch `AI_DESIGN_INCLUDE_NEWEST` (default false = faithful); with it on, ranks follow the [Guide] table literally.

Index mapping 1oom -> JS sim: weapons and specials `sim = 1oom - 1`; computers, ECM, shields `sim = 1oom - 1` with `-1` = none; engines, armor, hulls identical.

Per hull (Small, Medium, Large, Huge) base chances:

| Component | Small | Medium | Large | Huge |
|---|---|---|---|---|
| Engine (any hull) | 60 | 60 | 60 | 60 |
| Battle computer | 10 | 20 | 35 | 50 |
| Deflector shield | 5 | 15 | 40 | 70 |
| Maneuver | 30 | 20 | 20 | 15 |
| ECM jammer | 2 | 8 | 20 | 30 |
| Keep heavy ("II") armor | 1 | 2 | 4 | 8 |

### 5.5 Building one design (in order) [V: full function bodies quoted]

0. Start from a blank draft of the chosen hull (engine/computer/shield/jammer none, armor Titanium, man 0, no weapons, no specials).
1. **Engine:** options = fitting engines below the newest owned (a fit test installs the engine and checks that the hull still has >= 0 free space after the engines it needs); if there is no option (only Retro owned) the engine is Retro (index 0). `tier(K, 60)`. (Classic+: with >= 3 options re-picks with chance `45 + gap*15` when the two best candidate indices are < 3 apart; with exactly 2 options takes the best.) Result: with 60% the best candidate, else the second best.
2. `space = floor(freeSpaceAfterEngine / 3)`: after each of the next steps, if the draft's free space has dropped **below this baseline**, the base routine stops adding parts (components added so far stay).
3. **Colony design only:** special 0 = the best owned colony base that fits (Standard if none better); special 1 = Reserve Fuel Tanks if the empire's Construction tech level > 5.
4. **Computer:** options = {none} + fitting computers below the newest; `tier(K, chance[hull])`. Stop-check.
5. **Shield:** same with its table. Stop-check.
6. **Armor:** take the **best owned armor type** (highest index; each metal has a standard and a heavy "II" variant at the same tech level, so the highest index is a "II"). If that index is odd (heavy) it is kept only when `rnd(100) <= chance[hull]` (1/2/4/8%), otherwise the **standard variant of the same metal** (index with bit 0 cleared). The roll is consumed even when the index is even. Not subject to the candidate window or a fit test. (An early paraphrase listed a stop-check here; the line-quoted code shows none - treat as absent [V1].) **Colony design stops here** (steps 7-11 skipped).
7. **Special slots 0 and 1** (non-colony): candidate specials = owned, fitting, not duplicating another slot's exclusivity group, excluding Reserve Fuel Tanks and the colony bases; for each candidate in ascending index, roll `rnd(100) <= tbl_chance_special[special][hull]`; the **last success wins** (so higher-index devices dominate). After each slot a stop-check.
8. **Maneuver:** options = maneuver ratings `0..engineIndex-1` that fit; `tier(K, chance[hull])`. Stop-check.
9. **ECM jammer:** as the computer. (No stop-check.)
10. **Special slot 2:** same procedure as 7. (No stop-check.)
11. **`sub2` (large/huge only; runs after the base routine regardless of early stops):** if special slot 2 is empty and hull >= Large and a Battle Scanner is owned and fits -> slot 2 = Battle Scanner. Then if Propulsion tech level >= 30 and special slot 1 is empty and an Inertial Stabilizer is owned and fits -> slot 1 = Inertial Stabilizer (1oom flags the fit test as using the wrong slot: BUG, harmless).
12. **Weapons** (all designs including the colony ship, s5.6).
13. Finish: hit points from hull and armor; compact the weapon/special slots; cost; colony design gets the colony-ship name and, if it has no weapon, **one Laser**.

Special chance table `tbl_chance_special[special][hull]` (%, Small/Medium/Large/Huge; unlisted specials 0; sim index = list position):

| Special | S | M | L | H | | Special | S | M | L | H |
|---|---|---|---|---|---|---|---|---|---|---|
| Battle Scanner | 0 | 0 | 30 | 80 | | High Energy Focus | 10 | 20 | 25 | 35 |
| Anti-Missile Rockets | 0 | 10 | 50 | 80 | | Ionic Pulsar | 0 | 0 | 20 | 30 |
| Repulsor Beam | 0 | 0 | 25 | 80 | | Black Hole Generator | 0 | 0 | 20 | 40 |
| Warp Dissipator | 0 | 0 | 20 | 70 | | Sub Space Teleporter | 10 | 20 | 30 | 40 |
| Energy Pulsar | 0 | 5 | 20 | 60 | | Lightning Shield | 0 | 10 | 30 | 50 |
| Inertial Stabilizer | 20 | 30 | 50 | 80 | | Neutron Stream Projector | 0 | 0 | 30 | 60 |
| Zyro Shield | 0 | 10 | 40 | 70 | | Advanced Damage Control | 0 | 0 | 0 | 50 |
| Automated Repair | 0 | 0 | 25 | 50 | | Technology Nullifier | 0 | 10 | 20 | 30 |
| Stasis Field | 0 | 0 | 20 | 40 | | Inertial Nullifier | 10 | 20 | 40 | 60 |
| Cloaking Device | 20 | 30 | 40 | 70 | | Oracle Interface | 10 | 20 | 40 | 60 |
| Ion Stream Projector | 0 | 0 | 20 | 30 | | Displacement Device | 10 | 20 | 40 | 60 |

(Because the *last* successful roll wins and candidates are scanned in index order, late devices - Inertial/Oracle/Displacement, Technology Nullifier - displace earlier ones when they pass. [Guide]: "prefers Technology Nullifier, Oracle Interface, High Energy Focus" - broadly consistent.)

### 5.6 Weapons [V: line-quoted]

* `numshotsIgnore = rnd0(2) ? 2 : 5`: a design never uses both missile rack sizes - the 2-rack **or** the 5-rack variants (scatter packs included) are excluded for the whole design.
* Number of weapon banks: start 1; if `rnd(100) <= p2[hull]` -> 2, then if `rnd(100) <= p3[hull]` -> 3, then if `rnd(100) <= p4[hull]` -> 4 (nested). `p2 = 0/50/75/100`, `p3 = 0/0/50/100`, `p4 = 0/0/25/50` for Small/Medium/Large/Huge. -> Small 1 bank; Medium 1 (50%) or 2 (50%); Large 1/2/3/4 = 25/37.5/28.1/9.4%; Huge 3 (50%) or 4 (50%).
* Fill each bank `i` (0-based) with `(c1, c2)` from the table by bank count:

| banks | bank 0 | bank 1 | bank 2 | bank 3 |
|---|---|---|---|---|
| 1 | 100/100 | | | |
| 2 | 60/80 | 100/100 | | |
| 3 | 40/70 | 40/70 | 100/100 | |
| 4 | 40/60 | 40/60 | 60/80 | 100/100 |

* **Bank weapon choice:** candidates = all owned weapons (beams, missiles, torpedoes, **bombs and bio weapons included**) whose index is **below a cutoff** = the highest owned weapon index (`v`), decremented by one when this is bank 0, that top weapon is a bomb and the design is not a bomber (min 1). Remove candidates whose rack count equals `numshotsIgnore`, and - if a human empire has a Repulsor Beam or Warp Dissipator - all range-1 weapons; remove weapons already used in earlier banks; keep only those of which at least one fits. If at least one real candidate remains, the bank gets the **highest-index remaining weapon** (no randomness here). (Quirks: the bomb test looks only at the top weapon, so a lower-index bomb can still land in bank 0 of a fighter; the top weapon itself is never chosen.)
* **Count:** `floor(maxFit * (c1 + rnd(c2 - c1 + r)) / 100)` with `maxFit` = the largest count that still fits in the remaining space (cap 99) and `r = 41` when the weapon has `numfire > 0` or `nummiss > 0` else 11. In the 1oom data `numfire >= 1` for **every** real weapon, so `r = 41` always (unverified whether the original distinguished multi-fire/missile weapons). Consequence: the last (100/100) bank gets **101-141% of what fits** and 2-bank designs' first bank 61-121%: **AI designs can exceed hull space** and their cost/power include the surplus. The JS `design` order rejects designs with negative free space, so the planner must either clamp to `maxFit` (recommended default, slightly weaker than v1.3 [I]) or the sim must grant AIs an "overfill" exemption (flag `AI_DESIGN_OVERFILL`, not recommended).
* If bank 0 ends up with no weapon the whole design is rebuilt (hull re-rolled), up to 100000 times; against Repulsors/Dissipators: a failed Small hull retries unchanged, other hulls retry once with the range-1 restriction lifted.
* **Rejections** (rebuild from the hull roll): bank-0 weapon is a missile/torpedo (fixed damage: min == max) or a bomb and a **High Energy Focus** is fitted; or a missile and an **Oracle Interface** is fitted.

### 5.7 Adaptation to human designs [V]

Scanned over living **human** empires' designs at each p2 run: any Energy/Ionic Pulsar -> `+1` on the hull roll; any Repulsor Beam or Warp Dissipator -> drop range-1 weapons from new designs ([Patch] v1.3 note "AI compensates for Warp Dissipators").

### 5.8 Build-order assignment [V]

After refilling: sort the six slots by creation year, newest first, with the **colony design's year forced to 0** (stable sort: ties keep slot order). For **every owned planet** (not only new ones): if the planet has no Stargate, the empire owns Stargate technology, and `rnd0(2) == 1` -> build a **Stargate**; else `build = sorted[rnd0(3)]` (one of the three newest designs, independent per planet). `reloc` is never set. Between p2 runs planets keep building the same item (new colonies build slot 0 until the next run). [The first run after the start designs: the three newest are the two new designs plus whichever start design sorts next - possibly the Scout - (derived, depends on initial design years).]

### 5.9 Worked consequences [I]

* The AI always has exactly one colony design and one bomber design but only ~4 "fighter" designs; most planets build random fighter designs of random hull; some designs are tiny, some carry no shield or computer, engines are usually 1-2 tiers behind.
* The weapon choice makes AI ships carry the *second-newest* weapon by index; missiles are used in 2-rack or 5-rack form per design.
* Ship quality is therefore noisy and typically behind the human's best; difficulty does not improve designs (only production, base cost and tech cost).

---------------------------------------------------------------------------------------------------

## 6. DIFFICULTY - every AI handicap/cheat, where it applies, and what it does to the human

Difficulty index `d`: 0 Simple, 1 Easy, 2 Average, 3 Hard, 4 Impossible. **Higher levels do not make the AI smarter** - decisions are identical; they change economy numbers, a few probabilities and event/monster strength. No vision or movement cheat exists (the AI is omniscient at every level, s0.3).

### 6.1 Master table (v1.3 code via 1oom Classic) [V unless tagged]

| # | Item | Simple | Easy | Average | Hard | Impossible | Applied at (original) | Status in JS |
|---|---|---|---|---|---|---|---|---|
| 1 | **AI planet output multiplier** (integer math on `factories + pop term`, before reserve top-up) | x1.00 (no case in the switch: "simple has larger v than easy") | x0.80 (`v*4/5`) | x1.25 (`v+v/4`) | x1.50 (`v+v/2`) | x2.00 | `game_update_production` | done: `Colony.gross` x `Config.aiProdFactor` ('1oom' table) |
| 2 | **AI missile-base cost** (min 50 BC after discount; also scales base upkeep and base-upgrade cost) | 100% | 90% | 80% | 70% | 50% | `game_get_base_cost` | done: `Design.baseCost` (`AI_BASE_MUL`) |
| 3 | **AI tech cost factor** (`level^2 * racial% * f/100`) | 20 | 20 | 20 | 20 | 20 | `game_tech_get_next_rp` (`costmula`) | done: `Techs.costAI` |
| 4 | **Human tech cost factor** | 20 | 25 | 30 | 35 | 40 | same (`costmuld`) | done: `Techs.costHuman` |
| 5 | AI picks the **highest-tier** candidate with probability `P(rnd(6) < d)` | 0 | 0 | 1/6 | 2/6 | 3/6 | `tech_next` | done: `Research.aiPick` (also at game start - see s11) |
| 6 | Free colony-ship roll **kept** with probability `(d+1)/6` for `d < 2` | 1/6 | 2/6 | 1 | 1 | 1 | `have_colony_ship` | planner to do (s12 P30) |
| 7 | `need_conquer` chance per turn `1/(8-d)` (only when no colonisable planet exists) | 1/8 | 1/7 | 1/6 | 1/5 | 1/4 | `send_scout` | planner to do |
| 8 | AI tax (per mille of production, T >= 20) `rnd(10) + d + 2` | 3..12 | 4..13 | 5..14 | 6..15 | 7..16 | `turn_p1_tax` | planner to do |
| 9 | AI security base (tenths of %, T > 30) `8*d` (+ spy-driven part, cap 100) | 0 | 8 | 16 | 24 | 32 | `turn_p3` | planner to do |
| 10 | Base-saturation rule `bases*3 >= pop/(5-d)` (and bases > 4, shield up to date) -> bases >= pop/15, /12, /9, /6, /3 | 15 | 12 | 9 | 6 | 3 | `turn_p3` | done in `planets.js` (float division - s11) |
| 11 | Home start (**every** empire incl. human): pop / total_prod; factories always 30 | 50 / 55 | 50 / 55 | 50 / 55 | 40 / 50 | 40 / 50 | `game_generate_home_etc` | done: `Config.START_POP` |
| 12 | Random-event chance factor on (turns since last event)/512 | 1/2 | 2/3 | 3/4 | 4/5 | 1 | `game_event_new` | done: `Config.EVENT_DIFF_SCALE` |
| 13 | Event severity: plague `(rnd(8)+2d)*prod`; nova/comet years `rnd(5)+10-d`; comet HP `(rnd(5)+10+d)*25`; pirates HP `(rnd(5)+10+d)*30` | | | | | | `game_event_new` | events module |
| 14 | Diplomacy/aggression knobs: AI-AI contact roll `1/(15-2d)`; Erratic sudden war `d/300` per turn; treaty cancelling and pile-on wars only at `d >= 2`; "big empire" pressure divisor `size+6-d` | | | | | | `diplo_*` | sibling slice 05 s9 |
| 15 | Battle morale/retreat `v = (5-d)*5+5`; missile evade `rnd(3) < d` | | | | | | battle AI | sibling |
| 16 | Monster/Guardian HP by difficulty | | | | | | events | sibling |

**Not difficulty-dependent (verified negatives):** population growth, starting BC/reserve (none), spy strength and spy costs, scanner/vision/movement, ship design costs and maintenance (**no AI ship discount** - only missile bases are discounted), design quality, colonisation targeting, slider/research logic, starting fleet (2 scouts + 1 colony ship at every level; the claim in the manual/LP that fleet size scales with difficulty is not in the code - (conflict)), decision frequency of p2/p3, tax/reserve mechanics other than the added `d`.

### 6.2 Where the "cheating" bonuses enter the pipeline

1. **Production x** - per planet inside `Colony.gross`: `floor((operating factories + pop*(3*PlanetologyTL+50)/100 [x2 Klackon]) * factor)`, **then** `+ min(planet reserve, that)`. So it multiplies the SHIP/DEF/IND/ECO/TECH budgets alike, the AI's research points and `TP` (hence the colony-ship spawn rate). It does **not** touch trade income; tax and security are percentages of the already multiplied gross; ship/base/gate upkeep are fixed BC amounts that are *not* multiplied, so the AI's net-to-gross ratio is better than a human's at the same fleet size.
2. **Base cost** - one function, used for building bases (DEF slider), upgrading them and for base upkeep.
3. **Tech cost / best-tier pick** - research only.
4. **Spawn throttle / need_conquer / tax / security** - AI planners (new).
5. **Start pop/production** and **event factors** - setup/event modules (already global, apply to the human too).

Net research advantage of an AI over a human with identical slider shares: production x cost ratio = 1.0 / 1.0 / 1.875 / 2.625 / 4.0 (Simple..Impossible); net production advantage = 1.0 / 0.8 / 1.25 / 1.5 / 2.0 (plus the upkeep leverage). **Easy is *weaker* than Simple in production** (0.8 vs 1.0) - an original oddity ([Guide] table 15-1 would make production -20/-10/0/+25/+50% and the AI research factor 30 - (conflict): the code values above are the shipped v1.3 behaviour; `Config.AI_PROD.guide` keeps the alternative).

### 6.3 What difficulty does to the human player

Tech costs (x1.0..2.0 of the AI's); Hard/Impossible start with 40 pop instead of 50 (and 50 instead of 55 initial production) for **all** empires; event frequency and severity; monster strength; AI diplomacy/aggression toggles (s6.1 rows 12-16). Nothing else.

### 6.4 Proposed `Data.Config` layout for the planners (aiMod by difficulty)

(arrays indexed by difficulty 0..4; the existing keys are shown for orientation)

* `AI_PROD['1oom'] = [100, 80, 125, 150, 200]` (exists), `AI_BASE_COST = [100, 90, 80, 70, 50]` (read by `Design.baseCost`; default exists), `techCostAI = 20`, `techCostHuman = [20, 25, 30, 35, 40]` (exist in `Data.Techs`).
* New `AI_DIFF = { techBestRollBelow: [0,1,2,3,4] /* best tier iff rnd(6) < value */, colonySpawnKeepOf6: [1,2,6,6,6], needConquerDen: [8,7,6,5,4], taxAdd: [2,3,4,5,6] /* + rnd(10) */, securityAdd: [0,8,16,24,32], baseSatDiv: [5,4,3,2,1] }`.
* Race hooks stay in `Data.Races.*.ai` (hull, shipSlider, indSlider, techSlider, ecoSlider, researchFocus, alwaysSpy, ...).

---------------------------------------------------------------------------------------------------

## 7. OBJECTIVE, PERSONALITY AND RACE: assignment and exactly what each changes

### 7.1 Assignment at game creation [V: tables read twice]

* Races: the human's race is excluded; each AI draws uniformly among unused races (original: `race_tbl[rnd0(10)]` with re-draw if an earlier player has it); banners likewise.
* **Personality (trait1)** for **every** empire including the human: `table1[race][rnd0(10)]`; **objective (trait2)** for AI empires only: `table2[race][rnd0(12)]` (the sim gives the human objective 0, unused). Draw order in the original: all objectives first, then personalities.
* A leader coup re-rolls **both** traits uniformly (`rnd0(6)` each, objective first), regardless of race tables; it triggers when rebel planets >= `(planets+1)/2` (`game_turn_coup`).

| Race | Personality distribution (of 10) | Objective distribution (of 12) |
|---|---|---|
| Human | Honorable 7, Pacifistic 2, Erratic 1 | Diplomat 5, Industrialist 2, Technologist 2, Militarist 1, Expansionist 1, Ecologist 1 |
| Mrrshan | Ruthless 7, Aggressive 2, Xenophobic 1 | Militarist 4, Technologist 3, Expansionist 2, Diplomat 1, Industrialist 1, Ecologist 1 |
| Silicoid | Xenophobic 7, Aggressive 2, Erratic 1 | Expansionist 4, Technologist 3, Industrialist 2, Diplomat 1, Militarist 1, Ecologist 1 |
| Sakkra | Aggressive 7, Erratic 2, Ruthless 1 | Expansionist 5, Technologist 2, Ecologist 2, Diplomat 1, Militarist 1, Industrialist 1 |
| Psilon | Pacifistic 7, Erratic 2, Honorable 1 | Technologist 5, Diplomat 2, Industrialist 2, Militarist 1, Expansionist 1, Ecologist 1 |
| Alkari | Honorable 7, Pacifistic 2, Erratic 1 | Expansionist 4, Militarist 3, Technologist 2, Diplomat 1, Industrialist 1, Ecologist 1 |
| Klackon | Xenophobic 7, Aggressive 2, Ruthless 1 | Ecologist 4, Militarist 2, Expansionist 2, Technologist 2, Diplomat 1, Industrialist 1 |
| Bulrathi | Aggressive 7, Erratic 2, Ruthless 1 | Ecologist 5, Technologist 3, Expansionist 2, Diplomat 1, Industrialist 1, Militarist 0 |
| Meklar | Erratic 7, Aggressive 2, Xenophobic 1 | Industrialist 4, Technologist 3, Expansionist 2, Diplomat 1, Militarist 1, Ecologist 1 |
| Darlok | Aggressive 7, Ruthless 2, Xenophobic 1 | Technologist 4, Diplomat 3, Industrialist 2, Militarist 1, Expansionist 1, Ecologist 1 |

(conflict) The [Guide]/manual lists 60/20/20 personality splits and primary objectives Alkari = Militarist, Klackon = Industrialist, Darlok = Diplomat; the shipped v1.3 tables above disagree for exactly those three races (and in the secondary traits). kyrub's 1.40 notes say "races now start with the appropriate objective", i.e. v1.3's table was considered wrong. Default: use the v1.3 tables (as `data/races.js` does); option: switch to the manual's primaries.

### 7.2 What the OBJECTIVE (trait2) changes - the complete list [V]

1. **Planet slider weight row** (s2.4) - the dominant effect; **War row** replaces it whenever the empire has any treaty >= War with anyone.
2. **Tech-field weight row** (s4.3), same War-row rule.
3. **Expansionist only:** skips the colony-ship throttle `flag_send_colony` (s1.3); breaks alliances with probability 5/8 (others 1/4) and non-aggression pacts with certainty (others 1/2) when it wants to attack a treaty partner's planet, and in the "wage war" routine.
4. **Militarist or Expansionist** (and personality not Honorable): the "fleet envy" war check (1/20 per turn, fires when `relation - fleet_w + reldiff + trust < -150`) - sibling slice.
5. **Nothing else:** objective does not alter ship design, colonisation targeting, taxes, spies (the [Guide]'s per-objective spy ratings are design intent only), research *within* a field, or build choices.

### 7.3 What the PERSONALITY (trait1) changes [V: all uses of trait1 listed]

Personality is **diplomacy-only** - it never touches sliders, research, colonisation or design.
* `reldiff[trait1]` = Xenophobic -50, Ruthless -30, Aggressive -20, Erratic 0, Honorable +10, Pacifistic +20: added to the AI's willingness score in treaty acceptance, proposals, war checks, "gone" checks, threats (x2).
* Honorable: negative diplomatic changes x2; trust penalty for breaking treaties x2; never runs the fleet-envy check.
* Xenophobic: negative changes x1.5, positive x0.75.
* Erratic: sudden war chance `rnd(300) <= d` per turn per target (Simple never).
* Only Aggressive/Erratic/Honorable/Pacifistic (trait1 > Ruthless) make unsolicited offers/sweeteners.
* First-contact message type = trait1 + 14.
([Guide] Table 11-4/11-7: Pacifist +20, Honorable +10, Aggressive -10, Ruthless -30, Xenophobic -50, Erratic random +/-40 and base attack chance 50% reversed by the modifier - (conflict) with the v1.3 code above; sibling slice 05 s3.1 documents the code.)

### 7.4 Race-specific AI logic [V]

| Race | Slider tweak at each rebalance | 25% research focus | Hull offset | Other AI-relevant facts |
|---|---|---|---|---|
| Human | - | - | 0 | +50 added to AI diplomacy scores toward a Human-race empire; positive acts x2 (diplomacy) |
| Mrrshan | SHIP +15 | Weapon | 0 | auto-resolve battle weight +15 (Classic) / +20 (Classic+) |
| Silicoid | - (ECO never reset: accumulates) | - | +3 | settles every planet type; no waste, no soil/atmosphere/terraform techs |
| Sakkra | ECO +10 while `pop < max_pop2` | Planetology | 0 | |
| Psilon | TECH +20 | - | 0 | research x1.5 (rules); [Guide] spy rating +10 (code ignores) |
| Alkari | - | Propulsion | -3 | auto-resolve weight +15 / +20 |
| Klackon | ECO +15 while `pop < max_pop2` | - | -3 | pop output x2 (rules) |
| Bulrathi | ECO +10 while `pop < max_pop2` | Weapon | +3 | invasion/bombing estimate x1.2 (Classic) / x2.15 (Classic+) |
| Meklar | IND +20 | Construction or Planetology (50/50) | +3 | +2 operated factories per pop (rules) |
| Darlok | - | Computer | 0 | always rolls espionage (no 50% gate); spy hiring cost x0.5; +30/+20 Computers in spy attack/defence rolls |

Also per race but not AI-specific (rules slice): racial research cost percentages (`tcostm` table), growth/production/ground bonuses, `rich`/`artifacts` planet interplay.

### 7.5 Initial attitudes (diplomacy seed)

Start relation between races = table value x 12 (everyone +12 toward Humans; Mrrshan-Alkari -36, Mrrshan-Sakkra -24, Darlok -12 toward all but Humans; Silicoid-Klackon -12 [1oom]); full matrix in sibling slice 05 s3.3 and `Data.Races.RELATIONS`.

---------------------------------------------------------------------------------------------------

## 8. PRODUCTION PLANNING, SCOUTING, FUEL RANGE, AND THE MILITARY-ADJACENT P1 ROUTINES

### 8.1 Scouting - `send_scout` [V: 2 reads + line quotes]

Runs every turn for every AI, first in p1.
1. **Ignore set:** planets I have already explored; planets with `frange == 0`; planets with a **non-allied foreign ship in orbit**; destinations of any of my fleets in flight. (A "T < 150 and Orion" clause exists but is redundant: Orion is excluded from the candidate list below anyway.)
2. `have_colonizable` = any unowned planet with `typeIdx >= colonyFor` (Orion excluded while the Guardian lives); `need_conquer` = `rnd0(8-d) == 0` and **cleared** if `have_colonizable` or the game has ended. (`need_conquer` only widens the attack-target list in s8.5.)
3. **Scout targets** = unowned planets that are not ignored and not the Orion planet, in ascending planet index.
4. For each target: source = the nearest planet (by `dist_fast`, strict "<", ties -> lowest index, start 10000) where I currently have **any ship** (`orbitCount > 0`, counting every design). If none: next target. If >= 208 fleets in flight galaxy-wide: skip.
5. **Design choice** at the source: scan designs in slot order among those with ships; the first one is taken; a later design replaces the current choice only while the current choice has **no reserve-fuel tanks** (so: the first design with tanks if any, else the last design present). If the target's `frange` is not 1 and not (2 with tanks) -> skip this target.
6. Send `floor(n/4) + 1` ships of that design (n = stack size at the source) - one fleet per target; update the local counts. Fleet speed = that design's warp.
So the two start scouts go to the two lowest-index unexplored in-range planets on turn 1; afterwards scouts hop from where they sit to the nearest unexplored planet; if only warships remain at a planet, they will scout too (a quarter + 1 of the stack).

### 8.2 Fuel range and expansion logic [V/I]

The AI does not manage range or scanners directly. Range grows with Propulsion tech (fuel range 3 -> 4 (tech 3), 5 (5), 6 (9), 7 (14), 8 (19), 9 (23), 10 (29), unlimited 30 (41)); `frange` flag 2 = within range + 3 parsecs (needs tanks). The AI pushes range by: the 50% Propulsion-75 roll before T 30, the Alkari racial focus, the Expansionist Planetology/Propulsion weights, the isolated-start 100% Propulsion setting, and by giving colony designs Reserve Fuel Tanks once Construction TL > 5 (the start Scout also has tanks).

### 8.3 Production planning - what the AI actually builds [V/I]

* **Warships:** purely SHIP% of each planet (s2.4) -> ships of that planet's `buildship` (one of the three newest designs). No per-empire fleet-size or ratio-to-enemy target exists in the economy code. Expected military share of a mature planet's output: 7.7% (Diplomat/Technologist/Industrialist/Ecologist) to 10.4% (Expansionist) to 15.8% (Militarist, War row); +15% Mrrshan, +10% on Rich/Ultra-Rich/4X planets; 100% under threat or when the base-saturation bug fires.
* **Scouts, colony ships, transports:** never built (s8.1, s3, s2.11).
* **Defence:** DEF% buys planetary shield first, then missile bases; once `bases > 4` and the saturation ratio holds, DEF becomes SHIP (s2.5). Expected DEF share of a mature planet 7.7-15.8% (Expansionist highest).
* **Stargates:** each p2 run, 50% of planets lacking one (when the tech is owned) are set to build a 3000 BC Stargate.
* **Designs:** s5. **Reserve:** s2.6/2.10.
* The AI has no notion of "enough" ships: spending continues at the slider share every turn.

### 8.4 The `bestspeed` terms (map units) [V]

`BS = P + 3` where `P` = highest owned PROPULSION tech level in {6,12,...,48} (0 if none): front merge range `10*BS+10`; idle-fleet staging `20*BS+20`; defend-reinforcement range `30*BS+20`; invasion transports `30*BS+30`; population relocation `20*BS+20`; colony dispatch range (Classic) `fuel_range*15`; attack range `fuel_range*15`.

### 8.5 Military-adjacent p1 routines (summary; the sibling slice owns the detail) [V1]

* **Ship threat per design:** `sum over non-bomb weapon banks (weapon tech level * count) + (if any such weapon) ((shield index + 10) * hp / 50) + sum over specials with index >= Battle Scanner (tech level * 2)`; x2 for AI designs after the first council election and x2 again in a final war; Classic masks to 16 bits; monsters weigh 1800 per design.
* **Planet rating (`planet_w`):** `v4 = (special-2)*20 + special*10 + 20` with special 0..6 -> -20, 10, 40, 70 (Artifacts), 100 (Rich), 130 (Ultra-Rich), 160 (4X/Orion). Own planet weight = `pop - 5*bases + v4`; enemy planet weight = `pop - 10*bases + v4`. Enemy targets = planets of empires I am at war with (or any if `need_conquer` / game ended), within range flag 1, with type >= `colonyFor`, and the Orion planet only after T 120; sorted by weight descending.
* **Attack:** per front, the first target (in weight order) within `fuel*15` units that passes `rnd(100) < 40` (or is the only target) and whose defence (enemy ship threat + `(weaponTL*5 + (shield+10)*10) * bases`) is below my force there; attacking a planet of a treaty partner first breaks the treaty (alliance 1/4, 5/8 Expansionist; NAP 1/2, certain for Expansionist). Second pass: any foreign planet where I have force: `rnd(100) < 60` and `1.5 * force > hull-weight defenders`.
* **Defend:** threatened = incoming enemy fleets/transports (threat) vs `4/3 * own force`; flat 50 for planets with < 5 bases and no ships; reinforce within `30*BS+20` when `5/3 * threat < force`.
* **Idle:** stacks stronger than `force_own_sum/25` (halved after a council election, halved again in a final war) move to the front planet minimising `dist*10/(20*BS+20) + front relation`, only while < 8 fleets are in flight.
* **Transports:** s2.11. **Panic funding:** s2.6.

### 8.6 Orion / Guardian [V]

Colony ships and scouts never target the Orion planet while the Guardian lives; it is an attack target only after T 120.

---------------------------------------------------------------------------------------------------

## 9. AI PLAYBOOKS (derived from the verified rules; [I] unless stated)

### 9.1 Common arc of every AI (Average difficulty, at least one neighbouring planet)

* **Opening (turns 1-20):** home sliders SHIP 10 / IND 90; no research until the first rebalance; two scouts out on turn 1; the real colony ship waits for the first design run (turn <= 10); free colony ships appear at ~4-8% per turn; planets build whatever design the first p2 run assigns with a 10% ship share; tax 0 until turn 20.
* **Early expansion (turns 20-100):** free colony ships go to the lowest-index free planets within fuel range (nearest ship first), new colonies start 100% industry then the 5/5/50/x/25 young-planet profile; research starts turn 15-20 at ~25-35% of output; each AI re-aims research every 10 turns (50% Propulsion first until turn 30); designs refresh every 9-20 turns; defence is a 5%+ DEF share building shields then bases.
* **Mid game (100-200):** colony spawning continues while free in-range planets exist (rate grows with TP); mature planets max their factories and flip IND to DEF+TECH; AIs with `need_conquer` or wars start choosing enemy planets as targets; pop transports shuttle colonists to low-pop colonies; design ages reach 100 turns; Orion becomes attackable at turn 120.
* **Late game:** planets with > 4 bases at the saturation ratio dump DEF into SHIP (Classic: doubling ships every turn -> huge fleets); tax/security stay tiny; research focus keeps rotating; no strategic planning beyond fronts, colony spawn and slider dice.

### 9.2 By objective (trait2)

| Objective | Slider tendency (mature / young planet) | Research tendency (per 16) | Expansion / treaties | Manual's description ([Guide]/fan wikis) |
|---|---|---|---|---|
| **Diplomat** | SHIP 8 / DEF 10 / IND 21 / ECO 31 / TECH 30 ; young IND 55 | FF 4, Prop 3, Weapon 3, Comp/Constr/Planet 2 each | default colony throttle; no treaty-breaking bonus | trade with friends, spy on enemies, balanced economy |
| **Militarist** | SHIP 16 / DEF 8 / IND 15 / ECO 25 / TECH 36 | Weapon 5, FF 4, Comp 3, Planet 2, Prop 1, Constr 1 | war checks (1/20 per turn) | big fleets, weapons first |
| **Expansionist** | SHIP 10 / DEF 16 / IND 13 / ECO 23 / TECH 39 | Planetology 5, Weapon 4, FF 3, Prop 2, Comp 1, Constr 1 (c7/c8 caveat s4.3) | never throttles colony ships; breaks NAP always and alliances 5/8 of the time when it wants a partner's planet; war checks | colonise as much as possible, propulsion + planetology |
| **Technologist** | SHIP 8 / DEF 10 / IND 18 / ECO 28 / TECH 36 | Comp 4, FF 3, Weapon 3, Constr/Planet/Prop 2 | default | research above all; weak fleets |
| **Industrialist** | like Diplomat (SHIP 8 / DEF 10 / IND 21 / ECO 31 / TECH 30) | Construction 5, FF 4, Weapon 3, Prop 2, Comp 1, Planet 1 | default | factories first, then may turn aggressive |
| **Ecologist** | SHIP 8 / DEF 8 / IND 15 / ECO 25 / TECH 44 (research-heaviest) | Prop 5, FF 4, Weapon 3, Constr 2, Comp 1, Planet 1 (literal c8 mapping; swap -> Planetology 5) | default | clean/grow planets (the code's ecology weight is a copy of industry's, so ecology is not emphasised) |
| *War row (any empire at war)* | SHIP 16 / DEF 8 / IND 13 / ECO 23 / TECH 41 | Weapon 5, FF 4, Comp 2, Constr 2, Planet 2, Prop 1 | - | overrides the objective while any treaty >= War exists |

(Sliders: expected final values for a mature planet with ecology floor 20 and not yet factory-maxed, from s2.4; once factories are maxed IND is split into DEF/TECH every turn.)

### 9.3 By personality (trait1) - diplomacy only

| Personality | reldiff | Numeric quirks | Typical behaviour (code) | Manual |
|---|---|---|---|---|
| Xenophobic | -50 | negative acts x1.5, positive x0.75; makes no unsolicited offers | hardest to please, most wars | hard to please, ends at war with everybody |
| Ruthless | -30 | makes no unsolicited offers | opportunistic | attacks with little provocation, sacrifices ships |
| Aggressive | -20 | - | attacks when it judges itself stronger | attacks when favourable |
| Erratic | 0 | sudden war `rnd(300) <= d` per turn per target | unpredictable | random swings |
| Honorable | +10 | losses x2; trust penalty x2 for breaking treaties; never runs the fleet-envy check | keeps treaties, punishes backstabbers | keeps its word |
| Pacifistic | +20 | - | peace-loving | rarely attacks |
Economy: **none** of the six touches production, research, colonisation or design.

### 9.4 Race archetypes (default personality + objective + race tweaks)

Human (Honorable Diplomat) - balanced, diplomacy-favoured. Mrrshan (Ruthless Militarist) - ships +15%, weapons focus. Silicoid (Xenophobic Expansionist) - settles anything, big hulls, no waste. Sakkra (Aggressive Expansionist) - ecology push, planetology focus. Psilon (Pacifistic Technologist) - research +20%, best researcher. Alkari (Honorable Expansionist/Militarist) - small hulls, propulsion focus. Klackon (Xenophobic Ecologist/Industrialist) - small hulls, ecology push. Bulrathi (Aggressive Ecologist) - big hulls, weapon focus, strong invasions. Meklar (Erratic Industrialist) - factory-heavy sliders, big hulls. Darlok (Aggressive Technologist/Diplomat) - computer focus, aggressive spying.

---------------------------------------------------------------------------------------------------

## 10. TUNING CONSTANTS (every number found; all [V] unless tagged)

| Area | Constant | Value | Source function |
|---|---|---|---|
| Timers | p2 first countdown | `rnd(10)` | `new_game_init` |
| | p2 reset | `rnd(12) + 8` (9..20) | `turn_p2_do` |
| | p3 first countdown | `rnd(6)+14` (>= 1 neighbour within 30 units) / `rnd(6)+24` | `new_game_init` |
| | p3 reset | `rnd(5)+1` (2..6) | `turn_p3` |
| | research re-roll | `T % 10 == empire index` | `turn_p3` |
| | tax / spy start | T >= 20 / T > 30 | `turn_p1_tax`, `turn_p3` |
| | neighbour test | type >= Minimal within 30 map units (home counts) | `new_game_init` |
| | idle-fleet gate | fewer than 8 own fleets in flight | `turn_p1` |
| | fleets in flight cap | 208 (AI dispatch), 260 (all); transports 100 | `game_types.h` |
| Sliders | floors | SHIP 5 if ECO<96; DEF 5 if <91; IND 10 if <81; TECH 25 if <71 | `turn_p3` |
| | young planet | `pop < max_pop3*3/4` -> IND 50 | `turn_p3` |
| | racial adds | Mrrshan SHIP+15; Meklar IND+20; Psilon TECH+20; Bulrathi/Sakkra ECO+10; Klackon ECO+15 (pop < max_pop2) | `turn_p3` |
| | special adds | Artifacts/4X TECH+20; special >= Rich: IND+20, SHIP+10 | `turn_p3` |
| | chunk dice | `r1 = rnd(13)`, `r2 = min(left, rnd(8)+2)` | `turn_p3` |
| | weight rows | s2.4 table | `ai_p3_tbl_w` |
| | factories maxed | `factories >= pop*oper`: DEF += IND/2, TECH += IND - IND/2, IND = 0 | `turn_p3` |
| | base saturation | bases > 4 and `bases*3 >= pop/(5-d)` (int div) and shield >= level: SHIP += SHIP (Classic) / += DEF (fix), DEF = 0 | `turn_p3` |
| | panic | SHIP += DEF+IND+TECH; others 0; planet reserve += empire reserve/5 | `build_defending_ships` |
| | developing | `pop < 20` -> reserve/5 each | `fund_developing` |
| | event cranks | plague/nova -> TECH; comet/pirates -> SHIP; reserve/5 | `crank_tech/ship` |
| Finance | tax | `rnd(10)+d+2` per mille, T >= 20 | `turn_p1_tax` |
| | tax -> reserve | `TP*tax/2000` per turn (half of the tax) | `game_turn_reserve` |
| | planet reserve drain | `spendable/2` per turn; adds up to its size to output | `game_turn_reserve`, `game_update_production` |
| | security | `rnd0(2)*spiesOnMe + 8d`, cap 100 (tenths %) | `turn_p3` |
| | spying | `rnd(5)+5` tenths %; AI targets gated `rnd0(3)==0`; espionage if `rnd(200) > 2*rel+200`; Darlok skip the 50% gate | `turn_p3`, `turn_p3_sub1` |
| | spy cost | `2*computerTL + 25` BC (Darlok /2), doubling per spy within a turn | `game_spy_build` |
| Colonisation | spawn | `prod = clamp(TP*2/5, 1, 500)`; fail if `rnd(500) > prod` | `have_colony_ship` |
| | throttle | `d < 2` and `rnd0(6) > d` -> `prod = 0` | `have_colony_ship` |
| | curse | colony-design ships anywhere `> 3` -> stop | `have_colony_ship` |
| | colony pop | 2 | `game_turn_explore` |
| | dispatch range (Classic) | `fuel_range * 15` map units | `send_colony_ships` |
| | front point | 40% toward rival centre; merge range `10*BS+10`; dummy relation 80 | `turn_p1_front` |
| | scouts | `n/4 + 1` ships per target; `need_conquer = rnd0(8-d)==0` | `send_scout` |
| | Orion | attack target only after T 120 | `planet_w` |
| Transports | invasion | source `pop >= max_pop3/2` and `pop > 20`; send `pop/2`; range `30*BS+30` | `trans_en` |
| | relocation | source `pop > max_pop3*3/4`; dest `pop < max_pop3/3` or rebellion; send `pop/3`; range `20*BS+20` | `trans_own` |
| Research | field sliders | 5 each, one 75; T<30: 50% Propulsion; focus 25%; `rnd(16)` | `turn_p3` |
| | tech pick | `rnd(6) < d` -> last candidate, else uniform | `tech_next` |
| | candidate list | <= 12 entries, tiers up to `min((maxLevel-1)/5+2, 10)`; advanced fallback 55..100 step 5 | `game_tech_get_next_techs` |
| | cost | AI `level^2*racial%*20/100`; first project `level^2*50` (Classic) | `get_next_rp`, `new_game_tech` |
| Design | slots | 6; roles colony, bomber, fighters | `turn_p2_do` |
| | scrap age | > 50 (T < 100) / > 100 (T >= 100) while `num_non0 > 1` | `turn_p2_do` |
| | forced removal | if `num_non0 > 4` the oldest, else the first empty design | `turn_p2_do` |
| | hull | `rnd0(12)+offset`, clamp 0, +1 pulsar, clamp 11, table `S,M,M,M,L,L,L,L,L,H,H,H`; offsets +3/-3 | `design_ship` |
| | tier chances | engine 60; computer 10/20/35/50; shield 5/15/40/70; maneuver 30/20/20/15; ECM 2/8/20/30; keep-II armor 1/2/4/8 | `design_ship_base` |
| | space baseline | `freeAfterEngine / 3` | `design_ship_base` |
| | special chances | table s5.5 | `tbl_chance_special` |
| | weapon banks | p2 0/50/75/100; p3 0/0/50/100; p4 0/0/25/50 | `design_ship_weapons` |
| | bank shares | `(c1,c2)` table s5.6; `r = 41` (every real weapon) | `design_ship_weapon(s)` |
| | missile racks excluded | 2 or 5 (coin flip) | `design_ship_weapons` |
| | stargate build | 50% of planets without one | `turn_p2_do` |
| | build choice | 1 of 3 newest designs, colony design aged 0 | `turn_p2_do` |
| Difficulty | see s6.1 | | |

---------------------------------------------------------------------------------------------------

## 11. COMPARISON WITH THE CODE ALREADY IN THE REPO, QUIRKS, CONFLICTS, GAPS

### 11.1 `js/ai/planets.js` (step 50) versus this spec

| # | Spec (1oom Classic) | `planets.js` | Impact | Fix |
|---|---|---|---|---|
| 1 | At every rebalance non-Silicoid planets get **ECO forced to the waste-neutralising floor first**; ECO then receives only the racial add + random chunks | Uses the *stored* `s[3]` as the base ("already holds the waste floor") - but the stored value includes the previous rebalance's random ECO chunks, so ECO **ratchets up** every 2-6 turns (fixed point ~55% on mature planets) | **High**: AI over-invests in ecology, starves IND/TECH/SHIP; contradicts the spec | base ECO = `Colony.ecoFloorPct(S,E,p)` for non-Silicoids; keep the stored ECO only for Silicoids (faithful quirk, s11.5 #9) |
| 2 | Totals may exceed 100 on the rebalance turn (young planets with ECO > 15, Meklar, Rich/Artifacts planets): a free over-spend; then TECH := remainder | `normalise()` trims TECH, IND, DEF, SHIP to exactly 100 | Low (<= 5-25% on special planets, one turn); also the `sliders` order requires sum == 100 | acceptable; optional `slidersRaw` order |
| 3 | Saturation (bases > 4 ...) Classic: `SHIP += SHIP` (doubling bug); fix: `SHIP += DEF` | Implements the fix (`s[0] += s[1]`) | Intended; Classic fleets-explosion absent | add config `AI_FLEET_CHEAT_BUG` if wanted |
| 4 | `pop/(5-d)` is integer division | float division | negligible | `Math.floor` |
| 5 | `special >= Rich` includes 4X-Tech (Orion): IND+20, SHIP+10 | only `rich`/`ultrarich` | negligible (one planet) | add `'orion'` |
| 6 | p1 "panic" sliders (and developing-planet funding) are applied **before** p3 each turn and the factory/saturation checks read the *current* sliders | reads snapshot sliders only; a later `sliders` order for the same planet overwrites any earlier panic order from step 40 | Medium once the military/panic planner exists | share an overlay (`ctx.sliderOf(p)`) or merge panic into step 50 |
| 7 | Silicoid: ECO not reset, no end-of-turn TECH normalisation | normalise() applies to everyone | Low/uncertain | see s11.5 #9 |
| 8 | Countdown: init 15..20 / 25..30, then 2..6; fires when decrement <= 0 | matches (`E.ai.countdown` from `setup.js`) | none | - |
| 9 | Weights, floors, race/special adds, chunk dice, factories-maxed rule | match | none | - |
| 10 | War row = any treaty >= War (incl. AI-AI wars, final war) | `ctx.enemies().length > 0` (alive empires at war with me) | none | - |

### 11.2 `js/ai/research.js` (step 60) and `Research.aiPick` versus this spec

Matches: `T % 10 == id` trigger, 5/75 sliders, 50% Propulsion before T 30, 25% racial focus table, d16 cumulative order CM, CN, FF, PR (c8), PL (c7), WE, War row. Differences: (a) `Research.aiPick` applies the `rnd(6) < d` best-tier bias also for the **game-start** picks, whereas `new_game_tech` picks uniformly among the first three tier-0 techs - pass a flag to skip the bias at setup; (b) otherwise identical.

### 11.3 `js/sim/setup.js` (AI initialisation) versus this spec

| # | Spec | setup.js | Fix |
|---|---|---|---|
| 1 | `n` counts qualifying planets within 30 units **including the home planet**; `n > 1` = at least one other | counts planets `j !== home` then tests `n > 1` -> needs **two** neighbours | test `n > 0` (or include home) |
| 2 | p2 countdown `rnd(10)` = 1..10 | `R.int(0, 9)` = 0..9 | `R.int(1, 10)` |
| 3 | start sliders/research sliders/first-project cost `level^2*50` | match | - |
| 4 | `shipi_colony = 1`, `shipi_bomber = 4` start quirk (real colony ship idle until the first p2 run) | not modelled (planner derives roles by scanning designs) | decide: faithful delay = planner may use the `E.ai.p2Done` flag: before the first p2 run treat the colony slot as design 1 |

### 11.4 Other touch-points in the existing sim

* `Colony.gross` / `Config.aiProdFactor` (x0.8/1.25/1.5/2.0 with Simple 1.0), `Design.baseCost` (AI base mul, floor 50 applied after the discount), `Techs.costAI`, `Econ.stepReserve` (tax/2000 into `E.bc`, planet bank drain `spendable/2`), `Econ.stepProduction` (net = gross*(1000-security-spying)/1000 + trade - upkeep - gross*tax/1000, floor 1) all **match** the spec.
* `Fleet.send` rejects a send unless **every** selected design has tanks when the target's `frange` is 2, and ships that do not qualify simply stay: the planner must split counts per design (the original did this internally; the Classic "delete the leftovers" bug must not be reproduced).
* `Fleet.launchTransports` caps a transport at `min(n, pop-1, floor(pop/2))`, requires the destination explored, owned by someone, within fuel range and environmentally colonisable (`E.mods.colonyFor`); Classic `trans_en` had **no range check** (`ai_trans_range_fix` off) - the shared validator acts like the fixed variant. Own-planet relocation passes the same checks.
* `design` order fails for slots holding a design with ships, for researched-part violations and for **negative free space** (s5.6 overfill); `scrapDesign` leaves a hole (no shifting), refunds 25%, repoints planets to the first valid design.
* Design records have **no creation year** - store `E.ai.dyear[slot]` via `aiState` (and keep it in sync on scrap).
* There is **no order to conjure a colony ship**, no `spyBudget`/`spyMode` order yet, no AI hook `M.AI.onColonized` implementation.
* `Turn.run` applies AI orders **before** transports/production and runs `Research.aiPick` after RP application; AI colony ships found colonies automatically in the explore phase (matches the original).
* Orders emitted by one planner step are not visible to later steps (pure planners on one snapshot): each step must keep a **local overlay** (virtual orbits, virtual sliders, virtual reserve) - see s12.

### 11.5 Original v1.3 quirks (preserved by 1oom Classic) - and what to do

| # | Quirk | Recommendation |
|---|---|---|
| 1 | 4th colony-ship curse | **fix** (kyrub 1.40i; 1oom v1.11.8 always on) |
| 2 | Unsent ships in a dispatch orbit are deleted | **fix** |
| 3 | Classic colony dispatch uses the stale source copy / `fuel*15` range cap | use Classic+ (refresh, no cap) |
| 4 | Ship-slider doubling at base saturation | **fix** (already) |
| 5 | Stale `ti`/race in the research part of p3 | **fix** |
| 6 | Ecology weight reuses industry weight (column 3 unused) | keep (faithful); flagged unverified bug |
| 7 | Component window excludes the newest owned item; engines 1-2 tiers behind | keep behind `AI_DESIGN_INCLUDE_NEWEST` |
| 8 | Weapon counts up to 141% of what fits | clamp to fit (validator) |
| 9 | Silicoid ECO accumulates (no force, no normaliser) | keep behind a flag; default faithful (unverified strength effect; LP shows Silicoid AIs doing fine) |
| 10 | Age-scrap skips the design that shifts into a scrapped slot; counter decrement bug | irrelevant in the hole model |
| 11 | Start `shipi_colony/bomber` wrong until the first p2 | optional delay |
| 12 | 16-bit mask of ship threat (Classic) | military slice |
| 13 | `Easy` weaker than `Simple` | keep (documented oddity; `AI_PROD.guide` alternative exists) |
| 14 | AI-vs-AI friend bonuses / alliance oscillation | sibling slice |

### 11.6 Conflicts between sources (flagged)

* Production/research cheats: code x1/0.8/1.25/1.5/2.0 and AI research factor 20 vs [Guide] -20/-10/0/+25/+50% and 30. Default = code.
* Slider scheme: [Guide] (floors 5% each, tech 20%, remainder in 5% steps ranked by priority, re-rolled every 3-18 turns by 3d6; Table 11-8 priority lists) vs code (floors 5/5/10/25 conditional on ECO, 3-10% chunks by weight row, every 2-6 turns). Default = code.
* Research: [Guide] one sector at a time, chosen by weights; code: 75/5 split re-rolled every 10 turns. Default = code.
* Expansion: [Guide] "peaceful expansion chance 10% x difficulty (doubled for Aggressive/Expansionist), always expands if >= 3/4 of colonies are at half pop; 1/10..1/6 when fenced in" vs code: spawn `min(500, 0.4 TP)/500`, throttle for non-Expansionists, curse. Default = code.
* Design: cadence 6-15 turns (Guide) vs 9-20 (code); special devices "fills all three slots by usefulness" (Guide) vs independent per-device chances (code); weapon "extras: 200 rolls of same-sort" (Guide) vs share formula (code); armor ranked tiers (Guide) vs best-type-with-II-avoidance (code); equipment ranks "best owned" (Guide) vs newest-excluded window (code reading). The tier-chain distributions match the Guide's Table 9-12 exactly.
* Colony ships "no weapons" (sibling slice 05 s10.6) vs code: colony designs go through the weapons routine and always end with >= 1 weapon (Laser if none). Default = code.
* Personality/objective distributions and three races' primary objective (s7.1).
* [LP] "a single scout parked at a planet deters AI colonisation for a while" - no such check exists in the colonisation code; any deterrence would come from combat at arrival.
* [LP]/manual: starting fleet scales with difficulty - not in code.

### 11.7 Gaps / unverified

* No access to the original executable: everything rests on 1oom's decompilation. In particular the **newest-item exclusion** in the design routine, the **`r = 41` for every weapon**, the **ecology weight reuse**, and the **c7/c8 field mapping** are literal code readings I could not cross-check against observed v1.3 behaviour.
* The initial `year` of the start designs (affects which three designs the first p2 run builds) was not verified.
* [Guide] chapters on AI summary (p. 320) and Chapter 9 colony-ship text were not read in detail; StrategyWiki/Fandom pages were not retrievable.
* The exact effect of Silicoid ECO accumulation on AI strength was not tested.

### 11.8 Recommended switch defaults (a single `AI_OPTS` block would hold them)

| Switch | Default | Meaning |
|---|---|---|
| `colonyCurseFix` | on | no 4-ship curse (kyrub 1.40i / 1oom always-on) |
| `dispatchKeepUnsent` | on | unsent ships stay (never delete) |
| `colonyRangeCap` | off | no `fuel*15` cap (Classic+) |
| `fleetCheatBug` | off | saturation moves DEF -> SHIP instead of doubling SHIP |
| `designIncludeNewest` | off (faithful) | newest owned component can/cannot be picked (s5.4) |
| `designOverfill` | off | clamp weapon counts to what fits |
| `researchSwap78` | off | follow the code's c7/c8 mapping (s4.3) |
| `silicoidEcoRatchet` | on (faithful; revisit after soak) | Silicoid ECO is never reset (s11.5 #9) |
| `startColonyDelay` | off | the real colony ship waits for the first p2 run |
| `colonyScoring` | off | optional non-original target scoring (s3.11) |
| `aiProdMode` | `'1oom'` | production multipliers x1/0.8/1.25/1.5/2 (`'guide'` alternative exists) |
| `objectiveTable` | `'1oom'` | v1.3 trait tables (manual primaries optional) |

---------------------------------------------------------------------------------------------------

## 12. PLANNER CARDS - contracts for pure planners that emit orders

Common rules: every planner is `MOO.AI.step(name, order, fn(ctx))`; it reads only `ctx.S` (snapshot), uses `ctx.R` for randomness (never `Math.random`), keeps **local overlays** for anything its own earlier orders would change (orbit counts, slider values, reserve BC, design slots) and emits plain orders through `ctx.order`. Anything remembered across turns goes into `ctx.patch({...})` -> `aiState` (`E.ai`). Recommended step orders (p1 -> p2 -> p3 sequence of the original): **30** scouts + colonisation, **40** military (sibling), **42** logistics/panic/reserve, **45** designs (p2; after p1 so ships scrapped by p2 were already dispatched), **50** planets (p3), **60** research, **70** finance/spies.

### P30 - scouting and colonisation (p1)
* **Reads:** explored flags, `E.frange`, my stationary stacks and moving fleets, planets' owner/typeIdx, `E.mods.colonyFor`, colony design slot and stats, `E.flow.gross`, contacts + territory centres, Orion/Guardian, difficulty, objective, human contact, design `tanks`.
* **Local state:** `orbit[star][slot]` counts (decremented as ships are assigned; incremented by a conjure); `moving` = fleets in flight count; ignore sets.
* **Algorithm:** s8.1 (scouts) -> s3.3 (fronts) -> s3.4 (spawn) -> flag_send_colony (s1.3) -> s3.5-3.6 (dispatch).
* **Orders:** `{t:'fleetSend', from, to, counts:[6]}` per scout/colony dispatch (counts pre-filtered for range flag 2 -> only designs with tanks); **new** `{t:'aiConjure', star, slot}` for each spawned colony ship, emitted **before** the dispatch that uses it.
* **State:** none required (curse count derived from fleets). Optional `E.ai.p2Done` for the start-quirk delay.
* **Determinism:** all rolls from `ctx.R`; iterate planets ascending.

### P42 - logistics, panic, reserve (p1 tail)
* **Reads:** my planets' pop/max pop/unrest, `E.bc`, en-route fleets of others, my orbit stacks over enemy planets (for invasion staging), treaties/ceasefires, `E.mods.colonyFor`, propulsion level for the ranges.
* **Algorithm:** `trans_en` and `trans_own` (s2.11) -> `build_defending_ships` (s2.6) -> `fund_developing` (s2.6). The reserve pool is simulated: each transfer takes `floor(pool/5)` of the *remaining* pool.
* **Orders:** `{t:'trans', planet, to, n}`; `{t:'sliders', planet, values}` (panic: SHIP = SHIP+DEF+IND+TECH, DEF = IND = TECH = 0, ECO untouched, so the sum stays 100); `{t:'transfer', planet, amount}`.
* **Invasion hand-off to the military planner:** the military planner sends fleets; **this** planner launches `pop/2` transports from source planets only toward enemy planets over which **I already have ships in orbit at planning time**. No other communication is needed (state-based). The Ground module resolves landings.

### P45 - designs (p2)
* **Reads:** `E.designs`, ship counts per slot (orbits + moving), `E.ai.dyear`, `E.ai.p2`, owned components (`Design.available`), human empires' designs (Pulsar/Repulsor/Dissipator), race hull offset, `S.year`, my planets, stargate tech.
* **Algorithm:** s5.1-5.8. Maintains `E.ai.p2` countdown (first `rnd(10)`, reset `rnd(12)+8`) and `E.ai.dyear[]`.
* **Orders (in this sequence):** `{t:'scrapDesign', slot}` (aged / forced), then for each missing slot `{t:'design', slot, design:<draft>}` (draft built with the `Design` API: `blank`, `compute` for fit tests, `maxCount` for weapon counts, clamped to fit), then for every owned planet `{t:'build', planet, design: slot | -1}`; finally `aiState {p2, dyear}`.
* **Local state:** simulated slot occupancy after scraps; role detection from designs (colony = `colonyMin > 0`, bomber = weapon bank 0 is a bomb).

### P50 - planet sliders (p3) - implemented in `js/ai/planets.js`; apply the fixes of s11.1 (#1, #4, #5, #6).
* **Orders:** `{t:'sliders', planet, values:[ship,def,ind,eco,tech]}` (sum 100). **State:** `E.ai.countdown`.

### P60 - research (p3 tail) - implemented in `js/ai/research.js`; matches. Project picks happen in `Turn.run` via `Research.aiPick` (skip the best-tier bias at setup).

### P70 - finance and spies
* **Orders:** `{t:'tax', value}` = 0 if `T < 20` else `rnd(10)+d+2`; `{t:'security', value}` (T > 30) = `min(100, (spiesOnMe == 0 ? 0 : rnd0(2)*spiesOnMe) + 8d)`; **new** spy orders: per contacted empire `spyMode` (sabotage if at war, else espionage per s2.13) and `spyBudget` = `rnd(5)+5` (tenths of % of production) with the AI-target gate `rnd0(3) == 0`. Re-rolled every turn (stateless).

### Orders the AI planners use (existing handlers and their validation, from `js/sim/*.js`)

| Order | Fields | Validation / notes |
|---|---|---|
| `sliders` | `planet, values[5]` (sum exactly 100) | own planet; ECO floor lifts ECO afterwards (`Colony.applyEcoFloor`) |
| `build` | `planet, design` (slot 0..5 or `-1` Stargate) | design must exist; `-1` needs `E.mods.stargate`, planet without gate |
| `fleetSend` | `from, to, counts[6]` | own stationary stack at `from`; every selected design needs tanks if the target's `frange` is 2; out of range -> fail |
| `trans` | `planet, to, n` | `n <= floor(pop/2)`; target explored, owned by someone, in fuel range, environment colonisable; launched at the start of the same turn |
| `design` | `slot, design` | all parts researched, no negative free space, target slot holds no ships |
| `scrapDesign` | `slot` | removes the design's ships everywhere, refunds 25%, repoints builds |
| `researchSet` | `values[6]` (sum 100) | - |
| `tax`, `security` | `value` 0..200 (per mille of production) | AI uses far smaller values (s2.10, s2.13) |
| `transfer` | `planet, amount` | amount <= `E.bc`; planet bank adds up to its output next turn |
| `aiState` | `patch` | merged into `E.ai` (planner memory) |

**`E.ai` schema** (all small JSON): `countdown` (p3), `p2` (p2 countdown), `dyear[6]` (design creation turns), optional `p2Done`, `crowded` (start flag, unused).

### New orders/hooks the sim must provide
`aiConjure{star,slot}` (AI-only; adds one colony-design ship at an owned planet; validate: empire not human or `settings.playerAI`, planet owned, `designs[slot]` has `colonyMin > 0`), `spyMode`/`spyBudget` (Spy module), optional `slidersRaw` (allow > 100 for one turn), optional `design{..., aiOverfill}`; `M.AI.onColonized` may be left empty.

---------------------------------------------------------------------------------------------------

## 13. VERIFICATION LEDGER (what is verified vs inferred)

| Item | Tag | Basis |
|---|---|---|
| Hook cadence, timers, first-fire values | [V] | `new_game_init`, `turn_p2/p3` read twice |
| p1 sub-step order and gating | [V] | two descriptions + line quotes |
| Slider rebalance algorithm, floors, race/special adds, chunk dice, factories-maxed, saturation | [V] | full code quoted |
| Weight table values, thresholds | [V] | table quoted twice |
| `w_eco` reusing column 2 | [V] reading / bug status unverified | quoted twice |
| c7/c8 research column mapping | [V] reading / semantic unverified | code quoted; manual conflicts |
| Research focus block | [V] | full code quoted |
| `tech_next`, candidate list, costs | [V] | code quoted |
| Colony spawn, throttle, curse | [V] | line quotes |
| Fronts, dispatch order, escorts | [V] | line quotes + two reads |
| Colonisation founding | [V] | `game_turn_explore` read |
| Colony ship design (best colony base) | [V]/[I] | code + derivation that Battle Scanner is owned at start |
| Scouting algorithm | [V] | two reads + quote |
| Transports | [V] | two reads |
| Panic/developing/reserve | [V] | code quoted |
| Event cranks | [V] | code quoted |
| Spy/security settings | [V] | code quoted |
| Design algorithm incl. tables | [V] | full function bodies quoted |
| Newest-item exclusion consequence | [I] | derived from helper bodies; original behaviour unverified |
| `r = 41` for every weapon | [I] | derived from field values + condition; original semantics unverified |
| Hull probability tables, spawn probability, expected sliders | [I] | arithmetic from verified rules |
| Difficulty multipliers (production, base cost, tech cost, pick bias) | [V] | line quotes |
| Difficulty throttle/need_conquer/tax/security | [V] | line quotes |
| Playbooks, timelines | [I] | interpretation |
| Guide-based statements | [G] | secondary |
| Mismatch table vs `js/ai`, `js/sim` | [V] | files read on 2026-10-11 |

---------------------------------------------------------------------------------------------------

## 14. REVISION LOG

* v1 (2026-10-11): sections 0-2.
* v2 (2026-10-11): sections 3-13 added (colonisation, research, design, difficulty, objective/personality/race, scouting/production/military-adjacent, playbooks, constants, repo comparison, planner cards, ledger); [Guide] Table 9-12 / 11-8 / racial-objective text cross-checked; Orion/scout statement corrected (Orion is never scouted).
* v2.1 (2026-10-11): cross-references fixed; order table + `E.ai` schema added to s12; wording fixes (stop-check after armor treated as absent; AI-AI trading condition made exact).

---------------------------------------------------------------------------------------------------

## APPENDIX A - Enumerations and index mapping (1oom -> JS sim)

* Race: 0 Human, 1 Mrrshan, 2 Silicoid, 3 Sakkra, 4 Psilon, 5 Alkari, 6 Klackon, 7 Bulrathi, 8 Meklar, 9 Darlok. trait1: 0 Xenophobic, 1 Ruthless, 2 Aggressive, 3 Erratic, 4 Honorable, 5 Pacifistic. trait2: 0 Diplomat, 1 Militarist, 2 Expansionist, 3 Technologist, 4 Industrialist, 5 Ecologist. Difficulty 0..4 Simple..Impossible. Treaty 0 None, 1 NAP, 2 Alliance, 3 War, 4 Final War. Tech fields 0 Computer, 1 Construction, 2 Force Field, 3 Planetology, 4 Propulsion, 5 Weapon.
* Planet types 0 not habitable, 1 Radiated, 2 Toxic, 3 Inferno, 4 Dead, 5 Tundra, 6 Barren, 7 Minimal, 8 Desert, 9 Steppe, 10 Arid, 11 Ocean, 12 Jungle, 13 Terran. Specials 0 Ultra-poor, 1 Poor, 2 Normal, 3 Artifacts, 4 Rich, 5 Ultra-rich, 6 4X-Tech. Growth 0 Hostile, 1 Normal, 2 Fertile, 3 Gaia.
* Slider index: 0 SHIP, 1 DEF, 2 IND, 3 ECO, 4 TECH. Hulls 0 Small, 1 Medium, 2 Large, 3 Huge.
* **1oom -> sim component indices:** hulls and engines and armor identical (engine 0 Retro .. 8 Hyperthrust; armor 0 Titanium, odd = heavy "II"); computers/ECM/shields: 1oom 0 = none -> sim `-1`, 1oom k -> sim `k-1`; specials: 1oom 0 = none, k -> sim `k-1` (so Reserve Fuel Tanks = sim 0, colony bases sim 1..7, Battle Scanner sim 8 ... Displacement Device sim 29); weapons: 1oom 0 = none, k -> sim `k-1` (Nuclear Bomb sim 0, Laser sim 1, ...). Weapon `racks` (2|5) = 1oom `numshots` of missiles; `rof` = `numfire`.
* Tech levels in the sim equal the original tech ids (engines at 1/6/12/.../48; colony bases at Planetology 1/3/6/9/12/15/18).

## APPENDIX B - [Guide] cross-check tables (design intent, partly outdated)

* Table 9-12 (rank distributions, best first): Computer S 10/18/28.8/34.6/8.6, M 20/32/38.4/9.6, L 35/45.5/19.5, H 50/50; Shield S 5/9.5/17.1/27.4/32.8/8.2, M 15/25.5/35.7/23.8, L 40/48/12, H 70/30; ECM S 2/3.9/7.5/13.9/23.3/31.6/17.8, M 8/14.7/24.8/33.6/18.9, L 20/32/38.4/9.6, H 30/42/28; Engines (all) 60/40; Maneuver S 30/42/28, M and L 20/32/38.4/9.6, H 15/25.5/35.7/23.8; Armor S 1/2/3.9/7.5/13.7/23/31.3/17.6, M 2/3.9/7.5/13.9/23.3/31.6/17.8, L 4/7.7/14.1/23.7/32.3/18.2, H 8/14.7/24.8/33.6/18.9 (armor ranks are *not* what the code does). These equal the code's doubling-chance chain.
* Table 11-8 spending priorities (Guide): at war Ships > Tech > Industry > Defense > Ecology; peacetime: Diplomat Tech>Ind>Def>Ships>Eco; Ecologist Eco>Tech>Ind>Def>Ships; Expansionist Tech>Def>Ships>Ind>Eco; Industrialist Ind>Tech>Def>Eco>Ships; Militarist Ships>Tech>Ind>Def>Eco; Technologist Tech>Ind>Def>Eco>Ships. Tech priorities: war Weapons, Force Fields, Propulsion, Construction, Computer, Planetology; Diplomat FF, Weapons, Propulsion, Planetology, Construction, Computer; Ecologist Planetology, FF, Weapons, Construction, Computer, Propulsion; Expansionist FF, Weapons, Planetology, Propulsion, Construction, Computers; Industrialist Construction, FF, Weapons, Propulsion, Planetology, Computers; Militarist Weapons, FF, Propulsion, Computers, Construction, Planetology; Technologist roughly even (Comp 5, FF 4, Weapons 3, Constr 2, Planet 1, Prop 1 of 16). (The code's weight rows are loosely similar in rank order for slider weights - e.g. Militarist SHIP highest, Expansionist DEF highest - but are a different mechanism.)
* [Guide] racial-objective text: each planet puts >= 5% into ships, defense, industry, ecology and >= 20% into tech; remaining 60% in 5% increments by d15 priority rolls (5/4/3/2/1), re-rolled every 3-18 turns; ecology always keeps the planet clean; research 100% into one sector until the current item is found, next sector by d16 weights.

## APPENDIX C - Sources

* 1oom (GPLv2) `src/game/`: game_ai_classic.c, game_ai.h, game_ai_classic.h, game_new.c, game_num.c, game_turn.c, game_misc.c, game_planet.c/.h, game_tech.c, game_design.c, game_shipdesign.c, game_shiptech.c/.h, game_spy.c, game_fleet.c, game_event.c, game_diplo.c, game_types.h, game.h, game_aux.c, `util_math.c`; docs `doc/list_pbxnum.txt`, `doc/list_gamediff.txt`, `doc/pbxin_fixbugs.txt`, `NEWS`, `CHANGES`.
* Emrich & Hughes, *Master of Orion: The Official Strategy Guide* (Prima 1994), archive.org item `MasterOfOrionStrategyGuide_201704` (design-philosophy section + Table 9-12, racial objectives + Tables 11-7/11-8, spying practices).
* archive.org: MOO v1.3 patch readme, kyrub's community patch 1.40m/1.40i/"Embryonic 18" readme. lparchive.org "Master of Orion" LP (updates 1, 4, 9). Steam community race guide (3438223263). StrategyWiki/Fandom: not retrievable (HTTP 403/402) - search snippets only (missile-base ratio claim consistent with s6.1 row 10).
* Repo files read for the comparison (2026-10-11): `js/ai/{ai,ctx,planets,research}.js`, `js/sim/{setup,colony,econ,fleet,design,research,turn,orders,geo}.js`, `js/data/{config,races,components}.js` (+ grep of `techs.js`), `DESIGN.md`, `CONVENTIONS.md`.
