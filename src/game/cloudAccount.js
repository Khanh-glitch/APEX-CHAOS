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
// inject either state (Blocker 1).

import playerAccountAuthority, {
  projectCloudSessionInternal,
  setCloudSyncStateInternal,
} from './playerAccount.js';
import { setVerifiedCloudAdminInternal } from './adminAuthority.js';

const SUPABASE_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const SUPABASE_ANON_KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';

export function isCloudConfigured() {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
}

let clientPromise = null;
async function getClient() {
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

// Projects a Supabase session into (a) the DISPLAY profile and (b) — only
// after server verification — the Admin authority's private channel. The
// two are deliberately separate (A1 closeout Blocker 1): what the UI shows
// is never treated as authorization evidence.
async function projectSession(client, session) {
  if (!session || !session.user) {
    projectCloudSessionInternal(null);
    setVerifiedCloudAdminInternal(null);
    setSync(isCloudConfigured() ? 'signed-out' : 'cloud-unconfigured', '');
    return;
  }
  const user = session.user;
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
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    const verified = !userError && userData && userData.user && userData.user.id === user.id
      ? userData.user : null;
    if (verified) {
      const { data: roleRow } = await client
        .from('account_roles').select('role').eq('user_id', verified.id).maybeSingle();
      if (roleRow && roleRow.role === 'admin') adminUserId = verified.id;
    }
  } catch (error) { /* fail closed: adminUserId stays null */ }
  setVerifiedCloudAdminInternal(adminUserId);
  setSync('saved', '');
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
      window.addEventListener('online', () => setSync('saved', ''));
      window.addEventListener('offline', () => setSync('offline', ''));
      if (navigator.onLine === false) setSync('offline', '');
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
  return error ? { ok: false, reason: error.message } : { ok: true, sent: true };
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
  const client = await getClient();
  const { error } = await client.auth.signOut();
  projectCloudSessionInternal(null);
  setVerifiedCloudAdminInternal(null);
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
// fields are never auto-applied on download.
let lastKnownProgressVersion = null;

export async function uploadProgressSnapshot() {
  if (!isCloudConfigured()) return unconfigured();
  const profile = playerAccountAuthority.profile();
  if (!profile || profile.kind !== 'cloud') return { ok: false, reason: 'signed-out' };
  const meta = typeof window !== 'undefined' ? window.APEX_ARSENAL_META : null;
  const snapshot = meta && typeof meta.getState === 'function' ? meta.getState() : null;
  if (!snapshot) return { ok: false, reason: 'wallet-unavailable' };
  setSync('syncing', '');
  try {
    const client = await getClient();
    if (lastKnownProgressVersion === null) {
      const { data: existing } = await client
        .from('player_progress').select('version')
        .eq('user_id', profile.profileId).eq('namespace', 'arsenalMeta').maybeSingle();
      lastKnownProgressVersion = existing ? Number(existing.version) || 0 : 0;
    }
    const { data, error } = await client.rpc('save_progress_snapshot_cas', {
      p_namespace: 'arsenalMeta',
      p_expected_version: lastKnownProgressVersion,
      p_payload: { unverified: true, guestProfileId: playerAccountAuthority.guestProfileId(), state: snapshot },
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.ok) {
      lastKnownProgressVersion = Number(row.current_version);
      setSync('saved', '');
      return { ok: true, version: lastKnownProgressVersion };
    }
    // CONFLICT: a newer snapshot landed first (second device). Preserve it.
    const serverVersion = row ? Number(row.current_version) : null;
    lastKnownProgressVersion = null; // force a fresh read before any retry
    setSync('conflict', 'A newer cloud snapshot exists (another device). Nothing was overwritten.');
    return { ok: false, reason: 'conflict', serverVersion };
  } catch (error) {
    setSync(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error',
      String(error && error.message || error));
    return { ok: false, reason: 'upload-failed' };
  }
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
  uploadProgressSnapshot,
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
