// Soundscape glue: chooses the music mood for the active screen and plays a few game-level cues. Everything is optional — if the audio engine is missing or locked, nothing happens.
//   Bus 'screen' (id, params) → Music.setMood(...) only when the mood GROUP changes (so galaxy → ledger → galaxy keeps the same track)
//   Bus 'turn:end' → SFX 'newturn' · 'game:new' → SFX 'confirm' · 'game:quit' → title music
// Screens that run their own music (the GNN broadcast snapshots + restores it, menu starts 'title') are left alone; the lab and spy
// panels no longer borrow a cue of their own (their stingers play over the underscore, as a film would).
// The battle screen raises Music.setIntensity as ships die; leaving the combat group resets it, so the tension layers never leak
// into the exploration music.
// The endings go through Music.finale: a win cuts to the crowning swell ('triumph', once) and hands over to the victory loop; a loss
// goes to the dirge. The council chamber fires the same finale the moment the player is crowned, so the ending screen inherits it.
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
  const galaxyMood = () => (war ? 'galaxyWar' : early ? 'galaxyEarly' : 'galaxy');
  function raceMood(params) {
    const S = M.Game && M.Game.S; if (!S || !params) return null;
    const e = S.empires[params.empire !== undefined ? params.empire : params.with];
    return e ? ['race:' + e.race, e.race] : null;
  }

  function moodFor(id, params) {
    if (id === 'audience' || id === 'races') return raceMood(params);
    if (id === 'endings' || id === 'ending') {
      const win = params && (params.kind === 'good' || params.kind === 'tyrant' || params.win);
      return win ? ['victory', 'victory', 'finale'] : ['defeat', 'defeat', 'finale'];
    }
    if (id === 'galaxy') { war = atWar(); early = earlyYears(); return ['galaxy', galaxyMood()]; }
    return MAP[id] || null;
  }
  // a declaration of war, a peace treaty or the first contact changes the map's music at the end of the turn, on the bar, never mid-phrase
  function onTurnEnd() {
    UI.sfx('newturn');
    const m = music(); if (!m || !m.setMood || group !== 'galaxy') return;
    const w = atWar(), e = earlyYears(); if (w === war && e === early) return;
    war = w; early = e;
    try { m.setMood(galaxyMood(), { fade: 6, quantize: 'bar' }); } catch (e2) { /* audio optional */ }
  }

  function onScreen(id, params) {
    const m = music(); if (!m || !m.setMood) return;
    const pick = moodFor(id, params); if (!pick) return;
    if (pick[0] === group) return;
    group = pick[0];
    try {
      if (group !== 'combat' && m.setIntensity) m.setIntensity(0);           // before the new track is built: its players copy the current level
      if (pick[2] === 'finale' && m.finale) m.finale(pick[1]);
      else m.setMood(pick[1], group === 'combat' ? { fade: 1.5, quantize: 'beat' } : { fade: 4.5, quantize: 'bar' });
    } catch (e) { /* audio optional */ }
  }
  function calm() { const m = music(); if (m && m.setIntensity) { try { m.setIntensity(0); } catch (e) { /* audio optional */ } } }

  function install() {
    if (!M.Bus) return;
    M.Bus.on('screen', onScreen);
    M.Bus.on('turn:end', onTurnEnd);
    M.Bus.on('game:new', () => { group = ''; calm(); UI.sfx('confirm'); });
    M.Bus.on('game:quit', () => { group = ''; calm(); });
  }
  UI.Soundscape = { install, onScreen, moodFor };
  install();
})(window.MOO);
