# UI visual reference, group C: combat, news, scene screens, cross-cutting style

Sources: lparchive.org "Master of Orion" LP by Thotimx (https://lparchive.org/Master-of-Orion/, Update NN pages, GOG/DOS version, shown as 896x672 = 4:3 aspect-corrected from native 320x200 with non-square pixels; a pixel is ~1.2x taller than wide). Screenshots viewed in the browser only; nothing saved. MobyGames was Cloudflare-blocked.
Coverage is partial; see "Gaps / not observed" at the end. Items marked (obs) were seen; (inf) are inferred or from the existing notes (research/00-original-screens-notes.md), not seen by me.

Proportions below are fractions of the full 4:3 frame (W = width, H = height).

---------------------------------------------------------------------------
## 0. Cross-cutting style (from every screenshot seen)

### Global palette (approximate)
| Role | Hex | Notes |
|---|---|---|
| Main-screen window frame, outer | #8C8C94 light grey, bevel hi #C8C8D0, lo #404048 | Galaxy screen has a 2-3% thick silver-grey bevelled frame (light top/left, dark bottom/right). |
| Brown "parchment/leather" panels (lists, Galaxy Map overlay, Planets, Racial Stats, Ship rosters, Races) | base #8A7358 to #9C8466; frame #6B5A44; inset dark wells #5C4C38 | Warm taupe-brown, flat with 1px light/dark bevel. This is the dominant "full-screen modal" colour. |
| Tech-report columns | text colours: dim tan #B09870 (known), white #FFFFFF (newest/selected) | |
| Space background | near-black #000008 with blue dither speckle #1018A0 / #20209C | Galaxy map "nebula" is blue noise dither at about 25% density on black. |
| Accent gold headings (panel titles, "Galaxy Map", star name header) | #E8C860 on dark navy #202048 | Gold slab title with dark-brown outline. |
| Mint green section headings ("Spending Costs", "Total Income", "Planetology Technology") | #50E890 / #60F0A0 | Pixel serif/slab, on brown or dark grey. |
| Orange section headings ("Fleet Strength", "Population", "Production" in Racial Stats) | #F0A030 | Same slab font, centred on a horizontal rule. |
| Red scene captions ("Choose the area of research...", year readout) | #E83030 | Top-of-screen caption over scene art, no panel behind. |
| Pale cyan body text on dark (GNN dialogue, High Council text box) | #90B8E8 to #A8C8F8 | GNN black text well uses light periwinkle text. |
| White-yellow caption text over scene art (tech breakthrough effect line) | #F8E080 with dark outline | Bottom of research scene, 2 lines, justified. |
| Numbers in lists | green #50E050 (production), orange #E89040 (labels), red #E04040 (negatives) | |
| Race/flag colours | Klackon orange-red #E05030, Sakkra off-white/grey #C8C8C8, Bulrathi amber #E8A020, Silicoid green #50B040, Mrrshan blue #4080E0, Psilon violet #A878E0; Darlok grey/white, Alkari green, Human blue-yellow (inferred from graphs) | Flags on the Galaxy Map overlay are small pennants in these colours; Racial Stats bars use yellow (Psilon, player), white/grey (Darlok), purple (Silicoid), green (Alkari). |

### Fonts
- All UI text is a **bitmap pixel font**; two families seen:
  1. **Chunky display slab/"techno" font** for titles/captions/buttons ("Galaxy Size", "Difficulty", "Cancel/Ok", "Galaxy Map", "Map Key", "Fleet Strength"): wide serifs, small-caps-like, mixed-case (initial cap bigger than the rest), ~9-12 px tall in native, stroke 2px, with 1px darker drop shadow. Feels like Eurostile-ish blocky pixel type with flared terminals.
  2. **Narrow readable sans pixel font** for lists/stat rows/GNN text: ~6-8 native px tall; ALL CAPS for tables (ship names, tech names, "BEAM DEF / ATT LVL / HITS / SPEED"), mixed case for sentences (GNN, council dialogue, event descriptions).
- Text colours are always high contrast on its panel, never grey-on-grey. No anti-aliasing (hard pixels). Text is *outlined* (1px dark) whenever placed over art.
- **Today**: pick one geometric slab display face for headers (e.g. a squared sci-fi display) plus one clean condensed sans for data; keep ALL CAPS in tables, sentence case in narrative. Optionally render titles with a hard 1px offset shadow.

### Frames, bevels, dithering
- **Two frame languages**: (1) *Light grey/silver bevel* for the live map screen and ship-deployment (thick: ~2.5% of W, 1px hi at top-left, 1px dark bottom-right, flat grey fill, inner 1px black line around the viewport). (2) *Warm brown bevel* for every list/stat overlay (Galaxy Map, Planets, Racial Stats, Ship roster): ~3% border, inner panels are recessed with a dark line + light line, section headers overlay the top edge of each recessed box and break its border (header text sits in a gap in the line).
- **Scene screens (GNN, research, council, diplomacy)**: full-bleed pixel illustration with a distinct frame each: GNN = lavender-grey ornate metal console, research = no frame, scene extends full-frame, council/diplomacy = teal-cyan text box with a red/brown "Greek key" bracket column at left and right.
- **Dithering**: used heavily for the space background (blue noise), for translucent "hologram" figures (diplomat avatars have an ordered-dither fade at their lower body), and for gradients in the planet art (planet terminator/shading is 2x2 ordered dither with 4-6 colours). The title/menu buttons are shaded with smooth ~16-step vertical gradients (orange bevelled slabs), so the game mixes smooth 256-colour gradients with dithering. Palette is 256-colour VGA, saturated, no gamma softness.
- **Buttons**: grey bevelled rectangles with centred slab label, 3px thick bevel, pressed = inverted bevel (inf). Bottom nav buttons on the galaxy screen are dark-navy tiles (#202858) with white-ish slab text, 1px light edge. Orange slab buttons (new game dialog) are rounded-chamfer "pillows" with a vertical gradient (#F09030 top to #A04810 bottom), label dark-brown embossed. Cancel/Ok on the dialog are dark-red tiles with rivets in the corners and gold text.
- **Cursor**: a **gloved/pointing hand** (cream/peach #E8C8A0 with brown outline), ~7% of H tall, hot-spot at the fingertip; it is the same in every screen including scenes and combat. No hourglass was observed.
- **Scale cue**: native 320x200 means chrome is chunky; nothing thinner than 1 native px (about 0.3% of W).

---------------------------------------------------------------------------
## 1. Tactical combat screen (obs, minimal sample)

Source: https://lparchive.org/Master-of-Orion/Update%2049/10-0re69sa.png (early-game scout skirmish; very empty, so grid/planet/large stacks NOT observed on-screen).

**Purpose**: turn-based ship combat; one ship acts at a time.

**Composition (fractions of frame)**
- The battlefield fills the whole frame except a bottom command bar: arena = ~95% H x 100% W; no side panels at all. It is a full-screen starfield.
- **Command bar** at the very bottom edge: height about 3.5-4% of H (full frame width). Left ~30% of the bar is a **blue-steel name plate** (#3860A0, lighter top highlight #6890D0) holding the current ship's class name in tiny pale caps ("RECON"). Right 70% holds **8 equal small buttons** in a row (each about 6.5% W): AUTO, PLANET, SCAN, MISSILES, SPECIAL, RETREAT, WAIT, DONE.
  - Button states: AUTO is a **red/maroon** (#C02818, white text); PLANET/SCAN/MISSILES/SPECIAL are **dark grey disabled** (#505058, text #808088) when not applicable (no planet, no missiles etc.); RETREAT, WAIT, DONE are **bright lime green** (#58D030, dark green text) = available primary actions. So: *colour = availability*, red = auto-resolve (danger/commit), green = active, grey = unavailable.
  - Button text is the narrow caps pixel font, 5-6 native px tall; buttons have 1px beveled edges, no gap > 1px between them.
- **Starfield**: pure black #000000 with ~200 scattered 1px stars in pale blue-lavender (#6070C0, #8890D8), a few brighter white; sparse, even distribution; no nebula in this sample.
- **Ship sprites**: tiny (~4-5% of W wide). Player ship (left edge) is a small white/orange fighter with a **selection box**: thin 1px brick-red (#C04030) rectangle, about 10% W x 12% H, drawn around the active ship. Enemy (right edge) is a larger yellow-green (#B8C840) hull with orange engine tips and a short vertical yellow tick (shot/ready marker) beside it. Each sprite has a small 1px vertical yellow bar to its right = ship-facing / health or "ready" indicator (inf).
- **Move cursor**: a **red circle-with-slash "no" symbol** (#D03030, ~4% W) is drawn on the grid where the mouse hovers on an illegal/out-of-range tile; legal tiles presumably show the hand cursor/path (inf). Grid itself is **not drawn** (invisible tile grid, ships snap); cells are about 1/18 W wide per existing notes (inf).
- **Planet**: not in this sample; in other combats a large planet sprite sits mid-right with defence-base icons (inf from notes: "PLANET" button).
- **Info on screen**: only the active ship's name plate. Everything else (shots, damage, beams, missile trails) is animated; stats appear on demand via SCAN (inf).

**Interaction cues**: click own ship to select (red box); click tile to move; red prohibited cursor for blocked; click enemy to fire; bottom buttons for modes. No tooltips.

**To evoke today**
- Keep: full-bleed battlefield, tiny command bar with ship name left and 8 verbs right, colour-coded availability (green go / grey unavailable / red auto), brick-red selection box, "prohibited" cursor.
- Modernise: show a faint hex/square grid on hover only, move-range overlay, health bars on stacks, stack-count badge, zoom/pan, beam/missile particle FX and explosion sprites, side readout for ship stats (shield/armor/speed) instead of hiding behind SCAN.

---------------------------------------------------------------------------
## 2. Pre-battle panel (NOT observed)

I did not find a pre-battle screenshot. Existing notes (inf): a panel offering Attack / Retreat / Auto before entering the grid. Use the brown parchment style (section 0) for it or overlay the combat starfield with the same slab buttons. **Needs follow-up** with a video frame or another LP.

---------------------------------------------------------------------------
## 3. Ground combat / landing / bombardment

### 3a. Orbital bombardment prompt and result (obs)
Sources: Update 11 image 13 ("Bomb the Enemy Planet?"), Update 11 image 14, Update 31 images 8 and 10, Update 32 image 11.

These are **side-panel event cards on the main galaxy screen**; they do not leave the map.
- **Galaxy screen layout** (all event cards share it): map viewport on left = ~71% W x 87% H (black with blue dither; star glyphs in 6 colours: yellow, white, red, green, blue, magenta; small triangular arrow pennants for fleets in owner colours), right panel = ~27% W, bottom row = 8 nav buttons spanning the full width, ~8% H, each ~12% W: Game · Design · Fleet · Map · Races · Planets · Tech · Next Turn.
- **Right panel stack** top to bottom: (1) **star name slab** (gold on navy, ~6% H); (2) **planet card** (~12% H): a 3D-ish planet sprite at left (~35% of panel), right side text: planet type (TERRAN / BARREN / DESERT in white), environment flags (HOSTILE in cyan-blue, GAIA in blue), "POP nn MAX" in green; red-brown outlined box (#C04830) around it; (3) **event card** (~50% H): a **desaturated brown-orange landscape painting** (rust canyon/horizon with a small white dome/building; dithered sky #6A5A58) with text overlay; (4) **button row** (~5% H): grey CONTINUE (or CANCEL + BOMB two buttons side by side).
- **Prompt card** "Bomb the Enemy Planet?": headline in cream-white slab (#E8E0C8), 2 lines, centred at the top of the card; sub-line in lime green "Alkari Colony" (#60E040), the victim empire; at the bottom two stat rows in small caps: "Population: 92", "Factories: 178" (white label, right-aligned number). Buttons: CANCEL (left) and BOMB (right).
- **Result card** "Orbital Bombardment": same layout, sub-line "Alkari Colony" (green) or "Your Colony" (red #E83030), bottom text in white slab lines "2 MILLION KILLED" / "9 FACTORIES DESTROYED" or "colony destroyed" (large, centred, lower third of the card). Single CONTINUE button.
- The owner colour of the sub-line (green = enemy, red = yours) is a quick semantic code.
- **Art**: one generic landscape for all bombardments (no animation seen); destroyed vs. not is by text only.

### 3b. Colony landing scene (obs)
Source: Update 47 image 6.
- Full-screen painted scene (dark storm clouds #2A2A30 to #4A3830, rust-red martian rocks at right #B05830, grey metal landing pod at left-middle with rows of red lights, tiny astronaut with a flag/rifle at bottom-left).
- **Caption** at top centre, large pixel slab, off-white with dark outline: "In the year 2305 the Silicoids form a new colony" (event headline, no panel).
- **Name dialog**: small Windows-3-like popup centred (about 26% W x 12% H): white/pale-blue (#D8E0F0) bevel, title "Colony Name..." and a single text field with the default name in black on white, caret blinking; no OK button visible (Enter confirms).
- To evoke: parallax-painted alien horizon, cinematic caption, small system-styled dialog. Modernise: animate pod descent and dust, procedural name suggestions.

### 3c. Ground combat / invasion screens (NOT observed)
No screenshot of troop-vs-troop combat found. Only text: in the LP "bombardment and troop combat" resolves as stat lines (inf). Ground-combat armor/weapon tech appears in research scenes (see 7). **Gap.**

### 3d. Ship roster / design list screen used before battle (obs, adjacent)
Source: Update 11 image 9, Update 71 image 11.
- Brown parchment panel, 4 rows x 3 columns grid plus a narrow left icon column: col 1 ship icon box (black, with count in tiny yellow digit); col 2 ship name in a dark inset (yellow caps), then **SHIELD n** top-right, three mini-stat rows "BEAM DEF / ATT LVL / DAM", "MISL DEF / HITS / SPEED" with numeric inset boxes in orange/blue; col 3 weapons list (white/pale caps, e.g. "11 GATLING LASER"), col 4 specials list in **mint green** caps (ADV DMG CONTROL, BATTLE SCANNER). Rows separated by 1px dark lines; empty rows remain as blank brown wells (always 6 rows).

---------------------------------------------------------------------------
## 4. GNN news broadcast screens (obs)

Sources: Update 03 image 18 (production rankings), Update 11 images 11, 15, 17 (Pirates / Comet).

**Composition**
- Whole frame (4:3) is an **ornate console frame**: lavender-grey (#8890B8 body, #A8B0D8 highlights, #505880 shadows) metal with a fine repeating **Greek-key/meander dotted border** around the picture window (about 2% W border), stone-like **doric pillars** at lower left and right (each ~9% W) on either side of the text box, a slim control strip under the window with 3 round buttons each side and a central slot/tray, and a tiny red LED/plug at the bottom-right.
- **Picture window**: top 62% H, 90% W; shows a **space station studio**: deep navy starfield (#101038) with stars; left and right blue wall panels with vents (light blue #7090B8, sliding doors with red logo fragments) ; centre a **gold humanoid robot anchor** (head ~20% W; metallic yellow #E8C040 with orange shading, two red eyes in a cluster of 4, rounded body, holding a paper keyboard/pad, torso crops at the bottom edge). At left a small green planet with swirly continents (#488040); at right a **framed icon monitor** (~12% W x 18% H, dark panel, teal frame #308060) that shows a story icon: rainbow bar chart labelled STATUS (rankings), white skull-and-crossbones labelled PIRATES, comet labelled COMET. In the comet story the left planet becomes a "GNN" logo globe.
- **Text box** (bottom 30% H, between pillars, black #000000 well with 1px light inner bevel): text in the sentence-case readable font, colour pale periwinkle (#98B8F0), left aligned, 2-4 lines, with generous 1.3 line spacing. For rankings: a header line "Current rankings of empire production:" then a **2-column, 3-row list** "1. Darlok / 2. Sakkra / 3. Psilon" (left) and "4. Silicoid / 5. Human / 6. Alkari" (right) in the same colour. The pointer hand can sit within the box.

**Content types seen**: production ranking, pirate activity started/eliminated, comet will hit colony (with a death-timer in years), fleet ranking, scores. Every story uses the same studio; only the icon, planet and text change.
**Interaction**: click anywhere to dismiss; no buttons.

**To evoke today**: keep the retro-robot anchor as brand mascot (animated blinking eyes/subtitle ticker), the "story icon" monitor, the stone columns flanking subtitles; modernise with scrolling ticker, more story icons (war, plague, council) and small data cards (rankings with race flags).

---------------------------------------------------------------------------
## 5. Planet exploration / colony prompt cards (obs)

Source: Update 02 image 19 ("Scout ships explore a new star system"); also Update 33/36 style (inf).
- Same main-galaxy layout as 3a. The right panel header shows the system name (e.g. "Kronos"), planet card (barren planet sprite with Saturn-like ring; "BARREN / HOSTILE / POP 50 MAX").
- **Event card**: headline "Scout ships explore a new star system" in cream slab (3 lines), under it the environment effect in a **bigger white slab** ("Hostile Environment") and a small-caps caption in orange-tan ("POPULATION GROWTH IS HALVED"). Background is a dark brown desert / canyon painting that depends on the planet type; the lower ~25% shows a ridge of rust-brown rock. CONTINUE button below.
- Similar cards (inf from notes): "Mineral Rich: resource points doubled", "Colonize this planet?" with colony-ship icon and YES/NO.
- To evoke: environment word in large type, one-line rule consequence in small caps, planet-typed backdrop. Modernise: parallax planet render, icon chips for each environment flag.

---------------------------------------------------------------------------
## 6. Random-event screens (partly obs)

- **GNN-delivered events** (pirates, comet) as in section 4, with an icon on the monitor.
- **Event cards on the galaxy panel** (planet plague, nova, etc.; inf): same card shell as 3a/5: painting + 2-4 line text + CONTINUE.
- **Notices at factory/pop limit** ("planet has reached its limit...") appear as a small modal over the map with Yes/No on spending (text only, Update 03 image 14, not described visually).
- Existing LP note: a "Random event" mention in Update 13 image 5 is an event card of the same shell.

---------------------------------------------------------------------------
## 7. Scene-style screens with a character (obs, adjacent to group C)

### 7a. Research scene (choose next tech and breakthrough)
Sources: Update 25 images 11 and 14, Update 26 image 2, Update 31 images 7 and 12, Update 07 image 13, Update 70 image 9.
- **Full-bleed lab interior** (no frame): background is a dark engineering bay (navy #181838 with orange/pink status-light panels at left, grey bulkhead at right, a launch tower in a blue window at far right, a grey desk/table across the bottom 20%). Foreground at left ~32% W: your **race's scientist** full figure (Klackon: lime-green insectoid with teal compound eyes, grey-blue uniform patch; Psilon: pale-gold alien with purple forehead jewel, white lab coat; Human: dark-haired man in navy officer uniform with gold epaulettes and a medal). The race changes the portrait entirely, and the portrait is repainted per race; they gesture with hands toward a monitor.
- Centre/right: a **blueprint monitor** (dark navy screen with white-blue grid lines; a schematic of the tech drawn in white line art) on an easel with a keyboard; at breakthrough it shows the technology's drawing (e.g. building isometric for Construction, cylinder missile for Weapons).
- **Choose-next-tech panel** (right ~47% W x 70% H, grey #6A6A70 bevelled box with 2px dark frame and corner scroll rails): a **green title bar** ("Planetology Technology", lime #60E060 on dark #284028), below a **list** in black-ish wells (#181818, white text), one **selected row** in dark red (#701808) with white text; scroll rail on the right (checker pattern); under it the **description paragraph** in light-grey (#C8C8C8) caps/lowercase and the RP cost in green "(36000 RP)". Top caption in red: "Choose the area of research our scientists now focus on".
- **Breakthrough caption**: red top line "<Race> Scientists Achieve A <Field> Breakthrough"; below it the tech name in mint (#50E8B0) uppercase; bottom: effect sentence in yellow-cream slab, full-width justified, 2 lines, on a darkened strip.
- To evoke: character + monitor schematic, strong colour-coded text zones. Modernise: voiced/animated portrait, tech tree preview, ETA.

### 7b. High Council chamber (obs)
Sources: Update 10 image 17, Update 11 image 18, Update 40 image 15.
- Full-frame **starfield chamber**: black with white stars; a huge **bronze/copper arch ring** (#B06030 with dark shading) framing the top; floor of dark-red/brown tiles with perspective (#5A2818); central **glowing pedestal** (blue hologram ring #2858B8) with the **speaker's hooded figure** (purple robe #8030A0 with gold clasp, green emblem), portrait **alcoves** at left/right (each ~18% W x 30% H, black box with teal/green frame, holding race portraits: human captain, Klackon, Bulrathi bear-like, Sakkra, etc., the outermost one cropped by frame edge for a "carousel" feel).
- **Text bands**: top line three-column vote tally in lime-green slab (#A0E050) ("3 votes Zygot . 18 votes total . no votes Grand"); bottom line in amber-gold slab (#D0A040) for dialogue ("3 votes for Zygot, Emperor of the Psilons").
- Interaction: click through; choices appear as text (inf).

### 7c. Diplomacy audience scene (obs)
Sources: Update 09 image 17, Update 11 images 10/12, Update 12 image 17, Update 31 image 13.
- Full-frame **circular conference deck**: dark navy dome interior (#181838), a glowing **yellow-green ring** (#D0E050) around a central lit disc with red segmented panels (#A02828) and a view of stars in the middle (top 20% of frame); a **hologram of the other leader** (larger, centre-right, ~45% W x 80% H, e.g. Alkari: yellow-feathered bird person in teal collar with a pink sash; Psilon: pale-blond alien with cyan eyes) shown with an **ordered-dither fade** at the lower body; the player's avatar is a **hooded figure seen from behind** at left (olive/brown robe, or red robe for another empire).
- **Dialogue box** bottom 30%: turquoise slab panel (#58B8C0 base, #88D8E0 highlight, #207880 shadow) 100% width between two **vertical ornate brackets** (red #A02820 / brown #603018 key-pattern columns at each side, ~7% W, with orange tabs and black dots). Text in dark-red (#702010) or dark teal, sentence case, 2-4 lines; **options** below as small black bullets: "Accept / Reject". Faint ghosted silhouette of a spaceship (darker teal) sits behind the text as watermark.

---------------------------------------------------------------------------
## 8. Other overlays seen (to complete the family look)

- **Galaxy Map overlay** (Update 24 image 3, Update 32 image 9): brown frame, left map viewport ~65% W x 90% H (black + dither + two purple nebula blobs #8830A0 + coloured flag glyphs for each colony), right: gold title slab "Galaxy Map", three grey buttons COLONIES / ENVIRONMENTS / MINERALS (stacked), a "Map Key" brown panel listing empire flags + names, OK button bottom-right. Selection reticle = 4 green corner brackets.
- **Planets list** (Update 08 image 6): brown panel with column headers (# PLANET POPULATION ... SPACE DOCK NOTES), selected row highlighted solid blue (#2848C0), numbers green; footer "Spending Costs" and "Total Income" boxes, reserve line, TRANSFER / OK, small up/down scroll arrows. Header cells are slab dark insets with orange labels.
- **Racial Stats** (Update 08 image 4): brown 2x3 grid of recessed panels, headings in orange slab ("Fleet Strength", "Population", "Technology", "Planets", "Production", "Total Power"), horizontal bars in race colours (yellow, white, purple, green), top red year readout "Year: 2387" in a dark navy strip with gold title "Racial Stats".
- **Tech report (Races > Report)** (Update 11 image 16): six themed boxes (Computers, Construction, Force Fields, Planetology, Propulsion, Weapons) with mint-green headers; left narrow column with race portrait, race name button (violet #7040C8), personality ("Aggressive Expansionist"), report age ("REPORT 15 / 5 years old"), Alliances and Wars lists in red-underlined headings.
- **Fleet Deployment** (Update 71 image 12): right panel "FLEET DEPLOYMENT" in red slab on dark; five ship rows each with icon (left), name in white caps, and a row of 4 arrow buttons (<< < > >>), instruction in green on dark ("Choose destination and number to send"), CANCEL / ACCEPT bottom; the map behind is zoomed (star names in yellow/white/red by owner, travel lines in blue (own) and red (enemy)).
- **New game dialog** (Update 01 image 2): orange gradient pillow panels stacked vertically at centre over a **moon-surface vista** (grey cratered ground at bottom 20%, black sky, a grey moon top-left, a rust-red distant planet right); label slab left, value in a dark inset right ("Huge", "Impossible", "Five"); Cancel/Ok at the bottom in rivetted dark red tiles.

---------------------------------------------------------------------------
## 9. Game-over / ending cinematics, intro/title art

- **Observed only indirectly.** The LP embeds *videos* for the ending (Update 14: "ending cinematic for the standard/election victory") and the opening/Guardian cutscenes (Update 04, 31 videos on YouTube); I could not view these frames. Update 01 image 1 (title) failed to render in the browser.
- From the existing notes (inf): title = big metallic logo over a vortex/nebula backdrop, engines animated; menu Continue/Load/New/Quit. The **new-game dialog on the moon-surface vista** (section 8) is the visible part of the intro (painted lunar horizon with a planet and a dark moon).
- Ending/Game-over screens: unobserved. Suggested treatment (inf, not from source): reuse the council chamber or a victory fanfare card with the winner's banner, a short ceremony caption in the bottom text strip, then a credits scroll; defeat = the GNN studio with the robot reading the obituary.

---------------------------------------------------------------------------
## 10. "To evoke this today" summary

Keep: bitmap-flavoured slab headers; warm brown panels vs. cool grey map frame; gold/mint/orange header colour coding; green-red-grey semantic button colours in combat; hand cursor; ornate GNN console; scene screens with character + monitor; ordered-dither holograms; hard 1px outlines on text over art.
Modernise: render pixel look at 2x-3x integer scale with crisp edges (image-rendering: pixelated) or vectorise the bevels with CSS gradients; animate scene characters (blink/talk); add easing to panel transitions; keep palettes saturated (VGA-like) but avoid pure #000 backgrounds (use #04040C); provide scalable UI for 16:9 by pillarboxing the 4:3 scene art with starfield rather than stretching.

---------------------------------------------------------------------------
## Gaps / not observed
- Tactical combat with planet, large stacks, beam/missile/explosion FX, the grid appearance, and the pre-battle panel (only a sparse early-game frame seen).
- Ground combat resolution scene, defence-base planetary shots.
- Game-over/ending cinematic frames, title logo art (images failed to load or are video).
- Race selection/banner screens (belong to other groups).
