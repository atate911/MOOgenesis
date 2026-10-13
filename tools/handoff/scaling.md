# UI scaling pass

## Changed
- css/base.css: root font-size is now proportional, `clamp(9.5px, min(100vw/1600, 100vh/900) * 15.5, 56px)` (15.5px at 1600x900; 9.9px @1024x600, 37px @4K). Every rem layout keeps identical proportions at all 16:9 sizes; non-16:9 windows are limited by the tighter axis. Settings `uiScale` (0.85-1.3) still multiplies it via UI.applyUiScale (resize listener re-applies).
- js/ui/kit.js UI.fitCanvas: dpr now = min(devicePixelRatio, caller maxDpr, Perf.q.dpr, ~14 Mpx backing budget) - safe at 4K/ultrawide.
- js/ui/design.js: `--gv` spare-height var now `100vh - 58rem` (was `100vh - 720px`, which blew up at 4K); compact @media breakpoints 1240px -> 1000px (CSS only).
- js/ui/tech.js: the px `max-height:779px` rule replaced by `min-aspect-ratio:3/2` (hides the "next techs" block unless the window is taller than 3:2; it overflowed at 1080p/21:9).
- tools/qa/scale-audit.js: in-page audit (`eval(await (await fetch('tools/qa/scale-audit.js')).text()); await __run([ids])`) lists OFF-screen / CLIP / SCROLL elements per screen. Reload the page after each resize_window (vw units are not live in emulation).

## Verified (audit, no overflow) at 1024x600, 1280x720, 1600x900, 1920x1080, 2560x1080, 3840x2160
galaxy, planets, fleets, design, tech, races, mapoverview, system, setup, menu, combat, audience, council, status, report, specs. Also uiScale 1.3 at 1080p: only design and tech overflow (they scroll).
Expected scrolls: techtree grid, help alien grid. False positives: gnn (`.rm`/sr-only), setup `su-stage` (mid-animation).

## Remaining
- Screenshots were not possible (Browser pane hidden/shared); verified by metrics only. Eyeball each screen at 1024x600 and 21:9 for aesthetics (wide screens leave side space in rem-capped panels).
- 2560x1440 not run separately (proportional between 1080p and 4K).
- Other per-screen px @media breakpoints (council 1000, options 760, saveload 900, setup 1020) are now effectively dormant; rem ones (62rem etc.) are measured at 16px, also dormant.
- Canvases with their own sizing (council fit(), setup full-window bg) already honour dpr/Perf; resize while a screen is open relies on each screen's resize() hook (untested hidden).
