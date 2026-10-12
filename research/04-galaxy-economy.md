# MOO1 (1993) — Galaxy, Planets, Colony Economy, Movement (research slice 04)

Target: faithful browser recreation of **Master of Orion 1 (MicroProse/SimTex, 1993)**. Everything below is MOO1 only.

## Source key and conventions

| Tag | Source | Reliability |
|---|---|---|
| **[1oom]** | 1oom-fork source (`src/game/*.c`, `game_num.c`, `game_tech.c`, `game_misc.c`, `game_turn.c`, `game_new.c`, `game_planet.c`, `game_fleet.c`, `game_event.c`, `util_math.c`, UI files). 1oom reimplements the original v1.3 executable's rules; its default ruleset also applies the "1.3a" fixes (see section 10). Read via a summarising fetch tool, so every formula was re-asked with "exact literals" prompts; the key ones were cross-checked against [SG]. | High |
| **[SG]** | *Master of Orion: Official Strategy Guide* (Emrich and Hughes, Prima/MicroProse 1993), OCR text on archive.org. Tables 3-1..3-12, 5-1..5-2, 6-1..6-3, 8-x, 14-x, 15-1, Appendices A and I. OCR has small garbles. | High, but a few printed numbers differ from the executable (flagged) |
| **[LP]** | lparchive.org "Master of Orion" Let's Play (Psilon, Large galaxy) | Medium (anecdotal, but numeric) |
| **[AI]** | "Master of Orion 1 AI analysis for eXplorminate" (archive.org) | Medium |
| **[WP]** | Wikipedia | Low detail |

StrategyWiki and the fandom wikis could not be fetched (HTTP 403/402), so nothing here depends on them.

Conventions: `rnd_1_n(n)` = uniform integer 1..n; `rnd_0_nm1(n)` = uniform 0..n-1; `/` is C integer division (truncate) unless noted; "BC" = billion credits (the currency); "pop" is in millions; `(unverified)` = single weak source; `(conflict: ...)` = sources disagree.
Difficulty index: 0 Simple, 1 Easy, 2 Average, 3 Hard, 4 Impossible. Player count 2..6 (one human + 1..5 AI). Race indices: 0 Human, 1 Mrrshan, 2 Silicoid, 3 Sakkra, 4 Psilon, 5 Alkari, 6 Klackon, 7 Bulrathi, 8 Meklar, 9 Darlok.

---

## Key numbers at a glance

- **Galaxy**: 24 / 48 / 70 / 108 stars (6x4, 8x6, 10x7, 12x9 jittered cells of 28 x 32 units); **one planet per star**; star colours Yellow 15% / Red 30% / Green 25% / Blue 15% / White 10% / Neutron 5%; 13 planet types (+ "none"); base max pop hostile 10-50, standard 30-100, +-20 chain (cap 120), 1/12 Fertile; Poor/Rich multiply ship/defence/industry output x1/3, x1/2, x2, x3 (not research/ecology); Artifacts x2 research, Orion (random star, Terran 120) x4.
- **Start**: year 2300, 1 turn = 1 year; homeworld Terran, max 100, pop 50 (40 on Hard/Impossible), 30 factories, 2 scouts + 1 colony ship (570-591 BC); supply range 3 parsecs (+3 for ships with reserve fuel tanks); planet scanner 3 parsecs; all stars visible on the map but unexplored.
- **Production**: each operating factory 1 BC (a worker runs 2 factories, up to 7 with Robotic Controls) + `pop*(3L+50)/100` BC from workers (L = Planetology level, 0.53 at start, x2 Klackon); factory cost 10 BC -> 2 BC (x oper/2); max factories = max_pop x oper.
- **Growth**: `d_pop = 0.1*pop*(1-(pop+waste)/max_pop)` per turn (hostile x1/2, fertile x1.5, Gaia x2, Sakkra x2); buy pop 20 / 10 / 5 BC each (cap 25% of pop/turn); new colony = 2 pop; terraforming +10..+120 max pop at 5..2 BC per pop; soil 150 BC (+25%), advanced soil 300 BC (+50%), atmosphere 200 BC.
- **Pollution**: 1 waste per operating factory per turn (x0.8/0.6/0.4/0.2/0 with Construction techs), cleaned at 2 / 3 / 5 / 10 / 20 units per BC; ECO slider can never drop below the "Clean" level.
- **Money**: sliders (SHIP/DEF/IND/ECO/TECH) in 4% steps per planet; upkeep 2% of cost per ship and per base per turn (stargate 100 or 300 BC); tax 0-20% of gross, only half reaches the reserve; 1 BC = 1 RP; transports cost 1 BC per pop and carry at most half a planet's pop.
- **Movement**: warp N = N parsecs/turn (a parsec step is at most 11 map units), transports warp-1 (min 1); stargates are instant between two own gates; a star is reachable only within fuel range (3, 4, 5, ... 10, unlimited) of an own/allied planet; scanner 3 / 5 / 7 / 9 parsecs; no fights in deep space.

---

## 0. What MOO1 does NOT have (do not import from MOO2 / generic 4X)

- **No food, farmers, scientists or job classes.** All population is one pool of "workers". Research is just a percentage of each planet's BC output. No housing, no morale (only rebellion events).
- **Exactly ONE planet per star.** A star's "planet" may be "no habitable planet". There are no orbits, gas giants, asteroid fields or multiple colonizable bodies. (Planet name == star name; no Roman numerals.)
- **No gravity classes, no climate axis, no planet size classes, no galaxy age setting, no "planet richness" setting.** The only new-game options are galaxy size, difficulty, number of opponents, own race and banner (+ nebulae toggle in 1oom). A planet's "size" shown in the UI **is its maximum population** (e.g. "Terran 100"); each pop icon = 10 million. [SG ch.2]
- **No natives / native planets / ancient natives.** Only: Orion (guarded by the Guardian), roaming Space Crystal/Amoeba monsters (late), pirates (event).
- **No outposts, no freighters, no starbases / battlestations / star fortresses / armor planets / orbital habitats.** Planet defence = missile bases + planetary shield only (+ stargate for movement). Colonization = colony ships (a ship design carrying a "colony base" special). Transports are not ships you build: they are population units moved for 1 BC each.
- **No special stars** other than the colour classes (Yellow, Red, Green, White, Blue, Neutron) + nebulae + Orion. No black holes, wormholes, hyperlanes.
- **No fleet interception in deep space.** Fleets move on straight lines and fight only when they are at a star (system orbit). No supply lines/lanes.
- No per-race environment preference (all races have a Terran homeworld). Only Silicoids differ (can settle everything, hostile growth rate, no pollution).

---

## 1. Galaxy generation

### 1.1 Size table

| Size | Cell grid W x H | Stars (= W*H) | Nebula count roll [1oom] | Nominal map [SG T3-2] (parsecs) | Star-centre extent in map units (derived, see 1.3) |
|---|---|---|---|---|---|
| Small | 6 x 4 | **24** | `rnd_0_nm1(2)` = 0..1 | 21 x 15 | x 14..196, y 12..158 (map ~223 x 183) |
| Medium | 8 x 6 | **48** | `rnd_1_n(3)` = 1..3 (conflict: [SG T3-3] says 1-2) | 27 x 21 | x 14..252, y 12..222 (~279 x 247) |
| Large | 10 x 7 | **70** | `rnd_1_n(2)+1` = 2..3 | 33 x 24 | x 14..308, y 12..254 (~335 x 279) |
| Huge | 12 x 9 | **108** | `rnd_1_n(3)+1` = 2..4 | 39 x 27 | x 14..364, y 12..318 (~391 x 343) |

- `PLANETS_MAX = 108`. Players 2..6. The [SG] nominal sizes equal `3*cells + 3` parsecs per axis (Huge vertical printed as 27, formula would give 30) and include "a 1-parsec empty border". Stars per player e.g. Medium/4 players = 12.
- [SG] Table 3-12a/b (average counts by size, OCR) is reproduced in 1.14.

### 1.2 Coordinates and the two distance metrics

All positions are integer map units (x right, y down).

1. **`dist_fast(dx,dy)`** = `max(|dx|,|dy|) + min(|dx|,|dy|)/2` (integer). Used for star spacing, homeworld checks, planet-vs-fleet scanner radii, advanced-scanner exploration. Roughly 10 units = 1 parsec in these uses. [1oom util_math.c]
2. **Parsec distance between two stars ("steps")**, stored once in `star_dist[i][j]` (uint8, symmetric): start at A; repeat { move up to 5 units toward B along the (angle-quantised) line; if not yet at B, move up to 6 units; count++ } until at B. **One parsec is therefore one 5+6 double-step: at most 11 map units** (exactly 11 along an axis, about 9.8-10.3 units on diagonals because each axis displacement is truncated). Used for fuel/supply range, planet scanner range, contact, ETA, and the "N parsecs" shown on the map. Movement itself uses the identical stepping (see 5.2), so **for open-space travel `ETA turns = ceil(star_dist / speed)` exactly.**
   - The conversion is direction dependent: [AI] reports "about 10 units per parsec but not reliable", e.g. a pair at `dist_fast` 48 is 6 parsecs, another at `dist_fast` 101 is 9 parsecs. `ceil(euclid/11)` can be 1-2 parsecs short, so replicate the loop if range/ETA fidelity matters.
   - `go_line_dist(x,y,x1,y1,dist)`: if at target return; `dx=x1-x, dy=y1-y`; if `|dx|>255 or |dy|>255` halve both (truncate); `a = calc_angle(dx,dy)` (integer degrees 0..360: largest whole degree whose `floor(256*tan(deg))` table value is <= `floor(256*|dy|/|dx|)`, quadrant-folded; angle 0 = +x, 90 = +y; the first-octant tables are `tan` for 0-21, 22-44, 45-66, 67-89 degrees); `x += trunc(dist*cos_tbl[a]/65536)`, `y += trunc(dist*sin_tbl[a]/65536)` (tables `floor(65536*cos(deg))`, `floor(65536*sin(deg))`, with angle folded into 0..90 and sign restored; cos(0)=sin(90)=dist exactly), then clamp so neither coordinate passes the target. The angle is recomputed from the remaining vector on every call. [1oom util_math.c]
   - The code of `calc_angle_do` has small off-by-one quirks at some octant ends (e.g. returns 43 instead of 44 for the last 22-45 degree bucket); an implementation using `floor(atan2)` degrees will differ only on rare pairs.
3. Fleet scanning in `game_check_coord_is_visible` uses `dist_fast <= range_parsecs*10`.

### 1.3 Star placement (cell + jitter, with spacing rejection) [1oom game_generate_planets]

```
for h in 0..H-1: for w in 0..W-1:                     // row-major; index idx = h*W + w
  again:
    x = rnd_1_n(43) + 28*w + 9
    y = rnd_1_n(51) + 32*h + 7
    for each earlier star i (0..idx-1):
        if (px[i] < x) or (py[i] < y):  if dist_fast(px[i],py[i],x,y) < 20: goto again
        else:                           if dist_fast(px[i],py[i],x,y) < 10: goto again
    px[idx]=x; py[idx]=y
star.x = px + 4;  star.y = py + 4          // => x in [14+28w, 56+28w], y in [12+32h, 62+32h]
```
- Cells are 28 x 32 units but jitter ranges (43, 51) are larger, so neighbours overlap; the check makes the effective minimum separation ~20 `dist_fast` units (~2 parsecs), 10 only when the earlier star is down-right of the new one.
- After all stars exist: `galaxy_maxx = max(star.x) + 27`, `galaxy_maxy = max(star.y) + 25` (map bounds; the galaxy has an empty margin).
- Before placement (used only to position nebulae): `galaxy_maxx0 = (W-1)*28 + 20`, `galaxy_maxy0 = (H-1)*32 + 16`.
- [SG] description: "stars are placed using a spacing formula that keeps them from clustering"; map has an empty 1-parsec border.

### 1.4 Star colours [1oom roll `rnd_0_nm1(20)`; matches SG T3-4]

| Roll | Colour | Share | Non-hostile planet chance (type >= Minimal), not in nebula |
|---|---|---|---|
| 0,1,2 | **Yellow** | 15% | 85% |
| 3-8 | **Red** | 30% | 65% |
| 9-13 | **Green** | 25% | 65% |
| 14-16 | **Blue** | 15% | 25% |
| 17-18 | **White** | 10% | 35% |
| 19 | **Neutron** (shown purple) | 5% | 5% |

- Overall ~56% of stars have a non-hostile (colonizable-without-special-tech) planet; ~7% have "no habitable planet".
- Each **homeworld star is converted to Yellow** after placement (so Yellow counts run above 15%). A star inside a nebula loses 20 percentage points of non-hostile chance. [SG]
- Star "description" strings (UI): Yellow = best chance of terran/sub-terran planets; Red = old dull stars, commonly poor planets; Green = moderately bright, wide range of planet types; White = very hot, generally hostile planets; Blue = young, mineral-rich lifeless planets; Neutron = rare, greatest chance of rich planets.
- Purely cosmetic per-star values: `look = rnd_0_nm1(2)*6` (sprite variant), `frame = rnd_0_nm1(50)` (animation offset), one discarded `rnd_0_nm1(4)`.

### 1.5 Per-star generation order (RNG order matters only for exact seed compatibility)

```
1  star_type   = rnd_0_nm1(20)  -> colour (1.4)
2  look, frame, discard (above)
3  in_nebula   = star (x,y) inside any rectangle of any nebula (1.10)
4  r = rnd_1_n(20) - (in_nebula ? 4 : 0);  type = TABLE[star_colour][r]   (1.6)   // unlisted r => NO PLANET
5  max_pop base from type (1.7); then +-20 loop; cap 120
6  battlebg = in_nebula ? 0 : rnd_1_n(4)      (combat backdrop id)
7  special = NORMAL; poor/ultra-poor roll (types >= Steppe), rich/ultra-rich rolls, artifacts roll (1.8)
8  rocks (1.9);  growth: type < Minimal -> HOSTILE; else if type > Desert and rnd_1_n(12)==1 -> FERTILE (+25%)
9  if type == NO PLANET: growth=NORMAL, special=NORMAL (max_pop 10)
10 defaults: pop_oper_fact=2, slider[INDUSTRY]=100, owner/prev_owner/claim=none
11 graphic variant infogfx = table[type][rnd_0_nm1(6)]-1  (6 sprite variants per type)
after the loop: Orion star = rnd_0_nm1(stars)  (1.11)
```

