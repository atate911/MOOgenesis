# Master of Orion — Reborn · Hand-off (read this first next session)

A browser remake of *Master of Orion* (1993): vanilla JS + Canvas2D (+ optional WebGL2) + Web Audio, no build step, no dependencies.
**Run it:** double-click `index.html` (works from `file://`), or `python -m http.server 8765` in this folder → http://localhost:8765/ (launch config `moo-static` in `.claude/launch.json`).
Dev shortcut (skips the menu, auto-plays N turns first): `index.html?dev=1&screen=galaxy&race=human&size=medium&opp=3&seed=abc&diff=average&turns=20` (`ai=1` = AI plays your empire too).
Docs: `PROGRESS.md` (plan/status/25-feature acceptance checklist) · `CONVENTIONS.md` · `DESIGN.md` (architecture, state schema, orders, interrupts) · `research/*.md` (verified rules = the spec; `*-verification.md` = errata from independent verifiers; `09-art-direction.md` = the graphics-pass plan) · `briefs/*.md` (agent briefs — ready-to-launch ones for QA, balance, GPU wiring, verification) · `tools/handoff/*.md` + `tools/ai-notes/*.md` (every builder's done / not done / next steps — read the one for the area you touch).
Commands: `node tools/check.js` (syntax of every manifest file) · `node tools/rules-test.js [area]` · `node tools/soak.js` (24-thread AI-vs-AI soak/balance; `tools/SOAK.md`) · `node tools/headless.js`.
Browser-pane tip: animations use requestAnimationFrame, so in the built-in browser pane a tab must be fronted (`tabs_select`) for anything animated (GNN, audiences, scenes, combat) to advance.

## Session 11 (October 2026) — the score grows, branch `claude/festive-wozniak-7jy03r`

**Latest (the full pass, and the title as an undercurrent).** The main theme is now a brooding undercurrent (the solo horn’s lament over the men humming low, the commonwealth’s climb as a reach upward, the hymn’s head as the second idea, a crest that stays a swell); the user did not want a sung tune or a march on the title, nor the Crimson Tide manner. A voice may carry `width` (the choir recordings are wide; a line alone needs a centre). Every piece revisited against the compass and re-ranked; `MUSIC-REVIEW.md` ("The full pass") has what changed
and the new table. Engine: the sampler aligns the recorded dynamic layers of every pitched sustain at decode time (`alignLayers` in
`js/audio/sampler.js`, K-weighted, 4 dB per half range, `?layeralign=0` to compare; `A.Samples.align` holds what it did per instrument), the
alto flute / flute / solo trumpet presets lifted, war readings keep an augmented chord where the scale allows and never put the stabs an
octave down, `WAR[race].mode` picks the hostile mode. Score: phrasing everywhere, mud and snap fixes per `CONVENTIONS.md` (the music
section, the two new bullets). Measure a solo against its bed with the scratch scripts' method (render `only: ['lead']` and the bed layers
apart, compare integrated loudness). Then:

