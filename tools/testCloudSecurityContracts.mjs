// A1 security closeout — node-side contracts (Blockers 1-3).
//
// The browser negative suite (testAdminEscalationNegativesBrowser.mjs)
// proves the production bundle resists console attacks; this suite pins
// the underlying module/data contracts so a refactor cannot quietly
// re-open the holes:
//   1. Identity/authorization modules expose no public session setters,
//      the UI profile carries no role, admin derives ONLY from the
//      module-private verified channel + dev opt-in, and window bindings
//      install locked (non-writable, non-configurable).
//   2. Cloud progress sync is an atomic DB compare-and-swap (conditional
//      UPDATE … WHERE version = expected, auth.uid()-bound), direct table
//      writes are closed, and the client calls only the CAS RPC.
//   3. Account deletion is a PENDING request: the RPC stamps and audits,
//      deletes nothing, and never reports full erasure.
//
// Live proof against a real Supabase project (two-session CAS race, real
// cloud sign-in → admin) remains PENDING owner provisioning; it is not
// simulated here (docs/a1/A1_SECURITY_CLOSEOUT.md).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
let checkCount = 0;
const check = (label, fn) => { fn(); checkCount += 1; console.log(`  ✓ ${label}`); };

// ── Blocker 1: module surfaces ──────────────────────────────────────────────
const playerAccount = await import(path.join(root, 'src/game/playerAccount.js'));
const adminAuthority = await import(path.join(root, 'src/game/adminAuthority.js'));
const cloudAccount = await import(path.join(root, 'src/game/cloudAccount.js'));

const account = playerAccount.default;
const admin = adminAuthority.default;

check('player account authority is frozen and setter-free', () => {
  assert.equal(Object.isFrozen(account), true);
  assert.equal('__setCloudSession' in account, false);
  assert.equal('__setSyncState' in account, false);
  assert.equal(typeof account.profile, 'function');
});
check('profile projection has no role and defaults to guest', () => {
  const profile = account.profile();
  assert.equal(profile.kind, 'guest');
  assert.equal('role' in profile, false);
  assert.equal(account.isGuest(), true);
});
check('admin authority fails closed with no verified grant', () => {
  assert.equal(Object.isFrozen(admin), true);
  assert.equal(admin.isAdmin(), false);
  assert.equal(admin.adminSource(), null);
  assert.equal(admin.setAdminTestSession(true), false);
  assert.equal(admin.toggleAdminTestSession().ok, false);
  assert.equal(admin.isAdminTestSessionActive(), false);
});
check('verified channel grants, then revocation evaporates the session', () => {
  adminAuthority.setVerifiedCloudAdminInternal('verified-user-1');
  assert.equal(admin.isAdmin(), true);
  assert.equal(admin.adminSource(), 'cloud-role');
  assert.equal(admin.setAdminTestSession(true), true);
  assert.equal(admin.isAdminTestSessionActive(), true);
  adminAuthority.setVerifiedCloudAdminInternal(null);
  assert.equal(admin.isAdmin(), false);
  assert.equal(admin.isAdminTestSessionActive(), false);
  assert.equal(admin.setAdminTestSession(true), false);
});
check('window bindings install locked and resist replacement', () => {
  const scope = {};
  playerAccount.installPlayerAccountAuthority(scope);
  adminAuthority.installAdminAuthority(scope);
  cloudAccount.installCloudAccount(scope);
  for (const [name, version] of [
    ['APEX_PLAYER_ACCOUNT', 'a1-player-account-v1'],
    ['APEX_ADMIN_AUTHORITY', 'a1-admin-authority-v1'],
    ['APEX_CLOUD_ACCOUNT', 'a1-cloud-account-v1'],
  ]) {
    const d = Object.getOwnPropertyDescriptor(scope, name);
    assert.equal(d.writable, false, name);
    assert.equal(d.configurable, false, name);
    try { scope[name] = { version, isAdmin: () => true }; } catch (e) {}
    try { delete scope[name]; } catch (e) {}
    assert.equal(scope[name].version, version, name);
  }
  assert.equal(scope.APEX_ADMIN_AUTHORITY.isAdmin(), false);
});
check('module-private setters exist for the adapter but not on window objects', () => {
  assert.equal(typeof playerAccount.projectCloudSessionInternal, 'function');
  assert.equal(typeof playerAccount.setCloudSyncStateInternal, 'function');
  assert.equal(typeof adminAuthority.setVerifiedCloudAdminInternal, 'function');
  assert.equal('projectCloudSessionInternal' in account, false);
  assert.equal('setVerifiedCloudAdminInternal' in admin, false);
});
check('cloud adapter is unconfigured and fail-closed without env', async () => {
  assert.equal(cloudAccount.isCloudConfigured(), false);
  const del = await cloudAccount.requestAccountDeletion();
  assert.deepEqual({ ok: del.ok, reason: del.reason }, { ok: false, reason: 'cloud-unconfigured' });
  const up = await cloudAccount.uploadProgressSnapshot();
  assert.equal(up.ok, false);
});