### 1.6 Planet type by star colour (roll r = d20, minus 4 inside a nebula) [1oom game_generate_planets; verified against SG T3-5a/b]

Planet type enum (also the sort order used by the code): `0 NO PLANET, 1 Radiated, 2 Toxic, 3 Inferno, 4 Dead, 5 Tundra, 6 Barren, 7 Minimal, 8 Desert, 9 Steppe, 10 Arid, 11 Ocean, 12 Jungle, 13 Terran` (the UI label table also has a 14th display label "GAIA" used when growth==Gaia). **Hostile = types 1..6; standard = 7..13.**

Roll ranges (r = 1..20 normal; in a nebula use r-4, i.e. values -3..16; any r not listed = NO PLANET):

| Colour | Roll ranges -> type |
|---|---|
| **Yellow** | r<=0: (-1 Radiated, 0 Toxic, nebula only) 1 Inferno; 2 Tundra; 3 Barren; 4 Minimal; 5 Desert; 6 Steppe; 7-8 Arid; 9-10 Ocean; 11-12 Jungle; 13-20 Terran |
| **Red** | 2 Radiated; 3 Toxic; 4 Inferno; 5 Dead; 6 Tundra; 7 Barren; 8 Minimal; 9-10 Desert; 11-12 Steppe; 13-15 Arid; 16-17 Ocean; 18-19 Jungle; 20 Terran (1 = none) |
| **Green** | 2 Radiated; 3 Toxic; 4 Inferno; 5 Dead; 6 Tundra; 7 Barren; 8 Minimal; 9 Desert; 10-11 Steppe; 12-13 Arid; 14-15 Ocean; 16-17 Jungle; 18-20 Terran (1 = none) |
| **White** | 3 Radiated; 4-5 Toxic; 6-7 Inferno; 8-9 Dead; 10-11 Tundra; 12-13 Barren; 14-15 Minimal; 16-17 Desert; 18 Steppe; 19 Arid; 20 Ocean (1-2 = none) |
| **Blue** | 4-5 Radiated; 6-7 Toxic; 8-9 Inferno; 10-11 Dead; 12-13 Tundra; 14-15 Barren; 16-17 Minimal; 18 Desert; 19 Steppe; 20 Arid (1-3 = none) |
| **Neutron** | 5-9 Radiated; 10-12 Toxic; 13-15 Inferno; 16-17 Dead; 18 Tundra; 19 Barren; 20 Minimal (1-4 = none) |

Resulting percentages, **normal space** (matches [SG] Table 3-5a; the OCR of White/Desert dropped 5 points):

| Type | Red | Green | Yellow | Blue | White | Neutron |
|---|---|---|---|---|---|---|
| none | 5 | 5 | 0 | 15 | 10 | 20 |
| Radiated | 5 | 5 | 0 | 10 | 5 | 25 |
| Toxic | 5 | 5 | 0 | 10 | 10 | 15 |
| Inferno | 5 | 5 | 5 | 10 | 10 | 15 |
| Dead | 5 | 5 | 0 | 10 | 10 | 10 |
| Tundra | 5 | 5 | 5 | 10 | 10 | 5 |
| Barren | 5 | 5 | 5 | 10 | 10 | 5 |
| Minimal | 5 | 5 | 5 | 10 | 10 | 5 |
| Desert | 10 | 5 | 5 | 5 | 10 | 0 |
| Steppe | 10 | 10 | 5 | 5 | 5 | 0 |
| Arid | 15 | 10 | 10 | 5 | 5 | 0 |
| Ocean | 10 | 10 | 10 | 0 | 5 | 0 |
| Jungle | 10 | 10 | 10 | 0 | 0 | 0 |
| Terran | 5 | 15 | 40 | 0 | 0 | 0 |

