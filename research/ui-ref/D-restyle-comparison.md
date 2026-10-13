# D. Restyle comparison: before (8bc7347) vs now (HEAD b0c94a4)

Method: both builds loaded at 1600x900 with `index.html?dev=1&screen=<id>&race=human&size=medium&opp=3&seed=shot&turns=25` (title with no params), screenshots viewed at 800x450 (half scale), so fine-print legibility was judged at roughly half size; verify small text at 1:1 before acting on it. Reference look: A-C (galaxy/control family = steel-grey frame, indigo/gold title plates, grey panels, dark inset slots; tool screens = brown/bronze bevel, gold titles, small steel buttons).

Summary: the new build is much closer to the original (bronze tool screens, bevelled steel control chrome, chunky buttons) but pays for it in contrast and density. The old build was cleaner and more legible but generic dark-glass.

## Per screen

### Galaxy (control screen)
Better: right panel is now a grey bevelled steel control column with a title plate, labelled inset readouts (POP / FACTORIES / PRODUCTION), slider rows with arrow buttons and a coloured fill, and a framed ship card. This is the original's layout echoed. Bottom nav is a full-width row of equal grey plates with NEXT TURN as the eighth plate: reads as the original's bottom row. Map frame has a bevel.
Worse: the old build's range ring (3 pc dashed) and scan ring labels were readable; in the new one the labels ("range"/"scan") are tiny and collide with nearby stars (a label sits on a red star below Sol). Slider rows are cramped: tag text ("SHIP", "DEF") and NONE/MAX read dim grey on grey. NEXT TURN lost its accent colour (old: bright blue call-to-action), so the primary action is now visually equal to the 7 nav plates. Top HUD strip (Year/Reserve/Income) became lower-contrast and smaller. Panel Production number (orange) is the only strong emphasis.

### Planets (tool screen)
Better: bronze/brown frame and gold title match the original tool-screen family; cyan-green footer headings (SPENDING COSTS, TOTAL INCOME, RESERVE) follow the reference; lime readout slots on the tax/security sliders look authentic.
Worse: table body is dark brown with dim values; the Max/Fact/Space dock columns are low contrast (grey-on-brown, nearly invisible "100" in the MAX column on the selected blue-grey row). Selected row uses a cold blue that clashes with the warm palette. Title "Planets" is dim bronze rather than gold-bright. The big empty table area is unchanged. OK and TRANSFER buttons lost their emphasis (OK was the blue primary before).

### Fleets (tool screen)
Better: ship thumbnails sit in black inset cells, as in the original fleet library; column headers in orange read well; consistent button plates.
Worse: black rectangles around ship art look pasted-on and make the grid heavy; bronze row text (station name orange, "in orbit" small) is small; the FLEETS/SPECS tab pair is low contrast; the title and subtitle are dim. The OK button reads disabled (greyed with "SPACE" hint barely visible); old OK was clearly the primary.

### Ship design (tool screen)
Better: section headings are orange tabs, the library entries have gold names with a clear selected frame (orange outline), part rows in dark slots, strong SHIP SIZE selector with gold selected size, BUILD/DONE/CLEAR as chunky plates. Uppercase part names echo the original.
Worse: densest regression. All-caps NONE values, tiny orange labels and the dim "wheel / Ctrl +10" hint make the component grid harder to scan; the big dark panel between components and weapons wastes space while text shrank. The library's red SCRAP buttons are fine, but the 3D hull view lost its clear title hierarchy ("BOMBER" smaller). Compare table (right) has grey-on-black small values: weak contrast. The warm selected item (orange) competes with the orange section tabs.

### Research / Tech (tool screen)
Better: field tabs, share sliders and the project panel keep their layout, the bronze frame and gold title read as the original's research screen.
Worse: BUG: the bottom-right "current research" panel is clipped at the bottom (the "Robotic controls" line is cut off and there is no scroll affordance), because the shrunk layout no longer fits. Increase of all-caps text in the left list (BATTLE COMPUTER MARK I) hurts scanning. Slider track and arrow buttons are heavy; the percentage chips are tiny. The "3 researched" counter is an almost-invisible blue.

