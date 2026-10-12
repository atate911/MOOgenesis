// Global rule constants (research/04, 05, 07, 08). One place to tune/verify. Worker-safe.
MOO.def(function (M) {
  'use strict';
  M.Data.Config = {
    DIFFICULTIES: ['simple', 'easy', 'average', 'hard', 'impossible'],
    START_YEAR: 2300,                        // internal year starts at 1 → displayed year = START_YEAR - 1 + year
    START_POP: [50, 50, 50, 40, 40],         // homeworld population by difficulty (Hard/Impossible start smaller)
    START_FACTORIES: 30,
    START_SCOUTS: 2, START_COLONY_SHIPS: 1,
    MAX_POP: 300, MAX_FACTORIES: 2700,
    // AI production multiplier (percent) by difficulty index — how AI empires "cheat" or are handicapped.
    //   '1oom'  : the shipped executable's behaviour (Simple 100 is an original oddity: larger than Easy)
    //   'guide' : the strategy-guide table (−20 / −10 / 0 / +25 / +50) — monotonic. Default follows the verified code; see research/07.
    AI_PROD: { '1oom': [100, 80, 125, 150, 200], guide: [80, 90, 100, 125, 150] },
    aiProdMode: '1oom',
    aiProdFactor(diffIdx) { return M.Data.Config.AI_PROD[M.Data.Config.aiProdMode][diffIdx | 0] / 100; },
    displayYear: S => M.Data.Config.START_YEAR - 1 + S.year,
    // council: first when ≥ 2/3 of stars are colonised, then every 25 years
    COUNCIL_EVERY: 25, COUNCIL_COLONISED_FRACTION: 2 / 3,
    // random events: chance each year = max(0, year - lastEventYear) / 512 scaled by difficulty (research/04 §3.13)
    EVENT_ROLL: 512, EVENT_FIRST_YEAR: 40,
    EVENT_DIFF_SCALE: [[1, 2], [2, 3], [3, 4], [4, 5], [1, 1]],
    SHIP_UPKEEP_DIV: 50,                     // 2% of design cost per ship per turn
    STARGATE_COST: 3000, STARGATE_UPKEEP: 100,
    SCRAP_REFUND: 0.25,
    // Original-executable (1oom v1.3) economy quirks.  true = the shipped behaviour, false = the intended/fixed rule.  Read as `QUIRKS && QUIRKS.x` so an absent table
    // or key means the default below.  See tools/handoff/verification-fixes.md for the decision on each.
    //   popTenthsTwice  (research/04 C7)  default ON  - the carried population tenths are added twice (small colonies grow ~2x faster)
    //   hiddenChildLabor(research/04 C5)  default ON  - production is recomputed once more before defence/ships/industry
    //   wasteSub1       (research/04 C8)  default OFF - second waste term (~+20 % waste at oper 2), added after the cleanup cost is computed
    //   shipBonusBC     (research/04 C9)  default OFF - +1 BC for every planet whose SHIP slider is > 0
    //   soilRounding    (research/04 2.3) default OFF - the 1oom soil-enrichment increment rounding (Fertile m/20, Gaia m/10) instead of 'round up to 5'
    QUIRKS: { popTenthsTwice: true, hiddenChildLabor: true, wasteSub1: false, shipBonusBC: false, soilRounding: false },
  };
});
