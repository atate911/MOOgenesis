# Master of Orion (1993) - Interface, Screens, Flow, Presentation and Audio

Research slice 06 for the browser remake of **Master of Orion 1** (MicroProse / SimTex, MS-DOS, Sept 1993; last official patch v1.3). Compiled 2026-10-11.
Scope is MOO1 only. Anything that belongs to MOO II (1996) or the 2016 remake is explicitly marked "NOT MOO1".

Purpose: preserve the *feel, flow and information design* of the original while hugely upgrading the graphics. The remake draws its own art, fonts, portraits, text and music
(see `00-original-screens-notes.md`: "imperial observatory" style). Colours/fonts/art below are described only so we understand the original's mood, never to be copied.

---

## 0. How to read this file

| Tag | Meaning |
|---|---|
| [S] | Seen directly in a real MOO1 screenshot (lparchive.org "Master of Orion" Let's Play by Thotimx; oldgames.sk gallery; filfre.net article) |
| [C] | Read from the source code of **1oom** (open-source re-implementation of the v1.3 engine, github.com/1oom-fork/1oom, `src/ui/classic/*.c`, `src/game/*.c`). Reliable for layout, coordinates, hotkeys, IDs and flow. Text strings live in the original LBX data files, not in the code |
| [T] | Text description from a Let's Play, manual excerpt, wiki, review or article |
| [1oom+] | Feature that exists in 1oom but is NOT in the original game. Treat as a modern quality-of-life hint, not as original behaviour |
| [?] | Unverified / inferred |

All pixel coordinates are in the original 320x200 space (x right, y down). Display year = internal year + 2299, so the first turn is **year 2300**; one turn = one year.

---

## 1. One-page summary: what defines the MOO1 interface

1. **One hub screen** (the "Control screen"): scrollable galaxy map (left ~70%), context panel (right ~28%), 8-button bottom bar. Nearly everything is reachable in two clicks (the Digital Antiquarian's verdict on the interface).
2. **Sliders, not build queues**: 5 spending sliders per colony (Ship / Def / Ind / Eco / Tech) and 6 research sliders (one per tech field). Each slider has a lock; changing one automatically rebalances the unlocked others so the total is always 100%.
3. **Blunt, terse labels** and live readouts next to every slider ("NONE", "2.2/Y", "CLEAN", "MAX", "T-FORM", "204 RP"). No hover tooltips at all: help is an F1 overlay of annotated boxes, plus one-time "tutor" pop-ups on Simple/Easy.
4. **Character "vignette" screens** give events weight: the golden robot newscaster (GNN), the hooded emperor facing a holographic alien ambassador (audience), the High Council chamber, the scientist at a console (research choice / breakthrough), the landing/invasion animations.
5. **Everything else is a full-screen "ledger" screen** in a brown/bronze table style (Planets, Fleet, Races, Report, Status, Map, Tech) opened from the bottom bar and closed with OK / Space / Esc.
6. **Event-driven audio**: 40 music tracks, 41 sound effects; the galaxy map itself has **no music** (the starmap stops music on entry [C]). Music plays for the menu, intro, combat, diplomacy (per race, two moods), GNN, research jingles, colonisation, bombardment, ground combat, spy screens, the Council and the endings.
7. **Fixed 320x200 VGA, 256 colours, hand-painted pixel art** (Deluxe Paint per GameStar) with a pre-rendered 3D intro. Chunky metallic-bevel chrome, dark space, saturated accent colours.
8. **Mouse-first**: right-click / Esc = cancel, Space = accept/continue everywhere, first-letter hotkeys on buttons, F-keys to cycle colonies/fleets, keypad can drive the cursor (Num Lock on).

### 1.1 Implementer's cheat-sheet (the 12 rules that reproduce the feel)
1. Build the **Control screen first**: map | context panel | 8 bottom buttons (Game, Design, Fleet, Map, Races, Planets, Tech, Next Turn). Everything else is a screen opened from it and closed with OK / Space / Esc / right-click.
2. **Colony panel = 5 sliders** (Ship, Def, Ind, Eco, Tech), 4% steps, a lock per row, a text readout per row, and the **greedy auto-balance rule with Tech as the shock absorber** (see 4.5).
3. **Research panel = 6 sliders** (2% steps) with field tabs, a light-bulb meter, a per-field capability line, "choose next research" and "breakthrough" scientist scenes.
4. **Sending ships** = click your star, set per-design counts with << < > >> steppers, click a destination (green line = in range, red = out), read "ETA n TURNS", press Accept (Space) / Cancel (Esc). No separate "split" command.
5. **Ship design** = 6 base slots + 4 weapon slots + 3 special slots + hull size, pop-up tables with cost / size / power / space, live cost and free-space readouts, max 6 active designs.
6. **Ledger skin** shared by Planets, Fleet, Specs, Races, Report, Status, Map, Tech: bronze frame, dark cells, orange/teal titles, bar charts for comparisons.
7. **Scene screens** (GNN, audience, Council, scientist lab, landing, ground combat, endings) are short, skippable with Space, and carry the personality; keep them cheap to trigger and never mandatory beyond one click.
8. **Combat** = 10 x 8 grid, priority-order turns, Wait / Done / Retreat / Auto, missile toggle, scan, specials; battles only at planets.
9. **Input grammar**: Space = accept/continue, Esc or right-click = cancel, first-letter hotkeys, F2-F9 cycling of colonies / fleets / threats, F10 quick save, F1 help.
10. **Audio**: map silent; confirm + cancel clicks; music only for scenes; each race has a calm and a hostile audience track.
11. **Saves**: 6 named slots + "Continue" (written when you leave through the Game menu and on F10).
12. **Information style**: terse caps labels and live readouts; no tooltips originally (add them, plus an optional F1 annotated overlay).

---

## 2. Technical frame and global conventions

### 2.1 Display, palette, assets
- 320x200 VGA mode, 256-colour palette, shown at 4:3 (non-square pixels). Different screen groups load their own palette (1oom selects palettes 0-6 per group: main, intro, game menu, new-game/vortex, landing...), so each full-screen vignette has its own colour grading [C].
- Screen transitions are **palette fades to/from black**: quick fades use 4-7 steps (about 0.2-0.4 s), slow cinematic fades up to ~33 steps (about 1.8 s), plus a "pixel-scramble dissolve" for the GNN broadcast [C]. Nothing slides or animates in; panels simply appear.
- Original data archives (33 `.LBX` files, ~11 MB / 45 files installed [T]) [C]: BACKGRND (management-screen frames), COLONIES, COUNCIL, DESIGN, DIPLOMAT, EMBASSY (audience), EVENTMSG (event text), FIRING (weapon FX), FONTS, HELP, INTRO, INTRO2, INTROSND, LANDING, MISSILE, MUSIC (40 XMI tracks), NAMES, NEBULA, NEWSCAST (GNN), PLANETS, RESEARCH, SCREENS, SHIPS, SHIPS2, SOUNDFX (41 samples), SPACE (battle backdrops), SPIES, STARMAP, STARVIEW, TECHNO (tech lab art), V11, VORTEX (title / menus / new game / save / load), WINLOSE (endings).
- Ship art: roughly 144 ship sprites (4 hulls x 6 banner colours x 6 looks [?]); the banner colour picked at game start fixes your ship livery [T].

### 2.2 Cursors [S][C][T]
- Standard cursor everywhere: a beige gloved **pointing hand** [S].
- Galaxy map: small green **target reticle / crosshair** on the selected star [S]; a "question mark" cursor on stars (1oom has an option to disable it) [C]; **red crossed-out circle** = cannot send there; ship-arrow cursor when the destination is in range [T].
- Cursor sprites are 16x16 [C]. Selection reticle on a star = four green corner brackets that blink [S][C].

### 2.3 Input conventions (apply to every screen) [C]
| Input | Behaviour |
|---|---|
| Left click | Select / activate. Lists: click row |
| Right click | **Cancel / back** (on empty space returns "cancel"; on an object returns a distinct "right-click on item") |
| Esc | Cancel / close |
| Space | Accept / continue / OK on almost every popup (mouse areas are registered "full-screen = Space") |
| Enter | Activate the item under the cursor / first list line |
| First-letter hotkeys | Most buttons activate with the first letter of their label (stated in the v1.2 manual) [T] |
| Arrow keys / keypad 1-9 | Move the cursor to the nearest clickable object in that direction (original also supports full keypad cursor control, Num Lock on) [C][T] |
| Y / N | Yes / No dialogs (Esc = No) |
| + / - | Nudge slider under cursor |
| F1 | Context help overlay for the current screen (if the screen set a help id) |
| Ctrl / Alt modifiers | Step-size modifiers on counters/sliders (Ctrl = fine/+-10, Alt = jump to min/max or apply-to-all): listed under 1oom's "New hotkeys", so treat as [1oom+] QoL, not original |

### 2.4 Timing [C]
- All UI pauses are counted in **BIOS ticks (18.2 Hz = 54.9 ms)**. Typical popups redraw every 3-4 ticks (about 165-220 ms) - the animation feel is deliberately slow and chunky (frames held 3 ticks, sprite loops of 5 frames).
- Any pause can be cut short by a click or Space.

### 2.5 Text and numbers
- Money is **BC** (the game's credit unit; expansion of the abbreviation not verified) written "543 BC", "BC/year"; research points "RP"; "Y" = years/turns; populations in millions ("Moving 1 Million"); distances in **parsecs** ("Range 5 Parsecs"); ETA text "ETA 3 TURNS".
- Years shown as "Year 2304". The Status screen is the one screen that always shows the year [T]; the Fleet Production report and player-switch screen also show it [S][C].

### 2.6 Widget catalogue (everything the UI is built from) [C][S]
| Widget | Where | Behaviour |
|---|---|---|
| Bevelled push button | bottom bar, OK/Cancel/Accept, SHIPS/RELOC/TRANS, SPECS/SCRAP | pressed look while held; hotkey = first letter; plays SFX 0x24 |
| Toggle / 3-way radio | Game menu Silent / FX / Music; COLONIES / ENVIRONMENTS / MINERALS; HIDE / SABOTAGE / ESPIONAGE | exactly one active |
| Tab button | tech fields (2x3 grid) | selected = red-brown, others navy |
| **Slider with arrows and lock** | colony (5, 4% steps), research (6, 2% steps), spy network, security, tax, transports, scrap-bases, transfer | red left/right arrow buttons step the value; drag the bar; click the label cell to lock; rows rebalance to 100% |
| Spinner (up/down arrow pair) | weapon counts, ship icon / look | click = +-1 ([1oom+]: Ctrl = +-10, Alt = extreme) |
| Four-arrow selector (<< < > >>) | Fleet Deployment ship counts | none / minus / plus / all |
| Pop-up table list | component pickers, weapons, specials, research choices, audience menus, council vote | click or Enter to choose, Esc / right-click cancels, dim rows disabled |
| Text input | rename planet, save name, emperor / homeworld name, ship name | blinking cursor; first Backspace clears; Enter/click confirms; Esc cancels |
| Hot-spot ("mouse area") | stars on the map, fleet icons, portraits, whole-screen "click anywhere = Space" | invisible; owns a hotkey |
| Bar chart | Racial Stats | one thin bar per empire in banner colour |
| Light-bulb meter | Tech screen | fill = chance of breakthrough |
| Picture tile | fleet lists, new ships, production report | starfield tile + sprite + count + name strip |

---

## 3. Game start flow

### 3.1 Boot sequence
1. (v1.3) **Copy-protection check** [C]: shows a ship sprite and asks you to pick its name from 8 choices, referencing a manual page range ("Pages min-max"); 3 attempts; failure ends the game as a loss. *Drop in the remake.*
2. **Intro movie** (skippable with click or Esc) [C][T]. Seven scenes from INTRO/INTRO2.LBX: scene frame counts 115, 30, 70, 69, 40, 30, 180 at 3-4 ticks per frame, i.e. roughly 95 seconds total (derived). Music track 0. Three SFX samples in INTROSND. A pre-rendered 3D sequence (GameStar) showing the setting; a TechRepublic gallery describes credits, then an alien attack on a base and a missile-defence response [?]. It ends on the "MASTER OF ORION" logo card (magenta chrome letters over a planet) [S].
3. **Title / main menu** (music track 1).

### 3.2 Title / main menu [S][C]
- Background: deep purple vortex; a twin-engined fighter seen from behind with **spinning engine glows**; purplish particles are continuously sucked into the vortex [T]. Big chrome "MASTER OF ORION" logo (grey metallic letters) [S].
- Menu items in **gold chunky caps**, centred, stacked: **Continue Game / Load Game / New Game / Quit To Dos**. Footer text: "PROGRAM VERSION 1.3 (c)1993 SIMTEX SOFTWARE" [S].
- "Continue Game" loads the auto-saved "Continue" slot; greyed when none exists [C][T].
- Hotkeys: first letters [T][?]. Each activation plays SFX 0x24 [C].
- [1oom+] adds Rules / UI Options / Custom Game / Challenge / Tutor. (A "Tutor" preset exists in code: Medium galaxy, 4 players, Simple, Klackon, white banner, "Mr Tutor", seed fixed [C]; whether the original exposed it is unverified.)

### 3.3 New Game options screen [S][C][T]
Art: a lunar-surface backdrop with a planet; three **orange glossy slabs** (label on the left, value in a black inset box on the right) and **Cancel** / **Ok** red-brown buttons at the bottom.

| Option | Allowed values | Notes |
|---|---|---|
| **Galaxy Size** | Small, Medium, Large, Huge | 24 / 48 / 70 / 108 stars (grids 6x4, 8x6, 10x7, 12x9). Random nebulae: 0-1 / 1-3 / 2-3 / 2-4 [C] |
| **Difficulty** | Simple, Easy, Average, Hard, Impossible | AI handicap/bonus: Easy/Hard +-20%, Simple/Impossible +-40% (LP) [T]; Hard and Impossible start the player with less population (40 vs 50) [C]. Simple/Easy additionally show one-time "tutor" help pop-ups [C] |
| **Opponents** | One, Two, Three, Four, Five | 2-6 empires total |

- Clicking a slab **cycles** the value (keys g / d / o also cycle) [C]. The screen **remembers the last used values** [T].
- Buttons: **Cancel** (Esc) and **Ok** (Space) [C].

**NOT options in MOO1** (these are MOO II / later concepts; do not add them to the "faithful" mode):
- No "galaxy age", no tech-level start, no custom race designer, no "tactical combat on/off" (each battle simply offers Auto vs manual), no "random events on/off", no "Antarans on/off" (Antarans do not exist in MOO1 - they arrive in MOO II [?]).
- Random events, space monsters, the Orion Guardian and the Council are always on.

### 3.4 Race, banner, name (3 consecutive screens, same backdrop) [S][C]
Backdrop (all three): painted scene - the curved limb of a blue cloud-streaked planet at left, a space station and a purple nebula-star at right, a ship and a moon.

1. **"Choose Race"**: vertical list of 10 names in this order: **Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok**. Hovering/selecting a race shows a framed **portrait** plus a **three-line capitalised tagline** under it (e.g. Psilon: "SUPERIOR RESEARCH TECHNIQUES"; Darlok: "SUPREME SPIES") [S]. (The other eight taglines are in the original string table; not captured here.) [1oom+] adds "Random".
2. **"Choose Banner"**: list **Blue, Green, Purple, Red, White, Yellow** with a framed **animated waving flag** preview in that colour [S][C]. The banner colour is your flag, your name colour on the map and your **ship livery**. AI empires get the remaining colours; the AI never plays the same race you pick [T].
3. **"Your Name..."**: single text field pre-filled with a default Emperor name (6 names per race stored in NAMES.LBX; random pick; e.g. "Zygot" for Psilon) [S][C]. A second prompt asks for the **homeworld name** (one fixed default per race, e.g. "Mentar" for Psilon) [C][T]. Names are short (~11 chars emperor [C]); letters, digits, space, hyphen; Esc cancels [C].

### 3.5 Starting position [C][T]
One homeworld (Terran, yellow star, max pop 100; current pop 50 on Average or below, 40 on Hard/Impossible; 30 factories), **2 scouts + 1 colony ship** (plus 1 premade design set: Scout, Fighter, Destroyer, Bomber, Colony Ship) and a clean galaxy fog. The first screen is the Control screen centred on the homeworld; on Simple/Easy a one-time tutor help page opens in year 1 [C].

---

## 4. The Control screen (galaxy map + context panel)

### 4.1 Layout (320x200) [C][S]
```
+--------------------------------------------+-----------------+
| MAP VIEWPORT x 7-221, y 7-177              | RIGHT PANEL     |
| stars, nebulae, flags, ship icons, routes  | x 224-314       |
| (scrollable; 2x scale; star glare hides    | y 5-178         |
|  the single planet of each system)         | (context panel) |
+--------------------------------------------+-----------------+
| [Game][Design][Fleet][Map][Races][Planets][Tech][Next Turn]   |  y 181-194
+---------------------------------------------------------------+
```
Frame: light steel-grey bevelled border around everything; bottom buttons are navy-blue bevelled plates with pale-lavender text; hover recolours the label [S][C].

### 4.2 Bottom button row [C]
| Button | x-range | Hotkey (original -> 1oom "fixed") | Opens |
|---|---|---|---|
| Game | 5-36 | G | Game menu (Save/Load/Quit/sound) |
| Design | 40-75 | D | Ship Design editor |
| Fleet | 79-111 | F | Fleet screen |
| Map | 115-139 | M | Galaxy Map overview |
| Races | 143-176 | R (A in fixed) | Races / diplomacy |
| Planets | 180-221 | P | Planets ledger |
| Tech | 225-254 | T | Research screen |
| Next Turn | 258-314 | N | Ends the turn |

### 4.3 Map rendering [S][C][T]
- **Background**: black starfield with two tiled parallax layers; sparse **purple blotches = nebulae** (ships move at most 1 parsec/year and shields do not work inside) [T][C].
- **Stars** are small glowing 4-point crosses; colour = star class, a hint to planet quality (before exploration) [T] - see the table below.
- Stars animate (5-frame twinkle then random frame) [C]. Unexplored stars use a plain small glyph.
- **Labels**: system name under the star only for owned/visible/in-contact stars, coloured in the owner's banner colour; unowned = neutral colour [C][S]. A coloured **flag** marks colonies.
- **Fleets**: tiny ship icons in banner colour pointing left/right in the direction of travel; orbiting fleets are small icons stacked next to the star; transports use a different small glyph [S][C].
- **Route lines**: green line from the selected fleet to its destination when in range, red when out of range; red line from an enemy fleet to the planet it is heading to (needs a scanner tech); thin blue-grey lines show your RELOC (rally) routes [S][C].
- **Selection reticle**: green dotted/bracket frame around the focused star; blinks [S][C].
- **Optional overlays**: 5-parsec **grid** (Alt-M) [T][C]; Alt-C re-centres the map on the selected planet [T].
- **Range**: "Range N Parsecs" text appears in the right panel for any star you point at; colonisation/fuel range is measured from your nearest owned planet (starts at 3 parsecs) [T][S].
- **Monsters** (Space Crystal, Space Amoeba) are drawn as special sprites with text labels [C]; the Orion Guardian has its own marker/label at the Orion system (the LP mentions a "G") [T][?].
- Scrolling: click an empty part of the map to re-centre; Ctrl+keypad scrolls; PageUp/PageDown change zoom 1x..UI scale (1oom) [T][C]. [1oom+]: mouse-wheel zoom, edge scrolling, "uhjk" keys, search box "/" to jump to a planet by name.

| Star colour | Meaning (Let's Play text) |
|---|---|
| Yellow | best chance of normal habitable planets (all homeworlds orbit yellow stars [C]) |
| Green | wide range of planet types |
| Red | old stars, mostly poor planets |
| Blue | young stars, mineral-rich lifeless planets |
| White | very hot, generally hostile |
| Purple | neutron stars, best chance of rich planets |

### 4.4 Right panel states [S][C]
The panel header (y 8-20) is a navy name bar with the star name in **gold chunky letters** (click renames your own planet). Below it a red-bordered "info box" shows the planet picture and class text. The lower area depends on what is selected:

| Selection | Panel content |
|---|---|
| **Own colony** | Info box: class (e.g. TERRAN) in yellow, "POP 100 MAX" in green. Rows: `POP n` and `BASES n`; `PRODUCTION n (m)` (n = after maintenance, m = total, in green); **5 slider rows** (4.5); a **build box** (current ship design picture, name, small counter) and 3 buttons **SHIPS / RELOC / TRANS** |
| **Enemy colony** | Info box + `POP n` / `BASES n` (last known) and a lower panel showing the race's colony picture, "Darlok Colony", "Range 6 Parsecs" (or "Last reported as ..." when out of scanner range) |
| **Uninhabited, explored** | Info box shows class + HOSTILE/standard flag + "POP n MAX"; a strip reads "NO COLONIES"; below it a star/planet picture with "Range 5 Parsecs" |
| **Unexplored** | Red-framed box reading **UNEXPLORED** (green letters); lower panel shows the range and a generic star picture |
| **Fleet in orbit** (own) | Replaced by **Fleet Deployment** (5.4) |
| **Fleet en route** | Banner header "<Race> Fleet / ETA n TURNS", ship-type grid (2 columns), destination text; own fleets allow re-routing |
| **Event cards** | "Scout ships explore a new star system" + planet picture + environment/special notes + CONTINUE; or "Build a new colony?" with NO / YES; or "Space Combat - Guardian attacks Klackons" + CONTINUE |

Status text in the info box has priority order: plague, nova, comet, pirates, rebellion, unrest, accident; otherwise the growth/special text (e.g. "Hostile environment - population growth is halved", rich/poor/artifact notes) [C][S].

### 4.5 The colony panel in detail (own planet) [S][C]
Rows (top to bottom):
1. **Name bar** (click to rename; mouse wheel cycles planets [1oom+]).
2. **Info box**: planet picture (left), class text + HOSTILE tag + "POP n MAX" (right). Pop max shows a "+" when soil enrichment / atmospheric terraforming can still raise it [1oom+].
3. `POP` and `BASES` boxes; key **B** opens the scrap-missile-bases slider dialog (original) [T]; clicking the Bases text does the same [1oom+].
4. `PRODUCTION n (m)`.
5. **Five slider rows**, y = 81 + 11*i. Each row = **label/lock cell** (click toggles the lock; locked rows tint) + **slider track** (25 px wide = 25 steps of 4%) with red left/right arrow buttons + **readout cell** (right-aligned text). Raising one slider auto-lowers the unlocked others [C][T]. Label cells: `Ship`, `Def`, `Ind`, `Eco`, `Tech`.

| Row | Meaning | Readout text examples |
|---|---|---|
| Ship | production into the selected ship design | `NONE`, `1 Y`, `80 Y` (years per ship at current spending) |
| Def | missile bases / planetary shield | `NONE`, `4 Y` (years per base) |
| Ind | new factories | `2.2/Y` (factories per year), `MAX` when factory limit reached, `5/Y` |
| Eco | pollution cleanup, then terraforming / growth | `CLEAN`, `WASTE` (not enough), `T-FORM` (terraforming), `+n` (population growth) |
| Tech | research points | `0 RP`, `204 RP` |

**Slider auto-balance rule (from `game_adjust_slider_group` in 1oom `src/game/game_misc.c`)** [C] - this is what gives the original its feel: it is a *greedy* rule, not a proportional one. (Reconstructed from a tool summary of the code, not read line-by-line - confirm by reading the function or testing in the real game before locking the implementation.)
1. Budget = 100 minus the sum of the **locked** sliders. The slider you moved is clamped to that budget.
2. Walk the *other unlocked* sliders in fixed index order (Ship, Def, Ind, Eco, Tech): each keeps its value while budget remains; the first one that no longer fits is cut to the remaining budget, and every later one drops to 0.
3. If budget is left over (you lowered something), the surplus goes to the **last unlocked slider** (normally **Tech**); if you were moving the last slider itself, the surplus goes to the first unlocked slider.
Consequences the UI teaches: Tech (research) is the shock absorber - freed production flows to research; raising Ship/Industry first eats Tech, then Eco, etc. Locking Eco/Tech (click their label cell) protects them. When waste grows, the Eco slider is forced up and SHIP/DEF/IND are reduced proportionally, with Tech taking the remainder. Tech-screen "equalise" spreads the unlocked total evenly (first sliders get the remainder) [C].

6. **Build box** (x 228-275, y 139-175): yellow-framed picture of the design currently being built, its name under it (e.g. SCOUT, RECON, FIGHTER, COLONIZER) and a small counter; **click the picture to cycle designs** or use SHIPS. A Stargate icon appears if a Stargate is being built [S][C].
7. Buttons (x 282): **SHIPS** (y 140, key S): choose design; **RELOC** (y 152, key L originally, R in fixed): set the rally point where new ships go; **TRANS** (y 164, key X): send up to half the population to another planet [C][T].

### 4.6 Keyboard map on the Control screen [C][T]
| Keys | Action |
|---|---|
| G D F M R P T N | Bottom-bar screens / Next Turn (see 4.2) |
| F1 | Help overlay |
| F2 / F3 | Previous / next **own colony** |
| F4 / F5 | Next / previous colony **with ships in orbit** (opens fleet deployment) |
| F6 / F7 | Next / previous colony with **newly built ships** |
| F8 / F9 | Next / previous **colony with an incoming enemy fleet/transport** (needs Improved/Advanced Space Scanner tech) |
| F10 | Quick-save into the "Continue" slot |
| B | Scrap missile bases (slider dialog) |
| C | Show "Spies Caught" report |
| Alt-C | Centre map on selected planet |
| Alt-M | Toggle 5-parsec grid |
| Alt-R | Point **all** colonies' RELOC lines at the selected planet; pressing it on a planet that already relocates elsewhere cancels those flows |
| = (or #) | [1oom+] move production into / back out of the planetary reserve for the selected colony |
| / | [1oom+] search planet by name |
Sources disagree on the exact F4-F7 naming (StrategyWiki says "garrison fleets / newly created fleets / all fleets"); the behaviour "cycle through a category of colonies or fleets" is what matters.
**Provenance caveat**: the 1993 release was essentially mouse-driven; the F-key and Alt-key hotkeys were added by a later patch (the official v1.3 and/or the 2013 fan "Unofficial Code Patch" - sources conflict on which key came from which) [T][?]. The manual (v1.2) already documents first-letter button hotkeys and keypad cursor control [T]. For the remake treat all of them as desirable, documented shortcuts.

### 4.7 Mouse behaviours on the map [C][T]
- Click star: set focus -> panel updates. Click the focused star again (or the red box at the top of the panel) to open the **star-system view** (5.2) [T].
- Click an own fleet icon next to a star: opens Fleet Deployment. Click an en-route fleet: opens its info/redirect panel. Click an enemy fleet: shows its ships (needs scanner/contact) [C].
- Click the name bar: rename planet. Click a slider's label cell: lock/unlock. Click the red arrows: step 4% (colony) / 2% (tech); drag the bar to set. [1oom+]: Ctrl = single step, Alt = jump to 0/100, and Ctrl/Alt while locking applies to all colonies (or all of the same special).
- Click the **ship picture**: cycle build design [C]. Click POP/BASES etc. only informational.

### 4.8 What happens on "Next Turn" [C][T]
1. Button text greys; the map plays **fleet movement animation** for a moment (ships glide along routes).
2. In order (human player): spy reports -> battles (pre-battle panel -> tactical or auto) -> spy results (steal/sabotage screens) -> **new technology** scenes (lab with scientist, "choose next research") -> **exploration** cards (scouts reach a star; colony ships ask "Build a new colony?"), bombardment screens, colonist transports landing, ground combat, coups -> **random events** (shown as GNN broadcasts) -> artifact loot -> more tech scenes -> AI diplomacy (audience screens: AI-initiated offers/threats) -> **Galactic Council** if due -> year increments -> back to the map with queued notices: the **Fleet Production report** (a "Year 2304 / Fleet Production" panel with ship icons and counts), a **factory-limit notice** (the planet hit its industry maximum, surplus spending went to the planetary reserve, plus a second box saying the spending ratios may be changed now), the **Spies Caught** table, and a new-ship summary.
3. Production-complete notices are interactive: you can adjust the colony's sliders directly on that notice screen ("most important tip" - QT3 guide) [T].
4. A source comment in 1oom says the original autosaved every 5 turns (not replicated there); the manual says leaving through Game->Quit autosaves "Continue" [T][C][?].

---

## 5. Management screens (each opened from the Control screen)

### 5.1 Galaxy Map overview ("Map" button) [S][C]
- Full-screen **bronze/rust-brown bevelled frame**. Left: the whole galaxy (stars as dots/crosses over a faint blue dotted "nebula noise" texture, purple nebula blobs). Four green corner brackets show where the main-view window currently is. Right column: gold title **"Galaxy Map"**, three grey push buttons **COLONIES / ENVIRONMENTS / MINERALS** (keys C / E / M; default Colonies), a **"Map Key"** legend panel, and **OK** (Space / Esc) at the bottom right (246,181) [C].
- **Colonies mode**: stars in class colour with empire flags; the key lists each empire (yours first) with its flag colour and race name; a thin **lavender outline** encloses the region you can currently see/reach [S][T].
- **Environments mode**: explored stars get a letter coloured green when you can colonise that type now and red when "unable to land on". Key: green T Terran, J Jungle, O Ocean, A Arid, S Steppe, D Desert, M Minimal; red B Barren, U Tundra, E Dead, I Inferno, P Toxic, R Radiated, N None [S].
- **Minerals mode**: explored stars show their special as text. Key: ULTRA POOR 1/3 PROD, POOR 1/2 PROD (red); RICH 2x PROD, ULTRA RICH 3x PROD (blue); ARTIFACTS 2x TECH, ORION 4x TECH (green); footer "Production bonuses apply to industry, ships and defense" [S].
- Clicking a star closes the screen and focuses that star on the main map [C]. Help id 9.

### 5.2 Star-system view (click the focused star again) [S][C]
- Full-screen painted scene: the **planet** large in the lower-left (texture by type), the **star** glowing top-right in its class colour, planet name centred at top with a second line "**<type> environment**" (e.g. "Tyr / minimal environment").
- Own/enemy fleets in orbit appear as small animated icons (5-frame loop) with counts (up to 6 designs); a shield label ("Class V shield" as a sentence with a Roman numeral) top-left if shielded; a stargate label if present.
- Info box lower-right, green border on black: **PLANET SIZE, FACTORIES, WASTE, POPULATION, GROWTH** (growth signed only on your planets). Bottom-left rows of tiny **icons**: population figures, factory icons, base icons (one icon per 5 bases), waste icons [S].
- Unowned habitable planets show their special/growth notes as text (Ultra Poor / Poor / Rich / Ultra Rich, Artifacts (2x tech), 4x tech) [C].
- Exit: click or any key. Help id 34. Palette fades in/out.

### 5.3 Exploration card and colonisation [S][C][T]
- Scout/scanner arrives at an unexplored star: the right panel swaps to a card "**Scout ships explore a new star system**" with the planet picture, class/environment line, notes like "**Hostile Environment - population growth is halved**" or mineral/artifact notes, and a **CONTINUE** button (C / Space / Esc). A scanner-based variant begins "planet scanner explore star system" [C].
- Colony ship arrives at a colonisable planet: card "**Build a new colony?**" with the starview picture and **NO / YES** (N / Y) [S].
- **YES -> landing animation** (LANDING.LBX): a backdrop chosen by planet type, a colony ship descends over ~50 frames at 4 px/frame, lands; a small text box appears; header shows year and race; music track 10; Space/click skips; then a **rename-your-planet prompt** (pre-filled name) [C][T]. The same screen is reused for invasions with different backdrops and music (see 6.4).
- A "Population growth is halved" style note appears for hostile planets; "first colony needs a colony ship" etc. are enforced on the Transport screen.

### 5.4 Fleet Deployment (how you send ships) [S][C][T]
1. Click a star where you have ships in orbit (or press F4/F5 to cycle such stars). The right panel becomes **"FLEET DEPLOYMENT"** (red title).
2. One row per ship design in orbit: ship picture (count at bottom-right), design name tag, and four arrow buttons **<< < > >>** (set to none / minus / plus / all). Step size = 1/10 of available ships (min 1) [C]; [1oom+] Ctrl forces step 1 and the mouse wheel changes the count.
3. Prompt in green on grey: "**CHOOSE DESTINATION AND NUMBER TO SEND**".
4. Click any star: a route line appears (**green** if inside fuel range, **red** if not; range 1 = reachable, range 2 = only with reserve tanks). The panel shows **ETA n TURNS** (slowest selected engine), a Stargate notice if both ends have gates, or "out of range by N parsecs". The destination's name/picture appears in the panel header [C][T].
5. **ACCEPT** (Space) is enabled only for a valid, in-range destination with at least one ship selected; **CANCEL** (Esc). Shift-accept keeps the panel open [1oom+]. Clicking the already-selected destination = accept [1oom+].
- You cannot split a design into several destinations in one go; you send the selected counts, then reselect. There is no separate "split" tool - selection counts are the split [C].
- Ships in orbit of an AI planet are treated as "bad form" and annoy that empire [T].
- Colony ships/outposts are sent the same way; arrival triggers the colonise prompt (5.3).

### 5.5 Fleets in transit and enemy fleets [S][C]
- Selecting a moving fleet shows a banner-coloured header "**Silicoid Fleet**" / "**Psilon Fleet**", a small **scanner-dish animation** and "**ETA n TURN(S)**", then up to 6 ship tiles (2 columns; starfield tile, ship sprite, count, name tag) or a single transport line ("1 Colony Transport", ship picture, "Destination Tyr") [S].
- Your own en-route fleet can be **re-routed**: click a new star; line turns green/red; ACCEPT/CANCEL (Space/Esc). Retreating fleets cannot be sent back to the planet they flee [C].
- Enemy fleets are visible only with scanner range or contact; incoming enemy fleets get a **red route line** to their target (needs Improved/Advanced Space Scanner) [C][T]. F4/F5 cycles fleets of the same owner [1oom+].
- Enemy fleet in orbit of your planet: same panel with the owner's name and "in orbit" [C].

### 5.6 RELOC (rally point) and TRANS (transports) [S][C]
- **RELOC**: map mode with the source planet framed; click a destination star (your own stars, unless an extended-range rule is on); the line is green/red and animated; text shows travel time; **ACCEPT** (Space) stores the rally point so every ship finished at that colony flies there automatically; Alt-R re-points **all** colonies to the selected planet [C][T]. Help id 2. Rally lines are drawn as thin blue lines on the map [S].
- **TRANS**: panel titled "**Transports**" (red): "Choose number of troops to transport"; `POP` slider (range 0..half of the source planet's population), readout "Moving N Million", "ETA n TURNS", CANCEL / ACCEPT [S]. Destination validity text: out of range, unexplored (explore first), planet type not yet colonisable (names the type), unowned planet (a first colony must come from a ship), treaty warning if non-aggression/alliance, and a **blinking max-population warning** when the transfer would overshoot [C]. Same screen is used for troop transports during invasions.

### 5.7 SHIPS button (choose what a colony builds) [C]
A frame over the lower right panel shows your designs as a grid (3 per column, 44 px pitch), each with picture and name; the current build is highlighted. Click, press 1-6, or S to cycle. [1oom+] Ctrl-click = build this design at **all** colonies; Alt-click = **replace** the current design at all colonies [C]. A Stargate entry appears once the tech exists. CANCEL (Esc) / ACCEPT (Space).

### 5.8 Planets screen ("ledger") [S][C]
Bronze-brown table filling the screen; 12 visible rows, selected row in blue; scrolled by arrow buttons at lower right (`,` `.` keys).
| Column | Content |
|---|---|
| # | list index (red) |
| PLANET | name (yellow) |
| POPULATION | current pop; green up-arrow and "+n" growth, red when shrinking |
| FACT | factories |
| SHD | planetary shield level (Roman numeral) |
| BASE | missile bases |
| WST | waste |
| PROD | production (green) |
| SPACE DOCK | name of ship design being built (or Stargate) when Ship slider > 0 |
| NOTES | special/status text: plague, nova, comet, pirates, rebellion, unrest, accident, growth specials, "*" for stargate |

Footer: **Spending Costs** (SHIPS %, SPYING %, BASES %, SECURITY %), **Total Income** (TRADE BC, PLANETS BC), a **tax slider** (readout like "+0 BC", range up to 10% of production) feeding the **RESERVE n BC**, **TRANSFER** button (active only when the reserve > 0; then click a planet and choose an amount on a 0-100 slider in a small dialog; Space accepts), **OK** [S][C]. Clicking a row jumps to that colony on the map and closes. [1oom+]: sortable column headers, max-pop column. Help id 37.

### 5.9 Fleet screen [S][C]
Brown ledger grid: left column **STATION** (planet picture or green "UNKNOWN SYSTEM" tile, status "in orbit"/"moving", planet name), then one column per design (header names in gold: SCOUT, FIGHTER, DESTROYER, BOMBER, COLONY SHIP, NO DESIGN) with a **ship picture + count** per cell; 5 rows per page with scroll arrows; footer "**SHIP MAINTENANCE COST n BC/YEAR**" and buttons **SPECS** (key V), **SCRAP** (key S), **OK** (Space) [S][C].
- Click a row -> jumps to that fleet/star on the map. SCRAP: click it, then click the column header of the design to scrap -> confirmation dialog (YES/NO). Help id 8.

### 5.10 Specs screen (from Fleet -> SPECS; also forced when you must scrap a design) [S][C]
One row per design (32 px pitch): left black box with ship picture and **count**, design name + **SCRAP** button, stat boxes **SHIELD, BEAM DEF, ATT LVL, WARP, MISL DEF, HITS, SPEED**, a text block listing weapons ("1 LASER", "1 NUCLEAR MISSILE" / "3 LASERS"...), a specials column ("RESERVE TANKS", "NO SPECIALS", "COLONY BASE" in green) and **COST n BC**. Limit: **6 active designs** at once. Help id 35.

### 5.11 Ship Design editor (Design button) [S][C][T]
The Design button opens the **editor directly** (it re-opens with your last design loaded); the library of finished designs lives on the Fleet/Specs screens. Dark steel console frame with **orange chrome accent bars**, title plate "NEW SHIP DESIGN".
```
+----------------------------------------------------------+
| Computer      ATTACK LEVEL n | Armor    HIT POINTS n     |
| Shield                       | Engine   WARP n  DEF n    |
| Ecm           MISSILE DEF n  | Maneuver COMBAT SPEED n   |
+----------------------------------------------------------+
| Count  Ship Weapons   Damage  Rng  Notes                  |
| Weapon 1  [^v]  name ...                                  |
| Weapon 2..4                                               |
+----------------------------------------------------------+
| Special 1  name            description                    |
| Special 2..3                                              |
+----------------------------------------------------------+
| SHIP SIZE   SHIP ICON  | NAME        .....  [CANCEL]    |
| SMALL       [pic] ^v   | SHIP COST   n BC   [CLEAR ]    |
| MEDIUM                 | TOTAL SPACE n      [BUILD ]    |
| LARGE / HUGE           | AVAILABLE SPACE n              |
+----------------------------------------------------------+
```
- **Fully loaded late-game example** [S] (to show how information is phrased): Computer `MARK X` -> "ATTACK LEVEL 11"; Shield `CLASS XI` -> "ABSORBS 11 HITS"; ECM `JAMMER IX` -> "MISSILE DEF 13"; Armor `NEUTRONIUM` -> "HIT POINTS 2400"; Engine `IMPULSE` -> "WARP 5  DEF 4"; Maneuver `5` -> "COMBAT SPEED 3". Weapon rows: count 2 `DEATH RAY` damage 200-1000 range 1; count 24 `PROTON TORPEDO` 75, range 10, note "FIRES ONE PER 2 TURNS"; count 8 `GAUSS AUTOCANON` 7-10, range 1, note "1/2 SHIELDS, FIRES 4X". Specials: `LIGHTNING SHIELD` "100% chance missiles destroyed", `HIGH ENERGY FOCUS` "increases weapon ranges by 3", `BATTLE SCANNER` "displays enemy ship stats". Footer: name `EVISCERATOR`, SHIP COST 3860 BC, TOTAL SPACE 12800, AVAILABLE SPACE 27 (HUGE hull). Labels of unavailable rows are dim; the "Rng" column header reads like "Ang" in the pixel font.
- **Slots**: 6 "base" components (Computer, Shield, ECM, Armor, Engine, Maneuver), **4 weapon slots** (each with a count spinner), **3 special slots**. **4 hulls**: Small / Medium / Large / Huge (smaller = harder to hit, bigger = more space/HP) [T][C].
- **Choosing**: click a row -> a **pop-up table** takes over the middle panel. Component popups list name, cost, size, power and resulting space; items that do not fit or are not researched are shown dim and cannot be chosen. **Weapons popup** columns: MAX (how many fit), WEAPON NAME, DESCRIPTION, DMG, COST, SIZE, POWER, SPACE. **Special Devices popup**: SPECIAL NAME, DESCRIPTION, COST, SIZE, POWER, SPACE (e.g. "RESERVE FUEL TANKS - extends ship range by 3 parsecs", "STANDARD COLONY BASE - allows normal planet landings", "BATTLE SCANNER - displays enemy ship stats") [S]. Right-click/Esc cancels a popup and restores the previous item [C].
- **Weapon counts**: click ^ / v (+-1); [1oom+] Ctrl = +-10, Alt = max-fit / zero; every change is validated against remaining space and rejected if it does not fit [C].
- **Live readouts** (top boxes) and bottom fields update immediately; costs shrink as miniaturisation techs arrive; re-designing an identical ship later yields a cheaper version [T].
- **Buttons**: CANCEL (Esc), CLEAR (C), BUILD (B). If 6 designs already exist BUILD sends you to the Specs screen to scrap one first [C][T]. Names default to a hull name; empty = default [C]. Help id 5.
- The **hull selector** is the big SMALL / MEDIUM / LARGE / HUGE list with an orange slider knob (click a name or drag the knob); the **ship icon** arrows cycle the look (looks are tied to your banner colour) [S][C].

### 5.12 Research (Tech) screen [S][C]
- **Top-left**: six field tabs in a 2x3 grid - COMPUTERS, CONSTRUCTION, FORCE FIELDS / PLANETOLOGY, PROPULSION, WEAPONS (the selected tab is red-brown, others navy). [1oom+] number keys 1-6.
- **Left list** (16 rows, scrollable) of **researched techs** in that field, oldest first (current project last); under it a framed **picture pane** (a ship/planet render of the highlighted tech) and a **description box** (bottom-left, word-wrapped) [S].
- **Right column**, title row "TECHNOLOGY / **Research** / LEVEL": six rows, each = field name cell, **slider** (50 steps of 2%, red arrow buttons, lock by clicking the name), a **light-bulb** icon whose fill shows the chance of a breakthrough this turn (shown as a % later; LP notes the displayed % is half the real chance), and a LEVEL cell (number of techs done). Under each slider a one-line **capability summary** ("SCANNER RANGE 3, ROBOT CONTROLS 2/COL", "FACTORY WASTE 100, GROUND COMBAT +0%", "TERRAFORM +0, WASTE ELIMINATION 2/BC", "SHIP RANGE 3 PARSECS") [S].
- **Bottom-right**: "TOTAL RESEARCH n BC" and **OK** (Space). **=** equalises all sliders ignoring locks [T]; in the unpatched code it sets the fixed values 16 / 17 / 17 / 16 / 17 / 17 (a known quirk; 1oom's "fixbugs" spreads evenly instead) [C]. Help id 13. Keys + / - nudge the hovered slider by 2 (Ctrl 10; Alt = 0 / 100) [1oom+?]. Slider percentage text sits at the far right of each row; a breakthrough-chance percentage replaces the bulb once research is under way [C][S].

### 5.13 Research scenes (full-screen vignettes) [S][C]
1. **Choose next research** - a lab scene with your **race's scientist portrait** at a console; red caption "**Choose the area of research our scientists now focus on**"; a grey list box titled "<Field> Technology" listing available next techs (sorted cheapest -> most expensive), the highlighted item's description and cost in green "(510 RP)". Jingle (music 5). Only appears when a field has a real choice; otherwise the next tech starts automatically.
2. **Breakthrough** - same lab; caption "**<Race> Scientists Achieve A <Field> Breakthrough**", tech name + one-sentence effect ("Decreases factory pollution levels to 80% of the normal rate."). Space to continue. Music 5/6/7 depending on source (research / stolen / found; AI-spy and trade reuse 5) [C].
3. **Follow-up dialogs** appear on top for some techs: a YES/NO box (after waste-reduction techs: reduce the ecology ratio on all colonies to the minimum needed to stay clean?) or a row of buttons (N = cancel; keys 2 / 5 / 7 = raise the industry / ecology / defence ratio by 25% / 50% / 75% [T: LP mentions "25/50/75%" offers]) [S][C]. Later terraforming / soil techs offer the same kind of one-click slider retune.
4. **Spy / trade variants** use an animated spy image (SPIES.LBX) of the source race instead of the scientist. When *your* tech is stolen the same lab scene is headed "**<Race> Spies Infiltrate The Research Center At <your planet>**" (red), with the tech name in teal and its description in yellow at the bottom; the thief race's sneaking figure stands at the console [S].

### 5.14 Races (diplomacy overview) screen [S][C]
- Bronze ledger screen, **3 rows x 2 columns of race slots** (5 rivals max); each slot ~157 px wide: race **portrait** (left), name plate in the race's banner colour, **treaty text** (No Treaty / Non-Aggression Pact / Alliance / War) over **trade text** ("No Trade" / "N BC per year"), a **relations bar** (red -> green gradient with a pointer and a one-word label such as UNEASE or NEUTRAL), a **spy-network slider** (readout "NO SPIES" / number of spies, plus "NONE" or years-per-spy) and three mode buttons **HIDE / SABOTAGE / ESPIONAGE** [S][C].
- Empty slots are filled with a flat panel reading "**No Contact**" (an opponent exists but is not met) or "Not Present" (seat beyond the chosen opponent count); a destroyed race gets a "gone" overlay [S][C].
- Bottom-right: **OVERALL SECURITY** slider (readout "+n%") with the text "Security increases the chance of catching all enemy spies" and "ALLOCATIONS: n% PLANETARY RESOURCES" (sum of spy + security spending) [S].
- Buttons: **STATUS** (S), **REPORT** (R), **AUDIENCE** (A), **OK** (O/Space). Click REPORT/AUDIENCE then click a portrait (or press 1-5) to choose the empire. Help id 10 (11 when no contacts) [C].
- **Relations label ladder** (17 steps, 12 points each, -100..+100): Harmony (+91..+100), Unity, Friendly, Peaceful, Affable, Calm, Amiable, Relaxed (+7..+18), Neutral (-6..+6), Unease, Wary, Restless, Tense, Troubled, Discord, Hate, Feud (-91..-100) [T: StrategyWiki].
- Spy cost per network = 25 BC + 2 x (your Computers tech level), doubling for each extra network; Darlok half cost [C][T].

### 5.15 Report screen (per empire) [S][C]
Left column: race portrait in a frame, name plate (banner colour), the AI leader's **personality + objective** in two lines (e.g. "Xenophobic Ecologist", "Honorable Technologists", "Pacifist Expansionist"; personalities seen/known: Pacifistic, Honorable, Ruthless, Xenophobic, Aggressive, Erratic [?]; objectives: Technologist, Diplomat, Militarist, Ecologist, Expansionist, Industrialist [?]), "**REPORT 15 / 72 years old**" (age of your spy info), headed boxes "**Alliances**" and "**Wars**" (up to 3 names each). Right: six titled boxes (COMPUTERS, CONSTRUCTION, FORCE FIELDS, PLANETOLOGY, PROPULSION, WEAPONS) listing the techs you know they have (those you also have in normal colour, those you lack highlighted white) [S][C].

### 5.16 Status ("Racial Stats") screen [S][C]
Bronze frame; header plate "**Racial Stats**" with "**Year: 2372**" in red LED digits at left. Six boxes with orange titles - **Fleet Strength, Population, Technology, Planets, Production, Total Power** - each with one thin **bar per empire** in its banner colour and the race name label; yours first. No buttons: any click/Space exits. Help id 15 [S][C]. This is the "how-are-we-doing" one-stop view.

### 5.17 Audience (diplomacy conversation) [S][C][T]
- **Scene**: dark-blue dome room with a green/yellow ring; **your emperor** is a **hooded figure in your banner colour seen from behind** (left foreground); the **alien ambassador** appears as a hologram on a dais (centre) with **three animation states** (calm / pleased / angry) [S][C]; text sits in a **teal dialogue panel with red-and-gold ornamental end caps** at the bottom; menus appear inside that same panel; red parenthetical notes like "(ambassador recalled)" [S].
- **Player-initiated menu** (greyed lines are disabled) [C]:
  - **Propose Treaty** -> Non-Aggression Pact / Alliance / Peace Treaty / Declaration of War on Another Race / Break Alliance With Another Race / Forget It
  - **Form Trade Agreement** -> a list of BC-per-year amounts (up to 5) / Forget It
  - **Threaten / Break Treaty and Trade** -> Break Non-Aggression Pact / Break Alliance / Break Trade Agreement / Threaten To Attack / Cancel
  - **Offer Tribute** -> up to 4 BC amounts (from your reserve) or a technology (up to 4 shown) / Forget It
  - **Exchange Technology** -> up to 5 techs they will give, then up to 4 of yours to offer / Forget It
  - **Good Bye**
  - When they refuse, the AI can counter with a "sweetener" (BC or tech) -> Agree / Forget It.
- **AI-initiated** audiences (during turn processing): offers of non-aggression / alliance / peace / trade / bounty / tech trade, demands to break an alliance with its enemy, ultimatums, war declarations, "join my war" requests; answered with accept/reject lists [C].
- Music: one **pair of tracks per race** (calm and hostile) [C]; after a tech is received the lab scene plays [C]. Text is short, in-character and personality-driven; the AI can end talks ("We go now") [T].

### 5.18 Spy scenes [S][C]
- **Steal (espionage success)**: map backdrop with a framed panel: a header naming the target race in capitals, the target's planet picture, and **six field buttons** (Computers, Construction, Force Fields, Planetology, Propulsion, Weapons; only fields where they have something you lack) in 2 columns; pick one -> you receive a tech via the lab scene; Esc aborts. Music 15 [C].
- **Sabotage success**: right-panel mini-map of the target's colonies (click a flag to pick the planet), race banner bar, colony picture, last-known pop/factories/bases; buttons **Destroy factories** (F), **Destroy missile bases** (B), **Incite revolt** (I; only if the planet is not already unstable); result card with an explosion animation and counts; Continue (C/Space). If a second rival is involved a "choose whom to frame" dialog with two banners appears. Music 16 (choose) / 17 (success) [C].
- **Victim notice**: "<Race> spy stole <tech>" box over the map [C].
- **Spies Caught**: grey popup table "**SPIES CAUGHT / YOURS / THEIRS**", one row per contacted race, dismissed with click / Space / Esc (key C opens it manually) [S][C].

### 5.19 Galactic (High) Council [S][C][T]
- **Trigger**: starts once at least 2/3 of all stars are colonised and then every **25 years** (years divisible by 25: 2375, 2400, ...) while no Emperor exists; more than 2 empires alive [C]. Votes = an empire's total population (millions, rebelling planets excluded) / 100, rounded up; every empire gets at least 1 [C][T]. The two largest populations are the candidates; the player votes **last**.
- **Scene**: a **rust-red metal arch chamber in deep space**; a **holographic pedestal** in the centre showing the current speaker's bust; four dark "monitor" alcoves with race portraits (two left, two right, edges cropped); **top line** of green tally text: "n votes <name> | N votes total | m votes <name>"; **bottom** yellow-green message text (the result line names the year, the chosen leader and race, and the title "High Master of the New Republic") [S].
- **Flow**: "Council convenes" -> nomination line ("Emperor <name> of the <race> and ... nominated") -> each empire votes in turn (about 5 ticks pause each; AI votes shown with text; abstaining shown) -> your vote prompt with 3 numbered lines: **1** candidate 1 (or "yourself"), **2** candidate 2, **0** abstain -> tally. A candidate needs **2/3 of all votes** ((total+1)*2/3). Voting affects relations (+/- with the candidates) [C][T].
- **Outcome**: if a winner: you are asked "accept?" (**Y/N**, Esc = Yes). Accepting a human win -> good ending; accepting an AI win -> exile ending. **Refusing (defy)** -> *Final War*: all other empires ally against you, share tech [C][T]. No winner: message "neither candidate ..." and the game continues. Music 39 for the whole scene [C].

### 5.20 Small dialogs and utility panels [C][S]
| Dialog | Layout / behaviour |
|---|---|
| **Scrap missile bases** (key B on a colony with bases) | Framed box at (56,50): two centred title lines, a 0-100% slider (2% per click) with the resulting number of bases and the word "bases", Cancel (Esc) / Accept (Space). Refund = 1/4 of the bases' build cost into the reserve; maintenance stops [C][T] |
| **Planet reserve transfer** (Planets screen, Transfer mode) | Small box at (100,50): slider 0-100% in steps of 2 (arrow areas at both ends), Space accepts, Left cancels, = / # sets the planet's surplus share; amount = % of the reserve, moved into that planet's reserve [C] |
| **Scrap design confirmation** | Box showing the ship picture, count and name with No (N / Esc) / Yes (Y) [C] |
| **Yes/No / 3-choice** | 135x80 px box, prompt starting "Do you ...", buttons No (N/Esc) / Yes (Y); 3-choice variant keys 2 / 5 / 7 [C] |
| **Rename** (planet, design, emperor, save) | Inline text field; first Backspace clears; Enter or click accepts; empty input keeps the old name [C] |
| **Search** [1oom+] | 100x8 px text box at (6,169): exact name first, then prefix match starting after the current focus; only planets you can see [C] |
| **Spies Caught** | Grey table popup (see 5.18) [S] |
| **Player switch** [1oom+] | hot-seat hand-over screen with year and emperor names [C] |

---

## 6. Combat, bombardment and invasion screens

### 6.1 Pre-battle panel [S][C]
When hostile parties meet at a planet (battles only ever happen **in orbit over a planet**, never in deep space), the right panel switches to a black panel: a fleet/planet picture header, the title "**Space Combat**", the line "**<Attacker> attacks <Defender>**" (monsters allowed: e.g. "Guardian attacks Klackons"), a strip showing the fleet banner, and one **CONTINUE** button (C / Space) that enters the tactical screen. The map shows the contested planet [S]. [1oom+] adds AUTO and RETREAT buttons and a hull-count summary table.
Whether to fight manually or press **Auto** is decided *inside* the tactical screen in the original (there is no global "tactical combat" option).

### 6.2 Tactical battle screen [C][T]
- **Battlefield**: **10 columns x 8 rows** of 32x24 px cells filling x 0-319, y 0-191, over one of 5 space backdrops; up to 7 **rocks/asteroids** (impassable, shield missiles); the planet (with missile bases) sits on the defender's side. Your ships start on the **left edge**, the AI's on the right [T]; ships are sprites sized to the 32x24 cells, facing the enemy (huge hulls may spill beyond one cell [?]).
- **Bottom bar** (y 192-199): left = name + "hp/max" of the hovered or active unit; then 8 small buttons: **Auto (A)**, **Planet (P)**, **Scan (S, needs Battle Scanner)**, **Missile (M, toggle)**, **Special (X per manual)**, **Retreat (R)**, **Wait (W)**, **Done (D / Esc)**. Grid overlay (G) is [1oom+]. In Auto the buttons vanish and the text "auto move" shows [C].
- **Turn model**: rounds; each ship acts in a **priority order** (computer level + crew bonus + scanner; Alkari +3). The player cannot choose the order except with **Wait** (re-queues the unit later). The active ship gets a boxed selection frame; legal move cells are highlighted by cursor icons (move icon = legal move; crosshair = enemy in range; an info icon for the planet/scan) [C][T].
  - **Move**: click a cell. Cost = Chebyshev distance (a diagonal is 1 square). Ships may pass through friends but not end on a friend; rocks block; a **teleporter** special ignores distance. All ships start able to move only 1 square (retros) - speed comes from engine + manoeuvrability [C][T].
  - **Attack**: click an enemy in range; *all* weapons that can reach fire (there is no per-weapon targeting). Beams can fire multiple times while targets remain; missiles/torpedoes obey the **Missile** toggle; bombs can only hit the planet. Missiles are projectiles that travel over several steps, can be shot down by anti-missile specials and lose about half their number crossing a rock field [C][T].
  - **Special** toggles the active special device (Stasis Field, Pulsar, Warp Dissipator, Black Hole, Technology Nullifier, Repulsor, Stream projectors...).
  - **Done** ends that ship's turn (beams may still fire as retaliation later). **Retreat** marks the ship; the AI plays its turn, then it leaves with a warp-out animation (enemy gets one more shot); ships with 0 manoeuvrability cannot retreat [C][T].
- **Scan screen** (full-screen list when you press Scan on an enemy): one row per ship: defense, missile defense, combat level, HP (red if damaged), shield absorb, crew, weapons with counts and shots, missile-ready markers, specials [C].
- **Planet info box** (centre-top overlay): pop, factories, bases, shield, defense, HP, missiles launched [C].
- **FX list to reproduce** [C]: beam lines (1-3 lines per weapon count, colour-cycling for some), missile sprites in **8 directions** with 5 sprite families (missile, anti-matter, hellfire, proton, plasma torpedo; up to 10 per volley), bombs (nuclear / biological / disruptor), stasis field circle, pulsar expanding sphere, ion/neutron streams, black hole swirl, technull wave, repulsor push (3 phases), warp dissipator beam, **warp-out** (14 frames), cloak fade (steps of 10), shield flash (5 frames) or ring (3 frames), **explosions scaled to damage** (10 frames). Damage numbers pop up.
- Music track 8 loops for the whole battle [C]. Retaliation/auto battles show a short sped-up animation [C].

### 6.3 Bombardment [C]
- **Prompt** (music 13): planet map + a bombard animation frame; two text lines asking whether to bomb, current population and factory counts, and (if already being bombed) incoming pop; buttons **Cancel (Esc)** / **Bomb (B)** with SFX 0x06 / 0x24.
- **Result**: explosion backdrop; the animation plays with SFX **0x25 (frame 3), 0x02 (frame 6), 0x11 (frame 15)**; text lists "population killed" and "factories destroyed" (or "ineffective"); **Continue (C / Space)**. Music 13, or 14 when the target planet is unowned (e.g. a monster/rebel result) [C].

### 6.4 Landing / ground combat [S][C][T]
- **Colonisation** reuses the landing scene (5.3). **Invasion** uses the same engine with a different backdrop set (type + 0x24) and the attacker's troop sprites (banner-coloured); music 8 on arrival.
- **Phase 1** (frames 0-49): troop **transports slide down** the screen; top text: inbound count "out of" total, attacker race, transports; second line shows defender numbers. **Phase 2**: two panels - defender (left) and attacker (right, mirrored) - each a **grid of tiny soldier sprites, 15 per row**; as rounds resolve **death markers** appear on the losing side; tiny gunfire SFX 0x02 at random 2-4 tick intervals; music **0x26 (38)**. Combat is a dice contest (LP: each round one million die on one side) [T].
- **Phase 3 (result)**: music 0x0B when the defending side is wiped out (planet captured [?]) or 0x0C when defenders survive (invasion repelled [?]); text: planet captured or invasion failed; if successful: number of **facilities captured** and a **list of stolen technologies** (field + tech name) or a "new tech" line.
- Input: only Space/click - skips ahead to the result, then closes. Rebel invasions show "rebel" troops and a "reclaim" line [C].
- Outcomes also appear in GNN and can start wars.

---

## 7. GNN, event cards and notices

### 7.1 GNN - Galactic News Network [S][C]
- Full-screen **TV-studio vignette**: lavender-blue riveted frame with sliding blue doors at the sides; the **gold robot newscaster** (bald, red lens-eyes, holds a stack of papers) animated at centre; a **spinning globe** at left; a **headline icon box** at right (examples: skull-and-crossbones captioned "GENOCIDE", cracked building captioned "QUAKE"; icon index = news type + 3 in NEWSCAST.LBX); a black text panel at the bottom (light-blue pixel text, justified) with ornamental dials and column caps [S].
- Intro: anchor frames play in reverse over 25 iterations; entry via a **pixel-scramble dissolve**; music 9; Space/click skips; a second item in the same turn plays as "**also...**" without the intro [C].
- **News types** (22) [C]: PLAGUE, QUAKE, NOVA, ACCIDENT (industrial), ASSASSIN, VIRUS, COMET, PIRATES, DERELICT, REBELLION, CRYSTAL, AMOEBA, ENVIRO, RICH, SUPPORT, POOR, ORION, COUP, **STARS** (colonisation milestones at 1/8, 1/4, 3/8, 1/2 of all stars [T]), **STATS** (rankings: production, population, technology, fleet - shown as a numbered list of race names), GENOCIDE (race destroyed), GUARDIAN.
- Voice: past tense, factual, one or two sentences (a quake bulletin states the planet, millions of colonists killed and factories destroyed; a genocide bulletin states that one named empire was completely destroyed by another); the robot sometimes repeats old rankings [S][T].
- Random events (plague, quake, nova, industrial accident, assassination, virus, comet, pirates, derelict ship, rebellion, rich/poor mineral finds, space crystal/amoeba) all reach the player as GNN bulletins [C].

### 7.2 Notice boxes on the map [S][C]
- **Slate-blue rounded boxes** with centred pixel text over the map (e.g. the factory-limit notice: planet name, "industry maximum of N factories", surplus went to the reserve; and a second box saying the spending ratios may be changed at this time) - dismiss with click/Space, and the colony sliders remain live underneath [S][T].
- **Fleet Production report**: brown framed square "Year 2304 / Fleet Production" with up to 6 ship tiles (picture, count, name tag on a navy strip) [S].
- **New ships** panel (3 per row, 40x40 tiles with starfield, count in yellow) [C].
- **Spies Caught** table [S].
- Event "cards" in the right panel (explore / colonise / combat) are described in 4.4 and 5.3.

### 7.3 Contextual tutor pop-ups (Simple/Easy only) [C]
One-time **help overlay pages** fire on: year 1; first contact with another empire; a pop >= 70 colony with no missile bases; year >= 30; year >= 70; a weapon-research milestone; hostile planets in range; 50+ factories (non-Silicoids); nuclear engines; Class V planetary shield; soil enrichment; atmospheric terraforming; advanced soil enrichment; intergalactic stargates. They use the same F1 overlay system (HELP.LBX ids 0x00, 0x12-0x20) [C].

---

## 8. Endings and game over [C][S]
There is **no score screen and no high-score table** in MOO1. The game ends in one of five ways:

| End type | Trigger | Presentation |
|---|---|---|
| **Won - good** (Council victory) | You (or your emperor) win the Galactic Council vote and accept | WINLOSE scene: stars scroll in from both sides, ships and planets slide in, race-specific leader face, a hooded speaker announcing a new era and a united galaxy; fade to a full-screen image; leader face over final background with 2 text lines; then a **GNN broadcast** (good tone). Music 2 |
| **Won - tyrant** (conquest) | All rivals eliminated | Same sequence with 4 lines of text including your name; GNN broadcast with a wry tyrant tone (the robot shrugs off another millennium under a ruthless tyrant) [S]. Music 2 |
| **Lost - funeral** | Your empire is destroyed | Funeral procession animation (flag, coffin and mourner sprites march diagonally across 186 frames); no text; Music 3 |
| **Lost - exile** | A rival is elected and you accept | Your ship drifts away through three parallax star layers (380 frames) with two text blocks naming you; Music 3; no GNN |
| **Final War** | You defy the Council | Not an ending: war with everyone, play continues |

All endings can be skipped with Space/Esc; fades bracket every text block [C].

---

## 9. Game menu, save/load, autosave, options [C][T]

- **Game button** -> a framed panel (VORTEX art): left column **Save / Load / Quit** (keys S / L / Q), right column **Silent / FX / Music** (keys I / F / M) - a 3-way radio: Silent = nothing; FX = sound effects only; Music = FX + music. Clicking below the panel, Space or Esc closes it. **Quit** leaves the game and **autosaves the "Continue" slot** (the manual says any exit through this screen saves automatically) [T][C].
- **Save screen**: VORTEX background, **6 stacked slot frames** (grey; selected = green) each a text field where you **type the save name** (up to ~19 chars); Cancel (Esc) / OK (Space) [C]. **Load screen**: same list, only occupied slots, number keys 1-6 pick a slot; [1oom+] adds Continue/Undo/Initial entries.
- **F10** quick-saves to the Continue slot from the Control screen [T][C]. The "Continue Game" menu item reloads it.
- There are **no other options** in the original: no resolution, no speed or animation toggles, no key remapping, no difficulty change mid-game. (1oom adds many.)
- Dialog style: small yes/no boxes (135x80 px) with the prompt "Do you ..." split on up to 3 lines and buttons No (N/Esc) / Yes (Y); a 3-choice variant uses keys 2/5/7 [C].

---

## 10. Help, messaging and tooltips [C][T]
- **No tooltips / hover text anywhere** (hover only recolours buttons or list lines). Information is on-screen and terse.
- **F1 help overlay** (HELP.LBX, ~40 pages): the current screen freezes and **annotated boxes with leader lines** point at widgets: one main box (title + wrapped body) plus up to 9 sub-boxes with 70-char texts and arrow/line connectors; pages chain via a "next page" pointer; any input advances/closes. Help ids by screen: 0 = intro/tutorial, 2 = Reloc, 5 = Design, 8 = Fleet, 9 = Galaxy Map, 10/11 = Races (with/without contacts), 13 = Tech, 15 = Status, 34 = Starview, 35 = Specs, 37 = Planets, 39 = Report; 18-32 = the one-time tutor topics. A review confirms that F1 shows info panels explaining each part of the interface [T][C].
- **Message voice**: blunt, past tense, military-bureaucratic; status words rather than sentences on widgets ("NONE", "CLEAN", "MAX"); GNN and scientists use full short sentences; AI diplomats use personality-flavoured lines (polite refusals such as "not a fair offer", blunt threats, "ambassador recalled" notes) [T][S].
- **Information hiding**: stale data is labelled "Last Reported As ..." (planet info beyond scanner range) and report ages ("72 years old") [S][T].

---

## 11. Look and feel (for orientation only - the remake uses its own art)

### 11.1 Visual identity
- **Hand-painted pixel art** on a 320x200 canvas, 256 colours. Management screens are **chunky, bevelled, metallic and tabular**; vignette screens are **painted scenes** with **cartoon-sci-fi characters** (the golden newscaster robot, the red-robed Psilon-style scientist, the hooded emperor, race ambassadors) - a "pulp space opera" tone, colourful, not grim. One design critic prefers its cartoony, colourful look and lighter backgrounds to MOO II's more realistic art [T].
- **Pre-rendered 3D intro** and title logo (chrome letters, magenta-purple vortex/nebula) [T][S].
- **Colour language** (approximate hex, sampled by eye from screenshots):
| Role | Look | Approx |
|---|---|---|
| Space / map | black with white-blue pixel stars; purple blobs for nebulae | #000000-#05060F, nebula #7A2CA0 |
| Main frame | light steel-grey bevel | #B0B0C0 / #808090 / #585868 |
| Title bars, bottom buttons | deep indigo-navy with lavender text | #2C3064, text #B9B9E6 |
| Ledger screens (Planets, Fleet, Races, Report, Status, Map, Tech) | rust/bronze frame, dark-brown cells | frame #8A6E54, cell #5A483A, deep #3E3128 |
| Headings | orange (Planets/Status), teal (Report/Races), gold chunky (names) | #F08A24 / #3FD8C0 / #F5C842 |
| Positive numbers / "POP MAX" | bright green | #4CE04C |
| Warnings, "UNEXPLORED", red frame around planet box | red | #E03232 |
| Design screen | near-black console with orange accents; cyan-green readouts | #FF8A1E / #3CE0C0 |
| Dialogue (audience) | teal panel, red & gold ornaments | #5EB8B0, #B22 / #E0B040 |
| Council | rust-red girders over space | #A0402C |
| GNN | lavender-blue frame, gold robot, black text box | #8A8ACF, #D8A820 |
| Star classes | yellow, green, red, blue, white, purple | #F5D040, #50E060, #E04040, #70A8F0, #E8E8F0, #B070E0 |
| Banners (6) | blue, green, purple, red, white, yellow | #5A8CF0, #3CCB4A, #B070E8, #E03A3A, #E6E6EE, #F2C830 |
- **Typography** [S]: (a) squared all-caps bevel "techno" pixel face for buttons/labels (5-7 px caps); (b) larger **chiselled gold display face with black outline** for titles/planet names; (c) mixed-case pixel face for dialogue/event text in lavender, yellow-green or dark-on-teal. Fonts come from FONTS.LBX (about 13 font/colour combos used in code) [C].
- **Icons**: tiny ship sprites in banner colours; 4-point star crosses; hand cursor; flag glyphs; light-bulb (research); coloured arrows on sliders; population/factory/base icons in starview.
- **Animation feel**: low frame rate (3-4 ticks per frame), blinking selection reticle, twinkling stars, sprite loops of 5 frames, animated flags, scanner-dish loops, hologram flicker. Everything is deliberately simple but readable.
- **UI sounds**: just **two** - confirm (SFX 0x24) and cancel/back (SFX 0x06) - plus event stingers (see 12). The management screens are otherwise silent [C].

### 11.2 What gives MOO1 its "feel" (keep this in the remake)
1. Everything hangs off one map screen; panels swap in place instead of stacking windows.
2. Slider-everything with immediate readouts; ratios always sum to 100%.
3. Character vignettes for the big beats; short, confident, slightly humorous copy.
4. Event-driven audio (music is a reward/atmosphere for scenes, not a constant loop).
5. Fast: nothing needs more than two clicks; Space accepts, Esc/right-click backs out.
6. Dense information, but with **strong colour coding** (owner colours, green = in range / good, red = out of range / bad).

---

## 12. Audio

### 12.1 Facts about the original soundtrack
- **Composer**: Dave (David) Govett; music produced by George "The Fat Man" Sanger's Team Fat [T]. A GameStar retrospective says Govett wrote in a **cinematic, melodic** way, nodding to well-known sci-fi scores (Star Trek / Star Wars style) and tried to make the thin FM sound-cards sound as good as possible [T]. Govett himself has said the Star Trek / Star Wars influence was deliberate: with limited sound technology the best option was to emulate that genre sound and aim for cinematic and epic [T] (paraphrase). Workflow per the VGMPF wiki: MIDI sequenced in Dr. T's KCS on an Atari ST, converted to XMI and played through the Miles/Midpak driver [T].
- **Format / hardware**: MIDI-type sequences in **XMI** format inside `MUSIC.LBX` (**40 tracks**, ids 0-39) [C][T]; **41 digitised sound effects** in `SOUNDFX.LBX` (ids 0-40) [C]; three extra samples in `INTROSND.LBX` for the intro. Supported devices: AdLib, Sound Blaster / Pro, Pro Audio Spectrum, **Roland MT-32 / LAPC-1** (the manual's main recommendation) and General MIDI [T]. So the "true" sound is orchestral/synth MIDI with strong melodies; FM versions are thinner.
- **Reception**: a GOG review calls the music and effects basic but nostalgic; a MobyGames user finds the sound effects sparse [T]. This matches the code: **no music on the galaxy map or management screens** (the starmap stops music on entry); music is tied to scenes [C].
- Rough soundscape [?]: orchestral hits, brass fanfares, string pads, bells/vibes, percussion, synth leads; race themes are distinct leitmotifs. The 1oom code shows **two track ids per race** (calm / hostile), and the 2016 remake's re-orchestrated album uses "Race-Peace" / "Race-War" pairs per race, consistent with that structure [C][T]. (I could not listen to the tracks; mood descriptions are inferred from structure and reviews.)
- **We will not reproduce any of these compositions.** Use the structure below only.

### 12.2 Music cue map (what plays when) [C]
| Track id | Hex | Plays during | Mood / role |
|---|---|---|---|
| 0 | 00 | Intro movie (~95 s) | cinematic, fades out at the end |
| 1 | 01 | Title / main menu | main theme |
| 2 | 02 | **Winning** endings (Council victory or conquest) | triumph; fades out |
| 3 | 03 | **Losing** endings (funeral procession, exile) | mourning / loneliness |
| 4 | 04 | not referenced in 1oom UI code [?] | unknown / possibly unused |
| 5 | 05 | New-tech scene: researched, AI-spy, traded; "choose next research" | jingle (1 of 3) |
| 6 | 06 | New-tech scene: tech **stolen** by your spies | jingle (sly) |
| 7 | 07 | New-tech scene: tech **found** (artifact / loot) | jingle (wonder) |
| 8 | 08 | **Tactical space battle**; also the **invasion landing** scene | combat loop |
| 9 | 09 | GNN broadcast (start animation) | news fanfare |
| 10 | 0A | **Colonisation landing** | hopeful |
| 11 | 0B | Ground combat result stinger (invasion succeeded [?]) | stinger |
| 12 | 0C | Ground combat result stinger (invasion failed [?]) | stinger |
| 13 | 0D | **Bombardment** prompt and result | dread |
| 14 | 0E | Bombardment result when the target ends up unowned | desolate |
| 15 | 0F | Espionage: choose field to steal | intrigue |
| 16 | 10 | Sabotage: choose target/action | tension |
| 17 | 11 | Sabotage success | sly resolve |
| 18 / 19 | 12 / 13 | **Audience: Alkari** (calm / hostile) | race theme |
| 20 / 21 | 14 / 15 | **Audience: Mrrshan** | race theme |
| 22 / 23 | 16 / 17 | **Audience: Human** | race theme |
| 24 / 25 | 18 / 19 | **Audience: Klackon** | race theme |
| 26 / 27 | 1A / 1B | **Audience: Meklar** | race theme |
| 28 / 29 | 1C / 1D | **Audience: Psilon** | race theme |
| 30 / 31 | 1E / 1F | **Audience: Darlok** | race theme |
| 32 / 33 | 20 / 21 | **Audience: Sakkra** | race theme |
| 34 / 35 | 22 / 23 | **Audience: Silicoid** | race theme |
| 36 / 37 | 24 / 25 | **Audience: Bulrathi** | race theme |
| 38 | 26 | Ground combat (battle phase) | martial loop |
| 39 | 27 | **Galactic Council** | ceremonial |
Audience logic: the ambassador's animation state (0-2) selects the track: states 0-1 -> the race's first track; state 2 (angry) -> the second track; the first track resumes after a tech exchange [C]. So the "angry" variant is a reaction to the conversation, not just to war status.

### 12.3 Sound effects [C]
Known assignments (ids are hex):
| SFX id | Used for |
|---|---|
| 0x24 | UI **confirm / click** (every button, menu pick, list pick, "continue") |
| 0x06 | UI **cancel / back / close** |
| 0x02 | shield hit and low-damage hit (battle); ground-combat rifle fire (random 2-4 tick spacing); bombardment impact |
| 0x11 | normal-damage hit / explosion (battle); bombardment explosion; also torpedo launch |
| 0x13 | retreat (warp-out) and repulsor push |
| 0x25 | bombs, death spores, doom virus; bombardment drop |
| 0x09 0x0E 0x15 0x16 0x18 0x1D 0x20 | flagged "most common" and preloaded first (mix of weapon sounds and probably destruction/cloak/stasis [?]) |
| intro samples | INTROSND items 1, 3, 5 on scene frames |
| copy-protection | success / failure blips |

**Weapon -> SFX id table** (from the ship-tech table, so weapon *families* share sounds) [C]:
| SFX | Weapons |
|---|---|
| 0x01 | Gatling Laser, Neutron Pellet Gun, Hard Beam, Auto Blaster, Gauss Autocannon, Pulse Phasor (rapid-fire chatter) |
| 0x03 | Scatter Pack V / VII / X (cluster missiles) |
| 0x07 | Laser |
| 0x08 | Standard missiles: Nuclear, Hyper-V, Hyper-X, Merculite, Stinger, Pulson, Hercular, Zeon |
| 0x0A | Heavy Laser, Neutron Blaster |
| 0x0B | Fusion Beam; 0x19 Heavy Fusion Beam |
| 0x0C | Ameba Stream (monster) |
| 0x0F / 0x10 | Heavy Ion Cannon / Ion Cannon |
| 0x11 | Torpedoes: Anti-Matter, Hellfire, Proton, Plasma |
| 0x12 | Heavy Blast Cannon, Megabolt Cannon |
| 0x14 | Neutronium Bomb, Bio Terminator |
| 0x15 | Stellar Converter |
| 0x17 | Mass Driver |
| 0x18 | Crystal Ray (monster) |
| 0x1A / 0x1C | Heavy Phasor / Phasor and Disruptor |
| 0x1B | Tri-Focus Plasma |
| 0x1D | Death Ray |
| 0x1E | Plasma Cannon |
| 0x1F | Tachyon Beam |
| 0x21 | Particle Beam |
| 0x23 | Mauler Device |
| 0x25 | all bombs, Death Spores, Doom Virus |
| 0x00 | Graviton Beam (placeholder / silent [?]) |

### 12.4 Complete SFX wish-list for the remake (original-style event coverage + our additions)
Every sound is synthesised in WebAudio (no samples needed). Suggested recipes:
| Group | Cues | Synth recipe (suggestion) |
|---|---|---|
| **UI** | confirm, cancel, tab switch, slider tick (+lock/unlock), button hover (subtle), error buzz, end-turn confirm, popup open/close | confirm: 50 ms square blip 880->1320 Hz + 2 ms click; cancel: 60 ms 660->440 Hz; slider tick: 15 ms triangle at 1.2 kHz with pitch tied to value; lock: metallic "clack" (noise burst through 2 kHz band-pass + short 300 Hz thump); error: 80 ms detuned saw pair 150 Hz |
| **Map** | fleet depart (soft whoosh + rising tone), fleet arrive (2-note chime), scout discovers star (sonar ping), "colony founded" (warm chord + soft landing thrust), production complete (two-tone), notification pop | whoosh = filtered noise 200->2k Hz; pings = sine 1.2 kHz with long echo; chords = FM bells |
| **Research** | jingle A success (ascending 5-note arpeggio, bell + pad), B stolen (pizzicato minor 4-note), C found (glass shimmer + sparkle) | see 12.5 |
| **Diplomacy** | ambassador arrives (hologram hum + sweep), treaty signed (stamp + chord), war declared (low alarm klaxon 2-tone), tribute accepted (coin-like ping), ambassador recalled (descending swoop) | |
| **Beam weapons** | laser (150-250 ms saw sweep 2 kHz -> 500 Hz, fast decay), heavy laser (lower, longer), fusion/phasor (layered saws with shimmer/chorus), rapid-fire (6-12 ms noise bursts at 20-30 Hz through 1-3 kHz band-pass), ion (crackle through comb filter), particle/tachyon (high chirp), plasma (wet sizzle + low thump), death ray (3-4 s dark swell + distortion) | per-family variants chosen by the same weapon->sound table (26 distinct ids), so new weapons automatically get a sound |
| **Missiles / torpedoes** | launch (noise ignition burst + rising whoosh 0.5 s), scatter (many small whooshes), torpedo (deep sine sweep + sub thump), anti-missile (rapid pings) | |
| **Impacts** | shield hit (150 ms crackle + resonant ring), armor hit (thud + metallic clang), small explosion (noise + 80 Hz sine decay 0.4 s), large explosion (noise swell + 40 Hz boom + rumble 1.2 s), planet hit (muffled boom with reverb) | |
| **Specials** | stasis (descending ice chime), pulsar (expanding ring tone), black hole (descending vortex 2 s), cloak (shimmer fade), warp-out (rising whoosh + zap 400 ms), repulsor (push thump), warp dissipator (detuned sweep down), technull (static burst) | |
| **Invasion** | transports descend (engine rumble), landing thud, rifle chatter (random bursts), capture fanfare sting | |
| **Bombardment** | whistle + deep boom (0x25 pattern: drop at frame 3, impact 6, explosion 15) | |
| **GNN / Council / Endings** | news sting (4-note brass), tally tick, gavel for vote result, victory chord, funeral drum | |
Dynamic range: keep UI sounds quiet and short (the original used only 2 UI sounds); weapon sounds can be bold.

### 12.5 Original music direction brief (ORIGINAL procedural compositions, similar *moods*)
Design principle: **event-driven** like the original (no constant map music), but we may add an optional very quiet ambient pad on the map. Keep a signature leitmotif (rising fourth then falling step) that every cue quotes so the score feels unified. Form: loops of 8-32 bars with a final-bar tail; stingers one-shot.

| Cue | Mood / story | Tempo / mode | Instruments (WebAudio voices) | Form |
|---|---|---|---|---|
| Intro | wonder -> alien threat -> heroic resolve | 70 -> 130 BPM; D minor, final D major | low drone, tremolo strings, brass swells, timpani, arpeggiated synth | one-shot 90-100 s |
| Main menu | epic, lonely grandeur | 78 BPM; D Aeolian with major lift | string ensemble (detuned saws + chorus), horn (filtered saw), pad, light choir (formant filters) | loop 60-90 s |
| Win (2) | triumph | 110 BPM, major | brass fanfare, timpani, choir, cymbal swell | one-shot 25 s |
| Lose (3) | funeral / exile | 52 BPM minor; funeral = muffled snare march, exile = lone synth lead over drone | solo horn, low strings, wind | one-shot 40 s |
| Research jingles (5/6/7) | success / sly theft / mysterious find | 3-6 s stingers | bell+marimba arpeggio (A); pizzicato + muted brass minor (B); glass harmonics + sparkle (C) | one-shot |
| Battle (8) | driving tension, escalating | 132-148 BPM; minor with Phrygian touches | pulsing 8th-note bass synth, taiko + snare, brass stabs, string staccato; 3 intensity layers added by battle state | loop 60 s |
| GNN (9) | jaunty broadcast, slightly pompous | 120 BPM major | brass + snare roll, xylophone, bright lead | 8-bar loop per bulletin |
| Colonise (10) | hopeful dawn | 84 BPM Lydian | harp, flute, strings, soft pad | 20 s one-shot |
| Ground combat (38 + 11/12) | martial; result stings: success = bright brass, failure = low brass sigh | 104 BPM minor | snare march, low brass, string ostinato | loop 30 s + stings |
| Bombardment (13/14) | dread; 14 = desolate wind | 60 BPM, diminished clusters | low drones, bowed metal, tolling bell | loop |
| Spy (15/16/17) | noir intrigue; sabotage = ticking tension; success = sly resolve | 96 BPM, minor / whole-tone | upright-bass-like pulse, muted trumpet-like synth, finger snaps, clock tick | loop |
| Council (39) | ceremonial gravitas, swelling at tallies | 66 BPM Dorian | brass choir, organ-like pad, bass choir, bells | loop 90 s |

**Race audience themes** (our own design suggestions based on each race's lore; not from sources). Each has a *calm* theme and a *hostile* variant (same motif, lower register, faster, harsher timbre; also used when the ambassador is angry):
| Race | Calm theme | Hostile variant |
|---|---|---|
| Human | noble march, strings + horns, major-modal, 96 BPM | same tune in minor, snare, brass-heavy |
| Mrrshan | agile syncopated 6/8, pizzicato + bongos + flute, Phrygian, 112 BPM | faster, growling low brass, distortion |
| Silicoid | very slow 56 BPM, tuned stone / marimba, deep drones, Lydian | grinding low pulses, crushed noise |
| Sakkra | dry hand-drums, rattles, hissing textures, reedy flute, 100 BPM | fast tribal toms, brass blats |
| Psilon | ethereal 72 BPM, glassy arpeggios, synth bells, whole-tone | cold dissonant clusters, tremolo |
| Alkari | airy and soaring flutes/piccolo, harp glissandi, 88 BPM Mixolydian | screeching high strings, rapid |
| Klackon | staccato 128 BPM marimba / clicks / pizzicato swarm, Dorian | buzzing saw swarms, dissonant |
| Bulrathi | heavy 76 BPM low brass, war drums, folk-minor, bass choir | pounding, distorted |
| Meklar | sequenced 120 BPM vocoder + FM bells, Dorian | glitchy noise, harsh clock |
| Darlok | slow noir 64 BPM, muted strings, whisper pads | heartbeat pulse, rising shepherd tones |

**Procedural-music implementation hints**: a `MusicDirector` with cue definitions `{id, loop, bpm, mode, root, voices[], patternGenerator(seed), layers[]}`; generate phrases from a small rule set (chord progression templates per mood, motif transformation: transpose/invert/rhythm-shift), schedule in WebAudio with a look-ahead scheduler, transition on bar boundaries with 1-bar crossfade, duck music -6 dB under SFX/voice; separate volume buses Music / SFX / UI; "Silent / FX / Music" quick toggle mirrors the original three-way setting.

---

## 13. What to upgrade in the remake (my recommendations, ranked by impact)

**Principle: keep the information design, interaction grammar and pacing; upgrade the rendering, feedback and discoverability.**

| # | Upgrade | Why it matters | Notes |
|---|---|---|---|
| 1 | **Resolution-independent layout** keeping the Control-screen skeleton (map / context panel / 8-button bar), plus widescreen, DPI scaling, touch-friendly hit targets | The original is a fixed 320x200 grid; modern players expect 1080p-4K. Keeping the skeleton preserves muscle memory | Use the original coordinates as ratios; right panel ~28% width |
| 2 | **Living galaxy map**: glowing class-coloured stars, volumetric purple nebulae, parallax dust, smooth pan/zoom (wheel, drag, pinch) + minimap, animated fleet icons with trails, **soft territory glow** per empire, range rings (fuel / scanner), route lines with ETA chips, fog of war, "last reported" ghosts | The map is 80% of play; huge perceived quality jump at low gameplay risk | Keep: star glare hides each system's single planet until explored; green = in range, red = out of range |
| 3 | **Planets as lit, rotating spheres** per type (14 types: Terran...Radiated, plus gas/none), atmosphere, clouds, city lights for colonies, orbiting ship icons in the star view | Starview/colony art is the emotional payoff of colonising | Procedural shaders: no art assets needed |
| 4 | **Slider UX 2.0**: big drag targets, keyboard +/-, visible locks, inline before/after previews (production, growth, waste, ship-turns), Ctrl/Alt "apply to all", undo/redo, optional presets | The five-slider colony panel is THE core interaction; clarity of consequence is the biggest usability win | Keep the readouts' vocabulary (NONE / CLEAN / MAX / n RP / x.x/Y) |
| 5 | **Ship designer with live preview** (2.5D hull + slots), stat deltas on hover, same pop-up tables (name / cost / size / power / space) and counts spinners, "fits / doesn't fit" colouring, quick filters | Design is the signature feature | Preserve 4 hulls, 4 weapons, 3 specials, 6 design slots |
| 6 | **Tactical combat presentation**: 2.5D arena over the same 10x8 grid, beams / missiles / shields / explosions / warp-out FX, damage numbers, path preview, range overlay, animation speed control, "skip to result" | Original combat is functional but visually sparse | Keep rules: Chebyshev movement, priority order + Wait, rocks, missile toggle, scan, retreat |
| 7 | **Character scenes** (GNN robot, scientist, hooded emperor + holographic ambassadors with 3 emotional states, Council chamber) with animated rigs, typed-on text, light FX, optional subtitles | These scenes are the game's personality; they are cheap to run at 60 fps in 2D/2.5D | Same beats and sequencing as 5.13, 5.17, 5.19, 7.1 |
| 8 | **Discoverability**: tooltips on every readout, an "explain this number" popover, keep the F1 annotated overlay as an optional "help mode", a searchable glossary, in-game event log, advisor-free but clear tutor cards on Simple/Easy | The original has zero tooltips; MOO1 hides many rules | Use the original one-time tutor triggers (7.3) |
| 9 | **Tables**: sortable/filterable Planets and Fleet ledgers (original has only static order), search ("/") to jump to a planet, saved filters, CSV export | Late-game empires of 20-40 colonies | |
| 10 | **Turn flow polish**: turn-summary card (production complete, techs, events, contacts), skip-all-animations toggle, "next idle colony" button, safety prompt for idle sliders, autosave every N turns with 6+ slots + continue slot, undo last turn (optional) | Keeps the two-click feel at scale | |
| 11 | **Accessibility**: colour-blind-safe banners (add shape + pattern per empire), scalable text, high-contrast mode, reduce-motion, full keyboard play, screen-reader labels on key tables, captions for audio events | MOO1 relies on colour for ownership and good/bad | |
| 12 | **Audio**: dynamic procedural score (12.5) + synthesised SFX (12.4), accessible mixer with Music / SFX / UI sliders and the original Silent / FX / Music toggle | Low-risk atmosphere upgrade | |
| 13 | **Web/platform**: 60 fps canvas/WebGL, offline PWA, saves in IndexedDB with export/import, shareable galaxy seed in URL | Browser-native value | |

**Do NOT change**: slider-based colony/research management (no build queues); one planet per star; terse labels; two-click reachability; Space/Esc/right-click conventions; event-driven music (map silent by default); six-design limit; the Council and Orion/Guardian as always-on elements.
**Cautions**: cutscenes and animations must all be skippable and short (MOO1 turns resolve almost instantly); never block input during map animation; keep modal count low; keep the sliders' *immediate* recompute.

---

## 14. The 25 most iconic features of MOO1 (ranked) - make sure none is omitted

| # | Feature | Why it is iconic / what to preserve |
|---|---|---|
| 1 | **Five-slider colony management** (Ship / Def / Ind / Eco / Tech, each lockable, always summing to 100%) | Replaced build queues; macro-management that scales to dozens of colonies; embodies producer Jeff Johannigman's simple / hot / deep mantra. Preserve readouts and locks |
| 2 | **Ship designer with miniaturisation** (4 hulls; Computer, Shield, ECM, Armor, Engine, Maneuver; 4 weapon slots; 3 specials; 6 active designs) | Players engineer their own fleets; components shrink/cost less as tech advances; designs must answer enemy weaknesses learned via spies |
| 3 | **Six-field slider research** (Computers, Construction, Force Fields, Planetology, Propulsion, Weapons) with **random per-game tech availability** (each race reaches only about half the tree), per-turn breakthrough chances and "choose next tech" scenes | Different game every time; trade / steal / capture tech as alternatives |
| 4 | **One planet per star, range-limited expansion** (fuel range in parsecs, colonise only inside range; reserve tanks, later stargates); 24 / 48 / 70 / 108-star random galaxies with nebulae | The expansion race is the opening game; star colour hints planet quality |
| 5 | **Ten asymmetric races** (Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok) with portraits, taglines, economy/diplomacy/military/research profiles and start attitudes | Strong replay identity; AI never picks your race |
| 6 | **AI leaders with personality + objective** (e.g. "Xenophobic Ecologist", "Honorable Technologist", "Pacifist Expansionist"), memory of your actions and a **17-step relations ladder** (Harmony ... Feud) | Diplomacy feels like dealing with characters |
| 7 | **Audience diplomacy scenes** (hooded emperor vs holographic ambassador) with treaty / trade / tribute / tech-exchange / threat menus and sweeteners | Distinctive presentation; races have two music moods |
| 8 | **Galactic Council** (population-weighted vote, 2/3 majority, every 25 years once 2/3 of stars are colonised; accept or defy -> Final War) | Second win path, dramatic chamber; also a strong anti-snowball device |
| 9 | **Orion and its Guardian**: the throne-world of the Ancients, 4x tech, guarded by a super-ship | The game's "holy grail" objective; "Guardian attacks <race>" is a legendary moment |
| 10 | **Espionage**: per-race spy networks, Hide / Espionage / Sabotage modes, steal a tech field, destroy factories / bases, incite revolt, frame another empire, spy reports, security slider | Light but deep covert layer |
| 11 | **Tactical combat** on a 10x8 grid with rocks, missiles vs beams, specials (stasis, pulsar, black hole, warp dissipator, technull, repulsor, cloak), scan, wait / retreat / auto | Battles only at planets; auto-resolve option keeps pace |
| 12 | **Planetary defence, bombardment and ground invasion** (missile bases, shields; bombs and bio-weapons; population-as-troops; captured factories/tech) | Conquest loop with animated landing / ground-combat scenes |
| 13 | **Environment classes, ecology and terraforming** (7 normal + 7 hostile planet types, waste cleanup, soil enrichment, atmospheric terraforming, Gaia; hostile-planet colonisation techs; colony bases) | The Eco slider turns pollution and growth into a decision |
| 14 | **Planet specials** (Ultra Poor / Poor / Rich / Ultra Rich minerals, Artifacts 2x tech, growth modifiers) and the **Map screen** (Colonies / Environments / Minerals) | Scouting reward; color-coded planning view |
| 15 | **Economy of BC**: planetary reserve, tax slider and transfers, ship / base / spy / security maintenance, trade treaties income, ledger screen | Gives the macro game its feedback loop |
| 16 | **RELOC rally points and population TRANS ports** (and Alt-R to repoint all) | Logistics without micromanaging ships |
| 17 | **GNN robot newscaster** with rankings, milestones ("1/8, 1/4, 3/8, 1/2 of the stars colonised"), and event bulletins | The universe's voice and humour |
| 18 | **Random events** (plague, earthquake, nova, industrial accident, assassination, computer virus, comet, pirates, derelict ship, rebellion, mineral discoveries) | Unpredictability, handled via GNN |
| 19 | **Space monsters** (Space Crystal, Space Amoeba) plus the Guardian | Surprise threats / mid-game spikes |
| 20 | **Scanner and information model**: contact range, "Last Reported As ...", Battle Scanner scan screen, report age, hidden planet data until scouted | Fog-of-war that rewards scouting and spies |
| 21 | **Five difficulty levels and Simple/Easy tutor pop-ups** | Approachable but scalable |
| 22 | **Four endings with cinematics** (good, tyrant, funeral, exile) and the GNN coda | Satisfying closure; no score screen |
| 23 | **Painted vignettes**: landing, hologram, council chamber, scientist, newscaster; chunky bevelled UI | The look people remember |
| 24 | **Event-driven soundtrack**: per-race two-mood audience themes, battle/GNN/research/council cues; silent map | Strong audio identity |
| 25 | **Speed of play**: hub screen, two-click rule, F-key cycling of colonies / fleets / threats, Space / Esc / right-click grammar, first-letter hotkeys | Why it still feels fast |

Other things players mention: no multiplayer (single-player focus), only 6 designs, no unit-by-unit micromanagement, short late game (the Council and Orion avoid the endless endgame).

---

## 15. Appendices

### A. Consolidated hotkey sheet [C][T] ([1oom+] marked)
| Screen | Keys |
|---|---|
| Control | G D F M R (A) P T N; S ships, L/R reloc, X trans; B scrap bases; C spies caught; F1 help; F2/F3 colonies; F4/F5 colonies with ships; F6/F7 colonies with new ships; F8/F9 colonies threatened (needs scanner tech); F10 quick save; Alt-C centre; Alt-M grid; Alt-R repoint all; / search [1oom+]; Ctrl + keypad scroll |
| Fleet Deployment / Reloc / Trans / Ships | Space accept, Esc cancel; arrow buttons (Ctrl = step 1 [1oom+]); / search [1oom+] |
| Planets | T transfer, O or Space OK, `,` `.` page; = in transfer dialog sets surplus share |
| Fleet | V specs (S in fixed), S scrap (C in fixed), Space OK, `,` `.` page |
| Specs | digits 1-6 scrap [1oom+], O / Esc close |
| Design | C clear, B build, Esc cancel; [1oom+] Ctrl +-10 / Alt max-zero on weapon counts |
| Tech | = equalise, + / - nudge, Ctrl +-10 / Alt 0-100 [1oom+], L lock [1oom+], 1-6 select field [1oom+], Space OK |
| Races | S status, R report, A audience, O / Space OK, 1-5 pick empire [1oom+: Esc backs out of mode] |
| Map overview | C / E / M modes, Space / Esc OK |
| Combat | A auto, P planet, S scan, M missile, X special (manual), R retreat, W wait, D / Esc done, G grid [1oom+] |
| Bombard | B bomb, Esc cancel, C / Space continue |
| Council | 1 / 2 / 0 vote; Y / N accept; Space continue |
| Colonise / Explore | Y / N; C / Space continue |
| Sabotage | F factories, B bases, I incite revolt, Esc cancel, C / Space continue |
| Dialogs | Y / N; 2 / 5 / 7 for 3-choice; Esc = No |
| Save / Load | 1-6 pick slot, Space OK, Esc cancel |
| Game menu | S / L / Q; I / F / M (Silent / FX / Music); Space or Esc close |
| Any scene | Space or click = skip / continue; Esc = skip intro/endings |

### B. Screen flow (text diagram)
```
BOOT -> [copy protection]* -> INTRO (skippable) -> TITLE / MAIN MENU (Continue | Load | New | Quit)
New Game -> OPTIONS (Size, Difficulty, Opponents) -> CHOOSE RACE -> CHOOSE BANNER -> NAME (emperor, homeworld) -> CONTROL SCREEN, year 2300
Continue / Load -> CONTROL SCREEN

CONTROL SCREEN (hub)
 |- click star: panel = own colony | enemy colony | unexplored | no colonies | fleet deployment | en-route fleet
 |    |- click star again -> STAR VIEW
 |    |- SHIPS -> build grid; RELOC -> rally map; TRANS -> transport panel; B -> scrap-bases dialog
 |- bottom bar: GAME menu | DESIGN | FLEET (-> SPECS -> scrap) | MAP (Colonies/Env/Minerals) | RACES (-> STATUS | REPORT | AUDIENCE) | PLANETS (-> transfer) | TECH | NEXT TURN
 |- NEXT TURN -> [movement animation] -> spy results -> battles (pre-battle -> tactical | auto) -> tech scenes -> explore cards / colonise prompts + landing
 |             -> bombardment / transports / ground combat -> events (GNN) -> AI audiences -> COUNCIL (if due) -> year++ -> CONTROL SCREEN with notice boxes
ENDINGS: WON (good via Council, tyrant via conquest) -> cinematic -> GNN | LOST (funeral, exile) -> cinematic
```

### C. Screen inventory (about 55 distinct screens/scenes)
Boot/menus: intro, title/main menu, new-game options, choose race, choose banner, name/homeworld, save, load, game menu (9).
Map/colony: control screen (7 panel states), star view, explore card, colonise prompt, landing animation, rename prompt, fleet deployment, en-route/enemy fleet panel, RELOC, TRANS, SHIPS grid, scrap-bases dialog, planet-transfer dialog (about 13).
Management: galaxy map (3 modes), planets, fleet, specs, design (+3 pop-up tables), tech, research-choice, research-breakthrough (+ follow-up dialogs), races, report, status (about 13).
Diplomacy/espionage: audience (player-initiated, AI-initiated), steal, sabotage choose, sabotage result, victim notice, spies-caught (about 7).
Council: one scene with nomination, vote, tally, accept-prompt, final-war message.
Combat: pre-battle panel, tactical, scan list, planet box, bombard prompt, bombard result, landing/ground combat (3 phases) (about 8).
News/notices: GNN, notice boxes, fleet-production report, new-ships panel, help overlay, yes/no dialogs.
Endings: good/tyrant, funeral, exile, GNN coda.

### D. Layout constants for the Control screen and key screens (original 320x200 pixels; derive ratios) [C]
| Screen / element | Rect or position |
|---|---|
| Map viewport | (7,7)-(221,177); map coordinates drawn at 2x; viewport shows ~107x85 map units |
| Right panel | (224,5)-(314,178) |
| Planet name bar | y 8-20 (click rename) |
| Planet info box | (228,25)-(309,52) (red frame; purple frame for nebula planets) |
| POP / BASES / PRODUCTION text | POP value x 265,y 61; BASES x 311,y 61; PRODUCTION "n (m)" right-aligned x 311,y 72 |
| Slider rows (5) | y0 = 81 + 11 i; lock/label cell x 226-245; track x 253-278 (25 px); minus x 247-251; plus x 280-283; readout right-aligned x 311 |
| Build box | picture (228,139)-(275,175); name centred x 252, y 169 |
| SHIPS / RELOC / TRANS | x 282; y 140 / 152 / 164 |
| Bottom buttons | y 181-194; x: Game 5-36, Design 40-75, Fleet 79-111, Map 115-139, Races 143-176, Planets 180-221, Tech 225-254, Next Turn 258-314 |
| Galaxy Map screen | buttons x 246, y 27 / 47 / 67; OK (246,181); title at (242,8); key at (250,88) |
| Planets screen | 12 rows at y0 = 21 + 11 i; columns (right-aligned x): # 17, Planet 25 (left), Pop 83-99, growth 111, Factories 132, Shield 149, Bases 170, Waste 189, Prod 214; Space Dock 221 (left); Notes 268 (left); buttons Transfer (209,181), OK (256,181); page arrows (292,159) / (292,176); tax slider (213,160) |
| Fleet screen | 5 rows at y0 = 33 i + 17; station column x 5; design columns x0 = 44 j + 48 (cell 36x25); buttons View (180,181), Scrap (224,181), OK (268,181); arrows (307,24) / (307,156); maintenance text (137,185) |
| Design screen | Computer (17,21), Shield (17,33), ECM (17,45); Armor (167,21), Engine (167,33), Maneuver (167,45); weapon rows y = 70 + 10 i; special rows y = 115 + 10 i; hull list x 21-57, y 162-184; ship image (93,165); buttons Cancel (282,150), Clear (282,166), Build (282,182); name field (214,151); cost (257,163); space (270,175 / 187) |
| Tech screen | list x 9, y 37, 7 px per row, 16 rows; field rows y = 21 i + 22 (lock x 168-218, slider x 227-277, % at x 307); OK (277,181); total research (309,169) |
| Races screen | slot offset x = (i/3)*157, y = (i%3)*64; security slider (238,142); buttons at y 180: Status x 165, Report 205, Audience 245, OK 290 |
| Tactical screen | grid 10 x 8 cells of 32 x 24 px (y 0-191); bottom bar y 192-199; buttons at x 99 (Auto), 123 (Planet), 153 (Scan), 175-208 (Missile), 210-239 (Special), 241 (Retreat), 274 (Wait), 297 (Done); planet info box (100,50) 132x38 |
| Audience | frame at (0,0); emperor graphic (0,-2); ambassador x 96; dialogue text x 38, y 140, width 245 (box ~39 px tall) |
| GNN | anchor (14,14); globe (76,36); headline icon (208,38); text panel (32,142)-(287,182) |
| Council | message text (10,169) width 305; vote tallies on the top line; 3 prompt lines at y 169 / 179 / 189 |
| Save / Load | slot frames x 134, y = 33 + 18 i, text x 149; Cancel (138,145)-(192,162), OK (202,145)-(256,162) |
| Game menu | Save (115,56), Load (115,81), Quit (115,106); Silent (210,56), FX (210,81), Music (210,106); close area (173,134)-(226,150) |

### E. Original vs 1oom - things NOT to assume are original
Planet/fleet table sorting; "Continue/Undo/Initial" load slots; Custom Game / Challenge / local multiplayer; combat auto-resolve summary before battle (Auto/Retreat buttons on the pre-battle panel); search ("/"); mouse wheel; edge scroll; "uhjk" scroll keys; Ctrl/Alt apply-to-all on sliders; click-destination-again-accepts; explicit cursor context (Alt); extra star-label modes; weapon-type filter; "Max pop" column; Ships button hotkey remaps; planet "i" detail toggle; zoom beyond 1x. These make good *remake* ideas but are not original behaviour.

### F. Open gaps and unverified items
- **Manual text**: the full 1993 manual (72 pages, retrogames.cz / Scribd copies) is an image PDF that the available tools could not read; only fragments (combat button descriptions, Game-menu summary) were retrievable via search summaries. A transcription of chapters "The Control Screen", "The Fleet Screen", "The Races Screen", "Combat" would close most remaining wording gaps.
- **No screenshots seen** for: tactical combat, ground combat/landing, bombardment, spy screens, game menu, save/load, funeral/exile endings, GNN good-ending (all described from 1oom source). The pre-battle panel, GNN, Council, audience, design, research and map screens were seen.
- Exact on-screen wording for most buttons/strings (stored in the LBX files) and the 8 missing race taglines. The 17-step relations ladder comes from StrategyWiki via a search summary (bands of 12 points; it matches the code's 17 steps) - double-check the exact label order in the real game.
- Track 4, which of tracks 11 / 12 is the "win" sting, what each of the 40 tracks actually sounds like (not listened to), the exact set/format of the 41 SFX (VOC? [?]), and the original title-menu hotkeys.
- The small counter on the colony build box; "Tutor" availability in the original menu; the original autosave cadence (1oom comment says every 5 turns); original F4-F7 naming; Orion/Guardian-specific screens; per-race audience ambassador expression names.
- Colours are approximations by eye (no pixel sampling).

### G. Sources
- 1oom source: https://github.com/1oom-fork/1oom (`src/ui/classic/*.c`, `src/game/game_audience.c`, `game_election.c`, `game_shiptech.c/h`, `game_turn.c`, `game_new.c`, `game_news.h`, `game_save.h`; `doc/usage_classic.txt`).
- Let's Play archive (screenshots + commentary): https://lparchive.org/Master-of-Orion/ (Updates 1-18 mainly), by Thotimx.
- oldgames.sk screenshots: https://www.oldgames.sk/en/game/master-of-orion/screenshots
- Digital Antiquarian: https://www.filfre.net/2020/01/master-of-orion/ ; Wikipedia: https://en.wikipedia.org/wiki/Master_of_Orion
- StrategyWiki (via search summaries; direct fetch blocked): Master_of_Orion/Controls, /Obscure_Interface_Features, /Diplomacy, /Victory_conditions, /Winning_defensive_battles, /Tips_and_Tricks.
- Design analysis: https://androidarts.com/spaceconquest/gamedesign.htm ; QT3 Classic Game Club thread; GameStar retrospective (DE); lilura1 review; nodicenoglory retrospective; MobyGames/GOG reviews (via search).
- Audio: Steam "Master of Orion: Soundtrack & Score" listing (remake album, 49 tracks, confirms Peace/War pairs per race); VOGONS and RealmsBeyond threads (MT-32 vs GM, 40 tracks in MUSIC.LBX) via search summaries.
- Manual (not readable here): https://www.retrogames.cz/manualy/DOS/Master_of_Orion_-_Manual_-_PC.pdf

