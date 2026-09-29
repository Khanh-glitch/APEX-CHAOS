# CRYSTALA V1 — PRELOAD PACKAGE

This directory is the complete zero-attachment preload for the next Arena implementation pass.

## Read order
1. `00_CRYSTALA_IMPLEMENTATION_AUTHORITY.md`
2. `01_OWNER_APPROVED_GOLD_REFERENCE.html` — run/read it in full
3. `02_GOLD_TO_GAME_ADAPTATION_MAP.md`
4. `03_IMPLEMENTATION_TEST_MATRIX.md`
5. `04_ZERO_CONTEXT_HANDOFF.md`
6. `05_PRELOAD_MANIFEST.json`

## Critical interpretation
- The Gold is executable **visual / asset / VFX / motion authority**. Do not redraw, simplify, or reinterpret it.
- The new production mechanic in 00 is **gameplay authority**. Do not port the Gold demo's old J/K/P gameplay semantics.
- Fit the new smart interception algorithm *inside* the Gold choreography; alter target selection/timing truth, not the approved look.
- Real APEX projectile, collision, HP, cooldown, ownership, movement and mitigation stay authoritative.
- Preserve the proven integration pattern used by Hunter: Gold module owns authored appearance/choreography; thin presentation adapter consumes real gameplay state/events.
- Preserve latest Chamber laws: one actor source render, FX outside silhouette source, equipped weapon single dispatch, no hue filter rewrite.

## Preload-stage safety
This preload commit is docs/reference only. It must not modify production files.

The implementation task that starts after the owner sends the active prompt may change the minimum Crystal/shared integration surface required by this authority. Direct Robot/Hunter/Chamber semantic edits remain a stop/report condition.

## Gold hash
Expected SHA-256 of `01_OWNER_APPROVED_GOLD_REFERENCE.html`:
`e5b90f78304cb8cf1fcdd0fd3e8c94069279040e2d3667050aee833446d65d30`
