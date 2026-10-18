# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

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
