# 04-verification — errata for research/04-galaxy-economy.md + audit of the economy / galaxy / movement code

Primary source: github.com/1oom-fork/1oom `master`, `src/game/` (game_new.c, game_misc.c, game_turn.c, game_planet.c/.h, game_fleet.c, game_tech.c, game_num.c, game_nump.c, game_aux.c,
game_design.c, game_shiptech.c/.h, game_types.h, game_ai_classic.c) and `src/util_math.c`. Pages were read through a summarising fetch tool (no raw access), so every number is a
transcription by a small model: load-bearing numbers were read at least twice with differently phrased prompts; one slip was caught that way (a cos-table entry). Only numbers /
formulas are restated here (1oom is GPL — no code is copied; the fixes in `js/sim/*` were written from these rules). "Classic" = 1oom default flags = shipped v1.3 (every `*_fix` flag
is `false` by default; `reset_tform_to_max` is `true`; the 1.3a patch adds max_factories 2700, ship_scanner_fix, …).

Counts (Part A, §1.1 – §7 plus the extra §2/§3.8/§4 rows I could check): **61 rows = 51 VERIFIED (several with extra detail), 6 WRONG/INCOMPLETE (see CORRECTIONS), 4 UNVERIFIABLE**.
Most important: (C1) a parsec is **~9.2 map units on average, not ~10-11** — the step components are truncated, so near-axis lines are 20 % longer than `euclid/11`; the code used rounding
(91 % of the Large-galaxy star pairs had a different parsec count, stars within 3 parsecs of a homeworld 2.5 → 1.3); (C3) the ECO-floor redistribution; (C5) production is recomputed a second
time before defence/ships/industry; (C7) the original adds the carried population tenths twice (growth ~2x faster for small colonies; the Let's-Play "Tyr passes half of 35 after a couple of decades" is
18 turns with the quirk, 41 without); (C4) soil enrichment keeps 150 BC of progress toward Gaia.

## Part A — verdicts

