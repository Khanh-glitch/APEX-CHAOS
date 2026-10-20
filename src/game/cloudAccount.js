// APEX CHAOS cloud account adapter (A1.2) — Supabase, env-gated, lazy.
//
// Configuration arrives ONLY through public client env vars:
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   (anon key + user JWT + RLS;
//   a service-role key must never appear in this bundle).
//
// Without them the adapter reports `cloud-unconfigured` and every action
// fails honestly — there is no simulated login anywhere in the product,
// and the Admin authority fails closed (no verified admin can exist).
//
// Trust boundary (brief §5, A1 security closeout): this phase syncs
// identity, profile, preferences and progress SNAPSHOTS. It never issues
// verified cloud currency: the server-side wallet RPCs ship disabled
// (app_config.cloud_wallet_enabled) until validated match receipts exist,
// and this client contains no call that can mint cloud AC. The spendable
// wallet remains the local APEX_ARSENAL_META authority; snapshots uploaded
// here are marked `unverified: true` and uploaded through an atomic
// compare-and-swap RPC so devices can never silently overwrite each other.
//
// Identity → authorization wiring is split on purpose: this module feeds
// the DISPLAY projection (playerAccount) through module-private setters,
// and feeds the Admin authority only after the session has been
// re-validated against the auth server (`auth.getUser()`) and the
// caller's own account_roles row says 'admin'. Nothing on window can
// inject either state (Blocker 1). The session lifecycle is epoch-guarded
// and fail-closed: sign-out revokes synchronously before any network
// call, offline revokes until a fresh server re-verification, account
// switches reset the grant + progress version cache, and stale async
// projections can never re-apply a grant (final lifecycle closeout).

import playerAccountAuthority, {
  projectCloudSessionInternal,
  setCloudSyncStateInternal,
} from './playerAccount.js';
import { setVerifiedCloudAdminInternal } from './adminAuthority.js';
import { persistGuestHandoffIfEmpty } from './guestCloudHandoff.js';
import { describeUnverifiedCloudSnapshot } from './cloudSnapshotPreview.js';

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

export function isCloudConfigured() {
  // `testClientOverride` is null in every shipped build path; only the
  // module-private lifecycle test seam at the bottom of this file sets it.
  return !!testClientOverride || (!!SUPABASE_URL && !!SUPABASE_ANON_KEY);
}

// OAuth provider is independent from having a configured Supabase project.
// Ship Google sign-in only when this specific build deliberately opts in,
// after the provider credentials and redirect allowlist are configured.
export function isGoogleSignInEnabled() {
  return isCloudConfigured() && import.meta.env.VITE_APEX_GOOGLE_AUTH_ENABLED === '1';
}

let clientPromise = null;
let testClientOverride = null;
async function getClient() {
  if (testClientOverride) return testClientOverride;
  if (!isCloudConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }));
  }
  return clientPromise;
}

function setSync(status, detail) {
  setCloudSyncStateInternal(status, detail);
}

// ── Session lifecycle (fail-closed, race-proof) ─────────────────────────────
// Session projection is async (profile fetch → server re-validation → role
// fetch), while sign-out, account switching and connectivity loss are
// synchronous events. Without ordering, a slow projection could re-apply a
// verified admin grant AFTER the player already signed out, switched
// accounts, or went offline. The epoch counter makes every lifecycle
// transition invalidate in-flight async work:
//   * every projectSession() call claims a new epoch;
//   * sign-out and offline bump the epoch WITHOUT starting a projection;
//   * a projection writes state only while its epoch is still current —
//     stale completions are discarded (no grant, no display projection,
//     no sync-state clobber).
// Revocation is always synchronous and first: sign-out and offline revoke
// the verified grant (ending any Admin Test Session) before any network
// await. A grant only ever (re)appears at the end of a fresh, current,
// server-verified projection — e.g. the 'online' handler re-verifies from
// scratch instead of restoring local state.
const GUEST_LINK_KEY = 'apexChaos.guestEmailLinkPending.v1';
const GUEST_LINK_TTL_MS = 30 * 60 * 1000; // Magic Link may open a second tab.
function pendingLink() {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_LINK_KEY) || 'null');
    if (!value || typeof value.guestId !== 'string'
      || typeof value.email !== 'string'
      || !Number.isFinite(value.at) || Date.now() - value.at > GUEST_LINK_TTL_MS
      || value.at > Date.now()) return null;
    return value;
  } catch { return null; }
}
function rememberPendingLink(email) {
  try {
    localStorage.setItem(GUEST_LINK_KEY, JSON.stringify({
      guestId: playerAccountAuthority.guestProfileId(),
      email: String(email || '').trim().toLowerCase(), at: Date.now(),
    }));
  } catch { /* private browsing may deny storage; explicit backup remains */ }
}
function clearPendingLink(guestId) {
  try {
    if (pendingLink()?.guestId === guestId) localStorage.removeItem(GUEST_LINK_KEY);
  } catch { /* never block auth */ }
}
let sessionEpoch = 0;
let currentSessionUserId = null;
let guestHandoffInFlight = null;
let guestHandoffKey = null;

