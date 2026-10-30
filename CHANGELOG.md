# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

- The score grows by twelve movements, all written for the sampled orchestra and chorus and held together by the score's themes (the
  leitmotif — a rising fourth and a falling step — the men's chanted phrase, the procession's theme, the chorale), each quoted once in
  every movement, while each movement has a principal theme and a foundation of its own. Three for variety: *the nebula* (a drift in
  Jonn Serrie's manner: the analogue and air pads on chords that change every four bars, sub-bass swells, crotales and celeste answered by
  a long delay, an alto flute in a few long notes; the strings and the horn's hymn rise through it once), *the long night* (a passacaglia:
  a ground that never leaves the basses under a set of variations, each a texture of its own — cellos alone, cor anglais, running harp,
  all-pizzicato with a staccato bassoon, the hymn with the men, trembling strings and tubular bells, the full chorale), *the watch* (a
  nocturne for a very soft solo trumpet over a walking pizzicato bass and off-beat harp chords, chimes at midnight). Nine for the phases
  of a game: the early years — *first light* (one long sunrise from violas alone to brass, both choirs and timpani, then dusk), *the lantern*
  (a chorale prelude in a broad six: the cradle tune in long notes under a running clarinet), *the survey* (a minimalist pulse at 76,
  eighth-note violas and marimba under staccato flute cells); the middle years — *the commonwealth* (a canon for oboe, clarinet and flute
  over a walking bassoon, no strings), *the lanes* (a sequence in Serrie's manner: a celeste running in sixteenths with a faint synth pluck on the beats under the strings
  and an oboe tune; the sequence stops for the men, the horn brings the hymn at the crest), *noon* (a
  chorale for brass choir with a strain of its own, the hymn as its answer, the choirs at the full); the late years — *the frontier* (a
  slow march on whispered field drums and a tuba step, a dotted trombone theme, the hymn at half speed at the crest), *the embers* (a
  sarabande with its stressed second beat in the low strings, the leitmotif inverted in the middle), *the vigil* (a sung chorale: the men,
  then the women in octaves and in a descant, an organ verse, brass only at the crest). The men's and women's voices are in every movement.
  New recorded colours for the palette: the viola section, trombones, tuba, the trumpet section, the cellos' tremolo.
- The music follows the game's phases without a cut. Each phase movement carries an era window, and every new cycle of the programme is
  composed from the pieces whose window holds the moment, so the early pieces fall silent as the galaxy fills and the late ones arrive, a
  cycle at a time. A change of programme at the end of a turn (first contact, a war, a peace) no longer crossfades mid-phrase: the piece
  that is playing reaches its next breath or section line, an interlude in the new key follows, and only then the new programme's first
  piece enters, with the long seam fades of the rotation. Two more interludes join the bridges between pieces: the choir alone, and the
  violas with a trumpet far away. Plucked and bass notes no longer land at identical levels.
- Interludes modulate. The interlude between two pieces now opens on the outgoing piece's tonic, in the outgoing piece's meter and felt
  pulse (a quick six hands over at its dotted beat, a march at its half bar), so the piece ending decays into its own chord and bar; its
  opening bars then walk the way into the new key — a pivot chord the two keys share with a pre-dominant role in the new one, or a walk
  round the circle of fifths when they share nothing, or the Neapolitan when they are far — and arrive on the new dominant seventh, while
  the tempo glides to the new piece's as a true accelerando or ritardando; the body continues in the new meter at the new tempo. The
  compiler gained a tempo map (a section may carry its own tempo, and a tempo may ramp across it) and a per-section meter; every existing
  piece compiles to the same notes as before.
