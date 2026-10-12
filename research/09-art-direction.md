# 09 — Art direction v2: "serious sci-fi"

Product-owner directive (verbatim): *"make them more modern, like a serious game, less cartoonish, and with more of a serious scifi flair."*
Everything stays **original** (no game/film assets copied; styles are described in words and general principles). This is a re-skin and re-render, **not** a redesign of flows (research/06 information design stays).

## 0. Status of this document (read first)

| Part | State |
|---|---|
| A critique | Done from live screenshots of: title, galaxy HUD + colony panel, portraits, scenes (lab), ships roster, planets, icons (1280x720, dev server). **Not captured in this pass** (session wrap-up): New-game wizard, design editor, tech screen, ledgers, GNN broadcast (test page needs a click on "Quiet turn"), test-glplanets, test-glspace, all 1920x1080 shots. Their critique below is from code reading and is marked *(code)*; capture them first thing next session (section 9, baseline script). |
| B style guide | Complete and implementable (sections 2-6). All colours were contrast-checked numerically (WCAG ratios in 2.2). |
| C theme prototype | `css/theme-v2.css` + `tools/test-style2.html` — **opt-in only** (every rule is scoped to `:root[data-theme="v2"]`; without the attribute the file is inert and the default look is unchanged). |
| C art prototypes (portrait / ship / HUD composite) | **Not built** — the pass was cut short by a wrap-up request. Section 8 records the approaches analysed, what is expected to fail, and five time-boxed spikes with pass/fail criteria so the next session proves them in the first hours instead of guessing. No performance numbers were measured; the budgets in section 6 are targets. |

Dev machine note for the perf work: Ryzen 9 7900X (24 threads) + RX 9070 XT (discrete) + the CPU's own 2-CU Radeon iGPU. Run the perf harness on the **iGPU** as well (Windows "power saving" GPU for the browser, set by the user, or the F3 overlay's GPU string) — the discrete GPU hides every shader cost by roughly 20-80x.

---

## 1. Part A — critique of the current look (evidence)

Current identity (CONVENTIONS "Look & feel"): "imperial observatory" = indigo void `#060919`, brass hairlines `#d6b36a`, ivory ink, 45-degree chamfers on every panel/button/chip/tooltip, Marcellus SC serif for headings and buttons, additive glows. Counts that matter for migration cost: **199** hard-coded `rgba(214,179,106,x)` brass literals + **99** hex brass literals in `css/` and `js/ui/*.js` strings, **104** uses of `var(--font-display)`, **61** of `var(--font-title)`, canvas modules (`scenes.js`, `galaxymap.js`, `gnn.js`, `design.js`, `tech.js`, `combat-fx.js`) carry their own copies of the palette and the Marcellus font string.

### 1.1 Surface-by-surface findings (ranked within each surface)

| Surface (evidence) | What makes it cartoonish / ornate / soft |
|---|---|
| **Title** (`index.html`, `ui/menu.js`) screenshot | 1) Wordmark: serif Marcellus with a vertical cream-to-bronze gradient fill + gold drop-glow reads "fantasy RPG logo", not hard sci-fi (typography, ornament). 2) Buttons: indigo gradient + brass bevel + chamfer + small-caps serif = decorative "jewel" buttons (ornament, flat gradients). 3) Vortex: additive soft blobs, blown-out white core, uniformly saturated violet/blue haze; looks airbrushed instead of photographic (saturation, bloom without HDR roll-off). 4) The planet: saturated cyan/white marble with crisp white clouds and a thin rim, no terminator scattering or ambient colour from the star (lighting, saturation). |
| **Galaxy HUD** (`?dev=1&screen=galaxy…`) screenshot | 1) Stars are pure-hue discs (red/green/blue/white) with soft halos = "candy dots"; real star colours are pastel blackbody tints. 2) Nebula is evenly spread violet smoke at similar luminance to the stars, so the map has no figure/ground hierarchy. 3) Selection = glowing blue disc + dashed ring with soft bloom; the look should be thin vector reticle brackets. 4) Panels: brass-edged chamfered glass with an inner indigo gradient on every module (ornament). 5) Bottom bar: row of identical gradient buttons; the primary "Next turn" is a big gold gradient slab. 6) Top-left HUD text is tiny (about 9 px at 1280x720) — information density is good but legibility is not. |
| **Colony panel** (`ui/side-colony.js`) screenshot | Good information design (NONE / CLEAN / 3.7/Y readouts). Looks soft because slider fills are neon gradients with outer glow, the track has a 10-segment grid at 45% black, knob is a glowing brass bar; the planet card is a framed picture with a glossy sphere. Fix: flat accent fills, 1 px tick marks, mono numerals, no glow except on the live value. |
| **Portraits** (`test-portraits.html`) screenshot | #1 cartoon offender. Face = smooth porcelain gradient with no pores/AO; large almond eyes with heavy outlines (proportion: eyes about 1/5 of face width, "cute"); hair is a white blob with painted strand lines; saturated royal-blue gradient backdrop; glossy brass epaulettes. Lighting: one soft upper-left key, **no cast shadows** (no nose/brow/chin-under shadow), no rim, no AO in the collar. Everything is outlined. |
| **Scenes** (`test-scenes.html` lab) screenshot | Same portrait at a toy-like scale in front of concentric cobalt rings, gold trim lines and a glowing dais; holographic wireframes are decorative scribbles; palette is 2-3 saturated hues. Reads "children's sci-fi TV". Composition is flat (no foreground/mid/background depth cues apart from a blur on the left). |
| **Ships** (`test-ships.html`) screenshot | Plan-view sprites with soft bevel gradients, glowing thrusters and **decorative silhouettes** (Alkari feather wings, Darlok manta). No panel lines, no self-shadowing between modules, no scale cues (rivets, windows). At large sizes (Doomsday) they look like clip-art; at small sizes they are acceptable. Fix is shape language + hard-surface detail, not more gradients. |
| **Planets** (`test-planets.html`) screenshot | **Closest to target.** Real lit spheres (3-D noise, relief lighting, clouds, city lights). Needs: -20 to -30 % land saturation, physically motivated atmosphere (limb scatter, orange terminator), filmic tone-mapping, ocean specular glint, thinner/crisper rim. |
| **Icons** (`test-icons.html`) screenshot | 101 solid-fill 24-grid glyphs with 45-degree chamfers — consistent, but heavy fill, tiny cut-outs close up below 16 px, and they sit on brass-framed tiles. Target: 1.5 px line set with one accent detail. |
| **GNN / newsroom** *(code)* | Anchor = portrait renderer + `Scenes.newsroom` studio; inherits every portrait/scene issue; lower-third, ticker and rankings are good structurally. |
| **Wizard / design / tech / ledgers / races** *(code)* | Same chrome (brass hairlines, chamfers, serif headings); design preview is a hologram of the same plan-view ship; tech screen uses procedural "hologram blueprint" art (`TechArt`) in cyan/violet glow. All will be fixed by the token remap + codemod + ship/portrait modules. |
| Console | Only 404s for manifest modules that did not exist yet and `ERR_CONNECTION_REFUSED` for the optional Google Fonts link (offline). No art-module errors. |