// Progress CAS cache lives in the lifecycle block because it is only
// valid for the account that produced it: switching accounts must reset
// it, or one user's last-known server version would seed the next user's
// compare-and-swap expectation.
let lastKnownProgressVersion = null;
let lastKnownProgressUserId = null;
// An update may proceed only if this exact user has just explicitly reviewed
// the current server version. The view is in memory, never persisted.
let reviewedCloudSnapshot = null;
function resetProgressSyncCache() {
  lastKnownProgressVersion = null;
  lastKnownProgressUserId = null;
  reviewedCloudSnapshot = null;
}

// Projects a Supabase session into (a) the DISPLAY profile and (b) — only
// after server verification — the Admin authority's private channel. The
// two are deliberately separate (A1 closeout Blocker 1): what the UI shows
// is never treated as authorization evidence. Every state write after an
// await is epoch-guarded (see lifecycle block above): a projection that
// was overtaken by sign-out, an account switch, or going offline applies
// nothing.
async function projectSession(client, session) {
  const epoch = ++sessionEpoch;
  const stillCurrent = () => epoch === sessionEpoch;
  if (!session || !session.user) {
    currentSessionUserId = null;
    resetProgressSyncCache();
    projectCloudSessionInternal(null);
    setVerifiedCloudAdminInternal(null);
    setSync(isCloudConfigured() ? 'signed-out' : 'cloud-unconfigured', '');
    return;
  }
  const user = session.user;
  if (currentSessionUserId !== user.id) {
    // Account switch (or first sign-in): the previous account's grant and
    // CAS version cache must not bleed into this identity. Revoke up
    // front; a grant for THIS user can only appear after the fresh
    // server verification at the end of this projection.
    currentSessionUserId = user.id;
    resetProgressSyncCache();
    setVerifiedCloudAdminInternal(null);
  }
  // (a) Display projection: name/avatar for the Account Center. Sourced
  // from the session + the caller's own profile row (RLS self-select).
  let displayName = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '';
  let avatarUrl = user.user_metadata?.avatar_url || '';
  try {
    const { data: profileRow } = await client
      .from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle();
    if (profileRow && profileRow.display_name) displayName = profileRow.display_name;
    if (profileRow && profileRow.avatar_url) avatarUrl = profileRow.avatar_url;
  } catch (error) { /* display data is best-effort */ }
  if (!stillCurrent()) return; // superseded while fetching display data
  projectCloudSessionInternal({
    userId: user.id,
    email: user.email || '',
    displayName: displayName || user.email || 'Player',
    avatarUrl: avatarUrl || '',
    providers: (user.identities || []).map((i) => i.provider).filter(Boolean),
  });
  // (b) Verified admin channel (fail-closed): the session object alone is
  // local state, so re-validate the identity against the auth server,
  // then read the caller's own role row under RLS. Any error, mismatch or
  // offline state leaves the grant revoked.
  let adminUserId = null;
  let verifiedUserId = null;
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const verified = !userError && userData && userData.user && userData.user.id === user.id
      ? userData.user : null;
    if (verified) {
      verifiedUserId = verified.id;
      const { data: roleRow } = await client
        .from('account_roles').select('role').eq('user_id', verified.id).maybeSingle();
      if (roleRow && roleRow.role === 'admin') adminUserId = verified.id;
    }
  } catch (error) { /* fail closed: adminUserId stays null */ }
  // The grant write is the security-critical one: if sign-out, an account
  // switch, or offline superseded this projection while verification was
  // in flight, the (possibly admin) result belongs to a dead lifecycle
  // and must NOT be applied.
  if (!stillCurrent()) return;
  setVerifiedCloudAdminInternal(adminUserId);
  // Identity verification is NOT proof that the device snapshot was saved.
  const lastStatus = playerAccountAuthority.syncStatus().status;
  if (!['saved', 'existing', 'previewed'].includes(lastStatus)) {
    setSync(verifiedUserId ? 'connected' : 'error',
      verifiedUserId ? 'Cloud identity verified. Progress upload is separate.'
        : 'Cloud identity not verified yet.');
  }
  // Only the matching email-link request FROM THIS DEVICE may cause an
  // automatic, create-only unverified handoff. No token, no secret, no AC
  // grant is transported by the local pending marker.
  const marker = pendingLink();
  if (verifiedUserId === user.id && marker
    && marker.guestId === playerAccountAuthority.guestProfileId()
    && marker.email === String(user.email || '').trim().toLowerCase()
    && typeof window !== 'undefined') {
    window.setTimeout(() => {
      if (stillCurrent() && playerAccountAuthority.profile().profileId === verifiedUserId) {
        importGuestProgress().catch(() => {});
      }
    }, 1200);
  }
}

