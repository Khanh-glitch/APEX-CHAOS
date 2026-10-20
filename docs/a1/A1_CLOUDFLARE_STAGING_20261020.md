# A1.2 — Cloudflare Pages + Supabase staging acceptance (2026-10-20)

## Verdict: staging infrastructure PASS / real Auth A1.2 still PARTIAL

- **Cloudflare Pages staging:** https://a1-cloud-staging-20261020.apex-chaos.pages.dev/
- **Staging SHA receipt:** https://a1-cloud-staging-20261020.apex-chaos.pages.dev/A1_STAGING_BUILD_SHA.txt
- **Latest verified runtime:** `6ea7c9856eb41711a3a05ef39bada54fad7af8b0`, from isolated GitHub branch `infra/a1-staging-rpc-grants-20261020`.
- **Actual workflow PASS:** [A1 Cloudflare Staging Preview run 39379273878](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39379273878). Build, Cloudflare credential, independent Pages branch deploy, Auth/RLS/RPC negative tests and live SHA receipt all PASS.
- **Production:** https://apex-chaos.pages.dev/ unchanged; previous independently read production receipt `c7a04f0b57f08093a783fa6080b536b9754c83a8`.
- **Staging backend:** `pqnhyucmziucjqbxmtbc`, Singapore (https://supabase.com/dashboard/project/pqnhyucmziucjqbxmtbc).
- **Wallet issuance:** `public.app_config.cloud_wallet_enabled=false`, intentionally disabled until server-validated match receipts exist.
- **GitHub PR:** #98 remains draft. No production merge, migration or deploy approved.

## Database and security receipts

Applied to **APEX staging only**, in order:

1. `a1_0001_player_accounts` from `0001_a1_player_accounts.sql`.
2. `a1_0002_security_closeout` from `0002_a1_security_closeout.sql`.
3. `a1_0003_restrict_rpc_execute_grants` from `0003_a1_restrict_rpc_execute_grants.sql`.

All ten A1 public tables have RLS enabled. `PUBLIC`/anonymous EXECUTE privileges on SECURITY DEFINER RPCs were inadvertently inherited from Supabase/Postgres defaults after 0001/0002; migration 0003 revokes these and restores the five intentional authenticated RPC grants. Verified in SQL: zero anonymous-executable public functions.

A real SQL transaction created two temporary mock Auth identities, tested bootstrap (350 AC + `ROBOT` + starter ledger), isolated wallets/ownership/progress with `SET LOCAL ROLE authenticated`, successful CAS updates, stale CAS denial, and pending-only deletion request. Rolled back: staging Auth user count returned to zero. This verifies database behavior with simulated claims; **not** a real hosted Auth sign-in or real concurrent-device test.

A repeatable live HTTP smoke script (`tools/testA1StagingAuthHttp.mjs`) runs **after every isolated staging deploy** through `.github/workflows/a1-cloudflare-staging.yml`. It verified:
- Hosted GoTrue `/auth/v1/health`: HTTP 200.
- Hosted `/auth/v1/settings`: email enabled, Google disabled, email confirmation required.
- Anonymous reads of wallets, account_roles, player_progress and app_config return empty.
- Anonymous reward, purchase, draw, deletion and CAS RPC requests are denied (HTTP 401/403, `42501`).
- No test users or mutations.

Security Advisor has two informational deny-by-default RLS/no-policy notices (`app_config`, `audit_events`), plus five signed-in callable SECURITY DEFINER RPC notices requiring real authorized-user testing; this alone does not demonstrate a bypass.

## Real browser UX acceptance

Live browser at staging confirmed `window.APEX_CLOUD_ACCOUNT.isCloudConfigured() === true`, admin authority false for Guest, and an Account Center opened from Home profile chip:
- Guest displays 350 AC and NEWBOT only; 7 other released heroes locked.
- Sync status: `SIGNED OUT`, not `CLOUD NOT CONFIGURED`.
- Email address field and SEND CODE enabled.
- Google provider is **disabled in hosted Supabase**. To avoid a misleading working-looking button, `isGoogleSignInEnabled()` requires explicit `VITE_APEX_GOOGLE_AUTH_ENABLED=1`; current staging build sets 0. Browser verified disabled Google button and honest Email OTP hint. No provider bypass.
- `account-profile` navigation route stays owner-LOCKED; Account Center profile-chip entry works.

No email was sent and no OAuth flow was completed during this QA.

## Actual remaining owner action — Auth URL Configuration

The connected Supabase project tools can read database schemas and run migrations, but **cannot configure hosted Auth Site URL, redirect allowlist, or Google provider credentials**. An independent browser visit to that Dashboard page redirected to Supabase sign-in; no authenticated owner Dashboard session is available to this agent. Therefore, do not claim Auth redirects are configured.

Open **staging** (never MathPath or production):
https://supabase.com/dashboard/project/pqnhyucmziucjqbxmtbc/auth/url-configuration

Set:
- **Site URL:** `https://a1-cloud-staging-20261020.apex-chaos.pages.dev/`
- **Additional Redirect URLs:** `https://a1-cloud-staging-20261020.apex-chaos.pages.dev/`

Save changes. This precisely matches the `window.location.origin + '/'` used by `signInWithEmailOtp` and `signInWithGoogle`. Do **not** add a wildcard including production domains and do **not** switch the staging Supabase project to a production URL. Review the hosted email template to ensure `{{ .RedirectTo }}` or equivalent is honored for email links.

Google OAuth remains deferred: before enabling its provider, configure a Google OAuth client in the **staging Supabase** Authentication providers page with the correct Supabase callback URI, then set `VITE_APEX_GOOGLE_AUTH_ENABLED=1` on staging only and rerun CI. OAuth credentials never belong in frontend bundles or repository files.

## Still UNPROVEN — release locks

- Sending/receiving a real Email OTP, verifying code, browser session restore and sign-out.
- A second real signed-in identity; inter-user read/write isolation and two genuine device sessions racing on CAS.
- Operator-created cloud admin role, server-verified admin activation and revocation across logout/offline.
- Cloud user deletion backend job (the current RPC only marks a pending request).
- Authoritative match receipts and **cloud wallet issuance** (must remain disabled).
- Account Center owner visual sign-off and the `account-profile` navigation route.
- Production cloud feature rollout, main-branch merge or deployment.

**Do not mark A1.2 complete, enable cloud wallet, or merge/deploy production merely because this staging workflow passes.**
