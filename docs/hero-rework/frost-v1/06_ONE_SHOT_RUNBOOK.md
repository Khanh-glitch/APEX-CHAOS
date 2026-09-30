# FROST V1 — ONE-SHOT ARENA RUNBOOK

Date: 2026-09-30
Status: OWNER WORKFLOW AUTHORITY

## 0. One-shot contract

Assume the owner may be absent during the run.

Do not stop after planning, a WIP commit, or one unrelated baseline failure.
Complete every authority-compliant independent part and return one final implementation report.

Do not ask mid-run questions for issues already resolved in this package.
If a true protected-system blocker remains, leave protected semantics intact, finish everything else, and report the residual blocker at the end.

## 1. Source and branch law

Reference project truth:
arena/01a0f1e7-apex-chaos @ 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae

Preload source:
director/frost-v1-preload-20260930

The implementation chat must stay on its Arena-assigned session branch.
Never push implementation commits to the reference or preload branch.

At start:
1. record current Arena branch and HEAD;
2. verify working tree clean or preserve local work;
3. fetch director/frost-v1-preload-20260930 and origin/main explicitly;
4. verify 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae is an ancestor of preload tip;
5. verify the preload differs from baseline only by Frost docs/reference/support tooling;
6. verify Gold hash;
7. before any hard anchor, prove current HEAD is already represented by preload ancestry OR is a clean disposable ancestor of fetched origin/main; otherwise REFUSE destructive reset and preserve/reconcile the branch first;
8. anchor only a proven-safe clean Arena session branch forward to the preload tip;
9. push that session branch and remote-verify before implementation;
10. run an explicit remote-auth heartbeat on the Arena session branch before the first production edit.

The support preflight script performs the source/auth checks and optional safe anchoring. After anchoring, use `tools/frostGitDurabilityCheckpoint.mjs --push` for durable checkpoints.

## 2. Read fully before coding

Read in package order:
- README_PRELOAD.md
- this runbook
- 00_FROST_IMPLEMENTATION_AUTHORITY.md
- 01_OWNER_APPROVED_GOLD_REFERENCE.html
- 02_GOLD_TO_GAME_ADAPTATION_MAP.md
- 03_IMPLEMENTATION_TEST_MATRIX.md
- 04_ZERO_CONTEXT_HANDOFF.md
- 05_PRELOAD_MANIFEST.json
- 08_PRELOAD_HOSTILE_AUDIT.md
- 07_ACTIVE_AGENT_TASK_FROST_V1.md

Then inspect current live source at the anchored tip:
- heroRegistry.js
- heroMechanicsRuntime.js
- heroReworkRuntime.js
- arsenalWeaponRuntime.js
- arsenalSpawnRuntime.js
- arsenalShellSelectRuntime.js / meta identity surfaces
- iceVisualRuntime.js
- apexEngine collision/movement/status path
- runtime manifest and relevant test gates.

Also read the current protected Hero reports/gates for CRYSTALA V2, ROBOT and HUNTER before touching any shared surface.

## 3. Authority interpretation

Do not port old ICE.
Do not port Gold demo controls/AI.
Do not invent progression/SFX.

Gameplay doc owns gameplay.
Gold owns presentation.
APEX baseline owns physics/inventory/damage.

## 4. Implementation strategy

Recommended coherent slices, not mandatory internal file organization:

A. identity + registry + old ICE cutover
- storage ICE -> product FROST
- frost.* mechanics
- Lv1 configs
- deferred progression shim
- save/UI alias tests.

B. shared Frozen Floor + A1
- real near->far floor support
- speed law
- Frozen floor slot metadata/pickup gating/thaw
- Gold A1 adapter.

C. Frozen Gun + projectile semantics + passive
- holder frozen metadata
- semantic shot/blast group ids
- deterministic 8% hit roll
- 0.90 Freeze / refresh / thaw lock
- Gold bullet/shell adapter
- legacy ICE visual suppression.

D. A2
- native-inertia Hunt state
- actual-path trail
- contact Cold Shock
- exact holder transfer
- transfer presentation.

E. evidence/hardening
- lifecycle/perf
- regression
- build/browser/parity
- final diff audit/revision/hash.

You may reorganize internals if the result is smaller/safer, but not change semantics.

## 5. Shared-hook rule

