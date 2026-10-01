# CRYSTALA V1 — ZERO-CONTEXT ARENA HANDOFF

Read this AFTER the README, authority, Gold, adaptation map and test matrix.

## Mission
Implement the approved Crystala Gold into real CRYSTAL and replace the old Crystal gameplay with the K-Awakening / J-context-construct law. This is an unattended ONE-SHOT task: do not pause for owner approval or return an intermediate report. Follow `06_ONE_SHOT_RUNBOOK.md`, push every meaningful slice, and continue through A/B/C until all independently completable work is exhausted.

## Working model / Arena lessons
- Every new Arena chat may be a different model. Never trust previous local state.
- First inspect branch/status/HEAD and fetch remote.
- Do not switch branches simply to match an old handoff. Arena may pin the session branch.
- Git remote checkpoints are durability; local progress is not.
- Strong durability law: no more than one coherent module, ~300–500 meaningful LOC, or ~10–15 minutes of substantive work may remain unpushed.
- Implement slice -> smallest relevant gate -> diff audit -> commit -> push -> remote verify BEFORE another large slice, long test, browser capture or investigation.
- Do not rerun/rebuild already-pushed checkpoints after a crash unless a gate proves it necessary.
- Do not modify unrelated systems just because they are nearby.
- If a Gold visual exists, port it faithfully; do not use a generic substitute and call it parity.

## Mandatory implementation baseline
CRYSTALA must start from the Hunter-ownerfix lineage:

- branch: `arena/01a0ead6-apex-chaos`
- gameplay baseline: `00d83e76d248c49ca65d8e546c67819d07a0d758`
- baseline runtime revision: `20260930-hunter-ownerfix-r1`

At the start of a new Arena chat, fetch remote and fast-forward forward to the newest `origin/arena/01a0ead6-apex-chaos` descendant containing `00d83e76d248c49ca65d8e546c67819d07a0d758`. Verify the baseline is an ancestor before implementing.

Never checkout/reset back to the preload SHA, never rebase onto it, and never cherry-pick the preload package again.

If handoff/docs or owner-test-credit prep have advanced the branch beyond `00d83e76d248c49ca65d8e546c67819d07a0d758`, continue from the newest remote descendant. The baseline remains the Hunter owner-fix commit, not the older preload history.

Important live facts at the baseline:
- old Crystal kit still exists in registry/mechanics/body-reflect path;
- J for rework fighters already direct-casts A1 and bypasses legacy gate buffering;
- K direct input already exists in the rework runtime;
- **DO NOT add duplicate KeyK or legacy pressK**;
- Robot A1 high-speed movement can bypass existing Crystal world-wall logic unless generic anti-tunnelling is closed;
- Hunter already has a wall-aware custom movement helper, useful as evidence but not a file to rewrite;
- Chamber actorRender/readability is current and protected.

## Architecture precedent
Study current Hunter Gold + Hunter presentation + Chamber API before writing:
- executable Gold becomes authored visual module;
- presentation is a thin adapter consuming real mechanics;
- gameplay never reads fake presentation timers as truth;
- real status/events drive Gold;
- one expensive actor source render;
- FX and status stay outside actor silhouette;
- weapon single-dispatch stays Arsenal-owned.

Use the same separation for Crystala.

## Preferred implementation shape
Names may vary only if current code strongly requires it:
- `public/game/hero-rework/crystalaGoldV6.js`
- `public/game/hero-rework/crystalaPresentationRuntime.js`
- narrow Crystal registry/mechanics updates
- minimal shared hero-rework projectile/world/movement truth hooks
- manifest wiring
- Crystal-specific deterministic/capture tools

## Checkpoint A — gameplay truth
Implement:
- frozen numbers;
- six semantic shard states;
- K smart predictor/reachability;
- J context selection;
- Passive-only reflected multiplier;
- one-reflection law;
- real Wall/Prison HP/lifetimes;
- physical gaps;
- anti-tunnelling shared geometry;
- deterministic tests.

Then diff-review, commit, push, remote-verify SHA.

## Checkpoint B — Gold
Port exact procedural art/motion/VFX algorithms from executable Gold. Adapt target-selection semantics to real mechanics WITHOUT redesigning appearance. Bind events/state through presentation adapter. Prove focused real-browser parity and Chamber render integrity.

Then diff-review, commit, push, remote-verify SHA.

## Checkpoint C — real integration
Run required Crystal-vs-Robot matrix, regression suites, build/cache gates, telemetry/evidence. Fix real bugs only; do not casually retune authority numbers. Final diff audit, commit, push, remote verify.

## Unattended blocker policy
Do not stop for an owner response. If one protected/unrelated semantic edit is genuinely required, leave that protected behavior unchanged, finish every other independent part, and list the exact blocker only in the final report. If one harness/regression path is broken by a documented pre-existing baseline condition, continue all other independent validation. Ordinary complexity is never a stop condition.

Known baseline condition: GitHub Actions run `36614313983` on prep commit `c1db7add515cae4c0ebcc3f8ce2618f5cf12634f` already failed in broad headless testing on Hunter V10 Gold art loading before any CRYSTALA implementation. Do not spend the task rewriting Hunter to cure this baseline harness failure; see `06_ONE_SHOT_RUNBOOK.md`.

## Final report
Give owner:
- current branch;
- A/B/C commit SHAs;
- exact changed files per checkpoint;
- test counts and browser evidence paths;
- production build result;
- any authority deviation (should be none unless explicitly approved);
- remote verification.
