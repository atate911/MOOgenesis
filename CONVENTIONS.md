# Master of Orion — Reborn · Conventions (read first)

A from-scratch browser remake of the 1993 4X classic *Master of Orion* with modern graphics, procedural audio and all the
original systems (races, tech, ship design, tactical + ground combat, diplomacy, spies, Galactic Council, GNN, Antarans, Orion).
Original screenshots were used only as a layout/feel reference (`research/00-original-screens-notes.md`). **All art, music and
text are original — never imitate or reproduce original assets.**

## Stack & hard constraints
- **Vanilla JavaScript (ES2020), HTML5 Canvas 2D, Web Audio, CSS.** No frameworks, no bundler, no npm packages, no network at runtime
  (web fonts are optional). Must run by opening `index.html` (file://) in current Chrome/Edge/Firefox. **No ES modules** — classic scripts only.
- Every JS file is an IIFE that hangs its exports off the shared namespace:
  ```js
  (function (M) {
    'use strict';
    M.Gfx.Planets = { ... };          // namespaces pre-created by js/core/ns.js:  Data Sim AI Gfx Audio UI Util
  })(window.MOO);
  ```
  No other globals. `MOO.Util` (js/core/util.js) and `MOO.RNG` (js/core/rng.js) are available to anything loaded after core, but
  **gfx/ and audio/ modules must be self-contained** (carry their own tiny helpers) so they work in isolated test pages.
- Load order = `js/manifest.js` (single source of truth). **Only the lead edits manifest.js, kit.js, css/base.css, css/kit.css, ns.js.**
  Create only the files you own. If you need something changed in a shared file, say so in your final report.
- **Headless rule:** files under `js/core`, `js/data`, `js/sim`, `js/ai` must not touch the DOM/`window` beyond `window.MOO` — they are also
  executed by Node (`tools/headless.js`) for simulation tests.
- Sim code is **functional over plain data**: game state `S` is a JSON-serialisable object (no class instances, no functions, no cycles — reference
  things by numeric id). Functions take `S` as first argument. All randomness comes from `S.rng` (seeded, serialisable) — never `Math.random()` in sim.
- Style: 2-space indent, semicolons, `const`/`let`, short functions, comments only for non-obvious intent. Be performance-aware in per-frame code
  (no allocation in hot loops, cache gradients/sprites in offscreen canvases).

## Phone layout layer (`tools/handoff/phone-2026-10.md`)
- `index.html` decides `<html data-phone>` before any CSS loads; `js/core/phone.js` exposes it (`MOO.Phone.active()`; it reads the
  `window.MOO_PHONE` flag, undefined in Node). Perf, workers and audio read it once at start-up.
- Phone rules live only in `css/phone.css` (layout) and `css/phone-skin.css` (look), every selector starting `html[data-phone]` (or
  `html:root:root[data-phone]` to beat a bumped restyle). A new screen family on phones sets the `--pk-*` tokens on its root element
  instead of restyling cards and controls one by one. Phone behaviour lives in `js/ui/phone*.js`. A screen file gets at most a one-line `M.Phone && M.Phone.active()`
  branch; never change a desktop rule to make a phone layout work.
- Back on phones is a synthetic Escape: keep every screen's Escape binding equal to its right-click / Cancel.
- Sizes on phones: controls at least `var(--tap)` (44px), list rows `var(--row)` (38px), text at least 12px (`max(12px, …rem)`).
- A visible hint that names a key or the mouse goes through `UI.Phone.say(desktop, phone)`; a key badge through `UI.Phone.key(k)`.
  Tooltip texts are made touch-friendly automatically. Give clickable elements their handler through `UI.h` (`onclick` etc.) so
  they carry `data-act` and a tap on them never pops a tooltip instead.
- Check a change with `node tools/qa/phone.js` (and `landscape`, `small`), and diff `tools/qa/layout-fingerprint.js` against `main` for desktop.

## Threads, GPU & portability (the game uses the hardware it finds — and never requires it)
- **Worker-safe modules** (`core/util|rng|ops`, `data/*` that sim needs, `sim/*`, `ai/*`) are written `MOO.def(function (M) { … });` instead of an IIFE
  (see `js/core/ns.js`). `MOO.def` runs the function and remembers its source so `MOO.Workers` can boot identical code in a pool of Web Workers (works from
  file://) and `tools/headless.js` can load it in Node. They must be self-contained (reference only `M`, never outer variables), DOM-free and deterministic.
  Large static text (`data/text.js`, `data/names.js`) stays IIFE (main thread only).
- **Ops**: expose parallelisable work as `M.Ops.name = function (payload) { …return result; }`; call via `MOO.Workers.run/map/mapChunked(op, payload, {snap:true})`.
  Payloads/results = plain structured-clonable data (no functions/RNG objects — pass seeds or `rs` state arrays). With `{snap:true}` the op reads the per-turn game
  snapshot `MOO.snap` (set by `MOO.Workers.setSnapshot(S)`; treat as READ-ONLY). If workers are unavailable everything runs inline automatically.
- **Parallel turn design**: AI planning is a PURE function `AI.plan(snapshot, empireId, seed) → orders[]` (no mutation of S; one worker per AI empire), battle
  auto-resolution is pure `Combat.resolve(battle, seed) → result` (all AI-vs-AI battles run concurrently; the player's odds preview runs Monte-Carlo across the pool),
  planet textures are built in workers. Anything that MUTATES game state runs on the main thread in deterministic empire order (orders applied by `Sim.Orders.apply`).
- **GPU**: WebGL2 renderers are optional accelerators. `MOO.Gfx.GL` (js/gfx/gl.js) provides one shared offscreen context, shader/FBO helpers and GLSL noise; a renderer does
  `GL.begin(w,h) … draw … GL.blit(ctx2d,dx,dy,dw,dh)`. EVERY GL path must have a Canvas2D fallback with the same API/look (choose with `MOO.Gfx.GL.supported()`).
- **Adaptive quality**: scale effort from `MOO.Perf.q` (dpr, particles, planetDetail, nebula, glow, maxFx, gl, animFps) — never hard-code counts. `MOO.Perf` probes the
  device, picks a tier (low/medium/high/ultra) and re-tunes live from measured frame times; F3 shows an overlay. Target: ≥60 fps on a modern iGPU laptop at 'medium',
  ≥144 fps headroom on a high-end desktop at 'ultra'. No feature may *require* workers, WebGL2, big memory or many cores. Respect `MOO.HW.memoryGB` for caches.

## Look & feel (UI)
"Imperial observatory": indigo void, brass hairlines, ivory ink; chamfered (45°-cut) panels, **no rounded corners**; Marcellus SC for headings/buttons,
IBM Plex Sans Condensed for body. Tokens/classes live in `css/base.css` and `css/kit.css` (see `?screen=styleguide`). Use CSS variables
(`--brass`, `--ivory`, `--cyan`, `--ember`, `--leaf`, `--rose`, `--violet`, `--gold`, `--c-ship`…), the kit builders (`MOO.UI.h`, `UI.button`, `UI.panel`,
`UI.slider`, `UI.table`, `UI.modal`, …) and per-screen styles injected with `MOO.UI.css('<id>', cssText)`.
Colour semantics are fixed: gold = BC/money, ember = industry, leaf = food/growth, cyan = research/focus, rose = danger/war, violet = diplomacy, teal = ecology, azure = ships/defense.

## Dev server & testing
- A static server is **already running at http://localhost:8765/** (serves `E:\claude\MOO`). Do not start/stop servers.
- Make a standalone test page `tools/test-<yourmodule>.html` that loads `css/base.css`, `css/kit.css`, `js/core/ns.js` (+ whatever you need) and shows your module working
  (grids of examples, animation loops, console-error free). Check syntax with `node --check <file>`.
- Browser verification (visual work): the built-in browser tools `mcp__Claude_Browser__*` exist. **Open your own tab** (`tabs_create`, remember its `tabId`),
  pass that `tabId` on every call (other agents share the pane!), screenshot with `computer` (use `scale` 0.5–0.7 to save tokens), read console errors with
  `read_console_messages`, and **close your tab when finished**. Prefer fixing what you see over describing it.
- Final reply: **≤150 words** — files written, public API (one line each), known gaps. No code dumps.

## The music (engine and score)
- The compass: John Williams for the themes (a tune that can be sung, stated by the orchestra and answered), Howard Shore for the weight
  and the modes (the choir, the low strings, the chorale), and above all Hans Zimmer for the manner (the pulse, the swell through every
  long brass note, the horns rising above the men's choir as in Roll Tide, the slow dark bed under a choir as Mutiny opens), with Jonn
  Serrie's planetarium underneath the map (the analogue sky, the air, points of light in a long delay). The title must carry all of it from
  its first bar: it opens with the men alone over the planetarium's bed, the horn's call answers, and the crest is Zimmer's.
- `js/audio/music.js` is the engine only: notation, generators, the player, the scheduler, the director. The score lives in `js/audio/score/`
  and loads after it, in manifest order: `themes.js` (the shared themes, quoted as `'@hymn.H1'`), `cues.js` (title, battle, council, procession,
  news, endings, espionage), `map.js` (the exploration pieces, interludes, bridges), `races.js` (the race themes; hostile readings derived),
  `programme.js` (which pieces play when: programmes, moods, rotations). A piece is `Track(id, def)`; the engine's notation is documented in
  the header of music.js.
- Every map piece carries `tags` for the director (solitude, contact, tension, war, grief, grandeur, energy, dark, 0..1), an `eraWin` if it
  belongs to a phase, and quotes at least one shared theme (by reference, or `quotes: ['hymn']` for a hand-adapted reading). New pieces get a
  `trim` from `node tools/audio-report.js --tracks <id> --json r.json` + `node tools/audio-trims.js r.json --apply`.
- A section may carry its own `meter`, `bpm` and `bpmTo` (a tempo ramp across it); the engine's time map places every note, bar line and beat.
  Interludes use this to open in the outgoing piece's meter and pulse and glide to the next piece's tempo. They also keep the colour: the seam
  picks the template by palette fit to the pieces either side (`Music._colour`), and the voice one piece ends in holds under the interlude's
  opening bars while the voice the next opens with sits under its last. A new instrument preset needs a family in `FAMILY` (by its sample set);
  a new interlude template needs `tags: { dark, energy }`.
- A line (lead, lead2, bell2) may carry `shape` (0..0.8): each phrase played as a hairpin, soft at its ends, full in its middle and at
  its top, the long notes blooming — a singer's or a horn player's phrasing. The title's lines all carry it; use it on anything sung or blown
  that is heard alone.
- A line may carry `swell` (0..0.8): each note of two beats or more starts that much softer and opens to its written dynamic through the
  recorded layers (the brass rising). The sampler plays one dynamic layer at a time and hands over to the next in a quarter of a second
  where a swell crosses between them; it never blends two recordings of one note for long (they beat).
- A phrase token may carry a dynamic mark: `'H1*0.74 H2*0.84 H3*1 H4*0.88'` plays each phrase at that fraction of the line's velocity (a
  hairpin across the phrases, the answer on top). A line may carry `pan` (a soloist near the centre) and a piece may give one layer its own
  send levels with `sends: { lead: { verb, stage, dly } }` (a soloist at the front of the stage, the bed behind it). A line or a choir may
  carry `width` (0..1): the recording's side scaled against its mid in the voice, so a wide choir recording sung as one line stands at the
  centre (the title's men, 0.35; its hum 0.6) — alone, a choir line has no centre at all (correlation near zero reads as phasey). A piece
  may set `duck` (the gain its beds fall to under every lead note; 0.79, 2 dB, by default; the title 0.68) and a pad may be voiced `open`
  (roots and fifths only: deep chords below C3 in the low strings that must not smear, the thirds left to the voices above). A soloist's
  window is registers first: nothing else in the soloist's octave (the title's horn has D3-D4 to itself: the low strings below it, the
  glow, the violas and the women above A4, the hum spread to the sides), then the duck, then its own dry sends; the solo then rises without
  being louder. A derived reading of a piece (`title:reed`, the cor anglais an octave above the horn; `title:organ`) is registered hidden from the
  title's definition at the end of `cues.js`, its window moved with its soloist. A line may carry `grace` (one grace note below a long
  note) or `flutter` (the pipers' doubling: three quick notes before it). A theme is stated where it counts and varied between: the title
  states its tune twice at the start, returns it whole for the crescendo, and fills the rest with variations drawn from it by the
  classical means (sequence, a chain of thirds, the relative minor in augmentation, the answer's octave to the dominant), each over
  chords of its own. A soloist also needs
  a window in the texture: the title keeps the organ and the men below D4 and the women's hum and the analogue halo above A4 while the
  solo horn plays, and the men's answer an octave under it.
- The second leitmotif is the procession's first strain as the commonwealth's oboe states it (`@procession.A1`). It is woven in, never
  dropped in: a piece that echoes it writes one variation reading of its own tune drawn toward the climb (its head, 1 2 3 5, fits any tonic
  bar; the whole strain wants I I IV V or near it), in its own rhythm, metre and mode, over its own chords, and declares `quotes:
  ['procession']`. Check the reading with the snap tool before keeping it. A separate section for it is a cut-in; the victory's full horn
  statement is the one exception.
- Bridges are `bridge:tense` (fights), `bridge:bright` (the chamber, the victory), `bridge:dark` (Orion, the Antarans, the defeat) and
  `bridge:calm` (back onto the map from any cue, the news bed both ways); each opens on the tonic of the piece that is playing and lands on
  the cue's dominant (`interludeFor` with `from`). `setMood(..., { quiet: true })` lands a piece on its quiet half (the map back from a
  fight); a soft programme change between far-apart pieces takes the long breath like the director's seam.
- The soundstage (`A.soundstage`, `?soundstage=0` for the old staging): the pads and the chorus are sent lightly into the stage's early
  reflections (0.16 and 0.18; the lines have 0.22 to 0.26), so the whole ensemble stands in one room, and the bus's side is lifted to 1.3.
  Measured on a minute of three pieces: side/mid up 1.1 dB, stereo correlation down 0.03 to 0.10, loudness unchanged. Subtle by design;
  anything wider starts to pull the chorus out of the hall.
- Levels: map pieces sit at -17 LUFS integrated (whole-piece render), within a decibel; interludes three and a half below; bridges near -18.
  Re-measure after a change with `node tools/audio-report.js --full --tracks <ids> --no-sfx --json r.json` (interludes and bridges are hidden:
  render them with `Music.renderOffline` as `tools/qa` scripts do).
- The sampler treats every looped sustain when its file is decoded (`js/audio/sampler.js`): a loop shorter than half a second is moved onto
  the file's longest steady stretch (`?looplong=0` keeps the file's), its end is tuned to a whole number of periods (`?looptune=0`), the solo
  winds and brass have each partial's slow breath evened across the loop (`?loopeven=0`), every loop's level is evened (`?loopflat=0`) and
  its seam blended (`?loopxf=0`). `node tools/qa/loops.js` holds one note per zone of every sustain instrument through the bus and flags a
  pulse or a click (on the mono sum; the stereo image's sway is reported apart). Two recorded dynamics of one note never blend for long:
  the sampler plays one layer and hands over in a quarter of a second where a swell crosses between them.
- The sampler aligns the recorded dynamic layers of every pitched sustain when its files are decoded (`alignLayers`, `?layeralign=0` plays
  them as recorded): each layer's steady loudness (K-weighted, the median over its zones) is set against the loudest layer at four decibels
  per half of the dynamic range, so the soft layer of a section sits 4 dB under its loud one and the engine's velocity law carries the rest.
  The library had the soft strings, trumpets, trombones, low brass and cellos eighteen to twenty decibels under their loud layers: a pad at
  a soft dynamic all but vanished against the chorus, a crescendo lurched at the hand-over, and a solo written soft sat under its bed (the
  trombones' theme twenty decibels under the Frontier's). The single-layer solo winds are lifted to their family in `INST` instead (the
  alto flute 10 dB, the flute 5, the solo trumpet 6). Measure a voice alone with a one-line test track through `Music.renderOffline`
  (`only: ['lead']`); a solo should sit within about three decibels of its bed, above it where it is meant to lead.
- A line is written on its chords. The engine snaps a note a semitone from a chord tone on a strong beat (or two beats long) onto the chord,
  which patches a clash but flattens a line: when a phrase is reused over another progression, write the reading for that progression
  (the battle's crest lines, the procession's big phrase over the flat-sixth lift) or move the chord to the tune (the spy's dominant where
  the line cadences, a major seventh under the commonwealth's cadence); a dissonance meant to be heard is marked `!` (the Antarans' tritone
  leaps and half-step grinds, the Mrrshan reed's flat second, a battle line's passing ninth). `node tools/score-review.js` shows each
  piece's snap rate (under ten percent) and its low-register mud (close thirds below C3: keep the pads, the men and the stabs above the
  bass's octave; under five percent). A race's hostile reading takes the `mode` its theme's intervals survive (`WAR` in `races.js`:
  mixolydian for the Alkari, dorian for the Sakkra, the whole tone and the phrygian dominant kept) rather than the darkest one.
- Check a change with `node tools/score-lint.js` (schema, instruments, forms, phrases, themes, determinism, the programme's lists; `--strict`
  in a release pass) and `node tools/qa/music.js` (the seams in real time: directed programme, soft change, bridges, motif, snapshot / restore).

- **The orchestral system (`orch: true`).** An orchestral piece sets one switch, not a flag per problem. It gives: beds and the bass
  held through chord changes and section lines (shared notes keep sounding, moving voices enter legato at the steady part of the note);
  the choir breathing in turn; the solo generated first in each section and every bed and choir note kept out of a three-semitone window
  around it (moved an octave, or dropped); the low end mono (choir below 450 Hz, bass 250, beds 300); no synthesized voice, transition,
  doubling (`ens`), sine sub or bus chorus. Then two gates, both automatic:
  - **Intake** (`node tools/qa/library.js NAMES`): every looped zone as the sampler plays it is in tune by its whole-note median pitch
    (12 cents, 15 for an ensemble), its loop clear of the file's faded tail, its stereo agreeing in the low mids, its layers in order. The
    sampler enforces the last three at decode for every instrument (`clearTail`, `agreeStereo`, the per-note layer order in
    `alignLayers`); tuning is the build's (`measure_root`). Run it on any new instrument; run `tools/qa/loops.js` too for a solo one.
  - **Acceptance** (`node tools/qa/orchestral.js IDS`): on the piece itself, nothing synthetic, held notes held, the solo's window clear,
    the low end in phase, the choir carried (not covered) in its lowest octave. Every orchestral reading passes it before it is published.
  A new problem heard by ear becomes a check in one of these two before it is fixed, so it stays fixed.
- **Loops of note-by-note recordings** sit inside the note's steady stretch and run as long as it allows (`loop='steady'`); a note that
  swells more than `swing_max` dB inside its loop is dropped, and a file holding two takes is cut to the longer. Check a new set with
  `node tools/qa/loops.js --insts NAME` (one instrument a run: the whole library takes too long) before a piece uses it.
- **The dip under the solo** (`duck`) is one dip a phrase, not one a note; keep a piece's `duck` at 0.7 or above (3 dB) unless the solo
  truly needs more room, since the choir and the pads move with it. A sampled line's vibrato is locked to the beat (`vibRateFor`).
- **Recorded soloists (the Iowa sets, `*Solo`, `*Iowa`, `bassClar`, `bassTbn`).** One player, three dynamic layers, a note every
  whole tone, mono except the strings. Use them where a line is one voice's (a duet partner, an echo, a solo reading); the VSCO sections
  stay the beds and the tutti. They were recorded note by note, so `tools/samples/build.py` levels them per recorded note (`norm='zone'`:
  the loud layer to the target, the softer layers a fixed 8 dB per unit of layer distance under it), not per instrument; new recordings
  of that kind get the same flag. The raw takes are cut by `tools/samples/iowa.py` into
  `STAGING/<Inst>/<Inst>_<Note>_v<dyn>.wav` first. Their `smp` gains were set from the level test (each solo alone at vel 0.5, integrated
  LUFS, within 3 dB of `hornSolo`); a new preset gets measured the same way before it is used in a piece.

## Namespaces & key contracts (filled in as modules land)
`MOO.Gfx.{Icons,Space,Planets,Ships,Portraits,Fx,Scenes}` · `MOO.Audio.{init,Music,SFX}` · `MOO.UI.*` · `MOO.Data.*` · `MOO.Sim.*` · `MOO.AI.*` · `MOO.Game`
