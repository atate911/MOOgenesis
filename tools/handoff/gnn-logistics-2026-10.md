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
