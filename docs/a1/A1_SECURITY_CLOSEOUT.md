# A1 Security Closeout — PR #97 independent review

Date: 2026-10-20 · Branch: `arena/b04b5a3c-apex-chaos` · Base head: `dfe0036b`

The owner independently verified PR #97's Deploy Preview: **visual
acceptance PASSED** for the Account Center and P1/P2 Skill Details (kept
unchanged), and found **three security blockers**. This document records
the before/after evidence, the design fixes, and what remains pending a
real backend. Nothing here claims a Cloud Auth production pass — no
Supabase project exists yet, so every cloud behavior stays env-gated and
fail-closed.

## Boundary statement (owner-agreed)

A user controls their own browser: with devtools they can rewrite their
own client's local behavior (device-local AC, visuals). That is an
accepted limitation of every web game. The hard boundary is: **client
tampering must not yield server rights or valid cloud assets, and the
shipped interfaces must not hand a guest an admin grant.** All three
fixes target that boundary.

## Blocker 1 — Guest → admin escalation through the public session seam

### BEFORE (head `dfe0036b`, production preview, independently reproduced)

```js
window.APEX_PLAYER_ACCOUNT.__setCloudSession({ userId: 'x', role: 'admin', ... })
```

```
BEFORE-ATTACK {"kind":"guest","hasRoleField":true,"setterExposed":"function",
  "isAdmin":false,"bindingPlayer":{"writable":true,"configurable":true},
  "bindingAdmin":{"writable":true,"configurable":true}}
ATTACK1 setter-forgery {"setterCall":"accepted","kindAfter":"cloud",
  "isAdmin":true,"adminSource":"cloud-role","setSession":true,
  "sessionActive":true,"canSelectHunter":true}
ATTACK2 binding-replacement {"assign":"done","isAdminNow":true,"canSelectHunter":true}
VERDICT: ESCALATION POSSIBLE (vulnerable)
```

Root causes (design, not a test artifact):

1. The session setters (`__setCloudSession`/`__setSyncState`) were methods
   on the **public** window authority — callable by any console user.
2. `adminAuthority` derived admin from the **UI profile projection**
   (`profile.kind === 'cloud' && profile.role === 'admin'`), i.e. display
   state doubled as authorization evidence.
3. The privileged `window` bindings themselves were writable/configurable,
   so the genuine authority objects could be swapped for fakes under
   classic-script consumers that read them at decision time.

### Fix (permission redesign, no gameplay/visual change)

- **Module-private session feed.** The setters are now ES-module exports
  (`projectCloudSessionInternal`, `setCloudSyncStateInternal`) imported
  only by `cloudAccount.js`. They are not properties of any window object;
  module scope is unreachable from the console.
- **Role-less UI projection.** `APEX_PLAYER_ACCOUNT.profile()` carries no
  `role` field at all. It is display state only.
- **Server-verified admin channel.** `adminAuthority` holds a private
  `verifiedCloudAdminUserId`, set exclusively through a module-private
  function that `cloudAccount.js` calls only after (a) re-validating the
  session against the auth server with `auth.getUser()` (the local
  session object alone is never trusted) **and** (b) reading an `admin`
  row for that exact uid from `public.account_roles` under RLS. Any
  error/offline/mismatch revokes the grant (fail-closed) and evaporates a
  live test session. Sign-out revokes immediately.
- **Locked window bindings.** `APEX_PLAYER_ACCOUNT`,
  `APEX_ADMIN_AUTHORITY`, and `APEX_CLOUD_ACCOUNT` install via
  `Object.defineProperty` (non-writable, non-configurable) around frozen
  objects, so neither the objects nor their bindings can be replaced.
- **Dev Admin stays dev-only** (`import.meta.env.DEV && VITE_APEX_DEV_ADMIN=1`);
  production compiles it out. `Ctrl+Shift+F8` and native spawn keep
  working unchanged for a genuinely authorized admin; Admin/Test still
  awards zero AC (economy runtime refuses independently).
