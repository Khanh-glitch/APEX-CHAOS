# CRYSTALA V1 — ONE-SHOT ARENA RUNBOOK

Date: 2026-09-30
Status: OWNER WORKFLOW AUTHORITY
Purpose: make a new/random Arena agent able to rebuild and finish CRYSTALA unattended without relying on chat memory.

## 0. One-shot contract
Assume the owner is absent for the entire run.

The task is NOT complete after:
- recovery;
- planning;
- a WIP commit;
- Checkpoint A;
- Checkpoint B;
- one failed unrelated regression suite.

Do not ask the owner a mid-run question. Do not pause for approval. Complete every authority-compliant and independently completable part, keep work durable on Git continuously, and give ONE final report only after exhausting the task.

If one protected/unrelated change is genuinely blocked, preserve protected semantics, finish everything else, and report that one blocker only in the final report.

## 1. Canonical source versus Arena session branch
Canonical source branch:
`origin/arena/01a0ead6-apex-chaos`

Mandatory gameplay-baseline ancestor:
`00d83e76d248c49ca65d8e546c67819d07a0d758`

Historical prep tip before this runbook:
`c1db7add515cae4c0ebcc3f8ce2618f5cf12634f`

Arena may start a new conversation on a different clean session branch such as `arena/01a0ee80-apex-chaos`. That is normal.

Do NOT switch branches merely to imitate the canonical branch name.

Instead:
1. keep the Arena-pinned current branch;
2. fetch the canonical source branch explicitly;
3. verify the mandatory baseline is in canonical-source ancestry;
4. if the current tree is clean and behind/unrelated only because Arena cloned `main`, anchor the CURRENT Arena branch to the fetched canonical source tip;
5. push the current Arena branch so all subsequent work is durable there.

Never mutate/force-push the canonical source branch from the implementation session unless the session is actually pinned to it.
Never reset backward to an old preload SHA.
Never rebase/cherry-pick the preload package again.

Use:
`node tools/preflightCrystalaOneShot.mjs --anchor --push-anchor`

The preflight refuses destructive anchoring when the tree is dirty and refuses remote anchor-push when the current branch is not an `arena/*` branch.

## 2. Known crash state
A previous CRYSTALA implementation session crashed before any implementation commit was pushed.

The lost files were not recoverable locally or remotely. Do not search mounts/reflogs/stashes/other branches again.

The lost session had reached roughly 77/77 gameplay gates and 11/11 Gold-parity gates, proving the frozen design is implementable, but none of that source survives. Rebuild from the Git authority package.

## 3. Known baseline CI condition
GitHub Actions run `36614313983` on prep commit `c1db7add515cae4c0ebcc3f8ce2618f5cf12634f` failed BEFORE any CRYSTALA implementation.

Failure step: broad headless Arsenal acceptance.

Observed terminal baseline error:
`Hunter V10 art failed: /assets/hero-rework/hunter-v10/clean/part-10.png`

The previous local session also encountered Hunter Gold/headless canvas/ImageData compatibility while diagnosing this baseline.

Treat this as a KNOWN PRE-EXISTING BASELINE HARNESS CONDITION:
- do not claim Crystal caused it;
- do not rewrite Hunter production semantics to make the broad headless harness pass;
- do not spend another long Hunter investigation;
- a tiny generic TEST-HARNESS-ONLY compatibility shim is acceptable only if clearly isolated and safe;
- otherwise record the unchanged baseline failure and continue all Crystal-specific tests, build/browser/evidence paths that can run independently.

Hunter is relevant only as owner-fix ancestry, presentation-architecture precedent, collision regression consumer, and protected behavior.