### Races / diplomacy (tool screen)
Better: bronze cells, gold title and uppercase NO CONTACT / NOT PRESENT in orange are bold and legible at a glance; portrait has a proper frame. Button row at the bottom is evenly weighted.
Worse: slider and its lime readout have a lot of chrome for a 0.0% value; "Silicoid" name plate is now a white box that is the brightest thing on screen; hint text at the bottom left and the "spies" labels are very dim. OK lost its primary (blue) look and is orange-on-brown, fine but flatter than before.

### Galaxy Map overview (map + side key)
Better: framed map with corner brackets; collapsible-section buttons (COLONIES / ENVIRONMENTS / MINERALS) are now clear steel plates with a visible active state. Map Key is orange-headed and readable.
Worse: map and fuel ring are the same as before but the side panel became a heavy brown block with a large empty lower half; the section buttons render the active one as unlabelled-looking grey plates (COLONIES highlight is subtle). The old panel had the more informative "Year 2325 - 1 of 48 stars explored" larger; now it is tiny, centred and low contrast.

### System view (full-screen planet)
Better: title and environment tag are unchanged and clean; fleet cards have clearer plates; planet data got a cyan header and gold value numerals matching the original's readouts.
Worse: Planet Data panel shifted lower and its text shrank to ~6-7 px at 1600 wide with small caps labels in dim grey; "100", "200", "97" in gold are fine, but labels are hard to read. Fleet thumbnails caption (SCOUT / COLONY SHIP) is tiny.

### Title
Better: gold headline and gold text menu match the reference (gold bitmap items over a vortex), plus an added tagline paragraph. Cleaner than four boxed buttons.
Worse: menu text is small and only the first item is distinguished at rest; tagline paragraph is dim and crowds the title; footer legal line is almost invisible. The menu fades in late (nothing but the title for the first moments), so a screenshot at load shows no menu. The old boxed buttons gave clearer affordance and a highlighted default.

## Cross-cutting findings
1. Contrast: secondary text is dim grey or bronze on dark brown or grey across all tool screens. This is the single biggest regression.
2. Font sizes dropped, uppercasing increased; at half-scale much of it is unreadable (verify at 1:1).
3. Primary action (OK / NEXT TURN) lost its accent: old blue plate was a clear CTA; new ones are the same as other plates.
4. Warm palette is applied inconsistently: blue selected-row (Planets), blue active tabs and a white name plate (Races) clash with brown/orange.
5. Layout overflow: Research bottom panel clipped.
6. Fidelity to A-C: bevels, steel control column, bronze tool screens, cyan-green footers, lime readouts, gold titles are now correct.

## Ranked fix list
1. Raise contrast of secondary text and table values on all brown/steel panels (target roughly 4.5:1); stop using dim grey on brown.
2. Fix Research clipping (bottom-right panel: add scroll or reduce content/line-height).
3. Restore a distinct primary-action treatment for NEXT TURN and OK (gold or accent fill that still sits in the palette).
4. Increase minimum font size of labels, readouts and hints (Design components, System planet data, Galaxy panel sliders, Fleets captions).
5. Unify the selection colour (use warm gold/orange instead of blue/white) for rows, tabs and name plates.
6. Declutter Galaxy panel: reduce slider chrome, give labels more room; fix scan/range ring labels colliding with stars (restore their contrast).
7. Fleets: remove hard black rectangles behind ship art or give them a bevel so they sit in the grid.
8. Title: ensure menu is visible without waiting (or add a quick fade), give hover/default highlight and brighter legal text.
9. Map overview: raise subtitle size, make active section button obvious, trim empty lower panel.
10. Design screen: tighten empty area between components and weapons; shorten the hint line; increase compare-table contrast.
