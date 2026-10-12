# 02 - Technology tree and research mechanics (Master of Orion 1, 1993)

Scope: MOO1 only (MicroProse/SimTex 1993, v1.3 behaviour). Not MOO2, not the 2016 remake.
Everything below is meant to be implementation-ready. Ship-component stat blocks are also covered by
`03-ships-combat.md`; the key numbers are repeated here (section 3) so this file stands alone.

## 0. Source legend and confidence

| Tag | Source | Trust |
|---|---|---|
| [1oom] | 1oom source (github.com/1oom-fork/1oom, `src/game/*.c`), a reverse-engineered reimplementation of MOO1 v1.3. Tables/formulas are the actual game rules. | Highest |
| [SW] | StrategyWiki "Master of Orion" pages (Technology tree, Computers, Construction, Force Fields, Planetology, Propulsion, Weapons, Comparative tree, Techs always available, Key techs, Tech trading, Invade and Capture Techs, Game stages, Killing the Guardian, Racial personalities, Spying). In-game description text is paraphrased there. | High for text/levels, some typos |
| [LP] | Let's Play Archive "Master of Orion" (Update 02/03) - paraphrases the manual | Medium |
| [LG] | ludo.guide MOO1 table (research cost by tech level) | Medium (unrounded) |
| (derived) | computed by me from the above (including a Monte-Carlo run of the tree-generation algorithm) | Medium-high |
| (unverified) | single/weak source or inference | Low |

Where sources disagree it is marked `(conflict: ...)`. All conflicts are collected again in section 9.

Important framing facts:
* There are about **180 researchable techs** in the full MOO1 universe (31 Computers, 24 Construction, 23 Force Fields,
  29 Planetology, 27 Propulsion, 46 Weapons) plus 6 free level-1 starting bundles and the un-researchable Death Ray.
  **Each empire only gets a random ~half of them** (about 102 researchable techs for a normal race, about 129 for Psilons,
  about 96 for Silicoids - section 1.7). So the "~80-90 techs" figure in the brief understates the universe; one empire's tree holds roughly 100 researchable techs.
* MOO1 has **no research buildings** (no Research Lab / Supercomputer / Galactic Cybernet), **no scientists**, and no
  "RP per scientist". Research is purely: planet production x tech slider -> empire RP pool -> six field sliders.
  See section 1.11.
* The 1oom enumerator names differ slightly from in-game names (e.g. 1oom `IMPROVED_TERRAFORMING__10` = in-game "Terraforming +10";
  1oom `ZORTIUM` armor shows as "ZORTRIUM" in ship-design lists). Both spellings are given where relevant.