| # | Doc § | Claim | Verdict | Note |
|---|---|---|---|---|
| 1 | 1.1 | grids 6x4 / 8x6 / 10x7 / 12x9 = 24 / 48 / 70 / 108 stars | VERIFIED | `w*h` cells; PLANETS_MAX 108 |
| 2 | 1.1 | nebula count rolls: small `rnd_0_nm1(2)`, medium `rnd_1_n(3)`, large `rnd_1_n(2)+1`, huge `rnd_1_n(3)+1` | VERIFIED | the roll always happens; the `nebulae` option only zeroes the count. SG "1-2" for medium stays a conflict (code wins) |
| 3 | 1.1 | star-centre extents (x 14..196 small …) and map ~223x183 | VERIFIED | arithmetic from 1.3; `galaxy_maxx = max x + 27`, `galaxy_maxy = max y + 25` after the stars exist |
| 4 | 1.1 | SG nominal sizes 21x15 / 27x21 / 33x24 / 39x27 parsecs | UNVERIFIABLE | not in the source; BUT they fit ~9.2 units/parsec horizontally (19.9 / 26 / 32 / 38 parsecs) and do NOT fit 11 (16.5 / 21.6 / 26.7 / 31.8) — independent support for C1 |
| 5 | 1.2 | `dist_fast = max + min/2` (integer) | VERIFIED | |
| 6 | 1.2 | `star_dist` stored once, symmetric, uint8 | VERIFIED | computed in `game_aux` for i < j from the LOWER star id to the higher one (`dist_steps`), mirrored, cast to uint8 without clamp |
| 7 | 1.2 | parsec = 5-step then (if not there) 6-step, count++ | VERIFIED | |
| 8 | 1.2 | "exactly 11 along an axis, about 9.8-10.3 units on diagonals" | WRONG | only an exact axis gives 11; a heading 1-20 degrees off an axis gives ~9.0-9.5, 30 degrees 10.3, 45 degrees 9.9; mean over random pairs 9.16 -> C1 |
| 9 | 1.2 | `go_line_dist`: return if at target (and if dist <= 0), halve both when any |component| > 255 (truncating), heading from the remaining vector each call, clamp per axis | VERIFIED | the clamp uses the sign of the (possibly halved) vector; component = trunc(dist*table/65536), sign applied afterwards |
| 10 | 1.2 | heading = largest whole degree with `floor(256 tan) <= floor(256|dy|/|dx|)`, tables for 0-21 / 22-44 / 45-66 / 67-89 | VERIFIED | quirks confirmed: last 22-44 bucket answers 43, slope >= 14669 answers 90, dx = 0 answers 90; first-quadrant folding (dx>=0,dy<0 -> 360-a; dx<0,dy>=0 -> 180-a; both<0 -> 180+a) |
| 11 | 1.2 | trig tables `floor(65536 sin/cos)`, cos(0)=sin(90)=dist | VERIFIED (+-1) | sin table = nearest integer (reproduced by `floor(x+0.06)`), cos table = floor with ~10 entries one lower; the only entries that change a 5/6-unit step: sin(30)=32768 (6 -> 3) and cos(60)=32767 (6 -> 2) |
| 12 | 1.2 | [AI] anchors "dist_fast 48 = 6 parsecs, 101 = 9" | UNVERIFIABLE | not reproducible with the verified metric (a 101-unit axis line is 10 parsecs); keep as anecdote |
| 13 | 1.2 | `game_check_coord_is_visible` uses `dist_fast <= 10*R` | VERIFIED | plus `(10R-30)/2` around stars with own ships and around own en-route fleets |
| 14 | 1.3 | star placement: `rnd_1_n(43)+28w+9`, `rnd_1_n(51)+32h+7`, reject `<20` if (earlier x < x or earlier y < y) else `<10`, `+4` | VERIFIED | no attempt cap in the original (`goto again`) |
| 15 | 1.4 | colour roll `rnd_0_nm1(20)`: 0-2 Yellow, 3-8 Red, 9-13 Green, 14-16 Blue, 17-18 White, 19 Neutron | VERIFIED | Yellow is the `default:`; look = `rnd_0_nm1(2)*6`, frame `rnd_0_nm1(50)`, one discarded `rnd_0_nm1(4)` |
| 16 | 1.6 | planet-type tables per colour (6 tables) | VERIFIED | re-transcribed from the source and diffed: identical to the doc and to `TYPE_TABLE` in galaxy.js (Yellow -1 Radiated, 0 Toxic, no Dead; Red/Green start at r=2; White r>=3; Blue r>=4; Neutron r>=5) |
| 17 | 1.7 | base max pop per type and the `rnd_1_n` multipliers | VERIFIED | Desert..Ocean = `rnd_1_n(4)*5 + (type-Desert)*10 + 30`; `max_pop` fields are int16 (no wrap) |
| 18 | 1.7 | +-20 chain (`d = rnd_1_n(10)`, 1 = -20, 10 = +20, floor 10 inside the loop), cap 120 after | VERIFIED | "no planet" stars go through the chain too (value never used) |
| 19 | 1.7 | Fertile: `type > Desert`, `rnd_1_n(12)==1`, `m += (m/20)*5` after the cap | VERIFIED | |
| 20 | 1.8 | poor / ultra-poor (type >= Steppe, Red -4, Green -2, `<=2` / `<=5`), rich / ultra-rich (all types, nebula -8, Blue -2, Neutron -5, `(9-type) > d`, `d < 6`), artifacts (Minimal..Ocean, Normal, `rnd_1_n(10)==1`) | VERIFIED | "no planet" is forced Normal/Normal AFTER the rocks roll |
| 21 | 1.9 | rocks formula | WRONG (boundary) | thresholds are strict `< 15` / `< 40`, not `<=` (C2) |
| 22 | 1.10 | 10 nebula types x 4 rectangles | VERIFIED | all 40 rectangles identical (rows are x0,y0,x1,y1, added to the nebula origin) |
| 23 | 1.10 | placement `rnd_0_nm1(10)`, `rnd_1_n(maxx0-70)+4`, reject same type or |dx|<60 && |dy|<60, 200-attempt quirk | VERIFIED | pre-placement `maxx0=(W-1)*28+20`, `maxy0=(H-1)*32+16` (small 160/112 … huge 328/272) |
| 24 | 1.10 | nebula effects (shields off, rich -8, speed rules) | VERIFIED | movement rules in row 49; planet shield exclusion in row 36; "ship shields disabled" is combat (not read) |
| 25 | 1.11 | Orion = `rnd_0_nm1(stars)`, Terran, max pop 120, Normal, 4XTECH | VERIFIED | |
| 26 | 1.12 | classic homeworld search: 200 attempts, interior-cell formula, only players 0 and 1 validated (spacing >= 80, nearest Minimal+ <= 29, nearest any <= 29) | VERIFIED | on exhaustion the galaxy is regenerated; the 1oom "improved" generator was NOT read |
| 27 | 1.12 | homeworld contents and start state | VERIFIED | Terran/Yellow, max pop config 100 (valid 50..120), pop 50 (Simple/Easy/Average) or 40 (Hard/Impossible), 30 factories, 2 scouts / 0 fighters / 1 colony ship, fuel 3, colony-for Minimal, factory cost 10, oper 2, human sliders 20/10/15/15/20/20 |
| 28 | 3.2 | production: workers, operating factories, `pop*(3L+50)/100`, Klackon x2, AI factors, reserve doubling, rebellion 0 | VERIFIED | the per-pop term uses the FULL pop (rebels only reduce operating factories); Klackon doubles after the floor; AI factor before the reserve; Easy `(v*4)/5`, Average `v+v/4`, Hard `v+v/2`, Impossible `2v` |
| 29 | 3.2 | L = Planetology percent = `tmax + n - v` (v = 1 if n=1 else `(tmax-1)/5+2`), clamp 1..99 | VERIFIED | |
| 30 | 3.3 | ship upkeep `sum(count*design cost)/50` over orbit + en route, cap, `+100` per stargate | VERIFIED | the cap (32000) is applied twice (before and after the stargate term); base upkeep `bases*base_cost/50` |
| 31 | 3.3 | net = G*(1000-sec-spy)/1000 + trade - ship - base - G*tax/1000, min 1, factor = net*100/G (0 if G=0), spendable = prod*factor/100 - transports | VERIFIED | factor may exceed 100 (trade); spying budgets of non-contacts are zeroed first; Human trade +25 |
| 32 | 3.3 | reserve += G*tax/2000 | VERIFIED | `game_turn_reserve`; planet bank decays by `prod_after_maint/2` |
| 33 | 3.3/6.2 | each outgoing transport costs 1 BC of that planet's output | UNVERIFIABLE | `game_send_transport` sets `trans_num = 0` BEFORE the first `game_update_production` of the turn, so the processing-time deduction can never fire in 1oom (only the planning-time display shows it); SG App. A says "cost deducted" — unresolved (C10) |
| 34 | 3.4 | richness x1/3, x1/2, x2, x3 on SHIP/DEF/IND only; ECO/TECH none; Artifacts/Orion research only | VERIFIED | integer: `/3`, `/2`, `*2`, `*3` of the slider share |
| 35 | 3.4 | SHIP: stargate 3000 BC, "+1 BC when the slider is > 0" | VERIFIED | source comment calls the +1 a known original bug; stargate upkeep 100 (`game_num_stargate_maint`), SG's 300 is wrong for 1oom |
| 36 | 3.4 | DEF order: upgrade bases -> shield -> new bases; none in nebulae | VERIFIED + detail | upgrade bill = `max(0, new_cost-old_cost) * bases + carry` where old/new differ only by newly owned weapon/shield/computer techs; if the bill >= this turn's BC everything goes to it; shield level = 5 per 500/1000/1500/2000 reached |
| 37 | 3.4 | ECO floor = `ceil(100*((floor(op*scale/10)+waste)/n)/spendable)`, 0..100 | VERIFIED | `prod_after_maint == 0` is treated as 1000; operating = `min(factories, pop*oper)` (no rebel subtraction) |
| 38 | 3.4 | floor raised -> increase removed proportionally from SHIP/DEF/IND, TECH gets the remainder | VERIFIED | exact rule in C3 (the doc is right, the code was wrong) |
| 39 | 3.4 | slider auto-disable rules | WRONG/INCOMPLETE | C6 |
| 40 | 3.5 | factory cost `factory_cost*oper/2` (Meklar: unscaled), max factories `max_pop3*oper`, cap 2500/2700 | VERIFIED | classic `oper` = the EMPIRE level for every planet (the per-planet tier only gates the refit) |
| 41 | 3.5 | refit | VERIFIED | classic = flat `(oper - tier - Meklar2) * (factory_cost/2)` once the planet is pop-capped; overflow factories go to the reserve at `(excess*cost)/2`, the remainder BC stays in `bc_to_factory` |
| 42 | 3.6 | waste: `waste += (100-floor(waste*100/max_pop2)) * floor(op*scale/10)/100`, cleanup `need = floor(waste/n)`, clamp to `max_pop2-10` | VERIFIED | operating = `min(factories, pop*oper)`; the second (`sub1`) term is ON by default and is computed after `ecorestore` (C8) |
| 43 | 3.6 | project order atmosphere (>=200) / soil (>150) / advanced soil (>300), terraform increments, buy pop | VERIFIED + detail | sequential blocks and carry in C4; terraform `v = eco/cost`, when the cap is not hit all the rest is consumed (remainder lost) |
| 44 | 3.6 | pop buy `floor(eco*10/inc_pop_cost)` tenths (Sakkra x2, Silicoid /2), limit `pop*10/4`; Sakkra cost x2/3 | VERIFIED | `inc_pop_cost` 20 / 10 / 5 (PL 21 / 42); Sakkra `(cost*2)/3` -> 13 / 6 / 3 |
| 45 | 3.7 | growth formula with class modifiers, Sakkra x2, Silicoid | VERIFIED + WRONG (omission) | formula exact; but the carried tenths are added twice and two small rules are missing (C7) |
| 46 | 3.10 | missile base cost formula (armor `(c+2000)*m/1500`, weapon `*9m/1000`, shield/comp `*m/1000 + power/10`, jammer, `*3/5`, AI x9/10 .. /2, min 50, m = T50[level-1]) | VERIFIED | start value **254** reproduced by hand (133+63+126+102+0 = 424, x3/5); SG's ~283 unexplained |
| 47 | 4.1 | start designs, presets and formula costs, hull table, colony bases, reserve tanks | VERIFIED | presets 10/15/66/86/591/10, `fix_starting_ships` 8/14/74/65/570, engines 2/27/110/85/100; hulls 60/360/2000/12000 (x10), space 40/200/1000/5000, hits 3/18/100/600, power 2/15/100/700, defense +2/+1/0/-1; colony bases 3500..5000 (x10) space 700; tanks 20/100/500/2500 |
| 48 | 4.2 | ship cost formula (min item costs 5/1, engines `*n/10`, `(x+5)/10`, T50 by level difference) | VERIFIED | |
| 49 | 5.1 | engine table (power 10..90, space 10/18/26/33/36/40/44/47/50, cost 20..180, warp 1..9, PR ids 1,6,…,48); transport speed `i/6` | VERIFIED | fleet speed = min(`engine+1`) |
| 50 | 5.2 | 20 frames, unit active on frames `0..2N-1`, 5 even / 6 odd, nebula rules, stargate jump, monsters frames 0-1 | VERIFIED | fleets skip even frames >= 2 inside a nebula, transports skip odd frames; `game_calc_eta_*` is formulated per double step but equals the frame simulation |
| 51 | 5.2 | ETA = `ceil(star_dist/speed)` in open space | VERIFIED | |
| 52 | 5.3 | fuel ranges 3,4,5,6,7,8,9,10,30; flags 1 / 2 (+3 with tanks) / 0 | VERIFIED | |
| 53 | 5.3 | stranding rule | VERIFIED | orbiting ships at flag 0, or flag 2 without tanks, are removed at step 60, i.e. with the PREVIOUS turn's flags (refreshed at step 73) |
| 54 | 5.4 | scanner ranges 3/5/7/9, auto-explore radius 110, within_srange only from OWN planets, contact = larger fuel range | VERIFIED | allies extend fuel range, not scanning |
| 55 | 6.1 | colonisation conditions, Silicoid override, pop 2 | VERIFIED + detail | the ship consumed is the design with the LOWEST min-type (most capable base); ships at Orion are deleted while the Guardian lives (step 37) before exploring |
| 56 | 6.2 | transport launch / landing | VERIFIED | `pop -= n` (>= 1), rebels `-= n/2+1`, own planet `ADDSATT(pop, n, max_pop3)`, rebelling own planet -> inbound, unowned -> lost, enemy -> inbound (`total_inbound` gets the pre-gauntlet count); inbound cap 300 |
| 57 | 6.2 | transport HP 15/22/30/37/45/52/60 by armour, rounds by warp | WRONG | 1oom: `transport_hp = (tier of the best armour tech + 1) * 15`; the SG table is not what the code does (C10) |
| 58 | 7 | order of turn processing | WRONG/INCOMPLETE | a second `game_update_production` runs after build_eco/trade/spy_build (C5) |
| 59 | 3.8 | research interest 15 % capped 2x, `(inv-cost)*250/cost`, `rnd_1_n(500)`, decay 9/10, cost formulas | VERIFIED | `game_tech_research` / `get_next_rp`; costmuld {20,25,30,35,40}, costmula 20, race table identical |
| 60 | 1.15/5.4 | all stars drawn, explore by ship or Advanced Scanner (<=110 units, no loot) | VERIFIED | |
| 61 | 3.13 events, 1.13 names, 1.14 expected counts, 2.x race notes | not read | UNVERIFIABLE | out of the brief's list |

