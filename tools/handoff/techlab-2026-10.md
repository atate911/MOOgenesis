# Tech Lab — October 2026 (branch `claude/tech-lab`)

Brief from the product owner: grow the pool of technologies research trees are dealt from by about 25 % with legitimately new techs and new
hooks, design a third more candidates than needed, test them in iterations, keep what works, and keep the game's balance and feel. Design brief
with the final list: `briefs/tech-lab.md`. Results: `tools/techlab/REPORT.md` and the published results page. Lab method: `tools/techlab/README.md`.

## What exists now

| Item | Files | Notes |
|---|---|---|
| Option | `js/ui/setup.js` (`expandedTech` → `settings.options.techPool = 'expanded'`), `js/core/game.js` (dev URL `&pool=expanded`) | Off by default. A classic game is byte-identical to the build before the lab (state hashes at turn 150, re-checked after each sim change). |
| Data | `js/data/techs-x.js` | 45 rows `{ l, id, n, ty, g?, nv?, fx, tags, d, say }`. Records go into `Techs.byId` / `byFL` only, never into `T.list` / `byField` / `researchTable` (classic tables are pinned by tests and determinism). `Techs.X`: lists, `researchTable` (classic + new), `expandList`, `swapChance`, `protectedLevel`, `KEYS` (every effect key, documented at the top of the file), `MIN_KEYS`, `BONUS_KEYS`. |
| Sampler | `Techs.X.expandList`, called from `Research.init` with its own RNG (`seed + ':xtree:' + empire`) | Swaps unprotected slots with chance n/(k+n) per tier; tree sizes unchanged; `E.research.pool = 'x'`. |
| Fold | `js/sim/research.js` | Expansion techs fold only for an empire whose `research.pool` is `'x'`; `grant` refuses them otherwise. `research.nullify` (lab only) keeps a tech owned with its effects off; `Design.owned` honours it. |
| Hooks | `js/sim/xtech.js` (helpers: improvements, combat modifiers and calibrated weights, battle aftermath, siege floor, evacuation, warp) + guarded lines in colony, econ, fleet, vis, design, combat, ground, spy, diplo, council, artifacts | Every hook reads `E.mods.<key>`, absent unless the empire owns the tech. |
| UI | `js/ui/tech.js` (effect lines from `say`, new types and art), `techtree.js`, `help.js`, `flow.js` / `turnlog.js` (salvage and evacuation notices) | `tools/qa/techlab-shots.js` screenshots the setup option, tech screen, tree and a breakthrough. |
| Tests | `tools/rules/23-techs-x.test.js` (15), `20-techs.test.js` | Data integrity (every documented key used), sampler, isolation, every hook. |
| Lab | `tools/techlab/` | `combat.js`, `twins.js`, `analyze.js`, `league.js`, `league-analyze.js`, `report.js`. Outputs in `tools/out/techlab/` (ignored). |

## What the rounds decided

* Round 1: combat calibration (weights in `XTech.WEIGHT`); the first twin trials used a plain control and credited every Planetology tech with the
  tech-level bump. Fixed with the effects-off control.
* Round 2: values for all 60; 15 cut, Gaia Seeding moved 39 → 19, dead hooks removed. The classic ship-component techs were re-run (2c) after
  `Design.owned` learned about `nullify`.
* Placement: Hyper-Fertility 43 → 39, Navigation Beacons 8 → 13, Emergency Warp Capacitors 26 → 17 (fewer tiers that swap two slots; Terraforming
  +100 keeps its classic odds).
* Round 3 (96 fresh games): 7 strong, 37 typical, 1 low, none outside the classic range. The low one, Slipstream Drives (+1 warp for every fleet),
  hurt AI holders: in 16 traced games they fought fewer battles but lost a third more ships and won fewer, likely because the classic AI plans with
  its engine speed and its transports do not get the bonus. Retuned to "+1 warp for fleets bound for your own colonies". Re-tested on the round 3 games: −1.3 % empire power (interval −4.9 to +2.2 %), up from −4.7 % (−7.2 to −1.9 %); inside the classic engine techs'
  range (Hyper Drives −3.7 %, Impulse Drives +2.4 %).
* League (720 paired games on two seed sets): tech pace, tech level, production, population and colonies within about ±2 %; race signatures and the
  difficulty ladder unchanged. AI empires fight about a fifth more battles per turn; ablations show it comes from the reach and economy effects
  together (not from the combat effects, and not from the reshuffled trees). Wars are not significantly more frequent. A few percent fewer games end
  early at the council.

## Notes for the next person

* A new effect key: document it at the top of `techs-x.js`, add it to `KEYS`, guard the consumer with `E.mods`, give it a calibrated weight if it
  changes combat, then run `twins.js --only <id> --classic 0` and a league. The data test fails on a documented key no tech uses.
* Ids are field + level: moving a tech changes its id; `analyze.js` skips trials of ids the data no longer has.
* The AI picks research inside a field by tier position (`Research.aiPick`), so new techs are chosen like classic ones. The AI's military planner
  uses the original threat formula, which ignores the new combat bonuses for everyone; AI-vs-AI battles use the calibrated weights.
* Extra speed is a trap for the classic AI: its holders lose more ships (most likely their attack fleets get ahead of their plans and transports).
  Hyperwarp Overdrive (+2 warp) was cut for it and Slipstream Drives retuned; the classic Hyper Drives also reads slightly negative.
* In AI-only leagues most games end at the council around turn 125-150, so techs above level ~35 are rarely researched there; their twin trials (granted
  at turn 120) are the evidence for them.

## Follow-ups

1. A human playtest of an expanded game: the lab measures AI games only, and some techs (minefields, lifeboats, warp damping, salvage) are more
   interesting in a player's hands than their AI numbers show.
2. If the extra battles read as a change of feel in play, the reach techs (Ramscoops, Beacons) and early growth techs are the levers; each alone moves
   the battle rate by less than the noise, so it would be a judgement call rather than a fix.
3. The council-ending shift is small but consistent across both seed sets; worth watching if Expanded technology becomes the default.
