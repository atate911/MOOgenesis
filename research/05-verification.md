# 05 verification — independent re-derivation of research/05 (+08, 01 §5) from the 1oom v1.3 "Classic" source

Verifier notes. Primary source: github.com/1oom-fork/1oom `src/game/*.c` (read through a summarising fetcher, one function at a time, statement-by-statement outlines;
the fetcher refuses verbatim code, so everything below is plain-text formulae). Legend: **V** = verified, **W** = WRONG (correct value given), **N** = nuance / omission (research is right but incomplete),
**U** = unverifiable here. "2 reads" = the function was outlined twice independently. Macro reminder: `SETMIN(x,v)` = cap x at v, `SETMAX(x,v)` = floor x at v. All `/` are C truncating divisions.

Status of this file: A1 (diplomacy §2–§4, §3), A3 (council §6), A4 (end states §8.1) written first; A2 (espionage §5), A5 (events §7), A6 (difficulty §9), code audits follow (appended below as they are finished).

---------------------------------------------------------------------------------------------------

## A1. Diplomacy — §2 state variables, §3 personalities, §4 the DP engine

### A1.1 §2 state variables and initial values

| Item | Verdict | Detail |
|---|---|---|
| `relation1`/`relation2` init `= tbl_orion_race_relation[raceI][raceJ] * 12` (row = holder, not transposed), 10x10 matrix | **V** | Matrix in 05 §3.3 / 08 §7.1 matches the source cell for cell (row Darlok `1,-1x8,1`; diagonal 0 except Darlok 1; self-relation forced to 0 by the mirror loop). |
| All other pair fields (trust, the four moods, hatred, blunder, broken_treaty, treaty, trade_*, have_met, contact, ceasefire, spy*) | **V** | Start at **0** (struct memset) — the "initial moods = 0" assumption in 08 §18 is confirmed, not just presumed. `attack_bounty`/`bounty_collect` = PLAYER_NONE, `evn.voted[]` = PLAYER_NONE, `spyreportfield` = 1, `year = 1`, `evn.year = 40`. |
| `relation1` symmetric | **N** | Kept symmetric by `diplo_act` mirroring AND by the final mirror loop of `diplo_adjust` (lower-index row overwrites higher-index row) — see A1.4 (drift). |
| mood clamp rules | **N** | `mood_treaty` clamped to [-200,120] by `limit_mood_treaty`, called at the START of `turn_diplo_p2` and at the start of every audience (NOT at turn start). `mood_peace` clamped [-200,200] inside `update_mood_blunder` (turn start). trade/tech moods are never clamped (only the `+10` relax caps growth at <100 → 100..109). |
| moods regen: start of turn `if v<0: v+=rnd(5)`; `if v<50: v+=rnd(5)`; end of turn `+10 if <100` | **V** | Draw order per ordered pair i→j (j starts at PLAYER_1, so no empire's mood toward player 0 is regenerated at turn start — irrelevant for the human's own record): treaty, trade, tech, peace. Skipped when `treaty[j]==FINAL_WAR`. `mood_relax` is called once, just before `year++`, and is not skipped in final war. |
| `blunder` capture: type 4..11 → type; 42..49 → type-30; 50..57 → type-46 | **V** | Captured from LAST turn's `diplo_type` before the per-turn reset. |
| per-turn reset of `diplo_val/diplo_type`, `au_tech_trade_num/offer_tech/au_want_tech/offer_bc`, bounty clear if collected | **V** | |
| `contact` = min `star_dist` between any owned star of X and any of Y `<= max(fuel_range X, fuel_range Y)` (inclusive); symmetric | **V** | Any owned star counts (no pop filter). |
| first contact: human `have_met 0→1`, treaty := None (both) | **V** | `update_have_met` runs after events, before AI-AI diplomacy; greeting type `14+AI.trait1` queued in `turn_diplo_p2` then `have_met=2`. `start_war` also marks `have_met 1` for humans. |
| contact lost: `mood_trade`, `trade_bc`, `trade_percent` := 0 and `spymode := Hide` on BOTH records; **treaties are NOT cancelled**; `trade_established_bc` NOT zeroed | **V** | Only for pairs that had contact at turn start. |
| `ceasefire` from `stop_war` = `rnd0(6)+8` (8..13) per human side; threaten success `rnd(15)+5` (6..20) | **V** | `countdown_ceasefire` decrements every `[j][i]>0` once per turn (turn start). |

### A1.2 §3 personality / objective