### 1.2 Causes ranked by impact on "cartoonish"

1. **Character rendering** — proportions (large eyes/heads), outlines everywhere, flat gradient skin, no cast shadows/AO, saturated backdrops. (portraits, scenes, GNN, audience, council, endings)
2. **Global saturation and hue count** — indigo + violet + brass + five neon signal colours + glows on everything; no neutral ramp for the UI to rest on.
3. **Ornament in chrome** — brass bevels, symmetric chamfers on every element, gold-gradient wordmark, serif small caps.
4. **Ship shape language** — decorative silhouettes, soft shading, no hard-surface detail or scale cues.
5. **Lighting model** — single soft key, additive glow used instead of occlusion; no rim/fill ratio, no tone mapping (everything clips to flat colour).
6. **Typography** — serif display face.
7. **Effects** — additive circular puffs, no debris/shockwave/HDR roll-off *(code: fx.js)*.
8. **Motion** — screen transition = blur + brightness bloom (dreamy); target = fast, mechanical, 120-200 ms.
9. **Icons** — heavy fills.

---

## 2. Part B — style guide

### 2.1 Pillars, mood words, avoid list

**Pillars:** (1) *Grounded hard sci-fi* — plausible machines, believable scale, light behaves like light. (2) *Industrial / instrument-panel UI* — data first, thin steel lines, no jewellery. (3) *Cinematic restraint* — low-key lighting, large dark areas, one purposeful accent per frame. (4) *High information density, high legibility* — tabular numerals, strict hierarchy. (5) *Tactile* — surfaces have grain, wear, panel seams; interactions have weight (short, mechanical motion).

**Mood words:** cold steel, graphite, sodium-lamp amber, instrument cyan, hazard orange, vacuum black, film grain, lens, matte ceramic, anodised metal, scuffed, sterile, operational.

**Avoid:** brass/gold ornament, bevels and emboss, rainbow gradients, neon glows on idle elements, outlines on organic art, big-eyed/round shapes, pure-white highlights, pure-saturated primaries, drop shadows with blur above 8 px on UI, serif display type, decorative wings/feathers on hulls, lens flares everywhere, bloom that washes out text.

### 2.2 Colour system

Neutral ramp (cool gunmetal, only 4-6 % blue chroma so planets/portraits stay the colourful objects). All text colours below are **numerically checked** (WCAG 2.x contrast vs bg-2 `#0f161e` / worst case bg-4):

| Token | Hex | Role | Contrast vs bg-2 (vs bg-4) |
|---|---|---|---|
| `--bg-0` | `#05080c` | void, canvas clear colour | — |
| `--bg-1` | `#0a0f15` | app background | — |
| `--bg-2` | `#0f161e` | panel surface | — |
| `--bg-3` | `#161f29` | raised / table header / input | — |
| `--bg-4` | `#1e2a36` | hover / pressed | — |
| `--line-0` | `#1b2530` | row separators | decor |
| `--line-1` | `#2a3744` | panel hairline | decor |
| `--line-2` | `#3d4f60` | control borders | UI 2.3:1 (decor/pair with ink) |
| `--line-3` | `#5b7186` | strong edge, ticks, active border | 3.6:1 (>= 3:1 non-text UI) |
| `--ink-0` | `#e9eef3` | primary text | 15.6 (12.5) |
| `--ink-1` | `#b7c3cf` | secondary text | 10.2 (8.1) |
| `--ink-2` | `#8794a2` | tertiary / labels | 5.9 (4.7) |
| `--ink-3` | `#5d6b79` | disabled / decorative only | 3.3 (exempt) |

Accent semantics (**unchanged meaning**, re-tuned: lower saturation, slightly darker; `text` = the colour on dark UI; `glow` only for live values and canvas emissives):

| Meaning | Token | Hex | Contrast on bg-2 (bg-4) | Dark-ink-on-fill |
|---|---|---|---|---|
| Gold = BC / money | `--a-gold` | `#dcb54f` | 9.3 (7.5) | 9.5 with `#1a1304` |
| Ember = industry / warning | `--a-ember` | `#ec8a45` | 7.2 (5.8) | |
| Cyan = research / focus / primary HUD accent | `--a-cyan` | `#52c8ec` | 9.4 (7.5) | 9.8 with `#04121a` |
| Leaf = food / growth / success | `--a-leaf` | `#62c488` | 8.5 (6.8) | |
| Rose = danger / war / loss | `--a-rose` | `#ee6679` | 5.9 (4.7) | |
| Violet = diplomacy | `--a-violet` | `#a58df0` | 6.7 (5.3) | |
| Teal = ecology | `--a-teal` | `#3cc5b4` | 8.5 (6.8) | |
| Azure = ships / defence | `--a-azure` | `#6396ee` | 6.2 (5.0) | |