- Interludes keep the colour. Every instrument belongs to a family (strings, brass, winds, choir, plucked, bells, the analogue pads), and a
  piece has a palette: how much of each it is scored for, with its opening and closing sections counted most. The seam chooses its interlude
  by that palette (and the pieces' character) against the seven templates, so a choir piece is far likelier to be followed by the choir
  interlude and a strings piece by the violas or the harp — by weighted chance, never the same one twice running. The template's own
  alternation is pinned to the one that sits best between the two pieces, the sustained voice the old piece ends in holds under the
  interlude's opening bars, and the voice the new piece opens with is already there under its last bars; the interlude's own voice keeps the
  middle. Only a colour that can be held is carried (strings, the pads, choir, brass, winds; a harp in a pad slot would only tick). Its
  opening level meets the level the piece ended at (within the breath's range). `tools/audio-seams.js` captures four seams from the
  real-time engine as MP3s, with a log of what each seam built; they are on the demo page.
- The map's plan, steps one to five (MUSIC-REVIEW.md, "Steps 1 to 5: done"). The chord voicer keeps the low-interval limit (no
  second or third below C3, open spacing below G2) and the map's men's choir and low beds sit above the bass pedal's third: close low
  intervals fell from 28% of a piece's length to under 2%. The Abyss, the Tide, the Chorale, the Cradle, Wonder and the Beacon are
  re-harmonised bar by bar from their tunes, so the engine snaps none of their notes onto a chord. The men's one sung phrase stays in
  four stills; eleven pieces have a still of their own. The bell sparkle is left to the planetarium pieces, the Nebula, the Watch and
  First Light. The pieces that sounded like each other are told apart by bed and tempo: no two map pieces measure above 0.89 in
  likeness.
- The score reviewed and ranked (MUSIC-REVIEW.md): every piece read and measured, the errors corrected, the rest marked on six
  criteria (craft, creativity, uniqueness, pleasure, fit, identity) with a measured penalty for sounding like other pieces and a capped
  bonus for carrying the shared themes, and ranked out of a hundred. The demo page has three tabs: the movements and the seams, every
  piece ranked with a live play button, and any two pieces with the seam the engine would make between them (the game's engine and
  the sampled orchestra run in the page; the samples travel packed in four files and are served to the sampler from memory). A
  directed programme that opened on a piece other than its first used to list that piece twice and drop the first; fixed.
- Every recorded instrument knows its range. The engine carries the sounding range of each recording (the horn to F5, the tubular bells
  to F5, the glockenspiel from G5, the crotales from C6, the men's choir to A4, the basses with the C extension); a pad, choir,
  arpeggio or sparkle keeps its register inside it, and a written line folds a stray note by an octave, as a player would. The review
  (tools/score-review.js) found the lines written out of reach and they are corrected in the score: the council's horn was an octave
  above the instrument (the piece's octave shift removed), the sunrise's trumpets an octave too high, the tubular bells in four of the
  movements and in Orion an octave above their range, the glockenspiel lines in the lantern, the survey, the defeat cue and the Meklar
  theme an octave below theirs (the defeat cue's lone bell is now the celeste), the crotales used as a lead two octaves below their range
  in the research cue and the Psilon theme (now the celeste), the Alkari wind chimes and the Silicoid chimes rewritten in range, the
  determination piece's horn given its middle register for the second strain. The war readings no longer carry a bell line's octave into
  the brass, and their men's choir sings in its own register.
- The pivot chords take their time. Each chord of the way into the new key now lasts about five seconds at least, and the first (the old
  tonic) seven or more, so it spans the fade of the piece ending; a long walk round the circle moves on sooner in its middle. Before, a
  chord lasted one outgoing bar, which at a halved pulse could be under three seconds.
- The score has a shared theme library and a story. The themes the pieces quote (the hymn, the men's phrase, the procession, the
  chorale, the planetarium's four notes, the tide's rise, the wonder tune, the cradle, the abyss's step) are written once in
  `js/audio/score/themes.js` and quoted by name; sixty-five copied phrases became references with no note changed, and
  `Music.themeIndex()` lists which piece carries which theme. The story reaches the music: when a race is first met, the next interlude
  carries the first bars of that race's theme in the interlude's own voice and key; as the Galactic Council approaches, the procession's
  call rides the next interlude and the procession itself grows likelier in the programme.
- The music is split into an engine and a score. `js/audio/music.js` keeps the engine (notation, generators, player, scheduler, director);
  the pieces live in `js/audio/score/` (themes, cues, map, races, programme), loaded after it. `node tools/score-lint.js` checks the whole
  score against its schema and the engine's analysis (instruments, forms, phrases, themes, tags, era windows, determinism, the programme's
  lists), and `node tools/qa/music.js` drives the seams in real time (a directed programme, a soft change on a section line through an
  interlude, bridges into a fight and back, a motif on an interlude, snapshot and restore, never a silence).
- A music director chooses the map's pieces. Every map piece now carries tags on eight axes of the game's situation (solitude,
  contact, tension, war, grief, grandeur, energy, dark), and at the end of each turn the soundscape reads the galaxy on the same axes:
  who has been met, how cold relations are, how crowded the player's space is, the fleets around it, whether there is a war (remembered
  for some turns after a peace), colonies and ships recently lost, the empire's size. When a programme needs its next piece the director
  scores each candidate by how close its tags sit to the situation, tilts the weight by the key (near on the circle of fifths after the
  piece just heard), by how recently it was heard (almost never within twenty-five minutes) and by its rarity, and draws one at random
  from those weights: still a shuffle, leaning the way the game leans. The music's level tilts a little with the situation, never more
  than about a decibel: up at war or for a grand empire, down when the player is alone and nothing presses.
- Seams breathe. When the next piece is far from the last in energy, darkness or key, the director chooses one of the quiet interludes
  (the pad, the voices, the choir alone), lengthens it by half and widens the fade; never silence, but a restrained quiet before a piece
  of a very different kind.
- Bridges for cues that cannot wait. A fight, a landing, the council chamber and the return to the map after a battle are no longer cut
  to: a two-bar bridge in the new cue's key starts on the next beat (a string tremolo swelling under a timpani roll for a fight, one
  swell of strings and soft organ with a chime for the chamber and the map), the old piece fades under it, and the cue enters as the
  bridge crests. A switch already armed is no longer lost when the sampled instruments finish loading.
- `node tools/audio-hour.js` captures a scripted hour of the map's music from the real-time engine (the early programme alone, first
  contact, a war, peace, the late years, the era rising throughout) with a log of every change of piece.
- Loop seams. A sustained note is a short recording looped by the browser, and Web Audio loops with no crossfade, so wherever a
  library loop point did not meet itself in phase (a third of the string-section, chorus and solo-brass zones, and the short oboe and
  clarinet loops worst of all) every wrap was a click, or a flutter at the loop rate: the "clipping" and "looping" heard on held notes.
  The sampler now blends the tail of every loop into the audio that leads into its start when the file is decoded (a quarter of the loop,
  at most 300 ms), so the wrap continues the very waveform the loop start plays; `?loopxf=0` plays the old loops for comparison. Measured
  on the files: discontinuous seams 67 of 218 before, 11 after, and the phase match at the wrap 1.00 on every instrument.
- Every new movement passes the composition lint (deterministic, every form × instrumentation × take compiles, few or no melodic snaps)
  and the headless loudness pass (trims set to the -16.5 LUFS underscore target, no limiter engagement, no clipping); the soft programme
  change was driven in headless Chromium (the switch lands on a breath of the running piece, the interlude takes over under its decay,
  never a silence).

## 1.3.0 — 2026-10-28

- Release pass. The whole of `main` was run through every check before this version was cut: the syntax check (120 files),
  the rules tests (860), AI-vs-AI soak games with the classic and the expanded tech pool (24 each, state sanity, save round-trip,
  determinism replays), the headless click-throughs through the real UI (80-turn games on Hard and with the expanded pool, the combat,
  endings, council, spy, help, scenes, modes and fuzz suites, the phone suite at three sizes and the server-save flow), a screenshot
  walkthrough of every screen, scene and dialog at 1920×1080 and 1366×768, and saves written by v1.1.1 and v1.2.0 loaded into this
  build and played on. One fix: the title screen's "Last played" line said "1 colonies".
- Phones, from the first reports on a real iPhone. The colony sheet opened to its full height ran under the Dynamic Island, so its grip (the
  only way to close it) could not be reached and the panel stayed up until the next turn: the full sheet now starts below the top safe
  area, the Back control shows while the sheet covers the map, and Back (the control or the phone's back gesture) collapses an open sheet
  instead of opening the game menu (a dialog on top still closes first). The ⚠ beside a colony on the map had no explanation on a touch
  screen: the colony panel now carries the line ("⚠ Alkari: 3 hostile ships arriving in 2 turns"), on desktop too, and the map key lists
  the raid mark and the red "!" attention badge first; the phone's key scrolls when it is taller than its box. Landscape: the galaxy's side
  column keeps clear of the right notch. The star system on phones: the fleet tiles were clipped by their own box in portrait and sat
  under the planet data box in landscape; they now stand beside the planet, the star kind joins the environment line (its caption sat
  off the narrow screen), and the hint clears the home indicator. Choosing the next technology on a phone: a single tap on a technology
  researched it at once, with nothing read (the tap's synthetic mouse-over had highlighted the row and the click that followed took it as
  a confirmation); a tap now only shows the technology's description and the Research button confirms (the header says "tap to read").
  A mouse keeps hover-to-preview and click-to-research.
- Phones use the whole screen, tall ones included (measured: every phone view at the tallest iPhone, the empty bands and every scroll box
  with room under it). The galaxy HUD kept a column's width free on its right for map controls that no longer stand there, which pushed
  "Colonies" onto a third row: the four values now share one row under the year, and the map gains the height (on a short phone with
  the sheet half open, where the controls do climb beside the HUD, the values wrap as before). The half-open colony sheet counted its
  grip twice and sat about 25px below its own buttons; it now ends under them. Options and Save / Load padded their top by 5% of the
  screen height; a tall phone had a 46px empty band under the app bar. The Research › Project tab left the lower quarter of a tall phone
  bare: the project's blueprint now sits under its figures. On its side, the Save screen's Import / Export sit beside the Save / Load
  switch, so the slot list keeps the height. The other side of the same survey: on a phone held sideways, every screen under the app
  bar ran its content under the notch on both sides, and on an installed iPhone the Planets, Races, Report, Racial Stats, New game, council,
  landing and ending screens, the game menu and the title screen put their last line or button under the home indicator. Every screen under
  the app bar now keeps out of the notch and the home indicator (the one sky shows in the bands; the galaxy, the title and the design editor
  place their own), the game menu sheet and the title screen's column and footer too. The council's YOU / NOMINEE tags, which hung off the
  screen edge beside the outer booths on a phone, stay inside it. Sideways, the ship design editor (which places itself, without the app
  bar) keeps out of the notch too, and the audience's dialogue text gives up its desktop minimum height so one more option shows before
  the menu scrolls.
- More map on phones. While a destination is being picked (fleet deployment, Reloc, Trans) the HUD and the tab bar step aside, so the map
  has well over half the screen instead of a third (on an iPhone 15: 474px instead of 287 under the deployment sheet, 525 instead of 329
  under Reloc); once the deployment card floats beside the chosen star, the collapsed sheet under it goes too and the card takes at most
  half the map. Back during a pick cancels the pick (it was collapsing the sheet and leaving the pick open). Outside a pick the tab bar is
  the height of a system tab bar, the HUD and the collapsed sheet are a little tighter (a 4 % taller map), and sideways the side column
  takes 42 % of the width instead of 46 %.
- Research screens fit iPhones. The breakthrough card (a technology researched, stolen, traded or found) was a fixed share of the
  screen with a fixed-height picture, so its text got what was left: 0 to 77 pixels on most iPhones for a block that needs 170 to 200,
  hidden in an inner scroll box iOS shows no scrollbar for. The chips were sliced, the description and effects never showed, and on a
  phone held sideways nothing below the picture did, the caption's first line sat under the app bar and the Continue button hung off
  the card. On a phone the caption and the card now stack from the bottom of the scene at their natural height; the picture shrinks
  first, and only then does the text scroll, with a fade at the edge that says there is more. Sideways, the picture sits beside the text,
  and the research choice puts its list beside the description. The keyboard hint ("Space continue") is gone on touch screens. The
  tech tree's names were cut mid-letter on a phone ("IMPROVE", "ECM JAMME…"); each box is wider, a name runs to three lines in sentence
  case with long words hyphenated, the level sits under the icon, and a column header puts its count under the field's name. The
  Research screen and the tech tree keep clear of the notch, the Dynamic Island and the home indicator (a home-screen install put the
  last lines under the home indicator; sideways, the content ran under the notch on both sides). With Reduce motion on, the scientist's
  photo now replaces the drawn stand-in once it loads (the scene only repainted when something else changed). New QA:
  `tools/qa/phone-fit.js` checks every screen, scene and dialog at seven iPhone sizes with the iPhone safe areas emulated.
- Expanded technology (New game › Remake options, off by default): 45 new technologies join the pool every research tree is dealt
  from, a quarter of the 180 classic ones. Trees keep their size: after the classic tree is dealt, some of its slots are swapped for new
  techs of the same field and tier, so the number of choices, tier unlocks and the tech-level formula are unchanged; essential techs and
  the four single-tech tiers are never swapped. New axes rather than bigger numbers: asteroid mining, arcologies, pressure domes, prefab
  colony modules, battlefield salvage, minefields, emergency warp, lifeboats, navigation beacons, banking, reverse engineering and more,
  each with its own art and wording on the tech screen. Sixty candidates were tested in simulated games (tools/techlab: combat
  calibration, twin trials against every classic tech, whole-game leagues against the classic pool); fifteen were cut, four moved and
  one retuned. Classic games are unchanged (state hashes match the previous build).
- Polish pass (PC and phone). Desktop: the original's hand cursor is back, redrawn as a brass gauntlet, on everything that can be clicked
  (phones keep none). The colony panel's empty lower third now holds a colony postcard: the art for that world (domes on a hostile planet,
  mines on a barren one, a fortress, smog, industry or a city) with what the colony is and the ships in orbit (a click sends them).
  Ending a turn plays its stamp-and-sweep sound (defined but never played before) and the HUD year rolls over like an odometer. Save
  slots show a small chart of the galaxy as the player knew it when the game was saved (colonies in banner colours, a ring on the
  capital); the save list on a narrow screen is a card per slot with the leader and year, and an empty slot keeps its "Save here". The
  loading screen shows the galaxy art and one of the 60 tips (never the same twice running), and on Simple / Easy the same tip waits on
  the map on the first turn. Two tips were wrong for this game and are replaced (no outposts; no Antarans: monsters instead). The
  Research screen's picture pane drew its motif below the visible edge (the canvas was twice the panel's height) and showed an empty
  grid: it now fits. A rival's Report with nothing on file shows one card over their homeworld with a way to the spy networks instead of
  six empty boxes. Options › Display › Empire marks (off by default) is a colour-blind aid: every empire's owner rings get a pattern of
  their own (solid, long dashes, dots, dash-dot, double, short dashes, one per banner) and a race code (HU, MR, SI …) beside the flag,
  under foreign fleets and in the map key. Phones: the audience keeps the leader in view in portrait (sized by the width, above the
  dialogue panel; the envoy is left out there). The HUD has a "Last turn" / "Coming up" chip that opens the whole turn log, and the
  log in the full sheet is opaque. The map's control column is Show all, Centre and a More button that unfolds the key, routes and
  declutter (pinch and double-tap zoom), so the HUD gets the map's full width. The title screen on a phone held sideways is two
  columns (the wordmark and the last entries were cut off). The star system's fleet heading stays on one line and ship names wrap
  instead of being cut. The star-chart grid is off by default on phones. From the second visit in a browser tab, a card says how to
  add the game to the home screen (with an Install button where the browser offers one), once.
