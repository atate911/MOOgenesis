// Diplomacy engine (js/sim/diplo.js) against research/05 §2–§4, research/01 §1.4/§5, research/08 §3, §7–§9, §13, §17.
// Fixtures are synthetic (a line of empires with 2 stars each) so the tests do not depend on galaxy generation; Research.init gives real tech trees.
module.exports = function (M, t) {
  const D = M.Sim.Diplo, T = D.T, Geo = M.Sim.Geo;
  const RACES = ['human', 'mrrshan', 'silicoid', 'sakkra', 'psilon', 'alkari', 'klackon', 'bulrathi', 'meklar', 'darlok'];
  const XENO = 0, RUTH = 1, AGGR = 2, ERR = 3, HONOR = 4, PACI = 5;
  const MIL = 1, EXP = 2;
  const MAT = [[0, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1, 0, 0, -2, 0, -3, -1, -1, 0, -1], [1, 0, 0, 0, 0, 0, -1, 0, 1, -1], [1, -2, 0, 0, 0, -1, -1, 0, -1, -1], [1, 0, 0, 0, 0, 0, 0, 0, 0, -1],
    [1, -3, 0, -1, 0, 0, -1, 0, 0, -1], [1, -1, -1, -1, 0, -1, 0, 0, 0, -1], [1, -1, 0, 0, 0, 0, 0, 0, 0, -1], [1, 0, 1, -1, 0, 0, 0, 0, 0, -1], [1, -1, -1, -1, -1, -1, -1, -1, -1, 1]];

  // ── fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // n empires on a line, 2 stars each. opts: races, pers[], obj[], diff, year, turn, gap (map units between empires), fuel, prod, humans (ids), allAI, seed
  function mk(o) {
    o = o || {};
    const races = o.races || ['human', 'mrrshan', 'psilon', 'darlok'], n = races.length;
    const S = { v: 1, seed: o.seed || 't', rs: M.RNG.seedState(o.seed || 't'), turn: o.turn || 0, year: o.year || 50,
      settings: { size: o.size || 'medium', difficulty: 'average', diffIdx: o.diff === undefined ? 2 : o.diff, playerAI: !!o.allAI }, playerId: 0, stars: [], planets: [], empires: [], fleets: [], trans: [], ev: [], nextId: 1 };
    const gap = o.gap === undefined ? 30 : o.gap, humans = o.humans || (o.allAI ? [] : [0]);
    for (let e = 0; e < n; e++) for (let k = 0; k < 2; k++) { const id = e * 2 + k; S.stars.push({ id, name: 'S' + id, x: e * gap + k * 11, y: 0 }); }
    for (let id = 0; id < n * 2; id++) S.planets.push({ id, starId: id, owner: id % 2 === 0 ? Math.floor(id / 2) : (o.twoPlanets === false ? -1 : Math.floor(id / 2)), pop: 40, gross: (o.prod && o.prod[Math.floor(id / 2)]) || 100, spendable: (o.prod && o.prod[Math.floor(id / 2)]) || 100, factories: 30 });
    const R = M.RNG.bind(S.rs);
    for (let e = 0; e < n; e++) {
      const E = { id: e, race: races[e], name: races[e], plural: races[e] + 's', leader: 'L' + e, human: humans.indexOf(e) >= 0, alive: true, personality: o.pers ? o.pers[e] : ERR, objective: o.obj ? o.obj[e] : 0, bc: o.bc === undefined ? 500 : o.bc,
        mods: { fuel: o.fuel || 3 }, designs: [{ hull: 0 }, { hull: 1 }, { hull: 2 }, { hull: 3 }, null, null], flow: {}, spyMode: [0, 0, 0, 0, 0, 0], spyBudget: [0, 0, 0, 0, 0, 0], spies: [0, 0, 0, 0, 0, 0], relations: [] };
      M.Sim.Research.init(S, E, R); E.mods.fuel = o.fuel || 3;
      S.empires.push(E);
    }
    D.init(S);
    return S;
  }
  const rel = (S, a, b) => S.empires[a].relations[b];
  function setAll(S, a, b, o) { for (const [x, y] of [[a, b], [b, a]]) Object.assign(rel(S, x, y), o); }
  function contactAll(S) { for (const E of S.empires) E.mods.fuel = 99; D.updateContact(S, true); }
  // scripted RNG: consumes `seq` first, then answers with the largest allowed value (so every "1-in-N" gate stays closed); records the calls
  function fakeR(seq) { let i = 0; const r = { calls: [], int(lo, hi) { const v = i < seq.length ? seq[i++] : hi; r.calls.push([lo, hi]); return Math.max(lo, Math.min(hi, v)); }, dice(n, s) { let q = 0; for (let k = 0; k < n; k++) q += r.int(1, s); return q; }, next() { return 0.5; }, left: () => seq.length - i }; return r; }
  function withRng(R, fn) { const orig = M.RNG.bind; M.RNG.bind = () => R; try { return fn(); } finally { M.RNG.bind = orig; } }
  const real = seed => M.RNG.create(seed || 'mc');
  const techOf = (f, l) => M.Data.Techs.byFL[f][l];
  const grant = (S, e, f, l) => M.Sim.Research.grant(S, S.empires[e], f, l, 'test');
  // a few real researchable levels (existing techs) of a field
  function levelsOf(f, min, k) { const out = []; for (let l = min; l <= 50 && out.length < k; l++) if (techOf(f, l) && !techOf(f, l).never) out.push(l); return out; }
  const diploEvents = (S, cat) => (S.ev || []).filter(e => e.type === 'news' && e.cat === cat);

  // ══════════════════════════════════════ ladder, starting relations, records ═════════════════════════════════════════════════════
  t.test('relation ladder: 17 labels, 12 DP wide, truncating division (research/01 §1.4)', () => {
    const want = { 100: 'HARMONY', 96: 'HARMONY', 95: 'UNITY', 84: 'UNITY', 83: 'FRIENDLY', 72: 'FRIENDLY', 71: 'PEACEFUL', 60: 'PEACEFUL', 59: 'AFFABLE', 48: 'AFFABLE', 47: 'CALM', 36: 'CALM', 35: 'AMIABLE', 24: 'AMIABLE',
      23: 'RELAXED', 12: 'RELAXED', 11: 'NEUTRAL', 0: 'NEUTRAL', '-11': 'NEUTRAL', '-12': 'UNEASE', '-23': 'UNEASE', '-24': 'WARY', '-35': 'WARY', '-36': 'RESTLESS', '-47': 'RESTLESS', '-48': 'TENSE', '-59': 'TENSE',
      '-60': 'TROUBLED', '-71': 'TROUBLED', '-72': 'DISCORD', '-83': 'DISCORD', '-84': 'HATE', '-95': 'HATE', '-96': 'FEUD', '-100': 'FEUD' };
    for (const k in want) t.eq(D.label(+k).name, want[k], 'rel ' + k);
    t.eq(D.LABELS.length, 17); t.eq(D.label(0).index, 8);
  });
  t.test('starting relations = racial matrix x 12 for all 90 ordered pairs; rel2 = rel1; moods and trust start at 0', () => {
    const S = mk({ races: RACES });
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) {
      const r = rel(S, a, b);
      t.eq(r.rel1, a === b ? 0 : MAT[a][b] * 12, RACES[a] + '->' + RACES[b]);
      t.eq(r.rel2, r.rel1); t.eq(r.attitude, r.rel1); t.eq(r.treaty, T.NONE); t.eq(r.trust, 0);
      t.deep([r.moodTreaty, r.moodTrade, r.moodTech, r.moodPeace], [0, 0, 0, 0]);
    }
    t.eq(rel(S, 1, 5).rel1, -36); t.eq(rel(S, 5, 1).rel1, -36); t.eq(rel(S, 1, 3).rel1, -24); t.eq(rel(S, 9, 0).rel1, 12); t.eq(rel(S, 9, 4).rel1, -12); t.eq(rel(S, 2, 8).rel1, 12);
  });
  t.test('Data.Races.RELATIONS (when present) agrees with the matrix used by the engine', () => {
    const RD = M.Data.Races; if (!RD || !RD.RELATIONS) t.skip('no races data');
    for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) if (a !== b) t.eq(RD.RELATIONS[a][b], MAT[a][b] * 12, RACES[a] + '/' + RACES[b]);
  });
  t.test('relation records are mirrored and JSON-safe; symmetric setters keep attitude in sync', () => {
    const S = mk(); D.setRel(S, 0, 1, 55);
    t.eq(rel(S, 0, 1).rel1, 55); t.eq(rel(S, 1, 0).rel1, 55); t.eq(rel(S, 1, 0).attitude, 55);
    D.setRel(S, 0, 1, 250); t.eq(rel(S, 0, 1).rel1, 100); D.setRel(S, 0, 1, -250); t.eq(rel(S, 1, 0).rel1, -100);
    t.deep(JSON.parse(JSON.stringify(S.diplo)), S.diplo); t.deep(JSON.parse(JSON.stringify(S.empires[0].relations)), S.empires[0].relations);
  });
  t.test('personality offsets reldiff = {-50,-30,-20,0,+10,+20}', () => { t.deep(D.RELDIFF, [-50, -30, -20, 0, 10, 20]); });

  // ══════════════════════════════════════ diplo_act: the DP engine (research/05 §4.2.1) ═══════════════════════════════════════════
  // actor 2 (psilon, AI, not Human race), target 1 (Erratic AI → no personality scaling). D.act(S,dv,actor,target,dtype)
  function actCase(R0, dv, o) {
    o = o || {};
    const S = mk({ races: [o.actorRace || 'human', 'mrrshan', 'psilon', 'darlok'], pers: [ERR, o.targetPers === undefined ? ERR : o.targetPers, ERR, ERR], humans: o.actorHuman ? [0] : [], year: o.year || 50, diff: o.diff === undefined ? 2 : o.diff });
    const actor = o.actorHuman ? 0 : (o.actor === undefined ? 2 : o.actor);
    setAll(S, actor, 1, { rel1: R0, attitude: R0, treaty: o.treaty || 0 });
    const applied = D.act(S, dv, actor, 1, o.dtype || 0);
    return { S, applied, rel: rel(S, 1, actor).rel1, actor };
  }
  t.test('act: positive acts are divided by (rel/25 + 1) for rel >= 0', () => {
    t.eq(actCase(0, 10).rel, 10); t.eq(actCase(24, 10).rel, 34); t.eq(actCase(25, 10).rel, 30); t.eq(actCase(49, 10).rel, 49 + 5); t.eq(actCase(50, 10).rel, 53);
    const al = (R0, dv) => actCase(R0, dv, { treaty: T.ALLIANCE }).rel;                          // allies are not capped at +65, so the divisor shows
    t.eq(al(74, 10), 74 + 3); t.eq(al(75, 10), 77); t.eq(al(99, 10), 101 > 100 ? 100 : 101); t.eq(al(100, 10), 100); t.eq(al(90, 10), 92);
    t.eq(actCase(64, 10).rel, 65, 'non-allies stop at +65');
  });
  t.test('act: positive acts on a bad relation are doubled and never lift it above +10', () => {
    t.eq(actCase(-30, 10).rel, -10); t.eq(actCase(-5, 10).rel, 10); t.eq(actCase(-100, 5).rel, -90); t.eq(actCase(-1, 6).rel, 10);
  });
  t.test('act: negative acts are doubled on a good relation and divided by (-rel/25 + 1) on a bad one', () => {
    t.eq(actCase(10, -10).rel, -10); t.eq(actCase(0, -10).rel, -10); t.eq(actCase(-25, -10).rel, -30); t.eq(actCase(-50, -10).rel, -53); t.eq(actCase(-74, -12).rel, -74 - 4); t.eq(actCase(-100, -10).rel, -100);
  });
  t.test('act: Honorable targets feel losses twice as hard; Xenophobic x3/2 losses and x3/4 gains (truncating)', () => {
    t.eq(actCase(0, -10, { targetPers: HONOR }).rel, -20); t.eq(actCase(0, 10, { targetPers: HONOR }).rel, 10);
    t.eq(actCase(0, -10, { targetPers: XENO }).rel, -15); t.eq(actCase(0, 10, { targetPers: XENO }).rel, 7); t.eq(actCase(0, -3, { targetPers: XENO }).rel, -4);
    t.eq(actCase(10, -10, { targetPers: HONOR }).rel, 10 - 40);                                  // doubled by the good relation, then doubled again
    t.eq(actCase(0, -10, { targetPers: AGGR }).rel, -10); t.eq(actCase(0, -10, { targetPers: PACI }).rel, -10);
  });
  t.test('act: an actor of the Human race doubles POSITIVE acts only', () => {
    t.eq(actCase(0, 10, { actorHuman: true }).rel, 20); t.eq(actCase(25, 10, { actorHuman: true }).rel, 25 + 10); t.eq(actCase(0, -10, { actorHuman: true }).rel, -10);
    t.eq(actCase(0, 10, { actorRace: 'klackon', actorHuman: true }).rel, 10);
    t.eq(actCase(0, 10, { actor: 3 }).rel, 10);
  });
  t.test('act: hard limits — at war the bar is lifted to -25; only allies can exceed +65; a human target never reacts', () => {
    t.eq(actCase(-90, -5, { treaty: T.WAR }).rel, -25); t.eq(actCase(-90, 5, { treaty: T.WAR }).rel, -25);
    t.eq(actCase(60, 20).rel, 65); t.eq(actCase(60, 20, { treaty: T.ALLIANCE }).rel, 60 + 6);
    const S = mk(); setAll(S, 0, 1, { rel1: 5 }); t.eq(D.act(S, -50, 1, 0, 9), 0); t.eq(rel(S, 0, 1).rel1, 5);
    t.eq(D.act(S, 0, 0, 1, 0), 0); t.eq(D.act(S, 5, 1, 1, 0), 0);
  });
  t.test('act: moods follow the DP (AI copy wins), the peace mood takes a quarter; the human actor records the biggest act of the turn', () => {
    const S = mk({ races: ['klackon', 'mrrshan', 'psilon', 'darlok'] }); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100, moodTrade: 90, moodTech: 80, moodPeace: 70 });
    rel(S, 0, 1).moodTreaty = 11;                                                               // the human's own (penalised) copy is overwritten by the AI's copy
    t.eq(D.act(S, -10, 0, 1, 9, 7), -10);
    const ai = rel(S, 1, 0), hu = rel(S, 0, 1);
    t.eq(ai.moodTreaty, 90); t.eq(hu.moodTreaty, 90); t.eq(ai.moodTrade, 80); t.eq(hu.moodTrade, 80); t.eq(ai.moodTech, 70);
    t.eq(ai.moodPeace, 70 + (-2)); t.eq(hu.moodPeace, 70 + 2);                                   // v1 = -10: target -2 (trunc(-10/4)), actor +2
    t.deep([hu.dipVal, hu.dipType, hu.dipP1], [-10, 9, 7]);
    D.act(S, -4, 0, 1, 10, 3); t.eq(hu.dipVal, -10, 'a smaller act does not replace it');
    D.act(S, -30, 0, 1, 10, 4); t.deep([hu.dipVal, hu.dipType, hu.dipP1], [-30, 10, 4]);
  });
  t.test('act: at war, offence messages 4..12 do not move relations — only the peace mood (human actor)', () => {
    const S = mk({ races: ['klackon', 'mrrshan', 'psilon', 'darlok'] }); setAll(S, 0, 1, { rel1: -40, treaty: T.WAR, moodPeace: 0 });
    t.eq(D.act(S, -20, 0, 1, 9), 0); t.eq(rel(S, 1, 0).rel1, -25, 'floored to -25 by the war rule');
    t.eq(rel(S, 1, 0).moodPeace, -2, 'dv scaled to -10, a quarter = -2'); t.eq(rel(S, 0, 1).moodPeace, 2); t.eq(rel(S, 0, 1).dipVal, 0, 'nothing recorded');
    D.setRel(S, 0, 1, -50); t.eq(D.act(S, -20, 0, 1, 13), -6); t.eq(rel(S, 0, 1).dipVal, -6, 'type 13 is outside 4..12 and counts');
  });
  t.test('act: AI↔AI acts after year 100 — positives x2, negatives divided by (difficulty/2 + 1)', () => {
    for (const [diff, div] of [[0, 1], [1, 1], [2, 2], [3, 2], [4, 3]]) {
      const a = actCase(0, -12, { year: 101, diff }); t.eq(a.rel, Math.trunc(-12 / div), 'diff ' + diff);
    }
    t.eq(actCase(0, 5, { year: 101 }).rel, 10); t.eq(actCase(0, 5, { year: 100 }).rel, 5); t.eq(actCase(0, -12, { year: 100, diff: 4 }).rel, -12);
  });
  t.test('act: nothing happens during a Final War', () => { const S = mk(); S.diplo.finalWar = true; t.eq(D.act(S, 10, 2, 1, 0), 0); });

  // ══════════════════════════════════════ treaty / war primitives (research/05 §4.2.2) ═══════════════════════════════════════════════
  t.test('start_war: rel1 -(75+d25), rel2 -5 both sides, treaty WAR, moods -200 (peace -130), trade ends, an old treaty is broken first', () => {
    let min = 0, max = -100;
    for (let i = 0; i < 200; i++) {
      const S = mk({ seed: 'w' + i }); setAll(S, 1, 2, { treaty: T.NAP, trade: 100, tradePct: 40, tradeEst: 100, rel2: 7, moodPeace: 50 });
      t.ok(D.startWar(S, 1, 2, 'x'));
      const r = rel(S, 1, 2), q = rel(S, 2, 1);
      min = Math.min(min, r.rel1); max = Math.max(max, r.rel1);
      t.eq(r.rel1, q.rel1); t.eq(r.treaty, T.WAR); t.eq(q.treaty, T.WAR); t.eq(r.rel2, 2); t.eq(q.rel2, 2); t.eq(r.trade, 0); t.eq(r.tradePct, 0);
      t.deep([r.moodTreaty, r.moodTrade, r.moodTech, r.moodPeace], [-200, -200, -200, -130]); t.deep([q.moodTreaty, q.moodTrade, q.moodTech, q.moodPeace], [-200, -200, -200, -130]);
    }
    t.eq(min, -100); t.eq(max, -76);
    const S = mk(); t.ok(D.startWar(S, 1, 2)); t.eq(D.startWar(S, 1, 2), false, 'no-op when already at war'); t.eq(D.startWar(S, 2, 1), false);
  });
  t.test('start_war announces itself as news; breaking an alliance on the way adds allianceBroken', () => {
    const S = mk(); setAll(S, 1, 2, { treaty: T.ALLIANCE }); D.startWar(S, 1, 2);
    t.eq(diploEvents(S, 'warDeclared').length, 1); t.eq(diploEvents(S, 'allianceBroken').length, 1); t.eq(diploEvents(S, 'warDeclared')[0].empire, 1); t.eq(diploEvents(S, 'warDeclared')[0].empire2, 2);
  });
  t.test('stop_war: treaty None, rel1 +40 (cap 100), cease-fire 8..13 turns when a human is involved (none between AIs)', () => {
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const S = mk({ seed: 's' + i }); D.startWar(S, 1, 0); setAll(S, 0, 1, { rel1: -30 });
      t.ok(D.stopWar(S, 0, 1)); t.eq(rel(S, 0, 1).rel1, 10); t.eq(rel(S, 0, 1).treaty, T.NONE); const c = D.ceasefire(S, 0, 1); t.between(c, 8, 13); seen.add(c);
    }
    t.eq(seen.size, 6);
    const S = mk(); D.startWar(S, 1, 2); setAll(S, 1, 2, { rel1: 80 }); D.stopWar(S, 1, 2); t.eq(rel(S, 1, 2).rel1, 100); t.eq(D.ceasefire(S, 1, 2), 0);
    t.eq(D.stopWar(S, 1, 2), false);
  });
  t.test('break_treaty (v1.3 default): the breaker\'s trust RISES 10 (NAP) / 20 (alliance), x2 for an Honorable breaker; an alliance break also raises rel2 by the same', () => {
    const run = (treaty, pers) => { const S = mk({ pers: [ERR, ERR, pers, ERR] }); setAll(S, 2, 1, { treaty, rel1: 50, rel2: 40 }); D.breakTreaty(S, 2, 1); return { S, r: rel(S, 2, 1), v: rel(S, 1, 2) }; };
    t.eq(run(T.NAP, ERR).r.trust, 10); t.eq(run(T.ALLIANCE, ERR).r.trust, 20); t.eq(run(T.NAP, HONOR).r.trust, 20); t.eq(run(T.ALLIANCE, HONOR).r.trust, 40);
    t.eq(run(T.NAP, ERR).r.rel2, 40, 'rel2 untouched for a NAP'); t.eq(run(T.ALLIANCE, ERR).r.rel2, 60); t.eq(run(T.ALLIANCE, ERR).v.rel2, 60); t.eq(run(T.ALLIANCE, HONOR).r.rel2, 80);
  });
  t.test('break_treaty (CFG.classicTrustBug = false): trust and rel2 FALL by 10/20 (x2 Honorable)', () => {
    D.CFG.classicTrustBug = false;
    try {
      const run = (treaty, pers) => { const S = mk({ pers: [ERR, ERR, pers, ERR] }); setAll(S, 2, 1, { treaty, rel1: 50, rel2: 40 }); D.breakTreaty(S, 2, 1); return rel(S, 2, 1); };
      t.eq(run(T.NAP, ERR).trust, -10); t.eq(run(T.ALLIANCE, HONOR).trust, -40); t.eq(run(T.ALLIANCE, ERR).rel2, 20); t.eq(run(T.ALLIANCE, HONOR).rel2, 0);
    } finally { D.CFG.classicTrustBug = true; }
  });
  t.test('break_treaty: rel1 drops 1..20, treaty None, remembered as broken (both records), all four moods -200 on both sides, news; no-op against an enemy', () => {
    const drops = new Set();
    for (let i = 0; i < 300; i++) {
      const S = mk({ seed: 'b' + i }); setAll(S, 2, 1, { treaty: T.NAP, rel1: 50, moodTreaty: 90 });
      t.ok(D.breakTreaty(S, 2, 1)); const r = rel(S, 2, 1), q = rel(S, 1, 2);
      drops.add(50 - r.rel1); t.eq(r.rel1, q.rel1); t.eq(r.treaty, T.NONE); t.eq(q.treaty, T.NONE); t.eq(r.broken, T.NAP); t.eq(q.broken, T.NAP);
      for (const k of ['moodTreaty', 'moodTrade', 'moodTech', 'moodPeace']) { t.eq(r[k], -200); t.eq(q[k], -200); }
      t.eq(diploEvents(S, 'treatyBroken').length, 1); t.eq(diploEvents(S, 'treatyBroken')[0].treaty, 'non-aggression pact');
    }
    t.eq(Math.min(...drops), 1); t.eq(Math.max(...drops), 20);
    const S = mk(); setAll(S, 2, 1, { treaty: T.WAR }); t.eq(D.breakTreaty(S, 2, 1), false); t.eq(D.breakTreaty(mk(), 2, 1), false, 'nothing to break');
  });
  t.test('declareWar queues the war-declared message for a human victim (13 when disliked, 60 when not)', () => {
    let S = mk(); setAll(S, 0, 1, { rel1: -5 }); D.declareWar(S, 1, 0); t.eq(rel(S, 0, 1).dipType, 13);
    S = mk(); setAll(S, 0, 1, { rel1: 5 }); D.declareWar(S, 1, 0); t.eq(rel(S, 0, 1).dipType, 60);
    S = mk(); D.declareWar(S, 1, 2, 'x', 0); t.eq(rel(S, 2, 1).dipType, 0);
  });

  // ══════════════════════════════════════ trade (research/05 §4.4.4, research/04 §3.3) ═══════════════════════════════════════════
  t.test('trade levels: 25 % of the smaller economy, minimum gross 100 BC; headroom < 125 gives +25..+100, otherwise 5 steps of the headroom', () => {
    let S = mk({ prod: [200, 150, 100, 100] });                                                  // two planets each → gross 400 / 300 / 200 / 200
    t.eq(D.production(S, 0), 400); t.eq(D.production(S, 1), 300); t.deep(D.tradeLevels(S, 0, 1), [25, 50, 75]);
    S = mk({ prod: [500, 400, 100, 100] }); t.eq(D.production(S, 1), 800); t.deep(D.tradeLevels(S, 0, 1), [25, 75, 100, 150, 200]);
    setAll(S, 0, 1, { trade: 100 }); t.deep(D.tradeLevels(S, 0, 1), [125, 150, 175, 200]);
    setAll(S, 0, 1, { trade: 200 }); t.deep(D.tradeLevels(S, 0, 1), []);
    S = mk({ prod: [500, 400, 100, 100] }); S.planets[0].gross = 99; S.planets[1].gross = 0; t.deep(D.tradeLevels(S, 0, 1), [], '99 BC: nothing');
    S.planets[0].gross = 100; t.deep(D.tradeLevels(S, 0, 1), [25]); S.planets[0].gross = 200; t.deep(D.tradeLevels(S, 0, 1), [25, 50]);
  });
  t.test('set_trade blends efficiency: a new deal starts at -30 %, a larger one dilutes the old percentage with the new volume at -30 %', () => {
    const S = mk(); D.setTrade(S, 0, 1, 100); t.eq(rel(S, 0, 1).tradePct, -30); t.eq(rel(S, 1, 0).tradePct, -30); t.eq(rel(S, 0, 1).trade, 100); t.eq(rel(S, 0, 1).tradeEst, 100);
    setAll(S, 0, 1, { tradePct: 60 }); D.setTrade(S, 0, 1, 200); t.eq(rel(S, 0, 1).tradePct, 0);                // (60*100 - 200*30)/300
    setAll(S, 0, 1, { tradePct: 90 }); D.setTrade(S, 0, 1, 100); t.eq(rel(S, 0, 1).tradePct, 90, 'a smaller volume leaves the efficiency alone');
    setAll(S, 0, 1, { trade: 0, tradeEst: 0, tradePct: 0 }); D.setTrade(S, 0, 1, 25); t.eq(rel(S, 0, 1).tradePct, -30);
  });
  t.test('trade income = bc x (percent + 25 for Humans)/100 per partner; needs contact; the negative start-up efficiency costs money; war ends it', () => {
    const S = mk(); contactAll(S);
    setAll(S, 0, 1, { trade: 100, tradePct: -30 }); t.eq(D.tradeIncome(S, S.empires[0]), -5, 'Human: -30+25'); t.eq(D.tradeIncome(S, S.empires[1]), -30);
    setAll(S, 0, 1, { tradePct: 100 }); t.eq(D.tradeIncome(S, S.empires[0]), 125); t.eq(D.tradeIncome(S, S.empires[1]), 100);
    setAll(S, 0, 2, { trade: 50, tradePct: 40 }); t.eq(D.tradeIncome(S, S.empires[1]), 100, 'partner 2 unaffected'); t.eq(D.tradeIncome(S, 0), 125 + 32);
    setAll(S, 0, 1, { treaty: T.WAR }); t.eq(D.tradeIncome(S, 0), 32); setAll(S, 0, 1, { treaty: T.NONE, contact: false }); t.eq(D.tradeIncome(S, 0), 32);
    t.eq(D.status(S, 0, 2).trade.income, 32); t.eq(D.status(S, 0, 2).trade.bc, 50);
  });
  t.test('trade efficiency grows by floor((d200 + rel1 + 25)/60) per turn (0..3 at neutral relations, mean 1.59) and stops at 100', () => {
    const S = mk(); contactAll(S); setAll(S, 0, 1, { trade: 100, tradePct: 0 }); const R = real('tg'); let sum = 0, mx = 0, mn = 9; const N = 3000;
    for (let i = 0; i < N; i++) { setAll(S, 0, 1, { tradePct: 0, rel1: 0 }); D.economyTurn(S, R); const g = rel(S, 0, 1).tradePct; sum += g; mx = Math.max(mx, g); mn = Math.min(mn, g); }
    t.eq(mn >= 0, true); t.eq(mx, 3); t.near(sum / N, 1.59, 0.1, 'mean growth');
    setAll(S, 0, 1, { tradePct: 99, rel1: 65 }); for (let i = 0; i < 30; i++) D.economyTurn(S, R); t.eq(rel(S, 0, 1).tradePct, 100); t.eq(rel(S, 1, 0).tradePct, 100);
    setAll(S, 0, 1, { tradePct: 10, rel1: -100 }); D.economyTurn(S, fakeR([30])); t.eq(rel(S, 0, 1).tradePct, 10, 'a negative gain adds nothing');
    setAll(S, 0, 1, { tradePct: 10, rel1: -100 }); D.economyTurn(S, fakeR([200])); t.eq(rel(S, 0, 1).tradePct, 12, 'even the worst relations still grow a little');
    setAll(S, 0, 1, { tradePct: 10, rel1: 100 }); D.economyTurn(S, fakeR([200])); t.eq(rel(S, 0, 1).tradePct, 15, 'harmony: up to +5');
  });
  t.test('trade needs contact: losing it (or a dead partner) zeroes the agreement on both sides', () => {
    const S = mk({ gap: 100 }); setAll(S, 0, 1, { trade: 100, tradePct: 50, tradeEst: 100, contact: true }); D.updateContact(S, true);
    t.eq(rel(S, 0, 1).trade, 0); t.eq(rel(S, 1, 0).trade, 0); t.eq(rel(S, 0, 1).tradePct, 0); t.eq(rel(S, 0, 1).contact, false);
    setAll(S, 0, 1, { trade: 100, tradePct: 50, contact: false }); D.economyTurn(S, fakeR([])); t.eq(rel(S, 0, 1).trade, 0);
  });

  // first n researchable levels >= min of field f whose tech group is one of `groups` (so that group-obsolescence rules do not interfere)
  function levelsIn(f, min, n, groups) { const out = []; for (let l = min; l <= 50 && out.length < n; l++) { const x = techOf(f, l); if (x && !x.never && groups.indexOf(x.group) >= 0) out.push(l); } return out; }

  // ══════════════════════════════════════ the acceptance roll (research/05 §4.4.2, research/08 §7.6) ═══════════════════════════════
  // fixture: human 0 (race), AI 1 (personality), everybody in contact; moods 100, relation 0
  function accGame(o) {
    o = o || {};
    const S = mk({ races: [o.race || 'klackon', 'mrrshan', 'psilon', 'darlok'], pers: [ERR, o.pers === undefined ? ERR : o.pers, ERR, ERR], year: o.year || 50 });
    contactAll(S); for (const E of S.empires) for (const r of E.relations) r.met = 2;                      // greetings are tested separately
    setAll(S, 0, 1, Object.assign({ rel1: 0, rel2: 0, moodTreaty: 100, moodTrade: 100, moodTech: 100, moodPeace: 100, trust: 0 }, o.rel || {}));
    return S;
  }
  const moodsOf = (S, a, b) => { const r = rel(S, a, b); return [r.moodTreaty, r.moodTrade, r.moodTech, r.moodPeace]; };
  const ask = (S, d100, a0, kind, extra) => D._.checkMood(S, fakeR([d100].concat(extra || [1])), 0, 1, a0, kind || 'treaty');
  t.test('check_mood grading: v >= 0 accept · -50..-1 counter (BC) · -75..-51 counter (tech) · < -75 flat refusal', () => {
    const run = X => { const S = accGame({ rel: { moodTreaty: X } }); return ask(S, 1, 0); };            // v = X + 1
    t.eq(run(-77), 0); t.eq(run(-76), 1); t.eq(run(-52), 1); t.eq(run(-51), 2); t.eq(run(-2), 2); t.eq(run(-1), 3); t.eq(run(500), 3);
  });
  t.test('check_mood sums mood + trust + relation + 50 (Human player) + personality offset + d100 - a0 (+40 when allied)', () => {
    const edge = (mkS, a0, kind) => [ask(mkS(), 1, a0, kind), ask(mkS(), 1, a0 + 1, kind)];            // v = 0 at a0 (accept), -1 at a0+1 (counter)
    const hh = () => accGame({ race: 'human', pers: HONOR, rel: { rel1: 20 } });                          // 100 + 20 + 50 + 10 + d100(1) - a0 = 181 - a0
    t.deep(edge(hh, 181, 'treaty'), [3, 2]);
    for (const p of [XENO, RUTH, AGGR, ERR, HONOR, PACI]) t.deep(edge(() => accGame({ pers: p, rel: { rel1: 0 } }), 101 + D.RELDIFF[p], 'treaty'), [3, 2], 'personality ' + p);
    t.deep(edge(() => accGame({ rel: { rel1: 30, trust: 12 } }), 143, 'treaty'), [3, 2], 'trust and relation add');
    t.deep(edge(() => accGame({ rel: { rel1: 0, treaty: T.ALLIANCE } }), 141, 'treaty'), [3, 2], 'alliance +40');
    const kx = () => accGame({ race: 'klackon', pers: XENO, rel: { rel1: 60 } });                         // research example: v = d100 - 15 for an alliance
    t.eq(ask(kx(), 14, 125), 2); t.eq(ask(kx(), 15, 125), 3);
    const low = () => accGame({ rel: { moodTreaty: -50, moodTrade: -50, moodTech: -50, moodPeace: -50 } });
    for (const kind of ['treaty', 'trade', 'peace', 'tech']) { t.eq(ask(low(), 50, 0, kind), 3, kind + ' channel'); t.eq(ask(low(), 49, 0, kind), 2); }
    t.eq(ask(accGame({ rel: { moodTrade: -300 } }), 100, 0, 'treaty'), 3); t.eq(ask(accGame({ rel: { moodTrade: -300 } }), 100, 0, 'trade'), 0, 'only the asked channel counts');
  });
  t.test('every check costs -10 on all four moods plus the topic penalty: treaty/trade d30+20, peace d50+50, tech d50+20', () => {
    const run = (kind, p) => { const S = accGame(); ask(S, 50, 0, kind, [p]); return moodsOf(S, 0, 1); };
    t.deep(run('treaty', 5), [100 - 10 - 25, 90, 90, 90]); t.deep(run('trade', 30), [90, 100 - 10 - 50, 90, 90]); t.deep(run('peace', 7), [90, 90, 90, 100 - 10 - 57]); t.deep(run('tech', 50), [90, 90, 100 - 10 - 70, 90]);
    const S = accGame(); t.deep(moodsOf(S, 1, 0), [100, 100, 100, 100]); ask(S, 50, 0, 'treaty', [5]); t.deep(moodsOf(S, 1, 0), [100, 100, 100, 100], 'only the asker\'s record is annoyed');
  });

  // ══════════════════════════════════════ treaty proposals ═════════════════════════════════════════════════════════════════════
  t.test('NAP: relation must exceed +10, else a flat refusal that costs no mood; at +11 a calm AI signs (news + both records)', () => {
    let S = accGame({ pers: PACI, rel: { rel1: 10 } }); const before = moodsOf(S, 0, 1);
    let r = D.propose(S, 0, 1, { kind: 'nap' }); t.eq(r.accepted, false); t.eq(r.gate, true); t.deep(moodsOf(S, 0, 1), before); t.eq(rel(S, 0, 1).treaty, T.NONE);
    S = accGame({ pers: PACI, rel: { rel1: 11 } }); r = D.propose(S, 0, 1, { kind: 'nap' });
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).treaty, T.NAP); t.eq(rel(S, 1, 0).treaty, T.NAP); t.eq(diploEvents(S, 'napSigned').length, 1); t.eq(r.reply.situation, 'proposalAccepted'); t.eq(r.reply.personality, 'pacifistic');
    t.eq(D.propose(S, 0, 1, { kind: 'nap' }).ok, false, 'already have one');
  });
  t.test('Alliance: needs NAP or none and relation > 50; accepted at 51 with calm moods; lifts the +65 cap afterwards', () => {
    let S = accGame({ pers: PACI, rel: { rel1: 50 } }); t.eq(D.propose(S, 0, 1, { kind: 'alliance' }).gate, true);
    S = accGame({ pers: PACI, rel: { rel1: 51, treaty: T.NAP } }); const r = D.propose(S, 0, 1, { kind: 'alliance' });
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).treaty, T.ALLIANCE); t.eq(diploEvents(S, 'allianceFormed').length, 1);
    setAll(S, 0, 1, { rel1: 70 }); D.act(S, 60, 0, 1, 0, 0); t.eq(rel(S, 1, 0).rel1 >= 70, true, 'allies can pass +65');
    S = accGame({ pers: PACI, rel: { rel1: 80, treaty: T.WAR } }); t.eq(D.propose(S, 0, 1, { kind: 'alliance' }).ok, false);
  });
  t.test('a failed ask (v < -75) is a refusal in the AI\'s own voice; remembered offences replace the generic line 50 %, a broken treaty 25 %', () => {
    let S = accGame({ rel: { rel1: 20, moodTreaty: -200 } }); let r = withRng(fakeR([1, 1]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    t.eq(r.accepted, false); t.eq(r.result, 0); t.eq(r.reply.situation, 'proposalRejected'); t.eq(r.reply.msgType, 31);
    S = accGame({ rel: { rel1: 20, moodTreaty: -200, blunder: 9 } }); r = withRng(fakeR([1, 1, 0]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    t.eq(r.reply.msgType, 39); t.eq(r.reply.situation, 'proposalRejectedUntrust'); t.eq(rel(S, 0, 1).blunder, 0, 'cleared once used');
    S = accGame({ rel: { rel1: 20, moodTreaty: -200, blunder: 9 } }); r = withRng(fakeR([1, 1, 1]), () => D.propose(S, 0, 1, { kind: 'nap' })); t.eq(r.reply.msgType, 31, 'the 50 % roll failed');
    S = accGame({ rel: { rel1: 20, moodTreaty: -200, broken: T.NAP } }); r = withRng(fakeR([1, 1, 0]), () => D.propose(S, 0, 1, { kind: 'nap' })); t.eq(r.reply.msgType, 33); t.eq(rel(S, 0, 1).broken, 0);
  });
  t.test('counter-offer with BC: 2d8 x year rounded to 25; accept → the money moves and the original proposal passes; decline → nothing', () => {
    const mkc = () => accGame({ rel: { rel1: 20, moodTreaty: -30 } });                                    // v = d100 - 60 → d100 30 = -30: asks BC
    let S = mkc(); S.empires[0].bc = 1000;
    let r = withRng(fakeR([30, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    t.eq(r.accepted, false); t.eq(r.result, 2); t.eq(r.needsAnswer, true); t.eq(r.counter.type, 'bc'); t.eq(r.counter.bc, 400); t.eq(typeof r.counter.text, 'string');
    r = D.answerCounter(S, 0, 1, true);
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).treaty, T.NAP); t.eq(S.empires[0].bc, 600); t.eq(S.empires[1].bc, 900); t.eq(r.effects.bcPaid, 400);
    S = mkc(); S.empires[0].bc = 1000; withRng(fakeR([30, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    r = D.answerCounter(S, 0, 1, false); t.eq(r.accepted, false); t.eq(rel(S, 0, 1).treaty, T.NONE); t.eq(S.empires[0].bc, 1000); t.eq(S.diplo.pending, null);
    t.eq(D.answerCounter(S, 0, 1, true).ok, false, 'nothing pending any more');
    S = mkc(); S.empires[0].bc = 300; r = withRng(fakeR([30, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    t.eq(r.result, 0, 'cannot afford 400 BC and has no tech: flat refusal'); t.eq(r.counter, undefined);
  });
  t.test('counter-offer with a tech (v -75..-51): a tech worth >= year to the AI, never the human\'s newest in its field', () => {
    const S = accGame({ rel: { rel1: 20, moodTreaty: -70 } });                                            // d100 40 → v = -60 → asks a tech
    const lv = levelsIn(5, 9, 2, ['beam', 'rocket']); t.eq(lv.length, 2);
    grant(S, 0, 5, lv[0]); grant(S, 0, 5, lv[1]);
    const r = withRng(fakeR([40, 5, 4, 4, 0, 0]), () => D.propose(S, 0, 1, { kind: 'nap' }));
    t.eq(r.result, 1); t.eq(r.counter.type, 'tech'); t.eq(r.counter.field, 5); t.eq(r.counter.level, lv[0], 'the older of the two'); t.eq(typeof r.counter.name, 'string');
    D.answerCounter(S, 0, 1, true); t.eq(S.empires[1].research.completed[5].indexOf(lv[0]) >= 0, true); t.eq(S.empires[1].research.completed[5].indexOf(lv[1]) >= 0, false); t.eq(rel(S, 0, 1).treaty, T.NAP);
  });
  t.test('peace: v1.3 rolls on the TREATY mood (a0 60), the peace mood with CFG.peaceUsesTreatyMood = false; every ask costs another -20; accepted peace = rel +40, cease-fire 8..13', () => {
    const war = () => accGame({ rel: { rel1: -25, treaty: T.WAR, moodTreaty: 100, moodPeace: -200 } });
    let S = war(); let r = withRng(fakeR([50, 10, 5]), () => D.propose(S, 0, 1, { kind: 'peace' }));
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).treaty, T.NONE); t.eq(rel(S, 0, 1).rel1, 15); t.between(D.ceasefire(S, 0, 1), 8, 13); t.eq(r.effects.ceasefire, 13);
    t.eq(rel(S, 0, 1).moodTreaty, 100 - 10 - 30 - 20, 'annoy(1) + topic (d30+20) + annoy(2)'); t.eq(rel(S, 0, 1).moodTrade, 100 - 10 - 20); t.eq(diploEvents(S, 'peaceTreaty').length, 1);
    D.CFG.peaceUsesTreatyMood = false;
    try { S = war(); r = withRng(fakeR([50, 10]), () => D.propose(S, 0, 1, { kind: 'peace' })); t.eq(r.accepted, false); t.eq(r.result, 0); t.eq(rel(S, 0, 1).treaty, T.WAR); } finally { D.CFG.peaceUsesTreatyMood = true; }
    S = war(); r = D.propose(S, 0, 1, { kind: 'peace' }); t.eq(r.accepted, true);
    S = accGame(); t.eq(D.propose(S, 0, 1, { kind: 'peace' }).ok, false, 'not at war');
    S = war(); setAll(S, 0, 1, { moodTreaty: -200 }); r = D.propose(S, 0, 1, { kind: 'peace' }); t.eq(r.accepted, false, 'right after a war starts nobody wants peace');
  });
  t.test('ask an AI to declare war on X: an ally of a human at war with X helps 7 times out of 8, otherwise a0 = its relation to X + 150', () => {
    let S = accGame({ rel: { treaty: T.ALLIANCE, rel1: 60 } }); setAll(S, 0, 2, { treaty: T.WAR });
    let r = withRng(fakeR([3]), () => D.propose(S, 0, 1, { kind: 'askWar', target: 2 })); t.eq(r.accepted, true); t.eq(rel(S, 1, 2).treaty, T.WAR); t.eq(diploEvents(S, 'warDeclared').length >= 1, true);
    S = accGame({ rel: { treaty: T.ALLIANCE, rel1: 60 } }); setAll(S, 0, 2, { treaty: T.WAR }); r = withRng(fakeR([0, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'askWar', target: 2 }));
    t.eq(r.accepted, false); t.eq(r.result, 2, 'the 1/8 case asks for BC'); t.eq(rel(S, 1, 2).treaty, T.NONE);
    S = accGame(); setAll(S, 1, 2, { rel1: 10 });                                                          // a0 = 160, v = 100 + d100 - 160
    r = withRng(fakeR([59, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'askWar', target: 2 })); t.eq(r.result, 2);
    S = accGame(); setAll(S, 1, 2, { rel1: 10 }); r = withRng(fakeR([60, 5]), () => D.propose(S, 0, 1, { kind: 'askWar', target: 2 })); t.eq(r.accepted, true); t.eq(rel(S, 1, 2).treaty, T.WAR); t.eq(rel(S, 1, 0).treaty, T.NONE);
    S = accGame(); setAll(S, 1, 2, { treaty: T.WAR }); t.eq(D.propose(S, 0, 1, { kind: 'askWar', target: 2 }).ok, false, 'already at war with X');
    t.eq(D.propose(accGame(), 0, 1, { kind: 'askWar', target: 0 }).ok, false); t.eq(D.propose(accGame(), 0, 1, { kind: 'askWar', target: 1 }).ok, false);
  });
  t.test('ask an AI to break its alliance with Y: needs relation > 24, a0 = its relation to Y + 175; the AI is the oath-breaker', () => {
    let S = accGame({ rel: { rel1: 24 } }); setAll(S, 1, 2, { treaty: T.ALLIANCE }); t.eq(D.propose(S, 0, 1, { kind: 'askBreak', target: 2 }).gate, true);
    S = accGame({ rel: { rel1: 25 } }); setAll(S, 1, 2, { treaty: T.ALLIANCE, rel1: 0 });                    // a0 = 175, v = 100 + 25 + d100 - 175 = d100 - 50
    t.eq(withRng(fakeR([49, 5, 4, 4, 0]), () => D.propose(S, 0, 1, { kind: 'askBreak', target: 2 })).result, 2);
    S = accGame({ rel: { rel1: 25 } }); setAll(S, 1, 2, { treaty: T.ALLIANCE, rel1: 0 });
    const r = withRng(fakeR([50, 5]), () => D.propose(S, 0, 1, { kind: 'askBreak', target: 2 })); t.eq(r.accepted, true); t.eq(rel(S, 1, 2).treaty, T.NONE); t.eq(rel(S, 1, 2).moodTreaty, -200);
    t.eq(diploEvents(S, 'allianceBroken').length, 1); t.eq(D.propose(accGame(), 0, 1, { kind: 'askBreak', target: 2 }).ok, false, 'no alliance with Y');
  });
  t.test('trade proposals: only the listed volumes, a roll on the trade mood (a0 50) that never counters; leaving the menu costs another -10 and d30', () => {
    const rich = () => { const S = accGame({ rel: { rel1: 10 } }); S.planets.forEach(p => { p.gross = 500; }); return S; };
    let S = rich(); t.eq(D.propose(S, 0, 1, { kind: 'trade', bc: 37 }).ok, false);
    const lv = D.tradeLevels(S, 0, 1); t.eq(lv.length >= 4, true);
    let r = withRng(fakeR([50, 10, 4]), () => D.propose(S, 0, 1, { kind: 'trade', bc: lv[0] }));
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).trade, lv[0]); t.eq(rel(S, 1, 0).trade, lv[0]); t.eq(rel(S, 0, 1).tradePct, -30); t.eq(diploEvents(S, 'tradeSigned').length, 1);
    t.eq(rel(S, 0, 1).moodTrade, 100 - 10 - 30 - 10 - 5); t.eq(rel(S, 0, 1).moodTreaty, 100 - 20);
    S = rich(); setAll(S, 0, 1, { moodTrade: -30 }); r = withRng(fakeR([30, 5]), () => D.propose(S, 0, 1, { kind: 'trade', bc: lv[0] })); t.eq(r.accepted, false); t.eq(r.counter, undefined, 'trade has no counter-offers'); t.eq(rel(S, 0, 1).trade, 0);
    S = rich(); setAll(S, 0, 1, { treaty: T.WAR }); t.eq(D.propose(S, 0, 1, { kind: 'trade', bc: lv[0] }).ok, false);
    S = rich(); const m0 = moodsOf(S, 0, 1)[1]; D.leave(S, 0, 1, 'trade'); t.eq(m0 - rel(S, 0, 1).moodTrade >= 11 && m0 - rel(S, 0, 1).moodTrade <= 40, true, 'Forget It: -10 and d30');
  });
  t.test('Human-race bonus: an AI that refuses a klackon player accepts a Human player (+50 in every roll)', () => {
    const tryRace = race => { const S = accGame({ race, pers: XENO, rel: { rel1: 30, moodTreaty: 20 } }); return ask(S, 1, 125); };       // 20 + 30 - 50 + 1 - 125
    t.eq(tryRace('klackon'), 0); t.eq(tryRace('human'), 1, '-124 + 50 = -74');
  });

  // ══════════════════════════════════════ tribute (research/05 §4.4.6, research/08 §7.7) ═══════════════════════════════════════════
  const hybrid = (seq, seed) => { const base = real(seed || 'hy'); let i = 0; return { int(lo, hi) { return i < seq.length ? Math.max(lo, Math.min(hi, seq[i++])) : base.int(lo, hi); }, dice(n, s) { let q = 0; for (let k = 0; k < n; k++) q += this.int(1, s); return q; }, next() { return base.next(); } }; };
  t.test('BC tribute: the money moves (25..100 steps, or a quarter/half/three quarters/all of the reserve) but v1.3 buys NO relations while the AI has any production', () => {
    let S = accGame({ race: 'human', rel: { rel1: 20 } }); S.empires[0].bc = 500;
    t.deep(D.tributeChoices(S, 0, 1).bc, [125, 250, 375, 500]); S.empires[0].bc = 90; t.deep(D.tributeChoices(S, 0, 1).bc, [25, 50, 75]); S.empires[0].bc = 20; t.deep(D.tributeChoices(S, 0, 1).bc, []);
    S.empires[0].bc = 1000000; t.eq(D.tributeChoices(S, 0, 1).bc[3], 32000, 'capped at 32000');
    S.empires[0].bc = 500; const r = D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100, index: 1 });
    t.eq(r.accepted, true); t.eq(S.empires[0].bc, 400); t.eq(S.empires[1].bc, 600); t.eq(rel(S, 0, 1).rel1, 20); t.eq(r.reply.situation, 'thanksGift'); t.eq(diploEvents(S, 'tributePaid')[0].bc, 100);
    t.eq(D.propose(S, 0, 1, { kind: 'tributeBC', bc: 10 }).ok, false); t.eq(D.propose(S, 0, 1, { kind: 'tributeBC', bc: 4000 }).ok, false);
    S = accGame({ race: 'human', rel: { rel1: 20 } }); S.planets.forEach(p => { if (p.owner === 1) p.gross = 0; });                  // the one case that works: an AI with no production at all
    D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100, index: 2 }); t.eq(rel(S, 0, 1).rel1, 20 + 3 * 2, 'index+1, doubled for the Human race');
  });
  t.test('BC tribute with CFG.classicCashTribute = false (Classic+/Guide): +bc x 12 / production, doubled for Humans, capped at +65 and -25 at war', () => {
    D.CFG.classicCashTribute = false;
    try {
      let S = accGame({ race: 'klackon', rel: { rel1: 20 } }); D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100 }); t.eq(rel(S, 0, 1).rel1, 26, '100*12/200');
      S = accGame({ race: 'human', rel: { rel1: 20 } }); D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100 }); t.eq(rel(S, 0, 1).rel1, 32);
      S = accGame({ race: 'human', rel: { rel1: 60 } }); D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100 }); t.eq(rel(S, 0, 1).rel1, 65);
      S = accGame({ race: 'human', rel: { rel1: -90, treaty: T.WAR } }); D.propose(S, 0, 1, { kind: 'tributeBC', bc: 100 }); t.eq(rel(S, 0, 1).rel1, -78, 'at war the relation cannot rise above -25 (it may stay lower)');
    } finally { D.CFG.classicCashTribute = true; }
  });
  t.test('tech tribute: gain = ((d8+d8+level/4) x base)/10 with base (100-rel)/10 (20 when hated), x2 for a Human giver; trust +3..10 (cap 30); the AI gets the tech', () => {
    const lv = levelsIn(5, 12, 1, ['beam', 'rocket'])[0], q = Math.trunc(lv / 4);
    for (const [race, mul] of [['klackon', 1], ['human', 2]]) {
      const S = accGame({ race, rel: { rel1: 0 } }); grant(S, 0, 5, lv); const R = real('tt' + race); let sum = 0, mn = 999, mx = -1, tmin = 99, tmax = 0; const N = 400;
      for (let i = 0; i < N; i++) {
        S.empires[1].research.completed[5] = [1]; M.Sim.Research.recompute(S.empires[1]); setAll(S, 0, 1, { rel1: 0, trust: 0, moodPeace: 0, gift: null });
        const r = withRng(R, () => D.propose(S, 0, 1, { kind: 'tributeTech', field: 5, level: lv }));
        t.eq(r.accepted, true); const g = rel(S, 0, 1).rel1; sum += g; mn = Math.min(mn, g); mx = Math.max(mx, g); tmin = Math.min(tmin, rel(S, 0, 1).trust); tmax = Math.max(tmax, rel(S, 0, 1).trust);
        t.eq(rel(S, 0, 1).moodPeace, g); t.eq(rel(S, 1, 0).moodPeace, g); t.eq(S.empires[1].research.completed[5].indexOf(lv) >= 0, true);
      }
      t.eq(mn, mul * (2 + q)); t.eq(mx, mul * (16 + q)); t.near(sum / N, mul * (9 + q), 0.7); t.eq(tmin, 3); t.eq(tmax, 10);
    }
    const S = accGame({ race: 'human', rel: { rel1: 65 } }); grant(S, 0, 5, lv); D.propose(S, 0, 1, { kind: 'tributeTech', field: 5, level: lv }); t.eq(rel(S, 0, 1).rel1, 70, 'non-allies cap at +70 for tech');
    const W = accGame({ race: 'human', rel: { rel1: -30, treaty: T.WAR } }); grant(W, 0, 5, lv); D.propose(W, 0, 1, { kind: 'tributeTech', field: 5, level: lv }); t.eq(rel(W, 0, 1).rel1, -25, 'at war: -25 at most');
    const Z = accGame({ race: 'human', rel: { rel1: 70, trust: 29 } }); grant(Z, 0, 5, lv); setAll(Z, 0, 1, { treaty: T.ALLIANCE }); D.propose(Z, 0, 1, { kind: 'tributeTech', field: 5, level: lv }); t.eq(rel(Z, 0, 1).trust, 30, 'trust capped at 30');
    t.eq(D.propose(Z, 0, 1, { kind: 'tributeTech', field: 5, level: lv }).ok, false, 'the AI already has it'); t.eq(D.propose(Z, 0, 1, { kind: 'tributeTech', field: 5, level: 49 }).ok, false, 'you do not have it');
    t.eq(rel(Z, 0, 1).gift.level, lv, 'the AI remembers the gift');
  });
  t.test('tribute choices list at most four of the techs the AI lacks (any tech, newest included)', () => {
    const S = accGame(); const ls = levelsIn(5, 6, 6, ['beam', 'rocket']); for (const l of ls) grant(S, 0, 5, l);
    const c = D.tributeChoices(S, 0, 1); t.eq(c.techs.length, 4); t.eq(c.allTechs.length, ls.length); t.eq(c.allTechs.some(x => x.level === ls[ls.length - 1]), true);
  });

  // ══════════════════════════════════════ threats, breaking treaties (research/05 §4.4.5) ═══════════════════════════════════════════
  // v = d200 + mood_treaty/2 (after the -100 annoyance) + 2·reldiff + 100·(your production / theirs); mood 100 → 0, equal economies → v = d200 + 100
  t.test('threaten: v < 170 → war roll d15 - reldiff > d100, else defiance; the menu costs -100 on all moods, relation -d15, treaty mood := -120', () => {
    let S = accGame(); let r = withRng(fakeR([1, 3, 15, 1]), () => D.propose(S, 0, 1, { kind: 'threat' }));
    t.eq(r.outcome, 'war'); t.eq(rel(S, 0, 1).treaty, T.WAR); t.eq(r.reply.situation, 'declareWar'); t.eq(r.reply.msgType, 13); t.eq(diploEvents(S, 'warDeclared')[0].empire, 0);
    S = accGame(); r = withRng(fakeR([1, 3, 1, 5]), () => D.propose(S, 0, 1, { kind: 'threat' }));
    t.eq(r.outcome, 'defiant'); t.eq(rel(S, 0, 1).treaty, T.NONE); t.eq(rel(S, 0, 1).rel1, -3); t.eq(rel(S, 0, 1).moodTreaty, -120); t.deep(moodsOf(S, 0, 1).slice(1), [0, 0, 0]); t.eq(r.reply.situation, 'refuseTribute');
    t.eq(D.propose(accGame({ rel: { treaty: T.WAR } }), 0, 1, { kind: 'threat' }).ok, false, 'not at war');
  });
  t.test('threaten: v >= 170 cowers (cease-fire d15+5, the PLAYER\'s spies hide), v >= 200 pays (d8+2) x year BC, v >= 275 yields a tech', () => {
    let S = accGame(); S.empires[0].spyMode[1] = 2; S.empires[1].spyMode[0] = 2;
    let r = withRng(fakeR([70, 3, 10]), () => D.propose(S, 0, 1, { kind: 'threat' }));
    t.eq(r.outcome, 'cower'); t.eq(r.effects.ceasefire, 15); t.eq(D.ceasefire(S, 0, 1), 15); t.eq(S.empires[0].spyMode[1], 0, 'v1.3 bug: your own spies go into hiding'); t.eq(S.empires[1].spyMode[0], 2); t.eq(r.reply.situation, 'backDown');
    D.CFG.threatHidesHuman = false;
    try { S = accGame(); S.empires[0].spyMode[1] = 2; S.empires[1].spyMode[0] = 2; withRng(fakeR([70, 3, 10]), () => D.propose(S, 0, 1, { kind: 'threat' })); t.eq(S.empires[0].spyMode[1], 2); t.eq(S.empires[1].spyMode[0], 0); } finally { D.CFG.threatHidesHuman = true; }
    S = accGame(); r = withRng(fakeR([100, 3, 10, 3]), () => D.propose(S, 0, 1, { kind: 'threat' }));
    t.eq(r.outcome, 'bc'); t.eq(r.effects.bc, 250); t.eq(S.empires[0].bc, 750); t.eq(S.empires[1].bc, 250); t.eq(r.reply.situation, 'payTribute'); t.eq(diploEvents(S, 'tributePaid')[0].bc, 250);
    S = accGame(); S.empires[1].bc = 100; r = withRng(fakeR([100, 3, 10, 3]), () => D.propose(S, 0, 1, { kind: 'threat' })); t.eq(r.effects.bc, 100, 'pays what it has');
    const lv = levelsIn(5, 9, 2, ['beam', 'rocket']);
    S = accGame(); grant(S, 1, 5, lv[0]); grant(S, 1, 5, lv[1]); r = withRng(fakeR([175, 3, 10, 0]), () => D.propose(S, 0, 1, { kind: 'threat' }));
    t.eq(r.outcome, 'tech'); t.eq(r.effects.tech.level, lv[0], 'never its newest'); t.eq(S.empires[0].research.completed[5].indexOf(lv[0]) >= 0, true); t.eq(S.empires[0].research.completed[5].indexOf(lv[1]) >= 0, false); t.eq(S.empires[1].bc, 500);
    S = accGame(); r = withRng(fakeR([175, 3, 10]), () => D.propose(S, 0, 1, { kind: 'threat' })); t.eq(r.outcome, 'cower', 'nothing to give');
  });
  t.test('threaten: P(war | v < 170) = P(d15 - reldiff > d100): Xenophobic 57 %, Ruthless 37 %, Aggressive 27 %, Erratic 7 %, Honorable ~1 %, Pacifistic 0', () => {
    const S = accGame(); const want = { [XENO]: 0.57, [RUTH]: 0.37, [AGGR]: 0.27, [ERR]: 0.07, [HONOR]: 0.0067, [PACI]: 0 }, N = 3000;
    for (const p of [XENO, RUTH, AGGR, ERR, HONOR, PACI]) {
      S.empires[1].personality = p; const R = hybrid([], 'thr' + p); let wars = 0;
      for (let i = 0; i < N; i++) {
        setAll(S, 0, 1, { treaty: T.NONE, rel1: 0, moodTreaty: 100, moodTrade: 100, moodTech: 100, moodPeace: 100, ceasefire: 0 }); S.ev = [];
        const r = withRng(hybridFirst(R, 1), () => D.propose(S, 0, 1, { kind: 'threat' })); if (r.outcome === 'war') wars++;
      }
      t.near(wars / N, want[p], p === PACI ? 0 : 0.03, 'personality ' + p);
    }
    function hybridFirst(R, first) { let n = 0; return { int(lo, hi) { return n++ === 0 ? Math.max(lo, Math.min(hi, first)) : R.int(lo, hi); }, dice(a, b) { return R.dice(a, b); }, next: R.next }; }
  });
  t.test('breaking a treaty or trade in the audience: oath-breaker bookkeeping, -100 on every mood for the menu, message 73; v1.3 even RAISES your trust', () => {
    let S = accGame({ rel: { treaty: T.NAP, rel1: 50 } }); const r = D.propose(S, 0, 1, { kind: 'breakTreaty' });
    t.eq(r.accepted, true); t.eq(rel(S, 0, 1).treaty, T.NONE); t.eq(r.reply.msgType, 73); t.eq(rel(S, 0, 1).trust, 10, 'sign bug'); t.eq(rel(S, 0, 1).broken, T.NAP); t.eq(rel(S, 0, 1).moodTreaty, -200);
    S = accGame({ rel: { rel1: 40, trade: 100, tradePct: 20 } }); const q = D.propose(S, 0, 1, { kind: 'breakTrade' });
    t.eq(q.accepted, true); t.eq(rel(S, 0, 1).trade, 0); t.eq(rel(S, 1, 0).trade, 0); t.eq(rel(S, 0, 1).rel1, 40, 'no relation change in v1.3'); t.deep(moodsOf(S, 0, 1), [0, 0, 0, 0]); t.eq(rel(S, 0, 1).treaty, T.NONE);
    t.eq(D.propose(accGame(), 0, 1, { kind: 'breakTreaty' }).ok, false); t.eq(D.propose(accGame(), 0, 1, { kind: 'breakTrade' }).ok, false);
    S = accGame(); D.leave(S, 0, 1, 'threaten'); t.deep(moodsOf(S, 0, 1), [0, 0, 0, 0], 'Forget It costs the same -100 in v1.3');
  });

  // ══════════════════════════════════════ technology exchange (research/05 §4.4.7) ═══════════════════════════════════════════════════
  t.test('tech exchange: scale K = max(75, ...) (>= 75 always, larger when the AI dislikes you); the wanted list never contains the AI\'s newest tech of a field', () => {
    const S = accGame(); const R = fakeR([50]);
    t.eq(D.techExchangeScale(S, 0, 1, R), 75);                                                            // x = 20 + 50 - 125 = -55 → (55+100)/4 = 38 → 75
    setAll(S, 0, 1, { trust: 0, rel1: -100, moodTech: -100 }); t.eq(D.techExchangeScale(S, 0, 1, fakeR([1])) > 75, true, 'hostile AI raises the price'); t.eq(D.techExchangeScale(S, 0, 1, fakeR([1])) <= 140, true);
    setAll(S, 0, 1, { trust: 0, rel1: 100, moodTech: 100 }); t.eq(D.techExchangeScale(S, 0, 1, fakeR([100])), 75);
    const lv = levelsIn(5, 9, 2, ['beam', 'rocket']); const G = accGame(); grant(G, 1, 5, lv[0]); grant(G, 1, 5, lv[1]);
    const w = D.techWanted(G, 0, 1); t.eq(w.length, 1); t.eq(w[0].level, lv[0]); t.eq(w[0].field, 5);
  });
  t.test('tech exchange: entering costs -10 and d50+20 on the tech mood once; the AI wants >= 75 % of the value back; both techs change hands; leaving costs -30 (tech mood <= 50)', () => {
    const lv = levelsIn(5, 9, 4, ['beam', 'rocket']), S = accGame();
    grant(S, 1, 5, lv[0]); grant(S, 1, 5, lv[1]); grant(S, 0, 5, lv[2]);                                  // AI: lv0 (tradeable), lv1 (newest); human: lv2
    const w = withRng(fakeR([0, 50, 5]), () => D.techWanted(S, 0, 1)); t.eq(w.length, 1);
    t.eq(rel(S, 0, 1).moodTech, 100 - 10 - 25); t.eq(rel(S, 0, 1).moodTreaty, 90); t.eq(w[0].price, Math.trunc(lv[0] * lv[0] * 75 / 100));
    const again = D.techWanted(S, 0, 1); t.deep(again, w); t.eq(rel(S, 0, 1).moodTech, 65, 'asking again costs nothing');
    const offers = D.techOffers(S, 0, 1, { field: 5, level: lv[0] }); t.eq(offers.length, 1); t.eq(offers[0].level, lv[2]); t.eq(D.techMarket(S, 0, 1).length, 1);
    t.eq(D.propose(S, 0, 1, { kind: 'techExchange', want: { field: 5, level: lv[0] }, give: { field: 5, level: lv[3] } }).ok, false, 'not a listed payment');
    const r = D.propose(S, 0, 1, { kind: 'techExchange', want: { field: 5, level: lv[0] }, give: { field: 5, level: lv[2] } });
    t.eq(r.accepted, true); t.eq(S.empires[0].research.completed[5].indexOf(lv[0]) >= 0, true); t.eq(S.empires[1].research.completed[5].indexOf(lv[2]) >= 0, true);
    t.eq(rel(S, 0, 1).moodTech, 65 - 30, 'annoy(3), then min(.., 50)'); t.eq(r.effects.got.level, lv[0]); t.eq(S.diplo.techList, null);
    const low = accGame(); grant(low, 1, 5, lv[2]); grant(low, 1, 5, lv[3]); grant(low, 0, 5, lv[0]);          // the AI would give lv2 but the human only has the cheaper lv0
    withRng(fakeR([0, 50, 5]), () => D.techWanted(low, 0, 1)); t.eq(D.techOffers(low, 0, 1, { field: 5, level: lv[2] }).length, 0); t.eq(D.techMarket(low, 0, 1).length, 0);
    D.leave(low, 0, 1, 'tech'); t.eq(low.diplo.techList, null);
    t.eq(D.propose(accGame({ rel: { treaty: T.WAR } }), 0, 1, { kind: 'techExchange', want: { field: 5, level: lv[0] }, give: { field: 5, level: lv[2] } }).ok, false, 'at war');
  });
  t.test('tech values: level^2 x10 for singular techs, x6 robotic controls, x3 waste/eco restoration; /4 when superseded; Death Ray 30000; Silicoids never receive their taboo techs', () => {
    const S = accGame(); const TT = M.Data.Techs, find = pred => TT.list.find(pred);
    const sing = find(x => x.group === 'singular' && !x.free && x.level >= 6 && x.level <= 40 && !x.never), rob = find(x => x.group === 'robotic-controls' && !x.free), waste = find(x => x.group === 'waste' && !x.free);
    t.eq(D.techValue(S, S.empires[1], sing), sing.level * sing.level * 10); t.eq(D.techValue(S, S.empires[1], rob), rob.level * rob.level * 6); t.eq(D.techValue(S, S.empires[1], waste), waste.level * waste.level * 3);
    const dr = TT.list.find(x => x.special === 'orion-only'); t.eq(D.techValue(S, S.empires[1], dr), 30000);
    const beams = TT.list.filter(x => x.group === 'beam' && !x.free).sort((a, b) => a.level - b.level), lo = beams[0], hi = beams[beams.length - 1];
    grant(S, 1, hi.field, hi.level); t.eq(D.techValue(S, S.empires[1], lo), Math.floor(lo.level * lo.level / 4), 'superseded: /4');
    const sil = mk({ races: ['human', 'silicoid', 'psilon', 'darlok'] }); contactAll(sil); const nev = TT.list.find(x => x.never && x.never.indexOf('silicoid') >= 0 && !x.free);
    if (nev) { grant(sil, 0, nev.field, nev.level); t.eq(D.techCandidates(sil, 0, 1, {}).some(c => c.level === nev.level && c.field === nev.field), false, 'taboo for Silicoids'); t.eq(D.techCandidates(sil, 0, 2, {}).some(c => c.level === nev.level && c.field === nev.field), true); }
  });
  t.test('group obsolescence: a tech whose group tier is already owned (robotic controls, fuel cells, …) is not a candidate, a better one is', () => {
    const S = accGame(); const TT = M.Data.Techs, g = TT.list.filter(x => x.group === 'fuel' && !x.free).sort((a, b) => a.level - b.level);
    t.eq(g.length >= 2, true); grant(S, 0, g[0].field, g[0].level); grant(S, 0, g[1].field, g[1].level);
    grant(S, 1, g[1].field, g[1].level);                                                                    // the AI owns the higher tier → the lower one is "owned" too
    t.eq(D.techCandidates(S, 0, 1, {}).some(c => c.level === g[0].level && c.field === g[0].field), false);
    const S2 = accGame(); grant(S2, 0, g[0].field, g[0].level); grant(S2, 0, g[1].field, g[1].level); grant(S2, 1, g[0].field, g[0].level);
    t.eq(D.techCandidates(S2, 0, 1, {}).some(c => c.level === g[1].level && c.field === g[1].field), true, 'a better tier is new');
  });

  // ══════════════════════════════════════ opening an audience, the menu (research/05 §4.1, §4.4.1) ═════════════════════════════════
  t.test('audience: v = trust + min(mood) + reldiff < -100 → one refusal line (20 at war, 21 otherwise); min(mood) < -100 → "later" (74); then 22 friendly / 23 cool', () => {
    let S = accGame({ rel: { moodTreaty: -150 } }); let a = D.audience(S, 0, 1); t.eq(a.state, 'refused'); t.eq(a.msgType, 21);
    S = accGame({ rel: { moodTreaty: -150, treaty: T.WAR } }); t.eq(D.audience(S, 0, 1).msgType, 20);
    S = accGame({ pers: PACI, rel: { moodTreaty: -110 } }); a = D.audience(S, 0, 1); t.eq(a.state, 'later'); t.eq(a.msgType, 74);
    S = accGame({ pers: PACI, rel: { moodTreaty: -125 } }); t.eq(D.audience(S, 0, 1).state, 'refused', 'the personality offset can only help so much');
    S = accGame({ rel: { rel1: 0 } }); a = D.audience(S, 0, 1); t.eq(a.state, 'open'); t.eq(a.msgType, 22); t.eq(a.greeting.situation, 'greeting'); t.eq(a.cool, false);
    S = accGame({ rel: { rel1: -30, moodTreaty: -30, moodTrade: -30, moodTech: -30, moodPeace: -30 } }); a = D.audience(S, 0, 1); t.eq(a.state, 'open'); t.eq(a.msgType, 23); t.eq(a.cool, true);
    S = accGame({ rel: { treaty: T.WAR, rel1: -25 } }); t.eq(D.audience(S, 0, 1).greeting.situation, 'greetingAtWar');
    S = accGame({ rel: { moodTreaty: 400 } }); D.audience(S, 0, 1); t.eq(rel(S, 0, 1).moodTreaty, 120, 'treaty mood clamped to 120 when an audience starts');
    S = mk({ gap: 100 }); t.eq(D.audience(S, 0, 1).ok, false, 'no contact'); S = accGame({ rel: { treaty: T.FINAL_WAR } }); t.eq(D.audience(S, 0, 1).ok, false);
  });
  t.test('"diplomat gone": trust + min(mood) + reldiff <= -100 or min(mood) <= -100; status() mirrors it as canAudience', () => {
    let S = accGame({ rel: { moodTreaty: -100 } }); t.eq(D.isGone(S, 0, 1), true); t.eq(D.status(S, 0, 1).canAudience, false);
    S = accGame({ pers: PACI, rel: { moodTreaty: -99 } }); t.eq(D.isGone(S, 0, 1), false, '-99 + 20'); S = accGame({ pers: PACI, rel: { moodTreaty: -100 } }); t.eq(D.isGone(S, 0, 1), true);
    S = accGame({ pers: XENO, rel: { moodTreaty: -49 } }); t.eq(D.isGone(S, 0, 1), false, '-49 - 50 = -99'); S = accGame({ pers: XENO, rel: { moodTreaty: -50 } }); t.eq(D.isGone(S, 0, 1), true);
    S = accGame({ pers: XENO, rel: { moodTreaty: -40, trust: -10 } }); t.eq(D.isGone(S, 0, 1), true, 'trust counts'); S = accGame({ pers: XENO, rel: { moodTreaty: -40 } }); t.eq(D.isGone(S, 0, 1), false); t.eq(D.status(S, 0, 1).canAudience, true);
  });
  t.test('menu: Treaty/Trade/Threaten/Tribute/Tech/Good Bye with the original enable rules (war greys out trade, threats, tech exchange)', () => {
    const enabled = m => Object.fromEntries(m.actions.map(a => [a.id, a.enabled]));
    let S = accGame(); S.empires[0].bc = 0; let m = D.menu(S, 0, 1);
    t.deep(m.actions.map(a => a.id), ['treaty', 'trade', 'threaten', 'tribute', 'techExchange', 'goodbye']); t.deep(enabled(m), { treaty: true, trade: true, threaten: true, tribute: false, techExchange: true, goodbye: true });
    const tr = m.actions[0].options; t.deep(tr.map(o => [o.id, o.enabled]), [['nap', true], ['alliance', true], ['peace', false], ['askWar', true], ['askBreak', false]]);
    t.deep(tr[3].targets, [2, 3]);
    S.empires[0].bc = 25; t.eq(enabled(D.menu(S, 0, 1)).tribute, true);
    setAll(S, 0, 1, { treaty: T.NAP }); t.deep(D.menu(S, 0, 1).actions[0].options.slice(0, 3).map(o => o.enabled), [false, true, false]);
    setAll(S, 0, 1, { treaty: T.ALLIANCE }); setAll(S, 1, 2, { treaty: T.ALLIANCE }); t.deep(D.menu(S, 0, 1).actions[0].options[4].targets, [2]);
    setAll(S, 0, 1, { treaty: T.WAR }); m = D.menu(S, 0, 1); t.deep(enabled(m), { treaty: true, trade: false, threaten: false, tribute: true, techExchange: false, goodbye: true });
    t.deep(m.actions[0].options.map(o => o.enabled), [false, false, true, false, false]);
    S = accGame({ rel: { rel1: 10 } }); S.planets.forEach(p => { p.gross = 500; }); m = D.menu(S, 0, 1); t.eq(m.actions[1].enabled, true); t.eq(m.actions[1].options.length, 5);
    const th = D.menu(S, 0, 1).actions[2].options; t.deep(th.map(o => o.enabled), [false, false, false, true]);
    setAll(S, 0, 1, { treaty: T.NAP, trade: 50 }); t.deep(D.menu(S, 0, 1).actions[2].options.map(o => o.enabled), [true, false, true, true]);
  });

  // ══════════════════════════════════════ contact, first contact, turn flow ═══════════════════════════════════════════════════════════
  function addFleet(S, owner, ships) { S.fleets.push({ id: S.nextId++, owner, star: owner * 2, from: owner * 2, to: -1, x: S.stars[owner * 2].x, y: 0, speed: 0, ships }); }
  t.test('contact: the nearest pair of owned stars must lie within the LARGER of the two fuel ranges (parsecs); symmetric', () => {
    const S = mk({ gap: 40 }); let d = 99; for (const a of [0, 1]) for (const b of [2, 3]) d = Math.min(d, Geo.parsecs(S, a, b));
    for (const E of S.empires) E.mods.fuel = d; D.updateContact(S, true); t.eq(D.hasContact(S, 0, 1), true); t.eq(D.hasContact(S, 1, 0), true);
    for (const E of S.empires) E.mods.fuel = d - 1; D.updateContact(S, true); t.eq(D.hasContact(S, 0, 1), false);
    S.empires[0].mods.fuel = 1; S.empires[1].mods.fuel = d; D.updateContact(S, true); t.eq(D.hasContact(S, 0, 1), true, 'the larger range counts'); t.eq(D.hasContact(S, 0, 0), false);
  });
  t.test('first contact: the human gets a greeting audience 14 + personality exactly once; AI pairs meet silently; news for human pairs only', () => {
    const S = mk({ pers: [ERR, RUTH, PACI, XENO], gap: 100 }); for (const E of S.empires) E.mods.fuel = 99;
    const R = real('fc'); D.preTurn(S, R); const out = D.turn(S, R), fc = out.filter(o => o.kind === 'firstContact');
    t.deep(fc.map(o => o.msgType), [15, 19, 14]); t.eq(fc[0].text.personality, 'ruthless'); t.eq(fc[0].text.situation, 'greeting'); t.eq(fc[0].type, 'diplomacy'); t.eq(fc[0].from, 1); t.eq(fc[0].to, 0);
    t.eq(diploEvents(S, 'firstContact').length, 3); t.eq(rel(S, 1, 2).met, 2); t.eq(rel(S, 0, 1).met, 2);
    D.preTurn(S, R); t.eq(D.turn(S, R).filter(o => o.kind === 'firstContact').length, 0, 'only once');
  });
  t.test('contact lost: trade ends, spies hide, budgets drop to 0, the human gets a notice', () => {
    const S = mk({ gap: 100 }); setAll(S, 0, 1, { contact: true, trade: 50, tradePct: 10 }); S.empires[0].spyMode[1] = 2; S.empires[0].spyBudget[1] = 30; S.empires[1].spyMode[0] = 1;
    D.updateContact(S, false); t.eq(rel(S, 0, 1).trade, 0); t.eq(S.empires[0].spyMode[1], 0); t.eq(S.empires[1].spyMode[0], 0); t.eq(S.empires[0].spyBudget[1], 0);
    t.eq(S.ev.some(e => e.type === 'notice' && e.kind === 'contactLost' && e.empire === 0), true);
  });
  t.test('start-of-turn bookkeeping: cease-fire counts down, moods regain +d5 below 0 and +d5 below 50, peace mood clamps at +/-200, offences are remembered as blunders, scratch resets', () => {
    const S = mk(); contactAll(S);
    setAll(S, 0, 1, { ceasefire: 3 }); rel(S, 0, 1).dipType = 9; rel(S, 0, 1).dipVal = -8; rel(S, 2, 3).dipType = 46; rel(S, 3, 2).dipType = 52;
    Object.assign(rel(S, 0, 1), { moodTreaty: -200, moodTrade: 49, moodTech: 50, moodPeace: 300 });
    D.preTurn(S, fakeR([]));                                                                                  // every d5 answers 5
    const r = rel(S, 0, 1); t.eq(r.moodTreaty, -190); t.eq(r.moodTrade, 54); t.eq(r.moodTech, 50); t.eq(r.moodPeace, 200); t.eq(D.ceasefire(S, 0, 1), 2);
    t.eq(r.blunder, 9); t.eq(rel(S, 2, 3).blunder, 16); t.eq(rel(S, 3, 2).blunder, 6); t.deep([r.dipType, r.dipVal, r.dipP1], [0, 0, -1]);
    setAll(S, 0, 1, { treaty: T.FINAL_WAR, moodTreaty: -200 }); D.preTurn(S, fakeR([])); t.eq(rel(S, 0, 1).moodTreaty, -200, 'no recovery during the Final War');
  });
  t.test('end of turn: every mood below 100 gains +10 (so calm moods settle at 100..109)', () => {
    const S = mk(); Object.assign(rel(S, 0, 1), { moodTreaty: 95, moodTrade: 100, moodTech: -200, moodPeace: 110 }); D.turn(S, fakeR([]));
    t.deep([rel(S, 0, 1).moodTreaty, rel(S, 0, 1).moodTrade, rel(S, 0, 1).moodTech, rel(S, 0, 1).moodPeace], [105, 100, -190, 110]);
  });
  t.test('relation drift (research/05 errata): a 0/1 step toward rel2 with probability |rel1|/105 x 1/2, rolled from the LOWER-index row — a human player 0 never drifts', () => {
    const S = mk(); contactAll(S); const R = real('dr'), N = 4000; let ai = 0, hu = 0, low = 99;
    for (let i = 0; i < N; i++) {
      setAll(S, 1, 2, { rel1: 40, rel2: 0 }); setAll(S, 0, 1, { rel1: 40, rel2: 0 }); D.economyTurn(S, R);
      if (rel(S, 1, 2).rel1 === 39) ai++; if (rel(S, 2, 1).rel1 === 39) t.eq(rel(S, 1, 2).rel1, 39, 'mirrored'); if (rel(S, 0, 1).rel1 !== 40) hu++;
    }
    t.near(ai / N, 39 / 105 / 2, 0.03); t.eq(hu, 0);
    for (let i = 0; i < 400; i++) { setAll(S, 1, 2, { rel1: 100, rel2: 99 }); D.economyTurn(S, R); low = Math.min(low, rel(S, 1, 2).rel1); } t.eq(low, 99, 'never overshoots rel2');
    D.CFG.driftBothRows = true;
    try { let moved = 0; for (let i = 0; i < 400; i++) { setAll(S, 0, 1, { rel1: 60, rel2: 0 }); D.economyTurn(S, R); if (rel(S, 0, 1).rel1 !== 60) moved++; } t.eq(moved > 0, true, 'the old reading lets the AI row drift'); } finally { D.CFG.driftBothRows = false; }
  });
  t.test('treaty goodwill (actor = lower index): NAP +d3, alliance +d6, trade +d3 each 50 %/turn; the human\'s Human race doubles his gains; trade thanks queues type 2', () => {
    const S = mk({ races: ['human', 'mrrshan', 'psilon', 'darlok'] }); contactAll(S);
    setAll(S, 1, 2, { treaty: T.NAP, rel1: 0 }); setAll(S, 0, 3, { treaty: T.ALLIANCE, rel1: 0 }); setAll(S, 0, 1, { trade: 100, rel1: 0 });
    D.economyTurn(S, fakeR([100, 0, 2, 0, 6, 0, 3]));                                                              // pairs in index order: (0,1) trade, (0,3) alliance, (1,2) NAP: one 50 % roll each, then the d(n)
    t.eq(rel(S, 1, 0).rel1, 4, 'trade +2, Human actor x2'); t.eq(rel(S, 3, 0).rel1, 12, 'alliance +6 x2'); t.eq(rel(S, 2, 1).rel1, 3, 'NAP +3'); t.deep([rel(S, 0, 1).dipType, rel(S, 0, 1).dipVal], [2, 4]);
    const T2 = mk(); contactAll(T2); setAll(T2, 1, 2, { treaty: T.NAP, rel1: 0 }); D.economyTurn(T2, fakeR([1, 3])); t.eq(rel(T2, 2, 1).rel1, 0, 'the 50 % roll failed');
  });
  t.test('fleet complaint: an AI with a smaller fleet dislikes a bigger human fleet — d100 >= 50·s_h/s_a and 1 in 20 → act(-10, type 8)', () => {
    const S = mk(); contactAll(S); addFleet(S, 0, [0, 0, 10, 0, 0, 0]); addFleet(S, 1, [0, 0, 5, 0, 0, 0]);
    t.eq(D.fleetStat(S, 0), 15); t.eq(D.fleetStat(S, 1), 10); t.eq(D.fleetPower(S, 0), 250);
    setAll(S, 0, 1, { rel1: 0 }); D.economyTurn(S, fakeR([74, 0])); t.eq(rel(S, 0, 1).rel1, 0, 'd100 74 < 75');
    D.economyTurn(S, fakeR([75, 0])); t.eq(rel(S, 1, 0).rel1, -10); t.deep([rel(S, 0, 1).dipType, rel(S, 0, 1).dipVal], [8, -10]);
    setAll(S, 0, 1, { rel1: 0 }); rel(S, 0, 1).dipType = 0; D.economyTurn(S, fakeR([100, 5])); t.eq(rel(S, 1, 0).rel1, 0, 'the 1/20 gate failed');
  });
  t.test('growth complaint: on even years an empire with more than 3·(size+1) planets of >= 100 BC frightens its AI allies (type 12), v = (d4 x -(n-g)/gdiv)/3 x 4', () => {
    const S = mk(); contactAll(S); setAll(S, 1, 2, { treaty: T.ALLIANCE, rel1: 50 });
    for (let i = 0; i < 10; i++) S.planets.push({ id: 100 + i, starId: 0, owner: 1, pop: 10, gross: 150, spendable: 150 });               // 12 big planets > gscale 6; gdiv = 1 + 6 - 2 = 5
    D.economyTurn(S, fakeR([1, 0, 4]));                                                                       // alliance goodwill gate fails, growth gate passes, d4 = 4 → v = 4 x (-6/5 = -1) = -4 → /3 x 4 = -4
    t.eq(rel(S, 2, 1).rel1, 50 - 8, 'doubled by the good relation'); S.year = 51; setAll(S, 1, 2, { rel1: 50 }); D.economyTurn(S, fakeR([1, 105])); t.eq(rel(S, 2, 1).rel1, 50, 'odd years: nothing');
  });

  // ══════════════════════════════════════ war decisions (research/08 §3.2–§3.3) ═══════════════════════════════════════════════════════
  function warGame(o) {
    o = o || {};
    const S = mk({ races: RACES.slice(0, 6), pers: [ERR, o.pers === undefined ? RUTH : o.pers, ERR, ERR, ERR, ERR], obj: [0, o.obj === undefined ? MIL : o.obj, 0, 0, 0, 0], diff: o.diff === undefined ? 2 : o.diff, prod: o.prod });
    contactAll(S); for (const E of S.empires) for (const r of E.relations) r.met = 2; setAll(S, 0, 1, Object.assign({ rel1: 0 }, o.rel || {})); addFleet(S, 0, [0, 0, 0, 10, 0, 0]); addFleet(S, 1, [1, 0, 0, 0, 0, 0]); return S;
  }
  t.test('war path B (fleet envy): Militarist/Expansionist, not Honorable; v = rel - F + reldiff + trust < -150, F = d(|ratio|) with ratio = (target - me)·100/me clamped to 300', () => {
    const run = (o, seq) => { const S = warGame(o); const went = D._.warCheck(S, fakeR(seq), 0, 1); return { S, went, war: rel(S, 0, 1).treaty === T.WAR }; };
    t.eq(run({}, [0, 121]).war, true, 'Ruthless needs F > 120'); t.eq(run({}, [0, 120]).war, false); t.eq(run({ pers: PACI }, [0, 170]).war, false, 'Pacifistic needs 171'); t.eq(run({ pers: PACI }, [0, 171]).war, true);
    t.eq(run({ pers: XENO }, [0, 101]).war, true); t.eq(run({ pers: XENO }, [0, 100]).war, false); t.eq(run({ pers: HONOR }, [0, 300]).war, false, 'Honorable never takes path B');
    t.eq(run({ obj: 0 }, [0, 300]).war, false, 'a Diplomat does not'); t.eq(run({ obj: EXP }, [0, 121]).war, true, 'an Expansionist does');
    t.eq(run({ rel: { rel1: -50 } }, [0, 71]).war, true, 'a hated target lowers the bar by its relation'); t.eq(run({ rel: { rel1: -50 } }, [0, 70]).war, false);
    t.eq(run({ rel: { trust: -20 } }, [0, 101]).war, true, 'trust counts');
    const w = run({}, [0, 121]); t.eq(rel(w.S, 0, 1).dipType, 60, 'a human target is told: 60 for a cold calculation (relation >= 0), 13 when disliked');
    const weak = warGame(); weak.fleets.length = 0; addFleet(weak, 0, [1, 0, 0, 0, 0, 0]); addFleet(weak, 1, [0, 0, 0, 10, 0, 0]); t.eq(D._.warCheck(weak, fakeR([0, 300]), 0, 1), false, 'a WEAKER target never triggers envy');
  });
  t.test('war path C (production envy, any objective) and the cease-fire gate for a human target', () => {
    const prod = [400, 100, 100, 100];
    let S = warGame({ obj: 0, prod }); S.fleets.length = 0;
    t.eq(D._.warCheck(S, fakeR([19, 0, 121]), 0, 1), true); t.eq(rel(S, 0, 1).treaty, T.WAR);
    S = warGame({ obj: 0, prod }); S.fleets.length = 0; t.eq(D._.warCheck(S, fakeR([19, 0, 120]), 0, 1), false);
    S = warGame({ obj: 0, prod }); S.fleets.length = 0; setAll(S, 0, 1, { ceasefire: 4 }); t.eq(D._.warCheck(S, fakeR([19, 0, 300]), 0, 1), false, 'no envy war against a human under a cease-fire');
  });
  t.test('war path A (Erratic): d300 <= difficulty — never on Simple; path E (hatred pile-on): Average+, wars < difficulty, rel < -30, d10 <= -rel/10', () => {
    const er = (diff, k) => { const S = warGame({ pers: ERR, obj: 0, diff }); const went = D._.warCheck(S, fakeR([k]), 0, 1); return went && rel(S, 0, 1).treaty === T.WAR; };
    t.eq(er(2, 2), true); t.eq(er(2, 3), false); t.eq(er(4, 4), true); t.eq(er(4, 5), false); t.eq(er(1, 1), true); t.eq(er(0, 1), false, 'Simple never');
    const S0 = warGame({ pers: ERR, obj: 0, diff: 2 }); D._.warCheck(S0, fakeR([2]), 0, 1); t.eq(rel(S0, 0, 1).dipType, 61);
    const pile = (diff, rl, d10, wars) => { const S = warGame({ pers: PACI, obj: 0, diff, rel: { rel1: rl } }); for (let k = 0; k < wars; k++) setAll(S, 0, 2 + k, { treaty: T.WAR }); D._.warCheck(S, fakeR([19, 19, d10]), 0, 1); return rel(S, 0, 1).treaty === T.WAR; };
    t.eq(pile(2, -35, 3, 0), true); t.eq(pile(2, -35, 4, 0), false); t.eq(pile(2, -30, 1, 0), false, 'needs rel < -30'); t.eq(pile(1, -80, 1, 0), false, 'Easy: off');
    t.eq(pile(2, -80, 1, 1), true); t.eq(pile(2, -80, 1, 2), false, 'already two wars (< 2 required)'); t.eq(pile(3, -80, 1, 2), true); t.eq(pile(4, -99, 9, 3), true); t.eq(pile(4, -99, 10, 3), false, '-99/10 = 9');
    t.eq(pile(2, -100, 10, 0), true, 'at -100 it fires every turn');
  });
  t.test('wage_war_do: a treaty is only cancelled (Average+): alliance 1/4 (62.5 % Expansionist), NAP 1/2 (always Expansionist); relation capped at 30; no war in the same call', () => {
    const run = (treaty, obj, diff, seq) => { const S = warGame({ obj, diff, rel: { treaty, rel1: 80 } }); const ok = D._.warDo(S, fakeR(seq), 0, 1); return { ok, S, tr: rel(S, 0, 1).treaty }; };
    t.eq(run(T.ALLIANCE, MIL, 2, [0]).ok, true); t.eq(run(T.ALLIANCE, MIL, 2, [1, 0]).ok, false); t.eq(run(T.ALLIANCE, EXP, 2, [1, 0]).ok, true); t.eq(run(T.ALLIANCE, EXP, 2, [1, 1]).ok, false);
    t.eq(run(T.NAP, MIL, 2, [0]).ok, true); t.eq(run(T.NAP, MIL, 2, [1]).ok, false); t.eq(run(T.NAP, EXP, 2, [1]).ok, true, 'Expansionists always break a NAP');
    t.eq(run(T.NAP, EXP, 1, [0]).ok, false, 'Easy: never'); t.eq(run(T.ALLIANCE, EXP, 0, [0]).ok, false, 'Simple: never');
    const r = run(T.ALLIANCE, MIL, 2, [0]); t.eq(r.tr, T.NONE, 'no war yet'); t.eq(rel(r.S, 0, 1).rel1 <= 30, true); t.eq(rel(r.S, 0, 1).dipType, 32);
    const w = warGame({ rel: { rel1: -10 } }); D._.warDo(w, fakeR([]), 0, 1); t.eq(rel(w, 0, 1).treaty, T.WAR); t.eq(rel(w, 0, 1).dipType, 13);
    const w2 = warGame({ rel: { rel1: 10 } }); D._.warDo(w2, fakeR([]), 0, 1); t.eq(rel(w2, 0, 1).dipType, 60, 'cold calculation');
    const w3 = warGame({ rel: { ceasefire: 3 } }); t.eq(D._.warDo(w3, fakeR([]), 0, 1), false); t.eq(rel(w3, 0, 1).treaty, T.NONE);
  });
  t.test('hard-coded personality/objective facts: reldiff table, Expansionist treaty-breaking, Honorable excluded from fleet envy, Erratic random war', () => { t.deep(D.RELDIFF, [-50, -30, -20, 0, 10, 20]); t.deep(D.PERSONALITIES, ['xenophobic', 'ruthless', 'aggressive', 'erratic', 'honorable', 'pacifistic']); });

  // ══════════════════════════════════════ AI ↔ AI, AI → human ═══════════════════════════════════════════════════════════════════════
  t.test('AI↔AI tick: v + mood_treaty > 150 allies at once (even out of a war); an alliance that rolls again becomes a NAP (v1.3 oscillation, CFG.aiAllianceToggle)', () => {
    const mkp = () => { const S = mk({ races: ['mrrshan', 'psilon', 'darlok', 'sakkra'], allAI: true, diff: 4 }); contactAll(S); return S; };         // gate 1/7
    let S = mkp(); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100 });
    D._.aiAiTurn(S, fakeR([0, 51])); t.eq(rel(S, 0, 1).treaty, T.ALLIANCE, 'd100 51 + 100 > 150'); t.eq(diploEvents(S, 'allianceFormed').length, 1);
    S = mkp(); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100 }); D._.aiAiTurn(S, fakeR([0, 50])); t.eq(rel(S, 0, 1).treaty, T.NONE);
    S = mkp(); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100, treaty: T.WAR }); D._.aiAiTurn(S, fakeR([0, 51])); t.eq(rel(S, 0, 1).treaty, T.ALLIANCE, 'straight from war');
    S = mkp(); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100, treaty: T.ALLIANCE }); D._.aiAiTurn(S, fakeR([0, 31])); t.eq(rel(S, 0, 1).treaty, T.NAP, 'alliance bonus +20 → 51 + 100 > 150 downgrades');
    D.CFG.aiAllianceToggle = false; try { S = mkp(); setAll(S, 0, 1, { rel1: 0, moodTreaty: 100, treaty: T.ALLIANCE }); D._.aiAiTurn(S, fakeR([0, 31])); t.eq(rel(S, 0, 1).treaty, T.ALLIANCE); } finally { D.CFG.aiAllianceToggle = true; }
    S = mkp(); setAll(S, 0, 1, { rel1: 30, moodTreaty: 100, treaty: T.NAP }); D._.aiAiTurn(S, fakeR([0, 11])); t.eq(rel(S, 0, 1).treaty, T.ALLIANCE, 'NAP +10: 30 + 11 + 10 + 100 > 150');
  });
  t.test('AI↔AI tick: trade when v > 70 (min(prod/4)), annoy(3) after every tick, allies join each other\'s wars every turn, war ends when stale v + mood_peace > 100', () => {
    const mkp = () => { const S = mk({ races: ['mrrshan', 'psilon', 'darlok', 'sakkra'], allAI: true, diff: 4 }); contactAll(S); return S; };
    let S = mkp(); setAll(S, 0, 1, { rel1: 40, moodTreaty: 0 }); D._.aiAiTurn(S, fakeR([0, 40]));                                  // v = 80 > 70
    t.eq(rel(S, 0, 1).trade, 50, 'min(200/4, 200/4)'); t.eq(rel(S, 1, 0).tradePct, -30); t.eq(rel(S, 0, 1).moodTech, -30, 'annoy(3)'); t.eq(rel(S, 1, 0).moodTech, 0, 'only the ticking side');
    S = mkp(); setAll(S, 0, 1, { treaty: T.ALLIANCE, rel1: 0, moodTreaty: -200 }); setAll(S, 0, 2, { treaty: T.WAR }); D._.aiAiTurn(S, fakeR([]));
    t.eq(rel(S, 1, 2).treaty, T.WAR, 'the ally joins'); t.eq(rel(S, 3, 2).treaty, T.NONE);
    S = mkp(); setAll(S, 0, 1, { treaty: T.WAR, rel1: -25, moodTreaty: -200, moodPeace: 95 }); D._.aiAiTurn(S, fakeR([0, 1, 5, 6])); t.eq(rel(S, 0, 1).treaty, T.NONE, 'stale v 6 + peace mood 95 = 101 > 100: peace');
    S = mkp(); setAll(S, 0, 1, { treaty: T.WAR, rel1: -25, moodTreaty: -200, moodPeace: 95 }); D._.aiAiTurn(S, fakeR([0, 1, 5, 5])); t.eq(rel(S, 0, 1).treaty, T.WAR, '100 is not > 100');
  });
  t.test('AI→human proposals: NAP when rel > 15 and v + d100 + mood > 50 (24); alliance supersedes at rel > 50 (25); sweeteners only for Aggressive..Pacifistic; none while its fleets fly to your colonies', () => {
    const prop = (o, seq) => { const S = accGame(Object.assign({ pers: HONOR }, o, { rel: Object.assign({ moodTrade: -300, moodTech: -300 }, o && o.rel) })); const A = S.empires[1], H = S.empires[0]; if (o && o.fleet) S.fleets.push({ id: 99, owner: 1, star: -1, from: 2, to: 0, x: 0, y: 0, speed: 3, ships: [1, 0, 0, 0, 0, 0] });
      const r = rel(S, 0, 1), ex = {}; D._.proposals(S, fakeR(seq), H, A, r, ex); return { type: r.dipType, ex, S }; };
    t.eq(prop({ rel: { rel1: 16 } }, [1, 100]).type, 24); t.eq(prop({ rel: { rel1: 15 } }, [1, 100]).type, 0, 'needs rel > 15');
    t.eq(prop({ race: 'klackon', pers: XENO, rel: { rel1: 20, moodTreaty: 0 } }, [1, 20]).type, 0, 'v = 20 - 50 + 0 + 20 = -10 <= 50');
    t.eq(prop({ rel: { rel1: 51 } }, [1, 100, 100]).type, 25); t.eq(prop({ rel: { rel1: 51, treaty: T.NAP } }, [1, 100]).type, 25);
    t.eq(prop({ rel: { rel1: 30 }, fleet: true }, [1, 100]).type, 0, 'an AI fleet is heading for the human colony');
    t.eq(prop({ rel: { rel1: 16, treaty: T.WAR } }, [1, 100]).type, 0);
    const sw = prop({ rel: { rel1: 20 } }, [1, 100, 150, 1, 1, 2]);                                                                // sweetener: d100 <= 30·prodH/prodA = 30, 1 in 8, then BC
    t.eq(sw.type, 24);
  });
  t.test('AI→human reactions: relation <= -95 declares war; an angry AI warns (+38) then cancels the treaty (+46) then fights; a war-weary AI offers peace', () => {
    const base = (relv, extra) => { const S = accGame({ pers: ERR, rel: Object.assign({ rel1: relv }, extra || {}) }); return S; };
    let S = base(-95); let r = rel(S, 0, 1); r.dipVal = -10; r.dipType = 9; D._.reaction(S, fakeR([]), S.empires[0], S.empires[1], r, {}); t.eq(r.dipType, 13); t.eq(r.treaty, T.WAR);
    S = base(-20, { treaty: T.NAP, moodTreaty: -80 }); r = rel(S, 0, 1); r.dipVal = -10; r.dipType = 9; D._.reaction(S, fakeR([1]), S.empires[0], S.empires[1], r, {});
    t.eq(r.hatred, 1); t.eq(r.dipType, 47, 'warning about offence 9'); t.eq(r.treaty, T.NAP);
    D._.reaction(S, fakeR([1]), S.empires[0], S.empires[1], r, {}); t.eq(r.hatred, 2); t.eq(r.treaty, T.NONE, 'treaty cancelled'); t.eq(r.dipType, 47 + 46);
    S = base(-20, { moodTreaty: -80, hatred: 2 }); r = rel(S, 0, 1); r.dipVal = -10; r.dipType = 9; D._.reaction(S, fakeR([1, 5]), S.empires[0], S.empires[1], r, {}); t.eq(r.hatred, 1, 'reset to 1 once the war starts'); t.eq(r.treaty, T.WAR, 'hatred > 2: war roll d100 5 < -(0 + -10)'); t.eq(r.dipType, 13);
    S = base(-20, { moodTreaty: 100 }); r = rel(S, 0, 1); r.dipVal = -10; r.dipType = 9; D._.reaction(S, fakeR([1]), S.empires[0], S.empires[1], r, {}); t.eq(r.hatred, 0, 'not angry enough: nothing');
    S = base(-25, { treaty: T.WAR, moodPeace: 100 }); r = rel(S, 0, 1); D._.reaction(S, fakeR([50, 0, 100]), S.empires[0], S.empires[1], r, {}); t.eq(r.dipType, 30, 'peace offer');
    S = base(-25, { treaty: T.WAR, moodPeace: 100 }); r = rel(S, 0, 1); D._.reaction(S, fakeR([50, 1]), S.empires[0], S.empires[1], r, {}); t.eq(r.dipType, 0, '1-in-8 failed');
  });
  t.test('AI→human audiences: interrupts carry personality text, options and answers that apply the deal; a rejected NAP is not signed; "what if we also offered…" chains a second page', () => {
    const S = accGame({ pers: AGGR }); const H = S.empires[0], A = S.empires[1], r = rel(S, 0, 1), out = [];
    D._.buildAudience(S, H, A, r, 24, { offer: { bc: 100 } }, out);
    t.eq(out.length, 1); t.eq(out[0].type, 'diplomacy'); t.eq(out[0].kind, 'offerNap'); t.eq(out[0].text.situation, 'offerNap'); t.eq(out[0].text.personality, 'aggressive'); t.eq(out[0].greeting.situation, 'greeting'); t.deep(out[0].options.map(o => o.id), ['accept', 'reject']);
    out[0].answer('reject'); t.eq(out.length, 2, 'the incentive page follows'); t.eq(out[1].incentive.bc, 100); t.eq(rel(S, 0, 1).treaty, T.NONE);
    const m0 = rel(S, 0, 1).moodTreaty; out[1].answer('accept'); t.eq(rel(S, 0, 1).treaty, T.NAP); t.eq(S.empires[0].bc, 600); t.eq(S.empires[1].bc, 400); t.eq(rel(S, 0, 1).moodTreaty < m0 - 20, true, 'after every AI audience: -10 and d30+20 on the topic');
    const S2 = accGame(); const o2 = []; D._.buildAudience(S2, S2.empires[0], S2.empires[1], rel(S2, 0, 1), 24, {}, o2); o2[0].answer(undefined); t.eq(rel(S2, 0, 1).treaty, T.NAP, 'no answer = yes (headless default)');
    const S3 = accGame(); const o3 = []; D._.buildAudience(S3, S3.empires[0], S3.empires[1], rel(S3, 0, 1), 24, {}, o3); o3[0].answer('reject'); t.eq(rel(S3, 0, 1).treaty, T.NONE); t.eq(o3.length, 1);
    // the demand to break an alliance with the AI's enemy comes first (type 27): agree → you break it, forget it → relation -100
    const S4 = accGame(); setAll(S4, 0, 2, { treaty: T.ALLIANCE }); setAll(S4, 1, 2, { treaty: T.WAR }); const o4 = []; D._.buildAudience(S4, S4.empires[0], S4.empires[1], rel(S4, 0, 1), 24, {}, o4);
    t.eq(o4[0].kind, 'demandBreak'); t.eq(o4.length, 1); o4[0].answer('agree'); t.eq(rel(S4, 0, 2).treaty, T.NONE); t.eq(o4.length, 2); t.eq(o4[1].kind, 'offerNap');
    const S5 = accGame(); setAll(S5, 0, 2, { treaty: T.ALLIANCE }); setAll(S5, 1, 2, { treaty: T.WAR }); const o5 = []; D._.buildAudience(S5, S5.empires[0], S5.empires[1], rel(S5, 0, 1), 24, {}, o5); o5[0].answer('forget'); t.eq(rel(S5, 0, 1).rel1, -100); t.eq(o5.length, 1);
  });
  t.test('sub2 / callToArms clears a queued dipType unless it queues 76 (research/05-verification MEDIUM)', () => {
    const S = accGame({ rel: { treaty: T.NAP, rel1: 60 } }), r = rel(S, 0, 1); r.dipType = 2;
    D._.callToArms(S, null, S.empires[0], S.empires[1], r, {}); t.eq(r.dipType, 0, 'not allied: nothing survives');
    const S2 = accGame({ rel: { treaty: T.ALLIANCE, rel1: 60 } }); setAll(S2, 1, 2, { treaty: T.WAR }); const r2 = rel(S2, 0, 1);
    let got = 0; for (let k = 0; k < 200 && !got; k++) { r2.dipType = 2; const ex = {}; D._.callToArms(S2, { next: () => 0, int: () => 0 }, S2.empires[0], S2.empires[1], r2, ex); if (r2.dipType === 76) got = ex.target; }
    t.ok(got > 0 || r2.dipType === 76 || r2.dipType === 0, 'either 76 with a target or cleared');
  });
  t.test('ally requests: Agree joins the war (78), refusing breaks the alliance (77); a bounty offer is remembered; the v1.3 "payment" delivers nothing', () => {
    const S = accGame({ rel: { treaty: T.ALLIANCE, rel1: 60 } }); setAll(S, 1, 2, { treaty: T.WAR }); const out = [];
    D._.buildAudience(S, S.empires[0], S.empires[1], rel(S, 0, 1), 76, { target: 2 }, out); t.eq(out[0].kind, 'callToArms'); out[0].answer('agree');
    t.eq(rel(S, 0, 2).treaty, T.WAR); t.eq(out[1].kind, 'allyThanks'); t.eq(out[1].msgType, 78);
    const S2 = accGame({ rel: { treaty: T.ALLIANCE, rel1: 60 } }); setAll(S2, 1, 2, { treaty: T.WAR }); const o2 = []; D._.buildAudience(S2, S2.empires[0], S2.empires[1], rel(S2, 0, 1), 76, { target: 2 }, o2); o2[0].answer('refuse');
    t.eq(rel(S2, 0, 1).treaty, T.NONE); t.eq(o2[1].msgType, 77);
    const S3 = accGame(); setAll(S3, 1, 2, { treaty: T.WAR }); const o3 = []; D._.buildAudience(S3, S3.empires[0], S3.empires[1], rel(S3, 0, 1), 28, { bounty: { x: 2, bc: 200, field: -1, level: 0, name: '' } }, o3);
    t.eq(rel(S3, 1, 0).bounty.x, 2); t.eq(rel(S3, 1, 0).bounty.collect, false);
    D.incident(S3, 'combat', 0, 2, 40, { planet: 4 }); t.eq(rel(S3, 1, 0).bounty.collect, true, 'earned by hurting X (offense >= 30)');
    const o4 = []; const b0 = S3.empires[0].bc; D._.buildAudience(S3, S3.empires[0], S3.empires[1], rel(S3, 0, 1), 58, {}, o4); t.eq(S3.empires[0].bc, b0, 'v1.3: the message arrives, the reward does not'); t.eq(rel(S3, 1, 0).bounty, null);
    D.CFG.bountyPaid = true; try { const S4 = accGame(); rel(S4, 1, 0).bounty = { x: 2, bc: 200, field: -1, level: 0, name: '' }; const o5 = []; D._.buildAudience(S4, S4.empires[0], S4.empires[1], rel(S4, 0, 1), 58, {}, o5); t.eq(S4.empires[0].bc, 700); } finally { D.CFG.bountyPaid = false; }
  });
  t.test('Diplo.turn end-to-end: a human who just earned DP can get proposals; a war is announced as a "warDeclared" audience; answers can be undefined', () => {
    const S = accGame({ pers: ERR, rel: { rel1: 30 } }); rel(S, 0, 1).dipVal = 40; rel(S, 0, 1).dipType = 2;
    const out = D.turn(S, fakeR([1, 1, 0, 100])); t.eq(Array.isArray(out), true);
    const W = warGame({ rel: { rel1: -10 } }); const o2 = []; D._.warCheck(W, fakeR([0, 121]), 0, 1); t.eq(rel(W, 0, 1).dipType, 13);
    D._.dispatch(W, fakeR([]), W.empires[0], W.empires[1], o2); t.eq(o2[0].kind, 'warDeclared'); t.eq(o2[0].text.situation, 'declareWar'); o2[0].answer(undefined);
  });

  // ══════════════════════════════════════ incidents (research/05 §4.2.3) ═══════════════════════════════════════════════════════════════
  t.test('incidents: spy identified -(5d12), sabotage -(d20+20), frame-ups -(d12+d12)/-(d16+d16), popKilled -(d5+5)·pop, AI invasion -(d4+4), council votes +24/-12/-6, border -10', () => {
    const base = () => accGame({ pers: ERR });
    let S = base(); t.eq(D.incident(S, 'spyTheft', 0, 1, 30), -30); t.deep([rel(S, 0, 1).dipType, rel(S, 0, 1).dipVal], [4, -30]);
    S = base(); withRng(fakeR([]), () => D.incident(S, 'spyTheft', 0, 1)); t.eq(rel(S, 1, 0).rel1, -60, '5d12 with every die at 12');
    S = base(); t.eq(withRng(fakeR([20]), () => D.incident(S, 'sabotage', 0, 1)), -40); t.eq(rel(S, 0, 1).dipType, 6);
    S = base(); t.eq(withRng(fakeR([12, 12]), () => D.incident(S, 'spyFrameTheft', 0, 1)), -24); t.eq(rel(S, 0, 1).dipType, 5);
    S = base(); t.eq(withRng(fakeR([16, 16]), () => D.incident(S, 'spyFrameSabotage', 0, 1)), -32); t.eq(rel(S, 0, 1).dipType, 7);
    S = base(); t.eq(withRng(fakeR([5]), () => D.incident(S, 'popKilled', 0, 1, 3)), -30);
    S = base(); t.eq(withRng(fakeR([4]), () => D.incident(S, 'aiGround', 2, 1)), -8);
    S = base(); t.eq(D.incident(S, 'councilVote', 2, 1, 24), 24); t.eq(D.incident(S, 'councilVote', 2, 1, -12), -12 * 2, 'doubled: the relation is good now');
    S = base(); D.incident(S, 'border', 0, 1, undefined, { planet: 2 }); t.eq(rel(S, 1, 0).rel1, -10); t.eq(rel(S, 0, 1).dipType, 8);
  });
  t.test('battle fallout: offense = max(5·pop lost, min(apparent force, 50), 10·bio); bio weapons first anger every AI by 10 (type 11), then the injured one by the offense', () => {
    let S = accGame(); t.eq(D.incident(S, 'combat', 0, 1, undefined, { popLost: 3, force: 12 }), 15); t.eq(rel(S, 1, 0).rel1, -15); t.eq(rel(S, 0, 1).dipType, 10);
    S = accGame(); D.incident(S, 'combat', 0, 1, undefined, { force: 80 }); t.eq(rel(S, 1, 0).rel1, -50, 'capped at 50'); t.eq(rel(S, 0, 1).dipType, 9);
    S = accGame(); D.incident(S, 'combat', 0, 1, undefined, { bio: 2 }); t.eq(rel(S, 1, 0).rel1, -30, '-10 first, then -20'); t.eq(rel(S, 2, 0).rel1, 0 - 10); t.eq(rel(S, 3, 0).rel1, -12 - 10, 'Darloks start at -12'); t.eq(rel(S, 0, 1).dipType, 11);
    S = accGame(); setAll(S, 1, 3, { treaty: T.WAR }); S.planets.forEach(p => { if (p.owner === 1) p.owner = -1; });                         // the injured empire lost its last planet: enemies of the victim thank us
    D.incident(S, 'combat', 0, 1, undefined, { force: 40 }); t.eq(rel(S, 3, 0).rel1, 10, '+offense (doubled, but a repaired relation never passes +10)');
  });
  t.test('conquest: capturing an AI planet costs -(51..100) and the AI declares war (type 13); at war it is only an incident; the human takes no break-treaty penalty (v1.3)', () => {
    for (let i = 0; i < 40; i++) {
      const S = accGame({ rel: { treaty: T.NAP, rel1: 50 } }); S.diplo.log.length = 0; D.incident(S, 'capture', 0, 1, undefined, { planet: 2 });
      t.eq(rel(S, 0, 1).treaty, T.WAR); t.eq(rel(S, 0, 1).dipType, 13); t.between(rel(S, 0, 1).rel1, -100, -75); t.eq(rel(S, 0, 1).trust, 0, 'the AI victim is the charged oath-breaker'); t.eq(rel(S, 1, 0).trust > 0, true);
    }
    const S = accGame({ rel: { treaty: T.WAR, rel1: -60 } }); t.eq(D.incident(S, 'capture', 0, 1, undefined, {}), 0, 'at war the hostile act only dents the peace mood');
    D.CFG.capturePaysAI = false; try { const W = accGame({ rel: { treaty: T.NAP, rel1: 50 } }); D.incident(W, 'capture', 0, 1); t.eq(rel(W, 0, 1).trust > 0, true, 'Classic+ charges the human'); } finally { D.CFG.capturePaysAI = true; }
  });
  t.test('genocide: the killer of a wiped-out empire loses 36 DP with everybody; incident events pushed into S.ev are drained by Diplo.turn; owner tracking names the killer', () => {
    let S = accGame(); D.empireDied(S, 3, 0); t.eq(rel(S, 1, 0).rel1, -36); t.eq(rel(S, 2, 0).rel1, -36);
    S = accGame(); S.ev.push({ type: 'incident', kind: 'bio', from: 0, to: 1 }); D.turn(S, fakeR([])); t.eq(rel(S, 1, 0).rel1 <= -20, true); t.eq(S.ev.some(e => e.type === 'incident'), false);
    S = accGame(); D.preTurn(S, fakeR([])); const p = S.planets.find(q => q.owner === 3); p.owner = 0; S.planets.forEach(q => { if (q.owner === 3) q.owner = 0; }); S.empires[3].alive = false;
    D.preTurn(S, fakeR([])); t.eq(S.diplo.lastTaker[3], 0); t.eq(S.diplo.dead[3], true); t.eq(rel(S, 1, 0).rel1 <= -36, true);
  });

  // ══════════════════════════════════════ orders, combat gate, final war, determinism ═══════════════════════════════════════════════════
  t.test('orders: AI declareWar/breakTreaty(expand → relation capped 30/20, type-32 notice)/breakTrade/tribute/propose; humans cannot declare war; proposals to a human are queued', () => {
    const O = M.Sim.Orders; let S = accGame();
    t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'declareWar' }).ok, true); t.eq(rel(S, 1, 2).treaty, T.WAR); t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'declareWar' }).ok, false);
    t.eq(O.apply(S, 0, { t: 'diplomacy', to: 1, act: 'declareWar' }).ok, false, 'humans use threats'); t.eq(O.apply(S, 1, { t: 'diplomacy', to: 9, act: 'declareWar' }).ok, false);
    S = accGame(); setAll(S, 1, 0, { treaty: T.ALLIANCE, rel1: 90 }); t.eq(O.apply(S, 1, { t: 'diplomacy', to: 0, act: 'breakTreaty', expand: true }).ok, true);
    t.eq(rel(S, 0, 1).treaty, T.NONE); t.eq(rel(S, 0, 1).rel1 <= 30, true); t.eq(rel(S, 0, 1).dipType, 32);
    S = accGame(); setAll(S, 1, 2, { treaty: T.NAP, rel1: 90 }); O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'breakTreaty', expand: true }); t.eq(rel(S, 1, 2).rel1 <= 20, true);
    t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'breakTreaty' }).ok, false, 'nothing left to break');
    S = accGame({ rel: { trade: 50 } }); t.eq(O.apply(S, 0, { t: 'diplomacy', to: 1, act: 'breakTrade' }).ok, true); t.eq(rel(S, 0, 1).trade, 0);
    S = accGame(); setAll(S, 1, 2, { rel1: 20, moodTreaty: 100 }); t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'propose', kind: 'nap' }).accepted, true); t.eq(rel(S, 1, 2).treaty, T.NAP);
    S = accGame(); setAll(S, 1, 2, { rel1: 5 }); t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'propose', kind: 'nap' }).accepted, false);
    S = accGame(); S.empires[1].bc = 300; t.eq(O.apply(S, 1, { t: 'diplomacy', to: 2, act: 'tribute', bc: 100 }).ok, true); t.eq(S.empires[2].bc, 600); t.eq(S.empires[1].bc, 200);
    S = accGame({ pers: ERR }); setAll(S, 0, 1, { moodTreaty: 100 }); const q = O.apply(S, 1, { t: 'diplomacy', to: 0, act: 'propose', kind: 'nap' }); t.eq(q.queued, true); t.eq(S.diplo.inbox.length, 1);
    const out = D.turn(S, fakeR([])); t.eq(out.length, 1); t.eq(out[0].kind, 'offerNap'); out[0].answer('accept'); t.eq(rel(S, 0, 1).treaty, T.NAP); t.eq(S.diplo.inbox.length, 0);
    S = accGame({ rel: { rel1: 60 } }); t.eq(O.apply(S, 0, { t: 'diplomacy', to: 1, act: 'propose', kind: 'nap' }).accepted, true, 'a human order goes through the audience engine');
    S = accGame(); S.empires[0].bc = 500; t.eq(O.apply(S, 0, { t: 'diplomacy', to: 1, act: 'tribute', bc: 100 }).ok, true); t.eq(O.apply(S, 0, { t: 'diplomacy', to: 1, act: 'bogus' }).ok, false);
  });
  t.test('canFight (combat gate): allies never fight, NAP partners only at a planet of one of them, everybody else fights; an AI attacker withdraws from a human under a cease-fire', () => {
    const S = accGame(); const f = (a, b, owner) => D.canFight(S, a, b, owner);
    t.eq(f(1, 2, -1), true); t.eq(f(1, 2, 3), true, 'no treaty: they fight');
    setAll(S, 1, 2, { treaty: T.ALLIANCE }); t.eq(f(1, 2, 1), false); setAll(S, 1, 2, { treaty: T.NAP }); t.eq(f(1, 2, -1), false); t.eq(f(1, 2, 3), false); t.eq(f(1, 2, 1), true); t.eq(f(2, 1, 1), true);
    setAll(S, 1, 2, { treaty: T.WAR }); t.eq(f(1, 2, 3), true);
    setAll(S, 0, 1, { ceasefire: 5 }); t.eq(f(1, 0, 0), false, 'AI attacker stands down'); t.eq(f(0, 1, 1), true, 'a human attacker does not'); t.eq(f(1, 1, 1), false);
    t.eq(D.atWar(S, 1, 2), true); t.eq(D.isAllied(S, 1, 2), false); t.eq(D.hostile, D.canFight);
  });
  t.test('final war: refusers fight everybody else (Final War, -100), the rest are allied (+100); diplomacy is off; each side pools its techs every turn', () => {
    const S = accGame(); const lv = levelsIn(5, 9, 2, ['beam', 'rocket']); grant(S, 1, 5, lv[0]); grant(S, 2, 5, lv[1]); grant(S, 0, 5, lv[0]);
    D.finalWar(S, [0]);
    t.eq(rel(S, 0, 1).treaty, T.FINAL_WAR); t.eq(rel(S, 1, 0).rel1, -100); t.eq(rel(S, 1, 2).treaty, T.ALLIANCE); t.eq(rel(S, 2, 3).rel1, 100); t.eq(D.atWar(S, 0, 2), true); t.eq(D.status(S, 0, 1).canAudience, false);
    t.eq(D.propose(S, 0, 1, { kind: 'nap' }).ok, false); t.eq(D.audience(S, 0, 1).ok, false); t.eq(D.act(S, 5, 1, 2, 0), 0);
    D.economyTurn(S, fakeR([])); t.eq(S.empires[2].research.completed[5].indexOf(lv[0]) >= 0, true, 'pooled'); t.eq(S.empires[1].research.completed[5].indexOf(lv[1]) >= 0, true); t.eq(S.empires[3].research.completed[5].indexOf(lv[1]) >= 0, true);
    t.eq(S.empires[0].research.completed[5].indexOf(lv[1]) >= 0, false, 'a lone refuser gets nothing');
    t.eq(D.turn(S, fakeR([])).length, 0, 'no AI audiences');
  });
  t.test('determinism and persistence: the same seed gives the same diplomatic history; S survives a JSON round trip', () => {
    const run = () => {
      const S = mk({ races: RACES.slice(0, 6), allAI: true, pers: [XENO, RUTH, AGGR, ERR, HONOR, PACI], obj: [1, 2, 1, 2, 0, 3], seed: 'det' }); contactAll(S); const R = M.RNG.bind(S.rs);
      for (let i = 0; i < 80; i++) { S.turn = i; S.year = i + 1; D.preTurn(S, R); D.economyTurn(S, R); D.turn(S, R); S.ev = []; }
      return S;
    };
    const a = run(), b = run(); t.eq(JSON.stringify(a.diplo.log), JSON.stringify(b.diplo.log)); t.eq(JSON.stringify(a.empires.map(e => e.relations)), JSON.stringify(b.empires.map(e => e.relations)));
    const c = JSON.parse(JSON.stringify(a)); t.eq(JSON.stringify(c.diplo), JSON.stringify(a.diplo)); t.eq(D.isAllied(c, 0, 1), D.isAllied(a, 0, 1));
    t.eq(a.diplo.log.length > 5, true, 'something happened');
  });
  t.test('scripted 150-turn world (6 AIs, fleets and economies wobbling): alliances and wars appear at plausible rates, every record stays in range', () => {
    const S = mk({ races: RACES.slice(0, 6), allAI: true, pers: [XENO, RUTH, AGGR, ERR, HONOR, PACI], obj: [1, 2, 1, 2, 0, 3], seed: 'sc', diff: 3 }); contactAll(S); const R = M.RNG.bind(S.rs), W = real('wob');
    for (let i = 0; i < 150; i++) {
      S.turn = i; S.year = i + 1;
      for (const p of S.planets) if (p.owner >= 0) { p.gross = Math.max(20, Math.round(p.gross * (0.97 + W.next() * 0.07))); p.spendable = p.gross; }
      S.fleets.length = 0; for (const E of S.empires) addFleet(S, E.id, [0, W.int(0, 6), W.int(0, 6), W.int(0, 3), 0, 0]);
      D.preTurn(S, R); D.economyTurn(S, R); D.turn(S, R); S.ev = [];
    }
    const k = {}; for (const x of S.diplo.log) k[x.k] = (k[x.k] || 0) + 1;
    t.eq((k.alliance || 0) > 0, true, 'alliances form'); t.eq((k.war || 0) <= 40, true, 'wars stay rare: ' + (k.war || 0)); t.eq((k.trade || 0) > 0, true, 'trade agreements appear');
    for (const E of S.empires) for (const r of E.relations) { t.between(r.rel1, -100, 100); t.between(r.treaty, 0, 4); t.eq(r.trade >= 0, true); t.eq(Number.isInteger(r.rel1), true); }
    t.eq(S.diplo.log.length <= 600, true);
  });
  t.test('real game end-to-end: Setup.create + Turn.run for 100 turns with a human, everybody in contact, no exceptions, interrupts well-formed', () => {
    if (!M.Sim.Setup || !M.Data.Races || !M.Sim.Design) t.skip('game modules not loaded');
    const S = M.Sim.Setup.create({ size: 'medium', difficulty: 'average', opponents: 4, race: 'human', seed: 'e2e' }); for (const e of S.empires) e.mods.fuel = 99;
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const gen = M.Sim.Turn.run(S); let r = gen.next();
      while (!r.done) { const it = r.value; let ans; if (it.type === 'diplomacy') { n++; t.eq(typeof it.answer, 'function'); t.eq(typeof it.text.situation, 'string'); t.eq(Array.isArray(it.options), true); t.ok(M.Data.text.diplomacy[it.text.personality][it.text.situation], 'dialogue line exists for ' + it.text.situation); }
        else if (it.type === 'techChoice') ans = it.choices[0] ? it.choices[0].level : 0; else if (it.type === 'colonize') ans = true; r = gen.next(ans); }
      if (r.value) break;
    }
    t.eq(n > 0, true, 'the human was spoken to'); t.eq(JSON.parse(JSON.stringify(S)).diplo.log.length, S.diplo.log.length);
  });
}
