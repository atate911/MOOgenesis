# UI visual reference - Group B: Design, Tech, Scientists, Races/Diplomacy, Audience, Spies, Council

Describes the 1993 Master of Orion (MOO1) screens from public Let's-Play screenshots only. No images were saved or copied; only short labels are quoted. Colours are sampled approximations (hex) from the screenshot pixels (JPEG/scaled, so +-8 per channel).

**Source**: Let's Play Archive, "Master of Orion" (SSLP, Psilon/Klackon/Silicoid/... runs): `https://lparchive.org/Master-of-Orion/Update%2002/` (fleet + specs), `Update 03` (tech screen, tech-choice scenes, breakthrough, GNN), `Update 04` (design editor, galaxy-map overlay), `Update 06` (Races, Report, Racial Stats), `Update 07` (High Council, Report), `Update 12` (audience, espionage pop-ups), `Update 18` (Council result), `Update 21/23/50` (audience), `Update 30/41` (late Races screen), `Update 35` (Silicoid scientist), `Update 08` (late tech screen). Screenshots are ~896x672 (4:3) = the 320x200 (VGA 13h, pixels were ~1.2:1 tall) game stretched to 4:3. All positions below are fractions of the 4:3 game picture (x from left, y from top). Hardware pixel font ~ 8x8 cells scaled x2.8.

## 0. Shared visual language (applies to every screen in this group)

- **Two frame families**:
  1. **Brown "leather/clay" family** (Races, Report, Racial Stats, Planets table, Fleet grid, Galaxy Map overlay, Tech screen): body fill muted warm brown `#826551`, outer bevelled frame a lighter brown `#866853` with a 1px lighter top-left edge and darker bottom-right edge; inset "wells" darker `#5b4533`/`#413333`; table rows `#6d5645`. Looks like pressed terracotta/leather. Frame thickness ~1.5% of width; screens fill the *whole* 4:3 picture, no map behind them.
  2. **Grey metal family** (Design screen, main-screen map frame, popups): steel greys `#515252` / `#797979` / `#929292` bevel, black inset panes, **orange `#f38600` accents** (title plates, corner chevrons, side clips) - reads as a cockpit/avionics panel.
  3. **Scene family** (scientist, council, audience, GNN): full-bleed illustrated 4:3 pictures with a caption bar; no panel chrome except the caption.
- **Font**: a chunky, slightly condensed all-caps pixel font for labels (mixed-case "Racial Stats", "Choose the area of research..." in a hand-pixelled sci-fi face with distinct glyphs - flat-topped "R", stencil-like "S"). Scene captions use a larger, wider 2x version. Tiny table text is ~2.2% of picture height (cap height ~1/45 of height). Always 1-bit hard-edged (no antialiasing); shadows: a 1px darker offset in the table headings.
- **Text colours**: body labels brown-cream `#e0b890` (Report lists) or white `#ffffff` (design editor), field names teal-mint `#449171`/`#7fd8c0` (Tech field labels on dark-teal plates), headings orange `#f48201` / amber `#e3b327`, prices/numbers green `#40d040`, selection = dark-red bar `#620b03` with white text, disabled = dim grey `#707070`, warnings red `#ff2828`.
- **Mouse cursor**: a small pixel **hand (pointing finger, tan/peach with white highlight)** - appears in every screenshot. Hover/selected rows invert to dark red.
- **Dither/gradients**: none inside panels (flat fills). Banding only in the scene art (2-3 step shading, hand dithering on skin, soft glow rings).

---
## 1. Ship Design screens (Design button -> New Ship Design editor + library "Fleet" grid + "Specs")