// Offline = cannot re-prove a server-verified grant, so fail closed
// immediately: invalidate in-flight projections and revoke the grant
// (which also ends any live Admin Test Session). The display profile is
// left alone — it authorizes nothing. Recovery happens only through the
// 'online' re-verification below, never by restoring local state.
function handleOffline() {
  sessionEpoch += 1;
  setVerifiedCloudAdminInternal(null);
  setSync('offline', '');
}

async function refreshSessionProjection() {
  const client = await getClient();
  if (!client) return;
  const { data } = await client.auth.getSession();
  await projectSession(client, data && data.session);
}

let initialized = false;
export async function initCloudAccount() {
  if (initialized) return { ok: true, configured: isCloudConfigured() };
  initialized = true;
  if (!isCloudConfigured()) {
    setSync('cloud-unconfigured', 'Cloud account is not configured on this build.');
    return { ok: false, configured: false, reason: 'cloud-unconfigured' };
  }
  try {
    const client = await getClient();
    const { data } = await client.auth.getSession();
    await projectSession(client, data && data.session);
    client.auth.onAuthStateChange((_event, session) => {
      projectSession(client, session).catch(() => setSync('error', 'session'));
    });
    if (typeof navigator !== 'undefined') {
      window.addEventListener('online', () => {
        // Never restore a grant from local state: re-project the live
        // session and re-verify against the server.
        refreshSessionProjection().catch(() => setSync('error', 'session'));
      });
      window.addEventListener('offline', handleOffline);
      if (navigator.onLine === false) handleOffline();
    }
    return { ok: true, configured: true };
  } catch (error) {
    setSync('error', String(error && error.message || error));
    return { ok: false, configured: true, reason: 'init-failed' };
  }
}

const unconfigured = () => ({ ok: false, reason: 'cloud-unconfigured' });

export async function signInWithGoogle() {
  if (!isCloudConfigured()) return unconfigured();
  if (!isGoogleSignInEnabled()) return { ok: false, reason: 'google-provider-disabled' };
  const client = await getClient();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/' },
  });
  return error ? { ok: false, reason: error.message } : { ok: true, redirect: true };
}

export async function signInWithEmailOtp(email) {
  if (!isCloudConfigured()) return unconfigured();
  const clean = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { ok: false, reason: 'invalid-email' };
  const client = await getClient();
  const { error } = await client.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: window.location.origin + '/', shouldCreateUser: true },
  });
  if (error) return { ok: false, reason: error.message };
  rememberPendingLink(clean);
  return { ok: true, sent: true };
}

