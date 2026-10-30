# Master of Orion — Reborn

A from-scratch browser remake of the 1993 4X classic **Master of Orion** (MicroProse / SimTex): ten asymmetric races, a random galaxy of up to 160 stars with nebulae,
the five-slider colony economy, six-field research with per-game random tech trees, a ship designer with miniaturisation, tactical and ground combat, diplomacy with
AI leaders that have personalities and objectives, spies, the Galactic Council, the Orion Guardian, the GNN news network — with modern, entirely original graphics, music and sound.

> All art, music, text and code are original. The original game was used only as a reference for rules, layout and feel (public strategy guides and the open-source
> *1oom* rules documentation informed the *numbers and behaviours*; no code or assets were copied). The orchestral instrument recordings the music engine plays
> come from the freely licensed Sonatina Symphonic Orchestra (CC Sampling Plus 1.0) and VSCO 2 Community Edition (CC0) — see `assets/audio/README.md`.

## Status
**Released: version 1.3.0.** The whole loop works end to end (new game → galaxy → turns against 1–5 AI empires → research, ship design,
tactical/ground combat, diplomacy, spies, council, events, endings, save/load) on current desktop browsers and on phones (installable
from the home screen). Each release passes the suites under `tools/` — syntax of every module, the rules tests, AI-vs-AI soak games with
state sanity and determinism checks, and headless click-throughs of every screen on desktop and phone (`tools/qa/`). Still open — a few
optional illustrations (**`ART-NEEDED.md`**) and a listening / GPU pass on real hardware — is tracked in **`HANDOFF.md`** (start there).

## Run it
* Double-click `index.html` (works from `file://` — no build step, no dependencies), **or** serve the folder: `python -m http.server 8765` → http://localhost:8765/
  (serve it to hear the sampled orchestra in `assets/audio/`; from `file://` the browser blocks those loads and the score plays on its built-in synth voices)
* Chrome / Edge / Firefox (current). WebGL2 and Web Workers are used when available and are never required.
* Server saves + password gate locally: `python3 server/moo-saves.py --dev` → http://localhost:8765/ (password `moopassword`; `--password ''` turns it off)

## Host it on your own server
Static files behind nginx + Let's Encrypt on Ubuntu: `sudo bash scripts/install.sh --email you@example.com` (defaults to moo.dhlab.us), then `sudo bash scripts/upgrade.sh --pull` to update, `rollback.sh` to undo, `doctor.sh` to check. A small save server asks for a password before the game loads (default `moopassword`, set in `/etc/moogenesis/moo.conf`; blank turns it off) and keeps server save slots. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Playing (original conventions)
* **Control screen**: galaxy map (drag / wheel / arrows), side panel for the selected star/colony/fleet, bottom bar **Game · Design · Fleet · Map · Races · Planets · Tech · Next turn** (hotkeys G D F M R P T N).
* **Colony sliders**: Ship / Def / Ind / Eco / Tech (4% steps, lockable, always 100%). Eco keeps the planet clean first.
* **Research**: six field sliders; completion is a yearly roll; pick the next tech when a field finishes.
* **Ships**: build designs with the SHIPS button; send fleets from the Fleet deployment panel (green route = in fuel range). **Reloc** sets rally points, **Trans** moves population.
* **F-keys**: F2/F3 cycle colonies, F4/F5 colonies with ships, F10 quick-save, F1 help, F3 is also the performance overlay in-game (see below). Space/Enter = OK, Esc/right-click = back.
* Win by conquest or by being elected Emperor by the Galactic Council (2/3 of the population-weighted vote) — or lose your last colony.

## Hardware use (scales to the machine)
* **Web Workers**: AI planning, battle resolution and odds simulation run on a pool sized to your CPU threads (inline fallback when unavailable).
* **WebGL2**: optional GPU renderers for planets, nebulae, the title vortex and combat effects, with Canvas2D fallbacks.
* **Adaptive quality** (`MOO.Perf`): probes the device, picks low / medium / high / ultra, and re-tunes live from frame times (Options → Graphics). F3 toggles the overlay (fps, GPU, threads, worker load).

## Developer tools
```
node tools/check.js            # syntax-check every module in js/manifest.js
node tools/rules-test.js       # formula/rules tests (tools/rules/*.test.js)
node tools/soak.js --games 48  # multi-threaded AI-vs-AI soak / balance runs (see tools/SOAK.md)
node tools/audio-report.js     # renders every music track + sound effect headlessly: LUFS, limiter use, voices (--wav DIR --mp3 to listen)
node tools/score-lint.js       # the score against its schema and the engine's own analysis (js/audio/score/*.js); --strict for a release
node tools/qa/music.js         # the music engine's seams in real time: directed programme, soft changes, bridges, motifs, snapshot / restore
node tools/audio-hour.js       # captures a scripted hour of the map's music (alone, first contact, a war, peace, the late years) as raw PCM
node tools/audio-seams.js      # captures four seam examples (one piece changing softly into another through the interlude built for them) as MP3
http://localhost:8765/tools/index.html   # test pages for every module
http://localhost:8765/index.html?dev=1&screen=galaxy&race=psilon&size=large&opp=4&turns=25&seed=abc
```
Architecture and contracts: `CONVENTIONS.md`, `DESIGN.md`; research notes behind every rule: `research/*.md`; agent work briefs: `briefs/*.md`; progress: `PROGRESS.md`.
