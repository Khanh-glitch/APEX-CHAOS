# APEX CHAOS — BRANCH PRUNE SAFETY RUNBOOK

**Date:** 2026-09-25
**Repository:** `Khanh-glitch/APEX-CHAOS`
**Status:** PREPARED FOR MAJOR UPDATE AGENT

## 1. Safety baseline already established

Before this prune plan, the latest accepted Arena runtime was safely fast-forwarded to `main` without force.

Baseline:
`75c8879d83f03a33854b34b4d55e775d8027cce9`

At that point:
- `main` = baseline
- `arena/01a0cf5e-apex-chaos` = baseline
- `playtest/arsenal` remains preserved older deployment branch.

Fetch refs again before pruning.

## 2. KEEP

Always keep:
- `main`
- `arena/01a0cf5e-apex-chaos`
- `playtest/arsenal`

Also keep:
- `prototype/aftermath-32`

Reason:
Aftermath contains six unique 3v3 commits + standalone demo not in Arsenal/main.

## 3. PRUNE CANDIDATES

Delete after live verification:

### `asset-storage`
Superseded; current accepted runtime contains required assets.

### `bridge/game-assets-2026-09-25`
Temporary bridge/retry workflow branch only.

### `prototype/arsenal-quest`
Ancestor of current accepted Arsenal.

### `prototype/arsenal-v2-motion-ui`
Ancestor of later accepted Arsenal work.

### `repair/weapon-atlas`
Historical repair branch.
Current accepted runtime supersedes its runtime/test work.
Its repaired atlas PNG blob is already identical to current accepted PNG blob.
Do not merge it forward.

## 4. DELETE LAW

Before each remote deletion:
1. fetch remote;
2. verify `main` is baseline or descendant;
3. verify current Arena is baseline descendant;
4. exact branch-name match;
5. no wildcard deletion;
6. never delete main/Arena/playtest/Aftermath.

Delete one by one.

Afterward fetch branch list and report remaining refs.

Expected remaining:
- `main`
- `arena/01a0cf5e-apex-chaos`
- `playtest/arsenal`
- `prototype/aftermath-32`

If any candidate moved or gained new unique commits after this audit, stop and re-audit that branch.

Checkpoint:
**V3 REPO HYGIENE COMPLETE**
