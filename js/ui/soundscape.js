// Soundscape glue: chooses the music mood for the active screen and plays a few game-level cues. Everything is optional — if the audio engine is missing or locked, nothing happens.
//   Bus 'screen' (id, params) → Music.setMood(...) only when the mood GROUP changes (so galaxy → ledger → galaxy keeps the same track)
//   Bus 'turn:end' → SFX 'newturn' · 'game:new' → SFX 'confirm' · 'game:quit' → title music
// Screens that run their own music (GNN / lab / spy panels snapshot + restore it themselves, menu starts 'title') are left alone.
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
    design: ['design', 'design'],
    tech: ['research', 'research'], techtree: ['research', 'research'], research: ['research', 'research'],
    combat: ['combat', 'combat'], landing: ['ground', 'ground'], ground: ['ground', 'ground'],
    council: ['council', 'council'], spyscenes: ['spy', 'spy'],
  };

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
    return MAP[id] || null;
  }

  function onScreen(id, params) {
    const m = music(); if (!m || !m.setMood) return;
    const pick = moodFor(id, params); if (!pick) return;
    if (pick[0] === group) return;
    group = pick[0];
    try {
      if (group !== 'combat' && m.setIntensity) m.setIntensity(0);           // before the new track is built: its players copy the current level
      m.setMood(pick[1], { fade: group === 'combat' ? 0.6 : 2.0 });
    } catch (e) { /* audio optional */ }
  }
  function calm() { const m = music(); if (m && m.setIntensity) { try { m.setIntensity(0); } catch (e) { /* audio optional */ } } }

  function install() {
    if (!M.Bus) return;
    M.Bus.on('screen', onScreen);
    M.Bus.on('turn:end', () => UI.sfx('newturn'));
    M.Bus.on('game:new', () => { group = ''; calm(); UI.sfx('confirm'); });
    M.Bus.on('game:quit', () => { group = ''; calm(); });
  }
  UI.Soundscape = { install, onScreen, moodFor };
  install();
})(window.MOO);
