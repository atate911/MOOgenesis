# Restyle: control (original-game look)

Done (per-screen CSS only, each as an extra `UI.css('<id>-orig', bump(...))` block after the screen's existing CSS; `bump` prefixes `:root:root` to beat the theme-v2 `.panel`/`.btn` rules):
- galaxy.js: gunmetal bevel frame, inset map viewport, steel side panel, indigo/gold title plate (`.side-title`), equal-width steel nav row.
- side-colony.js / side-misc.js: red-framed portrait, inset amber/lime readout slots, label plates, red-triangle slider arrows, inset troughs, gantry build box, stacked steel buttons, black ship tiles with name plates, green hint text.
- ledger-planets.js, ledger-fleets.js, overview.js: leather/bronze family (matches tech.js `orig-brown` palette), recessed cells, blue selected row, lime production.
- system.js: embossed name, bevelled plates, recessed readouts. menu.js: plain gold text items. setup.js: bevelled option cards with copper selection.

Not done: planets/fleets ledger "Spending Costs" slider arrows still use kit styling; no bitmap-style value boxes on setup (race/banner lists on art); star-system fleet panel layout unchanged. Nav colours are retinted by the theme-v2 retint pass (indigo becomes slate).
