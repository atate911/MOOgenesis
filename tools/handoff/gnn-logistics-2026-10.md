# GNN timing, still photos, race-photo audit, stargates and rally points — October 2026 (branch `claude/zealous-bohr-fxv562`)

User report: stargates and ship relocations need better handling; some race photos are wrong; GNN broadcasts show and close before
they can be read (and the GNN system needs a closer look); on the Races screen, clicking Audience makes the photos jump around.

## GNN
Measured with the real turn pipeline (Playwright, no input): a one-story broadcast ran title 2.6 s → typing 1.7 s → hold 3.5 s → back
to the galaxy, 10.7 s in all. The hold was `clamp(2.2 + chars × 0.02, 2.8, 3.5)` — a two-line story got 3.5 s.
Changed (`js/ui/gnn.js`):
- the LAST segment never times out; the Next button becomes Continue (`setEndWait`), Space / click / Continue closes;
- earlier segments hold `clamp(1.2 + (headline + sub) / 16, 4, 11)` s × speed factor (×1.12 for breaking news), rankings 5.5 s;
- `act()` ignores next/skip during the first 0.6 s of a broadcast (the Next-turn key or click that opened it);
- the anchor is stable per game (`hashStr(seed)` over the races not in the game, else all races); it used to be random per broadcast;
- `js/ui/galaxy.js`: the 45 s stuck-turn Skip float is not armed while `GNN.isOnAir()` (a broadcast now waits by design).
Verified: 25 s idle stays on air with "Continue", Space returns to the galaxy; `tools/qa/turns.js 40` (bot presses Space on the GNN, 15 times).
Not changed: the news policy (`js/sim/news.js`, fun audit) — item races are correct; the 1 s before the first broadcast frame (screen build).

## Photos that "jump around"
Layout is stable (portrait boxes and canvas sizes measured before/after Audience at 5 window sizes). What moved was the pictures:
`phPaint` zoomed every photo 1.2 % (breathing) + up to 1.2 % more while talking at ~0.45 Hz and drifted it sideways; the Races
screen redraws at 10–20 fps, so the motion stepped; pick mode pulsed all five photos with `filter: brightness drop-shadow`.
Changed: `js/gfx/portraits.js` — static below 220 device px or with `o.still`, a 0.35 % slow push above, no talking zoom;
`js/ui/races.js` — a box-shadow ring pulse instead of the filter (static with prefers-reduced-motion); `js/ui/audience.js` — envoy sway /
breathe cut to about a third. Verified: Races portrait canvases are pixel-identical across frames; audience frame differences < 1 grey level.

## Race photos
A sub-agent viewed all 81 images (10 references in `Race photos/`, 10 portraits, 60 race art plates, the GNN studio): every subject is
the right race, no duplicates across races. Only `assets/art/races/race-human-council.webp` has a purple non-MOO alien among the background
delegates (used by the human victory ending) — needs a re-render if it matters. Code paths (audience, council, endings, tech lab, landing,
races, setup, help, GNN badges) pass the right empire's race; the visible mismatch was the random GNN anchor (fixed above).

## Stargates and rally points (research/04 §5.5–5.6, research/06 §3, §4.6, §5.6)
- `Sim.Fleet.transEta` (Trans panel ETA now uses the gate like `launchTransports`), `Sim.Fleet.relocRoute(S, E, p[, to])` → `{to, eta, gate, warp}`,
  `Sim.Fleet.fixReloc(S)` (rally lines to a planet the empire no longer owns point home; run after `checkDeaths` and at the start of
  `stepShips`), order `relocAll {to}` (to < 0 resets all).
- Map (`js/ui/galaxymap.js`): `sd.gate` / `sd.reloc` in `derive()`, `drawRelocs()` (blue-grey dashed lines + chevrons, violet for a gate pair;
  `Settings.mapReloc === false` hides them), `drawGates()` (violet ring + four notches outside the owner ring), route preview `{gate, kind:'reloc'}`.
- Colony panel: "stargate" chip, "Rally → X · n turns (stargate)" line (click centres the map); Reloc panel: preview + Accept (Space),
  All colonies, Stay here, Cancel; Alt+R on the galaxy screen (toggle all → selected / clear).
Tests: `tools/rules/88-logistics.test.js` (4). Not changed: the AI's stargate policy (`js/ai/designs.js`, 50 % per planet once it has the tech).

