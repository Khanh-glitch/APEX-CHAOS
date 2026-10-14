# CP11 — extension safety hardening (checkpoint, 2026-10-14)

## Anchors and non-negotiable ownership

- Base: CP10 exact HEAD `fddabf315971c97c520044e04b6460ea58ade850`, PR #75.
- Implementation: CP11 isolated draft PR #76, stacked on the CP10 branch.
- NO merge to `main`, NO production release or revision/cache cutover without owner approval.
- Arsenal alone owns projectiles, pickup, HP, collision, damage and detonation.
- Hero Rework / AIL alone own ability authorization, target selection, status and the match scheduler.
- Gold skin renderers may only receive bounded presentation snapshots; they cannot create a new gameplay timeline or executor.
- Existing Gold textures, motion, recoil, geometry, aim and skill values are NOT redesigned in this phase.

## Root cause and permanent barrier

CP8 actor-only Gold registration passed a valid actor render smoke while omitting world VFX.
CP10 restored those missing render hooks but had no complete owner-reviewed registry
of mandatory family membership. Therefore **having a callback** was confused with
**having all callbacks required by the owner reference**.

CP11: `goldVisualContract.js` rejects an owner-Gold registration if its audited
required pass or event-family declaration is invalid. The two current owner Gold
packs explicitly declare **8 passes and 15 reviewed visual families**. The
independent `testGoldVisualContracts.mjs` pins the accepted family inventory,
checks its actual event producer + renderer consumer + Chrome proof, and contains
negative registration tests. The pre-existing real Chrome Gold family paint
suite remains mandatory.

Caveat: `ownerReference` names the supplied Gold reference but is not a
machine-proof that every pixel in every animation frame matches the standalone.
Native lifecycle, matched-frame visual review and real-device performance are
separate acceptance gates.

## Readiness

`cosmeticAuthority.ready()` and `productAssetRuntime.preparePresentations()`
must reject a provider that returns false, including a resolved Promise.
The shared image loader must not report `READY` when `decode()` rejects.
A failed operation must be retryable; overlapping requests must deduplicate.
The `testPresentationReadinessHardening.mjs` verifies negative and recovery
cases, including intentional per-scope cancellation semantics.

## Staged backlog: prevent an architecture rewrite

1. **P1 Contract admission:** enforce owner Gold visual family inventories; run
   negative tests and real Chrome desktop/Android.
2. **P1 Readiness:** preserve working providers, use fail-closed status and
   retriable decode failures. Update only the edited runtime's SHA lock.
3. **P1 Robot event bridge:** eliminate the custom AIL `bus.emit` interceptor
   only after confirming the standard `bus.on('*')` subscriber preserves real
   A1 lock, release, timing and audio. Do NOT simultaneously remove the
   weapon-socket/draw/step shims; tackle each with its own parity proof.
4. **P1 Native A1:** assert real revealed slot ID, native RobotA1Lock, native
   renderer target location and no phantom lock after slot loss. A painter-only
   target fixture is not sufficient.
5. **P2 Performance + scene handoff:** repeat Android match/reload and collect
   frame-time, memory and asset decode spans on representative hardware. A
   synthetic 48-hero/320-weapon metadata test is NOT a device FPS benchmark.
6. **Separate release candidate:** re-key runtime URL cache revision, manifest,
   all SHA locks and Gold generated URLs atomically, with cold/return browser
   proof and owner authorization. Never silently relabel CP8 caches here.

## Rollback and STOP rules

- Keep commits individually reversible; compare each candidate with immutable
  CP10 base and verify no gameplay / asset texture files changed.
- A failing clean-room, specialist or Chrome test is a STOP: inspect logs,
  identify fixture-vs-runtime ownership, fix the root cause, rerun on exact SHA.
- Never pass a test by lowering visual thresholds, skipping a Gold family,
  making damage cosmetic, teleporting a projectile, or increasing a timeout
  without evidence.
- No launch, Ready-for-Review or merge before exact-HEAD CI, owner Gold visual
  playtest and a reviewed release/caching plan.
