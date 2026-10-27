# Brief · Tech Lab: an expansion pool of new technologies

Goal (from the owner): grow the pool of technologies the game deals research trees from by about 25 %, with new, legitimately novel techs that make games
fresher, without moving the game's balance or its feel. Design 33 % more candidates than needed (60 for 45 places), test them, keep the 45 that work.

## Outcome (October 2026)

* **45 kept of 60**, a quarter of the 180 classic researchable techs: 15 cut, 4 moved to another level, 1 retuned. 42,069 twin trials on 384 base
  games, 7,189 whole AI games in leagues and ablations, 305 calibration battles.
* **Every tech is worth what a classic tech of its level is worth.** Against the classic techs within six levels: 7 rank in the top quarter, 37 in
  the middle half, 1 in the bottom quarter, none outside the classic range. 16 are situational (they changed nothing in half the trials or more;
  mostly combat and defence techs, whose moment is a war). The strongest, Arcology Projects (+8.6 % empire power after 50 turns), is weaker than a
  dozen classic economy techs of its level (Terraforming +80 and +100 measure +46 % and +51 %).
* **The pace holds.** 719 paired AI games, same seeds, classic pool against expanded pool: techs researched +1.2 % at turn 100, tech level −0.6 %,
  production +0.6 %, population −0.3 %, colonies +0.2 %; every race's relative production within 0.04 of classic; the difficulty ladder unchanged.
* **What changes in feel.** Before the Ramscoops retune, AI empires fought about 22 % more battles per turn and declare about one more war per game (5.2 → 6.1). Ablations that keep
  the trees and switch effects off by family show it comes from the reach and growth effects together; the combat effects and the reshuffled trees add
  nothing, and no single tech accounts for more than a small part. Limiting Interstellar Ramscoops' extra range to colony ships and scouts brought that to +8 % (interval −1 to +19 %), and −2 % on colossal galaxies, with wars unchanged. Slightly fewer games end early at the council, and AIs swap about two more techs a
  game because their trees overlap less.
* **Classic games are unchanged** (state hashes at turn 150 match the build before the lab).

Full numbers: `tools/techlab/REPORT.md`. Method and commands: `tools/techlab/README.md`.

## How the pool grows without changing the pace

* **Option, not default.** `New game → Remake options → Expanded technology` (`settings.options.techPool = 'expanded'`). A classic game is byte-identical to
  before (state hashes compared at turn 150, re-checked after every change to the sim).
* **Same tree size.** Each empire's classic tree is dealt exactly as before (same draws from `S.rs`), then some slots are swapped for expansion techs of the
  same field and tier on a separate random stream. Per tier and per empire the count is the classic one, so the number of choices, tier unlocks and
  tech-level growth are untouched. What changes is *which* techs are on offer.
* **Protected techs.** Techs the original flags as essential (Robotic Controls III-VII, Hydrogen/Deuterium fuel cells, the missile line, PL 12/22/32/42) and
  the four single-tech "always" tiers (Class II Deflector, High Energy Focus, Neutronium Armor, Complete Terraforming) are never swapped out.
* **Even odds.** In a tier with k unprotected classic techs and n new ones each slot is swapped with chance n/(k+n), which makes every tech of the enlarged
  tier about equally likely. A human tree holds about 16 new techs among its ~102; a swappable classic tech is dealt in 45 % of trees instead of 56 %.
  After the round-2 moves 39 tiers hold a new tech: 6 swap 20 % of their slots, 12 swap 25 %, 14 swap 33 %, 6 swap 40 % (Computers 5 and 7,
  Construction 5, 7, 8, Propulsion 8) and one 50 % (Planetology 7, whose only swappable classic tech is Complete Ecological Restoration, worth +3 %).
* **Identity = field + level.** Saves, the research lists and the tech-level formula store levels, so new techs sit on the levels the classic table leaves
  empty (113 of them; Weapons has only levels 3 and 49 free).

## Design rules for a new tech

