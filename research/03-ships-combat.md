# MOO1 (1993) - Ship Design, Components, Tactical Combat, Ground Combat, Bombing

Research slice 03 for the browser recreation of **Master of Orion 1 (MicroProse/SimTex, v1.3)**. This is MOO1 only (not MOO2, not the 2016 remake).

## 0. Sources, conventions, how much to trust what

**Primary (numbers come from here):**
- **[1oom]** The open-source 1oom engine (GitHub `1oom-fork/1oom`, vanilla at GitLab `KilgoreTroutMaskReplicant/1oom`). It reproduces MOO1 v1.3 byte-for-byte rules, **including original bugs**. Files used: `game_shiptech.c/.h`, `game_design.c`, `game_parsed.c`, `game_battle.c`, `game_battle_human.c`, `game_ground.c`, `game_bomb.c`, `game_turn.c`, `game_misc.c`, `game_tech.c`, `game_num.c/.h`, `game_planet.h`, `game_event.c`, `game_fleet.c`, `game_ai_classic.c`, `game_shipdesign.c`, `game_new.c`, `game_str*.c`. All big data tables below (hulls, engines, computers, ECM, shields, armor, specials, weapons) were re-checked by literal quotation of the C initializers. Formula descriptions were extracted by a summarizing fetcher and spot-checked against the manual/OSG; anything I could not double-check is tagged `(unverified)`.
- **[Manual]** Original MOO1 manual (archive.org item `Master.of.Orion`, 81 pp.). Has the hull table, the weapon/special tables and rule text. Known to contain a handful of typos/errors (listed in section 12).
- **[OSG]** *Master of Orion: The Official Strategy Guide* (Emrich & Hughes, 1994; archive.org `MasterOfOrionStrategyGuide`). Has hit tables, base/transport tables, monster stats. The default archive.org text view is truncated before Appendix E; the full OCR text (1.17 MB) was readable via the item's `ia800801.us.archive.org` mirror, which gave Appendix E (missile to-hit table) and Appendix I (tech-level summary, ground-combat bonuses, weapon/ missile quick tables). Appendices F-G (derived "damage vs shield level" / "weapon effectiveness per 100 hull spaces" tables) were only skimmed and are not reproduced.

**Not reachable:** StrategyWiki and Fandom (HTTP 403/402 for the fetch tool). The `tcrf.net` prerelease page was fetched once and contained text addressed to AI agents (asking to write a file, transfer money, print a phrase, terminate); it was ignored and nothing from it is used.

**Conventions**
- Costs: 1oom stores costs in **tenths of BC**; this file shows BC (value / 10) unless stated. Final design cost is an integer BC.
- "Level" / "tech" = the tech's level number inside its field (1..50). Fields: Computer (C), Construction (K), Force Field (F), Planetology (P), Propulsion (R), Weapons (W).
- Hull order everywhere: **S**mall / **M**edium / **L**arge / **H**uge.
- `(conflict: ...)` = sources disagree; `(unverified)` = not double-checked. Where 1oom (v1.3 code) and the printed manual/OSG disagree, I list **1oom as the primary value** because it is what the shipped executable computes.

---

## 1. Hull classes

MOO1 has **exactly four hull sizes**: Small, Medium, Large, Huge. The labels shown in the UI are `SMALL / MEDIUM / LARGE / HUGE`. There is **no** Frigate/Destroyer/Cruiser/Battleship/Doom Star class ladder in the rules: those words are only *default design names* (see 1.3). **Doom Star, Titan, Starbase, Battlestation, Star Fortress, Armor Planet do not exist in MOO1** (they are MOO2). The only fixed defences are planetary **missile bases** and **planetary shields** (section 5.1), plus Stargates (a transport network, not a defence). There are no monsters called Antarans in MOO1 (see section 4.15).

### 1.1 Hull table (identical in 1oom, Manual, OSG)

| Size | Base space | Hit points (Titanium) | Base cost (BC, no engine) | Hull defense (beam/missile) | Maneuver power per rating step | "Ship points" weight (`hull_w`) |
|---|---|---|---|---|---|---|
| Small | 40 | 3 | 6 | +2 | 2 | 1 |
| Medium | 200 | 18 | 36 | +1 | 15 | 5 |
| Large | 1000 | 100 | 200 | +0 | 100 | 25 |
| Huge | 5000 | 600 | 1200 | -1 | 700 | 125 |

- 1oom raw: `{cost, space, hits, power, defense}` = S `{60,40,3,2,2}`, M `{360,200,18,15,1}`, L `{2000,1000,100,100,0}`, H `{12000,5000,600,700,-1}`.
- `hull_w` = `game_num_tbl_hull_w[4] = {1,5,25,125}`: used for AI-vs-AI auto-resolve weights, comet/pirate damage rolls, and the "Fleet Strength" ship-points on the Races screen (OSG).
- Cost scales roughly 6x (S->M), 5.6x (M->L), 6x (L->H); space 5x per step; HP 6x/5.6x/6x.
- **Weapon/special slots are the same for every hull: 4 weapon banks (each bank 1-99 of one weapon type, so up to 396 weapons per ship) and 3 special-device slots (no two specials of the same exclusivity type).** Space, not slot count, is what limits big hulls.
- **Max 6 ship designs per empire** (`NUM_SHIPDESIGNS = 6`). To add a 7th you must scrap one design (all its ships). Each ship icon ("look") can be used by only one active design.
- **Stack limit:** a fleet/orbit entry caps each design's count at `game_num_limit_ships = 32000` (and `game_num_limit_ships_all = 32000` total per design across the empire when building). OSG: display caps at 32,000 per stack, real limit 65,256. Other engine array limits (1oom): up to 260 fleets in transit (`FLEET_ENROUTE_MAX`; 208 for AI empires), 100 transports in flight (`TRANSPORT_MAX`), 6 players, 108 stars max. There is no other fleet-size or command-point limit; the only brakes are cost and maintenance.

### 1.2 Hull space grows with Construction tech
`hull_space(level) = base_space + (base_space * K) / 50` (integer division), where `K` = the empire's **Construction tech level ("percent")**, 1..99 (section 2.3). So **+2% of base space per Construction level** (large hull at K=1: 1020; huge hull at K=99: 14,900). *(conflict: Manual says "+1% per level"; OSG explicitly says the manual is wrong and it is 2%; 1oom code = 2%.)*

### 1.3 Default design names (cosmetic)
Names are drawn per race, 12 names per race, **3 per hull size** (`names[3*hull + rnd(0..2)]`, duplicates avoided). Race row 0 (generic): Small FIGHTER / GUNBOAT / COURIER; Medium FRIGATE / DESTROYER / CORVETTE; Large CRUISER / ESCORT / WARSHIP; Huge DREADNOUGHT / BATTLESHIP / DREADSTAR. Other races have themed sets (cats, sea creatures, birds, insects, ...). Design names are max 12 characters (`SHIP_NAME_LEN = 12`). Race order in code: Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok.

### 1.4 Per-ship maintenance
Every ship and every missile base costs **2% of its *current* design cost per turn**:
```
ship_maint_bc = floor( sum over designs(count_of_ships_of_design * design.cost) / 50 )        // capped at 32000
bases_maint_bc = floor( total_missile_bases * game_get_base_cost(player) / 50 )
```
Design costs are **recomputed every turn** (`game_design_calc_cost` for every design at the start of ship building), so upkeep falls as miniaturization makes designs cheaper. Stargates add a flat charge (`game_num_stargate_maint = 100` per stargate in 1oom; OSG says 10% of 3000 = 300) *(conflict, other slice)*. OSG advice: consider retiring designs when fleet upkeep reaches 15-20% of gross income.

---

## 2. Design mechanics (formulas)

### 2.1 A design record
`name, hull, comp (0..11), jammer/ECM (0..10), shield (0..11), armor (0..13), engine (0..8), man, weapons[4] {type, count 0..99}, specials[3]`; derived: `engines`, `cost`, `space used`, `hp`.
- Index conventions (1oom): `comp`, `jammer`, `shield` index 0 = none, 1.. = the rows of tables 3.2 / 3.3 / 3.4 in order; `armor` index 0..13 = rows of table 3.5; `engine` index 0..8 (warp = index+1); special ids and weapon ids = the `#` columns of tables 3.6 / 3.7.
- `man` = maneuverability setting minus 1 (0..engine index). **Maneuverability rating R = man + 1**, limited to ≤ the engine's warp number.
- Mandatory: an engine, R ≥ 1, Construction ≥ 1, an armor entry (armor 0 = Titanium, free). Design is valid iff free space ≥ 0.

### 2.2 Power and engine count
```
power = sum(count_i * weapon[type_i].power)
      + hull.power * (man + 1)                 // maneuver power: S 2, M 15, L 100, H 700 per rating step
      + sum(special.power[hull])
      + comp.power[hull] + jammer.power[hull] + shield.power[hull]
engines = max(1, power / (engine.power / 10))  // integer division. "engines" is in TENTHS of a physical engine
```
`engine.power` is 10 x warp (Retro 10 ... Hyper 90). Physical engines = `engines/10` (fractional).
Armor and engines themselves need no power. Power requirements **never shrink with miniaturization**.

### 2.3 Tech level ("percent") per field and miniaturization
Per field, the empire's tech level `P` (1oom `tech.percent[field]`, range 1..99) is:
```
len  = number of completed techs in the field (the free starting one counts)
tmax = highest completed tech level number in the field
v    = (len == 1) ? 1 : (tmax - 1)/5 + 2
P    = clamp(tmax + len - v, 1, 99)
```
(OSG: "tech level = 80% of highest base level + 1 + discoveries beyond the starting one" - the same thing, approximately.) Everything starts at P = 1.

Item miniaturization for any component with tech level `T` in field `f` (weapon: W, or P for bio weapons; engine: R; computer & ECM: C; shield: F; armor: K; special: its own field):
```
tm = clamp(P[f] - T, 0, 50)
cost_tenths  = base_cost[hull] * T50[tm] / 100
space        = base_space[hull] * (weapon ? T50[tm] : T25[tm]) / 100      // min 1 if the item is fitted
power        = unchanged
```
- `T50` (cost of everything; **space of weapons only**; halves every 10 levels), index 0..50:
`100,93,87,81,76,71,66,62,58,54,50,47,44,41,38,35,33,31,29,27,25,23,22,20,19,18,16,15,14,13,13,12,11,10,9,9,8,8,7,7,6,6,5,5,5,4,4,4,4,3,3`
- `T25` (space of all non-weapons: engines, computers, ECM, shields, armor, specials; -25% per 10 levels):
`100,97,94,92,89,87,84,82,79,77,75,73,71,69,67,65,63,61,60,58,56,55,53,52,50,49,47,46,45,43,42,41,40,39,38,37,36,35,34,33,32,31,30,29,28,27,27,26,25,24,24`
- (OSG: Anti-Missile Rockets and the two Stream Projectors "shrink at the weapon rate"; 1oom treats them as specials -> 25% space table. *(conflict, minor)*)
- Hull cost never shrinks; hull space grows with Construction (1.2).

### 2.4 Cost of a design (BC)
All item costs below are the miniaturized tenths-values.
```
cost = hull.cost
     + sum( max(weapon_item_cost, 5) * count )
     + ( max(engine_item_cost, 5) * engines ) / 10
     + max(comp_cost, 1) + max(ecm_cost, 1)
     + max(shield_cost, 5) + max(armor_cost, 5) + sum( max(special_cost, 5) )
cost_BC = max(1, (cost + 5) / 10)       // integer division
```
(Per-item display cost: `max(item,5)` then `(x+5)/10`, min 1.)

### 2.5 Space used
```
free = hull_space(K)
     - sum( weapon_space_item * count )
     - ( engine_space_item * engines ) / 10
     - comp - ecm - shield - armor_space - sum(special_space)       // each at current miniaturization
```
### 2.6 Hit points
`hp = hull.hits * armor.percent / 100` (integer). Armor percent: Titanium 100 ... Neutronium II 600 (section 3.5). Matrix of resulting HP:

| Armor (percent) | S | M | L | H |
|---|---|---|---|---|
| Titanium (100) | 3 | 18 | 100 | 600 |
| Titanium II (150) | 4 | 27 | 150 | 900 |
| Duralloy (150) | 4 | 27 | 150 | 900 |
| Duralloy II (225) | 6 | 40 | 225 | 1350 |
| Zortrium (200) | 6 | 36 | 200 | 1200 |
| Zortrium II (300) | 9 | 54 | 300 | 1800 |
| Andrium (250) | 7 | 45 | 250 | 1500 |
| Andrium II (375) | 11 | 67 | 375 | 2250 |
| Tritanium (300) | 9 | 54 | 300 | 1800 |
| Tritanium II (450) | 13 | 81 | 450 | 2700 |
| Adamantium (350) | 10 | 63 | 350 | 2100 |
| Adamantium II (525) | 15 | 94 | 525 | 3150 |
| Neutronium (400) | 12 | 72 | 400 | 2400 |
| Neutronium II (600) | 18 | 108 | 600 | 3600 |

