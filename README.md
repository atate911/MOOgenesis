# Master of Orion — Reborn

A from-scratch browser remake of the 1993 4X classic **Master of Orion** (MicroProse / SimTex): ten asymmetric races, a random galaxy of up to 160 stars with nebulae,
the five-slider colony economy, six-field research with per-game random tech trees, a ship designer with miniaturisation, tactical and ground combat, diplomacy with
AI leaders that have personalities and objectives, spies, the Galactic Council, the Orion Guardian, the GNN news network — with modern, entirely original graphics, music and sound.

> All art, music, text and code are original. The original game was used only as a reference for rules, layout and feel (public strategy guides and the open-source
> *1oom* rules documentation informed the *numbers and behaviours*; no code or assets were copied). The orchestral instrument recordings the music engine plays
> come from the public-domain (CC0) VSCO 2 Community Edition — see `assets/audio/README.md`.

## Status
**Playable, in active development.** The whole loop works end to end (new game → galaxy → turns against 1–5 AI empires → research, ship design, tactical/ground combat, diplomacy, spies, council, events, endings, save/load). What remains — QA click-through, balance audit, GPU wiring, a second "serious sci-fi" graphics pass — is tracked in **`HANDOFF.md`** (start there) and `PROGRESS.md`.

## Run it
* Double-click `index.html` (works from `file://` — no build step, no dependencies), **or** serve the folder: `python -m http.server 8765` → http://localhost:8765/
  (serve it to hear the sampled orchestra in `assets/audio/`; from `file://` the browser blocks those loads and the score plays on its built-in synth voices)
* Chrome / Edge / Firefox (current). WebGL2 and Web Workers are used when available and are never required.

## Host it on your own server
Static files behind nginx + Let's Encrypt on Ubuntu: `sudo bash scripts/install.sh --email you@example.com` (defaults to moo.dhlab.us), then `sudo bash scripts/upgrade.sh --pull` to update, `rollback.sh` to undo, `doctor.sh` to check. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

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
http://localhost:8765/tools/index.html   # test pages for every module
http://localhost:8765/index.html?dev=1&screen=galaxy&race=psilon&size=large&opp=4&turns=25&seed=abc
```
Architecture and contracts: `CONVENTIONS.md`, `DESIGN.md`; research notes behind every rule: `research/*.md`; agent work briefs: `briefs/*.md`; progress: `PROGRESS.md`.