1. **Symmetric.** As useful to an AI as to a player: passive effects, or effects whose best use is automatic. No new decisions the AI cannot make.
2. **Sideways, not upward.** New axes (salvage, evacuation, minefields, planet improvements, banking …) rather than bigger numbers on the core chains.
3. **Bounded.** Every effect has a cap or a stated maximum; chains (two techs, same key) never stack, the better one wins.
4. **Counterplay nearby.** Offence and defence come in pairs (Siege Engineering / Repulsor Field Net, Stealth Landing Craft / Robotic Garrisons …).
5. **Parity with the tier.** Worth about what a classic tech of its level is worth — measured, not guessed (tools/techlab).
6. **Feel.** MOO1 names and one-line descriptions; effects the tech screen can state in a few words.

## The 45 technologies

| Field | Lv | Name | Effect | Family |
|---|---|---|---|---|
| Computers | 3 | Stellar Survey Probes | Survey: stars within scanner range + 2 parsecs are explored | logistics |
| Computers | 11 | Tactical Combat Analyzers | Fleet attack: +1 level for every ship | combat |
| Computers | 21 | Galactic Banking Network | Reserve interest: 5% a year (at most 10% of gross production) | economy |
| Computers | 24 | Scientific Exchange Protocols | Research: +4% per pact or alliance (up to +16%) | research, diplomacy |
| Computers | 29 | Orbital Targeting Arrays | Missile bases: +2 attack levels | defence |
| Computers | 31 | Predictive Fire Control | Fleet attack: +2 levels for every ship | combat |
| Computers | 33 | Heuristic Research Engine | Research interest: 20% a year (cap 3 × this year's funding) | research |
| Computers | 36 | Holovision Broadcast Network | Galactic Council: +20 weight with every AI voter; Goodwill: +25% | diplomacy |
| Computers | 41 | Neural Infiltration Net | Infiltration: +20; Spy cost: −25% | espionage |
| Construction | 4 | Prefabricated Colony Modules | New colonies: +1 colonist, 4 factories | expansion |
| Construction | 7 | Asteroid Mining | Asteroid systems: +5% production (dense fields +10%) | economy |
| Construction | 12 | Robotic Garrisons | Ground defence: +10 | defence, ground |
| Construction | 21 | Battlefield Salvage | Salvage: 20% of the price of destroyed enemy ships, after battles you win | combat, economy |
| Construction | 22 | Orbital Minefields | Minefields: enemy stacks attacking your colonies lose 8% of their hit points at once | defence |
| Construction | 27 | Orbital Drydocks | Ship maintenance: −25% | economy, combat |
| Construction | 31 | Hardened Missile Silos | Missile bases: +50% hit points, −20% cost | defence |
| Construction | 32 | Siege Engineering | Bombardment: +50% damage; Invading troops: +5 | offence, ground |
| Construction | 37 | Modular Shipyards | Ship cost: −10% | economy, combat |
| Construction | 39 | Reverse Engineering Labs | Captured technology: 25% chance per battle won with enemy ships destroyed | research, combat |
| Construction | 43 | Arcology Projects | Max population: +10% on every colony (at least +5), a permanent improvement | population |
| Force Fields | 6 | Pressure Domes | Hostile worlds: +25% max population (at least +5), a permanent improvement | population |
| Force Fields | 17 | Repulsor Field Net | Invaders: +30% transport losses; Bombardment: −25% damage taken | defence |
| Force Fields | 25 | Stealth Landing Craft | Troop transports: losses on approach halved | offence, ground |
| Force Fields | 36 | Inertial Shield Harmonics | Ship missile defence: +2 | combat |
| Force Fields | 41 | Absorption Lattice | Ship deflectors: absorb +2 per hit | combat |
| Force Fields | 48 | Planetary Stasis Field | Sieges: bombs, bio-weapons and battles never push a colony below 25% of its max population | defence |
| Planetology | 4 | Adaptive Genetics | Hostile worlds: population grows at the normal rate | population |
| Planetology | 7 | Accelerated Gestation | Population growth: +25% | population |
| Planetology | 11 | Biomass Reactors | Worker output: +10% | economy |
| Planetology | 19 (was 39) | Gaia Seeding | New colonies: normal worlds are founded fertile | population, expansion |
| Planetology | 25 | Terraforming Nanites | Terraforming: −1 BC per point (at least 1) | population |
| Planetology | 28 | Small World Engineering | Small worlds: +25% max population on worlds of base size 40 or less (at least +5), permanent | population |
| Planetology | 33 | Clone Troopers | Invading troops: +10 | offence, ground |
| Planetology | 39 (was 43) | Hyper-Fertility Treatments | Population growth: +50% | population |
| Propulsion | 7 | Interstellar Ramscoops | Colony ships and scouts: +1 parsec range on top of your fuel cells | expansion, logistics |
| Propulsion | 13 (was 8) | Navigation Beacons | Between your colonies: +1 warp for fleets and transports | logistics |
| Propulsion | 17 (was 26) | Emergency Warp Capacitors | Lost battles: 30% of the ships that would be destroyed escape | combat |
| Propulsion | 22 | Cryogenic Colony Berths | Colony ships: −25% cost | expansion |
| Propulsion | 28 | Combat Thrusters | Combat speed: +1; Initiative: +2 | combat |
| Propulsion | 37 | Warp Damping Field | Hostile fleets: −2 warp within 4 parsecs of your colonies (never below 1) | defence, logistics |
| Propulsion | 39 | Lifeboat Protocols | Lost colonies: 30% of the population escapes to your nearest colony with room | resilience |
| Propulsion | 44 | Slipstream Drives | Fleets bound for your colonies: +1 warp | logistics, defence |
| Propulsion | 47 | Hyperlane Transports | Transports: +3 parsecs per turn | logistics, offence |
| Weapons | 3 | Point Defense Lasers | Missile interception: 20% on every ship (anti-missile devices still apply) | combat |
| Weapons | 49 | Antimatter Warheads | Missiles, torpedoes, bombs: +25% damage | combat, offence |

## Cut in round 2

| Field | Lv | Name | Effect | Why it was cut |
|---|---|---|---|---|
| Computers | 9 | Factory Supervisor AI | Automated factories: +3 per colony, no workers needed | Fired in 92% of trials but worth nothing measurable: three worker-free factories a colony are noise beside hundreds, and it blurs the Robotic Controls line. |
| Computers | 14 | Quantum Encryption | Counter-espionage: +15 | Fired in 2% of trials. The AI rarely spies at that stage, so better counter-espionage almost never matters. |
| Computers | 19 | Universal Translator | Goodwill: +50% to every positive relation change; Trade: +15 points of efficiency | No measurable value, and its goodwill half duplicates Holovision Broadcast Network. |
| Construction | 19 | Damage Control Teams | Ship repair: 5% of hit points per round (better repair devices still apply) | A near-copy of the classic Automated Repair System, with no measurable value. |
| Force Fields | 11 | Shield Capacitors | Ship deflectors: absorb +1 per hit | Never fired: early AI designs carry no deflectors, so there was nothing to strengthen. Absorption Lattice keeps the idea later. |
| Force Fields | 23 | Flux Shields | Ship defence: +1 beam defence | +1 beam defence is the weakest combat effect calibrated (about 5% more ships) and showed no value in trials. |
| Force Fields | 28 | Structural Integrity Fields | Ship hit points: +15% | Slightly negative in trials; +15% hit points is worth only about 6% more ships. |
| Force Fields | 33 | Phase Barrier | Planetary shields: absorb +5 per hit | Never fired, and the combat calibration found +5 planetary-shield absorption worth nothing. |
| Force Fields | 35 | Gravitic Lensing Array | Scanner range: +2 parsecs | Never fired: a longer scanner range changes nothing the AI does. |
| Planetology | 19 | Bio-Engineered Soil | Planet projects: soil and atmosphere projects cost −33% | Fired in 12% of trials with no measurable value: few soil projects are left when it arrives. |
| Planetology | 29 | Planetary Disaster Response | Disasters: no earthquakes, comets or industrial accidents; Plague / supernova: cures and stabilisation cost half | Random disasters are too rare to matter (17% of trials, no measurable value). |
| Planetology | 37 | Bio-Containment Fields | Bio-weapons: casualties halved; Plague: never strikes your worlds | Bio-weapons and plague are too rare to matter (9% of trials, no measurable value). |
| Propulsion | 13 | Assault Shuttles | Troop transports: −25% losses on approach | A weaker duplicate of Stealth Landing Craft (the same effect), active in 9% of trials. |
| Propulsion | 17 | Hyperspace Trade Lanes | Trade agreements: mature twice as fast, +10 points of efficiency | Fired in 14% of trials with no measurable value: trade agreements mature anyway. |
| Propulsion | 49 | Hyperwarp Overdrive | Fleet speed: +2 warp | Harmful in AI hands: +2 warp hurried its holder into wars it lost (fleet -53%, empire power -6%). |

## Moved and retuned

| Tech | Change | Why |
|---|---|---|
| Gaia Seeding | Planetology 39 → 19 | At 39 almost no new normal colonies are founded; it fired in 9 % of trials. |
| Hyper-Fertility Treatments | Planetology 43 → 39 | Its old tier holds one swappable classic tech, Terraforming +100 (worth +51 %), which it halved. |
| Navigation Beacons | Propulsion 8 → 13 | Propulsion tier 2 held two new techs and cut Nuclear Engines and Irridium Fuel Cells from 57 % to 34 % of trees (now 43 %). |
| Emergency Warp Capacitors | Propulsion 26 → 17 | Propulsion tier 6 held two new techs; tier 4 has four classic techs to share the slots with. |
| Interstellar Ramscoops | +1 parsec for every ship → for colony ships and scouts only | After round 3: longer warship range let AI fleets reach more enemy colonies, the main single driver of the extra battles. Afterwards battles per turn are +8 % (−1 to +19 %) on standard galaxies and −2 % on colossal ones; the tech re-tests at +1.9 %. |
| Slipstream Drives | +1 warp for every fleet → +1 warp for fleets bound for your own colonies | Round 3: as +1 warp for every fleet it hurt AI holders (−4.7 % empire power, fleet −22 %, interval entirely below zero). Retuned, it reads −1.3 % (interval −4.9 to +2.2 %), inside the range of the classic engine techs (Hyper Drives −3.7 % to Impulse Drives +2.4 %). |

## How they are tested (tools/techlab)

* **Combat calibration.** AI-vs-AI battles use the original's weight model, which has no term for any new combat effect. Each effect's weight bonus is
  measured in the tactical engine: real AI battles, rebalanced to an even fight, fought with the effect and with the subject's ship counts scaled; the
  ship multiplier that gives the same win rate is the effect's worth.
* **Twin trials.** Copy a game at turn 40 / 80 / 120, give one empire the tech in both copies with its effects switched off in the control copy, compare
  10 / 25 / 50 turns later. The effects-off control matters: granting any tech raises its field's tech level, and a plain control credited every
  Planetology tech with the worker output that level brings (round 1). All 180 classic techs go through the same trial and form the reference band for
  their level; a placebo copy (one extra random draw) measures the noise.
* **League A/B.** Whole games, classic against expanded pool, same seeds: pace, economy, endings, difficulty ladder, race strength, battles and wars; per
  tech how often it is dealt and researched. Ablations keep the trees and switch effects off by family to find what moves a league result.

## Culling rules (60 → 45)

Out: overpowered outliers that tuning cannot bring into the band, duds that never matter, effects only a human can exploit, near-duplicates of a stronger
candidate, and anything that would distort a race's identity. Tuning first, cutting second: a candidate outside the band gets one retune and a re-test.
Applied in round 2: no candidate was an outlier above the classic range; the cuts were eight that rarely or never fired, three that fired without
mattering, three near-duplicates and one that hurt its holder in AI hands. Round 3 found one more tech that hurt AI holders (Slipstream Drives); it was
retuned rather than cut.