| Item | Verdict | Detail |
|---|---|---|
| `reldiff = {Xen -50, Ruth -30, Aggr -20, Erratic 0, Hon +10, Pac +20}` | **V** | |
| act scaling: Honorable target `dv<0 → ×2`; Xenophobic `dv<0 → dv*3/2`, `dv>0 → dv*3/4`; snapshot `v1=dv` taken AFTER this and BEFORE Human doubling | **V** | Human-race ACTOR doubles `dv>0` (after the snapshot). |
| Honorable doubles `w` when it BREAKS a treaty | **V** | `w *= 2` before `trust -= w`. |
| Erratic: `rnd(300) <= difficulty` per (target, aggressor=Erratic) evaluation, war via message 61 / `diplo_val 2000`, needs `AI(target) or ceasefire<1` | **V** | Fired for any contacted pair, allies included (treaty<WAR). No per-turn re-roll of reldiff. |
| trait1 tables `[10][10]`, trait2 tables `[10][12]` (race order Human,Mrrshan,Silicoid,Sakkra,Psilon,Alkari,Klackon,Bulrathi,Meklar,Darlok) and the 05 §3.2 counts | **V** | Exact rows match `game_num.c`. trait2 rolled first (AI only), then trait1 (all, incl. human). |
| Coup (01 §5.12): trigger `rebelPlanets >= (planets+1)/2` and alive; `trait2=rnd0(6)` THEN `trait1=rnd0(6)`; `relation1:=relation2` for all j (both directions); `break_treaty(i,j)`+`break_trade(i,j)` only toward HUMAN j≠i; unrest/rebels cleared on all its planets | **V** | `game_turn_coup` has no human-funeral logic (that lives in `game_event_run`; see A5). |
| 01 §5.3(c)/§5.7(b): "NAP: relation1 above 30 reset to 20" in `wage_war_do` | **W** | `wage_war_do` caps `relation1` to **30 for both** NAP and alliance (the 20 belongs to `send_attack`, planner-side). |
| [Guide] AI objective effects on diplomacy | **V** | None in code (only Expansionist treaty-break odds; Militarist/Expansionist fleet-envy path; Expansionist colony-ship brake exemption). |

### A1.3 §3.4 / §4.1 ladder and contact text

| Item | Verdict | Detail |
|---|---|---|
| label index = `clamp(relation1/12 + 8, 0, 16)` (trunc), pointer = `clamp(relation1/2,-50,50)` px | **V** | 17 labels FEUD…HARMONY in order. |
| "gone": `trust + min(moods) + reldiff[AI] <= -100` or `min(moods) <= -100`; greeting `v=trust+min(moods)+reldiff`: `<-100` → type 20 if treaty>=WAR else 21; else `v+=rel1`: `>-50` → 22 else 23; main menu: `min(moods) < -100` → type 74 | **V** | |
| spy sliders: spying 0..100 step 4 (alt → 0/100), security 0..200 step 10, shown bonus `security/5` (+20 Darlok) | **V** | |

### A1.4 §4.2 the DP engine

