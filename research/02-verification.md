# 02-verification — errata for research/02-technology.md against the 1oom source (v1.3 rules)

Primary source: github.com/1oom-fork/1oom `master`, `src/game/` (game_tech.c, game_techtypes.h, game_num.c/.h, game_types.h, game_new.c, game_misc.c, game_turn.c,
game_ground.c, game_design.c, game_shiptech.c, game_spy.c, game_audience.c, game_event.c, game_fleet.c, game_ai_classic.c, game_str.c), `src/ui/classic/uitech.c`,
`uinewtech.c`, `doc/list_gamediff.txt`. Pages were read through a summarising fetch tool (no raw access): every number below was obtained as an explicit list at least once,
the load-bearing ones were cross-read a second time with a differently phrased prompt. Only numbers / formulas are restated here (1oom is GPL — no code).
"Classic" = the 1oom default flags = shipped v1.3 behaviour; all `game_num_*_fix` bug-fix flags are OFF by default (value false), so Classic = what the doc must describe.
What the C source does NOT contain (it is read from the original LBX data at run time): English tech names / descriptions, the per-tech group id and tier-in-group, and which
research-table slots are "unused" (the UNUSED placeholders of the `game_techtypes.h` enums mirror that table and were used for the level checks).

Counts: 89 rows = 76 VERIFIED, 9 WRONG (details in CORRECTIONS), 4 UNVERIFIABLE. Most important: weapon SPACE miniaturises with T50 not T25 (C1); ground-combat ties kill the
DEFENDER whenever a human is involved (C3); Combat Transporters have no "50 % land" rule (C4); PL 30 does not unlock plain Soil Enrichment (C5); fleets in transit are seen
within the full scanner range of any owned planet (C6); the AI "crowded start" count includes the home planet (C12); research/01 §4.1 "flag 4 = ALWAYS" is wrong, 02 is right (C15).

## 1. Checked items

