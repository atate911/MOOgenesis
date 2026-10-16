# Fleet designs — AI evaluation package

Everything is in this single folder. Start with asset-catalog.json for machine-readable intent and gallery.html for a visual overview. The three prefixes identify original, revised, and alternatives collections. There are 27 PNG files representing 23 unique images; four revised assets intentionally reuse original designs.

## Evaluation brief

Evaluate candidates for a top-down 4X space strategy game. Compare alternatives within each class and recommend one candidate per class, using its exact filename and asset_id. Prioritize distinct silhouettes and readability at 48 and 64 pixels, fleet style consistency, appropriate class role, clean alpha edges, and usable team-color areas. Separate observed strengths from requirements that still need fixes. Do not assume a candidate is production-ready because its metadata describes the intended style.

Intended requirements: neutral grayscale hulls, 15–20% magenta #FF00FF livery with value shading, white-cyan engine or gate emission, upper-left key lighting, flat top-down orthographic view, generous margins, and transparent PNG backgrounds. Mobile ships face right and target relative lengths 1 : 1.45 : 2.1 : 3 : 4.4. Structures have radial symmetry, no forward direction and no engines. Exact scale and color masks are not normalized. Revised square fortress is a deliberate silhouette alternative to the original circular-ring concept; flag that tradeoff when evaluating.

Read ASSET-HANDOFF.md for integration guidance. Each PNG contains embedded AssetMetadata JSON and has an adjacent .png.asset.json sidecar. Global and collection catalogs use filenames relative to this folder. Prompts document generation intent, not verified compliance. No gameplay statistics or distribution license are assigned.

Open gallery.html to see all candidates or design-menu.html to compare revised and fresh designs. These pages are local review aids, not game UI. If the evaluation service accepts only images, upload the PNGs plus this brief and asset-catalog.json when supported.