**Next (the user's direction).** The commonwealth's tune is the game's theme, set by the title's first horn part, in the major as the
Commonwealth plays it (the minor reading and any hymn fragment on the title read as Crimson Tide); one melody at a time, the soloist forward (`title`; `title:reed`, `title:cello` and `title:organ` are the same piece with the cor anglais first, the cello first and on the pipe organ, for the player page and for later; a Williams-manner fanfare reading was dropped as not working for the piece; a pipes-and-snare reading built from the oboe and the bassoon was dropped as not sounding like pipes). The title wants bass meat: deep open chords, the double bass on a line with its sub,
the chorus and the low instruments carrying the melody, high accents (a soft trumpet) few. Later it should be
heard on other instruments for effect — a trombone, a baritone horn, a baritone saxophone, a bass clarinet, a bassoon, other unusual
colours — for a creepy organic-against-artificial feel made with real, unusual instrument sounds rather than synths. On hand: the trombone
section (`trombones`), the tuba, the bassoon, the cor anglais, the alto flute, the contrabasses. Not in the library: bagpipes (the user wants real Great Highland pipes with the
traditional flutter; the only free multisample found is FreePats’ CC0 bagpipe in G, a smaller pipe, at freepats.zenvoid.org, which this
session’s network could not reach; no free Great Highland multisample turned up on GitHub, archive.org or Pianobook), bass clarinet,
baritone saxophone, baritone horn / euphonium, contrabassoon, bass flute; they would come from a CC source through `tools/samples/build.py`
(a solo trombone would help too; `tbnSus` is the section).

**Earlier (the map's plan, steps 6 to 10, and after).** `MUSIC-REVIEW.md` has the plan, what each of its ten steps did, and the work after
it: the main theme rebuilt around the solo horn and the horn section with a wider dynamic range and phrase shaping (`shape` on a line), the
commonwealth's oboe tune as the second leitmotif (an `echo` section in nine pieces), the sampler's loop treatment (`js/audio/sampler.js`:
relocate, tune, even by band, even the level, blend the seam; `?loop...=0` flags to compare) and the music bus's band alignment
(`js/audio/audio.js`, the multiband stage). Check with `node tools/qa/music.js` (27 checks), `node tools/qa/loops.js` (every looped zone held
through the bus), `node tools/score-lint.js`, `node tools/score-review.js`. Levels: map pieces at -17 LUFS integrated, interludes at -20.5,
bridges near -18 (`CONVENTIONS.md`, the music section). The player page (the artifact) carries the live engine and the renders of the main
theme, First Light and the Commonwealth.
Twelve movements added to `js/audio/music.js` (`galaxy11`..`galaxy22`), all for the sampled orchestra and chorus. Each has a principal theme and a
foundation of its own (a planetarium drift and a sequence in Jonn Serrie's manner — `analog`/`air`/`subSwell`/`glass`/`crystal`, `fx.dly` 2.2-2.8, chords
every four bars; the user disliked the 5/4 clockwork and the 7/4 dance that stood here first — a passacaglia's variations, a nocturne's walking bass,
one long sunrise, a chorale prelude, a minimalist pulse, a canon, a brass choir, a slow march, a sarabande, a sung chorale) and quotes one of the score's themes once (H1 the leitmotif,
CM the men's phrase, the procession's A1/CD, the chorale HY1-4) — the first draft poured all twelve into one mould (strings pad + air + harp + celeste
+ soft choir, the same nine sections at 50-66 bpm) and sounded like one piece; the user asked for movements. Tempi now 48-76, meters 3 4 6 (no odd meters: the user hears them as wrong).
Three for variety (orrery 5/4 Bb, passacaglia B minor with the ground written into the bass pattern — `['1--b', '1--7', '1--2', '1---']` over
`i bVIM7 bIII V` — the watch Ab with `tptSolo`) and nine for the phases, each with an era window `eraWin: [lo, hi]` (early [0, .55], middle [.15, .9],
late [.4, 1]). Textural devices worth reusing: `pad: { p: 'pulse' | 'stab', pat }` for rhythmic string beds (the survey's eighths, the sarabande's
second beat, the nocturne's off-beat harp chords), `arp` with a wind instrument for a running figuration (the lantern's clarinet), `arp` on `strOst`
for a spiccato dance ostinato, `bass: { p: 'walk', inst: 'bassoon' }`, `art: 0.5` for staccato lines, `lead`/`lead2`/`bell2` with offsets (`r2`, `r4`)
for a canon, a line in `choirWomen` / `choirMen` for sung melody, `cres: [hi, lo]` for a diminuendo, pattern arrays that thin out for a run-down.
Engine: `fitsEra` / `eraList` filter a programme's regular pieces by `S.era` when a cycle is composed (`composeOrder`) and when `setMood` picks a
start (never below three pieces); `makePlaylist()` builds a playlist apart from starting it; `Music.setMood(mood, { soft: true })` →
`softSwitch()` arms the new programme at `Player.nextSectionBoundary(minAhead, maxAhead)` (a breath — lv ≤ .35 — within reach is preferred,
else the next section line, else a bar line before `maxAhead`), through an interlude in the new key, old piece decaying under it (`oldFade`
= fade + 4); `soundscape.js` uses it at turn end. New `INST` presets `violas` (vlaSus), `trombones` (tbnSus), `tuba` (tubaSus), `tpts` (tptSus),
`tremLo` (vcTrem); interludes `drift6` (the choir) and `drift7` (violas, trumpet far off); arps and bass get ±6 % / ±4 % seeded level variation.
Pitfall met and fixed: roman numerals are major-scale degrees, so minor-key chords are `bVI`/`bIII`/`bVII` (a plain `VI` in C# minor is Bb major).
Loop seams (the user heard clicks / a looping flutter on held notes): `sampler.js` `smoothLoop(buf, ls, le)` crossfades each loop at decode time
(tail of the loop into the lead-in before loopStart, n = min(loop/4, 300 ms, loopStart - 20 ms), linear, once per buffer+loop, `S.loopXf`,
`?loopxf=0` to hear the old loops). Audit scripts lived in the scratchpad: decode each zone with ffmpeg, measure |x[ls]-x[le-1]|/RMS and the
correlation of the 30 ms before loopEnd with the 30 ms before loopStart; before: 67/218 poor seams, oboe/clarinet corr 0.5-0.8 with loops as
short as 0.13 s; after: corr 1.00 everywhere. Layout since this session: `js/audio/music.js` = engine; `js/audio/score/{themes,cues,map,races,programme}.js` = the score (manifest order; the
test page tools/test-audio.html lists them too). Themes: `Music.defineThemes({group: {NAME: phrase}})`, quoted as `'@group.NAME'` (` x2` / ` /2` scale
the values) and resolved in `prepare()`, which records `P.themes`; `quotes: [...]` declares a hand-adapted quotation; `Music.themeIndex()`. Motifs:
`Music.setMotif(id | {ph, inst})` (races carry `motif` / `motifInst`, the procession `motif: '@hymn.K'`), spent by the next `interludeFor(..., {motif})`
(the interlude's A section plays it once); soundscape.js sets it on a newly met race and when `readState().council >= 0.5` (Council.colonised >=
threshold, next sitting within 6 years; `q.council` also lifts pieces tagged `ceremony`). Checks: `node tools/score-lint.js [--strict]`, `node
tools/qa/music.js`. The compile hash of all 69 tracks was identical before and after the split and the theme conversion.
Tempo map and meter per section: a section may set `meter`, `strong`, `bpm`, `bpmTo` (prepare → R.meter/R.strong/R.bpm/R.bpmTo); compilePass builds
`C.tAt(beat)` (closed-form integral of a linear tempo ramp per section) and the pass carries `bars` / `beatsT` (line times) and `w.t0`; every emit,
the player's `nextBoundary` / `boundaryAfter` / `nextSectionBoundary`, `Music.list()` and `analyze` read them (generators keep `C.meter` /
`C.strong` / `C.spb` per section; genLine parses phrases in the section's meter). Modulation (music.js 'modulation'): `pivotPath(from, to)` → the
opening chords of an interlude as numerals of the new key (old tonic, a shared pre-dominant pivot | circle-of-fifths walk | Neapolitan, V7);
`pulseK(from, targetBpm)` ∈ {1,2,3}; `interludeFor(tpl, next, { from })` sets the 'in' section's meter = from.meter / k, bpm = from.bpm / k,
bpmTo = next.bpm, prog = the path with a dwell per chord in outgoing bars (the old tonic ≥ 7 s — it spans the old piece's 10 s fade — every other chord ≥ 5 s;
middle chords shortened first when the opening would pass 26 s), and the body's bpm / meter to the next piece's (lines silenced when the body is not in four); the seams pass
`from: outgoing(p)` (the piece actually ending — a war variant keeps its base's key — else the director's last piece; an interlude or bridge is never a `from`).
War / hits variants carry `variantOf`, and the director's history counts them as their piece.
The demo page (artifact UyNUm64ht9AvpKaRhaLwdM; source in the session scratchpad, player/score-player.html) runs the engine live in its second and third tabs: the engine
files under engine/js, instruments.json under engine/assets/audio, and the 841 sample MP3s concatenated into engine/samples/pack0-3.mp3 with an index.json of byte
offsets; the page wraps window.fetch so the sampler's requests for engine/assets/audio/<file> are answered from the packs (the host serves only media types and at most
511 files). `Music.play` / `Music.playlist` take `opts.from` (seconds into the first pass) for the 'let the piece reach its close' demo. MUSIC-REVIEW.md holds the
review and the ranking; tools/score-review.js the measurements behind it.
Colour (music.js 'colour'): `FAMILY` maps each sample set to a family (`familyOf(name)`, synth voices by `v`); `palette(def, 'head'|'tail'|undefined)` weighs the
families across sections (bars × level × vel, edge sections ×3; bass and drums left out; alternations a share each; memoised in a WeakMap); `colourFit(tpl, from, next)`
= 0.7 × cosine(template palette, blend of from's tail and next's head) + 0.3 × closeness of the template's `tags` {dark, energy} (map.js gives each drift template
its two) to the pair's mean; `chooseTemplate(pool, from, next)` picks by exp(6 × fit); interludeFor pins the best alternation into `d.inst`, carries `colourOf(from, 'tail')`
into a free sustain slot of 'in' (pad2 / choir2 / choir; choir colours into a choir slot with `soft`) at vel 0.5 and `colourOf(next, 'head')` into the last section at 0.45,
skipping a family the section already has (and only a family in `SUSTAINS`: strings, synth, choir, brass, winds), and opens 'in' at 0.8 × the piece's closing level
(bounded by the template's own and 0.55). qa/music.js checks the carried voices. `tools/audio-seams.js` captures four real seams (soft change through
`R.softSwitch`) as MP3s with a log of each seam's choices; the demo page carries them. Checked: the compile hash of all 69 pieces unchanged by the compiler change; 840 pairings compile (score-lint);
qa/music.js checks a quick-six → B-minor seam (opens on F in meter 2 at the lullaby's bar length, arrives on F#7, bars lengthen into 50).
The director (music.js, 'the director'): map pieces carry `tags: { solitude, contact, tension, war, grief, grandeur, energy, dark }` (0..1); `Music.setSituation(q)`
takes the game's reading on the same axes (soundscape.js `situation()`, from `readState()` — the era's components plus own colonies, fleet peaks and
a remembered war / loss: `warMem` decays 0.88 a turn, `griefMem` 0.9), `pickNext(pl, last)` weights candidates by `exp(4 * affinity)` × recency
(0.08 inside 25 min, 1 after 70) × circle-of-fifths distance from the last piece (relative major/minor 1.25, a fifth 1.15 … four steps 0.7; the same
root 0.35) × rarity, and draws one; `director: true` on a rotation turns it on (all three map rotations). `farApart(a, b)` (energy ≥ .45 apart, dark ≥ .5,
or ≥ 4 fifths) → a QUIET interlude (`drift`, `drift3`, `drift6`) in its `:long` reading (A × 1.5, lv × .85, out 3 bars) and a wider seam fade. Bridges:
`startTrack(id, { bridge: 'tense' | 'calm' })` arms `bridge:<kind>:<id>` (interludeFor of a hidden 2-bar template) on the next beat with `switchAt.then`
= the cue at the bridge's crest; `tickAll` re-arms `then` after a switch; `Music.play` returns true for a cue already behind a bridge; soundscape
uses tense bridges into combat / ground and calm ones into the council and back onto the map after a fight. `Music.setSituation` also tilts the
level (`DIR.gainDb`, ±1.2 dB; `Player.trimBase` × `dirMul()`, running players ramp over 3 s once faded in). Tag table and a picker test: the
session's scratch `director` test (alone → planetarium pieces, war → frontier / vigil / long night, grief → embers; recency 0.6 % at 10 min).
`node tools/audio-hour.js [outDir]` captures a scripted hour of the map from the real-time engine (alone / first contact at 13 min / war at 34 / peace
at 46, era 0.02 -> 0.92) as raw PCM plus a log of every piece change; the demo page's hour was made from it. The remaining realism limits are in the assets (short oboe/clarinet loops; dynamic-layer
crossfades beat slightly on swells) and need the source libraries and `build.py`.
Checked: Node-only lint (every form × alt × take × era compiles, deterministic, zero snaps on all twelve), `tools/audio-report.js` trims (-16.5 LUFS),
a Playwright seam test (`softSwitch` lands on the running piece's breath, interlude then the queued piece, no silence, era lists correct). Still not
heard through speakers; the MP3 sample set is LAME VBR q0 (the top MP3 setting) — a lossless or higher-rate rebuild needs the source libraries and
`tools/samples/build.py`.

## Session 10 (October 2026) — release 1.3.0, branch `claude/release-1-3-0`
Release pass over `main` with everything merged (phone fit, Tech Lab, visual system, polish): `node tools/check.js` (120 files),
`node tools/rules-test.js` (860), `tools/soak.js` 24 games classic + 24 expanded `--strict` (one WARN: seed 20 darlok/average, the
Meklar AI runs zero research until turn 26 while it builds factories — its policy, not a fault) + 8 determinism replays (identical),
`tools/qa/`: smoke, turns (80 on Hard; 80 with `pool=expanded`), saves (server flow), combat, endings, council, spy, help, misc, scenes,
modes, fuzz, phone (263 checks), a screenshot walkthrough of 40 views at 1920×1080 and 1366×768 (script in the session scratchpad; the
only oddity seen was the research-choice caption mid-typewriter), and saves made by the v1.1.1 and v1.2.0 trees loaded into this build
and played on (menu Continue line, save list, re-save). Fixes: title "1 colonies"; from the user's iPhone: the full colony sheet under the
Dynamic Island (`--ph-full` minus the top inset; Back collapses the sheet, `UI.Phone.backWanted` shows the control at full), the map's ⚠
explained (colony panel `raidNote` in side-colony.js, key rows in galaxymap.js `glyphRows`, the phone key scrolls), the landscape column
clear of the notch, the phone star system (css places `.sv-fleets`; system.js `placeCaption` returns early on phones), the tech choice
taking a single tap as the answer (tech.js `buildChoose`: touch taps only preview, `R.pt` from the list's pointerdown). Screen use on tall
phones, measured with a scratch script (empty bands per view at the tallest iPhone): HUD values on one row (phone-skin.css `.gx-hud` padding;
`.ph-ctl-tight` wraps them when the control column climbs), `fitHalf` measures the children's union and no longer counts the overlapping grip,
`.op-frame`/`.sl-frame` phone padding, the project's blueprint on the Project tab (`st.ppic` in tech.js, phones only), landscape Save tools
beside the switch. Safe areas, generically: `html[data-phone][data-ph-bar] #screens` is inset by the side and bottom insets (phone.css; the
per-screen env() paddings of `.tch`, `.ttp`, `.tsc`, `.sv-*`, `.op/.sl-frame` were dropped), `.modal.gm-sheet` pads in phone-skin.css (its
`.modal` rule had been overriding phone.css), the title's `.menu-col` / `.menu-foot` inset, council tags clamped (`council.js` tag layout). The
full `phone-fit.js` survey (34 views × 7 sizes) is clean except, on a phone held sideways, the design editor's body, the audience menu
and the New game stage (`hidden-in-small-scroll`: 44px touch rows on a 342–393px-tall screen; the landscape layouts of phone follow-up 2
are the real fix). `.dz.ph-dz` pads the side insets; `.au-text` has no minimum height in landscape. More map during picks: `.gx.ph-pick`
(phone-galaxy.js `markPick`) hides `.gx-top` and `.gx-bar` and pads the home inset on `.gx`; a float card hides the strip sheet and is capped at
50 %; `fitHalf` caps a pick at 42 % of the (now taller) wrap; the sheet's Escape handler skips picks (their own Escape cancels). Measured with
`map-share.js` in the session scratchpad (map pixels per state). `tools/qa/phone.js` deploy step: with that much map no reachable star starts under
the sheet, so the step first pans one under it (and passes with a note when the clamped pan cannot). `VERSION` 1.3.0;
CHANGELOG's Unreleased became 1.3.0. Known: `tools/qa/playshots.js` stalls on a "Bombard?" card (the bot presses Enter; the card wants
B or Esc by design) — a bot limit, verified by loading the dumped state and pressing B. Note for the next release: the GitHub tags so far are `v0.2.0`, `v1.1.0` (same commit) and `v.1.1.1` (typo); this one is `v1.3.0`.
Still open, unchanged: real-hardware GPU / audio passes, the optional art in `ART-NEEDED.md`, the phone follow-ups list.

## Session 9 (October 2026) — Tech Lab, branch `claude/tech-lab`
`tools/handoff/techlab-2026-10.md`: an Expanded technology option (New game › Remake options, off by default) that adds 45 new techs to the pool
research trees are dealt from, without changing tree sizes (`js/data/techs-x.js`, effects in `js/sim/xtech.js` + guarded hooks; classic games
byte-identical). Sixty candidates went through a measurement lab (`tools/techlab/`: combat calibration, twin trials against every classic tech,
whole-game leagues and ablations; results in `tools/techlab/REPORT.md`, design in `briefs/tech-lab.md`); 15 cut, 4 moved, Slipstream Drives
retuned. Pace and economy hold within about 2 %; AI empires fight about 22 % more battles. Open: a human playtest of an expanded game.

## Session 8 (October 2026) — polish pass, branch `claude/polish-pass`
`tools/handoff/polish-2026-10.md`: fifteen fixes from a screen-by-screen review on desktop (1080p) and phones (portrait, landscape,
small). Desktop: hand cursor (`--hand` in base.css, every `cursor:pointer` reads it), colony postcard + ships in orbit (side-colony.js),
turn sound + HUD year odometer (galaxy.js), save-slot galaxy thumbnails (`meta.map` in save.js, drawn in saveload.js), boot splash art +
tip (loader.js, `MOO_BOOT_TIP`, first-turn tip on Simple/Easy in help.js), research picture fit (tech.js grid row), empty Report dossier
(races.js), Options › Empire marks (galaxymap.js `RING_DASH`, `raceCode`). Phones: audience crop (scenes.js `audGeo` portrait branch),
HUD turn-log chip + log dialog (turnlog.js `counts` / `openSheet`), map controls folded behind More, landscape title in two columns
(menu.js), system view labels, grid off by default, second-visit install card (phone-galaxy.js).

## Session 7 (October 2026) — phone mode, branch `claude/phone-mode`
`tools/handoff/phone-2026-10.md`: a phone layout layer gated on `<html data-phone>` (desktop layouts proven identical to `main`):
galaxy bottom sheet, one Back control + the phone's back gesture (both dispatch Escape), auto-only battles, a one-column ship design
editor with a card picker, stacked tool screens, landscape support, installable web app. Round 2 (after an interface review): 44px
targets / 12px text, fixed tab bar + More, a collapsed sheet with a summary line and a half height that holds all five sliders,
app-bar titles in place of in-screen titles and OK buttons, research segments, tap-to-read and map long-press tooltips, touch
wording (`UI.Phone.say / key`). `node tools/qa/phone.js [landscape|small]` (fails on small targets / text and keyboard wording).
Round 3: a native-app look with the game's skin (`css/phone-skin.css`, family tokens `--pk-*`), haptics (`UI.Phone.haptic`), and
installed-app polish (theme-color per screen, iOS launch images). Its **Follow-ups** list ranks what is left; first is the real-device
pass (deploy the branch over HTTPS).

## Session 6b (October 2026) — GNN, photos, stargates, rally points, same branch
`tools/handoff/gnn-logistics-2026-10.md`: the GNN closing before it could be read (timeline measured, last story now waits), the
photo portraits that bobbed and pulsed, the race-photo audit (all 71 art files show the right race; code paths checked), stargate and
rally-point display and the original's Alt+R. Open: the human council plate has a non-MOO purple alien among the delegates (art).

## Session 6 (October 2026) — frame pacing, branch `claude/zealous-bohr-fxv562`
`tools/handoff/frame-pacing-2026-10.md`: what was measured (headless rAF pacing, per-frame canvas pass counts, CPU profile), what
changed (`UI.pace()` + `UI.displayHz()` in kit.js replace every per-screen frame gate; cached galaxy backdrop; combat backdrop at
24 Hz; governor hysteresis) and what still needs a real GPU (frame rates per tier, the F3 overlay now shows the display Hz and cap).

## Session 6 (October 2026) — graphics audit + pass 3, branch `claude/admiring-tesla-v9gcy3`
Pass 3 (`briefs/graphics-pass-3.md`) is implemented on the code side: Phase 0 (map glyphs, wordmark, exile, troop
silhouettes, bombard overlay, combat cheap wins, system plates and sun, unused plates consumed), Phase 1 (the 3/4 ship
view through `tools/build-ship-art.py` and `Gfx.Ships` `view:'3q'`, rock / debris / base cutout loaders) and Phase 2
(combat FX pass, map ambience). **Waiting on art** (checklist with drop-in steps: `ART-NEEDED.md`): generate `docs/IMAGE-GEN-SPRITES.md` (27 cutouts and skies) and
items 26-30, 41, 48, 52 of `docs/IMAGE-GEN-OTHER.md`; drop ship cutouts into `MOOg images/ship-variants/` and run
`python3 -I tools/build-ship-art.py`; convert the rest to webp under `assets/art/{fx,system-sky,battle,still}/`
(paths in `js/gfx/worldart.js`). Until then each consumer logs one 404 per missing file and keeps its fallback.
Still owed: the real-hardware GPU check (`tools/test-hw.html?auto=1`) and Phase 3 (move the PNG masters out of git).
Verify with `node tools/qa/art-shots.js` (both tiers).

`tools/handoff/graphics-inventory-2026-10.md`: every screen captured through the real UI (`node tools/qa/art-shots.js`,
`TIER=medium` for the GL look) and each element traced to its renderer. The illustrated layer (portraits, halls, labs, GNN,
surfaces, orbit plates, three endings) is done; still flat or procedural: ships (top-down only, no 3/4 view, no race
silhouettes), the tactical battlefield (blob asteroids, bare grid, flat star), the system view (procedural sun and nebula,
`system-*` plates unused), unexplored-star discs on the map, the exile ending, the invasion troop markers, the title wordmark.

## Session 5 (October 2026) — fun audit, branch `claude/optimistic-franklin-bvqmi3`
`tools/handoff/fun-audit-2026-10.md`: what the original's fun is, how the remake was measured (player's-eye headless transcript +
Playwright click-through), what changed (GNN news policy, end-of-turn planet reports, discovery cards, combat card layout, map camera)
and what is still open (ship art, one-press GNN, tutor pop-ups, report sounds, tech adjust dialogs).

