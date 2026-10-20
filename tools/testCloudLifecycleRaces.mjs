// A1 final security session lifecycle closeout — deterministic race tests.
//
// The cloud adapter's session projection is async (display fetch → server
// identity re-validation → role fetch) while sign-out, account switching
// and connectivity loss are synchronous. These tests drive a FAKE
// Supabase client through the module-private test seam
// (__cloudLifecycleTestHooks) with manually resolved promises to pin the
// fail-closed lifecycle laws:
//
//   1. Sign-out revokes the verified grant synchronously, before any
//      network await (a hanging auth.signOut leaves nothing behind).
//   2. A projection superseded by sign-out mid-role-fetch applies
//      nothing — even when its late result says 'admin'.
//   3. Offline revokes the grant and ends the Admin Test Session;
//      coming back online restores admin ONLY through a fresh server
//      re-verification.
//   4. An account switch with a stale 'admin' completion in flight keeps
//      the new (non-admin) identity.
//   5. The progress CAS version cache is per-account: switching users
//      resets it and the next upload re-reads the new user's version.
//
// These prove client-side lifecycle ordering with zero backend. They are
// NOT staging evidence: real Supabase sign-in/admin/CAS-race proof still
// waits for owner provisioning (docs/a1/A1_SECURITY_CLOSEOUT.md).

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Browser-global stubs must exist before the modules evaluate.
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
globalThis.window = {
  _listeners: new Map(),
  addEventListener(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
  },
  dispatchEvent() { return true; },
};

const playerAccount = await import(path.join(root, 'src/game/playerAccount.js'));
const adminAuthority = await import(path.join(root, 'src/game/adminAuthority.js'));
const cloudAccount = await import(path.join(root, 'src/game/cloudAccount.js'));

const account = playerAccount.default;
const admin = adminAuthority.default;
const hooks = cloudAccount.__cloudLifecycleTestHooks;
assert.ok(hooks, 'lifecycle test seam exported');