| # | Doc § | Claim | Verdict | Note |
|---|---|---|---|---|
| 1 | 1.2 | planet RP = prod_after_maint × tech slider / 100 (integer) | VERIFIED | |
| 2 | 1.2 | Psilon: v += v/2 after the division | VERIFIED | |
| 3 | 1.2 | Artifacts world ×2, Orion planet (special 4XTECH) ×4, cap 32767 **per planet** | VERIFIED | no empire-wide cap; Orion planet = Terran, max pop 120, growth Normal, special 4XTECH (C14) |
| 4 | 1.2 | plague / nova planets excluded from the total | VERIFIED | |
| 5 | 1.2 | prod_after_maint = gross × percent_to_actual / 100 − transports | VERIFIED | percent_to_actual is a truncated INTEGER percent = actual×100/gross; actual = gross×(1000−security−spying)/1000 + trade − ship upkeep − base upkeep − gross×tax/1000, min 1 |
| 6 | 1.2 | AI multiplier Simple ×1, Easy (4v)/5, Average v+v/4, Hard v+v/2, Impossible 2v, AI only | VERIFIED | applied to the planet's gross (operating factories + worker term) BEFORE the planet reserve is added → it scales every slider, not only research; source comment "simple has larger v than easy" confirmed |
| 7 | 1.2 | default tech sliders 20/10/15/15/20/20; planets created with Industry 100 | VERIFIED | |
| 8 | 1.4 | interest = inv×3/20, capped at 2× this year's RP | VERIFIED | |
| 9 | 1.4 | roll only if cost≠0, slider≠0, empire RP≠0 and inv > cost (strict); v = (inv−cost)×250/cost; success iff rnd_1_n(500) ≤ v | VERIFIED | |
| 10 | 1.4 | else-branch: inv ×9/10 | VERIFIED | fires when cost=0 OR slider=0 OR empire RP=0; with `first_tech_rp_fix`=false it also fires for a field with no project |
| 11 | 1.4 | completion → project 0, investment 1 (also for loot/spy/trade of the project tech) | VERIFIED | done in tech_get_new; `cost[]` is NOT cleared (stale non-zero cost + project 0 = pile keeps growing without decay until a project is chosen) |
| 12 | 1.4 | worked example 100,215,347,499,673,873,1103; 5/18/33/48/63/78/93 %; E[T] ≈ 9.6 | VERIFIED | recomputed: 9.63 |
| 13 | 1.4 | displayed discovery % was half the true chance in v1.3 | VERIFIED | `list_gamediff`: fixed; 1oom shows 0.5×(proj−cost)/cost, cap 99 |
| 14 | 1.4 | no way to change a running project; replacing one zeroes the pile | VERIFIED | start_next: if a project exists → investment = 0 |
| 15 | 1.4 | order inside a turn | WRONG | incomplete → C10 |
| 16 | 1.5 | human cost ((L²·race·diff)/1000)·10, integer | VERIFIED | |
| 17 | 1.5 | AI cost (L²·race·20)/100 for every difficulty | VERIFIED | costmula = {20,20,20,20,20}; global multipliers costmuld2/costmula2/costmul = 100 |
| 18 | 1.5 | diffmul {20,25,30,35,40} | VERIFIED | |
| 19 | 1.5 | race table 10 races × 6 fields | VERIFIED | all 60 numbers identical; race ids 0..9 = Human Mrrshan Silicoid Sakkra Psilon Alkari Klackon Bulrathi Meklar Darlok; field ids 0..5 = CM CN FF PL PR WE |
| 20 | 1.5 | advanced techs (55..100) use the same formula | VERIFIED | no special case for L>50 |
| 21 | 1.5/6 | AI first project costs L²×50; picked uniformly among the 3 tier-1 slots (re-roll empty) | VERIFIED | `ai_first_tech_cost_fix` = false |
| 22 | 1.6 | TL = clamp(tmax + n − v, 1, 99), v = 1 if n=1 else (tmax−1)/5+2 | VERIFIED | n counts completed techs incl. level 1 (and the Death Ray) |
| 23 | 1.6 | TL examples 71/64/63/69/67/86 and 76,81,86,91,96,99 | VERIFIED | arithmetic |
| 24 | 1.6 | tm = clamp(TL[field] − component level, 0, 50); field per component class | VERIFIED | weapons→WE (bio→PL), engines→PR, computers & ECM→CM, shields→FF, armor→CN, specials→own field |
| 25 | 1.6/3 | cost × T50[tm]/100 and space × T25[tm]/100 for all parts | WRONG | weapon space uses T50 → C1 |
| 26 | 1.6 | hull space = base + base×TL_CN/50 | VERIFIED | |
| 27 | 1.6/4.8 | worker output per colonist (3·TL_PL+50)/100, Klackon ×2 | VERIFIED | computed once per planet: pop×(3·TL+50)/100 truncated, not per colonist |
| 28 | 1.6/1.10 | loot caps min(TL+25,50) Orion, min(TL+10,50) artifacts (human only) | VERIFIED | |
| 29 | 1.6 | spy rolls use Computers TL | VERIFIED | Darlok bonus not in doc → C8 |
| 30 | 1.7 | generation: rmax 3 Psilon / 2 others, rnd_1_n(4) ≤ rmax, ≤3 slots/tier, high→low scan, redo tier until non-empty, ascending sort | VERIFIED | |
| 31 | 1.7 | valid slots = non-0xFF entries of the research table; level 1 and Death Ray (WE 36) removed | VERIFIED | |
| 32 | 1.7 | NEVER = 1, ALWAYS = 2 (unused), essential flag = 4; every flagged field needs ≥1 flagged tech else the WHOLE generation (all fields, all players) is redone | VERIFIED | check = OR of picked techs' flags must cover every non-NEVER/ALWAYS bit of the race's row |
| 33 | 1.7 | essential sets CM {8,18,28,38,48}, PL {12,22,32,42}, PR {3,5}, WE {4,8,11,18,27,34,41,44}; CN, FF none | VERIFIED | |
| 34 | 1.7 | Silicoid NEVER: CN {5,15,25,35,45}; PL {3,5,6,9,12,13,15,16,18,22,34}; PL essential only {32,42} | VERIFIED | read twice |
| 35 | 1.7 | "bug-fix mode also never gives Silicoids PL 24 / PL 30" | UNVERIFIABLE | not in the fork's game_num.c / game_new.c; the table has exactly the 11+5 NEVER entries above |
| 36 | 1.7 | tier composition table (60 cells), totals 31/24/23/29/27/46 | VERIFIED | against the 6 UNUSED-placeholder enums, level by level |
| 37 | 1.7 | inclusion probabilities (k=1..5) | VERIFIED | re-derived analytically (2/3, 4/7, 35 %/45 %/52 %, Psilon 80 %, 76 %, 20 %); the 101.9/129.1/96.1 sizes follow from them (simulated by the project's tests) |
| 38 | 1.7 | after generation base_shield Class I, base_comp Mark I, base_weapon 2-shot Nuclear Missile, completed = {1} | VERIFIED | |
| 39 | 1.8 | choice list: maxtier 1 if one tech else min(10,(tmax−1)/5+2); ≤12 entries; tier ascending then slot ascending | VERIFIED | TECH_NEXT_MAX = 12 |
| 40 | 1.8 | advanced fallback tmax = 55 if ≤50 else min(100,tmax+5) | VERIFIED | |
| 41 | 1.8 | AI pick: rnd_1_n(6) < difficulty(0..4) → LAST entry else uniform | VERIFIED | DIFFICULTY SIMPLE 0 … IMPOSSIBLE 4 |
| 42 | 1.8 | human prompt when the project just completed or (no project and investment > 0), same turn | VERIFIED | |
| 43 | 1.8 | advanced tech names "Advanced <Field> Tech <Roman>", roman (L−50)/5; text "General improvements of existing <field> technology" | VERIFIED | strings → C13 |
| 44 | 1.9 | tech slider steps 2 / Ctrl 10 / Alt 0-100, lock key | VERIFIED | |
| 45 | 1.9 | equalise '=' sets 16/17/17/16/17/17 ignoring locks | VERIFIED | classic branch; the fixbugs branch differs → C11 |
| 46 | 1.9/4.9 | slider auto-adjust popups | WRONG | → C7 |
| 47 | 1.9 | left panel: armor tier×5, suit ×10, shield ×10, weapons ×5, last matching tech wins | VERIFIED | |
| 48 | 1.10 | Orion loot: Death Ray + 3 rounds × ≤200 tries, field uniform, level = rnd_1_n(31)+19, cap min(TL+25,50), must exist in the master table and be unowned | VERIFIED | AI not excluded; fired from the event pass when guardian_killer is set |
| 49 | 1.10 | artifact loot: 1 round, level rnd_1_n(30), cap min(TL+10,50), AI never gets it | VERIFIED | nuance C14 |
| 50 | 1.10 | spy theft details | WRONG | → C8 |
| 51 | 1.10 | invasion capture: 1/50 per factory, min(candidates, 6, successes), source FOUND | VERIFIED | no level cap, no spy-style roll |
| 52 | 1.10 | tech exchange: up to 5 AI techs offered / 4 of yours accepted; mood_tech −(21..70) player ask, −(21..50) AI offer; value = L² × group mult, ÷4 if better owned, 0 if equal | VERIFIED | extras → C9 |
| 53 | 1.10 | AI acceptance scale v = max(75, …) | VERIFIED | aud_tech_scale formula → C9 |
| 54 | 1.10 | tribute: ((d8+d8+level/4)·base)/10, base 20 if relation<0 else (100−relation)/10, "×2 if the receiver is human" | WRONG | formula right; the ×2 tests the giver's RACE (Human), not "human-controlled" → C9 |
| 55 | 1.10 | sweetener bc = (((d8+d8)·year)/25)·25, 0 if > reserve; bounty techs never paid in v1.3 | VERIFIED | `aud_bounty_give` = false |
| 56 | 1.10 | final war pooling | VERIFIED | two phases (accepters, then refusers); AI recipients overwrite their list silently, humans get the missing techs as TRADE events |
| 57 | 1.10 | derelict (AI only, WE and FF, first slot of the first TL/5+2 tiers) and virus (CM/FF/PR/WE, investment := 0), one-time events | VERIFIED | |
| 58 | 2 | level / name / tier of all 180 researchable techs + L1 bundles | VERIFIED | vs the six enums; type codes and in-game spelling of names UNVERIFIABLE (LBX) |
| 59 | 2/4 | robotic 8/18/28/38/48→3..7 (+2 Meklar); factory cost 9..2 at CN 3,8,13,18,23,28,33,38; waste scale 8,6,4,2,0 at CN 5,15,25,35,45; eco restoration 3,5,10,20 at PL 5,13,24,34 | VERIFIED | |
| 60 | 2/4 | fuel 4,5,6,7,8,9,10,30 at PR 3,5,9,14,19,23,29,41; scanner 5/7/9 at CM 4/13/23; engines have_engine 1..8 at PR 6,12,…,48; stargate PR 27, interdictor 43, combat transporters 45 | VERIFIED | |
| 61 | 2/4 | terraform N 10,20,30,40,50,60,80,100,120 and cost/pop 5,5,4,4,3,3,2,2,2; colony types PL 3→Barren … 18→Radiated; antidote 1/2; cloning 20→10→5 (Sakkra ×2/3 → 13/6/3); planet shields 5/10/15/20 for 500/1000/1500/2000 | VERIFIED | |
| 62 | 2.4 | soil formulas (+25 %/+50 % with the ÷20, ÷10, %5 quirk, min 5), atmospheric +20/+10/+0, costs 150/300/200 | VERIFIED | strict `>` for soil and advanced soil, `≥` for atmospheric |
| 63 | 2.4 | "Advanced Soil Enrichment also covers plain Soil Enrichment" | WRONG | → C5 |
| 64 | 2.5 | Combat Transporters "≥50 % of troop ships land" | WRONG | → C4 |
| 65 | 2.1/4.2 | scanner ship ranges "ships in transit seen at 0/1/2/3 pc" | WRONG | → C6 |
| 66 | 2.5 | transports move at have_engine; fleet warp = engine index+1 (slowest ship) | VERIFIED | stargate link (both ends own a gate) overrides |
| 67 | 2.5 | Stargate 3000 BC, maintenance constant 100 | VERIFIED | 100 BC per gate per turn (added to upkeep) |
| 68 | 2 | tech descriptions, in-game name spellings, "cost text 50 BC" etc. | UNVERIFIABLE | LBX text |
| 69 | 3.1 | weapon table (cost/space/power/range/acc/ammo/fires/xHit/flags) | VERIFIED | all 48 listed rows incl. Death Ray (200-1000, 1000/2000/2000) and monster weapons |
| 70 | 3.2-3.6 | computers (11), ECM (10), deflectors (11), armor (7 + II), engines (9), hulls (4) | VERIFIED | every number |
| 71 | 3.7 | 30 specials: cost/space/power per hull + effect numbers | VERIFIED | |
| 72 | 3 | design cost = (hull + Σ parts + 5)/10, min 1; parts floored at 5 raw (computer/ECM at 1) | VERIFIED | |
| 73 | 4.1-4.3 | factories, range, scanner, pop/terraform tables | VERIFIED | (rows 59-61) |
| 74 | 4.4 | planet shield table; base weapon = best 2-shot single missile, second = best multi-missile; base HP {50,75,100,125,150,175,200} | VERIFIED | |
| 75 | 4.4 | base cost "units unverified" | VERIFIED | gap filled: BC, → C2 |
| 76 | 4.5 | spy purchase base = 2·TL_CM + 25, Darlok halved | VERIFIED | each further spy bought the same turn doubles the price |
| 77 | 5 | ground force = 5·armor + 10·suit + 10·shield + 5·weapon′ (+25 Bulrathi) (+5 planet owner); weapon′ = tier+1 above 2; round = d100+force each | VERIFIED | |
| 78 | 5 | tie costs the attacker | WRONG | → C3 |
| 79 | 5/2 | tier numbers (armor 1-6, suits 1-3, shields 1-3, weapons 1-5) | UNVERIFIABLE | tiers come from the LBX table; only the ×5/×10/+1 arithmetic is in code |
| 80 | 6 | AI start: n counts habitable planets within 30 map units, home included; n>1 crowded sliders 10/0/90/0/0 + 20/20/0/40/20/0; else 0/0/60/10/40 (=110) + PR 100 | VERIFIED | |
| 81 | 6 | AI re-roll when year%10 == player index: all 5, one 75; year<30 coin flip → PR; 1-in-4 focus per race; else weights | VERIFIED | |
| 82 | 6 | weights table (7 rows × CM CN FF PL PR) and cumulative order CM,CN,FF,PR,PL,WE | VERIFIED | read twice; column labels in the source comment = [computer, construction, force field, planetology, propulsion], code adds PR (col 8) before PL (col 7) |
| 83 | 6 | objective indices 0 Diplomat 1 Militarist 2 Expansionist 3 Technologist 4 Industrialist 5 Ecologist | VERIFIED | trait2 enum; personality 0 Xenophobic 1 Ruthless 2 Aggressive 3 Erratic 4 Honorable 5 Pacifistic |
| 84 | 6 | AI swaps when (mood_tech+80) < value; hoards singular techs | VERIFIED | |
| 85 | A | machine-readable tech list | VERIFIED | levels/names/tiers match the enums |
| 86 | B | cost table 60 levels × 5 difficulties + AI | VERIFIED | 25 levels recomputed by hand (all five columns) |
| 87 | C | T50 / T25 (51 entries each) | VERIFIED | all 102 values identical to the source tables |
| 88 | D | group membership / in-group tiers | UNVERIFIABLE | stored in the LBX table; only the 26 group ids (SINGULAR 0 … STREAM_PROJECTOR 25, PENETRATING_BEAMS 30) and the 12 "special" spy groups are in code |
| 89 | E | constants (TECH_NEXT_MAX 12, TECH_SPY_MAX 6, soil 150 / adv 300 / atmos 200, shield cost table, stargate 3000/100, max pop 300, max factories 2500, base HP table, autoadj {0,25,50,75}) | VERIFIED | max factories: 2500 is the fork default (open question 9) |

## 2. CORRECTIONS (paste-ready)

**C1 — miniaturisation of weapon space (doc lines 194, 637, §1.6 #1, Appendix C heading).** Cost of EVERY component = floor(raw × T50[tm] / 100). Space = floor(raw × T25[tm] / 100)
for engines, computers, ECM, shields, armor and specials, but floor(raw × **T50**[tm] / 100) for **weapons** (beams, missiles, torpedoes, bombs, bio-weapons). A fitted part never
drops below 1 space unit. Power never shrinks. tm = clamp(TL[field] − component tech level, 0, 50). Hull space = base + floor(base × TL_CN / 50) (TL 50 doubles it).
Per-item cost floors inside a design: weapons, shield, armor, specials, engine ≥ 5 raw; computer, ECM ≥ 1 raw; displayed cost = max(1, (sum + 5)/10). (research/03 §2.3 and
js/data/components.js already do this.)

**C2 — missile base price (doc §4.4).** With m = T50[min(TL_field, 50) − 1] (NOT relative to the part's level; TL of the part's own field: armor CN, weapon WE, shield FF, computer & ECM CM):
sum = floor((armor_large_cost + hull_large_cost)·m / 1500) [armor = best owned STANDARD armor] + floor(weapon_cost·(m·9) / 1000) [best 2-shot single missile] + floor(shield_cost_L·m/1000) + shield_power_L/10
+ floor(comp_cost_L·m/1000) + comp_power_L/10 + floor(ecm_cost_L·m/1000) + ecm_power_L/10 (no ECM owned → 0). Price = floor(sum×3/5); AI empires then ×9/10 (Easy), ×8/10 (Average), ×7/10 (Hard), ÷2 (Impossible),
×1 (Simple); minimum 50 BC. Start of game (TL 1): 133+63+126+102+0 = 424 → 254 BC. Unit = BC. Upgrade of existing bases bills (new − old) × bases.

**C3 — ground-combat tie (doc §5).** Per round: total_a = d100 + force_a, total_b = d100 + force_b; "side 0" loses one troop when total_0 ≤ total_1, else side 1 loses one. Side 0 = the invader
when no human-controlled empire takes part (AI vs AI); when a human is involved the two sides are swapped for the calculation (side 0 = planet owner, or the rebels), so a tie kills a
DEFENDER troop (invader wins ties). The +5 goes to the planet owner in both cases, Bulrathi +25 to its own side, rebels add no force. Loop ends when one side has 0 troops; pop := min(pop, max_pop3);
on capture pop_oper_fact = 1, bc_to_refit = 0. (Printed manual says both lose one troop on a tie; research/03 line 712 already records the human/AI split.)

**C4 — Combat Transporters (doc §2.5, §1.10).** There is no "at least 50 % land" rule. The rule works on the troops KILLED by planetary/ship fire (n = sent − survivors, computed after monsters/guardian zeroing, before landing),
and only when the INVADER owns tech PR 45. Fixed rule (`combat_trans_fix`, matches the printed manual): each of the n lost troops is restored with probability 1/2, or 1/4 if the planet owner has a Sub Space Interdictor.
Shipped v1.3 (flag off): only if the planet owner has an Interdictor, each lost troop is restored with probability 1/4 + (3/4)(1/2) = 5/8; otherwise nothing. Choose one and document the toggle.

**C5 — soil flags and Silicoid overrides (doc §2.4, §4.3).** have_soil_enrich = PL 16 ONLY; have_adv_soil_enrich = PL 30 ONLY (it does not set the soil flag); have_atmos_terra = PL 22 ONLY; all three are FALSE for Silicoids;
Silicoid have_colony_for = Radiated (type 1) whatever techs they own. Per planet per turn the ecology BC (after waste cleanup) go: 1) atmospheric project (growth Hostile, tech 22; fires when the accumulated BC ≥ 200);
2) soil (growth Normal, tech 16; fires when accumulated > 150 → Fertile); 3) advanced soil (growth strictly between Hostile and Gaia = Normal or Fertile, tech 30; fires when > 300 → Gaia);
4) terraform increments; 5) population growth. "Advanced Soil Enrichment covers plain Soil Enrichment" only means it works from Normal growth directly (300 BC, no 150 BC step) when PL 16 is not owned.