| Item | Verdict | Detail |
|---|---|---|
| `diplo_act` full pseudo-code (final-war branch, early outs incl. target-human, -10000 notice, relation attenuation, trait scaling, v1 snapshot, Human ×2, at-war types 4..12 → `mood_peace ± dv/4` and `dv:=0`, AI-AI year>100, application, floors/caps) | **V** (2 reads) | Exactly as 05 §4.2.1. Detail: the at-war test is `treaty == WAR` (not >=) and `4<=dtype<=12`; floor `-25` if `treaty>=WAR`, cap `65` unless Alliance (applied even when `dv==0`); `diplo_val/type` recorded only if actor is human, `dtype!=0` and `|dv|>|old|`. |
| `break_treaty`, `start_war`, `break_trade`, `stop_war`, `annoy`, `set_trade`, `esp_frame` | **V** (2 reads) | `start_war` first marks `have_met`, then returns if already `>=WAR`; draws `rnd(25)` once (`-75-r` both sides). `break_treaty` draws `rnd(20)` only when `w!=0`; Classic keeps `w<0` so **trust and relation2 RISE** by 10/20 (×2 Honorable). `break_trade` has no DP effect. `set_trade` percent formula uses the record of the first argument and mirrors; early return when `bc==0`. `esp_frame`: `-(rnd(12)+rnd(12))`, dtype 5, framed→victim. |
| `start_war` call-site convention (08 §7.3) | **V** | `wage_war_do`, `sub3`, ally cascade, "ask AI to declare war": aggressor first. Human threat / "join war": human first. Human captures/depopulates a planet: `start_war_swap(def, att)` = victim first (Classic never swaps) → the AI victim is the charged "breaker". |
| battle fallout `battle_finish` | **V / N** | Injured/offender selection and `offense = max(5*popdiff, min(app,50), 10*bio)` correct. **Order**: (1) if bio≠0: `act(-10, offender→i, 11)` for EVERY AI i≠offender (including the injured AI) FIRST, (2) then `act(-offense, offender→injured, 11/10/9)`, (3) then the `offense>=30 && human offender` block (bounty/third-party). The third-party block loops i≠offender,≠injured, AI, `(injured.treaty[i]>=WAR or offender.bounty_collect[i]==injured)` [source FIXME]: `if offender.attack_bounty[i]==injured → bounty_collect[i]=i; else if injured owns NO planet → act(+offense, offender→i, 3)`. |
| NEW (omission in 05 §4.2.3): **bombing that takes a planet to 0 pop by a human** | **N** | Any treaty<WAR → `start_war_swap(owner, human)` and `act(-(50+rnd50), human→owner, dtype 13)`; at war → same dv, dtype 10. This path does NOT call `battle_finish`. Otherwise (pop left) `battle_finish(def=owner, att=bomber, popdiff=popdmg, 0, bio, 0)`. Bombing is skipped only for allied planets (and NAP partners when the bomber is an AI) — a human may bomb a NAP partner. |
| ground fallout rows of 05 §4.2.3 | **V** | Human captures (owner_changed): `act(-50-rnd50, att→def, 13)`+`start_war_swap(def,att)` if treaty<WAR, else same dv type 10. AI attacker vs AI defender: `-(rnd(4)+4)` ×1 (pop forced to 1). Otherwise `-(rnd(5)+5)*pop_killed`, type 10. Nothing if the defender is human. |
| treaty-upkeep goodwill (`diplo_adjust` block 1) | **V** | ONE 50% roll per unordered pair (i<j, actor = lower index i), then up to three independent `act`s: NAP `+rnd3`, Alliance `+rnd6` (dtype 0), trade `+rnd3` (dtype 2). With the human as player 0 and Human race the gains are doubled. |
| fleet complaint (block 2) | **V** | `s_ai<s_h`, `s_ai>0`, `rnd(100) >= s_h*50/s_ai`, `rnd0(20)==0`, `act(-10, human→AI, 8)`. `game_stat_fleet` must be the exact bracket function (see A1.7). |
| growth complaint (block 3) | **V** | Even `year`; `gscale=(size+1)*3`, `gdiv=size+6-difficulty`; counts planets with `prod_after_maint>=100` per owner; `gscale<n && rnd0(4)==0`: `v = rnd(4) * ((-(n-gscale))/gdiv)`, `v=(v/3)*4`, human `v/=2`; `act(v, i→j, 12)` for each non-human j with contact and Alliance(i,j). |
| relation drift (block 4) + mirror (block 5) | **W (consequence)** | Loop: non-human rows i, j≠i, `diplo_val[j]==0`: `v=(|r1| > rnd(105)) ? rnd0(2) : 0`, move toward `relation2` without overshoot, clamp ±100. **BUT** block 5 then copies `eto[i].relation1[j]` into `eto[j].relation1[i]` for ALL i,j in index order, so the LOWER-index row wins. With the human = player 0 the human's row is authoritative and is never drifted ⇒ **no net drift for human↔AI pairs**; AI↔AI pairs get ONE drift roll per turn (lower-index AI's), not two. (08 §7.1 / 05 §4.3 imply a drift for the human pair — not so in the shipped logic.) |
| `update_trade` | **V / N** | `trade_percent += max(0,(rnd(200)+rel1+25)/60)` capped 100 on both records: range is `0..(225+rel1)/60`, i.e. up to **4 at rel 65, 5 at rel 100** (05 says 0..3). Only the i-side record is zeroed when contact is lost in this function (contact_broken zeroes both). `established += bc/10` branch is dead. |

### A1.5 §4.4 player-initiated audience