export async function verifyEmailOtp(email, token) {
  if (!isCloudConfigured()) return unconfigured();
  const client = await getClient();
  const { data, error } = await client.auth.verifyOtp({
    email: String(email || '').trim(), token: String(token || '').trim(), type: 'email',
  });
  if (error) return { ok: false, reason: error.message };
  await projectSession(client, data && data.session);
  return { ok: true };
}

export async function signOutCloud() {
  if (!isCloudConfigured()) return unconfigured();
  // Revoke FIRST, synchronously, before any network await: a slow or
  // failed sign-out request must never leave a live verified grant (or
  // Admin Test Session) behind. Bumping the epoch also neutralizes any
  // projectSession still awaiting its role fetch — its result, even
  // 'admin', will be discarded as stale.
  sessionEpoch += 1;
  currentSessionUserId = null;
  resetProgressSyncCache();
  setVerifiedCloudAdminInternal(null);
  projectCloudSessionInternal(null);
  const client = await getClient();
  const { error } = await client.auth.signOut();
  setSync('signed-out', '');
  return error ? { ok: false, reason: error.message } : { ok: true };
}

// Account deletion is a REQUEST, not a completed erasure (A1 closeout
// Blocker 3). The RPC records `profiles.deletion_requested_at` + an audit
// event and intentionally deletes NOTHING: only a service-role backend job
// can remove the underlying auth user (which cascades every public row),
// and that job does not exist until the backend is provisioned. Callers
// must therefore surface 'pending' honestly — the account and its data
// still exist, and sign-in still works, until the request is processed.
// The local guest profile/economy on this device is untouched either way.
export async function requestAccountDeletion() {
  if (!isCloudConfigured()) return unconfigured();
  const client = await getClient();
  const { data, error } = await client.rpc('request_account_deletion');
  if (error) return { ok: false, reason: error.message };
  const status = (Array.isArray(data) && data[0] && data[0].status) || 'pending';
  return { ok: true, status };
}

// ── Progress snapshots (unverified, conflict-safe) ──────────────────────────
// Atomic compare-and-swap at the database (A1 closeout Blocker 2): the
// previous read-version-then-upsert let two signed-in devices silently
// overwrite each other. Writes now go ONLY through the security-definer
// RPC `save_progress_snapshot_cas`, which updates the row iff its version
// still equals the version this device last saw. A mismatch returns
// ok=false with the newer server version; the client reports CONFLICT and
// preserves the server snapshot untouched (pressing sync again after
// seeing CONFLICT is the user's explicit overwrite decision). Direct
// table writes are revoked by RLS policy in migration 0002 so the CAS
// cannot be bypassed through this client's own table access. Economic
// fields are never auto-applied on download. The version cache itself
// lives in the session-lifecycle block above (reset on sign-out/account
// switch, and re-checked against the current user below as a second
// line of defense).

// READ ONLY: fetch the current, user-owned snapshot to display its unverified
// device data without applying it to the local wallet or owned fighters.
// A successful preview also arms exactly one optimistic CAS update against
// this version; any login change, sign-out or offline event disarms it.
export async function previewCloudProgressSnapshot() {
  if (!isCloudConfigured()) return unconfigured();
  const profile = playerAccountAuthority.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const userId = profile.profileId;
  const epoch = sessionEpoch;
  const stillValid = () => epoch === sessionEpoch
    && currentSessionUserId === userId
    && playerAccountAuthority.profile().profileId === userId
    && (typeof navigator === 'undefined' || navigator.onLine !== false);
  resetProgressSyncCache();
  try {
    const client = await getClient();
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    const { data: verified, error: verifyError } = await client.auth.getUser();
    if (verifyError || verified?.user?.id !== userId || !stillValid())
      return { ok: false, reason: 'identity-not-verified' };
    const { data: row, error: queryError } = await client.from('player_progress')
      .select('version,payload,updated_at')
      .eq('user_id', userId).eq('namespace', 'arsenalMeta').maybeSingle();
    if (queryError || !stillValid()) return { ok: false, reason: 'snapshot-read-failed' };
    const summary = describeUnverifiedCloudSnapshot(row);
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    reviewedCloudSnapshot = { userId, epoch, version: summary.version };
    lastKnownProgressVersion = summary.version;
    lastKnownProgressUserId = userId;
    setSync('previewed', 'Viewing a read-only unverified Cloud backup. No device data was changed.');
    return { ok: true, userId, ...summary };
  } catch {
    if (stillValid()) setSync('error', 'Cloud backup preview unavailable.');
    resetProgressSyncCache();
    return { ok: false, reason: 'snapshot-preview-unavailable' };
  }
}