**C6 — scanners and visibility (doc §2.1, §4.2).** S = scanner_range (3 base, 5 / 7 / 9 with CM 4 / 13 / 23).
Planets: visible when the nearest planet owned by (or allied with) the viewer is within S parsecs (star distance). Fleets and transports on their way: radii are in MAP UNITS (octagonal dist_fast, 10 per scanner point —
a little under S parsecs on a map with ≈11 units per parsec): visible within 10·S units of ANY owned planet, and within (5·S − 15) = 0 / 10 / 20 / 30 units of a star where the viewer has ships in orbit or of his own fleets in
transit (allies are not considered for fleets). The doc's "0/1/2/3 pc" is that second, small radius around own ships, not the radius around planets.
Ships in orbit explore their star; the Advanced Space Scanner (CM 23) auto-explores planets within 110 map units of an owned planet (game_num_adv_scan_range) but never triggers artifact loot.
v1.3 quirk: own ships in transit never reveal planets (`ship_scanner_fix` off). Empire contact (one reading): contact when the nearest planets of the two empires are within max(fuel range A, fuel range B) parsecs.
Fuel: within_frange = 1 up to fuel_range from the nearest own/allied planet, 2 up to fuel_range + 3 (ships with Reserve Fuel Tanks only), else 0.

**C7 — auto-adjust popups (doc §1.9, §4.9).** Shown only for tech ids ≤ 50 and once per level (best-so-far per player): Construction with (level−5)%10 = 0 (waste 5,15,25,35,45) and Planetology
Improved/Enhanced/Advanced/Complete Eco Restoration (5,13,24,34) → yes/no "re-balance ecology for waste" dialog; Computers with (level−8)%10 = 0 (8,18,28,38,48) → Industry slider; Planetology (level−2)%6 = 0
(terraforming 2,8,…,50) → Ecology; Force Fields (level−12)%10 = 0 (planetary shields 12,22,32,42) → Defense; Soil Enrichment / Advanced Soil Enrichment → Ecology; Atmospheric Terraforming → Ecology.
Options 0 / 25 / 50 / 75 %. **Silicoids are excluded only from the waste and eco-restoration dialogs**; the robotic, terraforming, planetary-shield (and soil/atmospheric) dialogs still appear for them.
The check ignores how the tech arrived (research, spy, loot, trade). `newtech_adjust_fix` (off) changes nothing here.