- Tuning pass. The Fleets, Ship specifications, Planets and Galaxy Map titles take the caps display style the Research, Races and
  Racial Stats screens already use (the original's screens all had caps titles), so every tool screen opens the same way. At the end of a
  turn the HUD values and the colony panel's readouts that changed (reserve, income, research, colonies; population, bases, factories,
  waste, production) light up for a second, alongside the year's roll. The Fleets and Planets ledgers, mostly empty early in a game,
  sit on a faint star chart instead of flat brown. A fleet column with no design reads as empty. Phones: the research allocation row
  keeps the capability line whole and gives the project its own line with a full-width bar; the fleet grid's column headers stay on one line.
- Galaxy map, thinned. The whole-galaxy view (the fit, or a step past it) now carries fewer marks per star: the star-chart grid and its
  parsec ruler are off by default (the original had none; Options › Display turns them on), only owned stars, the selected one and Orion
  carry names, and the colonisation glyphs show only on stars a colony ship can reach this turn. Zoom in and every explored star is named
  and marked as before. A colony has one owner ring instead of a ring and a faint echo, the scan ring sits under the range ring in weight
  and its radar sweep is gone, and the map's control column reads as two groups (view, layers).
- Harmony and art pass. One gold for every tool screen's title (Research, Races and the Report had a more orange one than Fleets,
  Planets and the Galaxy Map), one orange for every box title (the Planets ledger's Spending costs, Total income and Reserve were mint),
  and every slider readout on every screen is the same yellow in its slot (the colony panel's; Research, Options, Races and the Planets
  ledger showed lime-green). The map key's title and the Galaxy Map screen's box titles take the caps of their siblings, and the Fleets
  ledger's planet thumbnails sit in the same recessed tile as the Planets ledger's. Art: the planet pictures and plates in the side
  panels and ledgers, on the Races screen, the Report, the New game race card and the event cards were fixed-size bitmaps that the
  browser then scaled (soft on a 2x screen and at a large interface scale); they are now images the browser fits itself, sharp at any
  scale and decoded once. The ship pictures in the Fleets ledger and on the pre-battle card were small bitmaps enlarged up to 1.6x (the
  fuzz): they are drawn at the size of the cell they sit in, and the Small / Medium / Large / Huge hierarchy holds on both axes whatever
  the cell's shape. The "Build a new colony?" card shows the colony ship coming down (art that was never used) instead of the orbit
  plate the scout's report already showed.
- Visual system, phase 1: one place, three layers. One sky: every procedural backdrop (the galaxy map, the title's fallback sky,
  the menus) starts from one definition tuned against the title galaxy art: mostly black, dusty violet and blue wisps, a warm heart,
  dust lanes; the map's cloud layers take the same hues at a lower strength and its gameplay nebulae go dustier; on the GPU at the
  high tiers the sky is rendered at the screen's own resolution instead of a 1600-wide upscale. The same sky now sits under every
  screen: Options, New game, Load game and the Almanac go transparent over it, the Fleets and Planets ledgers float on it and their
  empty tables are windows on the part of the sky behind them, and a screen change is a cross-fade instead of a cut. One glass: the
  tooltip, the toast, the map key, the turn log, the star system's labels and planet-data box, the pre-battle card's boxes, the
  council tally and the audience's dialogue panel are one dark translucent slab with a brass hairline (the audience's teal fill is
  gone; its brass frame carries the colour). Dark wells with brass hairlines: the Research, Races, Report and Tech tree wells, the
  ledgers' cells and boxes and the colony panel's slots go near-black so data and art pop, and table rules are a 1px brass hairline
  that scales with the interface. The near-duplicate yellows in the stylesheets collapse into the title and slot tokens.
- Visual system, phase 2: combat, continuity, scenes. The tactical board reads as a hologram: the checker and the intersection dots are
  fainter, the planet is a little larger and carries its atmosphere, clouds, cloud shadows and night lights, idling drives breathe, and
  when no battle backdrop fits the board sits on the star's own planet-free sky instead of the bright system plate. Opening a star system
  from the map is a continuation of the zoom: the map flies in on the star, the system view cross-fades in, and on the way back the map
  flies out to where it was (reduce motion and phones cut straight across). The system view's fallback sky is the one sky, warmed by the
  star. One grade on every plate: the title's galaxy, the news studio, the exile ending and the ground-battle art take the same light
  colour grade the other scenes have, the art in the panels and ledgers gets the same touch, and the audience hall breathes behind the
  leader (a slow push-in and back over forty seconds, off under reduce motion). The ship design hologram floats on the one sky. Phones:
  the family wells and separators take the phase 1 values.
- Balance pass: luminosity, contrast, highlights. Measured, not eyeballed: every visible text element on fifteen screens was scored
  against the pixels behind it. The brown-leather screens (Research, Races, Report, Tech tree, the ledgers' frames, the Map overview) were two
  to three times brighter than every other screen and their frame text (subtitles, prompts, even the gold titles on the bright corner) sat
  at 2.3 to 3:1; the leather is darker and flatter now, its corner highlight a narrow rim, and that text reads at 4 to 5:1. The copper
  primary buttons' dark ink was haloed by its own light text shadow and fell to 3:1 at small sizes; the lower stop of the copper is lifted and
  the ink near-black. A disabled button used to be the whole plate at half opacity, which collapsed ink and face together (1.5:1); it is a
  grey plate with readable ink now (the design screen's Build button too). The Report dossier's dark scrim had been painted under the image
  since it was made, so its caption sat on bright clouds; it is above the image now. Text that was dimmed for the old brown wells had gone
  near-invisible in the new black ones (empty design slots, zero-count rows in the map keys, locked tech chips) and is lifted. The orange
  box-title tier is a lighter orange in bold so it clears as large text on every face. Effects that added nothing are gone: the 1px
  scanlines over the whole screen (a second grain, moiré at 4K) and the teal scanlines on the audience panel; the territory haze on the map
  is a quarter softer; the Design screen's five bright orange section slabs and its white-on-orange hull pick take the copper tier with dark
  ink; the Research level numbers are quiet cream figures (green is for research points only). The bevel highlight is one brightness
  everywhere (twelve values from .08 to .4 before).
- Finish pass: consistency, shading, histograms. The raster art was measured as a family (RGB statistics of every file by set):
  mid-keyed, warm by +5 to +33, deep blacks, nothing clipped, and the same cool-space / warm-people split the interface draws between the
  sky and the leather. The one mismatch was the leather itself, a third warmer than any art it frames, so portraits and planets read
  cooler than they are; every leather tone is retoned toward neutral at the same luminance (the ledger heads from +42 to +30 red over
  blue). The files that sit far from their set's exposure (the Darlok halls a third as bright as their peers, the Psilon chambers nearly
  twice, the white Alkari homeworld) are nudged toward it on every draw path, so the council booths, the Races cards and the Report no
  longer jump in brightness from one empire to the next. Shading: three shadow elevations replace twenty-four drop shadows; one
  text-shadow direction replaces two; every art plate in the DOM (colony card, side cards, setup homeworld, Report dossier) is a recessed
  window with an inner vignette instead of a sticker; the galaxy console casts onto the map; the Fleets cell plate takes the well's black.
  Consistency: the Report's ◀ ▶ match their neighbours; the last chamfers on the rectangular theme (save slots, race name plates) are
  square; NO TRADE and the Report's traits take the caps of their neighbours; the growth mark is ↑1.8, not ↑ +1.8; the ticker's "..." is an
  ellipsis; the disabled Build button's key chip is readable; near-identical type sizes collapse into one (Research 22 → 16 distinct
  sizes).
- Unify pass. Every conclusion of the visual passes reviewed as one system (three layers, four materials on one warm axis anchored on
  the art, one light, one tiered palette, one type scale, one motion) and the interface cleaned up against it. The rendered screens move
  a little toward the art's histograms: the galaxy sky loses most of its magenta cast and takes the art skies' dusty neutrals with a
  warmer heart; the gameplay nebulae are dustier and sit in the sky instead of on it; every steel face (the galaxy console, its buttons,
  the command bar, the dark base tones, the phone gunmetal) has half its blue taken out at the same brightness, so the chrome reads as
  grey steel beside the warm leather rather than a second colour. One label tier: the Research screen's column, section and project
  heads take the cream capitals the ledgers and the console already use; orange is the bold box-title tier only. One type scale: every
  size snaps to a regular step (36 distinct sizes, down from 65). One hairline system: the brass lines on borders, rules and frame edges
  are three weights instead of fourteen.