| Item | Verdict | Detail |
|---|---|---|
| Main-menu enabling: at war (`treaty>=WAR`) → Trade, Threaten/Break, Tech Exchange off; Tribute off iff `reserve_bc<25` and the AI has no tech the human can give... (`esp_sub1(spy=AI,target=human,0,0)==0`); Trade off iff `want<=0`; "later" (74) if `min(moods)<-100` | **V** | |
| Treaty submenu enabling | **V** | NAP only if treaty None; Alliance off if treaty ≥ Alliance (so also off at war); Peace only if ≥ WAR; Declare-war list = other empires with `AI.treaty[i]<WAR` (no contact test); Break-alliance list = contacted empires the AI is Allied with (NAP only with option, off). |
| `check_mood(a0, channel)`: `v = M[channel] + trust + rel1 + (humanRace?50:0) + reldiff[AI] + rnd(100) - a0`, `+40` if allied; then `annoy(1)` (all four human-record moods −10) and channel −= (treaty/trade `rnd30+20`, peace `rnd50+50`, tech `rnd50+20`); bands `<-75→0, <-50→1, <0→2, else 3` | **V** (2 reads) | The draw order: `rnd(100)` then the channel decrement draw. |
| NAP gate `rel1>10` → a0 50 (treaty mood); Alliance gate `rel1>50` → a0 125; Peace a0 60 on the **treaty** mood (Classic), then unconditional `annoy(2)`; Trade a0 50 (trade mood); Break-with-Y gate `rel1(H→A)>24` → a0 `A.rel1[Y]+175` | **V** | A failed gate returns 0 with NO mood cost. |
| "Declare war on X" | **W (one detail)** | Shortcut is `H allied with A AND H.treaty[X]==WAR` (the ASKER at war with X), then `rnd0(8)==0 → code 2 (asks BC) else accept (3)`. 05 text says `A.treaty[X]==WAR` (wrong subject); 01 §5.6 "1/8 yes, else no" is inverted. Otherwise `check_mood(A.rel1[X]+150, treaty)`. Success = `start_war(A, X)` (AI aggressor). |
| result handling: codes 1/2 → `game_audience_sweeten(si)`; the message `set_dtype` runs unless the player refused the sweetener | **V** | Sweetener: `bc = (((rnd8+rnd8)*year)/25)*25` (0 if > reserve); tech from `esp_sub1(AI→human, value>=year, mode 1)`; asks tech if `(tech && code==1) || bc==0` else BC; random wording; agree → AI gets tech / BC moves, request granted (3). Both empty → 0 (refusal). |
| Trade menu | **V** | Options exactly as 05 §4.4.4 (`want<125` → `cur+25..+100`, `want/25` of them; else `cur+want/5`, `cur+((2w/5)/25)*25`, …, `cur+want`). Leaving the menu (any choice incl. Forget It / ESC) costs `annoy(1)` and `mood_trade -= rnd(30)`; a level then runs `check_mood(50, trade)`; only code 3 sets trade (no counters). |
| Threaten/Break menu | **V** | Classic: `annoy(10)` ALWAYS on leaving (even Forget It/ESC). Break NAP/Alliance → `break_treaty(human, AI)`, type 73; Break trade → `break_trade`. Threat formula, `rel1 -= rnd(15)` (floor −100, mirrored), `mood_treaty := -120`, `V<170` war test `rnd(15)-reldiff > rnd(100)` (war P: Xen 57%, Ruth 37%, Aggr 27%, Erratic 7%, Hon ~0.7%, Pac 0), `V>=170` cower: ceasefire `rnd(15)+5`, Classic hides the HUMAN's spies (bug), `V>=275` tech (never newest; no BC fallback) / `V>=200` BC `((rnd8+2)*year/25)*25`. |
| Tribute BC | **V** | Lists 25/50/75/100 (as many as `reserve/25`) when reserve<100 else `r/4, r/2, 3r/4, r` rounded to 25 (cap 32000). Classic gain `0` (if AI prod ≠ 0; `selected+1` if prod == 0), ×2 Human; cap at-war `<=-25`, non-ally `<=65` applied to the AI-side copy only. |
| Tribute tech | **V** | `base = rel<0 ? 20 : (100-rel)/10`; `gain = ((rnd8+rnd8+tech/4)*base)/10`, ×2 Human; `rel1 += gain (≤100)`, `mood_peace += gain (≤200)`, `trust += rnd8+2 (≤30)`; caps at-war −25 / non-ally **70** on the AI copy only. Tech list = up to 4 from `esp_sub1(AI←human, 0, mode 0)`. The AI thanks later with type 66 (25% of accepted-deal speeches while `tribute_tech≠0`). |
| Exchange technology | **V** | Scale `K`: `di=mood_tech(>0 → /5)`, `min 30`, `+25` if allied; `x = trust + rel1/2 + 50*human + 2*reldiff + di + rnd(100) - 125`; `K = x<0 ? |x|+100 : 20000/(x+200)`; `K/=4`; `K=max(K,75)` (so K=75 whenever x≥0). Prices `value*K/100`; AI list = `esp_sub1(human←AI, 0, mode 1)` (≤5 shown), candidate list = `esp_sub1(AI←human, price, mode 0)` (≤4). `annoy(1)`+`mood_tech -= rnd(50)+20` only if the list is non-empty; `annoy(3)` and `mood_tech := min(mood_tech,50)` always on leaving. Exchange immediate. |

### A1.6 §4.6 AI-initiated diplomacy toward the human

