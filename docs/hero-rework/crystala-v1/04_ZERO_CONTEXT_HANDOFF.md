# CRYSTALA V1 — ZERO-CONTEXT ARENA HANDOFF

Read this AFTER the README, authority, Gold, adaptation map and test matrix.

## Mission
Implement the approved Crystala Gold into real CRYSTAL and replace the old Crystal gameplay with the K-Awakening / J-context-construct law. Complete the task in one Arena conversation if possible, but checkpoint/push aggressively so a crash loses little.

## Working model / Arena lessons
- Every new Arena chat may be a different model. Never trust previous local state.
- First inspect branch/status/HEAD and fetch remote.
- Do not switch branches simply to match an old handoff. Arena may pin the session branch.
- Git remote checkpoints are durability; local progress is not.
- Implement -> focused gates -> diff audit -> commit -> push -> remote verify BEFORE expensive evidence capture.
- Do not rerun/rebuild already-pushed checkpoints after a crash unless a gate proves it necessary.
- Do not modify unrelated systems just because they are nearby.
- If a Gold visual exists, port it faithfully; do not use a generic substitute and call it parity.

## Live facts audited before preload
At preload audit, HEAD was `148ab872e0f8ba31eb0cedc658bdfac715f846d3`; re-audit fresh HEAD because it may advance.

Important live facts:
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

## Stop/report only if
- package ancestry is incompatible and would require destructive history;
- a required fix truly demands direct Robot/Hunter/Chamber semantic edits instead of a generic shared hook;
- current architecture materially invalidates an owner decision.

Ordinary complexity is not a stop condition.

## Final report
Give owner:
- current branch;
- A/B/C commit SHAs;
- exact changed files per checkpoint;
- test counts and browser evidence paths;
- production build result;
- any authority deviation (should be none unless explicitly approved);
- remote verification.