## Session 4 (October 2026) — branch `fix/turn-flow-robustness`
Full review in `tools/handoff/review-2026-10.md` (50 items, priorities, what is fixed) and the UI/immersion review in
`tools/handoff/ui-immersion-review-2026-10.md`. Fixed on the branch: the stuck-turn class (held side-panel prompts,
abortable turns, safe skip answers, highlighted "answer" controls), the P1 sim bugs (unanswered audience ≠ accept,
bombard needs an explicit yes, locked-Tech eco floor, dead empires' fleets, bombs vs empty planets, order validation,
tech-choice fallback, save-failure toast), the AI defend ping-pong and scrap policy, the graphics hitches, the
deployment scripts, and the first smoothness round (one-click fleet send, auto-battle option, brief news, etc.).
Immersion round: photo art everywhere a figure is shown (envoy, endings, GNN anchor masks), wide planet card, calmer
map. Still open: ship illustrations (Phase B), the star sprite, the galaxy map's first frame, repo size (PNG masters).
Verification used: `node tools/check.js`, `node tools/rules-test.js` (806), `node tools/soak.js … --strict`,
`tools/qa/turns.js`, `tools/qa/combat.js`, `tools/qa/fuzz.js`, plus the Playwright reproductions in the session notes.

## Where we are (end of session 3)
Session 3 worked through the session-2 list, mostly unattended. **781 rules tests green (21 areas), `check.js` clean (99 files).** Read these notes for detail: `tools/handoff/verification-fixes.md` (quirk flags + combat errata), `tools/balance/REPORT.md` + `tools/handoff/balance.md` (soak numbers, A/B of every AI quirk), `tools/qa/REPORT.md` (headless-Chromium UI QA: no console errors in combat/diplomacy/council/spy/bombard/events/endings/layouts/fuzz), `tools/handoff/graphics-v2.md`, `tools/handoff/followups.md`.