export async function uploadProgressSnapshot() {
  if (!isCloudConfigured()) return unconfigured();
  const profile = playerAccountAuthority.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const snapshot = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  if (!snapshot) return { ok: false, reason: 'wallet-unavailable' };
  const userId = profile.profileId;
  const reviewed = reviewedCloudSnapshot;
  const epoch = sessionEpoch;
  const stillValid = () => epoch === sessionEpoch
    && currentSessionUserId === userId
    && playerAccountAuthority.profile().profileId === userId
    && (typeof navigator === 'undefined' || navigator.onLine !== false);
  if (!reviewed || reviewed.userId !== userId
    || reviewed.epoch !== epoch || !Number.isSafeInteger(reviewed.version)
    || lastKnownProgressUserId !== userId
    || lastKnownProgressVersion !== reviewed.version) {
    return { ok: false, reason: 'preview-required' };
  }
  // Each explicit review authorizes ONE update attempt. Even a failed
  // attempt requires a new review so a second tab cannot be overwritten
  // just by clicking the same button again.
  resetProgressSyncCache();
  setSync('syncing', 'CAS update requested after explicit Cloud preview.');
  try {
    const client = await getClient();
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    const { data: verified, error: verifyError } = await client.auth.getUser();
    if (verifyError || verified?.user?.id !== userId || !stillValid()) {
      setSync('error', 'Cloud identity changed. Review backup again.');
      return { ok: false, reason: 'identity-not-verified' };
    }
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    const { data, error } = await client.rpc('save_progress_snapshot_cas', {
      p_namespace: 'arsenalMeta',
      p_expected_version: reviewed.version,
      p_payload: { unverified: true, guestProfileId: playerAccountAuthority.guestProfileId(), state: snapshot },
    });
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.ok === true) {
      setSync('saved', 'Unverified device snapshot saved. Cloud wallet unchanged.');
      return { ok: true, version: Number(row.current_version) };
    }
    const serverVersion = Number(row?.current_version) || null;
    setSync('conflict', 'Cloud backup changed after preview. Nothing overwritten. Review again.');
    return { ok: false, reason: 'conflict', serverVersion };
  } catch (error) {
    if (stillValid()) {
      setSync(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
        String(error && error.message || error));
    }
    return { ok: false, reason: 'upload-failed' };
  }
}

