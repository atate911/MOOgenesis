# Photo race portraits

`assets/races/race-<id>-portrait.webp` (10 races, ~1254 px square) now replace the procedural portraits everywhere
`Gfx.Portraits` is used. Implementation: bottom of `js/gfx/portraits.js` ("PHOTO PORTRAITS"). Test page: `tools/test-portraits-photo.html`
(`?anim=1`, `?photos=0`, `?mood=angry`, `?races=human&size=360`).

## Behaviour
- Public API unchanged: `draw`, `canvas`, `drawBadge`, `accent`, `prewarm`, `clearCache`, `RACES/MOODS/NAMES`.
  New: `Portraits.photos` (set `false` to force procedural), `Portraits.procedural.{draw,canvas,drawBadge}` (the old renderer, use it for
  any code that reads pixels back), `Portraits.photo.{ready,load,loadAll,onLoad,whenReady,cacheBytes}`, window event `moo-portrait-loaded`.
- Images load through `new Image()` from a path resolved relative to the portraits.js script URL, so file:// works. Pixels are never read
  back (a file:// image would taint the canvas); the two code paths that probed with getImageData (setup.js `havePortrait`, gnn.js
  `portraitReady`) now probe `Portraits.procedural`.
- Lazy: a race loads on first request, the rest at idle (starts ~1.2 s after script load). Until loaded, or on error, the call falls
  through to the procedural portrait. Static one-shot badges (setup `raceBadge`, council `badgeEl`, landing `badge`) repaint via `photo.whenReady`.
  `canvas()` returns the procedural snapshot until the photo is ready; later calls return the photo.
- Cover crop with the face bias (face centre ~ (0.52, 0.36) of the square): portrait aspects use full height, landscape aspects slide the window to
  the upper-middle. Tighter crop (z 0.8 / 0.6) for boxes <= 170 / <= 90 px, badges z 0.74 / 0.62.
- Scaled bitmaps are cached per (race, quantised px size, z, feather); LRU budget = clamp(memoryGB*6, 24, 96) MB (4 GB assumed when unknown).
- `bg:false` (audience, council bust, GNN anchor) = feathered edges so the photo melts into the scene.
- Mood = soft-light tint + brightness + vignette (pleased warm, angry red/dark, worried cold, scheming green). Talking = slow breathing zoom + faint flicker.
  Eye look / blink / mouth sync from the old renderer are gone for photo mode (the old gaze, `eyeLook`, has no effect).

## Where a race picture appears (all now photo)
| Place | File | Call | Notes / dedicated art wanted |
|---|---|---|---|
| Setup wizard race list thumbs + big race picture + badges | ui/setup.js | draw / canvas(still) / drawBadge | wants full-figure + homeworld image per race |
| Setup emperor/leader picks, banner step | ui/setup.js | draw | |
| Races screen (contact cards) | ui/races.js | draw | |
| Audience screen (leader bust, talking) | ui/audience.js, gfx/scenes.js drawPortrait | draw | wants audience-hall backdrop per race, alternate poses (talking/angry) |
| Council (seat portraits, bust, banner badges) | ui/council.js, scenes.js | draw / drawBadge | wants full-figure seated sprites |
| GNN anchor + badges + small inline icons | ui/gnn.js | draw / drawBadge / canvas 12x15 | |
| Tech screens / lab scene (researcher) | ui/tech.js, TechScenes | draw | wants scientist-at-console art |
| Help / race encyclopedia | ui/help.js | canvas 180x225 | |
| Landing / invasion badges | ui/landing.js | drawBadge | |
| Combat/report/status banners (via scenes.js drawBadge) | gfx/scenes.js | drawBadge | |
| Galaxy/starmap race chips, endings | ui/*, scenes | drawBadge | |

## Still needing dedicated art
- Scientist-at-console (tech/lab scene), audience-hall environment per race, full-figure/full-body leaders (council seats, setup),
  homeworld pictures, alternate expressions (the mood grading is only a tint), advisor/spy portraits, ending-scene leaders.
- Race faces are currently centre-cropped with one face anchor; per-race anchors (`PH_FACE`) can be tuned if a new image has a different framing.