Done this session
- Verification: `Data.Config.QUIRKS.{wasteSub1,shipBonusBC,soilRounding}`; combat errata 6-7; ground `inbound` + ceasefire; callToArms; Econ.refresh research total; breakthrough scene before techChoice; base/transport HP + ground gear use the last acquired tech; dead empires' transports no longer land (DEAD_OWNER).
- Balance: 1000-game robustness run clean; `QUIRKS.aiFirstTechCost` fixed by default (`options.aiClassic` restores); Easy<Simple and Klackon (~47 %) kept as original; war stalemates and passive-human elimination on Hard match the original (no change). `options.aiProdGuide` exists but is not exposed in the UI.
- UI QA fixes: Spies Caught + GNN archive access, data-help hooks, narrow design layout, audience overlap, GNN categories, many small bugs.
- GPU: `Gfx.pick()` routes scenes/GNN/landing/endings/tech/side panels/map/setup/menu through GL renderers with Canvas2D fallback; `?tier=` forces a perf tier (software GL counts as 'low': use `TIER=medium` for QA); `tools/test-hw.html`; `Game.planAI` picks pool vs inline by measured speed. **Only SwiftShader numbers exist: run `tools/test-hw.html?auto=1` on a real GPU.**
- Graphics v2: theme v2 is now the default (`?theme=v1` = old look), per-screen retint, colour-grade pass. Portrait faces and the bright audience halls are still cartoonish; ships/portraits "rebuilt as lit 3-D" was NOT done.
- Turn-freeze report (user saw the "Year …" spinner and could not continue after moving ships on turn 1): NOT reproduced in ~15 UI configs. Added worker job timeout (30 s, re-runs inline) and a stalled-interrupt hint in the spinner after 10 s (`turn:waiting`). If it recurs, get the console log + which interrupt it names.

