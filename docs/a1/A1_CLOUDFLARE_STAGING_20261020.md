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

## Owner screenshot + live SQL closeout — Guest backup verified

A signed-in owner provided an Account Center screenshot after pressing `BACK UP GUEST PROGRESS`. Local device display remained **50 AC**, **2/8 owned (NEWBOT and MAGNET)** and **1 draw**, while the sync label showed **SAVED**. Confirmed independently against APEX staging database immediately afterward:

| Database check | Observed |
| --- | --- |
| `public.player_progress` rows | 1 (previously 0) |
| `public.guest_migrations` rows | 1 (previously 0) |
| `player_progress.namespace` | `arsenalMeta` |
| `player_progress.version` | 1 (first CAS insert) |
| `player_progress.payload.unverified` | `true` |
| Snapshot state | JSON object, `credits = 50`, `totalSpins = 1`, contains `MAGNET` |
| Migration status / verification | `pending-review`, `unverified = true` |
| Guest ID match across migration and snapshot for same signed-in user | 1 matched row |
| Unique guest-migration database index | Present |
| Separate Cloud wallet credits/version | 350 AC, version 1 (unchanged starter wallet) |
| Cloud-ledger starter grants | 1, no duplicate starter grant |
| Cloud `MAGNET` ownership grants | 0 (no unverified fighter promotion) |
| Cloud account roles | 0 (no Admin escalation) |

**Checkpoint verdict:** User's single device-to-staging unverified backup **PASS**. Server Cloud wallet authority is still separate from device-local game economy. This is NOT verified currency reconciliation or proof that a *second* browser can safely replay/restore the snapshot. No wallet flag flips, production deployment or merge were made.

**Remaining release checks:** authenticated two-device CAS conflict, cloud restore semantics and conflict UX, actual Google OAuth (if desired), backend account-deletion fulfillment, and server-authoritative match reward receipts. Until then keep A1.2 PR draft and production cloud features locked.

## Two-device Cloud preview + optimistic CAS checkpoint

**Staging build:** `552eaf7a9dde5f816a51305d740657708df09c24`. Deployed independently to https://a1-cloud-staging-20261020.apex-chaos.pages.dev/ and verified using its live `A1_STAGING_BUILD_SHA.txt` (HTTP 200). GitHub Actions run [39384720492](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39384720492) **PASS**, including source build, `tools/testCloudLifecycleRaces.mjs`, Guest idempotency tests, hosted Auth/RLS negative HTTP requests, deployment and SHA receipt. Guest session browser smoke still reports proper signed-out Account Center and email Magic Link UI. Other owner/Chrome jobs were independently observed passing; this run does **not** represent real signed-in second-device certification.

### Changes

- `src/game/cloudSnapshotPreview.js`: validate an `unverified: true` player_progress JSON payload, returning only read-only version/device-credits/device-draws/fighter-list information. Does not apply or trust financial or fighter claims.
- `previewCloudProgressSnapshot()`: require a currently signed-in verified GoTrue account matching player profile; RLS-select own `arsenalMeta` snapshot; establish an in-memory **one-use** reviewed version bound to session epoch and account.
- `uploadProgressSnapshot()`: no upload without the above explicit review; require renewed verified identity and use CAS *exactly* at the version reviewed. The reviewed capability is spent on the first update attempt; a stale writer gets CONFLICT and cannot replay without reading the newer backup.
- `AccountCenter.jsx`: REVIEW CLOUD BACKUP (nonmutating preview, plainly labelled unverified) before UPDATE CLOUD SNAPSHOT (AFTER REVIEW); the latter stays disabled without the preview. No automatic economic restore, no cloud wallet issuance.
- Lifecycle security tests added: reject update without preview, one-use token semantics, reject previous account's preview after switch, freshly reviewed new-account update, logout invalidation, and mocked two-device CAS race (version 9 vs version 10) with no overwritten snapshot.

### Owner acceptance still pending