## 4. Authority read order
After preflight/anchor:
1. `README_PRELOAD.md`
2. this `06_ONE_SHOT_RUNBOOK.md`
3. `00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md`
4. `01_OWNER_APPROVED_GOLD_REFERENCE.html` in full
5. `02_GOLD_TO_GAME_ADAPTATION_MAP.md`
6. `03_IMPLEMENTATION_TEST_MATRIX.md`
7. `04_ZERO_CONTEXT_HANDOFF.md`
8. `05_PRELOAD_MANIFEST.json`

Verify the Gold SHA-256 before implementation. The preflight does this automatically.

## 5. Targeted live-code audit only
Audit what can materially affect this implementation:
- Crystal registry/config and old executors;
- J/K bridge;
- projectile collision/damage/crit/provenance;
- world-wall movement collision;
- Robot A1 high-speed displacement;
- Hunter authored displacement as a collision consumer;
- Hunter Gold/presentation as architecture precedent;
- Chamber actorRender/readability API;
- runtime manifest/revision gate;
- current relevant test harnesses.

Do not repeat a broad repository archaeology pass already encoded by these docs.

## 6. Durability law — stronger than semantic checkpoints
Arena can disappear at any moment. Remote Git is the durable memory.

Maximum unpushed substantive work:
- one coherent module; OR
- roughly 300–500 meaningful LOC; OR
- roughly 10–15 minutes of implementation.

Whichever comes first.

Before another large module, long test, browser capture, toolchain investigation or broad refactor:
1. inspect diff;
2. run the smallest relevant sanity check;
3. commit;
4. push;
5. verify remote SHA;
6. continue automatically.

WIP durability commits are expected. They do NOT mean a semantic checkpoint is complete.

Recommended cadence:
- WIP-A1: Crystal state/config/shard resource skeleton;
- WIP-A2: predictor/reservation/intercept/reflection;
- WIP-A3: Wall/Prison + J/K + physical collision;
- Checkpoint A: complete gameplay truth + deterministic gates;
- WIP-B1: Gold actor/shards/orbit;
- WIP-B2: Gold construct/refraction/dust/bloom;
- WIP-B3: production presentation adapter;
- Checkpoint B: Gold parity/browser integration;
- Checkpoint C: full integration/evidence/regression.

Never wait for owner input between these pushes.

## 7. Protected-system policy in unattended mode
Robot/Hunter/Chamber direct semantic edits remain protected.

If a desired Crystal behavior seems to require one:
1. try a Crystal-specific solution;
2. try the narrowest generic shared geometry/event hook that preserves existing semantics;
3. if still impossible, leave the protected behavior untouched;
4. finish all other independent CRYSTALA work;
5. list the exact remaining blocker in the final report.

A protected blocker is NOT permission to stop the whole run.

## 8. Gold versus gameplay
The executable Gold is visual/asset/VFX/motion authority, not demo gameplay authority.

Port its actual authored algorithms and identity. Fit new smart interception/construct semantics inside that choreography. Real APEX owns damage, HP, cooldown, collision, ownership, target truth, movement and lifecycle.

Do not substitute simplified circles/particles/sprites/straight lerps for approved Gold behavior.

## 9. Required owner-test prep
Preserve the one-time 12,000 Arsenal Credits owner-test grant already present in the canonical source lineage. It must top up once, then normal spending persists without perpetual refill.

## 10. Completion behavior
Checkpoint A/B/C are milestones, not conversation boundaries.

After each milestone:
- self-audit;
- commit/push/remote verify;
- immediately continue.

One unrelated baseline/harness failure must not halt other independent work.

Only return to the owner when all authority-compliant work is exhausted.

## 11. Final report
Report once, at the end:
- session branch and canonical source fetched;
- source SHA and proof mandatory baseline is in ancestry;
- all WIP and A/B/C SHAs;
- final remote tip;
- exact changed files;
- Crystal gate/parity/browser/build results;
- broad regression result with known baseline Hunter failure separated from new regressions;
- confirmation Robot/Hunter/Chamber protected semantics stayed intact;
- confirmation 12k one-time grant stayed intact;
- any truly incomplete item with exact technical reason.