| Item | Verdict | Detail |
|---|---|---|
| dispatcher `turn_diplo_p2` (A–E branches, probabilities, `diplo_type==2` kept 10%) | **V** (2 reads) | Plus: the quiet-turn else-branch (`sub2`) overwrites `diplo_type` with 0 when not allied/1-in-10 fails, so a queued type 2 survives only when the proposal branch is rolled → "thanks for trade" is rarer than 05's "10% of turns". |
| `sub1` stages A, B, C, D, E, G | **V** | Stage C: `rnd(prod/25)*25` with `prod = min(prodH,prodA)/4 (≤32000)`. Stage D: `rnd0(10)==0` and no outstanding bounty; tech via `esp_sub1(human←AI,0,mode 2)` else `((rnd3+1)*year/50)*50`; `attack_bounty[A] = X`. Stage E (tech swap): condition `v+rnd(100)+mood_trade>25` and an equality test on values — effectively never fires (source double-applies `-125`). |
| `sub1` stage F "pushy NAP" | **W** | Condition is `H.rel1[A] < 0` AND **`H.total_production > A.total_production`** AND treaty None → type 24 (the weaker hostile AI sues the stronger human). 05 §4.6.2 stage F has the production comparison inverted. |
| sweetener (G): `A.trait1>Ruthless`, `rnd(100) <= H.prod*30/A.prod`, `rnd0(8)==0` (draw order: percent test THEN 1/8), 75% BC `((A.prod/(rnd3+1)+year)/25)*25` else tech | **V** | |
| AI-initiated audience after-effects (`annoy(1)`; extra channel decrements 24/25 treaty `rnd30+20`, 26 trade `rnd30+20`, 30 peace `rnd50+50`, 29 tech `rnd30+20`, none for 28/58/76/27) | **V** | Applied even if accepted. Accepting a gift offer pays `offer_bc/offer_tech` even if the player accepted the original ask without ever seeing the sweetener; `offer_bc` is not debited from the AI. Type 30 accept: `stop_war`, `+20` if `<80`, `annoy(2)`. Type 27 refuse: `rel1 := -100` (both). Type 76 accept: `start_war(human, X)` then type 78; refuse: `break_treaty(AI, human)` type 77. |
| `sub2` call to arms | **V** | `treaty==Alliance && rnd0(10)==0`: last empire X≠H,A with `X.treaty[A]==WAR`, contact(H,X), `H.treaty[X]!=WAR`. |
| `sub3` reaction ladder | **V** | Includes a leading `contact==0 → diplo_type=0` guard. At war: `v+rnd(100)+mood_peace>=50 && rnd0(8)==0 → 30`, sweetener `rnd(100) <= A.prod*30/H.prod` (no zero guard). |
| `wage_war` paths A–E and `wage_war_do` | **V** (2 reads) | Roles confirmed from code: `wage_war(p1=target, p2=aggressor)`; traits/objective read from p2; `fleet_w`/`prod_w` measured p1 relative to p2 (positive = target stronger ⇒ more war). Block C ally-chain (human p4 at war with AI p3, A allied with p3 and with the target, `ceasefire[p4][A]<=0`, `rnd0(10)==0`) and block D (human target, difficulty≥Average, `n_wars<difficulty`, `rel<-30`, `rnd(10) <= (-rel)/10`) run after A/B/C even if A fired (a just-declared Erratic war can be re-announced as type 13 by D). `wage_war_do`: alliance `rnd0(4)==0 || (rnd0(2)==0 && Expansionist)`, NAP `rnd0(2)==0 || Expansionist`; on success `act(-10000,type 32)`, `break_treaty(AI→target)`, relation cap 30; no war same call; war branch needs `ceasefire<=0`: `act(-10000, 13 if rel<0 else 60)` + `start_war(AI, target)`. |

### A1.7 §4.7 AI↔AI

| Item | Verdict | Detail |
|---|---|---|
| tick `!rnd0(15-2*difficulty)` per ordered pair (draw made BEFORE the contact test), score, alliance/NAP/tech-swap/trade/gesture/stale `v`, `annoy(3)`, `sub1`, `wage_war(p1,p2)` | **V** (2 reads) | `v = trust + rel1 + reldiff[p2.trait1] + rnd(100) + (NAP 10 / Alliance 20) + (trade 10)`; `v+mood_treaty>150`: Alliance if not allied, else NAP if not NAP (downgrade oscillation). Tech swap `mood_tech+80 < v` (each side one tech via `esp_sub2(r=rnd(3))`, index `(year ^ r) % num`). Trade `bc=min(prod1/4,prod2/4,32000)` if `v>70`. Gesture `rnd0(20)==0: act(+rnd5, p1→p2, 1)`. Classic: `v := evn.diplo_msg_subtype` (stale) before the `WAR && v+mood_peace>100 → stop_war`. |
| Ally cascade (second loop) | **N** | Runs EVERY turn for EVERY allied AI pair, no tick gate, no contact test: p3 AI with `p3.treaty[p1]==WAR && p3.treaty[p2]!=WAR → start_war(p2,p3)`. |
| Alliance-conflict `sub1` | **N** | Buggy loops (inner loop steps p2 with p3 pinned to p1+1): in effect only checks one pair per p1; breaks both alliances when `p2.treaty[p1+1]==WAR` and p1 is allied with both. Keep bug or implement the clean rule consciously. |
| `game_stat_fleet` (used by the fleet complaint and the stats) | **V** | Cap 3,250,000; brackets 125,250,500…; `px = sum*10/(va-ve) + 10k` (ve=0 on k=0); clamp 0..100; non-monotone at bracket edges (e.g. 375→30, 376→20). Stats: prod same with 100,200,…; pop `total_pop/((stars*3)/2+1)`; planets `n*100/(stars+1)`; tech `sum(TL)/3`; total = `sum*100/max` (all clamped 0..100 first). |