- Race photos, matched to their screens. The seventy race photos (portraits, figures, audience halls, council chambers, scientists,
  homeworlds) were measured one by one: each is sound on its own (black shadows, no clipped highlights), but within a set the exposure
  spans three to five times from the Darlok to the Psilon, and the game puts those sets side by side. Every draw path now reads one
  measured table and brings a file toward its set: people photos all the way, plates three quarters of the way. The correction is tonal,
  not a brightness slider: a dark photo's midtones are lifted while its blacks stay black and its highlights stay put, a bright photo's
  exposure comes down with its highlights, and a plate in the page is capped so nothing clips. In the Races cards the portraits used to
  span 16 to 46 in brightness; nine of ten now sit between 32 and 37 and the Darlok, dark on purpose, at 21 with the face readable. The
  council booths, the Report, the Almanac, the New game race pick, the audience leader and the player's own figure in the audience follow
  the same table, and the correction now survives the low effects tier and phones, which used to drop it with the plate grade.
- Title screen. The world in the corner turns smoothly and visibly: its axis now tilts away from the viewer so mid-latitudes sweep
  past instead of a polar cap turning in place, one turn takes about a minute, the sun sits low on the galaxy's side so the terminator, the
  night-side city lights and the cloud shadows cross the visible half, and it drifts a little against the galaxy's slow zoom. Clouds on
  every GL-rendered rocky world are now weather rather than a decal: banks stretch, curl and break up over tens of seconds, cyclones
  breathe, and the deck runs a little ahead of the ground (the shadows follow). The deck now sits a little above the ground (parallax
  at the limb, shadows below the banks), thin bank edges catch the sun from behind near the terminator and warm in twilight, thick
  banks on the night side flicker with lightning (live frames only, never baked into a sprite), and the atmosphere is a broad blue
  wash thickening to the limb with the limb brightest toward the sun. The fly-by ship on the title screen is relit for the scene
  (exposure down, shadow side away from the sun, a cool fill, a quieter drive) instead of showing its baked studio lighting. The GL
  planet renderer shades only the part of a planet that lands on the canvas (half the cost for a planet half off-screen: the title
  screen, a close system view), so the title screen no longer drags the quality tier down into the Canvas2D fallback on an integrated
  GPU. The menu marker no longer sits on the first letter of the default row (New game / Continue). The title block shows the version
  and © Andrew Tate, 2026.
- Phone mode. On a phone (touch screen, shorter side 600 px or less; `?phone=1` / `?phone=0` force it) the game switches to a
  layout built for one thumb, and the desktop layout is unchanged. Buttons and controls are at least 44 px and text at least 12 px.
  The galaxy map fills the screen with fixed tabs underneath: Planets, Fleet, Tech, Races, More (the game menu, Ship design and the
  galaxy map) and a wide Next turn. The colony / star panel is a bottom sheet: collapsed, it shows the planet, the colony's
  population, production and what it builds (or a star's planet, owner and range) and any warning; half open, the five spending
  sliders and Ships / Reloc / Trans; fully open, everything and the turn log. Fleet orders pin to the bottom edge and a battle or a
  scout report opens the sheet fully. Every screen has an app bar with Back and its title; Back and the phone's own back gesture do
  what Esc or a right-click does on desktop. Press and hold anything for its tooltip, a star or fleet on the map included; a tap on
  a number, label or chip shows it too, and a greyed-out button says why. Hints talk about taps, not keys, and a first-run card
  explains the controls. Battles are always auto-resolved on a phone (the pre-battle card keeps Retreat and Auto). The ship design
  editor becomes one column with the hull-space bar and cost pinned at the top, components picked from a sheet of cards that says
  what fits, a −10 −1 +1 +10 Fill stepper for each weapon bank, and Build pinned at the bottom. Research splits into Allocation,
  Project and Techs; the ledgers, tech tree, races, reports, almanac (search and tabs stay on top), setup, options and save screens
  stack for a narrow screen; landscape phones get the galaxy panel as a right-hand column. News arrives as the brief headline list.
  The game can be added to the home screen (`manifest.webmanifest`, icons in `assets/icons/`). Phones use their own graphics tier
  (stepping down to Low if frames are slow; Options has a performance overlay row), at most two worker threads, and the synthesised
  music voices instead of the 50 MB sampled orchestra. QA: `node tools/qa/phone.js [landscape|small]` (also fails on small targets
  or text and on keyboard wording), phone profiles in `tools/qa/modes.js`, and `tools/qa/layout-fingerprint.js` to diff desktop
  layouts between two checkouts. Notes and follow-ups: `tools/handoff/phone-2026-10.md`.
  On a phone the interface also looks like a phone app while keeping the game's colours: flat screens and cards in each area's own
  colours, small section headings, normal-case labels, flat buttons with a gold main action, a plain Back with the title centred, a
  flat tab bar, the galaxy's status line as a top bar, a bottom sheet with rounded top corners, simpler dialogs and snackbar messages.
  Short haptic taps on Next turn, slider steps, switches and errors (Android, and iPhones on iOS 18 or later; Options › Haptics turns
  them off). The installed app gets a matching status-bar colour per screen and launch images for iPhones.
- Server saves and a password gate (`server/moo-saves.py`, Python 3 standard library only). On a hosted install the game asks
  for a password before anything loads (default `moopassword`, set in `/etc/moogenesis/moo.conf` on the server; blank turns it
  off; changes apply at once and sign everyone out). The Save / Load screen gains a **Server | This browser** toggle; Server is
  the default when the save server answers, with 6 slots kept gzipped in `/var/lib/moogenesis/saves` (a long colossal game is
  ~50 KB). Saving to the server happens only when you choose to; autosave and F10 stay in the browser. Continue on the title
  screen picks the newest save from either place. Opened from `file://`, or with no save server, everything works as before.
  `python3 server/moo-saves.py --dev` serves the game locally with the gate and server saves (data in `server/dev-data/`).
- Deploy: `install.sh` / `upgrade.sh` set up the `moogenesis` service user, `moo.conf` (written once, never overwritten), the
  `moogenesis-saves` unit and an nginx / Caddy snippet the scripts own (nginx `auth_request`, Caddy `forward_auth`). An existing
  nginx site only gains one `include` line (tested with `nginx -t`, put back on failure). While the save server is not answering
  the snippet is written comment-only, so the game still loads, without the gate. Health checks send the login cookie, `doctor.sh`
  reports the service, the gate and the slot count, `backup.sh` includes `/etc/moogenesis` and `/var/lib/moogenesis`, and
  `uninstall.sh` removes the service but keeps the saves. `tools/qa/saves.js` tests the whole flow in Chromium.
- Diplomacy in each race's own voice: 2,100 new lines (`js/data/diplo/<race>.js` → `Data.diploRace`), six for each of 35
  situations per race. That covers first contact, greetings (neutral, allied, frosty, at war), offers, sweeteners, answers, war,
  tribute, threats, peace, broken treaties, spies caught either way, border warnings, gifts, insults, calls to arms and Council
  votes. Human dealmakers, Mrrshan hunters, geological Silicoids, hungry Sakkra, condescending Psilons, Alkari clan-lords, the
  Klackon Hive, gruff Bulrathi gardeners, Meklar cost-benefit reviews and Darlok denials. The audience screen speaks the race's
  line first and falls back to the personality lines. A line that names a third race is skipped when the player is that race.
  `tools/rules/93-diplo-race-lines.test.js` checks every set: complete, ASCII, and the right placeholders.
- Fixed: several ship ETAs counted the whole trip instead of the turns still to go: the Fleet screen's list, the panel for
  another empire's fleet, and the map's ETAs (and so its tooltips and raid warnings) for foreign fleets and troop transports.
  All now count from where the ships are (`F.etaLeft`, which also handles transports).
- Galaxy map: the sky painting behind the stars is anchored to the galaxy as a far layer. It pans with the map (one to one at the
  fit-all view) and zooms more slowly than the stars, instead of staying almost fixed on screen while the map moved over it.
- Turn cards about a star (a new system explored, the colonise question, notices) have a "Go there ›" link that zooms the
  galaxy map in on that star and selects it; the card stays until answered.
- Transport panel: the colonists on the origin and destination worlds now → after the move, against each world's maximum
  (amber when the destination would be over it), updated as the slider moves.
- Fleet deployment opens in the sidebar when you click your fleet, keeping the map clear while you look for a destination;
  it moves beside the destination once you click one (a right-click send still opens it there at once).
- Colonies needing attention (`Q.attention`): the Planets screen's warnings (rebellion or unrest, events, shrinking population,
  waste building up, idle factories) now show on the galaxy map as a small "!" badge at the colony (red or amber), and a hostile
  warfleet or troop transport you can see flying at one of your colonies draws a pulsing red ring with the turns until it arrives.
  The top bar counts them (⚠ raids, ! problems); a click or I steps through them, raids first (Shift+I goes back).
- Hovering one of your colonies on the map shows its production and factories, what the shipyard is building and how often,
  its research, and the reasons behind any badge or raid ring.
- The "Last turn" log gains a "Coming up" part read from the live state: raids on the way (with arrival), your fleets and
  transports landing next turn, and colony ships sitting in orbit. It updates as you give orders, and shows on its own when
  nothing happened last turn.
- Galaxy map: a star's tooltip flips to the corner of the pointer that keeps it clear of a panel floating over the map (fleet
  deployment, rally point, transport), so it is never hidden underneath while picking a destination.
- Combat: the Special devices menu opens beside the acting ship over a lightly dimmed board instead of mid-screen, its devices
  numbered (1–9 pick).
- Fewer trips across the screen: ◀ ▶ arrows on a colony's title step through your colonies (as F2 / F3); the ship box cycles
  designs with the wheel and backwards with a right-click; the Ships list opens on the current design and takes 1–6; the end-of-turn
  warnings name each colony as a link that cancels the end of turn and opens it (the unfunded-research line opens Tech).
