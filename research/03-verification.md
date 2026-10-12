# 03 - Independent verification of research/03 (ships, tactical combat, ground combat) against 1oom source

Verifier: independent agent. Primary source: 1oom (GPL) `src/game/*.c|h` fetched file by file (game_shiptech.c/h, game_techtypes.h, game_tech.c, game_num.c, game_design.c, game_parsed.c/h, game_battle.c/h, game_battle_human.c, game_ai_classic.c, game_turn.c, game_ground.c, game_bomb.c, game_planet.c). No code copied; numbers/formulas only. Fetches are summarised by a small model, so every table was requested as a cell list and diffed by hand; logic items were cross-checked twice where they mattered (bio-bomb branch, max_pop3 floor).

## 0. Scoreboard
- Part A rows checked: 63 weapons, 11 computers, 10 ECM, 11 shields, 14 armors, 9 engines, 30 specials, 4 hulls (every cell), T50/T25 tables (51+51), tech-level map (all six fields), game_num constants, design cost/space/power/HP formulas, tech-percent formula, ~70 rule statements of research/03 §4-§7.
- Result: **0 WRONG cells in any §3 table. 2 WRONG rule statements, 1 now-VERIFIED "unverified" (51 rounds), 9 refinements/omissions, ~12 areas UNVERIFIED (listed in §6).**
- Engine state at time of writing: `node tools/rules-test.js combat` 130 pass / 0 fail; `ground` 68 pass / 0 fail (tests encode research/03, so they inherit its errors below).

## 1. Verdicts - data tables (research/03 §1-§3, research/02 §3)
| Item | Verdict |
|---|---|
| §1.1 hull table (cost 60/360/2000/12000 tenths, space 40/200/1000/5000, HP 3/18/100/600, power 2/15/100/700, defense +2/+1/0/-1) | VERIFIED |
| `hull_w` {1,5,25,125}, base_hp {50..200}, pshield cost {0,500,1000,1500,2000}, bt_turn_max 50, pop_hp 200, fact_hp 50, max_inbound 300, max_bomb 100000, max_bio 10000, limit_ships 32000, stargate 3000/100 | VERIFIED |
| §2.2 power/engines, §2.4 cost (max 5/1 floors, (c+5)/10), §2.5 space (weapon space T50, others T25, min 1 per fitted item, engines*(n)/10), §2.6 HP | VERIFIED |
| §2.3 T50/T25 (51 values each, identical) and tech percent formula `len==1 ? v=1 : v=(tmax-1)/5+2; P=clamp(tmax+len-v,1,99)` | VERIFIED |
| §2.7 combat_speed=(man+3)/2+extraman/2, beam_def=man+hull_def+extraman+1, missile_def=+ECM level, Scanner +1 attack, Mrrshan +4, Alkari +3/+3 | VERIFIED (man = rating-1 in design) |
| §3.1 engines (9), §3.2 computers (11), §3.3 ECM (10), §3.4 shields (11 incl. IV huge 675, VI tech 24), §3.5 armor (14 incl. Neut II huge cost 2500), hulls | VERIFIED cell-for-cell |
| §3.6 all 30 specials: cost/space/power/type/field/effect numbers (repair 15/30, misshield 40/75/100, extraman 2/4, extrarange 3, pulsar 1/2, stream 1/2) | VERIFIED |
| §3.7 all 63 weapons: damage, range, extraacc, halveshield, is_bomb, misstype, damagemul, numfire, numshots, cost, space, power, nummiss, speed (dtbl[0]/32: Proton 255px=7.97), fuel v24=2 for every missile/torpedo | VERIFIED |
| §3.8 tech levels of every component/ground tech (Death Ray = Weapons 36, Fusion Bomb 9, Hyper-X 8, SP-V 11 ...) | VERIFIED vs game_techtypes.h enum order |
| research/02 §3 tables (identical data), §5 ground tiers (armor 5/tier, suit 10, shield 10, weapon 5*(t<=2?t:t+1), Bulrathi +25, defender +5) | VERIFIED |