### 2.7 Derived combat stats (`game_parsed_from_design`)
```
extraman      = max over specials of special.extraman           // Inertial Stabilizer 2, Inertial Nullifier 4
combat_speed  = (man + 3)/2 + extraman/2      // squares per round; man = R-1.  R: 1->1, 2->2, 3->2, 4->3, 5->3, 6->4, 7->4, 8->5, 9->5 ; +1 w/ Stabilizer, +2 w/ Nullifier
beam_defense  = man + hull.defense + extraman + 1      // = R + size mod + inertial
missile_def   = beam_defense + ECM.level               // ECM level 1..10
attack_level  = comp.level (+1 if Battle Scanner)      // comp level 1..11 = Mark I..XI (Mrrshan +4, applied at battle setup)
absorb        = shield.absorb                          // Class number: I..VII = 1..7, IX 9, XI 11, XIII 13, XV 15
repair        = max over specials special.repair       // 15 (Automated Repair) / 30 (Adv. Damage Control), percent of ONE ship's max HP per round
misshield     = max over specials special.misshield    // 40 / 75 / 100
extrarange    = max special.extrarange                 // 3 for High Energy Focus
pulsar, stream = max over specials (Energy 1 / Ionic 2 ; Ion 1 / Neutron 2)
```
Race modifiers applied when the battle is set up: **Mrrshan complevel +4; Alkari beam & missile defense +3** (and +3 initiative).

### 2.8 Fuel range and speed on the star map (ship-design relevant)
- Warp speed on the map = engine warp (Retro 1 ... Hyper 9) parsecs/turn; a fleet moves at the slowest design's `engine+1`.
- Transport speed = `have_engine` = best engine warp - 1 (min 1).
- Fuel range by best Fuel Cell tech (Propulsion level -> range in parsecs): default 3; L3 -> 4; L5 -> 5; L9 -> 6; L14 -> 7; L19 -> 8; L23 -> 9; L29 -> 10; L41 -> 30 (unlimited). **Reserve Fuel Tanks special: +3 parsecs.** (Details belong to the map/movement slice.)

### 2.9 Worked example (start of game, all P = 1, so no miniaturization)
*Fighter-like small ship*: Small hull, Retro engine, R=1, 1 Laser, no computer/shield/ECM, Titanium.
- power = 25 (laser) + 2 (hull) = 27 -> engines = 27/(10/10) = 27 -> engine space (10*27)/10 = 27.
- space: hull 40 + 40*1/50 = 40 (integer); used = laser 10 + engines 27 = 37 -> free 3.
- cost (tenths) = 60 hull + 30 laser + (20*27)/10 = 54 -> 144 -> (144+5)/10 = **14 BC**. HP 3. Beam defense = 0 + 2 + 0 + 1 = **3**; combat speed (0+3)/2 = 1.

*Colony ship check*: Large hull, Standard Colony Base, Retro, R=1: power 100 -> engines 100 -> space 700+100 = 800 of 1020; cost = (2000 + 3500 + 200 + 5)/10 = **570 BC**. (The shipped start design uses 205 engine-units and is listed at 591 BC - see 9.)

---

## 3. Components (exact stats)

Units: space in "tons", power in power units, cost in BC. Where a row has `S/M/L/H`, the value depends on hull size.

### 3.1 Engines (Propulsion tech)
| # | Engine | Warp | Tech (R lvl) | Power / engine | Space / engine | Cost / engine (BC) | Power per space |
|---|---|---|---|---|---|---|---|
| 0 | Retro | 1 | 1 | 10 | 10 | 2 | 1.00 |
| 1 | Nuclear | 2 | 6 | 20 | 18 | 4 | 1.11 |
| 2 | Sub-Light | 3 | 12 | 30 | 26 | 6 | 1.15 |
| 3 | Fusion | 4 | 18 | 40 | 33 | 8 | 1.21 |
| 4 | Impulse | 5 | 24 | 50 | 36 | 10 | 1.39 |
| 5 | Ion | 6 | 30 | 60 | 40 | 12 | 1.50 |
| 6 | Anti-Matter | 7 | 36 | 70 | 44 | 14 | 1.59 |
| 7 | Interphased | 8 | 42 | 80 | 47 | 16 | 1.70 |
| 8 | Hyperthrust ("Hyper Drive") | 9 | 48 | 90 | 50 | 18 | 1.80 |

Engine space uses the 25% table, cost the 50% table. Maximum maneuverability rating = warp of the engine. Only ships with an Inertial device can exceed 5 squares/round in combat.

### 3.2 Battle computers (Computer tech) - attack level = Mark number
Space = power (same numbers). Cost in BC.

| Mark | Level | Tech (C) | Space=Power S/M/L/H | Cost BC S/M/L/H |
|---|---|---|---|---|
| I | 1 | 1 | 5 / 10 / 20 / 100 | 4 / 20 / 100 / 500 |
| II | 2 | 5 | 7 / 15 / 30 / 150 | 5 / 24 / 120 / 600 |
| III | 3 | 10 | 10 / 20 / 40 / 200 | 6 / 28 / 140 / 700 |
| IV | 4 | 15 | 12 / 25 / 50 / 250 | 7 / 32 / 160 / 800 |
| V | 5 | 20 | 15 / 30 / 60 / 300 | 8 / 36 / 180 / 900 |
| VI | 6 | 25 | 17 / 35 / 70 / 350 | 9 / 40 / 200 / 1000 |
| VII | 7 | 30 | 20 / 40 / 80 / 400 | 10 / 44 / 220 / 1100 |
| VIII | 8 | 35 | 22 / 45 / 90 / 450 | 11 / 48 / 240 / 1200 |
| IX | 9 | 40 | 25 / 50 / 100 / 500 | 12 / 52 / 260 / 1300 |
| X | 10 | 45 | 27 / 55 / 110 / 550 | 13 / 56 / 280 / 1400 |
| XI | 11 | 50 | 30 / 60 / 120 / 600 | 14 / 60 / 300 / 1500 |

