// Balance audit decisions (tools/balance/REPORT.md): every AI / sim quirk flag has a pinned default, `options.aiClassic` flips every AI quirk to the original,
// the documented "Easy < Simple" production oddity is kept, and the AI first-tech cost fix is on by default.
module.exports = function (M, t) {
  const AI = M.AI, Cfg = M.Data.Config;
  // true = the original v1.3 behaviour is the default ("kept quirk"), false = fixed by default.  Changing a default must be a conscious edit here AND in tools/balance/REPORT.md.
  const AI_DEFAULTS = {
    designExcludeNewest: true, designScrapCounter: false, panicCountsAllies: false, transOwnRebelSource: false, transOwnOverwrite: false,
    fourthColonyShip: false, colonyDesignIndex: false, staleColonyOrbit: false, colonyRangeCap: false,
    sliderOverspend: false, fleetCheatBug: false, ecoWeightIsIndustry: true, silicoidEcoRatchet: true, researchSwap78: false,
    attackPhaseBDead: true, attackDesignBound: false, targetSortEarlyStop: false, transFromRebellion: false, threatCountsAllies: false, threat16: false, transNoWarRequired: true,
    spyCeasefireIndex: false,
  };
  const SIM_DEFAULTS = { popTenthsTwice: true, hiddenChildLabor: true, wasteSub1: false, shipBonusBC: false, soilRounding: false, aiFirstTechCost: false };

  t.test('balance: AI.QUIRKS defaults are exactly the audited decisions (and no unreviewed flag exists)', () => {
    t.deep(Object.keys(AI.QUIRKS).sort(), Object.keys(AI_DEFAULTS).sort(), 'a new AI quirk needs a decision in tools/balance/REPORT.md');
    for (const k in AI_DEFAULTS) t.eq(AI.QUIRKS[k], AI_DEFAULTS[k], k);
  });
  t.test('balance: Data.Config.QUIRKS defaults are exactly the audited decisions', () => {
    t.deep(Object.keys(Cfg.QUIRKS).sort(), Object.keys(SIM_DEFAULTS).sort());
    for (const k in SIM_DEFAULTS) t.eq(Cfg.QUIRKS[k], SIM_DEFAULTS[k], k);
  });
  t.test('balance: options.aiClassic makes ctx.quirk() true for every registered AI quirk; without it ctx.quirk follows the table', () => {
    const mk = classic => M.Sim.Setup.create({ size: 'small', difficulty: 'average', opponents: 2, race: 'human', seed: 'bal-classic', playerAI: true, options: classic ? { aiClassic: true } : {} });
    const S1 = mk(true), S0 = mk(false), c1 = AI.ctx(S1, 1, 0), c0 = AI.ctx(S0, 1, 0);
    for (const k in AI_DEFAULTS) { t.eq(c1.quirk(k), true, 'classic ' + k); t.eq(c0.quirk(k), AI_DEFAULTS[k], 'default ' + k); }
  });
  t.test('balance: Easy < Simple is kept (AI production x1.0 / 0.8 / 1.25 / 1.5 / 2.0); the monotonic strategy-guide table stays available', () => {
    t.eq(Cfg.aiProdMode, '1oom');
    t.deep([0, 1, 2, 3, 4].map(d => Cfg.aiProdFactor(d)), [1, 0.8, 1.25, 1.5, 2]);
    t.ok(Cfg.aiProdFactor(1) < Cfg.aiProdFactor(0), 'documented original oddity');
    const g = Cfg.AI_PROD.guide; for (let i = 1; i < 5; i++) t.ok(g[i] > g[i - 1], 'guide table is monotonic');
  });
  t.test('balance: the difficulty ladder for AI research cost stays factor 20 (AI) vs 20/25/30/35/40 (human)', () => {
    const T = M.Data.Techs;
    const a = T.costAI(10, 'human', 0);
    [20, 25, 30, 35, 40].forEach((f, d) => t.eq(T.costHuman(10, 'human', 0, d), Math.floor(a * f / 20), 'difficulty ' + d));
    t.ok(T.costHuman(10, 'human', 0, 4) === 2 * T.costAI(10, 'human', 0), 'impossible human pays twice the AI per tech');
  });
};
