# UI visual reference, group A: control screen, map, colony panel, menus (MOO 1, 1993)

Sources (viewed only; nothing downloaded or stored): lparchive.org "Master of Orion" LP by Thotimx, Updates 01, 02, 04, 06, 09, 11
(https://lparchive.org/Master-of-Orion/Update%2001/ etc.). Screenshots are the GOG/DOSBox 1.3 build, 896x672 captures of a 4:3 game image.
Colour values are eyeballed from the screenshots (approximate hex). Proportions are fractions of the 4:3 game frame (native 320x200 scaled to 4:3).
Note: the 4:3 frame is inset in a black window; the game itself paints its own bevelled outer frame.

## 0. Global look (applies to every screen below)

- **Two visual families**:
  1. *Control screen family* (map + right panel + bottom row): cool **gunmetal/steel-grey bevelled frame** (outer frame ~#9a9aa4 highlight, #5a5a64 shadow), black starfield, panels in **flat mid-grey (#8a8a8a / #7c7c80)** with dark inset slots, deep-**indigo/navy title plates** with **gold** text.
  2. *Full-screen "tool" screens* (Galaxy Map overlay, Planets, Design/Fleet library, Specs): warm **brown/bronze "leather-and-tan" bevel** (frame #8a7058 light edge, #4a382c shadow; cells ~#6e5846 with #5a4636 inset rims), gold titles, small steel-grey buttons.
- **Font**: chunky bitmap pixel font, ~7-8 px tall at 320x200, all-caps for labels (SHIP, DEF, IND, PRODUCTION), Title-Case-with-wide-caps for headings ("Galaxy Map", "Map Key", "Mentar"). Heading font is a bolder embossed display face in gold (#e8c84a with darker #8a6a20 edge). Readouts are small caps, slightly condensed, 1 px dark drop-shadow.
- **Bevels**: hard 1-2 px light top/left + dark bottom/right edges (no gradients on UI chrome); buttons are raised grey plates with dark text, pressed state inverts bevel. Inset "slots" (value readouts) are dark (#2a2a30) with 1 px light bottom edge.
- **Cursor**: a tan/flesh-coloured pointing **hand** (index finger, pointing up-left) everywhere; on the combat grid it becomes a red crossed-out circle when a target cell is invalid.
- **Palette summary**: black void #000, star-field white specks, indigo nebula dots #101850-#202878, steel #8a8a90, bronze #8a7058, gold text #e8c850, cyan-green label text #60d0b0 (Planets footers), lime-green readout text #70e060, orange-amber labels #d8902a, red alert text #d84030.
- **Sound/animation**: pointer hand only; stars do not twinkle on map; title screen has animated engines and particles drawn into vortex.

## 1. Main menu (title screen)

Source: Update 01 image 1.
- Full-bleed illustration, 4:3. Background: very dark **magenta/purple radial vortex** (#3a0c3a core to #12041a edge) with pink-white pinprick stars and a purple particle swirl in the centre.
- **Logo** top (~y 5-30% of height, x 20-80%): "MASTER OF ORION" - small italic "MASTER OF" above, giant 3-D **brushed-silver/chrome extruded ORION** (light #e0e0e8 face, #707078 extrusion, black outline), tm mark top-right.
- **Centrepiece** (y 45-60%): a symmetric grey starfighter seen nose-on / head-on, two glowing blue-lilac engine pods left and right (#4060c0 with pink bloom), mechanical mid-grey hull #909098.
- **Menu**: four text-only items, centred, stacked (y ~ 62-90%, ~8% spacing): Continue Game / Load Game / New Game / Quit To Dos. Gold-yellow (#e8b830) bitmap caps/lower-case with dark shadow; no boxes, hover = brighter yellow (inferred). 
- Footer (y ~ 96%): "PROGRAM VERSION 1.3 (c)1993 SIMTEX SOFTWARE", dim grey-purple (#5a4a6a), tiny.
- Evoke today: keep the vortex + chrome logo + four plain centred items; modernise with real particle shader, soft bloom, keyboard focus ring; keep the lone fighter silhouette as hero art.

## 2. New game setup screens

Source: Update 01 images 2-5.

### 2a. Options panel
- Backdrop: **barren grey moonscape** painting: black sky with tiny stars, big dark grey cratered moon upper-left (~15% from left, 5-25% top), a dim brown-red nebula/planet disc right (x 70-90%, y 40-65%), lunar ground bottom 30% (greys/beiges #a09888).
- Centre (x 24-77%, y 8-90% of the 4:3 frame): one tall **orange/copper embossed panel** (#c86a20 body, #f0a050 highlight, #703010 shadow) with a pillowy rounded-bevel look; split into 4 stacked rounded slabs.
  - 3 rows: label left in darker copper ("Galaxy Size", "Difficulty", "Opponents", ~12-14% height each, wide pixel display font, low contrast) + right-hand **black inset value box** with pale-green text (#b8e0a0): Huge / Impossible / Five (remembers last used).
  - Bottom slab: two dark-brown buttons "Cancel" and "Ok" (#702810 fill, copper rim, rivet dots at corners, gold-orange text #e8a040).
- Values: size Small/Medium/Large/Huge (24/48/70/108 stars), difficulty Simple/Easy/Average/Hard/Impossible, opponents One..Five. Click on a value box cycles it (assumed).
- Evoke: keep the three-row copper plate on a planetscape; modern: glassy bevel, proper dropdown/stepper, show star counts and a tooltip per difficulty.

### 2b. Choose Race / Banner / Name (shared backdrop)
- Backdrop (same for all three): **left 40%** a big blue-white **gas-giant limb** curving from top-centre to bottom-left (cloud streaks #2a50c0 -> #a0c0f0, white highlights); **right 60%** deep-space black with a **grey disc-shaped space station** top-right (x 60-95%, y 0-45%), a small spacecraft (x 50-60%, y 50-55%), a grey moon (x 55%, y 80%) and a **magenta-purple glowing sun/nebula** (x 60-85%, y 35-75%) with white-pink core; foreground grey warship hull bottom right.
- Text sits on the blue planet limb (no panel): heading "Choose Race" top-left, white (#fff) pixel font with dark outline, a vertical list of 10 names (Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, Darlok), ~5% height each; **hover/selected** = pale translucent blue-white highlight bar (#b8cdf0 at ~60%) behind the row.
- To the right of the list (x 50-63%, y 7-25%): a **white-framed (1-2 px) square portrait** (~16% of width) of the race leader (low-res pixel art), with the race's trait line beneath in small white caps, 3-line centred ("SUPERIOR RESEARCH TECHNIQUES").
- Banner step: heading "Choose Banner", list Blue/Green/Purple/Red/White/Yellow; second white-framed square below the portrait shows a **waving flag** (dark pole, tapering swallow-tail pennant in banner colour with a crest) - this colour also sets ship livery.
- Name step: heading "Your Name..." with a blue-grey text-entry bar (#6a82b8) holding default emperor name; portrait + flag both shown.
- Evoke: keep full-art backdrop with list laid straight on it, portrait + flag preview squares, one-line trait caption. Modernise: add stats chips (research, ground, spy, etc.), live preview of ship colour, keyboard nav.

## 3. Main galaxy "Control Screen" (the core screen)

Sources: Update 01 images 6, 12, 15-17; Update 02 images 5-12, 15-17; Update 04 image 11; Update 09 image 4.

### 3a. Layout grid (fractions of the 4:3 frame)
- **Outer frame**: ~2-3% thick silver-grey bevel on all sides (light #b8b8c0 / dark #50505a), drawn with a thin dark inner line. 
- **Map viewport**: x 2-68%, y 3-86% (a black rectangle; ~66% width x 83% height). Inset 1-2 px dark border; stars drawn directly onto black plus a **very dense field of tiny grey/white background dots** (#606068-#c0c0c8) - looks like a static star-field wallpaper. Overlay mode (when a "new system" event or colony-prompt is active) swaps the wallpaper to a **blue stippled nebula** (#101860/#2030a0 dither speckle on black) for the whole viewport.
- **Right panel**: x 69-97%, y 3-86% (~28% width). Content changes by context (see 3c-3h). Always topped by a **title plate** (indigo #302870 with 1 px lighter border, gold bold text, height ~7%).
- **Bottom button row**: y 88-97% (~9% height), spanning x 2-97%; **8 equal-width** plain buttons: Game · Design · Fleet · Map · Races · Planets · Tech · Next Turn (each ~11.5% wide, 1 px gap). Button face steel-blue-grey (#6a6a92 -> #8888b0 with darker bevel), text near-white bold caps/Title-Case (#e8e8f0) with dark shadow; **active/currently open** button is drawn highlighted (white text, slightly lighter face); "Next Turn" is last and slightly wider text but same size. During some modal panels the last two buttons are replaced (Fleet Deployment shows CANCEL / ACCEPT in the row's right 20% and hides Tech/Next Turn).

### 3b. Map content
- **Stars**: 4-point sparkle glyphs ~7-9 px on 320 wide (about 2.5% of width); a bright core pixel with 4 spikes and a soft dimmer halo. Class colours: **yellow/orange #f0b030**, **green #50d060 (bright #90ff90)**, **red #e04040**, **blue #6090f0 (light-blue #a0c0ff)**, **white #e8e8f0**, (purple neutron, rare #a060e0). Unexplored stars are shown with their spectral colour only; explored+owned ones gain a name label.
- **Name labels**: small yellow/gold caps (#e8c850) centred ~10 px below the star: "MENTAR", "TYR". Shown only for owned/selected/explored-with-colony stars (other empires' systems are labelled in their banner colour: Silicoid purple #b070e0, Alkari green #50c050 e.g. "KRONOS", "ALTAIR").
- **Selection reticle**: four **green corner brackets** (#40d060, ~12 px square, 2 px arms) around the selected star or fleet; a *different, dimmer green crosshair* "+" with gap (#30a050) marks an unreached target/range point.
- **Fleets in flight**: tiny **arrow-ships** (about 6x4 px) in the owner's banner colour (orange-yellow for Psilon, white/pale for Darlok, green for Alkari, purple for Silicoid); multi-ship stacks drawn as a short row of arrowheads. A route is a **thin 1-px green line** (#40c040) from origin to destination with a bracket at each end; moving ships tick along it. Enemy fleets within scanner range show ETA.
- **Fleet at a star** is drawn as an arrow just beside the star glyph.
- **Range**: no on-map circle; range is stated in the right panel text ("Range 3 Parsecs" / "Range 6 Parsecs").
- Scroll: none observed on Small/Medium (whole galaxy fits); the map is clipped to the viewport with a few stars cut at the edges. Larger galaxies compress spacing.
- Hit target of stars is generous (click anywhere near); cursor hand floats over map.

### 3c. Right panel - colony view (own planet), e.g. "Mentar"
Top to bottom (all within the panel's 69-97% x range; percentages of panel height ~80% of screen):
1. **Title plate** system name (gold on indigo) ~7% of screen height.
2. **Planet portrait box** (~12% h): wide landscape image with a **red-orange (#d04030) 1-px frame**; planet sphere left-centre (Terran = green-blue ringed ball with a ring-shaped orbit, Toxic = brown-orange, Radiated = grey-white cratered, Minimal = rust-red, Steppe = beige), starfield backdrop; right-aligned text stack: planet class (yellow, TERRAN), optional richness line (light-blue "RICH"/"HOSTILE" #8ab0f0), "POP 100 MAX" in **lime green** (#70e060).
3. **Stat row 1**: two 50/50 grey-plate readouts: "POP 47" and "BASES 0" (label left in white, number right in a dark inset slot, yellow numerals #f0e060).
4. **Production row**: full-width "PRODUCTION 60 (61)" - first number white/yellow = net after costs, second in green parentheses = gross.
5. **Five spending sliders**, each row ~5% h: left a short **label button** (Ship / Def / Ind / Eco / Tech, grey plate; locked category label turns **red/orange** #d85030), a **trough with left/right red triangle arrows** (#c04040) at its ends and a **filled bar** inside, then a right **readout slot** ("1 Y" or "NONE" / "2.2/9" (factory rate) / "CLEAN" / "0 RP"). Bar colours: **Ship = cyan-teal (#40b0c0)**, **Def = dark/none shown empty (#3a2a2a)**, **Ind = cyan-teal (#30a0b0)**, **Eco = cyan-teal (#30a0b0) (when locked turns red-orange bar #c05020)**, **Tech = empty/dark**. All fills share the cyan hue; the empty trough is near-black brown (#2a1a1a) with a thin light bevel; no per-category colours.
6. **Build box** (bottom-left of panel, ~14% h): a framed (2 px gold #c8a030) picture of the current ship type on a dark "construction gantry" strip - a latticed dock/crane backdrop (#503820 / #806040 truss) with the ship icon in the centre, a count number bottom-right in yellow ("5"), and a name plate beneath ("RECON", gold on dark brown #3a2810).
7. **Three stacked buttons** to its right: SHIPS / RELOC / TRANS (grey, bold caps).
- The planet class text colour hints type; the heading colour of the title plate is gold for own, can differ for foreign (e.g. Alkari fleet title in green on brown-red art).

### 3d. Right panel - fleet in flight, e.g. "Psilon Fleet  ETA 2 TURNS"
- Top banner (~12% h): a **red-brown ruined-landscape** painting with a **satellite-dish / observation emblem** (white dish on pole, mars-rust sky/ground #a03020) and the fleet owner text in the owner's colour ("Psilon Fleet" yellow #f0e060; "Alkari Fleet" green #60e060; "Silicoid Fleet" lilac), with white caps "ETA 2 TURNS" overlaid at bottom.
- Own fleet: below banner, a small **grey info box** with centred red text listing contents (e.g. "1 Colony Transport"); then a **wide black picture strip** (ship side-view, e.g. colony ship hull orange/blue) ~12% h; then a large **grey "Destination" box** (centred white heading "Destination", system name below).
- Foreign scanned fleet (Update 09): after the banner a **2x3 grid of grey cells**, each with a small ship portrait (black bg) top-left and a count in the corner, name plate below ("SCOUT", "KRAKEN" - dark brown plate with yellow text); remaining cells empty (flat grey). Extra bottom bar is empty plate. Only visible with scanner tech; also shows ETA.

### 3e. Right panel - newly scouted system ("Scout ships explore a new star system")
- Title plate (system name), planet portrait box (planet + class: e.g. "TOXIC" "HOSTILE" "POP 30 MAX"; red frame), then a big **art panel** (~45% of height) with an atmospheric painting of that environment (dusty orange toxic world, brown mountain sunrise, asteroid belt etc.) overlaid with **huge cream/peach pixel text** (#f0d8b0, drop shadow): "Scout ships explore a new star system", then sub-headings in white ("Hostile Environment") with small beige all-caps explanation ("POPULATION GROWTH IS HALVED."; "Mineral Rich: RESOURCE POINTS FROM INDUSTRY ARE DOUBLED."). Bottom: a wide steel **CONTINUE** button (~6% h). While this panel is open the map shows the blue nebula wallpaper, and only CONTINUE advances.
- Variants: "NO HABITABLE PLANETS" in the red-framed portrait slot (Ukko, asteroid-art), "Range 3 Parsecs" under "NO COLONIES" plate for a previously scouted empty system, "Darlok Colony / Range 6 Parsecs" with POP/BASES strip for a foreign colony (showing their dome-city picture).

### 3f. Right panel - colony prompt ("Build a new colony?")
- Same title + portrait plates; art panel with a brown cloud/terrain painting and cream text "Build a new colony?"; two buttons **NO | YES** (grey), full width at the bottom.
- After YES: a full-screen planet close-up (see 3g) and a rename prompt (Update 04 image 12: ship landing painting, a pale-blue-bordered white-on-blue text box "Colony Name..." with an input field, top caption "In the year 2340 the Psilons form a new colony" in a wide display font).

### 3g. Planet close-up (founding scene)
- Full-frame: starry black, giant lit planet filling lower-left (rust-brown #8a4020 stippled noise), a **bright green star flare** upper-right (#40d040 glow, white core), planet name (white, bold) + environment line ("minimal environment") centred at top, and a **dark panel with 2-px green frame bottom-right** (x 75-100%, y 70-97%) listing: PLANET SIZE, FACTORIES, WASTE, POPULATION, GROWTH - labels green (#50d060), values yellow. A tiny coloured-people icon bottom-left.

### 3h. Right panel - transport ("Transports")
- Triggered by TRANS; red (#d84030) heading "Transports", grey text "Choose number of troops to transport"; a POP label + **slider** (same trough/triangle style), "Moving 1 Million" readout, "ETA 3 TURNS", buttons CANCEL / ACCEPT. A thin **green dotted route line** from source to destination on the map; a small **white rocket-ship icon** appears in the corner of the map.

### 3i. Fleet Production Report (modal over the map, year-end)
- Centred 2x3 grid of **brown (#6e5846) slabs** (about x 25-53% / y 12-70% of screen) with a header "Year 2304" (gold on brown inset) and the title "Fleet Production" (pale lavender #b8b8e0); each produced ship = a black tile with ship icon and count + a blue name plate ("RECON" white on blue #2848a0). No buttons shown; click to dismiss.

## 4. Fleet deployment (send ships)

Source: Update 01 image 10 ("Fleet" button).
- Right panel header: red (#d03020) bold caps on grey plate: "FLEET DEPLOYMENT".
- Below: 2-column x 5 rows grid. Left cell = black tile with the ship icon + owned count (white/yellow digit bottom-right); right cell = **name plate** (dark text "SCOUT", "COLONY SHIP") over a **row of four tiny arrow buttons** [|<<] [<] [>] [>>|] (grey with black glyphs) to choose number to send. Unused cells are empty grey.
- Bottom: grey box with **green pixel text** "CHOOSE DESTINATION AND NUMBER TO SEND" (#40e060 on dark grey). Bottom row: the 8 nav buttons are truncated - Game/Design/Fleet(highlighted)/Map/Races/Planets only, with **CANCEL** and **ACCEPT** buttons taking the right ~25%.
- On the map: green corner brackets on the origin system's fleet and a dim crosshair follows the cursor to the destination; clicking a star sets the route line (green, 1 px). Ships are unbarred by range: invalid targets give no response (range limit = fuel range).
- Evoke: keep tile + stepper-arrows idiom; modernise with stack icons, drag-to-select count, preview ETA/fuel line while hovering.

## 5. Ship movement visuals

- Ships are small **arrows in banner colour** that jump between positions each turn (no tweening observed in screenshots); lines are drawn only for selected fleets. Own scouts parked at stars are arrows next to stars. Stacks show ">>" style multiples. 
- Scouted enemy fleets (with scanner) show a thick green route line with brackets at both ends and the ETA banner; without scanner you only see ships at range-limited positions.
- Combat triggers a **"Space Combat: X attack Y"** right-panel splash (Update 02 image 13): painted fleet strip (white/gold ship silhouettes) with large cream text and CONTINUE; map behind shows the star with brackets.
- Evoke: animate ship glyph sliding along a thin line, tail glow in banner colour; keep arrows small and legible.

## 6. Planets ledger (Planets button)

Sources: Update 01 image 11 (empty), Update 09 image 5 (filled).
- Full-screen brown tool frame (outer bevel, ~3% thick; cell face #6a5442).
- **Header strip** (y 6-12%): column title plates with dark-brown fill and pale-yellow text: "#" · "PLANET" · "POPULATION" · "FACT" · "SHD" · "BASE" · "WST" · "PROD" · "SPACE DOCK" · "NOTES". Widths: # 3%, PLANET 14%, POPULATION 17%, FACT 8%, SHD 6%, BASE 6%, WST 5%, PROD 8%, SPACE DOCK 17%, NOTES ~16%.
- **Table**: 12 rows visible (~5.8% each, y 12-75%), every cell a recessed dark-brown slot with 1 px rim. Values: index in gold; planet name yellow-gold (#e8c850); population left cell shows number in yellow with a blank bar cell beside (growth arrows); numeric cells yellow; PROD value **lime green** (#70e060). **Selected row** = solid blue (#3858b0) fill across all columns.
- Right edge: two arrow buttons (up/down, black glyph on grey) for scrolling.
- **Footer** (y 78-97%): three groups:
  - "Spending Costs" panel (plate title in **cyan-green display text** #50d0b0, orange labels): SHIPS %, SPYING %, BASES %, SECURITY % (percent values white, e.g. "23.5%").
  - "Total Income" panel (same style): TRADE ... BC, PLANETS ... BC.
  - Right: a slider (trough + red triangle arrows) with "+0 BC" slot above, RESERVE label (green) + "0 BC" slot, buttons **TRANSFER** and **OK** (grey).
- Evoke: dense bronze table with sortable columns, row highlight in blue, footer finance cluster; modernise with column sort, filter, inline sliders, mini-bars, colour for waste/production.

## 7. Fleet library / Design screen (what the "Design" button shows; closest to a "Fleets" list)

Sources: Update 02 images 2-4. (The *Fleet* button itself is the deployment panel of section 4; there is no separate fleet-list screen in these shots, ships in flight are inspected by clicking them on the map.)
- Brown tool frame; grid of **6 columns x 5 rows** of recessed brown cells (each ~13% x 15%). Header row labels in gold on dark: "STATION" · "SCOUT" · "FIGHTER" · "DESTROYER" · "BOMBER" · "COLONY SHIP" · "NO DESIGN" (design names are the column headers; first column = station/location of the ship). Occupied cells show a black tile with the ship image or a green pixel "UNKNOWN SYSTEM" tile (green #50e050 on black) for fleets whose location is unknown. Up/down scroll arrows at the right edge (grey arrow buttons).
- Bottom bar: left dark slot "SHIP MAINTENANCE COST  0 BC/YEAR" (label cream, value right) and three buttons **SPECS · SCRAP · OK** (steel grey, dark text).
- **Specs** sub-screen: five-row card list; each card: left portrait tile (black, ship picture, count number bottom-right yellow), centre block with **design name (gold)**, a small **SCRAP** grey button, and a 3x2 block of dark stat slots ("SHIELD 0", "BEAM DEF 3", "ATT LVL 0", "WARP 1", "MISL DEF 3", "HITS 3", "SPEED 1" - label amber, value red-brown), middle column weapon text ("1 LASER", "3 LASERS", "1 NUCLEAR MISSILE 2x"), right column **specials in green** ("RESERVE TANKS", "COLONY BASE", or "NO SPECIALS") over "COST 10 BC".

## 8. Galaxy Map overview modes (Map button)

Sources: Update 01 images 7-9; Update 02 image 1; Update 06 image 13.
- Full-screen brown tool frame. **Left ~75% x 90%**: map on the **blue nebula wallpaper** (#06083a base, #1830a0/#2848d0 speckle forming clouds, denser near the centre) with a faint **green corner-bracket rectangle** marking the current view / centre region. **Right column** (x 77-98%): gold embossed plate "Galaxy Map" (title font), then three **mode buttons stacked** - COLONIES (default), ENVIRONMENTS, MINERALS (grey plates with black caps; selected = darker/inset), then **"Map Key"** brown box with gold title and legend list, and OK at the bottom (steel button).
- **Colonies mode**: stars coloured by class (sparkles) as in the control map; owned/colonised stars show **small pennant flags** (~7x8 px, flagpole with swallow-tail pennant) in empire colours; scout fleets as arrows. Map Key = flag swatches + names: Psilon (yellow-orange #e0a020), Darlok (white-grey #b0b0b8), Sakkra (red #e04030), Human (blue-grey #5878a8), Silicoid (lilac #b080e0), Alkari (green #40a040) - only races in this game, left-aligned, ~7% row spacing.
- **Environments mode**: all stars become **uniform grey dots** (#a0a0a0, ~5 px, no spikes); owned/known stars get a tiny **coloured letter** (green = habitable class, red = unable to land on). Map Key lists two columns of planet types with letter+name, left column (green first letters): T Terran, J Jungle, O Ocean, A Arid, S Steppe, D Desert, M Minimal; right (red first letters): B Barren, T Tundra, D Dead, I Inferno, T Toxic, R Radiated, N None; footer line in red "UNABLE TO LAND ON".
- **Minerals mode**: same grey-dot map; Map Key lists coloured resource tiers: ULTRA POOR (red) 1/3 PROD, POOR (red-orange) 1/2 PROD, RICH (blue-grey) 2x PROD, ULTRA RICH (blue) 3x PROD, ARTIFACTS (green) 2x TECH, ORION (green) 4x TECH; footnote in small beige caps "PRODUCTION BONUSES APPLY TO INDUSTRY, SHIPS, AND DEFENSE".
- Evoke: keep three overlays + legend panel; modernise with toggleable layers, hover tooltips, fog-of-war shading, range ring, territory tinting.

## 9. Races / diplomacy / event scenes (adjacent; seen once)

- Update 11 image 1 shows the **message-from-ambassador scene**: purple-grey circular council hall backdrop, large 2-D painted alien (Alkari, bird-like yellow/teal robes) with the player's cloaked silhouette in the foreground, and a **cyan-teal text panel across the bottom third** (frame with ornate dark-red side caps and gold glyph ornaments, panel #70c0d0 with dark text). This style carries all talk scenes.

## 10. Gaps / not observed

- The Game menu (save/load/options) and the RELOC picker/panel, and the Races screen itself, were not captured in the screenshots seen.
- Exact pixel hex values are estimates from compressed JPG screen reads; confirm by sampling in-engine when re-skinning.
- No screenshot of a Large/Huge galaxy control screen with scrolling; assume map is zoom/pan-free and denser.
- Per-race banner artwork variants (6 banner colours listed, crest design not identifiable).

## 11. To evoke this today (summary)

1. Keep the **three-zone control screen**: ~66% map, ~28% contextual right panel, bottom row of 8 labelled buttons; only the right panel swaps content.
2. Keep **star-class colours as the primary scouting signal** (yellow/green/red/blue/white/purple), 4-point sparkle stars, gold name labels, green corner-bracket selection, banner-coloured arrows with 1-px green route lines.
3. Keep colony panel economy: 5 locked-able sliders with right readouts; modernise with segmented bars, numeric spinner, undo, per-slider semantic colours (tweak: Ship=teal, Def=amber, Ind=gold, Eco=green, Tech=violet) while leaving the original cyan single-hue look as an optional theme.
4. Contextual panels use **big painted art + cream display text** ("Scout ships explore a new star system") - reproduce with generated per-environment illustrations.
5. Split chrome: cold steel frame for live play, warm bronze frame for management screens; mod: soft bevel + subtle noise, crisp vector icons at 2x, keep pixel-font flavour.
6. Menus: plain centred gold text on dramatic art; setup: orange plate with three value boxes; selection list laid directly on the artwork with white-framed portrait + flag.
