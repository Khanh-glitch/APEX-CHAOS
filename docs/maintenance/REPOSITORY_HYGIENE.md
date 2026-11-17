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
- `masters/` — source audio and image provenance required for reproducibility.
- `docs/hero-rework/` — hero research, original references, and golden artifacts; some tests depend on them.
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
