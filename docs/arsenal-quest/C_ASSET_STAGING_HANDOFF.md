# CHECKPOINT C — IN-REPO ASSET STAGING HANDOFF

Status: READY FOR IMPLEMENTATION  
Updated: 2026-09-24  
Game branch: `arena/01a0cf5e-apex-chaos`  
Asset source snapshot imported from private vault: `d0809fdd0079bedc41dcb6ffb033a2574c3d5be1`

The implementing Agent no longer needs to work in, clone, or mutate the private asset vault.

All curated redistributable source material required for the Checkpoint C rebuild is staged inside this game repository under:

`tools/arsenal-assets/source/`

These are **source inputs**, not final runtime files.

Final runtime derivatives belong under:

`public/assets/arsenal/...`

## Imported groups

### Gun family
`tools/arsenal-assets/source/guns/senko-v9/`

12 high-value Senko candidates spanning:
- Pistol
- SMG
- Shotgun
- Sniper / long gun

Use the strongest per-role source that satisfies the final rendered result.
Do not force every class into the same silhouette or accent placement.

### Grenade / projectile donors
`tools/arsenal-assets/source/projectile-grenade/kay-cc0/`

Contains:
- default / alternate grenade donors
- small / medium / large cartridge donors

Rules:
- Kay grenade is a donor, not the final canonical grenade.
- Loaded cartridges are donors, not final spent casings.
- Derive a proper spent-casing silhouette.
- Primary bullet read remains high-speed tracer/streak.

### Particle / contact VFX
`tools/arsenal-assets/source/vfx/kenney/`

Curated muzzle/smoke/spark candidates.
Kenney license file is included locally and is CC0.

### Muzzle flash
`tools/arsenal-assets/source/vfx/16-toon-muzzle-flash/`

Curated CC0 muzzle-flash variants.

### Explosion
`tools/arsenal-assets/source/vfx/explosion-2/`

Four Sinestesia CC0 explosion sheets.

## Melee / shield source boundary

The private vault's multi-resolution medieval equipment pack was intentionally **not copied** into this public repository because its exact source/license provenance is unresolved.

Do not bypass this by copying it from the private vault.

For production melee/defense work, use the already researched known sources in:
`docs/arsenal-quest/C1_FREE_2D_ASSET_SHORTLIST.md`

Specifically:
- RGSDev CC0 melee vector source/workflow;
- Kutejnikov CC0 axes;
- CraftPix shield candidates only within its published royalty-free usage terms;
- bespoke authoring/reprocessing when that produces a better final result.

This is not permission for random asset hunting. It is a fixed known-source set.

## Implementation workflow

1. Inspect the in-repo sources.
2. Select/reprocess/author the best production solution within the locked visual language.
3. Write final runtime-ready assets to `public/assets/arsenal/...`.
4. Update runtime manifest/provenance.
5. Integrate and run the actual game.
6. Inspect browser output.
7. Iterate until the full Checkpoint C definition of done passes.

Do not runtime-load anything from `tools/arsenal-assets/source/`.

## Authority order

1. `docs/arsenal-quest/C_FULL_REBUILD_EXECUTION_CONTRACT.md`
2. Issue #8 owner-feedback checklist
3. `docs/arsenal-quest/C1_ASSET_AUDIT.md`
4. `docs/arsenal-quest/C1_STYLE_PROOF_PLAN.md`
5. This staging handoff

The next owner-facing playable handoff remains the **complete Checkpoint C rebuild**, not a partial demo.
