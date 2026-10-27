# Brief · Tech Lab: an expansion pool of new technologies

Goal (from the owner): grow the pool of technologies the game deals research trees from by about 25 %, with new, legitimately novel techs that make games
fresher, without moving the game's balance or its feel. Design 33 % more candidates than needed (60 for 45 places), test them, keep the 45 that work.

## How the pool grows without changing the pace

* **Option, not default.** `New game → Remake options → Expanded technology` (`settings.options.techPool = 'expanded'`). A classic game is byte-identical to
  before (state hashes compared at turn 150).
* **Same tree size.** Each empire's classic tree is dealt exactly as before (same draws from `S.rs`), then some slots are swapped for expansion techs of the
  same field and tier on a separate random stream. Per tier and per empire the count is the classic one, so the number of choices, tier unlocks and
  tech-level growth are untouched. What changes is *which* techs are on offer.
* **Protected techs.** Techs the original flags as essential (Robotic Controls III-VII, Hydrogen/Deuterium fuel cells, the missile line, PL 12/22/32/42) and
  the four single-tech "always" tiers (Class II Deflector, High Energy Focus, Neutronium Armor, Complete Terraforming) are never swapped out.
* **Even odds.** In a tier with k unprotected classic techs and n new ones each slot is swapped with chance n/(k+n), which makes every tech of the enlarged
  tier about equally likely. Levels were chosen so that no tier swaps more than about 40 % of its slots (two tiers of Planetology reach 50 %).
* **Identity = field + level.** Saves, the research lists and the tech-level formula store levels, so new techs sit on the levels the classic table leaves
  empty (113 of them; Weapons has only levels 3 and 49 free).

## Design rules for a new tech

1. **Symmetric.** As useful to an AI as to a player: passive effects, or effects whose best use is automatic. No new decisions the AI cannot make.
2. **Sideways, not upward.** New axes (salvage, evacuation, minefields, planet improvements, banking …) rather than bigger numbers on the core chains.
3. **Bounded.** Every effect has a cap or a stated maximum; chains (two techs, same key) never stack, the better one wins.
4. **Counterplay nearby.** Offence and defence come in pairs (Siege Engineering / Repulsor Field Net, Stealth Landing Craft / Robotic Garrisons …).
5. **Parity with the tier.** Worth about what a classic tech of its level is worth — measured, not guessed (tools/techlab).
6. **Feel.** MOO1 names and one-line descriptions; effects the tech screen can state in a few words.

## The 60 candidates

