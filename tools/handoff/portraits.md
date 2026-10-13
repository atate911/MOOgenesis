# Portraits v2 - physical renderer (handoff)

Goal: serious, grounded sci-fi leader portraits (research/09-art-direction.md, "Portraits" rows) instead of the old flat cartoon painters.
Public API is unchanged: `MOO.Gfx.Portraits.draw / canvas / drawBadge / RACES / MOODS / NAMES / accent / clearCache`.
New extras: `Portraits.v2` (registry), `Portraits.converted()`, `Portraits.prewarm(race, size, {moods, variant, color, bg})`, `Portraits.v2errors`.

## Status

| race | state |
|---|---|
| human, mrrshan, silicoid | **converted** (pilot / quality bar) - `V2.human`, `V2.mrrshan`, `V2.silicoid` |
| alkari, bulrathi, darlok, klackon, meklar, psilon, sakkra | still the legacy painters (`PAINT.<race>`), untouched - convert them one at a time |

`draw()`/`drawBadge()` pick `V2[race]` when it exists, else `PAINT[race]`. If a V2 race ever throws, it is logged once, remembered in
`Portraits.v2errors[race]` and that race falls back to its legacy painter (legacy code of converted races is still in the file as that fallback;
delete it only when the V2 version is signed off).

All code is in `js/gfx/portraits.js`, in two clearly marked places (so several agents can work without merge conflicts):

* `V2 : PHYSICAL PORTRAIT RENDERER (toolkit)` - the shared toolkit. Do not edit casually; if you need a new primitive add it, don't change behaviour.
* `/* @@V2-RACES@@ */` - one block per converted race: `/* ---- <RACE> (v2) ... */  V2.<race> = (function () { ... return { ... }; })();`
  Add your block right before the legacy `HUMAN` section (or next to the others). Nothing else in the file has to change to convert a race.

## How the renderer works

1. **G-buffer** (`GBuf`, virtual frame 400x500, all canvases share one transform incl. the race `fit`):
   `A` albedo RGBA (alpha = coverage), `Hg` height (**alpha channel**, 0..255 = 0..`depth` virtual px), `M` material (R spec, G gloss, B sub-surface),
   `T` micro-texture weights (R pores/grit, G cells = scales/plates/facets, B strands = fur/hair), `E` emissive (additive RGB).
2. **Relight** (`relight()`, CPU, typed arrays, once per race x variant x colour x mood x size bucket, cached): normals from the smoothed/dithered float height
   + micro bump; key / fill / rim lights, wrapped diffuse, warm sub-surface band, blinn spec from the material map, height-field cast shadows
   (7-step march along the key), cavity AO, edge darkening, fur fuzz, per-pixel albedo jitter, filmic tone-map + split-tone + desaturation, grain in display space,
   skin "soften" pass (blur inside high-sss areas), optional emissive bloom, depth-of-field on the chest.
3. **Frames**: one lit canvas per mood (lazily; idle-time prefetch of the rest). Moods cross-fade (0.32 s). Mood also nudges the lighting (`V2_MOODLIGHT`).
4. **Live layer** (`def.dyn`): eyes (blink, gaze, pupil), mouth opening while talking, glows - drawn on top of the baked frame in the same coordinates.
5. Backdrop: baked dark control room with bokeh + accent practical (per race/tint), parallax-shifted a little by head motion.

Bake cost ~35-80 ms for a 400x500 portrait (CPU, one time per cache key; ~5-15 ms for badges / small sizes because the bucket is small). Warm draw = 1 `drawImage` + live eyes (~0.1 ms).
Quality follows `MOO.Perf.tier`: low = res cap 0.6 and no cast shadows, medium cap 0.85, high 1.1. Cache: 14 V2 entries (each up to 5 mood frames).
Use `Portraits.prewarm(race, widthPx)` from an idle moment (setup screens, scene load) if a hitch matters.

## Converting a race (checklist)

```js
V2.<race> = (function () {
  /* palettes, constants, small helpers (shape(), mixc(), rgd(), lg(), clamp()... are file-level helpers) */
  return {
    accent: '#79a8d8',          // rim light + backdrop practical + Portraits.accent()
    bg: '#2a3a52',              // backdrop tint (o.bg string overrides)
    defColor: '#b83a3a',        // default banner colour (P.color = colorPal(...): .mid .hi .lo .deep)
    pivot: [208, 340],          // head rotation / zoom pivot (frame coords AFTER fit)
    badge: [210, 200, 134],     // drawBadge crop: centre x, y, radius (frame coords AFTER fit)
    fit: [1.12, 208, 300],      // optional: [scale, cx, cy] applied to every G-buffer layer AND to dyn() (bigger head in frame)
    bloom: 5,                   // optional: glow radius for emissive pixels (E layer)
    dof: false,                 // optional: disable the chest blur
    light: { key:{d,c,i}, fill:{...}, rim:{c,i}, amb:{...}, wrap, exposure, sat, fall:[x0,x1,amt, y0,y1,amt], soften, edge, shadowSoft, ao, grain }, // overrides of V2_LIGHT
    gbuf: function (P, T) { return { depth: 130, poreScale: .7, poreAmp: .22, strandScale: 1, strandAmp: .8, flow: (x,y)=>angle,
                                     cellSize: 22, cellMode: 0|1, cellTilt: .5, cellGroove: .1, cellJit: .16, cellRot: 0 }; },
    traits: function (P) { /* variant -> look; P.rng('salt') is a seeded rng; P.variant, P.color */ return {...}; },
    build: function (gb, P, T, m, mood) { /* paint the static layers for this mood: m = MOOD[mood] (smile, brow, browY, lid, open, asym, bAsym, ...) */ },
    dyn: function (g, P, T, A) { /* live: A.blink, A.lx/ly gaze, A.talk, A.m (smoothed mood), A.t, A.ph[] */ }
  };
})();
```

