# Image-generation prompts — battle backdrops ("Master of Orion — Reborn")

Four images behind the tactical combat board. They supersede the short entries #26–30 in `docs/IMAGE-GEN-OTHER.md` §4.3.

## What the game does with them (`js/ui/combat-fx.js` `drawPlate`)

- **Which one is shown:** `nebula` when the battle is inside a nebula, else `asteroids` when the board has five or more
  rocks, else `planet` when a planet is defended, else `deep`. Nothing selects `battle-star`, so it isn't needed.
- **How it's drawn:** cover-fit to the screen, with a very slow drift of a few pixels. The game then lays a **45% dark
  veil** and a vignette over it, so the image can be normally exposed; it will end up at about half brightness.
- **What sits on top:** the 10×8 combat grid covers almost the whole frame, ships stand in the left and right columns,
  and the game draws the **planet**, **asteroids**, **wreckage** and **missile platforms** itself. So the backdrop must not
  contain a planet disc, large foreground rocks or ships, and it must stay calm and low-contrast everywhere.
- **Light:** the game assumes the main light comes from the **upper right** (about 84% across, 16% down) and lights
  its effects from there.

**Drop-in:** put the PNGs in `assets/world-art/battle/`. I'll convert them to `assets/art/battle/battle-<name>.webp`.
No code change is needed: the combat screen picks them up as soon as they exist.

## Shared prompt

Paste this, then replace the last line with one block from below.

```
Use case: game background plate. ONE finished 16:9 image, 2560x1440, for the science-fiction strategy game
"Master of Orion — Reborn". It is the backdrop of the tactical combat screen: a grid of 10 x 8 squares covers almost
the whole image, and ships, a planet, asteroids and explosions are drawn on top of it by the game.

Composition rules:
- Calm, low-contrast and uncluttered across the whole frame, darkest in the middle; any visual interest sits at the
  far edges and corners. No single bright object near the centre.
- NO planet disc, NO moon, NO ship, NO station, NO large foreground rocks anywhere; the game adds those itself.
- The main light source is in the UPPER RIGHT, about 84% from the left and 16% from the top: a small distant star
  (or its glow just off-frame), so light falls from the upper right across the scene.
- Deep, rich blacks; a natural star field of many tiny stars of varied brightness, without cross-shaped spikes.
- Wide, flat composition with no strong perspective lines that would fight the grid.

Visual treatment: photorealistic astrophotography / cinematic space plate, physically plausible, restrained filmic
grade, subtle grain, not saturated. Original, nothing recognisable from any film or game.

Avoid: planets, moons, ships, stations, text, numbers, logos, watermark, border, interface, grid lines, lens-flare
hexagons, anamorphic streaks, cartoon, illustration, painterly brush strokes, neon, rainbow colours, fantasy galaxy
swirls, a bright object in the middle.

This backdrop: <paste the block here>
```

## The four blocks

1. **`battle-deep.png`** — open space (the most common; make this one first)
   ```
   Open deep space far from any planet: near-black emptiness with a faint, distant spiral galaxy small in one far
   corner (lower left), a few wisps of dark dust, and a sparse star field. The star in the upper right is small and
   distant. Mood: vast, cold, silent.
   ```
2. **`battle-planet.png`** — in orbit of the defended planet (the game draws the planet itself)
   ```
   High orbit near an inhabited world that is just OFF-FRAME to the right: its presence shows only as a soft, warm
   blue-white planetshine glowing in from the right edge, a few faint, tiny orbital lights and specks of distant
   satellites, and a thin, barely visible ring of orbital debris arcing across the upper right. No planet disc or
   limb visible. The star in the upper right lights the scene. Mood: a defended frontier, tense.
   ```
3. **`battle-asteroids.png`** — inside an asteroid field (the game draws the near rocks itself)
   ```
   Inside an asteroid belt: the field shows only as DISTANT, small, softly out-of-focus rocks and drifting dust far
   behind, denser toward the top and bottom edges and thin in the middle; light from the upper-right star rakes
   across the dust, leaving long faint shafts. No large or sharp foreground rocks. Mood: cluttered, dangerous, but
   the middle stays clear.
   ```
4. **`battle-nebula.png`** — inside a nebula (shields are weakened here)
   ```
   Deep inside a glowing nebula: soft volumetric clouds of muted violet and teal gas, brighter and more structured at
   the edges, thinning to a dim haze in the middle; the upper-right star glows through the gas and lights its edges.
   Colourful but muted and low-contrast, never neon. Mood: eerie, enclosed, electrically charged.
   ```

## Check before accepting
- [ ] There's no planet disc, moon, ship or large rock anywhere.
- [ ] The middle is dark and calm; nothing bright near the centre.
- [ ] The light comes from the upper right.
- [ ] There's no text, no grid lines and no lens-flare shapes.
- [ ] The four look like one set: same grade, star density and darkness.
