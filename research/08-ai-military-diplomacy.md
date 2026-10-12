# 08 — AI military, diplomacy, espionage & Galactic Council (Master of Orion 1 "Classic" AI)

**Status:** v2 — complete first pass (every requested topic covered; items tagged verified/single-read/inferred; open gaps in §18; planner contract in §19). Sections are ordered by implementation priority:
war target selection (§3) → fleets/staging/invasion (§4) → defence & retreat (§5) → tactical battle AI (§6) →
AI acceptance of treaties and AI-initiated diplomacy (§7–§9) → espionage (§10) → Galactic Council (§11) → special actors/events (§12) →
difficulty / personality / objective / race adjustments (§13) → playbooks (§14) → constants table (§15) → tell-tale behaviours (§16) → quirks (§17) → gaps (§18).

## 0. Sources, method, legend

* **Primary source:** the open-source **1oom** reimplementation (GPL; github.com/1oom-fork/1oom, `src/game/`). Its **"Classic" AI** (`game_ai_classic.c`, header comment: "mimics MOO1 v1.3 behaviour, only minor bug fixes") is the reference. "Classic+" is a slightly fixed variant; where it differs it is noted (§17). Other files read: `game_diplo.c`, `game_audience.c`, `game_turn.c`, `game_spy.c`, `game_election.c`, `game_battle.c`, `game_battle_human.c`, `game_bomb.c`, `game_ground.c`, `game_event.c`, `game_misc.c`, `game_new.c`, `game_num.c`, `game_stat.c`, `game_fleet.c`, `game_parsed.c`, `game_str.c`, `comp.h`, `ui/classic/uiraces.c`.
* **Licensing:** this document describes behaviour and numbers in plain English/maths only; no code is reproduced. Function names are cited so a second analyst can verify.
* **Method caveat:** the source was read through a summarising fetch tool, so every formula was extracted by asking for statement-by-statement outlines; the important ones were read at least twice. Confidence legend used below: **[C]** = two or more consistent reads; **[C1]** = single read; **[W]** = wiki/forum/LP only; *(unverified)*; *(conflict: …)*.
* **Notation:** `d100` = uniform integer 1..100; `rnd(a..b)` inclusive; "**1-in-N**" = probability 1/N; all integer divisions **truncate toward zero** (matters for negative numbers); `clamp(x,lo,hi)`; "A→B" = a value stored for empire A about empire B. "Human"/"player" = the human empire; "AI" = computer empire. Ships: `hull weight` table = {Small 1, Medium 5, Large 25, Huge 125} (`game_num_tbl_hull_w`). Max 6 empires, max 6 ship designs per empire, 108 stars max.
* **Distance units:** AI thresholds are in internal *map units* (`util_math_dist_fast`; a ship with warp factor w moves up to 11·w units per turn in open space, 6 per sub-step inside nebulae; scanner range in parsecs is multiplied by 10 for visibility tests). `S` below = the AI's "best speed" = (best propulsion tech index in its research list) + 3 (`game_ai_best_speed`) *(exact tech→warp mapping unverified)*.

---

## 1. Executive summary for the implementers (read this first)

1. **Wars are decided by diplomacy dice, not by the fleet planner.** Each turn, for every (target T, aggressor A) pair the aggressor A rolls a handful of war checks (§3.2). The scores *favour attacking empires that are STRONGER (fleet or production) than the aggressor and that A already dislikes* — the AI "gangs up on the leader" rather than hunting the weakest. Erratic AIs also declare random wars. Higher difficulty ⇒ more treaty-breaking and more piling-on against the human.
2. **The fleet planner only attacks planets of empires it is already at war with** — except on "need-conquer" turns (no colonisable free planet exists anywhere, then a 1-in-(8−difficulty) roll per turn) when it will also attack NAP partners/allies/neutrals (breaking treaties first, §3.7).
3. **Attack commitment** = the *whole* stack parked at the AI's front-anchor planet is sent at one target when its (tech-based) "threat" total is strictly greater than the defenders' threat + base strength; each candidate target must also pass a 40 % roll. There is no splitting, no coordination of several stacks, and no fleet is ever re-routed once launched (§4.3).
4. **Invasion is population-based and unsophisticated**: transports carry **half the population** of a populous source planet and are sent only to enemy planets where the AI *already has ships in orbit*; no estimate of defenders is made. Bombardment happens only if planet pop > inbound transport pop (Bulrathi over-estimate) (§4.7–4.9).
5. **Defence** = shift planet sliders to ships when any hostile fleet is en route, garrison every colony that has < 5 missile bases and no ship, reinforce a threatened planet only with > 5/3 × the threat (§5).
6. **Tactics**: the AI always plays the right-hand side; targets are scored by "how many enemy ships can I kill × how dangerous they are"; ships fight at the range that keeps > 1/3 of close-range damage; missile-dodging success depends on difficulty; retreat when the loss-rate comparison turns against it, with a difficulty-dependent bias (§6).
7. **Diplomatic acceptance is one formula** (§7): `score = mood + trust + relation + 50·[player race is Human] + personality offset + d100 − threshold (+40 if allied)`; ≥0 accept, −50..−1 "pay me BC", −75..−51 "give me a tech", < −75 hard refusal. Treaty gates: NAP needs relation > 10, alliance relation > 50.
8. **AI-initiated contact is mostly reactive** (it fires after events: positive/negative acts, war help requests, first contact) and is rare in quiet times (~0.5 %/turn/AI) (§8).
9. **Espionage is slow and mostly invisible**: ~0.6–1.0 % of production per target; per-turn mission success only 16 % + computer-tech advantage (§10).
10. **Council**: first vote when ≥ 2/3 of stars are colonised (≥3 empires alive), then every 25th turn; 2/3 of votes (vote = ceil(population/100)) wins; AI voting is relation-driven with a random roll (§11).
11. Many original **bugs/quirks** are part of the "feel" (inverted trust sign when breaking treaties, dead code in the attack planner, tribute BC that does nothing, AI tech-trade offers that almost never trigger…). They are listed in §17 with a keep/fix recommendation.

---

## 2. Where the AI acts in the turn (order matters)

From `game_turn_process` [C]:

