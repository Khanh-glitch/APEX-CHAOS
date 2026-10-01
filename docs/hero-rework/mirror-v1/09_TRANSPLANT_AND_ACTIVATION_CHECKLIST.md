# MIRROR V1 — TRANSPLANT + ACTIVATION CHECKLIST

Purpose: move this single portable preload commit onto the implementation that is currently running elsewhere, **after that implementation is finished**.

## A. Do not do this yet

At preload creation time the active implementation branch was `arena/01a0f736-apex-chaos`. This package was intentionally created on `mirror-v1-preload-20261001` instead.

Do not merge/cherry-pick this package back while the other implementation is still changing.

## B. When owner says the other implementation is finished

1. Identify its exact final remote branch + SHA.
2. Verify the commit is durable remotely and the expected implementation/tests are present.
3. Create the MIRROR implementation branch **from that exact final SHA**.
4. Cherry-pick the single MIRROR preload commit so history is:

```
<other implementation final SHA>
  -> <MIRROR preload commit>
  -> future MIRROR implementation commits
```

5. Do not merge the old staging branch history wholesale.

## C. Mandatory revalidation after transplant

Re-read/diff these surfaces against the new parent:
- `src/game/runtimeManifest.js` and runtime revision discipline;
- `public/game/hero-rework/heroRegistry.js`;
- `heroMechanicsRuntime.js`;
- `heroReworkRuntime.js`;
- AIL relocation/capability/scheduler semantics;
- projectile integration order for bullet/grenade/thrown melee;
- current Gold/presentation modules for Robot/Hunter/Crystala/Frost/Magnet;
- all protected/pinned-file rules introduced by the just-finished implementation;
- baseline test counts/failures.

Update only baseline-sensitive implementation instructions. Do not alter the canonical Mirror Gold or Gold-first mechanic law unless the owner explicitly changes it.

## D. Fresh active prompt

Only after C is complete, author a new active prompt that includes:
- exact new parent SHA;
- exact target branch;
- exact preload commit SHA;
- protected-file set from the new baseline;
- implementation slice order;
- tests/evidence required;
- explicit Gold-drift prohibitions;
- stop conditions.

Do **not** reuse a prewritten active prompt with stale paths/hashes/test counts.

## E. Portable-commit integrity

Before activation, prove the preload commit changes only:
`docs/hero-rework/mirror-v1/**`

If it touches production runtime/code, it is no longer a clean preload and must be corrected before activation.
