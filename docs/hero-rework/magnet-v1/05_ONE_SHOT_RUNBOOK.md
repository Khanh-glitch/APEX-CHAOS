# MAGNET V1 — ONE-SHOT RUNBOOK

Status: implementation workflow authority.

## 0. One-shot behavior
Assume the owner may be absent during implementation.
Do not stop at ordinary checkpoints asking whether to continue.
Finish every independent authority-compliant slice, commit/push/verify it, self-audit, then continue.
Ask only for a true unresolved owner decision or protected-system blocker that cannot be avoided.

Do not call automated success "owner accepted".

## 1. Branch / source law
Implementation must remain on the Arena-assigned `arena/*` branch.
Never push implementation commits to `magnet-v1-preload-20261001`.
The preload branch is immutable input.

Before edits:
1. record current branch + HEAD;
2. preserve any legitimate local work;
3. fetch preload and main;
4. run `node tools/preflightMagnetOneShot.mjs`;
5. if safe, use `--anchor --push-anchor` to fasten the session branch to preload;
6. verify local HEAD == remote session-branch SHA;
7. verify Gold hash;
8. read package in README order.

## 2. Mandatory re-audit before coding
The preload has already been audited repeatedly, but the implementing Agent must still do four quick hostile passes:
A. branch/baseline/source identity;
B. latest Magnet gameplay vs live code;
C. Gold presentation vs demo-only semantics;
D. protected systems/Mirror/regression surfaces.
If a contradiction is found, fix the package/plan before production code.

Do not reread historical docs as higher authority than this package.

## 3. Implementation slices

### Slice A — gameplay truth first
Implement dedicated Magnet gameplay runtime and locked registry configuration.
No visual invention.
Prove:
- A1/A2 timing and exclusion;
- all-gun one-step physics;
- momentum/collisions;
- bullet bending;
- passive once-at-emission;
- T6;
- teardown;
- Magnet-vs-Magnet one-integration law.

Commit/push/remote-verify.

### Slice B — exact Gold asset bridge
Use ONLY canonical Gold.
Pre-bake immutable Reference-A parts/masks/material support.
Port Gold articulation and fixed-1/120 motion.
Do not port demo gameplay/hitboxes/floor/HUD/camera.
Do not use generic substitute geometry.

Commit/push/remote-verify.

### Slice C — thin presentation adapter
Drive Gold from real gameplay truth/events.
A1/A2 visual recovery separate from gameplay field.
Generalize A1 visual target selection to guns + influenced hostile bullets while preserving sparse Gold language.
Passive presentation follows real shot; never delays it.
Add render-state isolation.

Commit/push/remote-verify.

### Slice D — cross-hero / Mirror / evidence
Run directed interactions from test matrix.
Mirror ships in same batch but gameplay remains frozen.
Only make shared edits if mandatory and narrow.
Run browser evidence at real arena scale.
Run performance/lifecycle.
Run protected hero regressions, broad Arsenal suites and build.

Commit/push/remote-verify.

## 4. Agent anti-failure rules
- Never build on an unverified/wrong SHA.
- Never use a stale/alternate Gold because its internal label looks newer.
- Never treat generated-looking code as permission to hand-edit it without tracing its source.
- Never change gameplay to fit a visual prototype.
- Never change Gold identity to fit current code.
- Never add a global movement/autopilot shortcut.
- Never make a locomotion/contact test pass by pinning or zero-speeding the actor if the claim is real motion/contact.
- Never infer owner acceptance from CI.
- Never keep coding after push/auth verification fails.
- Never leave throwaway probes/reference copies/obsolete authority files in final tree.
- Never broaden a shared refactor because it is "cleaner."
- Never alter existing tests just to bless new behavior.
- Never report a PASS count from an earlier SHA after later edits.
- Never silently accept baseline failures: reproduce and classify them on the exact SHA.

## 5. Visual evidence law
Automated screenshots are diagnostics.
Real browser at actual battle scale is mandatory for:
- actor silhouette/scale;
- motion;
- A1 filaments/trajectory readability;
- A2 reactive field;
- no whole-scene corruption;
- no opponent scaling/flicker;
- no stale/detached trails;
- no double render;
- real gun artwork underneath effects.

Owner browser/playtest remains final visible acceptance.

## 6. Final cleanup
Before final report:
- delete temporary probes;
- remove duplicate/stale reference artifacts;
- remove commented abandoned implementations;
- ensure only one canonical Gold path;
- ensure runtime manifest/revision hashes are final;
- run tests on final SHA;
- commit/push;
- remote SHA verify;
- tree clean.

## 7. Final report
Return once with:
- session branch;
- preload tip and baseline ancestry;
- all durable checkpoint SHAs;
- final remote SHA;
- exact changed files;
- Gold hash proof;
- focused Magnet results;
- protected Hero/Mirror results;
- broad headless/browser/build results;
- browser evidence paths;
- any reproduced baseline-only failures clearly separated;
- explicit statement that owner visual acceptance is still pending until owner plays it.