## Waiting-for-input lights
`js/ui/kit.js`: `UI.attention(el, {focus})` (one gold pulse, keeps a stack so a closed modal hands it back via `restoreAttention`),
`UI.attentionGroup(els)` / `UI.attentionClear(els)` (soft blue pulse on every option of a real decision), `UI.modal` lights its primary or
lone affirmative button when `Game.busy` (or `o.attention === true`) and takes `o.choices` (a selector for a decision's options).
Applied in: audience (`choose()`), Council (Continue, vote, verdict), spy prompts, the fallback research modal. Already lit before:
side-panel cards, pre-battle, combat result, landing/bombard, tech scenes, endings, GNN. Deliberately NOT lit: tactical combat orders
(the lit grid cells already show the moves; pulsing Done would invite skipping turns) and Next Turn while nothing is pending.
Verified with Playwright: player modal unlit; card default lit; event modal takes the light and returns it; AI offer and Council vote /
verdict light all options; `tools/qa/turns.js`, `tools/qa/spy.js` clean.

## GNN volume (playtest: "too many updates; at war, then in the same turn not")
Cause: the AI-vs-AI diplomacy pass (`js/sim/diplo.js`, the P1×P2 loop) can `startWar` (warCheck / alliance call-ups) and later in the same
pass `stopWar` the pair or jump it into an "instant alliance" out of war; both news items reached one bulletin. Volume came mostly from
AI-vs-AI alliances, conquests and other empires' local random events (announce() defaulted them to importance 1).
`js/sim/news.js` `broadcastFilter(S, ev, importance, st)` decides what airs (see its header): AI-vs-AI wars only while the pair is still at
war at compile time, both empires met, per pair once per `POLICY.WAR_COOLDOWN` (20) turns, `POLICY.WAR_MAX` (2) per bulletin; event-born
items only for systemNova / planetDestroyed / orionColonised; AI coups and Council outcomes archive. The archive (`S.newsLog`) is unchanged.
Measured (`news-audit`, 6 headless games, 741–814 turns): 1.19 → 0.46 broadcasts per 10 turns; remaining: stars report, rankings filler,
empire destroyed, planet destroyed; 0 contradictions. The ticker now uses `RNG.create(seed:gnn-ticker:turn)`; before, the filter changed
game outcomes (state hashes diverged at turn 40). Verified identical hashes with the filter on and with its war cool-down disabled.
Tests: `tools/rules/89-news-policy.test.js` (6), three `87-fun-audit` assertions updated to the new policy; `86-ai-fixes` scrap test sums
three seeds (fixed 706 vs original 1606 over six seeds; the single seed had become an outlier after the RNG stream change).

## Pacing over a full game (user: a player game runs 350-450 turns, little done early, more later)
Measured with 450-turn headless games (`longgame` script in the session scratchpad: slot 0 human, moves planned by the AI, prompts
auto-answered; per 50-turn bucket):
- Prompts the player answers: ~30 per 50 turns early (tech choices, explore cards), 35-50 in war stretches (battles, bombard, ground).
- GNN: after the filter ~1-2 per 50 turns all game. Before the war-wipe rule the late wars aired 10-25 "planet destroyed" per 50 turns.
- Turn time 5-40 ms headless, save 150-220 KB at T300: no late-game performance problem found (the browser map was not measured here).
- AI stargates: none built by T319 (Propulsion stalls around level 15-17; stargates need 27), so the AI gate policy is untested.
- The stand-in player never grew past 1-3 colonies and lost between T154 and T319: these runs say nothing about game LENGTH.
- Game length with competent players (`soak.js --games 16 --turns 450`, all slots AI): 15/16 end by the Galactic Council, median T175
  (p10 T91, p90 T340). Faithful to the original (research/05 §7: first session at 2/3 colonised, then every 25 years), but half the
  length the user expects a game to last. A "Council pacing" option is a design decision for the user (Options already has Council on/off).

### Game length by galaxy size and difficulty (user plays Huge / Easy; the game must also suit short games)
`soak.js` (all slots AI, 4 opponents, cap 600), end turn of each game — every finished game ended at the Galactic Council:
| size / difficulty | games | end turns | median |
|---|---|---|---|
| small / hard | 10 | 26–300 | 175 |
| small / easy | 10 | 100–600 | 225 |
| small / average | 10 | 48–600 | 275 |
| medium / easy | 6 | 175–400 | 325 |
| huge / average | 4 | 125, 175, 200, cap 600 | ~190 |
| huge / easy | 4 | 200, 250, 300, 375 | ~275 |
Length scales by itself (the Council needs 2/3 of the stars colonised; Easy AIs expand slower). Nothing added here assumes a game length:
the GNN rules are per turn (war cool-down 20 turns, 2 wars per bulletin) and the stars report / Council use fractions of the galaxy.
Huge / Easy stand-in (`longgame huge lgH1 600 easy`): 11–36 prompts and 1–3 newscasts per 50 turns all game, 11–24 ms per turn headless,
save 269 KB at T325. **AI stargates: 20 built by T300, 31 by T350 (≈93,000 BC plus ~3,100 BC a turn upkeep), 0 fleet jumps through any
gate** — the AI builds them on a coin flip per planet (`js/ai/designs.js`) but its fleets never move between two of its own gated
planets. Open item, recommended fix. Also still open: AI-vs-AI peace undone the same turn by alliance call-ups (8 of 12 same-turn cases).
