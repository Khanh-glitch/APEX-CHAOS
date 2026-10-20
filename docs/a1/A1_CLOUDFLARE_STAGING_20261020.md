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

## Guest Magic Link handoff — acceptance update (staging build 4961a3d)

The owner completed a genuine email Magic Link sign-in in a new tab. Their Account Center screenshot showed an authenticated profile with **50 AC**, **NEWBOT+MAGNET**, and **1 draw**. These are the independent `APEX_ARSENAL_META` values on their device, NOT cloud-authoritative currency/ownership. Before this work, the staging backend had **one** new user/profile/wallet/ledger/starter ownership and zero `player_progress` or `guest_migrations`.

**Implemented in PR#98, staging-only:**
- `0004_a1_guest_migration_idempotency.sql` applied to APEX staging. Adds unique `(user_id, guest_profile_id)` index, prevents double pending-review migration rows on duplicate callbacks.
- `src/game/guestCloudHandoff.js` performs a fresh GoTrue `auth.getUser` verification, inserts lineage as `unverified:true` with PostgREST `ignoreDuplicates`, checks existing `player_progress`, then calls **CAS version 0** to create a snapshot only if absent. Existing Cloud snapshot is never overwritten on Magic Link return.
- `cloudAccount.js` remembers the user's **explicit SEND SIGN-IN LINK** request in same-origin localStorage for 30 minutes, bound to the guest ID and normalized email. On an authenticated same-origin return it attempts one automatic handoff in a deferred task with session epoch/account/online guards. No marker: no automatic transfer. The marker is cleared only after successful first backup or confirmed existing Cloud snapshot.
- Previously authenticated players can explicitly click **BACK UP GUEST PROGRESS** in Account Center once; this uses the same identity-verified, idempotent CAS0-only logic.
- The separate **UPDATE CLOUD SNAPSHOT** action remains an *explicit user action* and uses versioned optimistic CAS; both store unverified snapshots. Neither modifies Cloud wallet, ledger, reward claims or fighter ownership.
- A duplicate, stale sign-out or account switch cannot mint AC or apply a cloud wallet. Session status only reports `SAVED` after a successful CAS0 snapshot. An existing snapshot shows `CLOUD BACKUP EXISTS` rather than falsely claiming it was overwritten.

**Automated evidence:** `tools/testA1GuestHandoff.mjs` 6 deterministic negative/race checks PASS; `tools/testCloudLifecycleRaces.mjs` PASS; real hosted Supabase RLS/RPC negative tests PASS. Cloudflare run [39383095564](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39383095564) completed all steps SUCCESS. Deployment receipt at the staging alias equals `4961a3d8922056d2e09d68d38f90febf78b52224`. Browser validated signed-out Account Center and Magic Link button on the exact deployed SHA.

**Owner single-action manual gate (not yet executed):** Keep the currently logged-in browser and its device storage. Open https://a1-cloud-staging-20261020.apex-chaos.pages.dev/, click Home profile chip → Account Center → **BACK UP GUEST PROGRESS** once. Report the on-screen sync status without sharing Auth tokens or email codes. We will then compare staging table row counts (`player_progress`, `guest_migrations`) and confirm local 50 AC, MAGNET, and 1 draw remain unchanged. Running the button a second time should not create duplicate lineages nor silently overwrite the cloud snapshot. Do not rerun Magic Link or clear browser storage.

**Release locks:** The owner account's live backup is still unproven until the explicit click + backend inspection. Multi-device CAS concurrency, backend deletions, Google OAuth and cloud-authoritative AC receipts remain separate unpassed gates. PR stays DRAFT; production stays unchanged.
