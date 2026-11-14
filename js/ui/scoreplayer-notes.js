// The score player's notes for listeners (plain language, no jargon): MOO.UI.ScoreNotes.
//   pieces[id] = { blurb, where, listen: [[section | null, text], ...] }
//     blurb   one or two sentences shown under the piece's name
//     where   where the game plays it
//     listen  moments worth hearing; a section name (as written in the score) gives the moment a time the player can jump to, null = no time
//   themes[id] = { name, about }   the shared tunes (Music.themeIndex) as a listener knows them
//   Race themes, their hostile readings and the drift interludes are written by rule in race() / war() below.
// Written against the score as it stands: a section renamed in js/audio/score/ simply loses its jump button (the text stays).
(function (M) {
  'use strict';
  const UI = M.UI;

  const MAP = 'On the galaxy map';
  const pieces = {
    // ---- the main theme
    title: {
      blurb: 'The game’s signature piece. The cor anglais asks the main tune as a question, and the whole orchestra slowly answers it.',
      where: 'When a new game begins, and now and then on the galaxy map.',
      listen: [['A', 'The cor anglais states the main tune for the first time.'], ['I1', 'A brooding interlude for cello and horn.'], ['M', 'The climax: the tune in full, the basses arriving underneath.'], ['L', 'The release, and the tune’s echo as the piece winds down.']],
    },
    'title:grand': {
      blurb: 'The main theme for full orchestra: the same tune passed from the violins to the horns to the trumpets, growing at every turn.',
      where: 'On the title screen and while you set up a new game.',
      listen: [['A', 'The cor anglais’s first statement, the violins joining softly.'], ['M', 'The climax with the whole orchestra.'], ['L', 'The quiet, reflective close.']],
    },
    'title:classic': {
      blurb: 'An earlier main theme, “the undercurrent”: a solo horn sings the main tune slowly over deep strings and a humming men’s choir.',
      where: 'A version you can only hear here.',
      listen: [['men', 'The men’s choir begins to hum.'], ['horn', 'The solo horn enters with the main tune.'], ['A3', 'The crescendo: horns in canon, then the full brass.']],
    },
    'title:reed': {
      blurb: 'The undercurrent with the cor anglais as the soloist, singing an octave above where the horn would.',
      where: 'A version you can only hear here.',
      listen: [['horn', 'The cor anglais enters with the main tune.'], ['A3', 'The crescendo: horns in canon, then the full brass.']],
    },
    'title:cello': {
      blurb: 'The undercurrent with a single cello as the soloist, high in its singing register.',
      where: 'A version you can only hear here.',
      listen: [['horn', 'The solo cello enters with the main tune.'], ['A3', 'The crescendo: horns in canon, then the full brass.'], ['E', 'The cello returns for the fade.']],
    },
    'title:symphony': {
      blurb: 'The undercurrent for orchestra alone, no choir: the violins take the tune and the woodwinds its variations.',
      where: 'A version you can only hear here.',
      listen: [['horn', 'The violins state the main tune, the cellos an octave below.'], ['A3', 'The full brass, snare and timpani over pulsing strings.']],
    },
    'title:chamber': {
      blurb: 'The undercurrent for strings alone: nothing struck, nothing blown.',
      where: 'A version you can only hear here.',
      listen: [['horn', 'The violins state the main tune over plucked basses.'], ['A3', 'All the strings on the tune, three octaves deep.']],
    },

    // ---- the galaxy map
    galaxy1: { blurb: 'Calm wonder at the stars: an airy flute, glassy bells and a running harp over floating strings.', where: MAP + ', from the first years on.',
      listen: [['A1', 'The flute’s tune over the running harp.'], ['breath1', 'A still moment, where women’s voices appear.']] },
    galaxy2: { blurb: 'Unhurried and warm: a marimba pattern with a plucked reed melody over it.', where: MAP + ', and more often during a war.',
      listen: [['A1', 'The marimba sets the pattern; the reed melody begins.']] },
    galaxy3: { blurb: 'Steady and resolute: a pulse in the strings and a determined horn theme.', where: MAP + ', and more often during a war.',
      listen: [['A1', 'The horn’s determined theme.']] },
    galaxy4: { blurb: 'The planetarium: slow analogue pads, distant voices, and single points of light from the celeste and harp.', where: MAP + ', above all in the opening years.',
      listen: [['A1', 'Distant women’s voices under the high air.'], [null, 'A lone flute, far off.']] },
    galaxy5: { blurb: 'A slow waltz of the spheres: harp arpeggios and an oboe singing over the strings.', where: MAP + ', from the first years on.',
      listen: [['A1', 'The oboe sings over the harp.']] },
    galaxy6: { blurb: 'The dark between the stars: a soft organ over a deep drone, a bassoon far below, a flute far above, and the men chanting.', where: MAP + ', and more often during a war.',
      listen: [[null, 'The clash of two notes a half step apart, held on purpose: the unease is the point.']] },
    galaxy7: { blurb: 'A lullaby in six: a rocking harp and a clarinet humming the tune while the ship sleeps between the stars.', where: MAP + ', from the first years on.',
      listen: [['A1', 'The clarinet hums the lullaby.'], [null, 'The same lullaby becomes the long-note melody of The Lantern.']] },
    galaxy8: { blurb: 'A signal from the edge: soft horn chords swaying over a deep pedal note, and a horn calling from very far away.', where: MAP + ', from the first years on.',
      listen: [[null, 'The far-off horn calls the Hymn; bells answer in the echo.']] },
    galaxy9: { blurb: 'Deep swells rising out of the dark, until the horns sing the Hymn at the crest.', where: 'Rarely, on the galaxy map.',
      listen: [[null, 'The low brass and the men entering as the swell builds.'], [null, 'The Hymn in the horns at the crest.']] },
    galaxy10: { blurb: 'The men’s choir carries everything: a hymn sung low over the organ, with a horn countermelody.', where: 'Rarely, on the galaxy map.',
      listen: [[null, 'The women join the men at the crest.']] },
    galaxy11: { blurb: 'A long drift through a nebula: analogue pads, a deep swelling bass, and points of light echoing away.', where: MAP + ', from the first years on.',
      listen: [['lights', 'Points of light: bells and celeste in the long echo.'], ['rise', 'The strings and the horn’s Hymn rise through it, once.']] },
    galaxy12: { blurb: 'A passacaglia: a bass line that never stops, with a chain of variations over it, each a different colour.', where: MAP + ', and more often during a war.',
      listen: [['V1', 'The first variation: the cellos alone.'], ['V2', 'The cor anglais.'], ['V5', 'The Hymn in the horn, with the men.'], ['V7', 'The full chorale.']] },
    galaxy13: { blurb: 'A nocturne: a walking pizzicato bass, harp chords off the beat, and a lone trumpet playing very softly.', where: MAP + ', from the first years on.',
      listen: [['W1', 'The trumpet’s line: a fifth, then the octave, then the slow way down.'], ['mid', 'Midnight: the chimes strike.'], ['dawn', 'The strings come in only at the end of the watch.']] },
    galaxy14: { blurb: 'One long sunrise, from the violas alone in the dark to the full orchestra and choir at dawn.', where: MAP + ' in the early years.',
      listen: [['grey', 'The alto flute’s dawn theme.'], ['rise', 'The horn and the choir as the sun rises.'], ['sunrise', 'The Hymn in horns and voices at sunrise.'], ['dusk', 'The fall to dusk.']] },
    galaxy15: { blurb: 'A chorale prelude in the manner of Bach: the lullaby in long notes under a clarinet that never stops running.', where: MAP + ' in the early years.',
      listen: [['CF1', 'The horn takes the lullaby in long notes.'], ['trio', 'A trio of flutes.'], ['still', 'The glockenspiel in the stillness.']] },
    galaxy16: { blurb: 'A minimalist pulse for the scouts going out, star by star: short flute figures that grow longer as it goes.', where: MAP + ' in the early years.',
      listen: [['cell1', 'The flute’s first short figures.'], ['full', 'Everything at once: the harp running, the women singing one long line above.']] },
    galaxy17: { blurb: 'A canon for woodwinds: oboe, clarinet and flute play one tune, each a few bars behind the last. The talk between peoples.', where: MAP + ' in the middle years.',
      listen: [['theme', 'The oboe plays the main tune alone.'], ['canon3', 'All three voices in canon.']] },
    galaxy18: { blurb: 'The trade lanes: a running celeste pattern under the strings, and an oboe with a tune of its own.', where: MAP + ' in the middle years.',
      listen: [['still', 'The pattern stops for the men’s choir.'], ['crest', 'The horn brings the Hymn, with both choirs.']] },
    galaxy19: { blurb: 'The empire at its height: a chorale for the brass, answered by the strings.', where: MAP + ' in the middle years.',
      listen: [['str', 'The strings answer with the Hymn.'], ['amen', 'An Amen to close.']] },
    galaxy20: { blurb: 'A slow march at the border: field drums at a whisper, the tuba on the step and a dotted trombone theme.', where: MAP + ' in the late years, and during a war.',
      listen: [['trio', 'The horn plays the Hymn over trembling strings.'], [null, 'At the crest the trombones intone the Hymn at half speed.']] },
    galaxy21: { blurb: 'What the wars cost: a stately sarabande led by the cor anglais.', where: MAP + ' in the late years, and during a war.',
      listen: [['S1', 'The sarabande melody, leaning on the second beat.'], ['L', 'The main tune turned upside down over a falling bass.']] },
    galaxy22: { blurb: 'The long night watch of an old empire: a sung chorale, the men alone at first.', where: MAP + ' in the late years, and during a war.',
      listen: [['men', 'The men sing alone.'], ['satb', 'The women join above them.'], ['organ', 'The organ takes a verse of its own.'], ['crest', 'The brass, only at the crest.']] },
    galaxy23: { blurb: 'A nocturne in three over a low bed of men’s voices and soft organ, with the alto flute’s own tune.', where: MAP + ' in the early and middle years.',
      listen: [['A1', 'The alto flute’s tune.'], ['A2', 'The main tune, once: the flute and the choir together.']] },
    'galaxy9:war': { blurb: 'The Tide with synthetic drum hits in its biggest moments.', where: MAP + ' during a war, rarely.', listen: [] },
    'galaxy10:war': { blurb: 'The Chorale with synthetic drum hits in its biggest moments.', where: MAP + ' during a war, rarely.', listen: [] },

    // ---- scenes
    combat3: { blurb: 'Driving strings, low brass, drums and men’s voices, with the main tune hammered out by the horns as the fight grows.', where: 'Space battles.', listen: [[null, 'The horns take up the main tune as the battle escalates.']] },
    combat1: { blurb: 'A galloping bass, timpani and a brass riff.', where: 'Space battles.', listen: [] },
    combat2: { blurb: 'A heavy half-time assault: syncopated stabs, a creeping bass and metal hits.', where: 'Space battles.', listen: [] },
    ground: { blurb: 'Low toms, a menacing plucked pattern and swelling brass.', where: 'Ground invasions, and on the galaxy map during a war.', listen: [] },
    gnn: { blurb: 'Confident and upbeat, with brass stabs and a bright station ident.', where: 'Galactic News Network broadcasts.', listen: [] },
    procession: { blurb: 'A stately march: a solo horn carries a long tune over the trombones and tuba, with the snare keeping time. Its tune runs through the whole score.',
      where: 'Now and then on the galaxy map once you live among other empires, and more often during a war.',
      listen: [['A1', 'The horn’s long tune.'], ['T', 'A lyrical trio.'], ['D', 'The drums fall away for a hymn; the whole chamber answers it.']] },
    council2: { blurb: 'The Procession in state: a brass fanfare, the organ and a tam-tam for the Galactic Council.', where: 'When the Galactic Council meets.',
      listen: [['F', 'The fanfare.'], [null, 'A hymn while the votes are cast, and the full chamber for the result.']] },
    lab1: { blurb: 'Curiosity: a marimba pulse and celeste, a flute in rising figures and women humming one long line.', where: 'The research screens.', listen: [] },
    lab2: { blurb: 'A discovery: vibraphone and harp, the oboe climbing, the strings and voices arriving together.', where: 'The research screens.', listen: [] },
    lab3: { blurb: 'A mechanism running: a ticking pulse, plucked bass, a busy clarinet and the celeste answering.', where: 'The research screens.', listen: [] },
    spy: { blurb: 'Noir intrigue: a walking bass, clock ticks and muted horn phrases.', where: 'On the galaxy map during a war.', listen: [] },
    orion: { blurb: 'Ancient and mysterious: deep drones, metallic chimes and an exotic, old-sounding melody.', where: 'When an orbital bombardment destroys a world.', listen: [] },
    antarans: { blurb: 'Menacing and dissonant: clashing brass, whispers and metal in an unsettled five-beat metre.', where: 'During orbital bombardment.', listen: [] },
    victory: { blurb: 'Brass fanfares, rolling timpani and a soaring theme.', where: 'When you win the game.', listen: [[null, 'The main tune in the brass.']] },
    defeat: { blurb: 'Slow falling lines, mourning strings and a lone bell.', where: 'When the game is lost.', listen: [] },
  };

  // the race themes (an audience with that race) and their hostile readings (the ambassador is angry)
  const RACE = {
    alkari: 'An airy flute over harp-like plucks and wind chimes: soaring and light.',
    bulrathi: 'Deep, stomping drums and heavy low brass.',
    darlok: 'Eerie pads, whispering swells and plucked shadows.',
    human: 'A noble march with snare, strings and brass.',
    klackon: 'Chittering clicks and buzzing, skittering patterns.',
    meklar: 'Cold machine arpeggios over a relentless pulse and metal strikes.',
    mrrshan: 'Interlocking drums under a snaking reed melody.',
    psilon: 'Crystalline bells and glassy overtones, cool and shimmering.',
    sakkra: 'Hissing percussion and dry drums under a plucked kora line.',
    silicoid: 'Vast ringing drones, slow metallic chimes and deep, geological pulses.',
  };
  const raceName = r => { try { const d = M.Data && M.Data.races && M.Data.races[r]; if (d && d.name) return d.name; } catch (e) { /* no data */ } return r.charAt(0).toUpperCase() + r.slice(1); };
  function race(r) {
    return { blurb: RACE[r] || 'The theme of the ' + raceName(r) + '.', where: 'Audiences with the ' + raceName(r) + ' ambassador.', listen: [] };
  }
  function war(r) {
    return { blurb: 'The ' + raceName(r) + ' theme turned hostile: faster, lower and darker, led by brass over martial drums.', where: 'When the ' + raceName(r) + ' ambassador is angry with you.',
      listen: [[null, 'Switch between this and the peaceful version to hear the same tune change sides.']] };
  }
  const DRIFT = {
    drift: 'One high pad over a held note, a few points of light, and perhaps the first notes of the Hymn.',
    drift2: 'A slow harp figure under one long cello line.',
    drift3: 'The women humming over the men, with one flute note.',
    drift4: 'Strings and the analogue sky swelling together, a horn calling the Hymn from far away.',
    drift5: 'One low cello note held all the way through, the harp touching the chord once a bar. Nothing else.',
    drift6: 'The men hold one low phrase and the women hum above them.',
    drift7: 'The violas and cellos breathing together under a far-off alto flute.',
  };
  function drift(id) {
    return { blurb: DRIFT[id] || 'A short interlude.', where: 'Between pieces on the galaxy map: each time it is re-tuned to lead into the piece that follows.', listen: [] };
  }

  const themes = {
    procession: { name: 'The main tune', about: 'The tune of the Main theme and the Procession, woven into pieces across the score.' },
    hymn: { name: 'The Hymn', about: 'A slow hymn the score keeps returning to, often in the horns at a piece’s high point.' },
    planetarium: { name: 'The planetarium', about: 'Slow points of light over the analogue sky.' },
    men: { name: 'The men’s chant', about: 'A low phrase for the men’s choir.' },
    wonder: { name: 'Wonder’s tune', about: 'The flute tune of Wonder.' },
    abyss: { name: 'The Abyss’s step', about: 'The dark half-step of The Abyss.' },
    cradle: { name: 'The lullaby', about: 'The tune of The Cradle.' },
    tide: { name: 'The Tide’s swell', about: 'The rising swell of The Tide.' },
    chorale: { name: 'The Chorale', about: 'The sung hymn of The Chorale.' },
  };

  UI.ScoreNotes = {
    themes,
    get(id) {
      if (pieces[id]) return pieces[id];
      let m = /^race:([a-z]+)$/.exec(id); if (m) return race(m[1]);
      m = /^race:([a-z]+):war$/.exec(id); if (m) return war(m[1]);
      if (DRIFT[id]) return drift(id);
      return null;
    },
  };
})(window.MOO);