Before changing shared Arsenal/engine:
- prove Frost-local code cannot cleanly express the required semantic;
- make the narrowest no-op-when-Frost-absent hook;
- add regression tests around both Frost behavior and baseline non-Frost behavior.

Expected legitimate narrow hooks:
- exact holder transfer without fresh equip/consume;
- pickup slot eligibility / frozen metadata handoff;
- shot/blast grouping id;
- Frost-specific resolved floor modifier;
- semantic suppression of old ICE presentation for Frost.

Do not use this list as permission to rewrite shared runtime.

## 6. Durability / Git-token expiry law

Remote Git is durable memory. Arena local disk is NOT durable memory.

The historical failure being prevented is:
local implementation -> Git credential/token expires -> work continues locally -> Arena workspace is recycled -> unpushed history disappears.

### 6.1 Bound the unpushed window

Maximum substantive work without a remote-verified checkpoint is the FIRST of:
- one small coherent file/slice;
- about 150–250 meaningful LOC;
- about 5 minutes.

Do not accumulate an entire feature/module before pushing.

Before every long browser/test/toolchain run, and before starting the next implementation slice:
1. inspect diff;
2. run the smallest relevant sanity;
3. commit current coherent work;
4. run `node tools/frostGitDurabilityCheckpoint.mjs --push`;
5. continue only after it reports local HEAD == remote session-branch SHA.

The helper records the last verified remote SHA under `.git/` for recovery bookkeeping.

### 6.2 Authentication heartbeat

A successful push earlier in the run is not proof that the token is still valid.

Use `node tools/frostGitDurabilityCheckpoint.mjs --probe`:
- before a long test/browser/perf phase when no new commit needs pushing;
- after any suspicious Git/auth/network error;
- before beginning a large shared-runtime edit.

### 6.3 Auth/push failure protocol

If fetch/ls-remote/push/remote verification fails:
1. STOP substantive implementation immediately. Do not keep coding "until auth comes back".
2. Do not reset, rebase, amend away, or discard local history.
3. If there is coherent uncommitted work, make a local WIP commit if possible.
4. Run `node tools/frostGitDurabilityCheckpoint.mjs --recover`.
5. Record local HEAD, last known remote-verified SHA, and emitted recovery bundle/patch paths.
6. Attempt only Arena-supported credential/session refresh/recovery.
7. Resume implementation ONLY after `--push` succeeds and remote SHA exactly matches local HEAD.

A local recovery bundle/patch is a SECONDARY safety net only. If the Arena workspace itself disappears, local recovery files can disappear with it. Therefore the primary protection is the ~5 minute remote-checkpoint cadence.

### 6.4 No false durability claims

A local commit is NOT called durable.
A successful `git push` without remote SHA verification is NOT called durable.
Only a remote-verified session-branch SHA is a durability checkpoint.

WIP durability commits are expected and are not owner approval gates.

## 7. Testing honesty

Do not satisfy movement/contact tests using __hrHoldBody, zero baseSpeed, fake direct coordinate jumps, or synthetic calls that bypass the actual event being claimed.

Use direct unit probes only for local pure logic; pair them with real production-path integration gates.

A/B unrelated failures against 6b83fc6502eb8e23e4bd122074fc7fdfb47441ae.
Do not edit Hunter/Robot/Crystala semantics to make a broad harness green.

## 8. Gold bridge

Keep exact Gold reference immutable.
Do not load/parse the whole reference HTML during normal gameplay.
Extract/bridge actual authored assets/algorithms into production runtime.
Cache immutable data.
Gold parity must be observed at normal battle scale on light-gray/real arena.

## 9. No SFX pass

Do not spend task time sourcing, downloading, mixing, or adding Frost-specific audio.

## 10. Finish

Before final:
- audit 00 authority line-by-line against implementation;
- audit 03 gates;
- inspect final diff for protected-system drift;
- run focused/regression/build/browser/parity/perf evidence;
- bump runtime revision and relock hashes only once the implementation tree is final;
- push final commit and verify remote tip.

Report:
- Arena session branch;
- preload tip and baseline ancestry;
- WIP/final SHAs;
- changed files;
- focused Frost gate results;
- protected regression results;
- browser/parity/perf results;
- known baseline/environment failures separately;
- confirmation SFX and Lv2-Lv5 were not invented;
- exact remaining owner-playtest items.