- Galaxy map declutter (a lit button with the map controls, or V), after the DCLTR key on aviation displays: hides the grid, the
  standing range rings, names of stars that aren't yours, habitability marks, your fleets' ETA labels and every route or rally line
  but the selected one. A panel's own range rings (e.g. while picking a destination) still show. Remembered between games.
- Fleet deployment steppers restyled to match the sliders: steel bevelled buttons with drawn red arrows and a lime readout.
- "Last turn" log under the galaxy sidebar (`js/ui/turnlog.js`): what happened to you during the turn just played, most urgent first
  (battles won or lost, bombardments, invasions; random events; colony notices such as population or factories at maximum, terraforming,
  shields, stargates; exploration as one line of star links; ships built; breakthroughs). Each star name is a link that selects the star
  and centres the map; six lines show until "All N"; the header folds it away (remembered). Fed by a new `turn:item` bus event from the
  turn driver, so every interrupt and its answer reaches it.
- Stargate routing: a fleet sent anywhere takes the quickest route, straight or through your stargates (fly to the nearest gate, jump
  in one turn to the gate nearest the target, fly on), when that saves turns. Player orders, rally-point ships and the computer
  opponents all route this way (`F.plan`, legs carried in `fleet.legs`; a gate lost on the way re-plans from the waypoint). The route
  preview and the line behind a fleet in flight show each leg (violet for the jump), and its ETA counts the turns still to go.
- Galaxy map: a colony with a stargate shows the original's marker, a small dark box with four blue squares beside the star (also in
  the map key). A new route button with the map controls (or L) turns fleet route lines and colony rally lines off for a busy late-game
  map; the selected fleet's or colony's line still shows. Rally lines are blue-grey, violet and dotted when they run through stargates.
- Less mouse travel:
  - Every slider takes the mouse wheel (one step a notch, Shift five) and Shift-click on − / + jumps to the end (colony, research,
    tax, security, transport and spy sliders).
  - Rally point (Reloc), population transport (Trans) and fleet deployment opened from the sidebar move beside the map click as soon
    as you pick a destination (the sidebar goes back to the colony). Enter accepts and Esc cancels in all three.
  - The wheel over a fleet row sets the count one ship at a time (Shift: a tenth).
  - Tactical combat: a right-click on the field is Done when nothing is open to cancel, and a double-click on the acting group is Wait.
  - Fixed: clicking the star that is already selected did nothing, so it could not be picked as a destination.
- Fleet deployment opens beside the click: clicking (or right-clicking a destination for) your fleet on the map shows the ship rows,
  steppers, route and Accept in a floating panel next to the cursor instead of in the sidebar across the screen, placed on the side
  of the click that hides the fewest reachable stars. It moves beside each destination you click, Enter sends and Esc cancels.
  Opening it from the sidebar button or the Fleets screen keeps the sidebar. (`UI.Side.show(..., { float: true })`, `UI.Side.place`.)
- The combat board has illustrated backdrops by situation (`assets/art/battle/`): deep space, high orbit (the defended world's
  glow and a debris ring just off-frame), an asteroid belt (dust and light shafts at the edges) and the inside of a nebula.
  They are painted dark for the board, so the game only veils them lightly (12 % instead of the 45 % the stand-in system plate
  needs) and the board stays readable.
- Missile bases on the combat board are a rendered orbital battery (`assets/art/fx/base-platform.webp`: a hexagonal platform with
  six silos, two open): up to six orbit a defended planet, each with a pulsing light in the owner's colour on its beacon lens,
  replacing the orange gear icons.
- The star-system screen has illustrated skies: six planet-free skies, one per star colour (`assets/art/system-sky/`), each with its
  sun painted in the upper right (a red dwarf with starspots, a blue giant, a neutron star with jets …). The sun's position and size
  are measured per image (`SKY_STAR` in `system.js`), so the planet is lit from the painted sun; the "<colour> star" label sits beside
  it and the fleets-in-orbit tiles start below it.
- Combat asteroids and wreckage are rendered cutouts: eight distinct dark, rugged rocks replace the grey procedural blobs on the
  battle board, sized from the planet (each rock 0.75-1.15 of the planet's radius, so about half its width), and a destroyed ship
  throws off small wreckage fragments (6-13 % of its length), each one of 24 pieces picked at random: hull sections, nacelles,
  trusses, a turbine, a dish, a radiator, a gun barrel, a gearbox and more. Never rocks. Cut from two generated sheets
  (`MOOg images/fx/fx-sheet.png`, `fx-sheet-2.png`) into `assets/art/fx/rock-*.webp` / `debris-*.webp`, colours as delivered.
  Fixed on the way: the board only ever showed three of the rock designs (the variant was taken modulo 3).
- Ships have their 3/4 view: nine rendered 3/4 "beauty" cutouts (one per hull class, `MOOg images/ship-variants/*-3q.png`, built
  into `assets/ships/ship-<class>-1-3q.webp` + team masks), recoloured to each empire's banner like the top-down set. They appear
  wherever the camera is not overhead: the design hologram, the system and colony cards, the bombers over the planet, the exile
  ending, the title fly-by, the tech blueprint and the GNN. The colonisation lander over the beach now uses it too (`scenes.js`).
  Each class has one 3/4 render, shared by all its top-down variants.
- The Galactic Council meets in an illustrated chamber (`assets/art/scene/scene-council-chamber.webp`): the leader photos stand in its six
  alcoves, graded to its lamplight, every delegate turned towards the pedestal (`Portraits.facing`: a photo whose leader looks away from
  the centre is mirrored), names and votes on the brass lectern panels, the galaxy and speaker holograms over the emitter. The two
  candidates take the inner alcoves; with fewer than six empires the outer alcoves stand vacant. The scene asks for a lighter colour pass
  over the plate (new `plate` grade preset) so the bronze stays warm. The drawn chamber remains until the image has loaded.
  `tools/test-scenes.html` now loads `gfx/worldart.js`.
- The old procedural (vector) race leaders are never shown in the game any more. While a race photo is still loading, or if it
  cannot load, portraits show a quiet stand-in card: a dark panel in the race's accent colour with a monogram ring and the race name
  (badges: the monogram inside the usual ring); a portrait set over a scene (`bg:false`) stays empty instead. The UI checks in
  `setup.js` and `gnn.js` no longer paint the old figure off screen to decide whether a race has a portrait, and the cartoon stand-in
  bust in `scenes.js` is gone. The procedural painter itself is deleted (`portraits.js` ~4800 → ~330 lines), with its dev pages
  `tools/test-portraits.html` / `test-portraits-v2.html` and `tools/handoff/portraits.md`; the API members only it used
  (`procedural`, `prewarm`, `v2`, `converted`, `light`) are gone.
- Dead code removed: `flipY`, `scalePts` and the uncalled `prism` painter method in `ships.js`, `wallQuad` and the room helper
  `angleAt` in `scenes.js`, an unused `sfxOn` in `ui/combat.js`. `tools/test-scenes.html` loads `gfx/pick.js` again (every scene threw
  `G.pick is not a function` there since the GPU picker arrived).

- The era: a slow arc under the exploration music that is felt in hindsight, never heard moving. `soundscape.js` reads a target from
  the state each turn and lets a value follow it a few hundredths a turn (`Music.setEra`). The target starts moving about halfway
  through a game: it is built from how many of the player's colonies have foreign colonies pressing close, how many races have been
  met beyond the first, the size of the fleets around the player against their own (the arms race), cold relations and open wars —
  a lone empire with five colonies reads 0, a first contact far away 0.05, three races met with one on the border 0.3, a crowded
  frontier with growing fleets 0.65, one war 0.9; a new performance of an exploration piece reads it once when it is compiled, never mid-piece. As
  it rises: chords gain ninths and sevenths (about half of them at the top), then major sevenths and minor ninths, a fourth chord turning
  minor and the tonic gaining its seventh near the top (never the cadence, never a suspension), the pads voice one more note past the
  midpoint and sit closer (stage width −30 %), the delay echoes tighten by half while the hall stays (it is what makes the recordings
  real), the tempo lifts up to 4.5 %, and recorded low strings and the men stand in more and more often (`eraAlts`, 90 % at the top);
  past two thirds of the arc something eerie appears now and then, far back in the hall — a high violin tremolo holding a note a half
  step off the chord and swelling over a few bars, a bowed-cymbal shimmer, very rarely a breath of whispered noise (`genEerie`, the
  `tremHi` preset on the `fx` layer); the rare pieces grow likelier. Below 0.3 the planetarium
  rotation plays; war still takes the war rotation.

## 1.2.0 — 2026-10-17

- GNN (`tools/handoff/gnn-logistics-2026-10.md`): a broadcast no longer closes on its own. The last story stays on air until
  Space / click / Continue (the Next button turns into Continue); before, a one-story newscast left the screen 3.5 s after the
  headline finished typing. Stories before the last hold for their reading time (about 16 characters a second, 4–11 s) instead of
  a 2.8–3.5 s cap, rankings 5.5 s. Input in the first 0.6 s is ignored, so the key or click that ended the turn cannot skip the
  news it opened. The stuck-turn Skip float is not offered while a broadcast is on air (it has its own controls). The anchor is
  one race for the whole game, chosen from the races not playing it where possible, instead of a random race every broadcast.
- Photo portraits hold still: no zoom on portraits under 220 device pixels, a 0.35 % slow push on large ones, no zoom "pump"
  while talking (talking is the flicker only). The Races screen redrew its photos at 10–20 fps with a 1–2 % breathing zoom and
  pulsed all five with a brightness / glow filter in Report / Audience pick mode; the pick highlight is now a steady ring.
  The audience envoy's sway is a third of what it was.
- Stargates: a violet ring with four notches marks every stargate on the galaxy map (own ones, foreign ones in scanner range);
  the colony panel shows "stargate"; route previews between two gates read "Stargate · ETA 1 turn" in violet; the Trans panel
  ETA now uses the stargate like the launch does (it showed the normal transport ETA and the colonists then arrived in one turn).
- Rally points (RELOC): thin blue-grey rally lines with drifting chevrons from each colony to its rally point (violet when it is a
  stargate pair); the colony panel shows "Rally → Sol · 3 turns (stargate)"; the Reloc panel previews the route and ETA and asks
  for Accept (Space), with "All colonies" and "Stay here"; Alt+R on a selected colony points every colony at it (again: clears
  them), the original's hotkey; a rally point that is captured or lost points back home (`Fleet.fixReloc`, every turn and before
  ships are dispatched) instead of staying as a stale target. New `relocAll` order. Tests: `tools/rules/88-logistics.test.js`.