### 1a. Fleet / ship-library grid (button bottom bar "Fleet"; also opened from Design)
URL: Update 02 image 2. Brown family, fills the screen.
- **Layout**: a 7-column x 5-row grid of equal embossed cells (each ~0.12 w x 0.14 h), occupying x 0.02-0.97, y 0.02-0.88. Column header strip (y 0.03-0.07) with yellow `#e8d840` caps labels on dark brown: `STATION`, `SCOUT`, `FIGHTER`, `DESTROYER`, `BOMBER`, `COLONY SHIP`, `NO DESIGN` (the last greyed - empty slots). Max 6 designs per player -> 6 columns + first column for the *location*.
- **First column**: each row is a location cell showing a tiny starfield thumbnail with green text `UNKNOWN SYSTEM` (green `#40e040`, 2 lines, stencil caps) i.e. "where those ships are". Cells in design columns show the ship icon thumbnail on black with a yellow tick/count bar at right.
- Right edge: two **scroll arrows** (up arrow top, down arrow bottom) in small beveled squares at x 0.98.
- **Footer** (y 0.90-0.97): left a long inset bar "SHIP MAINTENANCE COST  0 BC/YEAR" (x 0.02-0.50), then three bevelled grey buttons: `SPECS`, `SCRAP`, `OK` (right, each ~0.11 w).
- Empty cells are the same brown, just un-inked; the whole thing reads as a spreadsheet of coffered tiles.

### 1b. Specs screen (button Specs)
URL: Update 02 image 3. Brown family, **one row per design**, rows ~0.19 h:
- Far left: a ship portrait cell (~0.1 w x 0.15 h, black with ship sprite) with the **count of ships built** in white at its bottom-right.
- Next block (x 0.14-0.52): design name in yellow caps (`SCOUT`, `FIGHTER`...) with a grey `SCRAP` button right of it; below, a 2x3 mini-table of stats on dark-brown cells: `SHIELD`, `BEAM DEF`, `ATT LVL`, `WARP`, `MISL DEF`, `HITS`, `SPEED` - label in cream, value in **red-brown `#c04030`** (numbers in tiny red font).
- Middle column (x 0.53-0.75): weapon list, cream text like `1 LASER`, `1 NUCLEAR MISSILE 2c`, `2 NUCLEAR BOMBS 10c`.
- Right column (x 0.76-0.97): green `#40d040` special header (`RESERVE TANKS`, `COLONY BASE`) or grey `NO SPECIALS`; at bottom `COST 10 BC` (label cream, value white).
- Last row empty (an empty brown cell set).

### 1c. NEW SHIP DESIGN editor
URLs: Update 04 images 6-9 (new design), Update 07 image 22 (Medium hull with shield/weapon filled). Grey-metal family.
- **Overall**: 4:3 picture fully covered by a chunky steel frame (~2% thick, bevel light `#929292` top-left, dark `#515252` bottom-right). **Title plate** top centre x 0.38-0.61, y 0.02-0.07: orange `#ff8e00` plate with black caps "NEW SHIP DESIGN". Left and right of it, orange chevron/flag shapes (~0.17 w each) at the very top corners (angled orange stripes with "arrow" notch). Along left/right mid edges (y ~0.40-0.55), orange horizontal clip lugs, plus small orange L-brackets at lower corners (y 0.75) - pure decoration signalling "console panel".
- **Backdrop behind the panes**: a dark planet + orbital station render (reddish-black limb on the left, blue-grey docking ring tower in the centre) dimly visible *through* the black panes (acts as a watermark; see-through effect via dark translucent panes).
- **Three stacked panes** (black translucent, thin grey divider bars between):
  1. **Stat pane** y 0.07-0.27 (x 0.03-0.97), split into two columns:
     - Left: rows `Computer`, `Shield`, `Ecm` (slot labels, y 0.12/0.18/0.24). Label is **white when a component is available/selected, teal-green `#178768` when empty/unavailable** (e.g. `Ecm` in teal). Right of the slot label the chosen component (e.g. `CLASS III` in teal) and a derived stat: `ATTACK LEVEL 0`, `ABSORBS 3 HITS`, `MISSILE DEF 2` (teal labels, white values). 
     - Right column: `Armor` (e.g. `TITANIUM`), `Engine` (`RETROS`), `Maneuver` (value `1`) with derived `HIT POINTS 18`, `WARP 1 DEF 2`, `COMBAT SPEED 1`. Labels in teal, component names in **orange-yellow**.
  2. **Weapons pane** y 0.29-0.55: header row (white tiny caps) `Count   Ship Weapons   Damage   Arc   Notes`; four rows `Weapon 1..4` (white = active/selected row, teal = unused) each with a **count with up/down green spinner arrows** (small dual triangle, green) at x ~0.19, chosen weapon (green `#178768` name e.g. `HEAVY LASER`), damage `1-7`, arc `2`.
  3. **Special pane** y 0.57-0.72: rows `Special 1..3` with the chosen device in teal and a description to the right (e.g. `STANDARD COLONY BASE ... ALLOWS NORMAL PLANET LANDINGS`).
