# Cloudflare Pages deployment provenance — 2026-10-10

**Audit only. This document makes no deployment and changes no environment.**

## Repository workflow

- Source: `.github/workflows/cloudflare-pages-owner-preview.yml` at canonical V4.3 snapshot `05b491de4c30e2239ea27a2b98e6c2d9db3aee04`.
- GitHub **push** trigger: `fix/owner-v43-native-lifecycle-frost-result-20261010`, NOT `development/v43`, NOT PR #24's head and NOT `main`.
- The workflow targets existing Cloudflare Pages project `apex-chaos` using Wrangler's `--branch=owner-v43-fix-20261010`.
- Expected branch preview URL (from source): `https://owner-v43-fix-20261010.apex-chaos.pages.dev`.
- Source writes `dist/V43_OWNER_BUILD_SHA.txt` and should compare it against the triggering GitHub commit after deployment.
- The workflow requires the GitHub Actions secret `CLOUDFLARE_API_TOKEN`. Do not put its value into code, logs or this report.

## Verified run history

- The latest owner-preview run observed: https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/38028178949 (triggered by `f2f3507c0327c2f5ec7e9c6bb97ffbaed8b9c2dc`, 2026-10-10).
- This run **FAILED** at the credential verification step. Deployment and remote SHA verification were **SKIPPED**.
- We reviewed 139 GitHub Actions runs associated with that branch. All 29 runs named `Cloudflare Pages Owner Preview` had `failure` conclusions; zero succeeded in those retrieved runs.
- Web lookups were not able to verify live content for the expected Pages branch URL or the `ARSENAL_BUILD_SHA.txt` endpoint. That is **not** evidence the site is down; live deployment provenance remains UNKNOWN.
- The owner previously used Cloudflare Direct Upload; a separate/manual upload would not be proven by these GitHub workflow runs.

## Cleanup hold points

1. **Do not delete or repoint** `fix/owner-v43-native-lifecycle-frost-result-20261010` until the actual Cloudflare Pages project, deployments, branch mapping and custom domains are confirmed from the Cloudflare account/dashboard.
2. **Do not change** the workflow's `--project-name=apex-chaos`, Pages branch or credentials to test a deployment. It is an existing project with unknown production relationship.
3. Keep `main` untouched; default GitHub branch is not proof of the live production source.
4. Release/preview branches and dependencies are excluded from automatic branch pruning.
5. Confirm live deployment only from an independently verified URL plus current version file matching a known commit SHA.
6. Fix GitHub CI and replay actual Chrome gameplay independently of any deployment operation.

## Next verification

Read-only Cloudflare dashboard steps when connected: Workers & Pages → `apex-chaos` → Deployments, inspect production branch, latest build/upload commit, branch previews and custom domains. Check SHA files on the *actual* URLs before any deletion or production migration.

**NO BRANCH DELETION. NO CLOUDFLARE DEPLOY. NO CHANGE TO PRODUCTION.**
