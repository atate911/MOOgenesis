# Fleet asset handoff for a building AI

Start with asset-catalog.json in this folder. Every PNG contains the same per-asset JSON in its PNG iTXt field named AssetMetadata, plus a neighboring .png.asset.json sidecar for tools that cannot read PNG metadata. Metadata tools and optimizers may strip PNG text chunks; retain the sidecars and catalog.

These are concept candidates, not approved final assets. Choose one design per class; do not treat alternate designs as extra gameplay unit classes. The revised set retains four original images. Stable asset IDs, candidate relationships and reuse links identify those cases.

Use intended_purpose and suggested_placements to decide where each asset belongs. Ships face right (+X); structures have no forward direction. All are intended for top-down 4X game views. PNGs are still images, not sprite animations or 3D models. Do not infer damage, build costs, movement rules or technology requirements from drawn details.

The color target is neutral grayscale with #FF00FF team livery and white-cyan engine or gate emission. Generated pixels are not an exact binary team-color mask. Inspect and build masks before recoloring. Requested ship lengths are 1 : 1.45 : 2.1 : 3 : 4.4; this ratio has NOT been normalized in these PNGs. For UI icons, fit visible bounds with consistent padding. For world sprites, apply the class length targets independently. Preserve aspect ratio and test at 48 and 64 pixels.

Review alpha edges, framing, hue compliance, camera consistency and structural symmetry before production. Intended requirements are not claims that every generated pixel satisfies them. Pixel hashes and dimensions record the actual files; adding metadata did not alter pixel data.

The full handoff includes three collections (27 file instances, with some reused designs), a comparison menu, generation prompts and file-purpose index. design-menu.html compares the revised and new collections; its relative references are preserved in the full handoff ZIP. Individual collection ZIPs omit this cross-collection menu when its dependencies are absent.


## Flat evaluation package
All files are in one directory. PNGs and sidecars use original--, revised--, or alternatives-- prefixes. Consult asset-catalog.json for the updated filenames. Catalogs and HTML previews refer only to files in this folder.