- **Server side unchanged in law:** every privileged write re-derives the
  caller from `auth.uid()` under RLS/RPCs; verified cloud reward issuance
  remains disabled (`cloud_wallet_enabled=false`).

### AFTER (same attacks, production build)

```
BEFORE-ATTACK {"kind":"guest","hasRoleField":false,"setterExposed":"undefined",
  "isAdmin":false,"bindingPlayer":{"writable":false,"configurable":false},
  "bindingAdmin":{"writable":false,"configurable":false}}
ATTACK1 setter-forgery {"setterCall":"threw: TypeError: ... is not a function",
  "kindAfter":"guest","isAdmin":false,"setSession":false,"canSelectHunter":false}
ATTACK2 binding-replacement {"assign":"done","isAdminNow":false,"canSelectHunter":false}
ATTACK3 storage-forgery {"kind":"guest","isAdmin":false,"setSession":false}
VERDICT: escalation denied (hardened)
```

Regression coverage: `tools/testAdminEscalationNegativesBrowser.mjs`
(production build, 13 checks: forged role, binding replacement, direct
Admin/Lab entry calls, F8 chord, admin-shaped rewards = 0 AC, storage
forgery, fail-closed cloud) + `tools/testCloudSecurityContracts.mjs`
(15 node contracts incl. the grant/revoke channel). The V43 owner
reproduction, which previously used the removed seam as a fixture, now
runs against a dedicated `VITE_APEX_DEV_ADMIN=1` dev server (its grant is
`dev-build`, profile stays `guest`, and the shared acceptance server
stays pristine).

## Blocker 2 — Cloud sync could silently overwrite a newer device snapshot

BEFORE: `uploadProgressSnapshot()` read `version`, then `upsert`ed
unconditionally — two signed-in devices raced last-writer-wins.

Fix: migration `0002_a1_security_closeout.sql` adds
`save_progress_snapshot_cas(p_namespace, p_expected_version, p_payload)` —
an atomic compare-and-swap bound to `auth.uid()` (single conditional
`UPDATE … WHERE version = expected`; race-safe insert-if-absent for the
first save). A mismatch returns `ok=false` + the newer server version and
writes nothing. The client reports a `conflict` sync state, preserves the
server snapshot, and only a deliberate re-press after seeing CONFLICT
overwrites. Direct table writes on `player_progress` are revoked
(self-SELECT only) so the CAS cannot be bypassed through PostgREST.

**Pending (owner backend):** the live two-session concurrent test on
Supabase staging. It cannot be faked locally; the SQL + client contracts
are pinned by `tools/testCloudSecurityContracts.mjs` until then.

## Blocker 3 — Account deletion claimed more than it did

BEFORE: `request_account_deletion()` deleted the caller's public rows but
could not remove the Supabase Auth user, while the client returned bare
`{ ok: true }` and signed out — implying a completed erasure that never
happened (the identity could sign straight back in).

Fix (honest pending semantics): the RPC now stamps
`profiles.deletion_requested_at`, writes an audit event, deletes nothing,
and returns `status='pending'`. The client surfaces `pending`; the
Account Center button is REQUEST DELETION → CONFIRM REQUEST →
**DELETION PENDING**, with copy stating the account and data still exist
until the backend processes the request. While cloud is unconfigured
(today), the action stays locked behind the honest
`CLOUD NOT CONFIGURED` state.

**Pending (owner backend):** the completion pipeline — a service-role job
(Edge Function/cron) that calls `auth.admin.deleteUser(userId)` for
profiles with `deletion_requested_at` set (all public rows cascade from
`auth.users`), plus its own staging test. No service-role key ever ships
in the client.

## A1.2 remaining scope (unchanged, explicit)

Adapter + SQL are complete but **unexecuted against a real backend**:
Supabase project, migrations 0001→0002, Google + Email OTP providers,
Netlify env, the owner's own `account_roles` row, then staging proofs
(real sign-in/sign-out, cloud-role admin grant, two-session CAS race,
pending-deletion processing). Until those run, no "Cloud Auth production
PASS" exists, and the product keeps the honest `CLOUD NOT CONFIGURED`
state.