Still open
1. Real-hardware checks: GPU timings, audio, touch, other browsers, frame rates.
2. Graphics: portraits/ships/audience halls (see graphics-v2.md). Music/SFX: measured headlessly (session 4, below) but still never heard through real speakers — one listening pass on a real machine is due.
3. UI exposure: `Sim.Q.hints` no-research tip, `options.aiProdGuide`, a spy-panel tutor line ("set the network to Espionage" — human spy choices only fire in modes 1/2).
4. Verification: combat.js still only partly audited (AI tactical turn, Crystal/Amoeba/Guardian logic, beam/special/gauntlet paths); spy mission internals, event table/monster stats, most of the difficulty table; ground tie rule product decision.
5. Smaller: Guide-only event rules skipped; `js/ai/diplomacy.js` is an intentionally empty stub; autosave/Continue and Almanac lightly exercised; huge-map turn time grew 285→756 ms by T60 under CPU contention (not investigated on a quiet box).

## Session 4 — audio pass (measured, not yet heard)
`node tools/audio-report.js` renders every track (lint + 30 s loop window + first 20 s) and every effect in headless Chromium and prints LUFS (BS.1770), limiter engagement, spectral tilt, stereo correlation and voice-pool stats (`--full`, `--wav DIR --mp3`, `--tracks`, `--sfx`, `--intensity`, `--json`); `tools/test-audio.html` shows the same numbers in a browser (shared `tools/lib/audio-metrics.js`).
Findings fixed from the first run: combat1 hit the 32-voice cap and *refused* notes (cap now 64; crossfades of two dense tracks peak at ~45); the event stingers (research / colony / treaty / war …) sat 8–10 LU above the music and leaned on the soft clipper (re-trimmed to ≈ -14 LUFS momentary, the UI sounds stay ≈ -30, frequent weapons ≈ -22; stingers and big combat sounds now also duck the music 2–5 dB); the battle screen drove `Music.setIntensity` up to 1.0 and nothing reset it, so the tension overlays (timpani, brass stabs, 16th arps) followed the player onto the galaxy map — intensity now resets when the mood group leaves combat and when the battle stops, and the combat tracks themselves build up with it (`gate: {drums:.2, lead:.4, bell:.55}`, -24 → -17 LUFS as ships die).
Added: the galaxy mood rotates galaxy1-3 as a shuffled playlist with a 5 s breath between pieces (`Music.snapshot()/restore()` hand it back after GNN, lab and spy scenes); ten hostile race themes `race:<id>:war` derived from the calm ones (darker mode, lower key, faster, brass + martial drums; `audience.js` already picked them up); a `spy` track for the espionage panels; fades that cannot throw mid-crossfade (WebKit); a 2.5 s lookahead + visibilitychange re-tick so throttled background tabs do not stutter.
Session 4b — the sampled orchestra (tier 2): `assets/audio/` holds 40 instruments as MP3 multisamples built by `tools/samples/build.py` from the CC0 VSCO 2 Community Edition (strings, brass, flute, harp, organ, orchestral percussion) plus a choir, analogue pads and a sub synthesized offline by `tools/samples/synth.py`. `js/audio/sampler.js` loads them after the first click (never from `file://`), measures the browser's MP3 decoder delay with `calib.mp3`, and plays them through the engine with velocity layers, round robins, baked loops, per-voice ensemble detune and a bus chorus (pad + choir layers). Every `INST` preset in `music.js` is now a sampled preset with the old synth voice as `fb`/`fbo` fallback (levels matched by measurement, `tools/audio-report.js` shows both: `--no-samples` renders the fallback score). New pieces for the palette: `title` (horn/men's-choir hymn → tutti), `galaxy4` (deep-field ambience), `combat3` (spiccato ostinato, low-brass stabs, gated by battle intensity); `pad2`/`choir2` section slots, `hit: 'tam'` (gong), sampled fills `snS`/`rollS`/`bigS`, kits `marchS`/`warS`.
Session 4g — the exploration programme (variation and stitching): every galaxy piece carries `forms` (section orderings, one per performance), melodies written in several readings (`lead: { ph: ['W1 W2', 'W1 W3'] }`, one chosen per performance; `ph: '@'` on a line follows the other line's choice), parts that sit out some performances (`skip: p` on any layer), phrases the player leaves out (`rest: p` on a line), breaths of varying length (`barsVar: [lo, hi]` on a section) and a tempo rubato (`def.rubato`, ±3 %); `compilePass(def, pass, form0, alt0, take)` seeds the variation RNG from pass and take, so `Music.analyze` stays deterministic while performances differ (`Music._compile(id, pass, form0, alt0, take)` for tests). Four new pieces (`galaxy5` waltz in 3/4, `galaxy6` phrygian abyss, `galaxy7` lullaby in 6/8, `galaxy8` beacon), two rare ones in the Crimson Tide manner (`galaxy9` the tide: `subSwell` preset on the sampled sub; `galaxy10` the chorale: men's choir lead) with `hitsVariant()` war readings (`DRUMS.mutiny`: `boom`/`boomHi` (V.boom), `kickSyn`, `snareSyn`, anvil), and five hidden interlude templates (`drift`..`drift5`) which `interludeFor(template, nextId)` re-roots to the next piece's key and mode (`DRIFT_PROG` per mode, cached as `<template>:<id>`). Seams: `playlistCheck` arms `S.switchAt` at `Player.boundaryAfter(endAt - fade)` (clamped to `endAt`) with `inFade` (equal-power, ≤ fade) for the newcomer and `oldFade = remaining + 6 s` for the piece ending, so its cadence is heard and the hall carries it under the next piece (`startTrack` opts `inFade` / `oldFade`). `Music.playlist` takes `gap` (0 on the map: crossfades only), `between` (template list, never the same twice running), `betweenP`, `gapIn`, `rare: { ids, p }` (`composeOrder()` slips rare pieces into a cycle, never adjacent); `shuffled(ids, last)` avoids repeats and same-root neighbours; `MOOD_ROTATE` uses them for the map moods. Verified headlessly: every form × alt × take of every track compiles, the rotation driven through 20 seams with no silence (`snapshot` during an interlude points at the real next piece; restore mid-rare-piece comes back to it), loudness report + `audio-trims` for the new pieces, interlude trims set to ≈ -19 LUFS from full renders. Phase-aware map: `soundscape.js` `earlyYears()` (no `relations[x].met/contact` with any living empire and `S.turn < 70`) picks `galaxyEarly` (`GALAXY_EARLY`, `EARLY_ROT` with the pad/harp/horizon/pulse interludes), `atWar()` picks `galaxyWar`, else `galaxy`; both re-evaluated at turn end. `procession` (the march: F major 84 bpm, solo horn, `DRUMS.field` cadence, `sends: { drums: {...} }` for bone-dry drums, sections A1 A2 B T D R E) is a rare map piece and a regular war piece; on the map it carries `tone.hi -2.5`, `fx.verb 1.2` and an 8-bar approach; `council2` is derived from it at registration (bars halved, forms opening on B, 78 bpm, tam + timpani roll + brass fanfare intro, organ pads with `width 1.3`, brass-section `pad2` bed in B/R, `cr: true` cymbals, brighter tone) and alternates with `council` (`MOODS.council` array); `rare.p` may be a per-id map (the procession at 0.25). Impulse measurement of the strips: drums add no latency (17.3 ms through the master like a bare signal), horn/bass strips +6 ms (bus compression); a "late snare" is a writing problem, not an engine one. `renderOffline(..., { loop: false })` for renders that should end. Era: `soundscape.js` `eraTarget()` = 0.2·metK + 0.28·crowd + 0.2·arms + 0.12·cold share + 0.4·min(1, wars/2), where metK = (met − 1)/(n − 1) (the first contact is wonder), crowd = half the share of the player's colonies with a foreign colony within 16 % of the galaxy diagonal plus half the pressing foreign colonies per own colony, arms = 0.6·their/(their + mine + 20) + 0.4·min(1, their/(60 n)) over hull-weighted fleets of met empires (no turn term; probes: alone 0, first contact 0.05, three met one bordering 0.32, crowded + fleets 0.67, one war 0.9, two wars 1) → `eraStep()` smoothing (0.04 up / 0.025 down per turn, seeded from the state on new/loaded game) → `Music.setEra(x)`; `compilePass(..., era)` applies it to `def.gentle` pieces only (`eraSens !== false`): `tenseChord()` colours `TENSE_P(era) = (era − 0.25)·0.65` of the chords (add9/m7 → M7/m9 from 0.5 → 7→9 from 0.65, IV→iv from 0.7, I→IM7 from 0.85; the last chord of a section never; no suspensions — they froze like a synth pad), pads `n + 1` above 0.55 and pan × `widthK = 1 − 0.3·era`, `eraAlts` stand-ins (recorded cellos, the men, the cello line; never the filtered `dark` pad or tremolo as a bed — they read as digital) with probability (era − 0.4)·1.5, Player hall sends × (1 − 0.08·era) and delay sends × (1 − 0.55·era), stretch × (1 + 0.045·era), rare `pOf × (0.4 + 1.2·era)`; `genEerie(C, s, erng)` above 0.65 on the `fx` layer: per bar a chance of (0.12 + 0.3·k) with k = (era − 0.65)/0.35 — a `tremHi` (vln1Trem) note a semitone off a chord tone in 79–91 swelling over 2–4 bars (62 %), a low `cymSwell` ending on a bar line (28 %), a `whisper` (10 %); never the last bar of a section. `Music._compile(id, pass, form0, alt0, take, era)` and `renderOffline(..., { era })` for measurement; `tools`-less check scripts lived in the session scratchpad (compile at 0 / .5 / 1: chords changed 0–36 %, width 0.29 → 0.16, no errors, deterministic). Still nobody has listened through speakers.
Session 4c — sound effects: `sfx.js` recipes rotate takes (`S.pick(n)`, never the same take twice in a row) with small random pitch / level / timing; `S.smp(name, …)` adds a sampled layer that stays silent until the instruments are loaded (or falls back to a synth voice with `fb`); one voice per beam family (`combat-fx.js` picks laser / gatling / mass / beam_heavy / beam_phasor / beam_plasma / beam_disruptor / deathray from the weapon id); new cues `discover` (explore card), `contact` (first contact), `gnn_ident` (broadcast title). Measured hierarchy: UI ≈ -30 LUFS-M, frequent weapons ≈ -22, stingers ≈ -13 (`node tools/audio-report.js --no-music`).
Session 4f — the production mix (the engine is now mixed like a session, not summed): `eng.makeStrip(kind)` in `audio.js` is a channel strip per music layer (`STRIPS`: high-pass per register — bass 28, lead 80, pad 120 at 24 dB/oct, choir 140 at 24 dB/oct, arp 140, bell 300 — low-mid cuts at 240-420 Hz, presence on lead 2.8k and pad 3.2k, bus compression on bass and lead, parallel compression on drums, a short cross-fed `spread` delay on pad/choir/bell/arp/lead for width without moving the seat); each `Player` layer runs `inG -> strip -> bus / sends` so the hall is fed clean. `Player.duckBeds()` dips pad/choir 2 dB under every lead note (`fire()`), the producer's fader move. The sampler takes `hp` (per-voice high-pass) and `sub` (sine an octave below, only when that octave is >= 32 Hz, scaled to sample level); presets set them (`deep`/`sub`, chorus hp 150 / cut 9000, celeste hp 300, flute 200, harp 70, air pad 300). 2-bus: low shelf +0.5 @ 60, mud -1.5 @ 250, presence +1 @ 3.2k, air +1.5 @ 10k, true mid/side width (`w` 1.15; side high-passed at 120 Hz and +1.5 dB @ 6k, mid untouched), glue 1.6:1 @ -24 with no makeup, then a peak limiter (6:1 @ -6, 3 ms). `MIX_TRIM` (0.62, music.js) is the master fader, set from the headless report: underscore -16..-18 LUFS, tutti -14..-15, crest 13-16 dB, L/R correlation 0.3-0.45, side/mid about -3 dB in the mids and -5 dB below 150 Hz. Re-measure with `node tools/audio-report.js --tracks title,galaxy4,combat3,council --no-sfx --secs 90 --intensity 0.8` after any change to the strips. Second pass: the sampler voice takes `eq` ([[Hz, dB, Q|'hs'|'ls'], ...]) and every `INST` preset carries its channel EQ (chorus: -2 @ 600-900 formant, +4 shelf @ 5k; horns +3 @ 4k; strings/pads/bells +2 @ 6-8k; bass +1.5 low shelf @ 80, -2 @ 600; cymbals hp 180). Two reverb planes: `eng.stageIn` (IR_STAGE, 0.55 s bright early reflections) for drums/lead/arp/bell via `LAYERS.*.stage`, the hall for pads/choir; `applyIntensity` dries the hall by a third at full battle intensity. 2-bus adds a tanh saturation stage (drive 1.6) before the limiter. Exploration pieces carry `fx: { dly: 1.5-2.2 }` (dotted-eighth delay, feedback 0.42) and galaxy2 an organSoft swell: the Division Bell space. `MIX_TRIM` 0.8. Third pass (the supervisor's list): every DynamicsCompressor gets a trim of `-makeupDb(thr, ratio)` (Blink's automatic makeup, 0.6 x the full-scale reduction) so stages only reduce; the 2-bus has a Linkwitz-Riley 3-way split (160 / 450 Hz) with the mid band compressed only when the beds pile up (dynamic mud control) and the low band held even; the drums strip has a transient stage (slow-attack minus fast-attack compression) and the choir strip an exciter (harmonics above 5 kHz from its own 2.6 kHz+ band); the hall send has a tempo-synced pre-delay (1/16 beat); arps duck under the lead too; the two planetarium pieces carry a slow-breathing sub floor on the bass; the men's choir is the bed of the battle, council, war-variant and determined-exploration cues (`choirMen` + a lighter mixed `choir2` above). Open / airy balance: 2-bus mud cut -2.5 @ 220, air +3 @ 9k, side air +2.5 @ 6k, the hall and stage high-passed at 260 / 220 Hz, pad strip hp 150, choir 170, bass strip -3.5 @ 200, strings -2.5 @ 250 / +3 @ 8k, less sub. `MIX_TRIM` 2.4 after the makeup compensation; `node tools/audio-trims.js report.json [--apply] [--only=re] [--skip=re]` turns a `--json` report into per-cue trims (battle cues at `--intensity 0.8`).
Session 4e — better building blocks: `assets/audio/` is rebuilt from Sonatina Symphonic Orchestra 2.0 (CC Sampling Plus 1.0; VSCO keeps marimba, claves, anvil, taps, field drums; the synth choir is gone, the pads are re-synthesized in stereo). `tools/samples/sfz.py` reads SFZ (includes, defines, group/region opcodes, WAV `smpl` loops); `build.py --sso` builds from `SSO` specs (per-section pans, `layers='cc1'` mod-wheel groups → velocity layers with `xf`, `root_from_name` for keyboard-mapped rolls, `keep` budget enforced by `find_start` with the library's loop end fixed, `step` thinning). `sampler.js`: `pickZones` returns the two layers around the dynamic with equal-power weights (`inst.xf`), `o.swell` ramps them (set by `emit()` from the section level envelope on notes ≥ 1.5 beats), `o.leg` starts past the attack (`markLegato()` in `compilePass` marks gapless moves in `LINES` layers and extends the previous note into the new one), `hum` spreads onset/pitch, zone `pan` seats the section, looped sustains ignore the buffer length. `audio.js`: glue compressor on the music bus (2:1, -20 dB), air shelf 1.5 dB. Looping pieces carry `forms` (arrays of section-name blocks; `passSections()` picks block `(form0 + pass) % n`, `form0` random per performance) and optional `alts` (per-pass partial `inst` maps merged into `C.inst`); `loopBars()` reports block 0. Mono samples take one channel (`decode(path, stereo, chan)`, chan from the pan sign) -- never average these wide recordings (comb filtering was the 'pixelated' complaint). The set decodes to ~400 MB (string-section loops resist shortening below ~4 s; `keep` + `loopq` per spec); `tools/audio-report.js` as before.
Session 4d — symphonic / film flow: the `INST` table maps every synth preset name to a recorded instrument (pizz sections, marimba, glock, harp, oboe/clarinet/bassoon, contrabass; `analog` / `padGlass` keep the two synth pads for cues that want them; `*Syn` presets keep the sequencer colour of Meklar and Klackon), `DRUMV` maps the kit names to orchestral and small percussion (bass drum, snare, field drums, taps, tambourine, claves, anvil). `startTrack` quantizes switches to the next bar (`opts.quantize` 'bar' | 'beat' | false, capped at 4.5 s) with 3.5-4.5 s cross-fades; `soundscape.js` leaves the underscore alone on management screens; `applyIntensity` swells layers over 1.6 s; the galaxy rotation pauses 14 s between pieces; default music volume 0.5.
Not done: nobody has listened yet (balance of the hall reverb and the chorus depth are judgement calls the numbers cannot make); decoded sample memory is ~130 MB, so a low-memory tier that skips the spiccato/trem sets would be a sensible follow-up; no ambience/"map music off" option; the galaxy map still has music (the original was silent); specials (stasis, pulsar, black hole, cloak, repulsor) still share the generic `scan`/`warp` cues.

## Design guardrail from the user (applies to the graphics pass and all UI work)
The new interface should **echo the original's interface** — same overall screen structure and flows (galaxy control screen with right-hand side panel, bottom button bar, five colony sliders, scene-style screens, the original's hotkeys) — not an exact copy, but recognisably descended from it with an upgraded, newer look. The "serious sci-fi, less cartoonish" pass must modernise rendering and chrome while keeping the original's layouts and feel; where `research/09-art-direction.md` conflicts, prefer the original's layout. Original screenshots are reference only and are never committed (copyright).

## Architecture in one paragraph
Plain-JSON state `S`; every change is an *order* (`Sim.Orders.apply`); the turn is a generator (`Sim.Turn.run`) yielding interrupts (aiPlan, battles, techChoice, explore, colonize, bombardPrompt/bombard, ground, diplomacy, council/councilResult, spy choices, event, gnn, gameover) answered by `Game.handlers.*` (UI, `js/ui/flow.js` + each screen module) or defaults (headless `Sim.autoTurn`). AI planners are pure (`AI.plan(snapshot, id, seed) → orders`, step table in `js/ai/ai.js`, helpers in `js/ai/ctx.js`) and run on the worker pool; battle auto-resolution too. Treaty/war/council decisions live in the engines (`Sim.Diplo`, `Sim.Council`), not in AI planners. All modules load through `js/manifest.js` (single source of truth for the browser and the Node harness).
