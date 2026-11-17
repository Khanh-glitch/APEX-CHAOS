# APEX CHAOS — Arena collision & visual cleanup

## Symptoms
- P1/P2 could reach the outside edge of the imported arena and appear glued to decorative rails.
- Visual-only legacy skid scars and large Sanctuary X decoration appeared as unrelated lines on the floor.

## Root cause
- The imported stage geometry visually locates the playable wall **inside** the 1000 × 1000 game canvas; the receiving `Fighter.resolveWalls()` still collided with the outer canvas boundary (x/y=0 or 1000). The arena wall feedback was generated at a *different* location again (46 units from edge).
- The adapter speed boost and the Cryo gust could write locations directly using still another clamp, after the normal fighter wall step.
- The `stampSkid` adapter converted a non-gameplay skid into an accumulating straight scar. The Sanctum floor drew a large permanent diagonal X for ley channels.

## Patch
- One source of truth for the Free Battle wall inset (`getWallInset() = 76` world units). Applies only while eligible Free Battle is active. Quest, legacy and other modes retain their old 0..1000 wall behavior.
- `Fighter.resolveWalls()` now reflects inward when a *body radius* touches the stage's visible inside wall; preserves wall impact combat callbacks, damage, reflect behavior. A minimal tangent avoids repeated corner contacts.
- Original stage wall VFX feedback and Cryo gust clamp use the same inset. Adapter also bounds hazard pushes and speed-boost displacement after effects.
- Omit the noninteractive BEYOND skid scar and the giant *decorative* Sanctum diagonal strokes. Preserve Prism diagonal-zone speed/sync mechanics and represent their positions using small glyph dots rather than long lines. Preserve bullets, lasers, VFX, hazard telegraphs, and the five arena modules.

## Checks run
`npm run verify:arena`
- Existing integration guard verifies 5 stages, single visible canvas, Gold HUD composition, source arena physics.
- New edge regression: both fighters; seven positions including all sides/corners; repeated frames show rebound and exit from wall; Quest & ineligible mode remain unchanged; post-hazard projection; original Prism diagonal mechanic remains.
- Node syntax validation of modified JavaScript passes.

## Limits
This is a Vite source ZIP. Full production build cannot be verified here without npm dependencies. Chromium isolated canvas capture was attempted but timed out in the environment. Other *intentional* combat lines, such as bullet trails and lasers, are not removed. The source ZIP still has upstream missing art assets referenced by its asset-recovery setup.

## Deploy
Source deployment platform: `npm ci` -> `npm run verify:arena` -> `npm run build` -> serve `dist/`.
