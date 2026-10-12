# AI expansion notes — intel, scouts, colonisation (`js/ai/intel.js`, `js/ai/colonize.js`, tests `tools/rules/81-ai-expansion.test.js`)

Specs: research/07 §3 (colonisation), §8.1 (send_scout), §8.4 (bestspeed terms), §1.3 (p1 order, flag_send_colony), §6.1 rows 6/7, §2.2 (new colonies) · research/08 §3.5 (need_conquer), §4.2 (fronts, anchors).
Details re-checked against 1oom `game_ai_classic.c` / `game_turn.c` (rules and numbers only, nothing copied): `send_scout`, `have_colony_ship`, `send_colony_ships`, `game_turn_fleet_send`, `turn_p1_front`, `new_game_init`, `game_turn_explore`.

## Where each rule lives
| Spec | Implemented in |
|---|---|
| territory centres (mean x,y, int div, (0,0) if none), bestspeed S = P+3 (P = best engine level in {6,12,…,48}) | `Intel.centres`, `Intel.bestPropulsion`, step 10 `intel` |
| contact (Diplo.hasContact, else geometric rule), human contact, final-war state | `Intel.contactWith`, step 10 (`ctx.shared.contact/humanContact/ended/refusers`) |
| fronts: point = (4·rival+6·own)/10, merge range 10·S+10 (dropped, not summed), min(relation,0), dummy front +80, anchor = nearest planet overridden by nearest "defended" one (missile base or exactly one ship in the first stack), merge by anchor (5 passes), force share | `Intel.fronts` (run in step 10, again at the end of 20 and 25 = the original's two `front` calls) |
| colonisable threshold (Planetology, Silicoid 1), `have_colonizable`, free planets in range | `Intel.colonyFor`, `Intel.scanColonizable` |
| scouting: ignore explored / frange 0 / foreign non-allied ships / my in-flight destinations; Orion never; nearest star with ANY ship; first design with tanks else last; floor(n/4)+1 ships; frange 2 needs tanks; cap 208 fleets | step 20 `scouts` (`AI.Colonize.scouts`) |
| `need_conquer` = rnd0(8−d)==0, cleared by any colonisable free planet / game end | step 20, `ctx.shared.needConquer` |
| spawn: prod=clamp(floor(2·TP/5),1,500); d<2 and rnd0(6)>d → 0; roll rnd(500)>prod fails; anchor = uniform random front; returns count>0 | `AI.Colonize.haveColonyShip` + order `aiColonyShip` |
| dispatch: candidates in planet-index order, type ≥ colony design base (Silicoid 1), nearest stack, whole orbit incl. escorts leaves, one target per source per turn | `AI.Colonize.sendColonyShips` via `Intel.send` |
| `flag_send_colony` (non-Expansionist, >half planets developing, human contact) | `AI.Colonize.sendAllowed` |
| §2.2 new-colony defaults | `AI.onColonized` (Colony.found already does the same; hook re-asserts it for AI empires only) |

## Quirk flags (`AI.QUIRKS.<name>`; false = fixed, true = original; `options.aiClassic` flips all)
- `fourthColonyShip` false — >3 colony-design ships anywhere ⇒ no spawn and no dispatch (original BUG); fixed: dispatch what exists, spawn nothing above 3.
- `colonyDesignIndex` false — original `shipi_colony` = design 1 (Fighter) until the first p2 run: real colony ship not recognised, "free colony ship" is a Fighter. Needs `E.ai.p2Done` (designs.js); falls back to turn ≥ 10.
- `staleColonyOrbit` false — original does not refresh a source stack after sending (later targets near it get nothing that turn).
- `colonyRangeCap` false — original sends only if the nearest stack is ≤ fuel·15 map units from the target (Classic+ has no cap).
- Not reproduced (no flag): Classic deletes ships of a dispatched orbit that cannot travel (spec: never replicate); threat-table 16/32-bit masks.
- Kept as original, no flag: scouts use ANY ship (the colony ship becomes scout #3 on turn 1 when ≥3 in-range targets exist — research/07 §1.5 missed this, verified in the 1oom source), escorts leave with colony ships, planet-index order, no target scoring, spawn roll continues while sending is throttled.

## New order / hook / API
- `{t:'aiColonyShip', planet, slot?}` (AI empires only; own planet; colony design unless classic; once per turn via `E.ai.conjured`) → `Fleet.addShips`. `AI.onColonized(S,E,p)`.
- Public: `AI.Intel` (`init send fronts threats centres colonyFor scanColonizable contactWith bestPropulsion designThreat ENROUTE_MAX`), `AI.Colonize` (`scouts colonize colonySlot haveColonyShip sendColonyShips sendAllowed`). Shared-field contract: header of `intel.js` (military.js already uses it: `orbit/moving/inFlight/galaxyMoving/fronts[].value/star`).

## Measured (150-turn AI-only games, large map, 3 opponents, 6 seeds × 5 difficulties, default quirks; median colonies of all living AIs)
| difficulty | T25 | T50 | T100 | T150 |
|---|---|---|---|---|
| Simple | 2 | 3 | 6 | 10 |
| Easy | 3 | 3 | 6 | 9 |
| Average | 4 | 8 | 10 | 13 |
| Hard | 4 | 7 | 12 | 13 |
| Impossible | 5 | 8 | 12 | 17 |
No AI stuck at ≤1 colony (0/120 empire-samples per mark). `aiClassic` (all quirks): Average medians 4/6/9/13 (T25/50/100/150). Objective means at T100: Expansionist 12.1, Ecologist 13.5, Militarist 10.4, Technologist 8.7, Diplomat 7.2 — confounded by race (Silicoid/Sakkra are mostly Expansionist) and by war losses; in the original the objective only changes expansion through `flag_send_colony`, which needs a human in contact (none in AI-only games).
Spawn Monte-Carlo (12–20k draws) matches `clamp(floor(.4·TP),1,500)/500` (TP 55 → 4.4 %, 100 → 8 %, 300 → 24 %, ≥1250 → 100 %), Simple ×1/6, Easy ×2/6; need_conquer 1/8,1/7,1/6,1/5,1/4. Performance: steps 10+20+25 ≈ 0.04 ms median on a 108-star, 6-empire mid-game (cold snapshot ≈ 0.13 ms).

## Known gaps / decisions
- Fixed default sends colony ships anywhere inside fuel range (Classic+ behaviour, research/07 §11.5 #3): long trips (6–10 turns at warp 1) are normal. `colonyRangeCap` restores the Classic cap.
- An empire that owns no planet gets no fronts (original anchors at planet 0). Dead AIs are skipped by `AI.plan`.
- `Intel.designThreat` delegates to `AI.Military.designThreat` when loaded (one formula); fallback is the same reading of research/07 §8.5.
- Tests: 46 (45 pass, 1 skipped when the real Diplo makes the geometric-contact fallback unreachable). `MOO_LONG=1 node tools/rules-test.js ai-expansion` runs the full 6×5×150 matrix; default is 3 seeds × Simple/Hard/Impossible × 100 turns.