### A1.8 §4.8 message catalogue, §4.9 comparison table

All dtype numbers 1–80 in 05 §4.8 / 08 §7.8 are consistent with the source's assignments (14+trait1 greetings; 24/25/26/27/28/29/30; 31 refusal with replacements 33 (25%) and `blunder+30` (50%); 32 treaty-cancel; 42..49 = +38 warning, 50..57 = +46; 58–61; 62–68 answers; 69–71 threat; 73–78; 79/80 council). `get_dtype`: for dtype 31/33–41/62–68: result 0/1/2 (not accepted) → `blunder≠0 && rnd0(2)==0 → blunder+30, clear`; else `broken_treaty≠NONE && rnd0(4)==0 → 33, clear`; else 31. Accepted (3): `rnd0(4)==0 && tribute_tech≠0 → 66`. 05 §4.9 table rows are consistent with the code.

---------------------------------------------------------------------------------------------------

## A3. Galactic Council — §6

| Item | Verdict | Detail |
|---|---|---|
| Convene: `!cheat && council_years(25)!=0 && ((year%25==0) || !election_held) && num_alive>2 && ((stars*2)/3 <= planets_with_owner) && end==NONE`, evaluated in `game_turn_process` after events, after `turn_diplo_p1`, before `turn_diplo_p2` and BEFORE `year++`; `election_held=true` set after `game_election` regardless of outcome | **V** | 16/32/46/72 for 24/48/70/108 stars. |
| votes = `ceil(sum pop of non-rebel planets / 100)` per empire (`v/100 + (v%100!=0)`); total = sum; dead empires 0 | **V** | Rebelling planets (unrest==REBELLION) excluded. |
| candidates = top two (bubble sort over all players, strict `<` so ties keep lower index); if #1 is AI and #2 human → human first | **V** | |
| voting order: all alive non-first-human empires in ascending player index (AIs and extra humans mixed), **first human last** | **V** | |
| abstain: `evn.voted:=NONE`; `act(-6, V→cand1)` THEN `act(-6, V→cand0)`; vote c: `got+=n`, `voted:=c`, `act(+24, V→c)` then `act(-12, V→other)`; `n==0` forces abstain | **V** | A human voter that is not candidate[0] uses dtype 80 (for) / 79 (against, p2 = the candidate voted for). |
| need `((total+1)*2)/3 <= got` (>=), candidate 0 checked first; winner → `end = human ? WON_GOOD : LOST_EXILE` | **V** | |
| AI vote (`vote_w`, `like`, `hate`, order, strict `<`, `/4`, the `/5` on the second candidate's hate branch, hate branch uses `w(c2)` for c1 and `w(c1)` for c2) | **V** (2 reads) | `w(c) = 20[Orion owner] + 20[c.race==Human] + 40[voted[V]==c]`; order: self, allied, at-war, c1 (rel≥0: like(c1) → c1; else hate(c1,c2) → c2), then c2 (rel≥0: like(c2) → c2; else `rnd(100) < -rel(c2)/5 + w(c1)` → c1), else abstain. |
| accept: each living human asked (first..last human index); refusals `refuse[]`; for each NON-refusing p1: for each refusing human: `break_trade(ph,p1)`, `treaty(ph,p1)=FINAL_WAR`; `treaty(p1,p2)=ALLIANCE` for all non-refusing p2 ≥ p1 (incl. itself); `end==WON_GOOD → winner := candidate[1]`; `tech_final_war_share`; `end := FINAL_WAR` | **V** | If an AI won and the human refuses the winner is unchanged. |
| per-turn final war (`update_final_war`, after `year++` in a 1-human game): same refuse-status pairs `ALLIANCE, rel1=+100`, different `FINAL_WAR, rel1=-100`; `wage_war` when `end!=NONE` makes same-status empires allied | **V** | |

---------------------------------------------------------------------------------------------------

## A4. §8.1 end states (partial: the check order; endings text/UI §8.2 not checked)

| Item | Verdict | Detail |
|---|---|---|
| `game_turn_check_end` order: (1) `end==LOST_EXILE`, (2) `end==WON_GOOD`, (3) count planets/good(non-rebel) planets per owner: only ONE empire has planets → WON_TYRANT, (4) no human with `good_planets>0 && alive` → LOST_FUNERAL (killer = `human_killer`, else first surviving empire; dead banner = human) | **V** | Called after coup, after `event_run`, after the council, and after the audiences (4 call sites). Note (3) precedes (4): a human whose every planet is rebelling but who is the only empire with planets "wins". |
| coup of the last human ⇒ funeral | **U (here)** | `game_turn_coup` itself only re-rolls traits and clears unrest. Where the human funeral comes from is checked under A5 (`game_event_run`). |
| Stats bars `game_stats_all` (§8.3) | **V** | See A1.7. |

---------------------------------------------------------------------------------------------------

## A2. Espionage — §5 (PARTIAL: hiring, per-turn resolution, UI sliders verified; mission internals NOT re-derived)

| Item | Verdict | Detail |
|---|---|---|
| §5.1 hiring `spy_build` | **V** (2 reads) | per target with `spying!=0`: `fund = gross*spying/1000 + spyfund`; `cost0 = (2*TL_computer + 25)` (Darlok: that sum `/2`, truncated); `while fund>=cost: spies++, fund-=cost, cost*=2`; remainder kept; cost resets every turn and per target (living spies are never counted). `TL` = `tech.percent` (02 §1.6), not a tech level. |
| §5.3 `game_spy_turn` | **V** (2 reads) | `comp1=TL(+20 Darlok)`, `comp2=TL(+30 Darlok)`; `dt1=max(0,comp2[S]-comp1[T])`, `dt2=max(0,comp1[T]-comp2[S])+T.security/5`; Hide: `+30 dt1`, each spy `rnd(100)+dt2>85` caught (no `any_caught`), mission void; else per spy `r=rnd(100)+dt2`: `>99` all caught+failed (any_caught, stop), `>70` caught+failed, `>50` failed (any_caught) — the 4th branch is dead; `n-=failed`; `caught=min(caught, spies)`; success roll `rnd(100)+dt1`: `>84` all remaining succeed, `>100` frame; needs a planet on both sides. Mode 1 espionage, mode 2 sabotage. |
| §5.4 steal pool/caps/value function, §5.5 sabotage dice and fallout, §5.7 AI spy settings, §5.9 | **U** | `game_spy_espionage/sabotage/esp_sub1/sub2/sub5/get_value`, `game_spy_esp_human/sab_human` and the `turn_p3` spy block were NOT outlined in this pass; 08 §10 [C] reads are the only evidence. `esp_sub1(mode)` semantics (mode 0 = any tech incl. newest, 1/2 = excludes the newest / two newest) are inferred from call sites. |

## A5/A6 status — NOT re-derived
- §7 events/monsters/Guardian/artifacts: only verified `event_roll=512`, `evn.year=40`, Orion placement (random star, Terran, maxpop 120, 4xTech, never a home), artifact planets 10% (type Minimal..Ocean, normal special, `rnd(10)==1`), homeworld start pop/factories/prod by difficulty (50/30/55 Simple-Average, 40/30/50 Hard-Impossible). Event type table, monster/Guardian stats, loot: **U**.
- **Resolved afterwards (events §7.1/§7.1.1, coup, genocide) — VERIFIED from `game_event.c`:**
  - Roll: `chance = (evn.year > year) ? 0 : year - evn.year`, then Simple `/2`, Easy `*2/3`, Average `*3/4`, Hard `*4/5`, Impossible unchanged (integer); event iff `rnd(512) <= chance`; early exit if events cheat-disabled or `event_roll==0`; victim planet = random planet of the victim, **return (no re-roll) if none or Orion**.
  - Victim weights (**05 §7.1.1 is right, 08 §12.4 "never hit" is wrong**): counts per owner; for real players `n<4 → 0`, else human `n*5`; `m = max(5, min over ALL 6 slots)` (unused slots count as 0, so `m=5` unless all six slots are in use); `w = w/m` (integer); for EVERY real player (`i < players`, **alive or dead**) `w = max(w,1)`; pick `r=rnd0(sum)` and walk the players (last real player absorbs). So an empire with fewer than 4 planets is NOT immune (weight 1), and a dead empire also weighs 1 (picking it ends that turn's attempt silently, `evn.year` unchanged). ⇒ `Events.CFG.immuneBelow4` must stay **false**.
  - Coup news (`game_event_run`): for each alive empire with `evn.coup`: if it is human AND the number of living humans is exactly 1 → news subtype 2, `end = LOST_FUNERAL` (race slot = banner of the first living other empire, `banner_dead` = its own banner) and the rest of the event phase is skipped; otherwise (AI, or human with other humans alive): AI gets a new emperor name; news subtype `rnd0(2)` (carries new trait1/trait2) only if a human is in contact (or the empire is human). The trait re-roll itself happened earlier in `game_turn_coup`.
  - Genocide (`game_event_run`): empire alive with `0` planets and (AI, or more than one human alive): killer = LOWEST-index empire j having ships in orbit at, or owning, a planet whose `claim == victim`; if a killer exists: GNN item + `act(-36, killer→j, dtype 0)` for every j ≠ victim, ≠ killer; always `kill_player` (home := none, fleets removed, refuse bit cleared). The last human is never "genocided" here — the funeral comes from `check_end`.
- §9 master table: verified tech-cost multipliers human 20/25/30/35/40, AI 20; Erratic `rnd(300)<=d`; AI-AI tick `1/(15-2d)`; AI-AI neg divisor `d/2+1`; pile-on `n_wars<d`; growth `gdiv=size+6-d`; treaty breaking only at Average+; `tech_next` best-of-list `rnd(6)<d`. Not verified: production multiplier, AI missile-base cost, AI tax/security/need-conquer, event/monster HP tables.

---------------------------------------------------------------------------------------------------

## CORRECTIONS (exact values; supersede research/05 unless stated)

1. §4.6.2 stage F: `H.rel1[A] < 0 && H.total_production > A.total_production && treaty None` → type 24 (05 had the production test inverted).
2. §4.4.3 "declare war on X": shortcut = human allied with A AND `H.treaty[X]==WAR` → `rnd0(8)==0 ? code 2 : accept`; else `check_mood(A.rel1[X]+150, treaty)`.
3. §4.3 drift: lower-index row wins in the closing mirror loop → no net drift for human(P0)↔AI; AI↔AI one roll per pair (lower index). 08 §7.1 "two chances" is wrong.
4. §4.2.3 battle_finish order: bio −10 to every AI≠offender (incl. injured) FIRST, then `-offense`, then the ≥30 block. Add: human bombing that depopulates a planet: treaty<WAR → `start_war_swap(owner,human)` + `act(-(50+rnd50), type 13)`, else same dv type 10, and NO `battle_finish`.
5. §4.4.4: trade % gain `max(0,(rnd(200)+rel1+25)/60)` ranges up to 4 (rel 65) / 5 (rel 100).
6. `limit_mood_treaty` clamp [-200,120] at start of `turn_diplo_p2` and of each audience; `mood_relax` once, just before `year++`; initial moods are all 0.
7. Ally cascade (AI-AI loop 2) is per turn, unconditional, no contact test (08 §3.4/§9.1 wording).
8. 01 §5.3(c)/§5.7(b): `wage_war_do` relation cap is 30 for NAP too (not 20). 01 §5.6 "declare war: 1/8 yes" is inverted (7/8 accept in the allied-at-war case).
9. `sub2` (call to arms) sets `diplo_type := 0` whenever it does not queue type 76 (so thanks/other recorded types rarely survive the quiet-turn branch).
10. Alliance-conflict loop of `turn_diplo_p1_sub1` is buggy in the original (effectively checks p3 = p1+1 only); `CFG.allianceConflictFixedIndex` in diplo.js models it.

## CODE AUDIT (js/sim/diplo.js, spy.js, council.js, events.js — static reading against the verified rules; NO node repro run, time-boxed)

Already conforming (checked line by line): `D.act` (all 13 steps), `breakTreaty` (+`CFG.classicTrustBug=true`), `startWar` (rel `-75-rnd25`, rel2 -5, moods -200/-130), `stopWar`, `battleFinish` order, `checkMood` (formula, bands, channel decrements), drift (errata 3 already adopted, `driftBothRows=false`), growth/fleet complaints, `proposals()` incl. stage F fix, `reaction()` ladder, `warDo`, `warCheck` paths A/B/C/E, spy hide/caught/stopped/confess thresholds 85/99/70/50/84/100 and `security/5`, `compTL+spyDef/spyOff`, sabotage dice `(weaponTL+9)*n/10`, council `ceil(pop/100)`, need `floor((total+1)*2/3)`, `floor(2*stars/3)`, vote rule incl. `/5`, abstain order cand1 then cand0, events roll `rnd(512) > scaled`.

Findings (ranked; none crashes):
1. **MEDIUM – diplo.js `dispatch()` / `callToArms()`**: the original quiet-turn branch (`sub2`) clears `diplo_type` unless it queues 76. Here `callToArms` returns without clearing, so a recorded `dipType` (1/2/3 thanks types, etc.) stays queued instead of surviving only through the rare E4 branch. Fix: in `dispatch`'s final `else`, set `r.dipType = 0` before `callToArms`, then let it set 76.
2. LOW – `diploAdjust` block A uses an independent 50% roll per treaty type; original: ONE 50% roll per pair, then NAP/alliance/trade acts together. Fix: draw once per pair.
3. LOW – `warCheck` path D draws `rnd0(10)` once per human before testing the (p3) conditions; original draws once per matching (p3,p4) pair after the three cheap tests (P = 1-(9/10)^k). Also path C is skipped when B already started a war (original re-runs `war_do` and re-announces with type 13).
4. LOW – `breakTreaty` returns early when `old===NONE`; original still sets all four moods -200 and clears bounties (only matters for direct calls). `startWar` omits the human `have_met=1` marking.
5. INFO/UNVERIFIED – events.js victim weights (`n<4 → 0`, human×5) vs 05's `max(w,1)`: resolve against `game_event_new_get_victim`; coup→funeral route; `esp_sub1` modes.