**C8 — espionage (doc §1.10, §4.5).** Candidates = every tech of the target (all six fields) the spy does not own; for the 12 special groups (Improved Robotic Controls, Space Scanner, Reduced Industrial Waste,
Improved Industrial Tech, Planetary Shield, Improved Terraforming, Controlled Environment, Eco Restoration, Personal Armor, Personal Shield, Fuel Cells, Personal Weapons) a tech also counts as owned when the spy has an
equal-or-higher tier of the group (source quirk: the tier of the LAST matching owned tech, not the maximum). A Silicoid spy never gets Reduced Industrial Waste / Controlled Environment / Eco Restoration techs.
Selection: up to 500 tries; field uniform over the 6 (skip empty), candidate uniform within the field, no duplicates, stop at 6; value = level² × (10 singular, 6 robotic controls, 3 waste, 3 eco restoration), ÷4 if the spy owns a higher tier
of the group, 0 if the same, 0 for Silicoid + the three groups, 30000 for the Death Ray; value 0 is skipped. Level cap (espionage): r = max of one d100 per successful spy; r = r × (highest TL of the target over the six fields) / 100;
every candidate whose LEVEL (tech id) > r is dropped. A human spy runs 5 selection rounds, keeps the first candidate found per field and then **chooses only the FIELD** (the tech inside it is random); an AI spy takes the first candidate.
Rolls (per spy→target pair): comp_spy = TL_CM (+30 if the spy is Darlok), comp_target = TL_CM (+20 if the target is Darlok); dt1 = max(0, comp_spy − comp_target) (+30 in Hide mode); success = d100 + dt1 > 84, ONE roll for the whole group of
surviving spies; frame possible when > 100. Catch: dt2 = max(0, comp_target − comp_spy) + target security/5; each spy rolls d100 + dt2: Hide mode caught when > 85; otherwise > 99 caught and failed (all), > 70 caught and failed, > 50 failed (one reading of the code).
Spy price: base = 2·TL_CM + 25 (Darlok /2); every further spy bought in one go doubles the price. Invasion capture uses the same candidate/value rules but NO level cap and no rolls.