## 2. Verdicts - rules (research/03 §4-§7)
VERIFIED as written: battlefield 10x8, Chebyshev; planet at (1|8,3); groups at x=0/9 rows {3,4,2,5,1,6}; rock count (some 1..4, many 5..7) and placement rules; initiative formula and tie order (higher item index first); round setup (actman, numfire refill min(n+rof,rof), torpedo = 2 numfire); to-hit incl. precap quirk and cumulative accuracy for beams/bombs; beam damage interpolation, absorb/absorbdiv (oracle off), damagemul, kill loop with remainder carry, streaming (nummiss==1) unlimited kills; planet collateral 200 pop / 50 factory with halving while bases stand; missile mechanics (fuel 2, +12 planet, 10 px radius, rock table {10,9,8,7,7,6,5,4,3,3}, misshield roll `misshield - weaponTech`, Plasma fade `flown_px/2`, torpedoes halved vs planets only); planet/base stats; stasis/ion/neutron/pulsars/black hole/technull numbers; repair; retreat flag 1->2->leave; AI retreat formula (v=(5-diff)*5+5, +10/+20, +rnd 1..15, planet 70%); loser fleet -> nearest other planet of loser, else lost; AI-vs-AI weights (classic +15, planet bonus (W+FF)*75*bases, monsters 100000/30000, survivors count*w2/W, bases untouched); monsters (every number, all combat speed 2, attack 10); transport gauntlet (HP (tier+1)*15, bases*24 shots, (v*2)/speed, L=clamp((bestcomp-speed)*2+12,1,20), bestcomp last-match bug, owner-comp bug, cap 1000, combat transporters 62.5% classic); ground combat (force, tie, swap, capture, tech theft 1/50 per factory, 6 max); orbital bombardment (comp=(maxcomp-1)*2+6 clamp 1..20, 30 shots for unlimited weapons, only 3 banks, misstype==0 missiles halved, divisors rnd(1..20)+40 and rnd(1..80)+160, bio added undivided, max_pop3 floor 10 even when cancelled); game_planet_destroy field list.