| Field | Lv | Name | Effect | Family |
|---|---|---|---|---|
| Computers | 3 | Stellar Survey Probes | Survey: stars within scanner range + 2 parsecs are explored | logistics |
| Computers | 9 | Factory Supervisor AI | Automated factories: +3 per colony, no workers needed | economy |
| Computers | 11 | Tactical Combat Analyzers | Fleet attack: +1 level for every ship | combat |
| Computers | 14 | Quantum Encryption | Counter-espionage: +15 | espionage |
| Computers | 19 | Universal Translator | Goodwill: +50% to every positive relation change; Trade: +15 points of efficiency | diplomacy |
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
| Construction | 19 | Damage Control Teams | Ship repair: 5% of hit points per round (better repair devices still apply) | combat |
| Construction | 21 | Battlefield Salvage | Salvage: 20% of the price of destroyed enemy ships, after battles you win | combat, economy |
| Construction | 22 | Orbital Minefields | Minefields: enemy stacks attacking your colonies lose 8% of their hit points at once | defence |
| Construction | 27 | Orbital Drydocks | Ship maintenance: −25% | economy, combat |
| Construction | 31 | Hardened Missile Silos | Missile bases: +50% hit points, −20% cost | defence |
| Construction | 32 | Siege Engineering | Bombardment: +50% damage; Invading troops: +5 | offence, ground |
| Construction | 37 | Modular Shipyards | Ship cost: −10% | economy, combat |
| Construction | 39 | Reverse Engineering Labs | Captured technology: 25% chance per battle won with enemy ships destroyed | research, combat |
| Construction | 43 | Arcology Projects | Max population: +10% on every colony (at least +5), a permanent improvement | population |
| Force Fields | 6 | Pressure Domes | Hostile worlds: +25% max population (at least +5), a permanent improvement | population |
| Force Fields | 11 | Shield Capacitors | Ship deflectors: absorb +1 per hit | combat |
| Force Fields | 17 | Repulsor Field Net | Invaders: +30% transport losses; Bombardment: −25% damage taken | defence |
| Force Fields | 23 | Flux Shields | Ship defence: +1 beam defence | combat |
| Force Fields | 25 | Stealth Landing Craft | Troop transports: losses on approach halved | offence, ground |
| Force Fields | 28 | Structural Integrity Fields | Ship hit points: +15% | combat |
| Force Fields | 33 | Phase Barrier | Planetary shields: absorb +5 per hit | defence |
| Force Fields | 35 | Gravitic Lensing Array | Scanner range: +2 parsecs | logistics |
| Force Fields | 36 | Inertial Shield Harmonics | Ship missile defence: +2 | combat |
| Force Fields | 41 | Absorption Lattice | Ship deflectors: absorb +2 per hit | combat |
| Force Fields | 48 | Planetary Stasis Field | Sieges: bombs, bio-weapons and battles never push a colony below 25% of its max population | defence |
| Planetology | 4 | Adaptive Genetics | Hostile worlds: population grows at the normal rate | population |
| Planetology | 7 | Accelerated Gestation | Population growth: +25% | population |
| Planetology | 11 | Biomass Reactors | Worker output: +10% | economy |
| Planetology | 19 | Bio-Engineered Soil | Planet projects: soil and atmosphere projects cost −33% | population |
| Planetology | 25 | Terraforming Nanites | Terraforming: −1 BC per point (at least 1) | population |
| Planetology | 28 | Small World Engineering | Small worlds: +25% max population on worlds of base size 40 or less (at least +5), permanent | population |
| Planetology | 29 | Planetary Disaster Response | Disasters: no earthquakes, comets or industrial accidents; Plague / supernova: cures and stabilisation cost half | resilience |
| Planetology | 33 | Clone Troopers | Invading troops: +10 | offence, ground |
| Planetology | 37 | Bio-Containment Fields | Bio-weapons: casualties halved; Plague: never strikes your worlds | resilience, defence |
| Planetology | 39 | Gaia Seeding | New colonies: normal worlds are founded fertile | population, expansion |
| Planetology | 43 | Hyper-Fertility Treatments | Population growth: +50% | population |
| Propulsion | 7 | Interstellar Ramscoops | Ship range: +1 parsec on top of your fuel cells | expansion, logistics |
| Propulsion | 8 | Navigation Beacons | Between your colonies: +1 warp for fleets and transports | logistics |
| Propulsion | 13 | Assault Shuttles | Troop transports: −25% losses on approach | offence, ground |
| Propulsion | 17 | Hyperspace Trade Lanes | Trade agreements: mature twice as fast, +10 points of efficiency | diplomacy, economy |
| Propulsion | 22 | Cryogenic Colony Berths | Colony ships: −25% cost | expansion |
| Propulsion | 26 | Emergency Warp Capacitors | Lost battles: 30% of the ships that would be destroyed escape | combat |
| Propulsion | 28 | Combat Thrusters | Combat speed: +1; Initiative: +2 | combat |
| Propulsion | 37 | Warp Damping Field | Hostile fleets: −2 warp within 4 parsecs of your colonies (never below 1) | defence, logistics |
| Propulsion | 39 | Lifeboat Protocols | Lost colonies: 30% of the population escapes to your nearest colony with room | resilience |
| Propulsion | 44 | Slipstream Drives | Fleet speed: +1 warp | logistics |
| Propulsion | 47 | Hyperlane Transports | Transports: +3 parsecs per turn | logistics, offence |
| Propulsion | 49 | Hyperwarp Overdrive | Fleet speed: +2 warp | logistics |
| Weapons | 3 | Point Defense Lasers | Missile interception: 20% on every ship (anti-missile devices still apply) | combat |
| Weapons | 49 | Antimatter Warheads | Missiles, torpedoes, bombs: +25% damage | combat, offence |

## How they are tested (tools/techlab, README there)

* **Combat calibration.** AI-vs-AI battles use the original's weight model, which has no term for any new combat effect. Each effect's weight bonus is
  measured in the tactical engine: real AI battles, rebalanced to an even fight, fought with the effect and with the subject's ship counts scaled; the
  ship multiplier that gives the same win rate is the effect's worth.
* **Twin trials.** Copy a game, give one empire a tech in one copy only, compare 10/25/50 turns later. All 180 classic techs go through the same trial and
  form the reference band for their level; a placebo copy (one extra random draw) measures the noise.
* **League A/B.** Whole games, classic against expanded pool, same seeds: pace, economy, endings, difficulty ladder, race strength; per tech how often it is
  dealt and researched, and whether holding it moves an empire's standing.

## Culling rules (60 → 45)

Out: overpowered outliers that tuning cannot bring into the band, duds that never matter, effects only a human can exploit, near-duplicates of a stronger
candidate, and anything that would distort a race's identity. Tuning first, cutting second: a candidate outside the band gets one retune and a re-test.