- **Bottom control strip** y 0.74-0.98 (darker mid-grey `#4d4d4d` plate):
  - **SHIP SIZE** selector (x 0.03-0.22): a recessed grey box listing four words stacked: `SMALL / MEDIUM / LARGE / HUGE`; the active size is **bright white**, the others dim grey; a tall orange slider thumb on the right of this box tracks the selection (moves up/down).
  - **SHIP ICON** selector (x 0.24-0.44): black square showing the hull sprite (tiny yellow/grey ship, top-down side view) with an orange up/down arrow bar at its right to cycle icons. Title plates "SHIP SIZE" and "SHIP ICON" are orange tabs with caps text (two small orange tick marks flank them).
  - **Four readout bars** (x 0.50-0.86, each ~0.06 h) with label left in white caps and value right in white: `NAME  STARFIGHTER` (editable), `SHIP COST  6 BC`, `TOTAL SPACE  40`, `AVAILABLE SPACE  39`. Bars are `#6c6c6c` with black inset text field.
  - **Buttons** x 0.88-0.97 stacked: `CANCEL`, `CLEAR`, `BUILD` (grey bevelled `#909090` with black caps; each ~0.06 h).
- **Component picker overlay** (Update 04 images 8, 9): clicking a slot opens a black table over the weapons/special panes (a *replacement* of the middle region, bottom strip stays). Heading plate `WEAPONS` / `SPECIAL DEVICES` (black plate with green `#40d040` caps, centred). Column headers in green: `MAX WEAPON NAME DESCRIPTION DMG COST SIZE POWER SPACE`. Rows: **selected = red-brown bar `#620b03` with white text**, available rows in white, **unavailable (not enough space) rows dimmed to grey `#707070`**. Left/right edges have vertical grey ribbed "scroll rails" (diagonal hatch) at x 0.02 and x 0.95. Numbers right-aligned in green/white columns.
- **Interaction**: hover = nothing special except hand cursor; click slot = picker; spinner arrows change counts; 'Clear' resets; space overflow disables items. Value changes recolour label teal->white as component is chosen.
- **Information shown**: attack level, absorbs, missile defense, hit points, warp/def, combat speed, per-weapon count/damage/arc, cost, total space, free space.
- **To evoke today**: keep 3-pane layout (defence stats / weapons / specials) and the bottom row (size selector, icon, name, cost/space, Cancel/Clear/Build). Modernise: render live 3D/2D hull in the central backdrop (replace the station watermark with the *design's* ship), colour-code space bar (used vs free), show stat deltas on hover, replace the 4-word size list with large pill buttons, keep orange as the "edit" accent. Keep disabled=dim, selected=dark-red convention.

---
## 2. Research / Tech screen (Tech button)

URLs: Update 03 image 16 (early), Update 08 image 2 (mid game). Brown family.
- **Composition**: left ~49% = field picture & tech list; right ~49% = sliders; bottom 25% = description + total/OK.
- **Top-left**: six field buttons in two rows of three (x 0.02-0.50, y 0.03-0.15): `COMPUTERS`, `CONSTRUCTION`, `FORCE FIELDS` / `PLANETOLOGY`, `PROPULSION`, `WEAPONS`. Navy plates `#39395b` with bright-blue text; **the selected field is dark-red `#4b0000`** with white text.
- **Picture pane** (x 0.02-0.49, y 0.18-0.74): black starfield picture with a planet limb (lower-left, brownish-green crescent), a moon (upper right) and three small gull-wing fighter ships - a generic illustration (the same picture for all fields in the cases seen). With a **vertical scrollbar** (up/down tiny arrows at x 0.49, top and bottom). The first lines of text overlay the picture: small header like `RETRO ENGINES` (blue) then researched techs in white (e.g. `HYDROGEN FUEL CELLS (RANGE 4)`); later in the game the list shows all techs in the field (`ECOLOGICAL RESTORATION`, `IMPROVED TERRAFORMING +10` ..., latest one highlighted white).
- **Description box** (x 0.02-0.85, y 0.76-0.98): brown well with tan text describing the highlighted tech ("Fuel reserves allow ships to move up to ..."), ~2 lines.
- **Right header row** (y 0.03-0.10): plates `TECHNOLOGY` (grey-brown), `Research` (orange `#f48201` mixed-case, centred large, no plate), `LEVEL` (right).
- **Six slider rows** (x 0.53-0.98), rows span y 0.10-0.78, ~0.105 h each (row = label line + sub-text line):
  - Field name in a **teal-mint `#449171` plate** (`COMPUTERS`...), width ~0.2.
  - A **slider track** (x 0.62-0.82, black-brown `#241c14` with grey end arrows ◀ ▶ in red-brown arrows). **Fill is teal `#2c8a8a`**; zero = empty. Locked sliders turn red (as with colony sliders).
  - A **light-bulb icon** (yellow `#ffed63` bulb) to the right of the slider: *full* bulb fill = chance-of-breakthrough meter (fills as invested RP approach cost; becomes `NN%` when finished).
  - A small box with the **tech level number** (`8`, `10`, ...) at x 0.93-0.98.
  - Under the slider a one-line summary in tan small caps: `SCANNER RANGE 3, ROBOT CONTROLS 2/COL`, `FACTORY WASTE 100, GROUND COMBAT +0%`, `TERRAFORM +0, WASTE ELIMINATION 2/BC`, `SHIP RANGE 3 PARSECS`...
- **Footer right**: framed **TOTAL RESEARCH** box (x 0.86-0.98, y 0.77-0.88, label two lines, number like `214 BC`/`587 BC`) and **OK** button (grey, y 0.90-0.97).
- **Palette**: bg `#826551`, panes `#413333`, slider track `#241c14`, fill `#2c8a8a`, teal labels `#449171`, bulb `#ffed63`, title orange `#f48201`.
- **Interaction**: click a field tab to list techs; sliders drag or arrow; `=` equalises; click label to lock; hand cursor.
- **To evoke today**: keep tab row + six sliders + per-field one-line summary + light-bulb progress. Modernise with a field icon per row, an ETA/chance chip, a tech-tree drawer in place of the generic picture, and live numeric RP per slider; keep the orange "Research" heading and teal slider fill.

### 2b. "Choose the area of research" (tech-selection scene)
URLs: Update 03 images 3-6, 9, 12-13, 21-22; Update 04 images 14-15. Scene family. Appears whenever a field has a pending choice.
- **Scene art**: an alien-race **scientist laboratory**: dark olive/green-black room `#130f0b`, wall panels with small monitors (planet icon in orange, star-chart, globe grid) along the top, blue wire-frame ship schematics on the left wall, coloured readout strips (magenta/green/orange bars) on a left console, a keyboard stand in the lower middle, a **thick grey stone/metal floor `#575859`** (grey-brown noise texture), brass coils (gold/red rings) beside the console right, and a tall tower/silo through a window on the far right (blue-night sky `#141430`).
- **Character**: the player's race scientist (here the Psilon: tall blonde-yellow hair `#e0cb8c`, cyan eyes `#40c8c8`, purple gem forehead `#6020c0`, white-silver lab suit with blue glyph chest badge) standing **left of centre, filling x 0.0-0.45 and the full height**, hands clasped. ~42% of the width. The character is **the same illustration every time** (only head/shoulder pose); each race has its own scientist.
- **Caption (top)**: red `#e83820` one-line prompt across the top centre: `Choose the area of research our scientists now focus on` (hand-pixel font, with a 1px black outline). 
- **List panel** (right, x 0.45-0.98, y 0.15-0.65): a dark-grey metal *monitor/console board* `#4a4a4a` with thick bevel. **Title plate** (black inset, centred, **green `#40d040`** caps/mixed text: `Computer Technology`, `Construction Technology`, `Force Field Technology`, `Planetology Technology`, `Propulsion Technology`, `Weapon Technology`). Beneath it a **list well** (black rows) with **2-3 selectable names**; the **highlighted row is dark red `#620b03`** with white text; others white on black. Small ornamental grey nubs at the vertical midline of the well sides.
- **Description area**: beneath list, white text 2-4 lines (e.g. effect + cost in **green parentheses `(510 RP)`**). The list height grows with option count.
- **Interaction**: hover shows hand; click a row to select/confirm. A short jingle sounds on appearance.
- **To evoke**: keep layout (character left, list right, description + RP in green) and use the character as a "lens" for tone; add costs sorted by tier, ETA, and tech icons.

### 2c. "Breakthrough" scene
URLs: Update 03 image 20 (Psilon), Update 35 image 11 (Silicoid). Same lab, but:
- **Headline top**: red `#e83820` `Psilon Scientists Achieve A Propulsion Breakthrough` (race + field); below it a **teal caps tech name** `HYDROGEN FUEL CELLS (RANGE 4)` (`#60e0c8`, ~14px, outline).
- The right-hand console replaced by a **large tilted star-chart monitor** (dark navy `#1d1d3d`, blue grid lines `#3b3b60`, white star dots, constellation lines, small orange text blocks) with a keyboard below; for Silicoids the scientist (blue shaggy rock-moss creature with white box badge, holding a pointer) points at the chart.
- **Caption (bottom)**: big wide **yellow `#f0c820`** 2x font, 2 lines over the floor: `Fuel reserves allow ships to move up to 4 parsecs away from colony planets.` with 1px black drop outline.
- Floor in this scene shows blue-ish `#27507d` for the Silicoid variant (so floor tint differs per scene).

---
## 3. Races / Diplomacy screens

### 3a. Races screen (Races button)
URLs: Update 06 image 10 (early), Update 30 image 9 and Update 41 image 2 (late war). Brown family, fills screen.
- **Three race rows** stacked, each ~0.31 h (y 0.03-0.34, 0.36-0.66, 0.68-0.98 approx; third row is shortened by the footer area).
  - **Portrait cell** x 0.03-0.16: black-blue inset `#141430` with the race **leader bust** (hooded purple cloaked Darlok, grey Silicoid mop, green-beaked Alkari). 
  - **Race name button** under the portrait: a rectangle in the **race banner colour** with white/black name: `Darloks` (white), `Silicoids` (magenta/purple `#350a35`~ bright `#a030a0`), `Alkaris` (green `#287219`). In other games the banner colours shuffle (e.g. Klackons purple, Psilons red, Sakkras tan, Sakkras grey) so *the button colour = that empire's flag colour*.
  - **Status plate** x 0.17-0.50 (brown `#826551` rounded rect): two lines: treaty (`No Treaty`, `Final War`, `War`) and trade (`No Trade`). Beneath it, an **attitude bar**: horizontal gradient strip from **red `#ff2828` (left, hostile) through dark mid to green `#49cf24` (right, friendly)**; a label stamped in the bar centre in yellow caps (`UNEASE`, `NEUTRAL`, `HATE`, `FEUD`, `DISCORD`). Below the bar a small **blue-grey triangle pointer `#6767ab`** shows the exact attitude position.
  - **Spy row**: a small box `NO SPIES` / `5 SPIES` / `2 SPIES` (cream text), then a **slider** (black track with red end arrows; teal fill when >0) and a box with `NONE` / `1 y` / `5/y` (spy investment per year).
  - **Spy mode buttons**: three side-by-side blue-violet bevelled buttons `#a7a7c8`/`#4a4a8a` with navy caps text: `HIDE` `SABOTAGE` `ESPIONAGE` (the selected mode inverts to lighter lavender).
  - **Right panel** x 0.51-0.98 per row: two stacked grey-brown wells x 0.51-0.66 (empty slots, lined) and a long well x 0.67-0.98 with centred cream big text `No Contact` (letters bold, ~2.5% height, embossed) showing the relation of this race with *other* races (in contact -> flags/treaty icons).
  - A **"Diplomat Gone" overlay** appears across the portrait (white outlined text, two lines) when the diplomat has been expelled / contact lost.
- **Footer (y 0.74-0.98 in the third row region)**: a framed row `OVERALL SECURITY` (cream caps label) + slider (black track with red arrows, fill teal) + readout `+0%` / `+10%`; underneath sub-text `SECURITY INCREASES THE CHANCE OF CATCHING ALL ENEMY SPIES.`; then `ALLOCATIONS: 0% PLANETARY RESOURCES` (cream); then 4 buttons in a row (y 0.93-0.98): `STATUS`, `REPORT`, `AUDIENCE`, `OK` (grey `#787878` bevel, black caps; `AUDIENCE` greys out/dim when no contact or at war).
- **Palette**: outer frame `#6d5645`, panel `#867462` / `#826551`, hostile red `#ff2828`, friendly green `#49cf24`.
- **Information**: treaty state, trade state, attitude, spies, security %, how much of the economy goes to spying.
- **To evoke today**: preserve the 3-row race card layout with portrait + banner button, gradient attitude bar + marker, tri-mode spy buttons, security slider, and the footer verbs `Status / Report / Audience / OK`. Modernise: leader animations, relationship history, tooltips on attitude stems, per-race colour glows.

### 3b. Report screen (race "Report" button)
URLs: Update 06 image 11 (early, old), Update 07 image 11 (current). Brown family.
- **Left rail** x 0.02-0.25: a large portrait in a **double bevelled square frame** (x 0.05-0.20, y 0.04-0.28, dark `#2a2a50`), then a white name plate `Darloks` (white fill, black text; x 0.05-0.20, y 0.30-0.35), then 2-line personality blurb (`Xenophobic Ecologist`, black tiny text on brown). Below: sunken box `REPORT IS 15 / 72 years old` (age of intel) or `REPORT IS CURRENT`; two stacked sub-panels titled in **dark-red underlined caps** `Alliances` and `Wars` (each a brown box with title in dark red `#8a2a20` mixed-case + underline rule).
- **Right 2x3 grid** (x 0.27-0.98), headings in teal-mint `#7fd8c0` caps on thin brown plates: `COMPUTERS`, `CONSTRUCTION`, `FORCE FIELDS`, `PLANETOLOGY`, `PROPULSION`, `WEAPONS`. Each pane is a **dark-brown well `#5b4533`** listing the known techs (cream/tan caps text `#d0a878`); **newly learned (via spying) techs are shown white/brighter**, older ones tan. Panes ~0.36 w x 0.27 h.
- Hand cursor. Clicking anywhere returns.
- **To evoke**: 2x3 tech-ledger with highlight for newly discovered tech; left rail with the leader and notes.

### 3c. Racial Stats ("Status" button)
URL: Update 06 image 12. Brown family. Single most-used "how are we doing" screen, **one of the only places that shows other empires' totals**.
- Top banner (y 0.03-0.11, x 0.03-0.97): dark navy bar `#141438` with a red `#e82820` **digital `Year: 2372`** box on the left and centred orange **"Racial Stats"** heading.
- Six panels in a 2-col x 3-row grid (each ~0.46 w x 0.22 h) with an **orange-title tab** centered on each top edge: `Fleet Strength`, `Population`, `Technology`, `Planets`, `Production`, `Total Power`. Inside: 4 race names (`PSILON / DARLOK / SILICOID / ALKARI`) in tiny black caps stacked at left, each with a **horizontal bar** to the right in that race's colour: Psilon yellow `#e8e020`, Darlok white `#e8e8e8`, Silicoid purple `#9060e0`, Alkari green `#40c020`. Bars are 2px thick, lengths proportional to each stat; `Total Power` bars are the longest and thickest.
- **To evoke**: keep as the "scoreboard" with six bar groups; add sparklines over time and hover for numbers.

### 3d. Spy pop-ups on the map
URLs: Update 12 image 11 ("<Race> Espionage ... steal the plans for: X") and image 12 ("Spies Caught  Yours / Theirs").
- A **brown rounded modal** (x 0.30-0.78, y 0.22-0.50, same fill as Races) with an inner thin darker border, title in the race colour (`Silicoid Espionage`, violet `#a888e0`), centered white-cream text lines. The caught-spies table is on a flat grey `#808080` pane (x 0.28-0.62, y 0.25-0.58) with columns `SPIES CAUGHT | YOURS | THEIRS` and rows per race (`DARLOK:`, `SILICOID:`, `ALKARI:`) black text on grey. Appears over the galaxy map, stays until click.
- *There is no separate "Spies screen"* in MOO1: spies are handled by the Races screen (slider + Hide/Sabotage/Espionage), the Security slider, and these pop-ups.

---
## 4. Audience / diplomacy dialogue

URLs: Update 12 images 7-8, Update 21 image 11, Update 23 image 15, Update 50 image 11. Scene family.
- **Setting**: an audience chamber - dark navy circular dome `#1c1c3c` with a **glowing yellow-green ring `#c8d820`** around a deep-red/blue banded circular platform at the top (like a hovering lens); thin vertical grid arcs on the walls. Shows a window to space at the top.
- **Composition**: the *speaker* (other race's leader) in 3/4 front view, large (~50% of width and ~75% of height, x 0.45-0.95, y 0.00-0.70), standing on a **dark pad with a translucent glowing barrier** (the leader appears as a hologram - lower body fades into noise/dither). The *player* (hooded robed figure seen from behind, in the player's banner colour: orange-brown `#614900` in one game, crimson `#a01820`, grey `#707070`) at **left, seated/standing at x 0.25-0.42, y 0.30-0.65**, with black dome-shaped hand rests.
- **Caption box**: full-width at the bottom (x 0.0-1.0, y 0.64-0.98): a **teal-cyan panel `#4c9e9e`** with a faint ghosted **ship silhouette** (darker teal `#3d8686`) in the background; ornate **red/brown end caps** at left and right (vertical "totem": red `#600808` double-frame with a cream/orange pin-stripe), each cap ~0.1 w. Text in dark brown/maroon `#2a1010`/`#70202a` (for the player colour) at ~2.8% height, mixed case, left aligned, 2-4 lines.
- **Response options**: bullet list (`• Accept`, `• Reject`) in the same text at the bottom of the box, bullet = black dot; chosen row not highlighted - hand cursor only.
- **Information**: other empire's speech: threats, ultimatums, treaty offers (peace, trade, alliance), refusals ("do not consider your offer a fair one"), tribute acceptance. 
- **Race leader art**: Psilon (tall, gold hair, green robe), Silicoid (grey-black wispy rockbeast with yellow eyes), Mrrshan (orange cat in red bikini-top with gold ring), Darlok (purple hooded cloak), others per race.
- **The "Audience" request menu** (player-initiated: propose treaty, trade, declare war, offer tribute, request tech) appears *in the same caption area as a bulleted list*; not captured in these screenshots. Treat as bullet options inside the cyan panel.
- **To evoke today**: keep the "hologram on a dais" staging + big cyan caption panel with ornate end-caps; add portrait animation (blink, breathe), relationship mood tint, show the offer's numbers as chips, and keep mixed-case terse dialogue.

---
## 5. Galactic (High) Council scenes

URLs: Update 07 images 2-10, Update 18 image 17 (result). Scene family.
- **Setting**: a deep-space chamber: **starfield `#000011`** with blue-white twinkles and cross-shaped glints, two **curved copper-red arches `#942c24` / `#753024`** springing from a central pillar and sweeping down left and right (bevelled blocks), a **tiled reddish floor `#612420`** in perspective (dark `#381410` at the bottom). In the centre floor a **glowing blue disc pedestal** (dark `#040f26` helix/DNA-like translucent beam rising from it, cyan highlight rim) where the **currently speaking/ chosen leader's bust hologram** appears.
- **Leaders**: four wall-mounted **portrait monitors** (black rectangles with dark-green `#1a3a2a` thin frames, x 0.00-0.12 clipped, 0.17-0.37, 0.64-0.84, 0.88-1.0 clipped) showing leader busts (Human in yellow uniform, Darlok purple hood, Sakkra green reptile, Silicoid grey beast, Bulrathi blue vest, Mrrshan orange cat). Left/right monitors are clipped at the edges - suggests more leaders around the room.
- **Text**: top **vote line** in green `#40e060` small caps across the top (`no votes Zygot   14 votes total   3 votes Nazgur`; left candidate, centre total, right candidate) and bottom **caption** (yellow `#f0c820`, 2.4% height, left aligned over the floor) such as `The High Council has convened to elect one leader to be Emperor of the Galaxy...`, `Emperor X of the Psilons and Emperor Y of the Darloks have been nominated.`, `The Sakkras abstain (2 votes)...`, and the result line `In the year 2374, the Council has chosen Lasitus of the Humans to be the High Master of the New Republic`.
- **Player's choice**: when it is the player's turn, the caption becomes `Your choice (4 votes)...` and three bullet options appear in a column on the right of the caption: `• Yourself  • <Candidate>  • Abstain` (yellow, bullets filled).
- **Flow**: sequential reveal - one nation's vote at a time, each shown with its leader's bust *on the pedestal*, tallies updating. Hand cursor present.
- **Palette**: dominant brick/copper red + black star blue; yellow/green UI text for contrast. 
- **To evoke**: keep arches, pedestal hologram and running tallies; modernise with proper ceremonial staging (camera push), seat per empire with banner colour, vote weight as stacked tokens.

---
## 6. GNN (companion scene, for reference)
URL: Update 03 image 18. Gold chrome news-droid anchor in front of a starfield and a green planet; a small `STATUS` bar-chart monitor right of him; frame is lilac/steel `#7a7ab0` with a decorative filigree border, Greek-column pedestals at lower corners, a black text bar below the picture reading `Current rankings of empire production:` with race names in two columns (1-3 left, 4-6 right) in pale lavender/white caps. Not strictly in this group but shares the scene family's "black caption well below" layout.

---
## 7. Cross-screen implementation hints

| Item | Original | Do today |
|---|---|---|
| Frames | brown bevel for management, grey/orange for engineering, none for scenes | Three CSS panel themes with matching tokens (clay brown, steel+orange, cinematic) |
| Selected row | dark-red bar `#620b03` + white | Keep; add subtle glow |
| Disabled | dimmed grey text | Keep + tooltip with reason |
| Numbers | green = good/cost, red = stat | Keep; add delta chips |
| Cursor | tan pointing hand | Optional custom cursor |
| Race identity | banner colour on name buttons, portrait busts | Per-race colour tokens + animated portraits |
| Attitude | red->green gradient w/ triangle marker | Keep exact metaphor |

## 8. Gaps
- Races screen "Audience" request-menu and treaty-negotiation lists (propose treaty/declare war/ tribute) not found in the sampled shots; the Status button's alternative views (beyond Racial Stats) not seen.
- Component pickers for Computer/Shield/ECM/Armor/Engine/Maneuver were not directly seen (assumed same table as Weapons/Special pickers); Large/Huge hull editor not viewed.
- Per-race lab variants for races other than Psilon/Silicoid, other races' espionage/sabotage pop-ups, and "tech stolen" / "treaty broken" scenes not viewed.
- Exact pixel metrics are estimates from 4:3 scaled screenshots.