## CORRECTIONS (exact values)

**C1 — the parsec metric.** `go_line_dist(x,y,x1,y1,dist)`: `dist<=0` or at target -> unchanged; `dx=x1-x, dy=y1-y`; if |dx|>255 or |dy|>255 halve both toward zero; heading `a` (0 = +x, 90 = +y) from
`slope = trunc(|dy|*256/|dx|)` through the four tables `floor(256 tan)` (22 + 23 + 22 + 23 entries; 45-degree entry 256; entries 83-89 are 2085, 2435, 2926, 3661, 4885, 7331, 14669), first-quadrant folded; then
`x += sign * trunc(dist * COS[a'] / 65536)`, `y += sign * trunc(dist * SIN[a'] / 65536)` (cos(0)=sin(90)=dist; sin(30)=32768, cos(60)=32767), clamped per axis. `star_dist` = number of (5, 6) double steps
from the lower to the higher star id. Consequences: never fewer than `ceil(euclid/11)`; axis-aligned 11 units/parsec; a 1-degree heading 9; 45 degrees 9.9; mean 9.16. Examples: (0,0)->(100,2) = 12 parsecs (11 axis-aligned would be 10);
(0,0)->(30,10) = 4. On a generated Large galaxy: pairs within 3 parsecs 92 -> 62, within 6 parsecs 396 -> 285, stars within 3 parsecs of a homeworld 2.5 -> 1.3 on average.

