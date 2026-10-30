// Master of Orion — Reborn · the score · the programme
// Which pieces the map plays and when: the full programme and the early-years programme, the named moods, the war programme, the interludes, and the rotations the director runs.
// Every piece is a Track(id, def) in the notation of js/audio/music.js (see its header); the engine is loaded first.
(function (M) {
  'use strict';
  const Music = M.Audio.Music, Track = Music._define;

  // Moods: game-level names -> tracks (lists rotate so repeated requests do not replay the same piece)
  // the exploration programme: the eleven pieces of the whole game and the nine written for its phases (three early, three middle, three late — each
  // with an era window, see fitsEra), so fourteen to seventeen pieces are in the programme at any moment and about an hour passes before anything returns
  const GALAXY = ['galaxy4', 'galaxy14', 'galaxy1', 'galaxy17', 'galaxy11', 'galaxy20', 'galaxy5', 'galaxy15', 'galaxy2', 'galaxy18', 'galaxy13', 'galaxy21', 'galaxy8', 'galaxy16', 'galaxy3', 'galaxy19', 'galaxy12', 'galaxy22', 'galaxy7', 'galaxy6'];
  // the first years, alone among the stars: the planetarium pieces only (big sky, synth pads, bells, no choir or drums), the pad and harp interludes
  const GALAXY_EARLY = ['galaxy4', 'galaxy14', 'galaxy8', 'galaxy1', 'galaxy15', 'galaxy11', 'galaxy5', 'galaxy16', 'galaxy13', 'galaxy7'];
  const MOODS = {
    title: 'title', menu: 'title', explore: GALAXY, galaxy: GALAXY, map: GALAXY, galaxyEarly: GALAXY_EARLY,
    calm: GALAXY, wonder: 'galaxy1', patient: 'galaxy2', determined: 'galaxy3', deep: 'galaxy4', veil: 'galaxy5', abyss: 'galaxy6', cradle: 'galaxy7', beacon: 'galaxy8', tide: 'galaxy9', chorale: 'galaxy10', nebula: 'galaxy11', passacaglia: 'galaxy12', watch: 'galaxy13',
    firstLight: 'galaxy14', lantern: 'galaxy15', survey: 'galaxy16', commonwealth: 'galaxy17', lanes: 'galaxy18', noon: 'galaxy19', frontier: 'galaxy20', embers: 'galaxy21', vigil: 'galaxy22', design: 'design', research: 'research', tech: 'research',
    combat: ['combat3', 'combat1', 'combat2'], battle: ['combat3', 'combat1', 'combat2'], tension: 'ground', ground: 'ground', news: 'gnn', gnn: 'gnn', council: ['council2', 'council'], procession: 'procession',
    orion: 'orion', antarans: 'antarans', victory: 'victory', defeat: 'defeat', spy: 'spy', espionage: 'spy', intrigue: 'spy',
  };
  // array moods listed here play as a shuffled playlist with a pause between pieces (the original's map was silent; a breath between
  // tracks keeps the exploration music from looping one piece for an hour). Others pick the next track of the list on each request.
  MOODS.galaxyWar = ['galaxy3', 'ground', 'galaxy20', 'procession', 'galaxy6', 'galaxy21', 'galaxy12', 'galaxy2', 'galaxy22', 'spy'];        // at war: the determined and uneasy pieces carry the map, the late pieces among them
  // the music never stops on the map: every piece crossfades into an interlude in the next piece's key, and that into the next piece
  const INTERLUDES = ['drift', 'drift2', 'drift3', 'drift4', 'drift5', 'drift6', 'drift7'];
  // the rare pieces (the tide, the chorale) are slipped into a cycle about a third of the time each; at war their readings with the synthetic hits, more often
  const CALM_ROT = { director: true, gap: 0, gapIn: 0, fade: 6, between: INTERLUDES, betweenP: 1, rare: { ids: ['galaxy9', 'galaxy10', 'procession'], p: { galaxy9: 0.35, galaxy10: 0.35, procession: 0.25 } } };   // the procession rarer still: an occasion
  const EARLY_ROT = { director: true, gap: 0, gapIn: 0, fade: 7, between: ['drift', 'drift2', 'drift4', 'drift5', 'drift7'], betweenP: 1 };
  const MOOD_ROTATE = { explore: CALM_ROT, galaxy: CALM_ROT, map: CALM_ROT, calm: CALM_ROT, galaxyEarly: EARLY_ROT, galaxyWar: { director: true, gap: 0, gapIn: 0, fade: 5, between: INTERLUDES, betweenP: 0.8, rare: { ids: ['galaxy9:war', 'galaxy10:war'], p: 0.6 } } };
  Music.defineProgramme({ moods: MOODS, rotate: MOOD_ROTATE, galaxy: GALAXY, early: GALAXY_EARLY, interludes: INTERLUDES });

})(window.MOO);