**Inside a nebula** ([SG] T3-5b, derived by the -4 shift; top 4 rolls become unreachable): none 25/25/10/35/30/40 (Red/Green/Yellow/Blue/White/Neutron); Terran 0/0/20/0/0/0; Yellow keeps Radiated 5 and Toxic 5 (the r'=-1,0 slots).

### 1.7 Maximum population (= "planet size")

Base value by type (uniform among the listed multiples of 5):

| Type | Base range | # values |
|---|---|---|
| NO PLANET | 10 (fixed, not rolled) | - |
| Radiated, Toxic, Inferno | `rnd_1_n(7)*5+5` = 10..40 | 7 |
| Dead, Tundra | `rnd_1_n(7)*5+15` = 20..50 | 7 |
| Barren, Minimal | `rnd_1_n(5)*5+25` = 30..50 | 5 |
| Desert | `rnd_1_n(4)*5+30+0` = 35..50 | 4 |
| Steppe | +10 -> 45..60 | 4 |
| Arid | +20 -> 55..70 | 4 |
| Ocean | +30 -> 65..80 | 4 |
| Jungle | `rnd_1_n(4)*5+70` = 75..90 | 4 |
| Terran | `rnd_1_n(4)*5+80` = 85..100 | 4 |

**Adjustment loop** (20% chance to trigger, repeats): `d = rnd_1_n(10); while d==1 or d==10 { if d==1: pop -= 20 else pop += 20; pop = max(pop,10); d = rnd_1_n(10) }; pop = min(pop,120)`. So P(-20)=P(+20)=10% each iteration, chain continues with the same 20%. (conflict: [SG T3-6 text] says bounded 10..140 base; [1oom] clamps to **120**. Orion base is 120.)

Result stored as `max_pop1 = max_pop2 = max_pop3` (see section 2 for what each means). Natural **Fertile** planets (type > Desert, i.e. Steppe..Terran, 1/12 chance): `max_pop += (max_pop/20)*5` (integer, i.e. about +25% rounded DOWN to a multiple of 5) and growth class = Fertile. (conflict: [SG] says "+25% rounded up to 5".)

### 1.8 Mineral richness ("special"), artifacts, fertile

`special` enum: `0 UltraPoor, 1 Poor, 2 Normal, 3 Artifacts, 4 Rich, 5 UltraRich, 6 4XTech (Orion only)`.

```
let T = type index (1..13), S = star colour
// POOR / ULTRA-POOR : only if T >= Steppe(9)
  m = (S==Red ? 4 : S==Green ? 2 : 0)
  d1 = rnd_1_n(20) - m ; if d1 <= 2 -> POOR
  d2 = rnd_1_n(20) - m ; if d2 <= 5 and special==POOR -> ULTRA_POOR       // d2 always rolled
// RICH / ULTRA-RICH : all types
  n = (nebula ? 8 : 0) + (S==Blue ? 2 : S==Neutron ? 5 : 0)
  d3 = rnd_1_n(20) - n ; if (9 - T) > d3 -> RICH            // overwrites Poor
  d4 = rnd_1_n(20) - n ; if d4 < 6 and special==RICH -> ULTRA_RICH
// ARTIFACTS
  if Minimal(7) <= T <= Ocean(11) and special==NORMAL and rnd_1_n(10)==1 -> ARTIFACTS
```
Probabilities (closed form): P(poor total | T>=Steppe) = `(2+m)/20` => Yellow/Blue/White/Neutron 10%, Green 20%, Red 30%; P(ultra | poor) = `(5+m)/20` => 25% / 35% (Green) / 45% (Red). P(rich) = `clamp(8 - T + n, 0, 20)/20`; P(ultra | rich) = `min(20, 5+n)/20`.
[SG] Table 3-9a (non-nebula, Red/Green/White/Yellow columns): Radiated 26.25 rich + 8.75 ultra (=35% total), Toxic 22.5+7.5, Inferno 18.75+6.25, Dead 15+5, Tundra 11.25+3.75, Barren 7.5+2.5, Minimal 3.75+1.25, Desert and above 0. Blue: Radiated 29.25+15.75 ... Minimal 9.75+5.25, Desert 6.5+3.5, Steppe 3.25+1.75. Neutron: Radiated 30+30 ... Minimal 15+15. In nebulas (T3-9b) e.g. Radiated Red/Green/White 26.25 rich + 48.75 ultra; Terran 5.25+9.75. All match the formula.
[SG T3-8] poor/ultra-poor by star: Blue/White/Yellow 7.5/2.5 %, Neutron 0 (no Steppe+ planets), Red/Green printed 14/6 and 16.5/13.5 (OCR rows look swapped; code gives Red 16.5/13.5, Green 13/7).
- **Artifacts**: planet with no poor/rich special has ~10% chance (types Minimal..Ocean only). Effect: x2 research from that planet; first empire to explore it with a **ship in orbit** (not by scanner) gets a loot roll (see 3.9).
- **Orion** is the only 4XTech planet (x4 research).
- Typical expected counts per galaxy: see 1.14.

### 1.9 Rocks / asteroids (tactical combat terrain only; no economic effect)

`d = rnd_1_n(100); if UltraRich d-=20 elif Rich d-=10; d -= (15 - T)`; `MANY if d <= 15 (1oom text shows < 15), SOME if d <= 40, else NONE`. [SG T3-10] percentages (None/Low/High): Normal planet Radiated 46/25/29 -> Terran 58/25/17 (High -1 per type step); Rich: 36/25/39 ... 48/25/27; UltraRich: 26/25/49 ... 38/25/37. Low density = 1-5 asteroid squares in battle, high = 3-7; never in the planet column +-1 or deployment rows. Battle grid is 10 wide x 8 high. (battlebg 0 = nebula backdrop, 1..4 = normal backdrops.)

### 1.10 Nebulae

- Count per 1.1; option `nebulae` (on by default). Each is the union of 4 rectangles from a 10-entry table; placement: `type = rnd_0_nm1(10); ox = rnd_1_n(galaxy_maxx0-70)+4; oy = rnd_1_n(galaxy_maxy0-70)+4`; reject if same type as an earlier nebula or `|ox-ox_j|<60 and |oy-oy_j|<60`; give up after 200 attempts (1oom quirk: then restarts with the count placed so far). [1oom]
- Rectangles are **inclusive offsets from (ox,oy)**; stored as (x0,y0)-(x1,y1) for pieces 0..3 (decimal, converted from the table `tbl_nebula_data[type][row][piece]`, row0=x0, row1=y0, row2=x1, row3=y1):

| Type | piece 0 | piece 1 | piece 2 | piece 3 |
|---|---|---|---|---|
| 0 | (20,5)-(40,20) | (7,18)-(28,39) | (15,12)-(31,27) | (31,2)-(36,4) |
| 1 | (10,17)-(26,37) | (20,13)-(38,24) | (27,13)-(41,16) | (30,5)-(41,16) |
| 2 | (9,2)-(22,25) | (3,8)-(25,21) | (23,18)-(41,32) | (26,15)-(35,36) |
| 3 | (25,12)-(30,28) | (8,15)-(28,29) | (10,9)-(22,15) | (16,7)-(23,9) |
| 4 | (7,2)-(25,19) | (15,15)-(37,28) | (21,22)-(41,35) | (25,35)-(41,39) |
| 5 | (3,14)-(35,20) | (8,21)-(36,35) | (14,2)-(26,31) | (9,10)-(34,15) |
| 6 | (13,3)-(27,33) | (9,11)-(34,32) | (19,33)-(27,37) | (5,22)-(8,30) |
| 7 | (8,8)-(37,25) | (15,24)-(34,31) | (28,2)-(35,7) | (37,10)-(39,18) |
| 8 | (8,6)-(35,31) | (5,1)-(12,8) | (5,12)-(9,21) | (27,3)-(37,10) |
| 9 | (4,2)-(42,18) | (8,18)-(38,30) | (13,14)-(38,33) | (37,17)-(41,29) |

  (each nebula ~40 x 40 units ~ 4 parsecs across; [SG] says "about 5 x 5 parsecs".)
- **Effects of a star being inside a nebula**: planet-type roll shifted -4 (more hostile / none); rich roll shifted -8 (many more Rich/UltraRich, [SG T3-9b]); battle backdrop = nebula; **planetary shields cannot be built** there (DEF slider skips the shield step); ship **shields are disabled in combat** [SG]; **ship movement is slowed** (see 5.2; [SG] claims "1 parsec/turn", [1oom] code gives `6N+5` map units/turn for a warp-N fleet and `5N` for a transport, i.e. about 55% / 45% of normal speed for large N — conflict). Entering/leaving/skirting the edge uses partial speed because the test is evaluated every movement sub-step.
- Monsters ignore nebulae (no nebula check).

### 1.11 Orion and the Guardian

- `Orion star = rnd_0_nm1(stars)` — any star, uniform, chosen after all other planets; forced to **Terran, max_pop 120, growth Normal, special 4XTech**; planet name "Orion"; excluded from homeworld candidates; always labelled on the map. [1oom, SG]
- `have_guardian = true` at start. The **Guardian** monster sits at Orion: HP 6000/7000/8000/9000/10000 (Simple..Impossible), shield + beam defense + missile defense 5/6/7/8/9, attack level 10, 2 squares/turn in combat; weapons Scatter Pack X (5/25/45/65/85), Stellar Converters (5/15/25/35/45), Plasma Torpedoes (6/9/12/15/18), High Energy Focus, Lightning shields, Death Ray; Hard adds Automated Repair, Impossible Advanced Damage Control. [SG ch.15] Killing it: **Death Ray tech always + up to 3 random techs** (field level capped at `min(field_level+25,50)`, tech ids 20..50). [1oom/SG]
- While the Guardian lives, 1oom clears every empire's ships orbiting Orion right after the battle/research steps of the turn (section 7; a source comment says this may be redundant with the battle code), so nobody can park a fleet there.
- Once colonized, the Orion planet's research output is multiplied x4 (Psilons x1.5 on top = x6, [SG ch.13]). Controlling Orion also sways council votes (+20% in favour, [SG T4-1]).
- AI ignores Orion until turn 121 (colony wishlist) / 150 (scouting) [AI].

### 1.12 Homeworld selection and starting state

**Classic (original) algorithm** [1oom game_generate_home_do]: up to 200 outer attempts; for each player `i` pick a candidate planet: if stars > 24: `idx = rnd_1_n(W-2) + rnd_1_n(H-2)*W` (interior cell, i.e. never in the outer ring of cells = "not on a map edge"); else if players > 3: `rnd_0_nm1(stars)`; else interior formula; must differ from earlier homeworlds and from Orion. Then, **only for the first two players (human = player 0 and AI player 1)** require: distance to every other homeworld >= **80** (`dist_fast`, ~7-8 parsecs); nearest planet of type >= Minimal (excluding Orion, itself) within **29** units (~2.6 parsecs); (the "any planet within 29" test is implied). If 200 attempts fail the whole galaxy is regenerated. Players 3..6 are not checked (original quirk; [AI] confirms).
[SG T3 "Starting Locations"] states the rules for all players: not on a map edge; at least one other star (not Orion) within 4 parsecs; at least two within 6; at least 6 parsecs from any other home star. (1oom "improved" option, not original: randomized backtracking over all players, homeworld spacing 80 (70 for some small-map cases; my two reads of the code disagree on the exact player-count condition), neighbour-habitable test radius 29.)

**Homeworld contents** (all races identical): star **Yellow**, planet **Terran**, `max_pop1=max_pop2=max_pop3 = 100` (config 50..120), growth Normal, special Normal, `owner=claim=player`, explored; name = race home name: Human **Sol**, Mrrshan **Fierias**, Silicoid **Cryslon**, Sakkra **Sssla**, Psilon **Mentar**, Alkari **Altair**, Klackon **Kholdan**, Bulrathi **Ursa**, Meklar **Meklon**, Darlok **Nazin**.
Start values by difficulty: **pop 50 (Simple/Easy/Average) or 40 (Hard/Impossible)** [LP: "20% penalty"], **factories 30**, displayed production 55 (50 on Hard/Impossible; real value recomputed each turn, see 3.2), `pop_oper_fact=2`, `slider[INDUSTRY]=100` (then ECO is auto-raised to the waste level on game start), no missile bases, tax 0, security 0, reserve 0 (unset => 0; unverified).
There is no per-player "neutral star" allocation: every non-home star (`stars - players - 1 Orion`) is simply unowned and free for the first colony ship to arrive. At start a player only owns the home star; whether anything else is nearby follows from the homeworld rule (a habitable planet within ~29 units for players 0/1). Derived density: about one star per 28 x 32 = 896 square units, so the starting 3-parsec colony range (~30-33 units) typically covers 3-4 other stars and the scouts' 6 parsecs about 10-15 ([LP]: ten systems within 6 parsecs).
Start fleet: **2 scouts + 1 colony ship** (options in 1oom: scouts 0..5 default 2, fighters 0..10 default 0, colony ships 0..2 default 1). All at warp 1.
Start techs: every field has 1 tech ("level 1"): base shield Class I, computer Mark I, weapon Nuclear Missile (2-rack); Reserve Fuel Tanks (CN 1), Retro Engines (PR 1), Battle Scanner (CO 1), Ecological Restoration (PL 1), Class I Deflector (FF 1), Lasers/Nuclear (WE 1). Research lists are random: each tier lists up to 3 techs, each candidate kept with prob 2/4 (3/4 Psilon); lists must contain at least one planetary shield, one robotic-controls tech, one missile and Hydrogen or Deuterium fuel cells. Human default research sliders: Computer 20, Construction 10, Force Field 15, Planetology 15, Propulsion 20, Weapon 20.
Start year: **2300**, each turn = 1 year [SG ch.2 tutorial]; internal `year` starts at 1 and the UI prints `year + YEAR_BASE` (YEAR_BASE = 2299 is inferred, not read). Random events begin after internal year 40 (see 3.13), the first council vote at 2/3 of stars colonized then every 25 years.

### 1.13 Names

- Each star gets one name drawn **without replacement** (rejection sampling) from the first 108 entries of a 110-entry table; the Orion star is then renamed "Orion"; homeworlds use the race home name (above). The planet *is* the star, so there are no ordinals.
- Table (index: name): 0 Paranar, 1 Denubius, 2 Antares, 3 Draconis, 4 Zoctan, 5 Rigel, 6 Talas, 7 Moro, 8 Quayal, 9 Neptunus, 10 Jinga, 11 Argus, 12 Escalon, 13 Berel, 14 Collassa, 15 Whynil, 16 Nordia, 17 Tau Cygni, 18 Phyco, 19 Firma, 20 Keeta, 21 Arietis, 22 Rhilus, 23 Willow, 24 Mu Delphi, 25 Stalaz, 26 Gorra, 27 Beta Ceti, 28 Spica, 29 Omicron, 30 Rha, 31 Kailis, 32 Vulcan, 33 Centauri, 34 Herculis, 35 Endoria, 36 Kulthos, 37 Hyboria, 38 Zhardan, 39 Yarrow, 40 Incedius, 41 Paladia, 42 Romulas, 43 Galos, 44 Uxmai, 45 Thrax, 46 Laan, 47 Imra, 48 Selia, 49 Seidon, 50 Tao, 51 Rana, 52 Vox, 53 Maalor, 54 Xudax, 55 Helos, 56 Crypto, 57 Gion, 58 Phantos, 59 Reticuli, 60 Maretta, 61 Toranor, 62 Exis, 63 Tyr, 64 Ajax, 65 Obaca, 66 Dolz, 67 Drakka, 68 Ryoun, 69 Vega, 70 Anraq, 71 Gienah, 72 Rotan, 73 Proxima, 74 Mobas, 75 Iranha, 76 Celtsi, 77 Dunatis, 78 Morrig, 79 Primodius, 80 Nyarl, 81 Ukko, 82 Crius, 83 Hyades, 84 Kronos, 85 Guradas, 86 Rayden, 87 Kakata, 88 Misha, 89 Xendalla, 90 Artemis, 91 Aurora, 92 Proteus, 93 Esper, 94 Darrian, 95 Trax, 96 Xengara, 97 Nitzer, 98 Simius, 99 Bootis, 100 Pollus, 101 Cygni, 102 Aquilae, 103 Volantis, 104 Tauri, 105 Regulus, 106 Klystron, 107 Lyae, 108 Capella, 109 Alcor. (Names 108/109 are beyond `PLANETS_MAX`; unverified whether unused in the original.) Names are max 12 characters.

### 1.14 Expected content per galaxy ([SG] T3-12a/b averages; Orion and 1 home world per player are converted to Terran/Yellow)

| Star colour | Huge | Large | Medium | Small |
|---|---|---|---|---|
| Red | 32-33 | 21 | 14-15 | 7 |
| Green | 27 | 17-18 | 12 | 6 |
| Yellow* | 16 | 10-11 | 7 | 3-4 |
| Blue | 16 | 10-11 | 7 | 3-4 |
| White | 11 | 7 | 5 | 2-3 |
| Neutron | 5-6 | 3-4 | 2-3 | 1 |

| Planet type | Huge | Large | Medium | Small |
|---|---|---|---|---|
| none | 8-9 | 5-6 | 4 | 2 |
| Radiated / Toxic | 6-7 | 4 | 3 | 1-2 |
| Inferno | 7 | 5 | 3 | 1-2 |
| Dead | 6 | 4 | 3 | 1-2 |
| Tundra / Barren / Minimal / Desert | 7 | 4-5 | 3 | 1-2 |
| Steppe | 8 | 5 | 3 | 2 |
| Arid | 10-11 | 7 | 4-5 | 2-3 |
| Ocean | 8 | 5 | 3 | 2 |
| Jungle | 7-8 | 5 | 3 | 1-2 |
| Terran | 12 | 7-8 | 5 | 2-3 |
| Orion | 1 | 1 | 1 | 1 |
| Artifacts | 3-4 | 2 | 1-2 | 1 |
| UltraRich / Rich | 4-5 / 8 | 3 / 5 | 2 / 3-4 | 1 / 2 |
| Poor / UltraPoor | 6 / 3-4 | 4 / 2 | 2-3 / 1-2 | 1 / 1 |
| Stars in nebulae | 4 | 3 | 2 | 1 |

(* Yellow high because home worlds are converted.)

### 1.15 What the player knows / sees at start (fog of war) [1oom UI]

- **All stars are drawn on the map from turn 1** (icon chosen by star colour) at their true positions, no "?" markers. What is *not* known: planet type, specials, pop, name (for unowned stars), until the star is **explored**.
- `explored[player][star]` is set when the player has a ship in orbit at the star (any ship), or (with the **Advanced Space Scanner**, Computer tech 23) automatically for every star within **110 map units (`dist_fast`)** of any of the player's planets (no artifact loot in that case). Home star explored at start. Unexplored star panel shows "unexplored" + the star-colour description.
- `within_srange` = star is within the empire's **planet scanner range** (parsecs, via `star_dist`) of one of the player's **own** planets (allied planets count for fuel range but not for scanner range): then current owner/pop/missile bases and ships in orbit are visible; otherwise the last-seen report (`seen[]`) is shown. Orion's name/owner label always shows. Unowned unexplored stars show no name/type text on the map (unverified for the original).
- Each star shows the parsec distance to the nearest own planet (DISTANCE view); the "out of range" test uses fuel range (5.3).
- Contact with an empire is automatic once either empire's colony is within the **larger** of the two empires' fuel ranges of the other's colony.

---

## 2. Planet environment model

### 2.1 Planet types (the only "environment" axis; there is no separate climate or size class)

| # | Type | Class | Base max pop (before +-20 chain) | Tech needed so a colony ship can settle it | Colony base used (cost BC) | Atmospheric Terraforming result |
|---|---|---|---|---|---|---|
| 1 | Radiated | hostile | 10-40 | PL 18 Controlled Radiated Environment | Radiated 500 | -> Minimal, base +20 |
| 2 | Toxic | hostile | 10-40 | PL 15 Controlled Toxic Environment | Toxic 475 | -> Minimal, +20 |
| 3 | Inferno | hostile | 10-40 | PL 12 Controlled Inferno Environment | Inferno 450 | -> Minimal, +20 |
| 4 | Dead | hostile | 20-50 | PL 9 Controlled Dead Environment | Dead 425 | -> Minimal, +10 |
| 5 | Tundra | hostile | 20-50 | PL 6 Controlled Tundra Environment | Tundra 400 | -> Minimal, +10 |
| 6 | Barren | hostile | 30-50 | PL 3 Controlled Barren Environment | Barren 375 | -> Minimal, +0 |
| 7 | Minimal | standard | 30-50 | none (start) | Standard 350 | n/a |
| 8 | Desert | standard | 35-50 | none | Standard | n/a |
| 9 | Steppe | standard | 45-60 | none | Standard | n/a |
| 10 | Arid | standard | 55-70 | none | Standard | n/a |
| 11 | Ocean | standard | 65-80 | none | Standard | n/a |
| 12 | Jungle | standard | 75-90 | none | Standard | n/a |
| 13 | Terran | standard | 85-100 | none | Standard | n/a |
| 0 | "No habitable planets" | - | 10 (unusable) | cannot be colonized | - | - |

- A ship carries exactly **one** colony-base special. A planet is colonizable by a colony ship iff `planet.type >= base_min_type` with Standard=Minimal(7), Barren=6, Tundra=5, Dead=4, Inferno=3, Toxic=2, Radiated=1; the empire value `have_colony_for` = the lowest type allowed by its researched PL techs (3,6,9,12,15,18 give Barren..Radiated; start = Minimal). **Silicoids always have `have_colony_for = Radiated`** (all types) from turn 1 and cannot research the Controlled-environment techs. [1oom game_update_tech_util, uistarmap_trans]
- Colony base specials are listed in the ship-special table with costs `3500..5000` (BC x10) and space 700 for every hull; so a colony ship needs a **Large or Huge hull**. [1oom game_shiptech.c; SG ch.9]
- [SG] ranks the habitable list by max population: Terran > Jungle > Ocean > Arid > Steppe > Desert > Minimal > Barren > ...; "within a type size varies randomly, but larger is always better".

### 2.2 Growth class ("environment" label)

`planet.growth` in {HOSTILE, NORMAL, FERTILE, GAIA}; UI labels `HOSTILE / (blank) / FERTILE / GAIA`.
- Types 1..6 are generated HOSTILE; types 7..13 NORMAL, with 1/12 chance of FERTILE for types 9..13 (and the +25% max-pop bonus of 1.7).
- Becomes FERTILE through **Soil Enrichment** (PL 16, 150 BC one-time, only on NORMAL planets, not Silicoid); GAIA through **Advanced Soil Enrichment** (PL 30, 300 BC, on NORMAL or FERTILE planets, not Silicoid); HOSTILE -> NORMAL (type becomes Minimal) through **Atmospheric Terraforming** (PL 22, 200 BC, hostile planets, not Silicoid). A planet destroyed by a comet becomes "no planet". Random events can also make a planet Fertile ("Fertile Planet" event) or reset to radiated hostile (nova/accident/amoeba).
- Growth multiplier on the logistic growth term (see 3.7): HOSTILE x1/2 (if the term is negative, x2), NORMAL x1, FERTILE x1.5 (negative: x2/3), GAIA x2 (negative: x1/2); Sakkra x2 more; Silicoid ignores the class and always uses the halved term without pollution.

### 2.3 Maximum population variables (per planet)

- `max_pop1` = natural base size (type base + adjustment chain + natural-fertile bonus; +atmosphere increments). 
- `max_pop2` = base plus soil enrichment bonus (`max_pop1 + inc`).
- `max_pop3` = **current maximum population** = `max_pop2` + terraforming increments bought so far (`0 <= max_pop3 - max_pop2 <= terraform level`), capped at **300**. The UI shows `max(10, max_pop3 - waste)` (Silicoid: no subtraction), with "+" if more terraforming is possible.
- **Soil enrichment increment** (intended rule [SG]: Fertile +25% of `max_pop1`, rounded UP to a multiple of 5, min 5; Gaia +50% of `max_pop1` rounded UP to a multiple of 5, replacing the Fertile bonus, i.e. Gaia total, not added on top): `max_pop2 = max_pop1 + inc`; `max_pop3 += (new max_pop2 - old max_pop2)`; then (original rule, flag `reset_tform_to_max` = true) `max_pop3 = min(max_pop3, terraform_level + max_pop2)`; then `min(.,300)`.
  - Original-executable quirk [1oom]: `inc = (m/20)*5 + (((m/20)%5 != 0) ? 5 : 0)` (Fertile) and `(m/10)*5 + (((m/10)%5 != 0) ? 5 : 0)` (Gaia), min 5. Differences from the intended rule appear for many bases m. Fertile: m=20 gives 10 (intended 5), 40 -> 15 (10), 60 -> 20 (15), 80 -> 25 (20), 105-115 -> 25 (30), 120 -> 35 (30). Gaia: m=55 -> 25 (30), 60 -> 35 (30), 70 -> 40 (35), 80 -> 45 (40), 90 -> 50 (45), 105 -> 50 (55). 1oom flag `soil_rounding_fix` selects the `ceil` behaviour. Recommend the intended rule (a 25%/50% bonus rounded up to a multiple of 5).
  - Examples: base 100 -> Fertile +25, Gaia +50; base 70 -> +20 / +35; base 45 -> +15 / +25 (ceil(22.5)); base 30 -> +10 / +15.
- **Potential maximum population by type** (derived, intended rounding, ignoring the +-20 chain; terraform level +120 = Complete Terraforming; hard cap 300):

| Type | Base | Atmospheric (hostile only) | + Gaia (+50% of the new base, ceil to 5) | + Terraform 120 |
|---|---|---|---|---|
| Radiated / Toxic / Inferno | 10-40 | 30-60 | 45-90 | **165-210** (hostile with no atmosphere tech: 130-160) |
| Dead / Tundra | 20-50 | 30-60 | 45-90 | **165-210** (hostile: 140-170) |
| Barren | 30-50 | 30-50 (no gain) | 45-75 | **165-195** (hostile: 150-170) |
| Minimal | 30-50 | - | 45-75 | 165-195 |
| Desert | 35-50 | - | 55-75 | 175-195 |
| Steppe | 45-60 | - | 70-90 | 190-210 |
| Arid | 55-70 | - | 85-105 | 205-225 |
| Ocean | 65-80 | - | 100-120 | 220-240 |
| Jungle | 75-90 | - | 115-135 | 235-255 |
| Terran | 85-100 | - | 130-150 | 250-270 (Orion: 120 -> 180 -> 300 cap) |

  Intermediate steps: Fertile (Soil Enrichment) gives +25% of the base instead of +50%; terraforming levels +10/+20/.../+100 add that much to `max_pop3` before the next level is reached.
- **Atmospheric terraforming**: `inc = 20 if type in {Radiated,Toxic,Inferno}; 10 if type in {Dead,Tundra}; 0 if Barren`; `type = Minimal`, `max_pop1,2,3 += inc`, `growth = NORMAL`. [SG example: Radiated base 25 -> Minimal 45 -> Gaia +25 -> 70 -> +120 terraforming = 190 potential.]
- **Terraforming increments**: each +1 to `max_pop3` costs `terraform_cost_per_inc` BC, bought through the ECOLOGY slider (label "T-FORM"), up to `max_pop2 + level`:

| Tech (PL id) | Name | Level (+max pop) | BC per +1 pop |
|---|---|---|---|
| 2 | Improved Terraforming +10 | 10 | 5 |
| 8 | +20 | 20 | 5 |
| 14 | +30 | 30 | 4 |
| 20 | +40 | 40 | 4 |
| 26 | +50 | 50 | 3 |
| 32 | +60 | 60 | 3 |
| 38 | +80 | 80 | 2 |
| 44 | +100 | 100 | 2 |
| 50 | Complete Terraforming | 120 | 2 |
| (none) | - | 0 | 5 |

  Levels are not cumulative across techs: the level is the single best tech owned. [1oom game_update_tech_util; SG T6-1, App.I]. [LP] strategy note: terraforming only pays once pop is above ~half of max.
- **Pop hard cap** 300 (`game_num_max_pop`) for any planet; [SG] confirms.

### 2.4 Race interaction

- No race has an environment preference; all homeworlds are Terran 100/Yellow.
- **Silicoid** differences (economy): settle any type, no pollution, no cleanup need, growth term = `(100 - pop%)/2` regardless of class, pop-buy rate halved (`inc_pop_cost` effect /2), no soil/atmos/advanced-soil terraform, cannot research or trade for Controlled-environment or Reduced-Industrial-Waste techs (their `game_num_ng_tech` flags), "low birth rate"; [SG] advises sending at most 1-2 pop per turn by transport (no such limit in the 1oom UI). [1oom, SG ch.13]
- **Sakkra**: all pop growth x2 (growth term and bought pop), "initial colonists about one third of max".
- **Klackon**: worker output x2. **Meklar**: +2 operated factories per pop, factory cost does not scale with robotic level. **Psilon**: research x1.5. **Human**: trade +25 points. (see 3.2/3.3/3.8)
- Research cost multipliers per race/field (percent of normal): Human {Comp100, Constr100, FF60, Plan80, Prop80, Weap100}; Mrrshan {100,125,100,100,100,60}; Silicoid {80,125,125,125,125,125}; Sakkra {100,100,100,60,100,100}; Psilon {80,80,80,80,80,80}; Alkari {100,100,125,100,60,100}; Klackon {100,60,100,100,125,100}; Bulrathi {125,80,100,100,100,80}; Meklar {60,100,100,125,100,100}; Darlok {80,100,100,100,100,100}. [1oom game_num.c; matches SG ch.13]
- **No gravity** and no gravity-adapted traits exist in MOO1.

---

## 3. Colony simulation and economy

### 3.1 Per-planet state

`pop` (int millions) + `pop_tenths` (fraction carry), `max_pop1/2/3`, `growth`, `special`, `type`, `waste`, `factories`, `pop_oper_fact`, `rebels`/`unrest`, `reserve` (planet bank), carry-over BC stocks `bc_to_ship, bc_to_factory, bc_to_base, bc_upgrade_base, bc_to_shield, bc_to_ecoproj, bc_to_refit`, `slider[5]` (SHIP, DEF, IND, ECO, TECH, each 0..100, sum 100) + lock flags, `missile_bases`, `shield`, `have_stargate`, `buildship` (design 0..5 or STARGATE), `reloc` (destination for new ships), `trans_num/trans_dest`. New colony: `pop=2`, `factories=0`, `slider[IND]=100`.

### 3.2 Planet production ("gross BC")

```
oper    = colonist_oper_factories            // 2 at start; 3,4,5,6,7 with Improved Robotic Controls III..VII (Computer techs 8,18,28,38,48): oper = (tech+12)/10 + 1 ; Meklar +2
workers = max(0, pop - rebels)
opFact  = min(factories, workers * oper)     // idle factories produce nothing and pollute nothing
L       = Planetology level  (see the bullet below)
perPop  = floor(pop * (3*L + 50) / 100)      // x2 for Klackon (after the floor)
gross   = opFact * 1 BC + perPop
if AI:  difficulty factor (below)
gross  += min(planet.reserve, gross)         // the planet reserve bank can at most double output
if unrest == REBELLION: gross = 0
```
- **Planetology level L = `tech.percent[PLANETOLOGY]`** (1..99). `L = completed_count==1 ? highest_id : highest_id + completed_count - ((highest_id-1)/5 + 2)`, clamped 1..99. [1oom game_tech_get_field_percent] [SG]: "80% of the highest base level, plus the number of discoveries" (approximation; at game start both give level 1).
- Worker productivity per pop = `(3L+50)/100` BC: L=1 0.53; L=8 0.74; 17 1.01; 25 1.25; 33 1.49; 50 2.00; 67 2.51; 83 2.99; 99 3.47 (max). Klackon doubles (1.48 @8, 2.02 @17, 2.50 @25, 2.98 @33, 4.00 @50, 5.02 @67, 5.98 @83, 6.94 @99). [SG T5-1, T13-2] Each factory = 1 BC. At L=17 a worker outproduces a factory.
- **Max factories** on a planet = `max_pop3 * oper` (hard cap 2500, 2700 in the 1.3a ruleset). Start: 100-pop home world holds 200; each +10 pop adds 20 factories. [SG]
- **Mineral richness is NOT applied to gross production**; it multiplies how far BC *spent* goes (3.4).
- **AI difficulty factor on AI planets** (conflict): [1oom game_update_production] Simple x1.0, Easy x0.8 (`(v<<2)/5`), Average x1.25, Hard x1.5, Impossible x2.0 (code comment: "simple has larger v than easy"); [SG T15-1] says -20% / -10% / 0 / +25% / +50% (Simple..Impossible).
- Starting check (Klackon tutorial [SG ch.2]): 30 factories + `floor(50*53/100)=26` x2 = 52 -> **82 gross**; next turn pop 52, 34 factories -> `34 + floor(52*53/100)*2 = 88` (matches "88 gross").
- Default Human start: gross = 30 + 26 = **56 BC**.

### 3.3 Empire-level BC flow (taxes, upkeep, trade, reserve)

```
G      = sum of planet gross
shipM  = min(32000, floor( sum over ALL ships (in orbit and en route) of current design cost / 50 )) + 100 * (#planets with a stargate)   // [1oom]; [SG] says stargate upkeep 300
baseM  = floor( total missile bases * current_base_cost / 50 )
trade  = sum over partners of trade_bc * (trade_percent + (race==Human ? 25 : 0)) / 100       // trade_percent runs -30..+100 (Human -5..+125)
net    = floor(G*(1000 - security - spying)/1000) + trade - shipM - baseM - floor(G*tax/1000)    // security, spying, tax in per-mille of G
net    = max(1, net);   factor = floor(net*100/G)           // percent
planet.spendable = max(0, floor(planet.gross * factor/100) - transports_sent_this_turn)    // each outgoing transport costs 1 BC of that planet's output
reserve_bc += floor(G * tax / 2000)                           // only HALF of the taxed amount reaches the treasury
```
- **Upkeep rate: 2% of current build cost per ship per turn** (and per missile base); scrapping a ship refunds 25% of its cost into reserve; star gates cannot be scrapped. Costs rise/fall as miniaturization changes current prices. [1oom, SG ch.5]
- **Tax slider**: 0..200 (per-mille of gross, i.e. 0-20%), buttons step 5 (0.5%). Each 1 BC that reaches the reserve costs 2 BC; max 10% of gross to reserve. Trade income is never taxed. [1oom uiplanets.c; SG ch.5] AI taxes: 0% for turns 1-19, then 3-12% (+difficulty modifier up to 7-16% Impossible). [AI]
- **Security** (internal, 0-20% of gross shown as per-mille) and **spying** budgets (0-10% of gross per target race) are deducted the same way (see spy slice). Trade treaties: max 25% of the smaller economy, min gross 100 BC; starting/raising a deal costs 30% of the new amount immediately; `trade_percent` grows each turn by `floor((rnd_1_n(200) + relation + 25)/60)` points (average 0.3 .. 3.3 per turn from Feud to Harmony). [1oom, SG T5-2]
- `Reserve BC` (empire treasury) earns **no interest**; transfers to a planet are 1:1; a planet can spend up to double its normal output using transferred money (slider "Q" key = exactly double). Transfer UI: `amount = pct * reserve/100`, pct in 2% steps. [1oom, SG ch.6] Per-planet bank: each turn `planet.reserve = max(0, reserve - floor(prod_after_maint/2))` (example in [SG]: 10 BC planet with 50 transferred spends 20, 22, 26 over three turns, bank 40, 29, 16).
- **Direct deposit**: industry spending that cannot be used (factories already at max) goes to the reserve at **50%** (`reserve_bc += floor(excess_factories*cost/2)`). Rich planets launder better ([SG T5]): cost to put 1 BC in reserve = 2/3 (UltraRich), 1 (Rich), 2 (Normal), 4 (Poor), 6 (UltraPoor) BC of planet output.
- MOOLA cheat key adds 100 BC to reserve; donation event grants `max(500, (year/10)*100)`. The reserve also pays cash bribes/tribute in diplomacy ([SG ch.11]: "cash must come from the Interplanetary Reserve Fund") and AI planets receive 1/5 of it when under threat or under 20 pop ([AI]).

### 3.4 The five sliders: exactly where each BC goes

Per planet each turn (P = `spendable` from 3.3; `s_X` = slider percent; richness multiplier `R`: UltraPoor 1/3, Poor 1/2, Normal 1, Rich 2, UltraRich 3 — **applied to SHIP, DEF and IND only**; artifacts x2 / Orion x4 apply only to TECH):

| Slider | Effective BC | What it buys |
|---|---|---|
| **SHIP** | `floor(P*s_ship/100)*R + bc_to_ship` | Builds the selected design (cost = current design cost): `n = bc/cost` ships per turn, remainder stays in `bc_to_ship` (can be redirected to a cheaper design or banked on an unfinished big ship). If a Stargate is selected: accumulates to **3000 BC**, then `have_stargate=true`, slider auto-zeroes. Ships go to the `reloc` destination if set. (1oom code adds a flat +1 BC whenever the SHIP slider is > 0; costs of all designs are recomputed every turn from current tech.) |
| **DEF** | `floor(P*s_def/100)*R + bc_to_base` | In order: (1) upgrade existing bases to the current base cost (`(new-old)*bases`, billed after a tech discovery); (2) planetary shield up to `planet_shield_cost` (skipped in nebulae); (3) new missile bases at `base_cost` each; remainder carries. For human planets the slider auto-zeroes when the shield reaches the best available class ([SG]: DEF then moves to TECH). |
| **IND** | `floor(P*s_ind/100)*R + bc_to_factory` | New factories at `factory_adj_cost`; capped at `max_pop3*oper`; excess -> reserve at 50% (3.3). Slider auto-zeroes (points move to the first slider that can use them; [SG] says leftover goes to TECH) when factories hit max. |
| **ECO** | `floor(P*s_eco/100)` (no richness) | Priority: (1) waste cleanup; (2) one-time projects at PL 22/16/30; (3) terraforming increments; (4) buying population. See 3.6. The slider has a hard floor = "Clean" level (waste%). |
| **TECH** | `floor(P*s_tech/100)` -> RP | Research points: x1.5 Psilon, x2 Artifacts planet, x4 Orion (x6 Psilon). 1 BC = 1 RP. Capped 32767 per planet. |

- Sliders always sum to 100; UI steps are **4%** (25 positions; Ctrl = 1%); each slider can be locked; Alt+click sets to 100. Research (per-field) sliders are in **2%** steps (50 clicks over 6 fields; "=" gives 8,8,8,8,9,9). [LP, SG, 1oom uistarmap.c]
- **ECO floor** (`game_update_eco_on_waste`, run every turn and at load): `eco_pct = ceil(100*((floor(operating*scale/10) + waste)/n) / spendable)` clamped 0..100; if the ECO slider is below it, it is raised and the increase is removed proportionally from SHIP/DEF/IND; TECH gets the remainder. So unspecified percent drifts to TECH. Silicoids have no floor.
- At new game the home planet starts with `IND=100` and the ECO floor is then applied (Human: ~35% ECO / 65% IND; [SG] Klackon tutorial: "Clean" = 6 clicks = 24%).
- **Mineral multiplier meaning**: richer planets convert BC to ships/defense/factories 2-3x more efficiently; poor ones 2-3x worse; but ECO and TECH are unaffected. Rich planets are therefore the best shipyards; Poor planets should be research/eco planets.
- Auto-switch when something completes (`game_turn_finished_slider`): IND disabled when `factories >= max_pop3*oper`; DEF disabled when shield finished; SHIP disabled after a Stargate; ECO disabled when pop is at max, nothing to terraform/clean, and no growth purchasable.

### 3.5 Industry: factory costs, refit, caps

- Empire constants: `factory_cost` (base) from Construction techs: 10 (start), 9 (CN 3 "Improved Industrial Tech 9"), 8 (CN 8), 7 (CN 13), 6 (CN 18), 5 (CN 23), 4 (CN 28), 3 (CN 33), 2 (CN 38). `oper` = factories per worker 2..7 (Computer techs 8/18/28/38/48; Meklar +2 and Meklar pays no robotics premium).
- **Cost per new factory** = `factory_cost * oper / 2` (non-Meklar), i.e. +50% of base per Robotic Controls level above II: [SG T6-2 cost matrix, BC]:

| Robotic Controls (oper) | IT10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 |
|---|---|---|---|---|---|---|---|---|---|
| II (2) | 10 | 9 | 8 | 7 | 6 | 5 | 4 | 3 | 2 |
| III (3) | 15 | 13.5 | 12 | 10.5 | 9 | 7.5 | 6 | 4.5 | 3 |
| IV (4) | 20 | 18 | 16 | 14 | 12 | 10 | 8 | 6 | 4 |
| V (5) | 25 | 22.5 | 20 | 17.5 | 15 | 12.5 | 10 | 7.5 | 5 |
| VI (6) | 30 | 27 | 24 | 21 | 18 | 15 | 12 | 9 | 6 |
| VII (7) | 35 | 31.5 | 28 | 24.5 | 21 | 17.5 | 14 | 10.5 | 7 |

  (code uses integer `factory_cost*oper/2`, e.g. 9*3/2 = 13.)
- **Refit** [SG ch.6]: each planet keeps an operating tier (`pop_oper_fact`). When Robotic Controls improves, the planet must pay **half the base factory cost per level per existing factory** to refit; the computer builds factories at the cheapest tier first up to `pop*tier`, then pays the refit difference and moves up (worked example in SG: max pop 10, RC IV, IT6: build 20 @6, refit 20 @3 to RC III, build 10 @9, refit 30 @3 to RC IV, build 10 @12). In the 1oom default (flags `factory_cost_fix`=false) the empire-wide `oper` applies immediately to every planet's operating limit and the planet merely accumulates a flat refit charge `(oper - pop_oper_fact - Meklar2)*factory_cost/2` in `bc_to_refit` once capped; the fix flag restores per-factory refit. Either is acceptable for a port; the SG description is the intended design.
- Captured factories: 2 BC each to refit; 2% per captured factory to steal a tech (SG ch.8).

### 3.6 Ecology: waste, cleanup, terraform, buying population

Pollution model (per planet, each turn, **before** growth):
```
operating = min(factories, pop*oper)
newWaste  = floor(operating * ind_waste_scale / 10)          // scale 10 (start), 8, 6, 4, 2, 0 = CN 5, 15, 25, 35, 45
waste    += floor((100 - floor(waste*100/max_pop2)) * newWaste / 100)     // saturates toward max_pop2
   // original executable adds a second term floor((100-waste%)*floor(operating*oper/10)/100) unless flag waste_calc_fix (about +20% waste at oper=2)
if rebellion: waste = 0
cleanup (non-Silicoid):  need = floor(waste / n)             // n = waste units removed per BC
   if eco_BC >= need: eco_BC -= need; waste = 0   else: waste -= n*eco_BC; eco_BC = 0
waste = clamp(waste, 0, max_pop2 - 10)                        // waste can reduce effective max pop only down to 10
```
- `n` (Ecological Restoration line): **2** (PL 1, start), **3** (PL 5 Improved), **5** (PL 13 Enhanced), **10** (PL 24 Advanced), **20** (PL 34 Complete). I.e. cleaning one waste unit costs 1/2, 1/3, 1/5, 1/10, 1/20 BC.
- [SG T6-3] % of factory output needed for cleanup at 100% waste scale: start 50, Improved 33.3, Enhanced 20, Advanced 10, Complete 5; scaled by waste level 80/60/40/20% (e.g. start+80% = 40, Complete+20% = 1).
- Pollution **reduces the growth term**: growth uses `(pop + waste)/max_pop3`; the displayed max pop is `max_pop3 - waste`. Only operating factories pollute; only biological weapons also pollute from combat; Industrial Accident/Crystal events fill waste to `max_pop - 10`.
- After cleanup the leftover ECO BC is spent in this order:
  1. **Atmospheric Terraforming** (hostile planet, tech PL 22): `bc_to_ecoproj += eco`; at >= 200 BC (`>=`) converts the planet (2.3); remainder continues.
  2. **Soil Enrichment** (NORMAL, PL 16): at > 150 BC.
  3. **Advanced Soil Enrichment** (NORMAL or FERTILE, PL 30): at > 300 BC.
  4. **Terraform increments** while `max_pop3 - max_pop2 < level` and `max_pop3 < 300`: `+floor(eco/cost_per_inc)` to `max_pop3` (clamped to `max_pop2 + level`).
  5. **Buy population**: `tenths = floor(eco*10/inc_pop_cost)` (Sakkra x2; Silicoid /2), limited to `floor(pop*10/4)` tenths (25% of current pop per turn). `inc_pop_cost` BC per pop: **20** (start), **10** (PL 21 Cloning), **5** (PL 42 Advanced Cloning); Sakkra additionally `x2/3` in code (together ~3x in 1oom; [SG] says Sakkra "2x") (conflict).
  Leftover ECO BC after this is lost (1oom); [SG] says surplus at max goes to reserve (unverified).
- Strategy anchors [SG]: keep ECO at "Clean" before adjusting others; terraform before exceeding the initial 2 factories/worker to get cheaper factories sooner.
- Silicoids: no waste, no cleanup, only terraforming/pop-buy.

### 3.7 Population growth

Per planet per turn (only if `type != none` and `pop != 0`), in **tenths of a million**:
```
if Silicoid:   v = (100 - floor(pop*100/max_pop3)) / 2
else:
   v = 100 - floor((pop + waste)*100 / max_pop3)              // may be negative if over capacity
   switch growth: HOSTILE: v = v>=0 ? v/2 : v*2
                  FERTILE: v = v>=0 ? v + v/2 : (v*2)/3
                  GAIA:    v = v>=0 ? v*2 : v/2
   if Sakkra: v *= 2
natural = floor((v*pop + 5)/100)                             // tenths of pop; i.e. growth = 0.1 * pop * (1 - (pop+waste)/max) pop/turn (x class mods)
if v>0 and natural<1: natural = 1                            // always at least +0.1 pop
total  = natural + pop_buy_tenths(3.6) + pop_tenths          // pop_tenths = carried fraction
pop += total/10;  pop_tenths = total%10;  pop = clamp(pop, 0, max_pop3)
```
(The original executable adds `pop_tenths` a second time inside the natural-growth routine; flag `pop_tenths_fix`.)
- Anchors [SG ch.6]: ~10% per turn near zero, 5% at 50% full, ~2% at 80%, 0 at max; fastest between 30% and 70% of max; Gaia at 25/100 = 15%; the last point is slow, hence buying pop. Fertile +50%, Gaia x2, Hostile x1/2.
- Example normal planet max 100 (tenths -> pop/turn): pop 2 -> +0.2; 10 -> +0.9; 20 -> +1.6; 30 -> +2.1; 40 -> +2.4; 50 -> +2.5; 60 -> +2.4; 70 -> +2.1; 80 -> +1.6; 90 -> +0.9; 95 -> +0.4; 99 -> +0.1. Hostile halves these.
- Rough continuous-time estimate (derived, hostile/ecology purchases ignored): `P(t) = M/(1 + (M/P0 - 1)e^{-0.1 t})`: a new 2-pop colony on a max-100 planet needs ~39 turns to reach 50 and ~61 to reach 90 when left alone; on max 40 about 29 turns to reach 20. [LP] observed Tyr (max 35) passing the halfway point (19) after a couple of decades.
- Colonists that leave a planet stop producing there while it regrows; seeding a new colony up to ~25% of its max population by transport is efficient, more has diminishing returns [SG ch.6].

### 3.8 Research output

`RP_planet = floor(spendable*s_tech/100)` (x1.5 Psilon, x2 Artifacts, x4 Orion), summed over planets (excluding planets with an active plague or nova event), then split by the 6 field sliders (2% steps). Per field each turn: `invest += share + min(floor(0.15*invest), 2*share)` (interest 15%, capped at twice that turn's funding); if `invest > cost` the tech completes with probability `P = ((invest-cost)*250/cost)/500 = (invest-cost)/(2*cost)` (i.e. +1% per extra 2% of cost invested; the displayed percentage in the UI is half of the real one [LP]); if a field with a project gets 0 funding, `invest` decays 10% per turn. RP cost of tech id T: `10*floor(T^2 * race% * difficulty/1000)` with difficulty 20/25/30/35/40 (Simple..Impossible) for humans and 20 for all AIs (`T^2*race%/5`). Example: Improved Industrial Tech 9 (T=3) for Klackon Simple = 100 RP; Hydrogen Fuel Cells (T=3, Klackon poor Propulsion 125%) = 220 RP; Improved Eco Restoration (T=5) = 500 RP — all match the [SG] tutorial. Items miniaturize: cost `x T50[level-itemTech]/100` (50% per 10 levels) and size `T25[...]` (25% per 10 levels), tables in section 9. (Full research rules belong to another slice.)

### 3.9 Artifact and Orion loot

- First empire to **explore with a ship in orbit** a planet with special Artifacts (scanner exploration does not count) gets a loot call: one random tech from the player's lists with `T = rnd_1_n(30)`, eligible if `min(field_level+10, 50) >= T`, up to 200 tries, humans only (1oom); [SG]: 75% chance of a random tech up to 10 levels above current. Artifact colonies: x2 research.
- Guardian kill: Death Ray always + up to 3 random techs `T = rnd_1_n(31)+19`, eligible if `min(field_level+25,50) >= T`.

### 3.10 Planet defence production

- **Missile base cost** (`game_get_base_cost`, BC): `sum = armor_mod + weap_mod + shield_mod + comp_mod + jammer_mod`, `cost = sum*3/5`; AI multipliers 1/0.9/0.8/0.7/0.5 by difficulty (Simple..Impossible; also the "base cost" multiplier row in [SG T15-1]); never below 50 BC. With `m = T50[min(field_level,50)-1]` (the 50%/10-levels table):
  - `armor_mod = (armor[k].cost[Large] + hull[Large].cost) * m / 1500`, k = best owned armor index minus 1 (min 0);
  - `weap_mod = weapon[base_weapon].cost * (9*m) / 1000`;
  - `shield_mod = shield[base_shield].cost[Large]*m/1000 + shield.power[Large]/10`;
  - `comp_mod = comp[base_comp].cost[Large]*m/1000 + comp.power[Large]/10`;
  - `jammer_mod` same form for best owned ECM jammer.
  At game start (all levels 1, Titanium, Nuclear Missile, Class I, Mark I) this evaluates to **254 BC** [1oom]; [SG T8-1] says "starting-tech base ~283 BC" (conflict, unverified which state the guide measured). Upkeep 2%/turn.
- Base hit points by armor tech: 50, 75, 100, 125, 150, 175, 200 (Titanium..Neutronium); each base fires 3 missiles/round. Rule of thumb in [SG ch.8] for bases per colony: UltraPoor 1 per 20 pop, Poor 1 per 15, Normal 1 per 10, Rich/Artifact 1.5 per 10, Orion/UltraRich 2 per 10 (double without fleet support).
- **Planetary shield** classes V/X/XV/XX (FF techs 12/22/32/42) give absorb 5/10/15/20; cumulative cost **500 / 1000 / 1500 / 2000 BC**, upgrades pay only the difference; shield level steps up as BC accumulates (`newshield = 5 * #thresholds reached`); not buildable in nebulae.

### 3.11 Worked early-game timeline (derived, Human, Average, 100-pop Terran home)

- Turn 1 (2300): pop 50, 30 factories, L=1 -> gross 56 BC; upkeep `floor((591+10+10)/50)=12` -> net 44, factor 78%, spendable 43; waste `30*10/10=30`, clean cost `30/2=15` -> ECO floor `ceil(1500/43)=35%` (36% with 4% steps). Pop growth `floor((50*50+5)/100)=25` tenths -> pop 52 (+0.5 carried). [SG tutorial: pop 52 on turn 2, +4 factories]
- Colony ship (570-591 BC): with ~65% of 43 BC on SHIP ~ 28 BC/turn -> ~20 turns; at 100% SHIP (minus eco) ~ 9-18 turns [SG tutorial: 18 turns at the tutorial setting, 9 at 100% ship]. Scouts (8-10 BC) about 1/turn at ~50% ship. Factories 10 BC each: 20 BC/turn of IND = 2 factories/turn (each adds ~+1 BC/turn). The homeworld (50 pop, 30 factories, cap 200) is population-limited at first: it only operates `pop*2` factories, so growth to 100 pop (and +10 pop terraforming for ~50 BC) matters as much as building factories.
- [LP] Psilon: Mentar production 51 (2300) -> 238 (2323); first colonizer build time ~4 years at ~140 production; new colonies start at 2 pop; Imra colonized 2334. [SG] new colony ~1 BC/turn at 2 pop; 10M more colonists make it ~6 BC/turn.
- Hydrogen fuel cells (PR 3) cost 220 RP at tutorial settings (range 3 -> 4), Improved Industrial Tech 9 100 RP, Improved Eco Restoration 500 RP. [SG tutorial] (Check with the research-cost formula of 3.8, Klackon/Simple: PR 3 -> `10*floor(9*125*20/1000)=220`; PL 5 -> `10*floor(25*100*20/1000)=500`; CN 3 -> `10*floor(9*60*20/1000)=100`.)
- **[SG ch.2] tutorial timeline (Klackon, Simple, Medium map, start 2300)**: T1 gross 82 / spendable 69 (upkeep 13 for 1 colony ship + 2 scouts); sliders: ECO "Clean" = 6 clicks (24%), SHIP 4 clicks (16%, one scout next year), IND the rest (~41 BC = 4.1 factories); scouts sent to stars 3 parsecs away (ETA 3 turns, warp 1). T2: pop 52, gross 88 / 75, 4.5 factories/turn, second scout built. T3: next scout built. T4: planets discovered (Firma: Minimal, 35; Beta Ceti: Terran, 100); a scout with Reserve Fuel Tanks sent 5 parsecs out. T5: Galos (Jungle 90, Fertile), Aurora (Barren 50, hostile) discovered; **colony ship launched to Beta Ceti (3 parsecs, ~3 turns)**. T6: scout building stops; research starts at 17 RP (about half Propulsion, quarter Planetology, quarter Construction). ~T8-9: colony founded (2 pop), upkeep falls from 13 to 1 BC. Then: new colony-ship design (Large, Standard Base, 2 Heavy Lasers) = 23-25 turns at the chosen setting; 12 transports (12 pop, 12 BC) sent Sol -> Beta Ceti (3 turns); Sol pop 69 / factories 68 / income 142 BC; tax set to +2 BC (1 BC banked per 2 taxed). Nuclear Engines (warp 2) researched after Hydrogen Fuel Cells.

### 3.12 Spending ratios used by the AI (for reference)

Initial AI: Ship 10 / Ind 90 (when planets are nearby), research 20/20/20/20 (comp/constr/prop/weap), FF 15, Plan 40; first re-balance at turn 15-20; research focus 75% on one field. [AI] Planetary governor ("eco stances"): grow pop first / keep clean / don't touch.

### 3.13 Random events touching colonies (compact; [1oom game_event.c], [SG ch.14])

- Trigger each turn: `chance = max(0, year - evn.year)` with `evn.year` initially 40 and reset to `year` after each event; scaled by difficulty (Simple /2, Easy x2/3, Average x3/4, Hard x4/5, Impossible x1); fires if `rnd_1_n(512) <= chance`. Victim weight = number of planets (x5 for the human), normalised by the smallest weight (floor 5); empires with < 4 planets get the minimum weight ([SG]: players with 4 or fewer planets are never affected; [SG]: victims weighted by the square of the production ratio — conflict). ([SG]: no events before turn 50, +1%..2%/turn; each event once per game; mean spacing 25-30 turns on Impossible, ~2x on Simple — 1oom's `i/512` growth gives mean ~28.)
- Types (max once each): Plague (colony >=30 pop in [SG]; not Silicoid; lose 5-10% pop per turn until `plague_val=(rnd_1_n(8)+2*difficulty)*prod` RP spent), Quake (pop >= 50: -20..29% pop, -30..79% factories), Nova (`years = rnd_1_n(5)+10-difficulty`; cure cost `(rnd_1_n(5)+10-difficulty)*prod`; else planet -> Radiated, max pop 11-20, 80-100% factories lost), Industrial Accident (>=30 factories, not Silicoid: max pop /2, waste = max-10, Radiated hostile), Comet (year >= 100; HP `(rnd_1_n(5)+10+difficulty)*25`; ships chip away `rnd_1_n(hull weight 1/5/25/125)` per ship; impact destroys the colony -> no planet), Pirates (needs a trade partner; HP `(rnd_1_n(5)+10+difficulty)*30`; cuts trade_percent by HP/6 %), Computer Virus (zero one of Computer/Force-field/Propulsion/Weapon research stock), Derelict, Rebellion (human only, not capital: `rebels = pop/2`), Diplomatic blunder/assassin, Fertile/Rich/Poor planet events (random planet; Fertile via soil enrichment), Donation (`max(500,(year/10)*100)` BC), Space Crystal / Space Amoeba (year >= 200, one of each at a time; start at a random map edge, move at warp 1 toward a star, then random-walk the star grid, stay 2-3 turns per victim, vanish after 5 planets; Amoeba: pop 0, factories /10, planet -> Radiated with max pop 10/15/20 (SG: 10-25); Crystal: pop 0, waste = max_pop-10, factories kept; HP Amoeba 1000..5000, Crystal 3000..7000 by difficulty). Monsters destroy any pirates they pass through.

---

## 4. Production items and costs (BC)

There is no "outpost", "freighter", "starbase", "battlestation", "star fortress", "armor planet" or "orbital" item. Everything that can be bought is below.

### 4.1 Ships

Ships are designs on 4 hull sizes; 6 design slots; max 32000 per stack. Cost is computed by a formula (4.2). Starting designs (all Retro engines, warp 1), preset cost in the executable vs cost recomputed by the formula for an identical design ("redesign it and it gets cheaper" [LP]):

| Slot | Design | Hull | Contents | Preset cost | Formula cost |
|---|---|---|---|---|---|
| 0 | Scout (LP: "Recon") | Small | Reserve Fuel Tanks, 2 Retro engines | 10 | **8** |
| 1 | Fighter | Small | 1 Laser, 27 engines | 15 | **14** |
| 2 | Destroyer | Medium | 1 Nuclear Missile(2), 3 Lasers, 110 engines | 66 | **74** |
| 3 | Bomber | Medium | 2 Nuclear Bombs, 2 Lasers, 85 engines | 86 | **65** |
| 4 | **Colony Ship** | Large | Standard Colony Base, 100 engines | **591** | **570** |
| 5 | (unused) | Small | - | 10 | - |

(Preset values from `tbl_startship`; "formula cost" = the values 1oom's `fix_starting_ships` table uses and which the formula in 4.2 reproduces exactly.) [LP] confirms 591 -> 570, 10 -> 8; the Colonizer later fell to 466 BC through miniaturization.

Colony-base specials (extra cost, same for every hull, 700 space => Large/Huge hull only): Standard **350**, Barren 375, Tundra 400, Dead 425, Inferno 450, Toxic 475, Radiated **500**. Reserve Fuel Tanks (+3 parsecs range, tech CN 1): cost 2 / 10 / 50 / 250 BC and space 20/100/500/2500 on Small/Medium/Large/Huge.
Hull table (cost x10, space, hit points (Titanium), thrust "power", inherent defense): Small 60 / 40 / 3 / 2 / +2; Medium 360 / 200 / 18 / 15 / +1; Large 2000 / 1000 / 100 / 100 / 0; Huge 12000 / 5000 / 600 / 700 / -1 (i.e. 6, 36, 200, 1200 BC). Hull space grows +2% of base per Construction level.
Upkeep 2%/turn per ship (3.3). Scrap refund 25% to the reserve.

### 4.2 Ship cost formula (internal units are BC x10) [1oom game_design.c; verified on the five rows above]

```
engines      = max(1, floor(thrust_needed / (engine.power/10)))
thrust_needed= sum(weapon.power*count) + hull.power*(maneuver+1) + sum(special.power) + computer.power + jammer.power + shield.power
item_cost    = floor(base_item_cost * T50[clamp(field_level - item.tech_id, 0, 50)] / 100)        // miniaturization (sections 3.8 and 9)
total        = hull.cost
             + sum( max(weapon_cost,5) * count )
             + floor( max(engine_cost,5) * engines / 10 )
             + max(computer_cost,1) + max(jammer_cost,1)           // when fitted
             + max(shield_cost,5) + max(armor_cost,5) + sum(max(special_cost,5))   // when fitted
cost_BC      = max( floor((total + 5)/10), 1 )
```
Engine cost is effectively `0.2 BC per thrust unit` for every warp class (cost/power = 2). Specials/colony-base cost shrink with the *special's field* level (Planetology for colony bases), weapons with Weapon level (bio weapons: Planetology), engines with Propulsion level; hull cost never shrinks.
Engines (all hulls): warp / tech / power / space / cost(x10): see 5.1.

### 4.3 Colony infrastructure and other purchasables

| Item | Cost | Notes |
|---|---|---|
| **Transport (1 pop)** | 1 BC of the sending planet's output that turn + the pop itself | Not built; at most `floor(pop/2)` sent per turn per planet (UI, every race). No upkeep |
| **Factory** | `factory_cost*oper/2` BC: 10 at start (full matrix in 3.5) down to `2*oper/2` | Max `max_pop3*oper` per planet |
| **Missile base** | formula 3.10: ~254 BC at start, falls with miniaturization; AI x1/0.9/0.8/0.7/0.5; min 50 | upkeep 2%/turn; hits 50..200; 3 missiles/round; upgrades billed on new tech |
| **Planetary shield** | Class V 500, X 1000, XV 1500, XX 2000 BC (cumulative; upgrade pays difference) | not in nebulae; needs FF 12/22/32/42 |
| **Stargate** | 3000 BC (one per planet), upkeep **100 BC/turn** [1oom, AI] or **300 BC/turn** [SG] (conflict) | PR 27; cannot be scrapped; lost if planet destroyed; needs another own stargate to be useful |
| Atmospheric terraforming | 200 BC (accumulated in `bc_to_ecoproj`) | PL 22, hostile planets |
| Soil enrichment | 150 BC | PL 16, Normal planets |
| Advanced soil enrichment | 300 BC | PL 30, Normal/Fertile |
| Terraform +1 max pop | 5/5/4/4/3/3/2/2/2 BC by terraform tech | up to +10..+120 |
| Buy population | 20 / 10 / 5 BC per pop (PL 0 / 21 / 42), cap 25% of pop per turn | Sakkra cheaper |
| Waste cleanup | 1/2, 1/3, 1/5, 1/10, 1/20 BC per waste unit | PL 1/5/13/24/34 |
| Spy network | 25 BC + 2 x target's Computer level, x2 for each extra spy (per target race; budget <=10% of gross each) | other slice |
| Security | 0-20% of gross | other slice |
| Reserve transfer | 1:1 | planet can spend <= 2x its normal output |

---

## 5. Movement and supply

### 5.1 Engines and speed (parsecs per turn = warp)

| Engine | PR tech id | Warp (ship speed) | Transport speed (`have_engine`) | Thrust power | Space | Cost x10 |
|---|---|---|---|---|---|---|
| Retro | 1 (start) | 1 | 1 | 10 | 10 | 20 |
| Nuclear | 6 | 2 | 1 | 20 | 18 | 40 |
| Sub-Light | 12 | 3 | 2 | 30 | 26 | 60 |
| Fusion | 18 | 4 | 3 | 40 | 33 | 80 |
| Impulse | 24 | 5 | 4 | 50 | 36 | 100 |
| Ion | 30 | 6 | 5 | 60 | 40 | 120 |
| Anti-Matter | 36 | 7 | 6 | 70 | 44 | 140 |
| Inter-Phased | 42 | 8 | 7 | 80 | 47 | 160 |
| Hyper Drive (Hyperthrust) | 48 | 9 | 8 | 90 | 50 | 180 |

- A fleet's speed = `min(engine_index + 1)` over the designs sent (slowest ship). Transports use the empire's best engine: `have_engine` = 1 until Sub-Light, then warp-1 (matches [SG]/[LP]: "transports move at your best engine speed minus one, minimum 1"). Stargate-to-stargate = instantaneous (`FLEET_SPEED_STARGATE = 35`).
- Combat speed is separate (ship design maneuverability); not covered.

### 5.2 How fleets move (straight lines, simultaneous, no lanes)

- Orders: pick a destination **star** (only stars within range, 5.3; the range flags are those computed at the end of the previous turn). A fleet stays at the star it reached. A fleet that is already under way can be re-routed only if the owner has **Hyperspace Communications (CO 34)** (the UI also allows it while the fleet's position coincides with a star, i.e. right after being ordered); the new destination must be within range, and ordering it back to its origin merges it back into orbit. Retreating fleets (after a lost battle) follow their preset retreat path unless you have Hyperspace Communications; you may give new orders the turn after the loss. Fleets pass other stars without effect; ships cannot be intercepted between stars; battles occur only at stars, when forces of enemy/at-war empires share a system after movement.
- Fleet objects merge when same owner/origin/destination/speed. Max 260 enroute fleets, 100 transports.
- **Per turn** (1oom `game_turn_move_ships`): up to 20 animation frames; a unit of speed `N` is active on frames `0 .. 2N-1`; each active frame it advances toward its destination along the straight line by **5 units on even frames, 6 on odd frames** (`go_line_dist`). Open space: a warp-N fleet makes **N parsec double-steps (<= 11N map units) per turn**, so its turns-to-arrival is `ceil(star_dist/N)` (same stepping that defines `star_dist`). After the loop, fleets at their destination coordinates enter the destination orbit.
  - Nebula: fleets move on frame 0 and on every odd frame, but skip even frames >= 2 while inside a nebula (tested at the current position each frame): `5 + 6N` units per turn if entirely inside. Transports are inverted (move on even frames, stall on odd frames inside a nebula): `5N` units per turn. [SG] states "1 parsec per turn in nebulae" (conflict).
  - Stargate speed: position set directly to the destination.
  - Monsters step on frames 0/1 only (one parsec per turn).
- **ETA** for the UI = number of turns the above simulation needs (`game_calc_eta_ship(speed, from, to)` / `_trans`). In open space this equals `ceil(star_dist / speed)`; nebula travel and transports need the frame simulation (transports: speed = `have_engine`, 5 units on even frames and 6 on odd frames, same truncating stepping).
- Parsec distance is the straight-line distance between star centres (no routes, no detours, no fuel burn per jump).

### 5.3 Fuel / supply range

- "Range" is a **supply radius**, not per-jump fuel: a star is reachable if it is within `fuel_range` parsecs (`star_dist` metric) of the nearest planet you **own or an ally owns** (`within_frange = 1`). Ships with **Reserve Fuel Tanks** may also go to stars within `fuel_range + 3` (`within_frange = 2`). A planet you own has range 1 to itself.
- At the end of each turn any ships sitting at stars with `within_frange == 0`, or `== 2` and no reserve tanks, are **lost** (planet lost/range shrunk -> "ship ran out of fuel" message). [1oom game_fleet_unrefuel]
- `fuel_range` by Propulsion tech (best owned): none 3 (start); PR 3 Hydrogen Fuel Cells **4**; PR 5 Deuterium **5**; PR 9 Irridium **6**; PR 14 Dotomite Crystals **7**; PR 19 Uridium **8**; PR 23 Reajax II **9**; PR 29 Trilithium **10**; PR 41 Thorium Cells **unlimited (30 in code)**. (Scouts: +3 -> 6, 7, ... [LP].) Fighters/colony ships have the base range; colonization range = fuel range; conquering/colonizing a star extends the range from that star ("colonial leap-frogging").
- Allied planets extend range; allies may refuel in each other's systems.
- **Contact** (first contact / treaties) = either empire's planet within `max(fuel_range_A, fuel_range_B)` of the other's planet; broken contact cancels trade/treaties.

### 5.4 Scanners and visibility

| Computer tech | Planet scan range R (parsecs) | Ship scan range (parsecs) | Notes |
|---|---|---|---|
| start | 3 | 0 | |
| CO 4 Deep Space Scanner | 5 | 1 | |
| CO 13 Improved Space Scanner | 7 | 2 | shows enemy course/ETA; F7/F8 incoming-fleet warnings |
| CO 23 Advanced Space Scanner | 9 | 3 | auto-explores stars within 110 units of own planets |

- **Stars** (owner / pop / bases / ships in orbit): a star is in scan range if `star_dist` (parsecs) from one of your own planets is `<= R`, or if one of your own en-route fleets is within `(10*R-30)/2` map units (= 0/10/20/30 for R = 3/5/7/9, `dist_fast`) of the star (the fleet part never worked in the original executable; `ship_scanner_fix`, on in 1oom's default 1.3a ruleset, repairs it). Ships in orbit at a star are visible when the star is in scan range.
- **Fleets and transports in transit** are visible to you if (a) within `10*R` map units (`dist_fast`) of one of your planets, or (b) within `(10*R-30)/2` units of a star where you have ships or of one of your own en-route fleets. Your own fleets are always visible to you. [1oom game_check_coord_is_visible / game_update_within_range]
- Map initially shows all stars (1.15). Exploring needs a ship (or the advanced scanner).
- Battle scanner (CO 1, ship/base special) is a combat device only.

### 5.5 Stargates

- Built through the SHIP slider (3000 BC), tech PR 27 "Intergalactic Star Gates". A fleet (or population transport) travels between **two stargates owned by the same empire** in one turn regardless of distance. Upkeep per gate and non-scrappable (4.3).
- 1oom: speed is chosen at dispatch (`game_send_fleet_do`): stargate speed only if both `from` and `dest` are owned by the sender and both have `have_stargate`.

### 5.6 Relocation ("RELOC")

Each planet has `reloc` (default itself). Ships finished there are automatically dispatched (free, no cost beyond upkeep) to the target planet at their own speed; the target must be one of your own planets (classic rule `owner == you`); there are UI keys to point all planets at one colony and to reset. A lost/destroyed target resets the pointers to the planet itself. [1oom, SG ch.2]

### 5.7 Time

1 turn = 1 year; first turn is 2300; ship speed is parsecs per turn; random events from internal year 41; council every 25 years (first when 2/3 of stars are colonized).

---

## 6. Population transfer and colonization

### 6.1 Colony ships

- A colony ship = design with a colony-base special on a Large/Huge hull (4.1). It colonizes automatically at the **explore** step when it is in orbit at an **unowned** star whose `type >= ship's colony-base minimum type`; the ship is consumed (1 ship per colonization). The human player gets a "colonize?" prompt (can decline); AI always colonizes.
- New colony: `owner = you`, **pop 2**, factories 0, slider IND 100 (ECO floor applied), `pop_oper_fact=2`, missile bases 0; the star is marked explored. [SG ch.2: a fresh colony makes ~1 BC/turn; 10 more colonists make it ~6 BC/turn]
- Hostile planets (types 1..6) require a matching base (3.. tech PL 3/6/9/12/15/18) and grow at half rate; [LP]: "less hostile types are included in more hostile ones" (a Radiated base can land anywhere) and "skipping barren tech and going straight to a higher tier is often best".
- **Silicoids**: when a Silicoid colony ship (any colony base, even Standard) is in orbit the minimum type is forced to Radiated, so it can settle any planet type (not "no planet"). [1oom game_turn_explore]
- Without the `colonized_factories_fix` flag, colonizing a planet that already has factories (e.g. after a monster/bombing killed the pop) keeps those factories and the old `pop_oper_fact`.
- There are no natives; unowned planets are simply free for the first arrival. Simultaneous arrivals are resolved in player-index order (a source FIXME notes AIs, which have the last IDs, win ties for artifact looting; unverified for colonization).
- The Orion planet can only be taken after the Guardian is dead (the battle at Orion precedes exploration, and surviving ships are cleared while the Guardian lives) (inferred).

### 6.2 Population transports ("TRANS")

- Per planet and turn the owner chooses a destination star and a number `n` (UI slider 0..`floor(pop/2)`; steps of 1, 10% with Ctrl, max with Alt). Destination must be **owned** (by anyone, including enemies), **explored**, within fuel range (`within_frange == 1`), and its type must be `>= your have_colony_for` (UI check); sending to self cancels. Transports cannot found new colonies. [1oom uistarmap_trans.c]
- On launch (turn-start step): `planet.pop -= n` (leaves at least 1), rebels reduced by `n/2+1`, cost **1 BC of that planet's spendable output per pop** (`prod_after_maint -= trans_num`), pop in flight produces nothing.
- Speed `have_engine` (5.1), ETA via `game_calc_eta_trans`; stargate pair = instant. In flight they cannot be attacked; they face defenders only on arrival.
- Arrival (turn step "transports land"):
  - Own planet: `pop = min(pop + n, max_pop3)` (excess lost; UI warns "above max"); if the planet is in rebellion they reinforce against the rebels.
  - Unowned planet: transports lost (message only).
  - Enemy/at-war planet: first run the **gauntlet**: missile bases fire at the transports; each transport has hit points by best armor (Titanium 15, Duralloy 22, Zortrium 30, Andrium 37, Tritanium 45, Adamantium 52, Neutronium 60; transports always get the best armor for free) [SG T8-9]; exposure: warp 1-4 -> 4 rounds, 5-6 -> 3, 7-8 -> 2, 9 -> 1 [SG T8-8]. Survivors become the landing force; if the planet has a monster or the Guardian, all die. **Combat Transporters (PR 45)**: each lost transport survives with 50% chance (25% if the defender has a Subspace Interdictor). Allies/non-aggression: warning only. Then ground combat (other slice): max `300` pop may land per turn, rest removed. Conquered planet: owner becomes the attacker, `pop = survivors (<= max_pop3)`, factories kept, `bc_to_refit=0`, `pop_oper_fact=1`; each captured factory gives a 2% chance to steal a tech (max 6 per conquest).
- AI usage: donors have pop over half of capacity (and capacity > 40) and send half their pop; recipients are colonies below 1/3 of max (or rebelling); bolster donors above 3/4 send 1/3. [AI]
- Silicoids: [SG ch.13] advises sending at most 1-2 pop per turn from a colony; (conflict: the 1oom transport UI has no race-specific limit, `trans_max = pop/2` for every race — the SG remark is probably strategic advice about their low birth rate, not a rule).
- Rebellion: `rebels` reduce workers (`pop - rebels`) and production; planet in `REBELLION` has production 0; ground combat vs rebels uses `rnd_1_n(100)+force` rolls; a coup happens if rebel planets >= half of an empire's planets.

---

## 7. Order of turn processing

**1oom `game_turn_process` (selected, in order)**: (1) clamp ship counts; (2) diplomacy mood tweaks; (3) AI planning (fleets p1, ship designs p2, planet sliders p3); (4) clear per-turn "finished" flags; (5) **launch transports** (pop leaves); (6) **update_production** (gross, upkeep, tax, factor); (7) **build_eco** (waste, cleanup, terraform, pop growth for every planet); (8) total research; (9) trade percent growth; (10) spies built; (11) diplomacy adjust; (12) **build defence** (bases/shields); (13) **build ships**; (14) **reserve** (planet bank decay `-prod/2`, empire reserve += `G*tax/2000`); (15) **build industry** (factories; overflow to reserve); (16) **move ships/transports** (20 frames) and orbit arrival; (17) spy reports; (18) **all battles** at stars; (19) espionage/sabotage; (20) **research** (interest + discovery rolls); (21) new techs applied; Guardian-clearing; (22) **explore + colonize**; (23) bombardment; (24) **transports land + ground combat**; (25) coup checks; (26) **random events**; (27) artifact loot; (28) contact/have-met, AI diplomacy, council election test (`(year % 25 == 0 || never held) && alive > 2 && 2/3 of stars colonized`), audiences; (29) **fuel check** (strand/destroy ships out of range); (30) recompute production (display) and ECO floor; (31) **year += 1**; (32) recompute tech levels, auto-switch finished sliders; (33) recompute fuel/scanner ranges and visibility.
**[SG Appendix A] 16 phases**: I computer players prepare; II income and growth (transports launch and cost deducted, production executed, population growth, research interest + new RP, trade growth, new spies); III automatic diplomatic adjustments; IV receive new missile bases/shields, then new ships; V economic adjustments (taxes and surplus industry to reserve, then new factories); VI movement then ship combat; VII spying; VIII technology discovery rolls; IX planet exploration; X bombardment/invasions (orbital bombardment, transports land, ground combat); XI genocide check; XII random events (+2%*difficulty cumulative, d100); XIII first contacts; XIV diplomacy and High Council; XV economic announcements (completion messages, sliders adjustable); XVI housekeeping (update scanning info, advance year, recalc tech levels, autosave).

---

## 8. Economy- and movement-relevant technologies (tech ids per field: CO Computer, CN Construction, FF Force Field, PL Planetology, PR Propulsion, WE Weapon; names as in 1oom/SG)

| Field id | Tech | Effect (numbers) |
|---|---|---|
| CO 1 | Battle Scanner | combat device; start tech |
| CO 4 | Deep Space Scanner | planet scan range 5, ship 1 |
| CO 8, 18, 28, 38, 48 | Improved Robotic Controls III..VII | workers run 3, 4, 5, 6, 7 factories (start 2); +2 Meklar |
| CO 13 | Improved Space Scanner | scan 7 / 2, shows enemy ETA |
| CO 23 | Advanced Space Scanner | scan 9 / 3; auto-explore within 110 units |
| CO 34 | Hyperspace Communications | redirect fleets en route |
| CN 1 | Reserve Fuel Tanks | +3 parsecs (ship special); start tech |
| CN 3, 8, 13, 18, 23, 28, 33, 38 | Improved Industrial Tech 9..2 | factory base cost 9, 8, 7, 6, 5, 4, 3, 2 BC |
| CN 5, 15, 25, 35 | Reduced Industrial Waste 80/60/40/20% | waste scale 8, 6, 4, 2 (of 10) |
| CN 45 | Industrial Waste Elimination | waste scale 0 |
| FF 12, 22, 32, 42 | Class V / X / XV / XX Planetary Shield | shield absorb 5/10/15/20; cost 500/1000/1500/2000 |
| PL 1 | Ecological Restoration | waste cleanup 2 units per BC (start) |
| PL 5 / 13 / 24 / 34 | Improved / Enhanced / Advanced / Complete Eco Restoration | 3 / 5 / 10 / 20 units per BC |
| PL 2, 8, 14, 20, 26, 32, 38, 44, 50 | Improved Terraforming +10 .. +100, Complete Terraforming | +10,20,30,40,50,60,80,100,120 max pop; cost per pop 5,5,4,4,3,3,2,2,2 |
| PL 3, 6, 9, 12, 15, 18 | Controlled Barren / Tundra / Dead / Inferno / Toxic / Radiated Environment | colony base types (colonize types >= Barren .. Radiated) |
| PL 16 | Soil Enrichment | Normal -> Fertile, 150 BC, +25% max pop |
| PL 21 | Cloning | 10 BC per pop |
| PL 22 | Atmospheric Terraforming | hostile -> Minimal, 200 BC |
| PL 30 | Advanced Soil Enrichment | -> Gaia, 300 BC, +50% (replaces fertile bonus) |
| PL 42 | Advanced Cloning | 5 BC per pop |
| PL 17 / 36 | Bio-Toxin Antidote / Universal Antidote | prevents 1 / 2 pop lost per bio attack |
| PR 1 | Retro Engines | warp 1; start |
| PR 6, 12, 18, 24, 30, 36, 42, 48 | Nuclear, Sub-Light, Fusion, Impulse, Ion, Anti-Matter, Inter-Phased, Hyper Drives | warp 2..9; transports: 1,2,3..8 |
| PR 3, 5, 9, 14, 19, 23, 29, 41 | Hydrogen, Deuterium, Irridium, Dotomite, Uridium, Reajax II, Trilithium, Thorium fuel | range 4,5,6,7,8,9,10,unlimited |
| PR 27 | Intergalactic Star Gates | stargates (3000 BC) |
| PR 43 / 45 | Sub-Space Interdictor / Combat Transporters | stops teleporters / transports survive 50% |

Each player's research lists are random subsets (each candidate kept with prob. 50%, Psilon 75%), forced to contain at least one planetary shield, one robotic-controls tech, one missile and Hydrogen or Deuterium fuel cells, so not every tech exists in every game. [1oom game_generate_research; SG ch.10]

---

## 9. Reference tables

**T50 (cost miniaturization, % of original by levels above the item's base tech, index 0..50)**
100, 93, 87, 81, 76, 71, 66, 62, 58, 54, 50, 47, 44, 41, 38, 35, 33, 31, 29, 27, 25, 23, 22, 20, 19, 18, 16, 15, 14, 13, 13, 12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 4, 3, 3
**T25 (size miniaturization, same indexing)**
100, 97, 94, 92, 89, 87, 84, 82, 79, 77, 75, 73, 71, 69, 67, 65, 63, 61, 60, 58, 56, 55, 53, 52, 50, 49, 47, 46, 45, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 27, 26, 25, 24, 24
(Weapons use T50 for both cost and size; other specials T25 for size. [SG T10-2] samples: 1 level 97/93, 5 levels 87/71, 10 levels 75/50, 20 levels 56/25, 30 levels 42/13, 40 levels 32/6, 50 levels 24/3. Terraforming/cloning costs follow tech step tables, not miniaturization; Star Gates never miniaturize.)

**Other constants** (1oom `game_num_*` defaults): max pop 300; max factories 2500 (2700 in 1.3a ruleset); max inbound landing 300; atmos 200 / soil 150 / adv soil 300 BC; advanced-scanner explore radius 110 units; stargate cost 3000, upkeep 100; max ship upkeep cap 32000; planetary shield costs {0,500,1000,1500,2000}; base HP {50,75,100,125,150,175,200}; limit ships 32000; event roll 512; council every 25 years; `eco_slider_slack` 7 (slider is auto-disabled when ECO exceeds the waste% by more than 7 points).

---

## 10. 1oom ruleset notes (what "original" means)

Default flags (all `*_fix` off unless noted) reproduce original v1.3 quirks; always-on "1.3a" fixes: `ai_4_colony_curse_fix`, `max_factories=2700`, `bt_oracle_fix`, `orbital_weap_any`, `orbital_torpedo`, `ship_scanner_fix`, Guardian tweaks. Optional `fix_bugs` (off by default): `waste_calc_fix`, `pop_tenths_fix`, `factory_cost_fix`, `soil_rounding_fix`, `leaving_trans_fix`, `trans_redir_fix`, etc.
Quirks worth deciding about when porting: (a) pop-tenths double carry; (b) waste added twice (`sub1`, ~+20%); (c) soil enrichment rounding; (d) factory refit flat charge and empire-wide `oper`; (e) the 4%-slider ECO floor is computed without the quirk term; (f) `reset_tform_to_max`; (g) homeworld distance checks only for players 0 and 1; (h) AI production factor mapping (3.2); (i) starting design preset costs.

---

## 11. Conflicts and unverified items (summary)

1. Nebulae on Medium: code 1-3, [SG] 1-2.
2. Max-pop clamp: code 120, [SG] says 140.
3. Natural Fertile bonus: code floors to a multiple of 5 (`(m/20)*5`), [SG] "rounded up".
4. Stargate upkeep: code/AI doc 100 BC, [SG] 300 BC.
5. Nebula movement: code `6N+5` / `5N` units per turn, [SG] 1 parsec/turn.
6. Starting missile-base cost: formula 254 BC, [SG] ~283.
7. AI production multipliers (3.2) differ between code and [SG].
8. Sakkra pop-purchase multiplier: code ~3x (2/3 cost and x2), [SG] 2x.
9. Poor/ultra-poor percentages for Green/Red in [SG] T3-8 look swapped/off by 1.
10. Event victim weights and thresholds ([SG] production-squared and 30+ pop vs code planets count and 50 pop for quakes).
11. Map size in parsecs: [SG] nominal table vs coordinates (about 20/25/30/35 parsecs wide by the 11-unit axis-aligned step; ~10-unit/parsec on diagonals).
12. Planetology level formula: code `highest + count - ((highest-1)/5+2)`, [SG] "80% of highest + count".
13. Unverified: initial reserve BC = 0, initial tax = 0, initial security = 0 (never assigned in `game_new`); whether leftover ECO spending goes to the reserve ([SG] yes, code no); star-name display for unexplored stars; names 108/109 in the star name table; whether the ship slider really gets "+1 BC" in the original; slider-closing order on completion.
14. Not available (sites blocked): StrategyWiki/fandom pages (e.g. System_habitability, Growing_your_population) — numbers above were verified against [SG] and the code instead.

---

## 11b. Cross-check log (numbers confirmed by two or more independent sources)

- Galaxy sizes 24/48/70/108 stars: [1oom], [SG T3-2], [LP].
- Star colour shares 15/30/25/15/10/5 and non-hostile chances 85/65/65/25/35/5: [1oom] code probabilities = [SG T3-4].
- Planet-type percentages per star colour (normal and nebula): [1oom] roll tables reproduce [SG T3-5a/b] (only the OCR of White/Desert differs).
- Base max-pop ranges per type: [1oom] = [SG T3-6]; Rich/UltraRich probabilities: formula = [SG T3-9a/b] (all rows checked); Poor/UltraPoor: yellow/blue/white match, red/green within 1 point.
- Terraform levels/costs, cloning costs 20/10/5, eco-restoration 2/3/5/10/20, industrial-waste scale, factory cost ladder 10..2, Robotic Controls 2..7, fuel ranges 3..10, scanner ranges 3/5/7/9, planetary shields 500..2000: [1oom] = [SG App.I/Tables 6-1..6-3/8-3].
- Production formula: [1oom] `(3L+50)/100` per pop = [SG T5-1] (8 -> 0.74 ... 99 -> 3.47) and the tutorial values 82 / 88 BC (Klackon).
- Pop growth: [1oom] `0.1*pop*(1-pop/max)` = [SG] 10% -> 0%, Gaia 25/100 = 15%, tutorial 50 -> 52.
- Colony ship 570 (formula) / 591 (preset): [1oom] = [LP] = [SG] (Large hull 200 + colony base 350 + engines 20); scout 8/10; fighter 14.
- Research cost formula: [1oom] reproduces [SG tutorial] 100 / 220 / 500 RP.
- Transport speed (warp - 1, min 1), range 3 parsecs + 3 for reserve tanks, 2% upkeep, tax half to reserve, factory max = pop x robotics level, 25%-of-pop buy limit, max send = half pop: [1oom] = [SG] = [LP].
- Hull table and engine power 10 x warp: [1oom] = [SG T9-1].

---

## 12. Implementation notes for the port

- Keep map coordinates in 1oom map units; derive `star_dist` (parsecs) once with the 5+6 stepping routine (1.2; `ceil(euclid/11)` is only a rough substitute, off by up to 1-2 parsecs), cache it, compare against fuel/scan ranges and use `ceil(star_dist/speed)` for ETAs; use `dist_fast` for everything else listed in 1.2.
- Generate in the documented order (cells -> stars -> type/maxpop/specials -> Orion -> names -> homeworld search with up to 200 retries, regenerate on failure); seed all randomness from one seed.
- Store `max_pop1/2/3`, `waste`, `pop_tenths` as integers; do the economy exactly in the order of 7 (production -> eco/growth -> defence -> ships -> reserve -> industry), using integer division as written.
- UI: all stars visible; planet panel shows type, size (= max pop), growth label, special label; sliders 4%; research sliders 2%; ECO floor shown as "Clean". Facts from the originals: the info line shows the planet's **special** (Rich, Poor, Artifacts, ...) when it is not Normal, otherwise the **growth class** label (HOSTILE / FERTILE / GAIA / blank); max pop is printed as `max_pop3 - waste` (min 10) with a "+" when terraforming is still possible; each population icon = 10 million; the planet picture colour indicates the environment; a planetary shield is drawn as a blue haze with its class number; on the galaxy map the environment letter is green when colonizable now and red when it needs better technology; unexplored stars show only the star-colour blurb; distances are shown as "N parsecs"; ETA shown as turns. Slider text per slider (production time, "none", "max", "waste", "clean", "terraform", "+N pop") is derived from the same formulas as the turn processing. [SG ch.2, 1oom UI]
- "Planet size" art: choose sprite scale from `max_pop1` bands (no gameplay meaning).

---

## Appendix A. Copy-paste constants (JS-style)

```js
// ---- enums ----
const STAR = {YELLOW:0, RED:1, GREEN:2, WHITE:3, BLUE:4, NEUTRON:5};
const TYPE = {NONE:0, RADIATED:1, TOXIC:2, INFERNO:3, DEAD:4, TUNDRA:5, BARREN:6, MINIMAL:7,
              DESERT:8, STEPPE:9, ARID:10, OCEAN:11, JUNGLE:12, TERRAN:13};
const GROWTH = {HOSTILE:0, NORMAL:1, FERTILE:2, GAIA:3};
const SPECIAL = {ULTRA_POOR:0, POOR:1, NORMAL:2, ARTIFACTS:3, RICH:4, ULTRA_RICH:5, X4TECH:6};
const SLIDER = {SHIP:0, DEF:1, IND:2, ECO:3, TECH:4};

// ---- galaxy ----
const GALAXY = [ {w:6,h:4,stars:24,  nebula:[0,1]},   // small   (rnd_0_nm1(2))
                 {w:8,h:6,stars:48,  nebula:[1,3]},   // medium  (rnd_1_n(3)); SG says 1-2
                 {w:10,h:7,stars:70, nebula:[2,3]},   // large
                 {w:12,h:9,stars:108,nebula:[2,4]} ]; // huge
// cell (w,h): x = rnd_1_n(43)+28*w+9, y = rnd_1_n(51)+32*h+7, then +4 each; reject if dist_fast < 20 (earlier star left-of or above) / < 10 (right-and-below)
function starColour(r20 /*0..19*/) {
  return r20<=2?STAR.YELLOW : r20<=8?STAR.RED : r20<=13?STAR.GREEN : r20<=16?STAR.BLUE : r20<=18?STAR.WHITE : STAR.NEUTRON; }

// planet type by roll r = d20 (index r-1); in a nebula use r' = r-4 and clamp: r'<=0 -> NONE (Yellow: r'=0 TOXIC, r'=-1 RADIATED)
const TYPE_BY_ROLL = {
  [STAR.YELLOW ]: [3,5,6,7,8,9,10,10,11,11,12,12,13,13,13,13,13,13,13,13],
  [STAR.RED    ]: [0,1,2,3,4,5,6,7,8,8,9,9,10,10,10,11,11,12,12,13],
  [STAR.GREEN  ]: [0,1,2,3,4,5,6,7,8,9,9,10,10,11,11,12,12,13,13,13],
  [STAR.WHITE  ]: [0,0,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,10,11],
  [STAR.BLUE   ]: [0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,9,10],
  [STAR.NEUTRON]: [0,0,0,0,1,1,1,1,1,2,2,2,3,3,3,4,4,5,6,7] };

// max-pop base: value = rnd_1_n(n)*5 + off
const MAXPOP_BASE = {1:[7,5],2:[7,5],3:[7,5], 4:[7,15],5:[7,15], 6:[5,25],7:[5,25],
                     8:[4,30],9:[4,40],10:[4,50],11:[4,60], 12:[4,70], 13:[4,80]};  // [n, off]
// then: d=rnd_1_n(10); while(d==1||d==10){ v += (d==1?-20:20); v=max(v,10); d=rnd_1_n(10);} v=min(v,120);
// NONE: 10. Natural FERTILE (type>=9, 1/12): v += floor(v/20)*5

// ---- economy ----
const FACTORY_COST_BY_CN   = {0:10,3:9,8:8,13:7,18:6,23:5,28:4,33:3,38:2};        // CN tech -> base BC
const OPER_BY_CO           = {0:2,8:3,18:4,28:5,38:6,48:7};                          // CO tech -> factories per pop (Meklar +2)
const WASTE_SCALE_BY_CN    = {0:10,5:8,15:6,25:4,35:2,45:0};                         // x/10 waste per operating factory
const ECO_N_BY_PL          = {0:2,5:3,13:5,24:10,34:20};                             // waste units removed per BC
const TERRAFORM_BY_PL      = {0:[0,5],2:[10,5],8:[20,5],14:[30,4],20:[40,4],26:[50,3],32:[60,3],38:[80,2],44:[100,2],50:[120,2]}; // [level, BC per +1]
const POP_BUY_COST_BY_PL   = {0:20,21:10,42:5};                                      // BC per pop
const PROJECT_COST         = {ATMOS:200, SOIL:150, ADV_SOIL:300};
const SHIELD_COST          = [0,500,1000,1500,2000];                                 // classes none,V,X,XV,XX
const BASE_HP              = [50,75,100,125,150,175,200];
const FUEL_RANGE_BY_PR     = {0:3,3:4,5:5,9:6,14:7,19:8,23:9,29:10,41:30};
const SCANNER_BY_CO        = {0:[3,0],4:[5,1],13:[7,2],23:[9,3]};                    // [planet pc, ship pc]
const WARP_BY_PR           = {1:1,6:2,12:3,18:4,24:5,30:6,36:7,42:8,48:9};
const MINERAL_MULT         = [1/3, 1/2, 1, 1, 2, 3, 1];                              // by SPECIAL index (ARTIFACTS and X4TECH only affect research)
const RESEARCH_SPECIAL_MULT= [1,1,1,2,1,1,4];
const MAX_POP = 300, MAX_FACTORIES = 2700 /*2500 original*/, MAX_INBOUND = 300;
const STARGATE = {cost:3000, upkeep:100 /*SG: 300*/, speed:35};
const COLONY_BASE_COST_BC  = {STANDARD:350, BARREN:375, TUNDRA:400, DEAD:425, INFERNO:450, TOXIC:475, RADIATED:500};
const HULL = [ {cost10:60,   space:40,   hits:3,   power:2,   defense:+2},
               {cost10:360,  space:200,  hits:18,  power:15,  defense:+1},
               {cost10:2000, space:1000, hits:100, power:100, defense:0},
               {cost10:12000,space:5000, hits:600, power:700, defense:-1} ];
const ENGINE = [ // power, space, cost10, warp, techPR
  [10,10,20,1,1],[20,18,40,2,6],[30,26,60,3,12],[40,33,80,4,18],[50,36,100,5,24],
  [60,40,120,6,30],[70,44,140,7,36],[80,47,160,8,42],[90,50,180,9,48] ];
```

## Appendix B. One-turn planet update (pseudo-code, 1oom order)

```
for each owned planet P (after transports left, after update_production):
    // --- ecology + growth (build_eco) ---
    P.waste += floor((100 - floor(P.waste*100/P.max_pop2)) * floor(min(P.factories,P.pop*oper)*waste_scale/10) / 100)
    eco = floor(P.spendable * P.slider[ECO] / 100)
    clean waste (n units/BC) -> then ATMOS/SOIL/ADV_SOIL project -> terraform +1 per cost_per_inc -> buy pop (10/inc_pop_cost tenths per BC, <= 25% pop)
    P.pop += (natural_growth_tenths + bought_tenths + P.pop_tenths) / 10 ; P.pop_tenths = ... % 10 ; clamp to [0, max_pop3]
    // --- production spending ---
    DEF : upgrade bases -> shield -> new bases
    SHIP: ships (or stargate)
    IND : factories (cap max_pop3*oper, overflow/2 -> empire reserve)
    TECH: research points (summed earlier)
empire: reserve += floor(G*tax/2000); upkeep, trade as in 3.3; planet.reserve decays by prod/2
then movement, combat, research discovery, explore/colonize, transports land, events, year += 1
```


