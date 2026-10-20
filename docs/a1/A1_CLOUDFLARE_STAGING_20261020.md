# A1.2 Cloudflare Pages staging — execution record (2026-10-20)

## Isolation contract

- APEX CHAOS production remains `https://apex-chaos.pages.dev/`. **Never publish the staging build to the default Cloudflare Pages production branch.**
- Independent staging branch alias planned: `https://a1-cloud-staging-20261020.apex-chaos.pages.dev/`. This URL is **not verified live** until the SHA receipt check succeeds.
- Cloudflare project: `apex-chaos`; account ID comes from the existing Cloudflare owner-preview workflow.
- Supabase staging is `pqnhyucmziucjqbxmtbc` (Singapore): `https://supabase.com/dashboard/project/pqnhyucmziucjqbxmtbc`.
- The staging build uses **only a Supabase publishable key** through `VITE_SUPABASE_ANON_KEY`; no Supabase service-role/secret key may enter client bundles or GitHub artifacts.
- Production must not acquire the A1 staging `VITE_*` values.
- Cloud wallet remains disabled: `public.app_config['cloud_wallet_enabled'] = false`. Browser-side match completion is not authoritative.

## Database migrations already applied to staging

1. `a1_0001_player_accounts` from `0001_a1_player_accounts.sql`.
2. `a1_0002_security_closeout` from `0002_a1_security_closeout.sql`.
3. `a1_0003_restrict_rpc_execute_grants` from `0003_a1_restrict_rpc_execute_grants.sql` (tracked in this PR).

Security advisor initially found 7 anonymous-executable SECURITY DEFINER RPCs despite explicit authenticated grants, because PostgreSQL/Supabase supplies implicit EXECUTE privileges. Migration 0003 revokes implicit PUBLIC/anon EXECUTE and allows the five intentional signed-in RPCs only. Verified from actual live catalog: 0 anonymous executable functions in `public`; RLS is enabled on all 10 A1 public tables; 0 Auth users.

Two RLS-with-no-policy INFO notices on `app_config` and `audit_events` are deny-by-default. The five authenticated-callable SECURITY DEFINER RPC notices warrant explicit server authorization verification; they are not an invitation to disable all client calls.

## Verification already executed (staging, nonproduction)

- Real SQL transaction inserted **two temporary Auth identities** and verified bootstrap: each starts with 350 AC, `ROBOT` ownership, a single starter ledger entry.
- Within that transaction, a simulated JWT claim + `SET LOCAL ROLE authenticated` checked row-level restrictions: users cannot read each other's wallets, fighter ownership or progress.
- The actual CAS RPC succeeded at versions 0→1 and 1→2 and rejected stale expectations, preserving the newer row.
- The deletion request RPC returned `pending` and did not erase the wallet.
- SQL `ROLLBACK` completed; the final live query showed zero Auth users. These are RLS/SQL checks with simulated claims, **not hosted Auth login or two real connected sessions**.
- Live public REST with the staging publishable key: `GET /rest/v1/wallets` and `account_roles` returned empty; anonymous `claim_match_reward` and `save_progress_snapshot_cas` were denied with HTTP 401/`42501`.
- Live Auth API `/auth/v1/health` returned HTTP 200; `/auth/v1/settings` reported email enabled, **Google disabled**, sign-ups enabled and email confirmation required.

## Cloudflare Pages staging deployment

Workflow: `.github/workflows/a1-cloudflare-staging.yml`, restricted to branch `infra/a1-staging-rpc-grants-20261020` and its separate Pages alias. It builds the production artifact with staging Supabase `VITE_*`, embeds `A1_STAGING_BUILD_SHA.txt`, and confirms the remote SHA. It never deploys the Pages production branch. GitHub Actions job can fail closed without deploying.

**External owner prerequisite:** The existing GitHub Actions Cloudflare secret `CLOUDFLARE_API_TOKEN` is currently **unavailable** (first live workflow run stopped in credential guard). A Cloudflare Pages-scoped token must be added in the GitHub repository's *Settings → Secrets and variables → Actions* under that exact name. Do not paste it in chat or commit it. The workflow itself stores only public browser configuration.

After adding the secret, trigger **Re-run failed jobs** on the staging workflow or push an approved change to its specific branch. Do not make the PR ready or merge merely because the staging build succeeds.

## Auth end-to-end gates still pending

- In Supabase **staging project only**, configure Auth URL/redirect allowlist to include the exact staged Pages domain; URL configuration is a dashboard action not exposed by the current Supabase integration.
- Email is enabled but OTP template/token delivery and actual user sign-in remain unverified.
- Enable Google provider only after the owner registers Google OAuth client credentials and correct callback/redirects.
- Using two actual signed-in test accounts, verify profile isolation, server-backed admin grant and revocation, initial wallet+ROBOT, an actual two-session CAS race, and deletion-request semantics.
- Admin role must be operator-provisioned against the exact test/owner Auth user ID; no role assignment based on email claims or client-side state.
- Cloud AC minting and `account-profile` release remain LOCKED pending backend receipts and owner approval; do not run any test against MathPath or APEX production projects.

## Open gates

- **Database schema/RLS baseline:** PASS (staging).
- **Public REST unauthorized request defense:** PASS (staging).
- **Cloudflare staging build/deploy:** BUILD CHECK RUNNING / DEPLOY BLOCKED until GitHub Cloudflare token exists and SHA receipt is verified.
- **Email/Google login, two real-session CAS and server-authorized admin:** PENDING.
- **Production deploy or migration:** NOT AUTHORIZED.
