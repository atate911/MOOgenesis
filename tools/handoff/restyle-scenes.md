# Restyle "original look": scenes agent

## Done
- **Brown leather family** (tech.js `orig-brown`, applied to Tech, Races, Report, Tech tree): leather-grain body (SVG feTurbulence, resolution independent), bevelled rim, amber/orange slab headings, dark-brown list wells, dark-red selection bars, green numbers. Colours are local token remaps (`--bev-*`, `--face-*`, `--plate-*`, `--title`, `--bg-*`, `--ink-*`) so the chrome kit (panels, buttons, sliders) follows. Selectors are lifted one `:root` for load-order independence.
- **Grey metal family** (design.js `design-orig`): steel bezel, black inset panes, orange title plate and section tabs, teal labels, orange-yellow component names, dark-red selection, orange spinners, green pop-up headers.
- **Combat** (combat.js `combat-orig`): steel command bar, blue-steel ship name plate, buttons coloured by availability (red Auto, blue-steel mode buttons, green Retreat/Wait/Done, grey disabled).
- **GNN** (gnn.js `gnn-orig`): lavender-grey console tones, dotted rim, black text well, periwinkle copy.
- **Council** (council.js `council-orig` + scenes.js `COUNCIL_TINT`): chamber and booths re-tinted (hue-rotate on the cached layers) into bronze/copper with teal trim; lime tally, amber dialogue band, bronze/teal cards.
- **Audience** (audience.js `audience-orig` + scenes.js `audienceDim`): teal text well with red-brown meander brackets, steel header plates, hall multiplied down into a navy dome with a lit pool on the leader (`Scenes.config.audienceDim = false` disables).
- **Landing** (landing.js `landing-orig`): outlined off-white slab captions, steel bevel info bars, pale-bevel dialog.
- **Tech scenes** (tech.js `techscene-orig`): red caption, grey bevelled choice box with green title bar, black list wells, dark-red selected row, mint tech name, yellow-cream effect line.
- **Portraits** (portraits.js `litLayer`): every painted layer is lit at cache-build time (silhouette to height field, normals, warm key light upper-left, cool rim right, faint specular). Free at runtime. `?lit=0` or `Portraits.light.on = false` turns it off.

## Not done
- ships.js untouched (already light-bucketed and metallic).
- Audience halls are still the original sunlit art, only darkened and spot-lit; a true dome with a yellow-green ring and red panels was not painted.
- Combat canvas selection box is still gold (lives in combat-fx.js, not in this scene's files); original is brick red.
- test-scenes.html lacks pick.js (G.pick error), unrelated.

Tests: check.js clean, rules-test 781 passed. Verified headless at 1280x720 and 1920x1080 (tech, races, report, techtree, design, combat, gnn, council, audience, landing, tech scene).
