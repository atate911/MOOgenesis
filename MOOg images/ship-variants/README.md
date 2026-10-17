# Ship image variants: upload here

Drop 3–4 images per hull class in this folder. In-game, each ship design gets one of its class's images, picked at random
but stable: a design keeps its look, and every new design rolls again.

**Naming:** the filename must contain the class name. Anything else in the name is free, e.g. `frigate-1.png`,
`frigate-b.png`, `02-destroyer-needle.webp`.
Classes: `frigate`, `destroyer`, `cruiser`, `battleship`, `doomstar`, `starbase`, `battlestation`, `star-fortress`, `stargate`.
A class with no images here keeps its current Fleet AI design.

**Art rules:** top-down orthographic; mobile ships point RIGHT; neutral grey hull; team-color panels in pure magenta
`#FF00FF`; white-cyan engine glow. Use a transparent PNG, or a flat `#00FF00` green background (it is keyed out automatically).
Any size and margin works: the build crops and scales.

**3/4 view (the "beauty" angle, docs/IMAGE-GEN-SPRITES.md):** a file whose name contains the class name AND the token `3q`
is that class's 3/4 render: `frigate-3q.png`, `02-destroyer-3q.png`. `frigate-2-3q.png` pairs with top-down variant 2
(no number = variant 1); a class with a single 3q image lends it to every variant. Camera above and to the front-right,
nose pointing to the lower right about 30° below the horizontal, same hull rules (grey, magenta livery, white-cyan engines,
transparent or green background). The design hologram, library thumbnails, fleet / system / pre-battle cards, the lander,
the bombard scene, the title fly-by and the GNN graphics draw it; the combat grid and the map keep the top-down view.
Until a class has one, those screens keep the top-down render.

**Build** (from the repo root, needs Python with Pillow + numpy):

    python3 -I tools/build-ship-art.py

Add `--with-defaults` to keep the current Fleet AI design as an extra variant of each class.