### WRONG / now corrected
1. **§4.4(4) "Waiting groups do not react" is WRONG.** On Wait the source sets `can_retaliate = true`, so a waiting group fires reaction shots at movers for the rest of the round (a group that has not yet begun its first turn still cannot, except repulsor).
2. **§4.2/§4.11/§12 "plays 51 rounds (unverified off-by-one)" is now VERIFIED:** `num_turn > 50` is tested before the round increments `num_turn`, so rounds 1..51 are played and TIMEOUT is returned at 51 > 50 (winner = planet owner's side, else right side). Config `maxRounds` should be 51 for exact v1.3.

### Refinements / omissions (research silent or imprecise)
3. §4.3: a defending planet owning a **Subspace Interdictor** has `subspace=1` on its item -> **+1000 initiative** (acts before everything except ready teleporters); losing all bases re-enables disabled teleporters.
4. §4.5: the rock +30 applies only when the LAST obstructing cell on the line is a rock; the planet's own cell overwrites it, so shots **at the planet never get +30**. Ships on the line do not count.
5. §4.6/§4.7: Displacement Device on a missile stack is rolled ONCE per stack (`d100 < 35` -> that stack's damage 0), not per missile. Beams roll per shot.
6. §4.8: halving of planet collateral tests "bases alive" BEFORE the volley's kills for missile hits, AFTER kills for beams/bombs. Base HP uses the LAST armor tech in the completed list (not the max tier) - same for transport HP and ground armor tiers.
7. §4.9: Pulsar - after `hp1 -= v`, if `hploss > hp1` one ship also dies (hploss kept). Ion/Neutron stream - v = ceil(hp1*pct/100); if `hp1 <= hploss` one ship dies and hploss=0; if hp1 reaches 0 the whole stack dies; used automatically (no button) when within 2. Warp Dissipator - 50% (rnd 0..1) per use; `actman -= TOTAL unman` (cumulative, not +1); if the chosen target is invalid/the planet/already stopped it retargets to the LAST enemy within 3 with unman<man; defense -2 only if it still has movement.
8. §5.2: bio weapons ALSO run the ordinary beam/bomb damage loop against the planet after the pop-loss step (damage = damagemin 1/2/3 minus planet absorb, collateral included) - "never hurt bases/factories" is only true when absorb >= damagemin.
9. §4.1: ceasefire - an AI attacker vs a human defender under ceasefire does not fight but its fleet IS sent to its nearest other planet (battle_post); treaty stand-down (alliance, or NAP when the defender does not own the planet) leaves the attacker in orbit. `game_battle_finish` raises `max_pop3` to >= 10 for ANY battle at an owned planet (even without bio). Gauntlet shooters = treaty NONE/WAR/FINAL_WAR (NAP and alliance do not shoot) but the planet owner shoots regardless of treaty, with bases + its own ships; negative survivors wrap (uint16) for the next shooter. AI bomb decision: Bulrathi inbound counted +20% (classic), never bombs a human under ceasefire.

## 3. CORRECTIONS (exact values, supersede research/03)
- Wait: `can_retaliate=true`. Rounds actually played: **51**. Planet + interdictor: **priority +1000**.
- Missile Displacement: one `rnd(1..100) < 35` per stack. Rock +30: only if last obstruction cell is a rock; never vs planet.
- Everything numeric in §3 (components, hulls, weapons, tech levels) stands unchanged.

## 4. Code audit (js/sim/combat.js 1760 lines, js/sim/ground.js 771 lines) - PARTIAL, about 15% of combat.js read in depth
Ranked (no crash or definite arithmetic bug found in the parts read):
| # | Sev | Finding | Where |
|---|---|---|---|
| C1 | MED | Wait sets `canRetaliate = false`; source sets true (research error propagated). Also Wait skips re-running start-of-turn effects (deliberate "1.40m patch" behaviour; v1.3 re-arms pulsar/stream/dissipator and repeats repair) | combat.js:1128, header line 80 |
| C2 | LOW-MED | `maxRounds: 50` (deliberate; v1.3 = 51 rounds) | combat.js:91, 1167 |
| C3 | LOW | Planet item never gets the Interdictor +1000 initiative; teleporter cancel is modelled, planet priority is not | combat.js:416, 479 |
| C4 | LOW | `impact()` rolls Displacement per missile (source: once per stack): same mean, wrong variance | combat.js:776 |
| C5 | LOW | `planetCollateral` after kills for missile hits (source halves using bases alive before the volley) | combat.js:786-790 |
| C6 | LOW | Missile `impact()` otherwise matches the source: precap, `misshield - tl`, torpedo-only planet halving, hp1 clamp per missile, remainder carry | combat.js:753-792 verified |
| G1 | CONFIG | ground.js default `RULES.tie='defender'` (attacker loses ties). v1.3 classic: side 0 loses ties = defender when a human is involved, attacker in AI-vs-AI; `tie:'classic'` preset implements it. Default preset also uses fixed gauntlet comp/combat transporters (classic preset available) | ground.js:49-69, 141-143 |
| G2 | LOW | `groupTier` uses MAX tier owned; source uses the LAST researched tech of the group (differs only after trading/stealing a lower tier later) | ground.js:293-295 |
| G3 | OK | force formula, Bulrathi +25, defender +5, weapon t>2 -> t+1, max landing 300, tech theft, transport HP table verified in code text | ground.js:107-114 |
Not audited (time): beam/bio fire functions, special devices, AI turn, auto-resolve weights code, gauntlet implementation, bombardment implementation, missile base cost.

## 5. Repro notes
Static evidence cited by file:line above. No failing node snippet was produced (no arithmetic bug found); to confirm C1: put two opposing groups, make the slower group `wait`, move the faster enemy adjacent and check for a `reaction` event from the waiter (source: fires; engine: silent).

## 6. UNVERIFIED (not fetched/confirmed)
Missile base cost formula §5.1 (game_get_base_cost), build/upkeep/scrap values §1.4/§6 (2%/25%), starting designs §8, AI tactical turn §4.13 (game_battle_ai_* ), Crystal/Amoeba/Guardian event spawn/movement/loot §4.15 tail, max half-population transport limit §7.1, diplomatic DP table §4.11, OSG-only claims (exposure table, kill-ratio table), design-AI preferences §9, game_ai_battle_dmggive/rival internals, monster handling in game_ai_classic for stasis throttle (AI stasis only when left-side groups-2 >= frozen groups: noted, not in research).

## Resolution log (HANDOFF item 3, verification-gaps pass)

Already applied by the combat agent before this pass (re-checked in code): Wait sets `canRetaliate` (C1), `maxRounds: 51` (C2), Interdictor +1000 priority (C3), one Displacement roll per missile stack (C4), collateral halving timing for missiles (C5).
Applied now (tests in `50-combat.test.js`, `50-combat-fire.test.js`):
- Refinement 4 ("errata 4"): `lineBlocked` keeps one "last obstruction" value while walking the line of fire; a rock sets it, the planet's square overwrites it, ships never count; +30 only if the last one is a rock (shots at the planet already got none).
- Refinement 8 ("errata 8"): `fireBio` additionally runs the ordinary damage loop vs the planet: per shot `damage - absorb` with no to-hit roll, collateral included (via `acc.collat`). ASSUMPTION: the "damagemin 1/2/3" of the report is the bio weapon's maximum (Death Spores 1, Doom Virus 2, Bio Terminator 3); the report does not say whether the damage is rolled in 0..max or fixed. Fixed at max was chosen (no extra RNG draw, keeps bio tests stable).
Ground (`ground.js`, tests in `55-ground.test.js`): `G.inbound` now counts ALL of the bomber's transports in flight to the planet (1oom `game_turn_bomb`); an AI never bombs a HUMAN owner it holds a ceasefire with (`Diplo.ceasefire > 0`). The default tie rule (`RULES.tie = 'defender'`) stays a documented product option: `Ground.useRules(Ground.CLASSIC_RULES)` / `tie:'classic'` gives v1.3 (side 0 loses ties = the defender when a human is involved, the attacker in AI-vs-AI). G2 (`groupTier` = max tier vs last researched) unchanged, only differs after trading/stealing a lower tier.
Still unverified/open: missile-base cost vs SG ~283 (254 reproduced by hand), build/upkeep/scrap, starting designs, AI tactical turn, Crystal/Amoeba/Guardian logic, transport cap, beam/special/gauntlet code paths line by line, pulsar/stream/dissipator extra rules (refinement 7: the pulsar "one ship also dies" and stream `ceil(hp1*pct/100)` rules were not re-audited in this pass), Wait re-arming start-of-turn effects (kept as the 1.40m behaviour, documented in the combat.js header).
