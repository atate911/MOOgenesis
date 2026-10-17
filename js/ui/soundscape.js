// Soundscape glue: chooses the music mood for the active screen and plays a few game-level cues. Everything is optional — if the audio engine is missing or locked, nothing happens.
//   Bus 'screen' (id, params) → Music.setMood(...) only when the mood GROUP changes (so galaxy → ledger → galaxy keeps the same track)
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

  // The era: how contentious the galaxy has become for the player, 0..1. The target is read from the state (how many empires are met, how
  // many of them are cold or hostile, open wars, how far the game has run); the value follows it slowly, a few hundredths a turn, so over a
  // whole game the music tightens without anyone hearing it move. It only reaches the music when the next exploration piece is compiled.
  let era = 0, eraSeeded = false;
  function eraTarget() {
    try {
      const S = M.Game && M.Game.S; if (!S) return 0;
      const me = S.empires[S.playerId]; if (!me || !me.relations) return 0;
      const others = S.empires.filter(e => e && e.alive !== false && e.id !== me.id), n = Math.max(1, others.length);
      let met = 0, cold = 0, wars = 0;
      for (const e of others) { const r = me.relations[e.id]; if (!r || !(r.met || r.contact)) continue; met++; if (r.treaty >= 3) wars++; else if ((r.rel1 || 0) < -24) cold++; }
      const t = 0.3 * (met / n) + 0.3 * (met ? cold / met : 0) + 0.35 * Math.min(1, wars / 2) + 0.1 * Math.min(1, (S.turn || 0) / 250);
      return Math.max(0, Math.min(1, t));
    } catch (e) { return 0; }
  }
  function eraStep() {
    const t = eraTarget();
    if (!eraSeeded) { era = t; eraSeeded = true; }                  // a loaded or new game starts where its state says, then drifts
    else era += (t - era) * (t > era ? 0.04 : 0.025);               // tightening takes ~60 turns to go most of the way; easing is slower still
    const m = music(); if (m && m.setEra) { try { m.setEra(era); } catch (e) { /* audio optional */ } }
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
  // a declaration of war, a peace treaty or the first contact changes the map's music at the end of the turn, on the bar, never mid-phrase
  function onTurnEnd() {
    UI.sfx('newturn');
    const m = music(); if (!m || !m.setMood || group !== 'galaxy') return;
    const before = galaxyMood();
    war = atWar(); early = earlyYears(); eraStep();
    if (galaxyMood() === before) return;
    try { m.setMood(galaxyMood(), { fade: 6, quantize: 'bar' }); } catch (e2) { /* audio optional */ }
  }

  function onScreen(id, params) {
    const m = music(); if (!m || !m.setMood) return;
    const pick = moodFor(id, params); if (!pick) return;
    if (pick[0] === group) return;
    group = pick[0];
    try {
      if (group !== 'combat' && m.setIntensity) m.setIntensity(0);           // before the new track is built: its players copy the current level
      m.setMood(pick[1], group === 'combat' ? { fade: 1.5, quantize: 'beat' } : { fade: 4.5, quantize: 'bar' });
    } catch (e) { /* audio optional */ }
  }
  function calm() { const m = music(); if (m && m.setIntensity) { try { m.setIntensity(0); } catch (e) { /* audio optional */ } } }

  function install() {
    if (!M.Bus) return;
    M.Bus.on('screen', onScreen);
    M.Bus.on('turn:end', onTurnEnd);
    M.Bus.on('game:new', () => { group = ''; eraSeeded = false; calm(); UI.sfx('confirm'); });
    M.Bus.on('game:loaded', () => { eraSeeded = false; });
    M.Bus.on('game:quit', () => { group = ''; eraSeeded = false; calm(); });
  }
  UI.Soundscape = { install, onScreen, moodFor, eraTarget, era: () => era };
  install();
})(window.MOO);
