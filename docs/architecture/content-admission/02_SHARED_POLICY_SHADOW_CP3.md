# CP3 — Shared AIL Interaction Query, SHADOW phase

**Parent checkpoint:** CP1–CP2 (PR #31; 10/10 real-runtime baseline). Target branch based on `ba50f46294370c65a301b8b1b0c04d32b11660f6`; `main` must remain untouched.

## Implemented

- Add **one pure, read-only query API to the EXISTING `AIL.CapabilityAuthority`** in `public/game/hero-rework/ailRuntime.js`. No extra global runtime, new combat step or second damage path.
- Explicit injectable source context: `{config: APEX_ARSENAL_CONFIG, weapons: APEX_ARSENAL_WEAPONS, matchActive: true/false}`. AIL itself remains engine-agnostic.
- Query vocabulary:
  - `hero-object:<AIL existing action>`: delegates directly to canonical T6 `allows()`.
  - `magnet-projectile`: bullets and physical V43 kinds; mine flight phase; life and Crystala hold.
  - `magnet-revealed-slot`: revealed conventional ranged pickups only (not specials).
  - `frost-freezable-equipment`: ranged-category holder excluding grenade/T6; **intentionally different from Magnet pickup**.
  - `mirror-f2-projectile`: existing three projectile families, with detached thrown flight and T6 exclusion.
  - `v43-reflection-tag`: checks only registry `reflectableKinds`, **not** Crystal/Swirl geometry or actual contact authorization.
- Every query returns frozen `{status: 'allowed' | 'denied' | 'unresolved', reason}`. Unknown weapon/action, omitted context, or missing capability lists are explicitly `unresolved`.
- `tools/testInteractionPolicyShadow.mjs` compares query results against REAL currently shipping Magnet/Frost predicates across 41 weapon IDs, all eight V43 kinds, phase/hold/life permutations and AIL T6 law. It also locks the current Mirror family boundary and unknown-content rejection.

## Explicit NON-GOALS / safety law

1. **Shadow only**: production consumers continue to invoke their existing functions. Until CI evidence and owner decisions resolve the open design points, the new API MUST NOT adjudicate combat or mutate a projectile.
2. `v43-reflection-tag` is a *capability tag*, not final authorization: Crystal shard surfaces, Swirl Shield approach angles, hostility, wall TOI, reflection provenance and one-hit ownership remain their accepted executors.
3. Query returns `unresolved` for future content not registered in the current sources. This is a content admission blocker, not an automatic permission.
4. Do not unify `magnet-revealed-slot` and `frost-freezable-equipment` simply because both refer to 'guns'; their present contracts differ.
5. Do not expand Mirror F2 to `aq_v43`, change Magnet BOT AI, relax T6, or rewrite the two current projectile passes in this checkpoint.
6. The present `validateRegistry()` 12/36 and Core Six delivery gates remain untouched.

## Evidence/acceptance

- Run `node tools/testContentInteractionBaseline.mjs` (CP2).
- Run `node tools/testInteractionPolicyShadow.mjs` (CP3).
- Run protected current production gates separately (Arsenal Product Acceptance).
- Failure == semantic drift; investigate source mismatch before any gameplay change.
- Later CP3 migrations should be **one consumer at a time**, with shadow parity preserved in CI, then owner-controlled contact/TOI migration.

## Still requires a design decision before expanding behavior

- Whether Mirror F2 should accept specific V43 projectile kinds/states.
- Whether Magnet BOT must evaluate physical V43 projectiles as proactive cast opportunities.
- Whether new special pickups should participate in Magnet A1 floor attraction.
- Future contact priority among simultaneous interactions, using existing swept paths as proof rather than guessed code order.