// ── Source-level wiring laws ────────────────────────────────────────────────
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const cloudSrc = read('src/game/cloudAccount.js');
const adminSrc = read('src/game/adminAuthority.js');
const srcFiles = ['src/game/playerAccount.js', 'src/game/adminAuthority.js', 'src/game/cloudAccount.js'];

check('no production module references the retired public setters', () => {
  for (const f of srcFiles) {
    assert.ok(!read(f).includes('__setCloudSession'), f);
    assert.ok(!read(f).includes('__setSyncState'), f);
  }
});
check('admin derivation never reads the UI profile', () => {
  assert.ok(!adminSrc.includes('.profile('), 'adminAuthority must not call profile()');
});
check('cloud adapter verifies identity server-side before granting admin', () => {
  assert.ok(cloudSrc.includes('client.auth.getUser()'), 'getUser() server verification');
  assert.ok(cloudSrc.includes("from('account_roles')"), 'role row under RLS');
  assert.ok(cloudSrc.includes('setVerifiedCloudAdminInternal('), 'private grant channel');
});

// ── Blocker 2: atomic CAS at the database ───────────────────────────────────
const sql2 = read('supabase/migrations/0002_a1_security_closeout.sql');
check('client writes progress only through the CAS RPC', () => {
  assert.ok(cloudSrc.includes("rpc('save_progress_snapshot_cas'"));
  assert.ok(!cloudSrc.includes('.upsert('), 'unconditional upsert must be gone');
  assert.ok(cloudSrc.includes("reason: 'conflict'"), 'client surfaces CONFLICT');
});
check('CAS RPC is atomic and caller-bound', () => {
  assert.ok(sql2.includes('auth.uid()'));
  assert.ok(sql2.includes('version = p_expected_version'), 'conditional UPDATE');
  assert.ok(sql2.includes('on conflict (user_id, namespace) do nothing'), 'race-safe first insert');
  assert.ok(sql2.includes('returns table(ok boolean, current_version integer)'));
  assert.ok(sql2.includes('grant execute on function public.save_progress_snapshot_cas(text, integer, jsonb) to authenticated'));
});
check('direct player_progress writes are closed (self-select only)', () => {
  assert.ok(sql2.includes('drop policy if exists player_progress_self_all'));
  assert.ok(sql2.includes('create policy player_progress_self_select'));
  assert.ok(sql2.includes('for select using (user_id = auth.uid())'));
});

// ── Blocker 3: honest deletion-request semantics ────────────────────────────
check('deletion RPC records a pending request and deletes nothing', () => {
  const start = sql2.indexOf('create function public.request_account_deletion()');
  assert.ok(start > -1);
  const body = sql2.slice(start, sql2.indexOf('$$;', start));
  assert.ok(body.includes('deletion_requested_at'));
  assert.ok(body.includes("'pending'"));
  assert.ok(!/delete\s+from/i.test(body), 'must not delete rows');
  assert.ok(sql2.includes('add column if not exists deletion_requested_at'));
});
check('client deletion returns pending status, never bare success', () => {
  const fnStart = cloudSrc.indexOf('export async function requestAccountDeletion');
  const fnBody = cloudSrc.slice(fnStart, cloudSrc.indexOf('\n}', fnStart));
  assert.ok(fnBody.includes("status"), 'pending status surfaced');
  assert.ok(!fnBody.includes('signOutCloud()'), 'no celebratory sign-out-as-deleted');
});

console.log(`A1 CLOUD SECURITY CONTRACTS: PASS (${checkCount} checks; live-backend proof PENDING owner Supabase)`);
