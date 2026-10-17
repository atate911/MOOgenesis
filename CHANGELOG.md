# Changelog

Versions follow `MAJOR.MINOR.PATCH`; the live version is the `VERSION` file.
`scripts/upgrade.sh` refuses to move to an older `VERSION` unless told to.

## Unreleased

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
  varying length (`barsVar`) and a small tempo rubato (`rubato`), on top of the per-pass instrumentation `alts`; a per-performance
  `take` seeds the variation RNG so no two performances of a piece are the same. The music never stops on the map: a piece
  crossfades into a one-minute interlude (five hidden templates — drift, harp, voices, horizon, pulse — re-rooted to the key and
  mode of the piece that follows, never the same one twice running) and the interlude into the next piece; reshuffles never repeat
  the piece just heard and keep pieces in the same key apart; `Music.snapshot()/restore()` carry the whole rotation, rare pieces
  included. Fixed: galaxy4's cello and men's lines in section B were written 16 bars late and never sounded; galaxy1's section C
  had two `choir` keys.
- The underscore senses the game's phase: in the first years, before anyone has been met (and before turn 70), the map plays the
  planetarium rotation only (`galaxyEarly`: deep field, beacon, wonder, veil, cradle, with the pad and harp interludes — big sky, no
  choir or drums); contact, or time, opens the full programme, and war the war rotation (`soundscape.js`, on the bar at turn end).
- Galactic Council: a second piece, `council2` (the procession: the snare alone carries the march with rudiments and rolls, a solo horn the tune over tuba and trombones, behind the brass
  horns carrying the tune low in their register over tuba and trombones on the step, organ and choir; the drums fall away while the votes are cast and return with the tam-tam for the result; new
  `DRUMS.field` kit); the original `council` is kept and the two alternate between visits.

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