let checkCount = 0;
const check = (label, fn) => { fn(); checkCount += 1; console.log(`  ✓ ${label}`); };
const immediate = () => new Promise((r) => setImmediate(r));
async function waitUntil(cond, label) {
  for (let i = 0; i < 200; i += 1) {
    if (cond()) return;
    await immediate();
  }
  assert.fail(`waitUntil timed out: ${label}`);
}
function deferred() {
  let resolve; let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const userA = { id: 'user-a', email: 'a@example.invalid', user_metadata: { full_name: 'ACE A' }, identities: [{ provider: 'email' }] };
const userB = { id: 'user-b', email: 'b@example.invalid', user_metadata: { full_name: 'Bee B' }, identities: [{ provider: 'email' }] };
const sessionOf = (user) => ({ user });

// Fake Supabase client with per-table handlers and call capture. Query
// chains used by the adapter: select().eq()[.eq()].maybeSingle().
function makeClient(behavior = {}) {
  const calls = { tables: [], rpc: [] };
  const tableResult = async (table) => {
    calls.tables.push(table);
    const handler = behavior.tables?.[table];
    if (handler) return handler();
    return { data: null, error: null };
  };
  const chainFor = (table) => {
    const chain = { eq: () => chain, maybeSingle: () => tableResult(table) };
    return chain;
  };
  const client = {
    auth: {
      getUser: behavior.getUser || (async () => ({ data: { user: behavior.user || null }, error: null })),
      getSession: behavior.getSession || (async () => ({ data: { session: behavior.session ?? null } })),
      onAuthStateChange: (cb) => { calls.authStateCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: behavior.signOut || (async () => ({ error: null })),
    },
    from: (table) => ({ select: () => chainFor(table), insert: async () => ({ error: null }) }),
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      return behavior.rpc ? behavior.rpc(name, args) : { data: [{ ok: true, current_version: 1 }], error: null };
    },
  };
  return { client, calls };
}

const fastProfiles = async () => ({ data: { display_name: 'ACE', avatar_url: '' }, error: null });
const adminRole = async () => ({ data: { role: 'admin' }, error: null });
const playerRole = async () => ({ data: { role: 'player' }, error: null });

async function resetAll(client) {
  hooks.resetLifecycle();
  await hooks.projectSession(client, null);
  admin.setAdminTestSession(false);
}
async function grantAdmin(client, user) {
  await hooks.projectSession(client, sessionOf(user));
  assert.equal(admin.isAdmin(), true, 'precondition: verified admin granted');
}

// ── S0. Fast path grants (guards against vacuous tests) ─────────────────────
{
  const { client } = makeClient({ user: userA, tables: { profiles: fastProfiles, account_roles: adminRole } });
  hooks.setClientOverride(client);
  await resetAll(client);
  await grantAdmin(client, userA);
  check('sanity: server-verified admin grants through the channel', () => {
    assert.equal(admin.adminSource(), 'cloud-role');
    assert.equal(account.profile().kind, 'cloud');
    assert.equal('role' in account.profile(), false);
    assert.equal(admin.setAdminTestSession(true), true);
  });
}

// ── S1. Sign-out revokes BEFORE the network call resolves ───────────────────
{
  const hangSignOut = deferred();
  const epoched = makeClient({
    user: userA,
    tables: { profiles: fastProfiles, account_roles: adminRole },
    signOut: () => hangSignOut.promise.then(() => ({ error: null })),
  });
  hooks.setClientOverride(epoched.client);
  await resetAll(epoched.client);
  await grantAdmin(epoched.client, userA);
  assert.equal(admin.setAdminTestSession(true), true);
  const epochBefore = hooks.sessionEpoch();
  const pending = cloudAccount.signOutCloud(); // do NOT await: network hangs
  check('sign-out revokes grant + test session synchronously (no network wait)', () => {
    assert.equal(admin.isAdmin(), false);
    assert.equal(admin.isAdminTestSessionActive(), false);
    assert.equal(account.profile().kind, 'guest');
    assert.ok(hooks.sessionEpoch() > epochBefore, 'epoch bumped');
  });
  hangSignOut.resolve();
  const result = await pending;
  check('sign-out completes after network resolves', () => {
    assert.equal(result.ok, true);
    assert.equal(admin.isAdmin(), false);
    assert.equal(account.syncStatus().status, 'signed-out');
  });
}

// ── S2. Logout during role fetch: late 'admin' result is discarded ─────────
{
  const roleGate = deferred();
  const { client } = makeClient({
    user: userA,
    tables: { profiles: fastProfiles, account_roles: () => roleGate.promise },
  });
  hooks.setClientOverride(client);
  await resetAll(client);
  const projection = hooks.projectSession(client, sessionOf(userA));
  await waitUntil(() => account.profile().kind === 'cloud', 'display projection applied');
  await cloudAccount.signOutCloud();
  roleGate.resolve({ data: { role: 'admin' }, error: null });
  await projection;
  check('logout-during-role-fetch: stale admin result cannot re-grant', () => {
    assert.equal(admin.isAdmin(), false);
    assert.equal(admin.adminSource(), null);
    assert.equal(account.profile().kind, 'guest');
    assert.equal(account.syncStatus().status, 'signed-out', 'stale write did not clobber sync state');
    assert.equal(admin.setAdminTestSession(true), false);
  });
}

// ── S2b. Logout during display fetch: stale profile is not projected ────────
{
  const profileGate = deferred();
  const { client } = makeClient({
    user: userA,
    tables: { profiles: () => profileGate.promise, account_roles: adminRole },
  });
  hooks.setClientOverride(client);
  await resetAll(client);
  const projection = hooks.projectSession(client, sessionOf(userA));
  await immediate();
  await cloudAccount.signOutCloud();
  profileGate.resolve({ data: { display_name: 'ACE', avatar_url: '' }, error: null });
  await projection;
  check('logout-during-display-fetch: stale profile never appears', () => {
    assert.equal(account.profile().kind, 'guest');
    assert.equal(admin.isAdmin(), false);
  });
}

// ── S3. Offline revokes; online restores only via fresh verification ────────
{
  const state = { verified: true };
  const { client } = makeClient({
    user: userA,
    session: sessionOf(userA),
    tables: { profiles: fastProfiles, account_roles: adminRole },
    getUser: async () => (state.verified
      ? { data: { user: userA }, error: null }
      : { data: { user: null }, error: { message: 'network unreachable' } }),
  });
  hooks.setClientOverride(client);
  await resetAll(client);
  await grantAdmin(client, userA);
  assert.equal(admin.setAdminTestSession(true), true);

  hooks.handleOffline();
  check('offline revokes grant and ends the Admin Test Session (fail-closed)', () => {
    assert.equal(admin.isAdmin(), false);
    assert.equal(admin.isAdminTestSessionActive(), false);
    assert.equal(account.syncStatus().status, 'offline');
    assert.equal(account.profile().kind, 'cloud', 'display profile kept; authorization gone');
  });

  await hooks.refreshSessionProjection();
  check('online: fresh server re-verification restores admin', () => {
    assert.equal(admin.isAdmin(), true);
    assert.equal(admin.adminSource(), 'cloud-role');
  });

  hooks.handleOffline();
  state.verified = false;
  await hooks.refreshSessionProjection();
  check('online with failed verification stays revoked (nothing restored locally)', () => {
    assert.equal(admin.isAdmin(), false);
    assert.equal(admin.adminSource(), null);
  });
}

// ── S4. Account switch: stale 'admin' completion cannot hijack the new user ─
{
  const roleGateA = deferred();
  const state = { current: userA, roleA: 'fast' };
  const { client } = makeClient({
    tables: {
      profiles: fastProfiles,
      account_roles: () => (state.roleA === 'slow' ? roleGateA.promise
        : Promise.resolve(state.current.id === userA.id
          ? { data: { role: 'admin' }, error: null }
          : { data: { role: 'player' }, error: null })),
    },
    getUser: async () => ({ data: { user: state.current }, error: null }),
  });
  hooks.setClientOverride(client);
  await resetAll(client);
  await grantAdmin(client, userA);

  // A token-refresh-style re-verification for A hangs on the role fetch…
  state.roleA = 'slow';
  const staleA = hooks.projectSession(client, sessionOf(userA));
  await waitUntil(() => hooks.currentSessionUserId() === 'user-a', 'A re-projection in flight');
  // …and the player switches to B (never admin) before it lands.
  state.current = userB;
  state.roleA = 'fast';
  await hooks.projectSession(client, sessionOf(userB));
  roleGateA.resolve({ data: { role: 'admin' }, error: null });
  await staleA;
  check('account switch: stale admin completion keeps the new non-admin identity', () => {
    assert.equal(account.profile().profileId, 'user-b');
    assert.equal(admin.isAdmin(), false);
    assert.equal(hooks.currentSessionUserId(), 'user-b');
  });
}

// ── S5. Explicit review is mandatory and bound to current user+version ──
{
  let currentIdentity = userA;
  const tables = {
    profiles: fastProfiles,
    account_roles: playerRole,
    player_progress: async () => ({ data: {
      version: currentIdentity.id === 'user-a' ? 4 : 2,
      payload: { unverified: true, state: { credits: 350, totalSpins: 0, ownedFighters: ['ROBOT'] } },
      updated_at: '2026-10-20T00:00:00Z',
    }, error: null }),
  };
  const { client, calls } = makeClient({
    tables,
    getUser: async () => ({ data: { user: currentIdentity }, error: null }),
    rpc: async (name, args) => ({ data: [{ ok: true, current_version: args.p_expected_version + 1 }], error: null }),
  });
  hooks.setClientOverride(client);
  globalThis.window.APEX_ARSENAL_META = { getState: () => ({ credits: 350, ownedFighters: ['ROBOT'] }) };
  await resetAll(client);
  await hooks.projectSession(client, sessionOf(userA));

  const rejected = await cloudAccount.uploadProgressSnapshot();
  check('Cloud update without reviewing server snapshot is prohibited', () => {
    assert.equal(rejected.reason, 'preview-required');
    assert.equal(calls.rpc.length, 0);
  });

  const previewA = await cloudAccount.previewCloudProgressSnapshot();
  check('read-only Cloud preview shows unverified version and credits, not an applied wallet', () => {
    assert.equal(previewA.ok, true);
    assert.equal(previewA.version, 4);
    assert.equal(previewA.deviceCredits, 350);
    assert.deepEqual(hooks.progressCache(), { version: 4, userId: 'user-a' });
  });

  const up1 = await cloudAccount.uploadProgressSnapshot();
  check('reviewed update CASes against precisely the version that was shown', () => {
    assert.equal(up1.ok, true);
    assert.equal(calls.rpc.at(-1).args.p_expected_version, 4);
    assert.deepEqual(hooks.progressCache(), { version: null, userId: null });
  });
  const replay = await cloudAccount.uploadProgressSnapshot();
  check('successful review grants only one update attempt, not an endless update lease', () => {
    assert.equal(replay.reason, 'preview-required');
    assert.equal(calls.rpc.length, 1);
  });

  const previewBeforeSwitch = await cloudAccount.previewCloudProgressSnapshot();
  assert.equal(previewBeforeSwitch.version, 4);
  currentIdentity = userB;
  await hooks.projectSession(client, sessionOf(userB));
  const stale = await cloudAccount.uploadProgressSnapshot();
  check('account switch revokes preview authorization, preventing cross-account write', () => {
    assert.equal(stale.reason, 'preview-required');
    assert.deepEqual(hooks.progressCache(), { version: null, userId: null });
    assert.equal(calls.rpc.length, 1);
  });

  const previewB = await cloudAccount.previewCloudProgressSnapshot();
  const up2 = await cloudAccount.uploadProgressSnapshot();
  check('new user must separately review own remote snapshot before CAS update', () => {
    assert.equal(previewB.version, 2);
    assert.equal(up2.ok, true);
    assert.equal(calls.rpc.at(-1).args.p_expected_version, 2);
    assert.equal(calls.rpc.length, 2);
  });

  await cloudAccount.signOutCloud();
  check('sign-out clears Cloud snapshot preview authorization', () => {
    assert.equal(hooks.previewState(), null);
    assert.deepEqual(hooks.progressCache(), { version: null, userId: null });
  });
  delete globalThis.window.APEX_ARSENAL_META;
}

// ── S5b. Optimistic concurrency when another device writes after preview ──
{
  let remoteVersion = 9;
  const { client, calls } = makeClient({
    user: userA,
    tables: {
      profiles: fastProfiles,
      account_roles: playerRole,
      player_progress: async () => ({ data: {
        version: remoteVersion,
        payload: { unverified: true, state: { credits: 50, ownedFighters: ['ROBOT','MAGNET'], totalSpins: 1 } },
      }, error: null }),
    },
    rpc: async (_, args) => ({
      data: [{ ok: args.p_expected_version === remoteVersion, current_version: remoteVersion }],
      error: null,
    }),
  });
  hooks.setClientOverride(client);
  globalThis.window.APEX_ARSENAL_META = { getState: () => ({ credits: 350, ownedFighters: ['ROBOT'] }) };
  await resetAll(client);
  await hooks.projectSession(client, sessionOf(userA));
  const preview = await cloudAccount.previewCloudProgressSnapshot();
  assert.equal(preview.version, 9);
  assert.ok(preview.deviceFighters.includes('MAGNET'));
  remoteVersion = 10; // device B committed first
  const attempt = await cloudAccount.uploadProgressSnapshot();
  check('stale version 9 update conflicts against version 10 without overwrite', () => {
    assert.equal(attempt.reason, 'conflict');
    assert.equal(attempt.serverVersion, 10);
    assert.equal(account.syncStatus().status, 'conflict');
    assert.equal(calls.rpc.at(-1).args.p_expected_version, 9);
    assert.equal(hooks.previewState(), null);
  });
  const replay = await cloudAccount.uploadProgressSnapshot();
  check('CAS conflict requires a new explicit preview before retry', () => {
    assert.equal(replay.reason, 'preview-required');
    assert.equal(calls.rpc.length, 1);
  });
  await cloudAccount.signOutCloud();
  delete globalThis.window.APEX_ARSENAL_META;
}

// ── S6. Seam hygiene: hooks never leaked onto window/api surface ────────────
hooks.setClientOverride(null);
check('test seam is module-private (window + frozen api stay clean)', () => {
  assert.equal('__cloudLifecycleTestHooks' in (globalThis.window.APEX_CLOUD_ACCOUNT || {}), false);
  assert.equal(cloudAccount.isCloudConfigured(), false, 'override cleared: back to fail-closed default');
});

console.log(`A1 CLOUD LIFECYCLE RACES: PASS (${checkCount} checks; fake-client races, not staging evidence)`);
