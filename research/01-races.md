# 01 — Races, Leaders and AI-Opponent Generation (Master of Orion 1, 1993)

Scope: the ten races of MOO1 (MicroProse/SimTex, 1993, v1.3 data), their numeric traits, and how the game rolls and drives the AI leaders ("emperors"). MOO1 only — not MOO2, not the 2016 remake.
Everything is written so a re-implementer can use it as a reference; "(unverified)" and "(conflict: ...)" mark weak spots.

Contents: **0** sources & race IDs · **1** comparison tables (identity, research costs, hooks, starting attitudes, AI roll tables) · **2** common start state & what MOO1 lacks · **3** race-by-race detail · **4** race hooks as formulas · **5** AI leader generation & behaviour (personality, objective, sliders, research, diplomacy, wars, spying, council, difficulty, coups) · **6** banner colours & ship liveries · **7** name pools · **8** art/sound notes · **9** conflicts & gaps · **10** sources · **11** machine-readable data block.

---------------------------------------------------------------------------------------------------

## 0. Sources, confidence, notation

| Tag | Source | Notes |
|---|---|---|
| **[1oom]** | 1oom engine source (github.com/1oom-fork/1oom `src/game/*.c`, `src/ui/classic/*.c`) | Open-source re-implementation of the **v1.3 executable**; it reproduces the original data tables and formulas (bugs included). **Treated as ground truth for numbers.** Function names are quoted so you can look them up. |
| **[OSG]** | *Master of Orion: The Official Strategy Guide* (Emrich & Hughes, 1993; OCR text on archive.org) | Describes design intent of an earlier build. Several numbers differ from [1oom] (all flagged). |
| **[DV]** | "Master of Orion 1 AI analysis" (Delta V, eXplorminate 2021, archive.org) | Written from the 1oom source; confirms many [1oom] readings. |
| **[SW]** | StrategyWiki *Master of Orion* pages (Racial personalities, Technology tree, Diplomacy, Best/Average/Worst races) | Site blocks the fetch tool; I saw only search-engine summaries of it. |
| **[AW]** | Fan "archive" wiki, *Master of Orion I* race pages | Seen via search summaries only. |
| **[LP]** | lparchive.org "Master of Orion" Let's-Play race previews | Qualitative; sometimes loose. |
| **[MAN]** | 1993 manual | Only a scanned PDF (unreadable by my tools); seen only through secondary quotes. |
| **[PATCH]** | v1.3 patch notes (archive.org item `moov13`) | Official changelog text: key diplomacy/council/AI changes of v1.3. |

Notation: **DP** = "diplomacy point", the relation scale −100..+100. **tech%** = the per-field "tech level percent" (1..99, see §4.1) that the game stores in `tech.percent[field]`. **Difficulty index** d = 0 Simple, 1 Easy, 2 Average, 3 Hard, 4 Impossible. `year` = the engine's turn counter (first turn = 1; one turn = one year). `rnd_1_n(n)` = uniform 1..n, `rnd_0_nm1(n)` = uniform 0..n−1, `d100` = `rnd_1_n(100)`. Integer arithmetic is C-style (truncating).

### 0.1 Race IDs and orders (use these as array indices; they are the original data order)

| ID | Race | Plural used in UI | Notes |
|---|---|---|---|
| 0 | Human | Humans | |
| 1 | Mrrshan | Mrrshans | |
| 2 | Silicoid | Silicoids | |
| 3 | Sakkra | Sakkras | |
| 4 | Psilon | Psilons | |
| 5 | Alkari | Alkaris | |
| 6 | Klackon | Klackons | |
| 7 | Bulrathi | Bulrathis | |
| 8 | Meklar | Meklars | |
| 9 | Darlok | Darloks | |
| 10 | "Random" | — | menu entry only |

This is also the order of the New-Game race list. Alphabetical order is used only by the OSG and this file's headings.
Random-race pick (`game_generate_race_banner`): for every player with "Random" the game draws `race_tbl[rnd_0_nm1(10)]` with `race_tbl = {7,1,5,0,3,9,4,6,2,8}` (= Bulrathi, Mrrshan, Alkari, Human, Sakkra, Darlok, Psilon, Klackon, Silicoid, Meklar) and re-draws if that race is already used. Net effect: **uniform random among races not yet in the game; no two empires ever share a race.**

---------------------------------------------------------------------------------------------------

## 1. Comparison tables (read these first)

### 1.1 Identity and the one-line effect

The "headline" is the exact 3-line text shown on the race-select screen (`game_str_tbl_traits`).

| ID | Race | Homeworld (= home star name) | Headline on race-select screen | What it really does (v1.3 code) |
|---|---|---|---|---|
| 0 | Human | Sol | EXPERT TRADERS AND MAGNIFICENT DIPLOMATS | +25 points on all trade income; positive diplomatic acts ×2; +50 AI mood when the human player is Human; everybody starts "Relaxed" (+12) toward Humans; +20 council-vote weight for AI voters |
| 1 | Mrrshan | Fierias | SUPERIOR GUNNERS | **+4 computer levels** in ship combat (to-hit +40 points, initiative +4) |
| 2 | Silicoid | Cryslon | IMMUNE TO HOSTILE PLANET ENVIRONMENTS | Can colonise every planet type from turn 1; no waste/pollution; natural growth halved; research list lacks environment/waste/eco techs; immune to plague & industrial-accident events |
| 3 | Sakkra | Sssla | INCREASED POPULATION GROWTH | Natural population growth **×2** (and ecology-funded growth ×2, cost to add a pop ×2/3) |
| 4 | Psilon | Mentar | SUPERIOR RESEARCH TECHNIQUES | Research output **×1.5**; every tech field costs 80%; research list offers each tech with 75% (not 50%) chance |
| 5 | Alkari | Altair | SUPERIOR PILOTS | **+3 ship defense** (beams and missiles), **+3 initiative** |
| 6 | Klackon | Kholdan | INCREASED WORKER PRODUCTION | Population-based production term **×2** (0.5 → 1.0 BC per worker at tech% 0) |
| 7 | Bulrathi | Ursa | TERRIFIC GROUND FIGHTERS | **+25** to ground-combat strength (manual says +20; code +25) |
| 8 | Meklar | Meklon | ENHANCED FACTORY CONTROLS | **+2 factories operated per colonist**; no refit cost when robotic-control level rises |
| 9 | Darlok | Nazin | SUPREME SPIES | Spy cost halved; **+30** on its own spy rolls, **+20** on its counter-espionage (security) rolls |

### 1.2 Research cost multiplier per field (percent of base cost; lower = better)

From `game_num_tech_costmulr[race][field]` ([1oom]); rating names from [OSG]/[SW] (Poor 125, Average 100, Good 80, Excellent 60). Cost of tech #T in a field = T² × (this %) × difficulty factor — see §4.1.

| Race | Computers | Construction | Force Fields | Planetology | Propulsion | Weapons |
|---|---|---|---|---|---|---|
| Human | 100 | 100 | **60 Exc** | 80 Good | 80 Good | 100 |
| Mrrshan | 100 | 125 Poor | 100 | 100 | 100 | **60 Exc** |
| Silicoid | 80 Good | 125 Poor | 125 Poor | 125 Poor | 125 Poor | 125 Poor |
| Sakkra | 100 | 100 | 100 | **60 Exc** | 100 | 100 |
| Psilon | 80 Good | 80 Good | 80 Good | 80 Good | 80 Good | 80 Good |
| Alkari | 100 | 100 | 125 Poor | 100 | **60 Exc** | 100 |
| Klackon | 100 | **60 Exc** | 100 | 100 | 125 Poor | 100 |
| Bulrathi | 125 Poor | 80 Good | 100 | 100 | 100 | 80 Good |
| Meklar | **60 Exc** | 100 | 100 | 125 Poor | 100 | 100 |
| Darlok | 80 Good | 100 | 100 | 100 | 100 | 100 |

Cross-check: [OSG] ch.13, [SW] "Technology tree", [LP] previews and [AW] all agree with this table (the LP says Humans are "Good" in FF/PL/PR — loose wording; the table has FF = Excellent, which [OSG] and [AW] also state).

### 1.3 Combat / economy / spy / diplomacy hooks in one grid

| Race | Ground combat | Ship combat | Production | Research | Pop growth | Spying | Trade / diplomacy / council | Environment |
|---|---|---|---|---|---|---|---|---|
| Human | – | – | – | FF 60, PL 80, PR 80 | – | – | +25 trade pts; acts ×2; AI mood +50; council weight +20 | normal |
| Mrrshan | – | complevel +4; initiative +4 | – | WE 60, CN 125 | – | – | worst starting relations (−12..−36 with 5 races) | normal |
| Silicoid | – | – | no waste cost | CM 80, rest 125; list excludes env/waste/eco techs | natural ×0.5 (acts "hostile-ish") | – | – | **all planet types colonisable at start; cannot use soil-enrichment / atmospheric terraforming** |
| Sakkra | – | – | – | PL 60 | natural ×2; ecology growth ×2; add-pop cost ×2/3 | – | – | normal |
| Psilon | – | – | – | all 80; output ×1.5; 75% list chance | – | – | neutral with all but Human (+12) / Darlok (−12) | normal |
| Alkari | – | defense +3, missile defense +3, initiative +3 | – | PR 60, FF 125 | – | – | Mrrshan −36 | normal |
| Klackon | – | – | worker term ×2 | CN 60, PR 125 | – | – | 5 races at −12 | normal |
| Bulrathi | **+25** | – | – | CM 125, CN 80, WE 80 | – | – | Mrrshan/Darlok −12 | normal |
| Meklar | – | – | +2 factories/colonist, no refit | CM 60, PL 125 | – | – | Silicoid +12, Sakkra −12 | normal |
| Darlok | – | – | – | CM 80 | – | **spy cost ×0.5; spy roll +30; defense roll +20; security display +20** | everyone −12 except Human +12 | normal |

(Nothing in v1.3 gives any race a gravity trait, a food/farming trait, telepathy, subterranean living, cybernetic repair, stealth, etc. — those are MOO2 ideas. See §2.2.)

### 1.4 Starting attitude matrix (DP at game start; symmetric)

