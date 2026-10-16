# Fun audit — does the remake play like the original? (October 2026)

Brief from the product owner: *make sure the fun of this game (not just the mechanics or numbers) matches the fun of the original.*
This note records what the original's fun actually consists of, how the remake was measured against it, what fell short, what
changed on this branch, and what is left.

## 1. What makes Master of Orion fun (the beats the remake must hit)

1. **Discovery as a reward** — a scout reaches a star and the game stops to show you the world: picture, type, max pop, "Rich", "Artifacts", "Hostile".
2. **The expansion race** inside a hard fuel range; range techs opening the map.
3. **Sliders you touch every turn** with instant readouts; a notice when a colony fills up (factories, population) so you re-balance it.
4. **Tech as surprise** — the scientist scene, a random tree, a one-line effect; new tech → new ship design.
5. **Characters, not factions** — leaders with a personality and a memory; audiences with real text; first contact; war declared to your face.
6. **The GNN** — the galaxy's voice: rare, important, funny. Rankings and "1/4 of the stars" milestones.
7. **Random events and monsters** as stories (plague, nova, comet, derelict, crystal).
8. **Battles that matter** — a short tactical fight at a planet, the pre-battle choice, bombard / invade / lose a world.
9. **The Council** as a second ending and a political drama.
10. **Speed** — a turn is instant; nothing is more than two clicks away; Space continues, Esc backs out.

## 2. How it was measured

* `tools/qa/transcript.js` (headless): an AI plays seat 0's economy while the turn pipeline treats it as the human, so every
  human-facing interrupt fires. 200 turns, medium / average / 3 opponents, seed `fun1`, plus passive-human runs on Average and Hard.
* `tools/qa/playshots.js` (Playwright, real UI): the same game through `Game.endTurn` with the QA bot answering, one screenshot
  per interrupt kind, wall time and clicks per turn.
* `tools/rules/87-fun-audit.test.js` pins the news policy and the planet reports.

## 3. Findings (before)

| Beat | Measured | Verdict |
|---|---|---|
| Discovery | explore card = 64 px thumbnail, type, max pop, Continue; the map did not mark which star | **Flat.** The original's card is the reward of scouting |
| Sliders / colony notices | only "industry maximum", fuel loss and lost transports were reported; population maximum, soil / atmosphere projects, planetary shields and stargates completed **silently** (their events were pushed and dropped) | **Missing rhythm** (research/05 §11.5) |
| Tech | scientist scene + choose-next: excellent; six choices at turn 1 is the original's behaviour | OK |
| Characters | audience scenes excellent; AI→human proposals are rare (0–5 per 200 turns) | Faithful to the original's dispatcher (research/05 §4.6.1: ~0.5 % per AI per turn without earned DP) — kept |
| GNN | **83 newscasts in 200 turns**; every AI-vs-AI fleet kill, battle, invasion and first contact was a full studio broadcast; 49 of 76 bot clicks in a 40-turn QA game were "next" on GNN | **Spam.** The original's 22 news types contain no battles at all |
| Random events | 0 reached the human in 200 turns (the victim rule weights empires under 4 planets at 1 — original); events hitting AI empires never reached the GNN because their ready-made headline was ignored by the compiler | **Half missing** |
| Battles | pre-battle card, auto result card; the result card's second column was clipped in the side panel | Bug |
| Council | every 25 years from 2/3 colonised, accept / defy | OK |
| Speed | 50 % of turns are quiet (nothing to answer) — same as the original; quiet turns resolve in < 100 ms; interrupt turns were dominated by GNN | OK once GNN is fixed |
| Danger | passive human on Average: never attacked in 125 turns, ends by Council exile; on Hard: war at T128, eliminated T136. An AI-played seat on Average lost 8 planets between T105 and T178 | Faithful (research/08); the AI does come for a weak neighbour |
| Map | centring on an edge star left half the screen empty | Polish |

## 4. What changed on this branch

* **GNN policy** (`js/sim/news.js`): importance table rewritten to the original's news types plus the political items the remake
  adds (wars, peace, alliances, elections). Battles, fleet losses, first contacts, colonies founded and treaties signed are archived
  only; archive-only items no longer ride along inside a real bulletin. Categories without a template use the event's ready-made
  headline. A human victim's event (already shown as a card) is archived, an AI's event is news — as in the original.
  Result on the same 200-turn game: **83 → 21 newscasts**; bot clicks per turn in the UI run 1.25 → 0.83.
* **End-of-turn reports** (`js/sim/colony.js`, `js/ui/flow.js`, `js/ui/galaxy.js`): population maximum, soil enrichment / Gaia,
  atmospheric terraforming, planetary shield class and stargate completion are reported; the Fleet Production report is grouped per
  colony. Reports stay on the map until the next turn starts and clicking one selects the colony (the original let you re-adjust the
  sliders from the notice).
* **Discovery cards** (`js/ui/side-misc.js`): exploration and colonise cards use the wide orbit illustration, show the planet's
  special (Rich / Artifacts …), a line of scout's-eye flavour (`Data.text.planetFlavor`, previously unused outside the landing scene)
  and select the star on the map.
* **Combat result card** inside the side panel stacks the two sides (nothing clipped).
* **Map camera** keeps the view over the galaxy (edge stars no longer centre on empty space).
* **Research choice wording**: "No research points reach <field> yet: raise a colony's Tech slider…" instead of "no share assigned".

## 5. Left as the original (deliberate)

* AI→human proposal frequency, the bombard question every turn a fleet orbits an enemy colony, six research choices on turn 1,
  events never striking an empire under four planets, scouts fighting on meeting without a treaty.
* If a chattier galaxy is wanted later, the place is `Sim.Diplo` `dispatch()` (the `rnd0(4)` gate and the +3 base) behind an
  option, not a change to the default.

## 6. Still open (ranked by effect on fun)

1. **Ship art** (Phase B of the immersion review): the fleet you design is still a plan-view sprite everywhere.
2. **GNN mechanics**: Space finishes the typing first and advances on the second press (two presses per item; the original needs one).
3. **Tutor pop-ups** on Simple / Easy (research/06 §7.3) and a spy-panel hint ("set the network to Espionage").
4. **Sound** for the new reports (the audio has never been listened to on real hardware).
