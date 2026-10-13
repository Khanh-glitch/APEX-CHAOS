# Weapon motion inventory — observational baseline (2026-10-13)

**Status: characterization only. NO visual/gameplay modification requested or made.**

The owner reports that weapon effects before the architecture refactor already looked acceptable. Gold is the **appearance** reference, not a reason to rebuild functioning effects. Future motion work must use the already-shipped renderer and its real attack lifecycle, not a second animation or damage clock.

## Existing authority and behavior

- `public/game/arsenal/arsenalWeaponRuntime.js` owns `POSE_RECIPES`, `FAMILY_POSE`, `poseKick`, `integratePose`, `equip`, `consume`, pose ghosts and V4.3 special launchers. Weapon pose does not rewrite the fighter body's movement.
- Older fixed guns have authored pose recipes; ordinary registry weapons can fall back to their **firing family**. All eight V4.3 devices have entries in `POSE_RECIPES`, but they largely share the same recoil spring/ghost choreography; this is **not proof** that each has a distinct 4-beat animation.
- `equip` creates the holder `READY`, triggers pickup feedback and an anticipation pose for explicit old weapons or supported firing families. The V4.3 special executor does **not** declare `def.family`; therefore the generic `FAMILY_ANTICIPATION[def.family]` fallback need not apply to these special weapons. This is a candidate explanation for a stiff pickup, not yet an approved bug fix.
- V4.3 `WINDUP` → actual `v43Spawn` → `FOLLOW_THROUGH` → `consume` uses real holder and pose. Each firing pulse calls `poseKick`. Boomerang has an intentional `IN_FLIGHT`/return exception, not a generic discard ghost.
- The current `shotsFired` and consumption lifecycle must not be labeled "reload" without first specifying a visual-only cocking/charging beat. There is no approval to introduce magazines, ammunition changes, new fire timing or owner-controlled firing.

## Owner-noted RPG-7 observation (not yet changed)

As of PR #43 `8cc8472e`: `RPG_7: { recoilPx:34, rotKick:0.20, returnTau:0.28 }`. This means a numeric recoil is **already present**. The owner perceives the firing motion as somewhat stiff; a larger number without examining the rendered motion, camera response, delayed exhaust/backblast and follow-through is not justified. Record a baseline capture in desktop/mobile before proposing any targeted enhancement.

## Future design proposal — **NOT activated**

Every weapon may eventually own `pickup/readiness → charge/cock/reload-like anticipation → actual shot/recoil → post-fire/exit`. For a single-shot weapon, "reload-like" is purely visual preparation, not a new gameplay reload. Motions should remain weapon-specific and parameterizable where possible. Limit any first spike to a distinct, approved weapon, and prove it does not alter projectile origin, TOI, shot cadence, damage, skill interactions, asset preload or dropped weapon ownership.

Do not create an independent animator that can lag behind the actual holder, change hit timing, or fabricate a duplicate weapon body. Avoid changing V4.3 Gold particles and motion solely to satisfy the unrelated 40-phase evidence-coverage workflow (0/40 verified does **not** mean 40 defective animations).

## New read-only regression

`node tools/testOwnerWeaponPoseLifecycleAudit.mjs` validates the existing eight V4.3 pose/exit contracts, five legacy pose recipes, and actual RPG firing `poseKick` synchronization. No runtime constants are modified; an audit failure means investigate, not auto-tune visuals.
