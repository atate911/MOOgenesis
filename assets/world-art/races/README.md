# MOOgenesis artwork library

60 generated PNG images for Master of Orion — Reborn, informed by the [MOOgenesis repository](https://github.com/atate911/MOOgenesis), the supplied art brief, and its approved race portraits. Open `index.html` to browse and filter the collection locally.

## Contents

Each of the ten races has six images: Human, Mrrshan, Silicoid, Sakkra, Psilon, Alkari, Klackon, Bulrathi, Meklar, and Darlok. This includes the 50 core assets and ten square homeworld companions. Optional advisors, expression variants, and warships are outside this package.

| Filename suffix | Intended purpose |
| --- | --- |
| `audience` | Diplomacy room background; composite the existing leader separately |
| `scientist` | Research scene featuring a scientist distinct from the leader |
| `figure` | Full-body leader for race selection and other character displays |
| `homeworld` | Landscape homeworld view from orbit |
| `council` | Seated leader portrait for a council delegate card |
| `homeworld-square` | Square companion for a homeworld card or tile |

Names follow `race-<race_id>-<purpose_id>.png`, for example `race-human-audience.png`. A JSON file with the same base name accompanies every image.

## Instructions for an AI integrating these assets

Read `asset-manifest.json` first. Select assets by `race_id` and `purpose_id`; use `filename` as the exact file reference. Read `intended_screens`, `asset_role`, `composition`, `compositing_notes`, `recommended_fit`, and `overlay_safe_fractions` before choosing placement. Safe regions are intended layout guides, not measured guarantees of text contrast.

Each PNG contains a UTF-8 JSON record in the `MOOgenesis.asset` iTXt field. This record matches its JSON sidecar and manifest entry. Generic Title, Description, and Keywords fields are also embedded. Some image processors strip metadata, and an AI viewing pixels alone may not read it, so retain the manifest and sidecars alongside the images.

`suggested_integration_entry_points` lists candidate modules found in the repository inventory. Inspect their current interfaces before implementing placement. The assets have not been installed or connected to the game's rendering code. Generated status is recorded as awaiting user review.

## Dimensions and compositing

Original generated pixel data is preserved. The generator returned these native dimensions:

| Images | Actual dimensions |
| --- | --- |
| 29 landscape images | 1672 × 941 |
| Meklar audience background | 1672 × 940 |
| 20 square images | 1254 × 1254 |
| 10 full-body figures | 1024 × 1536 |

Landscape files are below the requested 1920 × 1080. Full-body figures meet the brief's 1024 × 1536 minimum but not its preferred 2048 × 3072 size. Each metadata record distinguishes actual dimensions from requested dimensions. Avoid stretching images to a different aspect ratio.

All PNGs have opaque backgrounds. Full-body figures use dark neutral backgrounds; they require a separate cutout pass if the game needs true transparency. Review text readability, crop, and character scale in the final interface.

## Provenance and validation

`generation-prompts.json` records the generation prompts and reference information. The manifest also retains this information for each asset. Images were generated with the built-in ImageGen tool.

`validation-report.json` records file hashes and checks: six purposes for each race, valid PNG chunk checksums, matching embedded/sidecar/manifest metadata, and unchanged compressed pixel data compared with the generated originals.