`tbl_orion_race_relation × 12` ([1oom] `game_generate_relation_etc`). Row = holder of the record (for the human player: the AI's attitude toward you), column = other race. Label = `game_str_tbl_ra_relat[clamp(rel/12 + 8, 0, 16)]` (C truncating division).

| | Human | Mrrshan | Silicoid | Sakkra | Psilon | Alkari | Klackon | Bulrathi | Meklar | Darlok |
|---|---|---|---|---|---|---|---|---|---|---|
| **Human** | – | +12 | +12 | +12 | +12 | +12 | +12 | +12 | +12 | +12 |
| **Mrrshan** | +12 | – | 0 | −24 | 0 | −36 | −12 | −12 | 0 | −12 |
| **Silicoid** | +12 | 0 | – | 0 | 0 | 0 | −12 | 0 | +12 | −12 |
| **Sakkra** | +12 | −24 | 0 | – | 0 | −12 | −12 | 0 | −12 | −12 |
| **Psilon** | +12 | 0 | 0 | 0 | – | 0 | 0 | 0 | 0 | −12 |
| **Alkari** | +12 | −36 | 0 | −12 | 0 | – | −12 | 0 | 0 | −12 |
| **Klackon** | +12 | −12 | −12 | −12 | 0 | −12 | – | 0 | 0 | −12 |
| **Bulrathi** | +12 | −12 | 0 | 0 | 0 | 0 | 0 | – | 0 | −12 |
| **Meklar** | +12 | 0 | +12 | −12 | 0 | 0 | 0 | 0 | – | −12 |
| **Darlok** | +12 | −12 | −12 | −12 | −12 | −12 | −12 | −12 | −12 | – |

Labels: +12 RELAXED, 0 NEUTRAL, −12 UNEASE, −24 WARY, −36 RESTLESS (full ladder right below the matrix).
Both `relation1` (current) and `relation2` (the long-run base the relation drifts back toward) start at these values. [OSG] ch.11 Table 11-3 lists the same matrix in DP units of ±7/−19/−31 (= the lower edge of the same bands). The matrix is also confirmed by [SW] "Basic inclinations" (Klackon–Silicoid = unease) and [AW]/[LP] for most pairs.
(conflict: [OSG] ch.13 boxes, [LP] Silicoid preview and the [AW] Silicoid page call Silicoid↔Klackon "favorable/Relaxed", while [1oom], [SW] and the [AW] Klackon page give Unease. I use [1oom].)

Relation ladder (`uiraces.c`: label index = `clamp(trunc(relation1/12) + 8, 0, 16)`, relation1 ∈ −100..+100; the pointer on the attitude bar sits at `relation1/2` pixels from centre):

| idx | Label | relation1 | | idx | Label | relation1 |
|---|---|---|---|---|---|---|
| 16 | HARMONY | 96..100 | | 7 | UNEASE | −23..−12 |
| 15 | UNITY | 84..95 | | 6 | WARY | −35..−24 |
| 14 | FRIENDLY | 72..83 | | 5 | RESTLESS | −47..−36 |
| 13 | PEACEFUL | 60..71 | | 4 | TENSE | −59..−48 |
| 12 | AFFABLE | 48..59 | | 3 | TROUBLED | −71..−60 |
| 11 | CALM | 36..47 | | 2 | DISCORD | −83..−72 |
| 10 | AMIABLE | 24..35 | | 1 | HATE | −95..−84 |
| 9 | RELAXED | 12..23 | | 0 | FEUD | −100..−96 |
| 8 | NEUTRAL | −11..11 | | | | |

([OSG] Table 11-1 prints 12-wide bands with slightly different edges — Neutral −6..+6, Relaxed +7..+18, Unease −7..−18, … Harmony +91..+100, Feud −91..−100 — and colours the positive bands green and the negative bands red. The 1oom ladder is what the executable does; the OSG numbers are the manual's rounding.)

### 1.5 AI leader roll tables (decoded) — personality (trait1) and objective (trait2)

Rolled once at game start per empire from per-race tables ([1oom] `game_num_tbl_trait1` = 10 slots, `game_num_tbl_trait2` = 12 slots; index = `rnd_0_nm1(10)` / `rnd_0_nm1(12)`). Percentages below are exact slot counts.
Personality enum: 0 Xenophobic, 1 Ruthless, 2 Aggressive, 3 Erratic, 4 Honorable, 5 Pacifistic. Objective enum: 0 Diplomat, 1 Militarist, 2 Expansionist, 3 Technologist, 4 Industrialist, 5 Ecologist.

| Race | Personality odds [1oom] | Objective odds [1oom] (D / M / X / T / I / E) | [OSG] stated defaults |
|---|---|---|---|
| Human | Honorable 70, Pacifistic 20, Erratic 10 | 41.7 / 8.3 / 8.3 / 16.7 / 16.7 / 8.3 | Honorable 60 / Pacifist 20 / Erratic 20; Diplomat 50 |
| Mrrshan | Ruthless 70, Aggressive 20, Xenophobic 10 | 8.3 / **33.3** / 16.7 / 25.0 / 8.3 / 8.3 | Ruthless 60 / Aggressive 20 / Xenophobic 20; Militarist 50 |
| Silicoid | Xenophobic 70, Aggressive 20, Erratic 10 | 8.3 / 8.3 / **33.3** / 25.0 / 16.7 / 8.3 | Xenophobic 60 / Ruthless 20 / Aggressive 20; Expansionist 50 |
| Sakkra | Aggressive 70, Erratic 20, Ruthless 10 | 8.3 / 8.3 / **41.7** / 16.7 / 8.3 / 16.7 | Aggressive 60 / Ruthless 20 / Erratic 20; Expansionist 50 |
| Psilon | Pacifistic 70, Erratic 20, Honorable 10 | 16.7 / 8.3 / 8.3 / **41.7** / 16.7 / 8.3 | Pacifist 60 / Honorable 20 / Erratic 20; Technologist 50 |
| Alkari | Honorable 70, Pacifistic 20, Erratic 10 | 8.3 / 25.0 / **33.3** / 16.7 / 8.3 / 8.3 | Honorable 60 / Pacifist 20 / Erratic 20; Militarist 50 |
| Klackon | Xenophobic 70, Aggressive 20, Ruthless 10 | 8.3 / 16.7 / 16.7 / 16.7 / 8.3 / **33.3** | Xenophobic 60 / Ruthless 20 / Aggressive 20; Industrialist 50 |
| Bulrathi | Aggressive 70, Erratic 20, Ruthless 10 | 8.3 / 0 / 16.7 / 25.0 / 8.3 / **41.7** | Aggressive 60 / Ruthless 20 / Erratic 20; Ecologist 50 |
| Meklar | Erratic 70, Aggressive 20, Xenophobic 10 | 8.3 / 8.3 / 16.7 / 25.0 / **33.3** / 8.3 | Erratic 60 / Honorable 20 / Ruthless 20; Industrialist 50 |
| Darlok | Aggressive 70, Ruthless 20, Xenophobic 10 | 25.0 / 8.3 / 8.3 / **33.3** / 16.7 / 8.3 | Aggressive 60 / Ruthless 20 / Erratic 20; Diplomat 50 |

Raw tables, for direct copy ([1oom] `game_num.c`):
```
trait1[10 races][10]  (race order 0..9 = Human,Mrrshan,Silicoid,Sakkra,Psilon,Alkari,Klackon,Bulrathi,Meklar,Darlok)
 { 4,4,4,4,4,4,4,5,5,3 }  Human
 { 1,1,1,1,1,1,1,2,2,0 }  Mrrshan
 { 0,0,0,0,0,0,0,2,2,3 }  Silicoid
 { 2,2,2,2,2,2,2,3,3,1 }  Sakkra
 { 5,5,5,5,5,5,5,4,3,3 }  Psilon
 { 4,4,4,4,4,4,4,5,5,3 }  Alkari
 { 0,0,0,0,0,0,0,2,2,1 }  Klackon
 { 2,2,2,2,2,2,2,3,3,1 }  Bulrathi
 { 3,3,3,3,3,3,3,2,2,0 }  Meklar
 { 2,2,2,2,2,2,2,1,1,0 }  Darlok
trait2[10][12]
 { 0,0,0,0,1,2,3,4,4,0,3,5 }  Human
 { 0,1,1,1,1,3,2,2,3,3,4,5 }  Mrrshan
 { 0,1,2,2,2,2,3,3,3,4,4,5 }  Silicoid
 { 0,3,1,5,5,3,4,2,2,2,2,2 }  Sakkra
 { 0,0,3,1,2,3,3,3,3,4,4,5 }  Psilon
 { 0,1,1,1,2,2,2,3,4,2,3,5 }  Alkari
 { 0,1,1,2,2,3,3,4,5,5,5,5 }  Klackon
 { 0,5,5,5,5,2,2,3,3,3,4,5 }  Bulrathi
 { 0,1,2,2,3,3,3,4,4,4,4,5 }  Meklar
 { 0,0,3,3,1,2,0,3,3,4,4,5 }  Darlok
```
Confirmation: [DV] prints the Mrrshan row as Diplomat 8.3 / Militarist 33.3 / Expansionist 16.7 / Technologist 25.0 / Industrialist 8.3 / Ecologist 8.3 and the Human personality row as "10 / 70 / 20" — identical to the decode above.

(conflict, three-way: the **defaults agree in all 10 races for personality** and in 7/10 for objective across [1oom], [OSG] and [SW]; the secondary/alternate personalities and the stated percentages differ.
 • [OSG] says "default 60%, two alternates 20% each; objective default 50%, 10% for each other type".
 • [SW] "Racial personalities" lists yet other alternates (e.g. Alkari: Ruthless/Aggressive; Meklar: Ruthless/Honorable; Klackon: Aggressive/Erratic).
 • [1oom] (real v1.3 data) has the slot counts above. Objective defaults that differ from [OSG]/[SW]: Alkari (code: Expansionist 33% vs Militarist 25%), Klackon (code: Ecologist 33% vs Industrialist 8%), Darlok (code: Technologist 33% vs Diplomat 25%).
 Recommendation: roll with the [1oom] tables; present the OSG defaults only as flavour text.)

The **human player** also gets a trait1 from the same table (all players do; `game_generate_race_banner` pass 4) and trait2 = 0 (Diplomat; only AIs roll trait2). Neither is ever read by AI logic when the AI deals with the human (the AI uses its own traits), so they have no practical effect (my reading of the 1oom source).

---------------------------------------------------------------------------------------------------

## 2. State every race starts with (identical for all ten)

### 2.1 Start of game

[1oom] `game_generate_home_etc`, `game_generate_research`, `game_new.h` defaults; [OSG] tutorial; [LP].

| Item | Value |
|---|---|
| Home planet | **Terran**, **yellow** star, growth class NORMAL, special NORMAL (average minerals; planet label blank), base max pop **100** (the code allows 50..120 as a pbx option; Orion itself is Terran with 120) |
| Planet and star name | the race's fixed homeworld name (§1.1). MOO1 has exactly one planet per star, so planet name = star name. The player may rename it (typed names are limited to 11 characters); AI empires keep the default |
| Starting population | **50** (Simple/Easy/Average) or **40** (Hard/Impossible; "20% penalty") |
| Factories | **30** (all difficulties) |
| Starting total production shown | 55 (pop 50) or 50 (pop 40); recomputed on the first turn |
| Home planet sliders | 1oom creates every planet with Industry = 100% and the AI re-allocates at once (§5.1, §5.4). The [OSG] tutorial shows "industry 5.3 factories/yr before the player adjusts anything" for a 69 BC take-home, i.e. the real human default is probably *not* 100% industry (unverified) |
| Reserve BC | 0 ([OSG] tutorial: "Reserve Fund presently zero"); tax rate 0 (assumed; the tutorial does not state it) |
| Fleet | **2 Scouts + 1 Colony Ship** in orbit at home (`num_scouts=2, num_fighters=0, num_colony_ships=1`; colony ship unarmed) |
| Ship designs known (5 slots) | SCOUT, FIGHTER, DESTROYER, BOMBER, COLONY SHIP (table below); design names come from the race's list (§3.0) |
| Technology | **Tech #1 of each field completed** (`tech.completed[f]=1`): Computers #1 Battle Scanner; Construction #1 Reserve Fuel Tanks; Force Field #1 Class I Deflector Shield; Planetology #1 Ecological Restoration; Propulsion #1 Retro Engines (warp 1); Weapon #1 Lasers. Base components usable in designs: Shield Class I, Computer Mark I, Nuclear Missile as the base missile weapon. All six `tech.percent` = 1. **Identical for all races** — the race only changes which later techs are offered (§4.1) |
| Ranges at start | fuel range 3 parsecs; scanner range 3; engine warp 1; Scouts carry Reserve Fuel Tanks (+3 parsecs) |
| Colonisable at start | planet types ≥ MINIMAL (`have_colony_for = MINIMAL`): Minimal, Desert, Steppe, Arid, Ocean, Jungle, Terran. Planetology techs #3/#6/#9/#12/#15/#18 extend it to Barren/Tundra/Dead/Inferno/Toxic/Radiated. **Silicoids start with `RADIATED` = everything.** |
| Human research sliders at start | Computers 20, Construction 10, Force Field 15, Planetology 15, Propulsion 20, Weapon 20 (=100) |
| Colonists-operate-factories / factory cost | 2 factories per colonist (Meklar 4); factory cost 10 BC |
| Number of opponents | 1..5 (so 2..6 empires); races and banner colours are unique per empire |

Start designs (`tbl_startship`, [1oom] `game_shipdesign.c`; "look" is the sprite index inside a banner's 24-sprite set, hull small/medium/large/huge = 6 looks each):

| Design | Hull | look | Weapons | Specials | Hit points | internal "cost" value |
|---|---|---|---|---|---|---|
| Scout | Small | 0 | none | Reserve Fuel Tanks | 3 | 10 |
| Fighter | Small | 1 | 1 × Laser | – | 3 | 15 |
| Destroyer | Medium | 6 | 1 × Nuclear Missile + 3 × Laser | – | 18 | 66 |
| Bomber | Medium | 7 | 2 × Nuclear Bomb + 2 × Laser | – | 18 | 86 |
| Colony Ship | Large | 12 | none | Standard Colony Base | 100 | 591 |
(final ship look = `look + banner × 24`.)

Geometry facts for the AI start: empires always start on **yellow** stars; only the human and AI #1 are guaranteed a minimum distance / habitable neighbour (`#if 0`'d check in the engine; [DV] says the checks apply only to the first two players).

### 2.2 What MOO1 does **not** have (so do not invent it)

- **No gravity**: planets have type, base max-pop, growth class, mineral class and rocks; no gravity field. No race has a gravity preference.
- **No food / farming / "farmers"**: population grows from ecology spending and natural growth; research/industry come from the production sliders. "Lithovore" etc. do not exist; the Silicoid trait is "immune to hostile environments".
- **No per-race environment tolerance except Silicoid.** All other races treat planet types identically (the best types are Terran/Jungle/Ocean; hostile types are Radiated…Barren until the matching Controlled-Environment tech).
- **No telepathy, subterranean, cybernetic-repair, stealth, creative/uncreative, etc.** MOO1 racial effects are exactly the ten rows of §1.3.
- No "race-specific starting techs" or starting BC; no per-race starting fleet.
- Planet **size** is not a named category in the data (`planet_t` has only `max_pop1` "base size"); the [OSG] tutorial itself calls Sol "a terran planet with a size of 100". Orion's world is 120.

---------------------------------------------------------------------------------------------------

## 3. Race-by-race reference

Template per race: lore · home · leader · exact traits · research · relations · AI roll odds · AI-code hooks · names · look/sound. Lore sentences are short paraphrases; the 1993 manual could not be read, so they combine facts that fan wikis quote from it with a few embellishments from the 2016 remake that are tagged "(2016)" — drop those if you want strict MOO1. Percentages for personality/objective are from §1.5. "Leader title" is **"Emperor"** for every race (the game uses a single `emperor_names` table; the council winner is "Emperor of the Galaxy"). Race-specific titles seen on fan wikis — Alkari "Skylord", Psilon "Controller (of the Quanta)", Klackon "Queen/Empress", Human "President" — are MOO2/2016 flavour and do not exist in MOO1. Leader names: the real pool is 6 names per race in `NAMES.LBX` (item 0, 20-byte records); the lists below are the **first six names of the community wiki lists, which are believed to be the MOO1 pool** (unverified, see §7.1). Ship names are exact ([1oom] `game_str_shipnames.c`).

### 3.0 Common ship-name rule
12 names per race, **3 per hull class in ascending size** (names 0-2 = Small, 3-5 = Medium, 6-8 = Large, 9-11 = Huge). A new design for hull class h picks `names[h*3 + rnd(3)]`, skipping names already used by that empire's designs (search upward then downward; falls back to name 0). ([1oom] `game_get_random_shipnames`, `game_design_prepare_ai`.)

### 3.1 Human (ID 0)
- **Lore (paraphrase).** The adaptable species of Sol/Earth, a commercial and diplomatic people that everyone tends to like. Their only research specialty is force fields (shields); militarily unremarkable.
- **Home.** Sol (Terran, yellow star, 100 max pop, normal minerals).
- **Leader pool (MOO1, probable):** Alexander, Strader, Durash IV, Johann III, Caesar, Bladrov II. (Longer wiki list adds Lasitus, Reed, Sargon.)
- **Traits (exact).**
  - *Trade:* income = Σ over partners `trade_bc × (trade_percent + 25) / 100` ([1oom] `game_update_production`). Trade deals start at an effective −30% for other races and climb toward +100%; for Humans −5% → +125% ([AW], matches `game_diplo_set_trade`).
  - *Diplomacy:* in `game_diplo_act` every **positive** `dv` caused by a Human empire is doubled. AI-audience code (human player = Human): +50 to the AI's mood sum in `aud_check_mood`, `turn_diplo_p2_sub1/sub3`, `aud_tech_scale`; relation gain from tribute (BC and tech) ×2 (`aud_tribute_bc/tech`). [OSG]: "+60 to treaty/trade/exchange temporary modifiers when proposing; double permanent positive DPs". AI↔AI deals do not get the bonus [DV].
  - *Council:* AI voters add +20 vote weight when the candidate is Human (`game_ai_classic_vote_w`); [OSG] "strong sway over undecided Council votes".
  - *Starting attitude:* +12 (Relaxed) toward every race and from every race.
  - No growth, production, combat or spy modifiers.
- **Research cost %:** CM 100, CN 100, **FF 60**, PL 80, PR 80, WE 100.
- **AI leader odds [1oom]:** Honorable 70 / Pacifistic 20 / Erratic 10; objective Diplomat 41.7, Technologist 16.7, Industrialist 16.7, Militarist 8.3, Expansionist 8.3, Ecologist 8.3. Preferred hull-size roll modifier 0 ("average").
- **AI-code hooks:** none beyond the generic ones. (AI-controlled Humans also get `+50` in the tech-trade valuation in `turn_diplo_p2_sub1` — looks like a copy of the player bonus; harmless quirk.)
- **Ship names:** Small FIGHTER, GUNBOAT, COURIER · Medium FRIGATE, DESTROYER, CORVETTE · Large CRUISER, ESCORT, WARSHIP · Huge DREADNOUGHT, BATTLESHIP, DREADSTAR.
- **Look/sound.** Audience theme index 0x16; portrait art not described anywhere I could read — (unverified) a human leader. Ending-screen face = WINLOSE item 0x15+0.

### 3.2 Mrrshan (ID 1)
- **Lore.** Proud feline hunters, descended from cat-like predators; fierce, honour- and combat-minded, called the best gunners of the galaxy; matriarchal in the original (the portrait is a female cat-person per a fan review). The worst starting diplomacy of any race. Fierias is a sunny, flower-rich world (2016 lore; spelled "Fieras" in later games).
- **Home.** Fierias.
- **Leader pool (probable):** Jasana, Prrsha, Yalara, Miamar, Shandra, Mirana. (Longer list adds Darquan, Fargul, Marupa, Harrava Ril, Parasha Vrrn, Yarrala Hrrsh, Torfang, Arrlaan, Rrlenn.)
- **Traits (exact).**
  - `game_battle_prepare_add_ships`: for a Mrrshan side every ship design gets **`complevel += 4`**. In combat (`game_battle_attack`, `game_battle_missile_hit`) miss threshold = `50 − (attacker.complevel − defender.defense)×10` (beams) / `… defender.misdefense …` (missiles), so +4 levels = **+40 percentage points to hit**, for both beams and missiles.
  - Initiative `prio = complevel + man − unman (+3 with a scanner) (+3 Alkari)` (+1000 per subspace-teleport charge), highest first, so Mrrshan also gain **+4 initiative**; Alkari's explicit +3 is the next largest racial bonus ([AW]: "Alkari move before any other race except the Mrrshan").
  - [LP] says "+3 to attack"; [OSG]/[AW] say "+4 levels … on nonspecial weapons". (conflict; use +4.)
- **Research cost %:** CM 100, **CN 125**, FF 100, PL 100, PR 100, **WE 60**.
- **Relations:** Alkari −36 (Restless), Sakkra −24 (Wary), Klackon −12, Bulrathi −12, Darlok −12 (Unease); Human +12; the rest 0.
- **AI odds [1oom]:** Ruthless 70 / Aggressive 20 / Xenophobic 10; objective Militarist 33.3, Technologist 25.0, Expansionist 16.7, others 8.3 each. Hull roll modifier 0.
- **AI hooks:** planet ship-slider +15 (§5.4); research focus Weapons on a 25% roll (§5.5); AI-vs-AI auto-resolve ship weight +15 (+20 in Classic+) (`battle_ai_ai_get_weights`).
- **Ship names:** Small WOLVERINE, GRIFFIN, FERRET · Medium LYNX, CHEETAH, BOBCAT · Large PANTHER, LEOPARD, WARCAT · Huge SABRETOOTH, PUMA, TIGER.
- **Look/sound.** Audience theme 0x14. Fur-pattern cat motifs; fan review: leader depicted as a female feline in revealing clothing. (unverified)

### 3.3 Silicoid (ID 2)
- **Lore.** Mineral/crystalline life ("walking mini-volcanoes" in MOO1/2 art) that shrugs off hostile environments and pollution but breeds slowly and barely talks to other races. Hostile and expansionist; "strong early, weak late" ([SW]).
- **Home.** Cryslon.
- **Leader pool (probable):** Igneous, Geode, Sedimen, Crystous, Granid, Carnax. (More: Igneus Maximus, Sedimin, Krakatoa, Quorzom, Vorkronoa, Sandebar.)
- **Traits (exact).**
  - *Colonisation:* `e->have_colony_for = PLANET_TYPE_RADIATED` always (`game_update_tech_util`), i.e. a standard colony base works on **any** planet type from turn 1. AI uses `can_colonize = RADIATED` when sending colony ships.
  - *Natural growth* (`game_get_pop_growth_max`): `v = (100 − pop×100/max_pop3)/2` — no growth-class modifier (no hostile penalty, no fertile/gaia bonus), **half** the normal rate, waste not subtracted. Ecology-funded growth (`game_get_pop_growth_for_eco`): `v /= 2`. [AW]: "behaves as though every planet were hostile".
  - *Pollution:* waste percent forced to 0 (`game_planet_get_waste_percent`), `game_update_eco_on_waste` returns immediately, `game_turn_build_eco` never restores waste; eco slider shows "clean"; **no ecology spending needed**.
  - *Planetology limits:* `have_soil_enrich`, `have_adv_soil_enrich`, `have_atmos_terra` are forced `false` (techs #16, #30, #22 do nothing for them).
  - *Research-list exclusions* (NEVER flags in `game_num_ng_tech[SILICOID]`): Construction #5, #15, #25, #35 (Reduced Industrial Waste 80/60/40/20) and #45 (Industrial Waste Elimination); Planetology #3, #6, #9, #12, #15, #18 (Controlled Barren/Tundra/Dead/Inferno/Toxic/Radiated Environment), #5, #13, #34 (Improved / Enhanced / Complete Eco Restoration), #16 (Soil Enrichment), #22 (Atmospheric Terraforming). The original table forgot #24 (Advanced Eco Restoration) and #30 (Advanced Soil Enrichment); 1oom's optional bug-fix sets them to NEVER too. Silicoids keep Improved Terraforming and Cloning; Planetology #32 and #42 (Improved Terraforming 60, Advanced Cloning) are flagged ALWAYS for them.
  - *Spying:* a Silicoid spy never selects/values stolen techs of the groups Reduced-Industrial-Waste, Controlled-Environment, Eco-Restoration (`game_spy_esp_*`).
  - *Events:* Plague and Industrial-Accident events are never rolled against a Silicoid empire (`game_event_new`).
  - [OSG]: "ignore pollution; can't research or trade for Controlled Environment or Reduced Industrial Waste techs; benefit from cloning and max-population increases"; ch.6: "Silicoids always grow at the hostile-environment rate whatever the planet's real environment" (= half the normal rate, as in the code); ch.8: a planet last held by Silicoids may need heavy ecology clean-up before others can recolonise it (their waste is never cleaned).
- **Research cost %:** **CM 80**, CN/FF/PL/PR/WE all **125**.
- **Relations:** Human +12, Meklar +12, Klackon −12, Darlok −12, others 0. (conflict on Klackon, see §1.4.)
- **AI odds [1oom]:** Xenophobic 70 / Aggressive 20 / Erratic 10; objective Expansionist 33.3, Technologist 25.0, Industrialist 16.7, others 8.3. Hull roll modifier **+3** (large hulls).
- **AI hooks:** colony target type Radiated; hull +3; spy rules above; `game_turn_explore` treats any Silicoid colony ship as able to settle Radiated.
- **Ship names:** PIRANHA, STINGRAY, MINNOW · MANTA, BARRACUDA, MOREY · SHARK, MAKO, WHALE · KRAKEN, MONITOR, POLARIS.
- **Look/sound.** Audience theme 0x22. Rock/lava, volcano-like bodies (fan descriptions). (unverified)

### 3.4 Sakkra (ID 3)
- **Lore.** Reptilian egg-layers whose astronomical breeding rate forces constant expansion; aggressive, poor diplomats. Sssla is a swampy jungle world and the culture worships strength (2016).
- **Home.** Sssla.
- **Leader pool (probable):** Guanar, Tyranid, Saurak, Sauron, Hissa, Kryssta. (More: Dactylus, Tyran, Ragazor, Sarezaear.)
- **Traits (exact).**
  - `game_get_pop_growth_max`: after the planet-class adjustment, `if race==SAKKRA: v *= 2` → **natural growth ×2**.
  - `game_get_pop_growth_for_eco`: `v = eco×10 / inc_pop_cost; v *= 2` (Sakkra) → ecology-funded growth ×2.
  - `game_update_tech_util`: `inc_pop_cost = inc_pop_cost × 2 / 3` (base 20/10/5 with Cloning/Adv. Cloning → 13/6/3). These effects stack in the code.
  - [LP]/[OSG]: "population doubles growth rate"; [AW]: "+50%" (conflict; the code is ×2).
- **Research cost %:** CM 100, CN 100, FF 100, **PL 60**, PR 100, WE 100.
- **Relations:** Mrrshan −24 (Wary); Alkari, Klackon, Meklar, Darlok −12; Human +12; others 0.
- **AI odds [1oom]:** Aggressive 70 / Erratic 20 / Ruthless 10; objective Expansionist 41.7 (highest of any race), Technologist 16.7, Ecologist 16.7, others 8.3. Hull modifier 0.
- **AI hooks:** eco slider +10 when pop < max_pop2; research focus Planetology (25% roll).
- **Ship names:** GOBLIN, CYCLOPS, DAEMON · BANSHEE, SPECTRE, SPIRIT · JUGGERNAUT, VALKYRIE, HYDRA · TITAN, COLOSSUS, DRAGON.
- **Look/sound.** Audience theme 0x20. Lizard/saurian; a fan review calls the first-game portrait "a weird-looking blue lizard scientist". (unverified)

### 3.5 Psilon (ID 4)
- **Lore.** Hairless, big-brained grey scholars (an earlier prototype called them "Mentats"); peaceful, research-obsessed, weak at war. Mentar is a mild, rolling-hills world (2016).
- **Home.** Mentar (Terran, 100 max pop).
- **Leader pool (probable):** Meson, Kelvan, Quark, Zygot, Tachaon, Amios. (More: Dynalon, Erga Uticus, Psiros, Tssha, Menz Agitat, Ekar Orgit.) "Zygot" is confirmed as a MOO1 default in [LP].
- **Traits (exact).**
  - `game_get_tech_prod`: research points of a planet = `prod×slider/100`, then **`+= v/2` for Psilon (×1.5)**, then ×2 on an Artifacts planet and ×4 on a "4× tech" (Orion) planet; cap 0x7fff. So Psilon artifact planets give ×3 and Orion ×6 ([OSG]).
  - All six research fields cost 80%.
  - `game_generate_research`: when building the per-tier "limited research list", each eligible tech is taken with probability `rmax/4` (rmax = **3** for Psilon, 2 for everyone else) → 75% vs 50%, max 3 techs per tier (§4.1).
  - [OSG] calls this the "triple research bonus"; community ranking: **best race** ([SW] Best races, #1).
- **Research cost %:** all 80.
- **Relations:** neutral (0) with all; Human +12; Darlok −12.
- **AI odds [1oom]:** Pacifistic 70 / Erratic 20 / Honorable 10; objective Technologist 41.7, Diplomat 16.7, Industrialist 16.7, others 8.3. Hull modifier 0.
- **AI hooks:** planet tech-slider +20 (`game_ai_classic_turn_p3`); [OSG] AI base spy rating +10.
- **Ship names:** STARFIGHTER, COMET, SEEKER · STAR WING, STAR BLAZER, STAR STREAK · STAR BLADE, DARK STAR, CORAONA · SUN FIRE, STAR FURY, NOVA.
- **Look/sound.** Audience theme 0x1c. Fan descriptions: grey, large-headed humanoid (one review mentions a jewel on the forehead); [LP] calls the race "yellowish" and suggests a yellow banner. (unverified)

### 3.6 Alkari (ID 5)
- **Lore.** Proud avian warriors descended from large birds, still capable of limited flight; clan-/family-minded (2016); the galaxy's best pilots. Mrrshan are their sworn enemy. Homeworld Altair (an artifact world in later lore).
- **Home.** Altair.
- **Leader pool (MOO1 confirmed by a fan page listing exactly these six):** Skylord, Sharpclaw, Redwing, Farseer, Highsoar, Ariel. (MOO2 adds Tavua Preet, Voreet Zry, Heggira, Saguaro Ty, Tak Tochno, Peerik Kree, Karaaw Hirik.) "Farseer" appears as an Alkari emperor in [LP].
- **Traits (exact).**
  - `game_battle_prepare_add_ships`: **`defense += 3` and `misdefense += 3`** on every Alkari design. Each defense point lowers the attacker's hit chance by 10 points (miss threshold `50 − (att − def)×10`, capped 95): −30 points.
  - `game_battle_get_priority`: **+3 initiative**.
  - [AW]: size modifiers to defense for all races are Small +2, Medium +1, Large 0, Huge −1, so a small Alkari ship has +5.
  - [LP] estimate: ships "~2.5× harder to hit" at starting tech.
- **Research cost %:** CM 100, CN 100, **FF 125**, PL 100, **PR 60**, WE 100.
- **Relations:** Mrrshan −36 (Restless; any contact tends to become war), Sakkra −12, Klackon −12, Darlok −12; Human +12.
- **AI odds [1oom]:** Honorable 70 / Pacifistic 20 / Erratic 10; objective Expansionist 33.3, Militarist 25.0, Technologist 16.7, others 8.3 ([OSG]/[SW] say Militarist is the default; conflict §1.5). Hull modifier **−3** (small hulls).
- **AI hooks:** research focus Propulsion (25% roll); AI-vs-AI auto-resolve ship weight +15.
- **Ship names:** FOXBAT, SPARROWHAWK, PELICAN · FALCON, SKY HAWK, SPACE GULL · WARBIRD, WARHAWK, WAREAGLE · CONDOR, DREADWING, SKY MASTER.
- **Look/sound.** Audience theme 0x12. Bird-of-prey (hawk) motifs; the leader is "a bird wearing only clothes" per a fan review; wings not visible. (unverified)

### 3.7 Klackon (ID 6)
- **Lore.** Giant ant-like hive beings, extremely ordered, almost free of rebellion; each worker produces double. Kholdan is a harsh, amber-lit world and the Hive trusts few outsiders (2016).
- **Home.** Kholdan.
- **Leader pool (MOO1 confirmed for #1):** Ixitixl, Kikitik, Klaquan, Kaxal, K'kalak, Xantak. (More: Ezixl, Virzixl, Kaviq, Qurtirqul.)
- **Traits (exact).**
  - `game_update_production`: planet output = `min(factories, pop_ops×factories_per_pop) + extra`, with **`extra = pop × (tech%[PLANETOLOGY]×3 + 50) / 100`**; for Klackons **`extra <<= 1`** (×2). (The base term is the "0.5 BC per worker" that grows by 0.03 per planetology %; Klackon doubles it.) Validation: [OSG] tutorial Klackon home (pop 50, 30 factories, planetology% 1) shows gross income **82** = 30 + 2×26. [OSG] Table 13-2 (RP per Klackon worker): planetology 8 → 1.48, 17 → 2.02, 25 → 2.50, 33 → 2.98, 50 → 4.00, 67 → 5.02, 83 → 5.98, 99 → 6.94 (max).
  - [OSG] Table 5-1 footnote: a normal worker yields 2.00 RP at planetology 50 ( = (50×3+50)/100 ) and a Klackon worker double that — an independent confirmation of the formula.
  - [LP]: +20% production on fully developed colonies early, +100% on a planet without factories, shrinking to <7% late.
- **Research cost %:** CM 100, **CN 60**, FF 100, PL 100, **PR 125**, WE 100. (Cheap construction = cheaper factories/armor; poor propulsion = short range → growth stalls if boxed in.)
- **Relations:** Human +12; Mrrshan, Silicoid, Sakkra, Alkari, Darlok −12; Psilon, Bulrathi, Meklar 0.
- **AI odds [1oom]:** Xenophobic 70 / Aggressive 20 / Ruthless 10; objective Ecologist 33.3, Militarist/Expansionist/Technologist 16.7 each, Diplomat/Industrialist 8.3 ([OSG]/[SW]: Industrialist default; conflict §1.5). Hull modifier **−3**.
- **AI hooks:** eco slider +15 while pop < max_pop2 (their best planets grow fast, so they ramp ecology).
- **Ship names:** SABRE, CUTLASS, DAGGER · LANCER, PEGASUS, HORSEMAN · RANGER, KNIGHT, AVENGER · DRAGOON, PALADIN, EXCALIBER (sic).
- **Look/sound.** Audience theme 0x18. Ant / mantis insectoid (reviews say "ant or wasp"). The OSG tutorial game uses a **white-flagged Klackon** player. (art unverified)

### 3.8 Bulrathi (ID 7)
- **Lore.** Huge bear-like warriors, the galaxy's best ground troops; slow to anger and slow to befriend; ecologists at heart (research terraforming and pollution control). Homeworld Ursa.
- **Home.** Ursa.
- **Leader pool (probable):** Monch, Durpp, Grunk, Bullux, Smurch, Krungo. (More: Grorvog, Mazurek, Krorvog, Uzor, Balrokzor, Trebakka.) "Smurch" is a MOO1 default per [LP].
- **Traits (exact).**
  - `game_ground_resolve_init`: `if race==BULRATHI: force += 25`; the defender additionally gets `+5`. Each combat round: both sides roll `d100 + force`, the lower total loses one trooper (tie → side 0). So Bulrathi attack at +25 and defend at +30 vs. a normal race. [MAN]/[AW] state **+20** (the OSG notes this discrepancy: manual +20, game +25). [OSG]: ~2.15 : 1 kill ratio.
  - AI `game_ai_classic_bomb`: an AI Bulrathi multiplies its expected invasion pop by 1.2 (Classic) / 2.15 (Classic+) when judging whether a bombardment/invasion will succeed.
- **Research cost %:** **CM 125**, CN 80, FF 100, PL 100, PR 100, **WE 80**. (Poor computers = weak spies/ECM/targeting; community rating: worst-tier race [SW].)
- **Relations:** Human +12; Mrrshan −12; Darlok −12; others 0.
- **AI odds [1oom]:** Aggressive 70 / Erratic 20 / Ruthless 10; objective Ecologist 41.7, Technologist 25.0, Expansionist 16.7, Diplomat/Industrialist 8.3, **Militarist 0**. Hull modifier **+3** (large).
- **AI hooks:** eco slider +10 when pop < max_pop2; research focus Weapons (25% roll); ground-bomb estimate above.
- **Ship names:** PAW, PANDA, PATROL · HUNTER, GLADIATOR, SENTINEL · CLAW, TOOTH, WARBEAR · GRIZZLY, PUNISHER, RHINO.
- **Look/sound.** Audience theme 0x24. A bear in clothes per a fan review (later games made them more alien/boar-like). (unverified)

### 3.9 Meklar (ID 8)
- **Lore.** Cyborgs — flesh bound into powered machinery — masters of automated production and computing; unpredictable ("erratic") leaders. Homeworld Meklon. With the Silicoids they are the game's two "non-organic" races ([LP]) and start +12 toward each other.
- **Home.** Meklon.
- **Leader pool (probable):** CB-715, QX-537, INT-986, TVC-15, TX-1138, M5-35. (More: CZK-21, M3-850T, Cog Primus, 911-C4S, THX-1137, RSW-242.)
- **Traits (exact).**
  - `game_update_tech_util`: **`colonist_oper_factories += 2`**. Factories operated per colonist by Robotic Controls level (tech Computers #8/#18/#28/#38/#48): normal 2,3,4,5,6,7; **Meklar 4,5,6,7,8,9**.
  - `factory_adj_cost = factory_cost` for Meklar (others `factory_cost × colonist_oper_factories / 2`); in `game_turn_build_ind` Meklar refit cost is 0 and `pop_oper_fact` jumps straight to the new limit. [LP]: production bonus ≈ +80% at the start, shrinking to ≈ +27% by the end; ecology bill is a little higher because waste scales with factories.
  - [AW]/[LP]: Computers expertise makes them the second-hardest race to spy on (after Darloks).
- **Research cost %:** **CM 60**, CN 100, FF 100, **PL 125**, PR 100, WE 100.
- **Relations:** Human +12, Silicoid +12, Sakkra −12, Darlok −12; others 0.
- **AI odds [1oom]:** Erratic 70 / Aggressive 20 / Xenophobic 10 ([OSG]: Erratic 60 / Honorable 20 / Ruthless 20; conflict) — the only race normally led by Erratic emperors; objective Industrialist 33.3, Technologist 25.0, Expansionist 16.7, others 8.3. Hull modifier **+3**.
- **AI hooks:** industry slider +20; research focus Construction-or-Planetology (50/50) on a 25% roll.
- **Ship names:** MARAUDER, HYPERION, DRACHMA · INTRUDER, PENETRATOR, TORMENTER · AJAX, TORNADO, NEXUS · NEMESIS, DEVASTATOR, ANNIHILATOR.
- **Look/sound.** Audience theme 0x1a. Cyborg / metal-and-flesh motifs; [AW] mentions powered exoskeletons. (unverified)

### 3.10 Darlok (ID 9)
- **Lore.** Shape-shifting, cloaked, paranoid spies and thieves; everyone but Humans distrusts them; solitary traders in secrets. Nazin is a dark world under a dim sun (2016); the race was called "Nazguls" in the Star Lords prototype. In the original portrait the hood is "impenetrable blackness with glowing red eyes".
- **Home.** Nazin.
- **Leader pool (probable):** Nazgur, Narzina, Morfane, Shador, Dar'Quan, Ssithra. (More: Ember, Graymoran, Mysvaleer, Vale.)
- **Traits (exact).**
  - `game_spy_build` / `uiraces.c`: spy base cost = `tech%[COMPUTER]×2 + 25`, **halved for Darloks**, then doubles with each additional spy bought in the same empire.
  - `game_spy_turn`: `comptech1 (defence)` = Computer% **+ 20**, `comptech2 (offence)` = Computer% **+ 30** for Darlok; Races screen shows security `+20%` for Darloks. [OSG] lists +20 catch and +20 infiltration (conflict; [1oom], [LP], [AW], [DV] say +20 defend / +30 attack).
  - AI Darloks always consider espionage (the 50% gate other AIs have is skipped).
  - [OSG] Table 12-5: AI base spy rating is +30 higher for Darloks.
- **Research cost %:** **CM 80**, all others 100.
- **Relations:** −12 (Unease) with every race, both directions; Human +12.
- **AI odds [1oom]:** Aggressive 70 / Ruthless 20 / Xenophobic 10 ([OSG]: Aggressive 60 / Ruthless 20 / Erratic 20); objective Technologist 33.3, Diplomat 25.0, Industrialist 16.7, others 8.3 ([OSG]/[SW]: Diplomat default). Hull modifier 0.
- **AI hooks:** research focus Computers (25% roll); espionage logic above.
- **Ship names:** SPIDER, BUMBLEBEE, NEEDLE · HORNET, SCORPION, VENOM · TARANTULA, VIPER, COBRA · KING COBRA, BLACK WIDOW, DEATH WYN.
- **Look/sound.** Audience theme 0x1e. Hooded, cloaked figure, glowing red eyes, venom/spider/insect-sting motifs in the ship names. (partly sourced)

---------------------------------------------------------------------------------------------------

## 4. Race hooks as formulas (implementation reference)

Only the places where the race (or a race-derived number) enters the rules. Everything else belongs to the economy/tech/combat files.

### 4.1 Research (cost multiplier, Psilon, research-list roll)

```
tech%[f]  = clamp(tmax + len − v, 1, 99)      // tmax = highest completed tech number in field f
                                              // len  = number of completed techs in f
                                              // v    = (len == 1) ? 1 : (tmax−1)/5 + 2
                                              // start: len=1,tmax=1 -> 1
base cost of tech #T in field f:   C = T² × R[race][f]            (R = 60/80/100/125, §1.2)
   AI empire   :  C × 20 / 100                                     (costmula[d] = 20 for every d)
   human empire:  ((C × costmuld[d]) / 1000) × 10,  costmuld = {20,25,30,35,40}[d]
   => human, R=100:  20/25/30/35/40 × T²  RP   (matches [OSG] Table 15-1 "base cost multiplier 20..40")
research output of one planet:  v = prod_after_maint × slider% / 100
   if race == PSILON: v += v/2           // ×1.5
   if planet special == ARTIFACTS: v ×= 2 ; if special == 4X-TECH(Orion): v ×= 4 ; cap 0x7fff
```
Limited research list ([1oom] `game_generate_research`): for each empire, field and tier t = 0..9 (techs 5t+1 … 5t+5) the empire may research only a subset:
```
rmax = (race == PSILON) ? 3 : 2
repeat until the tier list is non-empty:
   pass 1: for tech = 5t+5 downto 5t+1: if table[race][f][tech] == ALWAYS (value 4): add it (max 3 per tier)
   pass 2: for tech = 5t+5 downto 5t+1: skip if NEVER (value 1) / ALWAYS / tech does not exist ("UNUSED" slot);
           else add it if rnd_1_n(4) <= rmax and fewer than 3 taken          // 50% normal, 75% Psilon
   sort ascending
```
(NEVER = 1, ALWAYS = 4 is my deduction from the table contents: only the values 0, 1, 4 occur and the 1's mark exactly the techs Silicoids cannot use.)
ALWAYS-flagged techs (identical for every race, tech numbers): Computers #8/#18/#28/#38/#48 (Robotic Controls I–V), Planetology #12/#22/#32/#42, Propulsion #3/#5, Weapon #4/#8/#11/#18/#27/#34/#41/#44. The only race with NEVER entries is Silicoid (§3.3).
AI at game start: for each field picks one of the first three entries of tier 1 of its list as its first project.
[OSG] ch.10 independently confirms the rating table of §1.2 (identical, race by race), the cost formula ("difficulty modifier 20/25/30/35/40 × (base tech level)² × racial modifier"; worked example Bulrathi, Hard, Zortrium Armor level 17: 35 × 289 × 0.8 = 8,092 BC), the 50% limited-list rule, the guarantee that every list holds a Planetary Shield, a Robotic Factory Control, a missile tech and Hydrogen-or-Deuterium Fuel Cells (the v1.3 changelog: "research rolls guarantee some key technologies, such as missiles" = the ALWAYS flags), the five-tech quintiles (a quintile opens only after a discovery in the previous one) and the discovery roll (+1% chance per extra 2% of base cost invested, = `rnd_1_n(500) <= (I−F)×250/F`). One ambiguous OSG note: "the Average rating is always used by computer players, whatever difficulty you select" — either the racial rating (AI ignores race) or the difficulty modifier (AI = 30). The v1.3 data says the AI **does** use the race multiplier and a flat modifier of 20 (`costmula = {20,20,20,20,20}`) (conflict, use the code).

### 4.2 Production and factories (Klackon, Meklar)

```
per planet (game_update_production):
   operable   = (pop − rebels) × pop_oper_fact       // the planet's current factories-per-colonist (≤ colonist_oper_factories; a refit raises it)
   production = min(factories, operable) + extra
   extra      = pop × (tech%[PLANETOLOGY]×3 + 50) / 100          // ≈ 0.5 BC per worker at tech% 0, +0.03 per planetology %
   if race == KLACKON: extra ×= 2
   AI empires only: × {Simple 1, Easy 4/5, Average 5/4, Hard 3/2, Impossible 2}   (code; "Simple larger than Easy" is a known MOO1 quirk)
   (+ reserve term, 0 if the planet is in rebellion)
colonist_oper_factories = base(Robotic Controls level: 2,3,4,5,6,7) + (race == MEKLAR ? 2 : 0)
factory_cost            = 10,9,8,7,6,5,4,3,2 by Improved Industrial Tech level (Construction #3/8/13/18/23/28/33/38)
factory_adj_cost        = (race == MEKLAR) ? factory_cost : factory_cost × colonist_oper_factories / 2    // refit pricing
Meklar refit: no BC needed; pop_oper_fact jumps straight to the new limit.   Other races pay `factory_adj_cost`-based refit and gain one level at a time.
```
Early-game check: Klackon home, pop 50, 30 factories, planetology% 1 → 30 + 2×26 = **82 BC gross** ([OSG] tutorial). Non-Klackon with the same pop: 56 (the displayed start value is 55 for pop 50).

### 4.3 Population growth (Sakkra, Silicoid)

```
natural growth per turn (game_get_pop_growth_max):
   if SILICOID: v = (100 − pop×100/max_pop3) / 2                       // class ignored, waste ignored, halved
   else:        v = 100 − (pop + waste)×100/max_pop3
                class adjust:  HOSTILE : v>=0 ? v/2 : v*2
                               NORMAL  : v
                               FERTILE : v>=0 ? v + v/2 : v*2/3
                               GAIA    : v>=0 ? v*2 : v/2
                if SAKKRA: v *= 2
   growth = (v×pop + 5)/100 (+ carried tenths); at least 1 when v>0      // result is in TENTHS of a population unit; `pop_tenths` carries the remainder
                                                                         // e.g. pop 50, normal planet, v = 50 -> 25 tenths = +2.5 pop
ecology-funded growth (game_get_pop_growth_for_eco):
   v = eco×10 / inc_pop_cost; SAKKRA: v ×= 2; SILICOID: v /= 2; capped at pop×10/4 (tenths)
inc_pop_cost = 20 (default) / 10 (Cloning, Planetology #21) / 5 (Advanced Cloning, #42);  SAKKRA: ×2/3
```
Planet growth classes: type < MINIMAL ⇒ HOSTILE; Steppe/Arid/Ocean/Jungle/Terran have a 1-in-12 chance of FERTILE; everything else NORMAL; Gaia only via terraforming. Homeworlds are NORMAL. [OSG] ch.6 summary of the classes: Hostile = growth halved (and twice as long to fill); Fertile = growth +50% and base max pop +25%; Gaia = growth ×2 and base max pop +50% (code: FERTILE `max_pop += max_pop/20×5`).

### 4.4 Trade (Human)
`total_trade_bc = Σ_j trade_bc[j] × (trade_percent[j] + (Human ? 25 : 0)) / 100`. Increasing a trade deal's size past the established amount recomputes `trade_percent = (percent×established − bc×30)/(established + bc)` (new volume starts at −30), capped at 100 → Humans effectively −5 … 125.

### 4.5 Ground combat (Bulrathi)  — `game_ground_resolve_init`, `game_ground_kill`
```
force[side] = 5×armorTier + 10×suitTier + 10×shieldTier(if any) + 5×weaponTier' (weaponTier' = tier+1 if tier>2) + (BULRATHI ? 25 : 0)
             // tiers = highest tier owned in these tech groups: ARMOR (the ship-armor line, Construction), PERSONAL_ARMOR (battle suits…, Construction),
             //         PERSONAL_SHIELD (Force Field field), PERSONAL_WEAPONS (hand weapons, Weapon field)  — see the ground-combat file
force[defender] += 5
each exchange: roll1 = d100 + force[0]; roll2 = d100 + force[1]; loser = (roll1 <= roll2) ? side0 : side1; loser loses 1 pop; repeat until one side has none
```
Also: a conquered planet may yield a stolen tech with 1/50 chance per factory ([1oom] `game_ground_finish`) — not race-specific.

### 4.6 Ship combat (Alkari, Mrrshan)  — `game_battle_prepare_add_ships`, `game_battle_attack`, `game_battle_get_priority`
```
design stats:   complevel = computer.level (+1 with Battle Scanner);   defense = man + hull.defense + extraman + 1;   misdefense = defense + jammer.level
race fixups:    MRRSHAN: complevel += 4          ALKARI: defense += 3, misdefense += 3
beam  miss threshold = 50 − (att.complevel − tgt.defense)×10  (+30 blocked line, +50 cloaked), max 95;   hit if d100 >= threshold
missile miss thr.    = 50 − (att.complevel − tgt.misdefense)×10 (+50 cloaked), max 95
initiative      = complevel + man − unman (+3 Battle Scanner) (+3 ALKARI) (+1000×subspace); acts highest first
```
Planet bases use the same formulas. (A full combat write-up belongs to the ships/combat file.)

### 4.7 Spying (Darlok)
```
spy_cost_base = tech%[COMPUTER]×2 + 25;  DARLOK: /= 2;  every additional spy in that target empire costs double the previous one
funds/turn    = total_production_bc × spying[j]/1000 + spyfund[j]        (spying slider 0..100 in tenths of a percent => 0..10% of gross)
comptech_def  = tech%[COMPUTER] (+20 DARLOK)        comptech_off = tech%[COMPUTER] (+30 DARLOK)
dt_success    = max(0, comptech_off[spy] − comptech_def[target]) (+30 if spy is hiding);  dt_caught = max(0, comptech_def[target] − comptech_off[spy]) + target.security/5
success if d100 + dt_success > 84; frame-up if > 100; caught rolls use d100 + dt_caught against 50/70/99 bands
Races screen shows security bonus "+X%" with X = security/5 (+20 for DARLOK).
```
(A Meklar with Excellent computers is the second-hardest target because the defender's number is its Computer tech%, not because of a race bonus.)

### 4.8 Race-dependent events
Plague and Industrial Accident are never generated against Silicoid empires. Everything else is race-independent. Event intensity depends on difficulty (see economy file).

---------------------------------------------------------------------------------------------------

## 5. AI leaders: generation and behaviour

**TL;DR for an implementer.** (1) Each AI gets a random unused race, unused banner colour, a name from its race's 6-name pool, a **personality** rolled from a 10-slot per-race table and an **objective** rolled from a 12-slot per-race table (§1.5). (2) The personality is a diplomatic temperament: a fixed bonus/penalty `reldiff` (−50…+20) added to every mood/threat sum, scaling of good/bad diplomatic acts, the first-contact greeting, and a random "erratic" war chance. (3) The objective only steers *resource allocation* (planet slider weights + which research field gets the 75% focus) and a few war/expansion switches (Expansionist breaks treaties more and keeps colonising, Militarist/Expansionist trigger the fleet-strength war roll). (4) Race adds small special cases (extra eco/industry/tech/ship slider points, research focus field, hull-size lean). (5) Difficulty mostly multiplies AI production and changes diplomacy asking-bonuses. Everything is reproducible from the tables and pseudo-code below.

### 5.1 Game-setup pipeline for AI empires ([1oom] `game_new`)
1. **Opponents:** 1–5 (menu) → 2–6 empires. Slot 0 is the human in a standard game.
2. **Race:** each AI "Random": uniform over unused races (see §0.1). Duplicates impossible.
3. **Banner colour:** uniform over unused colours (`rnd_0_nm1(6)`, retry; after 100 failed tries take the first free one). Six colours ⇒ at most six empires.
4. **Home:** every empire gets a Terran yellow-star home with the §2.1 start values; difficulty only changes starting pop 50 vs 40.
5. **Leader name:** `game_generate_emperor_names` — up to 200 tries of `base = race×6 + rnd(6)`, rejects any name equal (case-insensitive) to another empire's name; names come from `NAMES.LBX` item 0 (6 per race, 20-byte records). Player-typed names ≤ 11 characters. (The sibling `game_new_generate_other_emperor_name` used after a coup appears to have its dedupe test inverted in 1oom; verify before copying.)
6. **Personality (trait1)** for every empire incl. the human; **objective (trait2)** for AIs only — roll tables in §1.5.
7. **Starting attitudes:** matrix §1.4.
8. **AI start allocation** (`game_ai_classic_new_game_init`): `n` = number of planets of type ≥ MINIMAL within distance 30 of home.
   - n > 1 ("crowded"): home sliders SHIP 10 / DEF 0 / IND 90 / ECO 0 / TECH 0; research sliders Computers 20, Construction 20, Force Field 0, Planetology 40, Propulsion 20, Weapon 0; planet-slider re-roll countdown = rnd(6)+14.
   - n ≤ 1 ("isolated"): home SHIP 0 / DEF 0 / IND 60 / ECO 10 / TECH 40; research Propulsion 100; countdown = rnd(6)+24.
   - `ai_p2_countdown = rnd(10)`; `shipi_colony = 1`, `shipi_bomber = 4` are placeholders that the AI corrects on its first design pass.
9. **Difficulty handicaps for AIs:** see §5.11.

### 5.2 Personality (trait1) — what each one does

Index → name: 0 Xenophobic, 1 Ruthless, 2 Aggressive, 3 Erratic, 4 Honorable, 5 Pacifistic.

| Personality | `game_diplo_tbl_reldiff` [1oom] (added to every AI mood/threat sum) | [OSG] "Core Reaction" modifier | Act scaling (`game_diplo_act`, [1oom]) | First-contact greeting id (`14 + trait1`) | Other hooks |
|---|---|---|---|---|---|
| Xenophobic | **−50** | −50 | negative acts ×1.5, positive acts ×0.75 ([OSG]: gains halved, losses doubled, ×4 above +50 relations) | 14 | [OSG] attack chance 100%/turn, never misses an attack opportunity |
| Ruthless | **−30** | −30 | – | 15 | [OSG] attack chance 80% |
| Aggressive | **−20** | −10 (conflict) | – | 16 | [OSG] 60%; twice as likely to expand peacefully |
| Erratic | **0** | random −40…+40 rolled each turn (conflict: code has no random term) | – | 17 | random war: each turn per pair, war if `rnd_1_n(300) <= d` (d = difficulty index 0..4 ⇒ 0, 0.33, 0.67, 1.0, 1.33%; never on Simple); [OSG] 2%/turn against a random contacted player; [OSG] attack chance 10–90% |
| Honorable | **+10** | +10 | negative acts ×2 ([OSG]: ×4 when relations ≥ +51); **breaking a treaty costs it double trust** (NAP −10 → −20, alliance −20 → −40) | 18 | excluded from the "militarist/expansionist target" war check; [OSG] never attacks a race it has a treaty with (breaks it first), attack chance 40% |
| Pacifistic | **+20** | +20 | – | 19 | [OSG] attack chance 30%; seeks cease-fire faster |

Where `reldiff[trait1]` is added (all [1oom] `game_ai_classic.c` unless noted). The index is the trait of the *second* empire argument `p2`: in AI→human talks `p2` is the AI itself (its own personality shifts how generous it is); in AI↔AI deals it is the counterpart.
- Greeting/ambassador: `aud_start_human`: `v = trust + min(moods) + reldiff`; `v < −100` ⇒ audience refused (id 20 at war / 21), else `v += relation1`; `v > −50` ⇒ greeting 22 else 23. `game_diplo_is_gone`: AI is "gone" if `trust + mood + reldiff <= −100` or `mood <= −100` (the human is never gone).
- Treaty/trade requests: `aud_check_mood` (§5.6) — `+ reldiff`.
- Threats: `aud_threaten`: `v = rnd_1_n(200) + mood_treaty/2 + 2×reldiff + 100×AIprod/humanprod`; war chance `rnd_1_n(15) − reldiff > rnd_1_n(100)`.
- AI-initiated offers: `turn_diplo_p2_sub1` — when the AI proposes a non-aggression pact or alliance it may attach a **sweetener** (BC, 3/4 of the time, or a tech) only if AI.trait1 > Ruthless, i.e. Aggressive/Erratic/Honorable/Pacifistic (never Xenophobic/Ruthless); chance 1/8 per offer × (`rnd_1_n(100) <= humanProd×30/AIprod`, so it grows when the human out-produces the AI). The same sweetener rule exists in `turn_diplo_p2_sub3` for AI-proposed peace.
- War decisions: `diplo_wage_war` (§5.7).
- Order of operations when a diplomatic act of strength `dv` is applied to an AI (`game_diplo_act(dv, actor pi, AI pi2, …)`; ignored if pi2 is human, dv = 0, or Final War):
  1. relation scaling — `dv>0` and relation<0: ×2 (and the relation is capped at +10 afterwards); `dv>0`, relation≥0: ÷(relation/25 + 1); `dv≤0` and relation>0: ×2; `dv≤0`, relation≤0: ÷(−relation/25 + 1);
  2. personality of the AI: Honorable `dv<0` ×2; Xenophobic `dv<0` ×3/2 and `dv>0` ×3/4;
  3. race of the actor: Human and `dv>0` ×2;
  4. at war and message type 4–12 (a warning) with `dv<0`: only the peace mood moves, by `dv/4`;
  5. both empires AI and year > 100: `dv>0` ×2, `dv<0` ÷(d/2 + 1);
  6. apply: relation += dv (clamped ±100), treaty/trade/tech moods += dv, peace mood += (dv<0 ? dv/4 : dv); while at war relation is floored at −25 and, unless allied, capped at 65.
  A treaty break (`game_diplo_break_treaty`): trust −10 (NAP) or −20 (alliance), ×2 if the breaker is Honorable, relation −rnd_1_n(20), all four moods set to −200.
- Biological weapons: [OSG] says Pacifist and Honorable leaders never use them, all others do; I found no matching code in [1oom] (unverified).

### 5.3 Objective (trait2) — what each one does

Index → name: 0 Diplomat, 1 Militarist, 2 Expansionist, 3 Technologist, 4 Industrialist, 5 Ecologist; a 7th row "War" is used while the AI is at war with anyone.

**(a) Planet spending weights** ([1oom] `ai_p3_tbl_w[trait2][0..3]` = ship/def/ind/eco; research columns [4..8] = computer/construction/force-field/planetology/propulsion):

| Row | ship | def | ind | eco | comp | cons | ff | plan | prop | (weapon = 16 − Σ) |
|---|---|---|---|---|---|---|---|---|---|---|
| Diplomat | 1 | 2 | 4 | 1 | 2 | 2 | 4 | 2 | 3 | 3 |
| Militarist | 4 | 1 | 2 | 1 | 3 | 1 | 4 | 2 | 1 | 5 |
| Expansionist | 2 | 4 | 1 | 1 | 1 | 1 | 3 | 5 | 2 | 4 |
| Technologist | 1 | 2 | 3 | 1 | 4 | 2 | 3 | 2 | 2 | 3 |
| Industrialist | 1 | 2 | 4 | 1 | 1 | 5 | 4 | 1 | 2 | 3 |
| Ecologist | 1 | 1 | 2 | 4 | 1 | 2 | 4 | 1 | 5 | 3 |
| *War* | 4 | 1 | 1 | 1 | 2 | 2 | 4 | 2 | 1 | 5 |

**(b) What [OSG] Table 11-8 / 12-5 / ch.11 say** (design intent):

| Objective | Planet spending order (1st → 5th) | Tech order (1st → 6th) | Base spy rating | Flavour (OSG) |
|---|---|---|---|---|
| At war | Ships, Technology, Industry, Defense, Ecology | Weapons, Force Fields, Propulsion, Construction, Computers, Planetology | 40 | any objective, if at war with anyone |
| Diplomat | Technology, Industry, Defense, Ships, Ecology | Force Fields, Weapons, Propulsion, Planetology, Construction, Computers | 40 | +50 modifier on trade offers/acceptances |
| Ecologist | Ecology, Technology, Industry, Defense, Ships | Planetology, Force Fields, Weapons, Construction, Computers, Propulsion | 20 | builds up in peacetime |
| Expansionist | Technology, Defense, Ships, Industry, Ecology | Force Fields, Weapons, Planetology, Propulsion, Construction, Computers | 20 | takes peaceful-expansion chances twice as readily |
| Industrialist | Industry, Technology, Defense, Ecology, Ships | Construction, Force Fields, Weapons, Propulsion, Planetology, Computers | 30 | rushes planets to max factories |
| Militarist | Ships, Technology, Industry, Defense, Ecology | Weapons, Force Fields, Propulsion, Computers, Construction, Planetology | 30 | ship upkeep may reach 60% of economy |
| Technologist | Technology, Industry, Defense, Ecology, Ships | (none; spends evenly) | 40 | prioritises tech-speeding spending |
(Psilon +10 and Darlok +30 on the base spy rating.) The code weights above are the v1.3 data; the OSG orders are broadly similar but not identical (e.g. Ecologist research: code favours Propulsion 5/16, OSG puts Planetology first; Expansionist: code favours Planetology 5/16). (conflict; use code, mention OSG as intent.)

**(c) Other objective hooks in the code**
- **Colony sending** (`game_ai_classic_turn_p1`): non-Expansionist AIs *do not send colony ships* when more than half of their planets are "developing" (`missile_bases < max_pop3/20` and `pop < max_pop3×2/3`, with `num_planets/2 < num_developing`) **and** some human player has contact with them. Expansionists never apply this brake.
- **Breaking treaties** (`diplo_wage_war_do`, difficulty ≥ Average only): breaking an alliance: 1/4 per check, or 5/8 for an Expansionist AI; breaking a non-aggression pact: 1/2, or always for an Expansionist; on success the diplomatic act is −10000, message id 32 ("breaking treaty to expand"), `relation1` over 30 is reset to 30 (pact: 20).
- **War checks** (`diplo_wage_war`, §5.7): the fleet-strength war roll is only evaluated when the examined AI (p2) is a **Militarist or Expansionist** and not Honorable (1-in-20 chance per turn); the production-strength roll applies to any objective (1-in-20 per turn).
- **Spy rating** (OSG only): Diplomat/Technologist high, Industrialist/Militarist medium, Ecologist/Expansionist low; [1oom] uses the relation-based rule in §5.9.

### 5.4 AI planet sliders (`game_ai_classic_turn_p3`, every turn, planet by planet)

```
per empire: ti = trait2;  if treaty[any] >= WAR: ti = 6 ("War" row);   countdown -= 1
if countdown <= 0:   countdown = rnd_1_n(5) + 1               // re-allocate every 2..6 turns
    w_ship = T[ti][0];  w_def = w_ship + T[ti][1];  w_ind = w_def + T[ti][2];  w_eco = w_ind + T[ti][2]   // sic: [2] is used twice (the table's eco column [3] is ignored)
    for each owned planet:
        ship = def = ind = tech = 0                           // ECO is NOT reset, it persists
        if eco < 96: ship = 5 ; if eco < 91: def = 5 ; if eco < 81: ind = 10 ; if eco < 71: tech = 25
        if pop < max_pop3×3/4: ind = 50
        race tweaks:  Bulrathi/Sakkra & pop<max_pop2: eco += 10 ;  Klackon & pop<max_pop2: eco += 15 ;  Meklar: ind += 20 ;  Psilon: tech += 20 ;  Mrrshan: ship += 15
        special tweaks: Artifacts or 4X-Tech: tech += 20 ;  Rich or better minerals: ind += 20, ship += 10
        left = 100 − ship − def − ind − eco − tech
        while left > 0:  r1 = rnd_1_n(13); r2 = min(rnd_1_n(8)+2, left); left −= r2
              r1<=w_ship: ship+=r2 | <=w_def: def+=r2 | <=w_ind: ind+=r2 | <=w_eco: eco+=r2 | else tech+=r2
every turn: if factories >= pop×colonist_oper_factories: move IND into DEF (half) and TECH (half+rest), IND = 0
            if missile_bases > 4 and missile_bases×3 >= pop/(5 − d) and shield >= best planet shield:
                  SHIP += (fleet_cheating_fix ? DEF : SHIP)   // classic behaviour: the SHIP share simply doubles
                  DEF = 0
```
Effective band widths out of 13 (ship/def/ind/eco/tech): Diplomat & Industrialist 1/2/4/4/2 · Militarist 4/1/2/2/4 · Expansionist 2/4/1/1/5 · Technologist 1/2/3/3/4 · Ecologist 1/1/2/2/7 · War 4/1/1/1/6. The Ecologist's weight-4 eco column is ignored by the cumulative-sum quirk; in play its higher eco share comes from the persistent eco slider and the waste-driven `game_update_eco_on_waste`.

### 5.5 AI research allocation (same function)

```
only on years where (year % 10) == player index (i.e. each AI re-targets every 10 turns, staggered)
all six fields = 5
if year < 30 and rnd(2)!=0:  PROPULSION = 75                       // explore first
else:
   focus = (rnd_0_nm1(4) == 0)                                     // 25% "racial focus" roll
   BULRATHI or MRRSHAN & focus: WEAPON = 75
   DARLOK & focus:              COMPUTER = 75
   MEKLAR & focus:              (rnd(2) ? CONSTRUCTION : PLANETOLOGY) = 75
   ALKARI & focus:              PROPULSION = 75
   SAKKRA & focus:              PLANETOLOGY = 75
   otherwise: r1 = rnd_1_n(16): thresholds comp=T[4]; cons=comp+T[5]; ff=cons+T[6]; prop=ff+T[8]; plan=prop+T[7]; else WEAPON   → that field = 75
```
Total = 75 + 5×5 = 100. Note `ti` (including the "War" row) is the value left from the planet code (a documented bug).
[DV]: when the AI chooses *which* tech to start in a field, the chance that it takes the highest-level tech on offer is 0 on Simple/Easy, 2/6 on Hard and 3/6 on Impossible (the Average value is garbled in the OCR). [OSG]: the AI researches one technology at a time and pours all of its research into it until discovery.

### 5.6 AI ↔ human diplomacy thresholds (where race/personality enter)

Let `HP` = +50 if the *human player* is Human, else 0. `reldiff` = table of §5.2 for the AI's own trait1.

| Human request (id sent) | Pre-condition | Test (accept if result ≥ 0) | After the ask |
|---|---|---|---|
| Non-aggression pact (62) | relation1 > 10 | `mood_treaty + trust + relation1 + HP + reldiff + d100 − 50` (+40 if allied) | `mood_treaty −= rnd(30)+20` |
| Alliance (63) | relation1 > 50 | same, `− 125` | same |
| Peace (65) | at war | same, `− 60`; uses `mood_treaty` in Classic (original), `mood_peace` in Classic+ | `mood_peace −= rnd(50)+50` (peace asks drain the peace mood) |
| Trade (64) | – | same with `mood_trade`, `− 50` | `mood_trade −= rnd(30)+20` |
| Tech exchange | – | `tech_scale` formula | `mood_tech −= rnd(50)+20` |
| Declare war on 3rd party (67) | – | `− (relation1 toward target + 150)`; if allied and already at war with target: 1/8 yes, else no | – |
| Break alliance with 3rd party (68) | relation1 > 24 | `− (relation1 toward target + 175)` | – |
Result bands from the mood test: `< −75` hostile refusal, `< −50` firm refusal, `< 0` soft refusal, `≥ 0` accept ([OSG] shows the same shape as accept / counteroffer / reject).
Gifts: tribute BC → relation `+= bc×12/AIprod` (Classic+; Classic gives 0), ×2 if the player is Human; tribute tech → relation `+= ((d8+d8+techNo/4) × (100−relation)/10)/10`, ×2 if Human; mood_peace += same; trust += rnd(8)+2 (max 30).
Threaten: see §5.2 (result ≥170 ⇒ cease-fire 6–20 turns; ≥200 BC tribute; ≥275 tech tribute).
AI-originated proposals (`turn_diplo_p2_sub1`): NAP offer when treaty NONE, relation1 > 15 and `v + d100 + mood_treaty > 50`; alliance when (pact in force or just offered) and relation1 > 50 and `> 100`; trade when `v + d100 + mood_trade > 50`; tech swap; bounty on a third party; plus the sweeteners of §5.2. `v = trust + relation1 + HP + reldiff`.
Natural drift ([OSG]): with no change in a turn a relation moves 1 DP toward the pair's starting value (§1.4); each war permanently lowers that base by 5.
Diplomacy message ids used above (`DIPLOMAT.LBX`, 81 types, each with up to 15 text variants; `doc/list_diplo_msg_types.txt`): 1–3 praise / tribute accepted · 4–12 warnings (spying, sabotage, build-up, destroyed ships, colony attacks, bio-weapons, over-expansion) · 13, 59–61 war declarations · **14–19 first-contact greeting by personality** · 20–23 ambassador unavailable / friendly or unfriendly greeting · 24 NAP offer, 25 alliance offer, 26 trade offer, 27 demand to break an alliance, 28 bounty offer, 29 tech-swap offer, 30 peace offer, 31 general refusal, 32 "breaking treaty to expand" · 33–41 refusals citing past offences · 42–57 threats and treaty breaks · 58 bounty paid · 62–68 acceptances (62 NAP, 63 alliance, 64 trade, 65 peace, 66 tech tribute, 67 war on a third party, 68 break an alliance) · 69–72 reactions to a threat (69 ignored, 70 gives in with a cease-fire, 71 pays tribute) · 73–78 treaty-breaking / recall / alliance-honour requests · 79 council-vote warning. Ids 0, 5, 7, 35, 37, 43, 45, 51, 53 are unused placeholders.

### 5.7 War and treaty-breaking logic

**(a) `game_ai_classic_diplo_wage_war(p1, p2)`** — evaluated once per ordered AI pair (inside `turn_diplo_p1`) and once per AI–human pair when no message is pending (`turn_diplo_p2`: p1 = the human, p2 = the AI). It returns at once if p1/p2 are already at war, not in contact, or p1 is dead. The personality/objective that are tested are **p2's** (`e2`); relation and trust are read from p1's record at index p2 (for the human that is the AI's attitude toward the human).
```
1. ERRATIC:  if p2.trait1 == ERRATIC and rnd_1_n(300) <= d  (d = difficulty index 0..4)
             and (p1 is an AI or cease-fire[p1][p2] < 1):  war, message 61, diplo_val = 2000          // never on Simple
2. otherwise two independent checks, each rolled with probability 1/20 per turn:
   a) fleet check — only if p2.trait2 ∈ {MILITARIST, EXPANSIONIST} and p2.trait1 ≠ HONORABLE:
         v = relation1[p2] − fleet_w + reldiff[p2.trait1] + trust[p2];   war if v < −150
   b) production check — any objective:  same formula with prod_w;  war if v < −150
   fleet_w = 0 if ratio == 0;  +rnd_1_n(ratio) if ratio > 0;  −rnd_1_n(−ratio) if ratio < 0
   ratio   = clamp((F1 − F2)×100 / F2, −300, +300),  F = Σ shipcount×hullweight{1,5,25,125}  (saturating at 3,250,000, min 1);  prod_w uses total_production_bc the same way
3. ally pull-in (≈1/10 per turn): an AI whose ally is at war with a human is dragged into that war (approximate reading of a 4-way condition)
4. extra pressure on a human (difficulty >= Average): if the human is at war with fewer than d empires and relation1[p2] < −30:  war if rnd_1_n(10) <= −relation1/10   (≈ −relation% chance)
```
As coded, `ratio` is positive when **p1's** fleet (or production) exceeds **p2's**, and a positive `fleet_w` makes `v` more negative, i.e. war more likely. In the human-facing call p1 is the human, so (as written) an AI is more likely to start a war with a human who *out-builds it* than with a weaker one. [DV] calls this a logic oddity ("by the logic of the code the victim empire 'calls' for a war with itself") and reads it as strong militarist/expansionist AIs picking on others; [OSG] says an AI "declares war when its fleet advantage reaches 7:1 (Simple) … 3:1 (Impossible)". There is no such table in v1.3 (conflict). For OSG-like behaviour flip the sign of `ratio`; for bug-compatibility keep it. Constants 1/20, 300, −150, −95, −30 are exact; `year`/turn counters below start at 1.

**(b) `game_ai_classic_diplo_wage_war_do(p1, p2)`** (the declaration itself, `p2` = the AI):
```
if treaty is ALLIANCE or NAP:                       // treaties are only broken at difficulty >= Average
    ALLIANCE: break with probability 1/4;   5/8 if p2 is EXPANSIONIST     (rnd_0_nm1(4)==0 || (rnd_0_nm1(2)==0 && EXPANSIONIST))
    NAP     : break with probability 1/2;   1   if p2 is EXPANSIONIST
    on success: diplomatic act −10000, message 32 ("breaking our treaty to expand"), treaty broken (Honorable breaker pays double trust),
                relation1 above 30 is reset to 30 (NAP: to 20) on both sides
else if cease-fire[p1][p2] <= 0:  act −10000, message 13 if relation1[p2] < 0 else 60;  start_war
start_war: relation2 −= 5 on both sides; relation1 = −75 − rnd_1_n(25) (−76…−100); treaty/trade/tech moods −200, peace mood −130
```

**(c) Escalation ladder toward the human, `turn_diplo_p2_sub3`** (AI that has soured on the player; `v = trust + relation1 + HP + reldiff[AI.trait1]`):
```
treaty < WAR:
   relation1 <= −95                                -> war now (message 13)
   elif v − d100 + mood_treaty <= −100:
        if hatred > 0:  hatred += 1
             if hatred > 2 or treaty == NONE:
                  if rnd_1_n(100) < −(reldiff/2 + diplo_val):  war (hatred = 1, message 13)      // base +25% for Xenophobic, +15 Ruthless, +10 Aggressive, 0 Erratic, −5 Honorable, −10 Pacifistic, plus |last offence|
                  else: message += 46 and the treaty is broken
        else: hatred = 1;  if NAP/alliance/trade active: message += 38 (a warning about the last offence)
at war:  if v + d100 + mood_peace >= 50 and 1-in-8:  AI proposes peace (message 30); sweetener if rnd_1_n(100) <= AIprod×30/humanProd (3/4 BC else a tech)
```
`hatred` (0–3) exists only toward the human. Making peace: `game_diplo_stop_war` relation1 += 40 (max 100) and the human gets a cease-fire of 8–13 turns. [OSG]: relations drift 1 DP/turn back toward the pair's §1.4 value, each war lowers that base by 5 permanently.

### 5.8 AI ↔ AI diplomacy (`turn_diplo_p1`)
Per pair, each turn with probability 1/(15 − 2d): `v = trust + relation1 + reldiff[p2.trait1] + d100`, +10 for a NAP, +20 alliance, +10 trade; `v + mood_treaty > 150` ⇒ sign an alliance (the code's fall-back "else NAP" branch is effectively dead — a known oscillation bug); otherwise tech swap if `mood_tech + 80 < v`; otherwise trade of `min(prod1,prod2)/4` BC if `v > 70`. 1/20: small positive act. Allies of an AI that is at war with a third party are dragged in. After year 100 positive acts between AIs are doubled; negative ones are divided by `d/2 + 1`. Humans' race bonus does not apply between AIs ([DV]).

### 5.9 AI spying behaviour (`game_ai_classic_turn_p3` end, only after year 30)
```
security = min(100, (spies hostile to me > 0 ? rnd(2)×thatCount : 0) + 8×d)
for each contacted empire: mode = SABOTAGE if at war, else (race == DARLOK or rnd(2)) && rnd_1_n(200) > relation1×2 + 200 ? ESPIONAGE : HIDE
   AI targets another AI with probability 1/3, always targets humans; spend = rnd_1_n(5)+5 (tenths of percent units as stored)
```
[OSG] (older rule): each reassessment chance to spy = base spy rating (§5.3b) − relation − personality modifier, then 8–10% of gross economy if it passes.

### 5.10 Council voting (AI)
```
vote_w(player, cand) = (cand owns Orion ? 20 : 0) + (cand.race == HUMAN ? 20 : 0) + (voted_for[player] == cand ? 40 : 0)
vote_like(player,c)  = rnd_1_n(100) < relation1[player][c]/4 + vote_w(player,c)
vote_hate(player,c1,c2) = rnd_1_n(100) < −relation1[player][c1]/4 + vote_w(player,c2)
vote: self-candidate -> self; ally candidate -> ally; war candidate -> the other;
      relation(c1)>=0: like(c1)->c1 else hate(c1,c2)->c2;  relation(c2)>=0: like(c2)->c2 else (rnd_1_n(100) < −relation(c2)/5 + vote_w(c1)) -> c1;  else abstain
```
Votes: one per 100 population (rounded up) per empire excluding rebelling planets; the top two empires are the candidates; winner needs `((totalVotes+1)×2)/3 ≤ votes`. A voter gains +24 DP with the candidate it supports, −12 with the other, −6 with both if it abstains ([PATCH]: "voting for a candidate improves that relationship and hurts the other candidate's; abstaining slightly harms both; a vote of exactly 2/3 wins; votes no longer create automatic alliances; the High Council forms at 2/3 colonised, not 1/2 as the manual said"; also "committing genocide penalises all diplomatic relations"). [OSG] Table 15-1 adds a bonus chance that an undecided AI votes for the human: +12.5% (Simple) … +2.5% (Impossible) — I did not find it in the 1oom vote functions (unverified). No other race/personality enters the vote, except the Human +20 above; traits do not appear in the election code at all. [OSG] ch.4 agrees: owning Orion gives a +20% favourable modifier with undecided aliens, **+40% if the owner is Human**; Humans and Psilons "make lots of friends" and are the worst rivals to run against, while Darlok/Mrrshan/Alkari leaders are easy to run against because their many enemies vote against them.

### 5.11 Difficulty variables that shape AI opponents
[OSG] Table 15-1 (design table):

| Variable | Simple | Easy | Average | Hard | Impossible |
|---|---|---|---|---|---|
| AI breaks treaties with you | No | No | Yes | Yes | Yes |
| Diplomatic "asking check" bonus toward you | +50% | +40% | +30% | +20% | +10% |
| Negative DP acts between AIs × | 1 | 1 | 1 | 2/3 | 1/2 |
| Undecided AI votes for you | +12.5% | +10% | +7.5% | +5% | +2.5% |
| AI fleet advantage needed to declare war on you | 7:1 | 6:1 | 5:1 | 4:1 | 3:1 |
| Your firepower advantage before AI retreats | 4:1 | 4:1 | 5:1 | 6:1 | 7:1 |
| AI missile-base cost × | 100% | 90% | 80% | 70% | 50% |
| **AI production multiplier [OSG]** | −20% | −10% | 0 | +25% | +50% |
| AI base chance of peaceful expansion / turn | 10% | 20% | 30% | 40% | 50% |
| Your tech-cost multiplier | 20 | 25 | 30 | 35 | 40 |
| AI expansion chance when fenced in | 1/10 | 1/9 | 1/8 | 1/7 | 1/6 |
(AI tech-cost multiplier is 20 at every level, see §4.1.) (conflict: v1.3 code multiplies AI planet production by Simple ×1, Easy ×4/5, Average ×5/4, Hard ×3/2, Impossible ×2 — i.e. shifted one level and stronger than the OSG table; the code is the real behaviour of the v1.3 executable. Starting pop/factories: §2.1.)

### 5.12 When an empire's leader changes (coup, hidden key)
(The v1.3 changelog lists a hidden shortcut **ALT-P: "randomizes all emperor personalities"**, i.e. the original executable has a re-roll routine; I do not know whether it uses the race tables or the uniform roll below.)
`game_turn_coup`: when ≥ half (rounded up) of an empire's planets are in rebellion, **both traits are re-rolled uniformly** (`trait2 = rnd(6)`, `trait1 = rnd(6)` — *not* from the race tables); relation1 is reset to relation2; if the other party is a human, treaties and trade with them are cancelled; unrest on all its planets is cleared; an AI also gets a **new emperor name** (random of its race's 6) and a news item shows the new personality/objective. Players can trigger this with spy "incite rebellion" missions (Wikipedia: "rulers may occasionally revolt and change traits").

### 5.13 Where the player can see an AI's traits
The Races screen → **Report** (`uiempirereport.c`) prints the leader's personality and objective (`game_str_tbl_trait1/2`) under the race portrait, always (no spy or year gate), plus alliances, wars and known technologies. First-contact greeting variants already tell the personality (§5.2). The audience screen never prints traits.

### 5.14 AI ship-design leaning by race (`game_ai_classic_design_ship`, [OSG] Table 13-1)
```
v = rnd_0_nm1(12) + hulldiff[race];       hulldiff = {Human 0, Mrrshan 0, Silicoid +3, Sakkra 0, Psilon 0, Alkari −3, Klackon −3, Bulrathi +3, Meklar +3, Darlok 0}
v = max(v, 0);  if a human empire has pulsar weapons in play: v += 1 ([OSG]: +2 for all AI races);  v = min(v, 11)
hull = { S, M, M, M, L, L, L, L, L, H, H, H }[v]            // before modifiers: Small 1/12, Medium 3/12, Large 5/12, Huge 3/12
colony ships are always Large.  A new AI design is attempted every 6–15 turns ([OSG]).
```
[OSG] race boxes: preferred ship size Small = Alkari, Klackon; Large = Bulrathi, Meklar, Silicoid; Average = the other five.

---------------------------------------------------------------------------------------------------

## 6. Banner colours, flags and ship liveries

Six banner colours (`banner_t`), unique per empire (so a game has at most 6 empires). The player picks one right after the race (animated flag preview, 10 frames); AIs get a random free one. **The colour, not the race, selects the ship graphics** ([LP]: "this will also determine our ship models"; `sd->look += banner × SHIP_LOOK_PER_BANNER` in `game_generate_home_etc`).

| id | Colour | Flag item in `VORTEX.LBX` | Swatch index on Races/Report screens (256-colour VGA palette index, not RGB) | Ship sprite range (`look`) |
|---|---|---|---|---|
| 0 | Blue | 0x0B | 0xEB | 0–23 |
| 1 | Green | 0x0A | 0x6D | 24–47 |
| 2 | Purple | 0x0F | 0xD4 | 48–71 |
| 3 | Red | 0x0C | 0x43 | 72–95 |
| 4 | White | 0x0D | 0x0A | 96–119 |
| 5 | Yellow | 0x0E | 0x52 | 120–143 |

(Flag items are stored in the LBX in the order Green, Blue, Red, White, Yellow, Purple — "wrong order in lbx" per the 1oom source.)

- 24 sprites per colour = 4 hull classes (Small, Medium, Large, Huge) × 6 "looks" (`SHIP_LOOK_PER_HULL = 6`); the Design screen's "ship icon" picker cycles the 6 looks of the chosen hull. Ship equipment never changes the sprite.
- [OSG] ch.9 (Ship Icon box on the New Ship Design screen): "you can pick from six prefabricated icon designs" for the hull size you have selected, "the same icon should not be used for more than one active ship design", and "**the set of icons that will be available for your ships is based on the player color you choose**". That settles that each colour has its *own* 24-icon set (distinct artwork per colour, not just a tint); one blog's claim that "each hull size has one set of graphics shared by all races; only the faction colour changes" (conflict) probably means the same hull *family*, recoloured, per player — the safe remake design is 4 hull classes × 6 looks × 6 colour sets. Fleet screens also show hull size partly by the relative size of the icon.
- Other banner uses: owner flags and labels on the galaxy map, text/ring colour of fleets, Races-screen banner strip behind each race name (swatch above), audience screen overlay "emperor" graphic of the player's colour (EMBASSY item 0xC + banner), funeral ending (coffin = dead empire's banner, flag/march = living empire's).
- [OSG] tutorial example: white Klackon (player), yellow Sakkra, blue Psilon, green Silicoid.
- Star colours (not banners): yellow (home stars; best odds of habitable planets), red, green, white, blue, neutron (shown purple). Empires always start on yellow.

---------------------------------------------------------------------------------------------------

## 7. Names

### 7.1 Emperor (leader) name pools
Mechanics: 6 names per race in `NAMES.LBX` item 0 (4-byte header, then 20-byte NUL-terminated records, `base = race×6`), picked at random; AIs never share a name with another empire (case-insensitive compare, up to 200 tries); the human may type up to 11 characters. After a coup an AI draws a new name. A random-race player slot is shown as "Mr Random".

The real MOO1 file could not be read. Community wiki lists for each race are in a consistent order; **in all six cases where a MOO1 Let's Play shows a default leader name, that name is inside the first six of the wiki list**: Zygot (Psilon, #4), Ixitixl (Klackon, #1), Carnax (Silicoid, #6), Smurch (Bulrathi, #5), Hissa (Sakkra, #5), Farseer (Alkari, #4); and a MOO1 fan page (seen only in a search summary) lists exactly "Skylord, Sharpclaw, Redwing, Farseer, Highsoar, Ariel" for the Alkari. So the working hypothesis (unverified) is **pool = first six of each list**; the remainder come from MOO2.

| Race | Probable MOO1 pool (6) | Rest of the community list (MOO2 additions, unverified) |
|---|---|---|
| Human | Alexander, Strader, Durash IV, Johann III, Caesar, Bladrov II | Lasitus, Reed, Sargon |
| Mrrshan | Jasana, Prrsha, Yalara, Miamar, Shandra, Mirana | Darquan, Fargul, Marupa, Harrava Ril, Parasha Vrrn, Yarrala Hrrsh, Torfang, Arrlaan, Rrlenn |
| Silicoid | Igneous, Geode, Sedimen, Crystous, Granid, Carnax | Igneus Maximus, Sedimin, Krakatoa, Quorzom, Vorkronoa, Sandebar |
| Sakkra | Guanar, Tyranid, Saurak, Sauron, Hissa, Kryssta | Dactylus, Tyran, Ragazor, Sarezaear |
| Psilon | Meson, Kelvan, Quark, Zygot, Tachaon, Amios | Dynalon, Erga Uticus, Psiros, Tssha, Menz Agitat, Ekar Orgit |
| Alkari | Skylord, Sharpclaw, Redwing, Farseer, Highsoar, Ariel | Tavua Preet, Voreet Zry, Heggira, Saguaro Ty, Tak Tochno, Peerik Kree, Karaaw Hirik |
| Klackon | Ixitixl, Kikitik, Klaquan, Kaxal, K'kalak, Xantak | Ezixl, Virzixl, Kaviq, Qurtirqul |
| Bulrathi | Monch, Durpp, Grunk, Bullux, Smurch, Krungo | Grorvog, Mazurek, Krorvog, Uzor, Balrokzor, Trebakka |
| Meklar | CB-715, QX-537, INT-986, TVC-15, TX-1138, M5-35 | CZK-21, M3-850T, Cog Primus, 911-C4S, THX-1137, RSW-242 |
| Darlok | Nazgur, Narzina, Morfane, Shador, Dar'Quan, Ssithra | Ember, Graymoran, Mysvaleer, Vale |

(Other names seen in play are player-typed: "Nermal" (Mrrshan) and "Gmork" in [LP] are not defaults.)

### 7.2 Homeworld names
Fixed per race and identical for human and AI: Sol, Fierias, Cryslon, Sssla, Mentar, Altair, Kholdan, Ursa, Meklon, Nazin (§1.1). [LP] for a Bulrathi game shows "Cave" — a player-typed name.

### 7.3 Ship-name lists
Exact lists are in each race section (§3.x); the rule is §3.0. The manual's copy-protection "ship identification" puzzle uses 40 of these names (4 per race); not needed for a remake.

---------------------------------------------------------------------------------------------------

## 8. For artists and sound: where race art appears, and what is known about it

### 8.1 Race-art slots used by the original
| Screen | What is shown | Per race? | Where (1oom asset lookup) |
|---|---|---|---|
| New game — Choose Race | large portrait + the 3-line trait headline (§1.1) | race | `VORTEX.LBX` item 0x10 + race |
| Races screen / Empire Report | small portrait on a banner-coloured strip, race name | race (+banner) | `ui_data.gfx.planets.race[race]` |
| Audience (diplomacy) | animated leader portrait (3 frames chosen by state; talk loop) + player's banner overlay; 2 music tracks | race | `EMBASSY.LBX` item 2 + race; overlay 0xC + banner |
| Victory ("good"/"tyrant") ending | leader face | race | `WINLOSE.LBX` item 0x15 + race |
| Tech "breakthrough" / research-choice scenes | scientist of the **player's** race at a console | race | not seen in code; from [00-original-screens-notes] |
| High Council | candidate/voter portraits in alcoves | race | (assumed same portraits) |
| Ships, flags, funeral | colour-keyed, not race-keyed | banner | §6 |

### 8.2 What the sources say about each portrait (best-effort; no image was readable, so treat colours as unverified)
| Race | Portrait / body motifs | Sound |
|---|---|---|
| Human | No description found; a human leader (the only non-alien) | audience music 0x16 |
| Mrrshan | Cat-like (house-cat in 1993, later tiger/lion); leader drawn as a female feline in revealing clothing (fan review); fur markings | 0x14 |
| Silicoid | "Walking mini-volcano": rock body with lava/glow motifs | 0x22 |
| Sakkra | Lizard/saurian; a player calls the first-game portrait a "weird-looking blue lizard scientist" | 0x20 |
| Psilon | Grey-like humanoid with an enormous hairless cranium; one review mentions a jewel on the forehead; [LP] calls the race "yellowish" and a yellow banner suits it | 0x1c |
| Alkari | Hawk/bird-of-prey head, clothed, wings not visible | 0x12 |
| Klackon | Ant (also "wasp/mantis") head: chitin, mandibles, compound eyes | 0x18 |
| Bulrathi | A bear wearing clothes (large, hulking) | 0x24 |
| Meklar | Cyborg: flesh integrated with machinery/exoskeleton (not a pure robot in MOO1) | 0x1a |
| Darlok | Hooded/cloaked figure; under the hood only darkness and glowing red eyes | 0x1e |
Art credit in the original (fan review): Maria Barcia, Jeff Dee, George Purdy, Frank Vivirito, Bill Willingham.

### 8.3 Ship naming motifs (exact, useful as visual themes)
Human = military ranks/classes (Fighter → Dreadstar) · Mrrshan = big cats and hunters · Silicoid = sea predators (Piranha → Kraken) · Sakkra = mythic monsters (Goblin → Dragon) · Psilon = comets and stars (Starfighter → Nova) · Alkari = birds (Foxbat → Sky Master) · Klackon = knightly cavalry (Sabre → Excaliber) · Bulrathi = bears and gladiators (Paw → Rhino) · Meklar = mechanical titans (Marauder → Annihilator) · Darlok = venomous creatures (Spider → Death Wyn).

---------------------------------------------------------------------------------------------------

## 9. Conflicts, unverified items and gaps (consolidated)

Conflicts (my choice in bold):
1. **Personality/objective odds** — [1oom] 10/12-slot tables (§1.5) vs [OSG] "60/20/20 and 50/10…" vs [SW] alternates. **Use [1oom].** The defaults of personality agree everywhere; objective defaults differ for Alkari, Klackon, Darlok.
2. **reldiff** per personality — [1oom] {−50, −30, −20, 0, +10, +20} vs [OSG] Aggressive −10, Erratic random ±40. **[1oom]**; keep OSG's random Erratic term as an optional flavour.
3. **Xenophobic multipliers** — code ×0.75 positive / ×1.5 negative vs [OSG]/[SW] "half/double". **Code.**
4. **Honorable** — code ×2 on negative acts (and double trust loss for breaking treaties); [OSG] doubles, ×4 when relations ≥ +51. **Code, mention ×4.**
5. **Mrrshan bonus** — +4 computer levels ([1oom], [AW], [OSG]) vs "+3" ([LP]). **+4.**
6. **Bulrathi ground bonus** — +25 in code and [OSG] vs +20 in the manual text ([AW], [MAN]). **+25 (+5 more when defending).**
7. **Sakkra growth** — ×2 ([1oom], [LP], [OSG]) vs "+50%" ([AW] page). **×2** (plus ×2/3 add-pop cost).
8. **Silicoid↔Klackon relation** — Unease ([1oom], [SW], [AW] Klackon page) vs Relaxed ([OSG] box, [LP], [AW] Silicoid page). **Unease.** Other [OSG] "Favorable/Unfavorable/Loathe" lists agree with §1.4 (Loathe = −24/−36: Alkari→Mrrshan, Mrrshan→Alkari/Sakkra, Sakkra→Mrrshan).
9. **Darlok spy bonuses** — +20 defend / +30 attack ([1oom], [LP], [AW], [DV]) vs +20/+20 ([OSG]).
10. **AI production multiplier by difficulty** — code (Simple 1, Easy 0.8, Average 1.25, Hard 1.5, Impossible 2) vs [OSG] (−20%, −10%, 0, +25%, +50%). **Code for fidelity; the OSG table is the sane design.**
11. **AI war bullying** — [OSG] fleet-ratio thresholds 7:1…3:1 vs code `v < −150` rule with random ratio term. **Code.**
12. **Pulsar hull-roll bonus** — code +1, [OSG] +2.
13. **AI spying rule** — code (§5.9) vs [OSG] base-rating formula (§5.3b).
14. **Human player's own personality** — [DV] says "almost always Xenophobic Diplomat"; the code rolls trait1 from the race table for every empire (trait2 is never rolled for the human, stays Diplomat) and never reads it. No practical effect.

Unverified / not obtained:
- Exact `NAMES.LBX` contents (first-six hypothesis, §7.1).
- Real portrait and ship-sprite appearance (colours, shapes); only text descriptions exist in my sources.
- Whether the six banner icon sets differ in silhouette or only in palette ([OSG] says the *set* depends on colour; no description of the art found).
- Original manual race text (scan only). Lore above is paraphrased from fan wikis that quote it.
- StrategyWiki race pages were blocked; their content reached me only as search summaries.
- Exact semantics of who is "p1/p2" in the human-facing `diplo_wage_war` call (§5.7).
- The tutorial text says the Klackon player's home is "Sol"; I treat that as a tutorial preset (`game_new_tutor`), not a Klackon default (Kholdan).

---------------------------------------------------------------------------------------------------

## 10. Sources actually consulted

- 1oom engine, raw source files (github.com/1oom-fork/1oom, `src/game/`: game_new.c, game_num.c, game_types.h, game.h, game_planet.h, game_misc.c, game_tech.c, game_turn.c, game_event.c, game_diplo.c, game_ai_classic.c, game_battle.c, game_battle_human.c, game_ground.c, game_spy.c, game_str.c, game_str_shipnames.c, game_shipdesign.c, game_design.c, game_election.c, game_audience.c, game_parsed.c, game_stat.c; `src/ui/classic/`: uiraces.c, uinewgame.c, uiaudience.c, uiempirereport.c, uiending.c; `doc/list_diplo_msg_types.txt`).
- *Master of Orion Strategy Guide* (Emrich & Hughes) — archive.org item `MasterOfOrionStrategyGuide`, ch. 2, 3, 11, 12, 13, 15 and appendices.
- "Master of Orion 1 AI analysis for eXplorminate" (Delta V) — archive.org item `master-of-orion-1-ai-analysis`.
- lparchive.org "Master of Orion" LP — Updates 01, 14, 15, 33, 34, 55, 72, 92, 93, 125, 126, 138, 151, 170.
- StrategyWiki MOO1 pages (Racial personalities, Technology tree, Diplomacy, Backstory, Best/Average/Worst races, Attack roll) — search summaries only.
- masteroforion-archive.fandom.com *…/Master_of_Orion_I* race pages; masteroforion.fandom.com race pages (emperor-name lists) — search summaries only.
- Wikipedia "Master of Orion" (AI leaders, race specialties); Wargaming "History of the Races" (2016 lore; used only where flagged, not for numbers).

---------------------------------------------------------------------------------------------------

## 11. Machine-readable data block (copy into code)

```js
// Race order = original data order (id 0..9)
const RACES = ["Human","Mrrshan","Silicoid","Sakkra","Psilon","Alkari","Klackon","Bulrathi","Meklar","Darlok"];
const HOMEWORLD = ["Sol","Fierias","Cryslon","Sssla","Mentar","Altair","Kholdan","Ursa","Meklon","Nazin"];
const HEADLINE = [
  "EXPERT TRADERS AND MAGNIFICENT DIPLOMATS","SUPERIOR GUNNERS","IMMUNE TO HOSTILE PLANET ENVIRONMENTS",
  "INCREASED POPULATION GROWTH","SUPERIOR RESEARCH TECHNIQUES","SUPERIOR PILOTS",
  "INCREASED WORKER PRODUCTION","TERRIFIC GROUND FIGHTERS","ENHANCED FACTORY CONTROLS","SUPREME SPIES"];

// research cost % per field: [Computers, Construction, ForceField, Planetology, Propulsion, Weapon]
const TECH_COST_PCT = [
  [100,100, 60, 80, 80,100],  // Human
  [100,125,100,100,100, 60],  // Mrrshan
  [ 80,125,125,125,125,125],  // Silicoid
  [100,100,100, 60,100,100],  // Sakkra
  [ 80, 80, 80, 80, 80, 80],  // Psilon
  [100,100,125,100, 60,100],  // Alkari
  [100, 60,100,100,125,100],  // Klackon
  [125, 80,100,100,100, 80],  // Bulrathi
  [ 60,100,100,125,100,100],  // Meklar
  [ 80,100,100,100,100,100]]; // Darlok
const PSILON_RESEARCH_MULT_NUM_DEN = [3,2];          // output x1.5
const RESEARCH_LIST_PICK_OUT_OF_4 = (race) => race === 4 ? 3 : 2;   // 75% vs 50%

// leader roll tables (index = race id); pick = table[race][rnd(len)]
// personality: 0 Xenophobic,1 Ruthless,2 Aggressive,3 Erratic,4 Honorable,5 Pacifistic
const TRAIT1 = [[4,4,4,4,4,4,4,5,5,3],[1,1,1,1,1,1,1,2,2,0],[0,0,0,0,0,0,0,2,2,3],[2,2,2,2,2,2,2,3,3,1],[5,5,5,5,5,5,5,4,3,3],
                [4,4,4,4,4,4,4,5,5,3],[0,0,0,0,0,0,0,2,2,1],[2,2,2,2,2,2,2,3,3,1],[3,3,3,3,3,3,3,2,2,0],[2,2,2,2,2,2,2,1,1,0]];
// objective: 0 Diplomat,1 Militarist,2 Expansionist,3 Technologist,4 Industrialist,5 Ecologist (AI only)
const TRAIT2 = [[0,0,0,0,1,2,3,4,4,0,3,5],[0,1,1,1,1,3,2,2,3,3,4,5],[0,1,2,2,2,2,3,3,3,4,4,5],[0,3,1,5,5,3,4,2,2,2,2,2],[0,0,3,1,2,3,3,3,3,4,4,5],
                [0,1,1,1,2,2,2,3,4,2,3,5],[0,1,1,2,2,3,3,4,5,5,5,5],[0,5,5,5,5,2,2,3,3,3,4,5],[0,1,2,2,3,3,3,4,4,4,4,5],[0,0,3,3,1,2,0,3,3,4,4,5]];
const PERSONALITY = ["Xenophobic","Ruthless","Aggressive","Erratic","Honorable","Pacifistic"];
const OBJECTIVE   = ["Diplomat","Militarist","Expansionist","Technologist","Industrialist","Ecologist"];
const BANNER      = ["Blue","Green","Purple","Red","White","Yellow"];       // banner ids 0..5; ship look = design.look + banner*24
const RELDIFF = [-50,-30,-20,0,10,20];                // by personality
const GREETING_ID = (trait1) => 14 + trait1;            // 14..19

// start attitudes in units of 12 DP; relation1 = relation2 = value*12
const START_REL = [
 [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
 [ 1, 0, 0,-2, 0,-3,-1,-1, 0,-1],
 [ 1, 0, 0, 0, 0, 0,-1, 0, 1,-1],
 [ 1,-2, 0, 0, 0,-1,-1, 0,-1,-1],
 [ 1, 0, 0, 0, 0, 0, 0, 0, 0,-1],
 [ 1,-3, 0,-1, 0, 0,-1, 0, 0,-1],
 [ 1,-1,-1,-1, 0,-1, 0, 0, 0,-1],
 [ 1,-1, 0, 0, 0, 0, 0, 0, 0,-1],
 [ 1, 0, 1,-1, 0, 0, 0, 0, 0,-1],
 [ 1,-1,-1,-1,-1,-1,-1,-1,-1, 1]];
const RELATION_LABELS = ["FEUD","HATE","DISCORD","TROUBLED","TENSE","RESTLESS","WARY","UNEASE","NEUTRAL","RELAXED","AMIABLE","CALM","AFFABLE","PEACEFUL","FRIENDLY","UNITY","HARMONY"];
const relationLabel = (rel) => RELATION_LABELS[Math.max(0, Math.min(16, Math.trunc(rel / 12) + 8))];

// AI planet/research weights by objective (+ war row 6): [ship,def,ind,eco, comp,cons,ff,plan,prop]
const AI_P3_W = [[1,2,4,1,2,2,4,2,3],[4,1,2,1,3,1,4,2,1],[2,4,1,1,1,1,3,5,2],[1,2,3,1,4,2,3,2,2],[1,2,4,1,1,5,4,1,2],[1,1,2,4,1,2,4,1,5],[4,1,1,1,2,2,4,2,1]];
const HULL_ROLL_MOD = [0,0,3,0,0,-3,-3,3,3,0];          // + rnd(12) -> {S,M,M,M,L,L,L,L,L,H,H,H}
const AUDIENCE_MUSIC = [0x16,0x14,0x22,0x20,0x1c,0x12,0x18,0x24,0x1a,0x1e];  // original music indices (2 tracks: id, id+1)

// ship names: 12 per race, 3 per hull class (S,M,L,H)
const SHIP_NAMES = [
 ["FIGHTER","GUNBOAT","COURIER","FRIGATE","DESTROYER","CORVETTE","CRUISER","ESCORT","WARSHIP","DREADNOUGHT","BATTLESHIP","DREADSTAR"],
 ["WOLVERINE","GRIFFIN","FERRET","LYNX","CHEETAH","BOBCAT","PANTHER","LEOPARD","WARCAT","SABRETOOTH","PUMA","TIGER"],
 ["PIRANHA","STINGRAY","MINNOW","MANTA","BARRACUDA","MOREY","SHARK","MAKO","WHALE","KRAKEN","MONITOR","POLARIS"],
 ["GOBLIN","CYCLOPS","DAEMON","BANSHEE","SPECTRE","SPIRIT","JUGGERNAUT","VALKYRIE","HYDRA","TITAN","COLOSSUS","DRAGON"],
 ["STARFIGHTER","COMET","SEEKER","STAR WING","STAR BLAZER","STAR STREAK","STAR BLADE","DARK STAR","CORAONA","SUN FIRE","STAR FURY","NOVA"],
 ["FOXBAT","SPARROWHAWK","PELICAN","FALCON","SKY HAWK","SPACE GULL","WARBIRD","WARHAWK","WAREAGLE","CONDOR","DREADWING","SKY MASTER"],
 ["SABRE","CUTLASS","DAGGER","LANCER","PEGASUS","HORSEMAN","RANGER","KNIGHT","AVENGER","DRAGOON","PALADIN","EXCALIBER"],
 ["PAW","PANDA","PATROL","HUNTER","GLADIATOR","SENTINEL","CLAW","TOOTH","WARBEAR","GRIZZLY","PUNISHER","RHINO"],
 ["MARAUDER","HYPERION","DRACHMA","INTRUDER","PENETRATOR","TORMENTER","AJAX","TORNADO","NEXUS","NEMESIS","DEVASTATOR","ANNIHILATOR"],
 ["SPIDER","BUMBLEBEE","NEEDLE","HORNET","SCORPION","VENOM","TARANTULA","VIPER","COBRA","KING COBRA","BLACK WIDOW","DEATH WYN"]];

// race hooks (v1.3 code)
const HOOKS = {
  tradePctBonus:      {0:25},                 // Human
  ground:             {7:25},                 // Bulrathi (+5 more for the defender, any race)
  shipCompLevel:      {1:4},                  // Mrrshan (+4 initiative via complevel)
  shipDefense:        {5:3},                  // Alkari beam + missile defense; +3 initiative
  workerProdMult:     {6:2},                  // Klackon
  extraFactoriesPerPop:{8:2},                 // Meklar (no refit cost)
  popGrowthMult:      {3:2, 2:0.5},           // Sakkra x2, Silicoid x0.5 (Silicoid also ignores growth class & waste)
  addPopCostMult:     {3:[2,3]},              // Sakkra
  spyCostHalf:        {9:true}, spyAttackBonus:{9:30}, spyDefenseBonus:{9:20},
  allPlanetsColonisable:{2:true}, noWaste:{2:true}, immuneEvents:{2:["plague","accident"]},
};
```

