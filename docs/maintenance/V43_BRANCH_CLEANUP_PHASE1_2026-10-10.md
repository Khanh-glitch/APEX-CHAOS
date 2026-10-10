# APEX CHAOS — V4.3 repository cleanup, phase 1 (2026-10-10)

**Status:** staged as a Draft PR against development/v43; NO destructive changes executed.
**Production:** main and Cloudflare deployment are OUT OF SCOPE.

## Canonical current development snapshot

- development/v43 pins exact commit 05b491de4c30e2239ea27a2b98e6c2d9db3aee04.
- The original Draft PR #24 branch is still at this same commit and remains unchanged.
- main is the repository default but is **not** evidence of the newest production deployment.
- Only the HEAD copy of the V4.3 source is anchored. A Git ref is not production deployment provenance.

## Ref inventory

See docs/maintenance/V43_BRANCH_INVENTORY_2026-10-10.json. It pins SHA for **all 170 refs observed after adding two maintenance refs** (168 original + development/v43 + this cleanup branch), as well as head/base refs for the 10 open PRs.

Historical graph relationship to V4.3 before those two new refs:
- 131 of the original refs are ancestors (including main and numerous open-PR bases).
- 36 diverge and preserve work not contained in the canonical commit. **No automatic deletion.**
- 1 original ref was the V4.3 HEAD.

Current inventory classifies 120 as ancestor-review-candidate (not deletion-approved); 35 as diverged-preserve plus one divergent head of open PR #15; 11 as open-PR dependencies plus the PR #24 head separately; and one each for default, canonical and maintenance refs.

## What was observed and must be preserved

Open Draft PR chain: #16→#17→#18→#19→#20→#21→#22→#23→#24, and the separate Draft audit PR #15. These PRs have live head/base dependencies. Never mass-retarget, merge, close or delete their refs merely to lower branch count.

Examples of divergent work absent from the V4.3 canonical snapshot:
- docs/story-world-bible-20261001: four Story authority documents;
- audit/cp1-d032-truth-probes: two standalone CP1 probe scripts;
- prototype/aftermath-32: standalone 3v3 demonstration and tests;
- audit/cp2-d032-readiness-lifecycle: PR #15 and 15 unique commits.

Repository snapshot at the original V4.3 HEAD: 2,975 Git-tracked files, ~535 MB in blob sizes; 142 byte-identical blob groups; about 20.9 MB of duplicate *path copies*, NOT guaranteed Git object-store savings.

Do not classify test-fixtures/legacy-runtime, Gold references, masters/audio, or SFX final-lock ZIP as garbage: they are consumed or protected by current build/test provenance.

## CI status inherited from the exact canonical snapshot

- Arsenal Product Acceptance failed testRuntimeRevisionGate: four modified files in the prior Flame/Quest commit were not re-locked. This is **known CI debt**, not permission to disable the test.
- Gold Fidelity Certification is fail-closed: 7/7 source proofs passed, 0/40 full-phase motion/visual proofs certified. Do not downgrade or delete this gate.
- Resolve these in a separate runtime-integrity PR. This cleanup proposal changes no gameplay/runtime source.

## Dependency transition

This phase stages trigger expansion to allow existing Arsenal Product Acceptance, Quest B8 native acceptance, and V43 owner Chrome verification on development/v43 when updated. Keep old branch triggers until PR lineage is retired.

**IMPORTANT: Cloudflare preview workflow is not modified.** It deploys to a named Pages project and has a hardcoded preview branch. Changing its trigger or branch without owner deploy verification could modify a live external project.

PR #24 remains Draft with its old base; the *new* development/v43 is independent of the review-stack structure for all **future** changes. Do not retarget PR #24 to stale main (would create a misleading 1,861-commit diff).

## Safe deletion process (nothing deleted in this phase)

The planner tools/maintenance/v43-branch-cleanup.mjs works from a fully fetched local Git clone with GitHub CLI signed in:

    git fetch --all --prune
    node tools/maintenance/v43-branch-cleanup.mjs

Default mode is **read-only**. Every candidate must satisfy ALL:
1. Identified as an ancestor-review candidate in pinned audit.
2. Current GitHub SHA matches pinned SHA; no intervening work.
3. Current Git ancestry confirms branch HEAD is reachable from canonical V4.3.
4. Not a default, canonical, protected, PR head or PR base.
5. Name does not appear in workflow YAML on the checkout; all arena/* refs are blocked because acceptance currently has the arena/** wildcard trigger.
6. Any safety/, owner/, playtest/, backup/, archive/, preview/, production/, release/, checkpoint/ and hotfix/ namespace is excluded from bulk deletion.
7. External deployment, release references and rollback points are reviewed before apply.

Optional deletion mode REQUIRES a separate explicit operator command:

    node tools/maintenance/v43-branch-cleanup.mjs --apply --confirm=DELETE-VERIFIED-ANCESTORS --limit=5

This is **not run** by CI. Each batch is limited to at most 20, rechecks GitHub PRs, SHA and protection before individual deletion, and stops on drift/failure.

Deletion implementation uses GitHub CLI gh api -X DELETE (not available as a native action in the connected GitHub tool). Never bypass checks or run optional mode unattended. Divergent and open-PR refs remain untouched until preservation decisions.

## Subsequent phases

1. Repair runtime lock + cache/revision consistency in a separate PR; do not modify Gold 40-phase gate.
2. Verify deployed preview source and the actual Cloudflare branch mapping.
3. Execute and review fresh read-only deletion plan; preserve external dependency refs.
4. Remove unused one-off workflow files on a separate cleanup PR after branch/CI dependency review.
5. Delete verified ancestor refs in SHA-checked batches, verifying CI between batches.
6. Review 36 diverged tips, migrate useful work or retain named archival reference before deletion.
7. Keep main untouched until explicit production migration decision.

**Never rewrite old Git history, never force-push, never treat branch-count reduction as proof of code quality.**
