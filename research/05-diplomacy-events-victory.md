# MOO1 research slice 05 - Diplomacy, Espionage, Galactic Council, Random Events, Orion/Guardian, Victory, Difficulty, AI, GNN

Scope: Master of Orion (1993, MicroProse/SimTex) v1.3 DOS. NOT MOO2, NOT the 2016 remake.
Everything below is meant to be implementation-ready. Numbers are exact unless flagged.

### Executive summary (the 20 facts that matter most)

1. **Relations** are a symmetric integer `rel1` in -100..+100 per empire pair (17 labels, 12 DP each, FEUD .. HARMONY), starting at `12 * race-matrix` (everybody +12 toward Humans; Mrrshan/Alkari -36, Mrrshan/Sakkra -24, Darlok -12 with all but Humans) and drifting 0/1 per turn toward a base `rel2`. Beside it each pair has `trust` and four temporary "moods" (treaty/trade/exchange/peace) that recover toward **+100** by +10/turn.
2. **Every AI answer** is `v = mood + trust + rel1 + (50 if the human's race is Human) + reldiff[AI personality] + d100 - threshold` with thresholds NAP 50 (needs rel1 > 10), Alliance 125 (needs rel1 > 50), Peace 60, Trade 50, ask-war `150 + AI's rel with target`, ask-break `175 + ...`; v >= 0 accept, -50..-1 counter (asks BC), -75..-51 counter (asks a tech), < -75 refuse. Every audience action burns 10 on all four moods plus 20-50 on its own topic; `reldiff` = Xenophobic -50, Ruthless -30, Aggressive -20, Erratic 0, Honorable +10, Pacifistic +20.
3. **DP changes** go through one function (halved/doubled by current relation, x2 if the actor is Human-race and positive, Honorable AI x2 on losses, Xenophobic x1.5 losses / x0.75 gains). Council vote +24/-12/-6, genocide -36, bio -10, capture planet -(50..100) + war, spies caught -5d12 etc.
4. **AI initiative** toward the human is rare (~0.5% per turn per AI unless you earned DP that turn); AIs declare war on you via: rel <= -95; rel < -30 pile-on (Average+, fewer than `difficulty` current wars); fleet/production "envy" rolls (1/20 per turn, v < -150); Erratic (`difficulty/300`/turn); alliance chains; assassination event. They break NAP/alliance only at Average+.
5. **Treaty effects**: alliance = no combat anywhere, shared fuel ranges, AI allies auto-join wars; NAP = no combat except at the partner's own planets; peace = treaty None + 8..13-turn ceasefire; trade = BC/turn up to 25% of the smaller empire's production, efficiency starts at -30% (Humans -5%) and grows toward 100% (Humans 125%).
6. **Espionage**: per-target spy budget 0-10% and global security 0-20% of production; spy costs `2*computer level + 25` BC (Darlok half), doubling within a turn; per turn each spy rolls d100 + security/5 + computer diff (caught > 70, stopped > 50, confess > 99) then the group infiltrates on d100 + edge > 84; espionage steals a tech up to a random level cap, sabotage destroys `rnd(5) x weapons/10` factories/bases or incites revolt.
7. **Galactic Council**: first meeting the first turn >= 2/3 of the stars are colonised (3+ empires alive), then whenever `year % 25 == 0`; votes = ceil(non-rebel pop/100) per empire; the top two empires are candidates; winner needs `((total+1)*2)/3`; accept -> WON_GOOD (you) / LOST_EXILE (AI); defy -> **Final War** (everybody else allied against you, all techs shared, no diplomacy).
8. **Random events**: every turn `P = (turns since last event [start: year 40]) x (1/2, 2/3, 3/4, 4/5, 1 by difficulty) / 512`; 16 event types, each at most once per game; victim chosen by planet count (human x5); average wait 28-40 turns. No Antarans, no natives in MOO1.
9. **Monsters**: Crystal (3000-7000 HP) and Amoeba (1000-5000 HP) only after year 200, one at a time, warp-1 speed, each destroys up to 5 colonies; **Guardian of Orion** (2000-10000 HP, scatter packs/death ray/stellar converters/plasma torpedoes) holds a random Terran 120-pop 4x-research world; killing it gives the Death Ray + up to 3 random techs (levels 20-50).
10. **Endings**: WON_GOOD (council), WON_TYRANT (last empire standing), LOST_EXILE (accepted AI win), LOST_FUNERAL (no non-rebel planets / coup). There is **no score**; only the Racial Stats bars.
11. **Difficulty** changes: AI production x1.0/0.8/1.25/1.5/2.0 (v1.3 code; [Guide] says 0.8/0.9/1/1.25/1.5), human tech cost multiplier 20/25/30/35/40 (AI fixed 20), AI missile-base cost 100/90/80/70/50%, event frequency and event/monster strength, home start pop 50 (Simple-Average) / 40 (Hard-Impossible), AI aggressiveness knobs (4.6.5, 9.1).
12. **AI turn**: planners p1 (every turn: scouts, magic colony ships, attack/defend/idle fleets, transports), p2 (every 9-20 turns: designs, build orders), p3 (every 2-6 turns: sliders; every 10 years: tech slider focus), tax/security/spy settings.
13. **GNN**: 22 news types (plague, quake, nova, accident, assassin, virus, comet, pirates, derelict, rebellion, crystal, amoeba, enviro, rich, donation, poor, Orion, coup, stars report, rankings, genocide, Guardian) with human/AI and progress subtypes; end-of-turn order in 11.3.

---------------------------------------------------------------------------------------------------

## 0. Sources, conventions, how to read conflicts

Source tags used throughout:

* **[1oom]** = the open-source 1oom engine (github.com/1oom-fork/1oom, `src/game/*.c`, `src/ui/classic/*.c`, `doc/*.txt`). It is a reverse-engineered, bug-compatible reimplementation of the **v1.3** DOS executable (the AI called "Classic"; a variant "Classic+" fixes some bugs). **This is the primary authority for what the shipped game actually does.** I read the files through a summarising fetcher and re-verified the central formulas by quoting the C source line by line (checked: `game_diplo_act`, `aud_check_mood`, `aud_start_human`, `vote_w/like/hate`, `game_event_new` reject list + chance, `wage_war_*`, `spy_esp_sub1`, `turn_diplo_p2_sub1` thresholds, `game_update_production` difficulty switch, `game_get_base_cost`, `ai_p3_tbl_w`).
* **[Guide]** = *Master of Orion: The Official Strategy Guide* (Alan Emrich & Tom Hughes, Prima 1994), OCR text on archive.org. It documents the designers' intent / probably an earlier version (v1.2?). Numbers frequently differ from the v1.3 code. Used for cross-checking, for race/ending flavour and for things the code does not show.
* **[LP]** = Let's Play archive (lparchive.org/Master-of-Orion) - anecdotal confirmation only.
* **(conflict: ...)** marks places where [1oom] and [Guide] (or other sources) disagree. **Default recommendation: follow [1oom]** if you want the shipped v1.3 behaviour, follow [Guide] only if you prefer the documented design.
* **(unverified)** = could not be confirmed.
* **(BUG)** = original v1.3 quirk that 1oom preserves in "Classic" mode. An implementer may reproduce or "fix" it; each is listed so the choice is conscious.

Notation used in pseudo-code:

* `rnd(n)` = uniform integer 1..n ; `rnd0(n)` = uniform integer 0..n-1. `/` is C integer division (truncates toward zero). `min/max/clamp` as usual. `ADDSAT(x,v,cap)` = x = min(x+v, cap).
* `H` = the human player, `A` = an AI empire. "year" = internal turn counter, **starts at 1**; displayed year = year + 2299 (turn 1 = 2300).
* Pair arrays: `X.rel1[Y]` means "field `rel1` in empire X's record, indexed by Y". For AI<->human logic the engine always reads the **human's** record (`H.rel1[A]`, `H.trust[A]`, `H.mood_*[A]`) and mirrors `rel1` and the `mood_*` fields to the AI's record whenever `game_diplo_act` runs.
* Version fact: 1oom "Classic" == MOO1 v1.3. 1oom's optional bug-fix switches (`doc/pbxin_fixbugs.txt`, `doc/list_pbxnum.txt`) are cited where they reveal original bugs.

---------------------------------------------------------------------------------------------------

## 1. Enumerations and global constants (needed everywhere below)

| Enum | Values (index order) |
|---|---|
| Race | 0 Human, 1 Mrrshan, 2 Silicoid, 3 Sakkra, 4 Psilon, 5 Alkari, 6 Klackon, 7 Bulrathi, 8 Meklar, 9 Darlok |
| Banner (colour) | 0 Blue, 1 Green, 2 Purple, 3 Red, 4 White, 5 Yellow |
| Difficulty | 0 Simple, 1 Easy, 2 Average, 3 Hard, 4 Impossible |
| Treaty state | 0 None ("No Treaty"), 1 Non-Aggression Pact, 2 Alliance, 3 War, 4 Final War |
| Spy mode | 0 Hide, 1 Espionage, 2 Sabotage |
| trait1 (leader personality) | 0 Xenophobic, 1 Ruthless, 2 Aggressive, 3 Erratic, 4 Honorable, 5 Pacifistic |
| trait2 (leader objective) | 0 Diplomat, 1 Militarist, 2 Expansionist, 3 Technologist, 4 Industrialist, 5 Ecologist |
| Tech field | 0 Computer, 1 Construction, 2 Force Field, 3 Planetology, 4 Propulsion, 5 Weapon |
| Galaxy size (stars = w*h) | Small 6x4=24, Medium 8x6=48, Large 10x7=70, Huge 12x9=108 |
| Game-end type | 0 none, 1 LOST_EXILE, 2 WON_GOOD, 3 FINAL_WAR (continuing state), 4 WON_TYRANT, 5 LOST_FUNERAL, 6 QUIT |
| Random event id | 1 Plague, 2 Quake, 3 Nova, 4 Accident, 5 Assassin, 6 Virus, 7 Comet, 8 Pirates, 9 Derelict, 10 Rebellion, 11 Crystal, 12 Amoeba, 13 Enviro (fertile), 14 Rich, 15 Support (donation), 16 Poor |
| Monster id | 0 Crystal, 1 Amoeba, 2 Guardian |
| Planet special | 0 Ultra-poor, 1 Poor, 2 Normal, 3 Artifacts, 4 Rich, 5 Ultra-rich, 6 "4x tech" (Orion only) |
| Max players | 6 (PLAYER_NUM = 6; "One..Five" opponents) |

Other constants: hull weight table `hull_w[4] = {1, 5, 25, 125}` (small, medium, large, huge) is used for all "fleet power" comparisons; `YEAR_BASE = 2299`; `council_years = 25`; `event_roll = 512`; `max_tribute_bc = 32000`; `bt_turn_max = 50` battle turns; `TECH_SPY_MAX = 6` (max techs listed in a spy/trade list).

---------------------------------------------------------------------------------------------------

## 2. Per-pair diplomatic state (the variables the AI reasons with)

All `int16` unless noted. Index `[Y]` = the other empire. (`H` record is the authoritative one for AI-vs-human decisions.)