- Waiting-for-input lights (`UI.attention` / `UI.attentionGroup`, css/kit.css): whenever the turn waits on the player, the control that
  moves it on pulses gold (Continue / OK / the card's default answer), now also in modals opened during a turn (event cards, spy
  reports, alerts: their primary or lone affirmative button), the audience's lone Continue and the Council's Continue cards. Real
  decisions with no safe default light ALL their options with a softer blue pulse instead of recommending one: the Council vote and
  accept/defy, AI treaty offers in an audience, spy steal / sabotage / frame targets, the fallback research choice. A modal opened over
  a waiting card hands the light back to the card when it closes. Modals the player opens outside a turn stay unlit.
- Galactic Council chamber art: the delegates' photographs are graded into the painted hall (studio black lifted to the alcove's dusk
  tone, warmed toward the hall light, lit from above) and stand in their alcoves at a believable scale instead of filling two-storey
  arches; idle seats dim warm instead of under a navy veil. The speaker hologram crushes the photo's grey backdrop and fades to nothing
  inside its box (it read as a pasted rectangle), floats in a soft projection beam, and its floor glow is an ellipse. Light shafts in
  every scene (`Scenes` `beam()`) have soft edges (four nested layers) instead of one hard-sided trapezoid. A voted seat lights a desk
  lamp instead of an unshaded "ballot chip"; name plates show an empire-colour gem instead of a thumbnail of the same photo.
- GNN broadcasts only what changes the player's game (`News` `broadcastFilter`; everything is still archived): a war between two AI
  empires the player has met, if the pair is still at war when the bulletin is compiled (the AI pass could declare war and make peace,
  or go from war to an instant alliance, in one turn: the "at war, then not" newscast), once per pair per 20 turns, two new wars per
  bulletin at most; empires destroyed, Orion colonised, the Guardian slain, planets destroyed / novas, the stars report, the human's own
  coup, the rankings filler. Archived only: AI peace / alliances / treaties / trade / conquests, wars the human is party to (the audience
  already said so), other empires' local random events, event cards already shown, Council outcomes, AI coups. Measured over six
  headless games: 1.19 → 0.46 newscasts per 10 turns. The GNN ticker draws from its own random stream: drawing it from the game's RNG
  only when a bulletin aired made the simulation depend on what was broadcast. `86-ai-fixes` scrap measurement now sums three seeds.
- A colony wiped out in a war (bombed or depopulated) is archived like a conquest: over a 450-turn game the late wars aired 10–25 such
  newscasts per 50 turns (one every two to five turns). A comet strike or a nova still airs.
- Smoother animation, higher frame rates (`tools/handoff/frame-pacing-2026-10.md`): every screen that draws slower than the
  frame loop now gates with `MOO.UI.pace()` (kit.js), an even-cadence divider of the measured display rate (`UI.displayHz()`,
  shown in the F3 overlay), instead of its own "accumulate, draw when >= 1/fps, reset" timer — those drew the scenes at
  48 fps on 144 Hz monitors, 37.5 on 75 Hz, 45 on 90 Hz, 55 on 165 Hz, and the 40 / 24 fps pictures at 30 / 20 on 60 Hz,
  slipping a frame whenever rAF jittered. The galaxy map paints its static backdrop (sky, galaxy cloud, parallax star tiles)
  into an offscreen canvas and re-paints it only when the camera, size or quality changes (idle frames draw 7 instead of 18
  megapixels of blended images at 1600×900, dpr 1); the tactical screen repaints its graded scene backdrop (a dozen
  full-screen passes plus a filtered copy) at 24 Hz into a cache and blits it. The adaptive-quality governor no longer climbs
  back into a tier it dropped from for slow frames for five minutes (it did after ~20 s, because a 30 fps-gated loop always
  looks fast, so a slightly-too-slow machine alternated between two looks and two frame rates), and judges "slow" against
  the display rate rather than a fixed 60. Hidden-tab gaps and one-off stalls are ignored by the governor again (the loop's
  0.1 s clamp had hidden them).
- Graphics pass 3 (`briefs/graphics-pass-3.md`, audit in `tools/handoff/graphics-inventory-2026-10.md`): the object layer
  catches up with the illustrated layer. Galaxy map: unexplored stars are lit sprites in their own tint (no discs or
  rings), subtle twinkle, drifting dust, engine trails on moving fleets, a short settle when the side panel changes.
  Title: a lit metallic wordmark. Endings: exile plays on the galaxy plate with the homeworld receding and the ship as a
  dark silhouette. Landing: troopers are photo-treated silhouettes, the bombardment shield is a limb glow and the reticle
  is lit; event cards carry their plate. Tactical combat: plate backdrop, grid only near the cursor, brick-red selection,
  ring missile bases, planet limb glow, darker cratered rocks, bloomed beams, staged explosions, missile plumes,
  shockwaves and a camera nudge. Star system: the system plate is the backdrop with its own star as the sun and the live
  planet in front; the GPU and CPU suns have limb darkening and fine granulation. The unused plates are consumed (Races
  "Not Present" slabs, ledger thumbnails, the build box). Ships: the build and the renderer take a second, 3/4 view
  (`ship-<class>-<n>-3q.webp`) that the design hologram, cards, lander, bombers, title and exile ask for; until that art
  exists (`docs/IMAGE-GEN-SPRITES.md`) every screen keeps the top-down hull. Rocks, debris, the base platform, the
  planet-free system skies, the battle backdrops and the exile / spaceport stills load the same way when they land.
