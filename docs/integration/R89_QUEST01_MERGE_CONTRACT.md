# R89 → Quest 01: SHA-anchored integration contract

**Status:** PREPARED FOR REHEARSAL; NOT MERGED / NOT PRODUCTION APPROVED.

## Frozen inputs (2026-10-09)
- Responsive foundation: `arena/r89-gold-responsive-runtime` at `c941ecf0ad7df321265ac69d21a6e8493a49d567`, Chromium/source/dist shipping PASS.
- Typography/cleanup candidate: `arena/r89-font-parity-quest-merge-prep` (use HEAD from CI; do not infer it from this document).
- Quest snapshot: `quest/q4e-story-interludes-from-q4d` at `4af7cb1ef1f6580c5ce6e2fcbfc0575dd00185ff`. It is an actively changing branch. Fresh fetch and re-audit before any real merge.
- Historical common base for R89 and Q4E: `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc`.

## Ownership and mandatory non-overwrite
1. **Responsive owns:** outer Gold viewport family/fit, mobile entry, original native rollback, platform font-parity layer, the responsive Chromium suite. It must not rewrite Quest combat or authored Gold UI positions.
2. **Quest owns:** Quest director, multiple actors, E01 story/hold/scene/combat receipts, enemy/NPC actor state, real gameplay code. It must not replace the Gold viewport resolver or undo its two-finger and rotation behavior.
3. **Shared, manual-review files:** `public/gold/shell.html`, `public/gold/battle-hud.html`. Both branches modified these against the common base; never choose "ours"/"theirs" on these whole files. Retain the authored Gold generator and all accepted Quest actor/HP/name overlay rules.
4. **Protected baseline:** original Gold source/cutover provenance, `tools/buildGoldCutover.mjs`, production START and transition, native `?goldViewport=native` rollback, Quest's story authority and saved state.
5. **Keep deferred:** production deployment, auto-merge, story progress, arbitrary Gold CSS rewrites. Quest Q3v explicitly records broken tablet aesthetics despite previous green geometry CI; numerical PASS must not be presented as visual approval.

## Retired experimental code
- Stop importing R82 `homeLayoutLab` and R85 `shortPortraitPickRuntime` on game boot; remove both inactive runtime candidates and its CSS. The corresponding historical Git branches retain all recovery sources.
- Keep `mobileViewportAudit.js` (read-only opt-in audit), `bootStartViewportGuard.js` (live START safety), `shortPortraitPickSolver.js` (historical R85 gate dependency), and native Gold adapter tooling required for deterministic Gold build.
- Do not remove legacy-generated styling from `public/gold/shell.html` while a Quest branch modifies the same file. Its change requires canonical Gold source + cutover checks + owner visual approval, not blind CSS deletions.

## Rehearsal (never changes owner branches)
1. Checkout the integration branch with full history; fetch the exact Quest SHA. Inspect both SHA heads; fail with a "stale snapshot" warning if the Quest branch moved.
2. Compute merge-base and intersect changed paths to isolate conflicting files; use `git merge-tree --write-tree --messages` against immutable commits. Save an overlap/conflict report even if the tree is not clean.
3. If `public/gold/shell.html` or `public/gold/battle-hud.html` overlaps: reconcile those sections manually from three-way hunks. No default "ours"/"theirs". Keep Quest 3v4/HP/actor layers AND Gold layout rules.
4. On a separate throwaway combined tree, run Gold cutover check, R89 font+responsive tests including 375×667/667×375/1024×768 and mobile rotation, Quest Q0-Q4E suites, owner acceptance, build and *shipped-dist Chromium*. Investigate any new failures relative to either frozen parent.
5. Inspect real screenshots for tablet composition, NPC labels, home typography and skill targets; owner sign-off is required before any production merge. Do not weaken tests to obtain PASS.
6. Once Quest owner freezes a final SHA, regenerate this report/CI with that new SHA and rerun the rehearsal. No production or other branch write is authorized here.

## Rollback
At all times `?goldViewport=native` boots the direct native Gold game. The font parity change is isolated in `src/game/goldFontParity.css` mounted from `src/App.jsx` after the donor's styles. Revert that small module change independently if the typography geometry does not pass visual review; do not revert Quest features.


## First real three-way rehearsal receipt (2026-10-09)
- Rehearsal: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/37879331525
- Responsive snapshot: `fd3d87fd9fcf7f4a0b375bbd35f3510a9afa86ae`.
- Quest Q4E snapshot: `4af7cb1ef1f6580c5ce6e2fcbfc0575dd00185ff` (matches then-current remote HEAD).
- Common base `53cb5b48b14d24d2bcc596a3ca5e4a54704a44dc`.
- Shared edited paths are exactly `public/gold/shell.html` and `public/gold/battle-hud.html`.
- `git merge-tree` returned exit 1: **content conflict in `public/gold/shell.html` only**; `public/gold/battle-hud.html` auto-merged structurally. "CI success" refers to producing the correct conflict report, NOT an accepted merge.
- Cause to inspect first: each branch embeds the full donor Battle HUD as a large Base64 text payload under `<script id="battleHudPayload" type="text/plain">` inside Shell. R89's compiled HUD and Quest's actor-modified HUD both rewrote this payload. An ordinary source-line merge cannot safely select either encoded copy.
- **Reconciliation law:** Merge authored `battle-hud.html` first; inspect Quest 3v4 HP/identity and R89 responsive Gold rules. Then regenerate Shell's embedded `battleHudPayload` from that **exact merged Battle HUD byte sequence**, re-check its decoded equality, and restore all independent responsive Home/Pick CSS changes from R89 and Quest story/presentation changes from Q4E. Never treat the Base64 blob as a human-readable conflict to manually splice.
- Since Shell/HUD are Gold-generated artifacts, confirm the upstream adapter/cutover source produces exactly the merged output; otherwise `buildGoldCutover --check` or a later generation could erase the merge. A manual edit to generated Shell alone is NOT a durable integration.
- Before any combined-branch write, inspect the staged conflict markers and run a byte-for-byte decoded payload-to-HUD check. No merge to shared owner branches or production has happened.