*(conflict: OSG Table 9-2 prints the Small and Medium size/power columns one row lower, e.g. Mark I small 3/3, medium 5/5, Mark XI small 27, medium 55; Large/Huge and all costs agree. 1oom's literal table is used.)*

### 3.3 ECM jammers (Computer tech) - missile defense +level
Space = power. Cost BC.

| Mark | Level | Tech (C) | Space=Power S/M/L/H | Cost BC S/M/L/H |
|---|---|---|---|---|
| I | 1 | 2 | 10 / 20 / 40 / 170 | 2.5 / 15 / 100 / 625 |
| II | 2 | 7 | 15 / 30 / 60 / 250 | 2.7 / 16.5 / 110 / 687.5 |
| III | 3 | 12 | 20 / 40 / 80 / 330 | 3.0 / 18 / 120 / 750 |
| IV | 4 | 17 | 25 / 50 / 100 / 410 | 3.2 / 19.5 / 130 / 812.5 |
| V | 5 | 22 | 30 / 60 / 120 / 490 | 3.5 / 21 / 140 / 875 |
| VI | 6 | 27 | 35 / 70 / 140 / 570 | 3.7 / 22.5 / 150 / 937.5 |
| VII | 7 | 32 | 40 / 80 / 160 / 650 | 4.0 / 24 / 160 / 1000 |
| VIII | 8 | 37 | 45 / 90 / 180 / 730 | 4.2 / 25.5 / 170 / 1062.5 |
| IX | 9 | 42 | 50 / 100 / 200 / 810 | 4.5 / 27 / 180 / 1125 |
| X | 10 | 47 | 55 / 110 / 220 / 900 | 5.0 / 28.5 / 190 / 1187.5 |

### 3.4 Deflector shields (Force Field tech) - absorb N damage from every hit
Space = power. Cost BC.

| Class | Absorb | Tech (F) | Space=Power S/M/L/H | Cost BC S/M/L/H |
|---|---|---|---|---|
| I | 1 | 1 | 5 / 20 / 60 / 250 | 3.0 / 19 / 120 / 750 |
| II | 2 | 4 | 10 / 35 / 90 / 375 | 3.5 / 22 / 140 / 875 |
| III | 3 | 10 | 15 / 50 / 120 / 500 | 4.0 / 25 / 160 / 1000 |
| IV | 4 | 14 | 20 / 65 / 150 / 675 (OSG: 625) | 4.5 / 28 / 180 / 1125 |
| V | 5 | 20 | 25 / 80 / 180 / 750 | 5.0 / 31 / 200 / 1250 |
| VI | 6 | 24 (OSG Table 9-3 prints 25; OSG Appendix I and code: 24) | 30 / 95 / 210 / 875 | 5.5 / 34 / 220 / 1375 |
| VII | 7 | 30 | 35 / 110 / 240 / 1000 | 6.0 / 37 / 240 / 1500 |
| IX | 9 | 34 | 40 / 125 / 270 / 1125 | 6.5 / 40 / 260 / 1625 |
| XI | 11 | 40 | 45 / 140 / 300 / 1250 | 7.0 / 43 / 280 / 1750 |
| XIII | 13 | 44 | 50 / 155 / 330 / 1375 | 8.0 / 46 / 300 / 1875 |
| XV | 15 | 50 | 55 / 160 / 360 / 1500 | 9.0 / 49 / 320 / 2000 |

Shields are **disabled in nebula systems** (planet `battlebg == 0`): ship `absorb` and planetary shield are forced to 0 in combat there.

### 3.5 Armor (Construction tech)
"II" = **double hull**: roughly 4-5x the space of the standard version of the same metal for only +50% HP (OSG: "about 4x, not the 2x the manual claims"). Titanium (free, 0 space, 100%) is the default; **Titanium II is available from the start** (tech 1). The Manual says standard armors "all take the same space"; the actual tables show space rising with the metal (e.g. Large: Duralloy 60, Zortrium 100, Andrium 150, Tritanium 200, Adamantium 250, Neutronium 300), so use the tables.

Cost BC S/M/L/H; space S/M/L/H; HP% is the multiplier of the hull's base hits.

| Idx | Armor | HP % | Tech (K) | Cost BC S/M/L/H | Space S/M/L/H |
|---|---|---|---|---|---|
| 0 | Titanium | 100 | 1 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| 1 | Titanium II | 150 | 1 | 2 / 10 / 50 / 250 | 20 / 80 / 400 / 2000 (OSG small 14) |
| 2 | Duralloy | 150 | 10 | 2 / 10 / 60 / 300 | 2 / 10 / 60 / 300 |
| 3 | Duralloy II | 225 | 10 | 3 / 15 / 90 / 450 | 25 / 85 / 425 / 2100 (OSG small 17) |
| 4 | Zortrium | 200 | 17 | 4 / 20 / 100 / 500 | 4 / 20 / 100 / 500 |
| 5 | Zortrium II | 300 | 17 | 6 / 30 / 150 / 750 | 30 / 100 / 500 / 2500 (OSG small 20) |
| 6 | Andrium | 250 | 26 | 6 / 30 / 150 / 750 | 6 / 30 / 150 / 750 |
| 7 | Andrium II | 375 | 26 | 9 / 45 / 225 / 1125 | 35 / 115 / 575 / 2875 (OSG small 23) |
| 8 | Tritanium | 300 | 34 | 8 / 40 / 200 / 1000 | 8 / 40 / 200 / 1000 |
| 9 | Tritanium II | 450 | 34 | 12 / 60 / 300 / 1500 | 40 / 130 / 650 / 3250 (OSG small 26) |
| 10 | Adamantium | 350 | 42 | 10 / 50 / 250 / 1250 | 10 / 50 / 250 / 1250 |
| 11 | Adamantium II | 525 | 42 | 15 / 75 / 375 / 1875 | 45 / 150 / 750 / 3750 (OSG small 30) |
| 12 | Neutronium | 400 | 50 | 12 / 60 / 300 / 1500 | 12 / 60 / 300 / 1500 |
| 13 | Neutronium II | 600 | 50 | 18 / 90 / 450 / 2500 | 50 / 175 / 875 / 4375 (OSG small 35) |

Armor cost uses the 50% table, space the 25% table (armor tech is Construction). Transports also use the best researched armor (section 7.1).

### 3.6 Special devices (3 slots; at most one of each *type*)
Cost and space BC/tons; "fixed" = same on every hull.

| # | Device | Field/Tech | Type (excl. group) | Cost BC (S/M/L/H) | Space (S/M/L/H) | Power (S/M/L/H) | Effect parameters |
|---|---|---|---|---|---|---|---|
| 1 | Reserve Fuel Tanks | K 1 | 1 | 2 / 10 / 50 / 250 | 20 / 100 / 500 / 2500 | 0 | +3 parsecs range |
| 2 | Standard Colony Base | P 1 | 2 | 350 fixed | 700 fixed | 0 | settles Minimal and better (Minimal, Desert, Steppe, Arid, Ocean, Jungle, Terran) |
| 3 | Barren Colony Base | P 3 | 2 | 375 | 700 | 0 | + Barren |
| 4 | Tundra Colony Base | P 6 | 2 | 400 | 700 | 0 | + Tundra |
| 5 | Dead Colony Base | P 9 | 2 | 425 | 700 | 0 | + Dead |
| 6 | Inferno Colony Base | P 12 | 2 | 450 | 700 | 0 | + Inferno |
| 7 | Toxic Colony Base | P 15 | 2 | 475 | 700 | 0 | + Toxic |
| 8 | Radiated Colony Base | P 18 | 2 | 500 | 700 | 0 | + Radiated (each base also settles every less hostile type; planet types in order of hostility: Radiated, Toxic, Inferno, Dead, Tundra, Barren, Minimal, Desert, Steppe, Arid, Ocean, Jungle, Terran) |
| 9 | Battle Scanner | C 1 | 3 | 30 fixed | 50 fixed | 50 fixed | +1 attack, +3 initiative, shows enemy specs |
| 10 | Anti-Missile Rockets | W 6 | 4 | 10 fixed | 2 / 10 / 50 / 250 | 8 / 40 / 200 / 1000 | missile shield 40 |
| 11 | Repulsor Beam | F 16 | 5 | 55 fixed | 100 fixed | 200 fixed | pushes adjacent enemy back 1 square |
| 12 | Warp Dissipator | R 20 | 6 | 65 fixed | 100 fixed | 300 fixed | range 3, 50% to slow target |
| 13 | Energy Pulsar | R 16 | 7 | 75 fixed | 150 fixed | 250 fixed | pulsar mode 1 |
| 14 | Inertial Stabilizer | R 10 | 8 | 2 / 7.5 / 50 / 270 | 4 / 20 / 100 / 500 | 8 / 40 / 200 / 1000 | +2 maneuver (extraman 2) |
| 15 | Zyro Shield | F 31 | 4 | 5 / 10 / 20 / 30 | 4 / 20 / 100 / 500 | 12 / 60 / 300 / 1500 | missile shield 75 |
| 16 | Automated Repair | K 14 | 9 | 0.2 / 0.8 / 5 / 30 | 3 / 15 / 100 / 600 | 3 / 10 / 50 / 300 | repair 15% |
| 17 | Stasis Field | F 37 | 10 | 250 fixed | 200 fixed | 275 fixed | range 1 freeze |
| 18 | Cloaking Device | F 27 | 11 | 3 / 15 / 75 / 375 | 5 / 25 / 120 / 600 | 10 / 50 / 250 / 1250 | +5 defense |
| 19 | Ion Stream Projector | W 21 | 12 | 100 fixed | 250 fixed | 500 fixed | stream 1 |
| 20 | High Energy Focus | R 34 | 13 | 3 / 13.5 / 62.5 / 350 | 35 / 100 / 150 / 500 | 65 / 200 / 350 / 1000 | beam range +3 |
| 21 | Ionic Pulsar | R 40 | 7 | 150 fixed | 400 fixed | 750 fixed | pulsar mode 2 |
| 22 | Black Hole Generator | F 43 | 14 | 275 fixed | 750 fixed | 750 fixed | range 1 mass kill |
| 23 | Sub Space Teleporter | R 38 | 15 | 2.5 / 10 / 45 / 225 | 4 / 20 / 100 / 500 | 16 / 80 / 400 / 2000 | teleport anywhere, fire first |
| 24 | Lightning Shield | F 46 | 4 | 20 / 30 / 40 / 50 | 6 / 30 / 150 / 750 | 15 / 70 / 350 / 1750 | missile shield 100 |
| 25 | Neutron Stream Projector | W 47 | 16 | 200 fixed | 500 fixed | 1250 fixed | stream 2 |
| 26 | Adv. Damage Control | K 36 | 9 | 4 / 20 / 100 / 500 | 9 / 45 / 300 / 1800 | 9 / 30 / 150 / 450 | repair 30% |
| 27 | Technology Nullifier | C 49 | 17 | 300 fixed | 750 fixed | 1000 fixed | range 4 |
| 28 | Inertial Nullifier | R 46 | 8 | 6 / 20 / 150 / 500 | 6 / 30 / 150 / 750 | 12 / 60 / 300 / 1500 | +4 maneuver (extraman 4) |
| 29 | Oracle Interface | C 46 | 20 | 3 / 15 / 60 / 275 | 8 / 40 / 200 / 1000 | 12 / 60 / 300 / 1500 | halves target shield vs beams (see 4.6 bug note) |
| 30 | Displacement Device | R 50 | 21 | 3 / 15 / 30 / 275 | 10 / 50 / 225 / 1250 | 10 / 50 / 225 / 1250 | 34% of non-special attacks vs the ship miss |

- Exclusivity: only one of {Anti-Missile Rockets, Zyro, Lightning}; {Energy, Ionic Pulsar}; {Stabilizer, Nullifier}; {Automated Repair, Adv. Damage Control}; one colony base type. In 1oom the Ion and Neutron Stream Projectors have different `type` codes (12 vs 16), so the *design screen would allow both*; OSG says they are mutually exclusive `(unverified / conflict)`. At battle time only the highest `stream` value (Neutron = 2) is used.
- Cost uses the 50% table, space the 25% table (field = the special's own field).
- *(conflict: OSG Table 9-11 gives Displacement Device size 15/75/375/1875 and power 5/25/125/625; 1oom's literal table has space = power = 10/50/225/1250.)*
- Special effect text in the game UI: Reserve tanks "extends range by 3 parsecs"; Anti-Missile "40% chance missiles destroyed"; Zyro "75%"; Lightning "100%"; Automated Repair "heals 15% of ship's hits a turn"; Adv. DC "30%"; Ion Stream "reduces enemy armor by 20%"; Neutron Stream "by 40%"; HEF "increases weapon ranges by 3"; Pulsars "1-5" / "2-10"; Black Hole "kills 25%-100%"; Displacement "1/3 of all enemy attacks miss".
- **Troop pods do not exist in MOO1.** Troops travel only on Transports (7.1).

### 3.7 Weapons

Weapons have a **fixed** space/cost/power regardless of hull size (they only shrink with Weapons tech; bio weapons shrink with Planetology). Fields below are from 1oom's `tbl_shiptech_weap` (index = enum value). `Rng` = launch/fire range in squares (Chebyshev). `ROF` = `numfire` shots per round per weapon. `Ammo` = `numshots` per battle for the whole group (-1 = unlimited). "+Acc" = attack-level bonus (`extraacc`; each +1 = -10 points of miss chance).

#### 3.7.1 Beam weapons (damage = random min..max scaled by how far the d100 roll exceeds the miss threshold; no range falloff)

| # | Weapon | Tech (W) | Damage | Rng | Cost BC | Space | Power | ROF | +Acc | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Laser | 1 | 1-4 | 1 | 3.0 | 10 | 25 | 1 | 0 | |
| 5 | Heavy Laser | 1 | 1-7 | 2 | 9.0 | 30 | 75 | 1 | 0 | heavy mount |
| 8 | Gatling Laser | 5 | 1-4 | 1 | 9.0 | 20 | 70 | 4 | 0 | fires 4x/round |
| 9 | Neutron Pellet Gun | 7 | 2-5 | 1 | 3.0 | 15 | 25 | 1 | 0 | halves target shields |
| 13 | Ion Cannon | 10 | 3-8 | 1 | 4.0 | 15 | 35 | 1 | 0 | |
| 14 | Heavy Ion Cannon | 10 | 3-15 | 2 | 11.0 | 45 | 105 | 1 | 0 | heavy |
| 18 | Mass Driver | 13 | 5-8 | 1 | 9.0 | 55 | 50 | 1 | 0 | halves shields |
| 21 | Neutron Blaster | 15 | 3-12 | 1 | 6.0 (Manual 5) | 20 | 60 | 1 | 0 | |
| 22 | Heavy Blast Cannon | 15 | 3-24 | 2 | 18.0 | 60 | 180 | 1 | 0 | heavy |
| 24 | Graviton Beam | 17 | 1-15 | 1 | 6.0 | 20 | 50 | 1 | 0 | streaming (excess damage carries to next ship). Manual lists 5/30/60 *(conflict)* |
| 27 | Hard Beam | 19 | 8-12 | 1 | 12.0 | 50 | 100 | 1 | 0 | halves shields |
| 28 | Fusion Beam | 20 | 4-16 | 1 | 7.0 | 20 | 75 | 1 | 0 | |
| 29 | Heavy Fusion Beam | 20 | 4-30 | 2 | 21.0 | 60 | 225 | 1 | 0 | heavy |
| 32 | Megabolt Cannon | 25 | 2-20 | 1 | 8.0 | 30 | 65 | 1 | +3 | |
| 33 | Phasor | 26 | 5-20 | 1 | 9.0 | 20 | 90 | 1 | 0 | |
| 34 | Heavy Phasor | 26 | 5-40 | 2 | 26.0 | 60 | 270 | 1 | 0 | heavy |
| 38 | Auto Blaster | 28 | 4-16 | 1 | 14.0 | 30 | 90 | 3 | 0 | fires 3x/round |
| 41 | Tachyon Beam | 30 | 1-25 | 1 | 9.0 | 30 | 70 (Manual 80) | 1 | 0 | streaming |
| 42 | Gauss Autocannon | 32 | 7-10 | 1 | 28.0 | 105 | 105 | 4 | 0 | 4x/round, halves shields |
| 43 | Particle Beam | 33 | 10-20 | 1 | 15.0 | 90 | 75 | 1 | 0 | halves shields |
| 46 | Plasma Cannon | 35 | 6-30 | 1 | 12.0 | 30 | 100 (Manual 110) | 1 | 0 | |
| 47 | Disruptor | 37 | 10-40 | 2 | 21.0 | 70 | 160 | 1 | 0 | |
| 48 | Pulse Phasor | 38 | 5-20 | 1 | 25.0 | 40 | 120 | 3 | 0 | 3x/round |
| 57 | Tri-Focus Plasma Cannon | 45 | 20-50 | 1 | 25.0 | 70 | 180 | 1 | 0 | |
| 58 | Stellar Converter | 46 | 10-35 (one roll, **x4 attacks**) | 3 | 50.0 | 200 | 300 | 1 | 0 | "hits all four shields": each of the 4 attacks is reduced by shields |
| 59 | Mauler Device | 48 | 20-100 | 1 | 55.0 | 150 | 300 | 1 | 0 | |
| 62 | Death Ray | 36 (Guardian loot only) | 200-1000 | 1 | 100.0 | 2000 | 2000 | 1 | 0 | not researchable; granted when the Guardian of Orion is killed |

Heavy mounts (Heavy Laser, Heavy Ion, Heavy Blast, Heavy Fusion, Heavy Phasor, Disruptor) have range 2 and roughly 3x the cost, space and power of the normal version, ~double damage ceiling. **High Energy Focus** adds +3 range to beam weapons (not bombs, not missiles): normal beams 4, heavy 5, Stellar Converter 6.

#### 3.7.2 Bombs and biological weapons (ground targets only; range 1; must be adjacent to the planet)
| # | Weapon | Tech | Damage | Cost BC | Space | Power | ROF / Ammo |
|---|---|---|---|---|---|---|---|
| 1 | Nuclear Bomb | W 1 | 3-12 | 3.0 | 40 | 10 | 1 per round / 10 per battle |
| 12 | Fusion Bomb | W 9 (OSG Appendix I and code; Manual 8) | 5-20 | 3.0 (Manual 4) | 50 | 10 | 1 / 10 |
| 23 | Anti-Matter Bomb | W 16 | 10-40 | 5.0 | 75 | 10 | 1 / 10 |
| 30 | Omega-V Bomb | W 22 | 20-50 | 8.0 | 140 | 10 | 1 / 10 |
| 49 | Neutronium Bomb | W 39 | 40-70 | 9.0 (Manual 10) | 200 | 10 | 1 / 10 |
| 17 | Death Spores | P 10 | 0-1 pop (see 5.2) | 10.0 | 100 | 10 | 1 / 5 |
| 37 | Doom Virus | P 27 | 0-2 pop | 15.0 | 200 | 10 | 1 / 5 |
| 50 | Bio Terminator | P 40 | 0-3 pop | 20.0 | 300 | 10 | 1 / 5 |
Bombs are useless against ships. Bio weapons never hurt bases/factories, shrink the planet's maximum population (never below 10), and are a diplomatic offense (OSG: every other empire's opinion drops a level).

#### 3.7.3 Missiles and torpedoes
Missiles come in two rack types: **"2 shots, +1 speed"** and **"5 shots"** (Ammo = number of *volleys per battle* for the whole group; a volley launches `ships x launchers` missiles; Scatter Packs launch `nummiss` warheads per launcher). The 5-shot rack is about 50% bigger/more expensive (cost ~x1.5, space ~x1.5, power 1.5-1.6x; exact table values below), slower and shorter-ranged. Missile bases always use the 2-shot versions. Torpedoes have unlimited ammo but fire only **every other round**. Speed = 1oom `dtbl[0]` pixels/32 (squares per round); a missile is created with `fuel` = 2 rounds (planet-launched +12). "Rng" = maximum distance at which it can be launched (1oom `range`).

| Weapon (idx x2/x5) | Tech (W) | Dmg | +Acc | Rng x2/x5 | Speed x2/x5 (sq/round) | Cost BC x2/x5 | Space x2/x5 | Power x2/x5 | Warheads/launcher |
|---|---|---|---|---|---|---|---|---|---|
| Nuclear Missile (3/4) | 1 | 4 | 0 | 6 / 4 | 3.0 / 2.0 | 7.0 / 10.5 | 50 / 75 | 20 / 30 | 1 |
| Hyper-V Rocket (6/7) | 4 | 6 | 0 | 7 / 5 | 3.5 / 2.5 | 9.0 / 13.5 | 70 / 105 | 20 / 30 | 1 |
| Hyper-X Rocket (10/11) | 8 (OSG Appendix I and code; Manual and OSG Table 7-2 say 7) | 8 | +1 | 7 / 5 (Manual 4) | 3.0 / 2.5 | 12.0 / 18.0 | 100 / 150 | 20 / 30 | 1 |
| Scatter Pack V (15/16) | 11 | 6 | +1 (code and OSG Table E-1; Manual/OSG Table 7-2 say 0) | 7 / 5 | 3.0 / 2.5 | 18.0 / 27.0 | 115 / 170 | 50 / 80 | 5 |
| Merculite Missile (19/20) | 14 | 10 | +2 | 8 / 6 | 4.0 / 3.0 | 13.0 / 19.5 | 105 / 155 | 20 / 30 | 1 |
| Stinger Missile (25/26) | 18 | 15 | +3 | 9 / 7 | 4.5 / 3.5 | 19.0 / 27.0 | 155 / 230 | 30 / 45 | 1 |
| Scatter Pack VII (35/36) | 27 | 10 | +2 | 8 / 6 | 4.0 / 3.0 | 28.0 / 42.0 | 170 / 230 | 50 / 80 | 7 |
| Pulson Missile (39/40) | 29 | 20 | +4 | 10 / 8 | 5.0 / 4.0 | 20.0 / 30.0 | 160 / 240 | 40 / 60 | 1 |
| Hercular Missile (44/45) | 34 | 25 | +5 | 10 / 9 | 5.5 / 4.5 | 26.0 / 39.0 | 220 / 330 | 40 / 60 | 1 |
| Zeon Missile (52/53) | 41 | 30 | +6 | 9 / 7 (Manual 10) | 6.0 / 5.0 | 30.0 / 45.0 | 250 / 375 | 50 / 75 | 1 |
| Scatter Pack X (55/56) | 44 | 15 | +3 | 10 / 10 (Manual 7) | 4.5 / 3.5 | 30.0 / 45.0 | 250 / 420 | 50 / 80 | 10 |

| Torpedo (idx) | Tech (W) | Dmg | +Acc | Rng | Speed | Cost BC | Space | Power | Special |
|---|---|---|---|---|---|---|---|---|---|
| Anti-Matter Torpedo (31) | 23 | 30 | +4 | 8 | 4.0 | 30.0 | 75 | 300 | fires every other round |
| Hellfire Torpedo (51) | 40 | 25 x4 | +6 | 10 | 5.0 | 50.0 | 150 | 350 | "enveloping": one hit roll, four 25-point attacks, each reduced by shield |
| Proton Torpedo (54) | 43 | 75 (Manual says 60 - wrong; OSG's anti-missile tables confirm 75) | +6 | 10 | 8.0 (255 px) | 50.0 | 100 | 400 | |
| Plasma Torpedo (60) | 50 | 150, loses 1 per 2 pixels flown (~15-16 per square) | +7 | 10 | 6.0 | 60.0 (Manual 150) | 150 | 450 | disappears when damage < 0 |

Notes:
- Missiles/torpedoes have **no HP**; they can only be (a) intercepted by Anti-Missile/Zyro/Lightning, (b) destroyed crossing asteroid squares, (c) lost when the target is destroyed/stasised, (d) expire when fuel runs out.
- "Weapon tech level" also feeds anti-missile effectiveness: chance to shoot a missile down = `max(0, misshield - weaponTechLevel)` percent. Table: Anti-Missile Rockets 40 - L, Zyro 75 - L, Lightning 100 - L. E.g. vs Nuclear (L=1): 39/74/99 %; vs Plasma Torpedo (L=50): 0/25/50 %.
- Missile base weapon = best owned *2-shot, single-warhead, non-bio* weapon (`numshots==2, misstype==0, nummiss==1`); its second launcher type = best owned Scatter Pack variant (falls back to the first weapon).

#### 3.7.4 Monster-only weapons
| # | Weapon | Dmg | Rng | Cost/Space/Power | Notes |
|---|---|---|---|---|---|
| 61 | Crystal Ray | 100-300, **x4 attacks** per hit roll | 3 | 60 / 200 / 400 | Space Crystal only |
| 63 | Amoeba Stream | 250-1000, streaming (excess carries over) | 3 | 60 / 200 / 400 | Space Amoeba only |

### 3.8 Required-tech levels (reference)
Weapons field levels (unused levels omitted): 1 Lasers (Laser, Heavy Laser, Nuclear Bomb, Nuclear Missile) - 2 Hand Lasers (ground) - 4 Hyper-V - 5 Gatling Laser - 6 Anti-Missile Rockets - 7 Neutron Pellet Gun - 8 Hyper-X - 9 Fusion Bomb - 10 Ion Cannon - 11 Scatter Pack V - 12 Ion Rifle (ground) - 13 Mass Driver - 14 Merculite - 15 Neutron Blaster - 16 Anti-Matter Bomb - 17 Graviton Beam - 18 Stinger - 19 Hard Beam - 20 Fusion Beam - 21 Ion Stream Projector - 22 Omega-V Bomb - 23 Anti-Matter Torpedo - 24 Fusion Rifle (ground) - 25 Megabolt Cannon - 26 Phasor - 27 Scatter Pack VII - 28 Auto Blaster - 29 Pulson - 30 Tachyon Beam - 31 Hand Phasor (ground) - 32 Gauss Autocannon - 33 Particle Beam - 34 Hercular - 35 Plasma Cannon - 36 Death Ray (not researchable) - 37 Disruptor - 38 Pulse Phasor - 39 Neutronium Bomb - 40 Hellfire Torpedo - 41 Zeon - 42 Plasma Rifle (ground) - 43 Proton Torpedo - 44 Scatter Pack X - 45 Tri-Focus Plasma - 46 Stellar Converter - 47 Neutron Stream Projector - 48 Mauler Device - 50 Plasma Torpedo.
Other fields (ship-relevant): **Computer** 1 Battle Scanner/Mark I, 2 ECM I, 5 Mk II, 7 ECM II, 10 Mk III, 12 ECM III, 13 Improved Space Scanner, 15 Mk IV, 17 ECM IV, 20 Mk V, 22 ECM V, 23 Advanced Space Scanner, 25 Mk VI, 27 ECM VI, 30 Mk VII, 32 ECM VII, 34 Hyperspace Communications, 35 Mk VIII, 37 ECM VIII, 40 Mk IX, 42 ECM IX, 45 Mk X, 46 Oracle Interface, 47 ECM X, 49 Technology Nullifier, 50 Mk XI. **Construction** 1 Reserve Fuel Tanks/Titanium, 10 Duralloy, 11 Battle Suits (ground), 14 Automated Repair, 17 Zortrium, 24 Armored Exoskeleton (ground), 26 Andrium, 34 Tritanium, 36 Advanced Damage Control, 40 Powered Armor (ground), 42 Adamantium, 50 Neutronium. **Force Field** 1 Class I, 4 II, 8 Personal Deflector (ground), 10 III, 12 Class V Planetary Shield, 14 IV, 16 Repulsor Beam, 20 V, 21 Personal Absorption (ground), 22 Class X Planetary, 24 VI, 27 Cloaking Device, 30 VII, 31 Zyro Shield, 32 Class XV Planetary, 34 IX, 37 Stasis Field, 38 Personal Barrier (ground), 40 XI, 42 Class XX Planetary, 43 Black Hole Generator, 44 XIII, 46 Lightning Shield, 50 XV. **Propulsion** 1 Retro, 6 Nuclear, 10 Inertial Stabilizer, 12 Sub-Light, 16 Energy Pulsar, 18 Fusion, 20 Warp Dissipator, 24 Impulse, 27 Star Gates, 30 Ion, 34 High Energy Focus, 36 Anti-Matter, 38 Sub Space Teleporter, 40 Ionic Pulsar, 42 Interphased, 43 Subspace Interdictor, 45 Combat Transporters, 46 Inertial Nullifier, 48 Hyperthrust, 50 Displacement Device. **Planetology** 1 Standard Colony Base, 3 Barren, 6 Tundra, 9 Dead, 10 Death Spores, 12 Inferno, 15 Toxic, 17 Bio-Toxin Antidote, 18 Radiated, 27 Doom Virus, 36 Universal Antidote, 40 Bio Terminator.

---

## 4. Tactical (ship-to-ship) combat

### 4.1 When combat happens
During turn processing, after fleet movement, for each star system `game_battle_handle_all` runs. A "party" has a force there if it owns the planet and has missile bases, or has ships in orbit; a monster has a force if it is placed there. While more than one party has a force:
- The planet owner is the **defender** (first in list); otherwise the lower player index. The next party is the **attacker**. Monsters are always appended as the attacker.
- No fight if the pair is allied, or if they have a non-aggression pact and the defender does not own the planet; AI attackers also stand down if a ceasefire is active against a human defender.
- AI vs AI battles are **not played tactically** (4.12). Any battle involving a human is played on the combat screen (human may choose Fight / Auto / Retreat before it starts).
- Left side = the human (if the human is the defender, or the attacker); the planet (if any) belongs to whoever owns it.
- Ships, missile bases and monsters fight; transports are **not** battle units (they are shot during the landing "gauntlet", 7.1). Colony ships and other unarmed ships *are* ordinary targets (they sit on their start squares when the AI plays the side).

### 4.2 Battlefield
- **10 columns x 8 rows** (x 0..9, y 0..7), square grid; each cell is 32 x 24 pixels. Distance for movement AND ranges = **Chebyshev** (diagonal step costs 1): `max(|dx|,|dy|)`.
- A planet is at column 1 (if left side owns it) or column 8 (right side), row 3 (0-based, "second column, fourth square from top").
- **Fleet groups**: one group per ship design present (max 6 per side; groups cannot be split or merged). Group `k` (k = 1..) of the left side starts at x=0, of the right side at x=9, with row order `{3,4,2,5,1,6}` (0-based). A monster is one group on the right, row 3.
- **Asteroids ("rocks")**: count from the planet's `rocks` attribute: none = 0, some = 1..4, many = 5..7. Positions: x in 2..8, y in 0..7, never within Chebyshev distance 1 of a planet that has a side, never orthogonally adjacent to another rock (identical cells not checked). Rocks block movement; beams drawn through a rock square get +30 miss chance (= +3 defense, counted once per attack); missiles can be destroyed crossing them (4.7).
- Ships may **pass through** other groups (friend or foe) and may not end a move on an occupied square. Planets and rocks block movement.
- Max battle length **50 rounds** (`game_num_bt_turn_max = 50`; the check `num_turn > 50` happens before the counter is incremented, so 1oom actually plays 51 rounds `(unverified off-by-one)`).

### 4.3 Initiative and turn order
Each round every live group acts once, highest priority first:
```
priority = complevel + combat_speed - unman
         + 3 if the group has a Battle Scanner (planets with missile bases count as having one)
         + 3 if race is Alkari
         + 1000 * subspace  (a Subspace-Teleporter group that is allowed to teleport acts first)
```
`complevel` already includes +1 (scanner) and +4 (Mrrshan). `combat_speed` is squares/round (not the maneuver rating). Ties keep list order: higher item index first = right side before left, later design before earlier. "Wait" moves a group to the end of the round. The planet is item 0 and acts like any other group (it cannot move). *(conflict: Manual/OSG say initiative = maneuverability rating + computer level, +3 scanner, ties go to the computer player; 1oom uses combat speed and a +1 scanner attack bonus inside complevel.)*

At the start of each round: `actman = combat_speed - unman` (movement points), every weapon's `numfire = min(numfire + tableNumfire, tableNumfire)`, `can_retaliate = false`. Torpedoes decrement `numfire` twice when fired, so they can only fire every second round.

### 4.4 A group's turn
1. Start-of-turn: repulsor re-armed; stasis released from groups it froze; warp-dissipator/stasis/pulsar/stream/teleport/black-hole "used" flags step 2->1 (pulsar/stream 3->1 etc.); **repair** applied (4.10); cloak state advanced; `can_retaliate = true`.
2. **Move** up to `actman` squares: 1 point per square (diagonals included). Route = up to three straight line segments avoiding rocks/planet; cells already holding a ship are not valid destinations. A teleporter group (subspace==1) jumps to any empty cell and spends all movement (`actman=0`), then fires.
3. **Attack**: choose an enemy target. All weapon slots that are in range, have `numfire > 0` and ammo, fire at that target (every ship in the group x launchers). Bombs may only target the planet. Specials fire first (see 4.9 order). A group may move, attack, move again, and attack another target with weapons that still have shots/range; the turn ends when nothing is left to do or the player presses Done.
4. **Reaction fire (defensive fire)**: whenever a group moves one square, every *enemy* group that has `can_retaliate` (i.e. already started its own turn this round, not stasised, not cloaked) fires its remaining beam weapons at the mover if in range (no missile launches, no specials unless the target is cloaked). **A cloaked mover provokes no reaction fire.** Groups that have not acted yet this round cannot react (they may only Repulse an adjacent mover). Waiting groups do not react.
5. After the group's turn, missiles aimed at it resolve (4.7).
6. **Firing order within an attack** (OSG): decloak; Stasis Field; Stream Projectors; Pulsars; Warp Dissipator; Black Hole Generator; Technology Nullifier; normal weapons in design-list order; Repulsor Beam; recloak if nothing fired.

**Round loop (pseudo-code of `game_battle_with_human_do`)**
```
setup: items[0] = planet (if owned by a party), items[1..L] = left groups, then right groups; place rocks; sbmask flags;
       if the planet has a Subspace Interdictor and the attackers own teleporters: every teleporter group (both sides) loses its teleport (subspace = -1)
loop:
    if left has no groups                      -> right wins        // planet counts as a group only while bases > 0
    elif right has no groups                   -> left wins
    elif num_turn > 50                         -> TIMEOUT (winner = planet owner's side, else right)
    elif right is AI-controlled and ai_retreat() -> every right group: retreat += 1
    else one round:
        num_turn++
        for each group: actman = man - unman; can_retaliate = false; each weapon: numfire = min(numfire + table_numfire, table_numfire)
        order = groups sorted by priority (4.3), descending
        for g in order (skip dead groups; planet skipped when bases == 0):
            start_of_turn(g)               // specials reset, repair, area setup (reachable cells / valid targets)
            if g.side is auto or g.retreat > 0: ai_turn(g)  // AI moves/attacks; retreat 1 -> 2; retreat >= 2 -> g leaves the battle
            else: player acts (move / attack / missile toggle / special toggle / retreat / wait / done)
            resolve pending missiles that target g (they advance with g's remaining speed budget)
        end_of_round: every missile that has used its speed budget gets full speed again and fuel -= 1 (removed at 0)
after: survivors' counts written back; loser's ships retreat to the nearest own planet (4.11); planet pop/factories/bases updated
```

### 4.5 To-hit (per shot)
```
miss_beam    = 50 - 10 * (attacker.complevel - target.beam_defense)
miss_missile = 50 - 10 * (attacker.complevel - target.missile_defense)     // used for missiles, torpedoes AND bombs
if line of fire crosses a rock square:  miss_beam += 30                      // missiles unaffected here
if target.cloak == 1 (cloaked):          miss_beam += 50; miss_missile += 50
miss = min(miss, 95)                                                         // 'precap' off in v1.3: cap applied BEFORE weapon bonus
for each weapon slot fired in this attack action (in slot order):
    miss_beam -= 10 * weapon.extraacc;  miss_missile -= 10 * weapon.extraacc      // see quirk 4.16-1: the reduction is cumulative across slots
shot hits iff  d100 >= miss          // d100 uniform 1..100
```
- P(hit) = (101 - miss)/100 clamped to [6%, 100%] with the 95 cap. At equal levels = 51%; each point of (attack - defense) = +/-10%. +5 or more = always hits (OSG: -4 -> ~10%, 0 -> 50%, +5 -> 100%; OSG Appendix E says the floor is 5%, the unofficial 1.40m patch changelog confirms v1.3 had 6% and patched it to 5%).
- **Precap quirk (v1.3)**: because the 95 cap is applied *before* the weapon's accuracy bonus is subtracted, a missile with bonus `b` against a target whose defense is far above your attack level hits with probability `(101 - (95 - 10b))/100`, i.e. 6% + 10%*b (e.g. Plasma Torpedo +7 -> 76%, Zeon +6 -> 66%, Hellfire +6, Proton +6 -> 66%, Hercular +5 -> 56%) instead of the 5-6% floor. The unofficial patch 1.40m fixed this ("missiles now apply the correct to-hit bonus against ships with high missile defense"). OSG Table E-1 (hit% by `attack + missile bonus - missile defense`, floor 5%, cap 100%) describes the intended rule: rows Nuclear/Hyper-V (+0), Hyper-X/Scatter V (+1), Merculite/Scatter VII (+2), Stinger/Scatter X (+3), Pulson/Anti-Matter (+4), Hercular (+5), Zeon/Proton/Hellfire (+6), Plasma (+7); at difference 0 the hit chance is 50% for the +0 row.

| Attack - Defense (d) | -5 or less | -4 | -3 | -2 | -1 | 0 | +1 | +2 | +3 | +4 | +5 or more |
|---|---|---|---|---|---|---|---|---|---|---|---|
| miss threshold | 95 (cap) | 90 | 80 | 70 | 60 | 50 | 40 | 30 | 20 | 10 | <= 0 |
| P(hit), exact | 6% | 11% | 21% | 31% | 41% | 51% | 61% | 71% | 81% | 91% | 100% |

  Damage-range effect for d >= +6 (miss threshold negative, damage fraction starts at `-miss/(100-miss)`): +6 9.1%, +7 16.7%, +8 23.1%, +9 28.6%, +10 33.3%, +11 37.5%, +12 41.2%, +13 44.4%, +14 47.4%, +15 50% of the damage range is cut from the bottom. Example (OSG & code agree): Heavy Laser (1-7) at miss 50 with a roll of 75: `((75-50)*2*6)/(100-50) = 6 -> (6+1)/2 = 3 -> +1 = 4`.
- **No distance penalty in 1oom.** *(conflict: Manual/OSG/StrategyWiki summaries say beams get +1 defense per square beyond the first; 1oom's `game_battle_attack`/`missile_hit` contain no distance term at all. Range only gates whether a weapon can fire.)*
- Missile hit uses the same threshold but is rolled per missile: `hit iff d100 >= (miss_missile - 10*extraacc)`.
- Planet as target: defense = 1 (beam), missile/bomb defense = `best ECM level + 1`; planet attack level = `base_comp + 1` (+4 if Mrrshan).
- Technology Nullifier subtracts 2..6 from complevel and ECM (4.9).

### 4.6 Damage (beams)
For each shot that hits (`r` = the d100 roll, `d = damage_max - damage_min`):
```
dmg = ((r - miss) * 2 * d) / (100 - miss);  dmg = (dmg + 1) / 2;  dmg += damage_min          // roll just above threshold = min damage, r=100 = max
dmg /= 2                       // only if target is a planet and weapon is not a bomb (beams and torpedoes do half vs planets)
dmg -= target.absorb / absorbdiv   // shield; absorbdiv = 1, or 2 for shield-halvers (NPG, Mass Driver, Hard Beam, Gauss, Particle), 
                                   // (Oracle would add another /2 but is NOT applied in v1.3, see 4.16-3); halving rounds down
dmg *= weapon.damagemul        // 4 for Stellar Converter, Crystal Ray, Hellfire
if target has Displacement Device and d100 < 35: dmg = 0       // 34%
if dmg > 0: target stack's accumulated damage hploss += dmg
```
- Negative miss (differential >= +6) removes the bottom `(-miss)/(100-miss)` of the damage range: +6 -> 9.1%, +8 -> 23.1%, +10 -> 33.3%, +15 -> 50% (OSG Table 7-3).
- **Applying losses to the stack**: ships die one at a time from the top; `hploss` is the damage already on the top ship. After each shot: `hploss += dmg`; kill loop `while hp1 <= hploss and kills < allowed: kills++, hploss -= hp1`; then `hploss = hploss % hp1`. `allowed` = **1** per shot for normal weapons (so one shot never kills more than one ship; `damagemul2` for huge batches) and unlimited for streaming weapons (Graviton, Tachyon, Amoeba Stream: `nummiss == 1`). Per 1oom the *unclamped* `dmg` is added to `hploss`, so after a 1-kill shot the remainder `(old_hploss + dmg) mod hp1` stays as pre-existing damage on the next ship. *(conflict: OSG/Manual say excess damage is simply wasted except for streaming weapons.)* Missiles clamp each hit to the target's `hp1` (`min(damage, hp1)`), so missile overkill is wasted. A stack's `num` drops by the kills; the stack is destroyed at `num == 0`.
- Pulsar/stream damage reduces `hp1` (each ship's current maximum), not `hploss`.
- Overkill volumes: attacks with huge shot counts are batched (`damagemul2` multiplies damage when >1000 shots).
- **Bombs** (range 1, planet only): uses the missile-defense miss formula; damage rolled like beams (not halved), reduced by the planet's total absorb = `base deflector absorb + planetary shield class`. Bombs hit the planet item: they kill missile bases and cause collateral damage (5.1).
- **Bio bombs in tactical combat never miss**: per bomb `dmg = max(0, rnd(0..max) - antidote)`; summed pop loss; also `biodamage += sum` (later reduces the planet's max pop, min 10).

### 4.7 Missiles and torpedoes in flight
- **Launch**: needs target within `Rng` squares (planet-launched: effectively unlimited). Spawns `ships x launchers x warheads` missiles; costs one volley of ammo; torpedoes also use two `numfire`.
- **Motion**: pixel-based; each missile has a speed budget (px/round, table 3.7.3) and `fuel` = 2 rounds (+12 if launched by a planet; plasma torpedo included). The missile chases its **current target position** and advances during the **target's own turn**: step by step while the target moves, and again at the end of the target's turn until its speed budget is spent or it hits. At the end of each round, missiles that used their budget refill it and lose 1 fuel; at fuel 0 they vanish. ("Bogies from ships last about two turns; from bases about three" - OSG.) Missiles cannot be retargeted.
- **Impact** when within 10 px of the target point. Per missile in the group: (1) hit roll `d100 >= miss_missile - 10*extraacc`; (2) if hit, shield roll: absorbed if `d100 <= misshield - weapon.techLevel` (weapon's Weapons-field level from 3.8); (3) otherwise damage = `weapon.max` (Plasma Torpedo: `max - flown_px/2`), halved vs planets only for torpedoes (misstype>0), minus `absorb` (/2 for halvers), times `damagemul`, capped at the target's `hp1` per missile. Missiles targeting a stasised group disappear.
- **Asteroids**: while flying, every 4 px sampled inside a rock cell (x: +2..+30, y: +2..+22 of the cell) each missile has a collision chance by its accuracy bonus: `{10,9,8,7,7,6,5,4,3,3}` percent for bonus 0..9 (1oom). OSG's equivalent "% destroyed per rock square crossed": Nuclear/Hyper-V 80; Hyper-X/SP-V 72; Merculite/SP-VII 64; Stinger/SP-X/Pulson/AM-Torp 56; Hercular 48; Hellfire/Zeon/Proton 40; Plasma Torp 32.
- Anti-missile stats and the Space Crystal's Lightning Shield: see 3.7.3 note.

### 4.8 Planets and missile bases in combat
- A planet with N missile bases is one group (item 0, `num = N`) belonging to the owner: it never moves, **always acts** like a normal group, and is a valid target for everything. Its stats:
  - HP per base = `{50,75,100,125,150,175,200}[tier of best researched armor]` (Titanium 0 ... Neutronium 6).
  - Attack level = `base_comp + 1` (computer level +1 built-in scanner) (+4 Mrrshan); beam defense 1; missile/bomb defense = best ECM level + 1; absorb = best deflector shield absorb + **planetary shield** (V/X/XV/XX = 5/10/15/20); initiative gets the Battle Scanner +3; built-in **Subspace Interdictor** once researched (disables Subspace Teleporters for *both* sides if the attackers have any).
  - Weapons: slot 0 = 3 launchers per base of the empire's best 2-shot missile, slot 1 = 3 launchers per base of the best Scatter Pack (falls back to slot 0's weapon). **Only one slot fires per round** (one volley = `bases x 3` missiles; the human toggles slot with the Missile button, the AI picks), **unlimited ammo**, launch range 40 (effectively unlimited), +12 fuel. A planet with zero bases has no weapon.
  - In nebula systems (`battlebg==0`) the planet's shield/absorb is 0.
- **Planet damage / collateral**: shots at the planet item reduce base HP like any group. Additionally the damage actually dealt (each non-streaming shot clamped to one base's HP) is summed per attack action; **if any base is still alive the sum is halved**, then added to two persistent accumulators: `pop_loss = floor(popacc/200)` and `factory_loss = floor(facacc/50)` (remainders carry within the battle). So with bases standing: 400 damage = 1 pop and 100 damage = 1 factory; once all bases are dead: 200 damage = 1 pop and 50 = 1 factory (the "kill rate doubles"). Beams and torpedoes already deal half damage to planets before this.
- Planets fire at whatever is in range; the AI planet attacks the first enemy group when it has no better target.
- After the battle: surviving bases remain; destroyed bases are gone; planet pop/factories are updated (and `max_pop` reduced by bio damage, min 10); if pop hits 0 in a fight against an empire the planet is wiped (`game_planet_destroy`: becomes unowned and empty, bases/shield/stargate/queues cleared; it must be recolonized).

### 4.9 Special devices in combat
Stasis, the stream projectors, Black Hole, Technology Nullifier and Warp Dissipator do **not** work on monsters (the code skips a target on the right side when the right side is a monster); pulsars (area effect) and the repulsor have no such check.
| Device | Range | Effect (1oom) |
|---|---|---|
| Stasis Field | 1 (adjacent, not the planet) | the action itself consumes the group's attack for that turn (no other weapons fire); target frozen: cannot move, fire or be fired on until the caster's next turn; missiles aimed at it vanish; cloaked ships, planets, monsters immune; frozen group acts last next round (OSG); the AI only uses it when it has enough ships |
| Ion Stream Projector | <=2 | `v = min(50, N/2 + 20)` percent (N = attacking group's ship count) of each target ship's current `hp1` removed (rounded up); ignores shields; no collateral damage; sets target `hp1` lower permanently for the battle (repair restores) |
| Neutron Stream Projector | <=2 | `v = min(75, N/2 + 40)` percent. *(conflict: OSG says +1% per attacking ship for the Neutron projector; the code uses N/2 for both)* |
| Energy Pulsar | 1 (all adjacent squares, friend or foe, including the planet) | each adjacent group (not stasised): `v = rnd(1 .. N/2 + 5)`, minus the group's shield absorb (v/2 first if it is the planet); if `v >= hp1` **every ship in that group dies**, else each ship's current maximum HP `hp1 -= v` |
| Ionic Pulsar | 1 | same with `v = rnd(1 .. N + 10)` |
| Warp Dissipator | <=3 | 50%: target `unman += 1` (speed -1) and its beam/missile defense -2 (if it still has movement); accumulates in battle, repaired after |
| Black Hole Generator | 1 | `v = rnd(1..75)+25 - 2*target.absorb`; if v>0 and target stack >1: stack becomes `(100-v)%` of its size; if target is a single ship: dies when `d100 > v` (sic - 1oom's literal condition; inverted vs the multi-ship case). Does not hurt pop/factories. OSG: Inertial Stabilizer reduces losses 15%, Nullifier 30% (not visible in the 1oom code) |
| Technology Nullifier | <=4 | automatic hit: target complevel -= rnd(1..3)+rnd(1..3) (2..6), missile defense likewise (not below beam defense) |
| Repulsor Beam | 1 | adjacent enemy pushed 1 square directly away (if the square is free or an alternative square 2 away is free); also triggers on a mover that steps adjacent |
| Cloaking Device | self | +5 defense (+50 miss) vs all weapons but specials; cloaked ships may not be stasised; ship decloaks to fire and then fires first; re-cloaks after a full turn without firing |
| Subspace Teleporter | self | teleport anywhere on the grid, then fire; acts first |
| Displacement Device | self | 34% of non-special attacks automatically miss/zero |
| Automated Repair / Adv. Damage Control | self | see 4.10 |
| Battle Scanner | self | +1 attack, +3 initiative, reveal enemy specs |
| High Energy Focus | self | +3 beam range |
| Oracle Interface | self | intended to halve target shields vs the group's beams |
| Inertial Stabilizer / Nullifier | self | +2 / +4 maneuver => +2/+4 beam & missile defense, +1/+2 combat speed |

### 4.10 Repair
- At the start of each group's own turn: `repair = hp2 * repair% / 100` (hp2 = one ship's full HP). If `hp1 < hp2` (armor reduced by pulsars/streams) it is first restored `hp1 += repair` up to `hp2`; otherwise `hploss = max(0, hploss - repair)`. So Automated Repair (15%) / Adv. Damage Control (30%) heal **one ship's worth** of damage per round for the whole stack - it matters mainly for single big ships.
- **Ships are fully repaired after every battle** - only ship *counts* per design are stored in orbit, never damage. Technology-Nullifier and Warp-Dissipator effects also vanish.
- No experience / veteran levels exist in MOO1.

### 4.11 Retreat, end conditions, results
- A human can retreat any group (Retreat button) or the whole fleet before the fight (`autoretreat`). A retreating group flags `retreat=1`, plays its turns as AI (moves away, can still bomb planets but not shoot ships), and **leaves the battlefield the next time it activates** (retreat 1 -> 2 -> removed, keeping its survivors). The enemy gets the intervening turn to shoot it. Groups with zero movement (stasis, fully slowed) cannot retreat except those already ordered.
- **AI retreat decision** (right-hand AI side only, checked at the start of every round; monsters never retreat; `game_ai_classic_battle_ai_retreat`). Let `HP_x` = sum of `hp1*num` of side x's groups (a planet counts 70%), `D_x` = estimated damage per round the *enemy* can inflict on side x (missiles in flight counted, minus 1/5-of-HP-per-repair-% credit), then:
  ```
  if HP_L == 0 or HP_R == 0: no retreat;   if D_L == 0 (right side cannot hurt the left): retreat
  v = (5 - difficulty)*5 + 5  (difficulty 0 = Simple ... 4 = Impossible)  +10 if the planet is the left side's, +20 if it is the right side's  + rnd(1..15)
  retreat iff  (D_R * 100 / HP_R)  >  (D_L * 100 * v / HP_L)       // 32-bit math in the original (overflow possible)
  ```
  i.e. the AI flees when the fraction of its HP you can remove per round exceeds `v` times the fraction of your HP it can remove. When the decision is "retreat" every right-side group gets `retreat = 1`. OSG phrases it as: AI retreats when your firepower advantage reaches 4:1 / 4:1 / 5:1 / 6:1 / 7:1 (Simple..Impossible) and always at 10:1; AI declares war when it has a 7:1 .. 3:1 fleet advantage *(different units; use the code formula)*.
- Battle ends when one side has no groups left (a planet with 0 bases does not count as a group), or after **round 50** (`TIMEOUT`): the winner is the planet owner's side if there is a planet owner, otherwise the right side (so the **attacker is forced to retreat** from a defended system).
- **Loser's fate** (`game_battle_post`): all the loser's ships in that orbit, including those that retreated in battle, are sent as a "retreat" fleet to the **nearest other planet owned by the loser** (straight-line distance, no range check, normal travel time); if the loser owns no other planet they are lost. Winner's retreated groups simply rejoin the orbit.
- Results written back: per-design ship counts only; planet `pop`, `factories`, `missile_bases`, `max_pop` loss from bio damage. A killed Guardian gives the killer the Orion loot (3.7.1 / 4.15). Killing a monster flags `killer` so it despawns.
- Diplomatic fallout of destroying things (OSG Table 11-6): factory -1 DP; small ship -1; medium -2; large -3; missile base -3; huge -4; population point by conventional attack -5; by biological attack -10. Destroying >= 10 pop in a turn triggers war.

### 4.12 Auto-resolve
- **Human "Auto"** button / pre-battle "Auto-resolve": the same tactical engine is played with the AI controlling the human's side (`flag_auto`). Click/Esc returns control (OSG). AI shortcomings noted by OSG: leaves colony ships and unarmed ships at the start line, fires missiles at the first chance even out of range, avoids charging bases unless it can kill one in a single shot.
- **AI vs AI** (no human present) uses a **weight attrition model** instead of the grid (`game_ai_classic_battle_ai_ai_resolve`):
```
weight(design) = ( shield_index*5 + comp_index*5 + weapon_enum_of_slot0 + armor_index*10
                   + 2*(special_enum[0]+special_enum[1]+special_enum[2]) + construction_level/2
                   + (Mrrshan or Alkari ? 15 : 0) ) * hull_w[hull]          // hull_w = 1,5,25,125; "index" = table index (0..), weapon/special enum values from sections 3.6-3.7
W = sum(ship_count * weight)                                                  // per side
planet bonus: + (weapons_level + force_field_level) * 75 * bases              // added for the side that owns the planet; the planet-side's own ships are weighted normally
monster: W = 100000 for the Guardian, 30000 for Crystal/Amoeba
w2L = WL, w2R = WR
while w2L > 0 and w2R > 0:  w2R -= max(1, rnd(1..10) * WL / 100);  w2L -= max(1, rnd(1..10) * WR / 100)      // each side removes 1-10% of ITS OWN starting weight per iteration
winner = side with remaining > 0 (attacker (right) wins iff w2R > 0)
survivors per design = count * max(0,w2) / W            (loser: 0)
```
Quirks of the shipped game (kept by 1oom classic): missile bases are **not** reduced by an AI-resolved battle (`bt->bases` untouched); the survivor multiplication uses 32-bit arithmetic, so huge stacks (count * w2 overflowing 2^31) produce negative counts that are later clamped to 32000 ("doom stack" bug); population/factories are never touched. Used when AI fights AI or AI fights a monster.

### 4.13 AI tactics (summary, for an AI port)
- Target selection by expected damage; positions chosen at "best range" for its weapon mix: score `+10` if distance == best range else `-4*dist`; -2 if line is blocked; pulsars evaluate adjacent enemy/friend squares (+3 / -4).
- AI items with no possible target on the right side accumulate `retreat`; planets attack the first enemy group.
- Evades incoming missiles with fuel < 8 by moving to maximize distance.

### 4.14 Colony ships, transports, outposts in combat
- **Colony ship** = ordinary Large (usually) ship with a colony base special; it is a legal target; Titanium 100 HP at start; AI leaves it at the start square.
- **Outposts do not exist.** Planets are settled by a Colony Ship (or by Transports onto an already colonized own world / enemy world for invasion). A colony ship landing on a suitable planet is consumed.
- **Transports** are not in the combat grid: see the gauntlet in 7.1.
- Unarmed or bomb-only groups keep the battle alive until killed or retreated; 50-round timeout applies.

### 4.15 Monsters (stats per difficulty Simple / Easy / Average / Hard / Impossible, 1oom `tbl_monster`)
All three are single huge-hull "ships" (always one group of 1), combat speed 2 squares/round, attack level 10, immune to stasis / streams / black hole / tech nullifier / warp dissipator, never retreat; the monster is always the attacker (right side) and the human fleet/planet the defender (left side). Monsters are chosen by difficulty row (Simple=0 ... Impossible=4).

| Monster | HP | Beam & missile defense | Shield absorb | Missile shield | Repair | Weapons |
|---|---|---|---|---|---|---|
| **Space Crystal** | 3000 / 4000 / 5000 / 6000 / 7000 | 1 / 2 / 3 / 4 / 5 | 5 (Class V) | 100 (Lightning) | 0 | 10x Crystal Ray (100-300 dmg x4 attacks, range 3, attack 10) + Black Hole Generator |
| **Space Amoeba** | 1000 / 2000 / 3000 / 4000 / 5000 | 1 / 2 / 3 / 4 / 5 | 0 | 0 | 50% per round (OSG: 30%: 300/600/900/1200/1500 per round) | 1x Amoeba Stream (250-1000, range 3, streaming) |
| **Guardian of Orion** | 2000 / 4000 / 6000 / 8000 / 10000 (OSG: 6000-10000) | 1 / 3 / 5 / 7 / 9 (OSG: 5-9) | 5 / 6 / 7 / 8 / 9 | 100 (Lightning) | 0 / 0 / 0 / 15% / 0 (OSG: Hard +Automated Repair, Impossible +Adv. DC) | Scatter Pack X (5-shot) x 5/25/45/65/85; 1 Death Ray; Stellar Converter x 5/15/25/35/45; Plasma Torpedo x 6/9/12/15/18; High Energy Focus (+3 range) |
- OSG Table 15-2 (max average damage per round the Guardian can deal vs a defender shield level 0): 2,709 / 7,069 / 11,429 / 15,789 / 20,149; at shield 15: 1,572 / 2,296 / 3,029 / 3,762 / 4,495.
- **Space Crystal / Space Amoeba (events)**: spawn only when year >= 200 and neither exists (event roll); enter from a random map edge at warp 1, wander to adjacent stars (not Orion, not uninhabitable) staying 2-3 turns; on arrival (after any battle) set `pop = 0`: Amoeba also `factories /= 10`, planet becomes Radiated with `max_pop = rnd(1..3)*5 + 5` (10-20; OSG 10-25) and the planet is destroyed; Crystal leaves waste `= max_pop - 10` and factories intact. After 5 planets (or if killed) they vanish. An empire whose last planet is hit is eliminated. Killing them requires out-damaging the Amoeba's regeneration each round (OSG Table 14-3/14-4: missile bases needed to match regeneration, e.g. 25 Nuclear bases at Simple up to 125 at Impossible; Scatter-X 1-4).
- **Guardian**: sits at the Orion planet (Terran, max pop 120, 4x research). Killing it grants the **Death Ray** (always) plus up to 3 random techs (level 20..50, no more than your current field level+25 capped 50, from any field, even outside your Limited Research List); Orion can then be colonized.
- Pirates / comets (events, other slice): pirates `hp = (rnd(1..5)+10+difficulty)*30`, comet `hp = (rnd(1..5)+10+difficulty)*25`; each ship contributes `rnd(1..hull_w)` damage per turn (1oom uses design 0's hull for all designs - bug); a Crystal/Amoeba passing through kills pirates.

### 4.16 Quirks of the shipped game (all faithful in 1oom classic; recommend reproducing only if you want exact behaviour)
1. **Accuracy bonus accumulates**: inside one attack action, each weapon slot's `extraacc` is *subtracted from the shared miss chance*, so later slots (including unrelated weapons) benefit from earlier slots' bonus.
2. Miss-chance cap of 95 is applied before weapon bonuses.
3. **Oracle Interface does not halve shields** in actual damage rolls (1oom `game_num_bt_oracle_fix = false`); only the AI's evaluation assumes it does.
4. Bombs and bio bombs use missile defense; bio bombs ignore hit rolls in tactical combat.
5. Excess beam damage on the top ship carries as a remainder (4.6).
6. Planets' collateral-damage accumulators and the +1 BC "ship slider" bug (ships built get +1 BC of production when slider > 0).
7. Black Hole vs a single ship uses an inverted comparison.
8. Ground combat tie handling (7.2).
9. `Wait` and retaliation flags interplay (`game_num_bt_wait_no_reload` off).
10. Orbital bombardment only counts the first 3 weapon banks and excludes weapon ids >= Crystal Ray (so the Death Ray cannot bombard) in the classic rules (5.3).
11. Missile hit floor is 6% (not 5%) and the 95 cap precedes the accuracy bonus (4.5).
12. Transport gauntlet: bases use the transport owner's best computer; Combat Transporters only work against planets whose owner has a Subspace Interdictor (7.1).
13. Orbital bombardment uses the best computer among ALL designs (not just those in orbit), halves plain missiles instead of torpedoes, and applies bio max-pop loss even when the bombardment is cancelled (5.3).
14. Guardian difficulty gear: classic Hard row has an Advanced-Damage-Control special/15% repair, Impossible has none (patch/OSG: Hard = Automated Repair, Impossible = Adv. Damage Control).

Independent confirmation: the changelog of the unofficial **MOO 1.40m/1.40i/"Embryonic 18" patch** (kyrub) lists as fixed original bugs: missile to-hit bonus vs high missile defense and the 6% floor; torpedo-vs-missile bombing damage "reverse of before"; combat transporters not working and the subspace interdictor; "Wait" allowing unlimited firings of pulsars/projectors and repeated auto-repair; bio-weapon fleets auto-bombing; strategic-bombing computer bonus not checking the ships in orbit; Guardian repair specials on Hard/Impossible; AI-vs-AI Alkari/Mrrshan bonuses; negative overflow with huge AI armored stacks; 8th-stargate maintenance overflow.

---

## 5. Planetary defences, bombing, bio weapons

### 5.1 Missile bases and planetary shields (build rules)
- Built from the planet's **Defense slider**. Per turn: `prod = adjust(slider_def * prod_after_maint / 100) + bc_to_base`. Spending order: (1) pay **upgrade debt** (`cost_diff * bases + bc_upgrade_base`, where `cost_diff = max(0, new_base_cost - old_base_cost)` after new tech), (2) fund the planetary **shield** (`pshield_cost = {0,500,1000,1500,2000}[level index]` total BC for class V/X/XV/XX; incremental), (3) then new bases at `game_get_base_cost` each (several per turn possible). No shield can be bought on a planet in a nebula.
- **Missile base cost** (BC, `game_get_base_cost`): `cost = ((armor_term + weapon_term + shield_term + comp_term + ecm_term) * 3) / 5`, minimum 50, where (with `m = T50[min(P_field,50)-1]`, large-hull values in tenths):
  - armor_term = `(armor[best std armor idx].cost[L] + 2000) * m(Construction) / 1500`
  - weapon_term = `base_weapon.cost * (m(Weapons)*9) / 1000`
  - shield_term = `base_shield.cost[L] * m(Force Field)/1000 + base_shield.power[L]/10`
  - comp_term = `base_comp.cost[L] * m(Computer)/1000 + base_comp.power[L]/10`
  - ecm_term = same for best owned ECM (0 if none)
  - AI discounts: Easy x0.9, Average x0.8, Hard x0.7, Impossible x0.5 (OSG: costs 100/90/80/70/50%).
  - Start-of-game value by this formula: **254 BC** (OSG's example says 283 BC; older/printed formula, `conflict`).
- Upkeep 2%/turn of current base cost. Bases upgrade automatically when tech improves (billed afterward, defense spending pays the debt first). Scrap value 1/4. No maximum number of bases in the rules (OSG recommends 1 per 10M pop on a normal planet).
- Planetary shield classes by Force Field tech: L12 Class V (5), L22 Class X (10), L32 Class XV (15), L42 Class XX (20); the shield value is added to the base's own deflector absorb against *non-biological* attacks and also protects pop/factories when no bases exist.
- Planetary shield also absorbs **orbital bombardment** (5.3).

### 5.2 Biological weapons
- Pop loss per bio bomb (tactical): `max(0, rnd(0..maxdamage) - antidote)`, `maxdamage` = 1 (Death Spores), 2 (Doom Virus), 3 (Bio Terminator). *(conflict: OSG Table 8-5 says a hit does 1..max, averages 1 / 1.5 / 2.)* **Antidote** from Planetology: L17 Bio-Toxin Antidote -> 1, L36 Universal Antidote -> 2 per bomb. Damage ignores planetary shields and is applied to population directly, and also reduces the planet's **max population by the same total** (floor 10) at battle end; restored only by terraforming/eco spending. Racks: 5 bio weapons, one per round.
- Bio weapons never kill factories or bases. Using them makes all other empires like you less (OSG).

### 5.3 Orbital bombardment (after combat, once per turn, `game_turn_bomb`)
Any empire with armed ships in orbit of another empire's planet (never against an ally; an *AI attacker* also never bombs a non-aggression partner, a human may) can bomb. A human is asked (Bomb/Cancel; **all ships bomb, no holding back**); the AI decides by its own rule (it bombs when the planet's pop exceeds the pop already inbound as its own invasion transports). Weapons are fully reloaded for this phase.
```
per weapon type: shots += ships * launchers * ns            // ns = weapon.numshots, but -1 (beams, torpedoes) counts as 30; only banks 0..2 (first three) unless option
comp = clamp( (best_design_comp_index - 1)*2 + 6 , 1, 20 )   // Mark I = 6 ... Mark XI = 26 -> 20
for each weapon (id < Crystal Ray):                       // Death Ray excluded
   cap shots at 100000; if shots >= 10: v = shots/10, rolls = 10 else v=1, rolls=shots
   fixed damage (missiles, torpedoes; bio):
        bio:   each roll hits if rnd(1..20) <= comp: dmg = max(0, rnd(0..dmgmin) - antidote); totalbio += v*dmg  (cap 10000)
        other: if misstype == 0 then dmgmax /= 2   (classic quirk: plain MISSILES are halved, torpedoes are not; OSG says the opposite)
               dmgmax' = dmgmax * nummiss   (Scatter Packs multiply)
               if dmgmax' > planet_shield: each roll that hits (rnd(1..20) <= comp) adds v * (dmgmax' - planet_shield)
   variable damage (beams, bombs):
        beams halve min & max; if max > planet_shield: rolls = comp*rolls*v/20, each: rnd(1..(max-min+1)) + min - 1 - planet_shield, added if > 0
factories_lost = min(factories, total_damage / (rnd(1..20) + 40))        // fact_hp 50: divisor 41..60
pop_lost       = min(pop, total_damage / (rnd(1..80) + 160) + totalbio)    // pop_hp 200: divisor 161..240
max_pop -= totalbio  (min 10)       // classic v1.3 bug: applied even when the human CANCELS the bombardment (1oom option game_num_orbital_bio_fix = false); the fixed rule applies it only if bombing is carried out
rebels -= pop_lost/2 + 1
if pop reaches 0: planet destroyed (game_planet_destroy); diplomacy: war + -50..-100 DP
```
OSG summary: bombardment = 10 effective rounds: beams 10 attacks, missile racks fully, torpedoes 5 attacks, bombs 10, bio 5 *(conflict with the code's "30")*.
Collateral (OSG Table 8-7): per 100 hits about 1/4 pop and 1 factory lost with bases present, doubled without bases; factories die ~4:1 vs pop.

---

## 6. Planet-side ship production, scrapping, refit (build times and costs)

- A planet builds **one design at a time** (or a Stargate); production per turn = `adjust(slider_ship * prod_after_maint / 100) + bc_to_ship` (+1 BC if slider > 0, a known bug); `adjust` = rich x2, ultra-rich x3, poor /2, ultra-poor /3. When the pool >= design cost, `n = floor(pool / cost)` ships are completed **in the same turn** (several ships possible), remainder carried in `bc_to_ship`. New ships appear in orbit or are sent to the planet's `reloc` target (normal travel). Build time = `ceil(cost / per-turn BC)`. The pool of the planet's Reserve can supply up to double normal spending (OSG).
- **Stargate**: `game_num_stargate_cost = 3000`; maintenance see 1.4.
- **Design cost updates every turn** (miniaturization), so an in-progress ship gets cheaper; scrapping a design while a planet is building it moves that planet to the replacement design (leftover funds may then produce an unplanned ship - "shipyard surprise").
- **Refit: none for ships.** Built ships keep the design they were built with; designs are locked once any ship exists (only scrapping the design lets you reuse the slot). Only fuel-range tech upgrades apply automatically to existing ships. **Missile bases auto-upgrade** (billed later). Factories need explicit refit (other slice).
- **Obsolete designs**: no special state. You may keep at most 6 designs; maintenance is paid on all ships at current cost.
- **Scrapping**: per design: `reserve_BC += ships_of_design * design.cost / 4` (25%); the refund goes to the empire reserve. Scrapping bases: 25% (integer). Stargates cannot be scrapped.
- Transports cost 1 BC each (taken from the departing planet's production) and carry 1 population unit each (OSG).

---

## 7. Invasion and ground combat

### 7.1 Transports and the gauntlet (before landing)
- Population can be sent as transports: at most **half the planet's population per turn**, one destination; each transport carries 1 pop and costs 1 BC; speed = best warp - 1. Transports do not exist as ships in orbit; they fly planet->planet and resolve on arrival (after space combat has been resolved). Max **300 pop** can land per planet per turn (`game_num_max_inbound`); excess survivors are lost. Hostile-planet colonization with transports requires the matching Planetology tech; invasion of enemy colonies needs no colony base. Troop transports sent to an ally are destroyed.
- **Shooting at arriving transports** (`game_turn_transport_shoot`), unless the owner has Hyperspace comm redirects:
  - Defenders: the planet owner (missile bases) and any non-allied empire (war or no treaty) with armed ships in orbit.
  - `transport_hp = (bestArmorTier + 1) * 15` where tier 0..6 = Titanium..Neutronium -> 15,30,45,60,75,90,105 (OSG Table 8-10 lists 15,22,30,37,45,52,60 *(conflict)*). Transports have no shields; they always carry the best researched armor.
  - Shots: missile bases add `bases * 24` shots of the base weapon type (**not** scaled by speed in the code); each armed ship design in orbit adds `v = ships * launchers * ammo * nummiss` (ammo: `numshots`, with -1 (beams, torpedoes) counted as 4; cap 32000; zero for bombs/bio; halved for torpedoes `misstype != 0`) and then `(v * 2) / transport_speed` shots (faster transports are exposed to fewer shots).
  - Hit rolls: attack level `L = clamp((bestcomp - speed)*2 + 12, 1, 20)`, where `bestcomp` = the computer index of the *last* shooter design whose computer index exceeds the transport speed (a bug: not the max), overwritten by `best computer of the TRANSPORT OWNER` when missile bases are present (another classic bug: `rowner` instead of the base owner); fixed-damage weapons (missiles, torpedoes): each shot hits if `rnd(1..20) <= L` and adds `damagemax`; variable-damage weapons (beams): `shots*L/20` hits, each `rnd(1..range+1) + min - 1` if positive. Weapons are processed in table order and processing stops once `total_damage >= total_hp`. Weapon ids >= Crystal Ray (Death Ray, Amoeba Stream) are ignored.
  - `killed = total_damage / transport_hp` (cap 1000). A living Crystal/Amoeba (no killer) at the planet kills all; a Guardian at Orion kills all (`pop3 = 0`).
  - **Combat Transporters** (Propulsion L45, the transport owner's tech): OSG: each transport has a 50% chance to land unscathed (25% if the planet owner has a Subspace Interdictor). 1oom: with the fix option each lost transport is recovered with probability 1/c, c = 2 (4 if the planet owner has the interdictor). The shipped (classic) code has a bug: recovery only happens **if the planet owner has an interdictor**, and then each lost transport is recovered with probability 1/4 + (3/4)(1/2) = 62.5%.
  - OSG exposure table (rounds under fire by transport speed): speed 1 = 7; 2 = 4; 3 = 3; 4-6 = 2; 7 = 1; Subspace teleporter = 1. (Its Table 8-8 and text disagree; 1oom's formula above is authoritative.)
  - OSG Table 8-9 (casualties per base volley x bases x rounds), Nuclear / Hyper-V / Hyper-X / Merculite / Stinger / Pulson / Hercular / Zeon / SP-V / SP-VII / SP-X: Titanium(15) .80/1.20/1.60/2.00/3.00/4.00/5.00/6.00/6.00/14.00/30.00; Zortrium(30) .40/.60/.80/1.00/1.50/2.00/2.50/3.00/3.00/7.00/15.00; Neutronium(60) .20/.30/.40/.50/.75/1.00/1.25/1.50/1.50/3.50/7.50.
- Surviving troops land: nothing lands if all were killed; on the empire's own planet the survivors are added to `pop` (cap `max_pop`; if that planet is in rebellion they join the loyalist side instead); on an **enemy planet** (no alliance) `inbound[attacker] += survivors` (cap 300, `total_inbound += full original count`) and **ground combat resolves at the end of the same turn** (7.2). A transport that arrives at a planet that has no owner does not conquer it (colony ships do that).

### 7.2 Land combat (`game_ground.c`, resolved per attacker per planet at turn end)
Each side's **force** value:
```
force = 5 * armor_tier           // Titanium 0, Duralloy 1 ... Neutronium 6  (+0,+5,+10,+15,+20,+25,+30)
      + 10 * suit_tier           // Battle Suits 1 (+10, K11), Armored Exoskeleton 2 (+20, K24), Powered Armor 3 (+30, K40)
      + 10 * shield_tier         // Personal Deflector (+10, F8), Absorption (+20, F21), Barrier (+30, F38)
      + 5 * weapon_tier'         // weapon tiers 1..5 = Hand Laser (+5, W2), Ion Rifle (+10, W12), Fusion Rifle (+20, W24), Hand Phasor (+25, W31), Plasma Rifle (+30, W42)
                                 //   (tier>2 is incremented: 3->4, 4->5, 5->6)
      + 25 if race == Bulrathi   // Manual says +20: OSG and code say +25
      + 5  if defender
```
(The armor/suit/shield/weapon tier used is that of the **most recently researched** entry of that group in the empire's completed-tech list - effectively the best, since newer techs normally come later.) Max force is +30+30+30+30+25+5.
Combat: both sides have `pop` troops (1 troop = 1 population unit; no garrison/barracks buildings exist; defender = whole planet population, or rebels in a rebellion). Repeat until one side is 0:
```
v1 = rnd(1..100) + force_side0;  v2 = rnd(1..100) + force_side1
if v1 <= v2: side0 loses 1 troop  else side1 loses 1 troop
```
`side0` = the attacker when no human is involved, the **defender** when a human is involved (display swap); so ties (~1%) kill the attacker in AI-vs-AI fights and the defender when a human participates. *(conflict: Manual/OSG say a tie kills one troop on each side.)*
Kill ratio by advantage `A` (OSG Table 8-11, attacker:defender): 0 1:1; 5 1.25:1; 10 1.5:1; 15 1.8:1; 20 2.15:1; 25 2.6:1; 30 3.1:1; 35 3.75:1; 40 4.55:1; 45 5.6:1; 50 7:1; 55 8.8:1; 60 11.35:1; 65 15.1:1; 70 20.2:1; 75 30.15:1.
Racial note: no other race has a combat bonus in the code (Sakkra's fast regrowth and Silicoids' slow regrowth matter only afterwards).

### 7.3 After the battle
- **Attacker survives** (`pop1 > 0`): the planet is captured: `game_planet_destroy` clears pop, bases (`missile_bases = 0`), planetary shield (0), stargate, transports, build queues, sliders (industry 100%), reserve, rebels/unrest; then `owner = attacker`, `pop = surviving troops` (clamped to `max_pop`), `bc_to_refit = 0`, `pop_oper_fact = 1`. **Factories remain** (captured factories must be refit at 2 BC each in OSG; operate at 1 per pop until refit). Buildings other than factories/bases/shield/stargate do not exist.
- **Tech theft**: for every captured factory a 1-in-50 roll (`rnd_0_nm1(50) == 0`); each success steals one tech the attacker lacks (up to 6 per conquest, `TECH_SPY_MAX`), if the defender has any.
- **Attacker wiped out**: planet pop = defender survivors. AI is told the casualties for diplomacy.
- **Rebellion**: a human may land their own transports on their own planet in `REBELLION`; the defenders are the `rebels` (instead of `pop`); if the transports win: `unrest = resolved`, `pop = pop - rebels + survivors`, `rebels = 0`; if they lose: `rebels = rebel survivors` (resolved if 0). (The ground-combat force formula is the same.)
- Orbital bombardment can pre-weaken defenders (5.3); transports first face the gauntlet (7.1). A planet with zero pop after bombing is destroyed (must be recolonized with a colony ship).

---

## 8. Starting designs and fleets (1oom `tbl_startship`)
Slot order: Scout, Fighter, Destroyer, Bomber, Colony Ship, (empty). Start fleet default: **2 Scouts + 1 Colony Ship** (options: scouts 0-5, fighters 0-10, colony ships 0-2). Optional "armed colony ships" gives design 4 a Laser. Start tech: level 1 in every field; `base_weapon` = Nuclear Missile (2-shot), `base_shield` = Class I, `base_comp` = Mark I.

| Design | Hull | Weapons | Retro engine-units | HP | Listed cost BC |
|---|---|---|---|---|---|
| Scout | Small | none; Reserve Fuel Tanks | 10 | 3 | 10 |
| Fighter | Small | 1 Laser | 30 | 3 | 15 |
| Destroyer | Medium | 1 Nuclear Missile (2-shot) + 3 Lasers | 115 | 18 | 66 |
| Bomber | Medium | 2 Nuclear Bombs + 2 Lasers | 90 | 18 | 86 |
| Colony Ship | Large | Standard Colony Base | 205 | 100 | 591 |

These shipped values do not all satisfy the design formula (formula would give Destroyer 75, Bomber 66, and fewer engines for the Scout/Colony ship); treat the table as raw original data `(unverified why)`. Use the formula for any new design.

---

## 9. AI design preferences (OSG, optional)
New-design hull size roll (d12): 1 Small; 2-4 Medium; 5-9 Large; 10-12 Huge; modifiers -3 for Alkari/Klackon, +3 for Bulrathi/Meklar/Silicoid, +2 for all AIs if the human has pulsar ships. AI redesigns every 6-15 turns; keeps at least one bomber and one colony design. Smaller hulls get worse shields/ECM; huge hulls 70% best-tech shields, 50% best computers.

---

## 10. Important constants (quick list)
`BATTLE_AREA_W=10, H=8; BATTLE_ROCK_MAX=7; BATTLE_MISSILE_MAX=30 (concurrent missile stacks); game_num_bt_turn_max=50; game_num_pop_hp=200; game_num_fact_hp=50; game_num_max_bomb_dmg=100000; game_num_max_bio_dmg=10000; game_num_max_inbound=300; game_num_limit_ships=32000; game_num_base_hp={50,75,100,125,150,175,200}; game_num_pshield_cost={0,500,1000,1500,2000}; game_num_tbl_hull_w={1,5,25,125}; NUM_SHIPDESIGNS=6; WEAPON_SLOT_NUM=4; SPECIAL_SLOT_NUM=3; SHIP_NAME_LEN=12; pixel cell 32x24; missile hit radius 10 px; rock sampling step 4 px.`

---

## 11. Implementation recommendations
1. Implement the design calculator exactly as in 2.2-2.6 (integer maths, tenths of BC, `T50/T25` tables, per-hull arrays). It is cheap and the single most important fidelity item.
2. Combat on a 10x8 grid with king-move distance; to-hit `d100 >= miss` with `miss = min(95, 50 - 10*(att - def) [+30 rock, +50 cloak]) - 10*bonus`; damage interpolation formula 4.6; per-hull defense table; group/stack model with `hploss` accumulator.
3. Keep missiles as stacks with speed (squares/round), fuel 2, chase-the-target movement; model Anti-Missile/Zyro/Lightning as a per-missile `(misshield - weaponLevel)%` roll after the hit roll.
4. Auto-resolve for AI-vs-AI: weight attrition model in 4.12; human "Auto" = AI plays tactical.
5. Transports: gauntlet formula 7.1 then ground combat 7.2 (including the Bulrathi +25 and defender +5).
6. If you prefer rules to match the printed docs rather than v1.3 code, the toggles are: distance penalty (+1 def/square), Oracle halving, excess-damage waste, tie rule in ground combat, torpedo/missile halving vs planet in orbital bombardment.

---

## 12. Conflicts and unverified items (checklist)
- Construction space bonus: Manual 1%/level vs OSG & code 2%/level (use 2%).
- Anti-Missile Rockets: Manual 35% vs OSG/code/UI text 40%.
- Beam range penalty (+1 defense per square beyond the first): Manual/OSG vs 1oom (none). **Biggest rules question.**
- Initiative formula (maneuver rating vs combat speed; scanner +3 vs +4).
- Excess damage on kills (waste vs remainder carry).
- Oracle Interface effect (halves shields vs not applied in classic).
- Ground combat tie rule; transport HP table; transport exposure rules (Table 8-8 vs text vs code: base shots are not speed-scaled in the code); Combat Transporters (OSG 50%/25% vs classic bug).
- Neutron Stream Projector: OSG "+1% per attacking ship" vs code `N/2 + 40` (same as Ion's `N/2 + 20`); Ion and Neutron projectors mutually exclusive (OSG) vs different `type` ids (code).
- Battle length: 50 rounds (OSG) vs 51 actually played (code order of check/increment) `(unverified)`.
- AI retreat thresholds: OSG ratios vs code `v` formula (4.11).
- Weapon table differences Manual vs 1oom: Neutron Blaster cost 5 vs 6; Graviton 5/30/60 vs 6/20/50; Tachyon power 80 vs 70; Plasma Cannon power 110 vs 100; Plasma Torpedo cost 150 vs 60; Fusion Bomb cost 4 vs 3; Neutronium Bomb 10 vs 9; Proton damage 60 vs 75 (75 correct); Hyper-X range 4 vs 5; Zeon range 10 vs 9/7; Scatter-X range 7 vs 10. **Resolved in favour of the code** by OSG Appendix E/I: SP-V accuracy bonus is +1 (Manual 0), Hyper-X is level 8 (Manual 7), Fusion Bomb level 9 (Manual 8), Proton damage 75 (Manual 60), Shield Class VI level 24 (OSG Table 9-3 says 25).
- Shield Class IV huge space 625 (OSG) vs 675 (code).
- Computer table small/medium rows (OSG shifted one row) and small-hull double-armor sizes (OSG 14/17/20/23/26/30/35 vs code 20/25/30/35/40/45/50); Displacement Device size/power.
- Guardian HP (2000..10000 in code vs 6000..10000 OSG), monster defense levels, Amoeba regeneration (50% vs 30%), Crystal/Amoeba defense scaling with difficulty.
- Orbital bombardment: shots (30 vs 10), missile/torpedo halving inverted vs OSG; Death Ray excluded; only 3 weapon banks used.
- Missile base cost at start 254 (formula) vs 283 (OSG).
- Starting-design listed costs/engines not matching the formula.
- Not read / not reproduced: OSG Appendices F-G (derived effectiveness tables), OSG chapter 9 Table 9-12 (AI equipment odds by hull), StrategyWiki and Fandom pages (blocked), the original EXE/LBX data (only reached through 1oom's transcription).

## 13. Source URLs
- 1oom GitHub: https://github.com/1oom-fork/1oom (raw files under `src/game/`); vanilla: https://gitlab.com/KilgoreTroutMaskReplicant/1oom
- Manual: https://archive.org/details/Master.of.Orion (full text: https://archive.org/stream/Master.of.Orion/Master.of.Orion_djvu.txt)
- Official Strategy Guide: https://archive.org/details/MasterOfOrionStrategyGuide (full text, truncated view: https://archive.org/stream/MasterOfOrionStrategyGuide/MasterOfOrionStrategyGuide_opt_djvu.txt ; complete text via the redirect target https://ia800801.us.archive.org/26/items/MasterOfOrionStrategyGuide/MasterOfOrionStrategyGuide_opt_djvu.txt)
- Unofficial patch changelog (kyrub 1.40m / Embryonic 18): https://archive.org/details/MasterOfOrionPatch1.4Community (confirms several original bugs)