Steps: 1) collect looks from research/01-races.md (race traits), the legacy painter (`PAINT.<race>`, silhouette / palette / variants) and the original screenshots;
2) write `traits` (variant -> palette/hair/eye colour etc.); 3) `build`: back to front - bust/clothing, neck, head base, **big forms first**,
`gb.smoothHeight(r)`, then small features with `gb.hs = 1.4` (multiplier for `hb`), then albedo variation, markings, hair/fur strands, final accents;
4) `dyn`: eyes via `liveEye(g, {x,y,w,h,rot,iris,irisR,pupil:'round'|'slit',sclera:[c,c,c],open,peak,dx,lash}, A, side)`, mouth/teeth, glows;
5) tune `light`; 6) check all moods, variants 0-7, talking, flip, bg false/tint, badge r=40/26/16, `tools/test-portraits.html?selftest=1`, `node tools/check.js`.

### Toolkit API (inside `GBuf` painting, all coordinates virtual 400x500 *before* `fit`)

* `gb.fill(path, { a, ab, h, hb, hAdd, hg, m, mb, t, tb, e, eb })` - fill a `Path2D` (or `fn(g)` that begins a path) into layers. `a` albedo colour (or fn(g)->style),
  `h` height **plateau level** (sets, 0-255) with blur `hb` px, `hAdd` add/dent height, `hg` = `[x0,y0,x1,y1,l0,l1]` height ramp (planar facets / crystals),
  `m` = `[spec, gloss, sss]` 0-1, `t` = `[pore, cell, strand]` 0-1, `e` emissive colour.
* Soft blobs: `gb.hb(x,y,rx,ry,rot,delta)` height raise (delta>0, additive) / dent (delta<0, scales existing height), `gb.ab(x,y,rx,ry,rot,colour,alpha)` albedo,
  `gb.mb(x,y,rx,ry,rot,spec,gloss,sss,alpha)` material, `gb.tb(x,y,rx,ry,rot,pore,cell,strand,alpha)` texture weights, `gb.eb(...,colour,alpha)` emissive.
* `gb.strand(x,y,angle,len,width,colour,alpha,bend,hDelta)` - one hair/fur filament (angle 0 = pointing down, + = to the right); thousands are fine.
* `gb.xf(dx, dy, fn, rot)` run `fn` with every layer translated/rotated (epaulettes, head turn offset); `gb.smoothHeight(r)`; `gb.hs` hb multiplier.
* Height rules learned the hard way: height lives in the alpha channel (8 bit) - keep base + features <= 255 or they clip into flat patches; keep big forms smooth
  (`hb` blur, domes, `smoothHeight`) and put detail on top; very steep or kinked heights show as patchy shading. `depth` 130-170 is a good range.
  Pores/fur come from `T` weights, not from height.
* Higher level helpers: `liveEye`, `v2IrisSprite`, `sblob`, `trip`, `cssBlur`, `glow`, `grain`. `rgd/lg/mixc/lite/dark/rgba` are the old file-level helpers.
* Lighting: `V2_LIGHT` defaults + `V2_MOODLIGHT` (per mood tweak). `light.fall` darkens the key towards the far side / chest (cinematic falloff).
* Debug: `Portraits.v2.keep = true` keeps the last G-buffer in `Portraits.v2.lastGB` (cA/cH/cM/cT/cE canvases); `Portraits.v2.dbg = 'ao'|'sh'|'dif'|'sss'|'cj'|'n'|'alb'|'spec'`
  then `clearCache()` shows one lighting term; `Portraits.v2.noShadow = true`, `Portraits.v2.noIdle = true`.

## Test pages

* `tools/test-portraits-v2.html` - converted races only: `?races=human,mrrshan&size=340`, `?moods=1`, `?variants=0,1,2,3,4,5,6,7`, `?small=1` (160/96/64 px + badges), `?anim=1&races=human&size=420`.
* `tools/test-portraits.html` - old page, all races, `?selftest=1` sweeps race x mood x talk x variant x flip x bg (must print `SELFTEST OK`).
* In the app: New game > step 2 (Race) shows converted vs legacy cards side by side.

## Known gaps / ideas

* Human face is the weakest: skin is smooth CG, hair is a strand cap (female variants read as a hood). Next: lip/eyelid structure, better hair volume, more per-variant clothing.
* Mrrshan face is a mask over a mane; stripes are sparse; fangs only appear when angry/talking.
* Silicoid facets are Voronoi planes (planar shading) - could use proper crystal refraction (sample blurred backdrop) and per-facet colour.
* Expression strength is subtle at <150 px; `V2_MOODLIGHT` does most of the mood work there.
* Optional accelerator: `relight()` is a pure function of typed arrays; a WebGL2 version (G-buffer uploaded as textures) is a drop-in replacement for the 35-80 ms bake.