The owner's first-device **50 AC, 1 draw, NEWBOT+MAGNET** data was previously captured as an unverified snapshot version 1, and staging retained **one** `player_progress` and one `guest_migrations` row through this deployment. However **no second physical browser login has been performed by this agent**. For safe verification: open a private/incognito browser or second device on the **same staging URL**, authenticate with the **same Cloud account via emailed Magic Link**, open Account Center, click **REVIEW CLOUD BACKUP only**. Confirm it shows snapshot version 1 with 50 credits, 1 draw and MAGNET while the separate new-device local wallet remains unchanged. **Do NOT** click BACK UP GUEST PROGRESS, UPDATE CLOUD SNAPSHOT or clear the original device storage during this checkpoint. Report visible preview text; do not paste tokens, OTPs or email links.

**Pass semantics:** read-only recovery/preview of one user's unverified backup across two signed-in clients + no client-state mutation. This is *not* a trusted production wallet/ownership restore. Real simultaneous CAS writes and explicit gameplay restore/reconciliation need separate acceptance and backend authority design before unlocking release.

## Second-browser Magic Link URL handoff — fixed on staging

**Owner-reported issue:** Clicking an email Magic Link in a mail client opened the already-signed-in default browser, leaving a different/incognito browser as `GUEST`. This is standard browser-session isolation: Supabase can authenticate only the browser that **consumes** the one-time link. It is NOT evidence of failed GoTrue Auth or shared login storage.

**Implemented on APEX staging branch (SHA `27bb59297b0e773484c94a4f021bd8272e776ff2`):**

- In Guest Account Center, request **SEND SIGN-IN LINK** from the *target* browser. Instead of clicking the received email link (which may launch the default browser), **COPY LINK ADDRESS** from the brand-new email without opening it, paste into the private **PASTE EMAIL SIGN-IN LINK** field in the target game window, and press **SIGN IN IN THIS TAB**. The target browser navigates itself through the Supabase email verification URL and back to the configured staging origin, so its session is stored in that browser.
- The browser code never prints, persists, forwards to another service, or submits the link to an Apex application server. It accepts only HTTPS links for this project's exact `/auth/v1/verify` endpoint, with `magiclink`/`signup`/`email` confirmation type, token or token_hash, and redirect targeting this exact staging origin. Reject unrelated sites, production redirects, HTTP, URL fragments and unrelated auth methods.
- An already-consumed Magic Link cannot be reused: request a fresh email in the target browser and **copy its URL before clicking**.
- Fix the sign-in handoff side effect: `persistGuestHandoffIfEmpty` now checks whether the signed-in user already owns a cloud snapshot **before** writing `guest_migrations`. A second browser with its own new local Guest cannot create another pending-review Guest lineage when the account already has a backup. The existing cloud snapshot remains unchanged.
- Test coverage in `tools/testA1EmailMagicLinkTransfer.mjs`: valid project Magic Link, sign-up link and token hash; negative URL-origin/type/redirect/link-value cases. `tools/testA1GuestHandoff.mjs`: existing snapshot must produce zero extra Guest lineage entries.
- [Cloudflare staging workflow run 39386670822](https://github.com/Khanh-glitch/APEX-CHAOS/actions/runs/39386670822): all steps PASS (Magic Link safety test, guest idempotency, Auth lifecycle, build/deploy, hosted RLS/API negatives and exact deployed SHA).
- Browser check on the deployed alias: private paste field and **SIGN IN IN THIS TAB** are rendered, and an invalid URL raises `INVALID-EMAIL-LINK` without changing the page origin.
- Staging only. Production `apex-chaos.pages.dev` and the Cloud wallet flag stay untouched.

**Current acceptance:** staging code/URL safety PASS. Real second-browser sign-in via a fresh one-time link is still **PENDING owner test**. The user must not send the URL/token in chat, paste it into DevTools, or attempt to reuse a previously clicked/expired Magic Link. After the target browser displays the account, use **REVIEW CLOUD BACKUP only** to confirm read-only version 1 and the 50 AC / 1 draw / MAGNET snapshot without restoring or overwriting it.

**Longer-term UX:** for routine multi-device login, configure the hosted Supabase email OTP template to expose `{{ .Token }}`, then reintroduce a 6-digit code entry backed by `auth.verifyOtp({ email, token, type: 'email' })` under a tested, staging-only feature gate. Template settings are currently owner Dashboard-only. Do not enable a code input that the delivered email does not actually support.
