# CRYSTALA V1 — PRELOAD PACKAGE

This directory is the complete zero-attachment preload for the next Arena implementation pass.

## Mandatory implementation baseline
Before CRYSTALA implementation, fetch/fast-forward from remote and verify this owner-approved baseline is in ancestry:

- branch: `arena/01a0ead6-apex-chaos`
- baseline commit: `00d83e76d248c49ca65d8e546c67819d07a0d758`
- baseline runtime revision: `20260930-hunter-ownerfix-r1`

Do **not** go back to the preload SHA and do not rebase/cherry-pick the preload again. If the remote branch contains newer preparation commits, continue from the newest remote descendant; never move backward.

## Read order
1. `06_ONE_SHOT_RUNBOOK.md` — operational authority for unattended Arena execution
2. `00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md`
3. `01_OWNER_APPROVED_GOLD_REFERENCE.html` — run/read it in full
4. `02_GOLD_TO_GAME_ADAPTATION_MAP.md`
5. `03_IMPLEMENTATION_TEST_MATRIX.md`
6. `04_ZERO_CONTEXT_HANDOFF.md`
7. `05_PRELOAD_MANIFEST.json`

## Critical interpretation
- The Gold is executable **visual / asset / VFX / motion authority**. Do not redraw, simplify, or reinterpret it.
- The new production mechanic in 00 is **gameplay authority**. Do not port the Gold demo's old J/K/P gameplay semantics.
- Fit the new smart interception algorithm *inside* the Gold choreography; alter target selection/timing truth, not the approved look.
- Real APEX projectile, collision, HP, cooldown, ownership, movement and mitigation stay authoritative.
- Preserve the proven integration pattern used by Hunter: Gold module owns authored appearance/choreography; thin presentation adapter consumes real gameplay state/events.
- Preserve latest Chamber laws: one actor source render, FX outside silhouette source, equipped weapon single dispatch, no hue filter rewrite.

## Preload-stage safety
This preload commit is docs/reference only. It must not modify production files.

The implementation task may change the minimum Crystal/shared integration surface required by this authority. Direct Robot/Hunter/Chamber semantic edits remain protected; under unattended one-shot execution, do not make them without authority, but do NOT stop the whole task — finish all independent work and report any residual blocker only in the final report. See `06_ONE_SHOT_RUNBOOK.md`.

## Gold hash
Expected SHA-256 of `01_OWNER_APPROVED_GOLD_REFERENCE.html`:
`e5b90f78304cb8cf1fcdd0fd3e8c94069279040e2d3667050aee833446d65d30`