| Field | Meaning / range / how it changes |
|---|---|
| `rel1[Y]` ("relation1", the **love meter / Relations bar**) | -100..+100. Symmetric: after every change `X.rel1[Y] = Y.rel1[X]`. Changed only through `game_diplo_act` (section 4.2), tribute, wars, treaty events. Initial value = `tbl_orion_race_relation[raceX][raceY] * 12` (section 3.3). |
| `rel2[Y]` ("relation2", the **base / natural level**) | Starts equal to initial `rel1`. `rel1` drifts toward `rel2` by 0 or 1 per turn (section 4.3 block D). `rel2` -= 5 for both sides at every new war; alliance-breaking changes it (BUG sign, see 4.2.2). |
| `trust[Y]` | Permanent "Core reaction" modifier. +3..+10 per tech tribute (cap +30); treaty-breaking changes it by 10 (NAP) / 20 (alliance) (x2 if the breaker is Honorable) - **sign is a BUG in Classic (it adds, see 4.2.2)**. |
| `mood_treaty[Y]`, `mood_trade[Y]`, `mood_tech[Y]`, `mood_peace[Y]` | The four **temporary modifiers** ("Treaty / Trade / Exchange / Peace"; the [Guide]'s fifth one, "Diplomat Gone", is simply `min` of the four). Integer, clamped -200..120 (`mood_treaty` clamp applied at turn start/audience start, `mood_peace` clamp -200..200 each turn). `game_diplo_act` adds its `dv` to the **AI's** copy and then copies that value onto the human's copy, whereas audience rolls and `annoy()` only change the **human's** copy - so a mood penalty stored on the human's record is overwritten by the AI's (undisturbed) copy the next time any DP-changing incident between the pair runs (a council vote, a combat incident, a caught spy, ...). **Relax toward +100** (+10/turn when <100, and an extra +rnd(5)+... when <50; see 4.3) (conflict: [Guide] says they recover toward 0). |
| `hatred[Y]` | 0 = AI has not complained yet; >0 = number of warnings given (1 = first warning). Reset to 0 on a "forgive" roll (4.6). |
| `blunder[Y]` | Remembered offence type (4..11 or 12..19) the AI will bring up in later refusals (4.8). |
| `broken_treaty[Y]` | The treaty type (NAP/Alliance/None-with-trade) the other side broke, remembered for refusal messages. |
| `diplo_type[Y]`, `diplo_val[Y]`, `diplo_p1[Y]` (planet), `diplo_p2[Y]` (field/third player/flag) | The **message queued for this turn** (see message catalogue 4.8) and the biggest-magnitude DP change recorded this turn (`diplo_val`). Reset to 0 every turn at start of turn. |
| `treaty[Y]` | Treaty state (symmetric). |
| `trade_bc[Y]` (uint16), `trade_percent[Y]` (int16), `trade_established_bc[Y]` | Agreed trade volume (BC/turn, multiples of 25), current efficiency %, and ramp value. |
| `attack_bounty[Y]`, `bounty_collect[Y]`, `attack_gift_{field,tech,bc}[Y]` | AI "reward for attacking X" offer state (4.6.2 stage D). |
| `offer_{bc,field,tech}[Y]`, `au_want_*`, `au_tech_trade_*`, `au_ask_break_treaty[Y]`, `au_ally_attacker[Y]` | Scratch for AI proposals (sweeteners, requested tech, tech-swap list, "break alliance with X", "join war against X"). |
| `have_met[Y]` | 0 not met; 1 just met (first-contact audience pending); 2 met. |
| `contact[Y]` (bit) / `contact_broken[Y]` | Diplomatic contact (4.1). |
| `evn.ceasefire[H][A]` | Turns of enforced peace after a peace treaty/cower (4.5). |
| `spying[Y]` (0..100 = 0.0%..10.0% of gross production in tenths of %), `spyfund[Y]`, `spies[Y]`, `spymode[Y]`; `security` (0..200 = 0..20% in tenths of %) | Espionage state (section 5). |
| `evn.voted[X]` | Whom X voted for at the previous Galactic Council (PLAYER_NONE if abstained/never) (section 6). |

---------------------------------------------------------------------------------------------------

## 3. Race tables, personality (trait1) and objective (trait2)

### 3.1 trait1 effects (what the leader personality does mechanically) [1oom]

`reldiff[trait1]` is added to the AI's willingness in almost every roll (acceptance checks, asking checks, war checks, "gone" checks):

| trait1 | reldiff | Other mechanical effects |
|---|---|---|
| Xenophobic | -50 | DP losses suffered by this AI x3/2 (negative dv = dv*3/2); DP gains x3/4. Never adds a sweetener to its own proposals (stage G of 4.6.2). |
| Ruthless | -30 | Never adds a sweetener to its own proposals (stage G of 4.6.2). |
| Aggressive | -20 | - |
| Erratic | 0 | Each turn, per human/AI target: `rnd(300) <= difficulty` -> declares war (dtype 61). (Simple never, Easy 1/300 ... Impossible 4/300 per turn.) ((conflict) [Guide]: 2%/turn.) |
| Honorable | +10 | DP losses suffered x2; when **this empire breaks a treaty** its trust penalty is doubled; never starts the "fleet envy" war check (4.6.5, 2a); also the *human's own random trait1* matters for oath-breaking (the human also gets a random trait1 from its race table). |
| Pacifistic | +20 | - |

[Guide] "Table 11-4" personality modifiers: Pacifist +20, Honorable +10, Erratic -40..+40 (re-rolled each turn), Aggressive -10, Ruthless -30, Xenophobic -50 (conflict: v1.3 code uses -20 for Aggressive, 0 for Erratic and has no per-turn re-roll). [Guide] also states: Honorable "oath-breaker penalty doubled"; Xenophobic "halves DP gains and doubles DP losses (quadrupled above +50)"; attack-check chance per turn = 50% + reverse of modifier (Pacifist 30%, Honorable 40%, Aggressive 60%, Ruthless 80%, Xenophobic 100%, Erratic 10-90%); Pacifists never use bio-weapons, all others do (not found in the v1.3 AI code - treat as flavour).

### 3.2 Starting personality / objective distributions per race [1oom `game_num_tbl_trait1/2`]

At game creation each empire (AI **and human**) draws trait1 with `table1[race][rnd0(10)]` and each AI draws trait2 with `table2[race][rnd0(12)]` (a leader coup later re-rolls both uniformly: `trait2 = rnd0(6)`, `trait1 = rnd0(6)`). Counts below are entries out of 10 (trait1) / out of 12 (trait2):

| Race | trait1 table (of 10) | trait2 table (of 12) |
|---|---|---|
| Human | Honorable 7, Pacifistic 2, Erratic 1 | Diplomat 5, Militarist 1, Expansionist 1, Technologist 2, Industrialist 2, Ecologist 1 |
| Mrrshan | Ruthless 7, Aggressive 2, Xenophobic 1 | Diplomat 1, Militarist 4, Expansionist 2, Technologist 3, Industrialist 1, Ecologist 1 |
| Silicoid | Xenophobic 7, Aggressive 2, Erratic 1 | Diplomat 1, Militarist 1, Expansionist 4, Technologist 3, Industrialist 2, Ecologist 1 |
| Sakkra | Aggressive 7, Erratic 2, Ruthless 1 | Diplomat 1, Militarist 1, Expansionist 5, Technologist 2, Industrialist 1, Ecologist 2 |
| Psilon | Pacifistic 7, Honorable 1, Erratic 2 | Diplomat 2, Militarist 1, Expansionist 1, Technologist 5, Industrialist 2, Ecologist 1 |
| Alkari | Honorable 7, Pacifistic 2, Erratic 1 | Diplomat 1, Militarist 3, Expansionist 4, Technologist 2, Industrialist 1, Ecologist 1 |
| Klackon | Xenophobic 7, Aggressive 2, Ruthless 1 | Diplomat 1, Militarist 2, Expansionist 2, Technologist 2, Industrialist 1, Ecologist 4 |
| Bulrathi | Aggressive 7, Erratic 2, Ruthless 1 | Diplomat 1, Militarist 0, Expansionist 2, Technologist 3, Industrialist 1, Ecologist 5 |
| Meklar | Erratic 7, Aggressive 2, Xenophobic 1 | Diplomat 1, Militarist 1, Expansionist 2, Technologist 3, Industrialist 4, Ecologist 1 |
| Darlok | Aggressive 7, Ruthless 2, Xenophobic 1 | Diplomat 3, Militarist 1, Expansionist 1, Technologist 4, Industrialist 2, Ecologist 1 |

(conflict: [Guide] chapter 13 gives 60% / 20% / 20% leader splits and a "50% main objective" for each race: Alkari 60 Honorable/20 Pacifist/20 Erratic, 50% Militarist; Bulrathi 60 Aggressive/20 Ruthless/20 Erratic, 50% Ecologist; Darlok 60 Aggressive/20 Ruthless/20 Erratic, 50% Diplomat; Human 60 Honorable/20 Pacifist/20 Erratic, 50% Diplomat; Klackon 60 Xenophobic/20 Ruthless/20 Aggressive, 50% Industrialist; Meklar 60 Erratic/20 Honorable/20 Ruthless, 50% Industrialist; Mrrshan 60 Ruthless/20 Aggressive/20 Xenophobic, 50% Militarist; Psilon 60 Pacifist/20 Honorable/20 Erratic, 50% Technologist; Sakkra 60 Aggressive/20 Ruthless/20 Erratic, 50% Expansionist; Silicoid 60 Xenophobic/20 Ruthless/20 Aggressive, 50% Expansionist. The dominant trait1 agrees with the code tables for every race; the plurality trait2 agrees for Human, Mrrshan, Psilon, Sakkra, Silicoid, Bulrathi and Meklar but NOT for Alkari (code: Expansionist 4 > Militarist 3), Klackon (code: Ecologist 4; Industrialist only 1) and Darlok (code: Technologist 4 > Diplomat 3); the secondary leader traits also differ. The code tables are the shipped data; the [Guide] percentages look like rounded approximations.)

### 3.3 Initial relations matrix (v1.3 data, [1oom] `tbl_orion_race_relation`) and base-level labels

`rel1 = rel2 = value * 12` at game start (row = race of the empire whose record it is, column = the other race; table is symmetric except where noted):

|        | Hu | Mr | Si | Sa | Ps | Al | Kl | Bu | Me | Da |
|---|---|---|---|---|---|---|---|---|---|---|
| Human   | 0 | +1 | +1 | +1 | +1 | +1 | +1 | +1 | +1 | +1 |
| Mrrshan | +1 | 0 | 0 | -2 | 0 | -3 | -1 | -1 | 0 | -1 |
| Silicoid| +1 | 0 | 0 | 0 | 0 | 0 | -1 | 0 | +1 | -1 |
| Sakkra  | +1 | -2 | 0 | 0 | 0 | -1 | -1 | 0 | -1 | -1 |
| Psilon  | +1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | -1 |
| Alkari  | +1 | -3 | 0 | -1 | 0 | 0 | -1 | 0 | 0 | -1 |
| Klackon | +1 | -1 | -1 | -1 | 0 | -1 | 0 | 0 | 0 | -1 |
| Bulrathi| +1 | -1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | -1 |
| Meklar  | +1 | 0 | +1 | -1 | 0 | 0 | 0 | 0 | 0 | -1 |
| Darlok  | +1 | -1 | -1 | -1 | -1 | -1 | -1 | -1 | -1 | +1 |

i.e. starting relations are +12 (everybody likes Humans), -12 ("-1"), -24, -36 ("loathes": Mrrshan<->Alkari -36, Mrrshan<->Sakkra -24) or 0. Darloks start -12 with everyone but Humans. (The [Guide]'s Table 11-3 shows the same data as band-edge labels: Humans +7 with everyone, Mrrshan/Alkari -31, Mrrshan/Sakkra -19, Darlok -7; it additionally lists Silicoid<->Klackon as +7 whereas the code has -1 (=-12) for both cells - (conflict: one cell pair).)

### 3.4 Relation labels (Races screen "love nub")

17 labels, 12 DP per step. [1oom] UI: `label_index = clamp(rel1/12 + 8, 0, 16)` ->
`0 FEUD, 1 HATE, 2 DISCORD, 3 TROUBLED, 4 TENSE, 5 RESTLESS, 6 WARY, 7 UNEASE, 8 NEUTRAL, 9 RELAXED, 10 AMIABLE, 11 CALM, 12 AFFABLE, 13 PEACEFUL, 14 FRIENDLY, 15 UNITY, 16 HARMONY`. Pointer x = centre + clamp(rel1/2, -50, 50) pixels.
[Guide] band edges (Table 11-1): Harmony +91..+100, Unity +79..+90, Friendly +67..+78, Peaceful +55..+66, Affable +43..+54, Calm +31..+42, Amiable +19..+30, Relaxed +7..+18, Neutral -6..+6, Unease -7..-18, Wary -19..-30, Restless -31..-42, Tense -43..-54, Troubled -55..-66, Discord -67..-78, Hate -79..-90, Feud -91..-100 (differs from the code's truncating `/12` by an offset of 6; cosmetic).
Treaty labels shown on the Races screen: "No Treaty", "Non-Aggression Pact", "Alliance", "War", "Final War"; the trade line shows "Trade: N BC/year" or "No Trade".

### 3.5 Where the objective (trait2) and the race are read by the AI [1oom]

| Mechanism | trait2 / race effect |
|---|---|
| War check "fleet envy" (4.6.5-2a) | only Militarist and Expansionist (and never if trait1 is Honorable) |
| Treaty cancel rolls (`war_do`, `send_attack`) | Expansionist: always passes the NAP roll, adds a second chance for alliances |
| Colony ships (`turn_p1`) | non-Expansionists hold colony ships back if a human is in contact and more than half their planets are still developing |
| Planet sliders and tech-sector weights (10.3) | per-objective weight row, War row when at war with anyone |
| Race-specific slider biases / tech focus / hull size / battle weights | 10.3, 10.6, 10.7, 12.2 |
| Not used | Diplomat/Technologist/Ecologist have no direct diplomatic effect in the v1.3 code; [Guide] lists spy base ratings by objective (Diplomat/Technologist 40, Industrialist/Militarist 30, Ecologist/Expansionist 20, any at war 40, Psilon +10, Darlok +30) and "Diplomat gets +50 on trade decisions" (not found in code: trade asks simply use a d150 roll instead of d100 for every AI) |

---------------------------------------------------------------------------------------------------

## 4. DIPLOMACY

### 4.1 Contact, first contact, "Diplomat gone"

* **Contact** is recomputed every turn: for every pair X,Y: `frange = max(X.fuel_range, Y.fuel_range)` (ship range = best Fuel Cell level among the two); contact iff the minimum distance between any star owned by X and any star owned by Y is `<= frange`. Contact is symmetric. [1oom `game_update_empire_contact`]; [Guide] confirms ("either player's fuel cell").
* **First contact with a human**: the turn it is established `have_met = 1`, treaty = None. In that turn's diplomacy phase the AI opens an audience with message type `14 + AI.trait1` (one greeting per personality: Xenophobic 14, Ruthless 15, Aggressive 16, Erratic 17, Honorable 18, Pacifistic 19), then `have_met = 2`.
* **Contact lost** (planets taken/range shrinks): trade (`trade_bc`, `trade_percent`, `mood_trade`) is zeroed for both sides, spies on both sides are switched to Hide, and a "contact lost" notice is shown in the diplomacy phase. [1oom] shows no code that cancels treaties here, [Guide] says all treaties end without oath-breaker penalty (unverified in code).
* **Diplomat gone** (AI refuses to talk at all): AI is "gone" for the Races screen when `trust + min(mood_*) + reldiff[AI.trait1] <= -100` or `min(mood_*) <= -100`. Opening an audience: `v = trust + min(mood) + reldiff[AI.trait1]`; if `v < -100` the AI says a single refusal message (type 20 if at war, 21 otherwise) and nothing else can be done; else `v += rel1`: greeting type 22 (friendly, `v > -50`) or 23 (cool) and the menu opens. Additionally, before showing the menu: if `min(mood) < -100` the AI says "later" (type 74) and the audience ends.
* There is no diplomacy at all once the game is in the FINAL WAR state (Audience button disabled) or with eliminated empires.

### 4.2 The DP (relation) engine

#### 4.2.1 `diplo_act(dv, actor, target, dtype, p1, p2)` [1oom `game_diplo_act`]

```
if end == FINAL_WAR: (special: hostile AI toward human refusers may record message 59) return
if actor==target or dv==0 or target is HUMAN or treaty==FINAL_WAR: return      # only AI targets are affected
if dv == -10000: (forced event marker, e.g. war declaration): if actor is human and dtype!=0:
        record diplo_val=10000, diplo_type=dtype ; return
R = target.rel1[actor]
# 1. attenuation by current relation
if dv > 0:
    if R < 0:  dv *= 2 ; if R+dv > 10: dv = 10 - R        # repairing a bad relation: x2 but never beyond +10
    else:      dv /= (R/25 + 1)                            # R 0-24: /1, 25-49: /2, 50-74: /3, 75-99: /4, 100: /5
else:
    if R > 0:  dv *= 2                                      # good relations are fragile
    else:      dv /= (-R/25 + 1)                            # hated: /1../5
# 2. target personality
if target.trait1==Honorable and dv<0: dv *= 2
if target.trait1==Xenophobic: dv<0 -> dv = dv*3/2 ; dv>0 -> dv = dv*3/4
v1 = dv
if actor.race == Human and dv>0: dv *= 2                    # "Humans double positive DP"
# 3. at war, "incident" types 4..12 do not move the relation
if treaty==WAR and 4<=dtype<=12 and dv<0:
    if actor is human: target.mood_peace[actor] += dv/4 ; actor.mood_peace[target] -= dv/4
    dv = 0
# 4. AI-vs-AI after year 100
if both AI and year>100: if dv>0: dv*=2 ; if dv<0: dv /= (difficulty/2 + 1)
if dv != 0:
    R = clamp(R+dv,-100,100)
    target.mood_treaty[actor] += dv ; actor.mood_treaty[target] = target.mood_treaty[actor]     # same for mood_trade, mood_tech
    if v1 < 0: actor.mood_peace[target] -= v1/4 ; target.mood_peace[actor] += v1/4
    else:      target.mood_peace[actor] += v1
    if actor is human and dtype != 0 and |dv| > |actor.diplo_val[target]|:
        actor.diplo_val/type/p1/p2[target] = dv, dtype, p1, p2          # "largest offence/gift of this turn" -> drives AI reaction 4.6
# 5. hard limits, applied after every call
if treaty >= WAR:       R = max(R, -25)            # at war the bar is never below -25 after any DP event
if treaty != ALLIANCE:  R = min(R, 65)             # only allies can be above +65
actor.rel1[target] = target.rel1[actor] = R
```
Notes: a human actor's **positive** acts are doubled if the *human's race is Human* (and halved/attenuated by relation as above); personality of the **target AI** scales how it reacts. [Guide] describes the same idea with different breakpoints ("Table 11-2": gains full below +33, 2/3 to +66, 1/3 to +99; losses 1/3 below -67, 2/3 to -34, full to +50, double above +51; Xenophobic halves gains and doubles losses (x4 above +50); Honorable doubles losses) (conflict: v1.3 uses the /(|R|/25+1) ladder shown above).

#### 4.2.2 Treaty/war primitives [1oom `game_diplo.c`]

```
break_treaty(breaker B, victim V):
    if V.treaty[B] >= WAR: return
    w = 0 ; if B.treaty[V]==NAP: w = -10 ; if ALLIANCE: w = -20       # BUG sign: in Classic w stays negative
    (non-classic AI: w = -w)
    if B.trait1==Honorable: w *= 2
    B.trust[V] -= w                                                    # Classic: trust RISES by 10/20 (x2 honorable)  (BUG; intended: falls)
    if B.treaty[V]==ALLIANCE: B.rel2[V] = V.rel2[B] = max(rel2 - w, -100)   # same sign BUG
    if w != 0:
        B.broken_treaty[V] = V.broken_treaty[B] = old treaty (classic)
        R = max(B.rel1[V] - rnd(20), -100) ; B.rel1[V] = V.rel1[B] = R  # random drop 1..20
    treaty = None for both ; attack_bounty cleared
    all four moods of both sides := -200     # "oath breaker": nobody wants to talk for several turns
start_war(A, B):                       # A declares on B
    break_trade(A,B) ; break_treaty(A,B)
    A.rel2[B] -= 5 ; B.rel2[A] -= 5
    rel1 = -75 - rnd(25)               (both sides)
    treaty = WAR (both)
    mood_treaty/trade/tech = -200 ; mood_peace = -130 (both sides)
break_trade(A,B): trade_bc, trade_established_bc, trade_percent := 0 ; attack_bounty cleared ; (no DP change by itself)
stop_war(A,B) (peace treaty/cower): treaty = None ; rel1 = min(rel1 + 40, 100) ;
    for each HUMAN side: ceasefire[H][A] = rnd0(6) + 8           # 8..13 turns
annoy(H, A, n): all four moods[H][A] -= 10*n
```
The intended effect of oath-breaking is a permanent -5 (-10 Honorable) hit to the victim's "Core Reaction" plus an immediate three-level (-36 DP) drop ([Guide]); the Classic code instead gives a random -1..-20 DP drop, sets all moods to -200 and records `broken_treaty` (the AI will refuse later requests with "you broke a treaty" speeches). Implementer choice: apply `trust -= 10/20` as intended, or keep the bug.

#### 4.2.3 Where DP changes come from (incident catalogue)

All go through `diplo_act` (so section 4.2.1 scaling applies). `dtype` = the message category stored for the AI's later complaint/thanks (catalogue in 4.8).

| Trigger | dv (before scaling) | dtype |
|---|---|---|
| Each turn, per pair with a **NAP**, 50% chance | `+rnd(3)` | 0 (silent) |
| Each turn, per pair with an **Alliance**, 50% chance | `+rnd(6)` | 0 |
| Each turn, per pair with **trade**, 50% chance | `+rnd(3)` | 2 (thanks for trade) |
| AI-vs-AI "pleasantries": inside the gated AI-AI interaction of 4.7 (prob `1/(15-2d)` per pair-turn), with prob 1/20 | `+rnd(5)` | 1 |
| Your fleet bigger than an AI's, per (AI,human) pair per turn: condition `S_ai < S_h`, `S_ai>0`, `rnd(100) >= S_h*50/S_ai`, then 1/20 (S = fleet stat 0..100 from the Racial Stats formula, section 8.3) | `-10` (actor = human) | 8 (border build-up) |
| Human controls many large producers: on even years, `n_pp` = planets with `prod_after_maint >= 100`, `gscale = (galaxy_size+1)*3` (Small 3, Medium 6, Large 9, Huge 12), if `n_pp > gscale` and 1/4: `v = rnd(4) * (-(n_pp-gscale)/gdiv)`, `gdiv = galaxy_size + 6 - difficulty`, then `v = v/3*4`, halved for a human; applied from that empire to each of its **AI allies** in contact | `v` (negative) | 12 |
| Combat at a planet, see below | `-offense` | 9 / 10 / 11 |
| Bio-weapon used (any combat with bio damage): every AI other than the attacker | `-10` | 11 |
| Ground invasion captures an AI planet (human attacker) | `-(50 + rnd(50))`, and the AI declares war immediately | 13 |
| Ground combat kills pop but planet not taken (human attacker) | `-(rnd(5)+5) * pop_killed` | 10 |
| AI attacker vs AI defender ground combat | `-(rnd(4)+4)` (1 pop assumed, BUG) | 10 |
| Genocide (an empire is wiped out; killer = last empire with ships/planets at its former planets) | `-36` for every other empire, from the killer | 0 |
| Council vote | `+24` vs candidate voted for, `-12` vs the other, `-6` vs both if abstain | 0 (80/79 if the human voter is not a candidate) |
| Spy **identified** (human spy, not framing) | `-(5d12)` (5..60) | 4 (theft) |
| Sabotage identified (AI spy) | `-(rnd(20)+20)` | 6 |
| Spy **framing** a third race (theft) | `-(rnd(12)+rnd(12))` | 5 |
| Spy framing (sabotage) | `-(rnd(16)+rnd(16))` | 7 |
| AI-vs-AI espionage where the thief's infiltration roll exceeds 100 ("frame" roll): with 50% a random human who has contact with the victim is blamed | `-(rnd(20)+20)` (human vs victim AI) | 5 |
| Tech tribute / BC tribute | see 4.4.6 (direct relation edits, not `diplo_act`) | - |
| Assassination event | war declared by the assassin's race, `diplo_val=100`, rel1 = -75..-100 | 13 |

Combat consequence formula [1oom `game_diplo_battle_finish`] (called after every battle/bombardment where one side is an AI):
```
offended = claimant (owner / orbit holder) of the planet if it is one of the two combatants, else the AI combatant ; offender = the other combatant
pop_lost = population destroyed on the planet this battle ; app = apparent force the offended side lost (sum of (hull+1)*ships), capped 50 ; bio = biodamage
offense = max(5*pop_lost, min(app, 50), 10*bio)
if offended is AI: diplo_act(-offense, offender, offended, dtype = 11 if bio>0 else 10 if pop_lost>0 else 9, planet)
if bio != 0:       for every AI i != offender: diplo_act(-10, offender, i, 11)
if offense >= 30 and offender is human:                    # "enemy of my enemy"
    for each other AI i with offended.treaty[i] >= War or a bounty claim on `offended`:
        if offender.attack_bounty[i] == offended: offender.bounty_collect[i] = i      # reward earned -> AI i queues message 58 next turn
        elif offended owns no planet: diplo_act(+offense, offender, i, 3, planet)      # (as coded this bonus fires only then - probably a bug; [Guide]: +1 DP per 4 points with every enemy of the victim)
```
([Guide] Table 11-6, per destroyed item: factory -1, small ship -1, medium -2, large -3, missile base -3, huge ship -4, each pop by conventional attack -5, each pop by bio attack -10; killing 10+ pop in one attack or taking/destroying a colony = automatic war; enemies of the victim get +1 DP per 4 points; bio attack -12 DP (one level) with everyone; genocide -36.) The code's "10+ pop -> war" is realised through the ground-combat rule (capture -> war, `-offense` otherwise).

### 4.3 Automatic per-turn diplomatic bookkeeping (in turn order)

1. `countdown_ceasefire`: every `ceasefire[i][j] > 0` decrements.
2. `update_mood_blunder` (start of turn): for every ordered pair i->j (j from player 1 up):
   * remember offence type: `diplo_type` 4..11 -> `blunder = type`; 42..49 -> `blunder = type-30`; 50..57 -> `blunder = type-46`.
   * unless treaty == FINAL_WAR, for each of `mood_treaty, mood_trade, mood_tech, mood_peace`: `if v<0: v += rnd(5)` ; `if v<50: v += rnd(5)` (so values below 50 climb 1-10/turn); `mood_peace` is then clamped to -200..200.
   * reset per-turn scratch: `diplo_val = diplo_type = 0` for all pairs; clear `attack_bounty/bounty_collect` if collected; `au_tech_trade_num, offer_tech, au_want_tech, offer_bc := 0`.
3. AI planning, production, **trade growth** (`update_trade`): for each pair with `trade_bc != 0`: if no contact: zero it; else `established += trade/10` (capped; effectively no-op, BUG) and `trade_percent += max(0, (rnd(200) + rel1 + 25)/60)` capped at 100, both sides.
4. `diplo_adjust` (after trade): block A (per-pair DP gains from treaties/trade, table above), block B (AI dislikes bigger human fleets), block C (alliance pressure for huge empires, even years), block D (drift): for every AI i and every j with `diplo_val[j]==0`: `v = (|rel1| > rnd(105)) ? rnd0(2) : 0`; move `rel1` by v toward `rel2` (never overshooting), clamp -100..100; block E: mirror `rel1` and force self-relation 0.
5. After AI diplomacy and audiences: `diplo_mood_relax()` (end of turn): each `mood_*` below 100 gets +10 (cap not enforced beyond 100; values above stay until they decay by being used).

### 4.4 Player-initiated audience ("Audience" button of the Races screen)

#### 4.4.1 Opening, availability

Open from the Races screen (not available when `end != NONE`, with no contact, or with a "gone" race). Greeting types: 20/21 refusal, 22 friendly, 23 cool (4.1). Main menu: `[Propose Treaty] [Form Trade Agreement] [Threaten/Break Treaty and Trade] [Offer Tribute] [Exchange Technology] [Good Bye]`.

Disabled items: at war -> Trade, Threaten/Break, Exchange Technology are greyed out. Tribute is greyed out if `H.reserve_bc < 25` **and** the human has no tech the AI lacks. Trade is greyed out if `want_trade <= 0` (see trade below). Every audience action costs patience (below).

#### 4.4.2 Core acceptance roll `check_mood(a0, kind)` [1oom `aud_check_mood`]

```
M = mood of the matching kind: 0 treaty, 1 trade, 2 peace, 3 tech (exchange)
v = M + H.trust[A] + H.rel1[A] + (H.race == Human ? 50 : 0) + reldiff[A.trait1] + rnd(100) - a0
if treaty == ALLIANCE: v += 40
annoy(H,A,1)                                   # all four moods -10
M -= {treaty: rnd(30)+20, trade: rnd(30)+20, peace: rnd(50)+50, tech: rnd(50)+20}   # extra patience cost of that topic
return  v < -75 -> 0 (flat refusal) ; v < -50 -> 1 (counter: asks a TECH) ; v < 0 -> 2 (counter: asks BC) ; else 3 (accepted)
```
* Every proposal therefore burns 10 on all four moods plus 21-50 (51-100 for peace) on its own topic; moods recover +10..+20 per turn toward +100 (4.3), so spamming proposals quickly makes the AI unwilling ("Diplomat gone" at `min(mood) <= -100`).
* The mood baseline in v1.3 is +100 (moods relax up to 100), so a calm AI answers `v = 100 + trust + rel1 + ... + rnd(100) - a0`. ((conflict) [Guide] models the temporary modifiers as starting at 0, recovering 10/turn toward 0, with a roll `Core + modifier + d100` and thresholds NAP 75/50, Alliance 125/100, Peace 0/-25, Trade 100/75, Tech exchange 100/75, Human +60. The two descriptions cannot both be exactly right; the code is the shipped logic.)
* "Counter" results: the AI invents a **sweetener demand** (`game_audience_sweeten`):
  ```
  bc  = ((rnd(8)+rnd(8)) * year / 25) * 25 ; if bc > H.reserve_bc: bc = 0          # [Guide]: two d8 x turn, rounded down to 25 BC
  tech = a random tech the human has and A lacks, value >= year, never the human's newest tech in a field (value = techlevel^2 x10 if "singular" group, x6 robotic controls, x3 waste/eco restoration; /4 if superseded, 0 if already top; Death Ray 30000)
  if result==1 (bad)  : ask tech if one exists else BC          if result==2 (mild): ask BC if bc!=0 else tech
  if neither available: refuse (0)
  text variants: "Perhaps if you were to throw in X we could deal." / "If you also offer us X we would accept."
  if the human agrees: the tech is given to A (or bc moves from H.reserve to A.reserve) and the original proposal is ACCEPTED (3); else refused (1).
  ```

Worked examples (code values, moods at their calm level +100, trust 0):
* Human-race player asks an Honorable AI (+10) with `rel1 = +20` for a NAP: `v = 100 + 20 + 50 + 10 + d100 - 50 = 130 + d100` -> always accepted.
* A Klackon player asks a Xenophobic AI (-50) with `rel1 = +60` for an alliance: `v = 100 + 60 - 50 + d100 - 125 = d100 - 15` -> accepted on d100 >= 15 (86%); a roll of 1..14 gives a counter asking BC.
* Ask again the same turn: the first check left `mood_treaty` at roughly `100 - 10 - (21..50)` = 40..69, so `v` is 31-60 points lower and acceptance needs d100 >= ~46-75; a third try is hopeless, and `min(mood) <= -100` (after ~4-5 tries) makes the AI "gone". Moods then regrow ~+10..+20/turn.
* At game start every mood is 0 and climbs +10/turn, so the first ~10 turns are the hardest time to get treaties.
* Peace (Classic uses `mood_treaty`, which `start_war` set to -200): right after a war starts `v ~ -200 + rel1(-75..-100) + d100 - 60 = about -350 + d100` (refusal); `mood_treaty` regrows ~+16/turn (relax +10 plus the `rnd(5)` boosts), so peace only becomes attainable after roughly 15-25 turns of war (`v >= 0` needs `mood + rel1 + d100 >= 60`).

#### 4.4.3 Propose Treaty submenu

Items & enable rules: `[Non-Aggression Pact]` only if treaty == None; `[Alliance]` only if treaty is None or NAP; `[Peace Treaty]` only if at war; `[Declaration of War on Another Race]` only if not at war with this AI and there is at least one empire the AI is not at war with; `[Break Alliance With Another Race]` only if the AI has an alliance with an empire it is in contact with (v1.3 lists alliances only; the human need not have met that empire; the `aud_ask_break_nap` fix would add NAP partners); `[Forget It]`. The war-target list contains every empire other than the two talking parties that the AI is not already at war with (no contact test).

| Proposal | Gate before rolling | Roll | On success |
|---|---|---|---|
| Non-Aggression Pact | `H.rel1[A] > 10` (else flat refusal, no mood cost) | `check_mood(50, treaty)` | treaty = NAP (both). [Guide]: requires relations >= +15; +20 DP signing bonus then +1..3/turn (the code gives per-turn +rnd(3) at 50%). |
| Alliance | `rel1 > 50` | `check_mood(125, treaty)` | treaty = Alliance. [Guide]: relations >= +50, +20 signing then +1..6/turn. |
| Peace Treaty (at war) | none | `check_mood(60, kind = treaty (Classic) / peace (Classic+))` (BUG: Classic uses the treaty mood, not the peace mood) and afterwards `annoy(2)` (-20 all moods) regardless of the answer | `stop_war`: treaty None, `rel1 += 40` (cap 100), `ceasefire = 8..13` turns (human side). (When the human accepts an **AI-offered** peace, type 30: the same `stop_war`, plus `rel1 += 20` if `< 80`, plus `annoy(2)`.) |
| Ask AI to declare war on X | AI must not be at war with X | if `A.treaty[H]==Alliance and A.treaty[X]==WAR`: 7/8 accept, else counter; otherwise `check_mood(A.rel1[X] + 150, treaty)` (Classic+ adds `30*A.treaty[X]`) | `start_war(A, X)`. [Guide]: relations >= +19 needed; thresholds 150/125/124 (250/225/224 if A has a pact with X); allies demand a tech 75% of the time. |
| Ask AI to break treaty with X | `A.rel1[H] > 24` | `check_mood(A.rel1[X] + 175, treaty)` | `break_treaty(A, X)` (A suffers oath-breaker effects). [Guide]: relations >= +19; 200/175/174. |

After the proposal the AI answers with message type `62` (NAP), `63` (alliance), `65` (peace), `67` (war), `68` (break alliance) chosen between accept/refuse variants (4.8); a refusal speech may instead be replaced by a **grievance speech** (4.8): `if blunder != 0 and 50%: type = blunder+30 (clear blunder)`, else `if broken_treaty != None and 25%: type 33 ("you broke our treaty", cleared)`, else generic refusal 31.

#### 4.4.4 Form Trade Agreement

* Let `cur = H.trade_bc[A]`, `prod = min(H.total_production_bc, A.total_production_bc) / 4` (cap 32000), `want = (prod/25)*25 - cur`.
* `want <= 0` -> menu item disabled. `want < 125`: options = `cur+25, +50, +75, +100` (only `want/25` of them). Otherwise 5 options: `cur + want/5`, `cur + ((2*want/5)/25)*25`, `cur + ((3*want/5)/25)*25`, `cur + ((4*want/5)/25)*25`, `cur + want` (i.e. 20/40/60/80/100% of the headroom; from zero this is 5/10/15/20/25% of the smaller empire's production - the cap is 25% of the smaller gross production, matching [Guide]).
* Leaving the submenu (whatever you pick, even "Forget It") costs `annoy(1)` and `mood_trade -= rnd(30)`. Choosing a level additionally rolls `check_mood(50, trade)` (with its own `annoy(1)` and `mood_trade -= rnd(30)+20`); **only result 3 succeeds** (no counteroffers for trade). Success: `set_trade(H, A, bc)`.
* `set_trade(bc)`: if `established < bc`: `percent = (percent*established - bc*30) / (established + bc)`, i.e. a new/larger deal restarts at a low (even negative, down to -30) efficiency; then `established = bc`. `percent` is capped at 100.
* Income: `trade_income = trade_bc * (trade_percent + bonus) / 100` per partner, **bonus = +25 percentage points if the empire is the Human race** (so humans start at -5% and cap at 125%). Efficiency grows each turn by `max(0, (rnd(200) + rel1 + 25)/60)` (0..3 per turn, better with good relations). Trade requires contact; losing contact or war removes it. Pirates reduce `trade_percent` (7.4).
* [Guide]: acceptance roll thresholds 100/75; +1..+X DP per turn for the trade partner with X = 1 + (trade share of the smaller economy)/5 (the v1.3 code gives `+rnd(3)` at 50% per turn).

#### 4.4.5 Threaten/Break Treaty and Trade

Submenu `[Break Non-Aggression Pact] [Break Alliance] [Break Trade Agreement] [Threaten To Attack] [Forget It]` (items enabled only if the matching state exists; threaten always).
* **Classic quirk**: merely entering this menu and choosing anything but "Forget It" - in Classic even choosing "Forget It" - costs `annoy(10)` = -100 on all four moods (the AI will refuse to talk for ~10 turns).
* Break NAP / Break Alliance: `break_treaty(H, A)` (4.2.2), then AI message type 73. Break Trade: `break_trade` only (no DP change in the code; [Guide] claims -12 DP and an oath-breaker mark), type 73.
* **Threaten to attack** [1oom `aud_threaten`]:
  ```
  v = rnd(200) + H.mood_treaty[A]/2 + 2*reldiff[A.trait1] + (A.total_production > 0 ? H.total_production*100 / A.total_production : 100)
  rel1 -= rnd(15) (floor -100) ; mood_treaty := -120
  if v < 170:   if (rnd(15) - reldiff[A.trait1]) > rnd(100): start_war(H, A) ; type 13 (war!)   else type 69 (ignores/defiant)
  else:         spies set to Hide (Classic BUG: it is the *human's* spy mode toward A that is forced to Hide; Classic+ hides A's spies) ; ceasefire[H][A] = rnd(15) + 5 ; type 70 (cowers = de-facto peace)
                if v >= 275: A gives the human one tech it has and the human lacks (never its newest in a field)
                elif v >= 200: A pays BC = ((rnd(8)+2) * year / 25) * 25 into the human's reserve, type 71
  ```
  [Guide]: roll = Relative Power(0..100, 100 when you have twice their power) + personality + d100: >= 100 appease (tech >= 10 levels below their level in that field, else 2d8*turn BC if they have it), 75-99 cower (peace, +40 DP, 8-15 turns), 25-74 ignore, <= 24 war; threats also drop all their moods by 50 and their relation by 30 + personality (Xenophobic -50 -> -80 total) (conflict: different constants).

#### 4.4.6 Offer Tribute

* Cash: choices computed from `reserve = min(H.reserve_bc, 32000)` rounded down to 25: if `reserve < 100`: up to 4 choices 25/50/75/100 (only those affordable); else `reserve/4, reserve/2, 3*reserve/4, reserve` (each rounded down to a multiple of 25). Money moves from the human's reserve to the AI's. Effect on relations `aud_tribute_bc`: **Classic: `rel1 += 0`** when the AI has any production (only if its production is zero: `+selected+1`) - i.e., cash tribute does nothing in v1.3 (BUG; Classic+: `+bc*12/A.production`), x2 if the human is Human; then the caps (at war `rel1 <= -25`, non-allied `rel1 <= 65`) are applied to the **AI's copy only** in Classic (BUG: not mirrored back to the human's copy, which the AI reads, until the next `diplo_act` overwrites it with the AI's copy; Classic+ mirrors). The source comment says MOO1's money-tribute value evaluates to 0 ("makes money tributes quite useless"). [Guide]: +12 DP per 100% of the AI's gross economy paid (nothing under 1/12 of it); needs >= 25 BC in reserve.
* Technology: lists up to 4 techs the AI lacks (from the human's list, any tech incl. newest) plus "[Technology]" entry; picking one gives it to the AI. Effect `aud_tribute_tech`: `base = (R<0) ? 20 : (100-R)/10`; `gain = ((rnd(8)+rnd(8)+ tech/4) * base)/10` (x2 for a Human giver); `rel1 += gain` (cap 100); `mood_peace += gain` (cap 200); `trust += rnd(8)+2` (cap +30); then caps: at war `rel1<=-25`, non-allied `rel1<=70` (same Classic caveat: applied to the AI's copy only). The AI remembers the tech and may thank you later (message 66, 25% of accepted-deal speeches). [Guide]: each tech tribute = permanent +5 Core Reaction (max +30) regardless of value, plus ~+12 DP scaled by tech level vs their level in that field.
* If you have nothing the AI lacks: message 75 ("nothing to offer").

#### 4.4.7 Exchange Technology

```
scale v = aud_tech_scale: di = H.mood_tech[A]; if di>0: di /= 5 ; di = min(di, 30) ; if allied: di += 25
        v = H.trust + H.rel1/2 + (H.race==Human?50:0) + 2*reldiff[A.trait1] + di + rnd(100) - 125
        v = (v<0) ? |v|+100 : 20000/(v+200) ; v /= 4 ; v = max(v, 75)          # (BUG-looking SETMAX: scale >= 75)
step 1: list = techs the AI has that H lacks, never the AI's newest per field (<= 6, value-sorted by random pick)  -> "What type of technology interests you?" (up to 5 offered)
step 2: for each wanted tech i: price_i = value_i * v / 100 ; candidates = techs H has that A lacks with value >= price_i
        only wanted techs with >= 1 candidate are shown; then "What will you trade for it?" lists <= 4 candidates (+ Forget It)
cost: annoy(1) ; mood_tech -= rnd(50)+20 when entering step 1;  on leaving: annoy(3) and mood_tech = min(mood_tech, 50)
result: both techs are exchanged immediately (no further roll).  If either list is empty: message 75.
```
[Guide] instead describes: you must offer a higher-level tech than you receive; they never trade their top tech in a field; "Unfair Trade Advantage" 1..100 (100 if your tech is >= twice the levels above theirs); roll `Core + relations + UTA + d100`: >=100 accept, 75-99 counter, <=74 reject (never listed).

### 4.5 Treaty / peace effects (mechanical)

* **Non-Aggression Pact**: in battle resolution NAP partners do not fight at planets whose owner is not the NAP target (third-party/neutral systems and own-colony systems of the attacker); at the NAP partner's own planet they still fight. Per-turn relation gain +rnd(3) at 50% (4.3). The AI can cancel it through the war-check function (4.6.5): at each qualifying check it breaks a NAP with probability 1/2 (certain if its objective is Expansionist) and an alliance with probability 1/4 (5/8 if Expansionist), **only at difficulty >= Average**.
* **Alliance**: no combat between allies anywhere; allied planets extend each other's **fuel range** (ships can refuel/route via ally colonies); allied transports landing on an ally's planet vanish; relation cap +65 is lifted (up to +100); allies **vote for each other** in the Galactic Council; AI allies automatically declare war on each other's enemies each turn and ask the human to join (type 76: join the war against X; 'Agree' = declare war on X, 'refuse' = alliance broken (type 77)); a human who is allied to the enemy of an AI is asked (type 27) to break that alliance when the AI initiates an audience (refusal sets rel1 = -100). Per-turn gain +rnd(6) at 50%.
* **War**: set by `start_war` (rel1 = -75..-100, rel2 -5, moods -200 / peace -130), AI spies switch to Sabotage (5.7), AI fleets attack, transports invade. `rel1` floor -25 after any later DP event (4.2.1). AI may propose peace (type 30) when `(trust + rel1 + (Human?50:0) + reldiff + rnd(100) + mood_peace) >= 50` (1/8 chance per qualifying turn).
* **Peace / ceasefire** (no treaty state of its own): treaty = None + `ceasefire[H][A] = 8..13` turns (Cower: 6..20). While `ceasefire > 0`: the AI's fleets retreat instead of fighting the human's defenders at its colonies; AI does not bomb human colonies, does not launch transports at him, cannot start the "fleet"/"production" war checks (except Erratic requires `ceasefire < 1`). [Guide]: peace treaty also hides their spies and resets the "spy-war" warning count (the AI's hide-on-ceasefire check uses the wrong array index in v1.3: BUG, no effect) and stops new ship/transport sendings for 8-15 turns.
* **Trade**: see 4.4.4.
* **Final War**: see 6.5.

### 4.6 AI-initiated diplomacy toward the human (end-of-turn diplomatic phase)

Runs after the AI-to-AI step (4.7), before the audiences are shown. For every human `H` and every AI `A` (both alive) the engine decides **one queued message type** `H.diplo_type[A]` (0 = nothing); then `game_turn_audiences` opens an audience for every non-zero entry.

#### 4.6.1 Per-pair dispatcher [1oom `turn_diplo_p2`]

```
if H.treaty[A]==FINAL_WAR or H.diplo_type[A]==59:  (keep 59 only; else clear)
elif H.have_met[A]==1:           have_met=2 ; diplo_type = 14 + A.trait1            # first-contact greeting
elif H.bounty_collect[A] != NONE: diplo_type = 58                                      # AI pays out its bounty
elif diplo_type in {13, 32, 60, 61}: pass                                              # war / treaty-cancel already decided this turn
else:
    v  = min(H.mood_treaty, mood_trade, mood_tech, mood_peace)[A]
    v2 = v + H.trust[A] + reldiff[A.trait1] ;  dv2 = 2 * H.diplo_val[A]
    if v2 <= -100 or v <= -100:           diplo_type = 0                              # AI has "gone cold": says nothing
    elif H.diplo_val[A] < 0:              (you offended it this turn)
         if H.hatred[A] > 0 or rnd(100) < |dv2|: reaction()  (4.6.4)   else diplo_type = 0
    elif H.treaty[A]==WAR and rnd(100)+30 < H.mood_peace[A]: reaction()  (peace feeler)
    elif rnd(100) < dv2 + (H.hatred[A]==0 ? 3 : 0) and rnd0(4)==0:
         if H.hatred[A] > 0: H.hatred[A] = 0                                          # forgives
         else: proposals()  (4.6.2)
    else: call_to_arms()  (4.6.3)
if diplo_type == 0: war_check(H, A) (4.6.5)
if diplo_type == 2 and rnd0(10) != 0: diplo_type = 0                                    # "thanks for the trade" only 10% of the time
```
Consequences: base chance that an AI starts a *proposal* in a given turn is only `P(rnd(100) < 3) x 1/4 = 2% x 25% = 0.5%` (with `dv2 > 0` it is `(dv2+2)% x 25%`), rising with positive DP the human earned this turn (`dv2 = 2 x largest positive DP change`), so spontaneous AI proposals are rare (a handful per game) unless you keep earning DP; the hatred/"forgive" branch uses the same roll.

#### 4.6.2 Proposals [1oom `turn_diplo_p2_sub1`] (first stage that fires wins)

Preconditions: contact, treaty < War, and **no AI fleet currently en route to any human colony** (else `diplo_type = 0`); if a message is already queued 50% chance to keep it and return.
`v = H.trust[A] + H.rel1[A] + (H.race==Human ? 50 : 0) + reldiff[A.trait1]`

| Stage | Condition | Result |
|---|---|---|
| A. Non-aggression pact | treaty == None and `rel1 > 15` and `v + rnd(100) + mood_treaty > 50` | type **24** (propose NAP) |
| B. Alliance | (treaty == NAP or stage A fired) and `rel1 > 50` and `v + rnd(100) + mood_treaty > 100` | type **25** (propose alliance; supersedes A) |
| C. Trade | nothing yet; `v + rnd(150) + mood_trade > 50`; `want = rnd(min(prodH,prodA)/4/25) * 25`; and `trade_bc < want` | type **26**, `au_want_trade = want` |
| D. Bounty | nothing yet; exists an empire X != H,A with `A.treaty[X] >= War` that H is in contact with (last one found); 1/10; no bounty outstanding | type **28**: AI offers a reward for hurting X: one tech H lacks (never A's two newest per field) else `BC = ((rnd(3)+1) * year / 50) * 50`; collected when H later inflicts `offense >= 30` on X's side (section 4.2.3) -> type 58 (**BUG: reward is never actually transferred in v1.3 unless `aud_bounty_give` fix is on**) |
| E. Tech swap | nothing yet; `v + rnd(100) + mood_trade > 25`; then price scale from `mood_tech` (as in 4.4.7) and a feasible swap pair exists | type **29** (AI wants tech W from you and lists up to 4 techs it would give; you pick one, both change hands immediately; "Forget It" indexes past the list in v1.3 = BUG); sets `mood_tech = 0` both ways |
| F. Pushy NAP | nothing yet; `rel1 < 0` and `A.production > H.production` and treaty None | type **24** (a hostile bigger AI demands a pact) |
| G. Sweetener | final type is 24/25, `A.production != 0`, `A.trait1 > Ruthless` (Aggressive/Erratic/Honorable/Pacifistic only), `rnd(100) <= H.production*30/A.production`, and 1/8 | 75%: `offer_bc = ((A.production/(rnd(3)+1) + year)/25)*25`; 25%: one tech A has and H lacks |

AI-initiated audiences (types 24-30, 58, 76) always begin with the greeting type 22 and (if the human is allied to someone the AI is at war with) first demand `[Agree]/[Forget it]` "break your alliance with X" (type 27): Agree = human breaks that alliance (oath-breaker effects against X); Forget it = `rel1 = -100` both ways. Then the AI states its proposal with `[Accept]/[Reject]` (type 27 uses Agree/Forget It). If the human rejects/ignores and `offer_bc/offer_tech` is set, the AI says "What if we also offered X as an incentive?" (or "Perhaps you would reconsider if we also provided X") and asks again. Accepting applies the treaty / trade / break / peace and credits the gift. After **every** AI-initiated audience: `annoy(1)` (-10 all moods) and extra `mood_treaty -= rnd(30)+20` (types 24/25), `mood_trade -= rnd(30)+20` (26), `mood_peace -= rnd(50)+50` (30), `mood_tech -= rnd(30)+20` (29) - **even if you accepted**.

#### 4.6.3 Call to arms [1oom `sub2`]

If `H.treaty[A] == Alliance` and 1/10: find an empire X != H,A that is at war with A, that H has contact with, and with which H is not at war (last one wins). If found: type **76** ("your ally calls: join us against X", options Agree/Forget It; `au_ally_attacker = X`). Agree: `start_war(H, X)` and the AI replies 78. Refuse: the AI breaks the alliance (`break_treaty(A, H)`, message 77). [Guide]: AI allies always declare war when asked, 75% of the time demanding a tech; invitations from AI to you are honoured with probability equal to your relations with the inviter.

#### 4.6.4 Reaction to offences / peace feelers [1oom `sub3`]

```
v = H.trust[A] + H.rel1[A] + (H.race==Human?50:0) + reldiff[A.trait1]
if H.treaty[A] < WAR:
    if H.rel1[A] <= -95:                        start_war(A, H) ; diplo_type = 13                                  # war declared out of hatred
    elif v - rnd(100) + H.mood_treaty[A] <= -100:                      # the AI is fed up
         if H.hatred[A] > 0:                                          # already warned once
             ++hatred
             if hatred > 2 or treaty == None:
                  if rnd(100) < -(reldiff[A.trait1]/2 + H.diplo_val[A]):  start_war(A,H) ; diplo_type = 13 ; hatred = 1
             else:  diplo_type += 46 (-> 50..57 "final warning") ; break_treaty(A, H)      # cancels NAP/alliance/trade
         else:                                                        # first complaint
             hatred = 1
             if treaty in {NAP, Alliance} or trade_bc != 0: diplo_type += 38 (-> 42..49 "first warning")
             (with no treaty/trade the plain offence message 4..11 is delivered)
else (at war):
    if v + rnd(100) + mood_peace >= 50 and rnd0(8)==0:
         diplo_type = 30 (AI proposes peace)
         with prob (A.production*30/H.production)% add a sweetener: 75% BC = ((A.production/(rnd(3)+1)+year)/25)*25, 25% a tech
```
So the "warning -> final warning -> war" ladder of the [Guide] is realised through `hatred` (1 = first warning, 2 = final warning + treaty cancelled, >2 or no treaty = war roll). [Guide]: "each net DP lost gives 2% chance of a warning per point (rnd(100) < 2*loss), an atta-boy (+DP) cancels one warning, two warnings in a row = war; when threatening the AI has a 50% chance to also break any treaty/trade with you; at Simple/Easy the AI never breaks treaties" (v1.3: `wage_war_do` returns early below Average; the sub3 treaty break has no difficulty test).

#### 4.6.5 War declarations by AIs (`wage_war(H,A)` [1oom `diplo_wage_war`])

Called every turn per (human, AI) pair when no message is queued, and for every AI pair (4.7). `A` is the would-be aggressor; `R = H.rel1[A]`, `T = H.trust[A]`, `D = reldiff[A.trait1]`:

```
if end != NONE (council verdict already given): everyone with the same "refuse" status becomes allied; return
if H.treaty[A] >= WAR or no contact or A not alive: return
1. Erratic:     if A.trait1==Erratic and rnd(300) <= difficulty and (H is AI or ceasefire[H][A] < 1):
                    diplo_type = 61 ; diplo_val = 2000 ; start_war(A, H)
2. else:
   a. Militarist/Expansionist fleet envy: if rnd0(20)==0 and A.trait2 in {Militarist, Expansionist} and A.trait1 != Honorable and (H is AI or ceasefire<1):
          fw = random in [-|ratio|, +|ratio|] with ratio = clamp((Fleet(H) - Fleet(A))*100/Fleet(A), -300, 300), Fleet = sum shipcount*hull_w capped 3,250,000, min 1
          if R - fw + D + T < -150: war_do()
   b. Production envy (any objective): if rnd0(20)==0 and (H is AI or ceasefire<1):
          pw = same construction with total_production_bc (H's minus A's, relative to A's) ; if R - pw + D + T < -150: war_do()
3. Ally chain: for AI p3, human p4: if p4 at war with p3 and A allied with p3 and ceasefire[p4][A] <= 0 and A.treaty[H]==Alliance and rnd0(10)==0: war_do()
4. Human pile-on: if H is human and difficulty >= Average: n = number of wars H currently has (any treaty >= WAR); if n < difficulty and R < -30:
          if rnd(10) <= (-R)/10: war_do()                 # e.g. R=-55 -> 50% per turn
war_do(p1=H-side target, p2=A aggressor):
    if H.treaty[A] in {Alliance, NAP}:
         if difficulty < Average: return
         if (Alliance and (rnd0(4)==0 or (rnd0(2)==0 and A.trait2==Expansionist))) or (NAP and (rnd0(2)==0 or A.trait2==Expansionist)):
              diplo_act(-10000, ..., type 32) ; break_treaty(A, H) ; if R > 30: rel1 = 30                      # AI cancels the treaty (message 32)
    elif ceasefire[H][A] <= 0:
         diplo_act(-10000, ..., type = (R < 0) ? 13 : 60) ; start_war(A, H)                                    # 13 hate / 60 cold calculation
```
Note the orientation quirk: `fw`/`pw` are *positive when the human is stronger/richer than the AI*, which makes the AI **more** likely to pick a fight with a stronger/richer player (v lower -> < -150), and treaty-bound wars first require breaking the treaty (next qualifying roll declares the war). [Guide] describes the opposite sense plus difficulty-scaled fleet ratios 7:1 (Simple) .. 3:1 (Impossible) and a -90 relation trigger (conflict: not in the v1.3 code; code triggers: rel <= -95 immediate; rel < -30 pile-on at >= Average; envy rolls; Erratic).

### 4.7 AI <-> AI diplomacy (every turn) [1oom `turn_diplo_p1`]

For every ordered pair of AIs (p1, p2) in contact, with probability `1/(15 - 2*difficulty)` per turn (Simple 1/15, Easy 1/13, Average 1/11, Hard 1/9, Impossible 1/7):
```
v = p1.trust[p2] + p1.rel1[p2] + reldiff[p2.trait1] + rnd(100) + (NAP:+10) + (Alliance:+20) + (trade:+10)
if v + p1.mood_treaty[p2] > 150 and treaty != Alliance: treaty = Alliance                 # literally also from War! (and an alliance is then toggled to NAP by the next 'else if' roll: BUG)
elif v + mood_treaty > 150 and treaty != NAP:             treaty = NAP
else:
    if p1.mood_tech[p2] + 80 < v:  swap one random tech each way (each picks a tech the other lacks, never the other's top 'rnd(3)' newest per field; only if both have one)
    elif v > 70:                    set_trade(min(prod1/4, prod2/4, 32000))
if rnd0(20)==0: diplo_act(+rnd(5), p1, p2, type 1)
(Classic: v is overwritten by a stale global 'diplo_msg_subtype' (BUG)) ;  if treaty==WAR and v + mood_peace > 100: stop_war(p1, p2)
annoy(p1,p2,3) ; sub1(): break alliances where an AI's two allies are at war with each other (buggy loop) ; wage_war(p1,p2)
```
Then for every AI pair with an alliance: if p1 is allied with p2 and any other AI p3 is at war with p1 but not with p2 -> `start_war(p2, p3)` (allies automatically join each other's wars, every turn, no roll).
AI-vs-AI DP gains are doubled and losses divided by `(difficulty/2+1)` after year 100 (4.2.1). [Guide]: after turn 100 "computers get double positive DP" with each other.

### 4.8 Message-type catalogue ("dtype") - categories for your own dialogue

Texts live in `diplomat.lbx` (not available); each type has several variants (`d0[type]` variants, variant chosen `rnd0(count)`; in a 2-player game the index is decreased by 1) and carries `gfxi` (portrait animation 0..5) and `musi` (music 0/1/2). Placeholders available inside texts: speaker race / addressed race, emperor names, a planet name (`diplo_p1`), a tech field (`diplo_p2`) or "factories/missile bases" flag, third-party race (war targets, bounty target, ally attacker, break-alliance target), BC amounts (trade, tribute, offer, gift), tech name, current treaty name ("alliance"/"non-aggression pact"/"trade agreement"/"treaty"), year. Types ending 5, 7, 35, 37, 43, 45, 51, 53 are the **"framed"** variants of the type one lower (append "(you were framed)").

| Type | Category | When / who speaks |
|---|---|---|
| 1 | pleasantry / thanks after a positive act | AI-AI +DP; suppressed as a standalone audience |
| 2 | thanks for the trade agreement | queued by per-turn trade DP; shown 10% of turns |
| 3 | thanks: "you hurt our enemy" | after `offense >= 30` against an AI's enemy |
| 4 / 5 | complaint: **spies stole tech** (field named) / same, you were framed | AI reaction to identified espionage |
| 6 / 7 | complaint: **sabotage** (planet, "factories" or "missile bases") / framed | |
| 8 | complaint: **massing fleets on our border** | |
| 9 | complaint: **attack on our ships/defenses** | after combat |
| 10 | complaint: **population killed** | after bombardment/invasion |
| 11 | complaint: **biological weapons** | |
| 12 | complaint: your empire is too big (sent to allies) | block C |
| 13 | **war declared** (hatred) | |
| 14-19 | **first contact greeting**, one per personality (Xenophobic, Ruthless, Aggressive, Erratic, Honorable, Pacifistic) | |
| 20 | refuses to speak (at war), single message | audience open |
| 21 | refuses to speak (not at war), single message | audience open |
| 22 | greeting - friendly (also header of AI-initiated audiences) | |
| 23 | greeting - cool/curt | |
| 24 / 25 / 26 | AI **proposes** NAP / alliance / trade agreement | |
| 27 | AI demands you **break an alliance** with X (Agree / Forget it) | start of AI audiences when you ally its enemy |
| 28 | AI **offers a bounty** for attacking X | |
| 29 | AI **proposes a tech swap** | |
| 30 | AI **proposes peace** (cease-fire), maybe with a sweetener | |
| 31 | generic refusal | answer to a failed proposal |
| 32 | AI **cancels a treaty** (message then treaty broken) | `war_do` |
| 33 | refusal: "you broke a treaty with us before" (broken-treaty memory, 25%) | |
| 34-41 | refusal citing the remembered offence (`blunder`+30: 34 theft, 36 sabotage, 38 border fleet, 39 ship attack, 40 pop killed, 41 bio; 35/37 framed) (50%) | |
| 42-49 | **first warning** about offence 4..11 (treaty partners) | `hatred = 1` |
| 50-57 | **final warning**, treaty cancelled | `hatred = 2` |
| 58 | AI **pays its bounty** (BUG: nothing arrives in v1.3) | |
| 59 | final-war hostility | |
| 60 | war declared coldly (relation >= 0) | |
| 61 | war declared in a fit (Erratic) | |
| 62 / 63 / 65 / 67 / 68 | answer to your NAP / alliance / peace / "declare war on X" / "break alliance with X" proposal (accept speech if accepted, refusal 31/33/34-41 otherwise) | |
| 64 | answer to your trade proposal | |
| 66 | thanks for the earlier tech tribute (names the tech; 25% of acceptance speeches; standalone suppressed) | |
| 69 | answer to your **threat**: defiant / ignores | |
| 70 | answer to your threat: **cowers** (peace; may include a tech tribute) | |
| 71 | answer to your threat: **pays BC** to be left alone | |
| 73 | reaction to **you breaking** a treaty / trade agreement | |
| 74 | "not now / later" (all moods too low) | |
| 75 | "nothing to trade / offer" (no suitable tech/BC) | |
| 76 | ally **asks you to join the war** against X | |
| 77 | ally **breaks the alliance** because you refused | |
| 78 | ally **thanks you** for joining the war | |
| 79 | "you voted against me" (council) | |
| 80 | "you voted for me" (council) | |

### 4.9 Quick comparison - what [Guide] says vs what v1.3 code does (diplomacy)

| Topic | [Guide] (design doc) | [1oom] v1.3 code |
|---|---|---|
| Temp modifiers | 5 categories (Treaty, Peace, Trade, Exchange, Diplomat-gone), every parlay -10 on all, -30 on the rejected topic; recover 10/turn toward 0; below -100 half the excess is an instant DP loss | 4 moods (+ min = "gone"); -10 all per check and an extra -21..-50 on the topic (-51..-100 peace); recover toward **+100** (+10/turn, plus rnd(5)s below 50); no instant-DP rule found |
| Acceptance rolls | Core Reaction + modifier + d100 vs 75/125/0/100/100 (NAP/alliance/peace/trade/tech) | `mood + trust + rel1 + (Human 50) + reldiff + d100 - a0` with a0 50/125/60/50, result bands <-75 / <-50 / <0 / >=0 |
| Human race bonus | +60 on treaty/trade/exchange | +50 flat in every roll |
| NAP/alliance relation gates | +15 / +50 | >10 / >50 (human asks), >15 / >50 (AI offers) |
| Oath-breaking | -5 core permanent (-10 Honorable), -36 DP | trust 10/20 (sign BUG), rel1 -1..-20, moods -200 |
| Threat table | RelativePower + personality + d100 (>=100 appease, 75-99 cower, 25-74 ignore, <25 war) | `rnd(200) + mood/2 + 2*reldiff + prodH*100/prodA` (>=275 tech, >=200 BC, >=170 cower, else defiant/war) |
| Cash tribute | +12 DP per 100% of their economy | **0 DP** in Classic (only production-0 case gives +1..4) |
| Council vote DP | +24 / -12 / -6 | same |
| Spy-caught DP | espionage 10d3, sabotage 20d3 | human spy 5d12, AI sabotage 20+d20, framing 2d12 / 2d16 |
| Natural drift | toward base level 1 DP/turn | moves 1 DP toward `rel2` with probability about `abs(rel1)/210` per turn (needs `abs(rel1) > rnd(105)` and then a coin flip); relations near 0 barely drift |
| War triggers | rel <= -90, 2nd threat, fleet ratios by difficulty, assassination, erratic 2%/turn | see 4.6.5 (rel <= -95; pile-on rel < -30 at >= Average; fleet/prod envy; Erratic `difficulty/300`) |

---------------------------------------------------------------------------------------------------

## 5. ESPIONAGE

### 5.1 Budget, units, hiring

* Two sliders on the **Races screen** (only for contacted, living empires):
  * **Spy budget per target empire** `spying[T]`: integer 0..100 = 0.0%..10.0% of the empire's *gross production* per turn (stored in tenths of a percent; one click = 4 units = 0.4%, so 25 clicks; Alt-click = 0/100). [Guide]: "0-10%, 25 clicks".
  * **Overall Security** `security`: integer 0..200 = 0.0%..20.0% of gross production (10 per click = 1%, 20 clicks). Shown in the UI as a catch bonus `security/5` (+2 per 1% spent; +20 extra shown for Darlok).
  * Both are deducted from income: `actual_prod = gross*(1000 - security - sum(spying))/1000 + trade - ship_maint - base_maint - gross*tax/1000`; the Races screen shows the total allocation.
* **Hiring** (`spy_build`, once per turn): per target T with `spying[T] != 0`:
  ```
  base = 2 * (own COMPUTER tech level percent) + 25            # BC ; Darlok: base /= 2
  fund = gross*spying[T]/1000 + spyfund[T]
  cost = base ; while fund >= cost: spies[T]++ ; fund -= cost ; cost *= 2          # doubling inside one turn's purchase
  spyfund[T] = fund
  ```
  [Guide]: first spy 25 + 2*computer level BC (e.g. computer 13 = 51), "each additional spy in the same empire costs double the previous, based on living spies (51, 102, 204, ...)", unspent money is kept in a per-target spy fund. (conflict: the v1.3 code never looks at how many spies are alive; the doubling restarts every turn.)
* No spying budget toward empires you have no contact with (forced to 0). Spies are per target and are lost when caught.

### 5.2 Spy modes (set per target on the Races screen; AI sets its own)

`Hide` (default; spies stay put, do nothing, small chance of being caught), `Espionage` (steal a technology), `Sabotage` (destroy factories / missile bases / incite revolt).

### 5.3 Per-turn spy resolution [1oom `game_spy_turn`] (runs after movement/combat, before research)

For each spy-owner `S` and each target `T` (both must own a planet), `n = S.spies[T]`:
```
comp1[X] = X.tech.percent[COMPUTER] (+20 if X is Darlok)           # as defender
comp2[X] = X.tech.percent[COMPUTER] (+30 if X is Darlok)           # as spy
dt1 = max(0, comp2[S] - comp1[T])                                   # infiltration edge
dt2 = max(0, comp1[T] - comp2[S]) + T.security/5                    # detection bonus (security 10 = +2)
if S.mode[T] == Hide: dt1 += 30
caught=failed=0 ; any_caught=frame=false
if Hide:   for each spy: if rnd(100)+dt2 > 85: caught++ ; n = 0                    # hiding spies can still be caught (~15% at equal tech)
else:      for each spy i: r = rnd(100)+dt2
                if r > 99:  caught=failed=n ; any_caught=true ; break               # confession: whole network lost, full blame
                elif r > 70: caught++ ; failed++ ; any_caught = true                  # eliminated
                elif r > 50: failed++ ; any_caught = true                             # stopped for the turn, survives
                # (BUG: the intended "31..50 = cleared but identified later" branch is a duplicated 'r > 50' test and never fires)
n = max(0, n - failed) ; caught = min(caught, S.spies[T]) ; S.spies[T] -= caught
r = rnd(100) + dt1 ; if r > 84: success = n   (ALL remaining spies succeed together) ; if r > 100: frame = true
record spies_caught[T][S] = caught  (shown on the "Spies Caught  Yours  Theirs" overlay, key C)
Espionage mode -> 5.4 ; Sabotage mode -> 5.5
```
[Guide] tables: **Table 12-1 (security check, per spy)** d100 + target security% + (target comp - spy comp, if positive) (+20 Darlok defender) (-30 hiding): <=0 cleared and may frame; 1-30 cleared; 31-50 cleared but identified if the mission succeeds; 51-70 stopped, escapes; 71-99 eliminated; 100+ eliminated, confesses, cancels the owner's other spies that turn. **Table 12-2 (infiltration, per spy)** d100 + comp edge (+20 Darlok): 0-84 fail, 85-99 success, 100+ success and may frame. "Base catch chance 30%, 0% if hiding" (conflict with thresholds above).

### 5.4 Espionage mission (steal a technology)

```
steal_number = max(rnd(100) over the successful spies) * T.best_field_level / 100       # best_field_level = max of T's six tech levels
candidates = up to 6 random distinct techs that T has and S lacks:
     - "lacks" is judged per tech *group*: for groups {Improved Robotic Controls, Space Scanner, Reduced Industrial Waste, Improved Industrial Tech, Planetary Shield, Improved Terraforming,
       Controlled Environment, Eco Restoration, Personal Armor, Personal Shield, Fuel Cells, Personal Weapons} a tech is not stealable if S already has an equal-or-higher tier of that group
     - a Silicoid thief never gets Reduced Industrial Waste / Controlled Environment / Eco Restoration techs
     - value = level^2, x10 if group Singular, x6 Improved Robotic Controls, x3 Reduced Industrial Waste or Eco Restoration, /4 if S owns a higher tier of the group, 0 if equal; Death Ray = 30000; value 0 excluded
remove candidates whose level > steal_number
human spy: up to 5 attempts of the sampler build a list with one tech per field -> UI "Your N spies steal the plans for:" shows the field buttons (not the techs); you pick a field;
           you receive the listed tech (best stealable one in that field); if a spy was flagged `any_caught` the victim is told who and takes a DP penalty of 5d12 (type 4) (if nobody was flagged the stored "penalty" is just your player index, i.e. 0 for player 1 - effectively none) ; if `frame`, a second dialog lets you pick which of two other empires in contact with the victim gets blamed (penalty 2d12, type 5 on them)
AI spy: takes candidate #1. If the victim is human it is shown a notice "<race> spies steal the plans for <tech>" or "Unknown spies ..." (identification only when the spy was flagged `any_caught` or a frame target is shown).
```
[Guide]: each infiltrating spy rolls 1..(target's best level in its best field); the highest roll is the steal number; you steal the best tech in a category not exceeding it; if nothing qualifies the mission fails but the spy survives; stolen techs show in bright lettering on the Report screen. You learn what was stolen only if your spy was identified.

### 5.5 Sabotage mission

```
chances = ((S.tech.percent[WEAPON] + 9) * n_success) / 10          # = weapons level/10 per spy (levels 1-10: 1 ... 91+: 10)   [Guide Table 12-3]
total   = sum over 'chances' of rnd(5)                                # 1..5 each
Human saboteur: choose any planet of T (map hotspots) and one of
   Missile Bases : each of the `total` units has a 25% chance -> destroys min(hits, bases)            ([Guide]: 50% per chance, one base each)
   Factories     : destroys min(total, factories)                                                       ([Guide]: 1-5 per chance)
   Incite Revolt (only if planet unrest is normal): rebels += max(1, pop*total/200) ; if rebels >= pop/2 -> planet rebels (unrest = Rebellion, rebels = pop/2)   ([Guide]: each spy adds 2-10% of pop, never fails)
   report screen: "<your/unknown/race> spies destroyed N factories / missile bases" , "incited N (x%)" or "failed!" (if the planet had none: "no factories", "no missile bases", "no incitement possible")
AI saboteur vs human: random planet of the victim; 25%: revolt (rebels += max(1, min(pop, pop*(total/2)/100))), else 50/50 factories (-total) or bases (-total/5);
AI vs AI: random planet; factories -total or bases -total/5.
DP (AI saboteur vs AI): if some spy was flagged `any_caught` and the roll did not frame: diplo_act(-(rnd(20)+20), S, T, type 6); framing (r > 100): a random third empire in contact with T gets diplo_act(-(rnd(16)+rnd(16)), third, T, type 7).
DP (human saboteur): the code computes `rcaught = rnd(20)+20` when a spy was flagged, but the penalty applied after the player chooses reads `evn.spied_spy`, which only *espionage* sets (it is 0 for sabotage), so as emulated by 1oom a human sabotage costs 0 DP and the "frame" dialog never appears; Incite Revolt is explicitly never penalised. ([Guide]: -20..-60, 20d3, if identified.) Treat as BUG; recommended intent: penalty `rnd(20)+20` when identified.
```
`rebels` > 0 + `unrest == REBELLION`: planet produces nothing (`v = 0`), cannot vote in the Galactic Council, defends with its rebel count in ground combat (see game_ground), may be reconquered by sending troops (the planet's "inbound" loyal troops fight the rebels one-on-one; win -> unrest = Resolved, `pop = pop - rebels + survivors`).

### 5.6 Consequences summary

* **Caught** spies are removed (`spies_caught` overlay). With `r > 99` the entire network against that target is lost.
* **Political cost** goes to the empire blamed (the sender if identified/confessed; the framed empire if a frame succeeded): see 4.2.3 (espionage -5d12 for a human sender, sabotage -(20+d20), framing -2d12/-2d16, then scaled by 4.2.1). [Guide] (conflict): espionage 10d3 (-10..-30), sabotage 20d3 (-20..-60); the penalty applies only if the spy was identified; a confessing spy blames its sender, a framing spy blames the chosen race, a successful identified spy blames its sender; a victim needs contact with at least two other races for a frame to be possible; failed/eliminated spies cause no penalty.
* **Peace treaty**: [Guide] says successful spying on a peace partner breaks the truce as an oath-breaker act (not in code); AI spies are supposed to hide during a ceasefire (BUG in v1.3: wrong array index, so they don't).
* Stolen/sabotaged **notices** appear at the end of turn for human victims (4.8/11).

### 5.7 AI spying behaviour [1oom `ai_p3`, only after year 30]

* `security` of an AI = `min(100, rnd0(2) * (total spies of all contacts against it) + 8*difficulty)` (per mille, i.e. at most 10% of production).
* Spy mode toward each contact (re-evaluated every few turns): at war -> Sabotage; else (50%, always for Darlok) -> Espionage with probability `rnd(200) > 2*rel1 + 200` (only possible when `rel1 < 0`: chance `-rel1/100`), else Hide. A mode other than Hide is applied only with 1/3 chance toward another AI (always toward a human); then `spying = rnd(5)+5` (0.6%-1.0% of production). Otherwise `spying = 0`, Hide.
* [Guide] (conflict, flavour): no AI spying before turn 50 unless at war; at war spends 8-10% on spies; base spy rating by objective (Diplomat/Technologist 40, Industrialist/Militarist 30, Ecologist/Expansionist 20; any at war 40; Psilon +10, Darlok +30); "spy wars" levels 1-3 by number of threats (0-1: espionage only and none if relations >= +19; 2: 75% espionage/25% sabotage; 3+: 25%/75%); sabotage targets missile bases first, otherwise random colony 25% revolt/else factories or bases; security +1% per active enemy spy up to 20%.

### 5.8 Race and technology effects

* **Darlok**: spies cost half; +30 offensive / +20 defensive computer-equivalent in the rolls; AI Darloks always use Espionage when not at war. [Guide]: +20 infiltration, +20 catching, "high ECM".
* **Computer tech level** drives spy cost (2/level + 25 BC) and the two roll modifiers (own computer minus the other's computer).
* **Weapons tech level** drives sabotage strength.
* No other technology influences spying. Psilon spy bonus is only in the [Guide].

### 5.9 Spy information screens

* "Report" (per race, needs >= 1 spy): shows each field's best known tech as of the last report (`spyreportfield[T][f] = T's newest tech in field f`, `spyreportyear`), refreshed every turn while spies exist.
* Effect of a stolen tech notice for victims: "<race> spies steal the plans for <tech name>" / unknown spy variant.

---------------------------------------------------------------------------------------------------

## 6. GALACTIC (HIGH) COUNCIL

### 6.1 When it meets [1oom `game_turn_process`; confirmed by [Guide] and [LP]]

Checked once per turn during turn processing, **before** the year counter is incremented:
```
convene if  council_years != 0                       # council_years = 25 (0 would disable councils)
        and ( (year % 25 == 0)  or  not election_held )
        and  number_of_alive_empires > 2             # with only 2 empires left there is no council: the only win is elimination
        and  colonised_stars >= (galaxy_stars * 2) / 3     # integer division; colonised = planets with an owner
        and  end == NONE
then  run election ; election_held = true
```
* Thresholds of "two-thirds colonised": Small (24 stars) 16, Medium (48) 32, Large (70) 46, Huge (108) 72 owned stars.
* The **first** council convenes on the first turn the 2/3 condition holds (`not election_held`); later ones only at internal years that are multiples of 25 (year 25, 50, 75, 100 ...), i.e. they are announced as the displayed year becomes 2325, 2350, 2375, 2400, 2425 ...; if the first session happens at an off-year the second can follow 1-24 turns later ([Guide]/[LP]: "first meeting once 2/3 colonised (the manual's 'half' is wrong), then every year divisible by 25"). A session that elects nobody simply repeats at the next multiple of 25. Once someone is elected (`end != NONE`) no further councils are held.
* Once `election_held` is true the AI doubles the threat value of its *own* ship designs and halves the force threshold below which fleets stay idle ([1oom] `turn_p1`/`send_idle`), i.e. it attacks with smaller margins after the first council ([Guide] "Charge!": before the first council AIs attack at ~2:1 firepower advantage, after it at ~1:1, in Final War almost recklessly). Once the game is in a post-verdict state (`end != NONE`) the same doubling/halving is applied a second time.

### 6.2 Electorate, candidates, vote weight

* Vote weight of an empire = `ceil( sum of pop of its planets that are NOT in rebellion / 100 )` (population units; [Guide]: "one vote per 100 million, fractions count, rebels don't vote"). Eliminated empires have 0.
* `total_votes` = sum over all empires. **Needed to win = ((total_votes + 1) * 2) / 3** (integer division) - e.g. 14 total -> 10 needed, so any bloc with > 1/3 of the votes holds a veto, any bloc with > 2/3 elects itself ([LP] confirms 14 -> 10).
* **Candidates** = the two empires with the most votes (bubble sort, ties keep player-index order). If the leader is an AI and the runner-up is a human, the human is listed first. Nobody else can be nominated.
* Voting order: all AI empires (and any additional humans) in player-index order, **the first human votes last**. Voters with zero votes abstain automatically.

### 6.3 How votes are cast

```
for each voter V (AIs first): 
    n = V's vote weight
    choice = AI: vote_ai(V)  |  human: menu "[1] <cand0 | Yourself>  [2] <cand1 | Yourself>  [0] Abstain"
    if n == 0: choice = abstain
    abstain:  evn.voted[V] = NONE ; diplo_act(-6, V, cand1) ; diplo_act(-6, V, cand0)
    vote for c: got_votes[c] += n ; evn.voted[V] = c ; diplo_act(+24, V, c) ; diplo_act(-12, V, other)
              (a non-candidate human also records message types 80 "voted for you" / 79 "voted against you")
```
`diplo_act` only has an effect when its *target* is an AI (4.2.1), so AIs never change their opinion of a human via their votes, but the human's vote does: +24 (scaled by relation/personality/Human-race doubling) toward the candidate he backs, -12 toward the other, -6 each if he abstains. [Guide] confirms +24/-12/-6.

**AI vote algorithm** [1oom `game_ai_classic_vote`]: let `c1, c2` be the candidates, `rel(x) = V.rel1[x]`:
```
w(c) = 20 * [c owns Orion] + 20 * [c is race Human] + 40 * [V's previous council vote was c]
if V == c1: vote c1 ; if V == c2: vote c2
if V.treaty[c1] == Alliance: c1 ; if V.treaty[c2] == Alliance: c2
if V.treaty[c1] == War: c2 ; if V.treaty[c2] == War: c1
if rel(c1) >= 0:  if rnd(100) < rel(c1)/4 + w(c1): vote c1
else:             if rnd(100) < (-rel(c1))/4 + w(c2): vote c2
if rel(c2) >= 0:  if rnd(100) < rel(c2)/4 + w(c2): vote c2
else:             if rnd(100) < (-rel(c2))/5 + w(c1): vote c1          # BUG-looking /5 instead of /4 (and no vote_hate helper)
abstain
```
[Guide] (same structure, bigger numbers - conflict): self-vote first; allied to exactly one candidate -> that ally; at war with exactly one -> the other; otherwise two "coin tosses" (leading candidate first, then the other; weighted to land on its edge = abstain): chance up to 40% from relations (Harmony favours, Feud opposes), +60% if the voter backed that candidate at the previous meeting, +20% if the candidate controls Orion (human owner of Orion: +40 total because Human race also +20), +20% if the candidate is the Human race, and a difficulty-based bonus for the human player (+12.5% Simple, 10, 7.5, 5, +2.5% Impossible - not found in the v1.3 code). [LP]: "relations, not fleet strength, determine AI support"; abstaining happens often.

### 6.4 Result

```
need = ((total_votes + 1) * 2) / 3
winner = first of (cand0, cand1) with got_votes >= need            # cand0 is checked first
if winner exists: g.winner = winner ; text "In the year <Y>, the Council has chosen <Emperor name> of the <race> to be the High Master of the New Republic."
                  g.end = winner is human ? WON_GOOD : LOST_EXILE
else:             text "Neither leader has a two thirds majority ..." ; nothing changes
if g.end != NONE: acceptance step (6.5)
```
Council voting UI: council chamber (music track 0x27), a nomination announcement ("Emperor <name> of the <race> and Emperor <name> of the <race> have been nominated."), then each voter's ballot ("N votes for <name>", or "The <race> abstain (N votes)..."), a vote tally bar (cand0 votes left, cand1 right, total centre).

### 6.5 Accept or defy (human decision) and the Final War

Each living human is asked "Do you accept the ruling?" `[Yes]/[No]` (ESC = yes). All accept -> the game ends: winner human -> **Victory (WON_GOOD)**, AI -> **Defeat (LOST_EXILE)**.
If at least one human defies:
```
for every non-refusing empire P1:
    for every refusing human PH:   break_trade(PH, P1) ; treaty(PH, P1) = FINAL_WAR
    treaty(P1, P2) = ALLIANCE for all non-refusing P2 (including itself)
if end == WON_GOOD (the human won the vote but refuses the job): winner := the other candidate
message "So be it. You defy the ruling of the council. Now you will feel the wrath of the New Republic!" (+ "<Emperor> is now High Master.")
tech_final_war_share() ; end = FINAL_WAR
```
Every following turn (`update_final_war`): the union of all techs of the non-refusing empires (even already-dead ones - a known bug) is merged into every living non-refuser (a human non-refuser receives them as "tech revealed" notices); refusers neither give nor receive, except that if there is more than one refuser they share among themselves; every pair with the same refuse-status gets `ALLIANCE, rel1 = +100`, every pair with different status `FINAL_WAR, rel1 = -100`. The AIs: `wage_war` marks all same-side pairs allied; `need_conquer` is cleared; targets of attack include everyone on the other side; fleets threat x2 and planets weighting changes; audience button disabled, no peace possible, no more councils, pirates cease ([Guide]). Winning is only possible by eliminating all rivals (Tyrant ending); losing = all your planets gone (Funeral ending).
[Guide]: "You are branded an evil tyrant", relations permanently bad; members trade all tech with each other, cancel all agreements with you, expect constant fleets and spies; no biological-weapon/genocide diplomatic restraint any more.

### 6.6 Facts useful for implementing vote logic / AI heuristics

* Orion owner gets +20 vote weight from every AI voter ([1oom] `vote_w`) - capturing Orion (after killing the Guardian) is a council tool.
* Reaching ~1/3 of all votes (population) gives veto power; having > 2/3 elects yourself; abstaining is a "polite" way to stall for another 25 years; voting for a candidate who can't win is a cheap relation gain (+24).
* You can vote for yourself only when you are one of the two candidates; otherwise the ballot offers the two candidates and Abstain. The human's vote is never forced (Esc/other input = abstain).

---------------------------------------------------------------------------------------------------

## 7. RANDOM EVENTS, MONSTERS, ORION / GUARDIAN, ARTIFACTS

### 7.0 What does NOT exist in MOO1

* **No Antarans.** The Antarans are Master of Orion II. In MOO1 they only appear (at most) as background lore about the Orions' ancient enemy; there are no Antaran fleets, raids, arrival date or final battle. The nearest equivalents are the **Orion Guardian** (7.5), the **Space Crystal / Space Amoeba** monsters (7.4) and the **Final War** after refusing the council (6.5). Sources: Wikipedia premise (Orion = "throne-world of the Ancients" guarded by a Guardian), [Guide], [1oom] (no Antaran code/strings).
* **No native planets / space natives, no pirates fleets, no Space Hydra/Eel/Dragon** (MOO2). Only the monsters Crystal, Amoeba and the Guardian exist.

### 7.1 The event engine [1oom `game_event_new`], once per turn (after combat, before audiences)

```
initial: evn.year = 40            # "last event" year; random events cannot start before year 41
if events disabled (cheat 'EVENTS' toggle or event_roll == 0): clear all pending events, return
chance = (evn.year > year) ? 0 : year - evn.year            # turns since the last event (or since year 40)
chance = chance/2  (Simple) | chance*2/3 (Easy) | chance*3/4 (Average) | chance*4/5 (Hard) | chance (Impossible)
if rnd(512) > chance: return                                # P(event this turn) = chance/512 (capped at 1)
victim = pick_victim()                                       # 7.1.1
planet = random planet owned by victim ; if none or planet == Orion: return
repeat up to 5 times: type = rnd(16) ; reject (type = none) if ANY of:
     evn.done[type]                                       # each event type happens at most ONCE per game
     REBELLION  and (victim is not human or planet is victim's home planet)
     QUAKE      and planet.pop < 50
     CRYSTAL/AMOEBA and year < 200
     CRYSTAL/AMOEBA and a Crystal or Amoeba currently exists
     DERELICT   and victim is human
     ASSASSIN   and game already ended (end != NONE)   ; or no AI (other than victim) has a NAP/alliance with the victim
     COMET      and year < 100
     PIRATES    and the victim has no trade agreement with any contacted empire
     ACCIDENT/PLAGUE and victim race is Silicoid
     ACCIDENT   and (option accident_chk_factories) planet.factories < 30         # off in v1.3: any colony can be hit; [Guide]: >= 30 factories needed
     ENVIRO     and (planet.type < Minimal  or planet.growth >= Fertile or planet.special > Normal)
     RICH       and (planet.special > Normal or == Artifacts)           # i.e. only Normal/Poor/Ultra-poor planets can become Rich
     POOR       and (planet.special < Normal or == Artifacts)
   (the assassin of an ASSASSIN event = the last AI i != victim with victim.treaty[i] in {NAP, Alliance})
if type found: evn.year = year ; evn.done[type] = true ; fill the type's parameters (7.2)
```
* **Frequency**: expected wait since the previous event: Simple 40 turns, Easy 35, Average 33, Hard 32, Impossible 28 (median 38/33/31/30/26); probability of an event within 25 turns 26%/34%/37%/39%/48%. There are only 16 types and each fires once, so a whole game sees at most 16 events and fewer in practice (failed type draws just delay the next attempt without resetting `evn.year`). [Guide] agrees: "no events before turn 50; ~25-30 turns average at Impossible, about twice as long at Simple; each event only once; chance resets after an event" (its quoted "2% per turn" is the same accumulation measured differently).
* Cheat/option: Alt + typing `EVENTS` on the Control screen toggles events (shows "No Events"); the accumulated chance keeps growing while off.

#### 7.1.1 Victim selection [1oom `game_event_new_get_victim`] (conflict with [Guide])

```
n_i = number of planets owned by empire i ;  if n_i < 4: w_i = 0 ; elif i is human: w_i = n_i*5 else w_i = n_i
m = max(5, min over all 6 player slots of w)        # slot minimum includes unused slots = 0, so m = 5 unless all six slots are used
w_i = w_i / m ; for real players w_i = max(w_i, 1) ; victim = weighted random pick
```
=> a human with N planets is picked ~5x as often as an AI with the same size; empires with fewer than 4 planets weigh 1 (but see [Guide]: "players with four or fewer planets are never affected"). [Guide]: good events favour the poorest empire, bad events the richest, weighting with the square of the production ratio - NOT in the v1.3 code (one distribution for all event types).

### 7.2 The sixteen events (effects, parameters, announcements)

Common: every event is announced by a GNN item (section 11). Events are processed in the "random events" phase; multi-turn events (plague, nova, comet, pirates, accident clean-up, monsters) continue each turn until finished. `D` = difficulty 0..4, `prod` = the planet's `prod_after_maint`.

| # | Event | Parameters when it starts | What happens | Ends |
|---|---|---|---|---|
| 1 | **Plague** (bad) | victim planet; `cure_cost = (rnd(8) + 2*D) * prod` research points (Simple 1-8x ... Impossible 9-16x production) | Turn 1 announcement only. From turn 2 each turn: planet loses `((rnd(6)+4)*pop)/100` population (5-10%, but not below 0); `cure_cost -= planet's tech output` (`prod*tech_slider%`, x1.5 Psilon, x2 Artifacts, x4 Orion planet) - the planet's research is *removed* from the empire's total and applied to the cure; transports cannot leave a plagued planet ([Guide]). AI planets move all sliders to tech (`crank_tech`, +20% of the empire's reserve onto that planet) | `cure_cost <= 0` -> cured |
| 2 | **Earthquake** (bad) | planet must have pop >= 50 in code ([Guide]: >= 30) | Immediate: `pop -= (rnd(10)+20)% of pop` (21-30%), `factories -= (rnd(50)+30)% of factories` (31-80%) | one turn |
| 3 | **Supernova / Nova** (bad) | `years = rnd(5) + 10 - D` (Simple 11-15 ... Impossible 7-11); `cost = (rnd(5) + 10 - D) * prod` | Each turn after announcement: `cost -= planet tech output`, `years -= 1`. Planet's research is diverted like plague. If `cost <= 0` before `years` hits 0: averted ([Guide]: "reatomizer"). If `years <= 0` and not averted: planet becomes **Radiated/Hostile**, `max_pop = rnd(10)+10` (11-20), `pop = min(pop, rnd(max_pop))` (0 if unowned), `factories = min(factories, ((rnd(3)+1)*factories)/20)` (80-90% destroyed). AI planets: `crank_tech` | averted or exploded |
| 4 | **Industrial accident** (bad) | not for Silicoids | Immediately: `max_pop3 /= 2` (and `max_pop2 = min(max_pop2, max_pop3)`), `waste = max_pop3 - 10`, planet type -> **Radiated**, growth -> Hostile. A second GNN item appears once the waste is cleaned (`waste == 0`) | waste cleaned (terraforming/eco spending restores the lost max pop) |
| 5 | **Assassination / diplomatic blunder** (bad) | needs an AI with NAP or Alliance with the victim; the assassin = last such AI | Assassin's empire immediately declares war on the victim (`start_war(assassin, victim)`: treaties broken, rel1 = -75..-100). If the victim is human: queued message type 13, `diplo_val = 100`. [Guide]: "automatic declaration of war, DP reset to -75" | instant |
| 6 | **Computer virus** (bad) | field: Computer / Force Field / Propulsion / Weapon (25% each; Construction & Planetology immune) | Victim's accumulated research investment (RP progress toward the current project) in that field is set to **0** | instant |
| 7 | **Comet** (bad, year >= 100) | `years = rnd(5) + 10 - D`; `hp = (rnd(5) + 10 + D) * 25` (Simple 275-375 ... Impossible 375-475); `dmg = 0` | Each turn (from the second): the **planet owner's** ships in orbit at the target planet fire (allies' and others' ships do not count): `dmg += sum_i rnd(hull_w[hull of design #0]) * ships_i` (**BUG**: always the first design's hull; weights 1/5/25/125; [Guide]: Small 1, Medium 5, Large 25, Huge 125 per ship per turn, reduced for ships with < 1/3 of their hull in weapons+engines) ; damage accumulates (`comet_dmg`, no regeneration); if `dmg > hp`: comet destroyed. Else `years -= 1`; at 0 the planet is destroyed (`game_planet_destroy`, type -> Not Habitable, growth hostile): colonists and buildings gone. AI: `crank_ship` | destroyed or impact |
| 8 | **Pirates** (bad) | needs victim with a trade partner; base at a random star (`rnd0(stars)`); `hp = (rnd(5) + 10 + D) * 30` (330-450 ... 450-570) | Each turn: all ships of all empires at the pirate star deal damage as for comets (a living Crystal/Amoeba there kills them instantly); `setback = hp/6` (%): for every empire pair whose fuel range covers the pirate star `trade_percent *= (100 - setback)/100` every turn (so trade efficiency collapses while they live). AI: `crank_ship` | `hp` reaches 0 |
| 9 | **Ancient derelict** (good, never for a human victim in code) | - | For the weapon and force-field fields: acquires the first entry of every research-list tier up to `percent/5 + 2` tiers (max 10 tiers) via normal research - i.e. many free techs ([Guide]: all W/FF techs on its Limited Research List up to 10 levels above current, max 10 techs) | instant |
| 10 | **Rebellion** (bad, human victims only, never the home planet) | - | `rebels = pop/2`, `unrest = Rebellion` on the chosen planet. Rebel planet: zero production, no council votes, needs troops (ground combat vs rebels, 5.5). [Guide]: spreads 1%/turn per rebelling colony; computer colonies spontaneously revolt 1%/turn; overthrow (coup) when half of an empire's planets rebel (the spread/spontaneous parts are not active in the v1.3 code) | resolved by troops / coup |
| 11 | **Space Crystal** (monster, year >= 200, only if no other monster alive) | spawns at a random map edge (7.4) | see 7.4 | killed / 5 planets destroyed |
| 12 | **Space Amoeba** (monster, same rules) | | see 7.4 | |
| 13 | **Fertile planet** ("Enviro", good) | planet type >= Minimal, not already Fertile/Gaia, special Normal or poor | `soil_enrich`: growth -> Fertile, `max_pop2 = max_pop1 + inc` with `inc = (max_pop1/20)*5 (+5 unless the quotient is a multiple of 5)`, min 5 (i.e. ~ +25% max pop) | instant |
| 14 | **Mineral-rich planet** ("Rich", good) | special Normal/Poor/Ultra-poor | `special = Rich` | instant |
| 15 | **Donation** ("Support", good) | any empire | `reserve_bc += max(500, (year/10)*100)` (turn 60 -> 600 BC; [Guide]: 10 x turn) | instant |
| 16 | **Depleted planet** ("Poor", bad) | special not already Poor/Ultra-poor, not Artifacts | `special = Poor` (also can hit Rich/Ultra-rich/4x-tech worlds) | instant |

AI hooks: plague and nova -> `crank_tech` for that planet, comet and pirates -> `crank_ship` (all sliders moved into tech / ships and 1/5 of the empire's reserve poured into the planet).

### 7.3 Event sequence inside the end-of-turn flow

Plague -> Quake -> Nova -> Accident -> Assassin -> Virus -> Comet -> Pirates -> Derelict -> per-planet Rebellion reports -> Crystal/Amoeba monsters -> Enviro -> Rich -> Support -> Poor -> **Genocide** check (an empire with 0 planets is eliminated) -> **Coup** check -> "Stars colonised" report -> Guardian killed report (gives Orion loot) -> Orion colonised report -> random statistics news (1/40 per turn after year 25 if no other news). A coup of the *last human* ends the game (Funeral) and skips the rest.

### 7.4 Space monsters (Crystal and Amoeba)

* Spawn (`game_monster_set_start`): random edge of the galaxy (left, top, right or bottom with equal chance), at a random position along it; its first destination is the star at that entry point (left edge: the first star of a random grid row; right edge: the last star of a random row; top/bottom edge: the star of a random column in the first/last row); `exists = 1, counter = 2, nuked = 0, killer = none`.
* **Movement**: only when `counter <= 0`; toward `dest` at **11 map units per turn** (5 + 6 in two animation frames) = the speed of a warp-1 ship ([Guide]: "warp 1; a 1-parsec border guarantees at least one turn of warning"). While waiting `counter` decrements each turn.
* **Arrival**: when `(x,y)` equals the destination star and `counter <= 0` and nobody killed it, in the event phase:
  * **Space Amoeba**: `pop = 0`, `factories /= 10`, planet becomes **Radiated** with `max_pop = rnd(3)*5 + 5` (10/15/20), colony destroyed (`game_planet_destroy`).
  * **Space Crystal**: `pop = 0`, `waste = max_pop3 - 10` (factories untouched); the colony is left with no population.
  Then `nuked += 1`, a new destination is chosen from the neighbouring grid cells (random step of -1/0/+1 column and row, rejecting off-grid cells, Not-Habitable systems and Orion), `counter = 4` (rests ~4 turns, [Guide]: 2-3 turns, then goes to a random star within 6 parsecs), news item. If the victim's last planet died: `kill_player` (fleets removed) and the news variant "colony eliminated".
* **Monster removal**: after it has destroyed 5 planets (`nuked > 4`), or when a fleet/base kills it (`killer = winner`). Only one monster alive at a time; each type appears at most once per game.
* **Combat**: battle occurs when the monster is *at* a star with ships/planet of any empire. v1.3: a monster that has settled (resting after an attack) cannot be attacked (option `monster_rest_att` would allow it); AI-vs-monster fights are auto-resolved with fixed weight 30000 (Guardian 100000).
* **Stats table** (`tbl_monster`, hull Huge, battle computer Mark X = attack level 10, maneuver/speed 2, missile shield 100):

| Monster | Simple | Easy | Average | Hard | Impossible | Notes |
|---|---|---|---|---|---|---|
| Crystal HP | 3000 | 4000 | 5000 | 6000 | 7000 | shield class V (absorb 5), Lightning Shield + Black Hole Generator specials, 10x Crystal Ray, beam/missile defense 1/2/3/4/5 ([Guide]: 4 attacks x 100-300 damage each, range 3, attack 10; takes 0 damage from Nuclear/Hyper-V missiles etc.) |
| Amoeba HP | 1000 | 2000 | 3000 | 4000 | 5000 | no shield, Adv. Damage Control, repair 50, 1x Amoeba Stream, defense 1/2/3/4/5 ([Guide]: 250-1000 damage, range 3; regenerates 300/600/900/1200/1500 per combat round - you must out-damage that; missile bases needed: e.g. Scatter X 1/2/2/3/4, Nuclear 25/50/75/100/125) |

### 7.5 Orion and the Guardian

* **Placement**: at galaxy creation one random star becomes **Orion**: name "Orion", type Terran, max population 120, growth Normal, special "4x tech" (research output x4; Psilon x1.5 on top; artifacts planets x2), `have_guardian = true`. No home world is ever placed on it (and the event engine never targets it).
* **Guardian** (monster id 2) sits in orbit until killed. While alive: transports landing at Orion arrive as 0 pop; every empire's ships still in orbit at Orion after the battle phase are removed at end of turn (so nobody can hold or colonise it without killing the Guardian). *Owning* Orion also gives its owner +20 vote weight with every AI voter at the Galactic Council (6.3).
* **Stats** [1oom `tbl_monster[GUARDIAN]`]: Huge hull, Battle computer Mark X (attack level 10), Jammer X, maneuverability/speed 2, extra range 3, weapons: Scatter Pack X-5 launchers, 1 Death Ray, Stellar Converters, Plasma Torpedoes; specials High Energy Focus + Lightning Shield.

| Guardian | Simple | Easy | Average | Hard | Impossible |
|---|---|---|---|---|---|
| Hit points | 2000 | 4000 | 6000 | 8000 | 10000 |
| Shield class (absorb) | V (5) | VI (6) | VII (7) | IX (8) | XI (9) |
| Beam defense / missile defense | 1 / 1 | 3 / 3 | 5 / 5 | 7 / 7 | 9 / 9 |
| Scatter Pack X-5 | 5 | 25 | 45 | 65 | 85 |
| Death Ray | 1 | 1 | 1 | 1 | 1 |
| Stellar Converter | 5 | 15 | 25 | 35 | 45 |
| Plasma Torpedo | 6 | 9 | 12 | 15 | 18 |
| Repair (original v1.3 data) | 0 | 0 | 0 | 15 + Adv. Damage Control (**BUG**) | 0 (**BUG: nothing**) |
| Repair (intended / 1.3a fix) | 0 | 0 | 0 | Automated Repair System (special 16), repair 15 | Adv. Damage Control (special 26), repair 30 |

([Guide] conflict: Guardian HP 6000/7000/8000/9000/10000 (+1000 per level, like the other monsters), shield/beam/missile level 5-9, average damage per turn tables 15-2; the weapon counts match exactly. 1oom's table gives 2000/4000/6000/8000/10000.)
* **Rewards** when the Guardian dies (`guardian_killer` = winner; GNN item, then `game_tech_get_orion_loot`): the **Death Ray** (weapon tech, not obtainable by research; [Guide]: tech level 36, 200-1000 damage per attack, range 1) plus up to **3 random technologies**: for each of 3 draws pick random field and `level = rnd(31)+19` (20..50) until `level <= min(current_field_level + 25, 50)`, the tech exists, and you do not own it (<= 200 tries per draw). Orion itself can then be colonised: Terran 120-pop world with 4x research.
* **AI**: AI scouts/colony ships ignore Orion until the Guardian is dead (scouts avoid it before year 150), AI attack targeting includes an owned Orion only after year 120; AI-vs-Guardian auto-resolution exists but AI fleets practically never go.
* Winning does not require the Guardian ([Guide] Afterword).

### 7.6 Artifact and special planets

* Generation (galaxy slice): a planet of type Minimal..Ocean with Normal special becomes **Artifacts** with 10% chance. Specials: Ultra-poor/Poor/Rich/Ultra-rich rolled from star colour; Orion is the only "4x tech".
* **Artifacts planet**: research output x2 on that planet; the first human to *scout/orbit* it with a ship (not by scanner) gets one free technology (`game_tech_get_artifact_loot`): random field, `level = rnd(30)`, limited to `min(current_percent + 10, 50)` and not owned (<= 200 tries). AI empires get nothing.
* **Special-planet effects as stated by the explore screen** (game strings): Ultra Poor - industry resource points cut to one-third; Mineral Poor - halved; Mineral Rich - doubled; Ultra Rich - tripled; Artifacts - research (technology points) doubled; Orion "4x tech" - research quadrupled. Growth line: Hostile environment - population growth halved; Fertile - +50% normal; Gaia - doubled.

---------------------------------------------------------------------------------------------------

## 8. VICTORY, DEFEAT, ENDING SCREENS, "SCORE"

### 8.1 End states and what causes them [1oom `game_turn_check_end`, `game_election`]

| End state | Trigger | Result |
|---|---|---|
| **WON_GOOD** ("peaceful unification") | Galactic Council elects the human (>= 2/3 of all votes) and he accepts | victory sequence "good" |
| **LOST_EXILE** | Council elects an AI and all humans accept the ruling | defeat sequence "exile" |
| **FINAL_WAR** (not an ending, a state) | a human refuses a council ruling (6.5) | game continues, no diplomacy; later WON_TYRANT / LOST_FUNERAL |
| **WON_TYRANT** ("conquest") | after the council/elimination checks only **one empire owns any planet** (`pi2 == none`), i.e. all rivals eliminated; reachable normally (2-player game, or all AIs destroyed) and after a Final War | victory sequence "tyrant" |
| **LOST_FUNERAL** | no human has an alive empire with at least one planet **not in rebellion** (all planets lost/rebelling), or the last human's empire is toppled by a coup (event phase) | defeat sequence "funeral" |
| QUIT | player quits | back to menu |

Check order each time it is run: (1) `end == LOST_EXILE` -> exile; (2) `end == WON_GOOD` -> good; (3) count owned planets per empire (and non-rebelling planets): if only one empire has planets -> tyrant (name/race of that empire); (4) if no human has alive + `good_planets > 0` -> funeral (news "<race> genocide" plus the funeral animation uses the banner colour of the *killer* (`human_killer`, or the first surviving empire) and of the dead empire). It is evaluated after the coup step, after random events, after the council and after AI-initiated audiences. Elimination of an AI: empire with 0 planets (event "genocide" check): if some empire has ships at / owns what used to be its planets that empire is the "killer" (news + `diplo_act(-36)` from the killer toward everyone else); the victim is removed (`kill_player`: home := none, fleets removed, refuse flag cleared).
Two empires only (`num_alive <= 2`): **no council**, the only way to win is elimination ([Guide]).
Quirk: copy-protection prompt appears from year 41 with 1/30 chance per turn (original DRM; skip in a reimplementation).

### 8.2 Ending presentations (UI facts, text paraphrased)

All endings play over a scrolling starfield with fades; any key/Esc skips.
* **Good victory** (music 2): 150-frame scene with a ship and a planet sliding in: "Escorted by an Honor Guard, High Master <name> returns to Orion, throne world of the Ancients"; second line "The Galactic Imperium has been reformed"; 20-frame full-screen "winning" picture; 80-frame race-specific face animation with the lines "A new era has dawned. We must set aside our past conflicts and greet a new millennium as a united galaxy." Then a **GNN news screen** (70 iterations, ~210 ticks) with the closing anchor line "And that's the way it is..."
* **Tyrant victory** (music 2): same three-phase structure; text: "The universe is mine and all shall bow before the might of <name>, Master of Orion." / "Master of the Universe..."; final **GNN** line: "Oh well, another millennium serving under a ruthless tyrant..."
* **Exile defeat** (music 3): 380-frame scene (ship crossing the starfield): "Exiled from the known galaxy, Emperor <name> sets forth to conquer new worlds, vowing to return and claim the renowned title of Master of Orion..." (the name shown is the first surviving human other than the winner). No GNN screen.
* **Funeral defeat** (music 3): no text; 186 frames of a coffin and mourners marching across the screen; the banner colours of the killer and of the dead empire are used for the flag / coffin graphics.
* No scoring or statistics screen follows any ending.

### 8.3 There is **no numeric score** in MOO1 v1.3

Neither the code nor [Guide] define a score. The only composite ranking is the **Racial Stats ("Status") screen** (and the same ranking is used for the random GNN "rankings" item). Five bars, each 0..100 pixels, plus "Total Power" = sum of the five normalised so the best empire = 100:

| Bar | [1oom] formula | [Guide] Table 15-3/15-4 |
|---|---|---|
| Fleet | `sum = min(3,250,000, sum(count_i * hull_w[hull_i]))` over all designs (hull_w 1/5/25/125); then `va=125; k=0; while sum > va: sum -= va; k++; ve=va; va*=2; px = sum*10/(va-ve) + 10*k`, clamp 0..100 | 10 px per doubling bracket: px 1-10 = 12.5 pts each (125), 11-20 = 25 each (cum 375), 21-30 = 50 each (875), ... 91-100 = 6400 each (cum 127,875); colony ships excluded; a 10-px lead = twice the fleet. (conflict: the code as written divides by `va-ve` = half the bracket width, making px overlap/non-monotone at bracket edges; implement the guide's monotone version unless bug-compat is wanted) |
| Technology | `sum of six tech levels`, then **/3** in the stats screen | `(sum of six levels)/6 + 1` |
| Production | gross BC (incl. trade, excl. tribute): `va=100; while prod > va: prod -= va; k++; ve=va; va*=2; px = prod*10/(va-ve) + 10*k` | px 1-10 = 10 BC each, 11-20 = 20 each, 21-30 = 40 each ... 91-100 = 5120 each |
| Population | `total_pop / ((stars*3)/2 + 1)` | `(total_pop / stars) * 1.5 + 1` (e.g. 612 pop, 48 stars -> 20 px) (conflict: code gives 8) |
| Planets | `owned_planets*100 / (stars+1)` | `colonies / stars * 100` |
| Total | `sum_of_five * 100 / best_sum` | same, "strongest = 100 px" |
Only races you are in contact with are listed. GNN "stats" news ranks empires by production / population / technology / fleet with the same functions (value min 1; only empires with a home planet).

---------------------------------------------------------------------------------------------------

## 9. DIFFICULTY LEVELS (Simple / Easy / Average / Hard / Impossible)

Difficulty is chosen at game creation (index d = 0..4), independent of galaxy size (24/48/70/108 stars) and number of AI opponents (1..5). The difficulty-dependent numbers found in the engine are the ones below (verified in [1oom] unless marked); no difficulty-dependent vision/movement cheat was found in the code ([Guide] says AIs always "know" about approaching enemy ships even outside scanner range, but not their ETA). **Higher levels do not make the AI smarter, they mostly make its economy cheat and make events/monsters harder.**

### 9.1 Master table (v1.3 code, "Classic")

| Item | Simple (0) | Easy (1) | Average (2) | Hard (3) | Impossible (4) | Where |
|---|---|---|---|---|---|---|
| **AI production multiplier** (applied to every AI planet's pre-reserve output `factories + planetology extra`, integer math) | x1.00 (default branch; see note) | x0.80 (`v*4/5`) | x1.25 (`v + v/4`) | x1.50 (`v + v/2`) | x2.00 (`v + v`) | `game_update_production` |
| **Human research cost multiplier** (RP = tech^2 x racial% x mult/100; racial% e.g. 100) | 20 | 25 | 30 | 35 | 40 | `tech_costmuld` |
| **AI research cost multiplier** | 20 | 20 | 20 | 20 | 20 | `tech_costmula` ((conflict: [Guide]: AI always uses 30)); AI first-tech cost uses a different (higher) formula in v1.3 (`tech*tech*50`; fixed by `ai_first_tech_cost_fix`) |
| **AI missile-base cost** (min 50 BC) | x1.0 | x0.9 | x0.8 | x0.7 | x0.5 | `game_get_base_cost` ([Guide] same) |
| **Start (every empire)**: homeworld pop / factories / initial production | 50 / 30 / 55 | 50 / 30 / 55 | 50 / 30 / 55 | 40 / 30 / 50 | 40 / 30 / 50 | `game_generate_home_etc` |
| **Event chance factor** (applied to turns-since-last-event / 512) | 1/2 | 2/3 | 3/4 | 4/5 | 1 | 7.1 |
| Plague cure cost (x planet production) | (1..8) | (3..10) | (5..12) | (7..14) | (9..16) | `rnd(8)+2d` |
| Nova: years / cost multiplier | 11..15 / 11..15 | 10..14 | 9..13 | 8..12 | 7..11 | `rnd(5)+10-d` |
| Comet: years / hit points | 11..15 / 275..375 | 10..14 / 300..400 | 9..13 / 325..425 | 8..12 / 350..450 | 7..11 / 375..475 | `rnd(5)+10-d`, `(rnd(5)+10+d)*25` |
| Pirates hit points | 330..450 | 360..480 | 390..510 | 420..540 | 450..570 | `(rnd(5)+10+d)*30` |
| Crystal / Amoeba / Guardian HP | 3000 / 1000 / 2000 | 4000 / 2000 / 4000 | 5000 / 3000 / 6000 | 6000 / 4000 / 8000 | 7000 / 5000 / 10000 | 7.4, 7.5 |
| AI war pile-on on a human with relation < -30 | off | off | on if human has < 2 wars | < 3 wars | < 4 wars | 4.6.5 |
| AI may cancel NAP/alliance (war_do) | no | no | yes | yes | yes | 4.6.5 |
| Erratic AI sudden war chance (per turn per human) | 0 | 1/300 | 2/300 | 3/300 | 4/300 | 4.6.5 |
| AI-AI interaction frequency (per pair per turn) | 1/15 | 1/13 | 1/11 | 1/9 | 1/7 | 4.7 |
| AI-AI negative DP divisor after year 100 | /1 | /1 | /2 | /2 | /3 | `diplo_act` |
| "Too many big planets" pressure divisor `galaxy_size + 6 - d` | size+6 | size+5 | size+4 | size+3 | size+2 | 4.2.3 block C |
| AI free ("magic") colony ship each turn chance | `prod/500`, but `prod := 0` with prob 5/6 | 4/6 | normal | normal | normal | `prod = min(500, max(1, 2*AI_production/5))` |
| AI "need to conquer" (attack neutral-treaty planets) chance per turn | 1/8 | 1/7 | 1/6 | 1/5 | 1/4 | `send_scout` |
| AI tax (per mille of production, from year 20) | rnd(10)+2 | +3 | +4 | +5 | +6 | `turn_p1_tax` |
| AI security spending base (per mille) | 0 | 8 | 16 | 24 | 32 | `ai_p3` |
| AI research pick: chooses the highest-tier candidate with prob (d-1)/6 for d>=1 (else random candidate) | 0 | 0 | 1/6 | 2/6 | 3/6 | `tech_next` |
| AI battle-retreat "morale" term `v = (5-d)*5 + 5 (+10 / +20 if a planet is on the AI's side) + rnd(15)` used in `w_L = dmg_L*100*v/hp_L` vs `w_R = dmg_R*100/hp_R` (retreat if `w_R > w_L`; which side is the AI's is unverified) | 30 | 25 | 20 | 15 | 10 | `battle_ai_retreat` |
| AI shifts defense->ship sliders when `bases*3 >= pop/(5-d)` | pop/5 | pop/4 | pop/3 | pop/2 | pop/1 | `ai_p3` |

Note on production: the `default` branch of the v1.3 switch leaves **Simple at x1.0 but Easy at x0.8** (1oom comments "TODO BUG? simple has larger v than easy"). Production-bonus applies only to the AI's *gross factory/planet output*, not to trade income.

### 9.2 [Guide] Table 15-1 (design values, partly conflicting)

| Item | Simple | Easy | Average | Hard | Impossible |
|---|---|---|---|---|---|
| CPs break treaties with you | no | no | yes | yes | yes |
| Asking-check bonus toward you (AI proposals) | +50 | +40 | +30 | +20 | +10 |
| Negative DP between CPs multiplied by | 1 | 1 | 1 | 2/3 | 1/2 |
| Undecided-voter bonus (council) for human | 12.5% | 10% | 7.5% | 5% | 2.5% |
| CP fleet advantage needed before declaring war on you | 7:1 | 6:1 | 5:1 | 4:1 | 3:1 |
| Your firepower advantage before CPs consider retreating | 4:1 | 4:1 | 5:1 | 6:1 | 7:1 (retreat automatically at 10:1) |
| CP missile base cost | 100% | 90% | 80% | 70% | 50% (min 50) |
| CP production | -20% | -10% | normal | +25% | +50% |
| CP base chance to expand peacefully | 10% | 20% | 30% | 40% | 50% (doubled for Aggressive/Expansionist) |
| Your research cost multiplier | 20 | 25 | 30 | 35 | 40 |
| CP chance to expand when fenced in | 1/10 | 1/9 | 1/8 | 1/7 | 1/6 |
| Monster toughness | +1000 HP per level for Amoeba, Crystal and Guardian | | | | |
[Guide] also: "Charge!": before the first council AIs attack at ~2:1 firepower advantage, after it ~1:1, in final war almost recklessly; CP spy and tax behaviours not difficulty dependent. The code-vs-guide production table is the most important conflict: v1.3's AI gets **+25% / +50% / +100%** at Average/Hard/Impossible (not 0/+25%/+50%), and Simple is not handicapped. [LP] (Update 01, author "from memory, IIRC"): production/tech handicaps on low levels and bonuses on high levels of "20% for Easy/Hard and 40% for Simple/Impossible" - unreliable, but it does confirm that **homeworld starting population is 50M on Average or below and 40M on Hard/Impossible**, that all empires start at yellow stars, and that opponents can be 1-5.

---------------------------------------------------------------------------------------------------

## 10. AI BEHAVIOUR OVERVIEW ("Classic" engine, v1.3) [1oom `game_ai_classic.c`]

### 10.1 Structure: three AI phases per turn + diplomacy

| Phase | Frequency | Content |
|---|---|---|
| `turn_p1` | every turn, every AI | threat tables, territory centres, scouting, "fronts", colony ships, attack/defence/idle fleet sending, transports, emergency defence, tax |
| `turn_p2` | per AI every `rnd(12)+8` turns (9..20; first after `rnd(10)`) | ship-design maintenance (scrap old, create new designs), choose what each planet builds |
| `turn_p3` | every turn; slider reset when its countdown (`rnd(5)+1` = 2..6 turns; first 15..20, or 25..30 if the home star has no good neighbour) expires | planet sliders, tech sliders (every 10 years), security/spy settings |
| diplomacy | every turn | 4.6 (to humans) and 4.7 (AI-AI) |

### 10.2 Research

* **Start**: for each field the AI picks a random non-zero tier-0 candidate (`researchlist[field][0][rnd0(3)]`, re-roll on 0); first-tech cost `tech^2*50` (higher than normal; v1.3 quirk).
* **Initial allocation**: homeworld with > 1 other habitable (type >= Minimal) planet within 30 map units: planet sliders Ship 10 / Defense 0 / Industry 90 / Eco 0 / Tech 0, tech sliders Computer 20, Construction 20, Force Field 0, Planetology 40, Propulsion 20, Weapon 0. Otherwise (isolated start): Ship 0 / Def 0 / Ind 60 / Eco 10 / Tech 40 and 100% Propulsion.
* **Per-field spending** (`year % 10 == player index`, i.e. each AI re-decides every 10 years, staggered): all six tech sliders = 5, one field gets **75**:
  * year < 30 and 50%: Propulsion.
  * else with probability 1/4 the **racial focus**: Bulrathi/Mrrshan -> Weapon, Darlok -> Computer, Meklar -> Construction or Planetology (50/50), Alkari -> Propulsion, Sakkra -> Planetology.
  * else d16 roll against objective weights (table 10.3): Computer, Construction, Force Field, Propulsion, Planetology (in that cumulative order), remainder = Weapon.
* **Next project**: when a project completes the AI chooses among the next researchable techs of that field (tiers up to `(highest level-1)/5 + 2`, at most 12 candidates, from its Limited Research List; fallback "advanced" steps of 5): highest-tier candidate with probability `(difficulty-1)/6` (0 below Average), otherwise a uniformly random candidate. The AI researches one project per field with all that field's RP and gets no catch-up logic for weak research lists ([Guide]).
* Tech output uses the normal formula (planet output x slider, Psilon x1.5, Artifacts x2, Orion x4); AI research cost multiplier see 9.1.

### 10.3 Production / planet sliders (`ai_p3`, 2..6-turn cycle)

Raw table `ai_p3_tbl_w[row][9]` from the source (columns 0-3 = Ship, Defense, Industry, Eco; columns 4-8 = Computer, Construction, Force Field, Planetology, Propulsion). Row = the AI's objective (trait2); the **War row** is used instead whenever the AI has *any* treaty >= War:

| Row | c0 Ship | c1 Def | c2 Ind | c3 Eco | c4 Comp | c5 Constr | c6 FF | c7 Planet | c8 Prop |
|---|---|---|---|---|---|---|---|---|---|
| Diplomat | 1 | 2 | 4 | 1 | 2 | 2 | 4 | 2 | 3 |
| Militarist | 4 | 1 | 2 | 1 | 3 | 1 | 4 | 2 | 1 |
| Expansionist | 2 | 4 | 1 | 1 | 1 | 1 | 3 | 5 | 2 |
| Technologist | 1 | 2 | 3 | 1 | 4 | 2 | 3 | 2 | 2 |
| Industrialist | 1 | 2 | 4 | 1 | 1 | 5 | 4 | 1 | 2 |
| Ecologist | 1 | 1 | 2 | 4 | 1 | 2 | 4 | 1 | 5 |
| War | 4 | 1 | 1 | 1 | 2 | 2 | 4 | 2 | 1 |

**Slider chunk roll** (`rnd(13)`): thresholds `w_ship = c0`, `w_def = c0+c1`, `w_ind = w_def+c2`, `w_eco = w_ind + c2` (**BUG**: column 3 is never used, Eco reuses the Industry weight), anything above -> Tech. Effective chunk probabilities (out of 13): Diplomat Ship 1 / Def 2 / Ind 4 / Eco 4 / Tech 2; Militarist 4/1/2/2/4; Expansionist 2/4/1/1/5; Technologist 1/2/3/3/4; Industrialist 1/2/4/4/2; Ecologist 1/1/2/2/7; War 4/1/1/1/6.
**Tech-field roll** (`rnd(16)`, every 10 years): cumulative thresholds `Computer = c4`, `+Construction c5`, `+Force Field c6`, `+Propulsion c8`, `+Planetology c7`, remainder **Weapon** (16 minus the sum). Effective weights (out of 16): Diplomat Comp 2 / Constr 2 / FF 4 / Prop 3 / Plan 2 / Weap 3; Militarist 3/1/4/1/2/5; Expansionist 1/1/3/2/5/4; Technologist 4/2/3/2/2/3; Industrialist 1/5/4/2/1/3; Ecologist 1/2/4/5/1/3; War 2/2/4/1/2/5. ([Guide] Table 11-8 gives priority *lists* per objective - planet-spending ranks are rolled on a d15 with weights 5/4/3/2/1 for rank 1..5, tech-sector ranks on a d16 with 5/4/3/2/1/1 for rank 1..6 (Technologists research all six sectors roughly evenly) - and a peace-time planet-spending ordering per objective: Diplomat Tech>Ind>Def>Ship>Eco; Ecologist Eco>Tech>Ind>Def>Ship; Expansionist Tech>Def>Ship>Ind>Eco; Industrialist Ind>Tech>Def>Eco>Ship; Militarist Ship>Tech>Ind>Def>Eco; Technologist Tech>Ind>Def>Eco>Ship; at war all: Ship>Tech>Ind>Def>Eco; every sector gets >= 5% (tech >= 20%) and the remaining 60% in 5% clicks reassigned every 3-18 turns - the v1.3 code uses the chunk scheme above instead.)

Per planet, on a cycle: keep the Eco slider, then `Ship=Def=Ind=Tech=0`; `Ship=5 if Eco<96`; `Def=5 if Eco<91`; `Ind=10 if Eco<81`; `Tech=25 if Eco<71`; if `pop < 3/4 max_pop`: `Ind=50`; racial adds: Bulrathi/Sakkra `Eco += 10` while `pop < max_pop2`; Klackon `Eco += 15` (same condition); Meklar `Ind += 20`; Psilon `Tech += 20`; Mrrshan `Ship += 15`; planets with Artifacts or 4x-tech `Tech += 20`; Rich+ planets `Ind += 20, Ship += 10`. The remaining percent is dealt in chunks `min(rnd(8)+2, left)` to Ship/Def/Ind/Eco/Tech by the weights above.
**Every turn** per planet: if `factories >= pop * robotic factor` the Industry slider is moved half to Defense and half to Tech; if the planet has > 4 missile bases and `bases*3 >= pop/(5-d)` and its shield is up to date the Defense slider moves to Ships (**BUG** v1.3: it doubles the Ship slider instead - `ai_fleet_cheating_fix`). Planets under attack (hostile fleet en route to them) switch Def/Ind/Tech into Ships and receive 1/5 of the empire's reserve; planets with `pop < 20` also get 1/5 of the reserve ("fund developing"). What each planet *builds* is chosen by `turn_p2`: designs are sorted by design year (newest first; the colony-ship design is forced to year 0 so it sorts last) and each planet's `buildship` is one of the **three newest designs picked at random**, or - with 50% - a **Stargate** if the planet lacks one and the empire has the tech. The colony design is therefore never built in practice (colony ships come "by magic", 10.4).
Tax: from year 20 `tax = rnd(10) + d + 2` per mille of production (0 before).

### 10.4 Exploration and colonisation

* **Scouts**: one fleet per unexplored star in fuel range that has no foreign ships (and is not Orion, not within a recent AI destination); the nearest owned orbit with ships supplies `ships/4 + 1` of its first suitable design.
* **`have_colonizable` / `need_conquer`**: if any unowned planet with type >= the AI's best colonisable type (and not guarded Orion) is within range, expansion stays peaceful; otherwise with probability `1/(8-d)` per turn the AI sets `need_conquer`, which makes non-hostile empires' planets valid attack targets.
* **Colony ships**: the AI "builds" colony ships by magic - each turn, if at least one colonisable target exists, with probability `min(500, 2*production/5)/500` a free colony ship appears at a random front planet (Simple/Easy additionally lose this roll 5/6 and 4/6 of the time); at most 3 colony ships in stock are needed: once `shipcount > 3` it stops spawning/sending (**BUG "4-colony curse"**). Expansionists always send; others hold back **only if** a human is in contact and more than half of their planets are "developing" (few bases, pop < 2/3 max).
* **Targets**: all unowned planets in fuel range with `type >= best colonisable type`, not already targeted by an AI fleet, nearest source orbit within `fuel_range*15`; Silicoids can colonise anything (`Radiated`). Fleets are sent one per target.
* **Transports**: planets with `pop >= max_pop/2` and `pop > 20` send `pop/2` to the nearest enemy-owned (no alliance, no ceasefire) planet under their ships; planets with `pop > 3/4 max_pop` send `pop/3` to colonies below 1/3 max_pop or in rebellion within `bestspeed*20+20`. Bombing: the AI bombs when planet pop > inbound transport pop (Bulrathi's estimate is x1.2).

### 10.5 War targeting and fleet movement

* Each AI builds "fronts": one per contacted rival (excluded: allies in a final war), located 40% of the way from its territory centre toward the rival's centre, merged when closer than `bestspeed*10+10`; each front is attached to the nearest own planet (preferably one with a single defender); front relation weight = `min(rel1, 0)` + share of own threat (`tbl_force_own*100/sum`).
* **Attack**: candidate enemy planets (owner at war with the AI, or `need_conquer`, or game ended; within fuel range; type colonisable; Orion only after year 120) sorted by weight `pop - 10*bases + special_bonus` where `special_bonus = (special-2)*20 + special*10 + 20`. For each front: pick the first candidate within range (`< fuel_range*15`) passing `rnd(100) < 40` (or only one candidate) whose defence weight (enemy ships' threat + `(weapon%*5 + (planet shield+10)*10) * bases`) is less than the AI's force at that front -> send the fleet (and if the target owner is an ally/NAP partner of the AI it *breaks the treaty first*: alliance 1/4 (5/8 when Expansionist), NAP 1/2 (certain when Expansionist), then rel1 capped to 30/20; if the roll fails no attack is launched at that target this turn). Second pass: from any foreign planet where the AI has force, attack the first candidate passing `rnd(100) < 60` if `1.5 * force > defenders`.
  ([Guide] describes the same decision differently: target value in "expansion mode" = max population + planet-type bonus, in "rampage mode" = (factories + bonus)/2, with bonus rich +100, ultra-rich +130, artifacts +70, Orion +140, poor -100, ultra-poor -130; value multiplied by a power ratio and divided by the attacker's travel turns; the best target gets a 30% chance, then the next, etc.; "CPs never attack a colonised world while uncolonised planets remain unless already at war with its owner" - the code's `special_bonus` is rich +100, ultra-rich +130, artifacts +70, 4x +160, normal +40, poor +10, ultra-poor -20.)
* **Defend**: planets with `1.33*own force < incoming threat` (transports count `pop*medium hull weight`; planets with < 5 bases and no ships have threat 50) are "defended" by sending idle fleets from other planets within `bestspeed*30+20` if `5/3*threat < force`.
* **Idle**: fleets not needed are sent to the front planet minimising `dist*10/bestspeed + front relation` (only if the AI has < 8 fleets en route); fleets below `force_own_sum/25` (halved after a council, halved again in final war) stay home.
* The AI is never "afraid" of the human's stack size when attacking colonies: it needs only `force > defenders` ([Guide]: CPs attack at roughly 2:1 firepower before the first council, 1:1 after, "reckless" in final war). It sends the maximum possible invasion: half the assembly planet's population (rounded down); bombards until transports exceed the planet pop.

### 10.6 Fleet composition and ship design

* Designs are re-evaluated every 9..20 turns: designs older than 50 turns (while year < 100) or older than 100 turns are scrapped while more than 1 design has ships; if more than 4 designs have ships the oldest design is dropped, otherwise the first design with no ships; then new designs are generated until all 6 slots are full: slot types = **colony ship** (must exist), **bomber** (must exist), others **fighters/warships**. [Guide]: "a new design every 6-15 turns, minimum one colony and one bomber design, otherwise a mix of beam and missile ships; unarmed ships retreat; AIs do not avoid pulsar-armed ships well".
* **Hull**: colony ships Large; others `hull = tbl_hull[clamp(rnd0(12) + race_adj, 0, 11) (+1 if any human ship has a Pulsar)]` with `tbl_hull = {Small, Medium, Medium, Medium, Large, Large, Large, Large, Large, Huge, Huge, Huge}` (index 0 -> Small, 1-3 Medium, 4-8 Large, 9-11 Huge) and race adj `Silicoid +3, Bulrathi +3, Meklar +3, Alkari -3, Klackon -3, others 0`. [Guide]: size roll d12: 1 small, 2-4 medium, 5-9 large, 10-12 huge.
* **Equipment chances by hull (Small, Medium, Large, Huge)**: engine = best available with 60% per step down; battle computer chance 10/20/35/50; shield 5/15/40/70; armor (odd tier kept) 1/2/4/8; man (bridge/auxiliary) 30/20/20/15; ECM jammer 2/8/20/30; special slots rolled per (special id, hull) from a 31x4 chance table (values 0..80, listed in 13.4); weapons: second weapon 0/50/75/100%, third 0/0/50/100%, fourth 0/0/25/50%; each weapon slot gets a random 40-100% share of what fits (single-weapon ships 100%); a bomb is only allowed in slot 0 of a bomber; designs that pair High Energy Focus with missiles/bombs or an Oracle Interface with missiles are rejected and re-rolled. Colony ships: colony base special + reserve fuel tanks if Construction > 5, no weapons.
* Other: the AI also spends reserve (1/5 chunks) on threatened planets; after human ships with Warp Dissipators exist its designs prefer range-2 beam weapons.

### 10.7 Tactical behaviour (summary)

* **Off-screen AI-vs-AI fights**: each side's "power" = `sum(count * design_weight)`, `design_weight = hull_w * (shield*5 + computer*5 + weapon1_id + armor*10 + (special_i)*2*3 + construction%/2 (+15 Mrrshan/Alkari))` plus `bases*75*(weapon%+forcefield%)` for a defending planet; monsters weigh 30000 (Guardian 100000). Rounds alternate: each side removes `max(1, rnd(10)% of its own power)` from the other until one side is 0; survivors scale proportionally. [Guide]: "each hit = 1-10% of current power".
* In real battles: AI retreats when its estimated damage ratio is unfavourable (retreat formula in 9.1), unarmed ships retreat at the first chance, never withdraws the player's ships on AUTO, fires missiles only when it expects a kill and can reach, sticks to chosen targets, may use stasis only when >= 2 other ships are free.
* Bombard/invade decisions: see 10.4.

### 10.8 Treaty keeping / diplomacy summary for AI design

* AI breaks NAP/alliance only at difficulty >= Average and then only by the `war_do` rolls (per qualifying check: alliance 1/4, NAP 1/2; Expansionist objective: alliance 5/8, NAP certain); it also breaks the treaty before attacking a treaty partner's planet (10.5).
* AI keeps relations by passive gains (+rnd(3)/+rnd(6) per turn at 50%), never proposes anything while one of its fleets is flying to your colonies, rarely proposes (~0.5% base per turn), offers sweeteners only with the less hostile personalities (Aggressive...Pacifistic).
* AI-AI blocs: alliances propagate wars automatically (4.7).

---------------------------------------------------------------------------------------------------

## 11. GNN (GALACTIC NEWS NETWORK) AND THE END-OF-TURN FLOW

### 11.1 How GNN is presented [1oom `uinews.c`]

* Full-screen "newscast": an animated **newsdroid anchor** at (14,14), an animated spinning world at (76,36), a news-type icon at (208,38) (icon = item `3 + news type` of `NEWSCAST.LBX`, none for the end-game screens), a text panel (black box x 32-287, y 142-182, text wrapped at 245 px starting at (38,145)). Music track 9 during the intro.
* First item of a turn: a 25-frame TV-set intro (TV frame, anchor fade-in) and a pixel-scramble transition; any further item the same turn first shows an "**Also in the news...**" banner (5 x 3 ticks) and cross-fades. Each item waits for a key/click. Items only appear if the *player* should see them (see subtype rules below); AI-only events are mostly reported as "other empire" variants.
* **Statistics items** show a ranked list of up to six empires (race names), 3 rows per column, columns 122 px apart.
* Closing items after victory: "And that's the way it is..." (good) / "Oh well, another millennium serving under a ruthless tyrant..." (tyrant); 70 iterations (~210 ticks).
* Message text = template from `EVENTMSG.LBX[type][subtype]` with placeholder codes: planet name, number 1, number 2, plural suffixes ("s"/"n"), race name, race of `num2`, terraform field, tech name (category*50+index), trait names, emperor name. The 1993 texts themselves are not available outside the LBX; paraphrased examples below are inferred from the data each item carries.

### 11.2 News types (22) with subtypes and carried data [1oom `game_news.h`, `game_event_run`]

`H` = affected empire is a human (extra detail/warnings), `AI` = report about another empire.

| # | Type | Subtype -> meaning (data carried) | Paraphrased example (inferred) |
|---|---|---|---|
| 1 | PLAGUE | 0 outbreak on your planet (H) / 4 outbreak on another empire's (AI); 1 progress (H only, ~10% of turns) (num1 = pop lost this turn, num2 = research still needed); 2 cured (H) / 5 cured (AI) | "A deadly plague strikes <planet>. The colony loses population every turn until a cure costing N research points is found." |
| 2 | EARTHQUAKE | 0 (H) / 4 (AI): num1 pop killed, num2 factories destroyed | "An earthquake devastates <planet>: N colonists and M factories lost." |
| 3 | SUPERNOVA | 0/4 warning (num1 years left, num2 research needed to stabilise); 1 progress (H, when years < 3 or ~10%); 2 stabilised (H) / 5 (AI); 3 star exploded (H) / 6 (AI) | "The star at <planet> is about to go nova in N years unless reatomizer research (M RP) is completed." |
| 4 | INDUSTRIAL ACCIDENT | 0 (H) / 4 (AI) at the accident; 1 (H) / 5 (AI) when the waste is cleaned | "An industrial accident has poisoned <planet>; its maximum population is halved." |
| 5 | ASSASSIN | 0 (num1 = assassin's race) | "Assassins from the <race> have murdered <our leader>; war!" |
| 6 | COMPUTER VIRUS | 4 (always; num1 = field, num2 = research lost) | "A virus has wiped out all <field> research in progress." |
| 7 | COMET | 0/4 warning (num1 years, num2 % damage so far); 1 progress; 2 destroyed in time (H) / 5 (AI); 3 hit (H) / 6 (AI) | "A comet is heading for <planet>; N years to impact (X% destroyed)." |
| 8 | PIRATES | 0 pirates appear (num1 = trade loss %); 1 progress (~10% of turns); 2 pirates destroyed | "Space pirates are raiding trade; trade has fallen N%." |
| 9 | ANCIENT DERELICT | 0 | "An ancient derelict has been found by the <race>; their scientists gain weapon and shield secrets." |
| 10 | REBELLION | 0 one planet rebels (H) / 3 (AI); 1 several planets rebel (H) / 4 (AI); 2 rebellion resolved (H) / 5 (AI) (num1 = rebels) | "Rebels seize <planet>!" |
| 11 | SPACE CRYSTAL | 0 appears; 1 killed by <race>; 2 vanishes; 3 destroys a colony; 6 destroys an empire's last colony | "A giant space crystal has appeared / has destroyed <planet>." |
| 12 | SPACE AMOEBA | same subtypes as crystal | |
| 13 | FERTILE PLANET ("Enviro") | 0 (H) / 4 (AI) | "<planet>'s soil has become unusually fertile." |
| 14 | MINERAL-RICH PLANET | 0 / 4 | "Rich mineral deposits discovered on <planet>." |
| 15 | DONATION ("Support") | 0 (H) / 4 (AI); num1 = BC | "A wealthy benefactor donates N BC to the <race>." |
| 16 | DEPLETED PLANET ("Poor") | 0 / 4 | "<planet>'s minerals are being exhausted." |
| 17 | ORION | 0 (num1 = player) - "<race> has colonised Orion" (shown only with the `news_orion` fix; the original has the item but never shows it) | |
| 18 | COUP / leader overthrown | 0 or 1 (random variant) (num1 = new trait1, num2 = new trait2) shown to humans in contact; 2 your own empire toppled (ends game) | "A coup in the <race> empire: a <personality> <objective> leader takes power." |
| 19 | STARS REPORT | subtype 0..3 (= 12.5%, 25%, 37.5%, 50% of all stars colonised by the leading empire; triggers when leader planets >= (k+1)*half/4, k = 0..3, half = stars/2; report 3 also at half-2); num1 = planet count, race = leader | "The <race> now control N colonised systems." |
| 20 | RANKINGS ("Stats") | 0 production, 1 population, 2 technology, 3 fleet; ranked list of empires with a home | random filler: after year 25, if no other news this turn and `rnd0(40) == 0` |
| 21 | GENOCIDE | 0 empire eliminated (race, num2 = killer); 3 = the human is eliminated (game over) | "The <race> have been wiped out by the <killer>." |
| 22 | GUARDIAN KILLED | 0 human killed it / 1 an AI did | "The Guardian of Orion has been destroyed by the <race>!" |

### 11.3 Everything the player sees after pressing "Next Turn" (order)

Combined from [Guide] Appendix A (Next Turn Sequence of Play) and the 1oom turn loop:

1. **AI preparation** (invisible): AIs plan fleets/colonies/ship designs/sliders (6..15-turn design cadence).
2. **Income and growth** (invisible): transports leave (cost deducted), production executes, population grows, research interest accrues and research points added, trade grows, new spies bought.
3. **Automatic diplomatic adjustments** (invisible): love meter drifts, DP for treaties/trade, penalties for border build-ups and big empires, temp modifiers move 10 toward zero [in code toward +100].
4. **New ships and bases** appear; economic adjustments (taxes to reserve, factories built).
5. **Movement**: all fleets move simultaneously (animation of your fleets/transports/monsters, up to 20 frames) -> **space battles** (tactical combat screen or auto-resolve; retreat results).
6. **Spying**: for each of your successful spy missions you pick the stolen technology field / sabotage target; notices for enemy thefts ("<race>/Unknown spies steal the plans for <tech>") and sabotage reports.
7. **Research**: each discovery pops a "**<race> scientists achieve a <field> breakthrough**" screen (new tech name, description; some techs add an adjust dialog: reduce waste yes/no, or a "shift 25/50/75%" slider dialog for robotics, terraforming, force fields, soil enrichment, atmosphere); fields without a project then ask you to pick the next one; AI discoveries trigger their spy reassessment. Tech gained by trade/spying/ruins/Orion/artifacts uses the same screen with other headers ("<race> scientists reveal their <field> secrets", "Scientists discover ...").
8. **Exploration**: arriving at a new star shows the planet screen (type, size, growth/special lines; "Scout ... explore" / "Scanner ... explore" / "Colony ship: build a colony here? Yes/No"); artifact planets give their free tech here.
9. **Bombardment, transports landing, ground combat**: bombardment screen, landing animation, ground battle with casualties; conquered tech report.
10. **Coup** check (state change only; a human coup = game over).
11. **Random events** phase (GNN newscast items, 11.2), followed - in the engine's order - by the genocide report ("<race> eliminated" GNN item; [Guide] lists the genocide check before the events), coup announcement, stars report, Guardian/Orion reports and the random rankings item.
12. **First contacts and diplomacy**: contact notices; AI-initiated audiences (11.4) one by one; the **High Council** convenes when due ("usually in years divisible by 25"; election screens); contact-lost notices.
13. **Economic announcements**: "New ships" report (grid of finished designs with counts) and the main-map **build-finished list** (11.5) so sliders can be re-adjusted.
14. **Housekeeping**: star info refresh, year +1, tech levels recomputed, autosave (and, rarely, the copy-protection prompt).

### 11.4 AI diplomatic audience popups (types 4.8)

For every AI with a queued `diplo_type != 0`, in AI index order: the audience screen (emperor banner top-left, alien portrait centre with animation 0-5 and race music), the greeting/message text, then the player's options (proposals: Accept/Reject; tech lists; "Agree/Forget It"). A "Diplomat Gone" or "Not now" message ends the audience immediately.

### 11.5 Planet "finished" notifications (main-map list, `game_planet_get_finished_text`)

| Kind | Trigger | Text pattern (paraphrased) |
|---|---|---|
| Industry maxed | factories reach `max_pop3 * robotic factor` (and the IND slider is switched off automatically) | "<planet> has reached its industrial maximum of N factories. Extra resources may be reassigned." |
| Population maxed | `pop >= max_pop3` (and pop grew since last turn) with eco slider auto-disabled | "<planet> has reached its population maximum of N colonists. ..." |
| Eco project done | soil enrichment / atmospheric terraforming / advanced soil finished (`bc_to_ecoproj` met) | "<planet> has terraformed to a <hostile->normal / fertile / Gaia> environment with <more> than standard growth." |
| Planetary shield | shield level reached the empire's best | "<planet> has finished a planetary shield <Roman numeral>." |
| Star gate | `prod >= stargate cost` (3000 BC) | "<planet> has finished a star gate." |
| Ships built | ships finished at that planet (also in the New-Ships report) | design name + count |
Each of these auto-disables the corresponding slider (moving its percent to Industry/Tech/Ship/Defense per `finished_switch_slider` rules), counted in `build_finished_num` and subject to a user filter. Missile bases are built silently. **MOO1 has no food, hunger or starvation messages**; population shrinks only through events, bombardment, plague or reduced max population.

### 11.6 Other end-of-turn notices, with the game's own short wording (labels from the string tables)

| Notice | When | Wording (short labels) |
|---|---|---|
| **Research complete** (`ui_newtech`) | a field's investment roll succeeds (chance `((invest-cost)*250/cost)/500` per turn once invested RP exceed the project cost), or tech arrives by other means | header by source: research "Scientists Achieve A <Field> Breakthrough"; spy theft "Spies Infiltrate The Research Center At <planet>" (+ "Your spies managed to frame another race for the theft" and "Choose the victim race:" when the frame roll succeeded); conquest ruins "Troopers At The Ruins Of <planet> Discover"; Orion loot "Troopers Landing on Orion Discover"; artifact planet "Scouts Exploring The Ruins Of <planet> Discover"; trade/final-war share "<race> Scientists Reveal Their <Field> Secrets"; choosing a project "Choose the area of research our scientists now focus on" |
| Tech adjust dialogs (right after some discoveries) | robotic controls, terraforming, force-field/planetary shield, soil enrichment, atmosphere, waste-reduction techs | "Do you want to increase the industry ratios of all of your colonies to upgrade your factory controls?" / "...ecology ratios of all of your colonies in order to begin terraforming your planets?" / "...defense ratio of all of your colonies to build the new planetary shields?" / "...ecology ratio of your colonies with standard (hostile) environments..." / "Do you want to reduce the ecology ratio of all of your colonies to the minimum amount necessary to keep them clean?" with Yes/No or three preset percentages |
| **Planet explored** (`ui_explore`) | scouts/ships (or advanced scanners) newly see a planet | "Scout ships explore a new star system" / "Planetary scanners explore a new star system" / colony ship present: "Build a new colony?" (Yes/No); lines for population growth (Hostile: halved, Fertile: +50% normal, Gaia: doubled), resource points from industry (cut to 1/3, halved, doubled, tripled), technology points from research doubled/quadrupled |
| **Colony founded** | human answers Yes: landing animation (`ui_landing`); colony starts with population 2 and the colony ship is consumed | (no GNN item; AI colonies are silent) |
| Transports destroyed | landing transports shot down by defences | "<Your/race> transports attempting to land on <planet> were all destroyed." |
| Colony base lost | transports sent to an unowned planet whose colony base was destroyed | "The base at <planet> was destroyed before the transports arrived leaving the colonists without supplies and shelter. All have perished." |
| Invasion / reclaim | ground combat screens | "Ground Combat On <planet>", "<Race>s Capture <planet>", "Imperial Troops Recapture <planet>", "...s Successfully Defend", "transports land to reclaim the colony", per fight "factories captured" / "technology stolen" / "new tech found" |
| Spy notices | 5.4-5.5 | "<race> spies steal the plans for: <tech>"; "<Your/race/Unknown> spies destroyed N factories / missile bases", "failed!", "No factories to sabotage", "No missile bases to sabotage", "incited a revolt!", "incited N rebels. Unrest now at X%", "failed to incite any rebels"; "Spies Caught  Yours  Theirs" overlay |
| Genocide of the human | check_end | GNN "genocide" item then the funeral ending |

No food/hunger/starvation messages exist; pollution shows through the Eco slider text ("waste" / "clean") on the planet screen, not through a turn notice.

---------------------------------------------------------------------------------------------------

## 12. SUPPLEMENTARY REFERENCE TABLES

### 12.1 [Guide] spy odds (Table 12-4: chance that at least one of N spies infiltrates; "penalty" = your tech levels behind the target + target security %)

| penalty | 1 spy | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| <=0 | 50.0 | 74.8 | 85.3 | 90.3 | 92.3 | 92.8 | 92.5 | 91.9 | 91.2 | 90.4 |
| 5 | 45.0 | 64.4 | 71.3 | 72.3 | 70.6 | 67.6 | 64.2 | 60.6 | 57.1 | 53.8 |
| 10 | 40.0 | 55.2 | 58.7 | 57.0 | 53.0 | 48.3 | 43.6 | 39.0 | 34.9 | 31.1 |
| 15 | 35.0 | 46.6 | 47.5 | 44.0 | 39.0 | 33.8 | 28.8 | 24.5 | 20.7 | 17.4 |
| 20 | 30.0 | 38.4 | 37.5 | 33.2 | 28.0 | 22.9 | 18.5 | 14.8 | 11.8 | 9.4 |
| 25 | 25.0 | 30.8 | 28.8 | 24.2 | 19.4 | 15.0 | 11.5 | 8.7 | 6.5 | 4.8 |
| 30 | 20.0 | 23.6 | 21.1 | 16.9 | 12.8 | 9.4 | 6.8 | 4.8 | 3.4 | 2.4 |
| 35 | 15.0 | 17.0 | 14.5 | 11.0 | 7.9 | 5.5 | 3.7 | 2.5 | 1.6 | 1.1 |
(The guide advises sending 2-3 spies per empire; more spies each cost double and are caught together on a high security roll.)

### 12.2 Race-specific facts that touch diplomacy, spying, council or AI [Guide ch.13 + code]

| Race | Relevant facts |
|---|---|
| Human | Positive DP doubled (`actor.race == Human`); +50 (code) / +60 ([Guide]) in every acceptance roll when the *human player* is Human; trade income +25 percentage points (deals start at -5%, cap 125%); +20 council vote weight when the Human is a candidate; everybody starts +12 toward Humans; leaders: Honorable 7/Pacifistic 2/Erratic 1 |
| Mrrshan | +4 attack level on non-special weapons and +4 initiative ([Guide]; code: +4 computer level in battle); AI always +15 slider bias to ships; hates Alkari (-36) and Sakkra (-24) |
| Alkari | +3 defense and +3 initiative on ships; AI prefers small hulls (-3); -36 with Mrrshan |
| Bulrathi | ground combat +25 (+30 defending incl. terrain); AI bomb estimate x1.2; large hulls (+3); Eco-leaning (Bulrathi/Sakkra get Eco +10 AI slider bias) |
| Darlok | spies half price, +30/+20 spy rolls, always espionage; -12 start with everyone but Humans |
| Klackon | workers produce double RP; small hulls (-3); AI Eco +15 bias |
| Meklar | 2 extra factories/pop; large hulls (+3); AI Industry +20 bias |
| Psilon | research x1.5 on planets (code) / "triple research" in [Guide]; 75% chance per Limited-List item; research costs 80%; AI Tech +20 bias |
| Sakkra | pop growth x2; AI Eco +10 bias; -24 with Mrrshan |
| Silicoid | ignores pollution; large hulls (+3); cannot steal/trade eco techs; colonises anything (Radiated) |

### 12.3 Relation/DP quick sheet (what moves the love meter) - [Guide] Table 11-5/11-6 values for comparison with the code

| Action | Guide | Code |
|---|---|---|
| Sign NAP / Alliance | +20 once, then +1..3 / +1..6 per turn | no signing bonus; +rnd(3)/+rnd(6) at 50% per turn |
| Trade agreement | +1..5 per turn | +rnd(3) at 50% per turn |
| Peace treaty | +40 | +40 (`stop_war`) |
| Cash tribute | +12 DP per 100% of economy | 0 (Classic) |
| Tech tribute | ~+6/+12 DP and +5 core | `+((d8+d8+tech/4) * base)/10`, trust +3..10 |
| Council vote for X | +24 (X), -12 (other) | same |
| Abstain | -6 both | -6 both |
| Break pact/alliance/trade | -12 DP, oath-breaker | rel1 -rnd(20) (treaty only), moods -200 |
| Declare war on a treaty partner | -12 DP, oath-breaker | same as break treaty (+ war effects) |
| Genocide | -36 with all | -36 with all |
| Bio weapons | -12 with all | -10 with every AI |
| Too many planets (>25% of stars) | -1 per planet above threshold per turn | block C: allies only, `rnd(4)*(-(n-gscale)/gdiv)` x4/3, on even years w.p. 1/4 |
| Massing fleets | up to -12/turn at 2x | -10 with prob `(1-X/100)/20` |
| Spy caught | espionage 10d3, sabotage 20d3 | 5d12 / 20+d20, frame 2d12 / 2d16 |

---------------------------------------------------------------------------------------------------

## 13. IMPLEMENTATION NOTES, GAPS, UNVERIFIED ITEMS

### 13.1 Suggested minimal faithful implementation order

1. Data model of section 2 for every ordered empire pair; symmetric `rel1`; init from the matrix (3.3); personalities from the tables (3.2).
2. `diplo_act` (4.2.1) + start/stop war + break treaty/trade (4.2.2); per-turn bookkeeping (4.3) - note the +100 mood baseline.
3. Audience screen with the five menus and `check_mood` (4.4); sweetener/counter-offer dialog; trade-level list; tribute and tech-exchange lists.
4. AI initiative (4.6) + war logic (4.6.5) + AI-AI (4.7). Message types as an enum (4.8) - write 2-4 text variants per type and per personality tone.
5. Espionage (5) incl. the Races-screen sliders; spy popups.
6. Council (6) + final war state; end screens (8).
7. Events (7) with the engine of 7.1; monsters and Guardian; GNN items (11).
8. AI production/colony/war logic (10) can be reduced to its decision tables.

### 13.2 Places where you must choose between code and guide (flagged "conflict")

* Mood baseline (+100 vs 0), acceptance thresholds and the Human bonus (50 vs 60).
* Oath-breaking sign bug (trust increases in Classic) and its permanent effect.
* Cash tribute giving no DP in Classic; human sabotage/espionage DP penalties (5d12, no penalty if unflagged/sabotage).
* AI production multipliers (code x1/0.8/1.25/1.5/2.0; guide x0.8/0.9/1/1.25/1.5) and AI research multiplier (20 vs 30).
* Event victim weighting (code: planet counts, humans x5; guide: production squared, good events to the poor), event numbers (comet 275-475 vs guide 400-600 HP; plague 1-16x vs 3-10x production; earthquake pop >= 50 vs 30; accident any colony vs >= 30 factories), Guardian HP (2000-10000 vs 6000-10000), Guardian repair bug.
* Council vote chance constants (code: relation/4, +40 previous vote; guide: up to 40%, +60%, difficulty bonus) and personality modifiers.
* Race bars (stats screen) formulas.
* Personality/objective distributions per race (code 7/2/1 of 10 vs guide 60/20/20).

### 13.3 Not verified / not found

* Exact 1993 text of GNN items, diplomacy messages (`DIPLOMAT.LBX` variants per type) and the high-council captions beyond those listed; any in-game "score" (none found).
* Whether treaties are cancelled when contact is lost ([Guide] yes, code only clears trade + spies).
* Whether a Space Crystal also removes ownership of a 0-pop colony (the colony keeps its owner in this code; other code may clear it when pop == 0).
* The AI "trade/tech swap" Stage E/F details are partly odd in the code (equality test on values); treat as rarely-firing.
* Spread/spontaneous revolt rules of the [Guide] (1% per rebel colony / 1% per AI colony per turn) are **not** present in the v1.3 code that was read (a disabled function only).
* Orion planet/Guardian "Table 15-2" damage-per-turn numbers (guide) not reproduced; needs the combat slice.
* [LP] (update 144) describes AI messages that "threaten war and demand tribute" (Sakkra/Darlok, identical wording) and "unfriendly rejections" with identical text for different races: no dedicated "AI demands tribute" routine exists in the code read; these are presumably the warning/ultimatum types 42-57 and the counter-offer (sweetener) requests, with message text shared between races.
* Per-race `diplomat` portrait animation data is in LBX files.
* The 1oom `ai_id == CLASSICPLUS` differences are only partially listed (tribute formulas, peace mood index, threaten hide direction, `wage_war_do` swap order, treaty-break trust sign); Classic is documented here.

### 13.4 Appendix A - AI ship special chance table (`tbl_chance_special[special_id][hull]`, % per roll; rows 0-8 all 0)

| id | S | M | L | H | | id | S | M | L | H |
|---|---|---|---|---|---|---|---|---|---|---|
| 9 | 0 | 0 | 30 | 80 | | 20 | 10 | 20 | 25 | 35 |
| 10 | 0 | 10 | 50 | 80 | | 21 | 0 | 0 | 20 | 30 |
| 11 | 0 | 0 | 25 | 80 | | 22 | 0 | 0 | 20 | 40 |
| 12 | 0 | 0 | 20 | 70 | | 23 | 10 | 20 | 30 | 40 |
| 13 | 0 | 5 | 20 | 60 | | 24 | 0 | 10 | 30 | 50 |
| 14 | 20 | 30 | 50 | 80 | | 25 | 0 | 0 | 30 | 60 |
| 15 | 0 | 10 | 40 | 70 | | 26 | 0 | 0 | 0 | 50 |
| 16 | 0 | 0 | 25 | 50 | | 27 | 0 | 10 | 20 | 30 |
| 17 | 0 | 0 | 20 | 40 | | 28 | 10 | 20 | 40 | 60 |
| 18 | 20 | 30 | 40 | 70 | | 29 | 10 | 20 | 40 | 60 |
| 19 | 0 | 0 | 20 | 30 | | 30 | 10 | 20 | 40 | 60 |
(ids = the game's ship-special enumeration; see the ship-design slice for names. Other AI design chance tables: computer 10/20/35/50, shield 5/15/40/70, armor 1/2/4/8, man 30/20/20/15, jammer 2/8/20/30 per hull Small/Medium/Large/Huge; weapon slot count tables in 10.6.)

### 13.5 Appendix B - Sources

* 1oom source (GPLv2): https://github.com/1oom-fork/1oom (files read: `src/game/game_diplo.c`, `game_audience.c`, `game_ai_classic.c`, `game_election.c`, `game_event.c`, `game_spy.c`, `game_turn.c`, `game_misc.c`, `game_new.c`, `game_stat.c`, `game_tech.c`, `game_news.c/.h`, `game_num.c`, `game_nump.c`, `game_parsed.c`, `game_battle.c`, `game_ground.c`, `game_planet.c`, `game_str.c`, `game.h`, `game_types.h`, `src/ui/classic/ui{audience,election,ending,news,races,caught,explore,newtech,newships,spy_esp,spy_sab,turn}.c`, `doc/pbxin_fixbugs.txt`, `doc/list_pbxnum.txt`).
* Emrich & Hughes, *Master of Orion: The Official Strategy Guide* (Prima, 1994), archive.org item `MasterOfOrionStrategyGuide_201704` (chapters 4, 11, 12, 13, 14, 15, Appendix A).
* Let's Play Archive "Master of Orion" (lparchive.org/Master-of-Orion, updates 7, 52, 60, 68, 123, 124, 144) for corroboration of council timing (2/3 colonised, every 25 years, 2/3 threshold, defy = Final War), alliances, AI threats, Silicoid veto bloc.
* Wikipedia "Master of Orion" (premise, victory conditions: elimination or peaceful-unification vote; no Antarans).
* StrategyWiki / Fandom MOO wiki pages were not retrievable (HTTP 403/402) - no data taken from them.