**C9 — trading and tribute (doc §1.10).** Value of a tech for trade = level² × (10 singular, 6 robotic controls, 3 waste, 3 eco restoration), ÷4 if the receiver already owns a better tech of the group, 0 for the same level, 0 for Silicoids and
waste/environment/eco techs, 30000 for the Death Ray. Player-initiated exchange: scale v = aud_tech_scale = max(75, f) with di = mood_tech (if >0: /5, cap 30; +25 allied); x = trust + relation/2 + (50 if the player's race is Human)
+ 2·reldiff[AI personality] + di + d100 − 125; x<0 → |x|+100, else 20000/(x+200); f = x/4. AI techs offered up to 5 (value × v/100 = price), your techs offered up to 4 with value ≥ price; mood_tech −(rnd_1_n(50)+20), afterwards mood_tech ≥ 50;
AI-initiated offer lists ≤ 4, mood_tech −(rnd_1_n(30)+20); the entry is disabled at war. Tribute tech: v = ((d8 + d8 + level/4) × base)/10, base = 20 if relation < 0 else (100 − relation)/10, then **×2 if the empire giving the tribute is of race Human**
(the code tests the RACE, not "is human-controlled"); relation ≤ 100, mood_peace ≤ 200, trust += d8 + 2 (≤ 30).

**C10 — end-of-turn order (doc §1.4).** production → ecology/waste → total research → … → ship movement → battles → spy results → **tech research for all empires** → (humans: new-tech screens and next-project prompts)
→ Orion guardian ships cleared → explore (artifact looter set) → bombing → transports → ground combat → coups → **random events (Orion loot, derelict, virus)** → **artifact loot** → (humans: new-tech screens again) → diplomacy/council → fuel check →
year + 1 → tech-derived values and TL (`percent`) refreshed LAST. New-tech screens therefore appear twice per turn; TL used inside the turn is the value of the previous refresh.

**C11 — slider rule (doc §1.2).** Moving a slider (tech sliders and the five planet sliders share one rule): budget = 100 − sum of locked sliders; moved slider := min(value, budget); the other unlocked sliders, in index order, keep their value while budget remains,
the first that no longer fits is cut to what is left, all later ones become 0; any surplus goes to the LAST unlocked slider, or to the FIRST unlocked one when the moved slider is itself the last. The moved slider's own lock flag is not tested.
Equalise: Classic sets the fixed 16/17/17/16/17/17 ignoring locks; with `fixbugs` it spreads the sum of the unlocked sliders evenly (17/17/17/17/16/16, remainder to the first sliders).

**C12 — AI start (doc §6.3).** n = number of planets of type ≥ Minimal within 30 map units of the home planet **including the home planet itself** (n ≥ 1); crowded ⇔ n > 1 (≥ 1 other habitable planet). Countdown (planet-slider re-roll) = rnd_1_n(6)+14 when crowded, rnd_1_n(6)+24 otherwise;
ai_p2 countdown = rnd_1_n(10). Isolated planet sliders are 0/0/60/10/40 = 110 (not normalised at start). First projects: per field one of the three tier-1 slots chosen uniformly (empty slot re-rolled), project = level, cost = level² × 50.

**C13 — advanced tech text.** Name = "Advanced" + field word + "Tech" + roman numeral (L55 → I … L100 → X); field words: Computer, Construction, Force Field, Planetology, Propulsion, Weapon. Description = "General improvements of existing <field word lower-case> technology."
Field names elsewhere: Computer, Construction, Force Field, Planetology, Propulsion, Weapon.

**C14 — Orion, artifacts, events.** Orion planet: Terran, max pop 120 (all three max-pop variables), growth Normal, special 4XTECH (research ×4), Guardian present; internal year starts at 1; first random-event year field = 40; each event type happens once per game.
Orion loot is paid out in the event pass after the Guardian is killed: Death Ray first (WE 36, always), then 3 rounds as in row 48. Artifact loot: the planet must not be explored by anybody yet; the first player by index with a SHIP in orbit (scanner-only never counts) becomes
looter — AIs qualify too, but the loot function returns at once for AIs, so an AI exploring first wastes it.

**C15 — resolves research/01 §4.1 vs 02 §1.7.** In `game_num_ng_tech` bit 1 = NEVER, bit 2 = ALWAYS (pass 1, taken first, never set in the default table), bit **4 = essential** (checked after generation). research/02 is right; research/01 §4.1 ("flag 4 = ALWAYS") is wrong.

**C16 — small facts.** Max population 300 per planet; Stargate cost 3000 BC, upkeep 100 BC per gate per turn; fleet speed = min over its ship types of (engine index + 1); transports move at the empire's have_engine value;
the fork's default max factories is 2500 (open question 9).

## 3. Applied in the repo (all `node tools/rules-test.js` areas green)

1. `js/sim/research.js` `Rs.start`: replacing a project under way zeroes the pile (same project = no-op); `Rs.aiFirst` (new: uniform tier-1 pick, cost L²×50); `Rs.setSlider` = greedy group rule (C11); `Rs.recompute` Silicoid overrides (C5).
2. `js/data/techs.js`: PL 30 no longer sets `soil` (C5); comments updated.
3. `js/sim/setup.js`: AI crowded count includes the home planet (C12), first projects via `Rs.aiFirst`.
4. `js/sim/turn.js`: next project chosen/prompted in the SAME turn a project completes (`invest > 0`, completion leaves 1) (row 42); explore step handles fleets in empire-index order and
   artifact loot is paid only when NO empire had explored the star before (C14).
5. `js/sim/vis.js`: fleet/transport detection radii (C6).
6. Tests: `tools/rules/22-research-rules.test.js` (new, 8 tests, each mutation-checked against the old behaviour); `tools/rules/20-techs.test.js` updated (soil flag, greedy sliders).
   Not changed (other owners): `55-ground` showed 7 failures while `js/sim/diplo.js` was being written (diplomacy incidents) — unrelated to research.

## 4. OPEN QUESTIONS

1. Which advanced techs could be researched in v1.3? `list_gamediff` says only "all Advanced Technology are available for research" (Classic+ wording) — the doc's fallback list may be broader than v1.3's.
2. Soil/adv-soil project accumulator: the source seems to leave min(accumulated, 150) in `bc_to_ecoproj` after a soil project (not 0), giving a head start to the 300 BC advanced project — one reading only; verify before copying (js/sim/colony.js resets it to 0).
3. Terraform increments: when the purchase is not capped by N + max_pop2 the source appears to zero the remaining ecology BC (remainder < cost/pop is lost) and applies the 300 cap afterwards — one reading; colony.js keeps the remainder for population growth.
4. After a human's project completes the stale `cost[]` is not cleared; only matters if a human is allowed to leave a field without a project (their pile then grows without the 10 % decay).
5. Which race the tribute ×2 tests (giver vs AI) — read as the giving player's race Human; confirm.
6. Combat Transporters and the ground tie are v1.3 bugs vs documented intent (C3, C4); the remake needs a deliberate choice per toggle.
7. Tier values / groups / names / descriptions (rows 58, 68, 79, 88) cannot be proven from C source; Appendix D stays inferred.
8. Spy catch thresholds (C8) and the empire-contact rule (C6) come from a single reading of one function each.
9. Max factories per planet: the fork's default is 2500, js/sim/colony.js and Data.Config use 2700 (the doc mentions both); decide which one is the shipped v1.3 value.