// One-time snapshot promotion candidate. The entire device state is stored
// as UNVERIFIED backup data, with a unique pending-review lineage row. Cloud
// wallet and fighter_ownership are NEVER touched by this code. The operation
// verifies the current user at the Auth server, and only CAS-inserts if the
// cloud has no snapshot already. It never overwrites another tab's progress.
export async function importGuestProgress() {
  if (!isCloudConfigured()) return unconfigured();
  const profile = playerAccountAuthority.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const userId = profile.profileId;
  const guestId = playerAccountAuthority.guestProfileId();
  const key = userId + ':' + guestId;
  if (guestHandoffInFlight && guestHandoffKey === key) return guestHandoffInFlight;
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const state = typeof meta?.getState === 'function' ? meta.getState() : null;
  if (!state) return { ok: false, reason: 'device-progress-unavailable' };
  const epoch = sessionEpoch;
  const stillValid = () => epoch === sessionEpoch
    && currentSessionUserId === userId
    && playerAccountAuthority.profile().profileId === userId
    && (typeof navigator === 'undefined' || navigator.onLine !== false);
  const task = (async () => {
    const client = await getClient();
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    setSync('syncing', 'Creating an unverified guest backup, not issuing cloud credits.');
    const result = await persistGuestHandoffIfEmpty({
      client, userId, guestId, snapshot: state, stillValid,
    });
    if (!stillValid()) return { ok: false, reason: 'session-superseded' };
    if (result.ok && result.result === 'created') {
      clearPendingLink(guestId);
      // Do not set CAS cache here: the manual upload must independently
      // fetch the server version after a background guest handoff.
      resetProgressSyncCache();
      setSync('saved', 'Unverified device backup saved; wallet is still local.');
    } else if (result.ok && result.result === 'existing') {
      clearPendingLink(guestId);
      resetProgressSyncCache();
      setSync('existing', 'A cloud snapshot already exists. It was NOT overwritten.');
    } else {
      setSync('error', 'Guest backup not completed: ' + (result.reason || 'unknown'));
    }
    return result;
  })().finally(() => {
    if (guestHandoffKey === key) {
      guestHandoffInFlight = null;
      guestHandoffKey = null;
    }
  });
  guestHandoffKey = key;
  guestHandoffInFlight = task;
  return task;
}

// One-time guest → account migration record. The snapshot is stored for the
// (server-gated) promotion policy; locally the player simply keeps playing
// with the same device wallet, so nothing can be lost or duplicated here.
export async function recordGuestMigration() {
  if (!isCloudConfigured()) return unconfigured();
  const profile = playerAccountAuthority.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const snapshot = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  const client = await getClient();
  const { error } = await client.from('guest_migrations').insert({
    user_id: profile.profileId,
    guest_profile_id: playerAccountAuthority.guestProfileId(),
    snapshot: { unverified: true, state: snapshot },
    status: 'pending-review',
  });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

const api = Object.freeze({
  version: 'a1-cloud-account-v1',
  isCloudConfigured,
  initCloudAccount,
  signInWithGoogle,
  signInWithEmailOtp,
  verifyEmailOtp,
  signOutCloud,
  requestAccountDeletion,
  previewCloudProgressSnapshot,
  uploadProgressSnapshot,
  importGuestProgress,
  recordGuestMigration,
});

export function installCloudAccount(scope = globalThis) {
  if (scope) {
    const current = scope.APEX_CLOUD_ACCOUNT;
    if (current && current.version === api.version) return current;
    // Locked binding, same law as the account/admin authorities.
    try {
      Object.defineProperty(scope, 'APEX_CLOUD_ACCOUNT', {
        value: api, writable: false, configurable: false, enumerable: true,
      });
    } catch (error) {
      try { scope.APEX_CLOUD_ACCOUNT = api; } catch (ignored) {}
    }
  }
  return api;
}

export default api;

// ── Deterministic lifecycle test seam (node gates only) ─────────────────────
// tools/testCloudLifecycleRaces.mjs injects a fake Supabase client here to
// prove epoch/revocation semantics (logout-during-role-fetch, offline
// revocation, account switching, stale async completion) without a live
// backend. Like the other internal channels in this design, this is an
// ES-module export that is NEVER attached to window or the frozen api
// object: module scope is unreachable from the devtools console, and a
// caller who can import this module already controls the client — the
// shipped bundle's behavior is unchanged (override stays null).
export const __cloudLifecycleTestHooks = Object.freeze({
  setClientOverride(client) {
    testClientOverride = client || null;
  },
  projectSession(client, session) {
    return projectSession(client, session);
  },
  handleOffline() {
    handleOffline();
  },
  refreshSessionProjection() {
    return refreshSessionProjection();
  },
  sessionEpoch: () => sessionEpoch,
  currentSessionUserId: () => currentSessionUserId,
  progressCache: () => ({ version: lastKnownProgressVersion, userId: lastKnownProgressUserId }),
  previewState: () => reviewedCloudSnapshot ? { ...reviewedCloudSnapshot } : null,
  resetLifecycle() {
    initialized = false;
    currentSessionUserId = null;
    resetProgressSyncCache();
  },
});
