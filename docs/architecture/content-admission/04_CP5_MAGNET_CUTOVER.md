# CP5.1 — First production consumer: Magnet projectile eligibility

**Baseline:** `main@2590beee79b9447fa3639870b6de6801428b7f42`
**Cutover branch:** `arena/content-interaction-cp5-magnet-cutover-20261012`
**Status:** candidate only; do NOT merge until all headless, browser and production-acceptance gates pass.

## Exact implementation scope

- `AIL.CapabilityAuthority.query` is now a **read-only** capability query on the existing AIL singleton. Its semantics are copied from the CP3 shadow candidate.
- `APEX_MAGNET.isEligibleBullet(p)` is the **only gameplay consumer** switched to this query. No changes to Magnet motion, field strength, body forces, ability windows, AI cast choice, projectile ownership, hit ordering, damage or visual effects.
- Unregistered projectile kinds fail closed. The existing Magnet predicate remains strictly as fallback for isolated compatibility tests which load Magnet without the AIL script.
- Quest pools, Core Six roster/art, Crystal, Frost, Mirror, Swirl Shield and T6 physical-hit semantics remain unchanged.

## Cache and runtime-lock authority

Cutover revision is `20261012-content-interaction-cp5-01`. The runtime manifest and runtime gate share this new value. `tools/runtimeRevision.lock.json` has the accepted hashes of **all** existing active versioned scripts, with new SHA-256 only for AIL and Magnet. The lock is not bypassed and no old revision URL is reused for changed bytes.

## Regression evidence and rollback

`tools/testContentPolicyProductionParity.mjs` boots the actual game and compares the live AIL query, the actual Magnet predicate and the *original pre-cutover formula* across all baseline equipment IDs, V43 kinds, flight/armed/spent phases, active/expired, held/unheld, and unregistered IDs. Existing CP2/CP3/CP4 plus the full Arsenal Product Acceptance and Chrome must also pass.

If any drift is detected, roll back **the entire CP5 branch**, not an isolated runtime file, so the revision and lock remain consistent. Production `main` is unchanged by this branch.

## Limitations / next controlled checkpoints

The shared query does **not** yet decide actual collisions. CP5.2 should migrate one additional consumer and validate real geometry, contact ownership, damage receipts, effects and teardown before continuing. CP5.3 is the separate extension-safe production hero-registry 12/36 migration, which must preserve Core Six public availability, progression and art. A new hero's public launch or any new special-weapon physics still requires explicit owner approval.
