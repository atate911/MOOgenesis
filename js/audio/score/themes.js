// Master of Orion — Reborn · the score · the themes
// The shared themes of the score, written once. A piece quotes one by name in its phrase table — ph: { H1: '@hymn.H1' } — and the engine
// resolves it when the piece is prepared ('@hymn.H1 x2' doubles the note values, '/2' halves them; the inversion and the shift of a phrase
// stay where they were: on its use, as 'H1~' and 'H1+2'). Music.themeIndex() lists which pieces quote which theme, so the ties that hold
// the score together are a fact of the system, not a convention. Most in common time; a piece in another meter writes its own reading and declares the theme with `quotes: ['hymn']`.
(function (M) {
  'use strict';
  M.Audio.Music.defineThemes({
    hymn: {                                                          // the main theme (the title): a rising fourth and a falling step — the game's leitmotif
      H1: '5:3 8:1 | 7:2 6:2 | 5:3 3:1 | 4:2 5:2', H2: '5:3 8:1 | 9:2 10:2 | 8:2 7:1 6:1 | 5:4',
      H3: '8:2 10:2 | 12:3 11:1 | 10:2 9:1 8:1 | 7:2 5:2', H4: '6:2 8:2 | 10:2 9:1 8:1 | 5:3 6:1 | 8:4',
      K: '5:3 8:1 | 7:2 6:2 | 5:4 | r:4',                             // the call: its head alone
      CT: '1:2 3:2 | 2:2 1:2 | 4:2 3:2 | 2:3 r:1',                   // the low counter-line beneath it
    },
    men: { CM: '1:8 | 2:8 | 3:6 2:2 | 1:8', CM2: '1:8 | 3:8 | 2:6 1:2 | 1:8' },   // the men's chanted phrase: tonic, a step, the third, home
    procession: {                                                    // the march (the council, the war programme): a slow climb from the tonic — and the
                                                                     // score's second leitmotif, as the commonwealth's oboe states it (A1 A2): the title's breath, seven map
                                                                     // pieces and the victory glance at its first strain in an aside of their own (their 'echo' section)
      A1: '1:3 2:1 | 3:2 5:2 | 6:3 5:1 | 3:2 2:2', A2: '1:3 2:1 | 3:2 5:2 | 8:3 7:1 | 5:4', CD: '4:2 3:1 2:1 | 5:3 4:1 | 3:2 2:2 | 1:4',
      HY: '5:4 | 6:4 | 5:2 4:2 | 3:4', HY2: '3:4 | 4:4 | 5:2 6:2 | 5:4',   // the hymn while the votes are cast
    },
    chorale: {                                                       // the chorale (the tenth piece, the vigil)
      HY1: '1:3 3:1 | 2:2 1:2 | 5:3 4:1 | 3:4', HY2: '3:3 5:1 | 4:2 3:2 | 2:3 3:1 | 1:4', HY3: '5:3 6:1 | 8:2 7:2 | 6:2 5:2 | 4:4', HY4: '6:2 5:2 | 4:2 3:2 | 2:3 1:1 | 1:4',
    },
    planetarium: { FL: '4:6 r:2 | 1:6 r:2 | 2:6 r:2 | 7:8' },          // the four slow notes, the delay answering in the rests
    tide: { T1: '1:4 | 3:4 | 5:4 | 4:2 3:2', T2: '5:4 | 6:4 | 8:4 | 7:2 5:2' },   // the slow rise (the tide, noon)
    wonder: { W1: '5:3 8:1 | 7:2 5:2 | 6:3 5:1 | 4:2 3:2' },             // the wonder tune (the first piece, first light)
    cradle: { L1: '5:2 6:1 8:3 | 7:2 6:1 5:3 | 3:2 4:1 5:3 | 6:6' },      // the lullaby (the seventh piece; the lantern's cantus firmus is its augmentation) — in six
    abyss: { Z2: '3:4 | 2:4 | 1:6 r:2' },                                   // the phrygian descent onto the tonic (the sixth piece; the frontier's still)
  });
})(window.MOO);