Quick facts for implementers (details and sources below):
1. 6 fields x 50 levels (10 tiers of 5 levels). RP cost of a tech = f(level, race rating, difficulty) and nothing else (no galaxy-size / techs-known scaling): human `floor(L^2 * race% * diff / 1000) * 10` with diff 20/25/30/35/40; AI `L^2 * race% / 5`.
2. Empire RP = sum over planets of production x tech-slider (Psilon +50 %, Artifact world x2, Orion x4); split into the 6 fields by six sliders that sum to 100.
3. Each field accumulates investment: +RP +15 % interest (interest capped at 2x this year's RP). Once investment > cost the tech completes with chance `0.5 * (inv-cost)/cost` per year; surplus is lost.
4. You always research one chosen tech per field (up to 12 offered, lowest tier first); owning any tech in tier T-1 unlocks tier T. Nothing offered ever disappears.
5. Every empire has its own random tree: per tier each valid tech survives with 50 % (Psilon 75 %), max 3 per tier, min 1; a few "essential" techs are guaranteed; Silicoids lose the pollution/soil/environment techs.
6. TL (per field) = `tmax + n - ((tmax-1)/5 + 2)` (1..99) drives component miniaturisation, hull space, worker output, loot caps and spy rolls.
7. When a personal tree is finished, advanced techs (levels 55..100) raise TL only.
8. Extra tech sources: Guardian/Orion (Death Ray + 3), artifact worlds (1), spies, invasion capture (<= 6), AI trades/tribute/sweeteners, final-war pooling, AI-only derelict event.
9. No research buildings, no scientists, no food techs; Planetology TL is what turns research into economy.
10. AI research: production multiplier by difficulty (Simple x1, Easy x0.8, Average x1.25, Hard x1.5, Impossible x2); sliders re-rolled every 10 years to 75/5/5/5/5/5 in some order;
    it takes the highest-level offered tech with probability 0, 0, 1/6, 2/6, 3/6 (Simple..Impossible) and a uniform random offered tech otherwise.

---

## 1. How research works

### 1.1 Vocabulary

| Term | Meaning |
|---|---|
| Field | One of 6 independent research fields, code ids 0..5: **0 Computers (CM), 1 Construction (CN), 2 Force Fields (FF), 3 Planetology (PL), 4 Propulsion (PR), 5 Weapons (WE)**. |
| Level (tech index) | 1..50 per field. Every tech sits on exactly one level; no two techs of a field share a level (exception: the free level-1 start bundle). **RP cost depends only on the level.** Advanced ("general improvement") techs sit on levels 55, 60, ..., 100. |
| Tier (rung, "sub-category") | 10 tiers per field, 5 levels each: tier T (1-based) = levels 5T-4 .. 5T. (1oom 0-based tier index = (level-1)/5.) |
| TL (tech level, 1oom `tech.percent[field]`, shown as a % on the research screen) | Per-field derived number 1..99 (section 1.6). Drives miniaturisation and several economy effects. NOT the same as a tech's level. |
| Project | The one tech currently being researched in a field (`project[field]`, 0 = none). |
| Investment | RP accumulated toward the project (`investment[field]`). |
| Choice list | Up to 12 (`TECH_NEXT_MAX`) techs offered when a field needs a new project. |
| Research list | The per-empire random subset of the tree (`researchlist[field][10 tiers][3 slots]`), generated at game start. Human and every AI each have their own. |

### 1.2 Where RP come from (BC -> RP is 1:1)

[1oom `game_get_tech_prod`, `game_update_total_research`]
```
for each owned planet p (excluding plague/nova-event planets):
    v = (p.prod_after_maint * p.slider[TECH]) / 100            # integer division
    if owner.race == PSILON:            v += v / 2             # +50 %
    if p.special == ARTIFACTS:          v *= 2                 # Ancient Artifacts world
    if p.special == 4XTECH:             v *= 4                 # (the Orion planet)
    v = min(v, 32767)
    empire.total_research_bc += v                              # the UI labels this "BC"
```
* `p.slider[TECH]` is the planet's own 0..100 % production slider (the other planet sliders are ship / defense / industry / ecology).
  In 1oom every planet is created with industry = 100 %, so a new human empire has **0 RP until you move sliders** (AI start sliders: section 6).
* `prod_after_maint` is the planet's production after the empire-wide scaling `percent_prod_total_to_actual`
  (= (production x (1000 - security - spy spending)/1000 + trade - ship maintenance - base maintenance - tax) / production), minus outgoing transports.
  So ship/base upkeep, tax and spying reduce every slider's output (including research) proportionally.
* Worker output per colonist depends on **Planetology TL** (section 4.8) - that is how Planetology research feeds the economy.
* AI empires get a production multiplier by difficulty (this is how AI research scales; their RP *costs* do not scale, see 1.5):
  Simple x1.0 (default branch), Easy x0.8 (`(v<<2)/5`), Average x1.25 (`v += v/4`), Hard x1.5 (`v += v/2`), Impossible x2.0 (`v += v`).
  A code comment flags "simple has larger v than easy" as a probable original bug. [1oom `game_update_production`]
* No galaxy-size, opponent-count or number-of-techs-known scaling exists anywhere in the research code (searched the 1oom research, tech, turn and AI sources).
* Empire RP is split between the 6 fields by six **tech sliders** (integers 0..100, always summing to 100; moving one redistributes
  the others; individual sliders can be locked). New human game defaults: **CM 20, CN 10, FF 15, PL 15, PR 20, WE 20**.
  Tech-screen "equalize" key ('=') sets all to 16/17/17/16/17/17 (ignores locks).

### 1.3 Per-field state

```
completed[f]      sorted list of completed levels (always contains 1 at start); completed_count = len
project[f]        level being researched or 0
investment[f]     RP accumulated (int)
cost[f]           RP cost of the project, fixed when the project is started (section 1.5)
slider[f]         0..100
TL[f]             derived, section 1.6 (starts at 1)
researchlist[f]   10 tiers x up to 3 levels (section 1.7)
```
Start of game: every field has `completed = {1}` (all level-1 techs known), TL = 1, no project, investment 0.
The level-1 bundles (free): see the "L1" rows in section 2.

### 1.4 Yearly research update (one game turn = 1 year)

[1oom `game_tech_research`, confirmed by `game_tech_current_research_percent1/2`]
```
for each empire, for each field f:
    inv = investment[f]
    t3  = slider[f] * total_research_bc / 100          # this year's RP into f
    t1  = inv * 3 / 20                                   # 15 % "interest" on the accumulated pile
    t1  = min(t1, 2 * t3)                                # interest is capped at 2x this year's RP
    inv += t3 + t1
    investment[f] = inv
    TL[f] = field_percent(f)                             # section 1.6
    c = cost[f]
    if c != 0 and slider[f] != 0 and total_research_bc != 0:
        if inv > c:
            v = (inv - c) * 250 / c                      # integer
            if rnd_1_n(500) <= v:                        # P = min(v,500)/500 = 0.5 * (inv-c)/c, capped at 1
                complete project[f]
    else:
        investment[f] = inv * 9 / 10                     # unfunded / no project: lose 10 % per year
```
* **Completion is probabilistic.** Once `inv` exceeds the cost, each year there is a `0.5 * (inv - cost) / cost` chance
  (0 % at exactly cost, 50 % at 2x cost, 100 % at 3x cost). Overshoot is **wasted**: on completion
  `project[f] = 0` and `investment[f] = 1` (and likewise if you receive the tech you are researching by spying/trading/loot,
  the project is cleared and the investment reset to 1).
* The interest term means steady funding beats crash programs. Worked example (cost 1000, constant 100 RP/yr): investment after
  years 1..7 = 100, 215, 347, 499, 673, 873, 1103; completion chance in years 7..13 = 5, 18, 33, 48, 63, 78, 93 %
  (100 % in year 14); expected completion about 9.6 years. (derived)
* Funding a field at 0 % (or having no project) loses 10 % of the pile each year (`inv*9/10`).
* **Original display bug**: the discovery % printed on the tech screen was exactly half of the true probability (an LP player noticed 16 % shown vs 32 % real);
  1oom fixes this ([1oom doc/list_gamediff.txt]). A faithful clone should show the true value
  (`0.5*(projected-cost)/cost`, capped at 99 in the UI) or deliberately reproduce the half-value display.
* Order inside a turn: production -> eco -> total research -> battles/spies -> `game_tech_research` -> artifact loot -> TL refresh -> new-tech popups.
* A human cannot re-pick a project in progress through the research screen (no control exists in `uitech.c`; `game_tech_start_next`
  would zero the investment if a project were replaced). (inferred)

### 1.5 RP cost of a tech

[1oom `game_tech_get_next_rp`, `game_num_tech_costmuld/costmula/costmulr`] - verified against [LG] table and the [LP] numbers.

```
L   = tech level (1..50, or 55..100 for advanced techs)
HUMAN:  cost = ((L*L * racemul[race][field] * diffmul[difficulty]) / 1000) * 10        # integer; result is a multiple of 10
AI:     cost = (L*L * racemul[race][field] * 20) / 100                                  # same for all AI difficulties
diffmul = { Simple 20, Easy 25, Average 30, Hard 35, Impossible 40 }
global multipliers costmuld2 = costmula2 = costmul = 100 (no-ops)
```
Neutral race at Average difficulty: cost = 30 * L^2 (L1 = 30, L2 = 120, L10 = 3000, L20 = 12000, L50 = 75000).
So **human cost scales 20..40 x L^2 with difficulty; AI always pays 20 x L^2 x race factor** (the AI's handicap is its production, section 1.2).
Full level x difficulty table: Appendix B.

Race research ratings = cost multipliers (percent). Rating names: Excellent 60, Good 80, Average 100, Poor 125.
Effective research speed multiplier = 100/racemul (Excellent x1.67, Good x1.25, Poor x0.8). [1oom `game_num_tech_costmulr`; same table in SW]

| Race (1oom id) | CM | CN | FF | PL | PR | WE |
|---|---|---|---|---|---|---|
| Human (0) | 100 | 100 | **60** | 80 | 80 | 100 |
| Mrrshan (1) | 100 | 125 | 100 | 100 | 100 | **60** |
| Silicoid (2) | 80 | 125 | 125 | 125 | 125 | 125 |
| Sakkra (3) | 100 | 100 | 100 | **60** | 100 | 100 |
| Psilon (4) | 80 | 80 | 80 | 80 | 80 | 80 |
| Alkari (5) | 100 | 100 | 125 | 100 | **60** | 100 |
| Klackon (6) | 100 | **60** | 100 | 100 | 125 | 100 |
| Bulrathi (7) | 125 | 80 | 100 | 100 | 100 | 80 |
| Meklar (8) | **60** | 100 | 100 | 125 | 100 | 100 |
| Darlok (9) | 80 | 100 | 100 | 100 | 100 | 100 |

* The rating changes cost only, NOT how many techs a race gets (that is the 50 % / 75 % roll in 1.7; Psilon only).
* Psilon additionally gets +50 % RP from every planet (1.2): combined effective speed = 1.5 / 0.8 = x1.875
  (conflict: SW/LP say "+75 %" / "75 % edge"; the code gives x1.5 RP and cost x0.8).
* Example, Average difficulty, level 20: neutral 12,000; Good 9,600; Excellent 7,200; Poor 15,000 (human formula with truncation).
* The cost shown in the choose-next list is exactly this cost; it is stored in `cost[f]` when the project starts.
* [LG]'s table lists unrounded `L^2 x diffmul` (e.g. Easy L1 = 25). The code truncates to multiples of 10 (Easy L1 = 20, Hard L1 = 30).
  (conflict: use the code formula)
* The AI's very first project costs `level^2 * 50` regardless of race (original bug, `game_num_ai_first_tech_cost_fix = false`).
* Advanced techs (levels 55..100, step 5) use the same formula with L = 55..100 (Appendix B).

### 1.6 Tech level (TL) - what it is and what uses it

[1oom `game_tech_get_field_percent`]
```
tmax = highest completed level in the field
n    = number of completed techs in the field (including the free level-1 tech)
v    = 1 if n == 1 else (tmax-1)/5 + 2        # integer division
TL   = clamp(tmax + n - v, 1, 99)
```
(Manual/fan wording: 0.8 x the highest-level advance plus one per device owned; the code is that with integer rounding. [LP][SW])
Examples: start 1; after one L2 tech 2; after L2+L4 -> 5; completing an entire (all-techs) field: CM 71, CN 64, FF 63, PL 69,
PR 67, WE 86; each advanced tech then adds +5 to tmax and +1 to n (CM: 76, 81, 86, 91, 96, 99). At TL 99 with no project the
screen shows "MAX". Researching an obsolete tech still adds +1 to n, so it always has "some minimal value".

What TL controls:
1. **Miniaturisation of ship components** (section 3, Appendix C): for each component
   `tm = clamp(TL[field of component] - component_tech_level, 0, 50)`; component cost x `T50[tm]/100`, space x `T25[tm]/100`
   (fields: weapons -> Weapons TL (bio weapons -> Planetology TL), armor -> Construction, shields/specials per their own field,
   engines -> Propulsion, computers/ECM -> Computers). Compounded, that is about -6.7 % cost and -2.8 % space per TL point
   (halving cost every 10 points, -25 % space every 10 points); [LP] rounds this to roughly -5 % cost / -2.5 % size per TL.
2. **Hull space**: `hull_space = base + base * TL[Construction] / 50` (TL 50 doubles hull space).
3. **Worker output**: per-colonist BC = (3 x TL[Planetology] + 50) / 100 (0.53 at TL 1, 2.0 at TL 50; Klackon x2). [1oom `game_update_production`; SW "Increasing your production" gives the same 0.5 + 1.5*LVL/50]
4. Orion/artifact loot level caps (1.10), spy computer rolls (`Computers TL`), missile-base tech selection (section 4.4).

### 1.7 The per-empire random tech tree (new-game generation)

[1oom `game_generate_research`, verbatim logic; matches SW "Techs always available"]

For each empire (human and AI separately), field by field, tier by tier:
```
rmax = 3 if race == PSILON else 2                    # P(keep) = rmax/4  -> 75 % Psilon, 50 % everyone else
for tier in 0..9:
    slots = []                                        # at most 3
    repeat until slots non-empty:
        # pass 1: techs flagged ALWAYS (bit value 2) are taken first, highest level first (no default race uses this flag)
        # pass 2: candidates = levels 5*tier+5 down to 5*tier+1 that are VALID, not NEVER, not ALWAYS
        for level from tier*5+5 down to tier*5+1:
            if valid(level) and rnd_1_n(4) <= rmax and len(slots) < 3:  slots.append(level)
    sort slots ascending -> researchlist[field][tier]
```
* **VALID** = an entry exists in the research table (not an "UNUSED" slot), the level is not 1 (level-1 start techs are never
  listed), and the tech is not the Death Ray (WE 36 is explicitly removed). See the tier-composition table below.
* Because scanning goes from the highest level down and stops at 3, in tiers with 4-5 valid techs the lowest levels are kept less often.
* A tier always ends with at least one tech. A tier with only one valid tech is therefore "always available":
  **FF tier 1 = Class II Deflector (L4), PR tier 7 = High Energy Focus (L34), CN tier 10 = Neutronium Armor (L50),
  PL tier 10 = Complete Terraforming (L50)** - exactly the four techs [SW] lists as always available.
* **Essential-tech check** (flag value 4 in `game_num_ng_tech`): for every field that has flagged techs, at least one flagged tech must appear
  in the generated list, otherwise the whole generation (all fields, all players) is redone. Default-race flags:
  CM {8, 18, 28, 38, 48} (Improved Robotic Controls III-VII); PL {12, 22, 32, 42} (Controlled Inferno Env., Atmospheric Terraforming,
  Terraforming +60, Advanced Cloning); PR {3, 5} (Hydrogen / Deuterium Fuel Cells - [SW] confirms that at least one of the two always exists);
  WE {4, 8, 11, 18, 27, 34, 41, 44} (the missile line); CN and FF none.
* **Silicoid exceptions** (NEVER bit value 1): CN never {5, 15, 25, 35, 45} (all pollution techs); PL never {3, 5, 6, 9, 12, 13, 15, 16, 18, 22, 34}
  (Controlled Barren/Tundra/Dead/Inferno/Toxic/Radiated Env., Improved/Enhanced/Complete Eco Restoration, Soil Enrichment, Atmospheric
  Terraforming); PL essential flags only {32, 42}. In 1oom's bug-fix mode Silicoids also never get PL 24 (Advanced Eco Restoration) and PL 30
  (Advanced Soil Enrichment) - the original offered them uselessly. Silicoid `have_colony_for` is always Radiated and soil/atmos flags are forced false.
* After generation each empire gets `base_shield = Class I`, `base_comp = Mark I`, `base_weapon = Nuclear Missile (2 shots)`, all level-1 techs.
* AI empires then pick their first project in each field at random from their tier-1 list.

**Tier composition (valid, researchable levels per tier; 1-based tier number)**

| Tier | Levels | CM | CN | FF | PL | PR | WE |
|---|---|---|---|---|---|---|---|
| 1 | 1-5 | 2, 4, 5 | 3, 5 | **4** | 2, 3, 5 | 3, 5 | 2, 4, 5 |
| 2 | 6-10 | 7, 8, 10 | 8, 10 | 8, 10 | 6, 8, 9, 10 | 6, 9, 10 | 6, 7, 8, 9, 10 |
| 3 | 11-15 | 12, 13, 15 | 11, 13, 14, 15 | 12, 14 | 12, 13, 14, 15 | 12, 14 | 11, 12, 13, 14, 15 |
| 4 | 16-20 | 17, 18, 20 | 17, 18 | 16, 20 | 16, 17, 18, 20 | 16, 18, 19, 20 | 16, 17, 18, 19, 20 |
| 5 | 21-25 | 22, 23, 25 | 23, 24, 25 | 21, 22, 24 | 21, 22, 24 | 23, 24 | 21, 22, 23, 24, 25 |
| 6 | 26-30 | 27, 28, 30 | 26, 28 | 27, 30 | 26, 27, 30 | 27, 29, 30 | 26, 27, 28, 29, 30 |
| 7 | 31-35 | 32, 34, 35 | 33, 34, 35 | 31, 32, 34 | 32, 34 | **34** | 31, 32, 33, 34, 35 |
| 8 | 36-40 | 37, 38, 40 | 36, 38, 40 | 37, 38, 40 | 36, 38, 40 | 36, 38, 40 | 37, 38, 39, 40 |
| 9 | 41-45 | 42, 45 | 42, 45 | 42, 43, 44 | 42, 44 | 41, 42, 43, 45 | 41, 42, 43, 44, 45 |
| 10 | 46-50 | 46, 47, 48, 49, 50 | **50** | 46, 50 | **50** | 46, 48, 50 | 46, 47, 48, 50 |
| total | | 31 | 24 | 23 | 29 | 27 | 46 |

(bold = single-tech tier = always present). Level 1 is the free start bundle in every field; WE 36 (Death Ray) is not offered.

**Inclusion probability** (derived by simulating the exact algorithm, essential-tech check included; 40,000 runs per field):
* Expected researchable techs per empire: normal race ~101.9 (CM 17.4, CN 14.9, FF 14.5, PL 16.8, PR 16.0, WE 22.3);
  Psilon ~129.1 (22.8 / 18.6 / 18.1 / 21.4 / 20.3 / 27.8); Silicoid ~96.1.
* P(a given tech is present), normal race / Psilon, by number of valid techs k in its tier:
  k=1: 100 % / 100 %; k=2: ~67 % / ~80 %; k=3: ~57 % / ~76 %;
  k=4: lowest ~46 %, others ~54-57 % / lowest ~43 %, others ~75 %;
  k=5: lowest ~35 %, 2nd lowest ~45 %, others ~52 % / lowest ~20 %, 2nd lowest ~43 %, others ~75 %.
* (conflict: [SW] models this as "shuffle the tier, coin-flip each, keep the last if all were removed" giving 62.5 % (3/8 missing)
  for a 2-tech tier; the 1oom algorithm gives 66.7 %. Use the 1oom algorithm.)

### 1.8 Choosing the next tech

[1oom `game_tech_get_next_techs`, `game_tech_finish_new`, `game_tech_ai_tech_next`]

```
def choice_list(empire, f):
    rc   = empire.completed[f]                       # sorted ascending
    tmax = rc[-1]
    if len(rc) == 1:  maxtier = 1                    # only the start tech known: tier 1 only
    else:             maxtier = min(10, (tmax-1)//5 + 2)      # 0-based tiers [0, maxtier)
    out = []
    for t in range(maxtier):                          # ascending tier, then ascending slot
        for lvl in researchlist[f][t]:                # up to 3 slots
            if lvl != 0 and lvl not in rc and len(out) < 12:   # TECH_NEXT_MAX = 12
                out.append(lvl)
    if not out:                                       # the entire personal tree is done -> advanced techs
        tmax = 55 if tmax <= 50 else min(100, tmax + 5)
        out = [l for l in range(55, tmax + 1, 5) if l not in rc]
    return out
```
* **Unlock rule:** tier T (1-based) becomes visible once you own any tech of level >= 5T-9, i.e. a tech in tier T-1 or higher
  (T2: any non-start tech; T3: level >= 6; T4: >= 11; T5: >= 16; T6: >= 21; T7: >= 26; T8: >= 31; T9: >= 36; T10: >= 41).
  You never need to finish a tier - one tech per tier is enough to move on ([SW] and [LP] state the same rule).
* **Passed-over techs are never lost.** They stay unresearched and reappear in later lists as long as they are inside the visible tiers.
  Nothing is penalised. But the list is built lowest tier first and truncated at **12**, so a backlog of old unresearched techs can push
  newer, higher-tier techs off the list until you clear some. (derived from the code above)
* Obtaining a tech by other means (loot/spy/trade) raises `tmax`, which widens the visible window immediately.
* Human: when a project completes (or when a field with no project has investment > 0 - e.g. the first RP into a field at game start)
  the new-tech screen lists the options with cost in parentheses; the player picks one; `cost[f] = cost(level)` and the slider keeps running.
  If the list is empty (nothing left) no prompt appears. Descriptions are shown for the highlighted option.
* AI: picks immediately. `if rnd_1_n(6) < difficulty_index: choose the LAST list entry (highest level shown) else choose uniformly at random`
  (difficulty_index Simple 0 .. Impossible 4 -> P(last entry) = 0, 0, 1/6, 2/6, 3/6 plus the uniform share). [1oom `game_ai_classic_tech_next`]
* Advanced techs: named "Advanced <Field> Tech <roman numeral>" with roman index (level-50)/5 (so L55 -> 1, ..., L100 -> 10) (exact English
  words unverified; description is "General improvements of existing <field> technology"). They only add TL (+5 tmax, +1 n each).
  [1oom changelog note: "all Advanced Technology are available for research".]

### 1.9 What the research screen shows (human UI)

[1oom `uitech.c`, `uinewtech.c`; [LP]]
* Six field tabs (keys 1-6). Per field: the list of completed techs (16 rows visible) with the current project as the last entry,
  description box for the selected row, the field's slider (0-100, step 2; Ctrl = 10; Alt = 0/100), a lock toggle ('l'), and the field's **TL as a
  right-aligned %** ("MAX" at >= 99 with no project).
* A progress indicator per field: a % of cost reached this turn (`projected*100/cost`, projected = inv + t3 + interest) or a light-bulb gauge
  that fills with progress.
* Top right: empire total research (labelled "BC"). Left panel summary lines: scanner range, factories per colonist, waste scale,
  ground-combat bonuses from armor / suit (tier x 5, x 10), personal shield (tier x 10), personal weapons (tier x 5), terraform amount,
  eco-restoration rate, fuel range.
* Hotkeys: T opens the screen; '=' equalizes sliders (ignores locks).
* New-tech screen: one page per discovery with name, description and a source banner (research / spy theft / found-ruins /
  trade / "choose"); different music per source. Special popups after some techs offer to auto-adjust planet sliders by 0/25/50/75 %
  (Reduced Industrial Waste & Eco Restoration, Robotic Controls, Terraforming, Planetary Shields, Soil Enrichment, Atmospheric Terraforming);
  never shown to Silicoids. (`game_num_tbl_tech_autoadj = {0, 25, 50, 75}`)
* There is no "years to completion" display and no way to compare options other than cost + description.

### 1.10 Techs obtainable from sources other than research

| Source | Mechanism | Numbers |
|---|---|---|
| **Orion / Guardian** | Defeat the Guardian monster at the Orion system (`guardian_killer` is set; the killer gets the loot at the next event pass). Loot = **Death Ray** (WE 36, not in any tree) + 3 random techs. | Per field cap = `min(TL[f] + 25, 50)`. Each of 3 rounds: up to 200 tries of `field = random, level = rnd_1_n(31) + 19` (20..50); accept if `cap[field] >= level`, the level exists in the master table, and you do not own it; grant `TECHSOURCE_FOUND`. Techs outside your personal tree are possible. (conflict: [SW "Killing the Guardian"] says "5 random techs, up to 10 levels above your level"; 1oom code = 3 techs, cap TL+25.) Death Ray: 200-1000 dmg, cost 100 BC, space 2000, power 2000 (realistically a Huge hull). |
| **Ancient Artifacts planet** | Human only. The first empire that has a ship in orbit (scanner-only does not count) while exploring the planet gets 1 tech. The planet also has x2 research when you own it. | Cap `min(TL[f] + 10, 50)`; 1 round, up to 200 tries of `level = rnd_1_n(30)` (1..30), random field, same acceptance test. AIs never get it. (1oom fixes an original bug where only one artifact world could pay out per year.) |
| **Spy theft** | Spy mission "Espionage" (spy mechanics in the spy/diplomacy file). | Candidate pool = techs the target has and the spy lacks (techs in the same obsolescence group with equal/higher tier count as owned for 12 groups). Up to 6 (`TECH_SPY_MAX`) random candidates are drawn (random field, then random tech). Level cap: `rmax = max(1d100 over successful spies) * highest_target_TL / 100`; candidates with level > rmax are removed. A human spy is offered the candidates grouped by field and picks which tech to take (exact offer rounds unverified). Success roll: `1d100 + max(0, spyComputerTL - targetComputerTL) > 84` (the spy-count/caught rolls are in the spy file). |
| **Invasion capture** | If invaders win the ground fight (not a rebellion), each factory of the conquered planet rolls 1-in-50. | `chance = number of successes`; techs stolen = `min(candidates, 6, chance)` using the same candidate rules as spying; granted as `TECHSOURCE_FOUND`. [SW "Invade and Capture Techs"] describes the same expectation (2 % per factory; max 6; groups of 25 factories); 300-400 factories almost always yields 6. |
| **Tech trading (audience "Exchange Technology")** | One-for-one swaps with an AI that is not at war/final war. | The AI lists up to 5 of its techs you lack; for the chosen one it lists up to 4 of your techs it would accept (AI value filter, below). AI-initiated swap offers list up to 4. Each trade lowers the AI's `mood_tech` by 21-70 (player ask) or 21-50 (AI offer). Tech value used by the AI = `level^2` x group multiplier (Singular x10, Improved Robotic Controls x6, Reduced Industrial Waste x3, Eco Restoration x3), /4 if it already has a better tech of that group, 0 if same level.
The AI only accepts payment techs whose value >= asked-tech value x v/100, where `v = max(75, ...)` is normally exactly 75 and only rises when the AI strongly dislikes you (`aud_tech_scale`). The AI hoards "Singular" techs (e.g. Stasis Field, Hyperspace Comm.) and greatly overvalues Inertial Stabilizer/Nullifier [SW]. Never trade game-defining techs (Class V Planetary Shield, High Energy Focus, soil/terraforming) [SW "Key techs"]. |
| **Tribute** | Giving a tech to an AI as tribute improves relations (formula in the diplomacy file); the tech option appears after the BC options and offers up to 4 of your techs. | `v = ((rnd_1_n(8) + rnd_1_n(8) + level/4) * base)/10` (base 20 if relation < 0 else `(100-relation)/10`; x2 if the receiver is human), relation capped 100. |
| **Treaty sweeteners / bounties** | AI counter-offers in treaty audiences can include a tech (or BC); the AI may also demand a tech (or BC) from you as the price of a pact/alliance/peace you proposed. A war "bounty" can be a tech (`attack_gift_tech`) - code notes the original game never actually paid it. | AI BC sweetener `= ((rnd_1_n(8)+rnd_1_n(8)) * year / 25) * 25`, 0 if above its reserve; tech chosen like a spy candidate. All transfers use `TECHSOURCE_TRADE`. |
| **Final war share** | When the galactic council ends in a final war, all techs held by each side are pooled and handed to every member of that side (humans receive them one by one up to the new-tech queue limit; AIs get the union silently). | `game_tech_final_war_share` (techsource TRADE). |
| **Random event: Derelict ship** | Only AI empires (never the human). Grants, for Weapons and Force Fields, the first listed tech of each of the empire's first `TL/5 + 2` tiers (capped at 10 tiers). | One-time event. |
| **Random event: Computer virus** | Any empire; picks one of Computers / Force Fields / Propulsion / Weapons at random (not Construction or Planetology) and **zeroes that field's investment**. | One-time event. |

### 1.11 Things people expect from other 4X games that MOO1 does NOT have
* No Research Lab, Supercomputer, Galactic Cybernet, Autolab, Research Station etc. There are no research buildings at all.
* No scientists / specialists, therefore no "RP per scientist per tech level".
* No star bases, battle stations or star fortresses as techs: planets get **missile bases** (auto-upgraded by tech) and a **planetary shield**
  (techs FF 12/22/32/42); the only orbital structure tech is the **Stargate** (PR 27). Spy "techs" do not exist; spying uses the Computers TL.
* No Subterranean Farms, Hydroponic Farms, Biospheres, Atmospheric Renewal, Gaia Transformation or other population buildings. MOO1's population techs are only:
  Soil Enrichment (Normal -> Fertile), Advanced Soil Enrichment (-> Gaia), Atmospheric Terraforming (Hostile -> Normal), Terraforming +10..+120, Cloning / Advanced Cloning
  (cheaper growth), and the Controlled Environment techs (colonise hostile types). MOO1 has no food resource in the 1oom rules: growth is paid from the ecology slider.
* No tech-catch-up cost reduction, no per-tech-known cost scaling, no research cost scaling with galaxy size.
* No research from trade routes or treaties (alliances do not share tech except via the end-game final-war pooling).

---

## 2. The complete tech list

Conventions for the tables:
* **Lvl** = tech level (also the RP-cost index). **T** = tier (1..10). **RP** = cost at Average difficulty for a 100 % race
  (30 x L^2). For other cases use section 1.5 / Appendix B.
* Names are the player-visible names ([SW]); 1oom spelling in notes where it differs. "L1" rows are free at game start.
* "Never(Sil)" = Silicoids are never offered it. "ESS" = one of the "at least one of these must exist" flagged techs (1.7).
* Effects marked "(1oom)" come from the code tables, "(SW)" from the wiki text. Ship-component cost/space/power arrays are
  in section 3 (cost raw units: BC = raw/10; hull order small/medium/large/huge).
* Prerequisites: MOO1 has **no explicit prerequisites**; only the tier-unlock rule in 1.8. "Unlocks" lists the design/building option gained.

### 2.1 Computers (field 0) - 31 researchable + L1 bundle

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Battle Computer Mark I | free | computer | comp level 1 (+1 attack rating); base_comp starts at Mark I | L1 bundle |
| 1 | 1 | Robotic Controls (II) | free | industry | each colonist operates **2** factories | L1 bundle; Meklar +2 |
| 1 | 1 | Battle Scanner | free | ship special | shows enemy ship stats in combat; (SW) +3 initiative, +1 to computer targeting; cost 300 / space 50 / power 50 (1oom) | L1 bundle |
| 2 | 1 | ECM Jammer Mark I | 120 | ecm | +1 missile defense rating (enemy missiles' to-hit reduced) | |
| 4 | 1 | Deep Space Scanner | 480 | scanner | planet scan range 3 -> **5** pc (ships in transit seen at 1 pc) | scanner group |
| 5 | 1 | Battle Computer Mark II | 750 | computer | +2 attack rating | |
| 7 | 2 | ECM Jammer Mark II | 1,470 | ecm | +2 | |
| 8 | 2 | Improved Robotic Controls III | 1,920 | industry | **3** factories per colonist | ESS. adjust-slider popup |
| 10 | 2 | Battle Computer Mark III | 3,000 | computer | +3 | |
| 12 | 3 | ECM Jammer Mark III | 4,320 | ecm | +3 | |
| 13 | 3 | Improved Space Scanner | 5,070 | scanner | scan range **7** pc (ships 2 pc); also reveals destination planet and ETA of enemy fleets | |
| 15 | 3 | Battle Computer Mark IV | 6,750 | computer | +4 | |
| 17 | 4 | ECM Jammer Mark IV | 8,670 | ecm | +4 | |
| 18 | 4 | Improved Robotic Controls IV | 9,720 | industry | **4** factories per colonist | ESS |
| 20 | 4 | Battle Computer Mark V | 12,000 | computer | +5 | |
| 22 | 5 | ECM Jammer Mark V | 14,520 | ecm | +5 | |
| 23 | 5 | Advanced Space Scanner | 15,870 | scanner | scan range **9** pc (ships 3 pc); planet size/environment/resources visible within 9 pc without a ship; it does NOT give Orion loot or artifact-world techs (those still need a ship in orbit) | |
| 25 | 5 | Battle Computer Mark VI | 18,750 | computer | +6 | |
| 27 | 6 | ECM Jammer Mark VI | 21,870 | ecm | +6 | |
| 28 | 6 | Improved Robotic Controls V | 23,520 | industry | **5** factories per colonist | ESS |
| 30 | 6 | Battle Computer Mark VII | 27,000 | computer | +7 | |
| 32 | 7 | ECM Jammer Mark VII | 30,720 | ecm | +7 | |
| 34 | 7 | Hyperspace Communications | 34,680 | special | lets you change the destination of ships already in transit | "Singular" (AI value x10) |
| 35 | 7 | Battle Computer Mark VIII | 36,750 | computer | +8 | |
| 37 | 8 | ECM Jammer Mark VIII | 41,070 | ecm | +8 | |
| 38 | 8 | Improved Robotic Controls VI | 43,320 | industry | **6** factories per colonist | ESS |
| 40 | 8 | Battle Computer Mark IX | 48,000 | computer | +9 | |
| 42 | 9 | ECM Jammer Mark IX | 52,920 | ecm | +9 | |
| 45 | 9 | Battle Computer Mark X | 60,750 | computer | +10 | |
| 46 | 10 | Oracle Interface | 63,480 | ship special | direct-fire weapons become armor-piercing (not missiles/torpedoes/bombs/specials) (SW); cost raw 30/150/600/2750, space 8/40/200/1000, power 12/60/300/1500 per hull (1oom) | |
| 47 | 10 | ECM Jammer Mark X | 66,270 | ecm | +10 | |
| 48 | 10 | Improved Robotic Controls VII | 69,120 | industry | **7** factories per colonist | ESS |
| 49 | 10 | Technology Nullifier | 72,030 | ship special | reduces the enemy's attack rating by 2-6 each time it fires (SW); cost 300 BC, space 750, power 1000 (1oom) | |
| 50 | 10 | Battle Computer Mark XI | 75,000 | computer | +11 | |

Number of ECM Jammers: 10 (Mk I-X); Battle Computers: 11 (Mk I free + II-XI); Scanners: 3; Robotic Controls: 5 upgrades.

### 2.2 Construction (field 1) - 24 researchable + L1 bundle

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Titanium Armor | free | armor | armor 100 % of hull hits (small 3, medium 18, large 100, huge 600 HP); "heavy" Titanium II = 150 % for extra cost/space | L1 bundle; ground +0 |
| 1 | 1 | Reserve Fuel Tanks | free | ship special | ship may fly up to **3 pc beyond** the empire fuel range (`fuel_range+3`); cost 20/100/500/2500 raw, space same | L1 bundle |
| 3 | 1 | Improved Industrial Tech 9 | 270 | industry | factory build cost 10 -> **9 BC** | (SW name "Industrial Tech 9") |
| 5 | 1 | Reduced Industrial Waste 80% | 750 | waste | factory pollution x0.8 (waste scale 10 -> 8) | Never(Sil) |
| 8 | 2 | Improved Industrial Tech 8 | 1,920 | industry | factory cost **8** | |
| 10 | 2 | Duralloy Armor | 3,000 | armor | armor 150 % (II = 225 %); ground combat +5 (armor tier 1 x5) | supersedes Titanium |
| 11 | 3 | Battle Suits | 3,630 | ground | ground combat +10 (suit tier 1 x10) | personal armor group |
| 13 | 3 | Improved Industrial Tech 7 | 5,070 | industry | factory cost **7** | |
| 14 | 3 | Automated Repair System | 5,880 | ship special | repairs 15 % of max HP per combat turn (not stack-attack damage) | |
| 15 | 3 | Reduced Industrial Waste 60% | 6,750 | waste | scale 6 | Never(Sil) |
| 17 | 4 | Zortium Armor | 8,670 | armor | armor 200 % (II = 300 %); ground +10 | 1oom enum ZORTIUM; design list "ZORTRIUM" |
| 18 | 4 | Improved Industrial Tech 6 | 9,720 | industry | factory cost **6** | |
| 23 | 5 | Improved Industrial Tech 5 | 15,870 | industry | factory cost **5** | |
| 24 | 5 | Armored Exoskeleton | 17,280 | ground | ground +20 (suit tier 2); replaces Battle Suits | |
| 25 | 5 | Reduced Industrial Waste 40% | 18,750 | waste | scale 4 | Never(Sil) |
| 26 | 6 | Andrium Armor | 20,280 | armor | armor 250 % (II = 375 %); ground +15 | |
| 28 | 6 | Improved Industrial Tech 4 | 23,520 | industry | factory cost **4** | |
| 33 | 7 | Improved Industrial Tech 3 | 32,670 | industry | factory cost **3** | |
| 34 | 7 | Tritanium Armor | 34,680 | armor | armor 300 % (II = 450 %); ground +20 | |
| 35 | 7 | Reduced Industrial Waste 20% | 36,750 | waste | scale 2 | Never(Sil) |
| 36 | 8 | Advanced Damage Control | 38,880 | ship special | repairs 30 % of max HP per combat turn | |
| 38 | 8 | Improved Industrial Tech 2 | 43,320 | industry | factory cost **2** | |
| 40 | 8 | Powered Armor | 48,000 | ground | ground +30 (suit tier 3); replaces earlier suits | |
| 42 | 9 | Adamantium Armor | 52,920 | armor | armor 350 % (II = 525 %); ground +25 | |
| 45 | 9 | Industrial Waste Elimination | 60,750 | waste | pollution 0 (scale 0) | Never(Sil) |
| 50 | 10 | Neutronium Armor | 75,000 | armor | armor 400 % (II = 600 %); ground +30 | always present (only tech in tier 10) |

Armor HP = hull hits x armor% / 100 (Duralloy therefore adds +50 % over Titanium). See section 3.5 for costs/space of the normal and "II" (heavy) versions.

### 2.3 Force Fields (field 2) - 23 researchable + L1

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Class I Deflector Shield | free | shield | absorbs 1 damage per hit; base_shield for planets starts at Class I | L1 |
| 4 | 1 | Class II Deflector Shield | 480 | shield | absorbs 2 | always present; missile bases use best deflector |
| 8 | 2 | Personal Deflector Shield | 1,920 | ground | ground combat +10 (personal-shield tier 1 x10) | |
| 10 | 2 | Class III Deflector Shield | 3,000 | shield | absorbs 3 | |
| 12 | 3 | Class V Planetary Shield | 4,320 | planetary | planet shield 5: each missile base absorbs 5 more damage; build cost **500 BC** per planet; popup after discovery | game-defining per [SW]; can be absent (~33 % of normal-race trees, ~20 % Psilon) |
| 14 | 3 | Class IV Deflector Shield | 5,880 | shield | absorbs 4 | |
| 16 | 4 | Repulsor Beam | 7,680 | ship special | pushes enemy ships within 1 square away (keeps them >= 2 squares); not vs cloaked/teleported ships; cost 550 flat, space 100, power 200 (1oom) | |
| 20 | 4 | Class V Deflector Shield | 12,000 | shield | absorbs 5 | |
| 21 | 5 | Personal Absorption Shield | 13,230 | ground | ground +20 (tier 2); replaces Personal Deflector | |
| 22 | 5 | Class X Planetary Shield | 14,520 | planetary | planet shield 10; cost **1000 BC** | |
| 24 | 5 | Class VI Deflector Shield | 17,280 | shield | absorbs 6 | |
| 27 | 6 | Cloaking Device | 21,870 | ship special | when active +5 defense rating but weapons cannot fire; cannot re-activate until a turn without firing (SW) | |
| 30 | 6 | Class VII Deflector Shield | 27,000 | shield | absorbs 7 | |
| 31 | 7 | Zyro Shield | 28,830 | ship special | each missile that hits has a 75 % chance to be destroyed minus 1 % per missile tech level (1oom misshield 75) | anti-missile group |
| 32 | 7 | Class XV Planetary Shield | 30,720 | planetary | planet shield 15; cost **1500 BC** | |
| 34 | 7 | Class IX Deflector Shield | 34,680 | shield | absorbs 9 | no Class VIII exists |
| 37 | 8 | Stasis Field | 41,070 | ship special | removes the target from combat for 1 turn; cost 2500 flat, space 200, power 275 (1oom) | "Singular" |
| 38 | 8 | Personal Barrier Shield | 43,320 | ground | ground +30 (tier 3); replaces earlier personal shields | |
| 40 | 8 | Class XI Deflector Shield | 48,000 | shield | absorbs 11 | |
| 42 | 9 | Class XX Planetary Shield | 52,920 | planetary | planet shield 20; cost **2000 BC** | |
| 43 | 9 | Black Hole Generator | 55,470 | ship special | destroys 25-100 % of enemy targets minus 2 % per target shield class (SW); cost 2750 flat, space 750, power 750 | |
| 44 | 9 | Class XIII Deflector Shield | 58,080 | shield | absorbs 13 | |
| 46 | 10 | Lightning Shield | 63,480 | ship special | each missile that hits has 100 % chance to be destroyed minus 1 % per missile tech level (misshield 100) | |
| 50 | 10 | Class XV Deflector Shield | 75,000 | shield | absorbs 15 | |

Deflector classes that exist: I, II, III, IV, V, VI, VII, IX, XI, XIII, XV (11 classes; none for VIII, X, XII, XIV).
Planetary shield levels are 5/10/15/20 (`have_planet_shield`), cost table `{0, 500, 1000, 1500, 2000}` indexed by level/5.
Ship-shield damage absorption is subtracted per hit; for planets the planetary shield value is added to the base's own absorb (1oom battle setup).

### 2.4 Planetology (field 3) - 29 researchable + L1

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Ecological Restoration | free | eco | cleans **2** waste units per BC of ecology spending; enables the Standard Colony Base | L1 |
| 2 | 1 | Terraforming +10 | 120 | terraform | max population +10 on a planet (via ecology BC, pop-cost per point below) | cost text: 50 BC |
| 3 | 1 | Controlled Barren Environment | 270 | environment | colonise Barren (type 6) or better; unlocks Barren Colony Base (cost 375 BC raw 3750, space 700) | Never(Sil) |
| 5 | 1 | Improved Ecological Restoration | 750 | eco | cleans **3** waste/BC | Never(Sil) |
| 6 | 2 | Controlled Tundra Environment | 1,080 | environment | Tundra (5) or better; Tundra Colony Base 400 BC | Never(Sil) |
| 8 | 2 | Terraforming +20 | 1,920 | terraform | +20 | cost text 100 BC |
| 9 | 2 | Controlled Dead Environment | 2,430 | environment | Dead (4) or better; base 425 BC | Never(Sil) |
| 10 | 2 | Death Spores | 3,000 | bio weapon | ship weapon: -1 max population per shot, ignores shields; ammo 5; cost 100 raw, space 100, power 10 | bio group (Planetology TL for miniaturisation) |
| 12 | 3 | Controlled Inferno Environment | 4,320 | environment | Inferno (3) or better; base 450 BC | ESS; Never(Sil) |
| 13 | 3 | Enhanced Ecological Restoration | 5,070 | eco | cleans **5**/BC | Never(Sil) |
| 14 | 3 | Terraforming +30 | 5,880 | terraform | +30 | cost text 150 BC |
| 15 | 3 | Controlled Toxic Environment | 6,750 | environment | Toxic (2) or better; base 475 BC | Never(Sil) |
| 16 | 4 | Soil Enrichment | 7,680 | growth | ecology project **150 BC** converts a Normal-growth planet to Fertile: base max pop +25 % (formula in the notes below, min +5) | Never(Sil) |
| 17 | 4 | Bio Toxin Antidote | 8,670 | defense | reduces population damage from every death weapon by 1 (`antidote` 1) | |
| 18 | 4 | Controlled Radiated Environment | 9,720 | environment | Radiated (1) or better; base 500 BC | Never(Sil) |
| 20 | 4 | Terraforming +40 | 12,000 | terraform | +40 | cost text 200 BC |
| 21 | 5 | Cloning | 13,230 | growth | BC per +1 population via the ecology slider: 20 -> **10** | Sakkra x2/3 |
| 22 | 5 | Atmospheric Terraforming | 14,520 | growth | converts a Hostile planet to Normal growth (type becomes Minimal); max pop +20 (Radiated/Toxic/Inferno) / +10 (Dead/Tundra) / +0 (Barren); project cost **200 BC** (1oom) | ESS; Never(Sil); (conflict: SW text says 150 BC) |
| 24 | 5 | Advanced Ecological Restoration | 17,280 | eco | cleans **10**/BC | Never(Sil) in 1oom fix mode |
| 26 | 6 | Terraforming +50 | 20,280 | terraform | +50 | cost text 250 BC |
| 27 | 6 | Doom Virus | 21,870 | bio weapon | -2 max pop per shot, ignores shields; ammo 5; cost 150 raw, space 200, power 10 | |
| 30 | 6 | Advanced Soil Enrichment | 27,000 | growth | project **300 BC** converts Fertile (or Normal) to Gaia: base max pop +50 % (formula in the notes below, min +5); also covers plain Soil Enrichment | Never(Sil) in fix mode. [SW] argues it rivals Complete Terraforming in value |
| 32 | 7 | Terraforming +60 | 30,720 | terraform | +60 | ESS; cost text 300 BC |
| 34 | 7 | Complete Ecological Restoration | 34,680 | eco | cleans **20**/BC | Never(Sil) |
| 36 | 8 | Universal Antidote | 38,880 | defense | death-weapon population damage reduced by 2 | |
| 38 | 8 | Terraforming +80 | 43,320 | terraform | +80 | cost text 400 BC |
| 40 | 8 | Bio Terminator | 48,000 | bio weapon | -3 max pop per shot, ignores shields; ammo 5; cost 200 raw, space 300, power 10 | |
| 42 | 9 | Advanced Cloning | 52,920 | growth | BC per +1 population: **5** | ESS; Sakkra x2/3 |
| 44 | 9 | Terraforming +100 | 58,080 | terraform | +100 | cost text 500 BC |
| 50 | 10 | Complete Terraforming | 75,000 | terraform | +120 | always present; cost text 600 BC |

Terraforming mechanics (1oom): `max_pop3` (current cap) may grow up to `max_pop2 + terraform_n` (terraform_n = the best +N tech: 10, 20, 30, 40, 50, 60, 80, 100, 120).
Each ecology BC beyond waste cleanup buys `1 / terraform_cost_per_inc` population cap, where
`terraform_cost_per_inc = max(2, 5 - (techLevel-2)/12)` = 5, 5, 4, 4, 3, 3, 2, 2, 2 for +10 ... +120.
(conflict: the in-game/SW text quotes a flat 5 BC per point, i.e. +10 = 50 BC ... +120 = 600 BC; the code lowers the per-point price at higher tiers.)
Planet growth classes: Hostile (0) -> Normal (1) -> Fertile (2) -> Gaia (3). Soil Enrichment 150 BC, Advanced Soil Enrichment 300 BC, Atmospheric 200 BC
(`game_num_soil_cost`, `adv_soil_cost`, `atmos_cost`); the ecology slider BC accumulate in `bc_to_ecoproj` after waste cleanup and the project fires when enough has accumulated.
Soil formulas (1oom `game_turn_soil_enrich`, original v1.3 behaviour with `game_num_soil_rounding_fix = false`), `m1` = the planet's base max population (`max_pop1`):
```
Fertile (Soil Enrichment):   inc = (m1/20)*5;  if ((m1/20) % 5 != 0) inc += 5;   inc = max(inc, 5)
Gaia (Adv. Soil Enrichment): inc = (m1/10)*5;  if ((m1/10) % 5 != 0) inc += 5;   inc = max(inc, 5)
max_pop2 = m1 + inc;  max_pop3 += (max_pop2 - old_max_pop2);  max_pop3 = min(max_pop3, best_terraform_N + max_pop2);  max_pop3 = min(max_pop3, 300)
```
(The "+5 unless ..." rounding is a quirk of the original: 1oom's optional fix replaces it with `ceil(m1/20)*5` / `ceil(m1/10)*5`. Gaia is always computed from `m1`, not cumulative with Fertile,
so the end result is m1 + ~50 %.) Atmospheric Terraforming (`game_turn_atmos_tform`): planet type -> Minimal, growth -> Normal, and `max_pop1/2/3 += 20` (Radiated, Toxic, Inferno) / `+10` (Dead, Tundra) / `+0` (Barren).
Planet-type ids: Radiated 1, Toxic 2, Inferno 3, Dead 4, Tundra 5, Barren 6, Minimal 7, Desert 8, Steppe 9, Arid 10, Ocean 11, Jungle 12, Terran 13. Global caps: max population 300 per planet, max factories 2500 (2700 in 1oom's v1.3a patch).
Colony-base availability: `have_colony_for` = best Controlled-Environment tech (Radiated lowest); default Minimal or better; any single tech is inclusive of all milder types.
Death weapons: population damage per shot is (weapon value - antidote), minimum 0 (`antidote` = 1 with L17, 2 with L36).

### 2.5 Propulsion (field 4) - 27 researchable + L1

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Retro Engines | free | engine | warp 1 (1 pc/turn), combat move 1; engine table power 10, space 10, cost 20 | L1; starting ships use these |
| 3 | 1 | Hydrogen Fuel Cells | 270 | fuel | fuel range 3 -> **4** pc | ESS group {3,5}. (conflict: SW Propulsion page says level 2; 1oom + Comparative tree say 3) |
| 5 | 1 | Deuterium Fuel Cells | 750 | fuel | range **5** | ESS |
| 6 | 2 | Nuclear Engines | 1,080 | engine | warp 2; combat move 2; transports 1 pc/turn | have_engine stays 1 (same as start) |
| 9 | 2 | Irridium Fuel Cells | 2,430 | fuel | range **6** | in-game spelling "Irridium" |
| 10 | 2 | Inertial Stabilizer | 3,000 | ship special | +2 maneuverability, +1 combat move (extraman 2) | AI overvalues it |
| 12 | 3 | Sub-Light Drives | 4,320 | engine | warp 3; combat move 2; transports 2 | |
| 14 | 3 | Dotomite Crystals | 5,880 | fuel | range **7** | |
| 16 | 4 | Energy Pulsar | 7,680 | ship special | at the start of combat deals 5 damage to adjacent+diagonal ships, +1 per 2 attacking ships (pulsar 1); cost 750 flat, space 150, power 250 | |
| 18 | 4 | Fusion Drives | 9,720 | engine | warp 4; combat move 3; transports 3 | |
| 19 | 4 | Uridium Fuel Cells | 10,830 | fuel | range **8** | |
| 20 | 4 | Warp Dissipator | 12,000 | ship special | reduces the defender's maneuverability by 0-1 per turn (can eventually immobilise); cost 650 flat, space 100, power 300 | |
| 23 | 5 | Reajax II Fuel Cells | 15,870 | fuel | range **9** | |
| 24 | 5 | Impulse Drives | 17,280 | engine | warp 5; combat move 3; transports 4 | |
| 27 | 6 | Intergalactic Star Gates | 21,870 | planetary | allows building a Stargate on a planet: **3000 BC** (maintenance constant `stargate_maint` = 100, unit unverified); ships travel between two owned gate worlds in 1 turn | `have_stargates` |
| 29 | 6 | Trilithium Crystals | 25,230 | fuel | range **10** | |
| 30 | 6 | Ion Drives | 27,000 | engine | warp 6; combat move 4; transports 5 | |
| 34 | 7 | High Energy Focus | 34,680 | ship special | **+3 range** for direct-fire weapons (not missiles, torpedoes, bombs, death weapons); cost raw {30,135,625,3500}, space {35,100,150,500}, power {65,200,350,1000} | always present (only tech in tier 7); [SW] treats it as the start of the endgame |
| 36 | 8 | Anti-Matter Drives | 38,880 | engine | warp 7; combat move 4; transports 6 | |
| 38 | 8 | Sub Space Teleporter | 43,320 | ship special | ship always moves first in combat and can teleport to any square | |
| 40 | 8 | Ionic Pulsar | 48,000 | ship special | 10 damage to adjacent+diagonal ships +1 per 2 attackers (pulsar 2); cost 1500 flat, space 400, power 750 | |
| 41 | 9 | Thorium Cells | 50,430 | fuel | **unlimited** range (code 30) | |
| 42 | 9 | Inter-Phased Drives | 52,920 | engine | warp 8; combat move 5; transports 7 | |
| 43 | 9 | Sub Space Interdictor | 55,470 | planetary | nullifies enemy Sub Space Teleporters in combats over your planets (`have_sub_space_int`, gives your missile bases the teleport-block flag) | |
| 45 | 9 | Combat Transporters | 60,750 | invasion | at least 50 % of your invasion transports land on the target planet despite defenses (`have_combat_transporter`) | |
| 46 | 10 | Inertial Nullifier | 63,480 | ship special | +4 maneuverability, +2 combat move (extraman 4) | |
| 48 | 10 | Hyper Drives | 69,120 | engine | warp 9; combat move 5; transports 8 | "HYPERTHRUST" in design list |
| 50 | 10 | Displacement Device | 75,000 | ship special | 33 % of all attacks against the ship automatically miss (SW) | |

Engine facts: fleet speed = warp = engine index + 1 pc/turn (a fleet moves at its slowest design); **colony/population transports move at
`have_engine`** (1 at start and with Nuclear, then 2..8 with Sub-Light..Hyper). Combat movement = warp/2 + 1 (integer division; warp 1 -> 1).
Ships with no fuel/range: a fleet orbiting a planet that falls outside range (range+3 only if it has Reserve Tanks) is removed (`game_fleet_unrefuel`).
Range is measured from the nearest owned (or allied) colony: `within_frange` = 1 inside `fuel_range`, 2 inside `fuel_range + 3`, else 0.

### 2.6 Weapons (field 5) - 46 researchable + L1 (+ Death Ray special)

Damage columns are per hit; "xN" = fires N times per turn or N attacks per hit. Full numeric rows (cost/space/power) in section 3.1.

| Lvl | T | Tech | RP | Type | Exact effect | Notes |
|---|---|---|---|---|---|---|
| 1 | 1 | Laser | free | beam | 1-4 dmg, range 1 | L1 |
| 1 | 1 | Heavy Laser | free | beam | 1-7, range 2 | L1 (heavy mount of Laser) |
| 1 | 1 | Nuclear Missile | free | missile | 4 dmg; 2-shot version range 6 "+1 speed"; 5-shot version range 4 | L1 |
| 1 | 1 | Nuclear Bomb | free | bomb | 3-12, ground only, 10 bombs | L1 |
| 2 | 1 | Hand Lasers | 120 | ground | ground combat +5 (personal-weapon tier 1 x5) | |
| 4 | 1 | Hyper-V Rockets | 480 | missile | 6 dmg; 2-shot range 7 (+1 speed), 5-shot range 5 | ESS group (missile line) |
| 5 | 1 | Gatling Laser | 750 | beam | 1-4 x4 shots/turn; cost 90 raw (3 lasers), space 20 (2 lasers), power 70 | (conflict: SW says it takes the space of 3 lasers; 1oom space is 20 = 2 lasers, cost = 3 lasers) |
| 6 | 2 | Anti-Missile Rockets | 1,080 | ship special | destroys 40 % of incoming missiles minus 1 % per missile tech level (misshield 40) | anti-missile group |
| 7 | 2 | Neutron Pellet Gun | 1,470 | beam | 2-5, halves target shield absorb | |
| 8 | 2 | Hyper-X Rockets | 1,920 | missile | 8 dmg; +1 to hit; 2-shot range 7 / 5-shot range 5 | ESS |
| 9 | 2 | Fusion Bomb | 2,430 | bomb | 5-20 ground only, 10 bombs | |
| 10 | 2 | Ion Cannon / Heavy Ion Cannon | 3,000 | beam | 3-8 range 1 / 3-15 range 2 | |
| 11 | 3 | Scatter Pack V Missiles | 3,630 | missile | splits into 5 missiles of 6 dmg; +1 to hit; 2-shot range 7 / 5-shot range 5 | ESS |
| 12 | 3 | Ion Rifle | 4,320 | ground | ground +10 (tier 2 x5); replaces lower rifles | |
| 13 | 3 | Mass Driver | 5,070 | beam | 5-8, halves shield absorb | |
| 14 | 3 | Merculite Missiles | 5,880 | missile | 10 dmg; +2 to hit; range 8 (2-shot) / 6 (5-shot) | |
| 15 | 3 | Neutron Blaster / Heavy Blast Cannon | 6,750 | beam | 3-12 range 1 / 3-24 range 2 | |
| 16 | 4 | Anti-Matter Bomb | 7,680 | bomb | 10-40 ground only, 10 bombs | |
| 17 | 4 | Graviton Beam | 8,670 | beam | 1-15 "streaming": excess damage carries to the next ship | |
| 18 | 4 | Stinger Missiles | 9,720 | missile | 15 dmg; +3 to hit; range 9 / 7 | ESS |
| 19 | 4 | Hard Beam | 10,830 | beam | 8-12, halves shield absorb | |
| 20 | 4 | Fusion Beam / Heavy Fusion Beam | 12,000 | beam | 4-16 range 1 / 4-30 range 2 | |
| 21 | 5 | Ion Stream Projector | 13,230 | ship special | stream 1: damage = 20 % of target hit points (+0.5 % per firing ship), rounded down, min 1; cost 1000 flat, space 250, power 500 | stream group |
| 22 | 5 | Omega-V Bomb | 14,520 | bomb | 20-50 ground only | |
| 23 | 5 | Anti-Matter Torpedoes | 15,870 | torpedo | 30 dmg, range 8, +4 to hit, fires once per 2 turns | |
| 24 | 5 | Fusion Rifle | 17,280 | ground | ground +20 (tier 3 -> counts 4, x5); replaces lower rifles | |
| 25 | 5 | Megabolt Cannon | 18,750 | beam | 2-20, +3 levels to hit | |
| 26 | 6 | Phasor / Heavy Phasor | 20,280 | beam | 5-20 range 1 / 5-40 range 2 | |
| 27 | 6 | Scatter Pack VII Missiles | 21,870 | missile | 7 missiles of 10 dmg; +2 to hit; range 8 / 6 | ESS |
| 28 | 6 | Auto Blaster | 23,520 | beam | 4-16 fires 3x per turn | |
| 29 | 6 | Pulson Missiles | 25,230 | missile | 20 dmg; +4 to hit; range 10 / 8 | |
| 30 | 6 | Tachyon Beam | 27,000 | beam | 1-25 streaming (excess carries over) | |
| 31 | 7 | Hand Phasor | 28,830 | ground | ground +25 (tier 4 -> counts 5, x5) | |
| 32 | 7 | Gauss Autocannon | 30,720 | beam | 7-10, fires 4x per turn, halves shield absorb | [SW] ranks it among the best weapons in the game |
| 33 | 7 | Particle Beam | 32,670 | beam | 10-20, halves shield absorb | |
| 34 | 7 | Hercular Missiles | 34,680 | missile | 25 dmg; +5 to hit; range 10 / 9 | ESS |
| 35 | 7 | Plasma Cannon | 36,750 | beam | 6-30 | |
| 37 | 8 | Disruptor | 41,070 | beam | 10-40, range 2 | |
| 38 | 8 | Pulse Phasor | 43,320 | beam | 5-20 fires 3x per turn | |
| 39 | 8 | Neutronium Bomb | 45,630 | bomb | 40-70 ground only | |
| 40 | 8 | Hellfire Torpedoes | 48,000 | torpedo | 4 attacks of 25 per hit ("hits all four shields"), range 10, +6 to hit, once per 2 turns | |
| 41 | 9 | Zeon Missiles | 50,430 | missile | 30 dmg; +6 to hit; range 9 / 7 | ESS |
| 42 | 9 | Plasma Rifle | 52,920 | ground | ground +30 (tier 5 -> counts 6, x5) | |
| 43 | 9 | Proton Torpedoes | 55,470 | torpedo | 75 dmg, range 10, +6, once per 2 turns | |
| 44 | 9 | Scatter Pack X Missiles | 58,080 | missile | 10 missiles of 15 dmg; +3 to hit; range 10 / 10 | ESS |
| 45 | 9 | Tri-Focus Plasma Cannon | 60,750 | beam | 20-50 | |
| 46 | 10 | Stellar Converter | 63,480 | beam | 4 attacks of 10-35 per shot ("hits all four shields"), range 3 | |
| 47 | 10 | Neutron Stream Projector | 66,270 | ship special | stream 2: 40 % of target hit points (+0.5 % per firing ship), min 1; cost 2000 flat, space 500, power 1250 | |
| 48 | 10 | Mauler Device | 69,120 | beam | 20-100 | "cruel brutal damage" |
| 50 | 10 | Plasma Torpedoes | 75,000 | torpedo | 150 dmg, range 10, +7 to hit, once per 2 turns, loses 15 damage per hex travelled | |
| -- | -- | Death Ray (Orion/Guardian reward only) | n/a | beam | 200-1000 dmg (SW elsewhere says "up to 500"); cost 1000 raw (100 BC), space 2000, power 2000 | never in a research list |
| -- | -- | Crystal Ray, Amoeba Stream | n/a | monster | monster-only weapons (100-300 / 250-1000 dmg) | not obtainable |

Personal (ground) weapons form one obsolescence group: Hand Lasers (tier 1), Ion Rifle (2), Fusion Rifle (3), Hand Phasor (4), Plasma Rifle (5).
Ground-combat bonus = 5 x tier, with tiers above 2 counted +1 (so +5, +10, +20, +25, +30). See section 5.

### 2.7 Counts

| Field | Researchable | L1 bundle | Tiers with a single tech |
|---|---|---|---|
| Computers | 31 | Battle Computer I, Robotic Controls 2, Battle Scanner | none |
| Construction | 24 | Titanium Armor, Reserve Fuel Tanks | T10 |
| Force Fields | 23 | Class I Deflector | T1 |
| Planetology | 29 | Ecological Restoration (+ Standard Colony Base) | T10 |
| Propulsion | 27 | Retro Engines | T7 |
| Weapons | 46 (+ Death Ray special) | Laser, Heavy Laser, Nuclear Missile, Nuclear Bomb | none |
| **Total** | **180 researchable** (+ 6 free bundles) | | |

---

## 3. Ship-component numeric appendix (key numbers; units)

Units (1oom `game_shiptech.c`, verified against starting-ship costs: scout 10 BC, colony ship 570 BC):
* Cost fields are in **tenths of BC** (BC = raw/10 after the TL reduction; item floor 0.5 BC). Space and power are plain integers.
* Arrays `{a,b,c,d}` are per hull: **small / medium / large / huge**.
* Item cost after miniaturisation = `raw * T50[tm] / 100`, item space = `raw * T25[tm] / 100` (Appendix C).
* Weapons/engines are not hull-indexed (their `cost/space/power` are for one mount; engine totals use "engine count" in tenths).
* Design cost = `(hull_cost + sum(weapon cost * count) + engine_cost*engines/10 + computer + jammer + shield + armor + specials + 5) / 10`, min 1.
  Design space = `hull_space(1 + TL_construction/50) - components`. Engines needed = `total_power / (engine_power/10)` (tenths of an engine), min 1.
  Total power = weapon power x count + hull power x (maneuver+1) + computer + jammer + shield + specials power.
* Hit points = `hull_hits * armor% / 100`.

### 3.1 Weapons

Columns: dmg per hit | range (squares; missile = flight range) | to-hit bonus | ammo (-1 = unlimited) | fires/turn | attacks per hit | cost raw | space | power | flags.

| Level | Weapon | Dmg | Rng | Acc | Ammo | Fires | xHit | Cost | Space | Pwr | Flags |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Nuclear Bomb | 3-12 | 1 | 0 | 10 | 1 | 1 | 30 | 40 | 10 | bomb, ground only |
| 1 | Laser | 1-4 | 1 | 0 | -1 | 1 | 1 | 30 | 10 | 25 | |
| 1 | Heavy Laser | 1-7 | 2 | 0 | -1 | 1 | 1 | 90 | 30 | 75 | |
| 1 | Nuclear Missile (2 shots) | 4 | 6 | 0 | 2 | 1 | 1 | 70 | 50 | 20 | "+1 speed" |
| 1 | Nuclear Missile (5 shots) | 4 | 4 | 0 | 5 | 1 | 1 | 105 | 75 | 30 | |
| 4 | Hyper-V Rocket (2) | 6 | 7 | 0 | 2 | 1 | 1 | 90 | 70 | 20 | "+1 speed" |
| 4 | Hyper-V Rocket (5) | 6 | 5 | 0 | 5 | 1 | 1 | 135 | 105 | 30 | |
| 5 | Gatling Laser | 1-4 | 1 | 0 | -1 | 4 | 1 | 90 | 20 | 70 | |
| 7 | Neutron Pellet Gun | 2-5 | 1 | 0 | -1 | 1 | 1 | 30 | 15 | 25 | halves shields |
| 8 | Hyper-X Rocket (2) | 8 | 7 | +1 | 2 | 1 | 1 | 120 | 100 | 20 | |
| 8 | Hyper-X Rocket (5) | 8 | 5 | +1 | 5 | 1 | 1 | 180 | 150 | 30 | |
| 9 | Fusion Bomb | 5-20 | 1 | 0 | 10 | 1 | 1 | 30 | 50 | 10 | bomb |
| 10 | Ion Cannon | 3-8 | 1 | 0 | -1 | 1 | 1 | 40 | 15 | 35 | |
| 10 | Heavy Ion Cannon | 3-15 | 2 | 0 | -1 | 1 | 1 | 110 | 45 | 105 | |
| 11 | Scatter Pack V (2) | 6 x5 | 7 | +1 | 2 | 1 | 1 | 180 | 115 | 50 | MIRV to 5 |
| 11 | Scatter Pack V (5) | 6 x5 | 5 | +1 | 5 | 1 | 1 | 270 | 170 | 80 | |
| 10 (PL) | Death Spores | 1 (pop) | 1 | 0 | 5 | 1 | 1 | 100 | 100 | 10 | bio, bomb |
| 13 | Mass Driver | 5-8 | 1 | 0 | -1 | 1 | 1 | 90 | 55 | 50 | halves shields |
| 14 | Merculite Missile (2) | 10 | 8 | +2 | 2 | 1 | 1 | 130 | 105 | 20 | |
| 14 | Merculite Missile (5) | 10 | 6 | +2 | 5 | 1 | 1 | 195 | 155 | 30 | |
| 15 | Neutron Blaster | 3-12 | 1 | 0 | -1 | 1 | 1 | 60 | 20 | 60 | |
| 15 | Heavy Blast Cannon | 3-24 | 2 | 0 | -1 | 1 | 1 | 180 | 60 | 180 | |
| 16 | Anti-Matter Bomb | 10-40 | 1 | 0 | 10 | 1 | 1 | 50 | 75 | 10 | bomb |
| 17 | Graviton Beam | 1-15 | 1 | 0 | -1 | 1 | 1 | 60 | 20 | 50 | streaming |
| 18 | Stinger Missile (2) | 15 | 9 | +3 | 2 | 1 | 1 | 190 | 155 | 30 | |
| 18 | Stinger Missile (5) | 15 | 7 | +3 | 5 | 1 | 1 | 270 | 230 | 45 | |
| 19 | Hard Beam | 8-12 | 1 | 0 | -1 | 1 | 1 | 120 | 50 | 100 | halves shields |
| 20 | Fusion Beam | 4-16 | 1 | 0 | -1 | 1 | 1 | 70 | 20 | 75 | |
| 20 | Heavy Fusion Beam | 4-30 | 2 | 0 | -1 | 1 | 1 | 210 | 60 | 225 | |
| 22 | Omega-V Bomb | 20-50 | 1 | 0 | 10 | 1 | 1 | 80 | 140 | 10 | bomb |
| 23 | Anti-Matter Torpedo | 30 | 8 | +4 | -1 | 1 | 1 | 300 | 75 | 300 | once per 2 turns |
| 25 | Megabolt Cannon | 2-20 | 1 | +3 | -1 | 1 | 1 | 80 | 30 | 65 | |
| 26 | Phasor | 5-20 | 1 | 0 | -1 | 1 | 1 | 90 | 20 | 90 | |
| 26 | Heavy Phasor | 5-40 | 2 | 0 | -1 | 1 | 1 | 260 | 60 | 270 | |
| 27 | Scatter Pack VII (2) | 10 x7 | 8 | +2 | 2 | 1 | 1 | 280 | 170 | 50 | MIRV to 7 |
| 27 | Scatter Pack VII (5) | 10 x7 | 6 | +2 | 5 | 1 | 1 | 420 | 230 | 80 | |
| 27 (PL) | Doom Virus | 2 (pop) | 1 | 0 | 5 | 1 | 1 | 150 | 200 | 10 | bio, bomb |
| 28 | Auto Blaster | 4-16 | 1 | 0 | -1 | 3 | 1 | 140 | 30 | 90 | |
| 29 | Pulson Missile (2) | 20 | 10 | +4 | 2 | 1 | 1 | 200 | 160 | 40 | |
| 29 | Pulson Missile (5) | 20 | 8 | +4 | 5 | 1 | 1 | 300 | 240 | 60 | |
| 30 | Tachyon Beam | 1-25 | 1 | 0 | -1 | 1 | 1 | 90 | 30 | 70 | streaming |
| 32 | Gauss Autocannon | 7-10 | 1 | 0 | -1 | 4 | 1 | 280 | 105 | 105 | halves shields |
| 33 | Particle Beam | 10-20 | 1 | 0 | -1 | 1 | 1 | 150 | 90 | 75 | halves shields |
| 34 | Hercular Missile (2) | 25 | 10 | +5 | 2 | 1 | 1 | 260 | 220 | 40 | |
| 34 | Hercular Missile (5) | 25 | 9 | +5 | 5 | 1 | 1 | 390 | 330 | 60 | |
| 35 | Plasma Cannon | 6-30 | 1 | 0 | -1 | 1 | 1 | 120 | 30 | 100 | |
| 37 | Disruptor | 10-40 | 2 | 0 | -1 | 1 | 1 | 210 | 70 | 160 | |
| 38 | Pulse Phasor | 5-20 | 1 | 0 | -1 | 3 | 1 | 250 | 40 | 120 | |
| 39 | Neutronium Bomb | 40-70 | 1 | 0 | 10 | 1 | 1 | 90 | 200 | 10 | bomb |
| 40 (PL) | Bio Terminator | 3 (pop) | 1 | 0 | 5 | 1 | 1 | 200 | 300 | 10 | bio, bomb |
| 40 | Hellfire Torpedo | 25 | 10 | +6 | -1 | 1 | 4 | 500 | 150 | 350 | once per 2 turns |
| 41 | Zeon Missile (2) | 30 | 9 | +6 | 2 | 1 | 1 | 300 | 250 | 50 | |
| 41 | Zeon Missile (5) | 30 | 7 | +6 | 5 | 1 | 1 | 450 | 375 | 75 | |
| 43 | Proton Torpedo | 75 | 10 | +6 | -1 | 1 | 1 | 500 | 100 | 400 | once per 2 turns |
| 44 | Scatter Pack X (2) | 15 x10 | 10 | +3 | 2 | 1 | 1 | 300 | 250 | 50 | MIRV to 10 |
| 44 | Scatter Pack X (5) | 15 x10 | 10 | +3 | 5 | 1 | 1 | 450 | 420 | 80 | |
| 45 | Tri-Focus Plasma Cannon | 20-50 | 1 | 0 | -1 | 1 | 1 | 250 | 70 | 180 | |
| 46 | Stellar Converter | 10-35 | 3 | 0 | -1 | 1 | 4 | 500 | 200 | 300 | |
| 48 | Mauler Device | 20-100 | 1 | 0 | -1 | 1 | 1 | 550 | 150 | 300 | |
| 50 | Plasma Torpedo | 150 | 10 | +7 | -1 | 1 | 1 | 600 | 150 | 450 | once per 2 turns, -15 dmg/hex |
| Orion | Death Ray | 200-1000 | 1 | 0 | -1 | 1 | 1 | 1000 | 2000 | 2000 | |

(1oom flags beyond those listed: `damagefade` true only for the Plasma Torpedo; torpedoes use "misstype" 1-4; "halveshield" for Neutron Pellet Gun, Mass Driver,
Hard Beam, Gauss Autocannon, Particle Beam.) Missile "range" is flight distance; 2-shot versions are faster/longer-ranged than 5-shot versions.

### 3.2 Battle computers (power / space per hull; cost raw per hull)

| Mark (level) | Tech lvl | Power = Space (S/M/L/H) | Cost raw (S/M/L/H) |
|---|---|---|---|
| I (1) | 1 | 5/10/20/100 | 40/200/1000/5000 |
| II (2) | 5 | 7/15/30/150 | 50/240/1200/6000 |
| III (3) | 10 | 10/20/40/200 | 60/280/1400/7000 |
| IV (4) | 15 | 12/25/50/250 | 70/320/1600/8000 |
| V (5) | 20 | 15/30/60/300 | 80/360/1800/9000 |
| VI (6) | 25 | 17/35/70/350 | 90/400/2000/10000 |
| VII (7) | 30 | 20/40/80/400 | 100/440/2200/11000 |
| VIII (8) | 35 | 22/45/90/450 | 110/480/2400/12000 |
| IX (9) | 40 | 25/50/100/500 | 120/520/2600/13000 |
| X (10) | 45 | 27/55/110/550 | 130/560/2800/14000 |
| XI (11) | 50 | 30/60/120/600 | 140/600/3000/15000 |

### 3.3 ECM jammers

| Mark | Tech lvl | Power = Space (S/M/L/H) | Cost raw (S/M/L/H) |
|---|---|---|---|
| I | 2 | 10/20/40/170 | 25/150/1000/6250 |
| II | 7 | 15/30/60/250 | 27/165/1100/6875 |
| III | 12 | 20/40/80/330 | 30/180/1200/7500 |
| IV | 17 | 25/50/100/410 | 32/195/1300/8125 |
| V | 22 | 30/60/120/490 | 35/210/1400/8750 |
| VI | 27 | 35/70/140/570 | 37/225/1500/9375 |
| VII | 32 | 40/80/160/650 | 40/240/1600/10000 |
| VIII | 37 | 45/90/180/730 | 42/255/1700/10625 |
| IX | 42 | 50/100/200/810 | 45/270/1800/11250 |
| X | 47 | 55/110/220/900 | 50/285/1900/11875 |

### 3.4 Deflector shields (absorb per hit; power = space)

| Class | Absorb | Tech lvl | Space = Power (S/M/L/H) | Cost raw (S/M/L/H) |
|---|---|---|---|---|
| I | 1 | 1 | 5/20/60/250 | 30/190/1200/7500 |
| II | 2 | 4 | 10/35/90/375 | 35/220/1400/8750 |
| III | 3 | 10 | 15/50/120/500 | 40/250/1600/10000 |
| IV | 4 | 14 | 20/65/150/675 | 45/280/1800/11250 |
| V | 5 | 20 | 25/80/180/750 | 50/310/2000/12500 |
| VI | 6 | 24 | 30/95/210/875 | 55/340/2200/13750 |
| VII | 7 | 30 | 35/110/240/1000 | 60/370/2400/15000 |
| IX | 9 | 34 | 40/125/270/1125 | 65/400/2600/16250 |
| XI | 11 | 40 | 45/140/300/1250 | 70/430/2800/17500 |
| XIII | 13 | 44 | 50/155/330/1375 | 80/460/3000/18750 |
| XV | 15 | 50 | 55/160/360/1500 | 90/490/3200/20000 |

### 3.5 Armor ("II" = heavy version; armor % multiplies hull hits)

| Armor | Tech lvl | Armor % | Cost raw (S/M/L/H) | Space (S/M/L/H) |
|---|---|---|---|---|
| Titanium | 1 | 100 | 0 | 0 |
| Titanium II | 1 | 150 | 20/100/500/2500 | 20/80/400/2000 |
| Duralloy | 10 | 150 | 20/100/600/3000 | 2/10/60/300 |
| Duralloy II | 10 | 225 | 30/150/900/4500 | 25/85/425/2100 |
| Zortium | 17 | 200 | 40/200/1000/5000 | 4/20/100/500 |
| Zortium II | 17 | 300 | 60/300/1500/7500 | 30/100/500/2500 |
| Andrium | 26 | 250 | 60/300/1500/7500 | 6/30/150/750 |
| Andrium II | 26 | 375 | 90/450/2250/11250 | 35/115/575/2875 |
| Tritanium | 34 | 300 | 80/400/2000/10000 | 8/40/200/1000 |
| Tritanium II | 34 | 450 | 120/600/3000/15000 | 40/130/650/3250 |
| Adamantium | 42 | 350 | 100/500/2500/12500 | 10/50/250/1250 |
| Adamantium II | 42 | 525 | 150/750/3750/18750 | 45/150/750/3750 |
| Neutronium | 50 | 400 | 120/600/3000/15000 | 12/60/300/1500 |
| Neutronium II | 50 | 600 | 180/900/4500/25000 | 50/175/875/4375 |

### 3.6 Engines (one "engine unit"; count is in tenths)

| Engine | Tech lvl | Warp | Power | Space | Cost raw | Combat move | Transport speed |
|---|---|---|---|---|---|---|---|
| Retro | 1 | 1 | 10 | 10 | 20 | 1 | 1 |
| Nuclear | 6 | 2 | 20 | 18 | 40 | 2 | 1 |
| Sub-Light | 12 | 3 | 30 | 26 | 60 | 2 | 2 |
| Fusion | 18 | 4 | 40 | 33 | 80 | 3 | 3 |
| Impulse | 24 | 5 | 50 | 36 | 100 | 3 | 4 |
| Ion | 30 | 6 | 60 | 40 | 120 | 4 | 5 |
| Anti-Matter | 36 | 7 | 70 | 44 | 140 | 4 | 6 |
| Inter-Phased | 42 | 8 | 80 | 47 | 160 | 5 | 7 |
| Hyperthrust | 48 | 9 | 90 | 50 | 180 | 5 | 8 |

### 3.7 Ship specials and hulls

| Special | Tech (field lvl) | Cost raw (S/M/L/H) | Space (S/M/L/H) | Power (S/M/L/H) | Numeric effect |
|---|---|---|---|---|---|
| Reserve Fuel Tanks | CN 1 | 20/100/500/2500 | 20/100/500/2500 | 0 | +3 pc beyond fuel range |
| Standard Colony Base | PL 1 | 3500 all | 700 | 0 | colonise Minimal-or-better |
| Barren / Tundra / Dead / Inferno / Toxic / Radiated Colony Base | PL 3/6/9/12/15/18 | 3750/4000/4250/4500/4750/5000 | 700 | 0 | colonise down to that type |
| Battle Scanner | CM 1 | 300 all | 50 | 50 | scanner flag |
| Anti-Missile Rockets | WE 6 | 100 all | 2/10/50/250 | 8/40/200/1000 | misshield 40 |
| Repulsor Beam | FF 16 | 550 all | 100 | 200 | flag |
| Warp Dissipator | PR 20 | 650 all | 100 | 300 | flag |
| Energy Pulsar | PR 16 | 750 all | 150 | 250 | pulsar 1 |
| Inertial Stabilizer | PR 10 | 20/75/500/2700 | 4/20/100/500 | 8/40/200/1000 | extra maneuver 2 |
| Zyro Shield | FF 31 | 50/100/200/300 | 4/20/100/500 | 12/60/300/1500 | missile shield 75 |
| Automated Repair | CN 14 | 2/8/50/300 | 3/15/100/600 | 3/10/50/300 | repair 15 % |
| Stasis Field | FF 37 | 2500 all | 200 | 275 | flag |
| Cloaking Device | FF 27 | 30/150/750/3750 | 5/25/120/600 | 10/50/250/1250 | flag |
| Ion Stream Projector | WE 21 | 1000 all | 250 | 500 | stream 1 |
| High Energy Focus | PR 34 | 30/135/625/3500 | 35/100/150/500 | 65/200/350/1000 | +3 beam range |
| Ionic Pulsar | PR 40 | 1500 all | 400 | 750 | pulsar 2 |
| Black Hole Generator | FF 43 | 2750 all | 750 | 750 | flag |
| Sub Space Teleporter | PR 38 | 25/100/450/2250 | 4/20/100/500 | 16/80/400/2000 | flag |
| Lightning Shield | FF 46 | 200/300/400/500 | 6/30/150/750 | 15/70/350/1750 | missile shield 100 |
| Neutron Stream Projector | WE 47 | 2000 all | 500 | 1250 | stream 2 |
| Advanced Damage Control | CN 36 | 40/200/1000/5000 | 9/45/300/1800 | 9/30/150/450 | repair 30 % |
| Technology Nullifier | CM 49 | 3000 all | 750 | 1000 | flag |
| Inertial Nullifier | PR 46 | 60/200/1500/5000 | 6/30/150/750 | 12/60/300/1500 | extra maneuver 4 |
| Oracle Interface | CM 46 | 30/150/600/2750 | 8/40/200/1000 | 12/60/300/1500 | flag |
| Displacement Device | PR 50 | 30/150/300/2750 | 10/50/225/1250 | 10/50/225/1250 | flag |

Hulls (not researchable): small / medium / large / huge: cost raw 60 / 360 / 2000 / 12000; space 40 / 200 / 1000 / 5000 (x(1 + TL_Construction/50));
hull hits 3 / 18 / 100 / 600; hull power 2 / 15 / 100 / 700; defense modifier 2 / 1 / 0 / -1.
Starting designs (1oom): Scout (small, Reserve Fuel Tanks), Fighter (small, 1 Laser), Destroyer (medium, 1 Nuclear Missile + 3 Lasers),
Bomber (medium, 2 Nuclear Bombs + 2 Lasers), Colony Ship (large, Standard Colony Base).

---

## 4. Derived-stat tables: which tech sets which empire number

All from `game_update_tech_util` ([1oom]); "have X" = best tech owned wins.

### 4.1 Factories
| Number | Values |
|---|---|
| Factory build cost (BC) `factory_cost` | 10 base; CN 3 -> 9, 8 -> 8, 13 -> 7, 18 -> 6, 23 -> 5, 28 -> 4, 33 -> 3, 38 -> 2 |
| Factories operated per colonist `colonist_oper_factories` | 2 base; CM 8 -> 3, 18 -> 4, 28 -> 5, 38 -> 6, 48 -> 7; **Meklar +2** |
| Displayed/adjusted cost per factory `factory_adj_cost` | `factory_cost * colonist_oper_factories / 2` (Meklar: just `factory_cost`) |
| Waste scale `ind_waste_scale` (pollution per factory x/10) | 10 base; CN 5 -> 8, 15 -> 6, 25 -> 4, 35 -> 2, 45 -> 0 |
| Eco restoration `have_eco_restoration_n` (waste per BC) | 2 base; PL 5 -> 3, 13 -> 5, 24 -> 10, 34 -> 20 |

Waste mechanics (1oom `game_turn_build_eco`): per turn new waste = `factories * waste_scale / 10`, damped by existing waste; cleanup removes `n` units per eco BC;
non-Silicoid only (Silicoids produce no waste).

### 4.2 Range and sensing
| Number | Values |
|---|---|
| Fuel range (pc) | 3 base; PR 3 -> 4, 5 -> 5, 9 -> 6, 14 -> 7, 19 -> 8, 23 -> 9, 29 -> 10, 41 -> unlimited (30) |
| Reserve tanks extend | +3 pc (ships with the special) |
| Scanner range (pc) | 3 base; CM 4 -> 5, 13 -> 7, 23 -> 9 (ships in transit seen at 0 / 1 / 2 / 3 pc) |
| `have_engine` (transport speed) | 1 base; PR 6 -> 1, 12 -> 2, 18 -> 3, 24 -> 4, 30 -> 5, 36 -> 6, 42 -> 7, 48 -> 8 |
| Flags | PR 27 stargates; PR 43 sub-space interdictor; PR 45 combat transporters; CM 34 hyperspace comm; CM 13/23 IA scanner (fleet destination/ETA); CM 23 adv scanner |

### 4.3 Population and terraforming
| Number | Values |
|---|---|
| Colony-able type `have_colony_for` | Minimal (7) base; PL 3 -> Barren (6), 6 -> Tundra (5), 9 -> Dead (4), 12 -> Inferno (3), 15 -> Toxic (2), 18 -> Radiated (1) (highest owned wins); Silicoid always Radiated |
| Terraform N | PL 2 -> 10, 8 -> 20, 14 -> 30, 20 -> 40, 26 -> 50, 32 -> 60, 38 -> 80, 44 -> 100, 50 -> 120 |
| Terraform BC per +1 pop | 5, 5, 4, 4, 3, 3, 2, 2, 2 for the same steps |
| Soil / Atmos / Adv. soil flags | PL 16 / 22 / 30 (false for Silicoid) |
| `inc_pop_cost` (BC per +1 pop growth) | 20 base; PL 21 -> 10; PL 42 -> 5; Sakkra x2/3 (13 / 6 / 3) |
| `antidote` | PL 17 -> 1; PL 36 -> 2 |

### 4.4 Defence
| Number | Values |
|---|---|
| Planet shield level / cost | FF 12 -> 5 / 500 BC; 22 -> 10 / 1000; 32 -> 15 / 1500; 42 -> 20 / 2000 |
| Missile base weapon (`base_weapon`) | best 2-shot single-missile type owned (Nuclear, Hyper-V, Hyper-X, Merculite, Stinger, Pulson, Hercular, Zeon) via `game_get_base_weapon`; second slot = best multi-missile (Scatter Packs) via `game_get_base_weapon_2`; a base is modelled as 3 launchers of each of the two weapons |
| Missile base shield / computer / jammer | `base_shield` = best Deflector owned (Class I at start), `base_comp` = best Battle Computer (+1), jammer = best ECM (+1) |
| Missile base HP | `game_num_base_hp[armor tier]` = {50, 75, 100, 125, 150, 175, 200} for Titanium(0) ... Neutronium(6) armor (conflict: SW says a Titanium missile base has 15 HP - see section 9) |
| Order of defense spending per planet | pay upgrades of existing bases, then planetary shield, then new bases |
| Base upgrade cost | `(newBaseCost - oldBaseCost) * bases`; base cost = `3/5 * (armor + weapon + shield + computer + jammer costs, each miniaturised)`, min 50, AI discounted by difficulty (units unverified) |

### 4.5 Space and TL effects
* Hull space x (1 + TL_CN/50). Component cost/space tables: Appendix C.
* Computer/spy: spy purchase cost base = `TL_CM * 2 + 25` (Darlok halved). Mrrshan ships act as +4 computer levels; Alkari ships +3 defense (race bonuses, not tech).

### 4.6 Ground combat tech (see section 5).

### 4.7 Fuel/other flags unaffected by tech: starting fuel range 3, starting scanner 3.

### 4.8 Economy via Planetology TL
Worker BC per colonist = `(3 * TL_PL + 50) / 100` (Klackon x2); factory BC = 1 per operated factory per turn. Total planet output `v = factories + extra`.

### 4.9 Tech -> production popups
Discovering CN waste techs / eco restoration (levels where `(level-5) % 10 == 0`), robotic controls (`(level-8)%10==0`), terraforming (`(level-2)%6==0`),
planetary shield (`(level-12)%10==0`), soil enrichment, atmospheric terraforming triggers the slider auto-adjust dialog (0/25/50/75 %).

---

## 5. Ground-combat tech bonuses ("force")

[1oom `game_ground.c`; confirmed by [SW] text]
```
force = 5*armorTier + 10*suitTier + 10*shieldTier + 5*weaponTier'  (+25 if Bulrathi) (+5 for the defender / planet owner)
weaponTier' = tier if tier <= 2 else tier + 1
each round: side 0 (attacker) and side 1 (defender) each roll 1d100 and add their force;
            if total0 <= total1 the attacker loses one troop, else the defender loses one (a tie costs the attacker); repeat until one side has no troops.
```
| Group | Techs (tier) | Bonus |
|---|---|---|
| Armor (CN) | Duralloy 1, Zortium 2, Andrium 3, Tritanium 4, Adamantium 5, Neutronium 6 | +5 / +10 / +15 / +20 / +25 / +30 |
| Suits (CN) | Battle Suits 1, Armored Exoskeleton 2, Powered Armor 3 | +10 / +20 / +30 |
| Personal shield (FF) | Personal Deflector 1, Absorption 2, Barrier 3 | +10 / +20 / +30 |
| Personal weapons (WE) | Hand Lasers 1, Ion Rifle 2, Fusion Rifle 3, Hand Phasor 4, Plasma Rifle 5 | +5 / +10 / +20 / +25 / +30 |
Only the best tech of each group counts (later ones replace earlier). Maximum tech force = 30+30+30+30 = 120. Invading with enough troops also captures techs (1.10).
Combat Transporters (PR 45) guarantee >= 50 % of troop ships land.

---

## 6. AI research behaviour (classic AI, [1oom `game_ai_classic.c`])

1. **Tree**: random personal tree like the human's (Psilon 75 %, others 50 %). The AI's cost per tech is `20 * L^2 * racemul/100`, difficulty-independent;
   its RP income is boosted by the production multiplier in 1.2.
2. **First projects** (new game): one random tier-1 tech per field (`researchlist[f][0][rnd 0..2]`, re-rolled if the slot is empty); cost set to `L^2 * 50` (bug).
3. **Initial sliders**: count habitable planets (type >= Minimal, the home world included) within distance 30 map units of the home world (n; 30 units is probably 3 pc, unverified).
   If n > 1 ("crowded"): planet sliders ship 10 / def 0 / ind 90 / eco 0 / tech 0 and tech sliders CM 20, CN 20, FF 0, PL 40, PR 20, WE 0;
   else ("isolated"): planet sliders ship 0 / def 0 / ind 60 / eco 10 / tech 40 and tech sliders PR 100, rest 0.
4. **Slider re-roll**: for player index `pi` when `(year % 10) == pi` (so once per 10 years per AI): all six sliders = 5, then one field = 75 (sum 100):
   * if `year < 30` and a coin flip (1/2): **Propulsion 75**;
   * else with a 1-in-4 "focus" roll the race's specialty: Bulrathi/Mrrshan -> Weapons; Darlok -> Computers; Meklar -> Construction or Planetology (50/50);
     Alkari -> Propulsion; Sakkra -> Planetology;
   * else weighted random by objective (trait2) using weights below, `r = rnd_1_n(16)` against cumulative CM, CN, FF, PR, PL; anything above -> Weapons.

   | Objective (trait2 row) | CM | CN | FF | PL | PR | -> WE gets the rest of 16 |
   |---|---|---|---|---|---|---|
   | Diplomat (0) | 2 | 2 | 4 | 2 | 3 | 3 |
   | Militarist (1) | 3 | 1 | 4 | 2 | 1 | 5 |
   | Expansionist (2) | 1 | 1 | 3 | 5 | 2 | 4 |
   | Technologist (3) | 4 | 2 | 3 | 2 | 2 | 3 |
   | Industrialist (4) | 1 | 5 | 4 | 1 | 2 | 3 |
   | Ecologist (5) | 1 | 2 | 4 | 1 | 5 | 3 |
   | War footing (any treaty at war or worse) | 2 | 2 | 4 | 2 | 1 | 5 |

   (Cumulative order is CM, CN, FF, PR, PL. Table column labels follow the 1oom source comment; the Expansionist/Ecologist PL-vs-PR split looks odd but is as coded.)
5. **Which tech in the field**: `if rnd_1_n(6) < difficulty_index (Simple 0 .. Impossible 4): take the last (highest-level) entry of the choice list; else uniform random`.
6. **Trading/spying**: AIs trade techs, steal with spies (Computers TL based), accept tribute techs, and swap with each other (an AI-AI swap happens when the roll `(mood_tech + 80) < value`);
   they hoard "Singular" techs. Their only research advantage is the production multiplier of 1.2 (no research-cost cheat).
7. Objectives per race (default 60 %, alternates 20 % each) [SW "Racial personalities"]: Psilon Technologist; Klackon Industrialist; Human Diplomat;
   Silicoid Expansionist; Meklar Industrialist; Sakkra Expansionist; Alkari Militarist; Darlok Diplomat; Bulrathi Ecologist; Mrrshan Militarist.

---

## 7. Notable combos and synergies

* **Class V Planetary Shield + Scatter Pack V / better missile bases**: planets become near-unassailable in the mid game; pair with Class II-IV deflectors on bases.
  The Bio Toxin Antidote (PL 17) is the answer to the only weapon that bypasses planet shields (Death Spores, later Doom Virus L27 -> Universal Antidote L36).
* **High Energy Focus (PR 34, +3 beam range) + Auto Blaster / Gauss Autocannon / Pulse Phasor**: attack on turn 1-2 of combat; [SW] treats HEF as the start of the endgame.
* **Gauss Autocannon** (WE 32): only weapon with multiple shots that also halves shields; stays useful because many can be mounted.
* **Oracle Interface** (armor-piercing beams) + beams; **Technology Nullifier** vs special-heavy fleets; **Displacement Device** (33 % free misses) with high ECM/shield stacks.
* **Repulsor Beam vs missile/melee**, **Warp Dissipator / Stasis Field / Black Hole Generator / Sub Space Teleporter** are initiative/denial tools.
* **Economy chain**: Improved Robotic Controls (CM 8/18/28/38/48; 2 -> 7 factories per colonist) + Improved Industrial Tech (factory cost 10 -> 2) +
  Terraforming (PL 2 ... 50) + Soil Enrichment (16) / Advanced Soil Enrichment (30) / Atmospheric Terraforming (22) + Cloning (21/42).
  Planetology TL raises worker output directly; the AI uses soil/terraform techs poorly [SW].
* **Pollution chain**: Reduced Industrial Waste (CN 5/15/25/35) and Industrial Waste Elimination (45), or Ecological Restoration (PL 1/5/13/24/34 = 2/3/5/10/20 waste per BC).
* **Colonisation chain**: fuel cells (PR 3/5/9/14/19/23/29/41 -> range 4..unlimited) + Controlled Environments (PL 3..18) + colony bases; Reserve Fuel Tanks for +3.
* **Meklar**: +2 factories per colonist and no factory upgrade cost; **Sakkra**: cloning cost x2/3; **Silicoid**: no waste, never offered the waste, soil, atmospheric, environment and most eco-restoration techs; **Psilon**: x1.5 RP and a bigger tree.
* Trade priorities for humans [SW]: Robotic Controls, Terraforming, waste techs, eco restoration, soil/atmospheric techs; trade ship techs for economy techs; never give Class V Planetary Shield / HEF.
* **Invading rich worlds** (hundreds of factories) steals up to 6 techs (~100 years of research [SW]); spy theft level cap = (random d100 %) of the victim's top TL.
* **Orion**: Death Ray + 3 random techs (levels 20-50) for the Guardian killer; Guardian stats scale with difficulty (SW: HP 2000/4000/6000/8000/10000, shield 5-9, beam defense 1-9, BC Mark 10).

---

## 8. Implementation notes (suggested data model)

```
Empire.tech = { completed[6]: sorted list<int>, project[6]: int, investment[6]: int, cost[6]: int,
                slider[6]: int (sum 100), TL[6]: int (1..99), researchlist[6][10][3]: int, loot_flags... }
cost(L, race, field, difficulty, isAI):  see 1.5
advance_year(): see 1.4;  after any tech gained -> recompute derived stats (section 4) and TL (1.6)
```
Pitfalls: (a) TL is not the level of the best tech; (b) overshoot RP are lost on completion; (c) human and AI cost formulas differ; (d) the first-tech window
is tier 1 only; (e) the list is truncated at 12 and built low tier first; (f) techs from loot/spy may lie outside the empire's own tree; (g) Death Ray is never in any tree;
(h) Silicoid and Psilon special cases; (i) show the true discovery chance, not half.

---

## 9. Conflicts, unverified items and gaps

Conflicts between sources (decision in bold):
1. Hydrogen Fuel Cells level: SW Propulsion page "Level 2" vs 1oom enum + SW Comparative tree "Level 3" -> **3**.
2. Death Spores level: SW Key techs says 11; SW Planetology + 1oom say 10 -> **10**. Terraforming +20: SW Tech-trading text says level 9; Comparative tree + 1oom say 8 -> **8**.
3. Terraforming cost per population: SW/in-game text flat 5 BC per point (+120 = 600 BC); 1oom code uses 5,5,4,4,3,3,2,2,2 -> **code**.
4. Atmospheric Terraforming project cost: SW text 150 BC; 1oom constant 200 -> **200** (soil 150 and advanced soil 300 agree).
5. Orion loot: SW "5 random techs ... up to 10 levels above your level"; 1oom 3 random techs + Death Ray, cap TL+25 -> **1oom**.
6. Research interest: [LP] "lower of this year's investment or 15 % of total"; 1oom "min(15 % of total, 2 x this year's input)" -> **1oom**.
7. Psilon research: SW/LP "+75 %"; code x1.5 RP and cost x0.8 (x1.875 net) -> **code**.
8. Cost rounding: [LG] unrounded L^2 x diffmul; code multiples of 10 -> **code**.
9. Tree-generation probability: SW shuffle+coin-flip (37.5 % missing for 2-tech tier); 1oom loop (33.3 %) -> **1oom**.
10. Gatling Laser: SW "space of 3 lasers"; 1oom space 20 (= 2 lasers; the 3x figure matches its cost) -> **1oom**.
11. Nuclear/Hyper-V missiles: SW "+1 attack rating"; in-game text / 1oom "+1 speed", to-hit bonus 0 (Hyper-X +1 ... Zeon +6) -> **1oom**.
12. Death Ray damage: table 200-1000; SW Guardian page "up to 500" -> **table**.
13. Displayed discovery chance in the original game was half the true chance (bug) -> show the true value.
14. Missile base hit points: SW (Construction page) "15 HP" with Titanium vs 1oom `game_num_base_hp` 50..200 by armor tier -> **unresolved**; defer to the planetary-defence/combat file.
Unverified / not captured:
* Exact English in-game description strings for each tech (only paraphrases from SW; the LBX text is not reproduced).
* The aux research table bytes (per-tech group id, tier-in-group, icon) are not in the 1oom C source; group membership above is inferred from tech names and enum names
  (`TECH_GROUP_*`), and ground-combat tiers (armor 1-6, suits 1-3, shields 1-3, weapons 1-5) are inferred from the wiki bonuses (+5 steps etc.) and code arithmetic.
* `game_num_stargate_maint = 100` unit, `game_num_adv_scan_range = 110` meaning, missile-base cost units.
* The names of advanced techs (levels 55-100) in English.
* Whether 1oom's "all Advanced Technology are available" differs in some way from v1.3's offering rules (the fallback shown in 1.8 is 1oom's).
* Starting-tech differences per race: none exist in 1oom except the Silicoid NEVER flags (no "advanced start" option found).
* Spy and diplomacy mechanics are summarised only where they move techs; see the spy/diplomacy file for the full rules.

---

## Appendix A - machine-readable tech list (field,level,tier,name,type)

Field codes CM/CN/FF/PL/PR/WE; type codes as in section 2. "free" = level-1 start bundle. Level 36 WE (Death Ray) omitted.

```
CM,1,1,Battle Computer Mark I,computer
CM,1,1,Robotic Controls II,industry
CM,1,1,Battle Scanner,special
CM,2,1,ECM Jammer Mark I,ecm
CM,4,1,Deep Space Scanner,scanner
CM,5,1,Battle Computer Mark II,computer
CM,7,2,ECM Jammer Mark II,ecm
CM,8,2,Improved Robotic Controls III,industry
CM,10,2,Battle Computer Mark III,computer
CM,12,3,ECM Jammer Mark III,ecm
CM,13,3,Improved Space Scanner,scanner
CM,15,3,Battle Computer Mark IV,computer
CM,17,4,ECM Jammer Mark IV,ecm
CM,18,4,Improved Robotic Controls IV,industry
CM,20,4,Battle Computer Mark V,computer
CM,22,5,ECM Jammer Mark V,ecm
CM,23,5,Advanced Space Scanner,scanner
CM,25,5,Battle Computer Mark VI,computer
CM,27,6,ECM Jammer Mark VI,ecm
CM,28,6,Improved Robotic Controls V,industry
CM,30,6,Battle Computer Mark VII,computer
CM,32,7,ECM Jammer Mark VII,ecm
CM,34,7,Hyperspace Communications,special
CM,35,7,Battle Computer Mark VIII,computer
CM,37,8,ECM Jammer Mark VIII,ecm
CM,38,8,Improved Robotic Controls VI,industry
CM,40,8,Battle Computer Mark IX,computer
CM,42,9,ECM Jammer Mark IX,ecm
CM,45,9,Battle Computer Mark X,computer
CM,46,10,Oracle Interface,special
CM,47,10,ECM Jammer Mark X,ecm
CM,48,10,Improved Robotic Controls VII,industry
CM,49,10,Technology Nullifier,special
CM,50,10,Battle Computer Mark XI,computer
CN,1,1,Titanium Armor,armor
CN,1,1,Reserve Fuel Tanks,special
CN,3,1,Improved Industrial Tech 9,industry
CN,5,1,Reduced Industrial Waste 80%,waste
CN,8,2,Improved Industrial Tech 8,industry
CN,10,2,Duralloy Armor,armor
CN,11,3,Battle Suits,ground
CN,13,3,Improved Industrial Tech 7,industry
CN,14,3,Automated Repair System,special
CN,15,3,Reduced Industrial Waste 60%,waste
CN,17,4,Zortium Armor,armor
CN,18,4,Improved Industrial Tech 6,industry
CN,23,5,Improved Industrial Tech 5,industry
CN,24,5,Armored Exoskeleton,ground
CN,25,5,Reduced Industrial Waste 40%,waste
CN,26,6,Andrium Armor,armor
CN,28,6,Improved Industrial Tech 4,industry
CN,33,7,Improved Industrial Tech 3,industry
CN,34,7,Tritanium Armor,armor
CN,35,7,Reduced Industrial Waste 20%,waste
CN,36,8,Advanced Damage Control,special
CN,38,8,Improved Industrial Tech 2,industry
CN,40,8,Powered Armor,ground
CN,42,9,Adamantium Armor,armor
CN,45,9,Industrial Waste Elimination,waste
CN,50,10,Neutronium Armor,armor
FF,1,1,Class I Deflector Shield,shield
FF,4,1,Class II Deflector Shield,shield
FF,8,2,Personal Deflector Shield,ground
FF,10,2,Class III Deflector Shield,shield
FF,12,3,Class V Planetary Shield,planetary
FF,14,3,Class IV Deflector Shield,shield
FF,16,4,Repulsor Beam,special
FF,20,4,Class V Deflector Shield,shield
FF,21,5,Personal Absorption Shield,ground
FF,22,5,Class X Planetary Shield,planetary
FF,24,5,Class VI Deflector Shield,shield
FF,27,6,Cloaking Device,special
FF,30,6,Class VII Deflector Shield,shield
FF,31,7,Zyro Shield,special
FF,32,7,Class XV Planetary Shield,planetary
FF,34,7,Class IX Deflector Shield,shield
FF,37,8,Stasis Field,special
FF,38,8,Personal Barrier Shield,ground
FF,40,8,Class XI Deflector Shield,shield
FF,42,9,Class XX Planetary Shield,planetary
FF,43,9,Black Hole Generator,special
FF,44,9,Class XIII Deflector Shield,shield
FF,46,10,Lightning Shield,special
FF,50,10,Class XV Deflector Shield,shield
PL,1,1,Ecological Restoration,eco
PL,2,1,Terraforming +10,terraform
PL,3,1,Controlled Barren Environment,environment
PL,5,1,Improved Ecological Restoration,eco
PL,6,2,Controlled Tundra Environment,environment
PL,8,2,Terraforming +20,terraform
PL,9,2,Controlled Dead Environment,environment
PL,10,2,Death Spores,bio
PL,12,3,Controlled Inferno Environment,environment
PL,13,3,Enhanced Ecological Restoration,eco
PL,14,3,Terraforming +30,terraform
PL,15,3,Controlled Toxic Environment,environment
PL,16,4,Soil Enrichment,growth
PL,17,4,Bio Toxin Antidote,defense
PL,18,4,Controlled Radiated Environment,environment
PL,20,4,Terraforming +40,terraform
PL,21,5,Cloning,growth
PL,22,5,Atmospheric Terraforming,growth
PL,24,5,Advanced Ecological Restoration,eco
PL,26,6,Terraforming +50,terraform
PL,27,6,Doom Virus,bio
PL,30,6,Advanced Soil Enrichment,growth
PL,32,7,Terraforming +60,terraform
PL,34,7,Complete Ecological Restoration,eco
PL,36,8,Universal Antidote,defense
PL,38,8,Terraforming +80,terraform
PL,40,8,Bio Terminator,bio
PL,42,9,Advanced Cloning,growth
PL,44,9,Terraforming +100,terraform
PL,50,10,Complete Terraforming,terraform
PR,1,1,Retro Engines,engine
PR,3,1,Hydrogen Fuel Cells,fuel
PR,5,1,Deuterium Fuel Cells,fuel
PR,6,2,Nuclear Engines,engine
PR,9,2,Irridium Fuel Cells,fuel
PR,10,2,Inertial Stabilizer,special
PR,12,3,Sub-Light Drives,engine
PR,14,3,Dotomite Crystals,fuel
PR,16,4,Energy Pulsar,special
PR,18,4,Fusion Drives,engine
PR,19,4,Uridium Fuel Cells,fuel
PR,20,4,Warp Dissipator,special
PR,23,5,Reajax II Fuel Cells,fuel
PR,24,5,Impulse Drives,engine
PR,27,6,Intergalactic Star Gates,planetary
PR,29,6,Trilithium Crystals,fuel
PR,30,6,Ion Drives,engine
PR,34,7,High Energy Focus,special
PR,36,8,Anti-Matter Drives,engine
PR,38,8,Sub Space Teleporter,special
PR,40,8,Ionic Pulsar,special
PR,41,9,Thorium Cells,fuel
PR,42,9,Inter-Phased Drives,engine
PR,43,9,Sub Space Interdictor,planetary
PR,45,9,Combat Transporters,invasion
PR,46,10,Inertial Nullifier,special
PR,48,10,Hyper Drives,engine
PR,50,10,Displacement Device,special
WE,1,1,Laser / Heavy Laser,beam
WE,1,1,Nuclear Missile,missile
WE,1,1,Nuclear Bomb,bomb
WE,2,1,Hand Lasers,ground
WE,4,1,Hyper-V Rockets,missile
WE,5,1,Gatling Laser,beam
WE,6,2,Anti-Missile Rockets,special
WE,7,2,Neutron Pellet Gun,beam
WE,8,2,Hyper-X Rockets,missile
WE,9,2,Fusion Bomb,bomb
WE,10,2,Ion Cannon / Heavy Ion Cannon,beam
WE,11,3,Scatter Pack V Missiles,missile
WE,12,3,Ion Rifle,ground
WE,13,3,Mass Driver,beam
WE,14,3,Merculite Missiles,missile
WE,15,3,Neutron Blaster / Heavy Blast Cannon,beam
WE,16,4,Anti-Matter Bomb,bomb
WE,17,4,Graviton Beam,beam
WE,18,4,Stinger Missiles,missile
WE,19,4,Hard Beam,beam
WE,20,4,Fusion Beam / Heavy Fusion Beam,beam
WE,21,5,Ion Stream Projector,special
WE,22,5,Omega-V Bomb,bomb
WE,23,5,Anti-Matter Torpedoes,torpedo
WE,24,5,Fusion Rifle,ground
WE,25,5,Megabolt Cannon,beam
WE,26,6,Phasor / Heavy Phasor,beam
WE,27,6,Scatter Pack VII Missiles,missile
WE,28,6,Auto Blaster,beam
WE,29,6,Pulson Missiles,missile
WE,30,6,Tachyon Beam,beam
WE,31,7,Hand Phasor,ground
WE,32,7,Gauss Autocannon,beam
WE,33,7,Particle Beam,beam
WE,34,7,Hercular Missiles,missile
WE,35,7,Plasma Cannon,beam
WE,37,8,Disruptor,beam
WE,38,8,Pulse Phasor,beam
WE,39,8,Neutronium Bomb,bomb
WE,40,8,Hellfire Torpedoes,torpedo
WE,41,9,Zeon Missiles,missile
WE,42,9,Plasma Rifle,ground
WE,43,9,Proton Torpedoes,torpedo
WE,44,9,Scatter Pack X Missiles,missile
WE,45,9,Tri-Focus Plasma Cannon,beam
WE,46,10,Stellar Converter,beam
WE,47,10,Neutron Stream Projector,special
WE,48,10,Mauler Device,beam
WE,50,10,Plasma Torpedoes,torpedo
```

---

## Appendix B - RP cost by level and difficulty (human, 100 % race; exact integer formula)

`cost = floor(L^2 * 100 * diffmul / 1000) * 10`. For a race factor r (60/80/100/125): `cost = floor(L^2 * r * diffmul / 1000) * 10`.
AI column = `L^2 * 20` (neutral race, any difficulty).

| Level | Simple | Easy | Average | Hard | Impossible | AI |
|---|---|---|---|---|---|---|
| 1 | 20 | 20 | 30 | 30 | 40 | 20 |
| 2 | 80 | 100 | 120 | 140 | 160 | 80 |
| 3 | 180 | 220 | 270 | 310 | 360 | 180 |
| 4 | 320 | 400 | 480 | 560 | 640 | 320 |
| 5 | 500 | 620 | 750 | 870 | 1,000 | 500 |
| 6 | 720 | 900 | 1,080 | 1,260 | 1,440 | 720 |
| 7 | 980 | 1,220 | 1,470 | 1,710 | 1,960 | 980 |
| 8 | 1,280 | 1,600 | 1,920 | 2,240 | 2,560 | 1,280 |
| 9 | 1,620 | 2,020 | 2,430 | 2,830 | 3,240 | 1,620 |
| 10 | 2,000 | 2,500 | 3,000 | 3,500 | 4,000 | 2,000 |
| 11 | 2,420 | 3,020 | 3,630 | 4,230 | 4,840 | 2,420 |
| 12 | 2,880 | 3,600 | 4,320 | 5,040 | 5,760 | 2,880 |
| 13 | 3,380 | 4,220 | 5,070 | 5,910 | 6,760 | 3,380 |
| 14 | 3,920 | 4,900 | 5,880 | 6,860 | 7,840 | 3,920 |
| 15 | 4,500 | 5,620 | 6,750 | 7,870 | 9,000 | 4,500 |
| 16 | 5,120 | 6,400 | 7,680 | 8,960 | 10,240 | 5,120 |
| 17 | 5,780 | 7,220 | 8,670 | 10,110 | 11,560 | 5,780 |
| 18 | 6,480 | 8,100 | 9,720 | 11,340 | 12,960 | 6,480 |
| 19 | 7,220 | 9,020 | 10,830 | 12,630 | 14,440 | 7,220 |
| 20 | 8,000 | 10,000 | 12,000 | 14,000 | 16,000 | 8,000 |
| 21 | 8,820 | 11,020 | 13,230 | 15,430 | 17,640 | 8,820 |
| 22 | 9,680 | 12,100 | 14,520 | 16,940 | 19,360 | 9,680 |
| 23 | 10,580 | 13,220 | 15,870 | 18,510 | 21,160 | 10,580 |
| 24 | 11,520 | 14,400 | 17,280 | 20,160 | 23,040 | 11,520 |
| 25 | 12,500 | 15,620 | 18,750 | 21,870 | 25,000 | 12,500 |
| 26 | 13,520 | 16,900 | 20,280 | 23,660 | 27,040 | 13,520 |
| 27 | 14,580 | 18,220 | 21,870 | 25,510 | 29,160 | 14,580 |
| 28 | 15,680 | 19,600 | 23,520 | 27,440 | 31,360 | 15,680 |
| 29 | 16,820 | 21,020 | 25,230 | 29,430 | 33,640 | 16,820 |
| 30 | 18,000 | 22,500 | 27,000 | 31,500 | 36,000 | 18,000 |
| 31 | 19,220 | 24,020 | 28,830 | 33,630 | 38,440 | 19,220 |
| 32 | 20,480 | 25,600 | 30,720 | 35,840 | 40,960 | 20,480 |
| 33 | 21,780 | 27,220 | 32,670 | 38,110 | 43,560 | 21,780 |
| 34 | 23,120 | 28,900 | 34,680 | 40,460 | 46,240 | 23,120 |
| 35 | 24,500 | 30,620 | 36,750 | 42,870 | 49,000 | 24,500 |
| 36 | 25,920 | 32,400 | 38,880 | 45,360 | 51,840 | 25,920 |
| 37 | 27,380 | 34,220 | 41,070 | 47,910 | 54,760 | 27,380 |
| 38 | 28,880 | 36,100 | 43,320 | 50,540 | 57,760 | 28,880 |
| 39 | 30,420 | 38,020 | 45,630 | 53,230 | 60,840 | 30,420 |
| 40 | 32,000 | 40,000 | 48,000 | 56,000 | 64,000 | 32,000 |
| 41 | 33,620 | 42,020 | 50,430 | 58,830 | 67,240 | 33,620 |
| 42 | 35,280 | 44,100 | 52,920 | 61,740 | 70,560 | 35,280 |
| 43 | 36,980 | 46,220 | 55,470 | 64,710 | 73,960 | 36,980 |
| 44 | 38,720 | 48,400 | 58,080 | 67,760 | 77,440 | 38,720 |
| 45 | 40,500 | 50,620 | 60,750 | 70,870 | 81,000 | 40,500 |
| 46 | 42,320 | 52,900 | 63,480 | 74,060 | 84,640 | 42,320 |
| 47 | 44,180 | 55,220 | 66,270 | 77,310 | 88,360 | 44,180 |
| 48 | 46,080 | 57,600 | 69,120 | 80,640 | 92,160 | 46,080 |
| 49 | 48,020 | 60,020 | 72,030 | 84,030 | 96,040 | 48,020 |
| 50 | 50,000 | 62,500 | 75,000 | 87,500 | 100,000 | 50,000 |
| 55 | 60,500 | 75,620 | 90,750 | 105,870 | 121,000 | 60,500 |
| 60 | 72,000 | 90,000 | 108,000 | 126,000 | 144,000 | 72,000 |
| 65 | 84,500 | 105,620 | 126,750 | 147,870 | 169,000 | 84,500 |
| 70 | 98,000 | 122,500 | 147,000 | 171,500 | 196,000 | 98,000 |
| 75 | 112,500 | 140,620 | 168,750 | 196,870 | 225,000 | 112,500 |
| 80 | 128,000 | 160,000 | 192,000 | 224,000 | 256,000 | 128,000 |
| 85 | 144,500 | 180,620 | 216,750 | 252,870 | 289,000 | 144,500 |
| 90 | 162,000 | 202,500 | 243,000 | 283,500 | 324,000 | 162,000 |
| 95 | 180,500 | 225,620 | 270,750 | 315,870 | 361,000 | 180,500 |
| 100 | 200,000 | 250,000 | 300,000 | 350,000 | 400,000 | 200,000 |

---

## Appendix C - miniaturisation tables (1oom, 51 entries, index tm = clamp(TL - component tech level, 0, 50))

`T50` (cost multiplier %, "-50 % per 10 TL points"):
```
tm  0-10 : 100 93 87 81 76 71 66 62 58 54 50
tm 11-20 :  47 44 41 38 35 33 31 29 27 25
tm 21-30 :  23 22 20 19 18 16 15 14 13 13
tm 31-40 :  12 11 10  9  9  8  8  7  7  6
tm 41-50 :   6  5  5  5  4  4  4  4  3  3
```
`T25` (space multiplier %, "-25 % per 10 TL points"):
```
tm  0-10 : 100 97 94 92 89 87 84 82 79 77 75
tm 11-20 :  73 71 69 67 65 63 61 60 58 56
tm 21-30 :  55 53 52 50 49 47 46 45 43 42
tm 31-40 :  41 40 39 38 37 36 35 34 33 32
tm 41-50 :  31 30 29 28 27 27 26 25 24 24
```
(The code stores 51 values per table; the list above is 0..50 with one value for each index: T50[0]=100 ... T50[50]=3, T25[0]=100 ... T25[50]=24.)

---

## Appendix D - obsolescence / valuation groups (inferred from 1oom `TECH_GROUP_*` and tech names)

1oom keeps a group id and an in-group tier for every tech (from the original research table, not in the C source). They drive: the "same group, equal/higher tier = already owned" test for spy/trade
candidates (12 groups), the AI trade value multipliers (Singular x10, Robotic Controls x6, Waste x3, Eco Restoration x3), and ground-combat tiers. Membership below is inferred from names (unverified).

| Group (1oom id) | Members |
|---|---|
| SINGULAR (0) | all techs not in a group below (e.g. Hyperspace Comm., Repulsor, Cloaking, Stasis, Black Hole, Teleporter, Warp Dissipator, Stargates, ...) |
| ECM_JAMMER (1) | CM 2, 7, 12, 17, 22, 27, 32, 37, 42, 47 |
| BATTLE_COMPUTER (2) | CM 1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50 |
| IMPROVED_ROBOTIC_CONTROLS (3) | CM 8, 18, 28, 38, 48 |
| SPACE_SCANNER (4) | CM 4, 13, 23 |
| REDUCED_INDUSTRIAL_WASTE (5) | CN 5, 15, 25, 35, 45 |
| IMPROVED_INDUSTRIAL_TECH (6) | CN 3, 8, 13, 18, 23, 28, 33, 38 |
| ARMOR (7) | CN 1 (Titanium), 10, 17, 26, 34, 42, 50 |
| AUTOMATED_REPAIR_SYSTEM (8) | CN 14, 36 |
| DEFLECTOR_SHIELDS (9) | FF 1, 4, 10, 14, 20, 24, 30, 34, 40, 44, 50 |
| PLANETARY_SHIELD (10) | FF 12, 22, 32, 42 |
| ANTI_MISSILE_SHIELD (11) | WE 6; FF 31, 46 |
| IMPROVED_TERRAFORMING (12) | PL 2, 8, 14, 20, 26, 32, 38, 44, 50 |
| CONTROLLED_ENVIRONMENT (13) | PL 3, 6, 9, 12, 15, 18 |
| ECO_RESTORATION (14) | PL 1, 5, 13, 24, 34 |
| PERSONAL_ARMOR (15) | CN 11, 24, 40 |
| PERSONAL_SHIELD (16) | FF 8, 21, 38 |
| ENGINES (17) | PR 1, 6, 12, 18, 24, 30, 36, 42, 48 |
| FUEL_CELLS (18) | PR 3, 5, 9, 14, 19, 23, 29, 41 |
| BEAMS (19) | WE beam weapons (Laser ... Mauler, incl. heavy mounts) |
| ROCKETS (20) | WE missiles and torpedoes (Nuclear Missile ... Plasma Torpedo) |
| PERSONAL_WEAPONS (21) | WE 2, 12, 24, 31, 42 |
| BOMBS (22) | WE 1 (Nuclear Bomb), 9, 16, 22, 39 |
| BIO_WEAPONS (23) | PL 10, 27, 40 |
| PULSAR (24) | PR 16, 40 |
| STREAM_PROJECTOR (25) | WE 21, 47 |
| PENETRATING_BEAMS (30) | probably the "streaming" beams (Graviton Beam 17, Tachyon Beam 30) |

---

## Appendix E - research-related constants (1oom `game_num.c` / `game_types.h`)

| Constant | Value |
|---|---|
| `TECH_NEXT_MAX` (options in a choice list) | 12 |
| `TECH_SPY_MAX` (techs a spy/invasion can steal at once) | 6 |
| Tiers per field | 10 (5 levels each); researchlist slots per tier 3 |
| Discovery roll | `rnd_1_n(500) <= (inv-cost)*250/cost` |
| Interest | `inv*3/20`, capped at 2 x this year's RP; unfunded decay `inv*9/10` |
| Cost multipliers | human `{20,25,30,35,40}`/1000*10 by difficulty; AI `20`/100; race `{60,80,100,125}` |
| AI first-project cost bug | `level^2 * 50` |
| Soil / Advanced soil / Atmospheric project cost (BC) | 150 / 300 / 200 |
| Planetary shield cost by level 0..20 | 0 / 500 / 1000 / 1500 / 2000 |
| Stargate cost / maintenance constant | 3000 BC / 100 (unit unverified) |
| Max population per planet / max factories | 300 / 2500 (2700 in 1oom v1.3a patch) |
| Missile-base HP by armor tier 0..6 | 50, 75, 100, 125, 150, 175, 200 |
| Tech auto-adjust steps after key techs | 0 / 25 / 50 / 75 % |
| Orion loot caps / tries | cap `min(TL+25,50)`, 3 rounds x 200 tries, levels 20..50 + Death Ray |
| Artifact loot caps / tries | cap `min(TL+10,50)`, 1 round x 200 tries, levels 1..30 (human only) |
| Spy success threshold | `1d100 + max(0, spyCompTL - targetCompTL) > 84`; frame if > 100 |
| Invasion tech chance | 1/50 per factory, capped by 6 candidates |
| Human default tech sliders | CM 20, CN 10, FF 15, PL 15, PR 20, WE 20 |
| AI tech slider pattern | 5/5/5/5/5/5 with one field at 75 (re-rolled when year % 10 == player index) |
