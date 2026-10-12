# Handoff — AI expansion (intel, scouts, colonisation)
Owner files: `js/ai/intel.js` (step 10) · `js/ai/colonize.js` (steps 20 scouts, 25 colonize, order `aiColonyShip`, hook `AI.onColonized`) · `tools/rules/81-ai-expansion.test.js` (46 tests: 45 pass, 1 skip) · `tools/ai-notes/expansion.md` (rule map, details).
Specs: research/07 §3, §8.1, §1.3, §6.1; research/08 §3.5, §4.2. 1oom `game_ai_classic.c` re-checked for send_scout / have_colony_ship / send_colony_ships / front / new_game_init (rules only).

## Done (works end-to-end in real games)
- Scouts: 2 scouts + (turn 1) the colony ship go to the lowest-index unexplored in-range planets; any ship can scout (original); floor(n/4)+1 per target; need_conquer 1/(8−d) → `ctx.shared.needConquer`.
- Colonisation: free "conjured" colony ship (`min(500,0.4·TP)/500`, Simple 1/6, Easy 2/6), dispatch in planet-index order, nearest stack + escorts, Silicoid any type, Reserve-Fuel-Tank range-2 rule, `flag_send_colony` (Expansionist exempt), automatic founding + `AI.onColonized`.
- Intel/fronts/centres/bestSpeed/force table + planned-fleet overlay and `AI.Intel.send` — consumed by `military.js`.
- 150-turn AI-only smoke (3 seeds × default and aiClassic; 6 seeds × 5 difficulties): no errors, nobody stuck at ≤1 colony. Median colonies T25/50/100/150: Simple 2/3/6/10 · Easy 3/3/6/9 · Average 4/8/10/13 · Hard 4/7/12/13 · Impossible 5/8/12/17.

## Quirk flags (false = fixed default)
`fourthColonyShip` (4-ship curse) · `colonyDesignIndex` (colony role = Fighter until first p2; needs `E.ai.p2Done`) · `staleColonyOrbit` · `colonyRangeCap` (fuel·15 units). `options.aiClassic` turns all on (Average medians 4/6/9/13).

## NOT done / gaps
- Classic's deletion of unsendable ships and the 16/32-bit threat masks are deliberately not reproduced. No planet-less fronts. Expansionist advantage exists only with a human in contact (original rule), so AI-only soaks show none beyond race effects.
- Behavioural tests assert expansion and difficulty ordering only (reduced sample by default; `MOO_LONG=1` for 6×5×150).

## Needed from other owners
1. `js/ai/designs.js`: set `E.ai.p2Done = true` at its first run (only used by the `colonyDesignIndex` quirk); give the colony design Reserve Fuel Tanks once Construction TL > 5 (research/07 §8.2) — without tanks range-2 planets are unreachable for colony ships (seen in soaks: AIs idle with 4+ colony ships when only range-2 planets are free).
2. `js/sim/turn.js` founding consumes `slots[0]` (lowest slot); the original consumes the design with the LOWEST threshold — pass the best slot (`Fleet.colonyShips` order or min `colonyMin`).
3. `js/sim/setup.js` (research/07 §11.3): p2 countdown `R.int(1,10)`, neighbour test `n > 0` (home counted).
4. Soak/UI: nothing needed; `ctx.shared` contract is in the `intel.js` header.

## Next steps
Run `node tools/soak.js --matrix --games 12` once designs/economy land and compare expansion per race × difficulty; tune nothing in the planners without a spec reference (all numbers are from research/07).
