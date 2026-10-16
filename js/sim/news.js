// GNN news compiler. Modules push {type:'news', cat, empire?, empire2?, star?, planet?, tech?, field?, n?, bc?, ships?, importance?, graphic?} into S.ev;
// News.compile(S,R) turns them (plus milestones, rankings and ticker lines) into the `gnn` interrupt the UI broadcasts, and appends S.newsLog for the archive.
// Templates live in MOO.Data.text.news (main thread / headless only — the compiler is never run inside workers).
MOO.def(function (M) {
  'use strict';
  const N = M.Sim.News = {};
  // What interrupts the player with a newscast (importance >= 1) and what only goes to the archive (0). The original's GNN has 22 news types
  // (research/05 §11.2): random events, monsters, the stars report, the rankings filler, genocide, the Guardian, coups, Orion — never a fleet
  // skirmish, a first contact (that is the audience), a colony founded or a treaty signed. Reporting every AI-vs-AI fleet kill made the
  // broadcast worthless (83 newscasts in 200 turns, half of a session's clicks); battles are archived, the human's own are shown as battles.
  // Kept beyond the original because they change the political map and the player would otherwise only see them in the Races screen:
  // wars, peace, alliances formed/broken, an emperor elected or refused, a planet changing hands by invasion when the human is not a party.
  const IMPORTANT = { empireDestroyed: 2, warDeclared: 2, guardianSlain: 2, planetDestroyed: 2, systemNova: 2, emperorElected: 2, councilRefused: 2, allianceFormed: 1, allianceBroken: 1, peaceTreaty: 1,
    antaranRaid: 2, plague: 1, monsterAttack: 1, monsterSpawn: 1, monsterKilled: 1, planetRebels: 1, piracy: 1, orionColonised: 1, coup: 1, starsReport: 1, rankings: 1 };
  // AI-vs-AI conquests are news (importance 1) only while the human is not a party: the human's own invasions have their ground-combat scene
  const PARTY_ARCHIVED = { invasionSuccess: 1 };
  const GRAPHIC = { battleWon: 'battle', battleLost: 'battle', fleetDestroyed: 'battle', invasionSuccess: 'battle', invasionRepelled: 'battle', bombardment: 'battle', guardianSlain: 'battle', monsterAttack: 'battle',
    colonyFounded: 'planet', colonyLost: 'planet', planetDestroyed: 'planet', systemNova: 'planet', terraform: 'planet', plague: 'planet', planetStarving: 'planet', planetRebels: 'planet',
    warDeclared: 'map', firstContact: 'map', peaceTreaty: 'map', allianceFormed: 'map', napSigned: 'map', empireDestroyed: 'map', economicBoom: 'chart', starsReport: 'map' };

  const text = () => (M.Data.text && M.Data.text.news) || {};
  const pick = (R, arr) => arr[R.int(0, arr.length - 1)];
  const fmt = (tpl, v) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));

  function vars(S, ev) {
    const E = id => (id !== undefined && id >= 0 ? S.empires[id] : null), a = E(ev.empire), b = E(ev.empire2);
    const rd = e => (e && M.Data.Races ? M.Data.Races.races[e.race] : null);
    const v = { year: M.Data.Config.displayYear(S), n: ev.n, bc: ev.bc, ships: ev.ships, tech: ev.tech, field: ev.field, treaty: ev.treaty, design: ev.design };
    if (a) { v.race = a.plural; v.adj = rd(a) ? rd(a).adj : a.name; v.leader = a.leader; }
    if (b) { v.race2 = b.plural; v.adj2 = rd(b) ? rd(b).adj : b.name; v.leader2 = b.leader; }
    if (ev.star !== undefined && ev.star >= 0) { v.star = S.stars[ev.star].name; v.planet = S.planets[ev.star].name || v.star; }
    if (ev.planet !== undefined && ev.planet >= 0) { v.planet = S.planets[ev.planet].name || S.stars[ev.planet].name; if (!v.star) v.star = S.stars[S.planets[ev.planet].starId].name; }
    return v;
  }

  N.line = function (S, R, cat, ev) {
    const T = text()[cat];
    if (!T || !T.length) return ev && ev.headline ? String(ev.headline) : null;          // events carry ready-made English for categories without a template
    return fmt(pick(R, T), vars(S, ev || {}));
  };
  const isHuman = (S, id) => id !== undefined && id >= 0 && !!(S.empires[id] && S.empires[id].human);
  function importanceOf(S, ev) {
    if (ev.importance !== undefined) return ev.importance;
    if (PARTY_ARCHIVED[ev.cat]) return isHuman(S, ev.empire) || isHuman(S, ev.empire2) ? 0 : 1;
    return IMPORTANT[ev.cat] || 0;
  }

  N.rankings = function (S) {
    const st = M.Sim.stats(S).filter(r => r.alive), W = [1, 5, 25, 125];
    const rows = (key, fn) => st.map(r => ({ empire: r.id, race: r.race, name: S.empires[r.id].plural, color: S.empires[r.id].color, value: Math.round(fn(r)) })).sort((x, y) => y.value - x.value);
    const fleet = r => { let t = 0; const E = S.empires[r.id]; for (const f of S.fleets) if (f.owner === r.id) for (let i = 0; i < 6; i++) if (f.ships[i] && E.designs[i]) t += f.ships[i] * W[E.designs[i].hull]; return t; };
    return { production: rows('p', r => r.production), research: rows('r', r => r.research), military: rows('m', fleet), population: rows('o', r => r.pop) };
  };

  N.compile = function (S, R) {
    const items = [], T = text();
    const evs = M.Sim.Ev.take(S, e => e.type === 'news');
    const seen = new Set();
    for (const ev of evs) {
      const line = N.line(S, R, ev.cat, ev); if (!line) continue;
      const key = ev.cat + '|' + line; if (seen.has(key)) continue; seen.add(key);
      items.push({ cat: ev.cat, headline: line, sub: ev.sub || null, graphic: ev.graphic || GRAPHIC[ev.cat] || 'ticker', planet: ev.planet !== undefined ? planetArt(S, ev.planet) : (ev.star !== undefined ? planetArt(S, ev.star) : null),
        star: ev.star !== undefined && ev.star >= 0 ? { name: S.stars[ev.star].name, kind: S.stars[ev.star].color } : null, race: ev.empire !== undefined && ev.empire >= 0 ? S.empires[ev.empire].race : null,
        race2: ev.empire2 !== undefined && ev.empire2 >= 0 ? S.empires[ev.empire2].race : null, importance: importanceOf(S, ev) });
    }
    // empires destroyed this turn (event from Turn.checkDeaths)
    for (const ev of M.Sim.Ev.take(S, e => e.type === 'empireDestroyed')) {
      const line = N.line(S, R, 'empireDestroyed', { empire: ev.empire }); if (line) items.push({ cat: 'empireDestroyed', headline: line, graphic: 'map', importance: 2, race: S.empires[ev.empire].race });
    }
    // STARS REPORT (research/05 §11.2 #19): fires when the LEADING empire's colonies reach 1/8, 1/4, 3/8, 1/2 of all stars (the last also at half − 2)
    const half = S.stars.length / 2;
    let lead = -1, leadN = 0;
    for (const e of S.empires) if (e.alive) { const n = S.planets.filter(p => p.owner === e.id).length; if (n > leadN) { leadN = n; lead = e.id; } }
    S.starsReports = S.starsReports | 0;
    while (lead >= 0 && S.starsReports < 4 && (leadN >= (S.starsReports + 1) * half / 4 || (S.starsReports === 3 && leadN >= half - 2))) {
      const line = N.line(S, R, 'starsReport', { empire: lead, n: leadN });
      if (line) items.push({ cat: 'starsReport', headline: line, graphic: 'chart', importance: 1, race: S.empires[lead].race });
      S.starsReports++;
    }
    // RANKINGS filler (§11.2 #20): after year 25, only when nothing else is in the news, 1 turn in 40 on average
    let rankings = null;
    if (!items.length && S.year > 25 && R.int(0, 39) === 0) {
      rankings = N.rankings(S);
      const keys = ['production', 'research', 'military', 'population'], key = keys[R.int(0, 3)], r = rankings[key] && rankings[key][0];
      const pool = T.rankings && T.rankings[key];
      if (r && pool && pool.length) items.push({ cat: 'rankings', headline: fmt(pick(R, pool), { race: r.name }), graphic: 'chart', importance: 1, race: r.race });
    }
    if (!items.length) return null;
    S.newsLog = S.newsLog || [];
    for (const it of items) S.newsLog.push({ year: M.Data.Config.displayYear(S), cat: it.cat, headline: it.headline, race: it.race || null, race2: it.race2 || null });
    if (S.newsLog.length > 600) S.newsLog.splice(0, S.newsLog.length - 600);
    // minor items (importance 0) are archived but never broadcast — not even as "also in the news" riders of a real bulletin (AI breakthroughs,
    // skirmishes and the like would otherwise pad every newscast)
    const bulletin = items.filter(it => it.importance >= 1);
    if (!bulletin.length) return null;
    const tick = (M.Data.text && M.Data.text.tickers) || [], ticker = [];
    for (let i = 0; i < 5 && tick.length; i++) ticker.push(pick(R, tick));
    return { type: 'gnn', year: M.Data.Config.displayYear(S), turn: S.turn, items: bulletin, rankings, ticker };
  };

  function planetArt(S, id) {
    const p = S.planets[id]; if (!p) return null;
    return { look: p.type === 'none' ? 'asteroids' : p.growth === 'gaia' ? 'gaia' : p.type, seed: p.id * 7919 + (p.gfx | 0), inhabited: p.owner >= 0, color: p.owner >= 0 ? null : null };
  }
});
