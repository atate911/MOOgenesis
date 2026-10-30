// Soundscape glue: chooses the music mood for the active screen and plays a few game-level cues. Everything is optional — if the audio engine is missing or locked, nothing happens.
//   Bus 'screen' (id, params) → Music.setMood(...) only when the mood GROUP changes (so galaxy → ledger → galaxy keeps the same track);
//   fights, landings and the chamber are led into by a bridge in their key; the map's programmes are directed (Music.setSituation each turn end)
//   Bus 'turn:end' → SFX 'newturn' · 'game:new' → SFX 'confirm' · 'game:quit' → title music
// Screens that run their own music (the GNN broadcast snapshots + restores it, menu starts 'title') are left alone; the lab and spy
// panels no longer borrow a cue of their own (their stingers play over the underscore, as a film would).
// The battle screen raises Music.setIntensity as ships die; leaving the combat group resets it, so the tension layers never leak
// into the exploration music.
(function (M) {
  'use strict';
  const UI = M.UI;
  const A = () => M.Audio || null;
  const music = () => (A() && A().Music) || null;
  let group = '';

  // screen id → [group, mood]. Unlisted screens keep whatever is playing.
  const MAP = {
    menu: ['title', 'title'], setup: ['title', 'title'], options: null, saveload: null,
    galaxy: ['galaxy', 'galaxy'], planets: null, fleets: null, overview: null, system: null,
    design: null, tech: null, techtree: null, research: null,          // management screens keep the underscore: no jump cuts for a menu
    combat: ['combat', 'combat'], landing: ['ground', 'ground'], ground: ['ground', 'ground'],
    council: ['council', 'council'],
  };

  // the underscore senses the empire: at war the exploration rotation turns to its determined, uneasy pieces
  function atWar() {
    try {
      const S = M.Game && M.Game.S; if (!S) return false;
      const me = S.empires[S.playerId]; if (!me || !me.relations) return false;
      return S.empires.some(e => e && e.alive !== false && e.id !== me.id && me.relations[e.id] && me.relations[e.id].treaty >= 3);
    } catch (e) { return false; }
  }
  let war = false;
  // the first years, before anyone has been met: the planetarium rotation (big sky, no choir or drums); contact, or time, opens the full programme
  function earlyYears() {
    try {
      const S = M.Game && M.Game.S; if (!S) return false;
      if ((S.turn || 0) >= 70) return false;
      const me = S.empires[S.playerId]; if (!me || !me.relations) return true;
      return !S.empires.some(e => e && e.alive !== false && e.id !== me.id && me.relations[e.id] && (me.relations[e.id].met || me.relations[e.id].contact));
    } catch (e) { return false; }
  }
  let early = false;
  const galaxyMood = () => (war ? 'galaxyWar' : (early || era < 0.3) ? 'galaxyEarly' : 'galaxy');

  // The era: how contentious the galaxy has become for the player, 0..1. The target is read from the state and starts moving about halfway
  // through a game, when the player's space is being crowded by foreign colonies, more races have been met than the first one or two, and
  // the fleets around the player are growing; cold relations and open wars push it on. The value follows the target slowly, a few
  // hundredths a turn, so the music tightens without anyone hearing it move; it reaches the music only when the next piece is compiled.
  let era = 0, eraSeeded = false;
  const HULL_W = [1, 5, 25, 125];
  // the reading of the state the era and the director share: {t, metK, met, n, crowd, arms, coldK, wars, own, stars}
  let reading = null;
  function eraTarget() { const r = readState(); reading = r; return r ? r.t : 0; }
  function readState() {
    try {
      const S = M.Game && M.Game.S; if (!S) return null;
      const me = S.empires[S.playerId]; if (!me || !me.relations) return null;
      const others = S.empires.filter(e => e && e.alive !== false && e.id !== me.id), n = Math.max(1, others.length);
      // who is met, who is cold, who is at war
      let met = 0, cold = 0, wars = 0;
      for (const e of others) { const r = me.relations[e.id]; if (!r || !(r.met || r.contact)) continue; met++; if (r.treaty >= 3) wars++; else if ((r.rel1 || 0) < -24) cold++; }
      const metK = Math.max(0, (met - 1) / Math.max(1, n - 1));                  // the first contact is wonder, not pressure
      // crowding: how many of the player's colonies have a foreign colony close by, and how many foreign colonies press on them
      let crowd = 0;
      if (S.stars && S.planets) {
        let xs = 0, ys = 0, xe = 0, ye = 0; for (const s of S.stars) { if (s.x < xs || !xs) xs = s.x; if (s.y < ys || !ys) ys = s.y; if (s.x > xe) xe = s.x; if (s.y > ye) ye = s.y; }
        const R = Math.hypot(xe - xs, ye - ys) * 0.16, mine = [], theirs = [];
        S.planets.forEach((p, i) => { if (p.owner === me.id) mine.push(S.stars[i]); else if (p.owner >= 0 && p.owner !== me.id) theirs.push(S.stars[i]); });
        if (mine.length && theirs.length) {
          let near = 0; const pressing = new Set();
          for (const a of mine) { let hit = false; theirs.forEach((b, j) => { if (Math.hypot(a.x - b.x, a.y - b.y) < R) { hit = true; pressing.add(j); } }); if (hit) near++; }
          crowd = Math.min(1, 0.5 * near / mine.length + 0.5 * Math.min(1, pressing.size / mine.length));
        }
      }
      // the arms race: the fleets of the empires the player has met, against the player's own and in absolute size
      let myFleet = 0, theirFleet = 0;
      for (const f of S.fleets || []) {
        const E = S.empires[f.owner]; if (!E || !f.ships) continue;
        let w = 0; for (let i = 0; i < 6; i++) if (f.ships[i]) { const d = E.designs && E.designs[i]; w += f.ships[i] * (d ? HULL_W[d.hull] || 1 : 1); }
        if (f.owner === me.id) myFleet += w; else if (me.relations[f.owner] && (me.relations[f.owner].met || me.relations[f.owner].contact)) theirFleet += w;
      }
      const arms = Math.min(1, 0.6 * theirFleet / (theirFleet + myFleet + 20) + 0.4 * Math.min(1, theirFleet / (60 * n)));
      const t = 0.2 * metK + 0.28 * crowd + 0.2 * arms + 0.12 * (met ? cold / met : 0) + 0.4 * Math.min(1, wars / 2);
      let own = 0; if (S.planets) for (const p of S.planets) if (p.owner === me.id) own++;
      const metIds = others.filter(e => { const r = me.relations[e.id]; return r && (r.met || r.contact); }).map(e => e.id + ':' + e.race);
      // the council: how near the next sitting is (0 far or not yet possible, 0.5 within six years, 1 within three or due)
      let council = 0; try { const C = M.Sim && M.Sim.Council, c = S.council; if (C && C.colonised && C.threshold && C.colonised(S) >= C.threshold(S) && !(c && (c.over || c.finalWar))) { const every = (M.Data && M.Data.Config && M.Data.Config.COUNCIL_EVERY) || 25, left = c && c.held ? (every - (S.year % every)) % every : 0; council = left <= 3 ? 1 : left <= 6 ? 0.5 : 0; } } catch (e) { council = 0; }
      return { t: Math.max(0, Math.min(1, t)), metK, met, n, crowd, arms, coldK: met ? cold / met : 0, wars, own, stars: S.stars ? S.stars.length : 1, myFleet, theirFleet, turn: S.turn || 0, metIds, council };
    } catch (e) { return null; }
  }
  // The director's situation: what the galaxy is like for the player right now, on the axes the pieces are tagged with. War and loss are
  // remembered for a while after they pass (a peace is not instantly calm; a lost colony is mourned for some turns).
  let warMem = 0, griefMem = 0, peakOwn = 0, peakFleet = 0, metSeen = null;
  // the story's motifs: a race just met puts the first bars of its theme into the next interlude; the council approaching, the procession's call
  function motifs(r) {
    const m = music(); if (!m || !m.setMotif) return;
    try {
      if (metSeen) { const fresh = r.metIds.filter(x => metSeen.indexOf(x) < 0); if (fresh.length) m.setMotif('race:' + fresh[fresh.length - 1].split(':')[1]); }
      else if (r.council >= 0.5 && !m.getMotif()) m.setMotif('procession');
    } catch (e) { /* audio optional */ }
    metSeen = r.metIds.slice();
  }
  function situation() {
    const r = reading || readState(); if (!r) return null;
    motifs(r);
    const warNow = r.wars > 0 ? 1 : 0; warMem = Math.max(warNow, warMem * 0.88);
    peakOwn = Math.max(peakOwn, r.own); peakFleet = Math.max(peakFleet, r.myFleet);
    const lost = peakOwn > 0 ? (peakOwn - r.own) / peakOwn : 0, fleetLost = peakFleet > 0 ? (peakFleet - r.myFleet) / peakFleet : 0;
    griefMem = Math.max(Math.min(1, lost * 2.5 + fleetLost * 0.8), griefMem * 0.9);
    peakOwn = Math.max(r.own, peakOwn * 0.995); peakFleet = Math.max(r.myFleet, peakFleet * 0.99);   // the peaks forget slowly, so a settled loss stops being news
    const metShare = r.n ? r.met / r.n : 0, tension = Math.min(1, 0.45 * r.coldK + 0.3 * r.crowd + 0.35 * r.arms + 0.15 * warMem);
    const solitude = Math.min(1, (1 - metShare) * (r.turn < 70 ? 1 : 0.85) + (metShare === 0 ? 0.15 : 0));
    const grandeur = Math.min(1, 0.55 * Math.min(1, r.own / Math.max(6, r.stars * 0.25)) + 0.45 * era);
    return { solitude, contact: metShare * (1 - 0.7 * warMem), tension, war: warMem, grief: griefMem, grandeur, energy: 0.5, dark: Math.min(1, 0.8 * Math.max(tension, griefMem, warMem)), council: r.council };
  }
  function eraStep() {
    const t = eraTarget();
    if (!eraSeeded) { era = t; eraSeeded = true; }                  // a loaded or new game starts where its state says, then drifts
    else era += (t - era) * (t > era ? 0.04 : 0.025);               // tightening takes ~60 turns to go most of the way; easing is slower still
    const m = music(); if (m && m.setEra) { try { m.setEra(era); if (m.setSituation) m.setSituation(situation()); } catch (e) { /* audio optional */ } }
  }
  function raceMood(params) {
    const S = M.Game && M.Game.S; if (!S || !params) return null;
    const e = S.empires[params.empire !== undefined ? params.empire : params.with];
    return e ? ['race:' + e.race, e.race] : null;
  }

  function moodFor(id, params) {
    if (id === 'audience' || id === 'races') return raceMood(params);
    if (id === 'endings' || id === 'ending') {
      const win = params && (params.kind === 'good' || params.kind === 'tyrant' || params.win);
      return win ? ['victory', 'victory'] : ['defeat', 'defeat'];
    }
    if (id === 'galaxy') { war = atWar(); early = earlyYears(); eraStep(); return ['galaxy', galaxyMood()]; }
    return MAP[id] || null;
  }
  // a declaration of war, a peace treaty or the first contact changes the map's programme at the end of the turn — softly: the piece that is
  // playing reaches its next breath or section line, an interlude in the new key follows, and only then the new programme's first piece
  function onTurnEnd() {
    UI.sfx('newturn');
    const m = music(); if (!m || !m.setMood || group !== 'galaxy') return;
    const before = galaxyMood();
    war = atWar(); early = earlyYears(); eraStep();
    if (galaxyMood() === before) return;
    try { m.setMood(galaxyMood(), { fade: 6, quantize: 'bar', soft: true }); } catch (e2) { /* audio optional */ }   // soft: the running piece reaches its next breath or section line first, then the new programme enters through an interlude
  }

  function onScreen(id, params) {
    const m = music(); if (!m || !m.setMood) return;
    const pick = moodFor(id, params); if (!pick) return;
    if (pick[0] === group) return;
    const from = group; group = pick[0];
    // a cue that cannot wait is led into by a two-bar bridge in its key (a tense one into a fight, a calm one into the chamber and back onto the map)
    const bridge = group === 'combat' || group === 'ground' ? 'tense' : group === 'council' || (group === 'galaxy' && (from === 'combat' || from === 'ground')) ? 'calm' : undefined;
    try {
      if (group !== 'combat' && m.setIntensity) m.setIntensity(0);           // before the new track is built: its players copy the current level
      m.setMood(pick[1], group === 'combat' ? { fade: 1.5, quantize: 'beat', bridge } : { fade: 4.5, quantize: 'bar', bridge });
    } catch (e) { /* audio optional */ }
  }
  function calm() { const m = music(); if (m && m.setIntensity) { try { m.setIntensity(0); } catch (e) { /* audio optional */ } } }

  function install() {
    if (!M.Bus) return;
    M.Bus.on('screen', onScreen);
    M.Bus.on('turn:end', onTurnEnd);
    M.Bus.on('game:new', () => { group = ''; eraSeeded = false; warMem = griefMem = peakOwn = peakFleet = 0; metSeen = null; calm(); UI.sfx('confirm'); });
    M.Bus.on('game:loaded', () => { eraSeeded = false; warMem = griefMem = peakOwn = peakFleet = 0; metSeen = null; });
    M.Bus.on('game:quit', () => { group = ''; eraSeeded = false; warMem = griefMem = peakOwn = peakFleet = 0; metSeen = null; calm(); const m = music(); if (m && m.setSituation) { try { m.setSituation(null); } catch (e) { /* ignore */ } } });
  }
  UI.Soundscape = { install, onScreen, moodFor, eraTarget, situation, era: () => era };
  install();
})(window.MOO);