**C2 — rocks:** `d = rnd_1_n(100) - (UltraRich 20 | Rich 10) - (15 - type)`; MANY if `d < 15`, SOME if `d < 40` (strict). Radiated normal = 28 / 25 / 47 % (the SG's 29/25/46 fits `<=`; the source wins).

**C3 — ECO floor update** (`game_update_eco_on_waste`, every turn per planet, not Silicoid): when `ECO < floor`: `diff = floor - ECO`, `ECO = floor`, then SHIP, DEF, IND each `-= SHIP*diff/100` (resp. DEF, IND; C integer division, NOT a
share of `diff`); finally TECH is ALWAYS reset to `max(0, 100 - SHIP - DEF - IND - ECO)` (so the total can be 101-102 after truncation, and a 110-sum start such as the isolated AI home 60/10/40 is trimmed). Example [20,0,40,0,40] at floor 35 -> [13,0,26,35,26].
`waste% = ceil(100*waste/prod)` where `waste = (floor(min(factories,pop*oper)*scale/10) + waste)/n`, `prod = prod_after_maint` (1000 if 0).

**C4 — projects** (`game_turn_build_eco`, three sequential `if`s on one accumulator): atmosphere (hostile, tech PL 22): `acc += eco; if acc >= 200 { eco = acc-200; acc = 0; convert } else eco = 0`; soil (Normal, tech PL 16 ONLY — PL 30 does not set it):
`acc += eco; if acc > 150 { eco = acc-150; acc = min(acc,150); fertile } else eco = 0` — the progress (capped at 150) is kept toward advanced soil; advanced soil (Normal or Fertile, PL 30): `acc += eco; if acc > 300 { eco = acc-300; acc = 0; gaia } else eco = 0`.
So Normal -> Fertile -> Gaia costs 301 BC in all (no 450), and 301 BC in one turn finishes both. (The source comments mark these as already-fixed MOO1 double-spending bugs.) Terraform increments: `v = eco/cost`, when the cap `level + max_pop2` is not reached the whole remaining ECO is consumed.

**C5 — turn order.** Real sequence (1oom `game_turn_process`): limit ships; AI p1/p2/p3; **launch transports (14); update_production (15); build_eco (16); total_research (17); trade (19); spy_build (20); update_production AGAIN (21, `!hidden_child_labor_fix`);**
diplo adjust; build_def; build_ship (design costs refreshed first); reserve; build_ind; move ships; remove empty; battles; spies; tech research; **Guardian: all ships orbiting Orion deleted (37)**; explore/colonise (38); bombs; transports land (40);
ground; coups; events; artifact loot; contact/diplomacy/council; audiences; **fuel check `game_fleet_unrefuel` (60)**; update_production (61); `eco_on_waste` per player (63); update_seen; year++; tech util + tech percent (69-70); finished sliders (71); claims; within_range (73); visibility.
DEF/SHIP/IND therefore spend the output of the population AFTER this turn's growth; ECO and research use the earlier figures.

**C6 — end-of-turn auto-disable (`game_turn_finished_slider`, HUMAN planets only):** `cond_build_ind = factories < pop*oper`. IND: disabled only on the turn the factory count changed AND reached `max_pop3*oper` (so a human may keep IND on a maxed planet to bank 50 % into the reserve);
the percentage goes to TECH. ECO: after a soil/atmosphere project finished it is disabled (value `ECO - waste%` moved to IND if `cond_build_ind` else TECH, then SHIP, DEF, IND, ECO as fall-backs); with pop at max and no pending project, if `pop_growth_for_eco(ECO bc minus waste)/10 > 0`
(a whole pop could be bought) and (`pop > pop_prev` or `ECO > waste% + 7`) it is disabled likewise; a Silicoid or a waste-free empire with ECO > 0 and no waste is disabled. Shield complete: DEF -> TECH. Stargate complete: SHIP -> TECH.

**C7 — growth.** `retval = (v*pop + 5)/100` (C truncation), **then `retval += pop_tenths` (classic)**, then `if v > 0 && retval < 1 -> 1`, `if pop + retval/10 < 1 -> 1`; `build_eco` then adds `pop_tenths` AGAIN: `total = retval + bought + pop_tenths; pop += total/10; pop_tenths = total%10`
(int8, may go negative; clamp `pop` to `0..max_pop3`). Small colonies grow ~2x faster than the doc's formula: pop 2 on max 100 reaches 50 in 29 turns (46 without the quirk), max 35 reaches 19 in 18 (41) — the 18 matches the Let's-Play observation.

**C8 — waste second term (classic):** `waste += ((100 - waste*100/max_pop2) * floor(min(factories, pop*oper)*oper/10)) / 100` after `ecorestore` is computed; a fully funded cleanup (`waste = 0`) wipes it, an under-funded one keeps it (~+20 % waste at oper 2). The floor percentage excludes it.

**C9 — SHIP +1 BC:** `prod += 1` whenever the SHIP slider is > 0, after the carry and the richness multiplier (source comment: known original bug).

**C10 — transports.** Classic UI accepts `within_frange != 0` destinations in `game_transport_dest_ok` (strict only with `trans_redir_fix`; the planet UI itself checks owned + explored + range 1 + type). `transport_hp = (best armour tech tier + 1) * 15`.
Speed `have_engine`; stargate speed only when both ends are own gated planets. `trans_num` is cleared at launch (see row 33).

**C11 — colonisation:** the consumed ship is the design with the lowest colony-base min-type (e.g. a Radiated base is spent on a Terran world); AI colonises automatically; a human is prompted even when nothing can be settled the first time a star is explored.

**C12 — misc constants** (all `game_num_*` defaults): max pop 300, max factories 2500 (2700 with 1.3a), ship upkeep cap 32000, stargate cost 3000 / upkeep 100, atmosphere 200, soil 150, advanced soil 300, inbound 300, event roll 512, eco slider slack 7, advanced-scanner radius 110,
ships limit 32000, shield costs {0,500,1000,1500,2000}, FLEET_ENROUTE_MAX 260, TRANSPORT_MAX 100. Struct widths worth knowing: `bc_to_factory` uint8, `bc_to_ship` uint16, `pop_tenths` int8, `waste`/`pop`/`factories` int16, `reserve` uint32.

## Part B — implementation audit (ranked)

Status: **FIXED** = changed + test, **OPEN** = described with a patch, nothing changed. Suite after the changes: 753 passed / 3 failed (all in `60-diplo`, another agent's work in progress) / 1 skipped.

| # | Sev | Status | Finding | Repro / patch |
|---|---|---|---|---|
| B1 | HIGH | FIXED | `Geo.goLine` rounded the components and floored `atan2`: parsecs (fuel range, scanner range, contact, ETA, homeworld neighbours) 10-20 % too short (C1) | `node -e "const M=require('./tools/headless.js').load({quiet:true});console.log(M.Sim.Geo.parsecsXY(0,0,100,2))"` printed 10, now 12. `js/sim/geo.js` rewritten (tables, truncation, folding, lower-to-higher id); tests in `10-galaxy.test.js` |
| B2 | HIGH | FIXED | `applyEcoFloor` took the whole increase from SHIP/DEF/IND first and kept TECH (C3) | [20,0,40,0,40] at floor 35 gave [8,0,17,35,40]; now [13,0,26,35,26]; TECH always the remainder; Silicoids skipped; locks respected (remake option). Test in `40-colony` |
| B3 | HIGH | OPEN (decision) | pop-tenths double carry not implemented (C7): early colony growth is ~2x too slow vs the original | patch in `growPop`: before the minimum rules `natural += p.popFrac`; then `if (v > 0 && natural < 1) natural = 1; if (p.pop + Math.trunc(natural/10) < 1) natural = 1`; keep `total = natural + bought + popFrac` and use `Math.trunc` / `total % 10` (negative tenths) — put behind `Data.Config.QUIRKS.popTenthsDouble` (default recommended ON: the Let's-Play anchor needs it). Not applied: it changes every growth number the soak/AI agents tuned |
| B4 | MED | FIXED | second production pass missing (C5) | `turn.js` calls `Econ.stepProduction` again before defence; switch `Data.Config.QUIRKS.hiddenChildLabor = false`. Test in `45-economy-verify` runs a real turn |
| B5 | MED | FIXED | projects: `else if` chain, accumulator reset after soil (Gaia cost 450, not 301), leftover not flowing on (C4) | `colony.js buildEco`; PL 30-alone behaviour was already handled in techs/research by another agent; `22-research-rules` expectation updated (301 BC in one turn -> Gaia) |
| B6 | MED | FIXED | stargate completion zeroed the SHIP slider without moving it -> sliders summed < 100, BC lost; excess BC dropped; AI sliders also zeroed | `C.shipToTech`; excess carries, build item resets to design 0 |
| B7 | MED | OPEN | `Econ.autoSwitch` differs from the original (C6): IND is disabled whenever maxed (the human can no longer bank into the reserve), ECO moves to TECH only, no shield-complete rule, no `pop > pop_prev` / whole-pop test | patch: record `p._facOld` in `buildIndustry`, disable IND only if `p.factories !== old && p.factories >= max` (move to TECH); on a finished soil/atmosphere project or the pop-at-max rule move `ECO - ecoFloor` to IND if `p.factories < p.pop*oper` else TECH; after `buildDefense` completes a shield move DEF -> TECH |
| B8 | MED | OPEN (decision) | classic quirks absent: waste `sub1` term (C8), SHIP +1 BC (C9), soil rounding quirk (`inc=(m/20)*5 + ((m/20)%5 ? 5 : 0)`, Gaia `/10`) — soil rounding was deliberately "intended" in research/04 and has a test | add `Data.Config.QUIRKS.{wasteSub1, shipBonusBC, soilRounding}`; code is one line each (see C8/C9/§2.3) |
| B9 | MED | OPEN | `buildIndustry` ignores the classic refit and overflow rules (C6/row 41): when maxed it sends `floor(bc/2)` (the original sends `floor(excess_factories*cost/2)` and keeps the remainder); `operTier` / `acc.refit` exist but are unused | patch: port the `pop_oper_fact` gate (`prod/cost + fact > pop*tier` -> `acc.refit += prod`, pay `(oper-tier-bonus)*floor(factory_cost/2)` once, `tier = oper`), overflow `E.bc += floor(v*cost/2)` with `v` = whole excess factories, `acc.factory = prod % cost` |
| B10 | MED | OPEN | defence upgrade bill uses a per-planet `baseCostPaid` model; the original bills `max(0, new-old) * bases + carry`, where old/new differ only by newly owned weapon / shield / computer techs (same miniaturisation level) | needs `Design.baseCost(S, E, {basePrev})`; until then under/over-bills after miniaturisation |
| B11 | LOW | FIXED | rocks thresholds `<=` instead of `<` (C2) | `G.rocksFor`, test in `45-economy-verify` |
| B12 | LOW | FIXED | `Vis.update` let ALLIED planets scan (and auto-explore); only own planets scan, allies only extend fuel range | test with a stubbed `Diplo.isAllied` |
| B13 | LOW | (fixed meanwhile by another agent) | `Vis.canSee` used the 0/1/2/3-parsec ship radius around planets instead of `10*R` units | `vis.js` already corrected when re-read; no own-fleet scanning of STARS (`ship_scanner_fix`, radius `(10R-30)/2`) is implemented — missing feature |
| B14 | LOW | OPEN | `stepProduction`: no second ship-upkeep cap after the stargate term; spy budgets of non-contacts / self are not zeroed; factor for G = 0 is 100 (original 0, no effect) | trivial |
| B15 | LOW | OPEN | no `FLEET_ENROUTE_MAX` 260 / `TRANSPORT_MAX` 100 limits in `Fleet.send` / `launchTransports`; colony-ship choice `slots[0]` instead of the lowest min-type design; own-planet landing during rebellion adds to pop instead of fighting the rebels; no Guardian clear of Orion orbits in `turn.js` (combat may cover it) | |
| B16 | LOW | OPEN | `ecoFloorPct` uses `pop - rebels` and returns 0 when `spendable == 0` (original: full pop, prod 0 -> 1000) | cosmetic |
| B17 | INFO | OPEN | negative pop tenths use `Math.floor` (original truncates, `int8` tenths) — only visible together with B3 | |
| B18 | INFO | — | edge cases: `Setup`/`Econ` need `Design`, `Races` loaded (now present); `F.eta`/`stepTurn` throw on a state without `S.nebulae` (old saves); `chooseHomeworlds` can return null on tiny maps with 6 players -> `generate` throws after 20 regenerations (originally unbounded retry) | guard with `(S.nebulae \|\| [])` |

## NOT verified (read nothing / only the summary)

The 1oom "improved" homeworld generator, `game_event.c` (doc §3.13), `game_turn_update_trade`, ground combat beyond the transport gauntlet, ship combat, the AI planner, names / descriptive text, UI behaviour,
exact last digits of the trig tables (+-1 on ~15 of 180 entries; only sin 30 / cos 60 matter), the value of `FLEET_SPEED_STARGATE`, whether transports really cost BC in the original (row 33), the SG-only tables (T3-2 sizes, T3-8, rocks percentages),
and every Strategy-Guide / Let's-Play number (only used as cross-checks above).