Colony slider categories: ship `#5a98e8`, def `#e8627a`, ind `#e9a047`, eco `#3dc7a0`, res `#a58df0`. Empire banners keep their identity hexes (all >= 4.8:1 on bg-2): `#4a90e8 #4ed17a #b45be8 #e8504d #f1eee4 #e8c94a` — and gain a **shape/pattern per banner** (accessibility, research/06 section 13 #11).

**Rules.** (a) Large surfaces are neutral; colour = data. (b) At most **one accent hue dominates a screen region**; the HUD accent (`--accent`, default cyan, selectable amber/green via `data-accent`) is used for focus, selection, primary action and live readouts only. (c) Glows (`box-shadow`/bloom) only on: the focused control, a live value changing this frame, emissive hull trims, beams. (d) Backgrounds (nebula, planets, scenes) are graded to **max about 55 % saturation** and a nebula's peak luminance <= 0.25 so UI text on top stays AA. (e) Optional light-on-dark HUD accent: `data-accent="amber"` maps `--accent` to gold for a "sodium amber" variant.

Legacy-token remap (so existing `var(--brass)` code re-skins without edits): `--void/night/deep -> bg-0/1/2`, `--glass -> rgba(10,15,21,.94)`, `--steel/steel-hi -> bg-3/line-2`, `--brass -> #7f93a8` (edge/label steel, 5.5:1), `--brass-hi -> ink-0`, `--brass-lo -> line-2`, `--ivory -> ink-0`, `--mist -> ink-1`, `--fog -> ink-2`, signal colours -> table above. Hard-coded literals need the codemod (section 5, workstream A).

### 2.3 Typography

| Role | Face (web, optional) | Offline fallback stack | Use |
|---|---|---|---|
| Display / headings / buttons / tabs | **Oxanium** 500-700 (OFL, technical, squared) | `'Saira Semi Condensed','Bahnschrift SemiBold','Bahnschrift','DIN Condensed','Segoe UI Semibold',system-ui` | Titles, panel headers, buttons, table headers |
| UI body | **IBM Plex Sans Condensed** 400-600 (already loaded) | `'Bahnschrift SemiCondensed','Bahnschrift','Segoe UI',system-ui` | Paragraphs, labels, list rows |
| Numerals / readouts | **IBM Plex Mono** 400-600 (OFL) | `'Cascadia Mono','Consolas','SF Mono',ui-monospace,monospace` | All numbers in tables/HUD (`font-variant-numeric: tabular-nums` always), kbd hints, chips |

Rules: headings are **sentence or Title case, never serif**; panel headers/table headers/tabs/chips are UPPERCASE with tracking `.12-.16em` at 11-13 px equivalents (`.72-.82rem`); screen titles 600 weight, `.04em` tracking, no gradient fill, no text-shadow glow (a 1 px `rgba(0,0,0,.6)` shadow only on text over imagery); body line-height 1.35-1.45; minimum UI text 11.5 px at 720p (current HUD uses about 9 px — raise). Numbers: right-aligned, mono, units in `--ink-2` at 80 % size. Canvas text uses the same stacks through the new `MOO.Gfx.Theme.font(role,px)` helper (section 5) instead of hard-coded Marcellus.

### 2.4 UI chrome language (what replaces the brass ornament)

* **Surfaces:** flat `bg-2` with a 1 px `line-1` hairline; a faint top-lit gradient (`+3 %` lightness) only on interactive surfaces. HUD overlays on the map use `glass` = `rgba(10,15,21,.66)` + `backdrop-filter: blur(6px)` (medium+ tiers; on low use opaque `.9`).
* **Corners:** single 45-degree cut on **top-left and bottom-right only** (6-8 px) — keeps the game's "no rounded corners" rule with half the ornament; plus 10 px accent **corner ticks** (L-brackets) on top-right/bottom-left of *modules* (not on every button).
* **Headers:** `[3 px accent bar] UPPERCASE TRACKED LABEL ..... mono sub-readout`, underline `line-1`. Optional index `01 /` prefix on HUD modules.
* **Dividers:** 1 px `line-1` with 6 px `line-3` end-ticks; dotted tick rulers (`repeating-linear-gradient`) for slider tracks and bars.
* **Buttons:** flat `bg-3`, 1 px `line-2` border, UPPERCASE display 12-13 px, `.1em` tracking; hover = border to `line-3` + `bg-4`; active/pressed = inset `bg-1`, **no translate**; primary = solid `--accent` fill with dark ink (one per view); danger = rose text + rose border on `#2a1218`; toggled = accent-dim fill (`accent 14 %`) + accent border; disabled = 45 % opacity, no grayscale filter. Hotkey hint = mono chip at right.
* **Sliders:** 10 px track `bg-3`, 10 tick marks every 10 %, **flat** fill (`--c`), thumb = 3 px x 16 px `ink-0` bar with `0 0 0 1px bg-0`; the value readout is mono and flashes `ink-0 -> normal` over 250 ms when it changes; lock = rose when on.
* **Tables:** header UPPERCASE `ink-2` on `bg-3` with `line-2` underline; rows 1 px `line-0`; hover `bg-3`; selected = `accent 8 %` fill + 2 px accent left bar; numeric columns mono, right-aligned; no zebra.
* **Tabs:** UPPERCASE display, inactive `ink-2`, active `ink-0` + 2 px accent underline + 6 % accent wash.
* **Tooltips:** `bg-3`/`line-2`, 2 px accent left bar, 12.5 px body, `<b>` in accent, optional mono "formula" line (research/06: explain-this-number popover).
* **Modals:** scrim `rgba(2,4,8,.72)` + 2 px blur (none on low); panel as above; header UPPERCASE; footer separated by `line-1`; entrance 160 ms (6 px rise + fade) — **never** blur+brightness.
* **Scrollbars:** 8 px square thumbs `line-2`, hover `line-3`, transparent track.
* **Focus:** always visible: 1 px `--accent` outline, 2 px offset, plus corner ticks on large controls; never glow.
* **State colours:** hover = brighten border; active = accent; success `leaf`, warn `ember`, error `rose`, info `cyan`; never rely on colour alone (icon + text).
* **Glass / noise / scanline / vignette rules:** one full-screen `#app::after` overlay: vignette (to 38 % black at corners) + 3 px scanline pattern at **1.8 % white** (`data-fx="off"` removes it; low tier and `reduceMotion` default to off). Film grain only on **scenes** (portrait/GNN/endings) and the title, 1.5-3 % luminance, regenerated at 24 Hz, never over data tables. No CRT curvature, no chromatic aberration on UI.
* **Micro-motion (all <= 200 ms, `cubic-bezier(.2,.8,.2,1)`):** hover border 90 ms; panel open 160 ms (4 px rise + clip reveal from the cut corner); tab underline slides 140 ms; number count-up 250 ms; toast 180 ms; screen change = 180 ms wipe/scan (not blur). Honour `prefers-reduced-motion` and Settings `reduceMotion`.
* **Sound pairing (reuse `UI.sfx` ids):** click = dry relay tick (+2.2 kHz blip); confirm = rising fifth; cancel = single falling tone; error = 90 Hz 120 ms buzz; toast = soft ping; tab = switch click; slider = very quiet tick each 4 % step; modal open = 80 ms low whoosh; hover = silent (except primary, -30 dB tick). Every visual state change above has exactly one sound or none — no sound without a visual change.

### 2.5 Iconography

24 px grid, **1.5 px stroke** (scale to 2 px at <= 16 px, 1.25 px at >= 48 px, `vector-effect: non-scaling-stroke` where possible), square caps, miter joins, **0 radius** (45-degree cuts only, 2 px keyline padding), outline by default; **duotone** for semantic icons (neutral outline + one accent detail: BC coin = gold dot, research = cyan dot); filled only for "active/selected". Minimum feature 1.5 px; no cut-outs under 2 px. Replaces the 101 solid glyphs; `.ico { fill:none; stroke:currentColor }` under v2, set switched via `Gfx.Icons.setStyle('line'|'solid')` so both can coexist during migration. Brass frames around icon tiles are dropped.

### 2.6 Rendering rules for art modules

**Lighting model (applies to portraits, ships, planets, scenes, battle).** Linear-light HDR internally, filmic tone-map at the end.
* Key: warm (`~5200 K`, `#ffe9cf`), intensity 1.0, 35-50 degrees above and 30-60 degrees to the camera-left; hard-ish (soft-box radius <= 15 % of subject) so **cast shadows read**. Fill: cool (`#6f8fbf`), 0.12-0.18 (key:fill about 6:1, 2.6 stops). Rim/kicker: cool teal or the empire accent, 0.5-0.9, from behind-right at 110-140 degrees, Fresnel-weighted (`pow(1-NdotV,3)`). Ambient: 0.03 from a dark env colour; **ambient occlusion mandatory** (baked per vertex/texel or analytic: `ao = clamp(0.5+0.5*h,0,1)` from the height field; contact AO under chins, collars, hull overhangs).
* Tone-map: `ACES-fitted(x*exposure)` = `clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0,1)`; default exposure 0.9 for faces, 1.0 for ships; then sRGB. Never output pure white: highlights top out at `#f4f1ea`. Specular uses GGX with roughness 0.35-0.6 (metal/ceramic) and 0.45 (skin).
* Bloom (high+): threshold 0.9 linear after exposure, soft knee 0.5, 5-mip dual-Kawase, intensity 0.25-0.4, tinted by source. Low/medium: fake bloom = one 1/4-res blurred additive copy of emissive layer only.
* Volumetrics: cone/shaft sprites (noise-modulated triangle fans, additive, alpha <= 0.08) for window lights and engine plumes; dust motes (<= 40) in scenes; planetary atmosphere is analytic (thickness 3-6 % of radius).
* Fake AO / contact shadow: dark multiply gradients under objects, 12-20 % darker, offset away from the key.

**Materials.**
* *Hard-surface (hulls, props, UI hardware):* albedo 0.18-0.45 (never > 0.8), metal roughness 0.4-0.6; panel lines every 1/48-1/64 of the hull length with 1 px dark groove + 1 px light bevel on the lit side and groove AO; rivet/screw rows; **emissive trims** (window grids 2x2 px cyan/amber, nav lights red/green blinking), hazard decals sparingly; weathering = edge wear (curvature), soot streaks behind nozzles, anisotropic scratches at 5-8 % albedo variation; livery = empire colour on **1-2 stripes/insignia + engine tint only** (hull stays neutral so empires still read at a glance).
* *Organic skin:* wrapped diffuse (wrap 0.35) + subsurface tint in the terminator band (human `(1.0,0.45,0.35)`), pores/micro-relief at 0.8 px scale (bump 0.15), T-zone oil spec, cast-shadow eye sockets (deep-set eyes catch only a glint — the cheapest big realism win), stubble/hair as strands with Kajiya-Kay spec. Eyes: 1/7 face width, wet specular, upper-lid shadow, no outline.
* *Fur:* 3-5 shell layers + clumping noise, anisotropic spec, rim "fuzz" (Fresnel^3). *Scales:* Voronoi cells 6-10 px at 400 px portrait, groove bump from edge distance, +/-8 % albedo jitter, +/-12 degree view-dependent hue shift, tiny spec glints. *Chitin:* smooth plates roughness 0.2-0.3, suture seams, amber translucency at edges. *Crystal (Silicoid):* facets with refraction fake (offset sample of blurred backdrop), internal glow. *Cyborg (Meklar):* hard-surface rules on a skin mask.
* *Glass / holo:* Fresnel edge brightening, 2 px scanlines at 6 % depth, 1 px channel split, 8 Hz flicker 0.5 %, additive at 0.6-0.8 alpha, base `--a-cyan` desaturated 15 %; never full-white.

**Atmosphere / post (use sparingly).** Film grain 1.5-3 % (scenes only), vignette 12-22 % (scenes) / 38 % black at corners (UI overlay), chromatic aberration <= 0.6 px at the frame edge in cinematic scenes only, depth of field = pre-blurred backdrop layer (6-12 px) rather than true DoF, anamorphic streak only on stars/explosions (max 1/frame).

**Planets / space / nebulae.** Land saturation -20 to -30 %; limb scattering (blue day side, orange terminator), ocean specular glint, cloud shadows, warm city lights only on the night side; star surfaces: granulation (3-octave Voronoi), limb darkening (u = 0.6), corona = low-intensity `1/r^2.2` glow + streamers; stars in the field follow a power-law magnitude distribution with blackbody tints (3000-12000 K), only the brightest ~20 per view get halos (everything else >= 1 px points); nebulae: two hues max, dust lanes darker than space, filaments, saturation <= 55 %.

**Effects (beams, missiles, explosions).** Additive HDR accumulation (RGBA16F), tone-map after. *Beam:* white-hot 1-2 px core (HDR 4.0) + 6-10 px coloured exp falloff + impact flare + faint streak. *Missile:* 12-20 px plume, thin smoke trail fading in 1.2 s, warhead blip. *Explosion* = 4 stages: flash (60 ms) -> turbulent fireball (250-600 ms, white -> yellow -> orange -> deep red -> grey smoke ramp) -> 20-60 debris shards with motion blur and cooling colour -> shockwave ring with refraction (400 ms); also inject a 0.4 s point light into nearby hulls. Smoke is a *darkening* multiply layer. No outlines, no uniform-radius puffs.

**Cinematography.** *Portraits:* 85 mm look, 4:5 crop, eyes on the upper third (38-42 % from top), 3/4 turn (15-30 degrees), camera at chin height (-5 degrees, authority), key camera-left, rim camera-right behind, backdrop = dark control room with 2-3 out-of-focus practical lights, breathing <= 1.5 px, blink every 3-6 s, lip-sync = jaw opening + 3 visemes (no cartoon mouth flapping). *Scenes (lab/council/audience/endings):* 3 depth layers with parallax, foreground silhouettes 40 % darker, haze volume, optional 2.39:1 letterbox for GNN/endings, rule-of-thirds composition, practical lights as the key. *Battle:* 3/4 top-down (about 55 degrees pitch), subtle tilt-shift, shadows cast on hulls from the system star. *GNN studio:* dark glass studio with an LED wall, three-point lit anchor, thin-line lower-thirds in condensed type, ticker with 1 px rules.

---

## 3. Per-module upgrade plan

Effort: S = <0.5 day, M = 0.5-1.5 days, L = 2-4 days, XL = 5+ days of one agent. "GPU" = what should render on WebGL2 with a Canvas2D/CPU fallback of the same API.

### 3.1 Gfx modules

| File | What changes | Effort | Depends | Test page | Risk | GPU? |
|---|---|---|---|---|---|---|
| `gfx/gl.js` (lead) | Add: RGBA16F ping-pong FBOs, blur pyramid helper, shader chunk library (`GL.glsl.pbr` GGX + wrapped SSS, `glsl.tonemap` ACES, `glsl.grain`, `glsl.sdf` primitives), timer-query helper for the perf harness | M | — | test-gl.html | low | core |
| **new** `gfx/post.js` (`MOO.Gfx.Post`) | Fused tone-map + bloom + vignette + grain + CA pass (one shader), tier-switched; CPU fallback = 2D gradient vignette + noise tile + `ctx.filter`-free fake bloom | M | gl.js | new `test-post.html` | med (cost on iGPU) | yes |
| **new** `gfx/theme.js` (`MOO.Gfx.Theme`) | Reads CSS tokens once (`getComputedStyle`), exports colours (linear + sRGB), `font(role,px)`, accent, `onChange`; replaces the duplicated palettes in `scenes.js`, `galaxymap.js`, `gnn.js`, `design.js`, `tech.js`, `combat-fx.js` | S | theme-v2.css | test-style2.html | low | — |
| `gfx/portraits.js` (233 KB) | **Rewrite the renderer, keep the API** (`draw/canvas/drawBadge`, moods, banner colour). New: anatomically sane proportions (eyes 1/7 face width), 3-D head as an SDF/height-field baked into a G-buffer (depth, normal, material, AO) per race x mood, then relit per frame (key/fill/rim, wrapped SSS, GGX, grain) — GPU pass; CPU fallback relights the same G-buffer in a typed-array loop (cached, <= 320x400 on low). Expressions = blend of baked G-buffers; eyes/blink/mouth composited live. Per-race materials: human skin, Sakkra scales, Bulrathi fur, Klackon chitin, Psilon grey skin + large cranium, Meklar cyborg hard-surface, Silicoid crystal, Mrrshan fur/whiskers, Alkari feathers, Darlok cloak + shadow. Backdrop: dark practical-light bokeh | **XL** | post.js, gl.js | test-portraits.html | **HIGH** (uncanny valley, 10 race rigs) | bake+relight on GPU |
| `gfx/ships.js` (160 KB) | Replace painter with **procedural mesh hulls**: lofted cross-section spine + modules (boxes/wedges/cylinders), per-race grammar (angular military vs organic vs crystalline), mesh renderer with hard-surface fragment shader (panel lines, rivets, emissive windows, edge wear, AO), 24-32 yaw buckets baked to sprite atlases per (race, hull, banner, size bucket); CPU fallback = painter's-algorithm flat-shaded polygons with spec edge + panel-line decals; keep API (`draw/sprite/drawFleetMarker/HULLS`); drop decorative silhouettes (Alkari feathers become swept-wing + radiator fins) | **XL** | post.js (bloom for emissives) | test-ships.html | med-high (shape design per race) | bake on GPU, runtime blit |
| `gfx/planets.js` + `gfx/gl-planets.js` | Grading pass: -25 % saturation, ACES tone-map, physically-shaped limb scatter and terminator, ocean glint, thinner crisp rim, softer clouds with cloud shadows, city lights warmer/smaller; ring shadows; fix cartoon "white blob" clouds | M | post.js (optional) | test-planets.html, test-glplanets.html | low | already GPU |
| `gfx/space.js` + `gfx/gl-space.js` | Nebula: 2-hue grade, darker dust lanes, filaments, cap luminance 0.25 + saturation 55 %; stars: power-law magnitudes + blackbody tints, pastel not primary colours, diffraction spikes only on the brightest; vortex: reduce core blow-out via tone-map; title vortex = photographic galaxy | M | post.js | test-glspace.html, test-planets.html | low | already GPU |
| `gfx/fx.js` + `gfx/gl-fx.js` | Explosion 4-stage model with debris + shockwave refraction + light injection; beam HDR core + falloff; smoke multiply layer; missile plume/trail; tune all colours to HDR falloff; remove outlines/puffs | M-L | post.js | test-ships.html (fx lab), test-glspace.html | med | already GPU |
| `gfx/scenes.js` (290 KB) | Re-compose lab / council / newsroom / audience / surface / battle / endings with cinematography rules (3 depth layers, practical lights, haze), neutral graphite architecture with accent practicals, portraits v2 as foreground, grain+vignette via Post, replace ring/brass motifs; keep layout rects/API | **XL** | portraits v2, post.js, theme.js | test-scenes.html | med-high | backdrop + lights on GPU, characters via portraits |
| `gfx/icons.js` | New 1.5 px line set (101 icons, same names), `setStyle`, duotone accents | M | theme tokens | test-icons.html | low | — (SVG) |

### 3.2 UI modules (`js/ui/*.js`) and CSS

| File | What changes | Effort | Depends | Test page | Risk |
|---|---|---|---|---|---|
| `css/base.css` + `css/kit.css` (lead) | Merge `theme-v2.css` (promote tokens, remove brass literals, asymmetric cut `--poly`, new header/button/slider/table/tab/modal/tip/scrollbar rules); keep v1 behind `data-theme="v1"` for one release | M | codemod | `?screen=styleguide`, test-style2.html | low |
| `ui/kit.js` (lead) | `UI.panel` header markup (accent bar + sub), slider tick spans, `UI.icon` style switch, `UI.tabs` underline element, number-flash helper; Settings `theme`/`accent`/`fx` read at boot (`?theme=v2`) | S-M | — | styleguide | low |
| `ui/menu.js` (title) | Wordmark -> Oxanium 600 `ink-0`, thin accent rule, no gradient; buttons -> v2; background = GLSpace vortex graded + film grain; planet = GLPlanets limb-lit | M | space/planets grading | index.html | low |
| `ui/galaxy.js` + `ui/galaxymap.js` (150 KB) | Star glyphs: blackbody-tint point + thin 1 px cross + glare only when selected/hovered; nebula via graded backdrop; territories = 1 px contour + 6 % fill; fleet glyphs thin vector chevrons; reticle = corner brackets; range rings dashed 1 px; labels 12 px mono; HUD text >= 11.5 px; bottom bar = v2 buttons with mono hotkey chips; minimap with 1 px frame | L | theme.js, space | test-galaxymap.html, `?dev=1&screen=galaxy` | med (perf of map) |
| `ui/side-colony.js`, `ui/side-misc.js` | Planet card = lit sphere in a 1 px frame; sliders v2; stat cells mono; build box v2; fleet rows with ship sprites v2 | M | ships v2 | test-galaxymap.html | low |
| `ui/setup.js` (95 KB, incl. `UI.Controls`) | Wizard + race cards with portraits v2, rail summary, segmented controls restyled; `UI.Controls` switches/segments to v2 | M | portraits v2 | test-setup.html | low |
| `ui/design.js` (104 KB) | Live preview = ships v2 mesh with turntable + bloom; stat deltas mono; component pop-up tables v2; slot grid with line icons | L | ships v2, icons | (screen `design`) | med |
| `ui/tech.js` + `ui/techtree.js` | Field tabs v2; light-bulb gauge -> segmented bar; `TechArt` hologram = restrained cyan wire/blueprint (2 px lines, grid, no violet glow); scientist scenes via scenes v2 | M-L | scenes v2 | (screen `tech`) | low |
| `ui/races.js`, `ui/audience.js`, `ui/council.js`, `ui/spyscenes.js`, `ui/endings.js` | Portrait frames (thin steel + corner ticks), attitude bars (flat 17-step), treaty chips; scenes via scenes v2 | M each | portraits, scenes | test-diplomacy.html | med |
| `ui/gnn.js` (128 KB) | Anchor via portraits v2 in a graphite studio, lower-third + ticker + rankings in v2 type, graphics window with graded planets/ships, 2.39:1 letterbox optional | L | portraits, scenes | test-gnn.html | med |
| `ui/combat.js`, `ui/combat-fx.js` | Grid overlay 1 px, ships v2 with shadows, FX v2, command bar v2 with mono hotkeys, damage numbers mono | L | ships, fx | (screen `combat`) | med |
| `ui/landing.js`, `ui/system.js`, `ui/overview.js` | Surface/landing scenes via scenes v2; system view with lit planet + star granulation; map key swatches (square, no glow) | M each | scenes, planets | `?screen=landing&demo=invade` | low |
| `ui/ledger-planets.js`, `ui/ledger-fleets.js` | Tables v2 (mono numerals, tick sliders, accent selection); remove radial indigo/violet backgrounds (flat `bg-1`) | S-M each | kit v2 | `?screen=planets` | low |
| `ui/options.js`, `saveload.js`, `gamemenu.js`, `soundscape.js` | Settings: Theme (v1/v2), Accent, Effects (scanlines/grain), Reduce motion; menu v2; sound pairing map | S each | kit v2 | test-setup.html | low |
| `ui/styleguide.js` | Show v2 swatches/type/chrome | S | — | `?screen=styleguide` | low |

---

## 4. Migration mechanics (de-risking the 199 + 99 literals)

1. **Token remap first** (done in `theme-v2.css`): every `var(--brass…)`, `--ivory`, `--mist`, `--fog`, signal colours and fonts re-skin instantly under `data-theme="v2"` with zero JS edits.
2. **Codemod** `tools/codemod-theme.js` (to be written): `rgba(214,179,106,a)` -> `rgb(var(--edge-rgb) / a)` (v2 sets `--edge-rgb: 91 113 134`; v1 defines `214 179 106` in `:root`), hex brass literals -> tokens, `Marcellus` strings -> `Theme.font`. Run, diff, screenshot. ~300 edits, mechanical.
3. **Per-screen clean-up** removes ornament that survives the remap (radial indigo/violet backgrounds, text-shadow glows, gradient titles).
4. **Activation:** `?theme=v2` or `Settings.theme = 'v2'` sets `<html data-theme="v2">` before first paint (tiny inline script in `index.html`); `theme-v2.css` is appended to `manifest.css` after `kit.css` (inert unless the attribute is set). v2 becomes default after the acceptance checklist passes; v1 stays one release.

## 5. Implementation order and parallel split

Dependencies: tokens/Theme -> Post -> art modules -> scenes/screens -> QA/perf.

| Wave | Workstream (one agent each) | Owner files | Notes |
|---|---|---|---|
| 0 (lead, 0.5 d) | **A. Foundations**: merge theme into base/kit, `kit.js` tweaks, `Gfx.Theme`, codemod, settings (`theme/accent/fx`), fonts link (Oxanium + IBM Plex Mono) | lead-owned files | everything else consumes these tokens |
| 1 (parallel, 4-6 agents) | **B. Post/GL library** (gl.js chunks, post.js) · **C. Portraits v2** (spike S1 first) · **D. Ships v2** (spike S2 first) · **E. Planets/space grade** · **F. FX v2** · **I. Icons v2** | `gl.js`, `post.js`; `portraits.js`; `ships.js`; `planets/gl-planets/space/gl-space.js`; `fx/gl-fx.js`; `icons.js` | C and D are the long poles and highest risk — start them first; E/F/I are low risk fillers |
| 2 (parallel, 5 agents) | **G. Scenes + GNN** (needs C) · **H1. Galaxy/map/side panels/title** · **H2. Ledgers/design/tech/setup/options** (needs D, I) · **H3. Combat/landing/council/audience/endings** (needs D, F, G) · **J. Audio pairing** | per file list in 3.2 | H1/H2 can start in wave 1 on tokens alone |
| 3 | **K. QA + perf**: screenshot matrix, tier measurements on the iGPU, accessibility audit, remove v1 | tools/ | uses section 9 |

## 6. Performance budget (targets — to be verified; nothing here was measured)

Frame budget = `1000/min(animFps,60)` ms. "Ref iGPU" = Ryzen 780M / Iris Xe class; "weak iGPU" = 2-CU Raphael iGPU (the dev machine's second GPU, about 0.5 TFLOPs).

| Tier | UI chrome | Galaxy map | Portrait / scene | Ships (combat) | FX | Post | Bake budget | Texture RAM |
|---|---|---|---|---|---|---|---|---|
| **low** (no GL or weak iGPU, 30 fps) | pure CSS, no backdrop-filter, no overlay FX | baked backdrop, static twinkle, 2D star sprites | pre-relit bitmap (<= 320x400) + live eyes/mouth only; scenes baked once, light animation = 1 gradient | cached sprites 24 yaw, painter fallback | <= 600 particles, no refraction | vignette via CSS | <= 120 ms slices, workers | <= 150 MB |
| **medium** (60 fps, ref iGPU) | backdrop-filter on HUD overlays only | GL backdrop <= 24 Hz | GL relight pass <= 1.5 ms at 600x750; scene post = tone-map+vignette+grain fused (1 pass) | atlas sprites 32 yaw, <= 64 ships | <= 1,800 CPU or 40k GPU, bloom off, fake bloom | 1 fused pass | <= 80 ms slices | <= 300 MB |
| **high** (60 fps, strong iGPU/discrete) | + scanline/grain overlay | + parallax, glare | + bloom (5-mip), DoF backdrop, expression blends | live-lit GL for selected ship + atlas for others | <= 130k GPU, shockwave refraction | <= 4 passes | <= 50 ms | <= 600 MB |
| **ultra** (120-144 fps headroom) | all | dpr 2.5, volumetric cones | + CA, volumetric shafts, SSAO-lite | live-lit all <= 200 | 12k CPU / 400k GPU | <= 6 passes | idle-time | <= 1 GB (`HW.memoryGB` gated) |

Rules: GPU frame <= 8 ms at 1080p on ref iGPU for medium/high; main-thread JS <= 4 ms medium, <= 3 ms high; **no per-frame allocation**; any bake > 16 ms is time-sliced or goes to a worker/offscreen GL; the governor (`MOO.Perf`) may demote a tier live, so each effect must be switchable per frame (`Perf.q.bloom`, `q.glow`, `q.particles`). Add to `Perf.TIERS`: `post: 0|1|2|3`, `grain: bool`, `portraitRes: 0.5..1`, `shipLive: bool`, `chromeFx: bool`.

## 7. Prototype artefacts delivered

* `css/theme-v2.css` — complete chrome layer (tokens, legacy-token remap, panel, header, buttons, chips, bars, sliders, fields, tables, tabs, modal, tooltip, toast, scrollbars, focus, dividers, overlay FX, utility classes `.v2-label/.v2-led/.v2-glass/.v2-corners`, `data-accent`, `data-fx`). Opt-in: `<html data-theme="v2">`.
* `tools/test-style2.html` — v1/v2 toggle over real kit widgets (colour ramps, type scale, panel, buttons, chips, bars, five colony sliders, table, tabs, modal, tooltip, toasts, fields, icons if present, scroll region) and a CSS-only galaxy-HUD mock for composition review. Deep link `?theme=v1|v2&accent=cyan|amber|leaf&fx=on|off`.
* `tools/proto/` — **not created** (no art prototype was built; see 8).
* Verified in the browser (own tab, 1280x720): `test-style2.html` loads `base.css`, `kit.css`, `theme-v2.css`, `ns.js`, `util.js`, `icons.js`, `kit.js` with HTTP 200 and no page errors; `?theme=v1` renders the unchanged brass/serif look (proves the layer is inert without `data-theme="v2"`); v2 shows the neutral ramp, accent semantics, flat sliders with tick marks, mono numerals, single-cut panels with corner ticks and the HUD mock. Not verified: Firefox, 1920x1080, `file://`, the real game screens under `data-theme="v2"` (needs the `index.html` attribute hook and the web fonts).

## 8. What was analysed, what is expected to fail, and the spikes to run

**Approaches analysed (and verdicts from reading the code + screenshots, not from experiments):**

| Approach | Verdict |
|---|---|
| Keep the 2-D layered-gradient painter for portraits and "just add shadows" | **Rejected.** It is the current method; shadows cannot be derived from flat layers, so every face needs hand-placed shadow shapes (that is what makes it cartoonish) and the 10 races x 5 moods x 4 backdrops explode. |
| Height-field/normal-map relighting of a 2-D drawing | **Partial.** Cheap and works on CPU, but blobby (no occlusion), needs hand-authored height; usable only as the **low-tier fallback** of the G-buffer method. |
| Forward ray-marched SDF head per frame | **Rejected for runtime** (about 13k flops/pixel x 200k px; too heavy for iGPU at dpr 2) — but ideal for **baking** a G-buffer once. |
| **SDF-baked G-buffer + per-frame relight (chosen)** | Expected to work: bake depth/normal/material/AO once per race x mood (GPU, or CPU in workers at <= 320x400), relight per frame with key/fill/rim/SSS (about 1 ms), blend expression G-buffers for transitions; low-key cinematic lighting hides model imperfections (deep eye sockets, rim-lit jaw) — the known trick for believable faces from simple geometry. Risk: uncanny valley, so keep faces stylised-real (concept-art bust), never photoreal. |
| Real-time 3-D engine / meshes loaded from files | **Rejected** (no libs, no assets, file://). |
| CSS `filter`/`mix-blend-mode` tricks to de-saturate the current art | **Rejected as a fix** (helps saturation only; shapes/lighting unchanged) — but a global `filter: saturate(.8)` on backdrops is an acceptable stop-gap for planets/nebulae. |
| Ship = software 3-D mesh rasteriser (painter's algorithm) in Canvas2D | **Chosen as the CPU fallback**; GL mesh renderer for baking sprites; atlases at runtime. SDF hulls for ships were rejected: too many primitives for panel-line detail. |
| Pre-rendered PNG art | **Rejected** (original procedural art, offline, size). |

**Spikes (time-boxed, run first in wave 1; each has a pass criterion a reviewer can screenshot):**

| Spike | Time | Pass criterion | Fallback if it fails |
|---|---|---|---|
| **S1 portrait G-buffer** (human + Sakkra) | 1 day | At 600x750: reads as a lit 3-D bust with cast shadows (nose/brow/chin), no outlines, relight <= 1.5 ms on ref iGPU, CPU path <= 40 ms/frame at 320x400, blink + 3 visemes | 2.5-D "poster" style: heavily graded photo-less painterly bust with strong rim and low-key shadow shapes, still lit by one normal map |
| **S2 ship mesh** (one human frigate + one Alkari) | 1 day | 256 px sprite shows panel lines, emissive windows, cast self-shadow, 32-yaw atlas baked < 200 ms; CPU painter variant recognisably the same ship | Keep current sprites, apply panel-line + shadow decals and new silhouettes |
| **S3 post chain** (tone-map+bloom+grain+vignette fused) | 0.5 day | <= 1.2 ms at 1080p on ref iGPU (medium), visible HDR roll-off on explosion + star, text legibility unchanged | CSS-only vignette + noise tile |
| **S4 chrome** | done here | `test-style2.html` v2 vs v1 side by side; contrast numbers in 2.2 | — |
| **S5 icons** | 0.5 day | 12 icons at 16/24/48 px legible, stroke 1.5 px, same names | keep solid set, drop frames |

## 9. Acceptance checklist (screenshot-testable) and baseline capture script

**Baseline capture (do this before any implementation; 1280x720 and 1920x1080, own tab, `read_console_messages` clean):** `index.html`; `?dev=1&screen=galaxy&race=psilon&size=large&opp=4&seed=abc` (+ click a colony); `?screen=setup&step=0|1|2`; `?screen=design`; `?screen=tech`; `?screen=planets`; `?screen=fleets`; `?screen=races`; `tools/test-gnn.html` (click "Quiet turn"); `test-portraits.html`; `test-ships.html`; `test-scenes.html` (each scene); `test-planets.html`; `test-glplanets.html`; `test-glspace.html`; `test-icons.html`; `test-style2.html?theme=v1|v2`.

**Checklist:**
1. `grep -rE "214, ?179, ?106|#d6b36a|#f3dca0|#8a7040|Marcellus" css js` returns **0** (outside the v1 fallback block).
2. No `border-radius` > 2 px except dots/orbs; no `text-shadow` glow on titles; no `linear-gradient` text fills.
3. Text contrast >= 4.5:1 (>= 3:1 for large text and UI lines) on every screen — run the contrast audit page over computed styles; list failures = 0.
4. Saturation audit: UI chrome pixels mean HSV-S <= 0.35 (excluding semantic accent elements); accent-coloured pixels <= 8 % of the screen at rest.
5. Fonts: no serif anywhere; with the web fonts blocked the fallback stack renders without layout shift > 2 px (screenshot diff).
6. Title: wordmark flat `ink-0`, buttons v2, vortex core not clipped (max luminance < 250 on the core), planet with orange terminator.
7. Galaxy: stars are pastel blackbody tints; selection = bracket reticle; HUD text >= 11.5 px at 720p; nebula luminance <= 0.25 under any text.
8. Portraits (every race x 5 moods at 600x750): eye-line at 38-42 % height; visible cast shadow under nose/brow/chin; face luminance key:fill about 4-8:1 (measure the 5th/95th percentile on the face mask); no outline pass (silhouette gradient continuity); eyes <= 1/6 face width; no pure-white pixel; relight <= 1.5 ms (medium).
9. Ships (every race x 4 hulls at 256 px): panel lines visible, >= 1 emissive trim, self-shadow, banner colour on <= 2 stripes + engine tint only; no decorative feathers/wings; silhouette distinct per race at 48 px.
10. Planets/space: land saturation down >= 20 % vs baseline; terminator colour shift visible; stars >= 1 px points, only <= 20 halos per view.
11. FX: explosion shows flash, fireball ramp, debris, shockwave; no outline; additive HDR with roll-off (no solid white disc > 12 % of the radius).
12. Scenes/GNN: 3 depth layers; grain on; vignette 12-22 %; no ring/brass motifs; anchor and lab scientist use portraits v2.
13. Chrome: every kit widget in `test-style2.html` matches section 2.4; focus ring visible on all controls; motion <= 200 ms; `prefers-reduced-motion` honoured.
14. Perf: F3 overlay on the ref iGPU keeps medium >= 60 fps in galaxy, scenes and combat; tier demotion works; `?gpu=0` renders the same layouts with zero console errors; runs from `file://`; no network requests other than the optional fonts.
15. Accessibility: banner shapes/patterns present; colour never the only signal; reduce-motion disables grain/flicker/parallax.

## 10. Open questions for the product owner / lead

* Keep v1 selectable after v2 is default? (recommended: one release, behind Settings)
* Portrait realism ceiling: "stylised concept-art bust" (recommended) vs photoreal (not achievable procedurally within budget).
* Accent: cyan default (recommended; matches "research/focus") or amber (sodium-lamp mood). Both ship; amber is `data-accent="amber"`.
* Ship the Oxanium / IBM Plex Mono web fonts (optional, fall back to Bahnschrift/Consolas) or inline-subset them as base64 (+60 KB, fully offline)?