- Galaxy music, less repetitive and more atmospheric (`js/audio/music.js`): four new exploration pieces in the planetarium manner —
  `galaxy5` (the veil: a slow harp waltz in three, oboe, women far back), `galaxy6` (the abyss: cellos on a sunken pedal, bassoon
  and alto flute, the men chanting the phrygian step; also in the war rotation), `galaxy7` (the cradle: a lullaby in six, rocking
  harp, clarinet, glockenspiel) and `galaxy8` (the beacon: glass synth, slow pizzicato, a distant horn calling the leitmotif,
  crotales and tubular bells answered by the delay) — eight pieces in the map rotation, about 35 minutes before anything returns.
  Two rare pieces in the Crimson Tide manner slip into a cycle about a third of the time each: `galaxy9` (the tide: deep sub-bass
  swells, the analogue sky, low brass, the hymn in the horns at the crest, tam-tam) and `galaxy10` (the chorale: the men's choir
  carrying the hymn over the organ, horns beneath, the women at the crest, timpani); at war their `:war` readings add the Mutiny
  kit (processed booms, synthetic kick and snare, anvil) in the big sections.
  Every galaxy piece now has `forms` (three or four orderings of its sections, so a performance opens differently each time),
  alternative written readings of its melodies (`ph: [...]`, chosen per performance; a doubling that says `ph: '@'` follows the
  other line's choice), parts that sit out some performances (`skip`), phrases the player leaves out (`rest`), breath sections of
  varying length (`barsVar`; at most two bars, with a faint high pad so a breath is never a hole in a long programme) and a small tempo rubato (`rubato`), on top of the per-pass instrumentation `alts`; a per-performance
  `take` seeds the variation RNG so no two performances of a piece are the same. The music never stops on the map: a piece
  crossfades into a one-minute interlude (five hidden templates — drift, harp, voices, horizon, pulse — re-rooted to the key and
  mode of the piece that follows, never the same one twice running) and the interlude into the next piece — each newcomer enters on the last bar line of the piece before it and fades in equal-power
  over up to six seconds while the outgoing piece plays its final chord to the end and decays beneath it; reshuffles never repeat
  the piece just heard and keep pieces in the same key apart; `Music.snapshot()/restore()` carry the whole rotation, rare pieces
  included. Fixed: galaxy4's cello and men's lines in section B were written 16 bars late and never sounded; galaxy1's section C
  had two `choir` keys.
- The underscore senses the game's phase: in the first years, before anyone has been met (and before turn 70), the map plays the
  planetarium rotation only (`galaxyEarly`: deep field, beacon, wonder, veil, cradle, with the pad and harp interludes — big sky, no
  choir or drums); contact, or time, opens the full programme, and war the war rotation (`soundscape.js`, on the bar at turn end).
- The procession (`procession`): a march in the nobilmente manner — a solo horn carries a long-breathed theme over tuba and
  trombones on the step, the snare alone keeps a march cadence with a firm bass drum on the one, bone dry (`def.sends` lets a
  piece override one layer's reverb / stage / delay sends), strings and organ behind, the choir entering as the theme returns,
  the flat-sixth lift for the big phrase, a lyrical trio, a hymn and the full chamber's answer. On the map it wears the family
  tone (dark top, more hall) and grows out of the interlude through an eight-bar approach (strings and the horn call, harp, ghosted
  snare under the horn, the cadence only with the theme); it is the rarest of the rare pieces in peacetime (`rare.p` may be a map
  of id → probability) and a regular piece at war. The Galactic Council plays the same composition in state (`council2`, derived
  at registration): abbreviated (long sections halved, the big phrase within the first quarter minute), slower, and ceremonial —
  tam-tam and a timpani roll under a brass fanfare on the call, the organ of the chamber spread wide, the horn section and brass
  doubling the solo horn over a sustained brass bed, cymbals on the entries, timpani on the step, the choir forward, a brighter
  room; it alternates with the original `council`. `Music.renderOffline(id, secs, { loop: false })` lets a performance end
  naturally instead of running into its next pass.

## 1.1.1 — 2026-10-17

- Fun audit (`tools/handoff/fun-audit-2026-10.md`): the GNN now broadcasts only what the original treats as news (events, wars,
  peace, alliances, eliminations, council, stars reports, rankings) — battles, fleet losses, first contacts and treaties go to the
  archive only (83 → 21 newscasts in a 200-turn game); AI empires' random events reach the news (their headlines were dropped);
  the original's end-of-turn reports are back (population maximum, soil / Gaia / atmosphere projects, planetary shield, stargate,
  grouped fleet production) and stay on the map until the next turn, clicking one selects the colony; exploration and colonise
  cards show the wide planet plate, the planet's special, a line of flavour and mark the star on the map; the battle result card
  no longer clips in the side panel; the map camera keeps the view over the galaxy.
- Deploy/release fixes from the October review: re-running `install.sh` after certbot no longer fails on the http→https
  redirect or resets `tls=no` (it reads domain/email/web from `install.conf`, reuses an unchanged release, and only adds
  `python3-certbot-nginx` for apt certbot, not the snap); `upgrade.sh` refreshes scripts/templates/units/VERSION even
  when the game is unchanged and no longer overwrites itself while running (files are renamed into place; unit files
  via `mktemp`); releases are ordered version-aware (`sort -V`: `v1.0.10` > `v1.0.9`) for prune and rollback; each
  release is stamped with a build id (`window.MOO_BUILD` in `js/manifest.js`, `M.VERSION` from `VERSION`) and
  `js/loader.js` busts with `?v=<build>` instead of a per-load timestamp, so nginx/Caddy now cache fingerprinted css/js
  for a year while `index.html`/`manifest.js` stay `no-cache` (nginx also gets `image/webp` and keeps the security
  headers on `/version.txt`); `backup.sh` saves all of `/etc/letsencrypt` (certificate restorable) and skips the
  release tree; the doctor unit waits for the network and web server; CI checks `VERSION` against `js/core/ns.js`.
- Turn flow: prompts the turn waits on (explore/colonise cards, pre-battle choice, battle result) are held on screen and
  re-shown when the galaxy screen is re-entered, so a turn can no longer freeze on a panel nobody can see; the control
  that answers the pending step is highlighted and focused (Enter/Space); load / quit / new game abort a running turn;
  an engine error no longer overwrites the autosave; the "Skip this step" escape appears only when nothing visible can
  answer, and skipped steps take the harmless choice (battles auto-resolve, audiences reject, no bombardment).
- Immersion: the player's envoy in audiences, the GNN anchor and every photo placed on a scene use a bust-shaped soft
  mask (no square plate edges) and are graded only on their own pixels; the drawn hooded envoy, the throne-room victory
  set with its crown, banners and confetti, and the funeral procession are now fallbacks behind the race council,
  figure and devastated-world illustrations; the colony side panel shows the orbit illustration as the original's
  wide planet box; the galaxy map uses bracket-only selection, glint-style unexplored stars and a soft territory tint.
- Graphics: no synchronous planet or star texture generation on the main thread; shader warm-up never blocks a frame.
- AI: fleets no longer commute between unguarded colonies; the AI stops scrapping live fleets wholesale; planner
  errors are logged (`aiLog`).
- Deployment: installer re-runs keep TLS and read install.conf; atomic script updates; numeric release ordering;
  build-id cache busting with immutable caching for fingerprinted URLs; full certificate directory in backups.
- Smoother play: right-click a destination to send the selected fleet at once; "Auto-resolve every battle this game"
  on the pre-battle card; Options for the colony landing scene and a brief one-page news mode; "Waiting for …" in the
  bottom bar during a turn; the control that advances each scene is highlighted and focused; arrow keys work on the
  colony sliders; "Confirm end of turn" checks ships-without-design and unfunded research; "Keep playing" after a
  victory; the Council ruling re-opens instead of auto-accepting if its screen is lost.
- Sim fixes from the October review: an unanswered audience is no longer an acceptance (it could declare war or break an
  alliance); bombardment needs an explicit yes; locking the Tech slider while the Eco floor rises no longer breaks the
  100 % slider sum; dead empires take their fleets with them; bombs hit a planet whose bases are gone; order values are
  validated (negative fleet counts, NaN sliders, bad build keys, transports to the same planet); an invalid tech pick
  falls back to the first choice; failed autosaves are reported.

- Better building blocks for the score. The instrument set is rebuilt from **Sonatina Symphonic Orchestra 2.0** (CC Sampling Plus 1.0;
  see `assets/audio/README.md`): real string sections in their stage seats (sustain, tremolo, staccato, pizzicato), section horns in two
  recorded dynamic layers, trumpets, trombones, tuba, solo horn and trumpet, flutes and solo winds (flute, alto flute, oboe, cor anglais,
  clarinet, bassoon), a recorded mixed chorus (men and women) in place of the synthesized choir, concert harp, glockenspiel, celeste,
  crotales, tubular chimes, timpani with hits in two layers and looped rolls that swell into the downbeat, bass drum, snare, piatti,
  cymbal rolls, tam-tams, triangle, tambourine, bell tree, sleigh bells, wood blocks, shakers and two pipe-organ stops. The build reads
  the library's own SFZ definitions (`tools/samples/sfz.py`) for ranges, tuning, loops, round robins and layers instead of guessing. The
  sampler now crossfades between recorded dynamic layers with the written dynamic (and swells through them over long notes that follow a
  crescendo), plays legato notes past the attack transient when a line moves without a gap, spreads note onsets by a few milliseconds and a
  few cents (nobody in an orchestra starts on the same sample), seats every section on the stage, and lets looped sustains hold for any
  written length. The analogue pads are re-synthesized as a nine-voice stereo unison with a breathing filter and tape saturation; the
  music bus gains a slow glue compressor; reverb and chorus sends are moderated because the recordings already carry a hall. Rebuild with
  `python3 tools/samples/build.py --sso "<sso>/Sonatina Symphonic Orchestra" --vsco <VSCO-2-CE> --out assets/audio`.
  Refinement after listening: a more open master (peak-only limiter at 2.2:1, a gentler glue stage, a larger 3.3 s hall with more pre-delay,
  a lighter low shelf), more room on the pad, bell and choir sends; the galaxy underscore leans toward Serrie (an analogue sky with a new
  high "air" pad above it, distant women's voices, celeste and harp as single points of light, slower harmonic motion, no hi-hats) and the
  dramatic cues take the Crimson Tide layering (analogue pad as the floor, low men's choir as the bed, strings mid, brass for the peaks,
  fewer bell sparkles). Silence is composed: the exploration pieces carry rests between phrases and whole bars where only the hall rings
  before the next entrance, and the rotation leaves 26 s of quiet between pieces.
  Against repetition: every looping piece now carries `forms`, two differently ordered blocks of its sections each five minutes or
  longer, played in turn from a random starting block (the title also alternates its doubling instruments per block), so a cue that
  stays on for twenty minutes is heard as long, changing blocks rather than a three-minute loop. The samples are re-encoded at the top
  VBR quality (lowpass near 19.5 kHz instead of 16), with a stronger air shelf on the sections and chorus and stereo upper strings;
  preview renders from `tools/audio-report.js --mp3` are 320 kbps.
  Fixed the "digital" colour of the sections: the Sonatina recordings are wide stereo with nearly uncorrelated channels (the horns
  partly anti-phase), and folding them to mono by averaging comb-filtered every section with 4-8 dB notches across 1-8 kHz. Mono
  instruments now take one microphone channel (the one on their side of the stage) instead of the sum; the string and brass sections
  keep the library's own loops instead of shortened ones.
  Natural top end instead of equalised darkness: the orchestra core (string sections, horn, trumpet, trombone, tuba, winds, harp, glock,
  drums, cymbals, gong) is built from VSCO 2 Community Edition again, this time correctly (stereo sections in their stage seats, one
  microphone channel where mono, two recorded dynamic layers crossfaded, no left+right summing); measured at 5 kHz the VSCO recordings
  carry 10-15 dB more than Sonatina's distant perspective. Sonatina stays only for what VSCO never recorded: the chorus, celeste, crotales,
  tubular chimes, bell tree, small percussion, timpani and the soft organ stop. The master tone shelves are flat; a sine sub-octave layer
  sits under the basses and timpani (a deliberate Zimmer layer, not a correction), and a mid/side stage widens the image.
  The split is per family, by measurement: VSCO for strings, trumpet, trombone, flute, bassoon, drums and cymbals; Sonatina for horns,
  tuba, oboe, cor anglais, clarinet and harp (VSCO's horn and harp are the dull ones). The synth pads' filters open further (a low
  pad used to close at 2 kHz).
  The production mix: every music layer now runs through its own channel strip (high-pass per register so the bass owns the lows and
  the beds stay out of it, low-mid cuts where the beds stack up, presence where a line has to read, bus compression on bass and lead,
  parallel compression on the drums, a short cross-fed spread for width), the pad and choir beds dip 2 dB under every melody note,
  a sine sub-octave sits under the basses and timpani, and the 2-bus has weight, a mud cut, a little presence and air, true mid/side
  width with the bass kept centred and the sides opened above 6 kHz, a glue stage and a peak limiter. Levels are set by meter (a
  master fader `MIX_TRIM`): underscore around -17 LUFS, tutti around -14, 13-16 dB of crest, stereo correlation 0.3-0.45.
  Channel EQ per instrument (the far recordings get their presence back, bells and strings their air, the bass its definition), a
  second reverb plane (a short bright stage for the melody, plucks, bells and drums; the hall for the beds) that dries up as a battle
  escalates, a whisper of tape saturation on the 2-bus, and on the exploration pieces long feeding-back dotted-eighth delays and a
  Gamba organ swell: a little Division Bell.
  Third pass: every compressor's automatic makeup gain is compensated so stages only reduce and levels are predictable; dynamic mud
  control on the 2-bus (a three-way crossover with the 160-450 Hz band compressed only when the beds pile up, the low band held even);
  a transient stage on the drums, an exciter on the far choir, tempo-synced pre-delay on the hall, arpeggios ducking under the melody,
  a slow sub floor under the planetarium pieces, the men's choir as the bed of the battle, council and war cues; the balance opened
  (upper bass and low mids cut on the bus, bass, strings, pads and drums; the reverbs no longer carry low mids; air on top and on the
  sides). `tools/audio-trims.js` turns a report into per-cue trims.
  Arrangement revisions on the exploration pieces: slower (54-78 bpm), no kit and no crash or riser at section changes (`gentle`),
  the string sections carry the harmony with the analogue pad a fifth of the weight underneath (about 80/20 symphony to synth), a
  cello voice for lines and a cello bed, instrumentation that changes from block to block and from one play to the next (`alts` start
  at a random block), the men's choir surfacing low in one section and one alternation, a four-note Shine On motif answered by the
  delay, deeper bass (a 55 Hz shelf, more sub, the low band held even), and each family carved its own place (pads and choir dip
  where the lines speak, no Haas spread on the melody). Per-cue loudness pass on every cue, battle cues measured at battle intensity.
  Listening round: the top end tamed everywhere (air shelves halved, a 3.6 kHz dip); the four exploration pieces darker still (a
  per-track tone shelf), slower (50-72 bpm), meditative (sparser plucks, whole-note basses, lower climaxes, no timpani) with a sung
  men's-choir phrase written into each and more hall; the battle cues more dramatic (brighter and heavier tone, tam-tam and bass-drum
  hits at the section entrances, timpani gallops, the men's choir at full voice with the mixed choir above, a wider span between
  ostinato and climax); the title a little faster with the men's choir as its bed throughout and battle drums under the march and tutti.
  The choir sings instead of pads: the recorded onsets come through (short attacks), chords longer than a breath are sung as phrases of
  four to seven seconds with a small gap and a swell in each, singers spread by a few tens of milliseconds, every recorded semitone is
  kept so a repeated note alternates between takes (`alt`), and the exciter, Haas spread and bus chorus come off the choir strip.
  The title is now a hymn for men's choir with the analogue synth around it and no drums (the horns soft behind the voices, a cello
  counter-line); in the exploration pieces the choir is low and supportive, singing softly (`soft`: longer breaths, slower and lower
  swells) in more sections but never forward.
  The title's arc: it opens on the pipe organ with the men low beneath it and ends with the men's choir carrying everything, the organ
  under them; a pedal in the bass sinks from the low octave to the very deep one and back (the sub follows a very deep note at its own
  pitch, an octave below a note that has one).
  The choir is written as parts: a voice that keeps its pitch across a chord change holds it (no re-attack), a voice that has to leap
  walks to its note through a diatonic passing tone, the voices enter one after another at a phrase start, and in the title the men
  sing the hymn tune itself as the top voice with the parts moving beneath it.
- Symphonic re-orchestration and film-style flow. Every synth pluck, FM bell, pad, bass and drum-machine part in the score is now a
  recorded instrument: pizzicato string sections, marimba, glockenspiel, harp, oboe / clarinet / bassoon, contrabass, bass drum,
  snare, field drums, tambourine, claves, anvil, stick taps (the two machine races keep a little sequencer colour). The bell
  "sparkle" layer is half as dense and sits further back, arpeggio and drum layers are lower, brass detune is subtler, the hall is
  longer (2.5 s) and the air shelf softer; the default music level is lower. The music now behaves like an underscore: management
  screens (design, research, ledgers) keep whatever is playing, scene changes wait for the next bar and cross-fade over 4-5 s
  (battles switch on the beat), battle layers swell in over seconds instead of per hit, the lab and spy panels no longer borrow a
  cue of their own, and the exploration rotation breathes 26 s between pieces. The map underscore senses the empire: at war it turns to the determined and
  uneasy pieces, and a declaration of war or a peace treaty changes it at the end of the turn, on the bar.
- Sampled orchestra for the score (`assets/audio/`, 9 MB of MP3 multisamples): string sections (sustain, spiccato, tremolo), horns, trumpet,
  trombone, tuba, flute, harp, pipe organ, timpani, bass drum, snare, cymbals and gong from the CC0 VSCO 2 Community Edition, plus a
  synthesized men’s and mixed choir, analogue ensemble pads and a sub bass (`tools/samples/synth.py`). `js/audio/sampler.js` streams
  them in after the first click and plays them through the engine (loop points corrected by a decoder-delay calibration, velocity
  layers, round robins, per-voice ensemble detune, a three-tap chorus on the pad and choir buses); every preset keeps its synth
  fallback, so `file://` and offline play sound as before. Three new pieces written for the new palette: the main theme (a horn and
  men’s-choir hymn that builds to a full tutti with snare, bass drum and cymbals), a deep-field exploration ambience, and a battle
  cue with spiccato ostinato, low-brass stabs and the theme in the horns; all other tracks are re-orchestrated through the presets.
  Rebuild with `python3 tools/samples/build.py --vsco <VSCO-2-CE checkout> --out assets/audio`.
- Sound effects pass: the most frequent sounds (button click, cancel, panel open/close, new turn, GNN blips, lasers, shield and armour
  hits, small explosions, missiles, gunfire) rotate between two or three takes with small random pitch, level and timing differences so
  they never repeat identically; stingers gain sampled sweeteners once the instrument set is loaded (bass drum, gong, cymbal, harp
  runs, a breath of choir, a low-brass stab under "war declared"); every beam-weapon family has its own voice (laser, rapid-fire
  cannon, mass driver, neutron, phasor/ion, plasma/fusion, disruptor, death ray) chosen by `combat-fx.js`; new cues for a newly
  explored star (`discover`), first contact (`contact`) and the GNN broadcast ident (`gnn_ident`: snare roll, three brass hits, chime);
  the new-turn chime is a soft chord in fifths over a low tap. Levels measured: interface ≈ -30 LUFS, frequent weapons ≈ -22,
  stingers ≈ -13, the music dips 2-5 dB under the stingers.
- Audio: measured pass over the procedural soundtrack and effects (`node tools/audio-report.js`, shared metrics in `tools/lib/audio-metrics.js`, also shown by `tools/test-audio.html`). Fixes: the battle's music-intensity level no longer leaks into the exploration music (tension overlays after a fight); the combat tracks build up with battle damage instead of ignoring intensity; voice pool 32 → 64 (combat1 was refusing notes, crossfades need the room); event stingers and big combat sounds re-trimmed to ≈ -14 LUFS and they duck the music a few dB; fades can no longer throw mid-crossfade; background tabs schedule 2.5 s ahead. New: hostile variants of all ten race themes (`race:<id>:war`, used when the ambassador is angry), a `spy` track for the espionage panels, the galaxy music rotates as a shuffled playlist with a pause between pieces, `Music.snapshot()/restore()` for scenes that borrow the music.
- World art wired into the game: `js/gfx/worldart.js` lazy-loads the 115 illustrations from `assets/art/*.webp` (webp conversions of the PNG masters in `assets/world-art/`, ~16 MB vs 266 MB). Used for the title galaxy, landing surfaces and ground-battle backdrop, diplomacy audience rooms, research scenes, planet cards, the GNN studio and GNN event stills, and the race-select homeworld card. Every use falls back to the procedural art when an image is missing; `?art=0` disables it.

## 1.0.1 — 2026-10-13

- Install: auto-detect Caddy (`--web caddy|nginx|auto`) so a machine whose ports 80/443 Caddy already owns works; Caddy handles TLS. nginx failures now print the port conflict and the log tail.

## 1.0.0 — 2026-10-13

- First deployable release: playable end to end (see `HANDOFF.md`).
- Server tooling for a home Ubuntu box behind nginx + Let's Encrypt:
  `scripts/install.sh`, `upgrade.sh`, `rollback.sh`, `backup.sh`, `doctor.sh`,
  `uninstall.sh`, a daily doctor timer, and `docs/DEPLOYMENT.md`.
