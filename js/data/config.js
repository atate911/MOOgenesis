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
    // Original-executable (1oom v1.3 "classic") economy quirks, research/04-verification C4/C7/C8/C9/B8/B9/C10. Selectable per key; code reads them as
    //   Q.x === true  (opt-in quirks)   or   Q.x !== false  (quirks that are ON by default), so a partial replacement object in a test keeps working.
    //   popTenthsTwice  ON  : the carried population tenths are added twice (colony.growPop)                                    [C7]
    //   hiddenChildLabor ON : production is recomputed a second time before defence/ships/industry (turn.js)                       [C5]
    //   transportBC     ON  : an outgoing transport costs 1 BC per pop of its planet's output at processing time (Strategy Guide). false = 1oom, which clears
    //                         trans_num BEFORE the first production update, so nothing is ever deducted (research/04 row 33 / C10: the sources disagree)
    //   wasteSub1       off : second waste term +floor((100-waste%)*floor(operating*oper/10)/100), added after the cleanup need is computed (~+20 % waste) [C8]
    //   shipBonusBC     off : +1 BC whenever the SHIP slider is > 0 (a known original bug)                                         [C9]
    //   soilRounding    off : soil enrichment increment (m/20)*5 + ((m/20)%5 ? 5:0) and Gaia (m/10)*5 + ((m/10)%5 ? 5:0) (integer division) instead of
    //                         "+25 % / +50 % rounded UP to a multiple of 5"                                                         [B8]
    //   factoryRefit    off : classic factory billing: a planet whose new factories would exceed pop*tier pays a flat refit (oper-tier-Meklar2)*floor(factoryBase/2),
    //                         and factories beyond the maximum go to the reserve at floor(excess*cost/2) while the remaining BC stay in the build accumulator [B9]
    // Defaults keep the remake's tuned numbers; flip a key to reproduce the shipped game.
    QUIRKS: { popTenthsTwice: true, hiddenChildLabor: true, transportBC: true, wasteSub1: false, shipBonusBC: false, soilRounding: false, factoryRefit: false },
    quirk(name) { const Q = M.Data.Config.QUIRKS; return !!(Q && Q[name] === true); },       // opt-in quirk enabled?
  };
});
