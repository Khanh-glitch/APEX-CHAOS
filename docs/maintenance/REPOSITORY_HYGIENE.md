# Repository hygiene & source-of-truth policy

APEX CHAOS keeps one **shipping source tree** on `main`. Historical screenshots, one-off experiments, and retired CI pipelines do not need to remain in the default checkout to preserve project history.

## Archival snapshot

The complete pre-cleanup state is pinned at [`archive/main-before-hygiene-20261117`](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-before-hygiene-20261117), commit `5c72d8df7eb09492eafa0dcfaf7d17bf164c6168`. No historical commits were rewritten or force-pushed. Archived files can be recovered by checking out that branch or the associated commit.

## Changes in the cleanup

- Remove obsolete, branch-specific GitHub Actions workflows from `.github/workflows`. Retain the canonical R5 release acceptance pipeline and relevant product-regression gates. Old definitions remain recoverable through the archival branch.
- Remove the former top-level `evidence/` tree (historical owner/QA screenshots and receipts). Newly generated QA evidence belongs in expiring GitHub Actions artifacts.
- Move the retired `docs/acceptance/` and `docs/arsenal-quest/` collections out of the current tree (including screenshots, historical JSON receipts and obsolete test reports). Their complete content remains available in the archival branch; current release tests write fresh evidence to ignored `reports/` and GitHub Actions artifacts.
- Remove the obsolete root prototype ZIP and legacy one-off planning reports, leaving only files needed to build, develop, and document the game.
- Remove the tracked local `.env` copy; keep `.env.example` as a configuration template.

## Explicitly preserved

The following are not disposable evidence and must be reviewed individually before any future pruning:

- `docs/gold-ui/current/` and its manifests — **canonical Gold source** consumed by the shipping generator.
- `public/`, including `public/assets/`, `public/game/`, `public/gold/` — active game code, audio, fighters, maps, and render assets.
- `src/`, `gold-mission-account/`, `result-gold/` — production application and Gold UI.
- `masters/` — original audio/image masters now retained **only in the archival branch**; the current tree keeps shipping-ready assets under `public/assets/`.
- `docs/hero-rework/` — preserve written fighter contracts and approved Gold HTML sources; generated evidence exports are archived instead of shipped.
- `test-fixtures/`, `tools/`, `scripts/` — maintainers' regression suites and repeatable packaging tools.

## CI and release gates

Active source-of-truth gate: `.github/workflows/r5-five-arenas-source-acceptance.yml`.

```bash
pnpm install --frozen-lockfile
node scripts/check-arena-integration.mjs
node scripts/check-arena-boundaries.mjs
pnpm test:runtime-revision
node tools/buildGoldCutover.mjs --check
pnpm build
pnpm test:shipping-dist
```

The **entire compiled itch.io ZIP** should be exercised under a nested URL in Chromium before promotion, using `tools/testOwnerItchPackagedChrome.mjs`. Other feature-specific gates remain available under `tools/`.

A green scoped release gate is not proof that all inherited or historical tests pass. Any failing active gate must be investigated, not silently disabled.

## Future contributions

- Keep generated screenshots and benchmarking traces under ignored `reports/` or GitHub Actions artifacts instead of committing them to `main`.
- Add only versioned production assets or canonical source references under `public/` and `docs/`.
- Scope new workflows to current product paths or explicit maintenance branches. Avoid global PR triggers for retired experiments.
- Preserve an archival ref before a large cleanup. Delete obsolete files only from the new tree; do not rewrite existing Git history.

## R2 cleanup: archival evidence and one-off tools (November 17, 2026)

Snapshot before R2: [`archive/main-pre-source-hygiene-r2-20261117`](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-pre-source-hygiene-r2-20261117), commit `7fb53ae90b66ca3601ec762cfa56d9a47b30510c`.

A read-only inventory scanned 625 production/tool/workflow source files for exact references to 599 historical documentation artifacts. The result identified 131 standalone `tools/*.mjs/js/cjs` scripts with no inbound references from application code, other tooling, npm scripts, or active workflows. The R2 branch archives these one-off scripts **but does not delete the core build, packaging, QA or runtime modules that are called by the active toolchain**.

Archived from the R2 main checkout:
- Historic hero-rework visual/browser/evidence exports and obsolete ZIP packages. Original Gold HTML references and written gameplay/design authority documents remain.
- `docs/audit/` screenshot exports and the old Stormbreaker integration package.
- Unreferenced one-off tools and detached experimental test scripts; all are recoverable from the archive branch.

The operation does **not** modify game logic in `src/`, `public/game/`, `public/apexEngine.js`, any shipped asset under `public/assets/`, or audio masters. Any test needing an archived fixture must either reconstruct that fixture from its canonical source or explicitly identify it for restoration. A test is never disabled merely because its fixture was archived.

## Known open QA debt

See [issue #131](https://github.com/Khanh-glitch/APEX-CHAOS/issues/131) for inherited headless combat acceptance failures. Production HTML5/Chromium, runtime cache integrity, and localization have their own validated gates. The independent Arsenal Product Acceptance workflow remains active.

## Hard production-source prune — November 17, 2026

Full read-only snapshot: [`archive/main-pre-hard-source-prune-20261117`](https://github.com/Khanh-glitch/APEX-CHAOS/tree/archive/main-pre-hard-source-prune-20261117), commit `7ee38b58917dc3dbe30e560bccafb431826708ac`.

This pass used the actual `pnpm build` shipping graph as its authority. It archived all 121 unreferenced `masters/` files, all 611 public asset files that the production dist excludes, and documentation not required by the current source references. It retains Gold donor/source hashes, referenced fighter Gold HTML, production media, arena docs, and exact referenced test fixtures. No `src/`, game runtime JavaScript, build script, or shipping file was changed.

The archive is the recovery path for original media and excluded prototype assets. A future asset addition must be explicitly admitted into a production runtime and the shipping manifest, not merely re-added to `public/` without usage.

## Active toolchain sweep

Source scripts are rooted in the current GitHub Actions workflows, the local dev/build commands and their transitive relative imports. One-off tools not reachable from any active entrypoint are archived with the same pre-prune snapshot. Historical commands were also removed from `package.json`; they can be used by checking out the archival branch. The hard source prune deliberately keeps the current runtime lock, all active build/asset tooling, Gold patches and the browser-testing probe dependency.