1. ceasefire counters −1 → **mood regen/blunder capture** (`game_turn_update_mood_blunder`: moods drift up, `blunder` memory captured from last turn's message type, all proposal buffers and `diplo_type/diplo_val` cleared).
2. **AI strategic turn**: `turn_p1` (fleet/transport/scout/colony orders), `turn_p2` (every 9–20 turns: ship-design refresh and build choices), `turn_p3` (every 2–6 turns slider reshuffle; research focus; **security & spying set-up every turn after year 30**).
3. production/eco/research; `game_turn_update_trade`; **`game_spy_build`** (buy spies); **`game_turn_diplo_adjust`** (treaty-upkeep goodwill, complaints, relation drift).
4. ships built, fleets **move** (arrive).
5. **Battles** (`game_battle_handle_all`) → diplomatic fallout; **spy missions resolved** (`game_spy_turn`); tech research.
6. colonisation → **bombardment** (`game_turn_bomb`, AI decides) → **transports land** (`game_turn_transport`) → **ground combat** (`game_turn_ground_resolve_all`, AI diplomatic reaction) → coups → end-of-game check → **random events**.
7. `have_met` update → **AI-vs-AI diplomacy** (`turn_diplo_p1`) → **Galactic Council** (if due) → **AI→human diplomacy** (`turn_diplo_p2`, including war declarations on the human) → human-facing audiences → contact-lost handling → `mood_relax` (+10 to every mood below 100) → year+1.

Consequence: a war declared by `turn_diplo_p2` this turn first affects fleet orders (`turn_p1`) **next** turn; fleets launched in `turn_p1` arrive in step 4 of a later turn and fight in step 5 of that turn.

---

## 3. WAR: target selection and commitment (priority 1)

### 3.1 Two layers
* **Layer 1 – state of war** (treaty = WAR) is set only by diplomatic code (§3.2–3.5, §8, §9) or by incidents (invasion by the human, assassination event, failed threat, council refusal).
* **Layer 2 – operations** (§3.6–3.8, §4) only act against empires whose treaty with the AI is WAR (or FINAL_WAR), or on "need-conquer" turns.

### 3.2 War-declaration checks (`game_ai_classic_diplo_wage_war`) [C]
**Roles (verified from argument usage):** `wage_war(T, A)`: **A is the aggressor/decider**, T the target. `fleet_w`/`prod_w` are always measured **"T relative to A"** (positive ⇒ the **target is stronger**). The aggressor's own personality/objective is used (`reldiff[A.personality]`, `A.objective`).
**When evaluated:**
* (human T, AI A): once per turn per contacted AI, **only if the AI has no pending diplomatic message for the human** (`diplo_type == 0` after the §8 chain) — i.e. after proposals/complaints were considered.
* (AI T, AI A): inside the AI-vs-AI diplomacy tick (§9), i.e. on turns where the ordered pair is selected (probability `1/(15 − 2·difficulty)`; Simple 1/15, Easy 1/13, Average 1/11, Hard 1/9, Impossible 1/7). Both orderings (T,A) and (A,T) are evaluated.
* **Early exits:** already at war (treaty ≥ WAR) / no contact (`contact[T][A]`) / A dead.
* **Ceasefire gate:** if T is human, checks A–D require `ceasefire[T][A] < 1` (see §9.3 for how ceasefires arise).

**Definitions.** `rel` = relation1 between A and T (−100..100; kept mirrored). `trust` = trust value stored in T's record about A (0 unless changed, §7.4). `reldiff[p]` = {Xenophobic −50, Ruthless −30, Aggressive −20, Erratic 0, Honorable +10, Pacifistic +20}. `W(X)` = Σ over X's designs of (ships of that design × hull weight), accumulated with saturation at 3,250,000 and floor 1 (`fleet_w`).
`ratio_f = clamp( (W(T) − W(A))·100 / W(A), −300, +300 )`; `F = 0` if ratio 0, else a **uniform random integer in 1..|ratio_f|** with the sign of ratio_f.
`ratio_p` and `P` likewise with total production in BC (`total_production_bc`; A's value clamped to 1..3,250,000, T's not clamped).

| Path | Condition (all must hold) | Effect |
|---|---|---|
| **A – Erratic** | A is Erratic **and** d300 ≤ difficulty (Simple never; Easy 0.33 %, Avg 0.67 %, Hard 1 %, Impossible 1.33 % per evaluation) | **War immediately** (message type 61, value 2000) via the normal start-war routine (any NAP/alliance is broken first with normal penalties). |
| **B – fleet envy** | 1-in-20 **and** A.objective ∈ {Militarist, Expansionist} **and** A is **not** Honorable. `v = rel − F + reldiff[A] + trust`; **v < −150** | call `wage_war_do` |
| **C – production envy** | 1-in-20, any personality/objective. `v = rel − P + reldiff[A] + trust`; **v < −150** | call `wage_war_do` |
| **D – ally of my ally's enemy** | a human H4 is at war with an AI X3, **A is allied with X3**, **A is allied with T**, `ceasefire[H4][A] ≤ 0`, 1-in-10 | call `wage_war_do(T,A)` (A and T are allied, so this can only *break the alliance*) |
| **E – hatred pile-on** (target must be **human**, difficulty ≥ Average) | n = number of empires T is at war with (treaty ≥ WAR); require **n < difficulty** (Average: <2, Hard: <3, Impossible: <4); `rel < −30`; roll d10 ≤ (−rel)/10 | call `wage_war_do` |

*Reading the numbers:* with `trust=0`, `rel=0`, a Ruthless aggressor (−30) triggers B/C only when `F` (or `P`) exceeds 120, i.e. when the target is **more than ≈2.2× bigger** (ratio ≥ 121) and then with probability `(ratio−120)/ratio` (60 % at ratio 300); a Pacifistic aggressor (+20) needs `F > 170`; each of B and C additionally has the 1-in-20 gate, so the per-turn war probability is ≤ 3 % per path even at maximum disparity. A hated target (`rel = −50`) lowers the thresholds by 50. **A weaker target never triggers B/C** (negative ratio makes `v` larger). Path E is far more dangerous for a player who is hated: at `rel = −40` it fires 40 %/turn, at −100 100 %/turn.

### 3.3 `wage_war_do(T, A)` — turning the roll into action [C]
1. **If A and T have an alliance or NAP:** do nothing if difficulty < Average. Otherwise break it with probability: *alliance* 1/4, or (1/2 and A Expansionist) ⇒ **25 % (62.5 % if A is Expansionist)**; *NAP* 1/2, **or always if A is Expansionist** ⇒ 50 % (100 %). On break: a "treaty-break notice" (message type 32, value −10000) is queued for a human T, **A breaks the treaty** (A is the breaker; penalties in §7.3), and if `rel > 30` it is capped to 30. **No war is declared in the same call**; war needs a later successful check on a treaty-less pair.
2. **Else (no treaty):** if `ceasefire[T][A] ≤ 0`: queue a war-declaration message (type **13** if `rel < 0`, else **60**) and **start war** (A attacks T; effects in §7.3). If a ceasefire is active nothing happens.

### 3.4 Other war triggers (all verified)
* **Reaction to provocation** (`turn_diplo_p2_sub3`, §8.4): relation ≤ −95 ⇒ war at once (type 13); repeated annoyance escalates warning → treaty break → war.
* **Ally obligation (AI–AI)** (`turn_diplo_p1`, second pass): if AI p1 is allied with AI p2, and AI p3 is at war with p1 but not with p2, then **p2 declares war on p3 immediately** (every such triple, every turn the AI tick runs, unconditional). Produces the "two mega-alliances" pattern.
* **Alliance conflict (AI–AI)** (`turn_diplo_p1_sub1`): an AI allied with two AIs that are at war with each other **breaks both alliances** (buggy loop, see §17).
* **Human invades an AI planet** (`game_ai_classic_ground` / bombing): treaty < WAR ⇒ automatic war (swap-order start) + relation hit −(51..100) (§4.9).
* **Failed human threat** (`aud_threaten`, §7.7): war chance.
* **Assassination event** (§12): war between the "framing" AI and the victim.
* **Council refusal by a human** (§11): FINAL_WAR vs every non-refusing empire.
* **Need-conquer attacks** (below) break NAP/alliance with the planet owner before attacking.

### 3.5 "Need conquer" (`game_ai_classic_turn_p1_send_scout`) [C]
Every turn, per AI: `need_conquer = (1-in-(8 − difficulty))` (Simple 1/8, Easy 1/7, Average 1/6, Hard 1/5, Impossible 1/4). It is **cleared** if *any* unowned star in the galaxy (visible or not, in range or not) has planet type ≥ the AI's current colonisable threshold (`have_colony_for`) — except the Orion planet while its Guardian lives — and it is forced false once the game has ended (final war). So conquest-without-war is only possible once the free colonisable real estate has run out *for the AI's colonisation tech*.

### 3.6 Target list (`turn_p1_planet_w`) [C]
For every star: if it is unowned but has another empire's ships in orbit, it counts as owned by the first such empire (lowest index). An **enemy planet** enters the target list iff **all** hold:
* owner ≠ this AI, and (treaty with owner ≥ WAR **or** `need_conquer` **or** game ended);
* planet within **fuel range** (`within_frange == 1`);
* planet type ≥ the AI's colonisable threshold;
* year > 120 **or** it is not the Orion planet.

**Weight (priority)** = `pop − 10·missile_bases + (special−2)·20 + special·10 + 20` where `special` is the planet-special enum value **ultra-poor 0, poor 1, normal 2, artifacts 3, rich 4, ultra-rich 5, 4×tech 6** (verified enum), i.e. the special bonus is `30·special − 20` = −20, +10, +40, +70, +100, +130, +160. The list is bubble-sorted **descending** (richest, most populous, least-based first).
*(Own planets get a separate weight `pop − 5·bases + same special bonus`, used only by the colonisation logic.)*

### 3.7 Commitment procedure (`turn_p1_send_attack`) [C]
Let `range = fuel_range × 15` map units. For **each front** (§4.2) with anchor planet `P` (an AI planet), in front order:
1. Walk the sorted target list until one target is chosen for this front. Skip targets marked used (−1000) this turn and targets farther than `range` from `P` (strictly less required).
2. **40 % gate:** d100 < 40 (skipped if the list has fewer than 2 entries).
3. **Defender weight** `D` = Σ over every *other* empire's ships at the target × that design's threat value (§4.1) **+** (if the target is owned) `[(owner's weapon-tech % × 5) + (owner's planetary-shield level + 10) × 10] × missile_bases` where shield level ∈ {0,5,10,15,20}. (Classic masks `D` to 32 bits. The original loop bound used the AI's own design count — a MOO1 bug that 1oom corrects.)
4. **Attack iff the AI's force at `P` (§4.1) is strictly greater than `D`.** Then the target is marked used for this turn *whether or not a fleet really leaves*.
5. Act on the target's owner:
   * **unowned** (planet with a foreign fleet but no owner) → send the whole stack;
   * **owner allied with the AI** → with prob. 1/4 (62.5 % if Expansionist): queue a type-32 notice for the owner, **AI breaks the alliance**, relation capped to 30, **no fleet this turn**; otherwise nothing;
   * **owner has NAP** → with prob. 1/2 (**always** if Expansionist): same break, relation capped (to 20 in the NAP branch; source comment doubts it should be 20), **no fleet this turn**;
   * **no treaty / war** → send the whole stack.
6. (A second pass intended for fleets sitting at enemy planets — 60 % roll, force×3/2 > enemy hull-weight total — **never runs in Classic**, because the force table is only filled for own/unowned stars; see §17.) Fleets parked at enemy planets therefore receive no further orders.

### 3.8 When the AI does *not* attack
* Target owner has ceasefire with a human: the AI's transports skip human planets with `ceasefire > 0` and bombing is cancelled (§4.7–4.8); AI attackers withdraw from human systems without fighting while `ceasefire[human][AI] > 0` (§5.4).
* Own force ≤ defender weight, target beyond range, 40 % roll fails (retried next turn), treaty NAP/alliance without need-conquer.
* The AI never evaluates "relative strength of the whole enemy empire" in the operations layer, never counts reinforcements the defender may receive, and never plans multi-stack assaults.

---

## 4. Fleets: composition, staging, invasion (priority 2)

### 4.1 Strength metrics [C]
* **Design threat** (`turn_p1`, computed every turn for every empire's designs): `Σ over non-bomb weapon slots (weapon tech-index × weapons in slot)`; **if that sum is non-zero** add `((shield class + 10) × design hit points) / 50`; add `2 × (tech index)` for each special slot whose special id ≥ Battle Scanner; for **AI-owned designs only**: ×2 once a Galactic Council election has ever been held, ×2 again when the game has ended. Classic stores it in 16 bits (mod 65536). (Using the *tech index* rather than damage means higher-tier weapons count disproportionately; bombs add nothing.)
* **Force at a star** (`tbl_force_own[star]`) = Σ designs (own ships in orbit × design threat); **only stars that are owned by the AI or unowned are summed** (stars owned by other empires get 0). Classic truncates to 32 bits.
* `force_own_sum` = (Σ of all force) / 25; halved after the first election and halved again at game end.
* Alternative metric for defence: **hull weights** {1,5,25,125} × ship count (also used by `game_stat_fleet` for the empire-level fleet statistic: band-scaled to 0..100, doubling band widths 125, 250, 500…; used for the "your fleet is a threat" complaint, §9.2).

### 4.2 Fronts and anchor planets (`turn_p1_front`) [C]
Run twice per AI turn. For each other empire in contact (and, after the game ended, only refusers): candidate front point = `0.4·(their planets' centroid) + 0.6·(own centroid)` (centroid = mean of planet coordinates; computed once per turn). A candidate within `S·10+10` units of an earlier front is dropped (fronts are merged, not summed). Front **relation value** = `min(relation1, 0)` (neutral/friendly neighbours score 0). No contact at all ⇒ one dummy front at the AI's own centroid with relation +80 (peaceful: fleets go home).
**Anchor planet** of a front = the AI planet nearest to the point; but if any AI planet has missile bases, or its first non-empty design stack has *exactly one* ship, the nearest such planet is used instead (a quirk: the test is `defence == 1`, not `≥ 1`). Fronts with the same anchor are merged (relations added).
Then every front's relation value gets **+ (force at its anchor × 100 / total force)**. Lower value = more attractive for idle fleets: hated neighbours attract, a front already holding most of the fleet repels.

### 4.3 Attack orders: see §3.7. Whole stack leaves (all designs present at the anchor, no splitting, speed = slowest engine sent, ×stargate rule below).

### 4.4 Defence orders (`turn_p1_send_defend`) — see §5.1.

### 4.5 Idle-fleet staging (`turn_p1_send_idle`) [C]
Only if the AI has **< 8 fleets en route**. Fleets at front anchors are left alone. Any other stack whose force < `force_own_sum` (i.e. < ~4 % of the AI's total fleet) is left where it is. (Source bug: a clean-up step writes to the wrong index.) Every remaining stack picks the front minimising `distance(stack, anchor)·10 / (S·20+20) + front value` and is sent there. Result: fleets gather at anchor planets facing the most disliked neighbour, then the attack check of §3.7 fires when the gathered stack is strong enough.

### 4.6 Dispatch mechanics (`game_turn_fleet_send`) [C]
* Sends **every design stack** at the origin (no colony-ship filter; colony ships have their own logic), each design's whole count.
* A design is dropped if the destination is out of fuel range, or in the extended band (range+3) and the design lacks reserve fuel tanks. *(Classic bug: ships that could not go are still removed from orbit.)*
* Fleet speed = slowest engine among sent designs (+1); **100 (instant) if origin and destination are both AI-owned stargate planets**.
* Table limits: 208 AI fleets en route (260 total).

### 4.7 Troop transports (`turn_p1_trans_en`, `trans_own`) [C]
**Invasion transports** (`trans_en`), per AI per turn:
* **Targets** = planets owned by another empire where **the AI already has at least one ship in orbit**, owner is an AI *or* has no ceasefire with this AI, the AI is **not allied** with the owner, planet type ≥ AI colonisable threshold; (Classic ignores fuel range here; fix flag exists). **No war requirement**: any non-allied planet with AI ships over it qualifies (in practice ships are only there during war/need-conquer).
* **Sources** = own planets with `pop ≥ max_pop/2` **and `pop > 20`** (Classic also allows planets in rebellion).
* Targets that already have an AI transport en route are skipped. For each target the **nearest** source within `S·30+30` units is used; the transport carries **`pop/2`** of the source (integer), source then unavailable this turn.
* **No troop-strength estimate, no margin, no race/tech comparison.** The expectation is that ships in orbit have already bombed the defenders.
**Internal reinforcement** (`trans_own`): destinations = own planets with `pop < max_pop/3` (or in rebellion); sources = own planets with `pop > 3/4·max_pop`; distance < `S·20+20`; the **first** qualifying source in index order sends `pop/3`.
**Arrival** (`game_turn_transport`) [C1]: every empire that is the planet owner, or has armed ships in orbit and is not allied with the transport's owner (treaty none/war), shoots the transport stack: the owner's **missile bases** contribute `bases × 24` shots of the base weapon; ships contribute `ships × weapons × shots × 2 / transport speed` (bombs/bio ignored, missile-class weapons halved). Transport hit points = `(transport owner's best armour tier + 1) × 15` each; a shot hits if `d20 ≤ complevel` with `complevel = (best computer level − transport speed)×2 + 12` clamped 1..20 (for base shots the computer level is read from the transport owner — a source quirk); kills = total damage ÷ transport hp (cap 1000). **Monsters and the Orion Guardian destroy every transport at their star.** Survivors that land on a non-allied enemy planet add to its `inbound[owner]` (cap 300) and fight the ground battle (§4.9); landing on an unowned or fully depopulated planet captures it. If the invader owns **Combat Transporters**, killed troops may be recovered: Classic recovers each lost troop (≈5/8) *only when the defender owns the Sub-space Interdictor flag* (apparently inverted); with the 1oom fix flag the rate is 1/2 per troop (1/4 if the defender has the flag).

### 4.8 Bombardment decision (`game_ai_classic_bomb` + `game_turn_bomb`) [C]
* Every turn, every empire with armed ships at a planet it is not allied with (and, for AI bombers, not NAP-protected) is a candidate bomber. Damage computed by the physical model (below); **if both pop and factory damage are 0 → no bombing**.
* **AI decision:** bomb iff `planet.pop > inbound_AI_transport_pop` (strict). If the bomber is **Bulrathi** the inbound figure is inflated first (**+20 %** in Classic; ×2.15 in Classic+) so Bulrathi bomb less when invading. **Never bomb a human owner with an active ceasefire.**
* Physical model (for whoever bombs) [C1]: for each weapon type present in orbit: `shots = ships × weapons per ship × shots per weapon` (capped at 100,000), processed in ≤ 10 batches; a batch/shot succeeds if `d20 ≤ complevel` where `complevel = (best computer level − 1)×2 + 6` clamped 1..20; per-hit damage = weapon max damage (some weapon classes halved) minus the planet's shield (nothing if ≤ shield); **population killed = total damage ÷ (d80 + 160)** (population hit points ≈ 200), **factories destroyed = total damage ÷ (d20 + 40)** (factory hp ≈ 50); biological weapons: each hit does `rnd(0..damage) − antidote` and **permanently lowers the planet's maximum population** (floor 10).
* Diplomatic fallout of bombing/attacks is in §4.9 / §7.3.

### 4.9 Ground combat & aftermath (`game_ground.c`, `game_ai_classic_ground`) [C]
* One combat round per surviving troop: each side rolls d100 + its **force**; the lower total loses one troop (tie: the first-listed side — the invader in AI-vs-AI, the *planet owner* if a human is involved — loses). Repeat until one side has 0. Defender force starts with **+5**.
* **Force** = 5·(armour tier) + 10·(personal-armour tier) + 10·(personal-shield tier) + 5·(personal-weapon tier, +1 if tier > 2) + **25 if Bulrathi**; same formula for attacker and defender (tech-dependent, no difficulty bonus).
* Winner: attacker with survivors takes the planet (pop = survivors); for each factory a **1-in-50** chance of looting a technology (a random tech the defender has and the invader lacks); defender with survivors keeps the planet at the survivor population.
* **AI reaction** (called for every resolved fight; ignored if the defender is human): AI attacker vs AI defender → defender's attitude toward the attacker `act(−(rnd(1..4)+4))` (≈ −5..−8; pop-killed forced to 1) type 10; **human** attacker who **took** the planet → `act(−(50+rnd(1..50)))`; if the treaty was below WAR also type 13 and a **start-war** (swap order) is executed (the player gets an automatic war); already at war → type 10; human attacker who failed → `act(−(rnd(1..5)+5)·pop_killed)`.
* **Post-battle generic fallout** (`game_diplo_battle_finish`, used after space battles and bombing): see §7.3 table.

### 4.10 Production switched to war (economy hooks; the sibling analyst covers the rest)
* `turn_p3` slider weights switch to the **WAR row** if the AI has *any* treaty ≥ WAR with *anyone* (no contact/alive check): `ship 4, def 1, ind 1, eco 1 | computer 2, construction 2, force-field 4, planetology 2, propulsion 1` (weapons = remainder).
* `build_defending_ships`: every planet with an incoming hostile fleet (Classic counts even allied fleets) moves its defence + industry + tech sliders into the ship slider and gets **1/5 of the empire reserve** added to the planet.
* Missile-base block (every turn): planets with > 4 bases, `bases×3 ≥ pop/(5 − difficulty)` and shield ≥ empire shield level double their ship slider (the "BUG creates very large fleets" in Classic; fix flag uses the defence slider instead).
* Difficulty production multipliers for AI planets: Simple ×1.0, **Easy ×0.8, Average ×1.25, Hard ×1.5, Impossible ×2.0** (`game_update_production`, applied to factories+planetology output before reserve).

### 4.11 What does NOT exist in the MOO1 AI (so do not invent it) [C]
* **No escorts / convoys / combined arms:** colony ships and scouts are dispatched by the colonisation/scouting planners (sibling analyst) with no escort logic; troop transports travel unescorted (they simply die to defenders, §4.7).
* **No blockade logic:** ships orbiting a foreign planet only trigger the per-turn battle and the bombing decision; nothing "keeps" them there except that fleets located at enemy-owned stars are never given new orders (§3.7).
* **No multi-stack coordination, no timing, no feints, no retreat orders, no threat-based re-routing of fleets in flight** (fleets in flight cannot be redirected by the AI).
* **No troop-count estimation, no choice of invasion target by defender strength** beyond the target-list weight and the "my fleet is stronger" test; no use of bio-weapons by choice (bio is just another bomb type picked by the design AI; the bomb/no-bomb decision is the §4.8 rule).
* **No demands for tribute, no ultimatums, no alliance requests initiated by the AI except §8.3/8.5.**

---

## 5. Defence & retreat (priority 3)

### 5.1 Strategic defence (`turn_p1_send_defend`) [C]
1. Threat per planet from **en-route hostile fleets** aimed at an AI planet = Σ ships × hull weight (1/5/25/125); **hostile transports** add `pop × 5` (medium-hull weight); any planet with **< 5 missile bases and no AI force in orbit gets a flat threat of 50** (so every unguarded colony is "threatened"). (Classic masks to 32 bits.)
2. **Defend list** = AI planets where `force×4/3 < threat`.
3. Every star where the AI has force and **no threat** is a candidate sender: it picks the **first** defend-list planet (list order, not nearest) within `S·30+20` units; it is sent only if `threat×5/3 < sender force`; afterwards that planet's threat is set to a huge number so nobody else goes.
Note the unit mismatch (hull-weight threat vs tech-threat force) — small stacks easily out-"force" a planet's flat 50, big enemy stacks (e.g. ten Huge = 1250) are almost never out-matched, so the AI **does not intercept doom stacks**; it garrisons colonies and builds ships instead.

### 5.2 Emergency production (see §4.10) and reserve injection: 1/5 of reserve per threatened planet; `fund_developing`: planets with pop < 20 receive 1/5 of the reserve each; **tax** (after turn 20) = rnd(1..10)+difficulty+2 (per mille).

### 5.3 Strategic retreat
The planner has **no retreat order**. After a lost space battle (`game_battle_post`) the loser's surviving ships are sent to the **nearest planet it owns** (other than the battle planet), whatever the difficulty; if it owns no other planet they are destroyed. Fleets never flee an approaching enemy.

### 5.4 Ceasefire effects on military behaviour (human involved)
`ceasefire[human][AI] > 0` (set by peace treaties 8..13 turns, by successful threats 6..20 turns): AI attackers **withdraw without fighting** at the human's systems, AI will not bomb, will not send invasion transports to human planets, will not declare war (paths A–E gated), and its spies are set to *hide*.

### 5.5 Tactical retreat decision (`battle_ai_retreat`) [C]
Evaluated each round for the AI side (SIDE_R; the human is always left side, AI always right side regardless of who attacked):
* For every enemy and own item compute the expected **damage each side would take** next round (`dmg[side]`, via the same damage estimator as targeting, missiles included, minus repair) and the **hit points** each side has (`hp[side]`); the planet counts at 70 %.
* If either side has 0 hp → no retreat. If the AI side cannot damage the enemy at all (`dmg[human side] == 0`) → **retreat**.
* Else `v = (5 − difficulty)×5 + 5` (**Simple 30, Easy 25, Average 20, Hard 15, Impossible 10**) `+10` if the human owns the planet, `+20` if the AI owns it, `+ d15`. Loss rates: `L_ai = dmg[AI]·100/hp[AI]` (percent of its own hit points it will lose), `L_h = dmg[human]·100/hp[human]`. **Retreat iff `L_ai > L_h × v`.**
* Interpretation: the AI retreats only when it is being hurt (in %) at more than *v* times the rate it hurts the enemy; **lower difficulty ⇒ larger v ⇒ stubborn**; higher difficulty retreats earlier; defending its own planet is stickier (+20). Classic uses 32-bit integer maths (overflows possible).
* When it returns true all right-side items get `retreat += 1`; an item with `retreat ≥ 2` is **removed from the battle at its next turn** (ships flee, they are not destroyed) and join the §5.3 retreat.
* **Individual retreat counter:** an AI ship increments its own counter whenever it has no enemy it can damage and has no missile in flight; while the counter > 0 it stops attacking and moves to the safest cell (see §6.3). The counter is reset to 0 if the ship cannot move.
* A battle is a **timeout after 50 rounds**; the planet's side (if the planet is owned) wins, otherwise the right side.

---

## 6. Tactical battle AI (priority 4)

Battle grid 10 columns wide; cell 32×24 px; ships of the human are on the left. All AI-controlled items (and the planet when owned by the AI) run `battle_ai_turn` in initiative order.

### 6.1 Turn skeleton (`game_ai_classic_battle_ai_turn`) [C]
1. Refresh area. If the item is on the right side, has **no rival at all** (mode-1 query) and has fired no missiles → `retreat += 1`. If it cannot move (all crew-limited) → `retreat = 0`.
2. **Stasis field:** if it has a stasis device, pick the most dangerous un-stasised visible enemy stack (score = enemy max-damage × enemy count) provided at least **two** enemies would remain unlocked; move toward it and, if within distance 1, attack it.
3. If **missiles are inbound** at this ship and a rival exists: evaluate pulsar use (see 6.5) then fire at the rival immediately.
4. `special_button` defaults to on.
5. **Movement target:** if `retreat > 0` target = none (flee); else target = best rival by the mode-2 score (6.2). Move via `target1` (6.3).
6. After moving: re-evaluate pulsars, pick targets with the mode-0 score and **fire repeatedly** (loop ≤ 10 times) at the best rival until nothing is left to shoot, with: cloaked ships only shoot targets at exactly the distance they moved to; ships with `retreat > 0` do not shoot. The **planet** (item 0) with no rival shoots the first enemy item.

### 6.2 Target scoring (`game_ai_battle_rival`) [C]
For each enemy item `t` (the planet also tries swapping its two weapon slots and keeps the better):
* `inc` = expected damage already inbound to `t` from missiles, expressed in units of `t`'s hit points (per-missile integer division); `maxdmg(t)` = `t`'s theoretical maximum damage per round (all weapons at full strength: beams `max×count×shots`; bombs/bio count only vs planets; +1000 if it has a black hole generator); `give` = estimated damage my item deals to `t` this round (§6.6); `rep` = `t.repair%×hp/100`.
* `kills = (my_count × give − rep) / (t.hp1 × 20)`. If `kills > 0`: `kills = min(kills, t.count − inc)` (≥0); **score = kills × maxdmg(t) × 20**.
* Else: score = 3 if (`inc > 0` and `give > 0`) else `((give − rep) × maxdmg(t)) / t.hp1`; floor 0; if `give > 0` floor 3; a score of exactly 1 against a ship becomes 2.
* If `maxdmg(t) ≤ 0` but `give > 0`: score = 1 (planet) or 2 (ship).
* **Planet shooters** add `(10 − distance) × 750` to any positive score (prefer near targets); against a planet whose score is 1, bio weapons add `(damage − antidote) × count × 100`.
* **Best score wins** (ties keep the first). Mode 0 = normal firing target; mode 1 = "is there anything I could hurt at all" (ignores range/stasis); mode 2 = movement target (ignores range).

### 6.3 Movement (`game_battle_ai_target1`, sub3/4/5) [C]
* **Desired range** `bestrange` (`game_battle_ai_best_range`): for each distance d = 1..9 compute my potential damage `Wd` at that distance (weapons in range at d, damage max/(2 if shooting a planet with missiles/beams) − absorb/absorbdiv, × damage multiplier × count × shots; bio weapons ×100; black hole +2000 and stasis +2000 only at d=1; pulsars (6−absorb or 16−absorb)×target count at d=1; stream devices at d ≤ 2; missile range is reduced by how far the target could retreat in two turns; fading weapons only at d=1). Stop at the first d with `Wd = 0`. **Non-cloaked ships** extend `bestrange` to d as long as `W1 < 3·Wd` (i.e. keep every range that still gives > 1/3 of point-blank damage); **cloaked ships** extend while `Wd ≥ W1` (stay as far as possible without losing damage). Planets: range 1.
* If the ship can move and no missile threatens (`missile_evade == 0`): evaluate every free cell (+ staying): **score = +10 if distance to target == bestrange else −4×distance**; + pulsar-adjacency score (own neighbours −4 each, enemy neighbours +3 each, only if their absorb < pulsar damage; the code evaluates it at the ship's *current* position — quirk); −2 if the line of fire is blocked; ±1 for the ship's own marker. Choose uniformly at random among the best-scoring cells (≤20 kept).
* **No target** (retreating/fleeing): move to the neighbouring cell (3 columns × current row and the row above — the row below is never tried, a quirk) that maximises distance to the nearest enemy, repeat while movement remains.
* **Missile evasion** (`missile_evade`): for each inbound missile compute its danger distance `(range-table[0] × missile fuel) + 13` px and the ship's escape room; evasion value 1 = already outside danger distance (stay), **2 = can get outside by moving, which succeeds only if `d3 < difficulty`** (Simple/Easy never, Average 1/3, Hard 2/3, Impossible always, rolled **per inbound missile**). When evasion applies the ship runs `sub5`: moves to the neighbouring cell farthest from the nearest dangerous missile (missiles with fuel < 8).
* Subspace-teleport ships choose any open cell instead of neighbouring cells.

### 6.4 Planet defence behaviour
The planet is item 0 on the owner's side, never moves, uses the same targeting (with weapon-slot swapping so the missile type matching the situation is used) and has the +70 % weighting in retreat maths. Missile-base counts shrink by combat results only in the shared battle code; AI-vs-AI auto-resolve (§6.7) leaves Classic bases untouched.

### 6.5 Pulsars and special devices
* `eval_pos_for_pulsar_use`: pulsar type 1 → `dmg = 5 + num/2`; type 2 → `dmg = 10 + num`; for each adjacent item: own side with `absorb < dmg` → −4, enemy with `absorb < dmg` → +3. If the sum is negative the special button is switched **off** for that item's turn.
* Black hole / stasis / stream / tech-nullifier / warp-dissipator effects are *only* priced into the range and damage estimators (bonus damage constants: warp dissipation +100 (≤ 3 cells, target not fully crewed), black hole +1000 (≤ 1 cell), tech nullifier +500 (≤ 4 cells), stream types scale with target hp). Repulsor/scanner/teleport use is not AI-specific (shared battle engine).

### 6.6 Damage estimator (`game_ai_battle_dmggive`) summary [C1]
Per weapon slot: base miss % = `50 − 10×(attacker combat level − target defence)` (+50 if the target is cloaked, clamped 0..95; missiles use the missile-defence stat and −10 per point of weapon accuracy); fixed-damage weapons: `(100−miss)/5 × (max dmg − absorb/oracle-divisor)/2-if-vs-planet × multiplier × missiles`; variable beams: the miss % is raised when the target's absorb exceeds the minimum damage, damage = average of adjusted min/max ×(100−miss)/5; bio weapons count `500×max damage`; minimum 1 if the weapon can penetrate at all; special-device terms as above.

### 6.7 AI-vs-AI auto-resolve (`battle_ai_ai_resolve_do`) [C]
Used whenever neither side is human. For each side:
* **Design weight** = `(shield class×5 + computer×5 + first-weapon type id + armour class×10 + 2×(each of 3 special ids) + construction-tech %/2 (+15 if Mrrshan or Alkari; +20 in Classic+)) × hull weight` (ids are enum indices).
* **Side strength** = Σ ships × design weight; the planet owner adds `bases × 75 × (weapon-tech % + force-field-tech %)`; a monster side is fixed at **100,000 (Guardian) / 30,000 (others)**.
* **Resolution:** repeat while both remain > 0: left loses `max(1, d10 × S_left_initial / 100)` from the right, right loses `max(1, d10 × S_right_initial / 100)` from the left (both applied each round). Winner = right if right's remainder > 0 else left (double knock-out ⇒ left). Each side's ship counts are scaled by `remaining/initial` (loser → 0). **Planet bases/pop/factories are not changed in Classic.**
* The loser's remaining ships (none, usually) retreat per §5.3; diplomatic fallout via `game_diplo_battle_finish` (§7.3) using the apparent force lost `Σ(hull index+1)×ships`.

### 6.8 Who fights whom (`game_battle_handle_all`) [C]
Per star, parties with force: the owner (if it has bases or ships), other empires' ships, monsters. Defender = owner if present else lowest-index party. **No battle** if the defender is allied with the attacker, or the defender has a **NAP with the attacker and the defender is not the star's owner** (NAP does *not* stop attacks on the owner's own planets!). An AI attacker with `ceasefire[defender][attacker] > 0` simply withdraws. Human involvement → interactive tactical battle (human always left); otherwise auto-resolve. Race modifiers applied to battle stats: Mrrshan +4 computer level; Alkari +3 defence and +3 missile defence.

---

## 7. Diplomatic state and PLAYER-INITIATED diplomacy (priority 5)

Status tags: **[C]** verified by ≥2 reads of the source, **[C1]** verified by one read, **[I]** inferred/interpretation, **[W]** wiki/forum only.

### 7.1 State variables [C]
Stored per ordered pair in `eto[X].field[Y]`. For human↔AI pairs the AI's attitude toward the human is stored in the **human's** record (index = the AI) — model it as one `pair(H,A)` object.

| Variable | Range / init | Meaning and who changes it |
|---|---|---|
| `treaty` | NONE, NAP, ALLIANCE, WAR, FINAL_WAR; symmetric; set to NONE when contact is first made | primitives §7.3 |
| `relation1` | −100..100, **mirrored** in both records after every act/drift; init = `relation2` = racial matrix ×12 (matrix below) | the "attitude" (UI label = `relation1/12 + 8` → 17 bands FEUD, HATE, DISCORD, TROUBLED, TENSE, RESTLESS, WARY, UNEASE, NEUTRAL, RELAXED, AMIABLE, CALM, AFFABLE, PEACEFUL, FRIENDLY, UNITY, HARMONY) |
| `relation2` | −100..100; init = relation1 | long-term baseline `relation1` drifts toward; −5 per war start (both); alliance break changes it (§7.3); coup resets relation1 to it |
| `mood_treaty`, `mood_trade`, `mood_tech`, `mood_peace` | ≈ −200..+120; init 0 *(zero-init presumed, [I])* | per-topic willingness; mirrored for treaty/trade/tech, one-sided for peace; see regen below |
| `trust` | int, 0 init (human record [AI]) | +`d8+2` (cap 30) per tech tribute; breaking treaties changes it with an **inverted sign in Classic** (§7.3) |
| `blunder`, `broken_treaty`, `hatred` | small ints | memory of last offence type (4..11/12..19), of the treaty you broke, and an escalation counter 0..3 |
| `diplo_type/val/p1/p2` | per pair (human record) | message queued for the human's next audience: type code (§7.8), signed magnitude, planet, field |
| `ceasefire[H][A]` | turns, ≥0 | §5.4 / §9.3 |
| `trade_bc`, `trade_percent`, `trade_established_bc` | BC per turn agreed, % realised | trade agreements (income = `bc × (percent + 25 if player is Human race)/100`) |
| `have_met` (human) | 0 → 1 (first contact) → 2 (greeted) | |
| `contact` | bool, recomputed every turn | true iff the minimum distance between any planet of X and any planet of Y ≤ max(fuel range X, fuel range Y); symmetric; losing contact zeroes trade and sets spies to hide |

**Mood dynamics [C]:** at the *start* of each turn every mood < 0 gains `+d5` and every mood < 50 gains another `+d5` (peace clamped to ±200); at the *end* of each turn every mood < 100 gains **+10** (so quiet moods settle at 100..109; `mood_treaty` is clamped to ≤120 before diplomacy). A war start/treaty break sets all four to −200 (peace −130 after a war start) ⇒ roughly 7 turns until the mood minimum exceeds −100 (the AI "returns"), ~12 turns until `mood_peace > +30`, ~20 turns until everything is back near 100.
**Relation drift [C1]:** each turn, for every AI empire i and every other empire j (the "no fresh notice" guard is always true for AI records): roll `|relation1| > d105`; if it passes, a second 50 % coin decides a step of +1/−1 toward `relation2` (never overshooting). Expected speed ≈ `|r|/210` per turn (≈0.24 at |r| = 50). AI–AI pairs get two chances per turn (one per side), human–AI pairs one. Then relation1 is mirrored across both records.
**Initial relation matrix [C]** (`relation1 = relation2 = 12 × table[race_i][race_j]`; row = viewer, order Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok; the matrix is symmetric: every race likes Humans (+12), Mrrshan↔Alkari −36, Mrrshan↔Sakkra −24, Silicoid↔Meklar +12, Darlok are −12 to and from every race except Humans):
```
Hum  0  1  1  1  1  1  1  1  1  1
Mrr  1  0  0 -2  0 -3 -1 -1  0 -1
Sil  1  0  0  0  0  0 -1  0  1 -1
Sak  1 -2  0  0  0 -1 -1  0 -1 -1
Psi  1  0  0  0  0  0  0  0  0 -1
Alk  1 -3  0 -1  0  0 -1  0  0 -1
Kla  1 -1 -1 -1  0 -1  0  0  0 -1
Bul  1 -1  0  0  0  0  0  0  0 -1
Mek  1  0  1 -1  0  0  0  0  0 -1
Dar  1 -1 -1 -1 -1 -1 -1 -1 -1  1
```
Personality/objective assignment at game start [C]: `trait1` (all empires incl. the human, cosmetic for the human) = `T1[race][d10-1]`, `trait2` (AIs only) = `T2[race][rnd(0..11)]` with
`T1` rows (values 0 Xenophobic,1 Ruthless,2 Aggressive,3 Erratic,4 Honorable,5 Pacifistic; 10 entries): Human/Alkari 4×7,5×2,3×1 (70 % Honorable, 20 % Pacifistic, 10 % Erratic); Mrrshan 1×7,2×2,0×1; Silicoid 0×7,2×2,3×1; Sakkra 2×7,3×2,1×1; Psilon 5×7,4×1,3×2; Klackon 0×7,2×2,1×1; Bulrathi 2×7,3×2,1×1; Meklar 3×7,2×2,0×1; Darlok 2×7,1×2,0×1.
`T2` rows (0 Diplomat,1 Militarist,2 Expansionist,3 Technologist,4 Industrialist,5 Ecologist; 12 entries): Human 0,0,0,0,1,2,3,4,4,0,3,5; Mrrshan 0,1,1,1,1,3,2,2,3,3,4,5; Silicoid 0,1,2,2,2,2,3,3,3,4,4,5; Sakkra 0,3,1,5,5,3,4,2,2,2,2,2; Psilon 0,0,3,1,2,3,3,3,3,4,4,5; Alkari 0,1,1,1,2,2,2,3,4,2,3,5; Klackon 0,1,1,2,2,3,3,4,5,5,5,5; Bulrathi 0,5,5,5,5,2,2,3,3,3,4,5; Meklar 0,1,2,2,3,3,3,4,4,4,4,5; Darlok 0,0,3,3,1,2,0,3,3,4,4,5.
*(conflict: fan-wiki "default personality+objective per race" lists — Alkari Militarist, Klackon Industrialist, Darlok Diplomat, "60 %/20 %/20 %" — are not reproduced by these tables (Alkari modal objective = Expansionist, Klackon = Ecologist, Darlok = Technologist/Diplomat, trait split 70/20/10). The tables are taken as authoritative; the wiki list is probably MOO2-derived [W].)* A **coup** (any empire with ≥ half of its planets in rebellion, `game_turn_coup`) re-rolls *both* traits uniformly at random (`trait1` over 6, `trait2` over 6, ignoring the race tables), resets all its `relation1` values to `relation2`, and breaks treaties and trade with human empires; a lone human empire suffering a coup loses the game ("funeral" ending).

### 7.2 The master relation-change function `diplo_act(dv, actor X, target Y, dtype, planet, p2)` [C]
Applies to the **target's** attitude toward the actor (`relation1(Y→X)`), mirrored to X's record. Steps in order:
1. *(Only while a final war is in force:* an AI actor with dv<0 against a refusing human may leave a "final war" notice with probability `|dv|/10 %`; then return.)
2. **Return** if either id invalid, X = Y, dv = 0, **Y is human** (the human's feelings are never modelled, so AIs' acts toward the human have no effect), or the treaty is FINAL_WAR.
3. `dv = −10000` is a **notice only** (war/treaty-break announcement for a human actor with dtype ≠ 0: `diplo_val = 10000`, type = dtype); return.
4. Scale by the current relation `r = relation1(Y→X)`: `dv>0`: if r<0 → dv×2 and cap so that r+dv ≤ 10; else dv ÷ (r/25 + 1). `dv<0`: if r>0 → dv×2; else dv ÷ ((−r)/25 + 1). (divisor ≥ 1)
5. Y's personality: Honorable & dv<0 → ×2; Xenophobic: dv<0 → ×3/2, dv>0 → ×3/4. Remember this value as `v1`. *(conflict: manual text says Xenophobic "halves positive, doubles negative"; code uses 3/4 and 3/2.)*
6. If X's **race is Human** and dv>0 → ×2.
7. If at war (treaty ≥ WAR) and `4 ≤ dtype ≤ 12` and dv<0 → (if X human: `mood_peace(Y→X) += dv/4`, `mood_peace(X→Y) −= dv/4` i.e. the human's record becomes *more* peaceable) and `dv := 0`.
8. If both are AI and year > 100: dv>0 → ×2; dv<0 → ÷(difficulty/2 + 1) (÷1,1,2,2,3 for Simple..Impossible) — late-game AIs forgive each other more at high difficulty.
9. If dv ≠ 0: `relation1 = clamp(r + dv, −100, 100)`; `mood_treaty/trade/tech += dv` in both records; `mood_peace`: if v1<0: X's `−= v1/4` and Y's `+= v1/4`, else Y's `+= v1`; if X is human, dtype ≠ 0 and |dv| > |current diplo_val|: store the notice (value dv, type, planet, p2).
10. **Always:** if treaty ≥ WAR: `relation1 = max(relation1, −25)`; if treaty ≠ ALLIANCE: `relation1 = min(relation1, 65)`; mirror. (So wars pin attitude near −25 after any interaction; only alliances can exceed 65.)

### 7.2b Event sources and magnitudes (before step-4 scaling) [C unless noted]
| Source | actor → target | dv | dtype |
|---|---|---|---|
| NAP upkeep, 50 %/turn per pair | lower-index → higher-index (target must be AI) | +d3 | 0 |
| Alliance upkeep, 50 %/turn | same | +d6 | 0 |
| Trade upkeep, 50 %/turn | same | +d3 | 2 (message shown only 1 in 10) |
| Human fleet larger than AI's (§9.2) | human → AI | −10 | 8 |
| Growth complaint to allies (§9.2) | big empire → each allied AI | negative, scales with excess planets | 12 |
| AI–AI random gesture (1-in-20 per tick) | p1 → p2 | +d5 | 1 |
| Space battle / bombing fallout | offender → injured AI | −offense (§7.3) | 9 / 10 / 11 |
| Bio-weapon use | offender → every other AI | −10 | 11 |
| Third-party goodwill | offender → AI at war with the victim | +offense | 3 |
| Ground invasion | §4.9 | −(5..8), −(6..10)×pop, −(51..100) | 10 / 13 |
| Human spy caught stealing | human → target | −(sum of 5 d12) if any spy caught (5..60) | 4 |
| Sabotage/frames | §10 | −(20..39), −(d12+d12), −(d20+20) | 6 / 7 / 5 |
| Council vote | voter → candidate | +24 (voted for it), −12 (voted for the other), −6 each (abstained) | 0 |

### 7.3 Primitives (exact effects) [C]
* **set_treaty(X,Y,t)**: both sides.
* **break_treaty(breaker B, victim V)**: no-op if V is already at war with B. `w` = −10 (NAP) / −20 (alliance) / 0; **Classic keeps this sign (Classic+ negates it)**; Honorable breaker doubles w. `trust(B→V) −= w` (**Classic: trust *rises* 10/20**, ×2 Honorable). If it was an alliance: both `relation2 := max(relation2 − w, −100)` (**Classic: baseline +20**). If w ≠ 0 (a real treaty existed): `broken_treaty(B→V) := old treaty` (Classic also on V's side), and `relation1 := max(relation1 − d20, −100)` (both). Always: treaty := NONE both; bounties cleared; **all four moods := −200 in both records**.
* **start_war(P, Q)** [P = the declaring party; it is the "breaker" charged with the §7.3 break-treaty penalties]: no-op if already at war. Marks first contact for humans; break_trade; break_treaty(P,Q); relation2 −5 (both); `relation1 := −(75 + d25)` (both); treaty WAR; moods treaty/trade/tech := −200, peace := −130 (both). **Call-site convention:** every AI declaration passes the aggressor first (wage_war paths, sub3, ally cascade, assassin event); the *human's* declarations (threat, "join war" request) pass the human first. The two "human captured/depopulated an AI planet" paths pass the **victim** first and go through `start_war_swap`: in Classic the swap is **not** applied, so the AI victim is the charged "breaker" (the player escapes the trust/relation2/broken-treaty bookkeeping but still takes the −(50..100) relation hit and the −200 moods); Classic+ swaps so the player is charged.
* **stop_war(P,Q)**: treaty NONE, `relation1 += 40` (cap 100, both), and **if P or Q is human a ceasefire of 8..13 turns** (`d6+7`) is set toward that human. Moods untouched.
* **break_trade**: trade amounts/percent/established := 0; bounty links cleared.
* **set_trade(P,Q,bc)**: new `percent = (percent_old × est_old − bc × 30)/(est_old + bc)` when raising the volume (can go negative), else unchanged; capped 100; volume := bc.
* **annoy(P→Q, n)**: all four moods of P toward Q −10·n.
* **Space-battle fallout `battle_finish(def, att, popdiff, appDef, bio, appAtt)`**: *injured party* = the planet's **claimant** if it is one of the two combatants, otherwise the AI-controlled **attacker** if the attacker is an AI, otherwise the defender; the other side is the **offender** (so a human defending against an AI attack still angers the AI by destroying its ships [W: forum "even a pacifist AI hates you for defending"]). `offense = max(5×pop killed, min(apparent force the injured side lost, 50), 10×bio damage)` where apparent force = Σ (hull index+1)×ships lost. If the injured is an AI: `act(−offense, offender→injured, type 11/10/9 = bio/pop/other)`. Bio damage also `act(−10)` from every other AI. If `offense ≥ 30` and the offender is human: every other AI that is at war with the injured side either marks a bounty as earned (if it had posted one on the injured side; payment is **disabled in Classic**) or — only if the injured side has just lost its **last planet** — `act(+offense)` type 3 *(source suspects the bounty test indexes the wrong array)*.
* **Bombing fallout** (human bomber): if the planet is depopulated: treaty < WAR → automatic **war** (swap order) and `act(−(50 + d50))` type 13, else same dv type 10; otherwise battle_finish with the population killed.

### 7.4 Trust, blunders, memory [C]
`trust` enters every acceptance formula additively. Only two things move it: tech tribute (+`d8+2`, cap 30) and treaty breaking (Classic: the *breaker's* trust in the victim goes **up**; in Classic+ down). `blunder` captures the last hostile message type (4..11, or 12..19 via the +38/+46 variants) at turn start and is replayed as a reproach with 50 % when you next ask for something and are refused; `broken_treaty` is replayed with 25 % (type 33) then cleared.

### 7.5 Availability of an audience [C]
* The Races screen lists an AI iff `contact` and alive. The player **cannot open an audience** if the game has ended, or the AI is "gone": `trust + min(moods) + reldiff[AI personality] ≤ −100` or `min(moods) ≤ −100`.
* Greeting (`aud_start_human`): `g = trust + min(moods) + reldiff[AI]`. If `g < −100` the AI gives a single hostile message and refuses to deal (type **20** if at war, else **21**). Otherwise `g += relation1`; type **22** if `g > −50` else **23**, and the menu opens.
* In the menu, if `min(moods) < −100` the AI says "talk later" (type 74).
* Menu enabling [C]: *Propose Treaty* always; *Trade* off at war or if the maximum new volume is ≤ 0 (volume ceiling `L = min(prodPlayer, prodAI)/4`, ≤32000, in 25-BC steps; options are `+25..+100` when the headroom < 125, otherwise 1/5..5/5 of it); *Threaten/Break* off at war; *Tribute* off if reserve < 25 BC and there is nothing to give; *Exchange Technology* off at war. Treaty submenu: NAP only if treaty NONE; Alliance if treaty NONE/NAP; Peace only at war; Declare-war list = empires the AI is not at war with (excluding you and itself); Break-alliance list = contacted empires the AI is allied with (NAP-breaking only if a house rule flag is set — off in Classic).

### 7.6 Response grading — the core acceptance formula [C]
For a request with threshold `a0` and mood channel `M` (treaty/trade/peace/tech):
`S = mood_M + trust + relation1 + 50·[player's race is Human] + reldiff[AI.personality] + d100 − a0 (+40 if currently allied)`.
Result code: **S ≥ 0 → 3 accept; −50 ≤ S < 0 → 2; −75 ≤ S < −50 → 1; S < −75 → 0 hard refusal.** Immediately afterwards the AI is "annoyed" (`annoy(player→AI, 1)` = −10 on all four moods) and the **asked channel is reduced**: treaty/trade −`(d30+20)`, peace −`(d50+50)`, tech −`(d50+20)`. (Both happen *after* S is computed.) Codes 1 and 2 trigger a **sweetener** offer; 3 applies the request.
**Sweetener (`game_audience_sweeten`)**: AI asks for either a tech (when code = 1, or when the BC amount is 0) or BC. BC = `(((d8 + d8) × year)/25) × 25` (set to 0 if it exceeds your reserve). Tech = a random tech you have that the AI lacks, with AI-side value ≥ `year` (value rules in §7.7), excluding your newest tech per field. If you agree the request is granted (code 3): BC is transferred or the tech is given to the AI.
Per request:
| Request | Gate | `a0`, channel | On accept | Notes |
|---|---|---|---|---|
| Non-aggression pact | treaty NONE; **relation1 > 10** else refused | 50, treaty | NAP | |
| Alliance | treaty NONE/NAP; **relation1 > 50** else refused | 125, treaty | ALLIANCE | |
| Peace (at war) | none | 60, **treaty channel in Classic** (peace channel in Classic+) | stop_war (+40 relation, ceasefire 8..13) | `annoy(2)` is applied **unconditionally** |
| "Declare war on X" | X not at war with AI | if you are allied with the AI **and** at war with X: accept 7/8, else code 2 (1/8); otherwise `a0 = relation1(AI→X) + 150` (Classic+ adds 30×treaty level), treaty | AI declares war on X | |
| "Break alliance with Y" | **relation1(you→AI) > 24** | `a0 = relation1(AI→Y) + 175`, treaty | AI breaks its treaty with Y (AI is breaker) | |
| Trade volume | at least a 25-BC step headroom | 50, trade (codes 1/2 become refusal — **no sweeteners**) | set_trade | `annoy(1)` and `mood_trade −= d30` are applied every time the menu is used |
**Worked probabilities** (all else equal, `S0 = mood + trust + relation1 + 50·human + reldiff`): acceptance probability for `a0` is `clamp((101 − (a0 − S0))/100, 0, 1)`. With quiet moods (≈105), relation 20, non-Human player: NAP `S0 − a0 = 105 + 20 + reldiff − 50 = 75 + reldiff` ⇒ certain even for Xenophobic (−50); alliance at relation 60: `105 + 60 + reldiff − 125 = 40 + reldiff` ⇒ certain (Xenophobic 91 %). Right after a request (moods ≈ 55) or after a threat (treaty mood forced to −120) the same asks fail — **spamming requests makes the AI refuse**; waiting ~5–10 turns restores it. Peace right after a war starts is impossible: `S0 ≈ (−200 + 16t) + (−25) + reldiff + trust + d100 − 60` becomes ≥0 only after ~12–15 turns, and the AI refuses to speak at all while a mood is ≤ −100.

**Acceptance by AI personality (worked table, player race ≠ Human unless stated; moods "quiet" = 105 unless stated).** Only the *personality* matters through `reldiff`; the AI's **objective, race and difficulty play no role** in acceptance (verified: none of the `aud_*` functions read them). `P = (101 − k)/100` clamped, `k = a0 − S0`:
| Scenario (`S0` before reldiff) | Xenophobic −50 | Ruthless −30 | Aggressive −20 | Erratic 0 | Honorable +10 | Pacifistic +20 |
|---|---|---|---|---|---|---|
| NAP, relation 20, mood 105 (`S0 = 125`) | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| Alliance, relation 60, mood 105 (`S0 = 165`) | **91 %** | 100 % | 100 % | 100 % | 100 % | 100 % |
| Alliance, relation 60, mood 60 (second ask in a row; `S0 = 120`) | 46 % | 66 % | 76 % | 96 % | 100 % | 100 % |
| Trade, relation 0, mood_trade 105 (`S0 = 105`) | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| Peace ≈13 turns after a war began (mood_treaty ≈ 0, relation −25, `S0 = −25`, `a0 = 60`) | 0 % | 0 % | 0 % | 16 % | 26 % | 36 % |
| same, **player is Human race** (+50) | 16 % | 36 % | 46 % | 66 % | 76 % | 86 % |
Gates still apply first (NAP needs relation > 10, alliance > 50; below the gate the answer is a hard refusal regardless of mood). The AI's *offers* (§8.3) use the same base but add the personality offset only through `reldiff`, plus the Aggressive/Erratic/Honorable/Pacifistic-only sweeteners.

### 7.7 Threats, tribute, tech exchange [C]
* **Break NAP / alliance / trade** (your option): you are the breaker (§7.3: treaty NONE, relation1 −d20 if a pact existed, all four moods −200, `broken_treaty` memory; breaking only trade resets trade and moods). Message type 73. In Classic `annoy(10)` (−100 on all four moods) is applied whenever you open this menu, even if you back out.
* **Threaten to attack** (`aud_threaten`): `V = d200 + mood_treaty/2 + 2·reldiff[AI] + 100·(your production / AI production)` (+100 if AI production is 0). Side effects first: relation1 −= d15 (floor −100, mirrored), `mood_treaty := −120`. 
  * `V < 170`: war with probability `P(d15 − reldiff > d100)` (Xenophobic ≈ 57 %, Ruthless ≈ 37 %, Aggressive ≈ 27 %, Erratic ≈ 7 %, Honorable ≈ 1 %, Pacifistic 0) → **war is started with you as the nominal aggressor** (type 13), else defiant refusal (type 69).
  * `V ≥ 170`: the AI submits: **ceasefire `d15+5` (6..20) turns** toward you, message 70; **your spies are set to hide** (Classic bug: it hides *your* spy mode toward the AI; Classic+ hides the AI's); `V ≥ 200`: also pays **BC = ((d8 + 2) × year/25) × 25** (type 71); `V ≥ 275`: gives a **technology** instead of BC (a random tech it has and you lack, never its newest tech in a field).
  * So a player with production ≥ 1× the AI's (V ≈ 100 + d200 + moods) gets submission ~70 % of the time; weaker players mostly fail.
* **Tribute BC** (`aud_tribute_bc`): you pay 25..100 BC steps (up to ¼, ½, ¾, all of min(reserve, 32000)); relation gain `v`: **Classic: 0** (original bug) when the AI has production; Classic+: `bc×12/AI production`; ×2 if you are Human race; relation capped as in step 10 of §7.2. Effectively a no-op in Classic.
* **Tribute tech**: pick a tech from your list (up to 4): relation gain `v = ((d8 + d8 + techIndex/4) × base)/10` with `base = 20` if relation < 0 else `(100 − relation)/10`, ×2 if Human race; `relation1 += v` (cap 100; war cap −25, non-ally cap 70), `mood_peace += v` (cap 200), `trust += d8+2` (cap 30). The tech is given to the AI immediately.
* **Exchange technology** (`menu_tech`): scale `K = max(75, (|x|+100)/4 if x<0 else 20000/(x+200)/4)` where `x = trust + relation1/2 + 50·human + 2·reldiff + di + d100 − 125`, `di = min(mood_tech/5 (if >0), 30)` (+25 if allied) — i.e. **K ≥ 75, larger when the AI dislikes you (up to ≈140)**. For each tech you ask for (value `val`), the AI will give it if you offer a tech it lacks whose AI-side value ≥ `val × K/100`; you choose one of the AI's techs (≤5 listed) and one of your qualifying techs (≤4). Both are exchanged. Then `annoy(1)`, `mood_tech −= d50+20` on entry and `annoy(3)` and `mood_tech := min(mood_tech, 50)` afterwards.
* **Tech value (for steal/trade, `game_spy_esp_get_value`)**: `value = techIndex²` × 10 (if "singular" group) × 6 (improved robotic controls) × 3 (reduced industrial waste, eco-restoration); ÷4 if the receiver already has a better tech of the same group; **0 if it has the same-index tech**; 0 for Silicoid receivers in three groups; **Death Ray = 30000**. Candidate selection is random (up to 500 draws, ≤6 candidates).

### 7.8 Message type codes (what the AI "says") [C for assignment, texts not recoverable from code]
0 none · 1 tribute thanks/gesture · 2 trade thanks · 3 thanks for attacking our enemy · 4 caught stealing tech · 5/7 framed espionage/sabotage · 6 sabotage · 8 your fleet threatens us · 9/10/11 attack / invasion / bio-weapons · 12 your empire grows too large · 13 war declared on you (hostile) · **14–19 first-contact greeting by AI personality (14 Xenophobic, 15 Ruthless, 16 Aggressive, 17 Erratic, 18 Honorable, 19 Pacifistic)** · 20–23 audience openings · **24 offers NAP · 25 offers alliance · 26 offers trade (amount) · 27 demands you break an alliance with its enemy · 28 offers a bounty for attacking X · 29 offers tech exchange · 30 offers peace** · 31 generic refusal · 32 "we will break our treaty" · 33 reproach for a treaty you broke · 34–41 reproach for blunder 4–11 · 42–49 warning (+38) · 50–57 treaty broken because of blunder (+46) · 58 bounty paid · 59 final war · 60 war declaration (neutral relation) · 61 Erratic sudden war · 62–65 answer to NAP / alliance / trade / peace request · 66 thanks for a tribute tech · 67/68 answer to war/break-alliance requests · 69 threat refused · 70/71 threat accepted (71 with BC) · 73 treaty/trade broken by you · 74 talk later · 75 nothing to trade · **76 ally asks you to declare war on X · 77 ally breaks the alliance · 78 you joined**. (79/80 council messages.) A clone needs its own texts per category; a random variant index is chosen per type.

---

## 8. AI-INITIATED diplomacy toward the human (priority 5)

### 8.1 Per-turn chain (`turn_diplo_p2`) [C]
For every (human H alive, AI A alive) pair, evaluated in AI index order, after the Council:
1. `treaty = FINAL_WAR` or pending type 59 → keep/clear and stop.
2. **First contact** (`have_met == 1`): set 2 and queue greeting **type 14 + A.personality**.
3. `bounty_collect[A] ≠ none` → queue type 58 (bounty "paid").
4. Pending type 13/32/60/61 (war/treaty-break notices set earlier this turn) → leave as is.
5. Otherwise: `v = min(moods)`, `v2 = v + trust + reldiff[A]`, `dv2 = 2·diplo_val` (diplo_val = the largest-magnitude recorded act of **this turn**; reset each turn).
   * `v2 ≤ −100` or `v ≤ −100` → queue nothing.
   * `diplo_val < 0` (you did something bad this turn): if `hatred > 0` or `d100 < |dv2|` → **reaction §8.4**, else nothing.
   * at WAR and `d100 + 30 < mood_peace` → reaction/peace logic §8.4.
   * `d100 < dv2 + (3 if hatred = 0)` **and** 1-in-4 → if `hatred > 0` then `hatred := 0` else **proposal generator §8.3**.
   * else **ally war-help request §8.5**.
6. If nothing is queued → **war-declaration checks §3.2 (paths A–E)** with target = H, aggressor = A.
7. A queued type 2 is cleared with probability 9/10.
The queued message is delivered the same turn as an "AI calls you" audience (§7.5–7.6 machinery in mode "AI-initiated").

### 8.2 Probability feel
Quiet turn (`diplo_val = 0`, `hatred = 0`): proposals fire with `2 % × 25 % = 0.5 %` per AI per turn. After a positive recorded act of size k: `((2k+3−1)/100) × 25 %`. Ally help requests: 10 %/turn if allied and a suitable enemy exists. Hence **the AI mostly talks to you *because of what you just did***, plus war declarations and treaty breaks.

### 8.3 Proposal generator (`sub1`) [C]
Skip (nothing queued) if: no contact or treaty ≥ WAR; **the AI has any fleet en route to one of your planets**; a message is already pending and a 1-in-2 roll succeeds. Let `base = trust + relation1 + 50·[your race is Human] + reldiff[A.personality]`. First that fires wins (later ones need "nothing yet"):
1. **NAP (24):** treaty NONE, `relation1 > 15`, `base + d100 + mood_treaty > 50`.
2. **Alliance (25):** (treaty NAP or step 1 fired), `relation1 > 50`, `base + d100 + mood_treaty > 100` (upgrades the offer).
3. **Trade (26):** `base + d150 + mood_trade > 50`; ceiling `L = min(prod_you, prod_AI)/4` (≤32000), `want = rnd(1..L/25)×25`; offered only if current trade < want.
4. **Bounty (28):** pick the last empire X ≠ you, ≠ A such that A is at war with X and you have contact with X; 1-in-10 and no bounty already; gift = a tech A has and you lack (excluding A's two newest per field), else BC `((d3+1)×year/50)×50`; sets `attack_bounty[A] = X` (you "earn" it by hurting X; actual payment is off in Classic).
5. **Tech exchange (29):** `base' + d100 + mood_trade > 25` where `base'` uses `relation1/2`, the **AI's** race for the +50 Human bonus (a source quirk), `di` as in §7.7; picks a tech the AI wants (value `z`), `zval = z×100/min(50, f(x))` — **the offer is queued only if one of the AI's techs has value ≤ zval after being filtered to value ≥ zval, i.e. essentially never (exact equality)** [C]; if it fires, `mood_tech` is zeroed.
6. **Appeasement NAP (24):** nothing yet, `relation1 < 0`, **your production > AI production**, treaty NONE.
7. **Sweetener** for offers 24/25 only: AI personality is Aggressive/Erratic/Honorable/Pacifistic (i.e. `trait1 > Ruthless`), `d100 ≤ 30·prod_you/prod_AI` and 1-in-8: 3/4 BC `((prod_AI/(d3+1) + year)/25)×25`, 1/4 a tech the AI has and you lack.
Acceptance is yours; accepting a 24/25/26/30 applies treaty/trade (and the sweetener); refusing does nothing, except type 27 (below).

### 8.4 Reaction to provocation and peace overtures (`sub3`) [C]
With `base` as above (+0 if you are not Human race):
* **Not at war:** `relation1 ≤ −95` → AI **declares war** (type 13). Else if `base − d100 + mood_treaty ≤ −100` (it is angry): if `hatred > 0`: `hatred += 1`; if `hatred > 2` **or** treaty NONE: war with probability `−(reldiff[A]/2 + diplo_val) %` (Xenophobic ≈ 55 %, Ruthless ≈ 45 %, Aggressive ≈ 40 %, Erratic ≈ 30 %, Honorable 25 %, Pacifistic 20 %, for a −30 grievance), then `hatred := 1`; otherwise (hatred 2 with a treaty) the queued complaint is converted (+46) and **the AI breaks the treaty**. If `hatred = 0`: `hatred := 1`; if a NAP/alliance/trade exists the complaint becomes a **warning** (+38). Ladder: warning → treaty break → war.
* **At war** (reached only when `d100 + 30 < mood_peace`): peace offer (type 30) if `base + d100 + mood_peace ≥ 50` and 1-in-8; then with probability `30·prod_AI/prod_you %` a sweetener is attached (3/4 BC, 1/4 tech). If you accept a peace offer: stop_war, `relation1 += 20` (if < 80), `annoy(2)`. Per-turn probability of a peace offer rises from 0 (first ~12 turns) to ≈ 8–9 % per turn once `mood_peace` ≥ 100. *Pacifistic leaders only get the +20 `reldiff`; nothing else in the code makes them "sue for peace more rapidly" [I: manual claim not found].*

### 8.5 Ally requests and demands [C]
* **War help (76):** treaty ALLIANCE, 1-in-10: pick the last empire X ≠ you/AI at war with the AI, in your contact, not at war with you. Accept ⇒ you are at war with X (type 78); refuse ⇒ **the AI breaks the alliance** (type 77, A is breaker).
* **Alliance conflict (27)** is checked at the start of *every* AI-initiated audience: if you are allied with an empire at war with this AI it demands you break that alliance; accept ⇒ you break it (you pay the breaker penalties); refuse ⇒ `relation1 := −100` (both) and, if the call was a type-76 request, the AI breaks its alliance.

### 8.6 What the AI never does
No tribute demands (the "demand BC/tech" strings are multiplayer-only), no ultimatums, no unprovoked offers of tech gifts, no proposals while it has fleets heading for your planets, no proposals when a mood or `trust+mood+reldiff` is ≤ −100.

---

## 9. AI–AI diplomacy, complaints, ceasefires

### 9.1 The AI-vs-AI tick (`turn_diplo_p1`) [C]
Runs every turn after random events; for **every ordered pair of distinct AIs (p1, p2)**: continue only if `contact` and a **1-in-(15 − 2·difficulty)** roll succeeds. Then, with `base = trust(p1→p2) + relation1 + reldiff[p2.personality] + d100`, +10 if NAP, +20 if allied, +10 if trade_bc ≠ 0, and `M = mood_treaty(p1→p2)`:
1. `base + M > 150` and not allied → **ALLIANCE** (instantly, no consent roll); else `base + M > 150` and not NAP → **NAP** (this *downgrades* an existing alliance — Classic quirk; pairs oscillate).
2. else if `mood_tech + 80 < base`: **tech swap** — each empire receives one random useful tech from the other (the donor's `r` newest techs per field are excluded, `r = d3`; index = (year XOR r) mod candidates); only if both have something to give.
3. else if `base > 70`: **trade agreement** `bc = min(prod1/4, prod2/4, 32000)`.
4. 1-in-20: friendly gesture `act(+d5, p1→p2, 1)`.
5. If at war: **classic quirk**: `v` is overwritten with the stale "last diplomatic message subtype" (−1..13), and if `v + mood_peace(p1→p2) > 100` → `stop_war` (so wars end once `mood_peace ≳ 95`, after ≥ ~19 turns, when the pair is selected). 
6. `annoy(p1→p2, 3)` (−30 on four moods) → alliance-conflict check (an AI allied with two AIs that are at war with each other drops **both** alliances; the loop is buggy, see §17) → **war-declaration checks §3.2 with target p1, aggressor p2**.
Second pass (every AI tick turn): for each alliance p1–p2 and each AI p3 at war with p1 but not with p2 → **p2 declares war on p3**.
Typical outcome: AIs of similar attitude quickly ally (needs `trust + relation + d100 + … > 150 − M`: with M≈105 an alliance forms when `relation1 + reldiff + d100 > 45`), allies automatically inherit each other's wars ⇒ **two-bloc galaxies or chaos [W]**; wars end by the quirk in (5) and restart via §3.2.

### 9.2 Relation maintenance every turn (`game_turn_diplo_adjust`) [C]
* Treaty upkeep goodwill (§7.2b) for every pair (50 %/turn).
* **Fleet complaint:** for each AI `a` and human `h`: let `s_a = game_stat_fleet(a)`, `s_h = game_stat_fleet(h)` (0..100 band scale of hull-weighted ship counts, bands 125, 250, 500, … ×1). If `0 < s_a < s_h`, `d100 ≥ 50·s_h/s_a` and 1-in-20 → `act(−10, h→a, type 8)`. (Highest odds when you are only slightly stronger; vanishes when you are > 2× stronger.) Only the *human's* fleet is compared this way.
* **Growth complaint** (even turns only): `gscale = 3·(galaxy size index+1)` (3, 6, 9, 12); `gdiv = size index + 6 − difficulty`; `n` = planets with ≥ 100 BC production. If `n > gscale` and 1-in-4: `v = d4 × (−(n − gscale)/gdiv)`, `v = (v/3)×4` (halved if human) → `act(v, empire→each allied AI that is in contact, type 12)`.
* Relation drift (§7.1) and mirroring.

### 9.3 Ceasefires [C]
Only humans get them: peace treaty (8..13), successful threat (6..20), counted down by 1 each turn. Effects §5.4.

---
## 10. Espionage AI (priority 6)

Three independent pure steps per turn: **(S1) settings** (`turn_p3`, per AI, only when year > 30), **(S2) spy purchase** (`game_spy_build`, every empire), **(S3) mission resolution** (`game_spy_turn`, every ordered pair). Humans use the same S2/S3; only the *choices* in S1 and the choice of tech/sabotage type differ.

### 10.1 S1 — AI spy/security settings (`turn_p3`, `turn_p3_sub1`) [C]
1. `security = (coin flip ? Σ over contacted empires of THEIR spies in this AI's territory : 0) + 8·difficulty`, capped at **100** (units: per-mille of production, i.e. 100 = 10 %). Simple 0, Easy 8, Average 16, Hard 24, Impossible 32 baseline.
2. For every other empire X: default mode **hide**. If X is a human with an active ceasefire (source tests the wrong index but the result is "hide") → hide. Else if X is in contact:
   * treaty ≥ WAR → **sabotage**;
   * otherwise: **Darlok always roll; every other race rolls only on a coin flip**; the roll succeeds if `d200 > 200 + 2·relation1` ⇒ P = `(−relation1)/100` for relation1 < 0 (0 for relation ≥ 0; −100 ⇒ 100 %), success ⇒ **espionage**; failure ⇒ hide. (The "sabotage vs non-war enemies" branch is unreachable in the source.)
3. Activation each turn: for X in contact with `mode ≠ hide`: if **X is human → always; if X is an AI → only 1-in-3 turns**: `spymode[X] = mode`, **`spying[X] = d5 + 5`** (6..10 tenths of a percent of production, i.e. 0.6–1.0 %); otherwise `spymode = hide`, `spying = 0`. (Settings are re-rolled every turn.)
So an AI spies (steals tech) on empires it dislikes (relation < 0), saboteurs on enemies at war; friendly empires are never spied on. A human player who keeps relations ≥ 0 and avoids wars is never spied on by AIs.

### 10.2 S2 — buying spies (`game_spy_build`) [C]
For each empire E and target X with `spying[E→X] ≠ 0`: `fund = prod_E × spying/1000 + spyfund[X]`; `cost0 = 2·computerTech% + 25` BC (**halved for Darlok**); loop: while `fund ≥ cost`: `spies += 1`, `fund −= cost`, `cost ×= 2`; remainder stored in `spyfund[X]`. (Cost doubles only within a single turn's purchase.) Production loss from spying/security is `(spysum + security)/1000` of production (`spysum` = Σ spying values). Example: AI with 500 BC production, spying 8 ⇒ 4 BC/turn ⇒ a new spy every 15–20 turns at mid computer tech.
*Human sliders (UI):* per-target spying 0..100 (tenths of %, step 4), security 0..200 (tenths of %), shown bonus `security/5 (+20 for Darlok)` percentage points.

### 10.3 S3 — mission resolution (`game_spy_turn`) [C]
For each ordered pair (spy empire S, target T), S ≠ T, both own planets, with `n = spies of S in T`:
* `defT = T.computerTech% (+20 if Darlok)`; `attS = S.computerTech% (+30 if Darlok)`; `dt1 = max(0, attS − defT)` (success bonus), `dt2 = max(0, defT − attS) + T.security/5` (detection bonus).
* **Hide mode:** each spy is caught if `d100 + dt2 > 85`; no mission.
* **Otherwise per spy:** `r = d100 + dt2`: `r > 99` → **every** spy of S in T is caught and fails (stop); `r > 70` → this spy is **caught** (removed permanently) and failed; `r > 50` → failed but survives (and counts as "caught-alert" for blame purposes); else fine. Surviving, non-failed spies are the active pool `m`.
* **Mission roll:** `d100 + dt1 > 84` ⇒ the mission succeeds for all `m` active spies (chance **16 % + dt1 %** per turn); if `d100 + dt1 > 100` a **frame-up** is possible (needs a positive computer advantage; chance = `dt1 %`).
* **Espionage (mode 1):** `rmax = (max of m rolls of d100) × (T's best tech-field percentage)/100`. Candidate techs = those T has that S lacks (rules: techs in 12 "group" families are excluded if S already has an equal or higher tier of that family; Silicoid S also ignores three families), then **only techs whose index ≤ rmax** survive; one random candidate is taken (list of ≤6 built by random draws). It is added to S immediately (AI spy: "stolen from AI-spy" source). **One tech per successful turn.** Blame: the target human is told which empire stole it only if some spy was caught (`flag_any_caught`); with a frame-up the report names a random third empire in T's contact list. AI-vs-AI frame-up: with 1/2 chance a random *human* in contact with T is made to look guilty: `act(−(d20 + 20), human→T, type 5)`.
* **Sabotage (mode 2):** `rolls = ((S.weaponTech% + 9) × m)/10` dice of d5 summed = `sab`. Planet = random planet of T; target type: 50 % bases, 50 % factories. *vs a human target:* 25 % → **unrest** (rebels += `pop × (sab/2)/100`, clamp 1..pop; planet in rebellion if rebels ≥ pop/2); else factories destroyed `min(sab, factories)` or bases destroyed `min(sab/5, bases)`. *vs an AI target:* same without the unrest branch. Diplomatic fallout (AI vs AI): not framed → `act(−rcaught, S→T, type 6)` with `rcaught = d20+20` if any spy was caught, else 0 (no effect); framed → `act(+(d16+d16))` on a random third party (**sign looks inverted — likely an original bug**).
* **Human spy specifics:** the human picks the stolen field (one tech per field list, up to 5 candidate rounds) or the sabotage type. Relation penalty to the victim AI: espionage — if any spy caught and not framed: `act(−(sum of 5 d12), type 4)` (5..60), otherwise `act(−(your player index))` (0 for player 0 ⇒ none); sabotage: the code reuses the espionage array so the penalty is normally 0 *[C1, suspect]*; a successful frame-up makes the human choose one of two other empires to blame (`act(−(d12+d12), type 7)`).
* **Caught spies** are lost (S's spy count in T decreases); failed-but-not-caught spies stay.
Expected yield: at equal computer tech each spy survives a turn ≈ 50 % (1 % chance the whole group is wiped), the mission fires 16 % of turns ⇒ ≈ 1 tech per ~6 turns for a group of ≥1 survivors; a computer lead of +30 % raises it to 46 %/turn; defender security +100 adds only +20 to the detection roll. So **computer tech is the real counter-intelligence**; "too many spies" is pointless because the 1 % wipe-out roll is *per spy*.

---

## 11. Galactic Council (priority 6)

### 11.1 Schedule [C]
After AI-vs-AI diplomacy each turn: hold an election iff **no cheat flag**, `council interval (25) ≠ 0`, `(year % 25 == 0 or no election has ever been held)`, **≥ 3 empires alive**, **owned planets ≥ ⌊2·stars/3⌋ (i.e. ≥ 2/3 of all stars colonised)**, and the game has not ended. So the first vote happens the first turn the 2/3-colonisation condition holds, later votes on every turn number divisible by 25 (`year` is the internal turn counter starting at 1). After the first election `election_held = true`, which also doubles AI "threat" values (§4.1).

### 11.2 Votes and candidates [C]
`votes(E) = ceil( Σ population of E's planets that are not in rebellion / 100 )` (an empire with no population has 0 votes and abstains). Candidates = the **two empires with the most votes** (ties: lower index first); if the strongest is an AI and the second a human, the human is listed first. Voting order: AIs in index order, the (first) human last.
Per-vote relation effects (acts, §7.2): voting for candidate c: `act(+24, voter→c)`; for the other candidate `act(−12)`; abstaining `act(−6)` toward both (only matters when the candidate is an AI).

### 11.3 AI vote (`game_ai_classic_vote`) [C]
For voter V and candidates c1, c2 (returns 1, 2 or 0 = abstain), first match wins:
1. V = c1 → 1; V = c2 → 2. 2. Allied with c1 → 1; allied with c2 → 2. 3. At war with c1 → 2; at war with c2 → 1.
4. `w(c) = 20·[c owns the Orion planet] + 20·[c's race is Human] + 40·[V voted for c in the previous election]` (0,20,…,100).
5. Candidate 1 test: if `relation1(V→c1) ≥ 0`: vote 1 iff `d100 < relation1/4 + w(c1)`; if negative: vote 2 iff `d100 < −relation1/4 + w(c2)`.
6. If undecided, candidate 2 test: if `relation1(V→c2) ≥ 0`: vote 2 iff `d100 < relation1/4 + w(c2)`; if negative: vote 1 iff `d100 < −relation1/5 + w(c1)`.
7. Else abstain.
(Votes are weighted by the voter's vote count; abstention is common when attitudes are neutral: with relation 0 and no history the chance is only the `w` terms.)

### 11.4 Result [C]
A candidate wins with `got ≥ ((total_votes + 1) × 2)/3` (two-thirds, candidate 1 checked first). **Human wins → game won ("good" ending); AI wins → human loses ("exile")**, but every human may *refuse to accept* the result: refusers go to **FINAL_WAR** with all non-refusers (trade broken), non-refusers ally with each other with relation +100 (and pool technology each turn: `game_tech_final_war_share`); the game continues in "final war" mode where AI "threat" values double again and AI fleet-front logic only considers refusers as enemies. No majority ⇒ nothing happens until the next council. Humans may also manipulate population (transports in flight do not count) before the vote [W].

---

## 12. Special actors, monsters, events

### 12.1 Antarans — **not present in MOO1 mechanics** [C]
No file read (events, turn, battle, ai) contains Antaran raids, arrival schedules or fleets; the only "ancient" actor is the **Orion Guardian**. Treat "Antarans" as a MOO2 feature; implement nothing. (Unverified only in the sense that the whole repo was not text-searched; every relevant file was read.)

### 12.2 Orion Guardian [C]
* One per game, stationed at the **Orion planet** (`planet_orion_i`, a random star; Terran, max pop 120, **4× tech** special). Immobile; fights **every empire** that arrives (battle at the star each turn); after combat all empire ships still at Orion are removed while it lives; transports to Orion die. Defeating it sets `have_guardian = false` and `guardian_killer`; the killer receives the Orion loot (technologies, Death Ray included) via the event loop.
* Stats (tactical): look 0x92, hull Huge, computer Mark X, jammer X, defence/missile-defence = 1,3,5,7,9 (Simple…Impossible), absorb 5,6,7,8,9, extra range 3. HP 2000/4000/6000/8000/10000. Shield class V/VI/VII/IX/XI. Specials: High-Energy Focus, Lightning Shield (+Advanced Damage Control on Hard, repair 15). Weapons: Scatter Pack X-5 ×5/25/45/65/85, Death Ray ×1, Stellar Converter ×5/15/25/35/45, Plasma Torpedo ×6/9/12/15/18.
* AI behaviour around Orion: scouts ignore it until year 150; attack-target lists exclude it until year 120; the AI's "free colonisable planet" test ignores it while the Guardian lives; AI-vs-AI auto-resolve treats it as strength **100,000**. Capturing Orion is announced in the news (`have_orion_conquer`), no special AI reaction; Orion owner gets +20 weight in council votes (§11.3).

### 12.3 Roaming monsters [C]
* **Space Crystal** (hull Huge, shield class V, HP 3000/4000/5000/6000/7000, absorb 5, defence 1..5, Crystal Ray ×10, specials Black Hole Generator + Lightning Shield) and **Space Amoeba** (no shield, HP 1000..5000, Amoeba Stream ×1, Adv. Damage Control, repair 50, absorb 0, defence 1..5). Only one monster alive at a time, only from **year 200**.
* Spawn at a random map edge; each turn it moves 11 units (5+6) toward its destination star (when its counter ≤ 0); on arrival it **nukes the star**: population 0; **Amoeba** also divides factories by 10, turns the planet Radiated with max population 5–20 and **abandons it (owner removed)**; **Crystal** leaves waste = max population − 10 (planet stays owned but empty) [C1]. Then counter := 4, `nuked += 1`, new destination = a random adjacent grid star (never the Orion star or an uninhabitable star); it disappears after **5 nukings** or when killed. If it destroys an owner's last planet that empire is eliminated.
* Monsters fight any empire's ships at their star (auto-resolve strength **30,000**); they destroy all transports at their star. A monster killed by an empire records it as `killer`.
* The AI has no special monster behaviour except: pirates/comet events trigger its "crank ship" hook (§12.4).

### 12.4 Random events (what the AI planners see) [C]
Roll each turn: `chance = max(0, year − year_of_last_event)` (the counter starts at 40), scaled by difficulty (Simple ×1/2, Easy ×2/3, Average ×3/4, Hard ×4/5, Impossible ×1); an event fires iff `d512 ≤ chance`. Victim empire weight = planets (empires with < 4 planets weight 0; **humans ×5**) normalised by `max(5, smallest weight)`. The type is drawn uniformly up to 5 times with rejection rules (event already happened; quake needs pop ≥ 50; monsters year ≥ 200 and none alive; derelict never for humans; assassin never after game end; comet year ≥ 100; pirates need a trader in contact; plague/accident never for Silicoid; enviro/rich/poor/virus planet-quality rules; rebellion only vs humans and not the home planet). Each event type occurs at most once per game (`done` bit). Diplomacy-relevant ones:
* **Assassin:** `start_war(player2, victim)` between the victim and a random AI that has a NAP/alliance with it; for a human victim a type-13 message with value 100 is queued.
* **Pirates:** every empire pair within fuel range loses `pirates_hp/6` % of `trade_percent`; AI planets run "crank ship" (all sliders to ships) at the pirate star.
* **Plague / Nova:** AI planet runs "crank tech" (ship, industry, defence sliders → tech, + 1/5 reserve). **Comet:** "crank ship". Magnitudes scale with difficulty (`plague_val = (d8 + 2·difficulty) × production`, `nova_years = d5 + 10 − difficulty`, `comet_hp = (d5 + 10 + difficulty) × 25`, `pirates_hp = (d5 + 10 + difficulty) × 30`).
* **Genocide check** (each turn): an empire left with **no planets** is eliminated (not for the last human in a single-human game, which ends the game instead). The *killer* is the empire that owns, or has ships at, one of the victim's formerly claimed planets; if there is a killer, **every other empire takes `act(−36)` against it** (so exterminating an empire makes all AIs dislike you).
* **Rebellion event** (humans only) and **coups** (≥ half of planets rebelling): AI traits re-rolled (§7.1).
* Rich/Poor/Enviro/Support/Derelict/Accident/Quake/Virus: economy/tech only.

---

## 13. Difficulty, personality, objective, race adjustments (priority 7)

### 13.1 Difficulty (every item verified [C]; source function in the last column)
| Effect | Simple | Easy | Average | Hard | Impossible | Where |
|---|---|---|---|---|---|---|
| AI planet production multiplier | ×1.00 | ×0.80 | ×1.25 | ×1.50 | ×2.00 | `game_update_production` |
| AI–AI diplomacy tick prob. per ordered pair/turn | 1/15 | 1/13 | 1/11 | 1/9 | 1/7 | `turn_diplo_p1` |
| need-conquer prob./turn (when no colonisable planet exists) | 1/8 | 1/7 | 1/6 | 1/5 | 1/4 | `send_scout` |
| Erratic war roll `d300 ≤ x` | never | 1 | 2 | 3 | 4 | `wage_war` A |
| AIs may break NAP/alliance (wage_war_do) | no | no | yes | yes | yes | `wage_war_do` |
| Pile-on on a hated human (path E) allowed while its wars < x | off | off | 2 | 3 | 4 | `wage_war` E |
| AI–AI negative-act divisor after turn 100 (positives ×2 for all) | 1 | 1 | 2 | 2 | 3 | `diplo_act` |
| AI security baseline (per mille) | 0 | 8 | 16 | 24 | 32 | `turn_p3` |
| AI missile-dodge success per inbound missile | 0 | 0 | 1/3 | 2/3 | 1 | `missile_evade` |
| Retreat bias `v = (5−d)×5+5` (+10/+20/+d15) | 30 | 25 | 20 | 15 | 10 | `battle_ai_retreat` |
| AI next-tech pick = best of list when `d6 < x` | 0 | 0 | 1/6 | 2/6 | 3/6 | `tech_next` |
| AI tax rate (per mille) | d10+2 | d10+3 | d10+4 | d10+5 | d10+6 | `turn_p1_tax` |
| Missile-base slider threshold `pop/(5−d)` | pop/5 | pop/4 | pop/3 | pop/2 | pop/1 | `turn_p3` |
| Random-event chance factor | ½ | ⅔ | ¾ | ⅘ | 1 | `event_new` |
| Event/monster magnitudes | easiest | | | | hardest (HP 3000→7000 etc.) | `event_new`, `tbl_monster` |
| "Magic" colony-ship spawn possible (sibling analyst) | 1/6 of turns | 2/6 | every turn | every turn | every turn | `have_colony_ship` |
| Starting home pop/factories (all empires, human and AI) | 50/30 | 50/30 | 50/30 | 40/30 | 40/30 | `game_new` |
Difficulty does **not** change AI combat rules, ground combat or spy rolls (except security) — the AI's edge comes from production, treaty breaking, piling on, and faster retreats/dodging.

### 13.2 Personality (trait1) [C]
| | Xenophobic | Ruthless | Aggressive | Erratic | Honorable | Pacifistic |
|---|---|---|---|---|---|---|
| `reldiff` (added to *all* accept/propose/war scores of that AI) | −50 | −30 | −20 | 0 | +10 | +20 |
| Negative events on its attitude | ×1.5 | ×1 | ×1 | ×1 | **×2** | ×1 |
| Positive events on its attitude | ×0.75 | ×1 | ×1 | ×1 | ×1 | ×1 |
| Random war (path A) | — | — | — | **yes** | — | — |
| Fleet-envy war (path B) when Militarist/Expansionist | yes | yes | yes | yes | **no** | yes |
| Sweeteners on its own offers | no | no | yes | yes | yes | yes |
| Breaking a treaty (as breaker): trust/relation2 penalty magnitude | ×1 | ×1 | ×1 | ×1 | ×2 | ×1 |
| P(declares war when threatened with V<170) | 57 % | 37 % | 27 % | 7 % | ≈1 % | 0 |
| P(war on repeated provocation, −30 grievance) | 55 % | 45 % | 40 % | 30 % | 25 % | 20 % |
| First-contact greeting type | 14 | 15 | 16 | 17 | 18 | 19 |
| Typical races (assignment tables §7.1) | Silicoid, Klackon (70 %) | Mrrshan (70 %) | Sakkra, Bulrathi, Darlok (70 %) | Meklar (70 %) | Human, Alkari (70 %) | Psilon (70 %) |
No other personality-specific code was found (the manual's descriptions — Ruthless sacrifices ships, Aggressive attacks "at a favourable position", Pacifistic "sues for peace sooner" — are realised only through the `reldiff` offsets above).

### 13.3 Objective (trait2) [C for what exists; the rest belongs to the economy/research analyst]
| | Diplomat | Militarist | Expansionist | Technologist | Industrialist | Ecologist |
|---|---|---|---|---|---|---|
| Path-B war eligibility (§3.2) | no | **yes** | **yes** | no | no | no |
| Treaty-break odds in `wage_war_do` / `send_attack` | base (alliance 25 %, NAP 50 %) | base | **alliance 62.5 %, NAP 100 %** | base | base | base |
| Keeps colony ships flowing even when many planets are "developing" | no | no | **yes** | no | no | no |
| Planet-slider weights ship/def/ind/eco \| comp/cons/ff/plan/prop (rest of d13 → tech; research dice use the last five) | 1,2,4,1 \| 2,2,4,2,3 | 4,1,2,1 \| 3,1,4,2,1 | 2,4,1,1 \| 1,1,3,5,2 | 1,2,3,1 \| 4,2,3,2,2 | 1,2,4,1 \| 1,5,4,1,2 | 1,1,2,4 \| 1,2,4,1,5 |
| War row (used by *all* when any treaty ≥ WAR) | 4,1,1,1 \| 2,2,4,2,1 | | | | | |
| Diplomatic/espionage behaviour in code | **none found** (manual says "trade with allies, spy on enemies" [W]) | none | none | none | none | none |
*(The weights table is indexed by objective in the order Diplomat, Militarist, Expansionist, Technologist, Industrialist, Ecologist; the "eco" weight is read from the industry column due to a source bug.)*

### 13.4 Race [C]
* **Human (race of the *player*):** AI willingness +50 in every §7.6/§8 formula; the player's positive acts count double (`diplo_act`, tribute); trade income +25 %; a Human *candidate* gets +20 weight in AI council votes; every AI starts +12 toward Humans.
* **Bulrathi:** +25 ground-combat force; as *bomber* the AI inflates its own inbound troop count by 20 % (bombs less before invading).
* **Darlok:** spy purchase cost halved; spy-roll computer level +30 attacking / +20 defending; always rolls for espionage (others only on a coin flip).
* **Mrrshan:** +4 tactical computer level; +15 in the auto-resolve design weight (shared with Alkari; +20 in Classic+); AI planets get +15 on the ship slider; weapons-focused research dice.
* **Alkari:** +3 tactical defence and missile defence; auto-resolve bonus; propulsion-focused research.
* **Silicoid:** immune to plague/accident events; spy tech-selection filters; can colonise any planet (colonisation analyst).
* **Slider biases (economy analyst):** Sakkra/Bulrathi +10 ecology while pop < max; Klackon +15; Meklar +20 industry; Psilon +20 tech.
* Initial relation matrix and personality tables: §7.1.

---

## 14. AI playbooks (distilled from the code; status [C] unless marked)

### 14.1 Per personality
* **Xenophobic (Silicoid, Klackon typical).** Willingness offset −50 everywhere: needs relation ≈ +60..70 and a good roll to ally (alliance score `S0 = mood+trust+rel−50−125`), proposes/accepts few treaties, never sweetens. Grudges stick (negatives ×1.5 ≙ twice the effect of positives ×0.75 per unit). **Most war-prone**: its envy checks trigger at the lowest bar (needs `F, P > 100 + rel + trust`); 57 % to answer a threat with war; greeting type 14. *Exploit:* keep relation > 0 and production below its own; it only attacks stronger neighbours.
* **Ruthless (Mrrshan typical).** −30; no sweeteners; war on stronger/hated neighbours when `F or P > 120 + rel`; 37 % war on threat. No special cruelty in code beyond that [manual claim "sacrifices ships" not implemented].
* **Aggressive (Sakkra, Bulrathi, Darlok typical).** −20; makes sweetened offers; same envy logic with bar `130 + rel`; 27 % war on threat. The manual's "attacks when it reaches a favourable position" is just the generic fleet planner (stack > defenders).
* **Erratic (Meklar typical).** Offset 0; **random wars** (§3.2 A) against *anyone it has contact with, allies included* with `difficulty/300` per turn (≈ 1.3 % per neighbour per turn at Impossible; none at Simple); also eligible for path B. Moderate reactions (30 % war on repeated provocation, 7 % on threat). Plays like the median AI plus sudden betrayals.
* **Honorable (Human, Alkari typical).** +10; excluded from the fleet-envy path B; can still declare war through production envy (C), ally cascades, provocation, need-conquer and treaty-breaking (§3.3); **doubles the effect of negative acts on its attitude** (grudge-prone when hurt, e.g. −10 becomes −20 before relation scaling). 1 % war on threat. Manual: "will not attack those it is on good terms with" — realised only through the generic rule that positive `rel` raises `v` (§3.2).
* **Pacifistic (Psilon typical).** +20; the least likely to declare war (needs `F or P > 170 + rel`), never answers a threat with war, 20 % escalation, accepts treaties most easily; but alliances still pull it into wars (§3.4, ally cascade) and allies can ask it to leave alliances. *(Manual "sues for peace more rapidly" is not visible in the code except via the +20 offset in the peace overture score.)*

### 14.2 Per objective (diplomatic/military relevance only)
* **Diplomat:** no diplomatic code path found; behaves like the baseline. Slider dice (out of 13 for the random remainder, with the source's duplicate-weight bug): ship 1, defence 2, industry 4, ecology 4, tech 2.
* **Militarist:** eligible for the fleet-envy path B; slider dice ship 4, defence 1, industry 2, ecology 2, tech 4; weapon/force-field/computer-oriented research dice; builds/keeps the biggest "front" forces among peacetime AIs.
* **Expansionist:** eligible for path B; **breaks alliances 62.5 % / NAPs 100 % when a roll comes up** (§3.3, §3.7); keeps sending colony ships even when most of its planets are still developing; slider dice ship 2, **defence 4** (as read from the table — surprising but literal), industry 1, ecology 1, tech 5; planetology-heavy research dice.
* **Technologist:** slider dice ship 1, defence 2, industry 3, ecology 3, tech 4; computer-heavy research. (No war/diplomacy hooks.)
* **Industrialist:** slider dice ship 1, defence 2, industry 4, ecology 4, tech 2; construction-heavy research.
* **Ecologist:** slider dice ship 1, defence 1, industry 2, ecology 2, tech 7; research dice favour the column labelled propulsion (*conflict: the manual says Ecologists research planetology/construction first — the column labels come from a source comment; the economy analyst should double-check*).
* **Everyone at war** (any treaty ≥ WAR) rolls the war row: ship 4, defence 1, industry 1, ecology 1, tech 6 (out of 13), force-field-heavy research dice.
(The sibling analyst should treat these dice as authoritative for slider planning; the table `ai_p3_tbl_w` is reproduced in §13.3.)

### 14.3 What a "good" AI looks like in play (emergent, from the above)
Early game: expand; fleets garrison colonies (threat 50 rule); nobody attacks until free colonisable planets run out (need-conquer) or relation/envy rolls hit. Mid game: AI–AI alliances snap together within ~10–30 turns, wars propagate through alliances; the strongest empire (often the human) accumulates "envy" wars from weaker neighbours who also pile on once relation < −30 (Average+). Stacks gather at front anchors and strike when their threat sum exceeds the target's, repeatedly, one target at a time per front, bombing then invading with half-population transports. Late game: council votes every 25 turns; elections double AI threat values (bolder attacks); a refusal drives everybody into final war.

---

## 15. Tuning constants (all in one place)

| # | Constant | Value | Where / note |
|---|---|---|---|
| **Diplomacy dynamics** |
| 1 | `reldiff[personality]` | Xen −50, Ruth −30, Aggr −20, Err 0, Hon +10, Pac +20 | `game_diplo_tbl_reldiff` |
| 2 | Relation scaling | positive: ×2 if rel<0 (cap rel+dv ≤ 10) else ÷(rel/25+1); negative: ×2 if rel>0 else ÷(−rel/25+1) | `diplo_act` |
| 3 | Personality scaling | Honorable neg ×2; Xenophobic neg ×3/2, pos ×3/4; Human actor pos ×2 | `diplo_act` |
| 4 | AI–AI after turn 100 | pos ×2; neg ÷(difficulty/2+1) | `diplo_act` |
| 5 | Relation clamps | ±100; at war ≥ −25; not allied ≤ 65 | `diplo_act` |
| 6 | At-war hostile acts (dtype 4..12) | dv→0; `mood_peace` ± dv/4 | `diplo_act` |
| 7 | Mood regen | start of turn: +d5 if <0, +d5 if <50; end of turn: +10 if <100; treaty clamp [−200,120]; peace clamp ±200 | `game_turn` |
| 8 | War start | relation1 −(75+d25); relation2 −5; moods −200/−200/−200, peace −130 | `start_war` |
| 9 | Treaty break | w = −10 NAP / −20 alliance (Hon ×2); relation1 −d20; relation2 +20 on alliance (Classic); trust −w (Classic: rises); moods all −200 | `break_treaty` |
| 10 | Peace | relation1 +40; ceasefire d6+7 | `stop_war` |
| 11 | Annoy unit | 10 mood points per unit | `annoy` |
| 12 | Treaty upkeep | NAP +d3, alliance +d6, trade +d3, each 50 %/turn/pair | `diplo_adjust` |
| 13 | Relation drift | step 1 toward relation2 w.p. ≈ ½·|r|/105 per turn per side | `diplo_adjust` |
| 14 | Fleet complaint | 1/20, needs `d100 ≥ 50·s_h/s_a`, dv −10 | `diplo_adjust` |
| 15 | Growth complaint | even turns, 1/4, threshold 3(size+1) planets ≥100 BC, divisor size+6−difficulty | `diplo_adjust` |
| 16 | Initial relation | 12 × racial matrix (−36..+12) | `game_new` |
| **Player requests** |
| 17 | Grades | S ≥ 0 accept; ≥ −50 BC sweetener; ≥ −75 tech sweetener; else refuse; +40 if allied | `aud_check_mood` |
| 18 | Thresholds `a0` | NAP 50 (rel>10), alliance 125 (rel>50), peace 60, trade 50, war-on-X rel_X+150, break-with-Y rel_Y+175 (rel>24) | `aud_*` |
| 19 | Request cost | annoy 1 (+2 for peace, +10 threats, +3 tech); channel −(d30+20) / −(d50+50) peace / −(d50+20) tech; trade menu −d30 | `aud_check_mood`, menus |
| 20 | Sweetener | BC `((d8+d8)·year/25)·25`; tech value ≥ year | `aud_sweeten` |
| 21 | Threat score | `d200 + mood_treaty/2 + 2·reldiff + 100·prodRatio`; <170 war roll `d15−reldiff > d100`; ≥170 ceasefire d15+5; ≥200 BC `(d8+2)·year/25·25`; ≥275 tech; mood_treaty := −120; relation −d15 | `aud_threaten` |
| 22 | Tech tribute | gain `((d8+d8+tech/4)·base)/10`, base 20 or (100−rel)/10, ×2 Human, caps 100/70/−25; trust +d8+2 ≤30 | `aud_tribute_tech` |
| 23 | Tech exchange scale | `K = max(75, …)` up to ≈140 | `aud_tech_scale` |
| 24 | Greeting | `trust+mood+reldiff` < −100 refuse (20/21); `+rel` > −50 → 22 else 23 | `aud_start_human` |
| **AI→human** |
| 25 | Tick gating | `d100 < 2·diplo_val + 3` and 1/4; |diplo_val|·2 vs d100 for complaints | `turn_diplo_p2` |
| 26 | Proposals | NAP rel>15 & sum>50; alliance rel>50 & sum>100; trade `d150` sum>50; bounty 1/10; tech >25 (≈never); sweetener 1/8 × `30·prodH/prodA %` | `sub1` |
| 27 | Reaction | rel ≤ −95 war; anger test `base−d100+mood ≤ −100`; hatred ladder +38/+46; war prob `−(reldiff/2+diplo_val)`% | `sub3` |
| 28 | Peace overture | `d100+30 < mood_peace`, `base+d100+mood_peace ≥ 50`, 1/8; sweetener `30·prodA/prodH %` | `sub3` |
| 29 | Ally help | 1/10 per turn | `sub2` |
| **War** |
| 30 | War checks | 1/20 (B,C), 1/10 (D), `d300 ≤ difficulty` (A), `v < −150`, ratio clamp ±300, power clamp 3,250,000, path E rel < −30, `d10 ≤ −rel/10`, wars < difficulty | `wage_war` |
| 31 | Treaty-break odds | alliance 1/4 (+½ if Expansionist), NAP ½ (always if Expansionist), only difficulty ≥ Average; relation cap 30 | `wage_war_do`, `send_attack` |
| 32 | need_conquer | 1/(8−difficulty) | `send_scout` |
| 33 | Target weight | `pop − 10·bases + 30·special − 20`; Orion excluded until turn 120 | `planet_w` |
| 34 | Attack | range 15·fuel; 40 % gate; force > defenders + `(5·weaponTech% + 10·(shield+10))·bases` | `send_attack` |
| 35 | Fronts | point 0.4/0.6 centroids; merge radius 10S+10; dummy relation 80; share ×100/sum | `front` |
| 36 | Defence | S·30+20 reach; list `4/3`; send `5/3`; flat 50 for <5 bases & no ships; transports weigh pop×5 | `send_defend` |
| 37 | Idle staging | <8 fleets; reach S·20+20; stacks < total/25 stay | `send_idle` |
| 38 | Transports | invade: S·30+30, pop/2, src pop ≥ max/2 & >20; internal: S·20+20, dest < max/3, src > 3/4 max, pop/3 | `trans_*` |
| 39 | Reinforce | reserve/5 to threatened planets and to pop<20 planets | `build_defending`, `fund_developing` |
| 40 | Hull weight | 1/5/25/125 | `game_num_tbl_hull_w` |
| 41 | Threat | `Σ techIdx·count + (shield+10)·hp/50 + 2·special`; ×2 after election, ×2 after game end; 16-bit | `turn_p1` |
| 42 | Bombing | pop > inbound; Bulrathi inbound ×1.2 (Classic); complevel `(comp−1)·2+6`; pop hp 200 (160..240), factory hp 50 (40..60); bio lowers max pop (floor 10) | `ai_bomb`, `bomb_damage` |
| 43 | Ground | d100 + force; force = 5·armour + 10·suit + 10·shield + 5·weapon(+1 if >2) (+25 Bulrathi) (+5 defender); loot 1/50 per factory | `game_ground` |
| 44 | Transport interception | transport hp `(armour tier+1)·15`; bases ×24 shots; hit if `d20 ≤ (comp−speed)·2+12`; cap 1000 kills; inbound cap 300 | `game_turn_transport` |
| 45 | Auto-resolve | weights ×5/×5/×10/×2/+constr%/2/+15|20, hull mult, planet ×75, Guardian 100000, monsters 30000, d10 % per round | `ai_resolve_do` |
| **Tactical** |
| 46 | Retreat | `v = (5−diff)·5+5 (+10/+20) + d15`; retreat iff `L_ai > v·L_h`; 50-round timeout | `battle_ai_retreat` |
| 47 | Miss % | `50 − 10·(combat level − defence)`, +50 cloak, clamp 0..95; accuracy −10 each | `dmggive` |
| 48 | Target score | `kills × maxdmg × 20`; planet `+(10−dist)·750`; fallbacks 1/2/3 | `rival` |
| 49 | Best range | keep d while `W1 < 3·Wd` (cloak: `Wd ≥ W1`); max 9 | `best_range` |
| 50 | Cell score | +10 at best range else −4·dist; −2 blocked line; pulsar −4/+3; random among best | `target1_sub3` |
| 51 | Dodge | per inbound missile `d3 < difficulty` | `missile_evade` |
| 52 | Special-effect prices | warp dissipator +100 (≤3), black hole +1000 (≤1) & +2000 range weight, nullifier +500 (≤4), stasis ≥2 enemies left | `dmggive`, `best_range` |
| **Espionage** |
| 53 | Spy settings | security `8·diff (+spies)` ≤100; spying `d5+5` tenths %; mode rolls `d200 > 200+2·rel`; 1/3 turns vs AI targets | `turn_p3` |
| 54 | Spy cost | `2·compTech%+25`, ×2 per extra spy that turn, ÷2 Darlok | `game_spy_build` |
| 55 | Catch/success | catch `d100+dt2 >99/70/50`; hide >85; mission `d100+dt1 > 84` (>100 frame); `dt2 += security/5`; Darlok +20 def/+30 att | `game_spy_turn` |
| 56 | Effects | steal ≤ rmax; sabotage `((weapon%+9)·m/10)·d5`, 25 % unrest vs humans, bases÷5 | `game_spy_*` |
| **Council** |
| 57 | Schedule/votes | 25-turn period, ≥2/3 stars owned, ≥3 alive; votes `ceil(pop/100)`; win ≥ `⌊(total+1)·2/3⌋` | `game_election` |
| 58 | AI vote | `rel/4 + w`, `w = 20 Orion + 20 Human race + 40 repeat`; hate branch /4, second candidate /5 | `ai_vote` |
| 59 | Vote relation effects | +24 / −12 / −6 | `game_election` |
| **Events/monsters** |
| 60 | Event roll | `d512 ≤ (turn − lastEventTurn)` scaled ½,⅔,¾,⅘,1; monsters ≥ turn 200; comet ≥ 100 | `event_new` |
| 61 | Monster | 11 units/turn, counter 4 after each nuke, 5 nukes max; HP crystal 3000–7000, amoeba 1000–5000, guardian 2000–10000 | `tbl_monster` |

---

## 16. Tell-tale AI behaviours reported by players, and what the code says

| Reported behaviour (source) | Code-confirmed? |
|---|---|
| AIs often declare war on each other "if they think it benefits them", or because they are Erratic; they ally to avoid being targeted [W StrategyWiki via search] | **Partly confirmed:** war checks fire when the *target is stronger* (envy), Erratic random war exists (§3.2); alliances form by instant mutual roll (§9.1). |
| AI splits into two mega-alliances, or complete chaos [W] | **Confirmed mechanism:** allies automatically join each other's wars (§9.1), alliance conflicts dissolve both alliances. |
| "AI switches alliances faster than people change socks" [W lparchive] | **Confirmed:** NAP/alliance oscillation quirk and conflict-resolution. |
| The AI gangs up on whoever is leading / bigger [W general] | **Confirmed**: paths B, C (target stronger), E (hated human), D. It does **not** specifically hunt weak neighbours. |
| AIs break NAPs/alliances with you [W: mixed reports] | **Confirmed but conditional:** only Average+ difficulty via `wage_war_do` (25–100 %), on need-conquer turns via the attack planner, after ignored ally war-requests, or via the hatred ladder. Simple/Easy AIs do not betray by roll. |
| Even a pacifist AI hates you for destroying its ships while you defend [W GameFAQs] | **Confirmed** (injured-party logic, §7.3). |
| Missile raids on the enemy of your enemy improve relations [W Steam MOO1 guide] | **Only weakly:** code gives third parties +offense only when the victim loses its last planet (suspect), and "bounty" notices. Treat the guide's claim as unverified. |
| Invading while a treaty exists / accepting peace with transports in flight = betrayal [W] | **Confirmed:** capturing a planet with treaty < WAR starts a war automatically and costs −(51..100) relation. |
| Threatening a stronger AI works; its fleets turn back and it pays a bribe [W LP 2410–2414] | **Confirmed** (ceasefire d15+5; fleets withdraw without battle; BC/tech tribute at V ≥ 200/275). |
| AIs complain that your empire is too big [W LP] | **Confirmed** (growth complaint to allied AIs, type 12). |
| AI usually has better tech/faster ships; Impossible AI is strong in ground combat [W] | **Production** ×2 at Impossible is confirmed; ground combat has **no** difficulty modifier (tech-driven only). |
| The AI sends fleets only where it has "force > weight"; unguarded rich planets are targets [W] | **Confirmed:** target weight favours pop/special and penalises bases; attack needs force > defenders + bases. |
| In ties the defender wins; stalling to the 50-turn limit works [W] | **Confirmed:** timeout gives the win to the planet's owner. |
| Spy success depends on the computer-tech gap; many spies are counter-productive [W] | **Confirmed** (§10.3); the downside is only the 1 % wipe-out roll per spy. |
| Reducing population via transports before a vote can swing the council [W] | **Confirmed** (votes count only planetary population, rebels excluded). |
| AIs rarely propose anything / only react [observation] | **Confirmed** (§8.2). AI tech-exchange offers essentially never happen (bug). |
| BC tribute does nothing, tech tribute helps [implied by guides: "bribes with tech"] | **Confirmed** for Classic (§7.7). |
| An AI at war with you keeps "TENSE/RESTLESS" attitude rather than "FEUD" [observation] | **Confirmed**: war floor at −25 after any act (§7.2 step 10). |

---

## 17. Quirks of the Classic AI (keep unless noted) and Classic vs Classic+ differences

Recommended default: **keep** every quirk that shapes behaviour (they are the "original feel"); **fix** only those that would crash or overflow in JS.
1. Trust and baseline relation of the *breaker* rise when it breaks a treaty (sign inverted); Classic+ fixes. *Keep.*
2. When the human captures or depopulates an AI planet, the automatic war is started with the arguments (victim, human) and **no swap in Classic** ⇒ the AI victim, not the human, is charged the treaty-break bookkeeping. *Keep (or swap as Classic+ does).*
3. AI–AI peace uses the stale global "last message subtype" instead of a fresh value; wars end when `mood_peace + subtype > 100`. *Keep or replace by `mood_peace > 100`.*
4. AI-initiated tech-exchange offers are effectively impossible (value filter vs `found` test). *Keep.*
5. BC tribute gives no relation (Classic); Classic+ pays `bc·12/AI production`. *Keep or adopt Classic+.*
6. Peace requests use the treaty mood (Classic) rather than the peace mood. *Keep.*
7. Threat success hides the *player's* spies (Classic) instead of the AI's. *Keep.*
8. Human spy framing/penalties: penalty for an uncaught spy = player index; sabotage penalty reads the espionage array (≈0). *Keep (marginal).*
9. AI–AI sabotage frame-up gives the scapegoat a *positive* relation change. *Keep (marginal).*
10. Alliances are downgraded to NAP when the alliance score is re-rolled (oscillation). *Keep.*
11. Alliance-conflict loop uses a fixed second index (only empire `p1+1` is checked). *Keep.*
12. Phase B of the attack planner is dead (force table excludes enemy-owned stars); idle-fleet cleanup writes the wrong index; front anchor test is `== 1`. *Keep.*
13. Ships that cannot reach a destination (range+reserve-fuel test) are still removed from orbit when "sent" (Classic). *Fix (or keep) — Classic+ only removes sent ships.*
14. 16/32-bit masks on threat/force/weights and 32-bit overflow in auto-resolve scaling (negative counts capped at 32000). *Fix in JS (use big/unsigned maths) unless exact overflow behaviour is wanted; the flag `doom_stack_fix` exists in 1oom.*
15. Missile-base block doubles the ship slider ("very large fleets"); 1oom option `ai_fleet_cheating_fix` uses the defence slider instead. *Keep for feel.*
16. Slider dice use the industry weight twice instead of the ecology weight. *Keep.*
17. The planet-weight loop for enemy defenders originally used the AI's own design count (1oom fixes in Classic). *Fixed version recommended.*
18. Bounty payment disabled (message only) in Classic. *Keep.*
19. Bomber `Bulrathi` inflation: +20 % (Classic) vs ×2.15 (Classic+).
20. Battle-fallout third-party goodwill only when the victim has no planet left. *Keep, flagged suspicious.*
21. `trade_percent` can become negative when raising trade volume. *Keep.*
**Classic+ differences summary:** treaty-break sign fixed + swapped war order; 64-bit maths; trans sources exclude rebelling planets; allied fleets not counted as defence threats; fleet-send removes only sent ships; colony-ship send refresh; auto-resolve bonus 20 and planet bases scaled by survivors; bomb inflation ×2.15; peace uses peace mood; war-on-X adds treaty×30; threat hides the AI's spies; BC tribute formula; fewer annoy side effects.

---

## 18. Verified vs inferred, and open gaps

**Verified (≥2 reads, [C]):** war paths A–E and `wage_war_do`; need-conquer; planet weights and attack procedure; fronts/force/threat; defend/idle/transport sizing; bombing decision; AI retreat; tactical rival/range/turn skeleton; auto-resolve; battle participants; all `aud_*` formulas; proposal generator; AI–AI tick; mood/relation primitives; spy settings and mission rolls; council; event/monster mechanics.
**Single read [C1]:** `dmggive` constants, `game_diplo_battle_finish` third-party branch, sabotage/human-spy penalty wiring, AI-vs-AI frame-ups, monster arrival effects, relation-drift double-step interpretation, `bomb_damage` split constants.
**Inferred [I] / assumptions:** initial moods = 0; the human is player 0 (relation gains from treaty upkeep need the human to be the lower index); the mapping of `S` (AI best speed) to warp; map-unit ↔ parsec conversion (≈10–11 units); the semantic reading "aggressor = second argument of `wage_war`" (strongly supported by message routing and by `start_war`'s argument roles); personality/objective tables are race-indexed in enum order Human…Darlok.
**Open gaps / not in this file:** (1) the actual diplomacy message *texts* (only the categories are in code); (2) the shared tactical engine's weapon/initiative mechanics (other analysts); (3) ship-design AI, research priorities, colonisation and slider economics (sibling analyst) — only their war/diplomacy hooks are listed; (4) exact source of the original RNG (a clone cannot reproduce original random sequences); (5) AI behaviour in multiplayer modes; (6) whether the original shipped binary v1.3 matches 1oom Classic in every quirk (1oom claims "minor fixes only").

---

## 19. Planner interfaces — implement the AI as pure functions emitting orders

**Conventions.** One seeded RNG; helper `d(n)` = integer 1..n, `r0(n)` = integer 0..n−1 (the "1-in-N" tests are `r0(N)==0`). Integer maths truncates toward zero. Planners read a *snapshot* and return **orders**; a separate **apply** step mutates the game. Where a planner's later steps read values changed by its earlier steps (force zeroing, "used" markers, en-route counts, transport reservations), keep a **working copy** inside the planner (as the original mutates shared tables).

| Planner | Input snapshot | Orders emitted | Spec | Status |
|---|---|---|---|---|
| `planFleet(empire)` | planets (owner, pop, max pop, bases, special, type, within-fuel flags, positions), empires (treaty, relation1, contact, fuel range, S, colonise threshold, weapon/shield tech, planetary shield level), designs, orbit stacks, en-route fleets/transports, ceasefire, year, difficulty, election/end flags, refuse set, Orion index/guardian flag | `FleetSend{from,to,stacks}`, `TransportSend{from,to,pop}`, `SliderSet{planet,…}`, `ReserveMove`, `Act/BreakTreaty` (from the attack planner), `Tax` | §3.5–3.8, §4.1–4.7, §5.1–5.2, §4.10 (scouting/colonisation = sibling) | [C] |
| `planWarDeclarations(pair)` | relation1, trust, treaty, production, fleet weights, personalities/objectives, ceasefire, difficulty, human war counts | `StartWar{A,T}`, `BreakTreaty{A,T}`, `Notice{type 13/32/60/61,H}` | §3.2–3.3 | [C] |
| `planAiAiDiplomacy()` | all AI pairs, moods, relation, trade, tech lists, year | `SetTreaty`, `SetTrade`, `TechSwap`, `Act`, `StartWar`, `StopWar`, `Annoy` | §9.1 | [C] |
| `planAiToHuman(H,A)` | pair state, `diplo_val`, hatred, moods, treaty, productions, enemy lists, techs | `Message{type, payload}`, `BreakTreaty`, `StartWar`, `Hatred±` | §8 | [C] |
| `evaluateRequest(H,A,req)` | pair state, race of H, personality of A, reserve/techs | `Response{code 0–3, sweetener?}`, then `SetTreaty/StopWar/…`, `Annoy`, mood decrements | §7.6–7.7 | [C] |
| `planBomb(bomber,planet)` | pop, inbound transport pop of bomber, race, ceasefire | `bool` | §4.8 | [C] |
| `planSpySettings(empire)` | year, difficulty, relations, treaties, spies held by others, contact | `Security`, `SpyMode[X]`, `Spying[X]` | §10.1 | [C] |
| `buySpies(empire)` / `resolveSpies()` | spying, production, computer/weapon tech, security, spies, tech lists | `SpiesDelta`, `TechGrant`, `SabotageDamage`, `Act`, `Report` | §10.2–10.3 | [C] |
| `planCouncil()` / `aiVote(v,c1,c2)` | planets/pop, treaties, relations, last votes, Orion owner | `Votes`, `Act×n`, `GameEnd/FinalWar` | §11 | [C] |
| `planTacticalTurn(battle,item)` / `aiRetreat(battle)` / `autoResolve(battle)` | battle items (position, hp, counts, weapons, specials, side), missiles, difficulty, planet side | `Move`, `Attack*`, `RetreatFlag`, ship counts | §5.5, §6 | [C]/[C1] |
| `diploPrimitives` | — | `act`, `setTreaty`, `breakTreaty`, `startWar`, `stopWar`, `breakTrade`, `setTrade`, `annoy`, `battleFinish`, mood regen/relax, drift | §7.1–7.3, §9.2 | [C] |

**Order schema (suggested).**
`FleetSend{empire,from,to,ships[6],speed}` (speed = slowest engine+1, or instant between two own stargate planets) · `TransportSend{empire,from,to,pop}` · `SliderSet{planet,ship,def,ind,eco,tech}` · `ReserveMove{empire,planet,amount}` · `DiploAct{dv,actor,target,dtype,planet,p2}` · `SetTreaty{a,b,treaty}` · `BreakTreaty{breaker,victim}` · `StartWar{aggressor,victim}` · `StopWar{a,b}` · `SetTrade{a,b,bc}` · `BreakTrade{a,b}` · `Message{to:human,from:ai,type,payload}` · `TechGrant{to,field,tech,source}` · `SpySettings{empire,security,perTarget[mode,tenths]}` · `SpyOutcome{spy,target,caught,stolenTech|sabotage,blame}` · `Votes{voter,choice}` · `TacticalAction{item,move,attacks[],retreatFlag,specialButton}`.
**Determinism notes.** All AI planners consume the *same* RNG in the order written in this document (an exact replay of the original random stream is impossible, but keeping the draw order stable keeps saves/replays reproducible). Planner state that persists across turns: `hatred`, `diplo_*`, moods, `trust`, `blunder`, `broken_treaty`, `ceasefire`, `ai_p2_countdown` (design refresh 9..20 turns), `ai_p3_countdown` (slider shuffle 2..6 turns), `evn.voted`, `election_held`, `spyfund`, `spying/spymode` (re-rolled every turn).

**Per-turn call order for a faithful loop:** `moodRegenStart` → for each AI: `planFleet` + (`planProduction` sibling) → spy purchase → `diplo_adjust` (upkeep, complaints, drift) → movement/battles (`aiRetreat/planTactical/autoResolve` + `battleFinish`) → `resolveSpies` → bombing (`planBomb`) → transports land → ground combat (+AI reaction) → events → `planAiAiDiplomacy` → `planCouncil` (if due) → `planAiToHuman` + war checks → audiences → `moodRelaxEnd`.

*Document history:* v1 (priorities 1–4) → v2 (this version: diplomacy acceptance, AI-initiated diplomacy, espionage, council, special actors, adjustments, playbooks, constants, tells, quirks, planner contract). Refine in place as verification continues.

